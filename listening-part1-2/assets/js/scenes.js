/* 듣기 ① 사진과 질의응답 — 영상 장면
 *
 * LPS.render(g, t)는 시각 t와 사용자 상태 LPS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * MP4에는 소리를 넣을 수 없어서, 들리는 영어는 ‘말하는 사람 · 소리 물결 · 낱말이 하나씩 나타나는 받아쓰기’로 그립니다.
 * 페이지에서는 그 줄을 누르면 voices.js가 말하는 사람의 목소리로 읽어 줘요(HITS의 play).
 *
 * 역할 색: 주인공(사진 속 사람 · 사물) 하늘 · 첫 단어와 동작(지금 하는 중) 노랑 · 상태(이미 된 것)와 돌려 말한 정답 민트
 *          답의 종류 · 물건 보라 · 사진에 없는 것 분홍 점선 · 함정(같은 단어 · 비슷한 소리) 주황
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(LP.judge1 · LP.judge2)으로 정합니다.
 */
(function () {
  'use strict';
  const LP = window.LP;
  const LPS = (window.LPS = {});
  const W = 1280, H = 720;
  LPS.W = W; LPS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  LPS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  LPS.COL = COL;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (LPS.S = { jk: null, ch: null, wh: null, yn: null, first: null });
  LPS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  LPS.hits = () => HITS;

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
  const fit = (g, s, size, maxW, weight = 600, min = 11) => { while (size > min && tw(g, s, size, weight) > maxW) size--; return size; };
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
  function check(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x - s * 0.12, y + s * 0.4); g.lineTo(x + s * 0.55, y - s * 0.45); g.stroke();
  }
  function cross(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - s / 2, y - s / 2); g.lineTo(x + s / 2, y + s / 2); g.moveTo(x + s / 2, y - s / 2); g.lineTo(x - s / 2, y + s / 2); g.stroke();
  }
  function mark(g, ok, x, y, s = 16) { (ok ? check : cross)(g, x, y, s, ok ? COL.good : COL.bad); }
  function chip(g, s, x, y, o = {}) {
    const size = o.size || 18, w = tw(g, s, size, o.weight || 600, o.fam || FB) + (o.pad || 14) * 2, h = o.h || size * 2;
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    rr(g, x0, y - h / 2, w, h, o.r || h / 2);
    g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
    txt(g, s, x0 + w / 2, y + 1, { size, weight: o.weight || 600, color: o.color || COL.text, align: 'center', fam: o.fam });
    return { x: x0, y: y - h / 2, w, h };
  }
  const tag = (g, s, x, y, color, o = {}) => chip(g, s, x, y, Object.assign({ size: 17, weight: 700, color, fill: COL.panel2, stroke: color, h: 36, r: 10 }, o));
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
  }
  const say = (x, y, w, h, text) => HITS.push({ x, y, w, h, say: text });
  const listen = (x, y, w, h, seq) => HITS.push({ x, y, w, h, play: seq });
  function pieces(g, parts, x, y, size, o = {}) {
    let w = 0; parts.forEach(([t, , , wt]) => { w += tw(g, t, size, wt || o.weight || 600); });
    let xx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    const x0 = xx;
    parts.forEach(([t, c, ul, wt]) => {
      const ww = txt(g, t, xx, y, { size, weight: wt || o.weight || 600, color: c || COL.text });
      if (ul === 's') { g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(xx - 2, y + 2); g.lineTo(xx + ww + 2, y + 2); g.stroke(); }
      else if (ul) { g.fillStyle = c; g.fillRect(xx, y + size * 0.56, ww, 3); }
      xx += ww;
    });
    if (o.say) say(x0 - 6, y - size * 0.8, w + 12, size * 1.6, o.say);
    if (o.play) listen(x0 - 6, y - size * 0.8, w + 12, size * 1.6, o.play);
    return w;
  }

  /* =========================================================
     사진 그림 — 논리 크기 400×300. 사람 · 가구는 단순한 도형으로 (외부 그림 · 이모지 없음)
     ========================================================= */
  const PW = 400, PH = 300, FLOOR = 214;
  const PC = {
    wall: '#E7E3D9', wall2: '#D9D4C7', floor: '#BCA78C', floor2: '#A99377', base: '#9A8C78', frame: '#F6F4EF', glass: '#BBD7EA', glass2: '#D6E8F3',
    wood: '#9C7754', wood2: '#7E5E40', wood3: '#B48C64', metal: '#8794A2', metal2: '#687584', chair: '#3F6283', chair2: '#2C455E',
    box: '#CB9C61', box2: '#B2864D', tape: '#EBD5A9', leaf: '#4F9C5C', leaf2: '#3A7F48', pot: '#C4663F', pot2: '#A5502F',
    copier: '#DADEE3', copier2: '#B9BFC7', panel: '#4E5865', paper: '#FCFCF8', ink: '#272B31', door: '#A87F58', door2: '#8D6846',
    out: 'rgba(30,25,20,0.28)', shadow: 'rgba(40,30,20,0.16)',
  };
  const pline = (g, pts, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
  const box4 = (g, x, y, w, h, fill, r = 2) => { rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill(); g.strokeStyle = PC.out; g.lineWidth = 1; g.stroke(); };
  const circ = (g, x, y, r, fill) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };
  const shadowE = (g, x, y, w) => { g.fillStyle = PC.shadow; g.beginPath(); g.ellipse(x, y, w, w * 0.16, 0, 0, Math.PI * 2); g.fill(); };

  function room(g, o = {}) {
    const gr = g.createLinearGradient(0, 0, 0, FLOOR); gr.addColorStop(0, o.wall2 || PC.wall2); gr.addColorStop(1, o.wall || PC.wall);
    g.fillStyle = gr; g.fillRect(0, 0, PW, FLOOR);
    const fl = g.createLinearGradient(0, FLOOR, 0, PH); fl.addColorStop(0, o.floor2 || PC.floor2); fl.addColorStop(1, o.floor || PC.floor);
    g.fillStyle = fl; g.fillRect(0, FLOOR, PW, PH - FLOOR);
    g.strokeStyle = 'rgba(80,60,40,0.12)'; g.lineWidth = 1;
    for (let k = 1; k < 6; k++) { const yy = FLOOR + k * k * 3.2; g.beginPath(); g.moveTo(0, yy); g.lineTo(PW, yy); g.stroke(); }
    g.fillStyle = PC.base; g.fillRect(0, FLOOR - 7, PW, 7);
  }
  function windowAt(g, x, y, w, h) {
    box4(g, x - 5, y - 5, w + 10, h + 10, PC.frame, 3);
    const gl = g.createLinearGradient(x, y, x + w, y + h); gl.addColorStop(0, PC.glass2); gl.addColorStop(1, PC.glass);
    g.fillStyle = gl; g.fillRect(x, y, w, h);
    g.fillStyle = PC.frame; g.fillRect(x + w / 2 - 2.5, y, 5, h); g.fillRect(x, y + h / 2 - 2.5, w, 5);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 8, y + h * 0.42); g.lineTo(x + w * 0.3, y + 8); g.stroke();
    box4(g, x - 9, y + h + 4, w + 18, 6, PC.frame, 2);
  }
  function door(g, x, y, w, h) {
    box4(g, x - 4, y - 4, w + 8, h + 4, PC.door2, 2);
    box4(g, x, y, w, h, PC.door, 2);
    box4(g, x + 8, y + 10, w - 16, h * 0.36, PC.wood3, 2); box4(g, x + 8, y + h * 0.5, w - 16, h * 0.42, PC.wood3, 2);
    circ(g, x + w - 10, y + h * 0.52, 3.2, '#E2C489');
  }
  function deskAt(g, x, y, w) {
    box4(g, x, y, w, 8, PC.wood, 2);
    box4(g, x + 6, y + 8, w - 12, FLOOR + 40 - y, PC.wood2, 2);
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x + 6, y + 8, w - 12, 5);
    shadowE(g, x + w / 2, FLOOR + 50, w * 0.55);
  }
  function monitorBack(g, x, y) {   // 모니터 뒷면 (화면은 사람 쪽)
    box4(g, x - 4, y - 8, 8, 10, '#3A3F46', 1);
    box4(g, x - 16, y - 2, 32, 4, '#3A3F46', 2);
    box4(g, x - 46, y - 70, 92, 62, '#2E3238', 5);
    box4(g, x - 38, y - 63, 76, 48, '#3A3F47', 4);
  }
  function keyboardAt(g, x, y) {
    g.fillStyle = '#E8E9EC'; g.beginPath(); g.moveTo(x - 34, y + 4); g.lineTo(x + 34, y + 4); g.lineTo(x + 30, y - 3); g.lineTo(x - 30, y - 3); g.closePath(); g.fill();
    g.strokeStyle = PC.out; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#C7C9CE'; for (let i = 0; i < 9; i++) g.fillRect(x - 27 + i * 6.2, y - 1, 4.2, 1.6), g.fillRect(x - 28 + i * 6.3, y + 1.8, 4.2, 1.4);
  }
  function mugAt(g, x, y) { box4(g, x - 7, y - 16, 14, 16, '#E26B4F', 3); g.strokeStyle = '#E26B4F'; g.lineWidth = 2.6; g.beginPath(); g.arc(x + 8, y - 8, 4.5, -1.3, 1.3); g.stroke(); }
  function papersAt(g, x, y, n = 4) { for (let i = 0; i < n; i++) { g.save(); g.translate(x, y - i * 2.2); g.rotate((i % 2 ? -1 : 1) * 0.03); box4(g, -22, -3, 44, 4, PC.paper, 1); g.restore(); } }
  // 의자 (정면) — y는 바닥
  function chairAt(g, x, y, s = 1, c = PC.chair, c2 = PC.chair2) {
    g.save(); g.translate(x, y); g.scale(s, s);
    pline(g, [[-15, 0], [-13, -40]], 3, c2); pline(g, [[15, 0], [13, -40]], 3, c2);
    box4(g, -18, -44, 36, 7, c, 2);
    pline(g, [[-14, -44], [-14, -80]], 3, c2); pline(g, [[14, -44], [14, -80]], 3, c2);
    box4(g, -17, -84, 34, 18, c, 3);
    g.restore();
  }
  // 쌓은 의자: 맨 아래 의자 위로 의자들이 조금씩 겹쳐 올라감
  function chairStack(g, x, y, n, s = 1) {
    for (let i = 0; i < n; i++) chairAt(g, x, y - i * 11 * s, s, i % 2 ? '#456A8D' : PC.chair, PC.chair2);
    shadowE(g, x, y + 2, 26 * s);
  }
  function boxAt(g, x, y, w, h, tone = 0) {   // y = 바닥
    const c = tone ? '#C08E55' : PC.box;
    box4(g, x - w / 2, y - h, w, h, c, 2);
    g.fillStyle = PC.box2; g.fillRect(x - w / 2, y - h, w, 5);
    g.fillStyle = PC.tape; g.fillRect(x - 4, y - h, 8, h * 0.45);
    g.strokeStyle = 'rgba(90,60,30,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - w / 2 + 4, y - h * 0.3); g.lineTo(x - w / 2 + 14, y - h * 0.3); g.stroke();
  }
  function shelfAt(g, x, y, w, h, levels) {   // 바닥 y, 칸 levels
    box4(g, x, y - h, 6, h, PC.metal2, 1); box4(g, x + w - 6, y - h, 6, h, PC.metal2, 1);
    for (let i = 0; i <= levels; i++) box4(g, x, y - 4 - i * (h - 6) / levels, w, 5, PC.metal, 1);
  }
  function binderRow(g, x, y, n, cols = ['#3E6FA8', '#C9533F', '#3F8F67', '#D5A23C']) {
    for (let i = 0; i < n; i++) box4(g, x + i * 11, y - 30, 9, 30, cols[i % cols.length], 1.5);
  }
  function copierAt(g, x, y) {   // y = 바닥, x = 가운데
    box4(g, x - 50, y - 92, 100, 92, PC.copier, 4);
    box4(g, x - 50, y - 100, 100, 10, PC.copier2, 3);
    box4(g, x - 44, y - 64, 88, 4, '#9AA2AC', 1);
    box4(g, x - 44, y - 40, 88, 4, '#9AA2AC', 1);
    box4(g, x + 18, y - 108, 32, 9, PC.panel, 2); circ(g, x + 44, y - 103.5, 2.2, '#7FE0A8');
    box4(g, x - 76, y - 74, 30, 4, '#9AA2AC', 1);                 // 나오는 종이 받침
    for (let i = 0; i < 5; i++) box4(g, x - 74, y - 78 - i * 2.2, 26, 3, PC.paper, 1);   // 복사한 종이
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x - 50, y - 6, 100, 6);
    shadowE(g, x, y + 2, 58);
  }
  function plantAt(g, x, y, s = 1, kind = 0) {   // y = 화분 바닥
    g.save(); g.translate(x, y); g.scale(s, s);
    const lc = kind % 2 ? PC.leaf2 : PC.leaf;
    if (kind === 2) { pline(g, [[0, -24], [0, -78]], 2.5, '#5E7A44'); [[-14, -70], [13, -62], [-12, -50], [12, -42], [0, -86]].forEach(([lx, ly], i) => { g.fillStyle = i % 2 ? PC.leaf2 : PC.leaf; g.beginPath(); g.ellipse(lx, ly, 13, 6.5, lx < 0 ? -0.5 : 0.5, 0, Math.PI * 2); g.fill(); }); }
    else { [[-12, -36, -0.7], [10, -38, 0.7], [0, -46, 0], [-6, -30, -1.2], [8, -30, 1.1]].forEach(([lx, ly, a], i) => { g.fillStyle = i % 2 ? PC.leaf2 : lc; g.beginPath(); g.ellipse(lx, ly, 6.5, 14, a, 0, Math.PI * 2); g.fill(); }); }
    g.fillStyle = PC.pot; g.beginPath(); g.moveTo(-14, -24); g.lineTo(14, -24); g.lineTo(10, 0); g.lineTo(-10, 0); g.closePath(); g.fill();
    g.fillStyle = PC.pot2; g.fillRect(-15, -27, 30, 5);
    g.restore();
  }
  function hooksAt(g, x, y, n) {
    box4(g, x, y, n * 26 + 10, 8, PC.wood2, 2);
    for (let i = 0; i < n; i++) pline(g, [[x + 16 + i * 26, y + 8], [x + 16 + i * 26, y + 16], [x + 21 + i * 26, y + 14]], 2.4, '#4E4A45');
  }
  function bagAt(g, x, y) {   // x, y = 손잡이 위
    g.strokeStyle = '#5E2E2A'; g.lineWidth = 2.4; g.beginPath(); g.arc(x, y + 9, 8, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    box4(g, x - 14, y + 7, 28, 22, '#7E3F3A', 4); g.fillStyle = '#9B5650'; g.fillRect(x - 14, y + 12, 28, 3);
  }
  function canAt(g, x, y, flip = 1) {   // 물뿌리개: (x, y) = 손잡이
    g.save(); g.translate(x, y); g.scale(flip, 1); g.rotate(-0.25);
    box4(g, -12, 0, 26, 20, '#3C7DBF', 5);
    g.strokeStyle = '#2F679F'; g.lineWidth = 3; g.beginPath(); g.arc(1, 2, 9, Math.PI, 0); g.stroke();
    pline(g, [[-10, 12], [-34, 2]], 4, '#3C7DBF'); box4(g, -40, -2, 8, 8, '#2F679F', 2);
    g.restore();
  }
  function drops(g, x, y) { g.fillStyle = '#7FB8E6'; [[0, 0], [-6, 9], [5, 12], [-2, 20], [7, 24], [-8, 26]].forEach(([dx, dy]) => { g.beginPath(); g.ellipse(x + dx, y + dy, 1.6, 3, 0, 0, Math.PI * 2); g.fill(); }); }

  /* ---------- 사람 (정면 · 뒷모습). 발끝이 (x, y), 서 있으면 키 약 165 ----------
   * aL · aR: [윗팔 각도, 아래팔 각도] (0 = 아래로, + = 오른쪽으로). jacket: 'on' | 'half' | null
   */
  function person(g, P) {
    const s = P.s || 1, C = Object.assign({ skin: '#E8BC95', hair: '#2E241E', shirt: '#E9E5DC', pants: '#3D4554', shoe: '#2A2A2E', jc: '#3E5D86' }, P.c || {});
    g.save(); g.translate(P.x, P.y); g.scale(s, s);
    const hipY = P.sit ? -48 : -80, shY = hipY - 54, headY = shY - 21, hr = 12.5;
    const SH = { L: [-15, shY + 3], R: [15, shY + 3] };
    const armPts = (side, [a1, a2]) => { const [sx, sy] = SH[side], ex = sx + Math.sin(a1) * 24, ey = sy + Math.cos(a1) * 24; return [[sx, sy], [ex, ey], [ex + Math.sin(a2) * 22, ey + Math.cos(a2) * 22]]; };
    const AL = armPts('L', P.aL || [-0.1, -0.05]), AR = armPts('R', P.aR || [0.1, 0.05]);
    const ctx = { AL, AR, shY, hipY, headY };
    // 몸 뒤에 있는 것 (반쯤 입은 재킷의 빈 소매 · 긴 머리)
    if (P.jacket === 'half') {
      g.fillStyle = C.jc; g.beginPath(); g.moveTo(-17, shY + 2); g.lineTo(16, shY + 4); g.lineTo(30, hipY + 6); g.lineTo(-15, hipY + 10); g.closePath(); g.fill();
      const sx = 17, sy = shY + 6, ang = 0.42, len = 50, ex = sx + Math.sin(ang) * len, ey = sy + Math.cos(ang) * len;
      pline(g, [[sx, sy], [ex, ey]], 12, C.jc);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(ex, ey, 4, 6.5, -ang, 0, Math.PI * 2); g.fill();
    }
    if (P.hairLong) { box4(g, -hr - 2, headY - 4, hr * 2 + 4, 36, C.hair, 9); }
    // 다리
    if (P.sit) {
      box4(g, -15, hipY - 4, 30, 14, C.pants, 5);
      pline(g, [[-8, hipY + 6], [-9, -4]], 11, C.pants); pline(g, [[8, hipY + 6], [9, -4]], 11, C.pants);
    } else {
      pline(g, [[-7, hipY], [-8, -5]], 12, C.pants); pline(g, [[7, hipY], [8, -5]], 12, C.pants);
    }
    g.fillStyle = C.shoe; g.beginPath(); g.ellipse(-9, -3, 8, 4, 0, 0, Math.PI * 2); g.ellipse(9, -3, 8, 4, 0, 0, Math.PI * 2); g.fill();
    // 몸통
    const torso = (w0, w1, y1, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(-w0, shY + 4); g.quadraticCurveTo(-w0, shY - 2, -w0 + 6, shY - 2); g.lineTo(w0 - 6, shY - 2); g.quadraticCurveTo(w0, shY - 2, w0, shY + 4); g.lineTo(w1, y1); g.lineTo(-w1, y1); g.closePath(); g.fill(); };
    torso(18, 14, hipY + 3, C.shirt);
    if (P.jacket === 'on') {
      torso(19, 16, hipY + 10, C.jc);
      g.fillStyle = C.shirt; g.beginPath(); g.moveTo(-6, shY - 2); g.lineTo(6, shY - 2); g.lineTo(3, hipY + 10); g.lineTo(-3, hipY + 10); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-6, shY - 2); g.lineTo(-11, shY + 16); g.lineTo(-4, shY + 26); g.moveTo(6, shY - 2); g.lineTo(11, shY + 16); g.lineTo(4, shY + 26); g.stroke();
    } else if (P.jacket === 'half') {
      g.fillStyle = C.jc; g.beginPath(); g.moveTo(-19, shY + 4); g.quadraticCurveTo(-19, shY - 2, -13, shY - 2); g.lineTo(-5, shY - 2); g.lineTo(-2, hipY + 10); g.lineTo(-16, hipY + 10); g.closePath(); g.fill();
    }
    if (P.tie) { g.fillStyle = P.tie; g.beginPath(); g.moveTo(-2.5, shY + 1); g.lineTo(2.5, shY + 1); g.lineTo(3.5, shY + 30); g.lineTo(0, shY + 35); g.lineTo(-3.5, shY + 30); g.closePath(); g.fill(); }
    // 목 · 머리
    box4(g, -4.5, shY - 9, 9, 10, C.skin, 2);
    if (P.back) { circ(g, 0, headY, hr, C.hair); }
    else {
      circ(g, 0, headY, hr, C.skin);
      g.fillStyle = C.hair; g.beginPath(); g.arc(0, headY - 1, hr + 0.6, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(hr - 1, headY - 2); g.quadraticCurveTo(2, headY - 9, -hr + 1, headY - 1); g.closePath(); g.fill();
      if (P.bun) circ(g, 0, headY - hr - 2, 5.5, C.hair);
      circ(g, -4.4, headY + 1.5, 1.4, '#2B2420'); circ(g, 4.4, headY + 1.5, 1.4, '#2B2420');
      g.strokeStyle = 'rgba(120,60,40,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, headY + 5, 3.2, 0.3, Math.PI - 0.3); g.stroke();
      if (P.glasses) { g.strokeStyle = '#1E1E22'; g.lineWidth = 1.5; g.beginPath(); g.arc(-4.6, headY + 1.5, 3.6, 0, Math.PI * 2); g.moveTo(8.2, headY + 1.5); g.arc(4.6, headY + 1.5, 3.6, 0, Math.PI * 2); g.moveTo(-1, headY + 1); g.lineTo(1, headY + 1); g.stroke(); }
    }
    // 팔 (몸 앞)
    const sleeve = side => P.jacket === 'on' || (P.jacket === 'half' && side === 'L') ? C.jc : C.shirt;
    const drawArm = (side, pts) => { pline(g, pts, 9.5, sleeve(side)); circ(g, pts[2][0], pts[2][1], 4.6, C.skin); };
    if (P.behindHand) P.behindHand(g, ctx);
    drawArm('L', AL); drawArm('R', AR);
    if (P.front) P.front(g, ctx);
    g.restore();
    return ctx;
  }

  /* ---------- 사진 열한 장 (이름은 grammar.js의 LP.PHOTO와 같음) ----------
   * SPOT: 덧그림 자리(사진 좌표) — who: 주인공 [x, y, rx, ry] · ghost: 사진에 없는 물건이 있을 법한 자리
   */
  const WOMAN = { skin: '#E8BC95', hair: '#3A2A20', shirt: '#F1EDE4', pants: '#4A4E5C', jc: '#3E5D86' };
  const MAN = { skin: '#C99169', hair: '#1F1B18', shirt: '#7FA4C9', pants: '#3B4250' };
  const MAN2 = { skin: '#E3B48D', hair: '#5A3B25', shirt: '#E2A35A', pants: '#3E4656' };
  const PHOTO = {
    desk(g) {
      room(g, { floor: '#9EA6AE', floor2: '#8C949C' }); windowAt(g, 30, 40, 104, 112); plantAt(g, 362, 288, 1.25, 2);
      box4(g, 174, 150, 52, 56, '#30343A', 10);                                 // 의자 등받이 (어깨 뒤)
      person(g, { x: 200, y: 278, s: 1.12, sit: true, glasses: true, hairLong: true, c: WOMAN, aL: [-0.32, 0.95], aR: [0.32, -0.95] });
      deskAt(g, 92, 212, 238);
      monitorBack(g, 286, 210); keyboardAt(g, 200, 208); mugAt(g, 122, 211); papersAt(g, 152, 210);
    },
    jacketOn(g) {
      room(g); door(g, 286, 62, 78, 146); hooksAt(g, 46, 74, 3);
      person(g, { x: 168, y: 284, s: 1.12, jacket: 'half', bun: true, c: WOMAN, aL: [-0.08, -0.04], aR: [0.95, 0.05] });
      // 움직임 표시 (입는 중)
      g.strokeStyle = 'rgba(60,60,70,0.45)'; g.lineWidth = 1.6; g.lineCap = 'round';
      [[214, 168, 8], [220, 182, 11]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, -0.9, 0.9); g.stroke(); });
    },
    jacketWear(g) {
      room(g); door(g, 286, 62, 78, 146);
      person(g, { x: 176, y: 284, s: 1.12, jacket: 'on', bun: true, c: WOMAN, aL: [-0.1, -0.06], aR: [0.12, 0.06],
        front: (gg, c) => bagAt(gg, c.AR[2][0], c.AR[2][1] - 2) });
    },
    chairsEmpty(g) {
      room(g, { floor: '#C2AF92' }); windowAt(g, 214, 44, 128, 104);
      chairStack(g, 62, 240, 6, 1.0); chairStack(g, 128, 240, 5, 1.0);
    },
    chairsMan(g) {
      room(g, { floor: '#C2AF92' }); windowAt(g, 238, 44, 128, 104);
      chairStack(g, 62, 240, 6, 1.0); chairStack(g, 128, 240, 3, 1.0);
      person(g, { x: 222, y: 286, s: 1.1, c: MAN, aL: [-1.15, -1.55], aR: [-0.55, -1.45],
        front: (gg, c) => { gg.save(); gg.translate(c.AL[2][0] + 22, c.AL[2][1] + 30); chairAt(gg, 0, 0, 0.95, '#456A8D', PC.chair2); gg.restore(); circ(gg, c.AL[2][0], c.AL[2][1], 4.6, MAN.skin); circ(gg, c.AR[2][0], c.AR[2][1], 4.6, MAN.skin); } });
    },
    boxesEmpty(g) {
      room(g, { wall: '#E1DDD2', floor: '#B7AE9F', floor2: '#A59C8C' }); door(g, 318, 64, 66, 144);
      [[46, 34, 40], [92, 46, 34], [140, 40, 44], [186, 44, 36], [232, 40, 42], [278, 34, 32]].forEach(([x, w, h], i) => boxAt(g, x, 222, w, h, i % 2));
    },
    boxesMan(g) {
      room(g, { wall: '#E1DDD2', floor: '#B7AE9F', floor2: '#A59C8C' }); door(g, 318, 64, 66, 144);
      [[46, 34, 40], [92, 46, 34], [140, 40, 44], [186, 44, 36]].forEach(([x, w, h], i) => boxAt(g, x, 222, w, h, i % 2));
      person(g, { x: 270, y: 286, s: 1.1, c: MAN2, aL: [-0.22, 0.82], aR: [0.22, -0.82],
        front: (gg, c) => { boxAt(gg, 0, c.shY + 64, 50, 40, 1); circ(gg, c.AL[2][0] - 2, c.AL[2][1], 4.6, MAN2.skin); circ(gg, c.AR[2][0] + 2, c.AR[2][1], 4.6, MAN2.skin); } });
    },
    shelfReach(g) {
      room(g, { wall: '#E3E0D6' });
      shelfAt(g, 92, 222, 216, 176, 3);
      const lv = i => 222 - 4 - i * (176 - 6) / 3;
      [[124, 30, 24], [176, 36, 28], [262, 34, 26]].forEach(([x, w, h], i) => boxAt(g, x, lv(3), w, h, i % 2));
      binderRow(g, 112, lv(2), 6); boxAt(g, 236, lv(2), 50, 34, 1);
      [[130, 44, 36], [206, 54, 38], [268, 40, 30]].forEach(([x, w, h], i) => boxAt(g, x, lv(1), w, h, (i + 1) % 2));
      [[138, 52, 40], [214, 60, 38]].forEach(([x, w, h], i) => boxAt(g, x, lv(0), w, h, i % 2));
      person(g, { x: 168, y: 290, s: 1.12, back: true, hairLong: true, c: Object.assign({}, WOMAN, { shirt: '#B6577A' }), aL: [-0.12, -0.05], aR: [2.72, 2.94] });
    },
    copier(g) {
      room(g, { floor: '#A9B0B7', floor2: '#979FA7' }); windowAt(g, 262, 40, 106, 110);
      copierAt(g, 120, 260);
      person(g, { x: 236, y: 286, s: 1.1, c: MAN, tie: '#B4473C', aL: [-1.28, -1.42], aR: [0.12, 0.05] });
    },
    plantsMan(g) {
      room(g); windowAt(g, 30, 38, 176, 112);
      box4(g, 22, 168, 196, 10, PC.wood, 2); box4(g, 30, 178, 8, 34, PC.wood2, 1); box4(g, 202, 178, 8, 34, PC.wood2, 1);
      plantAt(g, 60, 168, 0.95, 0); plantAt(g, 116, 168, 1.0, 1); plantAt(g, 172, 168, 0.95, 0);
      person(g, { x: 290, y: 286, s: 1.1, c: MAN2, aL: [-1.05, -1.3], aR: [0.12, 0.05],
        front: (gg, c) => { canAt(gg, c.AL[2][0] + 4, c.AL[2][1] - 4, 1); drops(gg, c.AL[2][0] - 40, c.AL[2][1] + 2); } });
    },
    plantsEmpty(g) {
      room(g); windowAt(g, 30, 38, 176, 112);
      box4(g, 22, 168, 196, 10, PC.wood, 2); box4(g, 30, 178, 8, 34, PC.wood2, 1); box4(g, 202, 178, 8, 34, PC.wood2, 1);
      plantAt(g, 60, 168, 0.95, 0); plantAt(g, 116, 168, 1.0, 1); plantAt(g, 172, 168, 0.95, 0);
      plantAt(g, 330, 286, 1.3, 2);
    },
  };
  const SPOT = {
    desk: { who: [200, 168, 52, 74], ghost: { lamp: [58, 212] } },
    jacketOn: { who: [176, 196, 66, 98] },
    jacketWear: { who: [178, 196, 58, 98], ghost: { umbrella: [124, 214] } },
    chairsEmpty: { who: [96, 186, 76, 70], ghost: { person: [214, 288], piano: [322, 214] } },
    chairsMan: { who: [214, 196, 62, 98] },
    boxesEmpty: { who: [162, 200, 140, 30], ghost: { person: [270, 288], table: [120, 292] } },
    boxesMan: { who: [270, 196, 50, 98] },
    shelfReach: { who: [172, 190, 46, 104], ghost: { ladder: [334, 288] } },
    copier: { who: [234, 196, 52, 98], copies: [58, 180, 26, 14], ghost: { coffee: [150, 152], lamp: [326, 212] } },
    plantsMan: { who: [286, 196, 56, 98], ghost: { broom: [348, 280] } },
    plantsEmpty: { who: [116, 140, 98, 34], ghost: { person: [262, 288] } },
  };
  LPS.SPOT = SPOT;
  // 사진에 없는 물건 (분홍 점선)
  function ghost(g, kind, x, y) {
    g.save(); g.setLineDash([5, 4]); g.strokeStyle = COL.gap; g.lineWidth = 2.4; g.fillStyle = 'rgba(255,122,168,0.10)';
    const sh = (fn) => { g.beginPath(); fn(); g.fill(); g.stroke(); };
    if (kind === 'lamp') { sh(() => { g.moveTo(x - 16, y - 60); g.lineTo(x + 16, y - 60); g.lineTo(x + 24, y - 40); g.lineTo(x - 24, y - 40); g.closePath(); }); sh(() => { g.rect(x - 2, y - 40, 4, 36); }); sh(() => { g.ellipse(x, y - 3, 14, 4, 0, 0, Math.PI * 2); }); }
    else if (kind === 'umbrella') { sh(() => { g.arc(x, y - 60, 26, Math.PI, 0); g.closePath(); }); sh(() => { g.moveTo(x, y - 60); g.lineTo(x, y - 6); }); }
    else if (kind === 'piano') { sh(() => { g.rect(x - 46, y - 70, 92, 66); }); sh(() => { g.rect(x - 40, y - 40, 80, 12); }); }
    else if (kind === 'ladder') { sh(() => { g.moveTo(x - 16, y); g.lineTo(x - 8, y - 110); g.moveTo(x + 16, y); g.lineTo(x + 8, y - 110); for (let k = 1; k < 6; k++) { const yy = y - k * 19; g.moveTo(x - 15 + k * 1.4, yy); g.lineTo(x + 15 - k * 1.4, yy); } }); }
    else if (kind === 'table') { sh(() => { g.rect(x - 60, y - 40, 120, 8); }); sh(() => { g.moveTo(x - 52, y - 32); g.lineTo(x - 52, y); g.moveTo(x + 52, y - 32); g.lineTo(x + 52, y); }); }
    else if (kind === 'broom') { sh(() => { g.moveTo(x - 6, y - 110); g.lineTo(x, y - 30); }); sh(() => { g.moveTo(x - 10, y - 30); g.lineTo(x + 12, y - 30); g.lineTo(x + 18, y); g.lineTo(x - 14, y); g.closePath(); }); }
    else if (kind === 'coffee') { sh(() => { g.rect(x - 10, y - 22, 20, 22); }); sh(() => { g.arc(x + 12, y - 12, 5, -1.4, 1.4); }); g.beginPath(); g.moveTo(x - 3, y - 28); g.quadraticCurveTo(x - 8, y - 36, x - 2, y - 42); g.moveTo(x + 4, y - 28); g.quadraticCurveTo(x - 1, y - 36, x + 5, y - 42); g.stroke(); }
    else if (kind === 'person') { sh(() => { g.arc(x, y - 150, 13, 0, Math.PI * 2); }); sh(() => { g.moveTo(x - 18, y - 132); g.lineTo(x + 18, y - 132); g.lineTo(x + 14, y - 78); g.lineTo(x + 9, y); g.lineTo(x - 9, y); g.lineTo(x - 14, y - 78); g.closePath(); }); }
    g.restore();
  }
  // 사진 한 장을 상자 (x, y, w, h)에 맞춰 그림. o: { ghost: [이름], ring: true (주인공 고리), ringA, dim }
  function photo(g, id, x, y, w, h, o = {}) {
    const s = Math.min(w / PW, h / PH), ox = x + (w - PW * s) / 2, oy = y + (h - PH * s) / 2, pw = PW * s, ph = PH * s;
    g.save();
    g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
    rr(g, ox - 7, oy - 7, pw + 14, ph + 14, 8); g.fillStyle = '#F2EFE8'; g.fill(); g.restore();
    g.save(); rr(g, ox, oy, pw, ph, 3); g.clip(); g.translate(ox, oy); g.scale(s, s);
    PHOTO[id](g);
    (o.ghost || []).forEach(k => { const p = SPOT[id].ghost && SPOT[id].ghost[k]; if (p) fade(g, o.ghostA == null ? 1 : o.ghostA, () => ghost(g, k, p[0], p[1])); });
    if (o.dim) { g.fillStyle = `rgba(16,21,28,${0.55 * o.dim})`; g.fillRect(0, 0, PW, PH); }
    g.restore();
    const map = (px, py) => [ox + px * s, oy + py * s];
    if (o.ring && SPOT[id].who) fade(g, o.ringA == null ? 1 : o.ringA, () => {
      const [cx, cy, rx, ry] = SPOT[id].who, [X, Y] = map(cx, cy);
      g.strokeStyle = COL.ante; g.lineWidth = 3; g.setLineDash([]); g.beginPath(); g.ellipse(X, Y, rx * s, ry * s, 0, 0, Math.PI * 2); g.stroke();
    });
    g.restore();
    return { ox, oy, s, w: pw, h: ph, map };
  }
  LPS.photo = photo;
  LPS.PHOTO_IDS = Object.keys(PHOTO);
  // 그림과 사실이 맞는지: 사실(LP.PHOTO)에 있는 사진은 모두 그림이 있어야 하고, 사진에 없는 물건의 점선 자리는 사진에 그 물건이 없어야 함
  LPS.checkPhotos = function () {
    const bad = [];
    Object.keys(LP.PHOTO).forEach(id => { if (!PHOTO[id]) bad.push(`사진 ${id}의 그림이 없어요`); });
    Object.entries(SPOT).forEach(([id, sp]) => Object.keys(sp.ghost || {}).forEach(k => { if (k !== 'person' && LP.PHOTO[id].things.includes(k)) bad.push(`사진 ${id}: ${k}가 있는데 점선으로 그려요`); if (k === 'person' && LP.PHOTO[id].people.length) bad.push(`사진 ${id}: 사람이 있는데 빈 사람을 그려요`); }));
    bad.forEach(b => console.warn('[듣기 ①] ' + b));
    return bad;
  };

  /* =========================================================
     들리는 말 한 줄: 말하는 사람 + 소리 물결 + 낱말이 하나씩 나타나는 받아쓰기
     ========================================================= */
  const WD = 0.27;   // 낱말 하나에 걸리는 초 (말하는 빠르기)
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8' };
  const lineDur = text => String(text).split(' ').length * WD;
  LPS.lineDur = lineDur;
  // 소리 물결 (같은 u면 같은 모양)
  function wave(g, x, y, w, h, u, live, color, still) {
    const n = Math.max(6, Math.round(w / 7)), bw = w / n;
    for (let i = 0; i < n; i++) {
      const v = live ? 0.25 + 0.75 * Math.abs(Math.sin(i * 1.73 + u * 9.1) * Math.sin(i * 0.61 + u * 4.3 + 1))
        : still != null ? 0.2 + 0.8 * Math.abs(Math.sin(i * 0.9 + still) * Math.sin(i * 0.37 + still * 0.5)) : 0.14 + 0.08 * Math.abs(Math.sin(i * 2.1));
      const bh = Math.max(2, h * v);
      rr(g, x + i * bw + bw * 0.2, y - bh / 2, bw * 0.6, bh, 1.5); g.fillStyle = color; g.fill();
    }
  }
  // 말하는 사람 동그라미
  function speaker(g, x, y, sp, r = 15, live = false) {
    const c = SPC[sp] || COL.soft;
    circ(g, x, y, r, COL.panel2); g.strokeStyle = live ? c : COL.faint; g.lineWidth = live ? 2.5 : 1.5; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    circ(g, x, y - r * 0.22, r * 0.32, c);
    g.fillStyle = c; g.beginPath(); g.arc(x, y + r * 0.62, r * 0.55, Math.PI, 0); g.fill();
  }
  // 낱말 토큰으로 나누기: marks = [[글, 역할]] (문장 속 글을 한 토큰으로 묶어 색칠)
  const PUNCT = /^[.,?!]$/;
  function toks(text, marks = []) {
    const ms = [];
    marks.forEach(([t, r]) => { if (!t) return; const i = text.indexOf(t); if (i >= 0 && !ms.some(m => i < m.e && i + t.length > m.s)) ms.push({ s: i, e: i + t.length, r }); });
    ms.sort((a, b) => a.s - b.s);
    const out = []; let at = 0;
    const plain = (s, r) => s.split(' ').forEach(w => { if (!w) return; const m = w.match(/^(.*?)([.,?!]?)$/); if (m[1]) out.push({ t: m[1], r }); if (m[2]) out.push({ t: m[2], r: '' }); });
    ms.forEach(m => { plain(text.slice(at, m.s), ''); plain(text.slice(m.s, m.e), m.r); at = m.e; });
    plain(text.slice(at), '');
    return out;
  }
  const RCOL = { who: COL.ante, key: COL.rel, act: COL.rel, state: COL.clause, obj: COL.verb, cue: COL.verb, trap: COL.trap, ok: COL.good, bad: COL.bad, dim: COL.dim, ko: COL.soft };
  const UNDER = { who: 1, key: 1, act: 1, state: 1, obj: 1, trap: 1, cue: 1 };
  /* 한 줄 그리기
   * it: { text, sp, label, marks: [[글, 역할]] }   o: { x, y, size, at(말 시작 u), u, maxW, strike: u, verdict: { ok, at, note }, hideText, waveW, roleAt }
   * 돌려주는 값: 배치 정보 { items, x0, x1, y, end }
   */
  function voiceLine(g, it, o) {
    const at0 = o.at == null ? -1e9 : o.at;
    if (at0 > -50 && !o.always && o.u < at0 - 0.5) return { items: [], x0: o.x, x1: o.x, y: o.y, yEnd: o.y };
    let out;
    fade(g, at0 > -50 && !o.always ? ramp(o.u, at0 - 0.5, 0.35) : 1, () => { out = voiceLine0(g, it, o); });
    return out;
  }
  function voiceLine0(g, it, o) {
    const size = o.size || 26, u = o.u, at = o.at == null ? -1e9 : o.at, x = o.x, y = o.y;
    const T = toks(it.text, it.marks || []);
    let cx = x;
    if (it.label) { txt(g, it.label, cx, y, { size: size * 0.82, weight: 500, fam: FM, color: COL.muted }); cx += tw(g, it.label, size * 0.82, 500, FM) + 10; }
    const live = u >= at && u < at + lineDur(it.text) + 0.1;
    speaker(g, cx + 15, y, it.sp, 14, live);
    cx += 38;
    const ww = o.waveW == null ? 46 : o.waveW;
    if (ww) { wave(g, cx, y, ww, size * 0.95, u, live, live ? (SPC[it.sp] || COL.soft) : 'rgba(238,241,244,0.22)'); cx += ww + 12; }
    // 낱말 배치 (넘치면 다음 줄)
    const maxW = o.maxW || 1e9, sp = size * 0.3, lh = size * 1.45;
    let lx = cx, ly = y, wi = 0;
    const items = [];
    T.forEach(tk => {
      const p = PUNCT.test(tk.t), w = tw(g, tk.t, size, UNDER[tk.r] ? 600 : 500);
      if (!p && items.length && lx + w > x + maxW) { lx = cx; ly += lh; }
      if (items.length && !p) lx += 0;
      items.push({ t: tk.t, r: tk.r, x: lx, y: ly, w, i: p ? wi - 1 : wi });
      if (!p) wi++;
      lx += w + (p ? sp : sp);
      if (p) { /* 문장부호 뒤 띄어쓰기 */ }
    });
    // 문장부호는 앞 낱말에 붙임
    for (let k = 1; k < items.length; k++) if (PUNCT.test(items[k].t)) { items[k].x = items[k - 1].x + items[k - 1].w + 1; for (let j = k + 1; j < items.length && items[j].y === items[k].y; j++) items[j].x -= sp - 1; }
    const shown = o.hideText ? -1 : (u - at) / WD;
    items.forEach(itm => {
      const a = o.hideText ? 0 : clamp((shown - itm.i) * 3 + (o.all ? 99 : 0));
      if (a <= 0.001) return;
      const r = o.roleAt != null && u < o.roleAt ? '' : (o.role ? o.role(itm) : itm.r);
      fade(g, a, () => {
        const c = RCOL[r] || (o.color || COL.text);
        txt(g, itm.t, itm.x, itm.y + 1, { size, weight: UNDER[itm.r] ? 600 : 500, color: c });
        if (UNDER[r]) { g.fillStyle = c; g.fillRect(itm.x, itm.y + size * 0.56, itm.w, 2.5); }
      });
    });
    const xEnd = Math.max(cx, ...items.map(i => i.x + i.w)), yEnd = items.length ? items[items.length - 1].y : y;
    if (o.strike != null && u >= o.strike) {
      const p = clamp((u - o.strike) / 0.4);
      g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(cx - 2, y + 1); g.lineTo(cx - 2 + (xEnd - cx + 4) * p, y + 1); g.stroke();
    }
    if (o.verdict && u >= o.verdict.at) fade(g, ramp(u, o.verdict.at, 0.3), () => {
      mark(g, o.verdict.ok, xEnd + 22, yEnd, 17);
      if (o.verdict.note) {
        const ns = o.verdict.size || 15, nw = tw(g, o.verdict.note, ns, 700), wide = xEnd + 42 + nw > (o.right || 1215);
        txt(g, o.verdict.note, wide ? cx : xEnd + 42, wide ? yEnd + size * 0.95 : yEnd, { size: ns, weight: 700, color: o.verdict.ok ? COL.good : COL.trap });
      }
    });
    if (!o.noHit) listen(x - 6, y - size * 0.8, Math.max(xEnd, cx + 200) - x + 12, yEnd - y + size * 1.6, [{ text: it.text, sp: it.sp }]);
    return { items, x0: cx, x1: xEnd, y, yEnd };
  }
  LPS.voiceLine = voiceLine;
  const byText = (L, t) => L.items.find(i => i.t === t);

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '때를 물었는데 시간이 없다', d: 24.5, caps: [
      [0.4, 5.5, '토익 듣기 Part 1과 Part 2는 문제지에 문장이 없어요. 사진 한 장, 또는 Mark your answer 한 줄뿐이에요.'],
      [5.5, 11.5, '들어 볼까요? When will the new printer be delivered? 대답 셋이 이어서 나와요.'],
      [11.5, 16.5, '그런데 때를 묻는 질문인데, 시간으로 답한 보기가 하나도 없어요.'],
      [16.5, 20.5, '어느 쪽이 정답일까요? 영상 끝에서 함께 풀어요.'],
      [20.5, 24.5, '사진은 **동작과 상태**로, 질문은 **첫 단어**로 풀어요. **3단계 풀이법**으로 묶어요.'],
    ] },
    { id: 'people', n: '01', title: '사람 사진: 동작이냐 상태냐', sub: 'Part 1 · 주인공 · putting on · wearing', d: 36, caps: [
      [0.4, 6, 'Part 1은 사진 한 장을 보며 문장 넷을 들어요. 사진을 가장 잘 말한 문장을 골라요.'],
      [6, 12, '① 먼저 사진의 **주인공**을 봐요. 남자 한 명이에요. 여자들이 주어인 문장은 바로 탈락이에요.'],
      [12, 18, '한국어 ‘입고 있다’는 뜻이 둘이에요. 지금 입는 중일 수도, 이미 입은 상태일 수도 있어요.'],
      [18, 24, '영어는 둘을 나눠요. 입는 **동작** → She is putting on a jacket. 입은 **상태** → She is wearing a jacket.'],
      [24, 30, '② 사진은 한순간이에요. 이미 다 입은 사진이면 → putting on 탈락, wearing 정답.'],
      [30, 36, '동작과 상태 짝 → picking up, holding · sitting down, sitting. 앞은 동작, 뒤는 상태예요.'],
    ] },
    { id: 'things', n: '02', title: '사람 없는 사진: being이냐 been이냐', sub: 'Part 1 · being p.p. · has been p.p.', d: 34, caps: [
      [0.4, 6, '이번에는 사람이 없는 사진이에요. ① 주인공은 **사물** → 벽 쪽에 쌓인 의자예요.'],
      [6, 12, '사물이 주어면 이렇게 들려요 → Some chairs have been stacked. 이미 쌓여 있는 **상태**예요.'],
      [12, 18, '함정 → Some chairs are being stacked. being → 지금 **누가 쌓는 중**이라는 뜻이에요.'],
      [18, 24, '사진에 사람이 없으니 쌓는 사람도 없어요. 그래서 are being stacked → 탈락.'],
      [24, 29, '사람이 의자를 쌓고 있는 사진이라면? 그때는 are being stacked → 맞는 말이 돼요.'],
      [29, 34, '상태는 놓인 모양으로도 말해요 → are lined up, is hanging on the wall, have been placed on a shelf.'],
    ] },
    { id: 'missing', n: '03', title: '사진에 없는 말', sub: 'Part 1 · 물건 맞춰 보기 · 비슷한 소리', d: 30, caps: [
      [0.4, 6, '③ 마지막으로 문장 속 **물건**을 사진과 맞춰요. 하나라도 사진에 없으면 탈락이에요.'],
      [6, 12, 'He is making some copies. 복사기 앞에서 복사하는 남자 → 맞아요.'],
      [12, 18, 'He is making some coffee. copies, coffee → 소리가 비슷해요. 사진에 커피는 없어요.'],
      [18, 24, 'He is standing near a lamp. 서 있는 건 맞지만, 사진에 램프가 없어요 → 탈락.'],
      [24, 30, '들린 물건이 사진에 있는지 하나씩 맞춰요. 비슷한 소리 짝 → copy, coffee · walk, work.'],
    ] },
    { id: 'first', n: '04', title: '첫 단어가 답을 정한다', sub: 'Part 2 · 의문사 · 답의 종류', d: 32, caps: [
      [0.4, 6, '이제 Part 2예요. 질문 하나를 듣고, 대답 셋 가운데 알맞은 것을 골라요.'],
      [6, 12, '① 가장 중요한 것은 **첫 단어**예요. Where → 장소, When → 때, Who → 사람.'],
      [12, 18, 'Why → 까닭, How → 방법, How long → 걸리는 시간. 첫 단어가 답의 **종류**를 정해요.'],
      [18, 24, 'Where is the staff lounge? 이 질문에 Since last Monday → 때로 답했어요. 종류가 달라요.'],
      [24, 28, '의문사로 물었는데 Yes, it\'s very nice → Yes, No 대답도 맞지 않아요.'],
      [28, 32, '정답은 → On the third floor. 장소를 말했어요.'],
    ] },
    { id: 'heard', n: '05', title: '들린 단어를 의심하라', sub: 'Part 2 · 같은 단어 · 비슷한 소리', d: 32, caps: [
      [0.4, 6, '② 다음은 귀에 걸린 낱말을 의심하기예요. 질문의 낱말이 그대로 들린다고 정답은 아니에요.'],
      [6, 12, 'Have you finished the sales report? → The sales team is on the third floor. 같은 낱말 sales, 대답은 아니에요.'],
      [12, 18, '소리가 비슷한 낱말도 조심해요 → contract, contact · copy, coffee · lunch, launch.'],
      [18, 24, 'Did you sign the contract? → Here\'s my contact information. 소리만 비슷하고 엉뚱한 대답이에요.'],
      [24, 28, '알맞은 대답 → Yes, I signed it this morning. 질문에 맞게 답했어요.'],
      [28, 32, '같은 낱말, 비슷한 소리가 들리면 한 번 더 의심하고, 대답이 되는지 확인해요.'],
    ] },
    { id: 'indirect', n: '06', title: '돌려 말하는 정답', sub: 'Part 2 · 간접 응답 · 모른다 · 넘기기', d: 32, caps: [
      [0.4, 6, '③ 남은 답이 말이 되는지 봐요. 정답이 꼭 질문에 바로 답하지는 않아요.'],
      [6, 12, 'When is the budget meeting? → Didn\'t you get the e-mail? 이메일에 시간이 있다는 뜻이에요.'],
      [12, 18, '이렇게 돌려 말하는 답을 **간접 응답**이라고 해요. 시간이 없어도 대화가 이어지면 정답이에요.'],
      [18, 24, '모른다 → I\'m not sure. 넘기기 → Ask Ms. Lee. 되묻기 → Which meeting do you mean?'],
      [24, 28, '확인하기 → Let me check. 상황 알리기 → It\'s been postponed.'],
      [28, 32, '이런 답은 어떤 질문에도 맞을 수 있어요. 엉뚱하다고 바로 지우지 마세요.'],
    ] },
    { id: 'notq', n: '07', title: '질문이 아닌 말', sub: 'Part 2 · 평서문 · 제안 · 선택', d: 36, caps: [
      [0.4, 6, '첫 단어가 의문사가 아닐 때도 있어요. **평서문** → The printer is jammed again.'],
      [6, 12, '평서문에는 해결책이나 맞장구가 정답이에요 → I\'ll call the technician.'],
      [12, 18, 'Why don\'t we take a short break? 첫 단어 → Why, 하지만 이유를 묻지 않아요. **제안**이에요.'],
      [18, 24, '제안에는 좋다, 싫다로 답해요 → That\'s a good idea. 이유를 대는 Because I\'m tired → 탈락.'],
      [24, 30, 'A or B 질문은 **선택**이에요. Tea or coffee? → Either is fine. Just water, please.'],
      [30, 36, '선택 질문에는 Yes, No 대답이 어울리지 않아요. 둘 다 · 둘 다 아님 · 다른 것도 정답이에요.'],
    ] },
    { id: 'yesno', n: '08', title: '사실이 정하는 Yes · No', sub: 'Part 2 · 부정 의문문 · 꼬리 질문', d: 34, caps: [
      [0.4, 6, '부정 의문문이에요. Didn\'t you call the client? 한국어로 → 고객에게 전화 안 했어요?'],
      [6, 12, '전화했다면 한국어는 → 아니요, 했어요. 안 했다면 → 네, 안 했어요.'],
      [12, 18, '영어는 **사실**만 봐요. 했으면 → Yes, I called her this morning. 안 했으면 → No, not yet.'],
      [18, 24, 'Yes → 했다, No → 안 했다. 질문이 부정 의문문이어도 똑같아요.'],
      [24, 29, '그래서 No, I called her this morning → 앞뒤가 안 맞는 함정이에요.'],
      [29, 34, '꼬리 질문도 같아요. You\'re coming to the dinner, aren\'t you? → Yes, I\'ll be there at seven.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: 'Part 1 · Part 2', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11.5, 'Part 1 → ① 사진의 **주인공** ② **동작**인가 **상태**인가 ③ 사진에 **없는 말** 지우기.'],
      [11.5, 17.5, 'Part 2 → ① **첫 단어**로 답의 종류 정하기 ② **함정** 지우기 ③ 남은 답이 **말이 되나** 보기.'],
      [17.5, 23.5, '함정 → 엉뚱한 종류, 같은 낱말, 비슷한 소리. 돌려 말한 답은 지우지 말고 남겨요.'],
      [23.5, 28, '듣기는 한 번뿐이에요. 들으면서 지우는 이 순서로 처음 듣는 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: 'Part 2 · Part 1 · Part 2', d: 56, caps: [
      [0.4, 6, '처음 들은 문제예요. ① 첫 단어 → When, 때를 물어요. 때로 답하거나 돌려 말하는 답이 와요.'],
      [6, 12, '② 함정 지우기 → (C) To the second floor → 장소, 엉뚱한 종류. (A) It prints in color → 같은 단어. 탈락.'],
      [12, 18, '③ 남은 (B) → Didn\'t you read the e-mail? 이메일에 날짜가 있다는 간접 응답이에요. 정답은 (B).'],
      [18.4, 24.5, '두 번째는 사진 문제예요. ① 주인공 → 의자, 사람이 없어요. (C) A man is arranging → 탈락.'],
      [24.5, 31, '② 사람이 없으니 누가 쌓는 중일 수 없어요. (A) are being stacked → 탈락.'],
      [31, 37, '③ (D) near a piano → 사진에 피아노가 없어요. 정답은 (B) have been stacked.'],
      [37.4, 43.5, '세 번째. ① 첫 단어 → Didn\'t you, 부정 의문문이에요. 대답은 사실을 따라요.'],
      [43.5, 50, '② 함정 → (C) An invoice number. invoice 되풀이, 엉뚱한 종류예요. 탈락.'],
      [50, 56, '③ (A) No, I sent it this morning → 앞뒤가 안 맞아요. 보냈으면 Yes. 정답은 (B).'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 표', d: 20.5, caps: [
      [0.4, 6, '정리해요. Part 1은 사진의 주인공, 동작과 상태, 없는 말을 차례로 봐요.'],
      [6, 12, 'Part 2는 첫 단어로 종류를 정하고, 함정을 지우고, 남은 답이 말이 되는지 봐요.'],
      [12, 16.5, 'Yes → 했다, No → 안 했다. 사실을 따라요. 돌려 말한 답도 정답이 될 수 있어요.'],
      [16.5, 20.5, '아래 놀이터의 함정 감별사로 귀를 훈련해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  LPS.CHAPTERS = CHAPTERS; LPS.CAPTIONS = CAPTIONS; LPS.END = END;
  LPS.POSTER = CHAPTERS.find(c => c.id === 'people').t + 27;
  LPS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  LPS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 연습 문제(LP.DRILL)에서 셋. 단계마다 지워지는 보기를 규칙 엔진의 step과 대조
  const PRACTICE = [
    { k: 7, at: [0.4, 6, 12], x: [8.4, 10.6, 0], win: 15.2, lines: ['When → 때를 물어요 · 때로 답하거나 돌려 말해요', '(C) 장소 → 엉뚱한 종류 · (A) prints → 같은 단어 · 탈락', '이메일에 날짜가 있다는 간접 응답 → 정답 (B)'] },
    { k: 2, at: [0.4, 6.1, 12.6], x: [4.4, 9.8, 15.4], win: 16.4, lines: ['주인공 → 의자 (사람 없음) · (C) A man → 탈락', '사람이 없으니 누가 쌓는 중일 수 없어요 · (A) 탈락', '(D) a piano → 사진에 없어요 · 정답 (B)'] },
    { k: 14, at: [0.4, 6.1, 12.6], x: [0, 9.2, 15.2], win: 16.4, lines: ['Didn\'t you → 부정 의문문 · 대답은 사실을 따라요', '(C) invoice 되풀이 → 같은 단어 · 탈락', '(A) No + 보냈어요 → 앞뒤가 안 맞아요 · 정답 (B)'] },
  ];
  PRACTICE.forEach(p => {
    const it = LP.DRILL[p.k], L = 'ABCD';
    [1, 2, 3].forEach(step => {
      const gone = it.opts.map((o, i) => LP.judgeOpt(it, i).step === step ? `(${L[i]})` : '').filter(Boolean).sort();
      const shown = (p.lines[step - 1].replace(`정답 (${L[it.a]})`, '').match(/\([A-D]\)/g) || []).sort();
      if (gone.join() !== shown.join()) console.warn('[듣기 ①] 실전 문제 탈락 표시가 규칙 엔진과 달라요:', it.q || it.photo, step, gone, shown);
    });
    if (!p.lines[2].includes(`정답 (${L[it.a]})`)) console.warn('[듣기 ①] 실전 문제 정답 표시가 데이터와 달라요:', it.q || it.photo);
  });
  LPS.PRACTICE = PRACTICE;

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  const label = (g, s, x, y, o = {}) => txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o));
  // Part 1 문장 → 낱말 표시 (주어 · 동사 · 물건). P가 있으면 사진에 없는 물건은 함정 색
  const stMarks = (st, P) => [[st.subjT, 'who'], [st.vT, LP.FORM[st.form].role]].concat((st.objT || []).map((t, i) => [t, P && !P.people.concat(P.things).includes(st.obj[i]) ? 'trap' : 'obj']));
  const stLine = (st, sp, labelS, P) => ({ text: st.t, sp, label: labelS, marks: stMarks(st, P) });
  // 시험지의 답 동그라미 (A)(B)(C)(D)
  function bubbles(g, x, y, n, o = {}) {
    for (let k = 0; k < n; k++) {
      const cx = x + k * 52, on = o.pick === k;
      circ(g, cx, y, 17, on ? COL.accent : 'rgba(238,241,244,0.06)'); g.strokeStyle = on ? COL.accent : COL.line; g.lineWidth = 1.6; g.beginPath(); g.arc(cx, y, 17, 0, Math.PI * 2); g.stroke();
      txt(g, 'ABCD'[k], cx, y + 1, { size: 15, weight: 700, color: on ? '#1D1305' : COL.soft, align: 'center', fam: FM });
    }
  }
  // 동작 · 상태 짝 한 줄
  function pairRow(g, y, a, ako, b, bko, al) {
    fade(g, al, () => {
      const c1 = chip(g, a, 330, y, { size: 22, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 44, r: 12 });
      txt(g, ako, 330, y + 38, { size: 15, weight: 600, color: COL.soft, align: 'center' });
      say(c1.x, c1.y, c1.w, c1.h, 'She ' + a + ' it.');
      arrow(g, 520, y, 740, y, COL.muted, 2);
      const c2 = chip(g, b, 930, y, { size: 22, weight: 700, color: COL.clause, fill: COL.panel2, stroke: COL.clause, align: 'center', h: 44, r: 12 });
      txt(g, bko, 930, y + 38, { size: 15, weight: 600, color: COL.soft, align: 'center' });
      say(c2.x, c2.y, c2.w, c2.h, 'She ' + b + ' it.');
    });
  }
  // 소리 짝 카드 (두 낱말 + 닮은 물결). 누르면 두 낱말을 이어서 들려줌
  function soundCard(g, x, y, w, a, b, u, at) {
    fade(g, ramp(u, at, 0.5), () => {
      panel(g, x, y - 34, w, 68, { fill: COL.panel, stroke: COL.trap, r: 12 });
      const L = txt(g, a, x + 20, y - 10, { size: 22, weight: 700, color: COL.trap });
      txt(g, '↔', x + 30 + L, y - 10, { size: 20, weight: 700, color: COL.muted });
      txt(g, b, x + 58 + L, y - 10, { size: 22, weight: 700, color: COL.trap });
      const seed = a.length * 0.7;
      wave(g, x + 20, y + 16, (w - 60) / 2, 20, 0, false, 'rgba(255,159,122,0.6)', seed);
      wave(g, x + 40 + (w - 60) / 2, y + 16, (w - 60) / 2, 20, 0, false, 'rgba(255,159,122,0.6)', seed + 0.15);
      listen(x, y - 34, w, 68, [{ text: a, sp: 'us' }, { text: b, sp: 'us', gap: 0.6 }]);
    });
  }
  // 04장 표 옆의 예: 의문사 질문 → 그 종류의 대답
  const EXQ = [['Where is the meeting room?', 'In Room 3.', 6.2], ['When does the bus leave?', 'At noon.', 7.0], ['Who wrote this report?', 'Ms. Diaz did.', 7.8],
    ['Why was the flight delayed?', 'Because of the snow.', 12.2], ['How do I get to the airport?', 'Take the subway.', 13.0], ['How long will the meeting take?', 'About an hour.', 13.8]];
  const P2line = (it, k, o = {}) => ({ text: it.opts[k].t, sp: it.sp[1], label: `(${'ABC'[k]})`, marks: o.marks || [] });

  const SCENES = {
    /* 00 들어가며: 제목 → 문제지 두 장 → Part 2 한 문제(시간으로 답한 보기가 없음) → 3단계 */
    intro(g, u) {
      const outA = 1 - ramp(u, 2.6, 0.5);
      fade(g, ramp(u, 0.2, 0.6) * outA, () => {
        txt(g, '첫 단어를 잡고, 들린 단어를 의심하라', W / 2, 300, { size: 52, weight: 800, fam: FD, align: 'center' });
        txt(g, 'TOEIC Listening · Part 1 사진 묘사 · Part 2 질의응답', W / 2, 372, { size: 24, weight: 500, color: COL.muted, align: 'center' });
      });
      const outB = 1 - ramp(u, 5.3, 0.5);
      fade(g, ramp(u, 2.9, 0.6) * outB, () => {
        panel(g, 120, 150, 500, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, '문제지 · Part 1', 150, 182, { size: 16, weight: 500, fam: FM, color: COL.accent });
        txt(g, '1.', 150, 222, { size: 20, weight: 700 });
        photo(g, 'desk', 190, 210, 300, 225);
        bubbles(g, 200, 516, 4);
        panel(g, 660, 150, 500, 400, { fill: COL.panel, stroke: COL.faint });
        txt(g, '문제지 · Part 2', 690, 182, { size: 16, weight: 500, fam: FM, color: COL.accent });
        txt(g, '7. Mark your answer on your answer sheet.', 690, 240, { size: 20, weight: 600, color: COL.en });
        bubbles(g, 740, 516, 3);
        fade(g, ramp(u, 3.8, 0.5), () => {
          tag(g, '대답은 인쇄되어 있지 않아요', 910, 370, COL.trap, { align: 'center' });
          tag(g, '사진만 보고 문장 넷을 들어요', 370, 470, COL.trap, { align: 'center', size: 15, h: 30 });
        });
      });
      // Part 2 한 문제
      const it = LP.DRILL[7], outC = 1 - ramp(u, 19, 0.6);
      fade(g, ramp(u, 5.6, 0.6) * outC, () => {
        panel(g, LX, 150, 290, 210, { fill: COL.panel, stroke: COL.faint });
        txt(g, '문제지 · Part 2', LX + 22, 180, { size: 15, weight: 500, fam: FM, color: COL.accent });
        txt(g, '7. Mark your answer', LX + 22, 226, { size: 18, weight: 600, color: COL.en });
        txt(g, 'on your answer sheet.', LX + 22, 254, { size: 18, weight: 600, color: COL.en });
        bubbles(g, LX + 46, 314, 3);
        voiceLine(g, { text: it.q, sp: it.sp[0], label: 'Q', marks: [['When', 'key']] }, { x: 420, y: 196, size: 25, at: 6.0, u, roleAt: 14.2, maxW: 780 });
        const at = [8.4, 9.9, 12.6];
        it.opts.forEach((o, k) => voiceLine(g, P2line(it, k), { x: 420, y: 274 + k * 64, size: 24, at: at[k], u, maxW: 740 }));
        fade(g, ramp(u, 14.2, 0.5), () => {
          panel(g, LX, 392, 290, 150, { fill: 'rgba(255,193,94,0.07)', stroke: COL.rel });
          pieces(g, [['When', COL.rel, true], [' → 때를 물었는데', COL.soft]], LX + 20, 428, 19);
          txt(g, '시간으로 답한 보기', LX + 20, 468, { size: 19, weight: 700, color: COL.trap });
          txt(g, '= 0개', LX + 20, 506, { size: 30, weight: 800, color: COL.trap, fam: FD });
        });
        fade(g, ramp(u, 16.6, 0.5), () => it.opts.forEach((o, k) => txt(g, '?', 1196, 274 + k * 64, { size: 26, weight: 800, color: COL.accent, align: 'center', fam: FD })));
      });
      // 3단계 두 줄
      const rows = [['Part 1 · 사진', COL.clause, [['①', '주인공', '사람? 사물?'], ['②', '동작 · 상태', 'is ~ing · has been p.p.'], ['③', '없는 말', '사진에 없으면 지우기']]],
        ['Part 2 · 질의응답', COL.ante, [['①', '첫 단어', '무엇을 묻나?'], ['②', '함정 지우기', '종류 · 같은 단어 · 소리'], ['③', '말이 되나', '돌려 말한 답도 정답']]]];
      rows.forEach(([nm, c, boxes], ri) => {
        const y0 = 168 + ri * 196;
        fade(g, ramp(u, 19.6 + ri * 1.0, 0.6), () => txt(g, nm, LX, y0 + 70, { size: 19, weight: 700, color: c }));
        boxes.forEach(([n, t1, t2], k) => {
          const a = ramp(u, 19.8 + ri * 1.0 + k * 0.35, 0.5), x0 = 280 + k * 316;
          fade(g, a, () => {
            panel(g, x0, y0 + (1 - a) * 12, 296, 140, { fill: COL.panel, stroke: COL.faint });
            txt(g, n, x0 + 24, y0 + 42 + (1 - a) * 12, { size: 28, weight: 700, color: COL.accent });
            txt(g, t1, x0 + 66, y0 + 42 + (1 - a) * 12, { size: 23, weight: 700, fam: FD });
            txt(g, t2, x0 + 24, y0 + 98 + (1 - a) * 12, { size: fit(g, t2, 18, 256, 500), weight: 500, color: COL.en });
          });
        });
      });
    },

    /* 01 사람 사진: 주인공 → ‘입고 있다’의 두 뜻 → putting on(동작) · wearing(상태) → 동작 · 상태 짝 */
    people(g, u) {
      const outA = 1 - ramp(u, 11.6, 0.5);
      fade(g, outA, () => {
        photo(g, 'boxesMan', LX, 150, 440, 330, { ring: u >= 6.4, ringA: ramp(u, 6.4, 0.5) });
        fade(g, ramp(u, 0.5, 0.5), () => label(g, 'Part 1 · 사진 묘사 — 문장 넷 가운데 하나를 골라요', 580, 172, { color: COL.accent, size: 16 }));
        LP.EX.boss.forEach((st, k) => {
          const j = LP.judge1(st, 'boxesMan');
          voiceLine(g, stLine(st, 'us', `(${'AB'[k]})`), { x: 580, y: 250 + k * 84, size: 25, at: 1.4 + k * 2.2, u, roleAt: 6.4, maxW: 620,
            role: itm => itm.r === 'who' ? (k === 1 && u >= 8.4 ? 'trap' : 'who') : '',
            strike: j.s === 'ok' ? null : 8.8, verdict: { ok: j.s === 'ok', at: j.s === 'ok' ? 9.8 : 9.0, note: j.s === 'ok' ? '주인공과 맞아요' : '주어가 사진에 없어요' } });
        });
        fade(g, ramp(u, 6.6, 0.5), () => tag(g, `① 주인공 → ${LP.peopleKo('boxesMan')}`, 580, 446, COL.ante));
      });
      // ‘입고 있다’ → 두 사진
      const outB = 1 - ramp(u, 29.6, 0.5), pick = S.jk, live = pick ? 1 : 0;
      fade(g, (live || ramp(u, 12.2, 0.5)) * outB, () => {
        chip(g, '입고 있다', W / 2, 176, { size: 24, weight: 800, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'center', h: 48, r: 12 });
        fade(g, live || ramp(u, 13.4, 0.5), () => {
          arrow(g, W / 2 - 74, 188, 470, 222, COL.trap, 2.2); arrow(g, W / 2 + 74, 188, 810, 222, COL.trap, 2.2);
          txt(g, '지금 입는 중 → 동작', 290, 220, { size: 19, weight: 700, color: COL.rel, align: 'center' });
          txt(g, '이미 입은 → 상태', 990, 220, { size: 19, weight: 700, color: COL.clause, align: 'center' });
        });
        fade(g, live || ramp(u, 14.8, 0.6), () => {
          photo(g, 'jacketOn', 130, 246, 320, 240, { dim: pick === 'wear' ? 0.6 : 0 });
          photo(g, 'jacketWear', 830, 246, 320, 240, { dim: pick === 'on' ? 0.6 : 0 });
        });
        const step2 = live || ramp(u, 24.2, 0.5);
        if (step2 > 0.01) fade(g, step2, () => { rr(g, (pick === 'on' ? 130 : 830) - 9, 237, 338, 258, 10); g.strokeStyle = COL.clause; g.lineWidth = 3; g.stroke(); });
        const sts = LP.EX.jacket;
        voiceLine(g, stLine(sts[0], 'gb'), { x: 110, y: 524, size: 23, at: pick ? -99 : 18.6, u, waveW: 0, maxW: 400 });
        voiceLine(g, stLine(sts[1], 'gb'), { x: 812, y: 524, size: 23, at: pick ? -99 : 20.8, u, waveW: 0, maxW: 400 });
        // ② 사진은 한순간: 고른 사진(기본은 다 입은 사진)에 두 문장을 대어 봄
        const id = pick === 'on' ? 'jacketOn' : 'jacketWear';
        fade(g, step2, () => {
          chip(g, pick === 'on' ? '② 입는 중인 사진이면' : '② 다 입은 사진이면', W / 2, 300, { size: 18, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 40, r: 10 });
          sts.forEach((st, k) => {
            const j = LP.judge1(st, id), y = 368 + k * 60;
            txt(g, k ? '상태' : '동작', W / 2 - 104, y, { size: 14, weight: 700, color: COL.muted, align: 'center' });
            pieces(g, [[st.vT, k ? COL.clause : COL.rel, true]], W / 2 - 74, y, 22, { say: st.t });
            mark(g, j.s === 'ok', W / 2 + 112, y, 16);
          });
        });
      });
      // 동작 · 상태 짝
      fade(g, ramp(u, 30.2, 0.6), () => {
        txt(g, '동작 · 지금 하는 중', 330, 186, { size: 19, weight: 700, color: COL.rel, align: 'center' });
        txt(g, '상태 · 이미 그런 모습', 930, 186, { size: 19, weight: 700, color: COL.clause, align: 'center' });
      });
      pairRow(g, 262, 'is putting on', '입는 중', 'is wearing', '입고 있음', ramp(u, 30.6, 0.5));
      pairRow(g, 362, 'is picking up', '집어 드는 중', 'is holding', '들고 있음', ramp(u, 31.6, 0.5));
      pairRow(g, 462, 'is sitting down', '앉는 중', 'is sitting', '앉아 있음', ramp(u, 32.8, 0.5));
    },

    /* 02 사람 없는 사진: 주인공 = 사물 → have been stacked(상태) · are being stacked(누가 하는 중) → 사람이 들어오면 */
    things(g, u) {
      const pick = S.ch, man = pick ? pick === 'man' : u >= 24.2;
      const mixA = pick ? (man ? 1 : 0) : ramp(u, 24.2, 0.7);
      const showGhost = !man && (pick ? true : u >= 18.4);
      if (mixA < 1) photo(g, 'chairsEmpty', LX, 150, 440, 330, { ring: true, ringA: (pick ? 1 : ramp(u, 0.8, 0.6)) * (1 - mixA), ghost: showGhost ? ['person'] : [], ghostA: pick ? 1 : ramp(u, 18.4, 0.5) });
      if (mixA > 0) fade(g, mixA, () => photo(g, 'chairsMan', LX, 150, 440, 330, { ring: true }));
      if (showGhost) fade(g, pick ? 1 : ramp(u, 18.6, 0.5), () => tag(g, '쌓는 사람?', 440, 186, COL.gap, { align: 'center', size: 16, h: 32, dash: true }));
      fade(g, pick ? 1 : ramp(u, 1.2, 0.5), () => tag(g, man ? '주인공 → 의자 · 쌓는 남자' : '① 주인공 → 사물 (사람 없음)', 580, 170, COL.ante));
      const sts = LP.EX.chairs, id = man ? 'chairsMan' : 'chairsEmpty';
      const ats = [6.2, 12.2];
      sts.forEach((st, k) => {
        const j = LP.judge1(st, id), y = 250 + k * 136;
        const vAt = pick ? -99 : k === 0 ? 10.4 : man ? 25.4 : 19.4;
        voiceLine(g, stLine(st, 'au'), { x: 580, y, size: 26, at: pick ? -99 : ats[k], u, maxW: 620,
          strike: j.s === 'ok' ? null : vAt, verdict: { ok: j.s === 'ok', at: vAt, note: j.s === 'ok' ? (k ? '남자가 쌓는 중' : '쌓여 있음') : '사람 없음' } });
        fade(g, pick ? 1 : ramp(u, k ? 14.6 : 9.4, 0.5), () => {
          const c = k ? COL.rel : COL.clause;
          chip(g, k ? '쌓이고 있다 → 누가 지금 쌓는 중' : '쌓여 있다 → 이미 된 상태', 620, y + 52, { size: 17, weight: 700, color: c, fill: COL.panel2, stroke: c, h: 36, r: 10 });
        });
      });
      fade(g, ramp(u, 29.2, 0.6), () => {
        label(g, '놓인 모양 · 위치도 상태로 말해요', LX, 522, { color: COL.clause, size: 16 });
        let x = LX;
        ['are lined up', 'is hanging on the wall', 'have been placed on a shelf'].forEach((s, i) => fade(g, ramp(u, 29.6 + i * 0.6, 0.4), () => {
          const c = chip(g, s, x, 560, { size: 18, weight: 700, color: COL.clause, fill: COL.panel2, stroke: COL.clause, h: 34, r: 10 });
          say(c.x, c.y, c.w, c.h, 'Some boxes ' + s + '.'); x = c.x + c.w + 14;
        }));
      });
    },

    /* 03 사진에 없는 말: copies ✓ · coffee(비슷한 소리) × · lamp(없는 물건) × */
    missing(g, u) {
      const sts = LP.EX.copier, P = LP.PHOTO.copier, ats = [6.2, 12.2, 18.2];
      const gh = [];
      if (u >= 14.6) gh.push('coffee');
      if (u >= 20.6) gh.push('lamp');
      const ph = photo(g, 'copier', LX, 150, 440, 330, { ring: u >= 0.8, ringA: ramp(u, 0.8, 0.5), ghost: gh, ghostA: 1 });
      if (u >= 9) fade(g, ramp(u, 9, 0.5), () => { const [cx, cy, rx, ry] = SPOT.copier.copies, [X, Y] = ph.map(cx, cy); g.strokeStyle = COL.verb; g.lineWidth = 3; g.beginPath(); g.ellipse(X, Y, rx * ph.s, ry * ph.s, 0, 0, Math.PI * 2); g.stroke(); });
      fade(g, ramp(u, 0.6, 0.5), () => tag(g, '③ 문장 속 물건 ↔ 사진', 580, 170, COL.verb));
      sts.forEach((st, k) => {
        const j = LP.judge1(st, 'copier'), y = 240 + k * 100, vAt = [9.6, 15.6, 21.0][k];
        voiceLine(g, stLine(st, 'ca', `(${'ABC'[k]})`, u >= vAt - 1 ? P : null), { x: 580, y, size: 25, at: ats[k], u, maxW: 620,
          strike: j.s === 'ok' ? null : vAt, verdict: { ok: j.s === 'ok', at: vAt, note: j.s === 'ok' ? '사진에 있어요' : `사진에 ${k === 1 ? '커피' : '램프'}가 없어요` } });
      });
      fade(g, ramp(u, 14.8, 0.5) * (1 - ramp(u, 23.6, 0.4)), () => tag(g, 'copies ↔ coffee · 소리가 비슷해요', 640, 292, COL.trap, { size: 16, h: 32 }));
      [['copy', 'coffee'], ['walk', 'work'], ['file', 'pile'], ['lunch', 'launch']].forEach(([a, b], i) => soundCard(g, LX + i * 285, 530, 268, a, b, u, 24.4 + i * 0.5));
    },

    /* 04 첫 단어: 의문사 → 답의 종류 · 엉뚱한 종류 · Yes/No 함정 */
    first(g, u) {
      fade(g, ramp(u, 0.4, 0.6) * (1 - ramp(u, 5.6, 0.5)), () => {
        speaker(g, 340, 340, 'us', 40, true); wave(g, 400, 340, 180, 50, u, true, SPC.us);
        txt(g, '질문 하나', 340, 410, { size: 19, weight: 700, color: COL.soft, align: 'center' });
        [0, 1, 2].forEach(k => { arrow(g, 610, 340, 760, 262 + k * 78, COL.muted, 2); txt(g, `(${'ABC'[k]})`, 790, 262 + k * 78, { size: 22, weight: 500, fam: FM, color: COL.muted }); wave(g, 850, 262 + k * 78, 150, 34, u + k, u > 2 + k * 1.1 && u < 3 + k * 1.1, SPC.gb); });
        txt(g, '대답 셋 가운데 하나', 925, 500, { size: 19, weight: 700, color: COL.soft, align: 'center' });
      });
      const rows = [['Where', '장소', 6.2], ['When', '때', 7.0], ['Who', '사람', 7.8], ['Why', '까닭', 12.2], ['How', '방법', 13.0], ['How long', '걸리는 시간', 13.8]];
      const pickQ = S.wh != null ? LP.WHSET.qs[S.wh] : null;
      rows.forEach(([w, k, at], i) => fade(g, (pickQ ? 1 : ramp(u, at, 0.5)) * (pickQ && pickQ.first !== w ? 0.35 : 1), () => {
        const y = 180 + i * 62;
        const c = chip(g, w, LX, y, { size: 22, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, h: 44, r: 12 });
        arrow(g, c.x + c.w + 12, y, c.x + c.w + 52, y, COL.muted, 2);
        chip(g, k, c.x + c.w + 62, y, { size: 20, weight: 700, color: COL.verb, fill: COL.panel2, stroke: COL.verb, h: 40, r: 10 });
      }));
      fade(g, pickQ ? 1 : ramp(u, 15.4, 0.5), () => tag(g, '첫 단어 → 답의 종류', LX, 556, COL.accent));
      if (!pickQ) fade(g, 1 - ramp(u, 17.2, 0.5), () => EXQ.forEach(([q, a, at], i) => fade(g, ramp(u, at + 0.3, 0.5), () => {
        const y = 180 + i * 62, w = pieces(g, [[q, COL.en, false, 600]], 520, y, 19, { play: [{ text: q, sp: 'gb' }] });
        txt(g, '→', 520 + w + 12, y, { size: 19, weight: 700, color: COL.muted });
        pieces(g, [[a, COL.good, false, 600]], 520 + w + 40, y, 19, { play: [{ text: a, sp: 'us' }] });
      })));
      if (pickQ) {
        // 직접 해 보기: 고른 질문에 대답 여섯을 대어 봄 (규칙 엔진)
        voiceLine(g, { text: pickQ.q, sp: 'gb', label: 'Q', marks: [[pickQ.first, 'key']] }, { x: 560, y: 190, size: 25, u, at: -99, maxW: 660 });
        pickQ.opts.forEach((o, k) => {
          const j = LP.judge2(pickQ, k), y = 258 + k * 52;
          voiceLine(g, { text: o.t, sp: 'us', marks: [] }, { x: 560, y, size: 21, u, at: -99, waveW: 0, color: j.s === 'ok' ? COL.text : COL.dim,
            verdict: { ok: j.s === 'ok', at: -99, note: LP.KIND[o.kind], size: 14 } });
        });
        return;
      }
      const it = LP.EX.lounge;
      fade(g, ramp(u, 18.0, 0.5), () => {
        voiceLine(g, { text: it.q, sp: it.sp[0], label: 'Q', marks: [['Where', 'key']] }, { x: 560, y: 200, size: 26, at: 18.2, u });
        const at = [19.4, 20.6, 21.8], vAt = [28.4, 22.8, 25.0], note = ['장소를 말했어요', '때 → 종류가 달라요', 'Yes · No → 맞지 않아요'];
        it.opts.forEach((o, k) => {
          const j = LP.judge2(it, k);
          voiceLine(g, P2line(it, k, { marks: [[o.cue, 'cue']] }), { x: 560, y: 286 + k * 70, size: 25, at: at[k], u, roleAt: vAt[k] - 0.4,
            strike: j.s === 'ok' ? null : vAt[k], verdict: { ok: j.s === 'ok', at: vAt[k], note: note[k] } });
        });
      });
    },

    /* 05 들린 단어: 같은 단어(sales) · 비슷한 소리(contract · contact) */
    heard(g, u) {
      const first = u < 17.8, ex = first ? LP.EX.sales : LP.EX.contract, base = first ? 6.2 : 18.2;
      const a = first ? ramp(u, 5.8, 0.5) * (1 - ramp(u, 17.3, 0.4)) : ramp(u, 17.9, 0.5);
      fade(g, ramp(u, 0.6, 0.5) * (1 - ramp(u, 5.6, 0.4)), () => {
        txt(g, '귀에 걸린 낱말 = 정답?', W / 2, 290, { size: 40, weight: 800, fam: FD, align: 'center' });
        txt(g, '같은 낱말 · 비슷한 소리는 함정으로 자주 쓰여요', W / 2, 350, { size: 22, weight: 600, color: COL.trap, align: 'center' });
      });
      fade(g, a, () => {
        const o0 = ex.opts[0], tw0 = (o0.same || o0.sound);
        const LQ = voiceLine(g, { text: ex.q, sp: ex.sp[0], label: 'Q', marks: [[tw0[0], 'trap']] }, { x: LX, y: 186, size: 27, at: base, u, roleAt: base + 2.8 });
        const LA = voiceLine(g, { text: o0.t, sp: ex.sp[1], label: '(A)', marks: [[tw0[1], 'trap']] }, { x: LX, y: 262, size: 27, at: base + 1.6, u, roleAt: base + 2.8,
          strike: base + 4.2, verdict: { ok: false, at: base + 4.2, note: o0.same ? '같은 낱말일 뿐이에요' : '소리만 비슷해요' } });
        if (u >= base + 3.0) {
          const q = byText(LQ, tw0[0]), r = byText(LA, tw0[1]);
          if (q && r) fade(g, ramp(u, base + 3.0, 0.5), () => { g.save(); g.setLineDash([6, 5]); g.strokeStyle = COL.trap; g.lineWidth = 2; g.beginPath(); g.moveTo(q.x + q.w / 2, q.y + 18); g.quadraticCurveTo((q.x + r.x) / 2 + 60, (q.y + r.y) / 2, r.x + r.w / 2, r.y - 18); g.stroke(); g.restore(); });
        }
        const bAt = first ? 9.8 : 24.2;
        voiceLine(g, { text: ex.opts[1].t, sp: ex.sp[1], label: '(B)', marks: [['Yes', 'ok']] }, { x: LX, y: 334, size: 27, at: bAt, u, verdict: { ok: LP.judge2(ex, 1).s === 'ok', at: bAt + 1.4, note: '질문에 맞게 답했어요' } });
      });
      [['contract', 'contact'], ['copy', 'coffee'], ['lunch', 'launch']].forEach(([x1, x2], i) => soundCard(g, LX + i * 380, 440, 350, x1, x2, u, 12.4 + i * 1.2));
      fade(g, ramp(u, 28.2, 0.5), () => tag(g, '같은 낱말 · 비슷한 소리 → 한 번 더 의심하고, 대답이 되는지 확인', LX, 540, COL.accent));
    },

    /* 06 돌려 말하는 정답: 바로 답 · 간접 응답 다섯 갈래 */
    indirect(g, u) {
      const ex = LP.EX.budget;
      fade(g, ramp(u, 0.4, 0.5), () => voiceLine(g, { text: ex.q, sp: ex.sp[0], label: 'Q', marks: [['When', 'key']] }, { x: LX, y: 172, size: 27, at: 0.6, u }));
      fade(g, ramp(u, 2.0, 0.5), () => voiceLine(g, { text: ex.opts[0].t, sp: ex.sp[1], marks: [['three o\'clock', 'cue']] }, { x: LX, y: 238, size: 25, at: 2.2, u, verdict: { ok: LP.judge2(ex, 0).s === 'ok', at: 3.6, note: '바로 답 (때)' } }));
      fade(g, ramp(u, 6.2, 0.5), () => voiceLine(g, { text: ex.opts[1].t, sp: ex.sp[1], marks: [['e-mail', 'ok']] }, { x: LX, y: 298, size: 25, at: 6.4, u, verdict: { ok: LP.judge2(ex, 1).s === 'ok', at: 8.8, note: '간접 응답 → 이메일에 시간이 있다는 뜻' } }));
      fade(g, ramp(u, 12.2, 0.5), () => tag(g, '간접 응답 = 돌려 말한 정답 · 대화가 이어지면 OK', W - 80, 112, COL.clause, { align: 'right' }));
      const cards = [[2, 18.2], [3, 19.4], [4, 20.6], [5, 24.2], [6, 25.4]];
      cards.forEach(([k, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const o = ex.opts[k], x = LX + (i % 3) * 380, y = 368 + Math.floor(i / 3) * 100, j = LP.judge2(ex, k);
        panel(g, x, y, 360, 84, { fill: COL.panel, stroke: COL.clause, r: 12 });
        txt(g, LP.KIND[o.kind], x + 18, y + 24, { size: 15, weight: 700, color: COL.clause });
        txt(g, o.t, x + 18, y + 58, { size: fit(g, o.t, 21, 290, 600), weight: 600, color: COL.en });
        mark(g, j.s === 'ok', x + 334, y + 26, 14);
        listen(x, y, 360, 84, [{ text: o.t, sp: ex.sp[1] }]);
      }));
      fade(g, ramp(u, 28.2, 0.5), () => {
        panel(g, LX + 760, 468, 360, 84, { fill: COL.panel2, stroke: COL.accent, r: 12 });
        txt(g, '어떤 질문에도 올 수 있어요', LX + 780, 494, { size: 18, weight: 700, color: COL.accent });
        txt(g, '엉뚱하다고 바로 지우지 않기', LX + 780, 528, { size: 17, weight: 600, color: COL.soft });
      });
    },

    /* 07 질문이 아닌 말: 평서문 · 제안 · 선택 */
    notq(g, u) {
      const P = [
        { ex: LP.EX.jam, head: '평서문 → 해결책 · 맞장구', at: 0.4, ans: [[0, 6.4, 8.2, '해결책'], [1, 9.0, 10.4, '같은 단어 → 탈락']] },
        { ex: LP.EX.brk, head: '제안 → 좋다 · 싫다', at: 12.2, ans: [[0, 18.4, 19.6, '받아들였어요'], [1, 20.4, 21.8, '까닭 → 엉뚱한 종류']], note: ['Why → 이유가 아니라 제안', 14.4] },
        { ex: LP.EX.tea, head: '선택 → 하나 · 둘 다 · 다른 것', at: 24.2, ans: [[0, 26.4, 27.4, '둘 다 좋음'], [1, 27.8, 28.8, '다른 것'], [2, 30.4, 31.6, 'Yes · No → 탈락']], note: ['A or B → 고르기', 25.8] },
      ];
      P.forEach((p, i) => fade(g, ramp(u, p.at, 0.6), () => {
        const x = LX + i * 380, ex = p.ex;
        panel(g, x, 146, 360, 424, { fill: COL.panel, stroke: COL.faint });
        txt(g, p.head, x + 20, 176, { size: 18, weight: 700, color: COL.accent });
        voiceLine(g, { text: ex.q, sp: ex.sp[0], marks: [[ex.pt === 'stmt' ? '' : ex.first, 'key']] }, { x: x + 18, y: 226, size: 22, at: p.at + 0.4, u, waveW: 0, maxW: 300 });
        if (p.note) fade(g, ramp(u, p.note[1], 0.5), () => tag(g, p.note[0], x + 20, 298, COL.rel, { size: 15, h: 30 }));
        p.ans.forEach(([k, at, vAt, note], r) => {
          const j = LP.judge2(ex, k), y = 352 + r * 72;
          voiceLine(g, { text: ex.opts[k].t, sp: ex.sp[1], marks: [] }, { x: x + 18, y, size: 21, at, u, waveW: 0, maxW: 280,
            strike: j.s === 'ok' ? null : vAt, verdict: { ok: j.s === 'ok', at: vAt } });
          fade(g, ramp(u, vAt, 0.4), () => txt(g, note, x + 56, y + 29, { size: 15, weight: 700, color: j.s === 'ok' ? COL.good : COL.trap }));
        });
      }));
    },

    /* 08 Yes · No는 사실을 따른다: 한국어 네/아니요 ↔ 영어 Yes/No 표 */
    yesno(g, u) {
      const ex = LP.EX.client, pick = S.yn, live = pick ? 1 : 0;
      fade(g, ramp(u, 0.4, 0.5), () => voiceLine(g, { text: ex.q, sp: ex.sp[0], label: 'Q', marks: [['Didn\'t you', 'key']] }, { x: LX, y: 166, size: 28, at: pick ? -99 : 0.8, u }));
      fade(g, live || ramp(u, 3.4, 0.5), () => pieces(g, [['한국어 → ', COL.muted], ['고객에게 전화 ', COL.soft], ['안', COL.trap, true], [' 했어요?', COL.soft]], 660, 166, 22));
      const cols = [{ x: 440, did: true, k: 'did', head: '사실: 전화했다', ko: [['아니요', COL.trap], [', 했어요.', COL.text]], koNote: '아니요 → 질문(안 했어요?)이 틀렸다', en: 0 },
        { x: 830, did: false, k: 'didnt', head: '사실: 안 했다', ko: [['네', COL.trap], [', 안 했어요.', COL.text]], koNote: '네 → 질문(안 했어요?)이 맞다', en: 1 }];
      fade(g, live || ramp(u, 6.0, 0.5), () => { label(g, '한국어 대답', LX, 314, { color: COL.soft, size: 19 }); label(g, '영어 대답', LX, 404, { color: COL.soft, size: 19 }); });
      cols.forEach((c, i) => {
        const dim = pick && pick !== c.k ? 0.3 : 1;
        fade(g, (live || ramp(u, 6.0 + i * 0.4, 0.5)) * dim, () => {
          panel(g, c.x, 232, 370, 228, { fill: COL.panel, stroke: pick === c.k ? COL.accent : COL.faint, lw: pick === c.k ? 2.5 : 1.5 });
          txt(g, c.head, c.x + 185, 258, { size: 19, weight: 700, color: COL.ante, align: 'center' });
          fade(g, live || ramp(u, 6.6 + i * 2.4, 0.5), () => { pieces(g, c.ko, c.x + 22, 312, 24); txt(g, c.koNote, c.x + 22, 342, { size: 13, weight: 600, color: COL.muted }); });
          const o = ex.opts[c.en], j = LP.judge2(ex, c.en);
          voiceLine(g, { text: o.t, sp: ex.sp[1], marks: [[o.yn === 'yes' ? 'Yes' : 'No', 'ok']] }, { x: c.x + 14, y: 402, size: 18, at: pick ? -99 : 12.4 + i * 2.4, u, waveW: 0, maxW: 340, verdict: { ok: j.s === 'ok', at: pick ? -99 : 13.8 + i * 2.4 } });
          fade(g, live || ramp(u, 18.4, 0.5), () => txt(g, c.did ? 'Yes → 했다' : 'No → 안 했다', c.x + 22, 436, { size: 15, weight: 700, color: COL.clause }));
        });
      });
      fade(g, (live || ramp(u, 18.2, 0.5)) * (1 - ramp(u, 23.8, 0.4)), () => tag(g, 'Yes → 했다 · No → 안 했다 · 질문의 꼴이 아니라 사실을 따라요', LX, 498, COL.accent));
      fade(g, ramp(u, 24.2, 0.5), () => {
        const j = LP.judge2(ex, 2);
        voiceLine(g, { text: ex.opts[2].t, sp: ex.sp[1], label: '함정', marks: [['No', 'trap'], ['called her', 'trap']] }, { x: LX, y: 498, size: 22, at: 24.4, u, waveW: 30,
          strike: 26.2, verdict: { ok: j.s === 'ok', at: 26.2, note: 'No(안 했다) + 했다 → 앞뒤가 안 맞아요' } });
      });
      fade(g, ramp(u, 29.2, 0.5), () => {
        const d = LP.EX.dinner, w = pieces(g, [[d.q, COL.en, false, 600]], LX, 554, 18, { play: [{ text: d.q, sp: d.sp[0] }] });
        txt(g, '→', LX + w + 12, 554, { size: 18, weight: 700, color: COL.muted });
        pieces(g, [[d.opts[0].t, COL.good, false, 700]], LX + w + 40, 554, 18, { play: [{ text: d.opts[0].t, sp: d.sp[1] }] });
      });
    },

    /* 09 3단계 풀이법 (Part 1 · Part 2). 직접 해 보기로 첫 단어를 고르면 기대하는 답이 켜짐 */
    method(g, u) {
      const rows = [
        { at: 5.4, nm: 'Part 1', c: COL.clause, boxes: [['① 주인공', '사람? 사물?', '주어가 사진에 없으면 ×'], ['② 동작 · 상태', 'is ~ing · is wearing · has been p.p.', 'being p.p. = 사람이 지금 하는 중'], ['③ 없는 말', '문장 속 물건 ↔ 사진', '비슷한 소리 조심']] },
        { at: 11.4, nm: 'Part 2', c: COL.ante, boxes: [['① 첫 단어', '의문사 · 조동사 · 제안 · 선택 · 평서문', '→ 기대하는 답의 종류'], ['② 함정 지우기', '엉뚱한 종류 · 같은 단어', '비슷한 소리 → 탈락'], ['③ 말이 되나', 'Yes · No와 뒷말이 맞나', '돌려 말한 답도 정답']] },
      ];
      const F = S.first ? LP.FIRSTS.find(f => f.id === S.first) : null;
      rows.forEach((r, ri) => {
        const y0 = 150 + ri * 172;
        fade(g, F ? 1 : ramp(u, r.at, 0.6), () => { chip(g, r.nm, LX, y0 + 70, { size: 20, weight: 800, color: r.c, fill: COL.panel2, stroke: r.c, h: 44, r: 12 }); });
        r.boxes.forEach(([h, t1, t2], k) => {
          const x0 = 220 + k * 336, lit = F && ri === 1 && k === 0;
          fade(g, (F ? 1 : ramp(u, r.at + 0.4 + k * 0.5, 0.5)) * (F && !lit ? 0.45 : 1), () => {
            panel(g, x0, y0, 316, 140, { fill: lit ? 'rgba(255,193,94,0.12)' : COL.panel, stroke: lit ? COL.rel : COL.faint, lw: lit ? 2.5 : 1.5 });
            txt(g, h, x0 + 20, y0 + 34, { size: 23, weight: 700, fam: FD, color: COL.accent });
            txt(g, t1, x0 + 20, y0 + 80, { size: fit(g, t1, 17, 280, 600), weight: 600, color: COL.soft });
            txt(g, t2, x0 + 20, y0 + 110, { size: fit(g, t2, 17, 280, 600), weight: 600, color: COL.en });
            if (k < 2) arrow(g, x0 + 318, y0 + 70, x0 + 334, y0 + 70, COL.accent, 2.5);
          });
        });
      });
      if (F) {
        const exp = LP.expect(F.it).map(k => LP.KIND[k]).join(' · ');
        panel(g, LX, 494, 1140, 80, { fill: COL.panel2, stroke: COL.rel, r: 12 });
        txt(g, `${F.label} → ${LP.PT[F.it.pt].name}${F.it.pt === 'wh' ? ' · ' + LP.WH[F.it.wh].ask + '을 물어요' : ''}`.replace('장소을', '장소를').replace('때을', '때를').replace('까닭을', '까닭을'), LX + 22, 518, { size: 18, weight: 700, color: COL.rel });
        const s2 = `기대하는 답: ${exp}   ·   언제나 됨(간접 응답): 모른다 · 넘기기 · 되묻기 · 확인하기 · 상황 알리기`;
        txt(g, s2, LX + 22, 550, { size: fit(g, s2, 17, 1100, 600), weight: 600, color: COL.soft });
      } else {
        fade(g, ramp(u, 17.6, 0.5), () => tag(g, '함정 → 엉뚱한 종류 · 같은 단어 · 비슷한 소리', LX, 530, COL.trap));
        fade(g, ramp(u, 19.2, 0.5), () => tag(g, '남겨요 → 돌려 말한 답 (간접 응답)', 760, 530, COL.clause));
      }
    },

    /* 10 실전 문제 세 개 */
    practice(g, u) {
      const SEG = [0, 18.2, 37.2, 56];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const P = PRACTICE[pi], it = LP.DRILL[P.k], part1 = it.part === 1;
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      const L = 'ABCD';
      // 보기마다 지워지는 때: 단계 시각 + 같은 단계 안에서 차례로
      const goneAt = k => { const j = LP.judgeOpt(it, k); if (!j.step) return null; const same = it.opts.map((_, i) => i).filter(i => LP.judgeOpt(it, i).step === j.step); return P.x[j.step - 1] + same.indexOf(k) * 1.3; };
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3 · Part ${it.part}`, LX, 158, { size: 16, weight: 500, fam: FM, color: COL.accent });
        if (part1) {
          const ph = LP.PHOTO[it.photo], miss = [];
          it.opts.forEach(o => o.obj.forEach(ob => { if (!ph.people.concat(ph.things).includes(ob) && v >= P.x[2]) miss.push(ob); }));
          if (!ph.people.length && v >= P.x[1]) miss.push('person');
          photo(g, it.photo, LX, 180, 360, 255, { ring: v >= P.at[0] + 0.6, ringA: ramp(v, P.at[0] + 0.6, 0.5), ghost: miss });
          it.opts.forEach((o, k) => {
            const gA = goneAt(k), win = k === it.a && v >= P.win, jj = LP.judge1(o, it.photo);
            const role = itm => {
              if (itm.r === 'who') return v >= P.at[0] + 0.6 ? (jj.step === 1 ? 'trap' : 'who') : '';
              if (itm.r === 'act' || itm.r === 'state') return v >= P.at[1] + 0.6 ? (jj.step === 2 ? 'trap' : itm.r) : '';
              if (itm.r === 'obj' || itm.r === 'trap') return v >= P.at[2] + 0.6 ? itm.r : '';
              return '';
            };
            voiceLine(g, stLine(o, it.sp, `(${L[k]})`, ph), { x: 470, y: 214 + k * 58, size: 22, at: 0.6 + k * 1.1, u: v, waveW: 30, maxW: 740, role,
              strike: gA, verdict: gA != null ? { ok: false, at: gA } : win ? { ok: true, at: P.win } : null });
          });
        } else {
          voiceLine(g, { text: it.q, sp: it.sp[0], label: 'Q', marks: [[it.first, 'key']] }, { x: LX, y: 212, size: 26, at: 0.6, u: v, roleAt: P.at[0] + 0.6 });
          const ats = [2.6, 3.8, 5.2];
          it.opts.forEach((o, k) => {
            const gA = goneAt(k), win = k === it.a && v >= P.win;
            const tm = o.same || o.sound, marks = tm && gA != null ? [[tm[1], 'trap']] : [];
            if (o.cue && gA != null) marks.push([o.cue, 'cue']);
            if (k === it.a) marks.push([o.t, 'ok']);
            voiceLine(g, { text: o.t, sp: it.sp[1], label: `(${L[k]})`, marks }, { x: LX, y: 284 + k * 56, size: 24, at: ats[k], u: v, maxW: 1100,
              role: itm => itm.r === 'ok' ? (win ? 'ok' : '') : (gA != null && v >= gA - 0.6 ? itm.r : ''),
              strike: gA, verdict: gA != null ? { ok: false, at: gA } : win ? { ok: true, at: P.win } : null });
          });
        }
        panel(g, LX, 452, 1140, 124, { fill: COL.panel, stroke: COL.faint });
        const heads = part1 ? ['① 주인공', '② 동작 · 상태', '③ 없는 말'] : ['① 첫 단어', '② 함정 지우기', '③ 말이 되나'];
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = 476 + k * 37;
          txt(g, heads[k], LX + 22, y, { size: 17, weight: 700, color: COL.accent });
          txt(g, ln, LX + 190, y, { size: fit(g, ln, 18, 930, 600), weight: 600, color: k === 2 && v >= P.win ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 420, 800], Y0 = 150, RH = 41;
      const rows = [
        ['Part 1 · 사람이 주인공', '동작 is ~ing · 상태 is wearing', 'is putting on · is wearing', COL.rel],
        ['Part 1 · 사물이 주인공', '상태 has been p.p. · 놓인 모양', 'have been stacked · are lined up', COL.clause],
        ['Part 1 · being p.p.', '사람이 지금 하는 중일 때만', 'are being stacked', COL.rel],
        ['Part 1 · 없는 말', '물건 하나라도 사진에 없으면 ×', 'copies ↔ coffee', COL.trap],
        ['Part 2 · 의문사', '첫 단어 → 답의 종류', 'Where → 장소 · When → 때', COL.rel],
        ['Part 2 · 제안 · 선택 · 평서문', '좋다 · 싫다 · 고르기 · 해결책', 'Why don\'t we …? → Good idea.', COL.rel],
        ['Part 2 · 부정 · 꼬리 질문', 'Yes = 했다 · No = 안 했다', 'Didn\'t you …? → Yes, I did.', COL.clause],
        ['Part 2 · 함정과 간접 응답', '같은 단어 · 비슷한 소리 × · 돌려 말한 답 ✓', 'Didn\'t you get the e-mail?', COL.clause],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 12, { fill: COL.panel, stroke: COL.faint });
        ['어디서 · 무엇', '들을 것', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 18, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 4, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.5, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 18;
        txt(g, r[0], X[0] + 20, y, { size: fit(g, r[0], 18, X[1] - X[0] - 30, 600), weight: 600 });
        txt(g, r[1], X[1] + 20, y, { size: fit(g, r[1], 18, X[2] - X[1] - 30, 700), weight: 700, color: r[3] });
        txt(g, r[2], X[2] + 20, y, { size: fit(g, r[2], 18, 1200 - X[2] - 30, 500), weight: 500, color: COL.en });
        if (!/↔|→/.test(r[2])) say(X[2] + 14, y - 18, 380, 36, r[2].replace(/ · /g, ', ').replace(/…/g, ''));
      }));
      fade(g, ramp(u, 6.2, 0.5), () => tag(g, 'Part 1 → 주인공 · 동작/상태 · 없는 말', LX, 556, COL.clause));
      fade(g, ramp(u, 6.8, 0.5), () => tag(g, 'Part 2 → 첫 단어 · 함정 · 말이 되나', 640, 556, COL.ante));
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

  LPS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[LPS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, LPS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + LP.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔✓×?~=+-/:…‘’\'%';
  LPS.baseText = EXTRA;
  LPS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = LPS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { LPS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
  LPS.checkPhotos();
})();
