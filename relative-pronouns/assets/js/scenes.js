/* 관계대명사 튜토리얼 — 영상 장면
 *
 * RV.render(g, t)는 시각 t와 사용자 상태 RV.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 영어 문장은 낱말 조각(토큰)으로 그립니다. 토큰마다 id가 있어서, 두 배치(layout) 사이를 오가며
 * 같은 id의 낱말은 미끄러지듯 움직이고(She → who처럼 글자가 바뀌면 겹쳐 바뀜), 없는 낱말은 사라지거나 나타납니다.
 * 색은 문법 역할을 나타냅니다: 선행사(하늘색) · 관계대명사(노란색) · 빈자리(분홍 점선) · 관계사절(민트 밑줄) · 동사(보라) · 함정(주황)
 * 문장이 맞는지 틀리는지는 모두 grammar.js의 규칙 엔진(RP.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const RP = window.RP;
  const RV = (window.RV = {});
  const W = 1280, H = 720;
  RV.W = W; RV.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  RV.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  RV.COL = COL;

  // 사용자 상태 ('직접 해 보기'와 화면 누르기로 바뀜). 영상 추출은 언제나 기본값
  const S = (RV.S = { ex: 0, pair: 'chef', plural: null, omit: false, poss: 'company', comma: true, prepFront: true, path: null });
  RV.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  RV.hits = () => HITS;

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
  // 토큰 { id, t: 글자, r: 역할 }. 역할: ante rel gap blank prep noun verb cue clause dim bad good ''
  const RCOL = { ante: COL.ante, rel: COL.rel, prep: COL.trap, noun: COL.clause, verb: COL.verb, cue: COL.verb, dim: COL.dim, bad: COL.bad, good: COL.good };
  const PUNCT = /^[.,?!]$/;
  const tokW = (g, tk, size) => tk.r === 'gap' ? size * 1.45 : tk.r === 'blank' ? Math.max(size * 2.8, tk.t ? tw(g, tk.t, size, 700) + size * 0.7 : 0) :
    tw(g, tk.t, size, tk.r === 'rel' ? 700 : 500) + (tk.r === 'rel' ? size * 0.5 : 0);
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
    let width = 0;
    lines.forEach((l, li) => {
      const lw = l.length ? l[l.length - 1].x + l[l.length - 1].w : 0;
      width = Math.max(width, lw);
      const x0 = o.align === 'center' ? o.x - lw / 2 : o.x;
      l.forEach(it => { it.x += x0; it.y = o.y + li * lh; items.push(it); byId[it.id] = it; });
    });
    const left = Math.min(...items.map(i => i.x)), right = Math.max(...items.map(i => i.x + i.w));
    return { items, byId, size, lines: lines.length, x: left, w: right - left, y: o.y, h: (lines.length - 1) * lh + size * 1.3 };
  }
  // 문자열 → 토큰 (띄어쓰기로 자르고 마침표·쉼표는 따로). roles: { '글자': 역할 }
  function toks(s, roles = {}, pre = 't') {
    const out = [];
    s.split(' ').forEach(w => {
      const m = w.match(/^(.*?)([.,?!]?)$/);
      if (m[1]) out.push({ id: pre + out.length, t: m[1] === '___' ? '' : m[1], r: m[1] === '___' ? 'blank' : roles[m[1]] || '' });
      if (m[2]) out.push({ id: pre + out.length, t: m[2], r: '' });
    });
    return out;
  }
  // 토큰 하나 그리기. o: { a: 투명도, r: 역할 바꾸기, glow: 빈자리 반짝임(0→1) }
  function drawTok(g, it, o = {}) {
    const r = o.r != null ? o.r : it.r, size = it.size, x = it.x, y = it.y, w = it.w;
    g.save(); g.globalAlpha *= o.a == null ? 1 : o.a;
    if (g.globalAlpha <= 0.002) { g.restore(); return; }
    if (r === 'gap') {
      const h = size * 1.12;
      rr(g, x, y - h / 2, w, h, 8);
      g.fillStyle = `rgba(255,122,168,${0.10 + 0.12 * (o.glow || 0)})`; g.fill();
      g.setLineDash([6, 5]); g.strokeStyle = COL.gap; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]);
    } else if (r === 'blank') {
      g.fillStyle = COL.text; g.fillRect(x, y + size * 0.42, w, 3);
      if (it.t) txt(g, it.t, x + w / 2, y, { size, weight: 700, color: o.color || COL.good, align: 'center' });
    } else if (r === 'rel') {
      const h = size * 1.22;
      rr(g, x, y - h / 2, w, h, 9);
      g.fillStyle = 'rgba(255,193,94,0.16)'; g.fill(); g.strokeStyle = COL.rel; g.lineWidth = 2; g.stroke();
      txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: COL.rel, align: 'center' });
    } else {
      const c = o.color || RCOL[r] || COL.text;
      txt(g, it.t, x, y + 1, { size, weight: r === 'ante' || r === 'bad' || r === 'good' ? 600 : 500, color: c });
      if (r === 'ante') { g.fillStyle = COL.ante; g.fillRect(x, y + size * 0.56, w, 3); }
      if (r === 'verb' || r === 'cue') { g.fillStyle = COL.verb; g.fillRect(x, y + size * 0.56, w, 2); }
      if (r === 'bad') { g.strokeStyle = COL.bad; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x + w + 3, y + 2); g.stroke(); }
    }
    g.restore();
  }
  // 배치 하나 그리기. style(it) → drawTok 옵션 (선택)
  function drawLay(g, L, style) { L.items.forEach(it => drawTok(g, it, style ? style(it) || {} : {})); }
  // 두 배치 사이 (p: 0→1). 같은 id는 움직이고, 글자·역할이 다르면 겹쳐 바뀜. lift: 멀리 움직이는 낱말을 위로 띄움
  function morph(g, A, B, p, o = {}) {
    const e = ease(clamp(p)), seen = new Set(), style = o.style || (() => ({}));
    const ids = A.items.map(i => i.id).concat(B.items.map(i => i.id)).filter(id => !seen.has(id) && seen.add(id));
    ids.forEach(id => {
      const a = A.byId[id], b = B.byId[id];
      if (a && b) {
        const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
        // xFirst: 다른 줄에서 올라오는 낱말은 먼저 옆으로 미끄러진 뒤 제자리로 올라감 (지나가며 다른 낱말과 겹치지 않게)
        const two = o.xFirst && dy > 20, ex = two ? ease(clamp(p / 0.6)) : e, ey = two ? ease(clamp((p - 0.45) / 0.55)) : e;
        const lift = !two && o.lift && (dx > 90 || dy > 30) ? Math.sin(Math.PI * e) * o.lift : 0;
        const m = Object.assign({}, b, { x: lerp(a.x, b.x, ex), y: lerp(a.y, b.y, ey) - lift, w: lerp(a.w, b.w, e), size: lerp(a.size, b.size, e) });
        if (a.t === b.t && a.r === b.r) drawTok(g, m, style(b, e));
        else { drawTok(g, Object.assign({}, m, { t: a.t, r: a.r }), Object.assign({}, style(a, e), { a: 1 - e })); drawTok(g, m, Object.assign({}, style(b, e), { a: e })); }
      } else if (a) drawTok(g, a, Object.assign({}, style(a, e), { a: 1 - ramp(p, 0, 0.5) }));
      else drawTok(g, b, Object.assign({}, style(b, e), { a: ramp(p, 0.5, 0.5) }));
    });
  }
  // 관계사절 밑줄 (민트), from~to 토큰. label이 있으면 가운데 아래에
  function bracket(g, L, from, to, label, a = 1, color = COL.clause) {
    const A = L.byId[from], B = L.byId[to];
    if (!A || !B || a <= 0.001) return;
    const x0 = A.x, x1 = B.x + B.w, y = A.y + A.size * 0.82;
    fade(g, a, () => {
      g.strokeStyle = color; g.lineWidth = 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y - 7); g.lineTo(x0, y); g.lineTo(lerp(x0, x1, a), y); if (a > 0.98) g.lineTo(x1, y - 7); g.stroke();
      if (label) txt(g, label, (x0 + x1) / 2, y + 20, { size: 17, weight: 600, color, align: 'center' });
    });
  }
  const mid = it => [it.x + it.w / 2, it.y];
  const top = it => [it.x + it.w / 2, it.y - it.size * 0.62];
  const bot = it => [it.x + it.w / 2, it.y + it.size * 0.7];
  function sayLay(L, text) { say(L.x - 8, L.y - L.size * 0.8, L.w + 16, L.h + L.size * 0.3, text); }
  const sentenceOf = toks => RP.text(toks);

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '토익 단골 문제', d: 24, caps: [
      [0.4, 4.5, '**관계대명사**는 토익 문법 문제에 자주 나오는 단골 손님이에요.'],
      [4.5, 9, '예를 들어 이런 문제예요. 빈칸에 who, whom, whose, what 중 무엇이 들어갈까요?'],
      [9, 13.5, '3초 안에 골라 보세요. 감으로 고르면 자꾸 틀려요.'],
      [13.5, 18, '규칙을 알면 문장을 다 해석하지 않아도 답이 보여요.'],
      [18, 24, '관계대명사가 하는 일, **빈자리** 찾기, 그리고 **3단계 풀이법**을 차례로 배워요.'],
    ] },
    { id: 'order', n: '01', title: '꾸미는 말의 자리', sub: '한국어는 앞, 영어는 뒤', d: 30, caps: [
      [0.4, 5.5, '한국어에서는 꾸미는 말이 명사 **앞**에 와요. ‘한국 음식을 요리하는’ 요리사.'],
      [5.5, 11, '영어는 반대예요. 긴 꾸밈말은 명사 **뒤**에 붙어요. a chef who cooks Korean food.'],
      [11, 16, '한 단어로 꾸밀 때는 a busy chef처럼 앞에 두지만, 문장처럼 길어지면 뒤로 가요.'],
      [16, 21, '그래서 영어는 명사를 먼저 말하고, 뒤에서 설명을 덧붙인다고 생각하면 돼요.'],
      [21, 26, '꾸밈을 받는 앞의 명사를 **선행사**, 뒤에서 꾸미는 문장을 **관계사절**이라고 해요.'],
      [26, 30, '관계사절의 맨 앞에서 문을 여는 말, who가 바로 **관계대명사**예요.'],
    ] },
    { id: 'combine', n: '02', title: '두 문장을 하나로', sub: '접속사 + 대명사', d: 36, caps: [
      [0.4, 5, '두 문장이 있어요. I know a chef. She cooks Korean food.'],
      [5, 10, 'a chef와 She는 같은 사람이에요. 같은 사람을 두 번 말하고 있죠.'],
      [10, 16.5, 'She를 **who**로 바꾸면, who가 두 문장을 잇는 **접속사**와 She를 대신하는 **대명사** 일을 함께 해요.'],
      [16.5, 23, '이제 who로 시작하는 문장을 a chef 바로 뒤에 붙여요. I know a chef who cooks Korean food.'],
      [23, 30, '사물도 같아요. It을 **which**로 바꿔 printer 뒤에 붙이면 This is the printer which copies 50 pages a minute.'],
      [30, 36, '사람이면 who, 사물이나 동물이면 which. **that**은 둘 다에 쓸 수 있어요.'],
    ] },
    { id: 'gap', n: '03', title: '빈자리 찾기', sub: '관계사절의 비밀', d: 36, caps: [
      [0.4, 5.5, '관계사절에는 중요한 비밀이 있어요. 문장 안에 **빈자리**가 꼭 하나 있다는 거예요.'],
      [5.5, 11.5, 'She는 주어 자리에 있었어요. She가 who로 바뀌어 맨 앞으로 가면, 주어 자리가 비어요.'],
      [11.5, 17, '목적어도 마찬가지예요. We interviewed him에서 him이 whom이 되어 앞으로 가요.'],
      [17, 22.5, '이번에는 interviewed 뒤, 목적어 자리가 비었어요. 그 빈자리가 가리키는 것이 바로 선행사예요.'],
      [22.5, 29, '빈칸 바로 뒤에 동사가 오면 주어가 빠진 것, 주어와 동사 뒤에 목적어가 없으면 목적어가 빠진 것이에요.'],
      [29, 36, '빈자리를 찾는 눈, 이것이 관계대명사 문제를 푸는 가장 강력한 열쇠예요.'],
    ] },
    { id: 'subj', n: '04', title: '주격 who · which', sub: '빈자리 = 주어', d: 34, caps: [
      [0.4, 5.5, '빈자리가 주어이면 **주격** 관계대명사를 써요. 사람은 who, 사물은 which, 둘 다 that.'],
      [5.5, 10.5, 'an assistant who answers calls. 빈자리 바로 뒤에 동사 answers가 와요.'],
      [10.5, 15, 'a machine which sorts mail. 사물이니까 which, 이번에도 바로 뒤에 동사예요.'],
      [15, 21, '토익에 자주 나오는 함정이 있어요. 관계대명사 뒤 동사의 **수**는 무엇에 맞출까요?'],
      [21, 27.5, '정답은 **선행사**예요. who는 앞의 manager를 대신하니까, 단수면 oversees, 복수면 oversee.'],
      [27.5, 34, 'Employees who 다음에는 복수 동사 attend. who만 보지 말고, 그 앞의 명사를 보세요.'],
    ] },
    { id: 'obj', n: '05', title: '목적격 whom · which', sub: '빈자리 = 목적어', d: 34, caps: [
      [0.4, 6, '빈자리가 목적어이면 **목적격** 관계대명사예요. 사람은 whom, 사물은 which, 둘 다 that.'],
      [6, 11.5, 'the candidate whom we interviewed yesterday. interviewed 뒤의 목적어가 비었어요.'],
      [11.5, 16, 'the report which Mina wrote. wrote 뒤가 비어 있죠. 빈칸 뒤에 주어와 동사가 이어져요.'],
      [16, 22, '목적격 관계대명사는 **생략**할 수 있어요. the candidate we interviewed처럼요.'],
      [22, 28, '명사 바로 뒤에 주어와 동사가 이어지면, 그 사이에 관계대명사가 숨어 있다고 읽으세요.'],
      [28, 34, '주격은 생략할 수 없어요. 회화에서는 whom 대신 who도 쓰지만, 시험에서는 whom이 정답이에요.'],
    ] },
    { id: 'whose', n: '06', title: '소유격 whose', sub: '관사 없는 명사 앞', d: 30, caps: [
      [0.4, 5.5, '이번에는 **소유격** whose예요. We work with a company. Its profits doubled last year.'],
      [5.5, 11, 'Its는 ‘그 회사의’라는 뜻이에요. 이 소유격을 whose로 바꿔 company 뒤에 붙여요.'],
      [11, 16.5, 'a company whose profits doubled last year. 작년에 수익이 두 배가 된 회사라는 뜻이에요.'],
      [16.5, 22.5, 'whose 뒤에는 꼭 명사가 오고, 그 명사 앞에는 the나 a 같은 관사가 붙지 않아요.'],
      [22.5, 30, '빈칸 뒤에 관사 없는 명사가 오고 나머지가 완전한 문장이면, 답은 whose예요. 사람에도 사물에도 써요.'],
    ] },
    { id: 'what', n: '07', title: '선행사를 품은 what', sub: '= the thing which', d: 30, caps: [
      [0.4, 6, '이번에는 조금 특별한 **what**이에요. the thing which, 곧 ‘~하는 것’을 한 단어로 줄인 말이에요.'],
      [6, 12, 'What she said surprised everyone. 그녀가 말한 것이 모두를 놀라게 했어요.'],
      [12, 18, 'what은 선행사를 이미 품고 있어요. 그래서 앞에 명사가 있으면 what을 쓸 수 없어요.'],
      [18, 24, 'the report what she wrote는 틀린 표현이에요. report가 선행사이니 which나 that을 써요.'],
      [24, 30, '빈칸 앞에 꾸밀 명사가 없고, 뒤에 빈자리가 있으면 what. 이것만 기억하세요.'],
    ] },
    { id: 'thatno', n: '08', title: 'that을 못 쓰는 자리', sub: '콤마 뒤 · 전치사 뒤', d: 30, caps: [
      [0.4, 6, 'that은 거의 어디에나 쓸 수 있지만, 쓸 수 없는 자리가 두 곳 있어요.'],
      [6, 12, '첫째, **콤마 뒤**. Our new office, which is on the fifth floor, is very quiet. 여기에 that은 안 돼요.'],
      [12, 17, '콤마 뒤의 관계사절은 이미 정해진 대상에 설명을 덧붙이는 **계속적 용법**이에요.'],
      [17, 23, '둘째, **전치사 바로 뒤**. the agency with which we signed the contract. with that은 안 돼요.'],
      [23, 30, '사람이면 with whom을 써요. 전치사를 문장 끝으로 보내면 that도 쓸 수 있어요.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: '앞 → 뒤 → 함정', d: 34, caps: [
      [0.4, 5.5, '이제 지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 12, '① 빈칸 **앞**을 봐요. 선행사가 사람인지, 사물인지, 아예 없는지 확인해요. 없으면 what.'],
      [12, 19, '② 빈칸 **뒤**를 봐요. 바로 동사가 오면 주격, 주어와 동사 뒤에 목적어가 없으면 목적격.'],
      [19, 25, '관사 없는 명사가 오고 나머지가 완전하면 whose. 빠진 자리가 없으면 관계대명사가 아니에요.'],
      [25, 30, '③ **함정**을 봐요. 콤마나 전치사 뒤에는 that을 못 쓰고, 동사의 수는 선행사에 맞춰요.'],
      [30, 34, '자, 이 순서로 실제 토익 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '처음에 본 문제예요. ① 빈칸 앞 The manager는 사람이에요. 선행사가 있으니 what은 탈락.'],
      [6, 12, '② 빈칸 바로 뒤에 동사 oversees가 와요. 주어가 빠졌으니 주격! 목적격 whom, 소유격 whose도 탈락.'],
      [12, 18, '③ 콤마도 전치사도 없어요. 정답은 (A) who. 문장을 다 해석하지 않아도 풀렸어요.'],
      [18.4, 24.5, '두 번째 문제. ① 선행사 The museum은 사물이니 who는 탈락, 명사가 있으니 what도 탈락.'],
      [24.5, 31, '② we visited 뒤에 목적어가 없어요. 빈자리가 있으니, 완전한 문장을 이끄는 where는 탈락.'],
      [31, 37, '정답은 (D) which. ‘박물관’이라 where를 고르기 쉬운 단골 함정이에요.'],
      [37.4, 43.5, '세 번째. ① Applicants는 사람이라 which는 탈락.'],
      [43.5, 50, '② 빈칸 뒤에 관사 없는 명사 résumés가 오고, are incomplete까지 완전한 문장이에요.'],
      [50, 56, '명사의 주인이 빠졌으니 소유격, 정답은 (B) whose. 빠진 자리가 없으니 who와 whom은 탈락이에요.'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 표', d: 22, caps: [
      [0.4, 6, '정리해요. 관계대명사는 앞의 명사, 곧 선행사를 뒤에서 꾸미는 문장을 열어요.'],
      [6, 12, '선행사가 사람인지 사물인지, 빈자리가 주어인지 목적어인지 소유격인지가 답을 정해요.'],
      [12, 17, '빠진 자리 없이 완전한 문장을 이끄는 where, when은 **관계부사**라고 해요.'],
      [17, 22, '아래에서 직접 문장을 합쳐 보고, 연습 문제로 3단계 풀이법을 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  RV.CHAPTERS = CHAPTERS; RV.CAPTIONS = CAPTIONS; RV.END = END;
  RV.POSTER = CHAPTERS.find(c => c.id === 'gap').t + 33;
  RV.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  RV.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  /* ---------- 장면에서 쓰는 예문 ---------- */
  const ORDER_EX = [
    { koMod: '한국 음식을 요리하는', koN: '요리사', n: 'a chef', rel: 'who', rest: 'cooks Korean food', short: ['a', 'busy', 'chef'], shortKo: '바쁜 요리사' },
    { koMod: '1분에 50장을 복사하는', koN: '프린터', n: 'a printer', rel: 'which', rest: 'copies 50 pages a minute', short: ['a', 'fast', 'printer'], shortKo: '빠른 프린터' },
    { koMod: '작년에 수익이 두 배가 된', koN: '회사', n: 'a company', rel: 'whose', rest: 'profits doubled last year', short: ['a', 'small', 'company'], shortKo: '작은 회사' },
  ];
  RV.ORDER_EX = ORDER_EX;
  // 실전 문제: 연습 문제(RP.DRILL)에서 세 개. 보기를 몇 단계에서 지우는지(el), 짧은 까닭(why), 화면에 쓸 풀이 줄
  const PRACTICE = [
    { k: 0, at: [0.4, 6, 12], el: { 3: 1, 1: 2, 2: 2 }, why: { 3: '선행사 있음', 1: '목적격', 2: '뒤에 명사가 없음' },
      lines: ['The manager → 사람 · 선행사 있음', 'oversees → 바로 동사 → 주어가 빠짐 → 주격', '콤마·전치사 없음 → (A) who'], ante: ['The', 'manager'], cue: ['oversees'] },
    { k: 8, at: [0.4, 6.1, 12.6], el: { 2: 1, 1: 1, 0: 2 }, why: { 2: '사람에만', 1: '선행사 있음', 0: '빈자리가 있음' },
      lines: ['The museum → 사물 · 선행사 있음', 'we visited ▢ → 목적어가 빠짐 → 목적격', '콤마 없음 → (D) which'], ante: ['The', 'museum'], cue: ['we', 'visited'] },
    { k: 2, at: [0.4, 6.5, 13], el: { 2: 1, 0: 2, 3: 2 }, why: { 2: '사물에만', 0: '빠진 자리 없음', 3: '빠진 자리 없음' },
      lines: ['Applicants → 사람', 'résumés → 관사 없는 명사 + 완전한 문장', '명사의 주인이 빠짐 → (B) whose'], ante: ['Applicants'], cue: ['résumés'] },
  ];
  // 실전 문제의 탈락·정답이 규칙 엔진과 같은지 확인
  PRACTICE.forEach(p => {
    const it = RP.DRILL[p.k];
    it.opts.forEach((o, i) => {
      const s = RP.judge(o.toLowerCase(), it.d).s;
      if ((i === it.a) !== (s === 'ok') || (i !== it.a && p.el[i] == null)) console.warn('[관계대명사] 실전 문제 풀이가 규칙 엔진과 달라요:', it.q, o, s);
    });
  });

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o)); }

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제 → 오늘 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '관계대명사', W / 2, 300, { size: 84, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Relative Pronouns', W / 2, 378, { size: 30, weight: 500, color: COL.muted, align: 'center' });
      });
      const words = ['who', 'whom', 'which', 'that', 'whose', 'what'];
      let x = W / 2 - 330;
      words.forEach((w, k) => {
        const a = ramp(u, 1.3 + k * 0.18, 0.4) * out1;
        fade(g, a, () => { const c = chip(g, w, x + 55, 465 + (1 - a) * 10, { size: 22, weight: 700, color: COL.rel, fill: 'rgba(255,193,94,0.12)', stroke: COL.rel, align: 'center', r: 10 }); });
        x += 110;
      });
      // 토익 문제 카드
      const it = RP.DRILL[0];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 17.6, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 160, 1000, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 180, 202, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const L = lay(g, toks(it.q), { x: 180, y: 285, size: 30, maxW: 930 });
        drawLay(g, L, tk => tk.r === 'blank' && u > 13.5 ? { } : {});
        sayLay(L, it.q.replace('___', it.opts[it.a]));
        it.opts.forEach((o, k) => {
          const ox = 200 + (k % 2) * 440, oy = 400 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            txt(g, o, ox + 64, oy, { size: 30, weight: 600 });
          });
        });
        // 3초 타이머
        const tp = clamp((u - 9) / 3), on = u > 8.8 && u < 13.6;
        if (on) {
          const cx = 1060, cy = 205, r = 26;
          g.strokeStyle = COL.faint; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
          g.strokeStyle = COL.accent; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - tp)); g.stroke();
          txt(g, String(Math.max(1, 3 - Math.floor(tp * 3))), cx, cy + 1, { size: 26, weight: 700, fam: FM, align: 'center', color: COL.accent });
        }
        fade(g, ramp(u, 13.6, 0.5), () => {
          txt(g, '?', 1060, 205, { size: 44, weight: 800, fam: FD, align: 'center', color: COL.accent });
        });
      });
      // 오늘 배울 것
      const steps = [['①', '관계대명사가 하는 일', 'who = 접속사 + 대명사'], ['②', '빈자리 찾기', 'who ▢ cooks Korean food'], ['③', '3단계 풀이법', '앞 → 뒤 → 함정']];
      steps.forEach(([n, t1, t2], k) => {
        const a = ramp(u, 18.4 + k * 0.7, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 220, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 285 + (1 - a) * 16, { size: 34, weight: 700, color: COL.accent });
          txt(g, t1, x0 + 28, 345 + (1 - a) * 16, { size: 25, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 400 + (1 - a) * 16, { size: 19, weight: 500, color: COL.en });
        });
      });
    },

    /* 01 꾸미는 말의 자리: 한국어(꾸밈 → 명사) vs 영어(명사 ← 꾸밈) */
    order(g, u) {
      const ex = ORDER_EX[S.ex] || ORDER_EX[0];
      const YK = 205, YE = 325, X0 = 220;
      fade(g, ramp(u, 0.2, 0.5), () => label(g, '한국어', LX, YK, { size: 20, color: COL.soft }));
      fade(g, ramp(u, 5.6, 0.5), () => label(g, '영어', LX, YE, { size: 20, color: COL.soft }));
      // 한국어 줄
      const kmA = ramp(u, 0.6, 0.6), knA = ramp(u, 1.5, 0.6);
      const kmW = tw(g, ex.koMod, 27, 500) + 32, knW = tw(g, ex.koN, 27, 700) + 32;
      fade(g, kmA, () => {
        panel(g, X0, YK - 28, kmW, 56, { r: 12, fill: 'rgba(127,224,168,0.10)', stroke: COL.clause });
        txt(g, ex.koMod, X0 + 16, YK, { size: 27, weight: 500, color: COL.clause });
      });
      fade(g, knA, () => {
        panel(g, X0 + kmW + 14, YK - 28, knW, 56, { r: 12, fill: 'rgba(110,200,255,0.10)', stroke: COL.ante });
        txt(g, ex.koN, X0 + kmW + 30, YK, { size: 27, weight: 700, color: COL.ante });
      });
      fade(g, ramp(u, 3, 0.6), () => {
        arc(g, X0 + kmW * 0.5, YK - 32, X0 + kmW + 14 + knW * 0.5, YK - 32, 26, COL.clause, ramp(u, 3, 0.8), { dash: false });
        label(g, '꾸미는 말 → 명사', X0 + kmW + knW + 50, YK, { color: COL.clause });
      });
      // 영어 줄
      const E = [{ id: 'n', t: ex.n, r: 'ante' }, { id: 'rel', t: ex.rel, r: 'rel' }].concat(ex.rest.split(' ').map((w, i) => ({ id: 'w' + i, t: w, r: 'clause' })));
      const L = lay(g, E, { x: X0, y: YE, size: 32 });
      const lastId = 'w' + (ex.rest.split(' ').length - 1);
      fade(g, ramp(u, 6, 0.5), () => drawTok(g, L.byId.n));
      const fly = clamp((u - 7) / 2.2), clauseA = ramp(u, 8.4, 0.8);
      if (fly > 0 && fly < 1) {   // 한국어 꾸밈말이 영어 명사 뒤로 날아감
        const e = ease(fly), x = lerp(X0, L.byId.rel.x, e), y = lerp(YK, YE, e) - Math.sin(Math.PI * e) * 50;
        fade(g, 1 - ramp(fly, 0.6, 0.4), () => {
          panel(g, x, y - 28, kmW, 56, { r: 12, fill: 'rgba(127,224,168,0.10)', stroke: COL.clause });
          txt(g, ex.koMod, x + 16, y, { size: 27, weight: 500, color: COL.clause });
        });
      }
      fade(g, clauseA, () => {
        L.items.filter(it => it.id !== 'n').forEach(it => drawTok(g, it));
        bracket(g, L, 'rel', lastId, '', ramp(u, 9, 0.6));
      });
      if (clauseA > 0.5) sayLay(L, ex.n + ' ' + ex.rel + ' ' + ex.rest);
      fade(g, ramp(u, 9.6, 0.6), () => {
        const a = L.byId.n, b = L.byId.rel, e2 = L.byId[lastId];
        arc(g, (b.x + e2.x + e2.w) / 2, YE - 26, a.x + a.w / 2, YE - 24, 34, COL.clause, ramp(u, 9.6, 0.8), { dash: false });
        label(g, '명사 ← 꾸미는 말', L.x + L.w + 30, YE, { color: COL.clause });
      });
      // 짧은 꾸밈 vs 긴 꾸밈
      const pa = ramp(u, 11, 0.6) * (1 - ramp(u, 20.6, 0.5));
      fade(g, pa, () => {
        panel(g, LX, 430, 1120, 136, { fill: COL.panel, stroke: COL.faint });
        label(g, '짧은 꾸밈 (한 단어)', LX + 28, 470, { color: COL.soft });
        const Ls = lay(g, [{ id: 's0', t: ex.short[0], r: '' }, { id: 's1', t: ex.short[1], r: 'clause' }, { id: 's2', t: ex.short[2], r: 'ante' }], { x: LX + 260, y: 470, size: 28 });
        drawLay(g, Ls);
        label(g, `${ex.shortKo} · 명사 앞`, Ls.x + Ls.w + 26, 470);
        label(g, '긴 꾸밈 (문장)', LX + 28, 528, { color: COL.soft });
        const Ll = lay(g, E, { x: LX + 260, y: 528, size: 28 });
        drawLay(g, Ll, it => it.r === 'clause' ? { color: COL.clause } : {});
        label(g, '명사 뒤', Ll.x + Ll.w + 26, 528);
      });
      // 용어
      const ta = ramp(u, 21, 0.6);
      fade(g, ta, () => {
        const n = L.byId.n, r = L.byId.rel, e2 = L.byId[lastId];
        txt(g, '선행사', n.x + n.w / 2, YE + 66, { size: 22, weight: 700, color: COL.ante, align: 'center' });
        txt(g, 'antecedent', n.x + n.w / 2, YE + 94, { size: 16, weight: 500, color: COL.muted, align: 'center' });
        txt(g, '관계사절', (r.x + e2.x + e2.w) / 2, YE + 66, { size: 22, weight: 700, color: COL.clause, align: 'center' });
        txt(g, 'relative clause', (r.x + e2.x + e2.w) / 2, YE + 94, { size: 16, weight: 500, color: COL.muted, align: 'center' });
      });
      fade(g, ramp(u, 26, 0.6), () => {
        const r = L.byId.rel;
        panel(g, r.x - 20, YE + 120, 260, 64, { fill: 'rgba(255,193,94,0.10)', stroke: COL.rel });
        txt(g, '관계대명사', r.x + 110, YE + 142, { size: 22, weight: 700, color: COL.rel, align: 'center' });
        txt(g, 'relative pronoun', r.x + 110, YE + 168, { size: 15, weight: 500, color: COL.muted, align: 'center' });
        g.strokeStyle = COL.rel; g.lineWidth = 2; g.beginPath(); g.moveTo(r.x + r.w / 2, YE + 24); g.lineTo(r.x + r.w / 2, YE + 118); g.stroke();
      });
    },

    /* 02 두 문장을 하나로: She → who, 절을 a chef 뒤에 붙이기. 두 번째 예문은 사물 */
    combine(g, u) {
      const first = RP.pair(S.pair) || RP.pair('chef');
      const second = RP.pair(first.id === 'printer' ? 'chef' : 'printer');
      const run = (pr, v, y0, size, big) => {
        const A = pr.A.map((t, i) => ({ id: 'a' + i, t, r: i === pr.ante ? 'ante' : '' }));
        const B = pr.B.map((t, i) => ({ id: 'b' + i, t, r: i === pr.share ? 'ante' : '' }));
        const rel = RP.base(pr.kind, pr.gap);
        const B2 = B.map(tk => tk.id === 'b' + pr.share ? Object.assign({}, tk, { t: rel, r: 'rel' }) : tk);
        const C = RP.combine(pr, { rel });
        const LA = lay(g, A, { x: W / 2, y: y0, size, align: 'center' });
        const LB = lay(g, B, { x: W / 2, y: y0 + size * 2.3, size, align: 'center' });
        const LB2 = lay(g, B2, { x: W / 2, y: y0 + size * 2.3, size, align: 'center' });
        const LC = lay(g, C, { x: W / 2, y: y0 + size * 1.15, size, align: 'center', maxW: 1120 });
        const T = big ? [0.4, 1.6, 5, 10, 16.5] : [0, 0.6, 1.5, 2.6, 4.2];
        const plain = () => ({ r: '' });
        const hl = v >= T[3] - 0.01;
        if (v < T[4]) {
          fade(g, ramp(v, T[0], 0.6), () => drawLay(g, LA, it => it.r === 'ante' && v < T[2] ? plain() : {}));
          const Bp = clamp((v - T[3]) / 1.2);
          fade(g, ramp(v, T[1], 0.6), () => {
            if (Bp <= 0) drawLay(g, LB, it => it.r === 'ante' && v < T[2] ? plain() : {});
            else morph(g, LB, LB2, Bp);
          });
          // 같은 대상 잇기
          const la = ramp(v, T[2], 0.9), a = LA.byId['a' + pr.ante], b = (Bp > 0.5 ? LB2 : LB).byId['b' + pr.share];
          if (la > 0) {
            const [x0, y0b] = top(b), [x1, y1] = bot(a);
            g.save(); g.globalAlpha *= la * (1 - ramp(v, T[4] - 0.4, 0.4));
            g.setLineDash([6, 6]); g.strokeStyle = COL.ante; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x0, y0b - 4); g.lineTo(x1, y1 + 6); g.stroke(); g.setLineDash([]);
            if (big) chip(g, pr.kind === 'person' ? '같은 사람' : '같은 것', (x0 + x1) / 2, (y0b + y1) / 2, { size: 15, weight: 700, color: COL.ante, fill: COL.bg, stroke: COL.ante, align: 'center', h: 26, pad: 10, lw: 1 });
            g.restore();
          }
          // who = 접속사 + 대명사
          if (big && hl) fade(g, ramp(v, T[3] + 1, 0.6) * (1 - ramp(v, T[4] - 0.3, 0.3)), () => {
            const r = LB2.byId['b' + pr.share];
            const bx = r.x + r.w + 26, by = r.y;
            txt(g, `${rel} = 접속사 + 대명사`, Math.max(bx, LB2.x + LB2.w + 40), by, { size: 22, weight: 700, color: COL.rel });
            txt(g, `(and + ${pr.B[pr.share].toLowerCase()})`, Math.max(bx, LB2.x + LB2.w + 40), by + 32, { size: 18, weight: 500, color: COL.muted });
          });
        } else {
          // 두 문장 → 한 문장: A와 B2를 합쳐 하나의 배치처럼 움직임
          const both = { items: LA.items.concat(LB2.items), byId: Object.assign({}, LA.byId, LB2.byId) };
          const mp = clamp((v - T[4]) / 2.2);
          morph(g, both, LC, mp, { xFirst: true });
          const relId = 'b' + pr.share, last = C.filter(t => t.cl).pop();
          bracket(g, LC, relId, last.id, big ? '관계사절' : '', ramp(v, T[4] + 2.2, 0.6));
          if (mp >= 1) sayLay(LC, RP.text(C));
        }
        return LC;
      };
      run(first, u, 190, 36, true);
      if (u > 23) run(second, u - 23.2, 420, 30, false);
      // 규칙 칩
      const ra = ramp(u, 30.2, 0.6);
      fade(g, ra, () => {
        const rows = [['사람', 'who'], ['사물 · 동물', 'which'], ['둘 다', 'that']];
        let x = 250;
        rows.forEach(([k, w], i) => {
          fade(g, ramp(u, 30.2 + i * 0.4, 0.5), () => {
            const kw = label(g, k, x, 556, { size: 20, color: COL.soft });
            const c = chip(g, w, x + kw + 16, 556, { size: 21, weight: 700, color: COL.rel, fill: 'rgba(255,193,94,0.12)', stroke: COL.rel, r: 10 });
            x = c.x + c.w + 70;
          });
        });
      });
    },

    /* 03 빈자리 찾기: 대명사가 앞으로 가면 원래 자리가 빈다 */
    gap(g, u) {
      const XL = 100;
      const row = (pr, v, y, T, names) => {
        // T: [문장 등장, 역할 이름, 앞으로 이동 시작, 선행사 등장, 화살표]
        const B = pr.B.map((t, i) => ({ id: 'b' + i, t: i === 0 && t !== 'I' ? t : t, r: '' }));
        const rel = RP.base(pr.kind, pr.gap);
        const C = RP.combine(pr, { rel });
        const ante = pr.A[pr.ante], anteId = 'a' + pr.ante;
        // 선행사 + 관계사절만
        const clause = [{ id: anteId, t: ante.replace(/^The /, 'the '), r: 'ante' }].concat(C.filter(t => t.cl));
        const L1 = lay(g, B, { x: XL + 190, y, size: 31 });
        const L3 = lay(g, clause, { x: XL, y, size: 31 });
        const L2 = { items: L3.items.filter(i => i.id !== anteId), byId: Object.assign({}, L3.byId) };
        delete L2.byId[anteId];
        const mv = clamp((v - T[2]) / 1.6), an = ramp(v, T[3], 0.6);
        if (mv <= 0) {
          fade(g, ramp(v, T[0], 0.6), () => drawLay(g, L1, it => it.id === 'b' + pr.share && v > T[1] ? { color: COL.gap } : {}));
          // 문장 성분 이름
          fade(g, ramp(v, T[1], 0.5) * (1 - ramp(v, T[2] - 0.2, 0.2)), () => {
            L1.items.forEach((it, i) => { if (names[i]) txt(g, names[i], it.x + it.w / 2, y + 44, { size: 16, weight: 600, align: 'center', color: i === pr.share ? COL.gap : COL.muted }); });
          });
        } else {
          morph(g, L1, L2, mv, { lift: 60, style: (it, e) => it.id === 'gap' ? { glow: 0.5 + 0.5 * Math.sin(v * 4) } : {} });
          if (mv >= 1) {
            const gp = L2.byId.gap;
            fade(g, 1 - an, () => txt(g, '빈자리', gp.x + gp.w / 2, y + 44, { size: 16, weight: 700, align: 'center', color: COL.gap }));
          }
          fade(g, an, () => drawTok(g, L3.byId[anteId]));
          const ap = ramp(v, T[4], 1.2);
          if (ap > 0) {
            const gp = L3.byId.gap, at = L3.byId[anteId];
            arc(g, gp.x + gp.w / 2, y + 28, at.x + at.w / 2, y + 30, -58, COL.gap, ap);
            fade(g, ramp(v, T[4] + 1, 0.5), () => txt(g, `빈자리 = ${at.t}`, (gp.x + at.x + at.w) / 2, y + 102, { size: 17, weight: 700, color: COL.gap, align: 'center' }));
          }
          if (an > 0.5) sayLay(L3, RP.text(clause));
        }
        return L3;
      };
      row(RP.pair('chef'), u, 215, [0.4, 2.5, 6.8, 9, 9.6], ['주어', '동사', '목적어']);
      if (u > 11.3) row(RP.pair('candidate'), u, 405, [11.5, 12.8, 14.2, 17, 17.6], ['주어', '동사', '목적어', '부사']);
      // 오른쪽 규칙
      const rules = [
        [215, '빈칸 바로 뒤 = 동사', '→ 주어가 빠짐 (주격)'],
        [405, '주어 + 동사 뒤에 목적어 없음', '→ 목적어가 빠짐 (목적격)'],
      ];
      rules.forEach(([y, a, b], i) => fade(g, ramp(u, 23 + i * 2.2, 0.6), () => {
        panel(g, 892, y - 48, 328, 88, { fill: COL.panel, stroke: COL.faint });
        txt(g, a, 912, y - 15, { size: 18, weight: 700 });
        txt(g, b, 912, y + 17, { size: 18, weight: 600, color: COL.gap });
      }));
      fade(g, ramp(u, 29.4, 0.6), () => {
        chip(g, '관계사절 = 빈자리가 하나 있는 문장', W / 2, 556, { size: 22, weight: 700, color: COL.text, fill: COL.panel2, stroke: COL.gap, align: 'center', h: 50, r: 12, pad: 24 });
      });
    },

    /* 04 주격: 사람 who, 사물 which, 둘 다 that + 수 일치 */
    subj(g, u) {
      table(g, u, '주격 · 빈자리 = 주어', [['사람', 'who', 'that'], ['사물 · 동물', 'which', 'that']]);
      const ex = [
        { y: 200, toks: [{ id: 'n', t: 'an assistant', r: 'ante' }, { id: 'r', t: 'who', r: 'rel' }, { id: 'gap', t: '', r: 'gap' }, { id: 'v', t: 'answers', r: 'verb' }, { id: 'o', t: 'calls', r: 'clause' }], at: 5.6 },
        { y: 290, toks: [{ id: 'n', t: 'a machine', r: 'ante' }, { id: 'r', t: 'which', r: 'rel' }, { id: 'gap', t: '', r: 'gap' }, { id: 'v', t: 'sorts', r: 'verb' }, { id: 'o', t: 'mail', r: 'clause' }], at: 10.6 },
      ];
      ex.forEach(e => {
        const L = lay(g, e.toks, { x: 560, y: e.y, size: 32 });
        fade(g, ramp(u, e.at, 0.6), () => {
          drawLay(g, L, it => it.id === 'gap' ? { glow: 0.5 + 0.5 * Math.sin(u * 4) } : {});
          const gp = L.byId.gap, v = L.byId.v;
          fade(g, ramp(u, e.at + 1.2, 0.5), () => { txt(g, '바로 뒤 동사', v.x + v.w / 2, e.y + 40, { size: 15, weight: 600, align: 'center', color: COL.verb }); });
          sayLay(L, RP.text(e.toks));
        });
      });
      // 수 일치
      const ya = 420, yb = 500;
      const agree = [
        { y: ya, n: 'The manager', v: 'oversees', num: '단수', pl: false },
        { y: yb, n: 'The managers', v: 'oversee', num: '복수', pl: true },
      ];
      fade(g, ramp(u, 15.2, 0.6), () => {
        panel(g, LX - 10, 370, 700, 190, { fill: COL.panel, stroke: COL.faint });
        txt(g, '동사의 수는?', LX + 14, 392, { size: 16, weight: 600, color: COL.muted });
      });
      agree.forEach((r, i) => {
        const L = lay(g, [{ id: 'n', t: r.n, r: 'ante' }, { id: 'r', t: 'who', r: 'rel' }, { id: 'v', t: r.v, r: 'verb' }, { id: 'o', t: 'the project', r: 'clause' }], { x: LX + 14, y: r.y + 10, size: 30 });
        const dim = S.plural != null && S.plural !== r.pl;
        fade(g, ramp(u, 15.8 + i * 0.8, 0.6) * (dim ? 0.35 : 1), () => {
          drawLay(g, L);
          const ap = ramp(u, 21.4 + i * 1.2, 1);
          if (ap > 0) {
            const v = L.byId.v, n = L.byId.n;
            arc(g, v.x + v.w / 2, r.y - 10, n.x + n.w / 2, r.y - 10, 26, COL.verb, ap);
            fade(g, ramp(u, 22.4 + i * 1.2, 0.5), () => txt(g, r.num, L.x + L.w + 26, r.y + 10, { size: 19, weight: 700, color: COL.verb }));
          }
          sayLay(L, RP.text(L.items));
        });
      });
      // 토익 함정 카드
      fade(g, ramp(u, 27.6, 0.6), () => {
        panel(g, 820, 370, 400, 190, { fill: COL.panel2, stroke: COL.accent });
        txt(g, 'TOEIC 함정', 844, 396, { size: 15, weight: 500, fam: FM, color: COL.accent });
        txt(g, 'Employees who ___', 844, 436, { size: 25, weight: 600 });
        txt(g, 'the workshop …', 844, 470, { size: 25, weight: 600, color: COL.muted });
        txt(g, '(A) attends', 844, 520, { size: 22, weight: 500, color: u > 30 ? COL.dim : COL.text });
        if (u > 30) { g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(840, 520); g.lineTo(980, 520); g.stroke(); }
        txt(g, '(B) attend', 1030, 520, { size: 22, weight: u > 30 ? 700 : 500, color: u > 30 ? COL.good : COL.text });
        if (u > 30) mark(g, true, 1180, 520, 18);
      });
    },

    /* 05 목적격: whom · which · that, 생략 */
    obj(g, u) {
      table(g, u, '목적격 · 빈자리 = 목적어', [['사람', 'whom', 'that'], ['사물 · 동물', 'which', 'that']]);
      const ex = [
        { y: 200, pr: 'candidate', at: 6 },
        { y: 290, pr: 'report', at: 11.6 },
      ];
      ex.forEach(e => {
        const pr = RP.pair(e.pr), C = RP.combine(pr);
        const tk = [{ id: 'n', t: pr.A[pr.ante].replace(/^The /, 'the '), r: 'ante' }].concat(C.filter(t => t.cl));
        const L = lay(g, tk, { x: 520, y: e.y, size: 28 });
        fade(g, ramp(u, e.at, 0.6), () => {
          drawLay(g, L, it => it.id === 'gap' ? { glow: 0.5 + 0.5 * Math.sin(u * 4) } : {});
          sayLay(L, RP.text(tk));
        });
      });
      // 생략
      const pr = RP.pair('candidate');
      const full = [{ id: 'n', t: 'the candidate', r: 'ante' }].concat(RP.combine(pr).filter(t => t.cl));
      const omit = [{ id: 'n', t: 'the candidate', r: 'ante' }].concat(RP.combine(pr, { rel: '∅' }).filter(t => t.cl));
      const Lf = lay(g, full, { x: LX + 20, y: 440, size: 32 }), Lo = lay(g, omit, { x: LX + 20, y: 440, size: 32 });
      const op = S.omit ? 1 : clamp((u - 17.2) / 1.6);
      fade(g, ramp(u, 16.1, 0.6), () => {
        panel(g, LX - 10, 380, 760, 180, { fill: COL.panel, stroke: COL.faint });
        txt(g, '목적격 생략', LX + 14, 402, { size: 16, weight: 600, color: COL.muted });
        morph(g, Lf, Lo, op, { style: it => it.id === 'gap' ? { glow: 0.3 } : {} });
        if (op >= 1) {
          sayLay(Lo, RP.text(omit));
          const n = Lo.byId.n, s1 = Lo.byId.b0, v = Lo.byId.b1;
          fade(g, ramp(u, 22, 0.6) || (S.omit ? 1 : 0), () => {
            txt(g, '명사', n.x + n.w / 2, 492, { size: 16, weight: 700, color: COL.ante, align: 'center' });
            txt(g, '주어 + 동사', (s1.x + v.x + v.w) / 2, 492, { size: 16, weight: 700, color: COL.verb, align: 'center' });
            const gx = (n.x + n.w + s1.x) / 2;
            g.strokeStyle = COL.rel; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(gx, 418); g.lineTo(gx, 462); g.stroke(); g.setLineDash([]);
            txt(g, '여기에 whom이 숨어 있어요', gx - 6, 530, { size: 17, weight: 600, color: COL.rel });
          });
        }
      });
      // 주의 두 가지
      const notes = [['주격은 생략 ×', 'an assistant answers calls = 문장'], ['회화 who · 시험 whom', 'the candidate whom we …']];
      notes.forEach(([a, b], i) => fade(g, ramp(u, 28.2 + i * 1.6, 0.6), () => {
        panel(g, 870, 380 + i * 96, 350, 84, { fill: COL.panel2, stroke: i ? COL.rel : COL.bad });
        txt(g, a, 892, 408 + i * 96, { size: 19, weight: 700, color: i ? COL.rel : COL.bad });
        txt(g, b, 892, 440 + i * 96, { size: 17, weight: 500, color: COL.en });
      }));
    },

    /* 06 소유격 whose */
    whose(g, u) {
      const pr = RP.pair(S.poss) || RP.pair('company');
      const A = pr.A.map((t, i) => ({ id: 'a' + i, t, r: i === pr.ante ? 'ante' : '' }));
      const B = pr.B.map((t, i) => ({ id: 'b' + i, t, r: i === pr.share ? 'ante' : '' }));
      const B2 = B.map(tk => tk.id === 'b' + pr.share ? Object.assign({}, tk, { t: 'whose', r: 'rel' }) : tk.id === 'b' + (pr.share + 1) ? Object.assign({}, tk, { r: 'noun' }) : tk);
      const C = RP.combine(pr, { rel: 'whose' });
      const LA = lay(g, A, { x: W / 2, y: 190, size: 36, align: 'center' });
      const LB = lay(g, B, { x: W / 2, y: 272, size: 36, align: 'center' });
      const LB2 = lay(g, B2, { x: W / 2, y: 272, size: 36, align: 'center' });
      const LC = lay(g, C, { x: W / 2, y: 232, size: 36, align: 'center', maxW: 1120 });
      if (u < 10.6) {
        fade(g, ramp(u, 0.4, 0.6), () => drawLay(g, LA, it => it.r === 'ante' && u < 5.6 ? { r: '' } : {}));
        const bp = clamp((u - 8) / 1.2);
        fade(g, ramp(u, 1.4, 0.6), () => { if (bp <= 0) drawLay(g, LB, it => it.r === 'ante' && u < 5.6 ? { r: '' } : {}); else morph(g, LB, LB2, bp); });
        fade(g, ramp(u, 5.8, 0.6) * (1 - ramp(u, 10.2, 0.3)), () => {
          const s = (bp > 0.5 ? LB2 : LB).byId['b' + pr.share];
          txt(g, pr.kind === 'person' ? '그 사람의 (소유격)' : '그 회사의 (소유격)', s.x - 18, s.y, { size: 19, weight: 700, color: COL.ante, align: 'right' });
        });
      } else {
        const both = { items: LA.items.concat(LB2.items), byId: Object.assign({}, LA.byId, LB2.byId) };
        const mp = clamp((u - 10.6) / 2.2);
        morph(g, both, LC, mp, { xFirst: true });
        const last = C.filter(t => t.cl).pop();
        bracket(g, LC, 'b' + pr.share, last.id, '', ramp(u, 12.8, 0.6));
        if (mp >= 1) {
          sayLay(LC, RP.text(C));
          const nn = LC.byId['b' + (pr.share + 1)];
          fade(g, ramp(u, 13.4, 0.6), () => txt(g, '관사 없는 명사', nn.x + nn.w / 2, 300, { size: 17, weight: 700, color: COL.clause, align: 'center' }));
        }
      }
      // whose + 관사 없는 명사
      const noun = pr.B[pr.share + 1];
      const rows = [
        { y: 400, toks: [{ id: 'r', t: 'whose', r: 'rel' }, { id: 'n', t: noun, r: 'noun' }], ok: true },
        { y: 470, toks: [{ id: 'r', t: 'whose', r: 'rel' }, { id: 'the', t: 'the', r: 'bad' }, { id: 'n', t: noun, r: 'noun' }], ok: false },
      ];
      rows.forEach((r, i) => fade(g, ramp(u, 16.8 + i * 1.4, 0.6), () => {
        const L = lay(g, r.toks, { x: 200, y: r.y, size: 32 });
        drawLay(g, L);
        mark(g, r.ok, 150, r.y, 20);
      }));
      fade(g, ramp(u, 22.8, 0.6), () => {
        panel(g, 640, 362, 580, 150, { fill: COL.panel, stroke: COL.faint });
        txt(g, '빈칸 뒤:', 664, 396, { size: 19, weight: 600, color: COL.muted });
        txt(g, '관사 없는 명사 + 완전한 문장', 664, 432, { size: 23, weight: 700, color: COL.clause });
        txt(g, '→ whose', 664, 474, { size: 25, weight: 700, color: COL.rel });
        fade(g, ramp(u, 26.5, 0.6), () => txt(g, '사람 · 사물 모두', 830, 474, { size: 19, weight: 600, color: COL.muted }));
      });
    },

    /* 07 what = the thing which */
    what(g, u) {
      const A = [{ id: 'the', t: 'the', r: 'ante' }, { id: 'thing', t: 'thing', r: 'ante' }, { id: 'w', t: 'which', r: 'rel' }, { id: 's', t: 'she', r: 'clause' }, { id: 'v', t: 'said', r: 'clause' }];
      const B = [{ id: 'w', t: 'What', r: 'rel' }, { id: 's', t: 'she', r: 'clause' }, { id: 'v', t: 'said', r: 'clause' }, { id: 'x', t: 'surprised', r: '' }, { id: 'y', t: 'everyone', r: '' }, { id: 'dot', t: '.', r: '' }];
      const LA = lay(g, A, { x: W / 2, y: 220, size: 40, align: 'center' });
      const LB = lay(g, B, { x: W / 2, y: 220, size: 40, align: 'center' });
      const mp = clamp((u - 4) / 1.8);
      fade(g, ramp(u, 0.4, 0.6), () => {
        if (mp <= 0) {
          drawLay(g, LA);
          fade(g, ramp(u, 1.6, 0.5), () => txt(g, '~하는 것', (LA.byId.the.x + LA.byId.w.x + LA.byId.w.w) / 2, 280, { size: 19, weight: 700, color: COL.muted, align: 'center' }));
        } else morph(g, LA, LB, mp, { lift: 20 });
      });
      if (mp >= 1) {
        sayLay(LB, 'What she said surprised everyone.');
        const w = LB.byId.w;
        fade(g, ramp(u, 6.4, 0.6), () => txt(g, 'what = the thing(s) which', W / 2, 300, { size: 24, weight: 500, fam: FM, color: COL.en, align: 'center' }));
        fade(g, ramp(u, 12.2, 0.6), () => {
          chip(g, '선행사를 품고 있음', w.x + w.w / 2, 160, { size: 16, weight: 700, color: COL.ante, fill: 'rgba(110,200,255,0.12)', stroke: COL.ante, align: 'center' });
          g.strokeStyle = COL.ante; g.lineWidth = 2; g.beginPath(); g.moveTo(w.x + w.w / 2, 176); g.lineTo(w.x + w.w / 2, 194); g.stroke();
        });
      }
      // 틀린 예 → 바른 예
      const bad = [{ id: 'n', t: 'the report', r: 'ante' }, { id: 'w', t: 'what', r: 'bad' }, { id: 's', t: 'she', r: 'clause' }, { id: 'v', t: 'wrote', r: 'clause' }];
      const good = [{ id: 'n', t: 'the report', r: 'ante' }, { id: 'w', t: 'which', r: 'rel' }, { id: 's', t: 'she', r: 'clause' }, { id: 'v', t: 'wrote', r: 'clause' }];
      const d = { ante: 'thing', gap: 'obj' };
      fade(g, ramp(u, 18.2, 0.6), () => {
        const Lb = lay(g, bad, { x: 200, y: 410, size: 32 });
        drawLay(g, Lb); mark(g, RP.judge('what', d).s === 'ok', 150, 410, 20);
        fade(g, ramp(u, 20.5, 0.6), () => {
          const Lg = lay(g, good, { x: 200, y: 480, size: 32 });
          drawLay(g, Lg); mark(g, RP.judge('which', d).s === 'ok', 150, 480, 20);
          txt(g, '/ that', Lg.x + Lg.w + 18, 480, { size: 26, weight: 600, color: COL.rel });
          sayLay(Lg, 'the report which she wrote');
        });
        txt(g, '앞에 선행사 report가 있으면 what ×', Lb.x + Lb.w + 30, 410, { size: 18, weight: 600, color: COL.bad });
      });
      fade(g, ramp(u, 24.3, 0.6), () => {
        chip(g, '앞에 명사 없음 + 뒤에 빈자리 → what', W / 2, 556, { size: 22, weight: 700, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 50, r: 12, pad: 24 });
      });
    },

    /* 08 that을 못 쓰는 자리: 콤마 뒤, 전치사 뒤 */
    thatno(g, u) {
      const rowAt = (pr, o, y, at, label1) => {
        const d = RP.situation(pr, o);
        const rel = RP.base(pr.kind, pr.gap);
        const C = RP.combine(pr, Object.assign({ rel }, o));
        const L = lay(g, C, { x: LX + 150, y, size: 30, maxW: 1000 });
        fade(g, ramp(u, at, 0.6), () => {
          txt(g, label1, LX, y, { size: 19, weight: 700, color: COL.trap });
          drawLay(g, L, it => (it.t === ',' && d.comma) ? { color: COL.trap } : {});
          if (d.comma) ['c1', 'c2'].forEach(id => { const c = L.byId[id]; if (c) { rr(g, c.x - 3, c.y + 2, c.w + 6, 22, 5); g.fillStyle = 'rgba(255,159,122,0.28)'; g.fill(); g.fillStyle = COL.trap; g.fillRect(c.x - 3, c.y + 26, c.w + 6, 3); } });
          sayLay(L, RP.text(C));
          // that을 넣어 보면?
          const r = L.byId['b' + pr.share], j = RP.judge('that', d);
          fade(g, ramp(u, at + 1.2, 0.5), () => {
            const bx = r.x + r.w / 2, by = y - 58;
            const c = chip(g, 'that', bx, by, { size: 19, weight: 700, color: j.s === 'ok' ? COL.good : COL.bad, fill: COL.panel2, stroke: j.s === 'ok' ? COL.good : COL.bad, align: 'center', r: 8 });
            mark(g, j.s === 'ok', c.x + c.w + 16, by, 14);
            g.strokeStyle = j.s === 'ok' ? COL.good : COL.bad; g.lineWidth = 1.5; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(bx, by + 16); g.lineTo(bx, y - 22); g.stroke(); g.setLineDash([]);
          });
        });
        return { L, d };
      };
      fade(g, ramp(u, 0.4, 0.6), () => txt(g, '거의 어디에나 쓰는 that, 하지만…', LX, 172, { size: 22, weight: 600, color: COL.soft }));
      const r1 = rowAt(RP.pair('office'), { comma: S.comma }, 290, 6.2, S.comma ? '① 콤마 뒤' : '① 콤마 없음');
      fade(g, ramp(u, 12.2, 0.6), () => {
        txt(g, S.comma ? '계속적 용법: 이미 정해진 대상에 설명을 덧붙임' : '제한적 용법: 어떤 사무실인지 범위를 좁힘', LX + 150, 346, { size: 17, weight: 500, color: COL.muted });
      });
      rowAt(RP.pair('agency'), { prepFront: S.prepFront }, 450, 17.2, S.prepFront ? '② 전치사 뒤' : '② 전치사 끝');
      fade(g, ramp(u, 23.2, 0.6), () => {
        const t1 = 'The client with whom I spoke', t2 = 'the agency (that) we signed the contract with';
        txt(g, t1, LX + 150, 520, { size: 21, weight: 500, color: COL.en });
        mark(g, true, LX + 150 + tw(g, t1, 21, 500) + 20, 520, 14);
        fade(g, ramp(u, 25.6, 0.6), () => {
          txt(g, t2, LX + 150, 556, { size: 21, weight: 500, color: COL.en });
          mark(g, true, LX + 150 + tw(g, t2, 21, 500) + 20, 556, 14);
        });
        say(LX + 140, 504, 520, 32, 'The client with whom I spoke is from Busan.');
      });
    },

    /* 09 3단계 풀이법 흐름도 */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 앞을 본다', sub: '선행사는?', at: 5.6, boxes: [
          ['사람', 'who · whom · whose · that', 'person'], ['사물 · 동물', 'which · whose · that', 'thing'], ['없음', 'what', 'none']] },
        { x: 480, head: '② 뒤를 본다', sub: '빈자리는?', at: 12.2, boxes: [
          ['바로 동사', '주격 who · which · that', 'subj'], ['주어 + 동사, 목적어 없음', '목적격 whom · which · that', 'obj'],
          ['관사 없는 명사 + 완전', '소유격 whose', 'poss'], ['빠진 자리 없음', '관계부사 where · when', 'none']] },
        { x: 880, head: '③ 함정을 본다', sub: '마지막 확인', at: 25.2, boxes: [
          ['콤마 · 전치사 뒤', 'that ×', 'trap'], ['주격 뒤 동사', '선행사에 수 일치', 'agree'], ['목적격', '생략할 수 있음', 'omit']] },
      ];
      const P = S.path;   // 판별기에서 고른 길: { ante, gap, comma, prep }
      cols.forEach((c, ci) => {
        fade(g, ramp(u, c.at, 0.6), () => {
          panel(g, c.x, 150, 340, 62, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 20, 181, { size: 23, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 320, 181, { size: 16, weight: 600, color: COL.muted, align: 'right' });
          c.boxes.forEach(([k, v, key], bi) => {
            const y = 228 + bi * 84, at = c.at + 0.5 + bi * (ci === 1 && bi >= 2 ? 1.6 : 0.6) + (ci === 1 && bi >= 2 ? 3.4 : 0);
            const on = P && ((ci === 0 && P.ante === key) || (ci === 1 && P.gap === key) || (ci === 2 && ((key === 'trap' && (P.comma || P.prep)) || (key === 'agree' && P.gap === 'subj') || (key === 'omit' && P.gap === 'obj' && !P.comma && !P.prep))));
            fade(g, ramp(u, at, 0.5) * (P && !on ? 0.4 : 1), () => {
              panel(g, c.x, y, 340, 72, { fill: on ? 'rgba(255,193,94,0.14)' : COL.panel, stroke: on ? COL.rel : COL.faint, lw: on ? 2.5 : 1.5 });
              txt(g, k, c.x + 18, y + 24, { size: 18, weight: 700, color: COL.soft });
              txt(g, v, c.x + 18, y + 51, { size: 18, weight: 600, color: key === 'trap' ? COL.trap : COL.rel });
            });
          });
          if (ci < 2) fade(g, ramp(u, cols[ci + 1].at - 0.3, 0.5), () => arrow(g, c.x + 348, 181, c.x + 392, 181, COL.accent, 3));
        });
      });
      if (P) {
        const d = { ante: P.ante, gap: P.gap, comma: P.comma, prep: P.prep, place: P.gap === 'none' };
        const ans = RP.valid(d, RP.CANDS.concat(['where']));
        chip(g, '답: ' + (ans.length ? ans.join(', ') : '없음'), W / 2, 594, { size: 20, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 44, r: 10 });
      }
    },

    /* 10 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = RP.DRILL[P.k];
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0], s2 = v >= P.at[1], s3 = v >= P.at[2];
        const T = toks(it.q, {}).map(tk => {
          if (P.ante.includes(tk.t) && s1) return Object.assign(tk, { r: 'ante' });
          if (P.cue.includes(tk.t) && s2) return Object.assign(tk, { r: 'cue' });
          if (tk.r === 'blank' && s3) return Object.assign(tk, { t: it.opts[it.a] });
          return tk;
        });
        const L = lay(g, T, { x: LX, y: 222, size: 31, maxW: 1120, lh: 52 });
        drawLay(g, L);
        sayLay(L, it.q.replace('___', it.opts[it.a]));
        // 보기
        const oy = L.lines > 1 ? 350 : 320;
        it.opts.forEach((o, k) => {
          const ox = LX + (k % 2) * 290, y = oy + Math.floor(k / 2) * 74;
          const st = P.el[k], gone = st != null && v >= P.at[st - 1] + 1.2, right = k === it.a && s3;
          const col = right ? COL.good : gone ? COL.dim : COL.text;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, o, ox + 52, y, { size: 27, weight: right ? 700 : 600, color: col });
          if (gone) {
            const gp = clamp((v - P.at[st - 1] - 1.2) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, y + 1); g.lineTo(ox - 4 + (w + 62) * gp, y + 1); g.stroke();
            fade(g, gp, () => txt(g, P.why[k], ox + 52, y + 28, { size: 14, weight: 600, color: COL.bad }));
          }
          if (right) { panel(g, ox - 14, y - 26, w + 84, 52, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + w + 94, y, 18); }
        });
        // 풀이 줄
        panel(g, 660, oy - 40, 560, 230, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => {
          const at = P.at[k];
          fade(g, ramp(v, at + 0.3, 0.5), () => {
            const y = oy - 2 + k * 70;
            txt(g, ['① 앞', '② 뒤', '③ 함정'][k], 684, y, { size: 18, weight: 700, color: COL.accent });
            txt(g, ln, 684, y + 30, { size: 18, weight: 600, color: k === 2 ? COL.good : COL.soft });
          });
        });
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 290, 560, 830], Y0 = 158, RH = 58;
      const head = ['', '사람', '사물 · 동물', '빈자리'];
      const rows = [
        ['주격', 'who · that', 'which · that', '주어 (바로 뒤 동사)'],
        ['목적격', 'whom · that', 'which · that', '목적어 (생략 가능)'],
        ['소유격', 'whose', 'whose', '관사 없는 명사 앞'],
        ['선행사 없음', 'what', 'what', '주어 · 목적어'],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 10, 1160, RH * 5 + 20, { fill: COL.panel, stroke: COL.faint });
        head.forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 26, { size: 18, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 6, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.9, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 26;
        txt(g, r[0], X[0] + 20, y, { size: 21, weight: 700, fam: FD });
        txt(g, r[1], X[1] + 20, y, { size: 23, weight: 700, color: COL.rel });
        txt(g, r[2], X[2] + 20, y, { size: 23, weight: 700, color: COL.rel });
        txt(g, r[3], X[3] + 20, y, { size: 19, weight: 600, color: ri === 0 || ri === 1 ? COL.gap : COL.soft });
      }));
      const steps = ['① 앞: 선행사', '② 뒤: 빈자리', '③ 함정: 콤마 · 전치사 · 수 일치'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 6.5 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 500, { size: 20, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 48, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 500, c.x + c.w + 46, 500, COL.accent, 2.5);
        x = c.x + c.w + 58;
      }));
      fade(g, ramp(u, 12.2, 0.6), () => {
        txt(g, '빠진 자리 없음 → 관계부사 where · when', 1200, 500, { size: 18, weight: 600, color: COL.muted, align: 'right' });
      });
    },
  };

  // 주격·목적격 표 (왼쪽 위)
  function table(g, u, title, rows) {
    fade(g, ramp(u, 0.4, 0.6), () => {
      panel(g, LX - 10, 150, 430, 196, { fill: COL.panel, stroke: COL.faint });
      txt(g, title, LX + 14, 180, { size: 19, weight: 700, color: COL.gap });
      rows.forEach(([k, a, b], i) => fade(g, ramp(u, 1 + i * 0.7, 0.5), () => {
        const y = 240 + i * 66;
        txt(g, k, LX + 14, y, { size: 21, weight: 700, color: COL.soft });
        const c1 = chip(g, a, LX + 160, y, { size: 21, weight: 700, color: COL.rel, fill: 'rgba(255,193,94,0.12)', stroke: COL.rel, r: 10 });
        chip(g, b, c1.x + c1.w + 14, y, { size: 21, weight: 700, color: COL.rel, fill: 'rgba(255,193,94,0.06)', stroke: 'rgba(255,193,94,0.5)', r: 10 });
      }));
    });
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

  RV.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[RV.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, RV.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + ORDER_EX.map(e => e.koMod + e.koN + e.shortKo).join('') +
    RP.PAIRS.map(p => p.A.join(' ') + p.B.join(' ')).join('') + RP.DRILL.map(d => d.q + d.opts.join('')).join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←✓×▢?~=+-/:…';
  RV.baseText = EXTRA;
  RV.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = RV.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { RV.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
