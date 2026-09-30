"""Renders the 3D hero elements of the PetPal intro reel.

Run headless (Blender 5.x):
  blender -b -P frontend/scripts/reel/blender_assets.py -- <output_dir> [asset ...]

Each asset is a transparent PNG sequence in <output_dir>/<asset>/, packed
into animated WebP/GIF by build_reel_media.py. Colours follow the app tokens.
"""

import math
import os
import sys

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else os.path.join(os.getcwd(), "reel-renders")
ONLY = set(ARGS[1:])
SIZE = 360
FPS = 24

PALETTE = {
    "sun": (0.945, 0.769, 0.416),
    "clay": (0.769, 0.435, 0.306),
    "green": (0.184, 0.365, 0.275),
    "cream": (0.965, 0.949, 0.918),
    "ink": (0.07, 0.09, 0.08),
    "dog": (0.81, 0.58, 0.40),
    "dog_dark": (0.52, 0.33, 0.22),
    "cat": (0.88, 0.57, 0.37),
    "pink": (0.93, 0.55, 0.58),
    "heart": (0.83, 0.34, 0.29),
    "roof": (0.72, 0.38, 0.26),
    "wall": (0.96, 0.90, 0.80),
}


def srgb_to_linear(c):
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def reset(frames):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.render.film_transparent = True
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, frames
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    # Standard keeps the app's brand colours exact; AgX would desaturate them.
    scene.view_settings.view_transform = "Standard"
    scene.eevee.taa_render_samples = 24
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (
        *srgb_to_linear((0.95, 0.93, 0.88)),
        1,
    )
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
    scene.world = world

    target = bpy.data.objects.new("Target", None)
    scene.collection.objects.link(target)
    camera = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    camera.data.lens = 50
    camera.location = (0, -7.2, 1.6)
    scene.collection.objects.link(camera)
    track = camera.constraints.new("TRACK_TO")
    track.target = target
    scene.camera = camera

    for name, loc, energy, color, size in [
        ("Key", (-3.5, -4.5, 5.5), 520, (1.0, 0.96, 0.9), 5),
        ("Rim", (4.0, 3.5, 3.5), 420, (1.0, 0.85, 0.6), 3),
        ("Fill", (4.5, -4.0, 0.5), 160, (0.85, 0.92, 1.0), 6),
    ]:
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
        light.data.energy, light.data.color, light.data.size = energy, color, size
        light.location = loc
        scene.collection.objects.link(light)
        aim = light.constraints.new("TRACK_TO")
        aim.target = target
    return scene, target


def material(name, color, roughness=0.42, coat=0.35, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*srgb_to_linear(color), 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*srgb_to_linear(color), 1)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def sphere(name, loc, scale, mat, parent=None, segments=48):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=segments // 2, location=loc
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    if parent:
        obj.parent = parent
    return obj


def box(name, loc, scale, mat, parent=None, bevel=0.06):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(scale=True)
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width, mod.segments = bevel, 4
    bpy.ops.object.shade_smooth()
    if parent:
        obj.parent = parent
    return obj


def empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def keys(obj, path, frames):
    """frames: {frame: value}; value is a tuple for vector paths or a float."""
    for frame, value in frames.items():
        setattr(obj, path, value)
        obj.keyframe_insert(data_path=path, frame=frame)


def render(scene, name):
    folder = os.path.join(OUT, name)
    os.makedirs(folder, exist_ok=True)
    scene.render.filepath = os.path.join(folder, "")
    bpy.ops.render.render(animation=True)
    print(f"RENDERED {name} -> {folder}")


def paw():
    scene, target = reset(48)
    target.location = (0, 0, 0)
    root = empty("Paw")
    gold = material("Gold", PALETTE["sun"], roughness=0.28, coat=0.6)
    sphere("Pad", (0, 0, -0.45), (1.05, 0.5, 0.85), gold, root)
    for i, (x, z, s) in enumerate(
        [(-1.05, 0.55, 0.36), (-0.38, 1.05, 0.4), (0.38, 1.05, 0.4), (1.05, 0.55, 0.36)]
    ):
        toe = sphere(f"Toe{i}", (x, 0, z), (s, s * 0.8, s * 1.15), gold, root)
        keys(
            toe,
            "scale",
            {
                1: (0.001,) * 3,
                8 + i * 3: (s * 1.25, s, s * 1.4),
                14 + i * 3: (s, s * 0.8, s * 1.15),
            },
        )
    keys(root, "scale", {1: (0.2, 0.2, 0.2), 9: (1.12, 1.12, 1.12), 16: (1, 1, 1)})
    keys(
        root,
        "rotation_euler",
        {
            1: (0, 0, math.radians(-40)),
            16: (0, 0, math.radians(8)),
            32: (0, 0, math.radians(-10)),
            48: (0, 0, math.radians(8)),
        },
    )
    keys(
        root,
        "location",
        {
            1: (0, 0, -1.2),
            12: (0, 0, 0.12),
            20: (0, 0, 0),
            36: (0, 0, 0.12),
            48: (0, 0, 0),
        },
    )
    render(scene, "paw")


