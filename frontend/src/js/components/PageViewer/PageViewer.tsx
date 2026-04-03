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
};

export const PageViewer: FC<PageViewerProps> = ({
  uri,
  totalPages,
  firstPageDimensions,
}) => {
  const params = new URLSearchParams(document.location.search);

  const searchQuery = params.get("q") ?? undefined;

  // The below are stored here because they are set (debounced) by
  // <Controls /> when the user types in the find query box, and are used
  // by <VirtualScroll /> to refresh highlights and preload pages with hits.
  const [findQuery, setFindQuery] = useState("");
  const [findHighlightsState, setFindHighlightsState] =
    useState<HighlightsState>({
      // Beware !focusedIndex for checking null, since it can be 0
      focusedIndex: null,
      highlights: [],
    });
  // For search highlights, the query is fixed so no need to store it in state.
  // But we do need to keep track of the highlights and our position within them.
  const [searchHighlightsState, setSearchHighlightsState] =
    useState<HighlightsState>({
      // Beware !focusedIndex for checking null, since it can be 0
      focusedIndex: null,
      highlights: [],
    });

  const [focusedFindHighlight, setFocusedFindHighlight] =
    useState<HighlightForSearchNavigation | null>(null);
  const [focusedSearchHighlight, setFocusedSearchHighlight] =
    useState<HighlightForSearchNavigation | null>(null);

  const [pageNumbersToPreload, setPageNumbersToPreload] = useState<number[]>(
    [],
  );
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const findHighlightsPreloadPages = getPreloadPages(findHighlightsState);
    const searchHighlightsPreloadPages = getPreloadPages(searchHighlightsState);
    setPageNumbersToPreload(
      uniq([...findHighlightsPreloadPages, ...searchHighlightsPreloadPages]),
    );
  }, [findHighlightsState, searchHighlightsState]);

  const onFindHighlightStateChange = useCallback((newState) => {
    setFindHighlightsState(newState);
    setFocusedFindHighlight(
      newState.focusedIndex !== null
        ? newState.highlights[newState.focusedIndex]
        : null,
    );
  }, []);

  const onSearchHighlightStateChange = useCallback((newState) => {
    setSearchHighlightsState(newState);
    setFocusedSearchHighlight(
      newState.focusedIndex !== null
        ? newState.highlights[newState.focusedIndex]
        : null,
    );
  }, []);

  const onFindQueryChange = useCallback((newQuery) => {
    setFindQuery(newQuery);
  }, []);

  const onSearchQueryChange = useCallback(() => {}, []);

  return (
    <main className={styles.main}>
      <div className={styles.controls}>
        {searchQuery !== undefined && (
          <Controls
            rotateAnticlockwise={() => setRotation((r) => r - 90)}
            rotateClockwise={() => setRotation((r) => r + 90)}
            zoomIn={() => {
              setScale((currentScale) => currentScale + 0.75);
            }}
            zoomOut={() => {
              setScale((currentScale) => currentScale - 0.75);
            }}
            uri={uri}
            onHighlightStateChange={onSearchHighlightStateChange}
            onQueryChange={onSearchQueryChange}
            fixedQuery={searchQuery}
          />
        )}
        <Controls
          rotateAnticlockwise={() => setRotation((r) => r - 90)}
          rotateClockwise={() => setRotation((r) => r + 90)}
          zoomIn={() => {
            setScale((currentScale) => currentScale + 0.75);
          }}
          zoomOut={() => {
            setScale((currentScale) => currentScale - 0.75);
          }}
          uri={uri}
          onHighlightStateChange={onFindHighlightStateChange}
          onQueryChange={onFindQueryChange}
        />
      </div>
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
