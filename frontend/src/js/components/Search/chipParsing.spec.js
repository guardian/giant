import { parseChips, rebuildQ, toBackendQ, getFileTypeCategoriesFromQ, setFileTypeCategoriesInQ, getDatasetsFromQ, setDatasetsInQ, getWorkspacesFromQ, setWorkspacesInQ, extractCollectionAndWorkspaceChips } from "./chipParsing";

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
      kind: "single",
      name: "Email Subject",
      value: "hello",
      negate: false,
      chipType: "text",
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
      kind: "single",
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
      kind: "multi",
      name: "Mime Type",
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
      kind: "multi",
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
      kind: "multi",
      name: "Mime Type",
      values: ["application/pdf", "text/html"],
      negate: true,
    });
    expect(definedChips[1]).toMatchObject({
      kind: "dateRange",
      name: "Date Range",
      from: "2025-01-01",
      to: "",
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
      kind: "single",
      name: "Email Subject",
      value: "hello",
      negate: false,
      chipType: "text",
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
      kind: "single",
      name: "File Path",
      value: "/docs",
      negate: true,
      chipType: "text",
    }];
    const result = rebuildQ(chips, '[]');
    const parsed = JSON.parse(result);
    expect(parsed[0].op).toBe("-");
  });

  test("rebuilds a multi-value chip with OR syntax", () => {
    const chips = [{
      kind: "multi",
      name: "Mime Type",
      values: ["application/pdf", "text/plain"],
      negate: false,
      chipType: "text",
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
      kind: "multi",
      name: "Mime Type",
      values: [],
      negate: false,
      chipType: "text",
    }];
    const result = rebuildQ(chips, '["text"]');
    const parsed = JSON.parse(result);
    expect(parsed).toEqual(["text"]);
  });

  test("preserves workspace_folder extra fields", () => {
    const chips = [{
      kind: "single",
      name: "workspace_folder",
      value: "My Folder",
      negate: false,
      chipType: "workspace_folder",
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
      kind: "single",
      name: "Email Subject",
      value: "test",
      negate: false,
      chipType: "text",
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
      kind: "single",
      name: "Email Subject",
      value: "hello",
      negate: false,
    });
    expect(reparsed.definedChips[1]).toMatchObject({
      kind: "single",
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
      kind: "single",
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
    expect(dr).toMatchObject({ kind: "dateRange", from: "2025-03-01", to: "" });
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
      kind: "multi",
      name: "Mime Type",
      values: ["application/pdf"],
      negate: false,
    });
    expect(definedChips[1]).toMatchObject({
      kind: "multi",
      name: "Mime Type",
      values: ["image/jpeg"],
      negate: true,
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
  test("rebuildQ serializes File Type as n:File Type (not Mime Type)", () => {
    const chips = [
      { kind: "multi", name: "File Type", values: ["pdf", "web"], negate: false, chipType: "file_type" },
    ];
    const rebuilt = rebuildQ(chips, "[]");
    const parsed = JSON.parse(rebuilt);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].n).toBe("File Type");
    expect(parsed[0].v).toBe("pdf OR web");
    expect(parsed[0].op).toBe("+");
  });

  test("parseChips parses File Type chip directly (no reconstitution needed)", () => {
    const input = q(chip("File Type", "pdf OR web", "+", "file_type"));
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      kind: "multi",
      name: "File Type",
      values: ["pdf", "web"],
      negate: false,
      chipType: "file_type",
    });
  });

  test("File Type chip survives a full round-trip", () => {
    const original = [
      { kind: "multi", name: "File Type", values: ["spreadsheet", "email"], negate: false, chipType: "file_type" },
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
      { kind: "multi", name: "File Type", values: ["archive"], negate: true, chipType: "file_type" },
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
      { kind: "multi", name: "File Type", values: ["pdf"], negate: false, chipType: "file_type" },
      { kind: "multi", name: "File Type", values: ["image"], negate: true, chipType: "file_type" },
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
      chip("File Type", "pdf", "+", "file_type"),
      chip("Mime Type", "application/json", "+", "text")
    );
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(2);
    expect(definedChips[0]).toMatchObject({
      kind: "multi",
      name: "File Type",
      values: ["pdf"],
    });
    expect(definedChips[1]).toMatchObject({
      kind: "multi",
      name: "Mime Type",
      values: ["application/json"],
    });
  });

  test("File Type with empty values produces no backend chip", () => {
    const chips = [
      { kind: "multi", name: "File Type", values: [], negate: false, chipType: "file_type" },
    ];
    const rebuilt = rebuildQ(chips, "[]");
    expect(JSON.parse(rebuilt)).toEqual([]);
  });

  test("File Type preserves text alongside chips", () => {
    const input = q(
      "search terms",
      chip("File Type", "pdf OR web", "+", "file_type")
    );
    const { definedChips, textOnlyQ } = parseChips(input, []);

    expect(JSON.parse(textOnlyQ)).toEqual(["search terms"]);
    expect(definedChips).toHaveLength(1);
    expect(definedChips[0].name).toBe("File Type");
  });
});

