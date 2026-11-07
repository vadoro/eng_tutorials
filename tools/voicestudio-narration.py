#!/usr/bin/env python3
"""음성 해설을 VoiceStudio 목소리로 미리 만들기 (VoiceStudio가 돌아가는 컴퓨터에서 실행)

    python3 tools/voicestudio-narration.py <폴더>                       한국어 조각만 (영어 조각은 브라우저의 영어 음성 그대로)
    python3 tools/voicestudio-narration.py <폴더> --en-profile 이름|id  영어 조각은 다른 목소리로 (예: 미국 영어 선생님 목소리)
    python3 tools/voicestudio-narration.py <폴더> --english             영어 조각도 한국어와 같은 목소리로
    python3 tools/voicestudio-narration.py <폴더> --limit 5             앞의 5개만 (먼저 들어 보기)

옵션
    --profile 이름|id     한국어 조각의 VoiceStudio 프로필 (기본: 튜토리얼 내레이터 (젊은 여성))
    --en-profile 이름|id  영어 조각의 프로필 (--english보다 앞섬)
    --server URL          VoiceStudio 주소 (기본: http://localhost:3900)
    --seed N              같은 글이면 같은 소리가 나도록 고정 (기본: 7). 소리가 이상하면(무음 · 너무 빠르거나 느림) seed를 바꿔 두 번까지, 세 낱말 이하의 짧은 영어는 네 번까지, 한두 음절 한국어(가 · 을 · 비 · 디)는 일곱 번까지 다시 만들어요
    --force               이미 있는 파일도 다시 만들기 (목소리를 바꿨을 때)

하는 일
    1. <폴더>/audio/narration/pieces.json(tools/narration-pieces.cjs가 만든 읽기 조각 목록)을 읽어요.
    2. 조각마다 VoiceStudio(POST /generate)로 WAV를 만들고, 앞뒤의 긴 무음을 다듬어요.
    3. ffmpeg가 있으면 MP3(48 kbps, 모노), 없으면 macOS의 afconvert로 AAC(.m4a)로 줄여 저장해요.
    4. <폴더>/audio/narration/clips.js를 다시 써요. 페이지는 파일이 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로 읽어요.
    이미 만든 파일은 건너뛰니, 중간에 멈춰도 다시 실행하면 이어서 만들어요.

표준 라이브러리만 써요(설치할 것 없음). 만든 소리는 합성 음성이에요 — 엔진의 사용 조건(예: 비상업용)을 지켜 주세요.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import voicestudio_common as vs  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser(description='음성 해설을 VoiceStudio 목소리로 미리 만들기')
    ap.add_argument('slug')
    ap.add_argument('--profile', default='튜토리얼 내레이터 (젊은 여성)')
    ap.add_argument('--en-profile', default='', help='영어 조각의 프로필 (없으면 영어 조각은 브라우저 음성, --english면 한국어와 같은 목소리)')
    ap.add_argument('--server', default='http://localhost:3900')
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--english', action='store_true', help='영어 조각도 한국어와 같은 목소리로 만들기')
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
    items = vs.profiles(server)
    prof = vs.find_profile(server, o.profile, items)
    en_prof = vs.find_profile(server, o.en_profile, items) if o.en_profile else (prof if o.english else None)
    print(f"프로필: 한국어 {prof.get('name')} ({prof.get('id')})" + (f" · 영어 {en_prof.get('name')} ({en_prof.get('id')})" if en_prof else ' · 영어는 브라우저 음성') +
          f" · 조각 {len(pieces)}개 (한국어 {sum(p['lang'] == 'ko' for p in pieces)} · 영어 {sum(p['lang'] == 'en' for p in pieces)})")

    # 지금 있는 파일 (확장자 상관없이 id로)
    have = {}
    for fn in os.listdir(d):
        m = re.match(r'^([ke][0-9a-f]{8})\.(mp3|m4a|wav)$', fn)
        if m:
            have[m.group(1)] = fn
    cj = os.path.join(d, 'clips.js')
    old = vs.read_clips_js(cj, 'EN_CLIPS').get('clips', {})

    ext, enc = vs.encoder()
    todo = [p for p in pieces if (p['lang'] == 'ko' or en_prof) and (o.force or p['id'] not in have)]
    if o.limit:
        todo = todo[:o.limit]
    print(f'새로 만들 조각 {len(todo)}개' + ('' if en_prof else ' (영어 조각은 브라우저 음성)'))
    t0 = time.time()
    clips, odd = {}, []
    for k, p in enumerate(todo, 1):
        pf = en_prof if p['lang'] == 'en' else prof
        text = vs.readable(p['text']) if p['lang'] == 'en' else p['text']
        try:
            wav, dur, sd = vs.generate(server, text, p['lang'], pf['id'], o.seed)
        except (urllib.error.HTTPError, RuntimeError) as e:
            print(f'  [{k}/{len(todo)}] {p["id"]} 실패: {e}')
            continue
        if sd < 0:
            odd.append(p['id'])
        prev = have.get(p['id'])
        if prev and not prev.endswith('.' + ext):
            os.remove(os.path.join(d, prev))   # --force로 다른 형식으로 다시 만들 때 옛 파일을 지움
        vs.save(wav, os.path.join(d, f"{p['id']}.{ext}"), enc)
        have[p['id']] = f"{p['id']}.{ext}"
        clips[p['id']] = [have[p['id']], round(dur, 2)]
        left = (time.time() - t0) / k * (len(todo) - k)
        print(f'  [{k}/{len(todo)}] {dur:4.1f}초{" (확인 필요)" if sd < 0 else ""}  {p["text"][:40]}  (남은 시간 약 {left / 60:.0f}분)')

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
    out = {'voice': f"{prof.get('name')} · VoiceStudio 합성 음성"}
    has_en = any(p['lang'] == 'en' and p['id'] in final for p in pieces)
    old_all = vs.read_clips_js(cj, 'EN_CLIPS')
    if en_prof and en_prof is not prof:
        out['voiceEn'] = f"{en_prof.get('name')} · VoiceStudio 합성 음성"
    elif has_en and old_all.get('voiceEn') and not en_prof:
        out['voiceEn'] = old_all['voiceEn']    # 이번에 영어 조각을 만들지 않았으면 전에 적은 영어 목소리를 그대로
    out.update({'base': 'audio/narration/', 'clips': final})
    with open(cj, 'w', encoding='utf-8') as f:
        f.write('// 음성 해설에 쓸 미리 만든 음성 파일 목록 — tools/voicestudio-narration.py가 다시 써요(손으로 고치지 마세요).\n')
        f.write('// 비어 있으면 해설은 브라우저 음성으로 읽어요. voice = 한국어 조각의 목소리, voiceEn = 영어 조각의 목소리(없으면 voice)\n')
        f.write('window.EN_CLIPS = ' + json.dumps(out, ensure_ascii=False) + ';\n')
    size = sum(os.path.getsize(os.path.join(d, v[0])) for v in final.values())
    print(f'\nclips.js: 파일이 있는 조각 {len(final)}개 · 모두 {size / 1e6:.1f} MB · 걸린 시간 {(time.time() - t0) / 60:.1f}분')
    if odd:
        print(f'소리가 이상할 수 있는 조각 {len(odd)}개(들어 보고, 이상하면 파일을 지운 뒤 --seed를 바꿔 다시): ' + ' '.join(have[i] for i in odd))
    if stale:
        print(f'자막에서 사라진 조각의 파일 {len(stale)}개(지워도 돼요): ' + ' '.join(have[i] for i in stale))
    print(f'\n들어 보기: {slug}/index.html을 열고 V(음성 해설)를 켜세요. 올리기: git add {slug}/audio && git commit && git push')


if __name__ == '__main__':
    main()
