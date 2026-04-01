import { useMemo } from "react";
import { ColumnsConfig, TreeEntry, TreeNode, isTreeNode } from "../types/Tree";
import { WorkspaceEntry, isWorkspaceLeaf } from "../types/Workspaces";
import { sortEntries } from "./treeUtils";

const STORAGE_KEY_PREFIX = "workspaceSiblingUris:";
const MAX_STORED_NAV_ENTRIES = 20;

function generateNavId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
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
 * Given a tree node, return the URIs of its immediate leaf children
 * (i.e. files, not folders) in the provided sort order.
 */
export function leafUrisOfChildren(
  node: TreeNode<WorkspaceEntry>,
  columnsConfig: ColumnsConfig<WorkspaceEntry>,
): string[] {
  return sortEntries(node.children, columnsConfig)
    .filter(
      (child): child is TreeEntry<WorkspaceEntry> & { data: { uri: string } } =>
        !isTreeNode(child) && isWorkspaceLeaf(child.data),
    )
    .map((child) => child.data.uri);
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
 * and returns the nonce so it can be passed to the viewer via query param.
 */
export function storeWorkspaceSiblingUris(
  rootNode: TreeNode<WorkspaceEntry>,
  entry: TreeEntry<WorkspaceEntry>,
  columnsConfig: ColumnsConfig<WorkspaceEntry>,
): string | undefined {
  const parentId = entry.data.maybeParentId;
  const parentNode = parentId ? findNodeById(rootNode, parentId) : rootNode;

  if (!parentNode) return undefined;

  const siblingUris = leafUrisOfChildren(parentNode, columnsConfig);
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
  return navId;
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

export function useWorkspaceNavigation(
  currentUri: string,
  navId: string | null,
  navigate: (path: string) => void,
): WorkspaceNavigation {
  const leafUris = useMemo(() => readWorkspaceSiblingUris(navId), [navId]);

  const currentIndex = leafUris.indexOf(currentUri);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < leafUris.length - 1;

  const goToPrevious = hasPrevious
    ? () => {
        const prevUri = leafUris[currentIndex - 1];
        navigate(`/viewer/${encodeURIComponent(prevUri)}?navId=${navId}`);
      }
    : undefined;

  const goToNext = hasNext
    ? () => {
        const nextUri = leafUris[currentIndex + 1];
        navigate(`/viewer/${encodeURIComponent(nextUri)}?navId=${navId}`);
      }
    : undefined;

  return { hasPrevious, hasNext, goToPrevious, goToNext };
}
