#!/usr/bin/env python3
# Увеличение картинок нейросетью Real-ESRGAN (RRDBNet) без PyTorch — для фонов в 4K.
# Веса читаются прямо из .pth (zip + pickle), граф собирается в ONNX и считается onnxruntime на процессоре, по плиткам.
#
#   pip install onnx onnxruntime numpy pillow
#   curl -LO https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth   (веса, BSD-3)
#   python3 art/sr.py RealESRGAN_x4plus.pth 4 сцена.png сцена-x4.png 320
#   python3 art/cut.py loc сцена-x4.png loc_tavern
#
# На двух ядрах картинка 1672×941 увеличивается в 4 раза примерно за 7 минут.
import sys, zipfile, pickle, collections, time, os
import numpy as np
import onnx
from onnx import helper, TensorProto, numpy_helper
import onnxruntime as ort
from PIL import Image


def load_pth(path):
    z = zipfile.ZipFile(path)
    names = z.namelist()
    pkl = next(n for n in names if n.endswith('data.pkl'))
    prefix = pkl[: -len('data.pkl')]
    DT = {'FloatStorage': np.float32, 'HalfStorage': np.float16, 'DoubleStorage': np.float64, 'LongStorage': np.int64, 'IntStorage': np.int32}

    def rebuild(storage, offset, size, stride, *rest):
        if not size:
            return np.array(storage[offset])
        it = storage.itemsize
        return np.array(np.lib.stride_tricks.as_strided(storage[offset:], shape=tuple(size), strides=tuple(s * it for s in stride)))

    class U(pickle.Unpickler):
        def find_class(self, mod, name):
            if mod == 'torch._utils' and name == '_rebuild_tensor_v2':
                return rebuild
            if mod == 'collections' and name == 'OrderedDict':
                return collections.OrderedDict
            if mod == 'torch' and name.endswith('Storage'):
                return name
            raise pickle.UnpicklingError(f'нельзя: {mod}.{name}')

        def persistent_load(self, pid):
            _, stype, key, _loc, _n = pid
            return np.frombuffer(z.read(f'{prefix}data/{key}'), dtype=DT[stype])

    sd = U(z.open(pkl)).load()
    for k in ('params_ema', 'params'):
        if isinstance(sd, dict) and k in sd:
            return sd[k]
    return sd


def build(sd, scale):
    nodes, inits = [], []
    cnt = [0]

    def nm(p):
        cnt[0] += 1
        return f'{p}_{cnt[0]}'

    def conv(x, key):
        w, b = sd[key + '.weight'].astype(np.float32), sd[key + '.bias'].astype(np.float32)
        wn, bn = key + '.w', key + '.b'
        inits.append(numpy_helper.from_array(w, wn)); inits.append(numpy_helper.from_array(b, bn))
        y = nm('conv')
        nodes.append(helper.make_node('Conv', [x, wn, bn], [y], pads=[1, 1, 1, 1], kernel_shape=[3, 3]))
        return y

    def lrelu(x):
        y = nm('lr'); nodes.append(helper.make_node('LeakyRelu', [x], [y], alpha=0.2)); return y

    def cat(xs):
        y = nm('cat'); nodes.append(helper.make_node('Concat', xs, [y], axis=1)); return y

    c02 = 'c02'; inits.append(numpy_helper.from_array(np.array(0.2, np.float32), c02))

    def scaled_add(a, b):  # a*0.2 + b
        m = nm('mul'); nodes.append(helper.make_node('Mul', [a, c02], [m]))
        y = nm('add'); nodes.append(helper.make_node('Add', [m, b], [y])); return y

    def rdb(x, p):
        x1 = lrelu(conv(x, p + '.conv1'))
        x2 = lrelu(conv(cat([x, x1]), p + '.conv2'))
        x3 = lrelu(conv(cat([x, x1, x2]), p + '.conv3'))
        x4 = lrelu(conv(cat([x, x1, x2, x3]), p + '.conv4'))
        x5 = conv(cat([x, x1, x2, x3, x4]), p + '.conv5')
        return scaled_add(x5, x)

    nb = 1 + max(int(k.split('.')[1]) for k in sd if k.startswith('body.'))
    feat = conv('input', 'conv_first')
    h = feat
    for i in range(nb):
        o = rdb(rdb(rdb(h, f'body.{i}.rdb1'), f'body.{i}.rdb2'), f'body.{i}.rdb3')
        h = scaled_add(o, h)
    body = conv(h, 'conv_body')
    s = nm('add'); nodes.append(helper.make_node('Add', [feat, body], [s]))
    sc = 'sc2'; inits.append(numpy_helper.from_array(np.array([1, 1, 2, 2], np.float32), sc))

    def up(x):
        y = nm('up'); nodes.append(helper.make_node('Resize', [x, '', sc], [y], mode='nearest', coordinate_transformation_mode='asymmetric', nearest_mode='floor')); return y

    f = lrelu(conv(up(s), 'conv_up1'))
    f = lrelu(conv(up(f), 'conv_up2'))
    out = conv(lrelu(conv(f, 'conv_hr')), 'conv_last')
    nodes.append(helper.make_node('Identity', [out], ['output']))
    cin = sd['conv_first.weight'].shape[1]
    g = helper.make_graph(nodes, 'rrdb', [helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, cin, None, None])],
                          [helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 3, None, None])], inits)
    m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 17)])
    m.ir_version = 8
    return m


