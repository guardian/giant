import React, { FC, KeyboardEventHandler, useEffect, useState } from "react";
import styles from "./PageNavInput.module.css";
import { parsePageInput } from "./pageInput";

type PageNavInputProps = {
  // The page currently at the centre of the viewport.
  currentPage: number;
  totalPages: number;
  onJumpToPage: (page: number) => void;
};

// A footer control showing "Page [n] / total" for the combined page view.
// The number is an editable field: type a page and press Enter (or blur) to
// jump there. While not being edited it tracks the scroll position.
export const PageNavInput: FC<PageNavInputProps> = ({
  currentPage,
  totalPages,
  onJumpToPage,
}) => {
  const [value, setValue] = useState(String(currentPage));
  const [isFocused, setIsFocused] = useState(false);

  // Follow the scroll position while the field isn't being edited.
  useEffect(() => {
    if (!isFocused) {
      setValue(String(currentPage));
    }
  }, [currentPage, isFocused]);

  const commit = () => {
    const target = parsePageInput(value, totalPages);
    if (target === null) {
      // Unusable input (empty, non-numeric): revert to the current page.
      setValue(String(currentPage));
      return;
    }
    // Skip no-op jumps so simply focusing and blurring doesn't snap the
    // scroll to the top of the page you're already on.
    if (target !== currentPage) {
      onJumpToPage(target);
    }
    setValue(String(target));
  };

  const onKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setValue(String(currentPage));
      event.currentTarget.blur();
    }
  };

  return (
    <span className={styles.container}>
      <span className={styles.label}>Page</span>
      <input
        className={styles.input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label="Current page, type a number to jump"
        value={value}
        onFocus={() => {
          // Clear the field so typing replaces the page number rather than
          // inserting alongside it. (Selecting the text instead is fragile:
          // the mouseup after a click deselects it.) An empty field on blur
          // reverts to the current page via commit().
          setIsFocused(true);
          setValue("");
        }}
        onBlur={() => {
          setIsFocused(false);
          commit();
        }}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
        onKeyDown={onKeyDown}
      />
      <span
        className={styles.total}
        title="Total number of pages in the document. This may not match the page numbers printed on the pages (e.g. when a document has introductory pages before page 1)."
      >
        / {totalPages}
      </span>
    </span>
  );
};
