/* 시제 튜토리얼 — 영상 장면
 *
 * TS.render(g, t)는 시각 t와 사용자 상태 TS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 핵심 그림은 시간선이에요: 왼쪽 과거 → 가운데 지금 → 오른쪽 미래.
 * 색: 시간 단서 보라 · 동사(답) 노랑 · 기준점 하늘 · 시간·조건 부사절 민트 · 빈칸 분홍 점선 · 함정 주황.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(VT.judge · VT.judgeAdv)으로 정합니다.
 */
(function () {
  'use strict';
  const VT = window.VT;
  const TS = (window.TS = {});
  const W = 1280, H = 720;
  TS.W = W; TS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  TS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', axis: 'rgba(238,241,244,0.62)', panel: '#18202A', panel2: '#202A36',
    // 역할 색: 단서 보라 · 동사(답) 노랑 · 기준점 하늘 · 부사절 민트 · 빈칸 분홍 · 함정 주황 · 지금 흰색
    cue: '#C9A7FF', ans: '#FFC15E', ref: '#6EC8FF', clause: '#7FE0A8', gap: '#FF7AA8', trap: '#FF9F7A', now: '#EEF1F4',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  TS.COL = COL;

  // 사용자 상태 ('직접 해 보기'와 화면 누르기로 바뀜). 영상 추출은 언제나 기본값
  const S = (TS.S = { base: null, still: null, clue: null, path: null });
  TS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  TS.hits = () => HITS;

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
    if (o.dash !== false) g.setLineDash([7, 6]);
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
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; g.stroke(); }
    txt(g, s, x0 + w / 2, y + 1, { size, weight: o.weight || 600, color: o.color || COL.text, align: 'center', fam: o.fam });
    return { x: x0, y: y - h / 2, w, h };
  }
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; g.stroke(); }
  }
  const say = (x, y, w, h, text) => HITS.push({ x, y, w, h, say: text });

  /* ---------- 영어 문장 토큰 배치와 그리기 ---------- */
  // 토큰 { id, t: 글자, r: 역할 }. 역할: cue 단서 · verb 동사(답) · ref 기준점 · main 다른 절의 동사 · trap 함정 · fn 기능어 · blank 빈칸 · ans 채운 답 · bad 틀림 · dim · '' 보통
  const RCOL = { cue: COL.cue, verb: COL.ans, ref: COL.ref, main: COL.ref, trap: COL.trap, fn: COL.muted, bad: COL.bad, good: COL.good, dim: COL.dim, clause: COL.clause };
  const STRONG = { cue: 1, verb: 1, ref: 1, main: 1, trap: 1 };
  const PUNCT = /^[.,?!]$/;
  const tokW = (g, tk, size) => tk.r === 'blank' ? Math.max(size * 2.6, tk.t ? tw(g, tk.t, size, 700) + size * 0.7 : 0) :
    tk.r === 'ans' ? tw(g, tk.t, size, 700) + size * 0.5 : tw(g, tk.t, size, STRONG[tk.r] ? 600 : 500);
  // 한 줄(또는 maxW를 넘으면 여러 줄)로 배치. o: { x, y, size, align: 'left' | 'center', maxW, lh }
  function lay(g, toks, o) {
    const size = o.size || 34, sp = size * 0.3, maxW = o.maxW || 1e9, lh = o.lh || size * 1.65;
    const lines = [[]]; let x = 0;
    toks.forEach(tk => {
      const punct = PUNCT.test(tk.t), w = punct ? tw(g, tk.t, size, 500) : tokW(g, tk, size);
      const line = lines[lines.length - 1];
      if (!punct && line.length && x + sp + w > maxW) { lines.push([]); x = 0; }
      const cur = lines[lines.length - 1];
      if (cur.length && !punct) x += sp;
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
  // 문자열 → 토큰 (띄어쓰기로 자르고 마침표·쉼표는 따로). roles: { '글자': 역할 }, ___는 빈칸
  function toks(s, roles = {}, pre = 't') {
    const out = [];
    s.split(' ').forEach(w => {
      const m = w.match(/^(.*?)([.,?!]?)$/);
      const keep = /^(Ms|Mr|Dr)\.$/.test(w);   // Ms. 같은 줄임말은 한 조각
      const word = keep ? w : m[1], tail = keep ? '' : m[2];
      if (word) out.push({ id: pre + out.length, t: word === '___' ? '' : word, r: word === '___' ? 'blank' : roles[word] || '' });
      if (tail) out.push({ id: pre + out.length, t: tail, r: '' });
    });
    return out;
  }
  const byText = (L, t) => L.items.find(i => i.t === t);
  const blankOf = L => L.items.find(i => i.r === 'blank' || i.r === 'ans');
  // 토큰 하나 그리기. o: { a: 투명도, r: 역할 바꾸기, color, cue: 단서 상자, box: 상자 색, glow: 빈칸 반짝임, plain: 밑줄 없이 }
  function drawTok(g, it, o = {}) {
    const r = o.r != null ? o.r : it.r, size = it.size, x = it.x, y = it.y, w = it.w;
    g.save(); g.globalAlpha *= o.a == null ? 1 : o.a;
    if (g.globalAlpha <= 0.002) { g.restore(); return; }
    if (r === 'blank') {
      const h = size * 1.12;
      rr(g, x, y - h / 2, w, h, 8);
      g.fillStyle = `rgba(255,122,168,${0.08 + 0.12 * (o.glow || 0)})`; g.fill();
      g.setLineDash([6, 5]); g.strokeStyle = o.color || COL.gap; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]);
      if (it.t) txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: o.textColor || COL.ans, align: 'center' });
    } else if (r === 'ans') {
      const h = size * 1.22;
      rr(g, x, y - h / 2, w, h, 9);
      g.fillStyle = 'rgba(255,193,94,0.16)'; g.fill(); g.strokeStyle = COL.ans; g.lineWidth = 2; g.stroke();
      txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: COL.ans, align: 'center' });
    } else {
      const c = o.color || RCOL[r] || COL.text;
      txt(g, it.t, x, y + 1, { size, weight: STRONG[r] ? 600 : 500, color: c });
      if (STRONG[r] && !o.plain) { g.fillStyle = c; g.fillRect(x, y + size * 0.56, w, 3); }
      if (r === 'bad') { g.strokeStyle = COL.bad; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x + w + 3, y + 2); g.stroke(); }
    }
    if (o.cue || o.box) { rr(g, x - 4, y - size * 0.68, w + 8, size * 1.36, 7); g.strokeStyle = o.box || COL.cue; g.lineWidth = 2.2; g.stroke(); }
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
  // 덩어리(여러 낱말)에 밑 괄호 + 이름표
  function under(g, L, fromT, toT, label, color, a = 1, dy = 30) {
    const A = byText(L, fromT), B = byText(L, toT);
    if (!A || !B) return;
    fade(g, a, () => {
      const y = A.y + dy, x0 = A.x, x1 = B.x + B.w;
      g.strokeStyle = color; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x0, y - 7); g.lineTo(x0, y); g.lineTo(x1, y); g.lineTo(x1, y - 7); g.stroke();
      txt(g, label, (x0 + x1) / 2, y + 20, { size: 16, weight: 700, color, align: 'center' });
    });
  }
  // 보기 하나를 빈칸에 넣어 보는 목록 (✓/×와 짧은 까닭)
  function tryList(g, items, x, y, u, at, o = {}) {
    items.forEach(([w, why], k) => {
      const a = ramp(u, at + k * (o.step || 0.9), 0.4), yy = y + k * (o.gap || 46);
      fade(g, a, () => {
        const ok = !why;
        mark(g, ok, x + 10, yy, 16);
        const ww = txt(g, w, x + 36, yy, { size: o.size || 25, weight: 600, color: ok ? COL.good : COL.muted });
        if (!ok) { g.strokeStyle = COL.bad; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 32, yy + 1); g.lineTo(x + 40 + ww, yy + 1); g.stroke(); }
        if (why || o.okWhy) txt(g, why || o.okWhy, x + 36 + ww + 22, yy, { size: 16, weight: 600, color: ok ? COL.good : COL.muted });
      });
    });
  }

  /* ---------- 시간선 ---------- */
  // 축: 왼쪽 과거 → 오른쪽 미래, now(비율) 자리에 '지금'. p: 그려진 정도. 돌려주는 값: 비율 → x 좌표
  function axis(g, x, y, w, o = {}) {
    const now = o.now == null ? 0.5 : o.now, p = o.p == null ? 1 : o.p, X = f => x + w * f, ls = o.ls || 16;
    fade(g, o.a == null ? 1 : o.a, () => {
      if (p > 0.001) {
        g.save(); g.strokeStyle = COL.axis; g.lineWidth = o.lw || 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * clamp(p), y); g.stroke(); g.restore();
      }
      if (p >= 0.99) arrowHead(g, x + w + 12, y, 0, COL.axis, 15);
      fade(g, ramp(p, 0.55, 0.45), () => {
        txt(g, '과거', x - 14, y, { size: ls, weight: 600, color: COL.muted, align: 'right' });
        txt(g, '미래', x + w + 22, y, { size: ls, weight: 600, color: COL.muted });
      });
      fade(g, ramp(p, 0.3, 0.4) * (o.nowA == null ? 1 : o.nowA), () => {
        const nx = X(now);
        g.fillStyle = COL.now; rr(g, nx - 2, y - 18, 4, 36, 2); g.fill();
        chip(g, '지금', nx, y + 36, { size: ls - 1, weight: 700, color: COL.bg, fill: COL.now, align: 'center', h: ls * 1.65, pad: 9 });
      });
    });
    return X;
  }
  function diamond(g, x, y, s, c) { g.fillStyle = c; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y); g.closePath(); g.fill(); }
  // 단서 핀: 선 위의 보라 마름모 + 위쪽 이름표
  function pin(g, x, y, label, o = {}) {
    const c = o.color || COL.cue, h = o.h || 54, size = o.size || 17;
    g.save(); g.strokeStyle = c; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x, y - h + size * 0.9); g.lineTo(x, y - 8); g.stroke(); g.restore();
    diamond(g, x, y, 7, c);
    if (label) chip(g, label, x, y - h, { size, weight: 700, color: c, fill: COL.panel2, stroke: c, align: 'center', h: size * 1.8, r: 8, pad: 10 });
  }
  // 일(동사)의 점: 노란 원 + 이름표 (dy < 0 이면 위에)
  function dot(g, x, y, label, o = {}) {
    const c = o.color || COL.ans;
    g.beginPath(); g.arc(x, y, o.r || 9, 0, Math.PI * 2); g.fillStyle = c; g.fill();
    g.strokeStyle = COL.bg; g.lineWidth = 2; g.stroke();
    if (label) txt(g, label, x, y + (o.dy || 34), { size: o.size || 19, weight: 700, color: c, align: 'center' });
  }
  // 구간 막대 (p: 그려진 정도)
  function bar(g, x0, x1, y, o = {}) {
    const c = o.color || COL.ans, p = o.p == null ? 1 : o.p, xe = lerp(x0, x1, clamp(p));
    if (p <= 0.001) return;
    g.save(); g.strokeStyle = c; g.lineWidth = o.lw || 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y); g.lineTo(xe, y); g.stroke(); g.restore();
    if (p > 0.95 && o.head !== false) arrowHead(g, xe + 12, y, 0, c, 17);
  }
  function band(g, x0, x1, y, c, a = 0.22) { g.save(); g.globalAlpha *= a; g.fillStyle = c; rr(g, x0, y - 14, x1 - x0, 28, 6); g.fill(); g.restore(); }
  // 기준점 깃발 (하늘)
  function flag(g, x, y, label, o = {}) {
    const c = o.color || COL.ref, h = o.h || 46, size = o.size || 16;
    g.strokeStyle = c; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x, y - h); g.stroke();
    g.fillStyle = c; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 20, y - h + 8); g.lineTo(x, y - h + 16); g.closePath(); g.fill();
    if (label) chip(g, label, x, y - h - size * 1.3, { size, weight: 700, color: c, fill: COL.panel2, stroke: c, align: 'center', h: size * 1.75, r: 8, pad: 9 });
  }
  /* 시간선 위에 장면 하나 (kind = 시간 이름 P PN N F FB PB, 또는 advF 부사절, that 요구·제안)
   * L: { clue, verb, ref, main }  p: 0→1 (단서 먼저, 동사는 나중)  o: { now, size, spread } */
  function scenario(g, X, y, kind, L, p = 1, o = {}) {
    const now = o.now == null ? 0.5 : o.now, ca = ramp(p, 0, 0.4), ea = ramp(p, 0.45, 0.45), size = o.size || 19, ps = o.ps || 17;
    const sp = o.spread || 1;
    switch (kind) {
      case 'P': case 'F': {
        const x = X(now + (kind === 'P' ? -0.28 : 0.28) * sp);
        fade(g, ca, () => pin(g, x, y, L.clue, { size: ps }));
        fade(g, ea, () => dot(g, x, y, L.verb, { size }));
        break;
      }
      case 'PN': {
        const x0 = X(now - 0.36 * sp), x1 = X(now);
        fade(g, ca, () => { band(g, x0, x1, y, COL.cue); pin(g, x0, y, L.clue, { size: ps }); });
        if (ea > 0) bar(g, x0, x1 - 14, y, { p: ea });
        fade(g, ea, () => txt(g, L.verb || '', (x0 + x1) / 2, y + 34, { size, weight: 700, color: COL.ans, align: 'center' }));
        break;
      }
      case 'N': {
        fade(g, ca, () => pin(g, X(now), y, L.clue, { size: ps, h: 54 }));
        fade(g, ea, () => {
          [-0.14, -0.07, 0.07, 0.14].forEach(d => dot(g, X(now + d * sp), y, '', { r: 7 }));
          txt(g, L.verb || '', X(now + 0.26 * sp), y + 34, { size, weight: 700, color: COL.ans, align: 'center' });
        });
        break;
      }
      case 'FB': {
        const xr = X(now + 0.38 * sp), xe = X(now + 0.24 * sp);
        fade(g, ca, () => flag(g, xr, y, L.ref, { size: ps - 1 }));
        if (ea > 0) bar(g, X(now) + 8, xe, y, { p: ea, head: false, lw: 6 });
        fade(g, ramp(p, 0.8, 0.2), () => {
          g.beginPath(); g.arc(xe, y, 13, 0, Math.PI * 2); g.fillStyle = COL.ans; g.fill();
          check(g, xe, y, 11, COL.bg);
          txt(g, L.verb || '', xe, y + 36, { size, weight: 700, color: COL.ans, align: 'center' });
          if (o.note !== false) txt(g, '기준점보다 먼저 끝남', (X(now) + xe) / 2, y - 26, { size: ps - 2, weight: 600, color: COL.soft, align: 'center' });
        });
        break;
      }
      case 'PB': {
        const xr = X(now - 0.2 * sp), xe = X(now - 0.4 * sp);
        fade(g, ca, () => flag(g, xr, y, L.ref, { size: ps - 1 }));
        fade(g, ea, () => {
          dot(g, xe, y, L.verb, { size });
          arc(g, xe + 12, y - 12, xr - 8, y - 14, 26, COL.soft, ramp(p, 0.6, 0.3), { lw: 2 });
          txt(g, '먼저', xe, y - 30, { size: ps - 2, weight: 700, color: COL.soft, align: 'center' });
        });
        break;
      }
      case 'advF': {
        const x1 = X(now + 0.2 * sp), x2 = X(now + 0.38 * sp);
        fade(g, ca, () => { pin(g, x1, y, L.clue, { size: ps, color: COL.clause }); dot(g, x2, y, L.main, { color: COL.ref, size: size - 2, dy: o.mainUp ? -30 : 34 }); });
        fade(g, ea, () => dot(g, x1, y, L.verb, { size }));
        break;
      }
      case 'that': {
        const cx = X(now + 0.12 * sp), bw = o.bw || 260;
        fade(g, ca, () => {
          rr(g, cx - bw / 2, y - 84, bw, 60, 12); g.fillStyle = 'rgba(255,193,94,0.08)'; g.fill();
          g.setLineDash([6, 5]); g.strokeStyle = COL.ans; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
          txt(g, L.clue || '해야 할 일 · 시간선 밖', cx, y - 66, { size: ps - 2, weight: 600, color: COL.soft, align: 'center' });
        });
        fade(g, ea, () => txt(g, L.verb || '', cx, y - 40, { size, weight: 700, color: COL.ans, align: 'center' }));
        break;
      }
    }
  }
  // 놀이터·퀴즈에서도 쓰는 그리기 도우미
  TS.draw = { txt, tw, chip, panel, axis, pin, dot, bar, band, flag, scenario, mark, check, cross, arrow, arc, rr, fade, ramp };
  // 시제 기계 그림 (놀이터): frame과 문장 조각으로 시간선을 그림. g는 width×height 논리 크기
  TS.machine = function (g, width, height, frame, L, o = {}) {
    g.fillStyle = COL.bg; g.fillRect(0, 0, width, height);
    const kind = frame.clause === 'that' ? 'that' : frame.clause === 'adv' ? 'advF' : frame.time;
    const now = kind === 'PB' ? 0.62 : kind === 'FB' || kind === 'advF' ? 0.4 : 0.5;
    const y = height * 0.6, X = axis(g, 70, y, width - 150, { now, ls: 14, a: kind === 'that' ? 0.35 : 1 });
    scenario(g, X, y, kind, L, o.p == null ? 1 : o.p, { now, size: 17, ps: 15, spread: width < 700 ? 1.25 : 1, bw: 240, mainUp: true });
  };

  /* ---------- 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '토익 Part 5의 시제 문제', d: 24, caps: [
      [0.4, 5, '토익 Part 5에서 보기 네 개가 같은 동사의 다른 **시제**라면, 시제 문제예요.'],
      [5, 10, '보기를 보세요. worked, has worked, works, will work. 뿌리는 모두 work, 때만 달라요.'],
      [10, 14.5, '이런 문제는 문장을 다 해석하지 않아도 돼요. 문장 속 **시간 단서**를 찾으면 돼요.'],
      [14.5, 19, '여기서는 since 2020, 이 말이 단서예요. 정답은 영상 뒤에서 함께 풀어요.'],
      [19, 24, '시간 단서, 시간선, 그리고 **3단계 풀이법**을 차례로 배워요.'],
    ] },
    { id: 'line', n: '01', title: '시간선 위의 동사', sub: '과거 · 지금 · 미래', d: 28, caps: [
      [0.4, 5.5, '시간을 한 줄로 그려 볼게요. 가운데가 지금, 왼쪽은 과거, 오른쪽은 미래예요.'],
      [5.5, 10, 'She worked here. 과거 시제 worked → 과거의 한 점, 이미 끝난 일이에요.'],
      [10, 14.5, 'She will work here. will work → 미래의 한 점이에요.'],
      [14.5, 19.5, 'She works here. 현재 시제 works → 지금, 그리고 늘 되풀이되는 일이에요.'],
      [19.5, 24, '한국어도 일했다, 일한다, 일할 거예요처럼 끝이 바뀌어요.'],
      [24, 28, '여기까지는 한국어와 영어가 잘 맞아요. 문제는 그다음이에요.'],
    ] },
    { id: 'perfect', n: '02', title: '‘일했다’가 둘로 갈라진다', sub: '현재완료', d: 32, caps: [
      [0.4, 6, '그런데 한국어 ‘일했다’ 하나가 영어에서는 둘로 갈라져요.'],
      [6, 12, 'She worked here for five years. 5년 일하고 지금은 그만뒀어요. **끝난** 일이에요.'],
      [12, 18, 'She has worked here for five years. 5년 전부터 **지금까지** 일하고 있어요.'],
      [18, 23, '과거에서 지금까지 이어진 일은 **현재완료**. have, has 뒤에 과거분사(p.p.)를 써요.'],
      [23, 27.5, '한국어로는 둘 다 ‘일했다’라서, since 2020 뒤에도 과거 시제를 쓰기 쉬워요.'],
      [27.5, 32, '시간선에 놓아 보면 달라요. 지금까지 이어지면 현재완료, has worked.'],
    ] },
    { id: 'clue', n: '03', title: '단서가 시제를 고른다', sub: '같은 문장, 다른 단서', d: 34, caps: [
      [0.4, 6, '같은 문장에 시간 단서만 바꿔 볼게요. 먼저 two years ago.'],
      [6, 11, 'two years ago → 과거의 한 점. 그래서 동사도 **과거**, opened.'],
      [11, 17, '이번엔 단서가 since 2020. 2020년부터 지금까지의 **구간**을 가리켜요.'],
      [17, 22, '그래서 동사는 **현재완료** has opened. 지금까지 세 곳을 열었다는 뜻이에요.'],
      [22, 28, '단서를 next year, 미래의 한 점으로 바꾸면 동사는 **미래** will open.'],
      [28, 34, '동사를 고르기 전에, 단서가 시간선의 어디를 가리키는지 먼저 보세요.'],
    ] },
    { id: 'clues', n: '04', title: '시간 단서 모아 보기', sub: '한 점 · 구간 · 미래', d: 28, caps: [
      [0.4, 6, '자주 나오는 시간 단서를 시간선 위에 모아 볼게요.'],
      [6, 11.5, 'yesterday, last week, two years ago, in 2019. 과거의 한 점 → **과거** 시제.'],
      [11.5, 17, 'since 2020, for the past five years, so far, over the past year. 지금까지의 구간 → **현재완료**.'],
      [17, 22, 'tomorrow, next week, soon, in two weeks. 미래의 한 점 → will 뒤에 동사원형.'],
      [22, 28, '그래서 ago 같은 한 점 단서와 현재완료, since 같은 구간 단서와 과거 시제는 짝이 맞지 않아요.'],
    ] },
    { id: 'adv', n: '05', title: '부사절의 현재 시제', sub: 'when · if 뒤에는 will 대신 현재', d: 34, caps: [
      [0.4, 6, '이번엔 함정이에요. When the shipment arrives, we will call you.'],
      [6, 11.5, '둘 다 미래의 일인데, when 쪽에는 will 없이 현재 시제를 써요.'],
      [11.5, 18, '시간이나 조건을 나타내는 **부사절**에서는 **현재 시제**가 미래를 대신해요.'],
      [18, 24, '한국어도 같아요. ‘물건이 도착하면 전화할게요.’ 도착할 거면, 이라고 하지 않죠.'],
      [24, 29, 'when, if, once, as soon as, before, after, until, by the time. 이런 말 뒤가 이 자리예요.'],
      [29, 34, '그래서 will arrive → 오답. will 자리는 주절, we will call 쪽이에요.'],
    ] },
    { id: 'ref', n: '06', title: '기준점보다 먼저', sub: '미래완료 · 과거완료', d: 34, caps: [
      [0.4, 6, '완료형에는 **기준점**이 있어요. 그 기준점보다 먼저 끝난 일을 말해요.'],
      [6, 12, 'By next March, she will have completed the course. 기준점은 미래의 3월이에요.'],
      [12, 17.5, '3월이 오기 전에 끝나 있을 일 → **미래완료**. will have 뒤에 과거분사를 써요.'],
      [17.5, 23.5, 'By the time the CEO arrived, the meeting had already started.'],
      [23.5, 29, '기준점은 과거의 CEO 도착. 회의는 그보다 먼저 시작했죠 → **과거완료**, had 뒤에 과거분사.'],
      [29, 34, 'by 뒤의 기준점이 미래면 will have, 과거면 had. 기준점부터 시간선에 찍어요.'],
    ] },
    { id: 'that', n: '07', title: 'that절의 동사원형', sub: '요구·제안 동사 뒤', d: 32, caps: [
      [0.4, 6, '이번엔 시간 단서가 아니라 앞의 동사가 모양을 정하는 경우예요.'],
      [6, 12, 'recommend, request, suggest, insist, ask. 이런 **요구·제안** 동사 뒤 that절은 **동사원형**.'],
      [12, 18, 'We recommend that he arrive early. 주어가 3인칭 단수라도 -s 없는 원형이에요.'],
      [18, 24, '‘~해야 한다’는 뜻의 should, 이 말이 빠진 모양이라고 기억하세요. that he should arrive.'],
      [24, 28, '앞 동사가 과거여도 같아요. recommended that 뒤에도 attend, 원형이에요.'],
      [28, 32, 'It is essential that 뒤도 같아요. 시제를 따지지 않고 동사원형.'],
    ] },
    { id: 'adverb', n: '08', title: '시제와 짝인 부사', sub: 'recently · shortly · currently · already · yet', d: 32, caps: [
      [0.4, 6, '빈칸에 부사가 들어갈 때도 시간선이 도와줘요. 이번엔 동사의 시제가 단서예요.'],
      [6, 12, 'recently → ‘최근에’. 현재완료나 과거와 짝이에요. The lobby has recently been renovated.'],
      [12, 17.5, 'shortly, soon → ‘곧’. 미래와 짝이에요. The new branch will open shortly.'],
      [17.5, 23, 'currently → ‘지금’. 현재나 현재진행과 짝이에요. is currently reviewing.'],
      [23, 28, 'already → ‘벌써’. 긍정문의 완료형과 짝이에요. The shipment has already arrived.'],
      [28, 32, 'yet → ‘아직’. 부정문 끝에 와요. The shipment has not arrived yet.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: '단서 → 시간선 → 모양', d: 30, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11, '① **단서**를 찾아요. 시간 표현, when · if 같은 접속사, recommend 같은 앞 동사.'],
      [11, 17.5, '② **시간선**에 놓아요. 과거의 한 점인지, 지금까지의 구간인지, 미래인지, 기준점이 있는지 봐요.'],
      [17.5, 24, '③ **모양**을 골라요. 이때 함정을 확인해요. 부사절이면 현재, 요구·제안 that절이면 동사원형.'],
      [24, 30, '이 순서로 토익 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '처음 본 문제예요. ① 단서를 찾아요. since 2020, 시작한 때가 보여요.'],
      [6, 12, '② 시간선에 놓으면 2020년부터 지금까지의 **구간**이에요.'],
      [12, 18, '③ 구간이니까 **현재완료** has worked. 끝난 한 점인 worked → 오답. 정답은 (B).'],
      [18.4, 24.5, '두 번째 문제. ① 단서가 둘이에요. By the time 부사절, 그리고 주절의 will have finished.'],
      [24.5, 31, '② 매니저가 오는 때는 미래의 기준점. 그런데 빈칸은 by the time **부사절** 안이에요.'],
      [31, 37, '③ 부사절은 현재 시제로 미래를 나타내요. will arrive → 오답, 정답은 (B) arrives.'],
      [37.4, 43.5, '세 번째. ① recommended that. 요구·제안 동사 뒤의 that절이에요.'],
      [43.5, 50, '② 시간선 위의 일이 아니라 ‘해야 할 일’이에요. 앞 동사가 과거여도 상관없어요.'],
      [50, 56, '③ 동사원형 attend. attends, attended, will attend → 모두 오답. 정답은 (A).'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 시제 표', d: 22, caps: [
      [0.4, 6, '정리해요. 시제는 해석이 아니라 **시간 단서**로 골라요.'],
      [6, 12, '과거의 한 점은 과거, 지금까지의 구간은 현재완료, 미래는 will, 기준점이 있으면 완료형.'],
      [12, 17, '함정 둘. 시간·조건 부사절은 현재, 요구·제안 that절은 동사원형.'],
      [17, 22, '아래 시간선 시제 기계와 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  TS.CHAPTERS = CHAPTERS; TS.CAPTIONS = CAPTIONS; TS.END = END;
  TS.POSTER = CHAPTERS.find(c => c.id === 'clue').t + 20;
  TS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  TS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(VT.DRILL)에서 세 개. ② 시간선에 놓고, ③ 모양을 고를 때 틀린 보기를 지움
  const PRACTICE = [
    { k: 0, at: [0.4, 6, 12], kind: 'PN', L: { clue: 'since 2020', verb: 'has worked' },
      lines: ['since 2020 → 시작한 때', '2020년부터 지금까지 = 구간', '현재완료 → (B) has worked'] },
    { k: 9, at: [0.4, 6.1, 12.6], kind: 'advF', L: { clue: 'By the time …', verb: 'arrives', main: 'will have finished' },
      lines: ['By the time 부사절 + will have finished', '미래의 기준점 · 빈칸은 부사절 안', '부사절은 현재 → (B) arrives'] },
    { k: 10, at: [0.4, 6.1, 12.6], kind: 'that', L: { clue: '해야 할 일 · 시간선 밖', verb: 'attend' },
      lines: ['recommended that → 요구·제안', '‘해야 할 일’ · 함정: 과거 recommended', '동사원형 → (A) attend'] },
  ];
  PRACTICE.forEach(p => {
    const it = VT.DRILL[p.k];
    if (!p.lines[2].includes(`(${'ABCD'[it.a]})`)) console.warn('[시제] 실전 문제 정답 표시가 데이터와 달라요:', it.q);
    it.opts.forEach((o, i) => { if ((VT.judgeOpt(it, i).s === 'ok') !== (i === it.a)) console.warn('[시제] 실전 문제가 규칙 엔진과 달라요:', it.q); });
  });
  // 영상 속 예문의 동사도 규칙 엔진으로 확인 (03장의 세 단서, 05장의 부사절, 07장의 that절)
  const SCENE_CHECK = [
    ['past', { time: VT.clueTime('two years ago') }], ['presperf', { time: VT.clueTime('since 2020') }], ['fut', { time: VT.clueTime('next year') }],
    ['pres', { time: 'F', clause: 'adv' }], ['base', { clause: 'that' }], ['futperf', { time: 'FB' }], ['pastperf', { time: 'PB' }],
  ];
  SCENE_CHECK.forEach(([f, fr]) => { if (VT.judge(f, fr).s !== 'ok') console.warn('[시제] 영상 예문이 규칙 엔진과 달라요:', f, JSON.stringify(fr)); });
  [['recently', 'presperf'], ['shortly', 'fut'], ['currently', 'prog'], ['already', 'presperf']].forEach(([a, f]) => { if (VT.judgeAdv(a, { form: f }).s !== 'ok') console.warn('[시제] 영상 부사 예문이 규칙 엔진과 달라요:', a); });
  if (VT.judgeAdv('yet', { form: 'presperf', neg: true, end: true }).s !== 'ok') console.warn('[시제] 영상 부사 예문이 규칙 엔진과 달라요: yet');

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  // 문장 토큰 가운데 marks(덩어리)에 해당하는 조각 → 역할 { id: role }
  function markRoles(T, marks) {
    const out = {}, words = T.map(t => t.t);
    marks.forEach(m => {
      const parts = m.t.split(' ');
      for (let i = 0; i + parts.length <= words.length; i++) {
        if (parts.every((p, k) => words[i + k] === p)) { parts.forEach((p, k) => { out[T[i + k].id] = out[T[i + k].id] || m.role; }); break; }
      }
    });
    return out;
  }
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o)); }
  const FNAME = f => VT.FORM[f].name;

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(같은 동사, 다른 시제, 시간 단서) → 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '시제', W / 2, 262, { size: 84, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Verb Tense', W / 2, 336, { size: 30, weight: 500, color: COL.muted, align: 'center' });
      });
      fade(g, out1, () => {
        const X = axis(g, 380, 470, 520, { p: clamp((u - 0.9) / 1.2), ls: 15 });
        [['worked', 0.18], ['works', 0.5], ['will work', 0.82]].forEach(([w, f], k) => fade(g, ramp(u, 1.9 + k * 0.35, 0.4), () => dot(g, X(f), 470, w, { dy: -30, size: 18 })));
      });
      const it = VT.DRILL[0];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 17.6, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 160, 1000, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 180, 202, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const L = lay(g, toks(it.q), { x: 180, y: 285, size: 30, maxW: 930 });
        const cueOn = u > 14.6;
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: cueOn ? 1 : 0 } : cueOn && (tk.t === 'since' || tk.t === '2020') ? { color: COL.cue } : {});
        if (cueOn) { const a = byText(L, 'since'), b = byText(L, '2020'); fade(g, ramp(u, 14.6, 0.4), () => { rr(g, a.x - 4, a.y - 21, b.x + b.w - a.x + 8, 42, 7); g.strokeStyle = COL.cue; g.lineWidth = 2.2; g.stroke(); }); }
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        it.opts.forEach(([o], k) => {
          const ox = 200 + (k % 2) * 440, oy = 400 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            const w = txt(g, o, ox + 64, oy, { size: 30, weight: 600 });
            const i = o.indexOf('work'), x0 = ox + 64 + tw(g, o.slice(0, i), 30, 600);
            fade(g, ramp(u, 9.3 + k * 0.15, 0.4), () => { g.fillStyle = COL.ans; g.fillRect(x0, oy + 19, tw(g, 'work', 30, 600), 3); });
            return w;
          });
        });
        fade(g, ramp(u, 10, 0.5), () => chip(g, '모두 work · 때만 달라요', 1000, 431, { size: 18, weight: 700, color: COL.ans, fill: COL.panel2, stroke: COL.ans, align: 'center', h: 36 }));
      });
      const steps = [['①', '시간 단서', 'since · ago · next'], ['②', '시간선', '과거 — 지금 — 미래'], ['③', '3단계 풀이법', '단서 → 시간선 → 모양']];
      steps.forEach(([n, t1, t2], k) => {
        const a = ramp(u, 19.4 + k * 0.7, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 220, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 285 + (1 - a) * 16, { size: 34, weight: 700, color: COL.accent });
          txt(g, t1, x0 + 28, 345 + (1 - a) * 16, { size: 25, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 400 + (1 - a) * 16, { size: 19, weight: 500, color: k === 0 ? COL.cue : COL.en });
        });
      });
    },

    /* 01 시간선 위의 동사: 과거 한 점 · 미래 한 점 · 지금(되풀이) → 한국어 어미 */
    line(g, u) {
      const y = 352, X = axis(g, 170, y, 940, { p: clamp((u - 0.4) / 1.6) });
      const pick = S.base;
      const cols = [
        { id: 'past', f: 0.15, s: 'She worked here.', v: ['worked'], at: 5.6, ko: ['일', '했다'] },
        { id: 'fut', f: 0.85, s: 'She will work here.', v: ['will', 'work'], at: 10.1, ko: ['일', '할 거예요'] },
        { id: 'pres', f: 0.5, s: 'She works here.', v: ['works'], at: 14.6, ko: ['일', '한다'] },
      ];
      cols.forEach(c => {
        const a = pick ? 1 : ramp(u, c.at, 0.6), dimA = pick && pick !== c.id ? 0.3 : 1;
        if (a <= 0) return;
        fade(g, a * dimA, () => {
          const roles = {}; c.v.forEach(w => { roles[w] = 'verb'; });
          const L = lay(g, toks(c.s, roles, c.id), { x: X(c.f), y: 214, size: 30, align: 'center' });
          drawLay(g, L);
          sayLay(L, c.s);
          txt(g, FNAME(c.id), X(c.f), 262, { size: 17, weight: 700, color: COL.ans, align: 'center' });
          g.save(); g.strokeStyle = COL.faint; g.lineWidth = 2; g.setLineDash([4, 5]); g.beginPath(); g.moveTo(X(c.f), 282); g.lineTo(X(c.f), y - 16); g.stroke(); g.restore();
          if (c.id === 'pres') [-0.1, -0.05, 0, 0.05, 0.1].forEach(d => dot(g, X(c.f + d), y, '', { r: 7 }));
          else dot(g, X(c.f), y, '', { r: 11 });
        });
        fade(g, (pick ? 1 : ramp(u, 19.6 + cols.indexOf(c) * 0.3, 0.5)) * dimA, () => {
          const wb = tw(g, c.ko[0], 26, 600), wt = tw(g, c.ko[1], 26, 700), x0 = X(c.f) - (wb + wt) / 2;
          txt(g, c.ko[0], x0, 462, { size: 26, weight: 600 });
          txt(g, c.ko[1], x0 + wb, 462, { size: 26, weight: 700, color: COL.ans });
        });
      });
      fade(g, pick ? 1 : ramp(u, 19.6, 0.5), () => label(g, '한국어', LX, 462, { size: 17, color: COL.soft }));
      fade(g, pick ? 0 : ramp(u, 24.2, 0.6), () => chip(g, '여기까지는 한국어와 영어가 같아요', W / 2, 536, { size: 20, weight: 700, color: COL.good, fill: COL.panel2, stroke: COL.good, align: 'center', h: 46, pad: 22 }));
      fade(g, ramp(u, 14.8, 0.5) * (pick && pick !== 'pres' ? 0.3 : 1), () => txt(g, '늘 되풀이', X(0.5) + 96, y + 34, { size: 15, weight: 600, color: COL.soft }));
    },

    /* 02 ‘일했다’가 둘로: 과거(끝난 일) vs 현재완료(지금까지) */
    perfect(g, u) {
      const pick = S.still;   // false 끝남 · true 지금도
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 760 - 230, 146, 460, 56, { fill: COL.panel2, stroke: COL.faint });
        const s1 = '그녀는 여기서 5년 ', s2 = '일했다.';
        const w1 = tw(g, s1, 25, 600), w2 = tw(g, s2, 25, 700), x0 = 760 - (w1 + w2) / 2;
        txt(g, s1, x0, 175, { size: 25, weight: 600 });
        txt(g, s2, x0 + w1, 175, { size: 25, weight: 700, color: COL.ans });
      });
      const sides = [
        { still: false, x: LX, at: 6, s: 'She worked here for five years.', v: ['worked'], tag: '과거 · 끝난 일', note: '지금은 그만뒀어요', fname: '과거 (V-ed)' },
        { still: true, x: 660, at: 12, s: 'She has worked here for five years.', v: ['has', 'worked'], tag: '현재완료 · 지금까지', note: '지금도 일해요', fname: '현재완료 (have·has + p.p.)' },
      ];
      sides.forEach((sd, i) => {
        fade(g, ramp(u, 2.4 + i * 0.3, 0.6), () => arrow(g, 760 + (i ? 60 : -60), 206, sd.x + 270, 234, COL.faint, 2));
        const a = pick != null ? 1 : ramp(u, sd.at, 0.6), dim = pick != null && pick !== sd.still ? 0.3 : 1;
        fade(g, a * dim, () => {
          panel(g, sd.x, 240, 540, 250, { fill: COL.panel, stroke: pick === sd.still ? COL.ans : COL.faint, lw: pick === sd.still ? 2.5 : 1.5 });
          const roles = {}; sd.v.forEach(w => { roles[w] = 'verb'; });
          const L = lay(g, toks(sd.s, roles, 'p' + i), { x: sd.x + 24, y: 280, size: 24, maxW: 500 });
          drawLay(g, L); sayLay(L, sd.s);
          const X = axis(g, sd.x + 70, 395, 400, { now: 0.8, ls: 14 });
          const x0 = X(0.12), x1 = sd.still ? X(0.8) - 14 : X(0.56);
          const bp = pick != null ? 1 : clamp((u - sd.at - 1) / 1.6);
          bar(g, x0, x1, 395, { p: bp, head: sd.still, lw: 7 });
          fade(g, ramp(bp, 0.9, 0.1), () => {
            txt(g, '5년', (x0 + x1) / 2, 370, { size: 16, weight: 700, color: COL.ans, align: 'center' });
            if (!sd.still) { g.strokeStyle = COL.ans; g.lineWidth = 3; g.beginPath(); g.moveTo(x1 + 4, 383); g.lineTo(x1 + 4, 407); g.stroke(); }
          });
          fade(g, pick != null ? 1 : ramp(u, sd.at + 2.6, 0.5), () => {
            txt(g, sd.note, sd.x + 24, 462, { size: 18, weight: 700, color: COL.soft });
            chip(g, sd.tag, sd.x + 516, 462, { size: 16, weight: 700, color: COL.ans, fill: COL.panel2, stroke: COL.ans, align: 'right', h: 32, r: 8 });
          });
        });
      });
      fade(g, ramp(u, 18.2, 0.6) * (pick != null ? 1 : 1 - ramp(u, 23.1, 0.3)), () => {
        chip(g, '현재완료 = have · has + 과거분사(p.p.)', W / 2, 530, { size: 20, weight: 700, color: COL.ans, fill: COL.panel2, stroke: COL.ans, align: 'center', h: 44, pad: 22 });
      });
      fade(g, ramp(u, 23.4, 0.6) * (pick != null ? 0 : 1), () => {
        // 흔한 실수: since 2020 + 과거 시제
        panel(g, LX + 20, 506, 1100, 50, { fill: COL.bg, stroke: COL.trap, r: 12 });
        mark(g, false, LX + 50, 531, 15);
        txt(g, 'She worked here since 2020.', LX + 76, 531, { size: 21, weight: 600, color: COL.muted });
        g.strokeStyle = COL.bad; g.lineWidth = 2; g.beginPath(); g.moveTo(LX + 72, 532); g.lineTo(LX + 80 + tw(g, 'She worked here since 2020.', 21, 600), 532); g.stroke();
        mark(g, true, 660, 531, 15);
        txt(g, 'She has worked here since 2020.', 686, 531, { size: 21, weight: 700, color: COL.good });
        say(680, 510, 380, 44, 'She has worked here since 2020.');
      });
    },

    /* 03 단서가 시제를 고른다: 같은 문장에서 단서만 바꾸면 동사가 따라 바뀜 */
    clue(g, u) {
      const PH = [
        { id: 'ago', t0: 0, clue: 'two years ago', kind: 'P', form: 'past', fill: 6, pinAt: 2.4 },
        { id: 'since', t0: 11, clue: 'since 2020', kind: 'PN', form: 'presperf', fill: 17.2, pinAt: 12.6 },
        { id: 'next', t0: 22, clue: 'next year', kind: 'F', form: 'fut', fill: 24.8, pinAt: 23.2 },
      ];
      const vp = VT.VPS[0];
      let pi = u < 11 ? 0 : u < 22 ? 1 : 2, v = u;
      if (S.clue) { pi = PH.findIndex(p => p.id === S.clue); v = PH[pi].t0 + 10.5; }
      const P = PH[pi];
      const mk = (ph, filled) => {
        const verb = filled ? VT.conj(vp, ph.form) : '';
        return [{ id: 's0', t: 'Our', r: '' }, { id: 's1', t: 'company', r: '' }, { id: 'v', t: verb, r: filled ? 'ans' : 'blank' },
          { id: 'o0', t: 'three', r: '' }, { id: 'o1', t: 'new', r: '' }, { id: 'o2', t: 'stores', r: '' }, { id: 'c', t: ph.clue, r: 'cue' }, { id: 'p', t: '.', r: '' }];
      };
      const opt = { x: W / 2, y: 205, size: 34, align: 'center' };
      const filled = v >= P.fill;
      const LB = lay(g, mk(P, filled), opt);
      const mp = S.clue ? 1 : pi ? clamp((v - P.t0) / 0.9) : 1;
      fade(g, ramp(u, 0.4, 0.6), () => {
        if (mp < 1) morph(g, lay(g, mk(PH[pi - 1], true), opt), LB, mp, { style: tk => tk.id === 'c' ? { box: COL.cue } : {} });
        else drawLay(g, LB, tk => tk.id === 'c' ? { box: COL.cue } : tk.r === 'blank' ? { glow: 0.5 + 0.5 * Math.sin(u * 4) } : {});
        sayLay(LB, `Our company ${VT.conj(vp, P.form)} three new stores ${P.clue}.`);
      });
      fade(g, filled ? ramp(v, P.fill, 0.5) : 0, () => {
        const F = VT.FORM[P.form];
        chip(g, `${F.name} · ${F.shape}`, W / 2, 278, { size: 19, weight: 700, color: COL.ans, fill: COL.panel2, stroke: COL.ans, align: 'center', h: 40, r: 10, pad: 18 });
      });
      // 시간선: 단서가 먼저 떨어지고, 동사가 그 자리에 놓임
      const y = 420, X = axis(g, 170, y, 940, { p: clamp((u - 0.8) / 1.2) });
      PH.forEach((ph, i) => {
        const showP = S.clue ? (i === pi ? 1 : 0) : clamp((v - ph.pinAt) / (ph.fill - ph.pinAt + 1.4));
        const out = S.clue ? 1 : i < 2 ? 1 - ramp(u, PH[i + 1].t0 - 0.2, 0.6) : 1;
        if (i > pi && !S.clue) return;
        fade(g, out, () => scenario(g, X, y, ph.kind, { clue: ph.clue, verb: VT.conj(vp, ph.form) }, showP, { size: 21, ps: 18 }));
      });
      fade(g, S.clue ? 0 : ramp(u, 28.4, 0.6), () => {
        chip(g, '단서가 가리키는 곳 = 동사의 시제', W / 2, 530, { size: 21, weight: 700, color: COL.cue, fill: COL.panel2, stroke: COL.cue, align: 'center', h: 46, pad: 22 });
      });
    },

    /* 04 시간 단서 모아 보기: 과거 한 점 · 지금까지 구간 · 미래 한 점 */
    clues(g, u) {
      const y = 200, now = 0.64, X = axis(g, 170, y, 940, { now, p: clamp((u - 0.4) / 1.2) });
      const cols = [
        { kind: 'P', cx: X(0.17), at: 6.2, head: '과거의 한 점', form: '과거 · V-ed', words: ['yesterday', 'last week', 'two years ago', 'in 2019'] },
        { kind: 'PN', cx: X(0.47), at: 11.7, head: '과거 → 지금 구간', form: '현재완료 · have·has + p.p.', words: ['since 2020', 'for the past five years', 'so far', 'over the past year'] },
        { kind: 'F', cx: X(0.86), at: 17.2, head: '미래의 한 점', form: '미래 · will + 동사원형', words: ['tomorrow', 'next week', 'soon', 'in two weeks'] },
      ];
      cols.forEach(c => {
        const a = ramp(u, c.at, 0.5);
        fade(g, a, () => {
          if (c.kind === 'PN') { band(g, X(0.32), X(now), y, COL.cue, 0.3); diamond(g, X(0.32), y, 7, COL.cue); }
          else diamond(g, c.cx, y, 8, COL.cue);
          g.save(); g.strokeStyle = COL.faint; g.lineWidth = 2; g.setLineDash([4, 5]); g.beginPath(); g.moveTo(c.cx, y + 16); g.lineTo(c.cx, 252); g.stroke(); g.restore();
          txt(g, c.head, c.cx, 270, { size: 19, weight: 700, color: COL.soft, align: 'center' });
          txt(g, c.form, c.cx, 298, { size: 17, weight: 700, color: COL.ans, align: 'center' });
        });
        c.words.forEach((w, k) => fade(g, ramp(u, c.at + 0.5 + k * 0.4, 0.4), () => {
          chip(g, w, c.cx, 344 + k * 42 - (1 - ramp(u, c.at + 0.5 + k * 0.4, 0.4)) * 12, { size: 17, weight: 600, color: COL.cue, fill: COL.panel, stroke: COL.cue, align: 'center', h: 34, r: 9, lw: 1.2 });
        }));
      });
      // 함정: 단서와 시제가 서로 맞지 않는 짝
      const traps = [['has opened … two years ago', 'ago = 과거의 한 점'], ['opened … since 2020', 'since = 지금까지 구간']];
      traps.forEach(([s, why], i) => fade(g, ramp(u, 22.4 + i * 0.6, 0.5), () => {
        const x = LX + 20 + i * 560;
        panel(g, x - 16, 512, 530, 50, { fill: COL.panel2, stroke: COL.trap, r: 12 });
        mark(g, false, x + 6, 537, 14);
        const w = txt(g, s, x + 30, 537, { size: 19, weight: 600, color: COL.muted });
        g.strokeStyle = COL.bad; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 26, 538); g.lineTo(x + 34 + w, 538); g.stroke();
        txt(g, why, x + 500, 537, { size: 16, weight: 700, color: COL.trap, align: 'right' });
      }));
    },

    /* 05 부사절의 현재 시제: When the shipment arrives, we will call you. */
    adv(g, u) {
      const good = toks('When the shipment arrives, we will call you.', { When: 'cue', arrives: 'verb', will: 'main', call: 'main' }, 'a');
      const badT = good.map(t => t.t === 'arrives' ? Object.assign({}, t, { t: 'will arrive', r: 'bad' }) : t);
      const opt = { x: W / 2, y: 190, size: 34, align: 'center' };
      const LG = lay(g, good, opt), LX_ = lay(g, badT, opt);
      const wp = clamp((u - 29.2) / 0.7) - clamp((u - 31.8) / 0.7);   // 틀린 모양으로 잠깐 바뀜
      fade(g, ramp(u, 0.4, 0.6), () => {
        if (wp > 0) morph(g, LG, LX_, wp); else drawLay(g, LG);
        sayLay(LG, 'When the shipment arrives, we will call you.');
        if (wp > 0.6) { const b = byText(LX_, 'will arrive'); mark(g, false, b.x + b.w / 2, b.y - 40, 18); }
      });
      const L = wp > 0.5 ? LX_ : LG;
      under(g, L, 'When', 'arrives', '부사절 (시간·조건)', COL.clause, ramp(u, 6.4, 0.6) * (wp > 0 ? 0.25 : 1));
      if (wp > 0.5) under(g, L, 'When', 'will arrive', '부사절 (시간·조건)', COL.clause, 1);
      under(g, L, 'we', 'you', '주절', COL.ref, ramp(u, 6.8, 0.6));
      // 시간선: 두 일 모두 미래
      const y = 370, X = axis(g, 170, y, 940, { now: 0.36, p: clamp((u - 6) / 1.2) });
      fade(g, ramp(u, 7.4, 0.6), () => {
        dot(g, X(0.62), y, 'arrives', { size: 20 });
        dot(g, X(0.84), y, 'will call', { size: 20, color: COL.ref });
        g.strokeStyle = COL.soft; g.lineWidth = 2; g.beginPath(); g.moveTo(X(0.6), y - 30); g.lineTo(X(0.6), y - 38); g.lineTo(X(0.86), y - 38); g.lineTo(X(0.86), y - 30); g.stroke();
        txt(g, '둘 다 미래의 일', X(0.73), y - 56, { size: 17, weight: 700, color: COL.soft, align: 'center' });
      });
      fade(g, ramp(u, 11.8, 0.6), () => chip(g, '시간·조건 부사절 → 현재 시제가 미래를 대신해요', X(0.18) + 60, y - 50, { size: 17, weight: 700, color: COL.clause, fill: COL.panel2, stroke: COL.clause, align: 'center', h: 38, r: 10 }));
      // 한국어도 같아요
      fade(g, ramp(u, 18.2, 0.6), () => {
        panel(g, LX, 452, 540, 110, { fill: COL.panel, stroke: COL.faint });
        label(g, '한국어', LX + 22, 478, { size: 15 });
        const s1 = '물건이 ', s2 = '도착하면', s3 = ' 전화할게요.';
        let x = LX + 22; x += txt(g, s1, x, 514, { size: 24, weight: 600 }); x += txt(g, s2, x, 514, { size: 24, weight: 700, color: COL.ans }); txt(g, s3, x, 514, { size: 24, weight: 600 });
        txt(g, '‘도착할 거면’이라고 하지 않아요', LX + 22, 546, { size: 16, weight: 600, color: COL.muted });
      });
      // 이 자리를 만드는 접속사
      const conj = ['when', 'if', 'once', 'as soon as', 'before', 'after', 'until', 'by the time'];
      fade(g, ramp(u, 24.2, 0.5), () => { panel(g, 660, 452, 540, 110, { fill: COL.panel, stroke: COL.clause }); label(g, '시간·조건 부사절을 여는 말', 682, 478, { size: 15, color: COL.clause }); });
      let cx = 682, cy = 506;
      conj.forEach((c, k) => {
        const w = tw(g, c, 17, 600) + 22;
        if (cx + w > 1186) { cx = 682; cy += 34; }
        const x = cx, yy = cy;
        fade(g, ramp(u, 24.6 + k * 0.25, 0.4), () => chip(g, c, x, yy, { size: 17, weight: 600, color: COL.clause, fill: COL.panel2, h: 28, r: 8, pad: 11 }));
        cx += w + 8;
      });
    },

    /* 06 기준점보다 먼저: 미래완료(by next March) · 과거완료(by the time … arrived) */
    ref(g, u) {
      const rows = [
        { s: 'By next March, she will have completed the course.', roles: { March: 'ref', next: 'ref', will: 'verb', have: 'verb', completed: 'verb' },
          y: 180, ty: 294, at: 6, kind: 'FB', now: 0.18, L: { ref: 'next March', verb: 'will have completed' }, tag: '미래완료 · will have + p.p.' },
        { s: 'By the time the CEO arrived, the meeting had already started.', roles: { arrived: 'ref', had: 'verb', started: 'verb' },
          y: 394, ty: 506, at: 17.6, kind: 'PB', now: 0.86, L: { ref: 'the CEO arrived', verb: 'had started' }, tag: '과거완료 · had + p.p.' },
      ];
      fade(g, ramp(u, 0.6, 0.5) * (1 - ramp(u, 5.4, 0.5)), () => chip(g, '완료형 = 기준점보다 먼저 끝난 일', W / 2, 300, { size: 24, weight: 700, color: COL.ref, fill: COL.panel2, stroke: COL.ref, align: 'center', h: 54, pad: 26 }));
      rows.forEach(r => {
        const a = ramp(u, r.at, 0.6);
        fade(g, a, () => {
          const L = lay(g, toks(r.s, r.roles, 'r' + r.y), { x: LX, y: r.y, size: 27, maxW: 900 });
          drawLay(g, L); sayLay(L, r.s);
          fade(g, ramp(u, r.at + 6, 0.5), () => chip(g, r.tag, 1200, r.y, { size: 17, weight: 700, color: COL.ans, fill: COL.panel2, stroke: COL.ans, align: 'right', h: 36, r: 9 }));
          const X = axis(g, 170, r.ty, 940, { now: r.now, p: clamp((u - r.at - 0.4) / 1.2) });
          scenario(g, X, r.ty, r.kind, r.L, clamp((u - r.at - 1.2) / 3.6), { now: r.now, size: 20, ps: 17, spread: r.kind === 'PB' ? 1.6 : 1.7 });
          if (u > 29.2) fade(g, ramp(u, 29.2, 0.5), () => {
            const xr = r.kind === 'FB' ? X(r.now + 0.38 * 1.7) : X(r.now - 0.2 * 1.6);
            g.strokeStyle = COL.ref; g.lineWidth = 2.5; g.beginPath(); g.arc(xr, r.ty, 18 + 3 * Math.sin(u * 5), 0, Math.PI * 2); g.stroke();
          });
        });
      });
    },

    /* 07 that절의 동사원형: recommend that he arrive */
    that(g, u) {
      const verbs = ['recommend', 'request', 'require', 'suggest', 'insist', 'ask', 'propose'];
      let x = LX;
      verbs.forEach((v, k) => {
        const w = tw(g, v, 17, 700) + 24, xx = x;
        fade(g, ramp(u, 6.2 + k * 0.25, 0.4), () => chip(g, v, xx, 172, { size: 17, weight: 700, color: COL.cue, fill: COL.panel2, stroke: COL.cue, h: 34, r: 9, pad: 12 }));
        x += w + 10;
      });
      fade(g, ramp(u, 6.2, 0.5), () => txt(g, '+ that + 동사원형', x + 6, 172, { size: 19, weight: 700, color: COL.ans }));
      const A = toks('We recommend that he arrive early.', { recommend: 'cue', that: 'cue', he: 'trap', arrive: 'verb' }, 'w');
      const B = A.slice(0, 4).concat([{ id: 'sh', t: '(should)', r: 'dim' }]).concat(A.slice(4));
      const opt = { x: W / 2, y: 262, size: 36, align: 'center' };
      const LA = lay(g, A, opt), LB = lay(g, B, opt);
      const sp = clamp((u - 18.2) / 0.9);
      fade(g, ramp(u, 0.6, 0.6), () => {
        if (sp > 0) morph(g, LA, LB, sp); else drawLay(g, LA);
        sayLay(LA, 'We recommend that he arrive early.');
      });
      const L = sp > 0.5 ? LB : LA, he = byText(L, 'he');
      fade(g, ramp(u, 12.3, 0.5), () => txt(g, '3인칭 단수', he.x + he.w / 2, 218, { size: 15, weight: 700, color: COL.trap, align: 'center' }));
      tryList(g, [['arrives', '-s 없이 써요'], ['arrive', '']], 200, 344, u, 13.4, { step: 1.2, size: 25, okWhy: '동사원형' });
      fade(g, ramp(u, 18.6, 0.6), () => {
        const X = axis(g, 760, 400, 380, { now: 0.4, ls: 14, a: 0.4 });
        scenario(g, X, 400, 'that', { clue: '해야 할 일 · 시간선 밖', verb: 'arrive' }, 1, { now: 0.4, size: 22, ps: 17, bw: 270, spread: 1.6 });
      });
      const more = [
        { s: 'The manager recommended that every employee attend the training.', roles: { recommended: 'cue', that: 'cue', attend: 'verb' }, tag: '앞 동사가 과거여도', at: 24.4 },
        { s: 'It is essential that each visitor wear an ID badge.', roles: { essential: 'cue', that: 'cue', wear: 'verb' }, tag: 'essential · important that', at: 28.4 },
      ];
      more.forEach((m, i) => fade(g, ramp(u, m.at, 0.6), () => {
        const y = 474 + i * 52;
        const Lm = lay(g, toks(m.s, m.roles, 'm' + i), { x: LX, y, size: 23 });
        drawLay(g, Lm); sayLay(Lm, m.s);
        chip(g, m.tag, 1200, y, { size: 15, weight: 700, color: COL.cue, fill: COL.panel2, stroke: COL.cue, align: 'right', h: 32, r: 8 });
      }));
    },

    /* 08 시제와 짝인 부사: 시간선 위의 부사 + 예문 다섯 */
    adverb(g, u) {
      const y = 226, X = axis(g, 170, y, 940, { now: 0.5, p: clamp((u - 0.4) / 1.2) });
      const pins = [
        { w: 'already · yet', f: 0.22, at: 23.2, span: true }, { w: 'recently', f: 0.38, at: 6.2 },
        { w: 'currently', f: 0.5, at: 17.7 }, { w: 'shortly · soon', f: 0.68, at: 12.2 },
      ];
      pins.forEach(p => fade(g, ramp(u, p.at, 0.5), () => {
        if (p.span) band(g, X(0.08), X(0.5), y, COL.cue, 0.18);
        pin(g, X(p.f), y, p.w, { size: 17, h: p.f === 0.5 ? 58 : 54 });
      }));
      const rows = [
        { s: 'The lobby has recently been renovated.', adv: 'recently', v: ['has', 'been', 'renovated'], tag: '현재완료 · 과거', at: 6.6 },
        { s: 'The new branch will open shortly.', adv: 'shortly', v: ['will', 'open'], tag: '미래', at: 12.6 },
        { s: 'Mr. Han is currently reviewing the applications.', adv: 'currently', v: ['is', 'reviewing'], tag: '현재 · 현재진행', at: 18.1 },
        { s: 'The shipment has already arrived.', adv: 'already', v: ['has', 'arrived'], tag: '긍정문의 완료형', at: 23.6 },
        { s: 'The shipment has not arrived yet.', adv: 'yet', v: ['has', 'not', 'arrived'], tag: '부정문의 끝', at: 28.4 },
      ];
      rows.forEach((r, i) => fade(g, ramp(u, r.at, 0.5), () => {
        const yy = 308 + i * 54, roles = { [r.adv]: 'cue' };
        r.v.forEach(w => { roles[w] = 'verb'; });
        const L = lay(g, toks(r.s, roles, 'd' + i), { x: LX, y: yy, size: 25 });
        drawLay(g, L, tk => tk.t === r.adv ? { box: COL.cue } : {});
        sayLay(L, r.s);
        chip(g, r.tag, 1200, yy, { size: 16, weight: 700, color: COL.ans, fill: COL.panel2, stroke: COL.ans, align: 'right', h: 34, r: 9 });
      }));
    },

    /* 09 3단계 풀이법 흐름도 */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 단서를 찾는다', sub: '', at: 5.6 },
        { x: 480, head: '② 시간선에 놓는다', sub: '어디를 가리키나', at: 11.2 },
        { x: 880, head: '③ 모양을 고른다', sub: '함정 확인', at: 17.8 },
      ];
      const rows = [
        ['ago · yesterday · last', '과거의 한 점', '과거 · V-ed', 'cue'],
        ['since · so far · for the past', '과거 → 지금 구간', '현재완료 · have p.p.', 'cue'],
        ['next · tomorrow · soon', '미래의 한 점', '미래 · will + 원형', 'cue'],
        ['by + 기준점', '기준점보다 먼저', 'will have p.p. · had p.p.', 'ref'],
        ['when · if · until 부사절', '미래지만 부사절', '현재 시제 (will ×)', 'trap'],
        ['recommend · request that', '해야 할 일 · 시간선 밖', '동사원형 (-s ×)', 'trap'],
      ];
      const P = S.path && S.path.row != null ? S.path : null;
      cols.forEach((c, ci) => {
        fade(g, ramp(u, c.at, 0.6), () => {
          panel(g, c.x, 146, 340, 56, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 18, 174, { size: 21, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 324, 174, { size: 14, weight: 600, color: COL.muted, align: 'right' });
          rows.forEach((r, ri) => {
            const y = 214 + ri * 58, on = P && P.row === ri;
            const col = ci === 0 ? (r[3] === 'ref' ? COL.ref : COL.cue) : ci === 2 ? (r[3] === 'trap' ? COL.trap : COL.ans) : COL.soft;
            fade(g, ramp(u, c.at + 0.4 + ri * 0.35, 0.5) * (P && !on ? 0.35 : 1), () => {
              panel(g, c.x, y, 340, 50, { fill: on ? 'rgba(255,193,94,0.14)' : COL.panel, stroke: on ? COL.ans : ci === 2 && r[3] === 'trap' ? COL.trap : COL.faint, lw: on ? 2.5 : 1.3, r: 10 });
              txt(g, r[ci], c.x + 16, y + 25, { size: 17, weight: 700, color: col });
            });
            if (ci < 2) fade(g, ramp(u, cols[ci + 1].at + 0.4 + ri * 0.35, 0.5) * (P && !on ? 0.35 : 1), () => arrow(g, c.x + 346, y + 25, c.x + 394, y + 25, on ? COL.ans : COL.faint, on ? 3 : 2));
          });
        });
      });
      if (P && P.text) chip(g, P.text, W / 2, 576, { size: 18, weight: 700, color: COL.ans, fill: COL.panel2, stroke: COL.ans, align: 'center', h: 38, r: 10 });
    },

    /* 10 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = VT.DRILL[P.k];
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0], s2 = v >= P.at[1], s3 = v >= P.at[2];
        const T = toks(it.q).map(tk => tk.r === 'blank' && s3 ? Object.assign(tk, { t: it.opts[it.a][0] }) : tk);
        const roleOf = markRoles(T, it.marks), RC = { cue: COL.cue, verb: COL.cue, ante: COL.ref, trap: COL.trap };
        const L = lay(g, T, { x: LX, y: 222, size: 30, maxW: 1120, lh: 50 });
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: s2 && !s3 ? 0.6 : 0 } : s1 && v >= P.at[0] + 1 && roleOf[tk.id] ? { color: RC[roleOf[tk.id]] } : {});
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        const oy = L.lines > 1 ? 342 : 312;
        it.opts.forEach(([o, form], k) => {
          const ox = LX + (k % 2) * 290, y = oy + Math.floor(k / 2) * 66;
          const right = k === it.a, gone = !right && v >= P.at[2] + 0.4, win = right && v >= P.at[2] + 1.4;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 21, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, o, ox + 50, y, { size: 26, weight: win ? 700 : 600, color: win ? COL.good : gone ? COL.dim : COL.text });
          if (v >= P.at[1] + 0.8) fade(g, ramp(v, P.at[1] + 0.8, 0.5), () => txt(g, FNAME(form), ox + 50, y + 25, { size: 13, weight: 700, color: gone ? COL.dim : COL.ans }));
          if (gone) {
            const gp = clamp((v - P.at[2] - 0.4) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, y + 1); g.lineTo(ox - 4 + (w + 60) * gp, y + 1); g.stroke();
          }
          if (win) { panel(g, ox - 12, y - 24, w + 76, 62, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + w + 82, y, 18); }
        });
        // 작은 시간선 (② 단계부터)
        fade(g, ramp(v, P.at[1] + 0.2, 0.6), () => {
          const ty = 512, X = axis(g, 130, ty, 440, { now: P.kind === 'PN' ? 0.75 : 0.35, ls: 13, a: P.kind === 'that' ? 0.35 : 1 });
          scenario(g, X, ty, P.kind, P.L, clamp((v - P.at[1] - 0.2) / 2.4), { now: P.kind === 'PN' ? 0.75 : 0.35, size: 16, ps: 14, spread: P.kind === 'PN' ? 1.6 : 1.3, bw: 230 });
        });
        panel(g, 660, 290, 560, 240, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = 326 + k * 74;
          txt(g, ['① 단서', '② 시간선', '③ 모양'][k], 684, y, { size: 18, weight: 700, color: COL.accent });
          txt(g, ln, 684, y + 30, { size: 18, weight: 600, color: k === 2 ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 400, 640, 900], Y0 = 162, RH = 42;
      const rows = [
        ['ago · yesterday · last', '과거의 한 점', '과거', 'opened two years ago', 'cue'],
        ['since · so far · for the past', '과거 → 지금 구간', '현재완료', 'has worked since 2020', 'cue'],
        ['next · tomorrow · soon', '미래의 한 점', '미래 (will)', 'will present next Monday', 'cue'],
        ['by + 미래 시점', '미래 기준점보다 먼저', '미래완료', 'will have completed', 'ref'],
        ['by the time + 과거', '과거 기준점보다 먼저', '과거완료', 'had already started', 'ref'],
        ['when · if · until 부사절', '미래지만 부사절', '현재 (will ×)', 'When it arrives, we will …', 'trap'],
        ['recommend · request that', '해야 할 일', '동사원형 (-s ×)', 'that he arrive early', 'trap'],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 10, 1160, RH * (rows.length + 1) + 14, { fill: COL.panel, stroke: COL.faint });
        ['단서', '시간선', '모양', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 20, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 6, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.55, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 20;
        txt(g, r[0], X[0] + 20, y, { size: 18, weight: 700, color: r[4] === 'ref' ? COL.ref : r[4] === 'trap' ? COL.trap : COL.cue });
        txt(g, r[1], X[1] + 20, y, { size: 18, weight: 600, color: COL.soft });
        txt(g, r[2], X[2] + 20, y, { size: 19, weight: 700, color: COL.ans });
        txt(g, r[3], X[3] + 20, y, { size: 18, weight: 500, color: COL.en });
      }));
      const steps = ['① 단서 찾기', '② 시간선에 놓기', '③ 모양 고르기 · 함정 확인'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 6.5 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 552, { size: 20, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 48, r: 12, pad: 20 });
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

  TS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[TS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, TS.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + VT.DRILL.map(d => d.q + d.opts.map(o => o[0]).join('')).join('') +
    Object.values(VT.TIME).map(s => s.name + s.desc).join('') + Object.values(VT.FORM).map(f => f.name + f.shape).join('') +
    VT.MCLUES.map(c => c.label + c.tpl).join('') + VT.VPS.map(v => v.S + v.v.join('') + v.o).join('') +
    '과거지금미래해야할일시간선밖기준점보다먼저끝남' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←✓×▢?~=+-/:…‘’';
  TS.baseText = EXTRA;
  TS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = TS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { TS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
