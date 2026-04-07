import { useMemo } from "react";
import {
  ColumnsConfig,
  TreeEntry,
  TreeNode,
  isTreeNode,
  isTreeLeaf,
  TreeLeaf,
} from "../types/Tree";
import {
  WorkspaceEntry,
  WorkspaceLeaf,
  isWorkspaceLeaf,
} from "../types/Workspaces";
import { sortEntries } from "./treeUtils";
import { uuidOrFallback } from "./uuid";
import { findNodeById } from "./workspaceUtils";

const STORAGE_KEY_PREFIX = "workspaceSiblingUris:";
const MAX_STORED_NAV_ENTRIES = 20;

/**
 * Remove the oldest entries when we exceed the limit, to avoid filling sessionStorage.
 */
function pruneOldNavEntries(): void {
  const keys = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      keys.push(key);
    }
  }
  if (keys.length > MAX_STORED_NAV_ENTRIES) {
    keys
      .slice(0, keys.length - MAX_STORED_NAV_ENTRIES)
      .forEach((key) => sessionStorage.removeItem(key));
  }
}

/**
 * Return the immediate leaf children of a node sorted by the given config.
 */
export function sortedLeafChildren(
  node: TreeNode<WorkspaceEntry>,
  columnsConfig: ColumnsConfig<WorkspaceEntry>,
): TreeLeaf<WorkspaceLeaf>[] {
  return sortEntries(node.children, columnsConfig).filter(
    (child): child is TreeLeaf<WorkspaceLeaf> =>
      isTreeLeaf(child) && isWorkspaceLeaf(child.data),
  );
}

/**
 * Called from the workspace page before opening a document in a new tab.
 * Writes the sibling leaf URIs to sessionStorage keyed by a unique uuid,
 * and returns the uuid plus the index of the clicked entry so both can be
 * passed to the viewer via query params.
 */
export function storeWorkspaceSiblingUris(
  rootNode: TreeNode<WorkspaceEntry>,
  entry: TreeEntry<WorkspaceEntry>,
  columnsConfig: ColumnsConfig<WorkspaceEntry>,
): { navId: string; navIndex: number } | undefined {
  const parentId = entry.data.maybeParentId;
  const parentNode = parentId ? findNodeById(rootNode, parentId) : undefined;

  if (!parentNode) return undefined;

  const leaves = sortedLeafChildren(parentNode, columnsConfig);
  const navIndex = leaves.findIndex((child) => child.id === entry.id);
  const siblingUris = leaves.map((child) => child.data.uri);
  const navId = uuidOrFallback();
  pruneOldNavEntries();
  sessionStorage.setItem(
    `${STORAGE_KEY_PREFIX}${navId}`,
    JSON.stringify(siblingUris),
  );
  return { navId, navIndex: navIndex };
}

function readWorkspaceSiblingUris(navId: string | null): string[] {
  if (!navId) return [];
  const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${navId}`);
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
}

export type WorkspaceNavigation = {
  hasPrevious: boolean;
  hasNext: boolean;
  goToPrevious: (() => void) | undefined;
  goToNext: (() => void) | undefined;
};

export function computeWorkspaceNavigation(
  leafUris: string[],
  currentUri: string,
  navId: string | null,
  navIndex: number | null,
  navigate: (path: string) => void,
): WorkspaceNavigation {
  // Use the explicit index when it's valid (matching the current URI),
  // otherwise fall back to indexOf — which still works when URIs are unique.
  const currentIndex =
    navIndex !== null &&
    navIndex >= 0 &&
    navIndex < leafUris.length &&
    leafUris[navIndex] === currentUri
      ? navIndex
      : leafUris.indexOf(currentUri);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < leafUris.length - 1;

  const goToPrevious = hasPrevious
    ? () => {
        const prevIndex = currentIndex - 1;
        const prevUri = leafUris[prevIndex];
        navigate(
          `/viewer/${encodeURIComponent(prevUri)}?navId=${navId}&navIndex=${prevIndex}`,
        );
      }
    : undefined;

  const goToNext = hasNext
    ? () => {
        const nextIndex = currentIndex + 1;
        const nextUri = leafUris[nextIndex];
        navigate(
          `/viewer/${encodeURIComponent(nextUri)}?navId=${navId}&navIndex=${nextIndex}`,
        );
      }
    : undefined;

  return { hasPrevious, hasNext, goToPrevious, goToNext };
}

export function useWorkspaceNavigation(
  currentUri: string,
  navId: string | null,
  navIndex: number | null,
  navigate: (path: string) => void,
): WorkspaceNavigation {
  const leafUris = useMemo(() => readWorkspaceSiblingUris(navId), [navId]);
  return computeWorkspaceNavigation(
    leafUris,
    currentUri,
    navId,
    navIndex,
    navigate,
  );
}
