import React, { CSSProperties, FC } from "react";
import { Highlight } from "./model";

type PageHighlightProps = {
  highlight: Highlight;
  focused: boolean;
  scale: number;
};

export const PageHighlight: FC<PageHighlightProps> = ({
  highlight,
  focused,
  scale,
}) => {
  const { id, type } = highlight;
  const onMountOrUnmount = () => {};

  switch (type) {
    case "SearchResultPageHighlight":
      return (
        <>
          {highlight.data.map((span, i) => {
            const style: CSSProperties = {
              position: "absolute",
              left: span.x * scale,
              top: span.y * scale,
              width: span.width * scale,
              height: span.height * scale,
              transformOrigin: "top left",
              transform: `rotate(${span.rotation}rad)`,
              pointerEvents: "none",
            };

            return (
              <span
                className={
                  focused
                    ? `pfi-page-highlight pfi-page-highlight--focused`
                    : "pfi-page-highlight"
                }
                ref={onMountOrUnmount}
                key={`${id}-${i}`}
                style={style}
              />
            );
          })}
        </>
      );
    default:
      return null;
  }
};
