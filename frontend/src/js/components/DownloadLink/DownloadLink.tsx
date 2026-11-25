import React from "react";
import PropTypes from "prop-types";
import { authorizedDownload } from "../../services/AuthApi";

type Props = {
  href: string;
  className?: string;
  children?: React.ReactNode;
};

export class DownloadLink extends React.Component<Props> {
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
      <button className={this.props.className} onClick={this.onClick}>
        {this.props.children}
      </button>
    );
  }
}
