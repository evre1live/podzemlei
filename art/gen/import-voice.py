#!/usr/bin/env python3
"""Импорт озвучки ElevenLabs (архив pz-voice.zip из art/gen/pz-voice.py) в игру «Под Землёй».

  python3 art/gen/import-voice.py <pz-voice.zip или папка с mp3>

Каждая фраза: тишина по краям срезается, громкость выравнивается (−16 LUFS), голосам боссов добавляется
своё звучание (Анубису — эхо каменного зала, Чернобогу — ниже и гулко, Аиду — глубина, Морене — холодный
воздух), затем моно MP3 64 кбит/с → public/sfx/voice/v1/<имя>.mp3. Список фраз — manifest.json рядом:
игра играет только то, что в нём есть. Нужен ffmpeg.
"""
import json, os, shutil, subprocess, sys, tempfile, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'sfx', 'voice', 'v1')
TRIM = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08,areverse'
LOUD = 'loudnorm=I=-16:TP=-1.5:LRA=11'
# звучание по говорящему (по началу имени файла)
FX = {
    'b_anubis': 'aecho=0.8:0.72:70|140:0.32|0.18',
    'b_chernobog': 'asetrate=44100*0.9,aresample=44100,atempo=1.111,bass=g=4,aecho=0.8:0.6:45:0.22',
    'b_hades': 'bass=g=3,aecho=0.8:0.6:95:0.22',
    'b_morena': 'highpass=f=140,treble=g=2,aecho=0.8:0.5:55:0.18',
    'b_lucifer': 'bass=g=3',
    'n_': 'bass=g=1.5',
}


def chain(name):
    fx = next((v for k, v in FX.items() if name.startswith(k)), '')
    return ','.join(x for x in ['aresample=44100', TRIM, fx, LOUD, 'afade=t=in:d=0.015'] if x)


def main(src):
    tmp = None
    if src.endswith('.zip'):
        tmp = tempfile.mkdtemp(prefix='pzv')
        with zipfile.ZipFile(src) as z:
            for n in z.namelist():
                if n.endswith('.mp3') and '/' not in n.strip('/') and not n.startswith('.'):
                    z.extract(n, tmp)
        src = tmp
    os.makedirs(OUT, exist_ok=True)
    names = []
    for f in sorted(os.listdir(src)):
        if not f.endswith('.mp3'):
            continue
        name = f[:-4]
        out = os.path.join(OUT, f)
        r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(src, f), '-af', chain(name), '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', out], capture_output=True, text=True)
        if r.returncode:
            print('ошибка', name, r.stderr[:300])
            continue
        d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout.strip()
        print(f'{name:18} {float(d or 0):5.2f} с  {os.path.getsize(out) // 1024:3d} КБ')
        names.append(name)
    old = []
    man = os.path.join(OUT, 'manifest.json')
    if os.path.exists(man):
        old = json.load(open(man))
    names = sorted(set(old) | set(names))
    json.dump(names, open(man, 'w'), ensure_ascii=False)
    print('фраз в игре:', len(names))
    if tmp:
        shutil.rmtree(tmp)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
