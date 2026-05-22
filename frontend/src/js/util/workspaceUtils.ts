import * as R from "ramda";
import {
  isWorkspaceLeaf,
  isWorkspaceNode,
  Workspace,
  WorkspaceEntry,
  WorkspaceFileStatus,
} from "../types/Workspaces";
import { isTreeLeaf, isTreeNode, TreeEntry, TreeNode } from "../types/Tree";
import { ProcessingStage } from "../types/Resource";
import { useRouteMatch } from "react-router-dom";

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

    // The structure tree carries `unknown` until /status merges in; show nothing
    // rather than a misleading state.
    case "unknown":
      return "";
  }
}

type RollupCounts = { processingTasks: number; failures: number };

const emptyRollup: RollupCounts = { processingTasks: 0, failures: 0 };

const sumRollups = (a: RollupCounts, b: RollupCounts): RollupCounts => ({
  processingTasks: a.processingTasks + b.processingTasks,
  failures: a.failures + b.failures,
});

// A single (already-merged) child's contribution to its parent folder's
// processing/failure roll-ups, mirroring the server-side aggregation in
// Neo4jAnnotations: a folder contributes its own descendant counts, a processing
// leaf contributes its tasksRemaining, and a failed leaf contributes 1 failure.
function childRollupContribution(
  child: TreeEntry<WorkspaceEntry>,
): RollupCounts {
  if (isTreeNode(child) && isWorkspaceNode(child.data)) {
    return {
      processingTasks: child.data.descendantsProcessingTaskCount,
      failures: child.data.descendantsFailedCount,
    };
  }
  if (isTreeLeaf(child) && isWorkspaceLeaf(child.data)) {
    switch (child.data.processingStage.type) {
      case "processing":
        return {
          processingTasks: child.data.processingStage.tasksRemaining,
          failures: 0,
        };
      case "failed":
        return { processingTasks: 0, failures: 1 };
      default:
        return emptyRollup;
    }
  }
  return emptyRollup;
}

// Merges the flat /status list into a /structure tree: sets each file leaf's
// processingStage from its matching status entry (by uri) and recomputes the
// folder-level descendantsProcessingTaskCount / descendantsFailedCount roll-ups
// that /structure zeroes out. Structural roll-ups (leaf/node counts) are left
// untouched since /structure already populates them. Returns a new workspace;
// the input is not mutated.
export function mergeWorkspaceStatus(
  workspace: Workspace,
  statuses: WorkspaceFileStatus[],
): Workspace {
  const statusByUri = new Map(statuses.map((status) => [status.uri, status]));

  function mergeEntry(
    entry: TreeEntry<WorkspaceEntry>,
  ): TreeEntry<WorkspaceEntry> {
    if (isTreeLeaf(entry) && isWorkspaceLeaf(entry.data)) {
      const status = statusByUri.get(entry.data.uri);
      if (!status) {
        return entry;
      }
      return {
        ...entry,
        data: { ...entry.data, processingStage: status.processingStage },
      };
    }

    if (isTreeNode(entry)) {
      const children = entry.children.map(mergeEntry);

      if (!isWorkspaceNode(entry.data)) {
        return { ...entry, children };
      }

      const rollup = children
        .map(childRollupContribution)
        .reduce(sumRollups, emptyRollup);

      return {
        ...entry,
        children,
        data: {
          ...entry.data,
          descendantsProcessingTaskCount: rollup.processingTasks,
          descendantsFailedCount: rollup.failures,
        },
      };
    }

    return entry;
  }

  return {
    ...workspace,
    rootNode: mergeEntry(workspace.rootNode) as TreeNode<WorkspaceEntry>,
  };
}

export function workspaceEntryPath(
  workspaceId: string,
  entryId?: string,
): string {
  return entryId
    ? `/workspaces/${workspaceId}/${entryId}`
    : `/workspaces/${workspaceId}`;
}

export function useWorkspaceId(): string | undefined {
  let match = useRouteMatch("/workspaces/:id");
  return (match?.params as any)?.id;
}

export function getEntryLink(workspace: Workspace, entryId: string): string {
  const entryPath = workspaceEntryPath(
    workspace.id,
    entryId === workspace.rootNode.id ? undefined : entryId,
  );
  return `${window.location.origin}${entryPath}`;
}
