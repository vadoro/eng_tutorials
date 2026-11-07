#!/usr/bin/env python3
"""대화 목소리를 VoiceStudio로 미리 만들기 (VoiceStudio가 돌아가는 컴퓨터에서 실행) — 회화 · 듣기 튜토리얼

    python3 tools/voicestudio-dialogue.py <폴더>            말하는 사람마다 그 사람의 프로필로
    python3 tools/voicestudio-dialogue.py <폴더> --limit 5  앞의 5개만 (먼저 들어 보기)
    python3 tools/voicestudio-dialogue.py <폴더> --only us  한 사람의 말만

옵션
    --server URL   VoiceStudio 주소 (기본: http://localhost:3900)
    --seed N       같은 글이면 같은 소리가 나도록 고정 (기본: 7). 소리가 이상하면(무음 · 너무 빠르거나 느림) seed를 바꿔 두 번까지, 세 낱말 이하의 짧은 영어는 네 번까지, 한두 음절 한국어(가 · 을 · 비 · 디)는 일곱 번까지 다시 만들어요
    --force        이미 있는 파일도 다시 만들기 (프로필을 바꿨을 때)

필요한 것
    <폴더>/audio/dialogue/lines.json   만들 줄 목록 — node tools/dialogue-lines.cjs <폴더> (페이지의 window.__dialogueLines())
    <폴더>/audio/dialogue/voices.json  말하는 사람 → VoiceStudio 프로필 이름(또는 id)과 화면에 보일 이름
        { "us": { "profile": "길 묻기 · 길에서 만난 사람 (미국 남성)", "label": "미국 남성" }, ... }

하는 일
    줄마다 POST /generate로 WAV를 만들어 다듬고 MP3(ffmpeg) 또는 AAC .m4a(afconvert)로 줄여 <말하는 사람>-<id>.<확장자>로 저장한 뒤,
    <폴더>/audio/dialogue/clips.js(window.DIALOGUE_CLIPS)를 다시 써요. 페이지(voices.js)는 파일이 있는 줄은 그 파일로,
    없는 줄은 브라우저 음성으로 읽어요. 이미 만든 파일은 건너뛰니, 중간에 멈춰도 다시 실행하면 이어서 만들어요.
    줄 id는 '말하는 사람|읽을 글'로 정해져서(voices.js의 lineId), 글을 고치면 새 줄이 되고 옛 파일은 안 쓰여요(목록에 표시).

표준 라이브러리만 써요. 만든 소리는 합성 음성이에요 — 엔진의 사용 조건(예: 비상업용)을 지켜 주세요.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import voicestudio_common as vs  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser(description='대화 목소리를 VoiceStudio로 미리 만들기')
    ap.add_argument('slug')
    ap.add_argument('--server', default='http://localhost:3900')
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--limit', type=int, default=0, help='새로 만들 줄 수 (먼저 들어 보기)')
    ap.add_argument('--only', default='', help='이 사람의 말만 (예: us)')
    ap.add_argument('--force', action='store_true')
    o = ap.parse_args()

    slug = o.slug.rstrip('/')
    d = os.path.join(ROOT, slug, 'audio', 'dialogue')
    lj, vj = os.path.join(d, 'lines.json'), os.path.join(d, 'voices.json')
    if not os.path.exists(lj):
        sys.exit(f'{slug}/audio/dialogue/lines.json이 없어요. 먼저: node tools/dialogue-lines.cjs {slug}')
    if not os.path.exists(vj):
        sys.exit(f'{slug}/audio/dialogue/voices.json이 없어요(말하는 사람 → 프로필).')
    lines = json.load(open(lj, encoding='utf-8'))['lines']
    voices = json.load(open(vj, encoding='utf-8'))
    server = o.server.rstrip('/')
    items = vs.profiles(server)
    prof = {sp: vs.find_profile(server, v['profile'], items) for sp, v in voices.items() if not sp.startswith('_')}
    miss = sorted({l['sp'] for l in lines} - set(prof))
    if miss:
        print(f'voices.json에 없는 사람 {", ".join(miss)} → 그 사람의 말은 브라우저 음성으로 남겨요.')
    for sp, p in prof.items():
        print(f"  {sp}: {p.get('name')} ({p.get('id')}) · 줄 {sum(l['sp'] == sp for l in lines)}개")

    have = {}
    for fn in os.listdir(d):
        m = re.match(r'^([a-z]{2}-[0-9a-f]{8})\.(mp3|m4a|wav)$', fn)
        if m:
            have[m.group(1)] = fn
    cj = os.path.join(d, 'clips.js')
    old = (vs.read_clips_js(cj, 'DIALOGUE_CLIPS') or vs.read_clips_js(cj, 'DRV_CLIPS')).get('clips', {})

    ext, enc = vs.encoder()
    todo = [l for l in lines if l['sp'] in prof and (not o.only or l['sp'] == o.only) and (o.force or l['id'] not in have)]
    if o.limit:
        todo = todo[:o.limit]
    print(f'새로 만들 줄 {len(todo)}개')
    t0 = time.time()
    clips, odd = {}, []
    for k, l in enumerate(todo, 1):
        try:
            wav, dur, sd = vs.generate(server, vs.readable(l['text']), 'en', prof[l['sp']]['id'], o.seed)
        except (urllib.error.HTTPError, RuntimeError) as e:
            print(f'  [{k}/{len(todo)}] {l["id"]} 실패: {e}')
            continue
        if sd < 0:
            odd.append(l['id'])
        prev = have.get(l['id'])
        if prev and not prev.endswith('.' + ext):
            os.remove(os.path.join(d, prev))
        vs.save(wav, os.path.join(d, f"{l['id']}.{ext}"), enc)
        have[l['id']] = f"{l['id']}.{ext}"
        clips[l['id']] = [have[l['id']], round(dur, 2)]
        left = (time.time() - t0) / k * (len(todo) - k)
        print(f'  [{k}/{len(todo)}] {l["sp"]} {dur:4.1f}초{" (확인 필요)" if sd < 0 else ""}  {l["text"][:50]}  (남은 시간 약 {left / 60:.0f}분)')

    final = {}
    for l in lines:
        fn = have.get(l['id'])
        if not fn:
            continue
        final[l['id']] = clips.get(l['id']) or (old[l['id']] if l['id'] in old and old[l['id']][0] == fn else [fn, 3])
    stale = sorted(set(have) - {l['id'] for l in lines})
    out = {'voices': {sp: v.get('label') or prof[sp].get('name') for sp, v in voices.items() if sp in prof}, 'base': 'audio/dialogue/', 'clips': final}
    with open(cj, 'w', encoding='utf-8') as f:
        f.write('// 대화에 쓸 미리 만든 음성 파일 목록 — tools/voicestudio-dialogue.py가 다시 써요(손으로 고치지 마세요).\n')
        f.write('// 비어 있으면 대화는 브라우저 음성으로 읽어요. 파일 이름 = 말하는 사람-줄 id (voices.js의 lineId)\n')
        f.write('window.DIALOGUE_CLIPS = ' + json.dumps(out, ensure_ascii=False) + ';\n')
    size = sum(os.path.getsize(os.path.join(d, v[0])) for v in final.values())
    print(f'\nclips.js: 파일이 있는 줄 {len(final)}개 / {len(lines)}개 · 모두 {size / 1e6:.1f} MB · 걸린 시간 {(time.time() - t0) / 60:.1f}분')
    if odd:
        print(f'소리가 이상할 수 있는 줄 {len(odd)}개(들어 보고, 이상하면 파일을 지운 뒤 --seed를 바꿔 다시): ' + ' '.join(have[i] for i in odd))
    if stale:
        print(f'목록에서 사라진 줄의 파일 {len(stale)}개(지워도 돼요): ' + ' '.join(have[i] for i in stale))


if __name__ == '__main__':
    main()
