jest.mock("../../services/WorkspaceApi");
jest.mock("./getWorkspace");

import { moveItems } from "./moveItem";
import { moveItem as moveItemApi } from "../../services/WorkspaceApi";

const mockedMoveItemApi = moveItemApi as jest.MockedFunction<
  typeof moveItemApi
>;

function runThunk(thunk: ReturnType<typeof moveItems>) {
  const dispatch = jest.fn((action) => {
    if (typeof action === "function") {
      return action();
    }
  });
  return thunk(dispatch, jest.fn() as any, null);
}

beforeEach(() => {
  mockedMoveItemApi.mockResolvedValue(undefined as any);
});

describe("moveItems", () => {
  test("calls onEachSettled for every item", async () => {
    const onEachSettled = jest.fn();
    const thunk = moveItems(
      "ws1",
      ["a", "b", "c"],
      "ws1",
      "folder1",
      onEachSettled,
    );

    await runThunk(thunk);

    expect(mockedMoveItemApi).toHaveBeenCalledTimes(3);
    expect(onEachSettled).toHaveBeenCalledTimes(3);
  });

  test("calls onEachSettled even when an item matches newParentId", async () => {
    const onEachSettled = jest.fn();
    // "folder1" is both in itemIds and is the newParentId
    const thunk = moveItems(
      "ws1",
      ["a", "folder1", "b"],
      "ws1",
      "folder1",
      onEachSettled,
    );

    await runThunk(thunk);

    // "folder1" should be skipped for the API call
    expect(mockedMoveItemApi).toHaveBeenCalledTimes(2);
    // but onEachSettled should still fire for all 3 items
    expect(onEachSettled).toHaveBeenCalledTimes(3);
  });

  test("does not call moveItemApi for items matching newParentId", async () => {
    const thunk = moveItems("ws1", ["folder1"], "ws1", "folder1");

    await runThunk(thunk);

    expect(mockedMoveItemApi).not.toHaveBeenCalled();
  });
});
