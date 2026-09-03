import React from "react";
import PropTypes from "prop-types";

export default class PageNavigator extends React.Component {
  static propTypes = {
    currentPage: PropTypes.number.isRequired,
    pageSelectCallback: PropTypes.func.isRequired,
    pageSpan: PropTypes.number.isRequired,
    lastPage: PropTypes.number.isRequired,
  };

  renderPageButton(number) {
    if (number === this.props.currentPage) {
      return (
        <span
          key={"page_" + number}
          className="page-navigator__page page-navigator__page--selected"
        >
          {number}
        </span>
      );
    }
    return (
      <button
        key={"page_" + number}
        className="btn-link page-navigator__page"
        onClick={() => this.props.pageSelectCallback(number)}
      >
        {number}
      </button>
    );
  }

  renderStartElipsis(firstDisplayedPage, lastPage) {
    if (firstDisplayedPage > 2 && firstDisplayedPage < lastPage) {
      return <span>...</span>;
    }
    return false;
  }

  renderEndElipsis(lastDisplayedPage, lastPage) {
    if (lastDisplayedPage < lastPage - 1) {
      return <span> ... </span>;
    }
    return false;
  }

  renderPageSpan(firstDisplayedPage, lastDisplayedPage) {
    let spans = [];
    for (var i = firstDisplayedPage; i <= lastDisplayedPage; i++) {
      spans.push(this.renderPageButton(i));
    }
    return spans;
  }

  render() {
    const firstDisplayedPage = Math.max(
      2,
      this.props.currentPage - this.props.pageSpan,
    );
    const lastDisplayedPage = Math.min(
      this.props.lastPage - 1,
      firstDisplayedPage + this.props.pageSpan * 2,
    );

    return (
      <div className="page-navigator">
        {this.renderPageButton(1)}

        {this.renderStartElipsis(firstDisplayedPage, this.props.lastPage)}

        {this.renderPageSpan(firstDisplayedPage, lastDisplayedPage)}

        {this.renderEndElipsis(lastDisplayedPage, this.props.lastPage)}

        {this.renderPageButton(this.props.lastPage)}
      </div>
    );
  }
}
