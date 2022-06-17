import React, { FC, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import authFetch from '../../util/auth/authFetch';
import { Controls } from './Controls';
import styles from './PageViewer.module.css';
import { VirtualScroll } from './VirtualScroll';
import { HighlightForSearchNavigation } from './model';
import { range, uniq } from 'lodash';
import { removeLastUnmatchedQuote } from '../../util/stringUtils';

type PageViewerProps = {
  page: number;
};

export const PageViewer: FC<PageViewerProps> = () => {
  const params = new URLSearchParams(document.location.search);

  const query = params.get("sq") ?? undefined;

  const { uri } = useParams<{ uri: string }>();

  const [totalPages, setTotalPages] = useState<number | null>(null);

  // Find searching...
  const [focusedFindHighlightIndex, setFocusedFindHighlightIndex] = useState<number | null>(null);
  const [focusedFindHighlight, setFocusedFindHighlight] = useState<HighlightForSearchNavigation | null>(null);
  const [findHighlights, setFindHighlights] = useState<HighlightForSearchNavigation[]>([]);
  const [, setFindVisible] = useState(false);
  const [findSearch, setFind] = useState("");
  const [isFindPending, setIsFindPending] = useState<boolean>(false);

  const [triggerRefresh, setTriggerRefresh] = useState(0);
  const [pageNumbersToPreload, setPageNumbersToPreload] = useState<number[]>([]);

  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    authFetch(`/api/pages2/${uri}/pageCount`)
      .then((res) => res.json())
      .then((obj) => setTotalPages(obj.pageCount));
  }, [uri]);

  // Keypress overrides
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

  // Register keypress overrides
  useEffect(() => {
    window.addEventListener("keydown", handleUserKeyPress);
    return () => {
      window.removeEventListener("keydown", handleUserKeyPress);
    };
  }, [handleUserKeyPress]);

  const performFind = useCallback(
    (query: string) => {
      const params = new URLSearchParams();
      // The backend will respect quotes and do an exact search,
      // but if quotes are unbalanced elasticsearch will error
      params.set("fq", removeLastUnmatchedQuote(query));

      setIsFindPending(true);
      return authFetch(`/api/pages2/${uri}/find?${params.toString()}`)
        .then((res) => res.json())
        .then((highlights) => {
          setIsFindPending(false);
          setFindHighlights(highlights);
          if (highlights.length) {
            setFocusedFindHighlightIndex(0);
          }
          setTriggerRefresh((t) => t + 1);
        })
    },
    [uri]
  );

  const preloadNextPreviousFindPages = useCallback((
    focusedFindHighlightIndex: number,
    findHighlights: HighlightForSearchNavigation[]
  ) => {
    const length = findHighlights.length;

    const indexesOfHighlightsToPreload = uniq(
      range(-3, 3).map((offset) => {
        const offsetIndex = focusedFindHighlightIndex + offset;
        // modulo - the regular % is 'remainder' in JS which is different
        return ((offsetIndex % length) + length) % length;
      })
    );

    const newPreloadPages = uniq(indexesOfHighlightsToPreload.map(
      (idx) => findHighlights[idx].pageNumber
    ));

    setPageNumbersToPreload(newPreloadPages);
  }, []);

  const jumpToNextFindHit = useCallback(() => {
    if (findHighlights.length > 0) {
      const nextHighlightIndex = (focusedFindHighlightIndex !== null && focusedFindHighlightIndex < (findHighlights.length - 1))
          ? (focusedFindHighlightIndex + 1)
          : 0;

      preloadNextPreviousFindPages(nextHighlightIndex, findHighlights);
      setFocusedFindHighlightIndex(nextHighlightIndex);
    }
  }, [findHighlights, focusedFindHighlightIndex, preloadNextPreviousFindPages, setFocusedFindHighlightIndex]);

  const jumpToPreviousFindHit = useCallback(() => {
    if (findHighlights.length > 0) {
      const previousHighlightIndex = (focusedFindHighlightIndex !== null && focusedFindHighlightIndex > 0)
          ? (focusedFindHighlightIndex - 1)
          : (findHighlights.length - 1);

      preloadNextPreviousFindPages(previousHighlightIndex, findHighlights);
      setFocusedFindHighlightIndex(previousHighlightIndex);
    }
  }, [findHighlights, focusedFindHighlightIndex, preloadNextPreviousFindPages, setFocusedFindHighlightIndex]);

  useEffect(() => {
    if ((focusedFindHighlightIndex !== null) && findHighlights.length) {
      setFocusedFindHighlight(findHighlights[focusedFindHighlightIndex]);
    }
  }, [focusedFindHighlightIndex, findHighlights])

  return (
    <main className={styles.main}>
      <Controls
        rotateAnticlockwise={() => setRotation((r) => r - 90)}
        rotateClockwise={() => setRotation((r) => r + 90)}
        findSearch={findSearch}
        setFind={(q) => {
          setFind(q);
        }}
        findHighlights={findHighlights}
        focusedFindHighlightIndex={focusedFindHighlightIndex}
        performFind={performFind}
        isPending={isFindPending}
        jumpToNextFindHit={jumpToNextFindHit}
        jumpToPreviousFindHit={jumpToPreviousFindHit}
      />
      {totalPages ? (
        <VirtualScroll
          uri={uri}
          query={query}
          findQuery={findSearch}
          focusedFindHighlight={focusedFindHighlight}
          triggerHighlightRefresh={triggerRefresh}
          totalPages={totalPages}
          pageNumbersToPreload={pageNumbersToPreload}
          rotation={rotation}
        />
      ) : null}
    </main>
  );
};
