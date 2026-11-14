/* ㅅ · ㅈ 너머 — s · sh · z · zh · y — 영상 장면과 자막 (SZS)
 * 그림은 시간 t와 사용자 상태(S)만의 함수예요. 낱말 속 s · sh · z · zh · j · y 글자 칠하기 · 한글 표기 · 자리는 규칙 엔진(SZ)이 계산하고,
 * 입 그림은 공통 부품 EN.mouth(../shared/mouth.js)가 그려요(s · z = 's' 자세, sh · zh = 'sh' 자세, j = 'dj' 자세, y = 'y' 자세).
 * 역할 색: s · z · zh · y 소리(이 편의 소리) 노랑 · sh · j 소리(짝 소리) 하늘 · 한국어식 소리(함정 · 빠진 y) 주황 · 넣은 으 · 이 분홍 점선
 * 03장의 ‘바람 소리의 높이’ 막대는 미리 만든 음성 파일을 잰 값(SZV.meas의 fc)으로만 그려요.
 */
(function () {
  'use strict';
  const SZ = window.SZ, M = window.EN.mouth;
  const SZS = (window.SZS = {});
  const W = 1280, H = 720;
  SZS.W = W; SZS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  SZS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    a: '#FFC15E', b: '#6EC8FF', ins: '#FF7AA8', str: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  SZS.COL = COL;
  // 소리 → 색: s · z · zh · y 노랑(이 편의 소리) · sh · j 하늘(짝 소리) · 빠진 y(y0) 주황
  const PCOL = { s: COL.a, z: COL.a, 'ʒ': COL.a, j: COL.a, 'ʃ': COL.b, 'dʒ': COL.b, y0: COL.trap, a: COL.a };
  SZS.PCOL = PCOL;
  const NAME = SZ.NAME;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (SZS.S = { pair: null, kpair: null, spose: null, zmode: null, zhmode: null, ymode: null, pword: null, loan: null, sent: null, voice: null });
  SZS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  SZS.hits = () => HITS;

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
  SZS.hex = hex;

  /* ---------- 아이콘 — 24×24 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요 ---------- */
  const ICON = {
    spk: [['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'f'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
    ear: [['M7.5 9.5a4.5 4.5 0 1 1 9 0c0 3.1-3 3.7-3 6.6a2.7 2.7 0 0 1-5.1 1.1'], ['M10.5 10a1.6 1.6 0 1 1 3 .9']],
    mouth: [['M3.5 12c2.6-3.2 5.3-4.4 8.5-4.4s5.9 1.2 8.5 4.4c-2.6 3.2-5.3 4.4-8.5 4.4S6.1 15.2 3.5 12z'], ['M3.5 12h17']],
    text: [['M4 6.5h16M4 10.5h16M4 14.5h11M4 18.5h7']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z'], ['M6 11a6 6 0 0 0 12 0'], ['M12 17v3.5M9 20.5h6']],
    lips: [['M3.5 12c2.2-3 4.6-4.6 6.2-4.6 1 0 1.6.6 2.3.6s1.3-.6 2.3-.6c1.6 0 4 1.6 6.2 4.6-2.6 3.2-5.3 4.4-8.5 4.4S6.1 15.2 3.5 12z'], ['M7 12h10']],
  };
  SZS.ICON = ICON;
  const P2D = {};
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const k = size / 24;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    (ICON[id] || []).forEach(([d, m]) => { const p = P2D[d] || (P2D[d] = new Path2D(d)); if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  SZS.icon = icon;
  SZS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;
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
  SZS.mouth = mouth;
  SZS.mlips = (g, x, y, s, pose, o = {}) => M.lips(g, x, y, s, pose, o);
  SZS.mtop = (g, x, y, s, pose, o = {}) => M.top(g, x, y, s, pose, o);
  // 소리 → 입 자세 · 목 울림 (엔진의 SZ.MOUTH)
  const poseOf = ph => (SZ.MOUTH[ph] || SZ.MOUTH.s).pose;
  const voiced = ph => !!(SZ.MOUTH[ph] || {}).voice;
  SZS.poseOf = poseOf;
  // y → 다음 모음으로 내려가는 움직임(2.4초마다): 높이 올린 혀 → 모음
  const yGlide = (u, to = 'eh') => { const c = (u % 2.4) / 2.4; return M.mix('y', to, c < 0.4 ? 0 : c < 0.75 ? ease((c - 0.4) / 0.35) : 1); };
  // 혀 설명 (그림의 계산 EN.mouth.contact와 같은 결과): [닿나, 어디]
  function tongueLines(pose) {
    const c = M.contact(pose);
    if (c.touch) return ['혀가 닿아요', `${c.where}에 붙였다가 떼요`];
    const where = c.where === '윗잇몸' && c.at[0] > 132 ? '윗잇몸 뒤쪽' : c.where;
    return ['혀가 닿지 않아요', `${where} 가까이`];
  }
  SZS.tongueLines = tongueLines;
  const AIR = { s: '가운데 좁은 길 · 센 바람', z: '좁은 길 · 떨리는 바람', 'ʃ': '넓은 길 · 낮은 바람', 'ʒ': '넓은 길 · 떨리는 바람', 'dʒ': '막았다가 떼며 시작', j: '곧바로 다음 모음으로', y0: '혀를 미리 올리지 않아요' };
  SZS.AIR = AIR;

  /* ---------- 낱말 · 한글 · 문장 그리기 ---------- */
  // 영어 낱말: s · sh · z · zh · j · y 소리를 적은 글자만 칠하고 밑줄. o.only = 'a' | 'b' · o.pos = 그 자리만
  function word(g, w, x, y, size, o = {}) {
    const e = SZ.entry(w), shown = e ? e.w === e.key ? w : e.w : w;
    const wt = o.weight || 700, sp = SZ.spans(w).filter(s => !s.bad);
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
  SZS.word = word;
  // 한글 표기: 한글이 적은 영어 소리(노랑 · 하늘 · 빠진 y 주황), o.trap이면 모두 주황, o.ins면 넣은 으 · 이 음절에 분홍 점선 상자
  function koWord(g, w, x, y, size, o = {}) {
    const e = SZ.entry(w), ko = o.ko || (e && e.ko) || '';
    const marks = o.ko ? [] : SZ.koMarks(w), ins = o.ins && !o.ko ? SZ.koInserted(w) : [];
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
  SZS.koWord = koWord;
  // 문장: s · sh · z · zh · j · y 소리를 적은 글자만 칠함
  function sentence(g, text, x, y, size, o = {}) {
    const segs = SZ.segs(text), wt = o.weight || 600;
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
  SZS.sentence = sentence;
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
  // 한국어식 음절 상자: 넣은 으 · 이는 분홍 점선, 소리를 적은 음절은 그 색, 나머지는 주황(한국어식)
  function koSyl(w) {
    const e = SZ.entry(w), ins = SZ.koInserted(w), marks = SZ.koMarks(w);
    return [...(e.ko || '')].map((ch, i) => ({ t: ch, ins: ins.indexOf(i) >= 0, color: ins.indexOf(i) >= 0 ? null : marks[i] ? PCOL[marks[i]] : COL.trap }));
  }
  SZS.koSyl = koSyl;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(IPA)는 자막에 쓰지 않음
     영어 낱말 바로 뒤에 조사를 붙이지 않아요(소리 내어 읽을 때 어색해서) — → 나 ‘s 소리’로 이어요.
     ㅅ · ㅈ은 음성 해설에서 시옷 · 지읒으로 읽어요(app.js의 NARR).
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: 'ㅅ · ㅈ 너머 — s · sh · z · zh · y', d: 30, caps: [
      [0.4, 6, '보다 see, 그녀 she. 한국어로 적으면 둘 다 시예요.'],
      [6, 12, '해 year, 귀 ear → 둘 다 이어예요. 한국어식으로 적으면 y 소리가 사라져요.'],
      [12, 18, 'ㅅ과 ㅈ 두 글자가 영어 소리 다섯을 맡아요 → s · sh 소리는 ㅅ, z · zh · j 소리는 ㅈ.'],
      [18, 24, '세 단계로 익혀요. 듣고 가르고, 혀의 자리를 만들고, 낱말과 문장 속에서 써요.'],
      [24, 30, '미국 표준 발음을 기준으로 해요. 소리는 모두 합성 음성이고, 입 그림은 쉽게 줄여 그렸어요.'],
    ] },
    { id: 'listen', n: '01', title: '들어 보기 · 구별되나요?', sub: '① 듣고 가르기 · 짝 낱말 · 목소리 넷', d: 38, caps: [
      [0.4, 6, '먼저 귀부터 시험해요. 짝 낱말 둘은 소리 하나만 달라요 → see · she, sip · ship.'],
      [6, 12, '화면의 낱말을 눌러 들어 보세요. 같은 낱말을 곧바로 다시 누르면 천천히 들려줘요.'],
      [12, 18, 'z 소리와 j 소리도 짝이 있어요 → zest · jest. 열정과 농담이에요.'],
      [18, 24.5, 'y 소리가 있고 없는 짝도 있어요 → year · ear. 해와 귀예요.'],
      [24.5, 31, '한국어를 쓰는 학습자의 발음 연구에서도, 이 앞의 s 소리를 sh 소리로 내는 일이 많았어요.'],
      [31, 38, '여러 목소리로 짝을 듣고 고르는 연습이 도움이 돼요. 아래 놀이터의 **듣고 가르기 훈련**이 그 연습이에요.'],
    ] },
    { id: 'korean', n: '02', title: 'ㅅ 하나, ㅈ 하나', sub: 's · sh → ㅅ · z · zh · j → ㅈ · 이 앞의 y → 빠짐', d: 42, caps: [
      [0.4, 6, '한국어는 ㅅ 하나로 s 소리와 sh 소리를 모두 적어요. 이 앞에서는 둘 다 시가 돼요 → see · she.'],
      [6, 12.5, 'ㅈ 하나로는 z · zh · j 소리를 적어요. 그래서 zest · jest → 제스트, lesion · legion → 리전.'],
      [12.5, 19, '한국어 시는 혀를 입천장 쪽으로 넓게 올려요. 그래서 영어 sh 소리에 가깝게 들려요.'],
      [19, 25.5, '그래서 시트라고 말하면, 듣는 사람에게는 sheet → 종이 한 장으로 들리기 쉬워요. 자리가 종이가 돼요.'],
      [25.5, 32, 'ㅈ은 혀를 입천장에 붙였다가 떼는 소리예요. 영어 j 소리와 비슷해요. z · zh 소리는 혀가 닿지 않아요.'],
      [32, 37, 'y 소리는 이 앞에서 빠져요. 그래서 year · ear → 이어, yeast · east → 이스트.'],
      [37, 42, '오늘의 작전 → 소리마다 혀의 자리를 따로 정하고, 혀가 닿는지 살펴요.'],
    ] },
    { id: 's', n: '03', title: 's 소리 · sh 소리 — 혀끝은 앞에', sub: '② 혀의 자리 · 앞이면 s · 조금 뒤 + 둥근 입술이면 sh', d: 48, caps: [
      [0.4, 6, 's 소리부터 만들어요. 혀끝을 윗잇몸 가까이 올려요. 닿지는 않아요.'],
      [6, 12, '혀 가운데의 좁은 길로 바람을 세게 보내요. 바람이 윗니에 부딪혀 높은 소리가 나요.'],
      [12, 18, 'sh 소리는 혀를 조금 뒤로 빼고, 혀 앞을 넓게 올려요. 입술은 동그랗게 조금 내밀어요.'],
      [18, 24.5, '그래서 sh 소리는 s 소리보다 낮고 두툼하게 들려요. 네 목소리의 바람 소리를 재어 보면 이렇게 달라요.'],
      [24.5, 31, '함정은 이 앞이에요. 한국어 시처럼 혀를 넓게 올리면 두 낱말이 같게 들려요 → see · she.'],
      [31, 37.5, '요령 → 이 앞에서도 혀끝을 앞에 두고, 입술은 옆으로 벌려요. 바람을 먼저 내고 모음으로 가요.'],
      [37.5, 43, '들어 봐요 → see · seat · sit · city. 혀끝이 앞에 있으면 높은 바람 소리가 나요.'],
      [43, 48, 'sh 소리는 반대로 입술을 내밀어요 → she · sheet · ship · shell.'],
    ] },
    { id: 'z', n: '04', title: 'z 소리 — 혀를 띄우고 목을 울려요', sub: '② 혀의 자리 · s 소리와 같은 혀 + 목 울림 · ㅈ처럼 붙이지 않기', d: 44, caps: [
      [0.4, 6, 'z 소리는 s 소리와 혀의 자리가 똑같아요. 혀끝을 윗잇몸 가까이, 닿지 않게 둬요.'],
      [6, 12, '다른 점은 하나, 목을 울려요. 목에 손을 대면 떨림이 느껴져요. 떨리는 바람 소리예요.'],
      [12, 18, '요령 → s 소리를 길게 내다가 목소리를 켜요. 바람 소리가 지잉 하는 소리로 바뀌어요.'],
      [18, 24.5, 'j 소리와 한국어 ㅈ은 혀를 입천장에 붙였다가 떼요. 막혔다가 톡 떨어지며 시작해요.'],
      [24.5, 31, '그래서 제로라고 말하면 혀가 닿아요. zero → 혀를 띄운 채 떨림부터 시작해요.'],
      [31, 37, '짝으로 들어 봐요 → zest · jest, zig · jig, buzz · budge.'],
      [37, 44, '모음 사이에서도 혀를 띄워요 → busy · easy · music · puzzle. 떨림이 끊기지 않게 이어요.'],
    ] },
    { id: 'zh', n: '05', title: 'zh 소리 — sh 소리 + 목 울림', sub: '② 혀의 자리 · 조금 뒤 · 둥근 입술 · 목 울림 · vision · usually', d: 40, caps: [
      [0.4, 6, 'zh 소리는 sh 소리와 혀의 자리가 같아요. 혀를 조금 뒤로, 입술은 조금 내밀어요.'],
      [6, 12, '여기에 목을 울리면 zh 소리예요. sh 소리를 길게 내다가 목소리를 켜요.'],
      [12, 18.5, '영어 낱말 처음에는 거의 오지 않아요. 가운데에 자주 와요 → vision · usually · measure · casual.'],
      [18.5, 25, '한국어식으로는 ㅈ으로 적어요 → 비전 · 유주얼리. 혀가 닿으면 j 소리가 돼요.'],
      [25, 31, '짝으로 들어 봐요 → lesion · legion. 한국어로는 둘 다 리전이에요.'],
      [31, 36, '연구에서도 목이 울리는 z · zh 소리가 더 어려웠어요. 혀를 띄우는 것이 열쇠예요.'],
      [36, 40, '끝에서는 지라고 적어요 → beige 베이지, massage 마사지. 영어는 떨림으로 끝내요.'],
    ] },
    { id: 'y', n: '06', title: 'y 소리 — 이 앞에서도 혀를 먼저', sub: '② 혀의 자리 · 센입천장 가까이 → 다음 모음 · year ≠ ear', d: 44, caps: [
      [0.4, 6, 'y 소리는 혀 앞을 센입천장 가까이 올렸다가, 곧바로 다음 모음으로 내려가요.'],
      [6, 12, '한국어 야 · 여 · 요 · 유와 비슷해요 → yes 예스, you 유, young 영, yellow 옐로.'],
      [12, 18.5, '함정은 이 앞이에요. year → 이어, yeast → 이스트. 한국어식으로는 y 소리가 사라져요.'],
      [18.5, 25, '그래서 year · ear → 같은 소리로 들리기 쉬워요. 해와 귀가 같아져요.'],
      [25, 31, '영어는 이 앞에서도 y 소리를 내요. 혀를 이 모음보다 더 높이 올렸다가 살짝 내리며 넘어가요.'],
      [31, 37.5, '연구에서도 한국 학습자는 이 앞의 y 소리를 자주 빼곤 했어요. 주된 까닭은 듣기였어요.'],
      [37.5, 44, '짝으로 들어 봐요 → year · ear, yeast · east, yearn · earn.'],
    ] },
    { id: 'place', n: '07', title: '낱말 속 자리', sub: '③ 낱말 속에서 · 처음 · 묶음 · 가운데 · 끝', d: 44, caps: [
      [0.4, 6, '이제 낱말 속에서 써요. 소리가 놓이는 자리는 넷이에요 → 처음, 묶음, 가운데, 끝.'],
      [6, 12, '처음 → see · zero · year. 혀의 자리를 먼저 만들고 소리를 시작해요.'],
      [12, 18.5, '묶음 → street · sleep · smile. s 소리 뒤에 바로 자음을 붙여요. 스트리트처럼 으를 넣지 않아요.'],
      [18.5, 24.5, 'music → m 소리 뒤에 y 소리가 바로 붙어요. 한국어 뮤와 비슷해요.'],
      [24.5, 31, '가운데 → basic · busy · vision. 모음 사이에서는 짧게 지나가요. 혀가 닿지 않게 이어요.'],
      [31, 37.5, '끝 → bus · fish · cheese · beige. 한국어식으로는 끝에 으나 이를 붙여요 → 버스 · 피시 · 치즈 · 베이지.'],
      [37.5, 44, '영어는 바람이나 떨림으로 끝내요. 끝 자음 이야기는 끝소리 튜토리얼에서 더 자세히 다뤄요.'],
    ] },
    { id: 'loan', n: '08', title: '외래어 함정', sub: '③ 낱말 속에서 · 시티 · 제로 · 비전 · 마사지', d: 44, caps: [
      [0.4, 6, '외래어는 한국어식 발음이 입에 붙어 있어 더 조심해요. 네 가지 함정을 봐요.'],
      [6, 12, '이 앞의 s 소리 → 시. city 시티, single 싱글, system 시스템, silk 실크. 혀끝을 앞에 둬요.'],
      [12, 18, 'z 소리 → ㅈ. zero 제로, zoom 줌, puzzle 퍼즐, cheese 치즈. 혀를 띄우고 목을 울려요.'],
      [18, 24.5, 'zh 소리 → ㅈ. vision 비전, casual 캐주얼, leisure 레저, beige 베이지. 혀를 띄워요.'],
      [24.5, 31, '섞어서 → season, music, jazz, massage. 한 낱말에 두 소리가 들어 있어요.'],
      [31, 37.5, '모든 짝이 같은 표기가 되지는 않아요 → sell 셀, shell 셸. 그래도 소리는 혀의 자리로 갈라요.'],
      [37.5, 44, '외래어를 영어로 말할 때는 한국어 표기를 잠시 잊고, 소리마다 혀의 자리를 먼저 정해요.'],
    ] },
    { id: 'sentence', n: '09', title: '문장 속에서', sub: '③ 문장 속에서 · She sells sea shells.', d: 44, caps: [
      [0.4, 6, '문장 속에서는 소리가 빨리 지나가요. 먼저 소리가 어디 있는지 찾아요.'],
      [6, 12.5, 'She sells sea shells. 노란 글자가 s · z 소리, 하늘색 글자가 sh 소리예요.'],
      [12.5, 18.5, '두 번째 낱말 sells → 끝 글자는 철자가 s지만 z 소리예요. 목을 울려요.'],
      [18.5, 25, 'The zoo is closed. z 소리가 셋이에요. 혀를 띄운 채 떨림을 이어요.'],
      [25, 31, 'I usually walk to school. usually → y 소리, 그리고 zh 소리. 혀를 띄워요.'],
      [31, 37, 'See you next year. 이 앞의 y 소리도 빼지 않아요.'],
      [37, 44, '아래 **따라 말하기**에 문장 스물여덟 개가 있어요. 소리 네 묶음, 묶음마다 일곱 문장이에요.'],
    ] },
    { id: 'summary', n: '10', title: '정리', sub: '3단계 발음법 · s · sh · z · zh · y', d: 36, caps: [
      [0.4, 6, '정리해요. ① 듣고 가르기 → s 소리는 높은 바람, sh 소리는 낮은 바람, z · zh 소리는 떨림이 이어져요.'],
      [6, 12, '② 혀의 자리 → s · z 소리는 혀끝을 앞에, sh · zh 소리는 조금 뒤에. 혀는 입천장에 닿지 않아요.'],
      [12, 18, '③ 낱말 속에서 → 이 앞의 시를 조심하고, ㅈ처럼 혀를 붙이지 않고, 이 앞의 y 소리를 살려요.'],
      [18, 24, '목표는 원어민과 똑같은 소리가 아니라, 듣는 사람이 헷갈리지 않는 소리예요.'],
      [24, 30, '입 그림은 쉽게 줄여 그린 것이에요. 거울을 보며 입술 모양과 목 울림을 직접 확인해 보세요.'],
      [30, 36, '아래 **듣고 가르기 훈련**과 **내 발음 확인**에서 직접 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  SZS.CHAPTERS = CHAPTERS; SZS.CAPTIONS = CAPTIONS; SZS.END = END;
  SZS.POSTER = CHAPTERS.find(c => c.id === 'korean').t + 38.5;   // 같은 표기 짝 · 두 입 그림 · ㅈ과 z · 오늘의 작전이 한 화면에
  SZS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  SZS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 900, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 900, 800, 24, FD), weight: 800, fam: FD });
  }
  const gloss = w => (SZ.entry(w) || {}).gloss || '';
  const ipa = w => SZ.ipa(w);
  // 오른쪽 위 범례: s · z · zh · y 노랑 · sh · j 하늘
  function legend(g, a = 1) {
    fade(g, a, () => {
      const r = tag(g, 'sh · j 소리', 1200, 92, COL.b, { align: 'right', size: 15, h: 30 });
      tag(g, 's · z · zh · y 소리', r.x - 12, 92, COL.a, { align: 'right', size: 15, h: 30 });
    });
  }
  // 오른쪽 칸: 위에서 본 혀 + 입술 앞모습 + 소리 카드 (03 ~ 06장). 카드의 글은 그림의 계산(contact)으로
  function sideViews(g, ph, pose, u) {
    const c = PCOL[ph] || COL.a;
    SZS.mtop(g, 520, 148, 0.72, pose, { mark: c, t: u || 0 });
    txt(g, '위에서 본 혀', 592, 322, { size: 14, weight: 600, color: COL.muted, align: 'center' });
    SZS.mlips(g, 680, 176, 0.62, pose);
    txt(g, '입술 앞모습', 742, 280, { size: 14, weight: 600, color: COL.muted, align: 'center' });
    panel(g, 830, 150, 370, 176, { fill: hex(c, 0.08), stroke: c });
    const nm = NAME[ph] || ph;
    txt(g, nm, 900, 236, { size: fit(g, nm, 76, 110, 800, 40, FD), weight: 800, fam: FD, color: c, align: 'center' });
    const T = ph === 'y0' ? ['y 소리 없이', '곧바로 모음으로'] : tongueLines(pose);
    const L = [T[0], T[1], voiced(ph) ? '목이 울려요' : '목은 울리지 않아요', ph === 'y0' ? '' : AIR[ph] || ''];
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
  // 소리 막대: 바람이 이어지는 소리(kind 'fric', voice면 떨림) · 붙였다 떼는 소리(kind 'affr': 닿음 → 톡 → 짧은 바람 → 모음)
  function soundBar(g, kind, x, y, w, color, voice, u) {
    const h = 34;
    const noise = (x0, len) => {
      g.strokeStyle = color; g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k <= len; k += 3) {
        const yy = voice ? Math.sin(k * 0.35 + u * 12) * 9 : ((Math.sin(k * 12.9898 + Math.floor(u * 20)) * 43758.5453) % 1) * 11;
        if (k === 0) g.moveTo(x0 + k, y + yy); else g.lineTo(x0 + k, y + yy);
      }
      g.stroke();
    };
    if (kind === 'fric') {
      panel(g, x, y - h / 2, w, h, { fill: hex(color, 0.12), stroke: color, r: 8 });
      noise(x + 10, w - 20);
    } else {
      const cl = 110, fr = 120;
      panel(g, x, y - h / 2, cl, h, { fill: COL.panel2, stroke: COL.line, r: 8 });
      txt(g, '닿음', x + cl / 2, y, { size: 14, weight: 700, color: COL.muted, align: 'center' });
      g.strokeStyle = color; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x + cl + 8, y + 16); g.lineTo(x + cl + 14, y - 22); g.lineTo(x + cl + 20, y + 16); g.stroke();
      panel(g, x + cl + 28, y - h / 2, fr, h, { fill: hex(color, 0.12), stroke: color, r: 8 });
      noise(x + cl + 36, fr - 16);
      panel(g, x + cl + fr + 36, y - h / 2, w - cl - fr - 36, h, { fill: hex(COL.soft, 0.08), stroke: COL.faint, r: 8 });
      txt(g, '모음', x + cl + fr + 36 + (w - cl - fr - 36) / 2, y, { size: 14, weight: 600, color: COL.muted, align: 'center' });
    }
  }
  // 03장: 잰 바람 소리의 높이(무게중심) — 목소리마다 s(see) · sh(she). 통과한 파일의 잰 값만
  const FC_LO = 2000, FC_HI = 9000;
  SZS.FC_WORDS = ['see', 'she'];
  SZS.fcRows = () => SZ.VOICES.map(v => {
    const a = window.SZV && SZV.meas(v.sp, 'see'), b = window.SZV && SZV.meas(v.sp, 'she');
    return a && b && a.fc && b.fc ? { sp: v.sp, ko: v.ko, s: a.fc, sh: b.fc } : null;
  }).filter(Boolean);
  function fcBars(g, x, y, w) {
    const R = SZS.fcRows();
    txt(g, '바람 소리의 높이 · 이 영상의 합성 음성을 잰 값', x, y, { size: 17, weight: 700, color: COL.soft });
    if (!R.length) { txt(g, '잰 값이 아직 없어요', x, y + 50, { size: 16, color: COL.muted }); return; }
    const bx = x + 130, bw = w - 140, X = f => bx + clamp((f - FC_LO) / (FC_HI - FC_LO)) * bw;
    R.forEach((r, i) => {
      const yy = y + 44 + i * 38;
      txt(g, r.ko, x, yy, { size: 15, weight: 600, color: COL.muted });
      g.fillStyle = hex(COL.a, 0.85); g.fillRect(bx, yy - 12, X(r.s) - bx, 10);
      g.fillStyle = hex(COL.b, 0.85); g.fillRect(bx, yy + 2, X(r.sh) - bx, 10);
    });
    const yb = y + 44 + R.length * 38 - 8;
    g.fillStyle = COL.faint; g.fillRect(bx, yb, bw, 1);
    txt(g, '낮음', bx, yb + 16, { size: 13, weight: 600, color: COL.muted });
    txt(g, '높음', bx + bw, yb + 16, { size: 13, weight: 600, color: COL.muted, align: 'right' });
    const r1 = tag(g, 'sh 소리 · she', bx + bw, y, COL.b, { align: 'right', size: 13, h: 26 });
    tag(g, 's 소리 · see', r1.x - 10, y, COL.a, { align: 'right', size: 13, h: 26 });
  }

  // 01장 짝 카드
  const LCARDS = [['see', 'she', 0.4], ['sip', 'ship', 1.2], ['zest', 'jest', 12], ['year', 'ear', 18]];
  // 02장 같은 표기 줄
  const KROWS = [['see', 'she', 0.8], ['zest', 'jest', 6.4], ['lesion', 'legion', 8.6], ['year', 'ear', 32.2]];
  // 08장 외래어 칸 (줄: 이 앞 s → 시 · z → ㅈ · zh → ㅈ · 섞어서)
  const LTRAPS = ['si', 'z', 'zh', 'mix'];
  const LROWS = LTRAPS.map(t => SZ.LOAN.filter(o => o.trap === t).map(o => o.w));
  const LAT = { si: 6, z: 12, zh: 18, mix: 24.5 };
  SZS.LROWS = LROWS;
  // 09장 문장
  const SROWS = [
    { en: 'She sells sea shells.', at: 6 },
    { en: 'The zoo is closed.', at: 18.5 },
    { en: 'I usually walk to school.', at: 25 },
    { en: 'See you next year.', at: 31 },
  ];
  SZS.SROWS = SROWS;
  // 07장 자리 칸
  const PCOLS = [['start', 6], ['cluster', 12], ['mid', 24.5], ['end', 31]];
  // 소리 수 표시: 0이 아닌 것만 (s 2 · z 2 · sh 2)
  function counts(g, c, x, y, size = 17) {
    let xx = x;
    ['dʒ', 'ʃ', 'j', 'ʒ', 'z', 's'].forEach(k => {   // 오른쪽 정렬이라 거꾸로
      if (!c[k]) return;
      const s = `${NAME[k]} ${c[k]}`;
      txt(g, s, xx, y, { size, weight: 800, color: PCOL[k], align: 'right' });
      xx -= tw(g, s, size, 800) + 16;
    });
  }
  // 짝 한 줄: a · b → 한국어식 표기 (같은 표기 · 다른 표기)
  function koPairRow(g, a, b, y, size = 30) {
    const A = word(g, a, 104, y, size);
    txt(g, '·', A.x + A.w + 12, y, { size: 24, color: COL.muted, align: 'center' });
    word(g, b, A.x + A.w + 24, y, size);
    arrow(g, 370, y, 414, y, COL.muted, 2);
    koWord(g, a, 428, y, size - 4, { trap: true });
    const same = SZ.koSame(a, b);
    tag(g, same ? '같은 표기' : '다른 표기', 620, y, same ? COL.trap : COL.muted, { align: 'right', size: 14, h: 28 });
    if (!same) koWord(g, b, 506, y, size - 8, { trap: true });
  }

  // 03장 31초~: 이 앞의 s 낱말 — 혀끝 앞 · 입술 옆 (작은 입술 그림 둘: s · sh)
  function siRow(g) {
    SZS.mlips(g, 560, 486, 0.5, 's');
    txt(g, 's 소리 · 입술 옆으로', 610, 568, { size: 14, weight: 600, color: COL.a, align: 'center' });
    SZS.mlips(g, 760, 486, 0.5, 'sh');
    txt(g, 'sh 소리 · 입술 내밂', 810, 568, { size: 14, weight: 600, color: COL.b, align: 'center' });
    word(g, 'see', 1000, 500, 40, { align: 'center' });
    word(g, 'city', 1120, 500, 40, { align: 'center' });
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
      pairAt('see', 'she', 0.4, 5.8);
      pairAt('year', 'ear', 6.1, 99);
      fade(g, A * ramp(u, 7.5, 0.5), () => {
        tag(g, 's · sh 소리 → 시', 430, 470, COL.trap, { align: 'center', size: 18, h: 40 });
        tag(g, '이 앞의 y 소리 → 사라짐', 760, 470, COL.trap, { align: 'center', size: 18, h: 40 });
      });
      // 영어 소리 다섯 → 한글 두 자
      fade(g, win(u, 12, 18), () => {
        const rows = [['s', 's', 180], ['ʃ', 'sh', 232], ['z', 'z', 318], ['ʒ', 'zh', 370], ['dʒ', 'j', 422]];
        const box = { s: [820, 206], 'ʃ': [820, 206], z: [820, 370], 'ʒ': [820, 370], 'dʒ': [820, 370] };
        rows.forEach(([ph, nm, y], i) => fade(g, ramp(u, 12.3 + i * 0.35, 0.4), () => {
          const c = chip(g, `${nm} 소리`, 520, y, { size: 20, fill: hex(PCOL[ph], 0.12), stroke: PCOL[ph], color: PCOL[ph], align: 'right' });
          arrow(g, c.x + c.w + 12, y, box[ph][0] - 64, box[ph][1], hex(PCOL[ph], 0.7), 2);
        }));
        [['ㅅ', 206], ['ㅈ', 370]].forEach(([k, y]) => {
          panel(g, 756, y - 52, 128, 104, { fill: hex(COL.trap, 0.12), stroke: COL.trap });
          txt(g, k, 820, y + 2, { size: 60, weight: 800, fam: FD, color: COL.trap, align: 'center' });
        });
        txt(g, '영어 소리 다섯 → 한글 두 자', 1080, 206, { size: 20, weight: 700, color: COL.soft, align: 'center' });
        txt(g, '노랑 = 이 편의 소리 · 하늘 = 짝 소리', 1080, 370, { size: 15, weight: 500, color: COL.muted, align: 'center' });
      });
      const steps = [['ear', '① 듣고 가르기', '짝 낱말이 다르게 들리나'], ['mouth', '② 혀의 자리 만들기', '앞 · 조금 뒤 · 닿나 · 목 울림'], ['text', '③ 낱말 · 문장 속에서', '처음 · 묶음 · 가운데 · 끝']];
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
        const x = i % 2 ? 660 : 100, y = i < 2 ? 150 : 316, P = SZ.PAIRS.find(p => p.a === a && p.b === b), hl = S.pair === P.id;
        panel(g, x, y, 520, 150, { fill: COL.panel, stroke: hl ? COL.accent : COL.faint, lw: hl ? 2.5 : 1.5 });
        tag(g, SZ.POS[P.pos].ko, x + 14, y + 26, COL.muted, { size: 14, h: 28, align: 'left' });
        tag(g, SZ.KIND_KO[P.kind], x + 506, y + 26, COL.muted, { size: 14, h: 28, align: 'right' });
        word(g, a, x + 140, y + 80, 44, { align: 'center' });
        word(g, b, x + 380, y + 80, 44, { align: 'center' });
        txt(g, '↔', x + 260, y + 80, { size: 26, weight: 700, color: COL.muted, align: 'center' });
        txt(g, gloss(a), x + 140, y + 126, { size: 15, color: COL.muted, align: 'center' });
        txt(g, gloss(b), x + 380, y + 126, { size: 15, color: COL.muted, align: 'center' });
        const pulse = win(u, 6, 12) * (u < 12 ? 1 : 0);
        if (pulse > 0) { waves(g, x + 140 + tw(g, a, 44, 700) / 2 + 12, y + 80, COL.a, pulse, u + i); waves(g, x + 380 + tw(g, b, 44, 700) / 2 + 12, y + 80, P.kind === 'y0' ? COL.trap : COL.b, pulse, u + i + 0.5); }
      }));
      fade(g, win(u, 6, 12), () => {
        circ(g, 640, 500, 24, COL.panel2); icon(g, 'spk', 640, 500, 26, COL.accent);
        txt(g, '낱말을 누르면 들려요 · 같은 낱말을 곧바로 다시 누르면 천천히', 640, 548, { size: 17, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 24.5, 31.2), () => {
        chip(g, '발음 연구 → 이 앞의 s 소리를 sh 소리로 내는 일이 많았어요', 640, 512, { size: 19, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '한국어를 쓰는 영어 학습자 · 근거와 한계 → 페이지 아래 각주', 640, 556, { size: 15, color: COL.muted, align: 'center' });
      });
      fade(g, ramp(u, 31, 0.5), () => {
        txt(g, '같은 짝, 목소리 넷', 640, 500, { size: 18, weight: 700, color: COL.soft, align: 'center' });
        SZ.VOICES.forEach((v, i) => {
          const x = 250 + i * 260, hl = S.voice === v.sp;
          const c = chip(g, v.ko, x, 548, { size: 17, fill: COL.panel2, stroke: hl ? COL.accent : COL.line, align: 'center', pad: 34 });
          icon(g, 'spk', c.x + 20, 548, 18, COL.accent);
          listen(c.x, c.y, c.w, c.h, [{ text: 'see', sp: v.sp }, { text: 'she', sp: v.sp, gap: 0.6 }]);
        });
      });
    },

    /* 02 ㅅ 하나, ㅈ 하나 */
    korean(g, u) {
      const pick = S.kpair ? SZ.pairById(S.kpair) : null;
      fade(g, ramp(u, 0.4, 0.5), () => {
        panel(g, 80, 145, 560, 290, { fill: COL.panel, stroke: COL.faint });
        tag(g, 's · sh 소리 → ㅅ', 214, 180, COL.a, { align: 'center', size: 17, h: 38 });
        fade(g, pick ? 1 : ramp(u, 6, 0.5), () => tag(g, 'z · zh · j 소리 → ㅈ', 460, 180, COL.a, { align: 'center', size: 17, h: 38 }));
      });
      const rows = pick ? [[pick.a, pick.b, 0]] : KROWS;
      rows.forEach(([a, b, at], i) => fade(g, pick ? 1 : ramp(u, at, 0.5), () => {
        const y = 236 + i * 54;
        if (pick) panel(g, 92, y - 25, 536, 50, { fill: hex(COL.accent, 0.1), r: 10 });
        koPairRow(g, a, b, y, 28);
      }));
      fade(g, ramp(u, 12.5, 0.5), () => {
        panel(g, 680, 145, 520, 290, { fill: COL.panel, stroke: COL.faint });
        mouth(g, 690, 152, 0.5, 's', { mark: COL.a });
        mouth(g, 945, 152, 0.5, 'sh', { mark: COL.b });
        txt(g, 's 소리', 790, 356, { size: 18, weight: 700, color: COL.a, align: 'center' });
        txt(g, '혀끝이 앞 · 좁은 길', 790, 390, { size: 15, weight: 600, color: COL.soft, align: 'center' });
        txt(g, 'sh 소리 ≈ 한국어 시', 1065, 356, { size: 18, weight: 700, color: COL.b, align: 'center' });
        txt(g, '혀를 넓게 · 조금 뒤로', 1065, 390, { size: 15, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 19, 25.7), () => {
        panel(g, 680, 450, 520, 116, { fill: hex(COL.trap, 0.06), stroke: COL.trap, dash: true });
        koWord(g, 'seat', 760, 498, 40, { trap: true, align: 'center' });
        txt(g, '라고 말하면', 760, 540, { size: 14, color: COL.muted, align: 'center' });
        arrow(g, 830, 498, 900, 498, COL.muted, 2);
        circ(g, 930, 498, 22, COL.panel2); icon(g, 'ear', 930, 498, 24, COL.soft);
        arrow(g, 962, 498, 1010, 498, COL.muted, 2);
        word(g, 'sheet', 1095, 498, 40, { align: 'center' });
        txt(g, '종이 한 장으로 들려요', 1095, 540, { size: 14, color: COL.b, align: 'center' });
      });
      fade(g, ramp(u, 25.5, 0.5), () => {
        panel(g, 680, 450, 520, 116, { fill: COL.panel, stroke: COL.faint });
        mouth(g, 690, 454, 0.3, 'dj', { mark: COL.b });
        txt(g, 'ㅈ · j 소리', 872, 492, { size: 17, weight: 700, color: COL.b, align: 'center' });
        txt(g, '혀가 닿아요', 872, 524, { size: 15, weight: 600, color: COL.soft, align: 'center' });
        mouth(g, 940, 454, 0.3, 's', { mark: COL.a });
        txt(g, 'z · zh 소리', 1126, 492, { size: 17, weight: 700, color: COL.a, align: 'center' });
        txt(g, '닿지 않아요', 1126, 524, { size: 15, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, ramp(u, 37, 0.5), () => {
        tag(g, '혀의 자리 → 앞(s · z) · 조금 뒤(sh · zh)', 360, 480, COL.a, { align: 'center', size: 17, h: 42 });
        tag(g, '혀가 닿는 것은 j 소리(ㅈ)뿐', 360, 536, COL.a, { align: 'center', size: 17, h: 42 });
      });
    },

    /* 03 s 소리 · sh 소리 */
    s(g, u) {
      const shAt = (u >= 12 && u < 18) || (u >= 24.5 && u < 31) || u >= 43;
      const pose = S.spose || (shAt ? 'sh' : 's'), ph = pose === 'sh' ? 'ʃ' : 's';
      fade(g, ramp(u, 0.3, 0.5), () => {
        mouth(g, 60, 150, 0.95, pose, { mark: PCOL[ph], labels: pose === 'sh' ? ['ridge', 'palate', 'lips'] : ['ridge', 'tip'], air: u >= 6 || S.spose ? 'center' : null, t: u });
        sideViews(g, ph, pose, u);
      });
      stepList(g, S.spose === 'sh' ? [[0.4, '혀를 조금 뒤로 · 혀 앞을 넓게 (닿지 않게)'], [6, '입술을 동그랗게 조금 내밀기'], [12, '넓은 길로 바람 → 낮고 두툼한 sh 소리']]
        : [[0.4, '혀끝 → 윗잇몸 가까이 (닿지 않게)'], [6, '혀 가운데 좁은 길로 센 바람 → 높은 소리'], [12, 'sh 소리 → 혀를 조금 뒤로 · 입술을 조금 내밀기']], u, 1 - ramp(u, 17.6, 0.4));
      fade(g, win(u, 18, 24.7), () => fcBars(g, 520, 362, 680));
      fade(g, win(u, 24.5, 31.2), () => {
        word(g, 'see', 600, 420, 44, { align: 'center' });
        txt(g, '=', 690, 420, { size: 34, weight: 700, color: COL.trap, align: 'center' });
        word(g, 'she', 780, 420, 44, { align: 'center' });
        koWord(g, 'see', 920, 420, 40, { trap: true, align: 'center' });
        txt(g, '한국어 시처럼 혀를 넓게 올리면', 690, 490, { size: 18, weight: 700, color: COL.trap, align: 'center' });
        txt(g, '두 낱말이 같게 들려요', 690, 526, { size: 16, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 31, 37.7), () => {
        txt(g, '이 앞에서도 혀끝은 앞 · 입술은 옆으로', 540, 410, { size: 20, weight: 700, color: COL.a });
        txt(g, '바람을 먼저 → 그대로 이 모음으로', 540, 452, { size: 17, weight: 600, color: COL.soft });
        siRow(g);
      });
      fade(g, win(u, 37.5, 43.2), () => {
        txt(g, '혀끝이 앞에 → 높은 바람 소리', 540, 410, { size: 20, weight: 700, color: COL.a });
        wordRow(g, SZ.SETS.sI, 548, 490, 34, 160);
      });
      fade(g, ramp(u, 43, 0.5), () => {
        txt(g, 'sh 소리 → 입술을 내밀어요', 540, 410, { size: 20, weight: 700, color: COL.b });
        wordRow(g, SZ.SETS.shW, 548, 490, 34, 160);
      });
    },

    /* 04 z 소리 */
    z(g, u) {
      const mode = S.zmode;
      const pose = mode ? (mode === 'dj' ? 'dj' : 's') : (u >= 18 && u < 24.5 ? 'dj' : 's');
      const ph = mode === 's' ? 's' : pose === 'dj' ? 'dʒ' : 'z';
      fade(g, ramp(u, 0.3, 0.5), () => {
        mouth(g, 60, 150, 0.95, pose, { mark: PCOL[ph], labels: pose === 'dj' ? ['ridge', 'tip', 'voice'] : ph === 's' ? ['ridge', 'tip'] : ['ridge', 'tip', 'voice'], voice: ph === 's' ? null : u, air: pose === 'dj' ? null : 'center', t: u });
        sideViews(g, ph, pose, u);
      });
      stepList(g, mode === 's' ? [[0.4, '같은 혀 · 혀끝 → 윗잇몸 가까이'], [6, '목 울림을 끄면 바람 소리만 → s 소리'], [12, '목소리를 켜면 다시 z 소리']]
        : mode === 'dj' ? [[0.4, '혀끝 · 혀날을 윗잇몸 뒤에 붙이기'], [6, '톡 떼면서 떨리는 바람 → j 소리 (한국어 ㅈ과 비슷)'], [12, 'z 소리는 처음부터 붙이지 않아요']]
          : [[0.4, 's 소리와 같은 혀 · 혀끝 → 윗잇몸 가까이'], [6, '목을 울려요 · 떨리는 바람 소리'], [12, 's 소리를 길게 내다가 목소리를 켜요']], u, 1 - ramp(u, 17.6, 0.4));
      fade(g, win(u, 12, 18), () => {
        chip(g, 's —', 548, 520, { size: 22, fill: hex(COL.a, 0.12), stroke: COL.a, color: COL.a, align: 'left' });
        arrow(g, 630, 520, 700, 520, COL.muted, 2);
        txt(g, '목소리 켜기', 665, 494, { size: 14, weight: 600, color: COL.str, align: 'center' });
        chip(g, 'z —', 712, 520, { size: 22, fill: hex(COL.str, 0.14), stroke: COL.str, color: COL.a, align: 'left' });
        arrow(g, 794, 520, 850, 520, COL.muted, 2);
        word(g, 'zoo', 866, 520, 36);
      });
      fade(g, win(u, 18, 24.7), () => {
        txt(g, 'z 소리', 540, 400, { size: 18, weight: 800, color: COL.a });
        soundBar(g, 'fric', 640, 400, 540, COL.a, true, u);
        txt(g, '혀를 띄운 채 떨림이 이어져요', 1180, 440, { size: 15, weight: 600, color: COL.soft, align: 'right' });
        txt(g, 'j 소리', 540, 500, { size: 18, weight: 800, color: COL.b });
        soundBar(g, 'affr', 640, 500, 540, COL.b, true, u);
        txt(g, '붙였다가 톡 떨어지며 시작해요', 1180, 540, { size: 15, weight: 600, color: COL.soft, align: 'right' });
      });
      fade(g, win(u, 24.5, 31.2), () => {
        koWord(g, 'zero', 620, 420, 44, { trap: true, align: 'center' });
        txt(g, '혀가 닿아요', 620, 472, { size: 16, weight: 600, color: COL.trap, align: 'center' });
        arrow(g, 720, 420, 800, 420, COL.muted, 2);
        word(g, 'zero', 900, 420, 44, { align: 'center' });
        txt(g, '혀를 띄운 채 떨림부터', 900, 472, { size: 16, weight: 600, color: COL.a, align: 'center' });
      });
      fade(g, ramp(u, 31, 0.5) * (1 - ramp(u, 36.8, 0.3)), () => SZ.SETS.zjPairs.forEach(([a, b], i) => {
        const y = 400 + i * 58;
        word(g, a, 560, y, 32); txt(g, '·', 700, y, { size: 24, color: COL.muted, align: 'center' }); word(g, b, 724, y, 32);
        koWord(g, a, 900, y, 24, { trap: true });
        if (!SZ.koSame(a, b)) koWord(g, b, 990, y, 20, { trap: true });
        txt(g, SZ.koSame(a, b) ? '둘 다 같은 표기' : '표기가 달라요', 1190, y, { size: 14, weight: 600, color: COL.muted, align: 'right' });
      }));
      fade(g, ramp(u, 37, 0.5), () => {
        chip(g, '모음 사이에서도 혀를 띄우고 떨림을 이어요', 860, 430, { size: 19, color: COL.a, fill: hex(COL.a, 0.1), stroke: COL.a, align: 'center' });
        wordRow(g, SZ.SETS.zMid, 560, 510, 32, 160, { pos: 'mid' });
      });
    },

    /* 05 zh 소리 */
    zh(g, u) {
      const mode = S.zhmode;
      const pose = mode === 'dj' ? 'dj' : 'sh';
      const ph = mode === 'sh' ? 'ʃ' : pose === 'dj' ? 'dʒ' : 'ʒ';
      fade(g, ramp(u, 0.3, 0.5), () => {
        mouth(g, 60, 150, 0.95, pose, { mark: PCOL[ph], labels: ph === 'ʃ' ? ['ridge', 'palate', 'lips'] : ['ridge', 'lips', 'voice'], voice: ph === 'ʃ' ? null : u, air: pose === 'dj' ? null : 'center', t: u });
        sideViews(g, ph, pose, u);
      });
      stepList(g, mode === 'sh' ? [[0.4, '같은 혀 · 조금 뒤로 · 입술 조금 내밀기'], [6, '목 울림을 끄면 → sh 소리']]
        : mode === 'dj' ? [[0.4, '혀를 붙였다가 떼면 → j 소리'], [6, 'zh 소리는 혀가 닿지 않아요']]
          : [[0.4, 'sh 소리와 같은 혀 · 조금 뒤로 · 입술 조금 내밀기'], [6, '목을 울려요 → zh 소리 (혀는 닿지 않게)']], u, 1 - ramp(u, 11.6, 0.4));
      fade(g, win(u, 12, 18.7), () => {
        txt(g, '처음에는 거의 없어요 · 가운데에 자주', 540, 410, { size: 20, weight: 700, color: COL.a });
        wordRow(g, SZ.SETS.zh, 548, 490, 30, 160);
      });
      fade(g, win(u, 18.5, 25.2), () => {
        ['vision', 'usually'].forEach((w, i) => {
          const x = 640 + i * 300;
          word(g, w, x, 410, 36, { align: 'center' });
          koWord(g, w, x, 466, 32, { align: 'center' });
        });
        txt(g, '한국어식 ㅈ → 혀가 닿으면 j 소리가 돼요', 790, 526, { size: 18, weight: 700, color: COL.trap, align: 'center' });
      });
      fade(g, win(u, 25, 31.2), () => {
        word(g, 'lesion', 640, 420, 40, { align: 'center' });
        txt(g, '·', 790, 420, { size: 28, color: COL.muted, align: 'center' });
        word(g, 'legion', 940, 420, 40, { align: 'center' });
        txt(g, `${gloss('lesion')} · ${gloss('legion')}`, 790, 470, { size: 15, color: COL.muted, align: 'center' });
        koWord(g, 'lesion', 790, 524, 32, { trap: true, align: 'center' });
        tag(g, SZ.koSame('lesion', 'legion') ? '같은 표기' : '다른 표기', 1060, 524, COL.trap, { align: 'center', size: 14, h: 28 });
      });
      fade(g, win(u, 31, 36.2), () => {
        chip(g, '연구 → 목이 울리는 z · zh 소리가 더 어려웠어요', 860, 430, { size: 18, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '열쇠 → 혀를 띄우기', 860, 480, { size: 18, weight: 700, color: COL.a, align: 'center' });
        txt(g, '근거와 한계 → 페이지 아래 각주', 860, 524, { size: 15, color: COL.muted, align: 'center' });
      });
      fade(g, ramp(u, 36, 0.5), () => {
        SZ.SETS.zhEnd.forEach((w, i) => {
          const x = 560 + i * 320;
          word(g, w, x, 420, 34);
          koWord(g, w, x + tw(g, w, 34, 700) + 22, 420, 28, { ins: true, trap: true });
        });
        txt(g, '떨림으로 끝 · 이를 붙이지 않아요', 560, 500, { size: 18, weight: 700, color: COL.a });
        txt(g, '분홍 점선 = 한국어식으로 넣은 이', 560, 540, { size: 15, weight: 500, color: COL.ins });
      });
    },

    /* 06 y 소리 */
    y(g, u) {
      const mode = S.ymode;
      const drop = mode === 'y0' || (!mode && u >= 12 && u < 25);
      const pose = drop ? 'ih' : mode === 'y' ? yGlide(u, 'ih') : u < 6 ? 'y' : yGlide(u, u >= 25 && u < 31 ? 'ih' : 'eh');
      const ph = drop ? 'y0' : 'j';
      fade(g, ramp(u, 0.3, 0.5), () => {
        mouth(g, 60, 150, 0.95, pose, { mark: drop ? null : COL.a, labels: ['palate', 'tip'], voice: u, t: u });
        sideViews(g, ph, drop ? 'ih' : 'y', u);
      });
      stepList(g, drop ? [[0.4, 'y 소리를 빼면 곧바로 이 모음 → ear처럼'], [6, '영어 year → 혀를 먼저 더 높이 올려요']]
        : [[0.4, '혀 앞 → 센입천장 가까이 (닿지 않게)'], [3, '곧바로 다음 모음으로 내려가요']], u, 1 - ramp(u, 5.6, 0.4));
      fade(g, win(u, 6, 12), () => SZ.SETS.yGlide.forEach((w, i) => {
        const x = 560 + i * 160;
        word(g, w, x, 410, 30);
        koWord(g, w, x, 456, 24);
      }));
      fade(g, win(u, 12, 18.7), () => {
        SZ.SETS.yI.forEach((w, i) => {
          const x = 640 + i * 220;
          word(g, w, x, 400, 36, { align: 'center' });
          koWord(g, w, x, 456, 32, { align: 'center' });
        });
        txt(g, '이 앞에서 y 소리가 사라져요 (주황 = 빠진 자리)', 860, 520, { size: 18, weight: 700, color: COL.trap, align: 'center' });
      });
      fade(g, win(u, 18.5, 25.2), () => {
        word(g, 'year', 640, 420, 44, { align: 'center' });
        txt(g, '=', 790, 420, { size: 34, weight: 700, color: COL.trap, align: 'center' });
        word(g, 'ear', 940, 420, 44, { align: 'center' });
        koWord(g, 'year', 790, 486, 34, { trap: true, align: 'center' });
        txt(g, '한국어식으로는 같은 소리 · 해와 귀', 790, 536, { size: 16, weight: 600, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 25, 31.2), () => {
        word(g, 'year', 560, 410, 40);
        const B = [['y', COL.a, '혀를 더 높이'], ['ɪ', COL.soft, '이 모음'], ['r', COL.soft, '']];
        let x = 720;
        B.forEach(([s, c, lab], i) => {
          panel(g, x, 378, 64, 64, { fill: COL.panel2, stroke: c });
          txt(g, s, x + 32, 410, { size: 30, weight: 700, fam: FM, color: c, align: 'center' });
          if (lab) txt(g, lab, x + 32, 466, { size: 14, weight: 600, color: c, align: 'center' });
          if (i < B.length - 1) arrow(g, x + 72, 410, x + 134, 410, COL.muted, 2);
          x += 142;
        });
        txt(g, '이 앞에서도 y 소리를 내요', 560, 526, { size: 19, weight: 700, color: COL.a });
      });
      fade(g, win(u, 31, 37.7), () => {
        chip(g, '연구 → 이 앞의 y 소리를 자주 빼곤 했어요', 860, 430, { size: 18, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '주된 까닭은 듣기 → 귀로 먼저 가르기', 860, 480, { size: 17, weight: 700, color: COL.a, align: 'center' });
        txt(g, '근거와 한계 → 페이지 아래 각주', 860, 524, { size: 15, color: COL.muted, align: 'center' });
      });
      fade(g, ramp(u, 37.5, 0.5), () => [['year', 'ear'], ['yeast', 'east'], ['yearn', 'earn']].forEach(([a, b], i) => {
        const y = 400 + i * 58;
        word(g, a, 560, y, 32); txt(g, '·', 700, y, { size: 24, color: COL.muted, align: 'center' }); word(g, b, 724, y, 32);
        koWord(g, a, 880, y, 24, { trap: true });
        if (!SZ.koSame(a, b)) koWord(g, b, 960, y, 20, { trap: true });
        txt(g, SZ.koSame(a, b) ? '둘 다 같은 표기' : '표기가 달라요', 1190, y, { size: 14, weight: 600, color: COL.muted, align: 'right' });
      }));
    },

    /* 07 낱말 속 자리 */
    place(g, u) {
      const pw = S.pword;
      PCOLS.forEach(([pos, at], i) => {
        const x = 80 + i * 285, list = SZ.SETS.place[pos], on = !pw && u >= at && u < (PCOLS[i + 1] ? PCOLS[i + 1][1] : 37.5);
        fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, at, 0.4)) * (pw ? 0 : 1), () => panel(g, x, 145, 265, 260, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }));
        fade(g, ramp(u, 0.4, 0.5), () => tag(g, SZ.POS[pos].ko, x + 132, 172, on ? COL.accent : COL.muted, { align: 'center', size: 15, h: 30 }));
        fade(g, pw ? 1 : ramp(u, at, 0.5), () => {
          panel(g, x, 145, 265, 260, { fill: COL.panel, stroke: on ? COL.accent : COL.faint, lw: on ? 2.5 : 1.5 });
          tag(g, SZ.POS[pos].ko, x + 132, 172, on ? COL.accent : COL.muted, { align: 'center', size: 15, h: 30 });
          list.forEach((w, k) => {
            const y = 222 + k * 42, hl = pw === w;
            if (hl) panel(g, x + 8, y - 18, 249, 36, { fill: hex(COL.accent, 0.12), r: 8 });
            word(g, w, x + 18, y, 24, { pos });
            koWord(g, w, x + 247, y, 20, { align: 'right', ins: true });
          });
        });
      });
      if (pw) {
        const e = SZ.entry(pw), ks = koSyl(pw), en = SZ.syl(pw);
        word(g, pw, 100, 470, 40);
        txt(g, `${ipa(pw)} · ${gloss(pw)}`, 100, 518, { size: 16, color: COL.muted });
        txt(g, SZ.sounds(pw).map(L => `${NAME[L.ph]} 소리 · ${SZ.POS[L.pos].ko}`).join('   '), 100, 556, { size: 16, weight: 700, color: COL.a });
        txt(g, `영어 ${en} 음절`, 560, 470, { size: 16, weight: 700, color: COL.a });
        sylRow(g, e.syl.map(s => ({ t: s.ph.join(''), color: COL.a })), 700, 470, { size: 20 });
        txt(g, `한국어식 ${ks.length} 음절`, 560, 535, { size: 16, weight: 700, color: ks.length > en ? COL.ins : COL.soft });
        sylRow(g, ks, 700, 535, { size: 20 });
        return;
      }
      fade(g, win(u, 12, 18.7), () => {
        word(g, 'street', 100, 490, 34, { pos: 'cluster' });
        sylRow(g, [{ t: 'street', color: COL.a }], 230, 490, { size: 22 });
        txt(g, '1 음절', 230 + sylW(g, [{ t: 'street' }], { size: 22 }) / 2, 540, { size: 15, weight: 600, color: COL.muted, align: 'center' });
        arrow(g, 350, 490, 396, 490, COL.muted, 2);
        const k = koSyl('street'); sylRow(g, k, 410, 490, { size: 22 });
        txt(g, `${k.length} 음절`, 410 + sylW(g, k, { size: 22 }) / 2, 540, { size: 15, weight: 600, color: COL.ins, align: 'center' });
        txt(g, 's 소리 뒤에 바로 자음 · 으 없이', 760, 490, { size: 18, weight: 700, color: COL.a });
      });
      fade(g, win(u, 18.5, 24.7), () => {
        mouth(g, 100, 424, 0.36, 'y', { mark: COL.a });
        word(g, 'music', 290, 470, 36, { pos: 'cluster' });
        koWord(g, 'music', 290, 520, 28);
        txt(g, 'm 소리 뒤에 y 소리가 바로 붙어요', 520, 470, { size: 19, weight: 700, color: COL.a });
        txt(g, '한국어 뮤와 비슷해요', 520, 512, { size: 17, weight: 600, color: COL.soft });
      });
      fade(g, win(u, 24.5, 31.2), () => {
        txt(g, '모음 사이 → 짧게 지나가요', 100, 470, { size: 19, weight: 700, color: COL.a });
        txt(g, '혀가 닿지 않게 이어요', 100, 512, { size: 17, weight: 600, color: COL.soft });
        wordRow(g, SZ.SETS.place.mid, 640, 490, 32, 190, { pos: 'mid' });
      });
      fade(g, win(u, 31, 37.7), () => SZ.SETS.place.end.forEach((w, i) => {
        const x = 100 + i * 280, k = koSyl(w);
        word(g, w, x, 460, 30, { pos: 'end' });
        sylRow(g, k, x, 515, { size: 18 });
      }));
      fade(g, ramp(u, 37.5, 0.5), () => {
        chip(g, '끝 자음 뒤에 으 · 이를 넣지 않기 → 끝소리 튜토리얼', 640, 480, { size: 19, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '영어는 바람이나 떨림으로 끝내요', 640, 534, { size: 17, weight: 700, color: COL.a, align: 'center' });
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
            koWord(g, w, x + 16, y + 26, 24, { trap: true });
            word(g, w, x + 249, y + 26, fit(g, w, 26, 130, 700), { align: 'right' });
            tag(g, SZ.TRAP[t].ko, x + 16, y + 56, t === 'mix' ? COL.muted : COL.trap, { size: 13, h: 24, align: 'left' });
            txt(g, ipa(w), x + 249, y + 56, { size: fit(g, ipa(w), 15, 120, 400, 11, FM), fam: FM, color: COL.muted, align: 'right' });
          });
        });
      });
      fade(g, win(u, 31, 37.7), () => {
        word(g, 'sell', 300, 525, 30, { align: 'right' }); koWord(g, 'sell', 316, 525, 26);
        txt(g, '·', 410, 525, { size: 24, color: COL.muted, align: 'center' });
        word(g, 'shell', 520, 525, 30, { align: 'right' }); koWord(g, 'shell', 536, 525, 26);
        txt(g, '모든 짝이 같은 표기는 아니에요 → 그래도 혀의 자리로 갈라요', 1200, 525, { size: 17, weight: 600, color: COL.soft, align: 'right' });
      });
      fade(g, ramp(u, 37.5, 0.5), () => {
        chip(g, '한국어 표기를 잠시 잊고 → 소리마다 혀의 자리부터', 640, 525, { size: 19, color: COL.a, fill: hex(COL.a, 0.08), stroke: COL.a, align: 'center' });
      });
    },

    /* 09 문장 속에서 */
    sentence(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      if (S.sent != null) {
        const s = SZ.SENT[S.sent], c = SZ.countIn(s.en);
        tag(g, SZ.GROUPS[s.grp], 640, 230, COL.muted, { align: 'center', size: 16, h: 32 });
        sentence(g, s.en, 640, 320, 44, { align: 'center', maxW: 1100 });
        txt(g, s.ko, 640, 390, { size: 20, weight: 600, color: COL.soft, align: 'center' });
        counts(g, c, 640 + 80, 450, 18);
        return;
      }
      SROWS.forEach((s, i) => fade(g, ramp(u, s.at, 0.5), () => {
        const y = 190 + i * 88, c = SZ.countIn(s.en);
        const R = sentence(g, s.en, 80, y, 36, { maxW: 860 });
        counts(g, c, 1200, y, 17);
        if (i === 0) fade(g, win(u, 12.5, 18.7), () => {
          const x = R.pos.sells_end != null ? R.pos.sells_end - 8 : 80;
          arrow(g, x, y + 56, x, y + 28, COL.a, 2);
          txt(g, 'z 소리 · 철자는 s', x - 60, y + 70, { size: 15, weight: 700, color: COL.a });
        });
      }));
      fade(g, ramp(u, 37, 0.5), () => chip(g, '따라 말하기 28문장 → s · sh / z / zh / y, 일곱 문장씩', 640, 548, { size: 17, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' }));
    },

    /* 10 정리 */
    summary(g, u) {
      const X = [80, 330, 770], Y0 = 145;
      fade(g, ramp(u, 0.3, 0.5), () => {
        panel(g, 60, Y0, 1160, 330, { fill: COL.panel, stroke: COL.faint });
        mouth(g, X[1] + 4, Y0 + 4, 0.24, 's', { mark: COL.a });
        mouth(g, X[2] + 4, Y0 + 4, 0.24, 'y', { mark: COL.a });
        txt(g, 's · sh · z · zh 소리', X[1] + 120, Y0 + 46, { size: 22, weight: 800, color: COL.a });
        txt(g, 'y 소리', X[2] + 120, Y0 + 46, { size: 22, weight: 800, color: COL.a });
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + 98, 1120, 1);
      });
      const rows = [
        ['① 듣고 가르기', 's 높은 바람 · sh 낮은 바람 · z · zh 떨림', '이 앞에서도 혀가 미끄러지는 소리', 0.4],
        ['② 혀의 자리', 's · z 앞 · sh · zh 조금 뒤 · 닿지 않음', '혀 앞을 센입천장 가까이 → 모음', 6],
        ['③ 낱말 속에서', '이 앞의 시 · ㅈ처럼 붙이기를 조심', '이 앞에서도 y 소리 살리기', 12],
      ];
      rows.forEach(([h, a, b, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = Y0 + 140 + i * 66;
        txt(g, h, X[0] + 16, y, { size: 19, weight: 800, color: COL.text });
        txt(g, a, X[1] + 4, y, { size: fit(g, a, 18, 420, 600), weight: 600, color: COL.a });
        txt(g, b, X[2] + 4, y, { size: fit(g, b, 18, 420, 600), weight: 600, color: COL.a });
      }));
      fade(g, ramp(u, 18, 0.5), () => txt(g, '목표 = 듣는 사람이 헷갈리지 않는 소리', 640, 510, { size: 19, weight: 700, color: COL.soft, align: 'center' }));
      fade(g, ramp(u, 24, 0.5), () => chip(g, '입 그림은 쉽게 줄인 그림 · 거울로 입술 모양, 목에 손을 대어 울림을 확인해요', 640, 552, { size: 16, color: COL.muted, fill: COL.panel2, align: 'center' }));
    },
  };
  SZS.SCENES = SCENES;

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
  SZS.captionLines = (g, text) => drawCaption(g, text);

  SZS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[SZS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, SZS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + SZ.allText() + MLAB.join('') + Object.values(AIR).join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔≈≠✓×?!~=+-–—/:…‘’\'%&<>|ɹɝɚəæɑɔɪʊʌɛŋθðʃʒˈˌ';
  SZS.baseText = EXTRA;
  SZS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = SZS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { SZS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
