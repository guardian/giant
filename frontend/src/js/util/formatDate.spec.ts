import { formatDate } from "./formatDate";

describe("formatDate", () => {
  test("formats a Date object", () => {
    const date = new Date(2024, 0, 15, 14, 30);
    const result = formatDate(date);
    expect(result).toMatch(/Jan 15, 2024 at/);
  });

  test("formats a numeric timestamp", () => {
    const timestamp = new Date(2024, 5, 1, 9, 15).getTime();
    const result = formatDate(timestamp);
    expect(result).toMatch(/Jun 1, 2024 at/);
  });
});
