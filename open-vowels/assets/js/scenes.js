/* 입을 얼마나 벌리나 — æ · ɛ · ʌ · ɑ: 영상 장면과 자막 (OVS)
 * 그림은 시간 t와 사용자 상태(S)만의 함수예요. 센 음절의 모음 · 짝 · 한국어식 · 외래어 함정 · 칠할 글자는 규칙 엔진(OV)이 계산하고,
 * 모음 지도의 점(F1 · F2)은 미리 만든 음성 파일을 따로 잰 값(OVV.meas)으로 그려요(잰 값이 없으면 그림 자리).
 * 입 그림은 공통 부품 EN.mouth(../shared/mouth.js)의 ae · eh · a · wedge 자세.
 * 역할 색: 크게 벌린 모음(æ · ɑ) 노랑 · 덜 벌린 모음(ɛ · ʌ) 하늘 · 한국어식 · 외래어 함정 주황
 */
(function () {
  'use strict';
  const OV = window.OV, M = window.EN.mouth, V = window.OVV;
  const OVS = (window.OVS = {});
  const W = 1280, H = 720;
  OVS.W = W; OVS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  OVS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    a: '#FFC15E', b: '#6EC8FF', ins: '#FF7AA8', weak: '#7FE0A8', str: '#C9A7FF', trap: '#FF9F7A', plain: '#7D8A99',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  // 역할: open 크게 벌린 모음 · less 덜 벌린 모음 · ko 한국어식 · 외래어 함정
  COL.open = COL.a; COL.less = COL.b; COL.ko = COL.trap;
  OVS.COL = COL;
  const vcol = v => (OV.V[v] && OV.V[v].open) ? COL.open : COL.less;
  OVS.vcol = vcol;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (OVS.S = { pair: null, voice: null, mapVoice: null, fword: null, bword: null, tri: null, triVoice: null, loan: null, sent: null });
  OVS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  OVS.hits = () => HITS;

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
  OVS.arrow = arrow;
  function check(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x - s * 0.12, y + s * 0.4); g.lineTo(x + s * 0.55, y - s * 0.45); g.stroke();
  }
  function cross(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - s / 2, y - s / 2); g.lineTo(x + s / 2, y + s / 2); g.moveTo(x + s / 2, y - s / 2); g.lineTo(x - s / 2, y + s / 2); g.stroke();
  }
  OVS.check = check; OVS.cross = cross;
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
  OVS.hex = hex;
  const say = (k, sp = 'tc') => [{ text: OV.word(k), sp }];
  const sayKo = k => [{ text: OV.entry(k).ko, sp: 'ko' }];
  const gloss = k => (OV.entry(k) || {}).gloss || '';

  /* ---------- 아이콘 — 24×24 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요 ---------- */
  const ICON = {
    spk: [['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'f'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
    ear: [['M7.5 9.5a4.5 4.5 0 1 1 9 0c0 3.1-3 3.7-3 6.6a2.7 2.7 0 0 1-5.1 1.1'], ['M10.5 10a1.6 1.6 0 1 1 3 .9']],
    mouth: [['M3.5 12c2.5-3 5.5-4.2 8.5-4.2S18 9 20.5 12c-2.5 3-5.5 4.2-8.5 4.2S6 15 3.5 12z'], ['M3.5 12h17']],
    text: [['M4 6.5h16M4 10.5h16M4 14.5h11M4 18.5h7']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z'], ['M6 11a6 6 0 0 0 12 0'], ['M12 17v3.5M9 20.5h6']],
    map: [['M4 4.5h16v15H4z'], ['M8.5 9a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0'], ['M13 14.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0'], ['M11.3 10.2l2.4 3']],
  };
  OVS.ICON = ICON;
  const P2D = {};
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const k = size / 24;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    (ICON[id] || []).forEach(([d, m]) => { const p = P2D[d] || (P2D[d] = new Path2D(d)); if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  OVS.icon = icon;
  OVS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 입 그림 (EN.mouth) ---------- */
  const MLAB = ['윗잇몸', '센입천장', '여린입천장', '혀끝', '혀 뒤', '입술', '목(성대)'];
  const mfont = (sz, w) => fnt(sz, w || 600);
  // 모음 → 자세 이름
  const POSE = { 'æ': 'ae', 'ɛ': 'eh', 'ɑ': 'a', 'ʌ': 'wedge' };
  OVS.POSE = POSE;
  function mouth(g, x, y, s, pose, o = {}) {
    if (REC) MLAB.forEach(m => REC.add(m));
    return M.draw(g, x, y, s, pose, Object.assign({ font: mfont }, o));
  }
  OVS.mouth = mouth;
  // 다른 자세의 혀 윗면을 점선으로 겹쳐 그림(견주기)
  function ghost(g, x, y, s, pose, color) {
    const p = M.pose(pose), pts = M.spline([p.R, p.K, p.D, p.F, p.B, p.T], false, 12);
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = color; g.lineWidth = 3 / s * 0.9; g.setLineDash([7, 6]); g.lineCap = 'round';
    g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); g.setLineDash([]);
    g.restore();
  }
  OVS.ghost = ghost;
  // 혀의 가장 높은 곳(앞 모음은 F · D, 뒤 모음은 D · K)에 점
  function peak(g, x, y, s, pose, front, color) {
    const p = M.pose(pose), keys = front ? ['F', 'D'] : ['D', 'K'];
    const q = keys.map(k => p[k]).sort((a, b) => a[1] - b[1])[0];
    circ(g, x + q[0] * s, y + q[1] * s, 7, color); ring(g, x + q[0] * s, y + q[1] * s, 11, color, 2);
    return [x + q[0] * s, y + q[1] * s];
  }
  OVS.peak = peak;

  /* ---------- 낱말 그리기: 센 음절의 목표 모음 글자를 노랑(크게) · 하늘(덜) + 밑줄 ---------- */
  function word(g, k, x, y, size, o = {}) {
    const e = OV.entry(k), wt = o.weight || 700;
    if (!e) { const ww = txt(g, k, x, y, { size, weight: wt, color: o.base || COL.text, align: o.align }); return { x, w: ww }; }
    const parts = OV.spellSegs(k);
    const total = parts.reduce((s, p) => s + tw(g, p.t, size, wt), 0);
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx;
    parts.forEach(p => {
      const c = o.paint === false || !p.role ? (o.base || COL.text) : (p.role === 'a' ? COL.open : COL.less);
      const ww = txt(g, p.t, xx, y, { size, weight: wt, color: c });
      if (p.role && o.paint !== false) { g.fillStyle = c; g.fillRect(xx, y + size * 0.56, ww, Math.max(2.5, size * 0.06)); }
      xx += ww;
    });
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, total + 16, size * 1.45, say(k, o.sp || 'tc'));
    return { x: x0, w: total };
  }
  OVS.word = word;
  // 한국어식: 주황 글자
  function koWord(g, k, x, y, size, o = {}) {
    const ko = OV.entry(k).ko;
    const w = txt(g, ko, x, y, { size, weight: o.weight || 700, color: o.color || COL.ko, align: o.align });
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    if (o.hit !== false) listen(x0 - 8, y - size * 0.7, w + 16, size * 1.45, sayKo(k));
    return { x: x0, w };
  }
  OVS.koWord = koWord;
  // 문장: 사전에 있는 낱말의 목표 모음 글자를 칠함
  function sentence(g, text, x, y, size, o = {}) {
    const segs = OV.segs(text), wt = o.weight || 600;
    let total = segs.reduce((a, s) => a + tw(g, s.t, size, wt), 0);
    const sz = o.maxW && total > o.maxW ? size * o.maxW / total : size;
    if (sz !== size) total = segs.reduce((a, s) => a + tw(g, s.t, sz, wt), 0);
    let xx = o.align === 'center' ? x - total / 2 : x;
    const x0 = xx;
    segs.forEach(s => {
      const c = s.role ? (s.role === 'a' ? COL.open : COL.less) : (o.base || COL.text);
      const ww = txt(g, s.t, xx, y, { size: sz, weight: wt, color: c });
      if (s.role) { g.fillStyle = c; g.fillRect(xx, y + sz * 0.56, ww, 2.5); }
      xx += ww;
    });
    if (o.hit !== false) listen(x0 - 8, y - sz * 0.75, total + 16, sz * 1.6, [{ text, sp: o.sp || 'tc' }]);
    return { x: x0, w: total, size: sz };
  }
  OVS.sentence = sentence;

  /* ---------- 모음 지도 ----------
     잰 값(OVV.meas의 F = [F1, F2])이 있으면 그 목소리의 bat · bet · but · bot으로 잡은 범위에 찍고,
     없으면 그림 자리(OV.SCHEM). 가로 = 혀의 앞(왼쪽, F2 높음) → 뒤 · 세로 = 혀가 높음(위, F1 낮음) → 낮음(아래, 턱을 크게 내림) */
  const HVD = ['bat', 'bet', 'but', 'bot'];
  OVS.HVD = HVD;
  const fOf = (k, sp) => { const m = V.meas(sp, OV.word(k)); return m && m.F ? m.F : null; };
  OVS.fOf = fOf;
  function mapRange(sp, extra) {
    const pts = HVD.map(k => fOf(k, sp)).filter(Boolean).concat((extra || []).filter(Boolean));
    if (pts.length < 2) return null;
    const f1 = pts.map(p => p[0]), f2 = pts.map(p => p[1]);
    const lo1 = Math.min(...f1), hi1 = Math.max(...f1), lo2 = Math.min(...f2), hi2 = Math.max(...f2);
    const p1 = Math.max(60, (hi1 - lo1) * 0.35), p2 = Math.max(220, (hi2 - lo2) * 0.18);
    return { f1lo: lo1 - p1 * 1.4, f1hi: hi1 + p1 * 0.9, f2lo: lo2 - p2, f2hi: hi2 + p2 };
  }
  OVS.mapRange = mapRange;
  // 지도 칸: { x, y, w, h, R(범위 | null) } → 점의 자리
  function mapXY(box, F, v) {
    if (box.R && F) return [box.x + (box.R.f2hi - F[1]) / (box.R.f2hi - box.R.f2lo) * box.w, box.y + (F[0] - box.R.f1lo) / (box.R.f1hi - box.R.f1lo) * box.h];
    const s = OV.SCHEM[v] || OV.KO_SCHEM[v] || { x: 0.5, y: 0.5 };
    return [box.x + s.x * box.w, box.y + s.y * box.h];
  }
  OVS.mapXY = mapXY;
  // 지도 바탕: 사다리꼴 모음 공간 + 축 이름
  function mapBase(g, x, y, w, h, o = {}) {
    panel(g, x - 16, y - 16, w + 32, h + 32 + (o.foot || 0), { fill: o.fill || COL.panel2, stroke: o.stroke || COL.faint, r: 12 });
    g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.setLineDash([4, 5]);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x + w * 0.32, y + h); g.closePath(); g.stroke(); g.setLineDash([]);
    if (o.axes !== false) {
      const s = o.axSize || 13;
      txt(g, '앞', x + 4, y - 2 + (o.axIn ? 14 : 0), { size: s, weight: 700, color: COL.muted, base: o.axIn ? 'middle' : 'bottom' });
      txt(g, '뒤', x + w - 4, y - 2 + (o.axIn ? 14 : 0), { size: s, weight: 700, color: COL.muted, align: 'right', base: o.axIn ? 'middle' : 'bottom' });
      if (o.long) {
        txt(g, '혀가 높이', x - 8, y + 16, { size: s, weight: 700, color: COL.muted, align: 'right' });
        txt(g, '낮게', x - 8, y + h - 8, { size: s, weight: 700, color: COL.muted, align: 'right' });
      }
    }
  }
  // 점 하나
  function dot(g, X, Y, v, lab, o = {}) {
    const c = o.color || vcol(v), r = o.r || 9;
    if (o.ko) { circ(g, X, Y, r + 2, hex(c, 0.18)); ring(g, X, Y, r + 2, c, 2, [4, 3]); }
    else { circ(g, X, Y, r, hex(c, 0.9)); ring(g, X, Y, r + 3, c, 1.5); }
    if (lab) txt(g, lab, X + (o.lx || 0), Y + (o.ly == null ? -r - 12 : o.ly), { size: o.ls || 16, weight: 800, fam: o.fam || FM, color: c, align: o.la || 'center' });
  }
  OVS.dot = dot;
  // 지도 하나: words = [낱말] (점은 그 낱말 센 음절의 모음), sp = 목소리. 돌려줌 { measured, box, pts }
  function vmap(g, x, y, w, h, words, sp, o = {}) {
    const Fs = words.map(k => fOf(k, sp));
    // o.partial: 셋 이상인 낱말 묶음에서 하나만 못 재었으면 잰 점만 찍고(잰 값과 그림 자리를 섞지 않음) 빠진 낱말을 아래에 적어요
    const nF = Fs.filter(Boolean).length, part = !o.schem && o.partial && words.length >= 3 && nF >= words.length - 1 && nF < words.length;
    const measured = o.schem ? false : part || Fs.every(Boolean);
    const box = { x, y, w, h, R: measured ? mapRange(sp, Fs) : null };
    mapBase(g, x, y, w, h, o);
    const miss = part ? words.filter((k, i) => !Fs[i]) : [];
    const pts = words.map((k, i) => { const v = OV.vowel(k); return { k, v, xy: mapXY(box, Fs[i], v) }; }).filter((p, i) => !part || Fs[i]);
    if (o.arrows) {
      // 덜 벌린 → 크게 벌린 화살표 (짝끼리: 턱을 더 내리면)
      pts.forEach(p => { if (OV.V[p.v].open) return; const q = pts.find(z => z.v === OV.V[p.v].mate); if (q) arrow(g, p.xy[0], p.xy[1], q.xy[0], q.xy[1], COL.line, 2, [5, 4], 9); });
    }
    // 두 점이 가까우면 크게 벌린 쪽 글자를 점 아래로 — 글자가 다른 점에 가리지 않게
    const R0 = o.r || 9, near = p => pts.some(q => q !== p && Math.hypot(q.xy[0] - p.xy[0], q.xy[1] - p.xy[1]) < 2 * R0 + 22);
    pts.forEach(p => dot(g, p.xy[0], p.xy[1], p.v, o.labels === 'word' ? OV.word(p.k) : o.labels === false ? '' : p.v, { r: R0, ls: o.ls || 16, fam: o.labels === 'word' ? FB : FM, ly: OV.V[p.v].open && near(p) ? R0 + 14 : null }));
    if (o.note !== false) txt(g, measured ? (o.noteText || `이 목소리를 잰 값 · ${(OV.VOICES.find(v => v.sp === sp) || {}).ko || ''}`) + (miss.length ? ` · ${miss.map(OV.word).join(' · ')} 없음` : '') : '그림 자리(어림)', x + w / 2, y + h + 22 + (o.noteDy || 0), { size: 12, weight: 600, color: measured ? COL.muted : COL.dim, align: 'center' });
    if (o.hit !== false) listen(x - 16, y - 16, w + 32, h + 32, words.filter(k => !miss.includes(k)).map((k, i) => ({ text: OV.word(k), sp, gap: i ? 0.6 : 0 })));
    return { measured, box, pts, miss };
  }
  OVS.vmap = vmap;

  /* ---------- 잰 모음 길이 (vd ms) — 직접 해 보기 · 퀴즈에서 씀 ---------- */
  const vdOf = (k, sp = 'tc') => { const m = V.meas(sp, OV.word(k)); return m && m.vd ? m.vd : null; };
  OVS.vdOf = vdOf;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호는 자막에 쓰지 않음
     영어 낱말 바로 뒤에 조사를 붙이지 않아요(소리 내어 읽을 때 어색해서) — → 나 = 로 이어요.
     IPA 기호(æ · ɛ · ɑ · ʌ)는 자막에 쓰지 않고 ‘크게 벌린 애 · 덜 벌린 에 · 크게 벌린 아 · 덜 벌린 어’로 적어요(화면에는 기호를 함께).
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '입을 얼마나 벌리나 — æ · ɛ · ʌ · ɑ', d: 36, caps: [
      [0.4, 6, '나쁘다와 침대를 영어로 말해 보세요. 한국어로 적으면 배드 · 베드 → 글자는 달라도 요즘은 같게 말하는 사람이 많아요.'],
      [6, 12, '영어 bad → 크게 벌린 애, bed → 덜 벌린 에예요. 턱을 얼마나 내리느냐로 뜻이 갈려요.'],
      [12, 18, '한국어의 애와 에는 요즘 많은 사람이 한 소리로 말해요. 그래서 영어의 두 소리를 모두 한국어 에로 내기 쉬워요.'],
      [18, 24, '뒤쪽에도 짝이 있어요. cop → 크게 벌린 아, cup → 덜 벌린 어. 한국어 아 · 어와 비슷하지만 똑같지는 않아요.'],
      [24, 30, '세 단계로 익혀요. 두 소리를 듣고 가르고, 턱과 혀의 모양을 만들고, 낱말과 문장 속에서 써요.'],
      [30, 36, '미국 표준 발음을 기준으로 해요. 소리는 모두 합성 음성이에요.'],
    ] },
    { id: 'listen', n: '01', title: '들어 보기 · 구별되나요?', sub: '① 듣고 가르기 · 모음 하나만 다른 짝 · 목소리 넷', d: 40, caps: [
      [0.4, 6, '먼저 귀부터 시험해요. 짝 낱말을 눌러 들어 보세요. 모음 하나만 달라요.'],
      [6, 12, 'bad · bed, sad · said, cop · cup. 어느 쪽이 입을 더 크게 벌린 소리로 들리나요?'],
      [12, 18, '왼쪽이 크게 벌린 모음, 오른쪽이 덜 벌린 모음이에요. 크게 벌린 쪽이 더 낮고 넓게 들려요.'],
      [18, 25, '작은 지도의 두 점은 이 목소리의 모음을 재서 찍은 거예요. 짝마다 두 점이 떨어져 있어요.'],
      [25, 32, '한국어식으로는 배드 · 베드, 새드 · 세드 → 글자는 달라도 소리는 거의 같아요. 캅 · 컵은 아 · 어로 갈려요.'],
      [32, 40, '여러 목소리로 듣고 가르는 연습이 도움이 돼요. 아래 놀이터의 **듣고 가르기 훈련**이 그 연습이에요.'],
    ] },
    { id: 'map', n: '02', title: '모음 지도 · 한국어 에는 하나', sub: '① 듣고 가르기 · 혀의 높이와 앞뒤 · 턱을 내리면 아래로', d: 40, caps: [
      [0.4, 6, '모음은 혀의 높이와 앞뒤로 정해져요. 턱을 내리면 혀도 함께 내려가요.'],
      [6, 12, '지도의 아래쪽이 입을 크게 벌린 소리예요. 왼쪽은 혀 앞, 오른쪽은 혀 뒤예요.'],
      [12, 18, '한국어 에는 왼쪽 가운데쯤, 아는 아래 가운데, 어는 오른쪽 가운데쯤에 있어요.'],
      [18, 25, '영어의 크게 벌린 애는 에보다 훨씬 아래예요. 크게 벌린 아는 한국어 아보다 뒤, 덜 벌린 어는 가운데쯤이에요.'],
      [25, 32, '오른쪽은 실제로 잰 지도예요. bat · bet · but · bot → 이 목소리의 네 모음을 재서 찍었어요.'],
      [32, 40, 'bad → 한국어 에 하나로 말하면, 듣는 사람에게는 bed 쪽으로 들리기 쉬워요.'],
    ] },
    { id: 'front', n: '03', title: '크게 벌린 애 · 덜 벌린 에', sub: '② 입 모양 만들기 · ɛ는 조금, æ는 턱을 크게', d: 44, caps: [
      [0.4, 6, '이제 입을 만들어요. 덜 벌린 에는 한국어 에와 비슷해요. 턱을 조금만 내려요.'],
      [6, 12, 'bed · said · pet. 혀 앞이 가운데 높이에 있어요.'],
      [12, 18, '크게 벌린 애는 턱을 훨씬 크게 내리고, 입꼬리를 옆으로 당겨요. 혀도 함께 낮아져요.'],
      [18, 24, '에를 말하다가 턱을 손가락 하나만큼 더 내려 보세요. bad · sad · pat.'],
      [24, 30, '점선이 덜 벌린 에의 혀예요. 크게 벌린 애의 혀는 그보다 꽤 아래에 있어요.'],
      [30, 37, '한국어 애로는 부족해요. 요즘 한국어 애는 에와 같은 소리라, 턱이 거의 내려가지 않아요.'],
      [37, 44, '요령 → 거울을 보며 턱이 내려가는지 확인해요. 크게 벌린 애는 조금 길게 끌어도 괜찮아요.'],
    ] },
    { id: 'back', n: '04', title: '크게 벌린 아 · 덜 벌린 어', sub: '② 입 모양 만들기 · ʌ는 힘을 빼고, ɑ는 크게', d: 44, caps: [
      [0.4, 6, '뒤쪽 짝이에요. 덜 벌린 어는 턱을 조금만 내리고, 혀를 가운데에 편하게 둬요.'],
      [6, 12, 'cup · luck · but. 입술을 둥글리지 않고 짧고 가볍게 내요.'],
      [12, 18, '크게 벌린 아는 턱을 크게 내리고, 혀를 낮게 뒤로 당겨요. cop · lock · hot.'],
      [18, 24, '병원에서 목 안을 보여 줄 때 하는 아를 떠올려 보세요. 한국어 아보다 조금 더 뒤에서 나요.'],
      [24, 30, '점선이 덜 벌린 어의 혀예요. 크게 벌린 아의 혀는 그보다 아래, 뒤에 있어요.'],
      [30, 37, '덜 벌린 어 → 한국어 어보다 턱을 조금 더 내리고, 입술은 둥글리지 않아요.'],
      [37, 44, '요령 → 덜 벌린 어는 짧게, 크게 벌린 아는 넉넉하게. 길이도 함께 달라요.'],
    ] },
    { id: 'tri', n: '05', title: '셋이 갈리는 줄', sub: '① 듣고 가르기 · cat · cut · cot · 자음은 같고 모음만 달라요', d: 44, caps: [
      [0.4, 6, '이번에는 셋을 한꺼번에 들어 봐요. 자음은 같고 모음만 달라요.'],
      [6, 12, 'cat · cut · cot → 크게 벌린 애, 덜 벌린 어, 크게 벌린 아예요.'],
      [12, 18, 'hat · hut · hot, cap · cup · cop. 셋의 뜻이 모두 달라요.'],
      [18, 25, '오른쪽 지도에 세 모음을 찍었어요. 애는 앞쪽, 아는 뒤쪽, 어는 그 사이예요.'],
      [25, 32, '입으로는 이렇게 기억해요. 어는 턱을 조금, 애와 아는 턱을 크게. 애는 혀를 앞으로, 아는 뒤로.'],
      [32, 38, '같은 자음 사이에서 모음만 바꿔 말해 보세요. 턱이 내려가고 혀가 앞뒤로 움직이는 게 느껴지나요?'],
      [38, 44, '요령 → 어에서 시작해 턱을 내리면서 혀를 앞으로 보내면 애, 뒤로 보내면 아예요.'],
    ] },
    { id: 'voices', n: '06', title: '목소리마다 지도는 달라요', sub: '③ 내 모음 보기 · 자리는 달라도 차례는 같아요', d: 40, caps: [
      [0.4, 6, '목소리마다 모음 지도의 자리는 달라요. 목의 길이와 입의 크기가 사람마다 다르니까요.'],
      [6, 12, '그래도 차례는 같아요. 크게 벌린 애는 덜 벌린 에보다 아래, 크게 벌린 아는 덜 벌린 어보다 아래나 뒤예요.'],
      [12, 18, '그래서 내 모음을 볼 때도, 남의 점과 견주기보다 내 두 점이 서로 떨어져 있는지를 봐요.'],
      [18, 25, '아래 놀이터의 **내 모음 찍기** → 짝 낱말 둘을 녹음하면 내 두 모음의 자리를 찍어 줘요. 시험 기능이에요.'],
      [25, 32, '자동으로 잰 값이라 어림이에요. 마이크와 방의 소리, 목소리에 따라 점이 흔들릴 수 있어요.'],
      [32, 40, '두 점이 거의 겹치면, 크게 벌린 쪽에서 턱을 더 내려 보세요.'],
    ] },
    { id: 'loan', n: '07', title: '외래어 함정', sub: '③ 낱말 속에서 · 한글 표기의 모음을 믿지 마세요', d: 44, caps: [
      [0.4, 6, '외래어는 한글 표기의 모음이 영어 모음과 어긋날 때가 많아요. 칠한 글자가 센 음절의 모음이에요.'],
      [6, 12, '크게 벌린 애 → apple · taxi · camera · banana. 카메라와 바나나는 한글로 아라고 적지만 영어는 애예요.'],
      [12, 18, '덜 벌린 에 → menu · dress · lemon · ketchup. 이쪽은 한국어 에와 가까워요.'],
      [18, 24, '크게 벌린 아 → doctor · box · shopping · chocolate. 쇼핑과 초콜릿은 오로 적지만 영어는 크게 벌린 아예요.'],
      [24, 31, '덜 벌린 어 → bus · money · mother · oven. 마더는 아, 오븐은 오로 적지만 영어는 덜 벌린 어예요.'],
      [31, 37, '주황 테두리를 두른 카드가 한글 표기와 영어 모음이 어긋난 낱말이에요.'],
      [37, 44, '흔한 외래어부터 바꿔 보세요. 쇼핑과 초콜릿은 크게 벌린 아, 오븐은 덜 벌린 어예요.'],
    ] },
    { id: 'sentence', n: '08', title: '문장 속에서', sub: '③ 문장 속에서 · 짧은 낱말에도 네 모음이 있어요', d: 44, caps: [
      [0.4, 6, '문장 속에서도 네 모음이 자주 나와요. 노란 글자는 크게 벌린 모음, 하늘색 글자는 덜 벌린 모음이에요.'],
      [6, 12, 'I had a bad headache. had · bad → 크게 벌린 애, headache → 덜 벌린 에예요.'],
      [12, 18, 'The cup is hot. cup → 덜 벌린 어, hot → 크게 벌린 아예요.'],
      [18, 24, 'Set the bag on the bed. bag → 턱을 크게, set · bed → 조금만.'],
      [24, 30, 'Dad cut the hot bread. 한 문장에 네 모음이 모두 있어요.'],
      [30, 37, '짧은 낱말도 조심해요. has · that → 크게 벌린 애, but · what · come → 덜 벌린 어예요.'],
      [37, 44, '아래 **따라 말하기**에 문장 스물여덟 개가 있어요. 묶음마다 일곱 문장이에요.'],
    ] },
    { id: 'summary', n: '09', title: '정리', sub: '3단계 발음법 · 턱을 얼마나 내리나', d: 36, caps: [
      [0.4, 6, '정리해요. ① 듣고 가르기 → 턱이 얼마나 내려갔나. 크게 벌린 소리는 낮고 넓게 들려요.'],
      [6, 12, '② 만들기 → 애는 에보다 턱을 크게 내리고 입꼬리를 당겨요. 아는 크게 벌려 뒤로, 어는 힘을 빼고 짧게.'],
      [12, 18, '③ 낱말 · 문장 속에서 → 외래어의 애 · 아 · 오 · 어 표기를 믿지 말고 사전에서 확인해요.'],
      [18, 24, 'man · can → 콧소리 m · n 앞의 애는 많은 미국 사람이 조금 높여 말해요. 그래서 이 영상의 짝에서는 뺐어요.'],
      [24, 30, '목표는 원어민과 똑같은 소리가 아니라, 듣는 사람이 낱말을 쉽게 알아듣는 소리예요.'],
      [30, 36, '아래 **듣고 가르기 훈련**과 **내 모음 찍기**에서 직접 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  OVS.CHAPTERS = CHAPTERS; OVS.CAPTIONS = CAPTIONS; OVS.END = END;
  OVS.POSTER = CHAPTERS.find(c => c.id === 'listen').t + 21;
  OVS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  OVS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

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
      (items || [['크게 벌린 모음 æ · ɑ', COL.open], ['덜 벌린 모음 ɛ · ʌ', COL.less]]).forEach(([s, c]) => { const r = tag(g, s, x, 92, c, { align: 'right', size: 15, h: 30 }); x = r.x - 10; });
    });
  }

  // 01장 짝 · 03 · 04장 낱말 · 08장 문장
  OVS.LISTEN_PAIRS = ['bad-bed', 'sad-said', 'cop-cup'];
  OVS.FRONT_WORDS = { 'ɛ': ['bed', 'said', 'pet'], 'æ': ['bad', 'sad', 'pat'] };
  OVS.BACK_WORDS = { 'ʌ': ['cup', 'luck', 'but'], 'ɑ': ['cop', 'lock', 'hot'] };
  const SROWS = [
    { en: 'I had a bad headache.', at: 6 },
    { en: 'The cup is hot.', at: 12 },
    { en: 'Set the bag on the bed.', at: 18 },
    { en: 'Dad cut the hot bread.', at: 24 },
  ];
  OVS.SROWS = SROWS;
  const pairById = id => OV.PAIRS.find(p => p.id === id);
  OVS.pairById = pairById;

  // 입 둘 견주기: 왼쪽 덜 벌린(먼저) · 오른쪽 크게 벌린 (front: 앞 모음)
  function mouthPair(g, u, front, idle) {
    const L = front ? 'ɛ' : 'ʌ', O = front ? 'æ' : 'ɑ', words = front ? OVS.FRONT_WORDS : OVS.BACK_WORDS;
    const sel = front ? S.fword : S.bword, sv = sel ? OV.vowel(sel) : null;
    const lab = front ? ['palate', 'tip'] : ['velum', 'back'];
    [[L, 70, 0.4], [O, 650, 12]].forEach(([v, x, at]) => fade(g, sel ? (sv === v ? 1 : 0.35) : ramp(u, at, 0.5), () => {
      const c = vcol(v), ms = 0.66, my = 138;
      panel(g, x - 10, my - 8, 570, 440, { fill: COL.panel, stroke: sv === v ? COL.accent : COL.faint });
      mouth(g, x, my, ms, POSE[v], { mark: c, labels: lab, voice: idle || u });
      if (!sel && u >= 24 && v === O) fade(g, ramp(u, 24, 0.5), () => ghost(g, x, my, ms, POSE[L], COL.less));
      peak(g, x, my, ms, POSE[v], front, c);
      // 입술 앞모습 + 턱 벌림 막대
      M.lips(g, x + 300, my + 10, 0.9, POSE[v]);
      txt(g, '입술 앞모습', x + 390, my + 150, { size: 13, weight: 600, color: COL.muted, align: 'center' });
      tag(g, `${v} · ${OV.V[v].ko}`, x + 390, my + 190, c, { align: 'center', size: 18, h: 38, fam: FM });
      const tip = OV.V[v].tip.split(' — ');
      txt(g, tip[0], x + 390, my + 236, { size: fit(g, tip[0], 15, 240, 600), weight: 600, color: COL.soft, align: 'center' });
      if (tip[1]) txt(g, tip[1], x + 390, my + 262, { size: fit(g, tip[1], 15, 240, 800), weight: 800, color: c, align: 'center' });
      const ws = sel && sv === v ? [sel] : words[v];
      ws.forEach((k, i) => word(g, k, x + 100 + i * 170 - (ws.length === 1 ? -170 : 0), my + 346, 26, { align: 'center' }));
      txt(g, ws.map(k => OV.ipa(k)).join('  '), x + 270, my + 384, { size: 14, fam: FM, color: COL.muted, align: 'center' });
    }));
  }

  // 한국어식 표기: 센 음절 글자에 밑줄, 함정이면 주황 테두리
  function koCard(g, k, x, y, size, o = {}) {
    const segs = OV.koSegs(k), wt = o.weight || 700;
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
  OVS.koCard = koCard;

  const SCENES = {
    /* 00 들어가며 */
    intro(g, u) {
      const A = 1 - ramp(u, 23.6, 0.5);
      fade(g, A * ramp(u, 0.4, 0.6), () => {
        panel(g, 100, 150, 500, 330, { fill: COL.panel, stroke: COL.faint });
        txt(g, '한국어식', 130, 180, { size: 15, weight: 700, color: COL.muted });
        txt(g, '나쁜', 260, 240, { size: 22, weight: 700, color: COL.soft, align: 'center' });
        txt(g, '침대', 440, 240, { size: 22, weight: 700, color: COL.soft, align: 'center' });
        koWord(g, 'bad', 260, 310, 54, { align: 'center' });
        koWord(g, 'bed', 440, 310, 54, { align: 'center' });
        txt(g, '=', 350, 310, { size: 40, weight: 700, color: COL.trap, align: 'center' });
        txt(g, '요즘은 애 · 에를 한 소리로 → 귀로는 거의 같아요', 350, 420, { size: 18, weight: 700, color: COL.trap, align: 'center' });
      });
      fade(g, A * ramp(u, 6, 0.6), () => {
        panel(g, 680, 150, 500, 330, { fill: COL.panel, stroke: COL.faint });
        txt(g, '영어', 710, 180, { size: 15, weight: 700, color: COL.muted });
        word(g, 'bad', 820, 250, 50, { align: 'center' });
        word(g, 'bed', 1040, 250, 50, { align: 'center' });
        txt(g, OV.ipa('bad'), 820, 300, { size: 18, fam: FM, color: COL.muted, align: 'center' });
        txt(g, OV.ipa('bed'), 1040, 300, { size: 18, fam: FM, color: COL.muted, align: 'center' });
        txt(g, `${gloss('bad')} · ${OV.V['æ'].ko}`, 820, 340, { size: 16, weight: 700, color: COL.open, align: 'center' });
        txt(g, `${gloss('bed')} · ${OV.V['ɛ'].ko}`, 1040, 340, { size: 16, weight: 700, color: COL.less, align: 'center' });
        txt(g, '≠', 930, 250, { size: 40, weight: 700, color: COL.muted, align: 'center' });
        txt(g, '턱을 얼마나 내리나로 뜻이 갈려요', 930, 420, { size: 18, weight: 700, color: COL.soft, align: 'center' });
      });
      fade(g, A * win(u, 12, 18.2), () => chip(g, '한국어 애 · 에 → 한 소리 · 영어 æ · ɛ → 두 소리', 640, 530, { size: 18, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 40 }));
      fade(g, A * win(u, 18, 23.8), () => {
        panel(g, 240, 500, 800, 66, { fill: COL.panel2, stroke: COL.accent });
        txt(g, '뒤쪽 짝', 320, 533, { size: 18, weight: 700, color: COL.muted, align: 'center' });
        word(g, 'cop', 450, 533, 30, { align: 'center' });
        txt(g, '·', 510, 533, { size: 24, color: COL.muted, align: 'center' });
        word(g, 'cup', 570, 533, 30, { align: 'center' });
        txt(g, '=', 650, 533, { size: 24, color: COL.muted, align: 'center' });
        koWord(g, 'cop', 720, 533, 26, { align: 'center' });
        txt(g, '·', 770, 533, { size: 24, color: COL.muted, align: 'center' });
        koWord(g, 'cup', 820, 533, 26, { align: 'center' });
        txt(g, '아 · 어와 비슷', 940, 533, { size: 16, weight: 700, color: COL.soft, align: 'center' });
      });
      const steps = [['ear', '① 듣고 가르기', '턱이 얼마나 내려갔나'], ['mouth', '② 입 모양 만들기', '턱 내리기 · 혀 앞뒤'], ['text', '③ 낱말 · 문장 속에서', '외래어 · 짧은 낱말 · 문장']];
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
      const ids = S.pair ? [S.pair] : OVS.LISTEN_PAIRS, sp = S.voice || 'tc';
      ids.forEach((id, i) => fade(g, S.pair ? 1 : ramp(u, 0.6 + i * 0.4, 0.5), () => {
        const p = pairById(id), one = !!S.pair;
        const y = one ? 180 : 150 + i * 132, h = one ? 300 : 118;
        panel(g, 80, y, 1120, h, { fill: COL.panel, stroke: COL.faint });
        const wy = y + (one ? 90 : 46), sz = one ? 58 : 40;
        word(g, p.a, 250, wy, sz, { align: 'center', sp });
        word(g, p.b, 560, wy, sz, { align: 'center', sp });
        txt(g, '·', 405, wy, { size: 30, color: COL.muted, align: 'center' });
        txt(g, `${OV.ipa(p.a)} ${gloss(p.a)}`, 250, wy + (one ? 60 : 44), { size: 15, fam: FM, color: COL.muted, align: 'center' });
        txt(g, `${OV.ipa(p.b)} ${gloss(p.b)}`, 560, wy + (one ? 60 : 44), { size: 15, fam: FM, color: COL.muted, align: 'center' });
        fade(g, one ? 1 : ramp(u, 12 + i * 0.3, 0.5), () => {
          txt(g, OV.V[OV.vowel(p.a)].ko, 250, y + h - 14, { size: 14, weight: 800, color: COL.open, align: 'center' });
          txt(g, OV.V[OV.vowel(p.b)].ko, 560, y + h - 14, { size: 14, weight: 800, color: COL.less, align: 'center' });
        });
        // 작은 지도
        fade(g, one ? 1 : ramp(u, 18 + i * 0.4, 0.5), () => {
          const mw = one ? 300 : 200, mh = one ? 190 : 78;
          vmap(g, 720, y + (one ? 40 : 22), mw, mh, [p.a, p.b], sp, { axSize: 11, r: one ? 9 : 7, ls: one ? 15 : 13, noteDy: one ? 0 : -12, arrows: true });
        });
        // 한국어식: 앞 짝은 글자는 달라도 = (한 소리), 뒤 짝은 아 · 어로 갈림
        fade(g, one ? 1 : ramp(u, 25 + i * 0.3, 0.5), () => {
          const kx = one ? 1110 : 1100, ks = one ? 30 : 22, same = OV.koSameSound(p.a, p.b);
          txt(g, same ? '한국어식 · 한 소리' : '한국어식 · 아 · 어', kx, wy - 22, { size: 12, weight: 700, color: COL.muted, align: 'center' });
          koWord(g, p.a, kx - 44, wy + 12, ks, { align: 'center' });
          txt(g, same ? '=' : '·', kx, wy + 12, { size: ks, weight: 700, color: same ? COL.trap : COL.muted, align: 'center' });
          koWord(g, p.b, kx + 44, wy + 12, ks, { align: 'center' });
        });
      }));
      fade(g, ramp(u, 32.4, 0.5) * (S.pair ? 0 : 1), () => {
        OV.VOICES.forEach((v, i) => {
          const x = 250 + i * 260, hl = S.voice === v.sp;
          const c = chip(g, v.ko, x, 566, { size: 15, fill: COL.panel2, stroke: hl ? COL.accent : COL.line, align: 'center', pad: 30, h: 30 });
          icon(g, 'spk', c.x + 16, 566, 16, COL.accent);
          listen(c.x, c.y, c.w, c.h, [{ text: 'bad', sp: v.sp }, { text: 'bed', sp: v.sp, gap: 0.7 }]);
        });
      });
    },

    /* 02 모음 지도 · 한국어 에는 하나 */
    map(g, u) {
      legend(g, ramp(u, 12, 0.5), [['영어 크게', COL.open], ['영어 덜', COL.less], ['한국어 (그림)', COL.ko]]);
      // 왼쪽: 그림 지도
      fade(g, ramp(u, 0.4, 0.5), () => {
        const x = 170, y = 180, w = 400, h = 300;
        mapBase(g, x, y, w, h, { long: true, axSize: 15, foot: 10 });
        txt(g, '그림 지도(단순하게)', x + w / 2, y + h + 26, { size: 13, weight: 600, color: COL.dim, align: 'center' });
        fade(g, win(u, 6, 12.2), () => {
          arrow(g, x + w / 2, y + 60, x + w / 2, y + h - 40, COL.line, 2);
          txt(g, '턱을 내리면 → 아래로', x + w / 2 + 14, y + h / 2, { size: 15, weight: 700, color: COL.soft });
          txt(g, '혀 앞', x + 24, y + 30, { size: 15, weight: 700, color: COL.soft });
          txt(g, '혀 뒤', x + w - 24, y + 30, { size: 15, weight: 700, color: COL.soft, align: 'right' });
        });
        const box = { x, y, w, h, R: null };
        fade(g, ramp(u, 12, 0.5), () => {
          Object.keys(OV.KO_SCHEM).forEach(k => { const [X, Y] = mapXY(box, null, k); dot(g, X, Y, k, `한국어 ${k}`, { color: COL.ko, ko: true, r: 16, fam: FB, ls: 15, ly: k === '아' ? 34 : -30 }); });
        });
        fade(g, ramp(u, 18, 0.5), () => {
          OV.ORDER.forEach(v => { const [X, Y] = mapXY(box, null, v); dot(g, X, Y, v, v, { r: 9, lx: v === 'ɛ' || v === 'æ' ? -24 : 24, ly: 0 }); });
          [['ɛ', 'æ'], ['ʌ', 'ɑ']].forEach(([a, b]) => { const [X0, Y0] = mapXY(box, null, a), [X1, Y1] = mapXY(box, null, b); arrow(g, X0, Y0 + 10, X1, Y1 - 10, COL.line, 2, [5, 4], 9); });
        });
      });
      // 오른쪽: 잰 지도(b_t 넷)
      fade(g, ramp(u, 25, 0.5), () => {
        const sp = S.mapVoice || 'tc';
        txt(g, 'bat · bet · but · bot', 900, 170, { size: 18, weight: 700, color: COL.soft, align: 'center' });
        vmap(g, 720, 200, 360, 270, HVD, sp, { labels: 'word', ls: 15, arrows: true, axSize: 14, partial: true });
      });
      fade(g, ramp(u, 32, 0.5), () => {
        panel(g, 160, 520, 960, 56, { fill: COL.panel2, stroke: COL.ko });
        word(g, 'bad', 300, 548, 26, { align: 'center' });
        txt(g, '→ 한국어 에 하나로 말하면 →', 520, 548, { size: 18, weight: 700, color: COL.ko, align: 'center' });
        word(g, 'bed', 740, 548, 26, { align: 'center' });
        txt(g, '쪽으로 들리기 쉬워요', 900, 548, { size: 18, weight: 700, color: COL.soft, align: 'center' });
      });
    },

    /* 03 크게 벌린 애 · 덜 벌린 에 */
    front(g, u, t, idle = 0) {
      mouthPair(g, u, true, idle);
      const sel = S.fword;
      fade(g, win(u, 18, 24.2) * (sel ? 0 : 1), () => chip(g, '에 → 턱을 손가락 하나만큼 더 → 애', 930, 120, { size: 16, color: COL.open, fill: COL.panel2, stroke: COL.open, align: 'center', h: 34 }));
      fade(g, win(u, 30, 37.2) * (sel ? 0 : 1), () => chip(g, '한국어 애 = 에 → 턱이 거의 그대로', 930, 120, { size: 17, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'center', h: 34 }));
      fade(g, ramp(u, 37, 0.5) * (sel ? 0 : 1), () => chip(g, '요령 → 거울로 턱 확인 · 애는 조금 길게', 930, 120, { size: 16, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 04 크게 벌린 아 · 덜 벌린 어 */
    back(g, u, t, idle = 0) {
      mouthPair(g, u, false, idle);
      const sel = S.bword;
      fade(g, win(u, 18, 24.2) * (sel ? 0 : 1), () => chip(g, '목 안을 보여 주듯 아 · 한국어 아보다 뒤', 930, 120, { size: 16, color: COL.open, fill: COL.panel2, stroke: COL.open, align: 'center', h: 34 }));
      fade(g, win(u, 30, 37.2) * (sel ? 0 : 1), () => chip(g, '어 → 턱을 조금 더 · 입술은 둥글리지 않기', 930, 120, { size: 16, color: COL.less, fill: COL.panel2, stroke: COL.less, align: 'center', h: 34 }));
      fade(g, ramp(u, 37, 0.5) * (sel ? 0 : 1), () => chip(g, '요령 → 어는 짧게 · 아는 넉넉하게', 930, 120, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 05 셋이 갈리는 줄 */
    tri(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      const sp = S.triVoice || 'tc', one = S.tri != null;
      const rows = one ? [S.tri] : [0, 1, 2, 3, 4];
      rows.forEach((ri, i) => {
        const row = OV.TRI[ri], at = one ? 0 : (i === 0 ? 6 : i < 3 ? 12 + (i - 1) * 0.5 : 13 + (i - 3) * 0.4);
        fade(g, one ? 1 : ramp(u, at, 0.5), () => {
          const y = one ? 230 : 172 + i * 72, sz = one ? 52 : 32, hl = one;
          panel(g, 80, y - 30, 560, 60, { fill: COL.panel, stroke: hl ? COL.accent : COL.faint, r: 12 });
          row.forEach((k, j) => {
            const x = 170 + j * 180;
            word(g, k, x, y - (one ? 4 : 0), sz, { align: 'center', sp });
            if (j) txt(g, '·', x - 90, y, { size: 26, color: COL.muted, align: 'center' });
          });
          if (one) row.forEach((k, j) => {
            txt(g, `${OV.ipa(k)} ${gloss(k)}`, 170 + j * 180, y + 74, { size: 15, fam: FM, color: COL.muted, align: 'center' });
            txt(g, OV.V[OV.vowel(k)].ko, 170 + j * 180, y + 104, { size: 15, weight: 800, color: vcol(OV.vowel(k)), align: 'center' });
          });
        });
      });
      // 이름표 (줄 위)
      fade(g, ramp(u, 6.4, 0.5) * (one ? 0 : 1), () => OV.TRI_V.forEach((v, j) => txt(g, OV.V[v].ko, 170 + j * 180, 128 + 14, { size: 14, weight: 800, color: vcol(v), align: 'center' })));
      // 오른쪽: 잰 지도(그 줄의 세 낱말)
      fade(g, ramp(u, 18, 0.5), () => {
        const row = OV.TRI[S.tri != null ? S.tri : 0];
        txt(g, row.join(' · '), 930, 170, { size: 18, weight: 700, color: COL.soft, align: 'center' });
        vmap(g, 760, 200, 340, 250, row, sp, { labels: 'word', ls: 15, axSize: 14, partial: true });
      });
      fade(g, win(u, 25, 38.2), () => {
        panel(g, 80, 530, 1120, 54, { fill: COL.panel2, stroke: COL.faint });
        [['어', '턱 조금', COL.less], ['애', '턱 크게 · 혀 앞', COL.open], ['아', '턱 크게 · 혀 뒤', COL.open]].forEach(([k, s, c], j) => {
          const x = 260 + j * 370;
          txt(g, k, x - 70, 557, { size: 22, weight: 800, color: c, align: 'center' });
          txt(g, s, x + 10, 557, { size: 17, weight: 700, color: COL.soft, align: 'center' });
        });
      });
      fade(g, ramp(u, 38, 0.5), () => chip(g, '요령 → 어에서 턱을 내리며 혀를 앞으로 = 애 · 뒤로 = 아', 640, 557, { size: 16, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
    },

    /* 06 목소리마다 지도는 달라요 */
    voices(g, u) {
      const big = 1 - ramp(u, 17.6, 0.5);
      OV.VOICES.forEach((v, i) => fade(g, ramp(u, 0.4 + i * 0.4, 0.5) * (big * 0.75 + 0.25), () => {
        const x = 110 + i * 285, y = 200;
        txt(g, v.ko, x + 110, 160, { size: 17, weight: 800, color: S.mapVoice === v.sp ? COL.accent : COL.soft, align: 'center' });
        vmap(g, x, y, 220, 200, HVD, v.sp, { labels: true, ls: 14, r: 8, arrows: u >= 6, axSize: 12, noteText: '잰 값', partial: true });
      }));
      fade(g, win(u, 12, 17.8), () => chip(g, '남의 점과 견주지 말고 · 내 두 점의 거리를 봐요', 640, 520, { size: 18, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 40 }));
      fade(g, ramp(u, 18, 0.5), () => {
        panel(g, 200, 470, 880, 96, { fill: COL.panel2, stroke: COL.accent });
        circ(g, 270, 518, 30, COL.panel); icon(g, 'mic', 270, 518, 30, COL.accent);
        txt(g, '내 모음 찍기 (시험 기능)', 320, 500, { size: 20, weight: 800, color: COL.accent });
        txt(g, u < 25 ? '짝 낱말 둘을 녹음 → 내 두 모음의 자리 · 화살표' : u < 32 ? '자동으로 잰 어림값 · 마이크와 방의 소리에 따라 흔들려요' : '두 점이 겹치면 → 크게 벌린 쪽에서 턱을 더 내려 보기', 320, 538, { size: 16, weight: 600, color: COL.soft });
      });
    },

    /* 07 외래어 함정 */
    loan(g, u) {
      const LAPPEAR = { 'æ': 6, 'ɛ': 12, 'ɑ': 18, 'ʌ': 24 };
      OV.LROWS.forEach((row, ri) => {
        const c = vcol(row.v);
        fade(g, ramp(u, LAPPEAR[row.v] - 0.2, 0.4), () => txt(g, row.ko, 80, 146 + ri * 100, { size: 14, weight: 800, fam: FM, color: c }));
        row.words.forEach((k, ci) => {
          const x = 80 + ci * 285, y = 156 + ri * 100, at = LAPPEAR[row.v] + ci * 0.3, hl = S.loan === k, trap = OV.koTrap(k);
          fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, at, 0.4)), () => panel(g, x, y, 265, 82, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }));
          fade(g, S.loan ? (hl ? 1 : 0.55) : ramp(u, at, 0.5), () => {
            const tr = trap && (S.loan || u >= 31);
            panel(g, x, y, 265, 82, { fill: COL.panel, stroke: hl ? COL.accent : tr ? COL.trap : COL.faint, lw: hl || tr ? 2.5 : 1.5 });
            koCard(g, k, x + 16, y + 28, fit(g, OV.entry(k).ko, 22, 100, 700));
            word(g, k, x + 249, y + 28, fit(g, k, 24, 140, 700), { align: 'right' });
            txt(g, OV.ipa(k), x + 249, y + 62, { size: 14, fam: FM, color: COL.muted, align: 'right' });
            txt(g, trap ? `한글 ${trap} → ${OV.V[row.v].kr}` : `한글 ${OV.koFam(k)}`, x + 16, y + 62, { size: 14, weight: 800, color: trap ? COL.trap : c });
          });
        });
      });
      fade(g, ramp(u, 37, 0.5) * (S.loan ? 0 : 1), () => chip(g, '쇼핑 · 초콜릿 → 크게 벌린 아 · 오븐 → 덜 벌린 어', 640, 562, { size: 15, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 30 }));
    },

    /* 08 문장 속에서 */
    sentence(g, u) {
      legend(g, ramp(u, 0.4, 0.5));
      if (S.sent != null) {
        const s = OV.SENT[S.sent];
        tag(g, OV.SGRP[s.grp].ko, 640, 220, COL.muted, { align: 'center', size: 16, h: 32 });
        sentence(g, s.en, 640, 310, 46, { align: 'center', maxW: 1100 });
        txt(g, s.ko, 640, 390, { size: 20, weight: 600, color: COL.soft, align: 'center' });
        const n = OV.countIn(s.en);
        txt(g, `크게 벌린 모음 ${n['æ'] + n['ɑ']} · 덜 벌린 모음 ${n['ɛ'] + n['ʌ']}`, 640, 450, { size: 18, weight: 700, color: COL.muted, align: 'center' });
        return;
      }
      fade(g, win(u, 0.4, 6.2), () => {
        ['had', 'bed', 'hot', 'cup'].forEach((k, i) => {
          const x = 250 + i * 260;
          word(g, k, x, 310, 50, { align: 'center' });
          txt(g, OV.V[OV.vowel(k)].ko, x, 380, { size: 18, weight: 800, color: vcol(OV.vowel(k)), align: 'center' });
        });
      });
      SROWS.forEach((s, i) => fade(g, ramp(u, s.at, 0.5), () => {
        const y = 182 + i * 92;
        sentence(g, s.en, 120, y, 36, { maxW: 760 });
        const n = OV.countIn(s.en);
        txt(g, `크게 ${n['æ'] + n['ɑ']}`, 1080, y, { size: 17, weight: 800, color: COL.open, align: 'right' });
        txt(g, `덜 ${n['ɛ'] + n['ʌ']}`, 1200, y, { size: 17, weight: 800, color: COL.less, align: 'right' });
      }));
      fade(g, ramp(u, 30, 0.5), () => {
        panel(g, 120, 530, 1040, 52, { fill: COL.panel2, stroke: COL.accent });
        ['has', 'that'].forEach((k, i) => word(g, k, 220 + i * 110, 556, 24, { align: 'center' }));
        txt(g, '→ 크게 벌린 애', 450, 556, { size: 17, weight: 700, color: COL.open, align: 'center' });
        ['but', 'what', 'come'].forEach((k, i) => word(g, k, 640 + i * 110, 556, 24, { align: 'center' }));
        txt(g, '→ 덜 벌린 어', 1000, 556, { size: 17, weight: 700, color: COL.less, align: 'center' });
      });
    },

    /* 09 정리 */
    summary(g, u) {
      const X = [80, 360, 790], Y0 = 145;
      fade(g, ramp(u, 0.3, 0.5), () => {
        panel(g, 60, Y0, 1160, 330, { fill: COL.panel, stroke: COL.faint });
        circ(g, X[1] + 22, Y0 + 46, 12, hex(COL.open, 0.9));
        circ(g, X[2] + 18, Y0 + 50, 12, hex(COL.less, 0.9));
        txt(g, '크게 벌린 모음 æ · ɑ', X[1] + 46, Y0 + 46, { size: 22, weight: 800, color: COL.open });
        txt(g, '덜 벌린 모음 ɛ · ʌ', X[2] + 42, Y0 + 50, { size: 22, weight: 800, color: COL.less });
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + 98, 1120, 1);
      });
      const rows = [
        ['① 듣고 가르기', '낮고 넓게 · bad · cop', '가운데 높이 · bed · cup', 0.4],
        ['② 만들기', '턱을 크게 · 애는 입꼬리 · 아는 혀 뒤로', '턱을 조금 · 어는 힘 빼고 짧게', 6],
        ['③ 낱말 속에서', '카메라 · 바나나 · 쇼핑 · 초콜릿', '메뉴 · 레몬 · 마더 · 오븐 · but', 12],
      ];
      rows.forEach(([h, a, b, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = Y0 + 140 + i * 66;
        txt(g, h, X[0] + 16, y, { size: 19, weight: 800, color: COL.text });
        txt(g, a, X[1] + 4, y, { size: fit(g, a, 18, 410, 600), weight: 600, color: COL.open });
        txt(g, b, X[2] + 4, y, { size: fit(g, b, 18, 410, 600), weight: 600, color: COL.less });
      }));
      fade(g, ramp(u, 18, 0.5), () => {
        [['bad', 'bed'], ['cop', 'cup'], ['sad', 'said']].forEach(([a, b], i) => {
          const x = 240 + i * 400;
          word(g, a, x - 12, 515, 22, { align: 'right' }); txt(g, '·', x, 515, { size: 20, color: COL.muted, align: 'center' }); word(g, b, x + 12, 515, 22);
        });
      });
      fade(g, ramp(u, 24, 0.5), () => txt(g, '목표 = 듣는 사람이 낱말을 쉽게 알아듣는 소리', 640, 565, { size: 17, weight: 700, color: COL.soft, align: 'center' }));
    },
  };
  OVS.SCENES = SCENES;

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

  OVS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[OVS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t, opt.idle || 0);
    g.restore();
    if (opt.caption) drawCaption(g, OVS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + OV.allText() + MLAB.join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔⇢≈≠✓×?!~=+-–—/:…‘’\'%&<>|ɹɝɚəæɑɔɪʊʌɛŋθðʃʒˈˌːms';
  OVS.baseText = EXTRA;
  OVS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = OVS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { OVS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
