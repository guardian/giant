import SearchBox from "./SearchBox";
import { parseChips, rebuildQ } from "./chipParsing";
import {
  CHIP_KIND_SINGLE,
  CHIP_KIND_MULTI,
  CHIP_KIND_DATE_RANGE,
  CHIP_TYPE_TEXT,
  CHIP_TYPE_DROPDOWN,
  CHIP_TYPE_DATE_RANGE,
  CHIP_TYPE_FILE_TYPE,
  CHIP_TYPE_DATASET,
  CHIP_TYPE_WORKSPACE,
} from "./chipNames";

// ---------------------------------------------------------------------------
// Helper: create a minimal SearchBox instance with mock props.
// The instance never touches the DOM — we only call its handler methods.
// ---------------------------------------------------------------------------

function createInstance(q, suggestedFields = [], searchText = "") {
  const onFilterChange = jest.fn();
  const inst = new SearchBox({
    q,
    searchText,
    suggestedFields,
    onFilterChange,
    isSearchInProgress: false,
    onSearchTextChange: jest.fn(),
    resetQuery: jest.fn(),
    onSubmit: jest.fn(),
  });
  return { inst, onFilterChange };
}

/** Convenience: build a serialised q string */
function q(...elements) {
  return JSON.stringify(elements);
}

function chip(name, value, op = "+", type = "text", extra = {}) {
  return { n: name, v: value, op, t: type, ...extra };
}

/** Parse the q passed to onFilterChange and return definedChips */
function resultChips(onFilterChange, suggestedFields = []) {
  const newQ = onFilterChange.mock.calls[0][0];
  return parseChips(newQ, suggestedFields).definedChips;
}

// =============================================================================
// handleRemoveChip
// =============================================================================

describe("SearchBox.handleRemoveChip", () => {
  test("removes a single-value chip by index", () => {
    const initial = q(
      "text",
      chip("Email Subject", "test", "+", "text"),
      chip("File Path", "/docs", "-", "text"),
    );
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleRemoveChip(0); // remove "Email Subject"

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ name: "File Path", value: "/docs" });
  });

  test("removes a multi-value chip by index", () => {
    const initial = q(
      chip("Mime Type", "application/pdf OR text/html", "+", "text"),
    );
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleRemoveChip(0);

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(0);
  });

  test("preserves text when removing the only chip", () => {
    const initial = q(
      "search terms",
      chip("Email Subject", "hello", "+", "text"),
    );
    const { inst, onFilterChange } = createInstance(
      initial,
      [],
      "search terms",
    );
    inst.handleRemoveChip(0);

    const newQ = onFilterChange.mock.calls[0][0];
    const parsed = JSON.parse(newQ);
    expect(parsed).toEqual(["search terms"]);
  });
});

// =============================================================================
// handleToggleNegate
// =============================================================================

describe("SearchBox.handleToggleNegate", () => {
  test("flips a single-value chip from include to exclude", () => {
    const initial = q(chip("Email Subject", "hello", "+", "text"));
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleToggleNegate(0);

    const chips = resultChips(onFilterChange);
    expect(chips[0].negate).toBe(true);
  });

  test("flips a single-value chip from exclude to include", () => {
    const initial = q(chip("Email Subject", "hello", "-", "text"));
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleToggleNegate(0);

    const chips = resultChips(onFilterChange);
    expect(chips[0].negate).toBe(false);
  });

  test("merges multi-value chip into existing same-name chip when toggling", () => {
    // Positive Mime Type with "pdf", negative Mime Type with "html"
    const initial = q(
      chip("Mime Type", "application/pdf", "+", "text"),
      chip("Mime Type", "text/html", "-", "text"),
    );
    const { inst, onFilterChange } = createInstance(initial);
    // Toggle the negative chip (index 1) → becomes positive → merges into index 0
    inst.handleToggleNegate(1);

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(1);
    expect(chips[0].negate).toBe(false);
    expect(chips[0].values).toEqual(["application/pdf", "text/html"]);
  });

  test("simple flip when no merge target exists", () => {
    const initial = q(chip("Mime Type", "application/pdf", "+", "text"));
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleToggleNegate(0);

    const chips = resultChips(onFilterChange);
    expect(chips[0].negate).toBe(true);
    expect(chips[0].values).toEqual(["application/pdf"]);
  });
});

// =============================================================================
// handleEditChipValue
// =============================================================================

