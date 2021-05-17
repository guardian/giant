package utils

object Chart {
  /**
    * Distribute things across a number of rows in the best way they can fit.
    * @param thingsToDistribute List of things to distribute over a number of rows
    * @param fitInOrder A function that returns true iff the second thing will fit after the first thing on the same row
    * @return Iterable of thing -> row tuples
    */
  def distribute[A](thingsToDistribute: Iterable[A])(fitInOrder: (A, A) => Boolean): Iterable[(A, Int)] = {
    thingsToDistribute.foldLeft[(Vector[(A, Int)],Vector[A])](Vector.empty, Vector.empty) { case ((acc, rows), thing) =>
      val fitRow = rows.indexWhere(fitInOrder(_, thing))
      val (newRows, allocation) =
        if (fitRow < 0)
          (rows :+ thing) -> rows.length
        else
          rows.updated(fitRow, thing) -> fitRow
      (acc :+ (thing -> allocation)) -> newRows
    }._1
  }
}
