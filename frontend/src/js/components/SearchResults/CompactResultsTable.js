import React from "react";
import PropTypes from "prop-types";
import { searchResultsPropType } from "../../types/SearchResults";
import EmailIcon from "react-icons/lib/md/email";
import AttachmentIcon from "react-icons/lib/md/attach-file";
import DocumentIcon from "react-icons/lib/ti/document";
import hdate from "human-date";
import * as R from "ramda";
import md5 from "md5";
import { SearchLink } from "../UtilComponents/SearchLink";
import filesize from "filesize";

export default class CompactResultsTable extends React.Component {
  static propTypes = {
    lastUri: PropTypes.string,
    searchResults: searchResultsPropType,
  };

  renderAttachmentCount(result) {
    switch (result.details._type) {
      case "email": {
        const count = result.details.attachmentCount;
        if (count) {
          return (
            <div className="search-result__attachment-count">
              <AttachmentIcon />
              {count}
            </div>
          );
        } else {
          return false;
        }
      }
      default: {
        return <div></div>;
      }
    }
  }

  renderIcon(result) {
    switch (result.details._type) {
      case "email": {
        return (
          <EmailIcon className="search-result__icon-email search-result__icon--small" />
        );
      }
      case "document": {
        return (
          <DocumentIcon className="search-result__icon-document search-result__icon--small" />
        );
      }
      default: {
        return <div></div>;
      }
    }
  }

  getTitle(result) {
    switch (result.details._type) {
      case "email": {
        const subject = result.details.subject
          ? result.details.subject
          : "<No Subject>";
        return (
          <React.Fragment>
            <SearchLink
              className="search-result__link"
              to={`/viewer/${result.uri}`}
            >
              <h3 key={result.uri} className="search__compact-title">
                {subject}
              </h3>
            </SearchLink>
            <span className="search__compact-details">
              From: {result.details.from.email}
            </span>
          </React.Fragment>
        );
      }
      case "document": {
        const name = result.details.fileUris.map((uri) =>
          R.last(uri.split("/")),
        )[0];
        return (
          <React.Fragment>
            <SearchLink
              className="search-result__link"
              to={`/viewer/${result.uri}`}
            >
              <h3 key={md5(name)} className="search__compact-title">
                {name}
              </h3>
            </SearchLink>
            <span className="search__compact-details">
              Size: {filesize(result.details.fileSize)}
            </span>
          </React.Fragment>
        );
      }
      default: {
        return false;
      }
    }
  }

  renderResultRow = (result, index, lastUri) => {
    const createdAt = result.createdAt
      ? hdate.prettyPrint(new Date(result.createdAt), { showTime: true })
      : "Unknown date";
    const isLastUri = lastUri === result.uri;
    const targetId = isLastUri ? "jump-to-result" : "";

    return (
      <tr
        key={result.uri}
        id={targetId}
        className={isLastUri ? "search-result__info--last-result" : ""}
      >
        <td className="search__compact-icon-cell">{this.renderIcon(result)}</td>
        <td className="search__compact-attachment-count-cell">
          {this.renderAttachmentCount(result)}
        </td>
        <td className="search__compact-title-cell">{this.getTitle(result)}</td>
        <td align="right" className="search__compact-created-at-cell">
          {createdAt}
        </td>
      </tr>
    );
  };

  render() {
    return (
      <table className="search__compact-table">
        <colgroup>
          <col className="search__compact-icon-col" />
          <col className="search__compact-attachment-count-col" />
          <col />
          <col className="search__compact-date-col" />
        </colgroup>
        <tbody>
          {this.props.searchResults.results.map((result, index) =>
            this.renderResultRow(result, index, this.props.lastUri),
          )}
        </tbody>
      </table>
    );
  }
}
