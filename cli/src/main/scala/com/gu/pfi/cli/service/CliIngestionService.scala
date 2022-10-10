package com.gu.pfi.cli.service

import java.net.URLEncoder
import java.nio.file.{Files, Path, Paths}

import com.google.common.io.{Files => GuavaFiles}
import com.gu.pfi.cli.model.VerifyIngestionResult
import model._
import model.index.IndexedBlob
import okhttp3.HttpUrl
import play.api.libs.json.{JsArray, Json}
import services.FingerprintServices
import utils.attempt.AttemptAwait._
import utils.attempt._
import utils.{IngestionVerification, Logging}

import scala.collection.JavaConverters._
import scala.concurrent.ExecutionContext

class CliIngestionService(http: CliHttpClient)(implicit ec: ExecutionContext) extends Logging {
  def listCollections(): Attempt[List[CliCollection]] = {
    http.get("/api/collections").flatMap { response =>
      response.validate[List[CliCollection]].toAttempt
    }
  }

  def listIngestions(): Attempt[List[CliIngestion]] = {
    listCollections().map(_.flatMap(_.ingestions))
  }

  def createCollection(collection: String): Attempt[CliCollection] = {
    http.post("/api/collections", Json.stringify(Json.toJson(CreateCollectionRequest(collection)))).flatMap{ response =>
      Json.parse(response.body().string()).validate[CliCollection].toAttempt
    }
  }

  def createIngestion(collection: String, root: Option[Path], ingestionName: String, languages: List[Language], fixed: Boolean): Attempt[CreateIngestionResponse] = {
    val req = CreateIngestionRequest(root.map(_.toAbsolutePath.toString), Some(ingestionName), languages.map(_.key), fixed = Some(fixed), default = Some(false))

    http.post(s"/api/collections/$collection", Json.stringify(Json.toJson(req))).flatMap { response =>
      Json.parse(response.body().string()).validate[CreateIngestionResponse].toAttempt
    }
  }

  def verifyIngestion(ingestionUri: String, checkDigest: Boolean, alternatePath: Option[Path]): Attempt[VerifyIngestionResult] = {
    logger.info(s"Verifying $ingestionUri")

    getIngestion(ingestionUri).flatMap { ingestion =>
      ingestion.path match {
        case Some(path) =>
          val root = alternatePath.getOrElse(Paths.get(path))
          Attempt.Right(
            verifyPath(ingestion, root, checkDigest)
          )

        case None =>
          Attempt.Left(IllegalStateFailure(s"Ingestion ${ingestionUri} is missing path"))
      }
    }
  }

  def getBlobs(collection: String, ingestion: String, size: Int): Attempt[List[IndexedBlob]] = {
    val params = List(
      s"collection=${URLEncoder.encode(collection, "UTF-8")}",
      s"ingestion=${URLEncoder.encode(ingestion, "UTF-8")}",
      s"size=${URLEncoder.encode(size.toString, "UTF-8")}"
    )

    http.get(s"/api/blobs?${params.mkString("&")}").map { r =>
      (r \ "blobs").as[List[IndexedBlob]]
    }
  }

  def deleteBlob(id: String): Attempt[Unit] = {

    // Setting checkChildren to false means that we delete this blob
    // regardless of whether or not it has children.
    http.delete(s"/api/blobs/${URLEncoder.encode(id, "UTF-8")}?checkChildren=false").map { r =>
      if(r.code() == 204) {
        Attempt.Right(())
      } else {
        Attempt.Left(IllegalStateFailure(s"${r.code()} ${r.body().string()}"))
      }
    }
  }

  def deleteIngestion(collection: String, ingestion: String): Attempt[Unit] = {
    http.delete(s"/api/collections/$collection/$ingestion").map { r =>
      if(r.code() == 204) {
        Attempt.Right(())
      } else {
        Attempt.Left(IllegalStateFailure(s"${r.code()} ${r.body().string()}"))
      }
    }
  }

  private def getIngestion(ingestionUri: String): Attempt[CliIngestion] = {
    listIngestions().flatMap { ingestions =>
      ingestions.find(_.uri == ingestionUri) match {
        case Some(ingestion) =>
          Attempt.Right(ingestion)

        case None =>
          Attempt.Left(NotFoundFailure(s"Ingestion $ingestionUri does not exist"))
      }
    }
  }

  private def verifyPath(ingestion: CliIngestion, root: Path, checkDigest: Boolean): VerifyIngestionResult = {
    val fsIterator = GuavaFiles.fileTraverser().depthFirstPreOrder(root.toFile).iterator().asScala
    val files = fsIterator.filter(f => Files.isRegularFile(f.toPath)).grouped(IngestionVerification.BATCH_SIZE)

    val base = VerifyIngestionResult(
      numberOfFilesOnDisk = 0,
      numberOfFilesInIndex = 0,
      filesInError = Map.empty,
      filesNotIndexed = List.empty
    )

    files.foldLeft(base) { (acc, files) =>
      val request = VerifyRequest(files.toList.map { file =>
        val path = CliIngestionService.relativise(root, file.toPath)
        val digest = if(checkDigest) Some(FingerprintServices.createFingerprintFromFile(file)) else { None }

        VerifyRequestFile(path, digest)
      })

      val requestJson = Json.stringify(Json.toJson(request))
      val rawResponse = http.post(s"/api/collections/${ingestion.uri}/verifyFiles", requestJson).await()

      val rawBody = rawResponse.body().string()
      val response = Json.parse(rawBody).as[VerifyResponse]

      acc.copy(
        numberOfFilesOnDisk = acc.numberOfFilesOnDisk + files.size,
        numberOfFilesInIndex = acc.numberOfFilesInIndex + response.numberOfFilesInIndex,
        filesNotIndexed = acc.filesNotIndexed ++ response.filesNotIndexed,
        filesInError = acc.filesInError ++ response.filesInError
      )
    }
  }
}

object CliIngestionService {
  def relativise(root: Path, path: Path): String = {
    s"${root.getFileName}/${root.relativize(path)}"
  }
}
