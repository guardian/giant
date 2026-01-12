import React, { useCallback, useEffect, useState } from "react";
import { Page } from "../../../reducers/pagesReducer";
import { fetchPagePreview } from "./pageViewerApi";
import {
  parsePDF,
  PDFText,
  rasterisePage,
  renderPDFText,
} from "./pageViewerPdf";
import { PDFPageProxy } from "pdfjs-dist";

type Props = {
  page: Page;
  uri: string;
  // TODO: factor out duplicated functions signature
  onHighlightMount: (id: string, top: number, elem: HTMLElement) => void;
  currentHighlightId?: string;
  q?: string;
};

// TODO: just share if identical when the dust settles?
type PageHighlightWrapperProps = {
  highlightId: string;
  text: string;
  focused: boolean;
  // TODO: factor out duplicated functions signature
  onHighlightMount: (id: string, top: number, elem: HTMLElement) => void;
  style?: React.CSSProperties;
};

function PageHighlightWrapper({
  highlightId,
  text,
  focused,
  onHighlightMount,
  style,
}: PageHighlightWrapperProps) {
  const [top, setTop] = useState<number | undefined>();

  function onMountOrUnmount(elem: HTMLSpanElement | null) {
    if (elem) {
      // TODO: will we hit this loop without guard?
      // IMPORTANT: this guard avoids infinite loops
      // The ref is mounted, we then setHighlightRenderedPosition which causes another render
      // and another call infinitely, unless we check that the position has not changed.
      if (elem.offsetTop !== top) {
        onHighlightMount(highlightId, elem.offsetTop, elem);
      }

      setTop(elem.offsetTop);
    }
  }

  return (
    <span
      className={
        focused
          ? `pfi-page-highlight pfi-page-highlight--focused`
          : "pfi-page-highlight"
      }
      ref={onMountOrUnmount}
      key={highlightId}
      style={style}
    >
      {text}
    </span>
  );
}

export function PagePreview({
  uri,
  page,
  onHighlightMount,
  currentHighlightId,
  q,
}: Props) {
  const [pdfPage, setPdfPage] = useState<PDFPageProxy | undefined>(undefined);
  const [text, setText] = useState<PDFText[]>([]);
  const { width: pageWidth, height: pageHeight } = page.dimensions;

  const canvasRef = useCallback(
    async (canvasEl) => {
      if (canvasEl && pdfPage) {
        // If pdf.js gets called twice with the same canvas element, it throws an error:
        // https://github.com/mozilla/pdf.js/blob/d3f7959689b9ccd9b292ccebf73377370c64268a/src/display/api.js#L2867-L2871
        //
        // here's the PR where that logic was introduced (2017):
        // mozilla/pdf.js#8519
        //
        // here are some issues related to it:
        // mozilla/pdf.js#9456 (opened Feb 2018, closed Oct 2018)
        // mozilla/pdf.js#10018 (opened Aug 2018, still open)
        //
        // So, force a fresh canvas before calling rasterisePage.
        // Use cloneNode() to preserve the width & height attributes set on the canvas by React.
        const newCanvasEl = canvasEl.cloneNode();
        canvasEl.replaceWith(newCanvasEl);
        await rasterisePage(newCanvasEl, pdfPage, pageWidth, pageHeight);
      }
    },
    [pdfPage, pageWidth, pageHeight],
  );

  // I suspect the fact that this useEffect has so many deps is a sign that
  // this data fetching should be done in the parent component.
  // PagePreview could just accept the pdfPage.
  //
  // Interesting prior art for data fetching with hooks:
  // https://www.robinwieruch.de/react-hooks-fetch-data
  // https://codesandbox.io/s/jvvkoo8pq3?file=/src/index.js:513-518
  //
  // And someday soon this might make it all saner:
  // https://reactjs.org/docs/concurrent-mode-suspense.html
  useEffect(() => {
    // TODO MRB: handle errors
    (async function () {
      const pdfPage = await fetchPagePreview(
        page.currentLanguage,
        uri,
        page.page,
        q,
      ).then(parsePDF);
      setPdfPage(pdfPage);

      const text = await renderPDFText(pdfPage, pageWidth, pageHeight);
      setText(text);
    })();
  }, [page.currentLanguage, uri, page.page, pageWidth, pageHeight, q]);

  const style = {
    width: pageWidth,
    height: pageHeight,
    top: page.dimensions.top,
  };

  // TODO MRB: just use the text divs created by PDF.js directly via dangerouslySetInnerHTML?
  const textElements = text.map(
    ({ value, left, top, fontSize, fontFamily, transform }, ix) => {
      return (
        <div
          key={ix}
          className="pfi-page__pdf-text"
          style={{ left, top, fontSize, fontFamily, transform }}
        >
          {value}
        </div>
      );
    },
  );

  const highlightElements = page.highlights.flatMap((highlight) => {
    switch (highlight.type) {
      case "SearchHighlight":
        return highlight.data.map((highlightSpan) => (
          <PageHighlightWrapper
            key={highlight.id}
            highlightId={highlight.id}
            text={""}
            focused={highlight.id === currentHighlightId}
            onHighlightMount={onHighlightMount}
            style={{
              display: "block",
              position: "absolute",
              left: highlightSpan.x,
              top: highlightSpan.y,
              width: highlightSpan.width,
              height: highlightSpan.height,
              transformOrigin: "top left",
              transform: `rotate(${highlightSpan.rotation}rad)`,
              pointerEvents: "none",
            }}
          />
        ));

      // Without this ESLint complains about not returning a value from the arrow function,
      // presumably because it doesn't understand my switch is exhaustive (does TS even do that?)
      default:
        return [];
    }
  });

  return (
    <div className="pfi-page" style={style}>
      <canvas ref={canvasRef} width={pageWidth} height={pageHeight} />
      {textElements}
      {highlightElements}
    </div>
  );
}
