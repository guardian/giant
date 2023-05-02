
import { CachedPreview, CONTAINER_SIZE, PdfText } from "./model";
import {getDocument, GlobalWorkerOptions, PDFWorker, renderTextLayer} from "pdfjs-dist";

// PDFjs has webpack config built-in but it uses worker-loader which seems
// to break automatic reloading in dev in our Create React App project.
// My solution is to symlink the worker js file into our existing 3rd party
// directory in the backend and reference it directly.
GlobalWorkerOptions.workerSrc = '/third-party/pdf.worker.min.js';
export const renderPdfPreview = async (
  buffer: ArrayBuffer,
  pdfWorker: PDFWorker
): Promise<CachedPreview> => {
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    // Use the same web worker for all pages
    worker: pdfWorker
  }).promise;

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

  return { pdfPage, canvas, scale };
};

export const renderTextOverlays = async (
  preview: CachedPreview
): Promise<PdfText[]> => {
  const { pdfPage, scale } = preview;

  const textContentStream = pdfPage.streamTextContent({
    disableCombineTextItems: false,
  });

  const textDivs: HTMLDivElement[] = [];
  const textContentItemsStr: string[] = [];
  const viewport = pdfPage.getViewport({ scale });

  await renderTextLayer({
    textContentStream,
    container: document.createElement("div"),
    viewport,
    textDivs,
    textContentItemsStr,
  }).promise;

  return textDivs.map((textDiv) => ({
    value: textDiv.innerHTML,
    left: textDiv.style.left,
    top: textDiv.style.top,
    fontSize: textDiv.style.fontSize,
    fontFamily: textDiv.style.fontFamily,
    transform: textDiv.style.transform,
  }));
};
