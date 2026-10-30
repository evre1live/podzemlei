#!/usr/bin/env python3
"""Импорт второй части картинок ChatGPT (промты — «Промты-Под-Землёй-ChatGPT-2.md») в игру «Под Землёй».

  python3 art/gen/import2.py <папка с PNG>

Ждёт: door-closed.png, door-ajar.png, door-broken.png (три кадра одной двери, арка на месте), slot.png, banner.png,
medal-gold.png, medal-silver.png, medal-bronze.png, podium.png, shopkeeper.png, cobweb.png. Пишет public/ui/obj/v3/:
  door-closed/ajar/broken.webp  три кадра обрезаны одним и тем же прямоугольником (общий по всем трём) — при смене
                                кадра арка не сдвигается; ширина 600 px
  slot.webp                     гнездо куклы героя, 256 px
  banner.webp                   лента «Ваш ход», высота 160 px; концы ленты — срез BANNER_SLICE с каждого края
                                (border-image), середина растягивается под надпись
  medal-*.webp                  медали номинаций, 256 px; podium.webp — пьедестал, ширина 900 px
  shopkeeper.webp               лавочник по пояс, 520 px; cobweb.webp — паутина из левого верхнего угла, 384 px
Новая папка v3 — чтобы телефоны не показывали старое из кэша (картинки кэшируются на 30 дней).
"""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'ui', 'obj', 'v3')
SRC = sys.argv[1] if len(sys.argv) > 1 else None
BANNER_SLICE = 0.275   # доля ширины ленты, которую занимает каждый конец с ласточкиным хвостом


def load(n):
    im = Image.open(os.path.join(SRC, n + '.png')).convert('RGBA')
    a = np.asarray(im)
    # если вместо прозрачности — пурпурный фон, вырезаем его
    if a[..., 3].min() == 255:
        m = (a[..., 0] > 200) & (a[..., 1] < 60) & (a[..., 2] > 200)
        a = a.copy(); a[m, 3] = 0; im = Image.fromarray(a, 'RGBA')
    return im


def bbox(im, pad=0, th=24):
    b = im.getchannel('A').point(lambda v: 255 if v > th else 0).getbbox()
    return (max(0, b[0] - pad), max(0, b[1] - pad), min(im.width, b[2] + pad), min(im.height, b[3] + pad))


def webp(im, name, q=86):
    p = os.path.join(OUT, name + '.webp')
    im.save(p, 'WEBP', quality=q, alpha_quality=92, method=6)
    print(os.path.relpath(p, ROOT), im.size, os.path.getsize(p) // 1024, 'КБ')


def fit(im, w=None, h=None):
    s = (w / im.width) if w else (h / im.height)
    return im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)


def doors():
    frames = [load(f'door-{k}') for k in ('closed', 'ajar', 'broken')]
    bs = [bbox(f, 6) for f in frames]
    box = (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))
    for k, f in zip(('closed', 'ajar', 'broken'), frames): webp(fit(f.crop(box), w=600), f'door-{k}', 80)


def main():
    os.makedirs(OUT, exist_ok=True)
    doors()
    s = load('slot'); webp(fit(s.crop(bbox(s)), w=256), 'slot', 88)
    b = load('banner'); webp(fit(b.crop(bbox(b, 2)), h=160), 'banner', 88)
    for m in ('gold', 'silver', 'bronze'):
        im = load(f'medal-{m}'); webp(fit(im.crop(bbox(im, 4)), w=256), f'medal-{m}', 88)
    p = load('podium'); webp(fit(p.crop(bbox(p, 4)), w=900), 'podium', 84)
    k = load('shopkeeper'); webp(fit(k.crop(bbox(k, 4)), w=520), 'shopkeeper', 86)
    c = load('cobweb'); webp(fit(c.crop(bbox(c, 0, 8)), w=384), 'cobweb', 86)


if __name__ == '__main__':
    if not SRC: print(__doc__); sys.exit(1)
    main()
