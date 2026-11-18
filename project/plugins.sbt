
libraryDependencies += "org.vafer" % "jdeb" % "1.15" artifacts (Artifact("jdeb", "jar", "jar"))

addSbtPlugin("org.playframework" % "sbt-plugin" % "3.0.12")

addSbtPlugin("com.gu" % "sbt-riffraff-artifact" % "1.1.18")

addSbtPlugin("com.eed3si9n" % "sbt-buildinfo" % "0.11.0")

addSbtPlugin("com.github.sbt" % "sbt-native-packager" % "1.13.0")

// Used by the transcription worker interface schema fetcher and generator
libraryDependencies += "org.playframework" %% "play-json" % "3.0.6"

// The meta-build resolves separately from build.sbt; keep its Jackson pins aligned too.
val jacksonVersion = "2.23.0"
dependencyOverrides ++= Seq(
  "com.fasterxml.jackson.core" % "jackson-annotations" % "2.23",
  "com.fasterxml.jackson.core" % "jackson-core" % jacksonVersion,
  "com.fasterxml.jackson.core" % "jackson-databind" % jacksonVersion,
  "com.fasterxml.jackson.dataformat" % "jackson-dataformat-cbor" % jacksonVersion,
  "com.fasterxml.jackson.datatype" % "jackson-datatype-jdk8" % jacksonVersion,
  "com.fasterxml.jackson.datatype" % "jackson-datatype-jsr310" % jacksonVersion
)
