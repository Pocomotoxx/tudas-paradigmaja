import { describe, it, expect } from "vitest";
import { defaultLayout, hexToPixel, drawOrder, hexCorners } from "./hexProjection.js";

describe("hexProjection (I31)", () => {
  it("maps the origin hex to the layout origin", () => {
    const L = defaultLayout(48, 0.72, 100, 100);
    expect(hexToPixel(0, 0, L)).toEqual({ x: 100, y: 100 });
  });

  it("applies the vertical squash to r", () => {
    const L = defaultLayout(48, 0.5, 0, 0);
    const p = hexToPixel(0, 1, L);
    expect(p.y).toBeCloseTo(48 * 1.5 * 1 * 0.5, 6); // 36
    // q offset within a row uses sqrt(3)*size
    expect(hexToPixel(1, 0, L).x).toBeCloseTo(48 * Math.sqrt(3), 6);
  });

  it("is deterministic and r/2 shear is applied", () => {
    const L = defaultLayout(10, 1, 0, 0);
    const a = hexToPixel(0, 2, L);
    const b = hexToPixel(-1, 2, L); // same row, shifted left by one hex width
    expect(a.x - b.x).toBeCloseTo(10 * Math.sqrt(3), 6);
  });

  it("orders tiles back-to-front (r then q)", () => {
    const tiles = [
      { q: 1, r: 1 }, { q: 0, r: 0 }, { q: -1, r: 1 }, { q: 2, r: 0 },
    ];
    expect(drawOrder(tiles)).toEqual([
      { q: 0, r: 0 }, { q: 2, r: 0 }, { q: -1, r: 1 }, { q: 1, r: 1 },
    ]);
  });

  it("produces 6 hex corners squashed vertically", () => {
    const L = defaultLayout(10, 0.5, 0, 0);
    const corners = hexCorners({ x: 0, y: 0 }, L);
    expect(corners).toHaveLength(6);
    // top corner (k=0, angle -90) is straight up, squashed: y = -size*squash
    expect(corners[0].x).toBeCloseTo(0, 6);
    expect(corners[0].y).toBeCloseTo(-10 * 0.5, 6);
  });
});
