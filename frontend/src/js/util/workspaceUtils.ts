import * as R from "ramda";
import {
  isWorkspaceLeaf,
  Workspace,
  WorkspaceEntry,
} from "../types/Workspaces";
import { isTreeLeaf, isTreeNode, TreeEntry, TreeNode } from "../types/Tree";
import { ProcessingStage } from "../types/Resource";
import { useRouteMatch } from "react-router-dom";

export const findPath = (
  targetId: string,
  currentParents: TreeEntry<WorkspaceEntry>[],
  currentNode: TreeEntry<WorkspaceEntry>,
): TreeEntry<WorkspaceEntry>[] | null => {
  if (currentNode.id === targetId) {
    if (isTreeNode(currentNode)) {
      return R.append(currentNode, currentParents);
    } else {
      return currentParents;
    }
  }

  if (isTreeNode(currentNode)) {
    for (let i = 0; i < currentNode.children.length; i++) {
      const v = findPath(
        targetId,
        R.append(currentNode, currentParents),
        currentNode.children[i],
      );
      if (v !== null) {
        return v;
      }
    }
  }

  return null;
};

// Computes the relative path between a workspace root and a given node id.
export const displayRelativePath = (
  root: TreeNode<WorkspaceEntry>,
  nodeId: string,
): string => {
  const path = findPath(nodeId, [], root);

  if (path !== null) {
    return path.map((n) => n.name).join("/") + "/";
  }

  return "";
};

// An eager search that recursively traverses the workspace.entries file tree
// and terminates as soon as it finds the first leaf where processingStage is 'processing'.
// If there are no processing files it will have to traverse all nodes to determine this.
export function workspaceHasProcessingFiles(workspace: Workspace): boolean {
  function entriesHaveProcessingFiles(
    entries: TreeEntry<WorkspaceEntry>[],
  ): boolean {
    for (const entry of entries) {
      if (isTreeNode(entry)) {
        // Note that the below is *not* equivalent to:
        // ```
        // return entriesHaveProcessingFiles(entry.entries)
        // ```
        // because we specifically want to continue looping if it's false
        if (entriesHaveProcessingFiles(entry.children)) {
          return true;
        }
      } else if (
        isTreeLeaf(entry) &&
        isWorkspaceLeaf(entry.data) &&
        entry.data.processingStage.type === "processing"
      ) {
        return true;
      }
    }
    return false;
  }

  return entriesHaveProcessingFiles(workspace.rootNode.children);
}

export function processingStageToString(
  processingStage: ProcessingStage,
): string {
  switch (processingStage.type) {
    case "processing": {
      const description =
        processingStage.tasksRemaining === 1
          ? "1 task remaining"
          : `${processingStage.tasksRemaining} tasks remaining`;

      return `processing (${description})${processingStage.note ? ` - ${processingStage.note}` : ""}`;
    }

    case "processed":
      return "processed";

    case "failed":
      return "processed (with errors)";
  }
}

export function useWorkspaceId(): string | undefined {
  let match = useRouteMatch("/workspaces/:id");
  return (match?.params as any)?.id;
}
