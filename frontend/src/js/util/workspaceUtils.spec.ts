import { findNodeById, workspaceHasProcessingFiles } from "./workspaceUtils";
import {
  workspaceFlatWithOneProcessing,
  workspaceFlatWithZeroProcessing,
  workspaceWithOneProcessing,
  workspaceWithOneProcessingBottomHeavyTree,
  workspaceWithTwoProcessing,
  workspaceWithZeroProcessing,
  workspaceWithZeroProcessingBottomHeavyTree,
} from "./workspaceUtils.fixtures";
import { makeLeaf, makeNode } from "./workspaceNavigation.spec";

test("workspaceHasProcessingFiles", () => {
  expect(workspaceHasProcessingFiles(workspaceWithZeroProcessing)).toBe(false);
  expect(
    workspaceHasProcessingFiles(workspaceWithZeroProcessingBottomHeavyTree),
  ).toBe(false);
  expect(workspaceHasProcessingFiles(workspaceWithOneProcessing)).toBe(true);
  expect(
    workspaceHasProcessingFiles(workspaceWithOneProcessingBottomHeavyTree),
  ).toBe(true);
  expect(workspaceHasProcessingFiles(workspaceWithTwoProcessing)).toBe(true);

  expect(workspaceHasProcessingFiles(workspaceFlatWithZeroProcessing)).toBe(
    false,
  );
  expect(workspaceHasProcessingFiles(workspaceFlatWithOneProcessing)).toBe(
    true,
  );
});

describe("findNodeById", () => {
  test("returns the root when id matches", () => {
    const root = makeNode("root", []);
    expect(findNodeById(root, "root")).toBe(root);
  });

  test("returns undefined when not found", () => {
    const root = makeNode("root", [makeLeaf("doc.pdf", "uri-1")]);
    expect(findNodeById(root, "nonexistent")).toBeUndefined();
  });

  test("finds deeply nested node", () => {
    const deep = makeNode("deep", []);
    const root = makeNode("root", [makeNode("a", [makeNode("b", [deep])])]);
    expect(findNodeById(root, "deep")).toBe(deep);
  });
});
