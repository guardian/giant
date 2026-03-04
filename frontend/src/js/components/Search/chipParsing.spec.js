import { parseChips, rebuildQ } from "./chipParsing";

// --- Helper to build serialized q values ---

function q(...elements) {
  return JSON.stringify(elements);
}

function chip(name, value, op = "+", type = "text", extra = {}) {
  return { n: name, v: value, op, t: type, ...extra };
}

// =============================================================================
// parseChips
// =============================================================================

describe("parseChips", () => {
  test("returns empty for null/undefined q", () => {
    expect(parseChips(null, [])).toEqual({ definedChips: [], textOnlyQ: null });
    expect(parseChips(undefined, [])).toEqual({ definedChips: [], textOnlyQ: undefined });
    expect(parseChips("", [])).toEqual({ definedChips: [], textOnlyQ: "" });
  });

  test("returns empty for non-array JSON", () => {
    const result = parseChips(JSON.stringify({ foo: "bar" }), []);
    expect(result.definedChips).toEqual([]);
  });

  test("returns empty for invalid JSON", () => {
    const result = parseChips("not json at all", []);
    expect(result.definedChips).toEqual([]);
    expect(result.textOnlyQ).toBe("not json at all");
  });

  test("extracts text-only elements", () => {
    const input = q("hello", "world");
    const { definedChips, textOnlyQ } = parseChips(input, []);
    expect(definedChips).toEqual([]);
    expect(JSON.parse(textOnlyQ)).toEqual(["hello", "world"]);
  });

  test("extracts a single-value chip", () => {
    const input = q("search text", chip("Email Subject", "hello", "+", "text"));
    const { definedChips, textOnlyQ } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      name: "Email Subject",
      value: "hello",
      negate: false,
      chipType: "text",
      multiValue: false,
    });
    expect(JSON.parse(textOnlyQ)).toEqual(["search text"]);
  });

  test("recognises negated chips (op = '-')", () => {
    const input = q(chip("Email Subject", "test", "-", "text"));
    const { definedChips } = parseChips(input, []);

    expect(definedChips[0].negate).toBe(true);
  });

  test("keeps in-progress chips (empty value) in textOnlyQ", () => {
    const inProgress = chip("Created After", "", "+", "date_ex");
    const input = q("text", inProgress);
    const { definedChips, textOnlyQ } = parseChips(input, []);

    expect(definedChips).toHaveLength(0);
    // The in-progress chip stays in textOnlyQ alongside the plain text
    const textParts = JSON.parse(textOnlyQ);
    expect(textParts).toHaveLength(2);
    expect(textParts[0]).toBe("text");
    expect(textParts[1]).toMatchObject({ n: "Created After", v: "" });
  });

  test("preserves workspace_folder extra fields", () => {
    const wf = chip("workspace_folder", "My Folder", "+", "workspace_folder", {
      workspaceId: "ws-1",
      folderId: "f-2",
    });
    const input = q(wf);
    const { definedChips } = parseChips(input, []);

    expect(definedChips[0]).toMatchObject({
      name: "workspace_folder",
      value: "My Folder",
      workspaceId: "ws-1",
      folderId: "f-2",
    });
  });

  // --- Multi-value chips ---

  test("parses multi-value Mime Type chip with OR syntax", () => {
    const input = q(chip("Mime Type", "application/pdf OR text/plain", "+", "text"));
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      name: "Mime Type",
      multiValue: true,
      values: ["application/pdf", "text/plain"],
    });
  });

  test("parses single-value Mime Type (one value, no OR)", () => {
    const input = q(chip("Mime Type", "application/pdf", "+", "text"));
    const { definedChips } = parseChips(input, []);

    expect(definedChips[0].values).toEqual(["application/pdf"]);
  });

  test("merges duplicate multi-value chip names (legacy queries)", () => {
    const input = q(
      chip("Mime Type", "application/pdf", "+", "text"),
      chip("Mime Type", "text/plain", "+", "text")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0].values).toEqual(["application/pdf", "text/plain"]);
  });

  test("deduplicates values when merging legacy chips", () => {
    const input = q(
      chip("Mime Type", "application/pdf", "+", "text"),
      chip("Mime Type", "application/pdf OR text/plain", "+", "text")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips[0].values).toEqual(["application/pdf", "text/plain"]);
  });

  test("Has Field is also treated as multi-value", () => {
    const input = q(chip("Has Field", "email OR ocr", "+", "dropdown"));
    const { definedChips } = parseChips(input, []);

    expect(definedChips[0]).toMatchObject({
      multiValue: true,
      values: ["email", "ocr"],
    });
  });

  test("attaches options from suggestedFields", () => {
    const fields = [
      { name: "Has Field", type: "dropdown", options: ["email", "ocr", "translation"] },
    ];
    const input = q(chip("Has Field", "email", "+", "dropdown"));
    const { definedChips } = parseChips(input, fields);

    expect(definedChips[0].options).toEqual(["email", "ocr", "translation"]);
  });

  // --- Mixed content ---

  test("handles mixed text + date range + multi-value chips", () => {
    const input = q(
      "free text",
      chip("Created After", "2025-01-01", "+", "date_ex"),
      chip("Mime Type", "application/pdf OR text/html", "-", "text")
    );
    const { definedChips, textOnlyQ } = parseChips(input, []);

    expect(JSON.parse(textOnlyQ)).toEqual(["free text"]);
    expect(definedChips).toHaveLength(2);
    // Mime Type comes first (processed in loop), Date Range is appended after
    expect(definedChips[0]).toMatchObject({
      name: "Mime Type",
      values: ["application/pdf", "text/html"],
      negate: true,
      multiValue: true,
    });
    expect(definedChips[1]).toMatchObject({
      name: "Date Range",
      from: "2025-01-01",
      to: "",
      dateRange: true,
    });
  });
});

