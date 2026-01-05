import React, { useState } from "react";
import { Highlight, ResourceRange } from "../../types/Resource";
import sortBy from "lodash/sortBy";

type FlattenAction =
  | { type: "delete" }
  | { type: "truncate"; range: ResourceRange };

function getFlattenAction(
  target: Highlight,
  highlights: Highlight[],
): FlattenAction {
  let startCharacter = target.range.startCharacter;
  let endCharacter = target.range.endCharacter;

  for (const highlight of highlights) {
    if (highlight !== target && highlight.type === "comment") {
      const startsInside =
        target.range.startCharacter >= highlight.range.startCharacter &&
        target.range.startCharacter <= highlight.range.endCharacter;

      const endsInside =
        target.range.endCharacter >= highlight.range.startCharacter &&
        target.range.endCharacter <= highlight.range.endCharacter;

      if (startsInside && endsInside) {
        return { type: "delete" };
      } else if (startsInside) {
        startCharacter = highlight.range.endCharacter;
      } else if (endsInside) {
        endCharacter = highlight.range.startCharacter;
      }
    }
  }

  return { type: "truncate", range: { startCharacter, endCharacter } };
}

// Highlights that overlap each other need special treatment because
// of the hierarchical nature of the DOM.
function separateOverlappingHighlights(highlights: Highlight[]): Highlight[] {
  let ret = [...highlights];

  for (const highlight of highlights) {
    if (highlight.type === "comment" && highlight.id === "new-comment") {
      // Ensure the highlighting for text we have just selected is not truncated
      continue;
    }

    // We need to pass the modified array
    const action = getFlattenAction(highlight, ret);

    switch (action.type) {
      case "delete":
        ret = ret.filter(({ id }) => id !== highlight.id);
        break;

      case "truncate":
        ret = ret.map((h) =>
          h.id === highlight.id ? { ...h, range: action.range } : h,
        );
        break;
    }
  }

  return ret;
}

type HighlightWrapperProps = {
  highlight: Highlight;
  text: string;
  focused: boolean;
  onHighlightMount: (id: string, top: number, elem: HTMLElement) => void;
  focusComment: (id: string) => void;
};

function HighlightWrapper({
  highlight,
  text,
  focused,
  onHighlightMount,
  focusComment,
}: HighlightWrapperProps) {
  const [top, setTop] = useState<number | undefined>();

  function onMountOrUnmount(elem: HTMLSpanElement | null) {
    if (elem) {
      // IMPORTANT: this guard avoids infinite loops
      // The ref is mounted, we then setHighlightRenderedPosition which causes another render
      // and another call infinitely, unless we check that the position has not changed.
      if (elem.offsetTop !== top) {
        onHighlightMount(highlight.id, elem.offsetTop, elem);
      }

      setTop(elem.offsetTop);
    }
  }

  const elementType =
    highlight.type === "comment" ? "comment-highlight" : "result-highlight";

  return React.createElement(
    elementType,
    {
      class: focused ? `${elementType}--focused` : "",
      "data-highlight-offset": highlight.range.startCharacter,
      ref: onMountOrUnmount,
      onClick: (e: React.MouseEvent) => {
        if (highlight.type === "comment") {
          e.stopPropagation();
          focusComment(highlight.id);
        }
      },
    },
    text.slice(highlight.range.startCharacter, highlight.range.endCharacter),
  );
}

type Props = {
  text: string;
  highlights: Highlight[];
  focusedId?: string;
  onHighlightMount: (id: string, top: number, elem: HTMLElement) => void;
  focusComment: (id: string) => void;
};

export function CommentHighlighter({
  text,
  highlights,
  focusedId,
  onHighlightMount,
  focusComment,
}: Props) {
  const sorted = sortBy(
    highlights,
    ({ range: { startCharacter } }) => startCharacter,
  );
  const flattened = separateOverlappingHighlights(sorted);

  const [end, children] = flattened.reduce(
    ([ptr, acc], highlight) => {
      const before = (
        <span key={`pre-${highlight.id}`} data-highlight-offset={ptr}>
          {text.slice(ptr, highlight.range.startCharacter)}
        </span>
      );

      const inside = (
        <HighlightWrapper
          key={highlight.id}
          highlight={highlight}
          text={text}
          focused={highlight.id === focusedId}
          onHighlightMount={onHighlightMount}
          focusComment={focusComment}
        />
      );

      return [highlight.range.endCharacter, [...acc, before, inside]];
    },
    [0, [] as React.ReactElement[]],
  );

  if (end < text.length) {
    children.push(
      <span key="catch-all" data-highlight-offset={end}>
        {text.slice(end, text.length)}
      </span>,
    );
  }

  return <span className="comment__text">{children}</span>;
}
