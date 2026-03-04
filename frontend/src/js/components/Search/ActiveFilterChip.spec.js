import { isMultiValueChip } from "./ActiveFilterChip";

describe("isMultiValueChip", () => {
  test("Mime Type is multi-value", () => {
    expect(isMultiValueChip("Mime Type")).toBe(true);
  });

  test("Has Field is multi-value", () => {
    expect(isMultiValueChip("Has Field")).toBe(true);
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
