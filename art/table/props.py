# Предметы на столе: свечи, монеты, кости, зелье, книга, кинжал, кубок, свиток и предметы локаций.
# Каждый — отдельный спрайт с прозрачным фоном и тенью (shadow catcher), камера чуть наклонена.
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Euler
OUTDIR = sys.argv[sys.argv.index('--o') + 1]
S = int(sys.argv[sys.argv.index('--s') + 1]) if '--s' in sys.argv else 48
NAMES = sys.argv[sys.argv.index('--n') + 1].split(',') if '--n' in sys.argv else None
RES = int(sys.argv[sys.argv.index('--r') + 1]) if '--r' in sys.argv else 512

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = S; sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    sc.render.resolution_x = sc.render.resolution_y = RES
    sc.cycles.transparent_max_bounces = 16; sc.cycles.max_bounces = 8
    return sc

def principled(name, color, metal=0.0, rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True; bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*color, 1); bs.inputs['Metallic'].default_value = metal; bs.inputs['Roughness'].default_value = rough
    for k, v in kw.items(): bs.inputs[k].default_value = v
    return m

def noisy(m, scale=30, strength=0.25, ramp=None):
    """шум в шероховатость и рельеф; ramp=(тёмный, светлый) — пятна в цвете"""
    nt = m.node_tree; N, L = nt.nodes, nt.links; bs = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord'); nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 8
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; bp.inputs['Distance'].default_value = 0.01
    L.new(nz.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], bs.inputs['Normal'])
    if ramp:
        cr = N.new('ShaderNodeValToRGB'); e = cr.color_ramp.elements
        e[0].position = 0.35; e[0].color = (*ramp[0], 1); e[1].position = 0.7; e[1].color = (*ramp[1], 1)
        L.new(nz.outputs['Fac'], cr.inputs['Fac']); L.new(cr.outputs['Color'], bs.inputs['Base Color'])
    return m

