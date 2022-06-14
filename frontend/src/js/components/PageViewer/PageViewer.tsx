import React, { FC, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import authFetch from '../../util/auth/authFetch';
import { Controls } from './Controls';
import styles from './PageViewer.module.css';
import { VirtualScroll } from './VirtualScroll';
import { HighlightForSearchNavigation } from './model';

type PageViewerProps = {
  page: number;
};

export const PageViewer: FC<PageViewerProps> = () => {
  const params = new URLSearchParams(document.location.search);

  const query = params.get("sq") ?? undefined;
  const page = Number(params.get("page"));

  const { uri } = useParams<{ uri: string }>();

  const [totalPages, setTotalPages] = useState<number | null>(null);

  // Find searching...

  // TODO: maybe these should be yoked together...
  const [focusedFindHighlightIndex, setFocusedFindHighlightIndex] = useState<number | null>(null);
  const [focusedFindHighlight, setFocusedFindHighlight] = useState<HighlightForSearchNavigation | null>(null);
  // END TODO

  const [findHighlights, setFindHighlights] = useState<HighlightForSearchNavigation[]>([]);
  const [, setFindVisible] = useState(false);
  const [findSearch, setFind] = useState("");

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
    (query: string) =>
      authFetch(`/api/pages2/${uri}/find?fq="${query}"`)
        .then((res) => res.json())
        .then((highlights) => {
          setFindHighlights(highlights);
          if (highlights.length) {
            setFocusedFindHighlightIndex(0);
          }
          setTriggerRefresh((t) => t + 1);
        }),
    [uri]
  );

  // const preloadNextPreviousFindPages = useCallback((
  //   highlight: HighlightForSearchNavigation,
  //   highlights: HighlightForSearchNavigation[]
  // ) => {
  //   const index = pageHits.findIndex((page) => page === centrePage);
  //   const length = pageHits.length;
  //
  //   const hitsToPreloadIndexes = uniq(
  //     range(-3, 3).map((offset) => {
  //       const offsetIndex = index + offset;
  //       // modulo - the regular % is 'remainder' in JS which is different
  //       return ((offsetIndex % length) + length) % length;
  //     })
  //   );
  //
  //   const newPreloadPages = hitsToPreloadIndexes.map(
  //     (idx) => findHighlights[idx]
  //   );
  //
  //   setPageNumbersToPreload(newPreloadPages);
  // }, [findHighlights]);

  const jumpToNextFindHit = useCallback(() => {
    if (findHighlights.length > 0) {
      const nextHighlightIndex = (focusedFindHighlightIndex !== null && focusedFindHighlightIndex < (findHighlights.length - 1))
          ? (focusedFindHighlightIndex + 1)
          : 0;

      // preloadNextPreviousFindPages(nextHighlight, findHighlights);
      setFocusedFindHighlightIndex(nextHighlightIndex);
    }
  }, [findHighlights, focusedFindHighlightIndex, /*preloadNextPreviousFindPages,*/ setFocusedFindHighlightIndex]);

  const jumpToPreviousFindHit = useCallback(() => {
    if (findHighlights.length > 0) {
      const previousHighlightIndex = (focusedFindHighlightIndex !== null && focusedFindHighlightIndex > 0)
          ? (focusedFindHighlightIndex - 1)
          : (findHighlights.length - 1);

      // preloadNextPreviousFindPages(previousHighlight, findHighlights);
      setFocusedFindHighlightIndex(previousHighlightIndex);
    }
  }, [findHighlights, focusedFindHighlightIndex, /*preloadNextPreviousFindPages,*/ setFocusedFindHighlightIndex]);

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
