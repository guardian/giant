import _ from "lodash";
import React, { FC, ReactNode, useRef, useState } from "react";
import styles from "./VirtualScroll.module.css";

type VirtualScrollProps = {
    totalPages: number;
    renderPage: (pageNumber: number) => ReactNode,
}

export const VirtualScroll: FC<VirtualScrollProps> = ({totalPages, renderPage}) => {
  const PRELOAD_PAGES = 3;

  const pageHeight = 400;

  const viewport = useRef<HTMLDivElement>(null);

  const [topPage, setTopPage] = useState(1 - PRELOAD_PAGES);
  const [midPage, setMidPage] = useState(1); // TODO - hook up to URL
  const [botPage, setBotPage] = useState(1 + PRELOAD_PAGES);

  const onScroll = () => {
    if (viewport?.current) {
      const v = viewport.current;

      const currentMid = v.scrollTop + v.clientHeight / 2;
      const topEdge = currentMid - PRELOAD_PAGES * pageHeight;
      const botEdge = currentMid + PRELOAD_PAGES * pageHeight;

      const topPage = Math.floor(topEdge / pageHeight);
      const midPage = Math.floor(currentMid / pageHeight);
      const botPage = Math.ceil(botEdge / pageHeight);

      setTopPage(topPage);
      setMidPage(midPage);
      setBotPage(botPage);
    }
  };

  return (
    <div ref={viewport} className="viewer__main" onScroll={onScroll}>
      <div
        className={styles.scrollArea}
        style={{ height: totalPages * pageHeight }}
      >
        <div className={styles.pages}>
          {_.range(topPage, botPage).map((p) => (
            <div
                key={p}
              style={{ top: p * pageHeight }}
              className={styles.container}
            >
            {renderPage(p)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
