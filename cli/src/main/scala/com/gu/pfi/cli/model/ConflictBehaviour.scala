package com.gu.pfi.cli.model

trait ConflictBehaviour {
  def name: String
}
case object Delete extends ConflictBehaviour {
  val name = "delete"
}
case object Skip extends ConflictBehaviour {
  val name = "skip"
}
case object Stop extends ConflictBehaviour {
  val name = "stop"
}