// =============================================================================
// rebuildQ
// =============================================================================

describe("rebuildQ", () => {
  test("rebuilds text-only q with no chips", () => {
    const result = rebuildQ([], '["hello"]');
    expect(JSON.parse(result)).toEqual(["hello"]);
  });

  test("rebuilds a single-value chip", () => {
    const chips = [{
      name: "Email Subject",
      value: "hello",
      negate: false,
      chipType: "text",
      multiValue: false,
    }];
    const result = rebuildQ(chips, '["text"]');
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toBe("text");
    expect(parsed[1]).toMatchObject({
      n: "Email Subject",
      v: "hello",
      op: "+",
      t: "text",
    });
  });

  test("rebuilds a negated chip with op '-'", () => {
    const chips = [{
      name: "File Path",
      value: "/docs",
      negate: true,
      chipType: "text",
      multiValue: false,
    }];
    const result = rebuildQ(chips, '[]');
    const parsed = JSON.parse(result);
    expect(parsed[0].op).toBe("-");
  });

  test("rebuilds a multi-value chip with OR syntax", () => {
    const chips = [{
      name: "Mime Type",
      values: ["application/pdf", "text/plain"],
      negate: false,
      chipType: "text",
      multiValue: true,
    }];
    const result = rebuildQ(chips, '[]');
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      n: "Mime Type",
      v: "application/pdf OR text/plain",
      op: "+",
      t: "text",
    });
  });

  test("omits multi-value chip with empty values array", () => {
    const chips = [{
      name: "Mime Type",
      values: [],
      negate: false,
      chipType: "text",
      multiValue: true,
    }];
    const result = rebuildQ(chips, '["text"]');
    const parsed = JSON.parse(result);
    expect(parsed).toEqual(["text"]);
  });

  test("preserves workspace_folder extra fields", () => {
    const chips = [{
      name: "workspace_folder",
      value: "My Folder",
      negate: false,
      chipType: "workspace_folder",
      multiValue: false,
      workspaceId: "ws-1",
      folderId: "f-2",
    }];
    const result = rebuildQ(chips, '[]');
    const parsed = JSON.parse(result);

    expect(parsed[0]).toMatchObject({
      workspaceId: "ws-1",
      folderId: "f-2",
    });
  });

  test("does not include workspaceId/folderId when absent", () => {
    const chips = [{
      name: "Email Subject",
      value: "test",
      negate: false,
      chipType: "text",
      multiValue: false,
    }];
    const result = rebuildQ(chips, '[]');
    const parsed = JSON.parse(result);

    expect(parsed[0]).not.toHaveProperty("workspaceId");
    expect(parsed[0]).not.toHaveProperty("folderId");
  });

  test("returns textOnlyQ on invalid JSON", () => {
    const result = rebuildQ([], "not json");
    expect(result).toBe("not json");
  });
});

