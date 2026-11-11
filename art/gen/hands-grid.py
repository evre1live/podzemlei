"""Сетка для разметки рук (anchor, cut, tip в art/gen/import-hands.py): левая и правая рука расы рядом,
с координатами исходника.

  python3 art/gen/hands-grid.py <папка с hand-*.png> <раса> <out.jpg>                    — обзор, шаг сетки 50
  python3 art/gen/hands-grid.py <папка> <раса> <out.jpg> <lx> <ly> <rx> <ry> [радиус]    — крупно вокруг ложбинок, шаг 20
"""
import sys
from PIL import Image, ImageDraw, ImageFont
src, race, out = sys.argv[1], sys.argv[2], sys.argv[3]
zoom = len(sys.argv) > 4
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
def view(path, box, k, step):
    im = Image.open(path).convert('RGBA')
    bg = Image.new('RGBA', im.size, (70, 78, 92, 255)); bg.alpha_composite(im)
    c = bg.crop(box).convert('RGB'); c = c.resize((round(c.width * k), round(c.height * k)), Image.LANCZOS)
    d = ImageDraw.Draw(c)
    x = (box[0] // step + 1) * step
    while x < box[2]:
        X = (x - box[0]) * k; d.line([(X, 0), (X, c.height)], fill=(255, 255, 255) if x % (step * 2) == 0 else (150, 190, 255), width=1); d.text((X + 2, 2), str(x), fill=(255, 255, 0), font=f); x += step
    y = (box[1] // step + 1) * step
    while y < box[3]:
        Y = (y - box[1]) * k; d.line([(0, Y), (c.width, Y)], fill=(255, 255, 255) if y % (step * 2) == 0 else (150, 190, 255), width=1); d.text((2, Y + 2), str(y), fill=(255, 255, 0), font=f); y += step
    return c
if zoom:
    lx, ly, rx, ry = map(int, sys.argv[4:8]); R = int(sys.argv[8]) if len(sys.argv) > 8 else 120
    a = view(f'{src}/hand-{race}-left.png', (lx - R, ly - R, lx + R, ly + R), 840 / (2 * R), 20)
    b = view(f'{src}/hand-{race}-right.png', (rx - R, ry - R, rx + R, ry + R), 840 / (2 * R), 20)
else:
    a = view(f'{src}/hand-{race}-left.png', (0, 320, 700, 1024), 1.25, 50)
    b = view(f'{src}/hand-{race}-right.png', (324, 320, 1024, 1024), 1.25, 50)
s = Image.new('RGB', (a.width + b.width + 6, max(a.height, b.height)), (0, 0, 0)); s.paste(a, (0, 0)); s.paste(b, (a.width + 6, 0)); s.save(out, quality=86)
print(out, s.size)
