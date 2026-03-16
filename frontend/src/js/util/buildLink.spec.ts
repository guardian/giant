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
