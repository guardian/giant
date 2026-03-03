import React from "react";
import PropTypes from "prop-types";
import EmailIcon from "react-icons/lib/md/email";
import * as R from "ramda";
import md5 from "md5";
import { Link } from "react-router-dom";

import { SearchLink } from "../UtilComponents/SearchLink";
import { formatDate } from "../../util/formatDate";
import { getDocumentIconInfo } from "../../util/fileTypeIcon";
import { HighlightedText } from "../UtilComponents/HighlightedText";
import { searchResultPropType } from "../../types/SearchResults";

export class SearchResult extends React.Component {
  static propTypes = {
    lastUri: PropTypes.string,
    searchResult: searchResultPropType,
    index: PropTypes.number.isRequired,
  };

  renderHighlight = (highlight, index) => {
    return (
      <div key={index} className="search-result__highlight">
        <span className="search-result__highlight-field">
          {highlight.display}:{" "}
        </span>
        <HighlightedText value={highlight.highlight} />
      </div>
    );
  };

  getTitle() {
    switch (this.props.searchResult.details._type) {
      case "email": {
        const subject = this.props.searchResult.details.subject;
        return (
          <h3
            key={this.props.searchResult.uri}
            className="search-result__title"
          >
            {subject ? subject : "<No Subject>"}
          </h3>
        );
      }
      case "document": {
        const names = this.props.searchResult.details.fileUris.map((uri) =>
          R.last(uri.split("/")),
        );
        return R.uniq(names).map((name) => {
          return (
            <h3 key={md5(name)} className="search-result__title">
              {name}
            </h3>
          );
        });
      }
      default: {
        return false;
      }
    }
  }

  renderIcon() {
    let linkParams = {};
    const fieldWithMostHighlights =
      this.props.searchResult.fieldWithMostHighlights;
    // The fieldWithMostHighlights might be, say, metadata.fileUris
    // or one of the many fields for which we don't have an separate view
    // (generally these are metadata that appear in the sidebar)
    if (
      fieldWithMostHighlights &&
      (fieldWithMostHighlights === "text" ||
        fieldWithMostHighlights.startsWith("ocr") ||
        fieldWithMostHighlights.startsWith("transcript") ||
        fieldWithMostHighlights.startsWith("vttTranscript"))
    ) {
      linkParams = { view: fieldWithMostHighlights };
    }

    switch (this.props.searchResult.details._type) {
      case "email": {
        return (
          <React.Fragment>
            <div>
              <EmailIcon className="search-result__icon-email" />
            </div>
            <div>
              <SearchLink
                className="search-result__link"
                to={`/viewer/${this.props.searchResult.uri}`}
                params={linkParams}
              >
                {this.getTitle()}
              </SearchLink>
            </div>
          </React.Fragment>
        );
      }
      case "document": {
        const { icon: DocIcon, className: iconClass } = getDocumentIconInfo(
          this.props.searchResult.details.mimeTypes
        );
        return (
          <React.Fragment>
            <div>
              <DocIcon className={iconClass} />
            </div>
            <div>
              <SearchLink
                className="search-result__link"
                to={`/viewer/${this.props.searchResult.uri}`}
                params={linkParams}
              >
                {this.getTitle()}
              </SearchLink>
            </div>
          </React.Fragment>
        );
      }
      default: {
        return (
          <span className="search-result__type">{"Unknown Resource Type"}</span>
        );
      }
    }
  }

  renderProperty = (title, content) => {
    if (title && content !== undefined && content !== null) {
      return (
        <div className="search-result__detail-row">
          <span className="search-result__detail-label">{title}:</span>{" "}
          <span className="search-result__detail-value">{content}</span>
        </div>
      );
    }
  };

  renderCollections() {
    const collections = this.props.searchResult.collections;
    if (!collections || collections.length === 0) return null;

    const links = collections.map((collection, i) => (
      <React.Fragment key={collection}>
        {i > 0 && ", "}
        <Link className="search-result__detail-link" to={`/collections/${encodeURIComponent(collection)}`}>
          {collection}
        </Link>
      </React.Fragment>
    ));

    return this.renderProperty("Dataset", <React.Fragment>{links}</React.Fragment>);
  }

  renderAdditionalInfo() {
    switch (this.props.searchResult.details._type) {
      case "email": {
        const sentAt = this.props.searchResult.details.sentAt
          ? formatDate(new Date(this.props.searchResult.details.sentAt))
          : undefined;
        return (
          <React.Fragment>
            {this.renderProperty(
              "From",
              this.props.searchResult.details.from.email,
            )}
            {sentAt ? this.renderProperty("Sent", sentAt) : false}
          </React.Fragment>
        );
      }
      case "document": {
        const displayTypes = this.props.searchResult.details.displayMimeTypes;
        const types = displayTypes && displayTypes.length > 0
          ? displayTypes
          : this.props.searchResult.details.mimeTypes;
        return this.renderProperty(
          "File type",
          types.join(", "),
        );
      }
      default: {
        return false;
      }
    }
  }

  render() {
    const isLastResult = this.props.lastUri === this.props.searchResult.uri;
    const targetId = isLastResult ? "jump-to-result" : "";
    const createdAt = this.props.searchResult.createdAt
      ? formatDate(new Date(this.props.searchResult.createdAt))
      : undefined;

    return (
      <div id={targetId} className="search-result">
        <div className="search-result__info">
          <div
            className={
              isLastResult ? "search-result__info--last-result-overlay" : ""
            }
          />

          <div className="search-result__summary">{this.renderIcon()}</div>

          <div className="search-result__metadata">
            {createdAt ? this.renderProperty("Created", createdAt) : false}
            {this.renderAdditionalInfo()}
            {this.renderCollections()}
          </div>
        </div>

        <div className="search-result__content">
          {this.props.searchResult.highlights.length ? (
            this.props.searchResult.highlights.map(this.renderHighlight)
          ) : (
            <p className="centered">
              No highlights found for the current search term
            </p>
          )}
        </div>
      </div>
    );
  }
}