// =============================================================================
// toBackendQ — API boundary transform
// =============================================================================

describe("toBackendQ", () => {
  test("returns null/empty unchanged", () => {
    expect(toBackendQ(null)).toBe(null);
    expect(toBackendQ(undefined)).toBe(undefined);
    expect(toBackendQ("")).toBe("");
  });

  test("returns non-array JSON unchanged", () => {
    const input = JSON.stringify({ foo: "bar" });
    expect(toBackendQ(input)).toBe(input);
  });

  test("returns invalid JSON unchanged", () => {
    expect(toBackendQ("not json")).toBe("not json");
  });

  test("passes through text elements unchanged", () => {
    const input = q("hello", "world");
    expect(toBackendQ(input)).toBe(input);
  });

  test("passes through non-File Type chips unchanged", () => {
    const input = q(
      chip("Mime Type", "application/pdf", "+", "text"),
      chip("Email Subject", "hello", "+", "text")
    );
    expect(toBackendQ(input)).toBe(input);
  });

  test("expands File Type to Mime Type", () => {
    const input = q(chip("File Type", "pdf", "+", "file_type"));
    const result = JSON.parse(toBackendQ(input));

    expect(result).toHaveLength(1);
    expect(result[0].n).toBe("Mime Type");
    // Values are double-quoted so ES query-string doesn't treat / as regex
    expect(result[0].v).toContain('"application/pdf"');
    expect(result[0].op).toBe("+");
  });

  test("expands multiple File Type categories", () => {
    const input = q(chip("File Type", "pdf OR web", "+", "file_type"));
    const result = JSON.parse(toBackendQ(input));

    expect(result[0].n).toBe("Mime Type");
    expect(result[0].v).toContain('"application/pdf"');
    expect(result[0].v).toContain('"text/html"');
    expect(result[0].v).toContain('"application/xhtml+xml"');
  });

  test("preserves op and other fields during expansion", () => {
    const input = q(chip("File Type", "pdf", "-", "file_type"));
    const result = JSON.parse(toBackendQ(input));

    expect(result[0].op).toBe("-");
    expect(result[0].n).toBe("Mime Type");
  });

  test("leaves non-File Type chips untouched alongside File Type", () => {
    const input = q(
      "text",
      chip("File Type", "pdf", "+", "file_type"),
      chip("Email Subject", "hello", "+", "text")
    );
    const result = JSON.parse(toBackendQ(input));

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("text");
    expect(result[1].n).toBe("Mime Type");
    expect(result[2]).toMatchObject({ n: "Email Subject", v: "hello" });
  });

  test("full pipeline: rebuildQ → toBackendQ produces backend-ready chips", () => {
    const chips = [
      { kind: "multi", name: "File Type", values: ["pdf", "spreadsheet"], negate: false, chipType: "file_type" },
    ];
    const uiQ = rebuildQ(chips, "[]");
    const backendQ = toBackendQ(uiQ);
    const parsed = JSON.parse(backendQ);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].n).toBe("Mime Type");
    expect(parsed[0].v).toContain('"application/pdf"');
    expect(parsed[0].v).toContain('"application/vnd.ms-excel"');
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
      kind: "dateRange",
      name: "Date Range",
      from: "2025-01-01",
      to: "2025-12-31",
      negate: false,
      chipType: "date_range",
    });
  });

  test("parseChips handles Created After alone", () => {
    const input = q(chip("Created After", "2025-06-01", "+", "date_ex"));
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      kind: "dateRange",
      name: "Date Range",
      from: "2025-06-01",
      to: "",
    });
  });

  test("parseChips handles Created Before alone", () => {
    const input = q(chip("Created Before", "2025-12-31", "+", "date"));
    const { definedChips } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      kind: "dateRange",
      name: "Date Range",
      from: "",
      to: "2025-12-31",
    });
  });

  test("rebuildQ expands Date Range to separate backend chips", () => {
    const chips = [
      { kind: "dateRange", name: "Date Range", from: "2025-01-01", to: "2025-12-31", negate: false, chipType: "date_range" },
    ];
    const rebuilt = rebuildQ(chips, "[]");
    const parsed = JSON.parse(rebuilt);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ n: "Created After", v: "2025-01-01", op: "+" });
    expect(parsed[1]).toMatchObject({ n: "Created Before", v: "2025-12-31", op: "+" });
  });

  test("rebuildQ omits empty from/to", () => {
    const fromOnly = [
      { kind: "dateRange", name: "Date Range", from: "2025-06-01", to: "", negate: false, chipType: "date_range" },
    ];
    const rebuilt = rebuildQ(fromOnly, "[]");
    const parsed = JSON.parse(rebuilt);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ n: "Created After", v: "2025-06-01" });
  });

  test("rebuildQ produces no chips when both dates are empty", () => {
    const chips = [
      { kind: "dateRange", name: "Date Range", from: "", to: "", negate: false, chipType: "date_range" },
    ];
    const rebuilt = rebuildQ(chips, "[]");
    expect(JSON.parse(rebuilt)).toEqual([]);
  });

  test("Date Range survives a full round-trip", () => {
    const original = [
      { kind: "dateRange", name: "Date Range", from: "2025-03-01", to: "2025-09-30", negate: false, chipType: "date_range" },
    ];
    const rebuilt = rebuildQ(original, "[]");
    const { definedChips } = parseChips(rebuilt, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      kind: "dateRange",
      name: "Date Range",
      from: "2025-03-01",
      to: "2025-09-30",
      negate: false,
    });
  });

  test("negated Date Range round-trips", () => {
    const original = [
      { kind: "dateRange", name: "Date Range", from: "2025-01-01", to: "2025-06-30", negate: true, chipType: "date_range" },
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
      kind: "dateRange",
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
      kind: "dateRange",
      name: "Date Range",
      from: "2024-01-01",
      to: "2024-12-31",
    });
  });
});

