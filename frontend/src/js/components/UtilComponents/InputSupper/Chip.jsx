import React from "react";
import PropTypes from "prop-types";

import AutosizeInput from "react-input-autosize";

import _ from "lodash";
import { parseDate } from "../../../util/parseDate";

export default class Chip extends React.Component {
  static propTypes = {
    index: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    negate: PropTypes.bool.isRequired,
    type: PropTypes.string.isRequired,
    options: PropTypes.any,

    stagedForDeletion: PropTypes.bool.isRequired,

    onStepOut: PropTypes.func.isRequired,
    onFocus: PropTypes.func.isRequired,
    onUpdate: PropTypes.func.isRequired,
    onNegateClicked: PropTypes.func.isRequired,
    onDeleteClicked: PropTypes.func.isRequired,
    onEnterPressed: PropTypes.func.isRequired,
  };

  onChange = (value) => {
    this.props.onUpdate(this.props.index, {
      value: value,
    });
  };

  focusEnd = () => {
    this.currentControl.focusEnd();
  };

  focus = () => {
    this.currentControl.focus();
  };

  select = () => {
    this.currentControl.select();
  };

  onKeyDownText = (e, inputStart, inputEnd) => {
    const noSelection = inputStart === inputEnd;

    if (e.key === "Enter") {
      this.props.onEnterPressed(this.props.index);
    } else if (
      (e.key === "Delete" || e.key === "Backspace") &&
      this.props.value === ""
    ) {
      e.preventDefault();
      this.props.onDeleteClicked(this.props.index);
    } else if (e.key === "ArrowLeft" && inputStart === 0 && noSelection) {
      e.preventDefault();
      this.props.onStepOut(this.props.index, -1);
    } else if (
      e.key === "ArrowRight" &&
      inputStart === this.props.value.length &&
      noSelection
    ) {
      e.preventDefault();
      this.props.onStepOut(this.props.index, +1);
    }
  };

  onKeyDownDropdown = (e) => {
    if (e.key === "Enter") {
      this.props.onEnterPressed(this.props.index);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.props.onStepOut(this.props.index, -1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      this.props.onStepOut(this.props.index, +1);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      this.props.onDeleteClicked(this.props.index);
    }
  };

  onFocus = () => {
    this.props.onFocus(this.props.index);
  };

  onDeleteClicked = () => {
    this.props.onDeleteClicked(this.props.index);
  };

  onNegateClicked = () => {
    if (this.props.type !== "workspace_folder")
      this.props.onNegateClicked(this.props.index);
  };

  refHandler = (element) => {
    this.currentControl = element;
  };

  renderControl = () => {
    switch (this.props.type) {
      case "text":
        return (
          <InputChip
            ref={this.refHandler}
            value={this.props.value}
            onChange={this.onChange}
            onKeyDown={this.onKeyDownText}
            onFocus={this.onFocus}
          />
        );
      case "workspace_folder":
        return (
          <WorkspaceFolderChip
            ref={this.refHandler}
            value={this.props.value}
            onChange={this.onChange}
            onKeyDown={this.onKeyDownDropdown}
            onFocus={this.onFocus}
          />
        );
      case "date":
        return (
          <DateChip
            ref={this.refHandler}
            value={this.props.value}
            onChange={this.onChange}
            onKeyDown={this.onKeyDownText}
            dateMode="from_start"
          />
        );
      case "date_ex":
        return (
          <DateChip
            ref={this.refHandler}
            value={this.props.value}
            onChange={this.onChange}
            onKeyDown={this.onKeyDownText}
            dateMode="from_end"
          />
        );
      case "dropdown":
        return (
          <DropDownChip
            ref={this.refHandler}
            value={this.props.value}
            options={this.props.options}
            onKeyDown={this.onKeyDownDropdown}
            onChange={this.onChange}
          />
        );
      default:
        return (
          <UnknownChip ref={this.refHandler}>
            {"Unknown chip type: " +
              this.props.type +
              ", try refreshing the page"}
          </UnknownChip>
        );
    }
  };

  render() {
    return (
      <span
        className={`input-supper__chip ${this.props.stagedForDeletion ? "input-supper__chip--delete-glow" : ""}`}
      >
        <button
          className="input-supper__chip-negate"
          onClick={this.onNegateClicked}
        >
          <div className="input-supper__button-icon">
            {this.props.negate ? "−" : "+"}
          </div>
        </button>

        <span className="input-supper__chip-body">
          <span className="input-supper__chip-name">{this.props.name}</span>
          {this.renderControl()}
        </span>

        <button
          className="input-supper__chip-delete"
          onClick={this.onDeleteClicked}
        >
          <div className="input-supper__button-icon">&times;</div>
        </button>
      </span>
    );
  }
}

// The usability of this isn't very important since it should never appear if the client and server are in sync.
class UnknownChip extends React.Component {
  static propTypes = {
    children: PropTypes.node,
  };

  focus = () => {
    console.error("cannot focus unknown chip");
  };

  focusEnd = () => {
    console.error("cannot focusEnd unknown chip");
  };

  select = () => {
    console.error("cannot select unknown chip");
  };

