import _, { uniq } from "lodash";
import React, {
  FC,
  KeyboardEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import DownIcon from "react-icons/lib/md/arrow-downward";
import UpIcon from "react-icons/lib/md/arrow-upward";
import styles from "./FindInput.module.css";
import { HighlightForSearchNavigation } from "./model";
import { Loader } from "semantic-ui-react";
import InputSupper from "../UtilComponents/InputSupper";

type FindInputProps = {
  fixedQuery?: string;
  performFind: (query: string) => Promise<void> | undefined;
  isPending: boolean;
  jumpToNextFindHit: () => void;
  jumpToPreviousFindHit: () => void;
  highlights: HighlightForSearchNavigation[];
  focusedFindHighlightIndex: number | null;
};

// The backend will only return 500 pages of hits.
// If we get that many then we need to inform the user that there could be missing values.
// In the future we can make a paging system for find search hits.
const MAX_PAGE_HITS = 500;

export const FindInput: FC<FindInputProps> = ({
  fixedQuery,
  jumpToNextFindHit,
  jumpToPreviousFindHit,
  performFind,
  isPending,
  highlights,
  focusedFindHighlightIndex,
}) => {
  const [showWarning, setShowWarning] = useState(false);

  const debouncedPerformSearch = useMemo(
    () => _.debounce(performFind, 500),
    [performFind],
  );

  const [value, setValue] = useState(fixedQuery ?? "");
  useEffect(() => {
    if (fixedQuery !== undefined) {
      performFind(fixedQuery);
    }
  }, [fixedQuery, performFind]);

  const onKeyDown: KeyboardEventHandler = (event) => {
    if (event.key === "Enter") {
      if (event.shiftKey) {
        jumpToPreviousFindHit();
      } else {
        jumpToNextFindHit();
      }
    }
  };

  useEffect(() => {
    if (uniq(highlights.map((h) => h.pageNumber)).length >= MAX_PAGE_HITS) {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 5000);
    }
  }, [highlights]);

  const renderFindCount = useCallback(() => {
    if (!value) {
      return "";
    }

    const current =
      focusedFindHighlightIndex !== null ? focusedFindHighlightIndex + 1 : 0;
    const total = `${showWarning ? ">" : ""}${highlights.length}`;
    return `${current}/${total}`;
  }, [value, focusedFindHighlightIndex, highlights, showWarning]);

  const input = (
    <input
      id="find-search-input"
      className={styles.input}
      autoComplete="off"
      value={value}
      placeholder="Search document..."
      onKeyDown={onKeyDown}
      onChange={(e) => {
        if (fixedQuery === undefined) {
          setValue(e.target.value);
          debouncedPerformSearch(e.target.value);
        }
      }}
    />
  );
  return (
    <div className={styles.container}>
      <div className={styles.inputContainer}>
        {fixedQuery === undefined ? (
          input
        ) : (
          <InputSupper
            disabled={true}
            value={value}
            className={styles.chipsContainer}
            chips={[]}
            onChange={() => {}}
            updateSearchText={() => {}}
          />
        )}
        <div className={styles.count}>
          {isPending ? (
            <Loader active inline="centered" size="tiny" />
          ) : (
            renderFindCount()
          )}
        </div>
      </div>
      <button onClick={jumpToPreviousFindHit}>
        <UpIcon />
      </button>
      <button onClick={jumpToNextFindHit}>
        <DownIcon />
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
