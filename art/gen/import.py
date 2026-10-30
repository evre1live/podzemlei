#!/usr/bin/env python3
"""Импорт картинок, нарисованных ChatGPT по промтам (art/gen/prompts.md), в игру «Под Землёй».

  python3 art/gen/import.py <папка с PNG>

Ждёт имена из промтов: mat-*.png, frame-*.png, предметы (candles.png, …), tavern-table.png, chair.png, mug-top.png,
plate-*.png, beam.png, roller.png, parchment.png, awning.png, plank.png, boards.png. Пишет:
  public/ui/table/v2/  mat-<имя>.webp (1536×1024) и mat-<имя>-1024.webp для телефонов; frame-<вид>.webp — рама,
                       приведённая к 1024×1024 с краем ровно 118 px (border-image 118); предметы — обрезаны по краю
  public/ui/obj/v2/    таблички (высота 160, срез 46 px — заклёпки целиком в углах), plate-ghost (железная оправа
                       с полупрозрачной серединой), балка (срез 150 px с торцов), валик (срез 175 px), пергамент,
                       доски, навес, полка, стол таверны, стул (сиденье — в центре картинки), кружка сверху
Новые папки v2 — чтобы телефоны не показывали картинки из кэша (они кэшируются на 30 дней).
Координаты фитилей свечей и лампы для TABLE_FLAMES (public/app.js) сняты по этим картинкам — при замене пересчитать.
"""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
T2 = os.path.join(ROOT, 'public', 'ui', 'table', 'v2')
O2 = os.path.join(ROOT, 'public', 'ui', 'obj', 'v2')
SRC = sys.argv[1] if len(sys.argv) > 1 else None

MATS = ['default', 'tavern', 'dungeon', 'glade', 'forge', 'ice', 'graveyard', 'sky', 'cove', 'library', 'oasis', 'flooded', 'grove', 'koschei']
DIM = {'cove': 0.85}                       # морская карта светловата для белого текста сцены
FRAMES = ['oak', 'ebony', 'birch', 'steel', 'ice', 'stone', 'marble', 'ship', 'mahogany', 'sand', 'rust', 'bark', 'black']
PROPS = ['candles', 'coins', 'dice', 'goblet', 'dagger', 'potion', 'book', 'scroll', 'mug', 'hammer', 'coals', 'crystals', 'mushrooms', 'keys', 'lamp', 'egg']


def load(n): return Image.open(os.path.join(SRC, n + '.png'))


def bbox(im, pad=0, th=16):
    b = im.getchannel('A').point(lambda v: 255 if v > th else 0).getbbox()
    return (max(0, b[0] - pad), max(0, b[1] - pad), min(im.width, b[2] + pad), min(im.height, b[3] + pad))


