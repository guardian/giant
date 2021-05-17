package com.gu.pfi.cli.service

import com.gu.pfi.cli.{CommonOptions, Options}
import com.gu.pfi.cli.credentials.CliCredentialsStore
import okhttp3.OkHttpClient
import services.FingerprintServices

import scala.concurrent.ExecutionContext

class CliServices(
  val http: CliHttpClient,
  val ingestion: CliIngestionService,
  val users: CliUsers,
  val veracrypt: CliVeracrypt
)

object CliServices {
  def apply(config: CommonOptions)(implicit ec: ExecutionContext): CliServices = {
    val okHttpClient = new OkHttpClient()
    val credentialsStore = new CliCredentialsStore()
    val httpClient = new CliHttpClient(okHttpClient, credentialsStore, config.uri.getOrElse("http://localhost:9001"))

    val ingestions = new CliIngestionService(httpClient)
    val users = new CliUsers(httpClient)
    val veracrypt = new CliVeracrypt()

    new CliServices(httpClient, ingestions, users, veracrypt)
  }
}
