import React, { FC, useCallback, useEffect, useState } from 'react';
import RotateLeft from 'react-icons/lib/md/rotate-left';
import RotateRight from 'react-icons/lib/md/rotate-right';
import ZoomInIcon from 'react-icons/lib/md/zoom-in';
import ZoomOutIcon from 'react-icons/lib/md/zoom-out';
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
  zoomIn: () => void;
  zoomOut: () => void;

  fixedQuery?: string;
  uri: string;
  onHighlightStateChange: (newState: HighlightsState) => void;
  onQueryChange: (newQuery: string) => void;
};

export const Controls: FC<ControlsProps> = ({
  rotateClockwise,
  rotateAnticlockwise,
  fixedQuery,
  uri,
  onHighlightStateChange,
  onQueryChange,
  zoomIn,
  zoomOut
}) => {
  const [focusedFindHighlightIndex, setFocusedFindHighlightIndex] = useState<number | null>(null);
  const [findHighlights, setFindHighlights] = useState<HighlightForSearchNavigation[]>([]);
  // TODO: should we use ths?
  const [, setFindVisible] = useState(false);
  const [isFindPending, setIsFindPending] = useState<boolean>(false);

  useEffect(() => {
    onHighlightStateChange({
      focusedIndex: focusedFindHighlightIndex,
      highlights: findHighlights
    });
  }, [focusedFindHighlightIndex, findHighlights, onHighlightStateChange])


  const performFind = useCallback((query: string) => {
    if (!query) {
      setFocusedFindHighlightIndex(null);
      setFindHighlights([]);
      onQueryChange('');
      return;
    }

    const params = new URLSearchParams();

    // The backend will respect quotes and do an exact search,
    // but if quotes are unbalanced elasticsearch will error
    params.set("q", removeLastUnmatchedQuote(query));

    const endpoint = fixedQuery === undefined ? "find" : "search";

    // In order to use same debounce on communicating query change to parent
    onQueryChange(query);
    setIsFindPending(true);
    // TODO: handle error
    return authFetch(`/api/pages2/${uri}/${endpoint}?${params.toString()}`)
      .then((res) => res.json())
      .then((highlights) => {
        setIsFindPending(false);
        setFindHighlights(highlights);
        if (highlights.length > 0) {
          setFocusedFindHighlightIndex(0);
        } else {
          setFocusedFindHighlightIndex(null);
        }
      })
  },   [uri, onQueryChange, fixedQuery]);


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
    // Cmd + F
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
      
      {fixedQuery === undefined &&
        <>
          <div>
            <button onClick={zoomIn} >
              <ZoomInIcon />
            </button>
            <button onClick={zoomOut}  >
              <ZoomOutIcon />
            </button>
          </div>
          <div>
            <button onClick={rotateAnticlockwise} >
              <RotateLeft />
            </button>
            <button onClick={rotateClockwise}  >
              <RotateRight />
            </button>
          </div>
        </>
      }

      <FindInput
        fixedQuery={fixedQuery}
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
