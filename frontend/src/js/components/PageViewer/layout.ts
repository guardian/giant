import { PageDimensions } from "./model";

const A4_ASPECT_RATIO = 297 / 210;

function pageAspectRatio(firstPageDimensions?: PageDimensions): number {
  return firstPageDimensions
    ? firstPageDimensions.height / firstPageDimensions.width
    : A4_ASPECT_RATIO;
}

export function pageSlotHeight(
  containerSize: number,
  margin: number,
  rotation: number,
  firstPageDimensions?: PageDimensions,
): number {
  const isRotatedSideways = rotation % 180 !== 0;
  const aspectRatio = pageAspectRatio(firstPageDimensions);
  const effectiveAspectRatio = isRotatedSideways
    ? 1 / aspectRatio
    : aspectRatio;
  return containerSize * effectiveAspectRatio + margin * 2;
}

/**
 * Compute the CSS transform for a page container that handles rotation.
 *
 * When rotated 90°/270°, the rendered canvas (at unrotated dimensions) is
 * wider than the slot after rotation. We scale it down so the rotated visual
 * width matches the container, and translate vertically to compensate for
 * the transform-origin (center) offset.
 */
export function pageTransform(
  containerSize: number,
  rotation: number,
  firstPageDimensions?: PageDimensions,
): string | undefined {
  if (rotation === 0) return undefined;

  const isRotatedSideways = rotation % 180 !== 0;
  if (!isRotatedSideways) return `rotate(${rotation}deg)`;

  const aspectRatio = pageAspectRatio(firstPageDimensions);
  const scaleFactor = 1 / aspectRatio;
  // The layout box height is containerSize * aspectRatio.
  // The visual height after rotation + scale is containerSize / aspectRatio.
  // The transform-origin is center, so the visual top shifts down by
  // (layoutHeight - visualHeight) / 2. We translate up to compensate.
  const layoutHeight = containerSize * aspectRatio;
  const visualHeight = containerSize * scaleFactor;
  const translateY = (visualHeight - layoutHeight) / 2;

  return `translateY(${translateY}px) rotate(${rotation}deg) scale(${scaleFactor})`;
}
