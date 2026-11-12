/* 센 음절은 하나 — 낱말 강세와 슈와: 영상 장면과 자막 (WSS)
 * 그림은 시간 t와 사용자 상태(S)만의 함수예요. 음절 · 센 음절 · 슈와는 규칙 엔진(WS)이 계산하고,
 * 음절 공의 크기 · 높이와 높낮이 선은 미리 만든 음성 파일을 따로 잰 값(WSV.meas)으로 그려요(잰 값이 없으면 엔진의 기본 모양).
 * 입 그림은 공통 부품 EN.mouth(../shared/mouth.js).
 * 역할 색: 센 음절 보라 · 약한 모음(슈와) 민트 · 한국어식으로 고르게 읽기(함정) 주황 · 짝의 앞이 센 쪽 노랑 · 뒤가 센 쪽 하늘
 */
(function () {
  'use strict';
  const WS = window.WS, M = window.EN.mouth, V = window.WSV;
  const WSS = (window.WSS = {});
  const W = 1280, H = 720;
  WSS.W = W; WSS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  WSS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    a: '#FFC15E', b: '#6EC8FF', ins: '#FF7AA8', weak: '#7FE0A8', str: '#C9A7FF', trap: '#FF9F7A', plain: '#7D8A99',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  WSS.COL = COL;
  const ROLE = { str: COL.str, weak: COL.weak };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (WSS.S = { kword: null, sword: null, cue: null, sex: null, pair: null, loan: null, fam: null, sent: null, voice: null });
  WSS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  WSS.hits = () => HITS;

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
  WSS.check = check; WSS.cross = cross;
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
  WSS.hex = hex;
  const say = (k, sp = 'tc') => [{ text: WS.sayText(k), sp }];

  /* ---------- 아이콘 — 24×24 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요 ---------- */
  const ICON = {
    spk: [['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'f'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
    ear: [['M7.5 9.5a4.5 4.5 0 1 1 9 0c0 3.1-3 3.7-3 6.6a2.7 2.7 0 0 1-5.1 1.1'], ['M10.5 10a1.6 1.6 0 1 1 3 .9']],
    balls: [['M4 15a2 2 0 1 0 4 0a2 2 0 1 0-4 0'], ['M9 12a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0-7.6 0'], ['M17.5 15a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0']],
    text: [['M4 6.5h16M4 10.5h16M4 14.5h11M4 18.5h7']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z'], ['M6 11a6 6 0 0 0 12 0'], ['M12 17v3.5M9 20.5h6']],
    tap: [['M9 11V5.5a1.5 1.5 0 0 1 3 0V11'], ['M12 10.5V9a1.5 1.5 0 0 1 3 0v2'], ['M15 10.5a1.5 1.5 0 0 1 3 0V15a5.5 5.5 0 0 1-5.5 5.5h-1A5.5 5.5 0 0 1 6 15.5L4.6 12.6a1.4 1.4 0 0 1 2.4-1.4L9 14']],
  };
  WSS.ICON = ICON;
  const P2D = {};
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const k = size / 24;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    (ICON[id] || []).forEach(([d, m]) => { const p = P2D[d] || (P2D[d] = new Path2D(d)); if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  WSS.icon = icon;
  WSS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;
  function waves(g, x, y, color, a = 1, ph = 0) {
    fade(g, a, () => {
      g.strokeStyle = color; g.lineWidth = 2.2; g.lineCap = 'round';
      [7, 13].forEach((r, i) => { g.globalAlpha *= 0.55 + 0.45 * Math.max(0, Math.sin(ph * 5 - i)); g.beginPath(); g.arc(x, y, r, -0.7, 0.7); g.stroke(); });
    });
  }

  /* ---------- 입 그림 (EN.mouth) ---------- */
  const MLAB = ['윗잇몸', '센입천장', '여린입천장', '혀끝', '혀 뒤', '입술', '목(성대)'];
  const mfont = (sz, w) => fnt(sz, w || 600);
  function mouth(g, x, y, s, pose, o = {}) {
    if (REC) MLAB.forEach(m => REC.add(m));
    return M.draw(g, x, y, s, pose, Object.assign({ font: mfont }, o));
  }
  WSS.mouth = mouth;

  /* ---------- 낱말 그리기: 음절마다 칠함 (센 음절 보라 + 밑줄 · 슈와 민트) ----------
     o.caps: 센 음절만 대문자(baNAna) · o.dots: 음절 사이에 · · o.base: 칠하지 않는 음절 색 · o.paint=false: 칠하지 않음 */
  function word(g, k, x, y, size, o = {}) {
    const e = WS.entry(k);
    if (!e) { const ww = txt(g, k, x, y, { size, weight: o.weight || 700, color: o.base || COL.text, align: o.align }); return { x, w: ww, mids: [] }; }
    const wt = o.weight || 700, dot = o.dots ? '·' : '';
    const parts = e.spell.map((s, i) => {
      const sy = e.syl[i], role = o.paint === false ? null : sy.st === 1 ? 'str' : (sy.schwa && o.weak !== false) ? 'weak' : null;
      const t = o.caps ? (sy.st === 1 ? s.toUpperCase() : (i === 0 && /^[A-Z]/.test(e.w) && !o.lowerAll ? s : s.toLowerCase())) : s;
      return { t, role };
    });
    const dw = dot ? tw(g, dot, size, 500) : 0;
    const total = parts.reduce((s, p) => s + tw(g, p.t, size, p.role === 'str' ? 800 : wt), 0) + dw * (parts.length - 1);
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx, mids = [];
    parts.forEach((p, i) => {
      const c = p.role ? ROLE[p.role] : (o.base || COL.text);
      const ww = txt(g, p.t, xx, y, { size, weight: p.role === 'str' ? 800 : wt, color: c });
      if (p.role === 'str') { g.fillStyle = c; g.fillRect(xx, y + size * 0.56, ww, Math.max(2.5, size * 0.07)); }
      mids.push(xx + ww / 2);
      xx += ww;
      if (dot && i < parts.length - 1) { txt(g, dot, xx, y, { size, weight: 500, color: COL.dim }); xx += dw; }
    });
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, total + 16, size * 1.45, say(k, o.sp || 'tc'));
    return { x: x0, w: total, mids };
  }
  WSS.word = word;
  // 한국어 표기 (주황 = 한국어식으로 고르게)
  function koWord(g, k, x, y, size, o = {}) {
    const ko = o.ko || (WS.entry(k) || {}).ko || '';
    const ww = txt(g, ko, x, y, { size, weight: o.weight || 700, color: o.color || COL.trap, align: o.align });
    const x0 = o.align === 'center' ? x - ww / 2 : o.align === 'right' ? x - ww : x;
    if (o.hit !== false && ko) listen(x0 - 8, y - size * 0.7, ww + 16, size * 1.45, [{ text: ko, sp: 'ko' }]);
    return { x: x0, w: ww };
  }
  WSS.koWord = koWord;
  // 문장: 사전에 있는 낱말의 센 음절 · 슈와를 칠함
  function sentence(g, text, x, y, size, o = {}) {
    const segs = WS.segs(text, o.keys), wt = o.weight || 600;
    const wOf = (s, sz) => tw(g, s.t, sz, s.role === 'str' ? 800 : wt);
    let total = segs.reduce((a, s) => a + wOf(s, size), 0);
    const sz = o.maxW && total > o.maxW ? size * o.maxW / total : size;
    if (sz !== size) total = segs.reduce((a, s) => a + wOf(s, sz), 0);
    let xx = o.align === 'center' ? x - total / 2 : x;
    const x0 = xx;
    segs.forEach(s => {
      const c = s.role ? ROLE[s.role] : (o.base || COL.text);
      const ww = txt(g, s.t, xx, y, { size: sz, weight: s.role === 'str' ? 800 : wt, color: c });
      if (s.role === 'str') { g.fillStyle = c; g.fillRect(xx, y + sz * 0.56, ww, 2.5); }
      xx += ww;
    });
    if (o.hit !== false) listen(x0 - 8, y - sz * 0.75, total + 16, sz * 1.5, [{ text, sp: o.sp || 'tc' }]);
    return { x: x0, w: total, size: sz };
  }
  WSS.sentence = sentence;

  /* ---------- 음절 공 ----------
     잰 값(WSV.meas)이 있으면 그 목소리의 음절마다 길이 L · 크기 A · 높이 H(반음)로, 없으면 엔진의 기본 모양으로 그려요.
     공의 넓이 ≈ 길이와 크기, 공의 높이 = 소리의 높이 */
  function fromMeas(m, n) {
    if (!m || !m.s || m.s.length !== n) return null;
    const durs = m.s.map(x => x[1] - x[0]), md = Math.max(...durs);
    const f0 = m.s.map(x => x[3]).filter(f => f > 0), fmin = f0.length ? Math.min(...f0) : 0;
    return m.s.map((x, i) => ({ L: durs[i] / md, A: Math.pow(10, Math.min(0, x[2]) / 20), H: x[3] > 0 && fmin ? 12 * Math.log2(x[3] / fmin) : 0 }));
  }
  function ballData(k, o = {}) {
    // 한국어식 공은 늘 그림(엔진의 고른 모양)이에요 — ‘정해진 센 음절이 없고 모음을 줄이지 않는다’를 보여 주는 모형.
    // 한국어식으로 읽은 파일을 재 보면 말 덩어리의 끝 쪽이 길고 높아지기도 해서(바나나 90 · 250 · 310ms) 잰 값으로 그리면 ‘고르게’와 맞지 않아요.
    if (o.ko) return { b: WS.koSchematic([...o.ko].length), measured: false };
    const n = WS.nSyl(k), m = o.meas === false ? null : fromMeas(V.meas(o.sp || 'tc', WS.sayText(k)), n);
    return { b: m || WS.schematic(k), measured: !!m };
  }
  WSS.ballData = ballData;
  const ballR = (v, R) => { const q = 0.5 * v.L + 0.5 * v.A; return R * (0.3 + 0.7 * q * q); };
  // 공 줄: x는 가운데(o.align = 'left'면 왼쪽 끝). 돌려줌 { x0, x1, cx: [] }
  function balls(g, k, x, y, o = {}) {
    const R = o.R || 30, d = ballData(k, o), n = d.b.length, hpx = o.hpx == null ? R * 0.13 : o.hpx;
    const labels = o.ko ? [...o.ko] : WS.entry(k).spell, syl = o.ko ? null : WS.syls(k);
    const ls = o.lab || Math.max(13, Math.round(R * 0.6));
    const step = Math.max(2 * R + 10, ...labels.map(l => tw(g, l, ls, 700) + 14));
    const span = step * (n - 1);
    const x0 = o.align === 'left' ? x + R : x - span / 2;
    const cx = [];
    d.b.forEach((v, i) => {
      const r = ballR(v, R), cy = y - clamp(v.H, -2, 9) * hpx, X = x0 + i * step;
      cx.push(X);
      const role = o.ko ? 'ko' : syl[i].st === 1 ? 'str' : syl[i].schwa ? 'weak' : syl[i].st === 2 ? 'sec' : 'plain';
      const c = o.mono || (role === 'ko' ? COL.trap : role === 'str' ? COL.str : role === 'weak' ? COL.weak : COL.plain);
      const hl = o.pick != null && o.pick === i;
      circ(g, X, cy, r, hex(c, role === 'str' || role === 'ko' ? 0.85 : 0.32));
      ring(g, X, cy, r, c, role === 'str' ? 2.5 : 1.8);
      if (hl) ring(g, X, cy, r + 6, COL.accent, 2.5, [5, 4]);
      if (o.labels !== false) {
        const t = o.caps && role === 'str' ? labels[i].toUpperCase() : o.caps && !o.ko ? labels[i].toLowerCase() : labels[i];
        txt(g, t, X, y + R + 14, { size: ls, weight: role === 'str' ? 800 : 600, color: role === 'plain' || role === 'sec' ? COL.soft : c, align: 'center' });
      }
    });
    if (o.hit !== false) {
      const seq = o.ko ? [{ text: o.ko, sp: 'ko' }] : say(k, o.sp || 'tc');
      listen(x0 - R - 6, y - R - 9 * hpx - 6, span + 2 * R + 12, 2 * R + 9 * hpx + 30 + ls, seq);
    }
    return { x0: x0 - R, x1: x0 + span + R, cx, measured: d.measured };
  }
  WSS.balls = balls;
  WSS.ballR = ballR;

  /* ---------- 높낮이 선 · 크기 띠 (잰 값의 f · e, 20ms마다) ---------- */
  function contour(g, k, x, y, w, h, u, o = {}) {
    const m = V.meas(o.sp || 'tc', WS.sayText(k)), syl = WS.syls(k), e = WS.entry(k);
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    const pad = 18, gx = x + pad, gw = w - pad * 2, top = y + 40, bot = y + h - 54;
    let segs, f, en, T;
    if (m && m.s && m.s.length === syl.length && m.f && m.e) {
      T = m.f.length * 20; segs = m.s.map(s => [s[0], s[1]]); f = m.f; en = m.e;
    } else {
      // 잰 값이 없으면 엔진의 기본 모양으로 (그림)
      const sc = WS.schematic(k); T = 0; segs = sc.map(v => { const d = 140 + 160 * v.L; const s = [T, T + d]; T += d; return s; }); T += 60;
      f = []; en = [];
      for (let t = 0; t < T; t += 20) {
        const i = segs.findIndex(s => t >= s[0] && t < s[1]);
        f.push(i < 0 ? 0 : 180 * Math.pow(2, sc[i].H / 12)); en.push(i < 0 ? -60 : 20 * Math.log10(sc[i].A));
      }
    }
    const t0 = Math.max(0, segs[0][0] - 60), t1 = Math.min(T, segs[segs.length - 1][1] + 60);
    const X = t => gx + (t - t0) / (t1 - t0) * gw;
    const p = clamp((u - (o.at || 0)) / 2.2);   // 왼쪽에서 오른쪽으로 그려 나감
    const vf = f.filter(v => v > 0), fmin = vf.length ? Math.min(...vf) : 100, fmax = vf.length ? Math.max(...vf) : 200;
    const span = Math.max(6, 12 * Math.log2(fmax / fmin));
    const Y = hz => bot - 26 - (12 * Math.log2(hz / fmin)) / span * (bot - top - 40);
    // 음절 칸
    segs.forEach((s, i) => {
      const a = X(s[0]), b = X(s[1]), st = syl[i].st === 1;
      if (st) { g.fillStyle = hex(COL.str, 0.12); g.fillRect(a, top - 8, b - a, bot - top + 8); }
      g.strokeStyle = COL.faint; g.setLineDash([4, 5]); g.lineWidth = 1; g.beginPath(); g.moveTo(a, top - 8); g.lineTo(a, bot); g.moveTo(b, top - 8); g.lineTo(b, bot); g.stroke(); g.setLineDash([]);
      const c = st ? COL.str : syl[i].schwa ? COL.weak : COL.soft;
      txt(g, st ? e.spell[i].toUpperCase() : e.spell[i].toLowerCase(), (a + b) / 2, bot + 20, { size: 20, weight: st ? 800 : 600, color: c, align: 'center' });
      txt(g, `${Math.round(s[1] - s[0])}ms`, (a + b) / 2, bot + 42, { size: 12, fam: FM, color: COL.muted, align: 'center' });
    });
    g.save(); g.beginPath(); g.rect(gx - 2, y, (gw + 4) * p, h); g.clip();
    // 크기 띠 (아래)
    if (o.loud !== false) {
      g.beginPath(); g.moveTo(X(t0), bot);
      en.forEach((d, i) => { const t = i * 20; if (t < t0 || t > t1) return; g.lineTo(X(t), bot - clamp((d + 40) / 40) * 34); });
      g.lineTo(X(t1), bot); g.closePath(); g.fillStyle = hex(COL.soft, o.cue === 'loud' ? 0.45 : 0.18); g.fill();
    }
    // 높낮이 선
    if (o.pitch !== false) {
      g.strokeStyle = o.cue === 'pitch' ? COL.accent : COL.str; g.lineWidth = o.cue === 'pitch' ? 4 : 3; g.lineCap = 'round'; g.lineJoin = 'round';
      let on = false; g.beginPath();
      f.forEach((hz, i) => { const t = i * 20; if (t < t0 || t > t1 || !(hz > 0)) { on = false; return; } const px = X(t), py = Y(hz); if (!on) { g.moveTo(px, py); on = true; } else g.lineTo(px, py); });
      g.stroke();
    }
    g.restore();
    txt(g, '높낮이', x + w - pad, y + 20, { size: 14, weight: 700, color: o.cue === 'pitch' ? COL.accent : COL.str, align: 'right' });
    txt(g, '크기', x + w - pad - 64, y + 20, { size: 14, weight: 700, color: o.cue === 'loud' ? COL.text : COL.muted, align: 'right' });
    txt(g, '길이 = 칸의 너비', x + pad, y + 20, { size: 14, weight: 700, color: o.cue === 'long' ? COL.accent : COL.muted });
    listen(x, y, w, h, say(k, o.sp || 'tc'));
    return { measured: !!(m && m.f) };
  }
  WSS.contour = contour;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호는 자막에 쓰지 않음
     영어 낱말 바로 뒤에 조사를 붙이지 않아요(소리 내어 읽을 때 어색해서) — → 나 = 로 이어요.
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '센 음절은 하나 — 낱말 강세와 슈와', d: 36, caps: [
      [0.4, 6, '바나나를 영어로 말해 보세요. 한국어 바나나는 세 음절을 고르게 말해요.'],
      [6, 12, '영어 banana → 둘째 음절만 길고 크고 높아요. 나머지 둘은 짧고 흐리게 지나가요.'],
      [12, 18, '이렇게 음절 하나를 두드러지게 하는 것을 낱말 강세라고 해요. 영어 낱말마다 센 음절은 하나예요.'],
      [18, 24, '약한 음절의 모음은 흔히 짧고 흐린 어가 돼요. 이 소리를 슈와라고 불러요.'],
      [24, 30, '세 단계로 익혀요. 센 음절을 듣고 찾고, 센 음절과 약한 음절을 만들고, 낱말과 문장 속에서 써요.'],
      [30, 36, '미국 표준 발음을 기준으로 해요. 소리는 모두 합성 음성이고, 사전마다 조금씩 다르게 적기도 해요.'],
    ] },
    { id: 'listen', n: '01', title: '들어 보기 · 어디가 센가요?', sub: '① 듣고 가르기 · 음절 공 · 목소리 넷', d: 40, caps: [
      [0.4, 6, '먼저 귀부터 시험해요. 화면의 공 하나가 음절 하나예요. 센 음절은 큰 공, 약한 음절은 작은 공이에요.'],
      [6, 12, '낱말을 눌러 들어 보세요 → banana · hotel · vitamin. 어느 음절이 가장 크게 들리나요?'],
      [12, 18, '공의 크기와 높이는 이 목소리를 실제로 재서 그렸어요. 길고 클수록 큰 공, 높을수록 위에 있어요.'],
      [18, 25, '요령 → 센 음절에서 책상을 톡 쳐 보세요. 한 낱말에 한 번만 쳐요.'],
      [25, 32, '센 음절의 자리가 다르면 다른 낱말이 되기도 해요 → desert · dessert. 사막과 후식이에요.'],
      [32, 40, '여러 목소리로 듣고 공을 놓아 보는 연습이 도움이 돼요. 아래 놀이터의 **강세 공 놓기**가 그 연습이에요.'],
    ] },
    { id: 'korean', n: '02', title: '한국어는 고르게', sub: '바나나 · 호텔 · 비타민 · 초콜릿 — 음절마다 비슷하게', d: 40, caps: [
      [0.4, 6, '한국어 낱말에는 정해진 센 음절이 없어요. 바나나의 세 음절은 모두 또렷한 아로 소리 나요.'],
      [6, 12, '한국어는 낱말 속 어느 음절을 세게 하느냐로 뜻을 가르지 않아요. 그래서 영어 낱말도 고르게 읽기 쉬워요.'],
      [12, 18, '외래어를 견줘 봐요. 호텔 → hotel, 비타민 → vitamin, 초콜릿 → chocolate.'],
      [18, 24, '공을 보세요. 한국어식은 공 크기가 비슷하고, 영어는 공 하나만 커요.'],
      [24, 31, '연구에서도 한국인 학습자의 말에서 낱말 강세 실수가 가장 잦았고, 알아듣기 쉬운지를 가장 잘 설명했어요.'],
      [31, 40, '오늘의 작전 → 센 음절 하나는 길고 크고 높게, 나머지는 짧고 흐리게. 공 하나만 키워요.'],
    ] },
    { id: 'strong', n: '03', title: '센 음절 만들기', sub: '② 길게 · 크게 · 높게 · 모음은 또렷이', d: 42, caps: [
      [0.4, 6, '센 음절에는 네 가지 신호가 있어요. 길게, 크게, 높게, 그리고 모음을 또렷하게.'],
      [6, 12, '크게만 하면 화난 소리처럼 들려요. 길게 끌고 높이를 올리면 크기는 저절로 따라와요.'],
      [12, 18, 'banana → 둘째 음절에서 소리가 올라가고 길어져요. 그다음 음절은 뚝 내려와 짧게 끝나요.'],
      [18, 24, 'hotel → 둘째 음절이 세요. 첫음절은 짧고 가볍게, 둘째 음절은 길고 높게.'],
      [24, 30, 'vitamin → 첫음절이 세요. 바이를 길고 높게 내고, 뒤의 둘은 짧게 붙여요.'],
      [30, 36, '요령 → 센 음절에서 손을 크게 펼치고, 약한 음절에서는 손을 오므려 보세요. 몸이 박자를 기억해요.'],
      [36, 42, '공의 크기를 보세요. 센 음절 하나가 크고 나머지는 작아요. 이 차이가 클수록 영어답게 들려요.'],
    ] },
    { id: 'schwa', n: '04', title: '약한 음절과 슈와', sub: '② 짧게 · 작게 · 흐린 어 · 입과 혀는 쉬는 자리', d: 44, caps: [
      [0.4, 6, '이제 약한 음절이에요. 약한 음절은 짧고, 작고, 낮아요. 모음은 흔히 흐린 어가 돼요.'],
      [6, 12, '이 흐린 어를 슈와라고 해요. 입을 조금만 벌리고, 혀와 입술에 힘을 빼 가운데에 두면 나는 소리예요.'],
      [12, 18, '슈와는 철자와 상관없어요 → about · today · pencil · support. 밑줄 친 글자가 모두 같은 흐린 어예요.'],
      [18, 24, '한국어식으로 읽으면 아 · 오 · 이 · 우를 철자대로 또렷하게 내요. 그러면 약한 음절이 세게 들려요.'],
      [24, 30, '연구에서도 한국인 학습자는 약한 음절의 모음을 덜 줄이는 경향을 보였어요.'],
      [30, 37, '요령 → 약한 음절은 옆의 센 음절에 기대어 재빨리 지나가요. 따로 떼어 또박또박 말하지 않아요.'],
      [37, 44, 'Canada → 첫 a만 또렷한 애, 나머지 두 a는 슈와예요. 같은 글자도 강세에 따라 소리가 달라요.'],
    ] },
    { id: 'pair', n: '05', title: '강세로 갈리는 짝', sub: '① 듣고 가르기 · desert · dessert · thirty · thirteen', d: 42, caps: [
      [0.4, 6, '센 음절의 자리가 다르면 다른 낱말이 돼요. 왼쪽은 앞이 세고, 오른쪽은 뒤가 세요.'],
      [6, 12, 'desert · dessert. 사막은 첫음절이, 후식은 둘째 음절이 세요. 센 음절의 모음도 달라요.'],
      [12, 18, '숫자도 그래요 → thirty · thirteen. 서른은 앞이, 열셋은 뒤가 세요.'],
      [18, 24, 'fifty · fifteen, eighty · eighteen. 열 단위는 끝을 짧게 내리고, 십 몇은 끝을 길고 높게 끌어요.'],
      [24, 31, '같은 철자인데 품사에 따라 자리가 바뀌는 낱말도 있어요. 기록(명사)은 첫음절, 기록하다(동사)는 둘째 음절이 세요.'],
      [31, 37, '선물과 주다, 물건과 반대하다 → 이 짝들도 그래요. 두 음절 짝은 흔히 명사는 앞이, 동사는 뒤가 세요.'],
      [37, 42, '천천히 들어도 괜찮아요. 끝 음절이 길게 올라가는지, 짧게 내려가는지 들어 보세요.'],
    ] },
    { id: 'loan', n: '06', title: '외래어 함정', sub: '③ 낱말 속에서 · 바나나 · 비타민 · 호텔 · 초콜릿', d: 44, caps: [
      [0.4, 6, '외래어는 한국어로 고르게 읽던 습관이 붙어 있어 더 조심해요. 낱말마다 센 음절을 먼저 정해요.'],
      [6, 12, '둘째 음절이 센 낱말 → banana · tomato · computer · idea.'],
      [12, 18, '첫음절이 센 낱말 → vitamin · internet · energy · marketing.'],
      [18, 24, '마지막 음절이 센 낱말 → hotel · guitar · design · violin.'],
      [24, 31, '약한 음절이 아주 약해져 음절이 줄기도 해요 → chocolate · business · family · orange. 흔히 두 음절로 말해요.'],
      [31, 37, '한국어 표기와 음절 수가 다를 때가 많아요. 아이디어는 네 음절, 영어 idea → 세 음절이에요.'],
      [37, 44, '외래어를 영어로 말할 때는 한국어 표기를 잠시 잊고, 센 음절 하나와 약한 음절을 먼저 정해요.'],
    ] },
    { id: 'shift', n: '07', title: '옮겨 가는 센 음절', sub: '③ 낱말 속에서 · Canada · Canadian · photograph · photographer', d: 44, caps: [
      [0.4, 6, '같은 뿌리의 낱말도 끝이 붙으면 센 음절이 옮겨 가요.'],
      [6, 12, 'Canada → 첫음절, Canadian → 둘째 음절이 세요. 센 음절이 옮겨 가면 모음도 바뀌어요.'],
      [12, 18, '첫 a는 또렷한 애에서 슈와로, 둘째 a는 슈와에서 또렷한 에이로 바뀌어요.'],
      [18, 25, 'photograph → 첫음절, photographer → 둘째 음절, photographic → 셋째 음절이 세요.'],
      [25, 31, 'economy → 둘째 음절, economic → 셋째 음절. Japan → 둘째 음절, Japanese → 셋째 음절.'],
      [31, 38, '어림 규칙 → photographic · Canadian, 이렇게 끝이 붙으면 흔히 그 바로 앞 음절이 세요. 예외도 있어요.'],
      [38, 44, '철자는 비슷해도 센 음절이 옮겨 가면 소리가 크게 달라져요. 낱말마다 들어서 확인해요.'],
    ] },
    { id: 'sentence', n: '08', title: '문장 속에서', sub: '③ 문장 속에서 · I’d like a banana, please. · It’s fifteen dollars.', d: 44, caps: [
      [0.4, 6, '문장 속에서도 낱말의 센 음절은 그대로예요. 센 음절을 칠한 문장을 들어 보세요.'],
      [6, 12, "I'd like a banana, please. 바나나의 둘째 음절이 문장에서도 길게 들려요."],
      [12, 18, 'The hotel is next to the station. 호텔은 끝이, 역은 앞이 세요.'],
      [18, 24, 'Can I record your answer? 녹음하다는 동사라서 둘째 음절이 세요.'],
      [24, 30, "It's fifteen dollars, not fifty. 숫자는 센 음절의 자리로 갈라요."],
      [30, 36, 'See you tomorrow! 약한 음절은 문장 속에서 더 짧아져요. 투모로우가 아니라 흐린 어로 시작해요.'],
      [36, 40, '문장 전체의 리듬과 센 낱말은 다른 꼭지에서 다뤄요.'],
      [40, 44, '아래 **따라 말하기**에 문장 스물여덟 개가 있어요. 묶음마다 일곱 문장이에요.'],
    ] },
    { id: 'summary', n: '09', title: '정리', sub: '3단계 발음법 · 센 음절과 약한 음절', d: 36, caps: [
      [0.4, 6, '정리해요. ① 듣고 가르기 → 낱말마다 센 음절 하나를 찾아요. 공 하나만 커요.'],
      [6, 12, '② 만들기 → 센 음절은 길고 크고 높게, 약한 음절은 짧고 흐린 어로.'],
      [12, 18, '③ 낱말 · 문장 속에서 → 외래어는 고르게 읽지 않기. 끝이 붙으면 센 음절이 옮겨 가요.'],
      [18, 24, '숫자 열셋과 서른, 명사와 동사처럼 센 음절의 자리로 뜻이 갈리는 낱말도 있어요.'],
      [24, 30, '목표는 원어민과 똑같은 소리가 아니라, 듣는 사람이 낱말을 쉽게 알아듣는 소리예요.'],
      [30, 36, '아래 **강세 공 놓기**와 **내 발음 확인**에서 직접 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  WSS.CHAPTERS = CHAPTERS; WSS.CAPTIONS = CAPTIONS; WSS.END = END;
  WSS.POSTER = CHAPTERS.find(c => c.id === 'korean').t + 21;
  WSS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  WSS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 900, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 900, 800, 24, FD), weight: 800, fam: FD });
  }
  const gloss = k => (WS.entry(k) || {}).gloss || '';
  const ipa = k => WS.ipa(k);
  // 오른쪽 위 범례: 센 음절 보라 · 슈와 민트
  function legend(g, a = 1) {
    fade(g, a, () => {
      tag(g, '센 음절', 1200, 92, COL.str, { align: 'right', size: 15, h: 30 });
      tag(g, '약한 모음 ə', 1098, 92, COL.weak, { align: 'right', size: 15, h: 30 });
    });
  }

  // 05장 짝 차례
  const PSEQ = [[0, 'desert-dessert'], [12, 'thirty-thirteen'], [18, 'fifty-fifteen'], [21, 'eighty-eighteen'], [24, 'record'], [31, 'present'], [34, 'object']];
  WSS.PSEQ = PSEQ;
  // 06장 외래어 카드가 나타나는 때 (줄마다)
  const LAPPEAR = { second: 6, first: 12, last: 18, drop: 24 };
  // 08장 문장
  const SROWS = [
    { en: "I'd like a banana, please.", grp: 'loan', at: 6 },
    { en: 'The hotel is next to the station.', grp: 'loan', at: 12 },
    { en: 'Can I record your answer?', grp: 'shift', at: 18, keys: { record: 'record:v' } },
    { en: "It's fifteen dollars, not fifty.", grp: 'pair', at: 24 },
    { en: 'See you tomorrow!', grp: 'schwa', at: 30 },
  ];
  // 03장: 시각마다 보여 줄 낱말
  const STRONG_SEQ = [[0, 'banana'], [18, 'hotel'], [24, 'vitamin']];
  WSS.STRONG_WORDS = ['banana', 'hotel', 'vitamin', 'computer', 'internet', 'guitar', 'idea', 'energy'];
  const CUES = [['long', '길게', '센 음절의 모음을 끌어요'], ['loud', '크게', '숨을 조금 더 실어요'], ['pitch', '높게', '소리가 올라갔다 내려와요'], ['clear', '모음은 또렷이', '애 · 에이 · 아이 그대로']];
  WSS.CUES = CUES;

  const SCENES = {
    /* 00 들어가며 */
    intro(g, u) {
      const A = 1 - ramp(u, 23.6, 0.5);
      fade(g, A * ramp(u, 0.4, 0.6), () => {
        panel(g, 100, 150, 500, 330, { fill: COL.panel, stroke: COL.faint });
        txt(g, '한국어', 130, 180, { size: 15, weight: 700, color: COL.muted });
        koWord(g, 'banana', 350, 235, 56, { align: 'center' });
        balls(g, 'banana', 350, 375, { ko: '바나나', R: 36 });
        txt(g, '세 음절을 고르게', 350, 455, { size: 18, weight: 700, color: COL.trap, align: 'center' });
      });
      fade(g, A * ramp(u, 6, 0.6), () => {
        panel(g, 680, 150, 500, 330, { fill: COL.panel, stroke: COL.faint });
        txt(g, '영어', 710, 180, { size: 15, weight: 700, color: COL.muted });
        word(g, 'banana', 930, 235, 56, { align: 'center', caps: u >= 12, weak: u >= 18 });
        const B = balls(g, 'banana', 930, 375, { R: 36, caps: true });
        txt(g, '둘째 음절만 길고 크고 높게', 930, 455, { size: 18, weight: 700, color: COL.str, align: 'center' });
        fade(g, win(u, 12, 23.8), () => tag(g, '센 음절 = 하나', B.cx[1], 290, COL.str, { align: 'center', size: 15, h: 30 }));
        fade(g, ramp(u, 18, 0.5), () => [0, 2].forEach(i => chip(g, 'ə', B.cx[i], 300, { size: 18, fam: FM, color: COL.weak, fill: COL.panel2, stroke: COL.weak, align: 'center', h: 30 })));
      });
      fade(g, A * win(u, 18, 23.8), () => chip(g, '약한 음절의 흐린 어 ə = 슈와', 640, 530, { size: 18, color: COL.weak, fill: COL.panel2, stroke: COL.weak, align: 'center' }));
      const steps = [['ear', '① 듣고 가르기', '센 음절 하나 찾기'], ['balls', '② 소리 만들기', '센 음절 · 약한 음절(슈와)'], ['text', '③ 낱말 · 문장 속에서', '외래어 · 짝 · 낱말 가족']];
      steps.forEach(([ic, h, s], i) => fade(g, ramp(u, 24.2 + i * 0.6, 0.5), () => {
        const x = 110 + i * 360;
        panel(g, x, 200, 340, 190, { fill: COL.panel, stroke: COL.faint });
        circ(g, x + 170, 252, 30, COL.panel2); icon(g, ic, x + 170, 252, 32, COL.accent);
        txt(g, h, x + 170, 314, { size: 22, weight: 800, color: COL.text, align: 'center' });
        txt(g, s, x + 170, 352, { size: 16, weight: 500, color: COL.soft, align: 'center' });
      }));
      fade(g, ramp(u, 30, 0.5), () => {
        chip(g, '미국 표준 발음(General American) · 합성 음성 · 사전마다 조금씩 달라요', 640, 460, { size: 16, weight: 600, color: COL.muted, fill: COL.panel2, align: 'center' });
      });
    },

    /* 01 들어 보기 */
    listen(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      fade(g, win(u, 0.4, 6.2), () => {
        circ(g, 470, 330, 60, hex(COL.str, 0.85)); ring(g, 470, 330, 60, COL.str, 2.5);
        circ(g, 810, 350, 26, hex(COL.weak, 0.32)); ring(g, 810, 350, 26, COL.weak, 1.8);
        txt(g, '센 음절 = 큰 공', 470, 430, { size: 22, weight: 800, color: COL.str, align: 'center' });
        txt(g, '약한 음절 = 작은 공', 810, 430, { size: 22, weight: 800, color: COL.weak, align: 'center' });
        txt(g, '공 하나 = 음절 하나', 640, 500, { size: 18, weight: 600, color: COL.soft, align: 'center' });
      });
      const WORDS = ['banana', 'hotel', 'vitamin'];
      WORDS.forEach((k, i) => fade(g, ramp(u, 6 + i * 0.4, 0.5), () => {
        const x = 110 + i * 360, hl = u >= 18 && u < 25;
        panel(g, x, 146, 340, 268, { fill: COL.panel, stroke: COL.faint });
        word(g, k, x + 170, 192, 40, { align: 'center', caps: u >= 9 });
        txt(g, `${WS.ipaDots(k)} · ${gloss(k)}`, x + 170, 232, { size: 15, fam: FM, color: COL.muted, align: 'center' });
        const B = balls(g, k, x + 170, 334, { R: 34, caps: true });
        if (u < 12) waves(g, x + 170 + tw(g, k, 40, 700) / 2 + 16, 192, COL.str, win(u, 6, 12), u + i);
        if (hl) {
          const at = WS.stressAt(k), beat = ((u - 18) % 1.2) / 1.2;
          icon(g, 'tap', B.cx[at], 276 - 10 * Math.sin(Math.PI * clamp(beat * 2)), 30, COL.accent);
        }
      }));
      fade(g, win(u, 12, 18.2), () => chip(g, '공의 넓이 = 길이 × 크기 · 공의 높이 = 소리의 높이 · 이 목소리에서 잰 값', 640, 466, { size: 16, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' }));
      fade(g, win(u, 18, 25.2), () => chip(g, '센 음절에서 책상을 톡 · 한 낱말에 한 번', 640, 466, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center' }));
      fade(g, ramp(u, 25, 0.5), () => {
        const p = WS.PAIRS[0];
        panel(g, 250, 428, 780, 90, { fill: COL.panel, stroke: S.pair === p.id ? COL.accent : COL.faint });
        word(g, p.a, 380, 456, 30, { align: 'center' }); balls(g, p.a, 380, 496, { R: 13, labels: false, hpx: 1.2 });
        txt(g, '↔', 640, 464, { size: 24, weight: 700, color: COL.muted, align: 'center' });
        word(g, p.b, 900, 456, 30, { align: 'center' }); balls(g, p.b, 900, 496, { R: 13, labels: false, hpx: 1.2 });
        txt(g, gloss(p.a), 470, 456, { size: 15, color: COL.muted }); txt(g, gloss(p.b), 810, 456, { size: 15, color: COL.muted, align: 'right' });
      });
      fade(g, ramp(u, 32.4, 0.5), () => {
        WS.VOICES.forEach((v, i) => {
          const x = 250 + i * 260, hl = S.voice === v.sp;
          const c = chip(g, v.ko, x, 550, { size: 16, fill: COL.panel2, stroke: hl ? COL.accent : COL.line, align: 'center', pad: 32, h: 36 });
          icon(g, 'spk', c.x + 18, 550, 17, COL.accent);
          listen(c.x, c.y, c.w, c.h, [{ text: 'desert', sp: v.sp }, { text: 'dessert', sp: v.sp, gap: 0.7 }]);
        });
      });
    },

    /* 02 한국어는 고르게 */
    korean(g, u) {
      const ROWS = ['banana', 'hotel', 'vitamin', 'chocolate'], AT = [0.4, 12, 13.2, 14.4];
      fade(g, ramp(u, 0.4, 0.5), () => {
        txt(g, '한국어식', 330, 150, { size: 16, weight: 700, color: COL.trap, align: 'center' });
        txt(g, '영어', 950, 150, { size: 16, weight: 700, color: COL.str, align: 'center' });
      });
      ROWS.forEach((k, i) => fade(g, ramp(u, AT[i], 0.5), () => {
        const y = 205 + i * 88, hl = S.kword === k;
        panel(g, 90, y - 38, 1100, 78, { fill: hl ? hex(COL.accent, 0.08) : COL.panel, stroke: hl ? COL.accent : COL.faint, r: 12 });
        koWord(g, k, 120, y, 30);
        balls(g, k, 400, y + 2, { ko: WS.entry(k).ko, R: 20, lab: 14, hpx: 2 });
        txt(g, '→', 640, y, { size: 26, weight: 700, color: COL.muted, align: 'center' });
        word(g, k, 690, y, 30, { caps: true });
        balls(g, k, 1030, y + 2, { R: 20, lab: 14, hpx: 2, caps: true });
      }));
      fade(g, win(u, 6, 12.2), () => tag(g, '한국어 = 센 음절로 뜻을 가르지 않아요', 640, 548, COL.trap, { align: 'center', size: 17, h: 40 }));
      fade(g, win(u, 18, 24.2), () => {
        tag(g, '공 크기가 비슷해요', 360, 548, COL.trap, { align: 'center', size: 17, h: 40 });
        tag(g, '공 하나만 커요', 960, 548, COL.str, { align: 'center', size: 17, h: 40 });
      });
      fade(g, win(u, 24, 31.2), () => {
        chip(g, '연구 → 낱말 강세 실수가 가장 잦았고, 알아듣기 쉬운지를 가장 잘 설명했어요', 640, 536, { size: 17, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '근거와 한계 → 페이지 아래 각주', 640, 572, { size: 14, color: COL.muted, align: 'center' });
      });
      fade(g, ramp(u, 31, 0.5), () => {
        tag(g, '센 음절 하나 → 길고 크고 높게', 360, 548, COL.str, { align: 'center', size: 18, h: 42 });
        tag(g, '나머지 → 짧고 흐리게', 930, 548, COL.weak, { align: 'center', size: 18, h: 42 });
      });
    },

    /* 03 센 음절 만들기 */
    strong(g, u) {
      // 왼쪽: 신호 넷
      CUES.forEach(([id, h, s], i) => fade(g, ramp(u, 0.4 + i * 0.7, 0.5), () => {
        const y = 165 + i * 92, on = S.cue ? S.cue === id : (u >= 6 && u < 12 && (id === 'long' || id === 'pitch'));
        panel(g, 80, y, 330, 78, { fill: on ? hex(COL.accent, 0.1) : COL.panel, stroke: on ? COL.accent : COL.faint });
        txt(g, h, 104, y + 28, { size: 22, weight: 800, color: on ? COL.accent : COL.str });
        txt(g, s, 104, y + 56, { size: 15, weight: 500, color: COL.soft });
        // 작은 그림
        const gx = 340, gy = y + 39;
        g.strokeStyle = on ? COL.accent : COL.muted; g.fillStyle = on ? COL.accent : COL.muted; g.lineWidth = 3; g.lineCap = 'round';
        if (id === 'long') { g.beginPath(); g.moveTo(gx - 34, gy); g.lineTo(gx + 34, gy); g.stroke(); }
        if (id === 'loud') { circ(g, gx - 18, gy, 7, g.fillStyle); circ(g, gx + 14, gy, 17, g.fillStyle); }
        if (id === 'pitch') { g.beginPath(); g.moveTo(gx - 34, gy + 12); g.quadraticCurveTo(gx, gy - 30, gx + 34, gy + 12); g.stroke(); }
        if (id === 'clear') txt(g, 'æ eɪ aɪ', gx, gy, { size: 16, fam: FM, weight: 700, color: on ? COL.accent : COL.muted, align: 'center' });
      }));
      // 오른쪽: 높낮이 선과 크기 띠
      let k = S.sword;
      if (!k) STRONG_SEQ.forEach(([at, w]) => { if (u >= at) k = w; });
      const big = 1 - win(u, 30, 42, 0.5) * (S.sword ? 0 : 1);
      fade(g, ramp(u, 0.6, 0.5) * big, () => {
        word(g, k, 830, 168, 40, { align: 'center', caps: true });
        txt(g, `${WS.ipaDots(k)} · ${gloss(k)}`, 830, 208, { size: 15, fam: FM, color: COL.muted, align: 'center' });
        contour(g, k, 450, 232, 760, 320, u, { at: S.sword ? 0 : STRONG_SEQ.slice().reverse().find(([at]) => u >= at)[0] + 0.3, cue: S.cue });
      });
      fade(g, win(u, 30, 36.2) * (S.sword ? 0 : 1), () => {
        panel(g, 450, 180, 760, 380, { fill: COL.panel, stroke: COL.faint });
        const ph = (u - 30) % 1.5 / 1.5, B = ph < 0.5;
        word(g, 'banana', 830, 230, 44, { align: 'center', caps: true });
        [['ba', false], ['NA', true], ['na', false]].forEach(([s, st], i) => {
          const x = 600 + i * 230, open = st && ph > 0.33 && ph < 0.75;
          circ(g, x, 380, open ? 70 : st ? 48 : 30, hex(st ? COL.str : COL.weak, st ? 0.5 : 0.25));
          txt(g, s, x, 380, { size: st ? 30 : 22, weight: 800, color: st ? COL.str : COL.weak, align: 'center' });
          txt(g, st ? '손 펼치기' : '오므리기', x, 490, { size: 16, weight: 700, color: COL.soft, align: 'center' });
        });
        if (B) { /* 박자 표시 없음 — 공이 커졌다 작아짐 */ }
      });
      fade(g, ramp(u, 36, 0.5) * (S.sword ? 0 : 1), () => {
        panel(g, 450, 180, 760, 380, { fill: COL.panel, stroke: COL.faint });
        ['banana', 'hotel', 'vitamin'].forEach((w, i) => {
          const x = 575 + i * 255;
          word(g, w, x, 240, 30, { align: 'center', caps: true });
          balls(g, w, x, 390, { R: 34, caps: true });
        });
      });
    },

    /* 04 약한 음절과 슈와 */
    schwa(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      const late = ramp(u, 37, 0.5) && !S.sex;
      // 왼쪽 입 그림
      fade(g, ramp(u, 0.3, 0.5) * (1 - (late ? ramp(u, 37, 0.5) : 0)), () => {
        mouth(g, 60, 150, 0.8, 'schwa', { mark: COL.weak, labels: ['tip', 'lips'], voice: u >= 6 ? u : null, t: u });
        txt(g, '입은 조금만 · 혀와 입술은 힘을 빼고 가운데', 220, 470, { size: 16, weight: 700, color: COL.weak, align: 'center' });
      });
      fade(g, ramp(u, 0.6, 0.5) * (1 - ramp(u, 11.8, 0.4)), () => {
        panel(g, 520, 160, 680, 260, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'ə', 640, 290, { size: 120, weight: 700, fam: FM, color: COL.weak, align: 'center' });
        txt(g, '슈와 (schwa)', 900, 230, { size: 26, weight: 800, color: COL.weak });
        ['짧게', '작게', '낮게', '흐린 어'].forEach((s, i) => tag(g, s, 900 + (i % 2) * 120, 290 + Math.floor(i / 2) * 50, COL.weak, { size: 16, h: 36 }));
      });
      // 철자는 달라도 같은 슈와
      const EX = S.sex ? [S.sex] : ['about', 'today', 'pencil', 'support'];
      fade(g, ramp(u, 12, 0.5) * (late ? 1 - ramp(u, 37, 0.5) : 1), () => EX.forEach((k, i) => {
        const x = S.sex ? 560 : 520 + (i % 2) * 345, y = S.sex ? 190 : 160 + Math.floor(i / 2) * 180, w = S.sex ? 640 : 330, h = S.sex ? 330 : 164;
        panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
        const R = word(g, k, x + w / 2, y + 52, S.sex ? 52 : 40, { align: 'center' });
        // 슈와 글자 밑에 ə
        WS.schwaLetters(k).forEach(sl => {
          const e = WS.entry(k), before = e.spell.slice(0, sl.i).join('').length + (sl.at[0] || 0);
          const pre = tw(g, e.w.slice(0, before), S.sex ? 52 : 40, 700), ch = tw(g, e.w[before], S.sex ? 52 : 40, 700);
          txt(g, 'ə', R.x + pre + ch / 2, y + 92, { size: 20, fam: FM, weight: 700, color: COL.weak, align: 'center' });
        });
        txt(g, `${WS.ipa(k)} · ${gloss(k)}`, x + w / 2, y + 120, { size: 15, fam: FM, color: COL.muted, align: 'center' });
        fade(g, S.sex ? 1 : win(u, 18, 24.2), () => {
          const L = WS.schwaLetters(k)[0], e = WS.entry(k), ch = e.spell[L.i][L.at[0]].toLowerCase(), KO = { a: '아', e: '에', i: '이', o: '오', u: '우', y: '이' }[ch];
          tag(g, `${ch} → ${KO}처럼 또렷하게`, x + w / 2, y + h - 20, COL.trap, { align: 'center', size: 14, h: 28 });
        });
        if (S.sex) balls(g, k, x + w / 2, y + 220, { R: 30, caps: true });
      }));
      fade(g, win(u, 24, 30.2) * (S.sex ? 0 : 1), () => chip(g, '연구 → 한국인 학습자는 약한 모음을 덜 줄이는 경향', 860, 540, { size: 16, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 36 }));
      fade(g, win(u, 30, 37.2) * (S.sex ? 0 : 1), () => {
        const B = balls(g, 'about', 860, 540, { R: 22, caps: true, labels: false, hpx: 2 });
        arrow(g, B.cx[0] + 14, 540, B.cx[1] - 30, 540, COL.weak, 2.5);
        txt(g, '약한 음절은 센 음절에 기대어', B.x1 + 20, 540, { size: 16, weight: 700, color: COL.weak });
      });
      // Canada: 같은 글자 a, 다른 소리
      fade(g, late ? ramp(u, 37, 0.5) : 0, () => {
        word(g, 'Canada', 640, 210, 72, { align: 'center' });
        const e = WS.entry('Canada'), R0 = tw(g, 'Canada', 72, 700), x0 = 640 - R0 / 2;
        let at = 0;
        e.spell.forEach((s, i) => {
          const sw = tw(g, s, 72, i === 0 ? 800 : 700), aIdx = s.toLowerCase().indexOf('a'), pre = tw(g, s.slice(0, aIdx), 72, 700), cw = tw(g, 'a', 72, 700);
          const cx = x0 + at + pre + cw / 2, st = e.syl[i].st === 1;
          txt(g, st ? 'æ' : 'ə', cx, 285, { size: 24, fam: FM, weight: 700, color: st ? COL.str : COL.weak, align: 'center' });
          txt(g, st ? '또렷한 애' : '슈와', cx, 318, { size: 15, weight: 700, color: st ? COL.str : COL.weak, align: 'center' });
          at += sw;
        });
        mouth(g, 250, 340, 0.5, 'ae', { mark: COL.str });
        mouth(g, 820, 340, 0.5, 'schwa', { mark: COL.weak });
        txt(g, '애 → 입을 크게', 350, 555, { size: 16, weight: 700, color: COL.str, align: 'center' });
        txt(g, '슈와 → 입을 조금만', 920, 555, { size: 16, weight: 700, color: COL.weak, align: 'center' });
      });
    },

    /* 05 강세로 갈리는 짝 */
    pair(g, u) {
      const fixed = S.pair ? WS.PAIRS.find(p => p.id === S.pair) : null;
      fade(g, ramp(u, 0.3, 0.5), () => {
        tag(g, '앞이 세요', 330, 165, COL.a, { align: 'center', size: 16, h: 32 });
        tag(g, '뒤가 세요', 950, 165, COL.b, { align: 'center', size: 16, h: 32 });
      });
      const showPair = (p, a) => fade(g, a, () => {
        [[p.a, 330, COL.a], [p.b, 950, COL.b]].forEach(([k, x, c]) => {
          word(g, k, x, 250, 54, { align: 'center', caps: true });
          txt(g, gloss(k), x, 300, { size: 17, weight: 600, color: COL.soft, align: 'center' });
          txt(g, WS.ipaDots(k), x, 332, { size: 17, fam: FM, color: COL.muted, align: 'center' });
          const homo = WS.entry(k).homo;
          balls(g, k, x, 430, { R: 32, caps: true, meas: homo ? false : undefined });
          if (homo) { const s = WS.HOMO_SENT[k][0]; sentence(g, s, x, 520, 18, { align: 'center', keys: { [WS.word(k)]: k }, maxW: 520 }); }
          ring(g, x, 430, 0, c);
        });
        txt(g, '↔', 640, 250, { size: 34, weight: 700, color: COL.muted, align: 'center' });
        tag(g, WS.PAIR_KIND[p.kind], 640, 300, COL.muted, { align: 'center', size: 14, h: 28 });
      });
      if (fixed) showPair(fixed, 1);
      else PSEQ.forEach(([at, id], k) => {
        const nx = k + 1 < PSEQ.length ? PSEQ[k + 1][0] : 37;
        showPair(WS.PAIRS.find(p => p.id === id), ramp(u, at + (k ? 0.1 : 0.4), 0.4) * (1 - ramp(u, nx - 0.3, 0.3)));
      });
      if (!fixed) fade(g, ramp(u, 37, 0.5), () => {
        WS.PAIRS.filter(p => p.kind === 'num').forEach((p, i) => {
          const x = 140 + (i % 4) * 255, y = 250 + Math.floor(i / 4) * 80;
          panel(g, x, y - 26, 235, 52, { fill: COL.panel2, stroke: COL.faint, r: 12 });
          word(g, p.a, x + 62, y, 21, { align: 'center', caps: true }); txt(g, '·', x + 117, y, { size: 20, color: COL.muted, align: 'center' }); word(g, p.b, x + 175, y, 21, { align: 'center', caps: true });
        });
        txt(g, '열 단위 → 앞이 세고 끝이 짧게 · 십 몇 → 끝이 길고 높게', 640, 450, { size: 18, weight: 700, color: COL.soft, align: 'center' });
      });
    },

    /* 06 외래어 함정 */
    loan(g, u) {
      WS.LROWS.forEach((row, ri) => {
        fade(g, ramp(u, LAPPEAR[row.id] - 0.2, 0.4), () => txt(g, row.ko, 80, 150 + ri * 104, { size: 14, weight: 700, color: COL.accent }));
        row.words.forEach((k, ci) => {
          const x = 80 + ci * 285, y = 160 + ri * 104, at = LAPPEAR[row.id] + ci * 0.3, hl = S.loan === k || (!S.loan && k === 'idea' && u >= 31 && u < 37.2);
          fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, at, 0.4)), () => panel(g, x, y, 265, 88, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }));
          fade(g, S.loan ? 1 : ramp(u, at, 0.5), () => {
            panel(g, x, y, 265, 88, { fill: COL.panel, stroke: hl ? COL.accent : COL.faint, lw: hl ? 2.5 : 1.5 });
            koWord(g, k, x + 16, y + 28, 22);
            word(g, k, x + 249, y + 28, fit(g, WS.caps(k), 24, 150, 800), { align: 'right', caps: true });
            txt(g, `${WS.koSyl(k)} → ${WS.nSyl(k)}음절`, x + 16, y + 66, { size: 14, weight: 700, color: WS.koSyl(k) > WS.nSyl(k) ? COL.trap : COL.muted });
            balls(g, k, x + 190, y + 64, { R: 9, labels: false, hpx: 0.8, meas: true });
          });
        });
      });
    },

    /* 07 옮겨 가는 센 음절 */
    shift(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      const fam = S.fam ? WS.FAMS.find(f => f.id === S.fam) : null;
      const famRow = (f, y, x0, xw, sz, R) => {
        const n = f.words.length, step = xw / n;
        f.words.forEach((k, i) => {
          const x = x0 + step * (i + 0.5);
          word(g, k, x, y, sz, { align: 'center', caps: true });
          balls(g, k, x, y + R * 2.4 + 10, { R, caps: true, lab: Math.max(12, R * 0.55) });
          if (i < n - 1) arrow(g, x + step * 0.36, y, x + step * 0.64, y, COL.muted, 2);
        });
      };
      if (fam) {
        famRow(fam, 230, 80, 1120, 46, 30);
        const sh = WS.vowelShift(fam.words[0], fam.words[1]);
        if (sh.length) txt(g, sh.map(x => `${x.sp.toLowerCase()} → ${x.va} → ${x.vb}`).join(' · '), 640, 500, { size: 20, fam: FM, weight: 700, color: COL.soft, align: 'center' });
        return;
      }
      fade(g, ramp(u, 6, 0.5), () => famRow(WS.FAMS[0], 172, 120, 700, 40, 24));
      fade(g, win(u, 12, 18.2), () => {
        WS.vowelShift('Canada', 'Canadian').forEach((x, i) => {
          tag(g, `${x.sp.toLowerCase()} → ${x.va} ⇢ ${x.vb}`, 1010, 170 + i * 50, x.sb === 1 ? COL.str : COL.weak, { align: 'center', size: 17, h: 38, fam: FM });
        });
      });
      fade(g, ramp(u, 18, 0.5), () => famRow(WS.FAMS[1], 312, 80, 1120, 34, 20));
      fade(g, ramp(u, 25, 0.5), () => { famRow(WS.FAMS[2], 432, 80, 540, 28, 16); famRow(WS.FAMS[3], 432, 660, 540, 28, 16); });
      fade(g, ramp(u, 31, 0.5), () => chip(g, '어림 규칙 → 끝이 붙으면 흔히 그 바로 앞 음절이 세요 (예외도 있어요)', 640, 556, { size: 16, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
    },

    /* 08 문장 속에서 */
    sentence(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      if (S.sent != null) {
        const s = WS.SENT[S.sent];
        tag(g, WS.SGRP[s.grp].ko, 640, 220, COL.muted, { align: 'center', size: 16, h: 32 });
        sentence(g, s.en, 640, 310, 46, { align: 'center', maxW: 1100, keys: s.keys });
        txt(g, s.ko, 640, 380, { size: 20, weight: 600, color: COL.soft, align: 'center' });
        const ws = WS.wordsIn(s.en, s.keys);
        ws.forEach((k, i) => { const x = 640 + (i - (ws.length - 1) / 2) * 300; word(g, k, x, 450, 26, { align: 'center', caps: true, dots: true }); });
        return;
      }
      SROWS.forEach((s, i) => fade(g, ramp(u, s.at, 0.5), () => {
        const y = 182 + i * 80;
        tag(g, WS.SGRP[s.grp].ko, 80, y, COL.muted, { size: 14, h: 28, align: 'left' });
        sentence(g, s.en, 260, y, 34, { maxW: 700, keys: s.keys });
        const ws = WS.wordsIn(s.en, s.keys);
        txt(g, ws.map(k => WS.caps(k)).join(' · '), 1200, y, { size: 17, weight: 700, color: COL.str, align: 'right' });
      }));
      fade(g, win(u, 30, 36.2), () => {
        const B = balls(g, 'tomorrow', 640, 590 - 40, { R: 0.1, labels: false, hit: false });
        if (B) { /* 공은 문장 줄에서 보여요 */ }
      });
    },

    /* 09 정리 */
    summary(g, u) {
      const X = [80, 360, 790], Y0 = 145;
      fade(g, ramp(u, 0.3, 0.5), () => {
        panel(g, 60, Y0, 1160, 330, { fill: COL.panel, stroke: COL.faint });
        circ(g, X[1] + 26, Y0 + 46, 22, hex(COL.str, 0.85));
        circ(g, X[2] + 18, Y0 + 50, 12, hex(COL.weak, 0.4)); ring(g, X[2] + 18, Y0 + 50, 12, COL.weak, 1.8);
        txt(g, '센 음절', X[1] + 60, Y0 + 46, { size: 22, weight: 800, color: COL.str });
        txt(g, '약한 음절', X[2] + 44, Y0 + 50, { size: 22, weight: 800, color: COL.weak });
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + 98, 1120, 1);
      });
      const rows = [
        ['① 듣고 가르기', '낱말마다 하나 · 큰 공', '나머지 모두 · 작은 공', 0.4],
        ['② 만들기', '길게 · 크게 · 높게 · 모음 또렷이', '짧게 · 작게 · 낮게 · 흐린 어 ə', 6],
        ['③ 낱말 속에서', '외래어도 하나만 · 끝이 붙으면 옮겨 감', '철자와 상관없이 슈와 · 음절이 줄기도', 12],
      ];
      rows.forEach(([h, a, b, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = Y0 + 140 + i * 66;
        txt(g, h, X[0] + 16, y, { size: 19, weight: 800, color: COL.text });
        txt(g, a, X[1] + 4, y, { size: fit(g, a, 18, 410, 600), weight: 600, color: COL.str });
        txt(g, b, X[2] + 4, y, { size: fit(g, b, 18, 410, 600), weight: 600, color: COL.weak });
      }));
      fade(g, ramp(u, 18, 0.5), () => {
        [['desert', 'dessert'], ['thirty', 'thirteen'], ['record:n', 'record:v']].forEach(([a, b], i) => {
          const x = 240 + i * 400;
          word(g, a, x - 12, 515, 22, { align: 'right', caps: true }); txt(g, '·', x, 515, { size: 20, color: COL.muted, align: 'center' }); word(g, b, x + 12, 515, 22, { caps: true });
        });
      });
      fade(g, ramp(u, 24, 0.5), () => txt(g, '목표 = 듣는 사람이 낱말을 쉽게 알아듣는 소리', 640, 565, { size: 17, weight: 700, color: COL.soft, align: 'center' }));
    },
  };
  WSS.SCENES = SCENES;

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

  WSS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[WSS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, WSS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + WS.allText() + MLAB.join('') + CUES.map(c => c[1] + c[2]).join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔⇢≈≠✓×?!~=+-–—/:…‘’\'%&<>|ɹɝɚəæɑɔɪʊʌɛŋθðʃʒˈˌms';
  WSS.baseText = EXTRA;
  WSS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = WSS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { WSS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
