# игровое поле стола: тёмная кожа с тиснением, потёртости там, где скользят карты
import bpy, math, sys, os
D = os.path.dirname(os.path.abspath(__file__)) + '/'
OUT = sys.argv[sys.argv.index('--o') + 1]
S = int(sys.argv[sys.argv.index('--s') + 1]) if '--s' in sys.argv else 32
W = int(sys.argv[sys.argv.index('--w') + 1]) if '--w' in sys.argv else 2400
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = S; sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.render.resolution_x = W; sc.render.resolution_y = W * 9 // 16
bpy.ops.mesh.primitive_plane_add(size=1); ob = bpy.context.active_object; ob.scale = (16, 9, 1)
bpy.ops.object.transform_apply(scale=True)
m = bpy.data.materials.new('leather'); m.use_nodes = True; nt = m.node_tree; N, Lk = nt.nodes, nt.links
bs = N['Principled BSDF']
tc = N.new('ShaderNodeTexCoord')
# зерно кожи: мелкие ячейки
vor = N.new('ShaderNodeTexVoronoi'); vor.feature = 'DISTANCE_TO_EDGE'; vor.inputs['Scale'].default_value = 34
Lk.new(tc.outputs['Object'], vor.inputs['Vector'])
vr = N.new('ShaderNodeValToRGB'); vr.color_ramp.elements[0].position = 0.0; vr.color_ramp.elements[1].position = 0.12
Lk.new(vor.outputs['Distance'], vr.inputs['Fac'])
# складки и пятна
n1 = N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 0.45; n1.inputs['Detail'].default_value = 10; n1.inputs['Roughness'].default_value = 0.62
Lk.new(tc.outputs['Object'], n1.inputs['Vector'])
n2 = N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 2.5; n2.inputs['Detail'].default_value = 6
Lk.new(tc.outputs['Object'], n2.inputs['Vector'])
# тиснение
img = N.new('ShaderNodeTexImage'); img.image = bpy.data.images.load(D + 'emboss.png'); img.image.colorspace_settings.name = 'Non-Color'
Lk.new(tc.outputs['UV'], img.inputs['Vector'])
# цвет: тёмно-коричневая кожа, середина чуть светлее и потёрта
col = N.new('ShaderNodeValToRGB'); e = col.color_ramp.elements
e[0].position = 0.3; e[0].color = (0.011, 0.0055, 0.0035, 1); e[1].position = 0.78; e[1].color = (0.05, 0.024, 0.013, 1)
Lk.new(n1.outputs['Fac'], col.inputs['Fac'])
# потёртость в центре: радиальный градиент
grad = N.new('ShaderNodeTexGradient'); grad.gradient_type = 'SPHERICAL'
mp = N.new('ShaderNodeMapping'); mp.inputs['Location'].default_value = (-0.5, -0.5, 0); mp.inputs['Scale'].default_value = (1.3, 2.0, 1)
# сдвиг: центр в (0.5, 0.5)
mp2 = N.new('ShaderNodeVectorMath'); mp2.operation = 'SUBTRACT'; mp2.inputs[1].default_value = (0.5, 0.5, 0)
Lk.new(tc.outputs['UV'], mp2.inputs[0])
mp3 = N.new('ShaderNodeVectorMath'); mp3.operation = 'MULTIPLY'; mp3.inputs[1].default_value = (1.6, 2.2, 1)
Lk.new(mp2.outputs[0], mp3.inputs[0]); Lk.new(mp3.outputs[0], grad.inputs['Vector'])
wr = N.new('ShaderNodeMix'); wr.data_type = 'RGBA'; wr.blend_type = 'SCREEN'
Lk.new(col.outputs['Color'], wr.inputs[6]); wr.inputs[7].default_value = (0.05, 0.032, 0.02, 1)
gm = N.new('ShaderNodeMath'); gm.operation = 'MULTIPLY'; Lk.new(grad.outputs['Fac'], gm.inputs[0]); Lk.new(n2.outputs['Fac'], gm.inputs[1])
Lk.new(gm.outputs[0], wr.inputs[0])
# тиснение темнее
tm = N.new('ShaderNodeMix'); tm.data_type = 'RGBA'; tm.blend_type = 'MIX'
Lk.new(wr.outputs[2], tm.inputs[6]); tm.inputs[7].default_value = (0.2, 0.12, 0.045, 1)
emr = N.new('ShaderNodeMath'); emr.operation = 'MULTIPLY'; emr.inputs[1].default_value = 0.7; Lk.new(img.outputs['Color'], emr.inputs[0]); Lk.new(emr.outputs[0], tm.inputs[0])
Lk.new(tm.outputs[2], bs.inputs['Base Color'])
met = N.new('ShaderNodeMath'); met.operation = 'MULTIPLY'; met.inputs[1].default_value = 0.75; Lk.new(img.outputs['Color'], met.inputs[0]); Lk.new(met.outputs[0], bs.inputs['Metallic'])
rr = N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = 0.42; rr.inputs['To Max'].default_value = 0.72
Lk.new(n2.outputs['Fac'], rr.inputs['Value']); Lk.new(rr.outputs['Result'], bs.inputs['Roughness'])
bs.inputs['Coat Weight'].default_value = 0.12; bs.inputs['Coat Roughness'].default_value = 0.35
b1 = N.new('ShaderNodeBump'); b1.inputs['Strength'].default_value = 0.45; b1.inputs['Distance'].default_value = 0.002
Lk.new(vr.outputs['Color'], b1.inputs['Height'])
b2 = N.new('ShaderNodeBump'); b2.inputs['Strength'].default_value = 0.35; b2.inputs['Distance'].default_value = 0.01; b2.invert = True
Lk.new(img.outputs['Color'], b2.inputs['Height']); Lk.new(b1.outputs['Normal'], b2.inputs['Normal'])
b3 = N.new('ShaderNodeBump'); b3.inputs['Strength'].default_value = 0.2; b3.inputs['Distance'].default_value = 0.02
Lk.new(n1.outputs['Fac'], b3.inputs['Height']); Lk.new(b2.outputs['Normal'], b3.inputs['Normal'])
Lk.new(b3.outputs['Normal'], bs.inputs['Normal'])
ob.data.materials.append(m)
# свет: ровный сверху, лёгкий скользящий — чтобы проступило тиснение
ld = bpy.data.lights.new('top', 'AREA'); ld.energy = 500; ld.size = 30; ld.color = (1, 0.92, 0.82)
o = bpy.data.objects.new('top', ld); o.location = (0, 0, 12); sc.collection.objects.link(o)
sun = bpy.data.lights.new('rake', 'SUN'); sun.energy = 3.0; sun.color = (1, 0.82, 0.6); sun.angle = math.radians(4)
so = bpy.data.objects.new('rake', sun); so.rotation_euler = (math.radians(74), 0, math.radians(-35)); sc.collection.objects.link(so)
wd = bpy.data.worlds.new('w'); sc.world = wd; wd.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.015, 0.01, 1)
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 16
co = bpy.data.objects.new('cam', cam); co.location = (0, 0, 10); sc.collection.objects.link(co); sc.camera = co
sc.render.filepath = OUT; sc.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True); print('mat', OUT)
