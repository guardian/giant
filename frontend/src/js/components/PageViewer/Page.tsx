import React, { FC, useCallback, useState } from "react";
import { Page as PageData } from "./model";
import { PageHighlight } from "./PageHighlight";
import styles from "./Page.module.css";
import { ptsToPx } from "../viewer/PageViewer/pageViewerApi";
import { Preview } from "./PageCache";

type PageProps = {
  // Pass in funcitons here so the page can handle the life cycle of it's own elements
  getPagePreview: () => Promise<Preview>;
  getPageText: () => Promise<PageData>;
};

export const Page: FC<PageProps> = ({ getPagePreview, getPageText }) => {
  const [pageText, setPageText] = useState<PageData | null>(null);
  const [scale, setScale] = useState<number | null>(null);

  const mountCanvas = useCallback((pageRef) => {
    getPagePreview().then((preview) => {
      setScale(preview.scale);
      pageRef?.appendChild(preview.canvas);
    });

    getPageText().then(setPageText);
  }, []);

  return (
    <div ref={mountCanvas} className={styles.container}>
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
