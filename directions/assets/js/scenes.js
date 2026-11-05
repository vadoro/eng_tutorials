/* 길 묻기 회화 — 영상 장면
 *
 * DRS.render(g, t)는 시각 t와 사용자 상태 DRS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준, 내용은 y 580 위.
 *
 * 그림 말: 길 묻기의 일곱 단계(01장은 길을 따라 걷는 큰 그림 · 02–07장은 위쪽 작은 띠), 지어낸 동네 지도(DR.TOWN —
 * 길 · 블록 · 건물 아이콘 · 신호등 · 횡단보도 · 버스 정류장), 걷는 사람(바라보는 쪽 화살표)과 계산된 길(DR.route),
 * 말풍선(길을 알려 주는 사람 왼쪽 · 나 오른쪽), 되짚는 줄은 틀(노랑) + 조각(민트) 낱말 조각으로 만들고(lay · morph),
 * 함정은 줄을 긋고 주황 이름표로 까닭을 붙여요.
 * 역할 색: 열쇠 낱말 하늘 · 대답 틀 노랑 · 내 정보(들은 조각 · 곳 이름) 민트 · 공손한 말 보라 · 함정 주황 · 빈칸 분홍 점선
 * 맞고 틀림, 길, 방향, 관계는 모두 grammar.js의 규칙 엔진(DR.judge · DR.route · DR.checkBack · DR.where)으로 정합니다.
 * MP4에는 소리가 없어서, 말은 말풍선 속 낱말이 하나씩 나타나는 모습으로 그려요. 페이지에서는 말풍선을 누르면 그 사람 목소리로 들려줘요.
 */
