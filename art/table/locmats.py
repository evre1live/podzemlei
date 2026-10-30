#!/usr/bin/env python3
"""Игровое поле стола под каждую локацию «Под Землёй»: фактура, рельеф и свет — numpy, без Blender.

  python3 art/table/locmats.py [имя,имя]   — пишет public/ui/table/v1/mat-<имя>.webp (2400×1350) и mat-<имя>-1200.webp

Поле рисуется как цвет + высота (+ металл и свечение), потом освещается: свет сверху слева, как у предметов на столе.
Главное — в середине: на телефоне поле обрезается по бокам, на широком экране — сверху и снизу.
  tavern   — дубовые доски, круги от кружек, царапины         dungeon — багровый бархат, золотое шитьё
  glade    — мох с цветами и светлячками, ведьмин круг         forge   — кованая сталь, цвета побежалости, клёпка, руны
  ice      — лёд с трещинами и иней, вырезанная снежинка        graveyard — каменная плита, мох в трещинах, круг рун
  sky      — тёмный мрамор с белыми прожилками, золотая роза ветров           cove    — пиратская морская карта на пергаменте
  library  — синяя кожа с золотым звёздным атласом              oasis   — персидский ковёр
  flooded  — рифлёная сталь, ржавчина и лужи                    grove   — лесная подстилка, светящаяся грибница
  koschei  — чёрный камень, зелёные руны, золотой узор
"""
import os, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'public', 'ui', 'table', 'v1')
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'ui'))
from textures import fbm, noise  # периодический value-noise

W, H = 2400, 1350
Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
CX, CY = W / 2, H / 2
R = np.hypot(X - CX, Y - CY); A = np.arctan2(Y - CY, X - CX)


def C(*c): return np.array(c, np.float32)


def mix(a, b, t):
    t = np.asarray(t, np.float32)
    if t.ndim == 2: t = t[..., None]
    return a * (1 - t) + b * t


def ramp(v, stops):
    v = np.clip(v, 0, 1); out = np.zeros(v.shape + (3,), np.float32)
    ts = [s[0] for s in stops]; cs = np.array([s[1] for s in stops], np.float32)
    for c in range(3): out[..., c] = np.interp(v, ts, cs[:, c])
    return out


def smooth(a, lo, hi): t = np.clip((a - lo) / (hi - lo), 0, 1); return t * t * (3 - 2 * t)


