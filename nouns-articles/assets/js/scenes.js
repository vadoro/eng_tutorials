/* 명사·관사·수량 표현 튜토리얼 — 영상 장면
 *
 * NS.render(g, t)는 시각 t와 사용자 상태 NS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 핵심 그림은 ‘명사 검문소’예요: 명사(차)가 세 문을 지나요. ① 셀 수 있나? ② 하나인가 여럿인가? ③ 짝이 맞나?
 * 색: 셀 수 있는 명사 하늘 · 셀 수 없는 명사 라임 · 한정사·수량 표현(짝) 보라 · 복수 -s와 답 노랑 · 빈칸 분홍 점선 · 함정 주황.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(NA.judgePhrase)으로 정합니다.
 */
(function () {
  'use strict';
  const NA = window.NA;
  const NS = (window.NS = {});
  const W = 1280, H = 720;
  NS.W = W; NS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  // 열쇠 시각 [[u, 값], …] 사이를 직선으로 이음
  const keys = (u, K) => { if (u <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (u <= K[i][0]) return lerp(K[i - 1][1], K[i][1], (u - K[i - 1][0]) / (K[i][0] - K[i - 1][0])); return K[K.length - 1][1]; };
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  NS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36', road: '#1A222C',
    // 역할 색: 셀 수 있는 명사 하늘 · 셀 수 없는 명사 라임 · 짝(한정사·수량 표현) 보라 · 복수 -s·답 노랑 · 빈칸 분홍 · 함정 주황
    n: '#6EC8FF', u: '#D4E157', det: '#C9A7FF', ans: '#FFC15E', gap: '#FF7AA8', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  NS.COL = COL;

  // 사용자 상태 ('직접 해 보기'와 화면 누르기로 바뀜). 영상 추출은 언제나 기본값
  const S = (NS.S = { book: null, run: null, path: null });
  NS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  NS.hits = () => HITS;

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

  /* ---------- 갈래 그림: ● 하나 · ●●● 여럿 · 물결 덩어리(셀 수 없음) ---------- */
  function iconCat(g, cat, x, y, s, color) {
    g.save(); g.fillStyle = color;
    if (cat === 'C1') { g.beginPath(); g.arc(x, y, s * 0.36, 0, Math.PI * 2); g.fill(); }
    else if (cat === 'C2') [[-0.62, 0.22], [0.62, 0.22], [0, -0.42]].forEach(([dx, dy]) => { g.beginPath(); g.arc(x + dx * s * 0.6, y + dy * s * 0.6, s * 0.26, 0, Math.PI * 2); g.fill(); });
    else {
      const w = s * 1.25, h = s * 0.7, N = 28;
      g.beginPath(); g.moveTo(x - w / 2, y + h / 2);
      for (let i = 0; i <= N; i++) { const t = i / N; g.lineTo(x - w / 2 + w * t, y + h / 2 - h * (0.45 + 0.42 * Math.sin(t * Math.PI)) - Math.sin(t * Math.PI * 4) * h * 0.1); }
      g.lineTo(x + w / 2, y + h / 2); g.closePath(); g.fill();
    }
    g.restore();
  }
  NS.iconCat = iconCat;
  const catColor = cat => cat === 'U' ? COL.u : COL.n;

  // 물건 그림 (04장: 묶음 이름 furniture · luggage · equipment 속의 셀 수 있는 물건)
  function thing(g, kind, x, y, s, color) {
    g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
    const L = (pts) => { g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(x + a * s, y + b * s) : g.moveTo(x + a * s, y + b * s)); g.stroke(); };
    if (kind === 'chair') { L([[-0.3, -0.5], [-0.3, 0.5]]); L([[-0.3, 0.05], [0.32, 0.05], [0.32, 0.5]]); L([[-0.3, -0.5], [-0.1, -0.5]]); }
    else if (kind === 'desk') { L([[-0.5, -0.15], [0.5, -0.15]]); L([[-0.42, -0.15], [-0.42, 0.5]]); L([[0.42, -0.15], [0.42, 0.5]]); rr(g, x + 0.08 * s, y - 0.1 * s, 0.3 * s, 0.28 * s, 3); g.stroke(); }
    else if (kind === 'table') { L([[-0.55, -0.05], [0.55, -0.05]]); L([[-0.35, -0.05], [-0.35, 0.5]]); L([[0.35, -0.05], [0.35, 0.5]]); }
    else if (kind === 'suitcase') { rr(g, x - 0.42 * s, y - 0.25 * s, 0.84 * s, 0.7 * s, 6); g.stroke(); L([[-0.15, -0.25], [-0.15, -0.45], [0.15, -0.45], [0.15, -0.25]]); L([[-0.42, 0.1], [0.42, 0.1]]); }
    else if (kind === 'bag') { g.beginPath(); g.moveTo(x - 0.4 * s, y - 0.1 * s); g.lineTo(x + 0.4 * s, y - 0.1 * s); g.lineTo(x + 0.32 * s, y + 0.48 * s); g.lineTo(x - 0.32 * s, y + 0.48 * s); g.closePath(); g.stroke(); g.beginPath(); g.arc(x, y - 0.1 * s, 0.22 * s, Math.PI, 0); g.stroke(); }
    else if (kind === 'monitor') { rr(g, x - 0.5 * s, y - 0.42 * s, s, 0.62 * s, 4); g.stroke(); L([[0, 0.2], [0, 0.42]]); L([[-0.22, 0.45], [0.22, 0.45]]); }
    else if (kind === 'printer') { rr(g, x - 0.48 * s, y - 0.12 * s, 0.96 * s, 0.42 * s, 4); g.stroke(); L([[-0.28, -0.12], [-0.28, -0.45], [0.28, -0.45], [0.28, -0.12]]); L([[-0.24, 0.3], [-0.24, 0.48], [0.24, 0.48], [0.24, 0.3]]); }
    g.restore();
  }

  /* ---------- 영어 문장 토큰 배치와 그리기 ---------- */
  // 토큰 { id, t: 글자, r: 역할, tail: 복수 꼬리(-s), tailAt: 꼬리 위치, nb: 앞에 띄어쓰기 없음 }
  // 역할: n 셀 수 있는 명사 · u 셀 수 없는 명사 · det 짝 · hy 숫자-하이픈 꾸밈말 · fn 기능어 · blank 빈칸 · ans 채운 답 · bad 틀림 · '' 보통
  const PCOL = { n: COL.n, u: COL.u, hy: COL.n, det: COL.det, fn: COL.muted, trap: COL.trap, bad: COL.bad, good: COL.good, dim: COL.dim, adj: COL.soft };
  const NOUNR = { n: 1, u: 1 };
  const PUNCT = /^[.,?!]$/;
  const wOf = (tk) => NOUNR[tk.r] || tk.r === 'det' || tk.r === 'hy' ? 600 : 500;
  const tokW = (g, tk, size) => tk.r === 'blank' ? Math.max(size * 2.6, tk.t ? tw(g, tk.t, size, 700) + size * 0.7 : 0) :
    tk.r === 'ans' ? tw(g, tk.t, size, 700) + size * 0.5 : tw(g, tk.t, size, tk.r === 'det' ? 700 : wOf(tk));
  // 한 줄(또는 maxW를 넘으면 여러 줄)로 배치. o: { x, y, size, align: 'left' | 'center', maxW, lh }
  function lay(g, toks, o) {
    const size = o.size || 34, sp = size * 0.3, maxW = o.maxW || 1e9, lh = o.lh || size * 1.65;
    const lines = [[]]; let x = 0;
    toks.forEach(tk => {
      const punct = PUNCT.test(tk.t), w = punct ? tw(g, tk.t, size, 500) : tokW(g, tk, size);
      const line = lines[lines.length - 1];
      if (!punct && !tk.nb && line.length && x + sp + w > maxW) { lines.push([]); x = 0; }
      const cur = lines[lines.length - 1];
      if (cur.length && !punct && !tk.nb) x += sp;
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
  // 문자열 → 토큰 (띄어쓰기로 자르고 마침표·쉼표는 따로). roles: { '글자': 역할 | { r, tail } }, ___는 빈칸
  function toks(s, roles = {}, pre = 't') {
    const out = [];
    s.split(' ').forEach(w => {
      const m = w.match(/^(.*?)([.,?!]?)$/);
      if (m[1]) {
        const ro = roles[m[1]], o = typeof ro === 'object' ? ro : { r: ro || '' };
        out.push(Object.assign({ id: pre + out.length, t: m[1] === '___' ? '' : m[1] }, o, m[1] === '___' ? { r: 'blank' } : {}));
      }
      if (m[2]) out.push({ id: pre + out.length, t: m[2], r: '' });
    });
    return out;
  }
  // 명사구(NA 형식) → 토큰. 같은 pre끼리는 역할이 같은 조각이 같은 id라서 morph로 미끄러짐
  const phraseToks = (p, pre) => NA.parts(p).map(x => ({ id: pre + x.r, t: x.t, r: x.r === 'of' ? 'det' : x.r, tail: x.tail, tailAt: x.tailAt }));
  const byText = (L, t) => L.items.find(i => i.t === t);
  const blankOf = L => L.items.find(i => i.r === 'blank' || i.r === 'ans');
  // 토큰 하나 그리기. o: { a: 투명도, r: 역할 바꾸기, color, cue: 단서 상자, glow: 빈칸 반짝임, plain: 밑줄 없이 }
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
      const c = o.color || PCOL[r] || COL.text, wt = r === 'det' ? 700 : wOf({ r });
      const tail = o.noTail ? '' : it.tail || '', at = tail ? (it.tailAt != null && it.tailAt > 0 ? it.tailAt : it.t.length - tail.length) : it.t.length;
      const pre = it.t.slice(0, at), post = it.t.slice(at + tail.length);
      const ul = (x0, w0, col) => { if (!o.plain && w0 > 0) { g.fillStyle = col; g.fillRect(x0, y + size * 0.56, w0, 3); } };
      let xx = x;
      const w1 = txt(g, pre, xx, y + 1, { size, weight: wt, color: c });
      if (NOUNR[r]) ul(xx, w1, c);
      xx += w1;
      if (tail) { const w2 = txt(g, tail, xx, y + 1, { size, weight: wt, color: o.tailColor || COL.ans }); ul(xx, w2, o.tailColor || COL.ans); xx += w2; }
      if (post) { const w3 = txt(g, post, xx, y + 1, { size, weight: wt, color: c }); if (NOUNR[r]) ul(xx, w3, c); }
      if (r === 'bad' || o.strike) { g.strokeStyle = COL.bad; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x + w + 3, y + 2); g.stroke(); }
    }
    if (o.cue) { rr(g, x - 4, y - size * 0.68, w + 8, size * 1.36, 7); g.strokeStyle = o.cueColor || COL.det; g.lineWidth = 2.2; g.stroke(); }
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
        const lift = o.lift && Math.abs(b.y - a.y) > 20 ? Math.sin(Math.PI * e) * o.lift : 0;
        const m = Object.assign({}, b, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) - lift, w: lerp(a.w, b.w, e), size: lerp(a.size, b.size, e) });
        if (a.t === b.t && a.r === b.r && (a.tail || '') === (b.tail || '')) drawTok(g, m, style(b, e));
        else { drawTok(g, Object.assign({}, m, { t: a.t, r: a.r, tail: a.tail, tailAt: a.tailAt, w: a.w }), Object.assign({}, style(a, e), { a: 1 - e })); drawTok(g, m, Object.assign({}, style(b, e), { a: e })); }
      } else if (a) drawTok(g, a, Object.assign({}, style(a, e), { a: 1 - ramp(p, 0, 0.5) }));
      else drawTok(g, b, Object.assign({}, style(b, e), { a: ramp(p, 0.5, 0.5) }));
    });
  }
  function sayLay(L, text) { say(L.x - 8, L.y - L.size * 0.8, L.w + 16, L.h + L.size * 0.3, text); }
  // 명사구 하나를 그리고 끝에 ✓/×(규칙 엔진). 돌려주는 값: 배치
  function phraseAt(g, p, x, y, o = {}) {
    const L = lay(g, phraseToks(p, o.pre || 'ph'), { x, y, size: o.size || 24, align: o.align });
    const r = NA.judgePhrase(p, o.ctx);
    drawLay(g, L, () => (r.s === 'ok' || o.noStrike ? {} : { strike: true }));
    if (o.mark !== false) mark(g, r.s === 'ok', L.x + L.w + (o.size || 24) * 0.75, y, (o.size || 24) * 0.62);
    sayLay(L, NA.text(p));
    if (o.expect != null && (r.s === 'ok') !== o.expect) console.warn('[명사·관사] 영상 예문이 규칙 엔진과 달라요:', NA.text(p));
    L.res = r;
    return L;
  }

  // 명사구 여러 개를 가운데 맞춰 한 줄로 (list: [{ p, exp }], o.a(i): i번째의 투명도)
  function phraseRow(g, list, cx, y, o = {}) {
    const size = o.size || 22, gap = o.gap || 56, pre = o.pre || 'r';
    const ws = list.map((it, i) => lay(g, phraseToks(it.p, pre + i), { x: 0, y, size }).w + size * 1.1);
    let x = cx - (ws.reduce((a, b) => a + b, 0) + gap * (list.length - 1)) / 2;
    list.forEach((it, i) => { const xx = x; fade(g, o.a ? o.a(i) : 1, () => phraseAt(g, it.p, xx, y, { size, pre: pre + i, expect: it.exp })); x += ws[i] + gap; });
  }

  /* ---------- 명사 검문소 그리기 (02장 · 08장 · 놀이터) ----------
   * s: 0 → 4 (0 출발, k+1 = k번째 문의 판정 끝, 4 도착). res: NA.judgePhrase 결과
   * o: { X, W, Y 길의 가운데, lo 차선 간격, signY, labelY, fs 글자 크기, short 짧은 문 이름, carText, carTail, carCat, a }
   */
  const GATE_SHORT = ['① 셀 수 있나?', '② 몇 개?', '③ 짝?'];
  NS.gates = function (g, res, s, o) {
    const X = o.X, Wd = o.W, Y = o.Y, lo = o.lo || 24, fs = o.fs || 17, half = lo + 20;
    const gx = [0.25, 0.5, 0.75].map(f => X + Wd * f), fail = res.fail;
    const cat = res.cat, c = res.c1 != null ? res.c1 : cat !== 'U', laneY = c ? Y - lo : Y + lo, laneC = c ? COL.n : COL.u;
    // 길
    rr(g, X, Y - half, Wd, half * 2, 14); g.fillStyle = COL.road; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.stroke();
    g.save(); g.setLineDash([10, 9]); g.strokeStyle = 'rgba(238,241,244,0.22)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(gx[0] + 8, Y); g.lineTo(X + Wd - 14, Y); g.stroke(); g.restore();
    // 차선 표시 (① 문 뒤): 위 = 셀 수 있음, 아래 = 셀 수 없음
    const s1 = clamp((s - 0.7) / 0.3);
    [['C1', Y - lo, COL.n, '셀 수 있음'], ['U', Y + lo, COL.u, '셀 수 없음']].forEach(([k, yy, col, name]) => {
      const on = s1 > 0 && (k === 'U') !== c;
      fade(g, 0.5 + 0.5 * (on ? s1 : 0), () => {
        iconCat(g, k, gx[0] + 30, yy, fs * 0.9, on ? col : COL.dim);
        if (!o.short) txt(g, name, gx[0] + 52, yy + 1, { size: fs * 0.8, weight: 600, color: on ? col : COL.dim });
      });
    });
    // 문 세 개
    gx.forEach((x, i) => {
      const G = res.gates[i], judged = s >= i + 0.75, reached = fail < 0 || i <= fail;
      const open = G.ok && reached ? clamp((s - i - 0.75) / 0.2) : 0, red = i === fail && judged;   // 처음 멈춘 문만 빨강 (그 뒤의 문은 판정하지 않음)
      // 표지판과 기둥
      const name = o.short ? GATE_SHORT[i] : NA.GATE[i];
      g.strokeStyle = COL.line; g.lineWidth = 2; g.beginPath(); g.moveTo(x, o.signY + fs); g.lineTo(x, Y - half); g.stroke();
      chip(g, name, x, o.signY, { size: fs, weight: 700, color: red ? COL.bad : open > 0.5 ? COL.good : COL.accent, fill: COL.panel2, stroke: red ? COL.bad : open > 0.5 ? COL.good : COL.accent, align: 'center', h: fs * 2.2, r: 10, pad: fs * 0.8 });
      // 막대: 닫힘(줄무늬) → 열림(위로 접힘, 초록) / 멈춤(빨강)
      const bh = (half * 2 - 8) * (1 - open), bx = x - 5, by = Y - half + 4;
      if (bh > 1) {
        g.save(); rr(g, bx, by, 10, bh, 4); g.clip();
        for (let k = 0; k * 12 < bh; k++) { g.fillStyle = red ? (k % 2 ? '#7A2A2A' : COL.bad) : open > 0 ? COL.good : (k % 2 ? '#3A4654' : COL.soft); g.fillRect(bx, by + k * 12, 10, 12); }
        g.restore();
      }
      if (red) { const room = (Y - half) - (o.signY + fs * 1.1); if (room >= 30) cross(g, x, Y - half - 14, 14, COL.bad); else cross(g, x + 20, Y - half + 16, 12, COL.bad); }
      // 판정 글
      if (judged && reached) fade(g, ramp(s, i + 0.75, 0.2), () => {
        const col = i === 0 ? laneC : G.ok ? COL.good : COL.bad;
        txt(g, G.label, x, o.labelY, { size: fs, weight: 700, color: col, align: 'center' });
      });
    });
    // 차(명사)
    const text = o.carText != null ? o.carText : '', tail = o.carTail || '', icon = o.carCat || cat, csz = fs * 1.05;
    const cw = (text ? tw(g, text, csz, 700) + 12 : 0) + csz * 1.6 + 16, ch = fs * 2.3;
    const stop = gx.map(x => x - 16 - cw / 2), start = X + cw / 2 + 10, end = X + Wd - cw / 2 - 12;
    const sc = fail >= 0 ? Math.min(s, fail + 1) : s;
    let cx;
    if (sc < 1) cx = lerp(start, stop[0], ease(clamp(sc / 0.7)));
    else if (sc < 3) { const k = Math.floor(sc); cx = lerp(stop[k - 1], stop[k], ease(clamp((sc - k) / 0.7))); }
    else cx = lerp(stop[2], end, ease(clamp(sc - 3)));
    if (fail >= 0 && s > fail + 0.75) cx += Math.sin((s - fail - 0.75) * 46) * 4 * (1 - clamp((s - fail - 0.75) / 0.25));
    const cy = cx < gx[0] ? Y : lerp(Y, laneY, ease(clamp((cx - gx[0]) / 90)));
    const col = fail >= 0 && s > fail + 0.75 ? COL.bad : laneC;
    rr(g, cx - cw / 2, cy - ch / 2, cw, ch, ch / 2); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = col; g.lineWidth = 2.2; g.stroke();
    iconCat(g, icon, cx - cw / 2 + 8 + csz * 0.8, cy, csz * 0.95, laneC);
    if (text) {
      const tx = cx - cw / 2 + csz * 1.6 + 12, base = tail ? text.slice(0, text.length - tail.length) : text;
      const bw = txt(g, base, tx, cy + 1, { size: csz, weight: 700, color: laneC });
      if (tail) txt(g, tail, tx + bw, cy + 1, { size: csz, weight: 800, color: COL.ans });
    }
    if (fail < 0 && s >= 3.9) fade(g, ramp(s, 3.9, 0.1), () => { mark(g, true, end + cw / 2 - 2, Y - half - 16, 18); });
    return { gx, stop, cx, cy };
  };

  // 놀이터·퀴즈 그림: 위에 명사구, 아래에 검문소. 영상의 누를 곳(HITS)은 건드리지 않음
  NS.pgDraw = function (g, w, h, p, s, o = {}) {
    const keep = HITS; HITS = [];
    g.fillStyle = COL.bg; g.fillRect(0, 0, w, h);
    const narrow = w < 760, fs = narrow ? 14 : 16, r = NA.judgePhrase(p), n1 = NA.noun(p.hyw ? p.hyw[1] : p.noun);
    const L = lay(g, phraseToks(p, 'pg'), { x: w / 2, y: 30, size: narrow ? 22 : 26, align: 'center' });
    drawLay(g, L);
    const doneAt = r.fail < 0 ? 3.9 : r.fail + 0.8;
    if (!o.quiz && s >= doneAt) mark(g, r.s === 'ok', L.x + L.w + 20, 30, 14);
    const form = p.hyw ? NA.hyText(p.hyw, p.hy) : NA.form(p.noun, p.num), tail = p.hyw ? (p.hy === 'pl' ? 's' : '') : p.num === 'pl' ? NA.plParts(p.noun)[1] : '';
    const carCat = p.hyw ? (n1.c ? (p.hy === 'pl' ? 'C2' : 'C1') : 'U') : r.cat;
    NS.gates(g, r, s, { X: 24, W: w - 48, Y: o.quiz ? 140 : 148, lo: narrow ? 18 : 20, signY: o.quiz ? 76 : 80, labelY: o.quiz ? 198 : 216, fs, short: narrow, carText: narrow ? '' : form, carTail: narrow ? '' : tail, carCat });
    HITS = keep;
    return r;
  };

  /* ---------- 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '토익 Part 5의 명사 문제', d: 24, caps: [
      [0.4, 5, '토익 Part 5에는 명사와 그 앞의 작은 말이 **짝**이 맞는지 묻는 문제가 나와요.'],
      [5, 10, '보기를 보세요. many, several, a great deal of, a number of. 모두 ‘많은’이라는 뜻이에요.'],
      [10, 15, '뜻이 같으니 해석으로는 고를 수 없어요. 답은 빈칸 뒤의 명사가 정해요.'],
      [15, 19.5, '정보, information. 이 말은 셀 수 있을까요? 이것이 첫 단서예요. 정답은 영상 뒤에서 풀어요.'],
      [19.5, 24, '한국어와 다른 점, **명사 검문소**, 그리고 **3단계 풀이법**을 차례로 배워요.'],
    ] },
    { id: 'korean', n: '01', title: '‘책 샀어’를 영어로', sub: '한국어에는 없는 것', d: 32, caps: [
      [0.4, 5.5, '한국어로는 ‘어제 책 샀어’면 충분해요. 몇 권인지, 어떤 책인지 밝히지 않아도 돼요.'],
      [5.5, 11, '영어는 달라요. 한 권이면 a book, 서로 아는 그 책이면 the book, 여러 권이면 books.'],
      [11, 16.5, '셋 가운데 하나를 꼭 골라야 해요. I bought book yesterday. 이렇게 맨 명사로는 못 써요.'],
      [16.5, 22, '수도 마찬가지예요. 한국어는 ‘학생 세 명’이라고 하지, ‘학생들 세 명’이라고 꼭 붙이지 않죠.'],
      [22, 27, '영어는 숫자가 있어도 -s를 붙여요. three students. three student → 오답이에요.'],
      [27, 32, '그래서 영어 명사를 볼 때마다 물어요. 셀 수 있나, 몇 개인가, 앞에 무엇이 오나.'],
    ] },
    { id: 'gate', n: '02', title: '명사 검문소', sub: '문 세 개', d: 34, caps: [
      [0.4, 6, '영어 명사가 문장에 들어가려면 검문소의 문 세 개를 지나야 한다고 생각해 봐요.'],
      [6, 11.5, '첫째 문, **셀 수 있나?** application, 지원서는 한 장, 두 장 셀 수 있어요.'],
      [11.5, 17, '둘째 문, **하나인가 여럿인가?** 끝에 -s가 없으니 하나, 단수예요.'],
      [17, 22.5, '셋째 문, **짝이 맞나?** 셀 수 있는 단수는 혼자 못 다녀요. 짝이 있어야 해요 → an application.'],
      [22.5, 28, '이번엔 information. 정보는 셀 수 없는 명사라서, 첫째 문에서 다른 길로 가요.'],
      [28, 34, '셀 수 없는 명사 → -s 없이, 관사 a 없이 써요. 짝이 되는 말 → much, a great deal of.'],
    ] },
    { id: 'single', n: '03', title: '혼자 못 다니는 명사', sub: '셀 수 있는 단수 + 한정사', d: 30, caps: [
      [0.4, 6, '셋째 문을 자세히 볼게요. 셀 수 있는 명사가 **하나**일 때는 혼자 다니지 못해요.'],
      [6, 12, 'Please submit application. 지원서 앞에 짝이 없어서 틀린 문장이에요.'],
      [12, 18, 'an, the, your, this 같은 **한정사**가 짝이 되면 통과예요. Please submit an application.'],
      [18, 24, '여럿이면 혼자 다녀도 돼요. Applications are accepted online. 셀 수 없는 명사도 혼자 다녀요.'],
      [24, 30, '관사 a, an → 뒤 낱말의 첫 **소리**로 골라요. an application, an hour, a university.'],
    ] },
    { id: 'uncount', n: '04', title: '셀 수 없는 명사', sub: '묶음의 이름', d: 34, caps: [
      [0.4, 6, '한국어로는 ‘정보 몇 개’, ‘조언 하나’라고 해도 자연스러워요.'],
      [6, 12, '그런데 영어에서는 셀 수 없는 명사예요. information, advice, equipment, feedback, luggage, furniture.'],
      [12, 18, '가구, furniture. 의자와 책상과 탁자를 한데 묶어 부르는 이름이에요.'],
      [18, 23.5, '가방을 묶은 이름 luggage, 장비를 묶은 이름 equipment. 묶음의 이름이라 셀 수 없어요.'],
      [23.5, 29, '그래서 -s를 붙이지 않고, 하나를 뜻하는 관사도 붙이지 않아요. an information, informations → 오답.'],
      [29, 34, '하나, 둘 셀 때는 세는 말을 써요. a piece of information, two pieces of luggage.'],
    ] },
    { id: 'pairs', n: '05', title: '수량 표현의 짝', sub: '하나 · 여럿 · 셀 수 없음', d: 36, caps: [
      [0.4, 6, '이번엔 수량 표현이에요. 수량 표현마다 함께 다니는 명사가 정해져 있어요.'],
      [6, 12, '‘하나하나’를 말하는 each, every, another 뒤에는 셀 수 있는 **단수**. each candidate.'],
      [12, 18, 'several, a few, many, a number of 뒤에는 셀 수 있는 **복수**. several candidates.'],
      [18, 24, 'much, a little, a great deal of 뒤에는 **셀 수 없는 명사**. much information.'],
      [24, 30, '복수와 셀 수 없는 명사 모두와 짝이 되는 말도 있어요. all, most, some, a lot of, plenty of.'],
      [30, 36, '그런데 each of the 뒤에는 복수가 와요. of the → ‘그 무리 가운데’. each of the candidates.'],
    ] },
    { id: 'most', n: '06', title: 'almost · most · most of', sub: '‘대부분’을 영어로', d: 32, caps: [
      [0.4, 6, '‘직원 대부분’을 영어로 옮겨 볼게요. 비슷한 말이 셋 있어요. almost, most, most of.'],
      [6, 12, '먼저 most. 명사 바로 앞에 와요. most employees, 셀 수 없는 명사도 돼요. most equipment.'],
      [12, 18, 'most of → ‘~ 가운데 대부분’. most of the employees, most of our customers.'],
      [18, 24, '어느 무리 가운데인지 the, our 같은 말로 밝혀요. most of employees → 오답.'],
      [24, 28, 'almost → ‘거의’라는 **부사**예요. 부사는 명사 앞에 바로 오지 못해요.'],
      [28, 32, '한국어도 ‘거의 직원’이 아니라 ‘거의 모든 직원’이죠. almost all employees.'],
    ] },
    { id: 'hyphen', n: '07', title: '숫자-하이픈과 another', sub: 'a three-day workshop · another date', d: 32, caps: [
      [0.4, 6, 'The workshop lasts three days. 사흘이니까 days, 복수예요.'],
      [6, 12, '그런데 같은 말이 명사 앞으로 가면 모양이 바뀌어요. a three-day workshop.'],
      [12, 18, '숫자와 명사를 하이픈으로 묶어 꾸밈말이 되면 -s를 떼고 **단수**로 써요. three-days → 오답.'],
      [18, 23, '한국어의 ‘3일짜리 워크숍’과 비슷해요. a 10-page report, a two-hour meeting.'],
      [23, 28, 'another → an + other. 하나를 뜻하는 관사가 들어 있어서 뒤에는 **단수**. another date.'],
      [28, 32, 'other 뒤에는 **복수**가 와요. other suppliers.'],
    ] },
    { id: 'method', n: '08', title: '3단계 풀이법', sub: '셀 수 있나 → 몇 개인가 → 짝이 맞나', d: 30, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요. 검문소의 세 문 그대로예요.'],
      [5.5, 11.5, '① **셀 수 있나?** 명사부터 봐요. information, equipment, advice 같은 말은 셀 수 없어요.'],
      [11.5, 18, '② **하나인가 여럿인가?** 끝에 -s가 있는지, 앞뒤에 each, is 같은 단서가 있는지 봐요.'],
      [18, 24, '③ **짝이 맞나?** 앞의 짝이 그 명사와 맞는지 봐요. almost, most of 함정도 여기서 걸러요.'],
      [24, 30, '이 순서로 토익 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '09', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '처음 본 문제예요. ① 빈칸 뒤의 명사 information. 셀 수 없는 명사예요.'],
      [6, 12, '② 셀 수 없는 명사는 -s 없이 한 덩어리로 써요. 하나, 둘 세는 말과는 맞지 않아요.'],
      [12, 18, '③ 짝을 찾으면 a great deal of. 나머지 셋은 복수와 짝이라 오답. 정답은 (C).'],
      [18.4, 24.5, '두 번째 문제. ① participants, 참가자는 셀 수 있어요. ② 끝에 -s, 복수예요.'],
      [24.5, 31, '③ 빈칸 뒤에 of the. Every + of → 쓰지 않는 모양이고, Much → 셀 수 없는 명사와 짝이에요.'],
      [31, 37, 'Almost → 부사라서 혼자 못 와요. each of the 뒤에는 복수, 정답은 (A) Each.'],
      [37.4, 43.5, '세 번째. ① 빈칸 뒤의 training course, 교육 과정은 셀 수 있어요.'],
      [43.5, 50, '② course → 단수. 앞의 숫자-하이픈 꾸밈말도 -s 없이 two-week. -s가 붙은 보기는 지워요.'],
      [50, 56, '③ 셀 수 있는 단수는 짝이 있어야 해요. 그래서 정답은 (D) a two-week.'],
    ] },
    { id: 'summary', n: '10', title: '정리', sub: '한눈에 보는 짝 표', d: 22, caps: [
      [0.4, 6, '정리해요. 명사를 보면 검문소의 세 문을 떠올리세요.'],
      [6, 12, '셀 수 있나, 하나인가 여럿인가, 짝이 맞나. 셀 수 있는 단수에는 꼭 짝이 있어야 해요.'],
      [12, 17, '함정 넷. 셀 수 없는 명사의 -s, 혼자 쓴 almost, the 없는 most of, 숫자-하이픈 꾸밈말의 -s.'],
      [17, 22, '아래 명사 검문소 놀이터와 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  NS.CHAPTERS = CHAPTERS; NS.CAPTIONS = CAPTIONS; NS.END = END;
  NS.POSTER = CHAPTERS.find(c => c.id === 'gate').t + 21.6;
  NS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  NS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(NA.DRILL)에서 세 개. 각 단계에서 지울 보기를 규칙 엔진의 멈춘 문으로 정함
  // at: 단계 글이 나오는 때, gone: 보기를 지우는 때(보기 번호 → 초), fill: 정답을 채우는 때 (모두 문제 시작부터 센 초)
  const PRACTICE = [
    { k: 0, at: [0.4, 6, 12], gone: { 0: 12.8, 1: 13.3, 3: 13.8 }, fill: 14.6, lines: ['information → 셀 수 없음', '-s 없이 한 덩어리', '셀 수 없는 짝 → (C) a great deal of'] },
    { k: 9, at: [0.4, 3.6, 6.4], gone: { 1: 8.4, 2: 10.6, 3: 13.4 }, fill: 15.4, lines: ['participants → 셀 수 있음', '-s → 복수 · 빈칸 뒤에 of the', 'each of the + 복수 → (A) Each'] },
    { k: 13, at: [0.4, 6.3, 12.8], gone: { 0: 9.4, 1: 9.9, 2: 13.6 }, fill: 14.6, lines: ['training course → 셀 수 있음', 'course 단수 · 꾸밈말도 -s 없이', '단수에는 짝 → (D) a two-week'] },
  ];
  PRACTICE.forEach(p => {
    const it = NA.DRILL[p.k];
    if (!p.lines[2].includes(`(${'ABCD'[it.a]})`)) console.warn('[명사·관사] 실전 문제 정답 표시가 데이터와 달라요:', it.q);
    it.opts.forEach((o, i) => { if ((NA.judgeOpt(it, i).s === 'ok') !== (i === it.a)) console.warn('[명사·관사] 실전 문제가 규칙 엔진과 달라요:', it.q); });
  });
  NS.PRACTICE = PRACTICE;

  // 02장 직접 해 보기: 검문소에 보낼 명사구
  NS.RUNS = [
    { det: 'a', noun: 'application', num: 'sg' }, { noun: 'application', num: 'sg' }, { noun: 'application', num: 'pl' }, { det: 'several', noun: 'application', num: 'sg' },
    { noun: 'information', num: 'sg' }, { det: 'a', noun: 'information', num: 'sg' }, { noun: 'information', num: 'pl' }, { det: 'much', noun: 'information', num: 'sg' },
  ];
  // 01장: 같은 한국어, 영어 네 가지
  const BOOKS = [
    { key: 'a', s: 'I bought a book yesterday.', p: { det: 'a', noun: 'book', num: 'sg' }, tag: '한 권 · 처음 말하는 책', at: 5.8 },
    { key: 'the', s: 'I bought the book yesterday.', p: { det: 'the', noun: 'book', num: 'sg' }, tag: '서로 아는 그 책', at: 7.6 },
    { key: 'pl', s: 'I bought books yesterday.', p: { noun: 'book', num: 'pl' }, tag: '여러 권', at: 9.4 },
    { key: 'bare', s: 'I bought book yesterday.', p: { noun: 'book', num: 'sg' }, tag: '맨 명사 → 못 써요', at: 11.4 },
  ];
  NS.BOOKS = BOOKS;
  BOOKS.forEach(b => { if ((NA.judgePhrase(b.p).s === 'ok') !== (b.key !== 'bare')) console.warn('[명사·관사] 01장 예문이 규칙 엔진과 달라요:', b.s); });

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o)); }
  const nounRole = id => NA.noun(id).c ? 'n' : 'u';
  const tailOf = id => NA.plParts(id)[1];

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(뜻이 같은 보기 넷, 뒤의 명사가 단서) → 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '명사 검문소', W / 2, 290, { size: 84, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Nouns · Articles · Quantifiers', W / 2, 368, { size: 30, weight: 500, color: COL.muted, align: 'center' });
      });
      NA.GATE.forEach((q, k) => {
        const a = ramp(u, 1.3 + k * 0.25, 0.4) * out1;
        fade(g, a, () => chip(g, q, W / 2 - 330 + k * 330, 462 + (1 - a) * 10, { size: 20, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 46, r: 12 }));
      });
      const it = NA.DRILL[0];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 18.8, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 160, 1000, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 180, 202, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const L = lay(g, toks(it.q, { information: 'u' }), { x: 180, y: 278, size: 30, maxW: 930 });
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: u > 10.2 ? 0 : 0.5 } : tk.t === 'information' ? { cue: u > 10.4, cueColor: COL.u } : {});
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        const inf = byText(L, 'information');
        fade(g, ramp(u, 15.2, 0.5), () => {
          chip(g, '셀 수 있나?', inf.x + inf.w / 2, 222, { size: 17, weight: 700, color: COL.u, fill: COL.panel2, stroke: COL.u, align: 'center', h: 34, r: 10 });
        });
        it.opts.forEach(([o], k) => {
          const ox = 200 + (k % 2) * 440, oy = 390 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            const w = txt(g, o, ox + 64, oy, { size: 30, weight: 700, color: COL.det });
            fade(g, ramp(u, 7.2 + k * 0.3, 0.4), () => chip(g, '많은', ox + 64 + w + 40, oy, { size: 15, weight: 700, color: COL.soft, fill: COL.panel2, align: 'center', h: 28, r: 8 }));
          });
        });
        fade(g, ramp(u, 10.6, 0.5), () => chip(g, '뜻이 같아요 → 해석으로는 못 골라요', W / 2, 524, { size: 18, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'center', h: 38 }));
      });
      const steps = [['①', '한국어와 다른 점', 'a book · the book · books'], ['②', '명사 검문소', '셀 수 있나 → 몇 개인가 → 짝'], ['③', '3단계 풀이법', '토익 문제에 바로 쓰기']];
      steps.forEach(([n, t1, t2], k) => {
        const a = ramp(u, 19.6 + k * 0.7, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 220, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 285 + (1 - a) * 16, { size: 34, weight: 700, color: COL.accent });
          txt(g, t1, x0 + 28, 345 + (1 - a) * 16, { size: 25, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 400 + (1 - a) * 16, { size: 18, weight: 500, color: k === 0 ? COL.en : COL.soft });
        });
      });
    },

    /* 01 ‘책 샀어’를 영어로: 한국어 한 문장 → 영어 넷(관사·복수), 숫자와 -s */
    korean(g, u) {
      fade(g, ramp(u, 0.4, 0.6), () => {
        label(g, '한국어', LX, 170, { size: 16, color: COL.soft });
        rr(g, LX, 188, 330, 78, 18); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = COL.line; g.lineWidth = 1.5; g.stroke();
        g.beginPath(); g.moveTo(LX + 50, 266); g.lineTo(LX + 40, 290); g.lineTo(LX + 78, 266); g.closePath(); g.fillStyle = COL.panel2; g.fill();
        txt(g, '어제 책 샀어.', LX + 165, 228, { size: 32, weight: 700, align: 'center' });
      });
      fade(g, ramp(u, 2.6, 0.6), () => {
        txt(g, '몇 권? 어떤 책?', LX + 4, 318, { size: 18, weight: 600, color: COL.muted });
        txt(g, '→ 말하지 않아도 돼요', LX + 4, 348, { size: 18, weight: 600, color: COL.muted });
      });
      fade(g, ramp(u, 5.6, 0.5), () => label(g, '영어', 520, 160, { size: 16, color: COL.soft }));
      BOOKS.forEach((b, i) => {
        const y = 196 + i * 58, a = ramp(u, b.at, 0.6), on = S.book ? S.book === b.key : true;
        const ok = NA.judgePhrase(b.p).s === 'ok';
        fade(g, a * (on ? 1 : 0.32), () => {
          arrow(g, LX + 338, 228, 508, y, ok ? COL.line : 'rgba(255,107,107,0.5)', 2);
          if (S.book === b.key) panel(g, 512, y - 26, 700, 52, { fill: 'rgba(255,193,94,0.08)', stroke: COL.ans, r: 10 });
          const R = { book: { r: 'n' }, books: { r: 'n', tail: 's' }, a: 'det', the: 'det' };
          const L = lay(g, toks(b.s, R, 'b' + i), { x: 528, y, size: 25 });
          drawLay(g, L, tk => ok ? {} : tk.t === 'book' ? { color: COL.bad } : {});
          if (!ok) { const bk = byText(L, 'book'); chip(g, '앞에 짝이 없어요', bk.x + bk.w / 2, y + 36, { size: 14, weight: 700, color: COL.bad, fill: COL.panel2, stroke: COL.bad, align: 'center', h: 26, r: 7, pad: 9 }); }
          mark(g, ok, L.x + L.w + 22, y, 15);
          txt(g, b.tag, 935, y + 1, { size: 17, weight: 600, color: ok ? COL.soft : COL.bad });
          sayLay(L, b.s);
        });
      });
      // 숫자와 -s
      const inP = ramp(u, 16.8, 0.6) * (1 - ramp(u, 27, 0.5));
      fade(g, inP, () => {
        panel(g, LX - 10, 440, 1140, 124, { fill: COL.panel, stroke: COL.faint });
        txt(g, '학생 세 명이 왔어요.', LX + 16, 478, { size: 26, weight: 700 });
        txt(g, '‘-들’ 없이도 자연스러워요', LX + 16, 526, { size: 17, weight: 600, color: COL.muted });
        fade(g, ramp(u, 22.2, 0.6), () => {
          arrow(g, 420, 500, 470, 500, COL.line, 2);
          phraseLine(g, 'Three students came.', { det: 'three', noun: 'student', num: 'pl' }, 500, 478, 'th1');
          fade(g, ramp(u, 23.8, 0.5), () => phraseLine(g, 'Three student came.', { det: 'three', noun: 'student', num: 'sg' }, 500, 528, 'th2'));
          fade(g, ramp(u, 24.4, 0.5), () => txt(g, '숫자가 있어도 -s를 꼭 붙여요', 860, 503, { size: 18, weight: 700, color: COL.ans }));
        });
      });
      // 세 가지 질문
      const qs = ['셀 수 있나?', '몇 개인가?', '앞에 무엇이 오나?'];
      let x = W / 2 - (qs.reduce((a, q) => a + tw(g, q, 22, 600) + 44, 0) + 70 * 2) / 2;
      qs.forEach((q, i) => fade(g, ramp(u, 27.4 + i * 0.6, 0.5), () => {
        const c = chip(g, q, x, 502, { size: 22, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 50, r: 12, pad: 22 });
        if (i < 2) arrow(g, c.x + c.w + 14, 502, c.x + c.w + 54, 502, COL.accent, 2.5);
        x = c.x + c.w + 70;
      }));
    },

    /* 02 명사 검문소: application → (an) / information → 다른 길 */
    gate(g, u) {
      const GO = { X: 90, W: 1100, Y: 364, lo: 28, signY: 252, labelY: 462, fs: 19 };
      const A = { noun: 'application', num: 'sg' }, B = { det: 'a', noun: 'application', num: 'sg' }, C2 = { det: 'agreatdealof', noun: 'information', num: 'sg' };
      const userRun = S.run != null ? NS.RUNS[S.run] : null;
      fade(g, ramp(u, 0.6, 0.6), () => txt(g, '명사가 문장에 들어가려면 문 세 개를 지나요', W / 2, 158, { size: 19, weight: 600, color: COL.soft, align: 'center' }));
      const drawRun = (p, s, a, o2 = {}) => fade(g, a, () => {
        const r = NA.judgePhrase(p), form = NA.form(p.noun, p.num);
        NS.gates(g, r, s, Object.assign({}, GO, { carText: form, carTail: p.num === 'pl' ? tailOf(p.noun) : '' }));
        return r;
      });
      if (userRun) {
        const r = NA.judgePhrase(userRun);
        fade(g, ramp(u, 0.4, 0.4), () => {
          const L = phraseAt(g, userRun, W / 2, 200, { size: 32, align: 'center', mark: false, noStrike: true, pre: 'us' });
          fade(g, 1, () => drawRun(userRun, 4, 1));
          chip(g, r.s === 'ok' ? '통과' : `${NA.GATE[r.fail]}에서 멈춤`, W / 2, 516, { size: 19, weight: 700, color: r.s === 'ok' ? COL.good : COL.bad, fill: COL.panel2, stroke: r.s === 'ok' ? COL.good : COL.bad, align: 'center', h: 40 });
          if (r.fix) txt(g, '고친 말: ' + r.fix.text, W / 2, 560, { size: 19, weight: 600, color: COL.en, align: 'center' });
          void L;
        });
        return;
      }
      // 첫 번째 차: application → 셋째 문에서 짝 an이 붙음
      const a1 = ramp(u, 4.2, 0.6) * (1 - ramp(u, 22.4, 0.5));
      if (a1 > 0) {
        const join = ramp(u, 19.4, 1.2);
        const LA = lay(g, phraseToks(A, 'g'), { x: W / 2, y: 200, size: 34, align: 'center' });
        const LB = lay(g, phraseToks(B, 'g'), { x: W / 2, y: 200, size: 34, align: 'center' });
        fade(g, a1, () => {
          if (join <= 0) drawLay(g, LA); else morph(g, LA, LB, join);
          sayLay(join > 0.5 ? LB : LA, join > 0.5 ? 'an application' : 'application');
        });
        const phase2 = u >= 20.6;
        const s = phase2 ? keys(u, [[20.6, 2.7], [21.0, 3], [22.2, 4]]) : keys(u, [[6.2, 0], [10.6, 1], [15.6, 2], [18.6, 3]]);
        drawRun(phase2 ? B : A, s, a1);
        fade(g, ramp(u, 20.8, 0.5) * a1, () => chip(g, '셀 수 있는 단수 → 짝이 꼭 필요해요', W / 2, 526, { size: 19, weight: 700, color: COL.n, fill: COL.panel2, stroke: COL.n, align: 'center', h: 42 }));
      }
      // 두 번째 차: information → 아래 길
      const a2 = ramp(u, 22.7, 0.5);
      if (a2 > 0) {
        fade(g, a2, () => {
          const L = lay(g, phraseToks(C2, 'h'), { x: W / 2, y: 200, size: 34, align: 'center' });
          drawLay(g, L); sayLay(L, NA.text(C2));
        });
        drawRun(C2, keys(u, [[23.0, 0], [25.6, 1], [28.2, 2], [30.4, 3], [32.0, 4]]), a2);
        const list = [{ p: { noun: 'information', num: 'pl' }, exp: false }, { p: { det: 'a', noun: 'information', num: 'sg' }, exp: false }, { p: { det: 'much', noun: 'information', num: 'sg' }, exp: true }, { p: C2, exp: true }];
        phraseRow(g, list, W / 2, 530, { size: 23, gap: 64, pre: 'l', a: i => ramp(u, 28.6 + i * 0.6, 0.5) });
      }
    },

    /* 03 혼자 못 다니는 명사: Please submit ___ application. → 한정사 → 표 → a/an 소리 */
    single(g, u) {
      const topA = 1 - ramp(u, 23.6, 0.6);
      fade(g, ramp(u, 0.4, 0.6) * topA, () => {
        const t0 = '셀 수 있는 단수 = 혼자 못 다녀요', w0 = tw(g, t0, 22, 700);
        iconCat(g, 'C1', W / 2 - w0 / 2 - 6, 176, 18, COL.n);
        txt(g, t0, W / 2 + 12, 176, { size: 22, weight: 700, color: COL.n, align: 'center' });
      });
      const s0 = 'Please submit application.', s1 = 'Please submit an application.';
      const R = { application: 'n', an: 'det' };
      const T0 = toks(s0, R, 's'), T1 = toks(s1, R, 's');
      // 같은 낱말은 같은 id로 (an만 새로 들어옴)
      T1.forEach(tk => { const m = T0.find(x => x.t === tk.t); tk.id = m ? m.id : 'san'; });
      const L0 = lay(g, T0, { x: W / 2, y: 248, size: 36, align: 'center' }), L1 = lay(g, T1, { x: W / 2, y: 248, size: 36, align: 'center' });
      const jp = ramp(u, 12.2, 1.0);
      fade(g, ramp(u, 6.0, 0.6) * topA, () => {
        if (jp <= 0) {
          drawLay(g, L0, tk => tk.t === 'application' ? { color: COL.bad } : {});
          const ap = byText(L0, 'application');
          fade(g, ramp(u, 7.4, 0.5), () => { mark(g, false, L0.x + L0.w + 26, 248, 18); txt(g, '앞에 짝이 없어요', ap.x + ap.w / 2, 296, { size: 18, weight: 700, color: COL.bad, align: 'center' }); });
          sayLay(L0, s0);
        } else {
          morph(g, L0, L1, jp);
          if (jp >= 1) { mark(g, true, L1.x + L1.w + 26, 248, 18); sayLay(L1, s1); }
        }
      });
      // 짝이 되는 한정사들
      const dets = [['a', 'an'], ['the', 'the'], ['your', 'your'], ['this', 'this']];
      let x = 330;
      dets.forEach(([d, t], i) => fade(g, ramp(u, 13 + i * 0.7, 0.5) * topA, () => {
        const ok = NA.judgePhrase({ det: d, noun: 'application', num: 'sg' }).s === 'ok';
        const c = chip(g, t + ' application', x, 312, { size: 19, weight: 700, color: COL.det, fill: COL.panel2, stroke: COL.det, h: 38, r: 10 });
        mark(g, ok, c.x + c.w + 16, 312, 13);
        say(c.x, c.y, c.w, c.h, t + ' application');
        x = c.x + c.w + 44;
      }));
      // 표: 짝 없이 다닐 수 있나
      const rows = [
        ['C1', '셀 수 있는 단수', { noun: 'application', num: 'sg' }, 'an application · the application'],
        ['C2', '셀 수 있는 복수', { noun: 'application', num: 'pl' }, 'Applications are accepted online.'],
        ['U', '셀 수 없는 명사', { noun: 'information', num: 'sg' }, 'Information is available online.'],
      ];
      fade(g, ramp(u, 18.0, 0.6), () => {
        panel(g, LX - 10, 356, 1140, 206, { fill: COL.panel, stroke: COL.faint });
        txt(g, '명사', LX + 20, 378, { size: 15, weight: 700, color: COL.muted });
        txt(g, '짝 없이', 470, 378, { size: 15, weight: 700, color: COL.muted, align: 'center' });
        txt(g, '예', 580, 378, { size: 15, weight: 700, color: COL.muted });
      });
      rows.forEach(([cat, name, p, ex], i) => fade(g, ramp(u, 18.4 + i * 1.2, 0.5), () => {
        const y = 420 + i * 48, ok = NA.judgePhrase(p).s === 'ok';
        iconCat(g, cat, LX + 34, y, 18, catColor(cat));
        txt(g, name, LX + 62, y + 1, { size: 20, weight: 700, color: catColor(cat) });
        mark(g, ok, 470, y, 16);
        const R2 = { Applications: { r: 'n', tail: 's' }, Information: 'u', application: 'n', an: 'det', the: 'det' };
        const L = lay(g, toks(ex, R2, 'r' + i), { x: 580, y, size: 21 });
        drawLay(g, L); sayLay(L, ex);
      }));
      // a / an: 뒤 낱말의 첫 소리
      fade(g, ramp(u, 24, 0.6), () => {
        txt(g, 'a / an → 뒤 낱말의 첫 소리로', W / 2, 172, { size: 22, weight: 700, color: COL.det, align: 'center' });
        const ex = [['an', 'application', '모음 소리로 시작'], ['an', 'hour', 'h를 읽지 않음'], ['a', 'university', '‘유’ 소리로 시작'], ['a', 'uniform', '‘유’ 소리로 시작']];
        ex.forEach(([d, w, note], i) => {
          const cx = 240 + i * 270, y = 236, ok = NA.aan(w) === d;
          if (!ok) console.warn('[명사·관사] a/an 예가 규칙 엔진과 달라요:', d, w);
          const L = lay(g, [{ id: 'd', t: d, r: 'det' }, { id: 'w', t: w, r: 'n' }], { x: cx, y, size: 26, align: 'center' });
          drawLay(g, L); sayLay(L, d + ' ' + w);
          txt(g, note, cx, 282, { size: 15, weight: 600, color: COL.muted, align: 'center' });
        });
      });
    },

    /* 04 셀 수 없는 명사: 한국어는 셀 수 있음 → 영어는 묶음의 이름 → -s·a 안 됨 → piece로 세기 */
    uncount(g, u) {
      const ko = ['정보 몇 개', '조언 하나', '가구 두 개'];
      fade(g, ramp(u, 0.4, 0.5), () => label(g, '한국어', LX, 168, { size: 16, color: COL.soft }));
      ko.forEach((k, i) => fade(g, ramp(u, 0.8 + i * 0.5, 0.5), () => {
        const c = chip(g, k, 170 + i * 200, 168, { size: 19, weight: 700, color: COL.text, fill: COL.panel2, h: 38, r: 10 });
        check(g, c.x + c.w + 14, 168, 12, COL.muted);
      }));
      fade(g, ramp(u, 2.6, 0.5), () => txt(g, '→ 자연스러워요', 790, 168, { size: 17, weight: 600, color: COL.muted }));
      const words = ['information', 'advice', 'equipment', 'feedback', 'luggage', 'furniture'];
      fade(g, ramp(u, 6.0, 0.5), () => label(g, '영어', LX, 228, { size: 16, color: COL.soft }));
      let x = 140;
      words.forEach((w, i) => fade(g, ramp(u, 6.4 + i * 0.45, 0.4), () => {
        if (NA.noun(w).c) console.warn('[명사·관사] 셀 수 없는 명사 목록이 사전과 달라요:', w);
        const tw0 = tw(g, w, 19, 700);
        rr(g, x, 210, tw0 + 54, 38, 10); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = COL.u; g.lineWidth = 1.5; g.stroke();
        iconCat(g, 'U', x + 18, 229, 15, COL.u);
        txt(g, w, x + 36, 230, { size: 19, weight: 700, color: COL.u });
        say(x, 210, tw0 + 54, 38, w);
        x += tw0 + 70;
      }));
      // 묶음 상자
      const boxes = [
        { name: 'furniture', ko: '가구', at: 12.2, items: [['chair', 'chair'], ['desk', 'desk'], ['table', 'table']] },
        { name: 'luggage', ko: '짐', at: 18.0, items: [['suitcase', 'suitcase'], ['bag', 'bag']] },
        { name: 'equipment', ko: '장비', at: 19.8, items: [['monitor', 'monitor'], ['printer', 'printer']] },
      ];
      boxes.forEach((b, i) => fade(g, ramp(u, b.at, 0.6), () => {
        const x0 = 100 + i * 370, y0 = 276, w = 340, h = 166;
        panel(g, x0, y0, w, h, { fill: COL.panel, stroke: COL.u, lw: 2 });
        iconCat(g, 'U', x0 + 26, y0 + 26, 16, COL.u);
        txt(g, b.name, x0 + 46, y0 + 27, { size: 22, weight: 700, color: COL.u });
        txt(g, b.ko + ' = 묶음의 이름', x0 + w - 18, y0 + 27, { size: 15, weight: 600, color: COL.muted, align: 'right' });
        say(x0, y0, w, 50, b.name);
        b.items.forEach(([k, name], j) => {
          const n = b.items.length, cx = x0 + w / 2 + (j - (n - 1) / 2) * 100, a = ramp(u, b.at + 0.5 + j * 0.35, 0.4);
          fade(g, a, () => {
            thing(g, k, cx, y0 + 84, 44, COL.n);
            txt(g, name, cx, y0 + 136, { size: 16, weight: 600, color: COL.n, align: 'center' });
          });
        });
      }));
      fade(g, ramp(u, 20.6, 0.5), () => txt(g, '안의 물건(chair · bag · printer) → 셀 수 있어요', W / 2, 462, { size: 16, weight: 600, color: COL.n, align: 'center' }));
      // 틀린 모양
      const wrong = [{ det: 'a', noun: 'information', num: 'sg' }, { noun: 'information', num: 'pl' }, { det: 'a', noun: 'advice', num: 'sg' }, { noun: 'furniture', num: 'pl' }];
      phraseRow(g, wrong.map(p => ({ p, exp: false })), W / 2, 502, { size: 22, gap: 60, pre: 'w', a: i => ramp(u, 23.8 + i * 0.6, 0.5) });
      // 세는 말
      const piece = [{ det: 'a', noun: 'piece of information', num: 'sg' }, { det: 'two', noun: 'piece of luggage', num: 'pl' }];
      phraseRow(g, piece.map(p => ({ p, exp: true })), W / 2, 550, { size: 24, gap: 90, pre: 'pc', a: i => ramp(u, 29.4 + i * 0.9, 0.5) });
    },

    /* 05 수량 표현의 짝: 세 칸(단수 · 복수 · 셀 수 없음) → 둘 다 → each of the */
    pairs(g, u) {
      const cols = [
        { cat: 'C1', name: '셀 수 있는 단수', at: 6.2, dets: ['each', 'every', 'another', 'a / an'], ex: { det: 'each', noun: 'candidate', num: 'sg' }, bad: { det: 'each', noun: 'candidate', num: 'pl' } },
        { cat: 'C2', name: '셀 수 있는 복수', at: 12.2, dets: ['several', 'a few', 'many', 'a number of'], ex: { det: 'several', noun: 'candidate', num: 'pl' }, bad: { det: 'several', noun: 'candidate', num: 'sg' } },
        { cat: 'U', name: '셀 수 없는 명사', at: 18.2, dets: ['much', 'a little', 'a great deal of'], ex: { det: 'much', noun: 'information', num: 'sg' }, bad: { det: 'much', noun: 'candidate', num: 'pl' } },
      ];
      cols.forEach((c, i) => {
        const x0 = 80 + i * 390, w = 350, cx = x0 + w / 2, col = catColor(c.cat);
        fade(g, ramp(u, 0.6 + i * 0.3, 0.5), () => {
          panel(g, x0, 148, w, 52, { fill: COL.panel2, stroke: u > c.at ? col : COL.faint, lw: u > c.at ? 2 : 1.5 });
          iconCat(g, c.cat, x0 + 32, 174, 20, col);
          txt(g, c.name, x0 + 62, 175, { size: 21, weight: 700, color: col });
        });
        c.dets.forEach((d, k) => {
          const a = ramp(u, c.at + 0.3 + k * 0.45, 0.45);
          fade(g, a, () => chip(g, d, cx, 236 + k * 44 - (1 - a) * 22, { size: 19, weight: 700, color: COL.det, fill: COL.panel, stroke: COL.det, align: 'center', h: 36, r: 10 }));
        });
        fade(g, ramp(u, c.at + 2.6, 0.5), () => {
          phraseAt(g, c.ex, cx - 10, 422, { size: 24, align: 'center', pre: 'e' + i, expect: true });
          fade(g, ramp(u, c.at + 3.6, 0.5), () => phraseAt(g, c.bad, cx - 10, 462, { size: 19, align: 'center', pre: 'x' + i, expect: false }));
        });
      });
      // 둘 다와 짝
      fade(g, ramp(u, 24.2, 0.6), () => {
        panel(g, 470, 494, 740, 70, { fill: COL.panel, stroke: COL.det });
        iconCat(g, 'C2', 500, 529, 16, COL.n); iconCat(g, 'U', 532, 529, 14, COL.u);
        txt(g, 'all · most · some · a lot of · plenty of', 560, 516, { size: 19, weight: 700, color: COL.det });
        const L1 = phraseAt(g, { det: 'most', noun: 'candidate', num: 'pl' }, 560, 546, { size: 17, pre: 'b1', expect: true, mark: false });
        phraseAt(g, { det: 'most', noun: 'information', num: 'sg' }, L1.x + L1.w + 36, 546, { size: 17, pre: 'b2', expect: true, mark: false });
        txt(g, '복수 + 셀 수 없음', 1190, 516, { size: 15, weight: 600, color: COL.muted, align: 'right' });
      });
      // each of the + 복수
      fade(g, ramp(u, 30.2, 0.6), () => {
        panel(g, 80, 494, 350, 70, { fill: COL.panel, stroke: COL.trap });
        const L = phraseAt(g, { det: 'each', of: 'the', noun: 'candidate', num: 'pl' }, 255, 520, { size: 22, align: 'center', pre: 'eo', expect: true });
        const of = L.items.find(t => t.id === 'eoof');
        txt(g, '‘그 무리 가운데’ → 복수', 255, 550, { size: 15, weight: 700, color: COL.trap, align: 'center' });
        void of;
      });
    },

    /* 06 almost · most · most of */
    most(g, u) {
      fade(g, ramp(u, 0.4, 0.5), () => {
        chip(g, '직원 대부분', LX, 164, { size: 20, weight: 700, color: COL.text, fill: COL.panel2, h: 40, r: 10 });
        arrow(g, 230, 164, 290, 164, COL.line, 2);
      });
      ['almost', 'most', 'most of'].forEach((d, i) => fade(g, ramp(u, 1.6 + i * 0.5, 0.4), () => chip(g, d, 310 + i * 140, 164, { size: 20, weight: 700, color: COL.det, fill: COL.panel, stroke: COL.det, h: 40, r: 10 })));
      const row = (y, name, sub, at) => fade(g, ramp(u, at, 0.5), () => {
        panel(g, LX - 10, y - 44, 1140, 98, { fill: COL.panel, stroke: COL.faint });
        txt(g, name, LX + 14, y - 8, { size: 22, weight: 700, color: COL.det });
        txt(g, sub, LX + 14, y + 24, { size: 15, weight: 600, color: COL.muted });
      });
      // most + 명사
      row(254, 'most', '명사 바로 앞', 6.0);
      fade(g, ramp(u, 6.8, 0.5), () => phraseAt(g, { det: 'most', noun: 'employee', num: 'pl' }, 300, 254, { size: 26, pre: 'm1', expect: true }));
      fade(g, ramp(u, 10.0, 0.5), () => phraseAt(g, { det: 'most', noun: 'equipment', num: 'sg' }, 720, 254, { size: 26, pre: 'm2', expect: true }));
      // most of + the + 명사 (the를 빼면 ×)
      row(364, 'most of', 'of → ‘~ 가운데’', 12.0);
      const P1 = { det: 'most', of: 'the', noun: 'employee', num: 'pl' }, P0 = { det: 'most', of: 'bare', noun: 'employee', num: 'pl' };
      if (NA.judgePhrase(P1).s !== 'ok' || NA.judgePhrase(P0).s === 'ok') console.warn('[명사·관사] 06장 most of 예가 규칙 엔진과 달라요');
      const LP1 = lay(g, phraseToks(P1, 'mo'), { x: 300, y: 356, size: 26 }), LP0 = lay(g, phraseToks(P0, 'mo'), { x: 300, y: 356, size: 26 });
      // of the → of: 같은 조각(id)이라 글자가 겹쳐 바뀜. 18.6초에 the가 빠지고 22초에 돌아옴
      const drop = clamp((u - 18.6) / 0.8) - clamp((u - 22.0) / 0.8);
      fade(g, ramp(u, 12.6, 0.5), () => {
        const ok = drop < 0.5, L = ok ? LP1 : LP0;
        if (drop > 0 && drop < 1) morph(g, LP1, LP0, drop); else drawLay(g, L, () => (ok ? {} : { strike: true }));
        mark(g, ok, L.x + L.w + 20, 356, 16);
        sayLay(L, NA.text(ok ? P1 : P0));
        if (!ok) fade(g, ramp(u, 19.4, 0.4) * (1 - ramp(u, 21.8, 0.4)), () => txt(g, '어느 무리 가운데? → the · our가 필요해요', 300, 392, { size: 16, weight: 700, color: COL.bad }));
      });
      fade(g, ramp(u, 14.4, 0.5), () => phraseAt(g, { det: 'most', of: 'our', noun: 'customer', num: 'pl' }, 720, 356, { size: 26, pre: 'm3', expect: true }));
      // almost + all
      row(474, 'almost', '‘거의’ → 부사', 24.0);
      const Q0 = { det: 'almost', noun: 'employee', num: 'pl' }, Q1 = { det: 'almostall', noun: 'employee', num: 'pl' };
      if (NA.judgePhrase(Q0).s === 'ok' || NA.judgePhrase(Q1).s !== 'ok') console.warn('[명사·관사] 06장 almost 예가 규칙 엔진과 달라요');
      const t0 = [{ id: 'q0', t: 'almost', r: 'det' }, { id: 'q2', t: 'employees', r: 'n', tail: 's' }];
      const t1 = [{ id: 'q0', t: 'almost', r: 'det' }, { id: 'q1', t: 'all', r: 'det' }, { id: 'q2', t: 'employees', r: 'n', tail: 's' }];
      const LQ0 = lay(g, t0, { x: 300, y: 466, size: 26 }), LQ1 = lay(g, t1, { x: 300, y: 466, size: 26 });
      const ins = ramp(u, 28.4, 0.9);
      fade(g, ramp(u, 24.6, 0.5), () => {
        if (ins <= 0) {
          drawLay(g, LQ0, () => ({ strike: true })); mark(g, false, LQ0.x + LQ0.w + 20, 466, 16); sayLay(LQ0, 'almost employees');
          fade(g, ramp(u, 25.4, 0.4), () => txt(g, '부사는 명사 앞에 바로 못 와요', 300, 502, { size: 16, weight: 700, color: COL.bad }));
        } else { morph(g, LQ0, LQ1, ins); if (ins >= 1) { mark(g, true, LQ1.x + LQ1.w + 20, 466, 16); sayLay(LQ1, 'almost all employees'); } }
      });
      fade(g, ramp(u, 28.8, 0.5), () => {
        txt(g, '거의', 720, 466, { size: 24, weight: 700, color: COL.soft });
        const w0 = tw(g, '거의 ', 24, 700);
        txt(g, '모든', 720 + w0, 466, { size: 24, weight: 800, color: COL.ans });
        txt(g, '직원', 720 + w0 + tw(g, '모든 ', 24, 800), 466, { size: 24, weight: 700, color: COL.soft });
        txt(g, '거의 직원 → 어색해요', 720, 500, { size: 15, weight: 600, color: COL.muted });
      });
    },

    /* 07 숫자-하이픈과 another: three days → a three-day workshop / another = an + other */
    hyphen(g, u) {
      const A = [{ id: 'The', t: 'The', r: 'fn' }, { id: 'w', t: 'workshop', r: 'n' }, { id: 'lasts', t: 'lasts', r: '' }, { id: 't3', t: 'three', r: 'det' }, { id: 'd', t: 'days', r: 'n', tail: 's' }, { id: 'dot', t: '.', r: '' }];
      const B = [{ id: 'a', t: 'a', r: 'det' }, { id: 't3', t: 'three', r: 'hy' }, { id: 'h', t: '-', r: 'hy', nb: true }, { id: 'd', t: 'day', r: 'hy', nb: true }, { id: 'w', t: 'workshop', r: 'n' }];
      const LA = lay(g, A, { x: LX, y: 190, size: 32 }), LB = lay(g, B, { x: LX + 60, y: 286, size: 40 });
      const top = 1 - ramp(u, 22.6, 0.6) * 0.55, dimA = 1 - 0.5 * ramp(u, 6.2, 0.6);
      if (NA.judgePhrase({ det: 'three', noun: 'day', num: 'pl' }).s !== 'ok' || NA.judgePhrase({ det: 'a', hyw: ['three', 'day'], hy: 'sg', noun: 'workshop', num: 'sg' }).s !== 'ok') console.warn('[명사·관사] 07장 예가 규칙 엔진과 달라요');
      const leave = { t3: 6.4, d: 6.8, w: 9.0 };   // 아래로 내려가는 조각은 떠나는 동안 원래 자리를 비움
      fade(g, ramp(u, 0.4, 0.6) * top, () => {
        drawLay(g, LA, tk => ({ a: leave[tk.id] != null && u >= leave[tk.id] && u < 10.6 ? 0.12 : dimA }));
        sayLay(LA, 'The workshop lasts three days.');
        fade(g, ramp(u, 2.4, 0.5) * (1 - ramp(u, 6.0, 0.4)), () => { const d = byText(LA, 'days'); txt(g, '사흘 → 복수 days', d.x + d.w + 30, 190, { size: 18, weight: 700, color: COL.ans }); });
      });
      // 조각이 하나씩 내려와 a three-day workshop이 됨: three → days(-s가 떨어짐) → 하이픈 → workshop → a
      const mv = (id, at, o = {}) => {
        const p = ease(clamp((u - at) / 1.0)); if (p <= 0) return;
        const a = LA.byId[id], b = LB.byId[id];
        const m = Object.assign({}, b, o.tok || {}, { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) - Math.sin(Math.PI * p) * 24, size: lerp(a.size, b.size, p) });
        drawTok(g, m, { plain: p < 1 });
      };
      if (u < 10.6) fade(g, top, () => {
        mv('t3', 6.4, { tok: { r: 'hy' } });
        const dp = clamp((u - 6.8) / 1.0);
        if (dp > 0) {
          const keepS = u < 7.9;
          mv('d', 6.8, { tok: keepS ? { t: 'days', tail: 's', r: 'hy' } : { t: 'day', r: 'hy' } });
          const fp = clamp((u - 7.9) / 1.1), b = LB.byId.d;
          if (!keepS && fp < 1) fade(g, 1 - fp, () => txt(g, 's', b.x + tw(g, 'day', 40, 600), 286 + 4 + 80 * fp * fp, { size: 40, weight: 600, color: COL.ans }));
        }
        fade(g, ramp(u, 8.8, 0.4), () => drawTok(g, LB.byId.h));
        mv('w', 9.0);
        fade(g, ramp(u, 9.8, 0.4), () => drawTok(g, LB.byId.a));
      });
      else fade(g, top, () => { drawLay(g, LB); mark(g, true, LB.x + LB.w + 26, 286, 18); sayLay(LB, 'a three-day workshop'); });
      fade(g, ramp(u, 12.2, 0.5) * top, () => {
        chip(g, '숫자-명사 꾸밈말 → -s 없이 단수', LX, 360, { size: 19, weight: 700, color: COL.n, fill: COL.panel2, stroke: COL.n, h: 40, r: 10 });
        fade(g, ramp(u, 14.6, 0.5), () => phraseAt(g, { det: 'a', hyw: ['three', 'day'], hy: 'pl', noun: 'workshop', num: 'sg' }, 520, 360, { size: 22, pre: 'hb', expect: false }));
      });
      fade(g, ramp(u, 18.2, 0.5) * top, () => {
        txt(g, '한국어: 3일짜리 워크숍', 880, 360, { size: 19, weight: 700, color: COL.soft });
        const ex = [{ det: 'a', hyw: ['10', 'page'], hy: 'sg', noun: 'report', num: 'sg' }, { det: 'a', hyw: ['two', 'hour'], hy: 'sg', noun: 'meeting', num: 'sg' }, { det: 'a', hyw: ['five', 'year'], hy: 'sg', noun: 'contract', num: 'sg' }];
        phraseRow(g, ex.map(p => ({ p, exp: true })), W / 2, 414, { size: 22, gap: 60, pre: 'hx', a: i => ramp(u, 18.8 + i * 0.7, 0.5) });
      });
      // another = an + other → 단수 / other → 복수
      fade(g, ramp(u, 23.0, 0.6), () => {
        panel(g, LX - 10, 452, 1140, 114, { fill: COL.panel, stroke: COL.det });
        const a0 = [{ id: 'an', t: 'another', r: 'det' }], a1 = [{ id: 'an', t: 'an', r: 'det' }, { id: 'oth', t: '+ other', r: 'det' }];
        const L0 = lay(g, a0, { x: LX + 20, y: 494, size: 28 }), L1 = lay(g, a1, { x: LX + 20, y: 494, size: 28 });
        const sp = ramp(u, 23.8, 0.8);
        if (sp <= 0) drawLay(g, L0); else morph(g, L0, L1, sp);
        fade(g, ramp(u, 24.8, 0.5), () => txt(g, 'an = 하나 → 단수', LX + 20, 538, { size: 17, weight: 700, color: COL.ans }));
        fade(g, ramp(u, 25.6, 0.5), () => {
          txt(g, '하나 → 단수', 430, 474, { size: 14, weight: 700, color: COL.muted });
          phraseAt(g, { det: 'another', noun: 'date', num: 'sg' }, 430, 506, { size: 24, pre: 'an1', expect: true });
          phraseAt(g, { det: 'another', noun: 'date', num: 'pl' }, 430, 544, { size: 19, pre: 'an2', expect: false });
        });
        fade(g, ramp(u, 28.2, 0.5), () => {
          txt(g, '여럿 → 복수', 790, 474, { size: 14, weight: 700, color: COL.muted });
          phraseAt(g, { det: 'other', noun: 'supplier', num: 'pl' }, 790, 506, { size: 24, pre: 'ot1', expect: true });
          phraseAt(g, { det: 'other', noun: 'supplier', num: 'sg' }, 790, 544, { size: 19, pre: 'ot2', expect: false });
        });
      });
    },

    /* 08 3단계 풀이법 흐름도 */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 셀 수 있나?', sub: '명사부터', at: 5.6, boxes: [
          ['셀 수 있음', 'application · candidate · day', 'n'], ['셀 수 없음', 'information · equipment · advice', 'u']] },
        { x: 480, head: '② 하나인가 여럿인가?', sub: '-s · 단서', at: 11.6, boxes: [
          ['단수 · 하나', '-s 없음 · each · is', 'n'], ['복수 · 여럿', '-s · several · are', 'n'], ['셀 수 없음', '늘 -s 없이 한 덩어리', 'u'], ['숫자-하이픈 꾸밈말', 'a three-day workshop → 단수', 'n']] },
        { x: 880, head: '③ 짝이 맞나?', sub: '한정사 · 수량 표현', at: 18.2, boxes: [
          ['단수의 짝', 'a/an · each · every · another', 'det'], ['복수의 짝', 'several · a few · many · a number of', 'det'], ['셀 수 없는 명사의 짝', 'much · a little · a great deal of', 'det'],
          ['둘 다와 짝', 'all · most · some · a lot of · the', 'det'], ['함정', 'almost all · most of the · each of the', 'trap']] },
      ];
      const P = S.path, r = P ? NA.judgePhrase(P) : null;
      let on = null;
      if (P) {
        const d = NA.det(P.det || 'zero'), cat = NA.catOf(P);
        const c1 = (P.hyw ? NA.noun(P.hyw[1]).c : cat !== 'U') ? 0 : 1;
        const c2 = P.hyw ? 3 : cat === 'U' ? 2 : cat === 'C2' ? 1 : 0;
        const c3 = d.adv || d.pron || P.of || d.id === 'almostall' || d.id === 'almostevery' ? 4 : d.grp === 'one' ? 0 : d.grp === 'many' ? 1 : d.grp === 'mass' ? 2 : 3;
        on = [c1, c2, c3];
      }
      const colOf = { n: COL.n, u: COL.u, det: COL.det, trap: COL.trap };
      cols.forEach((c, ci) => {
        fade(g, ramp(u, c.at, 0.6), () => {
          panel(g, c.x, 146, 340, 58, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 18, 175, { size: 21, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 324, 175, { size: 14, weight: 600, color: COL.muted, align: 'right' });
          c.boxes.forEach(([k, v, key], bi) => {
            const y = 216 + bi * 64, at = c.at + 0.5 + bi * 0.5, hit = on && on[ci] === bi;
            const bad = hit && r && r.fail === ci;
            fade(g, ramp(u, at, 0.5) * (on && !hit ? 0.4 : 1), () => {
              panel(g, c.x, y, 340, 56, { fill: hit ? (bad ? 'rgba(255,107,107,0.12)' : 'rgba(255,193,94,0.14)') : COL.panel, stroke: hit ? (bad ? COL.bad : COL.ans) : COL.faint, lw: hit ? 2.5 : 1.5 });
              txt(g, k, c.x + 14, y + 18, { size: 15, weight: 700, color: COL.soft });
              txt(g, v, c.x + 14, y + 39, { size: 15.5, weight: 700, color: colOf[key] });
              if (hit && r && (r.fail < 0 || ci <= r.fail)) mark(g, r.fail < 0 || ci < r.fail, c.x + 318, y + 18, 12);
            });
          });
          if (ci < 2) fade(g, ramp(u, cols[ci + 1].at - 0.3, 0.5), () => arrow(g, c.x + 346, 175, c.x + 394, 175, COL.accent, 3));
        });
      });
      if (P && r) {
        const t = r.s === 'ok' ? `통과: ${NA.text(P)}` : `${NA.GATE[r.fail]}에서 멈춤 · ${NA.text(P)}${r.fix ? ' → ' + r.fix.text : ''}`;
        chip(g, t, 480 + 170, 556, { size: 17, weight: 700, color: r.s === 'ok' ? COL.good : COL.bad, fill: COL.panel2, stroke: r.s === 'ok' ? COL.good : COL.bad, align: 'center', h: 40, r: 10 });
      }
    },

    /* 09 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = NA.DRILL[P.k];
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0], s2 = v >= P.at[1], s3 = v >= P.fill;
        const ans = it.opts[it.a][0], P0 = NA.phraseOf(it, it.a), nounW = NA.form(P0.noun, P0.num);
        const roles = {};
        nounW.split(' ').forEach(w => { roles[w] = { r: nounRole(P0.noun) }; });
        if (P0.num === 'pl') roles[nounW] = { r: nounRole(P0.noun), tail: NA.plParts(P0.noun)[1] };
        const T = toks(it.q, roles).map(tk => tk.r === 'blank' && s3 ? Object.assign(tk, { t: ans }) : tk);
        const L = lay(g, T, { x: LX, y: 222, size: 31, maxW: 1120, lh: 52 });
        // 문장 속 표시: ① 단계의 명사(m1), ② 단계의 단서(m2). 여러 낱말이면 이어진 토큰을 찾아 표시
        const cue = {};
        [[it.m1 || [], s1], [it.m2 || [], s2]].forEach(([ms, on]) => on && ms.forEach(m => {
          const ws = m.t.split(' ');
          for (let i = 0; i + ws.length <= L.items.length; i++) if (ws.every((w, j) => L.items[i + j].t === w)) {
            ws.forEach((w, j) => { const tk = L.items[i + j]; cue[tk.id] = m.role === 'ante' ? (PCOL[tk.r] || COL.n) : m.role === 'trap' ? COL.trap : COL.det; });
            break;
          }
        }));
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: s2 && !s3 ? 0.6 : 0 } : cue[tk.id] ? { cue: true, cueColor: cue[tk.id] } : {});
        sayLay(L, it.q.replace('___', ans));
        const oy = L.lines > 1 ? 340 : 312;
        it.opts.forEach(([o], k) => {
          const r = NA.judgeOpt(it, k), right = k === it.a;
          const goneAt = right ? 1e9 : P.gone[k];
          if (!right && (goneAt == null || goneAt < P.at[r.fail])) console.warn('[명사·관사] 실전 문제의 보기를 멈춘 문보다 먼저 지워요:', it.q, k);
          const y = oy + k * 56, gone = v >= goneAt, win = right && s3;
          txt(g, `(${'ABCD'[k]})`, LX, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, o, LX + 52, y, { size: 27, weight: win ? 700 : 600, color: win ? COL.good : gone ? COL.dim : COL.text });
          if (gone) {
            const gp = clamp((v - goneAt) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(LX - 4, y + 1); g.lineTo(LX - 4 + (w + 62) * gp, y + 1); g.stroke();
            fade(g, gp, () => txt(g, ['①', '②', '③'][r.fail] + ' ' + r.gates[r.fail].label, LX + 52 + w + 24, y + 1, { size: 15, weight: 700, color: COL.bad }));
          }
          if (win) { panel(g, LX - 14, y - 25, w + 84, 50, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, LX + w + 120, y, 18); }
        });
        panel(g, 640, oy - 40, 580, 236, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = oy - 4 + k * 72;
          txt(g, NA.GATE[k], 664, y, { size: 18, weight: 700, color: COL.accent });
          txt(g, ln, 664, y + 30, { size: 19, weight: 600, color: k === 2 ? COL.good : COL.soft });
        }));
      });
    },

    /* 10 정리 표 */
    summary(g, u) {
      const X = [80, 340, 820], Y0 = 146, RH = 50;
      const rows = [
        ['C1', '셀 수 있는 단수', 'a/an · the · 소유격 · each · every · another', { det: 'a', noun: 'application', num: 'sg' }],
        ['C2', '셀 수 있는 복수', 'several · a few · many · a number of · other', { det: 'several', noun: 'supplier', num: 'pl' }],
        ['U', '셀 수 없는 명사', 'much · a little · a great deal of (-s ×, a/an ×)', { det: 'agreatdealof', noun: 'information', num: 'sg' }],
        ['B', '복수 · 셀 수 없음 둘 다', 'all · most · some · a lot of · plenty of', { det: 'most', noun: 'employee', num: 'pl' }],
        ['T', '함정', 'almost all · most of the · each of the + 복수', { det: 'almostall', noun: 'customer', num: 'pl' }],
        ['H', '숫자-하이픈 꾸밈말', '-s 없이 단수', { det: 'a', hyw: ['two', 'week'], hy: 'sg', noun: 'training course', num: 'sg' }],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 10, 1160, RH * (rows.length + 1) + 14, { fill: COL.panel, stroke: COL.faint });
        ['명사', '짝 (한정사 · 수량 표현)', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 20, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 8, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.6, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 20, cat = r[0], col = cat === 'U' ? COL.u : cat === 'T' ? COL.trap : COL.n;
        if (['C1', 'C2', 'U'].includes(cat)) iconCat(g, cat, X[0] + 30, y, 15, col);
        txt(g, r[1], X[0] + 52, y, { size: 18, weight: 700, color: col });
        txt(g, r[2], X[1] + 20, y, { size: 17, weight: 600, color: COL.det });
        phraseAt(g, r[3], X[2] + 20, y, { size: 19, pre: 'sm' + ri, expect: true, mark: false });
      }));
      const steps = ['① 셀 수 있나?', '② 하나인가 여럿인가?', '③ 짝이 맞나?'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 6.5 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 540, { size: 20, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 48, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 540, c.x + c.w + 46, 540, COL.accent, 2.5);
        x = c.x + c.w + 58;
      }));
    },
  };
  // 문장 한 줄 (명사구 부분만 엔진으로 채점해 ✓/×)
  function phraseLine(g, s, p, x, y, pre) {
    const R = { Three: 'det', students: { r: 'n', tail: 's' }, student: 'n' };
    const ok = NA.judgePhrase(p).s === 'ok';
    const L = lay(g, toks(s, R, pre), { x, y, size: 24 });
    drawLay(g, L, tk => ok ? {} : tk.t === 'student' ? { color: COL.bad } : {});
    mark(g, ok, L.x + L.w + 20, y, 14);
    sayLay(L, s);
    return L;
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

  NS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[NS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, NS.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + NA.DRILL.map(d => d.q + d.opts.map(o => o[0]).join('')).join('') +
    Object.values(NA.NOUNS).map(n => n.sg + n.pl).join('') + Object.values(NA.DETS).map(d => d.t + d.ko).join('') + NA.GATE.join('') + GATE_SHORT.join('') +
    '셀수있음없는단수복수하나여럿덩어리짝통과멈춤고친말꾸밈말에숫자와못묶단위명사가아님대명사부사관사한정사' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←✓×?~=+-/:…‘’əaʊj';
  NS.baseText = EXTRA;
  NS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = NS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { NS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
