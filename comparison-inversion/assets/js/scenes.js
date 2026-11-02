/* 비교·가정법·도치 튜토리얼 — 영상 장면
 *
 * CIS.render(g, t)는 시각 t와 사용자 상태 CIS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 영어 문장은 낱말 조각(토큰)으로 그리고, 역할마다 색을 칠합니다:
 *   신호어 보라 · 짝(답) · 앞으로 나오는 조동사 노랑 · 주어 하늘 · 범위 · if절 민트 · 함정 주황 · 빈칸 분홍 점선
 * 틀을 바꾸면(as → than, If we had → Had we, … only after → Only after …) 같은 id의 토큰이 미끄러집니다(morph).
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(CI.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const CI = window.CI;
  const CIS = (window.CIS = {});
  const W = 1280, H = 720;
  CIS.W = W; CIS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  CIS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  CIS.COL = COL;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (CIS.S = { word: 0, f02: null, cond: null, ifback: false, neg: null, sig: null });
  CIS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  CIS.hits = () => HITS;

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
    if (o.label && p > 0.6) txt(g, o.label, cx, cy + h * 0.5 - 14, { size: o.lsize || 15, weight: 700, color, align: 'center' });
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
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; g.stroke(); }
  }
  const say = (x, y, w, h, text) => HITS.push({ x, y, w, h, say: text });

  /* ---------- 영어 문장 토큰 배치와 그리기 ---------- */
  // 토큰 { id, t: 글자, r: 역할 }. 역할: sig 신호어 · p 짝(답) · aux 앞으로 나오는 조동사 · subj 주어 · rng 범위·if절
  //   trap 함정 · ghost 줄어든 말 · fn 기능어 · blank 빈칸 · ans 채운 답 · bad 틀림 · ok 맞음 · '' 보통
  const RCOL = { sig: COL.verb, p: COL.rel, aux: COL.rel, subj: COL.ante, rng: COL.clause, trap: COL.trap, ghost: COL.dim, fn: COL.muted, bad: COL.bad, ok: COL.good, dim: COL.dim };
  const UNDER = { sig: 1, p: 1, aux: 1, subj: 1 };
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
      l.forEach(it => { it.x += x0; it.y = o.y + li * lh; it.line = li; items.push(it); byId[it.id] = it; });
    });
    const left = Math.min(...items.map(i => i.x)), right = Math.max(...items.map(i => i.x + i.w));
    return { items, byId, size, lines: lines.length, x: left, w: right - left, y: o.y, h: (lines.length - 1) * lh + size * 1.3, lh };
  }
  CIS.lay = lay;
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
  // [글자, 역할, id] 목록 → 토큰
  const toks = (T, pre = '') => T.map(([t, r, id], i) => ({ id: pre + (id || 'k' + i), t, r: r || '', tag: id }));
  const byTag = (L, tg) => L.items.find(i => i.tag === tg || i.id === tg);
  const blankOf = L => L.items.find(i => i.r === 'blank' || i.r === 'ans');
  // 토큰 하나 그리기. o: { a, r: 역할 바꾸기, color, cue: 단서 상자, cueColor, cueDash, glow: 빈칸 반짝임, plain: 밑줄 없이, strike: 0→1 줄 긋기 }
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
    } else {
      const c = o.color || RCOL[r] || COL.text;
      txt(g, it.t, x, y + 1, { size, weight: UNDER[r] ? 600 : 500, color: c });
      if (UNDER[r] && !o.plain) { g.fillStyle = c; g.fillRect(x, y + size * 0.56, w, 3); }
      if (r === 'bad') { g.strokeStyle = COL.bad; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x + w + 3, y + 2); g.stroke(); }
      if (o.strike > 0) { g.strokeStyle = o.strikeColor || COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x - 3 + (w + 6) * clamp(o.strike), y + 2); g.stroke(); }
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
        // 왼쪽(앞)으로 멀리 가는 토큰은 위로 살짝 뛰어넘어 감 → 다른 낱말과 겹쳐 보이지 않음
        const dx = b.x - a.x, hop = dx < -a.size * 0.6 && a.line === b.line ? Math.sin(Math.PI * e) * Math.min(a.size * 1.15, -dx * 0.45) : 0;
        const m = Object.assign({}, b, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) - hop, w: lerp(a.w, b.w, e), size: lerp(a.size, b.size, e) });
        if (a.t === b.t && a.r === b.r) drawTok(g, m, style(b, e));
        else { drawTok(g, Object.assign({}, m, { t: a.t, r: a.r }), Object.assign({}, style(a, e), { a: 1 - e })); drawTok(g, m, Object.assign({}, style(b, e), { a: e })); }
      } else if (a) drawTok(g, a, Object.assign({}, style(a, e), { a: 1 - ramp(p, 0, 0.5) }));
      else drawTok(g, b, Object.assign({}, style(b, e), { a: ramp(p, 0.5, 0.5) }));
    });
  }
  CIS.morph = morph; CIS.drawLay = drawLay;
  // 같은 id가 크게 움직일 때 위로 휘는 점선 (조동사가 주어 앞으로 가는 길)
  function moveTrail(g, A, B, id, p, color = COL.rel) {
    const a = A.byId[id], b = B.byId[id];
    if (!a || !b || p <= 0.02 || p >= 1) return;
    fade(g, Math.sin(Math.PI * clamp(p)), () => arc(g, a.x + a.w / 2, a.y - a.size * 0.7, b.x + b.w / 2, b.y - b.size * 0.7, 34, color, 1, { dash: true }));
  }
  function sayLay(L, text) { say(L.x - 8, L.y - L.size * 0.8, L.w + 16, L.h + L.size * 0.3, text); }
  // 토큰 아래(dy > 0) 또는 위(dy < 0) 가운데에 작은 글
  function under(g, it, s, color, a = 1, dy = 44, size = 16) {
    if (!it) return;
    fade(g, a, () => { const hw = tw(g, s, size, 700) / 2, cx = Math.max(LX + hw - 20, it.x + it.w / 2); txt(g, s, cx, it.y + dy, { size, weight: 700, color, align: 'center' }); });
  }
  // 낱말을 조각내어 그림. parts: [[글자, 색, 밑줄('s' = 줄 긋기)]] → 너비
  function pieces(g, parts, x, y, size, o = {}) {
    let w = 0; parts.forEach(([t]) => { w += tw(g, t, size, 600); });
    let xx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    parts.forEach(([t, c, ul]) => {
      const ww = txt(g, t, xx, y, { size, weight: 600, color: c || COL.text });
      if (ul === 's') { g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(xx - 2, y + 2); g.lineTo(xx + ww + 2, y + 2); g.stroke(); }
      else if (ul) { g.fillStyle = c; g.fillRect(xx, y + size * 0.56, ww, 3); }
      xx += ww;
    });
    return w;
  }
  // 틀린 말: 줄 긋기 + × (p: 줄이 그어진 정도)
  function wrongPhrase(g, s, x, y, size, p, o = {}) {
    const w = txt(g, s, x, y, { size, weight: 600, color: o.color || COL.trap });
    if (p > 0) { g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - 4, y + 2); g.lineTo(x - 4 + (w + 8) * clamp(p), y + 2); g.stroke(); }
    if (p >= 1) mark(g, false, x + w + 24, y, 15);
    say(x - 6, y - size * 0.75, w + 12, size * 1.5, s);
    return w;
  }
  // 칩을 한 줄로 늘어놓음. 하나씩 나타남
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
  // 짝 화살표: 신호어 토큰(들) → 빈칸·답. 같은 줄에 있을 때만
  function pairArc(g, from, to, p, o = {}) {
    if (!from || !to || from.line !== to.line || p <= 0.001) return;
    const fx = from.x + from.w / 2, txx = to.x + to.w / 2, y = Math.min(from.y, to.y) - from.size * 0.72;
    arc(g, fx, y, txx, y, o.h || 26 + Math.min(30, Math.abs(txx - fx) * 0.08), o.color || COL.rel, p, { label: o.label, lsize: o.lsize, dash: o.dash });
  }

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '작은 낱말 하나가 답을 정해요', d: 25, caps: [
      [0.4, 5.5, '토익 Part 5에는 빈칸 옆의 작은 낱말 하나가 답을 정하는 문제가 있어요.'],
      [5.5, 11, '이 문제를 보세요. 빈칸 뒤에 larger than. 보기는 many, very, much, most.'],
      [11, 16, '답을 정하는 말 → than. 이런 낱말을 **신호어**라고 부를게요. 신호어는 늘 **짝**을 불러요.'],
      [16, 20.5, '‘매우’ 뜻의 very? ‘훨씬’ 뜻의 much? 정답은 영상 끝에서 함께 풀어요.'],
      [20.5, 25, '**비교**, **가정법**, **도치**를 차례로 배우고 **3단계 풀이법**으로 묶어요.'],
    ] },
    { id: 'forms', n: '01', title: '세 모양, 비교 표시는 한 번', sub: '원급 · 비교급 · 최상급', d: 32, caps: [
      [0.4, 6, '먼저 비교부터 볼게요. 한국어는 ‘가볍다’의 모양을 그대로 두고 ‘보다’, ‘가장’을 붙여 비교해요.'],
      [6, 11.5, '영어는 낱말의 모양이 바뀌어요. light → lighter → lightest. **원급**, **비교급**, **최상급**이에요.'],
      [11.5, 17, '긴 낱말은 꼬리 대신 앞에 붙여요 → more, most. reliable → more reliable → most reliable.'],
      [17, 22, '모양이 아예 바뀌는 낱말도 있어요 → good, better, best.'],
      [22, 27, '비교 표시는 **한 번만** 해요. 그래서 more lighter, more better → 틀려요.'],
      [27, 32, '이 세 모양은 혼자 오지 않아요. 짝이 되는 신호어와 함께 와요.'],
    ] },
    { id: 'asthan', n: '02', title: 'as … as와 than', sub: '원급의 짝, 비교급의 짝', d: 34, caps: [
      [0.4, 6, '첫 번째 짝 → as … as. 두 as 사이에는 늘 **원급**이 와요. as light as → ~만큼 가벼운.'],
      [6, 12, '비교급의 짝 → than. lighter than → ~보다 가벼운. 빈칸 바로 뒤가 than → 비교급.'],
      [12, 18, '거꾸로 풀어도 돼요. 빈칸 앞뒤에 as → 원급, 빈칸 뒤에 than → 비교급.'],
      [18, 24, '함정 하나. as more efficient as → 틀려요. as … as 사이에 비교급을 넣으면 짝이 어긋나요.'],
      [24, 29, '‘덜 ~한’은 less + 원급 + than이에요 → less expensive than. less 자체가 비교 표시예요.'],
      [29, 34, '그래서 less more expensive → 이것도 틀려요. 여기서도 비교 표시는 한 번만.'],
    ] },
    { id: 'strong', n: '03', title: '훨씬은 much, than 대신 to', sub: '비교급 강조 · 라틴어 비교급', d: 34, caps: [
      [0.4, 6, '비교급을 세게 말할 때는 앞에 붙여요 → much, even, far, still, a lot. much larger than.'],
      [6, 11.5, '한국어로는 ‘훨씬’이에요. very = ‘매우’라서 원급만 꾸며요 → very large.'],
      [11.5, 17, 'very larger, more larger → 틀려요. 비교급 앞의 강조어는 much 쪽이에요.'],
      [17, 23, '이번에는 짝이 다른 비교급이에요 → superior to, inferior to, prior to, senior to.'],
      [23, 29, '라틴어에서 온 비교급이라 끝이 -or예요. 이미 비교의 뜻이 들어 있어서 짝 → to.'],
      [29, 34, '그래서 superior than → 틀려요. 네 낱말은 superior to처럼 한 덩어리로 외워 두세요.'],
    ] },
    { id: 'sup', n: '04', title: '최상급과 the 비교급', sub: 'the + 범위 · one of the · The …, the', d: 34, caps: [
      [0.4, 6, '최상급의 짝 → the + 범위. the lightest of the three, the largest in Asia.'],
      [6, 12, '지금까지를 뜻하는 ever → 이것도 범위 신호예요. the best result we have ever had.'],
      [12, 18, '자주 나오는 모양 → one of the + 최상급 + 복수 명사. one of the largest suppliers.'],
      [18, 23, '여럿 가운데 하나라서 명사는 꼭 **복수**예요. one of the largest supplier → 틀려요.'],
      [23, 28.5, '마지막 짝 → The 비교급, the 비교급. The sooner you register, the more you save.'],
      [28.5, 34, '‘~할수록 더 ~하다’라는 뜻이에요. 앞에 The + 비교급 → 뒤에도 the + 비교급.'],
    ] },
    { id: 'cond', n: '05', title: '가정법은 한 칸 뒤로', sub: 'If + 과거 · If + had p.p.', d: 36, caps: [
      [0.4, 6, '이번에는 문장 전체의 짝이에요. 사실과 반대로 상상하는 문장을 **가정법**이라고 해요.'],
      [6, 12, '한국어 ‘직원을 더 뽑는다면 제때 끝낼 텐데’는 지금 이야기라서 현재 모양이에요.'],
      [12, 18, '영어는 동사를 **한 칸 과거로** 보내요. If we hired more staff, we would finish the project on time.'],
      [18, 24, '지난 일을 반대로 상상하면 한 칸 더 → If we had hired more staff, we would have finished.'],
      [24, 30, '짝이 정해져 있어요. If + 과거 → would + 원형. If + had p.p. → would have p.p.'],
      [30, 36, '함정 둘. 가정법 주절에는 will → 쓰지 않아요. if절 안에는 would → 쓰지 않아요.'],
    ] },
    { id: 'ifless', n: '06', title: 'if가 사라지면', sub: 'Should · Had · Were 도치', d: 34, caps: [
      [0.4, 6, '토익에 자주 나오는 모양이에요. 맨 앞의 if → 사라지고, 조동사 → 주어 앞으로. 이것을 **도치**(inversion)라고 해요.'],
      [6, 12, 'If we had known → Had we known. had → 주어 we 앞으로 갔어요.'],
      [12, 18, 'If you should have any questions → Should you have any questions. ‘혹시 ~하면’이라는 뜻이에요.'],
      [18, 24, 'If I were in your position → Were I in your position. if 자리를 대신하는 도치 → 이 셋뿐이에요.'],
      [24, 29, '그래서 맨 앞에 Should, Had, Were + 주어, 그리고 콤마가 보이면 → 숨은 if.'],
      [29, 34, '짝도 있어요. Should + 주어 + 동사원형, Had + 주어 + p.p., Were + 주어 + 보어.'],
    ] },
    { id: 'neg', n: '07', title: '맨 앞의 부정어', sub: 'Only · Never · Not only + 조동사 + 주어', d: 40, caps: [
      [0.4, 6, '두 번째 도치는 문장 맨 앞에 ‘부정’이나 ‘~만’의 말이 올 때예요. 이때도 조동사가 주어 앞으로 가요.'],
      [6, 12, 'We will announce the results only after the review. → Only after the review will we announce the results.'],
      [12, 18, '앞으로 나온 덩어리 뒤에서 will → we 앞으로. 질문할 때와 같은 어순이에요. 한국어는 어순이 그대로예요.'],
      [18, 24, '조동사가 없으면 데려와요 → do, does, did. Not only did the campaign increase sales, but it also cut costs.'],
      [24, 30, 'did 뒤에는 동사원형이에요. did the campaign increased → 틀려요. 과거 표시를 두 번 했으니까요.'],
      [30, 35, '맨 앞이 Never, Rarely, Seldom, Under no circumstances → 모두 같아요. 조동사 + 주어.'],
      [35, 40, '‘~도 그래요’의 so, neither 뒤에도 같은 어순이에요 → and so did the marketing team.'],
    ] },
    { id: 'method', n: '08', title: '3단계 풀이법', sub: '신호어 → 짝 → 함정', d: 30, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 12, '① **신호어**를 찾아요. as, than, the + 범위, superior, if절의 동사, 맨 앞의 Should, Had, Were, Only, Never.'],
      [12, 18, '② **짝**을 맞춰요. as → 원급, than → 비교급, 범위 → 최상급, If + had p.p. → would have p.p., 맨 앞 부정어 → 조동사 + 주어.'],
      [18, 24.5, '③ **함정**을 확인해요. very + 비교급, more + -er, superior than, if절의 would, 도치 문장에 남은 If.'],
      [24.5, 30, '이 순서로 처음 본 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '09', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '첫 문제예요. ① 신호어 → larger than. 빈칸은 비교급을 꾸미는 자리예요. 탈락 → (A) many.'],
      [6, 12, '② 짝 → 비교급을 세게 하는 말은 much 쪽이에요. 최상급 표시라서 탈락 → (D) most.'],
      [12, 18, '③ 함정 → very = 원급만 꾸며요. 탈락 → (B) very. 정답은 (C) much.'],
      [18.4, 24.5, '두 번째 문제. ① 신호어 → 맨 앞의 빈칸, 콤마, would have taken. 숨은 if예요. 탈락 → (D) Have.'],
      [24.5, 31, '② 짝 → 빈칸 뒤 we known = 주어 + p.p. → Had. 탈락 → (C) Should.'],
      [31, 37, '③ 함정 → if절로 쓰려면 → If we had known. 탈락 → (B) If. 정답은 (A) Had.'],
      [37.4, 43.5, '세 번째. ① 신호어 → 맨 앞의 Not only. 뒤는 도치예요. 동사가 없어서 탈락 → (C) to increase.'],
      [43.5, 50, '② 짝 → 조동사 + 주어 어순이에요. 보통 어순이라서 탈락 → (A).'],
      [50, 56, '③ 함정 → did 뒤에는 동사원형. 탈락 → (B). 정답은 (D) did the campaign increase.'],
    ] },
    { id: 'summary', n: '10', title: '정리', sub: '한눈에 보는 표', d: 22, caps: [
      [0.4, 6, '정리해요. 비교, 가정법, 도치 문제는 신호어 하나가 짝을 불러요.'],
      [6, 12, 'as → 원급, than → 비교급, the + 범위 → 최상급. 비교급을 세게 할 때 → much, even, far.'],
      [12, 17, '맨 앞의 Should, Had, Were → 숨은 if. 맨 앞의 부정어 → 조동사 + 주어.'],
      [17, 22, '아래에서 신호어 스위치와 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  CIS.CHAPTERS = CHAPTERS; CIS.CAPTIONS = CAPTIONS; CIS.END = END;
  CIS.POSTER = CHAPTERS.find(c => c.id === 'neg').t + 38.5;
  CIS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  CIS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(CI.DRILL)에서 세 개. ①·②·③에서 지워지는 보기를 규칙 엔진으로 정함
  // at: 오른쪽 풀이 줄이 나오는 때 · x: ①·②·③ 탈락 줄이 그어지는 때 · win: 정답 표시
  const PRACTICE = [
    { k: 1, at: [0.4, 6, 12], x: [4.6, 10.4, 14.2], win: 15.4, lines: ['larger than → 강조어 자리 · (A) 탈락', '비교급의 짝 → much 쪽 · (D) 탈락', 'very = 원급만 · (B) 탈락 → (C) much'] },
    { k: 9, at: [0.2, 6.3, 12.8], x: [4.8, 10.6, 15.2], win: 16.2, lines: ['맨 앞 빈칸 + would have → 숨은 if · (D) 탈락', 'we known = 주어 + p.p. → Had · (C) 탈락', 'If라면 If we had known · (B) 탈락 → (A) Had'] },
    { k: 12, at: [0.2, 6.3, 12.8], x: [4.8, 10.6, 15.2], win: 16.2, lines: ['맨 앞 Not only → 도치 · (C) 탈락', '조동사 + 주어 어순 · (A) 탈락', 'did 뒤 동사원형 · (B) 탈락 → (D)'] },
  ];
  PRACTICE.forEach(p => {
    const it = CI.DRILL[p.k], L = 'ABCD';
    [1, 2, 3].forEach(step => {
      const out = it.opts.map((o, i) => CI.judgeOpt(it, i).step === step ? `(${L[i]})` : '').filter(Boolean).join(' ');
      if (!out || !p.lines[step - 1].includes(out + ' 탈락')) console.warn('[비교·도치] 실전 문제 탈락 표시가 규칙 엔진과 달라요:', it.q, step, out);
    });
    if (!p.lines[2].includes(`(${L[it.a]})`)) console.warn('[비교·도치] 실전 문제 정답 표시가 데이터와 달라요:', it.q);
    it.opts.forEach((o, i) => { if ((CI.judgeOpt(it, i).s === 'ok') !== (i === it.a)) console.warn('[비교·도치] 실전 문제가 규칙 엔진과 달라요:', it.q); });
  });
  // 연습 문제 → 토큰 (신호어 · 단계 표시를 한 덩어리로)
  function drillToks(it, pre = 'q') {
    const spec = (it.mk || []).map(([t, role], i) => [t, role === 'ante' ? 'subj' : role === 'trap' ? 'trap' : 'sig', 'm' + i]);
    return phraseToks(it.q, spec, pre);
  }

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o)); }
  const FAM = k => CI.fam(k);
  const FR = (fk, k) => CI.frameOf(fk, k);
  // 신호어 스위치 틀 하나를 정답으로 채운 배치
  const swLay = (g, fk, k, w, o) => lay(g, CI.build(FAM(fk), FR(fk, k), w, 'ans'), o);
  const swSay = (fk, k, w) => CI.sentence(FAM(fk), FR(fk, k), w);
  // 낱말 꼬리(-er · -est)에 색: 규칙 변화면 꼬리만, 불규칙이면 전체
  function formParts(pos, f, c) {
    if (f.startsWith('more ') || f.startsWith('most ')) return [[f.slice(0, 5), c, true], [f.slice(5), COL.text]];
    if (f === pos) return [[f, COL.text]];
    const stem = pos.slice(0, pos.length - 1);
    if (!f.startsWith(stem)) return [[f, c, true]];
    const tail = f.endsWith('est') ? 3 : 2;
    return [[f.slice(0, f.length - tail), COL.text], [f.slice(f.length - tail), c, true]];
  }
  function formRow(g, D, x, y, size, u, at, step = 0.6) {
    let xx = x;
    D.f.forEach((f, k) => {
      fade(g, ramp(u, at + k * step, 0.45), () => {
        const w = pieces(g, formParts(D.f[0], f, COL.rel), xx, y, size);
        say(xx - 6, y - size * 0.75, w + 12, size * 1.5, f);
      });
      xx += tw(g, f, size, 600);
      if (k < 2) { fade(g, ramp(u, at + (k + 1) * step - 0.1, 0.4), () => txt(g, '→', xx + 16, y, { size: size * 0.8, weight: 600, color: COL.muted })); xx += size + 22; }
    });
    return xx;
  }

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(비교급 앞 강조어) → 신호어와 짝 → 3단계 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '신호어가 짝을 부른다', W / 2, 290, { size: 64, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Comparison · Conditionals · Inversion', W / 2, 366, { size: 26, weight: 500, color: COL.muted, align: 'center' });
      });
      const CH0 = ['as … as', '-er … than', 'the -est … in', 'Should · Had', 'Only after'], cw0 = CH0.reduce((s, w) => s + tw(g, w, 19, 700) + 28 + 12, -12);
      fade(g, out1, () => chipRow(g, CH0, W / 2 - cw0 / 2, 456, u, 1.2, { color: COL.verb, size: 19, h: 42, step: 0.35 }));
      const it = CI.DRILL[1];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 19, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 160, 1000, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 180, 198, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const L = lay(g, drillToks(it), { x: 180, y: 294, size: 30, maxW: 930, lh: 56 });
        const s1 = u > 10.6, s2 = u > 15.6;
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: s2 ? 0.5 + 0.5 * Math.sin(u * 4) : 0 } : tk.r === 'sig' ? (s1 ? { cue: true } : { r: '' }) : { r: '' });
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        const sg = L.items.find(t => t.r === 'sig'), bk = blankOf(L);
        under(g, sg, '신호어', COL.verb, ramp(u, 11.2, 0.5), -58, 17);
        fade(g, ramp(u, 11.8, 0.5), () => arc(g, sg.x + 30, sg.y - 30, bk.x + bk.w / 2, bk.y - 26, 40, COL.rel, ramp(u, 11.8, 0.8), { label: '짝', lsize: 17 }));
        fade(g, ramp(u, 16, 0.5), () => {
          tag(g, '매우 very?', bk.x + bk.w / 2 - 8, 354, COL.trap, { align: 'right' });
          tag(g, '훨씬 much?', bk.x + bk.w / 2 + 8, 354, COL.rel, { align: 'left' });
        });
        it.opts.forEach(([o], k) => {
          const ox = 200 + (k % 2) * 400, oy = 420 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            txt(g, o, ox + 64, oy, { size: 30, weight: 600 });
          });
        });
      });
      const steps = [['①', '신호어 찾기', 'as · than · the · If · Only'], ['②', '짝 맞추기', '신호어가 부르는 모양'], ['③', '함정 확인', 'very · more · If 남기기']];
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

    /* 01 세 모양: 한국어는 ‘보다 · 가장’을 붙이고 모양은 그대로 ↔ 영어는 꼬리가 바뀜 → more · most → 불규칙 → 비교 표시 한 번 */
    forms(g, u) {
      const w = CI.FORMS01[S.word || 0], D = CI.adj(w);
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, LX, 146, 540, 204, { fill: COL.panel, stroke: COL.faint });
        label(g, '한국어', LX + 24, 174, { size: 16, color: COL.soft });
      });
      [['저것', '보다', 222], ['', '가장', 288]].forEach(([a, b, y], k) => fade(g, ramp(u, 0.9 + k * 1.2, 0.5), () => {
        let x = LX + 24;
        if (a) x += txt(g, a, x, y, { size: 32, weight: 600 });
        x += txt(g, b, x, y, { size: 32, weight: 700, color: COL.verb });
        g.fillStyle = COL.verb; g.fillRect(x - tw(g, b, 32, 700), y + 19, tw(g, b, 32, 700), 3);
        txt(g, ' ' + D.kf[2], x, y, { size: 32, weight: 600 });
      }));
      fade(g, ramp(u, 3.4, 0.5), () => txt(g, `${D.kf[2]} → 모양 그대로`, LX + 24, 330, { size: 17, weight: 700, color: COL.muted }));
      fade(g, ramp(u, 6, 0.6), () => {
        panel(g, 660, 146, 540, 204, { fill: COL.panel, stroke: COL.faint });
        label(g, '영어', 684, 174, { size: 16, color: COL.soft });
      });
      formRow(g, D, 684, 238, 32, u, 6.6, 0.7);
      fade(g, ramp(u, 8.6, 0.5), () => {
        let xx = 684;
        ['원급', '비교급', '최상급'].forEach((nm, k) => { const fw = tw(g, D.f[k], 32, 600); txt(g, nm, xx + fw / 2, 284, { size: 16, weight: 700, color: k ? COL.rel : COL.muted, align: 'center' }); xx += fw + (k < 2 ? 32 + 22 : 0); });
        txt(g, '낱말의 모양이 바뀌어요', 684, 330, { size: 17, weight: 700, color: COL.muted });
      });
      // 긴 낱말 · 불규칙
      fade(g, ramp(u, 11.8, 0.4), () => label(g, '긴 낱말', LX, 410, { size: 16, color: COL.soft }));
      formRow(g, CI.adj('reliable'), LX + 96, 410, 26, u, 12.2, 0.6);
      fade(g, ramp(u, 17.2, 0.4), () => label(g, '불규칙', LX, 466, { size: 16, color: COL.soft }));
      formRow(g, CI.adj('good'), LX + 96, 466, 26, u, 17.6, 0.6);
      fade(g, ramp(u, 14.4, 0.5), () => tag(g, '앞에 more · most', W - 80, 410, COL.rel, { align: 'right' }));
      fade(g, ramp(u, 19.4, 0.5), () => tag(g, '모양이 아예 바뀜', W - 80, 466, COL.rel, { align: 'right' }));
      // 비교 표시 두 번
      fade(g, ramp(u, 22.2, 0.5), () => {
        const x1 = LX + 96, d1 = CI.dbl(w) || 'more lighter';
        label(g, '두 번', LX, 530, { size: 16, color: COL.trap });
        const w1 = wrongPhrase(g, d1, x1, 530, 26, ramp(u, 23.6, 0.6));
        wrongPhrase(g, 'more better', x1 + w1 + 70, 530, 26, ramp(u, 24.4, 0.6));
      });
      fade(g, ramp(u, 25, 0.5), () => tag(g, '비교 표시는 한 번만', W - 80, 530, COL.trap, { align: 'right' }));
      fade(g, ramp(u, 27.4, 0.6), () => tag(g, '세 모양 + 신호어 = 짝', W - 80, 112, COL.accent, { align: 'right', h: 38 }));
    },

    /* 02 as … as와 than: as frame → than frame (morph) → 규칙 둘 → as more … as 함정 → less + 원급 */
    asthan(g, u) {
      const y = 222, o = { x: LX, y, size: 34 };
      const fixed = S.f02, wFor = k => k === 'less' ? 'expensive' : 'light';
      let Lt;
      if (fixed) {
        Lt = swLay(g, 'cmp', fixed, wFor(fixed), o);
        drawLay(g, Lt); sayLay(Lt, swSay('cmp', fixed, wFor(fixed)));
      } else {
        const A = swLay(g, 'cmp', 'as', 'light', o), B = swLay(g, 'cmp', 'than', 'light', o), p = ramp(u, 6.2, 1.2);
        fade(g, ramp(u, 0.4, 0.6), () => { if (p > 0 && p < 1) morph(g, A, B, p); else drawLay(g, p >= 1 ? B : A); });
        Lt = p >= 1 ? B : A;
        if (u > 0.4) sayLay(Lt, p >= 1 ? swSay('cmp', 'than', 'light') : swSay('cmp', 'as', 'light'));
        if (p <= 0) fade(g, ramp(u, 1.6, 0.5), () => { arc(g, A.byId.as1.x + A.byId.as1.w / 2, y - 26, A.byId.as2.x + A.byId.as2.w / 2, y - 26, 30, COL.verb, ramp(u, 1.6, 0.8), { label: '짝', lsize: 16 }); under(g, A.byId.X, '원급', COL.rel, 1, 46, 17); });
        if (p >= 1) fade(g, ramp(u, 7.6, 0.5), () => { pairArc(g, B.byId.than, B.byId.X, ramp(u, 7.6, 0.8), { label: '짝', lsize: 16 }); under(g, B.byId.X, '비교급', COL.rel, 1, 46, 17); });
      }
      if (fixed) {
        const fr = FR('cmp', fixed), from = Lt.byId[fr.pair], X = Lt.byId.X;
        if (fixed === 'as') arc(g, Lt.byId.as1.x + Lt.byId.as1.w / 2, y - 26, Lt.byId.as2.x + Lt.byId.as2.w / 2, y - 26, 30, COL.verb, 1, { label: '짝', lsize: 16 });
        else pairArc(g, from, X, 1, { label: '짝', lsize: 16 });
        under(g, X, fixed === 'than' ? '비교급' : '원급', COL.rel, 1, 46, 17);
      }
      // 규칙 둘
      fade(g, ramp(u, 12.2, 0.5), () => tag(g, '빈칸 앞뒤에 as → 원급', LX, 316, COL.verb));
      fade(g, ramp(u, 13.2, 0.5), () => tag(g, '빈칸 뒤에 than → 비교급', LX + 290, 316, COL.verb));
      // 함정: as more efficient as
      fade(g, ramp(u, 18.2, 0.5), () => {
        const w1 = wrongPhrase(g, 'as more efficient as', LX, 390, 28, ramp(u, 19.6, 0.6));
        fade(g, ramp(u, 20.6, 0.5), () => { const w2 = pieces(g, [['as ', COL.verb], ['efficient', COL.rel, true], [' as', COL.verb]], LX + w1 + 90, 390, 28); mark(g, true, LX + w1 + 110 + w2, 390, 16); say(LX + w1 + 84, 370, w2 + 12, 40, 'as efficient as'); });
      });
      // less + 원급 + than
      const Ll = swLay(g, 'cmp', 'less', 'expensive', { x: LX, y: 470, size: 30 });
      fade(g, ramp(u, 24.2, 0.6), () => {
        drawLay(g, Ll); sayLay(Ll, swSay('cmp', 'less', 'expensive'));
        under(g, Ll.byId.X, '원급', COL.rel, ramp(u, 25.4, 0.4), 42, 16);
        under(g, Ll.byId.less, '비교 표시', COL.verb, ramp(u, 26, 0.4), 42, 16);
      });
      fade(g, ramp(u, 29.2, 0.5), () => {
        wrongPhrase(g, 'less more expensive', LX, 556, 26, ramp(u, 30, 0.6));
        tag(g, '비교 표시는 한 번만', W - 80, 556, COL.trap, { align: 'right' });
      });
    },

    /* 03 훨씬은 much (very ×), than 대신 to (라틴어 비교급) */
    strong(g, u) {
      const outA = 1 - ramp(u, 16.4, 0.6);
      fade(g, outA, () => {
        const T = toks([['The new hall', 'subj', 'S'], ['is', '', 'is'], ['much', 'p', 'much'], ['larger than', 'sig', 'cmp'], ['the old one', '', 'O'], ['.', '', 'd']], 'h');
        const L = lay(g, T, { x: LX, y: 216, size: 34 });
        fade(g, ramp(u, 0.4, 0.6), () => { drawLay(g, L); sayLay(L, 'The new hall is much larger than the old one.'); });
        under(g, byTag(L, 'much'), '훨씬', COL.rel, ramp(u, 1.4, 0.4), 46, 17);
        fade(g, ramp(u, 2.2, 0.5), () => label(g, '비교급 앞 강조어', LX, 304, { size: 16, color: COL.soft }));
        chipRow(g, ['much', 'even', 'far', 'still', 'a lot'], LX + 150, 304, u, 2.4, { color: COL.good, size: 18, h: 38, step: 0.3 });
        fade(g, ramp(u, 6.4, 0.5), () => {
          label(g, '원급 강조', LX, 384, { size: 16, color: COL.soft });
          const w2 = pieces(g, [['very ', COL.rel], ['large', COL.text]], LX + 150, 384, 28);
          mark(g, true, LX + 170 + w2, 384, 16); say(LX + 144, 364, w2 + 12, 40, 'very large');
          txt(g, 'very = ‘매우’ → 원급만 꾸밈', LX + 220 + w2, 384, { size: 17, weight: 600, color: COL.muted });
        });
        fade(g, ramp(u, 11.6, 0.5), () => {
          label(g, '비교급 앞', LX, 450, { size: 16, color: COL.trap });
          const w1 = wrongPhrase(g, 'very larger', LX + 150, 450, 28, ramp(u, 12.2, 0.6));
          wrongPhrase(g, 'more larger', LX + 150 + w1 + 70, 450, 28, ramp(u, 13, 0.6));
        });
        fade(g, ramp(u, 14, 0.5), () => tag(g, '비교급 앞 → much 쪽', W - 80, 450, COL.good, { align: 'right' }));
      });
      // 라틴어 비교급
      fade(g, ramp(u, 17, 0.6), () => label(g, '짝 → to (than 아님)', LX, 176, { size: 17, color: COL.soft }));
      let x = LX;
      ['superior', 'inferior', 'prior', 'senior'].forEach((wd, k) => {
        const px = x;
        fade(g, ramp(u, 17.6 + k * 0.5, 0.4), () => {
          const ww = pieces(g, [[wd, COL.verb, true], [' to', COL.rel, true]], px + 16, 240, 28);
          rr(g, px, 216, ww + 32, 48, 10); g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.stroke();
          say(px, 216, ww + 32, 48, wd + ' to');
        });
        x += tw(g, wd + ' to', 28, 600) + 32 + 18;
      });
      fade(g, ramp(u, 23.2, 0.5), () => {
        let xx = LX;
        ['superior', 'inferior', 'prior', 'senior'].forEach(wd => { const w0 = pieces(g, [[wd.slice(0, -2), COL.text], [wd.slice(-2), COL.rel, true]], xx, 330, 34); xx += w0 + 40; });
        txt(g, '라틴어에서 온 비교급 · 이미 비교의 뜻이 들어 있어요', LX, 376, { size: 18, weight: 700, color: COL.muted });
      });
      const Ls = lay(g, toks([['Our service', 'subj', 'S'], ['is', '', 'is'], ['superior', 'sig', 'sup'], ['to', 'p', 'to'], ['that of our competitors', '', 'O'], ['.', '', 'd']], 's'), { x: LX, y: 470, size: 32 });
      fade(g, ramp(u, 28.8, 0.6), () => { drawLay(g, Ls); sayLay(Ls, 'Our service is superior to that of our competitors.'); pairArc(g, byTag(Ls, 'sup'), byTag(Ls, 'to'), ramp(u, 29.4, 0.6), { label: '짝', lsize: 15, h: 22 }); });
      fade(g, ramp(u, 30.4, 0.5), () => { wrongPhrase(g, 'superior than', LX, 546, 28, ramp(u, 31, 0.6)); tag(g, 'superior to · 한 덩어리', W - 80, 546, COL.rel, { align: 'right' }); });
    },

    /* 04 최상급과 the 비교급: the + 범위 → ever → one of the + 최상급 + 복수 → The 비교급, the 비교급 */
    sup(g, u) {
      const outA = 1 - ramp(u, 22.6, 0.5);
      fade(g, outA, () => {
        const rows = [
          ['the lightest of the three models', [['the', 'sig', 't'], ['lightest', 'p', 'x'], ['of the three models', 'rng', 'r']], 204, 0.6],
          ['the largest supplier in Asia', [['the', 'sig', 't'], ['largest', 'p', 'x'], ['in Asia', 'rng', 'r']], 262, 1.8],
          ['the best result we have ever had', [['the', 'sig', 't'], ['best', 'p', 'x'], ['we have ever had', 'rng', 'r']], 320, 6.4],
        ];
        rows.forEach(([s, sp, y, at], k) => fade(g, ramp(u, at, 0.5), () => {
          const L = lay(g, phraseToks(s, sp, 'r' + k), { x: LX, y, size: 30 });
          drawLay(g, L); sayLay(L, s);
        }));
        fade(g, ramp(u, 3.2, 0.5), () => tag(g, 'the + 최상급 + 범위', W - 80, 204, COL.verb, { align: 'right' }));
        fade(g, ramp(u, 7.6, 0.5), () => tag(g, '범위 = of · in · among · ever', W - 80, 320, COL.clause, { align: 'right' }));
        // one of the + 최상급 + 복수 명사
        fade(g, ramp(u, 12.2, 0.6), () => {
          const y = 414, w = pieces(g, [['one of the ', COL.verb, true], ['largest', COL.rel, true], [' supplier', COL.text], ['s', COL.rel, true]], LX, y, 30);
          say(LX - 6, y - 22, w + 12, 44, 'one of the largest suppliers');
          fade(g, ramp(u, 13.6, 0.4), () => txt(g, '복수', LX + w - 6, y + 40, { size: 16, weight: 700, color: COL.rel, align: 'center' }));
          fade(g, ramp(u, 14.4, 0.5), () => tag(g, '여럿 가운데 하나 → 복수 명사', W - 80, y, COL.rel, { align: 'right' }));
        });
        fade(g, ramp(u, 18.2, 0.5), () => wrongPhrase(g, 'one of the largest supplier', LX, 492, 28, ramp(u, 19.4, 0.6)));
        fade(g, ramp(u, 20, 0.5), () => txt(g, '한국어 ‘가장 큰 업체 중 하나’에는 복수 표시가 없어요', LX, 548, { size: 18, weight: 600, color: COL.muted }));
      });
      // The 비교급, the 비교급
      const inB = ramp(u, 23, 0.6);
      fade(g, inB, () => {
        const T = toks([['The', 'sig', 't1'], ['sooner', 'p', 'c1'], ['you register', '', 'a'], [',', '', 'cm'], ['the', 'sig', 't2'], ['more', 'p', 'c2'], ['you save', '', 'b'], ['.', '', 'd']], 'tt');
        const L = lay(g, T, { x: LX, y: 236, size: 38 });
        drawLay(g, L); sayLay(L, 'The sooner you register, the more you save.');
        const t1 = byTag(L, 't1'), t2 = byTag(L, 't2');
        arc(g, t1.x + t1.w / 2, t1.y - 28, t2.x + t2.w / 2, t2.y - 28, 34, COL.verb, ramp(u, 24.2, 0.8), { label: '짝', lsize: 16 });
        under(g, byTag(L, 'c1'), '비교급', COL.rel, ramp(u, 25, 0.4), 48, 16);
        under(g, byTag(L, 'c2'), '비교급', COL.rel, ramp(u, 25.4, 0.4), 48, 16);
      });
      fade(g, ramp(u, 28.6, 0.5), () => {
        const y = 340;
        let x = LX + txt(g, '빨리 등록', LX, y, { size: 30, weight: 600 });
        x += txt(g, '할수록', x, y, { size: 30, weight: 700, color: COL.verb });
        x += txt(g, ' 더 많이 아껴요.', x, y, { size: 30, weight: 600 });
        txt(g, '~할수록 더 ~하다', x + 30, y, { size: 18, weight: 700, color: COL.muted });
      });
      fade(g, ramp(u, 30, 0.5), () => tag(g, 'The + 비교급 …, the + 비교급 …', LX, 420, COL.verb, { h: 40, size: 18 }));
      fade(g, ramp(u, 31, 0.6), () => {
        const L = lay(g, toks([['The', 'sig', 'a'], ['earlier', 'p', 'b'], ['you register', '', 'c'], [',', '', 'cm'], ['the more', 'sig', 'd'], ['you will save', '', 'e'], ['.', '', 'f']], 'e'), { x: LX, y: 500, size: 28 });
        drawLay(g, L); sayLay(L, 'The earlier you register, the more you will save.');
      });
    },

    /* 05 가정법: 한국어는 현재 모양 → 영어는 한 칸 과거로(hire → hired, will → would) → 한 칸 더 → 짝 → 함정 */
    cond(g, u) {
      fade(g, ramp(u, 0.4, 0.6), () => tag(g, '가정법 = 사실과 반대로 상상하기', LX, 166, COL.accent, { h: 38 }));
      fade(g, ramp(u, 6.2, 0.6), () => {
        const y = 226;
        let x = LX + txt(g, '직원을 더 ', LX, y, { size: 28, weight: 600 });
        const bw = txt(g, '뽑는다면', x, y, { size: 28, weight: 700, color: COL.verb });
        g.fillStyle = COL.verb; g.fillRect(x, y + 17, bw, 3); x += bw;
        x += txt(g, ', 제때 끝낼 텐데.', x, y, { size: 28, weight: 600 });
        fade(g, ramp(u, 8.2, 0.5), () => tag(g, '한국어 → 지금 이야기라 현재 모양', W - 80, y, COL.muted, { align: 'right', size: 16, h: 34 }));
      });
      const o1 = { x: LX, y: 314, size: 28 }, o2 = { x: LX, y: 424, size: 28 };
      const F = FAM('cond');
      if (S.cond) {
        const L = swLay(g, 'cond', S.cond, null, o1);
        drawLay(g, L); sayLay(L, swSay('cond', S.cond));
        label(g, CI.MOOD[FR('cond', S.cond).c.mood], LX, 276, { size: 16, color: COL.soft });
        under(g, byTag(L, 'X'), CI.CONDN[CI.cands(F, FR('cond', S.cond)).find(x => x.j.s === 'ok').code], COL.rel, 1, 38, 16);
      } else {
        const A = swLay(g, 'cond', 'real', null, o1), B = swLay(g, 'cond', 'now', null, o1), p = ramp(u, 13, 1.2);
        fade(g, ramp(u, 12, 0.5), () => {
          if (p > 0 && p < 1) morph(g, A, B, p); else drawLay(g, p >= 1 ? B : A);
          sayLay(B, swSay('cond', p >= 1 ? 'now' : 'real'));
          fade(g, ramp(u, 14.4, 0.5), () => { label(g, '지금 사실의 반대 · 가정법 과거', LX, 276, { size: 16, color: COL.soft }); under(g, byTag(B, 'v'), '과거형', COL.verb, 1, 38, 16); under(g, byTag(B, 'X'), 'would + 원형', COL.rel, 1, 38, 16); });
        });
        const C = swLay(g, 'cond', 'past', null, o2), B2 = swLay(g, 'cond', 'now', null, o2), q = ramp(u, 18.8, 1.2);
        fade(g, ramp(u, 18.2, 0.5), () => {
          if (q > 0 && q < 1) morph(g, B2, C, q); else drawLay(g, q >= 1 ? C : B2);
          sayLay(C, swSay('cond', q >= 1 ? 'past' : 'now'));
          fade(g, ramp(u, 20.2, 0.5), () => { label(g, '지난 일의 반대 · 가정법 과거완료', LX, 386, { size: 16, color: COL.soft }); under(g, byTag(C, 'aux'), 'had + p.p.', COL.verb, 1, 38, 16); under(g, byTag(C, 'X'), 'would have + p.p.', COL.rel, 1, 38, 16); });
        });
      }
      fade(g, ramp(u, 24.2, 0.5), () => tag(g, 'If + 과거 ↔ would + 원형', LX, 512, COL.rel, { h: 38, size: 18 }));
      fade(g, ramp(u, 25.4, 0.5), () => tag(g, 'If + had p.p. ↔ would have p.p.', 520, 512, COL.rel, { h: 38, size: 18 }));
      fade(g, ramp(u, 30.4, 0.5), () => tag(g, '가정법 주절의 will ×', LX, 560, COL.trap, { size: 16, h: 30 }));
      fade(g, ramp(u, 32.6, 0.5), () => tag(g, 'if절 안의 would ×', LX + 240, 560, COL.trap, { size: 16, h: 30 }));
    },

    /* 06 if가 사라지면: 세 문장의 If가 사라지고 조동사가 주어 앞으로 (morph) → 숨은 if → 짝 */
    ifless(g, u) {
      const rows = [[220, 0.6, 6.6], [336, 12.2, 13.4], [452, 18.2, 19.4]];
      CI.INV3.forEach((r, k) => {
        const [y, at, mt] = rows[k], o = { x: LX, y, size: 30 };
        const A = lay(g, toks(r.a, 'i' + k), o), B = lay(g, toks(r.b, 'i' + k), o);
        const p = S.ifback ? 0 : ramp(u, mt, 1.2);
        fade(g, S.ifback ? 1 : ramp(u, at, 0.5), () => {
          if (p > 0 && p < 1) { morph(g, A, B, p); moveTrail(g, A, B, 'i' + k + 'aux', p); }
          else drawLay(g, p >= 1 ? B : A);
          sayLay(p >= 1 ? B : A, CI.text(p >= 1 ? r.b : r.a));
          if (p <= 0 && !S.ifback) under(g, A.byId['i' + k + 'if'], '사라져요', COL.verb, ramp(u, mt - 1.4, 0.4) * (k === 0 ? 1 : 0), -44, 15);
          if (p >= 1) under(g, B.byId['i' + k + 'aux'], k === 0 ? '조동사 → 주어 앞' : '앞으로', COL.rel, ramp(u, mt + 1.2, 0.4), -44, 15);
        });
        fade(g, S.ifback ? 0 : ramp(u, 29.2 + k * 0.6, 0.5), () => tag(g, r.pair, W - 80, y + 48, COL.rel, { align: 'right', size: 16, h: 32 }));
      });
      fade(g, S.ifback ? 0 : ramp(u, 24.2, 0.5), () => tag(g, '맨 앞 Should · Had · Were + 주어 …, → 숨은 if', LX, 556, COL.verb, { h: 40, size: 18 }));
      if (S.ifback) fade(g, 1, () => tag(g, 'if를 되살린 문장 (보통의 if절)', LX, 556, COL.muted, { h: 40, size: 17 }));
    },

    /* 07 맨 앞의 부정어: … only after the review → Only after the review will we … (morph) → do 데려오기 → 함정 → 목록 → so */
    neg(g, u) {
      const o = { x: LX, y: 200, size: 32 };
      if (S.neg) {
        const L = swLay(g, 'inv', S.neg, null, o);
        drawLay(g, L); sayLay(L, swSay('inv', S.neg));
        under(g, byTag(L, 'aux'), S.neg === 'plain' ? '보통 어순' : '조동사 → 주어 앞', COL.rel, 1, -44, 15);
      } else {
        const A = swLay(g, 'inv', 'plain', null, o), B = swLay(g, 'inv', 'only', null, o), p = ramp(u, 6.6, 1.4);
        fade(g, ramp(u, 0.4, 0.6), () => {
          if (p > 0 && p < 1) { morph(g, A, B, p); moveTrail(g, A, B, 'aux', p); moveTrail(g, A, B, 'front', p, COL.verb); }
          else drawLay(g, p >= 1 ? B : A);
          sayLay(p >= 1 ? B : A, swSay('inv', p >= 1 ? 'only' : 'plain'));
          if (p >= 1) { under(g, byTag(B, 'front'), '맨 앞으로', COL.verb, ramp(u, 8.2, 0.4), 44, 15); under(g, byTag(B, 'aux'), '조동사 → 주어 앞', COL.rel, ramp(u, 12.4, 0.4), -44, 15); }
        });
      }
      fade(g, ramp(u, 14.8, 0.5), () => {
        txt(g, '검토가 끝난 뒤에야 결과를 발표할 거예요.', LX, 292, { size: 24, weight: 600, color: COL.soft });
        tag(g, '한국어 → 어순 그대로', W - 80, 292, COL.muted, { align: 'right', size: 16, h: 34 });
      });
      const Ln = lay(g, toks([['Not only', 'sig', 'n'], ['did', 'aux', 'd'], ['the campaign', 'subj', 's'], ['increase', 'p', 'v'], ['sales', '', 'o'], [',', '', 'cm'], ['but it also cut costs', '', 'b'], ['.', '', 'e']], 'n'), { x: LX, y: 380, size: 28 });
      fade(g, ramp(u, 18.4, 0.6), () => {
        drawLay(g, Ln); sayLay(Ln, 'Not only did the campaign increase sales, but it also cut costs.');
        under(g, byTag(Ln, 'd'), '데려온 did', COL.rel, ramp(u, 19.6, 0.4), -40, 15);
        under(g, byTag(Ln, 'v'), '동사원형', COL.rel, ramp(u, 24.4, 0.4), 40, 15);
      });
      fade(g, ramp(u, 25.4, 0.5), () => {
        const y = 456, w0 = pieces(g, [['did the campaign ', COL.soft]], LX, y, 26);
        wrongPhrase(g, 'increased', LX + w0, y, 26, ramp(u, 26.2, 0.6));
        fade(g, ramp(u, 27.4, 0.4), () => txt(g, '과거 표시 두 번', LX + w0 + 180, y, { size: 17, weight: 700, color: COL.trap }));
      });
      fade(g, ramp(u, 30.2, 0.5), () => label(g, '맨 앞이', LX, 514, { size: 16, color: COL.soft }));
      const xe = chipRow(g, ['Never', 'Rarely', 'Seldom', 'Under no circumstances', 'Not until'], LX + 70, 514, u, 30.4, { color: COL.verb, size: 17, h: 36, step: 0.35 });
      fade(g, ramp(u, 32.4, 0.5), () => txt(g, '→ 조동사 + 주어', xe + 4, 514, { size: 18, weight: 700, color: COL.rel }));
      const Lso = lay(g, toks([['The sales team met its target', '', 'a'], [',', '', 'cm'], ['and so', 'sig', 'so'], ['did', 'aux', 'd'], ['the marketing team', 'subj', 's'], ['.', '', 'e']], 'so'), { x: LX, y: 566, size: 24 });
      fade(g, ramp(u, 35.2, 0.6), () => { drawLay(g, Lso); sayLay(Lso, 'The sales team met its target, and so did the marketing team.'); });
    },

    /* 08 3단계 풀이법 흐름도 (신호어를 고르면 길이 켜짐) */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 신호어', sub: '짝을 부르는 말', at: 5.6, boxes: [
          ['원급 · 비교급', 'as … as · than · less', COL.verb], ['최상급 · 짝 낱말', 'the + 범위 · one of · superior', COL.verb],
          ['가정법', 'if절의 동사 · 맨 앞 Should · Had', COL.verb], ['도치', '맨 앞 Only · Never · so', COL.verb]] },
        { x: 480, head: '② 짝', sub: '신호어가 부르는 모양', at: 11.6, boxes: [
          ['as → 원급 · than → 비교급', '강조 → much · even · far', COL.rel], ['범위 → 최상급 · superior to', 'one of the + 복수 · The …, the', COL.rel],
          ['If + 과거 → would + 원형', 'If + had p.p. → would have p.p.', COL.rel], ['조동사 + 주어 + 동사', '질문과 같은 어순', COL.rel]] },
        { x: 880, head: '③ 함정', sub: '비슷한 오답', at: 18.2, boxes: [
          ['very larger · more lighter', '비교 표시 두 번', COL.trap], ['superior than', 'one of the + 단수', COL.trap],
          ['가정법의 will', 'if절의 would · If we known', COL.trap], ['Only after … we will', 'did … increased', COL.trap]] },
      ];
      const P = S.sig ? CI.SIGNALS.find(s => s.k === S.sig) : null;
      cols.forEach((c, ci) => {
        fade(g, ramp(u, c.at, 0.6), () => {
          panel(g, c.x, 150, 340, 58, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 20, 179, { size: 22, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 320, 179, { size: 15, weight: 600, color: COL.muted, align: 'right' });
          c.boxes.forEach(([k, v, col], bi) => {
            const y = 220 + bi * 76, lit = P && P.box === bi;
            fade(g, ramp(u, c.at + 0.5 + bi * 0.55, 0.5) * (P && !lit ? 0.4 : 1), () => {
              panel(g, c.x, y, 340, 64, { fill: lit ? 'rgba(255,193,94,0.14)' : COL.panel, stroke: lit ? COL.rel : COL.faint, lw: lit ? 2.5 : 1.5 });
              txt(g, k, c.x + 16, y + 21, { size: 15, weight: 700, color: COL.soft });
              txt(g, v, c.x + 16, y + 45, { size: 16, weight: 700, color: col });
            });
          });
          if (ci < 2) fade(g, ramp(u, cols[ci + 1].at - 0.3, 0.5), () => arrow(g, c.x + 348, 179, c.x + 392, 179, COL.accent, 3));
        });
      });
      if (P) {
        const s = `${P.sig} → 짝: ${P.pair} · 함정: ${P.trap}`;
        let size = 18; while (tw(g, s, size, 700) > 1080 && size > 13) size--;
        chip(g, s, W / 2, 552, { size, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 42, r: 10 });
      }
    },

    /* 09 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = CI.DRILL[P.k], c = CI.ctxOf(it);
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0] + 0.6, s3 = v >= P.win;
        // 빈칸 자리는 처음부터 답의 너비로 잡아 둠 → 답을 채울 때 줄이 바뀌지 않음
        const minW = Math.max(...it.opts.map(([o]) => tw(g, o, 31, 700) / 31 + 0.7));
        const T = drillToks(it, 'p' + pi).map(tk => tk.r === 'blank' ? Object.assign({}, tk, { t: it.opts[it.a][0], r: s3 ? 'ans' : 'blank', minW }) : tk);
        let L, size = 31;
        do { L = lay(g, T, { x: LX, y: 234, size, maxW: 1110, lh: 54 }); size -= 1; } while (L.lines > 1 && size >= 24);
        const stepOf = tg => { const m = (it.mk || [])[+String(tg).slice(1)]; return m ? m[2] : 1; };
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: v >= P.at[1] && !s3 ? 0.6 : 0, hide: true }
          : tk.tag && tk.tag[0] === 'm' ? (v >= P.at[stepOf(tk.tag) - 1] + 0.4 ? { cue: tk.r === 'sig', cueColor: COL.verb } : { r: '' }) : {});
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        const oneCol = it.opts.some(([o]) => tw(g, o, 27, 600) > 230);
        const oy = L.lines > 1 ? 352 : 312;
        it.opts.forEach(([o, code], k) => {
          const ox = oneCol ? LX : LX + (k % 2) * 290, y = oneCol ? oy + k * 66 : oy + Math.floor(k / 2) * 92, j = CI.judgeOpt(it, k);
          const at = j.step ? P.x[j.step - 1] : 1e9;
          const right = k === it.a, gone = !right && v >= at, win = right && s3;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, o, ox + 52, y, { size: 27, weight: win ? 700 : 600, color: win ? COL.good : gone ? COL.dim : COL.text });
          fade(g, ramp(v, P.at[0] + 1.2, 0.5), () => txt(g, CI.kindName(code, c), ox + 52, y + (oneCol ? 26 : 30), { size: 14, weight: 600, color: gone ? COL.dim : COL.muted }));
          if (gone) {
            const gp = clamp((v - at) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, y + 1); g.lineTo(ox - 4 + (w + 62) * gp, y + 1); g.stroke();
          }
          if (win) { panel(g, ox - 14, y - 24, w + 84, oneCol ? 60 : 68, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + w + 92, y, 18); }
        });
        panel(g, 660, oy - 40, 560, 236, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = oy - 2 + k * 72;
          txt(g, ['① 신호어', '② 짝', '③ 함정'][k], 684, y, { size: 18, weight: 700, color: COL.accent });
          let sz = 18; while (tw(g, ln, sz, 600) > 516 && sz > 14) sz--;
          txt(g, ln, 684, y + 30, { size: sz, weight: 600, color: k === 2 && v >= P.win ? COL.good : COL.soft });
        }));
      });
    },

    /* 10 정리 표 */
    summary(g, u) {
      const X = [80, 430, 720], Y0 = 150, RH = 37;
      const rows = [
        ['as + 빈칸 + as', '원급', 'as light as', COL.rel],
        ['빈칸 + than', '비교급 (-er · more)', 'lighter than · more reliable than', COL.rel],
        ['빈칸 + 비교급 + than', 'much · even · far (very ×)', 'much larger than', COL.rel],
        ['the + 빈칸 + of · in · ever', '최상급', 'the largest order we have ever received', COL.rel],
        ['one of the + 최상급', '복수 명사', 'one of the largest suppliers', COL.rel],
        ['superior · inferior · prior', 'to (than ×)', 'superior to that of our competitors', COL.rel],
        ['If + 과거 / If + had p.p.', 'would + 원형 / would have p.p.', 'If we had known, we would have called.', COL.clause],
        ['맨 앞 Should · Had · Were', '숨은 if (조동사 + 주어)', 'Should you have any questions, …', COL.verb],
        ['맨 앞 Only · Never · Not only', '조동사 + 주어 + 동사', 'Only after the review will we announce …', COL.verb],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 12, { fill: COL.panel, stroke: COL.faint });
        ['신호어', '짝', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 16, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 4, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.5, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 16;
        txt(g, r[0], X[0] + 20, y, { size: 17, weight: 600 });
        txt(g, r[1], X[1] + 20, y, { size: 17, weight: 700, color: r[3] });
        let sz = 17; while (tw(g, r[2], sz, 500) > 470 && sz > 13) sz--;
        txt(g, r[2], X[2] + 20, y, { size: sz, weight: 500, color: COL.en });
        say(X[2] + 14, y - 17, 480, 34, r[2].replace(/,? …$/, ''));
      }));
      const steps = ['① 신호어 찾기', '② 짝 맞추기', '③ 함정 확인'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 6.5 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 554, { size: 19, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 44, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 554, c.x + c.w + 46, 554, COL.accent, 2.5);
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

  /* ---------- 놀이터(신호어 스위치)의 작은 무대: 문장 하나, 틀을 바꾸면 토큰이 미끄러짐 ----------
   * 논리 크기 1000×250 (좁은 화면에서는 620×330으로 글자를 키움)
   * o: { w: 논리 너비, A: 이전 토큰, B: 지금 토큰, p: 0→1 바뀌는 정도, fr: 지금 틀, need: 빈칸 아래 이름표, ok: 채운 답이 맞는지 }
   */
  CIS.STAGE = { w: 1000, h: 250, nw: 620, nh: 330 };
  function stageLay(g, T, SW, SH) {
    let size = SW < 800 ? 30 : 32, L;
    const maxLines = SW < 800 ? 3 : 2;
    // 줄 사이를 넉넉히: 줄마다 위에 짝 화살표, 아래에 이름표가 들어감
    do { L = lay(g, T, { x: SW / 2, y: 0, size, align: 'center', maxW: SW - 64, lh: size * (SW < 800 ? 2.8 : 2.4) }); size -= 1; } while (L.lines > maxLines && size > 18);
    const dy = SH / 2 + 6 - (L.lines - 1) * L.lh / 2;
    L.items.forEach(it => { it.y += dy; });
    L.y += dy;
    return L;
  }
  CIS.stage = function (g, o) {
    const SW = o.w || CIS.STAGE.w, SH = SW < 800 ? CIS.STAGE.nh : CIS.STAGE.h, s = g.canvas.width / SW;
    g.setTransform(s, 0, 0, s, 0, 0); g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, SW, SH);
    g.fillStyle = COL.grid; for (let x = 20; x < SW; x += 40) for (let y = 20; y < SH; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    // 빈칸은 가장 긴 후보 너비로 잡아 둠 → 고를 때 줄이 바뀌지 않음
    const fixW = T => T.map(t => t.r === 'blank' ? Object.assign({}, t, { minW: o.minW || 3 }) : t);
    const B = stageLay(g, fixW(o.B), SW, SH), p = o.p == null ? 1 : o.p;
    if (o.A && p < 1) {
      const A = stageLay(g, fixW(o.A), SW, SH);
      morph(g, A, B, p);
      moveTrail(g, A, B, 'aux', p); moveTrail(g, A, B, 'front', p, COL.verb);
    } else drawLay(g, B);
    const a = o.A && p < 1 ? ramp(p, 0.75, 0.25) : 1;
    fade(g, a, () => {
      const fr = o.fr, from = B.byId[fr.pair];
      const fill = B.items.filter(t => t.fill), X = B.byId.X || null;
      // 채운 답이 두 줄로 나뉘면 첫 줄 조각만으로 상자를 잡음
      const f1 = fill.filter(t => fill.length && t.line === fill[0].line), fl = f1[f1.length - 1];
      const tgt = X || (f1.length ? { x: f1[0].x, w: fl.x + fl.w - f1[0].x, y: f1[0].y, size: f1[0].size, line: f1[0].line } : null);
      const lsz = SW < 800 ? 20 : 16;
      B.items.filter(t => t.r === 'sig').slice(0, 2).forEach(t => txt(g, '신호어', t.x + t.w / 2, t.y + t.size * 0.62 + lsz + 4, { size: lsz, weight: 700, color: COL.verb, align: 'center' }));
      if (from && tgt && from !== tgt) pairArc(g, from, tgt, 1, { label: '짝', lsize: lsz, color: o.ok === false ? COL.bad : COL.rel });
      const inside = (cx, str) => { const hw = tw(g, str, lsz, 700) / 2; return Math.max(10 + hw, Math.min(SW - 10 - hw, cx)); };   // 무대 밖으로 나가지 않게
      if (tgt && o.need) txt(g, o.need, inside(tgt.x + tgt.w / 2, o.need), tgt.y + tgt.size * 0.62 + lsz + 4, { size: lsz, weight: 700, color: COL.rel, align: 'center' });
      if (tgt && o.ok != null) mark(g, o.ok, tgt.x + tgt.w + 14, tgt.y - tgt.size * 0.55, 13);
    });
  };

  CIS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[CIS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, CIS.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  // 직접 해 보기로만 나오는 글자(다른 낱말·틀·신호어)도 함께 넣음
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + CI.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔✓×?~=+-/:…‘’';
  CIS.baseText = EXTRA;
  CIS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = CIS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { CIS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
