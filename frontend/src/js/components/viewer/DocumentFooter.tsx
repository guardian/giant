import React, { FC, useCallback, useEffect, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import RotateLeft from "react-icons/lib/md/rotate-left";
import RotateRight from "react-icons/lib/md/rotate-right";
import ZoomInIcon from "react-icons/lib/md/zoom-in";
import ZoomOutIcon from "react-icons/lib/md/zoom-out";

import PreviewSwitcher from "./PreviewSwitcher";
import { DocNavButton } from "./DocNavButton";
import { FindInput } from "../PageViewer/FindInput";
import { keyboardShortcuts } from "../../util/keyboardShortcuts";
import { KeyboardShortcut } from "../UtilComponents/KeyboardShortcut";

import { GiantState, UrlParamsState } from "../../types/redux/GiantState";
import { Resource } from "../../types/Resource";
import { SearchResults } from "../../types/SearchResults";
import { WorkspaceNavigation } from "../../util/workspaceNavigation";
import { PageFindState } from "../PageViewer/usePageFind";

import history from "../../util/history";
import buildLink from "../../util/buildLink";

type PageViewControls = {
  rotateClockwise: () => void;
  rotateAnticlockwise: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

type DocumentFooterProps = {
  uri: string;
  workspaceNav: WorkspaceNavigation;
  totalPages?: number;
  pageFind?: PageFindState;
  pageViewControls?: PageViewControls;
};

export const DocumentFooter: FC<DocumentFooterProps> = ({
  uri,
  workspaceNav,
  totalPages,
  pageFind,
  pageViewControls,
}) => {
  const resource = useSelector<GiantState, Resource | null>(
    (state) => state.resource,
  );
  const currentResults = useSelector<GiantState, SearchResults | undefined>(
    (state) => state.search.currentResults,
  );
  const urlParams = useSelector<GiantState, UrlParamsState>(
    (state) => state.urlParams,
  );

  // --- Search result navigation (stepping between documents) ---

  const resultIdx = useMemo(() => {
    if (!currentResults) return -1;
    return currentResults.results.findIndex((r) => r.uri === uri);
  }, [currentResults, uri]);

  const hasPreviousResult =
    currentResults !== undefined && (currentResults.page > 1 || resultIdx > 0);

  const hasNextResult =
    currentResults !== undefined &&
    (currentResults.page < currentResults.pages ||
      (resultIdx !== -1 && resultIdx < currentResults.results.length - 1));

  const previousResult = hasPreviousResult
    ? () => {
        const idx = resultIdx - 1;
        if (idx >= 0) {
          const to = currentResults!.results[idx].uri;
          history.push(buildLink(to, urlParams, {}));
        }
      }
    : undefined;

  const nextResult = hasNextResult
    ? () => {
        const idx = resultIdx + 1;
        if (idx < currentResults!.results.length) {
          const to = currentResults!.results[idx].uri;
          history.push(buildLink(to, urlParams, {}));
        }
      }
    : undefined;

  // --- Effective navigation (search results take priority over workspace) ---

  const navContext: "search" | "workspace" | undefined =
    hasPreviousResult || hasNextResult
      ? "search"
      : workspaceNav.hasPrevious || workspaceNav.hasNext
        ? "workspace"
        : undefined;

  const effectivePreviousFn = previousResult ?? workspaceNav.goToPrevious;
  const effectiveNextFn = nextResult ?? workspaceNav.goToNext;

  // --- Cmd+F handler for find-in-document (combined view only) ---

  const findInputRef = useRef<HTMLInputElement>(null);

  const handleCmdF = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      const input = findInputRef.current;
      if (input) {
        input.focus();
        input.setSelectionRange(0, input.value.length);
      }
    }
  }, []);

  useEffect(() => {
    if (!pageFind) return;
    window.addEventListener("keydown", handleCmdF);
    return () => window.removeEventListener("keydown", handleCmdF);
  }, [pageFind, handleCmdF]);

  // --- Render ---

  if (!resource) {
    return null;
  }

  return (
    <div className="document__status">
      {effectiveNextFn && (
        <KeyboardShortcut
          shortcut={keyboardShortcuts.nextResult}
          func={effectiveNextFn}
        />
      )}
      {effectivePreviousFn && (
        <KeyboardShortcut
          shortcut={keyboardShortcuts.previousResult}
          func={effectivePreviousFn}
        />
      )}
      {pageFind && (
        <span className="document__footer-find">
          <FindInput
            ref={findInputRef}
            performFind={pageFind.performFind}
            isPending={pageFind.isPending}
            jumpToNextFindHit={pageFind.jumpToNext}
            jumpToPreviousFindHit={pageFind.jumpToPrevious}
            highlights={pageFind.highlightsState.highlights}
            focusedFindHighlightIndex={pageFind.highlightsState.focusedIndex}
          />
        </span>
      )}
      {pageViewControls && (
        <span className="document__footer-view-controls">
          <button onClick={pageViewControls.zoomIn} title="Zoom in">
            <ZoomInIcon />
          </button>
          <button onClick={pageViewControls.zoomOut} title="Zoom out">
            <ZoomOutIcon />
          </button>
          <button
            onClick={pageViewControls.rotateAnticlockwise}
            title="Rotate anti-clockwise"
          >
            <RotateLeft />
          </button>
          <button
            onClick={pageViewControls.rotateClockwise}
            title="Rotate clockwise"
          >
            <RotateRight />
          </button>
        </span>
      )}
      {!pageFind && !pageViewControls && <span />}
      <span className="doc-nav-buttons">
        <PreviewSwitcher
          view={urlParams.view}
          resource={resource}
          totalPages={totalPages}
        />
        <DocNavButton
          direction="previous"
          title={
            navContext === "workspace"
              ? `Previous in folder (${keyboardShortcuts.previousResult})`
              : `Previous document in search results (${keyboardShortcuts.previousResult})`
          }
          onClick={effectivePreviousFn}
        />
        <DocNavButton
          direction="next"
          title={
            navContext === "workspace"
              ? `Next in folder (${keyboardShortcuts.nextResult})`
              : `Next document in search results (${keyboardShortcuts.nextResult})`
          }
          onClick={effectiveNextFn}
        />
      </span>
    </div>
  );
};
