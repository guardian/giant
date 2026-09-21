import buildLink from "./buildLink";

describe("buildLink", () => {
  test("preserves q from urlParams when not overridden", () => {
    const result = buildLink("/test", { q: "search" }, {});
    expect(result).toContain("q=search");
  });

  test("does not carry view param from urlParams", () => {
    const result = buildLink("/test", { view: "text" }, {});
    expect(result).not.toContain("view=");
  });

  test("does not carry view param even when other params are present", () => {
    const result = buildLink("/test", { q: "search", view: "ocr.english" }, {});
    expect(result).toContain("q=search");
    expect(result).not.toContain("view=");
  });

  test("allows view to be set explicitly via overrides", () => {
    const result = buildLink("/test", {}, { view: "text" });
    expect(result).toContain("view=text");
  });
});

test("buildLink supports numeric pages and omitted overrides", () => {
  expect(buildLink("/search", { page: 2 })).toBe("/search?page=2");
});

test("buildLink preserves filters and details while removing null overrides", () => {
  expect(
    buildLink(
      "/a path",
      {
        q: "original",
        filters: { collection: ["one"] },
        details: { tab: "metadata" },
      },
      { q: null, page: 3, view: null },
    ),
  ).toBe(
    "/a%20path?page=3&q=original&filters.collection[]=one&details.tab=metadata",
  );
});