// =============================================================================
// getFileTypeCategoriesFromQ
// =============================================================================

describe("getFileTypeCategoriesFromQ", () => {
  test("returns empty arrays for null/undefined/empty q", () => {
    expect(getFileTypeCategoriesFromQ(null)).toEqual({ positive: [], negative: [] });
    expect(getFileTypeCategoriesFromQ(undefined)).toEqual({ positive: [], negative: [] });
    expect(getFileTypeCategoriesFromQ("")).toEqual({ positive: [], negative: [] });
  });

  test("returns empty arrays when no File Type chip exists", () => {
    const input = q("search text", chip("Mime Type", "application/pdf"));
    expect(getFileTypeCategoriesFromQ(input)).toEqual({ positive: [], negative: [] });
  });

  test("extracts single positive category", () => {
    const input = q(chip("File Type", "pdf", "+", "file_type"));
    expect(getFileTypeCategoriesFromQ(input)).toEqual({ positive: ["pdf"], negative: [] });
  });

  test("extracts multiple OR-joined positive categories", () => {
    const input = q(chip("File Type", "pdf OR word OR email", "+", "file_type"));
    expect(getFileTypeCategoriesFromQ(input)).toEqual({ positive: ["pdf", "word", "email"], negative: [] });
  });

  test("extracts negative categories", () => {
    const input = q(chip("File Type", "image", "-", "file_type"));
    expect(getFileTypeCategoriesFromQ(input)).toEqual({ positive: [], negative: ["image"] });
  });

  test("extracts dual-polarity categories", () => {
    const input = q(
      chip("File Type", "pdf", "+", "file_type"),
      chip("File Type", "image", "-", "file_type")
    );
    expect(getFileTypeCategoriesFromQ(input)).toEqual({ positive: ["pdf"], negative: ["image"] });
  });

  test("returns empty for invalid JSON", () => {
    expect(getFileTypeCategoriesFromQ("not json")).toEqual({ positive: [], negative: [] });
  });

  test("finds File Type chip among other chips", () => {
    const input = q(
      "text",
      chip("Has Field", "email-subject", "+", "dropdown"),
      chip("File Type", "spreadsheet", "+", "file_type")
    );
    expect(getFileTypeCategoriesFromQ(input)).toEqual({ positive: ["spreadsheet"], negative: [] });
  });
});

