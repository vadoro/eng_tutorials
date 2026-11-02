/* 동사 자리 · to부정사 · 동명사 튜토리얼 — 영상 장면
 *
 * IV.render(g, t)는 시각 t와 사용자 상태 IV.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 영어 문장은 낱말 조각(토큰)으로 그리고, 동사의 모양마다 색을 칠합니다:
 * 진짜 동사(시제가 있는 동사) 보라 + 시계 표시 · to부정사 민트 · -ing 꼴 하늘 · 동사원형 라임 · 전치사 모래색.
 * 빈칸은 분홍 점선 상자, 채운 답은 그 모양의 색, 빈칸 앞 단서는 보라 테두리, 함정은 주황.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(IG.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const IG = window.IG;
  const IV = (window.IV = {});
  const W = 1280, H = 720;
  IV.W = W; IV.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  IV.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36',
    rel: '#FFC15E', gap: '#FF7AA8', trap: '#FF9F7A', bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
    // 동사 모양 색 (페이지 CSS의 --c-fin 등과 같은 뜻): 진짜 동사 보라 · to부정사 민트 · -ing 꼴 하늘 · 동사원형 라임 · 전치사 모래
    fin: '#C9A7FF', to: '#7FE0A8', ing: '#6EC8FF', base: '#D4E157', prep: '#E9C98F',
  };
  IV.COL = COL;
  const FC = { fin: COL.fin, base: COL.base, to: COL.to, ing: COL.ing, prep: COL.prep, pp: COL.muted, n: COL.muted };
  const FR = { fin: 1, base: 1, to: 1, ing: 1 };
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (IV.S = { form1: null, fix: null, vt: null, pick: null, expr: null, vo: null, path: null });
  IV.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  IV.hits = () => HITS;

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
  // 곡선 화살표 (h > 0이면 위로, h < 0이면 아래로 휨, p: 그려진 정도 0→1)
  function arc(g, x0, y0, x1, y1, h, color, p = 1, o = {}) {
    if (p <= 0.001) return;
    const cx = (x0 + x1) / 2, cy = (h >= 0 ? Math.min(y0, y1) : Math.max(y0, y1)) - h, N = 40, n = Math.max(2, Math.round(N * p));
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
  // 시계 = 시제. 진짜 동사 위에 붙임
  function clock(g, x, y, r, color) {
    g.save(); g.strokeStyle = color; g.lineWidth = Math.max(1.6, r * 0.24); g.lineCap = 'round';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - r * 0.62); g.moveTo(x, y); g.lineTo(x + r * 0.48, y + r * 0.12); g.stroke();
    g.restore();
  }
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
  // 모양 이름표 (진짜 동사 · 동사원형 · to부정사 · -ing 꼴)
  function formTag(g, f, x, y, o = {}) {
    const size = o.size || 15;
    return chip(g, o.label || IG.FORM[f], x, y, { size, weight: 700, color: FC[f] || COL.soft, fill: 'rgba(16,21,28,0.9)', stroke: FC[f] || COL.soft, align: o.align || 'center', h: size * 1.8, pad: 10, lw: 1.3 });
  }
  // 진짜 동사 세기: 시계 n개 + ✓·×
  function counter(g, n, x, y, o = {}) {
    const good = o.ok != null ? o.ok : n === 1, c = good ? COL.good : COL.bad, size = o.size || 17;
    const s = o.text || `진짜 동사 ${n}개`, sw = tw(g, s, size, 700), cw = Math.max(1, n) * 24;
    const w = 16 + sw + 14 + cw + 34, h = size * 2.3;
    const x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    rr(g, x0, y - h / 2, w, h, 10); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = c; g.lineWidth = 1.8; g.stroke();
    txt(g, s, x0 + 16, y + 1, { size, weight: 700, color: COL.text });
    if (n === 0) { g.save(); g.setLineDash([3, 3]); g.strokeStyle = COL.dim; g.lineWidth = 1.6; g.beginPath(); g.arc(x0 + 16 + sw + 14 + 10, y, 8, 0, Math.PI * 2); g.stroke(); g.restore(); }
    for (let k = 0; k < n; k++) clock(g, x0 + 16 + sw + 14 + 10 + k * 24, y, 8, COL.fin);
    mark(g, good, x0 + w - 18, y, 13);
    return { x: x0, w, h };
  }

  /* ---------- 영어 문장 토큰 배치와 그리기 ---------- */
  // 토큰 { id, t: 글자, r: 역할 }. 역할: fin · base · to · ing (동사 모양) · prep 전치사 · rel 연결어 · fn 기능어 · blank 빈칸 · ans 채운 답 · bad 틀림 · trap 함정 · '' 보통
  const RCOL = { fn: COL.muted, trap: COL.trap, bad: COL.bad, good: COL.good, dim: COL.dim, rel: COL.rel, prep: COL.prep };
  const PUNCT = /^[.,;?!]$/;
  const tokW = (g, tk, size) => tk.r === 'blank' ? Math.max(size * 2.8, tk.t ? tw(g, tk.t, size, 700) + size * 0.7 : 0) :
    tk.r === 'ans' ? tw(g, tk.t, size, 700) + size * 0.5 : tk.r === 'prep' ? tw(g, tk.t, size, 600) + size * 0.44 : tw(g, tk.t, size, FR[tk.r] || tk.r === 'trap' || tk.r === 'rel' ? 600 : 500);
  // 한 줄(또는 maxW를 넘으면 여러 줄)로 배치. o: { x, y, size, align: 'left' | 'center', maxW, lh }
  function lay(g, toks, o) {
    const size = o.size || 34, sp = size * 0.3, maxW = o.maxW || 1e9, lh = o.lh || size * 1.65;
    const lines = [[]]; let x = 0;
    toks.forEach(tk => {
      const punct = PUNCT.test(tk.t) && tk.r !== 'blank', w = punct ? tw(g, tk.t, size, 500) : tokW(g, tk, size);
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
  // 문자열 → 토큰 (띄어쓰기로 자르고 마침표·쉼표는 따로). roles: { '글자': 역할 }, ___는 빈칸, are_considering처럼 _로 이은 말은 한 조각
  function toks(s, roles = {}, pre = 't') {
    const out = [];
    s.split(' ').forEach(w => {
      const m = w.match(/^(.*?)([.,;?!]?)$/);
      const t = m[1].replace(/_/g, ' ');
      if (m[1]) out.push({ id: pre + out.length, t: m[1] === '___' ? '' : t, r: m[1] === '___' ? 'blank' : roles[t] || '' });
      if (m[2]) out.push({ id: pre + out.length, t: m[2], r: '' });
    });
    return out;
  }
  const byText = (L, t) => L.items.find(i => i.t === t);
  const blankOf = L => L.items.find(i => i.r === 'blank' || i.r === 'ans');
  // 이어진 낱말 묶음 찾기 → { x, y, w, size }
  function seq(L, words) {
    const ws = words.split(' ');
    for (let i = 0; i < L.items.length; i++) {
      // 한 조각에 여러 낱말이 든 경우(are considering)도 찾음
      let k = i, j = 0;
      while (k < L.items.length && j < ws.length) {
        const parts = L.items[k].t.split(' ');
        if (parts.every((p, q) => ws[j + q] === p)) { j += parts.length; k++; } else break;
      }
      if (j === ws.length) { const a = L.items[i], b = L.items[k - 1]; return { x: a.x, y: a.y, w: b.x + b.w - a.x, size: a.size }; }
    }
    return null;
  }
  // 묶음 표시: 옅은 칠 + 아래 꺾쇠 + 이름표
  function gbox(g, b, color, label, o = {}) {
    if (!b) return;
    const pad = o.pad == null ? 3 : o.pad, top = b.y - b.size * 0.62, bot = b.y + b.size * 0.8;
    fade(g, o.a == null ? 1 : o.a, () => {
      rr(g, b.x - pad, top, b.w + pad * 2, bot - top, 6); g.fillStyle = hexA(color, 0.11); g.fill();
      g.strokeStyle = color; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(b.x - pad, bot - 7); g.lineTo(b.x - pad, bot); g.lineTo(b.x + b.w + pad, bot); g.lineTo(b.x + b.w + pad, bot - 7); g.stroke();
      if (label) txt(g, label, b.x + b.w / 2, bot + 13, { size: o.lsize || 14, weight: 700, color, align: 'center' });
    });
  }
  // 진짜 동사 표시: 묶음 위에 시계
  function finBadge(g, b, a = 1, color = COL.fin) { if (b) fade(g, a, () => clock(g, b.x + b.w / 2, b.y - b.size * 0.98, 9, color)); }
  // 토큰 하나 그리기. o: { a: 투명도, r: 역할 바꾸기, color, textColor, cue: 단서 상자, glow: 빈칸 반짝임, strike: 빨간 줄, plain: 밑줄 없이 }
  function drawTok(g, it, o = {}) {
    const r = o.r != null ? o.r : it.r, size = it.size, x = it.x, y = it.y, w = it.w;
    g.save(); g.globalAlpha *= o.a == null ? 1 : o.a;
    if (g.globalAlpha <= 0.002) { g.restore(); return; }
    if (r === 'blank') {
      const h = size * 1.12;
      rr(g, x, y - h / 2, w, h, 8);
      g.fillStyle = `rgba(255,122,168,${0.08 + 0.12 * (o.glow || 0)})`; g.fill();
      g.setLineDash([6, 5]); g.strokeStyle = o.color || COL.gap; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]);
      if (it.t) txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: o.textColor || COL.rel, align: 'center' });
    } else if (r === 'ans') {
      const h = size * 1.22;
      rr(g, x, y - h / 2, w, h, 9);
      g.fillStyle = 'rgba(255,193,94,0.16)'; g.fill(); g.strokeStyle = COL.rel; g.lineWidth = 2; g.stroke();
      txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: COL.rel, align: 'center' });
    } else {
      const c = o.color || FC[r] || RCOL[r] || COL.text, bold = FR[r] || r === 'prep' || r === 'trap' || r === 'rel';
      if (r === 'prep') {
        rr(g, x, y - size * 0.58, w, size * 1.16, 7); g.fillStyle = hexA(COL.prep, 0.12); g.fill(); g.strokeStyle = hexA(COL.prep, 0.75); g.lineWidth = 1.5; g.stroke();
        txt(g, it.t, x + w / 2, y + 1, { size, weight: 600, color: c, align: 'center' });
      } else txt(g, it.t, x, y + 1, { size, weight: bold ? 600 : 500, color: c });
      if (FR[r] && !o.plain) { g.fillStyle = c; g.fillRect(x, y + size * 0.56, w, 3); }
    }
    if (o.strike || r === 'bad') { g.strokeStyle = COL.bad; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 4, y + 2); g.lineTo(x + w + 4, y + 2); g.stroke(); }
    if (o.cue) { rr(g, x - 5, y - size * 0.68, w + 10, size * 1.36, 8); g.strokeStyle = COL.fin; g.lineWidth = 2.2; g.stroke(); }
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
  const fillBlank = (T, w, f) => T.map(t => t.r === 'blank' ? Object.assign({}, t, { t: w, k: f }) : t);
  const blankStyle = (tk, glow) => tk.r === 'blank' ? (tk.t ? { color: FC[tk.k] || COL.rel, textColor: FC[tk.k] || COL.rel } : { glow }) : {};
  // 영상 속 판정이 규칙 엔진과 다르면 한 번만 경고
  const WARNED = new Set();
  function judged(o, slot, expectOk) {
    const j = IG.judge(o, slot);
    if (expectOk != null && (j.s === 'ok') !== expectOk && !WARNED.has(o.w)) { WARNED.add(o.w); console.warn('[동사 자리] 영상 속 판정이 규칙 엔진과 달라요:', o.w); }
    return j;
  }
  // 보기 하나를 빈칸에 넣어 보는 목록 (✓/×는 규칙 엔진, 모양 이름표, 짧은 까닭). items: [보기, 모양, 동사, 짧은 까닭('' = 맞음)]
  function tryList(g, items, slot, x, y, u, at, o = {}) {
    items.forEach(([w, f, v, why], k) => {
      const a = ramp(u, at + k * (o.step || 0.9), 0.4), yy = y + k * (o.gap || 46);
      fade(g, a, () => {
        const ok = judged({ w, f, v }, slot, !why).s === 'ok';
        mark(g, ok, x + 10, yy, 16);
        const ww = txt(g, w, x + 36, yy, { size: o.size || 24, weight: 700, color: ok ? FC[f] : COL.muted });
        if (!ok) { g.strokeStyle = COL.bad; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 32, yy + 1); g.lineTo(x + 40 + ww, yy + 1); g.stroke(); }
        const tg = formTag(g, f, x + 52 + ww, yy, { size: 13, align: 'left' });
        if (why) txt(g, why, tg.x + tg.w + 12, yy, { size: o.wsize || 15, weight: 500, color: COL.muted });
      });
    });
  }

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '토익 Part 5의 단골', d: 24, caps: [
      [0.4, 5, '토익 Part 5의 단골, **동사 모양** 문제예요. 보기 네 개가 모두 같은 동사예요.'],
      [5, 10, '보기를 보세요. open, to open, opening, opened → 모두 같은 동사가 모양만 바꾼 말이에요.'],
      [10, 14.5, '뜻은 모두 ‘열다’인데, 빈칸에 들어갈 수 있는 모양은 하나뿐이에요.'],
      [14.5, 19, '열쇠는 문장에 이미 있는 **진짜 동사**와 빈칸 바로 **앞** 낱말이에요. 정답은 영상 끝에서 풀어요.'],
      [19, 24, '진짜 동사 하나의 원칙, 앞 낱말이 고르는 모양, 그리고 **3단계 풀이법**을 차례로 배워요.'],
    ] },
    { id: 'one', n: '01', title: '진짜 동사는 하나', sub: '한 문장, 시제 하나', d: 34, caps: [
      [0.4, 6, '한국어부터 볼까요? 새 지점을 여는 것을 검토하고 있어요. 동사가 둘이에요. 열다, 검토하다.'],
      [6, 12, '그런데 시제를 나타내는 건 끝의 ‘검토하고 있어요’뿐이에요. ‘여는 것을’은 모양을 바꿔 붙은 말이죠.'],
      [12, 18, '영어도 같아요. We are considering opening a new branch. 시제를 가진 **진짜 동사**는 are considering 하나예요.'],
      [18, 24, '동사가 -ing(잉) 꼴로 모양을 바꾼 말 → opening. to부정사 → to open. 이런 말에는 시제가 없어요.'],
      [24, 29, '모양을 그대로 두면 → We are considering open … 진짜 동사가 둘이 돼요. 접속사가 없으니 틀려요.'],
      [29, 34, '그래서 **한 문장에 진짜 동사는 하나**. 나머지 동사는 옷을 갈아입어요 → to부정사, 또는 -ing(잉) 꼴.'],
    ] },
    { id: 'slot', n: '02', title: '동사 자리가 비었다면', sub: '-ing · to는 진짜 동사가 아니다', d: 30, caps: [
      [0.4, 6, '반대로 문장에 진짜 동사가 없다면? 그때는 빈칸이 바로 **진짜 동사 자리**예요.'],
      [6, 12, 'Our team ___ a campaign last month. 주어 다음이 빈칸이고, 문장에 다른 동사가 없어요.'],
      [12, 17, '들어갈 수 있는 건 시제가 있는 진짜 동사 → launched. launching, to launch → 시제가 없어 진짜 동사가 못 돼요.'],
      [17, 23, '조동사 뒤와 Please 뒤에는 **동사원형**이 와요. Visitors must register at the front desk.'],
      [23, 30, 'Please ___ the attached form. 정답 → complete. completing, to complete, completion → 모두 오답이에요.'],
    ] },
    { id: 'two', n: '03', title: '진짜 동사가 둘이면', sub: '접속사 없이 동사 둘은 틀림', d: 32, caps: [
      [0.4, 6, '진짜 동사가 둘이면 어떻게 될까요? Staff attend the seminar will receive a manual.'],
      [6, 12, 'attend, will receive → 시제를 가진 동사가 둘이에요. 이어 주는 접속사가 없으니 틀린 문장이에요.'],
      [12, 18, '고치는 방법은 둘이에요. who 같은 연결어를 넣어 두 문장을 잇거나, 동사 하나의 모양을 바꿔요.'],
      [18, 25, 'Staff attending the seminar → 세미나에 참석하는 직원. 한국어 ‘-는’처럼 -ing(잉) 꼴이 앞 명사를 꾸며요.'],
      [25, 32, '목적을 말할 때는 to부정사. To meet the deadline, the team worked overtime. 마감을 맞추려고.'],
    ] },
    { id: 'trans', n: '04', title: '바로 잡나, 전치사와 잡나', sub: '타동사 · 자동사', d: 34, caps: [
      [0.4, 6, '동사 뒤도 봐야 해요. 어떤 동사는 목적어를 **바로** 잡고, 어떤 동사는 **전치사**가 있어야 잡아요.'],
      [6, 12, '한국어로는 ‘문제에 대해 논의하다’예요. 그래서 ‘~에 대해’를 옮겨 쓰기 쉬워요 → discuss about the issue.'],
      [12, 18, '하지만 discuss → 목적어를 바로 잡는 동사예요. discuss the issue. 전치사를 넣으면 틀려요.'],
      [18, 24, '‘회의에 참석하다’도 마찬가지예요 → attend the meeting. 한국어의 ‘-에’를 옮기지 마세요.'],
      [24, 29, '반대로 전치사가 꼭 있어야 하는 동사도 있어요. respond to, reply to, comply with, participate in.'],
      [29, 34, '이름도 알아 두세요. 목적어를 바로 잡으면 **타동사**(transitive), 전치사가 필요하면 **자동사**(intransitive).'],
    ] },
    { id: 'choose', n: '05', title: '앞 동사가 고른다', sub: 'to부정사냐 -ing 꼴이냐', d: 34, caps: [
      [0.4, 6, '진짜 동사 뒤에 동사가 하나 더 올 때, 그 모양은 **앞 동사**가 골라요.'],
      [6, 12, 'decide, plan, agree, hope, expect → 뒤에 to부정사. decided to open.'],
      [12, 18, 'consider, avoid, suggest, recommend, finish → 뒤에 -ing(잉) 꼴. considering opening.'],
      [18, 24, '대체로 to부정사는 **앞으로** 할 일을, -ing(잉) 꼴은 이미 떠올리거나 하고 있는 일을 가리켜요.'],
      [24, 29, '하지만 이건 경향일 뿐이에요. suggest, postpone → 앞으로의 일인데도 -ing(잉) 꼴을 써요.'],
      [29, 34, '그래서 자주 쓰는 동사는 짝으로 외워 두세요. decide to, consider -ing(잉).'],
    ] },
    { id: 'toprep', n: '06', title: '이 to는 전치사', sub: 'to 다음 -ing 꼴', d: 30, caps: [
      [0.4, 6, 'to 뒤에는 늘 동사원형이 올까요? 아니에요. 어떤 표현에서는 to → **전치사**예요.'],
      [6, 12, 'We look forward to ___ you. 정답 → meeting. to 다음이라고 원형을 고르면 틀려요.'],
      [12, 18, '가려내는 방법이 있어요. to 뒤에 명사를 넣어 보세요 → look forward to the meeting. 말이 되죠?'],
      [18, 24, '명사가 들어가면 전치사예요. 전치사 뒤에 동사가 오면 **-ing(잉) 꼴**로 바꿔요.'],
      [24, 30, 'hope 뒤에 명사를 넣으면 → hope to the meeting. 말이 안 되죠. 그래서 hope to meet, to부정사예요.'],
    ] },
    { id: 'adjn', n: '07', title: '형용사 · 명사 뒤의 to', sub: 'eligible to · the ability to', d: 28, caps: [
      [0.4, 6, '형용사와 명사도 뒤에 올 동사의 모양을 골라요. 토익에 자주 나오는 짝은 **to부정사**예요.'],
      [6, 12, 'be eligible to apply, be able to attend, be likely to increase, be willing to help.'],
      [12, 17.5, 'Full-time staff are eligible ___ for the program. 지원할 자격이 있다 → to apply.'],
      [17.5, 23, '명사도 같아요. the ability to share files, an effort to reduce costs, the opportunity to work abroad.'],
      [23, 28, '함정 하나. eligible for 뒤에는 명사, eligible to 뒤에는 동사원형. 빈칸 뒤를 꼭 확인해요.'],
    ] },
    { id: 'obj', n: '08', title: '목적어 다음의 동사', sub: '목적어 + to부정사 · 목적어 + 원형', d: 30, caps: [
      [0.4, 6, '동사 뒤에 목적어가 오고, 이어서 그 목적어가 할 일이 올 때도 있어요.'],
      [6, 12, 'We encourage employees to attend the session. 직원들에게 참석을 권해요. 목적어 다음에 to부정사.'],
      [12, 18, '같은 모양 → ask, allow, require, enable, remind, advise. 목적어 다음에 to부정사.'],
      [18, 24, '그런데 make, have, let → 목적어 다음에 to 없이 **동사원형**을 써요. Please let us know.'],
      [24, 30, '수동태가 되면 목적어가 주어 자리로 가고, to부정사는 그대로 남아요. Employees are encouraged to attend.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: '진짜 동사 → 앞 → 뒤', d: 30, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11, '① **진짜 동사**를 세요. 없으면 빈칸이 진짜 동사 자리, 이미 있으면 빈칸은 진짜 동사가 아닌 자리예요.'],
      [11, 18, '② 빈칸 **앞**을 봐요. 앞 낱말이 동사인지, 전치사인지, 형용사인지, 목적어인지에 따라 모양이 정해져요.'],
      [18, 24, '③ 빈칸 **뒤**를 확인해요. 목적어가 바로 오는지, 전치사가 붙는지 보고 남은 보기를 골라요.'],
      [24, 30, '이 순서로 토익 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '처음 본 문제예요. ① 진짜 동사 → are considering. opened, 그리고 모양을 바꾸지 않은 open → 둘 다 지워요.'],
      [6, 12, '② 빈칸 앞 → considering. consider → 뒤에 -ing(잉) 꼴을 고르는 동사예요. 그래서 to부정사 → 지워요.'],
      [12, 18, '③ 빈칸 뒤 → 목적어 a new branch. 남은 opening → 목적어를 바로 잡아요. 정답은 (C).'],
      [18.4, 24.5, '두 번째 문제. ① Please 뒤에 동사가 비었어요. 보기가 모두 동사원형이라 지울 게 없어요.'],
      [24.5, 31, '② Please 뒤 → 동사원형. 여기서도 못 줄여요. 이럴 땐 ③ 빈칸 **뒤**가 답을 정해요.'],
      [31, 37, '빈칸 뒤에 전치사 to. 짝인 전치사가 to인 동사 → respond. 나머지 셋은 목적어를 바로 잡아요. 정답은 (B).'],
      [37.4, 43.5, '세 번째. ① 진짜 동사 → look. 이미 있으니 worked, works → 지워요.'],
      [43.5, 50, '② 빈칸 앞 → look forward to. to 뒤에 명사를 넣어 보면 → the meeting. 말이 되니 전치사예요.'],
      [50, 56, '전치사 뒤의 동사 → -ing(잉) 꼴. 동사원형은 함정이에요. 정답은 (D) working.'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 동사 모양 표', d: 22, caps: [
      [0.4, 6, '정리해요. 동사 모양 문제는 먼저 문장의 **진짜 동사**를 세요.'],
      [6, 12, '진짜 동사가 없으면 빈칸이 진짜 동사, 있으면 빈칸은 to부정사나 -ing(잉) 꼴, 동사원형 자리예요.'],
      [12, 17, '모양은 빈칸 **앞** 낱말이 고르고, 목적어와 전치사는 빈칸 **뒤**에서 확인해요.'],
      [17, 22, '아래 동사 옷 입히기와 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  IV.CHAPTERS = CHAPTERS; IV.CAPTIONS = CAPTIONS; IV.END = END;
  IV.POSTER = CHAPTERS.find(c => c.id === 'one').t + 22;
  IV.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  IV.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(IG.DRILL)에서 세 개. 보기는 규칙 엔진이 틀렸다고 하는 단계(① · ② · ③)에서 지움
  const PRACTICE = [
    { k: 8, at: [0.4, 6, 12], lines: ['진짜 동사 are considering → opened · open ×', 'consider → -ing 꼴 → to open ×', '목적어 a new branch → (C) opening'] },
    { k: 6, at: [0.4, 6.1, 12.6], lines: ['Please 뒤 동사 자리 → 모두 원형, 그대로', 'Please → 동사원형, 못 줄임', '뒤에 to → respond to → (B) respond'] },
    { k: 10, at: [0.4, 6.1, 12.6], lines: ['진짜 동사 look → worked · works ×', 'look forward to → 전치사 → work ×', '전치사 뒤 -ing 꼴 → (D) working'] },
  ];
  PRACTICE.forEach(p => {
    const it = IG.DRILL[p.k];
    if (!p.lines[2].includes(`(${'ABCD'[it.a]})`)) console.warn('[동사 자리] 실전 문제 정답 표시가 데이터와 달라요:', it.q);
    it.opts.forEach((o, i) => { if (IG.isOk(IG.optOf(it, i), it.slot) !== (i === it.a)) console.warn('[동사 자리] 실전 문제가 규칙 엔진과 달라요:', it.q); });
  });

  /* ---------- 직접 해 보기 데이터 (app.js와 함께 씀) ---------- */
  // 01장: open의 네 모양
  const ONE = IG.DRILL[8];
  IV.ONE = [['ing', 'opening'], ['to', 'to open'], ['base', 'open'], ['fin', 'opened']];
  IV.oneJudge = f => { const o = IV.ONE.find(x => x[0] === f); return IG.judge({ w: o[1], f, v: 'open' }, ONE.slot); };
  // 03장: 동사 둘을 고치는 세 가지
  IV.FIX = {
    raw: { name: '그대로', text: 'Staff attend the seminar will receive a manual.', roles: { attend: 'fin', 'will receive': 'fin' }, fin: ['attend', 'will receive'], links: 0 },
    who: { name: '연결어 who 넣기', text: 'Staff who attend the seminar will receive a manual.', roles: { who: 'rel', attend: 'fin', 'will receive': 'fin' }, fin: ['attend', 'will receive'], links: 1 },
    ing: { name: '-ing 꼴로 바꾸기', text: 'Staff attending the seminar will receive a manual.', roles: { attending: 'ing', 'will receive': 'fin' }, fin: ['will receive'], links: 0 },
  };
  IV.fixOk = k => IG.clauseOk(IV.FIX[k].fin.length, IV.FIX[k].links);
  // 04장: 동사 + 전치사 조립
  IV.VT = [['discuss', 'the issue'], ['attend', 'the meeting'], ['contact', 'the client'], ['respond', 'the e-mail'], ['reply', 'the e-mail'], ['comply', 'the rules'], ['participate', 'the event']];
  IV.VTP = ['', 'about', 'to', 'with', 'in'];
  IV.vtTry = (v, p) => {
    const obj = (IV.VT.find(x => x[0] === v) || [])[1];
    return { text: `We will ${v}${p ? ' ' + p : ''} ${obj}.`, j: IG.judge({ w: v, f: 'base', v }, { eng: 'empty', gov: 'modal', at: 'will', obj: p || 'direct' }) };
  };
  // 05장: 동사 카드 (to 칸 · -ing 칸)
  IV.CARDS = { to: ['decide', 'plan', 'agree', 'hope', 'expect', 'aim', 'intend', 'refuse', 'offer'], ing: ['consider', 'avoid', 'suggest', 'recommend', 'finish', 'postpone', 'mind', 'enjoy', 'deny'] };
  Object.entries(IV.CARDS).forEach(([bin, vs]) => vs.forEach(v => { if (IG.VERB[v].take !== bin) console.warn('[동사 자리] 카드 칸이 사전과 달라요:', v); }));
  // 08장: 목적어 다음의 동사
  IV.VO = [['encourage', 'encouraged'], ['ask', 'asked'], ['allow', 'allowed'], ['require', 'required'], ['remind', 'reminded'], ['let', 'let'], ['make', 'made'], ['have', 'had']];
  IV.VOF = [['to', 'to submit'], ['base', 'submit'], ['ing', 'submitting']];
  IV.voTry = (v, f) => {
    const past = IV.VO.find(x => x[0] === v)[1], w = IV.VOF.find(x => x[0] === f)[1];
    return { text: `The manager ${past} the team ${w} the report.`, past, w, j: IG.judge({ w, f, v: 'submit' }, { eng: 'full', gov: 'vo', by: v, at: `${past} the team`, main: past, obj: 'direct' }) };
  };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o)); }
  // 한국어 조각 줄: [[글자, 역할]] → 역할 조각 위치를 돌려줌
  function koLine(g, parts, x, y, size, on) {
    const out = {};
    parts.forEach(([s, r]) => {
      const hl = r && on(r), c = hl ? (FC[r] || RCOL[r]) : COL.soft;
      const w = txt(g, s, x, y, { size, weight: hl ? 700 : 500, color: c });
      if (hl && r !== 'trap') { g.fillStyle = c; g.fillRect(x, y + size * 0.62, w, 2.5); }
      if (r) out[r] = { x, y, w, size };
      x += w;
    });
    return out;
  }

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(같은 동사 open의 네 모양) → 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '진짜 동사는 하나,', W / 2, 262, { size: 62, weight: 800, fam: FD, align: 'center' });
        txt(g, '나머지는 to와 -ing', W / 2, 344, { size: 62, weight: 800, fam: FD, align: 'center', color: COL.accent });
        txt(g, 'Finite Verbs · To-infinitives · Gerunds', W / 2, 412, { size: 24, weight: 500, color: COL.muted, align: 'center' });
      });
      ['fin', 'to', 'ing', 'base'].forEach((f, i) => {
        const a = ramp(u, 1.3 + i * 0.25, 0.4) * out1;
        fade(g, a, () => formTag(g, f, W / 2 - 255 + i * 170, 488 + (1 - a) * 10, { size: 19 }));
      });
      const it = IG.DRILL[8];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 18.2, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 160, 1000, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 180, 202, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const cueOn = u > 14.6;
        const L = lay(g, toks(it.q, cueOn ? { are: 'fin', considering: 'fin' } : {}), { x: 180, y: 282, size: 30, maxW: 930 });
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: cueOn ? 0.5 + 0.5 * Math.sin(u * 4) : 0 } : {});
        if (cueOn) {
          const F = seq(L, 'are considering'), C = byText(L, 'considering'), B = blankOf(L);
          fade(g, ramp(u, 14.6, 0.4), () => {
            clock(g, F.x + 10, F.y - 33, 9, COL.fin);
            txt(g, '진짜 동사', F.x + 24, F.y - 33, { size: 15, weight: 700, color: COL.fin });
          });
          arc(g, C.x + C.w * 0.7, C.y + 24, B.x + B.w / 2, B.y + 24, -30, COL.fin, ramp(u, 15.6, 0.8));
          fade(g, ramp(u, 16.2, 0.4), () => txt(g, '앞 낱말이 모양을 골라요', (C.x + C.w * 0.7 + B.x + B.w / 2) / 2, B.y + 66, { size: 15, weight: 700, color: COL.fin, align: 'center' }));
        }
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        const rw = tw(g, 'open', 30, 600);
        it.opts.forEach(([o], k) => {
          const ox = 200 + (k % 2) * 400, oy = 408 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            txt(g, o, ox + 64, oy, { size: 30, weight: 600 });
            const off = o.startsWith('to ') ? tw(g, 'to ', 30, 600) : 0;
            fade(g, ramp(u, 7.2 + k * 0.3, 0.4), () => { g.fillStyle = COL.rel; g.fillRect(ox + 64 + off, oy + 19, rw, 3); });
          });
        });
        fade(g, ramp(u, 8.2, 0.5), () => chip(g, '모두 동사 open', 1110, 408, { size: 17, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'right', h: 36 }));
        fade(g, ramp(u, 10.6, 0.5), () => chip(g, '들어갈 모양은 하나', 1110, 470, { size: 17, weight: 700, color: COL.gap, fill: COL.panel2, stroke: COL.gap, align: 'right', h: 36 }));
      });
      const steps = [['①', '진짜 동사는 하나', '시제를 가진 동사 = 한 문장에 하나'], ['②', '앞 낱말이 고른다', 'to부정사 · -ing 꼴 · 동사원형'], ['③', '3단계 풀이법', '진짜 동사 → 앞 → 뒤']];
      steps.forEach(([n, t1, t2], k) => {
        const a = ramp(u, 19.4 + k * 0.7, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 220, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 285 + (1 - a) * 16, { size: 34, weight: 700, color: COL.accent });
          txt(g, t1, x0 + 28, 345 + (1 - a) * 16, { size: 25, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 400 + (1 - a) * 16, { size: 18, weight: 500, color: COL.soft });
        });
      });
    },

    /* 01 진짜 동사는 하나: 한국어 ‘여는 것을 검토하고 있어요’ ↔ We are considering opening */
    one(g, u) {
      const F = S.form1, uu = F ? Math.max(u, 19) : u;
      // 한국어
      const KY = 206;
      let K = null;
      fade(g, ramp(uu, 0.4, 0.6), () => {
        label(g, '한국어', LX, KY, { size: 17, color: COL.muted });
        K = koLine(g, [['우리는 새 지점을 '], ['여는 것을', 'ing'], [' '], ['검토하고 있어요', 'fin'], ['.']], LX + 100, KY, 30, () => uu > 6);
        fade(g, ramp(uu, 6.2, 0.5), () => {
          const a = K.fin, b = K.ing;
          clock(g, a.x + a.w / 2 - 50, KY - 38, 9, COL.fin);
          txt(g, '시제 → 진짜 동사', a.x + a.w / 2 - 34, KY - 38, { size: 15, weight: 700, color: COL.fin });
          txt(g, '모양을 바꿔 붙은 말', b.x + b.w / 2, KY - 38, { size: 15, weight: 700, color: COL.ing, align: 'center' });
        });
      });
      // 영어
      const EY = 360;
      const form = F || (u >= 24.2 && u < 29 ? 'base' : 'ing');
      const word = { ing: 'opening', to: 'to_open', base: 'open', fin: 'opened' }[form];
      const colorOn = uu > 18.2;
      const mk = w => toks(`We are_considering ${w} a new branch.`, { 'are considering': 'fin', opening: colorOn ? 'ing' : '', 'to open': 'to', open: 'fin', opened: 'fin' }, 'e');
      const L = lay(g, mk(word), { x: LX + 100, y: EY, size: 38 });
      const L0 = lay(g, mk('opening'), { x: LX + 100, y: EY, size: 38 });
      const mp = F ? 1 : u < 24.2 ? 0 : u < 29 ? clamp((u - 24.2) / 0.8) : 1 - clamp((u - 29.2) / 0.8);
      fade(g, ramp(uu, 12.2, 0.6), () => {
        label(g, '영어', LX, EY, { size: 17, color: COL.muted });
        if (F) drawLay(g, L, tk => tk.t === 'open' ? { color: COL.bad } : {});
        else if (mp <= 0) drawLay(g, L0);
        else morph(g, L0, lay(g, mk('open'), { x: LX + 100, y: EY, size: 38 }), mp, { style: tk => tk.t === 'open' ? { color: COL.bad } : {} });
        const Fv = seq(L0, 'are considering');
        finBadge(g, Fv, ramp(uu, 12.8, 0.4));
        fade(g, ramp(uu, 13.4, 0.4), () => txt(g, '진짜 동사 · 시제 있음', Fv.x + Fv.w / 2, EY + 48, { size: 15, weight: 700, color: COL.fin, align: 'center' }));
        sayLay(L, `We are considering ${word.replace('_', ' ')} a new branch.`);
        // 바뀐 낱말 표시
        const V = L.items[2];
        const isBad = form === 'base' || form === 'fin';
        if (!F && mp > 0.5) finBadge(g, V, ramp(u, 24.8, 0.4), COL.bad);
        if (F && isBad) finBadge(g, V, 1, COL.bad);
        if (!isBad && uu > 18.2) fade(g, ramp(uu, 18.4, 0.5) * (F ? 1 : 1 - clamp(mp * 2)), () => txt(g, F === 'to' ? 'to부정사 · 시제 없음' : '-ing 꼴 · 시제 없음', V.x + V.w / 2, EY + 48, { size: 15, weight: 700, color: FC[form], align: 'center' }));
        // 진짜 동사 세기
        const n = isBad ? 2 : 1;
        const cnt = F ? n : uu < 24.2 || mp < 0.5 ? 1 : 2;
        fade(g, ramp(uu, 13.2, 0.5), () => counter(g, cnt, 1200, EY, { align: 'right' }));
        if (F) {
          const j = IV.oneJudge(F);
          fade(g, 1, () => txt(g, (j.s === 'ok' ? '맞아요. ' : '틀려요. ') + j.why, LX + 100, EY + 96, { size: 17, weight: 700, color: j.s === 'ok' ? COL.good : COL.trap }));
        } else fade(g, ramp(u, 25, 0.5) * clamp(mp * 2 - 1), () => txt(g, '접속사 없이 진짜 동사가 둘 → 틀린 문장', LX + 100, EY + 96, { size: 18, weight: 700, color: COL.trap }));
      });
      // 한국어 ↔ 영어 이어 주는 점선 (말 순서가 달라요)
      fade(g, ramp(uu, 18.6, 0.6) * (F ? 0 : 1 - clamp(mp * 3)), () => {
        if (!K) return;
        const Fv = seq(L0, 'are considering'), O = L0.items[2];
        g.save(); g.setLineDash([5, 5]); g.lineWidth = 1.8;
        g.strokeStyle = hexA(COL.fin, 0.8); g.beginPath(); g.moveTo(K.fin.x + K.fin.w / 2, KY + 28); g.lineTo(Fv.x + Fv.w / 2, EY - 58); g.stroke();
        g.strokeStyle = hexA(COL.ing, 0.8); g.beginPath(); g.moveTo(K.ing.x + K.ing.w / 2, KY + 28); g.lineTo(O.x + O.w / 2, EY - 34); g.stroke();
        fade(g, ramp(uu, 19.4, 0.5), () => txt(g, '말 순서가 달라도 하는 일은 같아요', 1196, (KY + EY) / 2 - 6, { size: 15, weight: 600, color: COL.muted, align: 'right' }));
        g.restore();
      });
      // 규칙
      fade(g, ramp(u, 29.4, 0.6) * (F ? 0 : 1), () => {
        panel(g, LX - 10, 470, 1140, 100, { fill: COL.panel2, stroke: COL.fin });
        clock(g, LX + 26, 498, 10, COL.fin);
        txt(g, '한 문장 = 진짜 동사(시제를 가진 동사) 하나', LX + 48, 498, { size: 22, weight: 700, color: COL.fin });
        let x = LX + 48;
        x += txt(g, '나머지 동사는 옷을 갈아입어요 → ', x, 542, { size: 19, weight: 600, color: COL.soft });
        x += formTag(g, 'to', x, 542, { size: 16, align: 'left', label: 'to open' }).w + 10;
        x += formTag(g, 'ing', x, 542, { size: 16, align: 'left', label: 'opening' }).w + 16;
        txt(g, '(접속사가 있으면 진짜 동사를 더 쓸 수 있어요)', x, 542, { size: 15, weight: 500, color: COL.muted });
      });
    },

    /* 02 동사 자리가 비었다면: 주어 + ___ → 진짜 동사 / 조동사 · Please + ___ → 동사원형 */
    slot(g, u) {
      // 왼쪽: 주어 + ___
      fade(g, ramp(u, 0.6, 0.6), () => {
        panel(g, 70, 150, 550, 415, { fill: COL.panel, stroke: COL.faint });
        txt(g, '주어 + ___ → 진짜 동사', 94, 180, { size: 19, weight: 700, color: COL.fin });
      });
      const slotA = { eng: 'empty', gov: 'subj', obj: 'direct' }, fA = u > 15.6;
      const TA = toks('Our team ___ a campaign last month.', {}, 'a');
      const LA = lay(g, fA ? fillBlank(TA, 'launched', 'fin') : TA, { x: 96, y: 236, size: 24, maxW: 515 });
      fade(g, ramp(u, 6.2, 0.6), () => {
        drawLay(g, LA, tk => blankStyle(tk, 0.5 + 0.5 * Math.sin(u * 4)));
        if (fA) finBadge(g, blankOf(LA), ramp(u, 15.6, 0.4));
        sayLay(LA, 'Our team launched a campaign last month.');
        counter(g, fA ? 1 : 0, 96, 292, { ok: fA, text: fA ? '진짜 동사 1개' : '진짜 동사 0개 → 빈칸이 진짜 동사' });
      });
      tryList(g, [['launching', 'ing', 'launch', '시제가 없어요'], ['to launch', 'to', 'launch', '시제가 없어요'], ['launched', 'fin', 'launch', '']], slotA, 96, 360, u, 12.2, { step: 1.1, gap: 50, size: 23 });
      fade(g, ramp(u, 15.8, 0.5), () => txt(g, '-ing 꼴 · to부정사 → 진짜 동사가 못 돼요', 96, 528, { size: 17, weight: 700, color: COL.trap }));
      // 오른쪽: 조동사 · Please + ___ → 동사원형
      fade(g, ramp(u, 17.2, 0.6), () => {
        panel(g, 660, 150, 550, 415, { fill: COL.panel, stroke: COL.faint });
        txt(g, '조동사 · Please + ___ → 동사원형', 684, 180, { size: 19, weight: 700, color: COL.base });
        let x = 684;
        ['will', 'must', 'can', 'should', 'Please'].forEach(w => { x += chip(g, w, x, 222, { size: 15, weight: 700, color: COL.fin, fill: COL.panel2, stroke: COL.fin, h: 30, r: 8, pad: 10 }).w + 8; });
        const LR = lay(g, toks('Visitors must register at the front desk.', { must: 'fin', register: 'base' }, 'r'), { x: 686, y: 276, size: 22, maxW: 510 });
        drawLay(g, LR); sayLay(LR, 'Visitors must register at the front desk.');
        gbox(g, seq(LR, 'must register'), COL.fin, '조동사 + 원형 = 진짜 동사 하나', { a: ramp(u, 18.6, 0.5), lsize: 13 });
      });
      const slotB = { eng: 'empty', gov: 'please', at: 'Please', obj: 'direct' }, fB = u > 27.6;
      const TB = toks('Please ___ the attached form.', { Please: 'fin' }, 'b');
      const LB = lay(g, fB ? fillBlank(TB, 'complete', 'base') : TB, { x: 686, y: 352, size: 26 });
      fade(g, ramp(u, 23.2, 0.6), () => {
        drawLay(g, LB, tk => tk.t === 'Please' ? { r: '', cue: true } : blankStyle(tk, 0.5 + 0.5 * Math.sin(u * 4)));
        sayLay(LB, 'Please complete the attached form.');
      });
      tryList(g, [['completing', 'ing', 'complete', '시제가 없어요'], ['to complete', 'to', 'complete', '시제가 없어요'], ['completion', 'n', 'complete', '명사'], ['complete', 'base', 'complete', '']], slotB, 686, 404, u, 24, { step: 0.9, gap: 42, size: 22 });
    },

    /* 03 진짜 동사가 둘이면: 연결어로 잇기 · -ing 꼴로 바꾸기 · 목적의 to부정사 */
    two(g, u) {
      const F = S.fix, uu = F ? Math.max(u, 19) : u;
      const top = F ? IV.FIX[F] : IV.FIX.raw;
      const T0 = toks(top.text.replace('will receive', 'will_receive'), top.roles, 'w');
      const L0 = lay(g, T0, { x: W / 2, y: 206, size: 30, align: 'center' });
      fade(g, ramp(u, 0.4, 0.6), () => {
        drawLay(g, L0);
        sayLay(L0, top.text);
        top.fin.forEach(w => finBadge(g, seq(L0, w), F ? 1 : ramp(u, 6.2, 0.4), F === 'who' || F === 'ing' ? COL.fin : COL.bad));
        const ok = IG.clauseOk(top.fin.length, top.links);
        fade(g, F ? 1 : ramp(u, 7, 0.5), () => counter(g, top.fin.length, W / 2, 266, { align: 'center', ok, text: `진짜 동사 ${top.fin.length}개 · 연결어 ${top.links}개` }));
        if (!F) fade(g, ramp(u, 8, 0.5), () => txt(g, '진짜 동사 둘을 이을 접속사가 없어요', W / 2, 310, { size: 17, weight: 700, color: COL.trap, align: 'center' }));
      });
      // 고치는 두 방법
      const rows = [['who', '연결어 넣기', 'Staff who attend the seminar will receive a manual.', 12.4], ['ing', '모양 바꾸기', 'Staff attending the seminar will receive a manual.', 13.6]];
      rows.forEach(([k, tag, s, at], i) => {
        const y = 358 + i * 62, on = !F || F === k;
        fade(g, ramp(uu, at, 0.6) * (on ? 1 : 0.35), () => {
          chip(g, tag, LX, y, { size: 15, weight: 700, color: COL.soft, fill: COL.panel2, stroke: COL.faint, h: 32, r: 8, pad: 10 });
          const L = lay(g, toks(s.replace('will receive', 'will_receive'), IV.FIX[k].roles, 'x' + i), { x: LX + 130, y, size: 24 });
          drawLay(g, L); sayLay(L, s);
          IV.FIX[k].fin.forEach(w => finBadge(g, seq(L, w), 1, COL.fin));
          counter(g, IV.FIX[k].fin.length, 1200, y, { align: 'right', size: 14, ok: IV.fixOk(k), text: k === 'who' ? '동사 2 · 연결어 1' : '동사 1' });
        });
      });
      // 한국어 ‘-는’ ↔ attending
      fade(g, ramp(uu, 18.6, 0.6) * (!F || F === 'ing' ? 1 : 0.3), () => {
        const y = 458;
        let x = LX + 130;
        x += txt(g, '세미나에 참석하', x, y, { size: 21, weight: 500, color: COL.soft });
        const w = txt(g, '는', x, y, { size: 21, weight: 800, color: COL.ing });
        g.fillStyle = COL.ing; g.fillRect(x, y + 13, w, 2.5);
        x += w + txt(g, ' 직원', x + w, y, { size: 21, weight: 500, color: COL.soft });
        txt(g, '← 한국어 ‘-는’처럼 -ing 꼴이 앞 명사를 꾸며요', x + 22, y, { size: 16, weight: 700, color: COL.ing });
      });
      // 목적의 to부정사
      fade(g, ramp(u, 25.2, 0.6) * (F ? 0 : 1), () => {
        panel(g, LX - 10, 494, 1140, 74, { fill: COL.panel2, stroke: COL.to });
        txt(g, '목적 → to부정사', LX + 12, 531, { size: 17, weight: 700, color: COL.to });
        const L = lay(g, toks('To_meet the deadline, the team worked overtime.', { 'To meet': 'to', worked: 'fin' }, 'p'), { x: LX + 172, y: 531, size: 23 });
        drawLay(g, L); sayLay(L, 'To meet the deadline, the team worked overtime.');
        txt(g, '마감을 맞추려고', L.x + L.w + 26, 531, { size: 17, weight: 600, color: COL.soft });
      });
    },

    /* 04 바로 잡나, 전치사와 잡나: discuss about × · attend the meeting · respond to */
    trans(g, u) {
      const KX = LX;
      // 논의하다
      fade(g, ramp(u, 6.2, 0.6), () => {
        label(g, '한국어', KX, 176, { size: 15 });
        koLine(g, [['문제'], ['에 대해', 'trap'], [' 논의하다']], KX + 70, 176, 24, () => true);
      });
      const strike = u > 12.4;
      const TA = toks('discuss about the issue', { discuss: 'base', about: 'trap' }, 'a');
      const LA = lay(g, TA, { x: KX + 70, y: 230, size: 28 });
      fade(g, ramp(u, 8.6, 0.6), () => {
        drawLay(g, LA, tk => tk.t === 'about' && strike ? { strike: true } : {});
        if (strike) fade(g, ramp(u, 12.4, 0.4), () => cross(g, LA.x + LA.w + 26, 230, 16, COL.bad));
      });
      const LB = lay(g, toks('discuss the issue', { discuss: 'base' }, 'b'), { x: KX + 70, y: 290, size: 28 });
      fade(g, ramp(u, 13.4, 0.6), () => {
        drawLay(g, LB); sayLay(LB, 'discuss the issue');
        const d = byText(LB, 'discuss'), o = seq(LB, 'the issue');
        arc(g, d.x + d.w / 2, 270, o.x + o.w / 2, 270, 24, COL.good, ramp(u, 14, 0.8), { dash: false });
        fade(g, ramp(u, 14.6, 0.4), () => { mark(g, true, LB.x + LB.w + 26, 290, 16); txt(g, '목적어를 바로', LB.x + LB.w + 48, 290, { size: 15, weight: 700, color: COL.good }); });
      });
      // 참석하다
      fade(g, ramp(u, 18.2, 0.6), () => {
        label(g, '한국어', KX, 372, { size: 15 });
        koLine(g, [['회의'], ['에', 'trap'], [' 참석하다']], KX + 70, 372, 24, () => true);
        const L = lay(g, toks('attend the meeting', { attend: 'base' }, 'c'), { x: KX + 70, y: 426, size: 28 });
        drawLay(g, L); sayLay(L, 'attend the meeting');
        mark(g, true, L.x + L.w + 26, 426, 16);
        txt(g, 'attend to · attend at ×', L.x + L.w + 48, 426, { size: 15, weight: 600, color: COL.muted });
      });
      // 오른쪽: 바로 잡는 동사 · 전치사가 꼭 필요한 동사
      fade(g, ramp(u, 1.0, 0.6), () => {
        panel(g, 650, 150, 560, 136, { fill: COL.panel, stroke: COL.faint });
        txt(g, '목적어를 바로 잡는 동사', 674, 176, { size: 16, weight: 700, color: COL.good });
        ['discuss', 'attend', 'contact', 'reach', 'enter', 'mention', 'approach', 'answer'].forEach((v, k) => {
          const x = 674 + (k % 4) * 130, y = 214 + Math.floor(k / 4) * 40;
          fade(g, ramp(u, 15 + k * 0.2, 0.3), () => { const w = txt(g, v, x, y, { size: 19, weight: 600, color: COL.base }); say(x - 4, y - 14, w + 8, 28, v); });
        });
      });
      fade(g, ramp(u, 1.6, 0.6), () => {
        panel(g, 650, 300, 560, 160, { fill: COL.panel, stroke: COL.faint });
        txt(g, '전치사가 꼭 있어야 하는 동사', 674, 326, { size: 16, weight: 700, color: COL.prep });
        [['respond', 'to'], ['reply', 'to'], ['comply', 'with'], ['participate', 'in'], ['listen', 'to'], ['apologize', 'for']].forEach(([v, p], k) => {
          const x = 674 + (k % 2) * 270, y = 366 + Math.floor(k / 2) * 38;
          fade(g, ramp(u, 24.4 + k * 0.4, 0.3), () => {
            const L = lay(g, toks(`${v} ${p}`, { [v]: 'base', [p]: 'prep' }, 'p' + k), { x, y, size: 19 });
            drawLay(g, L); sayLay(L, `${v} ${p}`);
          });
        });
      });
      // 아래: 용어 또는 직접 해 보기
      if (S.vt) {
        const r = IV.vtTry(S.vt.v, S.vt.p), ok = r.j.s === 'ok';
        panel(g, LX - 10, 482, 1140, 84, { fill: COL.panel2, stroke: ok ? COL.good : COL.bad });
        const L = lay(g, toks(r.text, { [S.vt.v]: 'base', [S.vt.p]: 'prep' }, 'u'), { x: LX + 14, y: 508, size: 24 });
        drawLay(g, L); sayLay(L, r.text); mark(g, ok, L.x + L.w + 24, 508, 16);
        txt(g, r.j.why, LX + 14, 546, { size: 16, weight: 600, color: ok ? COL.good : COL.trap });
      } else fade(g, ramp(u, 29.2, 0.6), () => {
        panel(g, LX - 10, 482, 1140, 84, { fill: COL.panel2, stroke: COL.faint });
        txt(g, '타동사', LX + 14, 510, { size: 20, weight: 800, color: COL.good });
        txt(g, 'transitive', LX + 14, 540, { size: 13, weight: 500, fam: FM, color: COL.muted });
        txt(g, '목적어를 바로 잡아요 → discuss the issue', LX + 110, 510, { size: 18, weight: 600, color: COL.soft });
        txt(g, '자동사', 640, 510, { size: 20, weight: 800, color: COL.prep });
        txt(g, 'intransitive', 640, 540, { size: 13, weight: 500, fam: FM, color: COL.muted });
        txt(g, '전치사 + 목적어 → respond to the e-mail', 736, 510, { size: 18, weight: 600, color: COL.soft });
      });
    },

    /* 05 앞 동사가 고른다: to 칸 · -ing 칸에 동사 카드 넣기 → 경향과 예외 */
    choose(g, u) {
      const pick = S.pick, uu = pick ? Math.max(u, 25) : u;
      const BIN = [['to', 70, 'to부정사를 고르는 동사', '앞으로 할 일 (계획 · 의도 · 약속)', 'The company decided to open a new branch.', 6.2],
        ['ing', 660, '-ing 꼴을 고르는 동사', '이미 떠올린 일 · 하던 일 · 피하는 일', 'We are considering opening a new branch.', 12.2]];
      BIN.forEach(([bin, x0, head, tend, ex, at]) => {
        fade(g, ramp(uu, 0.6, 0.6), () => {
          panel(g, x0, 150, 550, 318, { fill: COL.panel, stroke: FC[bin], lw: 1.6 });
          txt(g, head, x0 + 24, 178, { size: 18, weight: 700, color: FC[bin] });
        });
        IV.CARDS[bin].forEach((v, k) => {
          const a = ramp(uu, at + k * 0.42, 0.45), cx = x0 + 22 + (k % 3) * 174, cy = 214 + Math.floor(k / 3) * 56 - (1 - a) * 26;
          const isPick = pick === v, odd = ['suggest', 'postpone', 'recommend'].includes(v) && uu > 24.2 && !pick;
          fade(g, a * (pick && !isPick ? 0.4 : 1), () => {
            rr(g, cx, cy, 160, 44, 10); g.fillStyle = isPick ? hexA(COL.rel, 0.16) : COL.panel2; g.fill();
            g.strokeStyle = isPick ? COL.rel : odd ? COL.trap : hexA(FC[bin], 0.6); g.lineWidth = isPick || odd ? 2.4 : 1.4; g.stroke();
            txt(g, v, cx + 80, cy + 23, { size: 20, weight: 700, color: isPick ? COL.rel : FC[bin], align: 'center' });
            say(cx, cy, 160, 44, IG.VERB[v].ex);
          });
        });
        fade(g, ramp(uu, 18.4, 0.6), () => txt(g, tend, x0 + 24, 404, { size: 16, weight: 700, color: COL.soft }));
        fade(g, ramp(uu, at + 3.6, 0.6), () => {
          const L = lay(g, toks(ex, bin === 'to' ? { decided: 'fin', to: 'to', open: 'to' } : { are: 'fin', considering: 'fin', opening: 'ing' }, 'x' + bin), { x: x0 + 24, y: 440, size: 18 });
          drawLay(g, L, tk => FR[tk.r] ? { plain: true } : {}); sayLay(L, ex);
        });
      });
      // 경향일 뿐: suggest · postpone
      if (pick) {
        const V = IG.VERB[pick], bin = V.take;
        panel(g, LX - 10, 492, 1140, 72, { fill: COL.panel2, stroke: COL.rel });
        const w = txt(g, pick, LX + 14, 528, { size: 24, weight: 800, color: COL.rel });
        const tg = formTag(g, bin, LX + 30 + w, 528, { size: 14, align: 'left', label: '→ ' + IG.FORM[bin] });
        const L = lay(g, toks(V.ex, {}, 'k'), { x: tg.x + tg.w + 20, y: 528, size: 21 });
        drawLay(g, L); sayLay(L, V.ex);
        txt(g, V.ko, 1196, 528, { size: 16, weight: 600, color: COL.muted, align: 'right' });
      } else fade(g, ramp(u, 24.4, 0.6), () => {
        panel(g, LX - 10, 492, 1140, 72, { fill: COL.panel2, stroke: COL.trap });
        txt(g, '경향일 뿐', LX + 14, 528, { size: 18, weight: 800, color: COL.trap });
        txt(g, 'suggest · postpone · recommend → 앞으로의 일인데도 -ing 꼴', LX + 120, 528, { size: 19, weight: 600, color: COL.soft });
        fade(g, ramp(u, 29.4, 0.5), () => chip(g, '짝으로 외우기', 1196, 528, { size: 16, weight: 700, color: COL.rel, fill: COL.panel, stroke: COL.rel, align: 'right', h: 34, r: 9 }));
      });
    },

    /* 06 이 to는 전치사: look forward to meeting · 명사 넣어 보기 */
    toprep(g, u) {
      const E = S.expr ? IG.toExpr(S.expr) : null, uu = E ? Math.max(u, 26) : u;
      const slot = { eng: 'full', gov: 'prep', by: 'look forward to', at: 'look forward to', main: 'look' };
      const f = u > 8.2;
      const T = toks('We look forward to ___ you.', { look: 'fin' }, 'a');
      const L = lay(g, f ? fillBlank(T, 'meeting', 'ing') : T, { x: LX, y: 196, size: 32 });
      fade(g, ramp(u, 0.6, 0.6), () => {
        drawLay(g, L, tk => tk.t === 'to' ? { r: 'prep', cue: uu > 12.4 } : blankStyle(tk, 0.5 + 0.5 * Math.sin(u * 4)));
        sayLay(L, 'We look forward to meeting you.');
      });
      tryList(g, [['meet', 'base', 'meet', 'to 다음이라고 원형 ×'], ['meeting', 'ing', 'meet', '']], slot, 760, 176, u, 6.4, { step: 1.2, gap: 44, size: 23 });
      // 명사 넣어 보기 (전치사 to) · (to부정사 to)
      const box = (x, e, isPrep, at) => {
        fade(g, ramp(uu, at, 0.6), () => {
          panel(g, x, 262, 550, 196, { fill: COL.panel, stroke: isPrep ? COL.prep : COL.to, lw: 1.6 });
          txt(g, isPrep ? 'to 뒤에 명사 넣어 보기 → 말이 돼요' : 'to 뒤에 명사 넣어 보기 → 말이 안 돼요', x + 24, 290, { size: 16, weight: 700, color: isPrep ? COL.prep : COL.to });
          const L1 = lay(g, toks(e.noun, {}, 'n' + x), { x: x + 24, y: 336, size: 25 });
          drawLay(g, L1, tk => tk.t === 'to' ? { r: isPrep ? 'prep' : 'to', plain: true } : {});
          if (isPrep) sayLay(L1, e.noun);
          mark(g, isPrep, L1.x + L1.w + 24, 336, 16);
          txt(g, isPrep ? 'to = 전치사 → 동사는 -ing 꼴' : 'to = to부정사의 to → 동사원형', x + 24, 384, { size: 17, weight: 700, color: isPrep ? COL.ing : COL.base });
          const L2 = lay(g, toks(e.ex, {}, 'm' + x), { x: x + 24, y: 424, size: 19, maxW: 500 });
          drawLay(g, L2); sayLay(L2, e.ex);
        });
      };
      if (E) box(IG.isPrepTo(E.e) ? 70 : 660, E, IG.isPrepTo(E.e), 0);
      else { box(70, IG.PREP_TO[0], true, 12.4); box(660, IG.INF_TO[0], false, 24.4); }
      // 전치사 to + -ing 표현
      fade(g, ramp(uu, 18.4, 0.6), () => {
        panel(g, LX - 10, 474, 1140, 92, { fill: COL.panel2, stroke: COL.faint });
        txt(g, 'to 다음', LX + 12, 506, { size: 15, weight: 700, color: COL.muted });
        txt(g, '-ing 꼴', LX + 12, 534, { size: 17, weight: 800, color: COL.ing });
        IG.PREP_TO.forEach((x, k) => {
          const xx = LX + 110 + (k % 3) * 340, yy = 503 + Math.floor(k / 3) * 36;
          fade(g, ramp(uu, 18.6 + k * 0.3, 0.3), () => {
            const w = txt(g, x.e, xx, yy, { size: 18, weight: 600, color: COL.en });
            txt(g, '-ing', xx + w + 8, yy, { size: 18, weight: 700, color: COL.ing });
            say(xx - 4, yy - 13, w + 50, 26, x.ex);
          });
        });
      });
    },

    /* 07 형용사 · 명사 뒤의 to: be eligible to · the ability to · eligible for 함정 */
    adjn(g, u) {
      const ADJ = [['be eligible', 'to apply'], ['be able', 'to attend'], ['be likely', 'to increase'], ['be willing', 'to help'], ['be ready', 'to start']];
      const NN = [['the ability', 'to share files'], ['an effort', 'to reduce costs'], ['the opportunity', 'to work abroad'], ['the plan', 'to expand'], ['the decision', 'to merge']];
      const col = (x, head, rows, at, kind) => {
        fade(g, ramp(u, at, 0.6), () => txt(g, head, x, 172, { size: 17, weight: 700, color: COL.soft }));
        rows.forEach(([a, b], k) => fade(g, ramp(u, at + 0.4 + k * 0.5, 0.4), () => {
          const y = 212 + k * 38;
          const w = txt(g, a, x, y, { size: 21, weight: 700, color: kind === 'adj' ? COL.text : COL.text });
          const w2 = txt(g, b, x + w + 10, y, { size: 21, weight: 600, color: COL.to });
          g.fillStyle = COL.to; g.fillRect(x + w + 10, y + 13, tw(g, 'to', 21, 600), 2.5);
          say(x - 4, y - 14, w + w2 + 18, 28, `${a} ${b}`);
        }));
      };
      col(LX, '형용사 + to부정사', ADJ, 5.6, 'adj');
      col(660, '명사 + to부정사', NN, 17.4, 'n');
      // 예문
      const slot = IG.DRILL[12].slot, f = u > 14.8;
      const T = toks('Full-time staff are eligible ___ for the program.', { are: 'fin' }, 'e');
      const L = lay(g, f ? fillBlank(T, 'to apply', 'to') : T, { x: W / 2, y: 428, size: 28, align: 'center' });
      fade(g, ramp(u, 12.2, 0.6), () => {
        panel(g, LX - 10, 394, 1140, 70, { fill: COL.panel, stroke: COL.faint });
        drawLay(g, L, tk => tk.t === 'eligible' ? { cue: true } : blankStyle(tk, 0.5 + 0.5 * Math.sin(u * 4)));
        sayLay(L, 'Full-time staff are eligible to apply for the program.');
        if (f) judged({ w: 'to apply', f: 'to', v: 'apply' }, slot, true);
      });
      // 함정: eligible for + 명사 / eligible to + 원형
      fade(g, ramp(u, 23.2, 0.6), () => {
        panel(g, LX - 10, 480, 1140, 86, { fill: COL.panel2, stroke: COL.trap });
        txt(g, '함정', LX + 12, 523, { size: 18, weight: 800, color: COL.trap });
        const A = lay(g, toks('eligible for the program', { for: 'prep' }, 'f'), { x: LX + 90, y: 506, size: 21 });
        drawLay(g, A); sayLay(A, 'eligible for the program');
        txt(g, '← for 뒤 명사', A.x + A.w + 14, 506, { size: 15, weight: 700, color: COL.prep });
        const B = lay(g, toks('eligible to_apply for the program', { 'to apply': 'to', for: 'prep' }, 'g'), { x: LX + 90, y: 542, size: 21 });
        drawLay(g, B, tk => tk.r === 'prep' ? { plain: true } : {}); sayLay(B, 'eligible to apply for the program');
        txt(g, '← to 뒤 동사원형', B.x + B.w + 14, 542, { size: 15, weight: 700, color: COL.to });
      });
    },

    /* 08 목적어 다음의 동사: encourage + 목적어 + to부정사 · make · have · let + 목적어 + 원형 · 수동태 */
    obj(g, u) {
      const V = S.vo, uu = V ? Math.max(u, 30) : u;
      if (V) {
        const r = IV.voTry(V.v, V.f), ok = r.j.s === 'ok', f = V.f;
        const L = lay(g, toks(r.text.replace(r.w, r.w.replace(' ', '_')), { [r.past]: 'fin', [r.w]: f }, 'v'), { x: LX, y: 200, size: 30 });
        drawLay(g, L); sayLay(L, r.text);
        finBadge(g, seq(L, r.past), 1);
        mark(g, ok, L.x + L.w + 26, 200, 18);
        txt(g, (ok ? '맞아요. ' : '틀려요. ') + r.j.why, LX, 250, { size: 17, weight: 700, color: ok ? COL.good : COL.trap });
      } else {
        const f = u > 7.4;
        const T = toks('We encourage employees ___ the session.', { encourage: 'fin' }, 'a');
        const L = lay(g, f ? fillBlank(T, 'to attend', 'to') : T, { x: LX, y: 206, size: 30 });
        fade(g, ramp(u, 0.6, 0.6), () => {
          drawLay(g, L, tk => blankStyle(tk, 0.5 + 0.5 * Math.sin(u * 4)));
          sayLay(L, 'We encourage employees to attend the session.');
          const E = byText(L, 'encourage'), O = byText(L, 'employees'), B = blankOf(L);
          finBadge(g, E, ramp(u, 1.2, 0.4));
          gbox(g, { x: O.x, y: O.y, w: O.w, size: 30 }, COL.ing, '목적어', { a: ramp(u, 2, 0.5) });
          arc(g, O.x + O.w / 2, O.y - 24, B.x + B.w / 2, B.y - 24, 30, COL.to, ramp(u, 8.2, 0.8));
          fade(g, ramp(u, 8.8, 0.4), () => txt(g, '목적어가 할 일', (O.x + B.x + B.w) / 2 + 20, O.y - 66, { size: 15, weight: 700, color: COL.to, align: 'center' }));
          fade(g, ramp(u, 9.4, 0.4), () => txt(g, '직원들에게 참석을 권해요', L.x + L.w + 26, 206, { size: 17, weight: 600, color: COL.soft }));
        });
      }
      // 목적어 + to부정사 동사들
      fade(g, ramp(uu, 12.2, 0.6), () => {
        panel(g, LX - 10, 286, 1140, 84, { fill: COL.panel, stroke: COL.to });
        txt(g, '동사 + 목적어 + to부정사', LX + 12, 310, { size: 15, weight: 700, color: COL.to });
        let x = LX + 12;
        ['encourage', 'ask', 'allow', 'require', 'enable', 'remind', 'advise'].forEach((v, k) => fade(g, ramp(uu, 12.4 + k * 0.3, 0.3), () => {
          const c = chip(g, v, x, 344, { size: 18, weight: 700, color: COL.fin, fill: COL.panel2, stroke: hexA(COL.fin, 0.6), h: 34, r: 9, pad: 12 });
          say(c.x, c.y, c.w, c.h, IG.VERB[v].ex);
          x += c.w + 10;
        }));
      });
      // 사역동사 + 목적어 + 원형
      fade(g, ramp(uu, 18.2, 0.6), () => {
        panel(g, LX - 10, 384, 1140, 84, { fill: COL.panel, stroke: COL.base });
        txt(g, '사역동사 + 목적어 + 동사원형 (to 없이)', LX + 12, 408, { size: 15, weight: 700, color: COL.base });
        let x = LX + 12;
        ['make', 'have', 'let'].forEach(v => { const c = chip(g, v, x, 442, { size: 18, weight: 700, color: COL.fin, fill: COL.panel2, stroke: hexA(COL.fin, 0.6), h: 34, r: 9, pad: 12 }); say(c.x, c.y, c.w, c.h, IG.VERB[v].ex); x += c.w + 10; });
        const L = lay(g, toks('Please let us know.', { let: 'fin', know: 'base' }, 'k'), { x: x + 30, y: 442, size: 22 });
        drawLay(g, L); sayLay(L, 'Please let us know.');
        const L2 = lay(g, toks('Ms. Lee had the interns prepare the slides.', { had: 'fin', prepare: 'base' }, 'h'), { x: L.x + L.w + 36, y: 442, size: 22 });
        drawLay(g, L2); sayLay(L2, 'Ms. Lee had the interns prepare the slides.');
      });
      // 수동태: 목적어가 주어 자리로, to부정사는 그대로
      fade(g, ramp(uu, 24.2, 0.6), () => {
        panel(g, LX - 10, 482, 1140, 84, { fill: COL.panel2, stroke: COL.faint });
        txt(g, '수동태', LX + 12, 524, { size: 17, weight: 800, color: COL.soft });
        const A = lay(g, [{ id: 'w', t: 'We', r: '' }, { id: 'v', t: 'encourage', r: 'fin' }, { id: 'o', t: 'employees', r: '' }, { id: 't', t: 'to attend', r: 'to' }, { id: 'p', t: '.', r: '' }], { x: LX + 100, y: 524, size: 23 });
        const B = lay(g, [{ id: 'o', t: 'Employees', r: '' }, { id: 'v', t: 'are encouraged', r: 'fin' }, { id: 't', t: 'to attend', r: 'to' }, { id: 'p', t: '.', r: '' }], { x: LX + 100, y: 524, size: 23 });
        const mp = clamp((uu - 26.2) / 1.2);
        if (mp <= 0) drawLay(g, A); else morph(g, A, B, mp);
        sayLay(mp < 0.5 ? A : B, mp < 0.5 ? 'We encourage employees to attend.' : 'Employees are encouraged to attend.');
        fade(g, ramp(uu, 27.6, 0.4), () => txt(g, '목적어가 주어 자리로, to부정사는 그대로', 1196, 524, { size: 16, weight: 700, color: COL.to, align: 'right' }));
      });
    },

    /* 09 3단계 풀이법 흐름도 */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 진짜 동사를 센다', sub: '문장 전체', at: 5.6, boxes: [
          ['진짜 동사 0개', '빈칸 = 진짜 동사 (시제 · 원형)', 'none'], ['진짜 동사 1개', '빈칸 = to · -ing · 원형 자리', 'one']] },
        { x: 480, head: '② 앞을 본다', sub: '빈칸 앞 낱말', at: 11.2, boxes: [
          ['주어 · 조동사 · Please 뒤', '시제 · 동사원형', ['subj', 'modal'], 'fin'], ['주어 명사 뒤 (Staff ___ … will)', '-ing 꼴', ['noun'], 'ing'], ['decide · plan · hope', 'to부정사', ['vto'], 'to'],
          ['형용사 · 명사 (eligible · ability)', 'to부정사', ['adjn'], 'to'], ['ask · encourage + 목적어', 'to부정사', ['voto'], 'to'], ['consider · avoid · 전치사 뒤', '-ing 꼴', ['ving', 'prep'], 'ing'], ['make · have · let + 목적어', '동사원형', ['caus'], 'base']] },
        { x: 880, head: '③ 뒤를 확인한다', sub: '목적어 · 전치사', at: 18.2, boxes: [
          ['목적어가 바로 옴', '타동사 · -ing 꼴 (명사는 목적어 ×)', 'direct', 'base'], ['전치사가 붙음', '짝 자동사 (respond to · comply with)', 'prep', 'prep'], ['그 밖 (문장 끝 · 부사)', '목적어 검사 없음', 'other', 'n']] },
      ];
      const P = S.path || null, R = P && P.L && P.E ? IG.formFromCues(P.E, P.L) : null;
      cols.forEach((c, ci) => {
        fade(g, ramp(u, 0.8 + ci * 0.5, 0.6), () => {
          panel(g, c.x, 150, 340, 54, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 20, 177, { size: 21, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 320, 177, { size: 14, weight: 600, color: COL.muted, align: 'right' });
          if (ci < 2) arrow(g, c.x + 346, 177, c.x + 392, 177, COL.accent, 3);
        });
        fade(g, ramp(u, c.at, 0.6), () => {
          c.boxes.forEach(([k, v, key, f], bi) => {
            const hh = ci === 1 ? 44 : 62, gap = ci === 1 ? 6 : 12, y = 214 + bi * (hh + gap), at = c.at + 0.4 + bi * (ci === 1 ? 0.35 : 0.5);
            const on = P && (ci === 0 ? key === P.E : ci === 1 ? key.includes(P.L) : key === P.R);
            fade(g, ramp(u, at, 0.5) * (P && !on ? 0.4 : 1), () => {
              panel(g, c.x, y, 340, hh, { fill: on ? 'rgba(255,193,94,0.14)' : COL.panel, stroke: on ? COL.rel : COL.faint, lw: on ? 2.5 : 1.3 });
              if (ci === 1) {
                txt(g, k, c.x + 14, y + hh / 2, { size: 15, weight: 700, color: COL.soft });
                txt(g, v, c.x + 326, y + hh / 2, { size: 15, weight: 700, color: FC[f], align: 'right' });
              } else {
                txt(g, k, c.x + 16, y + hh / 2 - 12, { size: 17, weight: 700, color: ci === 0 ? COL.fin : COL.text });
                txt(g, v, c.x + 16, y + hh / 2 + 12, { size: 14, weight: 600, color: ci === 0 ? COL.soft : FC[f] || COL.muted });
              }
            });
          });
        });
      });
      // 판정 결과 (직접 해 보기)
      if (P && P.E && P.L) {
        panel(g, 80, 380, 340, 182, { fill: COL.panel2, stroke: COL.rel });
        txt(g, '들어갈 모양', 100, 408, { size: 15, weight: 700, color: COL.muted });
        if (R && R.form) {
          formTag(g, R.form, 100, 450, { size: 22, align: 'left', label: IG.NEED[R.form] });
          txt(g, P.R ? IG.objAdvice(P.R) : '뒤도 고르면 ③까지 켜져요.', 100, 500, { size: 14, weight: 600, color: COL.soft });
        } else if (R && R.bad) {
          const words = R.bad.split(' ');
          let line = '', yy = 448;
          words.forEach(w => { if (tw(g, line + w, 15, 600) > 300) { txt(g, line, 100, yy, { size: 15, weight: 600, color: COL.trap }); yy += 24; line = ''; } line += w + ' '; });
          txt(g, line, 100, yy, { size: 15, weight: 600, color: COL.trap });
        }
      }
    },

    /* 10 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = IG.DRILL[P.k], sl = it.slot;
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0] + 1, s2 = v >= P.at[1], s3 = v >= P.at[2];
        const ans = it.opts[it.a];
        const T = toks(it.q).map(tk => tk.r === 'blank' && s3 ? Object.assign(tk, { t: ans[0], k: ans[1] }) : tk);
        const L = lay(g, T, { x: LX, y: 222, size: 31, maxW: 1120, lh: 52 });
        const atB = sl.at && seq(L, sl.at), mainB = sl.main && seq(L, sl.main), backB = it.back && s3 ? (it.back === 'to' ? L.items[L.items.indexOf(blankOf(L)) + 1] : seq(L, it.back)) : null;
        drawLay(g, L, tk => blankStyle(tk, s2 && !s3 ? 0.6 : 0));
        if (s1 && sl.eng === 'full') gbox(g, mainB, COL.fin, '진짜 동사', { a: ramp(v, P.at[0] + 1, 0.5) });
        if (s1 && sl.eng === 'empty' && !s3) { const B = blankOf(L); gbox(g, { x: B.x, y: B.y, w: B.w, size: 31 }, COL.fin, '진짜 동사 자리', { a: ramp(v, P.at[0] + 1, 0.5), pad: 6 }); }
        const cueB = sl.gov === 'prep' ? L.items[L.items.indexOf(blankOf(L)) - 1] : atB;
        if (s2 && cueB) fade(g, ramp(v, P.at[1] + 0.2, 0.5), () => { rr(g, cueB.x - 5, cueB.y - cueB.size * 0.7, cueB.w + 10, cueB.size * 1.4, 8); g.strokeStyle = COL.fin; g.lineWidth = 2.4; g.stroke(); txt(g, sl.gov === 'prep' ? '전치사 to' : '앞', cueB.x + cueB.w / 2, cueB.y - cueB.size * 0.95, { size: 14, weight: 700, color: COL.fin, align: 'center' }); });
        if (backB) gbox(g, { x: backB.x, y: backB.y, w: backB.w, size: 31 }, sl.obj === 'direct' ? COL.ing : COL.prep, sl.obj === 'direct' ? '목적어' : '전치사', { a: ramp(v, P.at[2] + 0.2, 0.5) });
        sayLay(L, it.q.replace('___', ans[0]));
        const oy = L.lines > 1 ? 360 : 330;
        it.opts.forEach((o, k) => {
          const ox = LX + (k % 2) * 290, y = oy + Math.floor(k / 2) * 78, step = IG.fail(it, k);
          const at = step === 1 ? P.at[0] + 1.6 : step === 2 ? P.at[1] + 1.4 : P.at[2] + 1;
          const right = k === it.a, gone = !right && v >= at, win = right && s3;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, o[0], ox + 52, y, { size: 26, weight: win ? 700 : 600, color: win ? COL.good : gone ? COL.dim : COL.text });
          const tagW = tw(g, IG.FORM[o[1]], 13, 700) + 20;
          if (win) { panel(g, ox - 14, y - 26, w + tagW + 86, 52, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + w + tagW + 88, y, 18); }
          if (v >= P.at[0] + 0.8) fade(g, ramp(v, P.at[0] + 0.8, 0.5) * (gone ? 0.5 : 1), () => formTag(g, o[1], ox + 52 + w + 10, y, { size: 13, align: 'left' }));
          if (gone) {
            const gp = clamp((v - at) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, y + 1); g.lineTo(ox - 4 + (w + 62) * gp, y + 1); g.stroke();
          }
        });
        panel(g, 680, oy - 40, 540, 230, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = oy - 2 + k * 70;
          txt(g, ['① 진짜 동사', '② 앞', '③ 뒤'][k], 704, y, { size: 18, weight: 700, color: COL.accent });
          txt(g, ln, 704, y + 30, { size: 17, weight: 600, color: k === 2 ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 580, 790], Y0 = 150, RH = 50;
      const rows = [
        ['진짜 동사가 없음 (주어 뒤)', 'fin', '시제 있는 진짜 동사', 'Our team launched …'],
        ['조동사 · Please 뒤 / make · have · let + 목적어', 'base', '동사원형', 'must register · let us know'],
        ['decide · plan · hope / 형용사 · 명사 뒤', 'to', 'to부정사', 'decided to move · eligible to apply'],
        ['ask · encourage · allow + 목적어', 'to', 'to부정사', 'encourage employees to attend'],
        ['consider · avoid · suggest / 전치사 뒤', 'ing', '-ing 꼴', 'considering opening · look forward to meeting'],
        ['목적어가 바로 / 전치사가 붙음', 'prep', '타동사 / 자동사', 'discuss the issue · respond to inquiries'],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 10, 1160, RH * (rows.length + 1) + 12, { fill: COL.panel, stroke: COL.faint });
        ['빈칸 앞 (신호)', '빈칸의 모양', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 20, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 8, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.7, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 18;
        txt(g, r[0], X[0] + 20, y, { size: 17, weight: 600 });
        formTag(g, r[1], X[1] + 20, y, { size: 15, align: 'left', label: r[2] });
        const w = txt(g, r[3], X[2] + 20, y, { size: 16, weight: 500, color: COL.en });
        say(X[2] + 16, y - 14, w + 8, 28, r[3].replace(' …', '').replace(/ · /g, ', '));
      }));
      const steps = ['① 진짜 동사: 몇 개?', '② 앞: 무엇이 고르나', '③ 뒤: 목적어 · 전치사'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 6.6 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 534, { size: 20, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 48, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 534, c.x + c.w + 46, 534, COL.accent, 2.5);
        x = c.x + c.w + 58;
      }));
    },
  };

  // 영상 추출용 자막: 아래쪽 띠에 두 줄까지. **굵게**는 강조색, 영어는 연한 하늘색
  function drawCaption(g, text) {
    if (!text) return;
    const words = [];
    text.split('**').forEach((part, k) => { const bold = k % 2 === 1; part.split(/(\s+)/).forEach(w => w && words.push({ w, bold, en: /[A-Za-zÀ-ÿ]/.test(w) && !/[가-힣]/.test(w) })); });
    // 띄어쓰기 사이의 조각은 한 덩어리로 줄을 바꿈
    const units = []; let cur = null;
    words.forEach(o => {
      o.ww = tw(g, o.w, 28, o.bold ? 700 : 500);
      if (/^\s+$/.test(o.w)) { units.push({ sp: true, items: [o], w: o.ww }); cur = null; }
      else { if (!cur) { cur = { items: [], w: 0 }; units.push(cur); } cur.items.push(o); cur.w += o.ww; }
    });
    const lines = [[]]; let lw = 0;
    units.forEach(un => {
      const line = lines[lines.length - 1];
      if (!un.sp && line.length && lw + un.w > 1100) { lines.push([]); lw = 0; }
      if (un.sp && !lines[lines.length - 1].length) return;
      lines[lines.length - 1].push(...un.items); lw += un.w;
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

  IV.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[IV.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, IV.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + Object.values(IG.VERB).map(d => d.v + d.ing + d.ko + d.ex).join('') +
    IG.DRILL.map(d => d.q + d.opts.map(o => o[0]).join('')).join('') + Object.values(IG.FORM).join('') + Object.values(IG.NEED).join('') +
    IG.PREP_TO.concat(IG.INF_TO).map(x => x.e + x.ex + x.noun).join('') + Object.values(IV.FIX).map(f => f.text).join('') +
    IV.VT.flat().join('') + IV.VO.flat().join('') + Object.values(IG.LEFT).join('') + Object.values(IG.RIGHT).join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;·()[]→←↔✓×?~=+-/:…‘’맞아요틀려요';
  IV.baseText = EXTRA;
  IV.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = IV.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { IV.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
