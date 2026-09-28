import { GiantState } from "../../types/redux/GiantState";
import { GiantDispatch } from "../../types/redux/GiantDispatch";
import React from "react";
import PropTypes from "prop-types";
import { MdWarning } from "react-icons/md";
import { MdError } from "react-icons/md";
import { MdClose } from "react-icons/md";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import * as problemsActions from "../../actions/problems";

export class ErrorBarUnconnected extends React.Component<
  ReturnType<typeof mapStateToProps> & ReturnType<typeof mapDispatchToProps>
> {
  static propTypes = {
    app: PropTypes.shape({
      config: PropTypes.shape({
        readOnly: PropTypes.bool.isRequired,
      }),
      errors: PropTypes.arrayOf(PropTypes.string).isRequired,
      warnings: PropTypes.arrayOf(PropTypes.string).isRequired,
    }),
    problemsActions: PropTypes.shape({
      clearError: PropTypes.func.isRequired,
      clearWarning: PropTypes.func.isRequired,
    }),
  };

  closeError = (i: number) => {
    this.props.problemsActions.clearError(i);
  };

  closeWarning = (i: number) => {
    this.props.problemsActions.clearWarning(i);
  };

  render() {
    return (
      <div className="error-bar">
        {this.props.app.errors.map((error, i) => {
          let message = error;

          if (this.props.app.config.readOnly) {
            message +=
              ". Giant is currently in read only mode which will cause modifications to fail";
          }

          return (
            <ProblemPopup
              key={`$error-${i}`}
              type="error"
              message={message}
              index={i}
              onClose={this.closeError}
            />
          );
        })}
        {this.props.app.warnings.map((warning, i) => (
          <ProblemPopup
            key={`$warning-${i}`}
            type="warning"
            message={warning}
            index={i}
            onClose={this.closeWarning}
          />
        ))}
      </div>
    );
  }
}

class ProblemPopup extends React.Component<{
  type: "error" | "warning";
  message: string;
  index: number;
  onClose: (index: number) => void;
}> {
  static propTypes = {
    type: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
  };

  closeClicked = () => {
    this.props.onClose(this.props.index);
  };

  render() {
    return (
      <div className={"error-bar__item error-bar__" + this.props.type}>
        {this.props.type === "error" ? (
          <MdError className="error-bar__icon" />
        ) : (
          <MdWarning className="error-bar__icon" />
        )}
        <span className="error-bar__text">{this.props.message}</span>
        <MdClose className="error-bar__icon" onClick={this.closeClicked} />
      </div>
    );
  }
}

function mapStateToProps(state: GiantState) {
  return {
    app: state.app,
  };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    problemsActions: bindActionCreators(
      Object.assign({}, problemsActions),
      dispatch,
    ),
  };
}

export const ErrorBar = connect(
  mapStateToProps,
  mapDispatchToProps,
)(ErrorBarUnconnected);