GOLD = lambda: noisy(principled('gold', (0.95, 0.66, 0.28), 1, 0.3), 60, 0.15)
def COIN():
    m = principled('coin', (0.9, 0.62, 0.26), 1, 0.32); nt = m.node_tree; N, L = nt.nodes, nt.links; bs = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    # кольца от центра монеты: кант и надпись по кругу; в центре — профиль (шум)
    gr = N.new('ShaderNodeTexGradient'); gr.gradient_type = 'SPHERICAL'
    sc = N.new('ShaderNodeVectorMath'); sc.operation = 'SCALE'; sc.inputs['Scale'].default_value = 2.7
    L.new(tc.outputs['Object'], sc.inputs[0]); L.new(sc.outputs[0], gr.inputs['Vector'])
    rr = N.new('ShaderNodeValToRGB'); e = rr.color_ramp.elements
    e[0].position = 0.06; e[0].color = (1, 1, 1, 1); e[1].position = 0.1; e[1].color = (0, 0, 0, 1)
    e2 = rr.color_ramp.elements.new(0.22); e2.color = (0, 0, 0, 1); e3 = rr.color_ramp.elements.new(0.25); e3.color = (0.6, 0.6, 0.6, 1)
    L.new(gr.outputs['Fac'], rr.inputs['Fac'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 14; nz.inputs['Detail'].default_value = 6
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    mx = N.new('ShaderNodeMath'); mx.operation = 'ADD'; L.new(rr.outputs['Color'], mx.inputs[0])
    mm = N.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; mm.inputs[1].default_value = 0.5; L.new(nz.outputs['Fac'], mm.inputs[0]); L.new(mm.outputs[0], mx.inputs[1])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.5; bp.inputs['Distance'].default_value = 0.02
    L.new(mx.outputs[0], bp.inputs['Height']); L.new(bp.outputs['Normal'], bs.inputs['Normal'])
    # потемнение в углублениях
    dk = N.new('ShaderNodeMix'); dk.data_type = 'RGBA'; dk.blend_type = 'MULTIPLY'; dk.inputs[6].default_value = (0.9, 0.62, 0.26, 1); dk.inputs[7].default_value = (0.45, 0.3, 0.12, 1)
    inv = N.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1; L.new(mx.outputs[0], inv.inputs[1])
    L.new(inv.outputs[0], dk.inputs[0]); L.new(dk.outputs[2], bs.inputs['Base Color'])
    return m
IRON = lambda: noisy(principled('iron', (0.06, 0.055, 0.05), 1, 0.5), 40, 0.3, ((0.03, 0.028, 0.026), (0.11, 0.1, 0.09)))
WAX = lambda: noisy(principled('wax', (0.78, 0.7, 0.5), 0, 0.38, **{'Subsurface Weight': 0.35, 'Subsurface Scale': 0.02, 'Subsurface Radius': (1.0, 0.8, 0.5)}), 25, 0.08)
BONE = lambda: noisy(principled('bone', (0.82, 0.75, 0.6), 0, 0.45, **{'Subsurface Weight': 0.2, 'Subsurface Scale': 0.02}), 20, 0.1, ((0.62, 0.55, 0.42), (0.86, 0.8, 0.66)))
LEATHER = lambda c: noisy(principled('leather', c, 0, 0.6), 80, 0.3)
WOOD = lambda: noisy(principled('wood', (0.18, 0.1, 0.05), 0, 0.55), 12, 0.3, ((0.08, 0.04, 0.02), (0.22, 0.12, 0.06)))
GLASS = lambda c=(0.9, 0.95, 0.9): principled('glass', c, 0, 0.04, **{'Transmission Weight': 1.0, 'IOR': 1.45})
def EMIT(c, s): m = principled('emit', c, 0, 0.5); bs = m.node_tree.nodes['Principled BSDF']; bs.inputs['Emission Color'].default_value = (*c, 1); bs.inputs['Emission Strength'].default_value = s; return m

def put(ob, m, smooth=True):
    if m: ob.data.materials.clear(); ob.data.materials.append(m)
    if smooth:
        for p in ob.data.polygons: p.use_smooth = True
    return ob
def cyl(r, h, loc=(0, 0, 0), m=None, verts=48, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=(loc[0], loc[1], loc[2] + h / 2), rotation=rot)
    ob = bpy.context.active_object
    if bevel: b = ob.modifiers.new('b', 'BEVEL'); b.width = bevel; b.segments = 3; b.limit_method = 'ANGLE'
    return put(ob, m)
def sph(r, loc, m=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=32, ring_count=16); ob = bpy.context.active_object; ob.scale = scale; return put(ob, m)
def box(size, loc, m=None, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); ob = bpy.context.active_object; ob.scale = size
    if bevel: b = ob.modifiers.new('b', 'BEVEL'); b.width = bevel; b.segments = 3
    return put(ob, m, smooth=False)
def lathe(profile, m, loc=(0, 0, 0), steps=64):
    """тело вращения: profile — [(r, z), ...] снизу вверх"""
    bm = bmesh.new(); rings = []
    for i in range(steps):
        a = i * 2 * math.pi / steps
        rings.append([bm.verts.new((r * math.cos(a) + loc[0], r * math.sin(a) + loc[1], z + loc[2])) for r, z in profile])
    for i in range(steps):
        j = (i + 1) % steps
        for k in range(len(profile) - 1):
            bm.faces.new((rings[i][k], rings[j][k], rings[j][k + 1], rings[i][k + 1]))
    me = bpy.data.meshes.new('lathe'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('lathe', me); bpy.context.scene.collection.objects.link(ob)
    sub = ob.modifiers.new('s', 'SUBSURF'); sub.levels = 1; sub.render_levels = 2
    return put(ob, m)

def stage(name, ortho=4.0, tilt=28, target=(0, 0, 0.3), marks=()):
    sc = bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=40); pl = bpy.context.active_object; pl.is_shadow_catcher = True
    # свет: тёплый ключ слева сверху (как на столе), заполняющий, отражения
    def area(nm, loc, energy, color, size):
        ld = bpy.data.lights.new(nm, 'AREA'); ld.energy = energy; ld.color = color; ld.size = size
        o = bpy.data.objects.new(nm, ld); o.location = loc; sc.collection.objects.link(o)
        d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    area('key', (-5, 4, 7), 900, (1.0, 0.86, 0.68), 3.0)
    area('fill', (6, -2, 4), 160, (0.7, 0.8, 1.0), 6.0)
    area('rim', (2, 6, 3), 260, (1.0, 0.7, 0.4), 3.0)
    wd = bpy.data.worlds.new('w'); sc.world = wd; wd.node_tree.nodes['Background'].inputs['Color'].default_value = (0.06, 0.045, 0.035, 1)
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = ortho
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    t = math.radians(tilt); dist = 20
    co.location = (target[0], target[1] - dist * math.sin(t), target[2] + dist * math.cos(t))
    co.rotation_euler = (t, 0, 0)
    sc.render.filepath = os.path.join(OUTDIR, name + '.png'); sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    if marks:
        from bpy_extras.object_utils import world_to_camera_view
        bpy.context.view_layer.update()
        pts = [world_to_camera_view(sc, co, Vector(p)) for p in marks]
        print('MARKS', name, [[round(p.x, 4), round(1 - p.y, 4)] for p in pts])
    bpy.ops.render.render(write_still=True); print('prop', name)

# ───────── предметы ─────────
def candles():
    reset(); iron = IRON(); wax = WAX()
    lathe([(0.0, 0), (0.7, 0.0), (0.78, 0.05), (0.74, 0.09), (0.25, 0.1), (0.0, 0.1)], iron)  # блюдо
    wicks = []
    for (x, y, h, r) in [(-0.3, 0.15, 1.5, 0.2), (0.28, 0.22, 1.05, 0.18), (0.02, -0.32, 0.7, 0.2)]:
        wicks.append((x, y, 0.1 + h + 0.1))
        c = cyl(r, h, (x, y, 0.1), wax, bevel=0.03)
        # наплывы воска
        for k in range(4):
            a = random.uniform(0, 6.28); ln = random.uniform(0.15, 0.45); z = 0.1 + h - ln / 2 - 0.02
            sph(r * 0.2, (x + r * math.cos(a) * 0.97, y + r * math.sin(a) * 0.97, z), wax, (1, 1, ln / (r * 0.4)))
        lathe([(0.0, 0.1 + h - 0.06), (r * 0.98, 0.1 + h - 0.02), (r * 0.7, 0.1 + h + 0.015), (0.0, 0.1 + h - 0.04)], wax)  # чашечка у фитиля
        sph(r * 1.1, (x, y, 0.13), wax, (1, 1, 0.25))
        cyl(0.018, 0.12, (x, y, 0.1 + h), principled('wick', (0.02, 0.02, 0.02), 0, 0.8))
    stage('candles', ortho=2.6, target=(0, 0, 0.7), marks=wicks)

def coins():
    reset(); gold = COIN()
    rnd = random.Random(3)
    for i in range(9):  # стопка
        cyl(0.36, 0.07, (rnd.uniform(-0.03, 0.03), rnd.uniform(-0.03, 0.03), i * 0.072), gold, verts=48, bevel=0.012)
    for i in range(6):  # рассыпанные
        a = rnd.uniform(0, 6.28); d = rnd.uniform(0.6, 1.2)
        cyl(0.36, 0.07, (math.cos(a) * d, math.sin(a) * d, 0), gold, verts=48, bevel=0.012, rot=(rnd.uniform(-0.08, 0.08), rnd.uniform(-0.08, 0.08), 0))
    stage('coins', ortho=3.0, target=(0, 0, 0.3))

def dice():
    reset(); bone = BONE(); pip = principled('pip', (0.02, 0.015, 0.01), 0, 0.6)
    def die(loc, rot, faces):
        b = box((0.6, 0.6, 0.6), (loc[0], loc[1], 0.3), bone, rot=(0, 0, rot), bevel=0.09)
        b.modifiers.new('ws', 'WEIGHTED_NORMAL')
        # верхняя грань и две боковые: точки
        top = {1: [(0, 0)], 2: [(-.14, -.14), (.14, .14)], 3: [(-.15, -.15), (0, 0), (.15, .15)], 4: [(-.14, -.14), (.14, .14), (-.14, .14), (.14, -.14)],
               5: [(-.15, -.15), (.15, .15), (-.15, .15), (.15, -.15), (0, 0)], 6: [(-.15, -.15), (.15, .15), (-.15, .15), (.15, -.15), (-.15, 0), (.15, 0)]}
        R = Euler((0, 0, rot)).to_matrix()
        for (u, v) in top[faces[0]]:
            p = R @ Vector((u, v, 0)); sph(0.055, (loc[0] + p.x, loc[1] + p.y, 0.6), pip, (1, 1, 0.35))
        for (u, v) in top[faces[1]]:
            p = R @ Vector((u, -0.3, v)); sph(0.05, (loc[0] + p.x, loc[1] + p.y, 0.3 + p.z), pip, (1, 0.35, 1))
    die((-0.45, 0.1), 0.35, (5, 3)); die((0.42, -0.2), -0.25, (6, 2))
    stage('dice', ortho=2.4, target=(0, 0, 0.3))

def potion():
    reset(); glass = GLASS((0.75, 0.9, 0.8)); cork = noisy(principled('cork', (0.4, 0.27, 0.15), 0, 0.8), 80, 0.4)
    liquid = principled('liquid', (0.55, 0.02, 0.04), 0, 0.1, **{'Transmission Weight': 1.0, 'IOR': 1.33, 'Emission Color': (1.0, 0.1, 0.06, 1), 'Emission Strength': 0.15})
    prof = [(0.0, 0.0), (0.55, 0.0), (0.62, 0.08), (0.64, 0.5), (0.58, 0.8), (0.3, 1.05), (0.16, 1.2), (0.16, 1.45), (0.2, 1.5), (0.0, 1.5)]
    lathe(prof, glass)
    lathe([(0.0, 0.05), (0.55, 0.05), (0.59, 0.42), (0.0, 0.42)], liquid)
    cyl(0.15, 0.3, (0, 0, 1.38), cork)
    stage('potion', ortho=2.2, target=(0, 0, 0.7))

def book():
    reset(); lea = LEATHER((0.11, 0.025, 0.02)); pages = noisy(principled('pages', (0.82, 0.74, 0.58), 0, 0.8), 200, 0.2); gold = GOLD()
    box((1.6, 2.1, 0.07), (0, 0, 0.035), lea, bevel=0.03); box((1.6, 2.1, 0.07), (0, 0, 0.41), lea, bevel=0.03)
    box((1.52, 2.0, 0.3), (0.03, 0, 0.22), pages, bevel=0.01)
    box((0.1, 2.1, 0.44), (-0.8, 0, 0.22), lea, bevel=0.04)
    for (x, y) in [(0.66, 0.92), (0.66, -0.92)]:
        box((0.28, 0.28, 0.02), (x, y, 0.45), gold, bevel=0.02)
    cyl(0.22, 0.02, (0.05, 0, 0.445), gold, bevel=0.01)
    for (sx, sy, x, y) in [(1.3, 0.04, 0.05, 0.85), (1.3, 0.04, 0.05, -0.85), (0.04, 1.7, -0.6, 0), (0.04, 1.7, 0.7, 0)]:
        box((sx, sy, 0.012), (x, y, 0.452), gold)
    stage('book', ortho=3.0, target=(0, 0, 0.2))

def dagger():
    reset(); steel = noisy(principled('steel', (0.62, 0.62, 0.64), 1, 0.22), 50, 0.08); gold = GOLD(); lea = LEATHER((0.12, 0.06, 0.03))
    bm = bmesh.new()
    pts = [(-0.02, 0), (1.9, 0)]
    # клинок — ромб в сечении
    v = [bm.verts.new(p) for p in [(0, -0.13, 0.05), (0, 0.13, 0.05), (0, 0, 0.1), (0, 0, 0.0), (1.9, 0, 0.05)]]
    bm.faces.new((v[0], v[2], v[4])); bm.faces.new((v[2], v[1], v[4])); bm.faces.new((v[1], v[3], v[4])); bm.faces.new((v[3], v[0], v[4]))
    bm.faces.new((v[0], v[3], v[1], v[2]))
    me = bpy.data.meshes.new('blade'); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new('blade', me); bpy.context.scene.collection.objects.link(ob); put(ob, steel, smooth=False)
    box((0.1, 0.62, 0.1), (-0.05, 0, 0.05), gold, bevel=0.03)
    cyl(0.07, 0.6, (-0.4, 0, 0.05), lea, rot=(0, math.pi / 2, 0))
    sph(0.1, (-0.72, 0, 0.06), gold)
    for o in bpy.context.scene.objects:
        if o.type == 'MESH' and o.name != 'Plane': o.rotation_euler.z += 0.5; o.location.rotate(Euler((0, 0, 0.5)))
    stage('dagger', ortho=3.0, target=(0.3, 0.2, 0.1))

def goblet():
    reset(); gold = GOLD(); wine = principled('wine', (0.25, 0.01, 0.02), 0, 0.05)
    lathe([(0, 0), (0.45, 0), (0.48, 0.05), (0.3, 0.12), (0.08, 0.2), (0.07, 0.6), (0.12, 0.7), (0.38, 0.85), (0.48, 1.2), (0.5, 1.4), (0.46, 1.42), (0.42, 1.2), (0.32, 0.9), (0, 0.86)], gold)
    cyl(0.43, 0.02, (0, 0, 1.22), wine, verts=64)
    stage('goblet', ortho=2.0, target=(0, 0, 0.7))

def scroll():
    reset(); par = noisy(principled('parch', (0.78, 0.66, 0.45), 0, 0.7), 40, 0.3, ((0.55, 0.42, 0.25), (0.82, 0.7, 0.5))); red = principled('ribbon', (0.4, 0.03, 0.03), 0, 0.5)
    # свёрнутый пергамент лежит на боку: ось вдоль x, торцы — светлые кольца, посередине — алая лента с печатью
    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=1.9, vertices=48, location=(0, 0, 0.22), rotation=(0, math.pi / 2, 0)); put(bpy.context.active_object, par)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.235, depth=0.14, vertices=48, location=(0.05, 0, 0.22), rotation=(0, math.pi / 2, 0)); put(bpy.context.active_object, red)
    sph(0.11, (0.05, -0.24, 0.12), red, (1, 0.6, 1))
    for o in bpy.context.scene.objects:
        if o.type == 'MESH' and o.name != 'Plane': o.rotation_euler.z += -0.35; o.location.rotate(Euler((0, 0, -0.35)))
    stage('scroll', ortho=3.0, target=(-0.1, -0.1, 0.2))

