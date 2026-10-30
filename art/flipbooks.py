#!/usr/bin/env python3
"""Покадровые эффекты «Под Землёй»: огонь, дым, удар, магия — листы кадров для fx.flip (public/fx.js).

  python3 art/flipbooks.py   — пишет public/vfx/flip/<имя>.webp и печатает число кадров

Всё считается шумом (периодический value-noise с несколькими октавами и искажением координат), без чужих текстур.
Лист — кадры в один ряд, каждый S×S px, фон прозрачный. Огонь — петля (шум периодичен по времени),
остальные проигрываются один раз. Цвет удара и магии — разные листы (золото, кровь, пурпур, зелень).
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'vfx', 'flip')
RNG = np.random.default_rng(11)


def lattice(n):
    return RNG.random((n, n, n)).astype(np.float32)


LAT = [lattice(n) for n in (4, 8, 16, 32, 64)]


def vnoise(x, y, z, lat):
    """периодический трёхмерный value-noise: x, y, z в «клетках» решётки (период — размер решётки)"""
    n = lat.shape[0]
    xi, yi, zi = np.floor(x).astype(int), np.floor(y).astype(int), np.floor(z).astype(int)
    xf, yf, zf = x - xi, y - yi, z - zi
    u, v, w = [t * t * (3 - 2 * t) for t in (xf, yf, zf)]
    def L(a, b, c): return lat[a % n, b % n, c % n]
    x0 = L(xi, yi, zi) * (1 - u) + L(xi + 1, yi, zi) * u
    x1 = L(xi, yi + 1, zi) * (1 - u) + L(xi + 1, yi + 1, zi) * u
    x2 = L(xi, yi, zi + 1) * (1 - u) + L(xi + 1, yi, zi + 1) * u
    x3 = L(xi, yi + 1, zi + 1) * (1 - u) + L(xi + 1, yi + 1, zi + 1) * u
    return (x0 * (1 - v) + x1 * v) * (1 - w) + (x2 * (1 - v) + x3 * v) * w


def fbm(x, y, z, octaves=4, base=1):
    """x, y, z — доли периода (0..1 → одна петля); octaves решёток с удвоением частоты"""
    s, a, norm = 0, 1, 0
    for o in range(octaves):
        lat = LAT[min(len(LAT) - 1, base + o)]; n = lat.shape[0]
        s = s + a * vnoise(x * n, y * n, z * n, lat); norm += a; a *= 0.55
    return s / norm


def ramp(v, stops):
    """цветовая шкала: stops — [(t, (r, g, b, a)), ...]"""
    v = np.clip(v, 0, 1); out = np.zeros(v.shape + (4,), np.float32)
    ts = [s[0] for s in stops]; cs = np.array([s[1] for s in stops], np.float32)
    for c in range(4): out[..., c] = np.interp(v, ts, cs[:, c])
    return out


def save(name, frames):
    S = frames[0].shape[0]
    sheet = np.concatenate(frames, axis=1)
    img = Image.fromarray((np.clip(sheet, 0, 1) * 255).astype(np.uint8), 'RGBA')
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name + '.webp'); img.save(p, 'WEBP', quality=88, alpha_quality=90, method=6)
    print(f'{name}: {len(frames)} кадров по {S} px, {os.path.getsize(p) // 1024} КБ')


def grid(S):
    y, x = np.mgrid[0:S, 0:S].astype(np.float32) / S
    return x, y


def fire(S=160, N=16):
    """язык пламени, петля: шум ползёт вверх, форма — капля, сверху рвётся на языки"""
    x, y = grid(S); out = []
    for f in range(N):
        t = f / N
        # искажение: пламя колышется
        wx = fbm(x * 0.5, y * 0.5 + t, np.full_like(x, t), 3, 0) - 0.5
        n = fbm(x + wx * 0.35, y + t * 1.0, np.full_like(x, t * 1.0), 4, 1)
        h = 1 - y                                     # высота от низа
        cx = 0.5 + wx * 0.12 * h
        width = 0.22 * (1 - h) ** 0.55 + 0.02
        body = np.exp(-((x - cx) / width) ** 2)
        env = np.exp(-((x - cx) / (width * 1.7)) ** 2) * np.clip(1.15 - h, 0, 1) ** 0.4
        I = body * (1.25 - h * 1.15) + (n - 0.5) * 1.1 * (0.35 + h) * env
        I = np.clip(I, 0, 1.4)
        I[y > 0.97] *= 0.3
        col = ramp(I, [(0.0, (0, 0, 0, 0)), (0.28, (0.45, 0.05, 0.0, 0.0)), (0.42, (0.9, 0.22, 0.02, 0.75)), (0.62, (1.0, 0.55, 0.1, 0.95)),
                       (0.85, (1.0, 0.86, 0.45, 1.0)), (1.05, (1.0, 0.98, 0.85, 1.0))])
        out.append(col)
    save('fire', out)


def smoke(S=192, N=16):
    """клуб дыма: растёт, поднимается, тает; светлее сверху слева"""
    x, y = grid(S); out = []
    for f in range(N):
        t = f / (N - 1)
        r = 0.16 + 0.26 * (1 - (1 - t) ** 2)
        cy = 0.56 - 0.1 * t
        d = np.hypot(x - 0.5, (y - cy) * 1.1)
        n = fbm(x * 0.7 + t * 0.15, y * 0.7 - t * 0.2, np.full_like(x, t * 0.4), 5, 1)
        dens = np.clip((r - d) / r * 1.6 + (n - 0.5) * 1.6, 0, 1) * (1 - t) ** 1.3
        from PIL import ImageFilter
        dens = np.asarray(Image.fromarray((dens * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(S / 60))).astype(np.float32) / 255
        # освещение: градиент сглаженной плотности
        gy, gx = np.gradient(dens)
        light = np.clip(0.55 + (-gx - gy) * 14, 0.25, 1.0)
        g = 0.32 + 0.38 * light
        col = np.dstack([g * 0.96, g * 0.92, g * 0.9, np.clip(dens * 1.2, 0, 0.92)])
        out.append(col.astype(np.float32))
    save('smoke', out)


def impact(name, hue, S=192, N=12):
    """удар: вспышка, лучи, кольцо, искры"""
    x, y = grid(S); out = []
    cx, cy = x - 0.5, y - 0.5; r = np.hypot(cx, cy); a = np.arctan2(cy, cx)
    rays = fbm((a / (2 * np.pi)) % 1.0, np.zeros_like(a), np.zeros_like(a), 3, 2)
    sparks = RNG.random((40, 3))
    core_c, glow_c = np.array(hue[0], np.float32), np.array(hue[1], np.float32)
    for f in range(N):
        t = f / (N - 1)
        core = np.exp(-(r / (0.06 + 0.1 * t)) ** 2) * (1 - t) ** 1.5 * 1.6
        streak = np.clip((rays - 0.45) * 3, 0, 1) * np.exp(-((r - (0.08 + 0.32 * t)) / (0.12 + 0.05 * t)) ** 2) * (1 - t) ** 1.2
        ring = np.exp(-((r - (0.1 + 0.38 * t)) / 0.018) ** 2) * (1 - t) ** 1.6 * 0.9
        I = core + streak * 0.9 + ring
        # искры
        sp = np.zeros_like(r)
        for ang, spd, sz in sparks:
            ang *= 2 * np.pi; d = (0.05 + spd * 0.42) * (t ** 0.7)
            px, py = 0.5 + np.cos(ang) * d, 0.5 + np.sin(ang) * d + 0.08 * t * t
            sp += np.exp(-(((x - px) ** 2 + (y - py) ** 2) / (0.006 * (0.4 + sz)) ** 2)) * (1 - t)
        I = I + sp * 0.9
        rgb = glow_c[None, None, :] * np.clip(I, 0, 1)[..., None] + (core_c - glow_c)[None, None, :] * np.clip(I - 0.7, 0, 1)[..., None]
        col = np.dstack([np.clip(rgb, 0, 1), np.clip(I, 0, 1)])
        out.append(col.astype(np.float32))
    save(name, out)


def magic(name, hue, S=192, N=16):
    """магия: светящийся круг с рунными засечками закручивается и рассыпается искрами"""
    x, y = grid(S); out = []
    cx, cy = x - 0.5, y - 0.5; r = np.hypot(cx, cy); a = np.arctan2(cy, cx)
    c1, c2 = np.array(hue[0], np.float32), np.array(hue[1], np.float32)
    for f in range(N):
        t = f / (N - 1)
        grow = 1 - (1 - min(1, t * 1.6)) ** 2
        R = 0.12 + 0.24 * grow
        rot = t * 2.6
        ticks = (np.cos((a + rot) * 12) > 0.86) * np.exp(-((r - R * 0.86) / 0.02) ** 2)
        ring = np.exp(-((r - R) / 0.012) ** 2) + 0.6 * np.exp(-((r - R * 0.7) / 0.008) ** 2)
        swirl = fbm(((a + rot * 2) / (2 * np.pi)) % 1.0, np.clip(r * 2, 0, 1), np.full_like(r, t * 0.5), 3, 1)
        haze = np.exp(-(r / (R * 1.05)) ** 2) * np.clip((swirl - 0.35) * 2.2, 0, 1) * 0.75
        fade = (1 - max(0, t - 0.6) / 0.4) ** 1.5
        sp = np.zeros_like(r)
        for k in range(14):
            ang = k / 14 * 2 * np.pi + rot * 1.6 + (k % 3) * 0.4; rr = R * (1.05 + 0.25 * t * ((k % 4) / 3))
            px, py = 0.5 + np.cos(ang) * rr, 0.5 + np.sin(ang) * rr
            sp += np.exp(-(((x - px) ** 2 + (y - py) ** 2) / 0.008 ** 2))
        I = (ring * 0.95 + ticks * 0.9 + haze + sp * 0.9) * fade
        rgb = c2[None, None, :] * np.clip(I, 0, 1)[..., None] + (c1 - c2)[None, None, :] * np.clip(I - 0.6, 0, 1)[..., None]
        out.append(np.dstack([np.clip(rgb, 0, 1), np.clip(I, 0, 1)]).astype(np.float32))
    save(name, out)


if __name__ == '__main__':
    fire()
    smoke()
    impact('hit-gold', ((1, .98, .85), (1, .66, .18)))
    impact('hit-blood', ((1, .85, .75), (.95, .16, .06)))
    magic('magic-violet', ((.96, .88, 1), (.62, .32, 1)))
    magic('magic-green', ((.9, 1, .94), (.25, .95, .55)))
    magic('magic-gold', ((1, .97, .85), (1, .72, .2)))