// =============================================================================
// setFileTypeCategoriesInQ
// =============================================================================

describe("setFileTypeCategoriesInQ", () => {
  test("creates a File Type chip when none exists", () => {
    const input = q("search text");
    const result = setFileTypeCategoriesInQ(input, { positive: ["pdf"], negative: [] });
    const parsed = JSON.parse(result);

    const fileTypeChip = parsed.find((el) => typeof el === "object" && el.n === "File Type");
    expect(fileTypeChip).toBeTruthy();
    expect(fileTypeChip.v).toBe("pdf");
    expect(fileTypeChip.t).toBe("file_type");
    expect(fileTypeChip.op).toBe("+");
  });

  test("creates a negative File Type chip", () => {
    const input = q("search text");
    const result = setFileTypeCategoriesInQ(input, { positive: [], negative: ["image"] });
    const parsed = JSON.parse(result);

    const fileTypeChip = parsed.find((el) => typeof el === "object" && el.n === "File Type");
    expect(fileTypeChip).toBeTruthy();
    expect(fileTypeChip.v).toBe("image");
    expect(fileTypeChip.op).toBe("-");
  });

  test("creates dual-polarity File Type chips", () => {
    const input = q("search text");
    const result = setFileTypeCategoriesInQ(input, { positive: ["pdf"], negative: ["image"] });
    const parsed = JSON.parse(result);

    const fileTypeChips = parsed.filter((el) => typeof el === "object" && el.n === "File Type");
    expect(fileTypeChips).toHaveLength(2);
    expect(fileTypeChips.find((c) => c.op === "+").v).toBe("pdf");
    expect(fileTypeChips.find((c) => c.op === "-").v).toBe("image");
  });

  test("updates an existing File Type chip", () => {
    const input = q("text", chip("File Type", "pdf", "+", "file_type"));
    const result = setFileTypeCategoriesInQ(input, { positive: ["pdf", "word"], negative: [] });
    const parsed = JSON.parse(result);

    const fileTypeChips = parsed.filter((el) => typeof el === "object" && el.n === "File Type");
    expect(fileTypeChips).toHaveLength(1);
    expect(fileTypeChips[0].v).toBe("pdf OR word");
  });

  test("removes File Type chip when both arrays are empty", () => {
    const input = q("text", chip("File Type", "pdf", "+", "file_type"));
    const result = setFileTypeCategoriesInQ(input, { positive: [], negative: [] });
    const parsed = JSON.parse(result);

    const fileTypeChip = parsed.find((el) => typeof el === "object" && el.n === "File Type");
    expect(fileTypeChip).toBeUndefined();
    expect(parsed).toContain("text");
  });

  test("preserves other chips when adding File Type", () => {
    const input = q(
      "text",
      chip("Has Field", "email-subject", "+", "dropdown")
    );
    const result = setFileTypeCategoriesInQ(input, { positive: ["email"], negative: [] });
    const parsed = JSON.parse(result);

    expect(parsed.find((el) => typeof el === "object" && el.n === "Has Field")).toBeTruthy();
    expect(parsed.find((el) => typeof el === "object" && el.n === "File Type")).toBeTruthy();
  });

  test("round-trips through getFileTypeCategoriesFromQ", () => {
    const input = q("hello");
    const categories = { positive: ["pdf", "spreadsheet"], negative: ["email"] };
    const updated = setFileTypeCategoriesInQ(input, categories);
    expect(getFileTypeCategoriesFromQ(updated)).toEqual(categories);
  });

  test("preserves text and other chips through round-trip", () => {
    const input = q(
      "search terms",
      chip("Created After", "2025-01-01", "+", "date_range"),
      chip("Created Before", "2025-06-01", "+", "date_range")
    );
    const updated = setFileTypeCategoriesInQ(input, { positive: ["web"], negative: [] });

    // File Type was added
    expect(getFileTypeCategoriesFromQ(updated)).toEqual({ positive: ["web"], negative: [] });

    // Date Range chip and text survived
    const { definedChips, textOnlyQ } = parseChips(updated, []);
    expect(JSON.parse(textOnlyQ)).toContain("search terms");
    expect(definedChips.find((c) => c.kind === "dateRange")).toBeTruthy();
  });
});

