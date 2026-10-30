#!/usr/bin/env python3
"""«Интерфейс из предметов» «Под Землёй»: текстуры и рендеры для кнопок, шапки, свитка летописи и прилавка рынка.

  python3 art/ui/build.py            — всё: textures.py (numpy), затем objects.py (Blender), затем сборка webp

Результат — public/ui/obj/v1:
  parchment.webp       пергамент свитка и ценников (бесшовный, 512 px)
  plank.webp           полка прилавка (бесшовная по горизонтали); boards.webp — задняя стенка лавки; awning.webp — навес
  plate-<вид>.webp     кованые таблички кнопок для border-image (срез 36 px): iron, brass, danger, hero и ghost —
                       железная оправа с полупрозрачной серединой (собирается здесь из iron)
  beam.webp            дубовая балка шапки с коваными хомутами (срез 180 px с торцов)
  roller.webp          валик свитка: пергамент на оси, латунные навершия (срез 120 px с торцов)
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


def ghost(src, dst):
    """железная оправа: середина таблички полупрозрачная и темнее, рант и заклёпки — как есть"""
    a = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
    H, W = a.shape[:2]; y, x = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    hw, hh, r = 176, 56, 16                                  # табличка 3.52×1.12 при 100 px на единицу, скругление 0.16
    qx, qy = np.abs(x - W / 2) - (hw - r), np.abs(y - H / 2) - (hh - r)
    sdf = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
    t = np.clip((-sdf - 11) / 3, 0, 1)                       # 0 — рант, 1 — середина
    rv = np.zeros_like(t)                                    # заклёпки не трогаем
    for sx in (-1, 1):
        for sy in (-1, 1):
            rv = np.maximum(rv, np.clip(1 - (np.hypot(x - (W / 2 + sx * 162), y - (H / 2 + sy * 42)) - 9) / 3, 0, 1))
    t = t * (1 - rv)
    a[..., :3] *= (1 - 0.45 * t)[..., None]
    a[..., 3] *= 1 - 0.62 * t
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(dst, 'WEBP', quality=90, alpha_quality=95, method=6)


def main():
    os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    subprocess.run([sys.executable, os.path.join(HERE, 'textures.py')], check=True)
    r = subprocess.run([PY, os.path.join(HERE, 'objects.py'), '--o', TMP, '--s', '48', '--parch', os.path.join(TMP, 'parchment.png')], capture_output=True, text=True)
    if r.returncode: print(r.stdout[-2000:], r.stderr[-2000:]); raise SystemExit('objects.py: ошибка')
    for n in ['plate-iron', 'plate-brass', 'plate-danger', 'plate-hero', 'beam', 'roller']:
        Image.open(os.path.join(TMP, n + '.png')).save(os.path.join(OUT, n + '.webp'), 'WEBP', quality=88, alpha_quality=95, method=6)
    ghost(os.path.join(TMP, 'plate-iron.png'), os.path.join(OUT, 'plate-ghost.webp'))
    for n in sorted(os.listdir(OUT)): print(n, os.path.getsize(os.path.join(OUT, n)) // 1024, 'КБ')


if __name__ == '__main__':
    main()
