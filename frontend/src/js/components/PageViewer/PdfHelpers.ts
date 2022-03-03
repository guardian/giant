import * as pdfjs from "pdfjs-dist";
import { CachedPreview, CONTAINER_SIZE, PdfText } from "./model";

export const renderPdfPreview = async (
  buffer: ArrayBuffer
): Promise<CachedPreview> => {
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

  return { pdfPage, canvas, scale };
};

export const renderTextOverlays = async (
  preview: CachedPreview
): Promise<PdfText[]> => {
  const { pdfPage, scale } = preview;

  const textContentStream = pdfPage.streamTextContent({
    normalizeWhitespace: true,
    disableCombineTextItems: false,
  });

  const textDivs: HTMLDivElement[] = [];
  const textContentItemsStr: string[] = [];
  const viewport = pdfPage.getViewport({ scale });

  await pdfjs.renderTextLayer({
    textContentStream,
    container: document.createElement("div"),
    viewport,
    textDivs,
    enhanceTextSelection: true,
    textContentItemsStr,
  }).promise;

  return textDivs.flatMap((textDiv) => {
    return [
      {
        value: textDiv.innerHTML,
        left: textDiv.style.left,
        top: textDiv.style.top,
        fontSize: textDiv.style.fontSize,
        fontFamily: textDiv.style.fontFamily,
        transform: textDiv.style.transform,
      },
    ];
  });
};
