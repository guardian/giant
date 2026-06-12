package com.gu.pfi.cli

import java.nio.file.{Files, Path, Paths}
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.{Executors, TimeUnit}

import com.gu.pfi.cli.service.{BlobS3Client, CliServices}
import play.api.libs.json.{JsArray, JsValue}
import utils.Logging
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext

/**
  * A single file to download: the blob's content-hash URI plus the path (relative to the
  * output directory) at which it should be written, reconstructed from the workspace's
  * folder structure and the original file name.
  */
case class WorkspaceDownloadItem(blobUri: String, relativePath: Path)

object DownloadWorkspace {
  /**
    * Walk the workspace tree JSON (a `TreeEntry[WorkspaceEntry]` as returned by
    * `GET /api/workspaces/:id/nodes`) into a flat list of downloadable items.
    *
    * The export is nested under a folder named after the workspace: the backend keeps the tree's
    * root node `name` in sync with the workspace name, so the root `.name` is the workspace name
    * (falling back to `fallbackName` if it's blank). Nodes (folders) below the root contribute a
    * path segment from their `name`; leaves (files) contribute a blob `data.uri` and a final
    * segment from their `name`.
    *
    * Leaves without a `data.uri` (e.g. unprocessed remote-ingest tasks or captured URLs that
    * never produced a blob) are skipped.
    */
  def flatten(tree: JsValue, fallbackName: String): List[WorkspaceDownloadItem] = {
    def sanitise(segment: String): String = {
      val cleaned = segment.replace('/', '_').replace('\\', '_').trim
      if (cleaned.isEmpty || cleaned == "." || cleaned == "..") "_" else cleaned
    }

    // Top-level folder named after the workspace; fall back when the root name is blank.
    val rootName = (tree \ "name").asOpt[String].map(sanitise).filter(_ != "_").getOrElse(sanitise(fallbackName))

    def walk(node: JsValue, prefix: Vector[String]): List[WorkspaceDownloadItem] = {
      (node \ "children").asOpt[JsArray] match {
        case Some(JsArray(children)) =>
          // A folder node: recurse, extending the path with this node's (sanitised) name.
          children.toList.flatMap(child => walk(child, prefix :+ sanitise((node \ "name").as[String])))

        case _ =>
          // A leaf. Only files backed by a blob (data.uri present) can be downloaded.
          (node \ "data" \ "uri").asOpt[String] match {
            case Some(blobUri) =>
              val fileName = sanitise((node \ "name").asOpt[String].getOrElse(blobUri))
              List(WorkspaceDownloadItem(blobUri, Paths.get(prefix.mkString("/"), fileName)))
            case None =>
              Nil
          }
      }
    }

    // Start every path at the workspace-name folder; the root node's children hang off it.
    (tree \ "children").asOpt[JsArray] match {
      case Some(JsArray(children)) => children.toList.flatMap(child => walk(child, Vector(rootName)))
      case _ => Nil
    }
  }

  /**
    * Disambiguate items that would collide on disk (the same blob can appear under multiple
    * workspace paths, and two differently-named tree entries can sanitise to the same name).
    * Colliding entries get the first 8 chars of their blob URI inserted before the extension.
    */
  def deduplicate(items: List[WorkspaceDownloadItem]): List[WorkspaceDownloadItem] = {
    val seen = scala.collection.mutable.Set.empty[String]
    items.map { item =>
      val key = item.relativePath.toString
      if (seen.add(key)) {
        item
      } else {
        val name = item.relativePath.getFileName.toString
        val dot = name.lastIndexOf('.')
        val suffix = item.blobUri.take(8)
        val disambiguated =
          if (dot > 0) s"${name.substring(0, dot)}-$suffix${name.substring(dot)}"
          else s"$name-$suffix"
        val parent = Option(item.relativePath.getParent)
        val newPath = parent.map(_.resolve(disambiguated)).getOrElse(Paths.get(disambiguated))
        seen.add(newPath.toString)
        item.copy(relativePath = newPath)
      }
    }
  }
}

class DownloadWorkspace(workspaceId: String, outDir: Path, services: CliServices, s3: BlobS3Client,
                        concurrency: Int, dryRun: Boolean)(implicit ec: ExecutionContext) extends Logging {

  def run(): Attempt[Unit] = {
    services.http.get(s"/api/workspaces/$workspaceId/nodes").map { tree =>
      val items = DownloadWorkspace.deduplicate(DownloadWorkspace.flatten(tree, fallbackName = s"workspace-$workspaceId"))

      if (items.isEmpty) {
        logger.info(ConsoleColors.warning("No downloadable files found in this workspace"))
      } else if (dryRun) {
        logger.info(ConsoleColors.info(s"Dry run — ${items.size} file(s) would be written under $outDir"))
        items.take(20).foreach(i => logger.info(ConsoleColors.dim(s"  ${i.relativePath}")))
        if (items.size > 20) logger.info(ConsoleColors.dim(s"  … and ${items.size - 20} more"))
      } else {
        download(items)
      }
    }
  }

  private def download(items: List[WorkspaceDownloadItem]): Unit = {
    val progress = new ProgressTracker("Download workspace", items.size, Some(outDir))
    progress.start()

    val pool = Executors.newFixedThreadPool(concurrency)
    val succeeded = new AtomicInteger(0)
    val failed = new AtomicInteger(0)
    val sinceUpdate = new AtomicInteger(0)

    try {
      items.foreach { item =>
        pool.submit(new Runnable {
          override def run(): Unit = {
            val dest = outDir.resolve(item.relativePath)
            try {
              Option(dest.getParent).foreach(Files.createDirectories(_))
              val bytes = s3.downloadTo(item.blobUri, dest)
              succeeded.incrementAndGet()
              // Throttle progress output to roughly one line per 100 files
              if (sinceUpdate.incrementAndGet() % 100 == 0) progress.updateBatch(100, 0, bytes)
            } catch {
              case e: Exception =>
                failed.incrementAndGet()
                logger.warn(s"Failed to download ${item.blobUri} → ${item.relativePath}: ${e.getMessage}")
            }
          }
        })
      }

      pool.shutdown()
      pool.awaitTermination(7, TimeUnit.DAYS)
    } finally {
      if (!pool.isShutdown) pool.shutdownNow()
    }

    progress.updateBatch(0, failed.get(), 0)
    logger.info(ConsoleColors.dim(s"Wrote ${succeeded.get()} file(s) to $outDir"))
    progress.complete()
  }
}
