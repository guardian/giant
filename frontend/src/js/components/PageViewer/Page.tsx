import React, { FC, useCallback, useState } from "react";
import { CachedPreview, PageData, PdfText } from "./model";
import styles from "./Page.module.css";
import { PageHighlight } from "./PageHighlight";
import { PageOverlayText } from "./PageOverlayText";
import { renderTextOverlays } from "./PdfHelpers";

type PageProps = {
  // Pass in funcitons here so the page can handle the life cycle of it's own elements
  getPagePreview: () => Promise<CachedPreview>;
  getPageData: () => Promise<PageData>;
};

export const Page: FC<PageProps> = ({ getPagePreview, getPageData }) => {
  const [pageText, setPageText] = useState<PageData | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [textOverlays, setTextOverlays] = useState<PdfText[] | null>(null);

  // If the
  const [aborted, setAborted] = useState(false);

  const handleAbort = (err: Error) => {
    if (err.name === "AbortError") {
      setAborted(true);
    }
  };

  const mountCanvas = useCallback(
    (pageRef) => {
      getPagePreview()
        .then((preview) => {
          setScale(preview.scale);
          pageRef?.appendChild(preview.canvas);
          return preview;
        })
        .then((preview) => {
          // Begin rendering the text overlays after the PDF rendered to the DOM
          renderTextOverlays(preview).then(setTextOverlays);
        })
        .catch(handleAbort);

      getPageData().then(setPageText).catch(handleAbort);
    },
    // TypeScript insists that the array be there but following exhaustive-deps lint suggestion breaks behaviour
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div ref={mountCanvas} className={styles.container}>
      {aborted && (
        <div>Page fetch was aborted. Try refreshing your browser.</div>
      )}
      {textOverlays &&
        textOverlays.map((to, i) => <PageOverlayText key={i} text={to} />)}
      {scale &&
        pageText &&
        pageText.highlights.map((hl) => (
          <PageHighlight
            key={hl.id}
            highlight={hl}
            focused={false}
            scale={scale}
          />
        ))}
    </div>
  );
};
