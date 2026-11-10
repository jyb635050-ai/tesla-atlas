# 列出原始模型每个网格物体的材质、面数、包围盒（判断哪个是车漆/内饰/地面用）。用法：blender -b --python tools/bl_list.py -- <glb>
import bpy, sys, os
from mathutils import Vector
glb = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
for o in bpy.context.scene.objects:
    if o.type != 'MESH': continue
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]; mn = [min(p[i] for p in pts) for i in range(3)]; mx = [max(p[i] for p in pts) for i in range(3)]
    print('OBJ %-34s %-40s %7d  x[%.2f,%.2f] y[%.2f,%.2f] z[%.2f,%.2f]' % (o.name[:34], ','.join(s.material.name for s in o.material_slots if s.material)[:40], len(o.data.polygons), mn[0], mx[0], mn[1], mx[1], mn[2], mx[2]))
