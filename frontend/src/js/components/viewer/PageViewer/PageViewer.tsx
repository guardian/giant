import React, { useEffect, useState } from 'react';
import throttle from 'lodash/throttle';
import { PagePreview } from './PagePreview';
import sortBy from 'lodash/sortBy';
import { GiantState, PagesState } from '../../../types/redux/GiantState';
import { useDispatch, useSelector } from 'react-redux';
import { loadPages } from '../../../actions/pages/loadPages';
import { PagesActionType } from '../../../types/redux/GiantActions';
import { GiantDispatch } from '../../../types/redux/GiantDispatch';

type Props = {
    uri: string,
    q?: string
}

export default function PageViewer({ uri, q }: Props) {
    const dispatch: GiantDispatch = useDispatch();
    const state = useSelector<GiantState, PagesState>(({ pages }) => pages);

    const [viewport, setViewport] = useState<HTMLDivElement | null>(null);

    // Load initial pages
    // TODO MRB: as this reacts to aspect changing it should load based on the current scroll position

    // This is just to get a string dependency for useEffect.
    // Objects cause crazy infinite looping because of reference equality
    // (objects with same value are seen as different so useEffect is always called).
    const pageApiUri = `/api/pages/text/${uri}`;

    const currentHighlightElement = state.currentHighlightId ? state.mountedHighlightElements[state.currentHighlightId] : null;

    useEffect(() => {
        if (currentHighlightElement) {
            currentHighlightElement.scrollIntoView({
                inline: 'center',
                block: 'center'
            });
        }
    }, [currentHighlightElement]);

    useEffect(() => {
        const viewportTop = 0;
        const viewportBottom = window.innerHeight;

        dispatch(loadPages(pageApiUri, viewportTop, viewportBottom, q));
    }, [pageApiUri, q, dispatch]);

    async function onScroll() {
        if (viewport !== null && state.doc && state.doc.pages.length > 0) {
            const viewportTop = viewport.scrollTop;
            const viewportBottom = viewportTop + viewport.clientHeight;

            const sortedPages = sortBy(state.doc.pages, 'page');

            const firstPageInViewport = sortedPages.find(p => p.dimensions.top < viewportBottom && p.dimensions.bottom > viewportTop);
            const lastPageInViewport = sortedPages.reverse().find(p => p.dimensions.top < viewportBottom && p.dimensions.bottom > viewportTop);

            // if you scroll fast
            const nothingInViewport = firstPageInViewport === undefined && lastPageInViewport === undefined;
            const spaceAboveFirstPage = firstPageInViewport ? firstPageInViewport.dimensions.top > viewportTop : false;
            const spaceBelowLastPage = lastPageInViewport ? lastPageInViewport.dimensions.bottom < viewportBottom : false;

            if(nothingInViewport || spaceAboveFirstPage || spaceBelowLastPage) {
                dispatch(loadPages(pageApiUri, viewportTop, viewportBottom, q));
            }
        }
    }

    const throttledOnScroll = throttle(onScroll, 500);

    useEffect(() => {
        const callback = () => {
            throttledOnScroll();
        };

        window.addEventListener("resize", callback);
        return () => {
            window.removeEventListener("resize", callback);
        }
    });

    if (!state.doc) {
        return <div className="viewer__main">
            <div className='viewer__no-text-preview'>Loading...</div>
        </div>;
    }

    return <div className="viewer__main" ref={setViewport} onScroll={throttledOnScroll}>
        {viewport !== null ?
            <React.Fragment>
                <div className="pfi-pages" style={{ height: state.doc.summary.height }}>
                    {state.doc.pages.map(page =>
                        <PagePreview
                            key={page.page}
                            page={page}
                            currentHighlightId={state.currentHighlightId}
                            q={q}
                            onHighlightMount={(id: string, top: number, element: HTMLElement) =>
                                dispatch({
                                    type: PagesActionType.SEARCH_HIGHLIGHT_MOUNTED,
                                    id,
                                    element
                                })
                            }
                            uri={uri}
                        />
                    )}
                </div>
            </React.Fragment>
        : <div />}
    </div>;
}
