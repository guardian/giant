import React, { Component } from "react";
import PropTypes from "prop-types";
import onClickOutside from "react-onclickoutside";

type SelectionPopoverProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onDeselect: (event?: MouseEvent | TouchEvent) => void;
  onSelect: () => void;
  showPopover: boolean;
  target: string;
};

type SelectionPopoverState = {
  popoverBox: { top: number; left: number };
};

function selectionExists(selection: Selection | null): selection is Selection {
  return (
    selection !== null &&
    selection.rangeCount > 0 &&
    selection.getRangeAt(0) &&
    !selection.getRangeAt(0).collapsed &&
    selection.getRangeAt(0).getBoundingClientRect().width > 0 &&
    selection.getRangeAt(0).getBoundingClientRect().height > 0
  );
}

function clearSelection() {
  const legacyDocument: Document & { selection?: { empty: () => void } } =
    document;
  if (window.getSelection) {
    window.getSelection()?.removeAllRanges();
  } else if (legacyDocument.selection) {
    legacyDocument.selection.empty();
  }
}

class SelectionPopover extends Component<
  SelectionPopoverProps,
  SelectionPopoverState
> {
  static propTypes = {
    children: PropTypes.node.isRequired,
    style: PropTypes.object,
    onDeselect: PropTypes.func.isRequired,
    onSelect: PropTypes.func.isRequired,
    showPopover: PropTypes.bool.isRequired,
    target: PropTypes.string.isRequired,
  };

  private selectionPopover: HTMLDivElement | null = null;

  constructor(props: SelectionPopoverProps) {
    super(props);
    this.state = {
      popoverBox: {
        top: 0,
        left: 0,
      },
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps: SelectionPopoverProps) {
    if (this.props.showPopover === true && nextProps.showPopover === false) {
      clearSelection();
    }
  }

  componentDidMount() {
    const target = document.querySelector("[" + this.props.target + "]");
    target?.addEventListener("mouseup", this._handleMouseUp);
  }

  componentWillUnmount() {
    const target = document.querySelector("[" + this.props.target + "]");
    target?.removeEventListener("mouseup", this._handleMouseUp);
  }

  render() {
    const { showPopover, children } = this.props;
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
    if (selectionExists(window.getSelection())) {
      this.props.onSelect();
      return this.computePopoverBox();
    }
    this.props.onDeselect();
  };

  computePopoverBox = () => {
    const selection = window.getSelection();
    if (!selectionExists(selection) || !this.selectionPopover) {
      return;
    }

    const selectionBox = selection.getRangeAt(0).getBoundingClientRect();
    const popoverBox = this.selectionPopover.getBoundingClientRect();
    const targetElement:
      | (Element & { currentStyle?: CSSStyleDeclaration })
      | null = document.querySelector("[" + this.props.target + "]");
    if (!targetElement) {
      return;
    }

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

  handleClickOutside = (e: MouseEvent | TouchEvent) => {
    this.props.onDeselect(e);
  };
}

export default onClickOutside(SelectionPopover);
