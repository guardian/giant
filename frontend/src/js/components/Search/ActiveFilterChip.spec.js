import { isMultiValueChip, truncateChipDisplay } from "./ActiveFilterChip";

describe("isMultiValueChip", () => {
  test("Mime Type is multi-value", () => {
    expect(isMultiValueChip("Mime Type")).toBe(true);
  });

  test("Has Field is multi-value", () => {
    expect(isMultiValueChip("Has Field")).toBe(true);
  });

  test("File Type is multi-value", () => {
    expect(isMultiValueChip("File Type")).toBe(true);
  });

  test("Language is multi-value", () => {
    expect(isMultiValueChip("Language")).toBe(true);
  });

  test("Created After is not multi-value", () => {
    expect(isMultiValueChip("Created After")).toBe(false);
  });

  test("Created Before is not multi-value", () => {
    expect(isMultiValueChip("Created Before")).toBe(false);
  });

  test("workspace_folder is not multi-value", () => {
    expect(isMultiValueChip("workspace_folder")).toBe(false);
  });

  test("unknown names are not multi-value", () => {
    expect(isMultiValueChip("Something Random")).toBe(false);
  });

  test("empty string is not multi-value", () => {
    expect(isMultiValueChip("")).toBe(false);
  });
});

describe("truncateChipDisplay", () => {
  test("returns 'all' for empty labels", () => {
    expect(truncateChipDisplay([], 36)).toBe("all");
  });

  test("returns all labels when they fit within budget", () => {
    expect(truncateChipDisplay(["1", "2", "3", "5"], 20)).toBe("1, 2, 3, 5");
  });

  test("returns single short label without truncation", () => {
    expect(truncateChipDisplay(["Alpha"], 36)).toBe("Alpha");
  });

  test("truncates a single very long label with ellipsis", () => {
    const longName = "This is the workspace in which we have all the details about John Smith";
    const result = truncateChipDisplay([longName], 36);
    expect(result.length).toBeLessThanOrEqual(36);
    expect(result).toContain("\u2026"); // contains …
  });

  test("shows +N more when not all labels fit", () => {
    const labels = ["Alpha Workspace", "Beta Workspace", "Gamma Workspace", "Delta Workspace"];
    const result = truncateChipDisplay(labels, 36);
    expect(result).toMatch(/\+\d+ more/);
    expect(result.length).toBeLessThanOrEqual(36);
  });

  test("short labels that fit together are all shown", () => {
    expect(truncateChipDisplay(["A", "B", "C"], 10)).toBe("A, B, C");
  });

  test("fits as many labels as possible before adding +N more", () => {
    // "Alpha, Beta, +2 more" = 20 chars. Should fit in 20.
    const result = truncateChipDisplay(["Alpha", "Beta", "Gamma", "Delta"], 20);
    expect(result).toBe("Alpha, Beta, +2 more");
  });

  test("truncates first label when it alone exceeds budget with suffix", () => {
    const labels = ["VeryLongWorkspaceName", "Other"];
    // budget 20: need room for " +1 more" (8 chars) → 12 for label + …
    const result = truncateChipDisplay(labels, 20);
    expect(result).toMatch(/\+1 more/);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).toContain("\u2026");
  });

  test("handles exactly-at-budget labels", () => {
    // "Hello, World" = 12 chars
    expect(truncateChipDisplay(["Hello", "World"], 12)).toBe("Hello, World");
  });

  test("handles single label at exactly the budget", () => {
    expect(truncateChipDisplay(["abc"], 3)).toBe("abc");
  });
});
