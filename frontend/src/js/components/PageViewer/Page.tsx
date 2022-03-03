import React, { FC, useCallback, useState } from "react";
import { CachedPreview, Page as PageData, PdfText } from "./model";
import styles from "./Page.module.css";
import { PageHighlight } from "./PageHighlight";
import { PageOverlayText } from "./PageOverlayText";
import { renderTextOverlays } from "./PdfHelpers";

type PageProps = {
  // Pass in funcitons here so the page can handle the life cycle of it's own elements
  getPagePreview: () => Promise<CachedPreview>;
  getPageText: () => Promise<PageData>;
};

export const Page: FC<PageProps> = ({ getPagePreview, getPageText }) => {
  const [pageText, setPageText] = useState<PageData | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [textOverlays, setTextOverlays] = useState<PdfText[] | null>(null);

  const mountCanvas = useCallback((pageRef) => {
    getPagePreview()
      .then((preview) => {
        setScale(preview.scale);
        pageRef?.appendChild(preview.canvas);
        return preview;
      })
      .then((preview) => {
        // Begin rendering the text overlays after the PDF rendered to the DOM
        renderTextOverlays(preview).then(setTextOverlays);
      });

    getPageText().then(setPageText);
  }, []);

  return (
    <div ref={mountCanvas} className={styles.container}>
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
