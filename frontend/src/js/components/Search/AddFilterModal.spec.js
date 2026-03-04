import { extractPlainText, wrapPlainText } from "./SearchBox";
import AddFilterModal from "./AddFilterModal";
import {
  CHIP_NAME_FILE_TYPE,
  CHIP_NAME_DATE_RANGE,
  CHIP_NAME_HAS_FIELD,
  CHIP_KIND_SINGLE,
  CHIP_KIND_MULTI,
  CHIP_KIND_DATE_RANGE,
  CHIP_TYPE_TEXT,
  CHIP_TYPE_FILE_TYPE,
  CHIP_TYPE_DATE_RANGE,
  CHIP_TYPE_DROPDOWN,
} from "./chipNames";

// =============================================================================
// extractPlainText
// =============================================================================

describe("extractPlainText", () => {
  test("returns empty string for null/undefined/empty input", () => {
    expect(extractPlainText(null)).toBe("");
    expect(extractPlainText(undefined)).toBe("");
    expect(extractPlainText("")).toBe("");
  });

  test("extracts text from a single-element JSON array", () => {
    expect(extractPlainText(JSON.stringify(["hello world"]))).toBe(
      "hello world",
    );
  });

  test("joins multiple text segments", () => {
    expect(extractPlainText(JSON.stringify(["hello", "world"]))).toBe(
      "hello world",
    );
  });

  test("ignores chip objects in the array", () => {
    const q = JSON.stringify([
      "search",
      { n: "Mime Type", v: "application/pdf", op: "+", t: "text" },
      "more",
    ]);
    expect(extractPlainText(q)).toBe("search more");
  });

  test("returns the raw string for non-array JSON", () => {
    expect(extractPlainText(JSON.stringify({ foo: "bar" }))).toBe(
      '{"foo":"bar"}',
    );
  });

  test("returns the raw string for invalid JSON", () => {
    expect(extractPlainText("not json")).toBe("not json");
  });

  test("trims whitespace", () => {
    expect(extractPlainText(JSON.stringify(["  hello  ", "  "]))).toBe("hello");
  });
});

// =============================================================================
// wrapPlainText
// =============================================================================

describe("wrapPlainText", () => {
  test("wraps text in a JSON array", () => {
    expect(wrapPlainText("hello")).toBe('["hello"]');
  });

  test("wraps empty string", () => {
    expect(wrapPlainText("")).toBe('[""]');
  });

  test("round-trips with extractPlainText", () => {
    const text = "search query";
    expect(extractPlainText(wrapPlainText(text))).toBe(text);
  });
});

// =============================================================================
// AddFilterModal
// =============================================================================

