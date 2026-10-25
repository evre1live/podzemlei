#!/usr/bin/env python3
"""Нарезка рисунков для карт «Под Землёй».

  python3 art/cut.py sheet <картинка> <номер листа>   — лист из ChatGPT: сетка 3×2, порядок панелей — art/sheets.json
  python3 art/cut.py one <картинка> <id карты>         — отдельная картинка для одной карты (или back_door, back_treasure)
  python3 art/cut.py index                             — пересобрать список карт с рисунками (public/card-art.js)

Рисунки ложатся в public/cards/v1/<id>.webp (длинная сторона до 460 px).
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'cards', 'v1')
MAXSIDE = 460


def save(img, cid):
    os.makedirs(OUT, exist_ok=True)
    img = img.convert('RGB')
    s = MAXSIDE / max(img.size)
    if s < 1:
        img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    path = os.path.join(OUT, cid + '.webp')
    img.save(path, 'WEBP', quality=80, method=6)
    print(f'  {cid}: {img.width}×{img.height}, {os.path.getsize(path) // 1024} КБ')


def gutters(profile, n, size):
    """Найти n-1 тёмных щелей между панелями: ищем самые тёмные полосы около равных долей."""
    cuts = []
    for k in range(1, n):
        c = round(size * k / n)
        lo, hi = max(0, c - size // (3 * n)), min(size, c + size // (3 * n))
        win = profile[lo:hi]
        dark = win < (win.min() + 12)
        idx = np.where(dark)[0]
        # середина самого длинного тёмного участка
        best, cur = (0, 0, 0), None
        for i in idx:
            if cur and i == cur[1] + 1: cur = (cur[0], i)
            else: cur = (i, i)
            if cur[1] - cur[0] >= best[1] - best[0]: best = (cur[0], cur[1], 0)
        cuts.append((lo + best[0], lo + best[1]))
    return cuts


def split_grid(img, cols=3, rows=2, inset=0.02):
    g = np.asarray(img.convert('L')).astype(float)
    h, w = g.shape
    cx = gutters(g.mean(0), cols, w)
    cy = gutters(g.mean(1), rows, h)
    xs = [0] + [b for a, b in cx], [a for a, b in cx] + [w]
    ys = [0] + [b for a, b in cy], [a for a, b in cy] + [h]
    boxes = []
    for r in range(rows):
        for c in range(cols):
            x0, x1 = xs[0][c], xs[1][c]
            y0, y1 = ys[0][r], ys[1][r]
            dx, dy = round((x1 - x0) * inset), round((y1 - y0) * inset)
            boxes.append((x0 + dx, y0 + dy, x1 - dx, y1 - dy))
    return boxes


def index():
    """Список рисунков с коротким отпечатком файла: браузер держит картинки в кэше месяц, а новая версия рисунка получает новый адрес."""
    import hashlib
    ids = sorted(f[:-5] for f in os.listdir(OUT) if f.endswith('.webp')) if os.path.isdir(OUT) else []
    rows = [(i, hashlib.md5(open(os.path.join(OUT, i + '.webp'), 'rb').read()).hexdigest()[:8]) for i in ids]
    with open(os.path.join(ROOT, 'public', 'card-art.js'), 'w') as f:
        f.write('// Карты, у которых есть живописный рисунок в /cards/v1, и отпечаток файла для кэша (файл обновляет art/cut.py)\n')
        f.write('export const CARD_IMG = new Map([\n')
        for i in range(0, len(rows), 6):
            f.write('  ' + ', '.join(f"['{a}', '{b}']" for a, b in rows[i:i + 6]) + ',\n')
        f.write(']);\n')
    print(f'card-art.js: {len(ids)} рисунков')


def main():
    if len(sys.argv) < 2: print(__doc__); return
    cmd = sys.argv[1]
    if cmd == 'sheet':
        img = Image.open(sys.argv[2]); n = int(sys.argv[3])
        sheets = json.load(open(os.path.join(ROOT, 'art', 'sheets.json')))['sheets']
        ids = next(s['ids'] for s in sheets if s['n'] == n)
        cols, rows = 3, 2
        for cid, box in zip(ids, split_grid(img, cols, rows)):
            save(img.crop(box), cid)
        index()
    elif cmd == 'one':
        save(Image.open(sys.argv[2]), sys.argv[3]); index()
    elif cmd == 'index':
        index()
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