// =============================================================================
// getDatasetsFromQ / setDatasetsInQ (tri-state: positive/negative)
// =============================================================================

describe("getDatasetsFromQ", () => {
  test("returns empty for null/undefined/empty", () => {
    expect(getDatasetsFromQ(null)).toEqual({ positive: [], negative: [] });
    expect(getDatasetsFromQ(undefined)).toEqual({ positive: [], negative: [] });
    expect(getDatasetsFromQ("")).toEqual({ positive: [], negative: [] });
  });

  test("returns empty when no Dataset chip is present", () => {
    const input = q("search text", chip("Has Field", "ocr", "+", "dropdown"));
    expect(getDatasetsFromQ(input)).toEqual({ positive: [], negative: [] });
  });

  test("returns positive dataset values", () => {
    const input = q(chip("Dataset", "panama-papers OR paradise-papers", "+", "dataset"));
    expect(getDatasetsFromQ(input)).toEqual({ positive: ["panama-papers", "paradise-papers"], negative: [] });
  });

  test("returns single positive dataset value", () => {
    const input = q(chip("Dataset", "panama-papers", "+", "dataset"));
    expect(getDatasetsFromQ(input)).toEqual({ positive: ["panama-papers"], negative: [] });
  });

  test("returns negative dataset values", () => {
    const input = q(chip("Dataset", "panama-papers", "-", "dataset"));
    expect(getDatasetsFromQ(input)).toEqual({ positive: [], negative: ["panama-papers"] });
  });

  test("returns both positive and negative dataset values", () => {
    const input = q(
      chip("Dataset", "panama-papers", "+", "dataset"),
      chip("Dataset", "paradise-papers", "-", "dataset")
    );
    expect(getDatasetsFromQ(input)).toEqual({ positive: ["panama-papers"], negative: ["paradise-papers"] });
  });
});

