#!/usr/bin/env python3
"""«Под Землёй» — озвучка через ElevenLabs. Запускается на своём компьютере (нужен только python3 и curl).

  python3 pz-voice.py              — озвучить всё, чего ещё нет в папке pz-voice
  python3 pz-voice.py n_turn e_f_0 — переозвучить только эти фразы

Ключ спрашивается при запуске (ввод не виден) или берётся из ELEVENLABS_API_KEY. Он никуда не сохраняется:
на время запроса лежит во временном файле только для curl и сразу стирается.
Результат — папка pz-voice рядом со скриптом и архив pz-voice.zip: его и нужно прислать.
"""
import getpass, json, os, re, shutil, subprocess, sys, tempfile, time, zipfile

API = 'https://api.elevenlabs.io/v1'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'pz-voice')

# голоса из стандартной библиотеки ElevenLabs (есть у всех); если какого-то нет — берётся похожий по полу
VOICES = {
    'narrator': ('George', 'male'),     # тёплый рассказчик у костра
    'lucifer': ('Callum', 'male'),      # бархатный, насмешливый
    'morena': ('Charlotte', 'female'),  # холодный шёпот
    'hades': ('Daniel', 'male'),        # глубокий, медленный
    'anubis': ('Brian', 'male'),        # гулкий (эхо добавлю при обработке)
    'chernobog': ('Bill', 'male'),      # хриплый, громовой
    'hero_m': ('Chris', 'male'),        # эмоции героя
    'hero_f': ('Jessica', 'female'),    # эмоции героини
}

# имя файла → (голос, текст). В квадратных скобках — подсказки интонации для модели eleven_v3;
# для старой модели они вырезаются.
LINES = {
    # рассказчик
    'n_start': ('narrator', '[warmly] Партия начинается. Удачи, герои!'),
    'n_turn': ('narrator', 'Ваш ход.'),
    'n_door': ('narrator', '[dramatic, low] Дверь открыта…'),
    'n_victory': ('narrator', '[triumphant] Победа!'),
    'n_caught': ('narrator', '[grim] Расплата!'),
    'n_level': ('narrator', '[proud] Новый уровень!'),
    'n_death': ('narrator', '[solemn] Герой пал…'),
    'n_legend': ('narrator', '[awed] Легендарная находка!'),
    'n_curse': ('narrator', '[ominous] Проклятие!'),
    'n_boss': ('narrator', '[tense whisper] Из тьмы выходит босс…'),
    'n_win': ('narrator', '[triumphant] Подземелье покорено!'),
    'n_lose': ('narrator', '[calm] Партия окончена. В следующий раз повезёт.'),
    # боссы: выход (те же слова, что на экране при его появлении, shared/cards.js → quote) и поражение
    'b_lucifer': ('lucifer', '[mocking, warm] Ну здравствуй, герой. Присаживайся, у нас тепло.'),
    'b_lucifer_die': ('lucifer', '[pained] Это… ещё не конец!'),
    'b_morena': ('morena', '[cold whisper] Зима пришла и под землю. Надолго.'),
    'b_morena_die': ('morena', '[whispers] Весна… опять ты…'),
    'b_hades': ('hades', '[slow, deep] Добро пожаловать в моё подземелье. Обратно не провожаем.'),
    'b_hades_die': ('hades', '[slow] Даже смерть… отступает.'),
    'b_anubis': ('anubis', '[solemn] Положи сердце на весы. Посмотрим, сколько ты весишь.'),
    'b_anubis_die': ('anubis', '[slow] Твоё сердце… легче пера.'),
    'b_chernobog': ('chernobog', '[menacing, low] Всё, что во тьме, — моё. А ты давно во тьме.'),
    'b_chernobog_die': ('chernobog', '[growling] Тьма… вернётся…'),
}
# эмоции героев: те же восемь фраз, что в игре, мужским и женским голосом
EMOTES = ['[laughs] Ну ты и жук!', '[warmly] Спасибо!', '[surprised] Ой…', '[menacing] Сейчас будет больно.',
          '[friendly] Хорошая игра!', '[laughs] Ха-ха!', '[thoughtful] Подумаю…', '[cheerful] Удачи!']
for i, t in enumerate(EMOTES):
    LINES[f'e_m_{i}'] = ('hero_m', t)
    LINES[f'e_f_{i}'] = ('hero_f', t)