(function () {
  'use strict';
  const DR = window.DR;
  const DRS = (window.DRS = {});
  const W = 1280, H = 720;
  DRS.W = W; DRS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  DRS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', paper: '#F4F1E8', ink: '#1E2630', road: '#2B3643', block: '#19222D', parkG: '#1D3529',
  };
  DRS.COL = COL;
  // 역할 → 색 (낱말 조각 · 말풍선 글)
  const RC = { key: COL.ante, frame: COL.rel, slot: COL.clause, pol: COL.verb, trap: COL.trap, ok: COL.good, dim: COL.dim, bad: COL.bad };
  DRS.RC = RC;
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8', me: '#F2C29A' };
  const SHC = { yn: COL.ante, or: COL.rel, wh: COL.clause, note: COL.verb };
  DRS.SHC = SHC;
  // 조각 종류의 색 (동작 · 기준점 · 위치 · 교통) — 모두 ‘들을 때 잡는 열쇠 낱말’이라 하늘색 계열의 이름표로, 글은 민트
  const KIND_IC = { 동작: 'move', 위치: 'mark', 교통: 'far' };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (DRS.S = { stop: null, greet: null, move: null, rel: null, bus: null, check: null, place: null });
  DRS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  DRS.hits = () => HITS;

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
  function mark(g, ok, x, y, s = 16) { (ok ? check : cross)(g, x, y, s, ok ? COL.good : COL.bad); }
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
  const say = (x, y, w, h, text) => HITS.push({ x, y, w, h, say: text });
  const listen = (x, y, w, h, seq) => HITS.push({ x, y, w, h, play: seq });
  const thought = (g, s, x, y, w) => {   // 한국어로 먼저 떠올린 말 (점선 구름)
    panel(g, x, y, w, 50, { fill: 'rgba(242,194,154,0.08)', stroke: 'rgba(242,194,154,0.5)', dash: true, r: 25 });
    txt(g, s, x + w / 2, y + 26, { size: fit(g, s, 20, w - 30, 600), weight: 600, color: '#F2C29A', align: 'center' });
  };

  /* =========================================================
     아이콘 — 24×24 격자의 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요
     [길, 'f'(채움) | 's'(선)]. 단계 일곱 + 건물 + 질문의 모양 넷
     ========================================================= */
  const ICON = {
    // 단계
    greet: [['M8.5 20.5c-2-1.6-3.5-4-3.5-6.5v-2.5a1.3 1.3 0 0 1 2.6 0V13', 's'], ['M7.6 12.5V6a1.3 1.3 0 0 1 2.6 0v5.5M10.2 11V4.5a1.3 1.3 0 0 1 2.6 0V11M12.8 11V5.5a1.3 1.3 0 0 1 2.6 0V12M15.4 12V8a1.3 1.3 0 0 1 2.6 0v6c0 3.5-2 6.5-5.5 6.5h-4', 's']],
    ask: [['M4 5h16v11h-7l-4 4v-4H4z', 's'], ['M10 8.6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3', 's'], ['M12 13.6h.01', 's']],
    move: [['M6 20v-7a4 4 0 0 1 4-4h8', 's'], ['M15 5.5 18.5 9 15 12.5', 's']],
    mark: [['M12 21s-6.5-5.8-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z', 's'], ['M12 8a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z', 's']],
    far: [['M5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 15.5v-10A1.5 1.5 0 0 1 5.5 4z', 's'], ['M4 11h16M8 17v2.5M16 17v2.5', 's'], ['M7.5 14h.01M16.5 14h.01', 's']],
    check: [['M4.5 12a7.5 7.5 0 0 1 13-5.1', 's'], ['M17.8 3.5v3.7h-3.7', 's'], ['M19.5 12a7.5 7.5 0 0 1-13 5.1', 's'], ['M6.2 20.5v-3.7h3.7', 's']],
    thanks: [['M12 20s-7.5-4.6-7.5-10a4.2 4.2 0 0 1 7.5-2.6A4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z', 's']],
    // 건물
    bank: [['M3 10l9-6 9 6', 's'], ['M5 10h14v9H5z', 's'], ['M3.5 20h17', 's'], ['M13.6 12.6c-.4-.5-1-.8-1.6-.8-.9 0-1.6.5-1.6 1.1 0 1.5 3.3.8 3.3 2.4 0 .7-.8 1.2-1.7 1.2-.7 0-1.3-.3-1.7-.8M12 11.2v.7M12 16.6v.7', 's']],
    postoffice: [['M3.5 6.5h17v11h-17z', 's'], ['M3.5 7.2 12 13l8.5-5.8', 's']],
    cafe: [['M5 9.5h11v4.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z', 's'], ['M16 10.5h1.2a2.4 2.4 0 0 1 0 4.8H16', 's'], ['M8.5 3.5v3M12.5 3.5v3', 's']],
    library: [['M4 5.5c2.6-1 5.2-.8 8 1 2.8-1.8 5.4-2 8-1v13c-2.6-1-5.2-.8-8 1-2.8-1.8-5.4-2-8-1z', 's'], ['M12 6.5v13', 's']],
    hotel: [['M3 18.5V7.5', 's'], ['M3 14.5h18v4M21 14.5v-2a3 3 0 0 0-3-3h-7v5', 's'], ['M5.5 12.2h3', 's']],
    school: [['M2.5 9.5 12 5l9.5 4.5L12 14z', 's'], ['M6.5 11.6v4c3 2.2 8 2.2 11 0v-4', 's'], ['M21 10v4.5', 's']],
    church: [['M12 2.8v4M10.2 4.6h3.6', 's'], ['M6.5 21v-9.5L12 7.5l5.5 4v9.5z', 's'], ['M10.5 21v-4h3v4', 's']],
    bakery: [['M4.5 18.5h15', 's'], ['M5.6 18.5C4.4 13.5 7 9 12 9s7.6 4.5 6.4 9.5', 's'], ['M10 11.5l-1 3M13.6 11.5l-1 3', 's']],
    flowershop: [['M8 5.5l2 3 2-3 2 3 2-3v4.5a4 4 0 0 1-8 0z', 's'], ['M12 14v7', 's'], ['M12 18.2c-1.8-1.9-3.8-2-5-1.2M12 17.4c1.8-1.9 3.8-2 5-1.2', 's']],
    police: [['M12 3.5 19 6v5c0 4.5-3 8-7 9.5C8 19 5 15.5 5 11V6z', 's'], ['M12 8.5l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z', 's']],
    park: [['M12 21v-6.5', 's'], ['M12 3a5 5 0 0 0-5 5c0 3.2 2.3 5.5 5 5.5s5-2.3 5-5.5a5 5 0 0 0-5-5z', 's'], ['M12 17l-2.5-2', 's']],
    trainstation: [['M7 3.5h10a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z', 's'], ['M5 10h14', 's'], ['M8.5 13.5h.01M15.5 13.5h.01', 's'], ['M8 17l-2 3.5M16 17l2 3.5', 's']],
    subway: [['M3.5 19.5h4v-4h4v-4h4v-4h5', 's'], ['M5 7.5v5M3 10.5l2 2 2-2', 's']],
    pharmacy: [['M7.4 16.6a3.2 3.2 0 0 1 0-4.5L12 7.5a3.2 3.2 0 0 1 4.5 4.5L12 16.6a3.2 3.2 0 0 1-4.6 0z', 's'], ['M9.7 9.8l4.5 4.5', 's']],
    hospital: [['M4.5 4.5h15v15h-15z', 's'], ['M9 8.5v7M15 8.5v7M9 12h6', 's']],
    supermarket: [['M3 4.5h2.5l2 10h10l2-7H7', 's'], ['M9.5 19a1.2 1.2 0 1 0 0-.01M16.5 19a1.2 1.2 0 1 0 0-.01', 's']],
    convenience: [['M4.5 10h15v10h-15z', 's'], ['M3.5 10l1.6-4.5h13.8l1.6 4.5', 's'], ['M10 20v-5h4v5', 's'], ['M8 10v1.4a2 2 0 0 1-4 0M12 10v1.4a2 2 0 0 1-4 0M16 10v1.4a2 2 0 0 1-4 0M20 10v1.4a2 2 0 0 1-4 0', 's']],
    gasstation: [['M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20', 's'], ['M3.5 20h12M5 10h9', 's'], ['M14 8h2l2.5 2.5v6a1.5 1.5 0 0 0 3 0V9.5L19 7', 's']],
    museum: [['M3 8.5 12 4l9 4.5z', 's'], ['M5.5 10.5v7M9.8 10.5v7M14.2 10.5v7M18.5 10.5v7', 's'], ['M3.5 19.5h17', 's']],
    restroom: [['M7.5 4.5a1.6 1.6 0 1 0 0 .01M16.5 4.5a1.6 1.6 0 1 0 0 .01', 's'], ['M6 20v-5.5L5.5 9h4L9 14.5V20M14.5 20v-5.5L13 9h7l-1.5 5.5V20', 's'], ['M12 3.5v17', 's']],
    crosswalk: [['M5 4v16M9.7 4v16M14.3 4v16M19 4v16', 's']],
    lights: [['M9 2.8h6v18.4H9z', 's'], ['M12 6.5a1.6 1.6 0 1 0 0 .01M12 12a1.6 1.6 0 1 0 0 .01M12 17.5a1.6 1.6 0 1 0 0 .01', 's']],
    intersection: [['M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6', 's']],
    bus: [['M5.5 3.5h13A1.5 1.5 0 0 1 20 5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16V5a1.5 1.5 0 0 1 1.5-1.5z', 's'], ['M4 10.5h16', 's'], ['M7.5 14h.01M16.5 14h.01', 's'], ['M7 17.5v2.5M17 17.5v2.5', 's']],
    phone: [['M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3z', 's'], ['M11 18h2', 's']],
    clock: [['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', 's'], ['M12 7.5V12l3 2', 's']],
    walker: [['M13 4.5a1.6 1.6 0 1 0 0 .01', 's'], ['M10 21l2-6 2.5 2.5V21M11 10.5l2-2.5 2.5 3 2.5 1M13 8l-1 6.5M10.5 9.5 8 12', 's']],
    exit: [['M4.5 4.5h10v15h-10z', 's'], ['M11 12h9M17 8.5l3 3.5-3 3.5', 's']],
    // 질문의 모양 (식당과 같은 길)
    shape_yn: [['M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8z', 's'], ['M14.4 12a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0z', 'f']],
    shape_or: [['M12 21.5V14', 's'], ['M12 14 6 8M12 14l6-6', 's'], ['M6 8v4.4M6 8h4.4', 's'], ['M18 8v4.4M18 8h-4.4', 's']],
    shape_wh: [['M3.5 6.5h17v11h-17z', 's'], ['M8 14h8', 's']],
    shape_note: [['M4.5 5h15v10h-8l-4 3.8V15h-3z', 's'], ['M9 10h.01M12 10h.01M15 10h.01', 's']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z', 's'], ['M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6', 's']],
  };
  DRS.ICON = ICON;
  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = (typeof Path2D === 'function' ? new Path2D(d) : null));
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const parts = ICON[id]; if (!parts) return;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach(([d, m]) => { const p = path(d); if (!p) return; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  DRS.icon = icon;
  // HTML용 SVG (색은 currentColor)
  DRS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 질문의 모양 표시 (식당 튜토리얼과 같은 그림) ---------- */
  function shapeMark(g, shape, cx, cy, size, o = {}) {
    const c = o.color || SHC[shape];
    if (o.disc !== false) { circ(g, cx, cy, size * 0.72, o.fill || COL.panel2); ring(g, cx, cy, size * 0.72, c, o.lw || 2); }
    icon(g, 'shape_' + shape, cx, cy, size, c, o.iw || 2);
  }
  DRS.shapeMark = shapeMark;

  /* ---------- 사람 얼굴 (말풍선 옆). kind: local(길에서 만난 사람) · cap(모자) · tourist(관광객) · uk(목도리) · me ---------- */
  const LOOK = {
    local: { shirt: '#3E5A7A', hair: '#2B2420', skin: '#D9A57C', bag: '#B08B62' },
    cap: { shirt: '#4A6A4A', hair: '#1F1B18', skin: '#C99169', cap: '#B8432B' },
    tourist: { shirt: '#7A5A3A', hair: '#5A3A28', skin: '#E8BC95', cam: true },
    uk: { shirt: '#3A2E4A', hair: '#5A3A28', skin: '#E8BC95', scarf: '#B8432B' },
    me: { shirt: '#5D6FA8', hair: '#1F1B18', skin: '#E8BC95', pack: '#3A2C22' },
  };
  const kindOf = q => { q = typeof q === 'string' ? DR.Q[q] : q; return q.sp === 'gb' ? 'uk' : q.sp === 'au' ? 'tourist' : q.sp === 'ca' ? 'cap' : 'local'; };
  DRS.kindOf = kindOf;
  function avatar(g, x, y, r, kind, o = {}) {
    const L = LOOK[kind] || LOOK.local;
    circ(g, x, y, r, COL.panel2);
    g.save(); g.beginPath(); g.arc(x, y, r - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = L.shirt; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
    if (L.pack || L.bag) { g.strokeStyle = L.pack || L.bag; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - r * 0.42, y + r * 0.45); g.lineTo(x - r * 0.5, y + r); if (L.pack) { g.moveTo(x + r * 0.42, y + r * 0.45); g.lineTo(x + r * 0.5, y + r); } g.stroke(); }
    if (L.scarf) { g.fillStyle = L.scarf; rr(g, x - r * 0.32, y + r * 0.32, r * 0.64, r * 0.16, r * 0.06); g.fill(); g.fillRect(x + r * 0.08, y + r * 0.4, r * 0.14, r * 0.34); }
    if (L.cam) { g.fillStyle = '#2B2F36'; rr(g, x - r * 0.2, y + r * 0.6, r * 0.4, r * 0.24, r * 0.05); g.fill(); circ(g, x, y + r * 0.72, r * 0.07, '#9AA6AA'); }
    g.fillStyle = L.skin; g.fillRect(x - r * 0.1, y + r * 0.18, r * 0.2, r * 0.22);
    circ(g, x, y - r * 0.08, r * 0.34, L.skin);
    g.fillStyle = L.hair; g.beginPath(); g.arc(x, y - r * 0.12, r * 0.36, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
    if (L.cap) { g.fillStyle = L.cap; g.beginPath(); g.arc(x, y - r * 0.16, r * 0.37, Math.PI, 0); g.closePath(); g.fill(); g.fillRect(x, y - r * 0.2, r * 0.5, r * 0.08); }
    circ(g, x - r * 0.12, y - r * 0.04, r * 0.035, '#2B2420'); circ(g, x + r * 0.12, y - r * 0.04, r * 0.035, '#2B2420');
    g.strokeStyle = 'rgba(120,60,40,0.6)'; g.lineWidth = Math.max(1, r * 0.045); g.beginPath(); g.arc(x, y + r * 0.06, r * 0.1, 0.35, Math.PI - 0.35); g.stroke();
    g.restore();
    ring(g, x, y, r, o.live ? (SPC[o.sp] || COL.soft) : COL.faint, o.live ? 2.6 : 1.5);
    if (o.live) { g.save(); g.globalAlpha *= 0.45; ring(g, x, y, r + 5, SPC[o.sp] || COL.soft, 2); g.restore(); }
  }
  DRS.avatar = avatar;

  /* ---------- 글 배치: 낱말 단위 줄 바꿈 + 역할 색 (말풍선 · 표) ---------- */
  function richLay(g, text, marks, size, maxW, o = {}) {
    const wt = o.weight || 500, lh = o.lh || Math.round(size * 1.42);
    const words = [];
    String(text).replace(/\S+/g, (w, s) => { const core = w.replace(/[.,?!;:”"’)]+$/, ''); words.push({ w, s, e: s + core.length, core }); return w; });
    (marks || []).forEach(mk => {
      const t = Array.isArray(mk) ? mk[0] : mk.t, role = Array.isArray(mk) ? mk[1] : mk.role;
      if (!t) return;
      let i = text.indexOf(t); if (i < 0) i = text.toLowerCase().indexOf(t.toLowerCase());
      if (i < 0) return;
      const e = i + t.length;
      words.forEach(wd => { if (wd.s < e && wd.e > i && !wd.role) wd.role = role; });
    });
    const sp = tw(g, ' ', size, wt) * (o.spread || 1), rows = [[]]; let x = 0;
    words.forEach(wd => {
      const ww = wd.role ? Math.max(600, wt) : wt;
      wd.wt = ww; wd.ww = tw(g, wd.w, size, ww); wd.cw = tw(g, wd.core, size, ww);
      const row = rows[rows.length - 1];
      if (row.length && x + sp + wd.ww > maxW) { rows.push([]); x = 0; }
      if (rows[rows.length - 1].length) x += sp;
      wd.x = x; wd.row = rows.length - 1; rows[rows.length - 1].push(wd); x += wd.ww;
    });
    const widths = rows.map(r => r.length ? r[r.length - 1].x + r[r.length - 1].ww : 0);
    return { words, rows: rows.length, lh, size, wt, h: rows.length * lh, w: Math.max(...widths), widths };
  }
  function richDraw(g, R, x, y, o = {}) {
    R.words.forEach((wd, k) => {
      const a = o.shown == null ? 1 : clamp((o.shown - k) * 3);
      if (a <= 0.001) return;
      const role = o.rolesOn === false ? null : wd.role, yy = y + wd.row * R.lh, c = role ? (RC[role] || COL.text) : (o.color || COL.text);
      fade(g, a, () => {
        txt(g, wd.w, x + wd.x, yy, { size: R.size, weight: role ? wd.wt : R.wt, color: c });
        if (role && !o.plain && role !== 'dim') {
          const nx = R.words[k + 1], join = nx && nx.role === role && nx.row === wd.row && clamp((o.shown == null ? 99 : o.shown) - k - 1) > 0;
          g.fillStyle = c; g.fillRect(x + wd.x, yy + R.size * 0.58, join ? nx.x - wd.x : wd.cw, 2.5);
        }
      });
    });
  }
  DRS.richLay = richLay; DRS.richDraw = richDraw;

  /* ---------- 낱말 조각 (대답 만들기): { id, t, r } → lay · morph · drawTok ---------- */
  const PUNCT = /^[.,?!]$/;
  function ansToks(a, o = {}) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    DR.segs(a).forEach(s => s.t.split(/\s+/).forEach(w => {
      if (!w) return;
      const m = w.match(/^(.*?)([.,?!]*)$/);
      if (m[1]) push(m[1], o.role != null ? o.role : s.r);
      if (m[2]) m[2].split('').forEach(p => push(p, ''));
    }));
    return out;
  }
  DRS.ansToks = ansToks;
  const POSR = { frame: 1, slot: 1, pol: 1, key: 1, trap: 1, ok: 1 };
  const tokW = (g, tk, size) => tk.r === 'blank' ? (tk.bw || size * 3.4) : tw(g, tk.t, size, POSR[tk.r] ? 600 : 500);
  function lay(g, toks, o) {
    const size = o.size || 26, sp = size * 0.3, maxW = o.maxW || 1e9, lh = o.lh || size * 1.5;
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
    const left = items.length ? Math.min(...items.map(i => i.x)) : o.x, right = items.length ? Math.max(...items.map(i => i.x + i.w)) : o.x;
    return { items, byId, size, lines: lines.length, lh, x: left, w: right - left, y: o.y, h: (lines.length - 1) * lh + size * 1.3 };
  }
  function drawTok(g, it, o = {}) {
    const r = o.r != null ? o.r : it.r, size = it.size, x = it.x, y = it.y, w = it.w;
    g.save(); g.globalAlpha *= o.a == null ? 1 : o.a;
    if (g.globalAlpha <= 0.002) { g.restore(); return; }
    if (r === 'blank') {
      const h = size * 1.16;
      rr(g, x, y - h / 2, w, h, 8);
      g.fillStyle = `rgba(255,122,168,${0.08 + 0.14 * (o.glow || 0)})`; g.fill();
      g.setLineDash([6, 5]); g.strokeStyle = COL.gap; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]);
      if (it.t && it.t !== '___') txt(g, it.t, x + w / 2, y + 1, { size: size * 0.62, weight: 700, color: COL.gap, align: 'center' });
    } else {
      const c = o.color || RC[r] || COL.text;
      txt(g, it.t, x, y + 1, { size, weight: POSR[r] ? 600 : 500, color: c });
      if (POSR[r] && !o.plain && !PUNCT.test(it.t)) {
        const nx = o.next;
        g.fillStyle = c; g.fillRect(x, y + size * 0.58, nx && nx.r === r && !PUNCT.test(nx.t) && Math.abs(nx.y - y) < 1 ? nx.x - x : w, 2.6);
      }
    }
    g.restore();
  }
  function drawLay(g, L, style) { L.items.forEach((it, k) => drawTok(g, it, Object.assign({ next: L.items[k + 1] }, style ? style(it) || {} : {}))); }
  function morph(g, A, B, p, o = {}) {
    const e = ease(clamp(p)), seen = new Set(), style = o.style || (() => ({}));
    const ids = A.items.map(i => i.id).concat(B.items.map(i => i.id)).filter(id => !seen.has(id) && seen.add(id));
    ids.forEach(id => {
      const a = A.byId[id], b = B.byId[id];
      if (a && b) {
        const m = Object.assign({}, b, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), w: lerp(a.w, b.w, e), size: lerp(a.size, b.size, e) });
        if (a.t === b.t && a.r === b.r) drawTok(g, m, style(b, e));
        else { drawTok(g, Object.assign({}, m, { t: a.t, r: a.r }), Object.assign({}, style(a, e), { a: 1 - e })); drawTok(g, m, Object.assign({}, style(b, e), { a: e })); }
      } else if (a) drawTok(g, a, Object.assign({}, style(a, e), { a: 1 - ramp(p, 0, 0.5) }));
      else drawTok(g, b, Object.assign({}, style(b, e), { a: ramp(p, 0.5, 0.5) }));
    });
  }

  /* ---------- 말풍선 ---------- */
  const WD = 0.26;   // 낱말 하나에 걸리는 초
  const nWords = s => String(s).split(/\s+/).filter(Boolean).length;
  function bubbleShape(g, side, bx, by, bw, bh, ax, ay, fill, stroke) {
    rr(g, bx, by, bw, bh, 16); g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke();
    const tx = side === 'L' ? bx : bx + bw, ty = clamp(ay, by + 14, by + bh - 10), d = side === 'L' ? -1 : 1;
    g.beginPath(); g.moveTo(tx, ty - 8); g.lineTo(tx + d * 11, ty); g.lineTo(tx, ty + 7); g.closePath(); g.fillStyle = fill; g.fill();
    g.beginPath(); g.moveTo(tx, ty - 8); g.lineTo(tx + d * 11, ty); g.lineTo(tx, ty + 7); g.strokeStyle = stroke; g.stroke();
    g.fillStyle = fill; g.fillRect(tx - (side === 'L' ? 0 : 2), ty - 7, 2, 13);
  }
  const FILL = { L: '#18222D', R: '#1A2622' }, EDGE = { L: 'rgba(110,200,255,0.38)', R: 'rgba(242,194,154,0.42)' };
  // 상대의 한 마디 (글 말풍선)
  function talk(g, o) {
    const size = o.size || 22, ar = o.ar || 25, side = o.side || 'L', at = o.at == null ? -99 : o.at, u = o.u;
    const maxText = Math.min(o.maxText || 1e9, o.w - ar * 2 - 60);
    const R = richLay(g, o.text, o.marks || [], size, (o.fast ? maxText / 0.62 : maxText), { weight: 500, spread: o.slow ? 3.2 : 1 });
    const sq = o.fast ? 0.62 : 1, tW = R.w * sq, bw = tW + 34, bh = R.h + 20;
    const ax = side === 'L' ? o.x + ar : o.x + o.w - ar, ay = o.y + Math.min(bh / 2, 30);
    const bx = side === 'L' ? ax + ar + 16 : ax - ar - 16 - bw, by = o.y;
    const a = o.all ? 1 : ramp(u, at - 0.35, 0.3);
    const out = { bx, by, bw, bh, ex: bx + bw, R };
    if (a <= 0.001) return out;
    const per = WD * (o.slow ? 1.9 : o.fast ? 0.45 : o.quick ? 0.6 : 1), dur = nWords(o.text) * per, live = u >= at && u < at + dur + 0.15;
    fade(g, a, () => {
      avatar(g, ax, ay, ar, o.kind || (side === 'L' ? 'local' : 'me'), { live, sp: o.sp });
      bubbleShape(g, side, bx, by, bw, bh, ax, ay, FILL[side], o.edge || EDGE[side]);
      const shown = o.all ? null : (u - at) / per;
      g.save(); g.translate(bx + 17, by + 10 + R.lh / 2); g.scale(sq, 1);
      richDraw(g, R, 0, 0, { shown, rolesOn: o.roleAt == null || u >= o.roleAt, color: o.color });
      g.restore();
      if (o.fast && live) { g.strokeStyle = 'rgba(238,241,244,0.35)'; g.lineWidth = 2; g.lineCap = 'round'; [0, 1, 2].forEach(k => { const yy = by + 12 + k * (bh - 24) / 2, ph = ((u * 3 + k * 0.33) % 1); g.beginPath(); g.moveTo(bx + bw + 8 + ph * 18, yy); g.lineTo(bx + bw + 28 + ph * 18, yy); g.stroke(); }); }
      if (o.strike != null && u >= o.strike) { const p = clamp((u - o.strike) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.8; g.beginPath(); g.moveTo(bx + 12, by + bh / 2 + 1); g.lineTo(bx + 12 + (bw - 24) * p, by + bh / 2 + 1); g.stroke(); }
      if (o.verdict && u >= o.verdict.at) fade(g, ramp(u, o.verdict.at, 0.3), () => mark(g, o.verdict.ok, side === 'L' ? bx + bw + 22 : bx - 22, by + bh / 2, 17));
    });
    if (!o.noHit) listen(bx, by, bw, bh, [{ text: o.text, sp: o.sp || 'us', rate: o.fast ? 1.35 : o.slow ? 0.75 : 1 }]);
    return out;
  }
  DRS.talk = talk;
  const Qobj = q => typeof q === 'string' ? DR.Q[q] : q;
  const Qm = q => Qobj(q).key.map(k => [k, 'key']);
  const staff = (g, q, o) => { q = Qobj(q); return talk(g, Object.assign({ side: 'L', text: q.en, marks: q.fast ? [] : Qm(q), kind: kindOf(q), sp: q.sp, fast: !!q.fast }, o)); };
  // 나의 대답 (낱말 조각 말풍선, 두 대답 사이를 morph)
  function answer(g, o) {
    const size = o.size || 24, ar = 25, at = o.at == null ? -99 : o.at, u = o.u;
    const TA = o.toksA || ansToks(o.A, { role: o.trapAt != null && u >= o.trapAt ? 'trap' : undefined });
    const TB = o.toksB || (o.B ? ansToks(o.B) : null);
    const LA = lay(g, TA, { x: 0, y: 0, size, maxW: o.maxW }), LB = TB ? lay(g, TB, { x: 0, y: 0, size, maxW: o.maxW }) : null;
    const p = LB ? clamp(o.p || 0) : 0, e = ease(p);
    const tW = LB ? lerp(LA.w, LB.w, e) : LA.w, th = LB ? lerp(LA.h, LB.h, e) : LA.h, bw = tW + 36, bh = th + 22;
    const ax = o.x + o.w - ar, ay = o.y + Math.min(bh / 2, 30), bx = ax - ar - 16 - bw, by = o.y;
    const a = o.all ? 1 : ramp(u, at - 0.35, 0.3), out = { bx, by, bw, bh };
    if (a <= 0.001) return out;
    const live = u >= at && u < at + 1.1;
    fade(g, a, () => {
      avatar(g, ax, ay, ar, 'me', { live, sp: 'me' });
      bubbleShape(g, 'R', bx, by, bw, bh, ax, ay, FILL.R, o.edge || EDGE.R);
      g.save(); g.translate(bx + 18, by + 11 + size * 0.65);
      if (LB && p > 0) morph(g, LA, LB, p, {}); else drawLay(g, LA, o.style);
      g.restore();
      if (o.strikeAt != null && u >= o.strikeAt && p < 0.01) { const q = clamp((u - o.strikeAt) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.8; g.beginPath(); g.moveTo(bx + 12, by + bh / 2 + 1); g.lineTo(bx + 12 + (bw - 24) * q, by + bh / 2 + 1); g.stroke(); }
      if (o.verdict && u >= o.verdict.at) fade(g, ramp(u, o.verdict.at, 0.3), () => mark(g, o.verdict.ok, bx - 22, by + bh / 2, 17));
      if (o.tag && u >= o.tag[2]) fade(g, ramp(u, o.tag[2], 0.35) * (o.tag[3] != null ? 1 - ramp(u, o.tag[3], 0.3) : 1), () => tag(g, o.tag[0], o.tagX != null ? o.tagX : o.tagY != null ? bx + bw : bx - 48, o.tagY != null ? o.tagY : by + bh / 2, o.tag[1] || COL.trap, { align: o.tagX != null ? 'left' : 'right', size: 15, h: 32 }));
    });
    const said = LB && p > 0.5 ? (o.sayB || (o.B ? DR.text(o.B) : null)) : (o.sayA || (o.A ? DR.text(o.A) : null));
    if (!o.noHit && said) listen(bx, by, bw, bh, [{ text: said, sp: 'me' }]);
    return out;
  }
  DRS.answer = answer;
  const okOf = (q, a, c) => DR.judge(q, a, c || DR.DEMO_CARD).ok;

  /* ---------- 단계 띠 (02–07장 위쪽): 일곱 단계를 길을 따라 ---------- */
  function strip(g, cur, a = 1) {
    fade(g, a, () => {
      const x0 = 812, dx = 64, y = 92;
      g.strokeStyle = COL.faint; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 6, y); g.stroke();
      DR.PLACES.forEach((p, i) => {
        const x = x0 + i * dx, on = i === cur;
        circ(g, x, y, on ? 19 : 14, on ? COL.accent : i < cur ? '#2A3542' : COL.panel);
        ring(g, x, y, on ? 19 : 14, on ? COL.accent : DR.ME_FIRST[p.id] ? 'rgba(201,167,255,0.6)' : COL.faint, 1.5);
        icon(g, p.id, x, y, on ? 22 : 16, on ? '#1D1305' : i < cur ? COL.soft : COL.muted, on ? 2 : 1.8);
      });
      txt(g, `${cur + 1} / 7`, x0 + dx * 6 + 30, y, { size: 13, weight: 500, fam: FM, color: COL.muted });
    });
  }

  /* =========================================================
     동네 지도 — DRS.town(g, M, o). M = { ox, oy, s }: 교차점 (0,0)의 화면 자리 · 격자 한 칸
     o: { reveal: true | [곳], labels: [곳], hl: { 곳 | 자리: 색 }, walker: { p: [gx,gy], h: 각도 | 'E' }, route, routeP, routeColor,
          arrows: 돌기 화살표, pin: 곳, stops: 정류장, names: 길 이름, hitLots: 자리 누르기(시뮬레이터), cursor: 자리, dimLots }
     ========================================================= */
  const TP = (M, gx, gy) => [M.ox + gx * M.s, M.oy + gy * M.s];
  DRS.TP = TP;
  const LOT_W = 0.23, LOT_H = 0.2;
  function lotRect(M, id) { const p = DR.lotPoint(id), [x, y] = TP(M, p[0], p[1]); return { x: x - LOT_W * M.s / 2, y: y - LOT_H * M.s / 2, w: LOT_W * M.s, h: LOT_H * M.s, cx: x, cy: y }; }
  DRS.lotRect = lotRect;
  const HANG = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
  DRS.HANG = HANG;
  function walkerDraw(g, x, y, ang, r, color = COL.accent) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(1.5, 2, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = color; g.beginPath(); g.moveTo(r * 1.75, 0); g.lineTo(r * 0.35, -r * 0.82); g.lineTo(r * 0.35, r * 0.82); g.closePath(); g.fill();
    circ(g, 0, 0, r, color); ring(g, 0, 0, r, '#1D1305', 2);
    circ(g, r * 0.25, 0, r * 0.32, '#1D1305');
    g.restore();
  }
  DRS.walkerDraw = walkerDraw;
  function pinDraw(g, x, y, s, color = COL.gap) {
    g.save(); g.translate(x, y - s * 0.9);
    g.fillStyle = color; g.beginPath(); g.moveTo(0, s * 0.9); g.bezierCurveTo(-s * 0.15, s * 0.5, -s * 0.55, s * 0.2, -s * 0.55, -s * 0.15); g.arc(0, -s * 0.15, s * 0.55, Math.PI, 0); g.bezierCurveTo(s * 0.55, s * 0.2, s * 0.15, s * 0.5, 0, s * 0.9); g.fill();
    circ(g, 0, -s * 0.15, s * 0.2, '#1D1305');
    g.restore();
  }
  // 길 위의 자리 (진행 0~1) → { x, y, ang }
  function pathAt(pts, p) {
    let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
    let left = L * clamp(p);
    for (let i = 1; i < pts.length; i++) {
      const d = seg[i - 1], a = pts[i - 1], b = pts[i], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (left <= d || i === pts.length - 1) { const k = d ? Math.min(1, left / d) : 1; return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), ang }; }
      left -= d;
    }
    return { x: pts[0][0], y: pts[0][1], ang: 0 };
  }
  DRS.pathAt = pathAt;
  function polyPart(g, pts, f) {
    let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
    let left = L * clamp(f);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) { const d = seg[i - 1], k = Math.min(1, left / d); g.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)); left -= d; }
    g.stroke();
  }
  // 교차점에서 도는 화살표 (들어온 방향 h → dir)
  function turnArrow(g, M, I, h, dir, color, o = {}) {
    const [x, y] = TP(M, I[0], I[1]), s = M.s, v = DR.DIRV[h], h2 = dir === 'left' ? DR.LEFT[h] : DR.RIGHT[h], v2 = DR.DIRV[h2], k = o.k || 0.34;
    const a = [x - v[0] * s * k, y - v[1] * s * k], b = [x + v2[0] * s * k, y + v2[1] * s * k];
    g.strokeStyle = color; g.lineWidth = o.lw || 4; g.lineCap = 'round'; if (o.dash) g.setLineDash(o.dash);
    g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(x, y, b[0], b[1]); g.stroke(); g.setLineDash([]);
    arrowHead(g, b[0] + v2[0] * 6, b[1] + v2[1] * 6, Math.atan2(v2[1], v2[0]), color, o.head || 13);
    // 이름표: 화살표 끝 너머 (세로 화살표는 labelSide: 'right'면 화살표 끝의 오른쪽 옆에)
    if (o.label && v2[0] === 0 && o.labelSide === 'right') tag(g, o.label, b[0] + 12, b[1] + v2[1] * 4, color, { size: 13, h: 26, align: 'left' });
    else if (o.label) tag(g, o.label, b[0] + v2[0] * 14, b[1] + v2[1] * 14 + (v2[1] === 0 ? -22 : 0), color, { size: 13, h: 26, align: v2[0] < 0 ? 'right' : v2[0] > 0 ? 'left' : 'center' });
  }
  DRS.turnArrow = turnArrow;
  function town(g, M, o = {}) {
    const T = DR.TOWN, s = M.s, sw = Math.max(9, s * 0.15);
    const x0 = M.ox - 0.42 * s, y0 = M.oy - 0.42 * s, W2 = (T.C - 1 + 0.84) * s, H2 = (T.R - 1 + 0.84) * s;
    const reveal = id => o.reveal === true || (Array.isArray(o.reveal) && o.reveal.includes(id));
    rr(g, x0, y0, W2, H2, 16); g.fillStyle = '#121922'; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.stroke();
    g.save(); rr(g, x0, y0, W2, H2, 16); g.clip();
    // 블록 · 공원
    for (let by = 0; by < T.R - 1; by++) for (let bx = 0; bx < T.C - 1; bx++) {
      const [a, b] = TP(M, bx + 0.09, by + 0.09), isPark = bx === T.park[0] && by === T.park[1];
      rr(g, a, b, 0.82 * s, 0.82 * s, 8); g.fillStyle = isPark ? COL.parkG : COL.block; g.fill();
      if (isPark) {
        [[0.25, 0.3], [0.55, 0.22], [0.75, 0.45], [0.3, 0.65], [0.6, 0.72], [0.45, 0.47]].forEach(([tx, ty], k) => { const [px, py] = TP(M, bx + tx, by + ty); circ(g, px, py, s * (0.075 + (k % 2) * 0.02), k % 2 ? '#2F5D4A' : '#3E7558'); });
        const pv = o.hl && o.hl.park;
        if (pv) { rr(g, a, b, 0.82 * s, 0.82 * s, 8); g.strokeStyle = pv; g.lineWidth = 3; g.stroke(); }
      }
    }
    // 길 · 가운데 점선
    g.strokeStyle = COL.road; g.lineWidth = sw; g.lineCap = 'butt';
    for (let c = 0; c < T.C; c++) { const [a, b] = TP(M, c, -0.5), [, d] = TP(M, c, T.R - 0.5); g.beginPath(); g.moveTo(a, b); g.lineTo(a, d); g.stroke(); }
    for (let r = 0; r < T.R; r++) { const [a, b] = TP(M, -0.5, r), [c] = TP(M, T.C - 0.5, r); g.beginPath(); g.moveTo(a, b); g.lineTo(c, b); g.stroke(); }
    g.strokeStyle = 'rgba(238,241,244,0.10)'; g.lineWidth = 1.2; g.setLineDash([5, 7]);
    for (let c = 0; c < T.C; c++) { const [a, b] = TP(M, c, -0.5), [, d] = TP(M, c, T.R - 0.5); g.beginPath(); g.moveTo(a, b); g.lineTo(a, d); g.stroke(); }
    for (let r = 0; r < T.R; r++) { const [a, b] = TP(M, -0.5, r), [c] = TP(M, T.C - 0.5, r); g.beginPath(); g.moveTo(a, b); g.lineTo(c, b); g.stroke(); }
    g.setLineDash([]);
    // 신호등 교차점: 횡단보도 줄무늬 + 신호등
    Object.keys(T.lights).forEach(k => {
      const [c, r] = k.split(',').map(Number), [x, y] = TP(M, c, r), off = sw * 0.95, half = sw * 0.42;
      g.fillStyle = 'rgba(238,241,244,0.42)';
      for (let i = -2; i <= 2; i++) {
        const t = i * sw * 0.17;
        g.fillRect(x - off - 2, y + t - 1, 4.5, 2.4); g.fillRect(x + off - 2, y + t - 1, 4.5, 2.4);
        g.fillRect(x + t - 1, y - off - 2, 2.4, 4.5); g.fillRect(x + t - 1, y + off - 2, 2.4, 4.5);
      }
      const lx = x + half + sw * 0.55, ly = y - half - sw * 0.55;
      rr(g, lx - 3.5, ly - 8, 7, 16, 2.5); g.fillStyle = '#0B0F14'; g.fill();
      circ(g, lx, ly - 4.2, 1.8, o.hl && o.hl.lights ? '#FF6B6B' : '#7A3A3A'); circ(g, lx, ly + 0.2, 1.8, '#6A5A2A'); circ(g, lx, ly + 4.4, 1.8, o.hl && o.hl.lights ? '#7FE0A8' : '#2F5D4A');
      if (o.hl && o.hl.lights) ring(g, lx, ly, 13, o.hl.lights, 2);
    });
    // 건물
    Object.values(DR.LOTS).forEach(L => {
      const R = lotRect(M, L.id), sp = L.spot && DR.SPOT[L.spot], shown = sp && (sp.kind === 'mark' || reveal(sp.id));
      const hl = o.hl && (o.hl[L.id] || (sp && o.hl[sp.id])), dim = o.dimLots && !hl;
      rr(g, R.x, R.y, R.w, R.h, 4);
      g.fillStyle = shown ? (sp.kind === 'mark' ? '#2E3C4E' : '#463A22') : '#232D39'; g.fill();
      if (o.cursor === L.id) { g.strokeStyle = COL.ante; g.lineWidth = 2.5; g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]); }
      if (hl) { g.strokeStyle = hl; g.lineWidth = 3; g.stroke(); }
      if (shown) icon(g, sp.icon, R.cx, R.cy, Math.min(R.w, R.h) * 0.8, sp.kind === 'mark' ? COL.soft : COL.rel, Math.max(1.5, s / 90));
      if (dim) { rr(g, R.x, R.y, R.w, R.h, 4); g.fillStyle = 'rgba(16,21,28,0.55)'; g.fill(); }
      if (o.hitLots) HITS.push({ x: R.x - 2, y: R.y - 2, w: R.w + 4, h: R.h + 4, lot: L.id });
    });
    // 버스 정류장
    if (o.stops) Object.entries(DR.STOPS).forEach(([id, st]) => {
      const p = DR.segPoint(st.key, st.t), [x, y] = TP(M, p[0], p[1] + (st.side === 'N' ? -0.088 : 0.088)), hl = o.hl && o.hl[id], bw = Math.max(18, s * 0.17), bh = Math.max(10, s * 0.085);
      rr(g, x - bw / 2, y - bh / 2, bw, bh, 3); g.fillStyle = hl ? hl : '#3E6A8A'; g.fill();
      txt(g, 'BUS', x, y + 0.5, { size: Math.max(7, s * 0.055), weight: 700, fam: FM, color: hl ? '#1D1305' : '#EEF1F4', align: 'center' });
      if (o.hitLots) HITS.push({ x: x - bw / 2 - 3, y: y - bh / 2 - 3, w: bw + 6, h: bh + 6, lot: id });
    });
    // 길 이름 (길 위에)
    if (o.names !== false) {
      const nsz = Math.max(8, s * 0.072);
      T.H.forEach((nm, r) => { const [x, y] = TP(M, 2.5, r); txt(g, nm.toUpperCase(), x, y + 0.5, { size: nsz, weight: 700, fam: FM, color: 'rgba(238,241,244,0.42)', align: 'center' }); });
      T.V.forEach((nm, c) => { const [x, y] = TP(M, c, 1.5); g.save(); g.translate(x, y); g.rotate(-Math.PI / 2); txt(g, nm.toUpperCase(), 0, 0.5, { size: nsz, weight: 700, fam: FM, color: 'rgba(238,241,244,0.42)', align: 'center' }); g.restore(); });
    }
    // 길 (계산된 경로)
    if (o.route && o.route.path) {
      const pts = o.route.path.map(p => TP(M, p[0], p[1]));
      g.strokeStyle = o.routeColor || 'rgba(110,200,255,0.85)'; g.lineWidth = Math.max(3, s * 0.035); g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash([2, s * 0.07]);
      polyPart(g, pts, o.routeP == null ? 1 : o.routeP); g.setLineDash([]);
      if (o.arrows) o.route.legs.forEach((Lg, i) => { const k = (i + 1) / (o.route.legs.length + 1); if ((o.routeP == null ? 1 : o.routeP) >= k * 0.9) turnArrow(g, M, Lg.I, Lg.h, Lg.dir, COL.accent, { lw: 3.5, k: 0.26, head: 11 }); });
    }
    (o.extraPaths || []).forEach(xp => { const pts = xp.pts.map(p => TP(M, p[0], p[1])); g.strokeStyle = xp.color; g.lineWidth = xp.lw || 4; g.lineCap = 'round'; g.lineJoin = 'round'; if (xp.dash) g.setLineDash(xp.dash); polyPart(g, pts, xp.p == null ? 1 : xp.p); g.setLineDash([]); });
    g.restore();
    // 이름표 (지도 위): 서쪽 면 자리 → 오른쪽, 동쪽 면 → 왼쪽, 북쪽 가운데 → 아래, 남쪽 가운데 → 위 (블록 안쪽으로). labelPos로 바꿀 수 있어요
    (o.labels || []).forEach(id => {
      const P = DR.SPOT[id], c = o.hl && o.hl[id] ? o.hl[id] : P.kind === 'mark' ? COL.soft : COL.rel, fs = Math.max(9.5, s * 0.075), ch = Math.max(16, s * 0.13);
      if (id === 'park') { const [x, y] = TP(M, T.park[0] + 0.5, T.park[1] + 0.5); chip(g, P.en, x, y, { size: fs, weight: 700, color: c, fill: 'rgba(16,21,28,0.88)', h: ch, r: 6, pad: 5, align: 'center' }); return; }
      const R = lotRect(M, DR.lotOfSpot(id)), lot = P.lot;
      const pos = (o.labelPos && o.labelPos[id]) || (lot === 'n' ? 'below' : lot === 's' ? 'above' : /w$/.test(lot) ? 'right' : 'left');
      const at = { below: [R.cx, R.y + R.h + ch / 2 + 2, 'center'], above: [R.cx, R.y - ch / 2 - 2, 'center'], right: [R.x + R.w + 4, R.cy, 'left'], left: [R.x - 4, R.cy, 'right'] }[pos];
      chip(g, P.en, at[0], at[1], { size: fs, weight: 700, color: c, fill: 'rgba(16,21,28,0.9)', h: ch, r: 6, pad: 5, align: at[2] });
    });
    if (o.pin) { const R = lotRect(M, DR.lotOfSpot(o.pin) || o.pin); pinDraw(g, R.cx, R.cy - R.h * 0.2, Math.max(14, s * 0.15)); }
    if (o.walker) {
      const wk = o.walker, [x, y] = Array.isArray(wk.p) ? TP(M, wk.p[0], wk.p[1]) : [wk.x, wk.y];
      walkerDraw(g, x, y, typeof wk.h === 'string' ? HANG[wk.h] : wk.h, Math.max(7, s * 0.06), wk.color);
    }
    return { x: x0, y: y0, w: W2, h: H2 };
  }
  DRS.town = town;
  // 경로를 따라 걷는 사람 (진행 p)
  function walkAlong(M, R, p) {
    const pts = R.path, at = pathAt(pts, p), [x, y] = TP(M, at.x, at.y);
    return { x, y, h: at.ang };
  }
  DRS.walkAlong = walkAlong;
  // 지도 옆 이름표 줄 (아이콘 + 이름)
  function legendRow(g, id, x, y, o = {}) {
    const P = DR.SPOT[id] || { en: id, ko: '', icon: id };
    circ(g, x + 12, y, 13, COL.panel2); icon(g, P.icon || id, x + 12, y, 18, o.color || (P.kind === 'dest' ? COL.rel : COL.soft));
    txt(g, P.en, x + 32, y - 1, { size: o.size || 16, weight: 700, color: o.color || COL.en });
    if (o.ko !== false) txt(g, P.ko, x + 36 + tw(g, P.en, o.size || 16, 700), y, { size: 13, weight: 600, color: COL.muted });
  }

  /* ---------- 버스 노선 띠 (05장 · 시뮬레이터 결과) ---------- */
  function busLine(g, x, y, w, line, nth, o = {}) {
    const L = DR.LINES[line], n = Math.max(nth + 1, 4), dx = w / n;
    g.strokeStyle = line === 15 ? '#6EC8FF' : '#C9A7FF'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * (n - 0.4), y); g.stroke();
    chip(g, String(line), x - 30, y, { size: 16, weight: 800, fam: FM, color: '#1D1305', fill: line === 15 ? '#6EC8FF' : '#C9A7FF', h: 30, r: 8, pad: 9, align: 'center' });
    for (let k = 0; k < n; k++) {
      const xx = x + k * dx, on = k === nth, a = o.shown == null ? 1 : clamp(o.shown - k + 1);
      fade(g, a, () => {
        circ(g, xx, y, on ? 13 : 9, on ? COL.accent : COL.panel2); ring(g, xx, y, on ? 13 : 9, on ? COL.accent : COL.soft, 2);
        txt(g, k === 0 ? (o.here || 'here') : DR.ordW(k), xx, y - 26, { size: 13, weight: 700, color: on ? COL.accent : k === 0 ? COL.clause : COL.soft, align: 'center' });
        if (k > 0) txt(g, L.stops[k - 1], xx, y + 26, { size: fit(g, L.stops[k - 1], 12, dx - 8, 600), weight: 600, color: on ? COL.accent : COL.muted, align: 'center' });
      });
    }
  }
  DRS.busLine = busLine;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(곱하기 표)는 자막에 쓰지 않음
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '길 묻기 · 들은 길은 되짚어 확인한다', d: 29, caps: [
      [0.4, 5, '길을 물을 때 묻는 말은 쉬워요. 어려운 것은 빠르고 긴 대답을 알아듣는 거예요.'],
      [5, 10.2, 'Where is train station? → 인사 없이 바로 물으면 퉁명스럽게 들려요.'],
      [10.2, 15, '먼저 → Excuse me. 그리고 묻는 틀 + 곳 이름 → Could you tell me how to get to the train station?'],
      [15, 20.6, '대답은 길고 빨라요. 동작, 기준점, 도착 위치. 이 세 가지 조각으로 나눠서 들어요.'],
      [20.6, 24.6, '들은 조각을 한 줄로 되짚어요 → So, I go straight for two blocks, turn left at the bank, and it\'s on my right?'],
      [24.6, 29, 'That\'s right! **들은 길은 되짚어 확인해요.**'],
    ] },
    { id: 'route', n: '01', title: '길 묻기 지도', sub: '대화의 일곱 단계 · 단계마다 한 줄', d: 30, caps: [
      [0.4, 6, '길 묻기 대화를 일곱 단계로 나눠 봐요. 먼저 말을 걸고, 가려는 곳을 물어요.'],
      [6, 12, '그다음은 듣기예요. 동작 낱말, 기준점과 위치, 거리와 교통을 조각으로 들어요.'],
      [12, 18, '들은 조각을 한 줄로 되짚어 확인하고, 고맙다고 끝내요.'],
      [18, 24, '보라 테두리는 내가 먼저 말하는 단계예요 → 말 걸기, 묻기, 되짚기.'],
      [24, 30, '길을 알려 주는 방식은 나라와 사람마다 달라요. 휴대폰 지도가 있어도 물어보는 말은 쓸모가 있어요.'],
    ] },
    { id: 'greet', n: '02', title: '말 걸기와 묻기', sub: 'Excuse me · how to get to · near here · the nearest · 곳 이름', d: 36, place: [0, 1], placeAt: 6, caps: [
      [0.4, 6, '모르는 사람에게 말을 걸 때 → Excuse me. 또는 Sorry to bother you. Hey! → 친구를 부르는 말처럼 들려요.'],
      [6, 12, '묻는 틀 셋 → Could you tell me how to get to ___? Is there ___ near here? Where\'s the nearest ___?'],
      [12, 18, '길 좀 가르쳐 주세요 → teach me the way? 알아듣지만, 수업에서 가르친다는 말이라 어색해요. 보통 → tell me · show me.'],
      [18, 24, '곳 이름도 조심해요. 마트 → supermarket, grocery store. 편의점 → convenience store. mart, a convenience → 헷갈려요.'],
      [24, 30, '지하철역 → subway station. 영국은 underground, 런던은 the tube. 화장실 → restroom, 영국은 toilets.'],
      [30, 36, '횡단보도 → crosswalk. 사거리 → intersection. 신호등 → traffic lights. 주유소 → gas station, 영국은 petrol station.'],
    ] },
    { id: 'move', n: '03', title: '동작 낱말', sub: 'go straight · turn left · take the second left · cross · go past · until', d: 36, place: 2, caps: [
      [0.4, 6, '대답의 첫 조각 → 동작 낱말. go straight, keep going → 앞으로 쭉. turn left, turn right → 돌아요.'],
      [6, 12, 'left · right → 걷는 사람이 바라보는 쪽이 기준이에요. 같은 사거리에서도 바라보는 쪽이 다르면 왼쪽이 달라져요.'],
      [12, 18, 'take the second left → 두 번째로 나오는 왼쪽 길로 한 번 돌아요. turn left twice → 왼쪽으로 두 번 돌아요.'],
      [18, 24, 'go past the post office → 우체국을 지나서 가요. cross the street → 횡단보도에서 길을 건너요.'],
      [24, 30, 'keep going until you get to the bank → 은행이 나올 때까지 쭉 가요. 그다음 돌아요.'],
      [30, 36, 'turn left → 왼쪽으로 도는 동작. on your left → 왼쪽에 있는 위치. 하나는 움직이고, 하나는 그 자리에 있어요.'],
    ] },
    { id: 'mark', n: '04', title: '기준점과 위치', sub: 'at the bank · on your right · across from · next to · between · on the corner of', d: 36, place: 3, caps: [
      [0.4, 6, '둘째 조각 → 기준점. at the bank, at the lights, at the corner → 그곳에서 돌아요.'],
      [6, 12, '셋째 조각 → 도착 위치. It\'s on your right. 걷는 사람의 오른쪽이에요.'],
      [12, 18, 'across from the park → 공원 맞은편, 길 건너. next to the bank → 은행 바로 옆.'],
      [18, 24, 'between the café and the post office → 카페와 우체국 사이. on the corner of → 두 길이 만나는 모퉁이.'],
      [24, 30, 'in front of → 앞, behind → 뒤. The bus stop is in front of the supermarket.'],
      [30, 36, '지도의 관계는 규칙 엔진이 계산해요. 맞은편과 바로 옆을 헷갈리면 엉뚱한 건물로 가요.'],
    ] },
    { id: 'far', n: '05', title: '거리 · 시간 · 교통', sub: 'five-minute walk · too far to walk · the 15 bus · the third stop · Exit 3', d: 32, place: 4, caps: [
      [0.4, 5.5, '거리는 시간으로 말할 때가 많아요 → It\'s about a five-minute walk. 미국에서는 블록으로도 말해요.'],
      [5.5, 11, '멀면 → It\'s too far to walk. You should take the bus. 그러면 내가 물어요 → Which bus should I take?'],
      [11, 16.5, '15와 50 → fifteen → 뒤를 세게, fifty → 앞을 세게 말해요. 번호를 잘못 들으면 반대쪽으로 가요.'],
      [16.5, 22, 'get off at the third stop → 세 번째 정류장에서 내려요. first, second, third, fourth.'],
      [22, 27, '지하철에서 나올 때 → Take Exit 3. 출구 번호도 숫자예요.'],
      [27, 32, '나라마다 말하는 법이 달라요. 미국은 블록으로 세고, 영국에서는 이렇게도 말해요 → the second turning on the left.'],
    ] },
    { id: 'check', n: '06', title: '되짚기', sub: 'So, ___, ___, and it\'s on my ___? · 맞으면 That\'s right · 틀리면 그 조각만', d: 36, place: 5, caps: [
      [0.4, 6, '긴 대답은 한 번에 다 기억하기 어려워요. 그래서 들은 조각을 되짚어 확인해요.'],
      [6, 12, '틀 → So, ___? 빈칸에 들은 조각을 차례대로 넣어요. 그리고 your → my.'],
      [12, 18, 'So, I go straight for two blocks, turn left at the bank, and it\'s on my right?'],
      [18, 24, '틀린 조각이 있으면 상대는 그 조각만 고쳐 줘요 → Not quite — turn left at the bank.'],
      [24, 30, '한 조각만 확인해도 돼요 → So, I turn left at the bank? 들은 곳까지 확인하는 말이에요.'],
      [30, 36, '되짚은 줄은 규칙 엔진이 지도의 길과 맞춰 봐요. 빠진 조각, 다른 방향, 다른 기준점, 순서를 찾아요.'],
    ] },
    { id: 'repair', n: '07', title: '다시 묻기', sub: 'say that again more slowly · left or right? · show me on the map · Thanks anyway', d: 30, place: [5, 6], placeAt: 18, caps: [
      [0.4, 6, '너무 빨라서 못 알아들었으면 → Sorry, could you say that again more slowly, please?'],
      [6, 12, '일부만 들렸으면 그 부분만 → Sorry, left or right? 버스 번호가 안 들렸으면 → Sorry, which bus?'],
      [12, 18, '휴대폰 지도를 보여 주며 → Could you show me on the map, please?'],
      [18, 24, '모른다고 할 때도 있어요 → Sorry, I\'m not from around here. 그러면 → That\'s okay. Thanks anyway.'],
      [24, 30, 'Okay. Bye. → 무뚝뚝하게 들려요. 시간을 내 준 사람에게는 → Thanks anyway.'],
    ] },
    { id: 'oneline', n: '08', title: '한 줄로 되짚기', sub: '조각마다 따로 확인하면 세 번 · 한 줄이면 한 번', d: 30, caps: [
      [0.4, 6, '조각마다 따로 확인하면 → Straight for two blocks? Yes. Then left at the bank? Yes. On my right? Yes.'],
      [6, 12, '세 번 주고받아요. 한 줄로 되짚으면 한 번이면 돼요.'],
      [12, 18, 'So, I go straight for two blocks, turn left at the bank, and it\'s on my right? That\'s right!'],
      [18, 24, '틀린 조각이 하나 있으면 → 상대는 맞은 조각은 다시 말하지 않고, 틀린 조각만 고쳐 줘요.'],
      [24, 30, '세 번이 한 번으로 줄었어요. 조각의 순서는 들은 차례 그대로예요.'],
    ] },
    { id: 'method', n: '09', title: '3단계 말하기 법', sub: '일곱 단계에 한 줄씩', d: 26, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 말하기 법**으로 묶어요.'],
      [5.5, 11, '① **열쇠 낱말 잡기** → 물을 때는 곳 이름, 들을 때는 동작 · 기준점 · 위치 낱말.'],
      [11, 16.5, '② **틀에 내 정보 넣기** → Could you tell me how to get to ___? So, ___, ___, and it\'s on my ___?'],
      [16.5, 21.5, '③ **공손하게 끝내기** → Excuse me, Sorry to bother you, Thank you so much, Thanks anyway.'],
      [21.5, 26, '일곱 단계에 한 줄씩 적용했어요.'],
    ] },
    { id: 'practice', n: '10', title: '실전 길 묻기', sub: '길 카드 하나로 네 번', d: 50, caps: [
      [0.4, 4.5, '실전이에요. 길 카드 → 지금 River Road, 가려는 곳은 지하철역. 지나가는 사람에게 말을 걸어요.'],
      [4.5, 8.5, '② (C) train station → 카드는 지하철역이라 탈락.'],
      [8.5, 12.5, '③ (A) Subway station where? → 퉁명스러워 탈락. 정답 (B)'],
      [12.9, 17, 'Sorry, I\'m not from around here. ① (B) 다시 묻기 → 이 사람은 몰라서 탈락.'],
      [17, 21, '② 남은 둘에 틀린 정보는 없어요.'],
      [21, 25, '③ (A) Okay. Bye. → 무뚝뚝해서 탈락. 정답 (C) That\'s okay. Thanks anyway.'],
      [25.4, 29.5, '다음 사람 → Go down this street and take the second right. ① (A) You\'re welcome → 탈락.'],
      [29.5, 33.5, '② (B) turn right twice → 두 번 돌면 다른 곳이라 탈락.'],
      [33.5, 37.5, '정답 (C) So, I take the second right, and it\'s on my right?'],
      [37.9, 42, 'That\'s right. You can\'t miss it. ① (A) You\'re welcome → 탈락.'],
      [42, 46, '③ (B) Okay. Bye. → 무뚝뚝해서 탈락.'],
      [46, 50, '정답 (C) Great, thank you so much!'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '단계 · 열쇠 낱말 · 틀', d: 22, caps: [
      [0.4, 6, '정리해요. 말을 걸 때 → Excuse me. 묻는 틀 + 곳 이름 → Could you tell me how to get to ___?'],
      [6, 12, '대답은 조각으로 → 동작, 기준점, 도착 위치. turn left, on your left → 서로 달라요.'],
      [12, 17, '들은 조각은 한 줄로 되짚어요 → So, ___? 모른다고 하면 → Thanks anyway.'],
      [17, 22, '아래 **길 찾기 시뮬레이터**에서 내 길 카드로 직접 물어보고 걸어가 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  DRS.CHAPTERS = CHAPTERS; DRS.CAPTIONS = CAPTIONS; DRS.END = END;
  DRS.POSTER = CHAPTERS.find(c => c.id === 'intro').t + 26.6;
  DRS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  DRS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 실전 장면의 시각 (구간 시작 · 보기 · ① · ② · ③ · 정답)
  const PSEG = [0, 12.5, 25, 37.5];
  const PT = { q: 0.4, opt: [1.6, 2.2, 2.8], s1: 5.0, s2: 7.0, s3: 9.0, win: 10.0, lines: [0.4, 4.5, 8.5] };
  DRS.PSEG = PSEG;

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  const label = (g, s, x, y, o = {}) => txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o));
  // [글, 역할] 이어 쓰기
  function pieces(g, parts, x, y, size, maxW, o = {}) {
    let w = 0; parts.forEach(([t, r]) => { w += tw(g, t, size, r ? 600 : 500); });
    const sz = maxW && w > maxW ? size * maxW / w : size;
    let xx = o.align === 'center' ? x - w * sz / size / 2 : o.align === 'right' ? x - w * sz / size : x;
    parts.forEach(([t, r]) => { const c = RC[r] || o.color || COL.soft; xx += txt(g, t, xx, y, { size: sz, weight: r ? 600 : 500, color: c }); });
    return w * sz / size;
  }
  const ansParts = a => DR.segs(a).map(s => [s.t, s.r]);
  const why2 = j => `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
  function whyLine(g, j, y, w = 1100, x) { const R = richLay(g, why2(j), [], 17, w, { weight: 600 }); richDraw(g, R, x != null ? x : W / 2 - R.w / 2, y, { color: j.ok ? COL.good : COL.trap }); return R; }
  // 조각 카드: 종류 아이콘 + 영어 + 한국어 (오른쪽 칸)
  function card(g, x, y, w, en, ko, o = {}) {
    const h = o.h || 62;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: o.stroke || COL.faint, lw: o.stroke ? 2 : 1.5 });
    if (o.icon) { circ(g, x + 28, y + h / 2, 17, COL.panel2); icon(g, o.icon, x + 28, y + h / 2, 22, o.ic || COL.ante); }
    const x1 = x + (o.icon ? 54 : 16);
    txt(g, en, x1, y + h / 2 - 11, { size: fit(g, en, o.size || 18, w - (x1 - x) - 40, 700), weight: 700, color: o.ec || COL.en });
    txt(g, ko, x1, y + h / 2 + 13, { size: fit(g, ko, 14, w - (x1 - x) - 40, 600), weight: 600, color: COL.muted });
    if (o.ok != null) mark(g, o.ok, x + w - 22, y + h / 2, 15);
    say(x, y, w, h, en.replace(/\s*\(.*\)$/, ''));
  }
  const MAP = { ox: 150, oy: 210, s: 150 };   // 왼쪽 큰 지도
  const D = DR.DEMO;

  const SCENES = {
    /* 00 들어가며: 제목 → Where is train station? → Excuse me … → 긴 대답(조각 셋) → 되짚기 → That's right! */
    intro(g, u) {
      fade(g, ramp(u, 0.2, 0.6) * (1 - ramp(u, 4.0, 0.5)), () => {
        txt(g, '길 묻기, 들은 길은 되짚어 확인한다', W / 2, 262, { size: 52, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Asking for directions · 말 걸기에서 고맙다는 말까지 일곱 단계', W / 2, 330, { size: 23, weight: 500, color: COL.muted, align: 'center' });
        DR.PLACES.forEach((p, i) => fade(g, ramp(u, 0.9 + i * 0.22, 0.4), () => {
          const x = W / 2 + (i - 3) * 132;
          circ(g, x, 440, 32, COL.panel2); ring(g, x, 440, 32, DR.ME_FIRST[p.id] ? COL.verb : COL.accent, 1.8);
          icon(g, p.id, x, 440, 30, COL.soft);
          txt(g, String(i + 1), x, 392, { size: 14, weight: 700, fam: FM, color: COL.accent, align: 'center' });
          txt(g, p.ko, x, 496, { size: fit(g, p.ko, 15, 126, 600), weight: 600, color: COL.muted, align: 'center' });
          if (i < 6) arrow(g, x + 38, 440, x + 92, 440, COL.faint, 2);
        }));
      });
      const it = DR.INTRO;
      fade(g, ramp(u, 4.6, 0.4), () => {
        // 오른쪽 지도: 출발 → (길 안내 동안) 길이 그려짐 → (되짚은 뒤) 걸어감
        const M = { ox: 832, oy: 206, s: 104 }, walkP = clamp((u - 24.4) / 2.6);
        const w = walkP > 0 ? walkAlong(M, D, walkP) : null;
        town(g, M, { route: u >= 15.6 ? D : null, routeP: clamp((u - 15.6) / 4.6), arrows: true, labels: u >= 17.2 ? ['bank', 'park'] : [], reveal: u >= 26.2 ? ['trainstation'] : [], pin: u >= 26.6 ? 'trainstation' : null,
          hl: u >= 17.2 ? { bank: COL.ante } : {}, walker: w ? { x: w.x, y: w.y, h: w.h } : { p: DR.segPoint(DR.DEMO_START.key, DR.DEMO_START.t), h: 'E' } });
        txt(g, '지금 여기 → 동쪽을 보고 서 있어요', 790, 488, { size: 14, weight: 600, color: COL.muted });
        // 대화
        const A = answer(g, { x: LX, y: 150, w: 690, A: it.lit, B: u >= 10.4 ? it.ok : null, p: (u - 10.4) / 0.9, at: 5.0, u, size: 22, maxW: 560, trapAt: 6.4, strikeAt: 6.6, verdict: u >= 11.6 ? { ok: true, at: 11.6 } : null });
        fade(g, win(u, 6.9, 10.2), () => {
          talk(g, { side: 'L', x: LX, y: 150 + A.bh + 12, w: 690, text: '…Sorry?', kind: 'local', sp: 'us', at: 7.0, u, size: 22 });
          tag(g, 'Excuse me 없이 · the 없이 → 퉁명스러워요', A.bx + A.bw, 150 + A.bh + 92, COL.trap, { align: 'right', size: 15, h: 32 });
        });
        const ans = DR.say(D, 'blocks', { dist: false });
        const B = talk(g, { side: 'L', x: LX, y: 254, w: 690, text: ans, marks: DR.sayKeys(D, 'blocks').map(k => [k, 'key']), kind: 'local', sp: 'us', at: 15.0, u, roleAt: 16.8, size: 20, quick: true });
        fade(g, win(u, 17.4, 21.2), () => {
          [['동작', 'go straight · turn left', 'move'], ['기준점', 'at the bank', 'mark'], ['위치', 'on your right', 'mark']].forEach(([k, e, ic], i) => {
            const x = LX + 66 + i * 212, y = 254 + B.bh + 26;
            fade(g, ramp(u, 17.6 + i * 0.4, 0.3), () => { panel(g, x, y - 18, 198, 36, { fill: COL.panel2, stroke: COL.ante }); icon(g, ic, x + 18, y, 17, COL.ante); txt(g, k, x + 34, y, { size: 14, weight: 800, color: COL.ante }); txt(g, e, x + 34 + tw(g, k, 14, 800) + 8, y, { size: fit(g, e, 14, 198 - 50 - tw(g, k, 14, 800), 600), weight: 600, color: COL.en }); });
          });
        });
        const cb = DR.Lr(DR.modelLine(D, 'blocks'));
        const C = answer(g, { x: LX, y: 384, w: 690, A: cb, at: 21.2, u, size: 20, maxW: 560, verdict: u >= 23.6 ? { ok: okOf(DR.dirQ(D, 'blocks'), cb), at: 23.6 } : null });
        talk(g, { side: 'L', x: LX, y: 384 + C.bh + 12, w: 690, text: 'That\'s right!', kind: 'local', sp: 'us', at: 24.0, u, size: 22 });
        fade(g, ramp(u, 25.4, 0.4), () => tag(g, '들은 길은 되짚어 확인한다', LX + 690, 554, COL.accent, { align: 'right', size: 17, h: 36 }));
      });
    },

    /* 01 길 묻기 지도: 일곱 단계를 길을 따라 걸으며 */
    route(g, u) {
      const sel = S.stop;
      const X = i => 150 + i * 163, Y = 300;
      fade(g, ramp(u, 0.3, 0.6), () => {
        rr(g, 90, Y - 30, 1100, 60, 30); g.fillStyle = COL.road; g.fill();
        g.strokeStyle = 'rgba(238,241,244,0.18)'; g.lineWidth = 2; g.setLineDash([12, 14]); g.beginPath(); g.moveTo(110, Y); g.lineTo(1170, Y); g.stroke(); g.setLineDash([]);
        txt(g, '듣기 · 받아들이기', (X(2) + X(4)) / 2, Y - 64, { size: 14, weight: 700, color: COL.ante, align: 'center' });
        g.strokeStyle = 'rgba(110,200,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(2) - 30, Y - 48); g.lineTo(X(4) + 30, Y - 48); g.stroke();
        txt(g, '내가 먼저 말해요', (X(0) + X(1)) / 2, Y - 64, { size: 14, weight: 700, color: COL.verb, align: 'center' });
        g.strokeStyle = 'rgba(201,167,255,0.5)'; g.beginPath(); g.moveTo(X(0) - 30, Y - 48); g.lineTo(X(1) + 30, Y - 48); g.stroke();
      });
      const AT = [0.8, 2.6, 6.2, 8.0, 9.8, 12.4, 14.6];
      const wp = sel != null ? (sel / 6) : clamp((u - 0.8) / 15);
      DR.PLACES.forEach((p, i) => {
        const x = X(i), on = sel === i, dim = sel != null && !on, me = DR.ME_FIRST[p.id] && u >= 18.2;
        fade(g, ramp(u, AT[i], 0.45) * (dim ? 0.4 : 1), () => {
          circ(g, x, Y, 30, on ? COL.accent : COL.panel2); ring(g, x, Y, 30, on ? COL.accent : me ? COL.verb : COL.ante, me ? 3.2 : 2.2);
          icon(g, p.id, x, Y, 30, on ? '#1D1305' : COL.text);
          chip(g, String(i + 1), x + 24, Y - 26, { size: 12, fam: FM, weight: 700, color: '#1D1305', fill: COL.accent, h: 20, r: 10, pad: 6, align: 'center' });
          txt(g, p.ko, x, Y + 54, { size: fit(g, p.ko, 16, 156, 700), weight: 700, color: me ? COL.verb : COL.soft, align: 'center' });
          txt(g, DR.STAGE_DESC[p.id], x, Y + 80, { size: fit(g, DR.STAGE_DESC[p.id], 13.5, 156, 600), weight: 600, color: COL.muted, align: 'center' });
        });
        HITS.push({ x: x - 34, y: Y - 34, w: 68, h: 68, stop: i });
      });
      // 걷는 사람
      fade(g, ramp(u, 0.8, 0.4), () => walkerDraw(g, lerp(X(0) - 52, X(6) + 40, wp), Y + 2, 0, 11));
      const by = 430, bh = 140;
      if (sel != null) {
        const p = DR.PLACES[sel];
        panel(g, LX, by, 1120, bh, { fill: COL.panel, stroke: COL.accent });
        icon(g, p.id, LX + 28, by + 26, 22, COL.accent);
        txt(g, `${sel + 1}. ${p.ko}`, LX + 48, by + 26, { size: 17, weight: 700, color: COL.accent });
        txt(g, DR.STAGE_DESC[p.id], LX + 60 + tw(g, `${sel + 1}. ${p.ko}`, 17, 700), by + 26, { size: 14, weight: 600, color: COL.muted });
        DR.STAGE_LINES[p.id].forEach(([who, en], k) => {
          const y = by + 62 + k * 32;
          chip(g, who === 'me' ? '나' : '상대', LX + 40, y, { size: 12, weight: 700, color: who === 'me' ? '#F2C29A' : COL.ante, fill: COL.panel2, h: 22, r: 11, pad: 8, align: 'center' });
          const R = richLay(g, en, [], 17, 980, { weight: 600 }); richDraw(g, R, LX + 74, y, { color: who === 'me' ? COL.rel : COL.en });
          if (who === 'me') say(LX + 70, y - 15, R.w + 8, 30, en); else listen(LX + 70, y - 15, R.w + 8, 30, [{ text: en, sp: 'us' }]);
        });
      } else {
        DR.PLACES.forEach((p, i) => fade(g, ramp(u, 12.2 + i * 0.3, 0.4), () => {
          const x = LX + i * 161, t = DR.STAGE_LINES[p.id][0][1], me = DR.ME_FIRST[p.id] && u >= 18.2;
          panel(g, x, by, 151, bh - 30, { fill: COL.panel, stroke: me ? COL.verb : COL.faint, lw: me ? 2 : 1.5 });
          txt(g, `${i + 1}`, x + 14, by + 20, { size: 13, weight: 700, fam: FM, color: COL.accent });
          txt(g, me ? '내가 먼저' : '듣고 대답', x + 140, by + 20, { size: 12, weight: 700, color: me ? COL.verb : COL.muted, align: 'right' });
          const R = richLay(g, t, [], 14, 130, { weight: 600 });
          richDraw(g, R, x + 12, by + 48, { color: COL.en });
          say(x, by, 151, bh - 30, t);
        }));
        fade(g, ramp(u, 24.2, 0.5), () => { tag(g, '나라 · 사람마다 달라요', 1200, 126, COL.muted, { align: 'right', size: 14, h: 26 }); icon(g, 'phone', 1200 - tw(g, '나라 · 사람마다 달라요', 14, 700) - 52, 126, 22, COL.muted); });
      }
    },

    /* 02 말 걸기와 묻기: Excuse me · Sorry to bother you · Hey! → 묻는 틀 셋 → teach → 곳 이름 표 */
    greet(g, u) {
      if (S.greet) {
        const a = S.greet.a, j = DR.judge('gr_cue', a, { place: S.greet.place }, '상황');
        txt(g, `가려는 곳 → ${DR.factKo('place', S.greet.place)}`, LX, 160, { size: 18, weight: 700, color: COL.clause });
        avatar(g, LX + 34, 230, 30, 'local', {}); txt(g, '(지나가는 사람)', LX + 74, 230, { size: 15, weight: 600, color: COL.muted });
        answer(g, { x: LX, y: 290, w: 1120, A: a, all: true, u: 99, size: 24, maxW: 900, verdict: { ok: j.ok, at: -1 } });
        whyLine(g, j, 420);
        return;
      }
      // 0–6 말 거는 말
      fade(g, 1 - ramp(u, 5.8, 0.4), () => {
        fade(g, ramp(u, 0.3, 0.4), () => { avatar(g, LX + 60, 250, 46, 'local', {}); txt(g, '지나가는 사람', LX + 60, 318, { size: 15, weight: 600, color: COL.muted, align: 'center' }); txt(g, '(모르는 사람)', LX + 60, 342, { size: 13, weight: 600, color: COL.dim, align: 'center' }); });
        const G = DR.SCENE.greet;
        answer(g, { x: 260, y: 170, w: 600, A: G[0], at: 0.8, u, size: 28, verdict: { ok: true, at: 1.6 } });
        answer(g, { x: 260, y: 252, w: 600, A: G[1], at: 2.2, u, size: 28, verdict: { ok: true, at: 3.0 } });
        answer(g, { x: 260, y: 334, w: 600, A: G[2], at: 3.6, u, size: 28, trapAt: 4.2, strikeAt: 4.4, verdict: { ok: false, at: 4.8 }, tag: ['친구를 부르는 말처럼 들려요', COL.trap, 4.8], tagY: 334 + 78 });
        fade(g, ramp(u, 1.8, 0.4), () => { panel(g, 900, 170, 300, 200, { fill: COL.panel, stroke: COL.faint }); txt(g, 'Excuse me.', 1050, 220, { size: 26, weight: 700, color: COL.verb, align: 'center' }); txt(g, '→ 실례합니다', 1050, 252, { size: 15, weight: 600, color: COL.muted, align: 'center' }); txt(g, '말을 걸 때 · 지나갈 때', 1050, 290, { size: 14, weight: 600, color: COL.soft, align: 'center' }); txt(g, '눈을 맞추고, 짧게', 1050, 320, { size: 14, weight: 600, color: COL.soft, align: 'center' }); say(900, 170, 300, 120, 'Excuse me.'); });
      });
      // 6–12 묻는 틀 셋 (빈칸 → 곳 이름)
      fade(g, win(u, 6.0, 12.2), () => {
        DR.SCENE.asks.forEach((a, i) => {
          const y = 190 + i * 104, F = DR.FRAME[a.f], blank = ansToks({ f: a.f }).map(t => t.t === '___' ? Object.assign(t, { r: 'blank', bw: 150, t: '곳' }) : t);
          const filled = ansToks(a), p = clamp((u - (8.0 + i * 0.6)) / 0.7);
          fade(g, ramp(u, 6.2 + i * 0.4, 0.4), () => {
            txt(g, ['① 어떻게 가요?', '② 근처에 있나요?', '③ 가장 가까운 곳'][i], LX, y - 30, { size: 15, weight: 700, color: COL.muted });
            const LA = lay(g, blank, { x: LX, y, size: 28 }), LB = lay(g, filled, { x: LX, y, size: 28 });
            if (p > 0) morph(g, LA, LB, p); else drawLay(g, LA);
            say(LX, y - 22, Math.max(LA.w, LB.w), 44, DR.text(a));
            fade(g, ramp(u, 9.0 + i * 0.4, 0.4), () => txt(g, ['the + 하나뿐인 곳', 'a + 여러 곳에 있는 곳', 'the nearest + 곳'][i], 1200, y, { size: 16, weight: 700, color: COL.clause, align: 'right' }));
          });
        });
      });
      // 12–18 teach → tell
      fade(g, win(u, 12.2, 18.2), () => {
        const [teach, how] = DR.SCENE.teach;
        thought(g, '(한국어로) 길 좀 가르쳐 주세요', LX, 168, 420);
        answer(g, { x: LX, y: 240, w: 1120, A: teach, B: u >= 15.2 ? how : null, p: (u - 15.2) / 0.8, at: 12.8, u, size: 26, verdict: { ok: true, at: 13.6 }, tag: ['통해요 · teach는 수업에서 가르치는 말', COL.rel, 13.8, 15.0], tagY: 240 + 80 });
        fade(g, ramp(u, 16.0, 0.4), () => {
          card(g, 600, 360, 290, 'tell me how to get to …', '어떻게 가는지 말로', { icon: 'ask', ic: COL.clause, ok: true });
          card(g, 910, 360, 290, 'show me the way to …', '같이 가며 · 지도로', { icon: 'mark', ic: COL.clause, ok: true });
          card(g, LX, 360, 500, 'teach me the way to …', '알아듣지만 어색 · 수업처럼 가르치다', { icon: 'library', ic: COL.rel });
        });
      });
      // 18–36 곳 이름 표
      if (u >= 18.0) fade(g, ramp(u, 18.2, 0.4), () => {
        const rows = [
          ['마트', 'supermarket', 'supermarket · grocery store', 'mart → 헷갈려요', false, 18.6],
          ['편의점', 'convenience', 'convenience store', 'a convenience → 헷갈려요', false, 20.6],
          ['지하철역', 'subway', 'subway station', 'UK: underground · the tube', true, 24.4],
          ['화장실', 'restroom', 'restroom · bathroom', 'UK: toilets', true, 26.6],
          ['횡단보도', 'crosswalk', 'crosswalk', 'UK: pedestrian crossing', true, 30.4],
          ['사거리', 'intersection', 'intersection', '', null, 31.6],
          ['신호등', 'lights', 'traffic lights · the lights', '', null, 32.8],
          ['주유소', 'gasstation', 'gas station', 'UK: petrol station', true, 34.0],
        ];
        panel(g, 60, 150, 1160, 424, { fill: COL.panel, stroke: COL.faint });
        [['한국어', 90], ['영어 (미국에서 흔한 말)', 330], ['조심 · 영국 영어', 820]].forEach(([h, x]) => txt(g, h, x, 176, { size: 15, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, 194, 1120, 1);
        rows.forEach(([ko, ic, en, note, uk, at], i) => fade(g, ramp(u, at, 0.4), () => {
          const y = 220 + i * 44;
          circ(g, 296, y, 15, COL.panel2); icon(g, ic === 'convenience' ? 'convenience' : ic, 296, y, 19, COL.soft);
          txt(g, ko, 90, y, { size: 19, weight: 700 });
          txt(g, en, 330, y, { size: fit(g, en, 20, 470, 700), weight: 700, color: COL.clause }); say(326, y - 18, 470, 36, en.split(' · ')[0]);
          if (note) { const bad = uk === false; if (bad) cross(g, 830, y, 12, COL.bad); else check(g, 830, y, 12, COL.good); txt(g, note, 848, y, { size: fit(g, note, 17, 340, 700), weight: 700, color: bad ? COL.trap : COL.ante }); }
        }));
      });
    },

    /* 03 동작 낱말: 지도 위에서 go straight · turn left/right(바라보는 쪽 기준) · second left · cross · past · until · turn left와 on your left */
    move(g, u) {
      const M = MAP, X0 = 700;
      const start = DR.DEMO_START, sp = DR.segPoint(start.key, start.t);
      if (S.move) {
        const r = S.move.res;
        town(g, M, { labels: ['bank'], extraPaths: [{ pts: r.pts, color: r.ok ? COL.ante : COL.trap, lw: 5 }], walker: { p: r.pts[r.pts.length - 1], h: HANG[r.h], color: COL.accent } });
        const st = S.move.start, sx = DR.segPoint(st.key, st.t), [x, y] = TP(M, sx[0], sx[1]); ring(g, x, y, 14, COL.clause, 2.5);
        panel(g, X0, 160, 500, 250, { fill: COL.panel, stroke: COL.faint });
        txt(g, `출발 → ${DR.HEAD_KO[st.h]}을 보고 서 있어요`, X0 + 20, 194, { size: 17, weight: 700, color: COL.clause });
        txt(g, S.move.text, X0 + 20, 240, { size: fit(g, S.move.text, 22, 460, 700), weight: 700, color: COL.en });
        txt(g, r.ok ? `도착 → ${DR.HEAD_KO[r.h]}을 보며 멈춰요` : '그쪽으로는 길이 없어요(지도 끝)', X0 + 20, 286, { size: 16, weight: 600, color: r.ok ? COL.soft : COL.trap });
        const R = richLay(g, '왼쪽 · 오른쪽은 화면이 아니라 걷는 사람이 바라보는 쪽이 기준이에요.', [], 15, 460, { weight: 600 }); richDraw(g, R, X0 + 20, 330, { color: COL.muted });
        return;
      }
      // A 0–6: go straight → turn left/right
      if (u < 6.2) {
        const p = clamp((u - 0.8) / 1.8), x = lerp(sp[0], 1 - 0.18, p);
        town(g, M, { walker: { p: [x, 1], h: 'E' }, extraPaths: [{ pts: [sp, [x, 1]], color: 'rgba(110,200,255,0.8)', lw: 4, dash: [2, 9] }] });
        if (u >= 3.0) fade(g, ramp(u, 3.0, 0.4), () => { turnArrow(g, M, [1, 1], 'E', 'left', COL.ante, { label: 'turn left', labelSide: 'right' }); turnArrow(g, M, [1, 1], 'E', 'right', COL.clause, { label: 'turn right', labelSide: 'right' }); });
        fade(g, ramp(u, 0.8, 0.4), () => card(g, X0, 170, 500, 'go straight · keep going', '앞으로 쭉 가요', { icon: 'move', ic: COL.ante }));
        fade(g, ramp(u, 3.2, 0.4), () => card(g, X0, 246, 500, 'turn left · turn right', '왼쪽 · 오른쪽으로 돌아요', { icon: 'move', ic: COL.ante }));
        return;
      }
      // B 6–12: 바라보는 쪽 기준
      if (u < 12.2) {
        const a = ramp(u, 6.2, 0.4);
        fade(g, a, () => {
          // 화살표 색 = 오른쪽 카드 색 (지도 위 이름표는 이웃 곳의 이름을 가려서 쓰지 않아요)
          town(g, M, { walker: { p: [2, 1.42], h: 'N', color: COL.accent } });
          walkerDraw(g, ...TP(M, 2, 0.58), HANG.S, 9, COL.clause);
          if (u >= 7.2) turnArrow(g, M, [2, 1], 'N', 'left', COL.accent, { k: 0.3 });
          if (u >= 8.8) turnArrow(g, M, [2, 1], 'S', 'left', COL.clause, { k: 0.3 });
          card(g, X0, 170, 500, 'turn left (북쪽을 보면)', '→ 화면의 왼쪽(서쪽)으로', { icon: 'walker', ic: COL.accent, stroke: COL.accent });
          fade(g, ramp(u, 8.8, 0.4), () => card(g, X0, 246, 500, 'turn left (남쪽을 보면)', '→ 화면의 오른쪽(동쪽)으로', { icon: 'walker', ic: COL.clause, stroke: COL.clause }));
          fade(g, ramp(u, 10.0, 0.4), () => tag(g, '화면이 아니라 걷는 사람이 기준', X0 + 500, 352, COL.rel, { align: 'right', size: 15, h: 32 }));
        });
        return;
      }
      // C 12–18: the second left · turn left twice
      if (u < 18.2) {
        const second = DR.applyMoves(start, [{ k: 'turn', dir: 'left', nth: 2 }]), twice = DR.applyMoves(start, [{ k: 'turn', dir: 'left', nth: 1 }, { k: 'turn', dir: 'left', nth: 1 }]);
        fade(g, ramp(u, 12.2, 0.4), () => {
          town(g, M, { labels: ['bank'], walker: { p: sp, h: 'E' }, extraPaths: [
            { pts: second.pts, color: COL.good, lw: 5, p: clamp((u - 13.2) / 1.6) },
            { pts: twice.pts, color: COL.trap, lw: 4, dash: [8, 7], p: clamp((u - 15.4) / 1.6) }] });
          // 1st · 2nd는 교차점 바로 아래, 길 위에 (이웃 자리의 그림을 가리지 않게)
          fade(g, ramp(u, 12.8, 0.4), () => { [[1, '1st', COL.soft], [2, '2nd', COL.good]].forEach(([c, t, col]) => { const [x, y] = TP(M, c, 1.2); chip(g, t, x, y, { size: 12, weight: 700, color: col, fill: 'rgba(16,21,28,0.92)', h: 22, r: 6, pad: 5, align: 'center' }); }); });
          card(g, X0, 170, 500, 'take the second left', '두 번째로 나오는 왼쪽 길로 한 번', { icon: 'move', ic: COL.good, ok: true, stroke: COL.good });
          fade(g, ramp(u, 15.4, 0.4), () => card(g, X0, 246, 500, 'turn left twice', '왼쪽으로 두 번 → 다른 곳에 가요', { icon: 'move', ic: COL.trap, ok: false, stroke: COL.trap }));
        });
        return;
      }
      // D 18–24: go past the post office → cross the street (횡단보도에서)
      if (u < 24.2) {
        const p1 = clamp((u - 18.6) / 2.2), p2 = clamp((u - 21.4) / 1.4);
        fade(g, ramp(u, 18.2, 0.4), () => {
          const wk = p2 > 0 ? [lerp(0.86, 1.16, p2), 0.86] : [lerp(0.1, 0.86, p1), 0.86];
          town(g, M, { labels: ['postoffice', 'cafe'], labelPos: { cafe: 'above', postoffice: 'above' }, hl: p1 > 0.75 ? { postoffice: COL.ante } : {}, walker: { p: wk, h: 'E' } });
          card(g, X0, 170, 500, 'go past the post office', '우체국을 지나서 가요', { icon: 'postoffice', ic: COL.ante });
          fade(g, ramp(u, 21.2, 0.4), () => card(g, X0, 246, 500, 'cross the street', '횡단보도에서 길을 건너요 (crosswalk)', { icon: 'crosswalk', ic: COL.ante }));
        });
        return;
      }
      // E 24–30: keep going until you get to the bank
      if (u < 30.2) {
        const p = clamp((u - 24.8) / 3.0), pts = [sp, [2, 1], [2, 0.55]], at = pathAt(pts, p < 1 ? p * 0.72 : lerp(0.72, 1, clamp((u - 28.0) / 1.0)));
        fade(g, ramp(u, 24.2, 0.4), () => {
          town(g, M, { labels: ['bank'], hl: u >= 27.4 ? { bank: COL.accent } : {}, walker: { p: [at.x, at.y], h: at.ang }, extraPaths: [{ pts, color: 'rgba(110,200,255,0.75)', lw: 4, dash: [2, 9], p: Math.min(p * 0.72, 1) }] });
          card(g, X0, 170, 500, 'keep going until you get to the bank', '은행이 나올 때까지 쭉 가요', { icon: 'move', ic: COL.ante });
          fade(g, ramp(u, 27.4, 0.4), () => card(g, X0, 246, 500, 'then turn left', '은행이 나오면 그때 돌아요', { icon: 'bank', ic: COL.accent }));
        });
        return;
      }
      // F 30–36: turn left와 on your left
      fade(g, ramp(u, 30.2, 0.4), () => {
        town(g, M, { labels: ['trainstation', 'bank'], reveal: ['trainstation'], hl: { trainstation: COL.clause }, walker: { p: [2, 0.62], h: 'N' }, extraPaths: [{ pts: DR.DEMO.path, color: 'rgba(110,200,255,0.6)', lw: 4, dash: [2, 9] }] });
        const [x, y] = TP(M, 2, 0.5);
        fade(g, ramp(u, 31.0, 0.4), () => { arrow(g, x + 14, y, x + 56, y, COL.clause, 3); tag(g, 'on your right', x + 64, y - 26, COL.clause, { size: 13, h: 26, align: 'left' }); });
        panel(g, X0, 160, 240, 190, { fill: COL.panel, stroke: COL.ante });
        txt(g, 'turn left', X0 + 120, 192, { size: 22, weight: 800, color: COL.ante, align: 'center' }); say(X0, 170, 240, 40, 'turn left');
        g.strokeStyle = COL.ante; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(X0 + 140, 330); g.lineTo(X0 + 140, 270); g.quadraticCurveTo(X0 + 140, 240, X0 + 110, 240); g.lineTo(X0 + 80, 240); g.stroke(); arrowHead(g, X0 + 70, 240, Math.PI, COL.ante, 13);
        txt(g, '움직이는 동작', X0 + 120, 336, { size: 14, weight: 700, color: COL.muted, align: 'center' });
        fade(g, ramp(u, 31.6, 0.4), () => {
          panel(g, X0 + 260, 160, 240, 190, { fill: COL.panel, stroke: COL.clause });
          txt(g, 'on your left', X0 + 380, 192, { size: 22, weight: 800, color: COL.clause, align: 'center' }); say(X0 + 260, 170, 240, 40, 'on your left');
          g.strokeStyle = COL.soft; g.lineWidth = 4; g.beginPath(); g.moveTo(X0 + 400, 330); g.lineTo(X0 + 400, 236); g.stroke(); arrowHead(g, X0 + 400, 226, -Math.PI / 2, COL.soft, 12);
          rr(g, X0 + 318, 260, 46, 40, 5); g.fillStyle = '#463A22'; g.fill(); g.strokeStyle = COL.clause; g.lineWidth = 2.5; g.stroke();
          txt(g, '그 자리에 있는 곳', X0 + 380, 336, { size: 14, weight: 700, color: COL.muted, align: 'center' });
        });
        fade(g, ramp(u, 33.4, 0.4), () => { const R = richLay(g, 'So, I turn left at the bank, and turn right? → 마지막에 돌지 않아요. it\'s on my right.', [['turn right', 'trap'], ['it\'s on my right', 'slot']], 16, 500, { weight: 600 }); richDraw(g, R, X0, 384, { color: COL.soft }); });
      });
    },

    /* 04 기준점과 위치: at the bank · lights · corner → on your right → across from · next to → between · on the corner of → in front of · behind */
    mark(g, u) {
      const M = MAP, X0 = 700;
      if (S.rel) {
        const id = S.rel, rels = DR.relationsOf(id), hl = { [id]: COL.accent };
        rels.forEach(r => [].concat(r.of).forEach(x => { if (DR.SPOT[x]) hl[x] = COL.clause; }));
        town(g, M, { reveal: [id], labels: [id].concat(rels.flatMap(r => [].concat(r.of).filter(x => DR.SPOT[x]))).filter((x, i, a) => a.indexOf(x) === i), hl, stops: true });
        panel(g, X0, 160, 500, 60 + Math.max(1, rels.length) * 44, { fill: COL.panel, stroke: COL.accent });
        legendRow(g, id, X0 + 16, 188, { color: COL.accent });
        if (!rels.length) txt(g, '이름이 보이는 기준점과 맞닿은 관계가 없어요.', X0 + 20, 232, { size: 15, weight: 600, color: COL.muted });
        rels.forEach((r, k) => { const t = `It's ${DR.REL[r.rel].en(r.of)}.`; txt(g, t, X0 + 20, 232 + k * 44, { size: fit(g, t, 18, 460, 700), weight: 700, color: COL.clause }); txt(g, DR.REL[r.rel].ko(r.of), X0 + 20, 252 + k * 44, { size: 13, weight: 600, color: COL.muted }); say(X0 + 16, 214 + k * 44, 470, 40, t); });
        return;
      }
      const seg = u < 6.2 ? 0 : u < 12.2 ? 1 : u < 18.2 ? 2 : u < 24.2 ? 3 : u < 30.2 ? 4 : 5;
      const SG = [
        { labels: ['bank', 'hotel', 'police'], hl: { bank: COL.ante, lights: COL.ante }, cards: [['at the bank', '은행에서 (그 교차점에서)', 'bank'], ['at the lights', '신호등에서 (traffic lights)', 'lights'], ['at the corner', '모퉁이에서', 'intersection']] },
        { labels: ['trainstation', 'bank'], reveal: ['trainstation'], hl: { trainstation: COL.clause }, walker: { p: [2, 0.66], h: 'N' }, cards: [['It\'s on your right.', '걷는 사람의 오른쪽에 있어요', 'mark'], ['It\'s on your left.', '걷는 사람의 왼쪽에 있어요', 'mark']] },
        { labels: ['trainstation', 'bank', 'park'], reveal: ['trainstation'], hl: { trainstation: COL.accent, park: COL.clause, bank: COL.ante }, cards: [['across from the park', '공원 맞은편 (길 건너)', 'park'], ['next to the bank', '은행 바로 옆', 'bank']] },
        { labels: ['pharmacy', 'cafe', 'postoffice'], labelPos: { cafe: 'below', postoffice: 'below' }, reveal: ['pharmacy'], hl: { pharmacy: COL.accent, cafe: COL.clause, postoffice: COL.ante }, cards: [['between the café and the post office', '카페와 우체국 사이', 'pharmacy'], ['on the corner of Hill Street and Main Street', '두 길이 만나는 모퉁이 (우체국)', 'intersection']] },
        { labels: ['supermarket', 'school', 'pharmacy'], labelPos: { school: 'right', pharmacy: 'below' }, reveal: ['supermarket', 'pharmacy'], hl: { supermarket: COL.clause, stopS: COL.accent, school: COL.ante, pharmacy: COL.accent }, stops: true, cards: [['in front of the supermarket', '마트 앞 (버스 정류장)', 'bus'], ['behind the pharmacy', '약국 뒤 (같은 블록 반대쪽)', 'school']] },
        { labels: ['trainstation', 'bank', 'park'], reveal: ['trainstation'], hl: { trainstation: COL.accent }, cards: [['train station ↔ park → across from', '맞은편 (규칙 엔진이 지도에서 계산)', 'mark'], ['train station ↔ bank → next to', '바로 옆 (규칙 엔진이 지도에서 계산)', 'mark']] },
      ][seg];
      const s0 = [0, 6.2, 12.2, 18.2, 24.2, 30.2][seg];
      fade(g, ramp(u, s0, 0.4), () => {
        town(g, M, { labels: SG.labels, labelPos: SG.labelPos, reveal: SG.reveal, hl: SG.hl, walker: SG.walker, stops: SG.stops });
        if (seg === 0) { const [x, y] = TP(M, 2, 1); ring(g, x, y, 34, COL.ante, 2.5, [5, 5]); if (u >= 3.4) turnArrow(g, M, [2, 1], 'E', 'left', COL.ante, { k: 0.3 }); }
        // left · right 이름표는 걷는 사람의 앞쪽 양옆에 (곳 이름표를 가리지 않게)
        if (seg === 1) { const [x, y] = TP(M, 2, 0.24); fade(g, ramp(u, 7.0, 0.4), () => { tag(g, 'left', x - 16, y, COL.soft, { size: 13, h: 24, align: 'right' }); tag(g, 'right', x + 16, y, COL.clause, { size: 13, h: 24, align: 'left' }); }); }
        if (seg === 2) {
          const st = lotRect(M, DR.lotOfSpot('trainstation')), bk = lotRect(M, DR.lotOfSpot('bank')), [px, py] = TP(M, 1.78, 0.5);
          fade(g, ramp(u, 13.0, 0.4), () => { g.strokeStyle = COL.clause; g.lineWidth = 3; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(st.x - 2, st.cy); g.lineTo(px + 4, py); g.stroke(); g.setLineDash([]); arrowHead(g, px, py, Math.PI, COL.clause, 10); arrowHead(g, st.x - 2, st.cy, 0, COL.clause, 10); });
          fade(g, ramp(u, 15.4, 0.4), () => { g.strokeStyle = COL.ante; g.lineWidth = 3; g.beginPath(); g.moveTo(st.cx + st.w * 0.62, st.y + st.h); g.quadraticCurveTo(st.cx + st.w, (st.cy + bk.cy) / 2, bk.cx + bk.w * 0.62, bk.y); g.stroke(); });
        }
        if (seg === 3) {
          // between: 카페(민트) · 약국(노랑) · 우체국(하늘) 색칠로 보여 줘요 (꺾쇠는 위쪽 도서관 그림을 가로질러서 쓰지 않아요)
          fade(g, ramp(u, 21.4, 0.4), () => { const [x, y] = TP(M, 1, 1); g.strokeStyle = COL.ante; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 50, y - 12); g.lineTo(x - 12, y - 12); g.lineTo(x - 12, y - 50); g.stroke(); });
        }
        if (seg === 4) fade(g, ramp(u, 27.4, 0.4), () => { const sc = lotRect(M, DR.lotOfSpot('school')), ph = lotRect(M, DR.lotOfSpot('pharmacy')); g.strokeStyle = COL.ante; g.lineWidth = 2.5; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(sc.cx, sc.y + sc.h + 2); g.lineTo(ph.cx, ph.y - 2); g.stroke(); g.setLineDash([]); });
        SG.cards.forEach(([en, ko, ic], k) => fade(g, ramp(u, s0 + 0.6 + k * 2.6, 0.4), () => card(g, X0, 170 + k * 80, 500, en, ko, { icon: ic, ic: k ? COL.clause : COL.ante, h: 66 })));
        if (seg === 5) fade(g, ramp(u, 31.4, 0.4), () => { const R = richLay(g, 'next to와 across from을 헷갈리면 길 건너편이 아닌 옆 건물로 가요. 영상 · 지도 · 퀴즈의 관계는 모두 같은 계산이에요.', [], 15, 480, { weight: 600 }); richDraw(g, R, X0, 360, { color: COL.muted }); });
      });
    },

    /* 05 거리 · 시간 · 교통 */
    far(g, u) {
      if (S.bus) {
        const b = S.bus, R = DR.BUS_DEMO, line = DR.Lr([{ k: 'bus', num: b.num }, { k: 'stop', where: b.where }, { k: 'off', nth: b.nth }]), j = DR.judge(DR.dirQ(R, 'stop'), line, DR.BUS_CARD, '상황');
        talk(g, { side: 'L', x: LX, y: 150, w: 1120, text: DR.say(R, 'stop'), marks: DR.sayKeys(R, 'stop').map(k => [k, 'key']), kind: 'local', sp: 'us', all: true, u: 99, size: 22 });
        answer(g, { x: LX, y: 250, w: 1120, A: line, all: true, u: 99, size: 22, maxW: 900, verdict: { ok: j.ok, at: -1 } });
        whyLine(g, j, 360);
        if (!j.ok && j.cb && j.cb.fix) talk(g, { side: 'L', x: LX, y: 410, w: 1120, text: j.cb.fix.en, kind: 'local', sp: 'us', all: true, u: 99, size: 22 });
        return;
      }
      // A 0–5.5
      fade(g, win(u, 0.4, 5.6), () => {
        talk(g, { side: 'L', x: LX, y: 170, w: 760, text: 'It\'s about a five-minute walk.', marks: [['five-minute walk', 'key']], kind: 'local', sp: 'us', at: 0.8, u, size: 26 });
        talk(g, { side: 'L', x: LX, y: 270, w: 760, text: 'It\'s two blocks from here.', marks: [['two blocks', 'key']], kind: 'cap', sp: 'ca', at: 2.8, u, size: 26 });
        panel(g, 900, 160, 300, 270, { fill: COL.panel, stroke: COL.faint });
        circ(g, 1050, 260, 70, '#E9EDF1'); ring(g, 1050, 260, 70, '#9AA6AA', 3);
        g.beginPath(); g.moveTo(1050, 260); g.arc(1050, 260, 60, -Math.PI / 2, -Math.PI / 2 + Math.PI / 6); g.closePath(); g.fillStyle = 'rgba(255,193,94,0.55)'; g.fill();
        g.strokeStyle = COL.ink; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(1050, 260); g.lineTo(1050 + Math.sin(Math.PI / 6) * 52, 260 - Math.cos(Math.PI / 6) * 52); g.stroke();
        txt(g, '5분 → five minutes', 1050, 366, { size: 18, weight: 700, color: COL.en, align: 'center' }); txt(g, '걸어서 → a … walk', 1050, 394, { size: 15, weight: 600, color: COL.muted, align: 'center' });
        say(900, 330, 300, 80, 'a five-minute walk');
      });
      // B 5.5–11
      fade(g, win(u, 5.6, 11.2), () => {
        staff(g, 'fr_far', { x: LX, y: 170, w: 1000, at: 5.9, u, roleAt: 7.0, size: 24 });
        answer(g, { x: LX, y: 270, w: 1000, A: DR.o('fr_which2'), at: 8.0, u, size: 26, verdict: { ok: true, at: 8.7 } });
        answer(g, { x: LX, y: 350, w: 1000, A: DR.o('fr_num'), at: 9.2, u, size: 22, trapAt: 9.6, strikeAt: 9.8, verdict: { ok: false, at: 10.1 }, tag: ['낱말만 툭 던지면 퉁명스러워요', COL.trap, 10.1], tagY: 350 + 70 });
      });
      // C 11–16.5 fifteen · fifty
      fade(g, win(u, 11.2, 16.7), () => {
        DR.PAIRS.forEach(([n1, w1, n2, w2], i) => fade(g, ramp(u, 11.6 + i * 0.4, 0.3), () => {
          const x = LX + i * 250, y = 190;
          const draw = (s, xx, yy) => { const m = s.match(/^([a-z]*)([A-Z]+)([a-z]*)$/); let x2 = xx; [[m[1], 0], [m[2], 1], [m[3], 0]].forEach(([p, big]) => { if (!p) return; x2 += txt(g, p.toLowerCase(), x2, yy, { size: big ? 28 : 20, weight: big ? 800 : 500, color: big ? COL.accent : COL.soft }); }); };
          txt(g, n1, x, y, { size: 18, weight: 700, fam: FM, color: COL.muted }); draw(w1, x + 36, y);
          txt(g, n2, x, y + 46, { size: 18, weight: 700, fam: FM, color: COL.muted }); draw(w2, x + 36, y + 46);
          say(x, y - 18, 220, 80, `${w1.toLowerCase()}, ${w2.toLowerCase()}`);
        }));
        fade(g, ramp(u, 13.0, 0.4), () => {
          [[15, '#6EC8FF', '→ 동쪽 · Riverside Market'], [50, '#C9A7FF', '← 서쪽 · Stadium']].forEach(([n, c, d], k) => {
            const x = LX + 40 + k * 420, y = 360;
            rr(g, x, y - 50, 340, 100, 14); g.fillStyle = COL.panel; g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.stroke();
            icon(g, 'bus', x + 50, y, 46, c); chip(g, String(n), x + 120, y, { size: 30, weight: 800, fam: FM, color: '#1D1305', fill: c, h: 52, r: 10, pad: 14 });
            txt(g, d, x + 120, y + 38, { size: 13, weight: 700, color: COL.muted });
            say(x, y - 50, 340, 100, `the number ${n} bus`);
          });
          txt(g, '번호를 잘못 들으면 반대쪽으로 가요', LX + 880, 360, { size: 15, weight: 700, color: COL.trap });
        });
      });
      // D 16.5–22 정류장 세기
      fade(g, win(u, 16.7, 22.2), () => {
        talk(g, { side: 'L', x: LX, y: 160, w: 1120, text: 'Get off at the third stop.', marks: [['third stop', 'key']], kind: 'tourist', sp: 'au', at: 17.0, u, size: 26 });
        busLine(g, 200, 360, 900, 15, 3, { shown: (u - 17.8) / 0.5, here: '타는 곳' });
        fade(g, ramp(u, 20.0, 0.4), () => txt(g, 'first · second · third · fourth → 1st · 2nd · 3rd · 4th', W / 2, 470, { size: 20, weight: 700, color: COL.en, align: 'center' }));
      });
      // E 22–27 Exit 3
      fade(g, win(u, 22.2, 27.2), () => {
        talk(g, { side: 'L', x: LX, y: 170, w: 760, text: 'Take the subway, and use Exit 3.', marks: [['Exit 3', 'key']], kind: 'uk', sp: 'gb', at: 22.5, u, size: 26 });
        panel(g, 900, 160, 300, 250, { fill: COL.panel, stroke: COL.faint });
        rr(g, 950, 210, 200, 90, 10); g.fillStyle = '#F4D23A'; g.fill();
        icon(g, 'exit', 995, 255, 50, '#1E2630', 2.4); txt(g, '3', 1100, 256, { size: 54, weight: 800, fam: FM, color: '#1E2630', align: 'center' });
        txt(g, 'EXIT 3 → 3번 출구', 1050, 340, { size: 18, weight: 700, color: COL.en, align: 'center' }); txt(g, 'three · third (세 번째)', 1050, 370, { size: 15, weight: 600, color: COL.muted, align: 'center' });
        say(900, 160, 300, 250, 'Exit 3');
      });
      // F 27–32 나라마다
      fade(g, ramp(u, 27.2, 0.4), () => {
        card(g, LX, 170, 540, 'Go two blocks.', '미국 · 캐나다 → 블록으로 세기', { icon: 'intersection', ic: COL.ante });
        card(g, LX + 580, 170, 540, 'Take the second turning on the left.', '영국 → 두 번째 왼쪽 길 (turning)', { icon: 'move', ic: COL.verb });
        card(g, LX, 260, 540, 'It\'s about 500 metres.', '미터 · 킬로미터', { icon: 'walker', ic: COL.clause });
        card(g, LX + 580, 260, 540, 'It\'s about a quarter of a mile.', '마일 (미국 · 영국)', { icon: 'walker', ic: COL.clause });
        fade(g, ramp(u, 28.6, 0.4), () => { const R = richLay(g, '휴대폰 지도가 있어도 길은 자주 물어요. 어떤 단위로 말하든 동작 · 기준점 · 위치 조각은 같아요.', [], 16, 1100, { weight: 600 }); richDraw(g, R, LX, 380, { color: COL.muted }); });
      });
    },

    /* 06 되짚기: 조각 셋 → So, ___? → 한 줄 → 틀린 조각만 고쳐 줌 → 한 조각만 확인 → 엔진이 찾는 것 */
    check(g, u) {
      const q = DR.dirQ(D, 'blocks', { dist: false }), en = DR.say(D, 'blocks', { dist: false });
      if (S.check) {
        const a = DR.Lr(S.check.line), j = DR.judge(q, a, DR.DEMO_CARD, '상황');
        talk(g, { side: 'L', x: LX, y: 150, w: 1120, text: en, marks: q.key.map(k => [k, 'key']), kind: 'local', sp: 'us', all: true, u: 99, size: 21 });
        const A = answer(g, { x: LX, y: 250, w: 1120, A: a, all: true, u: 99, size: 22, maxW: 900, verdict: { ok: j.ok, at: -1 } });
        const reply = j.ok ? j.cb.reply : j.cb && j.cb.fix ? j.cb.fix : null;
        if (reply) talk(g, { side: 'L', x: LX, y: 250 + A.bh + 14, w: 1120, text: reply.en, kind: 'local', sp: 'us', all: true, u: 99, size: 22 });
        whyLine(g, j, 470);
        return;
      }
      // 상대의 말 (늘 위)
      const B = talk(g, { side: 'L', x: LX, y: 150, w: 1120, text: en, marks: q.key.map(k => [k, 'key']), kind: 'local', sp: 'us', at: 0.6, u, roleAt: 2.4, size: 21, quick: true });
      const yy = 150 + B.bh + 20;
      // A 0–6: 조각 셋
      fade(g, win(u, 2.6, 6.4), () => {
        [['동작', 'go straight for two blocks · turn left', 'move'], ['기준점', 'at the bank', 'mark'], ['도착 위치', 'it\'s on your right', 'mark']].forEach(([k, e, ic], i) => fade(g, ramp(u, 2.8 + i * 0.6, 0.4), () => card(g, LX + i * 380, yy, 360, e, k, { icon: ic, ic: COL.ante })));
      });
      // B 6–12: So, ___?
      const line = DR.modelLine(D, 'blocks'), full = DR.Lr(line);
      const blanks = [{ id: 'so#0', t: 'So,', r: 'frame' }, { id: 'i#0', t: 'I', r: 'frame' }].concat(line.map((c, i) => ({ id: 'b' + i, t: ['동작', '동작', '위치'][i] || '조각', r: 'blank', bw: 170 }))).concat([{ id: '?#0', t: '?', r: '' }]);
      fade(g, win(u, 6.4, 12.4), () => {
        const L = lay(g, blanks, { x: LX + 40, y: yy + 50, size: 30 });
        drawLay(g, L);
        fade(g, ramp(u, 8.2, 0.4), () => tag(g, 'your → my', LX + 40, yy + 120, COL.clause, { align: 'left' }));
        fade(g, ramp(u, 8.8, 0.4), () => txt(g, 'on your right (상대) → on my right (나)', LX + 190, yy + 120, { size: 18, weight: 700, color: COL.soft }));
      });
      // C 12–18: 한 줄 되짚기 → That's right!
      fade(g, win(u, 12.4, 18.4), () => {
        const A = answer(g, { x: LX, y: yy, w: 1120, toksA: blanks.filter(t => t.r !== 'frame' || true), A: full, B: full, toksB: ansToks(full), p: (u - 12.8) / 1.2, at: 12.6, u, size: 24, maxW: 900, verdict: u >= 15.2 ? { ok: true, at: 15.2 } : null, sayB: DR.text(full) });
        talk(g, { side: 'L', x: LX, y: yy + A.bh + 14, w: 1120, text: 'That\'s right!', kind: 'local', sp: 'us', at: 15.6, u, size: 24 });
      });
      // D 18–24: 틀린 조각 → 그 조각만
      const wrong = line.map(c => c.k === 'turn' ? Object.assign({}, c, { dir: 'right' }) : c), cb = DR.checkBack(D, wrong);
      fade(g, win(u, 18.4, 24.4), () => {
        const A = answer(g, { x: LX, y: yy, w: 1120, A: DR.Lr(wrong), at: 18.6, u, size: 24, maxW: 900, verdict: { ok: false, at: 19.6 }, style: it => it.t === 'right' && it.r === 'slot' && it.id === 'right#0' ? { r: 'trap' } : null });
        talk(g, { side: 'L', x: LX, y: yy + A.bh + 14, w: 1120, text: cb.fix.en, marks: [['turn left at the bank', 'key']], kind: 'local', sp: 'us', at: 20.2, u, size: 24 });
        fade(g, ramp(u, 21.8, 0.4), () => tag(g, '맞은 조각은 다시 말하지 않아요 → 그 조각만', LX + 1120, yy + A.bh + 98, COL.rel, { align: 'right', size: 15, h: 32 }));
      });
      // E 24–30: 한 조각만
      const part = [line.find(c => c.k === 'turn')], cbp = DR.checkBack(D, part);
      fade(g, win(u, 24.4, 30.4), () => {
        const A = answer(g, { x: LX, y: yy, w: 1120, A: DR.Lr(part), at: 24.6, u, size: 26, verdict: { ok: true, at: 25.4 } });
        talk(g, { side: 'L', x: LX, y: yy + A.bh + 14, w: 1120, text: cbp.reply.en, kind: 'local', sp: 'us', at: 25.8, u, size: 24 });
        fade(g, ramp(u, 27.0, 0.4), () => tag(g, '한 조각만 확인해도 돼요 · 들은 곳까지', LX + 1120, yy + A.bh + 98, COL.clause, { align: 'right', size: 15, h: 32 }));
      });
      // F 30–36: 엔진이 찾는 것
      fade(g, ramp(u, 30.4, 0.4), () => {
        const rows = [['빠진 조각', 'So, I go straight for two blocks, and it\'s on my right?'], ['다른 방향', '… turn right at the bank …'], ['다른 기준점', '… turn left at the post office …'], ['turn ↔ on', '… and turn right?'], ['두 번 돌기', 'So, I turn left twice?'], ['순서', 'So, it\'s on my right, and I turn left?']];
        rows.forEach(([k, e], i) => fade(g, ramp(u, 30.6 + i * 0.3, 0.3), () => { const x = LX + (i % 2) * 560, y = yy + 8 + Math.floor(i / 2) * 56; panel(g, x, y, 540, 46, { fill: COL.panel, stroke: COL.faint }); txt(g, k, x + 16, y + 23, { size: 15, weight: 800, color: COL.trap }); txt(g, e, x + 130, y + 23, { size: fit(g, e, 15, 400, 600), weight: 600, color: COL.soft }); }));
      });
    },

    /* 07 다시 묻기 */
    repair(g, u) {
      fade(g, win(u, 0.3, 6.4), () => {
        staff(g, 'dr_fast', { x: LX, y: 170, w: 1120, at: 0.6, u, size: 22 });
        answer(g, { x: LX, y: 280, w: 1120, A: DR.o('rp_again'), at: 3.0, u, size: 26, maxW: 900, verdict: { ok: true, at: 3.8 } });
        fade(g, ramp(u, 4.2, 0.4), () => tag(g, '짐작하지 말고 다시 물어요', LX + 1120, 380, COL.clause, { align: 'right', size: 15, h: 32 }));
      });
      fade(g, win(u, 6.4, 12.4), () => {
        talk(g, { side: 'L', x: LX, y: 160, w: 560, text: '… then hang a ((?)) at the bank.', marks: [['((?))', 'trap']], kind: 'cap', sp: 'ca', at: 6.6, u, size: 22 });
        answer(g, { x: LX, y: 250, w: 560, A: DR.o('rp_lr'), at: 7.8, u, size: 26, verdict: { ok: true, at: 8.4 } });
        talk(g, { side: 'L', x: 660, y: 160, w: 540, text: 'Take the ((?)) bus.', marks: [['((?))', 'trap']], kind: 'tourist', sp: 'au', at: 9.2, u, size: 22 });
        answer(g, { x: 660, y: 250, w: 540, A: DR.o('rp_bus'), at: 10.0, u, size: 26, verdict: { ok: true, at: 10.6 } });
        fade(g, ramp(u, 10.8, 0.4), () => txt(g, '들린 만큼 되묻기 → 안 들린 부분만 다시 말해 줘요', W / 2, 380, { size: 18, weight: 700, color: COL.clause, align: 'center' }));
      });
      fade(g, win(u, 12.4, 18.4), () => {
        answer(g, { x: LX, y: 180, w: 760, A: DR.o('rp_map'), at: 12.8, u, size: 26, verdict: { ok: true, at: 13.6 } });
        panel(g, 920, 150, 240, 400, { fill: '#0B0F14', stroke: '#3A434D', r: 30 });
        town(g, { ox: 960, oy: 250, s: 52 }, { names: false, reveal: ['museum'], pin: u >= 15.0 ? 'museum' : null, walker: { p: [0.5, 1], h: 'E' } });
        txt(g, '지도에서 보여 주세요', 1040, 470, { size: 14, weight: 700, color: COL.soft, align: 'center' });
      });
      fade(g, win(u, 18.4, 24.4), () => {
        staff(g, 'th_local', { x: LX, y: 180, w: 1000, at: 18.7, u, roleAt: 19.8, size: 26 });
        answer(g, { x: LX, y: 280, w: 1000, A: DR.o('th_anyway'), at: 20.6, u, size: 28, verdict: { ok: true, at: 21.4 } });
        fade(g, ramp(u, 21.8, 0.4), () => tag(g, '시간을 내 준 고마움 → Thanks anyway', LX + 1000, 380, COL.verb, { align: 'right', size: 15, h: 32 }));
      });
      fade(g, ramp(u, 24.4, 0.4), () => {
        staff(g, 'th_local', { x: LX, y: 180, w: 1000, all: true, u: 99, size: 26 });
        answer(g, { x: LX, y: 280, w: 1000, A: DR.o('th_bye'), B: u >= 27.0 ? DR.o('th_anyway') : null, p: (u - 27.0) / 0.8, at: 24.6, u, size: 28, trapAt: 25.2, strikeAt: 25.4, verdict: u >= 28.0 ? { ok: true, at: 28.0 } : { ok: false, at: 25.8 }, tag: ['무뚝뚝하게 들려요', COL.trap, 25.8, 26.9], tagY: 280 + 84 });
      });
    },

    /* 08 한 줄로 되짚기: 조각마다 세 번 · 한 줄 한 번 · 틀린 조각만 고쳐 줌 */
    oneline(g, u) {
      const line = DR.modelLine(D, 'blocks'), full = DR.Lr(line);
      const PIECE = [['Straight for two blocks?', 'Yes.'], ['Then left at the bank?', 'Yes, left at the bank.'], ['And it\'s on my right?', 'That\'s right.']];
      // 왼쪽: 조각마다
      fade(g, ramp(u, 0.3, 0.4) * (1 - ramp(u, 23.8, 0.4)), () => {
        txt(g, '조각마다 따로', LX, 156, { size: 18, weight: 800, color: COL.muted });
        PIECE.forEach(([me, you], i) => {
          const y = 186 + i * 118;
          answer(g, { x: LX, y, w: 540, A: null, toksA: me.split(' ').map((w, k) => ({ id: w + k, t: w, r: k === me.split(' ').length - 1 ? 'slot' : 'slot' })), sayA: me, at: 0.8 + i * 1.8, u, size: 18 });
          talk(g, { side: 'L', x: LX, y: y + 54, w: 540, text: you, kind: 'local', sp: 'us', at: 1.6 + i * 1.8, u, size: 18 });
        });
        fade(g, ramp(u, 6.2, 0.4), () => chip(g, '주고받기 3번', LX + 270, 548, { size: 18, weight: 800, color: COL.trap, fill: COL.panel2, stroke: COL.trap, h: 38, r: 10, align: 'center' }));
      });
      // 오른쪽: 한 줄
      fade(g, ramp(u, 11.8, 0.4) * (1 - ramp(u, 17.8, 0.4)), () => {
        txt(g, '한 줄로', 660, 156, { size: 18, weight: 800, color: COL.muted });
        const A = answer(g, { x: 660, y: 186, w: 540, A: full, at: 12.2, u, size: 20, maxW: 380, verdict: { ok: true, at: 15.0 } });
        talk(g, { side: 'L', x: 660, y: 186 + A.bh + 14, w: 540, text: 'That\'s right!', kind: 'local', sp: 'us', at: 15.4, u, size: 20 });
        fade(g, ramp(u, 16.0, 0.4), () => chip(g, '주고받기 1번', 930, 548, { size: 18, weight: 800, color: COL.good, fill: COL.panel2, stroke: COL.good, h: 38, r: 10, align: 'center' }));
      });
      // 18–24: 한 줄에 틀린 조각 하나
      const wrong = line.map(c => c.k === 'turn' ? Object.assign({}, c, { dir: 'right' }) : c), cb = DR.checkBack(D, wrong);
      fade(g, win(u, 17.8, 24.2), () => {
        txt(g, '한 줄에 틀린 조각 하나', 660, 156, { size: 18, weight: 800, color: COL.muted });
        const A = answer(g, { x: 660, y: 186, w: 540, A: DR.Lr(wrong), at: 18.2, u, size: 20, maxW: 380, verdict: { ok: false, at: 19.6 } });
        const B = talk(g, { side: 'L', x: 660, y: 186 + A.bh + 14, w: 540, text: cb.fix.en, marks: [['turn left at the bank', 'key']], kind: 'local', sp: 'us', at: 20.0, u, size: 20 });
        fade(g, ramp(u, 21.6, 0.4), () => tag(g, '맞은 조각은 다시 말하지 않아요', 1200, 186 + A.bh + B.bh + 50, COL.rel, { align: 'right', size: 15, h: 32 }));
      });
      // 24–30: 3 → 1
      fade(g, ramp(u, 24.2, 0.5), () => {
        txt(g, '3', 420, 360, { size: 160, weight: 800, fam: FD, color: COL.trap, align: 'center' });
        arrow(g, 520, 360, 760, 360, COL.accent, 5);
        txt(g, '1', 860, 360, { size: 160, weight: 800, fam: FD, color: COL.good, align: 'center' });
        txt(g, '주고받는 수 → 조각마다 3번 · 한 줄이면 1번', W / 2, 500, { size: 20, weight: 700, color: COL.soft, align: 'center' });
        fade(g, ramp(u, 26.0, 0.4), () => txt(g, '조각의 순서 = 들은 차례 그대로', W / 2, 540, { size: 17, weight: 700, color: COL.clause, align: 'center' }));
      });
    },

    /* 09 3단계 말하기 법 */
    method(g, u) {
      const BOX = [['①', '열쇠 낱말 잡기', '곳 이름 · 동작 · 기준점 · 위치', COL.ante, 5.5], ['②', '틀에 내 정보 넣기', 'how to get to ___ · So, ___?', COL.rel, 11.0], ['③', '공손하게 끝내기', 'Excuse me · Thanks anyway', COL.verb, 16.5]];
      const sel = S.place;
      BOX.forEach(([n, t1, t2, c, at], k) => {
        const on = sel != null || u >= at, x0 = LX + k * 385;
        fade(g, ramp(u, 0.6 + k * 0.3, 0.5), () => {
          panel(g, x0, 146, 365, 100, { fill: on ? COL.panel2 : COL.panel, stroke: on ? c : COL.faint, lw: on ? 2.2 : 1.5 });
          txt(g, n, x0 + 20, 176, { size: 26, weight: 700, color: c });
          txt(g, t1, x0 + 62, 176, { size: 22, weight: 800, fam: FD });
          txt(g, t2, x0 + 20, 220, { size: fit(g, t2, 15, 330, 600), weight: 600, color: on ? COL.en : COL.dim });
          if (k < 2) arrow(g, x0 + 367, 196, x0 + 383, 196, COL.accent, 2.5);
        });
      });
      DR.METHOD.forEach(([qid, a, c, sty], i) => {
        const y = 284 + i * 41, q = qid === 'dir' ? DR.dirQ(c.route, sty, { dist: false }) : DR.Q[qid], p = DR.PLACES[i], dim = sel != null && sel !== i;
        fade(g, ramp(u, 1.4 + i * 0.3, 0.4) * (dim ? 0.35 : 1), () => {
          if (sel === i) { rr(g, LX - 6, y - 18, 1132, 36, 8); g.fillStyle = 'rgba(255,193,94,0.10)'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 1.5; g.stroke(); }
          circ(g, LX + 14, y, 15, COL.panel2); icon(g, p.id, LX + 14, y, 18, DR.ME_FIRST[p.id] ? COL.verb : COL.soft);
          const keysOn = sel != null || u >= 6.0 + i * 0.3, ansOn = sel != null || u >= 11.4 + i * 0.4, polOn = sel != null || u >= 17.0;
          const t = q.cue ? '(지나가는 사람)' : qid === 'dir' ? (i === 2 ? 'Take the second left.' : i === 3 ? 'It\'s on your right, across from the park.' : 'Go straight for two blocks and turn left …') : (q.short && /[?!.]$/.test(q.short) ? q.short : q.en);
          const R = richLay(g, t, keysOn && !q.cue ? (qid === 'dir' ? [['second left', 'key'], ['on your right', 'key'], ['across from the park', 'key'], ['two blocks', 'key'], ['turn left', 'key']] : Qm(q)) : [], 16, 430, { weight: 500 });
          richDraw(g, R, LX + 44, y, { color: q.cue ? COL.muted : COL.soft });
          if (!q.cue) listen(LX + 40, y - 16, R.w + 8, 32, [{ text: q.en, sp: q.sp || 'us' }]);
          if (ansOn) fade(g, sel != null ? 1 : ramp(u, 11.4 + i * 0.4, 0.4), () => {
            txt(g, '→', 548, y, { size: 18, weight: 700, color: COL.muted });
            pieces(g, ansParts(a).map(([tt, r]) => [tt, r === 'pol' && !polOn ? 'frame' : r]), 580, y, 16.5, 620);
            say(576, y - 16, 624, 32, DR.text(a));
          });
        });
      });
    },

    /* 10 실전: 길 카드 하나로 넷 */
    practice(g, u) {
      const pi = u < PSEG[1] ? 0 : u < PSEG[2] ? 1 : u < PSEG[3] ? 2 : 3, v = u - PSEG[pi];
      const P = DR.PRACTICE[pi], C = DR.PCARD, q = DR.practiceQ(P), R = DR.PROUTE;
      const a = ramp(v, 0, 0.5) * (pi < 3 ? 1 - ramp(u, PSEG[pi + 1] - 0.4, 0.4) : 1);
      // 왼쪽: 길 카드 + 작은 지도 (계속 보임)
      fade(g, ramp(u, 0, 0.5), () => {
        rr(g, LX, 150, 330, 178, 14); g.fillStyle = COL.paper; g.fill();
        g.save(); rr(g, LX, 150, 330, 178, 14); g.clip(); g.fillStyle = '#22324A'; g.fillRect(LX, 150, 330, 40); g.restore();
        icon(g, 'mark', LX + 22, 170, 20, '#FFFFFF'); txt(g, '길 카드 · DIRECTIONS CARD', LX + 40, 171, { size: 15, weight: 700, color: '#FFFFFF' });
        DR.cardRows(C).forEach(([k, val], i) => { const y = 210 + i * 30; txt(g, k, LX + 14, y, { size: 13, weight: 600, color: '#5B6168' }); txt(g, val, LX + 106, y, { size: fit(g, val, 14, 214, 700, 9), weight: 700, color: COL.ink }); });
        const M = { ox: 120, oy: 382, s: 76 }, walkP = pi === 3 ? clamp((v - 1.0) / 3.0) : pi === 2 && v >= PT.win ? 0 : 0;
        const w = pi === 3 ? walkAlong(M, R, walkP) : null;
        town(g, M, { names: false, route: pi >= 2 ? R : null, routeP: pi === 2 ? clamp((v - 1.0) / 2.5) : 1, arrows: pi >= 2, reveal: pi === 3 && walkP >= 0.98 ? ['subway'] : [], pin: pi === 3 && walkP >= 0.98 ? 'subway' : null, labels: ['church'],
          walker: w ? { x: w.x, y: w.y, h: w.h } : { p: DR.segPoint(DR.PSTART.key, DR.PSTART.t), h: 'W' } });
      });
      fade(g, a, () => {
        txt(g, `대화 ${pi + 1} / 4 · ${pi === 1 ? '첫 사람' : pi >= 2 ? '다음 사람' : '첫 사람'}`, 432, 150, { size: 16, weight: 500, fam: FM, color: COL.accent });
        if (q.cue) { avatar(g, 432 + 25, 196, 25, 'tourist', {}); txt(g, '(지나가는 사람 → 내가 먼저 말을 걸어요)', 432 + 62, 196, { size: 18, weight: 600, color: COL.muted }); }
        else talk(g, { side: 'L', x: 432, y: 172, w: 768, text: q.en, marks: q.key.map(k => [k, 'key']), kind: pi === 1 ? 'tourist' : 'cap', sp: pi === 1 ? 'au' : 'ca', at: PT.q, u: v, roleAt: PT.lines[0] + 0.4, size: 19, quick: true });
        const J = P.opts.map(o => DR.judge(q, o, C));
        const goneAt = k => { const s = J[k].stage; if (!s) return null; const same = P.opts.map((_, i) => i).filter(i => J[i].stage === s); return [0, PT.s1, PT.s2, PT.s3][s] + same.indexOf(k) * 1.1; };
        const oy = pi === 2 ? 290 : 262;
        P.opts.forEach((o, k) => {
          const y = oy + k * 54, gA = goneAt(k), won = k === P.a && v >= PT.win;
          fade(g, ramp(v, PT.opt[k], 0.4), () => {
            if (won) { rr(g, 432, y - 22, 768, 44, 10); g.fillStyle = 'rgba(127,224,168,0.08)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
            const gone = gA != null && v >= gA;
            txt(g, `(${'ABC'[k]})`, 446, y, { size: 17, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
            const parts = ansParts(o).map(([t, r]) => [t, gone ? 'dim' : (v >= PT.lines[1] + 0.4 || won) ? r : '']);
            const w = pieces(g, parts, 494, y, 17, 600, { color: gone ? COL.dim : COL.text });
            say(490, y - 18, w + 10, 36, DR.text(o));
            if (gone) { const p = clamp((v - gA) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(440, y + 1); g.lineTo(440 + (w + 64) * p, y + 1); g.stroke();
              fade(g, ramp(v, gA + 0.3, 0.3), () => tag(g, `${['', '①', '②', '③'][J[k].stage]} 탈락`, 1196, y, COL.trap, { align: 'right', size: 14, h: 28 })); }
            if (won) mark(g, true, 1172, y, 16);
          });
        });
        panel(g, 432, 446, 768, 128, { fill: COL.panel, stroke: COL.faint });
        const heads = ['① 열쇠 낱말', '② 틀 + 내 정보', '③ 공손 · 정답'];
        P.lines.forEach((ln, k) => fade(g, ramp(v, PT.lines[k] + 0.3, 0.5), () => {
          const y = 472 + k * 38;
          txt(g, heads[k], 450, y, { size: 15, weight: 700, color: [COL.ante, COL.rel, COL.verb][k] });
          txt(g, ln, 586, y, { size: fit(g, ln, 16, 600, 600, 10), weight: 600, color: k === 2 && v >= PT.win ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 300, 640], Y0 = 152, RH = 41;
      const rows = [
        ['greet', '말 걸기', 'Excuse me · Sorry to bother you', [['Excuse me', 'pol'], ['. ', 'frame'], ['Sorry to bother you', 'pol'], ['.', 'frame']]],
        ['ask', '묻기', '곳 이름 (마트 → supermarket)', [['Could you', 'pol'], [' tell me how to get to ', 'frame'], ['the train station', 'slot'], ['? · Is there ', 'frame'], ['a pharmacy', 'slot'], [' near here?', 'frame']]],
        ['move', '동작 듣기', 'go straight · turn left · the second left', [['take the second left', 'key'], [' ≠ ', ''], ['turn left twice', 'trap'], [' · ', ''], ['cross', 'key'], [' · ', ''], ['go past', 'key']]],
        ['mark', '기준점 · 위치', 'at the bank · on your right', [['turn left at the bank', 'key'], [' · ', ''], ['across from', 'key'], [' ≠ ', ''], ['next to', 'key'], [' · ', ''], ['on your right', 'key']]],
        ['far', '거리 · 교통', 'five-minute walk · the 15 bus · third stop', [['Which bus should I take?', 'frame'], [' · fifteen ≠ fifty', '']]],
        ['check', '되짚기', 'So, ___, ___, and it\'s on my ___?', [['So, I ', 'frame'], ['go straight for two blocks', 'slot'], [', ', 'frame'], ['turn left at the bank', 'slot'], [', and ', 'frame'], ['it\'s on my right', 'slot'], ['?', 'frame']]],
        ['thanks', '고맙다고 끝내기', 'That\'s right · not from around here', [['Great, ', 'frame'], ['thank you so much', 'pol'], ['! · That\'s okay. ', 'frame'], ['Thanks anyway', 'pol'], ['.', 'frame']]],
        [null, '못 알아들었을 때', '빠른 말 · 한 부분 · 지도', [['Sorry', 'pol'], [', could you say that again more slowly? · ', 'frame'], ['Sorry', 'pol'], [', left or right?', 'frame']]],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 10, { fill: COL.panel, stroke: COL.faint });
        ['단계', '열쇠 낱말', '틀 · 조각'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 16, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 6, 1120, 1);
      });
      rows.forEach(([pid, nm, keys, ans], ri) => fade(g, ramp(u, 1.0 + ri * 0.4, 0.5), () => {
        const y = Y0 + RH * (ri + 1) + 14;
        circ(g, X[0] + 32, y, 15, COL.panel2);
        if (pid) icon(g, pid, X[0] + 32, y, 18, DR.ME_FIRST[pid] ? COL.verb : COL.soft);
        else txt(g, '?', X[0] + 32, y + 1, { size: 18, weight: 800, color: COL.verb, align: 'center' });
        txt(g, nm, X[0] + 58, y, { size: fit(g, nm, 18, X[1] - X[0] - 70, 700), weight: 700 });
        txt(g, keys, X[1] + 20, y, { size: fit(g, keys, 15, X[2] - X[1] - 34, 600), weight: 600, color: COL.ante });
        pieces(g, ans, X[2] + 20, y, 16, 1196 - X[2] - 30);
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

  DRS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[DRS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    if (ch.place != null) strip(g, Array.isArray(ch.place) ? (u < (ch.placeAt || 6) ? ch.place[0] : ch.place[1]) : ch.place, ramp(u, 0.2, 0.5));
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, DRS.captionAt(t));
    if (opt.dry) HITS = keep;
  };
  // 그림 함수 (퀴즈 · 시뮬레이터 지도)
  DRS.draw = { town, walkerDraw, pinDraw, turnArrow, busLine, lotRect, legendRow, txt, chip, tag, panel, icon, arrow, circ, ring, rr, fit, tw, mark };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + DR.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔↗↘↑↓✓×÷?!~=+-–—/:…‘’\'%$≠①②③';
  DRS.baseText = EXTRA;
  DRS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = DRS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { DRS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
