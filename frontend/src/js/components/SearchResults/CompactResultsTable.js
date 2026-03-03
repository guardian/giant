import React from "react";
import PropTypes from "prop-types";
import { searchResultsPropType } from "../../types/SearchResults";
import EmailIcon from "react-icons/lib/md/email";
import AttachmentIcon from "react-icons/lib/md/attach-file";
import * as R from "ramda";
import md5 from "md5";
import { SearchLink } from "../UtilComponents/SearchLink";
import { Link } from "react-router-dom";
import { formatDate } from "../../util/formatDate";
import { getDocumentIconInfo } from "../../util/fileTypeIcon";
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
        const { icon: DocIcon, className: iconClass } = getDocumentIconInfo(
          result.details.mimeTypes,
        );
        return (
          <DocIcon className={`${iconClass} search-result__icon--small`} />
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
        const collections = result.collections || [];
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
              {result.details.recipients &&
                result.details.recipients.length > 0 &&
                (() => {
                  const toStr = result.details.recipients
                    .map((r) => r.displayName || r.email)
                    .join(", ");
                  const truncated =
                    toStr.length > 60 ? toStr.slice(0, 60) + "…" : toStr;
                  return " · To: " + truncated;
                })()}
              {collections.length > 0 && (
                <React.Fragment>
                  {" · "}
                  {collections.map((c, i) => (
                    <React.Fragment key={c}>
                      {i > 0 && ", "}
                      <Link
                        className="search-result__detail-link"
                        to={`/collections/${encodeURIComponent(c)}`}
                      >
                        {c}
                      </Link>
                    </React.Fragment>
                  ))}
                </React.Fragment>
              )}
            </span>
          </React.Fragment>
        );
      }
      case "document": {
        const name = result.details.fileUris.map((uri) =>
          R.last(uri.split("/")),
        )[0];
        const displayTypes = result.details.displayMimeTypes;
        const typeLabel =
          displayTypes && displayTypes.length > 0
            ? displayTypes.join(", ")
            : filesize(result.details.fileSize);
        const collections = result.collections || [];
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
              {typeLabel}
              {collections.length > 0 && (
                <React.Fragment>
                  {" · "}
                  {collections.map((c, i) => (
                    <React.Fragment key={c}>
                      {i > 0 && ", "}
                      <Link
                        className="search-result__detail-link"
                        to={`/collections/${encodeURIComponent(c)}`}
                      >
                        {c}
                      </Link>
                    </React.Fragment>
                  ))}
                </React.Fragment>
              )}
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
      ? formatDate(new Date(result.createdAt))
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
