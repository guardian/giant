import {
  ColumnsConfig,
  Tree,
  TreeEntry,
  TreeLeaf,
  TreeNode,
} from "../types/Tree";
import React from "react";
import {
  collectNodeIds,
  getIdsOfEntriesToMove,
  getShiftClickSelectedEntries,
  isDescendantOf,
  mergeFetchedNode,
  newSelectionFromShiftClick,
  treeToOrderedEntries,
} from "./treeUtils";
import { cloneDeep } from "lodash";

const b: TreeLeaf<null> = {
  id: "b",
  name: "b",
  data: null,
  isExpandable: false,
};
const c: TreeLeaf<null> = {
  id: "c",
  name: "c",
  data: null,
  isExpandable: false,
};
const a: TreeNode<null> = {
  id: "a",
  name: "a",
  data: null,
  children: [c, b],
};
const f: TreeLeaf<null> = {
  id: "f",
  name: "f",
  data: null,
  isExpandable: false,
};
const e: TreeNode<null> = {
  id: "e",
  name: "e",
  data: null,
  children: [f],
};
const d: TreeNode<null> = {
  id: "d",
  name: "d",
  data: null,
  children: [e],
};
const tree: Tree<null> = [d, a];
const columnsConfig: ColumnsConfig<null> = {
  sortDescending: false,
  sortColumn: "name",
  columns: [
    {
      name: "name",
      align: "left",
      style: {},
      render: () => <React.Fragment></React.Fragment>,
      sort: (a: TreeEntry<null>, b: TreeEntry<null>) =>
        a.name.localeCompare(b.name),
    } as const,
  ],
};

test("treeToOrderedEntries", () => {
  expect(treeToOrderedEntries(tree, columnsConfig, [])).toStrictEqual([a, d]);

  expect(treeToOrderedEntries(tree, columnsConfig, [a])).toStrictEqual([
    a,
    b,
    c,
    d,
  ]);

  expect(treeToOrderedEntries(tree, columnsConfig, [a, e])).toStrictEqual([
    a,
    b,
    c,
    d,
  ]);

  expect(treeToOrderedEntries(tree, columnsConfig, [a, d])).toStrictEqual([
    a,
    b,
    c,
    d,
    e,
  ]);

  expect(treeToOrderedEntries(tree, columnsConfig, [a, d, e])).toStrictEqual([
    a,
    b,
    c,
    d,
    e,
    f,
  ]);

  expect(treeToOrderedEntries(tree, columnsConfig, [a, d, e])).toStrictEqual([
    a,
    b,
    c,
    d,
    e,
    f,
  ]);

  // Check it works by id if we don't actually have a reference to the same object
  // (i.e. if a workspace has been re-fetched)
  expect(
    treeToOrderedEntries(
      tree.map((obj) => cloneDeep(obj)),
      columnsConfig,
      [a, d, e],
    ),
  ).toStrictEqual([a, b, c, d, e, f]);
});

test("isDescendantOf", () => {
  expect(isDescendantOf<null>(f, d)).toBe(true);
  expect(isDescendantOf<null>(c, a)).toBe(true);
  expect(isDescendantOf<null>(c, b)).toBe(false);

  const x: TreeNode<null> = {
    id: "a",
    name: "a",
    data: null,
    children: [a, d],
  };
  expect(isDescendantOf<null>(f, x)).toBe(true);
  expect(isDescendantOf<null>(c, x)).toBe(true);
  expect(isDescendantOf<null>(b, x)).toBe(true);
  expect(isDescendantOf<null>(a, x)).toBe(true);
  expect(isDescendantOf<null>(d, x)).toBe(true);

  expect(isDescendantOf<null>(x, f)).toBe(false);
  expect(isDescendantOf<null>(x, b)).toBe(false);
  expect(isDescendantOf<null>(x, c)).toBe(false);
  expect(isDescendantOf<null>(x, a)).toBe(false);
  expect(isDescendantOf<null>(x, d)).toBe(false);

  expect(isDescendantOf<null>(x, x)).toBe(false);
});

