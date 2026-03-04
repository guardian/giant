import React from "react";
import FileTypeSidebarFilter from "./FileTypeSidebarFilter";
import { FILE_TYPE_CATEGORIES, mimeToCategory } from "../Search/fileTypeCategories";

// ── helpers ──────────────────────────────────────────────────────────

/** Build a mock agg matching the backend mimeTypes agg shape */
function buildAgg(bucketsByPrefix) {
  return {
    key: "mimeType",
    buckets: Object.entries(bucketsByPrefix).map(([prefix, mimes]) => ({
      key: prefix,
      count: mimes.reduce((sum, m) => sum + m.count, 0),
      buckets: mimes,
    })),
  };
}

/**
 * Instantiate the component class directly to test its internal logic
 * without a DOM renderer.
 */
function createInstance(props = {}) {
  const defaults = {
    selectedCategories: [],
    onToggleCategory: jest.fn(),
    agg: undefined,
    isExpanded: true,
    setExpanded: jest.fn(),
  };
  const merged = { ...defaults, ...props };
  const inst = new FileTypeSidebarFilter(merged);
  inst.props = merged;
  inst.state = { expandedCategories: new Set() };
  return inst;
}

// ── tests ────────────────────────────────────────────────────────────

describe("FileTypeSidebarFilter", () => {
  describe("buildCategoryCounts", () => {
    test("returns empty maps when no agg", () => {
      const inst = createInstance();
      const { counts, mimeCounts, uncategorisedCount } =
        inst.buildCategoryCounts();
      expect(counts.size).toBe(0);
      expect(mimeCounts.size).toBe(0);
      expect(uncategorisedCount).toBe(0);
    });

    test("sums counts per category across prefixes", () => {
      const agg = buildAgg({
        "application/": [
          { key: "application/vnd.ms-excel", count: 10 },
        ],
        "text/": [{ key: "text/csv", count: 5 }],
      });
      const inst = createInstance({ agg });
      const { counts } = inst.buildCategoryCounts();

      // Both belong to "spreadsheet"
      expect(counts.get("spreadsheet")).toBe(15);
    });

    test("tracks individual MIME counts", () => {
      const agg = buildAgg({
        "image/": [
          { key: "image/jpeg", count: 20 },
          { key: "image/png", count: 8 },
        ],
      });
      const inst = createInstance({ agg });
      const { mimeCounts } = inst.buildCategoryCounts();

      expect(mimeCounts.get("image/jpeg")).toBe(20);
      expect(mimeCounts.get("image/png")).toBe(8);
    });

    test("counts uncategorised MIMEs", () => {
      const agg = buildAgg({
        "application/": [
          { key: "application/pdf", count: 5 },
          { key: "application/x-custom-thing", count: 3 },
          { key: "application/x-weird", count: 2 },
        ],
      });
      const inst = createInstance({ agg });
      const { counts, uncategorisedCount, uncategorisedMimes } =
        inst.buildCategoryCounts();

      expect(counts.get("pdf")).toBe(5);
      expect(uncategorisedCount).toBe(5); // 3 + 2
      expect(uncategorisedMimes).toHaveLength(2);
      expect(uncategorisedMimes[0]).toEqual({
        key: "application/x-custom-thing",
        count: 3,
      });
    });

    test("all known MIMEs map to a category", () => {
      // Verify every MIME in FILE_TYPE_CATEGORIES has a mapping
      FILE_TYPE_CATEGORIES.forEach((cat) => {
        cat.mimes.forEach((mime) => {
          expect(mimeToCategory(mime)).toBe(cat.value);
        });
      });
    });
  });

  describe("toggleCategory", () => {
    test("adds a category when not selected", () => {
      const onToggle = jest.fn();
      const inst = createInstance({
        selectedCategories: ["pdf"],
        onToggleCategory: onToggle,
      });
      inst.toggleCategory("image", { stopPropagation: jest.fn() });
      expect(onToggle).toHaveBeenCalledWith(["pdf", "image"]);
    });

    test("removes a category when already selected", () => {
      const onToggle = jest.fn();
      const inst = createInstance({
        selectedCategories: ["pdf", "image"],
        onToggleCategory: onToggle,
      });
      inst.toggleCategory("pdf", { stopPropagation: jest.fn() });
      expect(onToggle).toHaveBeenCalledWith(["image"]);
    });

    test("stopPropagation is called", () => {
      const stopProp = jest.fn();
      const inst = createInstance({ onToggleCategory: jest.fn() });
      inst.toggleCategory("pdf", { stopPropagation: stopProp });
      expect(stopProp).toHaveBeenCalled();
    });
  });

  describe("toggleCategoryExpanded", () => {
    test("expands a collapsed category", () => {
      const inst = createInstance();
      // Simulate setState
      let newState;
      inst.setState = (fn) => { newState = fn(inst.state); };
      inst.toggleCategoryExpanded("pdf");
      expect(newState.expandedCategories.has("pdf")).toBe(true);
    });

    test("collapses an expanded category", () => {
      const inst = createInstance();
      inst.state.expandedCategories.add("pdf");
      let newState;
      inst.setState = (fn) => { newState = fn(inst.state); };
      inst.toggleCategoryExpanded("pdf");
      expect(newState.expandedCategories.has("pdf")).toBe(false);
    });
  });
});
