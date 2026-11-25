name := "giant"
description := "Tool for journalists to search, analyse and categorise unstructured data, often during an investigation"
version := "0.1.0"

ThisBuild / scalaVersion := "2.13.18"

import com.gu.riffraff.artifact.BuildInfo
import play.sbt.PlayImport.PlayKeys._
import sbt.Package.FixedTimestamp

import java.nio.charset.StandardCharsets

// needed to correctly set Last-Modified headers, fixing asset caching
// See https://github.com/guardian/grid/pull/3600/commits/01c904e4c47c5a4443c48354b92ada3e17533895
ThisBuild / packageOptions += FixedTimestamp(Package.keepTimestamps)

// Deployment packages do not need Scala API documentation.
ThisBuild / Compile / packageDoc / publishArtifact := false

val compilerFlags = Seq(
  "-unchecked",
  "-deprecation",
  "-feature",
  "-Xfatal-warnings"
)

val awsSdkVersion2 = "2.59.3"
val log4jVersion = "2.26.1"
val slf4jVersion = "2.0.20"
val scalatestVersion = "3.2.20"
// 0.44.x brings a docker-java that negotiates Docker Engine's API version; older releases
// pinned a version below the minimum (1.40) enforced by Engine 29+, so testcontainers could
// not start (HTTP 400 from the daemon).
val testcontainersScalaVersion = "0.44.1"
val playJsonVersion = "3.0.6"
val jacksonVersion = "2.23.0"

// Backend-only Jackson pins leave vulnerable versions in the CLI and shared projects.
ThisBuild / dependencyOverrides ++= Seq(
  "com.fasterxml.jackson.core" % "jackson-annotations" % "2.23",
  "com.fasterxml.jackson.core" % "jackson-core" % jacksonVersion,
  "com.fasterxml.jackson.core" % "jackson-databind" % jacksonVersion,
  "com.fasterxml.jackson.dataformat" % "jackson-dataformat-cbor" % jacksonVersion,
  "com.fasterxml.jackson.datatype" % "jackson-datatype-jdk8" % jacksonVersion,
  "com.fasterxml.jackson.datatype" % "jackson-datatype-jsr310" % jacksonVersion,
  "com.fasterxml.jackson.module" % "jackson-module-parameter-names" % jacksonVersion,
  "com.fasterxml.jackson.module" %% "jackson-module-scala" % jacksonVersion
)

val transcriptionWorkerInterfacePackage =
  "com.gu.transcriptionservice.workerinterface"

val port = 9001

def itFilter(name: String): Boolean = name endsWith "ITest"
lazy val IntTest = config("int") extend Test

lazy val buildInfoSettings = Seq(
  buildInfoKeys ++= {
    import sys.process._
    val buildInfo = BuildInfo(baseDirectory.value)

    Seq[BuildInfoKey](
      name,
      version,
      scalaVersion,
      sbtVersion,
      "vcsCommitId" -> buildInfo.revision,
      "vcsBranch" -> buildInfo.branch,
      "buildNumber" -> buildInfo.buildIdentifier,
      "builtOnHost" -> Option(System.getenv("HOSTNAME"))
        .orElse(Option("hostname".!!.trim).filter(_.nonEmpty))
        .getOrElse("<unknown>")
        .replace("\"", "")
        .trim
    )
  },
  buildInfoOptions ++= Seq(
    BuildInfoOption.ToJson,
    BuildInfoOption.ToMap
  ),
  buildInfoPackage := "utils.buildinfo"
)

lazy val runAllTests = taskKey[Unit](
  "Running all tests or integration tests"
)

lazy val fetchSchema = inputKey[Unit](
  "Fetch the transcription worker interface JSON schema from the transcription service repository. " +
    "Optionally takes the branch (or tag/commit) to fetch from, defaulting to main, e.g. `fetchSchema my-branch`"
)

lazy val generateInterface = taskKey[Unit](
  "Generate the Scala case classes in the transcription-worker-interface project from the transcription worker interface JSON schema"
)