// =============================================================================
// Round-trip: parseChips → rebuildQ → parseChips
// =============================================================================

describe("round-trip", () => {
  test("single-value chips survive a round-trip", () => {
    const original = q(
      "search terms",
      chip("Email Subject", "hello", "+", "text"),
      chip("File Path", "/secret", "-", "text")
    );
    const { definedChips, textOnlyQ } = parseChips(original, []);
    const rebuilt = rebuildQ(definedChips, textOnlyQ);
    const reparsed = parseChips(rebuilt, []);

    expect(reparsed.definedChips).toHaveLength(2);
    expect(reparsed.definedChips[0]).toMatchObject({
      name: "Email Subject",
      value: "hello",
      negate: false,
    });
    expect(reparsed.definedChips[1]).toMatchObject({
      name: "File Path",
      value: "/secret",
      negate: true,
    });
    expect(JSON.parse(reparsed.textOnlyQ)).toEqual(["search terms"]);
  });

  test("multi-value chips survive a round-trip", () => {
    const original = q(
      chip("Mime Type", "application/pdf OR text/html OR text/plain", "+", "text")
    );
    const { definedChips, textOnlyQ } = parseChips(original, []);
    const rebuilt = rebuildQ(definedChips, textOnlyQ);
    const reparsed = parseChips(rebuilt, []);

    expect(reparsed.definedChips).toHaveLength(1);
    expect(reparsed.definedChips[0].values).toEqual([
      "application/pdf",
      "text/html",
      "text/plain",
    ]);
  });

  test("workspace_folder chips survive a round-trip", () => {
    const original = q(
      chip("workspace_folder", "Reports", "+", "workspace_folder", {
        workspaceId: "ws-42",
        folderId: "f-7",
      })
    );
    const { definedChips, textOnlyQ } = parseChips(original, []);
    const rebuilt = rebuildQ(definedChips, textOnlyQ);
    const reparsed = parseChips(rebuilt, []);

    expect(reparsed.definedChips[0]).toMatchObject({
      name: "workspace_folder",
      value: "Reports",
      workspaceId: "ws-42",
      folderId: "f-7",
    });
  });

  test("complex mixed query survives a round-trip", () => {
    const original = q(
      "keyword",
      chip("Created After", "2025-03-01", "+", "date_ex"),
      chip("Mime Type", "application/pdf OR image/png", "-", "text"),
      chip("Has Field", "email", "+", "dropdown"),
      chip("workspace_folder", "Inbox", "+", "workspace_folder", {
        workspaceId: "ws-1",
        folderId: "f-1",
      })
    );
    const { definedChips, textOnlyQ } = parseChips(original, []);
    // Date chips consolidate: Created After → Date Range, so 4 raw → still 4 UI chips
    expect(definedChips).toHaveLength(4);

    const rebuilt = rebuildQ(definedChips, textOnlyQ);
    const reparsed = parseChips(rebuilt, []);

    expect(reparsed.definedChips).toHaveLength(4);
    expect(JSON.parse(reparsed.textOnlyQ)).toEqual(["keyword"]);

    // Verify Date Range reconstituted
    const dr = reparsed.definedChips.find((c) => c.name === "Date Range");
    expect(dr).toMatchObject({ from: "2025-03-01", to: "", dateRange: true });
  });
});

// =============================================================================
// Dual-polarity: same name, different negate → separate chips
// =============================================================================