describe("setDatasetsInQ", () => {
  test("adds a positive Dataset chip to empty q", () => {
    const input = q("search text");
    const result = setDatasetsInQ(input, { positive: ["panama-papers"], negative: [] });
    expect(getDatasetsFromQ(result)).toEqual({ positive: ["panama-papers"], negative: [] });
    // Text preserved
    expect(JSON.parse(result).some((el) => el === "search text")).toBe(true);
  });

  test("adds a negative Dataset chip", () => {
    const input = q("search text");
    const result = setDatasetsInQ(input, { positive: [], negative: ["panama-papers"] });
    expect(getDatasetsFromQ(result)).toEqual({ positive: [], negative: ["panama-papers"] });
  });

  test("adds both positive and negative Dataset chips", () => {
    const input = q("search text");
    const result = setDatasetsInQ(input, { positive: ["paradise-papers"], negative: ["panama-papers"] });
    expect(getDatasetsFromQ(result)).toEqual({ positive: ["paradise-papers"], negative: ["panama-papers"] });
  });

  test("replaces existing Dataset chips", () => {
    const input = q(chip("Dataset", "panama-papers", "+", "dataset"));
    const result = setDatasetsInQ(input, { positive: ["paradise-papers", "pfizer-leaks"], negative: [] });
    expect(getDatasetsFromQ(result)).toEqual({ positive: ["paradise-papers", "pfizer-leaks"], negative: [] });
  });

  test("removes Dataset chips when both arrays are empty", () => {
    const input = q(chip("Dataset", "panama-papers", "+", "dataset"));
    const result = setDatasetsInQ(input, { positive: [], negative: [] });
    expect(getDatasetsFromQ(result)).toEqual({ positive: [], negative: [] });
  });

  test("preserves other chips", () => {
    const input = q(
      "text",
      chip("Has Field", "ocr", "+", "dropdown"),
      chip("Dataset", "old-dataset", "+", "dataset")
    );
    const result = setDatasetsInQ(input, { positive: ["new-dataset"], negative: [] });
    const parsed = JSON.parse(result);
    expect(parsed.find((el) => typeof el === "object" && el.n === "Has Field")).toBeTruthy();
    expect(getDatasetsFromQ(result)).toEqual({ positive: ["new-dataset"], negative: [] });
  });
});

// =============================================================================
// getWorkspacesFromQ / setWorkspacesInQ (tri-state: positive/negative)
// =============================================================================

describe("getWorkspacesFromQ", () => {
  test("returns empty for null/undefined/empty", () => {
    expect(getWorkspacesFromQ(null)).toEqual({ positive: [], negative: [] });
    expect(getWorkspacesFromQ(undefined)).toEqual({ positive: [], negative: [] });
    expect(getWorkspacesFromQ("")).toEqual({ positive: [], negative: [] });
  });

  test("returns positive workspace IDs", () => {
    const input = q(chip("Workspace", "ws-id-1 OR ws-id-2", "+", "workspace"));
    expect(getWorkspacesFromQ(input)).toEqual({ positive: ["ws-id-1", "ws-id-2"], negative: [] });
  });

  test("returns negative workspace IDs", () => {
    const input = q(chip("Workspace", "ws-id-1", "-", "workspace"));
    expect(getWorkspacesFromQ(input)).toEqual({ positive: [], negative: ["ws-id-1"] });
  });
});

describe("setWorkspacesInQ", () => {
  test("adds a positive Workspace chip", () => {
    const input = q("search");
    const result = setWorkspacesInQ(input, { positive: ["ws-1"], negative: [] });
    expect(getWorkspacesFromQ(result)).toEqual({ positive: ["ws-1"], negative: [] });
  });

  test("adds positive and negative Workspace chips", () => {
    const input = q("search");
    const result = setWorkspacesInQ(input, { positive: ["ws-1"], negative: ["ws-2"] });
    expect(getWorkspacesFromQ(result)).toEqual({ positive: ["ws-1"], negative: ["ws-2"] });
  });

  test("removes Workspace chip when both empty", () => {
    const input = q(chip("Workspace", "ws-1", "+", "workspace"));
    const result = setWorkspacesInQ(input, { positive: [], negative: [] });
    expect(getWorkspacesFromQ(result)).toEqual({ positive: [], negative: [] });
  });

  test("round-trips with get", () => {
    const values = { positive: ["ws-aaa", "ws-bbb"], negative: ["ws-ccc"] };
    const result = setWorkspacesInQ(q("text"), values);
    expect(getWorkspacesFromQ(result)).toEqual(values);
  });
});

