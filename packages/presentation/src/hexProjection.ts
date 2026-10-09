// hexProjection — pure axial-hex -> screen-pixel projection for the 2.5D map.
//
// Pointy-top hexes (matching the core's axial model). The vertical axis is
// squashed by `squash` (< 1) to fake the tilted-camera 2.5D look, so flat-top
// tile sprites rendered in Blender line up with the grid. All pure math, so the
// web renderer and any tests share one source of truth.

export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

export interface HexLayout {
  /** Hex "size" = centre-to-corner in pixels (before squash). */
  readonly size: number;
  /** Vertical squash factor for the 2.5D look (1 = flat top-down). */
  readonly squash: number;
  /** Screen origin (pixel position of hex (0,0)). */
  readonly originX: number;
  readonly originY: number;
}

export function defaultLayout(size = 48, squash = 0.72, originX = 0, originY = 0): HexLayout {
  return { size, squash, originX, originY };
}

/** Axial (q, r) -> pixel centre for a pointy-top hex, with 2.5D squash. */
export function hexToPixel(q: number, r: number, layout: HexLayout): PixelPoint {
  const x = layout.size * Math.sqrt(3) * (q + r / 2);
  const y = layout.size * 1.5 * r * layout.squash;
  return { x: layout.originX + x, y: layout.originY + y };
}

/**
 * Back-to-front draw order for correct 2.5D overlap: rows of increasing r are
 * nearer the viewer, so draw smaller r first; within a row, left-to-right by q.
 */
export function drawOrder<T extends { q: number; r: number }>(tiles: readonly T[]): T[] {
  return [...tiles].sort((a, b) => (a.r - b.r) || (a.q - b.q));
}

/** The 6 corner points of a pointy-top hex outline at a pixel centre. */
export function hexCorners(center: PixelPoint, layout: HexLayout): PixelPoint[] {
  const pts: PixelPoint[] = [];
  for (let k = 0; k < 6; k++) {
    const ang = (Math.PI / 180) * (60 * k - 90); // pointy-top
    pts.push({
      x: center.x + layout.size * Math.cos(ang),
      y: center.y + layout.size * layout.squash * Math.sin(ang),
    });
  }
  return pts;
}
