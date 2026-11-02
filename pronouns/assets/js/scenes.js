/* 대명사 튜토리얼 — 영상 장면
 *
 * PNS.render(g, t)는 시각 t와 사용자 상태 PNS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 영어 문장은 낱말 조각(토큰)으로 그리고, 역할마다 색을 칠합니다:
 *   가리키는 말(선행사) 하늘 · 대명사(답) 노랑 · 자리 단서(앞의 동사·전치사, 뒤의 명사) 보라 · 짝 표현(one, of …, who …) 민트 · 함정 주황
 *   빈칸은 분홍 점선 상자. 대명사 표에서 줄(가리키는 대상)은 하늘, 칸(자리)은 보라로 켜집니다.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(PN.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const PN = window.PN;
  const PNS = (window.PNS = {});
  const W = 1280, H = 720;
  PNS.W = W; PNS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  PNS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  PNS.COL = COL;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (PNS.S = { s01: 0, a02: null, r03: 'they', self05: null, n06: null, c08: null, path: null });
  PNS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  PNS.hits = () => HITS;

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
    return pt(N / 2);
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
  const note = (g, s, x, y, c, o = {}) => chip(g, s, x, y, Object.assign({ size: 17, weight: 700, color: c, fill: COL.panel2, stroke: c, h: 36, r: 10 }, o));
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([7, 6]); g.stroke(); g.setLineDash([]); }
  }
  const say = (x, y, w, h, text) => HITS.push({ x, y, w, h, say: text });

  /* ---------- 영어 문장 토큰 배치와 그리기 ---------- */
  // 토큰 { id, t: 글자, r: 역할 }. 역할: ante 가리키는 말 · pr 대명사(답) · cue 자리 단서 · pair 짝 표현 · trap 함정 · ghost 줄어든 말
  //   fn 기능어 · blank 빈칸 · ans 채운 답 · bad 틀림 · '' 보통
  const RCOL = { ante: COL.ante, pr: COL.rel, cue: COL.verb, pair: COL.clause, trap: COL.trap, ghost: COL.dim, fn: COL.muted, bad: COL.bad, good: COL.good, dim: COL.dim };
  const UNDER = { ante: 1, pr: 1 };
  const PUNCT = /^[.,?!:;]$/;
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
      if (cur.length) x += punct ? size * 0.1 : sp;   // 문장 부호 앞도 조금 띄움 (상자와 겹치지 않게)
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
    return { items, byId, size, lines: lines.length, x: left, w: right - left, y: o.y, h: (lines.length - 1) * lh + size * 1.3 };
  }
  // 낱말 경계를 지켜 찾기 (their 속의 the, theirs 속의 their를 잘못 찾지 않게)
  function findWord(q, t, from = 0, nth = 0) {
    const e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp((/^\w/.test(t) ? '\\b' : '') + e + (/\w$/.test(t) ? '(?![\\w’\'])' : ''), 'g');
    re.lastIndex = from; let m = re.exec(q);
    for (let k = 0; k < nth && m; k++) m = re.exec(q);
    return m ? m.index : -1;
  }
  // 문장 속 글자들을 한 토큰으로 묶어 나눔. spec: [[글자, 역할, 표시, 몇 번째]]
  function phraseToks(q, spec, pre = 'q') {
    const marks = [];
    spec.concat([['___', 'blank']]).forEach(([t, r, tag, nth]) => {
      if (!t) return;
      const i = t === '___' ? q.indexOf(t) : findWord(q, t, 0, nth || 0);
      if (i >= 0 && !marks.some(m => i < m.e && i + t.length > m.s)) marks.push({ s: i, e: i + t.length, t, r, tag });
    });
    marks.sort((a, b) => a.s - b.s);
    const out = []; let at = 0;
    const push = (t, r, tag) => out.push({ id: pre + out.length, t, r, tag });
    const plain = s => s.split(' ').forEach(w => { if (!w) return; const m = w.match(/^(.*?)([.,?!:;]?)$/); if (m[1]) push(m[1], ''); if (m[2]) push(m[2], ''); });
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
      const h = size * 1.22, c = o.color || COL.rel;
      rr(g, x, y - h / 2, w, h, 9);
      g.fillStyle = o.color ? 'rgba(255,107,107,0.14)' : 'rgba(255,193,94,0.16)'; g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.stroke();
      txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: c, align: 'center' });
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
  // 토큰 여럿 아래 꺾쇠. p: 그려진 정도
  function bracket(g, a, b, color, p = 1, dy = 30) {
    if (p <= 0.001) return;
    const x0 = a.x, x1 = b.x + b.w, y = a.y + dy, xe = lerp(x0, x1, clamp(p));
    g.strokeStyle = color; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y - 7); g.lineTo(x0, y); g.lineTo(xe, y); if (p >= 0.99) g.lineTo(x1, y - 7); g.stroke();
  }
  // 토큰 여럿을 감싸는 상자
  function boxSpan(g, a, b, color, dash) {
    const pd = a.size * 0.13; rr(g, a.x - pd, a.y - a.size * 0.68, b.x + b.w - a.x + pd * 2, a.size * 1.36, 8);
    g.strokeStyle = color; g.lineWidth = 2.2; if (dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
  }
  // 낱말을 조각내어 그림. parts: [[글자, 색, 밑줄('s' = 줄 긋기)]] → 너비
  function pieces(g, parts, x, y, size, o = {}) {
    let w = 0; parts.forEach(([t]) => { w += tw(g, t, size, o.weight || 600); });
    let xx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    parts.forEach(([t, c, ul]) => {
      const ww = txt(g, t, xx, y, { size, weight: o.weight || 600, color: c || COL.text });
      if (ul === 's') { g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(xx - 2, y + 2); g.lineTo(xx + ww + 2, y + 2); g.stroke(); }
      else if (ul) { g.fillStyle = c; g.fillRect(xx, y + size * 0.56, ww, 3); }
      xx += ww;
    });
    return w;
  }
  // 칩을 한 줄로 늘어놓음. 하나씩 나타남
  function chipRow(g, words, x, y, u, at, o = {}) {
    let xx = x;
    words.forEach((w, k) => {
      const cw = tw(g, w, o.size || 17, 700) + (o.pad || 14) * 2, px = xx;
      fade(g, ramp(u, at + k * (o.step || 0.3), 0.4), () => { chip(g, w, px, y, { size: o.size || 17, weight: 700, color: o.color, fill: COL.panel, stroke: o.color, h: o.h || 36, r: 8, pad: o.pad || 14, dash: o.dash }); if (o.say) say(px, y - 18, cw, 36, w); });
      xx += cw + (o.gap || 12);
    });
    return xx;
  }
  // 보기 몇 개를 ✓/×로 (판정은 규칙 엔진). horiz: 가로로 늘어놓기
  function tryList(g, items, x, y, u, at, o = {}) {
    let xx = x;
    items.forEach(([w, j], k) => {
      const a = ramp(u, at + k * (o.step || 0.9), 0.4), yy = o.horiz ? y : y + k * (o.gap || 44), px = o.horiz ? xx : x;
      const ok = j.s === 'ok', ww = tw(g, w, o.size || 24, 600);
      fade(g, a, () => {
        mark(g, ok, px + 10, yy, 16);
        txt(g, w, px + 36, yy, { size: o.size || 24, weight: 600, color: ok ? COL.good : COL.muted });
        if (!ok) { g.strokeStyle = COL.bad; g.lineWidth = 2.2; g.beginPath(); g.moveTo(px + 32, yy + 1); g.lineTo(px + 40 + ww, yy + 1); g.stroke(); }
        const nt = o.notes ? o.notes[k] : '';
        if (nt) txt(g, nt, px + 36 + ww + 16, yy, { size: 16, weight: 600, color: ok ? COL.good : COL.muted });
        say(px + 30, yy - 18, ww + 12, 36, w);
      });
      if (o.horiz) xx += 36 + ww + 16 + (o.notes && o.notes[k] ? tw(g, o.notes[k], 16, 600) : 0) + 40;
    });
  }
  // 가리키는 화살표: 대명사 토큰 → 가리키는 말 토큰 (위로 휘어짐)
  const point = (g, from, to, h, color, p, o) => arc(g, from.x + from.w / 2, from.y - from.size * 0.78, to.x + to.w / 2, to.y - to.size * 0.78, h, color, p, o);

  /* ---------- 대명사 표: 줄(가리키는 대상) × 칸(자리) ----------
   * o = { x, y, lw: 줄 이름 너비(0이면 없음), cw, rh, hh: 머리 높이, size, rows, cols,
   *       rowA(ri), colA(ci): 나타나는 정도, rowLit · rowLitA, colLit · colLitA, cellLit: [줄, 칸], cellA, dimCols: 흐리게 둘 칸, sayCells }
   */
  function grid(g, o) {
    const rows = o.rows || PN.ROWS, cols = o.cols || PN.CASES, lw = o.lw == null ? 170 : o.lw, cw = o.cw || 128, rh = o.rh || 46, hh = o.hh || 38, size = o.size || 21;
    const x0 = o.x, y0 = o.y, GW = lw + cw * cols.length, GH = hh + rh * rows.length;
    const rowA = o.rowA || (() => 1), colA = o.colA || (() => 1);
    const geo = {
      x: x0, y: y0, w: GW, h: GH,
      cell: (r, cs) => ({ x: x0 + lw + cols.indexOf(cs) * cw, y: y0 + hh + rows.indexOf(r) * rh, w: cw, h: rh }),
      row: r => ({ x: x0, y: y0 + hh + rows.indexOf(r) * rh, w: GW, h: rh }),
      col: cs => ({ x: x0 + lw + cols.indexOf(cs) * cw, y: y0, w: cw, h: GH }),
    };
    fade(g, o.a == null ? 1 : o.a, () => {
      panel(g, x0 - 10, y0 - 6, GW + 20, GH + 12, { fill: COL.panel, stroke: COL.faint, r: 12 });
      rows.forEach((r, ri) => { if (ri) fade(g, rowA(ri), () => { g.fillStyle = COL.faint; g.fillRect(x0, y0 + hh + ri * rh, GW, 1); }); });
      g.fillStyle = COL.faint; g.fillRect(x0, y0 + hh - 1, GW, 1);
      // 칸 띠 (자리 → 보라)
      if (o.colLit && (o.colLitA == null ? 1 : o.colLitA) > 0) fade(g, o.colLitA == null ? 1 : o.colLitA, () => {
        const C = geo.col(o.colLit); rr(g, C.x + 3, C.y + 2, C.w - 6, C.h - 4, 10);
        g.fillStyle = 'rgba(201,167,255,0.10)'; g.fill(); g.strokeStyle = COL.verb; g.lineWidth = 2; g.stroke();
      });
      // 줄 띠 (가리키는 대상 → 하늘)
      if (o.rowLit && (o.rowLitA == null ? 1 : o.rowLitA) > 0) fade(g, o.rowLitA == null ? 1 : o.rowLitA, () => {
        const R = geo.row(o.rowLit); rr(g, R.x - 4, R.y + 3, R.w + 8, R.h - 6, 10);
        g.fillStyle = 'rgba(110,200,255,0.12)'; g.fill(); g.strokeStyle = COL.ante; g.lineWidth = 2; g.stroke();
      });
      cols.forEach((cs, ci) => fade(g, colA(ci), () => txt(g, PN.CASE[cs].name, x0 + lw + ci * cw + cw / 2, y0 + hh / 2, { size: 15, weight: 700, color: o.colLit === cs ? COL.verb : COL.muted, align: 'center' })));
      rows.forEach((r, ri) => fade(g, rowA(ri), () => {
        const y = y0 + hh + ri * rh + rh / 2, litR = o.rowLit === r && (o.rowLitA == null || o.rowLitA > 0.5);
        if (lw) txt(g, PN.ROW[r].ko, x0 + 12, y, { size: 16, weight: 600, color: litR ? COL.ante : COL.soft });
        cols.forEach((cs, ci) => fade(g, colA(ci) * ((o.dimCols || []).includes(cs) && !litR ? 0.38 : 1), () => {
          const w = PN.cell(r, cs), cx = x0 + lw + ci * cw + cw / 2;
          const lit = o.cellLit && o.cellLit[0] === r && o.cellLit[1] === cs;
          if (lit) fade(g, o.cellA == null ? 1 : o.cellA, () => { rr(g, cx - cw / 2 + 8, y - rh / 2 + 6, cw - 16, rh - 12, 8); g.fillStyle = 'rgba(255,193,94,0.20)'; g.fill(); g.strokeStyle = COL.rel; g.lineWidth = 2.2; g.stroke(); });
          const c = lit && (o.cellA == null || o.cellA > 0.5) ? COL.rel : !w ? COL.dim : litR ? COL.text : o.colLit === cs ? COL.text : COL.soft;
          txt(g, w || '—', cx, y + 1, { size, weight: lit ? 700 : 600, color: c, align: 'center' });
          if (w && o.sayCells !== false) say(cx - cw / 2 + 6, y - rh / 2 + 4, cw - 12, rh - 8, w);
        }));
      }));
    });
    return geo;
  }
  PNS.grid = grid;

  // 무리 그림: 네모 n개 (사무실·의자 같은 물건). labels[k] = [글, 색] · y 아래에 이름표
  function things(g, cx, y, n, gap, labels, u, at, o = {}) {
    const s = o.s || 64, x0 = cx - (n - 1) * gap / 2, out = [];
    for (let k = 0; k < n; k++) {
      const x = x0 + k * gap, lb = labels[k], c = lb ? lb[1] : COL.line, a = o.all ? 1 : ramp(u, at + k * 0.25, 0.4);
      out.push({ x, y });
      fade(g, a, () => {
        rr(g, x - s / 2, y - s / 2, s, s, 12); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = c; g.lineWidth = lb ? 2.6 : 1.6;
        if (lb && lb[2]) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
        // 창문 넷 (건물 · 상자 그림)
        g.fillStyle = lb ? c : COL.dim; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => { g.globalAlpha *= 0.85; g.fillRect(x + dx * s * 0.16 - s * 0.09, y + dy * s * 0.16 - s * 0.09, s * 0.18, s * 0.18); g.globalAlpha /= 0.85; });
      });
      if (lb && lb[0]) fade(g, o.labA ? o.labA(k) : a, () => txt(g, lb[0], x, y + s / 2 + 24, { size: o.lsize || 19, weight: 700, color: c, align: 'center' }));
    }
    return out;
  }

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '대명사 문제가 묻는 두 가지', d: 24, caps: [
      [0.4, 5.5, '토익 Part 5에는 he, him, his, himself처럼 같은 대명사의 여러 모양 가운데 하나를 고르는 문제가 자주 나와요.'],
      [5.5, 11, '이 문제의 보기를 보세요 → its, it, their, it’s. 비슷해 보여도 가리키는 대상과 자리가 서로 달라요.'],
      [11, 16, '물어볼 것은 두 가지예요. 빈칸이 **누구를** 가리키나? 빈칸이 문장의 **어느 자리**에 있나?'],
      [16, 20, '누구인지가 대명사 표의 **줄**을, 자리가 **칸**을 정해요. 정답은 영상 끝에서 함께 풀어요.'],
      [20, 24, '**화살표**, **자리**, **짝**을 차례로 배우고 **3단계 풀이법**으로 묶어요.'],
    ] },
    { id: 'arrow', n: '01', title: '대명사는 화살표', sub: '가리키는 말 찾기', d: 30, caps: [
      [0.4, 6, '앞에 나온 명사를 되풀이하지 않으려고 대신 쓰는 말이 **대명사**예요. 영어로는 → pronoun.'],
      [6, 12, 'Ms. Kim finished the report and sent it to her manager. it → the report, her → Ms. Kim.'],
      [12, 18, '대명사에서 그 명사로 **화살표**를 그려 보세요. 화살표 끝의 말을 이 영상에서는 **가리키는 말**이라고 불러요.'],
      [18, 24, '한국어는 이런 말을 자주 빼요. ‘김 씨는 보고서를 끝내고 매니저에게 보냈어요.’ ‘그것을’, ‘자기’를 빼도 통해요.'],
      [24, 30, '영어는 빼지 않고 꼭 대명사를 써요. 그래서 누구를 가리키는지, 어느 자리인지에 맞는 모양을 골라야 해요.'],
    ] },
    { id: 'rows', n: '02', title: '줄: 누구를 가리키나', sub: '사람 · 사물, 하나 · 여럿', d: 34, caps: [
      [0.4, 6, '대명사를 표 하나로 모아 볼게요. 가로 **줄**마다 가리키는 대상이 달라요.'],
      [6, 12, '나는 I, 우리는 we, 듣는 사람은 you, 남자 한 사람은 he, 여자 한 사람은 she.'],
      [12, 18, '사물 하나는 **it**, 여럿은 사람이든 사물이든 **they**. 이 줄을 고르는 게 첫 번째 질문이에요.'],
      [18, 24, '회사는 사람이 많이 일해도 **하나**예요. Hanbit Electronics → it 줄, 소유격은 its.'],
      [24, 29, '한국어는 ‘직원’과 ‘직원들’을 꼭 나누지 않아요. 영어 대명사는 하나와 여럿을 꼭 나눠요.'],
      [29, 34, '직원들은 여럿 → they 줄, 소유격은 their. 같은 회사 이야기여도 가리키는 말이 줄을 정해요.'],
    ] },
    { id: 'cols', n: '03', title: '칸: 자리가 모양을 정한다', sub: '주격 · 목적격 · 소유격 · 소유대명사', d: 34, caps: [
      [0.4, 6, '이번에는 세로 **칸**이에요. 같은 줄의 대명사도 문장 속 자리에 따라 모양이 바뀌어요.'],
      [6, 12, '한국어는 조사를 바꿔요. 그들은, 그들을, 그들의. 영어는 낱말 자체가 바뀌어요 → they, them, their.'],
      [12, 18, '동사 앞 주어 자리는 **주격** they. 동사나 전치사 뒤 목적어 자리는 **목적격** them.'],
      [18, 24, '명사 앞에서 ‘누구의’를 말하면 **소유격** their. 소유격 바로 뒤에는 꼭 명사가 와요.'],
      [24, 29, '뒤에 명사 없이 홀로 ‘누구의 것’을 말하면 **소유대명사** theirs.'],
      [29, 34, 'They finished their report. The best report was theirs. 칸은 빈칸의 앞뒤가 정해요.'],
    ] },
    { id: 'alone', n: '04', title: '홀로 서는 theirs, 붙어 서는 its', sub: '소유대명사 · its와 it’s', d: 30, caps: [
      [0.4, 6, '소유격과 소유대명사는 뜻이 비슷해서 헷갈려요. 가르는 기준은 하나, **뒤에 명사가 있나**예요.'],
      [6, 12, 'This is their office. 뒤에 명사가 있어요 → their. This office is theirs. 뒤에 명사가 없어요 → theirs.'],
      [12, 18, 'theirs = their office. 소유대명사는 ‘소유격 + 명사’를 한 낱말로 줄인 말이에요 → mine, yours, hers, ours.'],
      [18, 24, 'it 줄에는 소유대명사가 없어요. 그리고 **its**, **it’s** → 서로 달라요. its → 그것의, it’s = it is.'],
      [24, 30, '‘자기만의’를 말할 때도 소유격 + own → their own office, its own website. on her own = 혼자서.'],
    ] },
    { id: 'self', n: '05', title: '거울 대명사 -self', sub: '주어와 같은 사람', d: 34, caps: [
      [0.4, 6, 'Ms. Novak introduced herself. 목적어가 주어와 **같은 사람**이면 **재귀대명사**를 써요 → 끝이 -self.'],
      [6, 12, 'Ms. Novak introduced her. 이렇게 쓰면 → her = 노박 씨가 아닌 **다른 여자**예요.'],
      [12, 18, '한국어 ‘자기’는 둘 다 돼요. 자기를 소개했다 → herself. 자기 팀을 소개했다 → her team.'],
      [18, 24, '강조할 때도 써요 → Ms. Lopez will hand out the awards herself. 다른 사람이 아니라 **직접**이라는 뜻이에요.'],
      [24, 29, 'by himself = 혼자서, 남의 도움 없이. 같은 뜻 → on his own.'],
      [29, 34, '하지만 재귀대명사는 **주어 자리**에 못 와요 → Mr. Okafor and I will lead the session. 주어는 늘 주격이에요.'],
    ] },
    { id: 'other', n: '06', title: '둘이면 the other', sub: 'one · another · the other', d: 34, caps: [
      [0.4, 6, '이번에는 정해진 사람이 아니라 **몇 개 가운데 하나**를 가리키는 말이에요. 부정대명사라고 불러요.'],
      [6, 12, '둘 가운데 먼저 하나 → one. 남은 하나 → **the other**. 남은 게 하나뿐이라 정해져 있어요 → the.'],
      [12, 18, 'We have two offices. One is in Seoul, and the other is in Busan.'],
      [18, 24, '셋이면 one 다음 하나는 **another**, 마지막 하나는 the other. another = an + other, 또 하나예요.'],
      [24, 29, 'another → 아직 더 남아 있는 ‘또 하나’. the other → 남은 ‘마지막 하나’.'],
      [29, 34, '그래서 둘뿐이면 one 다음은 언제나 → the other. 정해진 나머지를 가리킬 때 → the.'],
    ] },
    { id: 'others', n: '07', title: 'others와 the others', sub: '나머지 전부인가, 다른 몇몇인가', d: 30, caps: [
      [0.4, 6, '여럿을 가리킬 때도 같아요. 정해진 무리에서 나머지 **전부** → **the others**.'],
      [6, 12, 'Of the six chairs, two are broken, but the others are fine. 나머지 네 개가 정해져 있어요.'],
      [12, 18, 'Some guests stayed inside, and others went to the garden. 정해지지 않은 다른 몇몇 → **others**.'],
      [18, 24, '홀로 못 서는 말도 있어요. other + 복수 명사 → other hotels. 단수 명사 앞 → another date.'],
      [24, 30, '소유격과 소유대명사처럼 짝을 지어 보세요 → other + 명사, others 홀로. 서로 = each other.'],
    ] },
    { id: 'that', n: '08', title: '되풀이 대신 that · those', sub: '비교하는 문장 · those who', d: 32, caps: [
      [0.4, 6, '비교하는 문장에서는 같은 명사를 두 번 쓰지 않아요. 가격과 가격을 비교하는 문장을 볼게요.'],
      [6, 12, 'The price of the new model is lower than that of the old model. 뒤의 the price → **that**.'],
      [12, 18, 'This year’s sales are higher than those of last year. 가리키는 말 → sales, 여럿이라 **those**.'],
      [18, 24, '뒤에 of 같은 꾸밈말이 붙으면 대명사 가운데서는 → that, those. 하나면 that, 여럿이면 those.'],
      [24, 32, '**those who** = ~하는 사람들. Those who register early will get a discount. who 절이 꾸미는 사람들 → those.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: '화살표 → 자리 → 짝', d: 30, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11.5, '① **화살표**를 그려요. 가리키는 말이 사람인지 사물인지, 하나인지 여럿인지 보고 줄이 다른 보기를 지워요.'],
      [11.5, 18, '② **자리**를 봐요. 동사 앞은 주격, 동사·전치사 뒤는 목적격, 명사 앞은 소유격, 홀로면 소유대명사.'],
      [18, 24.5, '③ **짝**을 확인해요. 주어와 같은 사람 → -self. 둘 가운데 남은 하나 → the other. 뒤에 of 꾸밈말 → that, those.'],
      [24.5, 30, '이 순서로 처음에 본 문제부터 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '처음에 본 문제예요. ① 화살표 → Hanbit Electronics. 회사 하나라서 it 줄이에요.'],
      [6, 12, '줄이 다른 (C) their 탈락. ② 빈칸 바로 뒤에 명사가 있어요 → headquarters. 명사 앞은 소유격 칸.'],
      [12, 18, '탈락 → (B) it, (D) it’s. it’s = it is. ③ 따로 볼 짝은 없어요. 정답은 (A) its.'],
      [18.4, 24.5, '두 번째 문제. ① 화살표 → Mr. Tanaka, 남자 한 사람이라 he 줄. 보기가 모두 같은 줄이에요.'],
      [24.5, 31, '② 전치사 by 뒤 목적어 자리예요. 탈락 → (A) he, (B) his. 소유격 뒤에는 명사가 와야 해요.'],
      [31, 37, '③ 빈칸 = 주어 Mr. Tanaka 자신. 같은 사람이라 (D) him 탈락. 정답은 (C) himself, 혼자서.'],
      [37.4, 43.5, '세 번째. ① 화살표 → 두 사무실 가운데 남은 하나. 하나라서 → (D) others 탈락.'],
      [43.5, 50, '② 빈칸 뒤에 명사 없이 동사가 와요. 홀로 쓰는 자리라 → (B) other 탈락.'],
      [50, 56, '③ 짝을 봐요. one 다음 남은 마지막 하나 → the other. (A) another 탈락, 정답은 (C).'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 표', d: 22, caps: [
      [0.4, 6, '정리해요. 대명사 문제는 두 가지를 물어요. 누구를 가리키나, 어느 자리인가.'],
      [6, 12, '가리키는 말이 표의 줄을 정해요. 회사 하나 → it 줄, 여럿 → they 줄.'],
      [12, 17, '자리가 칸을 정해요. 그리고 짝을 확인해요 → -self, the other, those of.'],
      [17, 22, '아래에서 대명사 표 놀이터와 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  PNS.CHAPTERS = CHAPTERS; PNS.CAPTIONS = CAPTIONS; PNS.END = END;
  PNS.POSTER = CHAPTERS.find(c => c.id === 'rows').t + 21.5;
  PNS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  PNS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(PN.DRILL)에서 세 개. 단계마다 그 단계에서 지워지는 보기를 규칙 엔진으로 확인
  // at: 오른쪽 풀이 줄이 나오는 때 · x: ①②③ 탈락 줄이 그어지는 때 · win: 정답 표시
  const PRACTICE = [
    { k: 12, at: [0.4, 6.3, 14.2], x: [6.6, 12.4, 99], win: 16, lines: ['Hanbit Electronics → it 줄 · (C) 탈락', 'headquarters 앞 → 소유격 · (B) (D) 탈락', '따로 볼 짝 없음 → (A) its'] },
    { k: 5, at: [0.4, 6.3, 12.8], x: [99, 7.4, 13.8], win: 15.8, lines: ['Mr. Tanaka → he 줄 · 모두 같은 줄', 'by 뒤 목적어 자리 · (A) (B) 탈락', '빈칸 = 주어 자신 → -self · (D) 탈락'] },
    { k: 8, at: [0.4, 6.3, 12.8], x: [4.8, 10.8, 15], win: 16.4, lines: ['남은 하나 → 하나 · (D) 탈락', '홀로 쓰는 자리 · (B) 탈락', 'one … the other · (A) 탈락'] },
  ];
  PRACTICE.forEach(p => {
    const it = PN.DRILL[p.k], L = 'ABCD';
    [1, 2, 3].forEach(step => {
      const out = it.opts.map((o, i) => PN.judgeOpt(it, i).step === step ? `(${L[i]})` : '').filter(Boolean).join(' ');
      const bad = out ? !p.lines[step - 1].includes(out + ' 탈락') || p.x[step - 1] >= 99 : p.lines[step - 1].includes('탈락');
      if (bad) console.warn('[대명사] 실전 문제 탈락 표시가 규칙 엔진과 달라요:', it.q, step, out);
    });
    it.opts.forEach((o, i) => { if ((PN.judgeOpt(it, i).s === 'ok') !== (i === it.a)) console.warn('[대명사] 실전 문제가 규칙 엔진과 달라요:', it.q); });
  });
  // 연습 문제 → 토큰 (가리키는 말 · 자리 단서 · 짝을 한 덩어리로)
  function drillToks(it, pre = 'q') {
    const spec = [];
    if (it.ante) spec.push([it.ante, 'ante', 'ante']);
    if (it.cue) spec.push([it.cue, '', 'cue', it.cueNth]);
    if (it.pair && it.pair !== it.ante && !(it.ante || '').includes(it.pair)) spec.push([it.pair, '', 'pair']);
    return phraseToks(it.q, spec, pre);
  }

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o)); }
  const topNote = (g, s, a, c = COL.accent) => fade(g, a, () => note(g, s, W - 80, 112, c, { align: 'right', h: 38 }));

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(its · it · their · it’s) → 누구? 자리? → 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '가리키는 말이 줄을, 자리가 칸을 정한다', W / 2, 290, { size: 56, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Pronouns · who it points to & where it stands', W / 2, 362, { size: 26, weight: 500, color: COL.muted, align: 'center' });
      });
      fade(g, ramp(u, 1.3, 0.4) * out1, () => note(g, '누구를 → 줄', W / 2 - 16, 452, COL.ante, { align: 'right', size: 20, h: 42 }));
      fade(g, ramp(u, 1.6, 0.4) * out1, () => note(g, '어느 자리 → 칸', W / 2 + 16, 452, COL.verb, { align: 'left', size: 20, h: 42 }));
      const it = PN.DRILL[12];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 19, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 160, 1000, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 180, 198, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const L = lay(g, drillToks(it), { x: 180, y: 294, size: 30, maxW: 930, lh: 56 });
        const s1 = u > 11.2, s2 = u > 13.2;
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: u > 15.6 ? 0.5 + 0.5 * Math.sin(u * 4) : 0 }
          : tk.tag === 'ante' ? (s1 ? { cue: true, cueColor: COL.ante } : { r: '' }) : tk.tag === 'cue' ? (s2 ? { cue: true, color: COL.verb } : {}) : {});
        sayLay(L, it.q.replace('___', it.opts[it.a]));
        const ow = byTag(L, 'ante'), bk = blankOf(L), cu = byTag(L, 'cue');
        under(g, ow, '누구를?', COL.ante, ramp(u, 11.6, 0.5), -68, 17);
        fade(g, ramp(u, 11.4, 0.5), () => point(g, bk, ow, 16, COL.ante, ramp(u, 11.4, 0.8)));
        under(g, cu, '자리?', COL.verb, ramp(u, 13.4, 0.5), -52, 17);
        fade(g, ramp(u, 16, 0.5), () => {
          note(g, '누구 → 줄', bk.x + bk.w / 2 - 8, 356, COL.ante, { align: 'right' });
          note(g, '자리 → 칸', bk.x + bk.w / 2 + 8, 356, COL.verb, { align: 'left' });
        });
        it.opts.forEach((o, k) => {
          const ox = 200 + (k % 2) * 400, oy = 424 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            const w = txt(g, o, ox + 64, oy, { size: 30, weight: 600 });
            say(ox + 58, oy - 20, w + 12, 40, o);
          });
        });
        fade(g, ramp(u, 8.6, 0.5), () => note(g, '비슷한 모양 넷', 1010, 455, COL.rel, { align: 'center', size: 18 }));
      });
      const steps = [['①', '화살표', '가리키는 말 찾기'], ['②', '자리', '빈칸 앞뒤 보기'], ['③', '짝', '같은 사람? 짝 표현?']];
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

    /* 01 대명사는 화살표: 문장 → 대명사에서 가리키는 말로 화살표 → 한국어는 뺀다 → 영어는 두 가지를 고른다 */
    arrow(g, u) {
      const E = PN.ARROWS[S.s01 || 0];
      const spec = [];
      E.prs.forEach(([p, a], k) => { spec.push([a, 'ante', 'a' + k]); spec.push([p, 'pr', 'p' + k]); });
      const L = lay(g, phraseToks(E.s, spec, 'e'), { x: LX, y: 268, size: 33, maxW: 1110 });
      const col = u > 6.2;
      fade(g, ramp(u, 0.6, 0.6), () => {
        drawLay(g, L, tk => col ? {} : { r: '' });
        sayLay(L, E.s);
        E.prs.forEach(([p, a, d], k) => {
          const P = byTag(L, 'p' + k), A = byTag(L, 'a' + k), at = 6.8 + k * 2.4;
          point(g, P, A, k ? 112 : 44, COL.ante, ramp(u, at, 0.9));
          under(g, P, '대명사', COL.rel, ramp(u, at, 0.4), 44, 15);
          under(g, A, '가리키는 말', COL.ante, ramp(u, 12.6 + k * 0.4, 0.4), 44, 15);
        });
      });
      topNote(g, '화살표 끝 = 가리키는 말', ramp(u, 13, 0.6), COL.ante);
      // 한국어는 뺀다
      fade(g, ramp(u, 18.2, 0.6), () => {
        panel(g, LX, 352, 1120, 104, { fill: COL.panel, stroke: COL.faint });
        label(g, '한국어', LX + 24, 378, { size: 16, color: COL.soft });
        let x = LX + 24;
        E.ko.forEach(part => {
          if (Array.isArray(part)) {
            const w = txt(g, `(${part[0]})`, x, 422, { size: 26, weight: 600, color: COL.dim });
            fade(g, ramp(u, 20.4, 0.5), () => { g.strokeStyle = COL.trap; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x - 2, 424); g.lineTo(x + w + 2, 424); g.stroke(); });
            x += w;
          } else x += txt(g, part, x, 422, { size: 26, weight: 600 });
        });
        fade(g, ramp(u, 21, 0.5), () => txt(g, '→ 빼도 통해요', LX + 1096, 378, { size: 16, weight: 700, color: COL.trap, align: 'right' }));
      });
      // 영어는 두 가지를 고른다
      fade(g, ramp(u, 24.4, 0.5), () => label(g, '영어는 꼭 써요', LX, 524, { size: 17, color: COL.soft }));
      let x = LX + 140;
      E.prs.forEach(([p, , d], k) => fade(g, ramp(u, 25 + k * 0.8, 0.5), () => {
        const c = note(g, `${p} → ${d}`, x, 524, COL.rel, { size: 17 });
        say(c.x, c.y, c.w, c.h, p);
        x = c.x + c.w + 14;
      }));
      fade(g, ramp(u, 27, 0.5), () => note(g, '누구 → 줄 · 자리 → 칸', W - 80, 524, COL.accent, { align: 'right', size: 17 }));
    },

    /* 02 줄: 대명사 표의 줄 → 가리키는 말이 줄을 켬 (회사 하나 → it · 직원들 → they) */
    rows(g, u) {
      const GX = LX, GY = 150, user = S.a02 != null ? PN.ROWS02[S.a02] : null;
      // 영상 흐름: 6.4~ I · we · you · he · she → 12.4 it → 14.6 they → 18.4 회사(it) → 24.2 없음 → 29.2 직원들(they)
      const KEYS = [[6.4, 'I'], [7.6, 'we'], [8.8, 'you'], [9.8, 'he'], [10.8, 'she'], [12.4, 'it'], [14.6, 'they'], [16.8, null], [18.4, 'it'], [24.2, null], [29.2, 'they']];
      let lit = null, litA = 0;
      if (user) { lit = user.row; litA = 1; }
      else KEYS.forEach(([t, r]) => { if (u >= t) { lit = r; litA = ramp(u, t, 0.35); } });
      const geo = grid(g, { x: GX, y: GY, rowA: ri => ramp(u, 0.6 + ri * 0.22, 0.4), colA: ci => ramp(u, 0.5 + ci * 0.12, 0.4), dimCols: ['obj', 'poss', 'pron', 'refl'], rowLit: lit, rowLitA: litA });
      topNote(g, '① 줄 = 누구를 가리키나', ramp(u, 15.6, 0.6), COL.ante);
      // 오른쪽: 가리키는 말 → 줄
      const sideOf = E => {
        const R = geo.row(E.row), y = R.y + R.h / 2;
        const c = note(g, E.a, W - 80, y, COL.ante, { align: 'right', size: 17, h: 36 });
        txt(g, E.ko, c.x + c.w / 2, y + 30, { size: 15, weight: 700, color: COL.soft, align: 'center' });
        arrow(g, c.x - 8, y, geo.x + geo.w + 14, y, COL.ante, 2.5);
        say(c.x, c.y, c.w, c.h, E.a);
      };
      const sent = (E, a) => fade(g, a, () => {
        const Ls = lay(g, phraseToks(E.s, [[E.a.replace(/^the /, ''), 'ante', 'a'], [E.p, 'pr', 'p']], 's' + E.row), { x: LX, y: 556, size: 27 });
        drawLay(g, Ls); sayLay(Ls, E.s);
        point(g, byTag(Ls, 'p'), byTag(Ls, 'a'), 14, COL.ante, 1);
      });
      if (user) { sideOf(user); sent(user, 1); return; }
      const E1 = PN.ROWS02[0], E2 = PN.ROWS02[1];
      fade(g, ramp(u, 18.6, 0.5) * (1 - ramp(u, 23.8, 0.4)), () => sideOf(E1));
      sent(E1, ramp(u, 19.4, 0.5) * (1 - ramp(u, 23.8, 0.4)));
      fade(g, ramp(u, 24.4, 0.5) * (1 - ramp(u, 28.8, 0.4)), () => {
        label(g, '한국어', LX, 556, { size: 16, color: COL.soft });
        note(g, '직원 = 직원들 (하나든 여럿이든)', LX + 70, 556, COL.trap, { size: 17 });
        label(g, '영어', 640, 556, { size: 16, color: COL.soft });
        note(g, 'it = 하나 · they = 여럿', 690, 556, COL.ante, { size: 17 });
      });
      fade(g, ramp(u, 29.4, 0.5), () => sideOf(E2));
      sent(E2, ramp(u, 30, 0.5));
    },

    /* 03 칸: 한국어 조사 ↔ 영어 모양 → 자리마다 칸 → 예문 */
    cols(g, u) {
      const row = S.r03 || 'they', K = PN.COLS03[row], cs4 = ['subj', 'obj', 'poss', 'pron'];
      const SLOTS = [['동사 앞 (주어)', 12.4], ['동사 · 전치사 뒤 (목적어)', 14.6], ['명사 앞 → ___ + 명사', 18.4], ['홀로 (누구의 것)', 24.4]];
      const base = K.ko[0].slice(0, 2);
      cs4.forEach((cs, i) => {
        const x = LX + i * 285, w = 265, cx = x + w / 2, on = u >= SLOTS[i][1];
        fade(g, ramp(u, 0.6 + i * 0.3, 0.5), () => {
          panel(g, x, 146, w, 262, { fill: COL.panel, stroke: on ? COL.verb : COL.faint, lw: on ? 2.4 : 1.5 });
          txt(g, PN.CASE[cs].name, cx, 176, { size: 22, weight: 700, fam: FD, color: COL.accent, align: 'center' });
          const word = PN.cell(row, cs) || '—';
          txt(g, word, cx, 320, { size: 42, weight: 700, color: word === '—' ? COL.dim : COL.rel, align: 'center' });
          if (word !== '—') say(cx - 90, 296, 180, 48, word);
        });
        fade(g, ramp(u, 6.4 + i * 0.4, 0.5), () => {
          const k = K.ko[i];
          if (k.startsWith(base)) pieces(g, [[base, COL.soft], [k.slice(2), COL.trap]], cx, 230, 26, { align: 'center' });
          else txt(g, k, cx, 230, { size: 22, weight: 600, color: COL.dim, align: 'center' });
          arrow(g, cx, 252, cx, 284, COL.line, 2);
        });
        fade(g, ramp(u, SLOTS[i][1], 0.5), () => note(g, SLOTS[i][0], cx, 376, COL.verb, { align: 'center', size: 15, h: 32, pad: 10 }));
      });
      fade(g, ramp(u, 9.4, 0.5), () => {
        const w = pieces(g, [['한국어 → 조사(', COL.soft], ['은 · 을 · 의', COL.trap], [')를 바꿔요   ', COL.soft], ['영어 → 낱말 모양이 바뀌어요', COL.rel]], LX, 446, 19);
        return w;
      });
      // 예문: 대명사마다 칸 이름
      K.ex.forEach(([s, ms], k) => fade(g, ramp(u, 29.2 + k * 1.2, 0.5), () => {
        const Lx = lay(g, phraseToks(s, ms.map(([w, cs]) => [w, 'pr', cs])), { x: LX, y: 508 + k * 54, size: 27 });
        drawLay(g, Lx); sayLay(Lx, s);
        Lx.items.filter(t => t.r === 'pr').forEach(t => under(g, t, PN.CASE[t.tag].name, COL.verb, 1, -29, 14));
        if (row === 'it' && k === 1) txt(g, '(it 줄에는 소유대명사가 없어요)', Lx.x + Lx.w + 20, Lx.y, { size: 17, weight: 600, color: COL.dim });
      }));
    },

    /* 04 홀로 서는 theirs: 뒤에 명사가 있나 → 소유대명사 = 소유격 + 명사 → it 줄에는 없음 · its와 it’s → own */
    alone(g, u) {
      topNote(g, '기준 = 뒤에 명사가 있나?', ramp(u, 1, 0.6) * (1 - ramp(u, 17.6, 0.5)));
      const out1 = 1 - ramp(u, 17.6, 0.5);
      fade(g, out1, () => {
        const A = lay(g, phraseToks('This is their office.', [['their', 'pr', 'p'], ['office', 'cue', 'n']], 'a'), { x: LX, y: 216, size: 34 });
        fade(g, ramp(u, 6.2, 0.5), () => {
          drawLay(g, A, tk => tk.tag === 'n' && u > 7.2 ? { cue: true } : {}); sayLay(A, 'This is their office.');
          under(g, byTag(A, 'p'), '소유격', COL.rel, ramp(u, 7.4, 0.4), 44, 15); under(g, byTag(A, 'n'), '명사 있음', COL.verb, ramp(u, 7.4, 0.4), 44, 15);
          fade(g, ramp(u, 7.8, 0.5), () => mark(g, true, A.x + A.w + 28, 216, 16));
        });
        const B = lay(g, phraseToks('This office is theirs.', [['theirs', 'pr', 'p']], 'b'), { x: 660, y: 216, size: 34 });
        fade(g, ramp(u, 9.2, 0.5), () => {
          drawLay(g, B); sayLay(B, 'This office is theirs.');
          const p = byTag(B, 'p');
          under(g, p, '소유대명사', COL.rel, ramp(u, 10.2, 0.4), 44, 15);
          fade(g, ramp(u, 10.4, 0.5), () => { rr(g, p.x + p.w + 14, 216 - 20, 70, 40, 8); g.setLineDash([5, 5]); g.strokeStyle = COL.dim; g.lineWidth = 2; g.stroke(); g.setLineDash([]); txt(g, '명사 없음', p.x + p.w + 49, 216 + 44, { size: 15, weight: 700, color: COL.dim, align: 'center' }); });
        });
        // theirs = their + office
        fade(g, ramp(u, 12.2, 0.5), () => {
          const L0 = lay(g, [{ id: 'p', t: 'their', r: 'pr' }, { id: 'n', t: 'office', r: 'cue' }], { x: LX, y: 336, size: 34 });
          const L1 = lay(g, [{ id: 'p', t: 'theirs', r: 'pr' }], { x: LX, y: 336, size: 34 });
          const mp = ramp(u, 13, 1.1);
          morph(g, L0, L1, mp);
          const xEq = LX + L1.w + 30;
          fade(g, ramp(u, 14.1, 0.5), () => { pieces(g, [['= ', COL.soft], ['their ', COL.rel], ['+ 명사', COL.verb]], xEq, 336, 26); txt(g, '소유격 + 명사를 한 낱말로', xEq, 380, { size: 17, weight: 600, color: COL.muted }); });
          say(LX - 6, 314, 190, 44, 'theirs');
        });
        fade(g, ramp(u, 14.6, 0.4), () => label(g, '소유대명사', LX, 470, { size: 17, color: COL.soft }));
        chipRow(g, ['mine', 'yours', 'his', 'hers', 'ours', 'theirs'], LX + 110, 470, u, 15, { color: COL.rel, size: 19, h: 40, step: 0.25, say: true });
        fade(g, ramp(u, 16.2, 0.5), () => txt(g, '= my · your · his · her · our · their + 명사', LX, 530, { size: 18, weight: 600, color: COL.muted }));
      });
      // it 줄 · its와 it’s
      const a2 = ramp(u, 18.2, 0.6);
      fade(g, a2, () => {
        const geo = grid(g, { x: LX + 10, y: 150, rows: ['it'], lw: 170, rh: 50, cellLit: ['it', 'pron'], cellA: 0, rowLit: 'it', rowLitA: 0.6 });
        const C = geo.cell('it', 'pron');
        rr(g, C.x + 8, C.y + 6, C.w - 16, C.h - 12, 8); g.strokeStyle = COL.trap; g.lineWidth = 2.2; g.setLineDash([5, 5]); g.stroke(); g.setLineDash([]);
        txt(g, 'it 줄에는 소유대명사가 없어요', geo.x + geo.w + 26, 150 + 38 + 25, { size: 17, weight: 700, color: COL.trap });
      });
      const rowsB = [
        { s: 'Hanbit Electronics changed its logo.', p: 'its', y: 314, at: 20.2, ok: true, n: '그것의' },
        { s: 'It’s a new logo.', p: 'It’s', y: 384, at: 21.4, ok: true, n: '= It is' },
        { s: 'Hanbit Electronics changed it’s logo.', p: 'it’s', y: 454, at: 22.6, ok: false, n: '= it is logo ?' },
      ];
      rowsB.forEach((r, k) => fade(g, ramp(u, r.at, 0.5), () => {
        const Lb = lay(g, phraseToks(r.s, [[r.p, r.ok ? 'pr' : 'trap', 'p']], 'r' + k), { x: LX + 40, y: r.y, size: 30 });
        drawLay(g, Lb, tk => !r.ok && tk.tag === 'p' ? { strike: ramp(u, r.at + 0.8, 0.5) } : {}); sayLay(Lb, r.s);
        mark(g, r.ok, LX + 12, r.y, 16);
        txt(g, r.n, Lb.x + Lb.w + 22, r.y, { size: 18, weight: 700, color: r.ok ? COL.rel : COL.trap });
      }));
      fade(g, ramp(u, 24.4, 0.4), () => label(g, '소유격 + own', LX, 530, { size: 17, color: COL.soft }));
      chipRow(g, ['their own office', 'its own website', 'on her own = 혼자서'], LX + 130, 530, u, 24.8, { color: COL.rel, size: 18, h: 38, step: 0.5 });
    },

    /* 05 거울 대명사: 같은 사람 → -self · 다른 사람 → her → 한국어 ‘자기’ → 강조 · by oneself → 주어 자리에는 못 옴 */
    self(g, u) {
      const pick = S.self05, out1 = pick ? 1 : 1 - ramp(u, 17.6, 0.5);
      fade(g, out1, () => {
        const showA = !pick || pick === 'same', showB = !pick || pick === 'other';
        const yA = pick ? 260 : 226, yB = pick ? 260 : 336;
        if (showA) fade(g, pick ? 1 : ramp(u, 0.4, 0.6), () => {
          const s = 'Ms. Novak introduced herself to the staff.';
          const L = lay(g, phraseToks(s, [['Ms. Novak', 'ante', 'a'], ['herself', 'pr', 'p']], 'sa'), { x: LX, y: yA, size: 33 });
          drawLay(g, L); sayLay(L, s);
          const p = byTag(L, 'p'), a = byTag(L, 'a');
          point(g, p, a, 34, COL.clause, pick ? 1 : ramp(u, 1.6, 0.9));
          under(g, a, '주어', COL.ante, pick ? 1 : ramp(u, 2.2, 0.4), 44, 15); under(g, p, '목적어 = 주어 자신', COL.clause, pick ? 1 : ramp(u, 2.4, 0.4), 44, 15);
          fade(g, pick ? 1 : ramp(u, 3.6, 0.5), () => note(g, '같은 사람 → -self', W - 80, yA, COL.clause, { align: 'right' }));
        });
        if (showB) fade(g, pick ? 1 : ramp(u, 6.2, 0.6), () => {
          const s = 'Ms. Novak introduced her to the staff.';
          const L = lay(g, phraseToks(s, [['Ms. Novak', '', 'a'], ['her', 'pr', 'p']], 'sb'), { x: LX, y: yB, size: 33 });
          drawLay(g, L); sayLay(L, s);
          const p = byTag(L, 'p');
          const c = note(g, '다른 여자 (예: Ms. Lee)', W - 80, yB, COL.gap, { align: 'right', dash: true });
          arc(g, p.x + p.w / 2, p.y - 26, c.x + c.w / 2, c.y - 2, 30, COL.gap, pick ? 1 : ramp(u, 7.2, 0.9), { dash: true });
          under(g, p, '≠ Ms. Novak', COL.gap, pick ? 1 : ramp(u, 8.2, 0.4), 44, 15);
        });
        if (!pick) fade(g, ramp(u, 12.2, 0.6), () => {
          panel(g, LX, 412, 1120, 150, { fill: COL.panel, stroke: COL.faint });
          label(g, '한국어 ‘자기’ 하나 → 영어 둘', LX + 24, 440, { size: 16, color: COL.soft });
          [['자기를 소개했다', 'herself', '재귀대명사', 482, 12.8], ['자기 팀을 소개했다', 'her team', '소유격 + 명사', 532, 14.4]].forEach(([ko, en, nm, y, at]) => fade(g, ramp(u, at, 0.5), () => {
            const w = pieces(g, [['자기', COL.trap], [ko.slice(2), COL.text]], LX + 24, y, 25);
            arrow(g, LX + 40 + w, y, LX + 92 + w, y, COL.line, 2);
            const ww = pieces(g, [[en, COL.rel, true]], LX + 108 + w, y, 25);
            say(LX + 102 + w, y - 18, ww + 12, 36, en);
            txt(g, nm, LX + 126 + w + ww, y, { size: 16, weight: 700, color: COL.muted });
          }));
        });
      });
      if (pick) return;
      // 강조 · 혼자서 · 주어 자리
      const a2 = ramp(u, 18.2, 0.6);
      fade(g, a2, () => {
        const s = 'Ms. Lopez will hand out the awards herself.';
        const L = lay(g, phraseToks(s, [['Ms. Lopez', 'ante', 'a'], ['herself', 'pr', 'p']], 'sc'), { x: LX, y: 214, size: 32 });
        drawLay(g, L); sayLay(L, s);
        point(g, byTag(L, 'p'), byTag(L, 'a'), 26, COL.clause, ramp(u, 19, 0.9));
        fade(g, ramp(u, 20, 0.5), () => note(g, '강조 = 직접', W - 80, 214, COL.clause, { align: 'right' }));
      });
      fade(g, ramp(u, 24.2, 0.6), () => {
        const s = 'Mr. Tanaka built the website by himself.';
        const L = lay(g, phraseToks(s, [['Mr. Tanaka', 'ante', 'a'], ['by', 'pair', 'b'], ['himself', 'pr', 'p']], 'sd'), { x: LX, y: 324, size: 32 });
        drawLay(g, L); sayLay(L, s);
        boxSpan(g, byTag(L, 'b'), byTag(L, 'p'), COL.clause, true);
        point(g, byTag(L, 'p'), byTag(L, 'a'), 26, COL.clause, ramp(u, 24.8, 0.9));
        fade(g, ramp(u, 25.4, 0.5), () => note(g, 'by himself = on his own = 혼자서', W - 80, 324, COL.clause, { align: 'right' }));
      });
      fade(g, ramp(u, 29.2, 0.6), () => {
        const s0 = 'Mr. Okafor and myself will lead the session.', s1 = 'Mr. Okafor and I will lead the session.';
        const L0 = lay(g, keyed(phraseToks(s0, [['myself', 'bad', 'p'], ['will lead', 'cue', 'v']], 'se'), 'e'), { x: LX, y: 440, size: 32 });
        const L1 = lay(g, keyed(phraseToks(s1, [['I', 'pr', 'p'], ['will lead', 'cue', 'v']], 'se'), 'e'), { x: LX, y: 440, size: 32 });
        const mp = ramp(u, 31, 0.9);
        if (mp <= 0) drawLay(g, L0); else if (mp >= 1) drawLay(g, L1); else morph(g, L0, L1, mp);
        sayLay(mp >= 1 ? L1 : L0, mp >= 1 ? s1 : s0);
        const p = byTag(mp >= 0.5 ? L1 : L0, 'p');
        under(g, p, mp >= 0.5 ? '주어 → 주격' : '주어 자리에 -self ×', mp >= 0.5 ? COL.rel : COL.bad, ramp(u, 29.8, 0.4), 44, 15);
        fade(g, ramp(u, 30.2, 0.5), () => note(g, '-self는 주어가 못 돼요', W - 80, 440, COL.trap, { align: 'right' }));
      });
    },

    /* 06 둘이면 the other: 둘 → one · the other → 문장 → 셋 → one · another · the other → 엔진 판정 */
    other(g, u) {
      topNote(g, '정해지지 않은 하나 · 나머지', ramp(u, 1.6, 0.6), COL.clause);
      const sel = S.n06, A2 = sel ? (sel === 2 ? 1 : 0.28) : 1, A3 = sel ? (sel === 3 ? 1 : 0.28) : 1, all = !!sel;
      fade(g, A2 * (all ? 1 : ramp(u, 6.2, 0.5)), () => {
        label(g, '둘', 250, 172, { size: 17, color: COL.soft, align: 'center' });
        things(g, 250, 248, 2, 180, [['one', COL.clause], ['the other', COL.rel]], u, 6.4, { all, s: 76, lsize: 21, labA: k => all ? 1 : ramp(u, k ? 9.2 : 7.4, 0.4) });
        fade(g, all ? 1 : ramp(u, 10.4, 0.5), () => txt(g, '남은 게 하나뿐 → the', 250, 348, { size: 16, weight: 700, color: COL.muted, align: 'center' }));
      });
      fade(g, A3 * (all ? 1 : ramp(u, 18.2, 0.5)), () => {
        label(g, '셋', 900, 172, { size: 17, color: COL.soft, align: 'center' });
        things(g, 900, 248, 3, 160, [['one', COL.clause], ['another', COL.rel], ['the other', COL.rel]], u, 18.4, { all, s: 76, lsize: 21, labA: k => all ? 1 : ramp(u, [18.8, 20.2, 21.6][k], 0.4) });
        fade(g, all ? 1 : ramp(u, 22.4, 0.5), () => txt(g, 'another = an + other (또 하나)', 900, 348, { size: 16, weight: 700, color: COL.muted, align: 'center' }));
      });
      // 문장
      const s2 = 'We have two offices. One is in Seoul, and the other is in Busan.', s3 = 'We have three offices. One is in Seoul, another is in Busan, and the other is in Daegu.';
      const s = sel === 3 ? s3 : s2;
      fade(g, all ? 1 : ramp(u, 12.2, 0.6), () => {
        const T = phraseToks(s, [[sel === 3 ? 'three offices' : 'two offices', 'ante', 'a'], ['One', 'pair', 'one'], ['another', 'pr', 'an'], ['the other', 'pr', 'p']], 'o');
        let L, size = 28;
        do { L = lay(g, T, { x: LX, y: 410, size, maxW: 1120 }); size -= 1; } while (L.lines > 1 && size > 20);
        drawLay(g, L); sayLay(L, s);
        const p = byTag(L, 'p'), one = byTag(L, 'one');
        arc(g, p.x + p.w / 2, p.y - 24, one.x + one.w / 2, one.y - 24, 24, COL.clause, all ? 1 : ramp(u, 13.4, 0.9));
        under(g, p, '남은 하나', COL.rel, all ? 1 : ramp(u, 14, 0.4), 40, 15);
      });
      fade(g, ramp(u, 24.2, 0.5) * (all ? 0 : 1), () => {
        note(g, 'another → 아직 더 남은 ‘또 하나’', LX, 492, COL.rel, { size: 17 });
        note(g, 'the other → 남은 ‘마지막 하나’', 640, 492, COL.rel, { size: 17 });
      });
      // 둘뿐인데 another? (규칙 엔진 판정)
      const it = PN.DRILL[8], c = PN.ctxOf(it);
      fade(g, all ? 0 : 1, () => {
        fade(g, ramp(u, 29.2, 0.4), () => label(g, '둘뿐일 때 one 다음은', LX, 552, { size: 17, color: COL.soft }));
        tryList(g, [['the other', PN.judge('the other', c)], ['another', PN.judge('another', c)]], LX + 210, 552, u, 29.6, { horiz: true, size: 24, step: 1.2 });
      });
    },

    /* 07 others와 the others: 정해진 무리의 나머지 전부 → 정해지지 않은 다른 몇몇 → other + 명사 · another + 단수 → 서로 */
    others(g, u) {
      topNote(g, 'the = 정해진 나머지', ramp(u, 1.4, 0.6), COL.rel);
      // 정해진 무리: 의자 여섯 개
      fade(g, ramp(u, 0.6, 0.6), () => {
        panel(g, LX, 146, 540, 184, { fill: 'rgba(24,32,42,0.6)', stroke: COL.ante, dash: true });
        txt(g, 'the six chairs', LX + 18, 172, { size: 17, weight: 700, color: COL.ante });
        for (let k = 0; k < 6; k++) {
          const x = LX + 60 + k * 84, y = 218, broken = k < 2 && u > 6.4, rest = k >= 2 && u > 8.2;
          g.beginPath(); g.arc(x, y, 24, 0, Math.PI * 2); g.fillStyle = COL.panel2; g.fill();
          g.strokeStyle = broken ? COL.bad : rest ? COL.rel : COL.line; g.lineWidth = broken || rest ? 2.6 : 1.6; g.stroke();
          if (broken) cross(g, x, y, 14, COL.bad);
        }
        fade(g, ramp(u, 6.6, 0.4), () => txt(g, 'two (고장)', LX + 102, 264, { size: 16, weight: 700, color: COL.bad, align: 'center' }));
        fade(g, ramp(u, 8.4, 0.5), () => {
          g.strokeStyle = COL.rel; g.lineWidth = 2.2; g.beginPath(); g.moveTo(LX + 204, 256); g.lineTo(LX + 204, 264); g.lineTo(LX + 516, 264); g.lineTo(LX + 516, 256); g.stroke();
          txt(g, 'the others = 나머지 전부', LX + 360, 294, { size: 17, weight: 700, color: COL.rel, align: 'center' });
        });
      });
      // 열린 무리: some guests · others
      fade(g, ramp(u, 12.2, 0.6), () => {
        txt(g, 'Some guests', 760, 172, { size: 17, weight: 700, color: COL.clause, align: 'center' });
        [[720, 212], [770, 242], [810, 204]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = COL.clause; g.lineWidth = 2.4; g.stroke(); });
        fade(g, ramp(u, 13.4, 0.5), () => {
          [[960, 200], [1020, 238], [1080, 206], [1130, 250]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fillStyle = COL.panel2; g.fill(); g.setLineDash([5, 4]); g.strokeStyle = COL.rel; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]); });
          txt(g, 'others = 정해지지 않은 다른 몇몇', 1040, 294, { size: 17, weight: 700, color: COL.rel, align: 'center' });
        });
      });
      const sents = [
        { s: 'Of the six chairs, two are broken, but the others are fine.', sp: [['six chairs', 'ante', 'a'], ['two', 'pair', 'b'], ['the others', 'pr', 'p']], y: 386, at: 6.2 },
        { s: 'Some guests stayed inside, and others went to the garden.', sp: [['Some guests', 'pair', 'b'], ['others', 'pr', 'p']], y: 444, at: 12.6 },
      ];
      sents.forEach((r, k) => fade(g, ramp(u, r.at, 0.6), () => {
        const L = lay(g, phraseToks(r.s, r.sp, 'w' + k), { x: LX, y: r.y, size: 28 });
        drawLay(g, L); sayLay(L, r.s);
      }));
      fade(g, ramp(u, 18.2, 0.5), () => {
        note(g, 'other + 복수 명사 → other hotels', LX, 504, COL.verb, { size: 17 });
        note(g, 'another + 단수 명사 → another date', 520, 504, COL.verb, { size: 17 });
        say(LX, 486, 420, 36, 'other hotels'); say(520, 486, 440, 36, 'another date');
      });
      fade(g, ramp(u, 24.4, 0.5), () => {
        const w = pieces(g, [['their', COL.rel], [' + 명사 · ', COL.muted], ['theirs', COL.rel], [' 홀로', COL.muted], ['   ↔   ', COL.dim], ['other', COL.rel], [' + 명사 · ', COL.muted], ['others', COL.rel], [' 홀로', COL.muted]], LX, 556, 20);
        fade(g, ramp(u, 26.4, 0.5), () => note(g, '서로 = each other', W - 80, 556, COL.clause, { align: 'right', size: 17 }));
        return w;
      });
    },

    /* 08 되풀이 대신 that · those: the price → that → sales → those → it · them은 안 됨 → those who */
    that(g, u) {
      const E = PN.CMP[S.c08 == null ? 0 : S.c08], user = S.c08 != null;
      const full = PN.cmpFull(E);
      const spec = [[E.head, 'ante', 'a'], [E.rep, 'trap', 'w'], [E.w, 'pr', 'w'], [E.post, 'pair', 'po']];
      const L0 = lay(g, keyed(phraseToks(full, spec, 'f'), 'f'), { x: LX, y: 232, size: 30, maxW: 1120 });
      const L1 = lay(g, keyed(phraseToks(E.s, spec, 'f'), 'f'), { x: LX, y: 232, size: 30, maxW: 1120 });
      const mp = user ? 1 : ramp(u, 6.4, 1.1);
      fade(g, ramp(u, 0.6, 0.6), () => {
        const st = tk => tk.tag === 'w' && tk.r === 'trap' ? { strike: ramp(u, 3.4, 0.6) } : {};
        if (mp <= 0) drawLay(g, L0, st); else if (mp >= 1) drawLay(g, L1, st); else morph(g, L0, L1, mp, { style: st });
        sayLay(mp >= 1 ? L1 : L0, mp >= 1 ? E.s : full);
        if (mp >= 1) {
          const w = byTag(L1, 'w'), a = byTag(L1, 'a');
          point(g, w, a, 34, COL.ante, user ? 1 : ramp(u, 7.8, 0.9));
          under(g, w, `= ${E.rep} (${E.w === 'that' ? '하나' : '여럿'})`, COL.rel, user ? 1 : ramp(u, 8.4, 0.4), 44, 15);
        } else fade(g, ramp(u, 2.8, 0.4), () => under(g, byTag(L0, 'w'), '같은 말 두 번', COL.trap, 1, 44, 15));
      });
      if (!user) fade(g, ramp(u, 12.2, 0.6), () => {
        const s = 'This year’s sales are higher than those of last year.';
        const L = lay(g, phraseToks(s, [['sales', 'ante', 'a'], ['those', 'pr', 'w'], ['of last year', 'pair', 'po']], 'g'), { x: LX, y: 344, size: 30 });
        drawLay(g, L); sayLay(L, s);
        const w = byTag(L, 'w'), a = byTag(L, 'a');
        point(g, w, a, 30, COL.ante, ramp(u, 13, 0.9));
        under(g, w, '= the sales (여럿)', COL.rel, ramp(u, 13.6, 0.4), 44, 15);
      });
      // 엔진: 뒤에 of가 붙으면 it · them은 안 됨
      const c14 = PN.ctxOf(PN.DRILL[13]);
      fade(g, ramp(u, 18.2, 0.4), () => label(g, '뒤에 of last year', LX, 440, { size: 17, color: COL.soft }));
      tryList(g, [['those', PN.judge('those', c14)], ['them', PN.judge('them', c14)], ['it', PN.judge('it', c14)], ['that', PN.judge('that', c14)]], LX + 190, 440, u, 18.8, { horiz: true, size: 24, step: 0.9 });
      fade(g, ramp(u, 24.4, 0.6), () => {
        const s = 'Those who register early will get a discount.';
        const L = lay(g, phraseToks(s, [['Those', 'pr', 'w'], ['who register early', 'pair', 'c']], 'h'), { x: LX, y: 528, size: 30 });
        drawLay(g, L); sayLay(L, s);
        bracket(g, byTag(L, 'c'), byTag(L, 'c'), COL.clause, ramp(u, 25.2, 0.8), 26);
        under(g, byTag(L, 'w'), '~하는 사람들', COL.rel, ramp(u, 25.6, 0.4), -46, 15);
        fade(g, ramp(u, 27.6, 0.5), () => note(g, 'They who ×  →  Those who', W - 80, 528, COL.trap, { align: 'right' }));
      });
    },

    /* 09 3단계 풀이법 흐름도 (판정기로 길이 켜짐) */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 화살표', sub: '가리키는 말 찾기', at: 5.6, boxes: [
          ['사람 하나', '→ he · she 줄', COL.ante], ['사물 · 회사 하나', '→ it 줄', COL.ante],
          ['여럿 (사람 · 사물)', '→ they 줄', COL.ante], ['나 · 우리 · 듣는 사람', '→ I · we · you 줄', COL.ante]] },
        { x: 480, head: '② 자리', sub: '빈칸 앞뒤 보기', at: 11.6, boxes: [
          ['동사 앞 (주어)', '→ 주격', COL.verb], ['동사 · 전치사 뒤 (목적어)', '→ 목적격', COL.verb],
          ['명사 앞', '→ 소유격', COL.verb], ['홀로 (누구의 것)', '→ 소유대명사', COL.verb]] },
        { x: 880, head: '③ 짝', sub: '같은 사람? 짝 표현?', at: 18.2, boxes: [
          ['주어와 같은 사람 · 강조', '→ -self', COL.clause], ['둘 가운데 남은 하나', '→ the other', COL.clause],
          ['나머지 전부 · 다른 몇몇', '→ the others · others', COL.clause], ['뒤에 of · who 꾸밈말', '→ that · those', COL.clause]] },
      ];
      const P = S.path && S.path.row && S.path.slot && S.path.same ? S.path : null;
      let on = [[], [], []], verdict = null;
      if (P) {
        const R = PN.decide(P.row, P.slot, P.same);
        on[0] = [{ he: 0, she: 0, it: 1, they: 2, I: 3, we: 3, you: 3 }[P.row]];
        on[1] = [{ subj: 0, obj: 1, det: 2, alone: 3 }[P.slot]];
        on[2] = R.ok && R.cs === 'refl' ? [0] : [];
        verdict = R.ok ? `${R.text} · ${R.why}` : R.why;
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
        let size = 18; while (tw(g, verdict, size, 700) > 1080 && size > 12) size--;
        note(g, verdict, W / 2, 552, COL.rel, { align: 'center', size, h: 42 });
      }
    },

    /* 10 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = PN.DRILL[P.k];
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0] + 0.6, s2 = v >= P.at[1] + 0.2, s3 = v >= P.at[2], win = v >= P.win;
        // 빈칸 자리는 처음부터 답의 너비로 잡아 둠 → 답을 채울 때 줄이 바뀌지 않음
        const minW = Math.max(...it.opts.map(o => tw(g, o, 31, 700) / 31 + 0.7));
        const T = drillToks(it, 'p' + pi).map(tk => tk.r === 'blank' ? Object.assign({}, tk, { t: it.opts[it.a], r: win ? 'ans' : 'blank', minW }) : tk);
        let L, size = 31;
        do { L = lay(g, T, { x: LX, y: 234, size, maxW: 1120, lh: 54 }); size -= 1; } while (L.lines > 1 && size >= 26);
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: v >= P.at[1] && !win ? 0.6 : 0, hide: true }
          : tk.tag === 'ante' ? (s1 ? { cue: true, cueColor: COL.ante } : { r: '' })
          : tk.tag === 'cue' ? (s2 ? { cue: true, color: COL.verb } : {})
          : tk.tag === 'pair' ? (s3 ? { cue: true, cueColor: COL.clause, color: COL.clause, cueDash: true } : {}) : {});
        sayLay(L, it.q.replace('___', it.opts[it.a]));
        const ow = byTag(L, 'ante'), bk = blankOf(L);
        if (ow) { under(g, ow, '가리키는 말', COL.ante, ramp(v, P.at[0] + 0.8, 0.4), -46, 15); fade(g, ramp(v, P.at[0] + 1, 0.4), () => point(g, bk, ow, 18, COL.ante, ramp(v, P.at[0] + 1, 0.8))); }
        const oy = L.lines > 1 ? 352 : 318;
        it.opts.forEach((o, k) => {
          const ox = LX + (k % 2) * 290, y = oy + Math.floor(k / 2) * 92, j = PN.judgeOpt(it, k);
          const at = j.step ? P.x[j.step - 1] : 1e9;
          const right = k === it.a, gone = !right && v >= at, wn = right && win;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, o, ox + 52, y, { size: 27, weight: wn ? 700 : 600, color: wn ? COL.good : gone ? COL.dim : COL.text });
          say(ox + 46, y - 18, w + 12, 36, o);
          fade(g, ramp(v, P.at[0] + 1.2, 0.5), () => txt(g, PN.kindName(o), ox + 52, y + 30, { size: 14, weight: 600, color: gone ? COL.dim : COL.muted }));
          if (gone) {
            const gp = clamp((v - at) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, y + 1); g.lineTo(ox - 4 + (w + 62) * gp, y + 1); g.stroke();
          }
          if (wn) { panel(g, ox - 14, y - 26, w + 84, 70, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + w + 92, y, 18); }
        });
        panel(g, 660, oy - 40, 560, 236, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = oy - 2 + k * 72;
          txt(g, ['① 화살표', '② 자리', '③ 짝'][k], 684, y, { size: 18, weight: 700, color: COL.accent });
          let fs = 18; while (tw(g, ln, fs, 600) > 512 && fs > 14) fs--;
          txt(g, ln, 684, y + 30, { size: fs, weight: 600, color: k === 2 && win ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 470, 740], Y0 = 152, RH = 40;
      const rows = [
        ['회사 · 사물 하나 / 여럿', 'it · its / they · their', 'Hanbit Electronics moved its office.', COL.ante],
        ['동사 앞 / 동사 · 전치사 뒤', '주격 / 목적격', 'Please send us your comments.', COL.verb],
        ['명사 앞 / 홀로', '소유격 / 소유대명사', 'their office · The office is theirs.', COL.verb],
        ['주어와 같은 사람', '재귀대명사 -self', 'Ms. Novak introduced herself.', COL.clause],
        ['강조 · by + 혼자서', '-self', 'by himself · on his own', COL.clause],
        ['둘 가운데 남은 하나', 'the other', 'One is in Seoul, and the other …', COL.clause],
        ['나머지 전부 / 다른 몇몇', 'the others / others', 'Some guests …, and others …', COL.clause],
        ['되풀이 대신 (+ of · who)', 'that · those', 'those of last year · those who …', COL.clause],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 12, { fill: COL.panel, stroke: COL.faint });
        ['가리키는 말 · 자리 · 짝', '고르는 말', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 18, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 4, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.55, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 18;
        txt(g, r[0], X[0] + 20, y, { size: 18, weight: 600 });
        txt(g, r[1], X[1] + 20, y, { size: 18, weight: 700, color: r[3] });
        txt(g, r[2], X[2] + 20, y, { size: 18, weight: 500, color: COL.en });
        say(X[2] + 14, y - 18, 460, 36, r[2].replace(/ …/g, '').replace(/,$/, ''));
      }));
      const steps = ['① 화살표 → 줄', '② 자리 → 칸', '③ 짝 확인'];
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

  // 놀이터(대명사 표 놀이터)의 작은 무대: 빈칸 문장 + 가리키는 화살표. 논리 크기 1000×230 (좁은 화면에서는 620×260)
  // o: { w: 논리 너비, reveal: 화살표와 자리 이름표를 보일지, word: 빈칸에 넣을 말, ok: 맞았는지 }
  PNS.STAGE = { w: 1000, h: 230, nh: 300 };
  PNS.stage = function (g, A, F, o = {}) {
    const SW = o.w || PNS.STAGE.w, narrow = SW < 800, SH = narrow ? PNS.STAGE.nh : PNS.STAGE.h, s = g.canvas.width / SW;
    g.setTransform(s, 0, 0, s, 0, 0); g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, SW, SH);
    g.fillStyle = COL.grid; for (let x = 20; x < SW; x += 40) for (let y = 20; y < SH; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const c = PN.pgCtx(A, F), q = PN.pgSentence(A, F);
    const T = phraseToks(q, [[c.ante, 'ante', 'a'], [c.cue || '', '', 'cue']], 'pg').map(tk => tk.r === 'blank' && o.word ? Object.assign({}, tk, { t: o.word, r: 'ans' }) : tk);
    // 넓은 무대는 한 줄, 좁은 무대는 두 줄까지 (줄이 많으면 화살표가 다른 줄의 글자를 가로지름)
    let size = narrow ? 30 : 28, L;
    do { L = lay(g, T, { x: 30, y: 0, size, maxW: SW - 60, lh: size * 2 }); size -= 1; } while (L.lines > (narrow ? 2 : 1) && size > 18);
    const top = narrow ? 96 : 92, H0 = L.lines === 1 ? (narrow ? 120 : 108) : top;
    L.items.forEach(it => { it.y += H0; }); L.y += H0;
    drawLay(g, L, tk => tk.r === 'ans' ? (o.ok === false ? { color: COL.bad } : {}) : tk.tag === 'cue' && o.reveal ? { cue: true, color: COL.verb } : tk.tag === 'a' && !o.reveal ? { r: '' } : {});
    const bk = blankOf(L), an = byTag(L, 'a');
    if (o.reveal && bk && an) {
      if (bk.line === an.line) point(g, bk, an, 22, COL.ante, 1);
      else {   // 다른 줄: 두 줄 사이의 틈으로 곧은 점선 화살표 (빈칸 위 → 가리키는 말 아래)
        g.save(); g.setLineDash([6, 5]); arrow(g, bk.x + bk.w / 2, bk.y - bk.size * 0.66, an.x + an.w / 2, an.y + an.size * 0.72, COL.ante, 2.4); g.restore();
      }
    }
    if (o.reveal) {
      const ls = narrow ? 21 : 17, t1 = `가리키는 말 → ${c.ante} (${c.row} 줄)`, t2 = `자리 → ${F.same ? '주어와 같은 사람 (재귀대명사 칸)' : PN.CASE[PN.want(c)].name + ' 칸'}`;
      if (narrow) { txt(g, t1, 30, SH - 58, { size: ls, weight: 700, color: COL.ante }); txt(g, t2, 30, SH - 24, { size: ls, weight: 700, color: COL.verb }); }
      else { txt(g, t1, 30, SH - 26, { size: ls, weight: 700, color: COL.ante }); txt(g, t2, SW - 30, SH - 26, { size: ls, weight: 700, color: COL.verb, align: 'right' }); }
    }
  };

  PNS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[PNS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, PNS.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  // 직접 해 보기로만 나오는 글자(다른 문장·줄·비교 문장·판정기)도 함께 넣음
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + PN.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔✓×?~=+-/:;…‘’—≠';
  PNS.baseText = EXTRA;
  PNS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = PNS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { PNS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
