import React, { FC, useCallback, useEffect, useState } from "react";
import { Controls } from "./Controls";
import styles from "./PageViewer.module.css";
import { VirtualScroll } from "./VirtualScroll";
import { HighlightForSearchNavigation } from "./model";
import { range, uniq } from "lodash";

type PageViewerProps = {
  uri: string;
  totalPages: number;
};

export type HighlightsState = {
  // Beware !focusedIndex for checking null, since it can be 0
  focusedIndex: number | null;
  highlights: HighlightForSearchNavigation[];
};

function getPreloadPages(highlightState: HighlightsState): number[] {
  if (
    highlightState.focusedIndex === null ||
    highlightState.highlights.length === 0
  ) {
    return [];
  }

  const length = highlightState.highlights.length;

  // From three highlights before to three highlights after,
  // wrapping if we hit an edge. If there are fewer than seven highlights,
  // we'll get them all, the uniq() call will prevent duplicates.
  const indexesOfHighlightsToPreload = uniq(
    range(-3, 3).map((offset) => {
      // type guard does not extend into .map() it seems
      const offsetIndex = (highlightState.focusedIndex ?? 0) + offset;
      // modulo - the regular % is 'remainder' in JS which is different
      return ((offsetIndex % length) + length) % length;
    }),
  );

  return uniq(
    indexesOfHighlightsToPreload.map(
      (idx) => highlightState.highlights[idx].pageNumber,
    ),
  );
}

export const PageViewer: FC<PageViewerProps> = ({ uri, totalPages }) => {
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
        />
      ) : null}
    </main>
  );
};
