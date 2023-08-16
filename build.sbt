name := "giant"
description := "Tool for journalists to search, analyse and categorise unstructured data, often during an investigation"
version := "0.1.0"

ThisBuild / scalaVersion := "2.13.9"

import com.gu.riffraff.artifact.BuildInfo
import play.sbt.PlayImport.PlayKeys._
import com.typesafe.sbt.packager.MappingsHelper._

val compilerFlags = Seq(
  "-unchecked",
  "-deprecation",
  "-feature",
  "-Xfatal-warnings"
)

val awsVersion = "1.12.428"
val log4jVersion = "2.20.0"
val slf4jVersion = "2.0.7"
// To match what the main app gets from scalatestplus-play transitively
val scalatestVersion = "3.1.1"

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
        .replace("\"", "").trim
    )
  },

  buildInfoOptions ++= Seq(
    BuildInfoOption.ToJson,
    BuildInfoOption.ToMap
  ),
  buildInfoPackage := "utils.buildinfo",
)

lazy val riffRaffUploadWithIntegrationTests = taskKey[Unit]("Perform riffRaffUpload after running tests or integration tests")

lazy val root = (project in file("."))
  .enablePlugins(RiffRaffArtifact)
  .aggregate(common, backend, cli)
  .settings(
    riffRaffUploadWithIntegrationTests := Def.sequential(
      common / Test / test,
      cli / Test / test,
      backend / Test / test,
      backend / IntTest / test,
      riffRaffUpload
    ).value,
    riffRaffManifestProjectName := s"investigations::${sys.props.getOrElse("PFI_STACK", "pfi-playground")}",
    riffRaffUploadArtifactBucket := Some("riffraff-artifact"),
    riffRaffUploadManifestBucket := Some("riffraff-builds"),
    riffRaffArtifactResources := Seq(
      (backend / Debian / packageBin).value -> s"${(backend / name).value}/${(backend / name).value}.deb",
      (cli / Debian / packageBin).value -> s"${(cli / name).value}/${(cli / name).value}.deb",
      (cli / Universal / packageZipTarball).value -> s"pfi-public-downloads/${(cli / name).value}.tar.gz",
      file("riff-raff.yaml") -> "riff-raff.yaml"
    )
  )

lazy val common = (project in file("common"))
  .settings(
    name := "common",
    scalacOptions := compilerFlags,
    libraryDependencies ++= Seq(
      "org.typelevel" %% "cats-core" % "2.2.0",
      "com.typesafe.play" %% "play-json" % "2.9.4",
      "com.amazonaws" % "aws-java-sdk-s3" % awsVersion,
      "org.scalatest" %% "scalatest" % scalatestVersion,
      // Play has a transitive dependency on Logback,
      // but we specify one here to ensure that Play uses compatible
      // versions of SLF4J and Logback (i.e. its versions should be evicted by those here).
      // https://github.com/playframework/playframework/issues/11499#issuecomment-1285654119
      "org.slf4j" % "slf4j-api" % slf4jVersion,
      "ch.qos.logback" % "logback-classic" % "1.4.6",
    )
  )

import play.sbt.routes.RoutesKeys

