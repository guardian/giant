import React from "react";

import { ProgressAnimation } from "../UtilComponents/ProgressAnimation";
import InputSupper from "../UtilComponents/InputSupper";
import { SuggestedField } from "../../types/SuggestedFields";

interface InputSupperHandle {
  focus(): void;
  select(): void;
}

export interface SearchBoxProps {
  q: string;
  isSearchInProgress: boolean;
  updateVisibleText: (text: string) => void;
  resetQuery: (e: React.MouseEvent<HTMLButtonElement>) => void;
  suggestedFields?: SuggestedField[];
  updateSearchText: () => void;
}

export default class SearchBox extends React.Component<SearchBoxProps> {
  searchInput: InputSupperHandle | null = null;

  focus = () => {
    this.searchInput?.focus();
  };

  select = () => {
    this.searchInput?.select();
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
            ref={(s: InputSupperHandle | null) => (this.searchInput = s)}
            className="search-box__input"
            value={this.props.q}
            chips={this.props.suggestedFields}
            onChange={this.props.updateVisibleText}
            updateSearchText={this.props.updateSearchText}
          />
          <div className="search__actions">{spinner}</div>
          <div className={"search__buttons"}>
            <button
              className="btn"
              title="Search"
              onClick={this.props.updateSearchText}
              disabled={this.props.isSearchInProgress}
            >
              Search
            </button>
            <button
              className="btn"
              title="Clear search query and filters"
              onClick={this.props.resetQuery}
              disabled={this.props.isSearchInProgress}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    );
  }
}
