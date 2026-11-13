/* 입술이 하는 일 — f · v · w — 영상 장면과 자막 (FVS)
 * 그림은 시간 t와 사용자 상태(S)만의 함수예요. 낱말 속 f · v · w · p · b 글자 칠하기 · 한글 표기 · 자리는 규칙 엔진(FV)이 계산하고,
 * 입 그림은 공통 부품 EN.mouth(../shared/mouth.js)가 그려요(f · v = 'f' 자세, w = 'w' 자세, p · b = 'p' 자세).
 * 역할 색: f · v · w 소리(이 편의 소리) 노랑 · p · b 소리(짝 소리) 하늘 · 한국어식 소리(함정) 주황 · 넣지 말아야 할 으 분홍 점선
 */
(function () {
  'use strict';
  const FV = window.FV, M = window.EN.mouth;
  const FVS = (window.FVS = {});
  const W = 1280, H = 720;
  FVS.W = W; FVS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  FVS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    a: '#FFC15E', b: '#6EC8FF', ins: '#FF7AA8', str: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  FVS.COL = COL;
  // 소리 → 색: f · v · w 노랑(이 편의 소리) · p · b 하늘(짝 소리) · 빠진 w(w0) 주황
  const PCOL = { f: COL.a, v: COL.a, w: COL.a, p: COL.b, b: COL.b, w0: COL.trap, a: COL.a };
  FVS.PCOL = PCOL;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (FVS.S = { pair: null, kpair: null, fpose: null, vvoice: null, wpose: null, pword: null, loan: null, sent: null, voice: null });
  FVS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  FVS.hits = () => HITS;

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
  function cross(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - s / 2, y - s / 2); g.lineTo(x + s / 2, y + s / 2); g.moveTo(x + s / 2, y - s / 2); g.lineTo(x - s / 2, y + s / 2); g.stroke();
  }
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
  // 누르면 들려줌: seq = [{ text, sp }]
  const listen = (x, y, w, h, seq) => HITS.push({ x, y, w, h, play: seq });
  const hex = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  FVS.hex = hex;

  /* ---------- 아이콘 — 24×24 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요 ---------- */
  const ICON = {
    spk: [['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'f'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
    ear: [['M7.5 9.5a4.5 4.5 0 1 1 9 0c0 3.1-3 3.7-3 6.6a2.7 2.7 0 0 1-5.1 1.1'], ['M10.5 10a1.6 1.6 0 1 1 3 .9']],
    mouth: [['M3.5 12c2.6-3.2 5.3-4.4 8.5-4.4s5.9 1.2 8.5 4.4c-2.6 3.2-5.3 4.4-8.5 4.4S6.1 15.2 3.5 12z'], ['M3.5 12h17']],
    text: [['M4 6.5h16M4 10.5h16M4 14.5h11M4 18.5h7']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z'], ['M6 11a6 6 0 0 0 12 0'], ['M12 17v3.5M9 20.5h6']],
    lips: [['M3.5 12c2.2-3 4.6-4.6 6.2-4.6 1 0 1.6.6 2.3.6s1.3-.6 2.3-.6c1.6 0 4 1.6 6.2 4.6-2.6 3.2-5.3 4.4-8.5 4.4S6.1 15.2 3.5 12z'], ['M7 12h10']],
  };
  FVS.ICON = ICON;
  const P2D = {};
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const k = size / 24;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    (ICON[id] || []).forEach(([d, m]) => { const p = P2D[d] || (P2D[d] = new Path2D(d)); if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  FVS.icon = icon;
  FVS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;
  // 소리 물결 (낱말 옆: 누르면 들린다는 표시)
  function waves(g, x, y, color, a = 1, ph = 0) {
    fade(g, a, () => {
      g.strokeStyle = color; g.lineWidth = 2.2; g.lineCap = 'round';
      [7, 13].forEach((r, i) => { g.globalAlpha *= 0.55 + 0.45 * Math.max(0, Math.sin(ph * 5 - i)); g.beginPath(); g.arc(x, y, r, -0.7, 0.7); g.stroke(); });
    });
  }

  /* ---------- 입 그림 (EN.mouth) ---------- */
  const MLAB = ['윗잇몸', '센입천장', '여린입천장', '혀끝', '혀 뒤', '입술', '목(성대)', '윗니', '아랫입술'];
  const mfont = (sz, w) => fnt(sz, w || 600);
  function mouth(g, x, y, s, pose, o = {}) {
    if (REC) MLAB.forEach(m => REC.add(m));
    return M.draw(g, x, y, s, pose, Object.assign({ font: mfont }, o));
  }
  FVS.mouth = mouth;
  FVS.mlips = (g, x, y, s, pose, o = {}) => M.lips(g, x, y, s, pose, o);
  // 소리 → 입 자세 · 목 울림 (엔진의 FV.MOUTH)
  const poseOf = ph => (FV.MOUTH[ph] || FV.MOUTH.f).pose;
  const voiced = ph => !!(FV.MOUTH[ph] || {}).voice;
  // w → 다음 모음으로 열리는 움직임(2.4초마다): 모은 입술 → 아 모음
  const wGlide = (u, to = 'a') => { const c = (u % 2.4) / 2.4; return M.mix('w', to, c < 0.4 ? 0 : c < 0.75 ? ease((c - 0.4) / 0.35) : 1); };
  // 입 모양 설명 (그림의 계산과 같은 결과)
  function lipLine(pose) {
    const lt = M.lipTeeth(pose);
    if (lt.touch) return '윗니가 아랫입술에 닿아요';
    if (M.lipsClosed(pose)) return '두 입술이 닫혀요';
    return '입술이 이에 닿지 않아요';
  }
  FVS.lipLine = lipLine;

  /* ---------- 낱말 · 한글 · 문장 그리기 ---------- */
  // 영어 낱말: f · v · w · p · b 소리를 적은 글자만 칠하고 밑줄. o.only = 'a'(f · v · w) | 'b'(p · b) · o.pos = 그 자리만
  function word(g, w, x, y, size, o = {}) {
    const e = FV.entry(w), shown = e ? e.w === e.key ? w : e.w : w;
    const wt = o.weight || 700, sp = FV.spans(w).filter(s => !s.bad);
    const total = tw(g, shown, size, wt);
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx;
    let at = 0;
    const seg = (a, b, s) => {
      const t = shown.slice(a, b); if (!t) return;
      const on = s && o.paint !== false && (!o.only || o.only === s.role) && (!o.pos || o.pos === s.pos);
      const c = on ? PCOL[s.ph] : (o.base || COL.text);
      const ww = txt(g, t, xx, y, { size, weight: wt, color: c });
      if (on) { g.fillStyle = c; g.fillRect(xx, y + size * 0.56, ww, Math.max(2.5, size * 0.065)); }
      xx += ww;
    };
    sp.forEach(s => { seg(at, s.s, null); seg(s.s, s.e, s); at = s.e; });
    seg(at, shown.length, null);
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, total + 16, size * 1.45, [{ text: shown, sp: o.sp || 'tc' }]);
    return { x: x0, w: total };
  }
  FVS.word = word;
  // 한글 표기: 한글이 적은 영어 소리(f · v · w 노랑 · p · b 하늘 · 빠진 w 주황), o.trap이면 모두 주황, o.ins면 넣은 으 음절에 분홍 점선 상자
  function koWord(g, w, x, y, size, o = {}) {
    const e = FV.entry(w), ko = o.ko || (e && e.ko) || '';
    const marks = o.ko ? [] : FV.koMarks(w), ins = o.ins && !o.ko ? FV.koInserted(w) : [];
    const chars = [...ko], wt = o.weight || 700, total = tw(g, ko, size, wt);
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx;
    chars.forEach((ch, i) => {
      const m = marks[i], c = o.trap ? COL.trap : m ? PCOL[m] : (o.base || COL.soft);
      const ww = txt(g, ch, xx, y, { size, weight: wt, color: c });
      if (m && !o.trap && o.under !== false) { g.fillStyle = c; g.fillRect(xx + 1, y + size * 0.58, ww - 2, 2.5); }
      if (ins.indexOf(i) >= 0) { rr(g, xx - 3, y - size * 0.62, ww + 6, size * 1.24, 6); g.strokeStyle = COL.ins; g.lineWidth = 2; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]); }
      xx += ww;
    });
    if (o.hit !== false && ko) listen(x0 - 8, y - size * 0.7, total + 16, size * 1.45, [{ text: ko, sp: 'ko' }]);
    return { x: x0, w: total };
  }
  FVS.koWord = koWord;
  // 문장: f · v · w · p · b 소리를 적은 글자만 칠함
  function sentence(g, text, x, y, size, o = {}) {
    const segs = FV.segs(text), wt = o.weight || 600;
    let total = 0; segs.forEach(s => { total += tw(g, s.t, size, s.ph ? 700 : wt); });
    const sz = o.maxW && total > o.maxW ? size * o.maxW / total : size;
    if (sz !== size) { total = 0; segs.forEach(s => { total += tw(g, s.t, sz, s.ph ? 700 : wt); }); }
    let xx = o.align === 'center' ? x - total / 2 : x;
    const x0 = xx, pos = {};
    segs.forEach(s => {
      const c = s.ph ? PCOL[s.ph] : (o.base || COL.text);
      if (s.w && pos[s.w] == null) pos[s.w] = xx;
      const ww = txt(g, s.t, xx, y, { size: sz, weight: s.ph ? 700 : wt, color: c });
      if (s.ph) { g.fillStyle = c; g.fillRect(xx, y + sz * 0.56, ww, 2.5); }
      if (s.w) pos[s.w + '_end'] = xx + ww;
      xx += ww;
    });
    if (o.hit !== false) listen(x0 - 8, y - sz * 0.75, total + 16, sz * 1.5, [{ text, sp: o.sp || 'tc' }]);
    return { x: x0, w: total, size: sz, pos };
  }
  FVS.sentence = sentence;
  // 음절 상자: items = [{ t, ins, color }]
  function sylRow(g, items, x, y, o = {}) {
    const size = o.size || 26, gap = 8;
    let xx = x;
    items.forEach(it => {
      const w = Math.max(50, tw(g, it.t, size, 700) + 24), h = size * 1.9;
      rr(g, xx, y - h / 2, w, h, 10);
      g.fillStyle = it.ins ? hex(COL.ins, 0.08) : COL.panel2; g.fill();
      g.strokeStyle = it.ins ? COL.ins : (it.color || COL.line); g.lineWidth = 2; if (it.ins) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
      txt(g, it.t, xx + w / 2, y + 1, { size, weight: 700, color: it.ins ? COL.ins : (it.color || COL.text), align: 'center' });
      xx += w + gap;
    });
    return xx - gap - x;
  }
  const sylW = (g, items, o = {}) => { const size = o.size || 26; return items.reduce((s, it) => s + Math.max(50, tw(g, it.t, size, 700) + 24) + 8, -8); };
  // 한국어식 음절 상자: 넣은 으는 분홍 점선, f · v · w · p · b를 적은 음절은 그 색, 나머지는 주황(한국어식)
  function koSyl(w) {
    const e = FV.entry(w), ins = FV.koInserted(w), marks = FV.koMarks(w);
    return [...(e.ko || '')].map((ch, i) => ({ t: ch, ins: ins.indexOf(i) >= 0, color: ins.indexOf(i) >= 0 ? null : marks[i] ? PCOL[marks[i]] : COL.trap }));
  }
  FVS.koSyl = koSyl;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(IPA)는 자막에 쓰지 않음
     영어 낱말 바로 뒤에 조사를 붙이지 않아요(소리 내어 읽을 때 어색해서) — → 나 ‘f 소리’로 이어요.
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '입술이 하는 일 — f · v · w', d: 30, caps: [
      [0.4, 6, '선풍기 fan, 냄비 pan. 한국어로 적으면 둘 다 팬이에요.'],
      [6, 11.5, '정말 very, 산딸기 berry → 둘 다 베리예요. 한국어에 f 소리와 v 소리가 없어서 생기는 일이에요.'],
      [11.5, 17.5, 'f · v 소리는 윗니를 아랫입술에 가볍게 대고 바람을 내요. p · b 소리는 두 입술을 닫았다가 터뜨려요.'],
      [17.5, 23.5, '세 단계로 익혀요. 듣고 가르고, 입 모양을 만들고, 낱말과 문장 속에서 써요.'],
      [23.5, 30, '미국 표준 발음을 기준으로 해요. 소리는 모두 합성 음성이고, 입 그림은 쉽게 줄여 그렸어요.'],
    ] },
    { id: 'listen', n: '01', title: '들어 보기 · 구별되나요?', sub: '① 듣고 가르기 · 짝 낱말 · 목소리 넷', d: 38, caps: [
      [0.4, 6, '먼저 귀부터 시험해요. 짝 낱말 둘은 소리 하나만 달라요 → fan · pan, very · berry.'],
      [6, 12, '화면의 낱말을 눌러 들어 보세요. 같은 낱말을 곧바로 다시 누르면 천천히 들려줘요.'],
      [12, 18, 'w 소리와 v 소리도 짝이 있어요 → wine · vine. 포도주와 포도나무예요.'],
      [18, 24.5, '낱말 끝에도 있어요 → leaf · leap. 뜻은 나뭇잎, 그리고 뛰어오르다예요.'],
      [24.5, 31, '한국 대학생의 듣기 연구에서도 p · f 사이, b · v 사이가 가장 헷갈렸어요. 처음에는 누구나 그래요.'],
      [31, 38, '여러 목소리로 짝을 듣고 고르는 연습이 도움이 돼요. 아래 놀이터의 **듣고 가르기 훈련**이 그 연습이에요.'],
    ] },
    { id: 'korean', n: '02', title: '한국어에는 없는 소리', sub: 'f → ㅍ · v → ㅂ · 팬 · 베리 · 밴', d: 40, caps: [
      [0.4, 6, '한국어에는 윗니와 아랫입술로 내는 소리가 없어요. 그래서 외래어 표기는 f 소리를 ㅍ으로 적어요.'],
      [6, 12, 'v 소리는 ㅂ으로 적어요. 그래서 fan · pan → 팬, very · berry → 베리, van · ban → 밴. 짝이 같은 표기가 돼요.'],
      [12, 18.5, 'ㅍ과 ㅂ은 두 입술을 닫았다가 터뜨리는 소리예요. 영어 p 소리, b 소리와 같은 자리예요.'],
      [18.5, 25, '그래서 팬이라고 말하면, 듣는 사람에게는 pan → 냄비로 들리기 쉬워요. 선풍기가 냄비가 돼요.'],
      [25, 32, 'w 소리는 한국어에도 비슷한 소리가 있어요 → 와 · 워 · 웨 · 위. 다만 우 앞에서는 w 소리를 빼고 적어요 → wood 우드.'],
      [32, 40, '오늘의 작전 → f · v 소리는 입술을 닫지 않고, w 소리는 입술을 먼저 모아요. 셋 다 입술이 하는 일이에요.'],
    ] },
    { id: 'f', n: '03', title: 'f 소리 — 윗니를 아랫입술에', sub: '② 입 모양 · 윗니 끝 → 아랫입술 · 바람은 계속', d: 46, caps: [
      [0.4, 6, 'f 소리부터 만들어요. 윗니 끝을 아랫입술 안쪽에 가볍게 얹어요. 깨물지는 않아요.'],
      [6, 12, '그 틈으로 바람을 길게 내보내요. 바람 새는 소리가 끊기지 않고 이어져요.'],
      [12, 18, '목은 울리지 않아요. 목에 손을 대도 떨림이 없어요. 바람 소리만 나요.'],
      [18, 24.5, 'p 소리는 달라요. 두 입술을 꼭 닫았다가 한 번에 톡 터뜨려요. 바람은 짧게 끝나요.'],
      [24.5, 31, '들을 때도 이것을 들어요. f 소리는 바람이 이어지고, p 소리는 막혔다가 터져요.'],
      [31, 38.5, '요령 → 윗니를 입술에 댄 채 바람을 먼저 내고, 그대로 모음으로 넘어가요 → fan · fine · feel · fork.'],
      [38.5, 46, '낱말 끝도 같아요 → leaf · laugh. 윗니를 입술에 댄 채 바람으로 끝내요. 으를 붙이지 않아요.'],
    ] },
    { id: 'v', n: '04', title: 'v 소리 — 같은 자리 + 목 울림', sub: '② 입 모양 · f 소리와 같은 입 · 목을 울려요', d: 42, caps: [
      [0.4, 6, 'v 소리는 f 소리와 입 모양이 똑같아요. 윗니 끝을 아랫입술에 가볍게 얹어요.'],
      [6, 12, '다른 점은 하나, 목을 울려요. 목에 손을 대면 떨림이 느껴져요. 입술도 간질간질 떨려요.'],
      [12, 18, '요령 → f 소리를 길게 내다가 목소리를 켜요. 바람 소리가 지잉 하는 떨리는 소리로 바뀌어요.'],
      [18, 24.5, 'b 소리는 두 입술을 닫았다가 터뜨려요. 한국어 ㅂ과 같은 자리예요. 베리라고 읽으면 → berry, 산딸기로 들려요.'],
      [24.5, 31, 'very → 윗니를 입술에 대고 떨림부터 시작해요. berry → 입술을 닫았다가 열면서 시작해요.'],
      [31, 37, '짝으로 들어 봐요 → vote · boat, vest · best, van · ban.'],
      [37, 42, '처음에는 과장해도 좋아요. 떨림을 길게 내다 보면 짧게 내는 것도 쉬워져요.'],
    ] },
    { id: 'w', n: '05', title: 'w 소리 — 입술을 먼저 모으고', sub: '② 입 모양 · 우 하듯 모았다가 다음 모음으로 · wood · woman · would', d: 50, caps: [
      [0.4, 6, 'w 소리는 입술이 이에 닿지 않아요. 우 하듯 입술을 동그랗게 모아 앞으로 내밀어요.'],
      [6, 12, '그리고 곧바로 다음 모음으로 입을 열어요. 모은 입술이 풀리는 움직임이 w 소리예요.'],
      [12, 18, '한국어 와 · 워 · 웨 · 위와 비슷해요 → wine 와인, water 워터, west 웨스트, win 윈.'],
      [18, 25, '함정은 우 앞이에요. wood · woman · would → 한국어식으로는 우드 · 우먼 · 우드. w 소리가 사라져요.'],
      [25, 32, '영어는 우 앞에서도 w 소리를 내요. 입술을 더 꼭 모았다가 살짝 풀면서 우 모음으로 넘어가요.'],
      [32, 38.5, '연구에서도 한국 학습자는 뒤 모음 앞의 w 소리를 빼거나 다른 소리로 바꾸곤 했어요. 귀로 먼저 가르는 연습이 중요해요.'],
      [38.5, 44.5, 'v 소리와도 갈라요. wine → 입술을 모았다가 풀고, vine → 윗니를 입술에 대고 떨려요.'],
      [44.5, 50, '참고로 wood · would → 소리가 같아요. 둘 다 입술을 모으고 시작해요.'],
    ] },
    { id: 'place', n: '06', title: '낱말 속 자리', sub: '③ 낱말 속에서 · 처음 · 묶음 · 가운데 · 끝', d: 44, caps: [
      [0.4, 6, '이제 낱말 속에서 써요. f · v · w 소리가 놓이는 자리는 넷이에요 → 처음, 묶음, 가운데, 끝.'],
      [6, 12, '처음 → fan · very · wine. 입 모양을 먼저 만들고 소리를 시작해요.'],
      [12, 18.5, '묶음 → fly · free. 윗니를 입술에 댄 채 바로 l 소리, r 소리로 넘어가요. 플라이처럼 으를 넣지 않아요.'],
      [18.5, 24.5, 'swim · twelve · quick → 앞 자음을 낼 때 이미 입술을 모아 두면 w 소리가 살아나요.'],
      [24.5, 31, '가운데 → coffee · seven · away. 모음 사이에서는 짧게 지나가요. 윗니가 입술에 닿는 순간을 지켜요.'],
      [31, 37.5, '끝 → leaf · five · love · golf. 한국어식으로는 끝에 으를 붙여요 → 리프 · 파이브 · 러브 · 골프.'],
      [37.5, 44, '영어는 윗니를 입술에 댄 채 끝내요. 끝 자음 이야기는 끝소리 튜토리얼에서 더 자세히 다뤄요.'],
    ] },
    { id: 'loan', n: '07', title: '외래어 함정', sub: '③ 낱말 속에서 · 커피 · 비디오 · 우드 · 와이파이', d: 44, caps: [
      [0.4, 6, '외래어는 한국어식 발음이 입에 붙어 있어 더 조심해요. 네 가지 함정을 봐요.'],
      [6, 12, 'f 소리 → ㅍ. coffee 커피, file 파일, fork 포크, golf 골프. 윗니를 입술에 대요.'],
      [12, 18, 'v 소리 → ㅂ. video 비디오, service 서비스, van 밴, love 러브. 윗니를 대고 목을 울려요.'],
      [18, 24.5, '우 앞의 w 소리 → 빠짐. wood 우드, woman 우먼, wool 울, wolf 울프. 입술을 먼저 모아요.'],
      [24.5, 31, '섞어서 → five, Wi-Fi, wave, favorite. 한 낱말에 두 소리가 들어 있어요.'],
      [31, 37.5, '모든 짝이 같은 표기가 되지는 않아요 → cup 컵, cuff 커프. 그래도 소리는 입 모양으로 갈라요.'],
      [37.5, 44, '외래어를 영어로 말할 때는 한국어 표기를 잠시 잊고, 낱말마다 입술이 할 일을 먼저 정해요.'],
    ] },
    { id: 'sentence', n: '08', title: '문장 속에서', sub: '③ 문장 속에서 · A cup of coffee, please.', d: 44, caps: [
      [0.4, 6, '문장 속에서는 소리가 빨리 지나가요. 먼저 f · v · w 소리가 어디 있는지 찾아요.'],
      [6, 12.5, 'A cup of coffee, please. 노란 글자가 f · v 소리, 하늘색 글자가 p 소리예요.'],
      [12.5, 18.5, '세 번째 낱말 of → 철자는 f지만 v 소리예요. 목을 울려요.'],
      [18.5, 25, 'My wife will wipe the table. 아내 wife → 바람으로 끝, 닦다 wipe → 입술을 닫으며 끝.'],
      [25, 31, "Wear a vest when it's cold. w 소리 둘, v 소리 하나. 입술을 모으고, 윗니를 대고, 다시 모아요."],
      [31, 37, 'Would you like some water? 우 앞의 w 소리도 빼지 않아요.'],
      [37, 44, '아래 **따라 말하기**에 문장 스물여덟 개가 있어요. f · v · w · 섞어서, 묶음마다 일곱 문장이에요.'],
    ] },
    { id: 'summary', n: '09', title: '정리', sub: '3단계 발음법 · f · v · w', d: 34, caps: [
      [0.4, 6, '정리해요. ① 듣고 가르기 → f · v 소리는 바람과 떨림이 이어지고, p · b 소리는 막혔다가 터져요.'],
      [6, 12, '② 입 모양 → f · v 소리는 윗니를 아랫입술에, w 소리는 입술을 둥글게 모았다가 풀어요.'],
      [12, 18, '③ 낱말 속에서 → 한국어식 ㅍ · ㅂ을 버리고, 끝에 으를 붙이지 않고, 우 앞의 w 소리를 살려요.'],
      [18, 24, '목표는 원어민과 똑같은 소리가 아니라, 듣는 사람이 헷갈리지 않는 소리예요.'],
      [24, 30, '입 그림은 쉽게 줄여 그린 것이에요. 거울을 보며 윗니가 입술에 닿는지 직접 확인해 보세요.'],
      [30, 34, '아래 **듣고 가르기 훈련**과 **내 발음 확인**에서 직접 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  FVS.CHAPTERS = CHAPTERS; FVS.CAPTIONS = CAPTIONS; FVS.END = END;
  FVS.POSTER = CHAPTERS.find(c => c.id === 'korean').t + 38.5;   // 짝 → 같은 표기 · 두 입 그림 · 우드 · 오늘의 작전이 한 화면에
  FVS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  FVS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 900, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 900, 800, 24, FD), weight: 800, fam: FD });
  }
  const gloss = w => (FV.entry(w) || {}).gloss || '';
  const ipa = w => FV.ipa(w);
  // 오른쪽 위 범례: f · v · w 노랑 · p · b 하늘
  function legend(g, a = 1) {
    fade(g, a, () => {
      tag(g, 'p · b 소리', 1200, 92, COL.b, { align: 'right', size: 15, h: 30 });
      tag(g, 'f · v · w 소리', 1078, 92, COL.a, { align: 'right', size: 15, h: 30 });
    });
  }
  // 오른쪽 칸: 입술 앞모습 + 소리 카드 (03 · 04 · 05장). ph = 'f' | 'v' | 'w' | 'p' | 'b' — 카드의 글은 그림의 계산(lipTeeth · lipsClosed)으로
  function sideViews(g, ph, pose) {
    const c = PCOL[ph];
    FVS.mlips(g, 540, 160, 0.95, pose);
    txt(g, '입술 앞모습', 635, 312, { size: 15, weight: 600, color: COL.muted, align: 'center' });
    panel(g, 780, 150, 420, 172, { fill: hex(c, 0.08), stroke: c });
    txt(g, ph, 846, 228, { size: 84, weight: 800, fam: FD, color: c, align: 'center' });
    const L = [lipLine(pose), voiced(ph) ? '목이 울려요' : '목은 울리지 않아요',
      ph === 'w' ? '곧바로 다음 모음으로 열려요' : ph === 'p' || ph === 'b' ? '막았다가 터뜨려요' : '바람이 이어져요'];
    txt(g, L[0], 1050, 196, { size: fit(g, L[0], 20, 280, 700), weight: 700, color: c, align: 'center' });
    txt(g, L[1], 1050, 236, { size: 17, weight: 600, color: COL.soft, align: 'center' });
    txt(g, L[2], 1050, 272, { size: 16, weight: 500, color: COL.muted, align: 'center' });
  }
  // 단계 목록 (03 · 04 · 05장)
  function stepList(g, list, u, a = 1, x = 520, y = 365, gap = 46) {
    fade(g, a, () => list.forEach(([at, s], i) => fade(g, ramp(u, at, 0.5), () => {
      circ(g, x + 14, y + i * gap, 14, COL.panel2);
      txt(g, String(i + 1), x + 14, y + i * gap + 1, { size: 15, weight: 800, color: COL.accent, align: 'center' });
      txt(g, s, x + 40, y + i * gap, { size: fit(g, s, 20, 640, 600), weight: 600, color: COL.text });
    })));
  }
  // 낱말 줄 (누르면 들려줌)
  function wordRow(g, list, x, y, size, step, o = {}) { list.forEach((w, i) => word(g, w, x + i * step, y, size, o)); }
  // 소리 막대: 바람이 이어지는 f · v (kind 'fric') · 막았다 터지는 p · b (kind 'stop') — 03 · 04장
  function soundBar(g, kind, x, y, w, color, voice, u) {
    const h = 34;
    if (kind === 'fric') {
      panel(g, x, y - h / 2, w, h, { fill: hex(color, 0.12), stroke: color, r: 8 });
      g.strokeStyle = color; g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k <= w - 20; k += 3) {
        const yy = voice ? Math.sin(k * 0.35 + u * 12) * 9 : ((Math.sin(k * 12.9898 + Math.floor(u * 20)) * 43758.5453) % 1) * 11;
        if (k === 0) g.moveTo(x + 10 + k, y + yy); else g.lineTo(x + 10 + k, y + yy);
      }
      g.stroke();
    } else {
      const cl = 110;
      panel(g, x, y - h / 2, cl, h, { fill: COL.panel2, stroke: COL.line, r: 8 });
      txt(g, '닫힘', x + cl / 2, y, { size: 14, weight: 700, color: COL.muted, align: 'center' });
      g.strokeStyle = color; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x + cl + 8, y + 16); g.lineTo(x + cl + 14, y - 22); g.lineTo(x + cl + 20, y + 16); g.stroke();
      panel(g, x + cl + 30, y - h / 2, w - cl - 30, h, { fill: hex(COL.soft, 0.08), stroke: COL.faint, r: 8 });
      txt(g, '모음', x + cl + 30 + (w - cl - 30) / 2, y, { size: 14, weight: 600, color: COL.muted, align: 'center' });
    }
  }

  // 01장 짝 카드
  const LCARDS = [['fan', 'pan', 0.4], ['very', 'berry', 1.2], ['wine', 'vine', 12], ['leaf', 'leap', 18]];
  // 02장 같은 표기 줄
  const KROWS = [['fan', 'pan', 6.2], ['very', 'berry', 7.4], ['van', 'ban', 8.6]];
  // 07장 외래어 칸 (줄: f → ㅍ · v → ㅂ · 우 앞 w · 섞어서)
  const LROWS = ['f', 'v', 'wu', 'mix'].map(t => FV.LOAN.filter(o => o.trap === t).map(o => o.w));
  const LAT = { f: 6, v: 12, wu: 18, mix: 24.5 };
  FVS.LROWS = LROWS;
  // 08장 문장
  const SROWS = [
    { en: 'A cup of coffee, please.', at: 6 },
    { en: 'My wife will wipe the table.', at: 18.5 },
    { en: "Wear a vest when it's cold.", at: 25 },
    { en: 'Would you like some water?', at: 31 },
  ];
  FVS.SROWS = SROWS;
  // 06장 자리 칸
  const PCOLS = [['start', 6], ['cluster', 12], ['mid', 24.5], ['end', 31]];
  // 소리 수 표시: 0이 아닌 것만 (f 2 · v 1 · p 1)
  function counts(g, c, x, y, size = 17) {
    let xx = x;
    ['p', 'b', 'w', 'v', 'f'].forEach(k => {   // 오른쪽 정렬이라 거꾸로
      if (!c[k]) return;
      const s = `${k} ${c[k]}`;
      txt(g, s, xx, y, { size, weight: 800, color: PCOL[k], align: 'right' });
      xx -= tw(g, s, size, 800) + 16;
    });
  }

  const SCENES = {
    /* 00 들어가며 */
    intro(g, u) {
      const A = 1 - ramp(u, 11.2, 0.5);
      const pairAt = (a, b, ap, dis) => fade(g, A * ramp(u, ap, 0.6) * (1 - ramp(u, dis, 0.4)), () => {
        word(g, a, 330, 205, 68, { align: 'center' });
        txt(g, `${ipa(a)} · ${gloss(a)}`, 330, 262, { size: 18, color: COL.muted, align: 'center' });
        word(g, b, 950, 205, 68, { align: 'center' });
        txt(g, `${ipa(b)} · ${gloss(b)}`, 950, 262, { size: 18, color: COL.muted, align: 'center' });
        arrow(g, 420, 285, 552, 322, COL.trap, 2.5, [6, 5]); arrow(g, 860, 285, 728, 322, COL.trap, 2.5, [6, 5]);
        panel(g, 540, 300, 200, 70, { fill: hex(COL.trap, 0.12), stroke: COL.trap });
        koWord(g, a, 640, 336, 34, { trap: true, align: 'center' });
        txt(g, '한국어로 적으면 둘 다', 640, 392, { size: 16, weight: 600, color: COL.muted, align: 'center' });
      });
      pairAt('fan', 'pan', 0.4, 5.8);
      pairAt('very', 'berry', 6.1, 99);
      fade(g, A * ramp(u, 7.5, 0.5), () => {
        tag(g, 'f 소리 → ㅍ', 440, 470, COL.a, { align: 'center', size: 18, h: 40 });
        tag(g, 'v 소리 → ㅂ', 640, 470, COL.a, { align: 'center', size: 18, h: 40 });
        tag(g, '한국어에 없는 소리', 840, 470, COL.trap, { align: 'center', size: 18, h: 40 });
      });
      fade(g, win(u, 11.5, 17.6), () => {
        mouth(g, 190, 150, 0.62, 'f', { lipMark: COL.a, air: 'center', t: u, labels: ['teeth', 'llip'] });
        mouth(g, 820, 150, 0.62, 'p', {});
        txt(g, 'f · v 소리 → 윗니가 아랫입술에', 314, 400, { size: 20, weight: 700, color: COL.a, align: 'center' });
        txt(g, '바람이 이어져요', 314, 434, { size: 17, weight: 600, color: COL.soft, align: 'center' });
        txt(g, 'p · b 소리 → 두 입술을 닫아요', 944, 400, { size: 20, weight: 700, color: COL.b, align: 'center' });
        txt(g, '막았다가 터뜨려요', 944, 434, { size: 17, weight: 600, color: COL.soft, align: 'center' });
        txt(g, '입 그림은 쉽게 줄인 그림이에요', 640, 520, { size: 15, weight: 500, color: COL.muted, align: 'center' });
      });
      const steps = [['ear', '① 듣고 가르기', '짝 낱말이 다르게 들리나'], ['mouth', '② 입 모양 만들기', '윗니 · 아랫입술 · 둥근 입술'], ['text', '③ 낱말 · 문장 속에서', '처음 · 묶음 · 가운데 · 끝']];
      steps.forEach(([ic, h, s], i) => fade(g, ramp(u, 17.6 + i * 0.6, 0.5), () => {
        const x = 110 + i * 360;
        panel(g, x, 200, 340, 190, { fill: COL.panel, stroke: COL.faint });
        circ(g, x + 170, 252, 30, COL.panel2); icon(g, ic, x + 170, 252, 32, COL.accent);
        txt(g, h, x + 170, 314, { size: 22, weight: 800, color: COL.text, align: 'center' });
        txt(g, s, x + 170, 352, { size: 16, weight: 500, color: COL.soft, align: 'center' });
      }));
      fade(g, ramp(u, 23.5, 0.5), () => {
        chip(g, '미국 표준 발음(General American) · 합성 음성 · 입 그림은 쉽게 줄여 그렸어요', 640, 460, { size: 16, weight: 600, color: COL.muted, fill: COL.panel2, align: 'center' });
      });
    },

    /* 01 들어 보기 */
    listen(g, u) {
      LCARDS.forEach(([a, b, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const x = i % 2 ? 660 : 100, y = i < 2 ? 150 : 316, P = FV.PAIRS.find(p => p.a === a && p.b === b), hl = S.pair === P.id;
        panel(g, x, y, 520, 150, { fill: COL.panel, stroke: hl ? COL.accent : COL.faint, lw: hl ? 2.5 : 1.5 });
        tag(g, FV.POS[P.pos].ko, x + 14, y + 26, COL.muted, { size: 14, h: 28, align: 'left' });
        tag(g, FV.KIND_KO[P.kind], x + 506, y + 26, COL.muted, { size: 14, h: 28, align: 'right' });
        word(g, a, x + 140, y + 80, 44, { align: 'center' });
        word(g, b, x + 380, y + 80, 44, { align: 'center' });
        txt(g, '↔', x + 260, y + 80, { size: 26, weight: 700, color: COL.muted, align: 'center' });
        txt(g, gloss(a), x + 140, y + 126, { size: 15, color: COL.muted, align: 'center' });
        txt(g, gloss(b), x + 380, y + 126, { size: 15, color: COL.muted, align: 'center' });
        const pulse = win(u, 6, 12) * (u < 12 ? 1 : 0);
        if (pulse > 0) { waves(g, x + 140 + tw(g, a, 44, 700) / 2 + 12, y + 80, COL.a, pulse, u + i); waves(g, x + 380 + tw(g, b, 44, 700) / 2 + 12, y + 80, PCOL[P.kind === 'wv' ? 'v' : 'p'], pulse, u + i + 0.5); }
      }));
      fade(g, win(u, 6, 12), () => {
        circ(g, 640, 500, 24, COL.panel2); icon(g, 'spk', 640, 500, 26, COL.accent);
        txt(g, '낱말을 누르면 들려요 · 같은 낱말을 곧바로 다시 누르면 천천히', 640, 548, { size: 17, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 24.5, 31.2), () => {
        chip(g, '듣기 연구 → p ↔ f, b ↔ v 사이가 가장 헷갈렸어요', 640, 512, { size: 19, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '한국 대학생 40명 · 근거와 한계 → 페이지 아래 각주', 640, 556, { size: 15, color: COL.muted, align: 'center' });
      });
      fade(g, ramp(u, 31, 0.5), () => {
        txt(g, '같은 짝, 목소리 넷', 640, 500, { size: 18, weight: 700, color: COL.soft, align: 'center' });
        FV.VOICES.forEach((v, i) => {
          const x = 250 + i * 260, hl = S.voice === v.sp;
          const c = chip(g, v.ko, x, 548, { size: 17, fill: COL.panel2, stroke: hl ? COL.accent : COL.line, align: 'center', pad: 34 });
          icon(g, 'spk', c.x + 20, 548, 18, COL.accent);
          listen(c.x, c.y, c.w, c.h, [{ text: 'fan', sp: v.sp }, { text: 'pan', sp: v.sp, gap: 0.6 }]);
        });
      });
    },

    /* 02 한국어에는 없는 소리 */
    korean(g, u) {
      const pick = S.kpair ? FV.pairById(S.kpair) : null;
      fade(g, ramp(u, 0.4, 0.5), () => {
        panel(g, 80, 145, 560, 270, { fill: COL.panel, stroke: COL.faint });
        tag(g, 'f 소리 → ㅍ', 230, 180, COL.a, { align: 'center', size: 18, h: 40 });
        tag(g, 'v 소리 → ㅂ', 470, 180, COL.a, { align: 'center', size: 18, h: 40 });
      });
      const rows = pick ? [[pick.a, pick.b, 0]] : KROWS;
      rows.forEach(([a, b, at], i) => fade(g, pick ? 1 : ramp(u, at, 0.5), () => {
        const y = 250 + i * 58;
        if (pick) panel(g, 92, y - 26, 536, 52, { fill: hex(COL.accent, 0.1), r: 10 });
        const A = word(g, a, 104, y, 30);
        txt(g, '·', A.x + A.w + 12, y, { size: 24, color: COL.muted, align: 'center' });
        word(g, b, A.x + A.w + 24, y, 30);
        arrow(g, 360, y, 410, y, COL.muted, 2);
        koWord(g, a, 424, y, 28, { trap: true });
        const same = FV.koSame(a, b);
        tag(g, same ? '같은 표기' : '다른 표기', 620, y, same ? COL.trap : COL.muted, { align: 'right', size: 14, h: 28 });
        if (!same) koWord(g, b, 500, y, 22, { trap: true });
      }));
      fade(g, ramp(u, 12, 0.5), () => {
        panel(g, 680, 145, 520, 270, { fill: COL.panel, stroke: COL.faint });
        mouth(g, 690, 152, 0.5, 'p', {});
        mouth(g, 945, 152, 0.5, 'f', { lipMark: COL.a });
        txt(g, 'ㅍ · ㅂ · p · b', 790, 352, { size: 18, weight: 700, color: COL.b, align: 'center' });
        txt(g, '두 입술을 닫아요', 790, 384, { size: 15, weight: 600, color: COL.soft, align: 'center' });
        txt(g, 'f · v', 1065, 352, { size: 18, weight: 700, color: COL.a, align: 'center' });
        txt(g, '윗니 + 아랫입술', 1065, 384, { size: 15, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 18.5, 25.2), () => {
        panel(g, 680, 440, 520, 120, { fill: hex(COL.trap, 0.06), stroke: COL.trap, dash: true });
        koWord(g, 'fan', 760, 490, 40, { trap: true, align: 'center' });
        txt(g, '이라고 말하면', 760, 534, { size: 14, color: COL.muted, align: 'center' });
        arrow(g, 830, 490, 900, 490, COL.muted, 2);
        circ(g, 930, 490, 22, COL.panel2); icon(g, 'ear', 930, 490, 24, COL.soft);
        arrow(g, 962, 490, 1010, 490, COL.muted, 2);
        word(g, 'pan', 1090, 490, 40, { align: 'center' });
        txt(g, '냄비로 들려요', 1090, 534, { size: 14, color: COL.b, align: 'center' });
      });
      fade(g, ramp(u, 25, 0.5), () => {
        panel(g, 680, 440, 520, 120, { fill: COL.panel, stroke: COL.faint });
        tag(g, '와 · 워 · 웨 · 위 ≈ w 소리', 940, 472, COL.a, { align: 'center', size: 16, h: 32 });
        word(g, 'wood', 800, 524, 30, { align: 'center' });
        arrow(g, 860, 524, 910, 524, COL.muted, 2);
        koWord(g, 'wood', 926, 524, 28);
        txt(g, '우 앞에서 w 소리가 빠져요', 1184, 524, { size: 15, weight: 600, color: COL.trap, align: 'right' });
      });
      fade(g, ramp(u, 32, 0.5), () => {
        tag(g, 'f · v 소리 → 입술을 닫지 않아요', 360, 470, COL.a, { align: 'center', size: 18, h: 44 });
        tag(g, 'w 소리 → 입술을 먼저 모아요', 360, 530, COL.a, { align: 'center', size: 18, h: 44 });
      });
    },

    /* 03 f 소리 */
    f(g, u) {
      const pose = S.fpose === 'p' || (!S.fpose && u >= 18 && u < 24.5) ? 'p' : 'f', ph = pose === 'p' ? 'p' : 'f';
      fade(g, ramp(u, 0.3, 0.5), () => {
        mouth(g, 60, 150, 0.95, pose, { lipMark: ph === 'f' ? COL.a : null, labels: ph === 'f' ? ['teeth', 'llip'] : ['lips'], air: ph === 'f' && u >= 6 ? 'center' : null, t: u });
        sideViews(g, ph, pose);
      });
      // 직접 해 보기에서 p 소리를 고르면 단계도 p 소리로
      stepList(g, S.fpose === 'p' ? [[0.4, '두 입술을 꼭 닫기 (윗니는 쉬어요)'], [6, '한 번에 톡 터뜨리기 · 바람은 짧게'], [12, '목은 울리지 않아요 → p 소리']] : [[0.4, '윗니 끝 → 아랫입술 안쪽에 가볍게 얹기'], [6, '그 틈으로 바람을 길게 · 끊지 않고'], [12, '목은 울리지 않아요 · 바람 소리만']], u, 1 - ramp(u, 17.6, 0.4));
      fade(g, win(u, 18, 31.2), () => {
        txt(g, 'f 소리', 540, 400, { size: 18, weight: 800, color: COL.a });
        soundBar(g, 'fric', 640, 400, 540, COL.a, false, u);
        txt(g, '바람이 이어져요', 1180, 440, { size: 15, weight: 600, color: COL.soft, align: 'right' });
        txt(g, 'p 소리', 540, 500, { size: 18, weight: 800, color: COL.b });
        soundBar(g, 'stop', 640, 500, 540, COL.b, false, u);
        txt(g, '막혔다가 톡 터져요', 1180, 540, { size: 15, weight: 600, color: COL.soft, align: 'right' });
      });
      fade(g, win(u, 31, 38.7), () => {
        txt(g, '윗니를 댄 채 바람 먼저 → 그대로 모음으로', 540, 410, { size: 19, weight: 700, color: COL.a });
        wordRow(g, FV.SETS.fStart, 548, 490, 36, 160);
      });
      fade(g, ramp(u, 38.5, 0.5), () => {
        FV.SETS.fEnd.forEach((w, i) => {
          const x = 548 + i * 320;
          word(g, w, x, 420, 38);
          koWord(g, w, x + tw(g, w, 38, 700) + 22, 420, 30, { ins: true, trap: true });
        });
        txt(g, '윗니를 댄 채 바람으로 끝 · 으 없이', 548, 500, { size: 18, weight: 700, color: COL.a });
        txt(g, '분홍 점선 = 한국어식으로 넣은 으', 548, 540, { size: 15, weight: 500, color: COL.ins });
      });
    },

    /* 04 v 소리 */
    v(g, u) {
      const lab = S.vvoice, pose = lab ? 'f' : (u >= 18 && u < 24.5 ? 'p' : 'f');
      const ph = lab === 'off' ? 'f' : pose === 'p' ? 'b' : 'v';
      const vo = ph === 'f' ? null : (lab || u >= 6 ? u : null);
      fade(g, ramp(u, 0.3, 0.5), () => {
        mouth(g, 60, 150, 0.95, pose, { lipMark: pose === 'f' ? COL.a : null, labels: pose === 'f' ? (vo != null ? ['teeth', 'llip', 'voice'] : ['teeth', 'llip']) : ['lips', 'voice'], voice: vo, t: u });
        sideViews(g, ph, pose);
      });
      stepList(g, lab === 'off' ? [[0.4, '같은 입 · 윗니 끝 → 아랫입술'], [6, '목 울림을 끄면 바람 소리만 → f 소리'], [12, '목소리를 켜면 다시 v 소리']] : [[0.4, 'f 소리와 같은 입 · 윗니 끝 → 아랫입술'], [6, '목을 울려요 · 입술도 간질간질 떨려요'], [12, 'f 소리를 길게 내다가 목소리를 켜요']], u, 1 - ramp(u, 17.6, 0.4));
      fade(g, win(u, 12, 18), () => {
        chip(g, 'f —', 548, 520, { size: 22, fill: hex(COL.a, 0.12), stroke: COL.a, color: COL.a, align: 'left' });
        arrow(g, 630, 520, 700, 520, COL.muted, 2);
        txt(g, '목소리 켜기', 665, 494, { size: 14, weight: 600, color: COL.str, align: 'center' });
        chip(g, 'v —', 712, 520, { size: 22, fill: hex(COL.str, 0.14), stroke: COL.str, color: COL.a, align: 'left' });
        arrow(g, 794, 520, 850, 520, COL.muted, 2);
        word(g, 'very', 866, 520, 36);
      });
      fade(g, win(u, 18, 31.2), () => {
        txt(g, 'v 소리', 540, 400, { size: 18, weight: 800, color: COL.a });
        soundBar(g, 'fric', 640, 400, 540, COL.a, true, u);
        txt(g, '떨림이 이어져요 (지잉)', 1180, 440, { size: 15, weight: 600, color: COL.soft, align: 'right' });
        txt(g, 'b 소리', 540, 500, { size: 18, weight: 800, color: COL.b });
        soundBar(g, 'stop', 640, 500, 540, COL.b, true, u);
        txt(g, '닫았다가 열며 시작해요', 1180, 540, { size: 15, weight: 600, color: COL.soft, align: 'right' });
      });
      fade(g, ramp(u, 31, 0.5) * (1 - ramp(u, 36.8, 0.3)), () => FV.SETS.vbPairs.forEach(([a, b], i) => {
        const y = 400 + i * 58;
        word(g, a, 560, y, 32); txt(g, '·', 700, y, { size: 24, color: COL.muted, align: 'center' }); word(g, b, 724, y, 32);
        koWord(g, a, 900, y, 24, { trap: true });
        txt(g, FV.koSame(a, b) ? '둘 다 같은 표기' : '표기가 달라요', 1190, y, { size: 14, weight: 600, color: COL.muted, align: 'right' });
      }));
      fade(g, ramp(u, 37, 0.5), () => {
        chip(g, '처음에는 과장해도 좋아요 · 떨림을 길게', 860, 430, { size: 19, color: COL.a, fill: hex(COL.a, 0.1), stroke: COL.a, align: 'center' });
        wordRow(g, ['very', 'vote', 'vest', 'van'], 560, 510, 32, 160);
      });
    },

    /* 05 w 소리 */
    w(g, u) {
      const vlab = S.wpose === 'v';
      const pose = vlab ? 'f' : u < 6 ? 'w' : wGlide(u);
      fade(g, ramp(u, 0.3, 0.5), () => {
        mouth(g, 60, 150, 0.95, pose, { lipMark: vlab ? COL.a : u < 6 ? COL.muted : null, labels: vlab ? ['teeth', 'llip', 'voice'] : ['lips', 'back'], voice: u, t: u });
        sideViews(g, vlab ? 'v' : 'w', vlab ? 'f' : 'w');
      });
      stepList(g, vlab ? [[0.4, '윗니 끝 → 아랫입술 · 목을 울리면 v 소리'], [6, 'w 소리는 윗니가 닿지 않아요 · 입술만 모아요']] : [[0.4, '우 하듯 입술을 동그랗게 · 앞으로 내밀기 (이에 닿지 않음)'], [6, '곧바로 다음 모음으로 입을 열어요']], u, 1 - ramp(u, 17.6, 0.4));
      fade(g, win(u, 12, 18), () => FV.SETS.wGlide.forEach((w, i) => {
        const x = 560 + i * 160;
        word(g, w, x, 490, 30);
        koWord(g, w, x, 534, 24);
      }));
      fade(g, win(u, 18, 25.2), () => {
        FV.SETS.wu.forEach((w, i) => {
          const x = 640 + i * 220;
          word(g, w, x, 400, 36, { align: 'center' });
          koWord(g, w, x, 456, 32, { align: 'center' });
        });
        txt(g, '우 앞에서 w 소리가 사라져요 (주황 = 빠진 자리)', 860, 520, { size: 18, weight: 700, color: COL.trap, align: 'center' });
      });
      fade(g, win(u, 25, 32.2), () => {
        word(g, 'wood', 560, 400, 40);
        const B = [['w', COL.a, '입술을 꼭 모았다가'], ['ʊ', COL.soft, '우 모음'], ['d', COL.soft, '']];
        let x = 720;
        B.forEach(([s, c, lab], i) => {
          panel(g, x, 368, 64, 64, { fill: COL.panel2, stroke: c });
          txt(g, s, x + 32, 400, { size: 30, weight: 700, fam: FM, color: c, align: 'center' });
          if (lab) txt(g, lab, x + 32, 456, { size: 14, weight: 600, color: c, align: 'center' });
          if (i < B.length - 1) arrow(g, x + 72, 400, x + 134, 400, COL.muted, 2);
          x += 142;
        });
        txt(g, '우 앞에서도 w 소리를 내요', 560, 520, { size: 19, weight: 700, color: COL.a });
      });
      fade(g, win(u, 32, 38.7), () => {
        chip(g, '연구 → 뒤 모음 앞의 w 소리를 빼거나 바꾸곤 했어요', 860, 430, { size: 18, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '주된 까닭은 듣기 → 귀로 먼저 가르기', 860, 480, { size: 17, weight: 700, color: COL.a, align: 'center' });
        txt(g, '근거와 한계 → 페이지 아래 각주', 860, 524, { size: 15, color: COL.muted, align: 'center' });
      });
      fade(g, win(u, 38.5, 44.7), () => {
        mouth(g, 528, 372, 0.42, 'w', {});
        word(g, 'wine', 790, 440, 36, { align: 'center' });
        txt(g, '모았다가 풀기', 790, 490, { size: 15, weight: 600, color: COL.soft, align: 'center' });
        mouth(g, 868, 372, 0.42, 'f', { voice: u });
        word(g, 'vine', 1130, 440, 36, { align: 'center' });
        txt(g, '윗니 + 떨림', 1130, 490, { size: 15, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, ramp(u, 44.5, 0.5), () => {
        word(g, 'wood', 700, 450, 44, { align: 'center' });
        txt(g, '=', 830, 450, { size: 36, weight: 700, color: COL.muted, align: 'center' });
        word(g, 'would', 960, 450, 44, { align: 'center' });
        txt(g, `소리가 같아요 · ${ipa('wood')}`, 830, 520, { size: 17, weight: 600, color: COL.soft, align: 'center' });
      });
    },

    /* 06 낱말 속 자리 */
    place(g, u) {
      const pw = S.pword;
      PCOLS.forEach(([pos, at], i) => {
        const x = 80 + i * 285, list = FV.SETS.place[pos], on = !pw && u >= at && u < (PCOLS[i + 1] ? PCOLS[i + 1][1] : 37.5) && !(pos === 'cluster' && u >= 24.5);
        fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, at, 0.4)) * (pw ? 0 : 1), () => panel(g, x, 145, 265, 260, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }));
        fade(g, ramp(u, 0.4, 0.5), () => tag(g, FV.POS[pos].ko, x + 132, 172, on ? COL.accent : COL.muted, { align: 'center', size: 15, h: 30 }));
        fade(g, pw ? 1 : ramp(u, at, 0.5), () => {
          panel(g, x, 145, 265, 260, { fill: COL.panel, stroke: on ? COL.accent : COL.faint, lw: on ? 2.5 : 1.5 });
          tag(g, FV.POS[pos].ko, x + 132, 172, on ? COL.accent : COL.muted, { align: 'center', size: 15, h: 30 });
          list.forEach((w, k) => {
            const y = 222 + k * 38, hl = pw === w;
            if (hl) panel(g, x + 8, y - 17, 249, 34, { fill: hex(COL.accent, 0.12), r: 8 });
            word(g, w, x + 18, y, 24, { pos });
            koWord(g, w, x + 247, y, 20, { align: 'right', ins: true });
          });
        });
      });
      if (pw) {
        const e = FV.entry(pw), ks = koSyl(pw), en = FV.syl(pw);
        fade(g, 1, () => {
          word(g, pw, 100, 470, 40);
          txt(g, `${ipa(pw)} · ${gloss(pw)}`, 100, 518, { size: 16, color: COL.muted });
          txt(g, FV.targets(pw).map(L => `${L.ph} 소리 · ${FV.POS[L.pos].ko}`).join('   '), 100, 556, { size: 16, weight: 700, color: COL.a });
          txt(g, `영어 ${en} 음절`, 560, 470, { size: 16, weight: 700, color: COL.a });
          sylRow(g, e.syl.map(s => ({ t: s.ph.join(''), color: COL.a })), 700, 470, { size: 20 });
          txt(g, `한국어식 ${ks.length} 음절`, 560, 535, { size: 16, weight: 700, color: ks.length > en ? COL.ins : COL.soft });
          sylRow(g, ks, 700, 535, { size: 20 });
        });
        return;
      }
      fade(g, win(u, 12, 18.7), () => {
        word(g, 'fly', 100, 490, 36);
        sylRow(g, [{ t: 'fly', color: COL.a }], 200, 490, { size: 22 });
        txt(g, '1 음절', 238, 540, { size: 15, weight: 600, color: COL.muted, align: 'center' });
        arrow(g, 300, 490, 350, 490, COL.muted, 2);
        const k = koSyl('fly'); sylRow(g, k, 366, 490, { size: 22 });
        txt(g, `${k.length} 음절`, 366 + sylW(g, k, { size: 22 }) / 2, 540, { size: 15, weight: 600, color: COL.ins, align: 'center' });
        txt(g, '윗니를 댄 채 바로 l 소리 · 으 없이', 640, 490, { size: 18, weight: 700, color: COL.a });
      });
      fade(g, win(u, 18.5, 24.7), () => {
        FVS.mlips(g, 100, 438, 0.7, 'w');
        txt(g, '앞 자음 + 입술 미리 모으기', 270, 470, { size: 19, weight: 700, color: COL.a });
        txt(g, 's → w · t → w · k → w', 270, 510, { size: 17, weight: 600, fam: FM, color: COL.soft });
        wordRow(g, ['swim', 'twelve', 'quick'], 700, 490, 32, 170, { pos: 'cluster' });
      });
      fade(g, win(u, 24.5, 31.2), () => {
        txt(g, '모음 사이 → 짧게 지나가요', 100, 470, { size: 19, weight: 700, color: COL.a });
        txt(g, '윗니가 입술에 닿는 순간을 지켜요', 100, 512, { size: 17, weight: 600, color: COL.soft });
        wordRow(g, FV.SETS.place.mid, 640, 490, 32, 190, { pos: 'mid' });
      });
      fade(g, win(u, 31, 37.7), () => FV.SETS.place.end.forEach((w, i) => {
        const x = 100 + i * 280, k = koSyl(w);
        word(g, w, x, 460, 30, { pos: 'end' });
        sylRow(g, k, x, 515, { size: 18 });
      }));
      fade(g, ramp(u, 37.5, 0.5), () => {
        chip(g, '끝 자음 뒤에 으를 넣지 않기 → 끝소리 튜토리얼', 640, 480, { size: 19, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '영어는 윗니를 입술에 댄 채 끝내요', 640, 534, { size: 17, weight: 700, color: COL.a, align: 'center' });
      });
    },

    /* 07 외래어 함정 */
    loan(g, u) {
      LROWS.forEach((row, ri) => {
        const t = ['f', 'v', 'wu', 'mix'][ri], at = LAT[t];
        row.forEach((w, ci) => {
          const x = 80 + ci * 285, y = 145 + ri * 84, hl = S.loan === w, at2 = at + ci * 0.3;
          fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, at2, 0.4)) * (S.loan ? 0 : 1), () => panel(g, x, y, 265, 76, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }));
          fade(g, S.loan ? 1 : ramp(u, at2, 0.5), () => {
            panel(g, x, y, 265, 76, { fill: COL.panel, stroke: hl ? COL.accent : COL.faint, lw: hl ? 2.5 : 1.5 });
            koWord(g, w, x + 16, y + 26, 24, { trap: true });
            word(g, w, x + 249, y + 26, fit(g, w, 26, 140, 700), { align: 'right' });
            tag(g, FV.TRAP[t].ko, x + 16, y + 56, t === 'mix' ? COL.muted : COL.trap, { size: 13, h: 24, align: 'left' });
            txt(g, ipa(w), x + 249, y + 56, { size: fit(g, ipa(w), 15, 130, 400, 11, FM), fam: FM, color: COL.muted, align: 'right' });
          });
        });
      });
      fade(g, win(u, 31, 37.7), () => {
        word(g, 'cup', 300, 525, 30, { align: 'right' }); koWord(g, 'cup', 316, 525, 26);
        txt(g, '·', 410, 525, { size: 24, color: COL.muted, align: 'center' });
        word(g, 'cuff', 520, 525, 30, { align: 'right' }); koWord(g, 'cuff', 536, 525, 26);
        txt(g, '모든 짝이 같은 표기는 아니에요 → 그래도 입 모양으로 갈라요', 1200, 525, { size: 17, weight: 600, color: COL.soft, align: 'right' });
      });
      fade(g, ramp(u, 37.5, 0.5), () => {
        chip(g, '한국어 표기를 잠시 잊고 → 낱말마다 입술이 할 일부터', 640, 525, { size: 19, color: COL.a, fill: hex(COL.a, 0.08), stroke: COL.a, align: 'center' });
      });
    },

    /* 08 문장 속에서 */
    sentence(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      if (S.sent != null) {
        const s = FV.SENT[S.sent], c = FV.countIn(s.en);
        tag(g, FV.GROUPS[s.grp], 640, 230, COL.muted, { align: 'center', size: 16, h: 32 });
        sentence(g, s.en, 640, 320, 44, { align: 'center', maxW: 1100 });
        txt(g, s.ko, 640, 390, { size: 20, weight: 600, color: COL.soft, align: 'center' });
        counts(g, c, 640 + 60, 450, 18);
        return;
      }
      SROWS.forEach((s, i) => fade(g, ramp(u, s.at, 0.5), () => {
        const y = 190 + i * 88, c = FV.countIn(s.en);
        const R = sentence(g, s.en, 80, y, 36, { maxW: 900 });
        counts(g, c, 1200, y, 17);
        if (i === 0) fade(g, win(u, 12.5, 18.7), () => {
          const x = R.pos.of != null ? R.pos.of : 80;
          arrow(g, x + 14, y + 56, x + 14, y + 28, COL.a, 2);
          txt(g, 'v 소리 · 철자는 f', x - 10, y + 70, { size: 15, weight: 700, color: COL.a });
        });
      }));
      fade(g, ramp(u, 37, 0.5), () => chip(g, '따라 말하기 28문장 → f · v · w · 섞어서, 일곱 문장씩', 640, 548, { size: 17, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' }));
    },

    /* 09 정리 */
    summary(g, u) {
      const X = [80, 330, 770], Y0 = 145;
      fade(g, ramp(u, 0.3, 0.5), () => {
        panel(g, 60, Y0, 1160, 330, { fill: COL.panel, stroke: COL.faint });
        mouth(g, X[1] + 4, Y0 + 4, 0.24, 'f', { lipMark: COL.a });
        mouth(g, X[2] + 4, Y0 + 4, 0.24, 'w', {});
        txt(g, 'f · v 소리', X[1] + 120, Y0 + 46, { size: 22, weight: 800, color: COL.a });
        txt(g, 'w 소리', X[2] + 120, Y0 + 46, { size: 22, weight: 800, color: COL.a });
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + 98, 1120, 1);
      });
      const rows = [
        ['① 듣고 가르기', '바람 · 떨림이 이어져요 (p · b → 막혔다 터짐)', '모은 입술이 풀리며 미끄러져요', 0.4],
        ['② 입 모양', '윗니 끝 → 아랫입술 · v는 목 울림', '입술을 동그랗게 · 이에 닿지 않음', 6],
        ['③ 낱말 속에서', 'ㅍ · ㅂ 버리기 · 끝에 으 없이', '우 앞에서도 w 소리 살리기', 12],
      ];
      rows.forEach(([h, a, b, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = Y0 + 140 + i * 66;
        txt(g, h, X[0] + 16, y, { size: 19, weight: 800, color: COL.text });
        txt(g, a, X[1] + 4, y, { size: fit(g, a, 18, 420, 600), weight: 600, color: COL.a });
        txt(g, b, X[2] + 4, y, { size: fit(g, b, 18, 420, 600), weight: 600, color: COL.a });
      }));
      fade(g, ramp(u, 18, 0.5), () => txt(g, '목표 = 듣는 사람이 헷갈리지 않는 소리', 640, 510, { size: 19, weight: 700, color: COL.soft, align: 'center' }));
      fade(g, ramp(u, 24, 0.5), () => chip(g, '입 그림은 쉽게 줄인 그림 · 거울로 윗니가 입술에 닿는지 확인해요', 640, 552, { size: 16, color: COL.muted, fill: COL.panel2, align: 'center' }));
    },
  };
  FVS.SCENES = SCENES;

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

  FVS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[FVS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, FVS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + FV.allText() + MLAB.join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔≈≠✓×?!~=+-–—/:…‘’\'%&<>|ɹɝɚəæɑɔɪʊʌɛŋθðʃʒˈˌ';
  FVS.baseText = EXTRA;
  FVS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = FVS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { FVS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
