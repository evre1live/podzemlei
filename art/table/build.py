#!/usr/bin/env python3
"""Стол-диорама «Под Землёй»: всё, что рендерит Blender, и сборка файлов для сайта.

  python3 art/table/build.py [frame] [frames [вид,вид]] [mat] [props [имя,имя]]   — по умолчанию всё
  (поля под локации рисует art/table/locmats.py)

Рендер — Blender как модуль Python (pip install bpy pillow numpy; bpy 5.x, Python 3.13), запускается отдельными процессами:
  frame.py — дубовая рама с коваными уголками и латунной кромкой для border-image (9 частей, срез 118 px из 1024);
             с --kind — рама под локацию: эбен с золотом, берёза, сталь, лёд, гранит, мрамор, корабельный брус с канатом,
             красное дерево, песчаник с бирюзой, ржавая сталь, кора со мхом, чёрное железо со светящейся кромкой;
  mat.py   — кожаное поле с тиснённым компасом (маска тиснения рисуется здесь же, emboss.png);
  props.py — предметы на стол: свечи, монеты, кости, зелье, книга, кинжал, кубок, свиток, кружка, молот, угли,
             кристаллы, грибы, ключи, лампа, золотое яйцо. Каждый — со своей тенью; фитили печатаются как MARKS.
Результат — public/ui/table/v1: frame.webp, mat.webp (2400 px) и mat-1200.webp, <предмет>.webp (обрезанные по краю).
Координаты фитилей после обрезки печатаются — их вписывают в TABLE_FLAMES (public/app.js).
"""
import os, sys, subprocess, re, math
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'public', 'ui', 'table', 'v1')
TMP = os.path.expanduser('~/.cache/podzemlei/table'); os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
PY = os.environ.get('BLENDER_PY', sys.executable)


def emboss():
    W, H = 3200, 1800
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    cx, cy = W / 2, H / 2; R = H * 0.34
    def ring(r, w): d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=255, width=w)
    ring(R, 7); ring(R * 0.94, 3); ring(R * 0.62, 4); ring(R * 0.58, 2); ring(R * 0.1, 4)
    for i in range(48):
        a = i * math.pi * 2 / 48; l = 0.03 if i % 4 else 0.055
        r0, r1 = R * 0.945, R * (0.945 - l)
        d.line((cx + r0 * math.cos(a), cy + r0 * math.sin(a), cx + r1 * math.cos(a), cy + r1 * math.sin(a)), fill=255, width=4 if i % 4 == 0 else 2)
    for i in range(8):
        a = i * math.pi / 4 - math.pi / 2; L = R * (0.9 if i % 2 == 0 else 0.55); w = R * (0.07 if i % 2 == 0 else 0.05)
        tip = (cx + L * math.cos(a), cy + L * math.sin(a))
        l1 = (cx + w * math.cos(a + math.pi / 2), cy + w * math.sin(a + math.pi / 2)); l2 = (cx + w * math.cos(a - math.pi / 2), cy + w * math.sin(a - math.pi / 2))
        d.line((*l1, *tip), fill=255, width=4); d.line((*l2, *tip), fill=255, width=4); d.line((cx, cy, *tip), fill=180, width=2)
    for i in range(12):
        a = i * math.pi / 6 + math.pi / 12; r = R * 0.78; x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        d.polygon([(x, y - 14), (x + 10, y), (x, y + 14), (x - 10, y)], outline=255, width=3)
    im.filter(ImageFilter.GaussianBlur(1.6)).save(os.path.join(HERE, 'emboss.png'))


def blender(script, *args):
    r = subprocess.run([PY, os.path.join(HERE, script), *args], capture_output=True, text=True)
    if r.returncode: print(r.stdout[-2000:], r.stderr[-2000:]); raise SystemExit(f'{script}: ошибка')
    return r.stdout


def trim(png, pad=4):
    """тень от площадного света расползается по кадру: гасим её к краям и обрезаем по видимому"""
    import numpy as np
    im = Image.open(png).convert('RGBA'); a = np.asarray(im).astype(np.float32)
    H, W = a.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
    r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
    fall = np.clip((1.0 - r) / 0.35, 0, 1) ** 1.5
    al = a[..., 3] / 255
    al = np.where(al < 0.85, al * np.minimum(1, fall + (al > 0.6)), al)
    a[..., 3] = al * 255
    im = Image.fromarray(a.astype(np.uint8), 'RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    box = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(W, bb[2] + pad), min(H, bb[3] + pad))
    return im.crop(box), box, (W, H)


KINDS = ['ebony', 'birch', 'steel', 'ice', 'stone', 'marble', 'ship', 'mahogany', 'sand', 'rust', 'bark', 'black']


def main():
    what = sys.argv[1:] or ['frame', 'frames', 'mat', 'props']
    if 'frame' in what:
        png = os.path.join(TMP, 'frame.png'); blender('frame.py', '--o', png, '--s', '48')
        Image.open(png).save(os.path.join(OUT, 'frame.webp'), 'WEBP', quality=88, method=6, alpha_quality=95); print('frame.webp')
    if 'frames' in what:                      # рамы под локации: frame-<вид>.webp (виды — FRAMES в mats.py)
        i = what.index('frames'); kinds = what[i + 1].split(',') if len(what) > i + 1 and what[i + 1] not in ('frame', 'mat', 'props') else KINDS
        for k in kinds:
            png = os.path.join(TMP, f'frame-{k}.png'); blender('frame.py', '--o', png, '--s', '40', '--kind', k)
            Image.open(png).save(os.path.join(OUT, f'frame-{k}.webp'), 'WEBP', quality=88, method=6, alpha_quality=95); print(f'frame-{k}.webp', flush=True)
    if 'mat' in what:
        emboss(); png = os.path.join(TMP, 'mat.png'); blender('mat.py', '--o', png, '--s', '32', '--w', '2400')
        im = Image.open(png).convert('RGB')
        im.save(os.path.join(OUT, 'mat.webp'), 'WEBP', quality=92, method=6)
        im.resize((1200, 675), Image.LANCZOS).save(os.path.join(OUT, 'mat-1200.webp'), 'WEBP', quality=92, method=6); print('mat.webp')
    if 'props' in what:
        i = what.index('props'); names = what[i + 1] if len(what) > i + 1 else None
        out = blender('props.py', '--o', TMP, '--s', '40', '--r', '512', *(['--n', names] if names else []))
        marks = {m[0]: eval(m[1]) for m in re.findall(r"MARKS (\w+) (\[.*\])", out)}
        for n in re.findall(r"prop (\w+)", out):
            im, box, (W, H) = trim(os.path.join(TMP, n + '.png'))
            im.save(os.path.join(OUT, n + '.webp'), 'WEBP', quality=86, method=6, alpha_quality=95)
            if n in marks:
                rel = [[round((x * W - box[0]) / im.width, 3), round((y * H - box[1]) / im.height, 3)] for x, y in marks[n]]
                print(f'{n}: фитили {rel}')
            print(n, im.size)


if __name__ == '__main__':
    main()
