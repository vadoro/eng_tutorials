#!/usr/bin/env python3
"""음성 해설을 VoiceStudio 목소리로 미리 만들기 (VoiceStudio가 돌아가는 컴퓨터에서 실행)

    python3 tools/voicestudio-narration.py <폴더>                 한국어 조각만 (영어 조각은 브라우저의 영어 음성 그대로)
    python3 tools/voicestudio-narration.py <폴더> --english       영어 조각도 같은 목소리로
    python3 tools/voicestudio-narration.py <폴더> --limit 5       앞의 5개만 (먼저 들어 보기)

옵션
    --profile 이름|id   VoiceStudio 프로필 (기본: 튜토리얼 내레이터 (젊은 여성))
    --server URL        VoiceStudio 주소 (기본: http://localhost:3900)
    --seed N            같은 글이면 같은 소리가 나도록 고정 (기본: 7)
    --force             이미 있는 파일도 다시 만들기

하는 일
    1. <폴더>/audio/narration/pieces.json(tools/narration-pieces.cjs가 만든 읽기 조각 목록)을 읽어요.
    2. 조각마다 VoiceStudio(POST /generate)로 WAV를 만들고, 앞뒤의 긴 무음을 다듬어요.
    3. ffmpeg가 있으면 MP3(48 kbps, 모노), 없으면 macOS의 afconvert로 AAC(.m4a)로 줄여 저장해요.
    4. <폴더>/audio/narration/clips.js를 다시 써요. 페이지는 파일이 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로 읽어요.
    이미 만든 파일은 건너뛰니, 중간에 멈춰도 다시 실행하면 이어서 만들어요.

표준 라이브러리만 써요(설치할 것 없음). 만든 소리는 합성 음성이에요 — 엔진의 사용 조건(예: 비상업용)을 지켜 주세요.
"""
import argparse
import array
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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


def find_profile(server, want):
    try:
        _, _, raw = http('GET', f'{server}/profiles')
    except urllib.error.URLError as e:
        sys.exit(f'VoiceStudio에 연결하지 못했어요({server}): {e}. VoiceStudio 앱이 켜져 있는지 확인해 주세요.')
    data = json.loads(raw)
    items = data if isinstance(data, list) else next((data[k] for k in ('profiles', 'items', 'data') if isinstance(data, dict) and isinstance(data.get(k), list)), [])
    hit = [p for p in items if p.get('id') == want] or [p for p in items if p.get('name') == want]
    if not hit:
        names = ', '.join(f"{p.get('name')} ({p.get('id')})" for p in items) or '(없음)'
        sys.exit(f'프로필 "{want}"을 찾지 못했어요. 있는 프로필: {names}')
    if len(hit) > 1:
        print(f'같은 이름의 프로필이 {len(hit)}개예요 → 첫 번째({hit[0].get("id")})를 써요. 다른 것을 쓰려면 --profile에 id를 적어 주세요.')
    return hit[0]


def trim_wav(raw, keep=0.12, thresh=0.012):
    """앞뒤의 긴 무음을 잘라요(조각 사이가 너무 비지 않게). 16비트 PCM만 다루고, 아니면 그대로 돌려줘요."""
    with wave.open(io.BytesIO(raw)) as w:
        ch, sw, sr, nf = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        frames = w.readframes(nf)
    if sw != 2:
        return raw, nf / sr
    a = array.array('h', frames)
    if sys.byteorder == 'big':
        a.byteswap()
    lim = int(32767 * thresh)
    loud = [i for i in range(0, len(a), ch * 40) if max(abs(a[j]) for j in range(i, min(i + ch * 40, len(a)))) > lim]
    if not loud:
        return raw, nf / sr
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
    return out.getvalue(), (e - s) / ch / sr


def encoder():
    ff = shutil.which('ffmpeg')
    if ff:
        return 'mp3', lambda src, dst: subprocess.run([ff, '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-b:a', '48k', dst], check=True)
    af = shutil.which('afconvert')
    if af:
        return 'm4a', lambda src, dst: subprocess.run([af, '-f', 'm4af', '-d', 'aac', '-b', '48000', src, dst], check=True)
    print('ffmpeg · afconvert가 없어 WAV로 저장해요(파일이 커요). ffmpeg를 설치하면 MP3로 줄여 저장해요.')
    return 'wav', lambda src, dst: shutil.copyfile(src, dst)