  render() {
    return <div>{this.props.children}</div>;
  }
}

class WorkspaceFolderChip extends React.Component {
  static propTypes = {
    value: PropTypes.string.isRequired,
    onFocus: PropTypes.func.isRequired,
    onChange: PropTypes.func.isRequired,
    onKeyDown: PropTypes.func.isRequired,
  };

  focus = () => {
    this.textInput.focus();
  };

  focusEnd = () => {
    this.textInput.focus();
    this.textInput.input.selectionStart = this.textInput.input.selectionEnd =
      this.textInput.input.value.length;
  };

  select = () => {
    this.textInput.select();
  };

  onChange = (e) => {
    this.props.onChange(e.target.value);
  };

  onKeyDown = (e) => {
    const inputStart = this.textInput.input.selectionStart;
    const inputEnd = this.textInput.input.selectionEnd;

    this.props.onKeyDown(e, inputStart, inputEnd);
  };

  render() {
    return (
      <AutosizeInput
        ref={(i) => (this.textInput = i)}
        type="text"
        inputClassName="input-supper__inline-input input-supper__inline-input--chip"
        value={this.props.value}
        onChange={this.onChange}
        onKeyDown={this.onKeyDown}
        onFocus={this.props.onFocus}
        disabled={true}
      />
    );
  }
}

class InputChip extends React.Component {
  static propTypes = {
    value: PropTypes.string.isRequired,
    onFocus: PropTypes.func.isRequired,
    onChange: PropTypes.func.isRequired,
    onKeyDown: PropTypes.func.isRequired,
  };

  focus = () => {
    this.textInput.focus();
  };

  focusEnd = () => {
    this.textInput.focus();
    this.textInput.input.selectionStart = this.textInput.input.selectionEnd =
      this.textInput.input.value.length;
  };

  select = () => {
    this.textInput.select();
  };

  onChange = (e) => {
    this.props.onChange(e.target.value);
  };

  onKeyDown = (e) => {
    const inputStart = this.textInput.input.selectionStart;
    const inputEnd = this.textInput.input.selectionEnd;

    this.props.onKeyDown(e, inputStart, inputEnd);
  };

  render() {
    return (
      <AutosizeInput
        ref={(i) => (this.textInput = i)}
        type="text"
        inputClassName="input-supper__inline-input input-supper__inline-input--chip"
        value={this.props.value}
        onChange={this.onChange}
        onKeyDown={this.onKeyDown}
        onFocus={this.props.onFocus}
      />
    );
  }
}

class DateChip extends React.Component {
  static propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    onKeyDown: PropTypes.func.isRequired,
    dateMode: PropTypes.string.isRequired,
  };

  focus = () => {
    this.input.focus();
  };

  focusEnd = () => {
    this.input.focus();
  };

  select = () => {
    this.input.select();
  };

  state = {
    isValidDate: true,
  };

  debounceCheckValidity = _.debounce((text) => {
    if (text === "") {
      this.setState({ isValidDate: true }); // cheeky hack to stop the instant pop-in of the warning
    } else {
      const date = parseDate(text, this.props.dateMode);
      this.setState({
        isValidDate: !!date,
      });
    }
  }, 500);

  componentWillUnmount() {
    this.debounceCheckValidity.cancel();
  }

  onChange = (e) => {
    this.props.onChange(e.target.value);
    this.debounceCheckValidity(e.target.value);
  };

  onKeyDown = (e) => {
    const inputStart = e.target.selectionStart;
    const inputEnd = e.target.selectionEnd;

    this.props.onKeyDown(e, inputStart, inputEnd);
  };

  renderWarning = () => {
    const visibleClass =
      this.props.value && !this.state.isValidDate
        ? "input-supper__inline-date__warning--visible"
        : "input-supper__inline-date__warning--hidden";
    return (
      <div className={"input-supper__inline-date__warning " + visibleClass}>
        !
      </div>
    );
  };

  render() {
    return (
      <div style={{ display: "inline-block" }}>
        <div className="input-supper__inline-date">
          {this.renderWarning()}
          <AutosizeInput
            ref={(r) => (this.input = r)}
            type="text"
            inputClassName="input-supper__inline-date input-supper__inline-input input-supper__inline-input--chip"
            value={this.props.value}
            onChange={this.onChange}
            onKeyDown={this.onKeyDown}
          />
        </div>
      </div>
    );
  }
}

class DropDownChip extends React.Component {
  static propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    onKeyDown: PropTypes.func.isRequired,
    options: PropTypes.array,
  };

  state = {
    currentValue: null,
  };

  focus = () => {
    this.selector.focus();
  };

  focusEnd = () => {
    this.selector.focus();
  };

  select = () => {
    this.selector.focus();
  };

  onKeyDown = (e) => {
    this.props.onKeyDown(e);
  };

  onChange = (e) => {
    this.props.onChange(e.target.value);
  };

  render() {
    return (
      <select
        ref={(r) => (this.selector = r)}
        value={this.props.value}
        onChange={this.onChange}
        className="input-supper__inline-input input-supper__inline-input--chip"
        onKeyDown={this.props.onKeyDown}
      >
        {this.props.options
          ? this.props.options.map((pair) => (
              <option key={pair.value} value={pair.value}>
                {pair.label}
              </option>
            ))
          : false}
      </select>
    );
  }
}
