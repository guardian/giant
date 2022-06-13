import { uniq, range, findLast } from "lodash";
import React, { FC, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import authFetch from "../../util/auth/authFetch";
import { Controls } from "./Controls";
import styles from "./PageViewer.module.css";
import { VirtualScroll } from "./VirtualScroll";
import { getPreviewBlob } from '../../services/PreviewApi';

type PageViewerProps = {
  page: number;
};

export const PageViewer: FC<PageViewerProps> = () => {
  const params = new URLSearchParams(document.location.search);

  const query = params.get("sq") ?? undefined;
  const page = Number(params.get("page"));

  const { uri } = useParams<{ uri: string }>();

  const [totalPages, setTotalPages] = useState<number | null>(null);

  const [middlePage, setMiddlePage] = useState(page);

  // Used by various things to signal to the virtual scroller to scroll to a particular page
  // Initially set to the page in the URL
  const [jumpToPage, setJumpToPage] = useState<number | null>(page);

  // Find searching...
  const [findState, setFindState] = useState<{
    previousPageHit: number | null,
    loadedHighlights: string[],
    currentHighlight: string,
    nextPageHit: number | null;
  }>()

  const [loadedFindHighlights, setLoadedFindHighlights] = useState<string[]>([]);
  const [currentFindHighlight, setCurrentFindHighlight] = useState<string | null>(null);

  // const [lastPageHit, setLastPageHit] = useState<number>(0);
  const [findSearchHits, setFindHits] = useState<number[]>([]);
  const [, setFindVisible] = useState(false);
  const [findSearch, setFind] = useState("");

  const [triggerRefresh, setTriggerRefresh] = useState(0);
  const [pageNumbersToPreload, setPageNumbersToPreload] = useState<number[]>([]);

  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    console.log('currentFindHighlight: ', currentFindHighlight);
  }, [currentFindHighlight]);
  useEffect(() => {
    console.log('loadedFindHighlights: ', loadedFindHighlights);
  }, [loadedFindHighlights]);

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
        .then((searchHits) => {
          setFindHits(searchHits);
          setTriggerRefresh((t) => t + 1);
        }),
    [middlePage, uri]
  );

  const preloadNextPreviousFindPages = useCallback((
    centrePage: number,
    pageHits: number[]
  ) => {
    const index = pageHits.findIndex((page) => page === centrePage);
    const length = pageHits.length;

    const hitsToPreloadIndexes = uniq(
      range(-3, 3).map((offset) => {
        const offsetIndex = index + offset;
        // modulo - the regular % is 'remainder' in JS which is different
        return ((offsetIndex % length) + length) % length;
      })
    );

    const newPreloadPages = hitsToPreloadIndexes.map(
      (idx) => findSearchHits[idx]
    );

    setPageNumbersToPreload(newPreloadPages);
  }, [findSearchHits]);

  const jumpToNextFindHit = useCallback(() => {
    if (findSearchHits.length > 0) {
      setCurrentFindHighlight(cur => {
        const i = loadedFindHighlights.findIndex(h => h === cur);
        let next;
        if (i === -1) {
          // Either: cur is null, so initialise
          // Or: somehow cur is something that's not loaded?
          next = loadedFindHighlights[0];
        } else {
          next = loadedFindHighlights[i+1];
        }
        if (!next) {
          // TODO: better
          const matches = cur?.matchAll(/^find-page-(\d+)/g);
          let maybePage;
          if (matches) {
            const [[allMatches, pageNumber]] = matches;
            maybePage = findSearchHits.find((page) => page > parseInt(pageNumber));
          }
          const nextPage = maybePage ? maybePage : findSearchHits[0];

          preloadNextPreviousFindPages(nextPage, findSearchHits);
          setJumpToPage(nextPage);
          return 'NEXT_PAGE';
        } else {
          return next;
        }
      });
    }
  }, [findSearchHits, loadedFindHighlights, preloadNextPreviousFindPages, setJumpToPage]);

  const jumpToPreviousFindHit = useCallback(() => {
    if (findSearchHits.length > 0) {
      setCurrentFindHighlight(cur => {
        const i = loadedFindHighlights.findIndex(h => h === cur);
        const prev = loadedFindHighlights[i-1];
        if (!prev) {
          // TODO: better
          const matches = cur?.matchAll(/^find-page-(\d+)/g);
          let maybePage;
          if (matches) {
            const [[allMatches, pageNumber]] = matches;
            maybePage = findLast(
                findSearchHits,
                (page) => page < parseInt(pageNumber)
            );
          }
          const previousPage = maybePage
            ? maybePage
            : findSearchHits[findSearchHits.length - 1];

          preloadNextPreviousFindPages(previousPage, findSearchHits);
          setJumpToPage(previousPage);
          return 'PREV_PAGE';
        } else {
          return prev;
        }
      });

    }
  }, [findSearchHits, loadedFindHighlights, preloadNextPreviousFindPages, setJumpToPage]);

  useEffect(() => {
    setCurrentFindHighlight((cur) => {
      if (!loadedFindHighlights.length) return cur;
      if (cur === 'NEXT_PAGE') {
        return loadedFindHighlights[0];
      } else if (cur === 'PREV_PAGE') {
        return loadedFindHighlights[loadedFindHighlights.length-1];
      } else {
        return cur;
      }
    })
  }, [loadedFindHighlights]);

  return (
    <main className={styles.main}>
      <Controls
        rotateAnticlockwise={() => setRotation((r) => r - 90)}
        rotateClockwise={() => setRotation((r) => r + 90)}
        findSearch={findSearch}
        setFind={(q) => {
          setFind(q);
        }}
        findSearchHits={findSearchHits}
        performFind={performFind}
        jumpToNextFindHit={jumpToNextFindHit}
        jumpToPreviousFindHit={jumpToPreviousFindHit}
      />
      {totalPages ? (
        <VirtualScroll
          uri={uri}
          query={query}
          findQuery={findSearch}
          triggerHighlightRefresh={triggerRefresh}
          totalPages={totalPages}
          jumpToPage={jumpToPage}
          pageNumbersToPreload={pageNumbersToPreload}
          onMiddlePageChange={setMiddlePage}
          onFindHighlightsChange={setLoadedFindHighlights}
          rotation={rotation}
          currentFindHighlight={currentFindHighlight}
        />
      ) : null}
    </main>
  );
};
