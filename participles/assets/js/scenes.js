/* 분사 튜토리얼 — 영상 장면
 *
 * PTS.render(g, t)는 시각 t와 사용자 상태 PTS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 영어 문장은 낱말 조각(토큰)으로 그리고, 역할마다 색을 칠합니다:
 *   주인(꾸밈받는 말 · 주절의 주어) 하늘 · 분사(답) 노랑 · 분사구·분사구문·접속사 민트 · 목적어·by·단서 보라 · 함정 주황
 *   빈칸은 분홍 점선 상자. 관계 그림(화살표)에서 하는 쪽은 보라, 당하는 쪽은 분홍 점선.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(PT.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const PT = window.PT;
  const PTS = (window.PTS = {});
  const W = 1280, H = 720;
  PTS.W = W; PTS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  PTS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  PTS.COL = COL;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (PTS.S = { v01: 0, pair: 0, own: null, when: null, full: false, emo: 0, path: null });
  PTS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  PTS.hits = () => HITS;

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
  // 하는 쪽(보라, -ing) · 당하는 쪽(분홍 점선, -ed)
  function sideChip(g, side, s, x, y, a = 1, o = {}) {
    const c = side === 'L' ? COL.verb : COL.gap;
    fade(g, a, () => chip(g, s, x, y, { size: o.size || 17, weight: 700, color: c, fill: 'rgba(16,21,28,0.92)', stroke: c, align: o.align || 'center', h: o.h || 36, pad: 12, lw: 1.4, dash: side === 'R', r: o.r }));
  }

  /* ---------- 영어 문장 토큰 배치와 그리기 ---------- */
  // 토큰 { id, t: 글자, r: 역할 }. 역할: own 주인 · p 분사(답) · obj 목적어 · cue 단서(by · 전치사) · mv 문장의 동사 · conj 접속사
  //   dl 하는 쪽 · dr 당하는 쪽 · trap 함정 · ghost 줄어든 말 · fn 기능어 · blank 빈칸 · ans 채운 답 · bad 틀림 · '' 보통
  const RCOL = { own: COL.ante, p: COL.rel, obj: COL.verb, cue: COL.verb, mv: COL.verb, conj: COL.clause, dl: COL.verb, dr: COL.gap, trap: COL.trap, ghost: COL.dim, fn: COL.muted, bad: COL.bad, good: COL.good, dim: COL.dim };
  const UNDER = { own: 1, p: 1, obj: 1 };
  const PUNCT = /^[.,?!]$/;
  const tokW = (g, tk, size) => Math.max(tk.minW ? tk.minW * size : 0, tokW0(g, tk, size));
  const tokW0 = (g, tk, size) => tk.r === 'blank' ? Math.max(size * 2.6, tk.t ? tw(g, tk.t, size, 700) + size * 0.7 : 0) :
    tk.r === 'ans' ? tw(g, tk.t, size, 700) + size * 0.7 : tw(g, tk.t, size, UNDER[tk.r] || tk.r === 'dl' || tk.r === 'dr' ? 600 : 500);
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
  // 문장 속 글자들을 한 토큰으로 묶어 나눔. spec: [[글자, 역할, 표시]]
  function phraseToks(q, spec, pre = 'q') {
    const marks = [];
    spec.concat([['___', 'blank']]).forEach(([t, r, tag]) => {
      if (!t) return;
      const i = q.indexOf(t);
      if (i >= 0 && !marks.some(m => i < m.e && i + t.length > m.s)) marks.push({ s: i, e: i + t.length, t, r, tag });
    });
    marks.sort((a, b) => a.s - b.s);
    const out = []; let at = 0;
    const push = (t, r, tag) => out.push({ id: pre + out.length, t, r, tag });
    const plain = s => s.split(' ').forEach(w => { if (!w) return; const m = w.match(/^(.*?)([.,?!]?)$/); if (m[1]) push(m[1], ''); if (m[2]) push(m[2], ''); });
    marks.forEach(m => { plain(q.slice(at, m.s)); push(m.r === 'blank' ? '' : m.t, m.r, m.tag); at = m.e; });
    plain(q.slice(at));
    return out;
  }
  // 토큰의 id를 표시(tag)로 바꿔 둠 → 두 배치 사이에서 같은 낱말이 미끄러짐
  const keyed = (T, pre) => T.map((t, i) => Object.assign({}, t, { id: pre + (t.tag || t.t + '#' + T.slice(0, i).filter(x => x.t === t.t).length) }));
  const byTag = (L, tag) => L.items.find(i => i.tag === tag);
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
      txt(g, it.t, x, y + 1, { size, weight: UNDER[r] || r === 'dl' || r === 'dr' ? 600 : 500, color: c });
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
        const m = Object.assign({}, b, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), w: lerp(a.w, b.w, e), size: lerp(a.size, b.size, e) });
        if (a.t === b.t && a.r === b.r) drawTok(g, m, style(b, e));
        else { drawTok(g, Object.assign({}, m, { t: a.t, r: a.r }), Object.assign({}, style(a, e), { a: 1 - e })); drawTok(g, m, Object.assign({}, style(b, e), { a: e })); }
      } else if (a) drawTok(g, a, Object.assign({}, style(a, e), { a: 1 - ramp(p, 0, 0.5) }));
      else drawTok(g, b, Object.assign({}, style(b, e), { a: ramp(p, 0.5, 0.5) }));
    });
  }
  function sayLay(L, text) { say(L.x - 8, L.y - L.size * 0.8, L.w + 16, L.h + L.size * 0.3, text); }
  // 토큰 아래(dy > 0) 또는 위(dy < 0) 가운데에 작은 글
  function under(g, it, s, color, a = 1, dy = 44, size = 16) { fade(g, a, () => txt(g, s, it.x + it.w / 2, it.y + dy, { size, weight: 700, color, align: 'center' })); }
  // 토큰 여럿 아래 꺾쇠 (분사구 표시). p: 그려진 정도
  function bracket(g, a, b, color, p = 1, dy = 30) {
    if (p <= 0.001) return;
    const x0 = a.x, x1 = b.x + b.w, y = a.y + dy, xe = lerp(x0, x1, clamp(p));
    g.strokeStyle = color; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y - 7); g.lineTo(x0, y); g.lineTo(xe, y); if (p >= 0.99) g.lineTo(x1, y - 7); g.stroke();
  }
  // 낱말을 조각내어 그림. parts: [[글자, 색, 밑줄]] → 너비
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
  // 토큰 여럿을 감싸는 상자
  function boxSpan(g, a, b, color, dash) {
    const pd = a.size * 0.13; rr(g, a.x - pd, a.y - a.size * 0.68, b.x + b.w - a.x + pd * 2, a.size * 1.36, 8);
    g.strokeStyle = color; g.lineWidth = 2.2; if (dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
  }
  // 두 줄 오른쪽의 세로 괄호 + 이름표
  function sideBrace(g, x, y0, y1, s, color) {
    g.strokeStyle = color; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y0 - 14); g.lineTo(x + 8, y0 - 14); g.lineTo(x + 8, y1 + 14); g.lineTo(x, y1 + 14); g.stroke();
    txt(g, s, x + 20, (y0 + y1) / 2, { size: 17, weight: 700, color });
  }
  // 보기 몇 개를 ✓/×와 까닭으로 (까닭은 규칙 엔진). horiz: 가로로 늘어놓기
  function tryList(g, items, x, y, u, at, o = {}) {
    let xx = x;
    items.forEach(([w, j], k) => {
      const a = ramp(u, at + k * (o.step || 0.9), 0.4), yy = o.horiz ? y : y + k * (o.gap || 44), px = o.horiz ? xx : x;
      const ok = j.s === 'ok', ww = tw(g, w, o.size || 24, 600);
      fade(g, a, () => {
        mark(g, ok, px + 10, yy, 16);
        txt(g, w, px + 36, yy, { size: o.size || 24, weight: 600, color: ok ? COL.good : COL.muted });
        if (!ok) { g.strokeStyle = COL.bad; g.lineWidth = 2.2; g.beginPath(); g.moveTo(px + 32, yy + 1); g.lineTo(px + 40 + ww, yy + 1); g.stroke(); }
        const note = o.notes ? o.notes[k] : ok ? '' : j.why;
        if (note) txt(g, note, px + 36 + ww + 18, yy, { size: 16, weight: 600, color: ok ? COL.good : COL.muted });
      });
      if (o.horiz) xx += 36 + ww + 18 + (o.notes && o.notes[k] ? tw(g, o.notes[k], 16, 600) : 0) + 44;
    });
  }
  // 빈칸·분사에서 뒤로 훑는 보라 막대 (목적어 찾기)
  function scan(g, from, to, u, at) {
    const p = clamp((u - at) / 1.2);
    if (p <= 0 || p >= 1) return;
    const x = lerp(from.x + from.w + 6, to.x + to.w + 6, ease(p));
    g.save(); g.globalAlpha *= Math.sin(Math.PI * p);
    g.fillStyle = COL.verb; g.fillRect(x, from.y - 26, 3, 52);
    g.restore();
  }

  /* ---------- 관계 그림: [하는 쪽] —동사→ [당하는 쪽], 주인에 하늘색 고리 ----------
   * D = { L, R (없으면 ‘받는 쪽 없음’), v, ko, emo }
   * o = { a, p: 화살표가 그려진 정도, own: 0(L) → 1(R) 고리 위치, ownA: 고리 투명도, lab: 아래 이름표, forms: 이름표에 → -ing · -ed, span, size }
   */
  function relDiagram(g, cx, y, D, o = {}) {
    const size = o.size || 24, span = o.span || 520, h = Math.round(size * 2.1), xl = cx - span / 2, xr = cx + span / 2;
    const none = '받는 쪽 없음', wL = tw(g, D.L, size, 700) + size * 1.4, wR = D.R ? tw(g, D.R, size, 700) + size * 1.4 : tw(g, none, size * 0.72, 700) + size * 1.4;
    const bL = { x: xl - wL / 2, y: y - h / 2, w: wL, h }, bR = { x: xr - wR / 2, y: y - h / 2, w: wR, h };
    fade(g, o.a == null ? 1 : o.a, () => {
      const ownL = o.ownA > 0.5 && o.own < 0.5, ownR = o.ownA > 0.5 && o.own >= 0.5;
      rr(g, bL.x, bL.y, bL.w, bL.h, 12); g.fillStyle = COL.panel; g.fill(); g.strokeStyle = COL.verb; g.lineWidth = 2; g.stroke();
      txt(g, D.L, xl, y + 1, { size, weight: 700, color: ownL ? COL.ante : COL.text, align: 'center' });
      rr(g, bR.x, bR.y, bR.w, bR.h, 12); g.fillStyle = COL.panel; g.fill();
      g.setLineDash([6, 5]); g.strokeStyle = D.R ? COL.gap : COL.dim; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
      if (D.R) txt(g, D.R, xr, y + 1, { size, weight: 700, color: ownR ? COL.ante : COL.text, align: 'center' });
      else txt(g, none, xr, y + 1, { size: size * 0.72, weight: 700, color: COL.dim, align: 'center' });
      // 화살표 (자동사는 받는 쪽이 없어서 점선으로 끊김)
      const x0 = bL.x + bL.w + 10, x1 = bR.x - 10, p = o.p == null ? 1 : o.p, xe = lerp(x0, x1, clamp(p)), c = D.R ? COL.rel : COL.dim;
      if (p > 0.01) {
        g.save(); g.strokeStyle = c; g.lineWidth = 3; g.lineCap = 'round'; if (!D.R) g.setLineDash([6, 6]);
        g.beginPath(); g.moveTo(x0, y); g.lineTo(xe - (p > 0.97 ? 8 : 0), y); g.stroke(); g.restore();
        if (p > 0.97) arrowHead(g, x1, y, 0, c, 13);
        fade(g, ramp(p, 0.4, 0.6), () => {
          txt(g, D.v, (x0 + x1) / 2, y - 22, { size: size * 0.82, weight: 700, color: COL.rel, align: 'center' });
          txt(g, D.ko, (x0 + x1) / 2, y + 24, { size: (o.lsize || 16) - 1, weight: 600, color: COL.muted, align: 'center' });
        });
      }
      // 아래 이름표
      fade(g, o.lab || 0, () => {
        const ls = o.lsize || 16, ly = y + h / 2 + ls + 6, f = o.forms;
        txt(g, (D.emo ? '일으키는 쪽' : '하는 쪽') + (f ? ' → -ing' : ''), xl, ly, { size: ls, weight: 700, color: COL.verb, align: 'center' });
        txt(g, D.R ? (D.emo ? '느끼는 쪽' : '당하는 쪽') + (f ? ' → -ed' : '') : '당할 수 없음', xr, ly, { size: ls, weight: 700, color: D.R ? COL.gap : COL.dim, align: 'center' });
      });
      // 주인 고리
      if (o.ownA > 0) fade(g, o.ownA, () => {
        const k = ease(clamp(o.own || 0)), bx = lerp(bL.x, bR.x, k), bw = lerp(bL.w, bR.w, k);
        rr(g, bx - 7, y - h / 2 - 7, bw + 14, h + 14, 16); g.strokeStyle = COL.ante; g.lineWidth = 3; g.stroke();
        txt(g, '주인', bx + bw / 2, y - h / 2 - (o.lsize || 16) - 6, { size: o.lsize || 16, weight: 700, color: COL.ante, align: 'center' });
      });
    });
    return { bL, bR };
  }
  PTS.relDiagram = relDiagram;

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '-ing냐 -ed냐, 물어볼 것 하나', d: 24, caps: [
      [0.4, 5.5, '토익 Part 5에는 같은 동사의 -ing 모양과 -ed 모양 가운데 하나를 고르는 문제가 자주 나와요.'],
      [5.5, 11, '보기를 보세요. submits, submitting, submitted, will submit. 모두 같은 동사에서 나왔어요 → submit.'],
      [11, 16, '물어볼 것은 하나예요. 빈칸이 꾸미는 말이 그 일을 **하는** 쪽인가, **당하는** 쪽인가?'],
      [16, 20.5, '지원서가 제출하나요, 제출되나요? 정답은 영상 끝에서 함께 풀어요.'],
      [20.5, 24, '**분사**의 뜻, **감정 분사**, **분사구문**을 배우고 **3단계 풀이법**으로 묶어요.'],
    ] },
    { id: 'participle', n: '01', title: '명사를 꾸미는 동사', sub: '분사란', d: 30, caps: [
      [0.4, 6, '동사에 -ing 또는 -ed 꼬리를 붙이면 명사를 꾸미는 말이 돼요. 이것을 **분사**라고 해요.'],
      [6, 12, 'attach → 첨부하다. attaching → 첨부하는, attached → 첨부된. 한국어의 ‘-하는’, ‘-된’과 닮았어요.'],
      [12, 18, '분사가 꾸미는 말을 이 영상에서는 **주인**이라고 부를게요. the attached file → 주인 = file.'],
      [18, 24, '짧은 분사는 명사 앞에, 뒤에 말이 붙어 길어지면 명사 뒤에 와요. the file attached to this e-mail.'],
      [24, 30, '자리는 달라도 물어볼 것은 같아요. 주인이 그 일을 하나요, 당하나요?'],
    ] },
    { id: 'core', n: '02', title: '하는 쪽, 당하는 쪽', sub: '분사의 핵심 질문', d: 34, caps: [
      [0.4, 6, '문장 하나로 볼게요. The manager invited the guests. 매니저가 초대했고, 손님은 초대받았어요.'],
      [6, 12, '화살표로 그리면 매니저 → 초대하다 → 손님. 출발하는 쪽이 **하는 쪽**, 도착하는 쪽이 **당하는 쪽**이에요.'],
      [12, 18, '주인이 손님이면 당하는 쪽이에요 → the invited guests. 당하는 쪽은 **-ed**, 과거분사예요.'],
      [18, 24, '주인이 매니저이면 하는 쪽이에요 → the manager inviting the guests. 하는 쪽은 **-ing**, 현재분사예요.'],
      [24, 29, 'T03에서 배운 능동·수동과 같은 질문이에요. -ing → 능동, -ed → 수동.'],
      [29, 34, '수동태 → The guests were invited. 여기서 be동사를 떼면 → the invited guests. 그래서 -ed는 수동이에요.'],
    ] },
    { id: 'names', n: '03', title: '이름에 속지 마세요', sub: '때가 아니라 관계', d: 34, caps: [
      [0.4, 6, '-ing → 현재분사, -ed → 과거분사라고 불러요. 그런데 이름과 달리 **때**와는 상관이 없어요.'],
      [6, 12, 'Orders placed last week, orders placed tonight. 지난주 주문도, 오늘 밤 주문도 → placed.'],
      [12, 18, '주문은 손님이 넣는 것이라 당하는 쪽 → -ed. 과거가 아니라 **당하는 쪽**이라는 표시예요.'],
      [18, 24, '한국어 ‘남은 좌석’은 ‘-은’이 과거처럼 들려요. 그래서 고르기 쉬운 오답 → remained.'],
      [24, 29, '하지만 좌석은 남는 쪽, 하는 쪽이에요 → the remaining seats. remain = 자동사예요.'],
      [29, 34, '자동사는 수동태가 없었죠(T03). 그래서 분사도 늘 -ing → remaining, rising, existing.'],
    ] },
    { id: 'after', n: '04', title: '명사 뒤의 분사구', sub: '목적어로 확인하기', d: 34, caps: [
      [0.4, 6, '분사 뒤에 말이 붙으면 명사 **뒤**로 가요. Employees using the new software must attend a training session.'],
      [6, 12, '주인 = employees. 직원들은 소프트웨어를 쓰는 쪽이에요. 게다가 뒤에 목적어가 있어요 → the new software.'],
      [12, 18, '-ing 뒤에는 목적어가 올 수 있어요. -ed 뒤에는 목적어가 없어요. 수동태 뒤에 목적어가 없던 것과 같아요.'],
      [18, 24, 'The report prepared by the sales team is on your desk. 보고서는 작성되는 쪽 → -ed.'],
      [24, 29, '-ed 뒤에는 목적어 대신 by + 하는 쪽, 또는 시간·장소 표현이 자주 와요 → by the sales team.'],
      [29, 34, '명사 뒤의 분사구는 관계사절이 줄어든 모양이에요 → who are using, that was prepared.'],
    ] },
    { id: 'emotion', n: '05', title: '감정 분사', sub: '일으키나, 느끼나', d: 32, caps: [
      [0.4, 6, '감정을 나타내는 동사도 분사가 돼요. excite → 신나게 하다. 감정을 **일으키는** 동사예요.'],
      [6, 12, 'The offer excited the customers. 제안이 손님을 신나게 했어요. 화살표 → 제안에서 손님으로.'],
      [12, 18, '감정을 일으키는 쪽이 주인이면 → -ing. an exciting offer → 신나는 제안.'],
      [18, 24, '감정을 **느끼는** 쪽이 주인이면 → -ed. excited customers → 신이 난 손님.'],
      [24, 32, '질문은 똑같아요. 일으키는 쪽 = 하는 쪽 → -ing. 느끼는 쪽 = 당하는 쪽 → -ed.'],
    ] },
    { id: 'korean', n: '06', title: '지루한 영화, 지루한 나', sub: '한국어와 다른 점', d: 36, caps: [
      [0.4, 6, '한국어는 한 낱말로 둘 다 말해요. 영화가 지루하다, 나는 지루하다. 둘 다 → 지루하다.'],
      [6, 12, '영어는 둘로 나눠요. The movie was boring. 영화가 지루함을 일으켜요. I was bored. 내가 지루함을 느껴요.'],
      [12, 18, '‘나는 남을 지루하게 하는 사람이었다’ → I was boring. 하나만 바꿔도 뜻이 완전히 달라져요.'],
      [18, 25, '지름길도 있어요. 사람은 대개 느끼는 쪽이라 -ed, 물건이나 일은 대개 일으키는 쪽이라 -ing.'],
      [25, 30, '하지만 지름길일 뿐이에요. a boring speaker → 남을 지루하게 하는 사람. 늘 주인에게 물어요.'],
      [30, 36, '느끼는 쪽 -ed 뒤에는 전치사가 자주 와요 → interested in, satisfied with, excited about.'],
    ] },
    { id: 'clause', n: '07', title: '분사구문', sub: '주인 = 주절의 주어', d: 32, caps: [
      [0.4, 6, '분사로 시작하는 덩어리가 문장 앞에 오기도 해요. 이것을 **분사구문**이라고 해요.'],
      [6, 12, 'Built in 1920, the theater is the oldest building in town. 주인은 콤마 뒤 주절의 **주어**예요 → the theater.'],
      [12, 18, '극장은 짓는 쪽일까, 지어지는 쪽일까? 지어지는 쪽이라 → -ed, built.'],
      [18, 24, 'Facing a tight deadline, the team worked all weekend. 팀은 마감에 맞서는 쪽 → -ing. 목적어도 있어요.'],
      [24, 32, '감정도 같아요. Impressed by her presentation, the client signed the contract. 고객은 감명을 받은 쪽 → -ed.'],
    ] },
    { id: 'conj', n: '08', title: '접속사가 남은 분사구문', sub: 'when · once · before + 분사', d: 32, caps: [
      [0.4, 6, '분사구문 앞에 접속사를 남기기도 해요. When using the copier, enter your staff ID first.'],
      [6, 12, '명령문이라 주인은 숨은 주어 → you. 여러분이 복사기를 쓰는 쪽이니 -ing. 목적어도 있어요 → the copier.'],
      [12, 18, 'Once approved, the plan will take effect in May. 주인 = the plan, 승인되는 쪽이라 → -ed.'],
      [18, 25, 'if, once, until, unless 뒤에는 자주 → -ed. if needed, once approved, until signed.'],
      [25, 32, 'before, after 뒤에는 → -ing. before leaving, after reviewing. while 뒤도 대개 → -ing.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: '주인 → 질문 → 확인', d: 30, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11.5, '① **주인**을 찾아요. 명사 앞뒤의 분사는 그 명사, 분사구문은 주절의 주어. 분사가 아닌 보기는 지워요.'],
      [11.5, 18, '② 주인에게 **물어요**. 하나요, 당하나요? 감정이면 일으키나요, 느끼나요? 하면 -ing, 당하면 -ed.'],
      [18, 24.5, '③ 뒤를 보고 **확인**해요. 목적어가 있으면 -ing. by + 하는 쪽이나 전치사구뿐이면 대개 -ed. 자동사는 늘 -ing.'],
      [24.5, 30, '이 순서로 처음 본 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '처음 본 문제예요. ① 주인 = Applications. 문장의 동사는 따로 있어요 → will not be reviewed.'],
      [6, 12, '그래서 동사 모양 (A), (D) 탈락. ② 지원서는 제출하나요, 제출되나요? 제출되는 쪽 → (B) 탈락.'],
      [12, 18, '③ 뒤에도 목적어 없이 시간 표현뿐이에요 → after Friday. 정답은 (C) submitted.'],
      [18.4, 24.5, '두 번째 문제. ① 빈칸은 목적어를 설명하는 보어예요. 주인 = the new expense system. (C), (D) 탈락.'],
      [24.5, 31, '② 시스템은 헷갈림을 일으키나요, 느끼나요? 일으키는 쪽 → -ing. 탈락 → (B) confused.'],
      [31, 37, '③ 헷갈린 건 직원들이지만, 빈칸의 주인은 시스템이에요. 정답은 (A) confusing.'],
      [37.4, 43.5, '세 번째. 분사구문이에요. ① 주인 = 주절의 주어 → the budget. 탈락 → (B) approval, (C) approves.'],
      [43.5, 50, '② 예산은 승인하나요, 승인되나요? 승인되는 쪽 → -ed. 탈락 → (A) approving.'],
      [50, 56, '③ 뒤에 by + 하는 쪽이 있어요 → by the director. 정답은 (D) approved.'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 표', d: 22, caps: [
      [0.4, 6, '정리해요. 분사 문제는 하나만 물어요. 주인이 그 일을 하나요, 당하나요?'],
      [6, 12, '하는 쪽, 감정을 일으키는 쪽은 -ing. 당하는 쪽, 감정을 느끼는 쪽은 -ed.'],
      [12, 17, '뒤에 목적어가 있으면 -ing, 자동사도 -ing. 분사구문의 주인은 주절의 주어예요.'],
      [17, 22, '아래에서 주인 바꾸기 실험실과 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  PTS.CHAPTERS = CHAPTERS; PTS.CAPTIONS = CAPTIONS; PTS.END = END;
  PTS.POSTER = CHAPTERS.find(c => c.id === 'core').t + 23;
  PTS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  PTS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(PT.DRILL)에서 세 개. ①에서 분사가 아닌 보기, ②에서 관계가 틀린 분사를 지움
  // at: 오른쪽 풀이 줄이 나오는 때 · x: ①·② 탈락 줄이 그어지는 때 · win: 정답 표시
  const PRACTICE = [
    { k: 1, at: [0.4, 6, 12], x: [6.8, 10.6], win: 12.6, lines: ['주인 = Applications · (A) (D) 탈락', '제출되는 쪽 → -ed · (B) 탈락', '뒤에 목적어 없음 → (C) submitted'] },
    { k: 8, at: [0.4, 6.3, 12.8], x: [4.8, 10.8], win: 13.4, lines: ['주인 = system (보어) · (C) (D) 탈락', '헷갈림을 일으키는 쪽 → -ing · (B) 탈락', '직원이 아니라 system → (A) confusing'] },
    { k: 12, at: [0.4, 6.3, 12.8], x: [4.8, 10.8], win: 13.4, lines: ['주인 = the budget · (B) (C) 탈락', '승인되는 쪽 → -ed · (A) 탈락', 'by the director → (D) approved'] },
  ];
  PRACTICE.forEach(p => {
    const it = PT.DRILL[p.k], L = 'ABCD';
    [1, 2].forEach(step => {
      const out = it.opts.map((o, i) => PT.judgeOpt(it, i).step === step ? `(${L[i]})` : '').filter(Boolean).join(' ');
      if (!p.lines[step - 1].includes(out + ' 탈락')) console.warn('[분사] 실전 문제 탈락 표시가 규칙 엔진과 달라요:', it.q, step, out);
    });
    if (!p.lines[2].includes(`(${L[it.a]})`)) console.warn('[분사] 실전 문제 정답 표시가 데이터와 달라요:', it.q);
    it.opts.forEach((o, i) => { if ((PT.judgeOpt(it, i).s === 'ok') !== (i === it.a)) console.warn('[분사] 실전 문제가 규칙 엔진과 달라요:', it.q); });
  });
  // 연습 문제 → 토큰 (주인 · 문장의 동사 · 함정 · 빈칸 뒤 단서를 한 덩어리로)
  function drillToks(it, pre = 'q') {
    const spec = [[it.owner, it.you ? 'mv' : 'own', 'own']];
    if (it.main && it.slot !== 'comp') spec.push([it.main, 'mv', 'main']);
    if (it.trap) spec.push([it.trap, '', 'trap']);
    if (it.cue) spec.push([it.cue[0], '', 'cue']);
    if (it.conj) spec.push([it.conj, 'conj', 'conj']);
    return phraseToks(it.q, spec, pre);
  }

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o)); }
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  // 덩어리 [글자, 주인, 목적어, by] → 토큰
  const phrToks = (P, pre) => phraseToks(P[0], [[P[1], 'own', 'own'], [P[2], 'obj', 'obj'], [P[3], 'cue', 'cue'], [P[4] || '', 'p', 'p']], pre);

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(같은 동사 submit의 네 모양) → 주인과 질문 → 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '-ing냐 -ed냐, 주인에게 물어라', W / 2, 290, { size: 64, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Participles · -ing & -ed', W / 2, 366, { size: 26, weight: 500, color: COL.muted, align: 'center' });
      });
      sideChip(g, 'L', '하는 쪽 → -ing', W / 2 - 130, 456, ramp(u, 1.3, 0.4) * out1, { size: 20, h: 42 });
      sideChip(g, 'R', '당하는 쪽 → -ed', W / 2 + 130, 456, ramp(u, 1.6, 0.4) * out1, { size: 20, h: 42 });
      const it = PT.DRILL[1];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 19, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 160, 1000, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 180, 198, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const L = lay(g, drillToks(it), { x: 180, y: 294, size: 30, maxW: 930, lh: 56 });
        const s1 = u > 10.6, s2 = u > 15.6;
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: s2 ? 0.5 + 0.5 * Math.sin(u * 4) : 0 }
          : tk.tag === 'own' ? (s1 ? { cue: true, cueColor: COL.ante } : { r: '' }) : { r: '' });
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        const ow = byTag(L, 'own'), bk = blankOf(L);
        under(g, ow, '주인', COL.ante, ramp(u, 11.2, 0.5), -64, 17);
        fade(g, ramp(u, 11.6, 0.5), () => arc(g, bk.x + bk.w / 2, bk.y - 26, ow.x + ow.w / 2, ow.y - 30, 14, COL.ante, ramp(u, 11.6, 0.8)));
        fade(g, ramp(u, 16, 0.5), () => {
          chip(g, '지원서가 제출하나요?', bk.x + bk.w / 2 - 8, 354, { size: 17, weight: 700, color: COL.verb, fill: COL.panel2, stroke: COL.verb, align: 'right', h: 36, r: 10 });
          chip(g, '제출되나요?', bk.x + bk.w / 2 + 8, 354, { size: 17, weight: 700, color: COL.gap, fill: COL.panel2, stroke: COL.gap, align: 'left', h: 36, r: 10, dash: true });
        });
        it.opts.forEach(([o], k) => {
          const ox = 200 + (k % 2) * 400, oy = 420 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            txt(g, o, ox + 64, oy, { size: 30, weight: 600 });
            const i = o.indexOf('submit'), x0 = ox + 64 + tw(g, o.slice(0, i), 30, 600), rw = tw(g, 'submit', 30, 600);
            fade(g, ramp(u, 9 + k * 0.15, 0.4), () => { g.fillStyle = COL.rel; g.fillRect(x0, oy + 19, rw, 3); });
          });
        });
        fade(g, ramp(u, 9.6, 0.5), () => chip(g, '모두 같은 동사 submit', 1010, 451, { size: 18, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 36 }));
      });
      const steps = [['①', '주인', '분사가 꾸미는 말 찾기'], ['②', '질문', '하나요, 당하나요?'], ['③', '확인', '뒤에 목적어가 있나?']];
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

    /* 01 명사를 꾸미는 동사: 동사 하나 → -ing · -ed 두 갈래 → 명사 앞 · 명사 뒤 */
    participle(g, u) {
      const F = PT.FORMS01[S.v01 || 0], D = PT.verb(F.v), cx = W / 2;
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, cx - 150, 146, 300, 92, { fill: COL.panel2, stroke: COL.rel });
        txt(g, D.w, cx, 182, { size: 38, weight: 700, color: COL.rel, align: 'center' });
        txt(g, D.mean, cx, 220, { size: 17, weight: 600, color: COL.muted, align: 'center' });
        say(cx - 150, 146, 300, 92, D.w);
      });
      const br = [[-1, PT.ing(F.v), F.ko[0], '현재분사 · -ing', COL.verb, 'L'], [1, PT.ed(F.v), F.ko[1], '과거분사 · -ed (p.p.)', COL.gap, 'R']];
      br.forEach(([s, w, ko, nm, c], k) => {
        const x = cx + s * 300, a = ramp(u, 2.4 + k * 0.6, 0.6);
        fade(g, a, () => {
          arrow(g, cx + s * 110, 244, x - s * 40, 286, c, 2.5);
          txt(g, nm, x, 296, { size: 15, weight: 700, color: c, align: 'center' });
          txt(g, w, x, 334, { size: 36, weight: 700, color: COL.rel, align: 'center' });
          say(x - 120, 312, 240, 44, w);
        });
        fade(g, ramp(u, 7 + k * 1.6, 0.5), () => txt(g, ko, x, 374, { size: 21, weight: 700, color: c, align: 'center' }));
      });
      // 명사 앞
      const A = lay(g, phraseToks(F.pre[0], [[F.pre[1], 'own', 'own'], [PT.ed(F.v), 'p', 'p']], 'a'), { x: LX, y: 440, size: 34 });
      fade(g, ramp(u, 12.2, 0.6), () => {
        drawLay(g, A);
        sayLay(A, F.pre[0]);
        const o = byTag(A, 'own'), p = byTag(A, 'p');
        arc(g, p.x + p.w / 2, p.y - 28, o.x + o.w / 2, o.y - 28, 22, COL.ante, ramp(u, 13, 0.8));
        under(g, o, '주인', COL.ante, ramp(u, 13.6, 0.4), 46, 16);
        fade(g, ramp(u, 18.2, 0.5), () => chip(g, '짧으면 → 명사 앞', W - 80, 440, { size: 17, weight: 700, color: COL.clause, fill: COL.panel2, stroke: COL.clause, align: 'right', h: 36, r: 10 }));
      });
      // 명사 뒤
      const B = lay(g, phraseToks(F.post[0], [[F.post[1], 'own', 'own'], [F.post[2], 'p', 'p']], 'b'), { x: LX, y: 532, size: 34 });
      fade(g, ramp(u, 18.6, 0.6), () => {
        drawLay(g, B, tk => tk.tag === 'p' ? { color: COL.clause, plain: true } : {});
        sayLay(B, F.post[0]);
        const o = byTag(B, 'own'), p = byTag(B, 'p');
        bracket(g, p, p, COL.clause, ramp(u, 19.4, 0.8), 28);
        arc(g, p.x + 30, p.y - 28, o.x + o.w / 2, o.y - 28, 18, COL.ante, ramp(u, 20, 0.8));
        fade(g, ramp(u, 20.4, 0.5), () => chip(g, '길면 → 명사 뒤', W - 80, 532, { size: 17, weight: 700, color: COL.clause, fill: COL.panel2, stroke: COL.clause, align: 'right', h: 36, r: 10 }));
      });
      fade(g, ramp(u, 24.4, 0.6), () => chip(g, '질문은 하나: 주인이 하나요, 당하나요?', W - 80, 112, { size: 17, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'right', h: 38, r: 10 }));
    },

    /* 02 하는 쪽, 당하는 쪽: 문장 → 관계 그림 → 주인이 R이면 -ed, L이면 -ing → 수동태에서 be를 떼면 */
    core(g, u) {
      const E = PT.LAB[S.pair || 0], D = PT.verb(E.v);
      const T = phraseToks(E.act, [[cap1(E.L), 'dl', 'L'], [E.R, 'dr', 'R']], 's');
      const Ls = lay(g, T, { x: W / 2, y: 184, size: 32, align: 'center' });
      fade(g, ramp(u, 0.4, 0.6), () => {
        drawLay(g, Ls, tk => u < 2.6 && (tk.r === 'dl' || tk.r === 'dr') ? { r: '' } : {});
        sayLay(Ls, E.act);
        under(g, byTag(Ls, 'L'), '하는 쪽', COL.verb, ramp(u, 2.8, 0.5), 40, 15);
        under(g, byTag(Ls, 'R'), '당하는 쪽', COL.gap, ramp(u, 3.4, 0.5), 40, 15);
      });
      // 주인 고리: 영상에서는 12초부터 R(손님), 18초부터 L(매니저). 직접 해 보기에서 고르면 그쪽에 고정
      const ownPos = S.own ? (S.own === 'R' ? 1 : 0) : 1 - ramp(u, 18.2, 0.8);
      const ownA = S.own ? 1 : ramp(u, 12.2, 0.5);
      relDiagram(g, W / 2, 296, { L: E.L, R: E.R, v: E.v, ko: D.mean }, { a: ramp(u, 6.2, 0.5), p: ramp(u, 6.6, 1.2), lab: ramp(u, 9.2, 0.6), forms: u > 12.2 || S.own, own: ownPos, ownA, span: 560 });
      // 두 덩어리: 왼쪽은 하는 쪽(-ing), 오른쪽은 당하는 쪽(-ed)
      const cols = [['R', 660, 12.4, '당하는 쪽 → -ed'], ['L', LX, 18.4, '하는 쪽 → -ing']];
      cols.forEach(([side, x, at, nm]) => {
        const P = E.phr[side], Tk = phraseToks(P[0], [[P[1], 'own', 'own'], [P[2] || '', 'obj', 'obj'], [P[3] || '', 'cue', 'cue'], [side === 'L' ? PT.ing(E.v) : PT.ed(E.v), 'p', 'p']], 'c' + side);
        const Lp = lay(g, Tk, { x, y: 436, size: 26, maxW: 540, lh: 42 });
        const dim = S.own && S.own !== side ? 0.35 : 1;
        fade(g, (S.own ? 1 : ramp(u, at, 0.6)) * dim, () => {
          drawLay(g, Lp, tk => tk.tag === 'cue' ? { cue: true, cueDash: true } : {});
          sayLay(Lp, P[0]);
          const o = byTag(Lp, 'own'), p = byTag(Lp, 'p');
          arc(g, p.x + p.w / 2, p.y - 26, o.x + o.w / 2, o.y - 26, 18, COL.ante, S.own ? 1 : ramp(u, at + 0.6, 0.7));
          sideChip(g, side, nm, x, 436 + (Lp.lines > 1 ? 42 : 0) + 48, 1, { align: 'left', size: 16, h: 34 });
        });
      });
      fade(g, ramp(u, 24.4, 0.6), () => chip(g, '-ing = 능동 · -ed = 수동 (T03)', W - 80, 112, { size: 17, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'right', h: 38, r: 10 }));
      // 수동태에서 be동사를 떼면
      fade(g, ramp(u, 29.2, 0.6), () => {
        const be = E.pass.match(/ (was|were) /)[1], [a, b] = E.pass.split(` ${be} `);
        const y = 560;
        label(g, '수동태에서 be를 떼면', LX, y, { size: 16, color: COL.soft });
        let x = LX + 190;
        x += pieces(g, [[a + ' ', COL.text], [be, COL.muted, 's'], [' ' + b, COL.rel]], x, y, 24);
        say(LX + 184, y - 18, x - LX - 180, 36, E.pass);
        arrow(g, x + 16, y, x + 58, y, COL.gap, 2.4);
        const P = E.phr.R;
        pieces(g, [[P[0], COL.gap]], x + 72, y, 24);
        say(x + 66, y - 18, tw(g, P[0], 24, 600) + 12, 36, P[0]);
      });
    },

    /* 03 이름에 속지 마세요: 현재분사 ≠ 현재, 과거분사 ≠ 과거 → placed는 언제나 -ed → 남은 좌석의 함정 → 자동사는 늘 -ing */
    names(g, u) {
      const outA = 1 - ramp(u, 17.6, 0.5);
      fade(g, outA, () => {
        [['현재분사', '-ing', '‘지금’이라는 뜻이 아니에요', LX], ['과거분사', '-ed (p.p.)', '‘과거’라는 뜻이 아니에요', 660]].forEach(([nm, f, no, x], k) => fade(g, ramp(u, 0.6 + k * 0.6, 0.5), () => {
          panel(g, x, 146, 540, 104, { fill: COL.panel, stroke: COL.faint });
          const w = txt(g, nm, x + 24, 180, { size: 26, weight: 700, fam: FD });
          txt(g, f, x + 36 + w, 181, { size: 24, weight: 700, color: k ? COL.gap : COL.verb });
          fade(g, ramp(u, 3 + k * 0.5, 0.5), () => { mark(g, false, x + 34, 222, 13); txt(g, no, x + 52, 222, { size: 17, weight: 700, color: COL.trap }); });
        }));
        const rows = S.when ? PT.WHEN.filter(w => w.k === S.when) : PT.WHEN;
        rows.forEach((wv, k) => fade(g, ramp(u, 6.2 + k * 2.2, 0.6), () => {
          const y = 300 + k * 60, time = { past: 'last week', now: 'tonight', future: 'next week' }[wv.k];
          const Lw = lay(g, phraseToks(wv.s, [['Orders', 'own', 'own'], ['placed', 'p', 'p'], [time, 'obj', 't']], 'w' + k), { x: LX, y, size: 30 });
          drawLay(g, Lw, tk => tk.tag === 't' ? { color: COL.verb, plain: true } : {});
          sayLay(Lw, wv.s);
          chip(g, wv.t, W - 80, y, { size: 16, weight: 700, color: COL.verb, fill: COL.panel2, stroke: COL.verb, align: 'right', h: 34, r: 10 });
        }));
        fade(g, ramp(u, 12.2, 0.6), () => {
          sideChip(g, 'R', '때가 달라도 → placed (주문 = 손님이 넣는 것, 당하는 쪽)', LX, 486, 1, { align: 'left', size: 19, h: 42 });
          txt(g, '-ed는 ‘과거’가 아니라 ‘당하는 쪽’이라는 표시', LX, 542, { size: 21, weight: 700, color: COL.soft });
        });
      });
      // 남은 좌석
      const inB = ramp(u, 18.2, 0.6);
      fade(g, inB, () => {
        panel(g, LX, 146, 540, 230, { fill: COL.panel, stroke: COL.faint });
        label(g, '한국어로 생각하면', LX + 24, 176, { size: 16, color: COL.soft });
        const w0 = txt(g, '남', LX + 24, 226, { size: 40, weight: 700 });
        const w1 = txt(g, '은', LX + 24 + w0, 226, { size: 40, weight: 700, color: COL.trap });
        txt(g, ' 좌석', LX + 24 + w0 + w1, 226, { size: 40, weight: 700 });
        fade(g, ramp(u, 19.4, 0.5), () => txt(g, '‘-은’ → 과거처럼 들림', LX + 24 + w0 + w1 / 2, 270, { size: 17, weight: 700, color: COL.trap }));
        fade(g, ramp(u, 21.4, 0.5), () => {
          const y = 330, ww = txt(g, 'the remained seats', LX + 24, y, { size: 30, weight: 600, color: COL.trap });
          const sp = ramp(u, 24.2, 0.6);
          if (sp > 0) { g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(LX + 20, y + 2); g.lineTo(LX + 20 + (ww + 8) * sp, y + 2); g.stroke(); }
          if (sp >= 1) mark(g, false, LX + 50 + ww, y, 16);
          say(LX + 14, y - 22, ww + 20, 44, 'the remained seats');
        });
      });
      fade(g, ramp(u, 24.2, 0.6), () => {
        panel(g, 660, 146, 540, 230, { fill: COL.panel, stroke: COL.faint });
        const y = 196, Lr = lay(g, phraseToks('the remaining seats', [['seats', 'own', 'own'], ['remaining', 'p', 'p']], 'rs'), { x: 684, y, size: 32 });
        drawLay(g, Lr); sayLay(Lr, 'the remaining seats');
        mark(g, true, Lr.x + Lr.w + 26, y, 16);
        relDiagram(g, 930, 300, { L: 'the seats', R: null, v: 'remain', ko: '남다' }, { size: 20, span: 330, p: ramp(u, 25, 1), lab: ramp(u, 26.4, 0.5), forms: true, own: 0, ownA: ramp(u, 25.6, 0.5) });
      });
      fade(g, ramp(u, 29.2, 0.5), () => label(g, '자동사 → 늘 -ing (수동태가 없었죠 · T03)', LX, 430, { size: 18, color: COL.trap }));
      chipRow(g, ['remaining seats', 'rising costs', 'existing customers', 'emerging markets'], LX, 482, u, 29.8, { color: COL.rel, size: 18, h: 40, step: 0.4 });
      fade(g, ramp(u, 31.6, 0.5), () => txt(g, 'remained · risen · existed로는 명사를 꾸미지 않아요', LX, 540, { size: 17, weight: 600, color: COL.muted }));
    },

    /* 04 명사 뒤의 분사구: -ing + 목적어 → -ed + by → 줄어든 관계사절 */
    after(g, u) {
      const full = S.full || u > 29.2, gp = S.full ? 1 : ramp(u, 29.4, 1.2);
      const s1 = 'Employees using the new software must attend a training session.', s1f = 'Employees who are using the new software must attend a training session.';
      const sp1 = [['Employees', 'own', 'own'], ['who are', 'ghost', 'gh'], ['using', 'p', 'p'], ['the new software', 'obj', 'obj'], ['must attend', 'mv', 'mv']];
      const A0 = lay(g, keyed(phraseToks(s1, sp1, 'a'), 'a'), { x: LX, y: 232, size: 30 }), A1 = lay(g, keyed(phraseToks(s1f, sp1, 'a'), 'a'), { x: LX, y: 232, size: 30 });
      const LA = full && gp >= 1 ? A1 : A0;
      fade(g, ramp(u, 0.4, 0.6), () => {
        const st = tk => tk.tag === 'obj' && u > 9.6 ? { cue: true } : tk.tag === 'mv' && u < 6 ? { r: '' } : {};
        if (full && gp < 1) morph(g, A0, A1, gp, { style: st }); else drawLay(g, LA, st);
        sayLay(LA, full ? s1f : s1);
        const o = byTag(LA, 'own'), p = byTag(LA, 'p'), ob = byTag(LA, 'obj');
        if (!full || gp >= 1) {
          bracket(g, p, ob, COL.clause, ramp(u, 2.4, 0.8), 30);
          fade(g, ramp(u, 3, 0.5), () => txt(g, '분사구 → 명사 뒤', p.x, p.y + 54, { size: 16, weight: 700, color: COL.clause }));
          arc(g, p.x + p.w / 2, p.y - 28, o.x + o.w / 2, o.y - 28, 26, COL.ante, ramp(u, 6.4, 0.8));
          under(g, o, '주인', COL.ante, ramp(u, 6.8, 0.4), -46, 16);
          under(g, ob, '목적어', COL.verb, ramp(u, 9.8, 0.4), -46, 16);
          scan(g, p, ob, u, 8.4);
        }
      });
      const c1 = PT.ctxOwner({ v: 'use' }, { n: 'Employees', rel: 'do', slot: 'post', obj: 'the new software', main: 'must attend' });
      tryList(g, [['using', PT.judge('ing', c1)], ['used', PT.judge('ed', c1)]], LX + 10, 320, u, 12.4, { horiz: true, size: 22, step: 1, notes: ['하는 쪽 + 목적어', '-ed 뒤에는 목적어가 올 수 없어요'] });
      fade(g, ramp(u, 13.4, 0.6), () => chip(g, '-ing + 목적어 ✓ · -ed + 목적어 ×', W - 80, 112, { size: 17, weight: 700, color: COL.verb, fill: COL.panel2, stroke: COL.verb, align: 'right', h: 38, r: 10 }));
      // 두 번째: -ed + by
      const s2 = 'The report prepared by the sales team is on your desk.', s2f = 'The report that was prepared by the sales team is on your desk.';
      const sp2 = [['report', 'own', 'own'], ['that was', 'ghost', 'gh'], ['prepared', 'p', 'p'], ['by the sales team', 'cue', 'cue'], ['is', 'mv', 'mv']];
      const B0 = lay(g, keyed(phraseToks(s2, sp2, 'b'), 'b'), { x: LX, y: 432, size: 30 }), B1 = lay(g, keyed(phraseToks(s2f, sp2, 'b'), 'b'), { x: LX, y: 432, size: 30 });
      const LB = full && gp >= 1 ? B1 : B0;
      fade(g, ramp(u, 18.2, 0.6), () => {
        const st = tk => tk.tag === 'cue' && u > 21 ? { cue: true, cueDash: true } : {};
        if (full && gp < 1) morph(g, B0, B1, gp, { style: st }); else drawLay(g, LB, st);
        sayLay(LB, full ? s2f : s2);
        const o = byTag(LB, 'own'), p = byTag(LB, 'p'), c = byTag(LB, 'cue');
        if (!full || gp >= 1) {
          arc(g, p.x + p.w / 2, p.y - 28, o.x + o.w / 2, o.y - 28, 22, COL.ante, S.full ? 1 : ramp(u, 19.6, 0.8));
          under(g, o, '주인', COL.ante, S.full ? 1 : ramp(u, 20, 0.4), -46, 16);
          under(g, c, 'by + 하는 쪽', COL.verb, S.full ? 1 : ramp(u, 21.2, 0.4), -46, 16);
        }
      });
      const c2 = PT.ctxOwner({ v: 'prepare' }, { n: 'report', rel: 'done', slot: 'post', main: 'is' });
      tryList(g, [['prepared', PT.judge('ed', c2)], ['preparing', PT.judge('ing', c2)]], LX + 10, 506, u, 24.4, { horiz: true, size: 22, step: 1, notes: ['당하는 쪽 + by', '보고서는 작성하는 쪽이 아니에요'] });
      fade(g, ramp(u, 29.6, 0.6), () => chip(g, '분사구 = 관계사절 − who are · that was', W - 80, 506, { size: 17, weight: 700, color: COL.clause, fill: COL.panel2, stroke: COL.clause, h: 36, r: 10, align: 'right' }));
    },

    /* 05 감정 분사: 감정 동사 → 관계 그림 → 일으키는 쪽 -ing / 느끼는 쪽 -ed */
    emotion(g, u) {
      const EM = PT.EMO[S.emo || 0], D = PT.verb(EM.v);
      fade(g, ramp(u, 0.4, 0.6), () => {
        const w = txt(g, D.w, LX, 176, { size: 30, weight: 700, color: COL.rel });
        txt(g, `= ${D.mean} · 감정을 일으키는 동사`, LX + w + 16, 177, { size: 19, weight: 600, color: COL.soft });
        say(LX - 6, 154, w + 12, 44, D.w);
      });
      const T = phraseToks(EM.s, [[cap1(EM.L), 'dl', 'L'], [EM.R, 'dr', 'R']], 'e');
      const Ls = lay(g, T, { x: W / 2, y: 238, size: 32, align: 'center' });
      fade(g, ramp(u, 6.2, 0.6), () => { drawLay(g, Ls); sayLay(Ls, EM.s); });
      // 주인 고리: 12초부터 L(감정을 일으키는 쪽), 18초부터 R(느끼는 쪽)
      relDiagram(g, W / 2, 344, { L: EM.L, R: EM.R, v: EM.v, ko: D.mean, emo: true }, { a: ramp(u, 8, 0.5), p: ramp(u, 8.4, 1.2), lab: ramp(u, 10.2, 0.5), forms: u > 12.2,
        own: ramp(u, 18.2, 0.8), ownA: ramp(u, 12.2, 0.5), span: 600 });
      [['L', EM.cause, EM.ko[0], LX, 12.6], ['R', EM.feel, EM.ko[1], 660, 18.6]].forEach(([side, ph, ko, x, at]) => fade(g, ramp(u, at, 0.6), () => {
        const w = PT.verb(EM.v).f[side === 'L' ? 4 : 3], y = 466;
        const Lp = lay(g, phraseToks(ph, [[w, 'p', 'p'], [ph.slice(ph.indexOf(w) + w.length + 1), 'own', 'own']], 'p' + side), { x, y, size: 32 });
        drawLay(g, Lp); sayLay(Lp, ph);
        txt(g, '→ ' + ko, x, y + 44, { size: 19, weight: 700, color: side === 'L' ? COL.verb : COL.gap });
      }));
      fade(g, ramp(u, 24.4, 0.6), () => {
        sideChip(g, 'L', '일으키는 쪽 = 하는 쪽 → -ing', LX, 548, 1, { align: 'left', size: 18, h: 40 });
        sideChip(g, 'R', '느끼는 쪽 = 당하는 쪽 → -ed', 660, 548, ramp(u, 25.2, 0.5), { align: 'left', size: 18, h: 40 });
      });
    },

    /* 06 지루한 영화, 지루한 나: 한국어 한 낱말 ↔ 영어 두 모양 → I was boring의 함정 → 지름길과 그 한계 → -ed + 전치사 */
    korean(g, u) {
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, LX, 146, 540, 176, { fill: COL.panel, stroke: COL.faint });
        label(g, '한국어', LX + 24, 174, { size: 16, color: COL.soft });
      });
      [['영화가 ', 214], ['나는 ', 274]].forEach(([s, y], k) => fade(g, ramp(u, 0.8 + k * 1.2, 0.5), () => {
        const w = txt(g, s, LX + 24, y, { size: 30, weight: 600 });
        txt(g, '지루하다.', LX + 24 + w, y, { size: 30, weight: 700, color: COL.trap });
      }));
      fade(g, ramp(u, 3.4, 0.5), () => sideBrace(g, LX + 300, 214, 274, '한 낱말', COL.trap));
      fade(g, ramp(u, 6, 0.6), () => {
        panel(g, 660, 146, 540, 176, { fill: COL.panel, stroke: COL.faint });
        label(g, '영어', 684, 174, { size: 16, color: COL.soft });
      });
      [['The movie was ', 'boring', '.', 214, COL.verb, '일으킴', 'The movie was boring.'], ['I was ', 'bored', '.', 274, COL.gap, '느낌', 'I was bored.']].forEach(([a, b, c, y, col, nm, s], k) => fade(g, ramp(u, 6.4 + k * 2.4, 0.5), () => {
        const w = pieces(g, [[a, COL.text], [b, col, true], [c, COL.text]], 684, y, 30);
        txt(g, nm, 684 + w + 18, y, { size: 17, weight: 700, color: col });
        say(678, y - 22, w + 12, 44, s);
      }));
      fade(g, ramp(u, 10.4, 0.5), () => sideBrace(g, 1110, 214, 274, '둘', COL.rel));
      // 함정
      fade(g, ramp(u, 12.2, 0.6), () => {
        const y = 386, w = pieces(g, [['I was ', COL.trap], ['boring', COL.trap, true], ['.', COL.trap]], LX, y, 28);
        txt(g, '= 나는 남을 지루하게 하는 사람이었다', LX + w + 20, y, { size: 19, weight: 600, color: COL.muted });
        say(LX - 6, y - 20, w + 12, 40, 'I was boring.');
      });
      // 지름길
      fade(g, ramp(u, 18.2, 0.5), () => label(g, '지름길', LX, 446, { size: 17, color: COL.soft }));
      sideChip(g, 'R', '사람 → 대개 느끼는 쪽 → -ed', LX + 80, 446, ramp(u, 18.8, 0.5), { align: 'left', size: 17, h: 38 });
      sideChip(g, 'L', '물건 · 일 → 대개 일으키는 쪽 → -ing', 560, 446, ramp(u, 20.6, 0.5), { align: 'left', size: 17, h: 38 });
      fade(g, ramp(u, 25.2, 0.6), () => {
        const y = 502, w = pieces(g, [['a ', COL.text], ['boring', COL.rel, true], [' speaker', COL.ante, true]], LX, y, 28);
        say(LX - 6, y - 20, w + 12, 40, 'a boring speaker');
        txt(g, '사람이어도 남을 지루하게 하면 → -ing', LX + w + 20, y, { size: 18, weight: 600, color: COL.muted });
        chip(g, '지름길일 뿐 · 늘 주인에게 묻기', W - 80, y, { size: 16, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'right', h: 36, r: 10 });
      });
      fade(g, ramp(u, 30.2, 0.5), () => label(g, '느끼는 쪽 + 전치사', LX, 556, { size: 17, color: COL.soft }));
      chipRow(g, ['interested in', 'satisfied with', 'excited about', 'pleased with'], LX + 170, 556, u, 30.6, { color: COL.gap, size: 17, h: 36, step: 0.35 });
    },

    /* 07 분사구문: 주인 = 콤마 뒤 주절의 주어 (지어진 쪽 · 맞서는 쪽 · 감명을 받은 쪽) */
    clause(g, u) {
      const rows = [
        { s: 'Built in 1920, the theater is the oldest building in town.', p: 'Built', own: 'the theater', ph: 'Built in 1920', y: 236, at: 0.4, ownAt: 6.4, note: ['R', '극장은 지어지는 쪽 → -ed'], noteAt: 13 },
        { s: 'Facing a tight deadline, the team worked all weekend.', p: 'Facing', own: 'the team', ph: 'Facing a tight deadline', obj: 'a tight deadline', y: 360, at: 18.2, ownAt: 19, note: ['L', '팀은 맞서는 쪽 + 목적어 → -ing'], noteAt: 20.6 },
        { s: 'Impressed by her presentation, the client signed the contract.', p: 'Impressed', own: 'the client', ph: 'Impressed by her presentation', by: 'by her presentation', y: 484, at: 24.4, ownAt: 25.2, note: ['R', '고객은 감명을 받은 쪽 → -ed'], noteAt: 27 },
      ];
      rows.forEach((r, k) => fade(g, ramp(u, r.at, 0.6), () => {
        const T = phraseToks(r.s, [[r.own, 'own', 'own'], [r.obj || '', 'obj', 'obj'], [r.by || '', 'cue', 'cue'], [r.p, 'p', 'p']], 'k' + k);
        const L = lay(g, T, { x: LX, y: r.y, size: 30 });
        drawLay(g, L, tk => tk.tag === 'cue' ? { cue: true, cueDash: true } : tk.tag === 'own' && u < r.ownAt ? { r: '' } : {});
        sayLay(L, r.s);
        const p = byTag(L, 'p'), o = byTag(L, 'own'), last = L.items[L.items.findIndex(t => t.t === ',') - 1];
        bracket(g, p, last, COL.clause, ramp(u, r.at + 1.4, 0.8), 28);
        if (k === 0) fade(g, ramp(u, 2.4, 0.5) * (1 - ramp(u, 11.4, 0.5)), () => txt(g, '분사구문', p.x, p.y + 52, { size: 16, weight: 700, color: COL.clause }));
        arc(g, p.x + p.w / 2, p.y - 26, o.x + o.w / 2, o.y - 26, 22, COL.ante, ramp(u, r.ownAt, 1));
        under(g, o, k === 0 ? '주인 = 주절의 주어' : '주인', COL.ante, ramp(u, r.ownAt + 0.6, 0.4), -60, 16);
        sideChip(g, r.note[0], r.note[1], W - 80, r.y + 58, ramp(u, r.noteAt, 0.5), { align: 'right', size: 16, h: 34 });
      }));
    },

    /* 08 접속사가 남은 분사구문: 명령문의 숨은 주어 you → once + -ed → 짝 표현 두 줄 */
    conj(g, u) {
      const s1 = 'When using the copier, enter your staff ID first.', s1y = 'When using the copier, (you) enter your staff ID first.';
      const sp1 = [['When', 'conj', 'conj'], ['using', 'p', 'p'], ['the copier', 'obj', 'obj'], ['(you)', 'own', 'you'], ['enter', 'mv', 'mv']];
      const A0 = lay(g, keyed(phraseToks(s1, sp1, 'a'), 'a'), { x: LX, y: 236, size: 32 }), A1 = lay(g, keyed(phraseToks(s1y, sp1, 'a'), 'a'), { x: LX, y: 236, size: 32 });
      const yp = ramp(u, 6.4, 1);
      fade(g, ramp(u, 0.4, 0.6), () => {
        const st = tk => tk.tag === 'you' ? { color: COL.ante, plain: true } : tk.tag === 'obj' && u > 9.6 ? { cue: true } : {};
        if (yp > 0 && yp < 1) morph(g, A0, A1, yp, { style: st }); else drawLay(g, yp >= 1 ? A1 : A0, st);
        const L = yp >= 1 ? A1 : A0;
        sayLay(L, s1);
        const p = byTag(L, 'p'), ob = byTag(L, 'obj');
        if (yp >= 1) {
          const o = byTag(L, 'you');
          fade(g, ramp(u, 7.4, 0.5), () => boxSpan(g, o, o, COL.ante, true));
          arc(g, p.x + p.w / 2, p.y - 26, o.x + o.w / 2, o.y - 26, 30, COL.ante, ramp(u, 7.6, 0.9));
          under(g, o, '숨은 주어 = 주인', COL.ante, ramp(u, 8, 0.4), -56, 16);
          under(g, ob, '목적어', COL.verb, ramp(u, 9.8, 0.4), 46, 16);
        }
        under(g, byTag(L, 'conj'), '접속사', COL.clause, ramp(u, 1.6, 0.4) * (1 - ramp(u, 6, 0.4)), 46, 16);
      });
      const s2 = 'Once approved, the plan will take effect in May.';
      const LB = lay(g, phraseToks(s2, [['Once', 'conj', 'conj'], ['approved', 'p', 'p'], ['the plan', 'own', 'own'], ['will take', 'mv', 'mv']], 'b'), { x: LX, y: 356, size: 32 });
      fade(g, ramp(u, 12.2, 0.6), () => {
        drawLay(g, LB); sayLay(LB, s2);
        const p = byTag(LB, 'p'), o = byTag(LB, 'own');
        arc(g, p.x + p.w / 2, p.y - 26, o.x + o.w / 2, o.y - 26, 26, COL.ante, ramp(u, 13, 0.8));
        under(g, o, '주인', COL.ante, ramp(u, 13.4, 0.4), -46, 16);
        sideChip(g, 'R', '계획은 승인되는 쪽 → -ed', W - 80, 356, ramp(u, 14.6, 0.5), { align: 'right', size: 16, h: 34 });
      });
      fade(g, ramp(u, 18.2, 0.5), () => sideChip(g, 'R', '+ -ed', LX, 440, 1, { align: 'left', size: 17, h: 36 }));
      chipRow(g, ['if needed', 'once approved', 'until signed', 'unless otherwise noted'], LX + 100, 440, u, 18.6, { color: COL.rel, size: 17, h: 36, step: 0.4 });
      fade(g, ramp(u, 25.2, 0.5), () => sideChip(g, 'L', '+ -ing', LX, 498, 1, { align: 'left', size: 17, h: 36 }));
      chipRow(g, ['before leaving', 'after reviewing', 'while working', 'when using'], LX + 100, 498, u, 25.6, { color: COL.rel, size: 17, h: 36, step: 0.4 });
      fade(g, ramp(u, 27.6, 0.6), () => txt(g, 'before · after → 전치사로도 쓰여서 -ing (당하는 뜻이면 being + p.p.)', LX, 554, { size: 17, weight: 600, color: COL.muted }));
    },

    /* 09 3단계 풀이법 흐름도 (판정기로 길이 켜짐) */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 주인', sub: '분사가 꾸미는 말', at: 5.6, boxes: [
          ['명사 앞 · 명사 뒤의 분사', '→ 꾸밈받는 명사', COL.ante], ['be · find 뒤의 보어', '→ 설명받는 주어 · 목적어', COL.ante],
          ['분사구문 (콤마 앞)', '→ 주절의 주어 (명령문은 you)', COL.ante], ['동사 · 명사 · 부사 보기', '→ 꾸미지 못해서 탈락', COL.bad]] },
        { x: 480, head: '② 질문', sub: '하나요, 당하나요?', at: 11.6, boxes: [
          ['하는 쪽', '→ -ing', COL.verb], ['당하는 쪽', '→ -ed', COL.gap],
          ['감정을 일으키는 쪽', '→ -ing', COL.verb], ['감정을 느끼는 쪽', '→ -ed', COL.gap]] },
        { x: 880, head: '③ 확인', sub: '뒤를 보기', at: 18.2, boxes: [
          ['뒤에 목적어', '→ -ing만 가능', COL.verb], ['뒤에 by · 전치사구 · 시간', '→ 대개 -ed', COL.gap],
          ['자동사 remain · rise · exist', '→ 늘 -ing', COL.trap], ['before · after 뒤', '→ -ing', COL.verb]] },
      ];
      const P = S.path && S.path.slot && S.path.rel && S.path.after ? S.path : null;
      let on = [[], [], []], verdict = null;
      if (P) {
        const R = PT.decide(P.slot, P.rel, P.after);
        on[0] = [{ pre: 0, post: 0, comp: 1, clause: 2 }[P.slot]];
        on[1] = [{ do: 0, vi: 0, done: 1, cause: 2, feel: 3 }[P.rel]];
        on[2] = P.rel === 'vi' ? [2] : P.after === 'obj' ? [0] : [1];
        verdict = R.ok ? `${R.text} · ${R.why}` : R.why;
        if (!R.ok) on[2] = [];
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
      if (verdict) {
        let size = 18; while (tw(g, verdict, size, 700) > 1080 && size > 13) size--;
        chip(g, verdict, W / 2, 552, { size, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 42, r: 10 });
      }
    },

    /* 10 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = PT.DRILL[P.k];
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0] + 0.6, s3 = v >= P.win;
        // 빈칸 자리는 처음부터 답의 너비로 잡아 둠 → 답을 채울 때 줄이 바뀌지 않음
        const minW = Math.max(...it.opts.map(([o]) => tw(g, o, 31, 700) / 31 + 0.7));
        const T = drillToks(it, 'p' + pi).map(tk => tk.r === 'blank' ? Object.assign({}, tk, { t: it.opts[it.a][0], r: s3 ? 'ans' : 'blank', minW }) : tk);
        let L, size = 31;
        do { L = lay(g, T, { x: LX, y: 234, size, maxW: 1110, lh: 54 }); size -= 1; } while (L.lines > 1 && size >= 26);
        const cueC = it.cue && it.cue[1] === 'time' ? COL.trap : COL.verb;
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: v >= P.at[1] && !s3 ? 0.6 : 0, hide: true }
          : tk.tag === 'own' ? (s1 ? (it.you ? {} : { cue: true, cueColor: COL.ante }) : { r: '' })
          : tk.tag === 'main' || tk.tag === 'conj' ? (s1 ? {} : { r: '' })
          : tk.tag === 'trap' ? (v >= P.at[2] - 0.2 ? { color: COL.trap } : {})
          : tk.tag === 'cue' && v >= P.at[2] ? { cue: true, cueColor: cueC, cueDash: true, color: cueC } : {});
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        const ow = byTag(L, 'own');
        if (ow && !it.you) under(g, ow, '주인', COL.ante, ramp(v, P.at[0] + 0.8, 0.4), -46, 15);
        const oy = L.lines > 1 ? 352 : 318;
        it.opts.forEach(([o, code], k) => {
          const ox = LX + (k % 2) * 290, y = oy + Math.floor(k / 2) * 92, j = PT.judgeOpt(it, k);
          const at = j.step === 1 ? P.x[0] : j.step === 2 ? P.x[1] : 1e9;
          const right = k === it.a, gone = !right && v >= at, win = right && s3;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, o, ox + 52, y, { size: 27, weight: win ? 700 : 600, color: win ? COL.good : gone ? COL.dim : COL.text });
          fade(g, ramp(v, P.at[0] + 1.2, 0.5), () => txt(g, PT.formName(code), ox + 52, y + 30, { size: 14, weight: 600, color: gone ? COL.dim : COL.muted }));
          if (gone) {
            const gp = clamp((v - at) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, y + 1); g.lineTo(ox - 4 + (w + 62) * gp, y + 1); g.stroke();
          }
          if (win) { panel(g, ox - 14, y - 26, w + 84, 70, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + w + 92, y, 18); }
        });
        panel(g, 660, oy - 40, 560, 236, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = oy - 2 + k * 72;
          txt(g, ['① 주인', '② 질문', '③ 확인'][k], 684, y, { size: 18, weight: 700, color: COL.accent });
          txt(g, ln, 684, y + 30, { size: 18, weight: 600, color: k === 2 ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 560, 760], Y0 = 152, RH = 40;
      const rows = [
        ['명사 앞 · 하는 쪽', '-ing', 'a leading supplier', COL.verb],
        ['명사 앞 · 당하는 쪽', '-ed', 'the enclosed instructions', COL.gap],
        ['자동사 (remain · rise · exist)', '늘 -ing', 'the remaining seats', COL.trap],
        ['명사 뒤 + 목적어', '-ing', 'employees using the software', COL.verb],
        ['명사 뒤 + by · 시간 · 장소', '-ed', 'the report prepared by the team', COL.gap],
        ['감정을 일으키는 쪽', '-ing', 'an exciting offer', COL.verb],
        ['감정을 느끼는 쪽 (+ in · with)', '-ed', 'excited customers', COL.gap],
        ['분사구문 (주인 = 주절의 주어)', '-ing · -ed', 'Once approved, the plan …', COL.clause],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 12, { fill: COL.panel, stroke: COL.faint });
        ['주인과 자리', '분사', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 18, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 4, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.55, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 18;
        txt(g, r[0], X[0] + 20, y, { size: 18, weight: 600 });
        txt(g, r[1], X[1] + 20, y, { size: 19, weight: 700, color: r[3] });
        txt(g, r[2], X[2] + 20, y, { size: 18, weight: 500, color: COL.en });
        say(X[2] + 14, y - 18, 420, 36, r[2].replace(' …', ''));
      }));
      const steps = ['① 주인 찾기', '② 하나요, 당하나요?', '③ 뒤로 확인'];
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

  // 놀이터(주인 바꾸기 실험실)의 작은 무대: 관계 그림. 논리 크기 1000×230 (좁은 화면에서는 620×230으로 글자를 키움)
  // o: { w: 논리 너비, own: 0(L) → 1(R), reveal: 아래 이름표에 -ing · -ed까지 보여 줄지 }
  PTS.STAGE = { w: 1000, h: 230 };
  PTS.stage = function (g, E, o = {}) {
    const SW = o.w || PTS.STAGE.w, SH = PTS.STAGE.h, s = g.canvas.width / SW, D = PT.verb(E.v), narrow = SW < 800;
    g.setTransform(s, 0, 0, s, 0, 0); g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, SW, SH);
    g.fillStyle = COL.grid; for (let x = 20; x < SW; x += 40) for (let y = 20; y < SH; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const boxW = sz => Math.max(tw(g, E.L, sz, 700), E.R ? tw(g, E.R, sz, 700) : tw(g, '받는 쪽 없음', sz * 0.72, 700)) + sz * 1.4;
    let size = 26; while (size > 16 && SW - 40 - boxW(size) < (narrow ? 260 : 420)) size -= 2;
    const span = Math.min(620, SW - 40 - boxW(size));
    relDiagram(g, SW / 2, 112, { L: E.L, R: E.R || null, v: E.v, ko: D.mean, emo: D.type === 'emo' }, { size, span, p: 1, lab: 1, forms: !!o.reveal, own: o.own || 0, ownA: 1, lsize: narrow ? 21 : 16 });
  };

  PTS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[PTS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, PTS.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  // 직접 해 보기로만 나오는 글자(다른 동사·주인·때·감정 동사·판정기)도 함께 넣음
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + PT.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←✓×?~=+-/:…‘’';
  PTS.baseText = EXTRA;
  PTS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = PTS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { PTS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
