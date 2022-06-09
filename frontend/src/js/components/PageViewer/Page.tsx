import React, { FC, useEffect, useRef, useState } from "react";
import { CachedPreview, PageData, PdfText } from "./model";
import styles from "./Page.module.css";
import { PageHighlight } from "./PageHighlight";
import { PageOverlayText } from "./PageOverlayText";
import { renderTextOverlays } from "./PdfHelpers";

type PageProps = {
  pageNumber: number;
  getPagePreview: Promise<CachedPreview>;
  getPageData: Promise<PageData>;
  currentFindHighlight: string | null;
};

export const Page: FC<PageProps> = ({
  pageNumber,
  getPagePreview,
  getPageData,
                                      currentFindHighlight,
}) => {
  const [pageText, setPageText] = useState<PageData | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [textOverlays, setTextOverlays] = useState<PdfText[] | null>(null);

  const [previewMounted, setPreviewMounted] = useState(false);
  const [aborted, setAborted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleAbort = (err: Error) => {
    if (err.name === "AbortError") {
      // If our fetch request gets aborted due to a cache eviction then
      // we want to show some info to the user saying why the page isn't rendering.
      //
      // Since the cache is an LRU we should never get an eviction on a visible page.
      setAborted(true);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      getPagePreview
        .then((preview) => {
          // Have to recheck here because the component may have dismounted
          const node = containerRef.current;
          if (node) {
            setScale(preview.scale);
            node.appendChild(preview.canvas);
          }
          setPreviewMounted(true);
          return preview;
        })
        .then((preview) => {
          // Begin rendering the text overlays after the PDF rendered to the DOM
          renderTextOverlays(preview).then(setTextOverlays);
        })
        .catch(handleAbort);
    }
  }, [getPagePreview]);

  useEffect(() => {
    getPageData.then(setPageText).catch(handleAbort);
  }, [containerRef, getPageData]);

  return (
    <div ref={containerRef} className={styles.container}>
      {aborted && !previewMounted && (
        <div>
          The request for this page has been aborted. If you're seeing this
          message please contact your administrator
        </div>
      )}
      {textOverlays &&
        textOverlays.map((to, i) => <PageOverlayText key={i} text={to} />)}
      {scale &&
        pageText &&
        pageText.highlights.map((hl) => (
          <PageHighlight
            key={hl.id}
            highlight={hl}
            focused={currentFindHighlight === hl.id}
            scale={scale}
          />
        ))}
    </div>
  );
};