def unshuffle(x, r):  # torch.pixel_unshuffle для [C,H,W]
    c, h, w = x.shape
    return x.reshape(c, h // r, r, w // r, r).transpose(0, 2, 4, 1, 3).reshape(c * r * r, h // r, w // r)


def upscale(sess, img, scale, tile=256, pad=16):
    x = np.asarray(img.convert('RGB'), np.float32).transpose(2, 0, 1) / 255.0
    C, H, W = x.shape
    # ×2-модель видит картинку через pixel_unshuffle(2): нужны чётные размеры
    m = 2 if scale == 2 else 1
    Hp, Wp = (H + m - 1) // m * m, (W + m - 1) // m * m
    if (Hp, Wp) != (H, W):
        x = np.pad(x, ((0, 0), (0, Hp - H), (0, Wp - W)), mode='reflect')
    out = np.zeros((3, Hp * scale, Wp * scale), np.float32)
    t0 = time.time(); n = 0
    ys = list(range(0, Hp, tile)); xs = list(range(0, Wp, tile))
    for y0 in ys:
        for x0 in xs:
            y1, x1 = min(y0 + tile, Hp), min(x0 + tile, Wp)
            a0, b0 = max(0, y0 - pad), max(0, x0 - pad)
            a1, b1 = min(Hp, y1 + pad), min(Wp, x1 + pad)
            a0 -= a0 % m; b0 -= b0 % m
            a1 += (m - a1 % m) % m; b1 += (m - b1 % m) % m
            patch = x[:, a0:a1, b0:b1]
            inp = unshuffle(patch, 2) if scale == 2 else patch
            res = sess.run(None, {'input': inp[None]})[0][0]
            oy, ox = (y0 - a0) * scale, (x0 - b0) * scale
            out[:, y0 * scale:y1 * scale, x0 * scale:x1 * scale] = res[:, oy:oy + (y1 - y0) * scale, ox:ox + (x1 - x0) * scale]
            n += 1
            print(f'  плитка {n}/{len(ys) * len(xs)} · {time.time() - t0:.0f} с', flush=True)
    out = out[:, :H * scale, :W * scale]
    return Image.fromarray((np.clip(out, 0, 1).transpose(1, 2, 0) * 255 + 0.5).astype(np.uint8))


def session(pth, scale):
    onx = os.path.splitext(pth)[0] + '.onnx'
    if not os.path.exists(onx):
        onnx.save(build(load_pth(pth), scale), onx)
    so = ort.SessionOptions(); so.intra_op_num_threads = os.cpu_count() or 2
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return ort.InferenceSession(onx, so, providers=['CPUExecutionProvider'])


if __name__ == '__main__':
    pth, scale, src, dst = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
    tile = int(sys.argv[5]) if len(sys.argv) > 5 else 256
    sess = session(pth, scale)
    t = time.time()
    upscale(sess, Image.open(src), scale, tile).save(dst)
    print('готово', dst, f'{time.time() - t:.0f} с')
