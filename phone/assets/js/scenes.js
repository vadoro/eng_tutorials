(function () {
  'use strict';
  const PN = window.PN;
  const PNS = (window.PNS = {});
  const W = 1280, H = 720;
  PNS.W = W; PNS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  PNS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', paper: '#F4F1E8', ink: '#1E2630', teal: '#2F4A44', wood: '#3A2E25', red: '#B8432B',
  };
  PNS.COL = COL;
  // 역할 → 색 (낱말 조각 · 말풍선 글)
  const RC = { key: COL.ante, frame: COL.rel, slot: COL.clause, pol: COL.verb, trap: COL.trap, ok: COL.good, dim: COL.dim, bad: COL.bad };
  PNS.RC = RC;
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8', me: '#F2C29A' };
  const SHC = { yn: COL.ante, or: COL.rel, wh: COL.clause, note: COL.verb };   // 모양 표시의 색
  PNS.SHC = SHC;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (PNS.S = { stop: null, place: null, book: null, time: null, spell: null, info: null, shape: null, line: null, num: null, aux: null, card: null });
  PNS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  PNS.hits = () => HITS;

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
     곳 일곱(book 예약 전화 · time 시간 맞추기 · name 이름 철자 · ask 문의 전화 · msg 메시지 · number 전화번호 · call 걸려 온 전화) + 질문의 모양 넷 + 그 밖의 그림
     ========================================================= */
  const ICON = {
    book: [['M4 5.5c3-1 5.5-1 8 .8v13c-2.5-1.8-5-1.8-8-.8z', 's'], ['M20 5.5c-3-1-5.5-1-8 .8v13c2.5-1.8 5-1.8 8-.8z', 's']],
    time: [['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', 's'], ['M12 7.5V12l3 2', 's'], ['M17.5 3.5l2.5 2.5', 's']],
    name: [['M3.5 18.5 8 5.5h1l4.5 13', 's'], ['M5 14h7', 's'], ['M15.5 10h5M15.5 14h5M15.5 18h3', 's']],
    ask: [['M4.5 5h15v10h-8l-4 3.8V15h-3z', 's'], ['M10 8.3a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.3', 's'], ['M12 12.9h.01', 's']],
    msg: [['M4 4.5h16v11.5h-9l-4 3.5V16H4z', 's'], ['M8 8.5h8M8 12h5', 's']],
    number: [['M5.5 3.5h13v17h-13z', 's'], ['M8.8 8h.01M12 8h.01M15.2 8h.01M8.8 11.5h.01M12 11.5h.01M15.2 11.5h.01M8.8 15h.01M12 15h.01M15.2 15h.01', 's']],
    call: [['M6.5 6h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 15l4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 8a2 2 0 0 1 2-2z', 's'], ['M14.5 2.5a6.5 6.5 0 0 1 6.5 6.5M14.5 6a3 3 0 0 1 3 3', 's']],
    id: [['M3.5 6h17v12h-17z', 's'], ['M8.5 11.4a1.9 1.9 0 1 0 0-3.8a1.9 1.9 0 0 0 0 3.8zM5.6 15.6a2.9 2.9 0 0 1 5.8 0', 's'], ['M13.5 9.5h4.5M13.5 13h3', 's']],
    shape_yn: [['M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8z', 's'], ['M14.4 12a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0z', 'f']],
    shape_or: [['M12 21.5V14', 's'], ['M12 14 6 8M12 14l6-6', 's'], ['M6 8v4.4M6 8h4.4', 's'], ['M18 8v4.4M18 8h-4.4', 's']],
    shape_wh: [['M3.5 6.5h17v11h-17z', 's'], ['M8 14h8', 's']],
    shape_note: [['M4.5 5h15v10h-8l-4 3.8V15h-3z', 's'], ['M9 10h.01M12 10h.01M15 10h.01', 's']],
    keypad: [['M5.5 3.5h13v17h-13z', 's'], ['M8.8 8h.01M12 8h.01M15.2 8h.01M8.8 11.5h.01M12 11.5h.01M15.2 11.5h.01M8.8 15h.01M12 15h.01M15.2 15h.01', 's']],
    signal: [['M5 18.5v-2M9.5 18.5v-5M14 18.5v-8M18.5 18.5v-12', 's']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z', 's'], ['M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6', 's']],
    hand: [['M8.5 20.5c-2-1.6-3.5-4-3.5-6.5v-2.5a1.3 1.3 0 0 1 2.6 0V13', 's'], ['M7.6 12.5V6a1.3 1.3 0 0 1 2.6 0v5.5M10.2 11V4.5a1.3 1.3 0 0 1 2.6 0V11M12.8 11V5.5a1.3 1.3 0 0 1 2.6 0V12M15.4 12V8a1.3 1.3 0 0 1 2.6 0v6c0 3.5-2 6.5-5.5 6.5h-4', 's']],
    clock: [['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', 's'], ['M12 7.5V12l3 2', 's']],
    people: [['M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM3.5 20a5.5 5.5 0 0 1 11 0', 's'], ['M16 11a2.6 2.6 0 1 0 0-5.2M15.5 14.2a5 5 0 0 1 5 5.3', 's']],
    note: [['M6 3.5h9l3 3v14H6z', 's'], ['M15 3.5v3h3', 's'], ['M9 11h6M9 14h6M9 17h4', 's']],
    cal: [['M4 6h16v14.5H4z', 's'], ['M4 10.5h16', 's'], ['M8.5 4v4M15.5 4v4', 's']],
    phone: [['M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 6a2 2 0 0 1 2-2z', 's']],
    cut: [['M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 6a2 2 0 0 1 2-2z', 's'], ['M15 3.5l2 2.5-2 1.5 2.5 2.5', 's']],
    pool: [['M3 17c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1', 's'], ['M3 20.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1', 's'], ['M8 13.5V5a2 2 0 0 1 4 0M16 13.5V5a2 2 0 0 0-4 0M8 8h8M8 11h8', 's']],
    goggles: [['M2.5 12a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0zM14.3 12a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0z', 's'], ['M9.7 12h4.6', 's']],
    swimcap: [['M4 16.5a8 8 0 0 1 16 0z', 's'], ['M9 10c1-1.2 2-1.7 3.2-1.7', 's']],
    suit: [['M7.5 3.5v4.5c0 2 1.5 3 1.5 5.5L7.5 20.5h9L15 13.5c0-2.5 1.5-3.5 1.5-5.5V3.5', 's'], ['M7.5 8c2.5 1.6 6.5 1.6 9 0', 's']],
  };
  PNS.ICON = ICON;

  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = (typeof Path2D === 'function' ? new Path2D(d) : null));
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const parts = ICON[id]; if (!parts) return;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach(([d, m]) => { const p = path(d); if (!p) return; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  PNS.icon = icon;
  // HTML용 SVG (색은 currentColor)
  PNS.iconSVG = (id, cls = '', fill) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : m === 'b' && fill ? `<path d="${d}" fill="${fill}"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 질문의 모양 표시: 그림 + 이름 (영상 · 직접 해 보기 · 힌트 · 퀴즈) ---------- */
  function shapeMark(g, shape, cx, cy, size, o = {}) {
    const c = o.color || SHC[shape];
    if (o.disc !== false) { circ(g, cx, cy, size * 0.72, o.fill || COL.panel2); ring(g, cx, cy, size * 0.72, c, o.lw || 2); }
    icon(g, 'shape_' + shape, cx, cy, size, c, o.iw || 2);
  }
  PNS.shapeMark = shapeMark;
  function shapeTag(g, shape, x, y, o = {}) {
    const Sx = PN.SHAPE[shape], t = o.text || `${Sx.ko} → ${Sx.ans}`, size = o.size || 16, h = o.h || 36, c = SHC[shape];
    const w = tw(g, t, size, 700) + h + 22, x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    rr(g, x0, y - h / 2, w, h, 10); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = c; g.lineWidth = 1.6; g.stroke();
    icon(g, 'shape_' + shape, x0 + h / 2 + 4, y, h * 0.62, c, 2);
    txt(g, t, x0 + h + 8, y + 1, { size, weight: 700, color: c });
    return { x: x0, y: y - h / 2, w, h };
  }
  PNS.shapeTag = shapeTag;

  /* ---------- 말하는 사람 표시 (말풍선 옆). 전화라 상대의 얼굴은 보이지 않아요 → 수화기 + 목소리 물결
     kind: ben(식당 직원 · 미국) · grace(안내 데스크 · 캐나다) · olivia(수영 사무실 · 영국) · coach(디아스 코치 · 호주) · me ---------- */
  const LOOK = {
    ben: { sp: 'us' }, grace: { sp: 'ca' }, olivia: { sp: 'gb' }, coach: { sp: 'au' },
    me: { shirt: '#5D6FA8', hair: '#1F1B18', skin: '#E8BC95', scarf: '#7FA8C9', long: true },
  };
  PNS.LOOK = LOOK;
  const kindOf = q => { q = typeof q === 'string' ? PN.Q[q] : q; return q.sp === 'gb' ? 'olivia' : q.sp === 'au' ? 'coach' : q.sp === 'ca' ? 'grace' : 'ben'; };
  PNS.kindOf = kindOf;
  function avatar(g, x, y, r, kind, o = {}) {
    const L = LOOK[kind] || LOOK.ben;
    if (kind !== 'me') {
      const c = SPC[o.sp || L.sp] || COL.soft;
      circ(g, x, y, r, '#141C26');
      icon(g, 'phone', x - r * 0.08, y + r * 0.04, r * 1.05, c, 2);
      ring(g, x, y, r, o.live ? c : COL.faint, o.live ? 2.6 : 1.5);
      if (o.live) {   // 목소리 물결
        g.save(); g.strokeStyle = c; g.lineCap = 'round';
        [0.55, 0.85].forEach((k, i) => { g.globalAlpha *= i ? 0.5 : 0.9; g.lineWidth = 2; g.beginPath(); g.arc(x + r * 0.05, y - r * 0.05, r * k, -0.95, -0.15); g.stroke(); });
        g.restore();
        g.save(); g.globalAlpha *= 0.45; ring(g, x, y, r + 5, c, 2); g.restore();
      }
      return;
    }
    circ(g, x, y, r, COL.panel2);
    g.save(); g.beginPath(); g.arc(x, y, r - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = L.shirt; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
    if (L.scarf) { g.fillStyle = L.scarf; rr(g, x - r * 0.3, y + r * 0.36, r * 0.6, r * 0.16, r * 0.06); g.fill(); rr(g, x + r * 0.1, y + r * 0.42, r * 0.14, r * 0.42, r * 0.05); g.fill(); }
    if (L.long) { g.fillStyle = L.hair; rr(g, x - r * 0.41, y - r * 0.34, r * 0.82, r * 0.74, r * 0.3); g.fill(); }
    g.fillStyle = L.skin; g.fillRect(x - r * 0.1, y + r * 0.18, r * 0.2, r * 0.22);
    circ(g, x, y - r * 0.08, r * 0.34, L.skin);
    g.fillStyle = L.hair; g.beginPath(); g.arc(x, y - r * 0.12, r * 0.36, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
    circ(g, x - r * 0.12, y - r * 0.04, r * 0.035, '#2B2420'); circ(g, x + r * 0.12, y - r * 0.04, r * 0.035, '#2B2420');
    g.strokeStyle = 'rgba(120,60,40,0.6)'; g.lineWidth = Math.max(1, r * 0.045); g.beginPath(); g.arc(x, y + r * 0.06, r * 0.1, 0.35, Math.PI - 0.35); g.stroke();
    // 귀에 댄 휴대폰
    g.fillStyle = '#2A3542'; rr(g, x + r * 0.3, y - r * 0.3, r * 0.16, r * 0.42, r * 0.05); g.fill();
    g.restore();
    ring(g, x, y, r, o.live ? (SPC[o.sp] || COL.soft) : COL.faint, o.live ? 2.6 : 1.5);
    if (o.live) { g.save(); g.globalAlpha *= 0.45; ring(g, x, y, r + 5, SPC[o.sp] || COL.soft, 2); g.restore(); }
  }
  PNS.avatar = avatar;



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
  PNS.richLay = richLay; PNS.richDraw = richDraw;

  /* ---------- 낱말 조각 (대답 만들기): { id, t, r } → lay · morph · drawTok ---------- */
  const PUNCT = /^[.,?!]$/;
  function ansToks(a, o = {}) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    PN.segs(a).forEach(s => s.t.split(/\s+/).forEach(w => {
      if (!w) return;
      const m = w.match(/^(.*?)([.,?!]*)$/);
      if (m[1]) push(m[1], o.role != null ? o.role : s.r);
      if (m[2]) m[2].split('').forEach(p => push(p, ''));
    }));
    return out;
  }
  PNS.ansToks = ansToks;
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
      avatar(g, ax, ay, ar, o.kind || (side === 'L' ? 'ben' : 'me'), { live, sp: o.sp });
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
  PNS.talk = talk;
  // 직원의 말 (말 id로): 말풍선 + 열쇠 낱말 (+ 모양 표시)
  const Qobj = q => typeof q === 'string' ? PN.Q[q] : q;
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
    const said = LB && p > 0.5 ? (o.sayB || (o.B ? PN.text(o.B) : null)) : (o.sayA || (o.A ? PN.text(o.A) : null));
    if (!o.noHit && said) listen(bx, by, bw, bh, [{ text: said, sp: 'me' }]);
    return out;
  }
  PNS.answer = answer;
  const okOf = (q, a, c) => PN.judge(q, a, c || PN.DEMO).ok;

  /* ---------- 전화 세 통 길 띠 (02–08장 위쪽): 식당(셋) · 스포츠 센터(셋) · 코치(하나) ---------- */
  function strip(g, cur, a = 1) {
    fade(g, a, () => {
      const xs = [800, 856, 912, 984, 1040, 1096, 1168], y = 92;
      g.strokeStyle = COL.faint; g.lineWidth = 2;
      [[0, 2], [3, 5]].forEach(([i, j]) => { g.beginPath(); g.moveTo(xs[i], y); g.lineTo(xs[j], y); g.stroke(); });
      g.setLineDash([3, 5]); g.beginPath(); g.moveTo(xs[2] + 16, y); g.lineTo(xs[3] - 16, y); g.moveTo(xs[5] + 16, y); g.lineTo(xs[6] - 16, y); g.stroke(); g.setLineDash([]);
      PN.PLACES.forEach((p, i) => {
        const x = xs[i], on = i === cur;
        circ(g, x, y, on ? 19 : 14, on ? COL.accent : i < cur ? '#2A3542' : COL.panel);
        ring(g, x, y, on ? 19 : 14, on ? COL.accent : PN.ME_FIRST[p.id] ? 'rgba(201,167,255,0.6)' : COL.faint, 1.5);
        icon(g, p.id, x, y, on ? 22 : 16, on ? '#1D1305' : i < cur ? COL.soft : COL.muted, on ? 2 : 1.8);
      });
      txt(g, `${cur + 1} / 7`, 1210, y, { size: 13, weight: 500, fam: FM, color: COL.muted });
    });
  }


  /* =========================================================
     전화 그림: 통화 화면 · 예약 장부 · 시각 읽기 · 철자 카드 · 수업 안내판 · 메시지 쪽지 · 메시지 한 줄의 차례 · 번호 읽기 · 준비물 · 내 카드
     식당 · 스포츠 센터 · 사람 이름 · 전화번호(555-01XX) · 시간과 값은 모두 지어낸 예시예요
     ========================================================= */
  // 종이 서류: 머리 띠 + 칸. rows: [[이름, 값, key]] · o: { title, icon, sub, show(key) → 값 보이기, hl, head, rh, vx, ink, mono, bad: { key: 잘못 적힌 값 } }
  function paper(g, x, y, w, rows, o = {}) {
    const rh = o.rh || 36, vx = o.vx || 130, top = 54 + (o.sub ? 30 : 0), h = top + rows.length * rh + 12;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 12); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 12); g.clip(); g.fillStyle = o.head || COL.teal; g.fillRect(x, y, w, 42); g.restore();
    if (o.icon) icon(g, o.icon, x + 22, y + 21, 20, '#FFFFFF');
    txt(g, o.title, x + (o.icon ? 40 : 16), y + 22, { size: fit(g, o.title, 13.5, w - (o.icon ? 56 : 32), 700, 8, FM), weight: 700, fam: FM, color: '#FFFFFF' });
    if (o.sub) txt(g, o.sub, x + 16, y + 64, { size: fit(g, o.sub, 17, w - 32, 800), weight: 800, color: COL.ink });
    const mono = o.mono !== false;
    rows.forEach(([k, v, key], i) => {
      const yy = y + top + i * rh, on = o.hl != null && o.hl === key, shown = !o.show || o.show(key), bad = o.bad && o.bad[key];
      if (on) { rr(g, x + 8, yy + 2, w - 16, rh - 4, 7); g.fillStyle = 'rgba(31,122,85,0.16)'; g.fill(); g.strokeStyle = '#1F7A55'; g.lineWidth = 2.2; g.stroke(); }
      if (bad) { rr(g, x + 8, yy + 2, w - 16, rh - 4, 7); g.fillStyle = 'rgba(184,67,43,0.12)'; g.fill(); g.strokeStyle = COL.red; g.lineWidth = 2.2; g.stroke(); }
      txt(g, k, x + 16, yy + rh / 2, { size: fit(g, k, 11.5, vx - 22, 700, 7.5, FM), weight: 700, fam: FM, color: '#5B6168' });
      g.fillStyle = 'rgba(30,38,48,0.22)'; g.fillRect(x + vx, yy + rh - 8, w - vx - 16, 1.2);
      const val = bad || v;
      if ((shown || bad) && val) txt(g, val, x + vx + 4, yy + rh / 2 - 1, { size: fit(g, val, mono ? 15 : 16, w - vx - 24, 700, 9, mono ? FM : FB), weight: 700, fam: mono ? FM : FB, color: bad ? COL.red : on ? '#14623F' : o.ink || '#1F4FA0' });
    });
    return { h };
  }
  PNS.paper = paper;

  // 통화 화면 (얼굴 없이 목소리만). o: { name, num, sub, sec: 통화 시간(초), live: 말하는 중, sp, incoming, label }
  function phoneScreen(g, x, y, w, o = {}) {
    const h = o.h || 300, c = SPC[o.sp] || COL.ante;
    rr(g, x, y, w, h, 30); g.fillStyle = '#0B1118'; g.fill(); g.strokeStyle = 'rgba(238,241,244,0.22)'; g.lineWidth = 2; g.stroke();
    rr(g, x + w / 2 - 36, y + 12, 72, 8, 4); g.fillStyle = '#1E2833'; g.fill();
    txt(g, o.label || (o.incoming ? 'INCOMING CALL' : 'CALLING'), x + w / 2, y + 44, { size: 11, weight: 700, fam: FM, color: o.incoming ? COL.good : COL.muted, align: 'center' });
    circ(g, x + w / 2, y + 100, 38, '#18222D'); ring(g, x + w / 2, y + 100, 38, o.live ? c : COL.faint, o.live ? 2.6 : 1.5);
    icon(g, 'phone', x + w / 2 - 2, y + 101, 36, c, 2);
    if (o.live) { g.save(); g.strokeStyle = c; g.lineWidth = 2; g.lineCap = 'round'; [48, 58].forEach((r, i) => { g.globalAlpha *= i ? 0.45 : 0.85; g.beginPath(); g.arc(x + w / 2, y + 100, r, -0.8, 0.8); g.stroke(); g.beginPath(); g.arc(x + w / 2, y + 100, r, Math.PI - 0.8, Math.PI + 0.8); g.stroke(); }); g.restore(); }
    const nm = o.name || '';
    txt(g, nm, x + w / 2, y + 166, { size: fit(g, nm, 21, w - 30, 800), weight: 800, color: COL.text, align: 'center' });
    if (o.num) txt(g, o.num, x + w / 2, y + 194, { size: 15, weight: 600, fam: FM, color: COL.soft, align: 'center' });
    if (o.sub) txt(g, o.sub, x + w / 2, y + 220, { size: fit(g, o.sub, 13, w - 30, 600), weight: 600, color: COL.muted, align: 'center' });
    if (o.incoming) {
      [[-1, COL.bad], [1, COL.good]].forEach(([d, col]) => { circ(g, x + w / 2 + d * 58, y + h - 42, 22, col); icon(g, 'phone', x + w / 2 + d * 58, y + h - 42, 22, '#0B1118', 2.2); });
    } else {
      const s = Math.max(0, Math.floor(o.sec || 0)), t = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      txt(g, t, x + w / 2, y + h - 66, { size: 15, weight: 700, fam: FM, color: COL.good, align: 'center' });
      circ(g, x + w / 2, y + h - 30, 18, COL.bad); g.save(); g.translate(x + w / 2, y + h - 30); g.rotate(2.36); icon(g, 'phone', 0, 0, 18, '#0B1118', 2.2); g.restore();
    }
    return { h };
  }
  PNS.phoneScreen = phoneScreen;

  // 예약 장부 (RESERVATIONS). c: 카드 · o: { show(key), hl, bad: { time, name } }
  function resvPad(g, x, y, w, c, o = {}) {
    const n = PN.NAMES[c.sur || 'han'];
    const rows = [['DAY', PN.DAYS[c.day || 'fri'].t.toUpperCase(), 'day'], ['MEAL', PN.MEALS[c.meal || 'dinner'].t.toUpperCase(), 'meal'], ['PARTY OF', String(c.ppl || 4), 'ppl'],
      ['TIME', c.time || PN.offerOf(c), 'time'], ['NAME', `${n.t.toUpperCase()} (${n.spell})`, 'name']];
    return paper(g, x, y, w, rows, { title: `RESERVATIONS · ${PN.BISTRO.toUpperCase()}`, icon: 'book', show: o.show, hl: o.hl, bad: o.bad, rh: 40, vx: 96, head: '#6A3A1F' });
  }
  PNS.resvPad = resvPad;

  // 시각 읽기 (8:15 → eight-fifTEEN). o: { t, trap, p, title }
  function timeRead(g, x, y, w, o = {}) {
    const t = o.t || '8:15', h = o.trap ? 232 : 182, [hh, mm] = t.split(':'), ws = PN.timeWords(t).split('-');
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    const T = o.title || '시각 · 시와 분을 나눠 읽어요';
    txt(g, T, x + 16, y + 22, { size: fit(g, T, 13.5, w - 32, 700), weight: 700, color: COL.muted });
    let xx = x + 16;
    xx += txt(g, hh, xx, y + 70, { size: 40, weight: 800, fam: FM, color: COL.text });
    xx += txt(g, ':', xx + 2, y + 68, { size: 34, weight: 700, fam: FM, color: COL.accent }) + 6;
    txt(g, mm, xx, y + 70, { size: 40, weight: 800, fam: FM, color: COL.text });
    say(x + 10, y + 46, w - 20, 48, PN.timeWords(t));
    fade(g, o.p == null ? 1 : o.p, () => {
      const m = +mm, teen = m >= 13 && m <= 19, stress = teen ? ws[1].replace(/teen$/, 'TEEN') : /ty$/.test(ws[1]) ? ws[1].replace(/^(\w+?)(ty)$/, (z, a, b) => a.toUpperCase() + b) : ws[1];
      const c1 = chip(g, ws[0], x + 16, y + 126, { size: 17, weight: 700, color: COL.clause, fill: COL.panel2, stroke: 'rgba(127,224,168,0.55)', h: 36, r: 10, pad: 12 });
      const c2 = chip(g, stress, c1.x + c1.w + 10, y + 126, { size: fit(g, stress, 17, w - c1.w - 60, 700), weight: 700, color: COL.accent, fill: COL.panel2, stroke: 'rgba(255,193,94,0.55)', h: 36, r: 10, pad: 12 });
      say(c1.x, c1.y, c2.x + c2.w - c1.x, 36, PN.timeWords(t));
    });
    if (o.trap) {
      const tw2 = PN.timeWords(o.trap).split('-'), tr = `× ${o.trap} → ${tw2[0]}-${tw2[1].replace(/^(\w+?)(ty)$/, (z, a, b) => a.toUpperCase() + b).replace(/teen$/, 'TEEN')}`;
      txt(g, tr, x + 16, y + 172, { size: fit(g, tr, 15, w - 32, 700), weight: 700, color: COL.trap });
      const note = o.trapNote || '-teen은 뒤를, -ty는 앞을 세게';
      txt(g, note, x + 16, y + 200, { size: fit(g, note, 12.5, w - 32, 600), weight: 600, color: COL.muted });
    }
    return { h };
  }
  PNS.timeRead = timeRead;

  // 철자 카드: 글자 칸 + 헷갈리는 글자 as in + 짝 표. o: { sur, trap: 잘못 들은 글자 보이기, p, pairs }
  function spellCard(g, x, y, w, o = {}) {
    const n = PN.NAMES[o.sur || 'han'], letters = n.spell.split('-'), h = o.pairs === false ? 196 : 196 + 32 + PN.ALPHA.length * 34;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '철자 · 글자를 하나씩', x + 16, y + 22, { size: 13.5, weight: 700, color: COL.muted });
    const bw = Math.min(54, (w - 32 - (letters.length - 1) * 8) / letters.length);
    letters.forEach((L, i) => {
      const bx = x + 16 + i * (bw + 8), hot = L === n.L, wrong = hot && o.trap;
      rr(g, bx, y + 42, bw, 58, 9); g.fillStyle = wrong ? 'rgba(255,107,107,0.14)' : hot ? 'rgba(255,193,94,0.14)' : COL.panel2; g.fill();
      g.strokeStyle = wrong ? COL.bad : hot ? COL.accent : COL.faint; g.lineWidth = hot ? 2.2 : 1.3; g.stroke();
      txt(g, wrong ? n.alt : L, bx + bw / 2, y + 72, { size: 30, weight: 800, fam: FM, color: wrong ? COL.bad : hot ? COL.accent : COL.text, align: 'center' });
    });
    say(x + 10, y + 40, w - 20, 62, PN.letterWords(n.spell));
    fade(g, o.p == null ? 1 : o.p, () => {
      const t = PN.asIn(n.L), t2 = o.trap ? `× ${PN.asIn(n.alt)} → ${PN.wrongSpell(o.sur || 'han')}` : `${n.L}와 ${n.alt}는 전화에서 헷갈려요`;
      chip(g, t, x + 16, y + 132, { size: 17, weight: 700, color: COL.clause, fill: COL.panel2, stroke: 'rgba(127,224,168,0.55)', h: 36, r: 10, pad: 12 });
      say(x + 12, y + 114, w - 24, 36, t);
      txt(g, t2, x + 16, y + 172, { size: fit(g, t2, 14, w - 32, 700), weight: 700, color: o.trap ? COL.trap : COL.soft });
    });
    if (o.pairs !== false) {
      const y0 = y + 206;
      txt(g, '헷갈리는 글자 · as in + 흔한 이름', x + 16, y0 + 8, { size: 12.5, weight: 700, color: COL.muted });
      PN.ALPHA.forEach(([a, an, b, bn], i) => {
        const yy = y0 + 40 + i * 34;
        [[a, an, x + 16], [b, bn, x + w / 2 + 4]].forEach(([L, nm, xx]) => {
          const on = L === n.L;
          txt(g, L, xx, yy, { size: 18, weight: 800, fam: FM, color: on ? COL.accent : COL.text });
          txt(g, `as in ${nm}`, xx + 22, yy, { size: fit(g, `as in ${nm}`, 14.5, w / 2 - 44, 600), weight: 600, color: on ? COL.accent : COL.soft });
          say(xx - 4, yy - 15, w / 2 - 20, 30, `${L} as in ${nm}`);
        });
      });
    }
    return { h };
  }
  PNS.spellCard = spellCard;

  // 수영 강습 안내판 (지어낸 센터 · 요일 · 값). o: { hl: 반, trap: '~p' | '~d', p }
  function classCard(g, x, y, w, o = {}) {
    const ids = PN.LVL_IDS, rh = 92, h = 64 + ids.length * rh + 30;
    rr(g, x, y, w, h, 14); g.fillStyle = '#0E1620'; g.fill(); g.strokeStyle = 'rgba(127,224,168,0.4)'; g.lineWidth = 1.5; g.stroke();
    txt(g, 'SWIMMING LESSONS', x + 16, y + 22, { size: 12, weight: 700, fam: FM, color: COL.clause });
    icon(g, 'pool', x + w - 24, y + 22, 20, COL.clause);
    txt(g, PN.CENTER.toUpperCase(), x + 16, y + 44, { size: fit(g, PN.CENTER.toUpperCase(), 10.5, w - 32, 700, 7, FM), weight: 700, fam: FM, color: COL.muted });
    ids.forEach((id, i) => {
      const L = PN.LEVELS[id], yy = y + 60 + i * rh, on = o.hl === id;
      fade(g, o.p == null ? 1 : ramp(o.p, i * 0.3, 0.4), () => {
        if (on) { rr(g, x + 8, yy, w - 16, rh - 8, 9); g.fillStyle = 'rgba(127,224,168,0.10)'; g.fill(); g.strokeStyle = COL.clause; g.lineWidth = 2; g.stroke(); }
        txt(g, L.t.toUpperCase(), x + 18, yy + 20, { size: 15, weight: 800, fam: FM, color: on ? COL.clause : COL.text });
        txt(g, `${L.ko} 반`, x + w - 18, yy + 20, { size: 12.5, weight: 700, color: COL.muted, align: 'right' });
        const days = L.days.replace(/days/g, '').replace(' and ', ' · ').toUpperCase().replace(/(\w{3})\w*/g, '$1'), dl = `${days}  ${L.from}–${L.to} PM`;
        txt(g, dl, x + 18, yy + 46, { size: fit(g, dl, 14, w - 120, 700, 9, FM), weight: 700, fam: FM, color: COL.soft });
        txt(g, `$${L.price}/mo`, x + w - 18, yy + 46, { size: 16, weight: 800, fam: FM, color: on ? COL.accent : COL.soft, align: 'right' });
        say(x + 10, yy, w - 20, rh - 8, PN.infoLine(id));
        if (on && o.trap) {
          const P = PN.infoParse(id + o.trap), t = o.trap === '~p' ? `× $${P.price} (${PN.numWord(P.price)}) ↔ $${L.price} (${PN.numWord(L.price)})` : `× ${P.days}`;
          txt(g, t, x + 18, yy + 70, { size: fit(g, t, 13, w - 36, 700), weight: 700, color: COL.trap });
        }
      });
    });
    txt(g, 'FOR EXAMPLE ONLY', x + 16, y + h - 16, { size: 10, weight: 700, fam: FM, color: COL.dim });
    return { h };
  }
  PNS.classCard = classCard;

  // 받아 적은 메시지 쪽지 (WHILE YOU WERE OUT). words: 메시지 한 줄의 조각 · o: { name, p, hl }
  function msgPad(g, x, y, w, words, o = {}) {
    const W = (words || []).map(id => PN.OW[id]).filter(Boolean), has = c => W.find(z => z.c === c);
    const who = has('who'), ab = has('about'), ask = has('ask'), num = has('num');
    const rows = [['TO', PN.COACH.toUpperCase(), 'to'], ['FROM', who ? (who.bad ? '?' : (o.name || 'Jiwoo Han').toUpperCase()) : '?', 'who'],
      ['RE', ab ? `${PN.LEVELS[ab.v].t.toUpperCase()} SWIM CLASS` : '?', 'about'], ['CALL BACK', ask ? (ask.bad ? '✓ (TOLD TO)' : '✓ PLEASE') : '?', 'ask'], ['NUMBER', num ? PN.phoneText(num.v) : '?', 'num']];
    return paper(g, x, y, w, rows, { title: 'WHILE YOU WERE OUT · SWIM OFFICE', icon: 'msg', hl: o.hl, rh: 40, vx: 104, head: '#26324A', show: k => o.p == null || k === 'to' || o.p >= ({ who: 0.25, about: 0.5, ask: 0.75, num: 1 })[k],
      bad: Object.fromEntries(rows.filter(r => r[1] === '?' && r[2] !== 'to' && (o.p == null || o.p >= 1)).map(r => [r[2], '?'])) });
  }
  PNS.msgPad = msgPad;

  // 메시지 한 줄의 차례: 누구 → 무슨 일 → 부탁 → 번호. o: { words, p: 0~1 (차례로 나타남), hl: 칸 번호, bad: { 칸: 글 } }
  function lineOrder(g, x, y, w, o = {}) {
    const words = o.words || PN.LINE.words, W = words.map(id => PN.OW[id]).filter(Boolean), h = 4 * 64 + 50;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '메시지 한 줄의 차례', x + 16, y + 22, { size: 13.5, weight: 700, color: COL.muted });
    const cats = ['who', 'about', 'ask', 'num'], cc = { who: COL.verb, about: COL.clause, ask: COL.verb, num: COL.clause };
    cats.forEach((c, i) => fade(g, o.p == null ? 1 : ramp(o.p, i * 0.22, 0.25), () => {
      const yy = y + 50 + i * 64, ww = W.find(z => z.c === c), on = o.hl === i, bad = o.bad && o.bad[c];
      rr(g, x + 12, yy, w - 24, 54, 9); g.fillStyle = on ? 'rgba(255,193,94,0.12)' : 'rgba(238,241,244,0.05)'; g.fill(); g.strokeStyle = bad ? COL.trap : on ? COL.accent : COL.faint; g.lineWidth = on || bad ? 2 : 1.3; g.stroke();
      txt(g, `${i + 1}. ${PN.OCAT[c].ko}`, x + 24, yy + 16, { size: 12, weight: 700, color: bad ? COL.trap : cc[c] });
      let t = bad || (ww ? ww.t : '');
      if (!bad && ww) { if (c === 'who') t = `This is ${o.name || 'Jiwoo Han'}.`; else if (c === 'ask') t = ww.t[0].toUpperCase() + ww.t.slice(1) + ' …'; else if (c === 'num') t = `… ${ww.t}?`; }
      txt(g, t, x + 24, yy + 38, { size: fit(g, t, 15.5, w - 50, 700), weight: 700, color: bad ? COL.trap : COL.en });
      if (t && !bad) say(x + 14, yy, w - 28, 54, t.replace(/…/g, ''));
      if (i < 3) arrow(g, x + w - 30, yy + 54, x + w - 30, yy + 64, COL.muted, 1.6);
    }));
    return { h };
  }
  PNS.lineOrder = lineOrder;

  // 전화번호 읽기: 555 | 0139 → five-five-five, oh-one-three-nine. o: { ph, trap, p, title }
  function phoneRead(g, x, y, w, o = {}) {
    const ph = o.ph || '0139', h = o.trap ? 240 : 190, words = PN.phoneWords(PN.phoneText(ph)), [a, b] = words.split(', ');
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    const T = o.title || '전화번호 · 숫자를 하나씩, 0은 oh';
    txt(g, T, x + 16, y + 22, { size: fit(g, T, 13.5, w - 32, 700), weight: 700, color: COL.muted });
    let xx = x + 16;
    xx += txt(g, '555', xx, y + 68, { size: 34, weight: 800, fam: FM, color: COL.text });
    xx += txt(g, '-', xx + 4, y + 68, { size: 30, weight: 500, fam: FM, color: COL.accent }) + 8;
    ph.split('').forEach((d, i) => { xx += txt(g, d, xx, y + 68, { size: 34, weight: 800, fam: FM, color: d === '0' ? COL.accent : COL.text }); });
    say(x + 10, y + 44, w - 20, 48, words);
    fade(g, o.p == null ? 1 : o.p, () => {
      const c1 = chip(g, a, x + 16, y + 122, { size: fit(g, a, 15, 120, 700), weight: 700, color: COL.clause, fill: COL.panel2, stroke: 'rgba(127,224,168,0.55)', h: 34, r: 10, pad: 10 });
      const c2 = chip(g, b, c1.x + c1.w + 8, y + 122, { size: fit(g, b, 15, w - c1.w - 56, 700), weight: 700, color: COL.clause, fill: COL.panel2, stroke: 'rgba(127,224,168,0.55)', h: 34, r: 10, pad: 10 });
      say(c1.x, c1.y, c2.x + c2.w - c1.x, 34, words);
      txt(g, '세 자리 · 네 자리 사이에서 쉬어요', x + 16, y + 160, { size: 12.5, weight: 600, color: COL.muted });
    });
    if (o.trap) {
      const t = `× ${PN.phoneText(o.trap)} → 끝 두 자리가 바뀌었어요`;
      txt(g, t, x + 16, y + 204, { size: fit(g, t, 14.5, w - 32, 700), weight: 700, color: COL.trap });
    }
    return { h };
  }
  PNS.phoneRead = phoneRead;

  // 준비물 + 첫 수업 요일. o: { b: 'gog.tue', trap: 잘못 들은 요일, p }
  function bringCard(g, x, y, w, o = {}) {
    const B = PN.bringParse(o.b || 'gog.tue'), h = 250, items = B.item === 'gog' ? [['suit', 'swimsuit'], ['goggles', 'goggles']] : [['suit', 'swimsuit'], ['swimcap', 'swim cap']];
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '준비물 · 첫 수업 요일', x + 16, y + 22, { size: 13.5, weight: 700, color: COL.muted });
    items.forEach(([ic, t], k) => fade(g, o.p == null ? 1 : ramp(o.p, k * 0.3, 0.4), () => {
      const cx = x + 16 + k * ((w - 32) / 2), cw = (w - 32) / 2 - 8;
      rr(g, cx, y + 40, cw, 86, 10); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1.3; g.stroke();
      icon(g, ic, cx + cw / 2, y + 70, 34, COL.ante, 1.8);
      txt(g, t, cx + cw / 2, y + 108, { size: 15, weight: 700, color: COL.en, align: 'center' });
      say(cx, y + 40, cw, 86, t);
    }));
    const days = ['mon', 'tue', 'wed', 'thu'], dw = (w - 32) / 4;
    days.forEach((d, i) => {
      const cx = x + 16 + dw * i + dw / 2, hit = d === B.day && (o.p == null || o.p > 0.6), wrong = o.trap === d;
      rr(g, cx - dw / 2 + 3, y + 142, dw - 6, 44, 8); g.fillStyle = hit ? 'rgba(127,224,168,0.2)' : wrong ? 'rgba(255,159,122,0.18)' : 'rgba(238,241,244,0.05)'; g.fill();
      g.strokeStyle = hit ? COL.good : wrong ? COL.trap : COL.faint; g.lineWidth = hit || wrong ? 2.2 : 1.3; g.stroke();
      txt(g, PN.WDAYS[d].t.slice(0, 3).toUpperCase(), cx, y + 164, { size: 13, weight: 800, fam: FM, color: hit ? COL.good : wrong ? COL.trap : COL.muted, align: 'center' });
    });
    const t = o.trap ? `× ${PN.WDAYS[o.trap].t} → 같은 반의 다른 요일` : `first class → ${PN.WDAYS[B.day].t}`;
    txt(g, t, x + 16, y + 216, { size: fit(g, t, 14.5, w - 32, 700), weight: 700, color: o.trap ? COL.trap : COL.soft });
    say(x + 10, y + 200, w - 20, 34, PN.WDAYS[B.day].t);
    return { h };
  }
  PNS.bringCard = bringCard;

  // 내 카드 (시뮬레이터와 같은 칸). o: { skip, hl, rh, vs, rows, title }
  function myCard(g, x, y, w, card, o = {}) {
    const all = o.rows || PN.cardRows(card), rows = all.map((r, i) => [r, i]).filter(([, i]) => !o.skip || !o.skip.includes(i)), rh = o.rh || 34, vs = o.vs || 14.5, vx = o.vx || 100;
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
  PNS.myCard = myCard;

  // 첫 낱말 → 짧은 대답 (PN.AUX). o: { hl: 'is' | 'was' | 'do', at, u }
  function auxTable(g, x, y, w, o = {}) {
    const ks = Object.keys(PN.AUX), rh = 40, h = 46 + ks.length * rh;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '첫 낱말 → 짧은 대답의 짝', x + 16, y + 22, { size: 14, weight: 700, color: COL.muted });
    ks.forEach((k, i) => fade(g, o.u == null ? 1 : ramp(o.u, (o.at || 0) + i * 0.25, 0.3), () => {
      const A = PN.AUX[k], yy = y + 46 + i * rh + rh / 2 - 4, on = o.hl === k, a = A.a.split(' · ')[o.no ? 1 : 0];
      if (on) { rr(g, x + 6, yy - rh / 2 + 3, w - 12, rh - 6, 8); g.fillStyle = 'rgba(110,200,255,0.12)'; g.fill(); g.strokeStyle = COL.ante; g.lineWidth = 1.8; g.stroke(); }
      txt(g, A.q.split(' · ')[0], x + 16, yy, { size: fit(g, A.q.split(' · ')[0], 15, w * 0.5, 700), weight: 700, color: COL.ante });
      txt(g, a, x + w - 14, yy, { size: fit(g, a, 15, w * 0.46, 700), weight: 700, color: COL.rel, align: 'right' });
      say(x + 6, yy - rh / 2 + 3, w - 12, rh - 6, a);
    }));
    return { h };
  }
  PNS.auxTable = auxTable;
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
  PNS.notePanel = notePanel;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호는 자막에 쓰지 않음
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '전화 영어 · 얼굴 없이 듣고, 철자와 숫자는 되짚기', d: 26, caps: [
      [0.4, 5.4, '전화에서는 얼굴도 몸짓도 보이지 않아요. 듣기만으로 주고받으니, 이름 철자와 숫자는 꼭 되짚어요.'],
      [5.4, 11.8, "식당에 전화해서 예약하다를 그대로 → Hi, I want to reserve Friday. 용건은 부탁 틀로 → Hi, I'd like to make a reservation for Friday, please."],
      [11.8, 16.4, "직원이 철자를 잘못 되짚었어요 → Was that M as in Mary? Yes, that's right.로 넘기면 이름이 잘못 적혀요 → No, N as in Nancy."],
      [16.4, 21, '빈 시각을 들으면 Okay. Thanks.로 끝내지 말고 되짚어요 → So, 8:15?'],
      [21, 26, '세 단계로 말해요. 열쇠 낱말과 모양을 잡고, 틀에 내 정보를 넣고, 공손하게 끝내요.'],
    ] },
    { id: 'map', n: '01', title: '전화 세 통', sub: '식당 예약 · 스포츠 센터 문의 · 코치의 전화', d: 30, caps: [
      [0.4, 6, '오늘의 이야기를 일곱 곳으로 나눠 봐요. 첫 번째 전화는 식당 예약이에요. 용건을 말하고, 시간을 맞추고, 이름 철자를 불러요.'],
      [6, 12, '두 번째 전화는 스포츠 센터예요. 수영 강습을 묻고, 코치가 없으면 메시지를 남기고, 내 번호를 불러 줘요.'],
      [12, 18, '세 번째 전화는 코치가 다시 걸어 와요. 전화를 받고, 끊긴 말은 다시 묻고, 준비물과 요일을 되짚어요.'],
      [18, 24, '보라 테두리 → 내가 먼저 말을 꺼내는 곳이에요. 전화를 건 사람이 첫마디에 용건을 말해요.'],
      [24, 30, '식당, 스포츠 센터, 사람 이름, 시간과 값은 모두 지어낸 예시예요. 전화번호도 영화에서 쓰는 지어낸 번호예요.'],
    ] },
    { id: 'book', n: '02', title: '예약 전화 · make a reservation', sub: "I'd like to make a reservation for … · lunch or dinner · For four, please.", d: 38, place: 0, caps: [
      [0.4, 6, 'Lantern Bistro, this is Ben. How can I help you? → 예약하다를 그대로 → Hi, I want to reserve Friday. reserve 뒤에는 잡을 것이 와요.'],
      [6, 11.5, "I'm calling about Friday.는 무엇을 하고 싶은지 빠졌고, Give me a table …은 명령이에요 → Hi, I'd like to make a reservation for Friday, please."],
      [11.5, 17, 'Is that for lunch or dinner? → Yes, please.는 고른 것이 없어요. 고른 것 + please → Dinner, please.'],
      [17, 22.5, 'lunch or는 lun-chor처럼 이어져 들려요. 고를 것은 세게 말해요 → LUNCH · DINner.'],
      [22.5, 28, '몇 분이냐고 물으면, 우리는 네 명이에요를 그대로 → We are four. 사람 수는 → For four, please.'],
      [28, 33, "빠른 첫마디 → Lantern Bistro, Ben speakin'. How c'n I help? 가게 이름을 놓쳤는데 짐작해서 용건부터 말하면, 엉뚱한 곳에 예약할 수도 있어요."],
      [33, 38, '들린 만큼 되물어요 → Sorry, is this Lantern Bistro? 맞는 곳에 걸었는지부터 확인해요.'],
    ] },
    { id: 'time', n: '03', title: '시간 맞추기 · 되짚기', sub: 'What time … · fully booked · Do you have anything later? · So, 8:15?', d: 36, place: 1, caps: [
      [0.4, 5.5, 'What time would you like? → Yes.는 정보가 없어요. 바라는 시각 → At 7, please.'],
      [5.5, 11.5, "I'm sorry, we're fully booked at 7. → Yes.도, Oh, okay.도 예약을 못 하고 전화가 끝나요."],
      [11.5, 17, '가능한 시간을 그대로 → Then what time is possible? 자리가 있는지는 → Oh, I see. Do you have anything later?'],
      [17, 23, 'We have a table at 8:15. → Okay. Thanks.로 넘기면 시각을 확인하지 못해요. eight-fifty로 잘못 들으면 8시 50분이에요.'],
      [23, 29, '되짚어 확인해요 → So, 8:15? fifteen은 뒤를, fifty는 앞을 세게 말해요.'],
      [29, 36, "빠른 말 → 'Kay, got a table at eight-fifteen. 짐작하지 말고 놓친 것만 물어요 → Sorry, what time was that?"],
    ] },
    { id: 'name', n: '04', title: '이름 철자 부르기', sub: "It's Han. · H-A-N, N as in Nancy · Was that M as in Mary? → No, N as in Nancy.", d: 34, place: 2, caps: [
      [0.4, 6, "What name is the reservation under? → 이름은 한이에요를 그대로 → Name is Han. 이름 하나만 짧게 → It's Han."],
      [6, 11.5, "Could you spell that for me? → Yes, please.는 철자가 아니고, It's Han.은 이름을 한 번 더 말했을 뿐이에요."],
      [11.5, 17.5, "H-A-N만 불러도 통하지만, N과 M은 전화에서 헷갈려요. 헷갈리는 글자에는 as in + 흔한 이름 → Sure. It's H-A-N, N as in Nancy."],
      [17.5, 23, 'M과 N, B와 P, F와 S는 전화에서 특히 헷갈려요. 흔한 이름을 붙여 불러요 → M as in Mary · N as in Nancy.'],
      [23, 28.5, "Was that M as in Mary? → 틀렸는데 Yes, that's right.로 넘기면 H-A-M으로 적혀요. Was로 물었으니 No, it isn't.는 짝이 어긋나요."],
      [28.5, 34, 'No.만 하면 맞는 글자를 몰라요. 바로잡아요 → No, N as in Nancy.'],
    ] },
    { id: 'ask', n: '05', title: '문의 전화 · 수업 안내 되짚기', sub: "I'm calling to ask about … · beginner or intermediate · So, … $40 a month?", d: 38, place: 3, caps: [
      [0.4, 6, '스포츠 센터 → Kellport Sports Center, Grace speaking. 문의하다를 그대로 → I want to inquiry swimming lessons. inquiry는 이름씨예요.'],
      [6, 11.5, "Hi, I have a question.은 무엇을 묻는지 없고, Tell me about …은 명령이에요 → Hi, I'm calling to ask about your swimming lessons."],
      [11.5, 17, 'Is that for the beginner class or the intermediate class? → Yes, please.는 고른 것이 없어요. 모르는 낱말은 물어요 → Sorry, what does intermediate mean?'],
      [17, 22, 'intermediate는 중급이에요. 처음 배우면 → The beginner class, please. 고를 것은 세게 → beGINner · interMEdiate.'],
      [22, 28, "The beginner class is on Tuesdays and Thursdays from 6 to 7, and it's $40 a month. → Okay. Thanks.로 넘기면 요일과 값을 확인하지 못해요."],
      [28, 33.5, '$14로, 월요일과 수요일로 잘못 들으면 다른 수업이에요. 되짚어요 → So, Tuesdays and Thursdays from 6 to 7, $40 a month?'],
      [33.5, 38, "빠른 말 → Beginners're Tuesdays 'n Thursdays, six to seven, forty a month. 놓쳤으면 → Sorry, when is the class, and how much is it?"],
    ] },
    { id: 'msg', n: '06', title: '메시지 남기기 한 줄', sub: "leave a message · This is … · I'm calling about … · Could you ask him to call me back at …?", d: 44, place: 4, caps: [
      [0.4, 6.5, '코치가 자리에 없대요 → Would you like to leave a message? 남길게요를 그대로 → Yes. Please leave a message. 상대에게 남기라는 말이 돼요.'],
      [6.5, 10.5, '내가 남길 때는 → Yes, please. 그러면 상대가 → Of course. Go ahead.'],
      [10.5, 18, "누구, 무슨 일, 부탁, 번호 차례로 한 줄 → This is Jiwoo Han. I'm calling about the beginner swimming class. Could you ask him to call me back at 555-0139?"],
      [18, 22.5, '여기는 지우예요를 그대로 → Here is Jiwoo Han. Here is는 물건을 건넬 때 써요. 전화에서 나를 밝힐 때는 → This is …'],
      [22.5, 26.5, 'Tell him to call me back …은 명령처럼 들려요. 전해 달라는 부탁도 질문으로 → Could you ask him to call me back?'],
      [26.5, 31.5, "누구인지 빠지면 → And may I ask who's calling? 무슨 일인지 빠지면 → And what is it regarding? 받아 적는 사람이 다시 물어요."],
      [31.5, 37, '번호를 부탁보다 먼저 툭 말하면 차례가 뒤섞여요. 번호는 부탁 바로 뒤 → … call me back at 555-0139?'],
      [37, 44, "빠른 말 → He's out, I'm 'fraid. D'you wanna leave a message? 놓쳤으면 → Sorry, did you ask if I'd like to leave a message?"],
    ] },
    { id: 'number', n: '07', title: '전화번호 불러 주기', sub: "What's the best number …? · It's 555-0139. · oh · Is that right? → No, it isn't.", d: 36, place: 5, caps: [
      [0.4, 6, "번호를 빼고 남기면 → What's the best number to reach you? 핸드폰을 그대로 → My handphone number is … 핸드폰은 한국에서 만든 말이에요."],
      [6, 11, "휴대폰은 cell phone, 영국에서는 mobile이에요. Yes.만 하면 번호가 없어요. 번호만 짧게 → It's 555-0139."],
      [11, 17, '번호는 숫자를 하나씩, 0은 oh로 읽고, 세 자리와 네 자리 사이에서 쉬어요. 끝 두 자리를 바꾸면 다른 번호예요.'],
      [17, 22.5, "빠른 말 → What's th' best number t' reach ya? 놓쳤으면 → Sorry, did you ask for my phone number?"],
      [22.5, 29, "Let me read that back. 555-0193. Is that right? → 틀렸는데 Yes, that's right.로 넘기면 코치가 다른 번호로 전화해요."],
      [29, 36, "Is로 물었으니 No, it wasn't.는 짝이 어긋나요. No.만 하면 맞는 번호를 몰라요 → No, it isn't. It's 555-0139."],
    ] },
    { id: 'call', n: '08', title: '걸려 온 전화 받기', sub: "Is this Jiwoo? → Yes, speaking. · you're breaking up · So, … on Tuesday? · Thanks for calling back.", d: 38, place: 6, caps: [
      [0.4, 6, '코치가 다시 걸어 왔어요 → Hi, this is Matt Diaz from Kellport Sports Center. Is this Jiwoo? → Who are you?는 퉁명스럽게 들려요.'],
      [6, 11.5, 'No.는 찾는 사람이 아니라는 뜻이에요. 나를 찾는 전화면 → Yes, speaking. Is로 물었으니 Yes, it is.도 좋아요.'],
      [11.5, 17, "소리가 끊겨요 → Great! So for the … you'll need … 짐작해서 되짚지 말고 → Sorry, you're breaking up. Could you say that again?"],
      [17, 23, "You'll need to bring a swimsuit and goggles on Tuesday. → Okay. Thanks.로 넘기면 준비물과 요일을 확인하지 못해요."],
      [23, 29, '목요일로 잘못 들으면 첫 수업을 놓쳐요. 되짚어요 → So, a swimsuit and goggles on Tuesday?'],
      [29, 33.5, 'Is there anything else I can help you with? → Yes.만 하면 물어볼 것을 기다려요. Okay. Bye.는 퉁명스럽게 끝나요.'],
      [33.5, 38, "더 물어볼 것이 없으면 → No, that's all. Thanks for calling back. Bye!"],
    ] },
    { id: 'method', n: '09', title: '3단계 말하기 법', sub: '일곱 곳에 한 줄씩 · 질문의 모양과 함께', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 말하기 법**으로 묶어요.'],
      [5.5, 11.5, '① **열쇠 낱말과 질문의 모양 잡기** → or → 고르기, What · How → 정보, Is this · Was that → 첫 낱말로 짧은 대답.'],
      [11.5, 17.5, '② **틀에 내 정보 넣기** → 철자에는 as in, 번호는 하나씩. 들은 시각과 요일은 되짚어요 → So, 8:15?'],
      [17.5, 23, '③ **공손하게 끝내기** → 부탁은 질문으로 → Could you ask him to call me back? 끝인사에는 Thanks를 붙여요.'],
      [23, 28, '일곱 곳에 한 줄씩 적용했어요. 얼굴이 보이지 않는 전화에서는 되짚기가 가장 큰 힘이에요.'],
    ] },
    { id: 'practice', n: '10', title: '실전 전화', sub: '내 카드 하나로 네 번', d: 50, caps: [
      [0.4, 4.5, '실전이에요. 내 카드 → 토요일 점심, 두 명이에요. 첫 질문 → Is that for lunch or dinner?'],
      [4.5, 8.5, '① 고르는 질문 → (A) Yes, please. 고른 것이 없어 탈락. ② (B) dinner → 카드와 달라 탈락.'],
      [8.5, 12.5, '정답 (C) → Lunch, please.'],
      [12.9, 17, '12시가 다 차서 더 이른 시간을 물었어요 → We have a table at 11:30. 빈 시각을 알려 주는 안내예요.'],
      [17, 21, '① (A) Yes. → 묻는 말이 아니라 탈락. ② (B) 11:13 → 들은 시각과 달라 탈락.'],
      [21, 25, '정답 (C) → So, 11:30? eleven-THIRty와 eleven-thirTEEN이에요.'],
      [25.4, 29.5, '코치가 없어요 → Of course. Go ahead. 카드 → 중급 반, 내 번호는 555-0147이에요.'],
      [29.5, 33.5, '② (B) beginner → 카드(중급 반)와 달라 탈락. ③ (A) Tell him … → 명령처럼 들려 탈락.'],
      [33.5, 37.5, "정답 (C) → This is Minji Park. I'm calling about the intermediate swimming class. Could you ask him to call me back at 555-0147?"],
      [37.9, 42, '사무실이 번호를 되짚어요 → Let me read that back. 555-0147. Is that right?'],
      [42, 46, '① (A) 다시 묻기 → 알아들었는데 다시 물어 탈락. ② (B) No → 맞게 되짚었는데 아니라고 해서 탈락.'],
      [46, 50, "정답 (C) → Yes, that's right."],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '곳 · 열쇠 낱말과 모양 · 대답 틀', d: 22, caps: [
      [0.4, 6, "정리해요. 전화 첫마디에 용건을 → Hi, I'd like to make a reservation for Friday, please. 나를 밝힐 때는 → This is Jiwoo Han."],
      [6, 12, '철자는 as in, 번호는 하나씩 → H-A-N, N as in Nancy. 555-0139는 oh-one-three-nine으로 읽어요.'],
      [12, 17, '들은 시각, 요일, 값은 되짚어요 → So, 8:15? 잘못 되짚으면 바로잡아요 → No, N as in Nancy.'],
      [17, 22, '아래 **전화 시뮬레이터**에서 내 카드로 식당 예약부터 코치의 전화까지 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  PNS.CHAPTERS = CHAPTERS; PNS.CAPTIONS = CAPTIONS; PNS.END = END;
  PNS.POSTER = CHAPTERS.find(c => c.id === 'msg').t + 15.2;
  PNS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  PNS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 실전 장면의 시각 (구간 시작 · 보기 · ① · ② · ③ · 정답)
  const PSEG = [0, 12.5, 25, 37.5];
  const PT = { q: 0.4, opt: [1.6, 2.2, 2.8], s1: 5.0, s2: 7.0, s3: 9.0, win: 10.0, lines: [0.4, 4.5, 8.5] };
  PNS.PSEG = PSEG;

  /* ---------- 장면 그리기 ---------- */
  const LX = 80, RX = 900, RW = 300;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 690, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 690, 800, 24, FD), weight: 800, fam: FD });
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
  const ansParts = a => PN.segs(a).map(s => [s.t, s.r]);
  // 메시지 한 줄을 짧게 (표 · 목록용): This is Jiwoo Han. … Could you ask him to call me back at 555-0139?
  const shortParts = a => {
    if (a.f !== 'line') return ansParts(a);
    const s = PN.segs(a), who = s.filter(x => x.part === 'who'), ask = s.find(x => x.part === 'ask'), num = s.find(x => x.part === 'num');
    if (!who.length || !ask) return ansParts(a);
    return who.map(x => [x.t, x.r]).concat([['. … ', 'frame'], [ask.t[0].toUpperCase() + ask.t.slice(1), ask.r]]).concat(num ? [[' ', 'frame'], [num.t, num.r], ['?', 'frame']] : [['?', 'frame']]);
  };
  const shortText = a => shortParts(a).map(p => p[0]).join('');
  PNS.shortText = shortText;
  // 여러 줄로 감싸는 대답 (보기 · 메시지 한 줄)
  function wrapAns(g, a, x, y, size, maxW, o = {}) {
    const text = PN.text(a), marks = o.plain ? [] : PN.segs(a).filter(s => s.r && s.r !== 'frame' && s.t.trim()).map(s => [s.t.trim(), o.dim ? 'dim' : s.r]);
    const R = richLay(g, text, marks, size, maxW, { weight: 600 });
    richDraw(g, R, x, y - (R.rows - 1) * R.lh / 2, { color: o.dim ? COL.dim : o.color || COL.text });
    return R;
  }
  const why2 = j => `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
  function whyLine(g, j, y, w = 1100, x) { const R = richLay(g, why2(j), [], 16, w, { weight: 600 }); richDraw(g, R, x != null ? x : W / 2 - R.w / 2, y, { color: j.ok ? COL.good : COL.trap }); return R; }
  const ME_FIRST = PN.ME_FIRST;
  const D = PN.DEMO;
  const okOn = (q, a, c) => PN.judge(Qobj(q), a, c || D).ok;
  const OT = PN.o;
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
      fade(g, ramp(u, s, 0.3) * (1 - ramp(u, e - 0.3, 0.3)), () => answer(g, { x: LX, y, w: 780, A: a, at: s + 0.2, u, size: o.size || 23, maxW: 640, trapAt: s + 0.6, strikeAt: s + 0.7, tag: tg ? [tg, COL.trap, s + 0.8] : null, tagY: y + (a.f === 'line' || PN.text(a).length > 46 ? 108 : 78) }));
    });
  }
  // 상대의 짧은 말 (말 id 없이)
  const say2 = (g, text, y, at, u, kind, sp, marks) => talk(g, { side: 'L', x: LX, y, w: 780, text, marks: marks || [], kind, sp, at, u, size: 22 });
  // 헷갈리는 숫자 짝 (fifTEEN · FIFty)
  function pairsFig(g, x, y, w, u, at) {
    const rh = 58, h = 52 + PN.PAIRS.length * rh + 40;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '헷갈리는 숫자 · 세게 읽는 곳', x + 16, y + 22, { size: 13.5, weight: 700, color: COL.muted });
    PN.PAIRS.forEach(([a, as, b, bs], i) => fade(g, ramp(u, at + i * 0.3, 0.35), () => {
      const yy = y + 60 + i * rh;
      [[a, as, x + 16], [b, bs, x + w / 2 + 6]].forEach(([n, s, xx]) => {
        txt(g, n, xx, yy, { size: 19, weight: 800, fam: FM, color: COL.text });
        const parts = s.replace(/^eight-/, '').match(/[A-Z]{2,}|[a-z]+/g);
        let px = xx + tw(g, n, 19, 800, FM) + 8; parts.forEach(pp => { const big = /^[A-Z]{2,}$/.test(pp); px += txt(g, pp.toLowerCase(), px, yy, { size: big ? 18 : 14, weight: big ? 800 : 500, color: big ? COL.accent : COL.soft }); });
        say(xx - 4, yy - 20, w / 2 - 20, 40, PN.spoken(n));
      });
    }));
    fade(g, ramp(u, at + 1.2, 0.4), () => txt(g, 'So, 8:15? → eight-fifteen', x + w / 2, y + h - 22, { size: fit(g, 'So, 8:15? → eight-fifteen', 16, w - 24, 700), weight: 700, color: COL.clause, align: 'center' }));
    say(x + 20, y + h - 40, w - 40, 36, 'So, eight-fifteen?');
    return { h };
  }
  // 직접 해 보기에서 고른 대답 하나 보이기 (상대의 말 + 대답 + 까닭)
  function pickView(g, q, a, C, y = 160) {
    const r = exch(g, 99, { q, at: -9, ok: a, card: C, y, qo: { all: true } });
    const R = whyLine(g, PN.judge(Qobj(q), a, C), r.y + 30, 780, LX);
    return r.y + 30 + R.h;
  }
  // 전화번호 숫자 칸 + 소리 (07장)
  function digitRow(g, x, y, ph, u, at) {
    const ds = ('555' + ph).split(''), bw = 58, gap = 8, sep = 30;
    ds.forEach((d, i) => fade(g, ramp(u, at + i * 0.18, 0.3), () => {
      const bx = x + i * (bw + gap) + (i >= 3 ? sep : 0), oh = d === '0';
      rr(g, bx, y, bw, 64, 10); g.fillStyle = oh ? 'rgba(255,193,94,0.14)' : COL.panel2; g.fill(); g.strokeStyle = oh ? COL.accent : COL.faint; g.lineWidth = oh ? 2 : 1.3; g.stroke();
      txt(g, d, bx + bw / 2, y + 33, { size: 32, weight: 800, fam: FM, color: oh ? COL.accent : COL.text, align: 'center' });
      const w = d === '0' ? 'oh' : PN.NUMW[+d];
      txt(g, w, bx + bw / 2, y + 88, { size: fit(g, w, 16, bw + 4, 700), weight: 700, color: oh ? COL.accent : COL.soft, align: 'center' });
    }));
    fade(g, ramp(u, at + 1.0, 0.4), () => { txt(g, '쉼', x + 3 * (bw + gap) + sep / 2 - 4, y + 33, { size: 15, weight: 700, color: COL.muted, align: 'center' }); });
    say(x - 6, y - 6, 7 * (bw + gap) + sep + 6, 108, PN.phoneWords(PN.phoneText(ph)));
  }
  // 헷갈리는 글자 짝 (04장) — 크게
  function alphaFig(g, x, y, w, u, at, hl) {
    PN.ALPHA.forEach(([a, an, b, bn], i) => fade(g, ramp(u, at + i * 0.4, 0.4), () => {
      const yy = y + i * 66;
      [[a, an, x], [b, bn, x + w / 2 + 10]].forEach(([L, nm, xx]) => {
        const on = hl === L;
        rr(g, xx, yy, w / 2 - 10, 56, 10); g.fillStyle = on ? 'rgba(127,224,168,0.12)' : COL.panel; g.fill(); g.strokeStyle = on ? COL.good : COL.faint; g.lineWidth = on ? 2 : 1.3; g.stroke();
        txt(g, L, xx + 30, yy + 29, { size: 30, weight: 800, fam: FM, color: on ? COL.good : COL.accent, align: 'center' });
        txt(g, `as in ${nm}`, xx + 62, yy + 29, { size: 22, weight: 700, color: on ? COL.good : COL.en });
        say(xx, yy, w / 2 - 10, 56, `${L} as in ${nm}`);
      });
      fade(g, ramp(u, at + i * 0.4 + 0.3, 0.3), () => txt(g, '↔', x + w / 2, yy + 29, { size: 20, weight: 700, color: COL.muted, align: 'center' }));
    }));
  }
  const reactOf = (q, j, a, C) => j.ok ? PN.reply(q, a, C) : (j.stage === 1 ? PN.REACT[1](q) : j.stage === 2 ? PN.REACT[2](q, j, a, C) : PN.REACT[3](q, j, a)).en;
  const secOf = (u, s) => Math.max(0, u - s);   // 통화 시간

  const SCENES = {
    /* 00 들어가며: 제목 → reserve × → make a reservation ✓ → 철자 Yes × → No, N as in Nancy ✓ → Okay. Thanks. × → So, 8:15? ✓ → 세 단계 */
    intro(g, u) {
      fade(g, ramp(u, 0.2, 0.6) * (1 - ramp(u, 5.0, 0.5)), () => {
        const T = '전화 영어, 얼굴 없이 듣고 되짚기';
        txt(g, T, W / 2, 262, { size: fit(g, T, 48, 1140, 800, 30, FD), weight: 800, fam: FD, align: 'center' });
        const T2 = 'English on the phone · 식당 예약에서 코치의 전화까지 일곱 곳';
        txt(g, T2, W / 2, 332, { size: fit(g, T2, 23, 1140, 500), weight: 500, color: COL.muted, align: 'center' });
        const XS = [-3.4, -2.4, -1.4, 0, 1, 2, 3.4];
        PN.PLACES.forEach((p, i) => fade(g, ramp(u, 0.9 + i * 0.22, 0.4), () => {
          const x = W / 2 + XS[i] * 118;
          circ(g, x, 440, 32, COL.panel2); ring(g, x, 440, 32, ME_FIRST[p.id] ? COL.verb : COL.accent, 1.8);
          icon(g, p.id, x, 440, 30, COL.soft);
          txt(g, String(i + 1), x, 392, { size: 14, weight: 700, fam: FM, color: COL.accent, align: 'center' });
          const nm = p.ko.split(' · ')[0];
          txt(g, nm, x, 496, { size: fit(g, nm, 15, 112, 600), weight: 600, color: COL.muted, align: 'center' });
          if (i < 6) { const gap = i === 2 || i === 5, nx = W / 2 + XS[i + 1] * 118; arrow(g, x + 38, 440, nx - 38, 440, gap ? 'rgba(201,167,255,0.5)' : COL.faint, 2, gap ? [4, 5] : null); }
        }));
        fade(g, ramp(u, 2.6, 0.4), () => [['전화 1 · 식당', -2.4], ['전화 2 · 스포츠 센터', 1], ['전화 3 · 코치', 3.4]].forEach(([t, k]) => txt(g, t, W / 2 + k * 118, 540, { size: 14, weight: 700, color: COL.ante, align: 'center' })));
      });
      const it = PN.INTRO, C = Object.assign({}, D, it.card);
      // [5.4, 11.8] 식당 예약: reserve → make a reservation
      fade(g, ramp(u, 5.4, 0.4) * (1 - ramp(u, 11.6, 0.4)), () => {
        label(g, '식당에 예약 전화 · 첫마디', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, it.q, { x: LX, y: 186, w: 780, at: 5.8, u, roleAt: 6.6, size: 26, shapeAt: 6.8 });
        fade(g, win(u, 6.6, 8.4), () => thought(g, '(속으로) 금요일 예약…', LX + 420, 186 + B.bh + 14, 300));
        const ay = 186 + B.bh + 84;
        answer(g, { x: LX, y: ay, w: 780, A: it.bad, B: u >= 9.6 ? it.ok : null, p: (u - 9.6) / 0.8, at: 7.6, u, size: 24, maxW: 660, trapAt: 8.4, strikeAt: 8.6, tag: ['reserve 뒤에는 잡을 것 → make a reservation', COL.trap, 8.8, 9.6], tagY: ay + 84, verdict: u >= 10.5 ? { ok: okOn(it.q, it.ok, C), at: 10.5 } : null });
        fade(g, ramp(u, 6.0, 0.5), () => phoneScreen(g, RX + 20, 160, RW - 40, { name: PN.BISTRO, num: '555-0110', sec: secOf(u, 5.6), live: u >= 5.8 && u < 8.6, sp: 'us' }));
      });
      // [12, 16.4] 철자 되짚기: Yes × → No, N as in Nancy ✓
      fade(g, ramp(u, 11.8, 0.4) * (1 - ramp(u, 16.2, 0.4)), () => {
        label(g, '이름 철자 · 직원이 되짚어요', LX, 160, { color: COL.accent, size: 16 });
        exch(g, u, { q: PN.simQ(it.dq, C), jq: PN.simQ(it.dq, C), at: 12.2, aAt: 13.0, bad: it.dbad, ok: it.dok, mAt: 14.4, tag: '틀렸는데 Yes → H-A-M으로 적혀요', tagY: 84, y: 186, size: 24, qsize: 24 });
        spellCard(g, RX, 160, RW, { sur: 'han', trap: u < 14.6, p: ramp(u, 12.4, 0.5), pairs: false });
      });
      // [16.6, 21] 빈 시각 → 되짚기
      fade(g, ramp(u, 16.4, 0.4) * (1 - ramp(u, 20.8, 0.5)), () => {
        label(g, '빈 시각 · 되짚기', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, it.rq, { x: LX, y: 186, w: 780, at: 16.6, u, size: 24, roleAt: 17.2, shapeAt: 17.4 });
        const ay = 186 + B.bh + 18;
        answer(g, { x: LX, y: ay, w: 780, A: it.skip, B: u >= 18.8 ? it.check : null, p: (u - 18.8) / 0.8, at: 17.6, u, size: 24, maxW: 600, trapAt: 18.0, strikeAt: 18.1, tag: ['되짚지 않으면 시각을 확인하지 못해요', COL.trap, 18.2, 18.8], tagY: ay + 80, verdict: u >= 19.7 ? { ok: okOn(it.rq, it.check, C), at: 19.7 } : null });
        timeRead(g, RX, 160, RW, { t: '8:15', trap: '8:50', p: ramp(u, 17.2, 0.6) });
      });
      const STEP = [
        ['①', '열쇠 낱말 + 모양', 'Lunch or dinner?', '고르는 질문 → 고른 것 + please', COL.ante, 'Lunch or dinner?'],
        ['②', '틀에 내 정보 넣기', 'So, ___?', '철자는 as in · 들은 것은 되짚기', COL.rel, 'So, eight-fifteen?'],
        ['③', '공손하게 끝내기', 'Could you …?', '부탁은 질문으로 · 끝에는 Thanks', COL.verb, 'Could you ask him to call me back?'],
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

    /* 01 전화 세 통: 식당(셋) · 스포츠 센터(셋) · 코치(하나) */
    map(g, u) {
      const sel = S.stop != null ? S.stop : null;
      const BX = [{ x: 70, w: 380, n: 1, t: 'CALL 1 · LANTERN BISTRO', num: '555-0110', out: true }, { x: 470, w: 420, n: 2, t: 'CALL 2 · KELLPORT SPORTS CENTER', num: '555-0125', out: true }, { x: 910, w: 300, n: 3, t: 'CALL 3 · COACH DIAZ', num: '555-0172', out: false }];
      const POS = { book: [165, 318], time: [260, 318], name: [355, 318], ask: [575, 318], msg: [680, 318], number: [785, 318], call: [1060, 318] };
      const NM = { book: ['예약 전화', '첫마디 용건'], time: ['시간 맞추기', '빈 시각 되짚기'], name: ['이름 철자', 'as in'], ask: ['문의 전화', '수업 안내 되짚기'], msg: ['메시지', '한 줄로 남기기'], number: ['전화번호', '하나씩 · oh'], call: ['걸려 온 전화', '받기 · 준비물'] };
      const AT0 = [0.3, 6.0, 12.0];
      BX.forEach((b, k) => fade(g, ramp(u, AT0[k], 0.6), () => {
        const y = 146, h = 322;
        panel(g, b.x, y, b.w, h, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        txt(g, b.t, b.x + 20, y + 24, { size: fit(g, b.t, 12, b.w - 70, 700, 8, FM), weight: 700, fam: FM, color: COL.muted });
        icon(g, b.out ? 'phone' : 'call', b.x + b.w - 30, y + 26, 22, b.out ? COL.muted : COL.good);
        rr(g, b.x + 22, y + 50, b.w - 44, 52, 8); g.fillStyle = '#0E1620'; g.fill();
        const top = b.out ? `☎ ${b.num}` : `INCOMING · ${b.num}`;
        txt(g, top, b.x + b.w / 2, y + 76, { size: 14, weight: 800, fam: FM, color: b.out ? COL.ante : COL.good, align: 'center' });
        rr(g, b.x + 22, y + 268, b.w - 44, 36, 8); g.fillStyle = COL.wood; g.fill();
        const bt = b.out ? '내가 건 전화' : '걸려 온 전화';
        txt(g, bt, b.x + b.w / 2, y + 286, { size: 12.5, weight: 700, color: '#E6D2B8', align: 'center' });
      }));
      fade(g, ramp(u, 6.0, 0.4), () => arrow(g, 452, 318, 468, 318, 'rgba(201,167,255,0.75)', 2.2));
      fade(g, ramp(u, 12.0, 0.4), () => arrow(g, 892, 318, 908, 318, 'rgba(201,167,255,0.75)', 2.2));
      const AT = [1.0, 2.4, 3.8, 6.4, 8.2, 10.0, 12.6];
      PN.PLACES.forEach((p, i) => {
        const [x, y] = POS[p.id], on = sel === i, dim = sel != null && !on, me = ME_FIRST[p.id] && u >= 18.2;
        fade(g, ramp(u, AT[i], 0.45) * (dim ? 0.4 : 1), () => {
          circ(g, x, y, 24, on ? COL.accent : COL.panel2); ring(g, x, y, 24, on ? COL.accent : me ? COL.verb : COL.ante, me ? 3 : 2.2);
          icon(g, p.id, x, y, 26, on ? '#1D1305' : COL.text);
          chip(g, String(i + 1), x + 19, y - 21, { size: 11, fam: FM, weight: 700, color: '#1D1305', fill: me ? COL.verb : COL.accent, h: 18, r: 9, pad: 5, align: 'center' });
          const [l1, l2] = NM[p.id];
          txt(g, l1, x, y + 42, { size: fit(g, l1, 14, 96, 700), weight: 700, color: me ? COL.verb : COL.soft, align: 'center' });
          txt(g, l2, x, y + 60, { size: fit(g, l2, 12.5, 96, 600), weight: 600, color: me ? COL.verb : COL.muted, align: 'center' });
        });
        HITS.push({ x: x - 48, y: y - 28, w: 96, h: 100, stop: i });
      });
      // 아래 칸
      const by = 480, bh = 98;
      if (sel != null) {
        const p = PN.PLACES[sel];
        panel(g, LX, by, 1120, bh, { fill: COL.panel, stroke: COL.accent });
        icon(g, p.id, LX + 28, by + 24, 22, COL.accent);
        txt(g, `${sel + 1}. ${p.ko}`, LX + 48, by + 24, { size: 17, weight: 700, color: COL.accent });
        PN.PLACEQ[p.id].forEach((qid, k) => {
          const q = PN.simQ(qid, D), t = q.short && /[?!.]$/.test(q.short) && q.short.length < 60 ? q.short : q.en, R = richLay(g, t, q.fast ? [] : Qm(q), 17, 590, { weight: 600 });
          shapeMark(g, q.shape, LX + 34, by + 54 + k * 28, 14, { disc: false, iw: 2.2 });
          if (R.rows > 1) txt(g, t, LX + 52, by + 54 + k * 28, { size: fit(g, t, 17, 590, 600), weight: 600, color: COL.en });
          else richDraw(g, R, LX + 52, by + 54 + k * 28, { color: COL.en });
          say(LX + 48, by + 40 + k * 28, Math.min(R.w, 600) + 8, 28, q.en);
        });
        txt(g, '대답 →', LX + 690, by + 24, { size: 14, weight: 700, color: COL.muted });
        PN.PLACEQ[p.id].map(id => PN.simQ(id, D)).forEach((q, k) => { const a = PN.model(q, D), t = shortText(a); txt(g, t, LX + 690, by + 54 + k * 28, { size: fit(g, t, 16, 420, 600), weight: 600, color: COL.rel }); say(LX + 686, by + 40 + k * 28, 430, 28, PN.text(a)); });
      } else {
        PN.PLACES.forEach((p, i) => fade(g, ramp(u, 6.2 + i * 0.5, 0.4), () => {
          const x = LX + i * 161, q = PN.Q[PN.PLACEQ[p.id][0]], t = q.short && q.short.length < 48 ? q.short : q.en, me = ME_FIRST[p.id] && u >= 18.2;
          panel(g, x, by, 151, bh, { fill: COL.panel, stroke: me ? COL.verb : COL.faint, lw: me ? 2 : 1.5 });
          txt(g, `${i + 1}`, x + 14, by + 20, { size: 13, weight: 700, fam: FM, color: COL.accent });
          txt(g, me ? '내가 먼저' : `전화 ${PN.PLACE[p.id].call}`, x + 140, by + 20, { size: 12, weight: 700, color: me ? COL.verb : COL.muted, align: 'right' });
          const R = richLay(g, t, [], 14, 130, { weight: 600 });
          richDraw(g, R, x + 12, by + 48, { color: COL.en });
          say(x, by, 151, bh, q.en);
        }));
        fade(g, ramp(u, 24.2, 0.5), () => tag(g, '식당 · 센터 · 이름 · 번호(555-01XX) · 시간 · 값은 지어낸 예시예요', 1200, 126, COL.muted, { align: 'right', size: 14, h: 26 }));
      }
    },

    /* 02 예약 전화: reserve × · 용건 빠짐 × · 명령 × → make a reservation ✓ → 점심/저녁 → 이어 들리는 말 → 사람 수 → 빠른 첫마디 */
    book(g, u) {
      if (S.book) {
        const s = S.book, C = Object.assign({}, D, { day: s.day, meal: s.meal, ppl: s.ppl });
        const HOW = { ok: 'nd_book', rsv: 'nd_rsv', half: 'nd_bhalf', blunt: 'nd_bblunt' };
        const y = pickView(g, 'bk_help', OT(HOW[s.how] || 'nd_book', s.day), C, 150);
        exch(g, 99, { q: 'bk_meal', at: -9, ok: OT('ml_pl', s.meal), card: C, y: y + 24, qo: { all: true } });
        resvPad(g, RX, 150, RW, C, { show: k => k === 'day' || k === 'meal' || k === 'ppl', hl: 'meal' });
        return;
      }
      const SC = PN.SCENE;
      // [0.4, 11.5] 첫마디 용건
      if (u < 11.8) fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const [qid, rsv, half, blunt, ok] = SC.need;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[rsv, 2.4, 6.0, 'reserve 뒤에는 잡을 것(a table) → make a reservation'], [half, 6.0, 7.8, '무엇을 하고 싶은지 빠졌어요'], [blunt, 7.8, 9.4, '명령처럼 들려요']]);
        if (u >= 9.2) fade(g, ramp(u, 9.4, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 9.6, u, size: 23, maxW: 640, verdict: { ok: okOn(qid, ok), at: 10.3 } }));
        fade(g, ramp(u, 0.6, 0.5), () => phoneScreen(g, RX + 20, 150, RW - 40, { name: PN.BISTRO, num: '555-0110', sec: secOf(u, 0.2), live: u >= 0.8 && u < 3.0, sp: 'us' }));
      });
      // [11.5, 17] 점심 · 저녁 고르기
      if (u >= 11.3 && u < 17.4) fade(g, ramp(u, 11.5, 0.4) * (1 - ramp(u, 17.0, 0.4)), () => {
        const [qid, yes, lunch, ok] = SC.meal;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 11.7, u, roleAt: 12.3, size: 22, shapeAt: 12.5 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 12.9, 14.6, '고르는 질문에 Yes → 고른 것이 없어요'], [lunch, 14.6, 15.6, '카드는 저녁이에요']]);
        if (u >= 15.4) fade(g, ramp(u, 15.6, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 15.8, u, size: 23, verdict: { ok: okOn(qid, ok), at: 16.3 } }));
        resvPad(g, RX, 150, RW, D, { show: k => k === 'day' || (k === 'meal' && u >= 16.3), hl: u >= 16.3 ? 'meal' : null });
      });
      // [17, 22.5] 이어서 들리는 말
      if (u >= 16.8 && u < 22.9) fade(g, ramp(u, 17.0, 0.4) * (1 - ramp(u, 22.5, 0.4)), () => {
        staff(g, 'bk_meal', { x: LX, y: 150, w: 780, all: true, u: 99, size: 22 });
        linked(g, PN.LINKED[0], LX + 10, 300, u, 17.4, 760);
        notePanel(g, RX, 150, RW, '점심 · 저녁', [
          ['lunch', '점심 · 낮 12시 무렵', COL.clause],
          ['dinner', '저녁', COL.clause],
          ['Lunch or dinner?', '고르는 질문 · 끝이 내려가요', COL.soft],
        ], { u, at: 18.0, step: 0.6 });
      });
      // [22.5, 28] 사람 수: We are × → For four ✓
      if (u >= 22.3 && u < 28.4) fade(g, ramp(u, 22.5, 0.4) * (1 - ramp(u, 28.0, 0.4)), () => {
        const [qid, lit, , ok] = SC.ppl;
        exch(g, u, { q: qid, at: 22.7, aAt: 23.8, bad: lit, ok, mAt: 25.6, tag: '우리는 네 명 → We are four? 사람 수는 For four', tagY: 78 });
        resvPad(g, RX, 150, RW, D, { show: k => k === 'day' || k === 'meal' || (k === 'ppl' && u >= 26.4), hl: u >= 26.4 ? 'ppl' : null });
      });
      // [28, 38] 빠른 첫마디 → 가게 이름 되묻기
      if (u >= 27.8) fade(g, ramp(u, 28.0, 0.4), () => {
        const [qf, guess, rp] = SC.bfast;
        const r = exch(g, u, { q: qf, at: 28.2, aAt: 29.4, bad: guess, ok: rp, mAt: 31.6, tag: '빠른 말을 짐작했어요', tagY: 78 });
        say2(g, 'Yes, this is Lantern Bistro. How can I help you?', r.y + 14, 33.6, u, 'ben', 'us', [['Lantern Bistro', 'slot']]);
        notePanel(g, RX, 150, RW, '빠른 말 · 미국식', [
          ["Ben speakin'", '= this is Ben speaking', COL.soft],
          ["How c'n I help?", '= How can I help you?', COL.soft],
          ['Sorry, is this Lantern Bistro?', '들린 만큼 되묻기 · 맞는 곳인지 확인', COL.verb],
        ], { u, at: 28.8, step: 1.0 });
      });
    },

    /* 03 시간 맞추기: 시각 → 다 참(Yes × · Oh, okay × · possible ×) → Do you have …? ✓ → 빈 시각 되짚기 → 숫자 짝 → 빠른 말 */
    time(g, u) {
      if (S.time) {
        const s = S.time, C = Object.assign({}, D, { meal: s.meal, want: PN.WANT[s.meal], alt: s.alt, offer: s.offer }), t = PN.offerOf(C);
        const r = exch(g, 99, { q: PN.simQ('tm_full', C), at: -9, ok: OT('fl_alt', s.alt), card: C, y: 150, qo: { all: true } });
        const a = s.a === 'swap' ? OT('of_so', PN.timeTrap(t)) : s.a === 'skip' ? OT('of_ok') : OT('of_so', t);
        pickView(g, PN.simQ('tm_offer', C), a, C, r.y + 20);
        timeRead(g, RX, 150, RW, { t, trap: s.a === 'swap' ? PN.timeTrap(t) : null });
        return;
      }
      const SC = PN.SCENE;
      // [0.4, 5.5] 몇 시?
      if (u < 5.9) fade(g, 1 - ramp(u, 5.5, 0.4), () => {
        const [qid, yes, ok] = SC.when;
        exch(g, u, { q: qid, at: 0.8, aAt: 1.8, bad: yes, ok, mAt: 3.4, tag: '정보 질문에 Yes → 시각이 없어요', tagY: 78 });
        resvPad(g, RX, 150, RW, D, { show: k => k === 'day' || k === 'meal' || k === 'ppl' });
      });
      // [5.5, 17] 다 찼어요 → 다른 시간을 질문으로
      if (u >= 5.3 && u < 17.4) fade(g, ramp(u, 5.5, 0.4) * (1 - ramp(u, 17.0, 0.4)), () => {
        const [qid, yes, okay, lit, ok] = SC.full;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 5.7, u, roleAt: 6.3, size: 22, shapeAt: 6.5 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 6.9, 8.6, '묻는 말이 아니에요'], [okay, 8.6, 11.5, '알겠다고만 → 예약을 못 하고 끝나요'], [lit, 11.5, 14.0, '가능한 시간 → possible? 자리는 Do you have …?']]);
        if (u >= 13.8) fade(g, ramp(u, 14.0, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 14.2, u, size: 23, maxW: 640, verdict: { ok: okOn(qid, ok), at: 14.9 } });
          say2(g, PN.reply(PN.Q[qid], ok, D), y + A.bh + 14, 15.6, u, 'ben', 'us');
        });
        notePanel(g, RX, 150, RW, '자리가 있는지 물을 때', [
          ['Do you have anything later?', '더 늦은 시간 있나요?', COL.verb],
          ['Do you have anything earlier?', '더 이른 시간 있나요?', COL.verb],
          ['Is 8 o\'clock available?', '그 시각에 자리가 있나요? (available)', COL.soft],
        ], { u, at: 11.8, step: 0.8 });
      });
      // [17, 29] 빈 시각 되짚기
      if (u >= 16.8 && u < 29.4) fade(g, ramp(u, 17.0, 0.4) * (1 - ramp(u, 29.0, 0.4)), () => {
        const [qid, okay, b50, ok] = SC.offer;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 17.2, u, roleAt: 17.8, size: 22, shapeAt: 18.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[okay, 18.4, 20.4, '되짚지 않으면 시각을 확인하지 못해요'], [b50, 20.4, 22.6, '8:15를 8:50으로 들었어요']]);
        if (u >= 22.4) fade(g, ramp(u, 22.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 22.8, u, size: 23, verdict: { ok: okOn(qid, ok), at: 23.4 } });
          say2(g, PN.reply(PN.Q[qid], ok, D), y + A.bh + 14, 24.2, u, 'ben', 'us');
        });
        fade(g, 1 - ramp(u, 24.8, 0.4), () => timeRead(g, RX, 150, RW, { t: '8:15', trap: u >= 20.4 ? '8:50' : null, p: ramp(u, 17.6, 0.6) }));
        fade(g, ramp(u, 25.0, 0.4), () => pairsFig(g, RX, 150, RW, u, 25.2));
      });
      // [29, 36] 빠른 말
      if (u >= 28.8) fade(g, ramp(u, 29.0, 0.4), () => {
        const [qf, guess, rp] = SC.ofast;
        const r = exch(g, u, { q: qf, at: 29.2, aAt: 30.3, bad: guess, ok: rp, mAt: 32.0, tag: '빠른 말을 짐작했어요', tagY: 78 });
        say2(g, 'At eight-fifteen. 8:15.', r.y + 14, 33.6, u, 'ben', 'us', [['8:15', 'slot']]);
        notePanel(g, RX, 150, RW, '빠른 말 · 미국식', [
          ["'Kay, got a table …", "= Okay, we've got a table …", COL.soft],
          ['Sorry, what time was that?', '시각만 다시 묻기', COL.verb],
        ], { u, at: 29.8, step: 1.2 });
      });
    },

    /* 04 이름 철자: Name is × → It's Han ✓ → 철자(Yes × · 이름만 ×) → H-A-N(통함) → as in ✓ → 글자 짝 → 잘못 되짚은 글자 바로잡기 */
    name(g, u) {
      if (S.spell) {
        const s = S.spell, n = PN.NAMES[s.sur], C = Object.assign({}, D, { sur: s.sur, hok: s.hok });
        const r = exch(g, 99, { q: 'nm_spell', at: -9, ok: OT('sp_it', s.sur), card: C, y: 150, qo: { all: true } });
        const A = { yes: OT('ck_yes'), no: OT('ck_no', n.L), isnt: OT('ck_isnt', n.L), bare: OT('g_no') }[s.a] || OT('ck_no', n.L);
        pickView(g, PN.simQ('nm_check', C), A, C, r.y + 20);
        spellCard(g, RX, 150, RW, { sur: s.sur, trap: !s.hok });
        return;
      }
      const SC = PN.SCENE;
      // [0.4, 6] 이름
      if (u < 6.4) fade(g, 1 - ramp(u, 6.0, 0.4), () => {
        const [qid, lit, , ok] = SC.name;
        exch(g, u, { q: qid, at: 0.8, aAt: 2.0, bad: lit, ok, mAt: 3.8, tag: '이름은 → Name is? 이름 하나만 짧게', tagY: 78 });
        resvPad(g, RX, 150, RW, D, { show: k => k !== 'name', hl: null });
      });
      // [6, 17.5] 철자: Yes × · 이름만 × → H-A-N (통함) → as in ✓
      if (u >= 5.8 && u < 17.9) fade(g, ramp(u, 6.0, 0.4) * (1 - ramp(u, 17.5, 0.4)), () => {
        const [qid, yes, nm, bare, ok] = SC.spell;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 6.2, u, roleAt: 6.8, size: 22, shapeAt: 7.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 7.2, 8.8, '철자를 불러 달라는 부탁 → 바로 불러요'], [nm, 8.8, 11.4, '이름을 한 번 더 말했을 뿐이에요']]);
        fade(g, win(u, 11.6, 14.2, 0.3), () => answer(g, { x: LX, y, w: 780, A: bare, at: 11.8, u, size: 23, verdict: { ok: true, at: 12.4 }, tag: ['통하지만 N과 M이 헷갈려요', COL.muted, 12.6], tagY: y + 78 }));
        if (u >= 14.0) fade(g, ramp(u, 14.2, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 14.4, u, size: 23, verdict: { ok: okOn(qid, ok), at: 15.0 } });
          say2(g, PN.reply(PN.Q[qid], ok, D), y + A.bh + 14, 15.8, u, 'ben', 'us');
        });
        spellCard(g, RX, 150, RW, { sur: 'han', p: ramp(u, 12.2, 0.5), pairs: false });
      });
      // [17.5, 23] 헷갈리는 글자 짝
      if (u >= 17.3 && u < 23.4) fade(g, ramp(u, 17.5, 0.4) * (1 - ramp(u, 23.0, 0.4)), () => {
        label(g, '전화에서 헷갈리는 글자 · as in + 흔한 이름', LX, 160, { color: COL.accent, size: 16 });
        alphaFig(g, LX, 186, 780, u, 17.8, u >= 20.8 ? 'N' : null);
        notePanel(g, RX, 150, RW, '철자를 부를 때', [
          ["It's H-A-N,", '글자를 하나씩', COL.clause],
          ['N as in Nancy.', '헷갈리는 글자에 as in', COL.clause],
          ['Could you spell that?', '철자를 불러 달라는 말', COL.soft],
        ], { u, at: 18.4, step: 0.7 });
      });
      // [23, 34] 잘못 되짚은 글자 바로잡기
      if (u >= 22.8) fade(g, ramp(u, 23.0, 0.4), () => {
        const [qid, yes, isnt, no, ok] = SC.check, q = PN.simQ(qid, D);
        const B = staff(g, q, { x: LX, y: 150, w: 780, at: 23.2, u, roleAt: 23.8, size: 22, shapeAt: 24.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 24.4, 26.6, '틀렸는데 Yes → H-A-M으로 적혀요'], [isnt, 26.6, 28.6, 'Was로 물었는데 it isn\'t → 짝이 어긋나요'], [no, 28.6, 30.6, 'No만 → 맞는 글자를 몰라요']]);
        if (u >= 30.4) fade(g, ramp(u, 30.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 30.8, u, size: 23, verdict: { ok: okOn(q, ok), at: 31.4 } });
          say2(g, PN.reply(q, ok, D), y + A.bh + 14, 32.2, u, 'ben', 'us');
        });
        const bad = u >= 24.8 && u < 31.4 ? { name: `HAM (${PN.wrongSpell('han')})` } : null;
        resvPad(g, RX, 150, RW, D, { show: k => k !== 'name' || u >= 31.4, hl: u >= 31.4 ? 'name' : null, bad });
        fade(g, ramp(u, 26.8, 0.4), () => auxTable(g, RX, 412, RW, { hl: 'was', no: true }));
      });
    },

    /* 05 문의 전화: inquiry × · 묻는 것 빠짐 × · 명령 × → calling to ask about ✓ → 반 고르기(모르는 낱말 묻기) → 이어 들리는 말 → 안내 되짚기 → 빠른 말 */
    ask(g, u) {
      if (S.shape) {
        const q = PN.simQ(S.shape, D), Sx = PN.SHAPE[q.shape], a = PN.model(q, D);
        const B = staff(g, q, { x: LX, y: 160, w: 1100, all: true, u: 99, size: 26 });
        shapeTag(g, q.shape, LX, 160 + B.bh + 40, { size: 18, h: 42 });
        txt(g, Sx.say, LX, 160 + B.bh + 96, { size: 19, weight: 600, color: COL.soft });
        if (q.aux) txt(g, `${PN.AUX[q.aux].q} → ${PN.AUX[q.aux].a}`, LX, 160 + B.bh + 130, { size: 17, weight: 600, color: COL.ante });
        else if (q.shape === 'yn' && Sx.offer) txt(g, Sx.offer, LX, 160 + B.bh + 130, { size: 16, weight: 600, color: COL.muted });
        answer(g, { x: LX, y: 160 + B.bh + 160, w: 1100, A: a, all: true, u: 99, size: a.f === 'line' ? 21 : 26, maxW: 900, verdict: { ok: true, at: -1 } });
        return;
      }
      if (S.info) {
        const s = S.info, C = Object.assign({}, D, { lvl: s.lvl });
        const r = exch(g, 99, { q: 'as_level', at: -9, ok: OT('lv_pl', s.lvl), card: C, y: 150, qo: { all: true } });
        const A = { ok: OT('in_so', s.lvl), p: OT('in_so', s.lvl + '~p'), d: OT('in_so', s.lvl + '~d'), skip: OT('in_ok') }[s.a] || OT('in_so', s.lvl);
        pickView(g, PN.simQ('as_info', C), A, C, r.y + 20);
        classCard(g, RX, 150, RW, { hl: s.lvl, trap: s.a === 'p' ? '~p' : s.a === 'd' ? '~d' : null });
        return;
      }
      const SC = PN.SCENE;
      // [0.4, 11.5] 첫마디 용건
      if (u < 11.8) fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const [qid, inq, half, tell, ok] = SC.help;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[inq, 2.4, 6.0, '문의하다 → inquiry? 이름씨예요'], [half, 6.0, 7.8, '무엇을 묻는지 없어요'], [tell, 7.8, 9.4, '명령처럼 들려요']]);
        if (u >= 9.2) fade(g, ramp(u, 9.4, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 9.6, u, size: 23, maxW: 640, verdict: { ok: okOn(qid, ok), at: 10.3 } }));
        fade(g, ramp(u, 0.6, 0.5), () => phoneScreen(g, RX + 20, 150, RW - 40, { name: PN.CENTER, num: '555-0125', sec: secOf(u, 0.2), live: u >= 0.8 && u < 3.4, sp: 'ca' }));
      });
      // [11.5, 17] 반 고르기: Yes × → 모르는 낱말 묻기 ✓
      if (u >= 11.3 && u < 17.4) fade(g, ramp(u, 11.5, 0.4) * (1 - ramp(u, 17.0, 0.4)), () => {
        const [qid, yes, what] = SC.level;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 11.7, u, roleAt: 12.3, size: 22, shapeAt: 12.5 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 12.9, 14.4, '고르는 질문에 Yes → 고른 것이 없어요']]);
        if (u >= 14.2) fade(g, ramp(u, 14.4, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: what, at: 14.6, u, size: 23, verdict: { ok: okOn(qid, what), at: 15.2 }, tag: ['모르는 낱말은 물어요', COL.good, 15.4], tagY: y + 78 });
          say2(g, 'Intermediate is the middle level, for people who can already swim a little.', y + A.bh + 54, 15.8, u, 'grace', 'ca', [['the middle level', 'slot']]);
        });
        notePanel(g, RX, 150, RW, '반 · class level', [
          ['beginner', '초급 · 처음 배우는 사람', COL.clause],
          ['intermediate', '중급 · 조금 할 줄 아는 사람', COL.clause],
          ['Sorry, what does … mean?', '모르는 낱말 묻기', COL.verb],
        ], { u, at: 12.0, step: 0.8 });
      });
      // [17, 22] 고르기 + 이어서 들리는 말
      if (u >= 16.8 && u < 22.4) fade(g, ramp(u, 17.0, 0.4) * (1 - ramp(u, 22.0, 0.4)), () => {
        const [qid, , , ok] = SC.level;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, all: true, u: 99, size: 22 });
        const A = answer(g, { x: LX, y: 150 + B.bh + 14, w: 780, A: ok, at: 17.3, u, size: 23, verdict: { ok: okOn(qid, ok), at: 17.9 } });
        linked(g, PN.LINKED[1], LX + 10, 150 + B.bh + A.bh + 74, u, 18.6, 760);
        classCard(g, RX, 150, RW, { hl: u >= 17.9 ? 'beg' : null, p: ramp(u, 17.2, 1.0) });
      });
      // [22, 33.5] 수업 안내 되짚기
      if (u >= 21.8 && u < 33.9) fade(g, ramp(u, 22.0, 0.4) * (1 - ramp(u, 33.5, 0.4)), () => {
        const [qid, okay, p14, dmw, ok] = SC.info;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 22.2, u, roleAt: 22.8, size: 22, shapeAt: 23.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[okay, 25.6, 27.6, '되짚지 않으면 요일과 값을 확인하지 못해요'], [p14, 27.6, 29.4, '$40 → $14? FORty ↔ fourTEEN'], [dmw, 29.4, 31.0, '월 · 수는 중급 반 요일이에요']]);
        if (u >= 30.8) fade(g, ramp(u, 31.0, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 31.2, u, size: 22, maxW: 660, verdict: { ok: okOn(qid, ok), at: 31.8 } });
          say2(g, PN.reply(PN.Q[qid], ok, D), y + A.bh + 14, 32.4, u, 'grace', 'ca');
        });
        classCard(g, RX, 150, RW, { hl: 'beg', trap: u >= 27.6 && u < 29.4 ? '~p' : u >= 29.4 && u < 31.0 ? '~d' : null });
      });
      // [33.5, 38] 빠른 말
      if (u >= 33.3) fade(g, ramp(u, 33.5, 0.4), () => {
        const [qf, guess, rp] = SC.ifast;
        exch(g, u, { q: qf, at: 33.7, aAt: 34.6, bad: guess, ok: rp, mAt: 35.8, tag: '빠른 말을 짐작했어요', tagY: 108 });
        notePanel(g, RX, 150, RW, '빠른 말 · 캐나다식', [
          ["Beginners're …", '= Beginners are …', COL.soft],
          ['forty a month', '= $40 a month', COL.soft],
          ['Sorry, when is the class, and how much is it?', '언제 · 얼마만 다시 묻기', COL.verb],
        ], { u, at: 34.0, step: 0.8 });
      });
    },

    /* 06 메시지 남기기: Please leave × → Yes, please ✓ → 한 줄(누구 → 무슨 일 → 부탁 → 번호) ✓ → Here is × · Tell him × · 누구 빠짐 × · 무슨 일 빠짐 × · 차례 × → 빠른 말 */
    msg(g, u) {
      if (S.line) {
        const s = S.line, C = Object.assign({}, D, { lvl: s.lvl, phone: s.phone }), a = PN.L(s.words.slice(), PN.fullName(C));
        const B = staff(g, 'ms_go', { x: LX, y: 150, w: 780, all: true, u: 99, size: 22 });
        if (!s.words.length) txt(g, '아래 조각을 골라 메시지 한 줄을 만들어 보세요.', LX, 150 + B.bh + 40, { size: 18, weight: 600, color: COL.muted });
        else {
          const A = answer(g, { x: LX, y: 150 + B.bh + 16, w: 780, A: a, all: true, u: 99, size: 21, maxW: 640, verdict: { ok: PN.checkLine(a.line, C).ok, at: -1 } });
          const fx = PN.fixLine(a.line, C);
          const T = talk(g, { side: 'L', x: LX, y: 150 + B.bh + A.bh + 30, w: 780, text: fx.en, marks: [], kind: 'olivia', sp: 'gb', all: true, u: 99, size: 21 });
          const j = PN.checkLine(a.line, C), K = richLay(g, j.why, [], 15, 770, { weight: 600 });
          richDraw(g, K, LX, 150 + B.bh + A.bh + T.bh + 60, { color: j.ok ? COL.good : COL.trap });
        }
        msgPad(g, RX, 150, RW, s.words, { name: PN.fullName(C) });
        return;
      }
      const SC = PN.SCENE, LS = {}; SC.lines.forEach(([k, a]) => { LS[k] = a; });
      // [0.4, 10.5] 메시지를 남기겠느냐 → Yes, please → Go ahead
      if (u < 10.9) fade(g, 1 - ramp(u, 10.5, 0.4), () => {
        const [qid, lit, ok] = SC.out;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 21, shapeAt: 5.2 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[lit, 4.4, 6.8, 'Please leave … → 상대에게 남기라는 말']]);
        if (u >= 6.6) fade(g, ramp(u, 6.8, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 7.0, u, size: 23, verdict: { ok: okOn(qid, ok), at: 7.6 } });
          say2(g, PN.Q.ms_go.en, y + A.bh + 14, 8.4, u, 'olivia', 'gb', [['Go ahead', 'key']]);
        });
        fade(g, ramp(u, 0.6, 0.5), () => phoneScreen(g, RX + 20, 150, RW - 40, { name: 'Swim Office', num: '555-0125 · ext. 3', sub: 'Coach Diaz · not in', sec: secOf(u, -40), live: u >= 0.8 && u < 5.6, sp: 'gb' }));
      });
      if (u >= 10.3 && u < 37.4) fade(g, ramp(u, 10.5, 0.3) * (1 - ramp(u, 37.0, 0.4)), () => staff(g, 'ms_go', { x: LX, y: 150, w: 780, at: 10.7, u, roleAt: 11.0, size: 22, shapeAt: 11.2 }));
      const y0 = 150 + richLay(g, PN.Q.ms_go.en, [], 22, 600, { weight: 500 }).h + 20 + 16;
      // [10.5, 18] 바른 한 줄 ✓
      fade(g, win(u, 10.5, 18.0, 0.3), () => {
        const A = answer(g, { x: LX, y: y0, w: 780, A: LS.ok, at: 11.4, u, size: 21, maxW: 640, verdict: { ok: okOn('ms_go', LS.ok), at: 15.6 } });
        say2(g, PN.fixLine(LS.ok.line, D).en, y0 + A.bh + 14, 16.2, u, 'olivia', 'gb');
        lineOrder(g, RX, 150, RW, { p: clamp((u - 11.4) / 3.6) });
      });
      // [18, 37] Here is × · Tell him × · 누구 빠짐 × · 무슨 일 빠짐 × · 차례 × (받아 적는 사람이 그 조각만 다시 물음)
      [[LS.here, 18.0, 22.5, 'Here is → 물건을 건넬 때 · 나를 밝힐 때는 This is', 'order', { who: 'Here is Jiwoo Han.' }],
        [LS.tell, 22.5, 26.5, 'Tell him … → 명령처럼 들려요', 'order', { ask: 'Tell him to call me back …' }],
        [LS.nowho, 26.5, 29.0, '누구인지 빠졌어요', 'pad'],
        [LS.noabout, 29.0, 31.5, '무슨 일인지 빠졌어요', 'pad'],
        [LS.order, 31.5, 37.0, '번호를 부탁보다 먼저 → 차례가 뒤섞여요', 'order', { num: 'At 555-0139. (부탁보다 먼저)' }]].forEach(([a, s, e, tg, fig, bad]) => {
        if (u < s - 0.2 || u > e + 0.2) return;
        fade(g, win(u, s, e, 0.3), () => {
          const A = answer(g, { x: LX, y: y0, w: 780, A: a, at: s + 0.2, u, size: 21, maxW: 640, verdict: { ok: false, at: s + 0.8 } });
          const T = say2(g, PN.fixLine(a.line, D).en, y0 + A.bh + 14, s + 1.0, u, 'olivia', 'gb');
          fade(g, ramp(u, s + 1.0, 0.3), () => tag(g, tg, LX + 780, y0 + A.bh + T.bh + 40, COL.trap, { align: 'right', size: 15, h: 30 }));
          if (fig === 'pad') msgPad(g, RX, 150, RW, a.line.words, {});
          else lineOrder(g, RX, 150, RW, { bad });
        });
      });
      // [37, 44] 빠른 말
      if (u >= 36.8) fade(g, ramp(u, 37.0, 0.4), () => {
        const [qf, guess, rp] = SC.mfast;
        const r = exch(g, u, { q: qf, at: 37.2, aAt: 38.3, bad: guess, ok: rp, mAt: 40.0, tag: '빠른 말을 짐작했어요', tagY: 78 });
        say2(g, 'Yes — would you like to leave a message?', r.y + 14, 41.6, u, 'olivia', 'gb', [['leave a message', 'slot']]);
        notePanel(g, RX, 150, RW, '빠른 말 · 영국식', [
          ["He's out, I'm 'fraid.", "= I'm afraid he's out.", COL.soft],
          ["D'you wanna …?", '= Do you want to …?', COL.soft],
          ["Sorry, did you ask if I'd like to leave a message?", '들린 만큼 되묻기', COL.verb],
        ], { u, at: 37.8, step: 1.0 });
      });
    },

    /* 07 전화번호: handphone × · Yes × → It's 555-0139 ✓ → 하나씩 · oh → 빠른 말 → 잘못 되짚은 번호(Yes × · wasn't × · No ×) → No, it isn't. It's … ✓ */
    number(g, u) {
      if (S.aux) {
        const q = PN.simQ(S.aux.q, Object.assign({}, D, S.aux.card || {})), a = OT(S.aux.a, S.aux.v), C = Object.assign({}, D, S.aux.card || {});
        const r = exch(g, 99, { q, at: -9, ok: a, card: C, y: 160, qo: { all: true } });
        whyLine(g, PN.judge(q, a, C), r.y + 30, 780, LX);
        auxTable(g, RX, 150, RW, { hl: q.aux });
        return;
      }
      if (S.num) {
        const s = S.num, C = Object.assign({}, D, { phone: s.phone, pok: s.pok });
        const r = exch(g, 99, { q: 'nb_ask', at: -9, ok: OT('nb_is', s.phone), card: C, y: 150, qo: { all: true } });
        const A = { yes: OT('nc_yes'), no: OT('nc_no', s.phone), wasnt: OT('nc_wasnt', s.phone), bare: OT('g_no') }[s.a] || OT('nc_no', s.phone);
        pickView(g, PN.simQ('nb_check', C), A, C, r.y + 20);
        phoneRead(g, RX, 150, RW, { ph: s.phone, trap: s.pok ? null : PN.phoneSwap(s.phone) });
        return;
      }
      const SC = PN.SCENE;
      // [0.4, 11] 번호 묻기: handphone × · Yes × → It's 555-0139 ✓
      if (u < 11.4) fade(g, 1 - ramp(u, 11.0, 0.4), () => {
        const [qid, hp, yes, , ok] = SC.nb;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[hp, 2.2, 6.0, '핸드폰 → 한국에서 만든 말 · cell phone'], [yes, 6.0, 7.8, '정보 질문에 Yes → 번호가 없어요']]);
        if (u >= 7.8) fade(g, ramp(u, 8.0, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 8.2, u, size: 23, verdict: { ok: okOn(qid, ok), at: 9.0 } });
          say2(g, PN.reply(PN.Q[qid], ok, D), y + A.bh + 14, 9.6, u, 'olivia', 'gb');
        });
        notePanel(g, RX, 150, RW, '휴대폰 · 번호', [
          ['cell phone', '휴대폰 (미국 · 캐나다)', COL.clause],
          ['mobile', '휴대폰 (영국 · 호주)', COL.clause],
          ['handphone (×)', '한국에서 만든 말이라 영어권에서는 안 써요', COL.trap, [], null],
        ], { u, at: 2.6, step: 1.0 });
      });
      // [11, 17] 번호 읽기: 하나씩 · 0은 oh · 쉼
      if (u >= 10.8 && u < 17.4) fade(g, ramp(u, 11.0, 0.4) * (1 - ramp(u, 17.0, 0.4)), () => {
        label(g, '번호는 숫자를 하나씩 · 0은 oh', LX, 160, { color: COL.accent, size: 16 });
        digitRow(g, LX, 196, '0139', u, 11.4);
        fade(g, ramp(u, 13.4, 0.4), () => {
          const t = PN.phoneWords(PN.phoneText('0139'));
          txt(g, t, LX, 352, { size: 26, weight: 700, color: COL.en });
          say(LX - 6, 330, 700, 44, t);
        });
        fade(g, ramp(u, 14.6, 0.4), () => {
          txt(g, '× 555-0193 → 끝 두 자리가 바뀌면 다른 번호예요', LX, 410, { size: 19, weight: 700, color: COL.trap });
          txt(g, '× zero-one-three-nine → 전화번호의 0은 보통 oh', LX, 446, { size: 19, weight: 700, color: COL.trap });
        });
        phoneRead(g, RX, 150, RW, { ph: '0139', trap: u >= 14.6 ? '0193' : null, p: ramp(u, 11.6, 0.6) });
      });
      // [17, 22.5] 빠른 말
      if (u >= 16.8 && u < 22.9) fade(g, ramp(u, 17.0, 0.4) * (1 - ramp(u, 22.5, 0.4)), () => {
        const [qf, guess, rp] = SC.nbfast;
        const r = exch(g, u, { q: qf, at: 17.2, aAt: 18.2, bad: guess, ok: rp, mAt: 19.8, tag: '빠른 말을 짐작했어요', tagY: 78 });
        say2(g, "Yes — what's the best number to reach you?", r.y + 14, 21.2, u, 'olivia', 'gb', [['best number', 'slot']]);
        notePanel(g, RX, 150, RW, '빠른 말 · 영국식', [
          ["th' best number t' reach ya", '= the best number to reach you', COL.soft],
          ['Sorry, did you ask for my phone number?', '들린 만큼 되묻기', COL.verb],
        ], { u, at: 17.8, step: 1.2 });
      });
      // [22.5, 36] 잘못 되짚은 번호 바로잡기
      if (u >= 22.3) fade(g, ramp(u, 22.5, 0.4), () => {
        const [qid, yes, , wasnt, ok] = SC.pcheck, no = SC.pcheck[2];
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 22.7, u, roleAt: 23.3, size: 22, shapeAt: 23.5 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 24.2, 28.0, '틀렸는데 Yes → 다른 번호로 전화가 와요'], [wasnt, 28.0, 30.6, 'Is로 물었는데 it wasn\'t → 짝이 어긋나요'], [no, 30.6, 32.6, 'No만 → 맞는 번호를 몰라요']]);
        if (u >= 32.4) fade(g, ramp(u, 32.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 32.8, u, size: 23, verdict: { ok: okOn(qid, ok), at: 33.4 } });
          say2(g, PN.reply(PN.Q[qid], ok, D), y + A.bh + 14, 34.2, u, 'olivia', 'gb');
        });
        phoneRead(g, RX, 150, RW, { ph: '0139', trap: '0193', title: '내 번호 ↔ 상대가 되짚은 번호' });
        fade(g, ramp(u, 28.0, 0.4), () => auxTable(g, RX, 404, RW, { hl: 'is', no: true }));
      });
    },

    /* 08 걸려 온 전화: Who are you? × · No × → Yes, speaking ✓ → 끊긴 말 → 준비물 되짚기 → 끝인사 */
    call(g, u) {
      if (S.card) {
        const s = S.card, C = Object.assign({}, D, { given: s.given, lvl: s.lvl, item: s.item }), first = PN.LEVELS[s.lvl].first, b = `${s.item}.${first}`;
        const r = exch(g, 99, { q: PN.simQ('cb_hi', C), at: -9, ok: OT('cb_sp'), card: C, y: 150, qo: { all: true } });
        const A = { ok: OT('br_so', b), day: OT('br_so', `${s.item}.${PN.dayTrap(first)}`), skip: OT('br_ok') }[s.a] || OT('br_so', b);
        pickView(g, PN.simQ('cb_bring', C), A, C, r.y + 20);
        bringCard(g, RX, 150, RW, { b, trap: s.a === 'day' ? PN.dayTrap(first) : null });
        return;
      }
      const SC = PN.SCENE;
      // [0.4, 11.5] 전화 받기
      if (u < 11.9) fade(g, 1 - ramp(u, 11.5, 0.4), () => {
        const [qid, who, no, is, sp] = SC.hi, q = PN.simQ(qid, D);
        const B = staff(g, q, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[who, 2.6, 5.8, '누구냐고 다짜고짜 → 퉁명스러워요'], [no, 5.8, 7.6, 'No → 찾는 사람이 아니라는 뜻이에요']]);
        if (u >= 7.6) fade(g, ramp(u, 7.8, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: sp, at: 8.0, u, size: 23, verdict: { ok: okOn(q, sp), at: 8.6 } });
          fade(g, ramp(u, 9.4, 0.4), () => answer(g, { x: LX, y: y + A.bh + 14, w: 780, A: is, at: 9.6, u, size: 20, edge: 'rgba(242,194,154,0.25)', verdict: { ok: okOn(q, is), at: 10.2 }, tag: ['Is로 물었으니 짝 맞는 대답도 좋아요', COL.muted, 10.4], tagY: y + A.bh + 14 + 74 }));
        });
        phoneScreen(g, RX + 20, 150, RW - 40, { name: PN.CENTER, num: '555-0172', sub: 'Matt Diaz', incoming: u < 2.4, sec: secOf(u, 2.4), live: u >= 0.8 && u < 3.6, sp: 'au', label: u < 2.4 ? 'INCOMING CALL' : 'CONNECTED' });
      });
      // [11.5, 17] 끊긴 말 → 다시 묻기
      if (u >= 11.3 && u < 17.4) fade(g, ramp(u, 11.5, 0.4) * (1 - ramp(u, 17.0, 0.4)), () => {
        const [qid, guess, rp] = SC.cut;
        exch(g, u, { q: qid, at: 11.7, aAt: 13.0, bad: guess, ok: rp, mAt: 14.6, tag: '끊긴 말을 짐작했어요', tagY: 78 });
        notePanel(g, RX, 150, RW, '소리가 끊길 때', [
          ["Sorry, you're breaking up.", '소리가 끊겨요', COL.verb],
          ['Could you say that again?', '다시 말씀해 주시겠어요?', COL.verb],
          ['The line is bad.', '연결 상태가 나빠요', COL.soft],
        ], { u, at: 12.2, step: 0.9 });
      });
      // [17, 29] 준비물 · 첫 수업 요일 되짚기
      if (u >= 16.8 && u < 29.4) fade(g, ramp(u, 17.0, 0.4) * (1 - ramp(u, 29.0, 0.4)), () => {
        const [qid, okay, thu, ok] = SC.bring, q = PN.simQ(qid, D);
        const B = staff(g, q, { x: LX, y: 150, w: 780, at: 17.2, u, roleAt: 17.8, size: 22, shapeAt: 18.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[okay, 18.8, 21.6, '되짚지 않으면 준비물과 요일을 확인하지 못해요'], [thu, 21.6, 24.4, '목요일 → 같은 반의 다른 요일']]);
        if (u >= 24.2) fade(g, ramp(u, 24.4, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 24.6, u, size: 23, maxW: 660, verdict: { ok: okOn(q, ok), at: 25.2 } });
          say2(g, PN.reply(q, ok, D), y + A.bh + 14, 26.0, u, 'coach', 'au');
        });
        bringCard(g, RX, 150, RW, { b: 'gog.tue', trap: u >= 21.6 && u < 24.6 ? 'thu' : null, p: ramp(u, 17.6, 1.2) });
      });
      // [29, 38] 끝인사
      if (u >= 28.8) fade(g, ramp(u, 29.0, 0.4), () => {
        const [qid, yes, plain, ok] = SC.end;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 29.2, u, roleAt: 29.8, size: 22, shapeAt: 30.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 30.4, 32.4, 'Yes만 → 물어볼 것을 기다려요'], [plain, 32.4, 34.4, '고맙다는 말 없이 끊으면 퉁명스러워요']]);
        if (u >= 34.2) fade(g, ramp(u, 34.4, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 34.6, u, size: 23, maxW: 660, verdict: { ok: okOn(qid, ok), at: 35.2 } });
          say2(g, PN.reply(PN.Q[qid], ok, D), y + A.bh + 14, 36.0, u, 'coach', 'au');
        });
        notePanel(g, RX, 150, RW, '전화를 끝낼 때', [
          ["No, that's all.", '아니요, 그게 다예요', COL.clause],
          ['Thanks for calling back.', '다시 전화 주셔서 고마워요', COL.verb],
          ['Bye! · Have a good day!', '끝인사', COL.verb],
        ], { u, at: 33.0, step: 0.8 });
      });
    },

    /* 09 3단계 말하기 법 */
    method(g, u) {
      const BOX = [['①', '열쇠 낱말 + 모양', 'or → 고르기 · What · How → 정보 · Is this · Was that → Y/N', COL.ante, 5.5], ['②', '틀에 내 정보 넣기', '철자는 as in · 번호는 하나씩 · So, 8:15? (되짚기)', COL.rel, 11.5], ['③', '공손하게 끝내기', 'Could you …? · Thanks for calling back.', COL.verb, 17.5]];
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
      PN.METHOD.forEach(([qid, a], i) => {
        const y = 300 + i * 39, q = PN.simQ(qid, D), p = PN.PLACE[q.place], dim = sel != null && sel !== i;
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
            say(594, y - 16, 606, 32, PN.text(a));
          });
        });
      });
    },

    /* 10 실전: 내 카드 하나로 넷 */
    practice(g, u) {
      const pi = u < PSEG[1] ? 0 : u < PSEG[2] ? 1 : u < PSEG[3] ? 2 : 3, v = u - PSEG[pi];
      const P = PN.PRACTICE[pi], C = PN.PCARD, q = PN.practiceQ(P);
      const a = ramp(v, 0, 0.5) * (pi < 3 ? 1 - ramp(u, PSEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `대화 ${pi + 1} / 4 · ${PN.PLACE[q.place].ko}`, LX, 150, { size: 16, weight: 500, fam: FM, color: COL.accent });
        myCard(g, LX, 168, 336, C, { rh: 30, vs: 13.5, rows: PROWS, hl: { bk_meal: 0, tm_offer: 0, ms_go: 2, nb_check: 3 }[P.q] });
        talk(g, { side: 'L', x: 432, y: 172, w: 768, text: q.en, marks: Qm(q), kind: kindOf(q), sp: q.sp, at: PT.q, u: v, roleAt: PT.lines[0] + 0.4, size: q.en.length > 80 ? 19 : 22, shape: q.shape, shapeAt: PT.lines[0] + 0.4 });
        const J = P.opts.map(o => PN.judge(q, o, C));
        const goneAt = k => { const s = J[k].stage; if (!s) return null; const same = P.opts.map((_, i) => i).filter(i => J[i].stage === s); return [0, PT.s1, PT.s2, PT.s3][s] + same.indexOf(k) * 1.1; };
        const longs = P.opts.some(o => PN.text(o).length > 90), oy0 = q.en.length > 80 ? 300 : longs ? 272 : 262, gap = longs ? 64 : q.en.length > 80 ? 52 : 60;
        P.opts.forEach((o, k) => {
          const y = oy0 + k * gap, gA = goneAt(k), won = k === P.a && v >= PT.win;
          fade(g, ramp(v, PT.opt[k], 0.4), () => {
            const isLine = o.f === 'line' || PN.text(o).length > 52, hh = isLine ? (longs ? 60 : 54) : 48;
            if (won) { rr(g, 432, y - hh / 2, 768, hh, 10); g.fillStyle = 'rgba(127,224,168,0.08)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
            const gone = gA != null && v >= gA, rolesOn = v >= PT.lines[1] + 0.4 || won;
            txt(g, `(${'ABC'[k]})`, 446, y, { size: 18, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
            let w;
            if (isLine) { const R = wrapAns(g, o, 494, y, longs ? 15.5 : 17, longs ? 650 : 590, { dim: gone, plain: !rolesOn }); w = R.w; }
            else w = pieces(g, ansParts(o).map(([t, r]) => [t, gone ? 'dim' : rolesOn ? r : '']), 494, y, 19, 560, { color: gone ? COL.dim : COL.text });
            say(490, y - hh / 2, w + 10, hh, PN.text(o));
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
        ['book', '예약 전화', 'bk_help', 'How can I help you? · lunch or dinner', [["Hi, I'd like to make a reservation for ", 'frame'], ['Friday', 'slot'], [', ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        ['time', '시간 맞추기', 'tm_full', 'fully booked · We have a table at 8:15', [['Do you have', 'pol'], [' anything ', 'frame'], ['later', 'slot'], ['? · So, ', 'frame'], ['8:15', 'slot'], ['?', 'frame']], 'Do you have anything later? So, eight-fifteen?'],
        ['name', '이름 철자', 'nm_check', 'spell · Was that M as in Mary?', [["It's ", 'frame'], ['H-A-N', 'slot'], [', ', 'frame'], ['N as in Nancy', 'slot'], ['. · No, ', 'frame'], ['N as in Nancy', 'slot'], ['.', 'frame']], "It's H, A, N, N as in Nancy. No, N as in Nancy."],
        ['ask', '문의 전화', 'as_help', 'How can I help you? · beginner or intermediate', [["Hi, I'm calling to ask about your ", 'frame'], ['swimming lessons', 'slot'], ['.', 'frame']]],
        ['msg', '메시지 남기기', 'ms_go', 'leave a message · Go ahead', [['This is ', 'frame'], ['Jiwoo Han', 'slot'], ['. … ', 'frame'], ['Could you', 'pol'], [' ask him to call me back at ', 'frame'], ['555-0139', 'slot'], ['?', 'frame']], "This is Jiwoo Han. I'm calling about the beginner swimming class. Could you ask him to call me back at five-five-five, oh-one-three-nine?"],
        ['number', '전화번호', 'nb_check', "best number · Is that right?", [["No, it isn't. It's ", 'frame'], ['555-0139', 'slot'], ['.', 'frame']], "No, it isn't. It's five-five-five, oh-one-three-nine."],
        ['call', '걸려 온 전화', 'cb_hi', 'Is this Jiwoo? · anything else', [['Yes, speaking.', 'frame'], [" … No, that's all. ", 'frame'], ['Thanks', 'pol'], [' for calling back. ', 'frame'], ['Bye', 'pol'], ['!', 'frame']], "Yes, speaking. No, that's all. Thanks for calling back. Bye!"],
        [null, '숫자 읽기', null, '시각 · 번호 · 값', [['8:15 = ', 'frame'], ['eight-fifTEEN', 'slot'], [' · 0139 = ', 'frame'], ['oh-one-three-nine', 'slot'], [' · $40 = ', 'frame'], ['FORty', 'slot']], 'eight-fifteen. oh-one-three-nine. forty dollars.'],
        [null, '못 알아들었을 때', null, '빠른 말 · 끊긴 말', [['Sorry', 'pol'], [', what time was that? · ', 'frame'], ['Sorry', 'pol'], [", you're breaking up.", 'frame']]],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 10, { fill: COL.panel, stroke: COL.faint });
        ['곳', '열쇠 낱말 · 모양', '대답 틀'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 16, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 6, 1120, 1);
      });
      rows.forEach(([pid, nm, qid, keys, ans, sayT], ri) => fade(g, ramp(u, 1.0 + ri * 0.4, 0.5), () => {
        const y = Y0 + RH * (ri + 1) + 14, sh = qid ? PN.Q[qid].shape : null;
        circ(g, X[0] + 32, y, 15, COL.panel2);
        if (pid) icon(g, pid, X[0] + 32, y, 18, ME_FIRST[pid] ? COL.verb : COL.soft);
        else txt(g, ri === 7 ? '15' : '?', X[0] + 32, y + 1, { size: ri === 7 ? 13 : 18, weight: 800, fam: ri === 7 ? FM : FB, color: COL.verb, align: 'center' });
        txt(g, nm, X[0] + 58, y, { size: fit(g, nm, 18, X[1] - X[0] - 70, 700), weight: 700 });
        if (sh) shapeMark(g, sh, X[1] + 26, y, 15, { disc: false, iw: 2.2 });
        txt(g, keys, X[1] + (sh ? 44 : 20), y, { size: fit(g, keys, 15, X[2] - X[1] - (sh ? 56 : 34), 600), weight: 600, color: COL.ante });
        const w = pieces(g, ans, X[2] + 20, y, 16.5, 1196 - X[2] - 30);
        say(X[2] + 16, y - 18, w + 8, 36, sayT || ans.map(p => p[0]).join(''));
      }));
    },
  };
  // 실전 장면의 내 카드 줄 (PN.PCARD와 같은 사실)
  const PC = PN.PCARD;
  const PROWS = [
    ['식당 예약', `${PN.DAYS[PC.day].ko} ${PN.MEALS[PC.meal].ko} · ${PN.PPL[PC.ppl].ko} · ${PC.want}시가 다 찼으면 ${PN.ALTS[PC.alt].ko}도 괜찮아요`],
    ['예약자 이름', `${PN.fullKo(PC)} (${PN.fullName(PC)}) · ${PN.NAMES[PC.sur].spell}`],
    ['수영 강습', `${PN.LEVELS[PC.lvl].ko} 반(${PN.LEVELS[PC.lvl].t}) · 코치가 없으면 메시지`],
    ['내 번호', `${PN.phoneText(PC.phone)} · 다시 전화해 달라고 부탁해요`],
  ];
  PNS.PROWS = PROWS;

  // 이어서 들리는 말: 위 = 쓰인 낱말 (이어지는 곳은 호), 아래 = 들리는 소리 (세게 = 크고 높게)
  function linked(g, L, x, y, u, at, maxW) {
    fade(g, ramp(u, at, 0.4), () => {
      const size = 28, gap = 22; let xx = x; const pos = [];
      L.words.forEach(w => { const ww = tw(g, w, size, 600); pos.push([xx, ww]); xx += ww + gap; });
      L.words.forEach((w, i) => { txt(g, w, pos[i][0], y, { size, weight: 600, color: COL.en }); });
      listen(x - 6, y - 24, xx - x, 48, [{ text: L.say || L.en, sp: PN.Q[L.q] ? PN.Q[L.q].sp : 'us', rate: 1.2 }]);
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
  PNS.linked = linked;

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

  PNS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[PNS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    if (ch.place != null) strip(g, ch.place, ramp(u, 0.2, 0.5));
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, PNS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + PN.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔↗↘✓✕×÷?!~=+-–—/:…‘’\'%$&<>|•☎';
  PNS.baseText = EXTRA;
  PNS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = PNS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { PNS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
