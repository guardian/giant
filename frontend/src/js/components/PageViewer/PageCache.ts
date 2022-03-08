import authFetch from "../../util/auth/authFetch";
import { LruCache } from "../../util/LruCache";
import { CachedPreview, PageData } from "./model";
import { renderPdfPreview } from "./PdfHelpers";

export type CachedPageData = {
  previewAbortController: AbortController;
  preview: Promise<CachedPreview>;
  dataAbortController: AbortController;
  data: Promise<PageData>;
};

export class PageCache {
  uri: string;
  query?: string;

  // Arrived at by testing with Chrome on Ubuntu.
  // Having too many cached pages can result in having too many 
  // in-flight requests, causing browser instability.
  static MAX_CACHED_PAGES = 25;

  private cache: LruCache<number, CachedPageData>;

  constructor(uri: string, query?: string) {
    this.uri = uri;
    this.query = query;
    this.cache = new LruCache(PageCache.MAX_CACHED_PAGES, this.onCacheMiss, this.onCacheEvict);
  }

  private onCacheMiss = (pageNumber: number): CachedPageData => {
    const previewAbortController = new AbortController();
    const preview = authFetch(`/api/pages2/${this.uri}/${pageNumber}/preview`, {
      signal: previewAbortController.signal,
    })
      .then((res) => res.arrayBuffer())
      .then((buf) => renderPdfPreview(buf));

    const dataAbortController = new AbortController();
    const data = authFetch(
      `/api/pages2/${this.uri}/${pageNumber}/text${
        this.query ? `?q=${this.query}` : ""
      }`,
      { signal: dataAbortController.signal }
    ).then((res) => res.json());

    return {
      previewAbortController,
      preview,
      dataAbortController,
      data,
    };
  };

  private onCacheEvict = (_: number, v: CachedPageData) => {
    v.previewAbortController.abort();
    v.dataAbortController.abort();
  };

  getPage = (pageNumber: number) => this.cache.get(pageNumber);
}