def house():
    scene, target = reset(60)
    target.location = (0, 0, 0.6)
    root = empty("House")
    wall, roof_mat = (
        material("Wall", PALETTE["wall"], 0.6, 0.1),
        material("Roof", PALETTE["roof"], 0.45),
    )
    door_mat = material("Door", PALETTE["green"], 0.4)
    # A tiny non-zero emission sets the glow colour; the strength is animated below.
    glow = material("Window", PALETTE["sun"], 0.3, 0.2, emission=0.001)
    body = box("Body", (0, 0, 0.55), (1.2, 0.95, 0.9), wall, root)
    roof = bpy.data.meshes.new("Roof")
    verts = [
        (-1.45, -1.15, 1.35),
        (1.45, -1.15, 1.35),
        (1.45, 1.15, 1.35),
        (-1.45, 1.15, 1.35),
        (0, -1.15, 2.55),
        (0, 1.15, 2.55),
    ]
    roof.from_pydata(
        verts, [], [(0, 1, 4), (3, 5, 2), (0, 4, 5, 3), (1, 2, 5, 4), (0, 3, 2, 1)]
    )
    roof_obj = bpy.data.objects.new("Roof", roof)
    roof_obj.data.materials.append(roof_mat)
    scene.collection.objects.link(roof_obj)
    roof_obj.parent = root
    bevel = roof_obj.modifiers.new("Bevel", "BEVEL")
    bevel.width, bevel.segments = 0.05, 3
    door = box("Door", (0.45, -0.96, 0.3), (0.26, 0.04, 0.45), door_mat, root, 0.03)
    window = box("Window", (-0.5, -0.96, 0.75), (0.26, 0.04, 0.24), glow, root, 0.03)
    chimney = box("Chimney", (0.75, 0.3, 2.1), (0.16, 0.16, 0.4), roof_mat, root, 0.03)
    keys(body, "scale", {1: (1, 1, 0.001), 12: (1, 1, 1.08), 16: (1, 1, 1)})
    keys(
        roof_obj,
        "location",
        {1: (0, 0, 4), 12: (0, 0, 4), 20: (0, 0, -0.12), 25: (0, 0, 0)},
    )
    keys(door, "scale", {1: (1, 1, 0.001), 22: (1, 1, 0.001), 28: (1, 1, 1)})
    keys(
        window,
        "scale",
        {1: (0.001,) * 3, 24: (0.001,) * 3, 30: (1.15, 1, 1.15), 34: (1, 1, 1)},
    )
    keys(chimney, "scale", {1: (1, 1, 0.001), 26: (1, 1, 0.001), 32: (1, 1, 1)})
    strength = glow.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
    for frame, value in {1: 0.0, 34: 0.0, 42: 3.2, 60: 2.6}.items():
        strength.default_value = value
        strength.keyframe_insert("default_value", frame=frame)
    keys(
        root,
        "rotation_euler",
        {1: (0, 0, math.radians(-45)), 60: (0, 0, math.radians(-22))},
    )
    render(scene, "house")