describe("SearchBox.handleEditChipValue", () => {
  test("updates a single-value chip", () => {
    const initial = q(chip("Email Subject", "old", "+", "text"));
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleEditChipValue(0, "new");

    const chips = resultChips(onFilterChange);
    expect(chips[0].value).toBe("new");
  });

  test("updates a multi-value chip with new values array", () => {
    const initial = q(chip("Mime Type", "application/pdf", "+", "text"));
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleEditChipValue(0, ["text/html", "text/csv"]);

    const chips = resultChips(onFilterChange);
    expect(chips[0].values).toEqual(["text/html", "text/csv"]);
  });

  test("removes a multi-value chip when values are emptied", () => {
    const initial = q(chip("Mime Type", "application/pdf", "+", "text"));
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleEditChipValue(0, []);

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(0);
  });

  test("updates a date range chip with from/to object", () => {
    const initial = q(
      chip("Created After", "2025-01-01", "+", "date_ex"),
      chip("Created Before", "2025-12-31", "+", "date"),
    );
    const { inst, onFilterChange } = createInstance(initial);
    // parseChips consolidates into one Date Range chip at index 0
    inst.handleEditChipValue(0, { from: "2025-06-01", to: "2025-09-30" });

    const chips = resultChips(onFilterChange);
    const dr = chips.find((c) => c.kind === CHIP_KIND_DATE_RANGE);
    expect(dr.from).toBe("2025-06-01");
    expect(dr.to).toBe("2025-09-30");
  });

  test("removes a date range chip when both dates are cleared", () => {
    const initial = q(chip("Created After", "2025-01-01", "+", "date_ex"));
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleEditChipValue(0, { from: "", to: "" });

    const chips = resultChips(onFilterChange);
    expect(chips.find((c) => c.kind === CHIP_KIND_DATE_RANGE)).toBeUndefined();
  });
});

// =============================================================================
// handleActivateDefault
// =============================================================================

describe("SearchBox.handleActivateDefault", () => {
  test("creates a new single-value chip", () => {
    const initial = q("text");
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleActivateDefault("Email Subject", "hello", CHIP_TYPE_TEXT);

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      kind: CHIP_KIND_SINGLE,
      name: "Email Subject",
      value: "hello",
      negate: false,
      chipType: CHIP_TYPE_TEXT,
    });
  });

  test("creates a new multi-value chip", () => {
    const initial = q("text");
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleActivateDefault(
      "Mime Type",
      ["application/pdf", "text/html"],
      CHIP_TYPE_TEXT,
    );

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      kind: CHIP_KIND_MULTI,
      name: "Mime Type",
      values: ["application/pdf", "text/html"],
    });
  });

  test("merges values into an existing multi-value chip of the same polarity", () => {
    const initial = q(chip("Mime Type", "application/pdf", "+", "text"));
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleActivateDefault(
      "Mime Type",
      ["text/html"],
      CHIP_TYPE_TEXT,
      false,
    );

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(1);
    expect(chips[0].values).toEqual(["application/pdf", "text/html"]);
  });

  test("does not merge when polarities differ", () => {
    const initial = q(chip("Mime Type", "application/pdf", "+", "text"));
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleActivateDefault(
      "Mime Type",
      ["text/html"],
      CHIP_TYPE_TEXT,
      true,
    );

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(2);
    expect(chips[0]).toMatchObject({
      negate: false,
      values: ["application/pdf"],
    });
    expect(chips[1]).toMatchObject({ negate: true, values: ["text/html"] });
  });

  test("creates a negated chip when negate=true", () => {
    const initial = q("text");
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleActivateDefault("File Path", "/secret", CHIP_TYPE_TEXT, true);

    const chips = resultChips(onFilterChange);
    expect(chips[0].negate).toBe(true);
  });

  test("creates a new Date Range chip", () => {
    const initial = q("text");
    const { inst, onFilterChange } = createInstance(initial);
    inst.handleActivateDefault(
      "Date Range",
      { from: "2025-01-01", to: "2025-12-31" },
      CHIP_TYPE_DATE_RANGE,
    );

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      kind: CHIP_KIND_DATE_RANGE,
      from: "2025-01-01",
      to: "2025-12-31",
    });
  });

  test("merges into an existing Date Range chip of the same polarity", () => {
    const initial = q(chip("Created After", "2025-01-01", "+", "date_ex"));
    const { inst, onFilterChange } = createInstance(initial);
    // Existing Date Range has from="2025-01-01", to="". Add a "to" date.
    inst.handleActivateDefault(
      "Date Range",
      { from: "", to: "2025-12-31" },
      CHIP_TYPE_DATE_RANGE,
    );

    const chips = resultChips(onFilterChange);
    const dr = chips.find((c) => c.kind === CHIP_KIND_DATE_RANGE);
    // "from" should remain from the existing chip, "to" should be the new value
    expect(dr.from).toBe("2025-01-01");
    expect(dr.to).toBe("2025-12-31");
  });

  test("deduplicates values when merging multi-value chips", () => {
    const initial = q(
      chip("Mime Type", "application/pdf OR text/html", "+", "text"),
    );
    const { inst, onFilterChange } = createInstance(initial);
    // Try to add "application/pdf" again + one new value
    inst.handleActivateDefault(
      "Mime Type",
      ["application/pdf", "text/csv"],
      CHIP_TYPE_TEXT,
      false,
    );

    const chips = resultChips(onFilterChange);
    expect(chips[0].values).toEqual([
      "application/pdf",
      "text/html",
      "text/csv",
    ]);
  });
});

