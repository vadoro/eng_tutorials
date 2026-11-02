/* 어휘 · 짝 표현 튜토리얼 — 영상 장면
 *
 * VS.render(g, t)는 시각 t와 사용자 상태 VS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 역할 색: 짝(빈칸과 함께 쓰이는 말) 하늘 · 빈칸에 들어갈 말(답) 노랑 · 빈칸 분홍 점선 · 덩어리 표현 민트
 *          · 구조 단서(목적어 · 사람) 보라 · 함정(닮은꼴 · 헷갈리는 동사) 주황.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(VC.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const VC = window.VC;
  const VS = (window.VS = {});
  const W = 1280, H = 720;
  VS.W = W; VS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 글자는 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  VS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36',
    pt: '#6EC8FF', ans: '#FFC15E', gap: '#FF7AA8', chunk: '#7FE0A8', cue: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  VS.COL = COL;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (VS.S = { ko: null, pick: null, pair: null, obj: null, path: null });
  VS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  VS.hits = () => HITS;

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
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; g.stroke(); }
    txt(g, s, x0 + w / 2, y + 1, { size, weight: o.weight || 600, color: o.color || COL.text, align: 'center', fam: o.fam });
    return { x: x0, y: y - h / 2, w, h };
  }
  const chipW = (g, s, o = {}) => tw(g, s, o.size || 18, o.weight || 600, o.fam || FB) + (o.pad || 14) * 2;
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; g.stroke(); }
  }
  const say = (x, y, w, h, text) => HITS.push({ x, y, w, h, say: text });
  const strike = (g, x0, x1, y, p = 1, color = COL.bad) => { if (p <= 0) return; g.strokeStyle = color; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + (x1 - x0) * p, y); g.stroke(); };

  /* ---------- 영어 문장 토큰 배치와 그리기 ---------- */
  // 토큰 { id, t: 글자, r: 역할 }. 역할: pt 짝 · ans 답(노란 상자) · blank 빈칸 · chunk 덩어리 · cue 구조 단서 · trap 함정 · bad 틀림 · fn 기능어 · '' 보통
  const PCOL = { pt: COL.pt, chunk: COL.chunk, cue: COL.cue, trap: COL.trap, bad: COL.bad, good: COL.good, dim: COL.dim, fn: COL.muted, word: COL.ans };
  const LINE = { pt: 1, chunk: 1, cue: 1, trap: 1, word: 1 };
  const PUNCT = /^[.,?!]$/;
  const tokW = (g, tk, size) => tk.r === 'blank' ? Math.max(size * 2.6, tk.t ? tw(g, tk.t, size, 700) + size * 0.7 : 0) :
    tk.r === 'ans' ? tw(g, tk.t, size, 700) + size * 0.5 : tw(g, tk.t, size, LINE[tk.r] ? 600 : 500);
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
      const x0 = o.align === 'center' ? o.x - lw / 2 : o.align === 'right' ? o.x - lw : o.x;
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
  // 낱말 여러 개(띄어쓰기로)에 같은 역할
  const R = (pairs) => { const o = {}; pairs.forEach(([s, r]) => s.split(' ').forEach(w => { o[w] = r; })); return o; };
  const byText = (L, t) => L.items.find(i => i.t === t);
  const blankOf = L => L.items.find(i => i.r === 'blank' || i.r === 'ans');
  // 여러 토큰을 감싸는 상자 (짝 표시)
  function boxAround(g, L, words, color, o = {}) {
    const its = L.items.filter(i => words.includes(i.t) && (!o.after || i.x > o.after));
    if (!its.length) return null;
    const x0 = Math.min(...its.map(i => i.x)), x1 = Math.max(...its.map(i => i.x + i.w)), y = its[0].y, s = its[0].size;
    rr(g, x0 - 4, y - s * 0.68, x1 - x0 + 8, s * 1.36, 8); g.strokeStyle = color; g.lineWidth = o.lw || 2.2; g.stroke();
    return { x: x0, w: x1 - x0, y, size: s };
  }
  // 토큰 하나 그리기. o: { a: 투명도, r: 역할 바꾸기, color, glow: 빈칸 반짝임 }
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
      const c = o.color || PCOL[r] || COL.text;
      txt(g, it.t, x, y + 1, { size, weight: LINE[r] ? 600 : 500, color: c });
      if (LINE[r] && !o.plain) { g.fillStyle = c; g.fillRect(x, y + size * 0.56, w, 3); }
      if (r === 'bad') strike(g, x - 3, x + w + 3, y + 2);
    }
    g.restore();
  }
  function drawLay(g, L, style) { L.items.forEach(it => drawTok(g, it, style ? style(it) || {} : {})); }
  function sayLay(L, text) { say(L.x - 8, L.y - L.size * 0.8, L.w + 16, L.h + L.size * 0.3, text); }
  // 짧은 짝 표현 한 줄: 답 낱말(노랑) + 짝(하늘). 예: phraseLine(g, 'conduct a survey', { conduct: 'word', survey: 'pt' }, x, y)
  function phraseLine(g, s, roles, x, y, o = {}) {
    const L = lay(g, toks(s, roles, o.pre || 'p' + Math.round(x) + '_' + Math.round(y)), { x, y, size: o.size || 26, align: o.align });
    drawLay(g, L, o.style);
    if (o.say !== false) sayLay(L, o.sayText || s);
    return L;
  }

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '토익 Part 5의 어휘 문제', d: 22, caps: [
      [0.4, 5, '토익 Part 5의 **어휘** 문제예요. 보기 네 개가 모두 뜻이 다른 동사예요.'],
      [5, 10.5, 'conduct, attend, reserve, earn. 넷 다 동사원형이라 문법으로는 모두 빈칸에 들어가요.'],
      [10.5, 15.5, '그럼 무엇이 답을 정할까요? 열쇠는 빈칸 바로 뒤의 낱말, survey.'],
      [15.5, 22, '빈칸의 **짝**을 찾고, 짝을 맞추고, 함정을 확인하는 **3단계 풀이법**을 배워요.'],
    ] },
    { id: 'korean', n: '01', title: '하다 하나, 짝은 여럿', sub: '한국어와 다른 점', d: 28, caps: [
      [0.4, 5.5, '한국어부터 볼까요? 회의를 하다, 조사를 하다, 결정을 하다. 모두 **하다** 하나로 말해요.'],
      [5.5, 11.5, '영어는 달라요. hold a meeting, conduct a survey, make a decision.'],
      [11.5, 17, '발표는 give a presentation, 주문은 place an order. 명사마다 짝이 되는 동사가 달라요.'],
      [17, 22.5, '하다를 그대로 옮기면 틀려요. 틀린 짝 do a decision, 맞는 짝 make a decision.'],
      [22.5, 28, '그래서 영어 낱말은 혼자 외우지 말고, 늘 함께 다니는 **짝**과 묶어서 외워요.'],
    ] },
    { id: 'pair', n: '02', title: '짝이 답을 정한다', sub: '콜로케이션', d: 32, caps: [
      [0.4, 5.5, '처음 문제로 돌아가요. 보기를 하나씩 빈칸에 넣고, 뒤의 짝과 붙여 읽어 봐요.'],
      [5.5, 11, 'conduct a survey. 설문 조사를 실시하다. 자연스러운 짝이에요.'],
      [11, 17, '나머지는 짝이 따로 있어요. attend a meeting, reserve a room, earn money.'],
      [17, 22.5, '이렇게 자주 함께 쓰이는 낱말 짝을 **콜로케이션**(collocation), 우리말로 **짝 표현**이라고 해요.'],
      [22.5, 27.5, '짝은 빈칸 가까이에 있어요. 동사 빈칸이면 뒤의 목적어, 형용사 빈칸이면 꾸밈 받는 명사.'],
      [27.5, 32, '부사 빈칸이면 숫자나 형용사, 명사 빈칸이면 앞뒤의 덩어리를 봐요.'],
    ] },
    { id: 'verbs', n: '03', title: '동사의 짝, 덩어리 표현', sub: '유형 59 · 60', d: 34, caps: [
      [0.4, 6, '먼저 **동사와 목적어** 짝이에요. implement a plan, conduct a survey, submit a proposal.'],
      [6, 12, '마감을 만나다? 아니에요. meet a deadline → 마감을 지키다.'],
      [12, 17.5, '주소를 쓰다? 아니에요. address an issue → 문제를 다루다. 짝이 낱말의 뜻을 정해요.'],
      [17.5, 23, '다음은 통째로 굳은 **덩어리 표현**이에요. take effect, until further notice, in charge of.'],
      [23, 28.5, '재고가 없을 때는 out of stock. 한 낱말만 바꾼 out of order → 고장 난.'],
      [28.5, 34, '덩어리 표현은 쪼개지 말고 통째로 외워요. as of, on short notice, place an order.'],
    ] },
    { id: 'adjs', n: '04', title: '꼬리만 다른 형용사', sub: '유형 61 · 닮은꼴', d: 30, caps: [
      [0.4, 6, '이번에는 **모양이 비슷한 형용사** 쌍이에요. 꼬리만 조금 다르고 뜻은 전혀 달라요.'],
      [6, 12, 'considerable → 상당한, 양이나 정도. considerate → 배려하는, 사람의 마음씨.'],
      [12, 18, '그래서 a considerable amount of time, 그리고 be considerate of others.'],
      [18, 24, 'reliable 믿을 수 있는, reliant 의존하는. economic 경제의, economical 돈이 덜 드는.'],
      [24, 30, '둘 가운데 고를 때는 **짝**을 봐요. 꾸밈 받는 명사가 양인지, 사람인지, 뒤에 무엇이 오는지.'],
    ] },
    { id: 'advs', n: '05', title: '부사의 짝', sub: '유형 62', d: 28, caps: [
      [0.4, 6, '**부사**도 짝이 있어요. 숫자 앞에는 approximately, approximately 200 people.'],
      [6, 12, '형용사나 분사 앞에는 highly. highly qualified, highly recommended.'],
      [12, 17, '동사 뒤 promptly, 시간 앞 shortly. respond promptly, shortly after the meeting.'],
      [17, 22.5, '모양이 비슷한 함정도 있어요. hard → 열심히, hardly → 거의 ~하지 않다. 뜻이 정반대예요.'],
      [22.5, 28, 'most → 대부분의, 명사 앞. mostly → 주로, 부사. 꼬리 하나로 자리가 달라져요.'],
    ] },
    { id: 'confv', n: '06', title: '헷갈리는 동사', sub: '유형 63 · 뒤의 구조', d: 32, caps: [
      [0.4, 6, '마지막은 **헷갈리는 동사**예요. rise, raise. 둘 다 위로 올라가는 뜻이에요.'],
      [6, 12, '뒤에 목적어가 없으면 rise, 있으면 raise. Prices rise. The company raises prices.'],
      [12, 18, '놓다도 같아요. 목적어가 없으면 lie, 목적어가 있으면 lay.'],
      [18, 24, '말하다는 뒤를 봐요. 사람이 먼저 오면 tell, 내용이 바로 오면 say. tell us that, say that.'],
      [24, 28, '빌려주면 lend, 빌려 오면 borrow. 화살표의 방향이 반대예요.'],
      [28, 32, '알려 주면 remind, 스스로 기억하면 remember. 동사 affect, 명사 effect.'],
    ] },
    { id: 'method', n: '07', title: '3단계 풀이법', sub: '짝 찾기 → 짝 맞추기 → 함정 확인', d: 25, caps: [
      [0.4, 5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5, 10.5, '① **짝 찾기**. 빈칸이 무슨 자리인지 보고, 짝이 될 말에 표시해요.'],
      [10.5, 16, '② **짝 맞추기**. 그 짝과 함께 쓰는 보기를 골라요. 한국어를 그대로 옮기지 말고요.'],
      [16, 21, '③ **함정 확인**. 모양이 비슷한 말, 뒤의 목적어와 사람, 빌리는 방향을 한 번 더 봐요.'],
      [21, 25, '이 순서로 토익 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '08', title: '실전 문제 풀이', sub: '토익 Part 5 세 문제', d: 48, caps: [
      [0.4, 5.5, '첫 문제. ① 빈칸은 동사 자리. 짝은 뒤의 목적어, problem.'],
      [5.5, 11, '② 짝을 떠올려요. address the problem → 문제를 해결하다.'],
      [11, 16, '③ 나머지는 짝이 따로 있어요. attract customers, reserve a room, earn money. 정답은 (B).'],
      [16.4, 21.5, '두 번째. ① 형용사 자리. 짝은 꾸밈 받는 명사, amount.'],
      [21.5, 27, '② 양을 꾸미는 짝은 considerable. 상당한 양의 돈이에요.'],
      [27, 32, '③ considerate → 배려하는, 닮은꼴 함정. 나머지 둘은 품사가 달라요. 정답은 (A).'],
      [32.4, 37.5, '세 번째. ① 동사 자리. 짝은 뒤의 목적어, the price.'],
      [37.5, 43, '② 값이 오르내리는 뜻이니 rise 아니면 raise. 생기다 arise, 놓여 있다 lie → 탈락.'],
      [43, 48, '③ 뒤에 목적어가 있으니 타동사 raise. 정답은 (A).'],
    ] },
    { id: 'summary', n: '09', title: '정리', sub: '한눈에 보는 짝의 자리', d: 20, caps: [
      [0.4, 5.5, '정리해요. 어휘 문제는 문법이 아니라 **짝**으로 풀어요.'],
      [5.5, 11, '동사는 목적어, 형용사는 꾸밈 받는 명사, 부사는 숫자와 형용사, 덩어리는 통째로.'],
      [11, 16, '닮은꼴과 헷갈리는 동사는 뜻과 뒤의 구조를 한 번 더 확인해요.'],
      [16, 20, '아래 짝 카드로 매일 조금씩 짝을 쌓아 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  VS.CHAPTERS = CHAPTERS; VS.CAPTIONS = CAPTIONS; VS.END = END;
  VS.POSTER = CHAPTERS.find(c => c.id === 'pair').t + 19;
  VS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  VS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(VC.DRILL)에서 세 개. 보기는 규칙 엔진이 정한 단계(② 또는 ③)에서 지워짐
  const PRACTICE = [
    { k: 0, at: [0.4, 5.6, 11.1], lines: ['빈칸 = 동사 → 짝: 목적어 problem', 'address the problem → 해결하다', '닮은꼴 함정 없음 → (B) address'] },
    { k: 7, at: [0.4, 5.4, 11], lines: ['빈칸 = 형용사 → 짝: 명사 amount', 'a considerable amount → 상당한 양', 'considerate = 닮은꼴 → (A) considerable'] },
    { k: 13, at: [0.4, 5.4, 11], lines: ['빈칸 = 동사 → 짝: 목적어 the price', '오르다 · 올리다 → rise 아니면 raise', '목적어가 있으니 타동사 → (A) raise'] },
  ];
  PRACTICE.forEach(p => {
    const it = VC.DRILL[p.k];
    if (!p.lines[2].includes(`(${'ABCD'[it.a]})`)) console.warn('[어휘 · 짝] 실전 문제 정답 표시가 데이터와 달라요:', it.q);
    it.opts.forEach((o, i) => { if ((VC.judge(o, it).s === 'ok') !== (i === it.a)) console.warn('[어휘 · 짝] 실전 문제가 규칙 엔진과 달라요:', it.q); });
  });

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  const INTRO = VC.INTRO;
  const IJ = INTRO.opts.map(o => VC.judge(o, INTRO));
  if (IJ.filter(j => j.s === 'ok').length !== 1 || IJ[INTRO.a].s !== 'ok') console.warn('[어휘 · 짝] 들어가며 문제가 규칙 엔진과 달라요.');
  // 문장 속 짝(survey)에 역할을 붙인 토큰
  const introToks = (cueOn) => toks(INTRO.q, cueOn ? { survey: 'pt' } : {}, 'i');

  const SCENES = {
    /* 00 들어가며: 제목 → 토익 문제(문법은 넷 다 통과, 짝이 열쇠) → 3단계 미리보기 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '낱말에도 단짝이 있다', W / 2, 290, { size: 72, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Vocabulary · Collocations', W / 2, 368, { size: 28, weight: 500, color: COL.muted, align: 'center' });
      });
      const types = Object.entries(VC.TYPES).map(([n, t]) => `${n} ${t.short}`);
      const ws = types.map(s => chipW(g, s, { size: 17 })), gap = 14, tot = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
      let cx = W / 2 - tot / 2;
      types.forEach((s, k) => {
        const a = ramp(u, 1.3 + k * 0.2, 0.4) * out1;
        fade(g, a, () => chip(g, s, cx, 462 + (1 - a) * 10, { size: 17, color: COL.soft, fill: COL.panel, stroke: COL.faint }));
        cx += ws[k] + gap;
      });
      const a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 15.2, 0.6));
      fade(g, a2, () => {
        panel(g, 140, 150, 1000, 410, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 5 · 어휘', 180, 192, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const cueOn = u > 10.8;
        const L = lay(g, introToks(cueOn), { x: 180, y: 262, size: 30, maxW: 930 });
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: cueOn ? 0.5 + 0.5 * Math.sin(u * 4) : 0 } : {});
        if (cueOn) fade(g, ramp(u, 10.8, 0.5), () => boxAround(g, L, ['survey'], COL.pt));
        sayLay(L, INTRO.q.replace('___', INTRO.opts[INTRO.a]));
        INTRO.opts.forEach((o, k) => {
          const ox = 200 + (k % 2) * 440, oy = 372 + Math.floor(k / 2) * 62;
          fade(g, ramp(u, 5.4 + k * 0.25, 0.4), () => {
            txt(g, `(${'ABCD'[k]})`, ox, oy, { size: 26, weight: 500, fam: FM, color: COL.muted });
            const w = txt(g, o, ox + 64, oy, { size: 30, weight: 600 });
            fade(g, ramp(u, 7.8 + k * 0.2, 0.4), () => mark(g, true, ox + 64 + w + 26, oy, 16));
          });
        });
        fade(g, ramp(u, 8.8, 0.5), () => chip(g, '문법 검사 → 넷 다 통과', 180, 512, { size: 17, weight: 700, color: COL.good, fill: COL.panel2, stroke: COL.good, h: 38, r: 10 }));
        fade(g, ramp(u, 12, 0.5), () => chip(g, '답을 정하는 것 = 빈칸의 짝', 1100, 512, { size: 17, weight: 700, color: COL.pt, fill: COL.panel2, stroke: COL.pt, h: 38, r: 10, align: 'right' }));
      });
      const steps = [['①', '짝 찾기', '빈칸 가까이의 짝 말'], ['②', '짝 맞추기', '그 짝과 함께 쓰는 보기'], ['③', '함정 확인', '닮은꼴 · 구조 · 방향']];
      steps.forEach(([n, t1, t2], k) => {
        const a = ramp(u, 15.8 + k * 0.7, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 220, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 285 + (1 - a) * 16, { size: 34, weight: 700, color: COL.accent });
          txt(g, t1, x0 + 28, 345 + (1 - a) * 16, { size: 27, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 400 + (1 - a) * 16, { size: 19, weight: 500, color: COL.soft });
        });
      });
    },

    /* 01 하다 하나, 짝은 여럿: 한국어 ‘하다’ ↔ 영어의 여러 짝 동사 */
    korean(g, u) {
      const rows = VC.KO, sel = S.ko;
      const out = 1 - ramp(u, 16.6, 0.5) * 0.45;
      rows.forEach((r, k) => {
        const y = 178 + k * 62, on = sel === k;
        const aK = on ? 1 : ramp(u, 0.6 + k * 0.4, 0.5), aE = on ? 1 : ramp(u, k < 3 ? 5.8 + k * 0.9 : 11.8 + (k - 3) * 0.9, 0.5);
        fade(g, aK * out, () => {
          txt(g, r.ko[0], 110, y, { size: 30, weight: 600 });
          txt(g, r.ko[1], 222, y, { size: 30, weight: 700, color: u > 3.2 || on ? COL.ans : COL.text });
        });
        fade(g, aE * out, () => {
          arrow(g, 330, y, 610, y, COL.muted, 2);
          const L = phraseLine(g, `${r.v} ${r.n}`, R([[r.v, 'word'], [r.n.replace(/^(a|an) /, ''), 'pt']]), 640, y, { size: 30, pre: 'k' + k });
          if (on) { rr(g, 96, y - 26, L.x + L.w + 24 - 96, 52, 10); g.strokeStyle = COL.ans; g.lineWidth = 2.2; g.stroke(); }
        });
      });
      // ‘하다’ 하나로 묶기
      fade(g, ramp(u, 3.4, 0.6) * (1 - ramp(u, 16.6, 0.5)), () => {
        rr(g, 208, 150, 80, 312, 12); g.strokeStyle = COL.ans; g.lineWidth = 2; g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
        chip(g, '하다 하나', 248, 498, { size: 17, weight: 700, color: COL.ans, fill: COL.panel2, stroke: COL.ans, align: 'center', h: 36, r: 10 });
      });
      fade(g, ramp(u, 13.4, 0.6) * (1 - ramp(u, 16.6, 0.5)), () => chip(g, '동사가 모두 달라요', 1190, 498, { size: 17, weight: 700, color: COL.pt, fill: COL.panel2, stroke: COL.pt, align: 'right', h: 36, r: 10 }));
      // 틀린 짝과 맞는 짝
      fade(g, ramp(u, 17.2, 0.6), () => {
        panel(g, LX, 484, 1120, 84, { fill: COL.panel2, stroke: COL.faint });
        mark(g, false, LX + 30, 526, 16);
        const L1 = phraseLine(g, 'do a decision', { do: 'trap', decision: 'pt' }, LX + 56, 526, { size: 26, pre: 'x1', say: false });
        strike(g, L1.x - 4, L1.x + L1.w + 4, 527);
        fade(g, ramp(u, 19.4, 0.5), () => {
          mark(g, true, LX + 340, 526, 16);
          phraseLine(g, 'make a decision', { make: 'word', decision: 'pt' }, LX + 366, 526, { size: 26, pre: 'x2' });
        });
        fade(g, ramp(u, 20.6, 0.5) * (1 - ramp(u, 22.4, 0.4)), () => txt(g, '하다 ≠ do', LX + 1096, 526, { size: 21, weight: 700, color: COL.trap, align: 'right' }));
        fade(g, ramp(u, 22.8, 0.5), () => chip(g, '명사 + 짝 동사를 한 덩어리로 외우기', LX + 1100, 526, { size: 18, weight: 700, color: COL.ans, fill: COL.panel, stroke: COL.ans, align: 'right', h: 42, r: 10 }));
      });
    },

    /* 02 짝이 답을 정한다: 보기마다 짝과 붙여 읽기 → 콜로케이션 → 짝은 어디에 */
    pair(g, u) {
      const outA = 1 - ramp(u, 22.2, 0.6);
      fade(g, ramp(u, 0.3, 0.6) * outA, () => {
        const L = lay(g, introToks(true), { x: LX, y: 190, size: 28, maxW: 1120 });
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: 0.4 } : {});
        boxAround(g, L, ['survey'], COL.pt);
        sayLay(L, INTRO.q.replace('___', INTRO.opts[INTRO.a]));
      });
      INTRO.opts.forEach((o, k) => {
        const y = 282 + k * 64, j = IJ[k], ok = j.s === 'ok', on = S.pick === k;
        const a = (on ? 1 : ramp(u, k === INTRO.a ? 5.8 : 11.2 + (k - 1) * 0.8, 0.5)) * outA;
        fade(g, a, () => {
          if (on) { rr(g, LX - 10, y - 28, 1140, 56, 10); g.fillStyle = 'rgba(255,193,94,0.08)'; g.fill(); g.strokeStyle = COL.ans; g.lineWidth = 2; g.stroke(); }
          mark(g, ok, LX + 14, y, 16);
          const L = phraseLine(g, `${o} a survey`, { [o]: ok ? 'word' : 'dim', survey: 'pt' }, LX + 44, y, { size: 28, pre: 'q' + k, say: ok });
          if (!ok) { const w0 = L.items[0]; strike(g, w0.x - 3, w0.x + w0.w + 3, y + 1, ramp(u, 11.6 + (k - 1) * 0.8, 0.4)); }
          if (ok) txt(g, '= 설문 조사를 실시하다', 480, y, { size: 21, weight: 700, color: COL.good });
          else {
            const fr = VC.friendsOf(o, 1)[0];
            txt(g, '짝:', 480, y, { size: 18, weight: 600, color: COL.muted });
            const L2 = phraseLine(g, fr, R([[o, 'word'], [fr.replace(o + ' ', '').replace(/^(a|an) /, ''), 'pt']]), 522, y, { size: 24, pre: 'f' + k });
            txt(g, VC.entry(o).ko, L2.x + L2.w + 18, y, { size: 18, weight: 500, color: COL.muted });
          }
        });
      });
      fade(g, ramp(u, 17.4, 0.6) * outA, () => chip(g, '콜로케이션 (collocation) = 자주 함께 쓰이는 낱말 짝', W / 2, 546, { size: 20, weight: 700, color: COL.ans, fill: COL.panel2, stroke: COL.ans, align: 'center', h: 46, r: 12, pad: 22 }));
      // 짝은 어디에: 네 가지 빈칸
      const P = [
        { x: 80, y: 150, at: 22.8, head: '동사 빈칸 → 뒤의 목적어', s: '___ a survey', pt: ['survey'], dir: 1 },
        { x: 660, y: 150, at: 24.6, head: '형용사 빈칸 → 꾸밈 받는 명사', s: 'a ___ amount of time', pt: ['amount'], dir: 1 },
        { x: 80, y: 360, at: 27.8, head: '부사 빈칸 → 숫자 · 형용사 · 동사', s: '___ 200 people', pt: ['200'], dir: 1, ex: 'highly qualified · respond promptly' },
        { x: 660, y: 360, at: 29.4, head: '명사 빈칸 → 앞뒤의 덩어리', s: 'until further ___', pt: ['until', 'further'], dir: -1, chunk: true, ex: 'in charge of · out of stock' },
      ];
      P.forEach((p, i) => fade(g, ramp(u, p.at, 0.6), () => {
        panel(g, p.x, p.y, 540, 190, { fill: COL.panel, stroke: COL.faint });
        txt(g, p.head, p.x + 24, p.y + 32, { size: 20, weight: 700, color: COL.soft });
        const roles = {}; p.pt.forEach(w => { roles[w] = p.chunk ? 'chunk' : 'pt'; });
        const L = lay(g, toks(p.s, roles, 'w' + i), { x: p.x + 40, y: p.y + 118, size: 32 });
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: 0.5 } : {});
        const bk = blankOf(L), its = L.items.filter(t => p.pt.includes(t.t));
        const tx = (Math.min(...its.map(t => t.x)) + Math.max(...its.map(t => t.x + t.w))) / 2;
        const ap = ramp(u, p.at + 0.6, 0.8);
        if (p.dir > 0) arc(g, bk.x + bk.w / 2, bk.y - 24, tx, bk.y - 24, 26, p.chunk ? COL.chunk : COL.pt, ap);
        else arc(g, tx, bk.y - 24, bk.x + bk.w / 2, bk.y - 24, 26, COL.chunk, ap);
        sayLay(L, p.s.replace('___', ['conduct', 'considerable', 'approximately', 'notice'][i]));
        if (p.ex) txt(g, p.ex, p.x + 40, p.y + 166, { size: 17, weight: 500, color: COL.en });
      }));
    },

    /* 03 동사의 짝, 덩어리 표현 (59 · 60) */
    verbs(g, u) {
      const outA = 1 - ramp(u, 17.3, 0.6);
      const pairs = [['implement', 'a plan', 0.8], ['conduct', 'a survey', 1.3], ['submit', 'a proposal', 1.8], ['reach', 'an agreement', 2.6], ['meet', 'a deadline', 6.2], ['address', 'an issue', 12.2]];
      pairs.forEach(([v, n, at], k) => fade(g, ramp(u, at, 0.5) * outA, () => {
        const x = 80 + (k % 3) * 380, y = 182 + Math.floor(k / 3) * 58;
        phraseLine(g, `${v} ${n}`, R([[v, 'word'], [n.replace(/^(a|an) /, ''), 'pt']]), x, y, { size: 25, pre: 'v' + k });
      }));
      const box = (x, at, wrongKo, en, rightKo, more) => fade(g, ramp(u, at, 0.6) * outA, () => {
        panel(g, x, 300, 540, 256, { fill: COL.panel, stroke: COL.faint });
        mark(g, false, x + 34, 342, 15);
        const ww = txt(g, wrongKo, x + 58, 342, { size: 21, weight: 600, color: COL.muted });
        strike(g, x + 54, x + 62 + ww, 343, ramp(u, at + 0.5, 0.4));
        const [v, ...n] = en.split(' ');
        fade(g, ramp(u, at + 0.6, 0.5), () => phraseLine(g, en, R([[v, 'word'], [n.slice(-1)[0], 'pt']]), x + 34, 410, { size: 34, pre: 'b' + x }));
        fade(g, ramp(u, at + 2, 0.5), () => { mark(g, true, x + 46, 470, 16); txt(g, rightKo, x + 72, 470, { size: 24, weight: 700, color: COL.good }); });
        fade(g, ramp(u, at + 3.2, 0.5), () => txt(g, more, x + 34, 520, { size: 17, weight: 500, color: COL.en }));
      });
      box(80, 6.4, '마감을 만나다?', 'meet a deadline', '= 마감을 지키다', 'meet the demand · meet requirements');
      box(660, 12.4, '주소를 쓰다?', 'address an issue', '= 문제를 다루다', 'address a problem · address concerns');
      // 덩어리 표현
      const chunks = [['take effect', 17.8], ['until further notice', 18.3], ['in charge of', 18.8], ['out of stock', 23.2], ['as of', 28.8], ['on short notice', 29.3], ['place an order', 29.8]];
      let x = 80, row = 0;
      chunks.forEach(([s, at], k) => {
        if (k === 4) { x = 80; row = 1; }
        const w = chipW(g, s, { size: 21, pad: 16 });
        const xx = x, y = 182 + row * 58;
        fade(g, ramp(u, at, 0.5), () => {
          chip(g, s, xx, y, { size: 21, pad: 16, color: COL.chunk, fill: COL.panel, stroke: COL.chunk, h: 42, r: 10 });
          say(xx, y - 21, w, 42, s);
        });
        x += w + 16;
      });
      fade(g, ramp(u, 23.4, 0.6), () => {
        panel(g, LX, 300, 1120, 180, { fill: COL.panel2, stroke: COL.faint });
        txt(g, '한 낱말만 바꾸면', W / 2, 330, { size: 16, weight: 600, color: COL.muted, align: 'center' });
        phraseLine(g, 'out of stock', { out: 'chunk', of: 'chunk', stock: 'word' }, 300, 392, { size: 34, align: 'center', pre: 'os' });
        txt(g, '= 재고가 없는', 300, 446, { size: 21, weight: 700, color: COL.good, align: 'center' });
        fade(g, ramp(u, 25, 0.6), () => {
          arrow(g, 470, 392, 800, 392, COL.trap, 2.5);
          phraseLine(g, 'out of order', { out: 'chunk', of: 'chunk', order: 'trap' }, 980, 392, { size: 34, align: 'center', pre: 'oo' });
          txt(g, '= 고장 난', 980, 446, { size: 21, weight: 700, color: COL.trap, align: 'center' });
        });
      });
      fade(g, ramp(u, 28.6, 0.6), () => chip(g, '덩어리째 외우기 · 쪼개지 않기', W / 2, 528, { size: 20, weight: 700, color: COL.chunk, fill: COL.panel2, stroke: COL.chunk, align: 'center', h: 46, r: 12, pad: 22 }));
    },

    /* 04 꼬리만 다른 형용사 (61): 여섯 쌍 + 짝으로 가르기 */
    adjs(g, u) {
      const pairs = VC.ADJ_PAIRS, sel = S.pair == null ? 0 : S.pair;
      const tail = (w, t, x, y, color) => {
        const base = w.slice(0, w.length - t.length), wb = tw(g, base, 27, 600), wt = tw(g, t, 27, 700);
        txt(g, base, x, y, { size: 27, weight: 600 });
        txt(g, t, x + wb, y, { size: 27, weight: 700, color });
        g.fillStyle = color; g.fillRect(x + wb, y + 16, wt, 3);
        say(x - 4, y - 20, wb + wt + 8, 40, w);
        return wb + wt;
      };
      const AT = [[6.2, 9.2], [18.2, 19.4], [20.6, 21.8], [24.4, 24.6], [25, 25.2], [25.6, 25.8]];
      pairs.forEach((p, k) => {
        const y = 168 + k * 52, on = S.pair === k;
        const all = S.pair != null;   // 쌍을 고르면 표 전체를 보여 줌
        const aA = all ? 1 : ramp(u, AT[k][0], 0.5), aB = all ? 1 : ramp(u, AT[k][1], 0.5);
        if (on) fade(g, 1, () => { rr(g, LX - 12, y - 24, 1144, 48, 10); g.fillStyle = 'rgba(255,193,94,0.08)'; g.fill(); g.strokeStyle = COL.ans; g.lineWidth = 2; g.stroke(); });
        fade(g, aA, () => { tail(p.a, p.ta, 96, y, COL.ans); txt(g, VC.entry(p.a).ko, 360, y, { size: 18, weight: 500, color: COL.soft }); });
        fade(g, aB, () => { tail(p.b, p.tb, 660, y, COL.trap); txt(g, VC.entry(p.b).ko, 924, y, { size: 18, weight: 500, color: COL.soft }); });
        if (k < 5) fade(g, Math.min(aA, aB) * 0.6, () => { g.fillStyle = COL.faint; g.fillRect(LX, y + 26, 1120, 1); });
      });
      // 짝으로 가르기 (고른 쌍, 처음에는 첫째 쌍)
      fade(g, ramp(u, 12.2, 0.6), () => {
        const p = pairs[sel];
        panel(g, LX, 482, 1120, 88, { fill: COL.panel2, stroke: u > 24.2 ? COL.pt : COL.faint, lw: u > 24.2 ? 2.2 : 1.5 });
        const one = (fr, w, pts, x, pre) => {
          const ja = VC.judge(w, fr);
          mark(g, ja.s === 'ok', x, 526, 15);
          const roles = {}; pts.forEach(t => { roles[t] = 'pt'; });
          const L = lay(g, toks(fr.q.replace(/\s*\([^)]*\)$/, '').replace('___', w), Object.assign(roles, { [w]: 'word' }), pre), { x: x + 24, y: 526, size: 25 });
          drawLay(g, L);
          sayLay(L, fr.q.replace(/\s*\([^)]*\)$/, '').replace('___', w));
          return L;
        };
        const L1 = one(p.fa, p.a, p.pa, LX + 26, 'da');
        one(p.fb, p.b, p.pb, Math.max(LX + 560, L1.x + L1.w + 50), 'db');
      });
    },

    /* 05 부사의 짝 (62) + 닮은꼴 hard · hardly, most · mostly */
    advs(g, u) {
      fade(g, ramp(u, 0.4, 0.5), () => {
        panel(g, LX, 148, 560, 412, { fill: COL.panel, stroke: COL.faint });
        txt(g, '짝이 정해진 부사', LX + 24, 178, { size: 17, weight: 700, color: COL.soft });
      });
      const rows = [
        { s: 'approximately 200 people', roles: { approximately: 'word', '200': 'pt', people: 'pt' }, ko: '약 200명 · 숫자 앞', at: 0.8 },
        { s: 'highly qualified', roles: { highly: 'word', qualified: 'pt' }, ko: '자격이 충분한 · highly recommended', at: 6.2 },
        { s: 'respond promptly', roles: { promptly: 'word', respond: 'pt' }, ko: '신속하게 답하다 · 동사 뒤', at: 12.2 },
        { s: 'shortly after the meeting', roles: { shortly: 'word', after: 'pt' }, ko: '회의 직후에 · after · before 앞', at: 14.2 },
      ];
      rows.forEach((r, k) => fade(g, ramp(u, r.at, 0.5), () => {
        const y = 226 + k * 86;
        phraseLine(g, r.s, r.roles, LX + 28, y, { size: 27, pre: 'a' + k });
        txt(g, r.ko, LX + 28, y + 34, { size: 16, weight: 500, color: COL.muted });
      }));
      fade(g, ramp(u, 17, 0.5), () => {
        panel(g, 660, 148, 540, 412, { fill: COL.panel, stroke: COL.trap });
        txt(g, '꼬리 하나로 뜻 · 자리가 달라지는 닮은꼴', 684, 178, { size: 17, weight: 700, color: COL.trap });
        phraseLine(g, 'worked hard', { hard: 'word', worked: 'pt' }, 690, 232, { size: 27, pre: 'h1' });
        txt(g, '= 열심히 일했다', 900, 232, { size: 19, weight: 700, color: COL.good });
        fade(g, ramp(u, 18.8, 0.5), () => {
          phraseLine(g, 'hardly worked', { hardly: 'trap', worked: 'pt' }, 690, 290, { size: 27, pre: 'h2' });
          txt(g, '= 거의 일하지 않았다', 900, 290, { size: 19, weight: 700, color: COL.trap });
          chip(g, '뜻이 정반대', 1180, 334, { size: 15, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'right', h: 30, r: 8 });
        });
      });
      fade(g, ramp(u, 22.6, 0.5), () => {
        g.fillStyle = COL.faint; g.fillRect(684, 362, 492, 1);
        phraseLine(g, 'most employees', { most: 'word', employees: 'pt' }, 690, 404, { size: 27, pre: 'm1' });
        txt(g, '= 대부분의 직원 · 명사 앞', 920, 404, { size: 17, weight: 600, color: COL.soft });
        fade(g, ramp(u, 24.2, 0.5), () => {
          phraseLine(g, 'were mostly students', { mostly: 'word', students: 'pt' }, 690, 470, { size: 27, pre: 'm2' });
          txt(g, '= 주로 학생이었다 · 부사', 690, 512, { size: 17, weight: 600, color: COL.soft });
        });
      });
    },

    /* 06 헷갈리는 동사 (63): 목적어가 있나 · 사람이 먼저 오나 · 방향 */
    confv(g, u) {
      const obj = S.obj;   // 'no' | 'yes' | null
      fade(g, ramp(u, 0.4, 0.5), () => {
        panel(g, LX, 146, 1120, 158, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'rise · raise', LX + 24, 174, { size: 17, weight: 700, color: COL.soft });
      });
      const line = (s, roles, y, at, which, note) => fade(g, ramp(u, at, 0.5), () => {
        if (obj === which) { rr(g, LX + 14, y - 24, 700, 48, 10); g.fillStyle = 'rgba(255,193,94,0.08)'; g.fill(); g.strokeStyle = COL.ans; g.lineWidth = 2; g.stroke(); }
        const L = phraseLine(g, s, roles, LX + 30, y, { size: 27, pre: 'r' + which });
        txt(g, note, LX + 30 + L.w + 22, y, { size: 16, weight: 700, color: which === 'yes' ? COL.cue : COL.muted });
        return L;
      });
      line('Prices rise every year.', { Prices: 'pt', rise: 'word' }, 216, obj === 'no' ? 0 : 6.2, 'no', '목적어 없음');
      fade(g, ramp(u, obj === 'yes' ? 0 : 8.6, 0.5), () => {
        const y = 272;
        if (obj === 'yes') { rr(g, LX + 14, y - 24, 700, 48, 10); g.fillStyle = 'rgba(255,193,94,0.08)'; g.fill(); g.strokeStyle = COL.ans; g.lineWidth = 2; g.stroke(); }
        const L = phraseLine(g, 'The company raises prices every year.', { raises: 'word', prices: 'cue' }, LX + 30, y, { size: 27, pre: 'ryes' });
        const v = byText(L, 'raises'), p = byText(L, 'prices');
        arc(g, v.x + v.w / 2, y - 20, p.x + p.w / 2, y - 20, 14, COL.cue, ramp(u, obj === 'yes' ? 0 : 9.4, 0.6));
        txt(g, '목적어 있음', L.x + L.w + 22, y, { size: 16, weight: 700, color: COL.cue });
      });
      fade(g, ramp(u, obj ? 0 : 10.4, 0.5), () => {
        txt(g, '목적어 없음 → rise (자동사)', 1176, 216, { size: 19, weight: 700, color: obj === 'yes' ? COL.dim : COL.ans, align: 'right' });
        txt(g, '목적어 있음 → raise (타동사)', 1176, 272, { size: 19, weight: 700, color: obj === 'no' ? COL.dim : COL.ans, align: 'right' });
      });
      // 아래 칸: 다른 쌍들
      const box = (x, y, w, h, at, title, fn) => fade(g, ramp(u, at, 0.6), () => {
        panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
        txt(g, title, x + 18, y + 24, { size: 16, weight: 700, color: COL.soft });
        fn(x, y);
      });
      box(LX, 318, 360, 154, 12.2, '놓다 · 놓여 있다', (x, y) => {
        phraseLine(g, 'The file lies on the desk.', { lies: 'word' }, x + 18, y + 68, { size: 19, pre: 'l1' });
        txt(g, 'lie → 목적어 없음', x + 18, y + 96, { size: 14, weight: 600, color: COL.muted });
        phraseLine(g, 'Lay the file on my desk.', { Lay: 'word', the: 'cue', file: 'cue' }, x + 18, y + 124, { size: 19, pre: 'l2' });
      });
      box(LX + 380, 318, 360, 154, 18.2, '말하다', (x, y) => {
        phraseLine(g, 'She told us that …', { told: 'word', us: 'cue' }, x + 18, y + 68, { size: 20, pre: 's1', sayText: 'She told us that the meeting was canceled.' });
        txt(g, 'tell + 사람 + 내용', x + 18, y + 96, { size: 14, weight: 600, color: COL.cue });
        phraseLine(g, 'She said that …', { said: 'word' }, x + 18, y + 124, { size: 20, pre: 's2', sayText: 'She said that the meeting was canceled.' });
        txt(g, 'say + 내용', x + 210, y + 124, { size: 14, weight: 600, color: COL.muted });
      });
      box(LX + 760, 318, 360, 154, 24.2, '빌리다', (x, y) => {
        const row = (w, ko, yy, dir) => {
          phraseLine(g, w, { [w]: 'word' }, x + 18, yy, { size: 22, pre: 'd' + w });
          const cx0 = x + 150, cx1 = x + 250;
          [['나', cx0], ['남', cx1]].forEach(([t, cx]) => { g.beginPath(); g.arc(cx, yy, 15, 0, Math.PI * 2); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = COL.line; g.lineWidth = 1.5; g.stroke(); txt(g, t, cx, yy + 1, { size: 14, weight: 700, align: 'center' }); });
          if (dir > 0) arrow(g, cx0 + 18, yy, cx1 - 18, yy, COL.ans, 2.4); else arrow(g, cx1 - 18, yy, cx0 + 18, yy, COL.ans, 2.4);
          txt(g, ko, x + 282, yy, { size: 15, weight: 600, color: COL.soft });
        };
        row('lend', '빌려주다', y + 66, 1);
        fade(g, ramp(u, 25.4, 0.5), () => row('borrow', '빌려 오다', y + 118, -1));
      });
      box(LX, 486, 550, 84, 28.2, '알려 주다 · 기억하다', (x, y) => {
        phraseLine(g, 'remind me to call', { remind: 'word', me: 'cue' }, x + 18, y + 56, { size: 20, pre: 'rm1' });
        phraseLine(g, 'remember to call', { remember: 'word' }, x + 290, y + 56, { size: 20, pre: 'rm2' });
      });
      box(LX + 570, 486, 550, 84, 29.6, '영향: 동사 · 명사', (x, y) => {
        phraseLine(g, 'may affect traffic', { affect: 'word', traffic: 'pt' }, x + 18, y + 56, { size: 20, pre: 'af1' });
        phraseLine(g, 'have an effect on', { effect: 'word' }, x + 290, y + 56, { size: 20, pre: 'af2' });
      });
    },

    /* 07 3단계 풀이법 흐름도 */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 짝 찾기', sub: '빈칸 가까이', at: 5.2, boxes: [['동사 빈칸', '→ 뒤의 목적어', 'v'], ['형용사 빈칸', '→ 꾸밈 받는 명사', 'adj'], ['부사 빈칸', '→ 숫자 · 형용사 · 동사', 'adv'], ['명사 빈칸', '→ 앞뒤의 덩어리', 'n']] },
        { x: 480, head: '② 짝 맞추기', sub: '함께 쓰는 말', at: 10.8, boxes: [['짝 사전에서 고르기', 'conduct + a survey', 'dict'], ['한국어 직역 금지', '하다 ≠ do', 'ko'], ['짝이 뜻을 정함', 'meet a deadline = 지키다', 'mean']] },
        { x: 880, head: '③ 함정 확인', sub: '한 번 더', at: 16.2, boxes: [['꼬리만 다른 닮은꼴', 'considerable · considerate', 'look'], ['뒤의 목적어 · 사람', 'rise · raise · say · tell', 'pat'], ['빌리는 방향 · 품사', 'lend · borrow · affect · effect', 'dir']] },
      ];
      const P = S.path, TRAP = { v: 'pat', adj: 'look', adv: 'look', n: null };
      const colOf = { v: COL.ans, adj: COL.pt, adv: COL.pt, n: COL.chunk, dict: COL.pt, ko: COL.trap, mean: COL.good, look: COL.trap, pat: COL.cue, dir: COL.ans };
      cols.forEach((c, ci) => fade(g, ramp(u, c.at, 0.6), () => {
        panel(g, c.x, 150, 340, 58, { fill: COL.panel2, stroke: COL.accent });
        txt(g, c.head, c.x + 20, 179, { size: 22, weight: 700, fam: FD, color: COL.accent });
        txt(g, c.sub, c.x + 320, 179, { size: 15, weight: 600, color: COL.muted, align: 'right' });
        c.boxes.forEach(([k, v, key], bi) => {
          const y = 222 + bi * 76, at = c.at + 0.5 + bi * 0.55;
          const on = P && ((ci === 0 && key === P) || (ci === 1 && key === 'dict') || (ci === 2 && key === TRAP[P]));
          fade(g, ramp(u, at, 0.5) * (P && !on ? 0.4 : 1), () => {
            panel(g, c.x, y, 340, 64, { fill: on ? 'rgba(255,193,94,0.14)' : COL.panel, stroke: on ? COL.ans : COL.faint, lw: on ? 2.5 : 1.5 });
            txt(g, k, c.x + 16, y + 21, { size: 16, weight: 700, color: COL.soft });
            txt(g, v, c.x + 16, y + 45, { size: 17, weight: 700, color: colOf[key] || COL.ans });
          });
        });
        if (ci < 2) fade(g, ramp(u, cols[ci + 1].at - 0.3, 0.5), () => arrow(g, c.x + 348, 179, c.x + 392, 179, COL.accent, 3));
      }));
      if (P) chip(g, { v: '동사 빈칸 → 목적어를 보고, 자동사 · 타동사도 확인', adj: '형용사 빈칸 → 꾸밈 받는 명사를 보고, 닮은꼴 확인', adv: '부사 빈칸 → 숫자 · 형용사 · 동사를 보고, 닮은꼴 확인', n: '명사 빈칸 → 앞뒤 덩어리를 통째로' }[P],
        W / 2, 548, { size: 19, weight: 700, color: COL.ans, fill: COL.panel2, stroke: COL.ans, align: 'center', h: 42, r: 10 });
    },

    /* 08 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 16.2, 32.2, 48];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = VC.DRILL[P.k], J = it.opts.map(o => VC.judge(o, it));
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, LX, 160, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const s1 = v >= P.at[0] + 0.6, s3 = v >= P.at[2] + 1.6;
        const cueWords = it.cue.join(' ').split(' '), sWords = (it.scue || []).join(' ').split(' ');
        const T = toks(it.q).map(tk => tk.r === 'blank' && s3 ? Object.assign(tk, { t: VC.show(it.opts[it.a]) }) : tk);
        const L = lay(g, T, { x: LX, y: 222, size: 30, maxW: 1120, lh: 52 });
        drawLay(g, L, tk => tk.r === 'blank' ? { glow: s1 && !s3 ? 0.6 : 0 } : s1 && cueWords.includes(tk.t) ? { r: 'pt' } : {});
        if (s1) {
          const bx = blankOf(L).x;
          fade(g, ramp(v, P.at[0] + 0.6, 0.5), () => boxAround(g, L, cueWords, COL.pt, { after: bx }));
        }
        if (v >= P.at[2] + 0.4 && it.scue) fade(g, ramp(v, P.at[2] + 0.4, 0.5), () => boxAround(g, L, sWords, COL.cue, { lw: 2.6 }));
        sayLay(L, it.q.replace('___', VC.show(it.opts[it.a])));
        const oy = L.lines > 1 ? 350 : 320;
        it.opts.forEach((o, k) => {
          const ox = LX + (k % 2) * 290, y = oy + Math.floor(k / 2) * 78;
          const right = k === it.a, goneAt = right ? 1e9 : P.at[J[k].step === 3 ? 2 : 1] + 1.2, gone = v >= goneAt, win = right && s3;
          txt(g, `(${'ABCD'[k]})`, ox, y, { size: 22, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const w = txt(g, VC.show(o), ox + 52, y, { size: 27, weight: win ? 700 : 600, color: win ? COL.good : gone ? COL.dim : COL.text });
          if (gone) strike(g, ox - 4, ox + w + 58, y + 1, clamp((v - goneAt) / 0.4));
          if (win) { panel(g, ox - 14, y - 26, w + 84, 52, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); mark(g, true, ox + w + 150, y, 18); }
        });
        panel(g, 660, oy - 40, 560, 230, { fill: COL.panel, stroke: COL.faint });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = oy - 2 + k * 70;
          txt(g, ['① 짝 찾기', '② 짝 맞추기', '③ 함정 확인'][k], 684, y, { size: 18, weight: 700, color: COL.accent });
          txt(g, ln, 684, y + 30, { size: 18, weight: 600, color: k === 2 ? COL.good : COL.soft });
        }));
      });
    },

    /* 09 정리 표 */
    summary(g, u) {
      const X = [80, 420, 690], Y0 = 150, RH = 50;
      const rows = [
        ['59 동사 + 목적어', '뒤의 목적어', 'conduct a survey · meet a deadline'],
        ['60 덩어리 표현', '앞뒤를 통째로', 'until further notice · in charge of'],
        ['61 닮은꼴 형용사', '꾸밈 받는 명사 · 뒤', 'a considerable amount · be reliant on'],
        ['62 부사의 짝', '숫자 · 형용사 · 동사', 'approximately 200 · highly qualified'],
        ['63 헷갈리는 동사', '목적어 · 사람 · 방향', 'raise prices · tell us that · lend me'],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 10, 1160, RH * (rows.length + 1) + 16, { fill: COL.panel, stroke: COL.faint });
        ['유형', '짝은 어디에', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 22, { size: 17, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 6, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.7, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 22;
        txt(g, r[0], X[0] + 20, y, { size: 19, weight: 700 });
        txt(g, r[1], X[1] + 20, y, { size: 19, weight: 700, color: COL.pt });
        txt(g, r[2], X[2] + 20, y, { size: 18, weight: 500, color: COL.en });
        say(X[2] + 14, y - 18, 520, 36, r[2].replace(/ · /g, ', '));
      }));
      const steps = ['① 짝 찾기', '② 짝 맞추기', '③ 함정 확인'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 6.5 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 534, { size: 20, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 48, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 534, c.x + c.w + 46, 534, COL.accent, 2.5);
        x = c.x + c.w + 58;
      }));
      fade(g, ramp(u, 16.2, 0.6), () => chip(g, '짝 카드로 매일 조금씩', 1200, 534, { size: 19, weight: 700, color: COL.pt, fill: COL.panel2, stroke: COL.pt, align: 'right', h: 48, r: 12, pad: 20 }));
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

  VS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[VS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, VS.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + Object.values(VC.LEX).map(L => L.w + L.ko + Object.keys(L.friends).join('') + Object.values(L.friends).join('')).join('') +
    VC.DRILL.map(d => d.q + d.opts.join('')).join('') + Object.values(VC.TYPES).map(t => t.name + t.short).join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←✓×?~=+-/:…‘’';
  VS.baseText = EXTRA;
  VS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = VS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { VS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
