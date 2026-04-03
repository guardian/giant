import React, { FC, useCallback, useEffect, useState } from "react";
import { Controls } from "./Controls";
import styles from "./PageViewer.module.css";
import { VirtualScroll } from "./VirtualScroll";
import {
  HighlightForSearchNavigation,
  HighlightsState,
  PageDimensions,
  getPreloadPages,
} from "./model";
import { uniq } from "lodash";

type PageViewerProps = {
  uri: string;
  totalPages: number;
  firstPageDimensions?: PageDimensions;
  findQuery: string;
  findHighlightsState: HighlightsState;
  focusedFindHighlight: HighlightForSearchNavigation | null;
  rotation: number;
  scale: number;
};

export const PageViewer: FC<PageViewerProps> = ({
  uri,
  totalPages,
  firstPageDimensions,
  findQuery,
  findHighlightsState,
  focusedFindHighlight,
  rotation,
  scale,
}) => {
  const params = new URLSearchParams(document.location.search);

  const searchQuery = params.get("q") ?? undefined;

  // For search highlights, the query is fixed so no need to store it in state.
  // But we do need to keep track of the highlights and our position within them.
  const [searchHighlightsState, setSearchHighlightsState] =
    useState<HighlightsState>({
      focusedIndex: null,
      highlights: [],
    });

  const [focusedSearchHighlight, setFocusedSearchHighlight] =
    useState<HighlightForSearchNavigation | null>(null);

  const [pageNumbersToPreload, setPageNumbersToPreload] = useState<number[]>(
    [],
  );

  useEffect(() => {
    const findPreload = getPreloadPages(findHighlightsState);
    const searchPreload = getPreloadPages(searchHighlightsState);
    setPageNumbersToPreload(uniq([...findPreload, ...searchPreload]));
  }, [findHighlightsState, searchHighlightsState]);

  const onSearchHighlightStateChange = useCallback(
    (newState: HighlightsState) => {
      setSearchHighlightsState(newState);
      setFocusedSearchHighlight(
        newState.focusedIndex !== null
          ? newState.highlights[newState.focusedIndex]
          : null,
      );
    },
    [],
  );

  const onSearchQueryChange = useCallback(() => {}, []);

  return (
    <main className={styles.main}>
      {searchQuery !== undefined && (
        <div className={styles.controls}>
          <Controls
            uri={uri}
            onHighlightStateChange={onSearchHighlightStateChange}
            onQueryChange={onSearchQueryChange}
            fixedQuery={searchQuery}
          />
        </div>
      )}
      {totalPages ? (
        <VirtualScroll
          uri={uri}
          searchQuery={searchQuery}
          findQuery={findQuery}
          focusedFindHighlight={focusedFindHighlight}
          focusedSearchHighlight={focusedSearchHighlight}
          totalPages={totalPages}
          pageNumbersToPreload={pageNumbersToPreload}
          rotation={rotation}
          scale={scale}
          firstPageDimensions={firstPageDimensions}
        />
      ) : null}
    </main>
  );
};
