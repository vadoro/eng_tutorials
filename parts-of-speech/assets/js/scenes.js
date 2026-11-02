/* 품사 자리 튜토리얼 — 영상 장면
 *
 * SV.render(g, t)는 시각 t와 사용자 상태 SV.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 영어 문장은 낱말 조각(토큰)으로 그리고, 품사마다 색을 칠합니다: 명사 하늘 · 형용사 민트 · 부사 라임 · 동사 보라.
 * 빈칸은 분홍 점선 상자, 채운 답은 노란 상자, 빈칸 앞뒤 단서는 보라 테두리.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(PS.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const PS = window.PS;
  const SV = (window.SV = {});
  const W = 1280, H = 720;
  SV.W = W; SV.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  SV.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
    // 품사 색: 명사 하늘 · 형용사 민트 · 부사 라임 · 동사 보라 (페이지 CSS의 --c-n 등과 같은 뜻)
    n: '#6EC8FF', adj: '#7FE0A8', adv: '#D4E157', v: '#C9A7FF',
  };
  SV.COL = COL;

  // 사용자 상태 ('직접 해 보기'와 화면 누르기로 바뀜). 영상 추출은 언제나 기본값
  const S = (SV.S = { fam: 'success', strip: false, path: null });
  SV.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  SV.hits = () => HITS;

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
  // 토큰 { id, t: 글자, r: 역할 }. 역할은 품사(n np adj adv v vg)·기능어(fn)·빈칸(blank)·채운 답(ans)·틀림(bad)·'' 보통
  const PCOL = { n: COL.n, np: COL.n, adj: COL.adj, adv: COL.adv, v: COL.v, vg: COL.v, fn: COL.muted, trap: COL.trap, bad: COL.bad, good: COL.good, dim: COL.dim };
  const POSR = { n: 1, np: 1, adj: 1, adv: 1, v: 1, vg: 1 };
  const PUNCT = /^[.,?!]$/;
  const tokW = (g, tk, size) => tk.r === 'blank' ? Math.max(size * 2.6, tk.t ? tw(g, tk.t, size, 700) + size * 0.7 : 0) :
    tk.r === 'ans' ? tw(g, tk.t, size, 700) + size * 0.5 : tw(g, tk.t, size, POSR[tk.r] ? 600 : 500);
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
      if (m[1]) out.push({ id: pre + out.length, t: m[1] === '___' ? '' : m[1], r: m[1] === '___' ? 'blank' : roles[m[1]] || '' });
      if (m[2]) out.push({ id: pre + out.length, t: m[2], r: '' });
    });
    return out;
  }
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
      if (it.t) txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: o.textColor || COL.rel, align: 'center' });
    } else if (r === 'ans') {
      const h = size * 1.22;
      rr(g, x, y - h / 2, w, h, 9);
      g.fillStyle = 'rgba(255,193,94,0.16)'; g.fill(); g.strokeStyle = COL.rel; g.lineWidth = 2; g.stroke();
      txt(g, it.t, x + w / 2, y + 1, { size, weight: 700, color: COL.rel, align: 'center' });
    } else {
      const c = o.color || PCOL[r] || COL.text;
      txt(g, it.t, x, y + 1, { size, weight: POSR[r] ? 600 : 500, color: c });
      if (POSR[r] && !o.plain) { g.fillStyle = c; g.fillRect(x, y + size * 0.56, w, 3); }
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
        const lift = o.lift && Math.abs(b.y - a.y) > 20 ? Math.sin(Math.PI * e) * o.lift : 0;
        const m = Object.assign({}, b, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) - lift, w: lerp(a.w, b.w, e), size: lerp(a.size, b.size, e) });
        if (a.t === b.t && a.r === b.r) drawTok(g, m, style(b, e));
        else { drawTok(g, Object.assign({}, m, { t: a.t, r: a.r }), Object.assign({}, style(a, e), { a: 1 - e })); drawTok(g, m, Object.assign({}, style(b, e), { a: e })); }
      } else if (a) drawTok(g, a, Object.assign({}, style(a, e), { a: 1 - ramp(p, 0, 0.5) }));
      else drawTok(g, b, Object.assign({}, style(b, e), { a: ramp(p, 0.5, 0.5) }));
    });
  }
  // 꾸밈 화살표: 꾸미는 말 위에서 꾸밈 받는 말 위로 (위로 휨)
  function modArrow(g, from, to, color, p = 1, h = 30) {
    arc(g, from.x + from.w / 2, from.y - from.size * 0.66, to.x + to.w / 2, to.y - to.size * 0.66, h, color, p, { dash: false, lw: 2.4 });
  }
  function sayLay(L, text) { say(L.x - 8, L.y - L.size * 0.8, L.w + 16, L.h + L.size * 0.3, text); }
  // 낱말 하나를 밑(흰색) + 꼬리(품사 색)로 그림. 가운데 정렬. 돌려주는 값: 너비
  function wordTail(g, base, tail, pos, cx, y, size = 30, a = 1) {
    const wb = tw(g, base, size, 600), wt = tw(g, tail, size, 700), x = cx - (wb + wt) / 2;
    fade(g, a, () => {
      txt(g, base, x, y, { size, weight: 600, color: COL.text });
      if (tail) txt(g, tail, x + wb, y, { size, weight: 700, color: PCOL[pos] || COL.text });
      if (tail) { g.fillStyle = PCOL[pos]; g.fillRect(x + wb, y + size * 0.58, wt, 3); }
    });
    return wb + wt;
  }
  const POSNAME = { n: '명사', np: '사람 명사', adj: '형용사', adv: '부사', v: '동사', vg: '동명사' };
  function posTag(g, pos, cx, y, a = 1, size = 16) {
    fade(g, a, () => chip(g, POSNAME[pos], cx, y, { size, weight: 700, color: PCOL[pos], fill: 'rgba(16,21,28,0.9)', stroke: PCOL[pos], align: 'center', h: size * 1.75, pad: 10, lw: 1.2 }));
  }
  // 보기 하나를 빈칸에 넣어 보는 목록 (✓/×와 짧은 까닭)
  function tryList(g, items, x, y, u, at, o = {}) {
    items.forEach(([w, pos, why], k) => {
      const a = ramp(u, at + k * (o.step || 0.9), 0.4), yy = y + k * (o.gap || 46);
      fade(g, a, () => {
        const ok = !why;
        mark(g, ok, x + 10, yy, 16);
        const ww = txt(g, w, x + 36, yy, { size: o.size || 25, weight: 600, color: ok ? COL.good : COL.muted });
        if (!ok) { g.strokeStyle = COL.bad; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 32, yy + 1); g.lineTo(x + 40 + ww, yy + 1); g.stroke(); }
        posTag(g, pos, x + 36 + ww + 46, yy, 1, 14);
        if (why) txt(g, why, x + 36 + ww + 96, yy, { size: 16, weight: 500, color: COL.muted });
      });
    });
  }

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '토익 Part 5의 단골', d: 24, caps: [
      [0.4, 5, '토익 Part 5에 가장 자주 나온다고 꼽히는 유형, **품사** 문제예요.'],
      [5, 10, '보기를 보세요. renew, renewable, renewal, renewed. 모두 같은 뿌리에서 나온 말이에요.'],
      [10, 14.5, '이런 문제는 문장을 다 해석하지 않아도 풀 수 있어요. 빈칸의 **자리**만 보면 돼요.'],
      [14.5, 19, '빈칸 앞의 The와 뒤의 of가 답을 알려 줘요. 정답은 영상 끝에서 함께 풀어요.'],
      [19, 24, '낱말의 **꼬리**, 빈칸의 **자리**, 그리고 **3단계 풀이법**을 차례로 배워요.'],
    ] },
    { id: 'family', n: '01', title: '같은 뿌리, 다른 옷', sub: '낱말 가족', d: 30, caps: [
      [0.4, 5.5, '한국어부터 볼까요? 성공하다, 성공, 성공적인, 성공적으로. 뿌리는 같고 끝만 달라요.'],
      [5.5, 11, '끝이 바뀌면 문장 속 역할이 바뀌어요. 하다가 붙으면 움직임, 적인이 붙으면 꾸미는 말이죠.'],
      [11, 17, '영어도 같아요. succeed, success, successful, successfully. 한 뿌리에서 나온 **낱말 가족**이에요.'],
      [17, 23, '동사, **명사**, **형용사**, **부사**. 같은 가족이라도 들어갈 수 있는 자리가 서로 달라요.'],
      [23, 30, '그래서 토익은 한 가족을 보기로 내놓고, 빈칸에 맞는 식구를 고르라고 해요.'],
    ] },
    { id: 'suffix', n: '02', title: '꼬리표 읽기', sub: '끝을 보면 품사가 보인다', d: 34, caps: [
      [0.4, 6, '낱말 가족에서 누가 누구인지는 **꼬리**, 곧 낱말의 끝부분을 보면 대부분 알 수 있어요.'],
      [6, 12, '-tion(션), -ment(먼트), -ness(니스), -ity(어티)로 끝나면 명사. -er, -or, -ant로 끝나면 사람을 뜻하는 명사예요.'],
      [12, 18, '-ive(이브), -able(어블), -ful(풀), -ous(어스)로 끝나면 형용사. 형용사에 -ly(리)를 붙이면 부사가 돼요.'],
      [18, 23, '-ize(아이즈), -ify(이파이)로 끝나면 동사인 경우가 많아요.'],
      [23, 29, '하지만 꼬리가 속이는 말도 있어요. timely와 costly는 -ly로 끝나지만 **형용사**예요.'],
      [29, 34, 'approval, proposal은 형용사 꼬리 -al로 끝나지만 **명사**, representative는 사람을 뜻하는 명사예요.'],
    ] },
    { id: 'skeleton', n: '03', title: '문장의 뼈대', sub: '명사·동사와 꾸미는 말', d: 34, caps: [
      [0.4, 5.5, '문장 하나를 품사별로 칠해 볼게요. The new manager quickly reviewed the annual report.'],
      [5.5, 11, 'manager와 report는 **명사**, reviewed는 **동사**. 이 둘이 문장의 뼈대예요.'],
      [11, 17, 'new와 annual은 명사를 꾸미는 **형용사**, quickly는 동사를 꾸미는 **부사**예요.'],
      [17, 23, '꾸미는 말을 모두 빼도 The manager reviewed the report. 문장이 그대로 서 있죠.'],
      [23, 29, '그래서 품사 문제의 빈칸은, 앞뒤 낱말과 어떻게 이어지는지로 자리가 정해져요.'],
      [29, 34, 'new 뒤의 빈칸은 꾸밈을 받을 명사, 그리고 reviewed의 주어가 들어갈 자리예요.'],
    ] },
    { id: 'noun', n: '04', title: '명사 자리', sub: '관사 뒤 · 전치사 앞', d: 32, caps: [
      [0.4, 6, '첫 번째는 **명사** 자리예요. a, the, 소유격, 형용사 바로 뒤에는 명사가 와요.'],
      [6, 12, '빈칸 뒤에 of 같은 전치사가 와도 명사 자리예요. the renewal of the contract.'],
      [12, 17, 'renewal은 -al로 끝나지만 명사예요. 꼬리표 함정이었죠.'],
      [17, 24, '이번엔 전치사 by 뒤의 빈칸이에요. 그런데 빈칸 뒤에 목적어 the budget이 있어요.'],
      [24, 32, '명사는 목적어를 가질 수 없어요. 목적어가 있으면 **동명사** reviewing, 없으면 명사 review예요.'],
    ] },
    { id: 'adjA', n: '05', title: '형용사 자리 ①', sub: '명사 앞', d: 24, caps: [
      [0.4, 6, '두 번째는 명사 앞 **형용사** 자리예요. a ___ increase. 빈칸 뒤에 이미 명사가 있죠.'],
      [6, 12, '빈칸의 말은 뒤의 명사 increase를 꾸며야 해요. 명사를 꾸미는 건 형용사, significant.'],
      [12, 18, 'significantly는 부사라서 명사를 꾸밀 수 없어요. 토익의 단골 오답이에요.'],
      [18, 24, '관사와 명사 사이의 빈칸은 형용사. 이 모양을 눈에 익혀 두세요.'],
    ] },
    { id: 'adjP', n: '06', title: '형용사 자리 ②', sub: '보어 자리', d: 32, caps: [
      [0.4, 6, '세 번째는 **보어** 자리예요. be, remain, become 뒤에서 주어의 상태를 말해 줘요.'],
      [6, 12, 'Prices will remain competitive. 가격이 경쟁력 있는 상태로 남는다는 뜻이에요.'],
      [12, 17.5, 'remain 뒤라고 부사 competitively를 고르면 함정에 빠져요. 상태를 말하는 건 형용사예요.'],
      [17.5, 24, 'keep, find, make 뒤에서는 목적어의 상태를 말해요. keep the files secure.'],
      [24, 32, '목적어와 빈칸을 등호로 이을 수 있으면 형용사 자리예요. securely는 오답.'],
    ] },
    { id: 'adv', n: '07', title: '부사 자리', sub: '빼도 문장이 된다', d: 32, caps: [
      [0.4, 6, '네 번째는 **부사** 자리예요. 부사는 동사, 형용사, 문장 전체를 꾸며요.'],
      [6, 12, 'have와 increased 사이처럼 동사 덩어리 가운데의 빈칸은 부사, steadily.'],
      [12, 18, '완전한 문장 뒤, 형용사 앞의 빈칸도 부사 자리예요. responded quickly, highly qualified.'],
      [18, 25, '헷갈리면 빈칸을 빼 보세요. Sales have increased. 빼도 문장이 완전하면 부사 자리예요.'],
      [25, 32, '반대로 빼면 문장이 무너지는 자리는 명사나 형용사 자리예요.'],
    ] },
    { id: 'nn', n: '08', title: '명사 + 명사, 사람과 일', sub: '복합명사 · 사람 명사', d: 32, caps: [
      [0.4, 6, '명사 앞이라고 늘 형용사는 아니에요. customer satisfaction survey처럼 **명사 + 명사**로 굳은 말이 있어요.'],
      [6, 12, '고객 만족 설문, 한 덩어리로 쓰는 말이에요. safety regulations, sales figures도 마찬가지예요.'],
      [12, 18, '명사 자리인데 보기에 명사가 둘이면, **사람**인지 **일**인지 골라야 해요.'],
      [18, 25, 'hire an experienced ___. 경험 많은 사람을 고용하니까 사람 명사 consultant예요.'],
      [25, 32, 'consultation은 상담이라는 일이에요. hire, experienced 같은 단서가 사람을 가리켜요.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: '보기 → 자리 → 꼬리', d: 30, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11, '① **보기**를 봐요. 같은 뿌리의 말 네 개라면 품사 문제. 해석은 잠시 미뤄요.'],
      [11, 18, '② **자리**를 봐요. 빈칸 앞뒤 한 낱말씩만 보고 명사, 형용사, 부사 자리를 정해요.'],
      [18, 24, '③ **꼬리**를 봐요. 그 자리에 맞는 꼬리를 가진 보기를 고르고, 꼬리가 속이는 말인지 확인해요.'],
      [24, 30, '이 순서로 토익 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 56, caps: [
      [0.4, 6, '처음 본 문제예요. ① 보기가 모두 renew 가족이니 품사 문제예요.'],
      [6, 12, '② 빈칸 앞에 The, 뒤에 of. 관사 뒤, 전치사 앞. **명사** 자리예요.'],
      [12, 18, '③ 명사 꼬리를 찾으면 renewal. -al로 끝나도 명사예요. 정답은 (C).'],
      [18.4, 24.5, '두 번째 문제. ① steady 가족이에요. ② 빈칸이 have와 increased 사이에 있어요.'],
      [24.5, 31, '동사 덩어리 가운데, 빼도 문장이 완전한 자리. **부사** 자리예요.'],
      [31, 37, '③ 형용사에 -ly가 붙은 steadily. 정답은 (B).'],
      [37.4, 43.5, '세 번째. ① secure 가족. ② keep과 목적어 all customer records 뒤의 빈칸이에요.'],
      [43.5, 50, '목적어의 상태를 말하는 **목적격 보어**, 형용사 자리예요. 기록이 안전한 상태로.'],
      [50, 56, '③ secure는 동사로도 쓰지만 여기서는 형용사. securely는 부사라서 오답, 정답은 (D).'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 자리 표', d: 22, caps: [
      [0.4, 6, '정리해요. 품사 문제는 해석이 아니라 **자리**로 풀어요.'],
      [6, 12, '관사 뒤는 명사, 명사 앞은 형용사, be와 keep 뒤는 형용사, 빼도 되는 자리는 부사.'],
      [12, 17, '목적어가 따라오면 동명사, 명사와 명사 사이는 명사예요.'],
      [17, 22, '아래에서 3초 품사 감각 훈련과 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  SV.CHAPTERS = CHAPTERS; SV.CAPTIONS = CAPTIONS; SV.END = END;
  SV.POSTER = CHAPTERS.find(c => c.id === 'skeleton').t + 16;
  SV.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  SV.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(PS.DRILL)에서 세 개. 자리 단계(②)에서 맞지 않는 품사를 지우고, 꼬리 단계(③)에서 답을 고름
  const PRACTICE = [
    { k: 0, at: [0.4, 6, 12], lines: ['보기: renew 가족 → 품사 문제', 'The ___ of → 명사 자리', '명사 꼬리 -al → (C) renewal'] },
    { k: 2, at: [0.4, 6.1, 12.6], lines: ['보기: steady 가족 → 품사 문제', 'have ___ increased → 부사 자리', '형용사 + ly → (B) steadily'] },
    { k: 4, at: [0.4, 6.1, 12.6], lines: ['보기: secure 가족 → 품사 문제', 'keep + 목적어 + ___ → 형용사 자리', 'secure = 형용사 → (D) secure'] },
  ];
  PRACTICE.forEach(p => {
    const it = PS.DRILL[p.k];
    if (!p.lines[2].includes(`(${'ABCD'[it.a]})`)) console.warn('[품사 자리] 실전 문제 정답 표시가 데이터와 달라요:', it.q);
    it.opts.forEach(([, pos], i) => { if ((PS.judge(pos, it.slot).s === 'ok') !== (i === it.a)) console.warn('[품사 자리] 실전 문제가 규칙 엔진과 달라요:', it.q); });
  });

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o)); }
  const judgeW = (w, slot) => { const d = PS.word(w); return d ? PS.judge(d.pos, slot) : { s: 'no', why: '' }; };

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(같은 뿌리, 자리 단서) → 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '품사 자리', W / 2, 300, { size: 84, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Parts of Speech', W / 2, 378, { size: 30, weight: 500, color: COL.muted, align: 'center' });
      });
      ['n', 'adj', 'adv', 'v'].forEach((p, k) => {
        const a = ramp(u, 1.3 + k * 0.2, 0.4) * out1;
        posTag(g, p, W / 2 - 240 + k * 160, 465 + (1 - a) * 10, a, 22);
      });
      const it = PS.DRILL[0];
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 17.6, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 160, 1000, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 빈칸 채우기', 180, 202, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const L = lay(g, toks(it.q), { x: 180, y: 285, size: 30, maxW: 930 });
        const cueOn = u > 14.6;
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: cueOn ? 1 : 0 } : cueOn && (tk.t === 'The' || tk.t === 'of') && tk.id !== 't9' ? { cue: true } : {});
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        it.opts.forEach(([o], k) => {
          const ox = 200 + (k % 2) * 440, oy = 400 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.6 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            const w = txt(g, o, ox + 64, oy, { size: 30, weight: 600 });
            const rw = tw(g, 'renew', 30, 600);
            fade(g, ramp(u, 9.3 + k * 0.15, 0.4), () => { g.fillStyle = COL.rel; g.fillRect(ox + 64, oy + 19, rw, 3); });
          });
        });
        fade(g, ramp(u, 10, 0.5), () => chip(g, '모두 같은 뿌리 renew', 1000, 431, { size: 18, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 36 }));
      });
      const steps = [['①', '낱말의 꼬리', '-tion · -ive · -ly'], ['②', '빈칸의 자리', 'the ___ of → 명사'], ['③', '3단계 풀이법', '보기 → 자리 → 꼬리']];
      steps.forEach(([n, t1, t2], k) => {
        const a = ramp(u, 19.4 + k * 0.7, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 220, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 285 + (1 - a) * 16, { size: 34, weight: 700, color: COL.accent });
          txt(g, t1, x0 + 28, 345 + (1 - a) * 16, { size: 25, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 400 + (1 - a) * 16, { size: 19, weight: 500, color: COL.en });
        });
      });
    },

    /* 01 같은 뿌리, 다른 옷: 한국어 어미 ↔ 영어 꼬리 */
    family(g, u) {
      const F = PS.family(S.fam) || PS.FAMILIES[0];
      const KO = PS.FAMILIES[0].ko;   // 한국어 비유는 늘 ‘성공’
      const n = F.forms.length, cw = n > 4 ? 200 : 240, x0 = W / 2 - (n * cw) / 2 + cw / 2, kx0 = W / 2 - (KO.length * 240) / 2 + 120;
      fade(g, ramp(u, 0.2, 0.5), () => label(g, '한국어', LX, 205, { size: 20, color: COL.soft }));
      KO.forEach(([base, tail, pos], k) => {
        const a = ramp(u, 0.6 + k * 0.35, 0.5), cx = kx0 + k * 240, hl = u > 5.6;
        fade(g, a, () => {
          panel(g, cx - 108, 175, 216, 62, { fill: COL.panel, stroke: hl ? PCOL[pos] : COL.faint });
          const wb = tw(g, base, 27, 600), wt = tw(g, tail, 27, 700), x = cx - (wb + wt) / 2;
          txt(g, base, x, 206, { size: 27, weight: 600 });
          if (tail) txt(g, tail, x + wb, 206, { size: 27, weight: 700, color: hl ? PCOL[pos] : COL.text });
        });
        posTag(g, pos, cx, 262, ramp(u, 6.2 + k * 0.3, 0.4), 15);
      });
      fade(g, ramp(u, 10.8, 0.5), () => label(g, '영어', LX, 375, { size: 20, color: COL.soft }));
      F.forms.forEach(([base, tail, pos], k) => {
        const cx = x0 + k * cw, sp = clamp((u - 11.2 - k * 0.25) / 0.8), e = ease(sp);
        if (sp <= 0) return;
        const x = lerp(W / 2, cx, e);
        fade(g, e, () => {
          panel(g, x - cw / 2 + 12, 345, cw - 24, 62, { fill: COL.panel, stroke: u > 17.2 ? PCOL[pos] : COL.faint });
          wordTail(g, base, tail, pos, x, 376, n > 4 ? 25 : 27);
        });
        posTag(g, pos, cx, 432, ramp(u, 17.4 + k * 0.3, 0.4), 15);
      });
      if (u > 12.5) say(x0 - cw / 2, 340, n * cw, 72, F.forms.map(f => f[0] + f[1]).join(', '));
      // 토익 보기처럼
      fade(g, ramp(u, 23.4, 0.6), () => {
        panel(g, 190, 482, 900, 80, { fill: COL.panel2, stroke: COL.accent });
        txt(g, '토익 보기', 214, 522, { size: 15, weight: 500, fam: FM, color: COL.accent });
        F.forms.slice(0, 4).forEach(([b, t], k) => txt(g, `(${'ABCD'[k]}) ${b + t}`, 330 + k * 190, 522, { size: 21, weight: 600, color: COL.en }));
      });
    },

    /* 02 꼬리표 읽기: 다섯 칸(명사·사람·형용사·부사·동사)으로 낱말이 들어감 → 꼬리 함정 */
    suffix(g, u) {
      const cols = [
        { pos: 'n', at: 6.2, words: [['pay', 'ment'], ['deci', 'sion'], ['kind', 'ness'], ['reliabil', 'ity']] },
        { pos: 'np', at: 9.2, words: [['employ', 'er'], ['consult', 'ant'], ['applic', 'ant']] },
        { pos: 'adj', at: 12.2, words: [['effect', 'ive'], ['reli', 'able'], ['care', 'ful'], ['vari', 'ous']] },
        { pos: 'adv', at: 15.4, words: [['effective', 'ly'], ['careful', 'ly']] },
        { pos: 'v', at: 18.2, words: [['final', 'ize'], ['simpl', 'ify']] },
      ];
      const out = 1 - ramp(u, 22.6, 0.5) * 0.55;
      cols.forEach((c, i) => {
        const cx = 160 + i * 240;
        fade(g, ramp(u, 0.6 + i * 0.25, 0.5) * out, () => {
          posTag(g, c.pos, cx, 165, 1, 18);
          txt(g, PS.SUFFIX[c.pos].join(' '), cx, 205, { size: c.pos === 'adv' ? 15 : 14, weight: 500, fam: FM, color: PCOL[c.pos], align: 'center' });
        });
        c.words.forEach(([b, t], k) => {
          const a = ramp(u, c.at + k * 0.35, 0.45);
          if (a <= 0) return;
          wordTail(g, b, t, c.pos, cx, 250 + k * 42 - (1 - a) * 18, 23, a * out);
        });
      });
      // 꼬리가 속이는 말
      const traps = [
        { at: 23.2, head: '-ly인데 형용사', words: [['time', 'ly'], ['cost', 'ly'], ['friend', 'ly']], pos: 'adj', note: '명사 + ly' },
        { at: 29.2, head: '-al인데 명사', words: [['approv', 'al'], ['propos', 'al'], ['renew', 'al']], pos: 'n', note: '동사 + al' },
        { at: 31, head: '-ive인데 사람', words: [['representat', 'ive'], ['execut', 'ive']], pos: 'np', note: '사람 명사' },
      ];
      fade(g, ramp(u, 22.8, 0.5), () => {
        panel(g, LX - 10, 420, 1140, 150, { fill: COL.panel2, stroke: COL.trap });
        txt(g, '꼬리가 속이는 말', LX + 14, 446, { size: 17, weight: 700, color: COL.trap });
      });
      traps.forEach((t, i) => fade(g, ramp(u, t.at, 0.5), () => {
        const x = LX + 20 + i * 380;
        txt(g, t.head, x, 482, { size: 18, weight: 700, color: COL.soft });
        posTag(g, t.pos, x + tw(g, t.head, 18, 700) + 50, 482, 1, 14);
        let xx = x;
        t.words.forEach(([b, tail]) => { const w = tw(g, b + tail, 21, 600); wordTail(g, b, tail, t.pos, xx + w / 2, 528, 21); xx += w + 22; });
      }));
    },

    /* 03 문장의 뼈대: 품사별로 칠하기 → 꾸미는 말 빼기 → 빈칸은 빠진 조각 */
    skeleton(g, u) {
      const R = { The: 'fn', the: 'fn', new: 'adj', manager: 'n', quickly: 'adv', reviewed: 'v', annual: 'adj', report: 'n' };
      const sent = 'The new manager quickly reviewed the annual report.';
      const full = toks(sent, R), strip = full.filter(t => !['adj', 'adv'].includes(t.r));
      const blank = full.map(t => t.t === 'manager' ? Object.assign({}, t, { t: '', r: 'blank' }) : t);
      const LF = lay(g, full, { x: W / 2, y: 230, size: 38, align: 'center' });
      const LS = lay(g, strip, { x: W / 2, y: 230, size: 38, align: 'center' });
      const LB = lay(g, blank, { x: W / 2, y: 230, size: 38, align: 'center' });
      const colorOn = r => (r === 'n' || r === 'v') ? u > 5.6 : (r === 'adj' || r === 'adv') ? u > 11.2 : true;
      const style = tk => POSR[tk.r] && !colorOn(tk.r) ? { r: '' } : {};
      const sp = S.strip ? 1 : clamp((u - 17.2) / 1.4) - clamp((u - 22.4) / 1.2);   // 빼기 → 되돌리기
      const bp = S.strip ? 0 : clamp((u - 23.6) / 1.2);
      fade(g, ramp(u, 0.4, 0.6), () => {
        if (bp > 0) morph(g, LF, LB, bp, { style: tk => tk.r === 'blank' ? { glow: 0.5 + 0.5 * Math.sin(u * 4) } : {} });
        else if (sp > 0) morph(g, LF, LS, sp, { style });
        else drawLay(g, LF, style);
      });
      sayLay(LF, sent);
      // 품사 이름표
      const tagged = sp > 0.01 || bp > 0.01 ? [] : LF.items.filter(t => POSR[t.r] && colorOn(t.r));
      tagged.forEach(t => posTag(g, t.r, t.x + t.w / 2, 290, ramp(u, t.r === 'n' || t.r === 'v' ? 6 : 11.6, 0.5), 14));
      // 꾸밈 화살표
      if (sp < 0.01 && bp < 0.99) {
        const A = byText(LF, 'new'), N = byText(LF, 'manager'), B = byText(LF, 'annual'), RP_ = byText(LF, 'report'), Q = byText(LF, 'quickly'), V = byText(LF, 'reviewed');
        const ap = ramp(u, 12.4, 1) * (1 - bp);
        if (ap > 0) { modArrow(g, A, N, COL.adj, ap, 34); modArrow(g, B, RP_, COL.adj, ap, 34); modArrow(g, Q, V, COL.adv, ap, 34); }
      }
      // 빼도 문장이 된다
      if (sp > 0.95 && !S.strip ? u < 22.6 : S.strip) {
        fade(g, S.strip ? 1 : ramp(u, 18.6, 0.5), () => {
          chip(g, '꾸미는 말을 빼도 문장이 그대로', W / 2, 330, { size: 20, weight: 700, color: COL.good, fill: COL.panel2, stroke: COL.good, align: 'center', h: 44, pad: 20 });
          mark(g, true, W / 2 + 190, 330, 16);
        });
      }
      // 꾸밈 규칙 상자
      fade(g, ramp(u, 13.6, 0.6) * (1 - bp), () => {
        panel(g, 190, 390, 420, 120, { fill: COL.panel, stroke: COL.faint });
        txt(g, '형용사 → 명사를 꾸밈', 214, 430, { size: 21, weight: 700, color: COL.adj });
        txt(g, '부사 → 동사·형용사를 꾸밈', 214, 474, { size: 21, weight: 700, color: COL.adv });
        panel(g, 670, 390, 420, 120, { fill: COL.panel, stroke: COL.faint });
        txt(g, '명사 · 동사 = 뼈대', 694, 430, { size: 21, weight: 700, color: COL.n });
        txt(g, '빼면 문장이 무너져요', 694, 474, { size: 19, weight: 600, color: COL.soft });
      });
      // 빈칸은 빠진 조각
      if (bp > 0.5) {
        const Bk = blankOf(LB), A = byText(LB, 'new'), V = byText(LB, 'reviewed');
        fade(g, ramp(u, 25, 0.6), () => modArrow(g, A, Bk, COL.adj, ramp(u, 25, 0.8), 34));
        fade(g, ramp(u, 29.2, 0.6), () => {
          arc(g, V.x + V.w / 2, V.y + 30, Bk.x + Bk.w / 2, Bk.y + 30, -44, COL.v, ramp(u, 29.2, 0.8), { dash: true });
          txt(g, 'reviewed의 주어', (Bk.x + V.x + V.w) / 2, 330, { size: 17, weight: 700, color: COL.v, align: 'center' });
          posTag(g, 'n', Bk.x + Bk.w / 2, 168, 1, 18);
          chip(g, '빈칸 = 명사 자리', W / 2, 420, { size: 22, weight: 700, color: COL.n, fill: COL.panel2, stroke: COL.n, align: 'center', h: 48, pad: 22 });
        });
      }
    },

    /* 04 명사 자리: the ___ of / by ___ the budget */
    noun(g, u) {
      const rules = ['a · the · 소유격 + ___', '형용사 + ___', '___ + of · 전치사'];
      rules.forEach((r, k) => fade(g, ramp(u, 1 + k * 0.6, 0.5), () => {
        chip(g, r, LX + k * 300, 170, { size: 18, weight: 700, color: COL.n, fill: COL.panel, stroke: COL.n, h: 40, r: 10 });
      }));
      fade(g, ramp(u, 2.8, 0.5), () => { txt(g, '→ 명사', LX + 900, 170, { size: 21, weight: 800, color: COL.n }); });
      // 예 1: the ___ of the contract
      const filled = u > 9.4;
      const T1 = toks('the ___ of the contract', {}, 'a').map(t => t.r === 'blank' && filled ? Object.assign({}, t, { t: 'renewal' }) : t);
      const L1 = lay(g, T1, { x: LX, y: 262, size: 34 });
      fade(g, ramp(u, 4.4, 0.6), () => {
        drawLay(g, L1, tk => tk.r === 'blank' ? { glow: filled ? 0 : 0.5 } : (tk.t === 'the' && tk.id === 'a0') || tk.t === 'of' ? { cue: u > 6 } : {});
        sayLay(L1, 'the renewal of the contract');
      });
      tryList(g, [['renew', 'v', '동사는 관사 뒤에 못 와요'], ['renewable', 'adj', '꾸밈 받을 명사가 없어요'], ['renewal', 'n', '']], LX + 4, 326, u, 6.6, { step: 0.9 });
      fade(g, ramp(u, 12.2, 0.5), () => {
        chip(g, 'renewal: -al로 끝나도 명사', LX, 474, { size: 18, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, h: 40, r: 10 });
      });
      // 예 2: by ___ the budget
      const ge = u > 25.6;
      const T2 = toks('by ___ the budget', {}, 'b').map(t => t.r === 'blank' && ge ? Object.assign({}, t, { t: 'reviewing' }) : t);
      const L2 = lay(g, T2, { x: 700, y: 262, size: 34 });
      fade(g, ramp(u, 17.4, 0.6), () => {
        drawLay(g, L2, tk => tk.r === 'blank' ? {} : tk.t === 'by' ? { cue: true } : {});
        const bk = blankOf(L2), th = byText(L2, 'the'), bd = byText(L2, 'budget');
        const ap = ramp(u, 20, 1);
        if (ap > 0) {
          arc(g, bk.x + bk.w / 2, 290, (th.x + bd.x + bd.w) / 2, 290, -40, COL.v, ap);
          fade(g, ramp(u, 20.8, 0.5), () => txt(g, '목적어', (th.x + bd.x + bd.w) / 2, 346, { size: 17, weight: 700, color: COL.v, align: 'center' }));
        }
        sayLay(L2, 'by reviewing the budget');
      });
      tryList(g, [['review', 'n', '명사는 목적어를 못 가져요'], ['reviewing', 'vg', '']], 704, 400 + 0, u, 24.4, { step: 1 });
      fade(g, ramp(u, 28.6, 0.6), () => {
        panel(g, 690, 492, 510, 66, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'the', 712, 525, { size: 22, weight: 500, color: COL.muted });
        txt(g, 'review', 752, 525, { size: 22, weight: 700, color: COL.n });
        txt(g, 'of the budget', 830, 525, { size: 22, weight: 500 });
        txt(g, '← 목적어 없음, 명사', 980, 525, { size: 17, weight: 600, color: COL.n });
      });
    },

    /* 05 형용사 자리 ①: 관사 + ___ + 명사 */
    adjA(g, u) {
      const filled = u > 9.6;
      const T = toks('a ___ increase in sales', {}, 'a').map(t => t.r === 'blank' && filled ? Object.assign({}, t, { t: 'significant' }) : t.t === 'increase' ? Object.assign({}, t, { r: 'n' }) : t);
      const L = lay(g, T, { x: W / 2, y: 240, size: 40, align: 'center' });
      fade(g, ramp(u, 0.4, 0.6), () => {
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: filled ? 0 : 0.5 } : tk.t === 'a' || tk.t === 'increase' ? { cue: u > 2.2 && u < 6.2 } : {});
        sayLay(L, 'a significant increase in sales');
      });
      const bk = blankOf(L), inc = byText(L, 'increase');
      fade(g, ramp(u, 6.4, 0.6), () => {
        modArrow(g, bk, inc, COL.adj, ramp(u, 6.4, 0.8), 36);
        txt(g, '꾸밈', (bk.x + inc.x + inc.w) / 2, 168, { size: 16, weight: 700, color: COL.adj, align: 'center' });
      });
      tryList(g, [['significance', 'n', '이미 뒤에 명사 increase가 있어요'], ['significant', 'adj', '']], 300, 330, u, 7.4, { step: 1.1 });
      fade(g, ramp(u, 12.2, 0.6), () => {
        const y = 422;
        mark(g, false, 310, y, 16);
        txt(g, 'significantly', 336, y, { size: 25, weight: 600, color: COL.muted });
        g.strokeStyle = COL.bad; g.lineWidth = 2.2; g.beginPath(); g.moveTo(332, y + 1); g.lineTo(340 + tw(g, 'significantly', 25, 600), y + 1); g.stroke();
        posTag(g, 'adv', 336 + tw(g, 'significantly', 25, 600) + 46, y, 1, 14);
        txt(g, '부사는 명사를 꾸밀 수 없어요 · 단골 오답', 336 + tw(g, 'significantly', 25, 600) + 96, y, { size: 16, weight: 600, color: COL.trap });
      });
      fade(g, ramp(u, 18.2, 0.6), () => {
        chip(g, '관사 · 소유격 + ___ + 명사 → 형용사', W / 2, 510, { size: 22, weight: 700, color: COL.adj, fill: COL.panel2, stroke: COL.adj, align: 'center', h: 50, r: 12, pad: 24 });
        txt(g, 'a persuasive presentation · your timely response', W / 2, 562, { size: 18, weight: 500, color: COL.en, align: 'center' });
      });
    },

    /* 06 형용사 자리 ②: 보어 (remain ___ / keep 목적어 ___) */
    adjP(g, u) {
      const box = (x, title, sent, fill, cueWords, wrong, eq, verbs, at) => {
        fade(g, ramp(u, at, 0.6), () => {
          panel(g, x, 150, 540, 410, { fill: COL.panel, stroke: COL.faint });
          txt(g, title, x + 24, 182, { size: 19, weight: 700, color: COL.adj });
          verbs.forEach((v, k) => chip(g, v, x + 24 + k * 102, 224, { size: 16, weight: 700, color: COL.v, fill: COL.panel2, stroke: COL.v, h: 32, r: 8, pad: 12 }));
        });
        const done = u > at + 4.4;
        const T = toks(sent, {}, 's' + x).map(t => t.r === 'blank' && done ? Object.assign({}, t, { t: fill }) : t);
        const L = lay(g, T, { x: x + 24, y: 300, size: 30, maxW: 490 });
        fade(g, ramp(u, at + 0.8, 0.6), () => {
          drawLay(g, L, tk => tk.r === 'blank' ? { glow: done ? 0 : 0.5 } : cueWords.includes(tk.t) ? { cue: true } : {});
          sayLay(L, sent.replace('___', fill));
        });
        tryList(g, [[wrong[0], 'adv', wrong[1]], [fill, 'adj', '']], x + 28, 380, u, at + 3.2, { step: 1.2, size: 23 });
        fade(g, ramp(u, at + 6.6, 0.6), () => {
          txt(g, eq[0], x + 28, 500, { size: 22, weight: 600, color: COL.n });
          const w0 = tw(g, eq[0], 22, 600);
          txt(g, '=', x + 40 + w0, 500, { size: 24, weight: 700, color: COL.accent });
          txt(g, eq[1], x + 66 + w0, 500, { size: 22, weight: 700, color: COL.adj });
          txt(g, eq[2], x + 28, 534, { size: 15, weight: 600, color: COL.muted });
        });
      };
      box(LX - 10, '보어 · 주어의 상태', 'Prices will remain ___.', 'competitive', ['remain'], ['competitively', '부사는 보어가 못 돼요'], ['Prices', 'competitive', '가격이 경쟁력 있는 상태'], ['be', 'remain', 'become', 'seem'], 0.4);
      box(670, '목적격 보어 · 목적어의 상태', 'Please keep the files ___.', 'secure', ['keep', 'files'], ['securely', '부사는 보어가 못 돼요'], ['the files', 'secure', '파일이 안전한 상태'], ['keep', 'find', 'make', 'consider'], 17.6);
    },

    /* 07 부사 자리: 동사 덩어리 가운데 · 완전한 문장 뒤 · 형용사 앞 → 빼 보기 */
    adv(g, u) {
      const rows = [
        { s: 'Sales have ___ increased.', w: 'steadily', cue: ['have', 'increased'], at: 6.2, tag: 'have + ___ + p.p.' },
        { s: 'Ms. Ito responded ___ to the complaint.', w: 'quickly', cue: ['responded'], at: 12.2, tag: '동사 + ___' },
        { s: 'All applicants must be ___ qualified.', w: 'highly', cue: ['qualified'], at: 14.6, tag: '___ + 형용사' },
      ];
      fade(g, ramp(u, 0.6, 0.5), () => chip(g, '부사 → 동사 · 형용사 · 문장을 꾸밈', W - 90, 112, { size: 17, weight: 700, color: COL.adv, fill: COL.panel2, stroke: COL.adv, align: 'right', h: 38, r: 10 }));
      rows.forEach((r, i) => {
        const y = 182 + i * 72, done = u > r.at + 1.6;
        const T = toks(r.s, {}, 'r' + i).map(t => t.r === 'blank' && done ? Object.assign({}, t, { t: r.w }) : t);
        const L = lay(g, T, { x: LX, y, size: 30 });
        fade(g, ramp(u, r.at, 0.6), () => {
          drawLay(g, L, tk => tk.r === 'blank' ? (done ? { color: COL.adv, textColor: COL.adv } : { glow: 0.5 }) : r.cue.includes(tk.t) ? { cue: true } : {});
          chip(g, r.tag, 1200, y, { size: 16, weight: 700, color: COL.adv, fill: COL.panel, stroke: COL.adv, align: 'right', h: 34, r: 8 });
          sayLay(L, r.s.replace('___', r.w));
        });
      });
      // 빼 보기
      const A = toks('Sales have steadily increased.', { steadily: 'adv' }, 'x');
      const B = A.filter(t => t.t !== 'steadily');
      const LA = lay(g, A, { x: LX + 20, y: 448, size: 32 }), LB = lay(g, B, { x: LX + 20, y: 448, size: 32 });
      const rp = clamp((u - 19.8) / 1.4);
      fade(g, ramp(u, 18.2, 0.6), () => {
        panel(g, LX - 10, 398, 560, 160, { fill: COL.panel2, stroke: COL.adv });
        txt(g, '빈칸을 빼 보기', LX + 14, 420, { size: 16, weight: 700, color: COL.adv });
        if (rp <= 0) drawLay(g, LA); else morph(g, LA, LB, rp, { lift: 0 });
        if (rp > 0 && rp < 1) { const s = byText(LA, 'steadily'); txt(g, 'steadily', s.x, s.y - 40 * ease(rp), { size: 32, weight: 600, color: COL.adv }); }
        if (rp >= 1) { mark(g, true, LB.x + LB.w + 26, 448, 18); txt(g, '빼도 완전한 문장 → 부사 자리', LX + 20, 520, { size: 19, weight: 700, color: COL.good }); }
      });
      // 반대: 명사를 빼면 무너짐
      fade(g, ramp(u, 25.2, 0.6), () => {
        panel(g, 650, 398, 550, 160, { fill: COL.panel2, stroke: COL.bad });
        txt(g, '명사를 빼면?', 674, 420, { size: 16, weight: 700, color: COL.bad });
        const T = toks('The ___ of the contract …', {}, 'z');
        const L = lay(g, T, { x: 674, y: 448, size: 30 });
        drawLay(g, L, tk => tk.r === 'blank' ? { color: COL.bad } : {});
        mark(g, false, L.x + L.w + 24, 448, 18);
        txt(g, '빼면 무너짐 → 명사·형용사 자리', 674, 520, { size: 19, weight: 700, color: COL.bad });
      });
    },

    /* 08 명사 + 명사, 사람과 일 */
    nn(g, u) {
      const filled = u > 4.2;
      const T = toks('the customer ___ survey', {}, 'c').map(t => t.r === 'blank' && filled ? Object.assign({}, t, { t: 'satisfaction', r: 'blank' }) : (t.t === 'customer' || t.t === 'survey') ? Object.assign({}, t, { r: 'n' }) : t);
      const L = lay(g, T, { x: LX, y: 205, size: 34 });
      fade(g, ramp(u, 0.4, 0.6), () => {
        drawLay(g, L, tk => tk.r === 'blank' ? { textColor: COL.n } : {});
        sayLay(L, 'the customer satisfaction survey');
        if (filled) {
          const a = byText(L, 'customer'), b = byText(L, 'survey');
          fade(g, ramp(u, 4.6, 0.6), () => {
            g.strokeStyle = COL.n; g.lineWidth = 2.5; const y = 238;
            g.beginPath(); g.moveTo(a.x, y - 6); g.lineTo(a.x, y); g.lineTo(b.x + b.w, y); g.lineTo(b.x + b.w, y - 6); g.stroke();
            txt(g, '한 덩어리 명사', (a.x + b.x + b.w) / 2, 258, { size: 16, weight: 700, color: COL.n, align: 'center' });
          });
        }
      });
      fade(g, ramp(u, 2.4, 0.5), () => {
        mark(g, false, 760, 205, 16); txt(g, 'customer satisfied survey', 786, 205, { size: 21, weight: 500, color: COL.muted });
      });
      ['safety regulations', 'sales figures', 'job openings', 'customer satisfaction'].forEach((c, k) => fade(g, ramp(u, 6.6 + k * 0.4, 0.5), () => {
        chip(g, c, LX + k * 270, 300, { size: 18, weight: 600, color: COL.n, fill: COL.panel, stroke: COL.n, h: 38, r: 10 });
      }));
      // 사람 vs 일
      const T2 = toks('hire an experienced ___', {}, 'h').map(t => t.r === 'blank' && u > 21 ? Object.assign({}, t, { t: 'consultant' }) : t);
      const L2 = lay(g, T2, { x: LX, y: 410, size: 34 });
      fade(g, ramp(u, 12.4, 0.6), () => {
        drawLay(g, L2, tk => tk.r === 'blank' ? {} : ['hire', 'experienced'].includes(tk.t) ? { cue: u > 18.4 } : {});
        sayLay(L2, 'hire an experienced consultant');
      });
      const cards = [['consultant', 'np', '사람', true], ['consultation', 'n', '일 · 상담', false]];
      cards.forEach(([w, pos, k, ok], i) => fade(g, ramp(u, 14 + i * 0.6, 0.5), () => {
        const x = 700 + i * 260, y = 382;
        panel(g, x, y - 30, 240, 120, { fill: COL.panel, stroke: u > 21 ? (ok ? COL.good : COL.bad) : COL.faint, lw: u > 21 ? 2.5 : 1.5 });
        txt(g, w, x + 120, y + 4, { size: 24, weight: 700, color: COL.n, align: 'center' });
        txt(g, k, x + 120, y + 48, { size: 18, weight: 600, color: COL.soft, align: 'center' });
        if (u > 21) mark(g, ok, x + 216, y - 10, 16);
      }));
      fade(g, ramp(u, 25.4, 0.6), () => {
        txt(g, '단서 hire · experienced → 사람을 가리킴', LX, 486, { size: 19, weight: 700, color: COL.v });
        txt(g, 'Registration closes on May 3.  ← 일·개념 명사 (관사 없음)', LX, 530, { size: 18, weight: 500, color: COL.en });
      });
    },

    /* 09 3단계 풀이법 흐름도 */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 보기를 본다', sub: '같은 뿌리?', at: 5.6, boxes: [
          ['같은 뿌리 네 개', '품사 문제 → 자리로 풀기', 'family'], ['뜻이 다른 네 낱말', '어휘 문제 → 뜻으로 풀기', 'vocab']] },
        { x: 480, head: '② 자리를 본다', sub: '빈칸 앞뒤', at: 11.2, boxes: [
          ['관사·형용사 뒤 / ___ + 전치사', '명사', 'n'], ['관사 + ___ + 명사', '형용사', 'adj'], ['be·remain 뒤 / keep + 목적어 뒤', '형용사 (보어)', 'comp'],
          ['빼도 문장이 완전한 자리', '부사', 'adv'], ['전치사 + ___ + 목적어', '동명사', 'ger']] },
        { x: 880, head: '③ 꼬리를 본다', sub: '함정 확인', at: 18.2, boxes: [
          ['-tion · -ment · -ness · -ity', '명사 (사람 -er · -ant)', 'n'], ['-ive · -able · -ful · -ous', '형용사', 'adj'], ['형용사 + ly', '부사', 'adv'],
          ['함정', 'timely · approval · representative', 'trap']] },
      ];
      const P = S.path && S.path.slot ? S.path : null;   // 판정기에서 정한 자리: { slot }
      const cat = P ? PS.slotCat(P.slot) : null;
      const colOf = { n: COL.n, adj: COL.adj, comp: COL.adj, adv: COL.adv, ger: COL.v, trap: COL.trap, family: COL.accent, vocab: COL.muted };
      cols.forEach((c, ci) => {
        fade(g, ramp(u, c.at, 0.6), () => {
          panel(g, c.x, 150, 340, 58, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 20, 179, { size: 22, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 320, 179, { size: 15, weight: 600, color: COL.muted, align: 'right' });
          c.boxes.forEach(([k, v, key], bi) => {
            const y = 220 + bi * 70, at = c.at + 0.5 + bi * 0.55;
            const slotKey = P ? (['oc'].includes(P.slot) ? 'comp' : ['np', 'nabs', 'cmpd'].includes(P.slot) ? 'n' : P.slot) : null;
            const on = P && ((ci === 0 && key === 'family') || (ci === 1 && key === slotKey) || (ci === 2 && key === (cat === 'vg' ? null : cat)));
            fade(g, ramp(u, at, 0.5) * (P && !on ? 0.4 : 1), () => {
              panel(g, c.x, y, 340, 62, { fill: on ? 'rgba(255,193,94,0.14)' : COL.panel, stroke: on ? COL.rel : COL.faint, lw: on ? 2.5 : 1.5 });
              txt(g, k, c.x + 16, y + 20, { size: 16, weight: 700, color: COL.soft });
              txt(g, v, c.x + 16, y + 44, { size: 17, weight: 700, color: colOf[key] || COL.rel });
            });
          });
          if (ci < 2) fade(g, ramp(u, cols[ci + 1].at - 0.3, 0.5), () => arrow(g, c.x + 348, 179, c.x + 392, 179, COL.accent, 3));
        });
      });
      if (P) chip(g, '자리: ' + PS.SLOT[P.slot].name + ' → ' + PS.CATNAME[cat], W / 2, 594, { size: 19, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 42, r: 10 });
    },

    /* 10 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = PS.DRILL[P.k];
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0], s2 = v >= P.at[1], s3 = v >= P.at[2];
        const T = toks(it.q).map(tk => tk.r === 'blank' && s3 ? Object.assign(tk, { t: it.opts[it.a][0] }) : tk);
        const L = lay(g, T, { x: LX, y: 222, size: 31, maxW: 1120, lh: 52 });
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: s2 && !s3 ? 0.6 : 0 } : s2 && it.cues.some(c => c.split(' ').includes(tk.t)) ? { cue: true } : {});
        sayLay(L, it.q.replace('___', it.opts[it.a][0]));
        const oy = L.lines > 1 ? 350 : 320;
        const rw = tw(g, it.root, 27, 600);
        it.opts.forEach(([o, pos], k) => {
          const ox = LX + (k % 2) * 290, y = oy + Math.floor(k / 2) * 78;
          const right = k === it.a, gone = !right && v >= P.at[1] + 1.2, win = right && s3;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, o, ox + 52, y, { size: 27, weight: win ? 700 : 600, color: win ? COL.good : gone ? COL.dim : COL.text });
          if (s1 && v < P.at[1] + 1.2) { g.fillStyle = COL.rel; g.fillRect(ox + 52, y + 17, Math.min(rw, w), 3); }
          if (v >= P.at[1] + 0.4) posTag(g, pos, ox + 52 + w + 44, y, ramp(v, P.at[1] + 0.4, 0.5), 13);
          if (gone) {
            const gp = clamp((v - P.at[1] - 1.2) / 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, y + 1); g.lineTo(ox - 4 + (w + 62) * gp, y + 1); g.stroke();
          }
          if (win) { panel(g, ox - 14, y - 26, w + 84, 52, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + w + 150, y, 18); }
        });
        panel(g, 660, oy - 40, 560, 230, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = oy - 2 + k * 70;
          txt(g, ['① 보기', '② 자리', '③ 꼬리'][k], 684, y, { size: 18, weight: 700, color: COL.accent });
          txt(g, ln, 684, y + 30, { size: 18, weight: 600, color: k === 2 ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 520, 760], Y0 = 150, RH = 48;
      const rows = [
        ['관사·소유격·형용사 뒤 / ___ + 전치사', 'n', '명사', 'the renewal of'],
        ['관사 · 소유격 + ___ + 명사', 'adj', '형용사', 'a significant increase'],
        ['be·remain 뒤 / keep + 목적어 뒤', 'adj', '형용사 (보어)', 'remain competitive'],
        ['빼도 문장이 완전한 자리', 'adv', '부사', 'have steadily increased'],
        ['전치사 + ___ + 목적어', 'vg', '동명사', 'by reviewing the budget'],
        ['명사 + ___ + 명사', 'n', '명사 (복합명사)', 'customer satisfaction survey'],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 10, 1160, RH * (rows.length + 1) + 16, { fill: COL.panel, stroke: COL.faint });
        ['빈칸의 자리 (신호)', '품사', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 22, { size: 17, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 8, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.7, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 22;
        txt(g, r[0], X[0] + 20, y, { size: 19, weight: 600 });
        txt(g, r[2], X[1] + 20, y, { size: 20, weight: 700, color: PCOL[r[1]] });
        txt(g, r[3], X[2] + 20, y, { size: 19, weight: 500, color: COL.en });
      }));
      const steps = ['① 보기: 같은 뿌리?', '② 자리: 빈칸 앞뒤', '③ 꼬리: 접미사 · 함정'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 6.5 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 546, { size: 20, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 48, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 546, c.x + c.w + 46, 546, COL.accent, 2.5);
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

  SV.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[SV.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, SV.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + PS.FAMILIES.map(f => f.ko.flat().join('') + f.forms.flat().join('')).join('') +
    PS.DRILL.map(d => d.q + d.opts.map(o => o[0]).join('')).join('') + Object.values(PS.SLOT).map(s => s.name + s.sign).join('') +
    '명사형용사부사동사사람동명사' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←✓×▢?~=+-/:…';
  SV.baseText = EXTRA;
  SV.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = SV.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { SV.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
