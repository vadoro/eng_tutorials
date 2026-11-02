/* 연결어 튜토리얼 — 영상 장면
 *
 * LV.render(g, t)는 시각 t와 사용자 상태 LV.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 영어 문장은 낱말 조각(토큰)으로 그리고, 연결어는 갈래마다 색을 칠한 조각으로 그립니다:
 * 접속사 민트(절과 같은 색) · 전치사 하늘(명사구와 같은 색) · 접속부사 라임(부사) · 동사 보라.
 * 빈칸은 분홍 점선 상자, 채운 답은 노란 상자, 절은 민트 테두리, 명사구는 하늘 테두리.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(LK.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const LK = window.LK;
  const LV = (window.LV = {});
  const W = 1280, H = 720;
  LV.W = W; LV.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  LV.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36',
    rel: '#FFC15E', gap: '#FF7AA8', trap: '#FF9F7A', bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
    // 연결어 갈래 색 (페이지 CSS의 --c-conj 등과 같은 뜻): 접속사 민트 · 전치사 하늘 · 접속부사 라임 · 동사 보라
    conj: '#7FE0A8', prep: '#6EC8FF', adv: '#D4E157', v: '#C9A7FF',
  };
  LV.COL = COL;
  const KC = { conj: COL.conj, prep: COL.prep, adv: COL.adv, pair: COL.conj, coord: COL.muted };
  const KEN = { conj: 'conjunction', prep: 'preposition', adv: 'conjunctive adverb', pair: 'paired conjunction' };
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (LV.S = { kind: null, mean: null, pair: null, adv: null, path: null });
  LV.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  LV.hits = () => HITS;

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
  // 갈래 이름표 (접속사 · 전치사 · 접속부사)
  function kindTag(g, kind, x, y, o = {}) {
    const size = o.size || 15;
    return chip(g, LK.KIND[kind], x, y, { size, weight: 700, color: KC[kind], fill: 'rgba(16,21,28,0.9)', stroke: KC[kind], align: o.align || 'center', h: size * 1.8, pad: 10, lw: 1.3 });
  }
  // 연결어 조각: 갈래 색으로 칠한 둥근 조각. 돌려주는 값: 너비
  function piece(g, s, kind, x, y, size = 24, o = {}) {
    const c = o.color || KC[kind] || COL.text, w = tw(g, s, size, 700) + size * 0.5, h = size * 1.22;
    const x0 = o.align === 'center' ? x - w / 2 : x;
    rr(g, x0, y - h / 2, w, h, 9); g.fillStyle = hexA(c, 0.16); g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.stroke();
    txt(g, s, x0 + w / 2, y + 1, { size, weight: 700, color: c, align: 'center' });
    return w;
  }

  /* ---------- 영어 문장 토큰 배치와 그리기 ---------- */
  // 토큰 { id, t: 글자, r: 역할 }. 역할: conj·prep·adv·pair(연결어 조각) · v 동사 · fn 기능어 · blank 빈칸 · ans 채운 답 · bad 틀림 · stop 마침표 강조 · '' 보통
  const KR = { conj: 1, prep: 1, adv: 1, pair: 1 };
  const RCOL = { v: COL.v, fn: COL.muted, trap: COL.trap, bad: COL.bad, good: COL.good, dim: COL.dim, stop: COL.trap };
  const PUNCT = /^[.,;?!]$/;
  const tokW = (g, tk, size) => tk.r === 'blank' ? Math.max(size * 2.8, tk.t ? tw(g, tk.t, size, 700) + size * 0.7 : 0) :
    tk.r === 'ans' || KR[tk.r] ? tw(g, tk.t, size, 700) + size * 0.5 : tw(g, tk.t, size, tk.r === 'v' ? 600 : 500);
  // 한 줄(또는 maxW를 넘으면 여러 줄)로 배치. o: { x, y, size, align: 'left' | 'center', maxW, lh }
  function lay(g, toks, o) {
    const size = o.size || 34, sp = size * 0.3, maxW = o.maxW || 1e9, lh = o.lh || size * 1.65;
    const lines = [[]]; let x = 0;
    toks.forEach(tk => {
      const punct = PUNCT.test(tk.t) && tk.r !== 'blank', w = punct ? tw(g, tk.t, size, tk.r === 'stop' ? 800 : 500) : tokW(g, tk, size);
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
  // 문자열 → 토큰 (띄어쓰기로 자르고 마침표·쉼표·세미콜론은 따로). roles: { '글자': 역할 }, ___는 빈칸, prior_to처럼 _로 이은 말은 한 조각
  // 부호의 역할(예: '.': 'stop')은 처음 나오는 부호에만 붙음 (문장 사이의 마침표만 강조하고 끝 마침표는 그대로)
  function toks(s, roles = {}, pre = 't') {
    const out = [], usedP = new Set();
    s.split(' ').forEach(w => {
      const m = w.match(/^(.*?)([.,;?!]?)$/);
      const t = m[1].replace(/_/g, ' ');
      if (m[1]) out.push({ id: pre + out.length, t: m[1] === '___' ? '' : t, r: m[1] === '___' ? 'blank' : roles[t] || '' });
      if (m[2]) { out.push({ id: pre + out.length, t: m[2], r: usedP.has(m[2]) ? '' : roles[m[2]] || '' }); usedP.add(m[2]); }
    });
    return out;
  }
  const byText = (L, t) => L.items.find(i => i.t === t);
  const blankOf = L => L.items.find(i => i.r === 'blank' || i.r === 'ans');
  // 이어진 낱말 묶음 찾기 → { x, y, w, size }
  function seq(L, words) {
    const ws = words.split(' ');
    for (let i = 0; i + ws.length <= L.items.length; i++) {
      if (ws.every((w, k) => L.items[i + k].t === w)) {
        const a = L.items[i], b = L.items[i + ws.length - 1];
        return { x: a.x, y: a.y, w: b.x + b.w - a.x, size: a.size };
      }
    }
    return null;
  }
  // 묶음 표시 (절: 민트, 명사구: 하늘): 옅은 칠 + 아래 꺾쇠 + 이름표. 쉼표·이웃 조각과 부딪히지 않게 테두리는 두르지 않음
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
  // 토큰 하나 그리기. o: { a: 투명도, r: 역할 바꾸기, color, textColor, cue: 단서 상자, glow: 빈칸 반짝임 }
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
    } else if (KR[r]) {
      const c = o.color || KC[r], h = size * 1.2;
      rr(g, x, y - h / 2, w, h, 9); g.fillStyle = hexA(c, 0.16); g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.stroke();
      txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: c, align: 'center' });
    } else {
      const c = o.color || RCOL[r] || COL.text;
      txt(g, it.t, x, y + 1, { size, weight: r === 'v' ? 600 : r === 'stop' ? 800 : 500, color: c });
      if (r === 'v' && !o.plain) { g.fillStyle = c; g.fillRect(x, y + size * 0.56, w, 3); }
      if (r === 'bad') { g.strokeStyle = COL.bad; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x + w + 3, y + 2); g.stroke(); }
    }
    if (o.cue) { rr(g, x - 7, y - size * 0.68, w + 14, size * 1.36, 8); g.strokeStyle = COL.v; g.lineWidth = 2.2; g.stroke(); }
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
  const fillBlank = (T, w, kind) => T.map(t => t.r === 'blank' ? Object.assign({}, t, { t: w, k: kind }) : t);
  const blankStyle = (tk, glow) => tk.r === 'blank' ? (tk.t ? { color: KC[tk.k] || COL.rel, textColor: KC[tk.k] || COL.rel } : { glow }) : {};
  // 보기 하나를 빈칸에 넣어 보는 목록 (✓/×, 갈래 이름표, 짧은 까닭)
  function tryList(g, items, x, y, u, at, o = {}) {
    items.forEach(([w, kind, why], k) => {
      const a = ramp(u, at + k * (o.step || 0.9), 0.4), yy = y + k * (o.gap || 46);
      fade(g, a, () => {
        const ok = !why;
        mark(g, ok, x + 10, yy, 16);
        const ww = txt(g, w, x + 36, yy, { size: o.size || 25, weight: 700, color: ok ? KC[kind] : COL.muted });
        if (!ok) { g.strokeStyle = COL.bad; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 32, yy + 1); g.lineTo(x + 40 + ww, yy + 1); g.stroke(); }
        const tg = kindTag(g, kind, x + 52 + ww, yy, { size: 14, align: 'left' });
        if (why) txt(g, why, tg.x + tg.w + 14, yy, { size: 16, weight: 500, color: COL.muted });
      });
    });
  }

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '토익 Part 5의 단골', d: 24, caps: [
      [0.4, 5, '토익 Part 5의 단골, **연결어** 문제예요. 접속사, 전치사, 접속부사를 함께 다뤄요.'],
      [5, 10, '보기를 보세요. Although, Despite → 둘 다 뜻이 ‘~에도 불구하고’예요.'],
      [10, 14.5, '뜻이 같은데 정답은 하나뿐이에요. 무엇이 둘을 가를까요?'],
      [14.5, 19, '답은 빈칸 **뒤**에 있어요. 정답은 영상 끝에서 함께 풀어요.'],
      [19, 24, '연결어의 **세 갈래**, 뜻으로 고르기, 그리고 **3단계 풀이법**을 차례로 배워요.'],
    ] },
    { id: 'kinds', n: '01', title: '연결어 세 갈래', sub: '잇고 · 붙이고 · 가리키고', d: 34, caps: [
      [0.4, 6, '한국어부터 볼까요? 비가 왔지만, 비에도 불구하고, 비가 왔다. 그러나. 뜻은 모두 같아요.'],
      [6, 12, '그런데 모양이 달라요. ‘왔지만’은 두 문장을 하나로 잇고, ‘에도 불구하고’는 명사 ‘비’에 붙어요.'],
      [12, 17, '‘그러나’는 마침표로 끝난 문장 다음, 새 문장 맨 앞에 와요.'],
      [17, 23, '영어도 같아요. **접속사**(conjunction) although → 주어와 동사가 있는 덩어리, 곧 **절**(clause) 두 개를 이어요.'],
      [23, 28.5, '**전치사**(preposition) despite → 뒤에 명사를 붙여요. 주어와 동사는 오지 않아요.'],
      [28.5, 34, '**접속부사**(conjunctive adverb) however → 마침표 뒤 새 문장 앞에서 앞 문장을 가리켜요.'],
    ] },
    { id: 'clause', n: '02', title: '명사구냐 절이냐', sub: '빈칸 뒤의 동사 찾기', d: 32, caps: [
      [0.4, 6, '빈칸 뒤를 자세히 볼게요. 열쇠는 **동사**예요. 동사가 있으면 절, 없으면 명사구예요.'],
      [6, 12, '빈칸 뒤 → the heavy rain. 명사를 중심으로 모인 **명사구**(noun phrase), 동사가 없어요. 그래서 전치사 Despite.'],
      [12, 18, '빈칸 뒤를 바꿔 볼게요 → it rained heavily. 주어 it, 동사 rained. 절이니까 접속사 Although.'],
      [18, 25, '-ing(잉) 꼴에 속지 마세요. despite being late. 여기서 -ing(잉) 덩어리는 명사처럼 쓰는 **동명사**예요.'],
      [25, 32, '같은 뜻끼리 짝지어 외워요. although ↔ despite, because ↔ because of, while ↔ during.'],
    ] },
    { id: 'same', n: '03', title: '같은 뜻, 세 갈래', sub: '뜻과 갈래의 표', d: 28, caps: [
      [0.4, 6, '연결어를 표 하나로 정리해 볼게요. 가로줄은 **뜻**, 세로줄은 **갈래**예요.'],
      [6, 12, '대조 → although, despite, however. 뜻은 같고 갈래만 달라요.'],
      [12, 17.5, '이유 → because, because of. 결과를 이끄는 접속부사 → therefore.'],
      [17.5, 23, '시간 → while, during. 부정 조건 → unless, without, otherwise. 추가 → moreover.'],
      [23, 28, '문제를 풀 때는 먼저 세로줄에서 **갈래**를 정하고, 그다음 가로줄에서 **뜻**을 골라요.'],
    ] },
    { id: 'meaning', n: '04', title: '뜻으로 고르기', sub: '부사절 접속사', d: 34, caps: [
      [0.4, 6, '보기가 모두 접속사라면? 그때는 **뜻**으로 골라요. 토익에 자주 나오는 접속사를 볼게요.'],
      [6, 12.5, 'unless → ~하지 않으면, 곧 if … not. Unless you register by Friday.'],
      [12.5, 18, '그래서 이 문장은 금요일까지 등록하지 않으면 할인이 없다는 뜻이에요.'],
      [18, 24, 'once → 일단 ~하면. as long as, provided that → ~하는 한, ~라면.'],
      [24, 29, 'so that → ~하도록, 목적을 말해요. whereas → ~인 반면, 두 사실을 맞대요.'],
      [29, 34, 'even though → ~이긴 하지만. 대조의 뜻을 더 힘주어 말해요.'],
    ] },
    { id: 'pair', n: '05', title: '짝을 이루는 접속사', sub: 'either … or', d: 30, caps: [
      [0.4, 6, '두 낱말이 짝을 이루는 접속사도 있어요. 앞 낱말이 보이면 뒤 짝이 정해져요.'],
      [6, 12, 'either A or B, neither A nor B, both A and B, not only A but also B.'],
      [12, 18, '빈칸 앞에 either → 짝은 or. You can apply either online or by phone.'],
      [18, 24, '거꾸로 빈칸 뒤에 nor → 빈칸은 Neither. Neither the manager nor her assistant was available.'],
      [24, 30, '동사의 수도 짝이 정해요. both A and B → 복수 동사. either A or B → 동사는 가까운 쪽을 따라요.'],
    ] },
    { id: 'adv', n: '06', title: '접속부사는 혼자 못 잇는다', sub: '마침표 뒤의 연결어', d: 34, caps: [
      [0.4, 6, '**접속부사**는 뜻으로는 앞뒤를 잇지만, 문법으로는 두 절을 붙이지 못해요.'],
      [6, 12, '그래서 쉼표 하나로 두 절을 이으면 틀린 문장이 돼요. Sales rose, however profits fell.'],
      [12, 18, '고치는 방법은 셋이에요. 마침표로 끊거나, 세미콜론을 찍거나, 접속사로 바꿔요.'],
      [18, 24, '토익에서는 빈칸 앞이 마침표나 세미콜론이고, 뒤에 쉼표가 오면 **접속부사** 자리예요.'],
      [24, 29, 'however → 그러나, therefore → 그러므로, moreover → 게다가, otherwise → 그렇지 않으면.'],
      [29, 34, '이 자리에 접속사는 못 와요. 마침표 뒤 문장에는 절이 하나뿐이라 이을 짝이 없거든요.'],
    ] },
    { id: 'multi', n: '07', title: '덩어리 전치사', sub: '여러 낱말 · -ing 꼴', d: 30, caps: [
      [0.4, 6, '여러 낱말이 모여 전치사 하나처럼 쓰이는 말도 있어요. prior to, due to, on behalf of.'],
      [6, 12, '덩어리 전체가 **전치사**라서 뒤에 명사구가 와요. Prior to the meeting, please read the agenda.'],
      [12, 18, '-ing(잉)으로 끝나지만 전치사인 말도 있어요. following, including, regarding.'],
      [18, 24, 'following → ~ 뒤에, including → ~을 포함해, regarding → ~에 관해.'],
      [24, 30, '함정 하나. in addition to → 전치사, In addition → 접속부사. 끝의 낱말 하나로 갈래가 바뀌어요.'],
    ] },
    { id: 'method', n: '08', title: '3단계 풀이법', sub: '뒤 → 갈래 → 뜻', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11, '① **뒤**를 봐요. 빈칸 뒤가 명사구인지, 주어와 동사가 있는 절인지 확인해요.'],
      [11, 17.5, '② **갈래**를 정해요. 명사구면 전치사, 절이면 접속사, 마침표 뒤 쉼표 자리면 접속부사.'],
      [17.5, 23, '③ **뜻**을 골라요. 남은 보기 가운데 앞뒤 관계, 곧 대조·이유·조건·시간에 맞는 말이 답이에요.'],
      [23, 28, '짝 낱말이 보이면 짝을 맞추면 돼요. 이 순서로 토익 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '09', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '처음 본 문제예요. ① 빈칸 뒤 → the heavy rain. 동사가 없는 명사구예요.'],
      [6, 12, '② 명사구 앞 → **전치사** 자리. 접속사 둘과 접속부사 하나를 지워요.'],
      [12, 18, '③ 남은 Despite → ~에도 불구하고. 비가 와도 공연이 열렸으니 뜻도 맞아요. 정답은 (B).'],
      [18.4, 24.5, '두 번째 문제. ① 빈칸 뒤 → you register. 주어와 동사가 있는 절이에요.'],
      [24.5, 31, '② 절 앞 → **접속사** 자리. 전치사 하나를 지우면 접속사 셋이 남아요.'],
      [31, 37, '③ 등록하지 않으면 할인이 없다는 뜻 → unless. 정답은 (D).'],
      [37.4, 43.5, '세 번째. ① 빈칸 앞에 마침표, 뒤에 쉼표와 완전한 문장이 있어요.'],
      [43.5, 50, '② 마침표 뒤 쉼표 자리 → **접속부사**. 접속사와 전치사를 지우면 둘이 남아요.'],
      [50, 56, '③ 매출은 올랐는데 이익은 줄었어요. 반대니까 대조, However. 정답은 (B).'],
    ] },
    { id: 'summary', n: '10', title: '정리', sub: '한눈에 보는 연결어 표', d: 22, caps: [
      [0.4, 6, '정리해요. 연결어 문제는 뜻보다 먼저 빈칸 **뒤**를 봐요.'],
      [6, 12, '명사구가 오면 전치사, 주어와 동사가 오면 접속사, 마침표 뒤 쉼표 자리는 접속부사.'],
      [12, 17, '갈래로 보기를 줄인 다음, 남은 보기 가운데 **뜻**이 맞는 말을 골라요.'],
      [17, 22, '아래 연결어 조립대와 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  LV.CHAPTERS = CHAPTERS; LV.CAPTIONS = CAPTIONS; LV.END = END;
  LV.POSTER = CHAPTERS.find(c => c.id === 'kinds').t + 33;
  LV.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  LV.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(LK.DRILL)에서 세 개. 갈래 단계(②)에서 갈래가 맞지 않는 보기를 지우고, 뜻 단계(③)에서 답을 고름
  const PRACTICE = [
    { k: 0, at: [0.4, 6, 12], lines: ['빈칸 뒤 the heavy rain → 명사구', '명사구 앞 → 전치사만 남김', '비가 와도 공연 → 대조 → (B) Despite'] },
    { k: 4, at: [0.4, 6.3, 12.8], lines: ['빈칸 뒤 you register → 절', '절 앞 → 접속사, 전치사 Despite 지움', '안 하면 할인 없음 → (D) Unless'] },
    { k: 11, at: [0.4, 6.3, 12.8], lines: ['앞 마침표, 뒤 쉼표 + 문장', '→ 접속부사, Although · Despite 지움', '올랐다 ↔ 줄었다 → 대조 → (B) However'] },
  ];
  PRACTICE.forEach(p => {
    const it = LK.DRILL[p.k];
    if (!p.lines[2].includes(`(${'ABCD'[it.a]})`)) console.warn('[연결어] 실전 문제 정답 표시가 데이터와 달라요:', it.q);
    it.opts.forEach((w, i) => { if (LK.isOk(w, it.slot) !== (i === it.a)) console.warn('[연결어] 실전 문제가 규칙 엔진과 달라요:', it.q); });
  });
  // 짝 접속사 예문 (05장 직접 해 보기)
  const PAIR_EX = {
    either: 'You can apply either online or by phone.',
    neither: 'Neither the manager nor her assistant was available.',
    both: 'Both the manager and her assistant attended the meeting.',
    'not only': 'The new laptop is not only light but also fast.',
  };
  LV.PAIR_EX = PAIR_EX;
  // 06장 직접 해 보기: 부호와 연결어를 바꿔 보기 → 틀(frame)과 판정
  LV.advTry = function (p, w) {
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const frame = p === ',' ? 'cl' : 'adv';
    const text = p === ',' ? `Sales rose, ${w} profits fell.` : `Sales rose${p} ${p === '.' ? cap(w) : w}, profits fell.`;
    return { text, frame, j: LK.judge(w, { f: frame, m: 'contrast' }) };
  };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o)); }

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(뜻이 같은 Although · Despite) → 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '접속사냐 전치사냐,', W / 2, 262, { size: 62, weight: 800, fam: FD, align: 'center' });
        txt(g, '빈칸 뒤가 답한다', W / 2, 344, { size: 62, weight: 800, fam: FD, align: 'center', color: COL.accent });
        txt(g, 'Conjunctions · Prepositions · Conjunctive Adverbs', W / 2, 412, { size: 24, weight: 500, color: COL.muted, align: 'center' });
      });
      ['conj', 'prep', 'adv'].forEach((k, i) => {
        const a = ramp(u, 1.3 + i * 0.25, 0.4) * out1;
        fade(g, a, () => kindTag(g, k, W / 2 - 190 + i * 190, 488 + (1 - a) * 10, { size: 20 }));
      });
      const it = LK.DRILL[0];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 18.2, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 160, 1000, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 180, 202, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const L = lay(g, toks(it.q), { x: 180, y: 282, size: 30, maxW: 930 });
        const cueOn = u > 14.6;
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: cueOn ? 0.5 + 0.5 * Math.sin(u * 4) : 0 } : {});
        if (cueOn) gbox(g, seq(L, 'the heavy rain'), COL.prep, '빈칸 뒤', { a: ramp(u, 14.6, 0.5) });
        sayLay(L, it.q.replace('___', it.opts[it.a]));
        it.opts.forEach((o, k) => {
          const ox = 200 + (k % 2) * 400, oy = 408 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            const w = txt(g, o, ox + 64, oy, { size: 30, weight: 600 });
            if (k < 2) fade(g, ramp(u, 7.2 + k * 0.4, 0.4), () => { g.fillStyle = COL.rel; g.fillRect(ox + 64, oy + 19, w, 3); });
          });
        });
        fade(g, ramp(u, 8.2, 0.5), () => chip(g, '뜻은 같아요 · ~에도 불구하고', 1110, 408, { size: 17, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'right', h: 36 }));
        fade(g, ramp(u, 10.6, 0.5), () => chip(g, '그런데 정답은 하나', 1110, 470, { size: 17, weight: 700, color: COL.gap, fill: COL.panel2, stroke: COL.gap, align: 'right', h: 36 }));
      });
      const steps = [['①', '연결어 세 갈래', '접속사 · 전치사 · 접속부사'], ['②', '뜻으로 고르기', '대조 · 이유 · 조건 · 시간'], ['③', '3단계 풀이법', '뒤 → 갈래 → 뜻']];
      steps.forEach(([n, t1, t2], k) => {
        const a = ramp(u, 19.4 + k * 0.7, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 220, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 285 + (1 - a) * 16, { size: 34, weight: 700, color: COL.accent });
          txt(g, t1, x0 + 28, 345 + (1 - a) * 16, { size: 25, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 400 + (1 - a) * 16, { size: 19, weight: 500, color: COL.soft });
        });
      });
    },

    /* 01 연결어 세 갈래: 한국어(-지만 · 에도 불구하고 · 그러나) ↔ 영어(although · despite · however) */
    kinds(g, u) {
      const focus = S.kind, uu = focus ? Math.max(u, 34) : u;
      const ROWS = [
        { k: 'conj', ko: [['비가 '], ['왔지만', 'conj'], [', 공연은 계속됐어요.']], kdesc: '두 문장을 하나로', kat: 6.4,
          en: 'Although it rained, the concert continued.', roles: { Although: 'conj', rained: 'v', continued: 'v' }, at: 17.4 },
        { k: 'prep', ko: [['비', 'nbox'], ['에도 불구하고', 'prep'], [' 공연은 계속됐어요.']], kdesc: '명사에 붙어요', kat: 9.4,
          en: 'Despite the rain, the concert continued.', roles: { Despite: 'prep', continued: 'v' }, at: 23.4 },
        { k: 'adv', ko: [['비가 왔어요. '], ['그러나', 'adv'], [' 공연은 계속됐어요.']], kdesc: '새 문장 맨 앞', kat: 12.4,
          en: 'It rained. However, the concert continued.', roles: { However: 'adv', rained: 'v', continued: 'v', '.': 'stop' }, at: 28.9 },
      ];
      ROWS.forEach((R, i) => {
        const y0 = 162 + i * 136, ey = y0 + 50;
        fade(g, focus && focus !== R.k ? 0.25 : 1, () => {
          fade(g, ramp(uu, 0.6 + i * 0.5, 0.5), () => {
            let x = 300;
            R.ko.forEach(([s, r]) => {
              const hl = r && uu > R.kat - 0.2, c = hl && r !== 'nbox' ? KC[r] : COL.soft;
              const w = txt(g, s, x, y0, { size: 23, weight: hl ? 700 : 500, color: hl && r === 'nbox' ? COL.text : c });
              if (hl && r !== 'nbox') { g.fillStyle = c; g.fillRect(x, y0 + 16, w, 2.5); }
              if (hl && r === 'nbox') { rr(g, x - 5, y0 - 18, w + 10, 36, 7); g.strokeStyle = COL.prep; g.lineWidth = 1.6; g.stroke(); }
              x += w;
            });
            fade(g, ramp(uu, R.kat, 0.5), () => chip(g, R.kdesc, x + 24, y0, { size: 15, weight: 700, color: KC[R.k], fill: COL.panel2, stroke: KC[R.k], h: 30, r: 8, pad: 10 }));
          });
          const a = ramp(uu, R.at, 0.6);
          fade(g, a, () => {
            kindTag(g, R.k, LX, ey, { size: 18, align: 'left' });
            txt(g, KEN[R.k], LX + 2, ey + 31, { size: 12.5, weight: 500, fam: FM, color: COL.muted });
            const L = lay(g, toks(R.en, R.roles, 'k' + i), { x: 300, y: ey, size: 28 });
            drawLay(g, L);
            sayLay(L, R.en);
            const ba = ramp(uu, R.at + 1.4, 0.6);
            if (R.k === 'conj') {
              const A = seq(L, 'it rained'), B = seq(L, 'the concert continued');
              gbox(g, A, COL.conj, '절', { a: ba }); gbox(g, B, COL.conj, '절', { a: ba });
              fade(g, ramp(uu, R.at + 2.6, 0.6), () => chip(g, '절 + 절 → 한 문장', L.x + L.w + 30, ey, { size: 16, weight: 700, color: COL.conj, fill: COL.panel2, stroke: COL.conj, h: 34, r: 9 }));
            } else if (R.k === 'prep') {
              gbox(g, seq(L, 'the rain'), COL.prep, '명사구', { a: ba }); gbox(g, seq(L, 'the concert continued'), COL.conj, '절', { a: ba });
              fade(g, ramp(uu, R.at + 2.6, 0.6), () => chip(g, '전치사 + 명사구', L.x + L.w + 30, ey, { size: 16, weight: 700, color: COL.prep, fill: COL.panel2, stroke: COL.prep, h: 34, r: 9 }));
            } else {
              const A = seq(L, 'It rained'), hw = byText(L, 'However');
              gbox(g, A, COL.conj, '', { a: ba }); gbox(g, seq(L, 'the concert continued'), COL.conj, '', { a: ba });
              const ap = ramp(uu, R.at + 1.8, 1);
              if (ap > 0) {
                arc(g, hw.x + hw.w / 2, ey + 26, A.x + A.w / 2, ey + 26, -26, COL.adv, ap);
                fade(g, ramp(uu, R.at + 2.4, 0.5), () => txt(g, '앞 문장을 가리켜요', (hw.x + A.x + A.w) / 2, ey + 58, { size: 15, weight: 700, color: COL.adv, align: 'center' }));
              }
              fade(g, ramp(uu, R.at + 2.6, 0.6), () => chip(g, '마침표 뒤 + 쉼표', L.x + L.w + 30, ey, { size: 16, weight: 700, color: COL.adv, fill: COL.panel2, stroke: COL.adv, h: 34, r: 9 }));
            }
          });
        });
      });
    },

    /* 02 명사구냐 절이냐: the heavy rain → it rained heavily, -ing 꼴 함정, 같은 뜻 짝 */
    clause(g, u) {
      const T1 = toks('___ the heavy rain, the concert continued.', { continued: 'v' }, 'c');
      const T2 = toks('___ it rained heavily, the concert continued.', { rained: 'v', continued: 'v' }, 'c');
      const f1 = u > 9.6, f2 = u > 16.2;
      const A = lay(g, f1 ? fillBlank(T1, 'Despite', 'prep') : T1, { x: W / 2, y: 205, size: 34, align: 'center' });
      const B0 = lay(g, T2, { x: W / 2, y: 205, size: 34, align: 'center' });
      const B = lay(g, f2 ? fillBlank(T2, 'Although', 'conj') : T2, { x: W / 2, y: 205, size: 34, align: 'center' });
      const mp = clamp((u - 12.2) / 1.2), glow = 0.5 + 0.5 * Math.sin(u * 4);
      fade(g, ramp(u, 0.4, 0.6), () => {
        const st = tk => blankStyle(tk, glow);
        if (mp <= 0) drawLay(g, A, st); else if (mp < 1) morph(g, A, B0, mp, { style: st }); else drawLay(g, B, st);
      });
      if (mp <= 0) {
        sayLay(A, 'Despite the heavy rain, the concert continued.');
        gbox(g, seq(A, 'the heavy rain'), COL.prep, '명사구 · 동사 없음', { a: ramp(u, 6.4, 0.5) });
        fade(g, 1 - ramp(u, 11.6, 0.5), () => tryList(g, [['Although', 'conj', '접속사 → 뒤에 절이 와야 해요'], ['Despite', 'prep', '']], 330, 300, u, 7.4, { step: 1 }));
      } else if (mp >= 1) {
        sayLay(B, 'Although it rained heavily, the concert continued.');
        gbox(g, seq(B, 'it rained heavily'), COL.conj, '절 · 주어 it + 동사 rained', { a: ramp(u, 13.6, 0.5) });
        tryList(g, [['Despite', 'prep', '전치사 → 뒤에 명사구만 와요'], ['Although', 'conj', '']], 330, 300, u, 14.4, { step: 1 });
      }
      // -ing 꼴 함정
      fade(g, ramp(u, 18.2, 0.6), () => {
        panel(g, 70, 392, 550, 173, { fill: COL.panel2, stroke: COL.trap });
        txt(g, '-ing 꼴 함정', 94, 418, { size: 17, weight: 700, color: COL.trap });
        const L1 = lay(g, toks('despite being late', { despite: 'prep' }, 'i'), { x: 98, y: 460, size: 26 });
        drawLay(g, L1); sayLay(L1, 'despite being late');
        gbox(g, seq(L1, 'being late'), COL.prep, '동명사 = 명사 덩어리', { a: ramp(u, 19.6, 0.5), lsize: 13 });
        fade(g, ramp(u, 20.4, 0.4), () => mark(g, true, L1.x + L1.w + 30, 460, 16));
        const L2 = lay(g, toks('although she was late', { although: 'conj', was: 'v' }, 'j'), { x: 98, y: 532, size: 26 });
        fade(g, ramp(u, 21.6, 0.5), () => {
          drawLay(g, L2); sayLay(L2, 'although she was late');
          gbox(g, seq(L2, 'she was late'), COL.conj, '', { a: ramp(u, 22.4, 0.5) });
          fade(g, ramp(u, 22.8, 0.4), () => { mark(g, true, L2.x + L2.w + 30, 532, 16); txt(g, '← 절', L2.x + L2.w + 52, 532, { size: 15, weight: 700, color: COL.conj }); });
        });
      });
      // 같은 뜻 짝
      fade(g, ramp(u, 25.2, 0.6), () => {
        panel(g, 660, 392, 550, 173, { fill: COL.panel2, stroke: COL.faint });
        txt(g, '같은 뜻 짝', 684, 418, { size: 17, weight: 700, color: COL.soft });
        txt(g, '접속사 + 절', 900, 418, { size: 14, weight: 700, color: COL.conj, align: 'center' });
        txt(g, '전치사 + 명사구', 1100, 418, { size: 14, weight: 700, color: COL.prep, align: 'center' });
        [['although', 'despite', '대조'], ['because', 'because of', '이유'], ['while', 'during', '시간']].forEach(([c, p, m], k) => fade(g, ramp(u, 25.6 + k * 0.6, 0.4), () => {
          const y = 460 + k * 38;
          txt(g, m, 690, y, { size: 16, weight: 700, color: COL.muted });
          piece(g, c, 'conj', 900, y, 19, { align: 'center' });
          txt(g, '↔', 1000, y, { size: 18, weight: 700, color: COL.muted, align: 'center' });
          piece(g, p, 'prep', 1100, y, 19, { align: 'center' });
        }));
      });
    },

    /* 03 같은 뜻, 세 갈래: 가로줄 = 뜻, 세로줄 = 갈래 */
    same(g, u) {
      const CX = [80, 290, 600, 910], CW = [200, 300, 300, 300], Y0 = 172, RH = 62;
      const heads = [['뜻', null], ['접속사 + 절', 'conj'], ['전치사 + 명사구', 'prep'], ['접속부사 (마침표 뒤)', 'adv']];
      const focusAt = [[6, 12], [12, 17.5], [17.5, 19.3], [19.3, 21.1], [21.1, 23]];
      const fi = S.mean ? LK.TABLE.findIndex(r => r.m === S.mean) : focusAt.findIndex(([a, b]) => u >= a && u < b);
      fade(g, ramp(u, 0.4, 0.6), () => {
        heads.forEach(([h, k], i) => {
          if (k) chip(g, h, CX[i] + CW[i] / 2, Y0, { size: 17, weight: 700, color: KC[k], fill: COL.panel2, stroke: KC[k], align: 'center', h: 38, r: 10 });
          else txt(g, h, CX[i] + 20, Y0, { size: 17, weight: 700, color: COL.muted });
        });
      });
      LK.TABLE.forEach((r, ri) => {
        const y = Y0 + 58 + ri * RH, on = ri === fi;
        fade(g, ramp(u, 1.0 + ri * 0.45, 0.5) * (fi >= 0 && !on ? 0.45 : 1), () => {
          panel(g, 70, y - 26, 1140, 52, { fill: on ? 'rgba(255,193,94,0.10)' : COL.panel, stroke: on ? COL.rel : COL.faint, lw: on ? 2.2 : 1.2, r: 10 });
          txt(g, r.name, CX[0] + 18, y - 7, { size: 19, weight: 700, color: on ? COL.rel : COL.text });
          txt(g, r.ko, CX[0] + 18, y + 14, { size: 13, weight: 500, color: COL.muted });
          ['conj', 'prep', 'adv'].forEach((k, ci) => {
            const ws = r[k], x = CX[ci + 1] + 14;
            if (!ws.length) { txt(g, '—', x + 6, y, { size: 20, weight: 600, color: COL.dim }); return; }
            const w = txt(g, ws.join(' · '), x, y, { size: 20, weight: 700, color: KC[k] });
            say(x - 6, y - 22, w + 12, 44, ws.join(', '));
          });
        });
      });
      // 갈래 먼저, 뜻은 나중
      fade(g, ramp(u, 23.2, 0.6), () => {
        const yb = Y0 + 58 + 4 * RH + 38;
        rr(g, CX[1] - 4, Y0 - 24, CW[1] + 8, yb - Y0 + 24, 12); g.strokeStyle = COL.conj; g.lineWidth = 2.5; g.setLineDash([8, 6]); g.stroke(); g.setLineDash([]);
        const c1 = chip(g, '② 세로줄에서 갈래 먼저', 300, 552, { size: 18, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 42, r: 10 });
        arrow(g, c1.x + c1.w + 14, 552, c1.x + c1.w + 52, 552, COL.accent, 2.5);
        chip(g, '③ 가로줄에서 뜻 고르기', c1.x + c1.w + 64, 552, { size: 18, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 42, r: 10 });
      });
    },

    /* 04 뜻으로 고르기: unless = if … not, 자주 나오는 접속사 카드 */
    meaning(g, u) {
      const T = toks('___ you register by Friday, the discount will not apply.', { register: 'v', apply: 'v' }, 'm');
      const f = u > 6.4;
      const L = lay(g, f ? fillBlank(T, 'Unless', 'conj') : T, { x: W / 2, y: 188, size: 30, align: 'center' });
      fade(g, ramp(u, 0.4, 0.6), () => {
        drawLay(g, L, tk => blankStyle(tk, 0.5 + 0.5 * Math.sin(u * 4)));
        sayLay(L, 'Unless you register by Friday, the discount will not apply.');
      });
      fade(g, ramp(u, 8, 0.6), () => {
        const y = 262;
        let x = 360;
        x += piece(g, 'Unless', 'conj', x, y, 24) + 10;
        x += txt(g, 'you register', x, y, { size: 24, weight: 500 }) + 18;
        x += txt(g, '=', x, y, { size: 26, weight: 700, color: COL.accent }) + 18;
        x += piece(g, 'If', 'conj', x, y, 24) + 10;
        x += txt(g, 'you do', x, y, { size: 24, weight: 500 }) + 8;
        x += txt(g, 'not', x, y, { size: 24, weight: 800, color: COL.trap }) + 8;
        txt(g, 'register', x, y, { size: 24, weight: 500 });
      });
      fade(g, ramp(u, 12.6, 0.6), () => txt(g, '금요일까지 등록하지 않으면 → 할인 없음', W / 2, 314, { size: 20, weight: 600, color: COL.soft, align: 'center' }));
      const CARDS = [
        ['unless', '~하지 않으면 (= if … not)', 6.6], ['once', '일단 ~하면', 18.4], ['as long as · provided that', '~하는 한 · ~라면', 20.6],
        ['so that', '~하도록 (목적)', 24.4], ['whereas', '~인 반면 (두 사실 맞대기)', 26.4], ['even though', '~이긴 하지만 (강한 대조)', 29.4],
      ];
      CARDS.forEach(([w, ko, at], k) => {
        const x = 80 + (k % 3) * 382, y = 360 + Math.floor(k / 3) * 98, a = ramp(u, Math.max(at, 18), 0.5);
        const nextAt = k + 1 < CARDS.length ? CARDS[k + 1][2] : 99, now = k > 0 && u >= at && u < nextAt;
        fade(g, a, () => {
          panel(g, x, y, 356, 82, { fill: now ? 'rgba(127,224,168,0.10)' : COL.panel, stroke: now ? COL.conj : COL.faint, lw: now ? 2.2 : 1.3 });
          const ww = txt(g, w, x + 20, y + 28, { size: 21, weight: 700, color: COL.conj });
          say(x + 14, y + 10, ww + 12, 36, w.replace(' · ', ', '));
          txt(g, ko, x + 20, y + 58, { size: 16, weight: 600, color: COL.soft });
        });
      });
    },

    /* 05 짝을 이루는 접속사: either … or · neither … nor · both … and · not only … but also */
    pair(g, u) {
      const PAIRS = [['either', 'or'], ['neither', 'nor'], ['both', 'and'], ['not only', 'but also']];
      const hiAt = k => 6.2 + k * 1.4;
      PAIRS.forEach(([a, b], k) => {
        const y = 196 + k * 70, on = S.pair ? S.pair === a : u >= hiAt(k) && u < hiAt(k) + 1.4;
        const dim = S.pair && !on ? 0.3 : 1;
        fade(g, ramp(u, 1 + k * 0.4, 0.5) * dim, () => {
          const w1 = piece(g, a, 'pair', LX, y, 25, { color: on ? COL.rel : undefined });
          const x2 = LX + w1 + 74;
          txt(g, 'A', LX + w1 + 37, y, { size: 20, weight: 700, color: COL.soft, align: 'center' });
          const w2 = piece(g, b, 'pair', x2, y, 25, { color: on ? COL.rel : undefined });
          txt(g, 'B', x2 + w2 + 16, y, { size: 20, weight: 700, color: COL.soft });
          say(LX - 4, y - 18, x2 + w2 - LX + 8, 36, `${a} … ${b}`);
        });
      });
      const ex = (s, roles, pre, x, y, at, fillW, from, fillAt, back) => {
        const T = toks(s, roles, pre), done = u > fillAt;
        const L = lay(g, done ? fillBlank(T, fillW, 'pair') : T, { x, y, size: 25 });
        fade(g, ramp(u, at, 0.6), () => {
          drawLay(g, L, tk => blankStyle(tk, 0.5) );
          const F = byText(L, from), Bk = blankOf(L);
          const ap = ramp(u, at + 1.4, 0.8);
          if (ap > 0 && F) arc(g, F.x + F.w / 2, y - 18, Bk.x + Bk.w / 2, y - 18, 30, COL.v, ap);
          sayLay(L, s.replace('___', fillW).replace(/_/g, ' '));
        });
        return L;
      };
      if (S.pair) {
        const s = PAIR_EX[S.pair], words = (S.pair + ' ' + LK.PAIR[S.pair]).split(' ');
        const L = lay(g, toks(s, {}, 'p'), { x: 520, y: 220, size: 25, maxW: 680 });
        drawLay(g, L, tk => words.includes(tk.t.toLowerCase()) ? { color: COL.rel, cue: true } : {});
        sayLay(L, s);
        txt(g, '짝: ' + LK.pairName(S.pair), 520, 300, { size: 18, weight: 700, color: COL.rel });
      } else {
        ex('You can apply either online ___ by phone.', { either: 'pair' }, 'e', 520, 220, 12.2, 'or', 'either', 14.6);
        ex('___ the manager nor her assistant was available.', { nor: 'pair', was: 'v' }, 'n', 520, 330, 18.2, 'Neither', 'nor', 20.6);
      }
      // 동사의 수
      fade(g, ramp(u, 24.2, 0.6), () => {
        panel(g, 70, 450, 1140, 110, { fill: COL.panel2, stroke: COL.v });
        txt(g, '동사의 수', 94, 476, { size: 16, weight: 700, color: COL.v });
        let x = 210;
        x += piece(g, 'both A and B', 'pair', x, 476, 18) + 14;
        txt(g, '→ 복수 동사', x, 476, { size: 18, weight: 700, color: COL.text });
        txt(g, 'Both the manager and her assistant are here.', 640, 476, { size: 18, weight: 500, color: COL.en });
        x = 210;
        x += piece(g, 'either A or B', 'pair', x, 528, 18) + 14;
        txt(g, '→ 가까운 B를 따라요', x, 528, { size: 18, weight: 700, color: COL.text });
        txt(g, 'Either the manager or her assistants are here.', 640, 528, { size: 18, weight: 500, color: COL.en });
        say(630, 460, 560, 34, 'Both the manager and her assistant are here.');
        say(630, 512, 560, 34, 'Either the manager or her assistants are here.');
      });
    },

    /* 06 접속부사는 혼자 못 잇는다: 쉼표로 잇기 × → 마침표 · 세미콜론 · 접속사 */
    adv(g, u) {
      fade(g, ramp(u, 0.6, 0.6), () => {
        const c1 = chip(g, '접속사 → 두 절을 하나로 붙여요', LX, 168, { size: 17, weight: 700, color: COL.conj, fill: COL.panel2, stroke: COL.conj, h: 38, r: 10 });
        chip(g, '접속부사 → 앞 문장을 가리키기만 해요', c1.x + c1.w + 18, 168, { size: 17, weight: 700, color: COL.adv, fill: COL.panel2, stroke: COL.adv, h: 38, r: 10 });
      });
      // 처음 6초: 접속부사는 뜻으로는 앞 문장을 가리키지만, 두 절을 붙이는 고리는 없음
      if (!S.adv) fade(g, ramp(u, 1.0, 0.6) * (1 - ramp(u, 5.6, 0.5)), () => {
        const y = 290;
        const A = lay(g, toks('Sales rose', { rose: 'v' }, 'za'), { x: LX + 10, y, size: 32 });
        drawLay(g, A); gbox(g, seq(A, 'Sales rose'), COL.conj, '절');
        const hx = A.x + A.w + 76, hw = piece(g, 'however', 'adv', hx, y, 30);
        const B = lay(g, toks('profits fell', { fell: 'v' }, 'zb'), { x: hx + hw + 76, y, size: 32 });
        drawLay(g, B); gbox(g, seq(B, 'profits fell'), COL.conj, '절');
        arc(g, hx + hw / 2, y - 24, A.x + A.w / 2, y - 24, 36, COL.adv, ramp(u, 2.0, 0.8));
        fade(g, ramp(u, 2.6, 0.5), () => txt(g, '뜻으로는 앞 문장을 가리켜요', (hx + hw / 2 + A.x + A.w / 2) / 2, y - 78, { size: 17, weight: 700, color: COL.adv, align: 'center' }));
        fade(g, ramp(u, 3.6, 0.4), () => {
          cross(g, A.x + A.w + 38, y, 16, COL.bad); cross(g, hx + hw + 38, y, 16, COL.bad);
          txt(g, '문법으로는 두 절을 붙이는 고리가 없어요', LX + 10, y + 70, { size: 17, weight: 700, color: COL.trap });
        });
      });
      // 맨 위 문장: 직접 해 보기 > 29초 뒤(접속사 ×) > 6초 뒤(쉼표 ×)
      const top = (s, roles, ok, note, at) => {
        const L = lay(g, toks(s, roles, 'w'), { x: LX, y: 240, size: 32 });
        fade(g, ramp(u, at, 0.6), () => {
          drawLay(g, L);
          mark(g, ok, L.x + L.w + 30, 240, 20);
          txt(g, note, LX, 290, { size: 17, weight: 700, color: ok ? COL.good : COL.trap });
          sayLay(L, s);
        });
        return L;
      };
      if (S.adv) {
        const r = LV.advTry(S.adv.p, S.adv.w), d = LK.word(S.adv.w), k = d.kinds[0];
        const roles = { [S.adv.w]: k, [S.adv.w.charAt(0).toUpperCase() + S.adv.w.slice(1)]: k, rose: 'v', fell: 'v' };
        if (S.adv.p !== ',') roles[S.adv.p] = 'stop';
        top(r.text, roles, r.j.s === 'ok', (r.j.s === 'ok' ? '맞아요. ' : '틀려요. ') + r.j.why, 0);
      } else if (u >= 29) {
        top('Sales rose. Although, profits fell.', { Although: 'conj', rose: 'v', fell: 'v', '.': 'stop' }, false, '마침표 뒤 문장에는 절이 하나뿐 → 접속사가 이을 짝이 없어요', 29.2);
      } else {
        const L = top('Sales rose, however profits fell.', { however: 'adv', rose: 'v', fell: 'v', ',': 'stop' }, false, '쉼표 하나로는 두 절을 붙이지 못해요', 6.2);
        fade(g, ramp(u, 7.6, 0.5) * (1 - ramp(u, 28.4, 0.5)), () => {
          gbox(g, seq(L, 'Sales rose'), COL.conj, '', {}); gbox(g, seq(L, 'profits fell'), COL.conj, '', {});
        });
      }
      const FIX = [
        ['Sales rose. However, profits fell.', { However: 'adv', '.': 'stop' }, '마침표'],
        ['Sales rose; however, profits fell.', { however: 'adv', ';': 'stop' }, '세미콜론'],
        ['Although sales rose, profits fell.', { Although: 'conj' }, '접속사로'],
      ];
      FIX.forEach(([s, roles, tag], k) => {
        const y = 352 + k * 66;
        fade(g, ramp(u, 12.6 + k * 1.4, 0.5), () => {
          chip(g, tag, LX, y, { size: 15, weight: 700, color: COL.soft, fill: COL.panel2, stroke: COL.faint, h: 32, r: 8, pad: 10 });
          const L = lay(g, toks(s, roles, 'f' + k), { x: LX + 110, y, size: 25 });
          drawLay(g, L);
          mark(g, true, L.x + L.w + 26, y, 16);
          sayLay(L, s);
        });
      });
      // 접속부사 자리의 모양
      fade(g, ramp(u, 18.4, 0.6), () => {
        panel(g, 720, 322, 490, 104, { fill: COL.panel2, stroke: COL.adv });
        txt(g, '토익의 접속부사 자리', 744, 346, { size: 15, weight: 700, color: COL.adv });
        const L = lay(g, [{ id: 'q0', t: '절', r: '' }, { id: 'q1', t: '.', r: 'stop' }, { id: 'q2', t: '', r: 'blank' }, { id: 'q3', t: ',', r: 'stop' }, { id: 'q4', t: '절', r: '' }, { id: 'q5', t: '.', r: '' }], { x: 760, y: 390, size: 30 });
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: 0.6, color: COL.adv } : tk.t === '절' ? { color: COL.conj } : {});
        txt(g, '→ 접속부사', L.x + L.w + 22, 390, { size: 21, weight: 800, color: COL.adv });
      });
      // 자주 나오는 접속부사
      fade(g, ramp(u, 24.2, 0.6), () => {
        panel(g, 720, 440, 490, 122, { fill: COL.panel, stroke: COL.faint });
        [['however', '그러나'], ['therefore', '그러므로'], ['moreover', '게다가'], ['otherwise', '그렇지 않으면']].forEach(([w, ko], k) => fade(g, ramp(u, 24.4 + k * 1.1, 0.4), () => {
          const x = 744 + (k % 2) * 236, y = 474 + Math.floor(k / 2) * 52;
          const pw = piece(g, w, 'adv', x, y, 19);
          txt(g, ko, x + pw + 10, y, { size: 15, weight: 600, color: COL.soft });
          say(x, y - 14, pw, 28, w);
        }));
      });
    },

    /* 07 덩어리 전치사: prior to · due to … / following · including · regarding / in addition to 함정 */
    multi(g, u) {
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 70, 146, 550, 236, { fill: COL.panel, stroke: COL.faint });
        txt(g, '여러 낱말 = 전치사 하나', 94, 172, { size: 16, weight: 700, color: COL.prep });
      });
      [['prior to', '~ 전에 (= before)'], ['due to', '~ 때문에 (= because of)'], ['on behalf of', '~을 대표해'], ['in addition to', '~에 더해'], ['instead of', '~ 대신']].forEach(([w, ko], k) => {
        const y = 208 + k * 37;
        fade(g, ramp(u, 0.8 + k * 0.5, 0.4), () => {
          const pw = piece(g, w, 'prep', 94, y, 19);
          txt(g, ko, 94 + pw + 14, y, { size: 16, weight: 600, color: COL.soft });
          say(94, y - 13, pw, 26, w);
        });
      });
      const T = toks('___ the meeting, please read the agenda.', { read: 'v' }, 'g'), f = u > 7.2;
      const L = lay(g, f ? fillBlank(T, 'Prior to', 'prep') : T, { x: 650, y: 206, size: 25 });
      fade(g, ramp(u, 5.8, 0.6), () => {
        drawLay(g, L, tk => blankStyle(tk, 0.6));
        gbox(g, seq(L, 'the meeting'), COL.prep, '명사구', { a: ramp(u, 8.2, 0.5) });
        sayLay(L, 'Prior to the meeting, please read the agenda.');
        fade(g, ramp(u, 9.4, 0.5), () => chip(g, '덩어리 전체가 전치사 → 뒤에 명사구', 650, 296, { size: 16, weight: 700, color: COL.prep, fill: COL.panel2, stroke: COL.prep, h: 36, r: 9 }));
      });
      // -ing 꼴 전치사
      fade(g, ramp(u, 12.2, 0.6), () => {
        panel(g, 70, 392, 550, 170, { fill: COL.panel2, stroke: COL.trap });
        txt(g, '-ing 꼴이지만 전치사', 94, 418, { size: 16, weight: 700, color: COL.trap });
        [['following', 'the merger', '~ 뒤에'], ['including', 'part-time staff', '~을 포함해'], ['regarding', 'the new policy', '~에 관해']].forEach(([w, np, ko], k) => fade(g, ramp(u, 12.8 + k * 1.2, 0.4), () => {
          const y = 456 + k * 38;
          const pw = piece(g, w, 'prep', 94, y, 19);
          const nw = txt(g, np, 94 + pw + 10, y, { size: 18, weight: 500 });
          say(94, y - 14, pw + nw + 12, 28, `${w} ${np}`);
          fade(g, ramp(u, 18.2 + k * 1.6, 0.4), () => txt(g, ko, 450, y, { size: 16, weight: 700, color: COL.soft }));
        }));
      });
      // in addition to vs in addition
      fade(g, ramp(u, 24.2, 0.6), () => {
        panel(g, 650, 392, 560, 170, { fill: COL.panel2, stroke: COL.trap });
        txt(g, '함정: 끝의 to 하나', 674, 418, { size: 16, weight: 700, color: COL.trap });
        const A = lay(g, toks('In_addition_to its low price, it is fast.', { 'In addition to': 'prep' }, 'h'), { x: 674, y: 462, size: 19 });
        drawLay(g, A); gbox(g, seq(A, 'its low price'), COL.prep, '', {}); sayLay(A, 'In addition to its low price, it is fast.');
        kindTag(g, 'prep', 1196, 462, { size: 13, align: 'right' });
        const B = lay(g, toks('It is cheap. In_addition, it is fast.', { 'In addition': 'adv', '.': 'stop' }, 'k'), { x: 674, y: 524, size: 19 });
        fade(g, ramp(u, 25.6, 0.5), () => { drawLay(g, B); sayLay(B, 'It is cheap. In addition, it is fast.'); kindTag(g, 'adv', 1196, 524, { size: 13, align: 'right' }); });
      });
    },

    /* 08 3단계 풀이법 흐름도 */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 뒤를 본다', sub: '빈칸 앞뒤 모양', at: 5.6, boxes: [
          ['명사(구) · -ing 덩어리', 'despite the rain', 'np'], ['주어 + 동사 (절)', 'although it rained', 'cl'],
          ['마침표 뒤 · 쉼표 + 문장', '. However, …', 'adv'], ['짝 낱말이 보임', 'either … ___', 'pair']] },
        { x: 480, head: '② 갈래를 정한다', sub: '보기 줄이기', at: 11.2, boxes: [
          ['전치사', 'despite · due to · prior to', 'np'], ['접속사', 'although · because · unless', 'cl'],
          ['접속부사', 'however · therefore · moreover', 'adv'], ['짝 접속사', 'or · nor · and · but also', 'pair']] },
        { x: 880, head: '③ 뜻을 고른다', sub: '앞뒤 관계', at: 17.8, boxes: [
          ['대조', 'although · despite · however', 'contrast'], ['이유 · 결과', 'because · due to · therefore', 'reason'],
          ['조건', 'unless · as long as · otherwise', 'cond'], ['시간 · 추가 · 목적', 'while · during · moreover · so that', 'time'],
          ['짝 맞추기', 'either … or · neither … nor', 'pair']] },
      ];
      const P = S.path || null, fr = P && P.frame;
      const MG = { contrast: 'contrast', reason: 'reason', result: 'reason', cond: 'cond', neg: 'cond', time: 'time', add: 'time', purpose: 'time' };
      const colOf = { np: COL.prep, cl: COL.conj, adv: COL.adv, pair: COL.conj };
      cols.forEach((c, ci) => {
        fade(g, ramp(u, 0.8 + ci * 0.5, 0.6), () => {
          panel(g, c.x, 150, 340, 54, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 20, 177, { size: 21, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 320, 177, { size: 14, weight: 600, color: COL.muted, align: 'right' });
          if (ci < 2) arrow(g, c.x + 346, 177, c.x + 392, 177, COL.accent, 3);
        });
        fade(g, ramp(u, c.at, 0.6), () => {
          c.boxes.forEach(([k, v, key], bi) => {
            const y = 214 + bi * (ci === 2 ? 62 : 76), hh = ci === 2 ? 54 : 66, at = c.at + 0.5 + bi * 0.5;
            const on = P && (ci < 2 ? key === fr : fr === 'pair' ? key === 'pair' : P.m && key === MG[P.m]);
            fade(g, ramp(u, at, 0.5) * (P && !on ? 0.4 : 1), () => {
              panel(g, c.x, y, 340, hh, { fill: on ? 'rgba(255,193,94,0.14)' : COL.panel, stroke: on ? COL.rel : COL.faint, lw: on ? 2.5 : 1.3 });
              const kc = ci === 0 ? COL.soft : ci === 1 ? colOf[key] : COL.text;
              txt(g, k, c.x + 16, y + hh / 2 - 11, { size: ci === 1 ? 18 : 16, weight: 700, color: kc });
              txt(g, v, c.x + 16, y + hh / 2 + 12, { size: 14, weight: 500, color: ci === 0 ? COL.en : COL.muted });
            });
          });
        });
      });
      if (P && P.L && P.R) {
        const s = fr ? (fr === 'pair' ? '짝 접속사 → 짝 맞추기' : `${LK.FRAME[fr].name}` + (P.m ? ` + ${LK.MEAN[P.m]} → ${LK.fits({ f: fr, m: P.m }).slice(0, 4).join(' · ') || '없음'}` : '')) : '이 조합으로는 문장이 이어지지 않아요';
        chip(g, s, W / 2, 556, { size: 18, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 40, r: 10 });
      }
    },

    /* 09 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = LK.DRILL[P.k], sl = it.slot;
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0] + 1, s2 = v >= P.at[1], s3 = v >= P.at[2];
        const ans = it.opts[it.a], kind = LK.word(ans).kinds[0];
        const roles = sl.f === 'cl' ? { [it.verb]: 'v' } : {};
        const T = toks(it.q, roles).map(tk => tk.r === 'blank' && s3 ? Object.assign(tk, { t: ans, k: kind }) : tk);
        const L = lay(g, T, { x: LX, y: 222, size: 31, maxW: 1120, lh: 52 });
        const bi = L.items.indexOf(blankOf(L)), stop = sl.f === 'adv' ? L.items[bi - 1] : null;
        drawLay(g, L, tk => tk.r === 'blank' ? blankStyle(tk, s2 && !s3 ? 0.6 : 0) : stop && tk.id === stop.id && s1 ? { r: 'stop' } : {});
        if (stop && s1) fade(g, ramp(v, P.at[0] + 1, 0.5), () => txt(g, stop.t === ';' ? '세미콜론' : '마침표', stop.x + stop.w / 2, stop.y + 38, { size: 14, weight: 700, color: COL.trap, align: 'center' }));
        sayLay(L, it.q.replace('___', ans));
        if (s1 && sl.f === 'np') gbox(g, seq(L, it.back), COL.prep, '명사구', { a: ramp(v, P.at[0] + 1, 0.5) });
        if (s1 && sl.f === 'cl') gbox(g, seq(L, it.back), COL.conj, '절', { a: ramp(v, P.at[0] + 1, 0.5) });
        if (s1 && sl.f === 'adv') { const c = L.items[bi + 1]; gbox(g, { x: c.x, y: c.y, w: L.x + L.w - c.x, size: 31 }, COL.conj, '쉼표 + 문장', { a: ramp(v, P.at[0] + 1, 0.5) }); }
        const oy = L.lines > 1 ? 360 : 330;
        it.opts.forEach((o, k) => {
          const ox = LX + (k % 2) * 290, y = oy + Math.floor(k / 2) * 78, j = LK.judge(o, sl), kd = LK.word(o).kinds[0];
          const right = k === it.a, gone2 = !right && j.step === 2 && v >= P.at[1] + 1.2, gone3 = !right && j.step === 3 && v >= P.at[2] + 0.8;
          const gone = gone2 || gone3, win = right && s3;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, o, ox + 52, y, { size: 27, weight: win ? 700 : 600, color: win ? COL.good : gone ? COL.dim : COL.text });
          const tagW = tw(g, LK.KIND[kd], 13, 700) + 20;
          if (win) { panel(g, ox - 14, y - 26, w + tagW + 86, 52, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + w + tagW + 88, y, 18); }
          if (v >= P.at[1] + 0.4) fade(g, ramp(v, P.at[1] + 0.4, 0.5) * (gone ? 0.5 : 1), () => kindTag(g, kd, ox + 52 + w + 10, y, { size: 13, align: 'left' }));
          if (gone) {
            const gp = clamp((v - (gone2 ? P.at[1] + 1.2 : P.at[2] + 0.8)) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, y + 1); g.lineTo(ox - 4 + (w + 62) * gp, y + 1); g.stroke();
          }
        });
        panel(g, 680, oy - 40, 540, 230, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = oy - 2 + k * 70;
          txt(g, ['① 뒤', '② 갈래', '③ 뜻'][k], 704, y, { size: 18, weight: 700, color: COL.accent });
          txt(g, ln, 704, y + 30, { size: 18, weight: 600, color: k === 2 ? COL.good : COL.soft });
        }));
      });
    },

    /* 10 정리 표 */
    summary(g, u) {
      const X = [80, 520, 720], Y0 = 150, RH = 56;
      const rows = [
        ['빈칸 뒤 명사(구) · -ing 덩어리', 'prep', '전치사', 'despite the rain · prior to the meeting'],
        ['빈칸 뒤 주어 + 동사 (절)', 'conj', '접속사', 'although it rained · unless you register'],
        ['마침표·세미콜론 뒤 + 쉼표 + 문장', 'adv', '접속부사', 'It rained. However, …'],
        ['앞이나 뒤에 짝 낱말', 'pair', '짝 접속사', 'either A or B · neither A nor B'],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 10, 1160, RH * (rows.length + 1) + 16, { fill: COL.panel, stroke: COL.faint });
        ['빈칸 앞뒤 (신호)', '갈래', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 22, { size: 17, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 8, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.8, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 22;
        txt(g, r[0], X[0] + 20, y, { size: 19, weight: 600 });
        piece(g, r[2], r[1], X[1] + 20, y, 18);
        txt(g, r[3], X[2] + 20, y, { size: 19, weight: 500, color: COL.en });
      }));
      const steps = ['① 뒤: 명사구? 절?', '② 갈래: 보기 줄이기', '③ 뜻: 대조 · 이유 · 조건'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 6.6 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 500, { size: 20, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 48, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 500, c.x + c.w + 46, 500, COL.accent, 2.5);
        x = c.x + c.w + 58;
      }));
    },
  };

  // 영상 추출용 자막: 아래쪽 띠에 두 줄까지. **굵게**는 강조색, 영어는 연한 하늘색
  function drawCaption(g, text) {
    if (!text) return;
    const words = [];
    text.split('**').forEach((part, k) => { const bold = k % 2 === 1; part.split(/(\s+)/).forEach(w => w && words.push({ w, bold, en: /[A-Za-zÀ-ÿ]/.test(w) && !/[가-힣]/.test(w) })); });
    // 띄어쓰기 사이의 조각은 한 덩어리로 줄을 바꿈 (굵은 '동명사' 바로 뒤의 '예요.'가 다음 줄로 떨어지지 않게)
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

  LV.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[LV.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, LV.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + Object.values(LK.LEX).map(d => d.w + d.ko).join('') +
    LK.DRILL.map(d => d.q + d.opts.join('')).join('') + Object.values(LK.KIND).join('') + Object.values(LK.MEAN).join('') +
    Object.values(LK.FRAME).map(f => f.name + f.sign).join('') + Object.values(PAIR_EX).join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;·()[]→←↔✓×?~=+-/:…‘’맞아요틀려요';
  LV.baseText = EXTRA;
  LV.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = LV.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { LV.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