def mug():
    reset(); wood = WOOD(); iron = IRON(); beer = noisy(principled('foam', (0.86, 0.76, 0.56), 0, 0.8, **{'Subsurface Weight': 0.3, 'Subsurface Scale': 0.03}), 40, 0.4)
    lathe([(0, 0), (0.55, 0), (0.58, 0.05), (0.6, 1.1), (0.56, 1.15), (0.5, 1.12), (0.5, 0.1), (0, 0.1)], wood)
    for z in (0.18, 0.95): cyl(0.615, 0.08, (0, 0, z), iron, verts=64)
    sph(0.5, (0, 0, 1.06), beer, (1, 1, 0.18))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.32, minor_radius=0.07, location=(0.72, 0, 0.6), rotation=(math.pi / 2, 0, 0)); put(bpy.context.active_object, wood)
    stage('mug', ortho=2.2, target=(0.1, 0, 0.6))

def hammer():
    reset(); iron = IRON(); wood = WOOD()
    box((0.55, 0.9, 0.5), (0.85, 0, 0.25), iron, bevel=0.07)
    cyl(0.1, 1.8, (-0.15, 0, 0.15), wood, rot=(0, math.pi / 2, 0))
    for o in bpy.context.scene.objects:
        if o.type == 'MESH' and o.name != 'Plane': o.rotation_euler.z += 0.6; o.location.rotate(Euler((0, 0, 0.6)))
    stage('hammer', ortho=2.6, target=(0, 0.2, 0.2))

