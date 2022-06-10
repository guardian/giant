import React, { CSSProperties, FC, useEffect, useRef } from 'react';
import { Highlight } from "./model";
import styles from "./PageHighlight.module.css";

type PageHighlightProps = {
  highlight: Highlight;
  isFocused: boolean;
  scale: number;
};

export const PageHighlight: FC<PageHighlightProps> = ({
  highlight,
  isFocused,
  scale,
}) => {
  const { id, type } = highlight;
  const highlightRef = useRef<HTMLSpanElement>(null);
  const isFind = type === "FindHighlight";

  useEffect(() => {
    if (isFocused && highlightRef.current) {
      highlightRef.current.scrollIntoView({inline: "center", block: "center"});
    }
  }, [isFocused]);

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
          ...(isFocused ? [styles.focusedHighlight] : []),
          ...(isFind ? [styles.findHighlight] : [styles.searchHighlight]),
        ];

        return (
          <span
            ref={highlightRef}
            id={id}
            className={classes.join(" ")}
            key={`${id}-${i}`}
            style={style}
          />
        );
      })}
    </>
  );
};
