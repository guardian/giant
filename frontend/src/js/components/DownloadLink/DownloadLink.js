import React from "react";
import PropTypes from "prop-types";
import { authorizedDownload } from "../../services/AuthApi";

export class DownloadLink extends React.Component {
  static propTypes = {
    href: PropTypes.string.isRequired,
    className: PropTypes.string,
    children: PropTypes.node,
  };

  onClick = () => {
    authorizedDownload(this.props.href).then(
      (target) => (window.location.href = target),
    );
  };

  render() {
    return (
      <button className={this.props.className} href="#" onClick={this.onClick}>
        {this.props.children}
      </button>
    );
  }
}
