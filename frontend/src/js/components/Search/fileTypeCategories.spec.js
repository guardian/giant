import {
  FILE_TYPE_CATEGORIES,
  expandFileTypeValues,
  collapseMimesToCategories,
  mimeToCategory,
} from "./fileTypeCategories";

describe("FILE_TYPE_CATEGORIES", () => {
  test("every category has a value, label, and non-empty mimes array", () => {
    FILE_TYPE_CATEGORIES.forEach((cat) => {
      expect(cat.value).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.mimes.length).toBeGreaterThan(0);
    });
  });

  test("category values are unique", () => {
    const values = FILE_TYPE_CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  test("no MIME type appears in more than one category", () => {
    const seen = new Map();
    FILE_TYPE_CATEGORIES.forEach((cat) => {
      cat.mimes.forEach((m) => {
        if (seen.has(m)) {
          fail(`${m} appears in both "${seen.get(m)}" and "${cat.value}"`);
        }
        seen.set(m, cat.value);
      });
    });
  });
});

describe("expandFileTypeValues", () => {
  test("expands single category", () => {
    const mimes = expandFileTypeValues(["pdf"]);
    expect(mimes).toEqual(["application/pdf"]);
  });

  test("expands multiple categories", () => {
    const mimes = expandFileTypeValues(["pdf", "web"]);
    expect(mimes).toEqual([
      "application/pdf",
      "text/html",
      "application/xhtml+xml",
    ]);
  });

  test("returns all mimes for spreadsheet category", () => {
    const mimes = expandFileTypeValues(["spreadsheet"]);
    expect(mimes).toContain("application/vnd.ms-excel");
    expect(mimes).toContain("text/csv");
    expect(mimes.length).toBe(6);
  });

  test("ignores unknown category keys", () => {
    const mimes = expandFileTypeValues(["pdf", "nonexistent"]);
    expect(mimes).toEqual(["application/pdf"]);
  });

  test("returns empty for empty input", () => {
    expect(expandFileTypeValues([])).toEqual([]);
    expect(expandFileTypeValues(null)).toEqual([]);
    expect(expandFileTypeValues(undefined)).toEqual([]);
  });
});

describe("collapseMimesToCategories", () => {
  test("maps single mime to its category", () => {
    expect(collapseMimesToCategories(["application/pdf"])).toEqual(["pdf"]);
  });

  test("maps multiple mimes from the same category to one key", () => {
    const keys = collapseMimesToCategories([
      "application/vnd.ms-excel",
      "text/csv",
    ]);
    expect(keys).toEqual(["spreadsheet"]);
  });

  test("maps mimes from different categories to multiple keys", () => {
    const keys = collapseMimesToCategories([
      "application/pdf",
      "text/html",
    ]);
    expect(keys).toEqual(["pdf", "web"]);
  });

  test("preserves order of first appearance", () => {
    const keys = collapseMimesToCategories([
      "text/html",
      "application/pdf",
      "application/xhtml+xml",
    ]);
    expect(keys).toEqual(["web", "pdf"]);
  });

  test("drops unknown mimes silently", () => {
    const keys = collapseMimesToCategories([
      "application/pdf",
      "application/x-unknown-type",
    ]);
    expect(keys).toEqual(["pdf"]);
  });

  test("returns empty for empty input", () => {
    expect(collapseMimesToCategories([])).toEqual([]);
    expect(collapseMimesToCategories(null)).toEqual([]);
    expect(collapseMimesToCategories(undefined)).toEqual([]);
  });

  test("round-trips with expandFileTypeValues", () => {
    const categories = ["pdf", "spreadsheet", "email"];
    const mimes = expandFileTypeValues(categories);
    const back = collapseMimesToCategories(mimes);
    expect(back).toEqual(categories);
  });
});

describe("mimeToCategory", () => {
  test("returns category for a known MIME type", () => {
    expect(mimeToCategory("application/pdf")).toBe("pdf");
    expect(mimeToCategory("text/html")).toBe("web");
    expect(mimeToCategory("message/rfc822")).toBe("email");
  });

  test("returns undefined for an unknown MIME type", () => {
    expect(mimeToCategory("application/x-unknown")).toBeUndefined();
    expect(mimeToCategory("")).toBeUndefined();
  });

  test("handles all categories", () => {
    FILE_TYPE_CATEGORIES.forEach((cat) => {
      cat.mimes.forEach((mime) => {
        expect(mimeToCategory(mime)).toBe(cat.value);
      });
    });
  });
});
