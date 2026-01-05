import { getCurrentHighlight, getTotalHighlights } from "../util/resourceUtils";
import React from "react";
import { GiantState } from "../types/redux/GiantState";
import { connect } from "react-redux";

type Props = ReturnType<typeof mapStateToProps>;

function GiantEuiSearchResultCount({
  resource,
  currentQuery,
  highlights,
}: Props) {
  let currentHighlight, totalHighlights;
  if (highlights && currentQuery && resource) {
    currentHighlight = getCurrentHighlight(
      highlights,
      resource,
      currentQuery.q,
    );
    totalHighlights = getTotalHighlights(resource);
  }

  if (
    totalHighlights &&
    totalHighlights > 0 &&
    currentHighlight !== undefined
  ) {
    return (
      <span>
        {currentHighlight + 1} of {totalHighlights}
      </span>
    );
  }

  return null;
}

function mapStateToProps(state: GiantState) {
  return {
    resource: state.resource,
    currentQuery: state.search.currentQuery,
    highlights: state.highlights,
  };
}

export default connect(mapStateToProps)(GiantEuiSearchResultCount);
