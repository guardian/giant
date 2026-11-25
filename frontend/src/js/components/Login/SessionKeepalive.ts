import React from "react";
import PropTypes from "prop-types";
import { token } from "../../types/Token";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import { sessionKeepalive } from "../../actions/auth/sessionKeepalive";

import { GiantDispatch } from "../../types/redux/GiantDispatch";
import { GiantState } from "../../types/redux/GiantState";

type Props = ReturnType<typeof mapStateToProps> &
  ReturnType<typeof mapDispatchToProps>;

type State = {
  keepaliveIntervalHandle?: number;
};

class SessionKeepalive extends React.Component<Props, State> {
  static propTypes = {
    token: token,
    sessionKeepalive: PropTypes.func.isRequired,
  };

  state: State = {
    keepaliveIntervalHandle: undefined,
  };

  componentDidMount() {
    this.startInterval();
  }

  componentWillUnmount() {
    this.stopInterval();
  }

  startInterval() {
    // ensure there isn't currently an interval timer running
    this.stopInterval();
    if (!this.props.token) return;

    // start new interval timer using a period that is half the validity time of the token
    const tokenValidityDuration =
      this.props.token.exp * 1000 - this.props.token.refreshedAt;
    const keepaliveInterval = Math.floor(tokenValidityDuration / 2);
    const intervalHandle = window.setInterval(
      this.sessionKeepalive,
      keepaliveInterval,
    );
    this.setState({ keepaliveIntervalHandle: intervalHandle });
  }

  stopInterval() {
    if (this.state.keepaliveIntervalHandle) {
      clearInterval(this.state.keepaliveIntervalHandle);
      this.setState({ keepaliveIntervalHandle: undefined });
    }
  }

  sessionKeepalive = () => {
    this.props.sessionKeepalive();
  };

  render() {
    return false;
  }
}

function mapStateToProps(state: GiantState) {
  const { token } = state.auth;

  return {
    token,
  };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    sessionKeepalive: bindActionCreators(sessionKeepalive, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps, null, {
  forwardRef: true,
})(SessionKeepalive);
