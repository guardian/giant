import PropTypes from "prop-types";
import { BasicResource } from "./Resource";

export interface ExtractionFailureSummary {
  extractorName: string;
  stackTrace: string;
  numberOfBlobs: number;
}

// case class ResourcesForExtractionFailure(hits: Long, page: Long, pageSize: Long, results: List[BasicResource]) extends Paging[Resource]
export interface ResourcesForExtractionFailure {
  hits: number;
  page: number;
  pageSize: number;
  results: BasicResource[];
}

export interface ExtractionFailures {
  results: ExtractionFailureSummary[];
}
