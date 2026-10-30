# рамка стола для 9-slice: дубовые брусья, кованые уголки с заклёпками, латунная кромка
import bpy, bmesh, math, sys, os
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--o') + 1]
S = int(sys.argv[sys.argv.index('--s') + 1]) if '--s' in sys.argv else 64
RES = 1024
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = S; sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.render.resolution_x = sc.render.resolution_y = RES

# размеры в условных единицах: поле 10×10, рамка шириной B (в пикселях — B/10*RES)
L = 10.0; B = 1.15  # → 118 px
H = 0.35            # высота бруса

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mats import mat, oak, iron, brass

M_OAK, M_IRON, M_BRASS = mat('oak', oak), mat('iron', iron), mat('brass', brass)

def add(ob, m):
    sc.collection.objects.link(ob); ob.data.materials.append(m); return ob

def beam(name, length, rot):
    # брус: верх скруглён к внутреннему краю (к полю), торцы срезаны под 45° (ус)
    bm = bmesh.new()
    prof = [(0, 0), (B, 0), (B, H * 0.55), (B - 0.1, H * 0.6), (B - 0.16, H * 0.82), (B - 0.24, H * 0.9), (0.42, H), (0.24, H * 0.98), (0.12, H * 0.9), (0.04, H * 0.74), (0, H * 0.5)]
    # профиль в плоскости (y — поперёк, z — высота); x — вдоль. Ус: на расстоянии y от внешнего края торец сдвинут на y
    half = length / 2
    vs = []
    for end in (-1, 1):
        ring = []
        for (y, z) in prof:
            x = end * (half - y)  # внешний край (y=0) — полная длина, внутренний — короче (ус 45°)
            ring.append(bm.verts.new((x, -half + y, z)))
        vs.append(ring)
    n = len(prof)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vs[0][i], vs[0][j], vs[1][j], vs[1][i]))
    bm.faces.new(list(reversed(vs[0]))); bm.faces.new(vs[1])
    bm.normal_update()
    # UV: u — вдоль бруса
    uv = bm.loops.layers.uv.new()
    for f in bm.faces:
        for lp in f.loops:
            co = lp.vert.co; lp[uv].uv = (co.x * 0.18, (co.y + co.z) * 0.18)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); ob.rotation_euler = (0, 0, rot)
    bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = 0.02; bv.segments = 2; bv.limit_method = 'ANGLE'
    return add(ob, M_OAK)

for k in range(4):
    b = beam(f'beam{k}', L, k * math.pi / 2)
    b.data.polygons.foreach_set('use_smooth', [True] * len(b.data.polygons))

# латунная кромка по внутреннему краю
inner = L / 2 - B + 0.13
for k in range(4):
    bpy.ops.mesh.primitive_cube_add(size=1)
    ob = bpy.context.active_object; sc.collection.objects.unlink(ob) if False else None
    ob.scale = (L - 2 * B + 0.3, 0.09, 0.06)
    ob.location = (0, -inner, H * 0.6)
    ob.rotation_euler = (0, 0, 0)
    # поворот вокруг центра
    ob.location.rotate(__import__('mathutils').Euler((0, 0, k * math.pi / 2)))
    ob.rotation_euler = (0, 0, k * math.pi / 2)
    ob.data.materials.append(M_BRASS)

# кованые уголки: L-образная пластина с заклёпками, слегка выпуклая
def corner(k):
    import mathutils
    w, t = 1.1, 0.62
    bm = bmesh.new()
    pts = [(0, 0), (w, 0), (w, t * 0.55), (t, t), (t * 0.55, w), (0, w)]
    # закруглённые концы «лап»
    vs = [bm.verts.new((x, y, H + 0.005)) for x, y in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]: v.co.z += 0.07
    me = bpy.data.meshes.new('corner'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('corner', me)
    bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = 0.035; bv.segments = 3
    ob.location = (-L / 2 + 0.02, -L / 2 + 0.02, 0)
    ob.location.rotate(mathutils.Euler((0, 0, k * math.pi / 2)))
    ob.rotation_euler = (0, 0, k * math.pi / 2)
    add(ob, M_IRON)
    for (x, y) in [(0.22, 0.22), (0.92, 0.2), (0.2, 0.92), (0.52, 0.52)]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, location=(x - L / 2 + 0.02, y - L / 2 + 0.02, H + 0.075), segments=24, ring_count=12)
        rv = bpy.context.active_object; rv.scale.z = 0.55
        rv.location.rotate(mathutils.Euler((0, 0, k * math.pi / 2)))
        rv.data.materials.append(M_IRON)
        bpy.ops.object.shade_smooth()
for k in range(4): corner(k)

# свет: мягкий сверху (без перепада вдоль сторон — их растягивают), резкость рельефа — от ключевого слева сверху
def area(name, loc, rot, energy, color, size):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.color = color; ld.size = size
    o = bpy.data.objects.new(name, ld); o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    sc.collection.objects.link(o)
area('top', (0, 0, 14), (0, 0, 0), 500, (1.0, 0.88, 0.74), 16)
sun = bpy.data.lights.new('key', 'SUN'); sun.energy = 3.4; sun.color = (1.0, 0.86, 0.68); sun.angle = math.radians(8)
so = bpy.data.objects.new('key', sun); so.rotation_euler = (math.radians(42), 0, math.radians(-40)); sc.collection.objects.link(so)
wd = bpy.data.worlds.new('w'); sc.world = wd
wd.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.035, 0.025, 1)

cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = L + 0.0
co = bpy.data.objects.new('cam', cam); co.location = (0, 0, 20); sc.collection.objects.link(co); sc.camera = co
sc.render.filepath = OUT; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
bpy.ops.render.render(write_still=True)
print('frame', OUT, 'border px', round(B / L * RES))
