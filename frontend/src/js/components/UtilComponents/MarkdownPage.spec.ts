import { getIdFromHash, markdownScrollTop } from "./MarkdownPage";

describe("getIdFromHash", () => {
  test("returns null for an empty hash", () => {
    expect(getIdFromHash("")).toBeNull();
  });

  test("decodes URI encoded heading ids", () => {
    expect(getIdFromHash("#an%20encoded%20heading")).toBe("an encoded heading");
  });
});

describe("markdownScrollTop", () => {
  test("applies markdown top offset", () => {
    expect(markdownScrollTop(250)).toBe(190);
  });
});
