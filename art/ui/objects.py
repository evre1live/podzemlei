# «интерфейс из предметов»: кованые таблички кнопок, дубовая балка шапки, валик свитка — для border-image (Blender 5)
#   python objects.py --o <папка> [--s сэмплы] [--parch пергамент.png] [--n plates,beam,roller]
# Таблички: 360×120, срез 36 px (заклёпки в углах); балка: 2400×160, срез 180 px с торцов; валик: 1200×110, срез 120 px.
import bpy, bmesh, math, sys, os
from mathutils import Euler
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'table'))
from mats import mat, oak

arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
OUT = arg('--o'); S = int(arg('--s', '64')); PARCH = arg('--parch'); ONLY = (arg('--n') or 'plates,beam,roller').split(',')


def reset(w, h, ortho, area=30, key=(40, 0, -35), keyE=3.0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = S; sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    sc.render.resolution_x, sc.render.resolution_y = w, h
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = ortho
    co = bpy.data.objects.new('cam', cam); co.location = (0, 0, 20); sc.collection.objects.link(co); sc.camera = co
    wd = bpy.data.worlds.new('w'); sc.world = wd
    wd.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.035, 0.025, 1)
    # свет: ровный сверху (стороны растягиваются — перепада вдоль них быть не должно) и ключевой слева сверху для рельефа
    ld = bpy.data.lights.new('top', 'AREA'); ld.energy = 520 * min(1, area / 16); ld.color = (1.0, 0.9, 0.78); ld.size = area
    o = bpy.data.objects.new('top', ld); o.location = (0, 0, 14); sc.collection.objects.link(o)
    sun = bpy.data.lights.new('key', 'SUN'); sun.energy = keyE; sun.color = (1.0, 0.87, 0.7); sun.angle = math.radians(6)
    so = bpy.data.objects.new('key', sun); so.rotation_euler = [math.radians(a) for a in key]; sc.collection.objects.link(so)
    return sc


def render(sc, name):
    sc.render.filepath = os.path.join(OUT, name + '.png')
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    bpy.ops.render.render(write_still=True); print('obj', name)


def metal(lo, hi, metallic=1.0, rough=(0.3, 0.55), hammer=0.3, vscale=5.5):
    """металл с кованой фактурой: вмятины от молотка (вороной) и пятна (шум)"""
    def b(nt, out):
        N, Lk = nt.nodes, nt.links
        bs = N.new('ShaderNodeBsdfPrincipled'); Lk.new(bs.outputs[0], out.inputs[0])
        tc = N.new('ShaderNodeTexCoord')
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 9; nz.inputs['Detail'].default_value = 8
        Lk.new(tc.outputs['Object'], nz.inputs['Vector'])
        cr = N.new('ShaderNodeValToRGB'); e = cr.color_ramp.elements
        e[0].position = 0.3; e[0].color = (*lo, 1); e[1].position = 0.75; e[1].color = (*hi, 1)
        Lk.new(nz.outputs['Fac'], cr.inputs['Fac']); Lk.new(cr.outputs['Color'], bs.inputs['Base Color'])
        bs.inputs['Metallic'].default_value = metallic
        rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = rough[0]; rr.inputs['To Max'].default_value = rough[1]
        Lk.new(nz.outputs['Fac'], rr.inputs['Value']); Lk.new(rr.outputs['Result'], bs.inputs['Roughness'])
        vo = N.new('ShaderNodeTexVoronoi'); vo.feature = 'SMOOTH_F1'; vo.inputs['Scale'].default_value = vscale
        vo.inputs['Randomness'].default_value = 0.9
        Lk.new(tc.outputs['Object'], vo.inputs['Vector'])
        mx = N.new('ShaderNodeMath'); mx.operation = 'MULTIPLY_ADD'; mx.inputs[1].default_value = 0.15
        Lk.new(nz.outputs['Fac'], mx.inputs[0]); Lk.new(vo.outputs['Distance'], mx.inputs[2])
        bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = hammer; bp.inputs['Distance'].default_value = 0.03
        Lk.new(mx.outputs[0], bp.inputs['Height']); Lk.new(bp.outputs['Normal'], bs.inputs['Normal'])
    return b


def rrect(w, h, r, seg=10):
    pts = []
    for cx, cy, a0 in [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg); pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def slab(sc, pts, t, m, bevel=0.05, seg=4, z0=0.0):
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new((x, y, z0)) for x, y in pts])
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]: v.co.z += t
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('slab'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('slab', me); sc.collection.objects.link(ob); me.materials.append(m)
    bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = bevel; bv.segments = seg; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(40)
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return ob


def rivet(sc, x, y, z, r, m):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, y, z), segments=32, ring_count=16)
    o = bpy.context.active_object; o.scale.z = 0.5; o.data.materials.append(m); bpy.ops.object.shade_smooth()
    return o


