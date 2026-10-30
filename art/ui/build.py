#!/usr/bin/env python3
"""«Интерфейс из предметов» «Под Землёй»: текстуры и рендеры для кнопок, шапки, свитка летописи и прилавка рынка.

  python3 art/ui/build.py            — всё: textures.py (numpy), затем objects.py (Blender), затем сборка webp

Результат — public/ui/obj/v1:
  parchment.webp       пергамент свитка и ценников (бесшовный, 512 px)
  plank.webp           полка прилавка (бесшовная по горизонтали); boards.webp — задняя стенка лавки; awning.webp — навес
  plate-<вид>.webp     кованые таблички кнопок для border-image (срез 36 px): iron, brass, danger, hero и ghost —
                       железная оправа с полупрозрачной серединой (собирается здесь из iron). Рант и заклёпки — из
                       рендера, середина — ровный металл со шлифовкой (face): на ней читается текст, растяжение не видно
  beam.webp            дубовая балка шапки с коваными хомутами (срез 180 px с торцов)
  roller.webp          валик свитка: пергамент на оси, латунные навершия (срез 120 px с торцов)
  tavern-table.webp    стол лобби-таверны сверху (art/ui/tavern.py): доски, гвозди, потёртости, круги от кружек
  chair.webp           стул сверху, спинкой вниз кадра — на странице стулья расставляют вокруг стола и поворачивают
Blender — модулем Python (pip install bpy; bpy 5.x, Python 3.13), путь к интерпретатору — BLENDER_PY.
"""
import os, sys, subprocess
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'public', 'ui', 'obj', 'v1')
TMP = os.path.expanduser('~/.cache/podzemlei/ui')
PY = os.environ.get('BLENDER_PY', sys.executable)


# середина табличек: ровный полированный металл со шлифовкой поперёк — текст читается, растяжение по ширине не заметно
FACE = {
    'iron':   ((60, 55, 50), (33, 30, 27)),
    'brass':  ((236, 204, 138), (168, 122, 56)),
    'danger': ((156, 44, 30), (96, 22, 14)),
    'hero':   ((54, 124, 99), (29, 78, 62)),
}


def plate_sdf(W, H):
    y, x = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    hw, hh, r = 176, 56, 16                                  # табличка 3.52×1.12 при 100 px на единицу, скругление 0.16
    qx, qy = np.abs(x - W / 2) - (hw - r), np.abs(y - H / 2) - (hh - r)
    return x, y, np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r


def rivets(x, y, W, H):
    rv = np.zeros_like(x)
    for sx in (-1, 1):
        for sy in (-1, 1):
            rv = np.maximum(rv, np.clip(1 - (np.hypot(x - (W / 2 + sx * 162), y - (H / 2 + sy * 42)) - 9) / 3, 0, 1))
    return rv


def face(src, kind):
    """заменяет пятнистую середину отрендеренной таблички ровной: свет сверху вниз, шлифовка, тень от ранта"""
    a = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
    H, W = a.shape[:2]; x, y, sdf = plate_sdf(W, H)
    top, bot = (np.array(c, np.float32) for c in FACE[kind])
    v = np.clip((y - 14) / (H - 28), 0, 1)[..., None]
    col = top * (1 - v) + bot * v
    rng = np.random.default_rng(7)
    rows = np.convolve(rng.normal(0, 1, H + 8), np.ones(3) / 3, 'same')[4:H + 4]   # шлифовка: свои полосы по каждой строке
    col = col * (1 + 0.035 * rows[:, None, None] + 0.012 * rng.normal(0, 1, (H, W, 1)))
    d = -sdf                                                 # глубина от края таблички
    inner = np.clip((d - 10) / 5, 0, 1)                      # где середина, а где рант
    shade = 1 - 0.28 * np.exp(-((d - 10) / 3.5) ** 2) * (y > H / 2) - 0.12 * np.exp(-((d - 10) / 3) ** 2)
    hi = 0.22 * np.exp(-((d - 11) / 2.2) ** 2) * (y < H / 2)  # блик по верхней кромке
    col = col * shade[..., None] + 255 * hi[..., None]
    t = (inner * (1 - rivets(x, y, W, H)))[..., None]
    a[..., :3] = a[..., :3] * (1 - t) + np.clip(col, 0, 255) * t
    return a


