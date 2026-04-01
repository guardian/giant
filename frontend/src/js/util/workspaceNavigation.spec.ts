import {
  leafUrisOfChildren,
  findNodeById,
  storeWorkspaceSiblingUris,
  computeWorkspaceNavigation,
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

  test("returns a navId and stores sibling URIs keyed by it", () => {
    const parentNode = folder("parent", [
      leaf("a.pdf", "uri-a", "parent"),
      leaf("b.pdf", "uri-b", "parent"),
    ]);
    const root = folder("root", [parentNode]);
    const entry = leaf("a.pdf", "uri-a", "parent");

    const navId = storeWorkspaceSiblingUris(root, entry, nameAscColumnsConfig);

    expect(navId).toBeDefined();
    const stored = JSON.parse(
      sessionStorage.getItem(`workspaceSiblingUris:${navId}`)!,
    );
    expect(stored).toEqual(["uri-a", "uri-b"]);
  });

  test("uses root node when entry has no parent id", () => {
    const root = folder("root", [
      leaf("a.pdf", "uri-a"),
      leaf("b.pdf", "uri-b"),
    ]);
    const entry = leaf("a.pdf", "uri-a");

    const navId = storeWorkspaceSiblingUris(root, entry, nameAscColumnsConfig);

    expect(navId).toBeDefined();
    const stored = JSON.parse(
      sessionStorage.getItem(`workspaceSiblingUris:${navId}`)!,
    );
    expect(stored).toEqual(["uri-a", "uri-b"]);
  });

  test("each call produces a unique navId", () => {
    const root = folder("root", [leaf("a.pdf", "uri-a")]);
    const entry = leaf("a.pdf", "uri-a");

    const id1 = storeWorkspaceSiblingUris(root, entry, nameAscColumnsConfig);
    const id2 = storeWorkspaceSiblingUris(root, entry, nameAscColumnsConfig);

    expect(id1).not.toEqual(id2);
  });
});

describe("computeWorkspaceNavigation", () => {
  const leafUris = ["uri-a", "uri-b", "uri-c"];
  const navId = "test-nav-id";

  test("returns hasPrevious and hasNext for a middle item", () => {
    const nav = computeWorkspaceNavigation(leafUris, "uri-b", navId, jest.fn());
    expect(nav.hasPrevious).toBe(true);
    expect(nav.hasNext).toBe(true);
    expect(nav.goToPrevious).toBeDefined();
    expect(nav.goToNext).toBeDefined();
  });

  test("first item has no previous", () => {
    const nav = computeWorkspaceNavigation(leafUris, "uri-a", navId, jest.fn());
    expect(nav.hasPrevious).toBe(false);
    expect(nav.hasNext).toBe(true);
    expect(nav.goToPrevious).toBeUndefined();
    expect(nav.goToNext).toBeDefined();
  });

  test("last item has no next", () => {
    const nav = computeWorkspaceNavigation(leafUris, "uri-c", navId, jest.fn());
    expect(nav.hasPrevious).toBe(true);
    expect(nav.hasNext).toBe(false);
    expect(nav.goToPrevious).toBeDefined();
    expect(nav.goToNext).toBeUndefined();
  });

  test("unknown URI returns no navigation", () => {
    const nav = computeWorkspaceNavigation(
      leafUris,
      "uri-unknown",
      navId,
      jest.fn(),
    );
    expect(nav.hasPrevious).toBe(false);
    expect(nav.hasNext).toBe(false);
    expect(nav.goToPrevious).toBeUndefined();
    expect(nav.goToNext).toBeUndefined();
  });

  test("empty leaf list returns no navigation", () => {
    const nav = computeWorkspaceNavigation([], "uri-a", navId, jest.fn());
    expect(nav.hasPrevious).toBe(false);
    expect(nav.hasNext).toBe(false);
  });

  test("single item has neither previous nor next", () => {
    const nav = computeWorkspaceNavigation(
      ["uri-a"],
      "uri-a",
      navId,
      jest.fn(),
    );
    expect(nav.hasPrevious).toBe(false);
    expect(nav.hasNext).toBe(false);
  });

  test("goToNext navigates to the correct URI with navId", () => {
    const navigate = jest.fn();
    const nav = computeWorkspaceNavigation(leafUris, "uri-a", navId, navigate);
    nav.goToNext!();
    expect(navigate).toHaveBeenCalledWith(
      `/viewer/${encodeURIComponent("uri-b")}?navId=${navId}`,
    );
  });

  test("goToPrevious navigates to the correct URI with navId", () => {
    const navigate = jest.fn();
    const nav = computeWorkspaceNavigation(leafUris, "uri-c", navId, navigate);
    nav.goToPrevious!();
    expect(navigate).toHaveBeenCalledWith(
      `/viewer/${encodeURIComponent("uri-b")}?navId=${navId}`,
    );
  });

  test("null navId returns no navigation", () => {
    const nav = computeWorkspaceNavigation([], "uri-a", null, jest.fn());
    expect(nav.hasPrevious).toBe(false);
    expect(nav.hasNext).toBe(false);
  });
});