// =============================================================================
// extractCollectionAndWorkspaceChips
// =============================================================================

describe("extractCollectionAndWorkspaceChips", () => {
  test("returns empty for null/undefined", () => {
    expect(extractCollectionAndWorkspaceChips(null)).toEqual({ cleanedQ: null, chipFilters: {} });
    expect(extractCollectionAndWorkspaceChips("")).toEqual({ cleanedQ: "", chipFilters: {} });
  });

  test("extracts positive workspace chip into chipFilters", () => {
    const input = q("search text", chip("Workspace", "ws-1 OR ws-2", "+", "workspace"));
    const { cleanedQ, chipFilters } = extractCollectionAndWorkspaceChips(input);
    expect(chipFilters.workspace).toEqual(["ws-1", "ws-2"]);
    // Workspace chip removed from q
    const parsed = JSON.parse(cleanedQ);
    expect(parsed.every((el) => typeof el === "string")).toBe(true);
    expect(parsed).toContain("search text");
  });

  test("extracts negative workspace chip into chipFilters", () => {
    const input = q("text", chip("Workspace", "ws-1", "-", "workspace"));
    const { cleanedQ, chipFilters } = extractCollectionAndWorkspaceChips(input);
    expect(chipFilters.workspace_exclude).toEqual(["ws-1"]);
    expect(chipFilters.workspace).toBeUndefined();
  });

  test("extracts positive dataset chip into chipFilters", () => {
    const input = q(chip("Dataset", "panama-papers", "+", "dataset"));
    const { cleanedQ, chipFilters } = extractCollectionAndWorkspaceChips(input);
    expect(chipFilters.ingestion).toEqual(["panama-papers"]);
    expect(JSON.parse(cleanedQ)).toEqual([]);
  });

  test("extracts negative dataset chip into chipFilters", () => {
    const input = q(chip("Dataset", "panama-papers", "-", "dataset"));
    const { cleanedQ, chipFilters } = extractCollectionAndWorkspaceChips(input);
    expect(chipFilters.ingestion_exclude).toEqual(["panama-papers"]);
    expect(chipFilters.ingestion).toBeUndefined();
  });

  test("extracts both positive and negative workspace/dataset chips", () => {
    const input = q(
      "text",
      chip("Dataset", "col1", "+", "dataset"),
      chip("Dataset", "col2", "-", "dataset"),
      chip("Workspace", "ws-1", "+", "workspace"),
      chip("Workspace", "ws-2", "-", "workspace"),
      chip("Has Field", "ocr", "+", "dropdown")
    );
    const { cleanedQ, chipFilters } = extractCollectionAndWorkspaceChips(input);
    expect(chipFilters.workspace).toEqual(["ws-1"]);
    expect(chipFilters.workspace_exclude).toEqual(["ws-2"]);
    expect(chipFilters.ingestion).toEqual(["col1"]);
    expect(chipFilters.ingestion_exclude).toEqual(["col2"]);
    // Other chips and text remain
    const parsed = JSON.parse(cleanedQ);
    expect(parsed).toContain("text");
    expect(parsed.find((el) => typeof el === "object" && el.n === "Has Field")).toBeTruthy();
    expect(parsed.find((el) => typeof el === "object" && el.n === "Dataset")).toBeUndefined();
    expect(parsed.find((el) => typeof el === "object" && el.n === "Workspace")).toBeUndefined();
  });

  test("returns no chipFilters when no dataset/workspace chips present", () => {
    const input = q("search text", chip("Has Field", "ocr", "+", "dropdown"));
    const { cleanedQ, chipFilters } = extractCollectionAndWorkspaceChips(input);
    expect(chipFilters).toEqual({});
    expect(JSON.parse(cleanedQ)).toEqual(JSON.parse(input));
  });
});

