/* 센 낱말, 약한 낱말 — 문장 리듬: 영상 장면과 자막 (SRS)
 * 그림은 시간 t와 사용자 상태(S)만의 함수예요. 낱말 갈래 · 강한 형태와 약한 형태 · 음절의 세기 · 대문자 띠는 규칙 엔진(SR)이 계산하고,
 * 음절 공의 크기 · 높이와 문장 길이 막대는 미리 만든 음성 파일을 따로 잰 값(SRV.meas)으로 그려요(잰 값이 없으면 엔진의 기본 모양, 길이 막대는 숨김).
 * 역할 색: 센 낱말 보라 · 약한 낱말 민트 · 강한 형태로 돌아온 기능어 노랑 · 한국어식으로 또박또박 읽기 주황
 */
(function () {
  'use strict';
  const SR = window.SR, V = window.SRV;
  const SRS = (window.SRS = {});
  const W = 1280, H = 720;
  SRS.W = W; SRS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  SRS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    a: '#FFC15E', b: '#6EC8FF', weak: '#7FE0A8', str: '#C9A7FF', str2: '#B3A2D6', ret: '#FFC15E', trap: '#FF9F7A', plain: '#7D8A99',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  SRS.COL = COL;
  const RCOL = r => r === 'str' ? COL.str : r === 'str2' ? COL.str2 : r === 'ret' ? COL.ret : r === 'weak' ? COL.weak : r === 'ko' ? COL.trap : r === 'sec' ? COL.str2 : null;
  SRS.RCOL = RCOL;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (SRS.S = { pair: null, voice: null, csent: null, weak: null, chunk: null, strong: null, sent: null, cmp: null });
  SRS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  SRS.hits = () => HITS;

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
  const ring = (g, x, y, r, color, lw = 2, dash) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.strokeStyle = color; g.lineWidth = lw; if (dash) g.setLineDash(dash); g.stroke(); g.setLineDash([]); };
  // 누르면 들려줌: seq = [{ text, sp }]
  const listen = (x, y, w, h, seq) => HITS.push({ x, y, w, h, play: seq });
  const hex = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  SRS.hex = hex;
  const say = (text, sp = 'tc') => [{ text, sp }];

  /* ---------- 아이콘 — 24×24 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요 ---------- */
  const ICON = {
    spk: [['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'f'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
    ear: [['M7.5 9.5a4.5 4.5 0 1 1 9 0c0 3.1-3 3.7-3 6.6a2.7 2.7 0 0 1-5.1 1.1'], ['M10.5 10a1.6 1.6 0 1 1 3 .9']],
    balls: [['M4 15a2 2 0 1 0 4 0a2 2 0 1 0-4 0'], ['M9 12a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0-7.6 0'], ['M17.5 15a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0']],
    text: [['M4 6.5h16M4 10.5h16M4 14.5h11M4 18.5h7']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z'], ['M6 11a6 6 0 0 0 12 0'], ['M12 17v3.5M9 20.5h6']],
    tap: [['M9 11V5.5a1.5 1.5 0 0 1 3 0V11'], ['M12 10.5V9a1.5 1.5 0 0 1 3 0v2'], ['M15 10.5a1.5 1.5 0 0 1 3 0V15a5.5 5.5 0 0 1-5.5 5.5h-1A5.5 5.5 0 0 1 6 15.5L4.6 12.6a1.4 1.4 0 0 1 2.4-1.4L9 14']],
  };
  SRS.ICON = ICON;
  const P2D = {};
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const k = size / 24;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    (ICON[id] || []).forEach(([d, m]) => { const p = P2D[d] || (P2D[d] = new Path2D(d)); if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  SRS.icon = icon;
  SRS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 문장 그리기: 센 낱말 보라(센 음절은 굵게 + 밑줄) · 약한 낱말 민트 · 강한 형태로 돌아온 기능어 노랑 ----------
     o.paint=false: 칠하지 않음 · o.maxW: 넘치면 줄임. 돌려줌 { x, w, size, words: { 낱말 번호: { a, b } } } */
  function sentence(g, text, x, y, size, o = {}) {
    const segs = SR.segs(text), wt = o.weight || 600, paint = o.paint !== false;
    const W8 = s => paint && (s.role === 'str' || s.role === 'ret') ? 800 : paint && s.role === 'weak' ? 500 : wt;
    const width = z => segs.reduce((a, s) => a + tw(g, s.t, z, W8(s)), 0);
    let sz = size, total = width(sz);
    if (o.maxW && total > o.maxW) { sz = size * o.maxW / total; total = width(sz); }
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx, words = {};
    segs.forEach(s => {
      const c = paint ? (RCOL(s.role) || o.base || COL.text) : (o.base || COL.text);
      const ww = txt(g, s.t, xx, y, { size: sz, weight: W8(s), color: c });
      if (paint && (s.role === 'str' || s.role === 'ret')) { g.fillStyle = c; g.fillRect(xx, y + sz * 0.56, ww, Math.max(2, sz * 0.07)); }
      if (s.w != null) { const r = words[s.w] || (words[s.w] = { a: xx, b: xx + ww }); r.a = Math.min(r.a, xx); r.b = Math.max(r.b, xx + ww); }
      xx += ww;
    });
    if (o.hit !== false) listen(x0 - 8, y - sz * 0.75, total + 16, sz * 1.5, say(text, o.sp || 'tc'));
    return { x: x0, w: total, size: sz, words };
  }
  SRS.sentence = sentence;
  // 대문자 띠: i WANT tə GO tə thə STORE
  function capsBand(g, text, x, y, size, o = {}) {
    const parts = [];
    SR.analyze(text).forEach((w, i) => {
      if (i) parts.push({ t: ' ', c: COL.muted, wt: 500 });
      const role = w.form === 'weak' ? 'weak' : w.ret ? 'ret' : 'str';
      parts.push({ t: SR.capsWord(w), c: RCOL(role), wt: role === 'weak' ? 500 : 700 });
    });
    const width = z => parts.reduce((a, p) => a + tw(g, p.t, z, p.wt, FM), 0);
    let sz = size, total = width(sz);
    if (o.maxW && total > o.maxW) { sz = size * o.maxW / total; total = width(sz); }
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx;
    if (o.box) { rr(g, x0 - 12, y - sz * 0.9, total + 24, sz * 1.8, 10); g.strokeStyle = o.box; g.lineWidth = 2; g.stroke(); }
    parts.forEach(p => { xx += txt(g, p.t, xx, y, { size: sz, weight: p.wt, color: p.c, fam: FM }); });
    return { x: x0, w: total };
  }
  SRS.capsBand = capsBand;
  // 한국어식으로 또박또박 (주황)
  function koText(g, ko, x, y, size, o = {}) {
    const ww = txt(g, ko, x, y, { size, weight: o.weight || 700, color: COL.trap, align: o.align });
    const x0 = o.align === 'center' ? x - ww / 2 : o.align === 'right' ? x - ww : x;
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, ww + 16, size * 1.45, [{ text: ko, sp: 'ko' }]);
    return { x: x0, w: ww };
  }
  SRS.koText = koText;

  /* ---------- 음절 공 ----------
     잰 값(SRV.meas)이 있으면 그 목소리의 음절마다 길이 L · 크기 A · 높이 H(반음)로, 없으면 엔진의 기본 모양으로 그려요.
     공의 넓이 ≈ 길이와 크기, 공의 높이 = 소리의 높이. 낱말 사이는 조금 더 띄워요 */
  function fromMeas(m, n) {
    if (!m || !m.s || m.s.length !== n) return null;
    const durs = m.s.map(x => x[1] - x[0]), md = Math.max(...durs);
    const f0 = m.s.map(x => x[3]).filter(f => f > 0), fmin = f0.length ? Math.min(...f0) : 0;
    return m.s.map((x, i) => ({ L: durs[i] / md, A: Math.pow(10, Math.min(0, x[2]) / 20), H: x[3] > 0 && fmin ? 12 * Math.log2(x[3] / fmin) : 0 }));
  }
  function ballData(text, o = {}) {
    if (o.ko) {
      // 한국어식 공은 같은 그림의 영어 줄(밝은 선생님)도 잰 값이 있을 때만 잰 값으로 — 한쪽만 잰 값이면 견주기가 어긋나요
      const n = SR.koN(o.ko), en = fromMeas(V.meas('tc', text), SR.nSyl(text));
      const m = o.meas === false || !en ? null : fromMeas(V.meas('ko', o.ko), n);
      return { b: m || SR.koSchematic(n), measured: !!m };
    }
    const n = SR.nSyl(text), m = o.meas === false ? null : fromMeas(V.meas(o.sp || 'tc', text), n);
    return { b: m || SR.schematic(text), measured: !!m };
  }
  SRS.ballData = ballData;
  const ballR = (v, R) => { const q = 0.5 * v.L + 0.5 * v.A; return R * (0.3 + 0.7 * q * q); };
  SRS.ballR = ballR;
  // 공마다의 역할 (str 센 음절 · ret 돌아온 강한 형태 · sec 센 낱말의 다른 음절 · weak 약한 낱말 · ko 한국어식)
  SRS.ballRoles = (text, ko) => ko ? SR.koSyl(ko).map(() => 'ko') : SR.sylls(text).map(s => s.lv === 3 ? 'weak' : s.lv === 2 ? 'sec' : s.ret ? 'ret' : 'str');
  // 공 줄: x는 가운데(o.align = 'left'면 왼쪽 끝). 돌려줌 { x0, x1, cx: [], measured }
  function balls(g, text, x, y, o = {}) {
    const R = o.R || 30, d = ballData(text, o), n = d.b.length, hpx = o.hpx == null ? R * 0.13 : o.hpx;
    const sy = o.ko ? null : SR.sylls(text);
    const labels = o.ko ? SR.koSyl(o.ko) : sy.map(s => s.sp), roles = SRS.ballRoles(text, o.ko);
    const ls = o.lab || Math.max(12, Math.round(R * 0.6));
    const step = Math.max(2 * R + (o.pad == null ? 10 : o.pad), ...(o.labels === false ? [0] : labels.map(l => tw(g, l, ls, 800) + 10)));
    const wgap = o.ko ? 0 : (o.wgap == null ? Math.round(R * 0.35) : o.wgap);
    const xs = [];
    let acc = 0;
    for (let i = 0; i < n; i++) { if (i && sy && sy[i].w !== sy[i - 1].w) acc += wgap; xs.push(acc); acc += step; }
    const span = n ? xs[n - 1] : 0;
    const x0 = o.align === 'left' ? x + R : o.align === 'right' ? x - R - span : x - span / 2;
    const cx = [];
    d.b.forEach((v, i) => {
      const r = ballR(v, R), cy = y - clamp(v.H, -2, 9) * hpx, X = x0 + xs[i], role = roles[i];
      cx.push(X);
      const c = o.mono || RCOL(role), big = role === 'str' || role === 'ret' || role === 'ko';
      circ(g, X, cy, r, hex(c, big ? 0.85 : 0.32));
      ring(g, X, cy, r, c, role === 'str' || role === 'ret' ? 2.5 : 1.8);
      const hl = o.pick != null && (Array.isArray(o.pick) ? o.pick.indexOf(i) >= 0 : o.pick === i);
      if (hl) ring(g, X, cy, r + 6, COL.accent, 2.5, [5, 4]);
      if (o.labels !== false) {
        const t = o.ko ? labels[i] : o.caps ? (role === 'str' || role === 'ret' ? labels[i].toUpperCase() : labels[i].toLowerCase()) : labels[i];
        txt(g, t, X, y + R + 14, { size: ls, weight: role === 'str' || role === 'ret' ? 800 : 600, color: c, align: 'center' });
      }
    });
    if (o.hit !== false) {
      const seq = o.ko ? [{ text: o.ko, sp: 'ko' }] : say(text, o.sp || 'tc');
      listen(x0 - R - 6, y - R - 9 * hpx - 6, span + 2 * R + 12, 2 * R + 9 * hpx + 30 + ls, seq);
    }
    return { x0: x0 - R, x1: x0 + span + R, cx, measured: d.measured };
  }
  SRS.balls = balls;
  // 잰 값으로 그렸을 때만 붙이는 표시
  const measTag = (g, B, x, y, o = {}) => { if (B && B.measured) txt(g, '이 목소리를 잰 값', x, y, { size: o.size || 13, weight: 600, color: COL.muted, align: o.align || 'center' }); };
  // 잰 문장 길이 (늘이기 문장 · 한국어식)
  // 들리는 길이(ms): 파일을 잰 길이 ÷ 재생 빠르기(영어는 0.9배로 재생해서 파일보다 길게 들려요, 한국어식은 1배)
  SRS.durOf = (text, sp) => { const m = V.meas(sp || 'tc', text); return m && m.dur > 0 ? Math.round(m.dur / ((sp || 'tc') === 'ko' ? 1 : V.EN_RATE)) : null; };

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 발음 기호는 자막에 쓰지 않음(흐린 어 · 슈와처럼 이름으로)
     영어 낱말 바로 뒤에 조사를 붙이지 않아요(소리 내어 읽을 때 어색해서) — → 나 = 로 이어요.
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '센 낱말, 약한 낱말 — 문장 리듬', d: 36, caps: [
      [0.4, 6, '영어 문장 하나를 두 가지로 들어 봐요. 먼저 한국어식으로 낱말마다 또박또박 읽은 소리예요.'],
      [6, 12, '이번에는 영어 리듬이에요 → I want to go to the store. 어떤 낱말은 길고 크게, 어떤 낱말은 짧게 지나가요.'],
      [12, 18, '뜻을 나르는 낱말은 길고 크게 말해요 → want · go · store. 이것을 센 낱말이라고 불러요.'],
      [18, 24, '문법을 잇는 낱말은 짧고 약하게, 모음은 흐린 어로 말해요 → to · the. 이것은 약한 낱말이에요.'],
      [24, 30, '세 단계로 익혀요. 센 낱말과 약한 낱말을 듣고 가르고, 두 소리를 만들고, 문장 속에서 써요.'],
      [30, 36, '미국 표준 발음을 기준으로 해요. 소리는 모두 합성 음성이고, 리듬은 딱 맞는 규칙이 아니라 경향이에요.'],
    ] },
    { id: 'listen', n: '01', title: '들어 보기 · 구별되나요?', sub: '① 듣고 가르기 · I can go · I can’t go · 목소리 넷', d: 40, caps: [
      [0.4, 6, "먼저 귀부터 시험해요. 화면의 두 문장은 낱말 하나만 달라요 → can · can't."],
      [6, 12, "눌러서 들어 보세요. 미국 영어에서는 can't → 끝의 t 소리가 거의 들리지 않을 때가 많아요."],
      [12, 19, '그럼 무엇으로 가를까요? 공을 보세요. 공 하나가 음절 하나, 큰 공이 센 음절이에요.'],
      [19, 26, 'I can go → 가운데 공이 작아요. can = 짧고 약하게, 모음은 흐린 어예요.'],
      [26, 33, "I can't go → 가운데 공이 커요. can't = 길고 세게, 모음은 또렷한 애예요."],
      [33, 40, "그래서 t 소리를 기다리지 말고 모음과 세기를 들어요. 아래 **can · can't 듣기 시합**에서 목소리 넷으로 연습해요."],
    ] },
    { id: 'classes', n: '02', title: '센 낱말 · 약한 낱말', sub: '① 듣고 가르기 · 내용어는 보라 · 기능어는 민트', d: 42, caps: [
      [0.4, 6, '문장의 낱말은 두 갈래예요. 뜻을 나르는 내용어, 그리고 문법을 잇는 기능어예요.'],
      [6, 12, "내용어 → 명사 · 본동사 · 형용사 · 부사 · 의문사, 그리고 부정의 can't. 보통 세게 말해요."],
      [12, 18, '기능어 → 관사 · 전치사 · 접속사 · 조동사 · be 동사 · 대명사. 보통 약하게 말해요.'],
      [18, 24, '문장 하나를 갈라 볼까요? The kids are waiting for the bus.'],
      [24, 30, '센 낱말은 셋이에요 → kids · waiting · bus. 나머지 넷은 약한 낱말이에요.'],
      [30, 36, '긴 낱말은 센 음절 하나만 커요 → waiting. 낱말 강세는 문장 속에서도 그대로예요.'],
      [36, 42, '연구에서도 숙달도가 낮은 학습자일수록 문장 강세를 더 많은 낱말에 두는 경향을 보였어요.'],
    ] },
    { id: 'weak', n: '03', title: '약한 형태', sub: '② 소리 만들기 · 짧게 · 흐린 어 · 강한 형태 → 약한 형태', d: 44, caps: [
      [0.4, 6, '기능어에는 혼자 말할 때의 강한 형태와, 문장 속에서 쓰는 약한 형태가 있어요.'],
      [6, 12, '약한 형태는 짧고, 모음이 흐린 어가 돼요. 이 흐린 어를 슈와라고 불러요.'],
      [12, 18, 'to → 투가 아니라 터에 가깝게, for → 포가 아니라 퍼에 가깝게 말해요.'],
      [18, 24, 'of → 어브, and → 언, can → 컨에 가깝게. 짧게 붙여서 말해요.'],
      [24, 31, '카드가 더 있어요 → a · the · at · from · have. 눌러서 두 형태를 견줘 들어 보세요.'],
      [31, 37, '연구에서도 한국인 학습자는 약한 기능어의 모음을 원어민보다 덜 고르게 줄이는 경향을 보였어요.'],
      [37, 44, '요령 → 약한 낱말에는 힘을 주지 않아요. 입을 조금만 벌리고 재빨리 지나가요.'],
    ] },
    { id: 'can', n: '04', title: 'can · can’t', sub: '① 듣고 가르기 · t 소리보다 모음과 세기', d: 42, caps: [
      [0.4, 6, "이번에는 can · can't → 무엇이 다른지 하나씩 봐요."],
      [6, 12, 'can → 약한 형태예요. 짧고, 모음은 흐린 어라서 캔보다 컨에 가까워요.'],
      [12, 18, "can't → 센 낱말이에요. 길고 높고, 모음은 또렷한 애예요. 부정은 뜻을 나르니까요."],
      [18, 24, '끝의 t 소리는 혀만 대고 터뜨리지 않거나 거의 들리지 않을 때가 많아요. 그 소리에 기대지 마세요.'],
      [24, 31, "문장으로 들어 봐요 → I can swim · I can't swim, She can drive · She can't drive."],
      [31, 37, "센 낱말의 수도 달라요. I can swim → 큰 공 하나, I can't swim → 큰 공 둘이에요."],
      [37, 42, "말할 때도 같아요 → can = 짧게 붙이고, can't = 길고 세게."],
    ] },
    { id: 'chunk', n: '05', title: '붙여서 한 덩어리', sub: '② 소리 만들기 · 약한 낱말은 앞뒤 센 낱말에 붙여요', d: 40, caps: [
      [0.4, 6, '약한 낱말은 혼자 서지 않아요. 앞뒤의 센 낱말에 붙어 한 덩어리로 나와요.'],
      [6, 12, 'a cup of tea → 한 낱말처럼 이어져요. 센 음절은 cup · tea 두 곳이에요.'],
      [12, 18, 'bread and butter · rock and roll · salt and pepper → 가운데 and = 짧은 언이에요.'],
      [18, 24, 'a lot of people → 약한 낱말 둘이 센 낱말 사이에 끼어 아주 짧아져요.'],
      [24, 30, 'I want to go → to = 짧은 터. 두 센 낱말 사이에 가볍게 끼워요.'],
      [30, 35, '덩어리 테두리를 보세요. 테두리 하나를 한 숨에 이어서 말해요.'],
      [35, 40, '이어 말할 때 소리가 바뀌는 연음은 다음 꼭지에서 다뤄요. 여기서는 짧게 붙이기만 해요.'],
    ] },
    { id: 'stretch', n: '06', title: '센 낱말 사이 간격', sub: '③ 문장 속에서 · Cats chase mice — 늘어나는 문장', d: 44, caps: [
      [0.4, 6, '센 낱말 셋으로 된 문장이에요 → Cats chase mice. 음절도 셋이에요.'],
      [6, 12, '약한 낱말을 넣어 늘여요 → The cats have chased the mice. 음절은 여섯이 됐어요.'],
      [12, 18, '한 번 더 → The cats will have been chasing the mice. 음절은 아홉이에요.'],
      [18, 24, '센 낱말은 그대로 셋이에요. 늘어난 것은 약한 낱말과 음절뿐이에요.'],
      [24, 30, '막대를 보세요. 음절 수, 그리고 잰 값이 있으면 이 목소리의 문장 길이를 나란히 그려요.'],
      [30, 36, '영어는 센 낱말 사이 간격을 비슷하게 맞추려는 경향이 있어, 끼어든 약한 낱말이 짧게 줄어요.'],
      [36, 40, '맨 아래는 한국어식으로 또박또박 읽은 소리예요. 음절 수와 길이를 견줘 보세요.'],
      [40, 44, '다만 똑같은 간격은 아니에요. 측정으로 확인된 규칙이 아니라 경향이에요.'],
    ] },
    { id: 'back', n: '07', title: '강한 형태로 돌아올 때', sub: '③ 문장 속에서 · 문장 끝 · 혼자 대답 · 강조', d: 44, caps: [
      [0.4, 6, '약한 낱말도 강한 형태로 돌아오는 자리가 있어요. 세 가지를 기억해요.'],
      [6, 12, '하나, 문장 끝의 전치사 → Where are you from? 끝의 from = 또렷한 강한 형태예요.'],
      [12, 18, 'What are you looking at? · Who is it for? → 끝의 전치사는 약해지지 않아요.'],
      [18, 24, '둘, 혼자 대답할 때 → Yes, I can. · Yes, I am. 뒤에 동사가 없으면 강한 형태예요.'],
      [24, 30, '셋, 강조할 때 → I can swim! 할 수 있다고 힘주어 말하면 can = 강한 형태예요.'],
      [30, 37, '낱말 자체를 말할 때도 그래요 → Circle the word “to”. 따옴표 속 to = 강한 형태예요.'],
      [37, 44, '대명사는 문장 끝에서도 보통 약해요 → Call them. · See you! 끝이라고 모두 세지지는 않아요.'],
    ] },
    { id: 'sentence', n: '08', title: '문장 속에서', sub: '③ 문장 속에서 · 긴 문장 · 대문자 띠', d: 40, caps: [
      [0.4, 6, '이제 긴 문장이에요. 센 낱말을 먼저 찾고, 나머지는 짧게 붙여요.'],
      [6, 12, 'My sister wants a new bike. 센 낱말은 넷이에요 → sister · wants · new · bike.'],
      [12, 18, 'The students are waiting for the teacher. 센 낱말은 셋이에요 → students · waiting · teacher.'],
      [18, 24, 'Can you tell me the way to the station? 질문을 여는 can = 약한 형태예요.'],
      [24, 30, '대문자 띠를 소리 내어 읽어 보세요. 대문자는 길고 크게, 작은 글자는 짧게.'],
      [30, 35, '한국어식으로 모든 낱말을 같은 세기로 읽지 말고, 센 낱말만 살려요.'],
      [35, 40, '아래 **따라 말하기**에 문장 스물여덟 개가 있어요. 묶음마다 일곱 문장이에요.'],
    ] },
    { id: 'summary', n: '09', title: '정리', sub: '3단계 발음법 · 센 낱말과 약한 낱말', d: 36, caps: [
      [0.4, 6, '정리해요. ① 듣고 가르기 → 센 낱말은 큰 공, 약한 낱말은 작은 공이에요.'],
      [6, 12, '② 소리 만들기 → 센 낱말은 길고 크고 높게, 약한 낱말은 짧게, 모음은 흐린 어로.'],
      [12, 18, '③ 문장 속에서 → 약한 낱말은 앞뒤에 붙이고, 문장 끝 · 혼자 대답 · 강조에서는 강한 형태로.'],
      [18, 24, "그리고 can · can't → 끝의 t 소리가 아니라 모음과 세기로 갈라요."],
      [24, 30, '목표는 원어민과 똑같은 소리가 아니라, 듣는 사람이 뜻을 쉽게 따라오는 리듬이에요.'],
      [30, 36, "아래 **can · can't 듣기 시합**과 **센 낱말 찾기**에서 직접 해 보세요."],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  SRS.CHAPTERS = CHAPTERS; SRS.CAPTIONS = CAPTIONS; SRS.END = END;
  SRS.POSTER = CHAPTERS.find(c => c.id === 'intro').t + 20;
  SRS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  SRS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 760, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 700, 800, 24, FD), weight: 800, fam: FD });
  }
  // 오른쪽 위 범례
  function legend(g, a = 1, ret) {
    fade(g, a, () => {
      let x = 1200;
      const put = (s, c) => { const r = tag(g, s, x, 92, c, { align: 'right', size: 15, h: 30 }); x = r.x - 10; };
      if (ret) put('강한 형태로 돌아옴', COL.ret);
      put('약한 낱말', COL.weak);
      put('센 낱말', COL.str);
    });
  }
  const INTRO = SR.INTRO;
  const pairNow = () => SR.canPair(S.pair) || SR.CAN[0];
  const CLASS_ROWS = {
    content: [['명사', 'store · bus · tea'], ['본동사', 'go · want · wait'], ['형용사', 'new · late · black'], ['부사', 'here · tomorrow'], ['의문사', 'where · what · who'], ['부정 조동사', "can't"]],
    function: [['관사', 'a · an · the'], ['전치사', 'to · for · of · at · from'], ['접속사', 'and · or · but'], ['조동사', 'can · will · have · do'], ['be 동사', 'am · is · are · was'], ['대명사', 'I · you · them · your']],
  };
  SRS.CLASS_ROWS = CLASS_ROWS;
  const CLS_SENT = 'The kids are waiting for the bus.';
  const WEAK_AT = [12, 12.3, 18, 18.3, 18.6, 24, 24.25, 24.5, 24.75, 25];
  const CHUNK_AT = [6, 12, 12.3, 12.6, 18, 24];
  const BACK_ROWS = [
    ['Where are you from?', 6], ['What are you looking at?', 12], ['Who is it for?', 12.4], ['Yes, I can.', 18], ['Yes, I am.', 18.4],
    ['I can swim!', 24], ['Circle the word “to”.', 30], ['Call them.', 37], ['See you!', 37.4],
  ];
  SRS.BACK_ROWS = BACK_ROWS;

  const SCENES = {
    /* 00 들어가며 */
    intro(g, u) {
      const A = 1 - ramp(u, 23.6, 0.5);
      fade(g, A * ramp(u, 0.4, 0.6), () => {
        panel(g, 60, 150, 560, 360, { fill: COL.panel, stroke: COL.faint });
        txt(g, '한국어식 — 낱말마다 또박또박', 90, 180, { size: 15, weight: 700, color: COL.trap });
        koText(g, INTRO.ko, 340, 245, fit(g, INTRO.ko, 32, 500, 700), { align: 'center' });
        const B = balls(g, INTRO.en, 340, 385, { ko: INTRO.ko, R: 17, lab: 14 });
        txt(g, `${SR.koN(INTRO.ko)}음절을 고르게`, 340, 462, { size: 18, weight: 700, color: COL.trap, align: 'center' });
        measTag(g, B, 340, 490);
      });
      fade(g, A * ramp(u, 6, 0.6), () => {
        panel(g, 660, 150, 560, 360, { fill: COL.panel, stroke: COL.faint });
        txt(g, '영어 리듬', 690, 180, { size: 15, weight: 700, color: COL.str });
        sentence(g, INTRO.en, 940, 235, 30, { align: 'center', maxW: 500, paint: u >= 12 });
        fade(g, ramp(u, 12, 0.5), () => capsBand(g, INTRO.en, 940, 282, 22, { align: 'center', maxW: 500 }));
        const B = balls(g, INTRO.en, 940, 392, { R: 26, caps: u >= 12 });
        txt(g, `센 낱말 ${SR.strongCount(INTRO.en)}개만 길고 크게`, 940, 462, { size: 18, weight: 700, color: COL.str, align: 'center' });
        measTag(g, B, 940, 490);
      });
      fade(g, A * win(u, 18, 23.8), () => chip(g, '약한 낱말 = 짧게, 모음은 흐린 어 (슈와)', 640, 548, { size: 18, color: COL.weak, fill: COL.panel2, stroke: COL.weak, align: 'center' }));
      const steps = [['ear', '① 듣고 가르기', '센 낱말 · 약한 낱말 가르기'], ['balls', '② 소리 만들기', '센 낱말은 길게 · 약한 낱말은 짧게'], ['text', '③ 문장 속에서', '덩어리 · 강한 형태 · 긴 문장']];
      steps.forEach(([ic, h, s], i) => fade(g, ramp(u, 24.2 + i * 0.6, 0.5), () => {
        const x = 110 + i * 360;
        panel(g, x, 200, 340, 190, { fill: COL.panel, stroke: COL.faint });
        circ(g, x + 170, 252, 30, COL.panel2); icon(g, ic, x + 170, 252, 32, COL.accent);
        txt(g, h, x + 170, 314, { size: 22, weight: 800, color: COL.text, align: 'center' });
        txt(g, s, x + 170, 352, { size: fit(g, s, 16, 310, 500), weight: 500, color: COL.soft, align: 'center' });
      }));
      fade(g, ramp(u, 30, 0.5), () => chip(g, '미국 표준 발음(General American) · 합성 음성 · 리듬은 경향이에요', 640, 460, { size: 16, weight: 600, color: COL.muted, fill: COL.panel2, align: 'center' }));
    },

    /* 01 들어 보기 · 구별되나요? */
    listen(g, u) {
      legend(g, ramp(u, 12, 0.5));
      const p = pairNow(), sp = S.voice || 'tc';
      [[p.can, 90, 'A'], [p.cant, 660, 'B']].forEach(([s, x, L], k) => fade(g, ramp(u, 0.4 + k * 0.4, 0.5), () => {
        const hl = (k === 0 && u >= 19 && u < 26) || (k === 1 && u >= 26 && u < 33);
        panel(g, x, 150, 530, 300, { fill: hl ? hex(COL.accent, 0.07) : COL.panel, stroke: hl ? COL.accent : COL.faint });
        circ(g, x + 32, 182, 16, COL.accent); txt(g, L, x + 32, 183, { size: 16, weight: 800, color: '#1D1305', align: 'center' });
        sentence(g, s, x + 265, 225, 40, { align: 'center', maxW: 460, paint: u >= 12, sp });
        txt(g, SR.meaning(s), x + 265, 270, { size: 16, weight: 500, color: COL.muted, align: 'center' });
        fade(g, ramp(u, 12, 0.5), () => {
          const B = balls(g, s, x + 265, 352, { R: 30, caps: true, sp, pick: hl ? 1 : null });
          measTag(g, B, x + 265, 434);
        });
        if (u < 12) icon(g, 'spk', x + 265, 340, 46, hex(COL.accent, 0.5 + 0.5 * Math.max(0, Math.sin(u * 3 + k))));
      }));
      fade(g, win(u, 12, 19.2), () => chip(g, '공 하나 = 음절 하나 · 큰 공 = 센 음절', 640, 490, { size: 17, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' }));
      fade(g, win(u, 19, 26.2), () => tag(g, 'can → 작은 공 · 흐린 어', 355, 490, COL.weak, { align: 'center', size: 17, h: 38 }));
      fade(g, win(u, 26, 33.2), () => tag(g, "can't → 큰 공 · 또렷한 애", 925, 490, COL.str, { align: 'center', size: 17, h: 38 }));
      fade(g, ramp(u, 33, 0.5), () => {
        tag(g, 't 소리보다 모음과 세기', 640, 482, COL.accent, { align: 'center', size: 17, h: 36 });
        SR.VOICES.forEach((v, i) => {
          const x = 250 + i * 260, hl = S.voice === v.sp;
          const c = chip(g, v.ko, x, 538, { size: 16, fill: COL.panel2, stroke: hl ? COL.accent : COL.line, align: 'center', pad: 32, h: 36 });
          icon(g, 'spk', c.x + 18, 538, 17, COL.accent);
          listen(c.x, c.y, c.w, c.h, [{ text: p.can, sp: v.sp }, { text: p.cant, sp: v.sp, gap: 0.8 }]);
        });
      });
    },

    /* 02 센 낱말 · 약한 낱말 */
    classes(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      const custom = S.csent != null ? SR.FIND_POOL[S.csent] : null;
      const T1 = custom ? 0 : 1 - ramp(u, 17.6, 0.5);
      // 갈래 표
      [['content', 80, COL.str, 6], ['function', 660, COL.weak, 12]].forEach(([cls, x, c, at]) => fade(g, T1 * ramp(u, 0.4, 0.5), () => {
        panel(g, x, 150, 540, 340, { fill: COL.panel, stroke: COL.faint });
        txt(g, SR.CLS[cls].long, x + 24, 182, { size: 20, weight: 800, color: c });
        txt(g, cls === 'content' ? '뜻을 나름 → 보통 셈' : '문법을 이음 → 보통 약함', x + 516, 182, { size: 15, weight: 600, color: COL.muted, align: 'right' });
        CLASS_ROWS[cls].forEach(([h, ex], i) => fade(g, ramp(u, at + i * 0.25, 0.4), () => {
          const y = 232 + i * 42;
          txt(g, h, x + 24, y, { size: 17, weight: 700, color: c });
          txt(g, ex, x + 170, y, { size: 19, weight: 600, color: COL.text });
          listen(x + 160, y - 16, 360, 32, ex.split(' · ').map((w, k) => ({ text: w, sp: 'tc', gap: k ? 0.5 : undefined })));
        }));
      }));
      // 문장 하나 가르기
      const s = custom || CLS_SENT;
      fade(g, custom ? 1 : ramp(u, 18, 0.5), () => {
        const R = sentence(g, s, 640, 220, 46, { align: 'center', maxW: 1080 });
        fade(g, custom ? 1 : ramp(u, 24, 0.5), () => {
          SR.analyze(s).forEach(w => {
            const r = R.words[w.i]; if (!r) return;
            const c = w.form === 'weak' ? COL.weak : w.ret ? COL.ret : COL.str;
            txt(g, w.e ? SR.POS[w.e.pos].ko : '', (r.a + r.b) / 2, 276, { size: fit(g, w.e ? SR.POS[w.e.pos].ko : '', 15, Math.max(40, r.b - r.a + 10), 700), weight: 700, color: c, align: 'center' });
          });
          const hl = !custom && u >= 30 && u < 36.2 ? SR.sylls(s).findIndex(x => x.k === 'waiting' && x.lv === 1) : null;
          const B = balls(g, s, 640, 405, { R: 30, caps: true, pick: hl });
          measTag(g, B, 640, 478);
          txt(g, `센 낱말 ${SR.strongCount(s)}개 · 약한 낱말 ${SR.tokens(s).length - SR.strongCount(s)}개`, 640, 316, { size: 17, weight: 700, color: COL.soft, align: 'center' });
        });
      });
      fade(g, custom ? 0 : ramp(u, 36, 0.5), () => {
        chip(g, '연구 → 숙달도가 낮을수록 문장 강세를 더 많은 낱말에 둠', 640, 520, { size: 17, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center' });
        txt(g, '근거와 한계 → 페이지 아래 각주', 640, 558, { size: 14, color: COL.muted, align: 'center' });
      });
    },

    /* 03 약한 형태 */
    weak(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      const pick = S.weak ? SR.weakCard(S.weak) : null;
      const big = (c, a) => fade(g, a, () => {
        const e = SR.entry(c.k);
        panel(g, 80, 150, 500, 360, { fill: COL.panel, stroke: COL.faint });
        txt(g, '강한 형태 — 혼자 말할 때', 110, 182, { size: 15, weight: 700, color: COL.muted });
        txt(g, e.w, 330, 270, { size: 76, weight: 800, color: COL.text, align: 'center' });
        listen(230, 220, 200, 100, say(e.w));
        txt(g, SR.ipa(c.k), 330, 340, { size: 24, weight: 600, fam: FM, color: COL.soft, align: 'center' });
        circ(g, 330, 425, 38, hex(COL.str, 0.85)); ring(g, 330, 425, 38, COL.str, 2.5);
        panel(g, 620, 150, 580, 360, { fill: COL.panel, stroke: COL.weak });
        txt(g, '약한 형태 — 문장 속에서', 650, 182, { size: 15, weight: 700, color: COL.weak });
        sentence(g, c.ex, 910, 250, 44, { align: 'center', maxW: 520 });
        txt(g, SR.ipa(c.k, 'weak'), 910, 305, { size: 24, weight: 600, fam: FM, color: COL.weak, align: 'center' });
        capsBand(g, c.ex, 910, 345, 20, { align: 'center', maxW: 520 });
        const B = balls(g, c.ex, 910, 425, { R: 28, caps: true });
        measTag(g, B, 910, 492);
      });
      if (pick) { big(pick, 1); fade(g, 1, () => chip(g, `${pick.ko} · 약한 낱말은 옆의 센 낱말에 붙여 짧게`, 640, 548, { size: 16, color: COL.soft, fill: COL.panel2, align: 'center' })); return; }
      big(SR.WEAK[0], ramp(u, 0.4, 0.5) * (1 - ramp(u, 11.6, 0.4)));
      fade(g, win(u, 6, 12), () => chip(g, '흐린 어 = 슈와 · 입은 조금만, 혀와 입술은 힘을 빼고', 640, 548, { size: 16, color: COL.weak, fill: COL.panel2, stroke: COL.weak, align: 'center' }));
      SR.WEAK.slice(0, SR.WEAK_SHOWN).forEach((c, i) => {
        const col = i % 5, row = Math.floor(i / 5), x = 80 + col * 228, y = 150 + row * 186, at = WEAK_AT[i];
        fade(g, ramp(u, 12, 0.4) * (1 - ramp(u, at, 0.4)), () => panel(g, x, y, 212, 170, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }));
        fade(g, ramp(u, at, 0.5), () => {
          const e = SR.entry(c.k);
          panel(g, x, y, 212, 170, { fill: COL.panel, stroke: COL.faint });
          txt(g, e.w, x + 18, y + 32, { size: 30, weight: 800, color: COL.text });
          listen(x + 8, y + 10, 80, 44, say(e.w));
          txt(g, SR.ipa(c.k), x + 196, y + 24, { size: 15, weight: 600, fam: FM, color: COL.muted, align: 'right' });
          txt(g, '→ ' + SR.ipa(c.k, 'weak'), x + 196, y + 46, { size: 15, weight: 700, fam: FM, color: COL.weak, align: 'right' });
          sentence(g, c.ex, x + 106, y + 96, 21, { align: 'center', maxW: 186 });
          balls(g, c.ex, x + 106, y + 140, { R: 10, labels: false, hpx: 1, wgap: 5 });
        });
      });
      fade(g, win(u, 31, 37.2), () => chip(g, '연구 → 한국인 학습자는 약한 기능어의 모음을 덜 고르게 줄이는 경향', 640, 548, { size: 16, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 36 }));
      fade(g, ramp(u, 37, 0.5), () => chip(g, '요령 → 힘 빼고 입은 조금만 · 센 낱말에 기대어 재빨리', 640, 548, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
    },

    /* 04 can · can't */
    can(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      const p = pairNow(), fixed = !!S.pair;
      const A1 = fixed ? 0 : 1 - ramp(u, 23.6, 0.4);
      fade(g, A1 * ramp(u, 0.4, 0.5), () => {
        const L = u >= 6 && u < 12, Rr = u >= 12 && u < 24;
        panel(g, 120, 150, 480, 330, { fill: L ? hex(COL.weak, 0.07) : COL.panel, stroke: L ? COL.weak : COL.faint });
        txt(g, 'can', 360, 210, { size: 56, weight: 700, color: COL.weak, align: 'center' });
        txt(g, `${SR.ipa('can', 'weak')} · 약한 형태`, 360, 262, { size: 18, weight: 600, fam: FM, color: COL.weak, align: 'center' });
        circ(g, 360, 345, 24, hex(COL.weak, 0.32)); ring(g, 360, 345, 24, COL.weak, 1.8);
        txt(g, '짧게 · 흐린 어', 360, 405, { size: 18, weight: 700, color: COL.soft, align: 'center' });
        sentence(g, p.can, 360, 448, 20, { align: 'center', maxW: 400 });
        panel(g, 680, 150, 480, 330, { fill: Rr ? hex(COL.str, 0.07) : COL.panel, stroke: Rr ? COL.str : COL.faint });
        const ct = u >= 18 && u < 24;
        const w1 = tw(g, 'can', 56, 800), w2 = tw(g, "'t", 56, 800), x0 = 920 - (w1 + w2) / 2;
        txt(g, 'can', x0, 210, { size: 56, weight: 800, color: COL.str });
        txt(g, "'t", x0 + w1, 210, { size: 56, weight: 800, color: ct ? hex(COL.str, 0.35) : COL.str });
        if (ct) { g.strokeStyle = COL.accent; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.arc(x0 + w1 + w2 * 0.62, 210, 30, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
        txt(g, `${SR.ipa("can't")} · 센 낱말`, 920, 262, { size: 18, weight: 600, fam: FM, color: COL.str, align: 'center' });
        circ(g, 920, 345, 52, hex(COL.str, 0.85)); ring(g, 920, 345, 52, COL.str, 2.5);
        txt(g, '길게 · 높게 · 또렷한 애', 920, 418, { size: 18, weight: 700, color: COL.soft, align: 'center' });
        sentence(g, p.cant, 920, 452, 20, { align: 'center', maxW: 400 });
      });
      fade(g, A1 * win(u, 18, 24), () => chip(g, '끝의 t 소리 → 터뜨리지 않거나 거의 들리지 않을 때가 많아요', 640, 530, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center' }));
      // 짝 문장 둘 (또는 고른 짝 하나)
      const pairs = fixed ? [p] : [SR.canPair('swim'), SR.canPair('drive')];
      pairs.forEach((q, k) => fade(g, fixed ? 1 : ramp(u, 24 + k * 0.6, 0.5), () => {
        const y0 = 150 + k * 195;
        panel(g, 80, y0, 1120, 180, { fill: COL.panel, stroke: COL.faint });
        [[q.can, 0], [q.cant, 1]].forEach(([s, j]) => {
          const y = y0 + 52 + j * 78;
          sentence(g, s, 110, y, 30, { maxW: 380 });
          txt(g, SR.meaning(s), 110, y + 30, { size: 14, color: COL.muted });
          const B = balls(g, s, 760, y + 2, { R: 20, caps: true, lab: 13 });
          const on = fixed || (u >= 31 && u < 37.2);
          tag(g, `센 낱말 ${SR.strongCount(s)}개`, 1180, y, on ? COL.accent : COL.muted, { align: 'right', size: 15, h: 30 });
          if (j === 1) measTag(g, B, 1180, y0 + 166, { align: 'right' });
        });
      }));
      fade(g, fixed ? 0 : ramp(u, 37, 0.5), () => chip(g, "can = 짧게 붙이기 · can't = 길고 세게", 640, 556, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
    },

    /* 05 붙여서 한 덩어리 */
    chunk(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      const pick = S.chunk != null ? SR.CHUNKS[S.chunk] : null;
      const bigChunk = (text, a, spread) => fade(g, a, () => {
        const ws = SR.analyze(text), sz = 58, gap = tw(g, ' ', sz, 600) + spread * 60;
        const wsz = ws.map(w => SR.segs(w.t).reduce((s, x) => s + tw(g, x.t, sz, w.form === 'weak' ? 500 : 800), 0));
        const total = wsz.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
        let x = 640 - total / 2;
        const segs = SR.segs(text).filter(s => s.w != null);
        ws.forEach((w, i) => {
          segs.filter(s => s.w === w.i).forEach(s => {
            const c = RCOL(s.role), wt = s.role === 'weak' ? 500 : s.role === 'str2' ? 600 : 800;
            const ww = txt(g, s.t, x, 270, { size: sz, weight: wt, color: c });
            if (s.role === 'str' || s.role === 'ret') { g.fillStyle = c; g.fillRect(x, 270 + sz * 0.56, ww, 3); }
            x += ww;
          });
          if (i < ws.length - 1) x += gap;
        });
        if (spread < 0.05) { rr(g, 640 - total / 2 - 22, 270 - sz * 0.85, total + 44, sz * 1.75, 20); g.strokeStyle = COL.accent; g.lineWidth = 2.5; g.stroke(); }
        listen(640 - total / 2 - 22, 220, total + 44, 100, say(text));
        capsBand(g, text, 640, 362, 30, { align: 'center' });
        const B = balls(g, text, 640, 455, { R: 30, caps: true });
        measTag(g, B, 640, 532);
      });
      if (pick) { bigChunk(pick.en, 1, 0); txt(g, pick.ko, 640, 190, { size: 18, weight: 600, color: COL.muted, align: 'center' }); return; }
      bigChunk(SR.CHUNKS[0].en, ramp(u, 0.4, 0.5) * (1 - ramp(u, 5.6, 0.4)), 1 - ramp(u, 2.5, 2.4));
      SR.CHUNKS.forEach((c, i) => fade(g, ramp(u, CHUNK_AT[i], 0.5), () => {
        const col = i % 3, row = Math.floor(i / 3), x = 80 + col * 375, y = 150 + row * 200;
        const hl = (u >= 30 && u < 35.2) || (i === 0 && u < 12) || (i >= 1 && i <= 3 && u >= 12 && u < 18) || (i === 4 && u >= 18 && u < 24) || (i === 5 && u >= 24 && u < 30);
        panel(g, x, y, 355, 182, { fill: COL.panel, stroke: COL.faint });
        const R = sentence(g, c.en, x + 177, y + 46, 27, { align: 'center', maxW: 300 });
        rr(g, R.x - 12, y + 46 - 22, R.w + 24, 44, 14); g.strokeStyle = hl ? COL.accent : COL.line; g.lineWidth = hl ? 2.5 : 1.2; g.stroke();
        txt(g, c.ko, x + 177, y + 86, { size: 14, weight: 500, color: COL.muted, align: 'center' });
        capsBand(g, c.en, x + 177, y + 116, 18, { align: 'center', maxW: 320 });
        balls(g, c.en, x + 177, y + 154, { R: 11, labels: false, hpx: 1, wgap: 4 });
      }));
      fade(g, ramp(u, 35, 0.5), () => chip(g, '이어 말할 때 소리가 바뀌는 연음 → 다음 꼭지', 640, 556, { size: 16, color: COL.muted, fill: COL.panel2, align: 'center', h: 34 }));
    },

    /* 06 센 낱말 사이 간격 */
    stretch(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      const rows = SR.STRETCH.map((s, i) => ({ text: s.en, at: i * 6 + 0.4 })).concat([{ text: SR.STRETCH[SR.STRETCH_KO.of].en, ko: SR.STRETCH_KO.ko, at: 36 }]);
      const durs = rows.map(r => r.ko ? SRS.durOf(r.ko, 'ko') : SRS.durOf(r.text, 'tc'));
      const enMeasured = durs.slice(0, 3).every(d => d), maxDur = Math.max(1, ...durs.filter(Boolean)), maxN = 14;
      const BX = 770, BW = 410;
      fade(g, ramp(u, 24, 0.5), () => {
        txt(g, '음절 수', BX, 150, { size: 14, weight: 700, color: COL.soft });
        if (enMeasured) txt(g, '이 목소리로 잰 문장 길이', BX + 80, 150, { size: 14, weight: 700, color: COL.str });
      });
      rows.forEach((r, i) => fade(g, ramp(u, r.at, 0.5), () => {
        const y = 180 + i * 95;
        if (r.ko) koText(g, r.ko, 80, y, 24);
        else sentence(g, r.text, 80, y, 26, { maxW: 640 });
        const n = r.ko ? SR.koN(r.ko) : SR.nSyl(r.text);
        const B = balls(g, r.text, 80, y + 40, r.ko ? { ko: r.ko, R: 9, labels: false, hpx: 0.8, align: 'left', pad: 6 } : { R: 9, labels: false, hpx: 0.8, align: 'left', pad: 6, wgap: 6 });
        if (!r.ko) txt(g, `센 음절 사이 → ${SR.gaps(r.text).join(' · ') || '없음'}`, B.x1 + 16, y + 40, { size: 13, weight: 600, color: COL.muted });
        fade(g, ramp(u, 24, 0.5), () => {
          const bw = BW * n / maxN;
          rr(g, BX, y - 16, bw, 13, 4); g.fillStyle = hex(r.ko ? COL.trap : COL.soft, 0.75); g.fill();
          txt(g, `${n}음절`, BX + bw + 10, y - 10, { size: 13, weight: 700, fam: FM, color: COL.soft });
          const d = durs[i];
          if (d && enMeasured) {
            const dw = BW * d / maxDur;
            rr(g, BX, y + 4, dw, 13, 4); g.fillStyle = hex(r.ko ? COL.trap : COL.str, 0.85); g.fill();
            txt(g, `${(d / 1000).toFixed(2)}초`, BX + dw + 10, y + 10, { size: 13, weight: 700, fam: FM, color: r.ko ? COL.trap : COL.str });
          }
        });
      }));
      // 잰 값이 있으면 음절 수가 는 만큼과 길이가 는 만큼을 견줘요 (잰 값이 그렇지 않으면 그렇다고 말하지 않음)
      fade(g, win(u, 24, 40.2), () => {
        if (!enMeasured) { chip(g, '잰 값이 아직 없어요 — 음절 수만 그렸어요(문장 길이는 소리 파일을 만든 뒤 재요)', 640, 552, { size: 15, color: COL.muted, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 34 }); return; }
        const rs = SR.nSyl(rows[2].text) / SR.nSyl(rows[0].text), rd = durs[2] / durs[0];
        const msg = rd < rs ? `음절은 ${rs.toFixed(0)}배 · 길이는 ${rd.toFixed(1)}배 — 음절만큼 늘지 않았어요` : `음절은 ${rs.toFixed(0)}배 · 길이는 ${rd.toFixed(1)}배 — 이 목소리는 음절만큼 늘었어요`;
        chip(g, msg, 640, 552, { size: 16, color: rd < rs ? COL.accent : COL.soft, fill: COL.panel2, stroke: rd < rs ? COL.accent : COL.faint, align: 'center', h: 34 });
      });
      fade(g, ramp(u, 40, 0.4), () => chip(g, '똑같은 간격은 아니에요 — 측정으로 확인되지 않은 경향', 640, 552, { size: 16, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 07 강한 형태로 돌아올 때 */
    back(g, u) {
      legend(g, ramp(u, 0.4, 0.5), true);
      if (S.strong != null) {
        const s = SR.STRONG[S.strong];
        const R = sentence(g, s.en, 640, 220, 48, { align: 'center', maxW: 1080 });
        txt(g, s.ko, 640, 172, { size: 17, weight: 600, color: COL.muted, align: 'center' });
        SR.analyze(s.en).forEach(w => {
          const r = R.words[w.i]; if (!r) return;
          const c = w.form === 'weak' ? COL.weak : w.ret ? COL.ret : COL.str, mid = (r.a + r.b) / 2, mw = Math.max(60, r.b - r.a + 16);
          txt(g, w.form === 'weak' ? '약' : '강', mid, 278, { size: 17, weight: 800, color: c, align: 'center' });
          txt(g, SR.WHY[w.why].ko, mid, 304, { size: fit(g, SR.WHY[w.why].ko, 14, mw, 600), weight: 600, color: c, align: 'center' });
        });
        capsBand(g, s.en, 640, 360, 26, { align: 'center' });
        const B = balls(g, s.en, 640, 450, { R: 30, caps: true });
        measTag(g, B, 640, 528);
        const ret = SR.analyze(s.en).find(w => w.ret);
        if (ret) chip(g, `${ret.t} → ${SR.WHY[ret.why].long}`, 640, 560, { size: 16, color: COL.ret, fill: COL.panel2, stroke: COL.ret, align: 'center', h: 32 });
        return;
      }
      fade(g, win(u, 0.4, 6.2), () => {
        [['문장 끝의 전치사', 300], ['혼자 대답', 640], ['강조 · 인용', 980]].forEach(([s, x], i) => {
          panel(g, x - 150, 250, 300, 120, { fill: COL.panel, stroke: COL.ret });
          txt(g, ['하나', '둘', '셋'][i], x, 290, { size: 16, weight: 700, color: COL.muted, align: 'center' });
          txt(g, s, x, 330, { size: 24, weight: 800, color: COL.ret, align: 'center' });
        });
      });
      BACK_ROWS.forEach(([text, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = 162 + i * 46, ws = SR.analyze(text), ret = ws.find(w => w.ret);
        const why = ret ? SR.WHY[ret.why].ko : '대명사는 약한 채로';
        tag(g, why, 80, y, ret ? COL.ret : COL.weak, { align: 'left', size: 14, h: 30 });
        sentence(g, text, 270, y, 25, { maxW: 470 });
        capsBand(g, text, 1200, y, 18, { align: 'right', maxW: 420 });
      }));
    },

    /* 08 문장 속에서 */
    sentence(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      if (S.sent != null) {
        const s = SR.FIND_POOL[S.sent];
        txt(g, SR.meaning(s), 640, 180, { size: 18, weight: 600, color: COL.muted, align: 'center' });
        sentence(g, s, 640, 240, 44, { align: 'center', maxW: 1100 });
        capsBand(g, s, 640, 310, 26, { align: 'center', maxW: 1100 });
        const B = balls(g, s, 640, 420, { R: 26, caps: true, lab: 14 });
        measTag(g, B, 640, 492);
        tag(g, `센 낱말 ${SR.strongCount(s)}개`, 640, 540, COL.str, { align: 'center', size: 16, h: 32 });
        return;
      }
      SR.LONG.forEach((s, i) => fade(g, ramp(u, 0.4 + i * 6, 0.5), () => {
        const y = 175 + i * 128;
        sentence(g, s.en, 80, y, 30, { maxW: 690 });
        capsBand(g, s.en, 80, y + 40, 19, { maxW: 690, box: u >= 24 && u < 30.2 ? COL.accent : null });
        balls(g, s.en, 1010, y + 14, { R: 11, labels: false, hpx: 1, wgap: 5 });
        tag(g, `센 낱말 ${SR.strongCount(s.en)}개`, 1010, y + 54, COL.str, { align: 'center', size: 14, h: 28 });
      }));
      fade(g, win(u, 30, 35.2), () => chip(g, '모든 낱말을 같은 세기로 읽지 않기 · 센 낱말만 살리기', 640, 556, { size: 17, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 36 }));
      fade(g, ramp(u, 35, 0.5), () => chip(g, '따라 말하기 28문장 · 묶음마다 일곱', 640, 556, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
    },

    /* 09 정리 */
    summary(g, u) {
      const X = [80, 360, 790], Y0 = 145;
      fade(g, ramp(u, 0.3, 0.5), () => {
        panel(g, 60, Y0, 1160, 330, { fill: COL.panel, stroke: COL.faint });
        circ(g, X[1] + 26, Y0 + 46, 22, hex(COL.str, 0.85));
        circ(g, X[2] + 18, Y0 + 50, 12, hex(COL.weak, 0.4)); ring(g, X[2] + 18, Y0 + 50, 12, COL.weak, 1.8);
        txt(g, '센 낱말', X[1] + 60, Y0 + 46, { size: 22, weight: 800, color: COL.str });
        txt(g, '약한 낱말', X[2] + 44, Y0 + 50, { size: 22, weight: 800, color: COL.weak });
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + 98, 1120, 1);
      });
      const rows = [
        ['① 듣고 가르기', '뜻을 나르는 내용어 · 큰 공', '문법을 잇는 기능어 · 작은 공', 0.4],
        ['② 소리 만들기', '길게 · 크게 · 높게', '짧게 · 흐린 어 · 앞뒤에 붙여', 6],
        ['③ 문장 속에서', '센 낱말 사이를 비슷하게 (경향)', '끝 · 혼자 대답 · 강조에서는 강한 형태', 12],
      ];
      rows.forEach(([h, a, b, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = Y0 + 140 + i * 66;
        txt(g, h, X[0] + 16, y, { size: 19, weight: 800, color: COL.text });
        txt(g, a, X[1] + 4, y, { size: fit(g, a, 18, 410, 600), weight: 600, color: COL.str });
        txt(g, b, X[2] + 4, y, { size: fit(g, b, 18, 410, 600), weight: 600, color: i === 2 ? COL.ret : COL.weak });
      }));
      fade(g, ramp(u, 18, 0.5), () => {
        const p = SR.CAN[0];
        capsBand(g, p.can, 420, 515, 22, { align: 'center' });
        txt(g, '·', 640, 515, { size: 22, color: COL.muted, align: 'center' });
        capsBand(g, p.cant, 860, 515, 22, { align: 'center' });
        listen(300, 495, 680, 40, [{ text: p.can, sp: 'tc' }, { text: p.cant, sp: 'tc', gap: 0.8 }]);
      });
      fade(g, ramp(u, 24, 0.5), () => txt(g, '목표 = 듣는 사람이 뜻을 쉽게 따라오는 리듬', 640, 562, { size: 17, weight: 700, color: COL.soft, align: 'center' }));
    },
  };
  SRS.SCENES = SCENES;

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
  SRS.captionLines = (g, text) => { const c = g.canvas; void c; return drawCaption(g, text); };

  SRS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[SRS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, SRS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + SR.allText() + Object.values(CLASS_ROWS).map(r => r.map(x => x.join('')).join('')).join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔⇢≈≠✓×?!~=+-–—/:…‘’“”\'%&<>|ɹɝɚəæɑɔɪʊʌɛŋθðʃʒˈˌms초음절배개';
  SRS.baseText = EXTRA;
  SRS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = SRS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { SRS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
