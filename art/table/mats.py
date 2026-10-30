# материалы Blender для стола и интерфейса: дуб рамы, кованое железо, латунь (общие для art/table/frame.py и art/ui/objects.py)
import bpy


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


# ───────── материалы рам под локации (art/table/frame.py --kind) ─────────
def _tc(N, kind='Object'):
    return N.new('ShaderNodeTexCoord').outputs[kind]


def _bsdf(nt, out):
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(bs.outputs[0], out.inputs[0]); return bs


def _ramp(N, Lk, fac, stops):
    cr = N.new('ShaderNodeValToRGB'); e = cr.color_ramp.elements
    while len(e) < len(stops): e.new(0.5)
    for el, (p, c) in zip(e, stops): el.position = p; el.color = (*c, 1)
    Lk.new(fac, cr.inputs['Fac']); return cr.outputs['Color']


def _bump(N, Lk, h, strength, dist, bs, base=None):
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; bp.inputs['Distance'].default_value = dist
    Lk.new(h, bp.inputs['Height'])
    if base is not None: Lk.new(base, bp.inputs['Normal'])
    Lk.new(bp.outputs['Normal'], bs.inputs['Normal']); return bp.outputs['Normal']


def wood(dark, light, grain=14.0, coat=0.25, rough=0.5, knots=0.0):
    """дерево вдоль бруса (координаты UV: u — вдоль): полосы волокон, шум, потёртые рёбра светлее"""
    def b(nt, out):
        N, Lk = nt.nodes, nt.links; bs = _bsdf(nt, out)
        mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, grain, 1.0); Lk.new(_tc(N, 'UV'), mp.inputs['Vector'])
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 8; nz.inputs['Distortion'].default_value = 1.2
        Lk.new(mp.outputs['Vector'], nz.inputs['Vector'])
        wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Y'; wv.inputs['Scale'].default_value = 0.9
        wv.inputs['Distortion'].default_value = 7; wv.inputs['Detail'].default_value = 4; Lk.new(mp.outputs['Vector'], wv.inputs['Vector'])
        mx = N.new('ShaderNodeMix'); mx.data_type = 'FLOAT'; mx.inputs[0].default_value = 0.45
        Lk.new(wv.outputs['Fac'], mx.inputs[2]); Lk.new(nz.outputs['Fac'], mx.inputs[3])
        col = _ramp(N, Lk, mx.outputs[0], [(0.3, dark), (0.85, light)])
        gm = N.new('ShaderNodeNewGeometry')
        ed = _ramp(N, Lk, gm.outputs['Pointiness'], [(0.53, (0, 0, 0)), (0.62, (1, 1, 1))])
        wear = N.new('ShaderNodeMix'); wear.data_type = 'RGBA'; wear.blend_type = 'SCREEN'
        Lk.new(ed, wear.inputs[0]); Lk.new(col, wear.inputs[6]); wear.inputs[7].default_value = (*[min(1, c * 1.6) for c in light], 1)
        Lk.new(wear.outputs[2], bs.inputs['Base Color'])
        bs.inputs['Roughness'].default_value = rough; bs.inputs['Coat Weight'].default_value = coat; bs.inputs['Coat Roughness'].default_value = 0.25
        _bump(N, Lk, mx.outputs[0], 0.35, 0.02, bs)
    return b


def metal(lo, hi, metallic=1.0, rough=(0.3, 0.6), bump=0.3, scale=18.0):
    def b(nt, out):
        N, Lk = nt.nodes, nt.links; bs = _bsdf(nt, out)
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 8; Lk.new(_tc(N), nz.inputs['Vector'])
        Lk.new(_ramp(N, Lk, nz.outputs['Fac'], [(0.35, lo), (0.75, hi)]), bs.inputs['Base Color'])
        bs.inputs['Metallic'].default_value = metallic
        rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = rough[0]; rr.inputs['To Max'].default_value = rough[1]
        Lk.new(nz.outputs['Fac'], rr.inputs['Value']); Lk.new(rr.outputs['Result'], bs.inputs['Roughness'])
        _bump(N, Lk, nz.outputs['Fac'], bump, 0.01, bs)
    return b


