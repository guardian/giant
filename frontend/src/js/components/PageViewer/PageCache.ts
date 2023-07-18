import authFetch from "../../util/auth/authFetch";
import { LruCache } from "../../util/LruCache";
import { CachedPreview, PageData } from "./model";
import { renderPdfPreview, updatePreview } from "./PdfHelpers";
import { removeLastUnmatchedQuote } from '../../util/stringUtils';
import {PDFWorker} from "pdfjs-dist";

export type CachedPage = {
  previewAbortController: AbortController;
  preview: Promise<CachedPreview>;
  dataAbortController: AbortController;
  data: Promise<PageData>;
};

export type CachedPreviewData = {
  previewAbortController: AbortController;
  preview: Promise<CachedPreview>;
};

export type CachedPageData = {
  dataAbortController: AbortController;
  data: Promise<PageData>;
};

export class PageCache {
  uri: string;
  // across documents
  searchQuery?: string;
  // within document
  findQuery?: string;

  containerSize: number;

  pdfWorker: PDFWorker;

  // Arrived at by testing with Chrome on Ubuntu.
  // Having too many cached pages can result in having too many
  // in-flight requests, causing browser instability.
  static MAX_CACHED_PAGES = 50;

  // Caches are managed seperately so we can do things like cache bust highlights
  // without rerendering previews
  private previewCache: LruCache<number, CachedPreviewData>;
  private dataCache: LruCache<number, CachedPageData>;

  constructor(uri: string, containerSize: number, query?: string) {
    this.containerSize = containerSize;
    this.uri = uri;
    this.searchQuery = query;
    this.previewCache = new LruCache(
      PageCache.MAX_CACHED_PAGES,
      this.onPreviewCacheMiss,
      this.onPreviewCacheEvict
    );
    this.dataCache = new LruCache(
      PageCache.MAX_CACHED_PAGES,
      this.onDataCacheMiss,
      this.onDataCacheEvict
    );
    this.pdfWorker = new PDFWorker();
  }

  setFindQuery = (q?: string) => {
    this.findQuery = q;
  };

  setContainerSize = (sizeInPixels: number) => {
    this.containerSize = sizeInPixels;
  };

  private onPreviewCacheMiss = (pageNumber: number): CachedPreviewData => {

    const previewAbortController = new AbortController();
    const preview = authFetch(`/api/pages2/${this.uri}/${pageNumber}/preview`, {
      signal: previewAbortController.signal,
    })
      .then((res) => res.arrayBuffer())
      .then((buf) => renderPdfPreview(buf, this.pdfWorker, this.containerSize));

    return {
      previewAbortController,
      preview,
    };
  };

  private onPreviewCacheEvict = (_: number, v: CachedPreviewData) => {
    v.previewAbortController.abort();
  };

  private onDataCacheMiss = (pageNumber: number): CachedPageData => {
    const dataAbortController = new AbortController();
    const textParams = new URLSearchParams();
    // The backend will respect quotes and do an exact search,
    // but if quotes are unbalanced elasticsearch will error
    if (this.searchQuery) {
      textParams.set("sq", removeLastUnmatchedQuote(this.searchQuery));
    }
    if (this.findQuery) {
      textParams.set("fq", removeLastUnmatchedQuote(this.findQuery));
    }
    const data = authFetch(
      `/api/pages2/${this.uri}/${pageNumber}/text?${textParams.toString()}`,
      { signal: dataAbortController.signal }
    ).then((res) => res.json());

    return {
      dataAbortController,
      data,
    };
  };

  private onDataCacheEvict = (_: number, v: CachedPageData) => {
    v.dataAbortController.abort();
  };

  getAllPageNumbers = (): number[] => {
    return this.dataCache.keys();
  };

  getPage = (pageNumber: number): CachedPage => {
    const preview = this.previewCache.get(pageNumber);
    const data = this.dataCache.get(pageNumber);

    return {
      ...preview,
      ...data,
    };
  };

  refreshPreview = (pageNumber: number, preview: Promise<CachedPreview>, containerSize: number): CachedPage => {  
    this.setContainerSize(containerSize);  
    const originalPreviewData = this.previewCache.get(pageNumber);
    const newPreview = updatePreview(preview, containerSize);
    const newPreviewCache = {
      previewAbortController: originalPreviewData.previewAbortController,
      preview: newPreview,
    };  

    const data = this.dataCache.get(pageNumber);

    this.previewCache.replace(pageNumber, newPreviewCache);

    const newPreviewData = this.previewCache.get(pageNumber);

    return {
      ...newPreviewData,
      ...data,
    };
  };

  getPageAndRefreshPreview = (pageNumber: number): CachedPage => {
    const preview = this.previewCache.getAndForceRefresh(pageNumber);

    // TODO: we may need to refresh the data too, if we need a new server call to get new highlight positions
    const data = this.dataCache.get(pageNumber);

    return {
      ...preview,
      ...data,
    };
  };

  getPageAndRefreshHighlights = (pageNumber: number): CachedPage => {
    if (this.findQuery) {
      const preview = this.previewCache.get(pageNumber);
      const data = this.dataCache.getAndForceRefresh(pageNumber);

      return {
        ...preview,
        ...data,
      };
    } else {
      return this.getPageAndWipeFindHighlights(pageNumber);
    }
  };

  getPageAndWipeFindHighlights = (pageNumber: number): CachedPage => {
    const preview = this.previewCache.get(pageNumber);
    const data = this.dataCache.get(pageNumber);
    data.data = data.data.then(d => ({
      ...d,
      highlights: d.highlights.filter(h => h.type === "SearchHighlight")
    }));

    return {
      ...preview,
      ...data,
    };
  }
}
