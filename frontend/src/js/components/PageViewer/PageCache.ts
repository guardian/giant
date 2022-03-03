import authFetch from "../../util/auth/authFetch";
import { CachedPreview, Page } from "./model";
import { renderPdfPreview } from "./PdfHelpers";

export class PageCache {
  uri: string;

  static MAX_CACHED_PAGES = 100;

  // Tracking of text (Page}) and rendered previews (HTMLCanvasElement) is handled seperately incase an
  // eviction happens to an item that is in flight
  previews: CachedPreview[] = [];
  cachedPreviewsLru: number[] = [];

  pages: Page[] = [];
  cachedPagesLru: number[] = [];

  constructor(uri: string) {
    this.uri = uri;
  }

  //////////////
  // Previews //
  //////////////

  private addToPreviewCache = (pageNumber: number, canvas: CachedPreview) => {
    this.previews[pageNumber] = canvas;
    this.cachedPreviewsLru.push(pageNumber);
    if (this.cachedPreviewsLru.length > PageCache.MAX_CACHED_PAGES) {
      const lruPageNumber = this.cachedPreviewsLru.shift();
      if (lruPageNumber) {
        delete this.previews[lruPageNumber];
      }
    }
  };

  private bumpPreviewRecency = (pageNumber: number) => {
    const index = this.cachedPreviewsLru.findIndex((pn) => pn === pageNumber);
    this.cachedPreviewsLru.splice(index, 1);
    this.cachedPreviewsLru.push(pageNumber);
  };

  // Get a cached canvas with the page rendered into it
  getPagePreview = async (pageNumber: number): Promise<CachedPreview> => {
    if (this.previews[pageNumber]) {
      this.bumpPreviewRecency(pageNumber);

      return Promise.resolve(this.previews[pageNumber]);
    } else {
      const response = await authFetch(
        `/api/pages2/${this.uri}/${pageNumber}/preview`
      );
      const buffer = await response.arrayBuffer();

      const preview = await renderPdfPreview(buffer);

      this.addToPreviewCache(pageNumber, preview);

      return preview;
    }
  };

  ///////////////
  // Page text //
  ///////////////

  private addToPageCache = (pageNumber: number, page: Page) => {
    this.pages[pageNumber] = page;
    this.cachedPagesLru.push(pageNumber);
    if (this.cachedPagesLru.length > PageCache.MAX_CACHED_PAGES) {
      const lruPageNumber = this.cachedPagesLru.shift();
      if (lruPageNumber) {
        delete this.pages[lruPageNumber];
      }
    }
  };

  private bumpPageRecency = (pageNumber: number) => {
    const index = this.cachedPagesLru.findIndex((pn) => pn === pageNumber);
    this.cachedPagesLru.splice(index, 1);
    this.cachedPagesLru.push(pageNumber);
  };

  getPageText = async (pageNumber: number, query?: string): Promise<Page> => {
    if (this.previews[pageNumber]) {
      this.bumpPageRecency(pageNumber);
      return Promise.resolve(this.pages[pageNumber]);
    } else {
      const response = await authFetch(
        `/api/pages2/${this.uri}/${pageNumber}/text${
          query ? `?q=${query}` : ""
        }`
      );

      const json = await response.json();
      this.addToPageCache(pageNumber, json);
      return json;
    }
  };
}
