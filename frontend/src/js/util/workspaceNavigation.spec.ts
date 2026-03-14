import {
  leafUrisOfChildren,
  findNodeById,
  storeWorkspaceSiblingUris,
} from "./workspaceNavigation";
import { ColumnsConfig, TreeEntry, TreeNode } from "../types/Tree";
import { WorkspaceEntry, WorkspaceNode } from "../types/Workspaces";

const nodeData: WorkspaceNode = {
  addedBy: { username: "joe", displayName: "joe" },
  descendantsNodeCount: 0,
  descendantsLeafCount: 0,
  descendantsProcessingTaskCount: 0,
  descendantsFailedCount: 0,
};

// Sort by name ascending — matches the default workspace sort
const nameAscColumnsConfig: ColumnsConfig<WorkspaceEntry> = {
  sortDescending: false,
  sortColumn: "Name",
  columns: [
    {
      name: "Name",
      align: "left",
      style: {},
      render: () => null as any,
      sort: (a, b) => a.name.localeCompare(b.name),
    },
  ],
};

function leaf(
  name: string,
  uri: string,
  maybeParentId?: string,
): TreeEntry<WorkspaceEntry> {
  return {
    id: name,
    name,
    isExpandable: false,
    data: {
      uri,
      addedBy: { username: "joe", displayName: "joe" },
      mimeType: "application/pdf",
      processingStage: { type: "processed" },
      maybeParentId,
    },
  };
}

function folder(
  name: string,
  children: TreeEntry<WorkspaceEntry>[],
): TreeNode<WorkspaceEntry> {
  return {
    id: name,
    name,
    children,
    data: nodeData,
  };
}

describe("leafUrisOfChildren", () => {
  test("returns empty array for an empty folder", () => {
    expect(
      leafUrisOfChildren(folder("root", []), nameAscColumnsConfig),
    ).toEqual([]);
  });

  test("returns URIs of immediate leaf children only", () => {
    const root = folder("root", [
      leaf("a.pdf", "uri-a"),
      folder("sub", [leaf("b.pdf", "uri-b")]),
      leaf("c.pdf", "uri-c"),
    ]);
    expect(leafUrisOfChildren(root, nameAscColumnsConfig)).toEqual([
      "uri-a",
      "uri-c",
    ]);
  });

  test("skips sub-folder entries", () => {
    const root = folder("root", [
      folder("empty", []),
      leaf("doc.pdf", "uri-1"),
    ]);
    expect(leafUrisOfChildren(root, nameAscColumnsConfig)).toEqual(["uri-1"]);
  });

  test("respects sort order", () => {
    const root = folder("root", [
      leaf("c.pdf", "uri-c"),
      leaf("a.pdf", "uri-a"),
      leaf("b.pdf", "uri-b"),
    ]);
    expect(leafUrisOfChildren(root, nameAscColumnsConfig)).toEqual([
      "uri-a",
      "uri-b",
      "uri-c",
    ]);
  });

  test("respects descending sort", () => {
    const descConfig: ColumnsConfig<WorkspaceEntry> = {
      ...nameAscColumnsConfig,
      sortDescending: true,
    };
    const root = folder("root", [
      leaf("a.pdf", "uri-a"),
      leaf("c.pdf", "uri-c"),
      leaf("b.pdf", "uri-b"),
    ]);
    expect(leafUrisOfChildren(root, descConfig)).toEqual([
      "uri-c",
      "uri-b",
      "uri-a",
    ]);
  });
});

describe("findNodeById", () => {
  test("returns the root when id matches", () => {
    const root = folder("root", []);
    expect(findNodeById(root, "root")).toBe(root);
  });

  test("returns a nested node", () => {
    const inner = folder("inner", [leaf("doc.pdf", "uri-1")]);
    const root = folder("root", [inner]);
    expect(findNodeById(root, "inner")).toBe(inner);
  });

  test("returns undefined when not found", () => {
    const root = folder("root", [leaf("doc.pdf", "uri-1")]);
    expect(findNodeById(root, "nonexistent")).toBeUndefined();
  });

  test("finds deeply nested node", () => {
    const deep = folder("deep", []);
    const root = folder("root", [folder("a", [folder("b", [deep])])]);
    expect(findNodeById(root, "deep")).toBe(deep);
  });
});

describe("storeWorkspaceSiblingUris", () => {
  beforeEach(() => sessionStorage.clear());

  test("stores sibling leaf URIs of a leaf with a parent", () => {
    const parentNode = folder("parent", [
      leaf("a.pdf", "uri-a", "parent"),
      leaf("b.pdf", "uri-b", "parent"),
    ]);
    const root = folder("root", [parentNode]);
    const entry = leaf("a.pdf", "uri-a", "parent");

    storeWorkspaceSiblingUris(root, entry, nameAscColumnsConfig);

    const stored = JSON.parse(sessionStorage.getItem("workspaceSiblingUris")!);
    expect(stored).toEqual(["uri-a", "uri-b"]);
  });

  test("uses root node when entry has no parent id", () => {
    const root = folder("root", [
      leaf("a.pdf", "uri-a"),
      leaf("b.pdf", "uri-b"),
    ]);
    const entry = leaf("a.pdf", "uri-a");

    storeWorkspaceSiblingUris(root, entry, nameAscColumnsConfig);

    const stored = JSON.parse(sessionStorage.getItem("workspaceSiblingUris")!);
    expect(stored).toEqual(["uri-a", "uri-b"]);
  });
});
