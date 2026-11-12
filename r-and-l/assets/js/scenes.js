/* r · l, 혀끝이 닿느냐 마느냐 — 영상 장면과 자막 (RLS)
 * 그림은 시간 t와 사용자 상태(S)만의 함수예요. 낱말 속 r · l 글자 칠하기 · 한글 표기의 ㄹ · 자리는 규칙 엔진(RL)이 계산하고,
 * 입 그림은 공통 부품 EN.mouth(../shared/mouth.js)가 그려요.
 * 역할 색: r 소리(이 편의 첫째 소리) 노랑 · l 소리(짝 소리) 하늘 · 한국어식 소리(함정) 주황 · 넣지 말아야 할 으 분홍 점선
 */
(function () {
  'use strict';
  const RL = window.RL, M = window.EN.mouth;
  const RLS = (window.RLS = {});
  const W = 1280, H = 720;
  RLS.W = W; RLS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  RLS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    l: '#6EC8FF', r: '#FFC15E', ins: '#FF7AA8', weak: '#7FE0A8', str: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  RLS.COL = COL;
  const RCOL = { r: COL.r, l: COL.l };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (RLS.S = { pair: null, kword: null, pose: null, rshape: null, place: null, dword: null, loan: null, sent: null, voice: null });
  RLS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  RLS.hits = () => HITS;

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
  const fit = (g, s, size, maxW, weight = 600, min = 11, fam = FB) => { while (size > min && tw(g, s, size, weight, fam) > maxW) size -= 0.5; return size; };
  function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  function fade(g, a, fn) { if (a <= 0.001) return; g.save(); g.globalAlpha *= Math.min(1, a); fn(); g.restore(); }
  function arrowHead(g, x, y, ang, color, s = 11) {
    g.fillStyle = color; g.beginPath(); g.moveTo(x, y);
    g.lineTo(x - Math.cos(ang - 0.45) * s, y - Math.sin(ang - 0.45) * s);
    g.lineTo(x - Math.cos(ang + 0.45) * s, y - Math.sin(ang + 0.45) * s); g.closePath(); g.fill();
  }
  function arrow(g, x0, y0, x1, y1, color, lw = 2.5, dash) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; if (dash) g.setLineDash(dash);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - Math.cos(ang) * 8, y1 - Math.sin(ang) * 8); g.stroke(); g.setLineDash([]);
    arrowHead(g, x1, y1, ang, color);
  }
  function check(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x - s * 0.12, y + s * 0.4); g.lineTo(x + s * 0.55, y - s * 0.45); g.stroke();
  }
  function cross(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - s / 2, y - s / 2); g.lineTo(x + s / 2, y + s / 2); g.moveTo(x + s / 2, y - s / 2); g.lineTo(x - s / 2, y + s / 2); g.stroke();
  }
  RLS.check = check; RLS.cross = cross;
  function chip(g, s, x, y, o = {}) {
    const size = o.size || 18, w = tw(g, s, size, o.weight || 600, o.fam || FB) + (o.pad || 14) * 2, h = o.h || size * 2;
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    rr(g, x0, y - h / 2, w, h, o.r == null ? h / 2 : o.r);
    g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
    txt(g, s, x0 + w / 2, y + 1, { size, weight: o.weight || 600, color: o.color || COL.text, align: 'center', fam: o.fam });
    return { x: x0, y: y - h / 2, w, h };
  }
  const tag = (g, s, x, y, color, o = {}) => chip(g, s, x, y, Object.assign({ size: 16, weight: 700, color, fill: COL.panel2, stroke: color, h: 34, r: 10 }, o));
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
  }
  const circ = (g, x, y, r, fill) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };
  const ring = (g, x, y, r, color, lw = 2, dash) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.strokeStyle = color; g.lineWidth = lw; if (dash) g.setLineDash(dash); g.stroke(); g.setLineDash([]); };
  // 누르면 들려줌: seq = [{ text, sp }]
  const listen = (x, y, w, h, seq) => HITS.push({ x, y, w, h, play: seq });
  const hex = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  RLS.hex = hex;

  /* ---------- 아이콘 — 24×24 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요 ---------- */
  const ICON = {
    spk: [['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'f'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
    ear: [['M7.5 9.5a4.5 4.5 0 1 1 9 0c0 3.1-3 3.7-3 6.6a2.7 2.7 0 0 1-5.1 1.1'], ['M10.5 10a1.6 1.6 0 1 1 3 .9']],
    mouth: [['M3.5 12c2.6-3.2 5.3-4.4 8.5-4.4s5.9 1.2 8.5 4.4c-2.6 3.2-5.3 4.4-8.5 4.4S6.1 15.2 3.5 12z'], ['M3.5 12h17']],
    text: [['M4 6.5h16M4 10.5h16M4 14.5h11M4 18.5h7']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z'], ['M6 11a6 6 0 0 0 12 0'], ['M12 17v3.5M9 20.5h6']],
    tongue: [['M5 6.5h14'], ['M6.5 6.5c0 7 2 12 5.5 12s5.5-5 5.5-12'], ['M12 9.5v5']],
  };
  RLS.ICON = ICON;
  const P2D = {};
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const k = size / 24;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    (ICON[id] || []).forEach(([d, m]) => { const p = P2D[d] || (P2D[d] = new Path2D(d)); if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  RLS.icon = icon;
  RLS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;
  // 소리 물결 (낱말 옆: 누르면 들린다는 표시)
  function waves(g, x, y, color, a = 1, ph = 0) {
    fade(g, a, () => {
      g.strokeStyle = color; g.lineWidth = 2.2; g.lineCap = 'round';
      [7, 13].forEach((r, i) => { g.globalAlpha *= 0.55 + 0.45 * Math.max(0, Math.sin(ph * 5 - i)); g.beginPath(); g.arc(x, y, r, -0.7, 0.7); g.stroke(); });
    });
  }

  /* ---------- 입 그림 (EN.mouth) ---------- */
  const MLAB = ['윗잇몸', '센입천장', '여린입천장', '혀끝', '혀 뒤', '입술', '목(성대)'];
  const mfont = (sz, w) => fnt(sz, w || 600);
  function mouth(g, x, y, s, pose, o = {}) {
    if (REC) MLAB.forEach(m => REC.add(m));
    return M.draw(g, x, y, s, pose, Object.assign({ font: mfont }, o));
  }
  RLS.mouth = mouth;
  RLS.mtop = (g, x, y, s, pose, o = {}) => M.top(g, x, y, s, pose, o);
  RLS.mlips = (g, x, y, s, pose, o = {}) => M.lips(g, x, y, s, pose, o);
  // 톡 치는 ㄹ: 혀끝이 아주 잠깐 닿았다 떨어짐 (나라)
  const flapK = u => { const c = (u % 1.6) / 1.6; return c < 0.35 ? ease(c / 0.35) : c < 0.45 ? 1 : 1 - ease(clamp((c - 0.45) / 0.3)); };

  /* ---------- 낱말 · 한글 · 문장 그리기 ---------- */
  // 영어 낱말: r · l 소리를 적은 글자만 칠하고 밑줄. o.only = 'r' | 'l'이면 그 소리만
  function word(g, w, x, y, size, o = {}) {
    const wt = o.weight || 700, sp = RL.spans(w).filter(s => !s.bad);
    const total = tw(g, w, size, wt);
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx;
    let at = 0;
    const seg = (a, b, ph) => {
      const t = w.slice(a, b); if (!t) return;
      const on = ph && o.paint !== false && (!o.only || o.only === ph);
      const c = on ? RCOL[ph] : (o.base || COL.text);
      const ww = txt(g, t, xx, y, { size, weight: wt, color: c });
      if (on) { g.fillStyle = c; g.fillRect(xx, y + size * 0.56, ww, Math.max(2.5, size * 0.065)); }
      xx += ww;
    };
    sp.forEach(s => { seg(at, s.s, null); seg(s.s, s.e, s.ph); at = s.e; });
    seg(at, w.length, null);
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, total + 16, size * 1.45, [{ text: w, sp: o.sp || 'tc' }]);
    return { x: x0, w: total };
  }
  RLS.word = word;
  // 한글 표기: ㄹ이 적은 영어 소리(r 노랑 · l 하늘), o.trap이면 모두 주황(한국어식 소리), o.ins면 넣은 으 음절에 분홍 점선 상자
  function koWord(g, w, x, y, size, o = {}) {
    const e = RL.entry(w), ko = o.ko || (e && e.ko) || '';
    const marks = o.ko ? [] : RL.koMarks(w), ins = o.ins && !o.ko ? RL.koInserted(w) : [];
    const chars = [...ko], wt = o.weight || 700, total = tw(g, ko, size, wt);
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx;
    chars.forEach((ch, i) => {
      const m = marks[i], c = o.trap ? COL.trap : m ? RCOL[m] : (o.base || COL.soft);
      const ww = txt(g, ch, xx, y, { size, weight: wt, color: c });
      if (m && !o.trap && o.under !== false) { g.fillStyle = c; g.fillRect(xx + 1, y + size * 0.58, ww - 2, 2.5); }
      if (ins.indexOf(i) >= 0) { rr(g, xx - 3, y - size * 0.62, ww + 6, size * 1.24, 6); g.strokeStyle = COL.ins; g.lineWidth = 2; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]); }
      xx += ww;
    });
    if (o.hit !== false && ko) listen(x0 - 8, y - size * 0.7, total + 16, size * 1.45, [{ text: ko, sp: 'ko' }]);
    return { x: x0, w: total };
  }
  RLS.koWord = koWord;
  // 문장: r · l 소리를 적은 글자만 칠함
  function sentence(g, text, x, y, size, o = {}) {
    const segs = RL.segs(text), wt = o.weight || 600;
    let total = 0; segs.forEach(s => { total += tw(g, s.t, size, s.ph ? 700 : wt); });
    const sz = o.maxW && total > o.maxW ? size * o.maxW / total : size;
    if (sz !== size) { total = 0; segs.forEach(s => { total += tw(g, s.t, sz, s.ph ? 700 : wt); }); }
    let xx = o.align === 'center' ? x - total / 2 : x;
    const x0 = xx, pos = {};
    segs.forEach(s => {
      const on = s.ph && (!o.only || o.only === s.ph), c = on ? RCOL[s.ph] : (o.base || COL.text);
      const ww = txt(g, s.t, xx, y, { size: sz, weight: s.ph ? 700 : wt, color: c });
      if (on) { g.fillStyle = c; g.fillRect(xx, y + sz * 0.56, ww, 2.5); }
      if (s.w && pos[s.w] == null) pos[s.w] = xx;
      xx += ww;
    });
    if (o.hit !== false) listen(x0 - 8, y - sz * 0.75, total + 16, sz * 1.5, [{ text, sp: o.sp || 'tc' }]);
    return { x: x0, w: total, size: sz, pos };
  }
  RLS.sentence = sentence;
  // 음절 상자: items = [{ t, ins, color }]
  function sylRow(g, items, x, y, o = {}) {
    const size = o.size || 26, gap = 8;
    let xx = x;
    items.forEach(it => {
      const w = Math.max(54, tw(g, it.t, size, 700) + 26), h = size * 1.9;
      rr(g, xx, y - h / 2, w, h, 10);
      g.fillStyle = it.ins ? hex(COL.ins, 0.08) : COL.panel2; g.fill();
      g.strokeStyle = it.ins ? COL.ins : (it.color || COL.line); g.lineWidth = 2; if (it.ins) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
      txt(g, it.t, xx + w / 2, y + 1, { size, weight: 700, color: it.ins ? COL.ins : (it.color || COL.text), align: 'center' });
      xx += w + gap;
    });
    return xx - gap - x;
  }
  // 영어 낱말 하나 = 음절 상자 (모음 수만큼 나누지 않고, 한 음절 낱말만 씀)
  function koSyl(w) {
    const e = RL.entry(w), ins = RL.koInserted(w), marks = RL.koMarks(w);
    return [...(e.ko || '')].map((ch, i) => ({ t: ch, ins: ins.indexOf(i) >= 0, color: ins.indexOf(i) >= 0 ? null : marks[i] ? RCOL[marks[i]] : COL.trap }));
  }

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호는 자막에 쓰지 않음
     영어 낱말 바로 뒤에 조사를 붙이지 않아요(소리 내어 읽을 때 어색해서) — → 나 ‘r 소리’로 이어요.
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: 'r · l, 혀끝이 닿느냐 마느냐', d: 26, caps: [
      [0.4, 5.5, '오른쪽 right, 빛 light. 한국어로 적으면 둘 다 라이트예요.'],
      [5.5, 11, '한국어의 ㄹ은 하나인데, 영어는 r 소리와 l 소리를 갈라요. 둘을 가르는 열쇠는 혀끝이에요.'],
      [11, 16.5, 'l 소리는 혀끝이 윗잇몸에 닿고, r 소리는 혀끝이 어디에도 닿지 않아요.'],
      [16.5, 22, '세 단계로 익혀요. 듣고 가르고, 입 모양을 만들고, 낱말과 문장 속에서 써요.'],
      [22, 26, '미국 표준 발음을 기준으로 해요. 소리는 모두 합성 음성이고, 지역마다 조금씩 달라요.'],
    ] },
    { id: 'listen', n: '01', title: '들어 보기 · 구별되나요?', sub: '① 듣고 가르기 · 짝 낱말 · 목소리 넷', d: 36, caps: [
      [0.4, 6, '먼저 귀부터 시험해요. 짝 낱말 둘은 소리 하나만 달라요 → right · light, read · lead.'],
      [6, 12, '화면의 낱말을 눌러 들어 보세요. 몇 번이든 다시 들을 수 있어요. 둘이 다르게 들리나요?'],
      [12, 18, '자음 뒤에 붙은 자리도 있어요 → grass · glass. 풀밭과 유리잔이에요.'],
      [18, 24, '낱말 가운데에도 있어요 → correct · collect. 바로잡다와 모으다예요.'],
      [24, 30, '잘 안 들려도 괜찮아요. 한국어에는 이 둘을 가르는 소리가 없어서, 처음에는 누구나 헷갈려요.'],
      [30, 36, '여러 목소리로 짝을 듣고 고르는 연습이 도움이 돼요. 아래 놀이터의 **듣고 가르기 훈련**이 그 연습이에요.'],
    ] },
    { id: 'korean', n: '02', title: '한국어 ㄹ의 두 얼굴', sub: '나라 = 톡 치는 ㄹ · 달라 = 대고 머무는 ㄹㄹ', d: 40, caps: [
      [0.4, 6, '한국어 ㄹ도 사실 두 가지예요. 나라의 ㄹ은 혀끝으로 윗잇몸을 톡 치고 지나가요.'],
      [6, 12, '달라의 ㄹㄹ은 혀끝을 윗잇몸에 대고 잠깐 머물러요. 공기는 혀의 양옆으로 나가요.'],
      [12, 18, '달라의 ㄹㄹ은 영어 l 소리와 아주 가까워요. 이미 할 줄 아는 소리예요.'],
      [18, 24.5, '나라의 톡 치는 ㄹ은 영어 r 소리도 l 소리도 아니에요. 미국 영어 water → 가운데 t가 이 소리예요.'],
      [24.5, 31, '라이트를 이 소리로 읽으면 r 소리와 l 소리가 하나로 합쳐져요. 낱말 처음이 가장 헷갈리는 까닭이에요.'],
      [31, 40, '오늘의 작전 → l 소리는 ㄹㄹ에서 가져오고, r 소리는 혀끝을 띄워서 새로 만들어요.'],
    ] },
    { id: 'l', n: '03', title: 'l 소리 만들기', sub: '② 입 모양 · 혀끝 → 윗잇몸 · 공기는 양옆 · 목 울림', d: 44, caps: [
      [0.4, 6, 'l 소리부터 만들어요. 혀끝을 윗니 바로 뒤, 볼록한 윗잇몸에 대요.'],
      [6, 12, '혀끝은 대고, 혀의 양옆은 내려요. 공기는 혀 양옆으로 빠져나가요.'],
      [12, 17.5, '목은 울려요. 목에 손을 대면 떨림이 느껴져요. 혀끝을 댄 채 을 하고 길게 소리 내 봐요.'],
      [17.5, 24, '요령 → 을 하고 혀끝을 댄 채로 라이트를 이어요. 을라이트 → light. 처음의 을은 점점 작게 줄여요.'],
      [24, 30, '혀끝이 닿았다 떨어지는 순간이 또렷하면 l 소리예요 → light · lead · long · lock · late.'],
      [30, 37, '혀끝으로 톡 치기만 하면 나라의 ㄹ이 돼요. l 소리는 아주 잠깐이라도 대고 있어요.'],
      [37, 44, '낱말 가운데의 l 소리는 쉬워요. 외래어 표기의 ㄹㄹ 그대로 → 벨리 belly, 젤리 jelly.'],
    ] },
    { id: 'r', n: '04', title: 'r 소리 만들기', sub: '② 입 모양 · 혀끝은 어디에도 닿지 않게 · 입술은 조금 둥글게', d: 46, caps: [
      [0.4, 6, 'r 소리는 혀끝이 어디에도 닿지 않아요. 닿는 순간 ㄹ이 돼요.'],
      [6, 12, '혀끝을 살짝 들어 뒤로 당기고, 혀 양옆은 위 어금니 안쪽에 붙여요. 공기는 혀 가운데로 나가요.'],
      [12, 17.5, '입술은 우 하듯 조금 둥글게 내밀어요. 목은 울려요.'],
      [17.5, 24, '요령 → 우 하고 입술을 모은 채, 혀끝을 띄우고 라이트를 이어요. 우라이트 → right.'],
      [24, 31, '혀 모양은 두 가지예요. 혀끝을 위로 마는 혀, 혀끝은 내리고 혀 몸통을 뭉쳐 올리는 혀. 둘 다 같은 r 소리가 나요.'],
      [31, 38, '편한 쪽을 쓰면 돼요. 공통점 → 혀끝이 닿지 않고, 혀 양옆이 어금니에 붙고, 입술이 조금 둥글어요.'],
      [38, 46, 'r 소리는 어둡고 둥글게 들려요. 우가 살짝 붙은 듯이 시작해요 → right · read · rock · wrong · rate.'],
    ] },
    { id: 'pair', n: '05', title: '짝 낱말로 가르기', sub: '낱말 처음 · right · light · read · lead · rice · lice', d: 42, caps: [
      [0.4, 6, '이제 짝으로 연습해요. 왼쪽은 r 소리, 오른쪽은 l 소리예요.'],
      [6, 12, 'right · light. r 소리는 입술을 모은 채 혀끝을 띄우고, l 소리는 혀끝을 댔다가 떼요.'],
      [12, 18, 'read · lead. 들을 때는 시작을 들어요. r 소리는 우처럼 어둡게, l 소리는 혀가 떨어지며 밝게 시작해요.'],
      [18, 24, 'rock · lock, wrong · long. 입 모양을 먼저 만들고 소리를 내요.'],
      [24, 30, '꼭 갈라야 하는 짝 → rice · lice. 잘못 말하면 밥 대신 머릿니를 달라는 말이 돼요.'],
      [30, 36, 'road · load, rate · late, row · low. 낱말 처음은 ㄹ 하나로 합쳐지는 자리라 가장 많이 연습해요.'],
      [36, 42, '천천히 해도 괜찮아요. 입 모양이 맞으면 소리는 따라와요.'],
    ] },
    { id: 'place', n: '06', title: '묶음 · 가운데 자리와 외래어 표기', sub: '③ 낱말 속에서 · grass 그래스 · glass 글라스 · 으 넣지 않기', d: 44, caps: [
      [0.4, 6.5, '외래어 표기가 힌트가 돼요. 자음 뒤나 낱말 가운데에서는 l 소리를 ㄹㄹ로, r 소리를 ㄹ 하나로 적어요.'],
      [6.5, 12.5, 'glass → 글라스, grass → 그래스. play → 플레이, pray → 프레이. 받침 ㄹ이 하나 더 있으면 l 소리예요.'],
      [12.5, 18.5, '가운데도 같아요 → belly 벨리, berry 베리. collect 컬렉트, correct 커렉트.'],
      [18.5, 24.5, 'ㄹㄹ로 적힌 곳은 혀끝을 대고, ㄹ 하나로 적힌 곳은 혀끝을 띄워요.'],
      [24.5, 31, '함정 → 글라스처럼 자음 사이에 으를 넣으면, 한 음절 glass → 세 음절이 돼요.'],
      [31, 37.5, '혀끝을 미리 윗잇몸에 대 놓고 g를 소리 내면, 으가 끼어들지 않고 바로 l 소리로 넘어가요.'],
      [37.5, 44, '연구에서도 이 두 자리는 끝의 l 소리보다 덜 헷갈렸어요. 표기를 힌트로 쓰면 돼요.'],
    ] },
    { id: 'dark', n: '07', title: '끝의 l 소리 · 어두운 l', sub: '③ 낱말 속에서 · feel · milk · school · world · girl', d: 46, caps: [
      [0.4, 6, '낱말 끝의 l 소리는 모양이 달라요. 혀끝은 윗잇몸 쪽에 두고, 혀 뒤를 여린입천장 쪽으로 올려요.'],
      [6, 12, '그래서 우나 어처럼 어둡게 울려요. 이것을 어두운 l이라고 해요 → feel · school · ball.'],
      [12, 18, '한국어식 받침 ㄹ은 혀 뒤를 올리지 않아 밝게 들려요. 한국어 필은 짧게 끊기고, 영어 feel → 끝이 울려요.'],
      [18, 24.5, '함정 → milk → 밀크로 읽으면 끝에 으가 붙어 두 음절이 돼요. l 소리에서 바로 k로 넘어가요.'],
      [24.5, 30.5, 'film 필름, help 헬프, golf 골프도 같아요. 끝의 으를 지우고 한 음절로 말해요.'],
      [30.5, 38, '가장 어려운 낱말 → world · girl. r 모음에서 혀끝을 띄운 채 시작해, 끝에 혀끝을 윗잇몸으로 옮겨요.'],
      [38, 46, '월드로 읽으면 r 소리가 사라져요. l 소리까지 가지 않으면 → word. 연구에서도 이 자리가 가장 어려웠어요.'],
    ] },
    { id: 'loan', n: '08', title: '외래어 함정', sub: '③ 낱말 속에서 · 라디오 · 레몬 · 호텔 · 컬러 · 클래스', d: 42, caps: [
      [0.4, 6, '외래어는 한국어식 발음이 입에 붙어 있어 더 조심해요. 처음의 ㄹ부터 정해요.'],
      [6, 12, 'r 소리 → radio · robot · room. l 소리 → lemon · lens · love. 한국어로는 모두 같은 ㄹ로 시작해요.'],
      [12, 18, '끝이 어두운 l 소리 → hotel · level. 호텔의 밝은 받침 ㄹ과 달리 혀 뒤를 올려요.'],
      [18, 24, 'color 컬러, jelly 젤리, hello 헬로. ㄹㄹ로 적힌 곳은 혀끝을 대는 l 소리예요.'],
      [24, 30, 'class 클래스, film 필름, golf 골프, milk 밀크는 으를 넣지 않아요. 넷 다 한 음절이에요.'],
      [30, 36, 'r 소리가 둘 → restaurant. 첫소리도, 가운데 소리도 혀끝을 띄워요.'],
      [36, 42, '외래어를 영어로 말할 때는 한국어 표기를 잠시 잊고, 낱말마다 r 소리인지 l 소리인지 먼저 정해요.'],
    ] },
    { id: 'sentence', n: '09', title: '문장 속에서', sub: '③ 문장 속에서 · Turn right at the light. · It’s a small world.', d: 44, caps: [
      [0.4, 6, '문장 속에서는 소리가 빨리 지나가요. 먼저 r 소리와 l 소리가 어디 있는지 찾아요.'],
      [6, 12, 'Turn right at the light. 오른쪽은 입술을 모으고 혀끝을 띄워요. 빛은 혀끝을 대요.'],
      [12, 17, '칠한 글자만 r 소리와 l 소리예요. 맨 앞 낱말의 r은 r 모음이라 다른 편에서 다뤄요.'],
      [17, 23, 'Please correct my mistakes. 가운데 r 소리. I collect old coins. 가운데 l 소리와 끝의 어두운 l.'],
      [23, 29, 'Can I have a glass of water, please? 묶음의 l 소리가 둘이에요. 으를 넣지 않아요.'],
      [29, 35, "It's a small world. 끝의 어두운 l이 둘이에요. 마지막 낱말은 r 모음에서 l 소리로 옮겨 가요."],
      [35, 40, '처음에는 천천히, 입 모양을 지키며 말해요. 익숙해지면 빠르기를 올려요.'],
      [40, 44, '아래 **따라 말하기**에 문장 스물여덟 개가 있어요. 자리마다 일곱 문장이에요.'],
    ] },
    { id: 'summary', n: '10', title: '정리', sub: '3단계 발음법 · r 소리와 l 소리', d: 36, caps: [
      [0.4, 6, '정리해요. ① 듣고 가르기 → r 소리는 우처럼 어둡게, l 소리는 혀가 떨어지며 밝게 시작해요.'],
      [6, 12, '② 입 모양 → l 소리는 혀끝을 윗잇몸에 대고, r 소리는 혀끝을 띄우고 입술을 조금 둥글게.'],
      [12, 18, '③ 낱말 속 자리 → 처음은 합쳐지기 쉽고, 묶음과 가운데는 외래어 표기의 ㄹㄹ이 힌트예요.'],
      [18, 24, '끝은 어두운 l, 으는 넣지 않기. world · girl → r 모음에서 l 소리로.'],
      [24, 30, '목표는 원어민과 똑같은 소리가 아니라, 듣는 사람이 헷갈리지 않는 소리예요.'],
      [30, 36, '아래 **듣고 가르기 훈련**과 **내 발음 확인**에서 직접 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  RLS.CHAPTERS = CHAPTERS; RLS.CAPTIONS = CAPTIONS; RLS.END = END;
  RLS.POSTER = CHAPTERS.find(c => c.id === 'pair').t + 9;
  RLS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  RLS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 900, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 900, 800, 24, FD), weight: 800, fam: FD });
  }
  const gloss = w => (RL.entry(w) || {}).gloss || '';
  const ipa = w => RL.ipa(w);
  // 오른쪽 위 범례: r 소리 노랑 · l 소리 하늘
  function legend(g, a = 1) {
    fade(g, a, () => {
      tag(g, 'r 소리', 1200, 92, COL.r, { align: 'right', size: 15, h: 30 });
      tag(g, 'l 소리', 1108, 92, COL.l, { align: 'right', size: 15, h: 30 });
    });
  }
  // 오른쪽 칸: 위에서 본 혀 + 입술 앞모습 + 소리 카드 (03 · 04장)
  function sideViews(g, pose, ph, u, o = {}) {
    const c = RCOL[ph];
    RLS.mtop(g, 520, 150, 0.7, pose, { mark: c, t: u, air: o.air !== false });
    RLS.mlips(g, 680, 172, 0.78, pose, { tip: ph === 'l' });
    txt(g, '위에서 본 혀', 590, 322, { size: 15, weight: 600, color: COL.muted, align: 'center' });
    txt(g, '입술 앞모습', 758, 322, { size: 15, weight: 600, color: COL.muted, align: 'center' });
    panel(g, 900, 150, 300, 160, { fill: hex(c, 0.08), stroke: c });
    txt(g, ph, 960, 222, { size: 84, weight: 800, fam: FD, color: c, align: 'center' });
    const ct = M.contact(pose);
    txt(g, ct.touch ? '혀끝이 닿아요' : '혀끝이 닿지 않아요', 1100, 205, { size: 19, weight: 700, color: c, align: 'center' });
    txt(g, ct.touch ? ct.where : '입천장과 떨어져 있어요', 1100, 240, { size: 16, weight: 600, color: COL.soft, align: 'center' });
    txt(g, ph === 'l' ? '공기는 양옆으로' : '공기는 가운데로', 1100, 272, { size: 15, weight: 500, color: COL.muted, align: 'center' });
  }
  // 단계 목록 (03 · 04장)
  function stepList(g, list, u, x = 520, y = 365, gap = 46) {
    list.forEach(([at, s], i) => fade(g, ramp(u, at, 0.5), () => {
      circ(g, x + 14, y + i * gap, 14, COL.panel2);
      txt(g, String(i + 1), x + 14, y + i * gap + 1, { size: 15, weight: 800, color: COL.accent, align: 'center' });
      txt(g, s, x + 40, y + i * gap, { size: fit(g, s, 20, 640, 600), weight: 600, color: COL.text });
    }));
  }
  // 요령: 을— → 을라이트 → light
  function trick(g, pre, ko, en, x, y, c) {
    chip(g, pre, x, y, { size: 22, fill: hex(c, 0.12), stroke: c, color: c, align: 'left' });
    arrow(g, x + 92, y, x + 132, y, COL.muted, 2);
    chip(g, ko, x + 142, y, { size: 22, fill: COL.panel2, stroke: COL.line, color: COL.soft, align: 'left' });
    listen(x + 142, y - 22, 150, 44, [{ text: ko, sp: 'ko' }]);
    arrow(g, x + 316, y, x + 356, y, COL.muted, 2);
    word(g, en, x + 370, y, 36);
  }
  // 낱말 줄 (누르면 들려줌)
  function wordRow(g, list, x, y, size, step, o = {}) { list.forEach((w, i) => word(g, w, x + i * step, y, size, o)); }

  // 01장 짝 카드
  const LCARDS = [['right', 'light', '처음', 0.4], ['read', 'lead', '처음', 1.2], ['grass', 'glass', '묶음', 12], ['correct', 'collect', '가운데', 18]];
  // 05장 짝 차례 (낱말 처음)
  const PSEQ = [[0, 'right'], [12, 'read'], [18, 'rock'], [21, 'wrong'], [24, 'rice'], [30, 'road'], [32, 'rate'], [34, 'row']];
  RLS.PSEQ = PSEQ;
  // 06장 표
  const PROWS = [['glass', 'grass'], ['play', 'pray'], ['belly', 'berry'], ['collect', 'correct']];
  RLS.PROWS = PROWS;
  // 08장 외래어 칸 (줄: r 처음 · l 처음 · ㄹㄹ과 밝은 끝 l · 으 넣기)
  const LROWS = [['radio', 'robot', 'room', 'restaurant'], ['lemon', 'lens', 'love', 'level'], ['color', 'jelly', 'hello', 'hotel'], ['class', 'film', 'golf', 'milk']];
  const LAPPEAR = { radio: 6, robot: 6.3, room: 6.6, lemon: 7.6, lens: 7.9, love: 8.2, hotel: 12, level: 12.4, color: 18, jelly: 18.3, hello: 18.6, class: 24, film: 24.3, golf: 24.6, milk: 24.9, restaurant: 30 };
  RLS.LROWS = LROWS;
  // 09장 문장
  const SROWS = [
    { en: 'Turn right at the light.', pos: 'start', at: 6 },
    { en: 'Please correct my mistakes.', pos: 'mid', at: 17 },
    { en: 'I collect old coins.', pos: 'mid', at: 19.5 },
    { en: 'Can I have a glass of water, please?', pos: 'cluster', at: 23 },
    { en: "It's a small world.", pos: 'end', at: 29 },
  ];

  const SCENES = {
    /* 00 들어가며 */
    intro(g, u) {
      const A = 1 - ramp(u, 16.0, 0.6);
      fade(g, A * ramp(u, 0.4, 0.6), () => {
        word(g, 'right', 330, 205, 68, { align: 'center' });
        txt(g, `${ipa('right')} · ${gloss('right')}`, 330, 262, { size: 18, color: COL.muted, align: 'center' });
      });
      fade(g, A * ramp(u, 1.0, 0.6), () => {
        word(g, 'light', 950, 205, 68, { align: 'center' });
        txt(g, `${ipa('light')} · ${gloss('light')}`, 950, 262, { size: 18, color: COL.muted, align: 'center' });
      });
      fade(g, A * ramp(u, 2.2, 0.6) * (1 - 0.6 * ramp(u, 10.8, 0.5)), () => {
        arrow(g, 420, 285, 552, 322, COL.trap, 2.5, [6, 5]); arrow(g, 860, 285, 728, 322, COL.trap, 2.5, [6, 5]);
        panel(g, 540, 300, 200, 70, { fill: hex(COL.trap, 0.12), stroke: COL.trap });
        koWord(g, 'right', 640, 336, 34, { trap: true, align: 'center' });
        txt(g, '한국어로 적으면 둘 다', 640, 392, { size: 16, weight: 600, color: COL.muted, align: 'center' });
      });
      fade(g, A * win(u, 5.5, 11.2), () => {
        tag(g, 'r 소리', 330, 450, COL.r, { align: 'center', size: 20, h: 44 });
        tag(g, 'l 소리', 950, 450, COL.l, { align: 'center', size: 20, h: 44 });
        tag(g, 'ㄹ 하나', 640, 450, COL.trap, { align: 'center', size: 20, h: 44 });
        arrow(g, 590, 450, 410, 450, COL.muted, 2); arrow(g, 690, 450, 870, 450, COL.muted, 2);
        txt(g, '혀끝이 열쇠', 640, 510, { size: 20, weight: 700, color: COL.text, align: 'center' });
      });
      fade(g, A * ramp(u, 11, 0.6), () => {
        mouth(g, 210, 296, 0.58, 'r', { mark: COL.r });
        mouth(g, 838, 296, 0.58, 'l', { mark: COL.l });
        txt(g, '혀끝이 닿지 않아요', 326, 528, { size: 19, weight: 700, color: COL.r, align: 'center' });
        txt(g, '혀끝이 윗잇몸에 닿아요', 954, 528, { size: 19, weight: 700, color: COL.l, align: 'center' });
      });
      const steps = [['ear', '① 듣고 가르기', '짝 낱말이 다르게 들리나'], ['mouth', '② 입 모양 만들기', '혀끝 · 혀 양옆 · 입술'], ['text', '③ 낱말 · 문장 속에서', '처음 · 묶음 · 가운데 · 끝']];
      steps.forEach(([ic, h, s], i) => fade(g, ramp(u, 16.6 + i * 0.6, 0.5), () => {
        const x = 110 + i * 360;
        panel(g, x, 200, 340, 190, { fill: COL.panel, stroke: COL.faint });
        circ(g, x + 170, 252, 30, COL.panel2); icon(g, ic, x + 170, 252, 32, COL.accent);
        txt(g, h, x + 170, 314, { size: 22, weight: 800, color: COL.text, align: 'center' });
        txt(g, s, x + 170, 352, { size: 16, weight: 500, color: COL.soft, align: 'center' });
      }));
      fade(g, ramp(u, 22, 0.5), () => {
        chip(g, '미국 표준 발음(General American) · 합성 음성 · 지역마다 조금씩 달라요', 640, 460, { size: 16, weight: 600, color: COL.muted, fill: COL.panel2, align: 'center' });
      });
    },

    /* 01 들어 보기 */
    listen(g, u) {
      LCARDS.forEach(([r, l, pos, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const x = i % 2 ? 660 : 100, y = i < 2 ? 150 : 316, hl = S.pair === r + '-' + l;
        panel(g, x, y, 520, 150, { fill: COL.panel, stroke: hl ? COL.accent : COL.faint, lw: hl ? 2.5 : 1.5 });
        tag(g, pos, x + 14, y + 26, COL.muted, { size: 14, h: 28, align: 'left' });
        word(g, r, x + 140, y + 78, 44, { align: 'center' });
        word(g, l, x + 380, y + 78, 44, { align: 'center' });
        txt(g, '↔', x + 260, y + 78, { size: 26, weight: 700, color: COL.muted, align: 'center' });
        txt(g, gloss(r), x + 140, y + 124, { size: 15, color: COL.muted, align: 'center' });
        txt(g, gloss(l), x + 380, y + 124, { size: 15, color: COL.muted, align: 'center' });
        const pulse = win(u, 6, 12) * (u < 12 ? 1 : 0);
        if (pulse > 0) { waves(g, x + 140 + tw(g, r, 44, 700) / 2 + 12, y + 78, COL.r, pulse, u + i); waves(g, x + 380 + tw(g, l, 44, 700) / 2 + 12, y + 78, COL.l, pulse, u + i + 0.5); }
      }));
      fade(g, win(u, 6, 12), () => {
        circ(g, 640, 500, 24, COL.panel2); icon(g, 'spk', 640, 500, 26, COL.accent);
        txt(g, '낱말을 누르면 들려요 · 같은 낱말을 곧바로 다시 누르면 천천히', 640, 548, { size: 17, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, ramp(u, 24.4, 0.5), () => {
        txt(g, '같은 짝, 목소리 넷', 640, 500, { size: 18, weight: 700, color: COL.soft, align: 'center' });
        RL.VOICES.forEach((v, i) => {
          const x = 250 + i * 260, hl = S.voice === v.sp;
          const c = chip(g, v.ko, x, 548, { size: 17, fill: COL.panel2, stroke: hl ? COL.accent : COL.line, align: 'center', pad: 34 });
          icon(g, 'spk', c.x + 20, 548, 18, COL.accent);
          listen(c.x, c.y, c.w, c.h, [{ text: 'right', sp: v.sp }, { text: 'light', sp: v.sp, gap: 0.6 }]);
        });
      });
    },

    /* 02 한국어 ㄹ의 두 얼굴 */
    korean(g, u) {
      const hk = S.kword;
      fade(g, ramp(u, 0.4, 0.5), () => {
        const x0 = 310 - tw(g, '나라', 50, 800) / 2;
        txt(g, '라', x0 + txt(g, '나', x0, 182, { size: 50, weight: 800, color: COL.text }), 182, { size: 50, weight: 800, color: COL.trap });
        listen(240, 150, 140, 64, [{ text: '나라', sp: 'ko' }]);
        const k = hk === 'll' ? 0 : flapK(u);
        mouth(g, 186, 222, 0.62, M.mix('a', 'flap', k), { mark: COL.trap });
        txt(g, '톡 치고 지나가요 · 아주 짧게', 310, 470, { size: 19, weight: 700, color: COL.trap, align: 'center' });
        if (hk === 'flap') ring(g, 310, 340, 175, COL.accent, 2.5, [8, 6]);
      });
      fade(g, ramp(u, 6, 0.5), () => {
        txt(g, '달라', 960, 182, { size: 50, weight: 800, color: COL.l, align: 'center' });
        listen(890, 150, 140, 64, [{ text: '달라', sp: 'ko' }]);
        mouth(g, 836, 222, 0.62, 'l', { mark: COL.l, air: 'side', t: u });
        txt(g, '대고 머물러요 · 공기는 양옆으로', 960, 470, { size: 19, weight: 700, color: COL.l, align: 'center' });
        if (hk === 'll') ring(g, 960, 340, 175, COL.accent, 2.5, [8, 6]);
      });
      fade(g, win(u, 12, 31.2), () => tag(g, '≈ 영어 l 소리', 960, 518, COL.l, { align: 'center', size: 18, h: 40 }));
      fade(g, win(u, 18, 31.2), () => {
        tag(g, 'r 소리도 l 소리도 아니에요', 310, 518, COL.trap, { align: 'center', size: 18, h: 40 });
        txt(g, '미국 영어 water의 t가 이 소리', 310, 558, { size: 15, weight: 500, color: COL.muted, align: 'center' });
      });
      fade(g, win(u, 24.5, 31.2), () => {
        word(g, 'right', 600, 518, 24, { align: 'right' }); txt(g, '·', 612, 518, { size: 22, color: COL.muted, align: 'center' }); word(g, 'light', 624, 518, 24);
        arrow(g, 640, 540, 640, 570, COL.trap, 2);
        txt(g, '라이트', 690, 556, { size: 18, weight: 700, color: COL.trap });
      });
      fade(g, ramp(u, 31, 0.5), () => {
        tag(g, 'l 소리 ← 달라의 ㄹㄹ에서 가져오기', 330, 525, COL.l, { align: 'center', size: 19, h: 46 });
        tag(g, 'r 소리 ← 혀끝을 띄워 새로 만들기', 950, 525, COL.r, { align: 'center', size: 19, h: 46 });
      });
    },

    /* 03 l 소리 만들기 */
    l(g, u) {
      const pose = S.pose === 'flap' ? 'flap' : 'l';
      fade(g, ramp(u, 0.3, 0.5), () => {
        mouth(g, 60, 150, 0.95, pose, { mark: COL.l, labels: u < 12 ? ['ridge', 'tip'] : ['ridge', 'tip', 'voice'], air: u >= 6 ? 'side' : null, voice: u >= 12 ? u : null, t: u });
        sideViews(g, pose, 'l', u);
      });
      stepList(g, [[0.4, '혀끝 → 윗니 바로 뒤, 볼록한 윗잇몸에 대요'], [6, '혀 양옆은 내려요 · 공기는 혀 양옆으로'], [12, '목을 울려요 · 혀끝을 댄 채 ‘을’']], u);
      fade(g, win(u, 17.5, 24.2), () => { trick(g, '을—', '을라이트', 'light', 520, 520, COL.l); txt(g, '처음의 을은 점점 작게', 1200, 520, { size: 16, weight: 600, color: COL.muted, align: 'right' }); });
      fade(g, win(u, 24, 30.2), () => wordRow(g, RL.SETS.lStart, 540, 520, 34, 136));
      fade(g, win(u, 30, 37.2), () => {
        txt(g, '나라의 ㄹ', 520, 500, { size: 17, weight: 700, color: COL.trap });
        panel(g, 640, 489, 60, 22, { fill: COL.trap, r: 6 }); txt(g, '톡', 712, 500, { size: 16, color: COL.muted });
        txt(g, 'l 소리', 520, 545, { size: 17, weight: 700, color: COL.l });
        panel(g, 640, 534, 260, 22, { fill: COL.l, r: 6 }); txt(g, '잠깐이라도 대고 있어요', 912, 545, { size: 16, color: COL.muted });
        txt(g, '혀끝이 닿아 있는 시간', 1200, 470, { size: 14, color: COL.dim, align: 'right' });
      });
      fade(g, ramp(u, 37, 0.5), () => {
        word(g, 'belly', 540, 520, 34); koWord(g, 'belly', 650, 520, 30);
        word(g, 'jelly', 860, 520, 34); koWord(g, 'jelly', 970, 520, 30);
        txt(g, 'ㄹㄹ = l 소리', 1200, 520, { size: 17, weight: 700, color: COL.l, align: 'right' });
      });
    },

    /* 04 r 소리 만들기 */
    r(g, u) {
      const pose = S.rshape === 'bunched' ? 'rb' : 'r', big = 1 - win(u, 24, 38, 0.6);
      fade(g, ramp(u, 0.3, 0.5) * big, () => {
        mouth(g, 60, 150, 0.95, pose, { mark: COL.r, labels: u < 12 ? ['ridge', 'tip', 'lips'] : ['ridge', 'tip', 'lips', 'voice'], air: u >= 6 ? 'center' : null, voice: u >= 12 ? u : null, t: u });
      });
      fade(g, win(u, 24, 38, 0.6), () => {
        mouth(g, 30, 160, 0.56, 'r', { mark: COL.r });
        mouth(g, 262, 160, 0.56, 'rb', { mark: COL.r });
        txt(g, '혀끝을 마는 혀', 142, 382, { size: 17, weight: 700, color: COL.r, align: 'center' });
        txt(g, '혀를 뭉쳐 올리는 혀', 374, 382, { size: 17, weight: 700, color: COL.r, align: 'center' });
        txt(g, '둘 다 같은 r 소리', 258, 418, { size: 16, weight: 600, color: COL.soft, align: 'center' });
        fade(g, ramp(u, 31, 0.5), () => ['혀끝이 닿지 않아요', '혀 양옆 → 위 어금니', '입술은 조금 둥글게'].forEach((s, i) => tag(g, s, 258, 462 + i * 44, COL.r, { align: 'center', size: 16, h: 34 })));
      });
      fade(g, ramp(u, 0.3, 0.5), () => sideViews(g, pose, 'r', u));
      stepList(g, [[0.4, '혀끝은 어디에도 닿지 않게 · 살짝 들어 뒤로'], [6, '혀 양옆 → 위 어금니 안쪽 · 공기는 가운데로'], [12, '입술은 우 하듯 조금 둥글게 · 목을 울려요']], u);
      fade(g, win(u, 17.5, 24.2), () => { trick(g, '우—', '우라이트', 'right', 520, 520, COL.r); txt(g, '입술을 모은 채', 1200, 520, { size: 16, weight: 600, color: COL.muted, align: 'right' }); });
      fade(g, ramp(u, 38, 0.5), () => wordRow(g, RL.SETS.rStart, 540, 520, 34, 136));
    },

    /* 05 짝 낱말로 가르기 */
    pair(g, u) {
      const fixed = S.pair ? RL.PAIRS.find(p => p.id === S.pair) : null;
      fade(g, ramp(u, 0.3, 0.5), () => {
        mouth(g, 80, 150, 0.62, 'r', { mark: COL.r });
        mouth(g, 952, 150, 0.62, 'l', { mark: COL.l });
        tag(g, 'r 소리', 204, 168, COL.r, { align: 'center', size: 15, h: 30 });
        tag(g, 'l 소리', 1076, 168, COL.l, { align: 'center', size: 15, h: 30 });
      });
      const showPair = (r, l, a) => fade(g, a, () => {
        const P = RL.pairOf(r);
        word(g, r, 204, 430, 54, { align: 'center' });
        word(g, l, 1076, 430, 54, { align: 'center' });
        txt(g, gloss(r), 204, 482, { size: 17, weight: 600, color: COL.soft, align: 'center' });
        txt(g, gloss(l), 1076, 482, { size: 17, weight: 600, color: COL.soft, align: 'center' });
        txt(g, ipa(r), 204, 515, { size: 17, fam: FM, color: COL.muted, align: 'center' });
        txt(g, ipa(l), 1076, 515, { size: 17, fam: FM, color: COL.muted, align: 'center' });
        txt(g, '↔', 640, 430, { size: 34, weight: 700, color: COL.muted, align: 'center' });
        if (P) tag(g, RL.POS[P.pos].long, 640, 485, COL.muted, { align: 'center', size: 14, h: 28 });
        koWord(g, r, 640, 530, 20, { trap: true, align: 'center' });
      });
      if (fixed) showPair(fixed.r, fixed.l, 1);
      else {
        PSEQ.forEach(([at, r], k) => {
          const nx = k + 1 < PSEQ.length ? PSEQ[k + 1][0] : 36;
          showPair(r, RL.partner(r), ramp(u, at + (k ? 0.1 : 0.4), 0.4) * (1 - ramp(u, nx - 0.3, 0.3)));
        });
      }
      const cueA = fixed ? 1 : ramp(u, 6, 0.5) * (1 - ramp(u, 35.7, 0.3));
      fade(g, cueA, () => {
        const hear = fixed || u >= 12;
        panel(g, 380, 210, 520, 150, { fill: COL.panel, stroke: COL.faint });
        txt(g, hear ? '① 들을 때 · 시작을 들어요' : '② 말할 때 · 입 모양부터', 640, 240, { size: 16, weight: 700, color: COL.muted, align: 'center' });
        txt(g, hear ? 'r 소리 → 우처럼 어둡게 시작' : 'r 소리 → 입술 모으고 혀끝 띄우기', 400, 286, { size: fit(g, 'r 소리 → 입술 모으고 혀끝 띄우기', 20, 480, 700), weight: 700, color: COL.r });
        txt(g, hear ? 'l 소리 → 혀가 떨어지며 밝게' : 'l 소리 → 혀끝을 댔다가 떼기', 400, 330, { size: fit(g, 'l 소리 → 혀끝을 댔다가 떼기', 20, 480, 700), weight: 700, color: COL.l });
      });
      if (!fixed) fade(g, ramp(u, 36, 0.5), () => {
        RL.PAIRS.filter(p => p.pos === 'start').forEach((p, i) => {
          const x = 400 + (i % 2) * 250, y = 240 + Math.floor(i / 2) * 64;
          panel(g, x, y - 24, 230, 48, { fill: COL.panel2, stroke: COL.faint, r: 12 });
          word(g, p.r, x + 62, y, 22, { align: 'center' }); txt(g, '·', x + 115, y, { size: 20, color: COL.muted, align: 'center' }); word(g, p.l, x + 168, y, 22, { align: 'center' });
        });
      });
    },

    /* 06 묶음 · 가운데 자리와 외래어 표기 */
    place(g, u) {
      const pick = S.place ? RL.PAIRS.find(p => p.id === S.place) : null;
      let rows = PROWS.map(x => x.slice());
      if (pick && !rows.some(rw => rw[0] === pick.l)) rows[3] = [pick.l, pick.r];
      fade(g, ramp(u, 0.4, 0.5), () => {
        panel(g, 100, 145, 520, 270, { fill: COL.panel, stroke: COL.faint });
        panel(g, 660, 145, 520, 270, { fill: COL.panel, stroke: COL.faint });
        tag(g, 'l 소리 → ㄹㄹ', 360, 172, COL.l, { align: 'center', size: 16, h: 32 });
        tag(g, 'r 소리 → ㄹ 하나', 920, 172, COL.r, { align: 'center', size: 16, h: 32 });
      });
      rows.forEach(([l, r], i) => fade(g, pick ? 1 : ramp(u, i < 2 ? 6.5 + i * 0.6 : 12.5 + (i - 2) * 0.6, 0.5), () => {
        const y = 222 + i * 52, hl = pick && (pick.l === l);
        if (hl) { panel(g, 108, y - 22, 504, 44, { fill: hex(COL.accent, 0.1), r: 10 }); panel(g, 668, y - 22, 504, 44, { fill: hex(COL.accent, 0.1), r: 10 }); }
        word(g, l, 130, y, 28); koWord(g, l, 330, y, 26);
        txt(g, RL.POS[RL.posOf(l)].ko, 600, y, { size: 14, weight: 600, color: COL.muted, align: 'right' });
        word(g, r, 690, y, 28); koWord(g, r, 890, y, 26);
        txt(g, RL.POS[RL.posOf(r)].ko, 1160, y, { size: 14, weight: 600, color: COL.muted, align: 'right' });
      }));
      fade(g, win(u, 18.5, 24.7), () => {
        tag(g, 'ㄹㄹ → 혀끝을 대요', 360, 470, COL.l, { align: 'center', size: 20, h: 46 });
        tag(g, 'ㄹ 하나 → 혀끝을 띄워요', 920, 470, COL.r, { align: 'center', size: 20, h: 46 });
      });
      fade(g, win(u, 24.5, 37.7), () => {
        word(g, 'glass', 150, 475, 34, { only: 'l' });
        sylRow(g, [{ t: 'glass', color: COL.l }], 270, 475, { size: 24 });
        txt(g, '1 음절', 330, 528, { size: 16, weight: 600, color: COL.muted, align: 'center' });
        arrow(g, 420, 475, 470, 475, COL.muted, 2);
        sylRow(g, koSyl('glass'), 490, 475, { size: 24 });
        txt(g, '3 음절', 590, 528, { size: 16, weight: 600, color: COL.ins, align: 'center' });
      });
      fade(g, win(u, 31, 37.7), () => {
        mouth(g, 760, 428, 0.4, 'l', { mark: COL.l });
        txt(g, '혀끝을 미리 윗잇몸에', 1060, 448, { size: 17, weight: 700, color: COL.l, align: 'center' });
        txt(g, '→ g → 바로 l 소리', 1060, 482, { size: 17, weight: 700, color: COL.soft, align: 'center' });
        cross(g, 960, 520, 14, COL.ins); txt(g, '으', 985, 520, { size: 18, weight: 700, color: COL.ins });
      });
      fade(g, ramp(u, 37.5, 0.5), () => {
        chip(g, '연구 → 묶음 · 가운데 자리는 끝의 l 소리보다 덜 헷갈렸어요', 640, 480, { size: 18, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '근거와 한계 → 페이지 아래 각주', 640, 528, { size: 15, color: COL.muted, align: 'center' });
      });
    },

    /* 07 끝의 l 소리 · 어두운 l */
    dark(g, u) {
      const focus = S.dword, rl = focus ? RL.posOf(focus) === 'rl' : u >= 30.5;
      // 왼쪽 입 그림: 어두운 l (world · girl은 r 모음 → 어두운 l을 오가며)
      fade(g, ramp(u, 0.3, 0.5), () => {
        let pose = 'dark';
        if (rl) { const c = (u % 2.4) / 2.4; pose = M.mix('rb', 'dark', c < 0.4 ? 0 : c < 0.75 ? ease((c - 0.4) / 0.35) : 1); }
        mouth(g, 60, 150, 0.9, pose, { mark: COL.l, labels: ['ridge', 'velum', 'tip', 'back'], voice: u });
        if (!rl) fade(g, ramp(u, 1.2, 0.5), () => { arrow(g, 60 + 236 * 0.9, 150 + 196 * 0.9, 60 + 240 * 0.9, 150 + 140 * 0.9, COL.str, 3); chip(g, '혀 뒤를 올려요', 60 + 300 * 0.9, 150 + 262 * 0.9, { size: 15, weight: 700, fill: COL.panel2, stroke: COL.str, color: COL.str, align: 'center' }); });
      });
      if (focus) {
        // 직접 해 보기: 고른 낱말 하나
        fade(g, 1, () => {
          word(g, focus, 820, 200, 60, { align: 'center' });
          txt(g, `${ipa(focus)} · ${gloss(focus)}`, 820, 256, { size: 18, color: COL.muted, align: 'center' });
          koWord(g, focus, 820, 320, 34, { trap: true, align: 'center' });
          txt(g, RL.POS[RL.posOf(focus)].long, 820, 362, { size: 16, weight: 600, color: COL.soft, align: 'center' });
          const ks = koSyl(focus), en = RL.syl(focus);
          txt(g, `영어 ${en} 음절`, 600, 440, { size: 17, weight: 700, color: COL.l });
          sylRow(g, [{ t: focus, color: COL.l }], 740, 440, { size: 22 });
          txt(g, `한국어식 ${ks.length} 음절`, 600, 510, { size: 17, weight: 700, color: ks.length > en ? COL.ins : COL.soft });
          sylRow(g, ks, 780, 510, { size: 22 });
        });
        return;
      }
      fade(g, 1 - ramp(u, 30.2, 0.4), () => {
        fade(g, ramp(u, 6, 0.5), () => {
          wordRow(g, ['feel', 'school', 'ball'], 560, 190, 40, 210);
          txt(g, '끝의 l 소리 = 어두운 l · 우나 어처럼 울려요', 560, 244, { size: 18, weight: 600, color: COL.soft });
        });
        fade(g, ramp(u, 12, 0.5), () => {
          panel(g, 540, 285, 300, 100, { fill: hex(COL.trap, 0.08), stroke: COL.trap });
          txt(g, '필', 600, 335, { size: 40, weight: 800, color: COL.trap, align: 'center' }); listen(560, 300, 80, 70, [{ text: '필', sp: 'ko' }]);
          txt(g, '받침 ㄹ · 밝고 짧게', 760, 335, { size: 16, weight: 600, color: COL.soft, align: 'center' });
          panel(g, 880, 285, 320, 100, { fill: hex(COL.l, 0.08), stroke: COL.l });
          word(g, 'feel', 950, 335, 36, { align: 'center' });
          txt(g, '어두운 l · 끝이 울려요', 1110, 335, { size: 16, weight: 600, color: COL.soft, align: 'center' });
        });
        fade(g, ramp(u, 18, 0.5), () => {
          word(g, 'milk', 560, 445, 34);
          sylRow(g, [{ t: 'milk', color: COL.l }], 660, 445, { size: 22 });
          arrow(g, 770, 445, 810, 445, COL.muted, 2);
          sylRow(g, koSyl('milk'), 825, 445, { size: 22 });
          txt(g, '1 음절 → 2 음절', 1200, 445, { size: 16, weight: 700, color: COL.ins, align: 'right' });
        });
        fade(g, ramp(u, 24.5, 0.5), () => ['film', 'help', 'golf'].forEach((w, i) => {
          const x = 560 + i * 215;
          word(g, w, x, 525, 28); koWord(g, w, x + tw(g, w, 28, 700) + 14, 525, 22, { ins: true, trap: true });
        }));
      });
      fade(g, ramp(u, 30.5, 0.5), () => {
        word(g, 'world', 640, 190, 52, { align: 'center' }); word(g, 'girl', 900, 190, 52, { align: 'center' }); word(g, 'pearl', 1110, 190, 40, { align: 'center' });
        const B = [['w', COL.soft, ''], ['ɝ', COL.r, 'r 모음 · 혀끝 띄움'], ['l', COL.l, '혀끝 → 윗잇몸'], ['d', COL.soft, '']];
        let x = 560;
        B.forEach(([s, c, lab], i) => {
          const w = 64;
          panel(g, x, 262, w, 64, { fill: COL.panel2, stroke: c });
          txt(g, s, x + w / 2, 294, { size: 30, weight: 700, fam: FM, color: c, align: 'center' });
          if (lab) txt(g, lab, x + w / 2, 350, { size: 14, weight: 600, color: c, align: 'center' });
          if (i < B.length - 1) arrow(g, x + w + 8, 294, x + w + 70, 294, COL.muted, 2);
          x += w + 78;
        });
      });
      fade(g, ramp(u, 38, 0.5), () => {
        tag(g, '월드 → r 소리가 사라져요', 560, 430, COL.trap, { size: 17, h: 38, align: 'left' });
        listen(560, 411, 260, 38, [{ text: '월드', sp: 'ko' }]);
        tag(g, 'l 소리까지 가지 않으면', 560, 490, COL.l, { size: 17, h: 38, align: 'left' });
        arrow(g, 790, 490, 840, 490, COL.muted, 2);
        word(g, 'word', 860, 490, 30);
        txt(g, '연구에서도 가장 어려운 자리', 1200, 540, { size: 15, weight: 600, color: COL.muted, align: 'right' });
      });
    },

    /* 08 외래어 함정 */
    loan(g, u) {
      LROWS.forEach((row, ri) => row.forEach((w, ci) => {
        const x = 80 + ci * 285, y = 150 + ri * 100, at = LAPPEAR[w], L = RL.LOAN.find(o => o.w === w), hl = S.loan === w;
        fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, at, 0.4)), () => panel(g, x, y, 265, 88, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }));
        fade(g, S.loan ? 1 : ramp(u, at, 0.5), () => {
          panel(g, x, y, 265, 88, { fill: COL.panel, stroke: hl ? COL.accent : COL.faint, lw: hl ? 2.5 : 1.5 });
          koWord(g, w, x + 16, y + 30, 24, { trap: true });
          word(g, w, x + 249, y + 30, fit(g, w, 26, 140, 700), { align: 'right' });
          tag(g, RL.TRAP[L.trap].ko, x + 16, y + 66, COL.trap, { size: 13, h: 26, align: 'left' });
          txt(g, ipa(w), x + 249, y + 66, { size: fit(g, ipa(w), 15, 140, 400, 11, FM), fam: FM, color: COL.muted, align: 'right' });
        });
      }));
    },

    /* 09 문장 속에서 */
    sentence(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      if (S.sent != null) {
        const s = RL.SENT[S.sent], c = RL.countIn(s.en);
        tag(g, RL.POS[s.pos].long, 640, 230, COL.muted, { align: 'center', size: 16, h: 32 });
        sentence(g, s.en, 640, 320, 44, { align: 'center', maxW: 1100 });
        txt(g, s.ko, 640, 390, { size: 20, weight: 600, color: COL.soft, align: 'center' });
        txt(g, `r 소리 ${c.r} · l 소리 ${c.l}`, 640, 450, { size: 18, weight: 700, color: COL.muted, align: 'center' });
        return;
      }
      SROWS.forEach((s, i) => fade(g, ramp(u, s.at, 0.5), () => {
        const y = 182 + i * 80, c = RL.countIn(s.en);
        tag(g, RL.POS[s.pos].ko, 80, y, COL.muted, { size: 14, h: 28, align: 'left' });
        const R = sentence(g, s.en, 190, y, 34, { maxW: 860 });
        txt(g, 'r ' + c.r, 1120, y, { size: 17, weight: 800, color: COL.r, align: 'right' });
        txt(g, 'l ' + c.l, 1200, y, { size: 17, weight: 800, color: COL.l, align: 'right' });
        if (i === 0) fade(g, win(u, 12, 17.2), () => {
          const x = R.pos.Turn != null ? R.pos.Turn : 190;
          arrow(g, x + 20, y + 52, x + 20, y + 26, COL.dim, 2);
          txt(g, 'r 모음 · 다른 편', x, y + 62, { size: 14, weight: 600, color: COL.muted });
        });
      }));
    },

    /* 10 정리 */
    summary(g, u) {
      const X = [80, 330, 765], Y0 = 145;
      fade(g, ramp(u, 0.3, 0.5), () => {
        panel(g, 60, Y0, 1160, 330, { fill: COL.panel, stroke: COL.faint });
        mouth(g, X[1] + 4, Y0 + 6, 0.24, 'r', { mark: COL.r });
        mouth(g, X[2] + 4, Y0 + 6, 0.24, 'l', { mark: COL.l });
        txt(g, 'r 소리', X[1] + 120, Y0 + 46, { size: 22, weight: 800, color: COL.r });
        txt(g, 'l 소리', X[2] + 120, Y0 + 46, { size: 22, weight: 800, color: COL.l });
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + 98, 1120, 1);
      });
      const rows = [
        ['① 듣고 가르기', '우처럼 어둡게 시작', '혀가 떨어지며 밝게 시작', 0.4],
        ['② 입 모양', '혀끝 띄움 · 양옆은 어금니 · 입술 둥글게', '혀끝 → 윗잇몸 · 공기는 양옆', 6],
        ['③ 낱말 속에서', '표기 ㄹ 하나 · (우)right', '표기 ㄹㄹ · 끝은 어두운 l · 으 없이', 12],
      ];
      rows.forEach(([h, r, l, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = Y0 + 140 + i * 66;
        txt(g, h, X[0] + 16, y, { size: 19, weight: 800, color: COL.text });
        txt(g, r, X[1] + 4, y, { size: fit(g, r, 18, 410, 600), weight: 600, color: COL.r });
        txt(g, l, X[2] + 4, y, { size: fit(g, l, 18, 430, 600), weight: 600, color: COL.l });
      }));
      fade(g, ramp(u, 18, 0.5), () => {
        RL.POS_ORDER.forEach((p, i) => {
          const x = 140 + i * 250, P = RL.POS[p], hard = p === 'start' || p === 'end' || p === 'rl';
          tag(g, `${P.ko} · ${P.kr}`, x, 515, hard ? COL.trap : COL.muted, { align: 'center', size: 15, h: 34 });
        });
      });
      fade(g, ramp(u, 24, 0.5), () => txt(g, '목표 = 듣는 사람이 헷갈리지 않는 소리', 640, 560, { size: 17, weight: 700, color: COL.soft, align: 'center' }));
    },
  };
  RLS.SCENES = SCENES;

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

  RLS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[RLS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, RLS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + RL.allText() + MLAB.join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔≈≠✓×?!~=+-–—/:…‘’\'%&<>|ɹɝɚəæɑɔɪʊʌɛŋθðʃʒˈˌ';
  RLS.baseText = EXTRA;
  RLS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = RLS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { RLS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
