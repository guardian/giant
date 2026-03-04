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
    const input = q("search text", chip("Created After", "2025-01-01", "+", "date_ex"));
    const { definedChips, textOnlyQ } = parseChips(input, []);

    expect(definedChips).toHaveLength(1);
    expect(definedChips[0]).toMatchObject({
      name: "Created After",
      value: "2025-01-01",
      negate: false,
      chipType: "date_ex",
      multiValue: false,
    });
    expect(JSON.parse(textOnlyQ)).toEqual(["search text"]);
  });

  test("recognises negated chips (op = '-')", () => {
    const input = q(chip("Created After", "2025-01-01", "-", "date_ex"));
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

  test("handles mixed text + single-value + multi-value chips", () => {
    const input = q(
      "free text",
      chip("Created After", "2025-01-01", "+", "date_ex"),
      chip("Mime Type", "application/pdf OR text/html", "-", "text")
    );
    const { definedChips, textOnlyQ } = parseChips(input, []);

    expect(JSON.parse(textOnlyQ)).toEqual(["free text"]);
    expect(definedChips).toHaveLength(2);
    expect(definedChips[0]).toMatchObject({
      name: "Created After",
      value: "2025-01-01",
      multiValue: false,
    });
    expect(definedChips[1]).toMatchObject({
      name: "Mime Type",
      values: ["application/pdf", "text/html"],
      negate: true,
      multiValue: true,
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
      name: "Created After",
      value: "2025-06-01",
      negate: false,
      chipType: "date_ex",
      multiValue: false,
    }];
    const result = rebuildQ(chips, '["text"]');
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toBe("text");
    expect(parsed[1]).toMatchObject({
      n: "Created After",
      v: "2025-06-01",
      op: "+",
      t: "date_ex",
    });
  });

  test("rebuilds a negated chip with op '-'", () => {
    const chips = [{
      name: "Created Before",
      value: "2025-12-31",
      negate: true,
      chipType: "date",
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
      name: "Created After",
      value: "2025-01-01",
      negate: false,
      chipType: "date_ex",
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
      chip("Created After", "2025-01-01", "+", "date_ex"),
      chip("Created Before", "2025-12-31", "-", "date")
    );
    const { definedChips, textOnlyQ } = parseChips(original, []);
    const rebuilt = rebuildQ(definedChips, textOnlyQ);
    const reparsed = parseChips(rebuilt, []);

    expect(reparsed.definedChips).toHaveLength(2);
    expect(reparsed.definedChips[0]).toMatchObject({
      name: "Created After",
      value: "2025-01-01",
      negate: false,
    });
    expect(reparsed.definedChips[1]).toMatchObject({
      name: "Created Before",
      value: "2025-12-31",
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
    expect(definedChips).toHaveLength(4);

    const rebuilt = rebuildQ(definedChips, textOnlyQ);
    const reparsed = parseChips(rebuilt, []);

    expect(reparsed.definedChips).toHaveLength(4);
    expect(JSON.parse(reparsed.textOnlyQ)).toEqual(["keyword"]);
  });
});
