import { pageSlotHeight, pageTransform } from "./layout";

describe("pageSlotHeight", () => {
  const MARGIN = 10;
  const CONTAINER = 1000;

  test("falls back to A4 portrait aspect ratio when no dimensions provided", () => {
    const height = pageSlotHeight(CONTAINER, MARGIN, 0);
    const expectedAspectRatio = 297 / 210;
    expect(height).toBeCloseTo(CONTAINER * expectedAspectRatio + MARGIN * 2);
  });

  test("uses provided page dimensions for aspect ratio", () => {
    const dims = { width: 612, height: 792, top: 0, bottom: 792 };
    const height = pageSlotHeight(CONTAINER, MARGIN, 0, dims);
    expect(height).toBeCloseTo(CONTAINER * (792 / 612) + MARGIN * 2);
  });

  test("inverts aspect ratio when rotated 90 degrees", () => {
    const dims = { width: 612, height: 792, top: 0, bottom: 792 };
    const height = pageSlotHeight(CONTAINER, MARGIN, 90, dims);
    expect(height).toBeCloseTo(CONTAINER * (612 / 792) + MARGIN * 2);
  });

  test("inverts aspect ratio when rotated 270 degrees", () => {
    const dims = { width: 612, height: 792, top: 0, bottom: 792 };
    const height = pageSlotHeight(CONTAINER, MARGIN, 270, dims);
    expect(height).toBeCloseTo(CONTAINER * (612 / 792) + MARGIN * 2);
  });

  test("keeps normal aspect ratio when rotated 180 degrees", () => {
    const dims = { width: 612, height: 792, top: 0, bottom: 792 };
    const height = pageSlotHeight(CONTAINER, MARGIN, 180, dims);
    expect(height).toBeCloseTo(CONTAINER * (792 / 612) + MARGIN * 2);
  });

  test("handles landscape page dimensions", () => {
    const dims = { width: 842, height: 595, top: 0, bottom: 595 };
    const height = pageSlotHeight(CONTAINER, MARGIN, 0, dims);
    expect(height).toBeCloseTo(CONTAINER * (595 / 842) + MARGIN * 2);
  });
});

describe("pageTransform", () => {
  const CONTAINER = 1000;

  test("returns undefined for 0 degrees", () => {
    expect(pageTransform(CONTAINER, 0)).toBeUndefined();
  });

  test("returns simple rotation for 180 degrees", () => {
    expect(pageTransform(CONTAINER, 180)).toBe("rotate(180deg)");
  });

  test("returns simple rotation for -180 degrees", () => {
    expect(pageTransform(CONTAINER, -180)).toBe("rotate(-180deg)");
  });

  test("includes scale and translateY for 90 degrees (A4 fallback)", () => {
    const result = pageTransform(CONTAINER, 90)!;
    const aspectRatio = 297 / 210;
    const scaleFactor = 1 / aspectRatio;
    const layoutHeight = CONTAINER * aspectRatio;
    const visualHeight = CONTAINER * scaleFactor;
    const translateY = (visualHeight - layoutHeight) / 2;

    expect(result).toBe(
      `translateY(${translateY}px) rotate(90deg) scale(${scaleFactor})`,
    );
  });

  test("includes scale and translateY for 270 degrees", () => {
    const dims = { width: 612, height: 792, top: 0, bottom: 792 };
    const result = pageTransform(CONTAINER, 270, dims)!;
    const aspectRatio = 792 / 612;
    const scaleFactor = 1 / aspectRatio;
    const layoutHeight = CONTAINER * aspectRatio;
    const visualHeight = CONTAINER * scaleFactor;
    const translateY = (visualHeight - layoutHeight) / 2;

    expect(result).toBe(
      `translateY(${translateY}px) rotate(270deg) scale(${scaleFactor})`,
    );
  });

  test("handles negative sideways rotation (-90)", () => {
    const result = pageTransform(CONTAINER, -90)!;
    expect(result).toContain("rotate(-90deg)");
    expect(result).toContain("scale(");
    expect(result).toContain("translateY(");
  });

  test("visual height after transform matches pageSlotHeight minus margins", () => {
    const MARGIN = 10;
    const dims = { width: 612, height: 792, top: 0, bottom: 792 };
    const slotHeight = pageSlotHeight(CONTAINER, MARGIN, 90, dims);
    const aspectRatio = 792 / 612;
    const scaleFactor = 1 / aspectRatio;
    const visualHeight = CONTAINER * scaleFactor;

    // The visual height should equal the slot height minus the two margins
    expect(visualHeight).toBeCloseTo(slotHeight - MARGIN * 2);
  });
});
