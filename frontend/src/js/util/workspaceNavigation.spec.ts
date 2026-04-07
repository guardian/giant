import {
  storeWorkspaceSiblingUris,
  computeWorkspaceNavigation,
  sortedLeafChildren,
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

/**
 * Given a tree node, return the URIs of its immediate leaf children
 * (i.e. files, not folders) in the provided sort order.
 */
function leafUrisOfChildren(
  node: TreeNode<WorkspaceEntry>,
  columnsConfig: ColumnsConfig<WorkspaceEntry>,
): string[] {
  return sortedLeafChildren(node, columnsConfig).map((child) => child.data.uri);
}

export function makeLeaf(
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

export function makeNode(
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
      leafUrisOfChildren(makeNode("root", []), nameAscColumnsConfig),
    ).toEqual([]);
  });

  test("returns URIs of immediate leaf children only", () => {
    const root = makeNode("root", [
      makeLeaf("a.pdf", "uri-a"),
      makeNode("sub", [makeLeaf("b.pdf", "uri-b")]),
      makeLeaf("c.pdf", "uri-c"),
    ]);
    expect(leafUrisOfChildren(root, nameAscColumnsConfig)).toEqual([
      "uri-a",
      "uri-c",
    ]);
  });

  test("skips sub-folder entries", () => {
    const root = makeNode("root", [
      makeNode("empty", []),
      makeLeaf("doc.pdf", "uri-1"),
    ]);
    expect(leafUrisOfChildren(root, nameAscColumnsConfig)).toEqual(["uri-1"]);
  });

  test("respects sort order", () => {
    const root = makeNode("root", [
      makeLeaf("c.pdf", "uri-c"),
      makeLeaf("a.pdf", "uri-a"),
      makeLeaf("b.pdf", "uri-b"),
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
    const root = makeNode("root", [
      makeLeaf("a.pdf", "uri-a"),
      makeLeaf("c.pdf", "uri-c"),
      makeLeaf("b.pdf", "uri-b"),
    ]);
    expect(leafUrisOfChildren(root, descConfig)).toEqual([
      "uri-c",
      "uri-b",
      "uri-a",
    ]);
  });
});

describe("storeWorkspaceSiblingUris", () => {
  beforeEach(() => sessionStorage.clear());

  test("returns a navId and navIndex and stores sibling URIs", () => {
    const parentNode = makeNode("parent", [
      makeLeaf("a.pdf", "uri-a", "parent"),
      makeLeaf("b.pdf", "uri-b", "parent"),
    ]);
    const root = makeNode("root", [parentNode]);
    const entry = makeLeaf("a.pdf", "uri-a", "parent");

    const result = storeWorkspaceSiblingUris(root, entry, nameAscColumnsConfig);

    expect(result).toBeDefined();
    expect(result!.navIndex).toBe(0);
    const stored = JSON.parse(
      sessionStorage.getItem(`workspaceSiblingUris:${result!.navId}`)!,
    );
    expect(stored).toEqual(["uri-a", "uri-b"]);
  });

  test("returns correct navIndex for second entry", () => {
    const parentNode = makeNode("parent", [
      makeLeaf("a.pdf", "uri-a", "parent"),
      makeLeaf("b.pdf", "uri-b", "parent"),
    ]);
    const root = makeNode("root", [parentNode]);
    const entry = makeLeaf("b.pdf", "uri-b", "parent");

    const result = storeWorkspaceSiblingUris(root, entry, nameAscColumnsConfig);

    expect(result!.navIndex).toBe(1);
  });

  test("uses undefined when entry has no parent id", () => {
    const root = makeNode("root", [
      makeLeaf("a.pdf", "uri-a"),
      makeLeaf("b.pdf", "uri-b"),
    ]);
    const entry = makeLeaf("a.pdf", "uri-a");

    const result = storeWorkspaceSiblingUris(root, entry, nameAscColumnsConfig);

    expect(result).toBeUndefined();
  });

  test("each call produces a unique navId", () => {
    const root = makeNode("root", [makeLeaf("a.pdf", "uri-a", "root")]);
    const entry = makeLeaf("a.pdf", "uri-a", "root");

    const r1 = storeWorkspaceSiblingUris(root, entry, nameAscColumnsConfig);
    const r2 = storeWorkspaceSiblingUris(root, entry, nameAscColumnsConfig);

    expect(r1!.navId).not.toEqual(r2!.navId);
  });
});

