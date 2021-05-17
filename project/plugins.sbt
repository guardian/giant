// The Typesafe repository
resolvers += "Typesafe repository" at "https://repo.typesafe.com/typesafe/releases/"
resolvers += "JBoss" at "https://repository.jboss.org" // needed for the scrooge-sbt-plugin due to broken jboss deps

libraryDependencies += "org.vafer" % "jdeb" % "1.6" artifacts (Artifact("jdeb", "jar", "jar"))

addSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.8.2")

addSbtPlugin("io.get-coursier" % "sbt-coursier" % "1.1.0-M7")

addSbtPlugin("com.twitter" % "scrooge-sbt-plugin" % "18.4.0")

addSbtPlugin("com.gu" % "sbt-riffraff-artifact" % "1.1.9")

addSbtPlugin("com.eed3si9n" % "sbt-buildinfo" % "0.9.0")
