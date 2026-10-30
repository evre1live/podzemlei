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

def mat(name, build):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; [nt.nodes.remove(n) for n in list(nt.nodes)]
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    build(nt, out)
    return m

def oak(nt, out):
    N, Lk = nt.nodes, nt.links
    bs = N.new('ShaderNodeBsdfPrincipled'); Lk.new(bs.outputs[0], out.inputs[0])
    tc = N.new('ShaderNodeTexCoord')
    # волокна вдоль бруса: в материале используем координаты UV (u — вдоль бруса)
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, 14.0, 1.0)
    Lk.new(tc.outputs['UV'], mp.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 8; nz.inputs['Distortion'].default_value = 1.2
    Lk.new(mp.outputs['Vector'], nz.inputs['Vector'])
    wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Y'; wv.inputs['Scale'].default_value = 0.9
    wv.inputs['Distortion'].default_value = 7; wv.inputs['Detail'].default_value = 4
    Lk.new(mp.outputs['Vector'], wv.inputs['Vector'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'FLOAT'; mix.inputs[0].default_value = 0.45
    Lk.new(wv.outputs['Fac'], mix.inputs[2]); Lk.new(nz.outputs['Fac'], mix.inputs[3])
    cr = N.new('ShaderNodeValToRGB'); e = cr.color_ramp.elements
    e[0].position = 0.3; e[0].color = (0.035, 0.013, 0.005, 1); e[1].position = 0.85; e[1].color = (0.15, 0.062, 0.022, 1)
    Lk.new(mix.outputs[0], cr.inputs['Fac'])
    # потёртости на рёбрах: светлее
    gm = N.new('ShaderNodeNewGeometry')
    ed = N.new('ShaderNodeValToRGB'); ed.color_ramp.elements[0].position = 0.53; ed.color_ramp.elements[0].color = (0, 0, 0, 1); ed.color_ramp.elements[1].position = 0.62; ed.color_ramp.elements[1].color = (1, 1, 1, 1)
    Lk.new(gm.outputs['Pointiness'], ed.inputs['Fac'])
    wear = N.new('ShaderNodeMix'); wear.data_type = 'RGBA'; wear.blend_type = 'SCREEN'
    Lk.new(ed.outputs['Color'], wear.inputs[0]); Lk.new(cr.outputs['Color'], wear.inputs[6]); wear.inputs[7].default_value = (0.2, 0.1, 0.04, 1)
    Lk.new(wear.outputs[2], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 0.5
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.35; bp.inputs['Distance'].default_value = 0.02
    Lk.new(mix.outputs[0], bp.inputs['Height']); Lk.new(bp.outputs['Normal'], bs.inputs['Normal'])
    # лак: лёгкий глянец
    bs.inputs['Coat Weight'].default_value = 0.25; bs.inputs['Coat Roughness'].default_value = 0.25

def iron(nt, out):
    N, Lk = nt.nodes, nt.links
    bs = N.new('ShaderNodeBsdfPrincipled'); Lk.new(bs.outputs[0], out.inputs[0])
    tc = N.new('ShaderNodeTexCoord')
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 18; nz.inputs['Detail'].default_value = 8
    Lk.new(tc.outputs['Object'], nz.inputs['Vector'])
    cr = N.new('ShaderNodeValToRGB'); e = cr.color_ramp.elements
    e[0].position = 0.35; e[0].color = (0.02, 0.019, 0.018, 1); e[1].position = 0.75; e[1].color = (0.075, 0.068, 0.06, 1)
    Lk.new(nz.outputs['Fac'], cr.inputs['Fac']); Lk.new(cr.outputs['Color'], bs.inputs['Base Color'])
    bs.inputs['Metallic'].default_value = 1.0
    rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = 0.3; rr.inputs['To Max'].default_value = 0.65
    Lk.new(nz.outputs['Fac'], rr.inputs['Value']); Lk.new(rr.outputs['Result'], bs.inputs['Roughness'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.3; bp.inputs['Distance'].default_value = 0.01
    Lk.new(nz.outputs['Fac'], bp.inputs['Height']); Lk.new(bp.outputs['Normal'], bs.inputs['Normal'])

def brass(nt, out):
    N, Lk = nt.nodes, nt.links
    bs = N.new('ShaderNodeBsdfPrincipled'); Lk.new(bs.outputs[0], out.inputs[0])
    bs.inputs['Base Color'].default_value = (0.78, 0.52, 0.2, 1); bs.inputs['Metallic'].default_value = 1; bs.inputs['Roughness'].default_value = 0.28

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