test("getShiftClickSelectedEntries", () => {
  expect(getShiftClickSelectedEntries([a, b, c, d, e, f], b, d)).toStrictEqual([
    b,
    c,
    d,
  ]);

  expect(getShiftClickSelectedEntries([a, b, c, d, e, f], d, a)).toStrictEqual([
    a,
    b,
    c,
    d,
  ]);

  expect(getShiftClickSelectedEntries([a, b, c, d, e], a, f)).toStrictEqual([]);

  expect(getShiftClickSelectedEntries([a, b, c, d, e, f], f, f)).toStrictEqual([
    f,
  ]);

  expect(getShiftClickSelectedEntries([a, b, c, d, e, f], f, a)).toStrictEqual([
    a,
    b,
    c,
    d,
    e,
    f,
  ]);

  expect(getShiftClickSelectedEntries([a, b, c, d, e, f], a, b)).toStrictEqual([
    a,
    b,
  ]);
});

describe("newSelectionFromShiftClick", () => {
  test("re-defining a shift-click selection", () => {
    expect(newSelectionFromShiftClick([a, b, c], [d, e], [])).toStrictEqual([
      d,
      e,
    ]);
  });

  test("no duplicates in overlapping selections", () => {
    expect(
      newSelectionFromShiftClick([a, b, c], [a, b, c], [a, b, c]),
    ).toStrictEqual([a, b, c]);
  });

  test("re-defining a shift-click selection while preserving an existing selection", () => {
    expect(newSelectionFromShiftClick([c, d, e], [b, c], [a])).toStrictEqual([
      a,
      b,
      c,
    ]);
  });

  test("emptying out a shift-click selection", () => {
    expect(newSelectionFromShiftClick([a, b, c], [], [f, d, e])).toStrictEqual([
      f,
      d,
      e,
    ]);
  });

  test("no previous shift-click selection", () => {
    expect(newSelectionFromShiftClick([], [a, b], [f, d, e])).toStrictEqual([
      f,
      d,
      e,
      a,
      b,
    ]);
  });

  test("no previous or new shift-click selection", () => {
    expect(newSelectionFromShiftClick([], [], [f, d, e])).toStrictEqual([
      f,
      d,
      e,
    ]);
  });

  test("new and previous shift-click selections the same", () => {
    expect(newSelectionFromShiftClick([a, b], [a, b], [f, d, e])).toStrictEqual(
      [f, d, e, a, b],
    );
  });

  test("works correctly even when objects are copies", () => {
    expect(
      newSelectionFromShiftClick(
        [a, b].map((obj) => cloneDeep(obj)),
        [a, b].map((obj) => cloneDeep(obj)),
        [f, d, e].map((obj) => cloneDeep(obj)),
      ),
    ).toStrictEqual([f, d, e, a, b].map((obj) => cloneDeep(obj)));
  });
});

describe("getIdsOfEntriesToMove", () => {
  test("filters out descendants", () => {
    expect(getIdsOfEntriesToMove([a, b, c], b.id)).toStrictEqual([a.id]);
    expect(getIdsOfEntriesToMove([a, b, c], c.id)).toStrictEqual([a.id]);
    expect(getIdsOfEntriesToMove([a, b, d, f], a.id)).toStrictEqual([
      a.id,
      d.id,
    ]);
  });

  test("returns nothing if the dragged entry is not in the selection (sanity check)", () => {
    expect(getIdsOfEntriesToMove([a, b, c], d.id)).toStrictEqual([]);
    expect(getIdsOfEntriesToMove([a, b, c], e.id)).toStrictEqual([]);
  });
});

// --- lazy-loading tree helpers (#744) ---

const mkLeaf = (id: string): TreeLeaf<string> => ({
  id,
  name: id,
  data: id,
  isExpandable: false,
});
const mkNode = (
  id: string,
  children: TreeEntry<string>[],
  data: string = id,
  name: string = id,
): TreeNode<string> => ({ id, name, data, children });