# ───────── таблички кнопок ─────────
PLATES = {
    # имя: (низ, верх цвета, металл, шероховатость, заклёпки)
    'iron':   ((0.065, 0.06, 0.055), (0.13, 0.118, 0.102), 1.0, (0.34, 0.52), 'steel'),
    'brass':  ((0.5, 0.3, 0.09), (0.86, 0.6, 0.24), 1.0, (0.22, 0.42), 'brass'),
    'danger': ((0.13, 0.016, 0.01), (0.3, 0.045, 0.025), 0.35, (0.3, 0.45), 'steel'),
    'hero':   ((0.06, 0.2, 0.15), (0.2, 0.42, 0.33), 0.6, (0.35, 0.6), 'brass'),
}
if 'plates' in ONLY:
    for name, (lo, hi, met, rough, rv) in PLATES.items():
        sc = reset(360, 120, 3.6)
        m = mat(name, metal(lo, hi, met, rough))
        mr = mat('rv', metal((0.4, 0.38, 0.35), (0.62, 0.6, 0.56), 1.0, (0.2, 0.35), 0.05)) if rv == 'steel' else mat('rv', metal((0.55, 0.36, 0.12), (0.95, 0.7, 0.32), 1.0, (0.18, 0.3), 0.05))
        slab(sc, rrect(3.52, 1.12, 0.16), 0.1, m, bevel=0.06, seg=5)
        for sx in (-1, 1):
            for sy in (-1, 1): rivet(sc, sx * (1.8 - 0.18), sy * (0.6 - 0.18), 0.1, 0.085, mr)
        render(sc, 'plate-' + name)

# ───────── балка шапки: дуб, по торцам кованые хомуты ─────────
if 'beam' in ONLY:
    sc = reset(2400, 160, 24.0)
    M_OAK = mat('oak', oak)
    M_IRON = mat('iron', metal((0.03, 0.028, 0.026), (0.1, 0.09, 0.08), 1.0, (0.35, 0.6), 0.25))
    M_STEEL = mat('steel', metal((0.4, 0.38, 0.35), (0.62, 0.6, 0.56), 1.0, (0.2, 0.35), 0.05))
    b = slab(sc, rrect(23.8, 1.42, 0.12, 6), 0.5, M_OAK, bevel=0.16, seg=5, z0=-0.5)
    uv = b.data.uv_layers.new()
    for lp in b.data.loops:
        co = b.data.vertices[lp.vertex_index].co; uv.data[lp.index].uv = (co.x * 0.18, (co.y + co.z) * 0.18)
    for sx in (-1, 1):
        x = sx * (11.9 - 0.95)
        s = slab(sc, rrect(0.5, 1.56, 0.08, 4), 0.62, M_IRON, bevel=0.07, seg=4, z0=-0.56); s.location.x = x
        for y in (-0.42, 0.42): rivet(sc, x, y, 0.06, 0.1, M_STEEL)
    render(sc, 'beam')

# ───────── валик свитка: свёрнутый пергамент на деревянной оси, латунные навершия ─────────
def lathe(sc, prof, m, steps=64, smooth=True):
    """prof — [(x, r)]: тело вращения вокруг оси X"""
    bm = bmesh.new(); rings = []
    for x, r in prof:
        rings.append([bm.verts.new((x, r * math.cos(2 * math.pi * i / steps), r * math.sin(2 * math.pi * i / steps))) for i in range(steps)])
    for a, c in zip(rings, rings[1:]):
        for i in range(steps):
            j = (i + 1) % steps; bm.faces.new((a[i], a[j], c[j], c[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('lathe'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('lathe', me); sc.collection.objects.link(ob); me.materials.append(m)
    me.polygons.foreach_set('use_smooth', [smooth] * len(me.polygons))
    return ob


if 'roller' in ONLY:
    sc = reset(1200, 110, 12.0, area=5, key=(-55, 0, -12), keyE=4.2)  # свет сверху по кадру — свёрток круглый
    M_WOOD = mat('oak', oak)
    M_BRASS = mat('brass', metal((0.5, 0.3, 0.09), (0.86, 0.6, 0.24), 1.0, (0.2, 0.36), 0.08))

    def paper(nt, out):
        N, Lk = nt.nodes, nt.links
        bs = N.new('ShaderNodeBsdfPrincipled'); Lk.new(bs.outputs[0], out.inputs[0]); bs.inputs['Roughness'].default_value = 0.85
        if PARCH:
            tx = N.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(PARCH)
            Lk.new(tx.outputs['Color'], bs.inputs['Base Color'])
        else: bs.inputs['Base Color'].default_value = (0.7, 0.55, 0.36, 1)
    M_PAPER = mat('paper', paper)
    # свёрток: чуть неровный край, видны витки на торцах
    roll = lathe(sc, [(-5.1, 0.0), (-5.1, 0.36), (-5.06, 0.4), (5.06, 0.4), (5.1, 0.36), (5.1, 0.0)], M_PAPER, 96)
    uv = roll.data.uv_layers.new()
    for lp in roll.data.loops:
        co = roll.data.vertices[lp.vertex_index].co; uv.data[lp.index].uv = (co.x * 0.11 + 0.5, math.atan2(co.z, co.y) / (2 * math.pi) * 0.35)
    lathe(sc, [(-5.75, 0.0), (-5.75, 0.15), (5.75, 0.15), (5.75, 0.0)], M_WOOD, 48)
    for sx in (-1, 1):
        prof = [(5.1, 0.0), (5.1, 0.27), (5.16, 0.3), (5.24, 0.3), (5.3, 0.22), (5.38, 0.2), (5.46, 0.27), (5.58, 0.33), (5.7, 0.3),
                (5.8, 0.2), (5.86, 0.14), (5.92, 0.16), (5.97, 0.12), (5.99, 0.05), (6.0, 0.0)]
        lathe(sc, [(sx * x, r) for x, r in (prof if sx > 0 else reversed(prof))], M_BRASS, 64)
    render(sc, 'roller')