lazy val checkInterface = taskKey[Unit](
  "Fail if the checked-in transcription worker interface Scala has drifted from the JSON schema"
)

lazy val root = (project in file("."))
  .aggregate(transcriptionWorkerInterface, common, backend, cli)
  .settings(
    runAllTests := Def
      .sequential(
        transcriptionWorkerInterface / checkInterface,
        transcriptionWorkerInterface / Test / test,
        common / Test / test,
        cli / Test / test,
        backend / Test / test,
        backend / IntTest / test
      )
      .value,
  )

// Scala model of the messages exchanged with the external transcription service. The case classes are
// generated from worker-interface-schema.json by running `sbt generateTranscriptionWorkerInterface`
// (a manual step, whenever the schema changes) and are checked in under src/main/scala.
lazy val transcriptionWorkerInterface =
  (project in file("transcription-worker-interface"))
    .settings(
      name := "transcription-service-worker-interface",
      scalacOptions := compilerFlags,
      libraryDependencies ++= Seq(
        "org.playframework" %% "play-json" % playJsonVersion,
        "org.scalatest" %% "scalatest" % scalatestVersion % Test
      ),
      fetchSchema := {
        TranscriptionSchemaFetcher.fetch(
          args = Def.spaceDelimited("<branch>").parsed,
          schemaFile = baseDirectory.value / "worker-interface-schema.json",
          log = streams.value.log
        )
      },
      generateInterface := {
        val log = streams.value.log
        val schema = baseDirectory.value / "worker-interface-schema.json"
        val outputDirectory =
          (Compile / sourceDirectory).value / "scala" / transcriptionWorkerInterfacePackage.split('.').mkString("/")
        val outputFile = outputDirectory / "TranscriptionWorkerInterface.scala"

        val generated =
          TranscriptionWorkerInterfaceGenerator.generate(schema, transcriptionWorkerInterfacePackage)

        IO.delete(outputDirectory)
        IO.createDirectory(outputDirectory)
        IO.write(outputFile, generated, StandardCharsets.UTF_8)

        log.info(s"Generated $outputFile from $schema")
      },
      checkInterface := {
        val schema = baseDirectory.value / "worker-interface-schema.json"
        val outputFile =
          (Compile / sourceDirectory).value / "scala" /
            transcriptionWorkerInterfacePackage.split('.').mkString("/") / "TranscriptionWorkerInterface.scala"

        val expected =
          TranscriptionWorkerInterfaceGenerator.generate(schema, transcriptionWorkerInterfacePackage)
        val actual = if (outputFile.exists) IO.read(outputFile, StandardCharsets.UTF_8) else ""

        if (expected != actual) {
          sys.error(
            s"$outputFile is out of date with respect to $schema. " +
              "Run `sbt generateTranscriptionWorkerInterface` and commit the result."
          )
        }
      }
    )

lazy val common = (project in file("common"))
  .dependsOn(transcriptionWorkerInterface)
  .settings(
    name := "common",
    scalacOptions := compilerFlags,
    libraryDependencies ++= Seq(
      "org.typelevel" %% "cats-core" % "2.13.0",
      "org.playframework" %% "play-json" % playJsonVersion,
      "org.playframework" %% "play-json-joda" % playJsonVersion,
      "software.amazon.awssdk" % "s3" % awsSdkVersion2,
      "software.amazon.awssdk" % "s3-transfer-manager" % awsSdkVersion2,
      "org.scalatest" %% "scalatest" % scalatestVersion,
      "software.amazon.awssdk" % "auth" % awsSdkVersion2,
      "software.amazon.awssdk" % "s3" % awsSdkVersion2,
      // Play has a transitive dependency on Logback,
      // but we specify one here to ensure that Play uses compatible
      // versions of SLF4J and Logback (i.e. its versions should be evicted by those here).
      // https://github.com/playframework/playframework/issues/11499#issuecomment-1285654119
      "org.slf4j" % "slf4j-api" % slf4jVersion,
      "ch.qos.logback" % "logback-classic" % "1.6.7"
    )
  )

