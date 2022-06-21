import React, { FC, useCallback, useEffect, useState } from 'react';
import RotateLeft from 'react-icons/lib/md/rotate-left';
import RotateRight from 'react-icons/lib/md/rotate-right';
import styles from './Controls.module.css';
import { FindInput } from './FindInput';
import { HighlightForSearchNavigation } from './model';
import { removeLastUnmatchedQuote } from '../../util/stringUtils';
import authFetch from '../../util/auth/authFetch';
import { HighlightsState } from './PageViewer';

type ControlsProps = {
  // Rotation
  rotateClockwise: () => void;
  rotateAnticlockwise: () => void;

  uri: string;
  onHighlightStateChange: (newState: HighlightsState) => void;
  onQueryChange: (newQuery: string) => void;
};

export const Controls: FC<ControlsProps> = ({
  rotateClockwise,
  rotateAnticlockwise,
  uri,
  onHighlightStateChange,
    onQueryChange
}) => {
  const [focusedFindHighlightIndex, setFocusedFindHighlightIndex] = useState<number | null>(null);
  const [findHighlights, setFindHighlights] = useState<HighlightForSearchNavigation[]>([]);
  // TODO: should we use ths?
  const [, setFindVisible] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [isFindPending, setIsFindPending] = useState<boolean>(false);

  useEffect(() => {
    console.log('focusedFindHighlightIndex: ', focusedFindHighlightIndex);
    onHighlightStateChange({
      focusedIndex: focusedFindHighlightIndex,
      highlights: findHighlights
    });
  }, [focusedFindHighlightIndex, findHighlights, onHighlightStateChange])


  const performFind = useCallback((query: string) => {
    if (!query) {
      setFocusedFindHighlightIndex(null);
      setFindHighlights([]);
      return;
    }

    const params = new URLSearchParams();
    // The backend will respect quotes and do an exact search,
    // but if quotes are unbalanced elasticsearch will error
    // TODO: change to "q"
    params.set("fq", removeLastUnmatchedQuote(query));

    // In order to use same debounce on communicating query change to parent
    onQueryChange(query);
    setIsFindPending(true);
    return authFetch(`/api/pages2/${uri}/find?${params.toString()}`)
      .then((res) => res.json())
      .then((highlights) => {
        setIsFindPending(false);
        setFindHighlights(highlights);
        if (highlights.length) {
          console.log('setFocusedFindHighlightIndex to 0');
          setFocusedFindHighlightIndex(0);
        } else {
          setFocusedFindHighlightIndex(null);
        }
      })
  },   [uri]);


  const jumpToNextFindHit = useCallback(() => {
    if (findHighlights.length > 0) {
      const nextHighlightIndex = (focusedFindHighlightIndex !== null && focusedFindHighlightIndex < (findHighlights.length - 1))
          ? (focusedFindHighlightIndex + 1)
          : 0;

      setFocusedFindHighlightIndex(nextHighlightIndex);
    }
  }, [findHighlights, focusedFindHighlightIndex, setFocusedFindHighlightIndex]);

  const jumpToPreviousFindHit = useCallback(() => {
    if (findHighlights.length > 0) {
      const previousHighlightIndex = (focusedFindHighlightIndex !== null && focusedFindHighlightIndex > 0)
          ? (focusedFindHighlightIndex - 1)
          : (findHighlights.length - 1);

      setFocusedFindHighlightIndex(previousHighlightIndex);
    }
  }, [findHighlights, focusedFindHighlightIndex, setFocusedFindHighlightIndex]);

  const handleUserKeyPress = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.keyCode === 70) {
      e.preventDefault();
      setFindVisible(true);

      const maybeInput = document.getElementById(
          "find-search-input"
      ) as HTMLInputElement;
      if (maybeInput) {
        maybeInput.focus();
        maybeInput.setSelectionRange(0, maybeInput.value.length);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleUserKeyPress);
    return () => {
      window.removeEventListener("keydown", handleUserKeyPress);
    };
  }, [handleUserKeyPress]);


  return (
    <div className={styles.bar}>
      <div>
        <button onClick={rotateAnticlockwise}>
          <RotateLeft />
        </button>
        <button onClick={rotateClockwise}>
          <RotateRight />
        </button>
      </div>

      <FindInput
        value={findQuery}
        setValue={setFindQuery}
        highlights={findHighlights}
        focusedFindHighlightIndex={focusedFindHighlightIndex}
        performFind={performFind}
        isPending={isFindPending}
        jumpToNextFindHit={jumpToNextFindHit}
        jumpToPreviousFindHit={jumpToPreviousFindHit}
      />
    </div>
  );
};
