#!/usr/bin/env python3
"""Сцена и свет за портретом героя «Под Землёй».

  python3 art/scene.py cut [id ...]   — отделить героя от фона (все портреты или перечисленные): нужна rembg
  python3 art/scene.py bg             — фоны сцен из картин локаций (порядок и свет — art/scenes.json)
  python3 art/scene.py plates         — подложки родного фона без героя (для объёмного портрета)
  python3 art/scene.py all            — всё вместе

Вырезанный герой — public/avatars/v1/c/<id>.webp (360 px с прозрачностью).
Карта света — public/avatars/v1/g/<id>.webp: в красном канале ореол вокруг силуэта (горит за героем),
в зелёном — светлая кромка по контуру (ложится поверх). Цвет света задаёт игра (public/art-avatar.js).
Фоны сцен — public/avatars/v1/bg/<id>.webp (360 px, уже размытые и притемнённые).
Подложка родного фона — public/avatars/v1/n/<id>.webp: тот же портрет, где место героя закрашено фоном
(OpenCV inpaint) — при наклоне портрета герой сдвигается над фоном и под ним не видно «двойника».
Отделение от фона: rembg (MIT) с моделью isnet-general-use — pip install "rembg[cpu]".
После любой команды список портретов и сцен пересобирается (art/cut.py avindex).
"""
import json, os, sys
from PIL import Image, ImageChops, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AV = os.path.join(ROOT, 'public', 'avatars', 'v1')
LOC = os.path.join(ROOT, 'public', 'loc', 'v2')
SIZE = 360


def light_map(alpha):
    """Ореол (за героем) и кромка (по контуру) — из маски силуэта."""
    halo = alpha.filter(ImageFilter.GaussianBlur(11))
    halo = ImageEnhance.Brightness(halo).enhance(1.25)
    inner = alpha.filter(ImageFilter.MinFilter(9))
    rim = ImageChops.subtract(alpha, inner).filter(ImageFilter.GaussianBlur(2.2))
    rim = ImageEnhance.Brightness(rim).enhance(1.6)
    return Image.merge('RGB', (halo, rim, Image.new('L', alpha.size, 0)))


def cut(ids=None):
    from rembg import remove, new_session
    session = new_session('isnet-general-use')
    os.makedirs(os.path.join(AV, 'c'), exist_ok=True)
    os.makedirs(os.path.join(AV, 'g'), exist_ok=True)
    todo = ids or sorted(f[:-5] for f in os.listdir(AV) if f.startswith('p_') and f.endswith('.webp'))
    for i, pid in enumerate(todo, 1):
        src = Image.open(os.path.join(AV, pid + '.webp')).convert('RGB')
        out = remove(src, session=session).convert('RGBA').resize((SIZE, SIZE), Image.LANCZOS)
        out.save(os.path.join(AV, 'c', pid + '.webp'), 'WEBP', quality=84, method=6)
        light_map(out.getchannel('A')).save(os.path.join(AV, 'g', pid + '.webp'), 'WEBP', quality=80, method=6)
        print(f'  {i}/{len(todo)} {pid}')


def plates(ids=None):
    import cv2
    import numpy as np
    os.makedirs(os.path.join(AV, 'n'), exist_ok=True)
    todo = ids or sorted(f[:-5] for f in os.listdir(os.path.join(AV, 'c')) if f.endswith('.webp'))
    for pid in todo:
        src = np.array(Image.open(os.path.join(AV, pid + '.webp')).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS))
        alpha = np.array(Image.open(os.path.join(AV, 'c', pid + '.webp')).getchannel('A'))
        mask = cv2.dilate((alpha > 8).astype(np.uint8) * 255, np.ones((9, 9), np.uint8))
        fill = cv2.inpaint(cv2.cvtColor(src, cv2.COLOR_RGB2BGR), mask, 9, cv2.INPAINT_TELEA)
        plate = Image.fromarray(cv2.cvtColor(fill, cv2.COLOR_BGR2RGB)).filter(ImageFilter.GaussianBlur(1.2))
        plate.save(os.path.join(AV, 'n', pid + '.webp'), 'WEBP', quality=72, method=6)
    print(f'  подложек: {len(todo)}')


def backgrounds():
    meta = json.load(open(os.path.join(ROOT, 'art', 'scenes.json')))
    os.makedirs(os.path.join(AV, 'bg'), exist_ok=True)
    for s in meta['scenes']:
        im = Image.open(os.path.join(LOC, s['id'] + '.webp')).convert('RGB')
        W, H = im.size
        # вид сверху на стол: верхняя полоса — стены, ворота и огни за головой героя; картина — почти целиком
        if s['crop'] == 'scenic': side, y = int(H * 0.9), int(H * 0.05)
        else: side, y = int(H * 0.36), 0
        x = (W - side) // 2
        bg = im.crop((x, y, x + side, y + side)).resize((SIZE, SIZE), Image.LANCZOS)
        bg = bg.filter(ImageFilter.GaussianBlur(3.2))
        bg = ImageEnhance.Brightness(bg).enhance(0.78)
        path = os.path.join(AV, 'bg', s['id'] + '.webp')
        bg.save(path, 'WEBP', quality=74, method=6)
        print(f"  {s['id']}: {os.path.getsize(path) // 1024} КБ")


def main():
    if len(sys.argv) < 2: print(__doc__); return
    cmd = sys.argv[1]
    if cmd in ('cut', 'all'): cut(sys.argv[2:] if cmd == 'cut' else None)
    if cmd in ('bg', 'all'): backgrounds()
    if cmd in ('plates', 'all'): plates()
    if cmd not in ('cut', 'bg', 'plates', 'all'): print(__doc__); return
    sys.path.insert(0, os.path.join(ROOT, 'art'))
    from cut import avindex
    avindex()


if __name__ == '__main__':
    main()