describe("dual-polarity multi-value chips", () => {
  test("positive and negative Mime Type chips are kept separate", () => {
    const input = q(
      chip("Mime Type", "application/pdf", "+", "text"),
      chip("Mime Type", "image/jpeg", "-", "text")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(2);
    expect(definedChips[0]).toMatchObject({
      name: "Mime Type",
      values: ["application/pdf"],
      negate: false,
      multiValue: true,
    });
    expect(definedChips[1]).toMatchObject({
      name: "Mime Type",
      values: ["image/jpeg"],
      negate: true,
      multiValue: true,
    });
  });

  test("same-polarity chips still merge", () => {
    const input = q(
      chip("Mime Type", "application/pdf", "+", "text"),
      chip("Mime Type", "text/html", "+", "text")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0].values).toEqual(["application/pdf", "text/html"]);
    expect(definedChips[0].negate).toBe(false);
  });

  test("three chips: two positive merge, one negative stays separate", () => {
    const input = q(
      chip("Mime Type", "application/pdf", "+", "text"),
      chip("Mime Type", "image/jpeg", "-", "text"),
      chip("Mime Type", "text/html", "+", "text")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(2);
    // Positive chip has both values
    const pos = definedChips.find((c) => !c.negate);
    expect(pos.values).toEqual(["application/pdf", "text/html"]);
    // Negative chip has one value
    const neg = definedChips.find((c) => c.negate);
    expect(neg.values).toEqual(["image/jpeg"]);
  });

  test("dual-polarity multi-value chips survive a round-trip", () => {
    const original = q(
      chip("Mime Type", "application/pdf OR text/html", "+", "text"),
      chip("Mime Type", "image/jpeg OR image/png", "-", "text")
    );
    const { definedChips, textOnlyQ } = parseChips(original, []);
    expect(definedChips).toHaveLength(2);

    const rebuilt = rebuildQ(definedChips, textOnlyQ);
    const reparsed = parseChips(rebuilt, []);

    expect(reparsed.definedChips).toHaveLength(2);
    const pos = reparsed.definedChips.find((c) => !c.negate);
    expect(pos.values).toEqual(["application/pdf", "text/html"]);
    const neg = reparsed.definedChips.find((c) => c.negate);
    expect(neg.values).toEqual(["image/jpeg", "image/png"]);
  });

  test("Has Field also supports dual polarity", () => {
    const input = q(
      chip("Has Field", "email", "+", "dropdown"),
      chip("Has Field", "ocr", "-", "dropdown")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(2);
    expect(definedChips[0]).toMatchObject({ negate: false, values: ["email"] });
    expect(definedChips[1]).toMatchObject({ negate: true, values: ["ocr"] });
  });
});

// =============================================================================
// File Type category chips
// =============================================================================

describe("File Type round-trip", () => {
  test("rebuildQ expands File Type categories to Mime Type backend chips", () => {
    const chips = [
      { name: "File Type", values: ["pdf", "web"], negate: false, chipType: "file_type", multiValue: true },
    ];
    const rebuilt = rebuildQ(chips, "[]");
    const parsed = JSON.parse(rebuilt);

    // Should produce a single Mime Type backend chip
    expect(parsed).toHaveLength(1);
    expect(parsed[0].n).toBe("Mime Type");
    expect(parsed[0].t).toBe("file_type");
    expect(parsed[0].op).toBe("+");
    // Should contain all mimes from pdf + web
    expect(parsed[0].v).toContain("application/pdf");
    expect(parsed[0].v).toContain("text/html");
    expect(parsed[0].v).toContain("application/xhtml+xml");
  });

  test("parseChips reconstitutes File Type from t:file_type backend chip", () => {
    const input = q(
      chip("Mime Type", "application/pdf OR text/html OR application/xhtml+xml", "+", "file_type")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      name: "File Type",
      values: ["pdf", "web"],
      negate: false,
      chipType: "file_type",
      multiValue: true,
    });
  });

  test("File Type chip survives a full round-trip", () => {
    const original = [
      { name: "File Type", values: ["spreadsheet", "email"], negate: false, chipType: "file_type", multiValue: true },
    ];
    const rebuilt = rebuildQ(original, "[]");
    const { definedChips } = parseChips(rebuilt, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0].name).toBe("File Type");
    expect(definedChips[0].values).toEqual(["spreadsheet", "email"]);
    expect(definedChips[0].negate).toBe(false);
  });

  test("negated File Type chip round-trips", () => {
    const original = [
      { name: "File Type", values: ["archive"], negate: true, chipType: "file_type", multiValue: true },
    ];
    const rebuilt = rebuildQ(original, "[]");
    const { definedChips } = parseChips(rebuilt, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0].name).toBe("File Type");
    expect(definedChips[0].values).toEqual(["archive"]);
    expect(definedChips[0].negate).toBe(true);
  });

  test("dual-polarity File Type chips round-trip independently", () => {
    const original = [
      { name: "File Type", values: ["pdf"], negate: false, chipType: "file_type", multiValue: true },
      { name: "File Type", values: ["image"], negate: true, chipType: "file_type", multiValue: true },
    ];
    const rebuilt = rebuildQ(original, "[]");
    const { definedChips } = parseChips(rebuilt, []);

    expect(definedChips).toHaveLength(2);
    const pos = definedChips.find((c) => !c.negate);
    const neg = definedChips.find((c) => c.negate);
    expect(pos.values).toEqual(["pdf"]);
    expect(neg.values).toEqual(["image"]);
  });

  test("File Type chip coexists with regular Mime Type chip", () => {
    const input = q(
      chip("Mime Type", "application/pdf", "+", "file_type"),
      chip("Mime Type", "application/json", "+", "text")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(2);
    // First is reconstituted as File Type
    expect(definedChips[0]).toMatchObject({
      name: "File Type",
      values: ["pdf"],
      multiValue: true,
    });
    // Second stays as Mime Type
    expect(definedChips[1]).toMatchObject({
      name: "Mime Type",
      values: ["application/json"],
      multiValue: true,
    });
  });

  test("File Type with empty values produces no backend chip", () => {
    const chips = [
      { name: "File Type", values: [], negate: false, chipType: "file_type", multiValue: true },
    ];
    const rebuilt = rebuildQ(chips, "[]");
    expect(JSON.parse(rebuilt)).toEqual([]);
  });

  test("File Type with unknown category keys produces no backend chip", () => {
    const chips = [
      { name: "File Type", values: ["nonexistent"], negate: false, chipType: "file_type", multiValue: true },
    ];
    const rebuilt = rebuildQ(chips, "[]");
    expect(JSON.parse(rebuilt)).toEqual([]);
  });

  test("mimes not in any category are dropped during reconstitution", () => {
    const input = q(
      chip("Mime Type", "application/pdf OR application/x-unknown", "+", "file_type")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0].values).toEqual(["pdf"]);
  });

  test("all-unknown mimes in a file_type chip produce no UI chip", () => {
    const input = q(
      chip("Mime Type", "application/x-unknown", "+", "file_type")
    );
    const { definedChips } = parseChips(input, []);
    expect(definedChips).toHaveLength(0);
  });

  test("File Type preserves text alongside chips", () => {
    const input = q(
      "search terms",
      chip("Mime Type", "application/pdf OR text/html OR application/xhtml+xml", "+", "file_type")
    );
    const { definedChips, textOnlyQ } = parseChips(input, []);

    expect(JSON.parse(textOnlyQ)).toEqual(["search terms"]);
    expect(definedChips).toHaveLength(1);
    expect(definedChips[0].name).toBe("File Type");
  });
});