describe("computeWorkspaceNavigation", () => {
  const leafUris = ["uri-a", "uri-b", "uri-c"];
  const navId = "test-nav-id";

  test("returns hasPrevious and hasNext for a middle item", () => {
    const nav = computeWorkspaceNavigation(
      leafUris,
      "uri-b",
      navId,
      1,
      jest.fn(),
    );
    expect(nav.goToPrevious).toBeDefined();
    expect(nav.goToNext).toBeDefined();
  });

  test("first item has no previous", () => {
    const nav = computeWorkspaceNavigation(
      leafUris,
      "uri-a",
      navId,
      0,
      jest.fn(),
    );
    expect(nav.goToPrevious).toBeUndefined();
    expect(nav.goToNext).toBeDefined();
  });

  test("last item has no next", () => {
    const nav = computeWorkspaceNavigation(
      leafUris,
      "uri-c",
      navId,
      2,
      jest.fn(),
    );
    expect(nav.goToPrevious).toBeDefined();
    expect(nav.goToNext).toBeUndefined();
  });

  test("unknown URI returns no navigation", () => {
    const nav = computeWorkspaceNavigation(
      leafUris,
      "uri-unknown",
      navId,
      null,
      jest.fn(),
    );
    expect(nav.goToPrevious).toBeUndefined();
    expect(nav.goToNext).toBeUndefined();
  });

  test("single item has neither previous nor next", () => {
    const nav = computeWorkspaceNavigation(
      ["uri-a"],
      "uri-a",
      navId,
      0,
      jest.fn(),
    );
    expect(nav.goToPrevious).toBeUndefined();
    expect(nav.goToNext).toBeUndefined();
  });

  test("goToNext navigates with navId and navIndex", () => {
    const navigate = jest.fn();
    const nav = computeWorkspaceNavigation(
      leafUris,
      "uri-a",
      navId,
      0,
      navigate,
    );
    nav.goToNext!();
    expect(navigate).toHaveBeenCalledWith(
      `/viewer/${encodeURIComponent("uri-b")}?navId=${navId}&navIndex=1`,
    );
  });

  test("goToPrevious navigates with navId and navIndex", () => {
    const navigate = jest.fn();
    const nav = computeWorkspaceNavigation(
      leafUris,
      "uri-c",
      navId,
      2,
      navigate,
    );
    nav.goToPrevious!();
    expect(navigate).toHaveBeenCalledWith(
      `/viewer/${encodeURIComponent("uri-b")}?navId=${navId}&navIndex=1`,
    );
  });

  test("falls back to indexOf when navIndex is null", () => {
    const nav = computeWorkspaceNavigation(
      leafUris,
      "uri-b",
      navId,
      null,
      jest.fn(),
    );
    expect(nav.goToPrevious).toBeDefined();
    expect(nav.goToNext).toBeDefined();
  });

  test("uses navIndex to distinguish duplicate URIs", () => {
    const dupes = ["uri-a", "uri-dup", "uri-dup", "uri-b"];
    const navigate = jest.fn();
    // At index 2 (the second "uri-dup")
    const nav = computeWorkspaceNavigation(
      dupes,
      "uri-dup",
      navId,
      2,
      navigate,
    );
    expect(nav.goToPrevious).toBeDefined();
    expect(nav.goToNext).toBeDefined();
    nav.goToNext!();
    expect(navigate).toHaveBeenCalledWith(
      `/viewer/${encodeURIComponent("uri-b")}?navId=${navId}&navIndex=3`,
    );
  });

  test("navigates past duplicates from first occurrence", () => {
    const dupes = ["uri-a", "uri-dup", "uri-dup", "uri-b"];
    const navigate = jest.fn();
    const nav = computeWorkspaceNavigation(
      dupes,
      "uri-dup",
      navId,
      1,
      navigate,
    );
    nav.goToNext!();
    expect(navigate).toHaveBeenCalledWith(
      `/viewer/${encodeURIComponent("uri-dup")}?navId=${navId}&navIndex=2`,
    );
  });
});
