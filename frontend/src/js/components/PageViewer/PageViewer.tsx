import React, { FC, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import authFetch from '../../util/auth/authFetch';
import { Controls } from './Controls';
import styles from './PageViewer.module.css';
import { VirtualScroll } from './VirtualScroll';
import { HighlightForSearchNavigation } from './model';
import { range, uniq } from 'lodash';

type PageViewerProps = {
  page: number;
};

export type HighlightsState = {
  focusedIndex: number | null,
  highlights: HighlightForSearchNavigation[]
};

export const PageViewer: FC<PageViewerProps> = () => {
  const params = new URLSearchParams(document.location.search);

  const query = params.get("sq") ?? undefined;

  const { uri } = useParams<{ uri: string }>();

  const [totalPages, setTotalPages] = useState<number | null>(null);

  // The below are stored here because they are set (debounced) by
  // <Controls /> when the user types in the find query box, and are used
  // by <VirtualScroll /> to refresh highlights and preload pages with hits.
  const [findQuery, setFindQuery] = useState('');
  const [findHighlightsState, setFindHighlightsState] = useState<HighlightsState>({
    focusedIndex: null,
    highlights: []
  });

  const [pageNumbersToPreload, setPageNumbersToPreload] = useState<number[]>([]);

  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    authFetch(`/api/pages2/${uri}/pageCount`)
      .then((res) => res.json())
      .then((obj) => setTotalPages(obj.pageCount));
  }, [uri]);

  useEffect(() => {
    if (findHighlightsState.focusedIndex !== null && findHighlightsState.highlights.length) {
      const length = findHighlightsState.highlights.length;

      const indexesOfHighlightsToPreload = uniq(
          range(-3, 3).map((offset) => {
            // type guard does not extend into .map() it seems
            const offsetIndex = (findHighlightsState.focusedIndex ?? 0) + offset;
            // modulo - the regular % is 'remainder' in JS which is different
            return ((offsetIndex % length) + length) % length;
          })
      );

      const newPreloadPages = uniq(indexesOfHighlightsToPreload.map(
          (idx) => findHighlightsState.highlights[idx].pageNumber
      ));

      setPageNumbersToPreload(newPreloadPages);
    }
  }, [findHighlightsState]);

  const focusedFindHighlight = (findHighlightsState.focusedIndex !== null) ? findHighlightsState.highlights[findHighlightsState.focusedIndex] : null;

  const onHighlightStateChange = useCallback((newState) => {
    setFindHighlightsState(newState)
  }, []);

  const onQueryChange = useCallback((newQuery) => {
    setFindQuery(newQuery);
  }, []);

  return (
    <main className={styles.main}>
      <Controls
        rotateAnticlockwise={() => setRotation((r) => r - 90)}
        rotateClockwise={() => setRotation((r) => r + 90)}
        uri={uri}
        onHighlightStateChange={onHighlightStateChange}
        onQueryChange={onQueryChange}
      />
      {totalPages ? (
        <VirtualScroll
          uri={uri}
          query={query}
          findQuery={findQuery}
          focusedFindHighlight={focusedFindHighlight}
          totalPages={totalPages}
          pageNumbersToPreload={pageNumbersToPreload}
          rotation={rotation}
        />
      ) : null}
    </main>
  );
};