def coals():
    reset(); rnd = random.Random(5)
    m = principled('coal', (0.025, 0.02, 0.018), 0, 0.9)
    nt = m.node_tree; N, L = nt.nodes, nt.links; bs = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    vo = N.new('ShaderNodeTexVoronoi'); vo.feature = 'DISTANCE_TO_EDGE'; vo.inputs['Scale'].default_value = 9
    L.new(tc.outputs['Object'], vo.inputs['Vector'])
    cr = N.new('ShaderNodeValToRGB'); e = cr.color_ramp.elements; e[0].position = 0.0; e[0].color = (1, 1, 1, 1); e[1].position = 0.045; e[1].color = (0, 0, 0, 1)
    L.new(vo.outputs['Distance'], cr.inputs['Fac'])
    # тлеет не всё: маска пятнами
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3; L.new(tc.outputs['Object'], nz.inputs['Vector'])
    nr = N.new('ShaderNodeValToRGB'); nr.color_ramp.elements[0].position = 0.42; nr.color_ramp.elements[1].position = 0.62
    L.new(nz.outputs['Fac'], nr.inputs['Fac'])
    mm = N.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; L.new(cr.outputs['Color'], mm.inputs[0]); L.new(nr.outputs['Color'], mm.inputs[1])
    # снизу у каждого уголька — ровный жар
    gr = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], gr.inputs[0])
    lo = N.new('ShaderNodeMapRange'); lo.inputs['From Min'].default_value = -0.12; lo.inputs['From Max'].default_value = 0.02; lo.inputs['To Min'].default_value = 0.8; lo.inputs['To Max'].default_value = 0.0
    L.new(gr.outputs['Z'], lo.inputs['Value'])
    ad = N.new('ShaderNodeMath'); ad.operation = 'ADD'; L.new(mm.outputs[0], ad.inputs[0]); L.new(lo.outputs['Result'], ad.inputs[1])
    L.new(ad.outputs[0], bs.inputs['Emission Strength'])
    bs.inputs['Emission Color'].default_value = (1.0, 0.22, 0.03, 1)
    em = N.new('ShaderNodeMath'); em.operation = 'MULTIPLY'; em.inputs[1].default_value = 5; L.new(ad.outputs[0], em.inputs[0]); L.new(em.outputs[0], bs.inputs['Emission Strength'])
    for i in range(16):
        a = rnd.uniform(0, 6.28); d = rnd.uniform(0, 0.75)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(0.11, 0.2), location=(math.cos(a) * d, math.sin(a) * d, 0.07))
        ob = bpy.context.active_object; ob.scale = (rnd.uniform(0.8, 1.4), rnd.uniform(0.8, 1.4), rnd.uniform(0.5, 0.8)); ob.rotation_euler = (rnd.uniform(0, 3), rnd.uniform(0, 3), rnd.uniform(0, 3))
        put(ob, m, smooth=False)
    stage('coals', ortho=2.2, target=(0, 0, 0.1))

