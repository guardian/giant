package model.index

import services.index.WorkspaceSearchContextParams

trait SortBy
case object Relevance extends SortBy
case object SizeAsc extends SortBy
case object SizeDesc extends SortBy
case object CreatedAtAsc extends SortBy
case object CreatedAtDesc extends SortBy

case class SearchParameters(q: String,
                            mimeFilters: List[String],
                            ingestionFilters: List[String],
                            workspaceFilters: List[String],
                            start: Option[Long],
                            end: Option[Long],
                            page: Int,
                            pageSize: Int,
                            sortBy: SortBy,
                            workspaceContext: Option[WorkspaceSearchContextParams] = None
                           ) {
  def from: Int = (page - 1) * pageSize
  def size: Int = pageSize
}
