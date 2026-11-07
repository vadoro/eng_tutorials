"""VoiceStudio로 음성 파일을 만드는 도구들(voicestudio-narration.py · voicestudio-dialogue.py)이 함께 쓰는 부분.

표준 라이브러리만 써요. VoiceStudio(로컬 앱, 기본 http://localhost:3900)의 POST /generate로 WAV를 받아
앞뒤 무음을 다듬고, ffmpeg(MP3) 또는 macOS afconvert(AAC .m4a)로 줄여 저장해요.
"""
import array
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import uuid
import wave


def http(method, url, body=None, headers=None, timeout=30):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, dict(r.headers), r.read()


def multipart(fields):
    b = uuid.uuid4().hex
    out = io.BytesIO()
    for k, v in fields.items():
        out.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n'.encode())
        out.write(str(v).encode('utf-8'))
        out.write(b'\r\n')
    out.write(f'--{b}--\r\n'.encode())
    return out.getvalue(), f'multipart/form-data; boundary={b}'


def profiles(server):
    try:
        _, _, raw = http('GET', f'{server}/profiles')
    except urllib.error.URLError as e:
        sys.exit(f'VoiceStudio에 연결하지 못했어요({server}): {e}. VoiceStudio 앱이 켜져 있는지 확인해 주세요.')
    data = json.loads(raw)
    return data if isinstance(data, list) else next((data[k] for k in ('profiles', 'items', 'data') if isinstance(data, dict) and isinstance(data.get(k), list)), [])


def find_profile(server, want, items=None):
    items = items if items is not None else profiles(server)
    hit = [p for p in items if p.get('id') == want] or [p for p in items if p.get('name') == want]
    if not hit:
        names = ', '.join(f"{p.get('name')} ({p.get('id')})" for p in items) or '(없음)'
        sys.exit(f'프로필 "{want}"을 찾지 못했어요. 있는 프로필: {names}')
    if len(hit) > 1:
        print(f'같은 이름의 프로필이 {len(hit)}개예요 → 첫 번째({hit[0].get("id")})를 써요. 다른 것을 쓰려면 프로필 id를 적어 주세요.')
    return hit[0]


def trim_wav(raw, keep=0.12, thresh=0.012):
    """앞뒤의 긴 무음을 잘라요(조각 사이가 너무 비지 않게). 16비트 PCM만 다루고, 아니면 그대로 돌려줘요.
    돌려주는 값: (wav 바이트, 길이 초, 소리가 있었는지)"""
    with wave.open(io.BytesIO(raw)) as w:
        ch, sw, sr, nf = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        frames = w.readframes(nf)
    if sw != 2:
        return raw, nf / sr, True
    a = array.array('h', frames)
    if sys.byteorder == 'big':
        a.byteswap()
    lim = int(32767 * thresh)
    loud = [i for i in range(0, len(a), ch * 40) if max(abs(a[j]) for j in range(i, min(i + ch * 40, len(a)))) > lim]
    if not loud:
        return raw, nf / sr, False
    pad = int(keep * sr) * ch
    s, e = max(0, loud[0] - pad), min(len(a), loud[-1] + ch * 40 + pad)
    s -= s % ch
    e -= e % ch
    b = a[s:e]
    if sys.byteorder == 'big':
        b.byteswap()
    out = io.BytesIO()
    with wave.open(out, 'wb') as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(b.tobytes())
    return out.getvalue(), (e - s) / ch / sr, True


def encoder():
    ff = shutil.which('ffmpeg')
    if ff:
        return 'mp3', lambda src, dst: subprocess.run([ff, '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-b:a', '48k', dst], check=True)
    af = shutil.which('afconvert')
    if af:
        return 'm4a', lambda src, dst: subprocess.run([af, '-f', 'm4af', '-d', 'aac', '-b', '48000', src, dst], check=True)
    print('ffmpeg · afconvert가 없어 WAV로 저장해요(파일이 커요). ffmpeg를 설치하면 MP3로 줄여 저장해요.')
    return 'wav', lambda src, dst: shutil.copyfile(src, dst)


def bare(text):
    """자막이 괄호 안의 영어에서 나뉘면 조각 앞에 ')' · 끝에 '('가 남아요(누구에 대한 문제인지( · ), 무엇을 묻는지.).
    엔진은 앞의 ')'를 '픽'처럼 짧은 소리로 읽어서 떼어요(파일 이름 = 조각 id는 원래 글로 정하니 바뀌지 않아요)"""
    s = re.sub(r'^[\s)\]]+', '', str(text))
    s = re.sub(r'[\s(\[]+$', '', s)
    return s.lstrip(' ,')