// =============================================================================
// handleModalConfirm
// =============================================================================

describe("SearchBox.handleModalConfirm", () => {
  // handleModalConfirm calls handleCloseModal which calls setState.
  // Since we're testing an unmounted instance, mock setState to suppress the warning.
  function confirmOnInstance(inst, chip, editIndex) {
    inst.setState = jest.fn();
    inst.handleModalConfirm(chip, editIndex);
  }

  test("editing an existing chip replaces it at the given index", () => {
    const initial = q(
      chip("Email Subject", "old value", "+", "text"),
      chip("File Path", "/docs", "+", "text"),
    );
    const { inst, onFilterChange } = createInstance(initial);

    const replacement = {
      kind: CHIP_KIND_SINGLE,
      name: "Email Subject",
      value: "new value",
      negate: false,
      chipType: CHIP_TYPE_TEXT,
    };
    confirmOnInstance(inst, replacement, 0);

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(2);
    expect(chips[0].value).toBe("new value");
    expect(chips[1]).toMatchObject({ name: "File Path", value: "/docs" });
  });

  test("adding a new single-value chip (editIndex = -1)", () => {
    const initial = q("text");
    const { inst, onFilterChange } = createInstance(initial);

    const newChip = {
      kind: CHIP_KIND_SINGLE,
      name: "Email Subject",
      value: "hello",
      negate: false,
      chipType: CHIP_TYPE_TEXT,
    };
    confirmOnInstance(inst, newChip, -1);

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ name: "Email Subject", value: "hello" });
  });

  test("adding a new multi-value chip delegates to handleActivateDefault", () => {
    const initial = q("text");
    const { inst, onFilterChange } = createInstance(initial);

    const newChip = {
      kind: CHIP_KIND_MULTI,
      name: "Has Field",
      values: ["email", "ocr"],
      negate: false,
      chipType: CHIP_TYPE_DROPDOWN,
    };
    confirmOnInstance(inst, newChip, -1);

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      kind: CHIP_KIND_MULTI,
      name: "Has Field",
      values: ["email", "ocr"],
    });
  });

  test("adding a new Date Range chip delegates to handleActivateDefault", () => {
    const initial = q("text");
    const { inst, onFilterChange } = createInstance(initial);

    const newChip = {
      kind: CHIP_KIND_DATE_RANGE,
      name: "Date Range",
      from: "2025-01-01",
      to: "2025-06-30",
      negate: false,
      chipType: CHIP_TYPE_DATE_RANGE,
    };
    confirmOnInstance(inst, newChip, -1);

    const chips = resultChips(onFilterChange);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      kind: CHIP_KIND_DATE_RANGE,
      from: "2025-01-01",
      to: "2025-06-30",
    });
  });

  test("closes the modal after confirming", () => {
    const initial = q("text");
    const { inst } = createInstance(initial);

    const newChip = {
      kind: CHIP_KIND_SINGLE,
      name: "Email Subject",
      value: "hello",
      negate: false,
      chipType: CHIP_TYPE_TEXT,
    };
    confirmOnInstance(inst, newChip, -1);

    expect(inst.setState).toHaveBeenCalledWith({
      modalOpen: false,
      editingChip: null,
      editingChipIndex: -1,
    });
  });
});
