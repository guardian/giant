import { findActiveHeadingId } from "./DocsSidebar";

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
