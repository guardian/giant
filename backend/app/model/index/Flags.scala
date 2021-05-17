package model.index

object Flags {
  val unseen = "unseen"
  val seen = "seen"
  val up = "up"
  val down = "down"

  val all = List(unseen, seen, up, down)

  val toDisplay: PartialFunction[String, String] = {
    case `unseen` => "Unseen"
    case `seen` => "Seen"
    case `up` => "Important"
    case `down` => "Unimportant"
  }
}
