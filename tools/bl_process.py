# 把下载的社区模型处理成本站格式：摆正朝向、等比缩放到官方车长、标出车漆、切出车门、归拢内饰、加车内机位，导出 glb。
# 用法：blender -b --python tools/bl_process.py -- <车 id>      配置在 tools/models.json，尺寸读 data/cars.json
# 坐标（Blender）：车头 +X、左侧 +Y、上 +Z；导出 glTF 后是 车头 +X、上 +Y、左侧 −Z。
import bpy, bmesh, sys, os, json, re, math
from mathutils import Vector, Matrix
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
cid = sys.argv[sys.argv.index('--') + 1]
cfg = json.load(open(os.path.join(ROOT, 'tools/models.json'), encoding='utf-8'))[cid]
car = next(c for c in json.load(open(os.path.join(ROOT, 'data/cars.json'), encoding='utf-8')) if c['id'] == cid)
rx = lambda pats, s: any(re.search(p, s, re.I) for p in pats)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'raw', cid, cfg['uid'], 'model.glb'))
sc = bpy.context.scene
def meshes(): return [o for o in sc.objects if o.type == 'MESH']
def matnames(o): return [s.material.name for s in o.material_slots if s.material]
def wbox(objs):
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3): mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
    return mn, mx

# 1) 扁平化：解除父子关系并保留世界变换，删掉非网格物体和点名要丢的物体
for o in list(sc.objects):
    if o.type == 'MESH':
        m = o.matrix_world.copy(); o.parent = None; o.matrix_world = m
for o in list(sc.objects):
    if o.type != 'MESH' or rx(cfg.get('drop', []), o.name) or any(rx(cfg.get('dropMat', []), n) for n in matnames(o)): bpy.data.objects.remove(o, do_unlink=True)
if 'keep' in cfg:  # 只保留包围盒中心落在指定范围内的物体（原模型坐标）
    k = cfg['keep']
    for o in meshes():
        mn, mx = wbox([o]); c = (mn + mx) / 2
        if not all(k[i][0] <= c[i] <= k[i][1] for i in range(3)) or max(mx - mn) > k[3]: bpy.data.objects.remove(o, do_unlink=True)
for o in meshes():
    if o.data.users > 1: o.data = o.data.copy()
# 2) 摆正：车头转到 +X；等比缩放到官方车长；落地、居中
rot = {'+X': 0, '-X': 180, '+Y': -90, '-Y': 90}[cfg['front']] + cfg.get('yaw', 0)
R = Matrix.Rotation(math.radians(rot), 4, 'Z')
for o in meshes(): o.matrix_world = R @ o.matrix_world
mn, mx = wbox(meshes()); size = mx - mn
L = (car['dims']['l'] / 1000) if car.get('dims') else cfg['length']
s = L / size.x
fx = cfg.get('fix', [1, 1, 1])  # 各方向 ≤3% 的微调（只用于把模型自身的比例误差拉回官方尺寸，记在 SOURCES.md）
assert all(abs(v - 1) <= 0.03 for v in fx)
T = Matrix.Diagonal((fx[0], fx[1], fx[2], 1)) @ Matrix.Scale(s, 4) @ Matrix.Translation(Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z)))
for o in meshes(): o.matrix_world = T @ o.matrix_world
bpy.ops.object.select_all(action='DESELECT')
for o in meshes(): o.select_set(True)
bpy.context.view_layer.objects.active = meshes()[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mn, mx = wbox(meshes()); W = mx.y - mn.y; H = mx.z - mn.z; hw = W / 2
print('SIZE 长 %.3f 宽 %.3f 高 %.3f（等比缩放 %.4f）' % (mx.x - mn.x, W, H, s))
if car.get('dims'):
    d = car['dims']; print('DEV 宽 %+.1f%% 高 %+.1f%%' % ((W * 1000 / d['w'] - 1) * 100, (H * 1000 / d['h'] - 1) * 100))
# 2.5) 合并重合顶点（原模型顶点没共用，文件会大三倍）、按配置减面
for o in meshes():
    a = o.data.attributes.get('custom_normal')
    if a: o.data.attributes.remove(a)
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-5); bm.to_mesh(o.data); bm.free()
    for pat, ratio in cfg.get('decimate', {}).items():
        if (rx([pat], o.name) or any(rx([pat], x) for x in matnames(o))) and len(o.data.polygons) > 300:
            md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = ratio
            bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=md.name); break
# 3) 车漆材质改名
n = 0
for m in bpy.data.materials:
    if rx(cfg['paint'], m.name): m.name = 'paint_body' if n == 0 else 'paint_body_%d' % n; n += 1
print('PAINT 材质数', n)
# 3.5) 原模型丢了颜色的材质（导出后一片白）按配置补颜色：[r,g,b,透明度,金属度,粗糙度]
for m in bpy.data.materials:
    for pat, v in cfg.get('tint', {}).items():
        if not rx([pat], m.name): continue
        m.use_nodes = True
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not b: break
        for l in list(b.inputs['Base Color'].links): m.node_tree.links.remove(l)
        b.inputs['Base Color'].default_value = (v[0], v[1], v[2], 1); b.inputs['Alpha'].default_value = v[3]; b.inputs['Metallic'].default_value = v[4]; b.inputs['Roughness'].default_value = v[5]
        if v[3] < 1:
            try: m.surface_render_method = 'BLENDED'
            except Exception: m.blend_method = 'BLEND'
        break
