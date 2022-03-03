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
      const v = viewport.current!;

      const scrollTo =
        initialPage != 1 ? initialPage * pageHeight - v.clientHeight / 2 : 0;

      v.scrollTop = scrollTo;
    }
  }, [viewport, initialPage, pageHeight]);

  return (
    <div ref={viewport} className="viewer__main" onScroll={onScroll}>
      <div
        className={styles.scrollArea}
        style={{ height: totalPages * pageHeight }}
      >
        <div className={styles.pages}>
          {_.range(topPage, botPage + 1)
            .filter((p) => p > 0 && p <= totalPages)
            .map((p) => (
              <div
                key={p}
                style={{ top: (p - 1) * pageHeight }}
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
