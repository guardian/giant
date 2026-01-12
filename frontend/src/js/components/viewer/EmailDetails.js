import React from "react";
import PropTypes from "prop-types";
import hdate from "human-date";
import HoverSearchLink from "../UtilComponents/HoverSearchLink";
import { emailPropType } from "../../types/Email";
import Thread from "../EmailBrowser/Thread";
import { match } from "../../types/Match";

export class EmailDetails extends React.Component {
  static propTypes = {
    email: emailPropType,
    detailsType: PropTypes.string,
    setDetailsView: PropTypes.func.isRequired,
    match: match.isRequired,
  };

  renderRecipient(r, i) {
    if (!r || (!r.email && !r.displayName)) {
      return <div key={i}>&lt;Unknown&gt;</div>;
    }

    return (
      <div className="email__recipient" key={r.email + i}>
        {r.displayName ? <HoverSearchLink q={r.displayName} /> : false}
        {r.email ? (
          <span className="email__recipient-address">
            (<HoverSearchLink q={r.email} />)
          </span>
        ) : (
          false
        )}
      </div>
    );
  }

  renderSummary() {
    return (
      <React.Fragment>
        <div className="email__header-row">
          <h2>From:</h2>
          <h3 className="email__header-item">
            {this.renderRecipient(this.props.email.from)}
          </h3>
        </div>
        <div className="email__header-row">
          <h2>Sent:</h2>
          <h3 className="email__header-item">
            {this.props.email.sentAt
              ? hdate.prettyPrint(new Date(this.props.email.sentAt), {
                  showTime: true,
                })
              : "<Unknown>"}
          </h3>
        </div>
        <div className="email__header-row">
          <h2>Recipients:</h2>
          <h3 className="email__header-item email__header-item--inline">
            {this.props.email.recipients.map((r, i) =>
              this.renderRecipient(r, i),
            )}
          </h3>
        </div>
        <div className="email__header-row">
          <h2>Subject:</h2>
          <h3 className="email__header-item">{this.props.email.subject}</h3>
        </div>
      </React.Fragment>
    );
  }

  renderThread() {
    return <Thread match={this.props.match} />;
  }

  renderDetails() {
    switch (this.props.detailsType) {
      case "hide":
        return false;
      case "thread":
        return this.renderThread();
      default:
        return this.renderSummary();
    }
  }

  render() {
    const current = this.props.detailsType ? this.props.detailsType : "summary";

    return (
      <div className="email__header">
        <div className="btn-tab-group">
          <DetailsLink
            current={current}
            to="Summary"
            navigate={this.props.setDetailsView}
          />
          <DetailsLink
            current={current}
            to="Thread"
            navigate={this.props.setDetailsView}
          />
        </div>
        {this.renderDetails()}
      </div>
    );
  }
}

function DetailsLink({ to, navigate }) {
  const onClick = (e) => {
    e.preventDefault();
    navigate(to.toLowerCase());
  };

  return (
    <button className="btn btn--tab" onClick={onClick}>
      {to}
    </button>
  );
}

DetailsLink.propTypes = {
  current: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
  navigate: PropTypes.func.isRequired,
};