def crystals():
    reset(); rnd = random.Random(7)
    m = principled('crystal', (0.35, 0.65, 1.0), 0, 0.12, **{'Transmission Weight': 0.55, 'IOR': 1.6, 'Emission Color': (0.25, 0.6, 1.0, 1), 'Emission Strength': 1.6})
    rock = noisy(principled('rock', (0.08, 0.075, 0.07), 0, 0.85), 8, 0.6)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.5, location=(0, 0, 0.05)); r = bpy.context.active_object; r.scale = (1.2, 1, 0.35); put(r, rock, smooth=False)
    for i in range(7):
        h = rnd.uniform(0.55, 1.35); w = rnd.uniform(0.09, 0.16)
        bm = bmesh.new()
        ring0 = [bm.verts.new((w * math.cos(k * math.pi / 3), w * math.sin(k * math.pi / 3), 0)) for k in range(6)]
        ring1 = [bm.verts.new((w * math.cos(k * math.pi / 3), w * math.sin(k * math.pi / 3), h * 0.75)) for k in range(6)]
        tip = bm.verts.new((0, 0, h))
        for k in range(6):
            j = (k + 1) % 6
            bm.faces.new((ring0[k], ring0[j], ring1[j], ring1[k])); bm.faces.new((ring1[k], ring1[j], tip))
        me = bpy.data.meshes.new('cr'); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new('cr', me); bpy.context.scene.collection.objects.link(ob)
        ob.location = (rnd.uniform(-0.35, 0.35), rnd.uniform(-0.25, 0.25), 0.1)
        ob.rotation_euler = (rnd.uniform(-0.55, 0.55), rnd.uniform(-0.55, 0.55), rnd.uniform(0, 3))
        put(ob, m, smooth=False)
    stage('crystals', ortho=2.0, tilt=40, target=(0, 0, 0.45))

