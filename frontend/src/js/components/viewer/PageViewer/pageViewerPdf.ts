import {
  getDocument,
  GlobalWorkerOptions,
  PageViewport,
  PDFPageProxy,
  TextLayer,
} from "pdfjs-dist";

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function getViewport(
  page: PDFPageProxy,
  pageWidth: number,
  pageHeight: number,
): PageViewport {
  // See https://github.com/mozilla/pdf.js/blob/4a74cc418ccb0b14dbbb50e0b964f32a41d16647/web/pdf_viewer.js#L531
  const unscaledViewport = page.getViewport({ scale: 1.0 });
  const isLandscape = unscaledViewport.width > unscaledViewport.height;

  const widthScale = pageWidth / unscaledViewport.width;
  const heightScale = pageHeight / unscaledViewport.height;

  const scale = isLandscape ? Math.min(widthScale, heightScale) : widthScale;
  const viewport = page.getViewport({ scale });

  return viewport;
}

export async function parsePDF(buffer: ArrayBuffer): Promise<PDFPageProxy> {
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    wasmUrl: "/pdfjs/wasm/",
  }).promise;
  const page = await doc.getPage(1);

  return page;
}

export async function rasterisePage(
  canvas: HTMLCanvasElement,
  page: PDFPageProxy,
  pageWidth: number,
  pageHeight: number,
): Promise<void> {
  const canvasContext = canvas.getContext("2d")!;
  const viewport = getViewport(page, pageWidth, pageHeight);

  await page.render({ canvas, canvasContext, viewport }).promise;
}

export type PDFText = {
  value: string;
  left: string;
  top: string;
  fontSize: string;
  fontFamily: string;
  transform: string;
};

export async function renderPDFText(
  pdfJsPage: PDFPageProxy,
  pageWidth: number,
  pageHeight: number,
): Promise<PDFText[]> {
  const viewport = getViewport(pdfJsPage, pageWidth, pageHeight);

  const textContentSource = pdfJsPage.streamTextContent();

  const textLayer = new TextLayer({
    textContentSource,
    container: document.createElement("div"),
    viewport,
  });
  await textLayer.render();
  const { textDivs, textContentItemsStr } = textLayer;

  console.log("========= pdf.js textContentItemsStr =======");
  console.log("to get into clipboard:");
  console.log("1. right-click, store as global variable");
  console.log("2. copy(JSON.stringify(temp1))");
  console.log(textContentItemsStr);

  console.log("========= pdf.js textDivs =======");
  console.log("to get into clipboard:");
  console.log("1. right-click, store as global variable");
  console.log("2. copy(JSON.stringify(temp1))");
  console.log(textDivs.map((el) => el.innerHTML));

  return textDivs.flatMap((textDiv) => {
    return [
      {
        value: textDiv.textContent ?? "",
        left: textDiv.style.left,
        top: textDiv.style.top,
        // TextLayer stores layout values in CSS variables.
        fontSize: `${parseFloat(textDiv.style.getPropertyValue("--font-height")) * viewport.scale}px`,
        fontFamily: textDiv.style.fontFamily,
        transform: `rotate(${textDiv.style.getPropertyValue("--rotate") || "0deg"}) scaleX(${textDiv.style.getPropertyValue("--scale-x") || "1"})`,
      },
    ];
  });
}
