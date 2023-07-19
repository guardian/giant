import { debounce, range } from 'lodash';
import React, { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CachedPreview, HighlightForSearchNavigation, PageData } from './model';
import { Page } from './Page';
import { PageCache } from './PageCache';
import styles from './VirtualScroll.module.css';
import throttle from 'lodash/throttle';

type VirtualScrollProps = {
  uri: string;
  searchQuery?: string;
  findQuery?: string;
  focusedFindHighlight: HighlightForSearchNavigation | null;
  focusedSearchHighlight: HighlightForSearchNavigation | null;

  totalPages: number;
  pageNumbersToPreload: number[];

  jumpToPage?: number | null;

  rotation: number;
  scale: number;
};

type RenderedPage = {
  pageNumber: number,
  getPageData: Promise<PageData>,
  getPagePreview: Promise<CachedPreview>
};

type PageRange = {
  bottom: number,
  middle: number,
  top: number
};

export const VirtualScroll: FC<VirtualScrollProps> = ({
  uri,
  searchQuery,
  findQuery,
  focusedFindHighlight,
  focusedSearchHighlight,

  totalPages,
  jumpToPage,
  pageNumbersToPreload,

  rotation,
  scale
}) => {
  // Tweaked this and 2 seems to be a good amount on a regular monitor
  // The fewer pages we preload the faster the initial paint will be
  // Could possibly make it dynamic based on the visible of the container
  const PRELOAD_PAGES = 2;

  // This must be the same as the margin CSS of .pageContainer
  const MARGIN = 10;

  const containerSize = 1000 * scale;
  const pageHeight = containerSize + (MARGIN * 2);

  const viewport = useRef<HTMLDivElement>(null);

  // TODO: move pageCache up?
  const [pageCache] = useState(() => new PageCache(uri, containerSize, searchQuery));

  // We have a second tier cache tied to the React component lifecycle for storing
  // rendered pages which allows us to swap out stale pages without flickering pages
  const [renderedPages, setRenderedPages] = useState<RenderedPage[]>([]);

  // denounce is used to avoid multiple re-rendering when user clicks on zoom 
  // buttons several times and container size changes too quickly 
  const debouncedRefreshPreview = React.useMemo(
    () =>
      debounce((pageCache: PageCache, containerSize: number) => {
        pageCache.setContainerSize(containerSize);

      setRenderedPages((currentPages) => {
        const newPages: RenderedPage[] = currentPages.map((page) => {
          const refreshedPage = pageCache.refreshPreview(
            page.pageNumber,
            page.getPagePreview,
            containerSize          
          ); 
          return {
            pageNumber: page.pageNumber,
            getPagePreview: refreshedPage.preview,
            getPageData: refreshedPage.data,
          }
        });

        return newPages;
      })
      }, 500),
    []
  );

  useEffect(() => {
    debouncedRefreshPreview(pageCache, containerSize);
  }, [pageCache, containerSize, debouncedRefreshPreview]);

  useEffect(() => {
    pageCache.setFindQuery(findQuery);
    setRenderedPages((currentPages) => {
      const newPages: RenderedPage[] = currentPages.map((page) => {
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
      Promise.all(newPages.map((page) => page.getPageData)).then(() => {
        pageCache
            .getAllPageNumbers()
            .filter((cachedPageNumber) =>
                !newPages.some((newPage) => newPage.pageNumber === cachedPageNumber)
            )
            .forEach((pageNumberToRefresh) =>
                pageCache.getPageAndRefreshHighlights(pageNumberToRefresh)
            );
      });

      return newPages;
    });
  }, [findQuery, pageCache]);

  const [pageRange, setPageRange] = useState<PageRange>({
    bottom: Math.min(1 + PRELOAD_PAGES, totalPages),
    middle: 1,
    top: 1
  });
  const debouncedSetPageRange = useMemo(() => debounce(setPageRange, 150), [setPageRange]);

  const setPageRangeFromScrollPosition = useCallback(() => {
    setPageRange(currentPageRange => {
      if (viewport?.current) {
        const v = viewport.current;

        const currentMid = v.scrollTop + v.clientHeight / 2;
        const topEdge = currentMid - (PRELOAD_PAGES * pageHeight);
        const botEdge = currentMid + (PRELOAD_PAGES * pageHeight);

        const newPageRange = {
          bottom: Math.min(Math.ceil(botEdge / pageHeight), totalPages),
          middle: Math.floor(currentMid / pageHeight) + 1,
          top: Math.max(Math.floor(topEdge / pageHeight), 1)
        }

        const distanceFromPreviousPage = Math.abs(newPageRange.middle - currentPageRange.middle);
        if (distanceFromPreviousPage > 2) {
          // If we've jumped around, debounce the page change to avoid spamming
          // requests and jamming things up handling server responses of pages we'll never see.
          debouncedSetPageRange(newPageRange);
        } else {
          // Otherwise, update the pages right away so we get a responsive experience
          // when scrolling smoothly.
          // Cancel the debounced function first in case we've jumped and then moved
          // a small distance within the debounce timeout.
          debouncedSetPageRange.cancel();
          return newPageRange;
        }
      }
      return currentPageRange
    });
  }, [pageHeight, totalPages, debouncedSetPageRange]);

  const throttledSetPageRangeFromScrollPosition = useMemo(() => throttle(setPageRangeFromScrollPosition, 75), [setPageRangeFromScrollPosition]);

  // TODO: try just useEffect
  useLayoutEffect(() => {
    if (viewport?.current) {
      if (jumpToPage) {
        const scrollTo = (jumpToPage - 1) * pageHeight;
        viewport.current.scrollTop = scrollTo;
      }
    }
  }, [pageHeight, jumpToPage]);

  useLayoutEffect(() => {
    if (viewport?.current && focusedFindHighlight) {
      const highlightYPos = focusedFindHighlight.firstSpan?.y || 0;

      const topOfHighlightPage = (pageHeight * (focusedFindHighlight.pageNumber - 1)) + (highlightYPos * scale);    
      
      viewport.current.scrollTop = topOfHighlightPage;
    }
  }, [pageHeight, focusedFindHighlight, scale]);

  useLayoutEffect(() => {
    if (viewport?.current && focusedSearchHighlight) {
      const highlightYPos = focusedSearchHighlight.firstSpan?.y || 0;

      const topOfHighlightPage = (pageHeight * (focusedSearchHighlight.pageNumber - 1)) + (highlightYPos * scale);
      
      viewport.current.scrollTop = topOfHighlightPage;
    }
  }, [pageHeight, focusedSearchHighlight, scale]);

  const getCachedPage = useCallback((pageNumber: number) => {
    const cachedPage = pageCache.getPage(pageNumber);
    if (cachedPage.previewContainerSize === pageCache.containerSize){
      return cachedPage;
    } else {
      return pageCache.refreshPreview(pageNumber, cachedPage.preview, containerSize);
    }
  }, [pageCache, containerSize]);

  useEffect(() => {
    const renderedPages = range(pageRange.top, pageRange.bottom + 1).map((pageNumber) => {

      const cachedPage = getCachedPage(pageNumber);

      return {
        pageNumber,
        getPagePreview: cachedPage.preview,
        getPageData: cachedPage.data,
      };
    });

    setRenderedPages(renderedPages);
  }, [pageRange.top, pageRange.bottom, pageCache, setRenderedPages, getCachedPage]);

  useEffect(() => {
    pageNumbersToPreload.forEach((pageNumber) => pageCache.getPage(pageNumber));
  }, [pageNumbersToPreload, pageCache]);

  return (
    <div ref={viewport} className={styles.scrollContainer} onScroll={throttledSetPageRangeFromScrollPosition}>
      <div className={styles.pages} style={{ height: totalPages * pageHeight }}>
        {renderedPages.map((page) => (
            <div
              key={page.pageNumber}
              style={{
                top: (page.pageNumber - 1) * pageHeight,
                transform: `rotate(${rotation}deg)`,
                left: `${scale > 1 ? '0' : ''}`,  
              }}
              className={styles.pageContainer}
            >
              <Page
                focusedFindHighlightId={focusedFindHighlight?.id}
                focusedSearchHighlightId={focusedSearchHighlight?.id}
                pageNumber={page.pageNumber}
                getPagePreview={page.getPagePreview}
                getPageData={page.getPageData}
                pageHeight={pageHeight}
              />
            </div>
          ))}
      </div>
    </div>
  );
};
