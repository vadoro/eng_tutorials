/* 전치사 튜토리얼 — 영상 장면
 *
 * PRS.render(g, t)는 시각 t와 사용자 상태 PRS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 영어 문장은 낱말 조각(토큰)으로 그리고, 역할마다 색을 칠합니다:
 *   앞 낱말(짝 표현) 하늘 · 전치사(답) 노랑 · 뒤의 명사 · 그때(깃발) · 기준이 되는 곳 보라 · 동작과 그림(시간선의 점 · 막대) 민트
 *   빈칸은 분홍 점선 상자, 한국어 조사와 함정은 주황.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(PR.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const PR = window.PR;
  const PRS = (window.PRS = {});
  const W = 1280, H = 720;
  PRS.W = W; PRS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  PRS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  PRS.COL = COL;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (PRS.S = { ko: null, lvl: null, bu: 0, path: null });
  PRS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  PRS.hits = () => HITS;

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
  // 너비에 맞춰 글자 크기를 줄임
  const fit = (g, s, size, maxW, weight = 600, min = 11) => { while (size > min && tw(g, s, size, weight) > maxW) size--; return size; };
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
  const tag = (g, s, x, y, color, o = {}) => chip(g, s, x, y, Object.assign({ size: 17, weight: 700, color, fill: COL.panel2, stroke: color, h: 36, r: 10 }, o));
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
  }
  const say = (x, y, w, h, text) => HITS.push({ x, y, w, h, say: text });
  // 영어 조각을 이어 그림. parts: [[글자, 색, 밑줄]] → 너비
  function pieces(g, parts, x, y, size, o = {}) {
    let w = 0; parts.forEach(([t]) => { w += tw(g, t, size, o.weight || 600); });
    let xx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    const x0 = xx;
    parts.forEach(([t, c, ul]) => {
      const ww = txt(g, t, xx, y, { size, weight: o.weight || 600, color: c || COL.text });
      if (ul === 's') { g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(xx - 2, y + 2); g.lineTo(xx + ww + 2, y + 2); g.stroke(); }
      else if (ul) { g.fillStyle = c; g.fillRect(xx, y + size * 0.56, ww, 3); }
      xx += ww;
    });
    if (o.say) say(x0 - 6, y - size * 0.8, w + 12, size * 1.6, o.say);
    return w;
  }
  // 전치사 덩어리 하나: [전치사(노랑), 뒤의 명사(보라)] 또는 [앞 낱말(하늘), 전치사, 나머지]
  const pp = (prep, noun) => [[prep, COL.rel, true], [' ' + noun, COL.verb]];
  const pair2 = (head, prep, rest = '') => [[head, COL.ante, true], [' ' + prep, COL.rel, true]].concat(rest ? [[' ' + rest, COL.text]] : []);

  /* ---------- 영어 문장 토큰 배치와 그리기 ---------- */
  // 토큰 { id, t: 글자, r: 역할 }. 역할: head 앞 낱말 · p 전치사(답) · n 뒤의 명사 · act 동작 · trap 함정 · fn 기능어 · blank 빈칸 · ans 채운 답 · bad 틀림 · '' 보통
  const RCOL = { head: COL.ante, p: COL.rel, n: COL.verb, act: COL.clause, trap: COL.trap, fn: COL.muted, bad: COL.bad, good: COL.good, dim: COL.dim };
  const UNDER = { head: 1, p: 1, n: 1 };
  const PUNCT = /^[.,?!]$/;
  const tokW = (g, tk, size) => Math.max(tk.minW ? tk.minW * size : 0, tokW0(g, tk, size));
  const tokW0 = (g, tk, size) => tk.r === 'blank' ? Math.max(size * 2.6, tk.t ? tw(g, tk.t, size, 700) + size * 0.7 : 0) :
    tk.r === 'ans' ? tw(g, tk.t, size, 700) + size * 0.7 : tw(g, tk.t, size, UNDER[tk.r] ? 600 : 500);
  // 한 줄(또는 maxW를 넘으면 여러 줄)로 배치. o: { x, y, size, align: 'left' | 'center', maxW, lh }
  function lay(g, toks, o) {
    const size = o.size || 34, sp = size * 0.34, maxW = o.maxW || 1e9, lh = o.lh || size * 1.65;
    const lines = [[]]; let x = 0;
    toks.forEach(tk => {
      const punct = PUNCT.test(tk.t) && tk.r !== 'blank', w = punct ? tw(g, tk.t, size, 500) : tokW(g, tk, size);
      const line = lines[lines.length - 1];
      if (!punct && line.length && x + sp + w > maxW) { lines.push([]); x = 0; }
      const cur = lines[lines.length - 1];
      if (cur.length) x += punct ? size * 0.05 : sp;
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
  // 문장 속 글자들을 한 토큰으로 묶어 나눔. spec: [[글자, 역할, 표시]]
  function phraseToks(q, spec, pre = 'q') {
    const marks = [];
    spec.concat([['___', 'blank']]).forEach(([t, r, tg]) => {
      if (!t) return;
      const i = q.indexOf(t);
      if (i >= 0 && !marks.some(m => i < m.e && i + t.length > m.s)) marks.push({ s: i, e: i + t.length, t, r, tag: tg });
    });
    marks.sort((a, b) => a.s - b.s);
    const out = []; let at = 0;
    const push = (t, r, tg) => out.push({ id: pre + out.length, t, r, tag: tg });
    const plain = s => s.split(' ').forEach(w => { if (!w) return; const m = w.match(/^(.*?)([.,?!]?)$/); if (m[1]) push(m[1], ''); if (m[2]) push(m[2], ''); });
    marks.forEach(m => { plain(q.slice(at, m.s)); push(m.r === 'blank' ? '' : m.t, m.r, m.tag); at = m.e; });
    plain(q.slice(at));
    return out;
  }
  const byTag = (L, t) => L.items.find(i => i.tag === t);
  const blankOf = L => L.items.find(i => i.r === 'blank' || i.r === 'ans');
  // 토큰 하나 그리기. o: { a, r: 역할 바꾸기, color, cue: 단서 상자, cueColor, cueDash, glow: 빈칸 반짝임, plain: 밑줄 없이 }
  function drawTok(g, it, o = {}) {
    const r = o.r != null ? o.r : it.r, size = it.size, x = it.x, y = it.y, w = it.w;
    g.save(); g.globalAlpha *= o.a == null ? 1 : o.a;
    if (g.globalAlpha <= 0.002) { g.restore(); return; }
    if (r === 'blank') {
      const h = size * 1.12;
      rr(g, x, y - h / 2, w, h, 8);
      g.fillStyle = `rgba(255,122,168,${0.08 + 0.12 * (o.glow || 0)})`; g.fill();
      g.setLineDash([6, 5]); g.strokeStyle = o.color || COL.gap; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]);
      if (it.t && !o.hide) txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: COL.rel, align: 'center' });
    } else if (r === 'ans') {
      const h = size * 1.22;
      rr(g, x, y - h / 2, w, h, 9);
      g.fillStyle = 'rgba(255,193,94,0.16)'; g.fill(); g.strokeStyle = COL.rel; g.lineWidth = 2; g.stroke();
      txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: COL.rel, align: 'center' });
    } else {
      const c = o.color || RCOL[r] || COL.text;
      txt(g, it.t, x, y + 1, { size, weight: UNDER[it.r] ? 600 : 500, color: c });   // 굵기는 배치 때의 역할을 따름 (너비가 맞게)
      if (UNDER[r] && !o.plain) { g.fillStyle = c; g.fillRect(x, y + size * 0.56, w, 3); }
    }
    if (o.cue) { const pd = size * 0.13; rr(g, x - pd, y - size * 0.68, w + pd * 2, size * 1.36, 8); g.strokeStyle = o.cueColor || COL.verb; g.lineWidth = 2.2; if (o.cueDash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
    g.restore();
  }
  function drawLay(g, L, style) { L.items.forEach(it => drawTok(g, it, style ? style(it) || {} : {})); }
  function sayLay(L, text) { say(L.x - 8, L.y - L.size * 0.8, L.w + 16, L.h + L.size * 0.3, text); }
  // 토큰 아래(dy > 0) 또는 위(dy < 0) 가운데에 작은 글
  function under(g, it, s, color, a = 1, dy = 44, size = 16) { fade(g, a, () => txt(g, s, it.x + it.w / 2, it.y + dy, { size, weight: 700, color, align: 'center' })); }
  // 문장 하나: 동작 · 전치사 · 뒤의 명사에 색 (영상 03 · 05장)
  const sent = (s, act, prep, noun, pre) => phraseToks(s, [[act, 'act', 'act'], [noun, 'n', 'n'], [' ' + prep + ' ', '', 'pp']].filter(x => x[0]), pre)
    .map(tk => tk.tag === 'pp' ? Object.assign({}, tk, { t: prep, r: 'p', tag: 'p' }) : tk);

  /* ---------- 시간선 그림 ----------
   * 눈금 i의 x는 lerp(x0, x1, i / (눈금 수 − 1)). 뒤의 명사(그때 · 길이 · 사건)는 보라, 동작(점 · 막대)은 민트.
   */
  function axis(g, x0, x1, y, ticks, o = {}) {
    g.strokeStyle = COL.line; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 - 26, y); g.lineTo(x1 + 30, y); g.stroke();
    arrowHead(g, x1 + 42, y, 0, COL.line, 11);
    ticks.forEach((s, i) => {
      const x = lerp(x0, x1, ticks.length > 1 ? i / (ticks.length - 1) : 0.5);
      g.fillStyle = COL.line; g.fillRect(x - 1, y - 6, 2, 12);
      if (s && !(o.skip && o.skip.includes(i))) txt(g, s, x, y + (o.ty || 27), { size: o.ts || 14, weight: 600, color: COL.muted, align: 'center' });
    });
  }
  const tickX = (ticks, i, x0, x1) => lerp(x0, x1, ticks.length > 1 ? i / (ticks.length - 1) : 0.5);
  function nowMark(g, x, y, a = 1, label = '지금') {
    fade(g, a, () => { rr(g, x - 2, y - 15, 4, 30, 2); g.fillStyle = COL.accent; g.fill(); txt(g, label, x, y - 27, { size: 14, weight: 700, color: COL.accent, align: 'center' }); });
  }
  // 깃발 = 그때(시점). 보라. o.q: 시점이 없을 때 물음표 깃발
  function flag(g, x, y, s, a = 1, o = {}) {
    fade(g, a, () => {
      const h = o.h || 52, c = o.color || COL.verb;
      g.save(); if (o.q) g.setLineDash([5, 4]);
      g.strokeStyle = c; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke(); g.restore();
      g.fillStyle = o.q ? 'rgba(201,167,255,0.25)' : c; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 26, y - h + 9); g.lineTo(x, y - h + 18); g.closePath(); g.fill();
      if (s && o.top) txt(g, s, x + 10, y - h - 14, { size: o.size || 16, weight: 700, color: c, align: 'center' });
      else if (s) txt(g, s, x + (o.left ? -8 : 32), y - h + 9, { size: o.size || 16, weight: 700, color: c, align: o.left ? 'right' : 'left' });
    });
  }
  // 한 번 일어나는 일 = 점
  function dot(g, x, y, s, a = 1, o = {}) {
    fade(g, a, () => {
      const c = o.color || COL.clause;
      g.fillStyle = c; g.beginPath(); g.arc(x, y, o.r || 9, 0, Math.PI * 2); g.fill();
      g.strokeStyle = COL.bg; g.lineWidth = 2; g.stroke();
      if (s) txt(g, s, x, y - (o.dy || 24), { size: o.size || 15, weight: 700, color: c, align: 'center' });
    });
  }
  // 쭉 이어지는 일 = 막대 (p: 자라는 정도)
  function bar(g, xa, xb, y, s, p = 1, o = {}) {
    if (p <= 0.001) return;
    const xe = lerp(xa, xb, clamp(p)), c = o.color || COL.clause, x0 = Math.min(xa, xe), w = Math.max(3, Math.abs(xe - xa));
    rr(g, x0, y - 7, w, 14, 7); g.fillStyle = c; g.fill();
    if (o.head && p >= 0.98) arrowHead(g, xb + (xb > xa ? 12 : -12), y, xb > xa ? 0 : Math.PI, c, 13);
    if (s && p > 0.3) txt(g, s, (xa + xe) / 2, y - (o.dy || 22), { size: o.size || 15, weight: 700, color: c, align: 'center' });
  }
  // 숫자로 잰 길이 = 보라 자 (시간선 위)
  function ruler(g, xa, xb, y, s, a = 1, o = {}) {
    fade(g, a, () => {
      const yy = y - (o.dy || 30), c = o.color || COL.verb;
      g.save(); if (o.q) g.setLineDash([5, 4]);
      g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.moveTo(xa, yy - 7); g.lineTo(xa, yy + 7); g.moveTo(xa, yy); g.lineTo(xb, yy); g.moveTo(xb, yy - 7); g.lineTo(xb, yy + 7); g.stroke(); g.restore();
      if (s) txt(g, s, (xa + xb) / 2, yy - 15, { size: o.size || 15, weight: 700, color: c, align: 'center' });
    });
  }
  // 사건 = 이름이 붙은 보라 칸
  function eventBlock(g, xa, xb, y, s, a = 1, o = {}) {
    fade(g, a, () => {
      rr(g, xa, y - 15, xb - xa, 30, 8); g.fillStyle = o.q ? 'rgba(201,167,255,0.06)' : 'rgba(201,167,255,0.16)'; g.fill();
      g.save(); if (o.q) g.setLineDash([5, 4]); g.strokeStyle = COL.verb; g.lineWidth = 1.8; g.stroke(); g.restore();
      if (s) txt(g, s, (xa + xb) / 2, y - (o.ly || 30), { size: o.size || 15, weight: 700, color: COL.verb, align: 'center' });
    });
  }
  // 그 안에 = 보라 점선 상자
  function boxSpan(g, xa, xb, y, s, a = 1, o = {}) {
    fade(g, a, () => {
      rr(g, xa, y - 16, xb - xa, 32, 9); g.fillStyle = 'rgba(201,167,255,0.07)'; g.fill();
      g.setLineDash([7, 5]); g.strokeStyle = o.color || COL.verb; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
      if (s) txt(g, s, (xa + xb) / 2, y - 30, { size: o.size || 15, weight: 700, color: o.color || COL.verb, align: 'center' });
    });
  }
  // 마감 전 구간 = 민트 옅은 칠
  function zone(g, xa, xb, y, a = 1, c = 'rgba(127,224,168,0.13)') {
    fade(g, a, () => { rr(g, xa, y - 15, xb - xa, 30, 8); g.fillStyle = c; g.fill(); });
  }
  // 정해진 시간 동안 왔다 갔다 하는 점의 자리 (같은 u면 같은 자리)
  const swing = (u, at, a, b, sp = 0.9) => lerp(a, b, (1 - Math.cos(Math.max(0, u - at) * sp)) / 2);

  /* ---------- 장소 그림 ----------
   * 기준이 되는 곳(뒤의 명사)은 보라, 놓인 것 · 움직임은 민트. kind: at on in between among along across throughout beyond within
   */
  function placeIcon(g, kind, cx, cy, w, h, p = 1, o = {}) {
    const P = COL.verb, M = COL.clause, s = Math.min(w / 300, h / 140);
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const item = (x, y, r = 10) => { g.fillStyle = M; g.beginPath(); g.arc(x, y, r * s * 1.1, 0, Math.PI * 2); g.fill(); };
    const thing = (x, y, ww, hh) => { rr(g, x - ww / 2, y - hh / 2, ww, hh, 6 * s); g.fillStyle = 'rgba(201,167,255,0.16)'; g.fill(); g.strokeStyle = P; g.lineWidth = 2; g.stroke(); };
    if (kind === 'at') {   // 한 지점: 바닥 위의 점에 핀
      g.strokeStyle = COL.line; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 120 * s, cy + 40 * s); g.lineTo(cx + 120 * s, cy + 40 * s); g.stroke();
      thing(cx, cy + 22 * s, 90 * s, 34 * s);
      const py = cy - 34 * s - (1 - p) * 20;
      g.fillStyle = M; g.beginPath(); g.arc(cx, py, 16 * s, Math.PI * 0.85, Math.PI * 0.15); g.lineTo(cx, py + 36 * s); g.closePath(); g.fill();
      g.fillStyle = COL.bg; g.beginPath(); g.arc(cx, py, 6 * s, 0, Math.PI * 2); g.fill();
    } else if (kind === 'on') {   // 면 위: 선반(벽) 위에 놓인 것
      g.strokeStyle = P; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 120 * s, cy + 24 * s); g.lineTo(cx + 120 * s, cy + 24 * s); g.stroke();
      const yy = cy + 24 * s - 22 * s - (1 - p) * 26;
      rr(g, cx - 34 * s, yy - 20 * s, 68 * s, 40 * s, 5 * s); g.fillStyle = M; g.fill();
      g.strokeStyle = COL.line; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 100 * s, cy + 24 * s); g.lineTo(cx - 100 * s, cy + 56 * s); g.moveTo(cx + 100 * s, cy + 24 * s); g.lineTo(cx + 100 * s, cy + 56 * s); g.stroke();
    } else if (kind === 'in' || kind === 'throughout') {   // 둘러싸인 공간 (곳곳에: 점이 퍼짐)
      rr(g, cx - 110 * s, cy - 56 * s, 220 * s, 112 * s, 12 * s); g.fillStyle = 'rgba(201,167,255,0.10)'; g.fill(); g.strokeStyle = P; g.lineWidth = 2.4; g.stroke();
      if (kind === 'in') item(cx, cy + (1 - p) * 10, 14);
      else for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const k = r * 5 + c; fade(g, clamp(p * 15 - k), () => item(cx - 80 * s + c * 40 * s, cy - 32 * s + r * 32 * s, 7)); }
    } else if (kind === 'between') {
      thing(cx - 85 * s, cy, 70 * s, 70 * s); thing(cx + 85 * s, cy, 70 * s, 70 * s);
      item(cx, cy + (1 - p) * -30, 13);
      g.strokeStyle = COL.line; g.lineWidth = 1.6; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(cx - 46 * s, cy + 50 * s); g.lineTo(cx + 46 * s, cy + 50 * s); g.stroke(); g.setLineDash([]);
    } else if (kind === 'among') {
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; g.strokeStyle = P; g.lineWidth = 2.2; g.fillStyle = 'rgba(201,167,255,0.16)'; g.beginPath(); g.arc(cx + Math.cos(a) * 62 * s, cy + Math.sin(a) * 44 * s, 15 * s, 0, Math.PI * 2); g.fill(); g.stroke(); }
      item(cx, cy, 13 * clamp(p * 1.4));
    } else if (kind === 'along' || kind === 'across') {   // 길: 두 줄 + 가운데 점선
      const L = 130 * s;
      g.strokeStyle = P; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx - L, cy - 26 * s); g.lineTo(cx + L, cy - 26 * s); g.moveTo(cx - L, cy + 26 * s); g.lineTo(cx + L, cy + 26 * s); g.stroke();
      g.setLineDash([8, 7]); g.strokeStyle = 'rgba(201,167,255,0.5)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - L, cy); g.lineTo(cx + L, cy); g.stroke(); g.setLineDash([]);
      if (kind === 'along') { const x0 = cx - L + 10 * s, x1 = lerp(x0, cx + L - 4 * s, clamp(p)); g.strokeStyle = M; g.lineWidth = 4; g.beginPath(); g.moveTo(x0, cy - 44 * s); g.lineTo(x1, cy - 44 * s); g.stroke(); if (p > 0.97) arrowHead(g, x1 + 8, cy - 44 * s, 0, M, 13); }
      else { const y0 = cy - 58 * s, y1 = lerp(y0, cy + 50 * s, clamp(p)); g.strokeStyle = M; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, y0); g.lineTo(cx, y1); g.stroke(); if (p > 0.97) arrowHead(g, cx, y1 + 8, Math.PI / 2, M, 13); }
    } else if (kind === 'beyond') {   // 경계(점선 세로줄)를 넘어
      g.setLineDash([7, 6]); g.strokeStyle = P; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy - 56 * s); g.lineTo(cx, cy + 56 * s); g.stroke(); g.setLineDash([]);
      const x0 = cx - 110 * s, x1 = lerp(x0, cx + 92 * s, clamp(p));
      g.strokeStyle = M; g.lineWidth = 4; g.beginPath(); g.moveTo(x0, cy); g.lineTo(x1, cy); g.stroke();
      if (p > 0.97) { arrowHead(g, x1 + 8, cy, 0, M, 13); item(cx + 112 * s, cy, 11); }
    } else if (kind === 'within') {   // 거리 · 범위 안에
      g.setLineDash([6, 5]); g.strokeStyle = P; g.lineWidth = 2.2; g.beginPath(); g.ellipse(cx, cy, 110 * s, 58 * s, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      g.fillStyle = P; g.beginPath(); g.arc(cx, cy, 6 * s, 0, Math.PI * 2); g.fill();
      item(cx + 54 * s, cy - 18 * s, 11);
    }
    g.restore();
  }
  PRS.placeIcon = placeIcon;

  // 작은 시간선 그림 (퀴즈 그림): kind = by · until · for · within, 상자 (x, y, w, h)
  PRS.miniTL = function (g, kind, x, y, w, h) {
    const x0 = x + 36, x1 = x + w - 44, yy = y + h * 0.62, T = ['', '', '', '', ''];
    axis(g, x0, x1, yy, T, { ts: 12 });
    const X = i => tickX(T, i, x0, x1);
    if (kind === 'by') { zone(g, X(0), X(3), yy); flag(g, X(3), yy, '', 1, { h: 40 }); dot(g, X(1.4), yy, '', 1, { r: 8 }); }
    else if (kind === 'until') { flag(g, X(3), yy, '', 1, { h: 40 }); bar(g, X(0), X(3), yy, ''); }
    else if (kind === 'for') { ruler(g, X(1), X(3), yy, '', 1, { dy: 24 }); bar(g, X(1), X(3), yy, ''); }
    else if (kind === 'within') { boxSpan(g, X(0), X(3), yy, ''); dot(g, X(2.1), yy, '', 1, { r: 8 }); }
  };

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '‘까지’에 맞는 보기가 둘', d: 24, caps: [
      [0.4, 5.5, '토익 Part 5에는 보기 네 개가 모두 전치사인 문제가 자주 나와요.'],
      [5.5, 11, '이 문제를 보세요. 빈칸 뒤 → Friday. 한국어로 옮기면 → 금요일까지.'],
      [11, 16.5, '그런데 ‘까지’에 맞는 보기가 둘이에요 → by, until. 한국어 뜻만으로는 고를 수 없어요.'],
      [16.5, 20.5, '어느 쪽일까요? 정답은 영상 끝에서 함께 풀어요.'],
      [20.5, 24, '**시간**, **장소**, **짝 표현** 전치사를 배우고 **3단계 풀이법**으로 묶어요.'],
    ] },
    { id: 'korean', n: '01', title: '조사 하나, 전치사 여럿', sub: '한국어와 다른 점', d: 34, caps: [
      [0.4, 6, '한국어는 명사 **뒤**에 조사를 붙여요 → 금요일까지. 영어는 명사 **앞**에 전치사를 놓아요 → by Friday.'],
      [6, 12, '그런데 조사와 전치사는 하나씩 짝이 맞지 않아요. ‘에’ 하나가 영어에서는 셋으로 나뉘어요 → at, on, in.'],
      [12, 18, '‘까지’도 둘이에요 → by, until. ‘동안’도 둘이에요 → for, during.'],
      [18, 24, '‘안에’ → within. 그런데 in two weeks → ‘2주 안에’가 아니라 ‘2주 뒤’예요.'],
      [24, 29, '그래서 한국어 뜻 대신 **그림**으로 골라요. 시간은 시간선 위에, 장소는 공간 그림 위에 놓아 봐요.'],
      [29, 34, '그림이 없는 전치사도 있어요. 앞 낱말과 늘 같이 다니는 **짝**이에요 → responsible for.'],
    ] },
    { id: 'atonin', n: '02', title: '시간의 at · on · in', sub: '점 · 날 · 큰 칸', d: 30, caps: [
      [0.4, 6, '시간의 ‘에’부터 볼게요. 빈칸 뒤 시간의 **크기**가 전치사를 정해요.'],
      [6, 12, '시계의 한 점, 시각 → **at**. at 3 p.m., at noon.'],
      [12, 18, '하루, 날짜, 요일 → **on**. on Monday, on May 5.'],
      [18, 24, '달, 해, 계절, 하루의 때처럼 큰 칸 → **in**. in May, in 2027, in the morning.'],
      [24, 30, '작은 점 → at, 날 → on, 큰 칸 → in. 날이 붙으면 아침도 → on Monday morning.'],
    ] },
    { id: 'byuntil', n: '03', title: '까지 갈림길', sub: 'by · until', d: 36, caps: [
      [0.4, 6, '‘까지’가 둘로 갈리는 곳이에요. 시간선에 깃발을 꽂아 볼게요. 깃발 = 금요일.'],
      [6, 12, 'Please submit the report by Friday. 제출은 한 번에 끝나는 일이에요. 깃발 전에 한 번만 하면 돼요.'],
      [12, 18, 'by → 늦어도 그때까지는 끝내요. 마감을 말할 때 써요. 화요일에 내도, 목요일에 내도 맞아요.'],
      [18, 24, 'The store will stay open until 9 p.m. 가게는 9시까지 쭉 열려 있다가 그때 닫아요.'],
      [24, 30, 'until → 그때까지 **계속** 이어져요. 이어지는 동사와 잘 어울려요 → stay, remain, wait, continue.'],
      [30, 36, '물어볼 것은 하나예요. 그때까지 **끝나나요**, 그때까지 **이어지나요**?'],
    ] },
    { id: 'fordur', n: '04', title: '동안과 안에', sub: 'for · during · within', d: 34, caps: [
      [0.4, 6, '‘동안’도 둘이에요. 빈칸 뒤가 숫자로 잰 **길이**인지, 이름이 있는 **사건**인지 보세요.'],
      [6, 12, '숫자로 잰 길이 → **for**. for three hours, for two weeks.'],
      [12, 18, '회의, 비행, 폭풍 같은 사건 → **during**. during the meeting, during the flight.'],
      [18, 23, 'during 바로 뒤에는 three hours 같은 숫자 길이가 오지 않아요. 숫자 길이 → for.'],
      [23, 29, '숫자 길이 앞에 하나 더 → within. within 30 days → 30일 **안에**, 그 안의 아무 때나 한 번.'],
      [29, 34, 'for → 그 길이 내내 쭉. within → 그 안의 어느 한때. 그림이 달라요.'],
    ] },
    { id: 'since', n: '05', title: '지금을 기준으로', sub: 'since · in', d: 28, caps: [
      [0.4, 6, '이번에는 **지금**을 기준으로 봐요. since 2021 → 2021년부터 지금까지 쭉.'],
      [6, 12, 'since 뒤에는 과거의 한 시점이 오고, 문장의 동사는 대개 현재완료예요 → has worked.'],
      [12, 17, 'She has worked here since 2021. 현재완료는 T04에서 자세히 다뤄요.'],
      [17, 23, '반대로 in two weeks → 지금부터 2주 **뒤**. 그 날에 일어나요.'],
      [23, 28, '‘2주 안에 아무 때나’라면 → within two weeks. 끝의 한 점과 그 안의 아무 때, 그림이 달라요.'],
    ] },
    { id: 'place', n: '06', title: '장소의 그림', sub: 'at · on · in · between · among …', d: 36, caps: [
      [0.4, 6, '장소의 ‘에’, ‘에서’도 나뉘어요. 한 지점 → **at**. at the front desk, at the airport.'],
      [6, 12, '면이나 층 위 → **on**. on the wall, on the third floor.'],
      [12, 18, '둘러싸인 공간이나 도시 → **in**. in the lobby, in Seoul.'],
      [18, 24, '둘 사이 → **between**, 셋 이상의 무리 가운데 → **among**. among the staff.'],
      [24, 30, '길을 따라 → along, 길을 건너 → across, 곳곳에 → throughout, 넘어서 → beyond.'],
      [30, 36, '시간에도 써요 → throughout the year, 한 해 내내. 그 기간 처음부터 끝까지예요.'],
    ] },
    { id: 'extra', n: '07', title: '뜻을 더하는 전치사', sub: 'as · by · to · via · per · upon', d: 34, caps: [
      [0.4, 6, '시간도 장소도 아닌 뜻을 더하는 전치사도 있어요. as a consultant → 컨설턴트로서. 자격을 말해요.'],
      [6, 12, '숫자 앞에서는 둘을 구별해요. Sales increased by 20 percent. by → 늘어난 **차이**.'],
      [12, 18, 'Sales increased to 3 million dollars. to → 막대가 다다른 **도착점**.'],
      [18, 24, '그림으로 보면 by → 막대가 자란 만큼, to → 막대의 끝이에요.'],
      [24, 29, 'via → ~을 거쳐, via e-mail. per → ~마다, per person.'],
      [29, 34, 'upon → ~하자마자. upon arrival → 도착하자마자. 뒤에는 동작을 나타내는 명사가 와요.'],
    ] },
    { id: 'pairs', n: '08', title: '짝 카드', sub: '앞 낱말이 고르는 전치사', d: 34, caps: [
      [0.4, 6, '그림으로 풀 수 없는 전치사도 있어요. 앞 낱말이 전치사를 골라요. 이것을 **짝 표현**이라고 해요.'],
      [6, 12, 'responsible for, eligible for, interested in, familiar with. 뜻을 따지기보다 짝으로 외워요.'],
      [12, 18, '한국어 조사에 끌리면 틀려요. ~에 접근 → access to, ~에 달려 있다 → depend on.'],
      [18, 24, '~을 따르다 → comply with, ~에 답하다 → respond to, ~로 이루어지다 → consist of.'],
      [24, 29, '명사도 짝이 있어요. an increase in sales, demand for, a solution to the problem.'],
      [29, 34, '빈칸 앞에 이런 낱말이 보이면 뒤의 명사보다 **짝 카드**를 먼저 떠올려요.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: '무엇 → 뒤의 명사 → 그림 · 짝', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11.5, '① **무엇**을 나타내나요? 시간, 장소, 뜻을 더하는 말, 아니면 앞 낱말의 짝? 종류가 다른 보기는 지워요.'],
      [11.5, 17.5, '② **뒤의 명사**를 봐요. 시각·날·큰 칸인지, 시점·길이·사건인지, 둘인지 셋 이상인지, 숫자인지.'],
      [17.5, 23.5, '③ **그림**으로 확인해요. 끝나나, 이어지나? 차이냐, 도착점이냐? 짝 표현은 **짝 카드**로.'],
      [23.5, 28, '이 순서로 처음 본 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '처음 본 문제예요. ① 빈칸 뒤 → Friday, 시간이에요. 장소의 전치사 (C) among 탈락.'],
      [6, 12, '② Friday → 날, 곧 한 시점이에요. 사건이 와야 하는 (D) during 탈락.'],
      [12, 18, '③ 제출은 한 번에 끝나는 일, 마감이에요. 이어짐의 (A) until 탈락. 정답은 (B) by.'],
      [18.4, 24.5, '두 번째 문제. ① 빈칸 뒤 → 18 percent, 숫자예요. 시간의 (D) within 탈락.'],
      [24.5, 31, '② 숫자 앞에 자격은 올 수 없어요 → (B) as 탈락. 남은 둘 → by, to.'],
      [31, 37, '③ over the previous year → 지난해보다 늘어난 **차이**예요. (A) to 탈락, 정답은 (C) by.'],
      [37.4, 43.5, '세 번째. ① 빈칸 앞 → increase. 짝 전치사가 정해진 명사예요. 짝 표현이에요.'],
      [43.5, 50, '② 뒤의 명사 → demand, 숫자가 아니라 늘어난 것이에요. 숫자 앞의 짝 (C) of 탈락.'],
      [50, 56, '③ 짝 카드 → increase in. (A) on, (D) to 탈락. 정답은 (B) in.'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 표', d: 22, caps: [
      [0.4, 6, '정리해요. 한국어 조사로 옮기지 말고, 그림과 짝으로 골라요.'],
      [6, 12, '시간은 크기와 그림으로 → at, on, in. 끝나면 by, 이어지면 until.'],
      [12, 17, '장소도 그림으로 골라요. 숫자 앞에서는 차이 → by, 도착점 → to. 짝 표현은 짝 카드로.'],
      [17, 22, '아래 놀이터의 까지 갈림길과 짝 카드로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  PRS.CHAPTERS = CHAPTERS; PRS.CAPTIONS = CAPTIONS; PRS.END = END;
  PRS.POSTER = CHAPTERS.find(c => c.id === 'byuntil').t + 23.5;
  PRS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  PRS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(PR.DRILL)에서 세 개. 단계마다 그 단계에서 지워지는 보기를 지움 (규칙 엔진의 step)
  // at: 오른쪽 풀이 줄이 나오는 때 · x: ①②③ 탈락 줄이 그어지는 때 · win: 정답 표시
  const PRACTICE = [
    { k: 0, at: [0.4, 6, 12], x: [3.6, 8.6, 14.6], win: 15.4, lines: ['시간 (뒤 → Friday) · (C) 탈락', 'Friday → 날, 곧 한 시점 · (D) 탈락', '끝나는 일 → 마감 · (A) 탈락 → (B) by'] },
    { k: 10, at: [0.4, 6.1, 12.6], x: [3.8, 8.8, 15.2], win: 16, lines: ['숫자 (뒤 → 18 percent) · (D) 탈락', '숫자 앞에 자격은 안 와요 · (B) 탈락', '지난해보다 늘어난 차이 · (A) 탈락 → (C) by'] },
    { k: 15, at: [0.4, 6.1, 12.6], x: [3.8, 9.2, 15.2], win: 16, lines: ['짝 표현 (앞 → increase)', 'demand → 숫자 아님 · (C) 탈락', '짝 카드 increase in · (A) (D) 탈락 → (B) in'] },
  ];
  PRACTICE.forEach(p => {
    const it = PR.DRILL[p.k], L = 'ABCD';
    [1, 2, 3].forEach(step => {
      const gone = it.opts.map((o, i) => PR.judgeOpt(it, i).step === step ? `(${L[i]})` : '').filter(Boolean);
      const line = p.lines[step - 1].replace(`(${L[it.a]})`, '');
      const shown = (line.match(/\([A-D]\)/g) || []);
      if (gone.join() !== shown.join()) console.warn('[전치사] 실전 문제 탈락 표시가 규칙 엔진과 달라요:', it.q, step, gone, shown);
    });
    if (!p.lines[2].includes(`(${L[it.a]}) ${it.opts[it.a]}`)) console.warn('[전치사] 실전 문제 정답 표시가 데이터와 달라요:', it.q);
  });
  // 연습 문제 → 토큰 (뒤의 명사 · 동작 · 앞 낱말을 한 덩어리로)
  function drillToks(it, pre = 'q') {
    const spec = [];
    if (it.headText) spec.push([it.headText, 'head', 'head']);
    if (it.nounText) spec.push([it.nounText, 'n', 'n']);
    if (it.act) spec.push([it.act, 'act', 'act']);
    return phraseToks(it.q, spec, pre);
  }

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o)); }
  // 전치사 단어 + 뒤의 명사 덩어리를 그리고 발음 등록
  const phrase = (g, prep, noun, x, y, size, o = {}) => pieces(g, pp(prep, noun), x, y, size, Object.assign({ say: prep + ' ' + noun }, o));

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(‘까지’에 맞는 보기 둘) → 3단계 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '전치사, 그림으로 보고 짝으로 외워라', W / 2, 290, { size: 56, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Prepositions · time, place & pairs', W / 2, 364, { size: 26, weight: 500, color: COL.muted, align: 'center' });
      });
      [['시간 → 시간선', COL.clause], ['장소 → 공간 그림', COL.clause], ['짝 → 짝 카드', COL.ante]].forEach(([s, c], k) =>
        fade(g, ramp(u, 1.2 + k * 0.35, 0.4) * out1, () => tag(g, s, W / 2 + (k - 1) * 260, 456, c, { align: 'center', size: 19, h: 42 })));
      const it = PR.DRILL[0];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 19, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 160, 1000, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 180, 198, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const L = lay(g, drillToks(it), { x: 180, y: 290, size: 32, maxW: 930, lh: 56 });
        const s1 = u > 8.2, s2 = u > 16;
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: s2 ? 0.5 + 0.5 * Math.sin(u * 4) : 0 }
          : tk.tag === 'n' ? (s1 ? { cue: true } : { r: '' }) : { r: '' });
        sayLay(L, it.q.replace('___', it.opts[it.a]));
        const nn = byTag(L, 'n');
        under(g, nn, '빈칸 뒤', COL.verb, ramp(u, 8.4, 0.5), -46, 15);
        it.opts.forEach((o, k) => {
          const ox = 200 + (k % 2) * 300, oy = 412 + Math.floor(k / 2) * 64, two = k < 2 && u > 12.2;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            const w = txt(g, o, ox + 64, oy, { size: 30, weight: 600, color: two ? COL.trap : COL.text });
            if (two) { g.fillStyle = COL.trap; g.fillRect(ox + 64, oy + 19, w * ramp(u, 12.2, 0.5), 3); }
          });
        });
        // ‘까지’ → by? until?
        fade(g, ramp(u, 10.4, 0.5), () => {
          const cx = 960;
          chip(g, '금요일까지', cx, 404, { size: 20, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'center', h: 40, r: 10 });
          fade(g, ramp(u, 11.4, 0.5), () => {
            arrow(g, cx - 30, 428, cx - 70, 466, COL.trap, 2.2); arrow(g, cx + 30, 428, cx + 70, 466, COL.trap, 2.2);
            chip(g, 'by ?', cx - 84, 490, { size: 20, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 38, r: 10 });
            chip(g, 'until ?', cx + 84, 490, { size: 20, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 38, r: 10 });
          });
        });
      });
      const steps = [['①', '무엇', '시간 · 장소 · 짝?'], ['②', '뒤의 명사', '그때 · 길이 · 사건?'], ['③', '그림 · 짝', '끝나나, 이어지나?']];
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

    /* 01 조사 하나, 전치사 여럿: 금요일까지 ↔ by Friday → 한국어 조사 넷이 영어 전치사 여럿으로 → 그림과 짝 */
    korean(g, u) {
      const top = 1 - ramp(u, 23.6, 0.5);
      fade(g, ramp(u, 0.4, 0.6) * top, () => {
        panel(g, LX, 146, 540, 116, { fill: COL.panel, stroke: COL.faint });
        label(g, '한국어 · 명사 + 조사', LX + 24, 172, { size: 15, color: COL.soft });
        const w = txt(g, '금요일', LX + 24, 222, { size: 36, weight: 700 });
        txt(g, '까지', LX + 24 + w, 222, { size: 36, weight: 700, color: COL.trap });
        g.fillStyle = COL.trap; g.fillRect(LX + 24 + w, 244, tw(g, '까지', 36, 700), 3);
      });
      fade(g, ramp(u, 3.2, 0.6) * top, () => {
        panel(g, 660, 146, 540, 116, { fill: COL.panel, stroke: COL.faint });
        label(g, '영어 · 전치사 + 명사', 684, 172, { size: 15, color: COL.soft });
        phrase(g, 'by', 'Friday', 684, 222, 36);
      });
      fade(g, ramp(u, 4.4, 0.5) * top, () => { arrow(g, 624, 204, 652, 204, COL.muted, 2); });
      // 조사 넷 → 전치사 여럿
      const rows = [[6.4, 318], [12.2, 388], [14.6, 458], [18.2, 528]];
      PR.KO.forEach((K, k) => {
        const [at, y] = rows[k], dim = S.ko != null && S.ko !== k ? 0.3 : 1, on = S.ko != null;
        fade(g, (on ? 1 : ramp(u, at, 0.5)) * dim, () => {
          chip(g, K.k, 150, y, { size: 22, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'center', h: 44, r: 12 });
          fade(g, on ? 1 : ramp(u, at + 0.2, 0.4), () => {
            arrow(g, 196, y, 252, y, COL.muted, 2);
            panel(g, 262, y - 31, 158 * K.en.length + 2, 62, { fill: 'rgba(255,193,94,0.05)', stroke: COL.faint, r: 12 });
          });
          K.en.forEach(([w, ko, ex], i) => fade(g, on ? 1 : ramp(u, at + 0.4 + i * 0.35, 0.4), () => {
            const x = 340 + i * 158;
            chip(g, w, x, y - 6, { size: 22, weight: 700, color: COL.rel, fill: COL.panel, stroke: COL.rel, align: 'center', h: 40, r: 10 });
            txt(g, ko, x, y + 26, { size: 13, weight: 600, color: COL.soft, align: 'center' });
            say(x - 50, y - 26, 100, 40, ex);
          }));
          fade(g, on ? 1 : ramp(u, at + 1.4, 0.5), () => {
            txt(g, K.en.map(e => e[2]).join(' · '), 820, y - 6, { size: 17, weight: 600, color: COL.en });
            txt(g, K.note, 820, y + 20, { size: 14, weight: 700, color: k === 3 ? COL.trap : COL.muted });
            say(814, y - 22, 380, 32, K.en.map(e => e[2]).join(', '));
          });
        });
      });
      // 그림과 짝
      const cards = [[24.4, '시간 → 시간선 위에', 'tl'], [25.4, '장소 → 공간 그림 위에', 'box'], [29.4, '짝 → 외워 두는 짝 카드', 'card']];
      cards.forEach(([at, s, ic], k) => fade(g, ramp(u, at, 0.6), () => {
        const x = LX + k * 380;
        panel(g, x, 150, 360, 110, { fill: COL.panel, stroke: k === 2 ? COL.ante : COL.clause });
        if (ic === 'tl') { const T = ['', '', '', '']; axis(g, x + 26, x + 106, 214, T, {}); flag(g, x + 79, 214, '', 1, { h: 36 }); dot(g, x + 46, 214, '', 1, { r: 7 }); }
        else if (ic === 'box') placeIcon(g, 'in', x + 74, 205, 120, 70, 1);
        else { [0, 1].forEach(j => { rr(g, x + 24 + j * 14, 172 + j * 12, 80, 52, 8); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = j ? COL.rel : COL.ante; g.lineWidth = 2; g.stroke(); }); txt(g, 'for', x + 78, 211, { size: 16, weight: 700, color: COL.rel, align: 'center' }); }
        txt(g, s, x + 150, 190, { size: 18, weight: 700, color: k === 2 ? COL.ante : COL.clause });
        if (k === 2) pieces(g, pair2('responsible', 'for'), x + 150, 226, 20, { say: 'responsible for' });
        else txt(g, k ? 'at the desk · in the lobby' : 'by Friday · until 9 p.m.', x + 150, 226, { size: 16, weight: 600, color: COL.en });
      }));
    },

    /* 02 시간의 at · on · in: 시계(점) ⊂ 하루(날) ⊂ 달력(큰 칸) */
    atonin(g, u) {
      const lv = S.lvl;
      const cols = [
        { k: 'at', x: 220, at: 6.2, kind: '시각 · 콕 찍는 점', ex: ['at 3 p.m.', 'at noon'] },
        { k: 'on', x: 600, at: 12.2, kind: '날 · 날짜 · 요일', ex: ['on Monday', 'on May 5'] },
        { k: 'in', x: 1000, at: 18.2, kind: '달 · 해 · 계절 · 하루의 때', ex: ['in May · in 2027', 'in the morning'] },
      ];
      fade(g, ramp(u, 0.6, 0.6) * (1 - ramp(u, 5.6, 0.5)), () => txt(g, '빈칸 뒤 시간의 크기 → 전치사', W / 2, 300, { size: 30, weight: 700, fam: FD, align: 'center', color: COL.soft }));
      cols.forEach((c, i) => {
        const dim = lv && lv !== c.k ? 0.3 : 1, a = (lv ? 1 : ramp(u, c.at, 0.6)) * dim, y = 296;
        fade(g, a, () => {
          txt(g, c.k, c.x, 176, { size: 42, weight: 700, color: COL.rel, align: 'center' });
          if (c.k === 'at') {   // 시계
            g.strokeStyle = COL.verb; g.lineWidth = 3; g.beginPath(); g.arc(c.x, y, 72, 0, Math.PI * 2); g.stroke();
            for (let h = 0; h < 12; h++) { const an = h / 12 * Math.PI * 2; g.fillStyle = COL.muted; g.fillRect(c.x + Math.sin(an) * 60 - 1.5, y - Math.cos(an) * 60 - 1.5, 3, 3); }
            g.strokeStyle = COL.text; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(c.x, y); g.lineTo(c.x + 38, y); g.moveTo(c.x, y); g.lineTo(c.x, y - 54); g.stroke();
            g.fillStyle = COL.clause; g.beginPath(); g.arc(c.x + 60, y, 9, 0, Math.PI * 2); g.fill();
          } else if (c.k === 'on') {   // 하루 (24시간 띠 + 3 p.m. 점)
            panel(g, c.x - 120, y - 82, 240, 164, { fill: COL.panel, stroke: COL.verb, lw: 2.5 });
            rr(g, c.x - 120, y - 82, 240, 40, 14); g.fillStyle = 'rgba(201,167,255,0.22)'; g.fill();
            txt(g, 'MON', c.x, y - 62, { size: 17, weight: 700, color: COL.verb, align: 'center' });
            txt(g, '3', c.x, y - 6, { size: 50, weight: 700, color: COL.text, align: 'center', fam: FD });
            g.fillStyle = COL.faint; g.fillRect(c.x - 96, y + 48, 192, 6);
            g.fillStyle = COL.clause; g.beginPath(); g.arc(c.x - 96 + 192 * 15 / 24, y + 51, 7, 0, Math.PI * 2); g.fill();
          } else {   // 달력 (5주 × 7일, 한 칸에 표시)
            const bx = c.x - 160, by = y - 96;
            panel(g, bx, by, 320, 192, { fill: COL.panel, stroke: COL.verb, lw: 2.5 });
            txt(g, 'MAY 2027', c.x, by + 20, { size: 16, weight: 700, color: COL.verb, align: 'center' });
            for (let r = 0; r < 5; r++) for (let d = 0; d < 7; d++) {
              const cx = bx + 22 + d * 40, cy = by + 50 + r * 28, hl = r === 0 && d === 1;
              rr(g, cx, cy, 34, 22, 4); g.fillStyle = hl ? 'rgba(127,224,168,0.5)' : 'rgba(201,167,255,0.10)'; g.fill();
            }
          }
          txt(g, c.kind, c.x, 410, { size: 17, weight: 700, color: COL.verb, align: 'center' });
          c.ex.forEach((e, j) => { txt(g, e, c.x, 446 + j * 32, { size: 21, weight: 600, color: COL.en, align: 'center' }); say(c.x - 110, 446 + j * 32 - 14, 220, 28, e.split(' · ')[0]); });
        });
        // 확대 줄: 점은 하루 속, 하루는 달력 속
        if (i < 2) fade(g, (lv ? 0 : 1) * ramp(u, cols[i + 1].at + 0.6, 0.6), () => {
          g.save(); g.setLineDash([5, 5]); g.strokeStyle = COL.dim; g.lineWidth = 1.5; g.beginPath();
          if (i === 0) { const tx = 600 - 96 + 192 * 15 / 24, ty = 296 + 51; g.moveTo(220 + 50, 296 - 52); g.lineTo(tx, ty - 6); g.moveTo(220 + 50, 296 + 52); g.lineTo(tx, ty + 6); }
          else { const tx = 1000 - 160 + 22 + 40, ty = 296 - 96 + 50; g.moveTo(600 + 120, 296 - 82); g.lineTo(tx, ty); g.moveTo(600 + 120, 296 + 82); g.lineTo(tx, ty + 22); }
          g.stroke(); g.restore();
        });
      });
      fade(g, ramp(u, 24.2, 0.5), () => {
        let x = LX;
        [['at · 점', 0], ['on · 날', 1], ['in · 큰 칸', 2]].forEach(([s], i) => { const c = chip(g, s, x, 548, { size: 18, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, h: 40, r: 10 }); if (i < 2) arrow(g, c.x + c.w + 10, 548, c.x + c.w + 40, 548, COL.muted, 2.2); x = c.x + c.w + 52; });
      });
      fade(g, ramp(u, 26.6, 0.5), () => {
        const c = chip(g, 'on Monday morning · 날이 붙으면 on', W - 80, 548, { size: 18, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'right', h: 40, r: 10 });
        say(c.x, c.y, c.w, c.h, 'on Monday morning');
      });
    },

    /* 03 까지 갈림길: by(깃발 전에 한 번 = 점) · until(깃발까지 쭉 = 막대) */
    byuntil(g, u) {
      const B = PR.BYUNTIL[S.bu || 0], live = S.bu ? 1 : 0;
      const x0 = 200, x1 = 1040;
      // 위: by
      const LA = lay(g, sent(B.by, B.byAct, 'by', B.byN, 'a'), { x: LX, y: 172, size: 28 });
      fade(g, ramp(u, 0.4, 0.6), () => { drawLay(g, LA, tk => u < 6.2 && !live && tk.r !== '' ? { r: tk.r === 'n' ? 'n' : '' } : {}); sayLay(LA, B.by); });
      const yA = 262, XA = i => tickX(B.byT, i, x0, x1), fA = XA(B.byAt);
      fade(g, ramp(u, 1.2, 0.6), () => { axis(g, x0, x1, yA, B.byT); nowMark(g, XA(0), yA); });
      flag(g, fA, yA, B.byN, live || ramp(u, 2.2, 0.5));
      zone(g, XA(0) + 6, fA - 4, yA, live || ramp(u, 6.4, 0.6));
      const by1 = live || u >= 7 ? 1 : 0;
      if (live || u < 12.2) dot(g, live ? XA(1.5) : swing(u, 7, XA(0.6), XA(B.byAt - 0.5)), yA, B.byKo, live || ramp(u, 7, 0.4));
      else {
        [[1, true], [3, true], [B.byAt + 1, false]].forEach(([i, ok], k) => fade(g, ramp(u, 12.4 + k * 1.3, 0.4), () => {
          dot(g, XA(i), yA, ok ? B.byKo : '늦음', 1, { color: ok ? COL.clause : COL.bad });
          mark(g, ok, XA(i), yA + 42, 14);
        }));
      }
      fade(g, (live || ramp(u, 8.6, 0.5)) * by1, () => {
        pieces(g, [['by', COL.rel, true], [' → 깃발 전 아무 때나 한 번 끝내면 돼요 (마감)', COL.soft]], LX, 336, 18);
      });
      // 아래: until
      const LB = lay(g, sent(B.un, B.unAct, 'until', B.unN, 'b'), { x: LX, y: 392, size: 28 });
      fade(g, live || ramp(u, 18.2, 0.6), () => { drawLay(g, LB); sayLay(LB, B.un); });
      const yB = 470, XB = i => tickX(B.unT, i, x0, x1), fB = XB(B.unAt);
      fade(g, live || ramp(u, 19, 0.6), () => { axis(g, x0, x1, yB, B.unT); nowMark(g, XB(0), yB); });
      flag(g, fB, yB, B.unN, live || ramp(u, 19.4, 0.5));
      bar(g, XB(0) + 4, fB - 4, yB, B.unKo, live || ramp(u, 19.8, 2.6));
      fade(g, live || ramp(u, 22.6, 0.5), () => { txt(g, '그때 멈춤', fB + 34, yB - 16, { size: 14, weight: 700, color: COL.muted }); g.strokeStyle = COL.dim; g.lineWidth = 2; g.setLineDash([4, 5]); g.beginPath(); g.moveTo(fB + 8, yB); g.lineTo(x1 + 20, yB); g.stroke(); g.setLineDash([]); });
      fade(g, live || ramp(u, 24.2, 0.5), () => pieces(g, [['until', COL.rel, true], [' → 깃발까지 쭉 이어지다가 그때 멈춰요', COL.soft]], LX, 524, 18));
      // 어울리는 동사
      fade(g, live || ramp(u, 25.4, 0.5), () => {
        tag(g, 'by + submit · finish · return · arrive', LX, 561, COL.clause, { size: 16, h: 32 });
        tag(g, 'until + stay · remain · wait · continue', 660, 561, COL.clause, { size: 16, h: 32 });
      });
      fade(g, live || ramp(u, 30.2, 0.6), () => tag(g, '끝나나 → by · 이어지나 → until', W - 80, 112, COL.accent, { align: 'right', h: 38 }));
    },

    /* 04 동안과 안에: for(숫자 길이 내내) · during(사건 동안) · within(그 길이 안의 한때) */
    fordur(g, u) {
      const x0 = 600, x1 = 1110, T = ['1시', '2시', '3시', '4시', '5시'], X = i => tickX(T, i, x0, x1);
      const rows = [
        { y: 214, p: 'for', n: 'three hours', at: 6.2, kind: '숫자로 잰 길이 → 그 길이 내내' },
        { y: 340, p: 'during', n: 'the meeting', at: 12.2, kind: '사건 · 행사 → 그 사건이 이어지는 동안' },
        { y: 484, p: 'within', n: '30 days', at: 23.2, kind: '숫자 길이 → 그 안의 아무 때나 한 번' },
      ];
      rows.forEach((r, k) => fade(g, ramp(u, r.at, 0.6), () => {
        phrase(g, r.p, r.n, LX, r.y, 32);
        txt(g, r.kind, LX, r.y + 38, { size: 16, weight: 700, color: k === 1 ? COL.verb : COL.soft });
        const ty = r.y + 4;
        if (k === 2) {
          const D = ['산 날', '10일', '20일', '30일', '40일'];
          axis(g, x0, x1, ty, D); boxSpan(g, tickX(D, 0, x0, x1) + 4, tickX(D, 3, x0, x1), ty, '30 days', ramp(u, r.at + 0.6, 0.5));
          dot(g, swing(u, r.at + 1.2, tickX(D, 0.4, x0, x1), tickX(D, 2.7, x0, x1), 1.1), ty, '', ramp(u, r.at + 1.2, 0.4));
        } else {
          axis(g, x0, x1, ty, T);
          if (k === 0) { ruler(g, X(1), X(4), ty, 'three hours', ramp(u, r.at + 0.6, 0.5)); bar(g, X(1), X(4), ty, '', ramp(u, r.at + 1, 2)); }
          else { eventBlock(g, X(1), X(3), ty, 'the meeting', ramp(u, r.at + 0.6, 0.5)); bar(g, X(1) + 8, X(3) - 8, ty, '', ramp(u, r.at + 1, 1.6)); }
        }
      }));
      // 함정: during + 숫자 길이
      fade(g, ramp(u, 18.2, 0.6), () => {
        const y = 412, w = pieces(g, [['during', COL.trap, 's'], [' three hours', COL.trap, 's']], LX, y, 24);
        mark(g, false, LX + w + 24, y, 15);
        pieces(g, [['→ 숫자 길이 앞에는 ', COL.soft], ['for', COL.rel, true], [' three hours', COL.verb]], LX + w + 50, y, 20, { say: 'for three hours' });
      });
      fade(g, ramp(u, 29.2, 0.6), () => tag(g, 'for → 내내 · within → 그 안의 한때', W - 80, 112, COL.accent, { align: 'right', h: 38 }));
    },

    /* 05 지금을 기준으로: since(과거 깃발 → 지금) · in(지금 → 그만큼 뒤 한 점) · within(지금 → 그 안 아무 때) */
    since(g, u) {
      const s1 = 'She has worked here since 2021.';
      const LA = lay(g, sent(s1, 'has worked', 'since', '2021', 'a'), { x: LX, y: 170, size: 28 });
      fade(g, ramp(u, 0.4, 0.6), () => { drawLay(g, LA); sayLay(LA, s1); });
      const T = ['2021', '2022', '2023', '2024', '2025', '지금'], x0 = 200, x1 = 1060, y = 256, X = i => tickX(T, i, x0, x1);
      fade(g, ramp(u, 1, 0.6), () => { axis(g, x0, x1, y, T, { skip: [5] }); nowMark(g, X(5), y); });
      flag(g, X(0), y, '2021', ramp(u, 1.4, 0.5));
      bar(g, X(0) + 4, X(5) - 6, y, 'has worked · 그때부터 지금까지', ramp(u, 2, 2.4), { head: true, dy: 24 });
      fade(g, ramp(u, 6.4, 0.6), () => pieces(g, [['since', COL.rel, true], [' + 과거의 한 시점 → 문장의 동사는 대개 현재완료 (T04)', COL.soft]], LX, 314, 18));
      // 아래: in two weeks · within two weeks
      const s2 = 'The new branch will open in two weeks.';
      const LB = lay(g, sent(s2, 'open', 'in', 'two weeks', 'b'), { x: LX, y: 370, size: 28 });
      fade(g, ramp(u, 17.2, 0.6), () => { drawLay(g, LB); sayLay(LB, s2); });
      const D = ['지금', '1주', '2주', '3주'], a0 = 420, a1 = 1060, XD = i => tickX(D, i, a0, a1);
      const rows = [{ y: 452, p: 'in', at: 17.8, kind: '지금부터 2주 뒤 한 점' }, { y: 540, p: 'within', at: 23.2, kind: '2주 안 아무 때나' }];
      rows.forEach((r, k) => fade(g, ramp(u, r.at, 0.6), () => {
        phrase(g, r.p, 'two weeks', LX, r.y - 8, 24);
        txt(g, r.kind, LX, r.y + 20, { size: 15, weight: 700, color: COL.soft });
        axis(g, a0, a1, r.y, D, { skip: [0] });
        nowMark(g, XD(0), r.y);
        if (k === 0) {
          arc(g, XD(0), r.y - 8, XD(2), r.y - 8, 34, COL.verb, ramp(u, r.at + 0.6, 1), { dash: true });
          fade(g, ramp(u, r.at + 1.6, 0.4), () => { dot(g, XD(2), r.y, '', 1); txt(g, '문 엶', XD(2) + 18, r.y - 18, { size: 15, weight: 700, color: COL.clause }); txt(g, 'two weeks', XD(1), r.y - 50, { size: 15, weight: 700, color: COL.verb, align: 'center' }); });
        } else {
          boxSpan(g, XD(0) + 6, XD(2), r.y, '', ramp(u, r.at + 0.6, 0.5));
          dot(g, swing(u, r.at + 1.2, XD(0.35), XD(1.75), 1.2), r.y, '', ramp(u, r.at + 1.2, 0.4));
        }
      }));
    },

    /* 06 장소의 그림: at · on · in (지점 · 면 · 공간) → between · among · along · across · throughout · beyond */
    place(g, u) {
      const outA = 1 - ramp(u, 17.6, 0.5);
      const A = [
        { k: 'at', x: 80, at: 0.6, kind: '한 지점', ex: ['at the front desk', 'at the airport'] },
        { k: 'on', x: 460, at: 6.4, kind: '면 · 층 위', ex: ['on the wall', 'on the third floor'] },
        { k: 'in', x: 840, at: 12.4, kind: '둘러싸인 공간 · 도시', ex: ['in the lobby', 'in Seoul'] },
      ];
      fade(g, outA, () => {
        A.forEach(c => fade(g, ramp(u, c.at, 0.6), () => {
          panel(g, c.x, 146, 360, 296, { fill: COL.panel, stroke: COL.faint });
          txt(g, c.k, c.x + 24, 184, { size: 38, weight: 700, color: COL.rel });
          txt(g, c.kind, c.x + 24 + tw(g, c.k, 38, 700) + 16, 186, { size: 17, weight: 700, color: COL.verb });
          placeIcon(g, c.k, c.x + 180, 290, 300, 130, ramp(u, c.at + 0.4, 0.8));
          c.ex.forEach((e, j) => { txt(g, e, c.x + 24, 386 + j * 30, { size: 20, weight: 600, color: COL.en }); say(c.x + 18, 372 + j * 30, 320, 28, e); });
        }));
        fade(g, ramp(u, 14.2, 0.6), () => {
          const c = chip(g, '에서', LX, 500, { size: 20, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, h: 40, r: 10 });
          pieces(g, [['공항에서 → ', COL.soft], ['at', COL.rel, true], [' the airport', COL.verb], ['   서울에서 → ', COL.soft], ['in', COL.rel, true], [' Seoul', COL.verb]], c.x + c.w + 18, 500, 20, { say: 'at the airport, in Seoul' });
        });
      });
      const B = [
        { k: 'between', at: 18.4, ko: '둘 사이', ex: 'between A and B' },
        { k: 'among', at: 19.6, ko: '셋 이상 가운데', ex: 'among the staff' },
        { k: 'along', at: 24.2, ko: '길을 따라', ex: 'along the river' },
        { k: 'across', at: 25.3, ko: '건너서', ex: 'across the street' },
        { k: 'throughout', at: 26.4, ko: '곳곳에', ex: 'throughout the hotel' },
        { k: 'beyond', at: 27.5, ko: '넘어서', ex: 'beyond the gate' },
      ];
      B.forEach((c, i) => fade(g, ramp(u, c.at, 0.6), () => {
        const x = 84 + i * 188, cx = x + 86;
        panel(g, x, 146, 172, 262, { fill: COL.panel, stroke: i < 2 && u < 24 ? COL.rel : COL.faint });
        txt(g, c.k, cx, 180, { size: fit(g, c.k, 26, 156, 700), weight: 700, color: COL.rel, align: 'center' });
        placeIcon(g, c.k, cx, 266, 156, 104, ramp(u, c.at + 0.4, 0.8));
        txt(g, c.ko, cx, 350, { size: 17, weight: 700, color: COL.soft, align: 'center' });
        txt(g, c.ex, cx, 382, { size: fit(g, c.ex, 15, 160, 600), weight: 600, color: COL.en, align: 'center' });
        say(x, 366, 172, 32, c.ex);
      }));
      fade(g, ramp(u, 20.6, 0.5) * (1 - ramp(u, 29.6, 0.4)), () => tag(g, '둘 → between · 셋 이상 → among', LX, 456, COL.accent, { h: 38 }));
      fade(g, ramp(u, 30.2, 0.6), () => {
        phrase(g, 'throughout', 'the year', LX, 460, 26);
        txt(g, '한 해 내내 (시간에도 써요)', LX, 494, { size: 16, weight: 700, color: COL.soft });
        const M = ['1월', '3월', '5월', '7월', '9월', '11월', '12월'], a0 = 520, a1 = 1080;
        axis(g, a0, a1, 478, M);
        eventBlock(g, a0 - 4, a1 + 4, 478, '', 1);
        bar(g, a0, a1, 478, '', ramp(u, 30.8, 2));
      });
    },

    /* 07 뜻을 더하는 전치사: as(자격) → by(차이) · to(도착점) 막대그래프 → via · per · upon */
    extra(g, u) {
      const s0 = 'Mr. Park works as a consultant.';
      fade(g, ramp(u, 0.4, 0.6), () => {
        const L = lay(g, sent(s0, '', 'as', 'a consultant', 'a'), { x: LX, y: 176, size: 28 });
        drawLay(g, L); sayLay(L, s0);
        tag(g, '자격 → as (~로서)', W - 80, 176, COL.rel, { align: 'right' });
      });
      // 막대그래프
      const B = PR.BARS, base = 482, top = 272, sc = (base - top) / B.to, bw = 120, b1 = 200, b2 = 410;
      const grow = ramp(u, 6.6, 1.6), h2 = lerp(B.from, B.to, grow) * sc, h1 = B.from * sc;
      fade(g, ramp(u, 6, 0.6), () => {
        panel(g, LX, 214, 520, 310, { fill: COL.panel, stroke: COL.faint });
        g.fillStyle = COL.line; g.fillRect(LX + 40, base, 440, 2);
        rr(g, b1, base - h1, bw, h1, 6); g.fillStyle = 'rgba(127,224,168,0.45)'; g.fill();
        rr(g, b2, base - h2, bw, h2, 6); g.fillStyle = COL.clause; g.fill();
        txt(g, '지난해', b1 + bw / 2, base + 22, { size: 15, weight: 700, color: COL.muted, align: 'center' });
        txt(g, '올해', b2 + bw / 2, base + 22, { size: 15, weight: 700, color: COL.muted, align: 'center' });
        txt(g, '2.5 million', b1 + bw / 2, base - h1 - 16, { size: 14, weight: 700, color: COL.soft, align: 'center' });
        // 늘어난 차이 (분홍)
        if (grow > 0.02) {
          const yT = base - h2, yF = base - h1;
          rr(g, b2, yT, bw, yF - yT, 6); g.fillStyle = 'rgba(255,122,168,0.85)'; g.fill();
          g.setLineDash([5, 4]); g.strokeStyle = COL.dim; g.lineWidth = 1.5; g.beginPath(); g.moveTo(b1 + bw, yF); g.lineTo(b2 + bw + 14, yF); g.stroke(); g.setLineDash([]);
        }
        fade(g, ramp(u, 9, 0.5), () => {
          const yT = base - B.to * sc, yF = base - h1, bx = b2 + bw + 14;
          g.strokeStyle = COL.gap; g.lineWidth = 2.4; g.beginPath(); g.moveTo(bx, yT); g.lineTo(bx + 8, yT); g.lineTo(bx + 8, yF); g.lineTo(bx, yF); g.stroke();
          txt(g, 'by 20%', bx + 16, (yT + yF) / 2 - 10, { size: 15, weight: 700, color: COL.gap });
          txt(g, '차이', bx + 16, (yT + yF) / 2 + 10, { size: 14, weight: 700, color: COL.gap });
        });
        fade(g, ramp(u, 12.6, 0.5), () => {
          const yT = base - B.to * sc;
          txt(g, '3 million', b2 + bw / 2, yT - 18, { size: 14, weight: 700, color: COL.soft, align: 'center' });
          g.setLineDash([6, 4]); g.strokeStyle = COL.rel; g.lineWidth = 2; g.beginPath(); g.moveTo(LX + 40, yT); g.lineTo(b2 - 6, yT); g.stroke(); g.setLineDash([]);
          txt(g, 'to · 도착점', LX + 46, yT - 14, { size: 15, weight: 700, color: COL.rel });
        });
      });
      const rows = [
        { s: 'Sales increased by 20 percent.', p: 'by', n: '20 percent', y: 290, at: 7.4, ko: '→ 늘어난 차이', c: COL.gap },
        { s: 'Sales increased to 3 million dollars.', p: 'to', n: '3 million dollars', y: 400, at: 12.4, ko: '→ 막대가 다다른 도착점', c: COL.rel },
      ];
      rows.forEach((r, k) => fade(g, ramp(u, r.at, 0.6), () => {
        const L = lay(g, sent(r.s, 'increased', r.p, r.n, 'r' + k), { x: 640, y: r.y, size: 26, maxW: 560 });
        drawLay(g, L); sayLay(L, r.s);
        txt(g, r.ko, 640, r.y + 38, { size: 18, weight: 700, color: r.c });
      }));
      fade(g, ramp(u, 18.4, 0.6), () => tag(g, 'by → 자란 만큼 · to → 막대의 끝', 640, 490, COL.accent, { h: 38 }));
      const C = [{ p: 'via', n: 'e-mail', ko: '~을 거쳐', at: 24.4 }, { p: 'per', n: 'person', ko: '~마다', at: 26.4 }, { p: 'upon', n: 'arrival', ko: '~하자마자', at: 29.4 }];
      C.forEach((c, i) => fade(g, ramp(u, c.at, 0.6), () => {
        const x = LX + i * 380;
        panel(g, x, 540, 360, 40, { fill: COL.panel2, stroke: COL.faint, r: 10 });
        const w = phrase(g, c.p, c.n, x + 18, 561, 20);
        txt(g, c.ko, x + 18 + w + 18, 561, { size: 17, weight: 700, color: COL.soft });
      }));
    },

    /* 08 짝 카드: 앞 낱말이 고르는 전치사 → 한국어 조사의 함정 → 명사의 짝 */
    pairs(g, u) {
      const C1 = [['responsible', 'for'], ['eligible', 'for'], ['interested', 'in'], ['familiar', 'with']];
      C1.forEach(([h, p], i) => fade(g, ramp(u, 0.8 + i * 0.3, 0.5), () => {
        const x = 80 + i * 280, w = 260, y = 150, flip = ramp(u, 6.4 + i * 1.1, 0.6), sx = Math.abs(Math.cos(flip * Math.PI)), back = flip >= 0.5;
        g.save(); g.translate(x + w / 2, y + 38); g.scale(Math.max(0.02, sx), 1);
        rr(g, -w / 2, -38, w, 76, 12); g.fillStyle = back ? COL.panel2 : COL.panel; g.fill(); g.strokeStyle = back ? COL.rel : COL.ante; g.lineWidth = 2; g.stroke();
        if (back) pieces(g, pair2(h, p), 0, 0, 24, { align: 'center' });
        else pieces(g, [[h, COL.ante, true], [' ___', COL.muted]], 0, 0, 24, { align: 'center' });
        g.restore();
        if (back) say(x, y, w, 76, h + ' ' + p);
      }));
      fade(g, ramp(u, 2.2, 0.5), () => txt(g, '짝 표현 = 앞 낱말 + 정해진 전치사 · 규칙보다 짝으로 외워요', LX, 260, { size: 17, weight: 700, color: COL.soft }));
      const K = [['~에 접근', 'access', 'to', 12.4], ['~에 달려 있다', 'depend', 'on', 14.6], ['~을 따르다', 'comply', 'with', 18.4], ['~에 답하다', 'respond', 'to', 19.8], ['~로 이루어지다', 'consist', 'of', 21.2]];
      K.forEach(([ko, h, p, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = 310 + i * 50;
        const c = chip(g, ko, LX, y, { size: 17, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, h: 36, r: 10 });
        arrow(g, 260, y, 292, y, COL.muted, 2);
        pieces(g, pair2(h, p), 306, y, 22, { say: h + ' ' + p });
        void c;
      }));
      const N = [['an increase', 'in', 'sales', 24.4], ['demand', 'for', 'electric cars', 25.6], ['a solution', 'to', 'the problem', 26.8]];
      N.forEach(([h, p, rest, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = 328 + i * 76;
        panel(g, 640, y - 28, 560, 56, { fill: COL.panel, stroke: COL.faint, r: 12 });
        pieces(g, pair2(h, p, rest), 664, y, 22, { say: `${h} ${p} ${rest}` });
        txt(g, '명사 + 짝', 1176, y, { size: 14, weight: 700, color: COL.muted, align: 'right' });
      }));
      fade(g, ramp(u, 29.4, 0.6), () => tag(g, '빈칸 앞 낱말에 짝이 있으면 → 짝 카드 먼저', W - 80, 112, COL.accent, { align: 'right', h: 38 }));
    },

    /* 09 3단계 풀이법 흐름도 (판정기로 길이 켜짐) */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 무엇', sub: '무엇을 나타내나', at: 5.4, boxes: [
          ['뒤가 때', '→ 시간', COL.clause], ['뒤가 곳', '→ 장소', COL.clause], ['뒤가 자격 · 숫자 · 경로 · 단위', '→ 뜻을 더하는 말', COL.clause],
          ['앞 낱말에 정해진 짝', '→ 짝 표현', COL.ante], ['접속사 보기 (while …)', '→ 뒤가 명사라서 탈락', COL.bad]] },
        { x: 480, head: '② 뒤의 명사', sub: '명사의 종류', at: 11.4, boxes: [
          ['시각 · 날 · 큰 칸', '→ at · on · in', COL.verb], ['한 시점 (그때)', '→ by · until · since', COL.verb], ['숫자 길이 · 사건', '→ for · within · in · during', COL.verb],
          ['지점 · 면 · 공간 · 둘 · 무리', '→ at · on · in · between · among', COL.verb], ['자격 · 숫자 · 경로 · 단위', '→ as · by · to · via · per', COL.verb]] },
        { x: 880, head: '③ 그림 · 짝', sub: '마지막 확인', at: 17.4, boxes: [
          ['끝나나 · 이어지나 · 지금까지', '→ by · until · since', COL.clause], ['내내 · 그 안에 · 그만큼 뒤', '→ for · during · within · in', COL.clause],
          ['따라 · 건너 · 곳곳 · 넘어', '→ along · across · throughout · beyond', COL.clause], ['차이 · 도착점', '→ by · to', COL.clause], ['앞 낱말의 짝', '→ 짝 카드 (responsible for …)', COL.ante]] },
      ];
      const P = S.path && S.path.cls && S.path.noun && (S.path.cls === 'pair' || S.path.pic) ? S.path : null;
      let on = [[], [], []], verdict = null;
      if (P) {
        const R = PR.decide(P.cls, P.noun, P.pic), f = PR.flow(P.cls, P.noun, P.pic);
        on = f.map(b => b >= 0 ? [b] : []);
        verdict = R.ok ? R.why : R.why;
        if (!R.ok) { on[1] = []; on[2] = []; }
      }
      cols.forEach((c, ci) => {
        fade(g, ramp(u, c.at, 0.6), () => {
          panel(g, c.x, 146, 340, 54, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 20, 173, { size: 22, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 320, 173, { size: 15, weight: 600, color: COL.muted, align: 'right' });
          c.boxes.forEach(([k, v, col], bi) => {
            const y = 212 + bi * 62, lit = P && on[ci].includes(bi);
            fade(g, ramp(u, c.at + 0.5 + bi * 0.45, 0.5) * (P && !lit ? 0.4 : 1), () => {
              panel(g, c.x, y, 340, 54, { fill: lit ? 'rgba(255,193,94,0.14)' : COL.panel, stroke: lit ? COL.rel : COL.faint, lw: lit ? 2.5 : 1.5, r: 12 });
              txt(g, k, c.x + 14, y + 16, { size: fit(g, k, 15, 312, 700), weight: 700, color: COL.soft });
              txt(g, v, c.x + 14, y + 38, { size: fit(g, v, 17, 312, 700), weight: 700, color: col });
            });
          });
          if (ci < 2) fade(g, ramp(u, cols[ci + 1].at - 0.3, 0.5), () => arrow(g, c.x + 348, 173, c.x + 392, 173, COL.accent, 3));
        });
      });
      if (verdict) {
        const size = fit(g, verdict, 18, 1080, 700, 13);
        chip(g, verdict, W / 2, 552, { size, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 42, r: 10 });
      }
    },

    /* 10 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = PR.DRILL[P.k];
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0] + 0.6, s3 = v >= P.win;
        // 빈칸 자리는 처음부터 답의 너비로 잡아 둠 → 답을 채울 때 줄이 바뀌지 않음
        const minW = Math.max(...it.opts.map(o => tw(g, o, 31, 700) / 31 + 0.7));
        const T = drillToks(it, 'p' + pi).map(tk => tk.r === 'blank' ? Object.assign({}, tk, { t: it.opts[it.a], r: s3 ? 'ans' : 'blank', minW }) : tk);
        let L, size = 31;
        do { L = lay(g, T, { x: LX, y: 234, size, maxW: 1110, lh: 54 }); size -= 1; } while (L.lines > 1 && size >= 26);
        const pair = it.cls === 'pair';
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: v >= P.at[1] && !s3 ? 0.6 : 0, hide: true }
          : tk.tag === 'head' ? (s1 ? { cue: true, cueColor: COL.ante } : { r: '' })
          : tk.tag === 'n' ? (pair ? (v >= P.at[1] ? { cue: true } : { r: '' }) : s1 ? { cue: true } : { r: '' })
          : tk.tag === 'act' ? (v >= P.at[2] ? { cue: true, cueColor: COL.clause, cueDash: true } : { r: '' }) : {});
        sayLay(L, it.q.replace('___', it.opts[it.a]));
        const nn = byTag(L, 'n'), hh = byTag(L, 'head');
        if (pair && hh) under(g, hh, '앞 낱말', COL.ante, ramp(v, P.at[0] + 0.8, 0.4), -46, 15);
        else if (nn) under(g, nn, '빈칸 뒤', COL.verb, ramp(v, P.at[0] + 0.8, 0.4), -46, 15);
        const oy = L.lines > 1 ? 352 : 318;
        it.opts.forEach((o, k) => {
          const ox = LX + (k % 2) * 290, y = oy + Math.floor(k / 2) * 92, j = PR.judgeOpt(it, k);
          const at = j.step ? P.x[j.step - 1] : 1e9;
          const right = k === it.a, gone = !right && v >= at, win = right && s3;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, o, ox + 52, y, { size: 27, weight: win ? 700 : 600, color: win ? COL.good : gone ? COL.dim : COL.text });
          const gloss = pair ? '' : PR.P[o] ? PR.P[o].ko : '접속사 · ' + PR.CONJ[o], gw = gloss ? tw(g, gloss, 14, 600) : 0;
          if (gloss) fade(g, ramp(v, P.at[0] + 1.2, 0.5), () => txt(g, gloss, ox + 52, y + 30, { size: 14, weight: 600, color: gone ? COL.dim : COL.muted }));
          if (gone) {
            const gp = clamp((v - at) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, y + 1); g.lineTo(ox - 4 + (w + 62) * gp, y + 1); g.stroke();
          }
          if (win) { const pw = Math.max(w + 84, gw + 70); panel(g, ox - 14, y - 26, pw, gloss ? 70 : 52, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + pw - 2 + 16, y, 18); }
        });
        panel(g, 660, oy - 40, 560, 236, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = oy - 2 + k * 72;
          txt(g, ['① 무엇', '② 뒤의 명사', pair ? '③ 짝 카드' : '③ 그림'][k], 684, y, { size: 18, weight: 700, color: COL.accent });
          txt(g, ln, 684, y + 30, { size: fit(g, ln, 18, 512, 600), weight: 600, color: k === 2 ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 470, 780], Y0 = 152, RH = 40;
      const rows = [
        ['시각 · 날 · 큰 칸', 'at · on · in', 'at noon · on Monday · in May', COL.rel],
        ['한 시점 + 끝나는 일 · 이어지는 일', 'by · until', 'by Friday · until 9 p.m.', COL.rel],
        ['과거 시점부터 지금까지 (현재완료)', 'since', 'has worked here since 2021', COL.rel],
        ['숫자 길이 · 사건', 'for · during', 'for three hours · during the meeting', COL.rel],
        ['그 길이 안에 · 지금부터 그만큼 뒤', 'within · in', 'within 30 days · in two weeks', COL.rel],
        ['지점 · 면 · 공간 · 둘 · 셋 이상', 'at · on · in · between · among', 'in the lobby · among the staff', COL.rel],
        ['자격 · 숫자의 차이 · 도착점', 'as · by · to', 'as a consultant · rose by 20 percent', COL.rel],
        ['앞 낱말의 짝', '짝 카드', 'responsible for · comply with', COL.ante],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 12, { fill: COL.panel, stroke: COL.faint });
        ['뒤에 오는 말 · 그림', '전치사', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 18, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 4, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.55, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 18;
        txt(g, r[0], X[0] + 20, y, { size: fit(g, r[0], 18, X[1] - X[0] - 30, 600), weight: 600 });
        txt(g, r[1], X[1] + 20, y, { size: fit(g, r[1], 19, X[2] - X[1] - 30, 700), weight: 700, color: r[3] });
        txt(g, r[2], X[2] + 20, y, { size: fit(g, r[2], 18, 1200 - X[2] - 30, 500), weight: 500, color: COL.en });
        if (ri < 7) say(X[2] + 14, y - 18, 420, 36, r[2].replace(/ · /g, ', '));
      }));
      const steps = ['① 무엇', '② 뒤의 명사', '③ 그림 · 짝'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 6.5 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 552, { size: 19, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 44, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 552, c.x + c.w + 46, 552, COL.accent, 2.5);
        x = c.x + c.w + 58;
      }));
    },
  };

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

  /* ---------- 놀이터 ①: 까지 갈림길의 시간선. 논리 크기 1000×250 (좁은 화면에서는 640×290으로 글자를 키움) ----------
   * r: PR.ROAD의 문장 · prep: 고른 전치사 · o: { w: 논리 너비, dot: 끌어 놓은 점의 자리(0→1, 없으면 기본 자리) }
   * 돌려주는 값: { drag: { x0, x1, y, x } 끌 수 있는 점이 있으면, status: { ok, text } 점의 자리 판정 }
   */
  PRS.ROADSTAGE = { w: 1000, h: 250, nw: 640, nh: 290 };
  PRS.road = function (g, r, prep, o = {}) {
    const SW = o.w || PRS.ROADSTAGE.w, narrow = SW < 800, SH = narrow ? PRS.ROADSTAGE.nh : PRS.ROADSTAGE.h, s = g.canvas.width / SW;
    g.setTransform(s, 0, 0, s, 0, 0); g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, SW, SH);
    g.fillStyle = COL.grid; for (let x = 20; x < SW; x += 40) for (let y = 20; y < SH; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const T = r.tl, x0 = narrow ? 60 : 90, x1 = SW - (narrow ? 90 : 170), y = narrow ? 168 : 146, ts = narrow ? 18 : 15, ls = narrow ? 19 : 16;
    const X = i => tickX(T.ticks, i, x0, x1), N = T.now != null ? X(T.now) : null;
    axis(g, x0, x1, y, T.ticks, { ts, ty: narrow ? 26 : 22, skip: T.now != null && T.ticks[T.now] === (T.nowLabel || '지금') ? [T.now] : [] });
    if (N != null) nowMark(g, N, y, 1, T.nowLabel || '지금');
    const j = prep ? PR.judge(prep, r) : null, okc = !j || j.s === 'ok' ? COL.clause : COL.trap;
    // 뒤의 명사 그리기: 그때(깃발) · 길이(자) · 사건(칸)
    const fx = T.at != null ? X(T.at) : T.ev ? X(T.ev[0]) : null;
    const span = T.len != null ? [X(T.from || 0), X((T.from || 0) + T.len)] : null;
    if (T.at != null) flag(g, X(T.at), y, r.nounText, 1, { size: ls, top: true });
    if (span) ruler(g, span[0], span[1], y, r.nounText, 1, { size: ls, dy: prep === 'within' || prep === 'in' ? (narrow ? 64 : 58) : 34 });
    if (T.ev) eventBlock(g, X(T.ev[0]), X(T.ev[1]), y, r.nounText, 1, { size: ls, ly: narrow ? 64 : 56 });
    if (!prep) return {};
    const P = PR.ROAD_PIC[prep], lab = r.actKo, out = {}, bad = j.s !== 'ok';
    let msg = '';
    const dragDot = (def, inside) => {
      const f = o.dot == null ? def : clamp(o.dot), x = lerp(x0, x1, f), inn = inside(x);
      dot(g, x, y, lab + (bad ? '?' : ''), 1, { color: bad ? COL.trap : inn ? okc : COL.bad, r: narrow ? 12 : 10, size: ls, dy: narrow ? 30 : 26 });
      out.drag = { x0, x1, y, x };
      return inn;
    };
    const frac = x => clamp((x - x0) / (x1 - x0));
    if (prep === 'in' && r.noun === 'month') {   // in 2019 → 그해에 (그때에 일어남)
      const xa = X(T.at) - 30, xb = X(T.at) + 30;
      boxSpan(g, xa, xb, y, '', 1, { color: okc }); dot(g, X(T.at), y, '', 1, { color: okc });
      if (bad) msg = `그해에 한 번? ${r.act} → 그때부터 지금까지`;
    } else if (P === 'end' || P === 'continue' || P === 'from') {
      if (fx == null) {   // 시점이 없음: 길이만 있음
        flag(g, span ? span[1] : X(T.ticks.length - 1), y, '시점?', 1, { q: true, size: ls, color: COL.trap });
        msg = `${prep} 뒤에는 한 시점이 와야 해요 · ${r.nounText} → 숫자로 잰 길이`;
      } else if (P === 'end') {
        const a = N != null ? N : x0;
        zone(g, Math.min(a, fx) + 4, Math.max(a, fx) - 4, y, 1, bad ? 'rgba(255,159,122,0.13)' : 'rgba(127,224,168,0.13)');
        const inn = dragDot(frac(lerp(a, fx, 0.45)), x => x <= fx + 2);
        if (!bad) out.status = inn ? { ok: true, text: '깃발 전 → 마감을 지켰어요' } : { ok: false, text: '깃발 뒤 → 늦었어요' };
        else msg = r.shape === 'state' ? `쭉 이어지는 일을 깃발 전에 한 번 끝낸다?` : `깃발 전에 끝낸다? 문장의 뜻과 달라요`;
      } else if (P === 'continue') {
        if (N != null && fx < N) { bar(g, x0, fx - 4, y, lab + '?', 1, { color: COL.trap, size: ls, dy: narrow ? 30 : 24 }); msg = `깃발에서 멈춘다? ${r.act} → 지금까지 이어져요`; }
        else {
          bar(g, (N != null ? N : x0) + 4, fx - 4, y, lab + (bad ? '?' : ''), 1, { color: okc, size: ls, dy: narrow ? 30 : 24 });
          if (bad) msg = r.shape === 'once' ? '한 번에 끝나는 일을 깃발까지 계속?' : '깃발까지 쭉? 문장의 뜻과 달라요';
        }
      } else {   // since: 과거의 깃발 → 지금
        if (N != null && fx < N) bar(g, fx + 4, N - 6, y, lab, 1, { color: okc, head: true, size: ls, dy: narrow ? 30 : 24 });
        else { bar(g, (N != null ? N : x0) + 4, fx - 4, y, '', 1, { color: COL.trap }); msg = 'since → 과거의 그때부터 지금까지인데, 깃발이 앞날에 있어요'; }
      }
    } else if (prep === 'during') {
      if (!T.ev) { const xa = span ? span[0] : X(0.6), xb = span ? span[1] : X(2.4); eventBlock(g, xa, xb, y, '사건?', 1, { q: true, size: ls }); msg = `during 뒤에는 사건이 와야 해요 · ${r.nounText} → ${PR.NOUN[r.noun].name}`; }
      else if (r.shape === 'once') {
        const a = X(T.ev[0]), b = X(T.ev[1]);
        const inn = dragDot(frac(lerp(a, b, 0.5)), x => x >= a - 2 && x <= b + 2);
        out.status = inn ? { ok: true, text: `${T.name} 동안 → 맞아요` } : { ok: false, text: `${T.name} 밖 → 그 사건 동안이 아니에요` };
      } else bar(g, X(T.ev[0]) + 6, X(T.ev[1]) - 6, y, lab, 1, { color: okc, size: ls });
    } else {   // for · within · in: 길이가 필요
      if (!span) {
        const xa = N != null ? N : x0, xb = Math.min(x1, xa + (x1 - x0) * 0.4);
        ruler(g, xa, xb, y, '길이?', 1, { q: true, color: COL.trap, size: ls, dy: 34 });
        msg = `${prep} 뒤에는 숫자로 잰 길이가 와야 해요 · ${r.nounText} → ${PR.NOUN[r.noun].name}`;
      } else if (prep === 'for') {
        bar(g, span[0] + 2, span[1] - 2, y, lab + (bad ? '?' : ''), 1, { color: okc, size: ls, dy: narrow ? 30 : 24 });
        if (bad) msg = '그 길이 내내 쭉? 문장의 뜻과 달라요';
      } else if (prep === 'within') {
        boxSpan(g, span[0] + 2, span[1], y, '', 1, { size: ls });
        const inn = dragDot(frac(lerp(span[0], span[1], 0.5)), x => x >= span[0] - 2 && x <= span[1] + 2);
        if (!bad) out.status = inn ? { ok: true, text: '상자 안 → 그 길이 안의 한때' } : { ok: false, text: '상자 밖 → 그 길이가 지났어요' };
        else msg = '그 안 아무 때나 한 번? 문장의 뜻과 달라요';
      } else {   // in + 길이: 지금부터 그만큼 뒤 한 점
        arc(g, span[0], y - 8, span[1], y - 8, 40, okc, 1, { dash: true });
        dot(g, span[1], y, lab + (bad ? '?' : ''), 1, { color: okc, r: narrow ? 12 : 10, size: ls, dy: narrow ? 30 : 26 });
        if (bad) msg = '그만큼 뒤의 한 점? 문장의 뜻과 달라요';
      }
    }
    if (bad && !msg) msg = '그림이 문장의 뜻과 달라요';
    if (msg) txt(g, msg, SW / 2, y + (narrow ? 66 : 56), { size: fit(g, msg, ls, SW - 40, 700), weight: 700, color: COL.trap, align: 'center' });
    else if (out.status) txt(g, out.status.text, SW / 2, y + (narrow ? 66 : 56), { size: fit(g, out.status.text, ls, SW - 40, 700), weight: 700, color: out.status.ok ? COL.good : COL.bad, align: 'center' });
    return out;
  };

  PRS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[PRS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, PRS.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  // 직접 해 보기로만 나오는 글자(다른 예문 · 판정기 · 놀이터)도 함께 넣음
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + PR.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←✓×?~=+-/:…‘’%';
  PRS.baseText = EXTRA;
  PRS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = PRS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { PRS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
