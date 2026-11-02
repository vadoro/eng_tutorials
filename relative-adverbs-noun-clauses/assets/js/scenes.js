/* 관계부사 · 복합관계사 · 명사절 튜토리얼 — 영상 장면
 *
 * WV.render(g, t)는 시각 t와 사용자 상태 WV.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 영어 문장은 낱말 조각(토큰)으로 그리고(lay · morph · drawTok), 색은 관계대명사 튜토리얼(T01)과 같은 역할을 나타냅니다:
 * 선행사 하늘 · 관계사(연결하는 말) 노랑 상자 · 빈자리 분홍 점선 · 완전한 절 민트 · 동사·단서 보라 · 함정(전치사) 주황 · 부사 라임.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(WH.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const WH = window.WH;
  const WV = (window.WV = {});
  const W = 1280, H = 720;
  WV.W = W; WV.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  WV.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36',
    // 문법 역할 색 (T01과 같은 뜻): 선행사 · 관계사 · 빈자리 · 완전한 절 · 동사·단서 · 함정 · 부사
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', cl: '#7FE0A8', v: '#C9A7FF', trap: '#FF9F7A', adv: '#D4E157',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  WV.COL = COL;
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const FAMC = { gap: COL.gap, full: COL.cl, both: COL.rel };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (WV.S = { adv: null, pw: null, wrow: null, path: null });
  WV.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  WV.hits = () => HITS;

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
  // 곡선 화살표 (h > 0이면 위로 휨, p: 그려진 정도 0→1)
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
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
    txt(g, s, x0 + w / 2, y + 1, { size, weight: o.weight || 600, color: o.color || COL.text, align: 'center', fam: o.fam });
    return { x: x0, y: y - h / 2, w, h };
  }
  const tag = (g, s, x, y, color, o = {}) => chip(g, s, x, y, Object.assign({ size: 16, weight: 700, color, fill: COL.panel2, stroke: color, h: 34, r: 9, pad: 11 }, o));
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; g.stroke(); }
  }
  const say = (x, y, w, h, text) => HITS.push({ x, y, w, h, say: text });
  // 관계사 조각: 노란 둥근 상자. 돌려주는 값: 너비
  function piece(g, s, x, y, size = 24, o = {}) {
    const c = o.color || COL.rel, w = tw(g, s, size, 700) + size * 0.5, h = size * 1.22;
    const x0 = o.align === 'center' ? x - w / 2 : x;
    rr(g, x0, y - h / 2, w, h, 9); g.fillStyle = hexA(c, 0.16); g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.stroke();
    txt(g, s, x0 + w / 2, y + 1, { size, weight: 700, color: c, align: 'center' });
    return w;
  }
  // 빈자리 상자 하나 (토큰 밖에서 그릴 때)
  function gapBox(g, x, y, w, size, glow = 0) {
    const h = size * 1.12;
    rr(g, x, y - h / 2, w, h, 8); g.fillStyle = hexA(COL.gap, 0.1 + 0.14 * glow); g.fill();
    g.setLineDash([6, 5]); g.strokeStyle = COL.gap; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]);
  }

  /* ---------- 영어 문장 토큰 배치와 그리기 ---------- */
  // 토큰 { id, t: 글자, r: 역할 }. 역할: ante 선행사 · rel 관계사 상자 · gap 빈자리 · blank 빈칸 · v 동사 · adv 부사 · trap 함정(전치사)
  //   ko 한국어 · mod 꾸미는 말(민트) · bad 틀림 · dim 흐림 · '' 보통
  const RCOL = { ante: COL.ante, v: COL.v, adv: COL.adv, trap: COL.trap, bad: COL.bad, dim: COL.dim, ko: COL.soft, mod: COL.cl, good: COL.good };
  const PUNCT = /^[.,;?!]$/;
  const tokW = (g, tk, size) => tk.r === 'gap' ? size * 1.7 : tk.r === 'blank' ? Math.max(size * 2.8, tk.t ? tw(g, tk.t, size, 700) + size * 0.7 : 0) :
    tk.r === 'rel' ? tw(g, tk.t, size, 700) + size * 0.5 : tw(g, tk.t, size, tk.r === 'v' || tk.r === 'ante' ? 600 : 500);
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
  // 문자열 → 토큰 (띄어쓰기로 자르고 부호는 따로). roles: { '글자': 역할 }, ___ 빈칸, ▢ 빈자리, The_hotel처럼 _로 이은 말은 한 조각
  // ids: 낱말 순서대로 붙일 id (morph에서 같은 낱말끼리 잇기). 없으면 pre + 번호
  function toks(s, roles = {}, pre = 't', ids) {
    const out = []; let n = 0;
    s.split(' ').forEach(w => {
      const m = w.match(/^(.*?)([.,;?!]?)$/);
      const t = m[1].replace(/_/g, ' ');
      if (m[1]) {
        const id = ids && ids[n] ? ids[n] : pre + out.length; n++;
        if (m[1] === '___') out.push({ id, t: '', r: 'blank' });
        else if (m[1] === '▢') out.push({ id, t: '', r: 'gap' });
        else out.push({ id, t, r: roles[t] || '' });
      }
      if (m[2]) out.push({ id: pre + 'p' + out.length, t: m[2], r: '' });
    });
    return out;
  }
  const byText = (L, t) => L.items.find(i => i.t === t);
  const blankOf = L => L.items.find(i => i.r === 'blank');
  // 이어진 낱말 묶음 찾기 → { x, y, w, size } (▢는 빈자리 토큰과 맞춤)
  function seq(L, words) {
    const ws = words.split(' ').map(w => w.replace(/_/g, ' '));
    const eq = (it, w) => w === '▢' ? it.r === 'gap' : it.t === w;
    for (let i = 0; i + ws.length <= L.items.length; i++) {
      if (ws.every((w, k) => eq(L.items[i + k], w))) {
        const a = L.items[i], b = L.items[i + ws.length - 1];
        return { x: a.x, y: a.y, w: b.x + b.w - a.x, size: a.size };
      }
    }
    return null;
  }
  // 묶음 표시: 옅은 칠 + 아래 꺾쇠 + 이름표 (완전한 절은 민트, 빈자리가 있는 절은 분홍)
  function gbox(g, b, color, label, o = {}) {
    if (!b) return;
    const pad = o.pad == null ? 3 : o.pad, top = b.y - b.size * 0.62, bot = b.y + b.size * 0.8;
    fade(g, o.a == null ? 1 : o.a, () => {
      rr(g, b.x - pad, top, b.w + pad * 2, bot - top, 6); g.fillStyle = hexA(color, 0.11); g.fill();
      g.strokeStyle = color; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(b.x - pad, bot - 7); g.lineTo(b.x - pad, bot); g.lineTo(b.x + b.w + pad, bot); g.lineTo(b.x + b.w + pad, bot - 7); g.stroke();
      if (label) txt(g, label, o.lx != null ? o.lx : b.x + b.w / 2, bot + 14, { size: o.lsize || 15, weight: 700, color, align: o.lalign || 'center' });
    });
  }
  // 토큰 하나 그리기. o: { a: 투명도, r: 역할 바꾸기, color, textColor, cue: 단서 상자, glow: 빈칸 반짝임 }
  function drawTok(g, it, o = {}) {
    const r = o.r != null ? o.r : it.r, size = it.size, x = it.x, y = it.y, w = it.w;
    g.save(); g.globalAlpha *= o.a == null ? 1 : o.a;
    if (g.globalAlpha <= 0.002) { g.restore(); return; }
    if (r === 'gap' || r === 'blank') {
      const h = size * 1.12;
      rr(g, x, y - h / 2, w, h, 8);
      g.fillStyle = hexA(COL.gap, 0.08 + 0.14 * (o.glow || 0)); g.fill();
      g.setLineDash([6, 5]); g.strokeStyle = o.color || COL.gap; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]);
      if (it.t) txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: o.textColor || COL.rel, align: 'center' });
    } else if (r === 'rel') {
      const c = o.color || COL.rel, h = size * 1.22;
      rr(g, x, y - h / 2, w, h, 9); g.fillStyle = hexA(c, 0.16); g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.stroke();
      txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: c, align: 'center' });
    } else {
      const c = o.color || RCOL[r] || COL.text;
      txt(g, it.t, x, y + 1, { size, weight: r === 'v' || r === 'ante' ? 600 : 500, color: c });
      if ((r === 'ante' || r === 'v' || r === 'adv') && !o.plain) { g.fillStyle = c; g.fillRect(x, y + size * 0.56, w, r === 'v' ? 2.5 : 3); }
      if (r === 'bad') { g.strokeStyle = COL.bad; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x + w + 3, y + 2); g.stroke(); }
    }
    if (o.cue) { rr(g, x - 4, y - size * 0.66, w + 8, size * 1.32, 7); g.strokeStyle = o.cueColor || COL.v; g.lineWidth = 2.2; g.stroke(); }
    g.restore();
  }
  function drawLay(g, L, style) { L.items.forEach(it => drawTok(g, it, style ? style(it) || {} : {})); }
  // 두 배치 사이 (p: 0→1). 같은 id는 움직이고, 글자·역할이 다르면 겹쳐 바뀜. lift: 멀리 움직이는 낱말을 위로 띄움
  function morph(g, A, B, p, o = {}) {
    const e = ease(clamp(p)), seen = new Set(), style = o.style || (() => ({}));
    const ids = A.items.map(i => i.id).concat(B.items.map(i => i.id)).filter(id => !seen.has(id) && seen.add(id));
    ids.forEach(id => {
      const a = A.byId[id], b = B.byId[id];
      if (a && b) {
        const dx = Math.abs(b.x - a.x);
        const lift = o.lift && (o.liftIds ? o.liftIds.includes(id) : dx > 90) ? Math.sin(Math.PI * e) * o.lift : 0;
        const m = Object.assign({}, b, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) - lift, w: lerp(a.w, b.w, e), size: lerp(a.size, b.size, e) });
        if (a.t === b.t && a.r === b.r) drawTok(g, m, style(b, e));
        else { drawTok(g, Object.assign({}, m, { t: a.t, r: a.r }), Object.assign({}, style(a, e), { a: 1 - e })); drawTok(g, m, Object.assign({}, style(b, e), { a: e })); }
      } else if (a) drawTok(g, a, Object.assign({}, style(a, e), { a: 1 - ramp(p, 0, 0.5) }));
      else drawTok(g, b, Object.assign({}, style(b, e), { a: ramp(p, 0.5, 0.5) }));
    });
  }
  // 시간 u에 따라 배치 목록 사이를 움직이며 그림. seqs: [[시작 시각, 배치], …], dur: 움직이는 시간
  function play(g, u, seqs, dur, o = {}) {
    let k = 0; seqs.forEach(([at], i) => { if (u >= at) k = i; });
    const [at, L] = seqs[k], prev = k > 0 ? seqs[k - 1][1] : null, p = (u - at) / dur;
    if (prev && p < 1) morph(g, prev, L, p, o); else drawLay(g, L, o.style);
    return L;
  }
  function cueBox(g, it, color) { rr(g, it.x - 4, it.y - it.size * 0.66, it.w + 8, it.size * 1.32, 7); g.strokeStyle = color; g.lineWidth = 2.2; g.stroke(); }
  function sayLay(L, text) { say(L.x - 8, L.y - L.size * 0.8, L.w + 16, L.h + L.size * 0.3, text); }
  const glowAt = u => 0.5 + 0.5 * Math.sin(u * 4);
  // 낱말 위에서 아래로 내려오는 이름표 + 가는 선
  function note(g, it, s, color, dy = 46, o = {}) {
    if (!it) return;
    const cx = it.x + it.w / 2, y0 = it.y + it.size * 0.7;
    g.strokeStyle = color; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, y0 + 2); g.lineTo(cx, y0 + dy - 14); g.stroke();
    txt(g, s, cx, y0 + dy, { size: o.size || 15, weight: 700, color, align: 'center' });
  }

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '토익 Part 5의 단골 함정', d: 24, caps: [
      [0.4, 5, '관계사와 명사절 문제를 **빈자리** 하나로 풀어 볼 거예요.'],
      [5, 10.5, '문제를 보세요. 빈칸 앞 The hotel → 장소예요. 그래서 먼저 눈이 가는 답 → where.'],
      [10.5, 15.5, '장소 명사 뒤면 언제나 관계부사일까요? 답은 빈칸 **뒤**가 알려 줘요.'],
      [15.5, 20, '오늘의 질문은 하나예요. 빈칸 뒤 문장에 **빈자리**가 있나, 없나?'],
      [20, 24, '관계부사, 복합관계사, 명사절을 이 질문 하나로 차례로 풀어요.'],
    ] },
    { id: 'gap', n: '01', title: '빈자리, 다시 보기', sub: '대명사가 빠지면 · 부사가 빠지면', d: 34, caps: [
      [0.4, 6, '관계대명사 튜토리얼에서 본 것처럼, 관계사절에는 **빈자리**가 생겨요. 다시 볼게요.'],
      [6, 12, 'We reserved it. it → which, 그리고 맨 앞으로. 그러면 reserved 뒤가 비어요.'],
      [12, 17.5, '목적어가 빠졌으니 이 절은 혼자 서지 못해요. 빈자리가 있는 **불완전한 문장**이에요.'],
      [17.5, 23.5, '이번에는 The fair is held there. 부사 there → where, 그리고 맨 앞으로.'],
      [23.5, 28.5, '남은 the fair is held → 빠진 것이 없어요. 부사는 없어도 문장이 서거든요.'],
      [28.5, 34, '대명사가 빠지면 빈자리, 부사가 빠지면 **완전한 문장**. 이것이 오늘의 열쇠예요.'],
    ] },
    { id: 'radv', n: '02', title: '관계부사 where · when · why', sub: '선행사 + 완전한 문장', d: 30, caps: [
      [0.4, 6, '한국어로는 ‘우리가 예약한 호텔’, ‘박람회가 열리는 도시’. 꾸미는 모양이 똑같아요.'],
      [6, 12, '영어는 둘을 갈라요. 빈자리가 있으면 관계대명사 which, 없으면 **관계부사** where.'],
      [12, 17.5, '관계부사는 셋이에요. 장소 → where, 시간 → when, 이유 → why.'],
      [17.5, 23.5, 'the day when the store opened. the reason why sales rose. 뒤가 모두 완전한 문장이에요.'],
      [23.5, 30, '조심하세요. 장소 명사라도 뒤에 빈자리가 있으면 관계대명사예요. the museum which we visited.'],
    ] },
    { id: 'pw', n: '03', title: 'where = 전치사 + which', sub: 'in which · the way how', d: 34, caps: [
      [0.4, 6, '관계부사를 풀어 쓰면 → **전치사 + which**. the city in which the fair is held.'],
      [6, 12, 'in which → 한 낱말로 줄이면 where. 그래서 둘 다 뒤에 완전한 문장이 와요.'],
      [12, 17.5, '시간이면 on which → when, 이유면 for which → why.'],
      [17.5, 23.5, '그래서 전치사 바로 뒤에는 관계부사를 못 써요. in where → 전치사가 두 번이 되거든요.'],
      [23.5, 28.5, '방법을 말할 때는 함정이 하나 있어요. the way how → 쓰지 않아요.'],
      [28.5, 34, 'the way 또는 how, 하나만 써요. the way we work, how we work.'],
    ] },
    { id: 'cpro', n: '04', title: '선행사를 품은 whoever', sub: 'whoever · whatever', d: 30, caps: [
      [0.4, 6, '이번 문장은 빈칸 앞에 명사가 없어요. ___ arrives first should unlock the office.'],
      [6, 12, '빈칸 바로 뒤 arrives → 주어가 빠졌어요. 그리고 꾸밀 명사, 곧 선행사도 없어요.'],
      [12, 18, '이럴 때 **whoever**. whoever = anyone who, 곧 ‘~하는 사람은 누구든’이라는 뜻이에요.'],
      [18, 24, '사람이 아니라 물건이면 **whatever**. Take whatever you need = anything that you need.'],
      [24, 30, '둘 다 선행사를 품고 있어서 명사 뒤에는 못 와요. 그리고 뒤에는 꼭 빈자리가 있어요.'],
    ] },
    { id: 'cadv', n: '05', title: '아무리 ~해도, however', sub: 'however · wherever · whenever', d: 30, caps: [
      [0.4, 6, '이번에는 **however**, ‘아무리 ~해도’라는 뜻이에요. 형용사를 데리고 다녀요.'],
      [6, 12, 'We are busy → However busy we are. 형용사 busy → however 바로 뒤로 옮겨요.'],
      [12, 18, '그래서 빈칸 바로 뒤에 형용사가 보이면 however. whatever, whenever → 탈락이에요.'],
      [18, 24, '**wherever** = 어디서 ~하든, **whenever** = 언제 ~하든. 뒤에 완전한 문장이 와요.'],
      [24, 30, 'Whenever you need help → 빠진 것이 없어요. Whatever you need → need 뒤가 비었어요.'],
    ] },
    { id: 'thatwhat', n: '06', title: '명사절 that vs what', sub: '완전하면 that, 빈자리면 what', d: 30, caps: [
      [0.4, 6, '문장 안에서 주어나 목적어 노릇을 하는 절을 **명사절**이라고 해요.'],
      [6, 12, 'It is clear that we need more staff. that 뒤 → we need more staff, 완전한 문장.'],
      [12, 18, 'What we need is more time. what 뒤 → we need, need 뒤가 비었어요.'],
      [18, 24, 'that → ‘~라는 것’, 빈자리 없음. what → ‘~하는 것’, 빈자리 있음.'],
      [24, 30, '관계대명사 튜토리얼에서 본 what = the thing which. 앞에 명사가 없고 뒤에 빈자리가 있을 때 써요.'],
    ] },
    { id: 'whether', n: '07', title: 'whether와 if', sub: '~인지 아닌지', d: 34, caps: [
      [0.4, 6, '‘~인지 아닌지’ → **whether**, if. 둘 다 뒤에 완전한 문장이 와요.'],
      [6, 12, 'I wonder whether the store is open. 동사의 목적어 자리에서는 둘 다 돼요.'],
      [12, 18, '그런데 둘 중 하나만 되는 자리가 네 곳 있어요. 첫째, 문장 맨 앞 **주어** 자리.'],
      [18, 24, '둘째, **전치사** 바로 뒤. It depends on whether we win the contract.'],
      [24, 30, '셋째, or not 바로 앞. 넷째, to부정사 앞. whether or not, whether to go.'],
      [30, 34, '이 네 자리에서는 whether, 나머지 목적어 자리에서는 둘 다 써요.'],
    ] },
    { id: 'order', n: '08', title: '의문사 명사절의 어순', sub: '질문이 문장 속으로', d: 36, caps: [
      [0.4, 6, '질문이 문장 속으로 들어갈 때도 있어요. 한국어부터 볼게요.'],
      [6, 12, '기차가 언제 떠나요? → 기차가 언제 떠나는지 몰라요. 순서는 그대로, 끝만 바뀌어요.'],
      [12, 18, '영어 질문은 어순이 달라요. When does the train leave? 주어 the train 앞에 does.'],
      [18, 24, '문장 속에서는 I don’t know when the train leaves. does → 빠지고, 주어 + 동사 순서.'],
      [24, 30, 'Where can I park? → Can you tell me where I can park? 의문사 뒤는 평서문 어순이에요.'],
      [30, 36, '의문사도 빈자리 규칙을 따라요. who, what 뒤는 빈자리, when, where, why, how 뒤는 완전한 문장.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: '뒤 → 앞 → 함정', d: 34, caps: [
      [0.4, 6, '이제 **3단계 풀이법**으로 묶어요. 관계대명사 때와 달리, 이번에는 뒤부터 봐요.'],
      [6, 12, '① **뒤**: 빈칸 뒤에 빈자리가 있나? 있으면 which, who, what, whoever, whatever 쪽.'],
      [12, 18, '빠진 것 없이 완전하면 where, when, why, that, whether, however 쪽. 보기가 반으로 줄어요.'],
      [18, 24.5, '② **앞**: 빈칸이 어떤 자리인가? 명사 뒤면 관계사, 명사 자리면 명사절, 문장 밖이면 부사절.'],
      [24.5, 30, '③ **함정**: 장소·시간·이유가 맞는지, 전치사 바로 뒤인지, 뜻이 맞는지 확인해요.'],
      [30, 34, '이 순서로 토익 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '처음 본 문제예요. ① 빈칸 뒤 → we reserved, reserved 뒤에 목적어가 없어요. 빈자리!'],
      [6, 12, '빈자리가 있으니 where, when → 탈락. ② 빈칸 앞에 명사 The hotel → 선행사를 품은 what 탈락.'],
      [12, 18, '③ 장소 명사라도 빈자리가 있으면 which. 정답은 (B). 장소만 보고 고르면 함정에 빠져요.'],
      [18.4, 24.5, '두 번째 문제. ① 빈칸 뒤 → our customers value most. value 뒤가 비었어요.'],
      [24.5, 31, '그래서 That, Whether → 탈락. ② 앞에 명사가 없는 주어 자리 → 선행사가 필요한 Which 탈락.'],
      [31, 37, '③ 남은 What → ‘고객이 가장 중요하게 여기는 것’, 뜻도 맞아요. 정답은 (D) What.'],
      [37.4, 43.5, '세 번째. ① 빈칸 뒤 → enough volunteers sign up. 빠진 것 없는 완전한 문장이에요.'],
      [43.5, 50, '그래서 what → 탈락. ② 빈칸 바로 앞에 전치사 on → 전치사의 목적어, 명사절 자리.'],
      [50, 56, '③ 전치사 뒤 → if, that 탈락. ‘~하느냐’에 달렸으니 정답은 (B) whether.'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 표', d: 22, caps: [
      [0.4, 6, '정리해요. 관계사와 명사절 문제는 먼저 빈칸 **뒤**에 빈자리가 있는지 봐요.'],
      [6, 12, '빈자리가 있으면 which, who, what, whoever 쪽. 완전하면 where, that, whether, however 쪽.'],
      [12, 17, '그다음 빈칸 **앞**의 자리와 뜻, 함정으로 하나를 골라요.'],
      [17, 22, '아래 빈자리 탐지기와 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  WV.CHAPTERS = CHAPTERS; WV.CAPTIONS = CAPTIONS; WV.END = END;
  WV.POSTER = CHAPTERS.find(c => c.id === 'gap').t + 31;
  WV.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  WV.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(WH.DRILL)에서 세 개. 단계마다 그 단계에서 틀리는 보기를 규칙 엔진이 지움
  const PRACTICE = [
    { k: 0, at: [0.4, 6, 12], lines: ['빈칸 뒤 reserved → 목적어 빈자리', '앞에 명사 The hotel → 관계사 자리', '장소라도 빈자리 → (B) which'] },
    { k: 9, at: [0.4, 6.1, 12.6], lines: ['빈칸 뒤 value → 목적어 빈자리', '앞에 명사 없음 → Which 탈락', '‘~하는 것’ → (D) What'] },
    { k: 12, at: [0.4, 6.1, 12.6], lines: ['빈칸 뒤 → 빠진 것 없는 완전한 문장', '바로 앞 전치사 on → 명사절 자리', '전치사 뒤 if × → (B) whether'] },
  ];
  PRACTICE.forEach(p => {
    const it = WH.DRILL[p.k];
    if (!p.lines[2].includes(`(${'ABCD'[it.a]})`)) console.warn('[관계부사·명사절] 실전 문제 정답 표시가 데이터와 달라요:', it.q);
    it.opts.forEach((w, i) => { if (WH.isOk(w, it.d) !== (i === it.a)) console.warn('[관계부사·명사절] 실전 문제가 규칙 엔진과 달라요:', it.q); });
  });
  // 02장: 관계부사 세 개 (직접 해 보기에서 하나를 고르면 그 카드가 켜짐)
  const RADV = [
    { k: 'place', w: 'where', name: '장소', ex: 'the city where the fair is held', clause: 'the fair is held', back: 'there (거기서)', at: 12.4 },
    { k: 'time', w: 'when', name: '시간', ex: 'the day when the store opened', clause: 'the store opened', back: 'then (그때)', at: 13.8 },
    { k: 'reason', w: 'why', name: '이유', ex: 'the reason why sales rose', clause: 'sales rose', back: 'for that reason (그 까닭에)', at: 15.2 },
  ];
  WV.RADV = RADV;
  // 03장: 전치사 + which = 관계부사
  const PW = {
    place: { ante: 'the_city', p: 'in', rest: 'the fair is held', w: 'where', name: '장소', pre: 'in · at which' },
    time: { ante: 'the_day', p: 'on', rest: 'the store opened', w: 'when', name: '시간', pre: 'on · in which' },
    reason: { ante: 'the_reason', p: 'for', rest: 'sales rose', w: 'why', name: '이유', pre: 'for which' },
    way: { ante: 'the_way', p: 'in', rest: 'we work', w: 'how', name: '방법', pre: 'in which' },
  };
  WV.PW = PW;
  const pwText = (k, merged) => { const e = PW[k]; return merged ? (k === 'way' ? `how ${e.rest}` : `${e.ante.replace('_', ' ')} ${e.w} ${e.rest}`) : `${e.ante.replace('_', ' ')} ${e.p} which ${e.rest}`; };
  WV.pwText = pwText;
  // 07장: whether만 되는 네 자리
  const WROWS = [
    { tag: '주어 자리', s: 'Whether the client will sign is still unclear.', d: { front: 'noun', role: 'subj', back: 'full', sense: 'yesno' }, at: 12.6 },
    { tag: '전치사 뒤', s: 'It depends on whether we win the contract.', d: { front: 'noun', role: 'prep', back: 'full', sense: 'yesno' }, at: 18.4 },
    { tag: 'or not 바로 앞', s: 'Let me know whether or not you can come.', d: { front: 'noun', role: 'obj', back: 'full', next: 'ornot', sense: 'yesno' }, at: 24.4 },
    { tag: 'to부정사 앞', s: 'I’m not sure whether to accept the offer.', d: { front: 'noun', role: 'obj', back: 'full', next: 'to', sense: 'yesno' }, at: 27.4 },
  ];
  WV.WROWS = WROWS;
  WROWS.forEach(r => { if (!WH.isOk('whether', r.d) || WH.isOk('if', r.d)) console.warn('[관계부사·명사절] 07장 표가 규칙 엔진과 달라요:', r.s); });

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  // 보기의 갈래 이름표: 빈자리 쪽 · 완전 쪽 (that은 자리에 따라: 명사 뒤 + 빈자리면 관계대명사, 아니면 접속사)
  const famTag = (g, w, x, y, d) => {
    let f = WH.famOf(w);
    if (f === 'both') f = d && d.front === 'ante' && (d.back === 'subj' || d.back === 'obj') ? 'gap' : 'full';
    return tag(g, f === 'gap' ? '빈자리 쪽' : '완전 쪽', x, y, FAMC[f], { size: 13, h: 26, pad: 8, r: 7 });
  };

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(장소 명사 + 빈칸) → 오늘의 질문 → 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '빈자리가 있느냐 없느냐,', W / 2, 262, { size: 60, weight: 800, fam: FD, align: 'center' });
        txt(g, '그것이 문제로다', W / 2, 344, { size: 60, weight: 800, fam: FD, align: 'center', color: COL.accent });
        txt(g, 'Relative Adverbs · Compound Relatives · Noun Clauses', W / 2, 412, { size: 23, weight: 500, color: COL.muted, align: 'center' });
      });
      [['관계부사', 'where · when · why'], ['복합관계사', 'whoever · however'], ['명사절', 'that · what · whether']].forEach(([a, b], i) => {
        const al = ramp(u, 1.3 + i * 0.25, 0.4) * out1;
        fade(g, al, () => tag(g, `${a}  ${b}`, W / 2 + (i - 1) * 380, 488 + (1 - al) * 10, i === 0 ? COL.cl : i === 1 ? COL.rel : COL.ante, { align: 'center', size: 18, h: 40 }));
      });
      const it = WH.DRILL[0];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 14.9, 0.6));
      fade(g, a2, () => {
        panel(g, 100, 160, 1080, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 140, 202, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const L = lay(g, toks(it.q.replace('The hotel', 'The_hotel'), u > 5.6 ? { 'The hotel': 'ante' } : {}), { x: 140, y: 262, size: 27, maxW: 1010, lh: 48 });
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: u > 10.6 ? glowAt(u) : 0 } : {});
        if (u > 10.6) gbox(g, seq(L, 'we reserved for the workshop'), COL.gap, '빈칸 뒤 → 빈자리가 있나?', { a: ramp(u, 10.8, 0.5) });
        sayLay(L, it.q.replace('___', it.opts[it.a]));
        it.opts.forEach((o, k) => {
          const ox = 160 + (k % 2) * 400, oy = 418 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            const w = txt(g, o, ox + 64, oy, { size: 30, weight: 600 });
            if (k === 0) fade(g, ramp(u, 7.6, 0.4), () => { g.fillStyle = COL.rel; g.fillRect(ox + 64, oy + 19, w, 3); });
          });
        });
        fade(g, ramp(u, 8.0, 0.5), () => chip(g, '장소 명사니까 where?', 1150, 418, { size: 17, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'right', h: 36 }));
        fade(g, ramp(u, 11.6, 0.5), () => chip(g, '답은 빈칸 뒤에 있어요', 1150, 480, { size: 17, weight: 700, color: COL.gap, fill: COL.panel2, stroke: COL.gap, align: 'right', h: 36 }));
      });
      fade(g, ramp(u, 15.6, 0.6) * (1 - ramp(u, 19.5, 0.5)), () => {
        txt(g, '오늘의 질문', W / 2, 232, { size: 20, weight: 700, color: COL.accent, align: 'center' });
        txt(g, '빈칸 뒤 문장에', W / 2, 306, { size: 50, weight: 800, fam: FD, align: 'center' });
        const w = txt(g, '빈자리가 있나, 없나?', W / 2, 384, { size: 50, weight: 800, fam: FD, align: 'center', color: COL.gap });
        gapBox(g, W / 2 + w / 2 + 24, 384, 64, 42, glowAt(u) * 0.6);
        fade(g, ramp(u, 17.0, 0.5), () => {
          tag(g, '있으면 → 대명사 쪽 (which · what · whoever)', W / 2 - 16, 470, COL.gap, { align: 'right', size: 17, h: 40 });
          tag(g, '없으면 → 부사·접속사 쪽 (where · that · whether)', W / 2 + 16, 470, COL.cl, { size: 17, h: 40 });
        });
      });
      const steps = [['①', '관계부사', 'where · when · why', '= 전치사 + which'], ['②', '복합관계사', 'whoever · whatever', 'however · wherever'], ['③', '명사절', 'that · what', 'whether · if · 어순']];
      steps.forEach(([n, t1, t2, t3], k) => {
        const a = ramp(u, 20.2 + k * 0.6, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 230, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 284 + (1 - a) * 16, { size: 34, weight: 700, color: COL.accent });
          txt(g, t1, x0 + 28, 342 + (1 - a) * 16, { size: 26, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 392 + (1 - a) * 16, { size: 20, weight: 600, color: COL.en });
          txt(g, t3, x0 + 28, 426 + (1 - a) * 16, { size: 18, weight: 500, color: COL.soft });
        });
      });
    },

    /* 01 빈자리, 다시 보기: 대명사(it)가 빠지면 빈자리, 부사(there)가 빠지면 완전한 문장 */
    gap(g, u) {
      fade(g, ramp(u, 0.4, 0.5), () => tag(g, '① 대명사가 빠질 때', LX, 166, COL.gap));
      const yA = 230, sz = 32;
      const A0 = lay(g, toks('We reserved it.', { reserved: 'v' }, 'a', ['a0', 'a1', 'a2']), { x: LX + 10, y: yA, size: sz });
      const A1 = lay(g, toks('which we reserved ▢', { which: 'rel', reserved: 'v' }, 'a', ['a2', 'a0', 'a1', 'ag']), { x: LX + 10, y: yA, size: sz });
      const A2 = lay(g, toks('The_hotel which we reserved ▢', { 'The hotel': 'ante', which: 'rel', reserved: 'v' }, 'a', ['ah', 'a2', 'a0', 'a1', 'ag']), { x: LX + 10, y: yA, size: sz });
      A1.byId.a2.r = 'rel'; A2.byId.a2.r = 'rel';
      fade(g, ramp(u, 0.8, 0.6), () => {
        const L = play(g, u, [[0, A0], [6.8, A1], [9.2, A2]], 1.3, { lift: 34, liftIds: ['a2'], style: tk => tk.r === 'gap' ? { glow: u > 12 ? glowAt(u) * 0.6 : 0 } : {} });
        sayLay(L, u < 6.8 ? 'We reserved it.' : 'the hotel which we reserved');
        if (u > 6.0 && u < 6.8) fade(g, ramp(u, 6.0, 0.4), () => { const it = A0.byId.a2; cueBox(g, it, COL.rel); note(g, it, '대명사 it', COL.rel, 40); });
        if (u > 12) {
          gbox(g, seq(A2, 'we reserved ▢'), COL.gap, '불완전한 문장 · 목적어 빈자리', { a: ramp(u, 12.2, 0.5) });
          const gp = A2.byId.ag, an = A2.byId.ah;
          arc(g, gp.x + gp.w / 2, yA - 24, an.x + an.w / 2, yA - 24, 34, COL.gap, ramp(u, 13.4, 0.9));
          fade(g, ramp(u, 14.4, 0.5), () => tag(g, 'reserved → 무엇을? = the hotel', A2.x + A2.w + 40, yA, COL.gap));
        }
      });
      fade(g, ramp(u, 17.6, 0.5), () => tag(g, '② 부사가 빠질 때', LX, 360, COL.cl));
      const yB = 424;
      const B0 = lay(g, toks('The fair is held there.', { is: 'v', held: 'v', there: 'adv' }, 'b', ['b0', 'b1', 'b2', 'b3', 'b4']), { x: LX + 10, y: yB, size: sz });
      const B1 = lay(g, toks('where the fair is held', { where: 'rel', is: 'v', held: 'v' }, 'b', ['b4', 'b0', 'b1', 'b2', 'b3']), { x: LX + 10, y: yB, size: sz });
      const B2 = lay(g, toks('The_city where the fair is held', { 'The city': 'ante', where: 'rel', is: 'v', held: 'v' }, 'b', ['bc', 'b4', 'b0', 'b1', 'b2', 'b3']), { x: LX + 10, y: yB, size: sz });
      fade(g, ramp(u, 18.0, 0.6), () => {
        const L = play(g, u - 18, [[0, B0], [2.0, B1], [4.0, B2]], 1.3, { lift: 34, liftIds: ['b4'] });
        sayLay(L, u < 20 ? 'The fair is held there.' : 'the city where the fair is held');
        if (u > 19.0 && u < 20.0) fade(g, ramp(u, 19.0, 0.4), () => { cueBox(g, B0.byId.b4, COL.adv); note(g, B0.byId.b4, '부사 there', COL.adv, 40); });
        if (u > 23.6) {
          const b = seq(B2, 'the fair is held');
          gbox(g, b, COL.cl, '완전한 문장 · 빠진 것 없음', { a: ramp(u, 23.8, 0.5) });
          fade(g, ramp(u, 24.4, 0.4), () => mark(g, true, b.x + b.w + 26, yB, 18));
          fade(g, ramp(u, 25.4, 0.5), () => tag(g, '부사 there → 없어도 문장이 서요', B2.x + B2.w + 60, yB, COL.adv));
        }
      });
      fade(g, ramp(u, 28.8, 0.6), () => {
        const c1 = tag(g, '대명사가 빠지면 → 빈자리 (불완전한 문장)', LX, 540, COL.gap, { size: 18, h: 42 });
        tag(g, '부사가 빠지면 → 완전한 문장', c1.x + c1.w + 20, 540, COL.cl, { size: 18, h: 42 });
      });
    },

    /* 02 관계부사: 한국어는 같은 모양, 영어는 빈자리로 가름 → where · when · why → 장소 명사 함정 */
    radv(g, u) {
      const cols = [
        { x: LX, ko: [['우리가 예약한', 'mod'], [' 호텔', 'ante']], en: 'the_hotel which we reserved ▢', roles: { 'the hotel': 'ante', which: 'rel', reserved: 'v' }, box: 'we reserved ▢', bc: COL.gap, bl: '빈자리 있음 → 관계대명사', say: 'the hotel which we reserved' },
        { x: 660, ko: [['박람회가 열리는', 'mod'], [' 도시', 'ante']], en: 'the_city where the fair is held', roles: { 'the city': 'ante', where: 'rel', is: 'v', held: 'v' }, box: 'the fair is held', bc: COL.cl, bl: '완전한 문장 → 관계부사', say: 'the city where the fair is held' },
      ];
      cols.forEach((c, i) => {
        fade(g, ramp(u, 0.6 + i * 0.6, 0.5), () => {
          let x = c.x;
          c.ko.forEach(([s, r]) => {
            const w = txt(g, s, x, 178, { size: 26, weight: 600, color: r === 'ante' ? COL.ante : COL.cl });
            g.fillStyle = r === 'ante' ? COL.ante : COL.cl; g.fillRect(x + (r === 'ante' ? 6 : 0), 196, w - (r === 'ante' ? 6 : 0), 3);
            x += w;
          });
        });
        fade(g, ramp(u, 6.4 + i * 1.2, 0.6), () => {
          const L = lay(g, toks(c.en, c.roles, 'r' + i), { x: c.x, y: 270, size: 27 });
          drawLay(g, L);
          sayLay(L, c.say);
          gbox(g, seq(L, c.box), c.bc, c.bl, { a: ramp(u, 7.2 + i * 1.2, 0.5) });
        });
      });
      fade(g, ramp(u, 3.0, 0.5) * (1 - ramp(u, 6.2, 0.4)), () => chip(g, '한국어: 꾸미는 말 + 명사, 모양이 같아요', W / 2, 232, { size: 17, weight: 700, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 36 }));
      // 관계부사 카드 셋
      const now = S.adv || (u >= 17.5 && u < 20.5 ? 'time' : u >= 20.5 && u < 23.5 ? 'reason' : null);
      RADV.forEach((r, k) => {
        const x = LX + k * 380, y = 360, on = now === r.k, a = ramp(u, S.adv ? 0 : r.at, 0.5);
        fade(g, a * (now && !on ? 0.4 : 1), () => {
          panel(g, x, y, 350, 136, { fill: on ? 'rgba(255,193,94,0.10)' : COL.panel, stroke: on ? COL.rel : COL.faint, lw: on ? 2.2 : 1.3 });
          const pw = piece(g, r.w, x + 20, y + 32, 24);
          txt(g, `${r.name} + 완전한 문장`, x + 32 + pw, y + 32, { size: 17, weight: 700, color: COL.soft });
          const L = lay(g, toks(r.ex, { [r.w]: 'rel' }, 'x' + k), { x: x + 20, y: y + 78, size: 19 });
          drawLay(g, L, tk => tk.r === 'rel' ? {} : { color: COL.en });
          sayLay(L, r.ex);
          txt(g, '절 안에서 빠진 말 = ' + r.back, x + 20, y + 112, { size: 14, weight: 600, color: COL.adv });
        });
      });
      // 장소 명사 함정
      fade(g, ramp(u, 23.8, 0.6), () => {
        panel(g, LX, 516, 1110, 58, { fill: COL.panel2, stroke: COL.trap });
        txt(g, '함정', LX + 20, 545, { size: 17, weight: 800, color: COL.trap });
        const L = lay(g, toks('the_museum which we visited ▢', { 'the museum': 'ante', which: 'rel', visited: 'v' }, 'm'), { x: LX + 84, y: 545, size: 24 });
        drawLay(g, L, tk => tk.r === 'gap' ? { glow: glowAt(u) * 0.6 } : {});
        sayLay(L, 'the museum which we visited');
        fade(g, ramp(u, 25.4, 0.5), () => txt(g, '장소 명사라도 visited 뒤가 비었어요 → which (where ×)', L.x + L.w + 28, 545, { size: 17, weight: 700, color: COL.soft }));
      });
    },

    /* 03 where = 전치사 + which: in which → where, 표, 전치사 뒤 관계부사 ×, the way how × */
    pw(g, u) {
      const k = S.pw || 'place', e = PW[k], merge = S.pw ? 1 : 0;
      const restIds = e.rest.split(' ').map((_, i) => 'r' + i);
      const P0 = lay(g, toks(`${e.ante} ${e.p} which ${e.rest}`, { [e.ante.replace('_', ' ')]: 'ante', [e.p]: 'trap', which: 'rel' }, 'p', ['pa', 'pp', 'pw'].concat(restIds)), { x: W / 2, y: 200, size: 34, align: 'center' });
      const merged = k === 'way' ? `how ${e.rest}` : `${e.ante} ${e.w} ${e.rest}`;
      const P1 = lay(g, toks(merged, { [e.ante.replace('_', ' ')]: 'ante', [e.w]: 'rel' }, 'p', (k === 'way' ? ['pw'] : ['pa', 'pw']).concat(restIds)), { x: W / 2, y: 200, size: 34, align: 'center' });
      const t0 = S.pw ? -1 : 6.6;
      fade(g, ramp(u, 0.4, 0.6), () => {
        const L = merge || u >= t0 + 1.4 ? P1 : u < t0 ? P0 : null;
        if (L) drawLay(g, L); else morph(g, P0, P1, (u - t0) / 1.4);
        const showP0 = !merge && u < t0;
        if (showP0) {
          const b = seq(P0, `${e.p} which`);
          fade(g, ramp(u, 2.2, 0.5), () => {
            g.strokeStyle = COL.rel; g.lineWidth = 2.2; rr(g, b.x - 4, 200 - 27, b.w + 8, 54, 9); g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
            txt(g, '전치사 + which', b.x + b.w / 2, 252, { size: 16, weight: 700, color: COL.rel, align: 'center' });
          });
          sayLay(P0, pwText(k, false));
        } else if (L === P1 || merge) {
          const wd = P1.byId.pw;
          fade(g, ramp(u, merge ? 0 : t0 + 1.6, 0.5), () => txt(g, k === 'way' ? '= the way we work (the way how ×)' : `= ${e.p} which`, wd.x + wd.w / 2, 252, { size: 16, weight: 700, color: COL.rel, align: 'center' }));
          const b = seq(P1, e.rest);
          gbox(g, b, COL.cl, '', { a: ramp(u, merge ? 0 : 9.2, 0.5) });
          fade(g, ramp(u, merge ? 0 : 9.4, 0.4), () => mark(g, true, b.x + b.w + 24, 200, 18));
          sayLay(P1, pwText(k, true));
        }
      });
      // 표: 전치사 + which → 관계부사
      fade(g, ramp(u, 11.8, 0.5), () => {
        panel(g, LX, 290, 540, 282, { fill: COL.panel, stroke: COL.faint });
        txt(g, '전치사 + which = 관계부사', LX + 20, 316, { size: 16, weight: 700, color: COL.muted });
      });
      ['place', 'time', 'reason', 'way'].forEach((kk, i) => {
        const r = PW[kk], y = 362 + i * 54, at = [11.9, 12.5, 14.4, 23.6][i];
        const on = S.pw ? S.pw === kk : false;
        fade(g, ramp(u, S.pw ? 0 : at, 0.5) * (S.pw && !on ? 0.45 : 1), () => {
          if (on) panel(g, LX + 10, y - 23, 520, 46, { fill: 'rgba(255,193,94,0.10)', stroke: COL.rel, r: 10 });
          txt(g, r.name, LX + 26, y, { size: 18, weight: 700, color: COL.soft });
          const w1 = txt(g, r.pre, LX + 92, y, { size: 20, weight: 700, color: COL.trap });
          arrow(g, LX + 104 + w1, y, LX + 150 + w1, y, COL.muted, 2);
          const pw = piece(g, r.w, LX + 164 + w1, y, 21);
          if (kk === 'way') txt(g, '(the way how ×)', LX + 176 + w1 + pw, y, { size: 15, weight: 700, color: COL.trap });
        });
      });
      // 전치사 뒤 관계부사 ×
      const rows = (list, y0, at) => list.forEach(([s, roles, okv, bad], i) => fade(g, ramp(u, at + i * 0.9, 0.5), () => {
        const y = y0 + i * 33;
        const L = lay(g, toks(s, roles, 'q' + y0 + i), { x: 688, y, size: 20 });
        drawLay(g, L, tk => bad && tk.t === bad ? { r: 'bad' } : {});
        mark(g, okv, L.x + L.w + 22, y, 15);
        if (okv) sayLay(L, s.replace(/_/g, ' '));
      }));
      fade(g, ramp(u, 17.6, 0.5), () => {
        panel(g, 664, 290, 526, 136, { fill: COL.panel2, stroke: COL.trap });
        txt(g, '전치사 바로 뒤 → 관계부사 ×', 688, 312, { size: 16, weight: 700, color: COL.trap });
      });
      rows([['the room in where we met', { in: 'trap', where: 'rel' }, false, 'where'], ['the room in which we met', { in: 'trap', which: 'rel' }, true], ['the room where we met', { where: 'rel' }, true]], 342, 18.2);
      fade(g, ramp(u, 23.6, 0.5), () => {
        panel(g, 664, 436, 526, 136, { fill: COL.panel2, stroke: COL.trap });
        txt(g, 'the way how ×', 688, 458, { size: 16, weight: 700, color: COL.trap });
      });
      rows([['the_way how we work', { 'the way': 'ante', how: 'rel' }, false, 'how'], ['the_way we work', { 'the way': 'ante' }, true], ['how we work', { how: 'rel' }, true]], 488, 24.6);
    },

    /* 04 선행사를 품은 whoever · whatever */
    cpro(g, u) {
      const T = toks('___ arrives first should unlock the office.', { arrives: 'v', should: 'v', unlock: 'v' }, 'c');
      const filled = u > 12.4;
      const L = lay(g, filled ? T.map(t => t.r === 'blank' ? Object.assign({}, t, { t: 'Whoever', r: 'rel' }) : t) : T, { x: LX, y: 196, size: 32 });
      fade(g, ramp(u, 0.4, 0.6), () => {
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: glowAt(u) } : tk.t === 'arrives' && u > 6.4 && u < 12.4 ? { cue: true } : {});
        sayLay(L, 'Whoever arrives first should unlock the office.');
      });
      fade(g, ramp(u, 6.6, 0.5) * (1 - ramp(u, 12.0, 0.4)), () => {
        tag(g, '바로 뒤 동사 arrives → 주어 빈자리', LX, 262, COL.gap);
        fade(g, ramp(u, 9.4, 0.5), () => tag(g, '앞에 꾸밀 명사 없음 → 선행사 없음', 520, 262, COL.ante));
      });
      if (filled) {
        gbox(g, seq(L, 'Whoever arrives first'), COL.ante, '문장의 주어 (명사 자리)', { a: ramp(u, 12.8, 0.5) });
        fade(g, ramp(u, 13.6, 0.6), () => {
          txt(g, '=', LX, 330, { size: 30, weight: 800, color: COL.accent });
          const L2 = lay(g, toks('Anyone who arrives first should unlock the office.', { Anyone: 'ante', who: 'rel', arrives: 'v', should: 'v', unlock: 'v' }, 'c2'), { x: LX + 40, y: 330, size: 26 });
          drawLay(g, L2);
          sayLay(L2, 'Anyone who arrives first should unlock the office.');
          txt(g, '‘먼저 오는 사람은 누구든’ 문을 열어야 해요', LX + 40, 372, { size: 17, weight: 600, color: COL.soft });
        });
      }
      fade(g, ramp(u, 18.2, 0.6), () => {
        const L3 = lay(g, toks('Take whatever you need ▢.', { Take: 'v', whatever: 'rel', need: 'v' }, 'c3'), { x: LX, y: 446, size: 28 });
        drawLay(g, L3, tk => tk.r === 'gap' ? { glow: glowAt(u) * 0.6 } : {});
        sayLay(L3, 'Take whatever you need.');
        gbox(g, seq(L3, 'you need ▢'), COL.gap, 'need → 무엇을? 빈자리', { a: ramp(u, 19.2, 0.5) });
        fade(g, ramp(u, 20.4, 0.5), () => {
          const c = tag(g, '= anything that you need', L3.x + L3.w + 40, 446, COL.rel, { size: 17 });
          txt(g, '필요한 것은 무엇이든', c.x + c.w + 16, 446, { size: 17, weight: 600, color: COL.soft });
        });
      });
      fade(g, ramp(u, 24.4, 0.6), () => {
        const c1 = tag(g, '선행사를 품은 말 → 명사 뒤 ×', LX, 546, COL.ante, { size: 18, h: 42 });
        tag(g, '뒤에는 꼭 빈자리', c1.x + c1.w + 20, 546, COL.gap, { size: 18, h: 42 });
      });
    },

    /* 05 however + 형용사, wherever · whenever */
    cadv(g, u) {
      const C0 = lay(g, toks('We are busy.', { are: 'v', busy: 'adv' }, 'h', ['h0', 'h1', 'h2']), { x: LX, y: 190, size: 32 });
      const C1 = lay(g, toks('However busy we are, safety comes first.', { However: 'rel', busy: 'adv', are: 'v', comes: 'v' }, 'h', ['hh', 'h2', 'h0', 'h1', 'h4', 'h5', 'h6']), { x: LX, y: 190, size: 32 });
      fade(g, ramp(u, 0.6, 0.6), () => {
        const L = play(g, u, [[0, C0], [6.4, C1]], 1.6, { lift: -34, liftIds: ['h2'] });
        sayLay(L, u < 6.4 ? 'We are busy.' : 'However busy we are, safety comes first.');
        if (u > 8.4) {
          const a = C1.byId.hh, b = C1.byId.h2;
          fade(g, ramp(u, 8.4, 0.5), () => {
            rr(g, a.x - 8, 190 - 30, b.x + b.w - a.x + 16, 60, 12); g.strokeStyle = COL.accent; g.lineWidth = 2.4; g.stroke();
            txt(g, '한 덩어리 → No matter how busy we are', a.x - 2, 246, { size: 17, weight: 700, color: COL.accent });
          });
        }
      });
      // 빈칸 바로 뒤 형용사 → however
      fade(g, ramp(u, 12.2, 0.6), () => {
        panel(g, LX, 290, 540, 282, { fill: COL.panel, stroke: COL.faint });
        txt(g, '빈칸 바로 뒤에 형용사가 보이면', LX + 20, 316, { size: 16, weight: 700, color: COL.muted });
        const L = lay(g, toks('___ busy we are, safety comes first.', { busy: 'adv', are: 'v', comes: 'v' }, 'hq'), { x: LX + 20, y: 364, size: 24 });
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: 0.5 } : tk.t === 'busy' ? { cue: true } : {});
        const d = { front: 'adv', back: 'full', next: 'adj', sense: 'any-degree' };
        [['However', '형용사를 데리고 와요'], ['Whatever', ''], ['Whenever', '']].forEach(([w, why], i) => fade(g, ramp(u, 13.2 + i * 1.1, 0.4), () => {
          const y = 424 + i * 46, j = WH.judge(w, d), okv = j.s === 'ok';
          mark(g, okv, LX + 34, y, 15);
          const ww = txt(g, w, LX + 58, y, { size: 23, weight: 700, color: okv ? COL.rel : COL.muted });
          if (!okv) { g.strokeStyle = COL.bad; g.lineWidth = 2.2; g.beginPath(); g.moveTo(LX + 54, y + 1); g.lineTo(LX + 62 + ww, y + 1); g.stroke(); }
          txt(g, why || (w === 'Whatever' ? '뒤에 빈자리가 없어요' : '형용사를 못 데려와요'), LX + 78 + ww, y, { size: 15, weight: 600, color: COL.muted });
        }));
      });
      // wherever · whenever · whatever
      fade(g, ramp(u, 18.2, 0.6), () => {
        panel(g, 650, 290, 540, 282, { fill: COL.panel, stroke: COL.faint });
        const rows = [['wherever', '어디서 ~하든', 'Wherever you travel, our app can help.'], ['whenever', '언제 ~하든', 'Whenever you need help, call us.']];
        rows.forEach(([w, ko, s], i) => fade(g, ramp(u, 18.4 + i * 1.6, 0.5), () => {
          const y = 322 + i * 92;
          const pw = piece(g, w, 674, y, 20);
          txt(g, ko, 686 + pw, y, { size: 16, weight: 700, color: COL.soft });
          const L = lay(g, toks(s, { [w.charAt(0).toUpperCase() + w.slice(1)]: 'rel', need: 'v', travel: 'v', call: 'v', help: i === 0 ? 'v' : '' }, 'hw' + i), { x: 674, y: y + 40, size: 20 });
          drawLay(g, L);
          sayLay(L, s);
          if (i === 1 && u > 24) gbox(g, seq(L, 'you need help'), COL.cl, '완전', { a: ramp(u, 24.2, 0.5), lsize: 13 });
        }));
        fade(g, ramp(u, 25.6, 0.5), () => {
          const L = lay(g, toks('Whatever you need ▢, call us.', { Whatever: 'rel', need: 'v', call: 'v' }, 'hx'), { x: 674, y: 526, size: 20 });
          drawLay(g, L, tk => tk.r === 'gap' ? { glow: glowAt(u) * 0.6 } : {});
          sayLay(L, 'Whatever you need, call us.');
          gbox(g, seq(L, 'you need ▢'), COL.gap, '빈자리', { a: ramp(u, 26.2, 0.5), lsize: 13 });
        });
      });
    },

    /* 06 명사절 that vs what */
    thatwhat(g, u) {
      const N0 = lay(g, toks('I know the_answer.', { know: 'v' }, 'n', ['n0', 'n1', 'n2']), { x: LX, y: 186, size: 30 });
      const N1 = lay(g, toks('I know that sales rose.', { know: 'v', that: 'rel', rose: 'v' }, 'n', ['n0', 'n1', 'nt', 'n3', 'n4']), { x: LX, y: 186, size: 30 });
      fade(g, ramp(u, 0.4, 0.6), () => {
        const L = play(g, u, [[0, N0], [2.6, N1]], 1.2);
        sayLay(L, u < 2.6 ? 'I know the answer.' : 'I know that sales rose.');
        if (u < 2.4) gbox(g, seq(N0, 'the answer'), COL.ante, '목적어 = 명사', { a: ramp(u, 1.0, 0.5) });
        else if (u > 3.8) gbox(g, seq(N1, 'that sales rose'), COL.ante, '목적어 = 명사절', { a: ramp(u, 3.9, 0.5) });
      });
      // that + 완전한 문장
      fade(g, ramp(u, 6.2, 0.6), () => {
        const L = lay(g, toks('It is clear that we need more staff.', { that: 'rel', need: 'v', is: 'v' }, 'nc'), { x: LX, y: 306, size: 28 });
        drawLay(g, L);
        sayLay(L, 'It is clear that we need more staff.');
        const b = seq(L, 'we need more staff');
        gbox(g, b, COL.cl, '완전한 문장', { a: ramp(u, 8.0, 0.5) });
        fade(g, ramp(u, 8.6, 0.4), () => mark(g, true, L.x + L.w + 24, 306, 17));
        fade(g, ramp(u, 10.0, 0.5), () => txt(g, 'It = 가짜 주어, 진짜 주어는 that절', LX, 362, { size: 14, weight: 600, color: COL.muted }));
      });
      // what + 빈자리
      fade(g, ramp(u, 12.2, 0.6), () => {
        const L = lay(g, toks('What we need ▢ is more time.', { What: 'rel', need: 'v', is: 'v' }, 'nw'), { x: LX, y: 430, size: 28 });
        drawLay(g, L, tk => tk.r === 'gap' ? { glow: glowAt(u) * 0.6 } : {});
        sayLay(L, 'What we need is more time.');
        gbox(g, seq(L, 'we need ▢'), COL.gap, 'need → 무엇을? 빈자리', { a: ramp(u, 14.0, 0.5) });
      });
      fade(g, ramp(u, 18.4, 0.5), () => tag(g, 'that → ‘~라는 것’ · 빈자리 없음', 700, 306, COL.cl, { size: 18, h: 42 }));
      fade(g, ramp(u, 20.6, 0.5), () => tag(g, 'what → ‘~하는 것’ · 빈자리 있음', 700, 430, COL.gap, { size: 18, h: 42 }));
      fade(g, ramp(u, 24.4, 0.6), () => {
        panel(g, LX, 512, 1110, 58, { fill: COL.panel2, stroke: COL.faint });
        let x = LX + 20;
        x += piece(g, 'what', x, 541, 22) + 14;
        x += txt(g, '=', x, 541, { size: 24, weight: 800, color: COL.accent }) + 14;
        const L = lay(g, toks('the_thing which', { 'the thing': 'ante', which: 'rel' }, 'nn'), { x, y: 541, size: 22 });
        drawLay(g, L);
        txt(g, '관계대명사 튜토리얼 → 앞에 명사 없음 + 뒤에 빈자리', L.x + L.w + 26, 541, { size: 16, weight: 600, color: COL.soft });
      });
    },

    /* 07 whether와 if: 목적어 자리는 둘 다, 네 자리는 whether만 */
    whether(g, u) {
      fade(g, ramp(u, 0.4, 0.6), () => {
        const L = lay(g, toks('I wonder whether the store is open.', { wonder: 'v', whether: 'rel', is: 'v' }, 'w1'), { x: LX, y: 180, size: 28 });
        drawLay(g, L); sayLay(L, 'I wonder whether the store is open.');
        gbox(g, seq(L, 'the store is open'), COL.cl, '완전한 문장', { a: ramp(u, 2.6, 0.5) });
        mark(g, true, L.x + L.w + 24, 180, 16);
        fade(g, ramp(u, 6.6, 0.5), () => {
          const L2 = lay(g, toks('I wonder if the store is open.', { wonder: 'v', if: 'rel', is: 'v' }, 'w2'), { x: 700, y: 180, size: 28 });
          drawLay(g, L2); sayLay(L2, 'I wonder if the store is open.');
          mark(g, true, L2.x + L2.w + 24, 180, 16);
        });
        fade(g, ramp(u, 8.4, 0.5), () => chip(g, '동사의 목적어 자리 → 둘 다 돼요', 700, 234, { size: 16, weight: 700, color: COL.cl, fill: COL.panel2, stroke: COL.cl, h: 34, r: 9 }));
      });
      WROWS.forEach((r, k) => {
        const y = 300 + k * 62, on = S.wrow === k, dim = S.wrow != null && !on;
        fade(g, ramp(u, S.wrow != null ? 0 : r.at, 0.5) * (dim ? 0.35 : 1), () => {
          panel(g, LX, y - 26, 1110, 52, { fill: on ? 'rgba(255,193,94,0.10)' : COL.panel, stroke: on ? COL.rel : COL.faint, r: 10 });
          chip(g, r.tag, LX + 14, y, { size: 15, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, h: 30, r: 8, pad: 10 });
          const s = on ? r.s.replace(/whether|Whether/, m => m === 'Whether' ? 'If' : 'if') : r.s;
          const L = lay(g, toks(s, { whether: 'rel', Whether: 'rel', if: 'bad', If: 'bad' }, 'wr' + k), { x: LX + 196, y, size: 22 });
          drawLay(g, L);
          sayLay(L, r.s);
          if (on) txt(g, WH.judge('if', r.d).why, L.x + L.w + 18, y, { size: 13, weight: 600, color: COL.trap });
          else {
            chip(g, 'if', 1110, y, { size: 17, weight: 700, color: COL.bad, fill: COL.panel2, stroke: COL.bad, h: 30, r: 8, pad: 12, dash: true });
            cross(g, 1162, y, 13, COL.bad);
          }
        });
      });
      fade(g, ramp(u, 30.2, 0.6), () => chip(g, '이 네 자리 → whether만 · 다른 목적어 자리 → 둘 다', W / 2, 552, { size: 18, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 40, r: 10 }));
    },

    /* 08 의문사 명사절의 어순: 한국어는 순서 그대로, 영어는 평서문 어순으로 */
    order(g, u) {
      fade(g, ramp(u, 0.4, 0.5), () => tag(g, '한국어', LX, 176, COL.soft));
      const K0 = lay(g, toks('기차가 언제 떠나요?', { 언제: 'rel' }, 'k', ['k0', 'k1', 'k2']), { x: LX + 110, y: 176, size: 30 });
      const K1 = lay(g, toks('기차가 언제 떠나는지 몰라요.', { 언제: 'rel', 떠나는지: 'mod' }, 'k', ['k0', 'k1', 'k2', 'k3']), { x: LX + 110, y: 176, size: 30 });
      fade(g, ramp(u, 1.0, 0.6), () => {
        play(g, u, [[0, K0], [7.0, K1]], 1.2);
        if (u > 8.6) fade(g, ramp(u, 8.6, 0.5), () => tag(g, '순서는 그대로, 끝만 -는지', K1.x + K1.w + 36, 176, COL.cl));
      });
      fade(g, ramp(u, 12.2, 0.5), () => tag(g, '영어', LX, 296, COL.soft));
      const E0 = lay(g, toks('When does the train leave?', { When: 'rel', does: 'trap', leave: 'v' }, 'e', ['ew', 'ed', 'e1', 'e2', 'ev']), { x: LX + 110, y: 296, size: 32 });
      const E1 = lay(g, toks('I don’t know when the train leaves.', { when: 'rel', leaves: 'v', know: '' }, 'e', ['ei', 'en', 'ek', 'ew', 'e1', 'e2', 'ev']), { x: LX + 110, y: 296, size: 32 });
      E1.byId.ew.r = 'rel';
      fade(g, ramp(u, 12.4, 0.6), () => {
        const L = play(g, u, [[0, E0], [18.6, E1]], 1.6, { lift: 30, liftIds: ['ew'] });
        sayLay(L, u < 18.6 ? 'When does the train leave?' : 'I don’t know when the train leaves.');
        if (u > 14.8 && u < 18.4) {
          const d = E0.byId.ed, s = E0.byId.e1;
          fade(g, ramp(u, 14.8, 0.5) * (1 - ramp(u, 18.0, 0.4)), () => {
            arc(g, d.x + d.w / 2, 296 + 24, s.x + s.w / 2 + 10, 296 + 24, -26, COL.trap, 1, { head: false, dash: false });
            txt(g, '조동사 does + 주어 → 의문문 어순', d.x, 360, { size: 16, weight: 700, color: COL.trap });
          });
        }
        if (u > 20.6) gbox(g, seq(E1, 'when the train leaves'), COL.cl, '의문사 + 주어 + 동사 (평서문 어순)', { a: ramp(u, 20.6, 0.5) });
      });
      fade(g, ramp(u, 24.2, 0.6), () => {
        const A = lay(g, toks('Where can I park?', { Where: 'rel', can: 'trap', park: 'v' }, 'o1'), { x: LX + 110, y: 436, size: 26 });
        drawLay(g, A); sayLay(A, 'Where can I park?');
        arrow(g, A.x + A.w + 22, 436, A.x + A.w + 74, 436, COL.muted, 2.5);
        fade(g, ramp(u, 25.6, 0.6), () => {
          const B = lay(g, toks('Can you tell me where I can park?', { where: 'rel', can: 'v', park: 'v', tell: 'v' }, 'o2'), { x: A.x + A.w + 92, y: 436, size: 26 });
          drawLay(g, B); sayLay(B, 'Can you tell me where I can park?');
          gbox(g, seq(B, 'where I can park'), COL.cl, '평서문 어순', { a: ramp(u, 26.8, 0.5) });
        });
      });
      fade(g, ramp(u, 30.4, 0.6), () => {
        const c1 = tag(g, '의문사 who · what → 뒤에 빈자리', LX, 548, COL.gap, { size: 18, h: 42 });
        tag(g, 'when · where · why · how → 완전한 문장', c1.x + c1.w + 20, 548, COL.cl, { size: 18, h: 42 });
      });
    },

    /* 09 3단계 풀이법 흐름도 (판별기: 직접 해 보기에서 뒤·앞을 고르면 길이 켜짐) */
    method(g, u) {
      const P = S.path, back = P && P.back, front = P && P.front;
      const bkey = !back ? null : back === 'subj' || back === 'obj' ? 'gap' : back === 'to' ? 'ornot' : back;
      const fkey = !front ? null : front.startsWith('ante') ? 'ante' : front.startsWith('noun') ? 'noun' : 'adv';
      const cols = [
        { x: 80, head: '① 뒤를 본다', sub: '빈자리가 있나?', at: 6.0, boxes: [
          ['빈자리 있음', ['which · who · whom · what', 'whoever · whatever'], 'gap', COL.gap, 70],
          ['빠진 것 없음 (완전)', ['where · when · why · how · that', 'whether · if · however · wherever · whenever'], 'full', COL.cl, 70],
          ['바로 뒤 형용사·부사', ['However busy we are, …'], 'adj', COL.rel, 52],
          ['바로 뒤 or not · to부정사', ['whether or not · whether to go'], 'ornot', COL.rel, 52]] },
        { x: 480, head: '② 앞을 본다', sub: '무슨 자리?', at: 18.2, boxes: [
          ['명사 뒤 → 관계사', ['the hotel which · the city where'], 'ante', COL.ante, 62],
          ['명사 자리 → 명사절', ['주어 · 목적어 · 보어 · 전치사 뒤', 'what we need · that we need staff'], 'noun', COL.ante, 78],
          ['문장 밖 → 부사절', ['완전한 문장에 붙음', 'Wherever you go, …'], 'adv', COL.ante, 78]] },
        { x: 880, head: '③ 함정을 본다', sub: '뜻 · 자리', at: 24.6, boxes: [
          ['사람 · 사물 · 장소 · 시간 · 이유', ['who · which · where · when · why'], 'x', COL.trap, 52],
          ['전치사 바로 뒤', ['in which (in where ×)'], 'x', COL.trap, 52],
          ['방법은 하나만', ['the way · how (the way how ×)'], 'x', COL.trap, 52],
          ['if를 못 쓰는 네 자리', ['주어 · 전치사 뒤 · or not · to 앞'], 'x', COL.trap, 52],
          ['의문사 뒤 어순', ['when the train leaves'], 'x', COL.trap, 52]] },
      ];
      cols.forEach((c, ci) => {
        fade(g, ramp(u, 0.8 + ci * 0.5, 0.6), () => {
          panel(g, c.x, 146, 320, 52, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 18, 172, { size: 20, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 302, 172, { size: 14, weight: 600, color: COL.muted, align: 'right' });
          if (ci < 2) arrow(g, c.x + 328, 172, c.x + 392, 172, COL.accent, 3);
        });
        let y = 210;
        c.boxes.forEach(([k, lines, key, color, hh], bi) => {
          const at = (P ? 0 : c.at) + 0.4 + bi * 0.5;
          const on = P && ((ci === 0 && key === bkey) || (ci === 1 && key === fkey));
          const y0 = y;
          fade(g, ramp(u, at, 0.5) * (P && ci < 2 && !on ? 0.4 : 1), () => {
            panel(g, c.x, y0, 320, hh, { fill: on ? 'rgba(255,193,94,0.14)' : COL.panel, stroke: on ? COL.rel : COL.faint, lw: on ? 2.5 : 1.3, r: 12 });
            g.fillStyle = color; g.fillRect(c.x + 1, y0 + 10, 3, hh - 20);
            txt(g, k, c.x + 16, y0 + 19, { size: 16, weight: 700, color });
            lines.forEach((ln, li) => txt(g, ln, c.x + 16, y0 + 42 + li * 19, { size: 13.5, weight: 500, color: /[가-힣]/.test(ln) && !/×/.test(ln) ? COL.muted : COL.en }));
          });
          y += hh + 8;
        });
      });
      if (P && P.back && P.front) {
        const r = WH.pathWords(P.back, P.front);
        const s = r.words.length ? '들어갈 말 → ' + r.words.map(x => x.w).join(' · ') : '이 조합에 맞는 말이 없어요';
        chip(g, s, W / 2, 556, { size: 18, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 40, r: 10 });
      }
    },

    /* 10 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = WH.DRILL[P.k], d = it.d, c = it.c;
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0] + 1, s2 = v >= P.at[1] + 2.4, s3 = v >= P.at[2];
        const ans = it.opts[it.a];
        const q = c.ante ? it.q.replace(c.ante, c.ante.replace(/ /g, '_')) : it.q;
        const roles = {};
        if (c.ante) roles[c.ante] = s2 ? 'ante' : '';
        if (c.trap) roles[c.trap] = s2 ? 'trap' : '';
        const base = toks(q, roles, 'k').map(tk => tk.r === 'blank' && s3 ? Object.assign(tk, { t: ans, r: 'rel' }) : tk);
        let withGap = base;
        if (c.gapAfter) {
          const bi = base.findIndex(t => t.r === 'blank' || t.r === 'rel'), gi = base.findIndex((t, i) => i > bi && t.t === c.gapAfter);
          withGap = base.slice(0, gi + 1).concat([{ id: 'gp', t: '', r: 'gap' }], base.slice(gi + 1));
        }
        const o = { x: LX, y: 222, size: 28, maxW: 1110, lh: 50 };
        const L0 = lay(g, base, o), L1 = lay(g, withGap, o), gp = clamp((v - P.at[0] - 1) / 0.7);
        const L = c.gapAfter && gp >= 1 ? L1 : L0;
        const st = tk => tk.r === 'blank' ? { glow: s1 && !s3 ? 0.5 : 0 } : tk.r === 'gap' ? { glow: glowAt(u) * 0.6 } : {};
        if (c.gapAfter && gp > 0 && gp < 1) morph(g, L0, L1, gp, { style: st }); else drawLay(g, L, st);
        sayLay(L, it.q.replace('___', ans));
        if (s1) {
          const ga = ramp(v, P.at[0] + 1.4, 0.5);
          if (c.gapAfter) {
            const gt = L1.byId.gp;
            if (gt && gp >= 1) fade(g, ga, () => note(g, gt, '빈자리', COL.gap, 40));
          } else gbox(g, seq(L, c.cue), COL.cl, '완전한 문장', { a: ga });
        }
        if (s2) {
          const sa = ramp(v, P.at[1] + 2.4, 0.5);
          if (d.front === 'ante') fade(g, sa, () => note(g, L.items[0], '명사 뒤', COL.ante, 40));
          else if (d.role === 'prep') fade(g, sa, () => note(g, byText(L, c.trap), '전치사 뒤', COL.trap, 40));
          else fade(g, sa, () => { const b = L.items.find(t => t.r === 'blank' || t.r === 'rel'); note(g, b, '주어 자리', COL.ante, 40); });
        }
        const oy = L.lines > 1 ? 364 : 330;
        it.opts.forEach((op, k) => {
          const ox = LX + (k % 2) * 290, y = oy + Math.floor(k / 2) * 78, j = WH.judge(op, d);
          const right = k === it.a;
          const goneAt = right ? 99 : j.step === 1 ? P.at[1] + 0.8 : j.step === 2 ? P.at[1] + 4.2 : P.at[2] + 0.8;
          const gone = !right && v >= goneAt, win = right && s3;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, op, ox + 52, y, { size: 27, weight: win ? 700 : 600, color: win ? COL.good : gone ? COL.dim : COL.text });
          if (v >= P.at[0] + 1.6) fade(g, ramp(v, P.at[0] + 1.6, 0.5) * (gone ? 0.5 : 1), () => famTag(g, op, ox + 62 + w, y, d));
          if (win) { const tw2 = tw(g, '빈자리 쪽', 13, 700) + 16; panel(g, ox - 14, y - 26, w + tw2 + 90, 52, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + w + tw2 + 92, y, 18); }
          if (gone) {
            const gp2 = clamp((v - goneAt) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, y + 1); g.lineTo(ox - 4 + (w + 62) * gp2, y + 1); g.stroke();
          }
        });
        panel(g, 680, oy - 40, 520, 230, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + (k === 1 ? 2.4 : 0.3), 0.5), () => {
          const y = oy - 2 + k * 70;
          txt(g, ['① 뒤', '② 앞', '③ 함정'][k], 704, y, { size: 18, weight: 700, color: COL.accent });
          txt(g, ln, 704, y + 30, { size: 18, weight: 600, color: k === 2 ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 340, 770], CW = [250, 420, 420], Y0 = 150, RH = 74;
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 70, Y0 - 6, 1130, RH * 3 + 70, { fill: COL.panel, stroke: COL.faint });
        txt(g, '빈칸의 자리', X[0] + 20, Y0 + 24, { size: 16, weight: 700, color: COL.muted });
        chip(g, '빈자리 있음 (불완전)', X[1] + 12, Y0 + 24, { size: 16, weight: 700, color: COL.gap, fill: COL.panel2, stroke: COL.gap, h: 32, r: 9, dash: true });
        chip(g, '빠진 것 없음 (완전)', X[2] + 12, Y0 + 24, { size: 16, weight: 700, color: COL.cl, fill: COL.panel2, stroke: COL.cl, h: 32, r: 9 });
        g.fillStyle = COL.faint; g.fillRect(84, Y0 + 50, 1102, 1);
      });
      const rows = [
        ['명사 뒤', '관계사', 'which · who · whom · that', 'where · when · why · 전치사 + which'],
        ['명사 자리', '명사절', 'what · whoever · whatever · who', 'that · whether · if · when · how'],
        ['문장 밖', '부사절', 'whoever · whatever', 'however + 형용사 · wherever · whenever'],
      ];
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.8, 0.6), () => {
        const y = Y0 + 50 + RH * ri + RH / 2;
        txt(g, r[0], X[0] + 20, y - 11, { size: 20, weight: 700 });
        txt(g, r[1], X[0] + 20, y + 15, { size: 15, weight: 600, color: COL.ante });
        txt(g, r[2], X[1] + 14, y, { size: 19, weight: 700, color: COL.en });
        txt(g, r[3], X[2] + 14, y, { size: 19, weight: 700, color: COL.en });
        if (ri < 2) { g.fillStyle = COL.faint; g.fillRect(84, Y0 + 50 + RH * (ri + 1), 1102, 1); }
      }));
      const steps = ['① 뒤: 빈자리가 있나?', '② 앞: 무슨 자리?', '③ 함정: 뜻 · 전치사 · if'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 12.2 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 490, { size: 20, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 48, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 490, c.x + c.w + 46, 490, COL.accent, 2.5);
        x = c.x + c.w + 58;
      }));
    },
  };

  // 영상 추출용 자막: 아래쪽 띠에 두 줄까지. **굵게**는 강조색, 영어는 연한 하늘색
  function drawCaption(g, text) {
    if (!text) return;
    const words = [];
    text.split('**').forEach((part, k) => { const bold = k % 2 === 1; part.split(/(\s+)/).forEach(w => w && words.push({ w, bold, en: /[A-Za-zÀ-ÿ]/.test(w) && !/[가-힣]/.test(w) })); });
    // 띄어쓰기 사이의 조각은 한 덩어리로 줄을 바꿈 (굵은 낱말 바로 뒤의 '예요.'가 다음 줄로 떨어지지 않게)
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

  WV.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[WV.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, WV.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + Object.values(WH.LEX).map(d => d.w + d.ko + (d.para || '')).join('') +
    WH.DRILL.map(d => d.q + d.opts.join('')).join('') + Object.values(WH.KIND).join('') + Object.values(WH.SENSE).join('') +
    Object.values(WH.FRONTS).join('') + Object.values(WH.BACKS).join('') + Object.values(PW).map(p => p.pre + p.name).join('') +
    WROWS.map(r => r.s + r.tag + WH.judge('if', r.d).why).join('') + '들어갈 말 → 이 조합에 맞는 말이 없어요' +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;·()[]→←↔✓×?~=+-/:…‘’’';
  WV.baseText = EXTRA;
  WV.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = WV.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { WV.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