def rust(nt, out):
    """ржавая сталь: пятна рыжей ржавчины по тёмному металлу, ржавчина шершавая и не блестит"""
    N, Lk = nt.nodes, nt.links; bs = _bsdf(nt, out)
    n1 = N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 5; n1.inputs['Detail'].default_value = 12; n1.inputs['Roughness'].default_value = 0.7; Lk.new(_tc(N), n1.inputs['Vector'])
    m = _ramp(N, Lk, n1.outputs['Fac'], [(0.42, (0, 0, 0)), (0.56, (1, 1, 1))])
    col = _ramp(N, Lk, n1.outputs['Fac'], [(0.3, (0.05, 0.045, 0.04)), (0.5, (0.12, 0.05, 0.02)), (0.62, (0.32, 0.11, 0.03)), (0.8, (0.45, 0.2, 0.06))])
    Lk.new(col, bs.inputs['Base Color'])
    inv = N.new('ShaderNodeInvert'); Lk.new(m, inv.inputs['Color']); Lk.new(inv.outputs['Color'], bs.inputs['Metallic'])
    rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = 0.35; rr.inputs['To Max'].default_value = 0.9
    Lk.new(m, rr.inputs['Value']); Lk.new(rr.outputs['Result'], bs.inputs['Roughness'])
    _bump(N, Lk, n1.outputs['Fac'], 0.6, 0.02, bs)


def stone(dark, light, cracks=0.6, scale=4.0, speck=True):
    """камень: пятна, крапины (вороной) и трещины"""
    def b(nt, out):
        N, Lk = nt.nodes, nt.links; bs = _bsdf(nt, out); tc = _tc(N)
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 10; nz.inputs['Roughness'].default_value = 0.6; Lk.new(tc, nz.inputs['Vector'])
        vo = N.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 60 if speck else 12; Lk.new(tc, vo.inputs['Vector'])
        cr = N.new('ShaderNodeTexVoronoi'); cr.feature = 'DISTANCE_TO_EDGE'; cr.inputs['Scale'].default_value = 2.2; Lk.new(tc, cr.inputs['Vector'])
        mx = N.new('ShaderNodeMix'); mx.data_type = 'FLOAT'; mx.inputs[0].default_value = 0.25
        Lk.new(nz.outputs['Fac'], mx.inputs[2]); Lk.new(vo.outputs['Distance'], mx.inputs[3])
        col = _ramp(N, Lk, mx.outputs[0], [(0.25, dark), (0.75, light)])
        crk = _ramp(N, Lk, cr.outputs['Distance'], [(0.0, (0.25, 0.25, 0.25)), (0.03, (1, 1, 1))])
        mm = N.new('ShaderNodeMix'); mm.data_type = 'RGBA'; mm.blend_type = 'MULTIPLY'; mm.inputs[0].default_value = cracks
        Lk.new(col, mm.inputs[6]); Lk.new(crk, mm.inputs[7]); Lk.new(mm.outputs[2], bs.inputs['Base Color'])
        bs.inputs['Roughness'].default_value = 0.78
        h = N.new('ShaderNodeMath'); h.operation = 'MULTIPLY'; Lk.new(mx.outputs[0], h.inputs[0]); Lk.new(crk, h.inputs[1])
        _bump(N, Lk, h.outputs[0], 0.7, 0.03, bs)
    return b


def marble(base, vein, coat=0.6):
    def b(nt, out):
        N, Lk = nt.nodes, nt.links; bs = _bsdf(nt, out); tc = _tc(N)
        wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.inputs['Scale'].default_value = 1.6; wv.inputs['Distortion'].default_value = 14
        wv.inputs['Detail'].default_value = 8; wv.inputs['Detail Scale'].default_value = 1.4; Lk.new(tc, wv.inputs['Vector'])
        col = _ramp(N, Lk, wv.outputs['Fac'], [(0.0, vein), (0.12, base), (0.9, base), (1.0, vein)])
        Lk.new(col, bs.inputs['Base Color'])
        bs.inputs['Roughness'].default_value = 0.22; bs.inputs['Coat Weight'].default_value = coat; bs.inputs['Coat Roughness'].default_value = 0.08
        bs.inputs['Subsurface Weight'].default_value = 0.15
    return b


