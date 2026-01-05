import { getLastPart } from "./stringUtils";

test("getLastPart", () => {
  expect(getLastPart("blah/blurgh/hey", "/")).toBe("hey");
  expect(getLastPart("ha", "/")).toBe("ha");
  expect(getLastPart("hey.blurgh/hey", ".")).toBe("blurgh/hey");
});
