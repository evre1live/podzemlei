#!/usr/bin/env python3
"""Плоские текстуры «интерфейса из предметов»: пергамент свитка, полка и задняя стенка прилавка, полосатый навес.

  python3 art/ui/textures.py   — пишет public/ui/obj/v1/{parchment,plank,boards,awning}.webp

Всё считается периодическим шумом (numpy), поэтому текстуры бесшовно повторяются: пергамент и доски — во все стороны,
полка и навес — по горизонтали. Пергамент нужен и Blender: им обтянут валик свитка (art/ui/objects.py), поэтому
сначала запускается этот скрипт, потом objects.py (так и делает art/ui/build.py).
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'ui', 'obj', 'v1')
TMP = os.path.expanduser('~/.cache/podzemlei/ui'); os.makedirs(TMP, exist_ok=True)
RNG = np.random.default_rng(23)


def noise(W, H, cx, cy, seed=0):
    """периодический value-noise: cx×cy клеток на кадр W×H — бесшовен по обеим осям"""
    lat = np.random.default_rng(seed).random((cy, cx)).astype(np.float32)
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    fx, fy = x / W * cx, y / H * cy
    xi, yi = np.floor(fx).astype(int), np.floor(fy).astype(int)
    u, v = fx - xi, fy - yi; u, v = u * u * (3 - 2 * u), v * v * (3 - 2 * v)
    L = lambda a, b: lat[b % cy, a % cx]
    return (L(xi, yi) * (1 - u) + L(xi + 1, yi) * u) * (1 - v) + (L(xi, yi + 1) * (1 - u) + L(xi + 1, yi + 1) * u) * v


def fbm(W, H, cx, cy, oct=5, seed=0, gain=0.55):
    s, a, n = 0, 1, 0
    for o in range(oct):
        s = s + a * noise(W, H, cx * 2 ** o, cy * 2 ** o, seed + o * 31); n += a; a *= gain
    return s / n


def save(name, arr, q=88):
    os.makedirs(OUT, exist_ok=True)
    a = (np.clip(arr, 0, 1) * 255).astype(np.uint8)
    im = Image.fromarray(a, 'RGBA' if a.shape[2] == 4 else 'RGB')
    p = os.path.join(OUT, name + '.webp'); im.save(p, 'WEBP', quality=q, method=6, alpha_quality=92)
    print(f'{name}: {im.size[0]}×{im.size[1]}, {os.path.getsize(p) // 1024} КБ')
    return im


def parchment(S=512):
    """старый пергамент: тёплая основа, облачные пятна, волокна, редкие тёмные потёки"""
    blot = fbm(S, S, 3, 3, 5, 1)
    fib = fbm(S, S, 4, 72, 3, 7, 0.6)          # волокна — вытянуты по горизонтали
    fine = fbm(S, S, 96, 96, 2, 13)
    stain = np.clip((fbm(S, S, 4, 4, 5, 21) - 0.64) * 3, 0, 1)
    speck = (fbm(S, S, 128, 128, 1, 29) > 0.83) * 0.05
    L = 0.9 + (blot - 0.5) * 0.22 + (fib - 0.5) * 0.08 + (fine - 0.5) * 0.06 - stain * 0.1 - speck
    base = np.array([0.87, 0.77, 0.6], np.float32)
    tint = np.array([0.62, 0.43, 0.24], np.float32)   # потёки и края пятен — в охру
    w = np.clip((0.5 - blot) * 1.2 + stain * 0.8, 0, 1)[..., None] * 0.35
    rgb = (base * (1 - w) + tint * w) * L[..., None]
    im = save('parchment', rgb, 86)
    im.save(os.path.join(TMP, 'parchment.png'))


def plank(W=512, H=72):
    """полка прилавка: верхняя грань, лицевая кромка, тень под ней; бесшовно по горизонтали"""
    grain = fbm(W, H, 2, 24, 5, 41, 0.6)
    rings = np.sin((fbm(W, H, 3, 8, 3, 47) * 9 + np.linspace(0, 1, H)[:, None] * 2) * np.pi * 2) * 0.5 + 0.5
    g = grain * 0.6 + rings * 0.4
    dark, light = np.array([0.16, 0.085, 0.04]), np.array([0.42, 0.24, 0.11])
    rgb = dark + (light - dark) * g[..., None]
    y = np.arange(H)[:, None].astype(np.float32)
    top, face = 14, 46                               # 0..14 — верх (светлее), 14..46 — кромка, ниже — тень
    shade = np.where(y < top, 1.25 - (y / top) * 0.1, np.where(y < face, 0.85 - (y - top) / (face - top) * 0.28, 0.4))
    rgb = rgb * shade[..., None]
    rgb[top - 1:top + 1] *= 0.55                     # ребро между гранями
    rgb[:2] = rgb[:2] * 0.6 + 0.4 * np.array([0.7, 0.5, 0.3])  # блик по переднему краю верха
    a = np.where(y < face, 1.0, np.clip(1 - (y - face) / (H - face), 0, 1) ** 1.6 * 0.7)
    rgb = np.where((y < face)[..., None], rgb, 0.02)
    save('plank', np.dstack([rgb, np.broadcast_to(a, (H, W))]).astype(np.float32))


def boards(S=512, n=4):
    """задняя стенка лавки: вертикальные тёмные доски с щелями"""
    grain = fbm(S, S, 16, 2, 5, 61, 0.6)
    knots = np.clip((fbm(S, S, 6, 6, 3, 67) - 0.66) * 6, 0, 1)
    x = np.arange(S)[None, :] % (S // n)
    seam = np.exp(-((x - 0) / 2.2) ** 2) + np.exp(-((x - S // n) / 2.2) ** 2)
    edge = np.clip(1 - np.minimum(x, S // n - x) / 10, 0, 1)   # края досок темнее, скругление
    board = np.floor(np.arange(S) / (S // n))[None, :]
    var = (np.sin(board * 2.3) * 0.5 + 0.5) * 0.12            # доски чуть разного тона
    L = 0.55 + grain * 0.45 - knots * 0.25 - edge * 0.25 - var
    rgb = np.array([0.2, 0.12, 0.07]) * L[..., None]
    rgb = rgb * (1 - np.clip(seam, 0, 1)[..., None] * 0.92)
    save('boards', rgb, 84)


def awning(W=480, H=150, k=6):  # k чётное — полосы чередуются и через шов
    """полосатый навес: k фестонов на кадр, полосы складками, кайма; бесшовно по горизонтали"""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    per = W / k; ph = (x % per) / per                      # фаза внутри фестона
    stripe = (np.floor(x / per) % 2).astype(np.float32)        # каждый фестон — своей полосой
    red, cream = np.array([0.55, 0.09, 0.06]), np.array([0.86, 0.74, 0.52])
    base = red * (1 - stripe[..., None]) + cream * stripe[..., None]
    # складки: каждая полоса — выпуклая (свет слева сверху), стыки — в тени
    sp = ph
    fold = 0.78 + 0.32 * np.sin(sp * np.pi) - 0.12 * sp
    # навес наклонён: сверху темнее (в тени балки), к низу светлее
    slope = 0.6 + 0.4 * np.clip(y / (H * 0.7), 0, 1)
    weave = fbm(W, H, 120, 45, 2, 81) * 0.1 + fbm(W, H, 12, 4, 3, 83) * 0.12
    rgb = base * (fold * slope)[..., None] * (0.94 + weave)[..., None]
    # фестоны: нижний край — полукруги; кайма вдоль края
    hem = H * 0.68; R = per / 2
    cy = hem; dx = (ph - 0.5) * per
    edge_y = cy + np.sqrt(np.clip(R ** 2 - dx ** 2, 0, None)) * 0.62
    inside = y < edge_y
    d = edge_y - y
    trim = (d < 7) & inside
    rgb = np.where(trim[..., None], np.array([0.78, 0.55, 0.2]) * (0.75 + 0.35 * np.clip(d / 7, 0, 1))[..., None], rgb)
    rgb = np.where(((d > 7) & (d < 9) & inside)[..., None], rgb * 0.55, rgb)
    # строчка над фестонами
    rgb = np.where((np.abs(y - hem * 0.9) < 1.2)[..., None], rgb * 0.7, rgb)
    a = np.clip(d + 0.5, 0, 1)                            # сглаженный край
    # тень под краем — мягкая, на альфе
    sh = np.clip(1 - (y - edge_y) / 14, 0, 1) * (y >= edge_y) * 0.45
    out = np.dstack([np.where(inside[..., None], rgb, 0.02), np.maximum(a, sh)])
    save('awning', out.astype(np.float32))


if __name__ == '__main__':
    parchment(); plank(); boards(); awning()
