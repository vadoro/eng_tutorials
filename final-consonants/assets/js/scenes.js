/* 없는 ‘으’를 넣지 마세요 — 끝소리와 자음 묶음: 영상 장면과 자막 (FCS)
 * 그림은 시간 t와 사용자 상태(S)만의 함수예요. 음절 수 · 끝 자음 · 넣은 ‘으’ · 끝소리는 규칙 엔진(FC)이 계산하고,
 * 소리 덩어리(크기 띠) · 박자 공 · 모음 길이 막대는 미리 만든 음성 파일을 따로 잰 값(FCV.meas)으로 그려요(잰 값이 없으면 엔진의 기본 모양).
 * 입 그림은 공통 부품 EN.mouth(../shared/mouth.js).
 * 역할 색: 모음 없이 이어지는 자음 글자 노랑 · 영어 박자 하늘 · 한국어식 주황 · 넣은 ‘으’ 분홍 점선 ·
 *          목이 울리는 끝(긴 모음) 보라 · 울리지 않는 끝(짧은 모음) 하늘 · 한 박자 더 느는 [ɪd] · [ɪz] 민트
 */
(function () {
  'use strict';
  const FC = window.FC, M = window.EN.mouth, V = window.FCV;
  const FCS = (window.FCS = {});
  const W = 1280, H = 720;
  FCS.W = W; FCS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  FCS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    a: '#FFC15E', b: '#6EC8FF', ins: '#FF7AA8', weak: '#7FE0A8', str: '#C9A7FF', trap: '#FF9F7A', plain: '#7D8A99',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  // 역할: bare 모음 없는 자음 글자 · beat 영어 박자 · voiced 목이 울리는 끝 · voiceless 울리지 않는 끝 · extra 한 박자 더
  COL.bare = COL.a; COL.beat = COL.b; COL.voiced = COL.str; COL.voiceless = COL.b; COL.extra = COL.weak;
  FCS.COL = COL;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (FCS.S = { lword: null, voice: null, stopk: null, clus: null, vpair: null, ending: null, loan: null, sent: null });
  FCS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  FCS.hits = () => HITS;

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
  function arrowHead(g, x, y, ang, color, s = 11) {
    g.fillStyle = color; g.beginPath(); g.moveTo(x, y);
    g.lineTo(x - Math.cos(ang - 0.45) * s, y - Math.sin(ang - 0.45) * s);
    g.lineTo(x - Math.cos(ang + 0.45) * s, y - Math.sin(ang + 0.45) * s); g.closePath(); g.fill();
  }
  function arrow(g, x0, y0, x1, y1, color, lw = 2.5, dash) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; if (dash) g.setLineDash(dash);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - Math.cos(ang) * 8, y1 - Math.sin(ang) * 8); g.stroke(); g.setLineDash([]);
    arrowHead(g, x1, y1, ang, color);
  }
  function check(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x - s * 0.12, y + s * 0.4); g.lineTo(x + s * 0.55, y - s * 0.45); g.stroke();
  }
  function cross(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - s / 2, y - s / 2); g.lineTo(x + s / 2, y + s / 2); g.moveTo(x + s / 2, y - s / 2); g.lineTo(x - s / 2, y + s / 2); g.stroke();
  }
  FCS.check = check; FCS.cross = cross;
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
  const ring = (g, x, y, r, color, lw = 2, dash) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.strokeStyle = color; g.lineWidth = lw; if (dash) g.setLineDash(dash); g.stroke(); g.setLineDash([]); };
  // 누르면 들려줌: seq = [{ text, sp }]
  const listen = (x, y, w, h, seq) => HITS.push({ x, y, w, h, play: seq });
  const hex = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  FCS.hex = hex;
  const say = (k, sp = 'tc') => [{ text: FC.word(k), sp }];
  const sayKo = k => [{ text: FC.entry(k).ko, sp: 'ko' }];

  /* ---------- 아이콘 — 24×24 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요 ---------- */
  const ICON = {
    spk: [['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'f'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
    ear: [['M7.5 9.5a4.5 4.5 0 1 1 9 0c0 3.1-3 3.7-3 6.6a2.7 2.7 0 0 1-5.1 1.1'], ['M10.5 10a1.6 1.6 0 1 1 3 .9']],
    mouth: [['M3.5 12c2.5-3 5.5-4.2 8.5-4.2S18 9 20.5 12c-2.5 3-5.5 4.2-8.5 4.2S6 15 3.5 12z'], ['M3.5 12h17']],
    text: [['M4 6.5h16M4 10.5h16M4 14.5h11M4 18.5h7']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z'], ['M6 11a6 6 0 0 0 12 0'], ['M12 17v3.5M9 20.5h6']],
    tap: [['M9 11V5.5a1.5 1.5 0 0 1 3 0V11'], ['M12 10.5V9a1.5 1.5 0 0 1 3 0v2'], ['M15 10.5a1.5 1.5 0 0 1 3 0V15a5.5 5.5 0 0 1-5.5 5.5h-1A5.5 5.5 0 0 1 6 15.5L4.6 12.6a1.4 1.4 0 0 1 2.4-1.4L9 14']],
    balls: [['M4 15a2 2 0 1 0 4 0a2 2 0 1 0-4 0'], ['M9 12a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0-7.6 0'], ['M17.5 15a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0']],
  };
  FCS.ICON = ICON;
  const P2D = {};
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const k = size / 24;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    (ICON[id] || []).forEach(([d, m]) => { const p = P2D[d] || (P2D[d] = new Path2D(d)); if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  FCS.icon = icon;
  FCS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 입 그림 (EN.mouth) ---------- */
  const MLAB = ['윗잇몸', '센입천장', '여린입천장', '혀끝', '혀 뒤', '입술', '목(성대)'];
  const mfont = (sz, w) => fnt(sz, w || 600);
  function mouth(g, x, y, s, pose, o = {}) {
    if (REC) MLAB.forEach(m => REC.add(m));
    return M.draw(g, x, y, s, pose, Object.assign({ font: mfont }, o));
  }
  FCS.mouth = mouth;
  // 자세 차례: seq = [[자세, 초, 이름, 목 울림?]] → 시각 p(초, 반복)의 섞인 자세와 지금 칸
  function poseAt(seq, p) {
    const T = seq.reduce((a, s) => a + s[1], 0);
    let t = ((p % T) + T) % T, i = 0;
    while (i < seq.length - 1 && t >= seq[i][1]) { t -= seq[i][1]; i++; }
    const cur = seq[i], nx = seq[(i + 1) % seq.length], k = clamp((t - cur[1] * 0.6) / (cur[1] * 0.4));
    return { pose: M.mix(cur[0], i === seq.length - 1 ? cur[0] : nx[0], i === seq.length - 1 ? 0 : k), i, voiced: !!cur[3], T };
  }
  FCS.poseAt = poseAt;

  /* ---------- 낱말 그리기: 모음 없이 이어지는 자음 글자 [ ]를 노랑 + 밑줄 ----------
     o.final: 끝 [ ]만 다른 색(유성 · 무성 짝) · o.paint=false: 칠하지 않음 */
  function word(g, k, x, y, size, o = {}) {
    const e = FC.entry(k), wt = o.weight || 700;
    if (!e) { const ww = txt(g, k, x, y, { size, weight: wt, color: o.base || COL.text, align: o.align }); return { x, w: ww }; }
    const parts = FC.spellSegs(k), lastBare = parts.map(p => p.bare).lastIndexOf(true);
    const total = parts.reduce((s, p) => s + tw(g, p.t, size, wt), 0);
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx;
    parts.forEach((p, i) => {
      const c = o.paint === false || !p.bare ? (o.base || COL.text) : (o.final && i === lastBare ? o.final : COL.bare);
      const ww = txt(g, p.t, xx, y, { size, weight: wt, color: c });
      if (p.bare && o.paint !== false) { g.fillStyle = c; g.fillRect(xx, y + size * 0.56, ww, Math.max(2.5, size * 0.06)); }
      xx += ww;
    });
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, total + 16, size * 1.45, say(k, o.sp || 'tc'));
    return { x: x0, w: total };
  }
  FCS.word = word;
  // 한국어식 표기: 넣은 ‘으’ 음절은 분홍 점선 상자, 나머지는 주황
  function koWord(g, k, x, y, size, o = {}) {
    const parts = FC.koParts(k);
    if (!parts.length) return { x, w: 0 };
    const wt = o.weight || 700, gap = size * 0.06;
    const ws = parts.map(p => tw(g, p.ch, size, wt)), total = ws.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx;
    parts.forEach((p, i) => {
      const ins = p.role === 'ins' && o.ins !== false;
      if (ins) { rr(g, xx - 3, y - size * 0.62, ws[i] + 6, size * 1.24, 6); g.strokeStyle = COL.ins; g.lineWidth = 2; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]); }
      txt(g, p.ch, xx, y, { size, weight: wt, color: ins ? COL.ins : (o.color || COL.trap) });
      xx += ws[i] + gap;
    });
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, total + 16, size * 1.45, sayKo(k));
    return { x: x0, w: total };
  }
  FCS.koWord = koWord;
  // 문장: 사전에 있는 낱말의 [ ] 글자를 칠하고, 이어 말하는 자리에 ‿
  function sentence(g, text, x, y, size, o = {}) {
    const segs = FC.segs(text), wt = o.weight || 600;
    let total = segs.reduce((a, s) => a + tw(g, s.t, size, wt), 0);
    const sz = o.maxW && total > o.maxW ? size * o.maxW / total : size;
    if (sz !== size) total = segs.reduce((a, s) => a + tw(g, s.t, sz, wt), 0);
    let xx = o.align === 'center' ? x - total / 2 : x;
    const x0 = xx;
    segs.forEach((s, i) => {
      const c = s.role === 'bare' ? COL.bare : (o.base || COL.text);
      const ww = txt(g, s.t, xx, y, { size: sz, weight: wt, color: c });
      if (s.role === 'bare') { g.fillStyle = c; g.fillRect(xx, y + sz * 0.56, ww, 2.5); }
      if (s.link && o.links !== false) {
        // 끝 글자에서 다음 낱말 첫 글자로 이어지는 ‿
        const sp = tw(g, ' ', sz, wt), nx = segs[i + 2] ? tw(g, segs[i + 2].t[0], sz, wt) : 0;
        const ax = xx + ww - Math.min(ww, sz * 0.3), bx = xx + ww + sp + nx * 0.5;
        g.strokeStyle = COL.good; g.lineWidth = 2.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(ax, y + sz * 0.72); g.quadraticCurveTo((ax + bx) / 2, y + sz * 1.12, bx, y + sz * 0.72); g.stroke();
      }
      xx += ww;
    });
    if (o.hit !== false) listen(x0 - 8, y - sz * 0.75, total + 16, sz * 1.6, [{ text, sp: o.sp || 'tc' }]);
    return { x: x0, w: total, size: sz };
  }
  FCS.sentence = sentence;

  /* ---------- 박자 공 ----------
     잰 값(FCV.meas)이 있으면 그 목소리의 음절마다 길이 L · 크기 A로, 없으면 엔진의 기본 모양으로 그려요.
     영어 = 하늘 공(모음 하나에 하나), 한국어식 = 주황 공, 넣은 ‘으’ = 분홍 점선 공 */
  function fromMeas(m, n) {
    if (!m || !m.s || m.s.length !== n) return null;
    const durs = m.s.map(x => x[1] - x[0]), md = Math.max(...durs);
    return m.s.map((x, i) => ({ L: durs[i] / md, A: Math.pow(10, Math.min(0, x[2]) / 20), ms: durs[i] }));
  }
  // 한국어식은 잰 값을 쓰지 않고 늘 기본 모양(박자마다 공 하나)으로 그려요. 합성 음성의 넣은 ‘으’는 스 · 트처럼
  // 무성 자음 사이에서 거의 소리 나지 않기도 해서(글라스의 그 20ms · -17dB), 잰 공이 ‘으마다 박자 하나’와 어긋나 보여요.
  // 한국어식 표기가 몇 박자인지(음절 수)를 보여 주는 그림이에요.
  function ballData(k, o = {}) {
    if (o.ko) {
      const parts = FC.koParts(k);
      return { b: FC.koSchematic(k).map((v, i) => Object.assign({}, v, { ins: parts[i].role === 'ins', diph: parts[i].role === 'diph' })), measured: false, labels: parts.map(p => p.ch) };
    }
    const n = FC.nSyl(k), m = o.meas === false ? null : fromMeas(V.meas(o.sp || 'tc', FC.word(k)), n);
    return { b: m || FC.schematic(k), measured: !!m, labels: FC.entry(k).spell };
  }
  FCS.ballData = ballData;
  const ballR = (v, R) => { const q = 0.5 * v.L + 0.5 * v.A; return R * (0.32 + 0.68 * q * q); };
  // 공 줄: x는 가운데(o.align = 'left'면 왼쪽 끝). 돌려줌 { x0, x1, cx: [] }
  function balls(g, k, x, y, o = {}) {
    const R = o.R || 30, d = ballData(k, o), n = d.b.length;
    const ls = o.lab || Math.max(13, Math.round(R * 0.6));
    const step = Math.max(2 * R + 10, ...d.labels.map(l => tw(g, l, ls, 700) + 14));
    const span = step * (n - 1);
    const x0 = o.align === 'left' ? x + R : x - span / 2;
    const cx = [];
    d.b.forEach((v, i) => {
      const r = ballR(v, R), X = x0 + i * step;
      cx.push(X);
      const c = o.mono || (o.ko ? (v.ins ? COL.ins : COL.trap) : COL.beat);
      if (v.ins) { circ(g, X, y, r, hex(c, 0.16)); ring(g, X, y, r, c, 2, [5, 4]); }
      else { circ(g, X, y, r, hex(c, 0.78)); ring(g, X, y, r, c, 2); }
      if (o.labels !== false) txt(g, d.labels[i], X, y + R + 14, { size: ls, weight: 700, color: c, align: 'center' });
    });
    if (o.hit !== false) listen(x0 - R - 6, y - R - 6, span + 2 * R + 12, 2 * R + 30 + ls, o.ko ? sayKo(k) : say(k, o.sp || 'tc'));
    return { x0: x0 - R, x1: x0 + span + R, cx, measured: d.measured, n };
  }
  FCS.balls = balls;
  FCS.ballR = ballR;

  /* ---------- 소리 덩어리: 잰 크기(e, 20ms마다)를 띠로 — 모음 자리(잰 음절)는 칠함 ----------
     o.ko: 한국어식(넣은 ‘으’ 음절은 분홍) · 늘 기본 모양(박자 공과 같은 까닭) · 영어도 잰 값이 없으면 기본 모양(음절마다 봉우리 하나)
     기본 모양으로 그린 띠에는 ‘그림’이라고 적어요. */
  function blob(g, k, x, y, w, h, u, o = {}) {
    const text = o.ko ? FC.entry(k).ko : FC.word(k), sp = o.ko ? 'ko' : (o.sp || 'tc');
    const m = o.ko ? null : V.meas(sp, text), parts = o.ko ? FC.koParts(k) : null;
    const n = o.ko ? parts.length : FC.nSyl(k);
    let segs, en, T, measured = false;
    if (m && m.s && m.s.length === n && m.e) {
      segs = m.s.map(s => [s[0], s[1]]); en = m.e; T = en.length * 20; measured = true;
    } else {
      const sc = o.ko ? FC.koSchematic(k) : FC.schematic(k);
      T = 60; segs = sc.map(v => { const d = 110 + 150 * v.L; const s = [T + 40, T + 40 + d]; T += d + 70; return s; }); T += 60;
      en = [];
      for (let t = 0; t < T; t += 20) {
        const i = segs.findIndex(s => t >= s[0] - 30 && t < s[1] + 30);
        if (i < 0) { en.push(-60); continue; }
        const mid = (segs[i][0] + segs[i][1]) / 2, half = (segs[i][1] - segs[i][0]) / 2 + 30;
        en.push(20 * Math.log10(sc[i].A) - 10 - 26 * Math.pow(Math.abs(t - mid) / half, 3));   // -10: 봉우리가 박자 글자 밑에 오게
      }
    }
    const t0 = Math.max(0, segs[0][0] - 120), t1 = Math.min(T, segs[segs.length - 1][1] + 160);
    const X = t => x + (t - t0) / (t1 - t0) * w;
    const p = clamp((u - (o.at || 0)) / 1.6);
    if (o.frame !== false) panel(g, x - 10, y - h - 6, w + 20, h + 16, { fill: COL.panel2, stroke: COL.faint, r: 10 });
    g.save(); g.beginPath(); g.rect(x - 2, y - h - 8, (w + 4) * p, h + 20); g.clip();
    // 모음 자리(잰 음절) 칠하기
    segs.forEach((s, i) => {
      const ins = parts && parts[i].role === 'ins', c = o.ko ? (ins ? COL.ins : COL.trap) : COL.beat;
      g.fillStyle = hex(c, ins ? 0.14 : 0.2); g.fillRect(X(s[0]), y - h, X(s[1]) - X(s[0]), h);
      if (ins) { g.strokeStyle = COL.ins; g.lineWidth = 1.5; g.setLineDash([4, 4]); g.strokeRect(X(s[0]), y - h, X(s[1]) - X(s[0]), h); g.setLineDash([]); }
    });
    // 크기 띠: 모음 자리(잰 음절) 밖은 회색 — s · k 같은 자음 소리도 크기는 커서, 색칠한 모음 덩어리와 나눠 보여요
    const band = () => {
      g.beginPath(); g.moveTo(X(t0), y);
      en.forEach((d, i) => { const t = i * 20; if (t < t0 || t > t1) return; g.lineTo(X(t), y - clamp((d + 42) / 42) * (h - 4)); });
      g.lineTo(X(t1), y); g.closePath();
    };
    band(); g.fillStyle = hex(COL.muted, 0.3); g.fill();
    segs.forEach((s, i) => {
      const ins = parts && parts[i].role === 'ins';
      g.save(); g.beginPath(); g.rect(X(s[0]), y - h - 2, X(s[1]) - X(s[0]), h + 4); g.clip();
      band(); g.fillStyle = hex(o.ko ? (ins ? COL.ins : COL.trap) : COL.beat, ins ? 0.55 : 0.72); g.fill();
      g.restore();
    });
    g.restore();
    if (o.count !== false) txt(g, `${FC.nKo(n)} 박자${measured ? '' : ' · 그림'}`, x + w, y - h + 12, { size: 14, weight: 800, color: o.ko ? COL.trap : COL.beat, align: 'right' });
    if (o.hit !== false) listen(x - 10, y - h - 6, w + 20, h + 16, o.ko ? sayKo(k) : say(k, sp));
    return { measured };
  }
  FCS.blob = blob;

  /* ---------- 모음 길이 막대 (한 음절 낱말: 잰 음절의 길이 ms) ---------- */
  const vowelMs = (k, sp = 'tc') => { const m = V.meas(sp, FC.word(k)); return m && m.s && m.s.length === 1 ? m.s[0][1] - m.s[0][0] : null; };
  FCS.vowelMs = vowelMs;
  const SCH_MS = { voiced: 230, voiceless: 150 };   // 잰 값이 없을 때 그림용(어림)
  function vbar(g, k, x, y, wmax, color, u, o = {}) {
    const ms = vowelMs(k, o.sp), v = ms || (FC.isVoicedObs(FC.final(k)) ? SCH_MS.voiced : SCH_MS.voiceless);
    const L = (wmax * v / 360) * clamp((u - (o.at || 0)) / 0.8);
    rr(g, x, y - 11, Math.max(4, L), 22, 6); g.fillStyle = hex(color, 0.8); g.fill();
    if (L > 30) txt(g, ms ? `${Math.round(ms)}ms` : '', x + L + 10, y, { size: 14, fam: FM, weight: 700, color: COL.soft });
    return { ms, measured: !!ms };
  }
  FCS.vbar = vbar;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호는 자막에 쓰지 않음
     영어 낱말 바로 뒤에 조사를 붙이지 않아요(소리 내어 읽을 때 어색해서) — → 나 = 로 이어요.
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '없는 ‘으’를 넣지 마세요 — 끝소리와 자음 묶음', d: 36, caps: [
      [0.4, 6, '책상을 영어로 말해 보세요. 한국어로 적으면 데스크, 세 박자예요.'],
      [6, 12, '영어 desk → 한 박자예요. 모음은 에 하나뿐이고, 뒤의 두 자음은 모음 없이 붙어요.'],
      [12, 18, '한국어식으로 읽으면 끝 자음 뒤에 없는 으를 넣어요. 데스크의 스와 크가 그 으예요.'],
      [18, 24, '으가 들어가면 박자가 늘고, 다른 낱말로 들리기도 해요. sport · support → 으 하나 차이로 다른 낱말이에요.'],
      [24, 30, '세 단계로 익혀요. 박자를 듣고 세고, 끝 자음에서 멈추는 입을 만들고, 낱말과 문장 속에서 써요.'],
      [30, 36, '미국 표준 발음을 기준으로 해요. 소리는 모두 합성 음성이에요.'],
    ] },
    { id: 'listen', n: '01', title: '들어 보기 · 몇 박자인가요?', sub: '① 듣고 가르기 · 박자 = 모음 소리 수 · 목소리 넷', d: 40, caps: [
      [0.4, 6, '먼저 귀부터 시험해요. 손뼉을 치며 박자를 세어 보세요. 박자 하나에 모음 소리가 하나예요.'],
      [6, 12, '낱말을 눌러 들어 보세요 → milk · test · strike. 몇 박자로 들리나요?'],
      [12, 18, '셋 다 한 박자예요. 띠는 이 목소리의 소리 크기를 재서 그린 것이에요. 칠한 모음 덩어리는 하나, 회색은 자음 소리예요.'],
      [18, 25, '한국어식은 밀크 두 박자, 테스트 세 박자, 스트라이크 다섯 박자예요. 으를 넣을 때마다 박자가 하나씩 늘어요.'],
      [25, 32, '자음은 아무리 많아도 박자를 만들지 않아요. strike → 앞의 세 자음이 모음 하나에 모두 붙어요.'],
      [32, 40, '여러 목소리로 듣고 박자를 세는 연습이 도움이 돼요. 아래 놀이터의 **박자 세기**가 그 연습이에요.'],
    ] },
    { id: 'korean', n: '02', title: '한국어 음절의 모양', sub: '받침은 하나 · 터뜨리지 않아요 → 남는 자음에 ‘으’', d: 40, caps: [
      [0.4, 6, '왜 으를 넣을까요? 한국어 음절은 모양이 정해져 있어요. 첫소리 하나, 모음 하나, 받침 하나까지예요.'],
      [6, 12, '받침은 일곱 소리뿐이고, 터뜨리지 않고 닫은 채 끝나요. 국, 밥, 낫이 그래요.'],
      [12, 18, '그래서 영어 자음이 모음 없이 이어지면, 한국어식은 자음마다 으를 붙여 음절을 새로 만들어요.'],
      [18, 24, 'strike → 모음은 아이 하나예요. 한국어식은 스, 트, 라, 이, 크. 한 박자가 다섯 박자가 돼요.'],
      [24, 31, '한국인 학습자가 영어 자음 뒤에 모음을 넣는 현상은 연구에서도 꾸준히 다뤄 왔어요.'],
      [31, 40, '오늘의 작전 → 모음 소리만큼만 박자를 세고, 자음은 모음 없이 이어요. 끝 자음에서는 멈춰요.'],
    ] },
    { id: 'stop', n: '03', title: '끝 자음에서 멈추기', sub: '② 입 모양 만들기 · 닫고 멈춰요 — 터뜨려 ‘으’를 만들지 않아요', d: 42, caps: [
      [0.4, 6, '이제 입을 만들어요. 영어의 끝 자음은 입을 닫거나 혀를 댄 채로 멈추면 돼요.'],
      [6, 12, 'desk → 끝에서 혀 뒤를 여린입천장에 붙이고 멈춰요. 숨을 살짝 터뜨려도 목은 울리지 않아요.'],
      [12, 18, '한국어식 크는 혀를 떼며 목을 울려 으를 내요. 목이 울리는 그 순간 박자가 하나 늘어요.'],
      [18, 24, 'stop → 두 입술을 닫고 멈춰요. cat → 혀끝을 윗잇몸에 대고 멈춰요.'],
      [24, 30, '닫은 채 끝나도 괜찮아요. 미국 영어에서도 끝 자음을 터뜨리지 않고 닫은 채 끝낼 때가 많아요.'],
      [30, 36, '요령 → 끝 자음의 입 모양을 잠깐 그대로 두어 보세요. 목에 손을 대고 울리지 않는지 확인해요.'],
      [36, 42, '터뜨린다면 숨만 살짝 내보내요. 목소리를 싣는 순간 으가 돼요.'],
    ] },
    { id: 'cluster', n: '04', title: '자음 묶음 — 자음에서 자음으로', sub: '② 입 모양 만들기 · s → t → r 사이에 ‘으’ 없이', d: 42, caps: [
      [0.4, 6, '자음이 여럿 붙은 묶음도 같아요. 자음과 자음 사이에 모음을 넣지 않고 바로 다음 자음으로 옮겨요.'],
      [6, 12, 'strike → 혀끝을 윗잇몸 가까이 대어 바람을 내고, 그대로 붙여 막고, 혀를 들어 r 소리로 넘어가요.'],
      [12, 18, '세 자음의 혀 자리가 서로 가까워요. 혀끝이 윗잇몸 근처에서 거의 그대로 옮겨 가면 돼요.'],
      [18, 24, '한국어식은 자음마다 혀를 내리고 목을 울려 으를 내요. 그래서 스, 트처럼 박자가 생겨요.'],
      [24, 30, '끝 묶음도 같아요 → desk · milk · test. 마지막 자음까지 모음 없이 붙여요.'],
      [30, 36, '으를 넣으면 다른 낱말이 되기도 해요 → sport · support, blow · below. 오른쪽은 모음이 하나 더 있는 낱말이에요.'],
      [36, 42, '요령 → 처음에는 천천히, 자음끼리 붙인 채로 말해 보고, 점점 빠르게 해요.'],
    ] },
    { id: 'voice', n: '05', title: '끝 유성 · 무성 — 모음 길이', sub: '① 듣고 가르기 · bag · back · 목이 울리는 끝 앞에서는 모음이 길어요', d: 44, caps: [
      [0.4, 6, '끝 자음이 목을 울리는 소리인지 아닌지로 갈리는 짝이 있어요 → bag · back, prize · price.'],
      [6, 12, '한국어 받침은 하나로 닫혀서 두 낱말 모두 백처럼 들리기 쉬워요.'],
      [12, 18, '잘 들리는 차이는 끝 자음보다 그 앞의 모음 길이예요. 목이 울리는 끝 앞에서는 모음이 길어요.'],
      [18, 24, '막대를 보세요. 이 목소리의 모음 길이를 재서 그렸어요. bag → 모음이 길고, back → 짧아요.'],
      [24, 30, 'eyes · ice, leave · leaf → 모두 같은 짝이에요. 목이 울리는 쪽은 모음을 끌고, 울리지 않는 쪽은 짧게 끊어요.'],
      [30, 37, '한국어식으로 배그처럼 으를 붙이면 박자가 늘어요. 으 없이 모음 길이로 갈라요.'],
      [37, 44, '요령 → 목이 울리는 쪽은 모음을 길게 끌다가 울린 채로 닫고, 울리지 않는 쪽은 짧게 끊고 닫아요.'],
    ] },
    { id: 'ending', n: '06', title: '과거형 · 복수형의 끝소리', sub: '③ 낱말 속에서 · worked = 한 박자 · wanted = 두 박자', d: 44, caps: [
      [0.4, 6, '과거형의 -ed, 복수형의 -s → 철자는 하나지만 소리는 셋이에요. 앞 소리에 따라 정해져요.'],
      [6, 12, 't · d 뒤에서만 한 박자가 늘어요 → wanted · needed. 나머지는 박자가 그대로예요.'],
      [12, 18, '목이 울리지 않는 소리 뒤 → t 소리. worked · asked · stopped. 모두 한 박자예요.'],
      [18, 24, '모음이나 목이 울리는 소리 뒤 → d 소리. played · loved. 이것도 한 박자예요.'],
      [24, 30, '한국어식 애스크드, 워크드는 드를 붙여 박자를 늘려요. asked → 한 박자로 끝나요.'],
      [30, 37, '복수형도 같아요. s · z · sh · ch · j 뒤에서만 한 박자 늘어요 → buses · watches. cats · dogs → 한 박자예요.'],
      [37, 44, '요령 → 바탕 낱말을 말하고 끝소리만 살짝 붙여요. work, worked. 박자를 세며 확인해요.'],
    ] },
    { id: 'loan', n: '07', title: '외래어 함정', sub: '③ 낱말 속에서 · 버스 · 데스크 · 스트라이크 · 크리스마스', d: 44, caps: [
      [0.4, 6, '외래어는 한국어 표기에 으가 들어 있어서 더 조심해요. 표기의 박자와 영어의 박자를 견줘 봐요.'],
      [6, 12, '끝 자음 하나 → bus · bed · cake · note. 한국어식은 끝에 으가 붙어요.'],
      [12, 18, '끝 자음 묶음 → milk · desk · test · mask. 끝의 두 자음 사이에도 으가 들어가요.'],
      [18, 24, '앞 자음 묶음 → club · glass · stress · strike. 첫 자음 뒤에 으가 들어가요.'],
      [24, 31, "앞뒤에도, 가운데에도 → sports · brand · Christmas · McDonald's. 크리스마스는 다섯 박자, 영어는 두 박자예요."],
      [31, 37, '분홍 점선이 넣은 으예요. 영어로 말할 때는 이 점선을 모두 빼요.'],
      [37, 44, '외래어를 영어로 말할 때는 한국어 표기를 잠시 잊고, 모음 소리만 세어 박자를 정해요.'],
    ] },
    { id: 'sentence', n: '08', title: '문장 속에서 · 이어 말하기', sub: '③ 문장 속에서 · 끝 자음은 다음 모음에 붙여요', d: 44, caps: [
      [0.4, 6, '문장 속에서 끝 자음 뒤에 모음으로 시작하는 낱말이 오면, 끝 자음을 그 모음에 붙여 말해요.'],
      [6, 12, 'Let me check it again. check · it → 체킷처럼 이어져요. 으를 넣을 틈이 없어요.'],
      [12, 18, 'I left my bag on the bus. bag · on → 배곤처럼 이어져요.'],
      [18, 24, 'We had a test in English. test · in → 테스틴처럼 이어져요.'],
      [24, 30, '다음 낱말이 자음으로 시작하면, 끝 자음은 닫은 채로 두고 바로 다음 낱말로 넘어가요.'],
      [30, 37, 'Merry Christmas! 문장 끝에서는 바람 소리만 내고 끝나요. 크리스마스처럼 박자를 늘리지 않아요.'],
      [37, 44, '아래 **따라 말하기**에 문장 스물여덟 개가 있어요. 묶음마다 일곱 문장이에요.'],
    ] },
    { id: 'summary', n: '09', title: '정리', sub: '3단계 발음법 · 박자는 모음 소리만큼', d: 36, caps: [
      [0.4, 6, '정리해요. ① 듣고 가르기 → 박자는 모음 소리만큼. 자음은 박자를 만들지 않아요.'],
      [6, 12, '② 만들기 → 끝 자음은 닫고 멈추고, 자음 묶음은 으 없이 바로 이어요.'],
      [12, 18, '③ 낱말 · 문장 속에서 → 외래어의 으를 빼고, 과거형과 복수형은 t · d, s · ch 같은 소리 뒤에서만 한 박자 더.'],
      [18, 24, '끝이 목을 울리는 소리면 모음을 길게, 울리지 않으면 짧게. 다음 낱말이 모음으로 시작하면 이어 붙여요.'],
      [24, 30, '목표는 원어민과 똑같은 소리가 아니라, 듣는 사람이 낱말을 쉽게 알아듣는 소리예요.'],
      [30, 36, '아래 **박자 세기**와 **내 발음 확인**에서 직접 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  FCS.CHAPTERS = CHAPTERS; FCS.CAPTIONS = CAPTIONS; FCS.END = END;
  FCS.POSTER = CHAPTERS.find(c => c.id === 'listen').t + 21;
  FCS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  FCS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 900, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 900, 800, 24, FD), weight: 800, fam: FD });
  }
  const gloss = k => (FC.entry(k) || {}).gloss || '';
  // 오른쪽 위 범례
  function legend(g, a = 1, items) {
    fade(g, a, () => {
      let x = 1200;
      (items || [['모음 없는 자음', COL.bare], ['넣은 으', COL.ins]]).forEach(([s, c]) => { const r = tag(g, s, x, 92, c, { align: 'right', size: 15, h: 30, dash: c === COL.ins }); x = r.x - 10; });
    });
  }

  // 01장 낱말 · 03장 끝 자음 · 04장 묶음 · 05장 짝 · 06장 끝소리 · 08장 문장
  FCS.LISTEN_WORDS = ['milk', 'test', 'strike'];
  FCS.STOP_KEYS = [['k', 'desk', '혀 뒤 → 여린입천장'], ['p', 'stop', '두 입술'], ['t', 'cat', '혀끝 → 윗잇몸']];
  // 03장: 끝 자음 자세 앞의 모음
  const VPRE = { k: 'ae', p: 'a', t: 'ae' };
  FCS.CLUSTERS = ['strike', 'desk', 'milk', 'test'];
  // 04장 입 그림 차례: [자세, 초, 이름, 목 울림]
  const CLUS_SEQ = {
    en: [['s', 0.32, 's'], ['t', 0.22, 't'], ['r', 0.26, 'r', 1], ['a', 0.2, 'a', 1], ['i', 0.2, 'ɪ', 1], ['k', 0.5, 'k'], ['rest', 0.5, '']],
    ko: [['s', 0.3, 'ㅅ'], ['eu', 0.24, 'ㅡ', 1], ['t', 0.22, 'ㅌ'], ['eu', 0.24, 'ㅡ', 1], ['flap', 0.12, 'ㄹ', 1], ['a', 0.28, 'ㅏ', 1], ['i', 0.26, 'ㅣ', 1], ['k', 0.22, 'ㅋ'], ['eu', 0.3, 'ㅡ', 1], ['rest', 0.5, '']],
  };
  FCS.CLUS_SEQ = CLUS_SEQ;
  FCS.VSHOW = ['bag-back', 'prize-price', 'eyes-ice', 'leave-leaf'];
  FCS.ENDCOLS = [
    { snd: 't', why: 'voiceless', words: ['worked', 'asked', 'stopped'], s: ['books', 'cats'] },
    { snd: 'd', why: 'voiced', words: ['played', 'loved'], s: ['dogs'] },
    { snd: 'ɪd', why: 'td', words: ['wanted', 'needed'], s: ['buses', 'watches'] },
  ];
  const SROWS = [
    { en: 'Let me check it again.', at: 6 },
    { en: 'I left my bag on the bus.', at: 12 },
    { en: 'We had a test in English.', at: 18 },
    { en: 'Merry Christmas!', at: 30 },
  ];
  FCS.SROWS = SROWS;
  const endColor = snd => snd === 'ɪd' || snd === 'ɪz' ? COL.extra : (snd === 't' || snd === 's') ? COL.voiceless : COL.voiced;
  FCS.endColor = endColor;

  const SCENES = {
    /* 00 들어가며 */
    intro(g, u) {
      const A = 1 - ramp(u, 23.6, 0.5);
      fade(g, A * ramp(u, 0.4, 0.6), () => {
        panel(g, 100, 150, 500, 330, { fill: COL.panel, stroke: COL.faint });
        txt(g, '한국어식', 130, 180, { size: 15, weight: 700, color: COL.muted });
        koWord(g, 'desk', 350, 238, 56, { align: 'center', ins: u >= 12 });
        balls(g, 'desk', 350, 360, { ko: true, R: 36, labels: true });
        txt(g, u >= 12 ? '세 박자 · 넣은 으 둘' : '세 박자', 350, 452, { size: 18, weight: 700, color: COL.trap, align: 'center' });
      });
      fade(g, A * ramp(u, 6, 0.6), () => {
        panel(g, 680, 150, 500, 330, { fill: COL.panel, stroke: COL.faint });
        txt(g, '영어', 710, 180, { size: 15, weight: 700, color: COL.muted });
        word(g, 'desk', 930, 238, 56, { align: 'center' });
        txt(g, FC.ipa('desk'), 930, 290, { size: 18, fam: FM, color: COL.muted, align: 'center' });
        balls(g, 'desk', 930, 360, { R: 36, labels: false });
        txt(g, '한 박자 · 모음 하나', 930, 452, { size: 18, weight: 700, color: COL.beat, align: 'center' });
      });
      fade(g, A * win(u, 18, 23.8), () => {
        panel(g, 300, 500, 680, 66, { fill: COL.panel2, stroke: COL.ins, dash: true });
        word(g, 'sport', 420, 533, 28, { align: 'center' });
        txt(g, '+ 으 →', 560, 533, { size: 20, weight: 700, color: COL.ins, align: 'center' });
        word(g, 'support', 700, 533, 28, { align: 'center', paint: false });
        txt(g, '= 다른 낱말로 들려요', 900, 533, { size: 17, weight: 600, color: COL.soft, align: 'center' });
      });
      const steps = [['ear', '① 듣고 가르기', '박자 = 모음 소리 수'], ['mouth', '② 입 모양 만들기', '끝 자음에서 멈추기 · 묶음 잇기'], ['text', '③ 낱말 · 문장 속에서', '-ed · -s · 외래어 · 이어 말하기']];
      steps.forEach(([ic, h, s], i) => fade(g, ramp(u, 24.2 + i * 0.6, 0.5), () => {
        const x = 110 + i * 360;
        panel(g, x, 200, 340, 190, { fill: COL.panel, stroke: COL.faint });
        circ(g, x + 170, 252, 30, COL.panel2); icon(g, ic, x + 170, 252, 32, COL.accent);
        txt(g, h, x + 170, 314, { size: 22, weight: 800, color: COL.text, align: 'center' });
        txt(g, s, x + 170, 352, { size: 16, weight: 500, color: COL.soft, align: 'center' });
      }));
      fade(g, ramp(u, 30, 0.5), () => {
        chip(g, '미국 표준 발음(General American) · 합성 음성', 640, 460, { size: 16, weight: 600, color: COL.muted, fill: COL.panel2, align: 'center' });
      });
    },

    /* 01 들어 보기 */
    listen(g, u) {
      legend(g, ramp(u, 0.4, 0.5), [['영어 박자', COL.beat], ['넣은 으', COL.ins], ['한국어식', COL.trap]]);
      fade(g, win(u, 0.4, 6.2), () => {
        icon(g, 'tap', 470, 300, 80, COL.accent);
        circ(g, 810, 300, 44, hex(COL.beat, 0.78)); ring(g, 810, 300, 44, COL.beat, 2);
        txt(g, '손뼉 한 번', 470, 400, { size: 22, weight: 800, color: COL.accent, align: 'center' });
        txt(g, '모음 소리 하나', 810, 400, { size: 22, weight: 800, color: COL.beat, align: 'center' });
        txt(g, '=', 640, 300, { size: 44, weight: 700, color: COL.muted, align: 'center' });
      });
      const WORDS = S.lword ? [S.lword] : FCS.LISTEN_WORDS;
      WORDS.forEach((k, i) => fade(g, S.lword ? 1 : ramp(u, 6 + i * 0.4, 0.5), () => {
        const x = S.lword ? 290 : 110 + i * 360, w = S.lword ? 700 : 340;
        panel(g, x, 146, w, 400, { fill: COL.panel, stroke: COL.faint });
        word(g, k, x + w / 2, 186, 40, { align: 'center', sp: S.voice || 'tc' });
        txt(g, `${FC.ipa(k)} · ${gloss(k)}`, x + w / 2, 224, { size: 15, fam: FM, color: COL.muted, align: 'center' });
        blob(g, k, x + 26, 330, w - 52, 84, u, { at: S.lword ? 0 : 6.4 + i * 0.4, sp: S.voice || 'tc' });
        if (S.lword || u >= 18) fade(g, S.lword ? 1 : ramp(u, 18 + i * 0.4, 0.5), () => {
          koWord(g, k, x + w / 2, 392, 30, { align: 'center' });
          blob(g, k, x + 26, 510, w - 52, 84, u, { at: S.lword ? 0 : 18.3 + i * 0.4, ko: true });
        });
      }));
      fade(g, win(u, 25, 32.2) * (S.lword ? 0 : 1), () => chip(g, 'strike = s · t · r + 모음 하나 + k → 한 박자', 640, 566, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 32 }));
      fade(g, ramp(u, 32.4, 0.5) * (S.lword ? 0 : 1), () => {
        FC.VOICES.forEach((v, i) => {
          const x = 250 + i * 260, hl = S.voice === v.sp;
          const c = chip(g, v.ko, x, 566, { size: 15, fill: COL.panel2, stroke: hl ? COL.accent : COL.line, align: 'center', pad: 30, h: 30 });
          icon(g, 'spk', c.x + 16, 566, 16, COL.accent);
          listen(c.x, c.y, c.w, c.h, [{ text: 'desk', sp: v.sp }, { text: 'strike', sp: v.sp, gap: 0.7 }]);
        });
      });
    },

    /* 02 한국어 음절의 모양 */
    korean(g, u) {
      // 왼쪽: 한국어 음절 상자 (첫소리 · 모음 · 받침)
      fade(g, ramp(u, 0.4, 0.5), () => {
        panel(g, 80, 150, 420, 330, { fill: COL.panel, stroke: COL.faint });
        txt(g, '한국어 음절 하나', 290, 180, { size: 16, weight: 700, color: COL.muted, align: 'center' });
        const bx = 170, by = 210, s = 120;
        [['첫소리', bx, by, s, s * 0.55, COL.soft], ['모음', bx + s + 6, by, s * 0.7, s * 1.1 + 6, COL.trap], ['받침', bx, by + s * 0.55 + 6, s, s * 0.55, COL.soft]].forEach(([lab, x, y, w, h, c]) => {
          rr(g, x, y, w, h, 8); g.fillStyle = hex(c, 0.12); g.fill(); g.strokeStyle = c; g.lineWidth = 1.8; g.stroke();
          txt(g, lab, x + w / 2, y + h / 2, { size: 17, weight: 700, color: c, align: 'center' });
        });
        txt(g, '하나 · 하나 · 하나까지', 290, 400, { size: 17, weight: 700, color: COL.soft, align: 'center' });
        fade(g, ramp(u, 6, 0.5), () => {
          txt(g, '받침 → 일곱 소리 · 닫은 채 끝', 290, 434, { size: 16, weight: 700, color: COL.trap, align: 'center' });
          txt(g, '국 · 밥 · 낫', 290, 462, { size: 18, weight: 700, color: COL.soft, align: 'center' });
        });
      });
      // 오른쪽: strike의 소리 → 한국어식 음절
      fade(g, ramp(u, 12, 0.5), () => {
        panel(g, 540, 150, 660, 330, { fill: COL.panel, stroke: COL.faint });
        word(g, 'strike', 870, 190, 34, { align: 'center' });
        const ph = FC.entry('strike').ph, X0 = 640, step = 112;
        ph.forEach((p, i) => {
          const v = FC.isV(p), x = X0 + i * step;
          rr(g, x - 40, 228, 80, 54, 10); g.fillStyle = hex(v ? COL.beat : COL.bare, 0.16); g.fill(); g.strokeStyle = v ? COL.beat : COL.bare; g.lineWidth = 2; g.stroke();
          txt(g, p, x, 255, { size: 24, fam: FM, weight: 700, color: v ? COL.beat : COL.bare, align: 'center' });
        });
        txt(g, '자음 셋 + 모음 하나 + 자음 하나 = 한 박자', 870, 306, { size: 16, weight: 700, color: COL.beat, align: 'center' });
        // 한국어식: 스 · 트 · 라 · 이 · 크 — 자음마다 으
        const parts = FC.koParts('strike'), KX = [640, 752, 864, 920, 1088];
        fade(g, ramp(u, 18, 0.5), () => {
          parts.forEach((pp, i) => {
            const x = i === 3 ? 940 : KX[i], ins = pp.role === 'ins';
            rr(g, x - 34, 360, 68, 58, 10);
            if (ins) { g.fillStyle = hex(COL.ins, 0.12); g.fill(); g.strokeStyle = COL.ins; g.lineWidth = 2; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]); }
            else { g.fillStyle = hex(COL.trap, 0.16); g.fill(); g.strokeStyle = COL.trap; g.lineWidth = 2; g.stroke(); }
            txt(g, pp.ch, x, 389, { size: 28, weight: 800, color: ins ? COL.ins : COL.trap, align: 'center' });
          });
          [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]].forEach(([a, b]) => {
            const xa = X0 + a * step, xb = b === 3 ? 940 : KX[b];
            g.strokeStyle = COL.line; g.lineWidth = 1.5; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(xa, 284); g.lineTo(xb, 358); g.stroke(); g.setLineDash([]);
          });
          txt(g, '한국어식 = 다섯 박자 · 넣은 으 셋', 870, 446, { size: 16, weight: 700, color: COL.trap, align: 'center' });
        });
      });
      fade(g, win(u, 24, 31.2), () => {
        chip(g, '연구 → 한국인 학습자의 모음 넣기는 꾸준히 다뤄 온 주제예요', 640, 530, { size: 17, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '근거와 한계 → 페이지 아래 각주', 640, 566, { size: 14, color: COL.muted, align: 'center' });
      });
      fade(g, ramp(u, 31, 0.5), () => {
        tag(g, '박자 = 모음 소리만큼', 360, 536, COL.beat, { align: 'center', size: 18, h: 42 });
        tag(g, '자음은 모음 없이 · 끝에서 멈춤', 900, 536, COL.bare, { align: 'center', size: 18, h: 42 });
      });
    },

    /* 03 끝 자음에서 멈추기 */
    stop(g, u, t, idle = 0) {
      const key = S.stopk || (u < 18 ? 'k' : null);
      const L = u + idle, loop = (L * 0.8) % 2.4;   // idle: 멈춰 있을 때도 입 그림이 움직이게(플레이어만, 추출은 0)
      if (key) {
        // 왼쪽: 영어 — 모음에서 끝 자음으로 닫고 멈춤 (목 울림은 모음에서만)
        const def = FCS.STOP_KEYS.find(s => s[0] === key);
        fade(g, ramp(u, 0.3, 0.5), () => {
          const k = clamp(loop / 0.7), P = M.mix(VPRE[key], key, k), voiced = k < 0.6;
          mouth(g, 70, 150, 0.82, P, { mark: COL.bare, labels: key === 'p' ? ['lips', 'voice'] : key === 'k' ? ['velum', 'back', 'voice'] : ['ridge', 'tip', 'voice'], voice: voiced ? L : null });
          word(g, def[1], 234, 470, 30, { align: 'center' });
          txt(g, `${def[2]} · 닫고 멈춤`, 234, 510, { size: 17, weight: 700, color: COL.bare, align: 'center' });
          txt(g, '목 울림 없음', 234, 538, { size: 15, weight: 700, color: COL.muted, align: 'center' });
        });
        // 오른쪽: 한국어식 — 혀를 떼며 목을 울려 ‘으’
        if (key === 'k' && !S.stopk) fade(g, ramp(u, 12, 0.5), () => {
          const ph = loop, k1 = clamp(ph / 0.6), k2 = clamp((ph - 0.9) / 0.4);
          const P = ph < 0.9 ? M.mix('ae', 'k', k1) : M.mix('k', 'eu', k2), voiced = ph < 0.4 || ph > 1.0;
          mouth(g, 660, 150, 0.82, P, { mark: COL.ins, labels: ['back', 'voice'], voice: voiced ? L : null });
          koWord(g, 'desk', 824, 470, 30, { align: 'center' });
          txt(g, '혀를 떼며 목을 울림 → 으', 824, 510, { size: 17, weight: 700, color: COL.ins, align: 'center' });
          txt(g, '박자 하나 더', 824, 538, { size: 15, weight: 700, color: COL.muted, align: 'center' });
        });
        if (S.stopk) fade(g, 1, () => {
          panel(g, 620, 170, 560, 300, { fill: COL.panel, stroke: COL.faint });
          const ws = FC.byGrp('base').concat(FC.byGrp('loan')).filter(w => FC.final(w) === key || (key === 'p' && FC.final(w) === 'b') || (key === 't' && FC.final(w) === 'd') || (key === 'k' && FC.final(w) === 'g')).slice(0, 6);
          ws.forEach((w, i) => word(g, w, 700 + (i % 2) * 260, 230 + Math.floor(i / 2) * 70, 30));
          txt(g, '끝에서 같은 자리를 막아요', 900, 440, { size: 16, weight: 700, color: COL.soft, align: 'center' });
        });
      } else {
        // 18초 뒤: p · t 두 입
        [['p', 120], ['t', 700]].forEach(([kk, x], i) => fade(g, ramp(u, 18 + i * 0.4, 0.5), () => {
          const def = FCS.STOP_KEYS.find(s => s[0] === kk), k = clamp(loop / 0.7), P = M.mix(VPRE[kk], kk, k);
          mouth(g, x - 50, 150, 0.82, P, { mark: COL.bare, labels: kk === 'p' ? ['lips', 'voice'] : ['ridge', 'tip', 'voice'], voice: k < 0.6 ? L : null });
          word(g, def[1], x + 114, 470, 30, { align: 'center' });
          txt(g, `${def[2]} · 닫고 멈춤`, x + 114, 510, { size: 17, weight: 700, color: COL.bare, align: 'center' });
        }));
      }
      fade(g, win(u, 24, 30.2) * (S.stopk ? 0 : 1), () => chip(g, '미국 영어도 끝 자음을 닫은 채 끝낼 때가 많아요', 640, 560, { size: 17, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 36 }));
      fade(g, win(u, 30, 36.2) * (S.stopk ? 0 : 1), () => chip(g, '요령 → 끝 자음의 입 모양을 잠깐 그대로 · 목에 손을 대고 확인', 640, 560, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
      fade(g, ramp(u, 36, 0.5) * (S.stopk ? 0 : 1), () => chip(g, '터뜨리면 숨만 · 목소리를 실으면 으', 640, 560, { size: 17, color: COL.ins, fill: COL.panel2, stroke: COL.ins, align: 'center', h: 36, dash: true }));
    },

    /* 04 자음 묶음 */
    cluster(g, u, t, idle = 0) {
      const k = S.clus;
      if (k && k !== 'strike') {
        // 고른 낱말: 영어 박자 공과 한국어식
        panel(g, 160, 160, 960, 380, { fill: COL.panel, stroke: COL.faint });
        word(g, k, 640, 220, 56, { align: 'center' });
        txt(g, `${FC.ipa(k)} · ${gloss(k)}`, 640, 272, { size: 17, fam: FM, color: COL.muted, align: 'center' });
        balls(g, k, 420, 380, { R: 40 });
        txt(g, `영어 ${FC.nSyl(k)}박자`, 420, 470, { size: 18, weight: 800, color: COL.beat, align: 'center' });
        if (FC.entry(k).ko) { balls(g, k, 860, 380, { R: 40, ko: true }); txt(g, `한국어식 ${FC.koSyl(k)}박자`, 860, 470, { size: 18, weight: 800, color: COL.trap, align: 'center' }); }
        return;
      }
      const big = 1 - (k ? 0 : ramp(u, 23.6, 0.5));
      // 두 입: 영어(s → t → r → aɪ → k) · 한국어식(스 · 트 · 라 · 이 · 크)
      fade(g, ramp(u, 0.3, 0.5) * big, () => {
        const L = u + idle, pe = poseAt(CLUS_SEQ.en, L * 0.7), pk = poseAt(CLUS_SEQ.ko, L * 0.7);
        mouth(g, 70, 150, 0.7, pe.pose, { mark: COL.bare, voice: pe.voiced ? L : null, gap: false });
        word(g, 'strike', 210, 430, 30, { align: 'center' });
        CLUS_SEQ.en.slice(0, 6).forEach((s, i) => {
          const x = 100 + i * 46, on = pe.i === i;
          txt(g, s[2], x, 474, { size: on ? 24 : 18, fam: FM, weight: 800, color: on ? (s[3] ? COL.beat : COL.bare) : COL.dim, align: 'center' });
        });
        fade(g, ramp(u, 18, 0.5) * big, () => {
          mouth(g, 670, 150, 0.7, pk.pose, { mark: COL.ins, voice: pk.voiced ? L : null, gap: false });
          koWord(g, 'strike', 810, 430, 30, { align: 'center' });
          CLUS_SEQ.ko.slice(0, 9).forEach((s, i) => {
            const x = 680 + i * 34, on = pk.i === i;
            txt(g, s[2], x, 474, { size: on ? 24 : 18, weight: 800, color: on ? (s[2] === 'ㅡ' ? COL.ins : COL.trap) : COL.dim, align: 'center' });
          });
        });
        fade(g, win(u, 6, 18.2), () => txt(g, '혀끝이 윗잇몸 근처에서 그대로 옮겨 가요', 640, 530, { size: 18, weight: 700, color: COL.bare, align: 'center' }));
        fade(g, ramp(u, 18, 0.5) * big, () => txt(g, '자음마다 혀를 내리고 목을 울려 → 으', 640, 530, { size: 18, weight: 700, color: COL.ins, align: 'center' }));
      });
      if (k) return;
      // 24초: 끝 묶음 · 30초: 으를 넣으면 다른 낱말
      fade(g, win(u, 24, 30.2, 0.5), () => {
        ['desk', 'milk', 'test'].forEach((w, i) => {
          const x = 250 + i * 390;
          panel(g, x - 170, 170, 340, 330, { fill: COL.panel, stroke: COL.faint });
          word(g, w, x, 230, 48, { align: 'center' });
          txt(g, FC.ipa(w), x, 280, { size: 17, fam: FM, color: COL.muted, align: 'center' });
          balls(g, w, x - 70, 380, { R: 30, labels: false });
          balls(g, w, x + 70, 380, { R: 30, ko: true, labels: false });
          txt(g, '영어', x - 70, 444, { size: 15, weight: 700, color: COL.beat, align: 'center' });
          koWord(g, w, x + 70, 444, 18, { align: 'center', hit: false });
        });
      });
      fade(g, ramp(u, 30, 0.5), () => {
        FC.EPAIRS.slice(0, 2).forEach((p, i) => {
          const y = 210 + i * 170;
          panel(g, 120, y - 50, 1040, 140, { fill: COL.panel, stroke: COL.faint });
          word(g, p.a, 300, y - 6, 40, { align: 'center' });
          balls(g, p.a, 300, y + 52, { R: 18, labels: false });
          txt(g, '+ 으 →', 640, y - 6, { size: 22, weight: 800, color: COL.ins, align: 'center' });
          word(g, p.b, 980, y - 6, 40, { align: 'center', paint: false });
          balls(g, p.b, 980, y + 52, { R: 18, labels: false });
          txt(g, `${gloss(p.a)} · ${gloss(p.b)}`, 640, y + 40, { size: 15, color: COL.muted, align: 'center' });
        });
      });
      fade(g, ramp(u, 36, 0.5), () => chip(g, '요령 → 천천히 붙여서, 점점 빠르게', 640, 556, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
    },

    /* 05 끝 유성 · 무성 — 모음 길이 */
    voice(g, u) {
      legend(g, ramp(u, 0.4, 0.5), [['목이 울리는 끝 → 긴 모음', COL.voiced], ['울리지 않는 끝 → 짧은 모음', COL.voiceless]]);
      const ids = S.vpair ? [S.vpair] : FCS.VSHOW;
      ids.forEach((id, i) => {
        const p = FC.VPAIRS.find(x => x.id === id), at = S.vpair ? 0 : (i < 2 ? 0.4 + i * 0.5 : 24 + (i - 2) * 0.5);
        const y = S.vpair ? 260 : 178 + i * 96;
        fade(g, S.vpair ? 1 : ramp(u, at, 0.5), () => {
          panel(g, 80, y - 40, 1120, 84, { fill: COL.panel, stroke: COL.faint, r: 12 });
          [[p.a, COL.voiced, 0], [p.b, COL.voiceless, 1]].forEach(([w, c, j]) => {
            const x = 110 + j * 560;
            word(g, w, x, y, 30, { final: c });
            txt(g, FC.ipa(w), x + 120, y, { size: 15, fam: FM, color: COL.muted });
            fade(g, S.vpair ? 1 : ramp(u, 18, 0.4), () => vbar(g, w, x + 230, y, 290, c, u, { at: S.vpair ? 0 : 18 + i * 0.2 }));
          });
        });
      });
      fade(g, win(u, 6, 12.2) * (S.vpair ? 0 : 1), () => {
        panel(g, 360, 380, 560, 120, { fill: COL.panel2, stroke: COL.trap });
        txt(g, '한국어식', 640, 404, { size: 15, weight: 700, color: COL.trap, align: 'center' });
        txt(g, '백 · 백', 640, 452, { size: 40, weight: 800, color: COL.trap, align: 'center' });
        txt(g, '받침 ㄱ 하나로 닫혀요', 640, 488, { size: 15, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 12, 18.2) * (S.vpair ? 0 : 1), () => chip(g, '들을 곳 → 끝 자음보다 그 앞의 모음 길이', 640, 450, { size: 18, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 40 }));
      fade(g, win(u, 30, 37.2) * (S.vpair ? 0 : 1), () => {
        txt(g, '배', 560, 556, { size: 30, weight: 800, color: COL.trap, align: 'center' });
        rr(g, 588, 534, 44, 44, 8); g.strokeStyle = COL.ins; g.lineWidth = 2; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]);
        txt(g, '그', 610, 556, { size: 30, weight: 800, color: COL.ins, align: 'center' });
        txt(g, '→ 박자가 늘어요 · 으 없이 길이로', 660, 556, { size: 18, weight: 700, color: COL.soft });
      });
      fade(g, ramp(u, 37, 0.5) * (S.vpair ? 0 : 1), () => chip(g, '울리는 쪽 → 길게 끌다 울린 채 닫기 · 울리지 않는 쪽 → 짧게 끊고 닫기', 640, 560, { size: 16, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
    },

    /* 06 과거형 · 복수형의 끝소리 */
    ending(g, u) {
      const cols = FCS.ENDCOLS, fixed = S.ending;
      cols.forEach((c, i) => fade(g, ramp(u, i === 2 ? 6 : i === 0 ? 12 : 18, 0.5) * (fixed && fixed !== c.snd ? 0.35 : 1), () => {
        const x = 80 + i * 380, col = endColor(c.snd);
        panel(g, x, 150, 360, 290, { fill: COL.panel, stroke: fixed === c.snd ? COL.accent : COL.faint });
        tag(g, `-ed → [${c.snd}]`, x + 180, 184, col, { align: 'center', size: 20, h: 40, fam: FM });
        txt(g, FC.END_WHY[c.why], x + 180, 226, { size: fit(g, FC.END_WHY[c.why], 14, 330, 600), weight: 600, color: COL.soft, align: 'center' });
        c.words.forEach((w, j) => {
          const y = 276 + j * 52, x2 = FC.inflOf(w).base;
          word(g, x2, x + 30, y, 22, { paint: false });
          txt(g, '→', x + 120, y, { size: 18, color: COL.muted, align: 'center' });
          word(g, w, x + 150, y, 24, { final: col });
          balls(g, w, x + 310, y, { R: 11, labels: false });
        });
      }));
      fade(g, ramp(u, 0.4, 0.5), () => txt(g, '앞 소리가 정해요', 1200, 92, { size: 16, weight: 700, color: COL.muted, align: 'right' }));
      fade(g, win(u, 24, 30.2) * (fixed ? 0 : 1), () => {
        panel(g, 230, 456, 820, 100, { fill: COL.panel2, stroke: COL.ins, dash: true });
        koWord(g, 'asked', 400, 506, 36, { align: 'center' });
        txt(g, `${FC.koSyl('asked')}박자`, 520, 506, { size: 18, weight: 800, color: COL.trap });
        txt(g, '→', 640, 506, { size: 26, color: COL.muted, align: 'center' });
        word(g, 'asked', 760, 506, 36, { final: COL.voiceless });
        txt(g, '한 박자', 900, 506, { size: 18, weight: 800, color: COL.beat });
      });
      fade(g, fixed ? 1 : ramp(u, 30, 0.5), () => {
        panel(g, 80, 456, 1120, 100, { fill: COL.panel2, stroke: COL.faint });
        txt(g, '-s', 110, 506, { size: 22, weight: 800, fam: FM, color: COL.text });
        cols.forEach((c, i) => {
          const snd = { t: 's', d: 'z', 'ɪd': 'ɪz' }[c.snd], x = 180 + i * 340, col = endColor(snd);
          tag(g, `[${snd}]`, x, 506, col, { size: 17, h: 34, fam: FM });
          c.s.forEach((w, j) => word(g, w, x + 70 + j * 120, 506, 22, { final: col }));
          if (fixed === c.snd) { g.fillStyle = COL.accent; g.fillRect(x - 6, 530, 300, 3); }
        });
      });
    },

    /* 07 외래어 함정 */
    loan(g, u) {
      const LAPPEAR = { end1: 6, endcl: 12, oncl: 18, both: 24 };
      FC.LROWS.forEach((row, ri) => {
        fade(g, ramp(u, LAPPEAR[row.id] - 0.2, 0.4), () => txt(g, row.ko, 80, 150 + ri * 104, { size: 14, weight: 700, color: COL.accent }));
        row.words.forEach((k, ci) => {
          const x = 80 + ci * 285, y = 160 + ri * 104, at = LAPPEAR[row.id] + ci * 0.3, hl = S.loan === k || (!S.loan && k === 'Christmas' && u >= 24.6 && u < 31.2);
          fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, at, 0.4)), () => panel(g, x, y, 265, 88, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }));
          fade(g, S.loan ? 1 : ramp(u, at, 0.5), () => {
            panel(g, x, y, 265, 88, { fill: COL.panel, stroke: hl ? COL.accent : COL.faint, lw: hl ? 2.5 : 1.5 });
            koWord(g, k, x + 16, y + 28, fit(g, FC.entry(k).ko, 22, 110, 700), { ins: S.loan === k || u >= 31 || hl });
            word(g, k, x + 249, y + 28, fit(g, k, 24, 140, 700), { align: 'right' });
            txt(g, `${FC.koSyl(k)} → ${FC.nSyl(k)}박자`, x + 16, y + 66, { size: 14, weight: 700, color: COL.trap });
            balls(g, k, x + 200, y + 64, { R: 9, labels: false });
          });
        });
      });
      fade(g, ramp(u, 37, 0.5) * (S.loan ? 0 : 1), () => chip(g, '한국어 표기는 잠시 잊고 · 모음 소리만 세어 박자를 정해요', 640, 588 - 20, { size: 15, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 30 }));
    },

    /* 08 문장 속에서 · 이어 말하기 */
    sentence(g, u) {
      legend(g, ramp(u, 0.4, 0.5), [['모음 없는 자음', COL.bare], ['이어 말하기 ‿', COL.good]]);
      if (S.sent != null) {
        const s = FC.SENT[S.sent];
        tag(g, FC.SGRP[s.grp].ko, 640, 220, COL.muted, { align: 'center', size: 16, h: 32 });
        sentence(g, s.en, 640, 310, 46, { align: 'center', maxW: 1100 });
        txt(g, s.ko, 640, 390, { size: 20, weight: 600, color: COL.soft, align: 'center' });
        const ws = FC.wordsIn(s.en);
        ws.forEach((k, i) => { const x = 640 + (i - (ws.length - 1) / 2) * 260; word(g, k, x, 460, 26, { align: 'center' }); balls(g, k, x, 510, { R: 12, labels: false }); });
        return;
      }
      SROWS.forEach((s, i) => fade(g, ramp(u, s.at, 0.5), () => {
        const y = 182 + i * 92;
        sentence(g, s.en, 120, y, 36, { maxW: 760 });
        const L = FC.links(s.en);
        if (L.length) txt(g, L.map(k => `${k} ‿`).join(' · '), 1200, y, { size: 17, weight: 700, color: COL.good, align: 'right' });
        else txt(g, '끝 → 바람만', 1200, y, { size: 17, weight: 700, color: COL.bare, align: 'right' });
      }));
      fade(g, win(u, 24, 30.2), () => {
        panel(g, 260, 470, 760, 76, { fill: COL.panel2, stroke: COL.faint });
        word(g, 'desk', 460, 508, 30, { align: 'center' });
        txt(g, 'lamp', 560, 508, { size: 30, weight: 700, color: COL.text, align: 'center' });
        txt(g, '→ k 소리는 닫은 채로 두고 바로 l', 800, 508, { size: 18, weight: 700, color: COL.soft, align: 'center' });
      });
    },

    /* 09 정리 */
    summary(g, u) {
      const X = [80, 360, 790], Y0 = 145;
      fade(g, ramp(u, 0.3, 0.5), () => {
        panel(g, 60, Y0, 1160, 330, { fill: COL.panel, stroke: COL.faint });
        circ(g, X[1] + 22, Y0 + 46, 18, hex(COL.beat, 0.78));
        circ(g, X[2] + 18, Y0 + 50, 14, hex(COL.ins, 0.16)); ring(g, X[2] + 18, Y0 + 50, 14, COL.ins, 2, [5, 4]);
        txt(g, '영어 = 모음 소리만큼', X[1] + 52, Y0 + 46, { size: 22, weight: 800, color: COL.beat });
        txt(g, '한국어식 = 넣은 으', X[2] + 44, Y0 + 50, { size: 22, weight: 800, color: COL.ins });
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + 98, 1120, 1);
      });
      const rows = [
        ['① 듣고 가르기', '박자 = 모음 소리 수 · desk 한 박자', '데스크 세 박자 · 스트라이크 다섯 박자', 0.4],
        ['② 만들기', '끝 자음은 닫고 멈춤 · 묶음은 바로 이어', '터뜨리며 목을 울리면 → 으', 6],
        ['③ 낱말 속에서', '-ed · -s → t · d, s · ch 뒤만 한 박자 더', '애스크드 · 크리스마스(다섯 박자)', 12],
      ];
      rows.forEach(([h, a, b, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = Y0 + 140 + i * 66;
        txt(g, h, X[0] + 16, y, { size: 19, weight: 800, color: COL.text });
        txt(g, a, X[1] + 4, y, { size: fit(g, a, 18, 410, 600), weight: 600, color: COL.beat });
        txt(g, b, X[2] + 4, y, { size: fit(g, b, 18, 410, 600), weight: 600, color: COL.ins });
      }));
      fade(g, ramp(u, 18, 0.5), () => {
        [['bag', 'back', 'v'], ['check', 'it', 'l'], ['sport', 'support', 'e']].forEach(([a, b, kind], i) => {
          const x = 240 + i * 400;
          if (kind === 'v') { word(g, a, x - 12, 515, 22, { align: 'right', final: COL.voiced }); txt(g, '·', x, 515, { size: 20, color: COL.muted, align: 'center' }); word(g, b, x + 12, 515, 22, { final: COL.voiceless }); }
          else if (kind === 'l') { sentence(g, 'check it', x, 515, 22, { align: 'center', links: true }); }
          else { word(g, a, x - 12, 515, 22, { align: 'right' }); txt(g, '≠', x, 515, { size: 20, color: COL.muted, align: 'center' }); word(g, b, x + 12, 515, 22, { paint: false }); }
        });
      });
      fade(g, ramp(u, 24, 0.5), () => txt(g, '목표 = 듣는 사람이 낱말을 쉽게 알아듣는 소리', 640, 565, { size: 17, weight: 700, color: COL.soft, align: 'center' }));
    },
  };
  FCS.SCENES = SCENES;

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
  }

  FCS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[FCS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t, opt.idle || 0);
    g.restore();
    if (opt.caption) drawCaption(g, FCS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + FC.allText() + MLAB.join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔⇢≈≠✓×?!~=+-–—/:…‘’\'%&<>|‿ɹɝɚəæɑɔɪʊʌɛŋθðʃʒˈˌmsㅅㅡㅌㄹㅏㅣㅋ';
  FCS.baseText = EXTRA;
  FCS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = FCS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { FCS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
