import React from "react";
import PropTypes from "prop-types";
import { searchResultsPropType } from "../../types/SearchResults";

export default class SearchStatus extends React.Component {
  static propTypes = {
    currentQuery: PropTypes.object,
    results: searchResultsPropType,
    searchFailed: PropTypes.bool,
  };

  render() {
    if (this.props.searchFailed) {
      return (
        <div className="search__status">Search failed, check your query</div>
      );
    }

    if (this.props.results) {
      const { page, pages, hits } = this.props.results;
      const took = this.props.results.took / 1000.0;
      return (
        <div className="search__status">
          {`Page ${page} of ${pages} (${hits} ${hits === 1 ? "hit" : "hits"}, took ${took.toFixed(3)} seconds)`}
        </div>
      );
    }

    return <div></div>;
  }
}
