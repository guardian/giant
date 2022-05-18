import { Page, PagedDocument, PagedDocumentSummary, PageDimensions, PageHighlight } from '../../../reducers/pagesReducer';
import authFetch from '../../../util/auth/authFetch';

// The server units are points (from PDFs)
// CSS pixels do not actually map to on-screen pixels.
//   - https://webplatform.github.io/docs/tutorials/understanding-css-units/
//   - https://www.w3.org/TR/css3-values/#reference-pixel
const ptSizeInInches = 1 / 72;
const pxPerInch = 96;

export function ptsToPx(pts: number) {
    return (pts * ptSizeInInches) * pxPerInch;
}

export function pxToPts(px: number) {
    return (px / pxPerInch) / ptSizeInInches;
}

function scaleDimensions(before: PageDimensions): PageDimensions {
    return {
        width: ptsToPx(before.width),
        height: ptsToPx(before.height),
        top: ptsToPx( before.top),
        bottom: ptsToPx(before.bottom)
    };
}

function scaleHighlight(highlight: PageHighlight): PageHighlight {
    switch(highlight.type) {
        case 'SearchHighlight':
            return {
                ...highlight,
                data: highlight.data.map(hls => ({
                    x: ptsToPx(hls.x),
                    y: ptsToPx(hls.y),
                    width: ptsToPx(hls.width),
                    height: ptsToPx(hls.height),
                    rotation: hls.rotation
                }))
            }
    }
}

function scaleSummary(summary: PagedDocumentSummary): PagedDocumentSummary {
    return { ...summary, height: ptsToPx(summary.height) };
}

function scalePage(page: Page): Page {
    const scaledDimensions = scaleDimensions(page.dimensions);

    return {
        ...page,
        dimensions: scaledDimensions,
        highlights: page.highlights.map(scaleHighlight)
    };
}

export function scaleDocument(doc: PagedDocument): PagedDocument {
    const summary = scaleSummary(doc.summary);
    const pages = doc.pages.map(scalePage);

    return { pages, summary };
}

function getQueryParams(viewportTop: number, viewportBottom: number, q?: string): string {
    const params = new URLSearchParams();

    params.append("unit", "point");
    params.append("top", "" + pxToPts(viewportTop));
    params.append("bottom", "" + pxToPts(viewportBottom));

    if(q) {
        params.append("q", q);
    }

    return '?' + params.toString();
}

export async function fetchPages(uri: string, viewportTop: number, viewportBottom: number, q?: string): Promise<PagedDocument> {
    const documentUrlBase = encodeURI(uri);

    const pageUrl = documentUrlBase + getQueryParams(viewportTop, viewportBottom, q);

    try {
        const response = await authFetch(pageUrl);
        const unscaledDoc: PagedDocument = await response.json();
        return scaleDocument(unscaledDoc);
    } catch (e) {
        console.error('Error fetching pages (will return empty PagedDocument): ', e);
        return {
            summary: {
                numberOfPages: 0,
                height: 0
            },
            pages: []
        }
    }
}

export async function fetchPagePreview(language: string, uri: String, pageNumber: number, q?: string): Promise<ArrayBuffer> {
    const path  = `/api/pages/preview/${language}/${uri}/${pageNumber}`;

    const response = await authFetch(path);
    const buffer = await response.arrayBuffer();

    return buffer;
}
