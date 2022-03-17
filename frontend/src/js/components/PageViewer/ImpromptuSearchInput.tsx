import _ from "lodash";
import React, {
  FC,
  KeyboardEventHandler,
  useCallback,
  useEffect,
  useState
} from "react";
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

// The backend will only return 500 pages of hits.
// If we get that many then we need to inform the user that there could be missing values.
// In the future we can make a paging system for impromptu search hits.
const MAX_HITS = 500;

export const ImpromptuSearchInput: FC<ImpromptuSearchInputProps> = ({
  value,
  setValue,
  jumpToNextImpromptuSearchHit,
  jumpToPreviousImpromptuSearchHit,
  performImpromptuSearch,
  hits,
  lastPageHit,
}) => {
  const [showWarning, setShowWarning] = useState(false);

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

  useEffect(() => {
    if (hits.length >= MAX_HITS) {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 5000);
    }
  }, [hits]);

  const currentHit = hits.findIndex((p) => lastPageHit === p);
  return (
      <div className={styles.container}>
        <div className={styles.inputContainer}>
          <input
            id="impromptu-search-input"
            autoComplete="off"
            autoFocus
            value={value}
            placeholder="Search document..."
            onKeyDown={onKeyDown}
            onChange={(e) => {
              setValue(e.target.value);
              debouncedPerformSearch(e.target.value);
            }}
          />
          <div className={styles.count}>
            {currentHit === -1 ? " - " : currentHit + 1}/
            {hits.length > 0
              ? hits.length >= MAX_HITS
                ? ">" + MAX_HITS
                : hits.length
              : " - "}
          </div>
        </div>
        <button onClick={jumpToNextImpromptuSearchHit}>
          <DownIcon />
        </button>
        <button onClick={jumpToPreviousImpromptuSearchHit}>
          <UpIcon />
        </button>
      <div
        data-visible={showWarning || null}
        className={styles.warningContainer}
      >
        <div className={styles.warningArrow} />
        <div className={styles.warning}>
          Over 500 pages match your search only the first 500 highlights will be
          shown
        </div>
      </div>
      </div>
  );
};
