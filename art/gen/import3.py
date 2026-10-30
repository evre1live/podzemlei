#!/usr/bin/env python3
"""Импорт третьей части картинок ChatGPT (промты — «Промты-Под-Землёй-ChatGPT-3.md») в игру «Под Землёй».

  python3 art/gen/import3.py <папка с PNG>

Ждёт (любые из них — что есть, то и возьмёт):
  mat-boss-lucifer.png, mat-boss-morena.png, mat-boss-hades.png, mat-boss-anubis.png, mat-boss-chernobog.png
      поле стола во владениях босса, 1536×1024 → public/ui/table/v3/mat-boss-<имя>.webp и -1024.webp для телефонов
  back_door_<вид>.png, back_treasure_<вид>.png  (вид: ember, ice, gold, royal)
      рубашки колод, вертикальные → public/cards/v1/<имя>.webp высотой 460 px (как прежние рубашки)
После импорта сам дописывает:
  - ключи нарисованных ковриков в BOSS_MATS (public/app.js) — для них поле меняется на картину босса;
  - рубашки в CARD_IMG (public/card-art.js) с отпечатком файла — тогда вместо CSS-отделки берётся рисунок.
Новая папка ui/table/v3 — чтобы телефоны не показывали старое из кэша (картинки кэшируются на 30 дней).
"""
import hashlib, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
T3 = os.path.join(ROOT, 'public', 'ui', 'table', 'v3')
CARDS = os.path.join(ROOT, 'public', 'cards', 'v1')
SRC = sys.argv[1] if len(sys.argv) > 1 else None
BOSSES = ['lucifer', 'morena', 'hades', 'anubis', 'chernobog']
BACKS = ['ember', 'ice', 'gold', 'royal']


def webp(im, path, q):
    im.save(path, 'WEBP', quality=q, method=6)
    print(os.path.relpath(path, ROOT), im.size, os.path.getsize(path) // 1024, 'КБ')


def cover(im, w, h):
    # обрезка по центру под нужные пропорции, затем масштаб
    k = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def mats():
    done = []
    os.makedirs(T3, exist_ok=True)
    for b in BOSSES:
        src = os.path.join(SRC, f'mat-boss-{b}.png')
        if not os.path.exists(src):
            continue
        im = cover(Image.open(src).convert('RGB'), 1536, 1024)
        webp(im, os.path.join(T3, f'mat-boss-{b}.webp'), 78)
        webp(im.resize((1024, 683), Image.LANCZOS), os.path.join(T3, f'mat-boss-{b}-1024.webp'), 78)
        done.append(b)
    if done:
        p = os.path.join(ROOT, 'public', 'app.js')
        s = open(p, encoding='utf8').read()
        m = re.search(r"const BOSS_MATS = new Set\(\[(.*?)\]\);", s)
        have = set(re.findall(r"'([a-z]+)'", m.group(1))) | set(done)
        s = s[:m.start()] + 'const BOSS_MATS = new Set([' + ', '.join(f"'{x}'" for x in BOSSES if x in have) + ']);' + s[m.end():]
        open(p, 'w', encoding='utf8').write(s)
        print('BOSS_MATS:', sorted(have))


def backs():
    added = {}
    for v in BACKS:
        for deck in ('door', 'treasure'):
            name = f'back_{deck}_{v}'
            src = os.path.join(SRC, name + '.png')
            if not os.path.exists(src):
                continue
            im = cover(Image.open(src).convert('RGB'), 1024, 1536).resize((307, 460), Image.LANCZOS)
            out = os.path.join(CARDS, name + '.webp')
            webp(im, out, 86)
            added[name] = hashlib.md5(open(out, 'rb').read()).hexdigest()[:8]
    if added:
        p = os.path.join(ROOT, 'public', 'card-art.js')
        s = open(p, encoding='utf8').read()
        for name, h in added.items():
            if f"['{name}'," in s:
                s = re.sub(rf"\['{name}', '[0-9a-f]+'\]", f"['{name}', '{h}']", s)
            else:
                s = s.replace("export const CARD_IMG = new Map([\n", f"export const CARD_IMG = new Map([\n  ['{name}', '{h}'],\n", 1)
        open(p, 'w', encoding='utf8').write(s)
        print('CARD_IMG:', ', '.join(added))


if __name__ == '__main__':
    if not SRC:
        print(__doc__)
        sys.exit(1)
    mats()
    backs()