import play.sbt.routes.RoutesKeys

lazy val backend = (project in file("backend"))
  .enablePlugins(PlayScala, JDebPackaging, SystemdPlugin, BuildInfoPlugin, UniversalPlugin)
  .dependsOn(common)
  .configs(IntTest)
  .settings(buildInfoSettings)
  .settings(
    name := "pfi",
    includeDocumentationInBinary := false,
    scalacOptions := compilerFlags,
    evictionErrorLevel := Level.Warn,
    // Tests use Play's application helpers, but not its browser automation support. At the time of committing
    // these libraries had multiple vulnerabilities - see https://github.com/guardian/giant/pull/870
    excludeDependencies ++= Seq(
      ExclusionRule("io.fluentlenium", "fluentlenium-core"),
      ExclusionRule("org.seleniumhq.selenium", "htmlunit-driver")
    ),
    libraryDependencies ++= Seq(
      ws,
      "commons-codec" % "commons-codec" % "1.23.0",
      "org.bouncycastle" % "bcprov-jdk18on" % "1.87",
      // required by tikka, used to be part of bcprov-jdk15on, pulled out into a separate library from 1.69 onwards
      // see https://github.com/guardian/giant/pull/92 for details - may be removable if it gets added as an explicit
      // dependency to tikka or another library
      "org.bouncycastle" % "bcutil-jdk18on" % "1.87",
      "commons-io" % "commons-io" % "2.22.0",
      "nl.gn0s1s" %% "elastic4s-client-esjava" % "9.5.1",
      "org.elasticsearch.client" % "elasticsearch-rest-client-sniffer" % "9.5.7",
      "org.apache.pekko" %% "pekko-cluster-typed" % "1.0.3", // Needs to match pekko version in Play
      "org.neo4j.driver" % "neo4j-java-driver" % "6.3.0",
      "com.pff" % "java-libpst" % "0.9.3",
      // Tika 3 loads custom-mimetypes.xml from the classpath root (backend/conf).
      "org.apache.tika" % "tika-parsers-standard-package" % "3.3.3",
      "org.apache.tika" % "tika-core" % "3.3.3",
      "org.apache.tika" % "tika-langdetect-optimaize" % "3.3.3",
      "org.apache.commons" % "commons-compress" % "1.28.0",
      "org.apache.logging.log4j" % "log4j-to-slf4j" % log4jVersion,
      "org.apache.logging.log4j" % "log4j-api" % log4jVersion,
      "org.apache.logging.log4j" % "log4j-core" % log4jVersion,
      "net.logstash.logback" % "logstash-logback-encoder" % "6.6",
      "com.github.jwt-scala" %% "jwt-play" % "12.0.0",
      "software.amazon.awssdk" % "ec2" % awsSdkVersion2,
      "software.amazon.awssdk" % "ssm" % awsSdkVersion2,
      "software.amazon.awssdk" % "autoscaling" % awsSdkVersion2,
      "software.amazon.awssdk" % "cloudwatch" % awsSdkVersion2,
      "software.amazon.awssdk" % "sqs" % awsSdkVersion2,
      "software.amazon.awssdk" % "sns" % awsSdkVersion2,
      "software.amazon.awssdk" % "secretsmanager" % awsSdkVersion2,
      "software.amazon.awssdk" % "imds" % awsSdkVersion2,
      "com.beachape" %% "enumeratum-play" % "1.9.8",
      "com.iheart" %% "ficus" % "1.5.2",
      "org.jsoup" % "jsoup" % "1.24.1",
      // angus mail is the implementation of jakarta mail. If updating this you may also need to update the mbox provider jar file
      // see https://github.com/guardian/giant/pull/131
      "org.eclipse.angus" % "angus-mail" % "2.0.5",
      "com.sun.mail" % "javax.mail" % "1.6.2",
      "com.gu" %% "pan-domain-auth-verification" % "23.1.0",

      // Libraries whose use are potentially contentious

      // These dependencies allow PDF box to read images (which is critical for PdfOcrExtractor)
      "org.apache.pdfbox" % "jbig2-imageio" % "3.0.5",
      // The license for jpeg2000 below is unusual and would need review (or removal) before any open sourcing effort
      "com.github.jai-imageio" % "jai-imageio-jpeg2000" % "1.4.0",
      // Subject to the mad unRAR restriction so again should be reviewed before any open sourcing
      // The latest code is here: https://github.com/junrar/junrar (not in the older repository that appears first in Google)
      "com.github.junrar" % "junrar" % "7.6.1",

      // postgres
      "org.scalikejdbc" %% "scalikejdbc" % "4.3.5",
      "org.postgresql" % "postgresql" % "42.7.14",

      // Test dependencies

      "org.scalacheck" %% "scalacheck" % "1.20.0" % Test,
      "org.scalatestplus.play" %% "scalatestplus-play" % "7.0.2" % Test,
      "org.scalamock" %% "scalamock" % "4.4.0" % Test,
      "com.dimafeng" %% "testcontainers-scala-scalatest" % testcontainersScalaVersion % Test,
      "com.dimafeng" %% "testcontainers-scala-neo4j" % testcontainersScalaVersion % Test,
      "com.dimafeng" %% "testcontainers-scala-elasticsearch" % testcontainersScalaVersion % Test
    ),

    // set up separate tests and integration tests - http://www.scala-sbt.org/0.13.1/docs/Detailed-Topics/Testing.html#custom-test-configuration
    inConfig(IntTest)(Defaults.testTasks),
    Test / testOptions := Seq(Tests.Filter(name => !itFilter(name))),
    IntTest / testOptions := Seq(Tests.Filter(itFilter)),
    RoutesKeys.routesImport += "utils.Binders._",
    playDefaultPort := port,
    debianPackageDependencies := Seq("java-21-amazon-corretto-jdk"),
    Linux / maintainer := "Guardian Developers <dig.dev.software@theguardian.com>",
    Linux / packageSummary := description.value,
    packageDescription := description.value,
    Universal / mappings ~= {
      _.filterNot { case (_, fileName) => fileName == "conf/site.conf" }
    },
    Universal / javaOptions ++= Seq(
      "-Dpidfile.path=/dev/null",
      "-J-XX:MaxRAMPercentage=50",
      "-J-XX:InitialRAMPercentage=50",
      "-J-XX:+UseG1GC",
      "-J-Xlog:gc*",
      "-J-XX:+HeapDumpOnOutOfMemoryError",
      s"-J-Xloggc:/var/log/${name.value}/gc.log",
      s"-J-Dhttp.port=$port"
    )
  )

lazy val cli = (project in file("cli"))
  .dependsOn(common)
  .enablePlugins(JavaAppPackaging, BuildInfoPlugin, UniversalPlugin)
  .settings(buildInfoSettings)
  .settings(
    name := "pfi-cli",
    scalacOptions := compilerFlags,
    libraryDependencies ++= Seq(
      "org.rogach" %% "scallop" % "3.5.1",
      "com.beachape" %% "enumeratum" % "1.9.8",
      "com.squareup.okhttp3" % "okhttp" % "4.12.1",
      "com.auth0" % "java-jwt" % "3.19.4",
      "org.slf4j" % "jcl-over-slf4j" % slf4jVersion,
      "com.google.guava" % "guava" % "33.8.0-jre",
      "org.scalatest" %% "scalatest" % scalatestVersion,
      "software.amazon.awssdk.crt" % "aws-crt" % "0.48.5"
    ),
    run / fork := true,
    run / connectInput := true,
    Universal / mappings +=
      ((Compile / resourceDirectory).value / "logback.xml") -> "conf/logback.xml",
    bashScriptExtraDefines +=
      """addJava "-Dlogback.configurationFile=${app_home}/../conf/logback.xml""""
  )
