import React, { CSSProperties, FC } from "react";
import { Highlight } from "./model";
import styles from "./PageHighlight.module.css";

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

  const isFind = type === "FindHighlight";
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

        const classes = [
          styles.highlight,
          ...(focused ? ["pfi-page-highlight--focused"] : []),
          ...(isFind ? [styles.findHighlight] : [styles.searchHighlight]),
        ];

        return (
          <span
            className={classes.join(" ")}
            key={`${id}-${i}`}
            style={style}
          />
        );
      })}
    </>
  );
};