def ice(nt, out):
    """лёд: голубая глубина, белый иней пятнами, сеть трещин, мокрый блеск"""
    N, Lk = nt.nodes, nt.links; bs = _bsdf(nt, out); tc = _tc(N)
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3; nz.inputs['Detail'].default_value = 10; Lk.new(tc, nz.inputs['Vector'])
    cr = N.new('ShaderNodeTexVoronoi'); cr.feature = 'DISTANCE_TO_EDGE'; cr.inputs['Scale'].default_value = 3.5; Lk.new(tc, cr.inputs['Vector'])
    col = _ramp(N, Lk, nz.outputs['Fac'], [(0.3, (0.18, 0.42, 0.62)), (0.55, (0.5, 0.75, 0.9)), (0.75, (0.88, 0.95, 1.0))])
    crk = _ramp(N, Lk, cr.outputs['Distance'], [(0.0, (1, 1, 1)), (0.025, (0, 0, 0))])
    mm = N.new('ShaderNodeMix'); mm.data_type = 'RGBA'; mm.blend_type = 'SCREEN'; mm.inputs[0].default_value = 0.7
    Lk.new(col, mm.inputs[6]); Lk.new(crk, mm.inputs[7]); Lk.new(mm.outputs[2], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 0.12; bs.inputs['Coat Weight'].default_value = 1.0; bs.inputs['Coat Roughness'].default_value = 0.04
    bs.inputs['Subsurface Weight'].default_value = 0.35; bs.inputs['Subsurface Radius'].default_value = (0.4, 0.7, 1.0)
    _bump(N, Lk, crk, 0.5, 0.02, bs)


def birch(nt, out):
    """берёзовое бревно: белая кора с чёрными чечевичками поперёк ствола"""
    N, Lk = nt.nodes, nt.links; bs = _bsdf(nt, out)
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (34.0, 3.0, 1.0); Lk.new(_tc(N, 'UV'), mp.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.6; nz.inputs['Detail'].default_value = 6; Lk.new(mp.outputs['Vector'], nz.inputs['Vector'])
    big = N.new('ShaderNodeTexNoise'); big.inputs['Scale'].default_value = 0.9; Lk.new(_tc(N, 'UV'), big.inputs['Vector'])
    marks = _ramp(N, Lk, nz.outputs['Fac'], [(0.6, (1, 1, 1)), (0.68, (0, 0, 0))])
    col = _ramp(N, Lk, big.outputs['Fac'], [(0.35, (0.62, 0.6, 0.54)), (0.7, (0.82, 0.8, 0.74))])
    mm = N.new('ShaderNodeMix'); mm.data_type = 'RGBA'; mm.blend_type = 'MULTIPLY'; mm.inputs[0].default_value = 0.92
    Lk.new(col, mm.inputs[6]); Lk.new(marks, mm.inputs[7]); Lk.new(mm.outputs[2], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 0.7
    _bump(N, Lk, marks, 0.3, 0.01, bs)


def bark(nt, out):
    """корявая кора с мхом: глубокие борозды вдоль бруса, зелёные пятна мха"""
    N, Lk = nt.nodes, nt.links; bs = _bsdf(nt, out)
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.2, 9.0, 1.0); Lk.new(_tc(N, 'UV'), mp.inputs['Vector'])
    wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Y'; wv.inputs['Scale'].default_value = 1.6
    wv.inputs['Distortion'].default_value = 10; wv.inputs['Detail'].default_value = 6; Lk.new(mp.outputs['Vector'], wv.inputs['Vector'])
    ms = N.new('ShaderNodeTexNoise'); ms.inputs['Scale'].default_value = 2.2; ms.inputs['Detail'].default_value = 10; Lk.new(_tc(N), ms.inputs['Vector'])
    col = _ramp(N, Lk, wv.outputs['Fac'], [(0.25, (0.015, 0.01, 0.007)), (0.8, (0.09, 0.06, 0.04))])
    moss = _ramp(N, Lk, ms.outputs['Fac'], [(0.55, (0, 0, 0)), (0.65, (1, 1, 1))])
    mm = N.new('ShaderNodeMix'); mm.data_type = 'RGBA'; Lk.new(moss, mm.inputs[0]); Lk.new(col, mm.inputs[6]); mm.inputs[7].default_value = (0.08, 0.16, 0.03, 1)
    Lk.new(mm.outputs[2], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85
    _bump(N, Lk, wv.outputs['Fac'], 0.9, 0.04, bs)


def rope(nt, out):
    """канат: косые пряди"""
    N, Lk = nt.nodes, nt.links; bs = _bsdf(nt, out)
    wv = N.new('ShaderNodeTexWave'); wv.bands_direction = 'DIAGONAL'; wv.inputs['Scale'].default_value = 26; wv.inputs['Distortion'].default_value = 1.5
    Lk.new(_tc(N), wv.inputs['Vector'])
    Lk.new(_ramp(N, Lk, wv.outputs['Fac'], [(0.2, (0.12, 0.08, 0.04)), (0.8, (0.42, 0.31, 0.17))]), bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 0.9
    _bump(N, Lk, wv.outputs['Fac'], 0.8, 0.02, bs)


def emit(color, strength=6.0):
    def b(nt, out):
        bs = _bsdf(nt, out); bs.inputs['Base Color'].default_value = (*color, 1)
        bs.inputs['Emission Color'].default_value = (*color, 1); bs.inputs['Emission Strength'].default_value = strength
    return b


def gold(nt, out):
    bs = _bsdf(nt, out); bs.inputs['Base Color'].default_value = (0.95, 0.68, 0.26, 1); bs.inputs['Metallic'].default_value = 1; bs.inputs['Roughness'].default_value = 0.22


def tile(nt, out):
    """бирюзовая глазурь"""
    bs = _bsdf(nt, out); bs.inputs['Base Color'].default_value = (0.02, 0.42, 0.45, 1); bs.inputs['Roughness'].default_value = 0.15
    bs.inputs['Coat Weight'].default_value = 1.0; bs.inputs['Coat Roughness'].default_value = 0.05


# рама: брус, уголки с заклёпками, кромка у поля (и её толщина)
FRAMES = {
    'oak':      (oak, iron, brass, 0.09),
    'ebony':    (wood((0.008, 0.006, 0.006), (0.045, 0.03, 0.024), coat=0.5, rough=0.35), metal((0.02, 0.019, 0.018), (0.06, 0.055, 0.05)), gold, 0.11),
    'birch':    (birch, metal((0.06, 0.13, 0.09), (0.22, 0.34, 0.24), 0.7, (0.4, 0.7)), metal((0.3, 0.17, 0.06), (0.6, 0.4, 0.16), 1.0, (0.3, 0.5)), 0.09),
    'steel':    (metal((0.05, 0.05, 0.055), (0.16, 0.16, 0.17), 1.0, (0.25, 0.5), 0.45, 9), metal((0.02, 0.019, 0.018), (0.07, 0.065, 0.06)), metal((0.5, 0.18, 0.08), (0.85, 0.42, 0.22), 1.0, (0.25, 0.4)), 0.11),
    'ice':      (ice, metal((0.55, 0.6, 0.65), (0.85, 0.88, 0.92), 1.0, (0.12, 0.3), 0.1), emit((0.55, 0.85, 1.0), 1.0), 0.08),
    'stone':    (stone((0.07, 0.075, 0.07), (0.26, 0.27, 0.25)), metal((0.02, 0.019, 0.018), (0.06, 0.055, 0.05)), stone((0.04, 0.06, 0.03), (0.1, 0.16, 0.06), 0.2, 9), 0.1),
    'marble':   (marble((0.82, 0.83, 0.86), (0.3, 0.33, 0.4)), gold, gold, 0.1),
    'ship':     (wood((0.012, 0.008, 0.006), (0.075, 0.05, 0.034), grain=10, coat=0.1, rough=0.7), metal((0.45, 0.28, 0.08), (0.8, 0.55, 0.2), 1.0, (0.25, 0.45)), rope, 0.17),
    'mahogany': (wood((0.04, 0.008, 0.004), (0.2, 0.045, 0.02), coat=0.6, rough=0.3), gold, gold, 0.1),
    'sand':     (stone((0.36, 0.24, 0.12), (0.66, 0.5, 0.3), 0.35, 3.0, False), gold, tile, 0.13),
    'rust':     (rust, rust, metal((0.08, 0.3, 0.22), (0.25, 0.55, 0.42), 0.8, (0.4, 0.6)), 0.1),
    'bark':     (bark, metal((0.06, 0.13, 0.09), (0.22, 0.34, 0.24), 0.7, (0.4, 0.7)), emit((0.2, 1.0, 0.7), 1.2), 0.07),
    'black':    (metal((0.008, 0.008, 0.009), (0.04, 0.04, 0.045), 1.0, (0.2, 0.45), 0.35, 12), gold, emit((0.15, 1.0, 0.35), 1.8), 0.08),
}
