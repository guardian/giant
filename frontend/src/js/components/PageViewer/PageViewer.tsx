import _ from "lodash";
import React, { FC, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import authFetch from "../../util/auth/authFetch";
import { ImpromptuSearchInput } from "./ImpromptuSearchInput";
import { Page } from "./Page";
import { PageCache } from "./PageCache";
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

  const [pageCache] = useState(new PageCache(uri, query));
  const [totalPages, setTotalPages] = useState<number | null>(null);

  // Used by various things to signal to the virtual scroller to scroll to a particular page
  const [jumpToPage, setJumpToPage] = useState<number | null>(null);

  // Impromptu searching...
  const [lastPageHit, setLastPageHit] = useState<number>(0);
  const [impromptuSearchHits, setImpromptuSearchHits] = useState<number[]>([]);
  const [impromptuSearchVisible, setImpromptuSearchVisible] = useState(false);
  const [impromptuSearch, setImpromptuSearch] = useState("");

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
    }
  }, []);

  // Register keypress overrides
  useEffect(() => {
    window.addEventListener("keydown", handleUserKeyPress);
    return () => {
      window.removeEventListener("keydown", handleUserKeyPress);
    };
  }, [handleUserKeyPress]);

  const renderPage = (pageNumber: number) => {
    const cachedPage = pageCache.getPage(pageNumber);

    return (
      <Page
        getPagePreview={() => cachedPage.preview}
        getPageData={() => cachedPage.data}
      />
    );
  };

  const performImpromptuSearch = useCallback(
    (query: string) =>
      authFetch(`/api/pages2/${uri}/impromptu?q="${query}"`)
        .then((res) => res.json())
        .then(setImpromptuSearchHits),
    []
  );

  const preloadNextPreviousImpromptuPages = (
    centrePage: number,
    pageHits: number[]
  ) => {
    const index = pageHits.findIndex((page) => page === centrePage);
    const length = pageHits.length;

    for (let i = -3; i <= 3; i++) {
      const preloadPageIndex = (index - (1 % length) + length) % length;
      pageCache.getPage(pageHits[preloadPageIndex]);
    }
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
          setValue={setImpromptuSearch}
          performImpromptuSearch={performImpromptuSearch}
          jumpToNextImpromptuSearchHit={jumpToNextImpromptuSearchHit}
          jumpToPreviousImpromptuSearchHit={jumpToPreviousImpromptuSearchHit}
        />
      )}
      {totalPages ? (
        <VirtualScroll
          totalPages={totalPages}
          renderPage={renderPage}
          initialPage={page}
          jumpToPage={jumpToPage}
        />
      ) : null}
    </main>
  );
};
