import React from "react";
import PropTypes from "prop-types";
import WarningIcon from "react-icons/lib/md/warning";
import ErrorIcon from "react-icons/lib/md/error";
import CloseIcon from "react-icons/lib/md/close";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import * as problemsActions from "../../actions/problems";

export class ErrorBarUnconnected extends React.Component {
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

  closeError = (i) => {
    this.props.problemsActions.clearError(i);
  };

  closeWarning = (i) => {
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

class ProblemPopup extends React.Component {
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
          <ErrorIcon className="error-bar__icon" />
        ) : (
          <WarningIcon className="error-bar__icon" />
        )}
        <span className="error-bar__text">{this.props.message}</span>
        <CloseIcon className="error-bar__icon" onClick={this.closeClicked} />
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    app: state.app,
  };
}

function mapDispatchToProps(dispatch) {
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