def face(kind):
    scene, target = reset(48)
    target.location = (0, 0, 0.1)
    root = empty("Head")
    fur = material("Fur", PALETTE["dog" if kind == "dog" else "cat"], 0.55, 0.15)
    dark = material("Dark", PALETTE["dog_dark" if kind == "dog" else "clay"], 0.55, 0.1)
    cream = material("Cream", PALETTE["cream"], 0.6, 0.1)
    ink = material("Ink", PALETTE["ink"], 0.15, 0.8)
    pink = material("Pink", PALETTE["pink"], 0.35, 0.3)
    sphere("Skull", (0, 0, 0), (1.25, 1.1, 1.12), fur, root)
    sphere("Muzzle", (0, -0.95, -0.35), (0.62, 0.45, 0.42), cream, root)
    sphere(
        "Nose",
        (0, -1.38, -0.18),
        (0.2, 0.14, 0.14) if kind == "dog" else (0.13, 0.09, 0.09),
        ink if kind == "dog" else pink,
        root,
    )
    eyes = [
        sphere(
            f"Eye{side}", (side * 0.45, -1.0, 0.22), (0.14, 0.1, 0.17), ink, root, 24
        )
        for side in (-1, 1)
    ]
    for eye in eyes:
        keys(
            eye,
            "scale",
            {
                1: (0.14, 0.1, 0.17),
                30: (0.14, 0.1, 0.17),
                33: (0.15, 0.1, 0.02),
                36: (0.14, 0.1, 0.17),
            },
        )
    ears = []
    for side in (-1, 1):
        pivot = empty(f"EarPivot{side}", root)
        pivot.location = (side * 0.95, 0, 0.75)
        if kind == "dog":
            ear = sphere(
                f"Ear{side}", (side * 0.35, 0.05, -0.55), (0.38, 0.2, 0.8), dark, pivot
            )
            ear.rotation_euler = (0, math.radians(side * -18), 0)
        else:
            bpy.ops.mesh.primitive_cone_add(
                vertices=48, radius1=0.42, depth=0.8, location=(0, 0, 0.3)
            )
            ear = bpy.context.active_object
            ear.data.materials.append(dark)
            bpy.ops.object.shade_smooth()
            ear.scale = (1, 0.5, 1)
            ear.rotation_euler = (0, math.radians(side * 22), 0)
            ear.parent = pivot
        ears.append(pivot)
    if kind == "cat":
        whisker = material("Whisker", PALETTE["ink"], 0.4, 0)
        for side in (-1, 1):
            for tilt in (-8, 6):
                bpy.ops.mesh.primitive_cylinder_add(
                    vertices=8,
                    radius=0.012,
                    depth=0.9,
                    location=(side * 0.85, -1.05, -0.3),
                )
                w = bpy.context.active_object
                w.data.materials.append(whisker)
                w.rotation_euler = (0, math.radians(90), math.radians(tilt * side))
                w.parent = root
    else:
        sphere("Tongue", (0, -1.18, -0.68), (0.16, 0.08, 0.2), pink, root, 24)
    flap = 22 if kind == "dog" else 12
    for index, pivot in enumerate(ears):
        side = -1 if index == 0 else 1
        keys(
            pivot,
            "rotation_euler",
            {
                1: (0, 0, 0),
                10: (0, math.radians(side * flap), 0),
                16: (0, 0, 0),
                34: (0, 0, 0),
                40: (0, math.radians(side * flap * 0.6), 0),
                48: (0, 0, 0),
            },
        )
    tilt = 12 if kind == "dog" else -12
    keys(
        root,
        "rotation_euler",
        {
            1: (0, 0, math.radians(-25 if kind == "dog" else 25)),
            14: (0, math.radians(tilt), 0),
            30: (0, math.radians(-tilt * 0.5), 0),
            48: (0, math.radians(tilt), 0),
        },
    )
    keys(root, "scale", {1: (0.3, 0.3, 0.3), 9: (1.08, 1.08, 1.08), 15: (1, 1, 1)})
    render(scene, kind)


def heart():
    scene, target = reset(36)
    target.location = (0, 0, 0)
    # Classic parametric heart outline, filled, thickened and rounded into a
    # puffy toy heart facing the camera.
    points = []
    for i in range(96):
        a = i / 96 * math.tau
        x = 16 * math.sin(a) ** 3
        z = (
            13 * math.cos(a)
            - 5 * math.cos(2 * a)
            - 2 * math.cos(3 * a)
            - math.cos(4 * a)
        )
        points.append((x * 0.085, 0, z * 0.085 + 0.25))
    # Outline as a thick filled curve (no bevel: it spikes at the cusp), then
    # remeshed, smoothed round and cast towards a sphere so it bulges like the paw.
    curve = bpy.data.curves.new("HeartCurve", "CURVE")
    curve.dimensions, curve.fill_mode = "2D", "BOTH"
    curve.extrude, curve.bevel_depth = 0.32, 0.0
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, (x, _, z) in zip(spline.points, points):
        point.co = (x, z, 0, 1)
    spline.use_cyclic_u = True
    obj = bpy.data.objects.new("Heart", curve)
    scene.collection.objects.link(obj)
    obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.transform_apply(rotation=True)
    remesh = obj.modifiers.new("Remesh", "REMESH")
    remesh.mode, remesh.voxel_size = "VOXEL", 0.03
    rounder = obj.modifiers.new("Round", "SMOOTH")
    rounder.factor, rounder.iterations = 1.0, 12
    cast = obj.modifiers.new("Puff", "CAST")
    cast.cast_type, cast.factor, cast.use_y, cast.use_x, cast.use_z = (
        "SPHERE",
        0.45,
        True,
        False,
        False,
    )
    obj.modifiers.new("Smooth", "SUBSURF").levels = 1
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(material("Heart", PALETTE["heart"], 0.25, 0.7))
    keys(
        obj,
        "scale",
        {
            1: (0.2, 0.2, 0.2),
            8: (1.2, 1.2, 1.2),
            13: (0.95, 0.95, 0.95),
            17: (1, 1, 1),
            24: (1.1, 1.1, 1.1),
            28: (0.97, 0.97, 0.97),
            36: (1, 1, 1),
        },
    )
    keys(
        obj,
        "rotation_euler",
        {1: (0, 0, math.radians(-30)), 17: (0, 0, math.radians(6)), 36: (0, 0, 0)},
    )
    render(scene, "heart")


ASSETS = {
    "paw": paw,
    "house": house,
    "dog": lambda: face("dog"),
    "cat": lambda: face("cat"),
    "heart": heart,
}
for asset_name, build in ASSETS.items():
    if not ONLY or asset_name in ONLY:
        build()
