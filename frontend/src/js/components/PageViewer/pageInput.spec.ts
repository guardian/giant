import { parsePageInput } from "./pageInput";

describe("parsePageInput", () => {
  test("returns the page when it is within range", () => {
    expect(parsePageInput("5", 10)).toBe(5);
  });

  test("clamps a page above the total down to the total", () => {
    expect(parsePageInput("99", 10)).toBe(10);
  });

  test("clamps a page below 1 up to 1", () => {
    expect(parsePageInput("0", 10)).toBe(1);
    expect(parsePageInput("-3", 10)).toBe(1);
  });

  test("parses a leading number followed by other characters", () => {
    expect(parsePageInput("7abc", 10)).toBe(7);
  });

  test("returns null for empty input", () => {
    expect(parsePageInput("", 10)).toBeNull();
  });

  test("returns null for non-numeric input", () => {
    expect(parsePageInput("abc", 10)).toBeNull();
  });
});
