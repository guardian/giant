import React from "react";
import { searchResultsPropType } from "../../types/SearchResults";
import TimeHistogram from "../SearchResults/visualizations/TimeHistogram";
import PropTypes from "prop-types";

export default class SearchVisualizations extends React.Component {
  static propTypes = {
    results: searchResultsPropType,
    updateSearchText: PropTypes.func,
    q: PropTypes.string,
  };

  render() {
    if (this.props.results) {
      return (
        <TimeHistogram
          results={this.props.results}
          updateSearchText={this.props.updateSearchText}
          q={this.props.q}
        />
      );
    } else {
      return false;
    }
  }
}
