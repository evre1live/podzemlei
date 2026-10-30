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