def main():
    ap = argparse.ArgumentParser(description='음성 해설을 VoiceStudio 목소리로 미리 만들기')
    ap.add_argument('slug')
    ap.add_argument('--profile', default='튜토리얼 내레이터 (젊은 여성)')
    ap.add_argument('--server', default='http://localhost:3900')
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--english', action='store_true', help='영어 조각도 같은 목소리로 만들기')
    ap.add_argument('--limit', type=int, default=0, help='새로 만들 조각 수 (먼저 들어 보기)')
    ap.add_argument('--force', action='store_true')
    o = ap.parse_args()

    slug = o.slug.rstrip('/')
    d = os.path.join(ROOT, slug, 'audio', 'narration')
    pj = os.path.join(d, 'pieces.json')
    if not os.path.exists(pj):
        sys.exit(f'{slug}/audio/narration/pieces.json이 없어요. 먼저: node tools/narration-pieces.cjs {slug}')
    pieces = json.load(open(pj, encoding='utf-8'))['pieces']
    server = o.server.rstrip('/')
    prof = find_profile(server, o.profile)
    print(f"프로필: {prof.get('name')} ({prof.get('id')}) · 조각 {len(pieces)}개 (한국어 {sum(p['lang'] == 'ko' for p in pieces)} · 영어 {sum(p['lang'] == 'en' for p in pieces)})")

    # 지금 있는 파일 (확장자 상관없이 id로)
    have = {}
    for fn in os.listdir(d):
        m = re.match(r'^([ke][0-9a-f]{8})\.(mp3|m4a|wav)$', fn)
        if m:
            have[m.group(1)] = fn
    old = {}
    cj = os.path.join(d, 'clips.js')
    if os.path.exists(cj):
        m = re.search(r'window\.EN_CLIPS\s*=\s*(\{.*\});?\s*$', open(cj, encoding='utf-8').read(), re.S)
        if m:
            try:
                old = json.loads(m.group(1)).get('clips', {})
            except ValueError:
                old = {}

    ext, enc = encoder()
    todo = [p for p in pieces if (p['lang'] == 'ko' or o.english) and (o.force or p['id'] not in have)]
    if o.limit:
        todo = todo[:o.limit]
    print(f'새로 만들 조각 {len(todo)}개' + (' (영어 조각 포함)' if o.english else ' (영어 조각은 브라우저 음성)'))
    t0 = time.time()
    clips = {}
    for k, p in enumerate(todo, 1):
        body, ctype = multipart({'text': p['text'], 'language': 'English' if p['lang'] == 'en' else 'Korean',
                                 'profile_id': prof['id'], 'engine': 'omnivoice', 'seed': o.seed})
        try:
            st, hd, raw = http('POST', f'{server}/generate', body, {'Content-Type': ctype}, timeout=900)
        except urllib.error.HTTPError as e:
            print(f'  [{k}/{len(todo)}] {p["id"]} 실패 HTTP {e.code}: {e.read()[:200]!r}')
            continue
        if raw[:4] != b'RIFF':
            print(f'  [{k}/{len(todo)}] {p["id"]} 실패: WAV가 아니에요 {raw[:200]!r}')
            continue
        wav, dur = trim_wav(raw)
        prev = have.get(p['id'])
        if prev and not prev.endswith('.' + ext):
            os.remove(os.path.join(d, prev))   # --force로 다른 형식으로 다시 만들 때 옛 파일을 지움
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tf:
            tf.write(wav)
        try:
            enc(tf.name, os.path.join(d, f"{p['id']}.{ext}"))
        finally:
            os.unlink(tf.name)
        have[p['id']] = f"{p['id']}.{ext}"
        clips[p['id']] = [have[p['id']], round(dur, 2)]
        left = (time.time() - t0) / k * (len(todo) - k)
        print(f'  [{k}/{len(todo)}] {dur:4.1f}초  {p["text"][:40]}  (남은 시간 약 {left / 60:.0f}분)')

    # 목록 다시 쓰기: pieces.json에 있는 조각 중 파일이 있는 것만
    final = {}
    for p in pieces:
        fn = have.get(p['id'])
        if not fn:
            continue
        if p['id'] in clips:
            final[p['id']] = clips[p['id']]
        elif p['id'] in old and old[p['id']][0] == fn:
            final[p['id']] = old[p['id']]
        else:
            path = os.path.join(d, fn)
            dur = 0
            if fn.endswith('.wav'):
                with wave.open(path) as w:
                    dur = w.getnframes() / w.getframerate()
            final[p['id']] = [fn, round(dur, 2) or 3]
    stale = sorted(set(have) - {p['id'] for p in pieces})
    voice = f"{prof.get('name')} · VoiceStudio 합성 음성"
    with open(cj, 'w', encoding='utf-8') as f:
        f.write('// 음성 해설에 쓸 미리 만든 음성 파일 목록 — tools/voicestudio-narration.py가 다시 써요(손으로 고치지 마세요).\n')
        f.write('// 비어 있으면 해설은 브라우저 음성으로 읽어요.\n')
        f.write('window.EN_CLIPS = ' + json.dumps({'voice': voice, 'base': 'audio/narration/', 'clips': final}, ensure_ascii=False) + ';\n')
    size = sum(os.path.getsize(os.path.join(d, v[0])) for v in final.values())
    print(f'\nclips.js: 파일이 있는 조각 {len(final)}개 · 모두 {size / 1e6:.1f} MB · 걸린 시간 {(time.time() - t0) / 60:.1f}분')
    if stale:
        print(f'자막에서 사라진 조각의 파일 {len(stale)}개(지워도 돼요): ' + ' '.join(have[i] for i in stale))
    print(f'\n들어 보기: {slug}/index.html을 열고 V(음성 해설)를 켜세요. 올리기: git add {slug}/audio && git commit && git push')


if __name__ == '__main__':
    main()
