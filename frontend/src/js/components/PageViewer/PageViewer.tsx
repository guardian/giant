import _ from "lodash";
import React, { FC, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import authFetch from "../../util/auth/authFetch";
import { Controls } from "./Controls";
import styles from "./PageViewer.module.css";
import { VirtualScroll } from "./VirtualScroll";

type PageViewerProps = {
  page: number;
};

export const PageViewer: FC<PageViewerProps> = () => {
  const params = new URLSearchParams(document.location.search);

  const query = params.get("q") ?? undefined;
  const page = Number(params.get("page"));

  const { uri } = useParams<{ uri: string }>();

  const [totalPages, setTotalPages] = useState<number | null>(null);

  const [middlePage, setMiddlePage] = useState(page);

  // Used by various things to signal to the virtual scroller to scroll to a particular page
  // Initially set to the page in the URL
  const [jumpToPage, setJumpToPage] = useState<number | null>(page);

  // Find searching...
  const [lastPageHit, setLastPageHit] = useState<number>(0);
  const [findSearchHits, setFindHits] = useState<number[]>([]);
  const [findSearchVisible, setFindVisible] = useState(false);
  const [findSearch, setFind] = useState("");

  const [triggerRefresh, setTriggerRefresh] = useState(0);
  const [preloadPages, setPreloadPages] = useState<number[]>([]);

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
      authFetch(`/api/pages2/${uri}/find?q="${query}"`)
        .then((res) => res.json())
        .then((searchHits) => {
          setLastPageHit(middlePage);
          setFindHits(searchHits);
          setTriggerRefresh((t) => t + 1);
        }),
    [middlePage]
  );

  const preloadNextPreviousFindPages = (
    centrePage: number,
    pageHits: number[]
  ) => {
    const index = pageHits.findIndex((page) => page === centrePage);
    const length = pageHits.length;

    const hitsToPreloadIndexes = _.uniq(
      _.range(-3, 3).map((offset) => {
        const offsetIndex = index + offset;
        // modulo - the regular % is 'remainder' in JS which is different
        return ((offsetIndex % length) + length) % length;
      })
    );

    const newPreloadPages = hitsToPreloadIndexes.map(
      (idx) => findSearchHits[idx]
    );

    setPreloadPages(newPreloadPages);
  };

  const jumpToNextFindHit = useCallback(() => {
    if (findSearchHits.length > 0) {
      const maybePage = findSearchHits.find((page) => page > lastPageHit);
      const nextPage = maybePage ? maybePage : findSearchHits[0];

      preloadNextPreviousFindPages(nextPage, findSearchHits);
      setLastPageHit(nextPage);
      setJumpToPage(nextPage);
    }
  }, [findSearchHits, lastPageHit]);

  const jumpToPreviousFindHit = useCallback(() => {
    if (findSearchHits.length > 0) {
      const maybePage = _.findLast(
        findSearchHits,
        (page) => page < lastPageHit
      );
      const previousPage = maybePage
        ? maybePage
        : findSearchHits[findSearchHits.length - 1];

      preloadNextPreviousFindPages(previousPage, findSearchHits);
      setLastPageHit(previousPage);
      setJumpToPage(previousPage);
    }
  }, [findSearchHits, lastPageHit]);

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
        lastPageHit={lastPageHit}
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
          preloadPages={preloadPages}
          setMiddlePage={setMiddlePage}
          rotation={rotation}
        />
      ) : null}
    </main>
  );
};