describe("AddFilterModal", () => {
  // Helper to create an instance and access methods directly
  function createModal(props = {}) {
    const defaultProps = {
      isOpen: true,
      editingChip: null,
      editingChipIndex: -1,
      availableFilters: [
        { name: "Has Field", type: "dropdown", options: ["ocr", "transcript"] },
        { name: "Email Subject", type: "text" },
      ],
      onConfirm: jest.fn(),
      onClose: jest.fn(),
    };
    const merged = { ...defaultProps, ...props };
    const instance = new AddFilterModal(merged);
    instance.props = merged;
    return instance;
  }

  describe("getFilterList", () => {
    test("includes built-in filters plus backend filters (minus hidden)", () => {
      const modal = createModal({
        availableFilters: [
          { name: "Has Field", type: "dropdown" },
          { name: "Email Subject", type: "text" },
          { name: "Created After", type: "date_ex" },
          { name: "Created Before", type: "date_ex" },
          { name: "Mime Type", type: "text" },
        ],
      });
      const list = modal.getFilterList();
      const names = list.map((f) => f.name);

      // Built-ins should be present
      expect(names).toContain(CHIP_NAME_FILE_TYPE);
      expect(names).toContain(CHIP_NAME_DATE_RANGE);

      // Backend filters that are NOT hidden
      expect(names).toContain("Has Field");
      expect(names).toContain("Email Subject");

      // Hidden backend filters should NOT appear
      expect(names).not.toContain("Created After");
      expect(names).not.toContain("Created Before");
      expect(names).not.toContain("Mime Type");
    });

    test("does not duplicate if backend already includes a built-in name", () => {
      const modal = createModal({
        availableFilters: [{ name: CHIP_NAME_FILE_TYPE, type: "file_type" }],
      });
      const list = modal.getFilterList();
      const fileTypeCount = list.filter(
        (f) => f.name === CHIP_NAME_FILE_TYPE,
      ).length;
      expect(fileTypeCount).toBe(1);
    });
  });

  describe("getInitialFormState", () => {
    test("returns blank state for new filter", () => {
      const modal = createModal({ editingChip: null });
      const state = modal.getInitialFormState(modal.props);
      expect(state.selectedFilter).toBe("");
      expect(state.polarity).toBe("include");
      expect(state.textValue).toBe("");
      expect(state.multiValues).toEqual([]);
      expect(state.dateFrom).toBe("");
      expect(state.dateTo).toBe("");
    });

    test("pre-fills from a single-value chip", () => {
      const chip = {
        kind: CHIP_KIND_SINGLE,
        name: "Email Subject",
        value: "important",
        negate: true,
        chipType: CHIP_TYPE_TEXT,
      };
      const modal = createModal({ editingChip: chip, editingChipIndex: 0 });
      const state = modal.getInitialFormState(modal.props);
      expect(state.selectedFilter).toBe("Email Subject");
      expect(state.polarity).toBe("exclude");
      expect(state.textValue).toBe("important");
    });

    test("pre-fills from a multi-value chip", () => {
      const chip = {
        kind: CHIP_KIND_MULTI,
        name: CHIP_NAME_FILE_TYPE,
        values: ["pdf", "word"],
        negate: false,
        chipType: CHIP_TYPE_FILE_TYPE,
      };
      const modal = createModal({ editingChip: chip, editingChipIndex: 0 });
      const state = modal.getInitialFormState(modal.props);
      expect(state.selectedFilter).toBe(CHIP_NAME_FILE_TYPE);
      expect(state.polarity).toBe("include");
      expect(state.multiValues).toEqual(["pdf", "word"]);
    });

    test("pre-fills from a date range chip", () => {
      const chip = {
        kind: CHIP_KIND_DATE_RANGE,
        name: CHIP_NAME_DATE_RANGE,
        from: "2025-01-01",
        to: "2025-12-31",
        negate: false,
        chipType: CHIP_TYPE_DATE_RANGE,
      };
      const modal = createModal({ editingChip: chip, editingChipIndex: 0 });
      const state = modal.getInitialFormState(modal.props);
      expect(state.selectedFilter).toBe(CHIP_NAME_DATE_RANGE);
      expect(state.dateFrom).toBe("2025-01-01");
      expect(state.dateTo).toBe("2025-12-31");
    });
  });

  describe("isValid", () => {
    test("returns false when no filter is selected", () => {
      const modal = createModal();
      modal.state = {
        selectedFilter: "",
        textValue: "",
        multiValues: [],
        dateFrom: "",
        dateTo: "",
      };
      expect(modal.isValid()).toBe(false);
    });

    test("returns false for single-value with empty text", () => {
      const modal = createModal();
      modal.state = {
        selectedFilter: "Email Subject",
        textValue: "   ",
        multiValues: [],
        dateFrom: "",
        dateTo: "",
      };
      expect(modal.isValid()).toBe(false);
    });

    test("returns true for single-value with non-empty text", () => {
      const modal = createModal();
      modal.state = {
        selectedFilter: "Email Subject",
        textValue: "hello",
        multiValues: [],
        dateFrom: "",
        dateTo: "",
      };
      expect(modal.isValid()).toBe(true);
    });

    test("returns false for multi-value with no selections", () => {
      const modal = createModal();
      modal.state = {
        selectedFilter: CHIP_NAME_FILE_TYPE,
        textValue: "",
        multiValues: [],
        dateFrom: "",
        dateTo: "",
      };
      expect(modal.isValid()).toBe(false);
    });

    test("returns true for multi-value with selections", () => {
      const modal = createModal();
      modal.state = {
        selectedFilter: CHIP_NAME_FILE_TYPE,
        textValue: "",
        multiValues: ["pdf"],
        dateFrom: "",
        dateTo: "",
      };
      expect(modal.isValid()).toBe(true);
    });

    test("returns false for date range with no dates", () => {
      const modal = createModal();
      modal.state = {
        selectedFilter: CHIP_NAME_DATE_RANGE,
        textValue: "",
        multiValues: [],
        dateFrom: "",
        dateTo: "",
      };
      expect(modal.isValid()).toBe(false);
    });

    test("returns true for date range with at least one date", () => {
      const modal = createModal();
      modal.state = {
        selectedFilter: CHIP_NAME_DATE_RANGE,
        textValue: "",
        multiValues: [],
        dateFrom: "2025-01-01",
        dateTo: "",
      };
      expect(modal.isValid()).toBe(true);
    });
  });

  describe("handleConfirm", () => {
    test("builds correct single-value chip", () => {
      const onConfirm = jest.fn();
      const modal = createModal({ onConfirm, editingChipIndex: -1 });
      modal.state = {
        selectedFilter: "Email Subject",
        polarity: "include",
        textValue: "urgent",
        multiValues: [],
        dateFrom: "",
        dateTo: "",
      };
      modal.handleConfirm();
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: CHIP_KIND_SINGLE,
          name: "Email Subject",
          value: "urgent",
          negate: false,
          chipType: CHIP_TYPE_TEXT,
        }),
        -1,
      );
    });

    test("builds correct multi-value chip", () => {
      const onConfirm = jest.fn();
      const modal = createModal({ onConfirm, editingChipIndex: -1 });
      modal.state = {
        selectedFilter: CHIP_NAME_FILE_TYPE,
        polarity: "exclude",
        textValue: "",
        multiValues: ["pdf", "spreadsheet"],
        dateFrom: "",
        dateTo: "",
      };
      modal.handleConfirm();
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: CHIP_KIND_MULTI,
          name: CHIP_NAME_FILE_TYPE,
          values: ["pdf", "spreadsheet"],
          negate: true,
          chipType: CHIP_TYPE_FILE_TYPE,
        }),
        -1,
      );
    });

    test("builds correct date range chip", () => {
      const onConfirm = jest.fn();
      const modal = createModal({ onConfirm, editingChipIndex: -1 });
      modal.state = {
        selectedFilter: CHIP_NAME_DATE_RANGE,
        polarity: "include",
        textValue: "",
        multiValues: [],
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
      };
      modal.handleConfirm();
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: CHIP_KIND_DATE_RANGE,
          name: CHIP_NAME_DATE_RANGE,
          from: "2025-01-01",
          to: "2025-12-31",
          negate: false,
          chipType: CHIP_TYPE_DATE_RANGE,
        }),
        -1,
      );
    });

    test("does not call onConfirm when invalid", () => {
      const onConfirm = jest.fn();
      const modal = createModal({ onConfirm });
      modal.state = {
        selectedFilter: "",
        polarity: "include",
        textValue: "",
        multiValues: [],
        dateFrom: "",
        dateTo: "",
      };
      modal.handleConfirm();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    test("passes editingChipIndex for editing", () => {
      const onConfirm = jest.fn();
      const modal = createModal({ onConfirm, editingChipIndex: 2 });
      modal.state = {
        selectedFilter: "Email Subject",
        polarity: "exclude",
        textValue: "changed",
        multiValues: [],
        dateFrom: "",
        dateTo: "",
      };
      modal.handleConfirm();
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Email Subject",
          value: "changed",
          negate: true,
        }),
        2,
      );
    });
  });
});
