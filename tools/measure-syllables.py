#!/usr/bin/env python3
"""미리 만든 낱말 파일을 재서 음절 공 · 높낮이 선의 값을 적기 (발음 튜토리얼, VoiceStudio가 있는 맥에서)

    PY="$HOME/Library/Application Support/VoiceStudio/runtime/project/.venv/bin/python"
    "$PY" tools/measure-syllables.py word-stress            재기 → <폴더>/audio/dialogue/measure.js
    "$PY" tools/measure-syllables.py word-stress --regen    통과하지 못한 줄은 seed를 바꿔 다시 만들어 고르기

필요한 것
    <폴더>/audio/dialogue/measure-meta.json   잴 줄의 정보 — node tools/dialogue-lines.cjs <폴더>가 페이지의
        window.__measureMeta()로 함께 써요. 줄마다 { id, sp, text, kind: word | ko | other, n: 음절 수, at: 센 음절(0부터) }
    VoiceStudio의 Python(faster-whisper large-v3 · librosa · scipy · soundfile이 들어 있음), macOS afconvert

하는 일 (줄마다)
    1) 받아쓰기(Whisper large-v3)로 다른 말로 들리지 않는지 — 영어는 낱말이 모두 같아야(숫자 13 = thirteen), 한국어는 한 글자까지
    2) 낱말(word) · 한국어식(ko): 울림소리(유성 또는 낮은 띠가 높은 띠보다 센 프레임)의 250~2500Hz 크기에서 봉우리 n개를 찾아
       사이의 골을 음절 경계로 삼고, 음절마다 [시작 ms, 끝 ms, 크기 dB(가장 큰 음절 = 0), 높이 Hz(가운데 부분의 80번째 백분위)]
    3) 낱말: 길이(끝 음절은 ×0.8) · 크기 · 높이 셋 가운데 둘 이상에서 사전의 센 음절이 가장 큰지, 끝이 묻는 말처럼
       3반음 넘게 올라가지 않는지. 밝은 선생님(tc)은 20ms마다 높이 · 크기(높낮이 선 · 크기 띠)도
    measure.js에는 통과한 줄만 적어요(페이지는 잰 값이 없으면 엔진의 기본 모양으로 그려요). 한국어식은 이어진 모음(아이디어)을
    나누지 못하면 잰 값만 빠져요.
    줄 정보에 더 적을 수 있는 것(끝소리 튜토리얼 final-consonants가 씀)
      env: true    목소리와 상관없이 20ms마다 크기(e, 소리 덩어리)를 적어요 — 한국어식 줄도
      count: true  울림 조각(모음 자리) 수가 음절 수 n보다 많으면 통과하지 못해요 — 영어 낱말 파일에 넣은 모음(으)이 섞였는지
      pair: id, long: true|false   같은 목소리의 짝 줄(bag · back): 목이 울리는 끝(long)의 마지막 음절이 짝보다 1.15배 이상 길어야 해요.
                   둘 중 하나가 어긋나면 둘 다 통과하지 못하고, --regen은 한쪽을 다시 만들면 다른 쪽을 다시 재 봐요
      formant: true  센 음절 모음의 가운데에서 F1 · F2(Hz, LPC)와 모음 길이(ms, 크기가 가장 큰 곳에서 10dB 안쪽)를 재 F · vd로 적어요
                   (모음 편 tense-lax-vowels · open-vowels — 모음 지도). 재지 못하면 통과하지 못해요. 상한: 미국 남성(um) 5000Hz · 그 밖 5500Hz
      fpair: id, tense: true|false, front: true|false   같은 목소리의 모음 짝(sheep · ship): 앞 짝은 긴장한 i의 F2가 ɪ보다
                   80Hz 이상 높고 F1이 25Hz 넘게 높지 않아야, 뒤 짝은 느슨한 ʊ의 F1이 u보다 25Hz 이상 높아야 해요
      fpair: id, open: true|false, front: true|false    입 벌림 짝(bad · bed, cop · cup): 크게 벌린 모음(æ · ɑ)의 F1이 덜 벌린
                   모음(ɛ · ʌ)보다 50Hz 이상 높아야 해요(턱을 더 내림). 뒤 짝은 F1 차가 모자라도 ʌ의 F2가 ɑ보다 100Hz 이상 높으면(ɑ가 더 뒤) 통과
      weak: [음절 번호…], str: [음절 번호…]  구 속의 약한 음절(기능어)과 센 음절(센 낱말의 센 음절, 문장 리듬 sentence-rhythm): 약한 음절이
                   모두 센 음절보다 짧아야 해요(끝 음절은 ×0.8). str이 없으면 weak가 아닌 음절을 모두 센 음절로 봐요.
                   at의 표(센 음절 확인)는 하지 않아요 — 센 낱말이 둘 이상인 구는 어느 쪽이 가장 센지가 목소리마다 달라서
      dur: true    문장 길이(앞뒤 무음을 뺀 ms, 가장 큰 크기에서 35dB 안쪽의 처음 ~ 끝)를 dur로 적어요 — 받아쓰기만 하는 문장(other) · 한국어식 줄도
    문장(other)은 받아쓰기만 해요 — 문장 속 낱말의 시각은 Whisper가 어림으로만 알려 줘서 음절을 재지 않아요.

--narration: 음성 해설에서 영어 낱말만 읽는 조각(낱말 하나 · · 로 늘어놓은 낱말)을, 통과한 밝은 선생님(tc) 낱말 파일을
    그대로 이어(쉼표만큼 쉬고) 다시 만들어요 — 해설 속 낱말도 받아쓰기 · 센 음절 확인을 거친 소리가 되게(해설의 영어 목소리 = tc).
    낱말 하나라도 통과하지 못했으면 그 조각은 그대로 둬요. audio/narration/clips.js의 길이를 고쳐요.

--regen: 통과하지 못한 줄을 seed 11 · 23 · 37 · 51 · 67 · 83으로 차례로 다시 만들어 통과하는 첫 소리로 바꾸고
    clips.js의 길이를 고쳐요(옛 파일은 임시 폴더의 old_takes/로). 끝내 통과하지 못하면 파일은 그대로 두고 잰 값만 빼요.
"""
import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

