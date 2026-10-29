#!/usr/bin/env python3
"""Объёмное название «Под Землёй» для главного меню: кованое золото с чеканкой, глубиной и отсветом огня снизу.

  python3 art/logo.py [--s 128]   — отрендерить и записать public/ui/v4/title.webp (1000 px) и title@2x.webp (2000 px)

Рендерит Blender (Cycles) как модуль Python: pip install bpy fonttools brotli pillow (bpy 5.x, Python 3.13).
Шрифт — Cormorant SC Bold из public/fonts (лицензия OFL). Его квадратичные кривые переписываются с явными
опорными точками: иначе Blender на острых стыках букв рисует иглы. Фаска — модификатором Bevel на сетке.
Свет: мягкий сверху, скользящий слева, огонь снизу, холодный контровой; мир — картина меню (отражается в золоте).
"""
import bpy, math, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.expanduser('~/.cache/podzemlei'); os.makedirs(CACHE, exist_ok=True)
SAMPLES = int(sys.argv[sys.argv.index('--s') + 1]) if '--s' in sys.argv else 128
W = 2600
OUT = os.path.join(CACHE, 'title-render.png')


def explicit_font():
    from fontTools.ttLib import TTFont
    from fontTools.pens.basePen import BasePen
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    dst = os.path.join(CACHE, 'cormorant-explicit.ttf')
    t = TTFont(os.path.join(ROOT, 'public', 'fonts', 'cormorant-sc-cyrillic-700-normal.woff2')); t.flavor = None
    gs = t.getGlyphSet(); glyf = t['glyf']

    class Explicit(BasePen):
        def __init__(self, out): super().__init__(gs); self.o = out
        def _moveTo(self, p): self.o.moveTo(p)
        def _lineTo(self, p): self.o.lineTo(p)
        def _qCurveToOne(self, a, b): self.o.qCurveTo(a, b)
        def _closePath(self): self.o.closePath()
        def _endPath(self): self.o.endPath()
    for name in t.getGlyphOrder():
        g = glyf[name]
        if g.isComposite() or g.numberOfContours == 0: continue
        pen = TTGlyphPen(None); gs[name].draw(Explicit(pen)); ng = pen.glyph(); ng.recalcBounds(glyf); glyf[name] = ng
    t.save(dst)
    return dst

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
sc.view_settings.exposure = -0.2

# буквы
font = bpy.data.fonts.load(explicit_font())
cu = bpy.data.curves.new('title', 'FONT')
cu.body = 'Под Землёй'
cu.font = font
cu.size = 1.0
cu.space_character = 1.06
cu.extrude = 0.11
cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
cu.resolution_u = 24
ob = bpy.data.objects.new('title', cu)
sc.collection.objects.link(ob)
ob.rotation_euler = (math.radians(90 - 14), 0, 0)
# фаска — модификатором на сетке: у кривой на острых углах (стык диагонали «М») вылезают иглы
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.convert(target='MESH')
ob = bpy.context.view_layer.objects.active
bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = 0.018; bv.segments = 4; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(30)
bv.use_clamp_overlap = True; bv.miter_outer = 'MITER_ARC'; bv.profile = 0.6
bpy.ops.object.shade_auto_smooth(angle=math.radians(40))

