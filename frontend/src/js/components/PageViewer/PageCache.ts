import _ from "lodash";
import authFetch from "../../util/auth/authFetch";
import * as pdfjs from "pdfjs-dist";
import { CONTAINER_SIZE, Page } from "./model";

export type Preview = {
  canvas: HTMLCanvasElement;
  scale: number;
};
export class PageCache {
  uri: string;

  static MAX_CACHED_PAGES = 100;

  // Tracking of text (Page}) and rendered previews (HTMLCanvasElement) is handled seperately incase an
  // eviction happens to an item that is in flight
  previews: Preview[] = [];
  cachedPreviewsLru: number[] = [];

  pages: Page[] = [];
  cachedPagesLru: number[] = [];

  constructor(uri: string) {
    this.uri = uri;
  }

  //////////////
  // Previews //
  //////////////

  private addToPreviewCache = (pageNumber: number, canvas: Preview) => {
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
  getPagePreview = async (pageNumber: number): Promise<Preview> => {
    if (this.previews[pageNumber]) {
      this.bumpPreviewRecency(pageNumber);

      return Promise.resolve(this.previews[pageNumber]);
    } else {
      const response = await authFetch(
        `/api/pages2/${this.uri}/${pageNumber}/preview`
      );
      const buffer = await response.arrayBuffer();

      const doc = await pdfjs.getDocument(new Uint8Array(buffer)).promise;
      const pdfPage = await doc.getPage(1);

      const canvas = document.createElement("canvas");
      const canvasContext = canvas.getContext("2d")!;

      // Scaling
      const unscaledViewport = pdfPage.getViewport({ scale: 1.0 });
      const isLandscape = unscaledViewport.width > unscaledViewport.height;

      const widthScale = CONTAINER_SIZE / unscaledViewport.width;
      const heightScale = CONTAINER_SIZE / unscaledViewport.height;

      const scale = isLandscape ? widthScale : heightScale;

      const viewport = pdfPage.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render
      await pdfPage.render({
        canvasContext,
        viewport,
      });

      // Handle caching
      const preview = { canvas, scale };

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