// =============================================================================
// Date Range consolidation
// =============================================================================

describe("Date Range round-trip", () => {
  test("parseChips merges Created After + Created Before into one Date Range chip", () => {
    const input = q(
      chip("Created After", "2025-01-01", "+", "date_ex"),
      chip("Created Before", "2025-12-31", "+", "date")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      name: "Date Range",
      from: "2025-01-01",
      to: "2025-12-31",
      negate: false,
      chipType: "date_range",
      dateRange: true,
    });
  });

  test("parseChips handles Created After alone", () => {
    const input = q(chip("Created After", "2025-06-01", "+", "date_ex"));
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      name: "Date Range",
      from: "2025-06-01",
      to: "",
      dateRange: true,
    });
  });

  test("parseChips handles Created Before alone", () => {
    const input = q(chip("Created Before", "2025-12-31", "+", "date"));
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      name: "Date Range",
      from: "",
      to: "2025-12-31",
      dateRange: true,
    });
  });

  test("rebuildQ expands Date Range to separate backend chips", () => {
    const chips = [
      { name: "Date Range", from: "2025-01-01", to: "2025-12-31", negate: false, chipType: "date_range", dateRange: true, multiValue: false },
    ];
    const rebuilt = rebuildQ(chips, "[]");
    const parsed = JSON.parse(rebuilt);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ n: "Created After", v: "2025-01-01", op: "+" });
    expect(parsed[1]).toMatchObject({ n: "Created Before", v: "2025-12-31", op: "+" });
  });

  test("rebuildQ omits empty from/to", () => {
    const fromOnly = [
      { name: "Date Range", from: "2025-06-01", to: "", negate: false, chipType: "date_range", dateRange: true, multiValue: false },
    ];
    const rebuilt = rebuildQ(fromOnly, "[]");
    const parsed = JSON.parse(rebuilt);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ n: "Created After", v: "2025-06-01" });
  });

  test("rebuildQ produces no chips when both dates are empty", () => {
    const chips = [
      { name: "Date Range", from: "", to: "", negate: false, chipType: "date_range", dateRange: true, multiValue: false },
    ];
    const rebuilt = rebuildQ(chips, "[]");
    expect(JSON.parse(rebuilt)).toEqual([]);
  });

  test("Date Range survives a full round-trip", () => {
    const original = [
      { name: "Date Range", from: "2025-03-01", to: "2025-09-30", negate: false, chipType: "date_range", dateRange: true, multiValue: false },
    ];
    const rebuilt = rebuildQ(original, "[]");
    const { definedChips } = parseChips(rebuilt, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      name: "Date Range",
      from: "2025-03-01",
      to: "2025-09-30",
      negate: false,
      dateRange: true,
    });
  });

  test("negated Date Range round-trips", () => {
    const original = [
      { name: "Date Range", from: "2025-01-01", to: "2025-06-30", negate: true, chipType: "date_range", dateRange: true, multiValue: false },
    ];
    const rebuilt = rebuildQ(original, "[]");
    const { definedChips } = parseChips(rebuilt, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0].negate).toBe(true);
    expect(definedChips[0].from).toBe("2025-01-01");
    expect(definedChips[0].to).toBe("2025-06-30");
  });

  test("dual-polarity Date Range chips stay separate", () => {
    const input = q(
      chip("Created After", "2025-01-01", "+", "date_ex"),
      chip("Created Before", "2025-12-31", "+", "date"),
      chip("Created After", "2024-01-01", "-", "date_ex"),
      chip("Created Before", "2024-06-30", "-", "date")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(2);
    const pos = definedChips.find((c) => !c.negate);
    const neg = definedChips.find((c) => c.negate);
    expect(pos).toMatchObject({ from: "2025-01-01", to: "2025-12-31" });
    expect(neg).toMatchObject({ from: "2024-01-01", to: "2024-06-30" });
  });

  test("Date Range coexists with other chips", () => {
    const input = q(
      "search text",
      chip("Created After", "2025-01-01", "+", "date_ex"),
      chip("Mime Type", "application/pdf", "+", "text")
    );
    const { definedChips, textOnlyQ } = parseChips(input, []);

    expect(JSON.parse(textOnlyQ)).toEqual(["search text"]);
    expect(definedChips).toHaveLength(2);
    expect(definedChips.find((c) => c.name === "Date Range")).toMatchObject({
      from: "2025-01-01",
      to: "",
    });
    expect(definedChips.find((c) => c.name === "Mime Type")).toBeTruthy();
  });

  test("backwards compat: old-style separate date chips get consolidated", () => {
    // Old URLs might have t: "date_ex" / t: "date" — should still merge
    const input = q(
      chip("Created After", "2024-01-01", "+", "date_ex"),
      chip("Created Before", "2024-12-31", "+", "date")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      name: "Date Range",
      from: "2024-01-01",
      to: "2024-12-31",
      dateRange: true,
    });
  });
});
