import React, { forwardRef, useImperativeHandle, useRef } from "react";

import { ProgressAnimation } from "../UtilComponents/ProgressAnimation";
import InputSupper from "../UtilComponents/InputSupper";
import { SuggestedField } from "../../types/SuggestedFields";

export interface SearchBoxProps {
  q: string;
  isSearchInProgress: boolean;
  updateVisibleText: (text: string) => void;
  resetQuery: (e: React.MouseEvent<HTMLButtonElement>) => void;
  suggestedFields?: SuggestedField[];
  updateSearchText: () => void;
}

export interface SearchBoxHandle {
  focus: () => void;
  select: () => void;
}

interface InputSupperHandle {
  focus: () => void;
  select: () => void;
}

const SearchBox = forwardRef<SearchBoxHandle, SearchBoxProps>(
  function SearchBox(props, ref) {
    const inputSupperRef = useRef<InputSupperHandle | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputSupperRef.current?.focus(),
        select: () => inputSupperRef.current?.select(),
      }),
      [],
    );

    const spinner = props.isSearchInProgress ? <ProgressAnimation /> : false;

    return (
      <div>
        <div className="search-box">
          <InputSupper
            ref={(s: InputSupperHandle | null) => {
              inputSupperRef.current = s;
            }}
            className="search-box__input"
            value={props.q}
            chips={props.suggestedFields}
            onChange={props.updateVisibleText}
            updateSearchText={props.updateSearchText}
          />
          <div className="search__actions">{spinner}</div>
          <div className={"search__buttons"}>
            <button
              className="btn"
              title="Search"
              onClick={props.updateSearchText}
              disabled={props.isSearchInProgress}
            >
              Search
            </button>
            <button
              className="btn"
              title="Clear search query and filters"
              onClick={props.resetQuery}
              disabled={props.isSearchInProgress}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    );
  },
);

export default SearchBox;