# материал: позолоченная кованая бронза — вмятины от молота, царапины, патина в углублениях
m = bpy.data.materials.new('gold'); m.use_nodes = True
nt = m.node_tree; N = nt.nodes; L = nt.links
for n in list(N): N.remove(n)
out = N.new('ShaderNodeOutputMaterial')
bs = N.new('ShaderNodeBsdfPrincipled')
L.new(bs.outputs['BSDF'], out.inputs['Surface'])
tc = N.new('ShaderNodeTexCoord')
# вмятины ковки
vor = N.new('ShaderNodeTexVoronoi'); vor.feature = 'SMOOTH_F1'; vor.inputs['Scale'].default_value = 55; vor.inputs['Smoothness'].default_value = 0.8
L.new(tc.outputs['Object'], vor.inputs['Vector'])
# крупные пятна
blot = N.new('ShaderNodeTexNoise'); blot.inputs['Scale'].default_value = 3.2; blot.inputs['Detail'].default_value = 6; blot.inputs['Roughness'].default_value = 0.6
L.new(tc.outputs['Object'], blot.inputs['Vector'])
# царапины: шум, вытянутый в одну сторону
mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (160, 9, 9); mp.inputs['Rotation'].default_value = (0, 0, 0.6)
L.new(tc.outputs['Object'], mp.inputs['Vector'])
scr = N.new('ShaderNodeTexNoise'); scr.inputs['Scale'].default_value = 1.0; scr.inputs['Detail'].default_value = 2
L.new(mp.outputs['Vector'], scr.inputs['Vector'])
scrR = N.new('ShaderNodeValToRGB'); scrR.color_ramp.elements[0].position = 0.7; scrR.color_ramp.elements[1].position = 0.74
L.new(scr.outputs['Fac'], scrR.inputs['Fac'])
fine = N.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value = 260; fine.inputs['Detail'].default_value = 4
L.new(tc.outputs['Object'], fine.inputs['Vector'])
# рельеф
b1 = N.new('ShaderNodeBump'); b1.inputs['Strength'].default_value = 0.07; b1.inputs['Distance'].default_value = 0.02
L.new(vor.outputs['Distance'], b1.inputs['Height'])
b2 = N.new('ShaderNodeBump'); b2.inputs['Strength'].default_value = 0.12; b2.inputs['Distance'].default_value = 0.004
L.new(fine.outputs['Fac'], b2.inputs['Height']); L.new(b1.outputs['Normal'], b2.inputs['Normal'])
b3 = N.new('ShaderNodeBump'); b3.inputs['Strength'].default_value = 0.04; b3.inputs['Distance'].default_value = 0.003; b3.invert = True
L.new(scrR.outputs['Color'], b3.inputs['Height']); L.new(b2.outputs['Normal'], b3.inputs['Normal'])
L.new(b3.outputs['Normal'], bs.inputs['Normal'])
# цвет: золото ↔ тёмная бронза по пятнам, в углублениях — патина
ramp = N.new('ShaderNodeValToRGB')
e = ramp.color_ramp.elements
e[0].position = 0.36; e[0].color = (0.5, 0.27, 0.07, 1)
e[1].position = 0.68; e[1].color = (1.0, 0.74, 0.3, 1)
L.new(blot.outputs['Fac'], ramp.inputs['Fac'])
ao = N.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 0.05; ao.samples = 8
pat = N.new('ShaderNodeMix'); pat.data_type = 'RGBA'; pat.blend_type = 'MULTIPLY'
L.new(ramp.outputs['Color'], pat.inputs[6])
aoR = N.new('ShaderNodeValToRGB'); aoR.color_ramp.elements[0].color = (0.18, 0.12, 0.06, 1); aoR.color_ramp.elements[1].position = 0.85
L.new(ao.outputs['AO'], aoR.inputs['Fac'])
L.new(aoR.outputs['Color'], pat.inputs[7]); pat.inputs[0].default_value = 1.0
# грязь в вмятинах от молота: ячейки чеканки темнее по краям
dentR = N.new('ShaderNodeValToRGB'); dentR.color_ramp.elements[0].position = 0.15; dentR.color_ramp.elements[0].color = (1, 1, 1, 1)
dentR.color_ramp.elements[1].position = 0.9; dentR.color_ramp.elements[1].color = (0.9, 0.85, 0.78, 1)
L.new(vor.outputs['Distance'], dentR.inputs['Fac'])
grime = N.new('ShaderNodeMix'); grime.data_type = 'RGBA'; grime.blend_type = 'MULTIPLY'; grime.inputs[0].default_value = 1.0
L.new(pat.outputs[2], grime.inputs[6]); L.new(dentR.outputs['Color'], grime.inputs[7])
L.new(grime.outputs[2], bs.inputs['Base Color'])
bs.inputs['Metallic'].default_value = 1.0
# шероховатость: царапины и пятна
rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = 0.16; rr.inputs['To Max'].default_value = 0.42
L.new(blot.outputs['Fac'], rr.inputs['Value'])
rough = N.new('ShaderNodeMath'); rough.operation = 'MULTIPLY_ADD'
L.new(vor.outputs['Distance'], rough.inputs[0]); rough.inputs[1].default_value = 0.12; L.new(rr.outputs['Result'], rough.inputs[2])
L.new(rough.outputs[0], bs.inputs['Roughness'])
ob.data.materials.append(m)

# свет: тёплый ключевой сверху слева, огонь снизу, холодный контровой сзади
def area(name, loc, rot, energy, color, size):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.color = color; ld.size = size
    o = bpy.data.objects.new(name, ld); o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    sc.collection.objects.link(o); return o
area('key', (0.0, -7.5, 6.2), (50, 0, 0), 300, (1.0, 0.88, 0.72), 2.6)
area('rake', (-9.0, -3.0, 4.0), (67, 0, -71), 700, (1.0, 0.86, 0.68), 4.0)  # скользящий свет — проявляет чеканку
area('fire', (0.5, -3.2, -2.6), (129, 0, 0), 700, (1.0, 0.42, 0.12), 5.0)
area('rim', (2.5, 3.5, 2.5), (-60, 0, -35), 650, (0.78, 0.85, 1.0), 3.0)
area('fill', (4, -5, 0.6), (85, 0, 40), 120, (1.0, 0.8, 0.6), 4.0)
# мир: картина меню — чтобы золото отражало тёплое подземелье
wd = bpy.data.worlds.new('w'); sc.world = wd; wd.use_nodes = True
wn = wd.node_tree.nodes; bg = wn['Background']
env = wn.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.join(ROOT, 'public', 'ui', 'v2', 'menu.webp'))
wd.node_tree.links.new(env.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.55

# камера: ортографическая, по размеру надписи
bpy.context.view_layer.update()
dx, dz = ob.dimensions.x, ob.dimensions.y * math.cos(math.radians(14)) + 0.16
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = dx * 1.05
co = bpy.data.objects.new('cam', cam); co.location = (0, -10, 0); co.rotation_euler = (math.radians(90), 0, 0)
sc.collection.objects.link(co); sc.camera = co
sc.render.resolution_x = W
sc.render.resolution_y = int(W * (dz * 1.42) / (dx * 1.05)) // 2 * 2
sc.render.filepath = OUT
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
bpy.ops.render.render(write_still=True)
print('rendered', sc.render.resolution_x, sc.render.resolution_y)

# обрезать прозрачные поля и сохранить для сайта
from PIL import Image
im = Image.open(OUT).convert('RGBA')
bb = im.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox()
im = im.crop((max(0, bb[0] - 8), max(0, bb[1] - 8), min(im.width, bb[2] + 8), min(im.height, bb[3] + 8)))
for w, name in [(2000, 'title@2x.webp'), (1000, 'title.webp')]:
    r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    r.save(os.path.join(ROOT, 'public', 'ui', 'v4', name), 'WEBP', quality=88, method=6, alpha_quality=95)
    print(name, r.size)
