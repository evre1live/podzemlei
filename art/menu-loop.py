#!/usr/bin/env python3
"""Цикличное видео главного меню «Под Землёй» из ролика нейросети (Higgsfield, Seedance 2.0).

  python3 art/menu-loop.py ролик.mp4 [F]   — бесшовная петля и файлы для сайта в public/ui/v4

Петля: последние F кадров (по умолчанию 30, 1,25 с) плавно перетекают в первые F, а ролик начинается с кадра F —
стык не виден. Смешивание идёт прямо в YUV, без пересчёта цвета. Звук отбрасывается.
Для сайта: menu-1080/720.webm (VP9, для Chrome и Firefox) и menu-1080/720.mp4 (H.264, для Safari),
menu-poster.webp и menu-poster-720.webp — первый кадр петли (показывается, пока видео грузится или выключено).
После пересборки поправьте отпечатки ?v= в MENU (public/app.js) — скрипт их печатает.
Нужен ffmpeg с libx264 и libvpx-vp9, Python с numpy и Pillow.
"""
import hashlib, json, os, subprocess, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'ui', 'v4')


def loop(src, dst, F):
    info = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
                                      'stream=width,height,r_frame_rate,nb_read_frames', '-of', 'json', src], capture_output=True, text=True).stdout)['streams'][0]
    W, H, N, fps = info['width'], info['height'], int(info['nb_read_frames']), info['r_frame_rate']
    FS = W * H * 3 // 2
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', f'{W}x{H}', '-r', fps, '-i', '-',
                            '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', dst], stdin=subprocess.PIPE)
    head = [np.frombuffer(dec.stdout.read(FS), dtype=np.uint8).astype(np.float32) for _ in range(F)]
    k = 0
    while True:
        b = dec.stdout.read(FS)
        if len(b) < FS: break
        f = np.frombuffer(b, dtype=np.uint8)
        j = k - (N - 2 * F)
        if j >= 0:
            t = (j + 1) / F; t = t * t * (3 - 2 * t)  # плавный вход и выход
            f = np.clip(f.astype(np.float32) * (1 - t) + head[j] * t + 0.5, 0, 255).astype(np.uint8)
        enc.stdin.write(f.tobytes()); k += 1
    enc.stdin.close(); enc.wait(); dec.wait()
    print(f'петля: {k} кадров из {N}, {fps} к/с')


def main():
    if len(sys.argv) < 2: print(__doc__); return
    src = sys.argv[1]; F = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    os.makedirs(OUT, exist_ok=True)
    master = os.path.join(OUT, '.menu-master.mp4')
    loop(src, master, F)
    run = lambda *a: subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', master, '-an', *a], check=True)
    run('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', os.path.join(OUT, 'menu-1080.mp4'))
    run('-vf', 'scale=1280:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', os.path.join(OUT, 'menu-720.mp4'))
    run('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-pix_fmt', 'yuv420p', os.path.join(OUT, 'menu-1080.webm'))
    run('-vf', 'scale=1280:-2:flags=lanczos', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '35', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-pix_fmt', 'yuv420p', os.path.join(OUT, 'menu-720.webm'))
    png = os.path.join(OUT, '.poster.png')
    run('-frames:v', '1', png)
    im = Image.open(png).convert('RGB')
    im.save(os.path.join(OUT, 'menu-poster.webp'), quality=80, method=6)
    im.resize((1280, round(im.height * 1280 / im.width)), Image.LANCZOS).save(os.path.join(OUT, 'menu-poster-720.webp'), quality=78, method=6)
    os.remove(png); os.remove(master)
    for n in ['menu-1080.webm', 'menu-720.webm', 'menu-1080.mp4', 'menu-720.mp4', 'menu-poster.webp', 'menu-poster-720.webp']:
        p = os.path.join(OUT, n)
        print(f'{n}: {os.path.getsize(p) // 1024} КБ, ?v={hashlib.md5(open(p, "rb").read()).hexdigest()[:8]}')


if __name__ == '__main__':
    main()
