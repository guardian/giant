import { useMemo } from "react";
import { ColumnsConfig, TreeEntry, TreeNode, isTreeNode } from "../types/Tree";
import { WorkspaceEntry, isWorkspaceLeaf } from "../types/Workspaces";
import { sortEntries } from "./treeUtils";

const STORAGE_KEY = "workspaceSiblingUris";

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
 * Writes the sibling leaf URIs to sessionStorage so the viewer can read them
 * without re-fetching the workspace tree.
 */
export function storeWorkspaceSiblingUris(
  rootNode: TreeNode<WorkspaceEntry>,
  entry: TreeEntry<WorkspaceEntry>,
  columnsConfig: ColumnsConfig<WorkspaceEntry>,
): void {
  const parentId = entry.data.maybeParentId;
  const parentNode = parentId ? findNodeById(rootNode, parentId) : rootNode;

  if (!parentNode) return;

  const siblingUris = leafUrisOfChildren(parentNode, columnsConfig);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(siblingUris));
  } catch {
    // sessionStorage may be full or unavailable — degrade gracefully
  }
}

function readWorkspaceSiblingUris(): string[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
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
  navigate: (path: string) => void,
): WorkspaceNavigation {
  const leafUris = useMemo(() => readWorkspaceSiblingUris(), []);

  const currentIndex = leafUris.indexOf(currentUri);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < leafUris.length - 1;

  const goToPrevious = hasPrevious
    ? () => {
        const prevUri = leafUris[currentIndex - 1];
        navigate(`/viewer/${encodeURI(prevUri)}`);
      }
    : undefined;

  const goToNext = hasNext
    ? () => {
        const nextUri = leafUris[currentIndex + 1];
        navigate(`/viewer/${encodeURI(nextUri)}`);
      }
    : undefined;

  return { hasPrevious, hasNext, goToPrevious, goToNext };
}
