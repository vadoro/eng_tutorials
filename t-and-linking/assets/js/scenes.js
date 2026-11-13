/* 워러가 되는 t — 미국식 t와 이어 말하기: 영상 장면과 자막 (ATS)
 * 그림은 시간 t와 사용자 상태(S)만의 함수예요. t · d의 모양과 그 까닭 · 이어지는 곳 · 칠하기는 규칙 엔진(AT)이 계산하고,
 * 목 울림 띠(낮은 띠 60~500Hz의 크기)는 미리 만든 음성 파일을 따로 잰 값(ATV.meas의 vb · s · tk)으로 그려요.
 * 잰 값이 없으면 엔진의 기본 모양(이어지는 자리는 높게, 끊기는 자리는 바닥까지)으로 그리고 ‘잰 값 아님’이라고 적어요.
 * 역할 색: 숨이 터지는 t 하늘 · s 뒤의 t 모래 · 짧은 ㄹ 같은 t 민트 · 목에서 막는 t 보라 · 사라지는 t 분홍(흐리게) · 끝의 t 회색 ·
 *         you와 이어짐 · 이어 말하기 노랑 · 한국어식으로 글자대로 읽기 주황
 */
(function () {
  'use strict';
  const AT = window.AT, V = window.ATV, M = window.EN && window.EN.mouth;
  const ATS = (window.ATS = {});
  const W = 1280, H = 720;
  ATS.W = W; ATS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  ATS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    asp: '#6EC8FF', st: '#E8C79A', flap: '#7FE0A8', glot: '#C9A7FF', drop: '#FF8FB8', final: '#9AA6B4', yu: '#FFC15E', link: '#FFC15E', ko: '#FF9F7A',
    vb: '#8FA6C0', bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  ATS.COL = COL;
  const KCOL = k => k && k !== 'plain' ? COL[k] || null : null;
  ATS.KCOL = KCOL;
  // 지도 카드의 짧은 규칙
  const RULE = { asp: '낱말 처음 · 센 음절의 처음', st: 's 바로 뒤 — ㄸ에 가깝게', flap: '모음 사이 · 뒤가 약한 음절', glot: '뒤에 약한 ‘은’', drop: 'n 바로 뒤 (경향)', final: '낱말 끝 · 뒤에 모음이 없음', yu: 't · d + you (경향)' };
  ATS.RULE = RULE;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (ATS.S = { voice: null, kword: null, flapw: null, stress: null, glotw: null, across: null, link: null, sent: null });
  ATS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  ATS.hits = () => HITS;

  let REC = null;
  function txt(g, s, x, y, o = {}) {
    s = String(s);
    if (REC) REC.add(s);
    g.font = fnt(o.size || 18, o.weight || 400, o.fam || FB);
    g.fillStyle = o.color || COL.text; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'middle';
    g.fillText(s, x, y);
    return g.measureText(s).width;
  }
  const tw = (g, s, size, weight = 400, fam = FB) => { g.font = fnt(size, weight, fam); return g.measureText(String(s)).width; };
  const fit = (g, s, size, maxW, weight = 600, min = 11, fam = FB) => { while (size > min && tw(g, s, size, weight, fam) > maxW) size -= 0.5; return size; };
  function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  function fade(g, a, fn) { if (a <= 0.001) return; g.save(); g.globalAlpha *= Math.min(1, a); fn(); g.restore(); }
  function chip(g, s, x, y, o = {}) {
    const size = o.size || 18, w = tw(g, s, size, o.weight || 600, o.fam || FB) + (o.pad || 14) * 2, h = o.h || size * 2;
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    rr(g, x0, y - h / 2, w, h, o.r == null ? h / 2 : o.r);
    g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
    txt(g, s, x0 + w / 2, y + 1, { size, weight: o.weight || 600, color: o.color || COL.text, align: 'center', fam: o.fam });
    return { x: x0, y: y - h / 2, w, h };
  }
  const tag = (g, s, x, y, color, o = {}) => chip(g, s, x, y, Object.assign({ size: 16, weight: 700, color, fill: COL.panel2, stroke: color, h: 34, r: 10 }, o));
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
  }
  const circ = (g, x, y, r, fill) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };
  // 누르면 들려줌: seq = [{ text, sp }]
  const listen = (x, y, w, h, seq) => HITS.push({ x, y, w, h, play: seq });
  const hex = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  ATS.hex = hex;
  const say = (text, sp = 'tc') => [{ text, sp }];

  /* ---------- 아이콘 — 24×24 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요 ---------- */
  const ICON = {
    spk: [['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'f'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
    ear: [['M7.5 9.5a4.5 4.5 0 1 1 9 0c0 3.1-3 3.7-3 6.6a2.7 2.7 0 0 1-5.1 1.1'], ['M10.5 10a1.6 1.6 0 1 1 3 .9']],
    tongue: [['M5 15c2-6 5-8 7-8s5 2 7 8'], ['M12 7v-3.5'], ['M9 12.5l3 2.5 3-2.5']],
    link: [['M4 14c2.5-5 6-5 8 0s5.5 5 8 0'], ['M4 14h2M18 14h2']],
    wave: [['M3 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0 3 4 4.5 0']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z'], ['M6 11a6 6 0 0 0 12 0'], ['M12 17v3.5M9 20.5h6']],
  };
  ATS.ICON = ICON;
  const P2D = {};
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const k = size / 24;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    (ICON[id] || []).forEach(([d, m]) => { const p = P2D[d] || (P2D[d] = new Path2D(d)); if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  ATS.icon = icon;
  ATS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 입 그림 (EN.mouth) ---------- */
  const MLAB = ['윗잇몸', '센입천장', '여린입천장', '혀끝', '혀 뒤', '입술', '목(성대)'];
  const mfont = (sz, w) => fnt(sz, w || 600);
  function mouth(g, x, y, s, pose, o = {}) {
    if (!M) return null;
    if (REC) MLAB.forEach(m => REC.add(m));
    return M.draw(g, x, y, s, pose, Object.assign({ font: mfont }, o));
  }
  // 혀끝으로 한 번 톡: period초마다 짧게 윗잇몸에 닿았다 떨어짐 (0 = 모음 자세, 1 = 닿음)
  const tap = (u, period = 1.6) => { const p = (u % period) / period; return p > 0.42 && p < 0.58 ? Math.sin(Math.PI * (p - 0.42) / 0.16) : 0; };
  ATS.tap = tap;

  /* ---------- 글 칠하기: t · d 글자를 모양 색으로(굵게 + 밑줄, 사라지는 t는 흐리게 + 점선) ----------
     o.paint=false: 칠하지 않음 · o.arcs: 이어지는 곳에 노란 다리 · o.maxW: 넘치면 줄임. 돌려줌 { x, w, size, words: { 낱말 번호: { a, b } } } */
  function wordT(g, text, x, y, size, o = {}) {
    const segs = AT.segs(text), paint = o.paint !== false, wt = o.weight || 600;
    const role = s => paint && KCOL(s.role) ? s.role : null;
    const sw = s => role(s) ? 800 : wt;
    const width = z => segs.reduce((a, s) => a + tw(g, s.t, z, sw(s)), 0);
    let sz = size, total = width(sz);
    if (o.maxW && total > o.maxW) { sz = size * o.maxW / total; total = width(sz); }
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx, words = {};
    segs.forEach(s => {
      const r = role(s), c = r ? KCOL(r) : (o.base || COL.text);
      g.save(); if (r === 'drop') g.globalAlpha *= 0.42;
      const ww = txt(g, s.t, xx, y, { size: sz, weight: sw(s), color: c });
      g.restore();
      if (r) {
        g.strokeStyle = c; g.lineWidth = Math.max(2, sz * 0.07);
        if (r === 'drop') g.setLineDash([4, 4]);
        g.beginPath(); g.moveTo(xx, y + sz * 0.58); g.lineTo(xx + ww, y + sz * 0.58); g.stroke(); g.setLineDash([]);
      }
      if (s.w != null) { const q = words[s.w] || (words[s.w] = { a: xx, b: xx + ww }); q.a = Math.min(q.a, xx); q.b = Math.max(q.b, xx + ww); }
      xx += ww;
    });
    if (o.arcs) arcs(g, text, words, y + sz * 0.72, sz, o.arcA);
    if (o.hit !== false) listen(x0 - 8, y - sz * 0.75, total + 16, sz * 1.6, say(text, o.sp || 'tc'));
    return { x: x0, w: total, size: sz, words };
  }
  ATS.wordT = wordT;
  // 이어지는 곳의 다리: 앞 낱말 끝 → 다음 낱말 처음 (노랑)
  function arcs(g, text, words, yb, sz, a = 1) {
    fade(g, a, () => AT.links(text).forEach(l => {
      const A = words[l.w], B = words[l.w + 1]; if (!A || !B) return;
      const xa = A.b - sz * 0.2, xb = B.a + sz * 0.2, my = yb + sz * 0.3;
      g.strokeStyle = COL.link; g.lineWidth = Math.max(2, sz * 0.08); g.lineCap = 'round';
      g.beginPath(); g.moveTo(xa, yb); g.quadraticCurveTo((xa + xb) / 2, my, xb, yb); g.stroke();
    }));
  }
  // 한국어식으로 글자대로 (주황)
  function koText(g, ko, x, y, size, o = {}) {
    const ww = txt(g, ko, x, y, { size, weight: o.weight || 700, color: COL.ko, align: o.align });
    const x0 = o.align === 'center' ? x - ww / 2 : o.align === 'right' ? x - ww : x;
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, ww + 16, size * 1.45, [{ text: ko, sp: 'ko' }]);
    return { x: x0, w: ww };
  }
  ATS.koText = koText;
  // 대문자로 센 음절 (낱말마다): WAter · hoTEL · pick it up
  const capsOf = text => AT.tokens(text).map(w => w.e ? AT.capsW(w.k, w.t) : w.t).join(' ');
  ATS.capsOf = capsOf;

  /* ---------- 목 울림 띠 ----------
     잰 값(vb: 10ms마다 낮은 띠 dB, s: 음절, tk: t 자리마다 떨어진 dB)이 있으면 그대로, 없으면 엔진의 기본 모양.
     재는 자리(AT.tmarks · 한국어식은 AT.koMarks): flap = 이어져야(10dB 이하) · gap = 끊겨야(15dB 이상) */
  const FLAP_MAX = 10, GAP_MIN = 15;
  ATS.FLAP_MAX = FLAP_MAX; ATS.GAP_MIN = GAP_MIN;
  const sylLabels = text => [].concat(...AT.tokens(text).filter(w => w.e).map(w => w.e.spell.map((s, i) => w.e.syl.length > 1 && w.e.syl[i].st === 1 ? s.toUpperCase() : s.toLowerCase())));
  function bandData(text, o = {}) {
    const ko = o.ko || null, marks = ko ? AT.koMarks(ko) : AT.tmarks(text);
    const n = ko ? AT.koN(ko) : AT.nSyl(text);
    const labels = ko ? [...ko].filter(c => /[가-힣]/.test(c)) : sylLabels(text);
    const m = o.meas === false ? null : ko ? V.meas('ko', ko) : V.meas(o.sp || 'tc', text);
    if (m && m.vb && m.s && m.s.length === n && (m.tk || []).length === marks.length) {
      const t0 = Math.max(0, m.s[0][0] - 60), t1 = m.s[n - 1][1] + 60;
      const i0 = Math.floor(t0 / 10), i1 = Math.max(i0 + 2, Math.min(m.vb.length - 1, Math.ceil(t1 / 10)));
      const lv = []; for (let i = i0; i <= i1; i++) lv.push(clamp(((m.vb[i] == null ? -50 : m.vb[i]) + 50) / 50));
      const X = ms => clamp((ms - i0 * 10) / ((i1 - i0) * 10));
      const syl = m.s.map(s => ({ a: X(s[0]), b: X(s[1]) }));
      const mk = marks.map((q, i) => {
        const d = m.tk[i][1], c0 = (m.s[q.k][0] + m.s[q.k][1]) / 2, c1 = (m.s[q.k + 1][0] + m.s[q.k + 1][1]) / 2;
        let at = (c0 + c1) / 2, bv = 1e9;
        for (let t = c0; t <= c1; t += 10) { const v = m.vb[Math.round(t / 10)]; if (v != null && v < bv) { bv = v; at = t; } }
        return { k: q.k, want: q.want, d, at: X(at), ok: d != null && (q.want === 'flap' ? d <= FLAP_MAX : d >= GAP_MIN) };
      });
      return { measured: true, lv, syl, mk, labels, n };
    }
    // 기본 모양: 음절마다 같은 덩어리 · 경계마다 이어짐(0.72) · 끊김(0) · 그 밖(0.4)
    const bridge = []; for (let k = 0; k < n - 1; k++) { const q = marks.find(x => x.k === k); bridge.push(q ? (q.want === 'flap' ? 0.72 : 0) : 0.4); }
    const syl = []; for (let i = 0; i < n; i++) syl.push({ a: (i + 0.14) / n, b: (i + 0.86) / n });
    const N = 36 * n, lv = [];
    for (let f = 0; f <= N; f++) {
      const p = f / N, i = Math.min(n - 1, Math.floor(p * n)), s = syl[i];
      if (p >= s.a && p <= s.b) { const e = Math.min(1, (p - s.a) / ((s.b - s.a) * 0.25), (s.b - p) / ((s.b - s.a) * 0.25)); const side = p - s.a < s.b - p ? (i ? bridge[i - 1] : 0) : (i < n - 1 ? bridge[i] : 0); lv.push(0.95 * e + side * (1 - e)); }
      else lv.push(p < s.a ? (i ? bridge[i - 1] : 0) : (i < n - 1 ? bridge[i] : 0));
    }
    const mk = marks.map(q => ({ k: q.k, want: q.want, d: null, at: (syl[q.k].b + syl[q.k + 1].a) / 2, ok: true }));
    return { measured: false, lv, syl, mk, labels, n };
  }
  ATS.bandData = bandData;
  const markCol = (q, ko) => q.want === 'flap' ? COL.flap : ko ? COL.ko : COL.asp;
  ATS.markLabel = q => (q.want === 'flap' ? '울림 이어짐' : '울림 끊김') + (q.d != null ? ` · ${Math.max(0, Math.round(q.d))}dB` : '');
  // x, y = 띠의 왼쪽 가운데 · o.chips: 'top'(기본) | 'side' | false · o.tag: false면 아래 표시를 쓰지 않음 · o.lab: 음절 글자 크기
  function band(g, text, x, y, w, h, o = {}) {
    const B = bandData(text, o), n = B.lv.length, ko = !!o.ko, base = o.color || (ko ? COL.ko : COL.vb);
    rr(g, x, y - h / 2, w, h, 8); g.fillStyle = 'rgba(255,255,255,0.035)'; g.fill();
    g.beginPath();
    B.lv.forEach((v, i) => { const X = x + i / (n - 1) * w, Y = y - v * h * 0.46; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    for (let i = n - 1; i >= 0; i--) g.lineTo(x + i / (n - 1) * w, y + B.lv[i] * h * 0.46);
    g.closePath(); g.fillStyle = hex(base, B.measured ? 0.62 : 0.38); g.fill();
    g.strokeStyle = hex(base, 0.9); g.lineWidth = 1.2; g.stroke();
    if (o.labels !== false) B.syl.forEach((s, i) => {
      const lab = B.labels[i] || '';
      txt(g, lab, x + (s.a + s.b) / 2 * w, y + h / 2 + (o.lab || 15) * 0.95, { size: o.lab || 15, weight: lab === lab.toUpperCase() && !ko && B.n > 1 && /[A-Z]/.test(lab) ? 800 : 600, color: ko ? COL.ko : COL.soft, align: 'center' });
    });
    B.mk.forEach(q => {
      const X = x + q.at * w, c = markCol(q, ko);
      g.strokeStyle = c; g.lineWidth = 2; g.setLineDash([5, 4]);
      g.beginPath(); g.moveTo(X, y - h / 2 - 3); g.lineTo(X, y + h / 2 + 3); g.stroke(); g.setLineDash([]);
      if (o.chips === false) return;
      const s = ATS.markLabel(q), size = o.chipSize || 14;
      if (o.chips === 'side') txt(g, s, x + w + 12, y, { size, weight: 700, color: c });
      else chip(g, s, X, y - h / 2 - size - 4, { size, color: c, fill: COL.panel2, stroke: c, align: 'center', h: size * 1.9, pad: 9 });
    });
    if (o.tag !== false) txt(g, B.measured ? '이 목소리를 잰 목 울림' : '그림으로 줄인 모양 · 잰 값 아님', x + w, y + h / 2 + (o.lab || 15) * 2.4, { size: 12.5, weight: 600, color: COL.muted, align: 'right' });
    if (o.hit !== false) listen(x - 6, y - h / 2 - 6, w + 12, h + 12, ko ? [{ text: o.ko, sp: 'ko' }] : say(text, o.sp || 'tc'));
    return B;
  }
  ATS.band = band;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 발음 기호는 자막에 쓰지 않음
     영어 낱말 바로 뒤에 조사를 붙이지 않아요(소리 내어 읽을 때 어색해서) — → 나 = 로 이어요.
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '워러가 되는 t — 미국식 t와 이어 말하기', d: 36, caps: [
      [0.4, 6, '낱말 하나를 두 가지로 들어 봐요. 먼저 한국어식으로 글자대로 읽은 소리예요 → 워터.'],
      [6, 12, '이번에는 미국 영어예요 → water. 가운데 t 소리가 짧은 ㄹ처럼 톡 스치고 지나가요.'],
      [12, 18, '아래 띠는 목 울림이에요. 한국어식은 t 자리에서 울림이 끊기고, 미국식은 끊기지 않고 이어져요.'],
      [18, 24, '미국 영어의 t 소리는 자리에 따라 모양이 바뀌어요. 터지기도 하고, 짧은 ㄹ이 되기도 하고, 사라지기도 해요.'],
      [24, 30, '세 단계로 익혀요. t 소리의 모양을 듣고 가르고, 혀로 만들고, 낱말 사이에서 이어 말해요.'],
      [30, 36, '미국 표준 발음을 기준으로 해요. 소리는 모두 합성 음성이고, 규칙은 경향이에요 — 또박또박 말할 때는 t 소리를 살리기도 해요.'],
    ] },
    { id: 'listen', n: '01', title: '들어 보기 · 구별되나요?', sub: '① 듣고 가르기 · metal · medal · water · hotel', d: 40, caps: [
      [0.4, 6, '먼저 귀부터 시험해요. 두 낱말은 철자에서 t · d 한 글자만 달라요 → metal · medal.'],
      [6, 12, '눌러서 들어 보세요. 미국 영어에서는 둘이 거의 같게 들려요. 가운데 t · d 소리가 모두 짧은 ㄹ이 되거든요.'],
      [12, 18, '이 짝도 그래요 → writer · rider. 그래서 뜻은 앞뒤 말로 가려요.'],
      [18, 25, '그럼 이 둘은 어떨까요 → water · hotel. 둘 다 가운데에 t 소리가 있어요.'],
      [25, 32, 'water → 목 울림이 이어지고, hotel → t 자리에서 끊겼다가 숨과 함께 터져요.'],
      [32, 40, '같은 t 소리인데 왜 다를까요? 센 음절의 자리가 열쇠예요. 아래 **t 듣고 가르기 훈련**에서 목소리 넷으로 연습해요.'],
    ] },
    { id: 'map', n: '02', title: 't의 지도', sub: '① 듣고 가르기 · 자리마다 여섯 가지 모양', d: 44, caps: [
      [0.4, 6, '미국 영어의 t 소리는 자리에 따라 여섯 가지 모양이 돼요. 하나씩 지도에 놓아 봐요.'],
      [6, 12, '첫째, 숨이 터지는 t → 낱말 처음이나 센 음절의 처음이에요 → top · ten · hotel.'],
      [12, 18, '둘째, s 뒤의 t → 숨이 거의 나오지 않아 된소리 따에 가깝게 들려요 → stop · style.'],
      [18, 24, '셋째, 짧은 ㄹ 같은 t → 모음 사이에서, 뒤가 약한 음절일 때예요 → water · city.'],
      [24, 30, '넷째, 목에서 막는 t → 뒤에 은처럼 약한 소리가 올 때예요 → button · mountain.'],
      [30, 36, '다섯째, 사라지는 t → n 바로 뒤에서 빠지기 쉬워요 → twenty · internet.'],
      [36, 44, '여섯째, 끝의 t → 터뜨리지 않고 막은 채 끝내요 → cat · hot. 이제 셋째부터 깊이 들어가요.'],
    ] },
    { id: 'flap', n: '03', title: '짧은 ㄹ 같은 t', sub: '② 소리 만들기 · 혀끝으로 한 번 톡', d: 44, caps: [
      [0.4, 6, '짧은 ㄹ 같은 t 소리를 만들어 봐요. 혀끝을 윗잇몸에 한 번 톡 치고 바로 떼요.'],
      [6, 12, '한국어 나라의 ㄹ과 비슷한 움직임이에요. 막았다가 터뜨리지 않아요.'],
      [12, 18, '그래서 목 울림이 끊기지 않아요. 앞 모음에서 뒤 모음까지 소리가 죽 이어져요.'],
      [18, 24, '조건은 둘이에요. 앞이 모음이나 r 소리이고, 뒤가 약한 음절이에요 → water · city · better · party.'],
      [24, 30, '이 낱말도 같아요 → getting · photo. 띠를 보세요 — t 자리에서 울림이 거의 줄지 않았어요.'],
      [30, 37, 'd 소리도 같은 자리에서 짧은 ㄹ이 돼요 → medal · ladder · rider. 그래서 짝 metal · medal → 거의 같은 소리예요.'],
      [37, 44, '연구에서도 한국인 학습자는 d 소리보다 t 소리를 짧은 ㄹ로 덜 바꾸는 경향을 보였어요.'],
    ] },
    { id: 'stress', n: '04', title: '강세가 정해요', sub: '② 소리 만들기 · 센 음절 앞에서는 터뜨려요', d: 42, caps: [
      [0.4, 6, '같은 t 소리인데 모양이 바뀌는 짝이 있어요 → Italy · Italian. 들어 보세요.'],
      [6, 12, 'Italy → 앞 음절이 세고 t 뒤는 약해서 짧은 ㄹ. Italian → t 바로 뒤가 센 음절이라 터져요.'],
      [12, 18, '띠를 견줘 보세요. Italy → 울림이 이어지고, Italian → t 자리에서 크게 끊겨요.'],
      [18, 24, '이 짝도 같아요 → atom · atomic, photo · photographer. 센 음절이 t 뒤로 옮겨 가면 t 소리가 터져요.'],
      [24, 30, '숫자도 그래요 → thirty · thirteen. 서른은 짧은 ㄹ, 열셋은 뒤가 세서 t 소리가 또렷해요.'],
      [30, 36, '그래서 두 숫자는 t 소리의 모양과 강세 두 가지로 가를 수 있어요. 다만 문장 속에서는 강세가 옮기기도 해요.'],
      [36, 42, '요령 → 센 음절을 먼저 찾아요. t 바로 뒤가 센 음절이면 터뜨리고, 약한 음절이면 톡.'],
    ] },
    { id: 'glot', n: '05', title: '막는 t · 사라지는 t', sub: '② 소리 만들기 · button · twenty', d: 42, caps: [
      [0.4, 6, '뒤에 은처럼 약한 소리가 올 때예요 → button · mountain. t 소리를 터뜨리지 않고 목에서 잠깐 막아요.'],
      [6, 12, '혀끝은 윗잇몸에 댄 채 숨을 잠깐 멈췄다가 코로 은 해요. 버튼처럼 ㅌ을 터뜨리지 않아요.'],
      [12, 18, '이 낱말도 같아요 → certain · written. 이 모양은 이 페이지에서 재지 않았어요 — 교재의 설명이에요.'],
      [18, 24, 'n 바로 뒤의 t 소리는 빠지기 쉬워요 → twenty · internet. 트웨니 · 이너넷에 가깝게 들릴 때가 많아요.'],
      [24, 30, '이 낱말도 그래요 → center · winter · interview. n 다음의 t 소리가 약하게 지나가요.'],
      [30, 36, '다만 늘 빠지는 것은 아니에요. 또박또박 말하거나 천천히 말하면 t 소리를 살려요.'],
      [36, 42, '이 페이지의 합성 음성도 t 소리를 살려 읽을 수 있어요. 빠지는 쪽은 경향으로 기억해요.'],
    ] },
    { id: 'across', n: '06', title: '낱말 사이의 t', sub: '③ 이어 말하기 · get it · a lot of', d: 40, caps: [
      [0.4, 6, '낱말 끝의 t 소리도 뒤에 모음으로 시작하는 낱말이 오면 짧은 ㄹ이 돼요.'],
      [6, 12, 'get → 끝의 t 소리를 막은 채 끝내요. get it → t 소리가 다음 모음에 붙어 게릿에 가깝게 들려요.'],
      [12, 18, 'what about → 와러바웃, a lot of → 어라러브에 가깝게 들려요.'],
      [18, 24, 'not at all → 나래롤, put it on → 푸리론. 한 낱말처럼 이어져요.'],
      [24, 32, '한국어식으로 낱말마다 끊어 읽으면 → 겟 잇. 띠를 보세요 — 낱말 사이에서 울림이 끊겨요.'],
      [32, 40, '한글 어림은 들리는 쪽에 가깝게 적은 것일 뿐이에요. 정확한 소리는 눌러서 들어 보세요.'],
    ] },
    { id: 'link', n: '07', title: '이어 말하기', sub: '③ 이어 말하기 · 끝 자음은 다음 모음에 붙여요', d: 44, caps: [
      [0.4, 6, 't 소리만이 아니에요. 낱말 끝 자음은 다음 낱말의 모음에 붙어요 → pick it up.'],
      [6, 12, '픽 잇 업처럼 끊지 않고, 피키럽처럼 이어요. 끝 자음이 다음 낱말 쪽으로 넘어가요.'],
      [12, 18, 'an apple → 어내플, turn off → 터노프, check it out → 체키라웃, come on → 커만.'],
      [18, 25, '연구에서도 영어 화자는 끝 자음을 다음 모음에 이어 읽었지만, 한국인 학습자는 낱말마다 끊어 읽는 경우가 많았어요.'],
      [25, 31, 't · d 뒤에 you 소리가 오면 바뀌기 쉬워요 → did you → 디쥬, would you → 우쥬.'],
      [31, 37, "don't you → 돈츄, what about you → 와러바우츄. 빠르게 말할 때의 경향이에요."],
      [37, 44, '요령 → 끝 자음을 다음 낱말 쪽으로 미리 옮겨 붙이는 느낌으로 말해요.'],
    ] },
    { id: 'sentence', n: '08', title: '문장 속에서', sub: '③ 이어 말하기 · 긴 문장 · 외래어 함정', d: 40, caps: [
      [0.4, 6, '이제 문장이에요. t 소리의 모양과 이어지는 곳을 함께 찾아요.'],
      [6, 12, 'What about a party at the hotel? → what · about · party = 짧은 ㄹ, at = 끝의 t, hotel = 터지는 t.'],
      [12, 18, 'Put it on the computer. → put · it 끝의 t → 짧은 ㄹ로 이어지고, computer → 짧은 ㄹ.'],
      [18, 24, 'Would you like some water? → would you = 우쥬에 가깝게, water = 짧은 ㄹ.'],
      [24, 30, '외래어 함정도 조심해요. 컴퓨터 · 인터넷 · 파티처럼 한국어로 굳은 소리가 먼저 튀어나와요.'],
      [30, 35, '영어로 말할 때는 컴퓨러 · 이너넷 · 파리 쪽에 가깝게 — 글자보다 소리를 따라가요.'],
      [35, 40, '아래 **따라 말하기**에 문장 스물여덟 개가 있어요. 묶음마다 일곱 문장이에요.'],
    ] },
    { id: 'summary', n: '09', title: '정리', sub: '3단계 발음법 · 미국식 t와 이어 말하기', d: 36, caps: [
      [0.4, 6, '정리해요. ① 듣고 가르기 → t 자리에서 목 울림이 이어지나 끊기나를 들어요.'],
      [6, 12, '② 소리 만들기 → 센 음절 앞은 터뜨리고, 모음 사이 약한 음절 앞은 혀끝으로 한 번 톡.'],
      [12, 18, '뒤에 은처럼 약한 소리가 오면 목에서 막아요. n 뒤에서는 빠지기 쉬워요.'],
      [18, 24, '③ 이어 말하기 → 끝 자음은 다음 낱말의 모음에 붙이고, t · d 뒤의 you → 츄 · 쥬로 바뀌기 쉬워요.'],
      [24, 30, '목표는 원어민과 똑같은 소리가 아니라, 듣는 사람이 낱말을 쉽게 알아듣는 소리예요.'],
      [30, 36, '아래 **t 듣고 가르기 훈련**과 **t 바꾸기 실험실**에서 직접 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  ATS.CHAPTERS = CHAPTERS; ATS.CAPTIONS = CAPTIONS; ATS.END = END;
  ATS.POSTER = CHAPTERS.find(c => c.id === 'intro').t + 20;
  ATS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  ATS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 760, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 700, 800, 24, FD), weight: 800, fam: FD });
  }
  // 오른쪽 위 범례 (모양 이름)
  function legend(g, a, kinds) {
    fade(g, a, () => {
      let x = 1200;
      kinds.slice().reverse().forEach(k => { const r = tag(g, k === 'ko' ? '한국어식' : k === 'link' ? '이어짐' : AT.KIND[k].short, x, 92, COL[k], { align: 'right', size: 14, h: 28 }); x = r.x - 8; });
    });
  }
  // 말하는 소리 표시 (누르기 전)
  const spk = (g, x, y, u, k = 0) => icon(g, 'spk', x, y, 40, hex(COL.accent, 0.5 + 0.5 * Math.max(0, Math.sin(u * 3 + k))));
  const voiceRow = (g, x, y, seqOf, o = {}) => AT.VOICES.forEach((v, i) => {
    const cx = x + i * (o.step || 132), hl = S.voice === v.sp;
    const c = chip(g, v.ko, cx, y, { size: o.size || 14, fill: COL.panel2, stroke: hl ? COL.accent : COL.line, align: 'center', pad: 26, h: o.h || 32 });
    icon(g, 'spk', c.x + 15, y, 15, COL.accent);
    listen(c.x, c.y, c.w, c.h, seqOf(v.sp));
  });
  // 낱말 하나 크게: 칠한 낱말 · 대문자 · t마다 모양과 까닭 · 목 울림 띠 (직접 해 보기에서 고른 낱말)
  function bigWord(g, text, o = {}) {
    const sp = o.sp || 'tc';
    wordT(g, text, 640, 200, o.size || 72, { align: 'center', maxW: 1000, arcs: true, sp });
    txt(g, capsOf(text) + (AT.meaning(text) ? ' · ' + AT.meaning(text) : ''), 640, 262, { size: 18, weight: 600, color: COL.muted, align: 'center' });
    const xs = AT.ts(text).filter(x => KCOL(x.kind));
    xs.slice(0, 4).forEach((x, i) => {
      const y = 302 + i * 34, w = AT.tokens(text)[x.w].t, c = KCOL(x.kind);
      tag(g, `${w} · ${x.letters || x.ph} → ${AT.kindName(x, { short: true })}`, 340, y, c, { align: 'right', size: 14, h: 28 });
      txt(g, AT.kindWhy(x), 356, y, { size: fit(g, AT.kindWhy(x), 15, 860, 500), weight: 500, color: COL.soft });
    });
    const by = 302 + Math.max(1, Math.min(4, xs.length)) * 34 + 70;
    if (AT.tmarks(text).length) band(g, text, 300, Math.min(by, 470), 680, 84, { sp });
    else if (o.note) chip(g, o.note, 640, Math.min(by, 470), { size: 15, color: COL.muted, fill: COL.panel2, align: 'center', h: 32 });
  }
  ATS.bigWord = bigWord;

  const TWIN_AT = [0.4, 12];
  const SCENES = {
    /* 00 들어가며 */
    intro(g, u) {
      const A = 1 - ramp(u, 23.6, 0.5), I = AT.INTRO;
      legend(g, A * ramp(u, 12, 0.5), ['flap', 'ko']);
      fade(g, A * ramp(u, 0.4, 0.6), () => {
        panel(g, 60, 150, 560, 380, { fill: COL.panel, stroke: COL.faint });
        txt(g, '한국어식 — 글자대로', 90, 180, { size: 15, weight: 700, color: COL.ko });
        koText(g, I.ko, 340, 252, 60, { align: 'center' });
        if (u < 12) spk(g, 340, 390, u);
        fade(g, ramp(u, 12, 0.5), () => band(g, I.en, 110, 400, 460, 92, { ko: I.ko }));
      });
      fade(g, A * ramp(u, 6, 0.6), () => {
        panel(g, 660, 150, 560, 380, { fill: COL.panel, stroke: COL.faint });
        txt(g, '미국 영어', 690, 180, { size: 15, weight: 700, color: COL.flap });
        wordT(g, I.en, 940, 252, 60, { align: 'center' });
        if (u < 12) spk(g, 940, 390, u, 1);
        fade(g, ramp(u, 12, 0.5), () => band(g, I.en, 710, 400, 460, 92, {}));
      });
      fade(g, A * win(u, 18, 23.8), () => chip(g, 't는 자리에 따라 → 터지고 · 짧은 ㄹ이 되고 · 목에서 막히고 · 사라지기도', 640, 568, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
      const steps = [['ear', '① 듣고 가르기', '목 울림이 이어지나 · 끊기나'], ['tongue', '② 소리 만들기', '혀끝으로 톡 · 터뜨리기 · 막기'], ['link', '③ 이어 말하기', '낱말 사이 · 끝 자음 + 모음']];
      steps.forEach(([ic, h, s], i) => fade(g, ramp(u, 24.2 + i * 0.6, 0.5), () => {
        const x = 110 + i * 360;
        panel(g, x, 200, 340, 190, { fill: COL.panel, stroke: COL.faint });
        circ(g, x + 170, 252, 30, COL.panel2); icon(g, ic, x + 170, 252, 32, COL.accent);
        txt(g, h, x + 170, 314, { size: 22, weight: 800, color: COL.text, align: 'center' });
        txt(g, s, x + 170, 352, { size: fit(g, s, 16, 310, 500), weight: 500, color: COL.soft, align: 'center' });
      }));
      fade(g, ramp(u, 30, 0.5), () => chip(g, '미국 표준 발음(General American) · 합성 음성 · 규칙은 경향이에요', 640, 460, { size: 16, weight: 600, color: COL.muted, fill: COL.panel2, align: 'center' }));
    },

    /* 01 들어 보기 · 구별되나요? */
    listen(g, u) {
      const sp = S.voice || 'tc';
      const A = 1 - ramp(u, 17.6, 0.5);
      legend(g, ramp(u, 0.4, 0.5), u < 18 ? ['flap'] : ['asp', 'flap']);
      AT.TWIN.forEach(([a, b], k) => fade(g, A * ramp(u, TWIN_AT[k], 0.5), () => {
        const x = 80 + k * 580, hl = (k === 0 && u >= 6 && u < 12) || (k === 1 && u >= 12 && u < 18);
        panel(g, x, 150, 540, 330, { fill: hl ? hex(COL.flap, 0.06) : COL.panel, stroke: hl ? COL.flap : COL.faint });
        wordT(g, a, x + 140, 240, 52, { align: 'center', sp });
        txt(g, '≈', x + 270, 240, { size: 44, weight: 700, color: COL.muted, align: 'center' });
        wordT(g, b, x + 400, 240, 52, { align: 'center', sp });
        txt(g, `${AT.entry(a).gloss} · ${AT.entry(b).gloss}`, x + 270, 298, { size: 16, weight: 500, color: COL.muted, align: 'center' });
        tag(g, 't · d 모두 짧은 ㄹ → 거의 같은 소리', x + 270, 352, COL.flap, { align: 'center', size: 15, h: 32 });
        voiceRow(g, x + 72, 430, v => [{ text: a, sp: v }, { text: b, sp: v, gap: 0.8 }], { step: 132 });
      }));
      fade(g, ramp(u, 18, 0.5), () => {
        AT.CONTRAST.forEach((w, k) => {
          const x = 80 + k * 580, hl = u >= 25 && u < 32;
          const c = k ? COL.asp : COL.flap;
          panel(g, x, 150, 540, 350, { fill: hl ? hex(c, 0.06) : COL.panel, stroke: hl ? c : COL.faint });
          wordT(g, w, x + 270, 222, 56, { align: 'center', sp });
          txt(g, `${capsOf(w)} · ${AT.entry(w).gloss}`, x + 270, 276, { size: 17, weight: 600, color: COL.muted, align: 'center' });
          band(g, w, x + 50, 392, 440, 86, { sp });
        });
      });
      fade(g, ramp(u, 32, 0.5), () => {
        tag(g, '열쇠 = 센 음절의 자리', 640, 532, COL.accent, { align: 'center', size: 16, h: 32 });
        voiceRow(g, 640 - 198, 574, v => [{ text: AT.CONTRAST[0], sp: v }, { text: AT.CONTRAST[1], sp: v, gap: 0.8 }], { step: 132 });
      });
    },

    /* 02 t의 지도 */
    map(g, u) {
      if (S.kword) { legend(g, 1, AT.KIND_ORDER.slice(0, 6)); bigWord(g, S.kword, { note: '이 낱말의 t는 목 울림을 재지 않았어요 (터지는 t · 짧은 ㄹ만 재요)' }); return; }
      legend(g, ramp(u, 0.4, 0.5), AT.KIND_ORDER.slice(0, 6));
      AT.MAP.forEach((m, i) => fade(g, ramp(u, 6 + i * 6, 0.5), () => {
        const col = i % 3, row = Math.floor(i / 3), x = 80 + col * 380, y = 150 + row * 200, c = COL[m.kind];
        const hl = u >= 6 + i * 6 && u < 12 + i * 6 + (i === 5 ? 2 : 0);
        panel(g, x, y, 360, 182, { fill: hl ? hex(c, 0.07) : COL.panel, stroke: hl ? c : COL.faint });
        g.fillStyle = c; g.fillRect(x, y + 14, 5, 154);
        txt(g, `${'하나 둘 셋 넷 다섯 여섯'.split(' ')[i]}`, x + 24, y + 30, { size: 14, weight: 700, color: COL.muted });
        txt(g, AT.KIND[m.kind].ko, x + 24, y + 60, { size: 24, weight: 800, color: c });
        txt(g, RULE[m.kind], x + 24, y + 94, { size: fit(g, RULE[m.kind], 15, 320, 500), weight: 500, color: COL.soft });
        let xx = x + 24;
        m.words.slice(0, 3).forEach(w => { const r = wordT(g, w, xx, y + 140, 28, { maxW: 104 }); xx += r.w + 22; });
      }));
      AT.MAP.forEach((m, i) => fade(g, ramp(u, 1.2, 0.4) * (1 - ramp(u, 6 + i * 6, 0.4)), () => {
        const col = i % 3, row = Math.floor(i / 3);
        panel(g, 80 + col * 380, 150 + row * 200, 360, 182, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true });
      }));
    },

    /* 03 짧은 ㄹ 같은 t */
    flap(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['flap']);
      const sp = 'tc';
      const k = tap(u);
      fade(g, ramp(u, 0.4, 0.6), () => {
        const pose = M ? M.mix('schwa', 'flap', k) : null;
        mouth(g, 60, 150, 0.95, pose, { mark: COL.flap, labels: u < 12 ? ['ridge', 'tip'] : ['ridge', 'tip', 'voice'], voice: u >= 12 || S.flapw ? u : null, t: u });
        const s1 = ['① 혀끝을 윗잇몸 쪽으로', '② 한 번 톡', '③ 바로 떼고 모음으로'];
        let cx = 60;
        s1.forEach((s, i) => { cx += chip(g, s, cx, 520, { size: 13.5, color: k > 0.3 && i === 1 ? COL.flap : COL.soft, fill: COL.panel2, stroke: k > 0.3 && i === 1 ? COL.flap : COL.faint, pad: 8, h: 30 }).w + 8; });
      });
      if (S.flapw) {
        const w = S.flapw;
        wordT(g, w, 820, 220, 64, { align: 'center', sp });
        txt(g, `${capsOf(w)} · ${AT.meaning(w)}`, 820, 282, { size: 17, weight: 600, color: COL.muted, align: 'center' });
        const x = AT.mainT(w);
        if (x) txt(g, AT.kindWhy(x), 820, 322, { size: fit(g, AT.kindWhy(x), 15, 660, 500), weight: 500, color: COL.soft, align: 'center' });
        band(g, w, 520, 440, 600, 96, { sp });
        return;
      }
      // 0 ~ 18: water 크게
      fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, 17.6, 0.4)), () => {
        wordT(g, 'water', 820, 214, 66, { align: 'center', sp });
        txt(g, `${capsOf('water')} · 앞이 모음, 뒤가 약한 음절`, 820, 276, { size: 17, weight: 600, color: COL.muted, align: 'center' });
        fade(g, win(u, 6, 12), () => tag(g, '나라의 ㄹ처럼 한 번 톡 — 터뜨리지 않음', 820, 330, COL.flap, { align: 'center', size: 16, h: 34 }));
        fade(g, ramp(u, 12, 0.5), () => band(g, 'water', 530, 440, 580, 92, { sp }));
      });
      // 18 ~ : 낱말 줄 (30부터 아래 셋은 d)
      const rowsT = AT.FLAPS, rowsD = AT.DFLAPS;
      const row = (w, i, isD) => {
        const y = 170 + i * 64;
        wordT(g, w, 520, y, 30, { maxW: 190, sp });
        band(g, w, 730, y, 300, 44, { sp, chips: 'side', chipSize: 13, tag: false, lab: 12 });
        if (isD) tag(g, 'd', 708, y, COL.flap, { align: 'right', size: 13, h: 24, pad: 7 });
      };
      rowsT.forEach((w, i) => fade(g, ramp(u, i < 4 ? 18 + i * 0.3 : 24 + (i - 4) * 0.3, 0.5) * (i >= 3 ? 1 - ramp(u, 29.6, 0.4) : 1), () => row(w, i, false)));
      rowsD.forEach((w, i) => fade(g, ramp(u, 30 + i * 0.3, 0.5), () => row(w, 3 + i, true)));
      fade(g, ramp(u, 24, 0.5), () => txt(g, ATS.anyMeasured(rowsT, sp) ? '띠 = 이 목소리를 잰 목 울림' : '띠 = 그림으로 줄인 모양 · 잰 값 아님', 1200, 136, { size: 13, weight: 600, color: COL.muted, align: 'right' }));
      fade(g, ramp(u, 37, 0.5), () => chip(g, '연구 → 한국인 학습자는 d 소리보다 t 소리를 짧은 ㄹ로 덜 바꾸는 경향', 640, 566, { size: 16, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 34 }));
    },

    /* 04 강세가 정해요 */
    stress(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['asp', 'flap']);
      const sp = 'tc';
      if (S.stress != null) {
        const [a, b] = AT.STRESS[S.stress];
        [a, b].forEach((w, k) => {
          const x = 80 + k * 580;
          panel(g, x, 150, 540, 360, { fill: COL.panel, stroke: k ? COL.asp : COL.flap });
          wordT(g, w, x + 270, 220, 52, { align: 'center', maxW: 480, sp });
          txt(g, `${capsOf(w)} · ${AT.meaning(w)}`, x + 270, 274, { size: 17, weight: 600, color: COL.muted, align: 'center' });
          const t = AT.mainT(w);
          if (t) txt(g, AT.kindWhy(t), x + 270, 312, { size: fit(g, AT.kindWhy(t), 14, 500, 500), weight: 500, color: COL.soft, align: 'center' });
          band(g, w, x + 50, 420, 440, 80, { sp });
        });
        return;
      }
      const AT0 = [0.4, 18, 18.6, 24];
      AT.STRESS.slice(0, AT.STRESS_SHOWN).forEach(([a, b], i) => fade(g, ramp(u, AT0[i], 0.5), () => {
        const y = 198 + i * 96, hl = (i === 0 && u >= 6 && u < 18) || (i === 3 && u >= 24 && u < 36);
        panel(g, 70, y - 42, 1140, 90, { fill: hl ? hex(COL.accent, 0.05) : COL.panel, stroke: hl ? COL.accent : COL.faint });
        [[a, 90], [b, 640]].forEach(([w, x]) => {
          wordT(g, w, x, y - 10, 28, { maxW: 175, sp });
          txt(g, capsOf(w), x, y + 22, { size: 14, weight: 700, fam: FM, color: COL.muted });
          band(g, w, x + 180, y - 6, 200, 44, { sp, chips: 'side', chipSize: 12.5, tag: false, labels: false });
        });
        txt(g, '→', 618, y - 6, { size: 24, weight: 700, color: COL.muted, align: 'center' });
      }));
      fade(g, win(u, 12, 18.2), () => chip(g, '센 음절이 t 바로 뒤로 → 울림이 끊기고 터져요', 640, 586, { size: 16, color: COL.asp, fill: COL.panel2, stroke: COL.asp, align: 'center', h: 34 }));
      fade(g, win(u, 30, 36.2), () => chip(g, '문장 속에서는 강세가 옮기기도 해요 (thirteen dollars)', 640, 552, { size: 16, color: COL.muted, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 34 }));
      fade(g, ramp(u, 36, 0.5), () => chip(g, '요령 → 센 음절 찾기 · 바로 뒤가 세면 터뜨리고, 약하면 톡', 640, 586, { size: 16, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
      fade(g, ramp(u, 12, 0.5), () => txt(g, ATS.anyMeasured([].concat(...AT.STRESS.slice(0, 4)), sp) ? '띠 = 이 목소리를 잰 목 울림' : '띠 = 그림으로 줄인 모양 · 잰 값 아님', 1200, 142, { size: 13, weight: 600, color: COL.muted, align: 'right' }));
    },

    /* 05 막는 t · 사라지는 t */
    glot(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['glot', 'drop']);
      if (S.glotw) {
        const w = S.glotw, e = AT.entry(w), x = AT.ts(w).find(q => q.kind === 'glot' || q.kind === 'drop');
        wordT(g, w, 640, 220, 84, { align: 'center' });
        txt(g, `${capsOf(w)} · ${e.gloss}`, 640, 290, { size: 18, weight: 600, color: COL.muted, align: 'center' });
        if (x) { tag(g, AT.KIND[x.kind].ko, 640, 350, COL[x.kind], { align: 'center', size: 17, h: 36 }); txt(g, AT.kindWhy(x), 640, 400, { size: fit(g, AT.kindWhy(x), 16, 1000, 500), weight: 500, color: COL.soft, align: 'center' }); }
        if (e.near) txt(g, `빨리 말하면 ≈ ${e.near}`, 640, 450, { size: 22, weight: 700, color: COL.flap, align: 'center' });
        chip(g, '목 울림을 재지 않은 모양이에요 — 교재의 설명 · 또박또박 말하면 t를 살려요', 640, 520, { size: 15, color: COL.muted, fill: COL.panel2, align: 'center', h: 32 });
        return;
      }
      AT.GLOT.forEach((w, i) => fade(g, ramp(u, i < 2 ? 0.4 + i * 0.4 : 12 + (i - 2) * 0.4, 0.5), () => {
        const x = 80 + i * 285, y = 150, e = AT.entry(w);
        panel(g, x, y, 270, 170, { fill: COL.panel, stroke: COL.faint });
        wordT(g, w, x + 135, y + 50, 34, { align: 'center', maxW: 230 });
        txt(g, capsOf(w), x + 135, y + 92, { size: 15, weight: 700, fam: FM, color: COL.muted, align: 'center' });
        txt(g, `${e.ko}처럼 터뜨리지 않기`, x + 135, y + 132, { size: 14, weight: 600, color: COL.soft, align: 'center' });
      }));
      fade(g, win(u, 6, 12), () => tag(g, '혀끝은 댄 채 · 목에서 잠깐 막고 · 코로 은', 640, 360, COL.glot, { align: 'center', size: 16, h: 34 }));
      fade(g, win(u, 12, 18), () => chip(g, '이 모양은 재지 않았어요 — 교재의 설명', 640, 360, { size: 15, color: COL.muted, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 32 }));
      AT.DROP.forEach((w, i) => fade(g, ramp(u, i < 2 ? 18 + i * 0.4 : 24 + (i - 2) * 0.4, 0.5), () => {
        const x = 80 + i * 228, y = 350, e = AT.entry(w);
        panel(g, x, y, 214, 170, { fill: COL.panel, stroke: COL.faint });
        wordT(g, w, x + 107, y + 48, 30, { align: 'center', maxW: 186 });
        txt(g, capsOf(w), x + 107, y + 88, { size: 14, weight: 700, fam: FM, color: COL.muted, align: 'center' });
        if (e.near) txt(g, `≈ ${e.near}`, x + 107, y + 128, { size: 20, weight: 700, color: COL.flap, align: 'center' });
      }));
      fade(g, ramp(u, 30, 0.5), () => chip(g, '늘 빠지지는 않아요 · 또박또박 말하면 t를 살려요 · 합성 음성도 살려 읽을 수 있어요', 640, 568, { size: 15.5, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 06 낱말 사이의 t */
    across(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['flap', 'final', 'link', 'ko']);
      const sp = 'tc';
      const item = S.across != null ? AT.ACROSS[S.across] : null;
      const compare = (en, ko, a) => fade(g, a, () => {
        const hasKo = AT.koMarks(ko).length > 0;
        panel(g, 60, 150, 560, 370, { fill: COL.panel, stroke: COL.faint });
        txt(g, '한국어식 — 낱말마다 끊어 읽기', 90, 180, { size: 15, weight: 700, color: COL.ko });
        koText(g, ko, 340, 250, 50, { align: 'center' });
        if (hasKo) band(g, en, 110, 404, 460, 86, { ko });
        else txt(g, '이 한국어식 소리는 목 울림을 재지 않았어요', 340, 404, { size: 14, weight: 600, color: COL.muted, align: 'center' });
        panel(g, 660, 150, 560, 370, { fill: COL.panel, stroke: COL.faint });
        txt(g, '미국 영어 — 이어 말하기', 690, 180, { size: 15, weight: 700, color: COL.flap });
        wordT(g, en, 940, 250, 50, { align: 'center', arcs: true, sp, maxW: 500 });
        const it = AT.ACROSS.find(x => x.en === en);
        if (it) txt(g, `≈ ${it.near} · ${it.mean}`, 940, 312, { size: 18, weight: 700, color: COL.flap, align: 'center' });
        band(g, en, 710, 404, 460, 86, { sp });
      });
      if (item) { compare(item.en, item.ko, 1); return; }
      // 0 ~ 6: get · get it
      fade(g, win(u, 0.4, 6.2), () => {
        [['get', 380], ['get it', 900]].forEach(([w, x], k) => {
          panel(g, x - 230, 190, 460, 260, { fill: COL.panel, stroke: COL.faint });
          wordT(g, w, x, 290, 64, { align: 'center', arcs: true, sp });
          const t = AT.ts(w).filter(q => q.ph === 't')[0];
          tag(g, AT.KIND[t.kind].ko, x, 390, COL[t.kind], { align: 'center', size: 16, h: 34 });
          if (k) txt(g, '뒤에 모음 → 다음 낱말에 붙어 톡', x, 430, { size: 14, weight: 600, color: COL.soft, align: 'center' });
          else txt(g, '뒤에 모음이 없음 → 막은 채 끝', x, 430, { size: 14, weight: 600, color: COL.soft, align: 'center' });
        });
        arrowR(g, 640, 320);
      });
      // 6 ~ 24: 줄
      const A2 = 1 - ramp(u, 23.6, 0.5), AT2 = [6, 12, 12.4, 18, 18.4];
      fade(g, A2 * ramp(u, 6, 0.5), () => {
        [['영어', 80], ['한국어식 (끊어 읽기)', 450], ['들리는 쪽 어림', 720], ['뜻', 960]].forEach(([s, x]) => txt(g, s, x, 160, { size: 13.5, weight: 700, color: COL.muted }));
      });
      AT.ACROSS.forEach((it, i) => fade(g, A2 * ramp(u, AT2[i], 0.5), () => {
        const y = 206 + i * 72;
        wordT(g, it.en, 80, y, 30, { arcs: true, sp, maxW: 340 });
        koText(g, it.ko, 450, y, 24);
        txt(g, it.near, 720, y, { size: 24, weight: 700, color: COL.flap });
        txt(g, it.mean, 960, y, { size: 16, weight: 500, color: COL.muted });
      }));
      // 24 ~ : 견주기
      const G = AT.ACROSS[0];
      compare(G.en, G.ko, ramp(u, 24, 0.5));
      fade(g, ramp(u, 32, 0.5), () => chip(g, '한글 어림 = 들리는 쪽에 가깝게 적은 것 · 정확한 소리는 눌러서 들어요', 640, 566, { size: 16, color: COL.muted, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 34 }));
    },

    /* 07 이어 말하기 */
    link(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['link', 'yu', 'ko']);
      const sp = 'tc', all = AT.LINK.concat(AT.YU);
      const big = (it, a) => fade(g, a, () => {
        const ko = it.ko || '';
        if (ko) {
          panel(g, 60, 150, 560, 370, { fill: COL.panel, stroke: COL.faint });
          txt(g, '한국어식 — 낱말마다 끊어 읽기', 90, 180, { size: 15, weight: 700, color: COL.ko });
          koText(g, ko, 340, 250, 46, { align: 'center' });
          if (AT.koMarks(ko).length) band(g, it.en, 110, 404, 460, 86, { ko });
          else txt(g, '이 한국어식 소리는 목 울림을 재지 않았어요', 340, 404, { size: 14, weight: 600, color: COL.muted, align: 'center' });
        }
        const cx = ko ? 940 : 640, x0 = ko ? 660 : 300, w0 = ko ? 560 : 680;
        panel(g, x0, 150, w0, 370, { fill: COL.panel, stroke: COL.faint });
        txt(g, '미국 영어 — 이어 말하기', x0 + 30, 180, { size: 15, weight: 700, color: COL.link });
        wordT(g, it.en, cx, 250, 48, { align: 'center', arcs: true, sp, maxW: w0 - 60 });
        txt(g, `≈ ${it.near} · ${it.mean}`, cx, 314, { size: 19, weight: 700, color: COL.link, align: 'center' });
        if (AT.tmarks(it.en).length) band(g, it.en, x0 + 50, 404, w0 - 100, 86, { sp });
        else txt(g, AT.links(it.en).map(l => `${AT.tokens(it.en)[l.w].t} → ${AT.tokens(it.en)[l.w + 1].t}`).join(' · ') + ' : 끝 자음이 다음 낱말로', cx, 404, { size: 16, weight: 600, color: COL.soft, align: 'center' });
      });
      if (S.link != null) { big(all[S.link], 1); return; }
      big(AT.LINK[0], ramp(u, 0.4, 0.5) * (1 - ramp(u, 11.6, 0.4)));
      fade(g, win(u, 6, 12), () => chip(g, 'pick → it · it → up : 끝 자음이 다음 낱말의 모음으로', 640, 566, { size: 16, color: COL.link, fill: COL.panel2, stroke: COL.link, align: 'center', h: 34 }));
      const A2 = ramp(u, 12, 0.5) * (1 - ramp(u, 24.6, 0.4));
      fade(g, A2, () => [['영어', 80], ['한국어식 (끊어 읽기)', 450], ['들리는 쪽 어림', 720], ['뜻', 960]].forEach(([s, x]) => txt(g, s, x, 160, { size: 13.5, weight: 700, color: COL.muted })));
      AT.LINK.forEach((it, i) => fade(g, A2 * ramp(u, 12 + i * 0.3, 0.5), () => {
        const y = 206 + i * 72;
        wordT(g, it.en, 80, y, 30, { arcs: true, sp, maxW: 340 });
        koText(g, it.ko, 450, y, 24);
        txt(g, it.near, 720, y, { size: 24, weight: 700, color: COL.link });
        txt(g, it.mean, 960, y, { size: 16, weight: 500, color: COL.muted });
      }));
      fade(g, win(u, 18, 25), () => chip(g, '연구 → 영어 화자는 이어 읽고, 한국인 학습자는 낱말마다 끊어 읽는 경우가 많았어요', 640, 556, { size: 15.5, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 34 }));
      AT.YU.forEach((it, i) => fade(g, ramp(u, i < 2 ? 25 + i * 0.4 : 31 + (i - 2) * 0.4, 0.5), () => {
        const y = 190 + i * 84;
        wordT(g, it.en, 120, y, 36, { arcs: true, sp, maxW: 400 });
        txt(g, '→', 560, y, { size: 26, weight: 700, color: COL.muted, align: 'center' });
        txt(g, it.near, 610, y, { size: 32, weight: 800, color: COL.yu });
        txt(g, it.mean, 900, y, { size: 17, weight: 500, color: COL.muted });
      }));
      fade(g, ramp(u, 25, 0.5) * (1 - ramp(u, 36.6, 0.4)), () => chip(g, 't · d + you → 츄 · 쥬 : 빠르게 말할 때의 경향', 640, 566, { size: 16, color: COL.yu, fill: COL.panel2, stroke: COL.yu, align: 'center', h: 34 }));
      fade(g, ramp(u, 37, 0.5), () => chip(g, '요령 → 끝 자음을 다음 낱말 쪽으로 미리 옮겨 붙이기', 640, 566, { size: 16.5, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 08 문장 속에서 */
    sentence(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['asp', 'flap', 'final', 'link']);
      const sp = 'tc';
      if (S.sent != null) {
        const s = ATS.SENT_POOL[S.sent];
        txt(g, AT.meaning(s), 640, 176, { size: 18, weight: 600, color: COL.muted, align: 'center' });
        wordT(g, s, 640, 240, 46, { align: 'center', arcs: true, maxW: 1100, sp });
        kindChips(g, s, 640, 330, { align: 'center', maxW: 1100 });
        txt(g, capsOf(s), 640, 400, { size: 22, weight: 700, fam: FM, color: COL.soft, align: 'center' });
        const nl = AT.links(s).length;
        tag(g, `이어지는 곳 ${nl}곳`, 640, 470, COL.link, { align: 'center', size: 16, h: 32 });
        return;
      }
      const A = 1 - ramp(u, 23.6, 0.5), AT3 = [0.4, 12, 18];
      AT.LONG.forEach((s, i) => fade(g, A * ramp(u, AT3[i], 0.5), () => {
        const y = 180 + i * 125;
        wordT(g, s.en, 80, y, 32, { arcs: true, maxW: 1100, sp });
        txt(g, s.ko, 1200, y - 40, { size: 14, weight: 500, color: COL.muted, align: 'right' });
        fade(g, i ? 1 : ramp(u, 6, 0.5), () => kindChips(g, s.en, 80, y + 56, { maxW: 1120 }));
      }));
      AT.LOAN.forEach((k, i) => fade(g, ramp(u, 24 + (i % 3) * 0.3 + (i >= 3 ? 0.9 : 0), 0.5), () => {
        const e = AT.entry(k), col = i % 3, row = Math.floor(i / 3), x = 80 + col * 380, y = 150 + row * 190;
        panel(g, x, y, 360, 172, { fill: COL.panel, stroke: COL.faint });
        txt(g, '한국어로 굳은 소리', x + 22, y + 26, { size: 12.5, weight: 700, color: COL.muted });
        koText(g, e.ko, x + 22, y + 66, 30);
        fade(g, ramp(u, 30, 0.5), () => {
          txt(g, '→', x + 196, y + 66, { size: 24, weight: 700, color: COL.muted, align: 'center' });
          txt(g, e.near, x + 228, y + 66, { size: fit(g, e.near, 30, 120, 800), weight: 800, color: COL.flap });
        });
        wordT(g, e.w, x + 22, y + 126, 24, { sp, maxW: 300 });
      }));
      fade(g, ramp(u, 35, 0.5), () => chip(g, '따라 말하기 28문장 · 묶음마다 일곱', 640, 566, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
    },

    /* 09 정리 */
    summary(g, u) {
      const Y0 = 145;
      fade(g, ramp(u, 0.3, 0.5), () => panel(g, 60, Y0, 1160, 360, { fill: COL.panel, stroke: COL.faint }));
      const rows = [
        ['① 듣고 가르기', [['목 울림이 이어지나', COL.flap], [' · 끊기나', COL.asp]], 0.4],
        ['② 소리 만들기', [['센 음절 앞 → 터뜨리기', COL.asp], [' · 모음 사이 약한 음절 앞 → 혀끝으로 톡', COL.flap]], 6],
        ['', [['뒤에 약한 ‘은’ → 목에서 막기', COL.glot], [' · n 뒤 → 빠지기 쉬움 (경향)', COL.drop]], 12],
        ['③ 이어 말하기', [['끝 자음 + 모음 → 붙이기', COL.link], [' · t · d + you → 츄 · 쥬 (경향)', COL.yu]], 18],
      ];
      rows.forEach(([h, parts, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = Y0 + 50 + i * 74;
        txt(g, h, 96, y, { size: 20, weight: 800, color: COL.text });
        let x = 330;
        parts.forEach(([s, c]) => { x += txt(g, s, x, y, { size: fit(g, s, 20, 440, 700), weight: 700, color: c }); });
        if (i < rows.length - 1) { g.fillStyle = COL.faint; g.fillRect(96, y + 37, 1088, 1); }
      }));
      fade(g, ramp(u, 24, 0.5), () => {
        let x = 160;
        ['water', 'hotel', 'button', 'twenty', 'get it', 'pick it up'].forEach(w => { const r = wordT(g, w, x, 548, 26, { arcs: true }); x += r.w + 46; });
      });
      fade(g, ramp(u, 30, 0.5), () => txt(g, '목표 = 듣는 사람이 낱말을 쉽게 알아듣는 소리', 640, 600, { size: 17, weight: 700, color: COL.soft, align: 'center' }));
    },
  };
  ATS.SCENES = SCENES;
  function arrowR(g, x, y) {
    g.strokeStyle = COL.muted; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 24, y); g.lineTo(x + 20, y); g.stroke();
    g.fillStyle = COL.muted; g.beginPath(); g.moveTo(x + 26, y); g.lineTo(x + 14, y - 8); g.lineTo(x + 14, y + 8); g.closePath(); g.fill();
  }
  // 문장 속 t · d마다 '낱말 → 모양' 표 (줄이 넘치면 줄임)
  function kindChips(g, text, x, y, o = {}) {
    const toks = AT.tokens(text), xs = AT.ts(text).filter(q => KCOL(q.kind));
    const items = xs.map(q => ({ s: `${toks[q.w].t} → ${AT.kindName(q, { short: true })}`, c: KCOL(q.kind) }));
    AT.links(text).filter(l => l.kind === 'cv' && !l.t).forEach(l => items.push({ s: `${toks[l.w].t} + ${toks[l.w + 1].t} → 이어짐`, c: COL.link }));
    let size = 14.5;
    const width = z => items.reduce((a, it) => a + tw(g, it.s, z, 700) + 18 + 8, 0) - 8;
    while (o.maxW && width(size) > o.maxW && size > 10) size -= 0.5;
    let xx = o.align === 'center' ? x - width(size) / 2 : x;
    items.forEach(it => { const r = tag(g, it.s, xx, y, it.c, { size, h: size * 2, pad: 9 }); xx += r.w + 8; });
  }
  ATS.kindChips = kindChips;
  // 이 목소리로 잰 값이 하나라도 있는지 (띠 아래 설명)
  ATS.anyMeasured = (words, sp) => words.some(w => { const m = V.meas(sp || 'tc', w); return !!(m && m.vb); });
  // 문장 고르기 (따라 말하기 28 + 긴 문장 셋)
  ATS.SENT_POOL = AT.SENT.map(s => s.en).concat(AT.LONG.map(s => s.en));

  // 영상 추출용 자막: 아래쪽 띠에 두 줄까지. **굵게**는 강조색, 영어는 연한 하늘색
  function drawCaption(g, text) {
    if (!text) return;
    const words = [];
    text.split('**').forEach((part, k) => { const bold = k % 2 === 1; part.split(/(\s+)/).forEach(w => w && words.push({ w, bold, en: /[A-Za-zÀ-ÿ]/.test(w) && !/[가-힣]/.test(w) })); });
    const lines = [[]]; let lw = 0;
    words.forEach(o => {
      o.ww = tw(g, o.w, 28, o.bold ? 700 : 500);
      const blank = /^\s+$/.test(o.w), line = lines[lines.length - 1];
      if (!blank && line.length && lw + o.ww > 1100) { lines.push([]); lw = 0; }
      if (blank && !lines[lines.length - 1].length) return;
      lines[lines.length - 1].push(o); lw += o.ww;
    });
    lines.forEach(l => { while (l.length && /^\s+$/.test(l[l.length - 1].w)) l.pop(); });
    const widthOf = l => l.reduce((s, o) => s + o.ww, 0), lh = 42, h = lines.length * lh + 22, y0 = H - 24 - h;
    const bw = Math.max(...lines.map(widthOf)) + 52;
    rr(g, (W - bw) / 2, y0, bw, h, 12); g.fillStyle = 'rgba(6,9,13,0.86)'; g.fill();
    lines.forEach((l, li) => {
      let x = (W - widthOf(l)) / 2;
      l.forEach(o => { txt(g, o.w, x, y0 + 11 + lh * li + lh / 2, { size: 28, weight: o.bold ? 700 : 500, color: o.bold ? COL.accent : o.en ? COL.en : COL.text }); x += o.ww; });
    });
    return lines.length;
  }
  ATS.captionLines = (g, text) => drawCaption(g, text);

  ATS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[ATS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, ATS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + AT.allText() + Object.values(RULE).join('') + MLAB.join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔⇢≈≠✓✕×?!~=+-–—/:…‘’“”\'%&<>|ɹɝɚəæɑɔɪʊʌɛŋθðʃʒˈˌdB울림이어짐끊김곳';
  ATS.baseText = EXTRA;
  ATS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = ATS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { ATS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
