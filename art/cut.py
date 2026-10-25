#!/usr/bin/env python3
"""Нарезка рисунков для карт «Под Землёй».

  python3 art/cut.py sheet <картинка> <номер листа>   — лист из ChatGPT: сетка 3×2, порядок панелей — art/sheets.json
  python3 art/cut.py one <картинка> <id карты>         — отдельная картинка для одной карты (или back_door, back_treasure)
  python3 art/cut.py index                             — пересобрать список карт с рисунками (public/card-art.js)
  python3 art/cut.py avatars <картинка> <номер листа>  — лист портретов или рамок, порядок — art/portraits.json
  python3 art/cut.py avindex                           — пересобрать список портретов и рамок (public/avatar-art.js)
  python3 art/cut.py thumbs                            — пересобрать маленькие портреты для каталога (public/avatars/v1/t)

Рисунки ложатся в public/cards/v1/<id>.webp (длинная сторона до 460 px).
Портреты — в public/avatars/v1/<id>.webp (квадрат 360 px) и уменьшенные для каталога в t/<id>.webp (192 px),
рамки — туда же, кольцо с прозрачностью (400 px).
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


AVOUT = os.path.join(ROOT, 'public', 'avatars', 'v1')
PORTRAIT = 360
THUMB = 192
FRAME = 400


def save_thumb(img, pid):
    os.makedirs(os.path.join(AVOUT, 't'), exist_ok=True)
    img.convert('RGB').resize((THUMB, THUMB), Image.LANCZOS).save(os.path.join(AVOUT, 't', pid + '.webp'), 'WEBP', quality=78, method=6)


def thumbs():
    for f in sorted(os.listdir(AVOUT)):
        if f.startswith('p_') and f.endswith('.webp'):
            save_thumb(Image.open(os.path.join(AVOUT, f)), f[:-5])
    print('уменьшенные портреты готовы')


def save_portrait(img, pid):
    """Квадрат по центру панели: лицо по заданию стоит в середине, круг вырежет игра."""
    os.makedirs(AVOUT, exist_ok=True)
    w, h = img.size
    side = min(w, h)
    img = img.crop(((w - side) // 2, (h - side) // 2, (w - side) // 2 + side, (h - side) // 2 + side)).convert('RGB')
    img = img.resize((PORTRAIT, PORTRAIT), Image.LANCZOS)
    path = os.path.join(AVOUT, pid + '.webp')
    img.save(path, 'WEBP', quality=82, method=6)
    save_thumb(img, pid)
    print(f'  {pid}: {os.path.getsize(path) // 1024} КБ')


def save_frame(img, fid):
    """Кольцо на чёрном: находим центр, внешний и внутренний радиус, вырезаем квадрат по внешнему краю.
    Внутри полосы кольца — непрозрачно, снаружи и в проёме прозрачность по яркости (сохраняет выступы и мягкий край)."""
    os.makedirs(AVOUT, exist_ok=True)
    rgb = np.asarray(img.convert('RGB')).astype(float)
    v = rgb.max(2)
    mask = v > 28
    ys, xs = np.nonzero(mask)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    yy, xx = np.mgrid[0:v.shape[0], 0:v.shape[1]]
    r = np.hypot(xx - cx, yy - cy)
    # радиальный профиль: доля непустых пикселей на каждом радиусе
    rr = r[mask].astype(int)
    total = np.bincount(r.astype(int).ravel())
    filled = np.bincount(rr, minlength=len(total)) / np.maximum(total, 1)
    band = np.nonzero(filled > 0.6)[0]
    r_in, r_out = band.min(), band.max()
    key = np.clip((v - 10) / 30, 0, 1)
    solid = (r >= r_in + 2) & (r <= r_out - 2)
    # в полосе кольца непрозрачно всё, кроме совсем чёрного (тень и фон на краях неровного кольца)
    alpha = np.where(solid, np.clip((v - 3) / 9, 0, 1), key)
    alpha[r < r_in * 0.55] = 0  # центр проёма всегда прозрачный
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    R = r_out + 2
    box = (int(round(cx - R)), int(round(cy - R)), int(round(cx + R)), int(round(cy + R)))
    out = Image.fromarray(rgba, 'RGBA').crop(box).resize((FRAME, FRAME), Image.LANCZOS)
    path = os.path.join(AVOUT, fid + '.webp')
    out.save(path, 'WEBP', quality=86, method=6)
    inner = round(float(r_in) / R, 3)
    print(f'  {fid}: проём {inner}, {os.path.getsize(path) // 1024} КБ')
    return inner


def avindex():
    """Список портретов и рамок с отпечатками файлов, подписями образов и шириной проёма рамок."""
    import hashlib
    meta = json.load(open(os.path.join(ROOT, 'art', 'portraits.json')))
    inner_path = os.path.join(ROOT, 'art', 'frames-inner.json')
    inner = json.load(open(inner_path)) if os.path.exists(inner_path) else {}
    have = {f[:-5] for f in os.listdir(AVOUT) if f.endswith('.webp')} if os.path.isdir(AVOUT) else set()
    h = lambda i: hashlib.md5(open(os.path.join(AVOUT, i + '.webp'), 'rb').read()).hexdigest()[:8]
    notes = {i: n for s in meta['sheets'] for i, n in zip(s['ids'], s['notes'])}
    frames = [i for s in meta['sheets'] for i in s['ids'] if i.startswith('frame_')]
    with open(os.path.join(ROOT, 'public', 'avatar-art.js'), 'w') as f:
        f.write('// Портреты героев и рамки медальона в /avatars/v1 (файл обновляет art/cut.py avindex)\n')
        f.write('// PORTRAITS: id → [отпечаток файла, подпись]; FRAMES: по порядку, [id, отпечаток, название, доля проёма]\n')
        f.write(f"export const ROLES = {json.dumps(meta['roles'], ensure_ascii=False)};\n")
        f.write('export const PORTRAITS = new Map([\n')
        for i in sorted(x for x in have if x.startswith('p_')):
            f.write(f"  ['{i}', ['{h(i)}', {json.dumps(notes.get(i, ''), ensure_ascii=False)}]],\n")
        f.write(']);\nexport const FRAMES = [\n')
        for i in frames:
            if i in have: f.write(f"  ['{i}', '{h(i)}', {json.dumps(notes[i], ensure_ascii=False)}, {inner.get(i, 0.8)}],\n")
        f.write('];\n')
    print(f'avatar-art.js: {sum(1 for x in have if x.startswith("p_"))} портретов, {sum(1 for x in frames if x in have)} рамок')


def avatars(img, n):
    meta = json.load(open(os.path.join(ROOT, 'art', 'portraits.json')))
    ids = next(s['ids'] for s in meta['sheets'] if s['n'] == n)
    inner_path = os.path.join(ROOT, 'art', 'frames-inner.json')
    inner = json.load(open(inner_path)) if os.path.exists(inner_path) else {}
    for pid, box in zip(ids, split_grid(img, 3, 2, inset=0 if ids[0].startswith('frame_') else 0.02)):
        if pid.startswith('frame_'): inner[pid] = save_frame(img.crop(box), pid)
        else: save_portrait(img.crop(box), pid)
    if inner: json.dump(inner, open(inner_path, 'w'), indent=1)
    avindex()


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
    elif cmd == 'avatars':
        avatars(Image.open(sys.argv[2]), int(sys.argv[3]))
    elif cmd == 'avindex':
        avindex()
    elif cmd == 'thumbs':
        thumbs()
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
