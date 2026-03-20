import { pageSlotHeight } from "./layout";

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
