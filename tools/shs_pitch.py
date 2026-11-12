"""소리 높이(f0) 재기 — 배음 더하기(subharmonic summation, SHS). tools/measure-syllables.py가 써요.

합성 목소리(OmniVoice)의 숨 섞인 모음에서는 자기상관 방식(pyin)이 센 음절의 높이를 자주 놓쳐서,
프레임마다 후보 높이의 배음 크기를 더해 가장 큰 후보를 골라요. 40ms 창 · 4kHz 아래 · 후보 260개(70~520Hz) · 배음 8개.
소리가 없거나 배음이 약한 프레임은 NaN(소리 없음). 옥타브 실수는 전체 중앙값 쪽으로 바로잡고 5프레임 중앙값으로 고르게 해요.
"""
import numpy as np
from scipy.ndimage import median_filter


def shs_f0(y, sr, hop, fmin=70, fmax=520, nh=8):
    """프레임마다 후보 f0의 배음 크기 합이 가장 큰 값. 돌려줌: (f0 Hz 배열 — 소리 없음은 NaN, 배음 세기)"""
    nfft, win = 8192, int(sr * 0.04)
    pad = win // 2
    yp = np.pad(y, (pad, pad))
    nfr = 1 + (len(y) - 1) // hop + 1
    w = np.hanning(win)
    cand = np.exp(np.linspace(np.log(fmin), np.log(fmax), 260))
    freqs = np.fft.rfftfreq(nfft, 1 / sr)
    wts = 0.84 ** np.arange(nh)
    idx = (cand[:, None] * np.arange(1, nh + 1)[None, :]) / (sr / nfft)
    valid = idx < len(freqs) - 1
    f0 = np.zeros(nfr)
    strength = np.zeros(nfr)
    ener = np.zeros(nfr)
    for i in range(nfr):
        a = i * hop
        fr = yp[a:a + win]
        if len(fr) < win:
            fr = np.pad(fr, (0, win - len(fr)))
        ener[i] = np.sum(fr ** 2)
        X = np.abs(np.fft.rfft(fr * w, nfft)) ** 0.5
        X = X * (freqs < 4000)
        v = np.interp(np.where(valid, idx, 0), np.arange(len(X)), X) * valid
        s = (v * wts).sum(1)
        j = int(np.argmax(s))
        f0[i] = cand[j]
        strength[i] = s[j] / (np.mean(s) + 1e-9)
    edb = 10 * np.log10(ener + 1e-12)
    rel = edb - edb.max()
    voiced = ((rel > -28) & (strength > 1.35)) | ((rel > -36) & (strength > 1.7))
    f = np.where(voiced, f0, np.nan)
    # 옥타브 바로잡기: 유성 구간의 중앙값과 견줘 2배 · 1/2배
    v = f[~np.isnan(f)]
    if len(v):
        med = np.median(v)
        for i in range(len(f)):
            if np.isnan(f[i]):
                continue
            for m in (2.0, 0.5):
                if abs(np.log2(f[i] * m / med)) < abs(np.log2(f[i] / med)) - 0.6:
                    f[i] *= m
    # 5프레임 중앙값으로 고르기
    ok = ~np.isnan(f)
    out = np.where(ok, median_filter(np.where(ok, f, 0), size=5), np.nan)
    out = np.where(out > 0, out, np.nan)
    return out, strength