def readable(text):
    """화면용 기호를 소리 내어 읽기 좋게: … · ↔ → — ((?))(안 들린 말) → 쉼"""
    s = bare(str(text).replace('((?))', '…'))
    open_end = s.rstrip().endswith('…')
    s = re.sub(r'\s*[↔→]\s*', ', ', s)
    s = re.sub(r'\s+·\s+', ', ', s)
    s = re.sub(r'\s+—\s+', ', ', s)
    s = re.sub(r'^\s*…\s*', '', s)
    s = re.sub(r'\s*…\s*$', '', s)
    s = re.sub(r'\s*…\s*', ', ', s)
    s = re.sub(r'(\d)\s*oz\b', r'\1 ounces', s)   # 16 oz → 16 ounces (엔진은 oz를 '오-즈'로 읽어요)
    s = re.sub(r'(?<=\d),(?=\d{3}(?!\d))', '', s)   # 1,000 → 1000 (아래 쉼표 다듬기가 '1, 000'으로 떼지 않게)
    s = re.sub(r'(\d), (\$\d)', r'\1. \2', s)   # 표의 줄 500, $40 → 500. $40 (쉼표로는 쉬지 않아 '$540'처럼 들려요)
    s = re.sub(r'\b([Aa])isle\b', lambda m: 'Isle' if m.group(1) == 'A' else 'isle', s)   # 엔진은 Aisle을 '에이즐'로 읽기도 해요(소리는 같음)
    s = re.sub(r'(,\s*)+', ', ', s)
    s = re.sub(r'\s{2,}', ' ', s).strip(' ,')
    # 끝에 문장부호가 없는 낱말 · 구(intersection, turn left)는 마침표를 붙여요 — 엔진이 한 문장으로 알아
    # 덜 뭉개요(파일 이름 = 줄 id는 원래 글로 정하니 바뀌지 않아요)
    return s + '.' if s and s[-1] not in '.!?' and not open_end else s


def units(text, lang):
    """말의 길이(영어 낱말 수 · 한국어 음절 수 + 영어 낱말) — 만든 소리가 너무 빠르거나 느린지 볼 때"""
    if lang == 'en':
        return max(1, len(re.findall(r"[A-Za-z0-9'’-]+", text)))
    return max(1, len(re.findall(r'[가-힣]', text)) + len(re.findall(r'[A-Za-z]+', text)) * 2 + len(re.findall(r'\d', text)))


def is_short(text, lang):
    """세 낱말 이하의 짧은 영어 — 엔진이 너무 빨리 뭉개 읽기 쉬워요"""
    return lang == 'en' and units(text, lang) <= 3


def badness(text, lang, dur, sound, keep=0.12):
    """0이면 그럴듯한 소리, 클수록 이상해요(소리 없음 · 말에 비해 너무 짧거나 긴 소리 — 가끔 엔진이 잡음 · 무음을
    돌려주거나, 짧은 말을 0.3초 안에 뭉개 읽어요). 영어는 앞뒤 여백을 뺀 말소리 1초에 읽은 글자 수로 봐요
    (보통 문장 12~20자, 짧은 말은 끝을 늘여 읽어 더 느림)."""
    if not sound or dur < 0.25:
        return 99.0
    if lang == 'en':
        # 숫자(20, 12:30)는 한 자리를 글자 네 개쯤으로 쳐요 — 숫자만 있는 글(20)에서 0으로 나누지 않게
        letters = sum(ch.isalpha() for ch in text) + 4 * sum(ch.isdigit() for ch in text)
        if not letters:
            return 0.0
        rate = letters / max(dur - 2 * keep, 0.05)
        lo, hi = 4.0, (18.0 if is_short(text, lang) else 22.0)
    else:
        rate = units(text, lang) / dur
        lo, hi = 1.2, 11.0
    return max(0.0, rate / hi - 1, lo / rate - 1)


def plausible(text, lang, dur, sound):
    return badness(text, lang, dur, sound) == 0


def few_syllables(text, lang):
    """한두 음절 한국어(조사 · 보기 글자: 가, 을, 비, 디) — 엔진이 seed에 따라 무음만 돌려주기도 해요"""
    return lang == 'ko' and units(text, lang) <= 2


def generate(server, text, lang, profile_id, seed, tries=3):
    """WAV를 만들어 다듬어 돌려줘요: (wav 바이트, 길이 초, 쓴 seed). 이상한 소리면 seed를 바꿔 다시(최대 tries번).
    짧은 영어는 seed를 다섯 번까지 바꿔 봐요(speed를 낮추면 엔진이 말을 늘이지 않고 앞에 무음만 넣어서 seed만 바꿔요).
    한두 음절 한국어는 세 seed 내리 무음이 나오기도 해서 여덟 번까지 바꿔 봐요.
    끝내 이상하면 가장 덜 이상한 것을 돌려주고 seed를 음수로(경고용)."""
    best = None
    n = max(tries, 5) if is_short(text, lang) else max(tries, 8) if few_syllables(text, lang) else tries
    for k in range(n):
        sd = seed + k * 1000
        body, ctype = multipart({'text': text, 'language': 'English' if lang == 'en' else 'Korean',
                                 'profile_id': profile_id, 'engine': 'omnivoice', 'seed': sd})
        _, _, raw = http('POST', f'{server}/generate', body, {'Content-Type': ctype}, timeout=900)
        if raw[:4] != b'RIFF':
            raise RuntimeError(f'WAV가 아니에요: {raw[:200]!r}')
        wav, dur, sound = trim_wav(raw)
        bad = badness(text, lang, dur, sound)
        if bad == 0:
            return (wav, dur, sd)
        if best is None or bad < best[0]:
            best = (bad, wav, dur, sd)
    return (best[1], best[2], -best[3])


def save(wav, path, enc):
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tf:
        tf.write(wav)
    try:
        enc(tf.name, path)
    finally:
        os.unlink(tf.name)


def read_clips_js(path, var):
    """clips.js의 window.<var> = {...}; 를 읽어요(없으면 {})"""
    if not os.path.exists(path):
        return {}
    m = re.search(r'window\.' + var + r'\s*=\s*(\{.*\});?\s*$', open(path, encoding='utf-8').read(), re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(1))
    except ValueError:
        return {}
