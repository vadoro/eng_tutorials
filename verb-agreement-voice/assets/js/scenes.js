/* 수 일치와 능동·수동 튜토리얼 — 영상 장면
 *
 * VS.render(g, t)는 시각 t와 사용자 상태 VS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 영어 문장은 낱말 조각(토큰)으로 그리고, 역할마다 색을 칠합니다:
 *   진짜 주어 하늘 · 동사(답) 노랑 · 목적어·보어·수량 표현(단서) 보라 · 수식어 민트(지우면 회색 줄) · 함정 주황
 *   빈칸은 분홍 점선 상자, 수동태에서 비어 버린 목적어 자리도 분홍 점선.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(VA.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const VA = window.VA;
  const VS = (window.VS = {});
  const W = 1280, H = 720;
  VS.W = W; VS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  VS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  VS.COL = COL;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (VS.S = { sub: null, strip: false, q: null, vpair: 0, passive: null, path: null });
  VS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  VS.hits = () => HITS;

  // 글자를 그리는 곳은 모두 txt()를 지남 → 글꼴을 미리 받을 글자를 모을 수 있음
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
  function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  function fade(g, a, fn) { if (a <= 0.001) return; g.save(); g.globalAlpha *= Math.min(1, a); fn(); g.restore(); }
  function arrowHead(g, x, y, ang, color, s = 11) {
    g.fillStyle = color; g.beginPath(); g.moveTo(x, y);
    g.lineTo(x - Math.cos(ang - 0.45) * s, y - Math.sin(ang - 0.45) * s);
    g.lineTo(x - Math.cos(ang + 0.45) * s, y - Math.sin(ang + 0.45) * s); g.closePath(); g.fill();
  }
  function arrow(g, x0, y0, x1, y1, color, lw = 2.5) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - Math.cos(ang) * 8, y1 - Math.sin(ang) * 8); g.stroke();
    arrowHead(g, x1, y1, ang, color);
  }
  // 곡선 화살표 (위로 h만큼 휘어짐, p: 그려진 정도 0→1)
  function arc(g, x0, y0, x1, y1, h, color, p = 1, o = {}) {
    if (p <= 0.001) return;
    const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - h, N = 40, n = Math.max(2, Math.round(N * p));
    const pt = k => { const s = k / N; return [(1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * cx + s * s * x1, (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * cy + s * s * y1]; };
    g.save(); g.strokeStyle = color; g.lineWidth = o.lw || 2.4; g.lineCap = 'round';
    if (o.dash) g.setLineDash([7, 6]);
    g.beginPath(); for (let k = 0; k <= n; k++) { const [x, y] = pt(k); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.restore();
    if (p > 0.97 && o.head !== false) { const [ax, ay] = pt(N), [bx, by] = pt(N - 2); arrowHead(g, ax, ay, Math.atan2(ay - by, ax - bx), color, 12); }
  }
  function check(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x - s * 0.12, y + s * 0.4); g.lineTo(x + s * 0.55, y - s * 0.45); g.stroke();
  }
  function cross(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - s / 2, y - s / 2); g.lineTo(x + s / 2, y + s / 2); g.moveTo(x + s / 2, y - s / 2); g.lineTo(x - s / 2, y + s / 2); g.stroke();
  }
  function mark(g, ok, x, y, s = 16) { (ok ? check : cross)(g, x, y, s, ok ? COL.good : COL.bad); }
  // 둥근 상자 + 글
  function chip(g, s, x, y, o = {}) {
    const size = o.size || 18, w = tw(g, s, size, o.weight || 600, o.fam || FB) + (o.pad || 14) * 2, h = o.h || size * 2;
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    rr(g, x0, y - h / 2, w, h, o.r || h / 2);
    g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
    txt(g, s, x0 + w / 2, y + 1, { size, weight: o.weight || 600, color: o.color || COL.text, align: 'center', fam: o.fam });
    return { x: x0, y: y - h / 2, w, h };
  }
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; g.stroke(); }
  }
  const say = (x, y, w, h, text) => HITS.push({ x, y, w, h, say: text });
  // 수 표시: 하나 ● / 여럿 ●●●
  function numBadge(g, num, cx, y, a = 1, size = 15) {
    fade(g, a, () => {
      const label = num === 's' ? '하나' : '여럿', n = num === 's' ? 1 : 3, c = COL.ante, d = size * 0.34;
      const lw = tw(g, label, size, 700), dw = n * d * 2 + (n - 1) * d * 0.9, h = size * 1.85, w = dw + lw + size * 1.6;
      const x0 = cx - w / 2;
      rr(g, x0, y - h / 2, w, h, h / 2); g.fillStyle = 'rgba(16,21,28,0.92)'; g.fill(); g.strokeStyle = c; g.lineWidth = 1.3; g.stroke();
      let x = x0 + size * 0.6 + d;
      g.fillStyle = c;
      for (let i = 0; i < n; i++) { g.beginPath(); g.arc(x, y, d, 0, Math.PI * 2); g.fill(); x += d * 2.9; }
      txt(g, label, x0 + size * 0.6 + dw + size * 0.4, y + 1, { size, weight: 700, color: c });
    });
  }
  // 능동(보라: 목적어가 있음) · 수동(분홍: 목적어 자리가 빔)
  function voiceChip(g, v, cx, y, a = 1, size = 15, o = {}) {
    const c = v === 'act' ? COL.verb : COL.gap;
    fade(g, a, () => chip(g, o.text || (v === 'act' ? '능동' : '수동'), cx, y, { size, weight: 700, color: c, fill: 'rgba(16,21,28,0.92)', stroke: c, align: o.align || 'center', h: size * 1.85, pad: 12, lw: 1.3, dash: v === 'pass' }));
  }

  /* ---------- 영어 문장 토큰 배치와 그리기 ---------- */
  // 토큰 { id, t: 글자, r: 역할 }. 역할: subj 진짜 주어 · v 동사 · obj 목적어 · comp 보어 · q 수량 표현 · mod 수식어 · cue 단서
  //   trap 함정 · fn 기능어 · by 행위자 · blank 빈칸 · ans 채운 답 · gap 빈 목적어 자리 · bad 틀림 · '' 보통
  const RCOL = { subj: COL.ante, v: COL.rel, obj: COL.verb, comp: COL.verb, q: COL.verb, cue: COL.verb, mod: COL.clause, trap: COL.trap, fn: COL.muted, by: COL.muted, bad: COL.bad, good: COL.good, dim: COL.dim };
  const UNDER = { subj: 1, v: 1, obj: 1, comp: 1, q: 1 };
  const PUNCT = /^[.,?!]$/;
  const tokW = (g, tk, size) => Math.max(tk.minW ? tk.minW * size : 0, tokW0(g, tk, size));
  const tokW0 = (g, tk, size) => tk.r === 'blank' ? Math.max(size * 2.6, tk.t ? tw(g, tk.t, size, 700) + size * 0.7 : 0) :
    tk.r === 'ans' ? tw(g, tk.t, size, 700) + size * 0.7 : tk.r === 'gap' ? size * 2.4 : tw(g, tk.t, size, UNDER[tk.r] ? 600 : 500);
  // 한 줄(또는 maxW를 넘으면 여러 줄)로 배치. o: { x, y, size, align: 'left' | 'center', maxW, lh }
  function lay(g, toks, o) {
    const size = o.size || 34, sp = size * 0.34, maxW = o.maxW || 1e9, lh = o.lh || size * 1.65;
    const lines = [[]]; let x = 0;
    toks.forEach(tk => {
      const punct = PUNCT.test(tk.t) && tk.r !== 'blank', w = punct ? tw(g, tk.t, size, 500) : tokW(g, tk, size);
      const line = lines[lines.length - 1];
      if (!punct && line.length && x + sp + w > maxW) { lines.push([]); x = 0; }
      const cur = lines[lines.length - 1];
      if (cur.length) x += punct ? size * 0.05 : sp;   // 마침표 앞도 아주 조금 띄움 (상자와 덜 겹치게)
      cur.push(Object.assign({}, tk, { x, w, size }));
      x += w;
    });
    const items = [], byId = {};
    lines.forEach((l, li) => {
      const lw = l.length ? l[l.length - 1].x + l[l.length - 1].w : 0;
      const x0 = o.align === 'center' ? o.x - lw / 2 : o.x;
      l.forEach(it => { it.x += x0; it.y = o.y + li * lh; items.push(it); byId[it.id] = it; });
    });
    const left = Math.min(...items.map(i => i.x)), right = Math.max(...items.map(i => i.x + i.w));
    return { items, byId, size, lines: lines.length, x: left, w: right - left, y: o.y, h: (lines.length - 1) * lh + size * 1.3 };
  }
  // [[글자, 역할]] → 토큰. '___'는 빈칸
  function seq(list, pre = 't') {
    return list.map(([t, r, id], i) => ({ id: id || pre + i, t: t === '___' ? '' : t, r: t === '___' ? 'blank' : (r || '') }));
  }
  // 문장 속 글자들을 한 토큰으로 묶어 나눔. spec: [[글자, 역할, 표시]]
  function phraseToks(q, spec, pre = 'q') {
    const marks = [];
    spec.concat([['___', 'blank']]).forEach(([t, r, tag]) => { const i = t ? q.indexOf(t) : -1; if (i >= 0) marks.push({ s: i, e: i + t.length, t, r, tag }); });
    marks.sort((a, b) => a.s - b.s);
    const out = []; let at = 0;
    const push = (t, r, tag) => out.push({ id: pre + out.length, t, r, tag });
    const plain = s => s.split(' ').forEach(w => { if (!w) return; const m = w.match(/^(.*?)([.,?!]?)$/); if (m[1]) push(m[1], ''); if (m[2]) push(m[2], ''); });
    marks.forEach(m => { if (m.s < at) return; plain(q.slice(at, m.s)); push(m.r === 'blank' ? '' : m.t, m.r, m.tag); at = m.e; });
    plain(q.slice(at));
    return out;
  }
  const byText = (L, t) => L.items.find(i => i.t === t);
  const byTag = (L, tag) => L.items.find(i => i.tag === tag);
  const blankOf = L => L.items.find(i => i.r === 'blank' || i.r === 'ans');
  // 토큰 하나 그리기. o: { a, r: 역할 바꾸기, color, cue: 단서 상자, cueColor, glow: 빈칸 반짝임, plain: 밑줄 없이, strike: 0→1 줄 긋기 }
  function drawTok(g, it, o = {}) {
    const r = o.r != null ? o.r : it.r, size = it.size, x = it.x, y = it.y, w = it.w;
    g.save(); g.globalAlpha *= o.a == null ? 1 : o.a;
    if (g.globalAlpha <= 0.002) { g.restore(); return; }
    if (r === 'blank') {
      const h = size * 1.12;
      rr(g, x, y - h / 2, w, h, 8);
      g.fillStyle = `rgba(255,122,168,${0.08 + 0.12 * (o.glow || 0)})`; g.fill();
      g.setLineDash([6, 5]); g.strokeStyle = o.color || COL.gap; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]);
      if (it.t && !o.hide) txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: o.textColor || COL.rel, align: 'center' });
    } else if (r === 'ans') {
      const h = size * 1.22;
      rr(g, x, y - h / 2, w, h, 9);
      g.fillStyle = 'rgba(255,193,94,0.16)'; g.fill(); g.strokeStyle = COL.rel; g.lineWidth = 2; g.stroke();
      txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: COL.rel, align: 'center' });
    } else if (r === 'gap') {
      const h = size * 1.05;
      rr(g, x, y - h / 2, w, h, 8);
      g.fillStyle = `rgba(255,122,168,${0.06 + 0.14 * (o.glow || 0)})`; g.fill();
      g.setLineDash([6, 5]); g.strokeStyle = COL.gap; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]);
    } else {
      const c = o.color || RCOL[r] || COL.text;
      txt(g, it.t, x, y + 1, { size, weight: UNDER[r] ? 600 : 500, color: c });
      if (UNDER[r] && !o.plain) { g.fillStyle = c; g.fillRect(x, y + size * 0.56, w, 3); }
      if (r === 'bad') { g.strokeStyle = COL.bad; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x + w + 3, y + 2); g.stroke(); }
      if (o.strike > 0) { g.strokeStyle = o.strikeColor || COL.clause; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x - 3 + (w + 6) * clamp(o.strike), y + 2); g.stroke(); }
    }
    if (o.cue) { const pd = size * 0.13; rr(g, x - pd, y - size * 0.68, w + pd * 2, size * 1.36, 8); g.strokeStyle = o.cueColor || COL.verb; g.lineWidth = 2.2; if (o.cueDash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
    g.restore();
  }
  function drawLay(g, L, style) { L.items.forEach(it => drawTok(g, it, style ? style(it) || {} : {})); }
  // 두 배치 사이 (p: 0→1). 같은 id는 움직이고, 글자·역할이 다르면 겹쳐 바뀜
  function morph(g, A, B, p, o = {}) {
    const e = ease(clamp(p)), seen = new Set(), style = o.style || (() => ({}));
    const ids = A.items.map(i => i.id).concat(B.items.map(i => i.id)).filter(id => !seen.has(id) && seen.add(id));
    ids.forEach(id => {
      const a = A.byId[id], b = B.byId[id];
      if (a && b) {
        const lift = o.lift && Math.abs(b.x - a.x) > 60 ? Math.sin(Math.PI * e) * o.lift * (b.x < a.x ? -1 : 1) : 0;
        const m = Object.assign({}, b, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) - lift, w: lerp(a.w, b.w, e), size: lerp(a.size, b.size, e) });
        if (a.t === b.t && a.r === b.r) drawTok(g, m, style(b, e));
        else { drawTok(g, Object.assign({}, m, { t: a.t, r: a.r }), Object.assign({}, style(a, e), { a: 1 - e })); drawTok(g, m, Object.assign({}, style(b, e), { a: e })); }
      } else if (a) drawTok(g, a, Object.assign({}, style(a, e), { a: 1 - ramp(p, 0, 0.5) }));
      else drawTok(g, b, Object.assign({}, style(b, e), { a: ramp(p, 0.5, 0.5) }));
    });
  }
  function sayLay(L, text) { say(L.x - 8, L.y - L.size * 0.8, L.w + 16, L.h + L.size * 0.3, text); }
  // 토큰 아래 가운데에 작은 글
  function under(g, it, s, color, a = 1, dy = 44, size = 16) { fade(g, a, () => txt(g, s, it.x + it.w / 2, it.y + dy, { size, weight: 700, color, align: 'center' })); }
  // 토큰 여럿 아래 괄호 (수식어 표시). p: 그려진 정도
  function bracket(g, a, b, color, p = 1, dy = 30) {
    if (p <= 0.001) return;
    const x0 = a.x, x1 = b.x + b.w, y = a.y + dy, xe = lerp(x0, x1, clamp(p));
    g.strokeStyle = color; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y - 7); g.lineTo(x0, y); g.lineTo(xe, y); if (p >= 0.99) g.lineTo(x1, y - 7); g.stroke();
  }
  // 낱말을 조각내어 그림 (꼬리에 색). parts: [[글자, 색, 밑줄]] → 너비
  function pieces(g, parts, x, y, size, o = {}) {
    let w = 0; parts.forEach(([t, c]) => { w += tw(g, t, size, 600); });
    let xx = o.align === 'center' ? x - w / 2 : x;
    parts.forEach(([t, c, ul]) => {
      const ww = txt(g, t, xx, y, { size, weight: 600, color: c || COL.text });
      if (ul) { g.fillStyle = c; g.fillRect(xx, y + size * 0.56, ww, 3); }
      xx += ww;
    });
    return w;
  }
  // 칩을 한 줄로 늘어놓음 (글자 너비에 맞춰 간격 일정). 하나씩 나타남
  function chipRow(g, words, x, y, u, at, o = {}) {
    let xx = x, yy = y;
    words.forEach((w, k) => {
      const cw = tw(g, w, o.size || 17, 700) + (o.pad || 14) * 2;
      if (o.maxX && xx + cw > o.maxX) { xx = x; yy += (o.lh || 46); }
      const px = xx;
      fade(g, ramp(u, at + k * (o.step || 0.3), 0.4), () => chip(g, w, px, yy, { size: o.size || 17, weight: 700, color: o.color, fill: COL.panel, stroke: o.color, h: o.h || 36, r: 8, pad: o.pad || 14, dash: o.dash }));
      xx += cw + (o.gap || 12);
    });
    return xx;
  }
  // 토큰 둘레의 상자 (cue와 같은 여백)
  function boxTok(g, it, color, dash) {
    const pd = it.size * 0.13; rr(g, it.x - pd, it.y - it.size * 0.68, it.w + pd * 2, it.size * 1.36, 8);
    g.strokeStyle = color; g.lineWidth = 2.2; if (dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
  }
  // 두 줄 오른쪽의 세로 괄호 + 이름표
  function sideBrace(g, x, y0, y1, s, color) {
    g.strokeStyle = color; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y0 - 14); g.lineTo(x + 8, y0 - 14); g.lineTo(x + 8, y1 + 14); g.lineTo(x, y1 + 14); g.stroke();
    txt(g, s, x + 20, (y0 + y1) / 2, { size: 17, weight: 700, color });
  }
  // 보기 하나씩 ✓/× 목록 (까닭은 규칙 엔진)
  function tryList(g, items, x, y, u, at, o = {}) {
    items.forEach(([w, j], k) => {
      const a = ramp(u, at + k * (o.step || 0.9), 0.4), yy = y + k * (o.gap || 44);
      fade(g, a, () => {
        const ok = j.s === 'ok';
        mark(g, ok, x + 10, yy, 16);
        const ww = txt(g, w, x + 36, yy, { size: o.size || 24, weight: 600, color: ok ? COL.good : COL.muted });
        if (!ok) { g.strokeStyle = COL.bad; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 32, yy + 1); g.lineTo(x + 40 + ww, yy + 1); g.stroke(); }
        txt(g, ok ? '' : j.why, x + 36 + ww + 22, yy, { size: 16, weight: 500, color: COL.muted });
      });
    });
  }

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '동사 빈칸의 두 질문', d: 24, caps: [
      [0.4, 5, '토익 Part 5에는 동사의 알맞은 모양을 고르는 문제가 자주 나와요.'],
      [5, 10.5, '보기를 보세요. posted, was posted, were posted, was posting. 모두 같은 동사에서 나왔어요 → post.'],
      [10.5, 15.5, '고를 때 물어볼 것은 두 가지예요. 첫째, 진짜 주어가 **하나**인가, **여럿**인가?'],
      [15.5, 20, '둘째, 빈칸 뒤에 **목적어**가 있는가? 정답은 영상 끝에서 함께 풀어요.'],
      [20, 24, '**진짜 주어** 찾기, **수 일치**, **능동·수동**을 배우고 **3단계 풀이법**으로 묶어요.'],
    ] },
    { id: 'korean', n: '01', title: '주어를 따라 바뀌는 동사', sub: '한국어와 다른 점', d: 30, caps: [
      [0.4, 5.5, '한국어부터 볼까요? 그는 간다, 그들은 간다. 주어가 여럿이 되어도 동사는 그대로예요.'],
      [5.5, 11, '영어는 달라요. He goes. They go. 주어가 하나인지 여럿인지에 따라 동사의 모양이 바뀌어요.'],
      [11, 17, '이것을 **수 일치**라고 해요. 동사가 주어의 수, 곧 하나인지 여럿인지에 맞춰 모양을 바꾸는 거예요.'],
      [17, 23.5, '헷갈리는 점이 있어요. 명사 끝의 -s → **여럿**이라는 표시, 동사 끝의 -s → 주어가 **하나**라는 표시예요.'],
      [23.5, 30, '짝으로 기억해요. is · are, was · were, has · have. 앞은 주어가 하나, 뒤는 여럿일 때예요.'],
    ] },
    { id: 'subject', n: '02', title: '진짜 주어 찾기', sub: '수식어를 지우고 보기', d: 34, caps: [
      [0.4, 6, '주어가 길어지면 함정이 생겨요. The results of the survey ___ ready.'],
      [6, 12, '빈칸 바로 앞의 낱말은 하나뿐인 설문이에요 → survey. 그래서 단수 동사를 고르기 쉬워요.'],
      [12, 18, '앞의 명사를 꾸미는 말 → of the survey. 이런 **수식어**를 지우면 **진짜 주어**가 남아요 → results.'],
      [18, 23, '진짜 주어가 여럿이니까 복수 동사예요. The results of the survey are ready.'],
      [23, 29, '관계사절도 수식어예요. The employees who work in the lab → 진짜 주어 = employees.'],
      [29, 34, '전치사구, 관계사절, 분사구는 괄호로 묶어 지우고, 남은 주어와 동사를 이어 보세요.'],
    ] },
    { id: 'quantity', n: '03', title: '수를 정하는 앞말', sub: 'a number of · the number of · each', d: 34, caps: [
      [0.4, 6, '주어 앞에 붙은 수량 표현이 수를 정하기도 해요. 겉모양이 비슷해서 함정이 돼요.'],
      [6, 12, 'A number of applicants → 많은 지원자들. 뜻의 중심이 지원자들이라서 **복수** 동사예요.'],
      [12, 18, 'The number of applicants → 지원자의 수. 중심은 숫자 하나라서 **단수** 동사예요.'],
      [18, 24, 'each · every 뒤에는 단수 명사가 오고, 동사도 **단수**예요. Each employee has a badge.'],
      [24, 29, 'One of the printers → 여러 대 가운데 한 대. 진짜 주어 = One, 그래서 **단수**예요.'],
      [29, 34, '반대로 several, many, both 뒤에는 복수 명사와 **복수** 동사가 와요.'],
    ] },
    { id: 'single', n: '04', title: '덩어리 주어는 하나', sub: '동명사 · 명사절 · 셀 수 없는 명사', d: 30, caps: [
      [0.4, 6, '주어 자리에 동사 덩어리가 오기도 해요. Reviewing the reports takes time.'],
      [6, 12, '빈칸 바로 앞은 여럿이지만 → reports, 진짜 주어는 검토하는 **일 하나**예요. 그래서 단수 동사.'],
      [12, 18, '절이 주어일 때도 덩어리 하나예요. What the clients want is faster delivery.'],
      [18, 24, '셀 수 없는 명사도 **단수** 동사와 써요 → information, equipment, feedback, advice.'],
      [24, 30, '동명사, 명사절, 셀 수 없는 명사. 모두 하나로 세어서 단수 동사로 받아요.'],
    ] },
    { id: 'voice', n: '05', title: '하는 쪽, 당하는 쪽', sub: '능동태와 수동태', d: 31, caps: [
      [0.4, 6, '이제 두 번째 질문이에요. 주어가 그 일을 **하는** 쪽인가, **당하는** 쪽인가?'],
      [6, 12, 'The company announced the winners. 회사가 발표했어요. 주어가 하는 쪽이니 **능동태**예요.'],
      [12, 18, '목적어를 주어 자리로 올려 볼게요 → the winners. 동사는 be + 과거분사(p.p.)로 바뀌어요.'],
      [18, 24, 'The winners were announced. 당하는 쪽이 주어가 됐고, be동사의 수도 새 주어를 따라요. **수동태**예요.'],
      [24, 31, '목적어가 주어 자리로 올라갔으니, 수동태 동사 뒤에는 **목적어가 없어요**. 이것이 문제를 푸는 열쇠예요.'],
    ] },
    { id: 'object', n: '06', title: '빈칸 뒤를 보라', sub: '목적어가 있으면 능동, 없으면 수동', d: 32, caps: [
      [0.4, 6, '그래서 능동이냐 수동이냐는 빈칸 **뒤**를 보면 알 수 있어요.'],
      [6, 12, 'The judges will ___ the winners next week. 뒤에 목적어가 있어요 → 능동, announce.'],
      [12, 18, 'The winners will be ___ next week. 뒤에 목적어가 없어요 → 수동, announced.'],
      [18, 25, 'next week, by Friday, on the website 같은 시간·장소 표현은 목적어가 아니에요. 속지 마세요.'],
      [25, 32, '목적어는 동사의 일을 당하는 명사예요. 빈칸 바로 뒤에 관사나 명사가 오는지 보세요.'],
    ] },
    { id: 'remain', n: '07', title: '목적어가 남는 수동태', sub: '주는 동사 · consider', d: 34, caps: [
      [0.4, 6, '그런데 수동태 뒤에도 명사가 남는 경우가 있어요. 목적어를 두 개 갖는 동사예요.'],
      [6, 12, 'The company gave Ms. Lee a bonus. 사람에게, 물건을. 주는 동사는 목적어가 둘이에요.'],
      [12, 18, '사람을 주어로 올리면 Ms. Lee was given a bonus. 목적어 하나가 뒤에 그대로 남아요.'],
      [18, 23, 'give, offer, award, send, grant. 주는 동사 뒤에 명사가 **하나만** 남아 있으면 수동태예요.'],
      [23, 29, '목적어 뒤에 보어를 갖는 동사도 비슷해요. The directors consider the plan essential.'],
      [29, 34, '수동태로 바꾸면 The plan is considered essential. **보어만** 남으면 수동태예요.'],
    ] },
    { id: 'intrans', n: '08', title: '수동태가 없는 동사', sub: '자동사 occur · arise · rise', d: 32, caps: [
      [0.4, 6, '한국어로는 ‘문제가 발생되었다’라고도 말해요. 그래서 영어도 수동태로 쓰기 쉬워요.'],
      [6, 12, '하지만 A problem was occurred. 틀린 문장이에요. 목적어 없이 혼자 쓰는 동사, **자동사**이기 때문이에요.'],
      [12, 18, '수동태는 목적어가 주어 자리로 올라간 것이었죠. 목적어가 없으니 수동태도 만들 수 없어요.'],
      [18, 25, 'occur, happen, arise, rise, take place, emerge. 모두 능동으로만 써요. A problem occurred.'],
      [25, 32, '비슷한 짝도 조심해요. 오르다 = rise, 수동태가 없어요. 올리다 = raise, 수동태가 돼요. Prices were raised.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: '주어 → 수 → 뒤', d: 30, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11.5, '① **주어**를 찾아요. 수식어를 괄호로 묶어 지우고, 수량 표현과 덩어리 주어를 확인해요.'],
      [11.5, 18, '② **수**를 맞춰요. 하나면 is · has · -s, 여럿이면 are · have · 원형. 수가 틀린 보기를 지워요.'],
      [18, 24.5, '③ 빈칸 **뒤**를 봐요. 목적어가 있으면 능동, 없으면 수동. 자동사는 늘 능동이에요.'],
      [24.5, 30, '이 순서로 처음 본 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '처음 본 문제예요. ① 수식어를 지워요 → of the customer survey. 진짜 주어 = results.'],
      [6, 12, '② 진짜 주어가 여럿이니 복수 동사만 남겨요. 단수 동사는 탈락 → (B), (D).'],
      [12, 18, '③ 빈칸 뒤에는 장소·시간 표현뿐, 목적어가 없어요. 수동태가 정답 → (C) were posted.'],
      [18.4, 24.5, '두 번째 문제. ① 진짜 주어 = Ms. Kwon, 한 사람. ② 탈락 → 복수 (C), -ing 혼자인 (D).'],
      [24.5, 31, '③ 빈칸 뒤에 명사가 있어서 능동처럼 보여요 → a special bonus. 하지만 award = 주는 동사.'],
      [31, 37, '받는 사람이 주어이고 목적어 하나만 남았어요. 4형식 수동태, 정답은 (B) was awarded.'],
      [37.4, 43.5, '세 번째. ① The number of → 수를 말해요. 진짜 주어 = number, 하나예요.'],
      [43.5, 50, '② 단수 동사만 남겨요. 탈락 → 복수 (A), -ing 혼자인 (C).'],
      [50, 56, '③ rise = 수동태가 없는 자동사. 탈락 → (B) has been risen. 정답은 (D) has risen.'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 표', d: 22, caps: [
      [0.4, 6, '정리해요. 동사 빈칸은 두 가지를 물어요. 주어의 **수**, 그리고 **능동·수동**.'],
      [6, 12, '수식어를 지워 진짜 주어를 찾고, 하나면 단수 동사, 여럿이면 복수 동사.'],
      [12, 17, '빈칸 뒤에 목적어가 있으면 능동, 없으면 수동. 자동사는 수동태가 없어요.'],
      [17, 22, '아래에서 능동·수동 변환기와 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  VS.CHAPTERS = CHAPTERS; VS.CAPTIONS = CAPTIONS; VS.END = END;
  VS.POSTER = CHAPTERS.find(c => c.id === 'voice').t + 21;
  VS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  VS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(VA.DRILL)에서 세 개. ①에서 수식어를 지우고, ②에서 수가 틀린 보기, ③에서 태가 틀린 보기를 지움
  const PRACTICE = [
    { k: 0, at: [0.4, 6, 12], lines: ['수식어를 지우면 → results, 여럿', '여럿 → 복수만 · (B) (D) 탈락', '목적어 없음 → 수동 · (C) were posted'] },
    { k: 12, at: [0.4, 3.4, 6.3], lines: ['진짜 주어 = Ms. Kwon, 하나', '하나 → 단수만 · (C) (D) 탈락', 'award + 명사 하나 → 수동 · (B)'] },
    { k: 4, at: [0.4, 6.3, 12.8], lines: ['The number → 진짜 주어 = number', '하나 → 단수만 · (A) (C) 탈락', 'rise = 자동사, 수동 없음 · (D)'] },
  ];
  PRACTICE.forEach(p => {
    const it = VA.DRILL[p.k], L = 'ABCD';
    const at2 = it.opts.map((o, i) => VA.judgeOpt(it, i).step === 2 ? `(${L[i]})` : '').filter(Boolean).join(' ');
    if (!p.lines[1].includes(at2 + ' 탈락')) console.warn('[수 일치·능동 수동] 실전 문제 ② 탈락 표시가 규칙 엔진과 달라요:', it.q, at2);
    if (!p.lines[2].includes(`(${L[it.a]})`)) console.warn('[수 일치·능동 수동] 실전 문제 정답 표시가 데이터와 달라요:', it.q);
    it.opts.forEach((o, i) => { if ((VA.judgeOpt(it, i).s === 'ok') !== (i === it.a)) console.warn('[수 일치·능동 수동] 실전 문제가 규칙 엔진과 달라요:', it.q); });
  });
  // 연습 문제 → 토큰 (진짜 주어 · 수식어 · 수량 표현 · 빈칸 뒤 단서를 한 덩어리로)
  function drillToks(it, pre = 'q') {
    const sj = it.subj, spec = [[sj.head, 'subj', 'head']].concat((sj.mods || []).map((m, i) => [m, 'mod', 'mod' + i]));
    if (sj.quant) spec.push([sj.quant, 'q', 'quant']);
    if (it.cue) spec.push([it.cue, '', 'cue']);
    return phraseToks(it.q, spec, pre);
  }

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o)); }
  const fill = (T, word) => T.map(t => t.r === 'blank' && word ? Object.assign({}, t, { t: word, r: 'ans' }) : t);

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(같은 동사 post의 네 모양) → 두 질문 → 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '수 일치와 능동·수동', W / 2, 290, { size: 76, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Subject–Verb Agreement · Active & Passive', W / 2, 366, { size: 26, weight: 500, color: COL.muted, align: 'center' });
      });
      [['s'], ['p'], [null, 'act'], [null, 'pass']].forEach(([n, v], k) => {
        const a = ramp(u, 1.3 + k * 0.2, 0.4) * out1, x = W / 2 - 255 + k * 170, y = 456 + (1 - a) * 10;
        if (n) numBadge(g, n, x, y, a, 20); else voiceChip(g, v, x, y, a, 20);
      });
      const it = VA.DRILL[0];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 19, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 160, 1000, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 180, 198, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const L = lay(g, drillToks(it), { x: 180, y: 282, size: 30, maxW: 930, lh: 56 });
        const s1 = u > 10.6, s2 = u > 15.6;
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: s2 ? 0.5 + 0.5 * Math.sin(u * 4) : 0 }
          : tk.tag === 'head' ? (s1 ? { cue: true, cueColor: COL.ante } : { r: '' })
          : tk.tag === 'cue' ? (s2 ? { cue: true, cueColor: COL.verb, cueDash: true } : {}) : { r: '' });
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        const hd = byTag(L, 'head'), cu = byTag(L, 'cue');
        numBadge(g, 'p', hd.x + hd.w / 2, hd.y - 44, ramp(u, 11.2, 0.5), 15);
        fade(g, ramp(u, 16, 0.5), () => txt(g, '목적어가 있나?', cu.x + cu.w + 24, cu.y, { size: 19, weight: 700, color: COL.verb }));
        it.opts.forEach(([o], k) => {
          const ox = 200 + (k % 2) * 400, oy = 420 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            txt(g, o, ox + 64, oy, { size: 30, weight: 600 });
            const i = o.indexOf('post'), x0 = ox + 64 + tw(g, o.slice(0, i), 30, 600), rw = tw(g, 'post', 30, 600);
            fade(g, ramp(u, 9 + k * 0.15, 0.4), () => { g.fillStyle = COL.rel; g.fillRect(x0, oy + 19, rw, 3); });
          });
        });
        fade(g, ramp(u, 9.6, 0.5), () => chip(g, '모두 같은 동사 post', 1010, 451, { size: 18, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 36 }));
      });
      const steps = [['①', '진짜 주어', '수식어를 지우고 찾기'], ['②', '수 일치', '하나 → is · 여럿 → are'], ['③', '능동 · 수동', '빈칸 뒤에 목적어?']];
      steps.forEach(([n, t1, t2], k) => {
        const a = ramp(u, 19.6 + k * 0.7, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 220, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 285 + (1 - a) * 16, { size: 34, weight: 700, color: COL.accent });
          txt(g, t1, x0 + 28, 345 + (1 - a) * 16, { size: 25, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 400 + (1 - a) * 16, { size: 19, weight: 500, color: COL.en });
        });
      });
    },

    /* 01 주어를 따라 바뀌는 동사: 한국어(그대로) ↔ 영어(바뀜) → 명사 -s와 동사 -s → 짝 */
    korean(g, u) {
      const two = S.sub != null ? VA.SUBS[S.sub] : VA.SUBS[1];
      const rows = [VA.SUBS[0], two];
      // 한국어
      fade(g, ramp(u, 0.3, 0.6), () => {
        panel(g, LX, 150, 540, 200, { fill: COL.panel, stroke: COL.faint });
        label(g, '한국어', LX + 24, 180, { size: 17, color: COL.soft });
      });
      const kw = Math.max(...rows.map(r => tw(g, r.ko, 32, 600)));
      rows.forEach((r, k) => fade(g, ramp(u, 0.8 + k * 1.4, 0.5), () => {
        const y = 236 + k * 64;
        txt(g, r.ko, LX + 24, y, { size: 32, weight: 600, color: COL.ante });
        txt(g, '간다.', LX + 24 + kw + 16, y, { size: 32, weight: 600, color: COL.text });
        numBadge(g, r.n, LX + 460, y, ramp(u, 11.4, 0.5), 15);
      }));
      fade(g, ramp(u, 3.4, 0.5), () => sideBrace(g, LX + 24 + kw + 16 + tw(g, '간다.', 32, 600) + 18, 236, 300, '그대로', COL.muted));
      // 영어
      fade(g, ramp(u, 5.6, 0.6), () => {
        panel(g, 660, 150, 540, 200, { fill: COL.panel, stroke: COL.faint });
        label(g, '영어', 684, 180, { size: 17, color: COL.soft });
      });
      const ew = Math.max(...rows.map(r => tw(g, r.en, 32, 600)));
      rows.forEach((r, k) => fade(g, ramp(u, 6 + k * 1.4, 0.5), () => {
        const y = 236 + k * 64, vx = 684 + ew + 16;
        txt(g, r.en, 684, y, { size: 32, weight: 600, color: COL.ante });
        const vw = pieces(g, r.n === 's' ? [['go', COL.rel], ['es', COL.rel, true], ['.', COL.text]] : [['go', COL.rel], ['.', COL.text]], vx, y, 32);
        const ap = ramp(u, 11.6 + k * 0.4, 0.8);
        if (ap > 0) arc(g, 684 + tw(g, r.en, 32, 600) / 2, y - 22, vx + (vw - 10) / 2, y - 22, 16, COL.rel, ap, { lw: 2 });
        numBadge(g, r.n, 1140, y, ramp(u, 11.4, 0.5), 15);
      }));
      fade(g, ramp(u, 9, 0.5), () => sideBrace(g, 684 + ew + 16 + tw(g, 'goes.', 32, 600) + 18, 236, 300, '바뀜', COL.rel));
      say(670, 205, 380, 130, rows.map(r => `${r.en} ${r.n === 's' ? 'goes' : 'go'}.`).join(' '));
      // 명사 -s와 동사 -s
      const outA = 1 - ramp(u, 23.4, 0.5);
      fade(g, ramp(u, 17.2, 0.6) * outA, () => {
        const y1 = 418, y2 = 492;
        pieces(g, [['The ', COL.muted], ['manager', COL.ante], [' approve', COL.rel], ['s', COL.rel, true], [' the budget.', COL.text]], LX + 20, y1, 32);
        pieces(g, [['The ', COL.muted], ['manager', COL.ante], ['s', COL.ante, true], [' approve', COL.rel], [' the budget.', COL.text]], LX + 20, y2, 32);
        fade(g, ramp(u, 18.6, 0.5), () => chip(g, '동사 끝 -s → 주어가 하나', 1200, y1, { size: 18, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'right', h: 40, r: 10 }));
        fade(g, ramp(u, 20.2, 0.5), () => chip(g, '명사 끝 -s → 여럿', 1200, y2, { size: 18, weight: 700, color: COL.ante, fill: COL.panel2, stroke: COL.ante, align: 'right', h: 40, r: 10 }));
        say(LX, y1 - 26, 640, 52, 'The manager approves the budget.'); say(LX, y2 - 26, 640, 52, 'The managers approve the budget.');
      });
      // 짝
      fade(g, ramp(u, 23.8, 0.6), () => {
        numBadge(g, 's', LX + 60, 430, 1, 18); numBadge(g, 'p', LX + 72, 506, 1, 18);
        [['is', 'are'], ['was', 'were'], ['has', 'have'], ['approves', 'approve']].forEach(([a, b], k) => fade(g, ramp(u, 24.4 + k * 0.6, 0.5), () => {
          const x = 330 + k * 220;
          txt(g, a, x, 430, { size: 32, weight: 700, color: COL.rel, align: 'center' });
          txt(g, b, x, 506, { size: 32, weight: 700, color: COL.rel, align: 'center' });
          g.fillStyle = COL.faint; g.fillRect(x - 60, 467, 120, 1.5);
        }));
      });
    },

    /* 02 진짜 주어 찾기: 바로 앞 명사의 함정 → 수식어 괄호 → 지우기 → 진짜 주어와 동사 잇기 */
    subject(g, u) {
      const A = seq([['The', 'fn', 'a0'], ['results', 'subj', 'a1'], ['of the', 'mod', 'a2'], ['survey', 'mod', 'a3'], ['___', '', 'a4'], ['ready', '', 'a5'], ['.', '', 'a6']]);
      const B = seq([['The', 'fn', 'b0'], ['employees', 'subj', 'b1'], ['who work in the', 'mod', 'b2'], ['lab', 'mod', 'b3'], ['___', '', 'b4'], ['safety glasses', 'obj', 'b5'], ['.', '', 'b6']]);
      const fA = u > 18.4 || S.strip, fB = u > 26.6 || S.strip;
      const TA = fill(A, fA ? 'are' : ''), TB = fill(B, fB ? 'wear' : '');
      const LA = lay(g, TA, { x: W / 2, y: 222, size: 38, align: 'center' });
      const LB = lay(g, TB, { x: W / 2, y: 410, size: 34, align: 'center' });
      const LAs = lay(g, TA.filter(t => t.r !== 'mod'), { x: W / 2, y: 222, size: 38, align: 'center' });
      const LBs = lay(g, TB.filter(t => t.r !== 'mod'), { x: W / 2, y: 410, size: 34, align: 'center' });
      const trapA = u > 6.2 && u < 12.4 && !S.strip, colA = u > 12.2, kA = ramp(u, 13.8, 1.2);
      const styleA = tk => tk.r === 'blank' ? { glow: fA ? 0 : 0.5 } : tk.r === 'subj' ? (colA ? {} : { r: '' }) :
        tk.r === 'mod' ? (tk.id === 'a3' && trapA ? { color: COL.trap } : colA ? { color: kA > 0.5 ? COL.dim : COL.clause, strike: kA } : { r: '' }) : {};
      fade(g, ramp(u, 0.4, 0.6), () => {
        if (S.strip) morph(g, LA, LAs, 1, { style: styleA }); else drawLay(g, LA, styleA);
        sayLay(LA, 'The results of the survey are ready.');
      });
      const L1 = S.strip ? LAs : LA, bk = blankOf(L1), rs = L1.byId.a1;
      if (!S.strip) {
        const sv = LA.byId.a3;
        fade(g, ramp(u, 6.4, 0.5) * (1 - ramp(u, 12.2, 0.4)), () => {
          arc(g, sv.x + sv.w / 2, sv.y - 26, bk.x + bk.w / 2, bk.y - 26, 26, COL.trap, ramp(u, 6.6, 0.6), { dash: true });
          chip(g, '바로 앞은 하나 → is?', sv.x + sv.w / 2, sv.y + 52, { size: 17, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'center', h: 36, r: 10 });
        });
        fade(g, ramp(u, 12.4, 0.4), () => {
          bracket(g, LA.byId.a2, LA.byId.a3, COL.clause, ramp(u, 12.4, 0.8), 30);
          under(g, { x: LA.byId.a2.x, w: LA.byId.a3.x + LA.byId.a3.w - LA.byId.a2.x, y: LA.y }, '수식어 · 지우기', COL.clause, ramp(u, 13, 0.4), 56, 16);
        });
      }
      fade(g, ramp(u, 14.6, 0.5), () => {
        under(g, rs, '진짜 주어', COL.ante, 1, 56, 16);
        numBadge(g, 'p', rs.x + rs.w / 2, rs.y + 92, 1, 15);
        arc(g, rs.x + rs.w / 2, rs.y - 30, bk.x + bk.w / 2, bk.y - 30, 34, COL.ante, ramp(u, 15.6, 1));
      });
      fade(g, ramp(u, 18.6, 0.5), () => mark(g, true, L1.x + L1.w + 30, L1.y, 18));
      // 두 번째: 관계사절
      fade(g, ramp(u, 23.2, 0.6), () => {
        const kB = S.strip ? 1 : ramp(u, 25, 1.2);
        const styleB = tk => tk.r === 'blank' ? { glow: fB ? 0 : 0.5 } : tk.r === 'mod' ? { color: kB > 0.5 ? COL.dim : COL.clause, strike: kB } : {};
        if (S.strip) morph(g, LB, LBs, 1, { style: styleB }); else drawLay(g, LB, styleB);
        sayLay(LB, 'The employees who work in the lab wear safety glasses.');
        const L2 = S.strip ? LBs : LB, em = L2.byId.b1, bk2 = blankOf(L2);
        if (!S.strip) {
          bracket(g, LB.byId.b2, LB.byId.b3, COL.clause, ramp(u, 23.8, 0.8), 28);
          under(g, { x: LB.byId.b2.x, w: LB.byId.b3.x + LB.byId.b3.w - LB.byId.b2.x, y: LB.y }, '관계사절 · 지우기', COL.clause, ramp(u, 24.2, 0.4), 52, 16);
        }
        under(g, em, '진짜 주어', COL.ante, ramp(u, 25.6, 0.4), 52, 16);
        arc(g, em.x + em.w / 2, em.y - 28, bk2.x + bk2.w / 2, bk2.y - 28, 30, COL.ante, ramp(u, 25.8, 1));
        numBadge(g, 'p', em.x + em.w / 2, em.y + 86, ramp(u, 26.2, 0.4), 14);
        if (fB) mark(g, true, L2.x + L2.w + 28, L2.y, 18);
      });
      fade(g, ramp(u, 27.4, 0.5), () => txt(g, 'who 뒤의 동사도 앞 명사를 따라요 → who work (T01)', W - 80, 500, { size: 16, weight: 600, color: COL.muted, align: 'right' }));
      // 지울 수식어 세 가지
      const kinds = [['전치사구', 'of ~ · in ~ · for ~'], ['관계사절', 'who ~ · that ~ · which ~'], ['분사구', '-ing ~ · -ed ~']];
      let x = LX;
      kinds.forEach(([k, e], i) => fade(g, ramp(u, 29.2 + i * 0.5, 0.5), () => {
        const c = chip(g, `${k}  ${e}`, x, 548, { size: 17, weight: 700, color: COL.clause, fill: COL.panel, stroke: COL.clause, h: 40, r: 10 });
        x = c.x + c.w + 14;
      }));
      fade(g, ramp(u, 30.8, 0.5), () => txt(g, '→ 지우고 주어 + 동사', W - 80, 548, { size: 19, weight: 700, color: COL.accent, align: 'right' }));
    },

    /* 03 수를 정하는 앞말: a number of(복수) ↔ the number of(단수) → each · one of · several */
    quantity(g, u) {
      const key = S.q || 'anum', Q = VA.QUANT[key], num = VA.SUBJ[Q.kind].num, verb = num === 's' ? 'has' : 'have';
      // 위 줄 (직접 해 보기로 바뀜)
      let spec;
      if (Q.kind === 'thenum') spec = [['The number', 'subj', 'h'], ['of applicants', 'mod', 'm']];
      else if (Q.kind === 'oneof') spec = [[Q.t.split(' ')[0], 'subj', 'h'], [Q.t.split(' ').slice(1).join(' ') + ' ' + Q.noun, 'mod', 'm']];
      else spec = [[Q.t, 'q', 'qq'], [Q.noun, 'subj', 'h']];
      const fA = u > 9.2 || S.q;
      const TA = seq(spec.concat([[fA ? verb : '___', fA ? 'ans' : '', 'v'], ['called', '', 'c'], ['.', '', 'd']]).map(([t, r, id]) => [t, r, 'A' + id]));
      const LA = lay(g, TA, { x: LX, y: 200, size: 34 });
      fade(g, ramp(u, 0.6, 0.6), () => {
        drawLay(g, LA, tk => tk.r === 'mod' ? { color: COL.dim, strike: 1 } : {});
        sayLay(LA, `${Q.t} ${Q.noun} ${verb} called.`);
        const qq = LA.byId.Aqq, h = LA.byId.Ah, m = LA.byId.Am;
        if (qq) under(g, qq, Q.mean, COL.verb, ramp(u, 6.4, 0.5), 44, 17);
        if (m) under(g, m, '지우기', COL.dim, ramp(u, 6.4, 0.5), 44, 16);
        if (!qq) under(g, h, Q.mean, COL.ante, ramp(u, 6.4, 0.5), 44, 17);
        else under(g, h, '진짜 주어', COL.ante, ramp(u, 6.8, 0.5), 44, 16);
        numBadge(g, num, LA.x + LA.w + 104, LA.y, ramp(u, 7.4, 0.5), 15);
        if (fA) mark(g, true, LA.x + LA.w + 28, LA.y, 18);
      });
      // 아래 줄: the number of
      const fB = u > 16.2;
      const TB = seq([['The number', 'subj', 'Bh'], ['of applicants', 'mod', 'Bm'], [fB ? 'has' : '___', fB ? 'ans' : '', 'Bv'], ['doubled', '', 'Bc'], ['.', '', 'Bd']]);
      const LB = lay(g, TB, { x: LX, y: 330, size: 34 });
      fade(g, ramp(u, 12.2, 0.6), () => {
        const k = ramp(u, 13.6, 1);
        drawLay(g, LB, tk => tk.r === 'mod' ? { color: k > 0.5 ? COL.dim : COL.clause, strike: k } : {});
        sayLay(LB, 'The number of applicants has doubled.');
        const h = LB.byId.Bh;
        under(g, h, '= ~의 수 (숫자 하나)', COL.ante, ramp(u, 13, 0.5), 44, 17);
        numBadge(g, 's', LB.x + LB.w + 104, LB.y, ramp(u, 14.6, 0.5), 15);
        if (fB) mark(g, true, LB.x + LB.w + 28, LB.y, 18);
      });
      fade(g, ramp(u, 13.2, 0.6), () => chip(g, '모양은 비슷, 수는 반대', 1200, 265, { size: 18, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'right', h: 40, r: 10 }));
      // 카드 세 장
      const cards = [
        { at: 18.2, head: 'each · every + 단수 명사', parts: [['Each employee ', COL.ante], ['has', COL.rel, true], [' a badge.', COL.text]], n: 's', say: 'Each employee has a badge.' },
        { at: 24.2, head: 'one of the + 복수 명사', parts: [['One', COL.ante], [' of the printers ', COL.dim], ['is', COL.rel, true], [' broken.', COL.text]], n: 's', say: 'One of the printers is broken.' },
        { at: 29.2, head: 'several · many · both + 복수', parts: [['Several guests ', COL.ante], ['have', COL.rel, true], [' left.', COL.text]], n: 'p', say: 'Several guests have left.' },
      ];
      cards.forEach((c, i) => fade(g, ramp(u, c.at, 0.6), () => {
        const x = LX + i * 380, y = 420;
        panel(g, x, y, 360, 144, { fill: COL.panel, stroke: COL.faint });
        txt(g, c.head, x + 20, y + 32, { size: 17, weight: 700, color: COL.verb });
        pieces(g, c.parts, x + 20, y + 80, 22);
        numBadge(g, c.n, x + 52, y + 118, 1, 14);
        say(x, y + 60, 360, 50, c.say);
      }));
    },

    /* 04 덩어리 주어는 하나: 동명사 · 명사절 · 셀 수 없는 명사 */
    single(g, u) {
      const f1 = u > 9.6, f2 = u > 15.4;
      const T1 = seq([['Reviewing', 'subj', 'g0'], ['the reports', u > 6.2 && u < 9.4 ? 'trap' : '', 'g1'], [f1 ? 'takes' : '___', f1 ? 'ans' : '', 'g2'], ['time', '', 'g3'], ['.', '', 'g4']]);
      const L1 = lay(g, T1, { x: LX, y: 200, size: 36 });
      fade(g, ramp(u, 0.4, 0.6), () => {
        drawLay(g, L1, tk => tk.r === 'blank' ? { glow: 0.5 } : tk.id === 'g1' && u >= 9.4 ? { color: COL.ante } : {});
        sayLay(L1, 'Reviewing the reports takes time.');
        const a = L1.byId.g0, b = L1.byId.g1;
        fade(g, ramp(u, 6.4, 0.5) * (1 - ramp(u, 9.4, 0.4)), () => txt(g, '바로 앞은 여럿?', b.x + b.w / 2, b.y - 44, { size: 17, weight: 700, color: COL.trap, align: 'center' }));
        bracket(g, a, b, COL.ante, ramp(u, 8.6, 0.8), 32);
        fade(g, ramp(u, 9, 0.5), () => {
          txt(g, '하는 일 하나', a.x, a.y + 58, { size: 17, weight: 700, color: COL.ante });
          numBadge(g, 's', a.x + tw(g, '하는 일 하나', 17, 700) + 52, a.y + 58, 1, 14);
        });
        if (f1) mark(g, true, L1.x + L1.w + 28, L1.y, 18);
      });
      const T2 = seq([['What the clients want', '', 'w0'], [f2 ? 'is' : '___', f2 ? 'ans' : '', 'w1'], ['faster delivery', '', 'w2'], ['.', '', 'w3']]);
      const L2 = lay(g, T2, { x: LX, y: 330, size: 36 });
      fade(g, ramp(u, 12.2, 0.6), () => {
        drawLay(g, L2, tk => tk.r === 'blank' ? { glow: 0.5 } : tk.id === 'w0' && u > 13.2 ? { color: COL.ante } : {});
        sayLay(L2, 'What the clients want is faster delivery.');
        const a = L2.byId.w0;
        bracket(g, a, a, COL.ante, ramp(u, 13.4, 0.8), 32);
        fade(g, ramp(u, 13.8, 0.5), () => {
          txt(g, '절 덩어리 하나', a.x, a.y + 58, { size: 17, weight: 700, color: COL.ante });
          numBadge(g, 's', a.x + tw(g, '절 덩어리 하나', 17, 700) + 52, a.y + 58, 1, 14);
        });
        if (f2) mark(g, true, L2.x + L2.w + 28, L2.y, 18);
      });
      // 셀 수 없는 명사
      fade(g, ramp(u, 18.2, 0.5), () => { g.fillStyle = COL.faint; g.fillRect(LX, 432, W - 2 * LX, 1); label(g, '셀 수 없는 명사', LX, 470, { size: 18, color: COL.soft }); });
      chipRow(g, ['information', 'equipment', 'feedback', 'advice', 'furniture', 'luggage'], LX + 170, 470, u, 18.6, { color: COL.ante, size: 18, pad: 14, h: 38 });
      fade(g, ramp(u, 21, 0.6), () => {
        const y = 534;
        pieces(g, [['The new ', COL.muted], ['equipment', COL.ante, true], [' is', COL.rel, true], [' ready.', COL.text]], LX, y, 28);
        say(LX - 6, y - 22, 360, 46, 'The new equipment is ready.');
        mark(g, false, 520, y, 15);
        const w = txt(g, 'equipments', 544, y, { size: 24, weight: 600, color: COL.muted });
        g.strokeStyle = COL.bad; g.lineWidth = 2.2; g.beginPath(); g.moveTo(540, y + 1); g.lineTo(548 + w, y + 1); g.stroke();
        txt(g, '셀 수 없어서 -s를 붙이지 않아요', 566 + w, y, { size: 16, weight: 600, color: COL.muted });
      });
      fade(g, ramp(u, 24.4, 0.6), () => chip(g, '동명사 · 명사절 · 셀 수 없는 명사 → 단수', W - 80, 112, { size: 17, weight: 700, color: COL.ante, fill: COL.panel2, stroke: COL.ante, align: 'right', h: 38, r: 10 }));
    },

    /* 05 하는 쪽, 당하는 쪽: 능동 → 목적어를 주어로 → 수동 (be + p.p.) → 목적어 자리가 빔 */
    voice(g, u) {
      const P = VA.PAIRS[S.vpair || 0];
      const A = VA.build(P, { voice: 'act' }), Bb = VA.build(P, { voice: 'pass', by: true }), Bn = VA.build(P, { voice: 'pass', by: false });
      const gapT = Bn.toks.slice(0, -1).concat([{ id: 'GAP', t: '', r: 'gap' }, Bn.toks[Bn.toks.length - 1]]);
      const LA = lay(g, A.toks, { x: W / 2, y: 236, size: 40, align: 'center' });
      const LB = lay(g, Bb.toks, { x: W / 2, y: 236, size: 40, align: 'center' });
      const LG = lay(g, gapT, { x: W / 2, y: 236, size: 40, align: 'center' });
      const ov = S.passive;
      const p1 = ov == null ? ramp(u, 12.6, 1.8) : ov ? 1 : 0, p2 = ov == null ? ramp(u, 22.4, 1.2) : ov ? 1 : 0;
      const sty = tk => tk.r === 'gap' ? { glow: 0.5 + 0.5 * Math.sin(u * 4) } : {};
      fade(g, ramp(u, 0.4, 0.6), () => {
        if (p1 <= 0) drawLay(g, LA, sty);
        else if (p2 <= 0) morph(g, LA, LB, p1, { lift: 34, style: sty });
        else morph(g, LB, LG, p2, { style: sty });
        if (p1 < 0.5) sayLay(LA, A.text); else sayLay(p2 < 0.5 ? LB : LG, p2 < 0.5 ? Bb.text : Bn.text);
      });
      // 능동의 이름표
      const actA = (ov == null ? ramp(u, 6.2, 0.5) : ov ? 0 : 1) * (1 - p1);
      if (actA > 0) {
        const s = LA.byId.S, o = LA.byId.O0;
        under(g, s, '하는 쪽 · 주어', COL.ante, actA, 54, 17);
        under(g, o, '당하는 쪽 · 목적어', COL.verb, actA, 54, 17);
        fade(g, actA, () => arc(g, s.x + s.w / 2, s.y - 32, o.x + o.w / 2, o.y - 32, 40, COL.verb, ov == null ? ramp(u, 7.4, 1) : 1));
        voiceChip(g, 'act', W / 2, 330, actA, 18, { text: '능동태' });
      }
      // 수동의 이름표
      const L = p2 > 0.5 ? LG : LB, pa = (ov == null ? ramp(u, 15, 0.5) : ov ? 1 : 0) * (p1 >= 1 ? 1 : 0);
      if (pa > 0) {
        const s = L.byId.O0, va = L.byId.VA, vm = L.byId.VM;
        under(g, s, '당하는 쪽 → 주어', COL.ante, pa, 54, 17);
        under(g, { x: va.x, w: vm.x + vm.w - va.x, y: va.y }, 'be + 과거분사', COL.rel, pa, 54, 17);
        numBadge(g, Bn.num, s.x + s.w / 2, s.y - 50, ov == null ? ramp(u, 18.2, 0.5) : 1, 15);
        fade(g, ov == null ? ramp(u, 18.8, 0.5) : 1, () => arc(g, s.x + s.w / 2 + 40, s.y - 50, va.x + va.w / 2, va.y - 30, 14, COL.ante, ov == null ? ramp(u, 18.8, 0.8) : 1, { lw: 2 }));
        const by = LB.byId.S;
        if (p2 < 1) under(g, by, '누가 했는지 (자주 생략)', COL.muted, pa * (1 - p2), 54, 16);
        const gp = L.byId.GAP;
        if (gp) under(g, gp, '목적어 자리 → 비었어요', COL.gap, p2 * (ov == null ? ramp(u, 23.6, 0.5) : 1), 54, 17);
        voiceChip(g, 'pass', W / 2, 330, pa, 18, { text: '수동태' });
      }
      // 아래: 한국어 · 공식
      fade(g, ramp(u, 8, 0.6), () => {
        panel(g, LX, 392, 540, 168, { fill: COL.panel, stroke: COL.faint });
        label(g, '한국어', LX + 24, 420, { size: 16, color: COL.soft });
        txt(g, P.ko[0], LX + 24, 462, { size: 22, weight: 600 });
        fade(g, ov == null ? ramp(u, 13.4, 0.6) : ov ? 1 : 0.35, () => txt(g, P.ko[1], LX + 24, 504, { size: 22, weight: 600, color: COL.ante }));
        fade(g, ov == null ? ramp(u, 14.4, 0.6) : 1, () => txt(g, '한국어는 -되다 · -받다 · -지다로 수동을 나타내요', LX + 24, 540, { size: 15, weight: 500, color: COL.muted }));
      });
      fade(g, ramp(u, 15.6, 0.6), () => {
        panel(g, 660, 392, 540, 168, { fill: COL.panel, stroke: COL.faint });
        label(g, '영어의 수동태', 684, 420, { size: 16, color: COL.soft });
        txt(g, 'be동사 + 과거분사(p.p.)', 684, 462, { size: 22, weight: 700, color: COL.rel });
        const pre = A.vp, post = Bn.vp;
        txt(g, `${pre}  →  ${post}`, 684, 504, { size: 22, weight: 600, color: COL.en });
        txt(g, 'be동사의 수 = 새 주어의 수', 684, 540, { size: 15, weight: 500, color: COL.muted });
      });
    },

    /* 06 빈칸 뒤를 보라: 목적어가 있으면 능동, 없으면 수동 (시간·장소 표현은 목적어가 아님) */
    object(g, u) {
      const c1 = { num: '*', vt: 'vt', after: 'obj' }, c2 = { num: '*', vt: 'vt', after: 'none' };
      const f1 = u > 10.2, f2 = u > 16.2;
      const T1 = seq([['The judges', 'subj', 'p0'], ['will', '', 'p1'], [f1 ? 'announce' : '___', f1 ? 'ans' : '', 'p2'], ['the winners', u > 7.6 ? 'obj' : '', 'p3'], ['next week', '', 'p4'], ['.', '', 'p5']]);
      const L1 = lay(g, T1, { x: LX, y: 196, size: 32 });
      fade(g, ramp(u, 0.4, 0.6), () => {
        drawLay(g, L1, tk => tk.r === 'blank' ? { glow: 0.5 } : tk.id === 'p3' && u > 7.6 ? { cue: true } : {});
        sayLay(L1, 'The judges will announce the winners next week.');
        scan(g, blankOf(L1), L1.byId.p3, u, 6.4);
        under(g, L1.byId.p3, '목적어', COL.verb, ramp(u, 7.8, 0.4), 44, 16);
        voiceChip(g, 'act', 1200, 196, ramp(u, 8.6, 0.5), 17, { text: '목적어 있음 → 능동', align: 'right' });
      });
      tryList(g, [['announce', VA.judge('a.*', c1)], ['be announced', VA.judge('p.*', c1)]], LX + 10, 270, u, 10.4, { step: 0.8, size: 22 });
      const T2 = seq([['The winners', 'subj', 'r0'], ['will be', '', 'r1'], [f2 ? 'announced' : '___', f2 ? 'ans' : '', 'r2'], ['next week', u > 13.6 ? 'trap' : '', 'r3'], ['.', '', 'r4']]);
      const L2 = lay(g, T2, { x: LX, y: 380, size: 32 });
      fade(g, ramp(u, 12.2, 0.6), () => {
        drawLay(g, L2, tk => tk.r === 'blank' ? { glow: 0.5 } : tk.id === 'r3' && u > 13.6 ? { cue: true, cueColor: COL.trap, cueDash: true } : {});
        sayLay(L2, 'The winners will be announced next week.');
        scan(g, blankOf(L2), L2.byId.r3, u, 12.6);
        under(g, L2.byId.r3, '시간 표현 · 목적어 아님', COL.trap, ramp(u, 13.8, 0.4), 44, 16);
        voiceChip(g, 'pass', 1200, 380, ramp(u, 14.6, 0.5), 17, { text: '목적어 없음 → 수동', align: 'right' });
      });
      tryList(g, [['announced', VA.judge('p.*', c2)], ['announcing', VA.judge('a.*', c2)]], LX + 10, 454, u, 16.4, { step: 0.8, size: 22 });
      fade(g, ramp(u, 18.4, 0.5), () => label(g, '목적어가 아닌 말', 760, 454, { size: 17, color: COL.trap }));
      chipRow(g, ['next week', 'by Friday', 'on the website', 'yesterday', 'carefully'], 760, 500, u, 18.8, { size: 16, pad: 10, h: 34, color: COL.trap, dash: true, maxX: 1200, step: 0.35 });
      fade(g, ramp(u, 25.2, 0.6), () => chip(g, '목적어 = 동사의 일을 당하는 명사', W - 80, 112, { size: 17, weight: 700, color: COL.verb, fill: COL.panel2, stroke: COL.verb, align: 'right', h: 38, r: 10 }));
    },

    /* 07 목적어가 남는 수동태: 주는 동사(4형식) · consider(5형식) */
    remain(g, u) {
      const G = VA.pair('give'), C = VA.pair('consider');
      const GA = VA.build(G, { voice: 'act' }), GB = VA.build(G, { voice: 'pass', by: false });
      const CA = VA.build(C, { voice: 'act' }), CB = VA.build(C, { voice: 'pass', by: false });
      const LA = lay(g, GA.toks, { x: W / 2, y: 200, size: 34, align: 'center' }), LB = lay(g, GB.toks, { x: W / 2, y: 200, size: 34, align: 'center' });
      const p = ramp(u, 12.4, 1.8);
      fade(g, ramp(u, 0.4, 0.6), () => {
        if (p <= 0) drawLay(g, LA); else morph(g, LA, LB, p, { lift: 30 });
        if (p < 0.5) sayLay(LA, GA.text); else sayLay(LB, GB.text);
      });
      if (p < 1) {
        const a = ramp(u, 6.2, 0.5) * (1 - p);
        under(g, LA.byId.O0, '사람에게', COL.verb, a, 48, 16); under(g, LA.byId.O1, '물건을', COL.verb, a, 48, 16);
        under(g, LA.byId.S, '주는 쪽', COL.ante, a, 48, 16);
      } else {
        const o1 = LB.byId.O1, a = ramp(u, 14.8, 0.5);
        fade(g, a, () => boxTok(g, o1, COL.verb));
        under(g, o1, '남은 목적어', COL.verb, a, 48, 16);
        under(g, LB.byId.O0, '받는 사람 → 주어', COL.ante, a, 48, 16);
      }
      fade(g, ramp(u, 18.2, 0.4), () => label(g, '주는 동사', LX, 300, { size: 16, color: COL.soft }));
      chipRow(g, ['give', 'offer', 'award', 'send', 'grant'], LX, 334, u, 18.4, { color: COL.verb });
      fade(g, ramp(u, 20.2, 0.5), () => voiceChip(g, 'pass', 1200, 334, 1, 17, { text: '+ 명사 하나만 남음 → 수동', align: 'right' }));
      // 5형식
      const LC = lay(g, CA.toks, { x: W / 2, y: 438, size: 34, align: 'center' }), LD = lay(g, CB.toks, { x: W / 2, y: 438, size: 34, align: 'center' });
      const q = ramp(u, 29.2, 1.8);
      fade(g, ramp(u, 23.2, 0.6), () => {
        g.fillStyle = COL.faint; g.fillRect(LX, 380, W - 2 * LX, 1);
        if (q <= 0) drawLay(g, LC); else morph(g, LC, LD, q, { lift: 30 });
        if (q < 0.5) sayLay(LC, CA.text); else sayLay(LD, CB.text);
        if (q < 1) {
          const a = ramp(u, 24.6, 0.5) * (1 - q);
          under(g, LC.byId.O0, '목적어', COL.verb, a, 48, 16); under(g, LC.byId.C, '보어 (상태)', COL.verb, a, 48, 16);
        } else {
          const c = LD.byId.C, a = ramp(u, 31.2, 0.5);
          fade(g, a, () => boxTok(g, c, COL.verb));
          under(g, c, '남은 보어', COL.verb, a, 48, 16);
          under(g, LD.byId.O0, '목적어 → 주어', COL.ante, a, 48, 16);
        }
      });
      chipRow(g, ['consider', 'keep', 'name', 'appoint'], LX, 540, u, 25.6, { color: COL.verb });
      fade(g, ramp(u, 31.6, 0.5), () => voiceChip(g, 'pass', 1200, 540, 1, 17, { text: '+ 보어만 남음 → 수동', align: 'right' }));
    },

    /* 08 수동태가 없는 동사: 발생되었다 → was occurred(×) → 자동사는 수동태가 없음 → rise와 raise */
    intrans(g, u) {
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, LX, 150, 540, 214, { fill: COL.panel, stroke: COL.faint });
        label(g, '한국어로 생각하면', LX + 24, 178, { size: 16, color: COL.soft });
        txt(g, '문제가 발생되었다.', LX + 24, 222, { size: 26, weight: 600 });
        arrow(g, LX + 40, 246, LX + 40, 268, COL.muted, 2);
      });
      fade(g, ramp(u, 2.6, 0.6), () => {
        const y = 292, w = txt(g, 'A problem was occurred.', LX + 24, y, { size: 26, weight: 600, color: COL.trap });
        const sp = ramp(u, 6.6, 0.8);
        if (sp > 0) { g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(LX + 20, y + 2); g.lineTo(LX + 20 + (w + 8) * sp, y + 2); g.stroke(); }
        if (sp >= 1) mark(g, false, LX + 50 + w, y, 16);
        say(LX + 14, y - 22, w + 20, 44, 'A problem was occurred.');
      });
      fade(g, ramp(u, 8.2, 0.6), () => {
        const y = 336, w = txt(g, 'A problem occurred.', LX + 24, y, { size: 26, weight: 600, color: COL.good });
        mark(g, true, LX + 50 + w, y, 16);
        say(LX + 14, y - 22, w + 20, 44, 'A problem occurred.');
      });
      // 수동태 만들기 그림
      fade(g, ramp(u, 12.2, 0.6), () => {
        panel(g, 660, 150, 540, 214, { fill: COL.panel, stroke: COL.faint });
        label(g, '수동태 = 목적어를 주어 자리로', 684, 178, { size: 16, color: COL.soft });
      });
      const rows = [
        { y: 236, v: 'announce', box: 'the winners', ok: true, res: '→ 수동태 ✓', at: 12.8 },
        { y: 312, v: 'occur', box: '', ok: false, res: '올릴 말이 없음', at: 14.4 },
      ];
      rows.forEach(r => fade(g, ramp(u, r.at, 0.6), () => {
        txt(g, r.v, 684, r.y, { size: 24, weight: 700, color: r.ok ? COL.rel : COL.trap });
        const bx = 830, bw = 170;
        rr(g, bx, r.y - 22, bw, 44, 9);
        if (r.ok) { g.fillStyle = 'rgba(201,167,255,0.12)'; g.fill(); g.strokeStyle = COL.verb; g.lineWidth = 2; g.stroke(); txt(g, r.box, bx + bw / 2, r.y + 1, { size: 20, weight: 600, color: COL.verb, align: 'center' }); }
        else { g.setLineDash([6, 5]); g.strokeStyle = COL.gap; g.lineWidth = 2; g.stroke(); g.setLineDash([]); txt(g, '목적어 없음', bx + bw / 2, r.y + 1, { size: 17, weight: 700, color: COL.gap, align: 'center' }); }
        txt(g, r.ok ? '수동태 가능' : '수동태 없음', 1024, r.y, { size: 18, weight: 700, color: r.ok ? COL.good : COL.bad });
        mark(g, r.ok, 1170, r.y, 16);
      }));
      // 늘 능동인 동사
      fade(g, ramp(u, 18.2, 0.5), () => label(g, '수동태가 없는 동사 (자동사)', LX, 414, { size: 17, color: COL.trap }));
      chipRow(g, ['occur', 'happen', 'arise', 'rise', 'take place', 'emerge'], LX + 270, 414, u, 18.6, { color: COL.trap });
      // rise · raise
      const pairs = [
        { y: 486, parts: [['Prices ', COL.ante], ['rose', COL.rel, true], ['.', COL.text]], s: 'Prices rose.', note: 'rise 오르다 · 자동사 · 수동태 없음', c: COL.trap, at: 25.2 },
        { y: 538, parts: [['Prices ', COL.ante], ['were raised', COL.rel, true], ['.', COL.text]], s: 'Prices were raised.', note: 'raise 올리다 · 타동사 · 수동태 가능', c: COL.good, at: 27.4 },
      ];
      pairs.forEach(r => fade(g, ramp(u, r.at, 0.6), () => {
        pieces(g, r.parts, LX, r.y, 28);
        say(LX - 6, r.y - 22, 300, 44, r.s);
        txt(g, r.note, 420, r.y, { size: 19, weight: 700, color: r.c });
      }));
    },

    /* 09 3단계 풀이법 흐름도 (판정기로 길이 켜짐) */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 주어', sub: '진짜 주어 찾기', at: 5.6, boxes: [
          ['수식어 지우기', 'of ~ · who ~ · -ing ~', COL.clause], ['a number of · several · both', '→ 여럿', COL.ante],
          ['the number of · each · one of', '→ 하나', COL.ante], ['동명사 · 명사절 · 셀 수 없는 명사', '→ 하나', COL.ante]] },
        { x: 480, head: '② 수', sub: '수 맞추기', at: 11.6, boxes: [
          ['하나 (단수)', 'is · was · has · -s 동사', COL.rel], ['여럿 (복수)', 'are · were · have · 원형', COL.rel],
          ['will · must 뒤 · 과거형', '수와 상관없음', COL.muted], ['-ing · to부정사 혼자', '동사 자리에 못 와요', COL.bad]] },
        { x: 880, head: '③ 뒤', sub: '빈칸 뒤 보기', at: 18.2, boxes: [
          ['목적어 있음', '능동', COL.verb], ['목적어 없음', '수동 (be + p.p.)', COL.gap],
          ['주는 동사 + 명사 하나 · consider + 보어', '수동', COL.gap], ['자동사 occur · rise · take place', '능동만 (수동태 없음)', COL.trap]] },
      ];
      const P = S.path && S.path.subj && S.path.vt && S.path.after ? S.path : null;
      let on = [[], [], []], verdict = null;
      if (P) {
        const K = VA.SUBJ[P.subj], need = VA.need(P.vt, P.after);
        on[0] = [0, { anum: 1, many: 1, thenum: 2, each: 2, oneof: 2, ger: 3, clause: 3, mass: 3 }[P.subj]].filter(v => v != null);
        on[1] = [K.num === 's' ? 0 : 1];
        on[2] = need === 'act' ? [P.vt === 'vi' ? 3 : 0] : need === 'pass' ? [P.vt === 'vt' ? 1 : 2] : [];
        verdict = need ? `${K.num === 's' ? '하나' : '여럿'} · ${need === 'act' ? '능동' : '수동'} → ${VA.formsFor(K.num, need)}` : VA.needWhy(P.vt, P.after);
      }
      cols.forEach((c, ci) => {
        fade(g, ramp(u, c.at, 0.6), () => {
          panel(g, c.x, 150, 340, 58, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 20, 179, { size: 22, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 320, 179, { size: 15, weight: 600, color: COL.muted, align: 'right' });
          c.boxes.forEach(([k, v, col], bi) => {
            const y = 220 + bi * 76, lit = P && on[ci].includes(bi);
            fade(g, ramp(u, c.at + 0.5 + bi * 0.55, 0.5) * (P && !lit ? 0.4 : 1), () => {
              panel(g, c.x, y, 340, 64, { fill: lit ? 'rgba(255,193,94,0.14)' : COL.panel, stroke: lit ? COL.rel : COL.faint, lw: lit ? 2.5 : 1.5 });
              txt(g, k, c.x + 16, y + 21, { size: 15, weight: 700, color: COL.soft });
              txt(g, v, c.x + 16, y + 45, { size: 17, weight: 700, color: col });
            });
          });
          if (ci < 2) fade(g, ramp(u, cols[ci + 1].at - 0.3, 0.5), () => arrow(g, c.x + 348, 179, c.x + 392, 179, COL.accent, 3));
        });
      });
      if (verdict) chip(g, verdict, W / 2, 552, { size: 18, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 42, r: 10 });
    },

    /* 10 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = VA.DRILL[P.k], ctx = VA.ctxOf(it);
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0] + 0.6, s2 = v >= P.at[1], s3 = v >= P.at[2];
        // 빈칸 자리는 처음부터 답의 너비로 잡아 둠 → 답을 채울 때 줄이 바뀌지 않음
        const minW = Math.max(...it.opts.map(([o]) => tw(g, o, 31, 700) / 31 + 0.7));   // 가장 긴 보기의 너비 (글자 크기 단위)
        const T = drillToks(it, 'p' + pi).map(tk => tk.r === 'blank' ? Object.assign({}, tk, { t: it.opts[it.a][0], r: s3 ? 'ans' : 'blank', minW }) : tk);
        const L = lay(g, T, { x: LX, y: 222, size: 31, maxW: 1100, lh: 54 });
        const k1 = ramp(v, P.at[0] + 0.8, 1);
        const cueOk = ['obj', 'obj2', 'comp', 'objComp'].includes(it.after);
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: s2 && !s3 ? 0.6 : 0, hide: true }
          : tk.r === 'mod' ? (s1 ? { color: k1 > 0.5 ? COL.dim : COL.clause, strike: k1 } : { r: '' })
          : tk.r === 'subj' || tk.r === 'q' ? (s1 ? {} : { r: '' })
          : tk.tag === 'cue' && s3 ? { cue: true, cueColor: cueOk ? COL.verb : COL.trap, cueDash: !cueOk } : {});
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        const oy = L.lines > 1 ? 352 : 318;
        it.opts.forEach(([o, code], k) => {
          const ox = LX + (k % 2) * 290, y = oy + Math.floor(k / 2) * 92, j = VA.judgeOpt(it, k);
          const at = j.step === 2 ? P.at[1] + 1.2 : j.step === 3 ? P.at[2] + 1.2 : 1e9;
          const right = k === it.a, gone = !right && v >= at, win = right && s3;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, o, ox + 52, y, { size: 27, weight: win ? 700 : 600, color: win ? COL.good : gone ? COL.dim : COL.text });
          fade(g, ramp(v, P.at[1] + 0.3, 0.5), () => txt(g, VA.formName(code), ox + 52, y + 30, { size: 14, weight: 600, color: gone ? COL.dim : COL.muted }));
          if (gone) {
            const gp = clamp((v - at) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, y + 1); g.lineTo(ox - 4 + (w + 62) * gp, y + 1); g.stroke();
          }
          if (win) { panel(g, ox - 14, y - 26, w + 84, 70, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + w + 92, y, 18); }
        });
        panel(g, 660, oy - 40, 560, 236, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = oy - 2 + k * 72;
          txt(g, ['① 주어', '② 수', '③ 뒤'][k], 684, y, { size: 18, weight: 700, color: COL.accent });
          txt(g, ln, 684, y + 30, { size: 18, weight: 600, color: k === 2 ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 560, 760], Y0 = 152, RH = 40;
      const rows = [
        ['수식어 (전치사구 · 관계사절 · 분사구)', '지우고 진짜 주어', 'The results of the survey are', COL.clause],
        ['a number of + 복수 명사', '복수', 'A number of guests have', COL.ante],
        ['the number of · each · one of', '단수', 'The number of orders has', COL.ante],
        ['동명사 · 명사절 · 셀 수 없는 명사', '단수', 'Reviewing the reports takes', COL.ante],
        ['빈칸 뒤에 목적어 있음', '능동', 'will discuss the results', COL.verb],
        ['빈칸 뒤에 목적어 없음', '수동', 'will be announced next week', COL.gap],
        ['주는 동사 + 명사 하나 · consider + 보어', '수동', 'was awarded a bonus', COL.gap],
        ['자동사 occur · arise · rise', '능동만', 'A problem occurred.', COL.trap],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 12, { fill: COL.panel, stroke: COL.faint });
        ['단서', '동사', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 18, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 4, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.55, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 18;
        txt(g, r[0], X[0] + 20, y, { size: 18, weight: 600 });
        txt(g, r[1], X[1] + 20, y, { size: 19, weight: 700, color: r[3] });
        txt(g, r[2], X[2] + 20, y, { size: 18, weight: 500, color: COL.en });
      }));
      const steps = ['① 주어: 수식어 지우기', '② 수: 하나 · 여럿', '③ 뒤: 목적어가 있나?'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 6.5 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 552, { size: 19, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 44, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 552, c.x + c.w + 46, 552, COL.accent, 2.5);
        x = c.x + c.w + 58;
      }));
    },
  };
  // 빈칸에서 뒤로 훑는 보라 막대 (목적어 탐지)
  function scan(g, from, to, u, at) {
    const p = clamp((u - at) / 1.2);
    if (p <= 0 || p >= 1) return;
    const x = lerp(from.x + from.w + 6, to.x + to.w + 6, ease(p));
    g.save(); g.globalAlpha *= Math.sin(Math.PI * p);
    g.fillStyle = COL.verb; g.fillRect(x, from.y - 26, 3, 52);
    g.restore();
  }

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

  // 놀이터(능동·수동 변환기)의 작은 무대: 배치 A → B를 p만큼 옮겨 그림. 논리 크기 1000×220
  // o: { num: 새 주어의 수 표시, voice: 'act' | 'pass', msg: 바꿀 수 없을 때의 안내 (B를 흐리게 그림) }
  VS.STAGE = { w: 1000, h: 220 };
  VS.stage = function (g, A, B, p, o = {}) {
    const SW = VS.STAGE.w, SH = VS.STAGE.h, s = g.canvas.width / SW;
    g.setTransform(s, 0, 0, s, 0, 0); g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, SW, SH);
    g.fillStyle = COL.grid; for (let x = 20; x < SW; x += 40) for (let y = 20; y < SH; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const yy = o.msg ? 92 : 110;
    const fit = T => { let size = 36, L; do { L = lay(g, T, { x: SW / 2, y: yy, size, align: 'center' }); size -= 2; } while (L.w > SW - 70 && size > 18); return L; };
    const LB = fit(B.toks), LA = A ? fit(A.toks) : LB;
    fade(g, o.msg ? 0.45 : 1, () => { if (!A || p >= 1) drawLay(g, LB); else morph(g, LA, LB, p, { lift: 26 }); });
    if (p >= 1 && o.num) { const sj = LB.items.find(t => t.r === 'subj'); if (sj) numBadge(g, o.num, sj.x + sj.w / 2, yy + 56, 1, 14); }
    if (o.voice) voiceChip(g, o.voice, 22, 30, 1, 15, { align: 'left', text: o.voice === 'act' ? '능동태' : '수동태' });
    if (o.msg) txt(g, o.msg, SW / 2, 168, { size: 21, weight: 700, color: COL.trap, align: 'center' });
  };

  VS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[VS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, VS.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  // 직접 해 보기로만 나오는 글자(다른 주어·수량 표현·문장 쌍·판정기)도 함께 넣음
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + VA.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←✓×?~=+-/:…‘’';
  VS.baseText = EXTRA;
  VS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = VS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { VS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
