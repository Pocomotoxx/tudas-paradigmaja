#!/usr/bin/env python
# render_atlas.py — batch-render the full tile set + write an index.json.
#
# Reuses hex_tile_render.py's builders. Renders one PNG sprite per kind
# (plain + the discipline cities + fortress/city) and writes an index.json the
# web presentation layer can load. This is an "atlas by convention" (one PNG per
# tile + an index); a packed single-image atlas is an optional later step.
#
# Run locally (the file must sit next to hex_tile_render.py):
#   "C:\Blender 5.2\blender.exe" -b -P art\blender\render_atlas.py -- --out art\tiles --size 256 --tilt 35

import bpy  # noqa: F401  (ensures we're inside Blender)
import json
import os
import sys
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("hex_tile_render", os.path.join(HERE, "hex_tile_render.py"))
htr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(htr)

KINDS = ["plain", "numeris", "dynamis", "catalyss", "viridia", "chronopolis", "fortress", "city"]


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    opts = {"out": "./tiles", "size": 256, "tilt": 35.0, "height": 0.5}
    i = 0
    while i < len(argv):
        key = argv[i].lstrip("-")
        if key in opts and i + 1 < len(argv):
            opts[key] = type(opts[key])(argv[i + 1])
            i += 2
        else:
            i += 1
    return opts


def main():
    o = parse_args()
    os.makedirs(o["out"], exist_ok=True)
    tiles = []
    for kind in KINDS:
        htr.clear_scene()
        obj = htr.make_hex(o["height"])
        terrain = htr.KIND_TERRAIN.get(kind, htr.KIND_TERRAIN["plain"])
        htr.add_materials(obj, terrain)
        htr.add_marker(kind, o["height"])
        htr.setup_camera(o["tilt"], o["size"])
        htr.setup_light()
        htr.render(o["out"], o["size"], kind)
        tiles.append({"kind": kind, "file": f"{kind}.png"})

    index = {
        "tileSize": int(o["size"]),
        "tilt": float(o["tilt"]),
        "orientation": "pointy-top",
        "tiles": tiles,
    }
    index_path = os.path.join(o["out"], "index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)
    print(f"[render_atlas] wrote {len(tiles)} tiles + {index_path}")


if __name__ == "__main__":
    main()
