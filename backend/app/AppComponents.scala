import org.apache.pekko.actor.{ActorSystem, CoordinatedShutdown}
import org.apache.pekko.actor.CoordinatedShutdown.Reason
import cats.syntax.either._
import com.amazonaws.client.builder.AwsClientBuilder
import java.net.URI
import software.amazon.awssdk.services.sns.SnsClient
import software.amazon.awssdk.services.sqs.SqsClient
import com.gu.pandomainauth
import com.gu.pandomainauth.PublicSettings
import controllers.AssetsComponents
import controllers.api._
import controllers.frontend.App
import controllers.genesis.Genesis
import extraction.archives.{RarExtractor, ZipExtractor}
import extraction.email.eml.{EmlEmailExtractor, EmlParser}
import extraction.email.mbox.MBoxEmailExtractor
import extraction.email.msg.MsgEmailExtractor
import extraction.email.olm.OlmEmailExtractor
import extraction.email.pst.PstEmailExtractor
import extraction.ocr.{ImageOcrExtractor, OcrMyPdfExtractor, OcrMyPdfImageExtractor, TesseractPdfOcrExtractor}
import extraction.tables.{CsvTableExtractor, ExcelTableExtractor}
import extraction.{DocumentBodyExtractor, ExternalTranscriptionExtractor, ExternalTranscriptionWorker, MimeTypeMapper, TranscriptionExtractor, Worker}
import ingestion.phase2.IngestStorePolling
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.neo4j.driver.v1.{AuthTokens, GraphDatabase}
import play.api.ApplicationLoader.Context
import play.api.BuiltInComponentsFromContext
import play.api.libs.ws.ahc.AhcWSComponents
import play.api.mvc.EssentialFilter
import play.filters.HttpFiltersComponents
import router.Routes
import services._
import services.annotations.Neo4jAnnotations
import services.events.ElasticsearchEvents
import services.index.{ElasticsearchPages, ElasticsearchResources, Pages2}
import ingestion.{IngestionServices, Neo4jRemoteIngestStore, RemoteIngestWorker}
import services.manifest.Neo4jManifest
import services.observability.{PostgresClientDoNothing, PostgresClientImpl}
import services.previewing.PreviewService
import services.table.ElasticsearchTable
import services.users.Neo4jUserManagement
import utils._
import utils.attempt.AttemptAwait._
import utils.auth.providers.{DatabaseUserProvider, PanDomainUserProvider}
import utils.auth.totp.{SecureSecretGenerator, Totp}
import utils.auth.{DefaultAuthActionBuilder, PasswordHashing, PasswordValidator}
import utils.aws.S3Client
import utils.controller.{AuthControllerComponents, CloudWatchReportingFailureToResultMapper}

import java.net.InetAddress
import java.nio.file.Paths
import java.security.Security
import java.time.Clock
import java.util.concurrent.TimeUnit
import scala.concurrent.Await
import scala.concurrent.duration._
import scala.language.postfixOps
import scala.util.control.NonFatal