def mushrooms():
    reset(); rnd = random.Random(11)
    stem = principled('stem', (0.82, 0.76, 0.62), 0, 0.6, **{'Subsurface Weight': 0.3, 'Subsurface Scale': 0.05})
    cap = noisy(principled('cap', (0.5, 0.07, 0.03), 0, 0.35), 6, 0.2, ((0.32, 0.03, 0.015), (0.62, 0.1, 0.04)))
    spot = principled('spot', (0.93, 0.9, 0.82), 0, 0.6)
    for (x, y, s) in [(0, 0, 1.0), (0.48, 0.18, 0.7), (-0.4, 0.28, 0.6), (0.18, -0.42, 0.5)]:
        lathe([(0, 0), (0.13 * s, 0), (0.11 * s, 0.35 * s), (0.09 * s, 0.6 * s), (0, 0.6 * s)], stem, loc=(x, y, 0))
        lathe([(0.0, 0.55 * s), (0.36 * s, 0.56 * s), (0.5 * s, 0.6 * s), (0.47 * s, 0.68 * s), (0.36 * s, 0.78 * s), (0.18 * s, 0.84 * s), (0.0, 0.86 * s)], cap, loc=(x, y, 0))
        for k in range(7):
            a = rnd.uniform(0, 6.28); r = rnd.uniform(0.08, 0.4) * s
            z = s * (0.86 - (r / s) ** 2 * 0.9)
            sph(0.05 * s, (x + math.cos(a) * r, y + math.sin(a) * r, z), spot, (1, 1, 0.35))
    stage('mushrooms', ortho=2.2, tilt=48, target=(0, 0, 0.4))

