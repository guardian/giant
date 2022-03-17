import _ from "lodash";
import React, { FC, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import authFetch from "../../util/auth/authFetch";
import { ImpromptuSearchInput } from "./ImpromptuSearchInput";
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

  // Impromptu searching...
  const [lastPageHit, setLastPageHit] = useState<number>(0);
  const [impromptuSearchHits, setImpromptuSearchHits] = useState<number[]>([]);
  const [impromptuSearchVisible, setImpromptuSearchVisible] = useState(false);
  const [impromptuSearch, setImpromptuSearch] = useState("");

  const [triggerRefresh, setTriggerRefresh] = useState(0);
  const [preloadPages, setPreloadPages] = useState<number[]>([]);

  useEffect(() => {
    authFetch(`/api/pages2/${uri}/pageCount`)
      .then((res) => res.json())
      .then((obj) => setTotalPages(obj.pageCount));
  }, [uri]);

  // Keypress overrides
  const handleUserKeyPress = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.keyCode === 70) {
      e.preventDefault();
      setImpromptuSearchVisible(true);

      const maybeInput = document.getElementById(
        "impromptu-search-input"
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

  const performImpromptuSearch = useCallback(
    (query: string) =>
      authFetch(`/api/pages2/${uri}/impromptu?q="${query}"`)
        .then((res) => res.json())
        .then((searchHits) => {
          setLastPageHit(middlePage);
          setImpromptuSearchHits(searchHits);
          setTriggerRefresh((t) => t + 1);
        }),
    [middlePage]
  );

  const preloadNextPreviousImpromptuPages = (
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
      (idx) => impromptuSearchHits[idx]
    );

    setPreloadPages(newPreloadPages);
  };

  const jumpToNextImpromptuSearchHit = useCallback(() => {
    if (impromptuSearchHits.length > 0) {
      const maybePage = impromptuSearchHits.find((page) => page > lastPageHit);
      const nextPage = maybePage ? maybePage : impromptuSearchHits[0];

      preloadNextPreviousImpromptuPages(nextPage, impromptuSearchHits);
      setLastPageHit(nextPage);
      setJumpToPage(nextPage);
    }
  }, [impromptuSearchHits, lastPageHit]);

  const jumpToPreviousImpromptuSearchHit = useCallback(() => {
    if (impromptuSearchHits.length > 0) {
      const maybePage = _.findLast(
        impromptuSearchHits,
        (page) => page < lastPageHit
      );
      const previousPage = maybePage
        ? maybePage
        : impromptuSearchHits[impromptuSearchHits.length - 1];

      preloadNextPreviousImpromptuPages(previousPage, impromptuSearchHits);
      setLastPageHit(previousPage);
      setJumpToPage(previousPage);
    }
  }, [impromptuSearchHits, lastPageHit]);

  return (
    <main className={styles.main}>
      {impromptuSearchVisible && (
        <ImpromptuSearchInput
          value={impromptuSearch}
          setValue={(q) => {
            setImpromptuSearch(q);
          }}
          hits={impromptuSearchHits}
          lastPageHit={lastPageHit}
          performImpromptuSearch={performImpromptuSearch}
          jumpToNextImpromptuSearchHit={jumpToNextImpromptuSearchHit}
          jumpToPreviousImpromptuSearchHit={jumpToPreviousImpromptuSearchHit}
        />
      )}
      {totalPages ? (
        <VirtualScroll
          uri={uri}
          query={query}
          impromptuQuery={impromptuSearch}
          triggerRefresh={triggerRefresh}
          totalPages={totalPages}
          jumpToPage={jumpToPage}
          preloadPages={preloadPages}
          setMiddlePage={setMiddlePage}
        />
      ) : null}
    </main>
  );
};
