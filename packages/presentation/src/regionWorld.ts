// regionWorld — bridge a map-pack (web/world/<id>/map.json) into the core's
// strategic RegionGraph. Pure: takes the already-parsed pack object and returns
// a RegionGraph, so the strategic layer runs on real map data (NUTS 1 regions
// on the Europe pack, Voronoi provinces on the fantasy pack) while battles stay
// on the hex layer.

import { RegionGraph, type RegionInit } from "@tudas-paradigmaja/core";

/** One province as stored in a map-pack's map.json. */
export interface PackProvince {
  readonly id: number;
  readonly name?: string;
  readonly faction?: string;
  readonly capital?: boolean;
  /** Indices into the provinces array (symmetric land adjacency). */
  readonly adj: readonly number[];
  /** Europe pack only: the NUTS 1 / country code. */
  readonly nutsId?: string;
}

export interface MapPack {
  readonly provinces: readonly PackProvince[];
  readonly meta?: { readonly id?: string; readonly kind?: string };
}

/** Region id for a province: its NUTS id on Europe, else a synthetic prov id. */
export function regionIdOf(p: PackProvince): string {
  return p.nutsId ?? `prov_${p.id}`;
}

/**
 * Build a core RegionGraph from a parsed map pack. Each province becomes a
 * region owned by its faction; adjacency indices are resolved to region ids
 * and de-duplicated; a capital province sites a knowledge centre `kc_<region>`.
 * Out-of-range adjacency indices are ignored (defensive against hand edits).
 */
export function buildRegionGraph(pack: MapPack): RegionGraph {
  const provinces = pack.provinces;
  const idOf = (i: number): string | undefined =>
    i >= 0 && i < provinces.length ? regionIdOf(provinces[i]!) : undefined;

  const regions: RegionInit[] = provinces.map((p) => {
    const self = regionIdOf(p);
    const adjacent: string[] = [];
    const seen = new Set<string>();
    for (const i of p.adj) {
      const nb = idOf(i);
      if (nb === undefined || nb === self || seen.has(nb)) continue;
      seen.add(nb);
      adjacent.push(nb);
    }
    const init: RegionInit = { id: self, adjacent };
    return {
      ...init,
      ...(p.name !== undefined ? { name: p.name } : {}),
      ...(p.faction !== undefined ? { owner: p.faction } : {}),
      ...(p.capital ? { centerId: `kc_${self}` } : {}),
    };
  });

  return new RegionGraph(regions);
}