import librosa
import numpy as np
import soundfile as sf
from scipy.signal import find_peaks

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from shs_pitch import shs_f0  # noqa: E402
import voicestudio_common as vs  # noqa: E402

ROOT = os.path.dirname(HERE)
HOP = 0.005  # 5 ms
SEEDS = [11, 23, 37, 51, 67, 83]
RISE_MAX = 3.0
PAIR_MIN = 1.15   # 목이 울리는 끝 앞 모음 ÷ 울리지 않는 끝 앞 모음 (같은 목소리)
FP_F2 = 80        # 앞 모음 짝: 긴장한 i의 F2 − 느슨한 ɪ의 F2 (Hz) 이상
FP_F1 = 25        # 뒤 모음 짝: 느슨한 ʊ의 F1 − 긴장한 u의 F1 (Hz) 이상 · 앞 짝은 ɪ의 F1이 i보다 이만큼 넘게 낮으면 안 돼요
F2_BACK_MAX = 2200   # 뒤 모음(u · ʊ)으로 잰 F2가 이보다 크면 측정 오류로 봐요
F2_FRONT_MIN = 1000  # 앞 모음(i · ɪ)으로 잰 F2가 이보다 작으면 측정 오류로 봐요
OP_F1 = 50        # 입 벌림 짝: 크게 벌린 모음(æ · ɑ)의 F1 − 덜 벌린 모음(ɛ · ʌ)의 F1 (Hz) 이상
OP_F2 = 100       # 입 벌림 뒤 짝: F1 차가 모자라면 덜 벌린 ʌ의 F2 − 크게 벌린 ɑ의 F2 (Hz) 이상이어도 통과

ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = {2: 'twenty', 3: 'thirty', 4: 'forty', 5: 'fifty', 6: 'sixty', 7: 'seventy', 8: 'eighty', 9: 'ninety'}


def num_words(n):
    n = int(n)
    if n < 20:
        return ONES[n]
    t, o = divmod(n, 10)
    return TENS[t] + ('' if o == 0 else ' ' + ONES[o])


def norm_en(s):
    s = s.lower().replace('’', "'").replace('cannot', "can't")
    s = re.sub(r'\$(\d+)', r'\1 dollars', s)
    s = re.sub(r'(\d+)%', r'\1 percent', s)
    s = re.sub(r'\b(\d{1,2})\b', lambda m: num_words(m.group(1)), s)
    s = s.replace('-', ' ')
    return re.findall(r"[a-z']+", s)


def norm_ko(s):
    return ''.join(re.findall(r'[가-힣]', s))


def edit(a, b):
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (ca != cb))
    return d[len(b)]


def load(path, tmp):
    """m4a · mp3 → afconvert로 16비트 WAV → soundfile (모노 float32)"""
    w = os.path.join(tmp, 'x.wav')
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', path, w], check=True)
    y, sr = sf.read(w, dtype='float32')
    if y.ndim > 1:
        y = y.mean(axis=1)
    return y, sr


