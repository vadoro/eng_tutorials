(function () {
  'use strict';
  const CM = window.CM;
  const CMS = (window.CMS = {});
  const W = 1280, H = 720;
  CMS.W = W; CMS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  CMS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', paper: '#F4F1E8', ink: '#1E2630', teal: '#2F4A44', wood: '#3A2E25', red: '#B8432B',
  };
  CMS.COL = COL;
  // 역할 → 색 (낱말 조각 · 말풍선 글)
  const RC = { key: COL.ante, frame: COL.rel, slot: COL.clause, pol: COL.verb, trap: COL.trap, ok: COL.good, dim: COL.dim, bad: COL.bad };
  CMS.RC = RC;
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8', me: '#F2C29A' };
  const SHC = { yn: COL.ante, or: COL.rel, wh: COL.clause, note: COL.verb };   // 모양 표시의 색
  CMS.SHC = SHC;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (CMS.S = { stop: null, place: null, course: null, shape: null, wl: null, aux: null, oh: null, line: null, card: null });
  CMS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  CMS.hits = () => HITS;

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
  const strikeLine = (g, x0, x1, y, p, color = COL.bad) => { if (p <= 0) return; g.strokeStyle = color; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + (x1 - x0) * clamp(p), y); g.stroke(); };


  /* =========================================================
     아이콘 — 24×24 격자의 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요
     [길, 's'(선) | 'f'(채움)]
     곳 일곱(reg 수업 등록 · full 대기 명단 · class 수업 뒤 · hours 교수 면담 · ext 마감 연장 · dorm 기숙사 · ra 룸메이트 · RA) + 질문의 모양 넷 + 그 밖의 그림
     ========================================================= */
  const ICON = {
    reg: [['M4.5 5h15v10h-15z', 's'], ['M2.5 18.5h19', 's'], ['M9 10l2 2 4-4', 's']],
    full: [['M6 5h12v15.5H6z', 's'], ['M9.5 3.5h5v3h-5z', 's'], ['M9 11h6M9 14.5h6M9 18h3', 's']],
    class: [['M3.5 4.5h17v10h-17z', 's'], ['M8 20l4-5.5 4 5.5', 's'], ['M7 8.5h6M7 11.5h9', 's']],
    hours: [['M6 3.5h12v17H6z', 's'], ['M14.5 12.5h.01', 's'], ['M3.5 20.5h17', 's'], ['M9 7h6', 's']],
    ext: [['M4 6h16v14.5H4z', 's'], ['M4 10.5h16', 's'], ['M8.5 4v4M15.5 4v4', 's'], ['M8 15.5h7.5l-2.2-2.2', 's']],
    dorm: [['M3.5 7v13', 's'], ['M3.5 16h17v4', 's'], ['M3.5 12.5h17v3.5', 's'], ['M6 9.5h5v3H6z', 's']],
    ra: [['M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM3.5 20a5.5 5.5 0 0 1 11 0', 's'], ['M14.5 4h6v4.5h-3.2l-2.8 2.2z', 's']],
    id: [['M3.5 6h17v12h-17z', 's'], ['M8.5 11.4a1.9 1.9 0 1 0 0-3.8a1.9 1.9 0 0 0 0 3.8zM5.6 15.6a2.9 2.9 0 0 1 5.8 0', 's'], ['M13.5 9.5h4.5M13.5 13h3', 's']],
    shape_yn: [['M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8z', 's'], ['M14.4 12a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0z', 'f']],
    shape_or: [['M12 21.5V14', 's'], ['M12 14 6 8M12 14l6-6', 's'], ['M6 8v4.4M6 8h4.4', 's'], ['M18 8v4.4M18 8h-4.4', 's']],
    shape_wh: [['M3.5 6.5h17v11h-17z', 's'], ['M8 14h8', 's']],
    shape_note: [['M4.5 5h15v10h-8l-4 3.8V15h-3z', 's'], ['M9 10h.01M12 10h.01M15 10h.01', 's']],
    keypad: [['M5.5 3.5h13v17h-13z', 's'], ['M8.8 8h.01M12 8h.01M15.2 8h.01M8.8 11.5h.01M12 11.5h.01M15.2 11.5h.01M8.8 15h.01M12 15h.01M15.2 15h.01', 's']],
    atm: [['M3.5 4.5h17v7h-17z', 's'], ['M6.5 11.5v8h11v-8', 's'], ['M9.5 15.5h5', 's']],
    passport: [['M6 3.5h12v17H6z', 's'], ['M12 13.2a2.8 2.8 0 1 0 0-5.6a2.8 2.8 0 0 0 0 5.6z', 's'], ['M9.5 16.8h5', 's']],
    pen: [['M4.5 19.5l1-4L15.8 5.2a1.8 1.8 0 0 1 2.6 0l.4.4a1.8 1.8 0 0 1 0 2.6L8.5 18.5z', 's'], ['M13.8 7.2l3 3', 's']],
    lock: [['M6 11h12v9.5H6z', 's'], ['M8.5 11V7.5a3.5 3.5 0 0 1 6.9-.9', 's']],
    signal: [['M5 18.5v-2M9.5 18.5v-5M14 18.5v-8M18.5 18.5v-12', 's']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z', 's'], ['M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6', 's']],
    hand: [['M8.5 20.5c-2-1.6-3.5-4-3.5-6.5v-2.5a1.3 1.3 0 0 1 2.6 0V13', 's'], ['M7.6 12.5V6a1.3 1.3 0 0 1 2.6 0v5.5M10.2 11V4.5a1.3 1.3 0 0 1 2.6 0V11M12.8 11V5.5a1.3 1.3 0 0 1 2.6 0V12M15.4 12V8a1.3 1.3 0 0 1 2.6 0v6c0 3.5-2 6.5-5.5 6.5h-4', 's']],
    clock: [['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', 's'], ['M12 7.5V12l3 2', 's']],
    people: [['M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM3.5 20a5.5 5.5 0 0 1 11 0', 's'], ['M16 11a2.6 2.6 0 1 0 0-5.2M15.5 14.2a5 5 0 0 1 5 5.3', 's']],
    cash: [['M3 7h18v10H3z', 's'], ['M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0z', 's'], ['M6 10v4M18 10v4', 's']],
    receipt: [['M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z', 's'], ['M9 8h6M9 11.5h6M9 15h4', 's']],
    note: [['M6 3.5h9l3 3v14H6z', 's'], ['M15 3.5v3h3', 's'], ['M9 11h6M9 14h6M9 17h4', 's']],
    cal: [['M4 6h16v14.5H4z', 's'], ['M4 10.5h16', 's'], ['M8.5 4v4M15.5 4v4', 's']],
    phone: [['M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 6a2 2 0 0 1 2-2z', 's']],

    book: [['M4 5.5c3-1 5.5-1 8 .8v13c-2.5-1.8-5-1.8-8-.8z', 's'], ['M20 5.5c-3-1-5.5-1-8 .8v13c2.5-1.8 5-1.8 8-.8z', 's']],
    wrench: [['M14.5 4a4.5 4.5 0 0 0-4.1 6.3L4 16.7 7.3 20l6.4-6.4A4.5 4.5 0 0 0 20 9.5l-2.8 2.8-3-.5-.5-3L16.5 6A4.5 4.5 0 0 0 14.5 4z', 's']],
    music: [['M9 17.5V5.5l10-2v12', 's'], ['M9 17.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0z', 's']],
    heater: [['M4 7h16v11H4z', 's'], ['M7.5 7v11M10.5 7v11M13.5 7v11M16.5 7v11', 's'], ['M6 18v2M18 18v2', 's']],
    shower: [['M5 20V7a3 3 0 0 1 3-3h1a3 3 0 0 1 3 3', 's'], ['M9 9h6a3 3 0 0 0-6 0z', 's'], ['M10 13v1.5M12 13v2.5M14 13v1.5M11 17v1.5M13 17v1.5', 's']],
    light: [['M9 17h6M10 20h4', 's'], ['M12 3.5a5.5 5.5 0 0 0-3.2 10c.5.4.7.9.7 1.5V17h5v-2c0-.6.2-1.1.7-1.5A5.5 5.5 0 0 0 12 3.5z', 's']],
    wifi: [['M3.5 9.5a12 12 0 0 1 17 0', 's'], ['M6.5 12.8a7.5 7.5 0 0 1 11 0', 's'], ['M9.5 16a3.2 3.2 0 0 1 5 0', 's'], ['M12 19.2h.01', 's']],
    door: [['M6 3.5h12v17H6z', 's'], ['M14.5 12.5h.01', 's'], ['M3.5 20.5h17', 's']],
    alarm: [['M12 21a7.5 7.5 0 1 0 0-15a7.5 7.5 0 0 0 0 15z', 's'], ['M12 10v3.5l2.2 1.6', 's'], ['M4 6.5 7 4M20 6.5 17 4', 's']],
  };
  CMS.ICON = ICON;

  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = (typeof Path2D === 'function' ? new Path2D(d) : null));
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const parts = ICON[id]; if (!parts) return;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach(([d, m]) => { const p = path(d); if (!p) return; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  CMS.icon = icon;
  // HTML용 SVG (색은 currentColor)
  CMS.iconSVG = (id, cls = '', fill) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : m === 'b' && fill ? `<path d="${d}" fill="${fill}"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 질문의 모양 표시: 그림 + 이름 (영상 · 직접 해 보기 · 힌트 · 퀴즈) ---------- */
  function shapeMark(g, shape, cx, cy, size, o = {}) {
    const c = o.color || SHC[shape];
    if (o.disc !== false) { circ(g, cx, cy, size * 0.72, o.fill || COL.panel2); ring(g, cx, cy, size * 0.72, c, o.lw || 2); }
    icon(g, 'shape_' + shape, cx, cy, size, c, o.iw || 2);
  }
  CMS.shapeMark = shapeMark;
  function shapeTag(g, shape, x, y, o = {}) {
    const Sx = CM.SHAPE[shape], t = o.text || `${Sx.ko} → ${Sx.ans}`, size = o.size || 16, h = o.h || 36, c = SHC[shape];
    const w = tw(g, t, size, 700) + h + 22, x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    rr(g, x0, y - h / 2, w, h, 10); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = c; g.lineWidth = 1.6; g.stroke();
    icon(g, 'shape_' + shape, x0 + h / 2 + 4, y, h * 0.62, c, 2);
    txt(g, t, x0 + h + 8, y + 1, { size, weight: 700, color: c });
    return { x: x0, y: y - h / 2, w, h };
  }
  CMS.shapeTag = shapeTag;

  /* ---------- 사람 얼굴 (말풍선 옆). kind: clerk(등록 창구 · 미국) · prof(교수 · 캐나다) · housing(기숙사 사무실 · 영국) · ra(RA · 호주) · me ---------- */
  const LOOK = {
    clerk: { shirt: '#F4F6F8', coat: '#2E5A6A', hair: '#5A3A28', skin: '#E8BC95', badge: '#FFC15E' },
    prof: { shirt: '#DCE6F0', coat: '#6A5238', scarf: '#2F4A44', hair: '#8C8C8C', skin: '#E3B48D', glasses: true, long: true },
    housing: { shirt: '#F4F6F8', coat: '#26324A', hair: '#3A2A20', skin: '#C99169', lanyard: '#B8432B', long: true },
    ra: { shirt: '#E07A3A', hair: '#8A5A30', skin: '#E8BC95', lanyard: '#2F4A44' },
    me: { shirt: '#5D6FA8', hair: '#1F1B18', skin: '#E8BC95', scarf: '#7FA8C9', long: true },
  };
  CMS.LOOK = LOOK;
  const kindOf = q => { q = typeof q === 'string' ? CM.Q[q] : q; return q.sp === 'gb' ? 'housing' : q.sp === 'au' ? 'ra' : q.sp === 'ca' ? 'prof' : 'clerk'; };
  CMS.kindOf = kindOf;
  function avatar(g, x, y, r, kind, o = {}) {
    const L = LOOK[kind] || LOOK.clerk;
    circ(g, x, y, r, COL.panel2);
    g.save(); g.beginPath(); g.arc(x, y, r - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = L.shirt; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
    if (L.coat) {   // 겉옷(조끼 · 정장): 몸 전체 + 가운데 셔츠 V
      g.fillStyle = L.coat; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = L.shirt; g.beginPath(); g.moveTo(x - r * 0.2, y + r * 0.42); g.lineTo(x + r * 0.2, y + r * 0.42); g.lineTo(x, y + r * 0.95); g.closePath(); g.fill();
      g.strokeStyle = L.coat === '#F4F6F8' ? 'rgba(30,38,48,0.35)' : 'rgba(238,241,244,0.28)'; g.lineWidth = Math.max(1, r * 0.04); g.beginPath(); g.moveTo(x - r * 0.2, y + r * 0.42); g.lineTo(x - r * 0.04, y + r); g.moveTo(x + r * 0.2, y + r * 0.42); g.lineTo(x + r * 0.04, y + r); g.stroke();
      if (L.tie) { g.fillStyle = L.tie; g.beginPath(); g.moveTo(x - r * 0.06, y + r * 0.44); g.lineTo(x + r * 0.06, y + r * 0.44); g.lineTo(x + r * 0.09, y + r * 0.78); g.lineTo(x, y + r * 0.9); g.lineTo(x - r * 0.09, y + r * 0.78); g.closePath(); g.fill(); }
      if (L.badge) { g.fillStyle = L.badge; rr(g, x + r * 0.3, y + r * 0.66, r * 0.2, r * 0.12, r * 0.03); g.fill(); }
    }
    if (L.scarf) { g.fillStyle = L.scarf; rr(g, x - r * 0.3, y + r * 0.36, r * 0.6, r * 0.16, r * 0.06); g.fill(); rr(g, x + r * 0.1, y + r * 0.42, r * 0.14, r * 0.42, r * 0.05); g.fill(); }
    if (L.lanyard) { g.strokeStyle = L.lanyard; g.lineWidth = Math.max(1, r * 0.06); g.beginPath(); g.moveTo(x - r * 0.16, y + r * 0.4); g.lineTo(x - r * 0.03, y + r * 0.72); g.moveTo(x + r * 0.16, y + r * 0.4); g.lineTo(x + r * 0.03, y + r * 0.72); g.stroke(); g.fillStyle = '#F4F6F8'; rr(g, x - r * 0.13, y + r * 0.7, r * 0.26, r * 0.18, r * 0.03); g.fill(); }
    if (L.steth) { g.strokeStyle = L.steth; g.lineWidth = Math.max(1, r * 0.06); g.beginPath(); g.moveTo(x - r * 0.24, y + r * 0.4); g.quadraticCurveTo(x - r * 0.2, y + r * 0.86, x + r * 0.02, y + r * 0.86); g.stroke(); g.beginPath(); g.moveTo(x + r * 0.24, y + r * 0.4); g.quadraticCurveTo(x + r * 0.26, y + r * 0.7, x + r * 0.16, y + r * 0.8); g.stroke(); circ(g, x + r * 0.08, y + r * 0.88, r * 0.07, L.steth); }
    if (L.long) { g.fillStyle = L.hair; rr(g, x - r * 0.41, y - r * 0.34, r * 0.82, r * 0.74, r * 0.3); g.fill(); }
    g.fillStyle = L.skin; g.fillRect(x - r * 0.1, y + r * 0.18, r * 0.2, r * 0.22);
    circ(g, x, y - r * 0.08, r * 0.34, L.skin);
    g.fillStyle = L.hair; g.beginPath(); g.arc(x, y - r * 0.12, r * 0.36, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
    circ(g, x - r * 0.12, y - r * 0.04, r * 0.035, '#2B2420'); circ(g, x + r * 0.12, y - r * 0.04, r * 0.035, '#2B2420');
    if (L.glasses) { ring(g, x - r * 0.12, y - r * 0.04, r * 0.08, '#2B2420', Math.max(1, r * 0.03)); ring(g, x + r * 0.12, y - r * 0.04, r * 0.08, '#2B2420', Math.max(1, r * 0.03)); }
    g.strokeStyle = 'rgba(120,60,40,0.6)'; g.lineWidth = Math.max(1, r * 0.045); g.beginPath(); g.arc(x, y + r * 0.06, r * 0.1, 0.35, Math.PI - 0.35); g.stroke();
    g.restore();
    ring(g, x, y, r, o.live ? (SPC[o.sp] || COL.soft) : COL.faint, o.live ? 2.6 : 1.5);
    if (o.live) { g.save(); g.globalAlpha *= 0.45; ring(g, x, y, r + 5, SPC[o.sp] || COL.soft, 2); g.restore(); }
  }
  CMS.avatar = avatar;



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
  CMS.richLay = richLay; CMS.richDraw = richDraw;

  /* ---------- 낱말 조각 (대답 만들기): { id, t, r } → lay · morph · drawTok ---------- */
  const PUNCT = /^[.,?!]$/;
  function ansToks(a, o = {}) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    CM.segs(a).forEach(s => s.t.split(/\s+/).forEach(w => {
      if (!w) return;
      const m = w.match(/^(.*?)([.,?!]*)$/);
      if (m[1]) push(m[1], o.role != null ? o.role : s.r);
      if (m[2]) m[2].split('').forEach(p => push(p, ''));
    }));
    return out;
  }
  CMS.ansToks = ansToks;
  // 틀이 없는 글 (긴 말 등) → 조각. dim에 든 낱말은 흐리게
  function plainToks(s, dim = []) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    String(s).split(/\s+/).forEach(w => { const m = w.match(/^(.*?)([.,?!]*)$/); if (m[1]) push(m[1], dim.includes(m[1]) ? 'dim' : ''); if (m[2]) m[2].split('').forEach(p => push(p, '')); });
    return out;
  }
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
  /* 직원의 한 마디 (글 말풍선)
   * o: { side, x, y, w(칸 폭), text, marks, kind, sp, at, u, size, roleAt, fast, slow, all, strike, verdict: { ok, at }, shape, shapeAt }
   */
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
    const per = WD * (o.slow ? 1.9 : o.fast ? 0.45 : 1), dur = nWords(o.text) * per, live = u >= at && u < at + dur + 0.15;
    fade(g, a, () => {
      avatar(g, ax, ay, ar, o.kind || (side === 'L' ? 'clerk' : 'me'), { live, sp: o.sp });
      bubbleShape(g, side, bx, by, bw, bh, ax, ay, FILL[side], o.edge || EDGE[side]);
      const shown = o.all ? null : (u - at) / per;
      g.save(); g.translate(bx + 17, by + 10 + R.lh / 2); g.scale(sq, 1);
      richDraw(g, R, 0, 0, { shown, rolesOn: o.roleAt == null || u >= o.roleAt, color: o.color });
      g.restore();
      if (o.fast && live) { g.strokeStyle = 'rgba(238,241,244,0.35)'; g.lineWidth = 2; g.lineCap = 'round'; [0, 1, 2].forEach(k => { const yy = by + 12 + k * (bh - 24) / 2, ph = ((u * 3 + k * 0.33) % 1); g.beginPath(); g.moveTo(bx + bw + 8 + ph * 18, yy); g.lineTo(bx + bw + 28 + ph * 18, yy); g.stroke(); }); }
      if (o.strike != null && u >= o.strike) strikeLine(g, bx + 12, bx + bw - 12, by + bh / 2 + 1, (u - o.strike) / 0.4);
      if (o.verdict && u >= o.verdict.at) fade(g, ramp(u, o.verdict.at, 0.3), () => mark(g, o.verdict.ok, side === 'L' ? bx + bw + 22 : bx - 22, by + bh / 2, 17));
      if (o.shape && u >= (o.shapeAt == null ? at : o.shapeAt)) fade(g, ramp(u, o.shapeAt == null ? at : o.shapeAt, 0.4), () => shapeMark(g, o.shape, bx + bw + 30, by + Math.min(bh / 2, 26), 22, {}));
    });
    if (!o.noHit) listen(bx, by, bw, bh, [{ text: o.text, sp: o.sp || 'us', rate: o.fast ? 1.35 : o.slow ? 0.75 : 1 }]);
    return out;
  }
  CMS.talk = talk;
  // 직원의 말 (말 id로): 말풍선 + 열쇠 낱말 (+ 모양 표시)
  const Qobj = q => typeof q === 'string' ? CM.Q[q] : q;
  const Qm = q => Qobj(q).key.map(k => [k, 'key']);
  const staff = (g, q, o) => { q = Qobj(q); return talk(g, Object.assign({ side: 'L', text: q.en, marks: q.fast ? [] : Qm(q), kind: kindOf(q), sp: q.sp, fast: !!q.fast, shape: o && o.shape === false ? null : q.shape }, o, o && o.shape === false ? { shape: null } : {})); };
  /* 나의 대답 (낱말 조각 말풍선, 두 대답 사이를 morph). maxW를 주면 여러 줄
   * o: { x, y, w, A, B, p, at, u, size, strikeAt, verdict, tag: [글, 색, at, 사라짐], trapAt, toksA, sayA, tagX, tagY, maxW }
   */
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
      if (LB && p > 0) morph(g, LA, LB, p, {}); else drawLay(g, LA);
      g.restore();
      if (o.strikeAt != null && u >= o.strikeAt && p < 0.01) strikeLine(g, bx + 12, bx + bw - 12, by + bh / 2 + 1, (u - o.strikeAt) / 0.4);
      if (o.verdict && u >= o.verdict.at) fade(g, ramp(u, o.verdict.at, 0.3), () => mark(g, o.verdict.ok, bx - 22, by + bh / 2, 17));
      if (o.tag && u >= o.tag[2]) fade(g, ramp(u, o.tag[2], 0.35) * (o.tag[3] != null ? 1 - ramp(u, o.tag[3], 0.3) : 1), () => tag(g, o.tag[0], o.tagX != null ? o.tagX : o.tagY != null ? bx + bw : bx - 48, o.tagY != null ? o.tagY : by + bh / 2, o.tag[1] || COL.trap, { align: o.tagX != null ? 'left' : 'right', size: 15, h: 32 }));
    });
    const said = LB && p > 0.5 ? (o.sayB || (o.B ? CM.text(o.B) : null)) : (o.sayA || (o.A ? CM.text(o.A) : null));
    if (!o.noHit && said) listen(bx, by, bw, bh, [{ text: said, sp: 'me' }]);
    return out;
  }
  CMS.answer = answer;
  const okOf = (q, a, c) => CM.judge(q, a, c || CM.DEMO).ok;

  /* ---------- 수업 등록 · 교수 · 기숙사 길 띠 (02–08장 위쪽) ---------- */
  function strip(g, cur, a = 1) {
    fade(g, a, () => {
      const x0 = 812, dx = 64, y = 92;
      g.strokeStyle = COL.faint; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 6, y); g.stroke();
      CM.PLACES.forEach((p, i) => {
        const x = x0 + i * dx, on = i === cur;
        circ(g, x, y, on ? 19 : 14, on ? COL.accent : i < cur ? '#2A3542' : COL.panel);
        ring(g, x, y, on ? 19 : 14, on ? COL.accent : CM.ME_FIRST[p.id] ? 'rgba(201,167,255,0.6)' : COL.faint, 1.5);
        icon(g, p.id, x, y, on ? 22 : 16, on ? '#1D1305' : i < cur ? COL.soft : COL.muted, on ? 2 : 1.8);
      });
      txt(g, `${cur + 1} / 7`, x0 + dx * 6 + 30, y, { size: 13, weight: 500, fam: FM, color: COL.muted });
    });
  }


  /* =========================================================
     교환학생 생활 그림: 수강 신청 화면 · 번호 두 묶음 · 대기표 · 교수 연구실 문 · 마감 달력 · 부탁 한 줄의 차례 · 방의 물건 · 수리 신청서 · 내 카드
     새 마감은 grammar.js(CM.dueOf)로 계산해요. 대학 · 교수 · 기숙사 이름, 과목 번호, 면담 시간, 방 번호는 모두 지어낸 예시예요
     ========================================================= */
  // 종이 서류: 머리 띠 + 칸. rows: [[이름, 값, key]] · o: { title, icon, sub, show(key) → 값 보이기, hl, head, rh, vx, ink, mono }
  function paper(g, x, y, w, rows, o = {}) {
    const rh = o.rh || 36, vx = o.vx || 130, top = 54 + (o.sub ? 30 : 0), h = top + rows.length * rh + 12;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 12); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 12); g.clip(); g.fillStyle = o.head || COL.teal; g.fillRect(x, y, w, 42); g.restore();
    if (o.icon) icon(g, o.icon, x + 22, y + 21, 20, '#FFFFFF');
    txt(g, o.title, x + (o.icon ? 40 : 16), y + 22, { size: fit(g, o.title, 13.5, w - (o.icon ? 56 : 32), 700, 8, FM), weight: 700, fam: FM, color: '#FFFFFF' });
    if (o.sub) txt(g, o.sub, x + 16, y + 64, { size: fit(g, o.sub, 17, w - 32, 800), weight: 800, color: COL.ink });
    const mono = o.mono !== false;
    rows.forEach(([k, v, key], i) => {
      const yy = y + top + i * rh, on = o.hl != null && o.hl === key, shown = !o.show || o.show(key);
      if (on) { rr(g, x + 8, yy + 2, w - 16, rh - 4, 7); g.fillStyle = 'rgba(31,122,85,0.16)'; g.fill(); g.strokeStyle = '#1F7A55'; g.lineWidth = 2.2; g.stroke(); }
      txt(g, k, x + 16, yy + rh / 2, { size: fit(g, k, 11.5, vx - 22, 700, 7.5, FM), weight: 700, fam: FM, color: '#5B6168' });
      g.fillStyle = 'rgba(30,38,48,0.22)'; g.fillRect(x + vx, yy + rh - 8, w - vx - 16, 1.2);
      if (shown && v) txt(g, v, x + vx + 4, yy + rh / 2 - 1, { size: fit(g, v, mono ? 15 : 16, w - vx - 24, 700, 9, mono ? FM : FB), weight: 700, fam: mono ? FM : FB, color: on ? '#14623F' : o.ink || '#1F4FA0' });
    });
    return { h };
  }
  CMS.paper = paper;

  // 수강 신청 화면 (지어낸 과목). o: { hl: 과목, sec: 고른 반, full: 다 찬 반, p }
  function courseBoard(g, x, y, w, o = {}) {
    const ids = CM.COURSE_IDS, rh = 66, h = 70 + ids.length * rh + 34;
    rr(g, x, y, w, h, 14); g.fillStyle = '#0E1620'; g.fill(); g.strokeStyle = 'rgba(110,200,255,0.4)'; g.lineWidth = 1.5; g.stroke();
    txt(g, 'COURSE REGISTRATION · FALL', x + 16, y + 22, { size: fit(g, 'COURSE REGISTRATION · FALL', 12, w - 60, 700, 8, FM), weight: 700, fam: FM, color: COL.ante });
    icon(g, 'reg', x + w - 24, y + 22, 18, COL.ante);
    txt(g, CM.UNI.toUpperCase(), x + 16, y + 44, { size: fit(g, CM.UNI.toUpperCase(), 10.5, w - 32, 700, 7, FM), weight: 700, fam: FM, color: COL.muted });
    ids.forEach((id, i) => {
      const yy = y + 62 + i * rh, on = String(o.hl) === String(id), C = CM.COURSES[id];
      if (on) { rr(g, x + 8, yy, w - 16, rh - 6, 9); g.fillStyle = 'rgba(110,200,255,0.12)'; g.fill(); g.strokeStyle = COL.ante; g.lineWidth = 2; g.stroke(); }
      txt(g, `ENGL ${id}`, x + 18, yy + 20, { size: 17, weight: 800, fam: FM, color: on ? COL.ante : COL.text });
      txt(g, C.t, x + 18, yy + 44, { size: fit(g, C.t, 12.5, w * 0.5, 600), weight: 600, color: COL.muted });
      if (on) ['morning', 'afternoon'].forEach((s, k) => {
        const cx = x + w - 112 + k * 54, full = o.full === s, sel = o.sec === s;
        rr(g, cx - 24, yy + 10, 48, 38, 7); g.fillStyle = sel ? COL.ante : full ? 'rgba(255,107,107,0.14)' : 'rgba(238,241,244,0.06)'; g.fill();
        g.strokeStyle = full ? COL.bad : sel ? COL.ante : COL.line; g.lineWidth = 1.4; g.stroke();
        txt(g, s === 'morning' ? 'AM' : 'PM', cx, yy + 23, { size: 12, weight: 800, fam: FM, color: sel ? '#0E1620' : full ? COL.bad : COL.soft, align: 'center' });
        txt(g, full ? 'FULL' : 'OPEN', cx, yy + 39, { size: 9, weight: 700, fam: FM, color: sel ? '#0E1620' : full ? COL.bad : COL.good, align: 'center' });
      });
    });
    txt(g, 'FOR EXAMPLE ONLY', x + 16, y + h - 18, { size: 10, weight: 700, fam: FM, color: COL.dim });
    return { h };
  }
  CMS.courseBoard = courseBoard;

  // 과목 · 방 번호는 두 묶음으로 (210 → two-ten · 0 → oh). o: { n, trap, trapNote, title, p }
  function numRead(g, x, y, w, o = {}) {
    const n = +o.n, h = o.trap ? 236 : 186, words = CM.roomWords(n), [a, b] = words.split(/-(.+)/);
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    const T = o.title || '번호 · 두 묶음으로 읽어요';
    txt(g, T, x + 16, y + 22, { size: fit(g, T, 13.5, w - 32, 700), weight: 700, color: COL.muted });
    const s = String(n);
    let xx = x + 16;
    xx += txt(g, s[0], xx, y + 70, { size: 40, weight: 800, fam: FM, color: COL.text });
    xx += txt(g, '|', xx + 4, y + 70, { size: 32, weight: 500, fam: FM, color: COL.accent }) + 8;
    txt(g, s.slice(1), xx, y + 70, { size: 40, weight: 800, fam: FM, color: COL.text });
    say(x + 10, y + 46, w - 20, 48, words);
    fade(g, o.p == null ? 1 : o.p, () => {
      const c1 = chip(g, a, x + 16, y + 126, { size: 17, weight: 700, color: COL.clause, fill: COL.panel2, stroke: 'rgba(127,224,168,0.55)', h: 36, r: 10, pad: 12 });
      const c2 = chip(g, b, c1.x + c1.w + 10, y + 126, { size: fit(g, b, 17, w - c1.w - 60, 700), weight: 700, color: COL.clause, fill: COL.panel2, stroke: 'rgba(127,224,168,0.55)', h: 36, r: 10, pad: 12 });
      say(c1.x, c1.y, c2.x + c2.w - c1.x, 36, words);
    });
    if (o.trap) {
      const t = `× ${o.trap} → ${CM.roomWords(+o.trap)}`, note = o.trapNote || '숫자 차례가 바뀌었어요';
      txt(g, t, x + 16, y + 172, { size: fit(g, t, 15, w - 32, 700), weight: 700, color: COL.trap });
      txt(g, note, x + 16, y + 200, { size: fit(g, note, 12.5, w - 32, 600), weight: 600, color: COL.muted });
    }
    return { h };
  }
  CMS.numRead = numRead;

  // 대기표 (WAITLIST). o: { n, course, sec, p, trap: 잘못 들은 번호 }
  function waitSlip(g, x, y, w, o = {}) {
    const h = 210, n = o.n || 13;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 16; g.shadowOffsetY = 6; rr(g, x, y, w, h, 12); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 12); g.clip(); g.fillStyle = '#7A4A1F'; g.fillRect(x, y, w, 40); g.restore();
    icon(g, 'full', x + 22, y + 20, 18, '#FFFFFF');
    txt(g, 'WAITLIST', x + 40, y + 21, { size: 14, weight: 700, fam: FM, color: '#FFFFFF' });
    const sub = `ENGL ${o.course || 210} · ${(o.sec || 'morning').toUpperCase()} SECTION`;
    txt(g, sub, x + 16, y + 62, { size: fit(g, sub, 12, w - 32, 700, 8, FM), weight: 700, fam: FM, color: '#5B6168' });
    txt(g, 'YOUR NUMBER', x + 16, y + 92, { size: 11, weight: 700, fam: FM, color: '#5B6168' });
    fade(g, o.p == null ? 1 : o.p, () => {
      txt(g, String(n), x + 16, y + 140, { size: 56, weight: 800, fam: FM, color: '#1F4FA0' });
      txt(g, CM.numWord(n), x + 110, y + 140, { size: fit(g, CM.numWord(n), 18, w - 130, 700), weight: 700, color: '#5B6168' });
      say(x + 10, y + 110, w - 20, 60, CM.numWord(n));
    });
    if (o.trap) { const t = `× ${o.trap} (${CM.numWord(o.trap)})`; txt(g, t, x + 16, y + 186, { size: fit(g, t, 14, w - 32, 700), weight: 700, color: COL.red }); }
    else txt(g, 'FOR EXAMPLE ONLY', x + 16, y + 186, { size: 10, weight: 700, fam: FM, color: '#8A8F96' });
    return { h };
  }
  CMS.waitSlip = waitSlip;

  // 교수 연구실 문 + 면담 시간 쪽지 + 요일 띠. o: { oh, p, hl: 'days' | 'room', trap: '~d' | '~r' }
  function doorSign(g, x, y, w, o = {}) {
    const P = CM.ohParse((o.oh || 'tt') + (o.trap || '')), base = CM.OHS[o.oh || 'tt'], h = 330;
    rr(g, x, y, w, h, 12); g.fillStyle = '#3A2E25'; g.fill(); g.strokeStyle = 'rgba(230,210,184,0.35)'; g.lineWidth = 1.5; g.stroke();
    rr(g, x + 16, y + 16, w - 32, 46, 6); g.fillStyle = '#C9A866'; g.fill();
    txt(g, CM.PROF.toUpperCase(), x + w / 2, y + 32, { size: fit(g, CM.PROF.toUpperCase(), 13, w - 50, 800, 8, FM), weight: 800, fam: FM, color: '#2B2010', align: 'center' });
    txt(g, `ROOM ${base.room}`, x + w / 2, y + 50, { size: 12, weight: 700, fam: FM, color: '#2B2010', align: 'center' });
    if (o.hl === 'room') { rr(g, x + 12, y + 12, w - 24, 54, 8); g.strokeStyle = COL.good; g.lineWidth = 2.6; g.stroke(); }
    fade(g, o.p == null ? 1 : o.p, () => {
      g.save(); g.translate(x + w / 2, y + 140); g.rotate(-0.025);
      rr(g, -(w - 60) / 2, -52, w - 60, 104, 4); g.fillStyle = '#FFF4B8'; g.fill();
      txt(g, 'OFFICE HOURS', 0, -30, { size: 13, weight: 800, fam: FM, color: '#5A4A10', align: 'center' });
      txt(g, base.short, 0, 0, { size: 20, weight: 800, fam: FM, color: '#1F4FA0', align: 'center' });
      txt(g, `${base.from}–${base.to} PM`, 0, 28, { size: 17, weight: 700, fam: FM, color: '#1F4FA0', align: 'center' });
      g.restore();
      say(x + 30, y + 88, w - 60, 104, `${base.days}, from ${base.from} to ${base.to}. Room ${CM.roomWords(base.room)}.`);
    });
    const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'], DI = { tt: [1, 3], mw: [0, 2], wf: [2, 4] };
    const real = DI[o.oh || 'tt'], on = o.trap === '~d' ? DI[CM.ohDaysTrap(o.oh || 'tt')] : [];
    const dw = (w - 32) / 5;
    DAYS.forEach((d, i) => {
      const cx = x + 16 + dw * i + dw / 2, hit = real.includes(i), wrong = o.trap === '~d' && on.includes(i) && !hit;
      rr(g, cx - dw / 2 + 3, y + 222, dw - 6, 40, 7); g.fillStyle = hit ? 'rgba(127,224,168,0.2)' : wrong ? 'rgba(255,159,122,0.18)' : 'rgba(238,241,244,0.05)'; g.fill();
      g.strokeStyle = hit && o.hl === 'days' ? COL.good : wrong ? COL.trap : COL.faint; g.lineWidth = hit && o.hl === 'days' ? 2.4 : 1.4; g.stroke();
      txt(g, d, cx, y + 243, { size: 12.5, weight: 800, fam: FM, color: hit ? COL.good : wrong ? COL.trap : COL.muted, align: 'center' });
    });
    const t = o.trap === '~r' ? `× Room ${P.room} → ${CM.roomWords(P.room)}` : o.trap === '~d' ? `× ${P.days}` : `${base.days} = ${base.ko}`;
    txt(g, t, x + 16, y + 294, { size: fit(g, t, 14, w - 32, 700), weight: 700, color: o.trap ? COL.trap : COL.soft });
    return { h };
  }
  CMS.doorSign = doorSign;

  // 마감 달력: 원래 마감(금요일 자정) → 미룬 날수 → 새 마감. o: { days, p, show: 새 마감 보이기 }
  function weekCal(g, x, y, w, o = {}) {
    const days = o.days || 2, h = 222, cols = ['THU', 'FRI', 'SAT', 'SUN', 'MON', 'TUE'], cw = (w - 32) / cols.length, due = 1 + days;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '에세이 마감 · DEADLINE', x + 16, y + 22, { size: 13.5, weight: 700, color: COL.muted });
    cols.forEach((d, i) => {
      const cx = x + 16 + cw * i + cw / 2, old = i === 1, neu = i === due && o.show !== false && (o.p == null || o.p > 0.5);
      rr(g, cx - cw / 2 + 3, y + 48, cw - 6, 72, 8);
      g.fillStyle = neu ? 'rgba(127,224,168,0.18)' : old ? 'rgba(255,193,94,0.12)' : 'rgba(238,241,244,0.05)'; g.fill();
      g.strokeStyle = neu ? COL.good : old ? COL.accent : COL.faint; g.lineWidth = neu || old ? 2 : 1.3; g.stroke();
      txt(g, d, cx, y + 70, { size: 13, weight: 800, fam: FM, color: neu ? COL.good : old ? COL.accent : COL.soft, align: 'center' });
      if (old) { txt(g, 'DUE', cx, y + 98, { size: 11, weight: 700, fam: FM, color: COL.accent, align: 'center' }); if (o.p) fade(g, Math.min(1, o.p * 2), () => strikeLine(g, cx - cw / 2 + 8, cx + cw / 2 - 8, y + 84, 1)); }
      if (neu) txt(g, 'NEW', cx, y + 98, { size: 11, weight: 800, fam: FM, color: COL.good, align: 'center' });
    });
    fade(g, o.p == null ? 1 : o.p, () => {
      const x1 = x + 16 + cw * 1.5, x2 = x + 16 + cw * (due + 0.5);
      g.strokeStyle = COL.clause; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x1, y + 132); g.quadraticCurveTo((x1 + x2) / 2, y + 158, x2, y + 132); g.stroke();
      const t = `+${days} days → ${CM.DUES[CM.dueOf(days)].t}`;
      txt(g, t, x + w / 2, y + 186, { size: fit(g, t, 16, w - 32, 700), weight: 700, color: COL.clause, align: 'center' });
      say(x + 16, y + 168, w - 32, 36, CM.DUES[CM.dueOf(days)].t);
    });
    return { h };
  }
  CMS.weekCal = weekCal;

  // 부탁 한 줄의 차례: 부르는 말 → 까닭(사실) → 부탁 틀 → 바라는 것. o: { words, p: 0~1 (차례로 나타남), hl: 칸 번호, bad: { 칸: 글 } }
  function lineOrder(g, x, y, w, o = {}) {
    const words = o.words || CM.LINE.words, W = words.map(id => CM.OW[id]), h = 4 * 64 + 50;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '부탁 한 줄의 차례', x + 16, y + 22, { size: 13.5, weight: 700, color: COL.muted });
    const cats = ['call', 'why', 'ask', 'want'], cc = { call: COL.verb, why: COL.clause, ask: COL.verb, want: COL.clause };
    cats.forEach((c, i) => fade(g, o.p == null ? 1 : ramp(o.p, i * 0.22, 0.25), () => {
      const yy = y + 50 + i * 64, ww = W.find(z => z.c === c), on = o.hl === i, bad = o.bad && o.bad[c];
      rr(g, x + 12, yy, w - 24, 54, 9); g.fillStyle = on ? 'rgba(255,193,94,0.12)' : 'rgba(238,241,244,0.05)'; g.fill(); g.strokeStyle = bad ? COL.trap : on ? COL.accent : COL.faint; g.lineWidth = on || bad ? 2 : 1.3; g.stroke();
      txt(g, `${i + 1}. ${CM.OCAT[c].ko}`, x + 24, yy + 16, { size: 12, weight: 700, color: bad ? COL.trap : cc[c] });
      const t = bad || (ww ? (c === 'ask' && i === 2 ? ww.t[0].toUpperCase() + ww.t.slice(1) : ww.t) : '');
      txt(g, t, x + 24, yy + 38, { size: fit(g, t, 15.5, w - 50, 700), weight: 700, color: bad ? COL.trap : COL.en });
      if (t && !bad) say(x + 14, yy, w - 28, 54, t);
      if (i < 3) arrow(g, x + w - 30, yy + 54, x + w - 30, yy + 64, COL.muted, 1.6);
    }));
    return { h };
  }
  CMS.lineOrder = lineOrder;

  // 방의 물건 넷 (2 × 2). o: { hl: 고장 난 것, trap: 'boiler' → 보일러 × 표시 }
  function thingCards(g, x, y, w, o = {}) {
    const ids = CM.THING_IDS, cw = (w - 40) / 2, ch = 104, h = 44 + 2 * (ch + 10) + 8;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, 'IN MY ROOM · 방의 물건', x + 16, y + 22, { size: 12, weight: 700, fam: FM, color: COL.muted });
    ids.forEach((id, k) => {
      const xx = x + 14 + (k % 2) * (cw + 12), yy = y + 42 + Math.floor(k / 2) * (ch + 10), on = o.hl === id, T = CM.THINGS[id];
      rr(g, xx, yy, cw, ch, 10); g.fillStyle = on ? 'rgba(255,159,122,0.12)' : COL.panel2; g.fill(); g.strokeStyle = on ? COL.trap : COL.faint; g.lineWidth = on ? 2.2 : 1.3; g.stroke();
      icon(g, id, xx + cw / 2, yy + 36, 34, on ? COL.trap : COL.soft, 1.8);
      txt(g, T.t, xx + cw / 2, yy + 72, { size: 16, weight: 700, color: COL.en, align: 'center' });
      txt(g, T.ko, xx + cw / 2, yy + 92, { size: fit(g, T.ko, 11.5, cw - 12, 600), weight: 600, color: COL.muted, align: 'center' });
      say(xx, yy, cw, ch, T.t);
      if (on && o.trap === 'boiler') { txt(g, '× boiler', xx + cw - 10, yy + 16, { size: 12.5, weight: 800, color: COL.bad, align: 'right' }); }
    });
    return { h };
  }
  CMS.thingCards = thingCards;

  // 수리 신청서 (MAINTENANCE REQUEST). c: 카드 · o: { show(key), hl }
  function repairForm(g, x, y, w, c, o = {}) {
    const r = CM.roomParse(c.room), V = CM.VISITS[c.visit];
    const rows = [['HALL', CM.HALLS[r.hall].t.toUpperCase(), 'hall'], ['ROOM', String(r.n), 'room'], ['PROBLEM', `${CM.THINGS[c.thing].t.toUpperCase()} NOT WORKING`, 'thing'],
      ['ENTRY OK?', c.enter ? 'YES' : 'NO — CALL FIRST', 'enter'], ['VISIT', `TOMORROW ${V.from}–${V.to}`, 'visit']];
    return paper(g, x, y, w, rows, { title: `MAINTENANCE REQUEST · ${CM.HOUSING.toUpperCase()}`, icon: 'wrench', show: o.show, hl: o.hl, rh: 38, vx: 104, head: '#26324A' });
  }
  CMS.repairForm = repairForm;

  // 내 카드 (시뮬레이터와 같은 칸). o: { skip, hl, rh, vs, rows, title }
  function myCard(g, x, y, w, card, o = {}) {
    const all = o.rows || CM.cardRows(card), rows = all.map((r, i) => [r, i]).filter(([, i]) => !o.skip || !o.skip.includes(i)), rh = o.rh || 34, vs = o.vs || 14.5, vx = o.vx || 100;
    const LS = rows.map(([[, v]]) => richLay(g, v, [], vs, w - vx - 14, { weight: 700 }));
    const hs = LS.map(R => Math.max(rh, R.h + 10)), h = 56 + hs.reduce((a, b) => a + b, 0) + 10;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 14); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 14); g.clip(); g.fillStyle = '#26324A'; g.fillRect(x, y, w, 44); g.restore();
    icon(g, 'id', x + 24, y + 22, 22, '#FFFFFF');
    txt(g, o.title || '내 카드 · MY CARD', x + 44, y + 23, { size: 16, weight: 700, color: '#FFFFFF' });
    let yy = y + 56;
    rows.forEach(([[k], i], j) => {
      const R = LS[j], hh = hs[j], on = o.hl === i;
      if (on) { rr(g, x + 8, yy + 3, w - 16, hh - 6, 8); g.fillStyle = 'rgba(31,122,85,0.16)'; g.fill(); g.strokeStyle = '#1F7A55'; g.lineWidth = 2.5; g.stroke(); }
      txt(g, k, x + 16, yy + hh / 2, { size: fit(g, k, 13.5, vx - 22, 600), weight: 600, color: '#5B6168' });
      richDraw(g, R, x + vx, yy + (hh - R.h) / 2 + R.lh / 2, { color: on ? '#14623F' : COL.ink });
      yy += hh;
    });
    return { h };
  }
  CMS.myCard = myCard;

  // 첫 낱말 → 짧은 대답 (CM.AUX). o: { hl: 'have' | 'is' | …, at, u }
  function auxTable(g, x, y, w, o = {}) {
    const ks = Object.keys(CM.AUX), rh = 40, h = 46 + ks.length * rh;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '첫 낱말 → 짧은 대답의 짝', x + 16, y + 22, { size: 14, weight: 700, color: COL.muted });
    ks.forEach((k, i) => fade(g, o.u == null ? 1 : ramp(o.u, (o.at || 0) + i * 0.25, 0.3), () => {
      const A = CM.AUX[k], yy = y + 46 + i * rh + rh / 2 - 4, on = o.hl === k, a = A.a.split(' · ')[0];
      if (on) { rr(g, x + 6, yy - rh / 2 + 3, w - 12, rh - 6, 8); g.fillStyle = 'rgba(110,200,255,0.12)'; g.fill(); g.strokeStyle = COL.ante; g.lineWidth = 1.8; g.stroke(); }
      txt(g, A.q, x + 16, yy, { size: 15, weight: 700, color: COL.ante });
      txt(g, a, x + w - 14, yy, { size: fit(g, a, 15, w - 130, 700), weight: 700, color: COL.rel, align: 'right' });
      say(x + 6, yy - rh / 2 + 3, w - 12, rh - 6, a);
    }));
    return { h };
  }
  CMS.auxTable = auxTable;

  // 설명 칸: 제목 + 줄(영어 · 한국어 풀이). rows: [[영어, 한국어, 색, marks, 들을 말]] · o: { hl, u, at, step, size, stroke, tc }
  function notePanel(g, x, y, w, title, rows, o = {}) {
    const size = o.size || 16;
    const LS = rows.map(r => richLay(g, r[0], r[3] || [], size, w - 32, { weight: 700 }));
    const hs = LS.map((R, i) => R.h + (rows[i][1] ? 22 : 0) + 14);
    const h = 44 + hs.reduce((a, b) => a + b, 0) + 4;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: o.stroke || COL.faint, lw: o.stroke ? 2 : 1.5 });
    txt(g, title, x + 16, y + 22, { size: fit(g, title, 13.5, w - 32, 700), weight: 700, color: o.tc || COL.muted });
    let yy = y + 44;
    rows.forEach((r, i) => {
      const R = LS[i], on = o.hl === i, hh = hs[i], top = yy;
      fade(g, o.u == null ? 1 : ramp(o.u, (o.at || 0) + i * (o.step == null ? 0.3 : o.step), 0.35), () => {
        if (on) { rr(g, x + 6, top - 6, w - 12, hh - 2, 8); g.fillStyle = 'rgba(127,224,168,0.10)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 1.6; g.stroke(); }
        richDraw(g, R, x + 16, top + R.lh / 2 + 1, { color: r[2] || COL.en });
        if (r[1]) txt(g, r[1], x + 16, top + R.h + 11, { size: fit(g, r[1], 13, w - 32, 600), weight: 600, color: COL.muted });
        const sp = r[4] !== undefined ? r[4] : /[가-힣]/.test(r[0]) ? null : r[0];
        if (sp) say(x + 10, top - 6, w - 20, R.h + 10, sp);
      });
      yy += hh;
    });
    return { h };
  }
  CMS.notePanel = notePanel;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호는 자막에 쓰지 않음
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '교환학생 생활 회화 · 부탁은 질문으로, 문제는 사실부터', d: 26, caps: [
      [0.4, 5.4, '교환학생의 첫 주에는 내가 먼저 말을 꺼내는 곳이 많아요. 부탁은 질문으로, 문제는 사실부터 말해요.'],
      [5.4, 11.8, "학생처 창구에서 수강 신청을 그대로 → I want to apply English 210. 수업은 apply가 아니라 → I'd like to register for English 210, please."],
      [11.8, 16.4, '수업 뒤 교수에게 → Teacher, when is your office time? 교수님은 Professor Hale, 면담 시간은 → Could you tell me when your office hours are?'],
      [16.4, 21, "대기 번호를 들으면 Okay. Thanks.로 끝내지 말고 되짚어요 → So, I'm number 13?"],
      [21, 26, '세 단계로 말해요. 열쇠 낱말과 모양을 잡고, 틀에 내 정보를 넣고, 공손하게 끝내요.'],
    ] },
    { id: 'map', n: '01', title: '캠퍼스 지도', sub: '학생처 둘 · 교수 셋 · 기숙사 둘', d: 30, caps: [
      [0.4, 6, '오늘의 이야기를 일곱 곳으로 나눠 봐요. 교환학생으로 도착한 첫 주, 먼저 학생처 창구에서 수업을 등록해요.'],
      [6, 12, '반이 다 찼으면 대기 명단에 이름을 올리고 번호를 되짚어요. 수업이 끝나면 교수에게 면담 시간을 물어요.'],
      [12, 18, '교수 면담에서 어려운 것을 말하고 마감 연장을 부탁해요. 기숙사에서는 고장을 알리고, 룸메이트 문제를 RA와 의논해요.'],
      [18, 24, '보라 테두리 → 내가 먼저 말을 꺼내는 곳이에요. 다섯 곳에서 용건을 사실과 부탁으로 말해요.'],
      [24, 30, '대학, 교수, 기숙사 이름, 과목 번호, 면담 시간, 방 번호는 모두 지어낸 예시예요. 실제 절차는 학교마다 달라요.'],
    ] },
    { id: 'reg', n: '02', title: '수업 등록 · register for', sub: "I'd like to register for … · two-ten · morning or afternoon · Have you …?", d: 40, place: 0, caps: [
      [0.4, 6, '학생처 창구 → What can I help you with? 수강 신청을 그대로 → I want to apply English 210. apply는 입학이나 일자리에 지원할 때 써요.'],
      [6, 11.5, "I'm an exchange student.는 사실만 말했고, Register me …는 명령이에요. 용건은 부탁 틀로 → I'd like to register for English 210, please."],
      [11.5, 17, '과목 번호는 두 묶음으로 → 210 = two-ten. 201로 말하면 다른 과목이에요. 0은 oh로 읽어요 → 201 = two-oh-one.'],
      [17, 23, 'Would you like the morning section or the afternoon section? → Yes, please.는 고른 것이 없어요. 고른 것 + please → The morning section, please.'],
      [23, 28.5, 'morning or는 mor-nin-gor처럼 이어져 들려요. 고를 것은 세게 말해요 → MORning · afterNOON.'],
      [28.5, 34, "Have you taken a college English class before? → Have로 물었으니 Yes, I did.는 짝이 어긋나요 → Yes, I have. I took a similar class in Korea."],
      [34, 40, '빠른 말 → Hey, whatcha need? 짐작해서 답하지 말고 들린 만큼 되물어요 → Sorry, did you ask what I need?'],
    ] },
    { id: 'full', n: '03', title: '정원 · 대기 명단', sub: "full · the waitlist · Could you put me on …? · So, I'm number 13?", d: 36, place: 1, caps: [
      [0.4, 6, 'Hmm, it looks like the morning section is full. → Yes.는 묻는 말이 아니라 맞지 않고, Oh, okay.로 끝내면 수업을 들을 방법이 없어요.'],
      [6, 12, '대기 예약을 그대로 → Can I make a reservation for the class? reservation은 식당과 호텔의 예약이에요. Just put me in the class.는 조르는 말이에요.'],
      [12, 17, '할 수 있는 방법을 질문으로 → Could you put me on the waitlist, please? 다른 반도 괜찮으면 → Could I join the afternoon section instead?'],
      [17, 23, "Okay. You're number 13 on the waitlist. → Okay. Thanks.로 넘기면 번호를 확인하지 못해요. thirty로 잘못 들으면 30번이에요."],
      [23, 29, "되짚어 확인해요 → So, I'm number 13? thirteen은 뒤를, thirty는 앞을 세게 말해요."],
      [29, 36, "빠른 말 → Kay, you're thirteen on the list. 짐작하지 말고 놓친 것만 물어요 → Sorry, what number am I on the waitlist?"],
    ] },
    { id: 'class', n: '04', title: '수업 뒤 교수에게', sub: 'Professor Hale · office hours · Could you tell me …? · So, Tuesdays and Thursdays?', d: 34, place: 2, caps: [
      [0.4, 6, '수업이 끝나고 교수에게 다가가요. Yes? Did you have a question? → Yes.만 하면 무엇인지 다시 물어요.'],
      [6, 12, '선생님과 면담 시간을 그대로 → Teacher, when is your office time? 교수님은 Professor Hale, 면담 시간은 office hours예요.'],
      [12, 17, 'Tell me your office hours.는 명령이에요. 물을 것은 Yes 뒤에 바로 질문으로 → Yes. Could you tell me when your office hours are?'],
      [17, 23, 'My office hours are Tuesdays and Thursdays from 2 to 4, in Room 318. → Okay. Thanks.로 넘기면 찾아갈 요일과 방을 확인하지 못해요.'],
      [23, 29, '월요일과 수요일로, 380호로 잘못 들으면 엉뚱한 날 엉뚱한 방에 가요. 되짚어요 → So, Tuesdays and Thursdays, in Room 318?'],
      [29, 34, '빠른 말 → Office hours, Tuesdays, Thursdays, two to four, three-eighteen. 놓쳤으면 → Sorry, when are your office hours?'],
    ] },
    { id: 'hours', n: '05', title: '교수 면담 · 사실 + 부탁', sub: "I'm having trouble with … · Could you give me some advice? · vocabulary or main ideas", d: 36, place: 3, caps: [
      [0.4, 6, "면담 시간에 연구실을 찾아가요. Come on in! What can I do for you? → Teacher, I don't understand the class. 무엇이 어려운지 없어요."],
      [6, 12, "Help me with the readings.는 명령이고, I'm having trouble with the readings.는 사실만 말했어요."],
      [12, 17, "사실 + 부탁 → I'm having trouble with the readings. Could you give me some advice?"],
      [17, 23, 'Is it the vocabulary or the main ideas? → 고르는 질문이에요. Yes, please.도, 묻지 않은 topic도 아니에요 → Mostly the main ideas.'],
      [23, 29, '에세이가 어렵다면 → Is it the topic or the structure? topic or는 to-pi-kor처럼 이어져요. 고를 것은 세게 → TOPic · STRUCture.'],
      [29, 36, "Have you tried the study guide on the course website? → Yes, I do.는 짝이 어긋나요 → Yes, I have, but it didn't help much."],
    ] },
    { id: 'ext', n: '06', title: '마감 연장 부탁 한 줄', sub: 'Professor Hale, … · Would it be possible to get … · an extension · So, by Sunday?', d: 42, place: 4, caps: [
      [0.4, 5.5, '면담 끝에 Is there anything else? → Yes.만 하면 무엇을 부탁하는지 몰라요. 마감을 미뤄 달라는 부탁을 한 줄로 말해요.'],
      [5.5, 11, '부르는 말, 까닭, 부탁 틀, 바라는 것 → Professor Hale, I was sick this week. Would it be possible to get a two-day extension on my essay?'],
      [11, 15.5, 'Teacher로 부르면 교수가 고쳐 줘요 → Oh, you can call me Professor Hale. 교수님은 Professor + 성이에요.'],
      [15.5, 20, '까닭이 빠지면 → Hmm, can I ask why? I want …는 조르는 말이에요. 부탁은 질문으로 해요.'],
      [20, 24.5, '리포트를 그대로 → more time for my report? 수업에 내는 글은 essay, 마감을 미루는 것은 extension이에요.'],
      [24.5, 29.5, '날수를 빼고 부탁하면 교수가 물어요 → How many more days do you need? During two days.는 어색해요 → Just two more days, if possible.'],
      [29.5, 35.5, 'Okay. Please send it to me by Sunday at midnight. 금요일 마감이 이틀 미뤄져 일요일이에요. 되짚어요 → So, by Sunday at midnight?'],
      [35.5, 42, '빠른 말 → Kay, just get it to me by Sunday, midnight. 놓쳤으면 → Sorry, when is the new deadline?'],
    ] },
    { id: 'dorm', n: '07', title: '기숙사 고장 알리기', sub: "heater · isn't working · Could you send someone …? · two-fourteen · maintenance", d: 38, place: 5, caps: [
      [0.4, 6, "기숙사 사무실 → Hello, Housing Office. How can I help? 난방기를 보일러로 → The boiler in my room isn't working. boiler는 건물 전체의 물을 데우는 큰 기계예요."],
      [6, 12, "Fix my heater.는 명령이고, 고장만 말하면 사실만 있어요. 사실 + 부탁 → The heater in my room isn't working. Could you send someone to look at it?"],
      [12, 18.5, "What's your room number? → I live in a dormitory.는 번호가 없어요. 240호나 Cedar Hall로 말하면 다른 방이에요 → It's Room 214, in Maple Hall."],
      [18.5, 22.5, "빠른 말 → What's yer room number, love? love는 친근하게 부르는 말이에요. 놓쳤으면 → Sorry, did you ask for my room number?"],
      [22.5, 28.5, "Is it alright if maintenance goes in while you're out? → Is로 물었으니 Yes, I do.는 짝이 어긋나요. 모르는 낱말은 물어요 → Sorry, what does maintenance mean?"],
      [28.5, 32.5, "괜찮으면 → Yes, that's fine. 내가 있을 때 오면 좋겠으면 → Actually, I'd rather be there, if that's okay."],
      [32.5, 38, 'Someone will come by tomorrow between 9 and 11. → 1시에서 3시로 잘못 들으면 그때 방에 없어요. 되짚어요 → So, tomorrow between 9 and 11?'],
    ] },
    { id: 'ra', n: '08', title: '룸메이트 · RA 상담', sub: "My roommate … , so I can't sleep · Could I get some advice? · Have you talked …?", d: 34, place: 6, caps: [
      [0.4, 6, "RA → Hey! What's up? 여기가 시끄러워요를 그대로 → Here is too noisy. here는 주어 자리에 오지 않아요. Change my room.은 명령이에요."],
      [6, 12, "사실만 말하지 말고 그래서 어떤지와 부탁을 덧붙여요 → My roommate plays loud music late at night, so I can't sleep. Could I get some advice?"],
      [12, 18, "Have you talked to your roommate about it? → Have로 물었으니 No, I don't.는 짝이 어긋나요 → No, I haven't. I'm not sure what to say."],
      [18, 23, "빠른 말 → Ya talked to 'em about it yet? 짐작하지 말고 → Sorry, did you ask if I talked to my roommate?"],
      [23, 28.5, 'Would you like me to be there when you talk to them? → Yes. You come with me.는 명령처럼 들려요.'],
      [28.5, 34, '도와주겠다는 말을 받을 때는 → Yes, please. That would really help.'],
    ] },
    { id: 'method', n: '09', title: '3단계 말하기 법', sub: '일곱 곳에 한 줄씩 · 질문의 모양과 함께', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 말하기 법**으로 묶어요.'],
      [5.5, 11.5, '① **열쇠 낱말과 질문의 모양 잡기** → or → 고르기, What → 정보, Have you · Is it → 첫 낱말로 짧은 대답.'],
      [11.5, 17.5, "② **틀에 내 정보 넣기** → 문제는 사실로 말하고, 들은 번호와 요일은 되짚어요 → So, I'm number 13?"],
      [17.5, 23, '③ **공손하게 끝내기** → 부탁은 질문으로 → Could you send someone to look at it? 교수님은 Professor Hale.'],
      [23, 28, '일곱 곳에 한 줄씩 적용했어요. 내가 먼저 말하는 곳일수록 사실 + 부탁이 힘이 돼요.'],
    ] },
    { id: 'practice', n: '10', title: '실전 교환학생 생활', sub: '내 카드 하나로 네 번', d: 50, caps: [
      [0.4, 4.5, '실전이에요. 내 카드 → English 245, 오후 반이에요. 첫 질문 → Would you like the morning section or the afternoon section?'],
      [4.5, 8.5, '① 고르는 질문 → (A) Yes, please. 고른 것이 없어 탈락. ② (B) morning → 카드와 달라 탈락.'],
      [8.5, 12.5, '정답 (C) → The afternoon section, please.'],
      [12.9, 17, '오후 반이 다 찼대요. 셋 모두 방법을 묻는 말이에요. 카드 → 오전 반도 괜찮아요.'],
      [17, 21, '② (A) afternoon → 다 찬 반이라 탈락. (C) waitlist → 카드와 달라 탈락.'],
      [21, 25, '정답 (B) → Oh, I see. Could I join the morning section instead?'],
      [25.4, 29.5, '면담 끝 → Is there anything else? 카드 → 시험이 세 개 있었고, 마감을 사흘 미루고 싶어요.'],
      [29.5, 33.5, '② (B) two-day → 카드(사흘)와 달라 탈락. ③ (A) I want → 조르는 말이라 탈락.'],
      [33.5, 37.5, '정답 (C) → Professor Hale, I had three exams this week. Would it be possible to get a three-day extension on my essay?'],
      [37.9, 42, "기숙사 → What's your room number? 카드 → 시더 홀 316호예요."],
      [42, 46, '① (B) Yes. → 정보가 없어 탈락. ② (A) 360 → 카드와 달라 탈락. three-sixteen과 three-sixty예요.'],
      [46, 50, "정답 (C) → It's Room 316, in Cedar Hall."],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '곳 · 열쇠 낱말과 모양 · 대답 틀', d: 22, caps: [
      [0.4, 6, "정리해요. 용건은 부탁 틀로 → I'd like to register for English 210, please. 교수님은 → Professor Hale."],
      [6, 12, "문제는 사실 + 부탁 → The heater in my room isn't working. Could you send someone to look at it?"],
      [12, 17, "들은 번호와 요일은 되짚어요 → So, I'm number 13? So, by Sunday at midnight?"],
      [17, 22, '아래 **교환학생 시뮬레이터**에서 내 카드로 수업 등록부터 RA 상담까지 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  CMS.CHAPTERS = CHAPTERS; CMS.CAPTIONS = CAPTIONS; CMS.END = END;
  CMS.POSTER = CHAPTERS.find(c => c.id === 'ext').t + 9.6;
  CMS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  CMS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 실전 장면의 시각 (구간 시작 · 보기 · ① · ② · ③ · 정답)
  const PSEG = [0, 12.5, 25, 37.5];
  const PT = { q: 0.4, opt: [1.6, 2.2, 2.8], s1: 5.0, s2: 7.0, s3: 9.0, win: 10.0, lines: [0.4, 4.5, 8.5] };
  CMS.PSEG = PSEG;

  /* ---------- 장면 그리기 ---------- */
  const LX = 80, RX = 900, RW = 300;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 700, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 700, 800, 24, FD), weight: 800, fam: FD });
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
  const ansParts = a => CM.segs(a).map(s => [s.t, s.r]);
  // 부탁 한 줄을 짧게 (표 · 목록용): Professor Hale, … Would it be possible to get a two-day extension …?
  const shortParts = a => {
    if (a.f !== 'line') return ansParts(a);
    const s = CM.segs(a), call = s.find(x => x.part === 'call'), ask = s.find(x => x.part === 'ask'), want = s.find(x => x.part === 'want');
    if (!call || !ask || !want) return ansParts(a);
    return [[call.t, call.r], [', … ', 'frame'], [ask.t[0].toUpperCase() + ask.t.slice(1), ask.r], [' ', 'frame'], [want.t.replace(/ on my essay$/, ' …'), want.r], ['?', 'frame']];
  };
  const shortText = a => shortParts(a).map(p => p[0]).join('');
  CMS.shortText = shortText;
  // 여러 줄로 감싸는 대답 (보기 · 부탁 한 줄)
  function wrapAns(g, a, x, y, size, maxW, o = {}) {
    const text = CM.text(a), marks = o.plain ? [] : CM.segs(a).filter(s => s.r && s.r !== 'frame').map(s => [s.t, o.dim ? 'dim' : s.r]);
    const R = richLay(g, text, marks, size, maxW, { weight: 600 });
    richDraw(g, R, x, y - (R.rows - 1) * R.lh / 2, { color: o.dim ? COL.dim : o.color || COL.text });
    return R;
  }
  const why2 = j => `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
  function whyLine(g, j, y, w = 1100, x) { const R = richLay(g, why2(j), [], 16, w, { weight: 600 }); richDraw(g, R, x != null ? x : W / 2 - R.w / 2, y, { color: j.ok ? COL.good : COL.trap }); return R; }
  const ME_FIRST = CM.ME_FIRST;
  const D = CM.DEMO;
  const okOn = (q, a, c) => CM.judge(Qobj(q), a, c || D).ok;
  const OT = CM.o;
  /* 상대의 말 + 내 대답 (함정 → 바른 대답). o: { q | talk, at, aAt, bad, ok, mAt, tag, tagC, card, size, qsize, w, x, y, maxW, tagY, noVerdict, soft }
     돌려주는 값: { B, A, y: 다음 줄 y } */
  function exch(g, u, o) {
    const x = o.x == null ? LX : o.x, w = o.w || 780, y = o.y == null ? 150 : o.y, at = o.at, aAt = o.aAt == null ? at + 1.4 : o.aAt, size = o.size || 23, card = o.card || D;
    const B = o.q ? staff(g, o.q, Object.assign({ x, y, w, at, u, roleAt: at + 0.8, size: o.qsize || 22, shapeAt: at + 1.0 }, o.qo || {})) : talk(g, Object.assign({ side: 'L', x, y, w, at, u, size: o.qsize || 22 }, o.talk));
    const ay = y + B.bh + (o.gap || 14), jq = o.jq || o.q;
    const vAt = o.bad ? o.mAt + 0.8 : aAt + 0.7;
    const A = answer(g, {
      x, y: ay, w, A: o.bad || o.ok, B: o.bad && u >= o.mAt ? o.ok : null, p: (u - (o.mAt || 0)) / 0.7, at: aAt, u, size, maxW: o.maxW || 640,
      trapAt: o.bad && !o.soft ? aAt + 0.6 : null, strikeAt: o.bad && !o.soft ? aAt + 0.7 : null,
      verdict: o.noVerdict ? null : o.bad ? (o.soft && u < vAt ? { ok: false, at: aAt + 0.7 } : u >= vAt ? { ok: okOn(jq, o.ok, card), at: vAt } : null) : { ok: okOn(jq, o.ok, card), at: vAt },
      tag: o.tag ? [o.tag, o.tagC || COL.trap, aAt + 0.9, o.bad ? o.mAt : o.tagEnd] : null, tagY: o.tagY != null ? ay + o.tagY : null,
    });
    return { B, A, y: ay + A.bh };
  }
  // 한 자리에 차례로 나왔다 사라지는 함정 대답들: [[대답, 시작, 끝, 꼬리표]]
  function trapSeq(g, u, y, list, o = {}) {
    list.forEach(([a, s, e, tg]) => {
      if (u < s - 0.2 || u > e + 0.2) return;
      fade(g, ramp(u, s, 0.3) * (1 - ramp(u, e - 0.3, 0.3)), () => answer(g, { x: LX, y, w: 780, A: a, at: s + 0.2, u, size: o.size || 23, maxW: 640, trapAt: s + 0.6, strikeAt: s + 0.7, tag: tg ? [tg, COL.trap, s + 0.8] : null, tagY: y + (a.f === 'line' || CM.text(a).length > 46 ? 108 : 78) }));
    });
  }
  // 상대의 짧은 말 (말 id 없이)
  const say2 = (g, text, y, at, u, kind, sp, marks) => talk(g, { side: 'L', x: LX, y, w: 780, text, marks: marks || [], kind, sp, at, u, size: 22 });
  // 헷갈리는 숫자 짝 (13 · 30)
  function pairsFig(g, x, y, w, u, at) {
    const rh = 58, h = 52 + CM.PAIRS.length * rh + 40;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '헷갈리는 숫자 · 세게 읽는 곳', x + 16, y + 22, { size: 13.5, weight: 700, color: COL.muted });
    CM.PAIRS.forEach(([a, as, b, bs], i) => fade(g, ramp(u, at + i * 0.3, 0.35), () => {
      const yy = y + 60 + i * rh;
      [[a, as, x + 16], [b, bs, x + w / 2 + 6]].forEach(([n, s, xx]) => {
        txt(g, n, xx, yy, { size: 22, weight: 800, fam: FM, color: COL.text });
        const parts = s.match(/[A-Z]{2,}|[a-z]+/g);
        let px = xx + 46; parts.forEach(pp => { const big = /^[A-Z]{2,}$/.test(pp); px += txt(g, pp.toLowerCase(), px, yy, { size: big ? 19 : 15, weight: big ? 800 : 500, color: big ? COL.accent : COL.soft }); });
        say(xx - 4, yy - 20, w / 2 - 20, 40, CM.numWord(+n));
      });
    }));
    fade(g, ramp(u, at + 1.2, 0.4), () => txt(g, "So, I'm number 13? → thirteen", x + w / 2, y + h - 22, { size: fit(g, "So, I'm number 13? → thirteen", 16, w - 24, 700), weight: 700, color: COL.clause, align: 'center' }));
    say(x + 20, y + h - 40, w - 40, 36, "So, I'm number thirteen?");
    return { h };
  }
  // 직접 해 보기에서 고른 대답 하나 보이기 (상대의 말 + 대답 + 까닭)
  function pickView(g, q, a, C, y = 160) {
    const r = exch(g, 99, { q, at: -9, ok: a, card: C, y, qo: { all: true } });
    const R = whyLine(g, CM.judge(Qobj(q), a, C), r.y + 30, 780, LX);
    return r.y + 30 + R.h;
  }
  const reactOf = (q, j, a, C) => j.ok ? CM.reply(q, a, C) : (j.stage === 1 ? CM.REACT[1](q) : j.stage === 2 ? CM.REACT[2](q, j, a, C) : CM.REACT[3](q, j, a)).en;

  const SCENES = {
    /* 00 들어가며: 제목 → apply × → register ✓ → Teacher × → Professor · office hours ✓ → Okay. Thanks. × → 번호 되짚기 ✓ → 세 단계 */
    intro(g, u) {
      fade(g, ramp(u, 0.2, 0.6) * (1 - ramp(u, 5.0, 0.5)), () => {
        const T = '교환학생 생활, 부탁은 질문으로 문제는 사실부터';
        txt(g, T, W / 2, 262, { size: fit(g, T, 48, 1140, 800, 30, FD), weight: 800, fam: FD, align: 'center' });
        txt(g, 'Campus life English for exchange students · 수업 등록에서 RA 상담까지 일곱 곳', W / 2, 332, { size: fit(g, 'Campus life English for exchange students · 수업 등록에서 RA 상담까지 일곱 곳', 23, 1140, 500), weight: 500, color: COL.muted, align: 'center' });
        CM.PLACES.forEach((p, i) => fade(g, ramp(u, 0.9 + i * 0.22, 0.4), () => {
          const x = W / 2 + (i - 3) * 132;
          circ(g, x, 440, 32, COL.panel2); ring(g, x, 440, 32, ME_FIRST[p.id] ? COL.verb : COL.accent, 1.8);
          icon(g, p.id, x, 440, 30, COL.soft);
          txt(g, String(i + 1), x, 392, { size: 14, weight: 700, fam: FM, color: COL.accent, align: 'center' });
          const nm = p.ko.split(' · ')[0];
          txt(g, nm, x, 496, { size: fit(g, nm, 15, 126, 600), weight: 600, color: COL.muted, align: 'center' });
          const gap = i === 1 || i === 4;
          if (i < 6) arrow(g, x + 38, 440, x + 92, 440, gap ? 'rgba(201,167,255,0.5)' : COL.faint, 2, gap ? [4, 5] : null);
        }));
      });
      const it = CM.INTRO, C = Object.assign({}, D, it.card);
      // [5.4, 11.8] 등록 창구: apply → register for
      fade(g, ramp(u, 5.4, 0.4) * (1 - ramp(u, 11.6, 0.4)), () => {
        label(g, '학생처 창구 · 수강 신청', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, it.q, { x: LX, y: 186, w: 780, at: 5.8, u, roleAt: 6.6, size: 26, shapeAt: 6.8 });
        fade(g, win(u, 6.6, 8.4), () => thought(g, '(속으로) 수강 신청…', LX + 420, 186 + B.bh + 14, 300));
        const ay = 186 + B.bh + 84;
        answer(g, { x: LX, y: ay, w: 780, A: it.bad, B: u >= 9.6 ? it.ok : null, p: (u - 9.6) / 0.8, at: 7.6, u, size: 26, maxW: 640, trapAt: 8.4, strikeAt: 8.6, tag: ['신청 → apply? 수업은 register for', COL.trap, 8.8, 9.6], tagY: ay + 84, verdict: u >= 10.5 ? { ok: okOn(it.q, it.ok, C), at: 10.5 } : null });
        fade(g, ramp(u, 6.0, 0.5), () => courseBoard(g, RX, 160, RW, { hl: u >= 9.8 ? 210 : null }));
      });
      // [12, 16.4] 수업 뒤: Teacher × → Professor · office hours ✓
      fade(g, ramp(u, 11.8, 0.4) * (1 - ramp(u, 16.2, 0.4)), () => {
        label(g, '수업 뒤 · 교수에게', LX, 160, { color: COL.accent, size: 16 });
        exch(g, u, { q: it.dq, at: 12.2, aAt: 13.0, bad: it.dbad, ok: it.dok, mAt: 14.4, tag: 'Teacher → Professor Hale · office time → office hours', tagY: 84, y: 186, size: 24, qsize: 24 });
        doorSign(g, RX, 160, RW, { oh: 'tt', p: ramp(u, 14.6, 0.5), hl: u >= 14.6 ? 'room' : null });
      });
      // [16.6, 21] 대기 번호 → 되짚기
      fade(g, ramp(u, 16.4, 0.4) * (1 - ramp(u, 20.8, 0.5)), () => {
        label(g, '정원 · 대기 명단', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, it.rq, { x: LX, y: 186, w: 780, at: 16.6, u, size: 22, roleAt: 17.2, shapeAt: 17.4 });
        const ay = 186 + B.bh + 18;
        answer(g, { x: LX, y: ay, w: 780, A: it.skip, B: u >= 18.8 ? it.check : null, p: (u - 18.8) / 0.8, at: 17.6, u, size: 24, maxW: 600, trapAt: 18.0, strikeAt: 18.1, tag: ['되짚지 않으면 번호를 확인하지 못해요', COL.trap, 18.2, 18.8], tagY: ay + 80, verdict: u >= 19.7 ? { ok: okOn(it.rq, it.check, C), at: 19.7 } : null });
        waitSlip(g, RX, 160, RW, { n: 13, p: ramp(u, 17.2, 0.6) });
      });
      const STEP = [
        ['①', '열쇠 낱말 + 모양', 'Morning or afternoon?', '고르는 질문 → 고른 것 + please', COL.ante, 'Morning or afternoon?'],
        ['②', '틀에 내 정보 넣기', "So, I'm number ___?", '문제는 사실로 · 번호는 되짚기', COL.rel, "So, I'm number 13?"],
        ['③', '공손하게 끝내기', 'Could you …?', '부탁은 질문으로 · Professor Hale', COL.verb, 'Could you send someone to look at it?'],
      ];
      STEP.forEach(([n, t1, en, t2, c, sayT], k) => {
        const al = ramp(u, 21.2 + k * 0.5, 0.5), x0 = LX + k * 380, dy = (1 - al) * 12;
        fade(g, al, () => {
          panel(g, x0, 196 + dy, 360, 210, { fill: COL.panel, stroke: c, lw: 2 });
          txt(g, n, x0 + 24, 240 + dy, { size: 28, weight: 700, color: c });
          txt(g, t1, x0 + 66, 240 + dy, { size: 24, weight: 800, fam: FD });
          txt(g, en, x0 + 24, 300 + dy, { size: fit(g, en, 20, 320, 600), weight: 600, color: COL.en });
          txt(g, t2, x0 + 24, 344 + dy, { size: fit(g, t2, 17, 320, 700), weight: 700, color: c });
          say(x0, 284, 360, 32, sayT);
        });
      });
      fade(g, ramp(u, 23.4, 0.5), () => pieces(g, [['① ', 'key'], ['열쇠 낱말 + 모양', 'key'], ['  →  ', ''], ['② ', 'frame'], ['틀에 내 정보', 'frame'], ['  →  ', ''], ['③ ', 'pol'], ['공손하게', 'pol']], W / 2, 462, 24, 0, { align: 'center' }));
    },

    /* 01 캠퍼스 지도: 학생처(둘) · 인문관(셋) · 기숙사(둘) */
    map(g, u) {
      const sel = S.stop != null ? S.stop : null;
      const SB = { x: 70, y: 146, w: 300, h: 322 }, HB = { x: 400, y: 146, w: 400, h: 322 }, RB = { x: 830, y: 146, w: 380, h: 322 };
      const POS = { reg: [160, 318], full: [280, 318], class: [490, 318], hours: [600, 318], ext: [710, 318], dorm: [950, 318], ra: [1090, 318] };
      const NM = { reg: ['수업 등록', '과목 번호 · 반'], full: ['대기 명단', '방법 · 번호 되짚기'], class: ['수업 뒤', '면담 시간 묻기'], hours: ['교수 면담', '어려운 것 + 부탁'], ext: ['마감 연장', '부탁 한 줄'], dorm: ['기숙사 사무실', '고장 · 방 번호'], ra: ['RA 상담', '룸메이트 문제'] };
      fade(g, ramp(u, 0.3, 0.6), () => {
        // 학생처
        panel(g, SB.x, SB.y, SB.w, SB.h, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        txt(g, 'STUDENT SERVICES', SB.x + 20, SB.y + 24, { size: 12, weight: 700, fam: FM, color: COL.muted });
        rr(g, SB.x + 22, SB.y + 50, SB.w - 44, 52, 8); g.fillStyle = '#0E1620'; g.fill();
        txt(g, 'REGISTRATION OPEN', SB.x + SB.w / 2, SB.y + 76, { size: 14, weight: 800, fam: FM, color: COL.ante, align: 'center' });
        rr(g, SB.x + 22, SB.y + 268, SB.w - 44, 36, 8); g.fillStyle = COL.wood; g.fill();
        txt(g, 'REGISTRAR', SB.x + SB.w / 2, SB.y + 286, { size: 11, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
        // 인문관
        panel(g, HB.x, HB.y, HB.w, HB.h, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        txt(g, 'HUMANITIES HALL', HB.x + 20, HB.y + 24, { size: 12, weight: 700, fam: FM, color: COL.muted });
        icon(g, 'book', HB.x + HB.w - 34, HB.y + 28, 24, COL.muted);
        [['ROOM 120', 'LECTURE'], ['ROOM 318', 'PROF. HALE']].forEach(([a, b], k) => { const wx = HB.x + 40 + k * 180; rr(g, wx, HB.y + 54, 140, 80, 10); g.fillStyle = 'rgba(191,227,255,0.07)'; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.stroke(); txt(g, a, wx + 70, HB.y + 80, { size: 11, weight: 700, fam: FM, color: COL.soft, align: 'center' }); txt(g, b, wx + 70, HB.y + 104, { size: 10.5, weight: 700, fam: FM, color: COL.muted, align: 'center' }); });
        rr(g, HB.x + 30, HB.y + 268, HB.w - 60, 36, 8); g.fillStyle = COL.wood; g.fill();
        txt(g, 'CLASSROOMS · OFFICES', HB.x + HB.w / 2, HB.y + 286, { size: 11, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
        // 기숙사
        panel(g, RB.x, RB.y, RB.w, RB.h, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        txt(g, 'RESIDENCE · MAPLE HALL', RB.x + 20, RB.y + 24, { size: 12, weight: 700, fam: FM, color: COL.muted });
        g.save(); g.globalAlpha *= 0.5;
        for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) { rr(g, RB.x + 34 + c * 54, RB.y + 52 + r * 46, 34, 30, 4); g.fillStyle = (r + c) % 3 ? 'rgba(255,193,94,0.35)' : 'rgba(191,227,255,0.12)'; g.fill(); }
        g.restore();
        rr(g, RB.x + 30, RB.y + 268, RB.w - 60, 36, 8); g.fillStyle = COL.wood; g.fill();
        txt(g, 'HOUSING OFFICE · RA', RB.x + RB.w / 2, RB.y + 286, { size: 11, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
      });
      fade(g, ramp(u, 6.0, 0.4), () => arrow(g, 372, 318, 398, 318, 'rgba(201,167,255,0.75)', 2.2));
      fade(g, ramp(u, 12.4, 0.4), () => arrow(g, 802, 318, 828, 318, 'rgba(201,167,255,0.75)', 2.2));
      const AT = [1.0, 6.4, 9.0, 12.4, 13.6, 15.4, 16.6];
      CM.PLACES.forEach((p, i) => {
        const [x, y] = POS[p.id], on = sel === i, dim = sel != null && !on, me = ME_FIRST[p.id] && u >= 18.2;
        fade(g, ramp(u, AT[i], 0.45) * (dim ? 0.4 : 1), () => {
          circ(g, x, y, 24, on ? COL.accent : COL.panel2); ring(g, x, y, 24, on ? COL.accent : me ? COL.verb : COL.ante, me ? 3 : 2.2);
          icon(g, p.id, x, y, 26, on ? '#1D1305' : COL.text);
          chip(g, String(i + 1), x + 19, y - 21, { size: 11, fam: FM, weight: 700, color: '#1D1305', fill: me ? COL.verb : COL.accent, h: 18, r: 9, pad: 5, align: 'center' });
          const [l1, l2] = NM[p.id];
          txt(g, l1, x, y + 42, { size: fit(g, l1, 14, 108, 700), weight: 700, color: me ? COL.verb : COL.soft, align: 'center' });
          txt(g, l2, x, y + 60, { size: fit(g, l2, 12.5, 108, 600), weight: 600, color: me ? COL.verb : COL.muted, align: 'center' });
        });
        HITS.push({ x: x - 54, y: y - 28, w: 108, h: 100, stop: i });
      });
      // 아래 칸
      const by = 480, bh = 98;
      if (sel != null) {
        const p = CM.PLACES[sel];
        panel(g, LX, by, 1120, bh, { fill: COL.panel, stroke: COL.accent });
        icon(g, p.id, LX + 28, by + 24, 22, COL.accent);
        txt(g, `${sel + 1}. ${p.ko}`, LX + 48, by + 24, { size: 17, weight: 700, color: COL.accent });
        CM.PLACEQ[p.id].forEach((qid, k) => {
          const q = CM.Q[qid], t = q.short && /[?!.]$/.test(q.short) && q.short.length < 60 ? q.short : q.en, R = richLay(g, t, q.fast ? [] : Qm(q), 17, 590, { weight: 600 });
          shapeMark(g, q.shape, LX + 34, by + 54 + k * 28, 14, { disc: false, iw: 2.2 });
          if (R.rows > 1) txt(g, t, LX + 52, by + 54 + k * 28, { size: fit(g, t, 17, 590, 600), weight: 600, color: COL.en });
          else richDraw(g, R, LX + 52, by + 54 + k * 28, { color: COL.en });
          say(LX + 48, by + 40 + k * 28, Math.min(R.w, 600) + 8, 28, q.en);
        });
        txt(g, '대답 →', LX + 690, by + 24, { size: 14, weight: 700, color: COL.muted });
        CM.PLACEQ[p.id].map(id => CM.simQ(id, D)).forEach((q, k) => { const a = CM.model(q, D), t = shortText(a); txt(g, t, LX + 690, by + 54 + k * 28, { size: fit(g, t, 16, 420, 600), weight: 600, color: COL.rel }); say(LX + 686, by + 40 + k * 28, 430, 28, CM.text(a)); });
      } else {
        CM.PLACES.forEach((p, i) => fade(g, ramp(u, 6.2 + i * 0.5, 0.4), () => {
          const x = LX + i * 161, q = CM.Q[CM.PLACEQ[p.id][0]], t = q.short && q.short.length < 48 ? q.short : q.en, me = ME_FIRST[p.id] && u >= 18.2;
          panel(g, x, by, 151, bh, { fill: COL.panel, stroke: me ? COL.verb : COL.faint, lw: me ? 2 : 1.5 });
          txt(g, `${i + 1}`, x + 14, by + 20, { size: 13, weight: 700, fam: FM, color: COL.accent });
          txt(g, me ? '내가 먼저' : i < 2 ? '학생처' : i < 5 ? '교수' : '기숙사', x + 140, by + 20, { size: 12, weight: 700, color: me ? COL.verb : COL.muted, align: 'right' });
          const R = richLay(g, t, [], 14, 130, { weight: 600 });
          richDraw(g, R, x + 12, by + 48, { color: COL.en });
          say(x, by, 151, bh, q.en);
        }));
        fade(g, ramp(u, 24.2, 0.5), () => tag(g, '대학 · 교수 · 기숙사 · 번호 · 시간은 지어낸 예시예요', 1200, 126, COL.muted, { align: 'right', size: 14, h: 26 }));
      }
    },

    /* 02 수업 등록: apply × · 사실만 × · 명령 × → register for ✓ → 201 × → 210 ✓ → 반 고르기 → 이어 들리는 말 → Have you 짝 → 빠른 말 */
    reg(g, u) {
      if (S.course) {
        const s = S.course, C = Object.assign({}, D, { course: s.n, sec: s.sec });
        const a = s.how === 'swap' ? OT('nd_reg', CM.digitSwap(s.n)) : s.how === 'apply' ? OT('nd_apply', s.n) : s.how === 'half' ? OT('nd_rhalf') : OT('nd_reg', s.n);
        const y = pickView(g, 'reg_help', a, C, 150);
        exch(g, 99, { q: 'reg_sec', at: -9, ok: OT('sc_pl', s.sec), card: C, y: y + 24, qo: { all: true } });
        courseBoard(g, RX, 150, RW, { hl: s.how === 'swap' ? null : s.n, sec: s.sec });
        return;
      }
      const SC = CM.SCENE;
      // [0.4, 11.5] 용건
      if (u < 11.8) fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const [qid, apply, half, cmd, ok] = SC.need;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[apply, 2.4, 6.0, '신청 → apply? 입학 · 일자리에 지원할 때 써요'], [half, 6.0, 7.8, '사실만 → 용건이 없어요'], [cmd, 7.8, 9.4, '명령처럼 들려요']]);
        if (u >= 9.2) fade(g, ramp(u, 9.4, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 9.6, u, size: 23, maxW: 640, verdict: { ok: okOn(qid, ok), at: 10.3 } }));
        fade(g, ramp(u, 1.0, 0.5), () => courseBoard(g, RX, 150, RW, { hl: u >= 9.8 ? 210 : null }));
      });
      // [11.5, 17] 과목 번호: 두 묶음
      if (u >= 11.3 && u < 17.4) fade(g, ramp(u, 11.5, 0.4) * (1 - ramp(u, 17.0, 0.4)), () => {
        const [qid, bad, ok] = SC.course;
        exch(g, u, { q: qid, at: 11.7, aAt: 12.8, bad, ok, mAt: 14.6, tag: '210 → 201? 다른 과목이에요', tagY: 78 });
        numRead(g, RX, 150, RW, { n: 210, trap: 201, trapNote: '0 → oh · 숫자 차례가 바뀌면 다른 과목', p: ramp(u, 12.4, 0.6) });
      });
      // [17, 23] 반 고르기
      if (u >= 16.8 && u < 23.4) fade(g, ramp(u, 17.0, 0.4) * (1 - ramp(u, 23.0, 0.4)), () => {
        const [qid, yes, aft, ok] = SC.sec;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 17.2, u, roleAt: 17.8, size: 22, shapeAt: 18.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 18.4, 20.2, '고르는 질문에 Yes → 고른 것이 없어요'], [aft, 20.2, 21.4, '카드는 오전 반이에요']]);
        if (u >= 21.2) fade(g, ramp(u, 21.4, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 21.6, u, size: 23, verdict: { ok: okOn(qid, ok), at: 22.2 } }));
        courseBoard(g, RX, 150, RW, { hl: 210, sec: u >= 21.8 ? 'morning' : null });
      });
      // [23, 28.5] 이어서 들리는 말
      if (u >= 22.8 && u < 28.9) fade(g, ramp(u, 23.0, 0.4) * (1 - ramp(u, 28.5, 0.4)), () => {
        staff(g, 'reg_sec', { x: LX, y: 150, w: 780, all: true, u: 99, size: 22 });
        linked(g, CM.LINKED[0], LX + 10, 300, u, 23.4, 760);
        notePanel(g, RX, 150, RW, '반 · section', [
          ['the morning section', `오전 반 · ${CM.SECTIONS.morning.time}`, COL.clause],
          ['the afternoon section', `오후 반 · ${CM.SECTIONS.afternoon.time}`, COL.clause],
          ['a course · a class', '과목 · 수업', COL.soft],
        ], { u, at: 24.0, step: 0.6 });
      });
      // [28.5, 34] 들어 본 수업: Have you → I have
      if (u >= 28.3 && u < 34.4) fade(g, ramp(u, 28.5, 0.4) * (1 - ramp(u, 34.0, 0.4)), () => {
        const [qid, did, yes] = SC.taken;
        exch(g, u, { q: qid, at: 28.7, aAt: 29.8, bad: did, ok: yes, mAt: 31.4, tag: 'Have로 물었는데 I did → 짝이 어긋나요', tagY: 78, maxW: 640 });
        auxTable(g, RX, 150, RW, { hl: 'have', u, at: 28.9 });
        fade(g, ramp(u, 32.4, 0.4), () => notePanel(g, RX, 412, RW, '들어 본 적이 없다면', [["No, I haven't. Could I still sign up?", '사실 + 부탁(질문)', COL.verb]]));
      });
      // [34, 40] 빠른 말
      if (u >= 33.8) fade(g, ramp(u, 34.0, 0.4), () => {
        const [qf, guess, rp] = SC.rfast;
        const r = exch(g, u, { q: qf, at: 34.2, aAt: 35.4, bad: guess, ok: rp, mAt: 37.0, tag: '빠른 말을 짐작했어요', tagY: 108 });
        say2(g, 'What can I help you with?', r.y + 14, 38.0, u, 'clerk', 'us', [['help you with', 'key']]);
        notePanel(g, RX, 150, RW, '빠른 말 · 미국식', [
          ['whatcha need?', '= what do you need? (빠르게 말할 때)', COL.soft],
          ['Sorry, did you ask what I need?', '들린 만큼 되묻기', COL.verb],
        ], { u, at: 34.8, step: 1.2 });
      });
    },

    /* 03 정원 · 대기 명단: Yes × · Oh, okay × · reservation × · 조르기 × → waitlist ✓ → 번호 되짚기 → 빠른 말 */
    full(g, u) {
      if (S.wl) {
        const s = S.wl, C = Object.assign({}, D, { wl: s.n }), q = CM.simQ('fl_wl', C);
        const a = s.a === 'swap' ? OT('wl_so', CM.teenSwap(s.n)) : s.a === 'skip' ? OT('wl_ok') : OT('wl_so', s.n);
        const y = pickView(g, q, a, C);
        say2(g, reactOf(q, CM.judge(q, a, C), a, C), y + 20, -9, 99, 'clerk', 'us');
        waitSlip(g, RX, 150, RW, { n: s.n, trap: s.a === 'swap' ? CM.teenSwap(s.n) : null });
        return;
      }
      const SC = CM.SCENE, OTH = Object.assign({}, D, { full: 'other' });
      // [0.4, 17] 다 찬 반: 방법을 질문으로
      if (u < 17.4) fade(g, 1 - ramp(u, 17.0, 0.4), () => {
        const [qid, yes, okay, res, just, wait] = SC.full;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.4, size: 22, shapeAt: 1.6 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 2.2, 3.9, '안내에 Yes → 묻는 말이 아니에요'], [okay, 3.9, 6.0, '알겠다고만 → 들을 방법이 없어요'], [res, 6.0, 9.2, '대기 예약 → reservation? 식당 · 호텔 예약이에요'], [just, 9.2, 11.8, '그냥 넣어 달라고 조르는 말이에요']]);
        if (u >= 11.6) fade(g, ramp(u, 11.8, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: wait, at: 12.0, u, size: 23, maxW: 640, verdict: { ok: okOn(qid, wait), at: 12.7 } });
          fade(g, ramp(u, 14.2, 0.4), () => answer(g, { x: LX, y: y + A.bh + 14, w: 780, A: SC.other[2], at: 14.4, u, size: 20, maxW: 640, edge: 'rgba(242,194,154,0.25)', verdict: { ok: okOn(qid, SC.other[2], OTH), at: 15.0 }, tag: ['다른 반도 괜찮다면', COL.muted, 15.2], tagY: y + A.bh + 14 + 78 }));
        });
        fade(g, ramp(u, 0.6, 0.5), () => courseBoard(g, RX, 150, RW, { hl: 210, full: 'morning' }));
      });
      // [17, 29] 대기 번호: 되짚지 않음 × · thirty × → So, I'm number 13? ✓
      if (u >= 16.8 && u < 29.4) fade(g, ramp(u, 17.0, 0.4) * (1 - ramp(u, 29.0, 0.4)), () => {
        const [qid, okay, s30, s13] = SC.wl, q = CM.simQ(qid, D);
        const B = staff(g, q, { x: LX, y: 150, w: 780, at: 17.2, u, roleAt: 17.8, size: 22, shapeAt: 18.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[okay, 18.4, 21.0, '되짚지 않으면 번호를 확인하지 못해요']]);
        fade(g, win(u, 21.0, 23.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: s30, at: 21.2, u, size: 23, verdict: { ok: okOn(q, s30), at: 21.8 }, tag: ['thirty → 30번으로 들었어요', COL.trap, 22.0] });
          say2(g, `No — you're number ${D.wl}.`, y + A.bh + 14, 22.4, u, 'clerk', 'us', [[`number ${D.wl}`, 'slot']]);
        });
        if (u >= 23.4) fade(g, ramp(u, 23.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: s13, at: 23.8, u, size: 23, verdict: { ok: okOn(q, s13), at: 24.5 } });
          say2(g, CM.reply(q, s13, D), y + A.bh + 14, 25.0, u, 'clerk', 'us', [['email you', 'slot']]);
        });
        fade(g, 1 - ramp(u, 24.4, 0.4), () => waitSlip(g, RX, 150, RW, { n: D.wl, p: ramp(u, 17.8, 0.6), trap: u >= 21.4 && u < 23.6 ? 30 : null }));
        if (u >= 24.4) fade(g, ramp(u, 24.6, 0.4), () => pairsFig(g, RX, 150, RW, u, 24.8));
      });
      // [29, 36] 빠른 말
      if (u >= 28.8) fade(g, ramp(u, 29.0, 0.4), () => {
        const [qf, guess, rp] = SC.wfast;
        const r = exch(g, u, { q: qf, at: 29.2, aAt: 30.4, bad: guess, ok: rp, mAt: 32.0, tag: '빠른 말 · 번호를 짐작했어요', tagY: 108 });
        say2(g, "You're number 13 on the waitlist.", r.y + 14, 33.4, u, 'clerk', 'us', [['number 13', 'slot']]);
        notePanel(g, RX, 150, RW, '빠른 말 · 줄여 말하기', [
          ["Kay, you're thirteen on the list.", "= Okay. You're number 13 on the waitlist.", COL.soft],
          ['Sorry, what number am I on the waitlist?', '번호만 다시 묻기', COL.verb],
        ], { u, at: 29.8, step: 1.2 });
      });
    },

    /* 04 수업 뒤 교수에게: Yes × · Teacher × · 명령 × → Could you tell me …? ✓ → 면담 시간 되짚기 → 빠른 말 */
    class(g, u) {
      if (S.oh) {
        const s = S.oh, C = Object.assign({}, D, { oh: s.oh }), q = CM.simQ('cl_oh', C);
        const a = s.a === 'skip' ? OT('oh_ok') : OT('oh_so', s.oh + (s.a === 'ok' ? '' : s.a));
        const y = pickView(g, q, a, C);
        say2(g, reactOf(q, CM.judge(q, a, C), a, C), y + 20, -9, 99, 'prof', 'ca');
        doorSign(g, RX, 150, RW, { oh: s.oh, trap: s.a === '~d' || s.a === '~r' ? s.a : null, hl: s.a === 'ok' ? 'days' : null });
        return;
      }
      const SC = CM.SCENE;
      // [0.4, 17] 질문 있어요?
      if (u < 17.4) fade(g, 1 - ramp(u, 17.0, 0.4), () => {
        const [qid, yes, lit, tell, ok] = SC.ask;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 2.2, 6.0, 'Yes만 → 무엇인지 다시 물어요'], [lit, 6.0, 12.0, 'Teacher · office time → 한국어를 그대로 옮겼어요'], [tell, 12.0, 13.8, '명령처럼 들려요']]);
        if (u >= 13.6) fade(g, ramp(u, 13.8, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 14.0, u, size: 23, maxW: 640, verdict: { ok: okOn(qid, ok), at: 14.8 } });
          if (u >= 15.4) say2(g, CM.reply(CM.Q[qid], ok, D), y + A.bh + 14, 15.6, u, 'prof', 'ca');
        });
        notePanel(g, RX, 150, RW, '교수님 · 면담 시간', [
          ['Professor Hale', '교수님 → Professor + 성', COL.verb],
          ['Teacher', '대학에서 부르는 말로 쓰지 않아요', COL.trap],
          ['office hours', '교수가 학생을 만나는 시간 (늘 -s)', COL.clause],
        ], { u, at: 6.4, step: 1.6, hl: u >= 14.2 ? 2 : null });
      });
      // [17, 29] 면담 시간 되짚기
      if (u >= 16.8 && u < 29.4) fade(g, ramp(u, 17.0, 0.4) * (1 - ramp(u, 29.0, 0.4)), () => {
        const [qid, okay, dTrap, rTrap, so] = SC.oh, q = CM.simQ(qid, D);
        const B = staff(g, q, { x: LX, y: 150, w: 780, at: 17.2, u, roleAt: 18.0, size: 22, shapeAt: 18.4 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[okay, 18.8, 22.6, '되짚지 않으면 요일 · 방을 확인하지 못해요'], [dTrap, 22.8, 24.4, '월 · 수로 들었어요'], [rTrap, 24.4, 26.2, '380호 → three-EIGHTy로 들었어요']]);
        if (u >= 26.0) fade(g, ramp(u, 26.2, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: so, at: 26.4, u, size: 23, maxW: 640, verdict: { ok: okOn(q, so), at: 27.1 } });
          if (u >= 27.4) say2(g, CM.reply(q, so, D), y + A.bh + 14, 27.6, u, 'prof', 'ca');
        });
        const trap = u >= 23.0 && u < 24.4 ? '~d' : u >= 24.6 && u < 26.2 ? '~r' : null;
        fade(g, ramp(u, 17.4, 0.5), () => doorSign(g, RX, 150, RW, { oh: 'tt', p: ramp(u, 18.4, 0.6), trap, hl: u >= 26.6 ? 'days' : null }));
      });
      // [29, 34] 빠른 말
      if (u >= 28.8) fade(g, ramp(u, 29.0, 0.4), () => {
        const [qf, guess, rp] = SC.ofast;
        exch(g, u, { q: qf, at: 29.2, aAt: 30.2, bad: guess, ok: rp, mAt: 31.6, tag: '빠른 말을 짐작했어요', tagY: 108, maxW: 640 });
        notePanel(g, RX, 150, RW, '빠른 말 · 번호만 남았어요', [
          ['three-eighteen', '= Room 318 (방 번호는 두 묶음)', COL.clause, [], 'three-eighteen'],
          ['two to four', '= from 2 to 4 (2시에서 4시)', COL.clause, [], 'two to four'],
          ['Sorry, when are your office hours?', '요일 · 시간을 다시 묻기', COL.verb],
        ], { u, at: 29.8, step: 0.8 });
      });
    },

    /* 05 교수 면담: Teacher × · 명령 × · 사실만 × → 사실 + 부탁 ✓ → 고르는 질문 → 이어 들리는 말 → Have you 짝 */
    hours(g, u) {
      if (S.shape) {
        const q = CM.Q[S.shape], Sx = CM.SHAPE[q.shape], a = CM.model(CM.simQ(q.id, D), D);
        const B = staff(g, CM.simQ(q.id, D), { x: LX, y: 160, w: 1100, all: true, u: 99, size: 26 });
        shapeTag(g, q.shape, LX, 160 + B.bh + 40, { size: 18, h: 42 });
        txt(g, Sx.say, LX, 160 + B.bh + 96, { size: 19, weight: 600, color: COL.soft });
        if (q.aux) txt(g, `${CM.AUX[q.aux].q} → ${CM.AUX[q.aux].a}`, LX, 160 + B.bh + 130, { size: 17, weight: 600, color: COL.ante });
        else if (q.shape === 'yn' && Sx.offer) txt(g, Sx.offer, LX, 160 + B.bh + 130, { size: 16, weight: 600, color: COL.muted });
        answer(g, { x: LX, y: 160 + B.bh + 160, w: 1100, A: a, all: true, u: 99, size: a.f === 'line' ? 21 : 26, maxW: 900, verdict: { ok: true, at: -1 } });
        return;
      }
      const SC = CM.SCENE;
      // [0.4, 17] 무엇을 도와줄까요?
      if (u < 17.4) fade(g, 1 - ramp(u, 17.0, 0.4), () => {
        const [qid, lit, cmd, half, ok] = SC.help;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[lit, 2.2, 6.0, 'Teacher · 무엇이 어려운지 없어요'], [cmd, 6.0, 9.0, '명령처럼 들려요'], [half, 9.0, 12.0, '사실만 → 부탁이 빠졌어요']]);
        if (u >= 11.8) fade(g, ramp(u, 12.0, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 12.2, u, size: 22, maxW: 640, verdict: { ok: okOn(qid, ok), at: 13.0 } });
          if (u >= 13.8) say2(g, CM.reply(CM.Q[qid], ok, D), y + A.bh + 14, 14.0, u, 'prof', 'ca');
        });
        notePanel(g, RX, 150, RW, '사실 + 부탁', [
          ['Help me with …', '명령처럼 들려요', COL.trap],
          ["I'm having trouble with the readings.", '사실 · 무엇이 어려운지', COL.clause],
          ['Could you give me some advice?', '부탁 · 질문으로', COL.verb],
        ], { u, at: 6.2, step: 3.2, hl: u >= 12.4 ? 2 : null });
      });
      // [17, 23] 어휘냐 중심 생각이냐
      if (u >= 16.8 && u < 23.4) fade(g, ramp(u, 17.0, 0.4) * (1 - ramp(u, 23.0, 0.4)), () => {
        const [qid, yes, topic, ok] = SC.part;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 17.2, u, roleAt: 17.8, size: 22, shapeAt: 18.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 18.4, 20.2, '고르는 질문에 Yes → 고른 것이 없어요'], [topic, 20.2, 21.6, 'topic은 묻지 않았어요']]);
        if (u >= 21.4) fade(g, ramp(u, 21.6, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 21.8, u, size: 23, verdict: { ok: okOn(qid, ok), at: 22.4 } }));
        notePanel(g, RX, 150, RW, '읽기 과제가 어렵다면', [
          ['the vocabulary', '낱말(어휘)', COL.soft],
          ['the main ideas', '중심 생각', COL.clause],
          ['Mostly the main ideas.', '주로 중심 생각이요', COL.rel],
        ], { u, at: 17.8, step: 0.6, hl: u >= 22.0 ? 1 : null });
      });
      // [23, 29] 이어서 들리는 말 (에세이)
      if (u >= 22.8 && u < 29.4) fade(g, ramp(u, 23.0, 0.4) * (1 - ramp(u, 29.0, 0.4)), () => {
        label(g, '에세이가 어렵다면', LX, 160, { color: COL.accent, size: 15 });
        staff(g, 'oh_essay', { x: LX, y: 182, w: 780, at: 23.2, u, roleAt: 23.8, size: 22, shapeAt: 24.0 });
        linked(g, CM.LINKED[1], LX + 10, 320, u, 24.2, 760);
        notePanel(g, RX, 150, RW, '에세이가 어렵다면', [
          ['the topic', '주제 정하기', COL.clause],
          ['the structure', '글의 짜임', COL.clause],
        ], { u, at: 24.4, step: 0.6 });
      });
      // [29, 36] 학습 안내서: Have you → I have
      if (u >= 28.8) fade(g, ramp(u, 29.0, 0.4), () => {
        const [qid, doA, yes, full] = SC.tried;
        const r = exch(g, u, { q: qid, at: 29.2, aAt: 30.4, bad: doA, ok: full, mAt: 32.0, tag: 'Have로 물었는데 I do → 짝이 어긋나요', tagY: 78 });
        fade(g, ramp(u, 33.8, 0.4), () => answer(g, { x: LX, y: r.y + 16, w: 780, A: yes, at: 34.0, u, size: 20, edge: 'rgba(242,194,154,0.25)', verdict: { ok: okOn(qid, yes), at: 34.6 }, tag: ['짧게 Yes만 해도 통해요', COL.muted, 34.8], tagY: r.y + 16 + 74 }));
        if (u >= 32.8) say2(g, CM.reply(CM.Q[qid], full, D), 470, 33.0, u, 'prof', 'ca');
        auxTable(g, RX, 150, RW, { hl: 'have', u, at: 29.4 });
      });
    },

    /* 06 마감 연장 부탁 한 줄: Yes × → 한 줄 ✓ → Teacher × · 까닭 빠짐 × · I want × · report × → 며칠 더 → 새 마감 되짚기 → 빠른 말 */
    ext(g, u) {
      if (S.line) {
        const s = S.line, C = Object.assign({}, D, { why: s.why, days: s.days, due: CM.dueOf(s.days) }), a = CM.L(s.words.slice());
        const B = staff(g, 'ex_else', { x: LX, y: 150, w: 780, all: true, u: 99, size: 22 });
        if (!s.words.length) txt(g, '아래 조각을 골라 부탁 한 줄을 만들어 보세요.', LX, 150 + B.bh + 40, { size: 18, weight: 600, color: COL.muted });
        else {
          const A = answer(g, { x: LX, y: 150 + B.bh + 16, w: 780, A: a, all: true, u: 99, size: 21, maxW: 640, verdict: { ok: CM.checkLine(a.line, C).ok, at: -1 } });
          const fx = CM.fixLine(a.line, C);
          const T = talk(g, { side: 'L', x: LX, y: 150 + B.bh + A.bh + 30, w: 780, text: fx.en, marks: [], kind: 'prof', sp: 'ca', all: true, u: 99, size: 21 });
          const j = CM.checkLine(a.line, C), K = richLay(g, j.why, [], 15, 770, { weight: 600 });
          richDraw(g, K, LX, 150 + B.bh + A.bh + T.bh + 60, { color: j.ok ? COL.good : COL.trap });
        }
        lineOrder(g, RX, 150, RW, { words: s.words.length ? s.words : CM.lineWords(C) });
        return;
      }
      const SC = CM.SCENE, LS = {}; SC.lines.forEach(([k, a]) => { LS[k] = a; });
      let B = { bh: 0 };
      fade(g, 1 - ramp(u, 24.2, 0.4), () => { B = staff(g, 'ex_else', { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.4, size: 22, shapeAt: 1.6 }); });
      const y0 = 150 + B.bh + 16;
      // [0.4, 5.5] Yes만 ×
      fade(g, win(u, 2.0, 5.5, 0.3), () => {
        const A = answer(g, { x: LX, y: y0, w: 780, A: SC.else[1], at: 2.2, u, size: 23, trapAt: 2.8, strikeAt: 2.9, tag: ['Yes만 → 무엇을 부탁하는지 몰라요', COL.trap, 3.0] });
        say2(g, 'Sure — what is it?', y0 + A.bh + 14, 3.8, u, 'prof', 'ca');
      });
      // [5.5, 11] 바른 한 줄 ✓
      fade(g, win(u, 5.5, 11.0, 0.3), () => {
        const A = answer(g, { x: LX, y: y0, w: 780, A: LS.ok, at: 5.8, u, size: 21, maxW: 640, verdict: { ok: okOn('ex_else', LS.ok), at: 7.2 } });
        say2(g, CM.fixLine(LS.ok.line, D).en, y0 + A.bh + 14, 8.4, u, 'prof', 'ca');
      });
      // [11, 24.5] Teacher × · 까닭 빠짐 × · I want × · report × (교수가 그 조각만 고쳐 줌)
      [[LS.teacher, 11.0, 15.5, 'Teacher → Professor Hale', { call: 'Teacher' }], [LS.nowhy, 15.5, 17.8, '까닭(사실)이 빠졌어요', { why: '(빠짐)' }], [LS.want, 17.8, 20.0, 'I want → 조르는 말', { ask: 'I want' }], [LS.rep, 20.0, 24.5, 'report → essay · extension', { want: 'more time for my report' }]].forEach(([a, s, e, tg, bad]) => {
        if (u < s - 0.2 || u > e + 0.2) return;
        fade(g, win(u, s, e, 0.3), () => {
          const A = answer(g, { x: LX, y: y0, w: 780, A: a, at: s + 0.2, u, size: 21, maxW: 640, verdict: { ok: false, at: s + 0.7 } });
          const T = say2(g, CM.fixLine(a.line, D).en, y0 + A.bh + 14, s + 0.9, u, 'prof', 'ca');
          fade(g, ramp(u, s + 0.9, 0.3), () => tag(g, tg, LX + 780, y0 + A.bh + T.bh + 40, COL.trap, { align: 'right', size: 15, h: 30 }));
          lineOrder(g, RX, 150, RW, { bad });
        });
      });
      // 오른쪽 [0.4, 11]: 한 줄의 차례
      if (u < 11.2) fade(g, ramp(u, 0.6, 0.5) * (1 - ramp(u, 10.8, 0.4)), () => lineOrder(g, RX, 150, RW, { p: clamp((u - 5.6) / 3.0), hl: u >= 8.8 ? null : null }));
      // [24.5, 29.5] 며칠 더
      fade(g, win(u, 24.5, 29.5, 0.3), () => {
        label(g, '날수를 빼고 부탁했다면', LX, 160, { color: COL.accent, size: 15 });
        const [qid, dur, , pl] = SC.days;
        exch(g, u, { q: qid, at: 24.8, aAt: 25.8, bad: dur, ok: pl, mAt: 27.4, tag: '‘동안’ → during? 더 필요한 날수는 more days', tagY: 78, y: 182 });
        notePanel(g, RX, 150, RW, 'extension · 날수', [
          ['a two-day extension', '이틀 연장 (two-day · s 없이)', COL.clause],
          ['two more days', '이틀 더', COL.clause],
          ['during the break', 'during + 그때의 이름', COL.soft],
        ], { u, at: 25.2, step: 0.6 });
      });
      // [29.5, 35.5] 새 마감 되짚기
      fade(g, win(u, 29.5, 35.5, 0.3), () => {
        const [qid, okay, mon, sun] = SC.due, q = CM.simQ(qid, D);
        const B2 = staff(g, q, { x: LX, y: 150, w: 780, at: 29.7, u, roleAt: 30.3, size: 22, shapeAt: 30.5 });
        const y = 150 + B2.bh + 14;
        trapSeq(g, u, y, [[okay, 30.9, 32.6, '되짚지 않으면 새 마감을 확인하지 못해요'], [mon, 32.6, 34.0, '월요일로 들었어요']]);
        if (u >= 33.8) fade(g, ramp(u, 34.0, 0.3), () => answer(g, { x: LX, y, w: 780, A: sun, at: 34.1, u, size: 23, verdict: { ok: okOn(q, sun), at: 34.7 } }));
        weekCal(g, RX, 150, RW, { days: D.days, p: ramp(u, 30.4, 1.2) });
      });
      // [35.5, 42] 빠른 말
      if (u >= 35.3) fade(g, ramp(u, 35.5, 0.3), () => {
        const [qf, guess, rp] = SC.dfast;
        const r = exch(g, u, { q: qf, at: 35.7, aAt: 36.8, bad: guess, ok: rp, mAt: 38.4, tag: '빠른 말을 짐작했어요', tagY: 78 });
        say2(g, 'By Sunday at midnight.', r.y + 14, 39.6, u, 'prof', 'ca', [['Sunday at midnight', 'slot']]);
        notePanel(g, RX, 150, RW, '빠른 말 · 캐나다', [
          ['just get it to me by …', '= please send it to me by …', COL.soft],
          ['Sorry, when is the new deadline?', '마감만 다시 묻기', COL.verb],
        ], { u, at: 36.2, step: 1.2 });
      });
    },

    /* 07 기숙사 고장: boiler × · 명령 × · 사실만 × → 사실 + 부탁 ✓ → 방 번호 → 빠른 말 → Is it 짝 · 모르는 낱말 → 들어가도 되나 → 수리 시간 되짚기 */
    dorm(g, u) {
      if (S.aux) {
        const q = CM.Q[S.aux.q], a = OT(S.aux.a, S.aux.v), C = Object.assign({}, D, S.aux.card || {});
        const r = exch(g, 99, { q, at: -9, ok: a, card: C, y: 160, qo: { all: true } });
        whyLine(g, CM.judge(q, a, C), r.y + 30, 780, LX);
        auxTable(g, RX, 150, RW, { hl: q.aux });
        return;
      }
      const SC = CM.SCENE, NO = Object.assign({}, D, { enter: false });
      // [0.4, 12] 고장 알리기
      if (u < 12.4) fade(g, 1 - ramp(u, 12.0, 0.4), () => {
        const [qid, boiler, cmd, half, ok] = SC.fix;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[boiler, 2.2, 6.0, '난방기 → boiler? 건물 전체의 큰 기계예요'], [cmd, 6.0, 7.8, '명령처럼 들려요'], [half, 7.8, 9.6, '사실만 → 부탁이 빠졌어요']]);
        if (u >= 9.4) fade(g, ramp(u, 9.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 9.8, u, size: 22, maxW: 640, verdict: { ok: okOn(qid, ok), at: 10.6 } });
          if (u >= 11.0) say2(g, CM.reply(CM.Q[qid], ok, D), y + A.bh + 14, 11.2, u, 'housing', 'gb');
        });
        fade(g, ramp(u, 1.0, 0.5), () => thingCards(g, RX, 150, RW, { hl: 'heater', trap: u >= 2.4 && u < 6.0 ? 'boiler' : null }));
      });
      // [12, 18.5] 방 번호
      if (u >= 11.8 && u < 18.9) fade(g, ramp(u, 12.0, 0.4) * (1 - ramp(u, 18.5, 0.4)), () => {
        const [qid, dormA, r240, cedar, ok] = SC.room;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 12.2, u, roleAt: 12.8, size: 22, shapeAt: 13.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[dormA, 13.4, 15.0, '사는 곳의 종류만 · 번호가 없어요'], [r240, 15.0, 16.2, '214 → 240 · two-FORty'], [cedar, 16.2, 17.2, '건물이 달라요']]);
        if (u >= 17.0) fade(g, ramp(u, 17.2, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 17.3, u, size: 23, verdict: { ok: okOn(qid, ok), at: 17.8 } }));
        numRead(g, RX, 150, RW, { n: 214, trap: 240, trapNote: 'two-fourTEEN ↔ two-FORty · 뒤가 세면 -teen', title: '방 번호 · 두 묶음으로', p: ramp(u, 13.0, 0.6) });
      });
      // [18.5, 22.5] 빠른 말
      if (u >= 18.3 && u < 22.9) fade(g, ramp(u, 18.5, 0.4) * (1 - ramp(u, 22.5, 0.4)), () => {
        const [qf, guess, rp] = SC.rfast2;
        exch(g, u, { q: qf, at: 18.7, aAt: 19.6, bad: guess, ok: rp, mAt: 20.8, tag: '빠른 말을 짐작했어요', tagY: 78 });
        notePanel(g, RX, 150, RW, '빠른 말 · 영국식', [
          ["What's yer room number, love?", 'yer = your · love = 친근하게 부르는 말', COL.soft],
          ['Sorry, did you ask for my room number?', '들린 만큼 되묻기', COL.verb],
        ], { u, at: 19.0, step: 1.0 });
      });
      // [22.5, 32.5] 없을 때 들어가도 되나: Is it → 짝 · 모르는 낱말 → 괜찮음 / 있을 때 오면 좋음
      if (u >= 22.3 && u < 32.9) fade(g, ramp(u, 22.5, 0.4) * (1 - ramp(u, 32.5, 0.4)), () => {
        const [qid, doA, what, ok] = SC.enter;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 22.7, u, roleAt: 23.3, size: 22, shapeAt: 23.5 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[doA, 23.9, 25.4, 'Is로 물었는데 I do → 짝이 어긋나요']]);
        fade(g, win(u, 25.4, 28.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: what, at: 25.6, u, size: 23, verdict: { ok: okOn(qid, what), at: 26.3 } });
          say2(g, 'It means our repair staff — the people who fix things.', y + A.bh + 14, 26.8, u, 'housing', 'gb', [['repair staff', 'slot']]);
        });
        if (u >= 28.4) fade(g, ramp(u, 28.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 28.7, u, size: 23, verdict: { ok: okOn(qid, ok), at: 29.3 } });
          fade(g, ramp(u, 30.0, 0.4), () => answer(g, { x: LX, y: y + A.bh + 14, w: 780, A: SC.noenter[2], at: 30.2, u, size: 20, maxW: 640, edge: 'rgba(242,194,154,0.25)', verdict: { ok: okOn(qid, SC.noenter[2], NO), at: 30.8 }, tag: ['내가 있을 때 오면 좋겠다면', COL.muted, 31.0], tagY: y + A.bh + 14 + 78 }));
        });
        auxTable(g, RX, 150, RW, { hl: 'is', u, at: 22.9 });
      });
      // [32.5, 38] 수리 시간 되짚기
      if (u >= 32.3) fade(g, ramp(u, 32.5, 0.4), () => {
        const [qid, okay, b, so] = SC.visit, q = CM.simQ(qid, D);
        const B = staff(g, q, { x: LX, y: 150, w: 780, at: 32.7, u, roleAt: 33.3, size: 22, shapeAt: 33.5 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[okay, 33.9, 35.2, '되짚지 않으면 시간을 확인하지 못해요'], [b, 35.2, 36.4, '1시에서 3시로 들었어요']]);
        if (u >= 36.2) fade(g, ramp(u, 36.4, 0.3), () => answer(g, { x: LX, y, w: 780, A: so, at: 36.5, u, size: 23, verdict: { ok: okOn(q, so), at: 37.1 } }));
        repairForm(g, RX - 10, 150, 320, D, { show: k => k !== 'visit' || u >= 37.1, hl: u >= 37.1 ? 'visit' : null });
      });
    },

    /* 08 룸메이트 · RA: Here is × · 명령 × · 사실만 × → 사실 + 그래서 + 부탁 ✓ → Have you 짝 → 빠른 말 → 도와준다는 말 받기 */
    ra(g, u) {
      if (S.card) {
        const s = S.card, C = Object.assign({}, D, { issue: s.issue, talked: s.talked, with: s.with });
        let r = exch(g, 99, { q: 'ra_help', at: -9, ok: OT(s.how === 'half' ? 'nd_ahalf' : 'nd_adv', s.issue), card: C, y: 150, qo: { all: true } });
        r = exch(g, 99, { q: 'ra_talk', at: -9, ok: OT(s.talked ? 'tl_yes' : 'tl_no'), card: C, y: r.y + 16, qo: { all: true } });
        exch(g, 99, { q: 'ra_with', at: -9, ok: OT(s.with ? 'wi_yes' : 'wi_no'), card: C, y: r.y + 16, qo: { all: true } });
        notePanel(g, RX, 150, RW, '사실 → 그래서 → 부탁', [
          [CM.ISSUES[s.issue].t + ',', '사실 · 무엇이 문제인지', COL.clause],
          ["so I can't sleep.", '그래서 어떤지', COL.clause],
          ['Could I get some advice?', '부탁 · 질문으로', COL.verb],
        ]);
        return;
      }
      const SC = CM.SCENE;
      // [0.4, 12] 무슨 일이야?
      if (u < 12.4) fade(g, 1 - ramp(u, 12.0, 0.4), () => {
        const [qid, noisy, change, half, ok] = SC.adv;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[noisy, 2.2, 4.6, 'Here is → here는 주어 자리에 오지 않아요'], [change, 4.6, 6.2, '명령처럼 들려요'], [half, 6.2, 8.6, '사실만 → 그래서 어떤지 · 부탁이 빠졌어요']]);
        if (u >= 8.4) fade(g, ramp(u, 8.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 8.8, u, size: 22, maxW: 640, verdict: { ok: okOn(qid, ok), at: 9.6 } });
          if (u >= 10.4) say2(g, CM.reply(CM.Q[qid], ok, D), y + A.bh + 14, 10.6, u, 'ra', 'au');
        });
        notePanel(g, RX, 150, RW, '사실 → 그래서 → 부탁', [
          ['My roommate plays loud music late at night,', '사실 · 무엇이 문제인지', COL.clause],
          ["so I can't sleep.", '그래서 어떤지', COL.clause],
          ['Could I get some advice?', '부탁 · 질문으로', COL.verb],
        ], { u, at: 6.6, step: 0.9 });
      });
      // [12, 18] 얘기해 봤어?
      if (u >= 11.8 && u < 18.4) fade(g, ramp(u, 12.0, 0.4) * (1 - ramp(u, 18.0, 0.4)), () => {
        const [qid, doA, no] = SC.talk;
        const r = exch(g, u, { q: qid, at: 12.2, aAt: 13.4, bad: doA, ok: no, mAt: 15.0, tag: "Have로 물었는데 I don't → 짝이 어긋나요", tagY: 78 });
        if (u >= 16.0) say2(g, CM.reply(CM.Q[qid], no, D), r.y + 14, 16.2, u, 'ra', 'au');
        auxTable(g, RX, 150, RW, { hl: 'have', u, at: 12.4 });
      });
      // [18, 23] 빠른 말
      if (u >= 17.8 && u < 23.4) fade(g, ramp(u, 18.0, 0.4) * (1 - ramp(u, 23.0, 0.4)), () => {
        const [qf, guess, rp] = SC.tfast;
        exch(g, u, { q: qf, at: 18.2, aAt: 19.2, bad: guess, ok: rp, mAt: 20.6, tag: '빠른 말을 짐작했어요', tagY: 108 });
        notePanel(g, RX, 150, RW, '빠른 말 · 호주식', [
          ["Ya talked to 'em …?", '= Have you talked to them …?', COL.soft],
          ['Sorry, did you ask if I talked to my roommate?', '들린 만큼 되묻기', COL.verb],
        ], { u, at: 18.8, step: 1.0 });
      });
      // [23, 34] 같이 있어 줄까?
      if (u >= 22.8) fade(g, ramp(u, 23.0, 0.4), () => {
        const [qid, want, yesp, yes] = SC.with;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 23.2, u, roleAt: 23.8, size: 22, shapeAt: 24.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[want, 24.4, 28.2, '명령처럼 들려요']]);
        if (u >= 28.2) fade(g, ramp(u, 28.4, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: yes, at: 28.6, u, size: 23, verdict: { ok: okOn(qid, yes), at: 29.3 } });
          fade(g, ramp(u, 30.4, 0.4), () => answer(g, { x: LX, y: y + A.bh + 14, w: 780, A: yesp, at: 30.6, u, size: 20, edge: 'rgba(242,194,154,0.25)', verdict: { ok: okOn(qid, yesp), at: 31.2 }, tag: ['짧게 해도 좋아요', COL.muted, 31.4], tagY: y + A.bh + 14 + 74 }));
          if (u >= 32.2) say2(g, CM.reply(CM.Q[qid], yes, D), y + A.bh + 104, 32.4, u, 'ra', 'au');
        });
        notePanel(g, RX, 150, RW, '도와준다는 말을 받을 때', [
          ['Yes, please. That would really help.', '네, 그래 주세요 · 정말 도움이 될 거예요', COL.verb],
          [CM.text(OT('wi_no')), '먼저 혼자 얘기해 볼 때', COL.soft],
        ], { u, at: 28.8, step: 1.2 });
      });
    },

    /* 09 3단계 말하기 법 */
    method(g, u) {
      const BOX = [['①', '열쇠 낱말 + 모양', 'or → 고르기 · What → 정보 · Have you · Is it → Y/N', COL.ante, 5.5], ['②', '틀에 내 정보 넣기', "문제는 사실로 · So, I'm number 13? (되짚기)", COL.rel, 11.5], ['③', '공손하게 끝내기', 'Could you …? · Would it be possible …? · Professor Hale', COL.verb, 17.5]];
      const sel = S.place;
      BOX.forEach(([n, t1, t2, c, at], k) => {
        const on = sel != null || u >= at, x0 = LX + k * 385;
        fade(g, ramp(u, 0.6 + k * 0.3, 0.5), () => {
          panel(g, x0, 146, 365, 114, { fill: on ? COL.panel2 : COL.panel, stroke: on ? c : COL.faint, lw: on ? 2.2 : 1.5 });
          txt(g, n, x0 + 20, 180, { size: 26, weight: 700, color: c });
          txt(g, t1, x0 + 62, 180, { size: 22, weight: 800, fam: FD });
          txt(g, t2, x0 + 20, 228, { size: fit(g, t2, 15, 330, 600), weight: 600, color: on ? COL.en : COL.dim });
          if (k < 2) arrow(g, x0 + 367, 203, x0 + 383, 203, COL.accent, 2.5);
        });
      });
      CM.METHOD.forEach(([qid, a], i) => {
        const y = 300 + i * 39, q = CM.simQ(qid, D), p = CM.PLACE[q.place], dim = sel != null && sel !== i;
        fade(g, ramp(u, 1.4 + i * 0.3, 0.4) * (dim ? 0.35 : 1), () => {
          if (sel === i) { rr(g, LX - 6, y - 18, 1132, 36, 8); g.fillStyle = 'rgba(255,193,94,0.10)'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 1.5; g.stroke(); }
          circ(g, LX + 14, y, 15, COL.panel2); icon(g, p.id, LX + 14, y, 18, ME_FIRST[p.id] ? COL.verb : COL.soft);
          const keysOn = sel != null || u >= 6.0 + i * 0.3, ansOn = sel != null || u >= 12.0 + i * 0.4, polOn = sel != null || u >= 18.0;
          if (keysOn) shapeMark(g, q.shape, LX + 50, y, 16, { disc: false, iw: 2.2 });
          const t = q.short && /[?!.]$/.test(q.short) && q.short.length < 46 ? q.short : q.en;
          const R = richLay(g, t, keysOn ? Qm(q) : [], 17, 430, { weight: 500 });
          if (R.rows > 1) { const t2 = q.short || q.en; txt(g, t2, LX + 70, y, { size: fit(g, t2, 17, 440, 500), weight: 500, color: COL.soft }); }
          else richDraw(g, R, LX + 70, y, { color: COL.soft });
          say(LX + 66, y - 16, Math.min(R.w, 440) + 8, 32, q.en);
          if (ansOn) fade(g, sel != null ? 1 : ramp(u, 12.0 + i * 0.4, 0.4), () => {
            txt(g, '→', 566, y, { size: 18, weight: 700, color: COL.muted });
            pieces(g, shortParts(a).map(([tt, r]) => [tt, r === 'pol' && !polOn ? 'frame' : r]), 598, y, 18, 600);
            say(594, y - 16, 606, 32, CM.text(a));
          });
        });
      });
    },

    /* 10 실전: 내 카드 하나로 넷 */
    practice(g, u) {
      const pi = u < PSEG[1] ? 0 : u < PSEG[2] ? 1 : u < PSEG[3] ? 2 : 3, v = u - PSEG[pi];
      const P = CM.PRACTICE[pi], C = CM.PCARD, q = CM.practiceQ(P);
      const a = ramp(v, 0, 0.5) * (pi < 3 ? 1 - ramp(u, PSEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `대화 ${pi + 1} / 4 · ${CM.PLACE[q.place].ko}`, LX, 150, { size: 16, weight: 500, fam: FM, color: COL.accent });
        myCard(g, LX, 168, 336, C, { rh: 30, vs: 13.5, rows: PROWS, hl: { reg_sec: 0, fl_full: 1, ex_else: 2, dm_room: 3 }[P.q] });
        talk(g, { side: 'L', x: 432, y: 172, w: 768, text: q.en, marks: Qm(q), kind: kindOf(q), sp: q.sp, at: PT.q, u: v, roleAt: PT.lines[0] + 0.4, size: q.en.length > 80 ? 19 : 22, shape: q.shape, shapeAt: PT.lines[0] + 0.4 });
        const J = P.opts.map(o => CM.judge(q, o, C));
        const goneAt = k => { const s = J[k].stage; if (!s) return null; const same = P.opts.map((_, i) => i).filter(i => J[i].stage === s); return [0, PT.s1, PT.s2, PT.s3][s] + same.indexOf(k) * 1.1; };
        const longs = P.opts.some(o => CM.text(o).length > 90), oy0 = q.en.length > 80 ? 300 : longs ? 272 : 262, gap = longs ? 64 : q.en.length > 80 ? 52 : 60;
        P.opts.forEach((o, k) => {
          const y = oy0 + k * gap, gA = goneAt(k), won = k === P.a && v >= PT.win;
          fade(g, ramp(v, PT.opt[k], 0.4), () => {
            const isLine = o.f === 'line' || CM.text(o).length > 52, hh = isLine ? (longs ? 60 : 54) : 48;
            if (won) { rr(g, 432, y - hh / 2, 768, hh, 10); g.fillStyle = 'rgba(127,224,168,0.08)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
            const gone = gA != null && v >= gA, rolesOn = v >= PT.lines[1] + 0.4 || won;
            txt(g, `(${'ABC'[k]})`, 446, y, { size: 18, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
            let w;
            if (isLine) { const R = wrapAns(g, o, 494, y, longs ? 15.5 : 17, longs ? 650 : 590, { dim: gone, plain: !rolesOn }); w = R.w; }
            else w = pieces(g, ansParts(o).map(([t, r]) => [t, gone ? 'dim' : rolesOn ? r : '']), 494, y, 19, 560, { color: gone ? COL.dim : COL.text });
            say(490, y - hh / 2, w + 10, hh, CM.text(o));
            if (gone) {
              strikeLine(g, 440, 440 + Math.min(w, 600) + 64, y + 1, (v - gA) / 0.4);
              fade(g, ramp(v, gA + 0.3, 0.3), () => tag(g, `${['', '①', '②', '③'][J[k].stage]} 탈락`, 1180, y, COL.trap, { align: 'right', size: 15, h: 30 }));
            }
            if (won) mark(g, true, 1170, y, 17);
          });
        });
        panel(g, LX, 446, 1120, 128, { fill: COL.panel, stroke: COL.faint });
        const heads = ['① 열쇠 낱말 · 모양', '② 틀 + 내 정보', '③ 공손 · 정답'];
        P.lines.forEach((ln, k) => fade(g, ramp(v, PT.lines[k] + 0.3, 0.5), () => {
          const y = 472 + k * 38;
          txt(g, heads[k], LX + 22, y, { size: 16, weight: 700, color: [COL.ante, COL.rel, COL.verb][k] });
          txt(g, ln, LX + 196, y, { size: fit(g, ln, 18, 900, 600), weight: 600, color: k === 2 && v >= PT.win ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 300, 640], Y0 = 152, RH = 41;
      const rows = [
        ['reg', '수업 등록', 'or', 'What can I help you with? · morning or afternoon', [["I'd like to register for ", 'frame'], ['English 210', 'slot'], [', ', 'frame'], ['please', 'pol'], ['. · The ', 'frame'], ['morning', 'slot'], [' section, please.', 'frame']]],
        ['full', '정원 · 대기 명단', 'note', "full · You're number 13 on the waitlist", [['Could you', 'pol'], [" put me on the waitlist, please? · So, I'm number ", 'frame'], ['13', 'slot'], ['?', 'frame']]],
        ['class', '수업 뒤 교수에게', 'yn', 'Did you have a question? · office hours', [['Yes. ', 'frame'], ['Could you', 'pol'], [' tell me when your ', 'frame'], ['office hours', 'slot'], [' are?', 'frame']]],
        ['hours', '교수 면담', 'wh', 'What can I do for you? · vocabulary or main ideas', [["I'm having trouble ", 'frame'], ['with the readings', 'slot'], ['. ', 'frame'], ['Could you', 'pol'], [' give me some advice?', 'frame']]],
        ['ext', '마감 연장', 'yn', 'anything else · How many more days · by Sunday', [['Professor Hale', 'pol'], [', ', 'frame'], ['I was sick this week', 'slot'], ['. ', 'frame'], ['Would it be possible', 'pol'], [' to get ', 'frame'], ['a two-day extension', 'slot'], [' …?', 'frame']], 'Professor Hale, I was sick this week. Would it be possible to get a two-day extension on my essay?'],
        ['dorm', '기숙사 고장', 'wh', 'How can I help? · room number · Is it alright …?', [['The ', 'frame'], ['heater', 'slot'], [" in my room isn't working. ", 'frame'], ['Could you', 'pol'], [' send someone …?', 'frame']], "The heater in my room isn't working. Could you send someone to look at it?"],
        ['ra', '룸메이트 · RA', 'wh', "What's up? · Have you talked … · Would you like me …", [['My roommate plays loud music', 'slot'], [", so I can't sleep. ", 'frame'], ['Could I', 'pol'], [' get some advice?', 'frame']], "My roommate plays loud music late at night, so I can't sleep. Could I get some advice?"],
        [null, '숫자 읽기', null, '번호 → 두 묶음 · -teen과 -ty', [['210 = ', 'frame'], ['two-ten', 'slot'], [' · 13 = ', 'frame'], ['thirTEEN', 'slot'], [' · 30 = ', 'frame'], ['THIRty', 'slot']], 'two-ten. thirteen. thirty.'],
        [null, '못 알아들었을 때', null, '빠른 말 · 모르는 낱말', [['Sorry', 'pol'], [', what number am I on the waitlist? · ', 'frame'], ['Sorry', 'pol'], [', what does maintenance mean?', 'frame']]],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 10, { fill: COL.panel, stroke: COL.faint });
        ['곳', '열쇠 낱말 · 모양', '대답 틀'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 16, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 6, 1120, 1);
      });
      rows.forEach(([pid, nm, sh, keys, ans, sayT], ri) => fade(g, ramp(u, 1.0 + ri * 0.4, 0.5), () => {
        const y = Y0 + RH * (ri + 1) + 14;
        circ(g, X[0] + 32, y, 15, COL.panel2);
        if (pid) icon(g, pid, X[0] + 32, y, 18, ME_FIRST[pid] ? COL.verb : COL.soft);
        else txt(g, ri === 7 ? '13' : '?', X[0] + 32, y + 1, { size: ri === 7 ? 13 : 18, weight: 800, fam: ri === 7 ? FM : FB, color: COL.verb, align: 'center' });
        txt(g, nm, X[0] + 58, y, { size: fit(g, nm, 18, X[1] - X[0] - 70, 700), weight: 700 });
        if (sh) shapeMark(g, sh, X[1] + 26, y, 15, { disc: false, iw: 2.2 });
        txt(g, keys, X[1] + (sh ? 44 : 20), y, { size: fit(g, keys, 15, X[2] - X[1] - (sh ? 56 : 34), 600), weight: 600, color: COL.ante });
        const w = pieces(g, ans, X[2] + 20, y, 16.5, 1196 - X[2] - 30);
        say(X[2] + 16, y - 18, w + 8, 36, sayT || ans.map(p => p[0]).join(''));
      }));
    },
  };
  // 실전 장면의 내 카드 줄 (CM.PCARD와 같은 사실)
  const PC = CM.PCARD, PR = CM.roomParse(PC.room);
  const PROWS = [
    ['수업 등록', `English ${PC.course}(${CM.COURSES[PC.course].ko}) · ${CM.SECTIONS[PC.sec].ko}`],
    ['반이 다 찼으면', `${CM.SECTIONS[PC.alt].ko}도 괜찮아요`],
    ['마감 연장', `${CM.WHYS[PC.why].ko} → 에세이 마감을 ${CM.DAYS[PC.days].ko} 미루고 싶어요`],
    ['기숙사', `${CM.HALLS[PR.hall].ko}(${CM.HALLS[PR.hall].t}) ${PR.n}호`],
  ];
  CMS.PROWS = PROWS;

  // 이어서 들리는 말: 위 = 쓰인 낱말 (이어지는 곳은 호), 아래 = 들리는 소리 (세게 = 크고 높게)
  function linked(g, L, x, y, u, at, maxW) {
    fade(g, ramp(u, at, 0.4), () => {
      const size = 28, gap = 22; let xx = x; const pos = [];
      L.words.forEach(w => { const ww = tw(g, w, size, 600); pos.push([xx, ww]); xx += ww + gap; });
      L.words.forEach((w, i) => { txt(g, w, pos[i][0], y, { size, weight: 600, color: COL.en }); });
      listen(x - 6, y - 24, xx - x, 48, [{ text: L.say || L.en, sp: CM.Q[L.q] ? CM.Q[L.q].sp : 'us', rate: 1.2 }]);
      fade(g, ramp(u, at + 0.6, 0.4), () => L.link.forEach(([a, b]) => {
        const x1 = pos[a][0] + pos[a][1] - 6, x2 = pos[b][0] + 6;
        g.strokeStyle = COL.accent; g.lineWidth = 3; g.beginPath(); g.moveTo(x1, y + 22); g.quadraticCurveTo((x1 + x2) / 2, y + 44, x2, y + 22); g.stroke();
      }));
      let sx = x; const sy = y + 96;
      L.sound.forEach(([s, big], i) => fade(g, ramp(u, at + 1.0 + i * 0.22, 0.3), () => {
        const sz = big ? 30 : 21, w = tw(g, s, sz, big ? 800 : 500) + 22, h = big ? 60 : 40;
        rr(g, sx, sy - h, w, h, 10); g.fillStyle = big ? 'rgba(255,193,94,0.22)' : 'rgba(238,241,244,0.07)'; g.fill(); g.strokeStyle = big ? COL.accent : COL.line; g.lineWidth = 1.8; g.stroke();
        txt(g, s, sx + w / 2, sy - h / 2, { size: sz, weight: big ? 800 : 500, color: big ? COL.accent : COL.soft, align: 'center' });
        sx += w + 6;
      }));
      fade(g, ramp(u, at + 1.6, 0.4), () => { const R = richLay(g, L.ko, [], 16, maxW || 760, { weight: 600 }); richDraw(g, R, x, sy + 28, { color: COL.soft }); });
    });
  }
  CMS.linked = linked;

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

  CMS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[CMS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    if (ch.place != null) strip(g, ch.place, ramp(u, 0.2, 0.5));
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, CMS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + CM.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔↗↘✓✕×÷?!~=+-–—/:…‘’\'%$&<>|•';
  CMS.baseText = EXTRA;
  CMS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = CMS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { CMS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
