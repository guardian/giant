import _ from "lodash";
import React, { FC, useCallback } from "react";
import styles from "./ImpromptuSearchInput.module.css";

type ImpromptuSearchInputProps = {
  value: string;
  setValue: (v: string) => void;
  performImpromptuSearch: (query: string) => Promise<void>;
  jumpToNextImpromptuSearchHit: () => void;
  jumpToPreviousImpromptuSearchHit: () => void;
};

export const ImpromptuSearchInput: FC<ImpromptuSearchInputProps> = ({
  value,
  setValue,
  jumpToNextImpromptuSearchHit,
  jumpToPreviousImpromptuSearchHit,
  performImpromptuSearch,
}) => {
  const debouncedPerformSearch = useCallback(
    _.debounce(performImpromptuSearch, 300),
    [performImpromptuSearch]
  );

  return (
    <div className={styles.popover}>
      <div className={styles.container}>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            debouncedPerformSearch(e.target.value);
          }}
        />
        <button onClick={jumpToNextImpromptuSearchHit}>⬇️</button>
        <button onClick={jumpToPreviousImpromptuSearchHit}>⬆️️</button>
      </div>
    </div>
  );
};