describe("mergeFetchedNode", () => {
  test("replaces an unfetched placeholder folder with the fetched node and its children", () => {
    const tree = mkNode("root", [mkNode("x", []), mkLeaf("l")]);
    const fresh = mkNode("x", [mkLeaf("x1"), mkLeaf("x2")]);

    const result = mergeFetchedNode(tree, fresh, ["root"]) as TreeNode<string>;
    const x = result.children.find((c) => c.id === "x") as TreeNode<string>;
    expect(x.children.map((c) => c.id)).toStrictEqual(["x1", "x2"]);
  });

  test("merges a node nested several levels deep, by id", () => {
    const tree = mkNode("root", [mkNode("a", [mkNode("b", [])])]);
    const fresh = mkNode("b", [mkLeaf("b1")]);

    const result = mergeFetchedNode(tree, fresh, ["root", "a"]);
    const a = (result as TreeNode<string>).children[0] as TreeNode<string>;
    const b = a.children[0] as TreeNode<string>;
    expect(b.children.map((c) => c.id)).toStrictEqual(["b1"]);
  });

  test("preserves an already-loaded child subtree when refreshing its parent, adopting fresh name/data", () => {
    // x is already loaded with a grandchild; refreshing root must keep that grandchild
    const tree = mkNode("root", [
      mkNode("x", [mkLeaf("g")], "old-data", "x"),
      mkLeaf("l"),
    ]);
    // the refreshed root returns x as a placeholder (empty children) with a new name/data (renamed)
    const fresh = mkNode("root", [
      mkNode("x", [], "new-data", "x-renamed"),
      mkLeaf("l"),
    ]);

    const result = mergeFetchedNode(tree, fresh, ["root", "x"]);
    const x = (result as TreeNode<string>).children.find(
      (c) => c.id === "x",
    ) as TreeNode<string>;
    expect(x.children.map((c) => c.id)).toStrictEqual(["g"]); // subtree preserved
    expect(x.name).toBe("x-renamed"); // fresh name adopted
    expect(x.data).toBe("new-data"); // fresh data adopted
  });

  test("does not preserve a child subtree that is not in loadedNodeIds (takes the fresh placeholder)", () => {
    const tree = mkNode("root", [mkNode("x", [mkLeaf("g")])]);
    const fresh = mkNode("root", [mkNode("x", [])]);

    // x is present in the store but was never loaded, so the fresh placeholder wins
    const result = mergeFetchedNode(tree, fresh, ["root"]);
    const x = (result as TreeNode<string>).children.find(
      (c) => c.id === "x",
    ) as TreeNode<string>;
    expect(x.children).toStrictEqual([]);
  });

  test("adds children new to fresh and drops children absent from fresh", () => {
    const tree = mkNode("root", [mkLeaf("old")]);
    const fresh = mkNode("root", [mkLeaf("new")]);

    const result = mergeFetchedNode(tree, fresh, ["root"]) as TreeNode<string>;
    expect(result.children.map((c) => c.id)).toStrictEqual(["new"]);
  });

  test("returns the tree unchanged when the fresh node's id is not present", () => {
    const tree = mkNode("root", [mkLeaf("l")]);
    const fresh = mkNode("absent", [mkLeaf("a1")]);
    expect(mergeFetchedNode(tree, fresh, ["root"])).toStrictEqual(tree);
  });
});

describe("collectNodeIds", () => {
  test("returns all folder ids inclusive, excluding leaves", () => {
    const tree = mkNode("root", [
      mkNode("a", [mkLeaf("a1"), mkNode("b", [mkLeaf("b1")])]),
      mkLeaf("l"),
    ]);
    expect(collectNodeIds(tree).sort()).toStrictEqual(["a", "b", "root"]);
  });

  test("returns nothing for a leaf", () => {
    expect(collectNodeIds(mkLeaf("l"))).toStrictEqual([]);
  });
});
