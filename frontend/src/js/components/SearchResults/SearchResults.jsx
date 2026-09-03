import React from "react";
import PropTypes from "prop-types";
import { SearchResult } from "./SearchResult";
import { searchResultsPropType } from "../../types/SearchResults";
import CompactResultsTable from "./CompactResultsTable";

export default class SearchResults extends React.Component {
  static propTypes = {
    lastUri: PropTypes.string,
    searchResults: searchResultsPropType,
    isSearchInProgress: PropTypes.bool.isRequired,
    compact: PropTypes.bool.isRequired,
    preferences: PropTypes.object,
  };

  shouldComponentUpdate(newProps) {
    return (
      this.props.isSearchInProgress !== newProps.isSearchInProgress ||
      this.props.compact !== newProps.compact
    );
  }

  UNSAFE_componentWillUpdate(newProps) {
    if (this.props.searchResults !== newProps.searchResults && this.wrapper) {
      this.wrapper.scrollTop = 0;
    }
  }

  componentDidMount() {
    const previousResult = document.getElementById("jump-to-result");
    if (previousResult) {
      try {
        previousResult.scrollIntoView({
          behaviour: "smooth",
          block: "center",
        });
      } catch (e) {
        // Support for editorial version of firefox
        previousResult.scrollIntoView({
          behaviour: "smooth",
          block: "start",
        });
      }
    }
  }

  render() {
    if (this.props.searchResults) {
      const hasHistogram =
        this.props.searchResults.aggs.length > 0 &&
        this.props.searchResults.aggs.find((a) => a.key === "createdAt").buckets
          .length > 0;

      let resultsClass;
      if (this.props.isSearchInProgress) {
        resultsClass = "search-results search-results--grayed";
      } else if (hasHistogram) {
        resultsClass = "search-results";
      } else {
        resultsClass = "search-results-no-histogram";
      }

      if (!this.props.searchResults.hits) {
        return (
          <p className="search-results__message search-results__message--error">
            No matching documents found
          </p>
        );
      }

      if (this.props.compact) {
        return (
          <div
            ref={(div) => {
              this.wrapper = div;
            }}
            className={resultsClass}
          >
            <CompactResultsTable
              lastUri={this.props.lastUri}
              searchResults={this.props.searchResults}
            />
          </div>
        );
      } else {
        return (
          <div
            ref={(div) => {
              this.wrapper = div;
            }}
            className={resultsClass}
          >
            {this.props.searchResults.results.map((result, index) => (
              <SearchResult
                key={result.uri}
                lastUri={this.props.lastUri}
                index={index}
                searchResult={result}
              />
            ))}
          </div>
        );
      }
    } else {
      return (
        <p className="search-results__message center-text">
          Search tip: type + or - to add filters
        </p>
      );
    }
  }
}