def keys():
    reset(); iron = noisy(principled('ironkey', (0.3, 0.25, 0.18), 1, 0.42), 40, 0.2, ((0.18, 0.15, 0.11), (0.42, 0.34, 0.24)))
    def key(name, scale):
        parts = []
        bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.045, location=(-0.62, 0, 0)); parts.append(bpy.context.active_object)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.09, minor_radius=0.03, location=(-0.62, 0, 0)); parts.append(bpy.context.active_object)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.042, depth=1.1, location=(0.0, 0, 0), rotation=(0, math.pi / 2, 0)); parts.append(bpy.context.active_object)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.08, location=(-0.36, 0, 0), rotation=(0, math.pi / 2, 0)); parts.append(bpy.context.active_object)
        for (x, w, h) in [(0.5, 0.07, 0.22), (0.38, 0.05, 0.15), (0.27, 0.06, 0.2)]:
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -h / 2, 0)); c = bpy.context.active_object; c.scale = (w, h, 0.06); parts.append(c)
        bpy.ops.object.select_all(action='DESELECT')
        for p in parts: p.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
        k = bpy.context.active_object; k.name = name; k.scale = (scale, scale, scale)
        put(k, iron)
        return k
    k1 = key('k1', 1.0); k1.location = (0.05, -0.1, 0.05); k1.rotation_euler = (0, 0, 0.35)
    k2 = key('k2', 0.8); k2.location = (-0.05, 0.25, 0.1); k2.rotation_euler = (0, 0.05, -0.55)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.28, minor_radius=0.035, location=(-0.58, 0.02, 0.04)); put(bpy.context.active_object, iron)
    stage('keys', ortho=2.7, tilt=32, target=(0.08, 0.05, 0.05))

def lamp():
    reset(); gold = GOLD()
    lathe([(0, 0), (0.3, 0), (0.35, 0.05), (0.2, 0.12), (0.45, 0.25), (0.55, 0.4), (0.45, 0.55), (0.15, 0.6), (0.18, 0.68), (0, 0.72)], gold)
    # носик
    bm = bmesh.new()
    cyl(0.09, 0.9, (0.55, 0, 0.35), gold, rot=(0, math.radians(70), 0))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.05, location=(-0.6, 0, 0.4), rotation=(math.pi / 2, 0, 0)); put(bpy.context.active_object, gold)
    a = math.radians(70); stage('lamp', ortho=2.4, target=(0.1, 0, 0.35), marks=[(0.55 + 0.45 * math.sin(a), 0, 0.8 + 0.45 * math.cos(a) + 0.03)])

def egg():
    reset(); gold = GOLD()
    sph(0.5, (0, 0, 0.6), gold, (0.82, 0.82, 1.15))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.36, minor_radius=0.05, location=(0, 0, 0.05)); put(bpy.context.active_object, principled('dark', (0.05, 0.05, 0.05), 1, 0.4))
    cyl(0.012, 1.2, (0.2, -0.35, 0.02), principled('needle', (0.75, 0.75, 0.78), 1, 0.15), rot=(0, math.pi / 2, 0.5))
    stage('egg', ortho=2.0, target=(0, 0, 0.55))

ALL = dict(candles=candles, coins=coins, dice=dice, potion=potion, book=book, dagger=dagger, goblet=goblet, scroll=scroll,
           mug=mug, hammer=hammer, coals=coals, crystals=crystals, mushrooms=mushrooms, keys=keys, lamp=lamp, egg=egg)
for n in (NAMES or ALL):
    random.seed(1); ALL[n]()
