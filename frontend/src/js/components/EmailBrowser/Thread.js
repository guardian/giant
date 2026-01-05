import React from "react";
import PropTypes from "prop-types";
import buildLink from "../../util/buildLink";
import history from "../../util/history";

import { match } from "../../types/Match";
import { emailThreadPropType } from "../../types/Email";
import _ from "lodash";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import * as getEmailThread from "../../actions/email/getEmailThread";
import Timeline from "./Timeline";

class Thread extends React.Component {
  static propTypes = {
    emails: PropTypes.shape({
      timeline: emailThreadPropType,
    }),
    emailsActions: PropTypes.shape({
      getEmailThread: PropTypes.func.isRequired,
    }),
    match: match.isRequired,
    urlParams: PropTypes.object,
  };

  uriInCurrentThread = (uri) =>
    this.props.emails.timeline.thread.some((t) => t.email.uri === uri);

  componentDidUpdateOrMount() {
    if (
      !this.props.emails ||
      !this.uriInCurrentThread(this.props.match.params.uri)
    ) {
      this.props.emailsActions.getEmailThread(this.props.match.params.uri);
    }
  }

  componentDidMount() {
    this.componentDidUpdateOrMount();
  }

  componentDidUpdate() {
    this.componentDidUpdateOrMount();
  }

  shouldComponentUpdate(newProps) {
    return (
      this.props.match.params.uri !== newProps.match.params.uri ||
      _.get(this.props, "emails.uri") !== _.get(newProps, "emails.uri")
    );
  }

  select = (uri) => {
    history.push(buildLink(uri, this.props.urlParams, {}));
  };

  render() {
    const emailThread = this.props.emails;

    if (emailThread) {
      return (
        <div className="app__main-content">
          <div className="app__section">
            <div>
              <Timeline
                data={emailThread.timeline}
                onSelect={this.select}
                selected={this.props.match.params.uri}
              />
            </div>
          </div>
        </div>
      );
    } else {
      return false;
    }
  }
}

function mapStateToProps(state) {
  return {
    urlParams: state.urlParams,
    emails: state.emails,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    emailsActions: bindActionCreators(
      Object.assign({}, getEmailThread),
      dispatch,
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Thread);
