#!/usr/bin/env python3
"""Руки игрока для вида от первого лица: картинки из ChatGPT → public/ui/hands/v1 и public/art-hands.js.

  python3 art/gen/import-hands.py <папка с hand-<раса>-<left|right>.png> [раса ...]

Промты — art/gen/hands-prompts.txt (1024×1024, прозрачный фон; если фон пурпурный #FF00FF — вырезается здесь).

В игре рука рисуется двумя слоями: вся кисть лежит ПОД картами руки, большой палец — ПОВЕРХ них, поэтому карта
зажата между большим пальцем и остальными. Для каждой картинки в MARKS размечено (в пикселях исходника, на глаз
по сетке — art/gen/hands-grid.py):
  anchor — точка под основанием большого пальца, через неё проходит наружный край крайней карты;
  cut    — ломаная от ложбинки между большим и указательным пальцами вглубь кисти: граница «большой палец / остальная
           кисть». Всё по сторону большого пальца от неё уходит в верхний слой;
  tip    — кончик большого пальца (по нему понятно, с какой стороны от ломаной палец);
  scale  — поправка размера, если рука в кадре вышла крупнее или мельче остальных (1 — как у образца).
Размер кисти по расе (орк крупнее, полурослик мельче) — RACE_K.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'ui', 'hands', 'v1')
JS = os.path.join(ROOT, 'public', 'art-hands.js')
VER = 1
RACES = ['human', 'elf', 'dwarf', 'halfling', 'orc', 'goblin', 'mole']
PX_PER_CARD = 353      # столько пикселей исходника приходится на ширину карты в руке (как в «Диком Западе»)
SHRINK = 420 / 694     # сжатие исходника: на экране рука ~220 px, запас на ретину

# у кого кисть крупнее, у кого мельче (все нарисованы во весь кадр — размер задаём здесь)
RACE_K = {'human': 1, 'elf': 0.97, 'dwarf': 1.03, 'halfling': 0.88, 'orc': 1.12, 'goblin': 0.93, 'mole': 1.04}

MARKS = {
    'human-left': {'anchor': (525, 537), 'cut': [(572, 532), (548, 547), (524, 564), (508, 584), (500, 610), (492, 650)], 'tip': (622, 362)},
    'human-right': {'anchor': (465, 510), 'cut': [(399, 502), (428, 513), (452, 527), (470, 547), (486, 574), (498, 602), (506, 635)], 'tip': (385, 360)},
    'elf-left': {'anchor': (510, 510), 'cut': [(556, 505), (536, 519), (516, 535), (499, 552), (486, 572), (478, 600)], 'tip': (640, 350)},
    'elf-right': {'anchor': (470, 503), 'cut': [(417, 498), (438, 510), (458, 527), (476, 550), (491, 578), (504, 610), (515, 645)], 'tip': (365, 355)},
    'dwarf-left': {'anchor': (525, 515), 'cut': [(587, 510), (562, 526), (540, 542), (520, 560), (507, 578), (500, 604), (497, 640)], 'tip': (640, 360)},
    'dwarf-right': {'anchor': (465, 505), 'cut': [(393, 497), (417, 510), (438, 525), (454, 543), (467, 566), (478, 592), (486, 625)], 'tip': (370, 360)},
    'halfling-left': {'anchor': (517, 524), 'cut': [(572, 520), (552, 534), (533, 548), (516, 562), (504, 579), (497, 602), (494, 635)], 'tip': (630, 370)},
    'halfling-right': {'anchor': (465, 510), 'cut': [(398, 505), (417, 515), (436, 528), (453, 544), (467, 563), (478, 588), (487, 620)], 'tip': (375, 370)},
    'orc-left': {'anchor': (515, 523), 'cut': [(577, 518), (556, 531), (537, 545), (520, 558), (508, 574), (502, 596), (499, 630)], 'tip': (630, 360)},
    'orc-right': {'anchor': (468, 503), 'cut': [(398, 497), (417, 509), (436, 522), (453, 538), (467, 557), (479, 582), (489, 612)], 'tip': (375, 355)},
    'goblin-left': {'anchor': (519, 521), 'cut': [(573, 517), (553, 528), (533, 541), (514, 554), (498, 568), (487, 585), (480, 610), (476, 640)], 'tip': (640, 350)},
    'goblin-right': {'anchor': (475, 511), 'cut': [(418, 507), (437, 518), (456, 532), (473, 548), (488, 567), (499, 592), (508, 625)], 'tip': (360, 350)},
    'mole-left': {'anchor': (538, 528), 'cut': [(595, 524), (576, 534), (557, 546), (540, 557), (525, 571), (515, 592), (510, 620)], 'tip': (650, 365)},
    'mole-right': {'anchor': (464, 524), 'cut': [(400, 520), (418, 530), (437, 542), (453, 555), (466, 572), (475, 595), (481, 625)], 'tip': (365, 365)},
}


def load(path):
    """Картинка с прозрачным фоном. Сплошной фон (пурпурный ключ) вырезается по цвету, кайма гасится."""
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im, dtype=np.float32)
    if a[..., 3].min() > 250:
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        key = np.clip((np.minimum(r, b) - g) / 255.0, 0, 1)          # насколько точка «пурпурная»
        alpha = np.clip(1.0 - (key - 0.18) / 0.3, 0, 1)
        spill = np.clip(np.minimum(r, b) - g, 0, None) * (alpha < 1)  # пурпурную кайму приводим к серой
        a[..., 0] -= spill * 0.85
        a[..., 2] -= spill * 0.85
        a[..., 3] = alpha * 255
    else:
        # у картинок из ChatGPT плотные места имеют альфу 252–253, а по пустому фону разбросаны еле видные точки:
        # плотное делаем плотным, слабое убираем
        a[..., 3] = np.clip((a[..., 3] - 8) / 240, 0, 1) * 255
    al = a[..., 3]
    try:
        import cv2
        n, lab, st, _ = cv2.connectedComponentsWithStats((al > 24).astype(np.uint8), connectivity=8)
        small = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] < al.size * 0.002])
        al[small] = 0                                    # островки мусора вдали от руки
    except ImportError:
        pass
    a[..., 3] = al
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def fade_edges(im, src_size, box, frac=0.14):
    """Рукав упирается в рамку исходника — там край гасим, чтобы на экране он не обрывался по линейке."""
    a = np.asarray(im.getchannel('A'), dtype=np.float32).copy()
    h, w = a.shape
    x0, y0, x1, y1 = box
    n = max(4, int(w * frac))
    ramp = np.linspace(0, 1, n, dtype=np.float32)
    if x0 <= 2 and a[:, :3].max() > 40:
        a[:, :n] *= ramp[None, :]
    if x1 >= src_size[0] - 2 and a[:, -3:].max() > 40:
        a[:, w - n:] *= ramp[::-1][None, :]
    if y1 >= src_size[1] - 2 and a[-3:, :].max() > 40:
        m = max(4, int(h * 0.12))
        a[h - m:, :] *= np.linspace(1, 0, m, dtype=np.float32)[:, None]
    im.putalpha(Image.fromarray(a.clip(0, 255).astype(np.uint8)))
    return im


def thumb_mask(size, cut, tip):
    """Маска большого пальца: всё по его сторону от ломаной cut (ломаная продлена лучами в обе стороны)."""
    pts = [np.array(p, dtype=np.float64) for p in cut]
    far = 4000.0
    d0 = pts[0] - pts[1]
    d0 /= np.linalg.norm(d0)
    d1 = pts[-1] - pts[-2]
    d1 /= np.linalg.norm(d1)
    a, b = pts[0] + d0 * far, pts[-1] + d1 * far
    # с какой стороны от первого отрезка лежит кончик пальца
    seg = pts[1] - pts[0]
    nrm = np.array([-seg[1], seg[0]])
    nrm /= np.linalg.norm(nrm)
    if np.dot(np.array(tip, dtype=np.float64) - pts[0], nrm) < 0:
        nrm = -nrm
    poly = [a] + pts + [b, b + nrm * far, a + nrm * far]
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255)
    return m.filter(ImageFilter.GaussianBlur(1.4))


def save(img, path, q=86):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'WEBP', quality=q, method=6, alpha_quality=92)
    return os.path.getsize(path)


def build(src_dir, key):
    race, side = key.rsplit('-', 1)
    path = os.path.join(src_dir, f'hand-{race}-{side}.png')
    mk = MARKS.get(key)
    if not os.path.exists(path):
        return None
    if not mk:
        print(f'  {key}: картинка есть, разметки нет — добавьте anchor, cut и tip в MARKS')
        return None
    im = load(path)
    W, H = im.size
    alpha = np.asarray(im.getchannel('A'))
    ys, xs = np.where(alpha > 10)
    pad = 6
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(W, xs.max() + pad + 1), min(H, ys.max() + pad + 1))
    # верхний слой: большой палец и его тень на карте (тень падает от лампы над серединой стола — вниз и наружу)
    sgn = 1 if side == 'left' else -1               # у левой руки карта справа от якоря
    xx = np.arange(W, dtype=np.float32)[None, :]
    # палец нужен в верхнем слое только там, где под ним может оказаться карта: по её сторону от якоря (с запасом на
    # наклон карты). Дальше от карты слои совпадали бы точка в точку — там хватает нижнего
    near = ((xx - mk['anchor'][0]) * sgn > -40).astype(np.float32)
    mask = thumb_mask((W, H), mk['cut'], mk['tip'])
    th_a = Image.fromarray((np.asarray(alpha, dtype=np.float32) * np.asarray(mask, dtype=np.float32) / 255 * near).astype(np.uint8))
    thumb = im.copy()
    thumb.putalpha(th_a)
    sh = th_a.filter(ImageFilter.GaussianBlur(11))
    sh = Image.fromarray((np.asarray(sh, dtype=np.float32) * 0.6).astype(np.uint8))
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    shadow.paste(Image.new('RGBA', (W, H), (8, 4, 2, 255)), (-sgn * 5, 13), sh)
    # тень нужна только на карте: по ту сторону её края, что и середина веера
    side_k = np.clip(((xx - mk['anchor'][0]) * sgn + 6) / 12, 0, 1)
    sa = np.asarray(shadow.getchannel('A'), dtype=np.float32) * side_k
    shadow.putalpha(Image.fromarray(sa.astype(np.uint8)))
    top = Image.alpha_composite(shadow, thumb)

    scale = mk.get('scale', 1) * RACE_K.get(race, 1)
    k = SHRINK * mk.get('scale', 1)
    out = []
    for layer, suffix in ((im, ''), (top, '-t')):
        c = layer.crop(box)
        if not suffix:
            c = fade_edges(c, (W, H), box)
        c = c.resize((round(c.width * k), round(c.height * k)), Image.LANCZOS)
        out.append(save(c, os.path.join(OUT, f'{race}-{side[0]}{suffix}.webp')))
    bw, bh = box[2] - box[0], box[3] - box[1]
    return {
        'w': round(bw * k), 'h': round(bh * k),
        'ax': round((mk['anchor'][0] - box[0]) / bw, 4), 'ay': round((mk['anchor'][1] - box[1]) / bh, 4),
        'k': round(bw * scale / PX_PER_CARD, 3), 'bytes': sum(out),
    }


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    only = set(sys.argv[2:])
    hands, total = {}, 0
    for race in RACES:
        if only and race not in only:
            continue
        pair = {}
        for side in ('left', 'right'):
            r = build(src, f'{race}-{side}')
            if r:
                total += r.pop('bytes')
                pair[side[0]] = r
        if len(pair) == 2:
            hands[race] = pair
            print(f'  {race}: левая {pair["l"]["w"]}×{pair["l"]["h"]}, правая {pair["r"]["w"]}×{pair["r"]["h"]}')
        elif pair:
            print(f'  {race}: нужна пара рук, есть только одна — пропущено')
    lines = ['// Нарисованные руки игрока (вид от первого лица). Файл собирает art/gen/import-hands.py — руками не править.',
             '// На руку: размер картинки, якорь (доля ширины и высоты — через него проходит наружный край крайней карты)',
             '// и k — ширина картинки в ширинах карты. Слои: <раса>-<l|r>.webp — вся кисть, …-t.webp — большой палец с тенью.',
             f'export const HANDS_VER = {VER};', 'export const HANDS = {']
    for race, pair in hands.items():
        fmt = lambda d: '{ ' + ', '.join(f'{k}: {v}' for k, v in d.items()) + ' }'
        lines.append(f"  {race}: {{ l: {fmt(pair['l'])}, r: {fmt(pair['r'])} }},")
    lines += ['};', "export const handSrc = (race, side, top) => `/ui/hands/v1/${race}-${side}${top ? '-t' : ''}.webp?v=${HANDS_VER}`;", '']
    with open(JS, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'рас: {len(hands)}; итого {total / 1024:.0f} КБ → {os.path.relpath(OUT, ROOT)}, {os.path.relpath(JS, ROOT)}')


if __name__ == '__main__':
    main()
