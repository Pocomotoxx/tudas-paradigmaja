#!/usr/bin/env python
# hex_tile_render.py — Blender (bpy) starter script: render a 2.5D hex tile sprite.
#
# FEASIBILITY PROOF for the alternative-Europe 2.5D look. The game engine stays
# the deterministic TypeScript core + hex grid; Blender is only an ASSET PIPELINE
# that pre-renders 3D tiles to flat PNG sprites via a fixed angled orthographic
# camera (the classic Heroes/2.5D trick). Run it locally — this script does NOT
# run in the cloud session.
#
# Run (headless), e.g. on Windows:
#   "C:\Blender 5.2\blender.exe" -b -P art\blender\hex_tile_render.py -- --out art\tiles --size 256
#
# Flags after the `--`:
#   --out   DIR    output directory for PNGs (default: ./tiles)
#   --size  PX     square render resolution (default: 256)
#   --tilt  DEG    camera tilt from horizontal (default: 35; the 2.5D angle)
#   --height FLOAT extruded tile height (default: 0.35; 0 = flat)
#   --name  STR    output file base name (default: hex)
#
# Notes:
# - Transparent background (film transparent) so sprites composite on the map.
# - Orthographic camera => no perspective distortion => tiles tessellate cleanly.
# - Pointy-top hex (matches the axial model: 6 neighbours). Swap ROT for flat-top.

import bpy
import bmesh
import math
import sys
import os


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    opts = {"out": "./tiles", "size": 256, "tilt": 35.0, "height": 0.5, "name": "hex"}
    i = 0
    while i < len(argv):
        key = argv[i].lstrip("-")
        if key in opts and i + 1 < len(argv):
            val = argv[i + 1]
            opts[key] = type(opts[key])(val) if not isinstance(opts[key], str) else val
            i += 2
        else:
            i += 1
    return opts


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            block.remove(item)


def make_hex(height):
    """Create a pointy-top regular hexagon prism of circumradius 1."""
    mesh = bpy.data.meshes.new("HexTile")
    obj = bpy.data.objects.new("HexTile", mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    verts = []
    for k in range(6):
        ang = math.pi / 180.0 * (60 * k - 90)  # pointy-top
        verts.append(bm.verts.new((math.cos(ang), math.sin(ang), 0.0)))
    face = bm.faces.new(verts)
    if height > 0:
        # Extrude the top face and move only the newly created (top) geometry up,
        # leaving vertical side walls -> a chunky prism that reads as 2.5D depth.
        result = bmesh.ops.extrude_face_region(bm, geom=[face])
        top_verts = [e for e in result["geom"] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0, 0, height), verts=top_verts)
    bm.to_mesh(mesh)
    bm.free()
    return obj


def _simple_mat(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.85
    return mat


def add_materials(obj):
    """Two slots: 0 = top (lit), 1 = sides (darker, reads as shadowed depth)."""
    top = _simple_mat("TileTop", (0.46, 0.63, 0.40, 1.0))   # placeholder green
    side = _simple_mat("TileSide", (0.26, 0.34, 0.22, 1.0))  # darker side
    obj.data.materials.append(top)
    obj.data.materials.append(side)
    for poly in obj.data.polygons:
        poly.material_index = 0 if poly.normal.z > 0.5 else 1


def setup_camera(tilt_deg, size):
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.4  # fits a circumradius-1 hex with margin
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    tilt = math.radians(tilt_deg)
    dist = 10.0
    cam.location = (0.0, -dist * math.cos(tilt), dist * math.sin(tilt))
    cam.rotation_euler = (math.radians(90) - tilt, 0.0, 0.0)
    bpy.context.scene.camera = cam


def setup_light():
    light_data = bpy.data.lights.new("Sun", type="SUN")
    light_data.energy = 3.0
    light = bpy.data.objects.new("Sun", light_data)
    light.rotation_euler = (math.radians(55), math.radians(15), math.radians(35))
    bpy.context.collection.objects.link(light)


def render(out_dir, size, name):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in \
        [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    os.makedirs(out_dir, exist_ok=True)
    scene.render.filepath = os.path.join(out_dir, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[hex_tile_render] wrote {scene.render.filepath}")


def main():
    opts = parse_args()
    clear_scene()
    obj = make_hex(opts["height"])
    add_materials(obj)
    setup_camera(opts["tilt"], opts["size"])
    setup_light()
    render(opts["out"], opts["size"], opts["name"])


if __name__ == "__main__":
    main()
