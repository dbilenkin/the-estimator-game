"""Convert the Kenney Animated Characters base (FBX model + FBX animations) into one GLB with idle/run/jump clips.
  Blender --background --python blender/kenney_convert.py
Also writes a UV layout image for painting skins.
"""
import bpy, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets-src", "kenney-animated", "protagonists")
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, "Model", "characterMedium.fbx"))
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
print("MODEL", arm.name, [(m.name, len(m.data.polygons), [s.material.name if s.material else None for s in m.material_slots]) for m in meshes])
print("BONES", len(arm.data.bones), [b.name for b in arm.data.bones][:40])
print("DIMS", [tuple(round(x, 3) for x in m.dimensions) for m in meshes], "scale", tuple(arm.scale))
base = set(bpy.data.objects)
sc = bpy.context.scene
arm.animation_data_create()
order = []                                              # parents before children


def walk(b):
    order.append(b.name)
    for c in b.children:
        walk(c)


for b in arm.data.bones:
    if b.parent is None:
        walk(b)
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"
baked = {}
for clip in ("idle", "run", "jump"):
    # The animation files carry their own skeleton with a different rest pose (arms down), so the curves cannot be
    # reused directly on the T-posed model: copy each frame's bone positions across and key them instead.
    before = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, "Animations", clip + ".fbx"))
    src_arm = next(o for o in bpy.data.objects if o.type == "ARMATURE" and o not in base)
    src_act = max((a for a in bpy.data.actions if a not in before), key=lambda a: a.frame_range[1] - a.frame_range[0])
    src_arm.animation_data.action = src_act
    if hasattr(src_arm.animation_data, "action_slot") and src_act.slots:
        src_arm.animation_data.action_slot = src_act.slots[0]
    f0, f1 = int(src_act.frame_range[0]), int(src_act.frame_range[1])
    act = bpy.data.actions.new(clip)
    arm.animation_data.action = act
    rel = arm.matrix_world.inverted() @ src_arm.matrix_world
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        for name in order:
            if name in src_arm.pose.bones:
                arm.pose.bones[name].matrix = rel @ src_arm.pose.bones[name].matrix
                bpy.context.view_layer.update()
        for name in order:
            pb = arm.pose.bones[name]
            for path in ("location", "rotation_quaternion", "scale"):
                pb.keyframe_insert(path, frame=f - f0 + 1)
    baked[clip] = (act, arm.animation_data.action_slot if hasattr(arm.animation_data, "action_slot") else None)
    print("CLIP", clip, f0, f1)
    for o in list(bpy.data.objects):
        if o not in base:
            bpy.data.objects.remove(o, do_unlink=True)
arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
for clip, (act, slot) in baked.items():
    tr = arm.animation_data.nla_tracks.new()
    tr.name = clip
    st = tr.strips.new(clip, 1, act)
    if slot is not None:
        st.action_slot = slot
arm.animation_data.action = None
for m in meshes:                                           # the FBX material comes in fully transparent
    for sl in m.material_slots:
        b = sl.material.node_tree.nodes.get("Principled BSDF") if sl.material.use_nodes else None
        if b:
            b.inputs["Alpha"].default_value = 1.0
            b.inputs["Base Color"].default_value = (1, 1, 1, 1)
        sl.material.blend_method = "OPAQUE"
out = os.path.join(ROOT, "game", "assets", "characters", "kenney_base.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_animations=True, export_animation_mode="NLA_TRACKS",
                          export_materials="EXPORT", export_image_format="NONE")
print("EXPORTED", out, os.path.getsize(out))
