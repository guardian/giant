import React from "react";
import FileTypeSidebarFilter, {
  FileTypeSidebarFilterState,
} from "./FileTypeSidebarFilter";
import {
  FILE_TYPE_CATEGORIES,
  mimeToCategory,
} from "../Search/fileTypeCategories";

// ── helpers ──────────────────────────────────────────────────────────

function buildAgg(
  bucketsByPrefix: Record<string, { key: string; count: number }[]>,
) {
  return {
    key: "mimeType",
    buckets: Object.entries(bucketsByPrefix).map(([prefix, mimes]) => ({
      key: prefix,
      count: mimes.reduce((sum, m) => sum + m.count, 0),
      buckets: mimes,
    })),
  };
}

function createInstance(
  props: Partial<React.ComponentProps<typeof FileTypeSidebarFilter>> = {},
) {
  const defaults = {
    positiveCategories: [] as string[],
    negativeCategories: [] as string[],
    onToggleCategory: jest.fn(),
    agg: undefined,
    isExpanded: true,
    setExpanded: jest.fn(),
  };
  const merged = { ...defaults, ...props };
  const inst = new FileTypeSidebarFilter(merged);
  Object.defineProperty(inst, "props", { value: merged, writable: true });
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
        "application/": [{ key: "application/vnd.ms-excel", count: 10 }],
        "text/": [{ key: "text/csv", count: 5 }],
      });
      const inst = createInstance({ agg });
      const { counts } = inst.buildCategoryCounts();
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
      expect(uncategorisedCount).toBe(5);
      expect(uncategorisedMimes).toHaveLength(2);
      expect(uncategorisedMimes[0]).toEqual({
        key: "application/x-custom-thing",
        count: 3,
      });
    });

    test("all known MIMEs map to a category", () => {
      FILE_TYPE_CATEGORIES.forEach((cat) => {
        cat.mimes.forEach((mime) => {
          expect(mimeToCategory(mime)).toBe(cat.value);
        });
      });
    });
  });

  describe("toggleCategory (tri-state via triStateCycle)", () => {
    test("off → positive: adds to positive", () => {
      const onToggle = jest.fn();
      const inst = createInstance({
        positiveCategories: ["pdf"],
        negativeCategories: [],
        onToggleCategory: onToggle,
      });
      inst.toggleCategory("image", {
        stopPropagation: jest.fn(),
      } as unknown as React.MouseEvent);
      expect(onToggle).toHaveBeenCalledWith({
        positive: ["pdf", "image"],
        negative: [],
      });
    });

    test("positive → negative: moves from positive to negative", () => {
      const onToggle = jest.fn();
      const inst = createInstance({
        positiveCategories: ["pdf", "image"],
        negativeCategories: [],
        onToggleCategory: onToggle,
      });
      inst.toggleCategory("pdf", {
        stopPropagation: jest.fn(),
      } as unknown as React.MouseEvent);
      expect(onToggle).toHaveBeenCalledWith({
        positive: ["image"],
        negative: ["pdf"],
      });
    });

    test("negative → off: removes from negative", () => {
      const onToggle = jest.fn();
      const inst = createInstance({
        positiveCategories: [],
        negativeCategories: ["pdf"],
        onToggleCategory: onToggle,
      });
      inst.toggleCategory("pdf", {
        stopPropagation: jest.fn(),
      } as unknown as React.MouseEvent);
      expect(onToggle).toHaveBeenCalledWith({
        positive: [],
        negative: [],
      });
    });

    test("stopPropagation is called", () => {
      const stopProp = jest.fn();
      const inst = createInstance({ onToggleCategory: jest.fn() });
      inst.toggleCategory("pdf", {
        stopPropagation: stopProp,
      } as unknown as React.MouseEvent);
      expect(stopProp).toHaveBeenCalled();
    });
  });

  describe("getCategoryState", () => {
    test("returns 'positive' for positive categories", () => {
      const inst = createInstance({ positiveCategories: ["pdf"] });
      expect(inst.getCategoryState("pdf")).toBe("positive");
    });

    test("returns 'negative' for negative categories", () => {
      const inst = createInstance({ negativeCategories: ["image"] });
      expect(inst.getCategoryState("image")).toBe("negative");
    });

    test("returns 'off' for unselected categories", () => {
      const inst = createInstance();
      expect(inst.getCategoryState("pdf")).toBe("off");
    });
  });

  describe("toggleCategoryExpanded", () => {
    test("expands a collapsed category", () => {
      const inst = createInstance();
      let newState: FileTypeSidebarFilterState | undefined;
      inst.setState = ((
        fn: (prev: FileTypeSidebarFilterState) => FileTypeSidebarFilterState,
      ) => {
        newState = fn(inst.state);
      }) as typeof inst.setState;
      inst.toggleCategoryExpanded("pdf");
      expect(newState!.expandedCategories.has("pdf")).toBe(true);
    });

    test("collapses an expanded category", () => {
      const inst = createInstance();
      inst.state.expandedCategories.add("pdf");
      let newState: FileTypeSidebarFilterState | undefined;
      inst.setState = ((
        fn: (prev: FileTypeSidebarFilterState) => FileTypeSidebarFilterState,
      ) => {
        newState = fn(inst.state);
      }) as typeof inst.setState;
      inst.toggleCategoryExpanded("pdf");
      expect(newState!.expandedCategories.has("pdf")).toBe(false);
    });
  });
});
