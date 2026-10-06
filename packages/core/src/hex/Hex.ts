// Hex — axial hex coordinate (q, r) with cube-derived helpers.
//
// We use the axial coordinate system (two stored axes q, r; the third cube
// axis is s = -q - r). This is the standard, well-understood hex model and
// keeps neighbour and distance math simple and deterministic. All methods are
// pure; a Hex is treated as immutable.

/** Readonly axial hex coordinate. */
export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

/** The six axial neighbour directions, in a fixed, deterministic order. */
export const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const;

export class Hex implements HexCoord {
  readonly q: number;
  readonly r: number;

  constructor(q: number, r: number) {
    if (!Number.isInteger(q) || !Number.isInteger(r)) {
      throw new TypeError(`Hex coordinates must be integers, got (${q}, ${r})`);
    }
    this.q = q;
    this.r = r;
  }

  /** Implicit cube s-axis. */
  get s(): number {
    return -this.q - this.r;
  }

  /** Stable string key, usable as a Map key and for deterministic ordering. */
  key(): string {
    return `${this.q},${this.r}`;
  }

  static fromKey(key: string): Hex {
    const parts = key.split(",");
    if (parts.length !== 2) {
      throw new TypeError(`Invalid hex key: ${key}`);
    }
    return new Hex(Number(parts[0]), Number(parts[1]));
  }

  equals(other: HexCoord): boolean {
    return this.q === other.q && this.r === other.r;
  }

  add(other: HexCoord): Hex {
    return new Hex(this.q + other.q, this.r + other.r);
  }

  /** Hex-grid distance (number of steps between two hexes). */
  distance(other: HexCoord): number {
    const dq = Math.abs(this.q - other.q);
    const dr = Math.abs(this.r - other.r);
    const ds = Math.abs(this.s - (-other.q - other.r));
    return (dq + dr + ds) / 2;
  }

  /** The six adjacent hexes, in HEX_DIRECTIONS order. */
  neighbours(): Hex[] {
    return HEX_DIRECTIONS.map((d) => this.add(d));
  }
}