class AppComponents(context: Context, config: Config)
  extends BuiltInComponentsFromContext(context) with AssetsComponents with HttpFiltersComponents with AhcWSComponents with Logging {

  // TODO MRB: should we have allowed hosts enabled? how could it point to the ELB?
  val disabledFilters: Set[EssentialFilter] = Set(allowedHostsFilter)

  override def httpFilters: Seq[EssentialFilter] = {
    super.httpFilters.filterNot(disabledFilters.contains) ++ Seq(
      new AllowFrameFilter,
      new RequestLoggingFilter(materializer),
      new ReadOnlyFilter(config.app, materializer)
    )
  }

  Security.addProvider(new BouncyCastleProvider())
  val router = try {
    val workerExecutionContext = actorSystem.dispatchers.lookup("work-context")
    val neo4jExecutionContext = actorSystem.dispatchers.lookup("neo4j-context")
    val s3ExecutionContext = actorSystem.dispatchers.lookup("s3-context")
    val ingestionExecutionContext = actorSystem.dispatchers.lookup("ingestion-context")

    val s3Client = new S3Client(config.s3)(s3ExecutionContext)

    val sqsClient = if (config.sqs.endpoint.isDefined)
      SqsClient.builder().endpointOverride(URI.create(config.sqs.endpoint.get)).region(config.sqs.regionV2).build()
    else
      SqsClient.builder().region(config.sqs.regionV2).build()

    val snsClient = if (config.sqs.endpoint.isDefined)
      SnsClient.builder().endpointOverride(URI.create(config.sqs.endpoint.get)).region(config.sqs.regionV2).build()
    else
      SnsClient.builder().region(config.sqs.regionV2).build()

    val workerName = config.worker.name.getOrElse(InetAddress.getLocalHost.getHostName)

    val scratchSpace = new ScratchSpace(Paths.get(config.ingestion.scratchPath))
    scratchSpace.setup().await()

    // data storage services
    val ingestStorage = S3IngestStorage(s3Client, config.s3.buckets.ingestion, config.s3.buckets.deadLetter).valueOr(failure => throw new Exception(failure.msg))
    val blobStorage = S3ObjectStorage(s3Client, config.s3.buckets.collections).valueOr(failure => throw new Exception(failure.msg))
    val transcriptStorage = S3ObjectStorage(s3Client, config.s3.buckets.transcription).valueOr(failure => throw new Exception(failure.msg))
    val remoteIngestStorage = S3IngestStorage(s3Client, config.s3.buckets.remoteIngestion, config.s3.buckets.deadLetter).valueOr(failure => throw new Exception(failure.msg))

    val postgresClient = config.postgres match {
      case Some(postgresConfig) =>  new PostgresClientImpl(postgresConfig)
      case None =>
        logger.warn("Postgres config not found, using dummy postgres client!")
        new PostgresClientDoNothing
    }
    val esClient = ElasticsearchClient(config).await()
    val esResources = new ElasticsearchResources(esClient, config.elasticsearch.indexName).setup().await()
    val esTables = new ElasticsearchTable(esClient, config.elasticsearch.tableRowIndexName).setup().await()
    val esEvents = new ElasticsearchEvents(esClient, config.elasticsearch.eventIndexName).setup().await()
    val esPages = new ElasticsearchPages(esClient, config.elasticsearch.pageIndexNamePrefix).setup().await()
    val pages2 = new Pages2(esClient, config.elasticsearch.pageIndexNamePrefix)

    val neo4jDriver = GraphDatabase.driver(config.neo4j.url, AuthTokens.basic(config.neo4j.user, config.neo4j.password))
    val manifest = Neo4jManifest.setupManifest(neo4jDriver, neo4jExecutionContext, config.neo4j.queryLogging).valueOr(failure => throw new Exception(failure.msg))
    val remoteIngestStore = Neo4jRemoteIngestStore.setup(neo4jDriver, neo4jExecutionContext, config.neo4j.queryLogging).valueOr(failure => throw new Exception(failure.msg))
    val annotations = Neo4jAnnotations.setupAnnotations(neo4jDriver, neo4jExecutionContext, config.neo4j.queryLogging).valueOr(failure => throw new Exception(failure.msg))
    val users = Neo4jUserManagement(neo4jDriver, neo4jExecutionContext, config.neo4j.queryLogging, manifest, esResources, esPages, annotations)
    val metricsService = config.aws.map(new CloudwatchMetricsService(_)).getOrElse(new NoOpMetricsService())

    val userProvider = config.auth.provider match {
      case config: DatabaseAuthConfig =>
        val secureSecretGenerator = new SecureSecretGenerator()
        val totpService = Totp.googleAuthenticatorInstance()
        val passwordHashingService = new PasswordHashing()
        val passwordValidator = new PasswordValidator(config.minPasswordLength)
        new DatabaseUserProvider(config, passwordHashingService, users, totpService, secureSecretGenerator, passwordValidator)
      case config: PandaAuthConfig =>
        val credentials = AwsCredentials(profile = config.aws.profile)
        val pandaS3Client = AwsS3Clients.pandaS3Client(credentials, config.aws.region)
        val publicSettings = new PublicSettings(config.publicSettingsKey, config.bucketName, pandaS3Client)
        // start polling of S3 bucket for public key
        publicSettings.start()
        new PanDomainUserProvider(config, () => publicSettings.verification, users, metricsService)
    }

    logger.info(s"Initialised authentication provider '${config.auth.provider}'")

    // processing services
    val tika = Tika.createInstance
    val mimeTypeMapper = new MimeTypeMapper()
    val ingestionServices = IngestionServices(manifest, esResources, blobStorage, tika, mimeTypeMapper, postgresClient)

    // Preview
    val previewStorage = S3ObjectStorage(s3Client, config.s3.buckets.preview).valueOr(failure => throw new Exception(failure.msg))
    val previewService = PreviewService(config.preview, esResources, blobStorage, previewStorage)

    // extractors
    val documentBodyExtractor = new DocumentBodyExtractor(tika, esResources)

    val zipExtractor = new ZipExtractor(scratchSpace, ingestionServices)
    val rarExtractor = new RarExtractor(scratchSpace, ingestionServices)

    val pstExtractor = new PstEmailExtractor(scratchSpace, ingestionServices)
    val olmExtractor = new OlmEmailExtractor(scratchSpace, ingestionServices)
    val msgExtractor = new MsgEmailExtractor(scratchSpace, ingestionServices, tika)

    val emlParser = new EmlParser(scratchSpace, ingestionServices)
    val emlExtractor = new EmlEmailExtractor(emlParser)
    val mboxExtractor = new MBoxEmailExtractor(emlParser)

    val tesseractPdfOcrExtractor = new TesseractPdfOcrExtractor(config.ocr, scratchSpace, esResources, esPages, ingestionServices)
    val ocrMyPdfExtractor = new OcrMyPdfExtractor(scratchSpace, esResources, esPages, previewStorage, ingestionServices)
    val imageOcrExtractor = new ImageOcrExtractor(config.ocr, scratchSpace, esResources, ingestionServices)
    val ocrMyPdfImageExtractor = new OcrMyPdfImageExtractor(config.ocr, scratchSpace, esResources, previewStorage, ingestionServices)


    val transcriptionExtractor = if (config.worker.useExternalExtractors) {
      new ExternalTranscriptionExtractor(esResources, config.transcribe, blobStorage, transcriptStorage, sqsClient)
    } else {
      new TranscriptionExtractor(esResources, scratchSpace, config.transcribe)
    }

    val ocrExtractors = config.ocr.defaultEngine match {
      case OcrEngine.OcrMyPdf => List(ocrMyPdfExtractor, ocrMyPdfImageExtractor)
      case OcrEngine.Tesseract => List(tesseractPdfOcrExtractor, imageOcrExtractor)
    }

    val csvTableExtractor = new CsvTableExtractor(scratchSpace, esTables)
    val excelTableExtractor = new ExcelTableExtractor(scratchSpace, esTables)

    val extractors = List(olmExtractor, zipExtractor, rarExtractor, documentBodyExtractor, pstExtractor, emlExtractor, msgExtractor, mboxExtractor, csvTableExtractor, excelTableExtractor, transcriptionExtractor) ++ ocrExtractors
    extractors.foreach(mimeTypeMapper.addExtractor)

    // Common components
    val failureToResultMapper = new CloudWatchReportingFailureToResultMapper(metricsService)
    val authActionBuilder = new DefaultAuthActionBuilder(controllerComponents, failureToResultMapper, config.auth.timeouts.maxLoginAge, config.auth.timeouts.maxVerificationAge, users)(configuration, Clock.systemUTC())
    val authControllerComponents = new AuthControllerComponents(authActionBuilder, failureToResultMapper, users, controllerComponents)

    // Controllers
    val appController = new App(controllerComponents, assets, config, userProvider, config.aws)
    val authController = new Authentication(authControllerComponents, userProvider, users, config)(configuration, Clock.systemUTC())
    val genesisController = new Genesis(controllerComponents, userProvider, users, config.auth.enableGenesisFlow)
    val eventsController = new Events(authControllerComponents, esEvents)
    val collectionsController = new Collections(authControllerComponents, manifest, users, esResources, config.s3, esEvents, esPages, ingestionServices, annotations)
    val blobsController = new Blobs(authControllerComponents, manifest, esResources, blobStorage, previewStorage, postgresClient)
    val filtersController = new Filters(authControllerComponents, manifest, annotations)
    val searchController = new Search(authControllerComponents, users, esResources, annotations, metricsService)
    val videoVerifierController = new VideoVerifier(authControllerComponents)
    val documentsController = new Documents(authControllerComponents, manifest, esResources, blobStorage, users, annotations, config.auth.timeouts.maxDownloadAuthAge)
    val resourceController = new Resource(authControllerComponents, manifest, esResources, esPages, annotations, previewStorage)
    val emailController = new Emails(authControllerComponents, manifest, esResources, annotations)
    val mimeTypesController = new MimeTypes(authControllerComponents, manifest)
    val previewController = new Previews(authControllerComponents, manifest, esResources, previewService, users, annotations, config.auth.timeouts.maxDownloadAuthAgePreview)
    val workspacesController = new Workspaces(authControllerComponents, annotations, esResources, manifest, users, blobStorage, previewStorage, postgresClient, remoteIngestStore, remoteIngestStorage, config.remoteIngest, snsClient)
    val commentsController = new Comments(authControllerComponents, manifest, esResources, annotations)
    val usersController = new Users(authControllerComponents, userProvider)
    val pagesController = new PagesController(authControllerComponents, manifest, esResources, pages2, annotations, previewStorage)
    val ingestionController = new Ingestion(authControllerComponents, ingestStorage)
    val ingestionEventsController = new IngestionEvents(authControllerComponents, postgresClient, users )

    val workerControl = config.aws match {
      case Some(awsDiscoveryConfig) =>
        new AWSWorkerControl(config.worker, awsDiscoveryConfig, ingestStorage, manifest)

      case None =>
        new PekkoWorkerControl(actorSystem)
    }

    // Schedulers
    if (config.worker.enabled) {
      logger.info("Worker enabled on this instance")

      // PFI processors
      val worker = new Worker(workerName, manifest, blobStorage, extractors, metricsService, postgresClient)(workerExecutionContext)

      // ingestion phase 2
      val phase2IngestionScheduler =
        new IngestStorePolling(actorSystem, workerExecutionContext, workerControl, ingestStorage, scratchSpace, ingestionServices, config.ingestion.batchSize, metricsService, postgresClient)
      phase2IngestionScheduler.start()
      applicationLifecycle.addStopHook(() => phase2IngestionScheduler.stop())

      // extractor
      val workerScheduler = new WorkerScheduler(actorSystem, worker, config.worker.interval)(workerExecutionContext)
      workerScheduler.start()
      applicationLifecycle.addStopHook(() => workerScheduler.stop())

      // external extractor
      val externalWorker = new ExternalTranscriptionWorker(manifest, sqsClient, config.transcribe, transcriptStorage, esResources)
      val externalWorkerScheduler = new ExternalWorkerScheduler(actorSystem, externalWorker, config.worker.interval)(workerExecutionContext)
      externalWorkerScheduler.start()
      applicationLifecycle.addStopHook(() => externalWorkerScheduler.stop())

      val remoteIngestWorker = new RemoteIngestWorker(sqsClient, config.remoteIngest, config.s3, annotations, remoteIngestStore, remoteIngestStorage, scratchSpace, manifest, esEvents, esResources, esPages, ingestionServices)
      val remoteIngestScheduler = new RemoteIngestScheduler(actorSystem, remoteIngestWorker, config.worker.interval)(workerExecutionContext)
      remoteIngestWorker.start()
      remoteIngestScheduler.start()
      applicationLifecycle.addStopHook(() => remoteIngestScheduler.stop())
    } else {
      logger.info("Worker disabled on this instance")

      workerControl.start(actorSystem.scheduler)(workerExecutionContext)
      applicationLifecycle.addStopHook(() => workerControl.stop())
    }

    // Router
    new Routes(
      httpErrorHandler,
      eventsController,
      collectionsController,
      ingestionController,
      ingestionEventsController,
      blobsController,
      filtersController,
      searchController,
      documentsController,
      commentsController,
      resourceController,
      pagesController,
      emailController,
      mimeTypesController,
      workspacesController,
      previewController,
      usersController,
      videoVerifierController,
      authController,
      appController,
      genesisController,
      assets
    )
  } catch {
    case NonFatal(e) =>
      // If an exception is thrown then it's helpful (in dev mode at least) to try to shutdown anything that has
      // already started up. This will ensure that the actor system and other resources are properly tidied up
      //
      // If the exception comes initialising the actor system itself then running the CoordinatedShutdown will try and
      // initialise it again, so we also log the original error to make sure we see it
      logger.error("Error during initialisation, starting co-ordinated shutdown", e)
      Await.ready(CoordinatedShutdown(actorSystem).run(new Reason {}), 10 seconds)

      throw e
  }
}
