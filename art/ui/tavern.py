# лобби-таверна: овальный дубовый стол из досок и стул со спинкой — вид сверху, с мягкой тенью на полу (Blender 5)
#   python tavern.py --o <папка> [--s сэмплы] [--n table,chair]
# Стол: 1700×1140, овал 14,4×9 единиц (100 px на единицу). Стул: 400×400, сиденье в центре, спинка — внизу кадра,
# смотрит вверх (к столу, если стул стоит под ним); на странице стулья поворачивают вокруг стола.
import bpy, bmesh, math, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'table'))
from mats import mat, oak

arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
OUT = arg('--o'); S = int(arg('--s', '48')); ONLY = (arg('--n') or 'table,chair').split(',')


def reset(w, h, ortho, sun=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = S; sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    sc.render.resolution_x, sc.render.resolution_y = w, h
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = ortho
    co = bpy.data.objects.new('cam', cam); co.location = (0, 0, 30); sc.collection.objects.link(co); sc.camera = co
    wd = bpy.data.worlds.new('w'); sc.world = wd
    wd.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.035, 0.025, 1)
    bpy.ops.mesh.primitive_plane_add(size=80); bpy.context.active_object.is_shadow_catcher = True
    # свет почти отвесный: тень мягким пятном вокруг, без сильного сдвига — стулья потом поворачивают
    ld = bpy.data.lights.new('top', 'AREA'); ld.energy = 1100; ld.color = (1.0, 0.86, 0.68); ld.size = 5
    o = bpy.data.objects.new('top', ld); o.location = (0, 0, 16); sc.collection.objects.link(o)
    if sun:
        s = bpy.data.lights.new('key', 'SUN'); s.energy = sun[1]; s.color = (1.0, 0.85, 0.66); s.angle = math.radians(18)
        so = bpy.data.objects.new('key', s); so.rotation_euler = [math.radians(a) for a in sun[0]]; sc.collection.objects.link(so)
    return sc


def matte(m):
    """дуб рамы — с лаком; столешнице таверны лак ни к чему: убираем блик от лампы"""
    bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); bs.inputs['Coat Weight'].default_value = 0.0; bs.inputs['Roughness'].default_value = 0.68
    return m


def render(sc, name):
    sc.render.filepath = os.path.join(OUT, name + '.png')
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    bpy.ops.render.render(write_still=True); print('obj', name)


def prism(sc, pts, z0, t, m, bevel=0.05, seg=3, uvk=0.18, uvo=(0, 0)):
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new((x, y, z0)) for x, y in pts])
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]: v.co.z += t
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('p'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('p', me); sc.collection.objects.link(ob); me.materials.append(m)
    uv = me.uv_layers.new()
    for lp in me.loops:
        co = me.vertices[lp.vertex_index].co; uv.data[lp.index].uv = (co.x * uvk + uvo[0], (co.y + co.z) * uvk + uvo[1])
    if bevel:
        bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = bevel; bv.segments = seg; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(35)
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return ob


def iron_mat():
    m = bpy.data.materials.new('iron'); m.use_nodes = True; bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (0.05, 0.045, 0.04, 1); bs.inputs['Metallic'].default_value = 1; bs.inputs['Roughness'].default_value = 0.45
    return m


def cyl(sc, r, z0, z1, x, y, m):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=z1 - z0, location=(x, y, (z0 + z1) / 2), vertices=24)
    o = bpy.context.active_object; o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o


if 'table' in ONLY:
    sc = reset(1700, 1140, 17.0, sun=((14, 0, -40), 1.0))
    M = matte(mat('oak', oak)); IRON = iron_mat()
    A, B, N, GAP, Z, T = 7.2, 4.5, 6, 0.04, 2.0, 0.34
    for k in range(N):
        y0, y1 = -B + 2 * B * k / N + GAP / 2, -B + 2 * B * (k + 1) / N - GAP / 2
        ys = [y0 + (y1 - y0) * i / 28 for i in range(29)]
        xe = lambda y: A * math.sqrt(max(0.0, 1 - (y / B) ** 2))
        pts = [(xe(y), y) for y in ys] + [(-xe(y), y) for y in reversed(ys)]
        prism(sc, pts, Z - T, T, M, bevel=0.07, seg=4, uvo=((k * 0.37) % 1 * 3, k * 1.71))   # у каждой доски свой рисунок волокон
        yc = (y0 + y1) / 2; xc = xe(yc) - 0.45
        for sx in (-1, 1):                                        # гвозди на концах досок
            for dy in (-0.32, 0.32):
                if xc > 0.6 and abs(yc + dy) < B - 0.25:
                    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, location=(sx * (xe(yc + dy) - 0.42), yc + dy, Z), segments=16, ring_count=8)
                    o = bpy.context.active_object; o.scale.z = 0.4; o.data.materials.append(IRON)
    render(sc, 'tavern-table')

if 'chair' in ONLY:
    sc = reset(400, 400, 4.0)
    M = matte(mat('oak', oak))
    SZ = 1.0
    seat = [(x, y) for x, y in [(-0.82, -0.7), (0.82, -0.7), (0.86, 0.62), (0.7, 0.78), (-0.7, 0.78), (-0.86, 0.62)]]
    prism(sc, seat, SZ - 0.1, 0.1, M, bevel=0.05, seg=3, uvk=0.5)
    for x, y in [(-0.7, 0.6), (0.7, 0.6)]: cyl(sc, 0.07, 0, SZ - 0.1, x, y, M)
    for x in (-0.74, 0.74): cyl(sc, 0.085, 0, 2.0, x, -0.66, M)          # задние ножки — стойки спинки
    for x in (-0.37, 0, 0.37): cyl(sc, 0.045, SZ, 1.95, x, -0.7, M)       # балясины
    # верхняя перекладина спинки — дугой, выше сиденья
    arc = []
    for i in range(25):
        t = -1 + 2 * i / 24; x = t * 0.92; y = -0.62 - 0.16 * (1 - t * t)
        arc.append((x, y))
    inner = [(x, y + 0.3) for x, y in arc]
    prism(sc, arc + list(reversed(inner)), 1.92, 0.16, M, bevel=0.07, seg=3, uvk=0.5)
    render(sc, 'chair')
