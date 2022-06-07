import _, { debounce } from 'lodash';
import React, { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CONTAINER_AND_MARGIN_SIZE } from "./model";
import { Page } from "./Page";
import { PageCache } from "./PageCache";
import styles from "./VirtualScroll.module.css";
import throttle from 'lodash/throttle';

type VirtualScrollProps = {
  uri: string;
  query?: string;
  findQuery?: string;
  triggerHighlightRefresh: number;

  totalPages: number;
  jumpToPage: number | null;
  preloadPages: number[];

  onMiddlePageChange: (n: number) => void;

  rotation: number;
};

export const VirtualScroll: FC<VirtualScrollProps> = ({
  uri,
  query,
  findQuery,
  triggerHighlightRefresh,

  totalPages,
  jumpToPage,
  preloadPages,
  onMiddlePageChange,

  rotation,
}) => {
  // Tweaked this and 2 seems to be a good amount on a regular monitor
  // The fewer pages we preload the faster the initial paint will be
  // Could possibly make it dynamic based on the visible of the container
  const PRELOAD_PAGES = 2;

  const pageHeight = CONTAINER_AND_MARGIN_SIZE;

  const viewport = useRef<HTMLDivElement>(null);

  const [pageCache] = useState(() => new PageCache(uri, query));

  // We have a second tier cache tied to the React component lifecycle for storing
  // rendered pages which allows us to swap out stale pages without flickering pages
  const [currentPages, setCurrentPages] = useState<any[]>([]);

  useEffect(() => {
    pageCache.setFindQuery(findQuery);
  }, [findQuery, pageCache]);

  const [pages, setPages] = useState({bottom: 1, middle: 1, top: 1 + PRELOAD_PAGES});
  const debouncedSetPages = useMemo(() => debounce(setPages, 150), [setPages]);

  const getPages = useCallback(() => {
    setPages(currentPages => {
      console.log('setPages');
      if (viewport?.current) {
        const v = viewport.current;

        const currentMid = v.scrollTop + v.clientHeight / 2;

        const topEdge = currentMid - PRELOAD_PAGES * pageHeight;
        const botEdge = currentMid + PRELOAD_PAGES * pageHeight;

        const newMiddle = Math.floor(currentMid / pageHeight) + 1;
        const newPages = {
          bottom: Math.min(Math.ceil(botEdge / pageHeight), totalPages),
          middle: newMiddle,
          top: Math.max(Math.floor(topEdge / pageHeight), 1)
        }

        const distanceFromPreviousPage = Math.abs(newPages.middle - currentPages.middle);
        if (distanceFromPreviousPage > 2) {
          // If we've jumped around, debounce the page change to avoid spamming
          // requests and jamming things up handling server responses of pages we'll never see.
          debouncedSetPages(newPages);
        } else {
          // Otherwise, update the pages right away so we get a responsive experience
          // when scrolling smoothly.
          return newPages;
        }
      }
      return currentPages
    });
  }, [pageHeight, onMiddlePageChange, totalPages]);

  useEffect(() => {
    // Inform the parent component of the new middle page
    // This allows it to do useful things such as have a sensible "next" page
    // to go to for the find hits
    onMiddlePageChange(pages.middle);
  }, [pages.middle]);

  const onScroll = useMemo(() => throttle(getPages, 75), [getPages]);

  useEffect(() => {
    getPages();
  }, [viewport, getPages]);

  useLayoutEffect(() => {
    if (viewport?.current && jumpToPage) {
      const v = viewport.current;
      const scrollTo = (jumpToPage - 1) * pageHeight;
      v.scrollTop = scrollTo;
    }
  }, [pageHeight, jumpToPage]);

  useEffect(() => {
    const renderedPages = _.range(pages.top, pages.bottom + 1).map((pageNumber) => {
      const cachedPage = pageCache.getPage(pageNumber);
      return {
        pageNumber,
        getPagePreview: cachedPage.preview,
        getPageData: cachedPage.data,
      };
    });

    setCurrentPages(renderedPages);
  }, [pages.top, pages.bottom, pageCache, setCurrentPages]);

  useLayoutEffect(() => {
    if (triggerHighlightRefresh > 0) {
      setCurrentPages((oldPages) => {
        const newPages = oldPages.map((page) => {
          const refreshedPage = pageCache.getPageAndRefreshHighlights(
              page.pageNumber
          );
          return {
            pageNumber: page.pageNumber,
            getPagePreview: page.getPagePreview,
            getPageData: refreshedPage.data,
          }
        });

        // Once we've refreshed all visible pages go and refresh the cached pages too
        // Will this work inside a setState callback?? It seems so...
        Promise.all(newPages.map((r) => r.getPageData)).then(() => {
          pageCache
              .getAllPageNumbers()
              .filter((p) => !newPages.some((cp) => cp.pageNumber === p))
              .forEach((p) => pageCache.getPageAndRefreshHighlights(p));
        });

        return newPages;
      });
    }
  }, [triggerHighlightRefresh, pageCache]);

  useEffect(() => {
    preloadPages.forEach((p) => pageCache.getPage(p));
  }, [preloadPages, pageCache]);

  return (
    <div ref={viewport} className={styles.scrollContainer} onScroll={onScroll}>
      <div className={styles.pages} style={{ height: totalPages * pageHeight }}>
        {currentPages.map((page) => (
          <div
            key={page.pageNumber}
            style={{
              top: (page.pageNumber - 1) * pageHeight,
              transform: `rotate(${rotation}deg)`,
            }}
            className={styles.pageContainer}
          >
            <Page
              pageNumber={page.pageNumber}
              getPagePreview={page.getPagePreview}
              getPageData={page.getPageData}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
