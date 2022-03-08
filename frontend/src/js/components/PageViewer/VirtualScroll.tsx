import _ from "lodash";
import React, { FC, ReactNode, useLayoutEffect, useRef, useState } from "react";
import { CONTAINER_AND_MARGIN_SIZE } from "./model";
import styles from "./VirtualScroll.module.css";

type VirtualScrollProps = {
  totalPages: number;
  initialPage?: number;
  renderPage: (pageNumber: number) => ReactNode;
};

export const VirtualScroll: FC<VirtualScrollProps> = ({
  totalPages,
  initialPage,
  renderPage,
}) => {
  // Tweaked this and 2 seems to be a good amount on a regular monitor
  // The fewer pages we preload the faster the initial paint will be
  // Could possibly make it dynamic based on the visible of the container
  const PRELOAD_PAGES = 2;

  const pageHeight = CONTAINER_AND_MARGIN_SIZE;

  const viewport = useRef<HTMLDivElement>(null);

  const [topPage, setTopPage] = useState(1);
  //const [midPage, setMidPage] = useState(1); // Todo hook up to URL
  const [botPage, setBotPage] = useState(1 + PRELOAD_PAGES);

  const onScroll = () => {
    if (viewport?.current) {
      const v = viewport.current;

      const currentMid = v.scrollTop + v.clientHeight / 2;

      const topEdge = currentMid - PRELOAD_PAGES * pageHeight;
      const botEdge = currentMid + PRELOAD_PAGES * pageHeight;

      const topPage = Math.max(Math.floor(topEdge / pageHeight), 1);
      //const midPage = Math.floor(currentMid / pageHeight);
      const botPage = Math.min(Math.ceil(botEdge / pageHeight), totalPages);

      setTopPage(topPage);
      //setMidPage(midPage);
      setBotPage(botPage);
    }
  };

  useLayoutEffect(() => {
    if (viewport?.current && initialPage) {
      const v = viewport.current;

      const scrollTo = (initialPage - 1) * pageHeight;

      v.scrollTop = scrollTo;
    }
  }, [viewport, initialPage, pageHeight]);

  return (
    <div ref={viewport} className={styles.scrollContainer} onScroll={onScroll}>
      <div className={styles.pages} style={{ height: totalPages * pageHeight }}>
        {_.range(topPage, botPage + 1)
          .filter((pageNumber) => pageNumber > 0 && pageNumber <= totalPages)
          .map((pageNumber) => (
            <div
              key={pageNumber}
              style={{ top: (pageNumber - 1) * pageHeight }}
              className={styles.pageContainer}
            >
              {renderPage(pageNumber)}
            </div>
          ))}
      </div>
    </div>
  );
};
