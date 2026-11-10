# 预览原始社区模型：打印尺寸，渲染斜视/俯视/剖开侧视三张图，用来判断朝向、有没有内饰。
# 用法：blender -b --python tools/bl_preview.py -- <glb> <输出前缀>
import bpy, sys, math
from mathutils import Vector
import os
glb, out = [os.path.abspath(p) for p in sys.argv[sys.argv.index('--') + 1:][:2]]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in ms:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        for i in range(3): mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
size = mx - mn; cen = (mx + mn) / 2
print('BBOX size x/y/z = %.3f %.3f %.3f  center %.3f %.3f %.3f  meshes %d' % (*size, *cen, len(ms)))
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x = 800; sc.render.resolution_y = 500; sc.render.film_transparent = False
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'; sc.display.shading.show_cavity = True
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
R = max(size) * 1.0
def shot(name, direction, ortho=False, clip=None):
    d = Vector(direction).normalized(); cam.location = cen + d * R * 2.2
    cam.rotation_euler = (cen - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.type = 'ORTHO' if ortho else 'PERSP'; cam.data.ortho_scale = R * 1.25; cam.data.lens = 50
    cam.data.clip_start = clip if clip else 0.01; cam.data.clip_end = R * 10
    sc.render.filepath = out + '_' + name + '.png'; bpy.ops.render.render(write_still=True)
shot('iso', (1, -1, 0.6)); shot('top', (0, 0, 1), True)
# 剖开：正交侧视，近裁剪面切到车身中线偏外一点，能看到车内
ax = 0 if size.x < size.y else 1  # 车宽方向
d = [0, 0, 0]; d[ax] = 1
shot('cut', d, True, clip=R * 2.2 - size[ax] * 0.2)