lazy val backend = (project in file("backend"))
  .enablePlugins(PlayScala, JDebPackaging, SystemdPlugin, BuildInfoPlugin)
  .dependsOn(common)
  .configs(IntTest)
  .settings(buildInfoSettings)
  .settings(
    name := "pfi",
    scalacOptions := compilerFlags,

    libraryDependencies ++= Seq(
      ws,
      "commons-codec" % "commons-codec" % "1.11",
      "org.bouncycastle" % "bcprov-jdk15on" % "1.70",
      // required by tikka, used to be part of bcprov-jdk15on, pulled out into a separate library from 1.69 onwards
      // see https://github.com/guardian/giant/pull/92 for details - may be removable if it gets added as an explicit
      // dependency to tikka or another library
      "org.bouncycastle" % "bcutil-jdk15on" % "1.70",
      "commons-io" % "commons-io" % "2.6",
      "com.sksamuel.elastic4s" %% "elastic4s-client-esjava" % "7.9.1",
      "org.elasticsearch.client" % "elasticsearch-rest-client-sniffer" % "7.9.2",
      "org.apache.pekko" %% "pekko-cluster-typed" % "1.0.1", // Pekko should be compatible with akka 2.6. Needs to match akka version in Play
      "org.neo4j.driver" % "neo4j-java-driver" % "1.6.3",
      "com.pff" % "java-libpst" % "0.9.3",
      // NOTE: When you update tika you need to check if there are any updates required to be made to the
      // conf/org/apache/tika/mimecustom-mimetypes.xml file
      // (Seems to be OK as of 2.7.0: https://tika.apache.org/2.7.0/parser_guide.html)
      "org.apache.tika" % "tika-parsers-standard-package" % "2.7.0",
      "org.apache.tika" % "tika-core" % "2.7.0",
      "org.apache.logging.log4j" % "log4j-to-slf4j" % log4jVersion,
      "org.apache.logging.log4j" % "log4j-api" % log4jVersion,
      "org.apache.logging.log4j" % "log4j-core" % log4jVersion,
      "net.logstash.logback" % "logstash-logback-encoder" % "6.3",
      "com.pauldijou" %% "jwt-play" % "5.0.0",
      "com.amazonaws" % "aws-java-sdk-ec2" % awsVersion,
      "com.amazonaws" % "aws-java-sdk-ssm" % awsVersion,
      "com.amazonaws" % "aws-java-sdk-autoscaling" % awsVersion,
      "com.amazonaws" % "aws-java-sdk-cloudwatch" % awsVersion,
      "com.amazonaws" % "aws-java-sdk-cloudwatchmetrics" % awsVersion,
      "com.beachape" %% "enumeratum-play" % "1.7.2",
      "com.iheart" %% "ficus" % "1.5.2",
      "com.sun.mail" % "javax.mail" % "1.6.2",
      "org.jsoup" % "jsoup" % "1.14.2",
      "com.gu" %% "pan-domain-auth-verification" % "1.2.0",
      "com.amazonaws" % "aws-java-sdk-secretsmanager" % "1.12.528",

      // this is needed to override the 2.11.4 version of jackson-module used in various play libraries (including jwt-play)
      // as 2.11.4 is only compatible with versions of jackson databind up to 2.12.0 - and we're using 2.12.7 (Phil thinks
      // because of the version of tikka-parsers we're using)
      "com.fasterxml.jackson.module" % "jackson-module-scala_2.13" % "2.14.2",

      // Libraries whose use are potentially contentious

      // These dependencies allow PDF box to read images (which is critical for PdfOcrExtractor)
      "org.apache.pdfbox" % "jbig2-imageio" % "3.0.2",
      // The license for jpeg2000 below is unusual and would need review (or removal) before any open sourcing effort
      "com.github.jai-imageio" % "jai-imageio-jpeg2000" % "1.3.0",
      // Subject to the mad unRAR restriction so again should be reviewed before any open sourcing
      // The latest code is here: https://github.com/junrar/junrar (not in the older repository that appears first in Google)
      "com.github.junrar" % "junrar" % "7.4.1",

      // postgres
      "org.scalikejdbc" %% "scalikejdbc"       % "3.5.0",
      "org.postgresql"  %  "postgresql"        % "42.2.5",

      // Test dependencies

      "org.scalacheck" %% "scalacheck" % "1.14.0" % Test,
      "org.scalatestplus.play" %% "scalatestplus-play" % "5.1.0" % Test,
      "com.whisk" %% "docker-testkit-scalatest" % "0.9.9" % Test,
      "com.whisk" %% "docker-testkit-impl-spotify" % "0.9.9" % Test,
      "org.scalamock" %% "scalamock" % "4.4.0" % Test
    ),

    // set up separate tests and integration tests - http://www.scala-sbt.org/0.13.1/docs/Detailed-Topics/Testing.html#custom-test-configuration
    inConfig(IntTest)(Defaults.testTasks),
    Test / testOptions := Seq(Tests.Filter(name => !itFilter(name))),
    IntTest / testOptions  := Seq(Tests.Filter(itFilter)),

    RoutesKeys.routesImport += "utils.Binders._",
    playDefaultPort := port,

    debianPackageDependencies := Seq("java-11-amazon-corretto-jdk"),
    Linux / maintainer  := "Guardian Developers <dig.dev.software@theguardian.com>",
    Linux / packageSummary  := description.value,
    packageDescription := description.value,

    Universal / mappings ~= { _.filterNot { case (_, fileName) => fileName == "conf/site.conf" }},

    Universal / javaOptions ++= Seq(
      "-Dpidfile.path=/dev/null",
      "-Dcom.amazonaws.sdk.enableDefaultMetrics=cloudwatchRegion=eu-west-1",
      "-J-XX:MaxRAMFraction=2",
      "-J-XX:InitialRAMFraction=2",
      "-J-XX:MaxMetaspaceSize=500m",
      "-J-XX:+UseConcMarkSweepGC",
      "-J-Xlog:gc*",
      "-J-XX:+HeapDumpOnOutOfMemoryError",
      s"-J-Xloggc:/var/log/${name.value}/gc.log",
      s"-J-Dhttp.port=$port"
    )
  )

lazy val cli = (project in file("cli"))
  .dependsOn(common)
  .enablePlugins(JavaAppPackaging, BuildInfoPlugin)
  .settings(buildInfoSettings)
  .settings(
    name := "pfi-cli",
    scalacOptions := compilerFlags,
    libraryDependencies ++= Seq(
      "org.rogach" %% "scallop" % "3.5.1",
      "com.beachape" %% "enumeratum" % "1.5.13",
      "com.squareup.okhttp3" % "okhttp" % "4.9.2",
      "com.amazonaws" % "aws-java-sdk-s3" % awsVersion,
      "com.auth0" % "java-jwt" % "3.3.0",
      "org.slf4j" % "jcl-over-slf4j" % slf4jVersion,
      "com.google.guava" % "guava" % "28.2-jre",
      "org.scalatest" %% "scalatest" % scalatestVersion
    ),
    run / fork := true,
    run / connectInput := true,

    Universal / mappings +=
      ((Compile / resourceDirectory).value / "logback.xml") -> "conf/logback.xml",

    bashScriptExtraDefines +=
      """addJava "-Dlogback.configurationFile=${app_home}/../conf/logback.xml""""
  )
