import authFetch from "../../util/auth/authFetch";
import { LruCache } from "../../util/LruCache";
import { CachedPreview, PageData } from "./model";
import { renderPdfPreview } from "./PdfHelpers";

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
  query?: string;
  findQuery?: string;

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
    this.query = query;
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
      .then((buf) => renderPdfPreview(buf));

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
    if (this.query) {
      textParams.set("q", this.query);
    }
    if (this.findQuery) {
      textParams.set("iq", this.findQuery);
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

  getPageRefreshHighlights = (pageNumber: number): CachedPage => {
    const preview = this.previewCache.get(pageNumber);
    const data = this.dataCache.getForceRefresh(pageNumber);

    return {
      ...preview,
      ...data,
    };
  };
}
