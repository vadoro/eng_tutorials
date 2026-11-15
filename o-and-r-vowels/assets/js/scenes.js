/* 미끄러지는 오, r을 품은 어 — oʊ · ɝ · ɚ: 영상 장면과 자막 (RVS)
 * 그림은 시간 t와 사용자 상태(S)만의 함수예요. 목표 모음 · 짝 · 한국어식 · 외래어 함정 · 칠할 글자는 규칙 엔진(RV)이 계산하고,
 * 모음 지도의 점 · 화살표(F1 · F2)와 r 울림 막대(F3)는 미리 만든 음성 파일을 따로 잰 값(RVV.meas)으로 그려요.
 * 잰 값이 없으면 지도는 그림 자리(어림이라고 밝힘), 막대는 빈 점선 막대(‘잰 값 없음’)로 그려요.
 * 입 그림은 공통 부품 EN.mouth(../shared/mouth.js)의 o · u · a · rb · r · wedge 자세.
 * 역할 색: 목표 소리(oʊ · ɝ · ɚ) 노랑 · 짝 소리(ɑ · ɔ · ʌ) 하늘 · 아 + r 분홍 · 한국어식 · 외래어 함정 주황
 */
(function () {
  'use strict';
  const RV = window.RV, M = window.EN.mouth, V = window.RVV;
  const RVS = (window.RVS = {});
  const W = 1280, H = 720;
  RVS.W = W; RVS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  RVS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    a: '#FFC15E', b: '#6EC8FF', ins: '#FF7AA8', weak: '#7FE0A8', str: '#C9A7FF', trap: '#FF9F7A', plain: '#7D8A99',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  // 역할: tgt 목표 소리 · mate 짝 소리 · arr 아 + r · ko 한국어식 · 외래어 함정
  COL.tgt = COL.a; COL.mate = COL.b; COL.arr = COL.ins; COL.ko = COL.trap;
  RVS.COL = COL;
  const rcol = r => r === 'a' ? COL.tgt : r === 'c' ? COL.arr : COL.mate;
  const vcol = v => rcol((RV.V[v] || {}).role);
  RVS.vcol = vcol; RVS.rcol = rcol;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (RVS.S = { pair: null, voice: null, mapVoice: null, gword: null, opair: null, rword: null, f3Voice: null, tri: null, triVoice: null, wword: null, loan: null, sent: null });
  RVS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  RVS.hits = () => HITS;

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
  function arrow(g, x0, y0, x1, y1, color, lw = 2.5, dash, hs = 11) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; if (dash) g.setLineDash(dash);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - Math.cos(ang) * hs * 0.7, y1 - Math.sin(ang) * hs * 0.7); g.stroke(); g.setLineDash([]);
    arrowHead(g, x1, y1, ang, color, hs);
  }
  RVS.arrow = arrow;
  function check(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x - s * 0.12, y + s * 0.4); g.lineTo(x + s * 0.55, y - s * 0.45); g.stroke();
  }
  function cross(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - s / 2, y - s / 2); g.lineTo(x + s / 2, y + s / 2); g.moveTo(x + s / 2, y - s / 2); g.lineTo(x - s / 2, y + s / 2); g.stroke();
  }
  RVS.check = check; RVS.cross = cross;
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
  RVS.hex = hex;
  const say = (k, sp = 'tc') => [{ text: RV.word(k), sp }];
  const sayKo = k => [{ text: RV.entry(k).ko, sp: 'ko' }];
  const gloss = k => (RV.entry(k) || {}).gloss || '';

  /* ---------- 아이콘 — 24×24 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요 ---------- */
  const ICON = {
    spk: [['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'f'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
    ear: [['M7.5 9.5a4.5 4.5 0 1 1 9 0c0 3.1-3 3.7-3 6.6a2.7 2.7 0 0 1-5.1 1.1'], ['M10.5 10a1.6 1.6 0 1 1 3 .9']],
    mouth: [['M3.5 12c2.5-3 5.5-4.2 8.5-4.2S18 9 20.5 12c-2.5 3-5.5 4.2-8.5 4.2S6 15 3.5 12z'], ['M3.5 12h17']],
    text: [['M4 6.5h16M4 10.5h16M4 14.5h11M4 18.5h7']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z'], ['M6 11a6 6 0 0 0 12 0'], ['M12 17v3.5M9 20.5h6']],
    bars: [['M5 19.5h14'], ['M7.5 19.5v-6M12 19.5v-12M16.5 19.5v-9']],
    map: [['M4 4.5h16v15H4z'], ['M8.5 9a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0'], ['M13 14.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0'], ['M11.3 10.2l2.4 3']],
  };
  RVS.ICON = ICON;
  const P2D = {};
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const k = size / 24;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    (ICON[id] || []).forEach(([d, m]) => { const p = P2D[d] || (P2D[d] = new Path2D(d)); if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  RVS.icon = icon;
  RVS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 입 그림 (EN.mouth) ---------- */
  const MLAB = ['윗잇몸', '센입천장', '여린입천장', '혀끝', '혀 뒤', '입술', '목(성대)'];
  const mfont = (sz, w) => fnt(sz, w || 600);
  // 모음 → 자세 이름
  const POSE = { 'oʊ': 'o', 'ɑ': 'a', 'ɔ': 'a', 'ɝ': 'rb', 'ʌ': 'wedge', 'ɚ': 'rb', 'ɑr': 'a' };
  RVS.POSE = POSE;
  function mouth(g, x, y, s, pose, o = {}) {
    if (REC) MLAB.forEach(m => REC.add(m));
    return M.draw(g, x, y, s, pose, Object.assign({ font: mfont }, o));
  }
  RVS.mouth = mouth;
  // 다른 자세의 혀 윗면을 점선으로 겹쳐 그림(견주기)
  function ghost(g, x, y, s, pose, color) {
    const p = M.pose(pose), pts = M.spline([p.R, p.K, p.D, p.F, p.B, p.T], false, 12);
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = color; g.lineWidth = 3 / s * 0.9; g.setLineDash([7, 6]); g.lineCap = 'round';
    g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); g.setLineDash([]);
    g.restore();
  }
  RVS.ghost = ghost;
  // 혀의 가장 높은 곳(앞 모음은 F · D, 뒤 모음은 D · K)에 점
  function peak(g, x, y, s, pose, front, color) {
    const p = M.pose(pose), keys = front ? ['F', 'D'] : ['D', 'K'];
    const q = keys.map(k => p[k]).sort((a, b) => a[1] - b[1])[0];
    circ(g, x + q[0] * s, y + q[1] * s, 7, color); ring(g, x + q[0] * s, y + q[1] * s, 11, color, 2);
    return [x + q[0] * s, y + q[1] * s];
  }
  RVS.peak = peak;

  /* ---------- 낱말 그리기: 목표 모음 글자를 역할 색(노랑 · 하늘 · 분홍) + 밑줄 ---------- */
  function word(g, k, x, y, size, o = {}) {
    const e = RV.entry(k), wt = o.weight || 700;
    if (!e) { const ww = txt(g, k, x, y, { size, weight: wt, color: o.base || COL.text, align: o.align }); return { x, w: ww }; }
    const parts = RV.spellSegs(k);
    const total = parts.reduce((s, p) => s + tw(g, p.t, size, wt), 0);
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx;
    parts.forEach(p => {
      const c = o.paint === false || !p.role ? (o.base || COL.text) : rcol(p.role);
      const ww = txt(g, p.t, xx, y, { size, weight: wt, color: c });
      if (p.role && o.paint !== false) { g.fillStyle = c; g.fillRect(xx, y + size * 0.56, ww, Math.max(2.5, size * 0.06)); }
      xx += ww;
    });
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, total + 16, size * 1.45, say(k, o.sp || 'tc'));
    return { x: x0, w: total };
  }
  RVS.word = word;
  // 한국어식: 주황 글자
  function koWord(g, k, x, y, size, o = {}) {
    const ko = RV.entry(k).ko;
    const w = txt(g, ko, x, y, { size, weight: o.weight || 700, color: o.color || COL.ko, align: o.align });
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, w + 16, size * 1.45, sayKo(k));
    return { x: x0, w };
  }
  RVS.koWord = koWord;
  // 문장: 사전에 있는 낱말의 목표 모음 글자를 칠함
  function sentence(g, text, x, y, size, o = {}) {
    const segs = RV.segs(text), wt = o.weight || 600;
    let total = segs.reduce((a, s) => a + tw(g, s.t, size, wt), 0);
    const sz = o.maxW && total > o.maxW ? size * o.maxW / total : size;
    if (sz !== size) total = segs.reduce((a, s) => a + tw(g, s.t, sz, wt), 0);
    let xx = o.align === 'center' ? x - total / 2 : x;
    const x0 = xx;
    segs.forEach(s => {
      const c = s.role ? rcol(s.role) : (o.base || COL.text);
      const ww = txt(g, s.t, xx, y, { size: sz, weight: wt, color: c });
      if (s.role) { g.fillStyle = c; g.fillRect(xx, y + sz * 0.56, ww, 2.5); }
      xx += ww;
    });
    if (o.hit !== false) listen(x0 - 8, y - sz * 0.75, total + 16, sz * 1.6, [{ text, sp: o.sp || 'tc' }]);
    return { x: x0, w: total, size: sz };
  }
  RVS.sentence = sentence;

  /* ---------- 잰 값 ----------
     F: 목표 모음 가운데의 [F1, F2] · G: 처음 · 끝 [[F1, F2], [F1, F2]] · F3: 목표 모음 앞쪽의 세 번째 공명(Hz) */
  const mOf = (k, sp) => V.meas(sp, RV.word(k));
  const fOf = (k, sp) => { const m = mOf(k, sp); return m && m.F ? m.F : null; };
  const gOf = (k, sp) => { const m = mOf(k, sp); return m && m.G ? m.G : null; };
  const f3Of = (k, sp) => { const m = sp === 'ko' ? V.meas('ko', RV.entry(k).ko) : mOf(k, sp); return m && m.F3 ? m.F3 : null; };
  RVS.fOf = fOf; RVS.gOf = gOf; RVS.f3Of = f3Of;
  // 한 낱말의 지도 점: 미끄러지는 오는 처음 → 끝 두 점, 나머지는 가운데 한 점
  const ptsOf = (k, sp) => RV.vowel(k) === 'oʊ' ? gOf(k, sp) : (fOf(k, sp) ? [fOf(k, sp)] : null);
  RVS.ptsOf = ptsOf;

  /* ---------- 모음 지도 ----------
     잰 값이 있으면 그 목소리의 낱말들로 잡은 범위에 찍고, 없으면 그림 자리(RV.SCHEM).
     가로 = 혀의 앞(왼쪽, F2 높음) → 뒤 · 세로 = 혀가 높음(위, F1 낮음) → 낮음(아래, 턱을 크게 내림) */
  function mapRange(pts) {
    if (pts.length < 2) return null;
    const f1 = pts.map(p => p[0]), f2 = pts.map(p => p[1]);
    const lo1 = Math.min(...f1), hi1 = Math.max(...f1), lo2 = Math.min(...f2), hi2 = Math.max(...f2);
    const p1 = Math.max(70, (hi1 - lo1) * 0.3), p2 = Math.max(240, (hi2 - lo2) * 0.18);
    return { f1lo: lo1 - p1 * 1.2, f1hi: hi1 + p1, f2lo: lo2 - p2, f2hi: hi2 + p2 };
  }
  RVS.mapRange = mapRange;
  function mapXY(box, F, v, end) {
    if (box.R && F) return [box.x + (box.R.f2hi - F[1]) / (box.R.f2hi - box.R.f2lo) * box.w, box.y + (F[0] - box.R.f1lo) / (box.R.f1hi - box.R.f1lo) * box.h];
    const s = RV.SCHEM[v] || RV.KO_SCHEM[v] || { x: 0.5, y: 0.5 };
    return end && s.x2 != null ? [box.x + s.x2 * box.w, box.y + s.y2 * box.h] : [box.x + s.x * box.w, box.y + s.y * box.h];
  }
  RVS.mapXY = mapXY;
  function mapBase(g, x, y, w, h, o = {}) {
    panel(g, x - 16, y - 16, w + 32, h + 32 + (o.foot || 0), { fill: o.fill || COL.panel2, stroke: o.stroke || COL.faint, r: 12 });
    g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.setLineDash([4, 5]);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x + w * 0.32, y + h); g.closePath(); g.stroke(); g.setLineDash([]);
    if (o.axes !== false) {
      const s = o.axSize || 13;
      txt(g, '앞', x + 4, y - 2, { size: s, weight: 700, color: COL.muted, base: 'bottom' });
      txt(g, '뒤', x + w - 4, y - 2, { size: s, weight: 700, color: COL.muted, align: 'right', base: 'bottom' });
      if (o.long) {
        txt(g, '혀가 높이', x - 8, y + 16, { size: s, weight: 700, color: COL.muted, align: 'right' });
        txt(g, '낮게', x - 8, y + h - 8, { size: s, weight: 700, color: COL.muted, align: 'right' });
      }
    }
  }
  RVS.mapBase = mapBase;
  function dot(g, X, Y, v, lab, o = {}) {
    const c = o.color || vcol(v), r = o.r || 9;
    if (o.ko) { circ(g, X, Y, r + 2, hex(c, 0.18)); ring(g, X, Y, r + 2, c, 2, [4, 3]); }
    else { circ(g, X, Y, r, hex(c, 0.9)); ring(g, X, Y, r + 3, c, 1.5); }
    if (lab) txt(g, lab, X + (o.lx || 0), Y + (o.ly == null ? -r - 12 : o.ly), { size: o.ls || 16, weight: 800, fam: o.fam || FM, color: c, align: o.la || 'center' });
  }
  RVS.dot = dot;
  // 미끄러짐 화살표: 처음(빈 원) → 끝(화살촉)
  function glideArrow(g, a, b, c, lab, o = {}) {
    ring(g, a[0], a[1], o.r || 8, c, 2.5);
    arrow(g, a[0], a[1], b[0], b[1], c, o.lw || 3.5, null, o.hs || 13);
    if (lab) txt(g, lab, a[0] + (o.lx || 0), a[1] + (o.ly == null ? 22 : o.ly), { size: o.ls || 16, weight: 800, fam: o.fam || FM, color: c, align: o.la || 'center' });
  }
  RVS.glideArrow = glideArrow;
  // 지도 하나: words(미끄러지는 오는 화살표) · sp = 목소리. 돌려줌 { measured, box, miss }
  function vmap(g, x, y, w, h, words, sp, o = {}) {
    const P = words.map(k => o.schem ? null : ptsOf(k, sp));
    const measured = !o.schem && P.every(Boolean);
    const box = { x, y, w, h, R: measured ? mapRange([].concat(...P)) : null };
    mapBase(g, x, y, w, h, o);
    const R0 = o.r || 9;
    words.forEach((k, i) => {
      const v = RV.vowel(k), c = vcol(v), lab = o.labels === 'word' ? RV.word(k) : o.labels === false ? '' : v;
      const fam = o.labels === 'word' ? FB : FM;
      if (v === 'oʊ') {
        const a = mapXY(box, measured ? P[i][0] : null, v), b = mapXY(box, measured ? P[i][1] : null, v, true);
        glideArrow(g, a, b, c, lab, { r: R0 - 1, ls: o.ls || 16, fam, ly: a[1] > b[1] ? 24 : -22 });
      } else {
        const [X, Y] = mapXY(box, measured ? P[i][0] : null, v);
        dot(g, X, Y, v, lab, { r: R0, ls: o.ls || 16, fam, ly: o.below && o.below.indexOf(k) >= 0 ? R0 + 14 : null });
      }
    });
    if (o.ko && !measured) Object.keys(RV.KO_SCHEM).filter(k => o.ko === true || o.ko.indexOf(k) >= 0).forEach(k => {
      const [X, Y] = mapXY(box, null, k); dot(g, X, Y, k, `한국어 ${k}`, { color: COL.ko, ko: true, r: 14, fam: FB, ls: 14, ly: -28 });
    });
    if (o.note !== false) txt(g, measured ? (o.noteText || `이 목소리를 잰 값 · ${(RV.VOICES.find(v => v.sp === sp) || {}).ko || ''}`) : '그림 자리(어림)', x + w / 2, y + h + 22 + (o.noteDy || 0), { size: 12, weight: 600, color: measured ? COL.muted : COL.dim, align: 'center' });
    if (o.hit !== false) listen(x - 16, y - 16, w + 32, h + 32, words.map((k, i) => ({ text: RV.word(k), sp, gap: i ? 0.6 : 0 })));
    return { measured, box };
  }
  RVS.vmap = vmap;

  /* ---------- r 울림 막대(F3) ----------
     items = [{ k, sp, lab }] — sp 'ko'면 한국어식 표기를 잰 값. 막대가 낮을수록 세 번째 공명이 낮음 = r 울림.
     잰 값이 없으면 점선 빈 막대 + '잰 값 없음'(그림 자리를 꾸며 넣지 않아요) */
  const F3_LO = 1000, F3_HI = 3800;
  function f3bars(g, x, y, w, h, items, o = {}) {
    panel(g, x - 16, y - 16, w + 32, h + 32 + (o.foot == null ? 46 : o.foot), { fill: COL.panel2, stroke: COL.faint, r: 12 });
    const n = items.length, gap = o.gap || 18, bw = Math.min(o.bw || 70, (w - gap * (n - 1)) / n);
    const x0 = x + (w - (bw * n + gap * (n - 1))) / 2, base = y + h;
    // 눈금(Hz)
    [1500, 2000, 2500, 3000].forEach(hz => {
      const yy = base - (hz - F3_LO) / (F3_HI - F3_LO) * h;
      g.fillStyle = COL.faint; g.fillRect(x, yy, w, 1);
      if (o.ticks !== false) txt(g, String(hz), x - 6, yy, { size: 11, fam: FM, color: COL.dim, align: 'right' });
    });
    let all = true;
    items.forEach((it, i) => {
      const bx = x0 + i * (bw + gap), v = it.sp === 'ko' ? null : RV.vowel(it.k), f = f3Of(it.k, it.sp);
      const c = it.sp === 'ko' ? COL.ko : vcol(v);
      if (f) {
        const bh = clamp((f - F3_LO) / (F3_HI - F3_LO)) * h;
        rr(g, bx, base - bh, bw, bh, 6); g.fillStyle = hex(c, 0.85); g.fill();
        txt(g, `${f}`, bx + bw / 2, base - bh - 12, { size: o.vs || 13, weight: 700, fam: FM, color: c, align: 'center' });
      } else {
        all = false;
        rr(g, bx, base - h * 0.5, bw, h * 0.5, 6); g.strokeStyle = COL.dim; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]);
        txt(g, '잰 값 없음', bx + bw / 2, base - h * 0.25, { size: 11, weight: 600, color: COL.dim, align: 'center' });
      }
      const lab = it.lab != null ? it.lab : it.sp === 'ko' ? RV.entry(it.k).ko : RV.word(it.k);
      txt(g, lab, bx + bw / 2, base + 18, { size: fit(g, lab, o.ls || 16, bw + gap - 4, 800, 10, it.sp === 'ko' ? FB : FB), weight: 800, color: c, align: 'center' });
      if (it.sub) txt(g, it.sub, bx + bw / 2, base + 38, { size: fit(g, it.sub, 12, bw + gap - 2, 600, 9), weight: 600, color: COL.muted, align: 'center' });
      if (o.hit !== false) listen(bx - 4, base - h, bw + 8, h + 30, [{ text: it.sp === 'ko' ? RV.entry(it.k).ko : RV.word(it.k), sp: it.sp }]);
    });
    if (o.note !== false) txt(g, o.noteText || (all ? '세 번째 공명(F3, Hz) · 잰 값' : '세 번째 공명(F3, Hz) · 잰 값 · 빈 막대는 잰 값 없음'), x + w / 2, y - 2, { size: 12, weight: 600, color: COL.muted, align: 'center', base: 'bottom' });
    return { all };
  }
  RVS.f3bars = f3bars;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호는 자막에 쓰지 않음
     영어 낱말 바로 뒤에 조사를 붙이지 않아요(소리 내어 읽을 때 어색해서) — → 나 = 로 이어요.
     IPA 기호(oʊ · ɑ · ɔ · ɝ · ʌ · ɚ)는 자막에 쓰지 않고 ‘미끄러지는 오 · 크게 벌린 아 · r을 품은 어 · r 없는 어 · 약한 r 모음’으로 적어요(화면에는 기호를 함께).
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '미끄러지는 오, r을 품은 어 — oʊ · ɝ · ɚ', d: 36, caps: [
      [0.4, 6, '외투와 잡았다를 영어로 말해 보세요. 한국어로 적으면 둘 다 코트예요.'],
      [6, 12, '영어 coat → 미끄러지는 오, caught → 크게 벌린 아예요. 끝에서 우 쪽으로 미끄러지느냐가 두 낱말을 갈라요.'],
      [12, 18, '일과 걷다도 그래요. work · walk → 한국어로 적으면 둘 다 워크예요.'],
      [18, 24, 'work → r을 품은 어, walk → 크게 벌린 아. 혀를 r 모양으로 하느냐가 두 낱말을 갈라요.'],
      [24, 30, '세 단계로 익혀요. 두 소리를 듣고 가르고, 입술과 혀의 모양을 만들고, 낱말과 문장 속에서 써요.'],
      [30, 36, '미국 표준 발음을 기준으로 해요. 소리는 모두 합성 음성이에요.'],
    ] },
    { id: 'listen', n: '01', title: '들어 보기 · 구별되나요?', sub: '① 듣고 가르기 · 모음 하나만 다른 짝 · 목소리 넷', d: 40, caps: [
      [0.4, 6, '먼저 귀부터 시험해요. 짝 낱말을 눌러 들어 보세요. 모음 하나만 달라요.'],
      [6, 12, 'coat · caught, boat · bought. 끝에서 우 쪽으로 미끄러지는 쪽은 어느 것인가요?'],
      [12, 18, 'work · walk, bird · bud. 모음 내내 r 울림이 이어지는 쪽은 어느 것인가요?'],
      [18, 25, '작은 그림은 이 목소리를 재서 그렸어요. 화살표는 미끄러지는 오, 막대는 r 울림이에요.'],
      [25, 32, '한국어식으로는 코트 · 코트, 보트 · 보트, 워크 · 워크, 버드 · 버드 → 짝마다 표기가 같아요.'],
      [32, 40, '여러 목소리로 듣고 가르는 연습이 도움이 돼요. 아래 놀이터의 **듣고 가르기 훈련**이 그 연습이에요.'],
    ] },
    { id: 'glide', n: '02', title: '미끄러지는 오', sub: '② 입 모양 만들기 · 오에서 우로 · 한국어 오는 한 모양', d: 44, caps: [
      [0.4, 6, '미끄러지는 오부터 만들어요. 입술을 둥글게 모으고, 한국어 오처럼 시작해요.'],
      [6, 12, '그다음 혀 뒤를 조금 올리고 입술을 더 모으며 우 쪽으로 미끄러져요. 한 모음 안에서 움직여요.'],
      [12, 18, '한국어 오는 처음부터 끝까지 한 모양이에요. 그래서 오 하나로 끝내기 쉬워요.'],
      [18, 25, '오른쪽은 이 목소리를 잰 지도예요. 화살표가 모음의 처음에서 끝으로 움직인 길이에요.'],
      [25, 32, '연구에서도 한국 대학생은 이 소리의 뒤쪽, 우 부분을 자주 빼곤 했어요. 듣기도 어려운 소리였어요.'],
      [32, 38, 'boat · home · phone · go. 끝을 우 쪽으로 살짝 닫아 보세요.'],
      [38, 44, '요령 → 오와 우를 두 박자로 끊지 말고, 한 박자 안에서 미끄러지듯 이어요.'],
    ] },
    { id: 'open', n: '03', title: '크게 벌린 아 · 미끄러지지 않아요', sub: '② 입 모양 만들기 · 짝 소리 ɑ · ɔ · 같은 표기 여섯 쌍', d: 40, caps: [
      [0.4, 6, '짝 소리는 크게 벌린 아예요. 턱을 크게 내리고, 끝까지 미끄러지지 않아요.'],
      [6, 12, 'caught · bought · law · saw. 사전에는 다른 기호로 적지만, 많은 미국 사람이 크게 벌린 아로 말해요.'],
      [12, 18, '입술을 조금 둥글려 말하는 사람도 있어요. 어느 쪽이든 끝에서 우로 미끄러지지 않아요.'],
      [18, 25, '한국어 표기는 이 두 소리를 자주 같은 글자로 적어요. 열 쌍 가운데 여섯 쌍이 같은 표기예요.'],
      [25, 32, 'note · not → 노트 · 낫, hope · hop → 호프 · 합처럼 다른 표기도 있어요.'],
      [32, 40, '연구에서는 한국 대학생이 미국 영어의 boat · bought 짝을 자주 헷갈렸어요. 미끄러짐이 들리는지가 열쇠예요.'],
    ] },
    { id: 'rvowel', n: '04', title: 'r을 품은 어', sub: '② 입 모양 만들기 · 혀를 r 모양으로, 처음부터 끝까지', d: 44, caps: [
      [0.4, 6, '이제 r을 품은 어예요. 어를 내는 동안 혀를 처음부터 r 모양으로 둬요.'],
      [6, 12, 'r 모양은 두 가지예요. 혀 몸통을 뭉쳐 올리거나, 혀끝을 살짝 젖혀요. 혀끝은 입천장에 닿지 않아요.'],
      [12, 18, '입술은 조금 모아요. 어 다음에 ㄹ을 붙이는 게 아니라, 모음 전체가 r 소리예요.'],
      [18, 25, 'work · bird · hurt · girl. 한국어 표기는 모두 어로 적어서 r이 보이지 않아요.'],
      [25, 32, '오른쪽 막대는 세 번째 울림의 높이예요. 혀를 r 모양으로 하면 이 울림이 뚝 내려가요.'],
      [32, 38, 'work 막대는 walk 막대보다 훨씬 낮아요. bird · bud 짝도 마찬가지예요. 이 목소리를 재서 그렸어요.'],
      [38, 44, '한 연구에서 중상급 학습자는 bird · word 같은 낱말에서 원어민처럼 이 울림을 낮췄어요. 연습하면 낼 수 있는 소리예요.'],
    ] },
    { id: 'tri', n: '05', title: '셋이 갈리는 줄', sub: '① 듣고 가르기 · hut · hurt · heart · 자음은 같고 모음만 달라요', d: 44, caps: [
      [0.4, 6, '셋을 한꺼번에 들어 봐요. 자음은 같고 모음만 달라요.'],
      [6, 12, 'hut · hurt · heart → r 없는 어, r을 품은 어, 아 다음에 r이에요.'],
      [12, 18, 'bun · burn · barn, cub · curb · carb. 셋의 뜻이 모두 달라요.'],
      [18, 25, '한국어식으로는 헛 · 허트 · 하트 → 어와 아는 갈리지만, r은 어디에도 없어요.'],
      [25, 32, 'r을 품은 어는 처음부터 r이에요. 아 다음 r은 아로 시작해 끝에서 r로 옮겨 가요.'],
      [32, 38, '아래 띠는 r 울림이 모음의 어디에 있는지 그린 그림이에요. 잰 값이 아니에요.'],
      [38, 44, '요령 → hurt → 혀를 r 모양으로 둔 채 시작, heart → 입을 크게 연 다음 r로.'],
    ] },
    { id: 'weak', n: '06', title: '약한 r 모음', sub: '③ 낱말 속에서 · 끝의 어에도 r · water · doctor · center', d: 40, caps: [
      [0.4, 6, '약한 음절에도 r 모음이 있어요. water · doctor · center · computer → 끝소리예요.'],
      [6, 12, '한국어 표기는 워터 · 닥터 · 센터 · 컴퓨터 → 끝을 어로 적어요.'],
      [12, 18, '영어에서는 짧고 약하게 내지만, 혀는 여전히 r 모양이에요.'],
      [18, 25, '막대는 끝 음절의 세 번째 울림이에요. 영어 water 막대는 한국어식 워터 막대보다 훨씬 낮아요.'],
      [25, 32, 'teacher · sister · paper → 모두 같아요. 끝을 어로 툭 끊지 말고, 혀를 r 모양으로 둬요.'],
      [32, 40, '외래어 표기는 끝의 r을 적지 않아요. 한국어의 소리 체계 때문이라는 설명이 있어요.'],
    ] },
    { id: 'loan', n: '07', title: '외래어 함정', sub: '③ 낱말 속에서 · 한글의 오 · 어가 감추는 것', d: 44, caps: [
      [0.4, 6, '외래어는 한글이 소리를 감출 때가 많아요. 칠한 글자가 목표 모음이에요.'],
      [6, 12, '미끄러지는 오 → home · phone · show · toast. 홈 · 폰 · 쇼 · 토스트 → 오 하나로 적어요.'],
      [12, 18, '크게 벌린 아 → ball · talk · sauce · shopping. 볼 · 토크 · 소스 · 쇼핑도 오로 적지만, 미끄러지지 않아요.'],
      [18, 24, 'r을 품은 어 → nurse · first · world · burger. 너스 · 퍼스트 · 월드 · 버거 → 어로 적어 r이 보이지 않아요.'],
      [24, 31, '약한 r 모음 → water · doctor · center · computer. 끝 음절에서도 혀는 r 모양이에요.'],
      [31, 37, '같은 오라도 home → 미끄러지고, ball → 미끄러지지 않아요. 한글만 보고는 알 수 없어요.'],
      [37, 44, '흔한 외래어부터 바꿔 보세요. phone → 오에서 우로, ball → 턱을 크게, burger → 혀를 r 모양으로.'],
    ] },
    { id: 'sentence', n: '08', title: '문장 속에서', sub: '③ 문장 속에서 · 짧은 낱말에도 숨어 있어요', d: 44, caps: [
      [0.4, 6, '문장 속에서도 자주 나와요. 노란 글자가 미끄러지는 오와 r 모음, 하늘색 글자가 짝 소리예요.'],
      [6, 12, 'I bought a boat. bought → 크게 벌린 아, boat → 미끄러지는 오예요.'],
      [12, 18, "Don't walk on the road. don't · road → 미끄러지고, walk → 미끄러지지 않아요."],
      [18, 24, 'I work on Sunday. work → r을 품은 어, Sunday → r 없는 어예요.'],
      [24, 30, 'The nurse called the doctor. 한 문장에 세 가지가 함께 있어요.'],
      [30, 37, "짧은 낱말도 조심해요. so · go · don't → 미끄러지는 오, her · first → r을 품은 어예요."],
      [37, 44, '아래 **따라 말하기**에 문장 스물여덟 개가 있어요. 묶음마다 일곱 문장이에요.'],
    ] },
    { id: 'summary', n: '09', title: '정리', sub: '3단계 발음법 · 미끄러짐과 r 울림', d: 36, caps: [
      [0.4, 6, '정리해요. ① 듣고 가르기 → 끝에서 우로 미끄러지나, 모음 내내 r 울림이 있나.'],
      [6, 12, '② 만들기 → 오는 입술을 모으며 우까지, r 모음은 혀를 r 모양으로 처음부터 끝까지.'],
      [12, 18, '③ 낱말 · 문장 속에서 → 한글의 오 · 어는 미끄러짐과 r을 감춰요. 사전에서 확인해요.'],
      [18, 24, '입 그림은 쉽게 줄여 그린 것이에요. r 모양은 사람마다 달라서, 뭉친 혀와 젖힌 혀 모두 괜찮아요.'],
      [24, 30, '목표는 원어민과 똑같은 소리가 아니라, 듣는 사람이 낱말을 쉽게 알아듣는 소리예요.'],
      [30, 36, '아래 **듣고 가르기 훈련**과 **내 모음 찍기**에서 직접 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  RVS.CHAPTERS = CHAPTERS; RVS.CAPTIONS = CAPTIONS; RVS.END = END;
  RVS.POSTER = CHAPTERS.find(c => c.id === 'listen').t + 21;
  RVS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  RVS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 900, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 900, 800, 24, FD), weight: 800, fam: FD });
  }
  // 오른쪽 위 범례
  function legend(g, a = 1, items) {
    fade(g, a, () => {
      let x = 1200;
      (items || [['미끄러지는 오 · r 모음', COL.tgt], ['짝 소리 ɑ ɔ · ʌ', COL.mate]]).forEach(([s, c]) => { const r = tag(g, s, x, 92, c, { align: 'right', size: 15, h: 30 }); x = r.x - 10; });
    });
  }

  // 장마다 쓰는 낱말
  RVS.LISTEN_PAIRS = ['coat-caught', 'boat-bought', 'work-walk', 'bird-bud'];
  RVS.GLIDE_WORDS = ['boat', 'home', 'phone', 'go'];
  RVS.R_WORDS = ['work', 'bird', 'hurt', 'girl'];
  RVS.R_BARS = ['work', 'walk', 'bird', 'bud'];
  RVS.WEAK_WORDS = ['water', 'doctor', 'center', 'computer'];
  RVS.WEAK_MORE = ['teacher', 'sister', 'paper'];
  const SROWS = [
    { en: 'I bought a boat.', at: 6 },
    { en: "Don't walk on the road.", at: 12 },
    { en: 'I work on Sunday.', at: 18 },
    { en: 'The nurse called the doctor.', at: 24 },
  ];
  RVS.SROWS = SROWS;
  const pairById = id => RV.PAIRS.find(p => p.id === id);
  RVS.pairById = pairById;

  // 한국어식 표기: 목표 모음의 글자에 밑줄
  function koCard(g, k, x, y, size, o = {}) {
    const segs = RV.koSegs(k), wt = o.weight || 700;
    const total = segs.reduce((s, p) => s + tw(g, p.t, size, wt), 0);
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx;
    segs.forEach(p => {
      const ww = txt(g, p.t, xx, y, { size, weight: wt, color: COL.ko });
      if (p.on) { g.fillStyle = COL.ko; g.fillRect(xx, y + size * 0.56, ww, Math.max(2.5, size * 0.06)); }
      xx += ww;
    });
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, total + 16, size * 1.45, sayKo(k));
    return { x: x0, w: total };
  }
  RVS.koCard = koCard;

  // 미끄러짐: 시간에 따라 오 → 우 → 오 … (k = 0 오 · 1 우 쪽)
  const glideK = u => { const p = ((u % 2.6) + 2.6) % 2.6; return p < 0.5 ? 0 : p < 1.6 ? ease((p - 0.5) / 1.1) : p < 2.2 ? 1 : 1 - ease((p - 2.2) / 0.4); };
  RVS.glideK = glideK;
  const GLIDE_TO = 0.85;   // 끝은 u 자세 쪽으로 85% (ʊ 가까이)
  const glidePose = k => M.mix('o', 'u', k * GLIDE_TO);
  RVS.glidePose = glidePose;

  // r 울림 띠(그림): 모음 시간 안에서 r 울림이 있는 곳을 칠함 — 잰 값이 아님
  function rStrip(g, x, y, w, h, v, c) {
    rr(g, x, y, w, h, h / 2); g.fillStyle = COL.panel; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.stroke();
    const from = v === 'ɝ' ? 0 : v === 'ɑr' ? 0.55 : 1;
    if (from < 1) {
      g.save(); rr(g, x, y, w, h, h / 2); g.clip();
      const gr = g.createLinearGradient(x + w * from, 0, x + w * Math.min(1, from + 0.2), 0);
      gr.addColorStop(0, hex(c, 0)); gr.addColorStop(1, hex(c, 0.85));
      g.fillStyle = v === 'ɝ' ? hex(c, 0.85) : gr; g.fillRect(x + w * from, y, w * (1 - from), h); g.restore();
    }
  }
  RVS.rStrip = rStrip;

  const SCENES = {
    /* 00 들어가며 */
    intro(g, u) {
      const A = 1 - ramp(u, 23.6, 0.5);
      const row = (y, a, b, kA, kB, at, atE) => {
        fade(g, A * ramp(u, at, 0.6), () => {
          panel(g, 100, y, 500, 190, { fill: COL.panel, stroke: COL.faint });
          txt(g, '한국어식', 130, y + 28, { size: 15, weight: 700, color: COL.muted });
          txt(g, gloss(a), 260, y + 70, { size: 20, weight: 700, color: COL.soft, align: 'center' });
          txt(g, gloss(b), 440, y + 70, { size: 20, weight: 700, color: COL.soft, align: 'center' });
          koCard(g, a, 260, y + 128, 48, { align: 'center' });
          koCard(g, b, 440, y + 128, 48, { align: 'center' });
          txt(g, '=', 350, y + 128, { size: 40, weight: 700, color: COL.trap, align: 'center' });
        });
        fade(g, A * ramp(u, atE, 0.6), () => {
          panel(g, 680, y, 500, 190, { fill: COL.panel, stroke: COL.faint });
          txt(g, '영어', 710, y + 28, { size: 15, weight: 700, color: COL.muted });
          word(g, a, 820, y + 76, 46, { align: 'center' });
          word(g, b, 1040, y + 76, 46, { align: 'center' });
          txt(g, RV.ipa(a), 820, y + 120, { size: 17, fam: FM, color: COL.muted, align: 'center' });
          txt(g, RV.ipa(b), 1040, y + 120, { size: 17, fam: FM, color: COL.muted, align: 'center' });
          txt(g, RV.V[RV.vowel(a)].ko, 820, y + 156, { size: 16, weight: 800, color: COL.tgt, align: 'center' });
          txt(g, RV.V[RV.vowel(b)].ko, 1040, y + 156, { size: 16, weight: 800, color: COL.mate, align: 'center' });
          txt(g, '≠', 930, y + 76, { size: 40, weight: 700, color: COL.muted, align: 'center' });
        });
      };
      row(150, 'coat', 'caught', 0, 0, 0.4, 6);
      row(370, 'work', 'walk', 0, 0, 12, 18);
      const steps = [['ear', '① 듣고 가르기', '미끄러지나 · r 울림이 있나'], ['mouth', '② 입 모양 만들기', '입술 모으기 · 혀를 r 모양으로'], ['text', '③ 낱말 · 문장 속에서', '외래어 · 약한 음절 · 문장']];
      steps.forEach(([ic, h, s], i) => fade(g, ramp(u, 24.2 + i * 0.6, 0.5), () => {
        const x = 110 + i * 360;
        panel(g, x, 200, 340, 190, { fill: COL.panel, stroke: COL.faint });
        circ(g, x + 170, 252, 30, COL.panel2); icon(g, ic, x + 170, 252, 32, COL.accent);
        txt(g, h, x + 170, 314, { size: 22, weight: 800, color: COL.text, align: 'center' });
        txt(g, s, x + 170, 352, { size: 16, weight: 500, color: COL.soft, align: 'center' });
      }));
      fade(g, ramp(u, 30, 0.5), () => {
        chip(g, '미국 표준 발음(General American) · 합성 음성', 640, 460, { size: 16, weight: 600, color: COL.muted, fill: COL.panel2, align: 'center' });
      });
    },

    /* 01 들어 보기 */
    listen(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      const ids = S.pair ? [S.pair] : RVS.LISTEN_PAIRS, sp = S.voice || 'tc';
      ids.forEach((id, i) => fade(g, S.pair ? 1 : ramp(u, 0.6 + i * 0.4, 0.5), () => {
        const p = pairById(id), one = !!S.pair, r = p.side === 'r';
        const y = one ? 170 : 140 + i * 104, h = one ? 330 : 94;
        panel(g, 80, y, 1120, h, { fill: COL.panel, stroke: COL.faint });
        const wy = y + (one ? 92 : 36), sz = one ? 58 : 36;
        word(g, p.a, 220, wy, sz, { align: 'center', sp });
        word(g, p.b, 470, wy, sz, { align: 'center', sp });
        txt(g, '·', 345, wy, { size: 30, color: COL.muted, align: 'center' });
        txt(g, `${RV.ipa(p.a)} ${gloss(p.a)}`, 220, wy + (one ? 58 : 34), { size: fit(g, `${RV.ipa(p.a)} ${gloss(p.a)}`, 14, 230, 400, 10, FM), fam: FM, color: COL.muted, align: 'center' });
        txt(g, `${RV.ipa(p.b)} ${gloss(p.b)}`, 470, wy + (one ? 58 : 34), { size: fit(g, `${RV.ipa(p.b)} ${gloss(p.b)}`, 14, 230, 400, 10, FM), fam: FM, color: COL.muted, align: 'center' });
        if (one) {
          txt(g, RV.V[RV.vowel(p.a)].ko, 220, y + h - 30, { size: 16, weight: 800, color: COL.tgt, align: 'center' });
          txt(g, RV.V[RV.vowel(p.b)].ko, 470, y + h - 30, { size: 16, weight: 800, color: COL.mate, align: 'center' });
        }
        // 작은 그림: 미끄러짐 짝은 지도, r 짝은 막대
        fade(g, one ? 1 : ramp(u, 18 + i * 0.4, 0.5), () => {
          if (r) f3bars(g, one ? 650 : 640, y + (one ? 50 : 16), one ? 280 : 250, one ? 200 : 46, [{ k: p.a, sp, lab: one ? null : '' }, { k: p.b, sp, lab: one ? null : '' }],
            { bw: one ? 80 : 60, gap: one ? 40 : 30, foot: one ? 46 : 2, ticks: one, vs: one ? 13 : 11, noteText: one ? null : 'r 울림(F3)', note: true });
          else vmap(g, one ? 650 : 650, y + (one ? 50 : 16), one ? 280 : 230, one ? 200 : 58, [p.a, p.b], sp, { axSize: 11, r: one ? 9 : 6, ls: one ? 15 : 12, labels: one ? 'word' : false, noteDy: one ? 0 : -20, note: one, axes: one });
        });
        // 한국어식: 같은 표기면 =
        fade(g, one ? 1 : ramp(u, 25 + i * 0.3, 0.5), () => {
          const kx = 1090, ks = one ? 30 : 22, same = RV.koSame(p.a, p.b);
          txt(g, same ? '한국어식 · 같은 표기' : '한국어식', kx, wy - 22, { size: 12, weight: 700, color: COL.muted, align: 'center' });
          koCard(g, p.a, kx - 44, wy + 12, ks, { align: 'center' });
          txt(g, same ? '=' : '·', kx, wy + 12, { size: ks, weight: 700, color: same ? COL.trap : COL.muted, align: 'center' });
          koCard(g, p.b, kx + 44, wy + 12, ks, { align: 'center' });
        });
      }));
      fade(g, ramp(u, 32.4, 0.5) * (S.pair ? 0 : 1), () => {
        RV.VOICES.forEach((v, i) => {
          const x = 250 + i * 260, hl = S.voice === v.sp;
          const c = chip(g, v.ko, x, 572, { size: 15, fill: COL.panel2, stroke: hl ? COL.accent : COL.line, align: 'center', pad: 30, h: 30 });
          icon(g, 'spk', c.x + 16, 572, 16, COL.accent);
          listen(c.x, c.y, c.w, c.h, [{ text: 'coat', sp: v.sp }, { text: 'caught', sp: v.sp, gap: 0.7 }]);
        });
      });
    },

    /* 02 미끄러지는 오 */
    glide(g, u, t, idle = 0) {
      const sel = S.gword, x = 70, my = 148, ms = 0.62;
      const k = sel ? glideK(idle) : u < 6 ? 0 : u < 12 ? glideK(u - 6) : u < 18 ? 0 : glideK(u - 18);
      const korean = !sel && u >= 12 && u < 18;
      fade(g, ramp(u, 0.4, 0.5), () => {
        panel(g, x - 10, my - 8, 590, 432, { fill: COL.panel, stroke: COL.faint });
        const p = korean ? M.pose('o') : glidePose(k);
        mouth(g, x, my, ms, p, { mark: korean ? COL.ko : COL.tgt, labels: ['velum', 'back', 'lips'], voice: idle || u });
        if (!korean && (sel || u >= 6)) fade(g, 0.9, () => ghost(g, x, my, ms, 'o', COL.dim));
        M.lips(g, x + 310, my + 10, 0.9, p);
        txt(g, '입술 앞모습', x + 400, my + 150, { size: 13, weight: 600, color: COL.muted, align: 'center' });
        // 오 → 우 막대
        const bx = x + 300, by = my + 196, bw = 200;
        rr(g, bx, by, bw, 12, 6); g.fillStyle = COL.panel2; g.fill();
        if (korean) { circ(g, bx + 8, by + 6, 9, COL.ko); txt(g, '한국어 오 · 한 모양', bx + bw / 2, by + 34, { size: 15, weight: 800, color: COL.ko, align: 'center' }); }
        else {
          rr(g, bx, by, 12 + (bw - 12) * k, 12, 6); g.fillStyle = hex(COL.tgt, 0.85); g.fill();
          txt(g, '오', bx, by + 34, { size: 16, weight: 800, color: COL.soft, align: 'center' });
          txt(g, '→ 우', bx + bw, by + 34, { size: 16, weight: 800, color: COL.tgt, align: 'center' });
        }
        tag(g, korean ? '한국어 오' : 'oʊ · 미끄러지는 오', x + 400, my + 260, korean ? COL.ko : COL.tgt, { align: 'center', size: 17, h: 36, fam: FM });
        const tip = korean ? ['처음부터 끝까지', '한 모양으로 끝나요'] : ['오로 시작해', '우 쪽으로 · 입술을 더 모아요'];
        txt(g, tip[0], x + 400, my + 302, { size: 15, weight: 600, color: COL.soft, align: 'center' });
        txt(g, tip[1], x + 400, my + 326, { size: fit(g, tip[1], 15, 250, 800), weight: 800, color: korean ? COL.ko : COL.tgt, align: 'center' });
        const ws = sel ? [sel] : RVS.GLIDE_WORDS;
        fade(g, sel ? 1 : ramp(u, 32, 0.5), () => ws.forEach((w, i) => word(g, w, x + 85 + i * 135 + (ws.length === 1 ? 200 : 0), my + 388, 26, { align: 'center' })));
      });
      // 오른쪽: 잰 지도
      fade(g, ramp(u, 18, 0.5) || (sel ? 1 : 0), () => {
        const sp = S.mapVoice || 'tc', words = sel ? [sel].concat(RV.partner(sel) ? [RV.partner(sel)] : []) : RV.MAP;
        txt(g, words.map(RV.word).join(' · '), 930, 160, { size: 18, weight: 700, color: COL.soft, align: 'center' });
        vmap(g, 760, 196, 340, 250, words, sp, { labels: 'word', ls: 15, axSize: 14, long: false, below: ['caught'] });
      });
      fade(g, win(u, 25, 32.2) * (sel ? 0 : 1), () => chip(g, '연구 → 한국 대학생은 뒤쪽(우)을 자주 뺐어요', 930, 540, { size: 15, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 34 }));
      fade(g, ramp(u, 38, 0.5) * (sel ? 0 : 1), () => chip(g, '요령 → 오 · 우 두 박자가 아니라 한 박자 안에서', 930, 540, { size: 16, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 03 크게 벌린 아 · 미끄러지지 않아요 */
    open(g, u, t, idle = 0) {
      const x = 70, my = 148, ms = 0.62, sel = S.opair;
      fade(g, ramp(u, 0.4, 0.5), () => {
        panel(g, x - 10, my - 8, 520, 432, { fill: COL.panel, stroke: COL.faint });
        mouth(g, x, my, ms, 'a', { mark: COL.mate, labels: ['velum', 'back'], voice: idle || u });
        fade(g, ramp(u, 0.8, 0.5), () => ghost(g, x, my, ms, 'o', COL.tgt));
        M.lips(g, x + 300, my + 10, 0.8, 'a');
        txt(g, '점선 = 미끄러지는 오의 처음', x + 250, my + 300, { size: 13, weight: 600, color: COL.tgt, align: 'center' });
        tag(g, 'ɑ · ɔ · 크게 벌린 아', x + 250, my + 340, COL.mate, { align: 'center', size: 17, h: 36, fam: FM });
        txt(g, '턱을 크게 · 끝까지 미끄러지지 않아요', x + 250, my + 384, { size: 15, weight: 800, color: COL.mate, align: 'center' });
      });
      // 오른쪽: 미끄러짐 짝 열 쌍과 한국어식 표기
      const P = RV.pairsOf('o'), nSame = P.filter(p => RV.koSame(p.a, p.b)).length;
      fade(g, ramp(u, 6, 0.5), () => {
        P.forEach((p, i) => {
          const col = i % 2, ri = Math.floor(i / 2), X = 620 + col * 300, Y = 150 + ri * 76, same = RV.koSame(p.a, p.b);
          const hi = sel ? sel === p.id : u >= 25 ? !same : u >= 18 ? same : false;
          fade(g, sel ? (sel === p.id ? 1 : 0.4) : ramp(u, 6 + i * 0.25, 0.4), () => {
            panel(g, X, Y, 284, 64, { fill: COL.panel, stroke: hi ? (same ? COL.trap : COL.accent) : COL.faint, lw: hi ? 2.5 : 1.5, r: 10 });
            word(g, p.a, X + 14, Y + 22, 20, {});
            txt(g, '·', X + 92, Y + 22, { size: 18, color: COL.muted, align: 'center' });
            word(g, p.b, X + 104, Y + 22, 20, {});
            koCard(g, p.a, X + 14, Y + 48, 16, {});
            txt(g, same ? '=' : '·', X + 84, Y + 48, { size: 16, weight: 700, color: same ? COL.trap : COL.muted, align: 'center' });
            koCard(g, p.b, X + 104, Y + 48, 16, {});
            txt(g, same ? '같은 표기' : '다른 표기', X + 272, Y + 34, { size: 13, weight: 800, color: same ? COL.trap : COL.muted, align: 'right' });
          });
        });
      });
      fade(g, win(u, 18, 32.2) * (sel ? 0 : 1), () => chip(g, `한국어식 같은 표기 ${nSame} / ${P.length}쌍`, 920, 548, { size: 16, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'center', h: 34 }));
      fade(g, ramp(u, 32, 0.5) * (sel ? 0 : 1), () => chip(g, '연구 → 미국 영어 boat · bought 짝을 자주 헷갈렸어요', 920, 548, { size: 15, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 34 }));
    },

    /* 04 r을 품은 어 */
    rvowel(g, u, t, idle = 0) {
      const sel = S.rword;
      // 왼쪽: r 모양 둘(뭉친 혀 · 젖힌 혀)
      [['rb', '뭉친 혀', 0.4], ['r', '젖힌 혀', 6]].forEach(([p, lab, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const x = 70 + i * 290, my = 150, ms = 0.44;
        panel(g, x - 10, my - 10, 270, 230, { fill: COL.panel, stroke: COL.faint });
        mouth(g, x + 10, my + 4, ms, p, { mark: COL.tgt, voice: idle || u });
        tag(g, lab, x + 125, my + 196, COL.tgt, { align: 'center', size: 15, h: 30 });
      }));
      fade(g, ramp(u, 12, 0.5), () => {
        panel(g, 60, 400, 560, 170, { fill: COL.panel, stroke: COL.faint });
        M.lips(g, 120, 418, 0.62, 'rb');
        txt(g, '입술은 조금 모아요', 330, 432, { size: 16, weight: 700, color: COL.soft });
        txt(g, '어 + ㄹ이 아니라', 330, 470, { size: 16, weight: 700, color: COL.soft });
        txt(g, '모음 전체가 r 소리', 330, 500, { size: 18, weight: 800, color: COL.tgt });
        fade(g, ramp(u, 13, 0.5), () => { rStrip(g, 330, 528, 200, 16, 'ɝ', COL.tgt); txt(g, '그림(어림)', 542, 536, { size: 12, weight: 600, color: COL.dim }); });
      });
      // 오른쪽: 낱말 · 한국어식 → r 울림 막대
      fade(g, win(u, 18, 25.2) * (sel ? 0 : 1), () => {
        RVS.R_WORDS.forEach((k, i) => {
          const y = 170 + i * 92;
          panel(g, 680, y - 34, 520, 72, { fill: COL.panel, stroke: COL.faint, r: 10 });
          word(g, k, 720, y, 32, {});
          txt(g, RV.ipa(k), 870, y, { size: 15, fam: FM, color: COL.muted });
          koCard(g, k, 1060, y, 26, { align: 'center' });
          txt(g, 'r 없음', 1150, y, { size: 13, weight: 800, color: COL.trap, align: 'center' });
        });
      });
      fade(g, sel ? 1 : ramp(u, 25, 0.5), () => {
        const sp = S.f3Voice || 'tc', ws = sel ? [sel, RV.partner(sel)].filter(Boolean) : RVS.R_BARS;
        f3bars(g, 720, 190, 440, 270, ws.map(k => ({ k, sp, sub: RV.V[RV.vowel(k)].short })), { bw: 74, gap: 34, noteText: `세 번째 공명(F3, Hz) · ${(RV.VOICES.find(v => v.sp === sp) || {}).ko} · 잰 값` });
        txt(g, '막대가 낮을수록 r 울림이 뚜렷해요', 940, 546, { size: 14, weight: 700, color: COL.tgt, align: 'center' });
      });
      fade(g, ramp(u, 38, 0.5) * (sel ? 0 : 1), () => chip(g, '연구 → 중상급 학습자는 원어민처럼 낮췄어요', 940, 140, { size: 15, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 32 }));
    },

    /* 05 셋이 갈리는 줄 */
    tri(g, u) {
      legend(g, ramp(u, 0.4, 0.5), [['r 없는 어 ʌ', COL.mate], ['r을 품은 어 ɝ', COL.tgt], ['아 + r', COL.arr]]);
      const sp = S.triVoice || 'tc', one = S.tri != null;
      const rows = one ? [S.tri] : [0, 1, 2, 3];
      rows.forEach((ri, i) => {
        const row = RV.TRI[ri], at = one ? 0 : (i === 0 ? 6 : 12 + (i - 1) * 0.5);
        fade(g, one ? 1 : ramp(u, at, 0.5), () => {
          const y = one ? 230 : 204 + i * 80, sz = one ? 50 : 32;
          panel(g, 80, y - 32, 600, 64, { fill: COL.panel, stroke: one ? COL.accent : COL.faint, r: 12 });
          row.forEach((k, j) => {
            const x = 180 + j * 200;
            word(g, k, x, y - (one ? 4 : 0), sz, { align: 'center', sp });
            if (j) txt(g, '·', x - 100, y, { size: 26, color: COL.muted, align: 'center' });
          });
          if (one) row.forEach((k, j) => {
            txt(g, `${RV.ipa(k)} ${gloss(k)}`, 180 + j * 200, y + 70, { size: fit(g, `${RV.ipa(k)} ${gloss(k)}`, 15, 190, 400, 10, FM), fam: FM, color: COL.muted, align: 'center' });
            txt(g, RV.V[RV.vowel(k)].ko, 180 + j * 200, y + 100, { size: 15, weight: 800, color: vcol(RV.vowel(k)), align: 'center' });
          });
        });
      });
      fade(g, ramp(u, 6.4, 0.5) * (one ? 0 : 1), () => RV.TRI_V.forEach((v, j) => txt(g, RV.V[v].ko, 180 + j * 200, 156, { size: 14, weight: 800, color: vcol(v), align: 'center' })));
      // 오른쪽: 한국어식 → r 울림 띠(그림)
      const row = RV.TRI[one ? S.tri : 0];
      fade(g, ramp(u, 18, 0.5) || (one ? 1 : 0), () => {
        panel(g, 730, 150, 470, 120, { fill: COL.panel2, stroke: COL.faint });
        txt(g, '한국어식', 760, 176, { size: 14, weight: 700, color: COL.muted });
        row.forEach((k, j) => { koCard(g, k, 820 + j * 140, 226, 28, { align: 'center' }); });
        txt(g, 'r이 어디에도 없어요', 965, 176, { size: 14, weight: 800, color: COL.trap, align: 'center' });
      });
      fade(g, ramp(u, 25, 0.5) || (one ? 1 : 0), () => {
        panel(g, 730, 300, 470, 220, { fill: COL.panel2, stroke: COL.faint });
        txt(g, 'r 울림이 있는 곳 · 그림(잰 값이 아님)', 965, 324, { size: 13, weight: 600, color: COL.dim, align: 'center' });
        row.forEach((k, j) => {
          const v = RV.vowel(k), y = 368 + j * 52, c = vcol(v);
          word(g, k, 790, y, 22, { align: 'center' });
          rStrip(g, 860, y - 9, 300, 18, v, c);
          txt(g, v === 'ɝ' ? '처음부터 r' : v === 'ɑr' ? '아 → 끝에 r' : 'r 없음', 1010, y + 26, { size: 12, weight: 700, color: c, align: 'center' });
        });
      });
      fade(g, ramp(u, 38, 0.5) * (one ? 0 : 1), () => chip(g, '요령 → hurt = r 모양으로 시작 · heart = 크게 연 다음 r', 640, 556, { size: 16, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
    },

    /* 06 약한 r 모음 */
    weak(g, u) {
      const sel = S.wword;
      const ws = RVS.WEAK_WORDS;
      ws.forEach((k, i) => fade(g, sel ? (sel === k ? 1 : 0.45) : ramp(u, 0.6 + i * 0.3, 0.5), () => {
        const y = 150 + i * 96;
        panel(g, 80, y, 540, 80, { fill: COL.panel, stroke: sel === k ? COL.accent : COL.faint, r: 12 });
        word(g, k, 110, y + 30, 30, {});
        txt(g, RV.ipa(k), 110, y + 62, { size: 14, fam: FM, color: COL.muted });
        fade(g, sel ? 1 : ramp(u, 6 + i * 0.3, 0.5), () => {
          koCard(g, k, 480, y + 32, 28, { align: 'center' });
          txt(g, '끝 = 어 → r 없음', 480, y + 64, { size: 12, weight: 800, color: COL.trap, align: 'center' });
        });
      }));
      fade(g, win(u, 12, 18.2) * (sel ? 0 : 1), () => chip(g, '짧고 약하게 · 혀는 r 모양', 940, 300, { size: 20, color: COL.tgt, fill: COL.panel2, stroke: COL.tgt, align: 'center', h: 44 }));
      fade(g, sel ? 1 : ramp(u, 18, 0.5), () => {
        const k = sel || 'water';
        const items = RV.VOICES.map(v => ({ k, sp: v.sp, lab: v.ko, sub: RV.word(k) })).concat([{ k, sp: 'ko', lab: '한국어식', sub: RV.entry(k).ko }]);
        f3bars(g, 700, 190, 480, 270, items, { bw: 64, gap: 26, ls: 13, noteText: '끝 음절의 세 번째 공명(F3, Hz) · 잰 값' });
      });
      fade(g, win(u, 25, 32.2) * (sel ? 0 : 1), () => {
        panel(g, 80, 540, 540, 40, { fill: COL.panel2, stroke: COL.faint, r: 10 });
        RVS.WEAK_MORE.forEach((k, i) => word(g, k, 160 + i * 170, 560, 22, { align: 'center' }));
      });
      fade(g, ramp(u, 32, 0.5) * (sel ? 0 : 1), () => chip(g, '외래어 표기는 끝의 r을 적지 않아요', 350, 560, { size: 15, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'center', h: 34 }));
    },

    /* 07 외래어 함정 */
    loan(g, u) {
      const LAPPEAR = { 'oʊ': 6, 'ɔ': 12, 'ɝ': 18, 'ɚ': 24 };
      RV.LROWS.forEach((row, ri) => {
        const c = row.id === 'ɔ' ? COL.mate : COL.tgt;
        fade(g, ramp(u, LAPPEAR[row.id] - 0.2, 0.4), () => {
          txt(g, row.ko, 80, 150 + ri * 100, { size: 14, weight: 800, fam: FM, color: c });
          txt(g, RV.LROW_TIP[row.id], 1200, 150 + ri * 100, { size: 13, weight: 700, color: COL.muted, align: 'right' });
        });
        row.words.forEach((k, ci) => {
          const x = 80 + ci * 285, y = 164 + ri * 100, at = LAPPEAR[row.id] + ci * 0.3, hl = S.loan === k;
          const cmp = !S.loan && u >= 31 && u < 37 && (k === 'home' || k === 'ball');
          fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, at, 0.4)), () => panel(g, x, y, 265, 72, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }));
          fade(g, S.loan ? (hl ? 1 : 0.55) : ramp(u, at, 0.5), () => {
            panel(g, x, y, 265, 72, { fill: COL.panel, stroke: hl || cmp ? COL.accent : COL.faint, lw: hl || cmp ? 2.5 : 1.5 });
            koCard(g, k, x + 16, y + 25, fit(g, RV.entry(k).ko, 22, 100, 700));
            word(g, k, x + 249, y + 25, fit(g, k, 24, 140, 700), { align: 'right' });
            txt(g, RV.ipa(k), x + 249, y + 54, { size: 14, fam: FM, color: COL.muted, align: 'right' });
            const hide = RV.koHides(k), trap = RV.koTrap(k);
            const note = hide === 'glide' ? '오 하나 → 우까지' : hide === 'r' ? '어 → r' : trap ? `한글 ${trap} → 크게 벌린 아` : '한글 오 → 크게 벌린 아';
            txt(g, note, x + 16, y + 54, { size: 13, weight: 800, color: hide ? COL.tgt : COL.mate });
          });
        });
      });
      fade(g, ramp(u, 37, 0.5) * (S.loan ? 0 : 1), () => chip(g, 'phone → 오에서 우로 · ball → 턱을 크게 · burger → 혀를 r 모양으로', 640, 572, { size: 15, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 30 }));
    },

    /* 08 문장 속에서 */
    sentence(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      const cnt = text => { const n = RV.countIn(text); return { a: n['oʊ'] + n['ɝ'] + n['ɚ'], b: n['ɑ'] + n['ɔ'] + n['ʌ'] }; };
      if (S.sent != null) {
        const s = RV.SENT[S.sent];
        tag(g, RV.SGRP[s.grp].ko, 640, 220, COL.muted, { align: 'center', size: 16, h: 32, fam: FM });
        sentence(g, s.en, 640, 310, 46, { align: 'center', maxW: 1100 });
        txt(g, s.ko, 640, 390, { size: 20, weight: 600, color: COL.soft, align: 'center' });
        const n = cnt(s.en);
        txt(g, `미끄러지는 오 · r 모음 ${n.a} · 짝 소리 ${n.b}`, 640, 450, { size: 18, weight: 700, color: COL.muted, align: 'center' });
        return;
      }
      fade(g, win(u, 0.4, 6.2), () => {
        ['boat', 'work', 'bought', 'cup'].forEach((k, i) => {
          const x = 250 + i * 260;
          word(g, k, x, 310, 50, { align: 'center' });
          txt(g, RV.V[RV.vowel(k)].ko, x, 380, { size: 18, weight: 800, color: vcol(RV.vowel(k)), align: 'center' });
        });
      });
      SROWS.forEach((s, i) => fade(g, ramp(u, s.at, 0.5), () => {
        const y = 182 + i * 88;
        sentence(g, s.en, 120, y, 36, { maxW: 760 });
        const n = cnt(s.en);
        txt(g, `오 · r ${n.a}`, 1060, y, { size: 17, weight: 800, color: COL.tgt, align: 'right' });
        txt(g, `짝 ${n.b}`, 1180, y, { size: 17, weight: 800, color: COL.mate, align: 'right' });
      }));
      fade(g, ramp(u, 30, 0.5), () => {
        panel(g, 120, 534, 1040, 52, { fill: COL.panel2, stroke: COL.accent });
        ['so', 'go', "don't"].forEach((k, i) => word(g, k, 200 + i * 100, 560, 24, { align: 'center' }));
        txt(g, '→ 미끄러지는 오', 500, 560, { size: 17, weight: 700, color: COL.tgt, align: 'center' });
        ['her', 'first'].forEach((k, i) => word(g, k, 700 + i * 110, 560, 24, { align: 'center' }));
        txt(g, '→ r을 품은 어', 1000, 560, { size: 17, weight: 700, color: COL.tgt, align: 'center' });
      });
    },

    /* 09 정리 */
    summary(g, u) {
      const X = [80, 360, 790], Y0 = 145;
      fade(g, ramp(u, 0.3, 0.5), () => {
        panel(g, 60, Y0, 1160, 330, { fill: COL.panel, stroke: COL.faint });
        mouth(g, X[1] - 10, Y0 + 18, 0.17, 'o', { mark: COL.tgt });
        mouth(g, X[2] - 10, Y0 + 18, 0.17, 'rb', { mark: COL.tgt });
        txt(g, '미끄러지는 오 oʊ', X[1] + 64, Y0 + 50, { size: 22, weight: 800, color: COL.tgt });
        txt(g, 'r을 품은 어 ɝ · ɚ', X[2] + 64, Y0 + 50, { size: 22, weight: 800, color: COL.tgt });
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + 98, 1120, 1);
      });
      const rows = [
        ['① 듣고 가르기', '끝에서 우로 · coat ≠ caught', '모음 내내 r 울림 · work ≠ walk', 0.4],
        ['② 만들기', '입술을 모으며 오 → 우 · 한 박자', '혀를 r 모양으로 처음부터 · 입술 조금', 6],
        ['③ 낱말 속에서', '홈 · 폰 · 보트 → 오 하나로 적어요', '버거 · 워터 → 어로 적어 r이 안 보여요', 12],
      ];
      rows.forEach(([h, a, b, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = Y0 + 140 + i * 66;
        txt(g, h, X[0] + 16, y, { size: 19, weight: 800, color: COL.text });
        txt(g, a, X[1] + 4, y, { size: fit(g, a, 18, 410, 600), weight: 600, color: COL.soft });
        txt(g, b, X[2] + 4, y, { size: fit(g, b, 18, 410, 600), weight: 600, color: COL.soft });
      }));
      fade(g, ramp(u, 18, 0.5), () => txt(g, '입 그림은 쉽게 줄인 그림 · r 모양은 뭉친 혀 · 젖힌 혀 모두 괜찮아요', 640, 515, { size: 15, weight: 600, color: COL.muted, align: 'center' }));
      fade(g, ramp(u, 24, 0.5), () => txt(g, '목표 = 듣는 사람이 낱말을 쉽게 알아듣는 소리', 640, 560, { size: 17, weight: 700, color: COL.soft, align: 'center' }));
    },
  };
  RVS.SCENES = SCENES;

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

  RVS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[RVS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t, opt.idle || 0);
    g.restore();
    if (opt.caption) drawCaption(g, RVS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + RV.allText() + MLAB.join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔⇢≈≠✓×?!~=+-–—/:…‘’\'%&<>|ɹɝɚəæɑɔɪʊʌɛŋθðʃʒˈˌːmsHz';
  RVS.baseText = EXTRA;
  RVS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = RVS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { RVS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
