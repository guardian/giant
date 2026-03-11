import { formatRecipients } from "./formatRecipients";

describe("formatRecipients", () => {
  test("returns empty string for empty array", () => {
    expect(formatRecipients([], 80)).toBe("");
  });

  test("joins recipients by displayName when available", () => {
    const recipients = [
      { email: "a@test.com", displayName: "Alice" },
      { email: "b@test.com", displayName: "Bob" },
    ];
    expect(formatRecipients(recipients, 80)).toBe("Alice, Bob");
  });

  test("falls back to email when displayName is missing", () => {
    const recipients = [
      { email: "a@test.com" },
      { email: "b@test.com", displayName: "Bob" },
    ];
    expect(formatRecipients(recipients, 80)).toBe("a@test.com, Bob");
  });

  test("truncates and appends ellipsis when exceeding maxLength", () => {
    const recipients = [
      { email: "alice@example.com", displayName: "Alice Wonderland" },
      { email: "bob@example.com", displayName: "Bob Builder" },
    ];
    const result = formatRecipients(recipients, 10);
    expect(result).toBe("Alice Wond…");
    expect(result.length).toBe(11); // 10 chars + ellipsis
  });

  test("does not truncate when exactly at maxLength", () => {
    const recipients = [{ email: "a@test.com", displayName: "Hello" }];
    expect(formatRecipients(recipients, 5)).toBe("Hello");
  });
});
