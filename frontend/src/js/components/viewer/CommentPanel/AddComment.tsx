import React, { useState, useRef, useEffect } from "react";

type Props = {
  sendingComment: boolean;
  numberOfComments: number;
  top?: number;
  onSubmit: (comment: string) => void;
  onCancel: () => void;
};

export function AddComment({
  sendingComment,
  numberOfComments,
  top,
  onSubmit,
  onCancel,
}: Props) {
  const [comment, setComment] = useState("");
  const [addedNewLine, setAddedNewLine] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Put the cursor in the text so you can start typing
    if (textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }

    // If this is the first comment then the UI will re-arrange to accomodate the comment panel
    // gutter. Scroll the dialog into view to avoid the user becoming disorientated and having
    // to find it off-screen themselves.
    if (numberOfComments === 0 && top !== undefined) {
      if (textareaRef.current) {
        textareaRef.current.scrollIntoView({ block: "center" });
      }
    }
  }, [numberOfComments, top]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "Enter" && !addedNewLine) {
      if (e.shiftKey) {
        setAddedNewLine(true);
      } else {
        e.preventDefault();
        onSubmit(comment);
      }
    }
  }

  const style = {
    // Only show once the highlight we are attached to has displayed in the DOM
    display: top === undefined ? "none" : "block",
    zIndex: numberOfComments,
    top,
  };

  return (
    <div className="comment comment--add" style={style}>
      <textarea
        rows={3}
        placeholder="Add a comment"
        value={comment}
        onKeyDown={onKeyDown}
        onChange={(e) => setComment(e.target.value)}
        ref={textareaRef}
      />
      <span className="textpopover__action textpopover__button">
        <input
          type="submit"
          className="btn"
          disabled={comment.length === 0 || sendingComment}
          value="Comment"
          onClick={() => onSubmit(comment)}
        />
      </span>
      <span className="textpopover__action textpopover__button">
        <input
          type="button"
          className="btn"
          disabled={sendingComment}
          value="Cancel"
          onClick={onCancel}
        />
      </span>
    </div>
  );
}
