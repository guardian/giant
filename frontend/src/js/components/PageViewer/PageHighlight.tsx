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

  const color = type === "SearchResultPageHighlight" ? "blue" : "yellow";
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
          background: color,
        };

        return (
          <span
            className={
              focused
                ? `pfi-page-highlight pfi-page-highlight--focused`
                : "pfi-page-highlight"
            }
            key={`${id}-${i}`}
            style={style}
          />
        );
      })}
    </>
  );
};