// =============================================================================
// Contradiction prevention — a value must not appear in both + and −
// =============================================================================

describe("contradiction prevention", () => {
  describe("setFileTypeCategoriesInQ strips contradictions", () => {
    test("value in both positive and negative is removed from negative", () => {
      const result = setFileTypeCategoriesInQ(q("text"), {
        positive: ["pdf", "web"],
        negative: ["pdf", "image"],
      });
      const cats = getFileTypeCategoriesFromQ(result);
      expect(cats.positive).toEqual(["pdf", "web"]);
      // "pdf" stripped from negative because it's in positive
      expect(cats.negative).toEqual(["image"]);
    });

    test("no contradiction leaves both sides intact", () => {
      const result = setFileTypeCategoriesInQ(q("text"), {
        positive: ["pdf"],
        negative: ["image"],
      });
      const cats = getFileTypeCategoriesFromQ(result);
      expect(cats.positive).toEqual(["pdf"]);
      expect(cats.negative).toEqual(["image"]);
    });

    test("all values contradicted leaves empty result", () => {
      const result = setFileTypeCategoriesInQ(q("text"), {
        positive: ["pdf"],
        negative: ["pdf"],
      });
      const cats = getFileTypeCategoriesFromQ(result);
      // positive wins, negative discarded for that value
      expect(cats.positive).toEqual(["pdf"]);
      expect(cats.negative).toEqual([]);
    });
  });

  describe("setDatasetsInQ strips contradictions", () => {
    test("value in both positive and negative is removed from negative", () => {
      const result = setDatasetsInQ(q("search"), {
        positive: ["panama-papers"],
        negative: ["panama-papers", "paradise-papers"],
      });
      const ds = getDatasetsFromQ(result);
      expect(ds.positive).toEqual(["panama-papers"]);
      expect(ds.negative).toEqual(["paradise-papers"]);
    });
  });

  describe("setWorkspacesInQ strips contradictions", () => {
    test("value in both positive and negative is removed from negative", () => {
      const result = setWorkspacesInQ(q("search"), {
        positive: ["ws-1", "ws-2"],
        negative: ["ws-2", "ws-3"],
      });
      const ws = getWorkspacesFromQ(result);
      expect(ws.positive).toEqual(["ws-1", "ws-2"]);
      expect(ws.negative).toEqual(["ws-3"]);
    });
  });

  describe("extractCollectionAndWorkspaceChips strips contradictions at API boundary", () => {
    test("same workspace value in + and − keeps only the positive", () => {
      const input = q(
        chip("Workspace", "ws-1", "+", "workspace"),
        chip("Workspace", "ws-1", "-", "workspace")
      );
      const { chipFilters } = extractCollectionAndWorkspaceChips(input);
      expect(chipFilters.workspace).toEqual(["ws-1"]);
      expect(chipFilters.workspace_exclude).toBeUndefined();
    });

    test("same dataset value in + and − keeps only the positive", () => {
      const input = q(
        chip("Dataset", "col1", "+", "dataset"),
        chip("Dataset", "col1", "-", "dataset")
      );
      const { chipFilters } = extractCollectionAndWorkspaceChips(input);
      expect(chipFilters.ingestion).toEqual(["col1"]);
      expect(chipFilters.ingestion_exclude).toBeUndefined();
    });

    test("mixed contradicted and non-contradicted values are handled correctly", () => {
      const input = q(
        chip("Dataset", "col1 OR col2", "+", "dataset"),
        chip("Dataset", "col2 OR col3", "-", "dataset")
      );
      const { chipFilters } = extractCollectionAndWorkspaceChips(input);
      expect(chipFilters.ingestion).toEqual(["col1", "col2"]);
      // col2 stripped from exclude; col3 remains
      expect(chipFilters.ingestion_exclude).toEqual(["col3"]);
    });
  });
});
