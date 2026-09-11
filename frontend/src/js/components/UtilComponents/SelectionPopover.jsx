import React, { Component } from "react";
import PropTypes from "prop-types";
import onClickOutside from "react-onclickoutside";

function selectionExists() {
  const selection = window.getSelection();
  return (
    selection &&
    selection.rangeCount > 0 &&
    selection.getRangeAt(0) &&
    !selection.getRangeAt(0).collapsed &&
    selection.getRangeAt(0).getBoundingClientRect().width > 0 &&
    selection.getRangeAt(0).getBoundingClientRect().height > 0
  );
}

function clearSelection() {
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  } else if (document.selection) {
    document.selection.empty();
  }
}

class SelectionPopover extends Component {
  constructor(props) {
    super(props);
    this.state = {
      popoverBox: {
        top: 0,
        left: 0,
      },
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.showPopover === true && nextProps.showPopover === false) {
      clearSelection();
    }
  }

  componentDidMount() {
    const target = document.querySelector("[" + this.props.target + "]");
    target.addEventListener("mouseup", this._handleMouseUp);
  }

  componentWillUnmount() {
    const target = document.querySelector("[" + this.props.target + "]");
    target.removeEventListener("mouseup", this._handleMouseUp);
  }

  render() {
    const { onDeselect, onSelect, showPopover, children, style } = this.props; // eslint-disable-line no-unused-vars
    const {
      popoverBox: { top, left },
    } = this.state;

    const visibility = showPopover ? "visible" : "hidden";
    const display = showPopover ? "inline-block" : "none";

    return (
      <div
        ref={(component) => (this.selectionPopover = component)}
        style={{
          zIndex: 100,
          visibility,
          display,
          position: "absolute",
          top,
          left,
        }}
      >
        {children}
      </div>
    );
  }

  _handleMouseUp = () => {
    if (selectionExists()) {
      this.props.onSelect();
      return this.computePopoverBox();
    }
    this.props.onDeselect();
  };

  computePopoverBox = () => {
    const selection = window.getSelection();
    if (!selectionExists()) {
      return;
    }

    const selectionBox = selection.getRangeAt(0).getBoundingClientRect();
    const popoverBox = this.selectionPopover.getBoundingClientRect();
    const targetElement = document.querySelector("[" + this.props.target + "]");

    const targetStyle =
      targetElement.currentStyle || window.getComputedStyle(targetElement);
    const targetBox = targetElement.getBoundingClientRect();

    const marginTop = parseInt(targetStyle.marginTop.replace("px", ""));
    const marginLeft = parseInt(targetStyle.marginLeft.replace("px", ""));

    const topPos =
      selectionBox.top - targetBox.top - popoverBox.height + marginTop;
    const leftPos =
      selectionBox.left -
      targetBox.left +
      selectionBox.width / 2 -
      popoverBox.width / 2 +
      marginLeft;

    this.setState({
      popoverBox: {
        top: topPos > 0 ? topPos : 0,
        left: leftPos > 0 ? leftPos : 0,
      },
    });
  };

  handleClickOutside = (e) => {
    this.props.onDeselect(e);
  };
}

SelectionPopover.propTypes = {
  children: PropTypes.node.isRequired,
  style: PropTypes.object,
  onDeselect: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  showPopover: PropTypes.bool.isRequired,
  target: PropTypes.string.isRequired,
};

export default onClickOutside(SelectionPopover);
