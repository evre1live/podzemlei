#!/usr/bin/env python3
"""Карты глубины для объёмных карт «Под Землёй».

  python3 art/depth.py [модель.onnx]   — пересчитать глубину для всех рисунков карт и картинок локаций

Глубину считает нейросеть Depth Anything V2 Small (лицензия Apache 2.0) в виде ONNX:
https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vits_dynamic.onnx
(если файл не передан, скрипт скачает его в ~/.cache/podzemlei). Нужен onnxruntime: pip install onnxruntime.

Карта глубины — серая картинка того же кадра: светлое ближе, тёмное дальше. Лежит рядом с рисунком в папке d/:
public/cards/v1/d/<id>.webp и public/loc/v2/d/<id>-card.webp (длинная сторона 256 px).
Список с отпечатками файлов — public/depth-art.js; по нему игра понимает, у какой картинки есть глубина.
"""
import hashlib, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vits_dynamic.onnx'
SIDE = 256
SOURCES = [('cards/v1', lambda f: f.endswith('.webp')), ('loc/v2', lambda f: f.endswith('-card.webp'))]


def model_path(arg):
    if arg: return arg
    path = os.path.expanduser('~/.cache/podzemlei/depth_anything_v2_vits.onnx')
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        print('Скачиваю модель глубины…'); urllib.request.urlretrieve(URL, path)
    return path


def main():
    import onnxruntime as ort
    sess = ort.InferenceSession(model_path(sys.argv[1] if len(sys.argv) > 1 else None), providers=['CPUExecutionProvider'])

    def depth(im, long=518):
        W, H = im.size
        k = long / max(W, H)
        w, h = max(14, round(W * k / 14) * 14), max(14, round(H * k / 14) * 14)
        x = np.asarray(im.convert('RGB').resize((w, h), Image.BICUBIC), dtype=np.float32) / 255.0
        x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
        d = sess.run(None, {'image': x})[0][0]
        lo, hi = np.percentile(d, 1), np.percentile(d, 99)
        d = np.clip((d - lo) / (hi - lo + 1e-6), 0, 1)
        out = Image.fromarray((d * 255).astype(np.uint8))
        s = SIDE / max(W, H)
        return out.resize((max(1, round(W * s)), max(1, round(H * s))), Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.8))

    rows = []
    for rel, ok in SOURCES:
        src = os.path.join(ROOT, 'public', rel)
        os.makedirs(os.path.join(src, 'd'), exist_ok=True)
        files = sorted(f for f in os.listdir(src) if ok(f) and os.path.isfile(os.path.join(src, f)))
        for i, f in enumerate(files, 1):
            out = os.path.join(src, 'd', f)
            depth(Image.open(os.path.join(src, f))).save(out, 'WEBP', quality=82, method=6)
            rows.append((f'{rel}/{f[:-5]}', hashlib.md5(open(out, 'rb').read()).hexdigest()[:8]))
            if i % 25 == 0: print(f'  {rel}: {i}/{len(files)}')
    with open(os.path.join(ROOT, 'public', 'depth-art.js'), 'w') as fh:
        fh.write('// Карты глубины к рисункам (обновляет art/depth.py): путь картинки без .webp → отпечаток файла глубины в папке d/\n')
        fh.write('export const DEPTH = new Map([\n')
        for i in range(0, len(rows), 4):
            fh.write('  ' + ', '.join(f"['{a}', '{b}']" for a, b in rows[i:i + 4]) + ',\n')
        fh.write(']);\n')
    print(f'depth-art.js: {len(rows)} карт глубины')


if __name__ == '__main__':
    main()