def voronoi(cells, seed=0, aspect=True):
    """F1, F2 и номер клетки: случайная точка в каждой клетке сетки cells×(cells·H/W)"""
    rng = np.random.default_rng(seed)
    nx = cells; ny = max(1, round(cells * H / W)) if aspect else cells
    sx, sy = W / nx, H / ny
    pts = rng.random((ny + 2, nx + 2, 2)).astype(np.float32)
    ix, iy = np.floor(X / sx).astype(int), np.floor(Y / sy).astype(int)
    f1 = np.full((H, W), 1e9, np.float32); f2 = f1.copy(); idc = np.zeros((H, W), np.int32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx, cy = ix + dx, iy + dy
            p = pts[np.clip(cy + 1, 0, ny + 1), np.clip(cx + 1, 0, nx + 1)]
            px, py = (cx + p[..., 0]) * sx, (cy + p[..., 1]) * sy
            d = np.hypot(X - px, Y - py)
            c = d < f1
            f2 = np.where(c, f1, np.minimum(f2, d)); idc = np.where(c, cy * 997 + cx, idc); f1 = np.where(c, d, f1)
    return f1 / sx, f2 / sx, idc


def blur(a, r):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


def canvas(): im = Image.new('L', (W, H), 0); return im, ImageDraw.Draw(im)


def arr(im, r=0): return (np.asarray(im.filter(ImageFilter.GaussianBlur(r)) if r else im).astype(np.float32) / 255)


def shade(alb, h, k=1.0, metal=None, gloss=0.25, shin=40, emis=None, amb=0.42, lamp=0.22):
    """освещение: свет сверху слева, рассеянный, блик по шероховатости; металл бликует своим цветом"""
    gy, gx = np.gradient(h * k * 60)
    n = np.dstack([-gx, -gy, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    L = C(-0.42, -0.5, 0.76); L /= np.linalg.norm(L)
    Hv = L + C(0, 0, 1); Hv /= np.linalg.norm(Hv)
    dif = np.clip((n * L).sum(2), 0, 1); sp = np.clip((n * Hv).sum(2), 0, 1) ** shin
    m = np.zeros_like(h) if metal is None else metal
    pool = lamp * np.exp(-((X - CX * 0.9) ** 2 / (W * 0.45) ** 2 + (Y - CY * 0.85) ** 2 / (H * 0.5) ** 2))   # лампа над столом
    base = alb * ((amb + 0.78 * dif)[..., None]) * (1 - 0.45 * m[..., None])
    env = (m * (0.5 + 0.5 * dif) * (0.55 + 0.45 * np.clip(n[..., 1] * -2 + 0.5, 0, 1)))[..., None] * alb * 0.75   # металл отражает свет лампы
    spec = (gloss * sp)[..., None] * mix(C(1, 0.95, 0.88), alb * 1.6, m) + env
    rgb = (base + spec) * (1 + pool)[..., None]
    if emis is not None: rgb = rgb + emis
    return rgb


HEAVY = {'dungeon', 'oasis', 'library', 'koschei', 'graveyard', 'glade'}   # мелкий ворс и крапины — сжимаем сильнее, на глаз не видно


def save(name, rgb):
    os.makedirs(OUT, exist_ok=True)
    im = Image.fromarray((np.clip(rgb, 0, 1) ** (1 / 1.0) * 255).astype(np.uint8), 'RGB')
    im.save(os.path.join(OUT, f'mat-{name}.webp'), 'WEBP', quality=84 if name not in HEAVY else 70, method=6)
    im.resize((1200, 675), Image.LANCZOS).save(os.path.join(OUT, f'mat-{name}-1200.webp'), 'WEBP', quality=86, method=6)
    print(name, os.path.getsize(os.path.join(OUT, f'mat-{name}.webp')) // 1024, 'КБ', flush=True)


def runes(d, cx, cy, r, n, w, seed, size=0.07):
    """круг рун: угловатые знаки из 2–4 штрихов"""
    rng = np.random.default_rng(seed)
    for i in range(n):
        a = i / n * 2 * math.pi; x0, y0 = cx + r * math.cos(a), cy + r * math.sin(a); s = r * size
        for _ in range(rng.integers(2, 5)):
            p = rng.uniform(-1, 1, 4) * s
            p[0] = round(p[0] / s) * s * 0.8; p[2] = round(p[2] / s) * s * 0.8   # вертикали и диагонали
            d.line((x0 + p[0], y0 + p[1], x0 + p[2], y0 + p[3]), fill=255, width=w)


def star(d, cx, cy, r, n=8, inner=0.18, fill=255, rot=-math.pi / 2):
    pts = []
    for i in range(n * 2):
        a = rot + i * math.pi / n; rr = r if i % 2 == 0 else r * inner
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)


# ───────── локации ─────────
def tavern():
    n = 6; ph = H / n; k = np.floor(Y / ph); v = (Y % ph) / ph
    grain = fbm(W, H, 2, 90, 5, 11, 0.62)
    phase = Y / 44 + fbm(W, H, 4, 2, 4, 13) * 1.3 + fbm(W, H, 12, 6, 3, 14) * 0.25 + k * 1.7
    rings = 1 - np.exp(-(((phase % 1) - 0.5) / 0.07) ** 2) * 0.8
    g = grain * 0.7 + rings * 0.3
    tone = (np.sin(k * 2.1) * 0.5 + 0.5)[..., None] * 0.12
    alb = ramp(g, [(0.2, C(0.2, 0.1, 0.045)), (0.6, C(0.34, 0.19, 0.085)), (0.95, C(0.46, 0.28, 0.13))]) * (0.92 + tone)
    seam = np.exp(-((v - 0) * ph / 2.2) ** 2) + np.exp(-((v - 1) * ph / 2.2) ** 2)
    h = g * 0.12 - seam * 1.2 + (fbm(W, H, 8, 8, 4, 17) - 0.5) * 0.15
    L = np.ones((H, W), np.float32)
    for cx, cy, r in [(820, 520, 70), (1580, 820, 64), (1350, 430, 60), (930, 930, 66), (1740, 520, 58)]:
        d = np.hypot(X - cx, Y - cy) - r - 4 * np.sin(np.arctan2(Y - cy, X - cx) * 3 + cx)
        L *= 1 - 0.3 * np.exp(-(d / 5) ** 2) - 0.07 * (d < 0)
    rng = np.random.default_rng(3)
    for _ in range(14):
        cx, cy = rng.uniform(300, 2100), rng.uniform(200, 1150); a = rng.uniform(0, math.pi); ln = rng.uniform(40, 160)
        u = (X - cx) * math.cos(a) + (Y - cy) * math.sin(a); w = -(X - cx) * math.sin(a) + (Y - cy) * math.cos(a)
        m = np.exp(-(w / 0.8) ** 2) * (np.abs(u) < ln); L *= 1 + 0.25 * m
    alb = alb * (L * (1 - seam * 0.8))[..., None] * (0.85 + 0.25 * fbm(W, H, 4, 3, 4, 19))[..., None]
    save('tavern', shade(alb, h, 1.0, gloss=0.18, shin=24))


def dungeon():
    fib = fbm(W, H, 400, 220, 2, 21)
    fold = fbm(W, H, 3, 2, 4, 23)
    alb = ramp(fold * 0.6 + fib * 0.4, [(0.2, C(0.12, 0.008, 0.02)), (0.6, C(0.3, 0.025, 0.045)), (1.0, C(0.45, 0.06, 0.08))])
    # прижатый ворс: решётка четырёхлистников по всему бархату
    s = 150; u, v = (X % s) / s - 0.5, (Y % s) / s - 0.5
    q = np.hypot(u, v); qa = np.arctan2(v, u)
    lat = smooth(np.abs(q - (0.32 + 0.06 * np.cos(4 * qa))), 0.035, 0.0)
    alb = alb * (1 - 0.35 * lat[..., None])
    # золотое шитьё в середине: розетка, кольца, точки
    im, d = canvas()
    for rr, w in [(420, 9), (395, 4), (190, 7)]: d.ellipse((CX - rr, CY - rr, CX + rr, CY + rr), outline=255, width=w)
    for i in range(48):
        a = i / 48 * 2 * math.pi; x, y = CX + 408 * math.cos(a), CY + 408 * math.sin(a); d.ellipse((x - 7, y - 7, x + 7, y + 7), fill=255)
    for i in range(16):
        a = i / 16 * 2 * math.pi; r0, r1 = 210, 370 if i % 2 == 0 else 300
        p = [(CX + r0 * math.cos(a - 0.12), CY + r0 * math.sin(a - 0.12)), (CX + r1 * math.cos(a), CY + r1 * math.sin(a)), (CX + r0 * math.cos(a + 0.12), CY + r0 * math.sin(a + 0.12))]
        d.line(p + [p[0]], fill=255, width=6)
    star(d, CX, CY, 150, 8, 0.42)
    gm = arr(im, 1.2)
    thread = 0.75 + 0.25 * np.sin((X + Y) * 0.9)          # стежки
    gcol = ramp(fbm(W, H, 40, 22, 3, 27), [(0.2, C(0.55, 0.36, 0.1)), (0.8, C(0.95, 0.75, 0.35))])
    alb = mix(alb, gcol * thread[..., None], gm)
    h = fib * 0.15 + gm * 0.9 - lat * 0.25
    save('dungeon', shade(alb, h, 1.0, metal=gm, gloss=0.22, shin=30))


def glade():
    f1, f2, idc = voronoi(90, 31)
    clump = 1 - smooth(f1, 0, 0.75)
    base = fbm(W, H, 6, 4, 6, 33)
    clump = blur(clump, 3)
    alb = ramp(base * 0.8 + clump * 0.2, [(0.1, C(0.03, 0.07, 0.015)), (0.5, C(0.09, 0.2, 0.03)), (0.85, C(0.25, 0.38, 0.07))])
    fine = fbm(W, H, 300, 170, 2, 35); alb = alb * (0.8 + 0.4 * fine)[..., None]
    h = clump * 0.25 + fine * 0.2 + base * 0.5
    rng = np.random.default_rng(37); fl = np.zeros((H, W), np.float32); fy = fl.copy()
    im, d = canvas(); im2, d2 = canvas()
    for _ in range(260):                                       # цветы: белые и жёлтые звёздочки
        x, y = rng.uniform(0, W), rng.uniform(0, H); r = rng.uniform(5, 10)
        if math.hypot(x - CX, y - CY) < 160: continue
        (d if rng.random() < 0.6 else d2).regular_polygon((x, y, r), 5, rotation=rng.uniform(0, 72), fill=255)
    wf, yf = arr(im, 0.8), arr(im2, 0.8)
    # ведьмин круг: кольцо светлой травы и крошечных грибов
    ring = np.exp(-((R - 420) / 26) ** 2)
    alb = mix(alb, C(0.3, 0.42, 0.1), ring * 0.4)
    im3, d3 = canvas()
    for i in range(70):
        a = i / 70 * 2 * math.pi + rng.uniform(-0.03, 0.03); rr = 420 + rng.uniform(-18, 18); x, y = CX + rr * math.cos(a), CY + rr * math.sin(a); s = rng.uniform(7, 13)
        d3.ellipse((x - s, y - s * 0.8, x + s, y + s * 0.8), fill=255)
    mush = arr(im3, 1.0)
    alb = mix(alb, C(0.85, 0.78, 0.62), wf); alb = mix(alb, C(0.95, 0.8, 0.2), yf); alb = mix(alb, C(0.78, 0.62, 0.45), mush)
    h = h + wf * 0.4 + yf * 0.4 + mush * 1.2
    # светлячки
    glow = np.zeros((H, W), np.float32)
    for _ in range(46):
        x, y = rng.uniform(0, W), rng.uniform(0, H); glow += np.exp(-((X - x) ** 2 + (Y - y) ** 2) / (2 * rng.uniform(5, 9) ** 2)) + 0.25 * np.exp(-((X - x) ** 2 + (Y - y) ** 2) / (2 * 40 ** 2))
    emis = glow[..., None] * C(0.75, 1.0, 0.35) * 0.9
    save('glade', shade(alb, h, 0.8, gloss=0.08, shin=12, emis=emis, amb=0.38))


def forge():
    f1, f2, idc = voronoi(44, 41)
    dimple = -blur((1 - smooth(f1, 0, 0.75)) ** 2, 2)
    soot = fbm(W, H, 5, 3, 6, 43)
    alb = ramp(soot, [(0.2, C(0.07, 0.07, 0.075)), (0.6, C(0.22, 0.22, 0.23)), (1.0, C(0.34, 0.34, 0.35))])
    # цвета побежалости — пятном к середине, где «горячо»
    t = np.clip(1 - R / 700 + (fbm(W, H, 4, 3, 4, 45) - 0.5) * 0.5, 0, 1)
    temper = ramp(t, [(0.0, C(0.14, 0.14, 0.15)), (0.3, C(0.2, 0.2, 0.32)), (0.45, C(0.25, 0.22, 0.5)), (0.6, C(0.45, 0.22, 0.4)), (0.75, C(0.6, 0.35, 0.15)), (0.9, C(0.75, 0.6, 0.3))])
    alb = mix(alb, temper, smooth(t, 0.15, 0.5) * 0.5)
    # стыки листов и ряды заклёпок сверху и снизу
    seams = np.exp(-((X - W / 3) / 2.5) ** 2) + np.exp(-((X - 2 * W / 3) / 2.5) ** 2)
    riv = np.zeros((H, W), np.float32)
    for yy in (70, H - 70):
        for xx in np.arange(60, W, 120): riv = np.maximum(riv, np.clip(1 - np.hypot(X - xx, Y - yy) / 16, 0, 1))
    for xx in (W / 3, 2 * W / 3):
        for yy in np.arange(140, H - 100, 120): riv = np.maximum(riv, np.clip(1 - np.hypot(X - xx - 34, Y - yy) / 13, 0, 1))
    riv = np.sqrt(riv)
    # гномий знак: кольца и руны, в бороздах — тлеющий жар
    im, d = canvas()
    for rr, w in [(300, 10), (262, 5), (120, 8)]: d.ellipse((CX - rr, CY - rr, CX + rr, CY + rr), outline=255, width=w)
    runes(d, CX, CY, 192, 24, 7, 47, 0.12)
    for i in range(6):
        a = i / 6 * 2 * math.pi + math.pi / 6; d.line((CX + 120 * math.cos(a), CY + 120 * math.sin(a), CX + 262 * math.cos(a), CY + 262 * math.sin(a)), fill=255, width=6)
    star(d, CX, CY, 80, 6, 0.4)
    eng = arr(im, 1.4)
    alb = alb * (1 - 0.7 * eng[..., None]) * (1 - seams * 0.8)[..., None]
    h = dimple * 0.35 + soot * 0.1 - eng * 0.8 - seams * 0.8 + riv * 1.6
    heat = blur(eng, 6) * 0.6 + eng * 0.8
    emis = (heat * (0.6 + 0.4 * fbm(W, H, 20, 12, 3, 49)))[..., None] * C(1.0, 0.38, 0.08) * 0.55
    met = np.clip(0.85 - eng, 0, 1)
    save('forge', shade(alb, h, 1.0, metal=met, gloss=0.35, shin=28, emis=emis))


def ice():
    f1, f2, idc = voronoi(12, 51)
    crack = smooth(f2 - f1, 0.025, 0.0) * smooth(fbm(W, H, 6, 4, 5, 52), 0.38, 0.55)
    f1b, f2b, _ = voronoi(70, 53); crack2 = smooth(f2b - f1b, 0.04, 0.0) * smooth(fbm(W, H, 5, 3, 4, 55), 0.45, 0.65)
    depth = fbm(W, H, 4, 3, 6, 57)
    frost = smooth(fbm(W, H, 7, 4, 6, 59), 0.5, 0.75)
    alb = ramp(depth, [(0.1, C(0.03, 0.1, 0.18)), (0.6, C(0.1, 0.27, 0.4)), (1.0, C(0.25, 0.5, 0.62))])
    alb = mix(alb, C(0.82, 0.9, 0.95), frost * 0.75)
    # пузырьки воздуха
    rng = np.random.default_rng(61); im, d = canvas()
    for _ in range(320):
        x, y = rng.uniform(0, W), rng.uniform(0, H); r = rng.uniform(2, 7); d.ellipse((x - r, y - r, x + r, y + r), outline=255, width=1)
    bub = arr(im, 0.6)
    # вырезанная снежинка
    im2, d2 = canvas()
    for i in range(6):
        a = i * math.pi / 3 - math.pi / 2; ex, ey = CX + 330 * math.cos(a), CY + 330 * math.sin(a)
        d2.line((CX, CY, ex, ey), fill=255, width=12)
        for t, l in [(0.35, 90), (0.6, 70), (0.82, 44)]:
            px, py = CX + 330 * t * math.cos(a), CY + 330 * t * math.sin(a)
            for s in (-1, 1):
                b = a + s * math.pi / 3; d2.line((px, py, px + l * math.cos(b), py + l * math.sin(b)), fill=255, width=9)
    d2.regular_polygon((CX, CY, 70), 6, rotation=30, outline=255, width=9)
    flake = arr(im2, 1.6)
    alb = mix(alb, C(0.92, 0.97, 1.0), np.clip(crack * 0.7 + crack2 * 0.45 + flake * 0.85 + bub * 0.4, 0, 1))
    h = depth * 0.2 - crack * 0.5 - crack2 * 0.3 - flake * 0.9
    sparkle = (fbm(W, H, 600, 340, 1, 63) > 0.86) * frost * 0.5
    save('ice', shade(alb, h, 1.0, gloss=0.75, shin=90, emis=sparkle[..., None] * C(0.8, 0.9, 1.0), amb=0.48))


def graveyard():
    base = fbm(W, H, 5, 3, 7, 71)
    speck = fbm(W, H, 260, 150, 2, 73)
    alb = ramp(base * 0.7 + speck * 0.3, [(0.15, C(0.08, 0.085, 0.08)), (0.55, C(0.21, 0.22, 0.2)), (0.9, C(0.36, 0.36, 0.33))])
    # швы между плитами и трещины
    joint = np.exp(-((X - 760) / 3) ** 2) + np.exp(-((X - 1640) / 3) ** 2) + np.exp(-((Y - 460) / 3) ** 2) * (X > 1640) + np.exp(-((Y - 900) / 3) ** 2) * (X < 760)
    f1, f2, _ = voronoi(14, 75); crack = smooth(f2 - f1, 0.025, 0.0) * smooth(fbm(W, H, 6, 4, 4, 77), 0.5, 0.62)
    gap = np.clip(joint + crack, 0, 1)
    moss = smooth(blur(gap, 14) * 1.6 + fbm(W, H, 18, 10, 4, 79) * 0.5, 0.45, 0.8)
    lich = smooth(fbm(W, H, 40, 22, 3, 81), 0.72, 0.8)
    alb = mix(alb, C(0.07, 0.14, 0.04), moss * 0.85); alb = mix(alb, C(0.5, 0.52, 0.32), lich * 0.5)
    im, d = canvas()
    for rr, w in [(330, 12), (300, 5), (140, 9)]: d.ellipse((CX - rr, CY - rr, CX + rr, CY + rr), outline=255, width=w)
    runes(d, CX, CY, 220, 18, 9, 83, 0.13)
    for i in range(4):                                            # кельтский крест в круге
        a = i * math.pi / 2; d.line((CX + 40 * math.cos(a), CY + 40 * math.sin(a), CX + 300 * math.cos(a), CY + 300 * math.sin(a)), fill=255, width=16)
    carve = arr(im, 1.8)
    alb = alb * (1 - 0.55 * carve[..., None]) * (1 - 0.85 * gap[..., None])
    h = base * 0.5 + speck * 0.25 - carve * 1.1 - gap * 1.3 + moss * 0.3
    save('graveyard', shade(alb, h, 1.0, gloss=0.1, shin=14, amb=0.4))


def sky():
    w = fbm(W, H, 3, 2, 6, 91); w2 = fbm(W, H, 7, 4, 5, 92)
    n1 = np.sin((X / 520 + Y / 900 + w * 3.2 + w2 * 0.6) * math.pi)
    v1 = smooth(np.abs(n1), 0.05, 0.0) * smooth(fbm(W, H, 4, 3, 4, 94), 0.35, 0.55)
    v2 = smooth(np.abs(np.sin((X / 260 - Y / 420 + fbm(W, H, 5, 3, 5, 93) * 3 + w2) * math.pi)), 0.025, 0.0) * 0.45 * smooth(fbm(W, H, 5, 3, 4, 96), 0.45, 0.6)
    v1 = blur(v1, 1.5) + blur(v1, 10) * 0.6
    cloud = fbm(W, H, 6, 4, 5, 95)
    alb = ramp(cloud, [(0.2, C(0.07, 0.08, 0.11)), (0.8, C(0.17, 0.18, 0.23))])           # тёмный мрамор: текст сцены читается
    alb = mix(alb, C(0.78, 0.8, 0.86), np.clip(v1 + v2, 0, 1) * 0.75)
    im, d = canvas()
    for rr, w_ in [(420, 8), (396, 3), (230, 5)]: d.ellipse((CX - rr, CY - rr, CX + rr, CY + rr), outline=255, width=w_)
    for i in range(32):
        a = i / 32 * 2 * math.pi; l = 28 if i % 4 else 52
        d.line((CX + 396 * math.cos(a), CY + 396 * math.sin(a), CX + (396 - l) * math.cos(a), CY + (396 - l) * math.sin(a)), fill=255, width=4)
    star(d, CX, CY, 380, 4, 0.16); star(d, CX, CY, 260, 4, 0.2, rot=-math.pi / 4)
    rng = np.random.default_rng(97)
    for _ in range(40):
        a = rng.uniform(0, 2 * math.pi); r = rng.uniform(470, 900); x, y = CX + r * math.cos(a), CY + r * math.sin(a) * 0.7
        star(d, x, y, rng.uniform(10, 22), 4, 0.25)
    gm = arr(im, 1.1)
    alb = mix(alb, ramp(fbm(W, H, 30, 17, 3, 98), [(0.2, C(0.62, 0.4, 0.12)), (0.8, C(0.86, 0.62, 0.25))]), gm)
    h = cloud * 0.08 - np.clip(v1 + v2, 0, 1) * 0.05 + gm * 0.6
    save('sky', shade(alb, h, 1.0, metal=gm, gloss=0.55, shin=70, amb=0.45, lamp=0.2))


def cove():
    paper = fbm(W, H, 4, 3, 6, 101); fib = fbm(W, H, 8, 160, 3, 103)
    alb = ramp(paper * 0.92 + fib * 0.08, [(0.2, C(0.27, 0.18, 0.09)), (0.6, C(0.42, 0.31, 0.18)), (1.0, C(0.52, 0.4, 0.25))])   # старая тёмная карта
    land = fbm(W, H, 3, 2, 6, 105) + 0.18 * np.exp(-((X - 300) ** 2 + (Y - 300) ** 2) / 600 ** 2) - 0.25 * np.exp(-(R / 650) ** 2)
    is_land = smooth(land, 0.6, 0.62)
    alb = mix(alb, alb * C(0.88, 0.86, 0.7), is_land)
    ink = np.zeros((H, W), np.float32)
    for lv, wd in [(0.61, 1.6), (0.58, 0.9), (0.55, 0.7), (0.52, 0.6)]:
        ink += np.exp(-((land - lv) / (0.004 * wd)) ** 2) * (0.9 if lv == 0.61 else 0.45)
    im, d = canvas(); imr, dr = canvas()
    cx, cy = CX + 60, CY + 20
    for i in range(32):                                          # румбы от розы ветров
        a = i / 32 * 2 * math.pi; d.line((cx, cy, cx + 3000 * math.cos(a), cy + 3000 * math.sin(a)), fill=110, width=2)
    for gx in range(0, W, 300): d.line((gx, 0, gx, H), fill=60, width=1)
    for gy in range(0, H, 300): d.line((0, gy, W, gy), fill=60, width=1)
    d.ellipse((cx - 230, cy - 230, cx + 230, cy + 230), outline=255, width=4); d.ellipse((cx - 205, cy - 205, cx + 205, cy + 205), outline=255, width=2)
    for i in range(8):
        a = i * math.pi / 4 - math.pi / 2; rr = 200 if i % 2 == 0 else 130
        for s, dd in ((-1, d), (1, dr)):
            p = [(cx, cy), (cx + rr * math.cos(a), cy + rr * math.sin(a)), (cx + 34 * math.cos(a + s * math.pi / 8), cy + 34 * math.sin(a + s * math.pi / 8))]
            dd.polygon(p, fill=255)
    rng = np.random.default_rng(107)
    pts = [(500, 1050), (760, 900), (1000, 980), (1230, 820), (1480, 700), (1720, 760), (1930, 520)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):                 # пунктир маршрута к кресту
        for t in np.arange(0, 1, 0.12): dr.line((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, x0 + (x1 - x0) * (t + 0.06), y0 + (y1 - y0) * (t + 0.06)), fill=255, width=6)
    dr.line((1900, 490, 1960, 550), fill=255, width=12); dr.line((1960, 490, 1900, 550), fill=255, width=12)
    for _ in range(26):                                          # волны в море
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        if land[int(y) % H, int(x) % W] > 0.56: continue
        for k in range(3): d.arc((x + k * 22 - 11, y - 8, x + k * 22 + 11, y + 8), 200, 340, fill=200, width=3)
    lines = np.clip(arr(im, 0.7) + ink, 0, 1); red = arr(imr, 0.7)
    alb = mix(alb, C(0.08, 0.045, 0.02), lines * 0.85); alb = mix(alb, C(0.55, 0.1, 0.05), red * 0.9)
    fold = np.exp(-((X - W / 3) / 3) ** 2) + np.exp(-((X - 2 * W / 3) / 3) ** 2) + np.exp(-((Y - H / 2) / 3) ** 2)
    stain = smooth(fbm(W, H, 4, 3, 5, 109), 0.62, 0.8)
    alb = alb * (1 - 0.18 * stain[..., None]) * (1 - 0.15 * fold[..., None])
    h = paper * 0.2 + fib * 0.015 - fold * 0.5 + blur(fold, 6) * 0.3
    save('cove', shade(alb, h, 1.0, gloss=0.05, shin=10, amb=0.5))


def library():
    f1, f2, _ = voronoi(260, 111)
    grain = smooth(f2 - f1, 0.12, 0.0)
    base = fbm(W, H, 4, 3, 6, 113)
    alb = ramp(base, [(0.2, C(0.012, 0.02, 0.06)), (0.7, C(0.04, 0.07, 0.17)), (1.0, C(0.07, 0.11, 0.25))]) * (1 - 0.25 * grain[..., None])
    im, d = canvas()
    for rr, w in [(440, 7), (416, 3), (300, 4), (180, 3)]: d.ellipse((CX - rr, CY - rr, CX + rr, CY + rr), outline=255, width=w)
    for i in range(72):
        a = i / 72 * 2 * math.pi; l = 14 if i % 6 else 30
        d.line((CX + 416 * math.cos(a), CY + 416 * math.sin(a), CX + (416 - l) * math.cos(a), CY + (416 - l) * math.sin(a)), fill=255, width=3)
    d.ellipse((CX - 360, CY - 150, CX + 360, CY + 150), outline=255, width=3)   # эклиптика
    for i in range(12):
        a = i / 12 * 2 * math.pi; x, y = CX + 358 * math.cos(a), CY + 358 * math.sin(a); d.ellipse((x - 9, y - 9, x + 9, y + 9), outline=255, width=3)
    star(d, CX, CY, 120, 8, 0.3)
    rng = np.random.default_rng(117)
    for _ in range(9):                                            # созвездия
        a = rng.uniform(0, 2 * math.pi); r = rng.uniform(520, 980); ox, oy = CX + r * math.cos(a), CY + r * math.sin(a) * 0.62
        ps = [(ox + rng.uniform(-150, 150), oy + rng.uniform(-110, 110)) for _ in range(rng.integers(4, 7))]
        ps.sort(key=lambda p: p[0])
        for p, q in zip(ps, ps[1:]): d.line((*p, *q), fill=170, width=2)
        for p in ps: star(d, p[0], p[1], rng.uniform(9, 17), 4, 0.25)
    for _ in range(220):
        x, y = rng.uniform(0, W), rng.uniform(0, H); r = rng.uniform(1.5, 3.5); d.ellipse((x - r, y - r, x + r, y + r), fill=200)
    gm = arr(im, 0.9)
    alb = mix(alb, C(0.95, 0.74, 0.32), gm)
    h = base * 0.15 - grain * 0.15 + gm * 0.5
    save('library', shade(alb, h, 1.0, metal=gm, gloss=0.4, shin=40, amb=0.45))


def oasis():
    pile = fbm(W, H, 500, 280, 2, 121); wear = fbm(W, H, 4, 3, 5, 123)
    # поле: решётка ромбов с цветками
    s = 120; u, v = ((X - CX) % s) / s - 0.5, ((Y - CY) % s) / s - 0.5
    dia = np.abs(u) + np.abs(v)
    cell = (np.floor((X - CX) / s) + np.floor((Y - CY) / s)) % 2
    field = ramp(cell * 0.3 + 0.35, [(0.35, C(0.42, 0.05, 0.05)), (0.65, C(0.52, 0.08, 0.06))])
    lat = smooth(np.abs(dia - 0.5), 0.05, 0.0)
    flower = smooth(dia, 0.16, 0.1) * (0.5 + 0.5 * np.cos(8 * np.arctan2(v, u)))
    alb = mix(field, C(0.82, 0.68, 0.42), lat * 0.8)
    alb = mix(alb, C(0.08, 0.12, 0.3), smooth(dia, 0.2, 0.14) * 0.9); alb = mix(alb, C(0.85, 0.65, 0.25), flower * 0.8)
    # медальон: многоконечная звезда с каймой
    m = np.abs(X - CX) / 1.0 + np.abs(Y - CY) * 1.55
    star_r = 560 * (0.82 + 0.18 * np.cos(8 * A))
    med = smooth(star_r - R * (1 + 0.55 * (np.abs(np.sin(A)))), 0, 30)
    edge = np.exp(-((star_r - R * (1 + 0.55 * np.abs(np.sin(A)))) / 12) ** 2)
    alb = mix(alb, C(0.07, 0.1, 0.27), med * 0.95)
    inner = smooth(260 - m * 0.8, 0, 20)
    alb = mix(alb, C(0.85, 0.7, 0.45), inner * 0.9)
    alb = mix(alb, C(0.45, 0.05, 0.05), smooth(150 - m * 0.8, 0, 14) * 0.95)
    alb = mix(alb, C(0.9, 0.78, 0.5), edge)
    # кайма по краю ковра
    bd = np.minimum(np.minimum(X, W - X), np.minimum(Y, H - Y))
    band = (bd < 150)
    zz = np.abs(((X + Y) % 60) / 60 - 0.5) < 0.18
    alb = np.where(band[..., None], mix(C(0.07, 0.1, 0.27), C(0.85, 0.7, 0.42), (zz & (bd > 40) & (bd < 110)).astype(np.float32)), alb)
    alb = np.where(((np.abs(bd - 150) < 8) | (np.abs(bd - 30) < 6))[..., None], C(0.85, 0.7, 0.42), alb)
    alb = alb * (0.82 + 0.3 * pile)[..., None]
    worn = smooth(wear * 0.6 + np.exp(-(R / 600) ** 2) * 0.5, 0.55, 0.85)
    alb = mix(alb, alb * 0.75 + C(0.18, 0.13, 0.09), worn * 0.4)
    h = pile * 0.3 + lat * 0.1
    save('oasis', shade(alb, h, 1.0, gloss=0.04, shin=8, amb=0.46))


def flooded():
    # рифлёный лист: выпуклые «зёрна», соседние — под разным углом
    s = 90; cx_, cy_ = np.floor(X / s), np.floor(Y / s); u, v = (X % s) / s - 0.5, (Y % s) / s - 0.5
    ang = np.where((cx_ + cy_) % 2 == 0, math.pi / 4, -math.pi / 4)
    ru = u * np.cos(ang) + v * np.sin(ang); rv = -u * np.sin(ang) + v * np.cos(ang)
    bump = blur(np.clip(1 - (ru / 0.38) ** 2 - (rv / 0.09) ** 2, 0, 1) ** 0.5, 1.2)
    base = fbm(W, H, 5, 3, 6, 131)
    steel = ramp(base, [(0.2, C(0.16, 0.165, 0.17)), (0.8, C(0.32, 0.33, 0.34))])
    rustm = smooth(fbm(W, H, 14, 8, 6, 133) * 0.8 + fbm(W, H, 60, 34, 3, 134) * 0.2, 0.55, 0.72) * 0.85
    rust = ramp(fbm(W, H, 30, 17, 4, 135), [(0.2, C(0.18, 0.06, 0.02)), (0.6, C(0.42, 0.16, 0.05)), (1.0, C(0.6, 0.3, 0.1))])
    alb = mix(steel, rust, rustm)
    # лужи: ровная тёмная вода, отражает свет
    wet = smooth(fbm(W, H, 4, 3, 5, 137) - np.exp(-(R / 500) ** 2) * 0.15, 0.58, 0.64)
    alb = mix(alb, alb * 0.3 + C(0.015, 0.03, 0.035), wet * 0.85)
    h = bump * 1.0 * (1 - wet * 0.7) + base * 0.1 + rustm * 0.1
    met = (1 - rustm) * 0.8
    lit = shade(alb, h, 1.0, metal=met, gloss=0.3, shin=30, amb=0.42)
    sheen = wet * (0.04 + 0.2 * np.exp(-((X - 800) ** 2 + (Y - 350) ** 2) / 420 ** 2))   # блик лампы в лужах
    save('flooded', lit + sheen[..., None] * C(0.6, 0.75, 0.8))


def grove():
    soil = fbm(W, H, 6, 4, 7, 141)
    f1, f2, idc = voronoi(110, 143); chips = smooth(f1, 0.55, 0.2) * ((idc % 3) == 0)
    alb = ramp(soil, [(0.2, C(0.02, 0.015, 0.01)), (0.7, C(0.07, 0.05, 0.03)), (1.0, C(0.12, 0.08, 0.05))])
    alb = mix(alb, C(0.16, 0.1, 0.06), chips * 0.7)
    net = np.zeros((H, W), np.float32)
    for cells, seed, wd in [(18, 145, 0.03), (44, 147, 0.025)]:
        a1, a2, _ = voronoi(cells, seed); net = np.maximum(net, smooth(a2 - a1, wd, 0.0))
    net *= smooth(fbm(W, H, 5, 3, 4, 149), 0.42, 0.6)
    rng = np.random.default_rng(151); im, d = canvas(); imc, dc = canvas()
    for _ in range(34):                                           # кучки светящихся шляпок
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        if math.hypot(x - CX, y - CY) < 220: continue
        for _ in range(rng.integers(3, 7)):
            px, py, r = x + rng.uniform(-40, 40), y + rng.uniform(-30, 30), rng.uniform(8, 20)
            d.ellipse((px - r, py - r, px + r, py + r), fill=255); dc.ellipse((px - r * 0.45, py - r * 0.5, px + r * 0.1, py - r * 0.05), fill=255)
    caps, hi = arr(im, 1.2), arr(imc, 2)
    alb = mix(alb, C(0.08, 0.22, 0.2), caps * 0.85); alb = mix(alb, C(0.5, 0.8, 0.72), hi * 0.5)
    h = soil * 0.6 + chips * 0.4 + blur(caps, 4) * 1.6 - net * 0.1
    glow = net * 0.8 + blur(net, 10) * 0.8 + caps * 0.12 + hi * 0.15 + blur(caps, 22) * 0.35
    emis = glow[..., None] * C(0.2, 0.95, 0.75) * 0.5
    save('grove', shade(alb, h, 0.9, gloss=0.08, shin=14, emis=emis, amb=0.32))


def koschei():
    base = fbm(W, H, 5, 3, 7, 161); fine = fbm(W, H, 200, 110, 2, 163)
    alb = ramp(base * 0.8 + fine * 0.2, [(0.2, C(0.01, 0.012, 0.012)), (0.7, C(0.05, 0.055, 0.055)), (1.0, C(0.09, 0.1, 0.1))])
    f1, f2, _ = voronoi(9, 165); vein = smooth(f2 - f1, 0.02, 0.0) * smooth(fbm(W, H, 4, 3, 4, 167), 0.45, 0.6)
    im, d = canvas(); img, dg = canvas()
    for rr, w in [(380, 7), (350, 4), (200, 5)]: d.ellipse((CX - rr, CY - rr, CX + rr, CY + rr), outline=255, width=w)
    runes(d, CX, CY, 276, 28, 6, 169, 0.1)
    runes(d, CX, CY, 120, 10, 5, 171, 0.2)
    # золотой узор: зигзаг между кольцами, капля-яйцо в середине
    zz = [(CX + (380 + (16 if i % 2 else -16)) * math.cos(i / 96 * 2 * math.pi), CY + (380 + (16 if i % 2 else -16)) * math.sin(i / 96 * 2 * math.pi)) for i in range(97)]
    dg.line(zz, fill=255, width=5)
    for i in range(8):
        a = i / 8 * 2 * math.pi; x, y = CX + 470 * math.cos(a), CY + 470 * math.sin(a); star(dg, x, y, 26, 4, 0.3, rot=a)
    dg.ellipse((CX - 40, CY - 56, CX + 40, CY + 44), outline=255, width=6)
    rn, gm = arr(im, 1.2), arr(img, 1.0)
    alb = alb * (1 - 0.6 * rn[..., None]); alb = mix(alb, C(0.92, 0.7, 0.3), gm)
    h = base * 0.4 + fine * 0.15 - rn * 0.8 + gm * 0.5 - vein * 0.3
    glow = rn * 1.0 + blur(rn, 8) * 1.2 + blur(rn, 40) * 0.8 + vein * 0.5 + blur(vein, 6) * 0.4
    emis = (glow * (0.75 + 0.25 * fbm(W, H, 12, 7, 3, 173)))[..., None] * C(0.25, 1.0, 0.45) * 0.42
    save('koschei', shade(alb, h, 1.0, metal=gm, gloss=0.6, shin=60, emis=emis, amb=0.35))


ALL = ['tavern', 'dungeon', 'glade', 'forge', 'ice', 'graveyard', 'sky', 'cove', 'library', 'oasis', 'flooded', 'grove', 'koschei']

if __name__ == '__main__':
    for n in (sys.argv[1].split(',') if len(sys.argv) > 1 else ALL):
        globals()[n]()
