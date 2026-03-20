import { PageDimensions } from "./model";

const A4_ASPECT_RATIO = 297 / 210;

export function pageSlotHeight(
  containerSize: number,
  margin: number,
  rotation: number,
  firstPageDimensions?: PageDimensions,
): number {
  const isRotatedSideways = rotation % 180 !== 0;
  const aspectRatio = firstPageDimensions
    ? firstPageDimensions.height / firstPageDimensions.width
    : A4_ASPECT_RATIO;
  const effectiveAspectRatio = isRotatedSideways
    ? 1 / aspectRatio
    : aspectRatio;
  return containerSize * effectiveAspectRatio + margin * 2;
}
