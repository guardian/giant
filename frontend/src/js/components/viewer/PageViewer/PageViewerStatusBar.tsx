import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { MdArrowDownward } from "react-icons/md";
import { MdNavigateBefore } from "react-icons/md";
import { MdNavigateNext } from "react-icons/md";
import { MdArrowUpward } from "react-icons/md";
import { keyboardShortcuts } from "../../../util/keyboardShortcuts";
import { KeyboardShortcut } from "../../UtilComponents/KeyboardShortcut";
import { navigateToHighlight } from "../../../actions/pages/navigateToHighlight";
import { GiantState, PagesState } from "../../../types/redux/GiantState";
import { GiantDispatch } from "../../../types/redux/GiantDispatch";

export default function PageViewerStatusBar({
  previousDocumentFn,
  nextDocumentFn,
}: {
  previousDocumentFn: (() => void) | undefined;
  nextDocumentFn: (() => void) | undefined;
}) {
  const dispatch: GiantDispatch = useDispatch();
  const pages = useSelector<GiantState, PagesState>(({ pages }) => pages);

  function previousHighlight() {
    dispatch(navigateToHighlight(pages, "previous"));
  }

  function nextHighlight() {
    dispatch(navigateToHighlight(pages, "next"));
  }

  const showPreviousNextDocumentButtons =
    previousDocumentFn !== undefined || nextDocumentFn !== undefined;

  return (
    <div className="document__status">
      <KeyboardShortcut
        shortcut={keyboardShortcuts.previousHighlight}
        func={previousHighlight}
      />
      <KeyboardShortcut
        shortcut={keyboardShortcuts.nextHighlight}
        func={nextHighlight}
      />

      {showPreviousNextDocumentButtons ? (
        <button
          className="btn"
          title={`Previous document (${keyboardShortcuts.previousResult})`}
          disabled={previousDocumentFn === undefined}
          onClick={previousDocumentFn}
        >
          <MdNavigateBefore /> Previous document
        </button>
      ) : (
        <span />
      )}

      <span>
        <button
          className="btn"
          title={`Previous highlight (${keyboardShortcuts.previousHighlight})`}
          onClick={() => dispatch(navigateToHighlight(pages, "previous"))}
        >
          <MdArrowUpward /> Previous highlight
        </button>

        <button
          className="btn"
          title={`Next highlight (${keyboardShortcuts.nextResult})`}
          onClick={() => dispatch(navigateToHighlight(pages, "next"))}
        >
          Next highlight <MdArrowDownward />
        </button>
      </span>

      {showPreviousNextDocumentButtons ? (
        <button
          className="btn"
          title={`Next document (${keyboardShortcuts.nextResult})`}
          disabled={nextDocumentFn === undefined}
          onClick={nextDocumentFn}
        >
          Next document <MdNavigateNext />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
