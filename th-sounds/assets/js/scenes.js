/* 혀끝을 이 사이로 — th 소리 둘 — 영상 장면과 자막 (THS)
 * 그림은 시간 t와 사용자 상태(S)만의 함수예요. 낱말 속 th 글자 칠하기 · 한글 표기 · 자리는 규칙 엔진(TH)이 계산하고,
 * 입 그림은 공통 부품 EN.mouth(../shared/mouth.js)가 그려요(th 소리 둘 = 'th' 자세, s · z = 's', f = 'f', t · d = 't').
 * 역할 색: th 소리(바람 · 울림) 노랑 · 짝 소리(s · f · t · d · z) 하늘 · 한국어식 소리(함정) 주황 · 넣은 으 분홍 점선
 * 03 · 04장의 ‘바람 소리의 세기’ 막대는 미리 만든 음성 파일을 잰 값(THV.meas의 wl)으로만 그려요.
 */
(function () {
  'use strict';
  const TH = window.TH, M = window.EN.mouth;
  const THS = (window.THS = {});
  const W = 1280, H = 720;
  THS.W = W; THS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  THS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    a: '#FFC15E', b: '#6EC8FF', ins: '#FF7AA8', str: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  THS.COL = COL;
  // 소리 → 색: th 소리 둘 노랑(이 편의 소리) · s · f · t · d · z 하늘(짝 소리)
  const PCOL = { 'θ': COL.a, 'ð': COL.a, s: COL.b, f: COL.b, t: COL.b, d: COL.b, z: COL.b, a: COL.a };
  THS.PCOL = PCOL;
  const NAME = TH.NAME;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (THS.S = { pair: null, kpair: null, thmode: null, fmode: null, dmode: null, zmode: null, pword: null, loan: null, sent: null, voice: null });
  THS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  THS.hits = () => HITS;

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
  THS.hex = hex;

  /* ---------- 아이콘 — 24×24 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요 ---------- */
  const ICON = {
    spk: [['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'f'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
    ear: [['M7.5 9.5a4.5 4.5 0 1 1 9 0c0 3.1-3 3.7-3 6.6a2.7 2.7 0 0 1-5.1 1.1'], ['M10.5 10a1.6 1.6 0 1 1 3 .9']],
    mouth: [['M3.5 12c2.6-3.2 5.3-4.4 8.5-4.4s5.9 1.2 8.5 4.4c-2.6 3.2-5.3 4.4-8.5 4.4S6.1 15.2 3.5 12z'], ['M3.5 12h17']],
    text: [['M4 6.5h16M4 10.5h16M4 14.5h11M4 18.5h7']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z'], ['M6 11a6 6 0 0 0 12 0'], ['M12 17v3.5M9 20.5h6']],
    lips: [['M3.5 12c2.2-3 4.6-4.6 6.2-4.6 1 0 1.6.6 2.3.6s1.3-.6 2.3-.6c1.6 0 4 1.6 6.2 4.6-2.6 3.2-5.3 4.4-8.5 4.4S6.1 15.2 3.5 12z'], ['M7 12h10']],
  };
  THS.ICON = ICON;
  const P2D = {};
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const k = size / 24;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    (ICON[id] || []).forEach(([d, m]) => { const p = P2D[d] || (P2D[d] = new Path2D(d)); if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  THS.icon = icon;
  THS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;
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
  THS.mouth = mouth;
  THS.mlips = (g, x, y, s, pose, o = {}) => M.lips(g, x, y, s, pose, o);
  THS.mtop = (g, x, y, s, pose, o = {}) => M.top(g, x, y, s, pose, o);
  // 소리 → 입 자세 · 목 울림 (엔진의 TH.MOUTH)
  const poseOf = ph => (TH.MOUTH[ph] || TH.MOUTH['θ']).pose;
  const voiced = ph => !!(TH.MOUTH[ph] || {}).voice;
  THS.poseOf = poseOf;
  // 혀 설명 (그림의 계산 EN.mouth.tongueTeeth · lipTeeth · contact와 같은 결과): [닿나, 어떻게]
  function tongueLines(ph) {
    const pose = poseOf(ph), c = M.contact(pose);
    if (M.tongueTeeth(pose).touch) return ['혀끝이 윗니 끝에 닿아요', '가볍게 대고 막지 않아요'];
    if (M.lipTeeth(pose).touch) return ['윗니 끝이 아랫입술에 닿아요', '혀는 쉬어요'];
    if (c.touch) return ['혀끝이 윗잇몸에 닿아요', '붙여 막았다가 떼요'];
    return ['혀끝이 이에 닿지 않아요', `${c.where} 가까이`];
  }
  THS.tongueLines = tongueLines;
  const AIR = { 'θ': '얇은 틈 · 약한 바람', 'ð': '얇은 틈 · 약한 떨림', s: '가운데 좁은 길 · 센 바람', z: '좁은 길 · 또렷한 떨림', f: '입술과 이 사이 · 약한 바람', t: '막았다가 터뜨려요', d: '막았다가 떼요' };
  THS.AIR = AIR;

  /* ---------- 낱말 · 한글 · 문장 그리기 ---------- */
  // 영어 낱말: th 글자(노랑)와 짝 낱말의 짝 소리 글자(하늘)만 칠하고 밑줄. o.only = 'a' | 'b' · o.pos = 그 자리만
  function word(g, w, x, y, size, o = {}) {
    const e = TH.entry(w), shown = e ? e.w === e.key ? w : e.w : w;
    const wt = o.weight || 700, sp = TH.spans(w).filter(s => !s.bad);
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
  THS.word = word;
  // 한글 표기: 한글이 적은 영어 소리(노랑 · 하늘), o.trap이면 모두 주황, o.ins면 넣은 으 음절에 분홍 점선 상자
  function koWord(g, w, x, y, size, o = {}) {
    const e = TH.entry(w), ko = o.ko || (e && e.ko) || '';
    const marks = o.ko ? [] : TH.koMarks(w), ins = o.ins && !o.ko ? TH.koInserted(w) : [];
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
  THS.koWord = koWord;
  // 문장: th 소리를 적은 글자만 칠함
  function sentence(g, text, x, y, size, o = {}) {
    const segs = TH.segs(text), wt = o.weight || 600;
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
  THS.sentence = sentence;
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
  // 한국어식 음절 상자: 넣은 으는 분홍 점선, 소리를 적은 음절은 그 색, 나머지는 주황(한국어식)
  function koSyl(w) {
    const e = TH.entry(w), ins = TH.koInserted(w), marks = TH.koMarks(w);
    return [...(e.ko || '')].map((ch, i) => ({ t: ch, ins: ins.indexOf(i) >= 0, color: ins.indexOf(i) >= 0 ? null : marks[i] ? PCOL[marks[i]] : COL.trap }));
  }
  THS.koSyl = koSyl;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(IPA)는 자막에 쓰지 않음
     영어 낱말 바로 뒤에 조사를 붙이지 않아요(소리 내어 읽을 때 어색해서) — → 나 ‘th 소리’로 이어요.
     ㅅ · ㄷ은 음성 해설에서 시옷 · 디귿으로, 홀로 쓴 th · s · f · t · d · z는 글자 이름으로 읽어요(app.js의 NARR).
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '혀끝을 이 사이로 — th 소리 둘', d: 30, caps: [
      [0.4, 6, '생각하다 think, 가라앉다 sink. 한국어로 적으면 둘 다 싱크예요.'],
      [6, 12, '그들 they, 하루 day → 둘 다 데이예요. 한국어에는 th 소리가 없어서 가까운 소리로 바꿔 적어요.'],
      [12, 18, 'th 소리는 둘이에요 → 바람만 내는 th 소리와 목을 울리는 th 소리. 한글로는 ㅅ과 ㄷ이 맡아요.'],
      [18, 24, '세 단계로 익혀요. 듣고 가르고, 혀끝의 자리를 만들고, 낱말과 문장 속에서 써요.'],
      [24, 30, '미국 표준 발음을 기준으로 해요. 소리는 모두 합성 음성이고, 입 그림은 쉽게 줄여 그렸어요.'],
    ] },
    { id: 'listen', n: '01', title: '들어 보기 · 구별되나요?', sub: '① 듣고 가르기 · 짝 낱말 · 목소리 넷', d: 38, caps: [
      [0.4, 6, '먼저 귀부터 시험해요. 짝 낱말 둘은 소리 하나만 달라요 → think · sink, mouth · mouse.'],
      [6, 12, '화면의 낱말을 눌러 들어 보세요. 같은 낱말을 곧바로 다시 누르면 천천히 들려줘요.'],
      [12, 18, 'f 소리와도 짝이 있어요 → three · free. 셋과 공짜예요.'],
      [18, 24.5, '목을 울리는 th 소리는 d 소리와 짝이 돼요 → they · day. 그들과 하루예요.'],
      [24.5, 31, '듣기 연구에서 한국어를 쓰는 학습자는 바람 th 소리를 f 소리로, 울림 th 소리를 d 소리로 듣는 일이 많았어요.'],
      [31, 38, '여러 목소리로 짝을 듣고 고르는 연습이 도움이 돼요. 아래 놀이터의 **듣고 가르기 훈련**이 그 연습이에요.'],
    ] },
    { id: 'korean', n: '02', title: 'ㅅ 하나, ㄷ 하나', sub: '바람 th → ㅅ · 울림 th → ㄷ · 끝에는 으', d: 42, caps: [
      [0.4, 6, '외래어 표기법은 바람 th 소리를 ㅅ으로 적어요. 그래서 think · sink → 싱크, mouth · mouse → 마우스.'],
      [6, 12.5, '울림 th 소리는 ㄷ으로 적어요. 그래서 they · day → 둘 다 데이, breathe · breed → 브리드.'],
      [12.5, 19, 's 소리는 혀끝이 윗잇몸 가까이 있어요. th 소리는 혀끝이 더 앞으로 나와 윗니 끝에 닿아요.'],
      [19, 25.5, '그래서 마우스라고 말하면, 듣는 사람에게는 mouse → 쥐로 들리기 쉬워요. 입이 쥐가 돼요.'],
      [25.5, 32, 'ㄷ은 혀끝으로 막았다가 떼는 소리예요. 영어 d 소리와 비슷해요. 울림 th 소리는 막지 않아요.'],
      [32, 37, '끝에서는 으가 붙어요 → mouth 마우스, breathe 브리드. 영어는 으 없이 끝내요.'],
      [37, 42, '오늘의 작전 → 혀끝을 윗니 끝에 대고, 막지 않고 바람을 흘려요.'],
    ] },
    { id: 'th', n: '03', title: 'th 소리 — 혀끝을 윗니 끝에', sub: '② 혀끝의 자리 · 윗니 끝에 가볍게 · 약한 바람', d: 48, caps: [
      [0.4, 6, '바람 th 소리부터 만들어요. 턱을 조금 내리고, 혀끝을 윗니 끝에 가볍게 대요.'],
      [6, 12, '혀끝이 이 사이로 살짝 보여도 좋아요. 세게 물지 않아요. 그 틈으로 바람을 흘려요.'],
      [12, 18, 's 소리는 혀끝이 이에 닿지 않아요. 윗잇몸 가까이의 좁은 길로 센 바람을 보내요.'],
      [18, 24.5, '그래서 th 소리는 s 소리보다 훨씬 약하고 부드러워요. 목소리 넷의 바람 소리를 재어 보면 이렇게 달라요.'],
      [24.5, 31, '함정은 ㅅ이에요. 혀끝을 잇몸 쪽에 두면 s 소리가 나요. 그러면 think · sink → 같은 낱말로 들려요.'],
      [31, 37.5, '요령 → 거울을 봐요. 윗니 아래로 혀끝이 살짝 보이면 맞아요. 바람은 약하게, 길게 내요.'],
      [37.5, 43, '들어 봐요 → think · thank · three · thing. 혀끝을 먼저 대고 소리를 시작해요.'],
      [43, 48, '짝으로 들어 봐요 → think · sink, thick · sick, mouth · mouse.'],
    ] },
    { id: 'ft', n: '04', title: '입술도 아니고, 막지도 않아요', sub: '② 혀끝의 자리 · f 소리는 입술 · t 소리는 막기 · th 소리는 혀끝과 이', d: 44, caps: [
      [0.4, 6, 'th 소리와 가장 헷갈리는 소리는 f 소리예요. 둘 다 약하고 부드러운 바람 소리예요.'],
      [6, 12, 'f 소리는 윗니 끝을 아랫입술에 얹어요. th 소리는 입술이 아니라 혀끝을 윗니 끝에 대요.'],
      [12, 18.5, '바람의 세기는 비슷해요. 그래서 귀로는 가르기 어려워요. 재어 보면 둘 다 s 소리보다 훨씬 약해요.'],
      [18.5, 25, '짝으로 들어 봐요 → three · free, thin · fin, death · deaf.'],
      [25, 31, 't 소리는 혀끝을 윗잇몸에 붙여 막았다가 터뜨려요. th 소리는 막지 않아요. 바람이 이어져요.'],
      [31, 37.5, '짝으로 들어 봐요 → three · tree, thank · tank, both · boat.'],
      [37.5, 44, '눈으로는 쉬워요. 아랫입술이 올라오면 f 소리, 혀끝이 보이면 th 소리예요. 거울로 확인해요.'],
    ] },
    { id: 'dh', n: '05', title: '울림 th 소리 — 같은 혀 + 목 울림', sub: '② 혀끝의 자리 · 윗니 끝 · 목 울림 · ㄷ처럼 막지 않기', d: 44, caps: [
      [0.4, 6, '울림 th 소리는 바람 th 소리와 혀의 자리가 같아요. 혀끝을 윗니 끝에 가볍게 대요.'],
      [6, 12, '다른 점은 하나, 목을 울려요. 바람 th 소리를 길게 내다가 목소리를 켜요.'],
      [12, 18, '아주 흔한 낱말에 들어 있어요 → the · this · that · they. 문장마다 나오는 소리예요.'],
      [18, 24.5, 'd 소리와 한국어 ㄷ은 혀끝으로 막았다가 떼요. 울림 th 소리는 막지 않아요. 떨림이 이어져요.'],
      [24.5, 31, '그래서 데이라고 말하면 혀끝이 막아요. they → 혀끝을 윗니 끝에 댄 채 떨림부터 시작해요.'],
      [31, 37.5, '짝으로 들어 봐요 → they · day, then · den, breathe · breed.'],
      [37.5, 44, '모음 사이에서도 같아요 → mother · brother · weather · together. 혀끝이 윗니 끝을 스쳐요.'],
    ] },
    { id: 'dz', n: '06', title: 'z 소리와도 달라요', sub: '② 혀끝의 자리 · z 소리는 잇몸 가까이 · 울림 th 소리는 윗니 끝', d: 40, caps: [
      [0.4, 6, '울림 th 소리는 z 소리와도 짝이 돼요. z 소리는 혀끝이 윗잇몸 가까이 있고, 이에 닿지 않아요.'],
      [6, 12, '울림 th 소리는 혀끝이 윗니 끝에 닿아요. 떨림이 z 소리보다 약하고 부드러워요.'],
      [12, 18.5, '짝으로 들어 봐요 → breathe · breeze, clothing · closing.'],
      [18.5, 25, '한국어식으로는 표기가 달라요 → 브리드, 브리즈. 그래도 소리는 혀끝의 자리로 갈라요.'],
      [25, 31.5, '듣기 연구에서 th 소리는 낱말 끝과 센 음절 뒤에서 더 알아듣기 어려웠어요.'],
      [31.5, 36, '끝에서도 혀끝을 윗니 끝에 댄 채 끝내요 → breathe · with. 으를 붙이지 않아요.'],
      [36, 40, '혀끝이 앞으로 나오느냐, 이것 하나로 갈려요.'],
    ] },
    { id: 'place', n: '07', title: '낱말 속 자리', sub: '③ 낱말 속에서 · 처음 · 묶음 · 가운데 · 끝', d: 44, caps: [
      [0.4, 6, '이제 낱말 속에서 써요. 소리가 놓이는 자리는 넷이에요 → 처음, 묶음, 가운데, 끝.'],
      [6, 12, '처음 자리 → think · thank · this. 혀끝을 윗니 끝에 먼저 대고 소리를 시작해요.'],
      [12, 18.5, '묶음 자리 → three · throat · thriller. th 소리 뒤에 r 소리가 바로 와요. 스리처럼 으를 넣지 않아요.'],
      [18.5, 24.5, 'three → 혀끝을 이에서 떼면서 곧바로 뒤로 당겨 r 모양을 만들어요. 한 박자예요.'],
      [24.5, 31, '가운데 자리 → nothing · method · mother. 모음 사이에서는 짧게 지나가요. 혀끝이 윗니 끝을 스쳐요.'],
      [31, 37.5, '끝 자리 → bath · teeth · with · breathe. 한국어식으로는 끝에 으를 붙여요 → 배스 · 티스 · 위드 · 브리드.'],
      [37.5, 44, '영어는 약한 바람이나 떨림으로 끝내요. 끝 자음 이야기는 끝소리 튜토리얼에서 더 자세히 다뤄요.'],
    ] },
    { id: 'loan', n: '08', title: '외래어 함정', sub: '③ 낱말 속에서 · 스릴러 · 헬스 · 리듬 · 토머스', d: 44, caps: [
      [0.4, 6, '외래어는 한국어식 발음이 입에 붙어 있어 더 조심해요. 네 가지를 봐요.'],
      [6, 12, '처음의 th 소리 → ㅅ. thriller 스릴러, theater 시어터, thumbnail 섬네일, third 서드.'],
      [12, 18, '가운데와 끝의 th 소리 → ㅅ. health 헬스, Bluetooth 블루투스, method 메서드, birthday 버스데이.'],
      [18, 24.5, '울림 th 소리 → ㄷ. rhythm 리듬, smoothie 스무디, weather 웨더, leather 레더.'],
      [24.5, 31, '거꾸로, 철자는 th인데 t 소리로 읽는 낱말도 있어요 → Thomas, Thailand, thyme, Thames.'],
      [31, 37.5, '모든 짝이 같은 표기가 되지는 않아요 → three 스리, free 프리. 그래도 소리는 혀끝의 자리로 갈라요.'],
      [37.5, 44, '외래어를 영어로 말할 때는 한국어 표기를 잠시 잊고, 혀끝을 윗니 끝에 먼저 대요.'],
    ] },
    { id: 'sentence', n: '09', title: '문장 속에서', sub: '③ 문장 속에서 · This is my brother.', d: 44, caps: [
      [0.4, 6, '문장 속에서는 소리가 빨리 지나가요. 먼저 th 소리가 어디 있는지 찾아요.'],
      [6, 12.5, 'Thank you so much. 첫소리가 바람 th 소리예요. 혀끝을 대고 시작해요.'],
      [12.5, 18.5, 'This is my brother. 울림 th 소리가 둘이에요. 처음에 하나, 가운데에 하나.'],
      [18.5, 25, 'Take a deep breath. 끝의 th 소리예요. 약한 바람으로 끝내요.'],
      [25, 31, 'There are three things. 울림 th 소리 하나, 바람 th 소리 둘이에요.'],
      [31, 37, '약하게 지나가는 낱말에서도 같아요 → the · this · that. 혀끝이 윗니 끝을 스쳐요.'],
      [37, 44, '아래 **따라 말하기**에 문장 스물여덟 개가 있어요. 네 묶음, 묶음마다 일곱 문장이에요.'],
    ] },
    { id: 'summary', n: '10', title: '정리', sub: '3단계 발음법 · th 소리 둘', d: 36, caps: [
      [0.4, 6, '정리해요. ① 듣고 가르기 → th 소리는 s 소리보다 훨씬 약한 바람이에요. f 소리와는 비슷해서 더 조심해요.'],
      [6, 12, '② 혀끝의 자리 → 혀끝을 윗니 끝에 가볍게. 막지 않아요. 목을 울리면 울림 th 소리예요.'],
      [12, 18, '③ 낱말 속에서 → ㅅ과 ㄷ으로 바꾸지 않고, 끝에 으를 붙이지 않아요.'],
      [18, 24, '연구에서는 th 소리를 다른 소리로 바꿔 말해도, 알아듣는 데 주는 영향이 작은 편이었어요.'],
      [24, 30, '그러니 너무 긴장하지 않아도 돼요. 목표는 듣는 사람이 헷갈리지 않는 소리예요.'],
      [30, 36, '아래 **듣고 가르기 훈련**과 **내 발음 확인**에서 직접 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  THS.CHAPTERS = CHAPTERS; THS.CAPTIONS = CAPTIONS; THS.END = END;
  THS.POSTER = CHAPTERS.find(c => c.id === 'korean').t + 15;   // 같은 표기 짝 넷 · s와 th의 두 입 그림이 한 화면에
  THS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  THS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 900, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 900, 800, 24, FD), weight: 800, fam: FD });
  }
  const gloss = w => (TH.entry(w) || {}).gloss || '';
  const ipa = w => TH.ipa(w);
  // 오른쪽 위 범례: th 소리 노랑 · 짝 소리 하늘
  function legend(g, a = 1) {
    fade(g, a, () => tag(g, 'th 소리 (바람 · 울림)', 1200, 92, COL.a, { align: 'right', size: 15, h: 30 }));
  }
  // 큰 입 옆 단면도(03 ~ 06장): 소리마다 닿는 곳 표시가 달라요 — th는 혀끝 · 윗니, f는 아랫입술 · 윗니, 나머지는 혀 · 입천장
  function bigMouth(g, ph, u, o = {}) {
    const pose = poseOf(ph), c = PCOL[ph] || COL.a;
    const opt = pose === 'th' ? { teethMark: c, labels: ['teeth', 'tip'], air: o.air === false ? null : 'center' }
      : pose === 'f' ? { lipMark: c, labels: ['teeth', 'llip'], air: o.air === false ? null : 'center' }
        : pose === 't' ? { mark: c, labels: ['ridge', 'tip'] }
          : { mark: c, labels: ['ridge', 'tip'], air: o.air === false ? null : 'center' };
    if (voiced(ph)) { opt.voice = u; opt.labels = opt.labels.concat(['voice']); }
    mouth(g, 60, 150, 0.95, pose, Object.assign(opt, { t: u }));
  }
  // 오른쪽 칸: 위에서 본 혀 + 입술 앞모습 + 소리 카드 (03 ~ 06장). 카드의 글은 그림의 계산으로
  function sideViews(g, ph, u) {
    const c = PCOL[ph] || COL.a, pose = poseOf(ph);
    THS.mtop(g, 520, 148, 0.72, pose, { mark: c, t: u || 0 });
    txt(g, '위에서 본 혀', 592, 322, { size: 14, weight: 600, color: COL.muted, align: 'center' });
    THS.mlips(g, 680, 176, 0.62, pose);
    txt(g, '입술 앞모습', 742, 280, { size: 14, weight: 600, color: COL.muted, align: 'center' });
    panel(g, 830, 150, 370, 176, { fill: hex(c, 0.08), stroke: c });
    const nm = NAME[ph] || ph, isTh = TH.role(ph) === 'a';
    txt(g, nm, 900, isTh ? 224 : 236, { size: fit(g, nm, 76, 110, 800, 40, FD), weight: 800, fam: FD, color: c, align: 'center' });
    if (isTh) txt(g, ph === 'ð' ? '울림' : '바람', 900, 284, { size: 17, weight: 700, color: c, align: 'center' });
    const T = tongueLines(ph);
    const L = [T[0], T[1], voiced(ph) ? '목이 울려요' : '목은 울리지 않아요', AIR[ph] || ''];
    txt(g, L[0], 1080, 184, { size: fit(g, L[0], 20, 220, 800), weight: 800, color: c, align: 'center' });
    txt(g, L[1], 1080, 216, { size: fit(g, L[1], 16, 220, 600), weight: 600, color: COL.soft, align: 'center' });
    txt(g, L[2], 1080, 256, { size: 16, weight: 600, color: COL.soft, align: 'center' });
    if (L[3]) txt(g, L[3], 1080, 292, { size: fit(g, L[3], 15, 220, 500), weight: 500, color: COL.muted, align: 'center' });
  }
  // 단계 목록 (03 ~ 06장)
  function stepList(g, list, u, a = 1, x = 520, y = 372, gap = 46) {
    fade(g, a, () => list.forEach(([at, s], i) => fade(g, ramp(u, at, 0.5), () => {
      circ(g, x + 14, y + i * gap, 14, COL.panel2);
      txt(g, String(i + 1), x + 14, y + i * gap + 1, { size: 15, weight: 800, color: COL.accent, align: 'center' });
      txt(g, s, x + 40, y + i * gap, { size: fit(g, s, 20, 640, 600), weight: 600, color: COL.text });
    })));
  }
  // 낱말 줄 (누르면 들려줌)
  function wordRow(g, list, x, y, size, step, o = {}) { list.forEach((w, i) => word(g, w, x + i * step, y, size, o)); }
  // 소리 막대: 바람이 이어지는 소리(kind 'fric', voice면 떨림) · 막았다 떼는 소리(kind 'stop': 막음 → 톡 → 모음)
  function soundBar(g, kind, x, y, w, color, voice, u) {
    const h = 34;
    const noise = (x0, len) => {
      g.strokeStyle = color; g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k <= len; k += 3) {
        const yy = voice ? Math.sin(k * 0.35 + u * 12) * 7 : ((Math.sin(k * 12.9898 + Math.floor(u * 20)) * 43758.5453) % 1) * 7;
        if (k === 0) g.moveTo(x0 + k, y + yy); else g.lineTo(x0 + k, y + yy);
      }
      g.stroke();
    };
    if (kind === 'fric') {
      const fr = 250;
      panel(g, x, y - h / 2, fr, h, { fill: hex(color, 0.12), stroke: color, r: 8 });
      noise(x + 10, fr - 20);
      panel(g, x + fr + 8, y - h / 2, w - fr - 8, h, { fill: hex(COL.soft, 0.08), stroke: COL.faint, r: 8 });
      txt(g, '모음', x + fr + 8 + (w - fr - 8) / 2, y, { size: 14, weight: 600, color: COL.muted, align: 'center' });
    } else {
      const cl = 220;
      panel(g, x, y - h / 2, cl, h, { fill: COL.panel2, stroke: COL.line, r: 8 });
      txt(g, '막음', x + cl / 2, y, { size: 14, weight: 700, color: COL.muted, align: 'center' });
      g.strokeStyle = color; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x + cl + 8, y + 16); g.lineTo(x + cl + 14, y - 22); g.lineTo(x + cl + 20, y + 16); g.stroke();
      panel(g, x + cl + 30, y - h / 2, w - cl - 30, h, { fill: hex(COL.soft, 0.08), stroke: COL.faint, r: 8 });
      txt(g, '모음', x + cl + 30 + (w - cl - 30) / 2, y, { size: 14, weight: 600, color: COL.muted, align: 'center' });
    }
  }
  // 03 · 04장: 잰 바람 소리의 세기 — 목소리마다 두 낱말(a = th 쪽 · b = 짝 쪽). 통과한 파일의 잰 값(wl)만
  //   wl = 목이 울리기 전 바람 조각의 세기 dB(그 낱말에서 가장 큰 곳 = 0). 0에 가까울수록 센 바람
  const WL_LO = -45, WL_HI = 0;
  THS.WIND = { th: ['think', 'sink'], ft: ['thin', 'fin'] };
  THS.windRows = (a, b) => TH.VOICES.map(v => {
    const A = window.THV && THV.meas(v.sp, a), B = window.THV && THV.meas(v.sp, b);
    return A && B && A.wl != null && B.wl != null ? { sp: v.sp, ko: v.ko, a: A.wl, b: B.wl } : null;
  }).filter(Boolean);
  function windBars(g, x, y, w, a, b) {
    const R = THS.windRows(a, b), nb = NAME[TH.pairPhone(TH.pairById(a + '-' + b), b)];
    txt(g, '바람 소리의 세기 · 이 영상의 합성 음성을 잰 값', x, y, { size: 17, weight: 700, color: COL.soft });
    if (!R.length) { txt(g, '잰 값이 아직 없어요', x, y + 50, { size: 16, color: COL.muted }); return; }
    const bx = x + 130, bw = w - 140, X = f => bx + clamp((f - WL_LO) / (WL_HI - WL_LO)) * bw;
    R.forEach((r, i) => {
      const yy = y + 44 + i * 38;
      txt(g, r.ko, x, yy, { size: 15, weight: 600, color: COL.muted });
      g.fillStyle = hex(COL.a, 0.85); g.fillRect(bx, yy - 12, Math.max(2, X(r.a) - bx), 10);
      g.fillStyle = hex(COL.b, 0.85); g.fillRect(bx, yy + 2, Math.max(2, X(r.b) - bx), 10);
    });
    const yb = y + 44 + R.length * 38 - 8;
    g.fillStyle = COL.faint; g.fillRect(bx, yb, bw, 1);
    txt(g, '약한 바람', bx, yb + 16, { size: 13, weight: 600, color: COL.muted });
    txt(g, '센 바람', bx + bw, yb + 16, { size: 13, weight: 600, color: COL.muted, align: 'right' });
    const r1 = tag(g, `${nb} 소리 · ${b}`, bx + bw, y, COL.b, { align: 'right', size: 13, h: 26 });
    tag(g, `th 소리 · ${a}`, r1.x - 10, y, COL.a, { align: 'right', size: 13, h: 26 });
  }

  // 01장 짝 카드
  const LCARDS = [['think', 'sink', 0.4], ['mouth', 'mouse', 1.2], ['three', 'free', 12], ['they', 'day', 18]];
  // 02장 같은 표기 줄
  const KROWS = [['think', 'sink', 0.8], ['mouth', 'mouse', 3.2], ['they', 'day', 6.4], ['breathe', 'breed', 8.6]];
  // 08장 외래어 칸 (줄: 처음의 th → ㅅ · 가운데와 끝의 th → ㅅ · 울림 th → ㄷ · 철자는 th, 소리는 t)
  const LTRAPS = ['th1', 'th2', 'dh', 'tt'];
  const LROWS = LTRAPS.map(t => TH.LOAN.filter(o => o.trap === t).map(o => o.w));
  const LAT = { th1: 6, th2: 12, dh: 18, tt: 24.5 };
  THS.LROWS = LROWS;
  // 09장 문장
  const SROWS = [
    { en: 'Thank you so much.', at: 6 },
    { en: 'This is my brother.', at: 12.5 },
    { en: 'Take a deep breath.', at: 18.5 },
    { en: 'There are three things.', at: 25 },
  ];
  THS.SROWS = SROWS;
  // 07장 자리 칸
  const PCOLS = [['start', 6], ['cluster', 12], ['mid', 24.5], ['end', 31]];
  // 소리 수 표시: 0이 아닌 것만 (바람 th 2 · 울림 th 1)
  function counts(g, c, x, y, size = 17) {
    let xx = x;
    [['ð', '울림 th'], ['θ', '바람 th']].forEach(([k, nm]) => {   // 오른쪽 정렬이라 거꾸로
      if (!c[k]) return;
      const s = `${nm} ${c[k]}`;
      txt(g, s, xx, y, { size, weight: 800, color: PCOL[k], align: 'right' });
      xx -= tw(g, s, size, 800) + 16;
    });
  }
  // 짝 한 줄: a · b → 한국어식 표기 (같은 표기 · 다른 표기)
  function koPairRow(g, a, b, y, size = 30) {
    const A = word(g, a, 104, y, size);
    txt(g, '·', A.x + A.w + 12, y, { size: 24, color: COL.muted, align: 'center' });
    word(g, b, A.x + A.w + 24, y, size);
    arrow(g, 384, y, 420, y, COL.muted, 2);
    koWord(g, a, 432, y, size - 4, { trap: true });
    const same = TH.koSame(a, b);
    tag(g, same ? '같은 표기' : '다른 표기', 624, y, same ? COL.trap : COL.muted, { align: 'right', size: 14, h: 28 });
    if (!same) koWord(g, b, 506, y, size - 8, { trap: true });
  }
  // 짝 세 줄(03 ~ 06장 아래쪽): a · b + 한국어식 표기 + 같은 · 다른 표기
  function pairRows(g, list, y0 = 400, gap = 58) {
    list.forEach(([a, b], i) => {
      const y = y0 + i * gap, same = TH.koSame(a, b);
      word(g, a, 560, y, 32); txt(g, '·', 716, y, { size: 24, color: COL.muted, align: 'center' }); word(g, b, 736, y, 32);
      const K = koWord(g, a, 900, y, 24, { trap: true });
      if (!same) koWord(g, b, K.x + K.w + 18, y, 24, { trap: true });
      txt(g, same ? '둘 다 같은 표기' : '표기가 달라요', 1196, y, { size: 14, weight: 600, color: COL.muted, align: 'right' });
    });
  }
  // 철자는 th인데 t 소리인 낱말(08장): 앞의 Th만 하늘색(t 소리 = 짝 소리)으로
  function wordTT(g, w, x, y, size) {
    const e = TH.entry(w), shown = e ? e.w : w, total = tw(g, shown, size, 700);
    const x0 = x - total;
    const w1 = txt(g, shown.slice(0, 2), x0, y, { size, weight: 700, color: COL.b });
    g.fillStyle = COL.b; g.fillRect(x0, y + size * 0.56, w1, Math.max(2.5, size * 0.065));
    txt(g, shown.slice(2), x0 + w1, y, { size, weight: 700, color: COL.text });
    listen(x0 - 8, y - size * 0.7, total + 16, size * 1.45, [{ text: shown, sp: 'tc' }]);
  }

  const SCENES = {
    /* 00 들어가며 */
    intro(g, u) {
      const A = 1 - ramp(u, 11.4, 0.5);
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
      pairAt('think', 'sink', 0.4, 5.8);
      pairAt('they', 'day', 6.1, 99);
      fade(g, A * ramp(u, 7.5, 0.5), () => {
        tag(g, '바람 th 소리 → ㅅ', 430, 470, COL.trap, { align: 'center', size: 18, h: 40 });
        tag(g, '울림 th 소리 → ㄷ', 760, 470, COL.trap, { align: 'center', size: 18, h: 40 });
      });
      // 영어 소리 넷 → 한글 두 자
      fade(g, win(u, 12, 18), () => {
        const rows = [['θ', '바람 th 소리', 180], ['s', 's 소리', 232], ['ð', '울림 th 소리', 344], ['d', 'd 소리', 396]];
        const box = { 'θ': 206, s: 206, 'ð': 370, d: 370 };
        rows.forEach(([ph, nm, y], i) => fade(g, ramp(u, 12.3 + i * 0.35, 0.4), () => {
          const c = chip(g, nm, 520, y, { size: 20, fill: hex(PCOL[ph], 0.12), stroke: PCOL[ph], color: PCOL[ph], align: 'right' });
          arrow(g, c.x + c.w + 12, y, 756, box[ph], hex(PCOL[ph], 0.7), 2);
        }));
        [['ㅅ', 206], ['ㄷ', 370]].forEach(([k, y]) => {
          panel(g, 756, y - 52, 128, 104, { fill: hex(COL.trap, 0.12), stroke: COL.trap });
          txt(g, k, 820, y + 2, { size: 60, weight: 800, fam: FD, color: COL.trap, align: 'center' });
        });
        txt(g, '영어 소리 넷 → 한글 두 자', 1080, 206, { size: 20, weight: 700, color: COL.soft, align: 'center' });
        txt(g, '노랑 = th 소리 · 하늘 = 짝 소리', 1080, 370, { size: 15, weight: 500, color: COL.muted, align: 'center' });
      });
      const steps = [['ear', '① 듣고 가르기', '짝 낱말이 다르게 들리나'], ['mouth', '② 혀끝의 자리 만들기', '윗니 끝 · 막지 않기 · 목 울림'], ['text', '③ 낱말 · 문장 속에서', '처음 · 묶음 · 가운데 · 끝']];
      steps.forEach(([ic, h, s], i) => fade(g, ramp(u, 18 + i * 0.6, 0.5), () => {
        const x = 110 + i * 360;
        panel(g, x, 200, 340, 190, { fill: COL.panel, stroke: COL.faint });
        circ(g, x + 170, 252, 30, COL.panel2); icon(g, ic, x + 170, 252, 32, COL.accent);
        txt(g, h, x + 170, 314, { size: 22, weight: 800, color: COL.text, align: 'center' });
        txt(g, s, x + 170, 352, { size: 16, weight: 500, color: COL.soft, align: 'center' });
      }));
      fade(g, ramp(u, 24, 0.5), () => {
        chip(g, '미국 표준 발음(General American) · 합성 음성 · 입 그림은 쉽게 줄여 그렸어요', 640, 460, { size: 16, weight: 600, color: COL.muted, fill: COL.panel2, align: 'center' });
      });
    },

    /* 01 들어 보기 */
    listen(g, u) {
      LCARDS.forEach(([a, b, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const x = i % 2 ? 660 : 100, y = i < 2 ? 150 : 316, P = TH.PAIRS.find(p => p.a === a && p.b === b), hl = S.pair === P.id;
        panel(g, x, y, 520, 150, { fill: COL.panel, stroke: hl ? COL.accent : COL.faint, lw: hl ? 2.5 : 1.5 });
        tag(g, TH.POS[P.pos].ko, x + 14, y + 26, COL.muted, { size: 14, h: 28, align: 'left' });
        tag(g, TH.KIND_KO[P.kind], x + 506, y + 26, COL.muted, { size: 14, h: 28, align: 'right' });
        word(g, a, x + 140, y + 80, 44, { align: 'center' });
        word(g, b, x + 380, y + 80, 44, { align: 'center' });
        txt(g, '↔', x + 260, y + 80, { size: 26, weight: 700, color: COL.muted, align: 'center' });
        txt(g, gloss(a), x + 140, y + 126, { size: 15, color: COL.muted, align: 'center' });
        txt(g, gloss(b), x + 380, y + 126, { size: 15, color: COL.muted, align: 'center' });
        const pulse = win(u, 6, 12) * (u < 12 ? 1 : 0);
        if (pulse > 0) { waves(g, x + 140 + tw(g, a, 44, 700) / 2 + 12, y + 80, COL.a, pulse, u + i); waves(g, x + 380 + tw(g, b, 44, 700) / 2 + 12, y + 80, COL.b, pulse, u + i + 0.5); }
      }));
      fade(g, win(u, 6, 12), () => {
        circ(g, 640, 500, 24, COL.panel2); icon(g, 'spk', 640, 500, 26, COL.accent);
        txt(g, '낱말을 누르면 들려요 · 같은 낱말을 곧바로 다시 누르면 천천히', 640, 548, { size: 17, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 24.5, 31.2), () => {
        chip(g, '듣기 연구 → 바람 th 소리는 f 소리로, 울림 th 소리는 d 소리로 듣는 일이 많았어요', 640, 512, { size: 18, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '한국어를 쓰는 영어 학습자 · 근거와 한계 → 페이지 아래 각주', 640, 556, { size: 15, color: COL.muted, align: 'center' });
      });
      fade(g, ramp(u, 31, 0.5), () => {
        txt(g, '같은 짝, 목소리 넷', 640, 500, { size: 18, weight: 700, color: COL.soft, align: 'center' });
        TH.VOICES.forEach((v, i) => {
          const x = 250 + i * 260, hl = S.voice === v.sp;
          const c = chip(g, v.ko, x, 548, { size: 17, fill: COL.panel2, stroke: hl ? COL.accent : COL.line, align: 'center', pad: 34 });
          icon(g, 'spk', c.x + 20, 548, 18, COL.accent);
          listen(c.x, c.y, c.w, c.h, [{ text: 'think', sp: v.sp }, { text: 'sink', sp: v.sp, gap: 0.6 }]);
        });
      });
    },

    /* 02 ㅅ 하나, ㄷ 하나 */
    korean(g, u) {
      const pick = S.kpair ? TH.pairById(S.kpair) : null;
      fade(g, ramp(u, 0.4, 0.5), () => {
        panel(g, 80, 145, 560, 290, { fill: COL.panel, stroke: COL.faint });
        tag(g, '바람 th 소리 → ㅅ', 214, 180, COL.a, { align: 'center', size: 17, h: 38 });
        fade(g, pick ? 1 : ramp(u, 6, 0.5), () => tag(g, '울림 th 소리 → ㄷ', 470, 180, COL.a, { align: 'center', size: 17, h: 38 }));
      });
      const rows = pick ? [[pick.a, pick.b, 0]] : KROWS;
      rows.forEach(([a, b, at], i) => fade(g, pick ? 1 : ramp(u, at, 0.5), () => {
        const y = 236 + i * 54;
        if (pick) panel(g, 92, y - 25, 536, 50, { fill: hex(COL.accent, 0.1), r: 10 });
        koPairRow(g, a, b, y, 28);
      }));
      fade(g, ramp(u, 12.5, 0.5), () => {
        panel(g, 680, 145, 520, 290, { fill: COL.panel, stroke: COL.faint });
        mouth(g, 690, 152, 0.5, 's', { mark: COL.b });
        mouth(g, 945, 152, 0.5, 'th', { teethMark: COL.a });
        txt(g, 's 소리 · 한국어 ㅅ', 790, 356, { size: 18, weight: 700, color: COL.b, align: 'center' });
        txt(g, '혀끝이 윗잇몸 가까이', 790, 390, { size: 15, weight: 600, color: COL.soft, align: 'center' });
        txt(g, 'th 소리', 1065, 356, { size: 18, weight: 700, color: COL.a, align: 'center' });
        txt(g, '혀끝이 윗니 끝에', 1065, 390, { size: 15, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 19, 25.7), () => {
        panel(g, 680, 450, 520, 116, { fill: hex(COL.trap, 0.06), stroke: COL.trap, dash: true });
        koWord(g, 'mouth', 770, 498, 38, { trap: true, align: 'center' });
        txt(g, '라고 말하면', 770, 540, { size: 14, color: COL.muted, align: 'center' });
        arrow(g, 850, 498, 906, 498, COL.muted, 2);
        circ(g, 936, 498, 22, COL.panel2); icon(g, 'ear', 936, 498, 24, COL.soft);
        arrow(g, 968, 498, 1016, 498, COL.muted, 2);
        word(g, 'mouse', 1100, 498, 40, { align: 'center' });
        txt(g, '쥐로 들리기 쉬워요', 1100, 540, { size: 14, color: COL.b, align: 'center' });
      });
      fade(g, ramp(u, 25.5, 0.5), () => {
        panel(g, 680, 450, 520, 116, { fill: COL.panel, stroke: COL.faint });
        mouth(g, 690, 454, 0.3, 't', { mark: COL.b });
        txt(g, 'ㄷ · d 소리', 872, 492, { size: 17, weight: 700, color: COL.b, align: 'center' });
        txt(g, '혀끝으로 막아요', 872, 524, { size: 15, weight: 600, color: COL.soft, align: 'center' });
        mouth(g, 940, 454, 0.3, 'th', { teethMark: COL.a });
        txt(g, '울림 th 소리', 1126, 492, { size: 17, weight: 700, color: COL.a, align: 'center' });
        txt(g, '막지 않아요', 1126, 524, { size: 15, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 32, 37.2), () => ['mouth', 'breathe'].forEach((w, i) => {
        const x = 100 + i * 280;
        word(g, w, x, 478, 30, { pos: 'end' });
        sylRow(g, koSyl(w), x, 532, { size: 18 });
      }));
      fade(g, ramp(u, 37, 0.5), () => {
        tag(g, '혀끝 → 윗니 끝에 가볍게', 360, 480, COL.a, { align: 'center', size: 17, h: 42 });
        tag(g, '막지 않고 바람을 흘려요', 360, 536, COL.a, { align: 'center', size: 17, h: 42 });
      });
    },

    /* 03 바람 th 소리 */
    th(g, u) {
      const sAt = u >= 12 && u < 18;
      const ph = S.thmode || (sAt ? 's' : 'θ');
      fade(g, ramp(u, 0.3, 0.5), () => { bigMouth(g, ph, u, { air: u >= 6 || S.thmode ? undefined : false }); sideViews(g, ph, u); });
      stepList(g, S.thmode === 's' ? [[0.4, '혀끝 → 윗잇몸 가까이 (이에 닿지 않게)'], [6, '혀 가운데 좁은 길로 센 바람 → 높고 센 s 소리'], [12, 'th 소리 → 혀끝을 더 앞으로, 윗니 끝에']]
        : [[0.4, '턱을 조금 내리고 · 혀끝 → 윗니 끝에 가볍게'], [6, '세게 물지 않고 · 그 틈으로 약한 바람'], [12, 's 소리 → 혀끝이 이에 닿지 않고 · 센 바람']], u, 1 - ramp(u, 17.6, 0.4));
      fade(g, win(u, 18, 24.7), () => windBars(g, 520, 362, 680, THS.WIND.th[0], THS.WIND.th[1]));
      fade(g, win(u, 24.5, 31.2), () => {
        word(g, 'think', 600, 420, 44, { align: 'center' });
        txt(g, '=', 700, 420, { size: 34, weight: 700, color: COL.trap, align: 'center' });
        word(g, 'sink', 790, 420, 44, { align: 'center' });
        koWord(g, 'think', 940, 420, 40, { trap: true, align: 'center' });
        txt(g, '혀끝을 잇몸 쪽에 두면 s 소리', 700, 490, { size: 18, weight: 700, color: COL.trap, align: 'center' });
        txt(g, '두 낱말이 같게 들려요', 700, 526, { size: 16, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 31, 37.7), () => {
        txt(g, '거울 → 윗니 아래로 혀끝이 살짝 보여요', 540, 404, { size: 20, weight: 700, color: COL.a });
        txt(g, '바람은 약하게 · 길게', 540, 444, { size: 17, weight: 600, color: COL.soft });
        THS.mlips(g, 560, 468, 0.56, 'th');
        txt(g, 'th 소리 · 혀끝이 보여요', 616, 562, { size: 14, weight: 600, color: COL.a, align: 'center' });
        THS.mlips(g, 800, 468, 0.56, 's');
        txt(g, 's 소리 · 보이지 않아요', 856, 562, { size: 14, weight: 600, color: COL.b, align: 'center' });
      });
      fade(g, win(u, 37.5, 43.2), () => {
        txt(g, '혀끝을 먼저 대고 → 소리를 시작해요', 540, 410, { size: 20, weight: 700, color: COL.a });
        wordRow(g, TH.SETS.thW, 548, 490, 34, 165);
      });
      fade(g, ramp(u, 43, 0.5), () => pairRows(g, TH.SETS.thsPairs));
    },

    /* 04 f 소리 · t 소리와 견주기 */
    ft(g, u) {
      const ph = S.fmode || ((u >= 6 && u < 18.5) || u >= 37.5 ? 'f' : u >= 25 && u < 31 ? 't' : 'θ');
      fade(g, ramp(u, 0.3, 0.5), () => { bigMouth(g, ph, u); sideViews(g, ph, u); });
      stepList(g, S.fmode === 'f' ? [[0.4, '윗니 끝 → 아랫입술 안쪽에 가볍게'], [6, '혀는 쉬어요 · 입술과 이 사이로 약한 바람']]
        : S.fmode === 't' ? [[0.4, '혀끝 → 윗잇몸에 붙여 막기'], [6, '톡 터뜨려요 · 바람이 이어지지 않아요']]
          : [[0.4, 'th 소리 · f 소리 → 둘 다 약한 바람'], [6, 'f 소리 → 윗니 끝을 아랫입술에 · th 소리 → 혀끝을 윗니 끝에']], u, 1 - ramp(u, 11.6, 0.4));
      fade(g, win(u, 12, 18.7), () => windBars(g, 520, 362, 680, THS.WIND.ft[0], THS.WIND.ft[1]));
      fade(g, win(u, 18.5, 25.2), () => pairRows(g, TH.SETS.thfPairs));
      fade(g, win(u, 25, 31.2), () => {
        txt(g, 'th 소리', 540, 400, { size: 18, weight: 800, color: COL.a });
        soundBar(g, 'fric', 640, 400, 540, COL.a, false, u);
        txt(g, '막지 않아요 · 약한 바람이 이어져요', 1180, 440, { size: 15, weight: 600, color: COL.soft, align: 'right' });
        txt(g, 't 소리', 540, 500, { size: 18, weight: 800, color: COL.b });
        soundBar(g, 'stop', 640, 500, 540, COL.b, false, u);
        txt(g, '막았다가 톡 터뜨리며 시작해요', 1180, 540, { size: 15, weight: 600, color: COL.soft, align: 'right' });
      });
      fade(g, win(u, 31, 37.7), () => pairRows(g, TH.SETS.thtPairs));
      fade(g, ramp(u, 37.5, 0.5), () => {
        txt(g, '거울로 확인 → 눈으로는 쉬워요', 540, 404, { size: 20, weight: 700, color: COL.a });
        THS.mlips(g, 560, 440, 0.6, 'f');
        txt(g, 'f 소리 · 아랫입술이 올라와요', 620, 546, { size: 14, weight: 600, color: COL.b, align: 'center' });
        THS.mlips(g, 840, 440, 0.6, 'th');
        txt(g, 'th 소리 · 혀끝이 보여요', 900, 546, { size: 14, weight: 600, color: COL.a, align: 'center' });
      });
    },

    /* 05 울림 th 소리 */
    dh(g, u) {
      const ph = S.dmode || (u >= 18 && u < 24.5 ? 'd' : 'ð');
      fade(g, ramp(u, 0.3, 0.5), () => { bigMouth(g, ph, u); sideViews(g, ph, u); });
      stepList(g, S.dmode === 'θ' ? [[0.4, '같은 혀 · 혀끝 → 윗니 끝에'], [6, '목 울림을 끄면 바람만 → 바람 th 소리'], [12, '목소리를 켜면 다시 울림 th 소리']]
        : S.dmode === 'd' ? [[0.4, '혀끝 → 윗잇몸에 붙여 막기'], [6, '톡 떼면서 시작 → d 소리 (한국어 ㄷ과 비슷)'], [12, '울림 th 소리는 처음부터 막지 않아요']]
          : [[0.4, '바람 th 소리와 같은 혀 · 혀끝 → 윗니 끝에'], [6, '목을 울려요 · 부드럽게 떨리는 소리'], [12, '바람 th 소리를 길게 내다가 목소리를 켜요']], u, 1 - ramp(u, 11.6, 0.4));
      fade(g, win(u, 12, 18), () => {
        txt(g, '아주 흔한 낱말 · 문장마다 나와요', 540, 410, { size: 20, weight: 700, color: COL.a });
        wordRow(g, TH.SETS.dhW, 548, 490, 36, 165);
      });
      fade(g, win(u, 18, 24.7), () => {
        txt(g, '울림 th', 540, 400, { size: 18, weight: 800, color: COL.a });
        soundBar(g, 'fric', 640, 400, 540, COL.a, true, u);
        txt(g, '막지 않아요 · 떨림이 이어져요', 1180, 440, { size: 15, weight: 600, color: COL.soft, align: 'right' });
        txt(g, 'd 소리', 540, 500, { size: 18, weight: 800, color: COL.b });
        soundBar(g, 'stop', 640, 500, 540, COL.b, true, u);
        txt(g, '막았다가 톡 떨어지며 시작해요', 1180, 540, { size: 15, weight: 600, color: COL.soft, align: 'right' });
      });
      fade(g, win(u, 24.5, 31.2), () => {
        koWord(g, 'they', 620, 420, 44, { trap: true, align: 'center' });
        txt(g, '혀끝이 막아요', 620, 472, { size: 16, weight: 600, color: COL.trap, align: 'center' });
        arrow(g, 720, 420, 800, 420, COL.muted, 2);
        word(g, 'they', 900, 420, 44, { align: 'center' });
        txt(g, '윗니 끝에 댄 채 떨림부터', 900, 472, { size: 16, weight: 600, color: COL.a, align: 'center' });
      });
      fade(g, win(u, 31, 37.7), () => pairRows(g, TH.SETS.dhdPairs));
      fade(g, ramp(u, 37.5, 0.5), () => {
        chip(g, '모음 사이에서도 혀끝이 윗니 끝을 스쳐요', 860, 420, { size: 19, color: COL.a, fill: hex(COL.a, 0.1), stroke: COL.a, align: 'center' });
        wordRow(g, TH.SETS.dhMid, 548, 500, 28, 165, { pos: 'mid' });
      });
    },

    /* 06 z 소리와 견주기 */
    dz(g, u) {
      const ph = S.zmode || (u < 6 ? 'z' : 'ð');
      fade(g, ramp(u, 0.3, 0.5), () => { bigMouth(g, ph, u); sideViews(g, ph, u); });
      stepList(g, S.zmode === 'z' ? [[0.4, 'z 소리 → 혀끝이 윗잇몸 가까이 (이에 닿지 않게)'], [6, '좁은 길로 센 바람 + 목 울림 → 또렷한 떨림']]
        : [[0.4, 'z 소리 → 혀끝이 윗잇몸 가까이 · 이에 닿지 않아요'], [6, '울림 th 소리 → 혀끝이 윗니 끝에 · 더 약한 떨림']], u, 1 - ramp(u, 11.6, 0.4));
      fade(g, win(u, 12, 25.2), () => {
        pairRows(g, TH.SETS.dhzPairs, 400, 64);
        fade(g, ramp(u, 13, 0.5), () => TH.SETS.dhzPairs.forEach(([a, b], i) => txt(g, `${gloss(a)} · ${gloss(b)}`, 560, 432 + i * 64, { size: 13, color: COL.muted })));
        fade(g, ramp(u, 18.5, 0.5), () => txt(g, '표기는 달라도 → 소리는 혀끝의 자리로 갈라요', 860, 548, { size: 17, weight: 700, color: COL.a, align: 'center' }));
      });
      fade(g, win(u, 25, 31.7), () => {
        chip(g, '듣기 연구 → 낱말 끝 · 센 음절 뒤의 th 소리가 더 어려웠어요', 860, 430, { size: 18, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '약한 자리일수록 귀를 기울여요', 860, 480, { size: 18, weight: 700, color: COL.a, align: 'center' });
        txt(g, '근거와 한계 → 페이지 아래 각주', 860, 524, { size: 15, color: COL.muted, align: 'center' });
      });
      fade(g, win(u, 31.5, 36.2), () => {
        ['breathe', 'with'].forEach((w, i) => {
          const x = 560 + i * 330;
          word(g, w, x, 420, 34, { pos: 'end' });
          koWord(g, w, x + tw(g, w, 34, 700) + 22, 420, 28, { ins: true, trap: true });
        });
        txt(g, '혀끝을 댄 채 끝 · 으를 붙이지 않아요', 560, 500, { size: 18, weight: 700, color: COL.a });
        txt(g, '분홍 점선 = 한국어식으로 넣은 으', 560, 540, { size: 15, weight: 500, color: COL.ins });
      });
      fade(g, ramp(u, 36, 0.5), () => {
        chip(g, '혀끝이 앞으로 나와 윗니 끝에 닿나 → th 소리', 860, 440, { size: 19, color: COL.a, fill: hex(COL.a, 0.1), stroke: COL.a, align: 'center' });
        txt(g, '잇몸 가까이에 머물면 → s · z 소리', 860, 500, { size: 17, weight: 600, color: COL.b, align: 'center' });
      });
    },

    /* 07 낱말 속 자리 */
    place(g, u) {
      const pw = S.pword;
      PCOLS.forEach(([pos, at], i) => {
        const x = 80 + i * 285, list = TH.SETS.place[pos], on = !pw && u >= at && u < (PCOLS[i + 1] ? PCOLS[i + 1][1] : 37.5);
        fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, at, 0.4)) * (pw ? 0 : 1), () => panel(g, x, 145, 265, 260, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }));
        fade(g, ramp(u, 0.4, 0.5), () => tag(g, TH.POS[pos].ko, x + 132, 172, on ? COL.accent : COL.muted, { align: 'center', size: 15, h: 30 }));
        fade(g, pw ? 1 : ramp(u, at, 0.5), () => {
          panel(g, x, 145, 265, 260, { fill: COL.panel, stroke: on ? COL.accent : COL.faint, lw: on ? 2.5 : 1.5 });
          tag(g, TH.POS[pos].ko, x + 132, 172, on ? COL.accent : COL.muted, { align: 'center', size: 15, h: 30 });
          list.forEach((w, k) => {
            const y = 222 + k * 42, hl = pw === w;
            if (hl) panel(g, x + 8, y - 18, 249, 36, { fill: hex(COL.accent, 0.12), r: 8 });
            word(g, w, x + 18, y, 24, { pos });
            koWord(g, w, x + 247, y, 20, { align: 'right', ins: true });
          });
        });
      });
      if (pw) {
        const e = TH.entry(pw), ks = koSyl(pw), en = TH.syl(pw);
        word(g, pw, 100, 470, 40);
        txt(g, `${ipa(pw)} · ${gloss(pw)}`, 100, 518, { size: 16, color: COL.muted });
        txt(g, TH.sounds(pw).map(L => `${TH.LONG[L.ph]} · ${TH.POS[L.pos].ko}`).join('   '), 100, 556, { size: 16, weight: 700, color: COL.a });
        txt(g, `영어 ${en} 음절`, 560, 470, { size: 16, weight: 700, color: COL.a });
        sylRow(g, e.syl.map(s => ({ t: s.ph.join(''), color: COL.a })), 700, 470, { size: 20 });
        txt(g, `한국어식 ${ks.length} 음절`, 560, 535, { size: 16, weight: 700, color: ks.length > en ? COL.ins : COL.soft });
        sylRow(g, ks, 700, 535, { size: 20 });
        return;
      }
      fade(g, win(u, 6, 12), () => {
        txt(g, '혀끝을 윗니 끝에 먼저 → 그다음 소리', 100, 480, { size: 19, weight: 700, color: COL.a });
        txt(g, '낱말을 누르면 들려요', 100, 520, { size: 16, weight: 600, color: COL.soft });
      });
      fade(g, win(u, 12, 18.7), () => {
        word(g, 'three', 100, 490, 34, { pos: 'cluster' });
        sylRow(g, [{ t: 'three', color: COL.a }], 220, 490, { size: 22 });
        txt(g, '1 음절', 220 + sylW(g, [{ t: 'three' }], { size: 22 }) / 2, 540, { size: 15, weight: 600, color: COL.muted, align: 'center' });
        arrow(g, 330, 490, 376, 490, COL.muted, 2);
        const k = koSyl('three'); sylRow(g, k, 390, 490, { size: 22 });
        txt(g, `${k.length} 음절`, 390 + sylW(g, k, { size: 22 }) / 2, 540, { size: 15, weight: 600, color: COL.ins, align: 'center' });
        txt(g, 'th 소리 뒤에 바로 r 소리 · 으 없이', 620, 490, { size: 18, weight: 700, color: COL.a });
      });
      fade(g, win(u, 18.5, 24.7), () => {
        const c = (u % 2.6) / 2.6, k = c < 0.35 ? 0 : c < 0.7 ? ease((c - 0.35) / 0.35) : 1;
        mouth(g, 100, 424, 0.36, M.mix('th', 'r', k), k < 0.5 ? { teethMark: COL.a } : {});
        word(g, 'three', 290, 470, 36, { pos: 'cluster' });
        koWord(g, 'three', 290, 520, 28, { ins: true });
        txt(g, '혀끝을 이에서 떼면서 → 곧바로 r 모양', 520, 470, { size: 19, weight: 700, color: COL.a });
        txt(g, '한 박자 · 사이에 모음이 없어요', 520, 512, { size: 17, weight: 600, color: COL.soft });
      });
      fade(g, win(u, 24.5, 31.2), () => {
        txt(g, '모음 사이 → 짧게 지나가요', 100, 470, { size: 19, weight: 700, color: COL.a });
        txt(g, '혀끝이 윗니 끝을 스쳐요', 100, 512, { size: 17, weight: 600, color: COL.soft });
        wordRow(g, TH.SETS.place.mid, 640, 490, 32, 190, { pos: 'mid' });
      });
      fade(g, win(u, 31, 37.7), () => TH.SETS.place.end.forEach((w, i) => {
        const x = 100 + i * 280, k = koSyl(w);
        word(g, w, x, 460, 30, { pos: 'end' });
        sylRow(g, k, x, 515, { size: 18 });
      }));
      fade(g, ramp(u, 37.5, 0.5), () => {
        chip(g, '끝 자음 뒤에 으를 넣지 않기 → 끝소리 튜토리얼', 640, 480, { size: 19, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '영어는 약한 바람이나 떨림으로 끝내요', 640, 534, { size: 17, weight: 700, color: COL.a, align: 'center' });
      });
    },

    /* 08 외래어 함정 */
    loan(g, u) {
      LROWS.forEach((row, ri) => {
        const t = LTRAPS[ri], at = LAT[t];
        row.forEach((w, ci) => {
          const x = 80 + ci * 285, y = 145 + ri * 84, hl = S.loan === w, at2 = at + ci * 0.3;
          fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, at2, 0.4)) * (S.loan ? 0 : 1), () => panel(g, x, y, 265, 76, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }));
          fade(g, S.loan ? 1 : ramp(u, at2, 0.5), () => {
            panel(g, x, y, 265, 76, { fill: COL.panel, stroke: hl ? COL.accent : COL.faint, lw: hl ? 2.5 : 1.5 });
            koWord(g, w, x + 16, y + 26, fit(g, TH.entry(w).ko, 24, 112, 700), { trap: true });
            if (t === 'tt') wordTT(g, w, x + 249, y + 26, fit(g, w, 26, 124, 700));
            else word(g, w, x + 249, y + 26, fit(g, w, 26, 124, 700), { align: 'right' });
            tag(g, TH.TRAP[t].ko, x + 16, y + 56, t === 'tt' ? COL.b : COL.trap, { size: 13, h: 24, align: 'left' });
            txt(g, ipa(w), x + 249, y + 56, { size: fit(g, ipa(w), 15, 120, 400, 11, FM), fam: FM, color: COL.muted, align: 'right' });
          });
        });
      });
      fade(g, win(u, 31, 37.7), () => {
        word(g, 'three', 300, 525, 30, { align: 'right' }); koWord(g, 'three', 316, 525, 26);
        txt(g, '·', 410, 525, { size: 24, color: COL.muted, align: 'center' });
        word(g, 'free', 500, 525, 30, { align: 'right' }); koWord(g, 'free', 516, 525, 26);
        txt(g, '모든 짝이 같은 표기는 아니에요 → 그래도 혀끝의 자리로 갈라요', 1200, 525, { size: 17, weight: 600, color: COL.soft, align: 'right' });
      });
      fade(g, ramp(u, 37.5, 0.5), () => {
        chip(g, '한국어 표기를 잠시 잊고 → 혀끝을 윗니 끝에 먼저', 640, 525, { size: 19, color: COL.a, fill: hex(COL.a, 0.08), stroke: COL.a, align: 'center' });
      });
    },

    /* 09 문장 속에서 */
    sentence(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      if (S.sent != null) {
        const s = TH.SENT[S.sent], c = TH.countIn(s.en);
        tag(g, TH.GROUPS[s.grp], 640, 230, COL.muted, { align: 'center', size: 16, h: 32 });
        sentence(g, s.en, 640, 320, 44, { align: 'center', maxW: 1100 });
        txt(g, s.ko, 640, 390, { size: 20, weight: 600, color: COL.soft, align: 'center' });
        counts(g, c, 640 + 90, 450, 18);
        return;
      }
      SROWS.forEach((s, i) => fade(g, ramp(u, s.at, 0.5), () => {
        const y = 190 + i * 88, c = TH.countIn(s.en);
        sentence(g, s.en, 80, y, 36, { maxW: 860 });
        counts(g, c, 1200, y, 17);
      }));
      fade(g, win(u, 31, 37.2), () => {
        chip(g, '약하게 지나가는 낱말에서도 혀끝은 윗니 끝을 스쳐요', 420, 548, { size: 17, color: COL.a, fill: hex(COL.a, 0.08), stroke: COL.a, align: 'center' });
        wordRow(g, ['the', 'this', 'that'], 760, 548, 30, 130);
      });
      fade(g, ramp(u, 37, 0.5), () => chip(g, '따라 말하기 28문장 → 바람 th / 울림 th / 가운데 · 끝 / 섞어서, 일곱 문장씩', 640, 548, { size: 17, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' }));
    },

    /* 10 정리 */
    summary(g, u) {
      const X = [80, 330, 770], Y0 = 145;
      fade(g, ramp(u, 0.3, 0.5), () => {
        panel(g, 60, Y0, 1160, 330, { fill: COL.panel, stroke: COL.faint });
        mouth(g, X[1] + 4, Y0 + 4, 0.24, 'th', { teethMark: COL.a });
        mouth(g, X[2] + 4, Y0 + 4, 0.24, 'th', { teethMark: COL.a, voice: u });
        txt(g, '바람 th 소리', X[1] + 120, Y0 + 46, { size: 22, weight: 800, color: COL.a });
        txt(g, '울림 th 소리', X[2] + 120, Y0 + 46, { size: 22, weight: 800, color: COL.a });
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + 98, 1120, 1);
      });
      const rows = [
        ['① 듣고 가르기', 's 소리보다 훨씬 약한 바람 · f 소리와 비슷', 'd 소리처럼 막히지 않고 떨림이 이어짐', 0.4],
        ['② 혀끝의 자리', '혀끝을 윗니 끝에 가볍게 · 막지 않음', '같은 혀 + 목 울림', 6],
        ['③ 낱말 속에서', 'ㅅ으로 바꾸지 않기 · 끝에 으 없이', 'ㄷ으로 막지 않기 · 끝에 으 없이', 12],
      ];
      rows.forEach(([h, a, b, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = Y0 + 140 + i * 66;
        txt(g, h, X[0] + 16, y, { size: 19, weight: 800, color: COL.text });
        txt(g, a, X[1] + 4, y, { size: fit(g, a, 18, 420, 600), weight: 600, color: COL.a });
        txt(g, b, X[2] + 4, y, { size: fit(g, b, 18, 420, 600), weight: 600, color: COL.a });
      }));
      fade(g, win(u, 18, 24.2), () => {
        chip(g, '연구 → th 소리를 바꿔 말해도 알아듣기에 주는 영향은 작은 편이었어요', 640, 510, { size: 17, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '근거와 한계 → 페이지 아래 각주', 640, 552, { size: 15, color: COL.muted, align: 'center' });
      });
      fade(g, ramp(u, 24, 0.5), () => txt(g, '목표 = 듣는 사람이 헷갈리지 않는 소리', 640, 510, { size: 19, weight: 700, color: COL.soft, align: 'center' }));
      fade(g, ramp(u, 30, 0.5), () => chip(g, '입 그림은 쉽게 줄인 그림 · 거울로 혀끝이 보이는지, 목에 손을 대어 울림을 확인해요', 640, 552, { size: 16, color: COL.muted, fill: COL.panel2, align: 'center' }));
    },
  };
  THS.SCENES = SCENES;

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
    return lines.length;
  }
  THS.captionLines = (g, text) => drawCaption(g, text);

  THS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[THS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, THS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + TH.allText() + MLAB.join('') + Object.values(AIR).join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔≈≠✓×?!~=+-–—/:…‘’\'%&<>|ɹɝɚəæɑɔɪʊʌɛŋθðʃʒˈˌ';
  THS.baseText = EXTRA;
  THS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = THS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { THS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
