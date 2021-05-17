package model.frontend

// Try to ensure we maintain consistency for end-points that support paging
trait Paging[T] {
  val hits: Long
  val page: Long
  val pageSize: Long
  val results: List[T]
}
