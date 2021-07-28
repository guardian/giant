package services.previewing

import java.io.InputStream
import java.nio.file.{Files, Path}
import java.util.UUID
import java.util.concurrent.Executors

import utils.Logging
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext
import scala.sys.process.{Process, ProcessLogger}

abstract class PreviewGenerator(workspace: Path, temporaryFileExtension: String = "tmp") extends Logging with ProcessLogger {
  private val threadPool = Executors.newFixedThreadPool(1)
  private implicit val execContext: ExecutionContext = ExecutionContext.fromExecutor(threadPool)

  def transform(input: InputStream): InputStream = input
  def buildCommand(workspace: String, input: String, output: String): Seq[String]

  def generate(data: InputStream): Attempt[Path] = Attempt.catchNonFatalBlasé {
    val filename = s"pfi-preview.${UUID.randomUUID().toString}"

    val input = workspace.resolve(s"$filename.$temporaryFileExtension")
    val output = workspace.resolve(s"$filename.pdf")

    val command = buildCommand(workspace.toAbsolutePath.toString, input.toAbsolutePath.toString, output.toAbsolutePath.toString)
    val env = Map("HOME" -> workspace.toAbsolutePath.toString)

    try {
      val transformed = transform(data)
      Files.copy(transformed, input)

      val proc = Process(command, cwd = Some(workspace.toAbsolutePath.toFile), extraEnv = env.toSeq: _*)

      proc.run(this).exitValue() match {
        case 0 => output
        case other => throw new IllegalStateException(s"Failed to generate preview. Code $other")
      }
    } finally {
      data.close()
      Files.delete(input)
    }
  }

  // Redirect stdout and stderr from to the Java log file
  override def out(s: => String): Unit = logger.info(s)
  override def err(s: => String): Unit = logger.warn(s)
  override def buffer[T](f: => T): T = f
}