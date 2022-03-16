import _ from "lodash";
import React, { FC, KeyboardEventHandler, useCallback } from "react";
import DownIcon from "react-icons/lib/md/arrow-downward";
import UpIcon from "react-icons/lib/md/arrow-upward";
import styles from "./ImpromptuSearchInput.module.css";

type ImpromptuSearchInputProps = {
  value: string;
  setValue: (v: string) => void;
  performImpromptuSearch: (query: string) => Promise<void>;
  jumpToNextImpromptuSearchHit: () => void;
  jumpToPreviousImpromptuSearchHit: () => void;
  hits: number[];
  lastPageHit: number;
};

export const ImpromptuSearchInput: FC<ImpromptuSearchInputProps> = ({
  value,
  setValue,
  jumpToNextImpromptuSearchHit,
  jumpToPreviousImpromptuSearchHit,
  performImpromptuSearch,
  hits,
  lastPageHit,
}) => {
  const debouncedPerformSearch = useCallback(
    _.debounce(performImpromptuSearch, 300),
    [performImpromptuSearch]
  );

  const onKeyDown: KeyboardEventHandler = (event) => {
    if (event.key === "Enter") {
      if (event.shiftKey) {
        jumpToPreviousImpromptuSearchHit();
      } else {
        jumpToNextImpromptuSearchHit();
      }
    }
  };

  const currentHit = hits.findIndex((p) => lastPageHit === p);
  return (
    <div className={styles.popover}>
      <div className={styles.container}>
        <div className={styles.inputContainer}>
          <input
            id="impromptu-search-input"
            autoFocus
            value={value}
            onKeyDown={onKeyDown}
            onChange={(e) => {
              setValue(e.target.value);
              debouncedPerformSearch(e.target.value);
            }}
          />
          <div className={styles.count}>
            {currentHit === -1 ? " - " : currentHit + 1}/
            {hits.length > 0 ? hits.length : " - "}
          </div>
        </div>
        <button onClick={jumpToNextImpromptuSearchHit}>
          <DownIcon />
        </button>
        <button onClick={jumpToPreviousImpromptuSearchHit}>
          <UpIcon />
        </button>
      </div>
    </div>
  );
};