def curl(args, key, body=None, out=None):
    """Запрос через curl (у него системные сертификаты macOS). Ключ — из временного файла заголовков."""
    fd, hdr = tempfile.mkstemp(prefix='pzv'); os.close(fd)
    os.chmod(hdr, 0o600)
    try:
        with open(hdr, 'w') as f:
            f.write(f'xi-api-key: {key}\n')
        cmd = ['curl', '-sS', '-H', f'@{hdr}', '-w', '\n%{http_code}']
        if body is not None:
            cmd += ['-H', 'Content-Type: application/json', '--data-binary', '@-']
        if out:
            cmd += ['-o', out]
        r = subprocess.run(cmd + args, input=json.dumps(body).encode() if body is not None else None, capture_output=True)
        text = r.stdout.decode('utf8', 'replace')
        code = int(text.strip().rsplit('\n', 1)[-1] or 0) if text.strip() else 0
        return code, text.rsplit('\n', 1)[0] if '\n' in text else '', r.stderr.decode('utf8', 'replace')
    finally:
        os.remove(hdr)


def main():
    if not shutil.which('curl'):
        sys.exit('Нужен curl — на macOS он есть всегда; на Windows поставьте curl или Git for Windows.')
    key = os.environ.get('ELEVENLABS_API_KEY') or getpass.getpass('Вставьте ключ ElevenLabs (ввод не виден) и нажмите Enter: ').strip()
    if not key:
        sys.exit('Ключ не введён.')
    os.makedirs(OUT, exist_ok=True)

    code, body, err = curl([f'{API}/voices'], key)
    if code == 401:
        sys.exit('Ключ не подошёл (401). Проверьте его в ElevenLabs → Developers → API Keys; у ключа должен быть доступ к Text to Speech и Voices.')
    if code != 200:
        sys.exit(f'Не удалось получить список голосов: {code} {body[:200]} {err[:200]}')
    voices = json.loads(body).get('voices', [])
    ids = {}
    for role, (name, sex) in VOICES.items():
        v = next((x for x in voices if x.get('name', '').split(' ')[0].lower() == name.lower()), None)
        v = v or next((x for x in voices if (x.get('labels') or {}).get('gender') == sex), None) or (voices[0] if voices else None)
        if not v:
            sys.exit('В аккаунте нет ни одного голоса.')
        ids[role] = v['voice_id']
        print(f'  {role:10} → {v["name"]}')

    only = set(sys.argv[1:])
    todo = [k for k in LINES if k in only] if only else [k for k in LINES if not os.path.exists(os.path.join(OUT, k + '.mp3'))]
    if not todo:
        print('Всё уже озвучено. Чтобы переделать фразу, передайте её имя: python3 pz-voice.py n_turn')
    model = 'eleven_v3'
    for n, k in enumerate(todo, 1):
        role, text = LINES[k]
        out = os.path.join(OUT, k + '.mp3')
        for attempt in range(4):
            t = text if model == 'eleven_v3' else re.sub(r'\[[^\]]*\]\s*', '', text)
            settings = {'stability': 0.5} if model == 'eleven_v3' else {'stability': 0.45, 'similarity_boost': 0.8, 'style': 0.45, 'use_speaker_boost': True}
            code, body, err = curl([f'{API}/text-to-speech/{ids[role]}?output_format=mp3_44100_128'], key,
                                   {'text': t, 'model_id': model, 'voice_settings': settings}, out)
            if code == 200:
                print(f'[{n}/{len(todo)}] {k}: готово')
                break
            msg = ''
            try:
                msg = open(out, encoding='utf8', errors='replace').read()[:300]
                os.remove(out)
            except OSError:
                pass
            if code in (400, 404, 422) and model == 'eleven_v3':
                print('  модель eleven_v3 недоступна для этого ключа — беру eleven_multilingual_v2')
                model = 'eleven_multilingual_v2'
                continue
            if code == 429 or code >= 500:
                time.sleep(3 + attempt * 4)
                continue
            sys.exit(f'{k}: ошибка {code}: {msg} {err[:200]}')
        else:
            sys.exit(f'{k}: не получилось после нескольких попыток, запустите скрипт ещё раз — он продолжит с этого места.')

    with open(os.path.join(OUT, 'voices.json'), 'w', encoding='utf8') as f:
        json.dump({'model': model, 'voices': {r: VOICES[r][0] for r in VOICES}, 'lines': {k: LINES[k][1] for k in LINES}}, f, ensure_ascii=False, indent=1)
    z = os.path.join(HERE, 'pz-voice.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name in sorted(os.listdir(OUT)):
            zf.write(os.path.join(OUT, name), name)
    print(f'\nГотово: {z}\nПришлите этот архив в чат.')


if __name__ == '__main__':
    main()