def smooth(x, k):
    if k <= 1:
        return x
    ker = np.ones(k) / k
    return np.convolve(np.pad(x, (k // 2, k - 1 - k // 2), mode='edge'), ker, mode='valid')


def features(y, sr, mask=False):
    """돌려줌: (음절 찾기용 크기 env, 전체 크기 dB, 높이 f0 — 5ms마다) + mask=True면 울림 프레임(True/False)"""
    hop = int(round(sr * HOP))
    nfft = 2048 if sr > 32000 else 1024
    S = np.abs(librosa.stft(y, n_fft=nfft, hop_length=hop, win_length=int(sr * 0.025), center=True)) ** 2
    fr = librosa.fft_frequencies(sr=sr, n_fft=nfft)
    bdb = smooth(10 * np.log10(S[(fr >= 250) & (fr <= 2500)].sum(0) + 1e-10), 7)
    fdb = smooth(10 * np.log10(S.sum(0) + 1e-10), 5)
    lo = 10 * np.log10(S[(fr >= 80) & (fr <= 900)].sum(0) + 1e-10)
    hi = 10 * np.log10(S[fr >= 4000].sum(0) + 1e-10)
    f0, _ = shs_f0(y, sr, hop)
    n = min(len(bdb), len(f0))
    bdb, fdb, f0, lo, hi = bdb[:n], fdb[:n], f0[:n], lo[:n], hi[:n]
    # 음절의 핵(모음)은 울림소리: 유성(터짐 · 마찰의 잡음은 빼고) 또는 낮은 띠가 높은 띠보다 또렷이 센 프레임(r 모음처럼 배음이 약한 곳)
    son = ((lo - hi) > 8) & (lo > lo.max() - 35)
    v = (~np.isnan(f0) & ((lo - hi) > 0)) | son
    idx = np.where(v)[0]
    for a, b in zip(idx[:-1], idx[1:]):
        if 1 < b - a <= 8:  # 40ms 이하의 틈은 메움
            v[a:b] = True
    i = 0
    while i < n:  # 30ms보다 짧은 울림 조각은 버림
        if v[i]:
            j = i
            while j < n and v[j]:
                j += 1
            if j - i < 6:
                v[i:j] = False
            i = j
        else:
            i += 1
    env = np.where(v, bdb, bdb - 30)
    return (env, fdb, f0, v) if mask else (env, fdb, f0)


def voiced_runs(env, v):
    """울림 조각 수(40ms 이하의 틈은 이미 메움) — 가장 큰 곳보다 25dB 넘게 작은 조각은 세지 않아요"""
    top, n, i = env.max(), 0, 0
    while i < len(v):
        if v[i]:
            j = i
            while j < len(v) and v[j]:
                j += 1
            if env[i:j].max() > top - 25:
                n += 1
            i = j
        else:
            i += 1
    return n


def segment(env, n):
    """음절 n개: 크기 봉우리 n개(두드러진 순) → 사이의 골이 경계, 처음 · 끝은 가장 큰 곳보다 28dB 아래"""
    if len(env) < n * 8:
        return None
    top = env.max()
    allpk, props = find_peaks(env, distance=12, prominence=0)
    pmap = dict(zip(allpk, props['prominences']))
    best = None
    for prom in (3.0, 2.0, 1.2, 0.6, 0.3):
        pk = [p for p in find_peaks(env, distance=12, prominence=prom)[0] if env[p] > top - 22]
        if len(pk) >= n:
            best = sorted(sorted(pk, key=lambda p: -pmap.get(p, 0))[:n])
            break
    if best is None:
        return None
    thr = top - 28
    a = best[0]
    while a > 0 and env[a] > thr:
        a -= 1
    b = best[-1]
    while b < len(env) - 1 and env[b] > thr:
        b += 1
    bounds = [a] + [best[i] + int(np.argmin(env[best[i]:best[i + 1] + 1])) for i in range(n - 1)] + [b]
    return [(bounds[i], bounds[i + 1]) for i in range(n)]


def syl_values(segs, fdb, f0):
    out = []
    for a, b in segs:
        w = f0[a:b + 1]
        core = w[int(len(w) * 0.15): max(int(len(w) * 0.15) + 1, int(len(w) * 0.9))]
        v = core[~np.isnan(core)]
        out.append([a * HOP * 1000, b * HOP * 1000, float(np.max(fdb[a:b + 1])), float(np.percentile(v, 80)) if len(v) >= 3 else 0.0])
    mx = max(o[2] for o in out)
    for o in out:
        o[2] -= mx
    return out


def nucleus(env, a, b, drop=10.0):
    """음절 [a, b] 안에서 크기가 가장 큰 곳보다 drop dB 안쪽으로 이어진 가장 긴 조각(모음의 핵) → (처음, 끝) 프레임"""
    seg = env[a:b + 1]
    strong = seg > seg.max() - drop
    best, i = (0, 0), 0
    while i < len(strong):
        if strong[i]:
            j = i
            while j < len(strong) and strong[j]:
                j += 1
            if j - i > best[1] - best[0]:
                best = (i, j)
            i = j
        else:
            i += 1
    return a + best[0], a + best[1] - 1


def lpc_formants(y, sr, a, b, ceiling):
    """프레임 a~b(5ms 간격, 가운데 맞춤)마다 LPC(10차, 표본율 = 상한 × 2, 25ms 해밍 창, 앞 강조)로 근을 구해
    F1 = 180~1100Hz의 가장 낮은 공명, F2 = 그보다 250Hz 넘게 높은 첫 공명(대역폭 600Hz 아래) → 프레임들의 가운데 값(Hz).
    재지 못하면 None"""
    sr2 = int(ceiling * 2)
    y2 = librosa.resample(y, orig_sr=sr, target_sr=sr2)
    y2 = np.append(y2[0], y2[1:] - 0.97 * y2[:-1]).astype('float64')
    win = int(0.025 * sr2)
    ham = np.hamming(win)
    f1s, f2s = [], []
    for fi in range(a, b + 1):
        s0 = int(fi * HOP * sr2) - win // 2
        if s0 < 0 or s0 + win > len(y2):
            continue
        fr = y2[s0:s0 + win] * ham
        if np.max(np.abs(fr)) < 1e-5:
            continue
        try:
            A = librosa.lpc(fr, order=10)
        except Exception:  # noqa: BLE001 — 그 프레임만 건너뜀
            continue
        rts = np.roots(A)
        rts = rts[np.imag(rts) > 0.01]
        f = np.angle(rts) * sr2 / (2 * np.pi)
        bw = -np.log(np.abs(rts)) * sr2 / np.pi
        c1 = np.sort(f[(f >= 180) & (f <= 1100) & (bw < 600)])
        if not len(c1):
            continue
        c2 = np.sort(f[(f > c1[0] + 250) & (f >= 600) & (f <= ceiling - 300) & (bw < 600)])
        if len(c2):
            f1s.append(c1[0])
            f2s.append(c2[0])
    if len(f1s) < 3:
        return None
    return float(np.median(f1s)), float(np.median(f2s))


def stress_votes(sv):
    """길이(끝 음절은 ×0.8 — 끝에서 늘어나는 만큼) · 크기 · 높이에서 가장 큰 음절에 한 표씩"""
    durs = np.array([o[1] - o[0] for o in sv], dtype=float)
    if len(sv) >= 2:
        durs[-1] *= 0.8
    votes = [0] * len(sv)
    for x in (durs, np.array([o[3] for o in sv]), np.array([o[2] for o in sv])):
        votes[int(np.argmax(x))] += 1
    return votes


def weak_gap(sv, weak, strong=None):
    """약한 음절 가운데 가장 긴 것 · 센 음절 가운데 가장 짧은 것(ms, 끝 음절은 ×0.8) — 약한 음절이나 센 음절이 없으면 None"""
    durs = [o[1] - o[0] for o in sv]
    if len(durs) >= 2:
        durs[-1] *= 0.8
    w = [durs[i] for i in weak if 0 <= i < len(durs)]
    s = [d for i, d in enumerate(durs) if (i in strong if strong is not None else i not in weak)]
    if not w or not s:
        return None
    return [int(round(max(w))), int(round(min(s)))]


def rise(f0, a, b):
    """끝 4분의 1과 처음 4분의 1의 높이 차(반음)"""
    v = f0[a:b]
    v = v[~np.isnan(v)]
    if len(v) < 9:
        return 0.0
    k = max(3, len(v) // 4)
    return float(12 * np.log2(np.median(v[-k:]) / np.median(v[:k])))


PRE = {}  # 묶어서 미리 받아쓴 글: (경로, 고친 시각, 크기) → 들린 글


def file_key(path):
    return (os.path.abspath(path), int(os.path.getmtime(path)), os.path.getsize(path))


# 소리가 같은 낱말(받아쓰기가 어느 쪽으로 적어도 같은 소리) — 받아쓰기만으로는 가를 수 없어요
HOMOPHONES = {'heal': 'heel', 'peal': 'peel', 'reed': 'read', 'weak': 'week', 'feat': 'feet', 'meat': 'meet', 'sea': 'see',
              'knot': 'not', 'won': 'one', 'hole': 'whole', 'steal': 'steel', 'seen': 'scene', 'leek': 'leak'}


def heard_ok(lang, heard, text):
    if lang == 'ko':
        return edit(norm_ko(heard), norm_ko(text)) <= 1
    h = lambda s: [HOMOPHONES.get(w, w) for w in norm_en(s)]
    return h(heard) == h(text)


def prefetch_asr(model, jobs, tmp, max_s=26.0, gap_s=1.0):
    """받아쓰기를 묶어서 미리 — 낱말 파일 여러 개를 무음(앞뒤 0.5초 + 사이 gap_s초)으로 이어 한 번에 받아쓰고, 낱말의 시각으로
    파일마다 나눠요. Whisper는 소리를 30초 단위로 들어서, 한 파일씩 들으면 짧은 낱말 하나에도 30초어치를 계산해요.
    묶어서 들은 글이 맞으면 그대로 쓰고, 맞지 않으면 measure()가 그 파일만 따로 다시 들어 판정해요(묶음 때문에 탈락하는 일은 없어요).
    jobs: [(경로, 언어)]"""
    pad = np.zeros(int(16000 * 0.5), dtype='float32')
    gap = np.zeros(int(16000 * gap_s), dtype='float32')
    for lang in ('en', 'ko'):
        batch, spans, t = [], [], 0.0
        todo = [pth for pth, lg in jobs if lg == lang]

        def flush():
            if not batch:
                return
            y = np.concatenate(batch)
            segs, _ = model.transcribe(y, language=lang, beam_size=5, vad_filter=False,
                                       word_timestamps=True, condition_on_previous_text=False)
            words = [w for sg in segs for w in (sg.words or [])]
            for pth, a, b in spans:
                got = [w.word.strip() for w in words if a <= (w.start + w.end) / 2 < b]
                PRE[file_key(pth)] = ' '.join(got)
            batch.clear(); spans.clear()

        for pth in todo:
            y, sr = load(pth, tmp)
            y16 = np.concatenate([pad, librosa.resample(y, orig_sr=sr, target_sr=16000).astype('float32'), pad])
            d = len(y16) / 16000
            if batch and t + d > max_s:
                flush(); t = 0.0
            a = t - (gap_s / 2 if batch else 0)
            batch.append(y16); t += d
            spans.append((pth, a, t + gap_s / 2))
            batch.append(gap); t += gap_s
        flush()


def measure(model, m, path, tmp):
    y, sr = load(path, tmp)
    lang = 'ko' if m['kind'] == 'ko' else 'en'
    heard = PRE.get(file_key(path))
    ok = heard is not None and heard_ok(lang, heard, m['text'])
    if not ok:  # 묶음에서 맞지 않았거나 묶지 않은 파일은 하나씩 따로
        pad = np.zeros(int(sr * 0.5), dtype='float32')  # 짧은 낱말은 앞뒤에 무음을 붙여야 Whisper가 잘 들어요
        y16 = librosa.resample(np.concatenate([pad, y, pad]), orig_sr=sr, target_sr=16000)
        segs, _ = model.transcribe(y16, language=lang, beam_size=5, vad_filter=False)
        heard = ' '.join(s.text.strip() for s in segs)
        ok = heard_ok(lang, heard, m['text'])
    r = {'heard': heard, 'okHeard': ok}
    if m.get('dur'):
        fdb0 = features(y, sr)[1]
        on = np.where(fdb0 > fdb0.max() - 35)[0]
        r['dur'] = int(round((on[-1] - on[0] + 1) * HOP * 1000)) if len(on) else 0
    if m['kind'] not in ('word', 'ko'):
        return r
    env, fdb, f0, v = features(y, sr, mask=True)
    if m.get('count'):
        r['runs'] = voiced_runs(env, v)
    sg = segment(env, m['n'])
    if sg is None:
        r['why'] = '음절을 나누지 못함'
        return r
    sv = syl_values(sg, fdb, f0)
    r['s'] = [[int(round(a)), int(round(b)), round(db, 1), int(round(hz))] for a, b, db, hz in sv]
    if m['kind'] == 'word':
        r['votes'] = stress_votes(sv)
        if m.get('weak') is not None:
            r['wk'] = weak_gap(sv, m['weak'], m.get('str'))
            r['okStress'] = r['wk'] is not None and r['wk'][0] < r['wk'][1]
        else:
            r['okStress'] = r['votes'][m['at']] >= 2
        r['rise'] = round(rise(f0, sg[0][0], sg[-1][1]), 1)
    k = int(round(0.02 / HOP))
    if m['kind'] == 'word' and m['sp'] == 'tc':
        r['f'] = [0 if np.isnan(x) else int(round(x)) for x in f0[::k]]
    if (m['kind'] == 'word' and m['sp'] == 'tc') or m.get('env'):
        er = fdb[::k]
        r['e'] = [int(round(max(-60.0, x - float(np.max(er))))) for x in er]
    if m.get('formant'):
        a, b = sg[m.get('at', 0)]
        na, nb = nucleus(env, a, b)
        r['vd'] = int(round((nb - na + 1) * HOP * 1000))
        ca, cb = nucleus(env, na, nb, 6.0)   # F1 · F2는 더 센 가운데(6dB 안쪽)의 가운데 절반에서
        q = (cb - ca) // 4
        fm = lpc_formants(y, sr, ca + q, cb - q, 5000 if m['sp'] == 'um' else 5500) if cb - ca >= 6 else None
        if fm:
            r['F'] = [int(round(fm[0])), int(round(fm[1]))]
        else:
            r['why'] = (r.get('why', '') + ' 모음을 재지 못함').strip()
    return r


def pair_ratio(m, r, res):
    """짝 줄(pair)이 있으면 (목이 울리는 쪽 ÷ 울리지 않는 쪽) 마지막 음절 길이의 비, 잴 수 없으면 None"""
    o = (res or {}).get(m.get('pair') or '')
    if not o or 's' not in r or 's' not in o:
        return None
    a, b = r['s'][-1][1] - r['s'][-1][0], o['s'][-1][1] - o['s'][-1][0]
    if min(a, b) <= 0:
        return None
    return a / b if m.get('long') else b / a


def f_odd(m, r):
    """잰 F2가 그 모음에 있을 수 없는 자리면 이유 글(자동 측정 오류 — 지도에 엉뚱한 점이 찍혀요), 아니면 ''.
    뒤 모음(u · ʊ)의 F2가 2200Hz 넘음 · 앞 모음(i · ɪ)의 F2가 1000Hz 못 됨. 앞뒤를 아는 줄(front)만 봐요."""
    if 'front' not in m or 'F' not in r:
        return ''
    f2 = r['F'][1]
    if m['front'] and f2 < F2_FRONT_MIN:
        return f' F2 {f2}Hz < {F2_FRONT_MIN}(앞 모음)'
    if not m['front'] and f2 > F2_BACK_MAX:
        return f' F2 {f2}Hz > {F2_BACK_MAX}(뒤 모음)'
    return ''


def fpair_check(m, r, res):
    """모음 짝(fpair)이 있으면 (통과?, F1 차 = 느슨 − 긴장, F2 차 = 긴장 − 느슨), 잴 수 없으면 None
    입 벌림 짝(open)이면 (통과?, F1 차 = 크게 − 덜, F2 차 = 덜 − 크게)"""
    o = (res or {}).get(m.get('fpair') or '')
    if not o or 'F' not in r or 'F' not in o:
        return None
    if 'open' in m:
        b, s = (r['F'], o['F']) if m.get('open') else (o['F'], r['F'])
        d1, d2 = b[0] - s[0], s[1] - b[1]
        ok = d1 >= OP_F1 if m.get('front') else (d1 >= OP_F1 or d2 >= OP_F2)
        return ok, d1, d2
    t, l = (r['F'], o['F']) if m.get('tense') else (o['F'], r['F'])
    d1, d2 = l[0] - t[0], t[1] - l[1]
    ok = (d2 >= FP_F2 and d1 >= -FP_F1) if m.get('front') else d1 >= FP_F1
    return ok, d1, d2


def passes(m, r, res=None):
    if not r.get('okHeard'):
        return False
    if m['kind'] == 'word':
        if m.get('count') and r.get('runs', 0) > m['n']:
            return False
        if m.get('pair') and res is not None:
            q = pair_ratio(m, r, res)
            if q is not None and q < PAIR_MIN:
                return False
        if m.get('formant') and 'F' not in r:
            return False
        if f_odd(m, r):
            return False
        if m.get('fpair') and res is not None:
            q = fpair_check(m, r, res)
            if q is not None and not q[0]:
                return False
        return bool(r.get('okStress')) and r.get('rise', 0) <= RISE_MAX
    return True  # 한국어식 · 문장은 받아쓰기만 (한국어식은 음절을 나누지 못하면 잰 값만 빠져요)


def tag(m, r, res=None):
    t = '' if r.get('okHeard') else f" 받아쓰기≠({r.get('heard', '')[:30]})"
    if 'okStress' in r and not r['okStress']:
        if m.get('weak') is not None:
            wk = r.get('wk') or ['?', '?']
            t += f" 약한 음절이 짧지 않음(약한 쪽 최대 {wk[0]}ms ≥ 센 쪽 최소 {wk[1]}ms)"
        else:
            t += f" 센 음절≠(표 {r['votes']} · 사전 {m['at']})"
    if r.get('why'):
        t += ' ' + r['why']
    if r.get('rise', 0) > RISE_MAX:
        t += f" 끝 올림 {r['rise']:+.1f}"
    if m.get('count') and r.get('runs', 0) > m['n']:
        t += f" 울림 조각 {r['runs']} > 음절 {m['n']}"
    q = pair_ratio(m, r, res) if m.get('pair') and res is not None else None
    if q is not None and q < PAIR_MIN:
        t += f" 짝과 모음 길이 비 {q:.2f} < {PAIR_MIN}"
    t += f_odd(m, r)
    q = fpair_check(m, r, res) if m.get('fpair') and res is not None else None
    if q is not None and not q[0]:
        t += f" 짝과 모음 자리 F1차 {q[1]:+d} · F2차 {q[2]:+d}"
    return t


def write_measure_js(path, meta, res):
    out = {}
    for m in meta:
        r = res.get(m['id'])
        if not r or not passes(m, r, res) or ('s' not in r and 'dur' not in r):
            continue
        e = {}
        for x in ('s', 'f', 'e', 'F', 'vd', 'dur'):
            if x in r:
                e[x] = r[x]
        out[m['id']] = e
    with open(path, 'w', encoding='utf-8') as f:
        f.write('// 미리 만든 낱말 파일을 잰 값 — tools/measure-syllables.py가 다시 써요(손으로 고치지 마세요).\n')
        f.write('// id(voices.js의 lineId) → s: 음절마다 [시작 ms, 끝 ms, 크기 dB(가장 큰 음절 = 0), 높이 Hz(0 = 못 잼)],\n')
        f.write('// f · e: 20ms마다 높이 Hz(0 = 소리 없음, 밝은 선생님 tc만) · 크기 dB(tc와 env 줄). 통과한 줄만 적어요.\n')
        if any('F' in v for v in out.values()):
            f.write('// F: 센 음절 모음 가운데의 [F1, F2] Hz(LPC) · vd: 그 모음의 길이 ms(크기가 가장 큰 곳에서 10dB 안쪽, 어림)\n')
        if any('dur' in v for v in out.values()):
            f.write('// dur: 앞뒤 무음을 뺀 줄 전체의 길이 ms(가장 큰 크기에서 35dB 안쪽의 처음 ~ 끝)\n')
        f.write('window.PRON_MEASURE = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    return len(out)


def write_clips(cj, cl):
    head = ''.join(l for l in open(cj, encoding='utf-8').read().splitlines(True) if l.startswith('//'))
    with open(cj, 'w', encoding='utf-8') as f:
        f.write(head + 'window.DIALOGUE_CLIPS = ' + json.dumps(cl, ensure_ascii=False) + ';\n')


def wav_bytes(path, tmp):
    w = os.path.join(tmp, 'n.wav')
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', path, w], check=True)
    y, sr = sf.read(w, dtype='int16')
    if y.ndim > 1:
        y = y.mean(axis=1).astype('int16')
    out = os.path.join(tmp, 'n16.wav')
    sf.write(out, y, sr, subtype='PCM_16')   # afconvert의 WAVE_FORMAT_EXTENSIBLE은 wave 모듈이 못 읽어서
    return open(out, 'rb').read()


def narration_from_words(slug, meta, res, tmp):
    nd = os.path.join(ROOT, slug, 'audio', 'narration')
    dd = os.path.join(ROOT, slug, 'audio', 'dialogue')
    pieces = json.load(open(os.path.join(nd, 'pieces.json'), encoding='utf-8'))['pieces']
    tc = {m['text'].lower(): m for m in meta if m['sp'] == 'tc' and m['kind'] == 'word'}
    cj = os.path.join(nd, 'clips.js')
    cl = vs.read_clips_js(cj, 'EN_CLIPS')
    ext, enc = vs.encoder()
    old_dir = os.path.join(tempfile.gettempdir(), 'old_takes', slug, 'narration')
    os.makedirs(old_dir, exist_ok=True)
    done, skip = [], []
    for p in pieces:
        if p['lang'] != 'en':
            continue
        words = vs.word_list(p['text'])
        if not words:
            one = re.sub(r'[.\s]+$', '', p['text'].strip())
            words = [one] if re.fullmatch(r"[A-Za-z]+", one) else None
        if not words:
            continue
        lines = [tc.get(w.lower()) for w in words]
        bad = [w for w, m in zip(words, lines) if not m or not passes(m, res.get(m['id'], {}), res)]
        if bad:
            skip.append(f"{p['text']}({', '.join(bad)})")
            continue
        files = []
        for m in lines:
            f = [x for x in os.listdir(dd) if x.startswith(m['id'] + '.')]
            files.append(os.path.join(dd, f[0]))
        wavs = [wav_bytes(f, tmp) for f in files]
        wav, dur = vs.join_wavs(wavs) if len(wavs) > 1 else (wavs[0], sf.info(io.BytesIO(wavs[0])).duration)
        for x in os.listdir(nd):
            if x.startswith(p['id'] + '.'):
                shutil.move(os.path.join(nd, x), os.path.join(old_dir, x))
        dst = os.path.join(nd, f"{p['id']}.{ext}")
        vs.save(wav, dst, enc)
        if cl.get('clips') is not None:
            cl['clips'][p['id']] = [os.path.basename(dst), round(dur, 2)]
        done.append(p['text'])
    if cl:
        head = ''.join(l for l in open(cj, encoding='utf-8').read().splitlines(True) if l.startswith('//'))
        with open(cj, 'w', encoding='utf-8') as f:
            f.write(head + 'window.EN_CLIPS = ' + json.dumps(cl, ensure_ascii=False) + ';\n')
    print(f"\n음성 해설: 통과한 낱말 파일로 다시 만든 조각 {len(done)}개 — " + ' | '.join(done))
    if skip:
        print(f"그대로 둔 조각 {len(skip)}개(통과하지 못한 낱말이 있음): " + ' | '.join(skip))
    print(f'옛 파일: {old_dir}')


def main():
    ap = argparse.ArgumentParser(description='낱말 파일을 재서 measure.js 쓰기')
    ap.add_argument('slug')
    ap.add_argument('--regen', action='store_true', help='통과하지 못한 줄을 seed를 바꿔 다시 만들기')
    ap.add_argument('--narration', action='store_true', help='해설의 영어 낱말 조각을 통과한 tc 낱말 파일로 다시 만들기')
    ap.add_argument('--seeds', default=','.join(map(str, SEEDS)))
    ap.add_argument('--only', default='', help='이 줄 id만 (쉼표로)')
    ap.add_argument('--server', default='http://localhost:3900')
    o = ap.parse_args()
    slug = o.slug.rstrip('/')
    d = os.path.join(ROOT, slug, 'audio', 'dialogue')
    mp = os.path.join(d, 'measure-meta.json')
    if not os.path.exists(mp):
        sys.exit(f'{slug}/audio/dialogue/measure-meta.json이 없어요. 먼저: node tools/dialogue-lines.cjs {slug}')
    meta = json.load(open(mp, encoding='utf-8'))['lines']
    only = set(filter(None, o.only.split(',')))
    from faster_whisper import WhisperModel
    model = WhisperModel('large-v3', device='cpu', compute_type='int8', local_files_only=True)
    tmp = tempfile.mkdtemp()
    cache_p = os.path.join(tempfile.gettempdir(), f'measure-syllables-{slug}.json')
    cache = json.load(open(cache_p, encoding='utf-8')) if os.path.exists(cache_p) else {}
    res = {}
    have = {}
    for fn in os.listdir(d):
        mm = re.match(r'^([a-z]{2}-[0-9a-f]{8})\.(mp3|m4a)$', fn)
        if mm:
            have[mm.group(1)] = fn
    todo = [m for m in meta if m['id'] in have and (not only or m['id'] in only)]
    jobs = []
    for m in todo:  # 지난 결과가 없는 파일만 묶어서 미리 받아쓰기
        p = os.path.join(d, have[m['id']])
        c = cache.get(m['id'])
        if only or not c or c.get('key') != f"{os.path.getmtime(p):.0f}:{os.path.getsize(p)}":
            jobs.append((p, 'ko' if m['kind'] == 'ko' else 'en'))
    if jobs:
        print(f'받아쓰기 묶음: 파일 {len(jobs)}개', flush=True)
        prefetch_asr(model, jobs, tmp)
    for k, m in enumerate(todo, 1):
        p = os.path.join(d, have[m['id']])
        key = f"{os.path.getmtime(p):.0f}:{os.path.getsize(p)}"
        c = cache.get(m['id'])
        r = c['r'] if c and c.get('key') == key and not only else measure(model, m, p, tmp)
        cache[m['id']] = {'key': key, 'r': r}
        res[m['id']] = r
        if not passes(m, r):
            print(f"  [{k}/{len(todo)}] {m['id']} {m['text'][:40]!r}{tag(m, r)}", flush=True)
        if k % 25 == 0:
            json.dump(cache, open(cache_p, 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(cache, open(cache_p, 'w', encoding='utf-8'), ensure_ascii=False)
    for m in meta:  # --only로 재지 않은 줄은 지난 결과로
        if m['id'] not in res and m['id'] in cache:
            res[m['id']] = cache[m['id']]['r']

    for m in todo:  # 짝 비교는 두 줄을 모두 잰 뒤에
        q = pair_ratio(m, res[m['id']], res) if m.get('pair') and passes(m, res[m['id']]) else None
        fq = fpair_check(m, res[m['id']], res) if m.get('fpair') and passes(m, res[m['id']]) else None
        if (q is not None and q < PAIR_MIN) or (fq is not None and not fq[0]):
            print(f"  {m['id']} {m['text'][:40]!r}{tag(m, res[m['id']], res)}", flush=True)
    fail = [m for m in todo if not passes(m, res[m['id']], res)]
    replaced, still = [], []
    if o.regen and fail:
        voices = json.load(open(os.path.join(d, 'voices.json'), encoding='utf-8'))
        server = o.server.rstrip('/')
        items = vs.profiles(server)
        prof = {sp: vs.find_profile(server, v['profile'], items) for sp, v in voices.items() if not sp.startswith('_')}
        ext, enc = vs.encoder()
        old_dir = os.path.join(tempfile.gettempdir(), 'old_takes', slug)
        os.makedirs(old_dir, exist_ok=True)
        cj = os.path.join(d, 'clips.js')
        cl = vs.read_clips_js(cj, 'DIALOGUE_CLIPS')
        seeds = [int(x) for x in o.seeds.split(',')]
        print(f'\n다시 만들기: {len(fail)}줄 × seed 최대 {len(seeds)}개')
        for k, m in enumerate(fail, 1):
            if passes(m, res[m['id']], res):   # 짝을 다시 만들어 이제 통과해요
                continue
            lang = voices[m['sp']].get('lang', 'en')
            text = vs.bare(m['text']) if lang == 'ko' else vs.readable(m['text'])
            got = None
            for sd in seeds:
                try:
                    wav, dur, used = vs.generate(server, text, lang, prof[m['sp']]['id'], sd)
                except Exception as e:  # noqa: BLE001 — 한 줄 실패는 넘어가요
                    print(f'    {m["id"]} seed {sd} 실패: {e}', flush=True)
                    continue
                if used < 0:
                    continue
                cand = os.path.join(tmp, f"{m['id']}-{sd}.{ext}")
                vs.save(wav, cand, enc)
                r = measure(model, m, cand, tmp)
                print(f"  [{k}/{len(fail)}] {m['id']} {m['text'][:30]!r} seed {sd}{tag(m, r, res) or ' → 통과'}", flush=True)
                if passes(m, r, res):
                    got = (cand, r)
                    break
            if not got:
                still.append(m)
                continue
            cand, r = got
            dst = os.path.join(d, f"{m['id']}.{ext}")
            if m['id'] in have:
                shutil.move(os.path.join(d, have[m['id']]), os.path.join(old_dir, have[m['id']]))
            shutil.move(cand, dst)
            have[m['id']] = os.path.basename(dst)
            res[m['id']] = r
            cache[m['id']] = {'key': f"{os.path.getmtime(dst):.0f}:{os.path.getsize(dst)}", 'r': r}
            if cl.get('clips') is not None:
                cl['clips'][m['id']] = [os.path.basename(dst), round(vs.duration(dst), 2)]
                write_clips(cj, cl)
            replaced.append(m)
            json.dump(cache, open(cache_p, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'옛 파일: {old_dir}')
    else:
        still = fail

    n = write_measure_js(os.path.join(d, 'measure.js'), meta, res)
    if o.narration:
        narration_from_words(slug, meta, res, tmp)
    words = [m for m in meta if m['kind'] in ('word', 'ko') and m['id'] in res]
    print(f'\nmeasure.js: 잰 값 {n}개 / 낱말 · 한국어식 {len(words)}개 · 받아쓰기한 줄 {len(todo)}개')
    if replaced:
        print(f"다시 만들어 바꾼 줄 {len(replaced)}개: " + ' '.join(f"{m['id']}({m['text'][:16]})" for m in replaced))
    if still:
        print(f"통과하지 못한 줄 {len(still)}개(잰 값을 빼요): " + ' '.join(f"{m['id']}({m['text'][:16]}{tag(m, res[m['id']], res)})" for m in still))


if __name__ == '__main__':
    main()
