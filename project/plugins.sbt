
libraryDependencies += "org.vafer" % "jdeb" % "1.15" artifacts (Artifact("jdeb", "jar", "jar"))

addSbtPlugin("org.playframework" % "sbt-plugin" % "3.0.12")

addSbtPlugin("com.gu" % "sbt-riffraff-artifact" % "1.1.18")

addSbtPlugin("com.eed3si9n" % "sbt-buildinfo" % "0.11.0")

addSbtPlugin("com.github.sbt" % "sbt-native-packager" % "1.13.0")

// Used by the transcription worker interface schema fetcher and generator
libraryDependencies += "org.playframework" %% "play-json" % "3.0.6"
