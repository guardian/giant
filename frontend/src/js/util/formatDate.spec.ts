import { formatDate } from "./formatDate";

describe("formatDate", () => {
  test("formats a Date object", () => {
    // 15 Jan 2024 at 2:30pm UTC
    const date = new Date(Date.UTC(2024, 0, 15, 14, 30));
    const result = formatDate(date);
    // Exact output depends on timezone, but should contain the key parts
    expect(result).toMatch(/Jan 15, 2024 at/);
  });

  test("formats a numeric timestamp", () => {
    const timestamp = new Date(2024, 5, 1, 9, 15).getTime();
    const result = formatDate(timestamp);
    expect(result).toMatch(/Jun 1, 2024 at/);
  });
});