# 4) 归类：内饰物体
def is_interior(o): return rx(cfg.get('interiorObj', []), o.name) or any(rx(cfg.get('interior', []), x) for x in matnames(o))
interior = [o for o in meshes() if is_interior(o)]
# 5) 切车门
def empty(name, loc):
    e = bpy.data.objects.new(name, None); sc.collection.objects.link(e); e.location = loc; e.empty_display_size = 0.1; return e
bpy.context.view_layer.update()
for d in cfg.get('doors', []):
    side = 1 if d['id'].endswith('l') else -1
    x0, x1 = d['x'][0] * L, d['x'][1] * L; z0 = d.get('z0', 0.2) * H; z1 = d.get('z1', 0.95) * H; dep = d.get('depth', 0.2)
    def ycut(z): return hw * ((1 - dep) - d.get('lean', 0.22) * max(0.0, min(1.0, (z - 0.55 * H) / (0.45 * H))))
    pieces = []
    for o in [m for m in meshes() if not rx(cfg.get('noCut', []), m.name) and m not in interior and not m.name.startswith('door_')]:
        omn, omx = wbox([o])
        if omx.x < x0 or omn.x > x1 or omx.z < z0 or omn.z > z1 or max(omx.y * side, omn.y * side) < ycut(H) * 0.9: continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        for co, no in ((Vector((x0, 0, 0)), Vector((1, 0, 0))), (Vector((x1, 0, 0)), Vector((1, 0, 0))), (Vector((0, 0, z0)), Vector((0, 0, 1))), (Vector((0, 0, z1)), Vector((0, 0, 1)))):
            g = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=g, plane_co=co, plane_no=no, dist=1e-5)
        sel = []
        for f in bm.faces:
            c = f.calc_center_median()
            if x0 < c.x < x1 and z0 < c.z < z1 and c.y * side > ycut(c.z): sel.append(f)
        if not sel: bm.free(); continue
        if len(sel) == len(bm.faces):
            bm.free(); pieces.append(o); continue
        bm.faces.index_update(); idx = set(f.index for f in sel)
        nm = o.data.copy(); bm2 = bm.copy()
        bmesh.ops.delete(bm, geom=sel, context='FACES'); bm.to_mesh(o.data); bm.free()
        bm2.faces.ensure_lookup_table()
        bmesh.ops.delete(bm2, geom=[f for f in bm2.faces if f.index not in idx], context='FACES'); bm2.to_mesh(nm); bm2.free()
        no_ = bpy.data.objects.new(o.name + '_' + d['id'], nm); sc.collection.objects.link(no_); pieces.append(no_)
    hinge = Vector((x1 if not d.get('rearHinge') else x0, side * hw * 0.93, 0.5 * H))
    if d.get('falcon'): hinge = Vector(((x0 + x1) / 2, side * 0.06, z1))
    e = empty('door_' + d['id'], hinge)
    if d.get('falcon'): e['axis'] = [1.0, 0.0, 0.0]; e['angle'] = side * 1.2   # glTF 坐标：左侧在 −Z，绕 +X 转正角把 −Z 一侧抬起来
    if d.get('butterfly'): e['axis'] = [0.42, 0.8, side * 0.2]; e['angle'] = -side * 1.0
    bpy.context.view_layer.update()
    tris = 0
    for p in pieces:
        mw = p.matrix_world.copy(); p.parent = e; p.matrix_parent_inverse = e.matrix_world.inverted(); p.matrix_world = mw
        p.data.calc_loop_triangles(); tris += len(p.data.loop_triangles)
    print('DOOR %s 块数 %d 三角面 %d' % (d['id'], len(pieces), tris))
# 6) 内饰归到 interior 节点下
if interior:
    e = empty('interior', Vector((0, 0, 0))); bpy.context.view_layer.update(); t = 0
    for p in interior:
        mw = p.matrix_world.copy(); p.parent = e; p.matrix_world = mw; p.data.calc_loop_triangles(); t += len(p.data.loop_triangles)
    print('INTERIOR 物体 %d 三角面 %d' % (len(interior), t))
# 7) 车内机位（面朝车头）
if 'cam' in cfg:
    e = empty('cam_interior', Vector((cfg['cam'][0] * L, cfg['cam'][2] * hw if len(cfg['cam']) > 2 else 0, cfg['cam'][1] * H)))
total = 0
for o in meshes(): o.data.calc_loop_triangles(); total += len(o.data.loop_triangles)
print('TOTAL 三角面 %d 物体 %d' % (total, len(meshes())))
bpy.ops.object.select_all(action='DESELECT')
for o in meshes(): o.select_set(True)
bpy.context.view_layer.objects.active = meshes()[0]
bpy.ops.object.shade_auto_smooth(angle=math.radians(cfg.get('smooth', 38)))
out = os.path.join(ROOT, 'raw', cid, 'processed.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_extras=True, export_cameras=False, export_lights=False, export_animations=False, export_apply=True)
print('WROTE', out, os.path.getsize(out) // 1024, 'KB')
