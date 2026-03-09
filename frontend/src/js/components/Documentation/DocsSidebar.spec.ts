import { findActiveHeadingId, parseHeadings } from "./DocsSidebar";

describe("parseHeadings", () => {
  test("extracts only level 1 and 2 headings with explicit ids", () => {
    const markdown = [
      "# Top {#top}",
      "Some text",
      "## **Section One** {#section-1}",
      "### Ignored {#ignored}",
      "## Missing id",
    ].join("\n");

    expect(parseHeadings(markdown)).toStrictEqual([
      { level: 1, text: "Top", id: "top" },
      { level: 2, text: "Section One", id: "section-1" },
    ]);
  });
});

describe("findActiveHeadingId", () => {
  test("returns the last heading that is above scroll position", () => {
    const headings = [
      { level: 1, text: "Top", id: "top" },
      { level: 2, text: "Middle", id: "middle" },
      { level: 2, text: "Bottom", id: "bottom" },
    ];

    const positions: Record<string, number> = {
      top: 10,
      middle: 180,
      bottom: 420,
    };

    const active = findActiveHeadingId(
      headings,
      270,
      (id) => ({ offsetTop: positions[id] }) as HTMLElement,
    );

    expect(active).toBe("middle");
  });

  test("returns null when all headings are below the threshold", () => {
    const headings = [
      { level: 1, text: "Top", id: "top" },
      { level: 2, text: "Middle", id: "middle" },
    ];

    const positions: Record<string, number> = {
      top: 200,
      middle: 320,
    };

    const active = findActiveHeadingId(
      headings,
      50,
      (id) => ({ offsetTop: positions[id] }) as HTMLElement,
    );

    expect(active).toBeNull();
  });
});
