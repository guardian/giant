import React, { FC, useMemo } from "react";
import { useSelector } from "react-redux";

import PreviewSwitcher from "./PreviewSwitcher";
import { DocNavButton } from "./DocNavButton";
import { keyboardShortcuts } from "../../util/keyboardShortcuts";
import { KeyboardShortcut } from "../UtilComponents/KeyboardShortcut";

import { GiantState, UrlParamsState } from "../../types/redux/GiantState";
import { Resource } from "../../types/Resource";
import { SearchResults } from "../../types/SearchResults";
import { WorkspaceNavigation } from "../../util/workspaceNavigation";

import history from "../../util/history";
import buildLink from "../../util/buildLink";

type DocumentFooterProps = {
  uri: string;
  workspaceNav: WorkspaceNavigation;
  totalPages?: number;
};

export const DocumentFooter: FC<DocumentFooterProps> = ({
  uri,
  workspaceNav,
  totalPages,
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
    currentResults !== undefined &&
    (currentResults.page > 1 || (resultIdx !== -1 && resultIdx > 0));

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
      <span />
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
