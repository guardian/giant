import React from "react";
import PropTypes from "prop-types";

import { ProgressAnimation } from "../UtilComponents/ProgressAnimation";
import { suggestedFieldsPropType } from "../../types/SuggestedFields";

import InputSupper from "../UtilComponents/InputSupper";

export default class SearchBox extends React.Component {
  static propTypes = {
    q: PropTypes.string.isRequired,
    isSearchInProgress: PropTypes.bool.isRequired,
    updateVisibleText: PropTypes.func.isRequired,
    resetQuery: PropTypes.func.isRequired,
    suggestedFields: PropTypes.arrayOf(suggestedFieldsPropType),
    updateSearchText: PropTypes.func.isRequired,
  };

  focus = () => {
    if (this.searchInput !== document.activeElement) {
      this.searchInput.focus();
      // If you previously did select and didn't type anything the input box 'remembers' it was selected
      // so we need this hack to reset that...
      const value = this.searchInput.value;
      this.searchInput.value = value;
    }
  };

  select = () => {
    if (this.searchInput !== document.activeElement) {
      this.searchInput.select();
    }
  };

  render() {
    const spinner = this.props.isSearchInProgress ? (
      <ProgressAnimation />
    ) : (
      false
    );
    return (
      <div>
        <div className="search-box">
          <InputSupper
            ref={(s) => (this.searchInput = s)}
            className="search-box__input"
            value={this.props.q}
            chips={this.props.suggestedFields}
            onChange={this.props.updateVisibleText}
            updateSearchText={this.props.updateSearchText}
          />
          <div className="search__actions">{spinner}</div>
          <button
            className="btn search__button"
            title="Search"
            onClick={this.props.updateSearchText}
            disabled={this.props.isSearchInProgress}
          >
            Search
          </button>
        </div>
      </div>
    );
  }
}
