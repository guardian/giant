
// PDFjs has webpack config built-in but it uses worker-loader which seems
// to break automatic reloading in dev in our Create React App project.
// My solution is to symlink the worker js file into our existing 3rd party
// directory in the backend and reference it directly.
import {getDocument, GlobalWorkerOptions, PageViewport, PDFPageProxy, renderTextLayer} from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = '/third-party/pdf.worker.min.js';

function getViewport(page: PDFPageProxy, pageWidth: number, pageHeight: number): PageViewport {
    // See https://github.com/mozilla/pdf.js/blob/4a74cc418ccb0b14dbbb50e0b964f32a41d16647/web/pdf_viewer.js#L531
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const isLandscape = unscaledViewport.width > unscaledViewport.height;

    const widthScale = pageWidth / unscaledViewport.width;
    const heightScale = pageHeight / unscaledViewport.height;

    const scale = isLandscape ? Math.min(widthScale, heightScale) : widthScale
    const viewport = page.getViewport({ scale });

    return viewport;
}

export async function parsePDF(buffer: ArrayBuffer): Promise<PDFPageProxy> {
    const doc = await getDocument(new Uint8Array(buffer)).promise;
    const page = await doc.getPage(1);

    return page;
}

export async function rasterisePage(canvas: HTMLCanvasElement, page: PDFPageProxy, pageWidth: number, pageHeight: number): Promise<void> {
    const canvasContext = canvas.getContext("2d")!;
    const viewport = getViewport(page, pageWidth, pageHeight);

    await page.render({ canvasContext, viewport }).promise;
}

export type PDFText = {
    value: string,
    left: string,
    top: string,
    fontSize: string,
    fontFamily: string,
    transform: string
}

export async function renderPDFText(pdfJsPage: PDFPageProxy, pageWidth: number, pageHeight: number): Promise<PDFText[]> {
    const viewport = getViewport(pdfJsPage, pageWidth, pageHeight);

    const textContentSource = pdfJsPage.streamTextContent();
    const textDivs: HTMLDivElement[] = [];
    const textContentItemsStr: string[] = [];

    await renderTextLayer({
        textContentSource,
        container: document.createElement("div"),
        viewport,
        textDivs,
        textContentItemsStr
    }).promise;

    console.log('========= pdf.js textContentItemsStr =======');
    console.log('to get into clipboard:');
    console.log('1. right-click, store as global variable');
    console.log('2. copy(JSON.stringify(temp1))');
    console.log(textContentItemsStr);

    console.log('========= pdf.js textDivs =======');
    console.log('to get into clipboard:');
    console.log('1. right-click, store as global variable');
    console.log('2. copy(JSON.stringify(temp1))');
    console.log(textDivs.map(el => el.innerHTML));

    return textDivs.flatMap(textDiv => {
        return [{
            value: textDiv.innerHTML,
            left: textDiv.style.left,
            top: textDiv.style.top,
            fontSize: textDiv.style.fontSize,
            fontFamily: textDiv.style.fontFamily,
            transform: textDiv.style.transform
        }];
    });
}
