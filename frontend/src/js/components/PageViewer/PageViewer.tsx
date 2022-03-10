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
    (pageNumber: number) =>
      authFetch(`/api/pages2/${uri}/impromptu?q="${impromptuSearch}"`)
        .then((res) => res.json())
        .then(setImpromptuSearchHits),
    [totalPages, impromptuSearch]
  );

  const jumpToNextImpromptuSearchHit = useCallback(() => {
    if (impromptuSearchHits.length > 0) {
      const nextPage = impromptuSearchHits.find((page) => page > lastPageHit);
      if (nextPage) {
        setLastPageHit(nextPage);
        setJumpToPage(nextPage);
      } else {
        const firstPage = impromptuSearchHits[0];
        setLastPageHit(firstPage);
        setJumpToPage(firstPage);
      }
    }
  }, []);

  return (
    <main className={styles.main}>
      {impromptuSearchVisible && (
        <ImpromptuSearchInput
          value={impromptuSearch}
          onChange={(e) => setImpromptuSearch(e.target.value)}
          performImpromptuSearch={performImpromptuSearch}
          jumpToNextImpromptuSearchHit={jumpToNextImpromptuSearchHit}
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