def webp(im, path, q=88):
    im.save(path, 'WEBP', quality=q, alpha_quality=95, method=6)
    print(os.path.relpath(path, ROOT), im.size, os.path.getsize(path) // 1024, 'КБ')


def mats():
    for n in MATS:
        im = load(f'mat-{n}').convert('RGB')
        if n in DIM: im = Image.fromarray(np.clip(np.asarray(im).astype(np.float32) * DIM[n], 0, 255).astype(np.uint8))
        webp(im, os.path.join(T2, f'mat-{n}.webp'), 78)
        webp(im.resize((1024, round(1024 * im.height / im.width)), Image.LANCZOS), os.path.join(T2, f'mat-{n}-1024.webp'), 78)


def side(frac):
    """внешний и внутренний край рамы по доле непрозрачных пикселей вдоль линии от края внутрь"""
    o = int(np.argmax(frac > 0.5)); i = o + int(np.argmax(frac[o:] < 0.5)); return o, i


def frames(B=118, S=1024):
    for k in FRAMES:
        im = load(f'frame-{k}').convert('RGBA'); a = np.asarray(im.getchannel('A')) > 128; H, W = a.shape
        rows, cols = slice(int(H * .35), int(H * .65)), slice(int(W * .35), int(W * .65))
        lo, li = side(a[rows, :].mean(0)); ro, ri = side(a[rows, ::-1].mean(0))
        to, ti = side(a[:, cols].mean(1)); bo, bi = side(a[::-1, cols].mean(1))
        x0, x1, y0, y1 = lo, W - ro, to, H - bo
        # уголки бывают шире бруса: идём по диагонали от внешнего угла внутрь, пока непрозрачно
        def diag(cx, cy, dx, dy):
            k = 0
            while 0 <= cy + dy * k < H and 0 <= cx + dx * k < W and a[cy + dy * k, cx + dx * k]: k += 1
            return k
        dg = max(diag(x0 + 2, y0 + 2, 1, 1), diag(x1 - 3, y0 + 2, -1, 1), diag(x0 + 2, y1 - 3, 1, -1), diag(x1 - 3, y1 - 3, -1, -1))
        L, R, Tt, Bb = (max(t, dg) + 3 for t in (li - lo, ri - ro, ti - to, bi - bo))
        sx = [x0, x0 + L, x1 - R, x1]; sy = [y0, y0 + Tt, y1 - Bb, y1]; d = [0, B, S - B, S]
        out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        for j in range(3):
            for i in range(3):
                if i == 1 and j == 1: continue
                piece = im.crop((sx[i], sy[j], sx[i + 1], sy[j + 1])).resize((d[i + 1] - d[i], d[j + 1] - d[j]), Image.LANCZOS)
                out.alpha_composite(piece, (d[i], d[j]))
        print(f'рама {k}: брус L{li - lo} T{ti - to} R{ri - ro} B{bi - bo}, уголок {dg} → срез {L}/{Tt}/{R}/{Bb}')
        webp(out, os.path.join(T2, f'frame-{k}.webp'))


def props():
    for n in PROPS:
        im = load(n).convert('RGBA'); im = im.crop(bbox(im, 8))
        s = min(1, 512 / max(im.size)); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        webp(im, os.path.join(T2, f'{n}.webp'))


def plate(n, h=160):
    im = load(f'plate-{n}').convert('RGBA'); im = im.crop(bbox(im))
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def ghost(iron):
    """железная оправа: середина таблички полупрозрачная и темнее, рант и заклёпки — как есть"""
    a = np.asarray(iron).astype(np.float32); H, W = a.shape[:2]; y, x = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    r, ins = 10, 19
    qx, qy = np.abs(x - W / 2) - (W / 2 - ins - r), np.abs(y - H / 2) - (H / 2 - ins - r)
    sdf = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
    t = np.clip(-sdf / 3, 0, 1)
    for cx in (31, W - 31):
        for cy in (31, H - 31): t *= np.clip((np.hypot(x - cx, y - cy) - 12) / 3, 0, 1)
    a[..., :3] *= (1 - 0.45 * t)[..., None]; a[..., 3] *= 1 - 0.62 * t
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def ui():
    for n in ['iron', 'brass', 'danger', 'hero']:
        p = plate(n); webp(p, os.path.join(O2, f'plate-{n}.webp'), 90)
        if n == 'iron': webp(ghost(p), os.path.join(O2, 'plate-ghost.webp'), 90)
    for n in ['beam', 'roller']:
        im = load(n).convert('RGBA'); webp(im.crop(bbox(im)), os.path.join(O2, f'{n}.webp'))
    for n in ['parchment', 'boards']:
        webp(load(n).convert('RGB').resize((512, 512), Image.LANCZOS), os.path.join(O2, f'{n}.webp'), 86)
    aw = load('awning').convert('RGBA'); b = bbox(aw); aw = aw.crop((b[0] + 3, b[1], b[2] - 3, b[3]))   # по краям тонкая светлая кромка — шов
    webp(aw.resize((round(aw.width * 150 / aw.height), 150), Image.LANCZOS), os.path.join(O2, 'awning.webp'))
    pl = load('plank').convert('RGBA'); pl = pl.crop(bbox(pl))
    webp(pl.resize((round(pl.width * 72 / pl.height), 72), Image.LANCZOS), os.path.join(O2, 'plank.webp'))
    t = load('tavern-table').convert('RGBA'); t = t.crop(bbox(t, 4))
    webp(t.resize((1400, round(1400 * t.height / t.width)), Image.LANCZOS), os.path.join(O2, 'tavern-table.webp'))
    # стул: сиденье — в центре картинки (на него ставится портрет), спинка внизу
    c = load('chair').convert('RGBA'); x0, y0, x1, y1 = bbox(c)
    a = np.asarray(c.getchannel('A'))[:, x0:x1] > 128
    widths = a.sum(1); seat_rows = []
    for yy in range(y0, y1):                                    # первый сплошной кусок сверху — сиденье (ниже — балясины и дуга спинки)
        if widths[yy] > 0.55 * (x1 - x0): seat_rows.append(yy)
        elif seat_rows: break
    sc = (seat_rows[0] + seat_rows[-1]) // 2 if seat_rows else (y0 + y1) // 2
    half = max(sc - y0, y1 - sc) + 4
    can = Image.new('RGBA', (x1 - x0 + 8, 2 * half), (0, 0, 0, 0)); can.alpha_composite(c.crop((x0 - 4, sc - half if sc - half >= 0 else 0, x1 + 4, min(c.height, sc + half))), (0, max(0, half - sc)))
    s = 512 / max(can.size); webp(can.resize((round(can.width * s), round(can.height * s)), Image.LANCZOS), os.path.join(O2, 'chair.webp'))
    m = load('mug-top').convert('RGBA'); m = m.crop(bbox(m, 4))
    webp(m.resize((256, round(256 * m.height / m.width)), Image.LANCZOS), os.path.join(O2, 'mug-top.webp'))


if __name__ == '__main__':
    if not SRC: print(__doc__); sys.exit(1)
    os.makedirs(T2, exist_ok=True); os.makedirs(O2, exist_ok=True)
    mats(); frames(); props(); ui()
