#!/usr/bin/env python3
"""Рельеф рамки карты «Под Землёй»: серая карта рельефа для mix-blend-mode: overlay поверх цвета категории.

  python3 art/card-rim.py   — пишет public/ui/card/v1/rim.webp (128×128, срез 16 px для border-image)

Серый 50 % — ничего не меняет; светлее — блик, темнее — тень. Профиль поперёк рамки: скруглённая внешняя кромка,
плоская полоса с кованой фактурой, узкая канавка и бортик у окна рисунка. Свет — сверху слева.
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N, B, R = 128, 16, 11  # размер, ширина рамки (срез), радиус скругления углов


def sdf_round_rect(x, y, w, h, r):
    qx = np.abs(x - w / 2) - (w / 2 - r); qy = np.abs(y - h / 2) - (h / 2 - r)
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r


def main():
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32) + 0.5
    d = -sdf_round_rect(xx, yy, N, N, R)            # расстояние от внешнего края внутрь
    t = np.clip(d / B, 0, 1.2)
    # профиль высоты поперёк рамки (0 — внешний край, 1 — окно рисунка)
    h = np.where(t < 0.3, np.sin(np.clip(t / 0.3, 0, 1) * np.pi / 2), 1.0)          # скруглённая кромка
    h = h - 0.35 * np.exp(-((t - 0.66) / 0.05) ** 2)                                  # канавка
    h = h + 0.18 * np.exp(-((t - 0.84) / 0.06) ** 2)                                  # бортик
    h = h - 0.5 * np.clip((t - 0.95) / 0.05, 0, 1)                                    # уступ к окну
    # кованая фактура: мелкие вмятины на плоской части
    rng = np.random.default_rng(7)
    noise = rng.normal(0, 1, (N, N)).astype(np.float32)
    from PIL import ImageFilter
    nz = np.asarray(Image.fromarray(((noise * 40) + 128).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.3))).astype(np.float32) / 255 - 0.5
    h = h * 3.2 + nz * 0.9 * ((t > 0.3) & (t < 0.95))
    gy, gx = np.gradient(h)
    nx, ny, nzv = -gx, -gy, np.ones_like(h)
    ln = np.sqrt(nx ** 2 + ny ** 2 + nzv ** 2)
    L = np.array([-0.55, -0.6, 0.58]); L /= np.linalg.norm(L)
    shade = (nx * L[0] + ny * L[1] + nzv * L[2]) / ln
    flat = L[2]
    g = 0.5 + (shade - flat) * 0.9
    # блик на самой кромке
    g = g + 0.12 * np.exp(-((t - 0.12) / 0.07) ** 2) * (shade > flat)
    g = np.clip(g, 0, 1)
    alpha = np.clip(d + 0.5, 0, 1)                    # за скруглением — прозрачно
    img = np.dstack([g, g, g, alpha]) * 255
    out = os.path.join(ROOT, 'public', 'ui', 'card', 'v1', 'rim.webp')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    Image.fromarray(img.astype(np.uint8), 'RGBA').save(out, 'WEBP', lossless=True)
    print(out)


if __name__ == '__main__':
    main()
