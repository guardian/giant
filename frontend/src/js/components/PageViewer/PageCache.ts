import authFetch from "../../util/auth/authFetch";
import { LruCache } from "../../util/LruCache";
import { CachedPreview, PageData } from "./model";
import { renderPdfPreview } from "./PdfHelpers";
import * as pdfjs from 'pdfjs-dist';

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

  // Unfortunately because PDF.js haven't typed it,
  // this type is actually just "any" so type system won't enforce anything.
  // But at least this documents what we should be putting in here.
  pdfWorker: typeof pdfjs.PDFWorker;

  // Arrived at by testing with Chrome on Ubuntu.
  // Having too many cached pages can result in having too many
  // in-flight requests, causing browser instability.
  static MAX_CACHED_PAGES = 50;

  // Caches are managed seperately so we can do things like cache bust highlights
  // without rerendering previews
  private previewCache: LruCache<number, CachedPreviewData>;
  private dataCache: LruCache<number, CachedPageData>;

  constructor(uri: string, query?: string) {
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
    this.pdfWorker = new pdfjs.PDFWorker();
  }

  setFindQuery = (q?: string) => {
    this.findQuery = q;
  };

  private onPreviewCacheMiss = (pageNumber: number): CachedPreviewData => {
    const previewAbortController = new AbortController();
    const preview = authFetch(`/api/pages2/${this.uri}/${pageNumber}/preview`, {
      signal: previewAbortController.signal,
    })
      .then((res) => res.arrayBuffer())
      .then((buf) => renderPdfPreview(buf, this.pdfWorker));

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
    if (this.searchQuery) {
      textParams.set("sq", this.searchQuery);
    }
    if (this.findQuery) {
      textParams.set("fq", this.findQuery);
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

  getPageAndRefreshHighlights = (pageNumber: number): CachedPage => {
    const preview = this.previewCache.get(pageNumber);
    const data = this.dataCache.getAndForceRefresh(pageNumber);

    return {
      ...preview,
      ...data,
    };
  };
}