def ghost(src, dst):
    """железная оправа: середина таблички полупрозрачная и темнее, рант и заклёпки — как есть"""
    a = face(src, 'iron')
    H, W = a.shape[:2]; x, y, sdf = plate_sdf(W, H)
    t = np.clip((-sdf - 11) / 3, 0, 1) * (1 - rivets(x, y, W, H))   # 0 — рант и заклёпки, 1 — середина
    a[..., :3] *= (1 - 0.45 * t)[..., None]
    a[..., 3] *= 1 - 0.62 * t
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(dst, 'WEBP', quality=90, alpha_quality=95, method=6)


def fade(a, k=0.12):
    """тень от площадного света не должна упираться в край кадра: гасим альфу у краёв"""
    H, W = a.shape[:2]; y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.minimum(np.minimum(x, W - 1 - x) / (W * k), np.minimum(y, H - 1 - y) / (H * k))
    a[..., 3] *= np.clip(d, 0, 1) ** 1.5
    return a


def tavern(src, dst):
    """столешница: грязь и затёртости пятнами, к краю темнее, круги от кружек, царапины ножом"""
    sys.path.insert(0, HERE); from textures import fbm
    a = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
    H, W = a.shape[:2]; y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    top = a[..., 3] > 250                                     # сама столешница (тень полупрозрачная)
    grime = 0.8 + 0.32 * fbm(W, H, 5, 4, 5, 91)
    e = np.hypot((x - W / 2) / 720, (y - H / 2) / 450)          # 1 — край овала
    rim = 1 - 0.28 * np.clip((e - 0.72) / 0.28, 0, 1) ** 1.5
    L = grime * rim
    rng = np.random.default_rng(5)
    for cx, cy, r in [(560, 420, 40), (1140, 700, 38), (980, 330, 36), (640, 760, 37)]:
        d = np.hypot(x - cx, y - cy) - r + 3 * np.sin(np.arctan2(y - cy, x - cx) * 3 + cx)
        L *= 1 - 0.22 * np.exp(-(d / 3.2) ** 2) - 0.06 * (d < 0)
    for _ in range(14):                                       # царапины: тонкие светлые штрихи
        cx, cy = rng.uniform(400, 1300), rng.uniform(260, 880); ang = rng.uniform(0, np.pi); ln = rng.uniform(30, 110)
        u = (x - cx) * np.cos(ang) + (y - cy) * np.sin(ang); v = -(x - cx) * np.sin(ang) + (y - cy) * np.cos(ang)
        L *= 1 + 0.35 * np.exp(-(v / 0.9) ** 2) * (np.abs(u) < ln)
    a[..., :3] = np.where(top[..., None], a[..., :3] * L[..., None], a[..., :3])
    a = fade(a)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(dst, 'WEBP', quality=86, alpha_quality=92, method=6)


def main():
    os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    subprocess.run([sys.executable, os.path.join(HERE, 'textures.py')], check=True)
    r = subprocess.run([PY, os.path.join(HERE, 'objects.py'), '--o', TMP, '--s', '48', '--parch', os.path.join(TMP, 'parchment.png')], capture_output=True, text=True)
    if r.returncode: print(r.stdout[-2000:], r.stderr[-2000:]); raise SystemExit('objects.py: ошибка')
    r = subprocess.run([PY, os.path.join(HERE, 'tavern.py'), '--o', TMP, '--s', '40'], capture_output=True, text=True)
    if r.returncode: print(r.stdout[-2000:], r.stderr[-2000:]); raise SystemExit('tavern.py: ошибка')
    tavern(os.path.join(TMP, 'tavern-table.png'), os.path.join(OUT, 'tavern-table.webp'))
    c = fade(np.asarray(Image.open(os.path.join(TMP, 'chair.png')).convert('RGBA')).astype(np.float32), 0.15)
    Image.fromarray(c.astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'chair.webp'), 'WEBP', quality=88, alpha_quality=92, method=6)
    for n in ['iron', 'brass', 'danger', 'hero']:
        Image.fromarray(face(os.path.join(TMP, f'plate-{n}.png'), n).astype(np.uint8), 'RGBA').save(os.path.join(OUT, f'plate-{n}.webp'), 'WEBP', quality=90, alpha_quality=95, method=6)
    for n in ['beam', 'roller']:
        Image.open(os.path.join(TMP, n + '.png')).save(os.path.join(OUT, n + '.webp'), 'WEBP', quality=88, alpha_quality=95, method=6)
    ghost(os.path.join(TMP, 'plate-iron.png'), os.path.join(OUT, 'plate-ghost.webp'))
    for n in sorted(os.listdir(OUT)): print(n, os.path.getsize(os.path.join(OUT, n)) // 1024, 'КБ')


if __name__ == '__main__':
    main()
