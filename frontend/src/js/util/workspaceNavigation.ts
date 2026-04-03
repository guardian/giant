import { useMemo } from "react";
import { ColumnsConfig, TreeEntry, TreeNode, isTreeNode } from "../types/Tree";
import { WorkspaceEntry, isWorkspaceLeaf } from "../types/Workspaces";
import { sortEntries } from "./treeUtils";

const STORAGE_KEY_PREFIX = "workspaceSiblingUris:";
const MAX_STORED_NAV_ENTRIES = 20;

function generateNavId(): string {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto &&
    typeof (crypto as any).randomUUID === "function"
  ) {
    return (crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Remove the oldest entries when we exceed the limit, to avoid filling sessionStorage.
 */
function pruneOldNavEntries(): void {
  try {
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
  } catch {
    // best-effort cleanup
  }
}

/**
 * Return the immediate leaf children of a node sorted by the given config.
 */
function sortedLeafChildren(
  node: TreeNode<WorkspaceEntry>,
  columnsConfig: ColumnsConfig<WorkspaceEntry>,
): (TreeEntry<WorkspaceEntry> & { data: { uri: string } })[] {
  return sortEntries(node.children, columnsConfig).filter(
    (child): child is TreeEntry<WorkspaceEntry> & { data: { uri: string } } =>
      !isTreeNode(child) && isWorkspaceLeaf(child.data),
  );
}

/**
 * Given a tree node, return the URIs of its immediate leaf children
 * (i.e. files, not folders) in the provided sort order.
 */
export function leafUrisOfChildren(
  node: TreeNode<WorkspaceEntry>,
  columnsConfig: ColumnsConfig<WorkspaceEntry>,
): string[] {
  return sortedLeafChildren(node, columnsConfig).map((child) => child.data.uri);
}

/**
 * Find the parent node of an entry by its maybeParentId.
 * Returns the matching node, or undefined if not found.
 */
export function findNodeById(
  root: TreeNode<WorkspaceEntry>,
  targetId: string,
): TreeNode<WorkspaceEntry> | undefined {
  if (root.id === targetId) {
    return root;
  }
  for (const child of root.children) {
    if (isTreeNode(child)) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Called from the workspace page before opening a document in a new tab.
 * Writes the sibling leaf URIs to sessionStorage keyed by a unique nonce,
 * and returns the nonce plus the index of the clicked entry so both can be
 * passed to the viewer via query params.
 */
export function storeWorkspaceSiblingUris(
  rootNode: TreeNode<WorkspaceEntry>,
  entry: TreeEntry<WorkspaceEntry>,
  columnsConfig: ColumnsConfig<WorkspaceEntry>,
): { navId: string; navIndex: number } | undefined {
  const parentId = entry.data.maybeParentId;
  const parentNode = parentId ? findNodeById(rootNode, parentId) : rootNode;

  if (!parentNode) return undefined;

  const leaves = sortedLeafChildren(parentNode, columnsConfig);
  const siblingUris = leaves.map((child) => child.data.uri);
  const navIndex = leaves.findIndex((child) => child.id === entry.id);
  const navId = generateNavId();
  try {
    pruneOldNavEntries();
    sessionStorage.setItem(
      `${STORAGE_KEY_PREFIX}${navId}`,
      JSON.stringify(siblingUris),
    );
  } catch {
    // sessionStorage may be full or unavailable — degrade gracefully
    return undefined;
  }
  return { navId, navIndex: navIndex >= 0 ? navIndex : 0 };
}

function readWorkspaceSiblingUris(navId: string | null): string[] {
  if (!navId) return [];
  try {
    const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${navId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // corrupt or unavailable — degrade gracefully
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
