import React from "react";
import PropTypes from "prop-types";
import { ProgressAnimation } from "../UtilComponents/ProgressAnimation";
import { generate2faToken } from "../../services/UserApi";
import { Setup2Fa } from "./Setup2Fa";
import { config } from "../../types/Config";

export class RegisterUser extends React.Component {
  static propTypes = {
    config: config,
    title: PropTypes.string.isRequired,
    onError: PropTypes.func.isRequired,
    onComplete: PropTypes.func.isRequired,
  };

  state = {
    hasCompletedPhase1: false,

    username: "",
    previousPassword: "",

    displayName: "",
    newPassword: "",
    confirmNewPassword: "",

    tfaCode: "",

    requesting: false,
  };

  canContinue = () => {
    return (
      this.state.username &&
      this.state.displayName &&
      this.state.previousPassword &&
      this.state.newPassword &&
      this.state.confirmNewPassword &&
      this.errors().length === 0 &&
      !this.state.requesting
    );
  };

  canFinish = () => {
    return this.canContinue() && this.state.tfaCode;
  };

  errors = () => {
    let errors = [];

    const mismatch =
      this.state.newPassword &&
      this.state.newPassword !== this.state.confirmNewPassword;
    const passwordTooShort =
      this.state.newPassword &&
      this.state.newPassword.length <
        this.props.config.authConfig.minPasswordLength;
    const samePassword =
      this.state.newPassword &&
      this.state.previousPassword &&
      this.state.newPassword === this.state.previousPassword;

    if (mismatch) errors.push("Passwords do not match");
    if (passwordTooShort)
      errors.push(
        `Password is too short (minimum ${this.props.config.authConfig.minPasswordLength} characters)`,
      );
    if (samePassword)
      errors.push("Password is the same as the previous password");

    if (this.state.hasCompletedPhase1 && !this.state.tfaCode) {
      errors.push("Enter Code");
    }

    return errors;
  };

  submit = (
    username,
    previousPassword,
    displayName,
    newPassword,
    totpActivation,
  ) => {
    this.setState({ requesting: true });

    fetch("/api/users/" + username + "/register", {
      headers: new Headers({ "Content-Type": "application/json" }),
      method: "PUT",
      body: JSON.stringify({
        username: username,
        previousPassword: previousPassword,
        displayName: displayName,
        newPassword: newPassword,
        totpActivation: totpActivation,
      }),
    })
      .then((r) => {
        if (r.status === 204) {
          this.props.onComplete();
        } else if (r.status === 400) {
          // Bad TFA token
          this.setState({ requesting: false, tfaCode: "" });
          this.props.onError("Bad authentication code, please retry");
        } else {
          // Unauthenticated, go back to first page
          this.setState({
            requesting: false,
            hasCompletedPhase1: false,
            username: "",
            previousPassword: "",
          });
          this.props.onError(
            "Bad login credentials, please check your username and previous password",
          );
        }
      })
      .catch(() => {
        this.setState({ requesting: false });
      });
  };

  updateState = (e) => {
    this.setState({ [e.target.name]: e.target.value });
  };

  continuePressed = () => {
    if (!this.state.hasCompletedPhase1 && this.canContinue()) {
      generate2faToken(this.state.username).then((res) =>
        this.setState({
          url: res.url,
          secret: res.secret,
          hasCompletedPhase1: true,
        }),
      );
    } else if (this.state.hasCompletedPhase1 && this.canFinish()) {
      const totpActivation = {
        secret: this.state.secret,
        code: this.state.tfaCode,
      };

      this.submit(
        this.state.username,
        this.state.previousPassword,
        this.state.displayName,
        this.state.newPassword,
        totpActivation,
      );
    }
  };

  skip2fa = () => {
    this.submit(
      this.state.username,
      this.state.previousPassword,
      this.state.displayName,
      this.state.newPassword,
      undefined,
    );
  };

  renderActions = () => {
    const errors = this.errors();

    let progress = (
      <span className="error">
        <strong>{errors.join(", ")}</strong>
      </span>
    );

    if (this.state.requesting) {
      progress = <ProgressAnimation />;
    }

    const enabled = this.state.hasCompletedPhase1
      ? this.canFinish()
      : this.canContinue();
    const buttonText = this.state.hasCompletedPhase1 ? "Finish" : "Continue";

    return (
      <div className="form__actions">
        <button
          className="btn"
          type="button"
          onClick={this.continuePressed}
          disabled={!enabled}
        >
          {buttonText}
        </button>
        {progress}
      </div>
    );
  };

  onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      this.continuePressed();
    }
  };

  renderField = (
    name,
    label,
    type = "text",
    onKeyDown = undefined,
    autofocus = false,
  ) => {
    return (
      <div className="form__row">
        <label className="form__label" htmlFor={"#" + name}>
          {label}
        </label>
        <input
          id={name}
          className="form__field"
          autoFocus={autofocus}
          type={type}
          name={name}
          placeholder={label}
          value={this.state[name]}
          onChange={this.updateState}
          onKeyDown={onKeyDown}
          autoComplete="off"
          required
        />
      </div>
    );
  };

  renderPasswordReset = () => {
    return (
      <div className="app__page app__page--centered">
        <div className="form" noValidate>
          <h2 className="form__title">{this.props.title}</h2>
          <form className="form" onSubmit={this.onSubmit}>
            <div className="form__section">
              <h3 className="form__subtitle">Provided Information</h3>
              <p>
                This information should been provided to you by an
                administrator.
              </p>
              {this.renderField(
                "username",
                "Username",
                "text",
                undefined,
                true,
              )}
              {this.renderField(
                "previousPassword",
                "Previous Password",
                "password",
              )}
            </div>
            <div className="form__section">
              <h3 className="form__subtitle">New Details</h3>
              <p>Please fill in the following fields.</p>
              {this.renderField("displayName", "Display Name")}
              {this.renderField("newPassword", "New Password", "password")}
              {this.renderField(
                "confirmNewPassword",
                "Confirm New Password",
                "password",
                this.onKeyDown,
              )}
              {this.renderActions()}
            </div>
          </form>
        </div>
      </div>
    );
  };

  render2FA() {
    return (
      <div className="app__page app__page--centered">
        <form className="form" noValidate>
          <h2>Setup Two Factor Authentication</h2>
          <div>
            <Setup2Fa
              username={this.state.username}
              secret={this.state.secret}
              url={this.state.url}
            />
            {this.renderField(
              "tfaCode",
              "Authentication Code",
              "text",
              this.onKeyDown,
              true,
            )}
            {this.renderActions()}
            {this.props.config.authConfig.require2fa ? (
              false
            ) : (
              <button
                className="users__skip-2fa"
                type="button"
                onClick={this.skip2fa}
              >
                Skip this step
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  render() {
    if (!this.state.hasCompletedPhase1) {
      return this.renderPasswordReset();
    } else {
      return this.render2FA();
    }
  }
}
