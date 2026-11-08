(function () {
  'use strict';
  const PH = window.PH;
  const PHS = (window.PHS = {});
  const W = 1280, H = 720;
  PHS.W = W; PHS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  PHS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', paper: '#F4F1E8', ink: '#1E2630', teal: '#2F4A44', wood: '#3A2E25', red: '#B8432B',
  };
  PHS.COL = COL;
  // 역할 → 색 (낱말 조각 · 말풍선 글)
  const RC = { key: COL.ante, frame: COL.rel, slot: COL.clause, pol: COL.verb, trap: COL.trap, ok: COL.good, dim: COL.dim, bad: COL.bad };
  PHS.RC = RC;
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8', me: '#F2C29A' };
  const SHC = { yn: COL.ante, or: COL.rel, wh: COL.clause, note: COL.verb };   // 모양 표시의 색
  PHS.SHC = SHC;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (PHS.S = { stop: null, place: null, shape: null, need: null, aux: null, line: null, front: null, prob: null, exam: null, plan: null });
  PHS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  PHS.hits = () => HITS;

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
     곳 일곱(counter · ask · dose · front · doctor · exam · plan) + 질문의 모양 넷(shape_yn 스위치 · shape_or 갈림길 · shape_wh 빈 상자 · shape_note 말풍선) + 그 밖의 그림
     ========================================================= */
  const ICON = {
    counter: [['M3.5 20.5h17', 's'], ['M5 20.5V9.5h14v11', 's'], ['M3.5 9.5l2-5h13l2 5', 's'], ['M12 12v6M9 15h6', 's']],
    ask: [['M4.5 5h15v10h-8l-4 3.8V15h-3z', 's'], ['M10.2 8.4a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.3', 's'], ['M12 13h.01', 's']],
    dose: [['M6.9 17.1a3.6 3.6 0 0 1 0-5.1l5.1-5.1a3.6 3.6 0 0 1 5.1 5.1l-5.1 5.1a3.6 3.6 0 0 1-5.1 0z', 's'], ['M9.45 9.45l5.1 5.1', 's']],
    front: [['M6.5 5h11v15.5h-11z', 's'], ['M9.5 3.5h5v3h-5z', 's'], ['M9 10.5h6M9 13.5h6M9 16.5h3.5', 's']],
    doctor: [['M6.5 3.5v4.5a3.5 3.5 0 0 0 7 0V3.5', 's'], ['M10 11.5v3a4.5 4.5 0 0 0 9 0v-2.2', 's'], ['M17.2 10.5a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0z', 's']],
    exam: [['M10 14.2V5.5a2 2 0 0 1 4 0v8.7a3.6 3.6 0 1 1-4 0z', 's'], ['M12 9v7.5', 's']],
    plan: [['M6 3.5h12v17H6z', 's'], ['M9 13.5V7.5h2.6a1.6 1.6 0 0 1 0 3.2H9', 's'], ['M10.8 10.7l3.4 3.8M14.2 10.7l-3.4 3.8', 's'], ['M9 17h6', 's']],
    shape_yn: [['M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8z', 's'], ['M14.4 12a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0z', 'f']],
    shape_or: [['M12 21.5V14', 's'], ['M12 14 6 8M12 14l6-6', 's'], ['M6 8v4.4M6 8h4.4', 's'], ['M18 8v4.4M18 8h-4.4', 's']],
    shape_wh: [['M3.5 6.5h17v11h-17z', 's'], ['M8 14h8', 's']],
    shape_note: [['M4.5 5h15v10h-8l-4 3.8V15h-3z', 's'], ['M9 10h.01M12 10h.01M15 10h.01', 's']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z', 's'], ['M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6', 's']],
    hand: [['M8.5 20.5c-2-1.6-3.5-4-3.5-6.5v-2.5a1.3 1.3 0 0 1 2.6 0V13', 's'], ['M7.6 12.5V6a1.3 1.3 0 0 1 2.6 0v5.5M10.2 11V4.5a1.3 1.3 0 0 1 2.6 0V11M12.8 11V5.5a1.3 1.3 0 0 1 2.6 0V12M15.4 12V8a1.3 1.3 0 0 1 2.6 0v6c0 3.5-2 6.5-5.5 6.5h-4', 's']],
    clock: [['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', 's'], ['M12 7.5V12l3 2', 's']],
    people: [['M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM3.5 20a5.5 5.5 0 0 1 11 0', 's'], ['M16 11a2.6 2.6 0 1 0 0-5.2M15.5 14.2a5 5 0 0 1 5 5.3', 's']],
    card: [['M3.5 6h17v12h-17z', 's'], ['M3.5 10h17', 's'], ['M6.5 14.5h4', 's']],
    cash: [['M3 7h18v10H3z', 's'], ['M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0z', 's'], ['M6 10v4M18 10v4', 's']],
    receipt: [['M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z', 's'], ['M9 8h6M9 11.5h6M9 15h4', 's']],
    meal: [['M6.5 3.5v5a2.2 2.2 0 0 0 4.4 0v-5', 's'], ['M8.7 3.5v17', 's'], ['M17.5 3.5c-1.9 1.4-2.8 4-2.8 7.6h2.8v9.4', 's']],
    moon: [['M16 4a7.8 7.8 0 1 0 4.3 13.6A6.4 6.4 0 0 1 16 4z', 's']],
    note: [['M6 3.5h9l3 3v14H6z', 's'], ['M15 3.5v3h3', 's'], ['M9 11h6M9 14h6M9 17h4', 's']],
    cal: [['M4 6h16v14.5H4z', 's'], ['M4 10.5h16', 's'], ['M8.5 4v4M15.5 4v4', 's']],
    bottle: [['M9.5 3.5h5v3h-5z', 's'], ['M8.5 6.5h7a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19V8a1.5 1.5 0 0 1 1.5-1.5z', 's'], ['M7 11h10M7 16h10', 's']],
    pill: [['M4.5 12a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0-15 0z', 's'], ['M6.7 17.3 17.3 6.7', 's']],
    sick: [['M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17z', 's'], ['M8.6 10h.01M15.4 10h.01', 's'], ['M8.8 16c1.8-1.5 4.6-1.5 6.4 0', 's']],
  };
  PHS.ICON = ICON;

  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = (typeof Path2D === 'function' ? new Path2D(d) : null));
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const parts = ICON[id]; if (!parts) return;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach(([d, m]) => { const p = path(d); if (!p) return; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  PHS.icon = icon;
  // HTML용 SVG (색은 currentColor)
  PHS.iconSVG = (id, cls = '', fill) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : m === 'b' && fill ? `<path d="${d}" fill="${fill}"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 질문의 모양 표시: 그림 + 이름 (영상 · 직접 해 보기 · 힌트 · 퀴즈) ---------- */
  function shapeMark(g, shape, cx, cy, size, o = {}) {
    const c = o.color || SHC[shape];
    if (o.disc !== false) { circ(g, cx, cy, size * 0.72, o.fill || COL.panel2); ring(g, cx, cy, size * 0.72, c, o.lw || 2); }
    icon(g, 'shape_' + shape, cx, cy, size, c, o.iw || 2);
  }
  PHS.shapeMark = shapeMark;
  function shapeTag(g, shape, x, y, o = {}) {
    const Sx = PH.SHAPE[shape], t = o.text || `${Sx.ko} → ${Sx.ans}`, size = o.size || 16, h = o.h || 36, c = SHC[shape];
    const w = tw(g, t, size, 700) + h + 22, x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    rr(g, x0, y - h / 2, w, h, 10); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = c; g.lineWidth = 1.6; g.stroke();
    icon(g, 'shape_' + shape, x0 + h / 2 + 4, y, h * 0.62, c, 2);
    txt(g, t, x0 + h + 8, y + 1, { size, weight: 700, color: c });
    return { x: x0, y: y - h / 2, w, h };
  }
  PHS.shapeTag = shapeTag;

  /* ---------- 사람 얼굴 (말풍선 옆). kind: pharm(약사 · 미국) · chemist(약사 · 호주) · recep(병원 접수 직원 · 영국) · doctor(의사 · 캐나다) · me ---------- */
  const LOOK = {
    pharm: { shirt: '#3A5A7A', coat: '#F4F6F8', hair: '#3A2A20', skin: '#E3B48D', badge: '#6EC8FF' },
    chemist: { shirt: '#2E6A55', coat: '#F4F6F8', hair: '#8A5A30', skin: '#E8BC95', glasses: true, badge: '#FFC15E' },
    recep: { shirt: '#5A3A6A', hair: '#5A3A28', skin: '#E8BC95', lanyard: '#C9A7FF', long: true },
    doctor: { shirt: '#2F5A7A', coat: '#F4F6F8', steth: '#3A4450', hair: '#2B2420', skin: '#C99169', long: true },
    me: { shirt: '#5D6FA8', hair: '#1F1B18', skin: '#E8BC95', scarf: '#7FA8C9', long: true },
  };
  PHS.LOOK = LOOK;
  const kindOf = q => { q = typeof q === 'string' ? PH.Q[q] : q; return q.sp === 'ca' ? 'doctor' : q.sp === 'au' ? 'chemist' : q.sp === 'gb' ? 'recep' : 'pharm'; };
  PHS.kindOf = kindOf;
  function avatar(g, x, y, r, kind, o = {}) {
    const L = LOOK[kind] || LOOK.pharm;
    circ(g, x, y, r, COL.panel2);
    g.save(); g.beginPath(); g.arc(x, y, r - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = L.shirt; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
    if (L.coat) {   // 흰 가운: 몸 전체 + 가운데 셔츠 V
      g.fillStyle = L.coat; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = L.shirt; g.beginPath(); g.moveTo(x - r * 0.2, y + r * 0.42); g.lineTo(x + r * 0.2, y + r * 0.42); g.lineTo(x, y + r * 0.95); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(30,38,48,0.35)'; g.lineWidth = Math.max(1, r * 0.04); g.beginPath(); g.moveTo(x - r * 0.2, y + r * 0.42); g.lineTo(x - r * 0.04, y + r); g.moveTo(x + r * 0.2, y + r * 0.42); g.lineTo(x + r * 0.04, y + r); g.stroke();
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
  PHS.avatar = avatar;



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
  PHS.richLay = richLay; PHS.richDraw = richDraw;

  /* ---------- 낱말 조각 (대답 만들기): { id, t, r } → lay · morph · drawTok ---------- */
  const PUNCT = /^[.,?!]$/;
  function ansToks(a, o = {}) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    PH.segs(a).forEach(s => s.t.split(/\s+/).forEach(w => {
      if (!w) return;
      const m = w.match(/^(.*?)([.,?!]*)$/);
      if (m[1]) push(m[1], o.role != null ? o.role : s.r);
      if (m[2]) m[2].split('').forEach(p => push(p, ''));
    }));
    return out;
  }
  PHS.ansToks = ansToks;
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
      avatar(g, ax, ay, ar, o.kind || (side === 'L' ? 'pharm' : 'me'), { live, sp: o.sp });
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
  PHS.talk = talk;
  // 직원의 말 (말 id로): 말풍선 + 열쇠 낱말 (+ 모양 표시)
  const Qobj = q => typeof q === 'string' ? PH.Q[q] : q;
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
    const said = LB && p > 0.5 ? (o.sayB || (o.B ? PH.text(o.B) : null)) : (o.sayA || (o.A ? PH.text(o.A) : null));
    if (!o.noHit && said) listen(bx, by, bw, bh, [{ text: said, sp: 'me' }]);
    return out;
  }
  PHS.answer = answer;
  const okOf = (q, a, c) => PH.judge(q, a, c || PH.DEMO).ok;

  /* ---------- 약국 · 병원 길 띠 (02–08장 위쪽) ---------- */
  function strip(g, cur, a = 1) {
    fade(g, a, () => {
      const x0 = 812, dx = 64, y = 92;
      g.strokeStyle = COL.faint; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 6, y); g.stroke();
      PH.PLACES.forEach((p, i) => {
        const x = x0 + i * dx, on = i === cur;
        circ(g, x, y, on ? 19 : 14, on ? COL.accent : i < cur ? '#2A3542' : COL.panel);
        ring(g, x, y, on ? 19 : 14, on ? COL.accent : PH.ME_FIRST[p.id] ? 'rgba(201,167,255,0.6)' : COL.faint, 1.5);
        icon(g, p.id, x, y, on ? 22 : 16, on ? '#1D1305' : i < cur ? COL.soft : COL.muted, on ? 2 : 1.8);
      });
      txt(g, `${cur + 1} / 7`, x0 + dx * 6 + 30, y, { size: 13, weight: 500, fam: FM, color: COL.muted });
    });
  }


  /* =========================================================
     약국 · 병원 그림: 종이 서류(약 봉투 라벨 · 접수 서류 · 진료 메모) · 하루 시간표 · 약 상자 · 몸 · 아픈 정도 · 달력 · 진단서 · 환자 카드
     복용법 · 시간표 · 모두 몇 알인지는 grammar.js(PH.schedule · PH.total)로 계산해요
     ========================================================= */
  const pad2 = n => String(n).padStart(2, '0');
  const mmdd = v => { const D = PH.ymd(v); return D ? `${pad2(D.m)}/${pad2(D.d)}/${D.y}` : String(v); };
  PHS.mmdd = mmdd;
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
  PHS.paper = paper;

  // 약 봉투 라벨: 복용법 넷 (양 · 하루 몇 번 · 언제 · 며칠). o: { rx, name, hl, alt }
  function medLabel(g, x, y, w, D, o = {}) {
    const rows = [['AMOUNT', PH.AMT[D.amt].t, 'amt'], ['HOW OFTEN', PH.FREQ[D.freq].t, 'freq'], ['WHEN', D.time ? PH.WHEN[D.time].t : '—', 'time'], ['HOW LONG', PH.LEN[D.len].t.replace(/^for /, ''), 'len']];
    return paper(g, x, y, w, rows, { title: o.rx ? `${PH.CLINIC.toUpperCase()} · Rx` : PH.PHARMACY.toUpperCase(), icon: o.rx ? 'plan' : 'dose', sub: o.name, hl: o.hl, rh: 32, vx: 112, mono: false, ink: COL.ink, head: o.rx ? '#3A4F7A' : COL.teal });
  }
  PHS.medLabel = medLabel;
  const medName = (sym, form) => { const M = PH.MEDS[PH.SYM[sym].med]; return `${M.en.toUpperCase()} · ${form === 'liquid' ? 'LIQUID' : 'TABLETS'}`; };
  const rxName = (sym, allergy) => { const R = PH.safeRx(sym, allergy || null); return R.en.replace(/^(some|a) /, '').toUpperCase(); };

  // 하루 시간표: 식사(포크) · 잠(달) · 약 먹는 때(초록 알약). o: { p(나타나기 0~1), wrong(틀린 복용법 → 주황 점선), title, h, sum }
  function doseDay(g, x, y, w, D, o = {}) {
    const h = o.h || 134, x0 = x + 28, x1 = x + w - 24, ax = hr => x0 + (hr - 6) / 18 * (x1 - x0), ay = y + 72;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, o.title || 'ONE DAY · 하루 시간표', x + 16, y + 20, { size: 12, weight: 700, fam: FM, color: COL.muted });
    g.strokeStyle = COL.line; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, ay); g.lineTo(x1, ay); g.stroke();
    [6, 12, 18, 24].forEach(hr => { const xx = ax(hr); g.fillStyle = COL.line; g.fillRect(xx - 1, ay - 5, 2, 10); txt(g, `${hr}:00`, xx, ay + 22, { size: 11, weight: 600, fam: FM, color: COL.dim, align: 'center' }); });
    PH.MEALS.forEach(hr => icon(g, 'meal', ax(hr), ay - 27, 18, COL.muted, 1.7));
    icon(g, 'moon', ax(PH.BED), ay - 27, 17, COL.muted, 1.7);
    const sch = PH.schedule(D), p = o.p == null ? 1 : o.p;
    const diff = o.wrong ? (ws => ws.filter(hr => !sch.includes(hr)).concat(sch.filter(hr => !ws.includes(hr))))(PH.schedule(o.wrong)) : [];
    sch.forEach((hr, k) => fade(g, clamp(p * sch.length - k), () => { circ(g, ax(hr), ay, 10, COL.clause); icon(g, 'pill', ax(hr), ay, 13, '#10261C', 2); }));
    diff.forEach(hr => ring(g, ax(hr), ay, 16, COL.trap, 2.6, [4, 3]));
    if (o.sum !== false) {
      const A = PH.AMT[D.amt], per = sch.length, days = PH.LEN[D.len].days, tot = PH.total(D), unit = A.unit === 'ml' ? 'ml' : A.unit === 'capsule' ? '캡슐' : '알';
      const s = A.unit === 'ml' ? `${A.n}ml × 하루 ${per}번 × ${days}일 = ${tot}ml` : `${A.n}${unit} × 하루 ${per}번 × ${days}일 = 모두 ${tot}${unit}`;
      fade(g, clamp(p * 1.6 - 0.6), () => txt(g, s, x + w / 2, y + h - 17, { size: fit(g, s, 14, w - 30, 700), weight: 700, color: COL.soft, align: 'center' }));
    }
    return { h };
  }
  PHS.doseDay = doseDay;

  // 약 상자 (앞면). o: { name, form, drowsy }
  function medPack(g, x, y, w, o = {}) {
    const h = Math.round(w * 0.64);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 14; g.shadowOffsetY = 5; rr(g, x, y, w, h, 10); g.fillStyle = '#EAF2F7'; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 10); g.clip(); g.fillStyle = '#2F6FA8'; g.fillRect(x, y + h * 0.56, w, h * 0.44); g.restore();
    circ(g, x + 34, y + 34, 18, '#D9534F'); g.fillStyle = '#FFFFFF'; g.fillRect(x + 31, y + 23, 6, 22); g.fillRect(x + 23, y + 31, 22, 6);
    txt(g, o.name || 'COLD RELIEF', x + 62, y + 30, { size: fit(g, o.name || 'COLD RELIEF', 18, w - 76, 800, 10, FM), weight: 800, fam: FM, color: COL.ink });
    txt(g, o.form || '20 TABLETS', x + 62, y + 52, { size: 12, weight: 700, fam: FM, color: '#5B6168' });
    icon(g, o.liquid ? 'bottle' : 'pill', x + w - 34, y + h * 0.78, 28, '#FFFFFF', 2);
    txt(g, 'FOR EXAMPLE ONLY', x + 16, y + h * 0.78, { size: 11, weight: 700, fam: FM, color: '#CFE0EE' });
    if (o.drowsy) {
      g.save(); g.translate(x + w - 92, y + 64); g.rotate(-0.06);
      rr(g, -40, 0, 128, 40, 6); g.fillStyle = '#F2D45A'; g.fill(); g.strokeStyle = '#8A6A10'; g.lineWidth = 1.5; g.stroke();
      txt(g, 'MAY CAUSE', 24, 13, { size: 10.5, weight: 800, fam: FM, color: '#3A2A05', align: 'center' });
      txt(g, 'DROWSINESS', 24, 28, { size: 11.5, weight: 800, fam: FM, color: '#3A2A05', align: 'center' });
      g.restore();
    }
    return { h };
  }
  PHS.medPack = medPack;

  // 접수 서류 (NEW PATIENT FORM). c: { appt, first, name, dob, ins } · o: { show, hl }
  function patientForm(g, x, y, w, c, o = {}) {
    const rows = [['APPOINTMENT', c.appt ? 'YES' : 'NO · WALK-IN', 'appt'], ['FIRST VISIT', c.first === false ? 'NO' : 'YES', 'first'],
      ['LAST NAME', PH.NAMES[c.name || 'kim'].t.toUpperCase(), 'name'], ['DATE OF BIRTH', mmdd(c.dob || '2005-03-04'), 'dob'],
      ['INSURANCE', (PH.SLOT.ins.vals[c.ins || 'travel'] || { t: '' }).t.replace(/ insurance$/, '').toUpperCase(), 'ins']];
    const r = paper(g, x, y, w, rows, { title: `NEW PATIENT FORM · ${PH.CLINIC.toUpperCase()}`, icon: 'front', show: o.show, hl: o.hl, rh: 38, vx: 134, head: '#5A3A6A' });
    if (o.fmt) fade(g, o.fmt, () => txt(g, 'MM/DD/YYYY', x + w - 16, y + 54 + 3 * 38 + 19, { size: 10.5, weight: 700, fam: FM, color: '#B8432B', align: 'right' }));
    return r;
  }
  PHS.patientForm = patientForm;

  // 몸 (머리 · 귀 · 목 · 가슴 · 배). o: { hl: 아픈 곳, letters: { 곳: 'A' }, press: 곳 }
  const BODY = { ear: [0.31, -0.9], throat: [0, -0.54], chest: [0, -0.14], stomach: [0, 0.32] };
  const bodyAt = (cx, cy, s, part) => [cx + BODY[part][0] * 100 * s, cy + BODY[part][1] * 100 * s];
  PHS.bodyAt = bodyAt;
  function bodyFig(g, cx, cy, s, o = {}) {
    const u = 100 * s;
    g.save(); g.fillStyle = 'rgba(238,241,244,0.08)'; g.strokeStyle = COL.line; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - 0.5 * u, cy - 0.36 * u); g.quadraticCurveTo(cx, cy - 0.5 * u, cx + 0.5 * u, cy - 0.36 * u); g.lineTo(cx + 0.42 * u, cy + 0.66 * u); g.lineTo(cx - 0.42 * u, cy + 0.66 * u); g.closePath(); g.fill(); g.stroke();
    rr(g, cx - 0.1 * u, cy - 0.66 * u, 0.2 * u, 0.24 * u, 4); g.fill(); g.stroke();
    [-1, 1].forEach(d => { g.beginPath(); g.ellipse(cx + d * 0.31 * u, cy - 0.9 * u, 0.06 * u, 0.1 * u, 0, 0, Math.PI * 2); g.fill(); g.stroke(); });
    g.beginPath(); g.arc(cx, cy - 0.92 * u, 0.29 * u, 0, Math.PI * 2); g.fillStyle = '#2A3542'; g.fill(); g.stroke();
    g.restore();
    if (o.hl) { const [px, py] = bodyAt(cx, cy, s, o.hl), r = 10 + 8 * s; circ(g, px, py, r, 'rgba(255,159,122,0.28)'); ring(g, px, py, r, COL.trap, 2.4); }
    if (o.letters) Object.entries(o.letters).forEach(([part, Lt]) => { const [px, py] = bodyAt(cx, cy, s, part); circ(g, px, py, 12, COL.accent); txt(g, Lt, px, py + 1, { size: 13, weight: 800, color: '#1D1305', align: 'center' }); });
    if (o.press) { const [px, py] = bodyAt(cx, cy, s, o.press); icon(g, 'hand', px + 30 * s, py + 4 * s, 34 * s, COL.ante, 2); }
  }
  PHS.bodyFig = bodyFig;

  // 아픈 정도 1~10 (초록 → 빨강). o: { say: 위에 대답 보이기 }
  function painScale(g, x, y, w, val, o = {}) {
    const n = 10, gap = 4, bw = (w - gap * (n - 1)) / n, bh = 40;
    for (let i = 1; i <= n; i++) {
      const xx = x + (i - 1) * (bw + gap), t = (i - 1) / (n - 1);
      rr(g, xx, y, bw, bh, 6); g.fillStyle = `hsl(${Math.round(140 - 140 * t)}, 55%, ${Math.round(48 - 6 * t)}%)`; g.fill();
      if (val === i) { g.strokeStyle = '#FFFFFF'; g.lineWidth = 3; g.stroke(); }
      txt(g, String(i), xx + bw / 2, y + bh / 2 + 1, { size: 15, weight: 800, fam: FM, color: '#10151C', align: 'center' });
    }
    txt(g, '1 = 조금', x, y + bh + 18, { size: 12.5, weight: 600, color: COL.muted });
    txt(g, '10 = 가장 심함', x + w, y + bh + 18, { size: 12.5, weight: 600, color: COL.muted, align: 'right' });
    if (val && o.say !== false) {
      const xx = x + (val - 1) * (bw + gap) + bw / 2, t = `About ${PH.sv('num', val).t}.`;
      arrow(g, xx, y - 30, xx, y - 4, COL.clause, 2.4);
      txt(g, t, clamp(xx, x + 60, x + w - 60), y - 44, { size: 18, weight: 800, color: COL.clause, align: 'center' });
    }
  }
  PHS.painScale = painScale;

  // 달력 띠 (오늘 → 7일 뒤). back: 다시 올 날 · o: { wrong }
  function calFig(g, x, y, w, back, o = {}) {
    const n = 8, cw = (w - 24) / n, h = 112;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, 'COME BACK · 다시 올 날', x + 14, y + 20, { size: 12, weight: 700, fam: FM, color: COL.muted });
    const d = back ? PH.BACK[back].days : null, wd = o.wrong ? PH.BACK[o.wrong].days : null;
    for (let i = 0; i < n; i++) {
      const xx = x + 12 + i * cw, yy = y + 36, on = d === i, bad = wd === i;
      rr(g, xx + 2, yy, cw - 4, 50, 7); g.fillStyle = on ? 'rgba(127,224,168,0.22)' : i === 0 ? 'rgba(110,200,255,0.16)' : 'rgba(238,241,244,0.05)'; g.fill();
      if (on) { g.strokeStyle = COL.good; g.lineWidth = 2.4; g.stroke(); }
      if (bad) { g.strokeStyle = COL.trap; g.lineWidth = 2.2; g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]); }
      txt(g, i === 0 ? '오늘' : `+${i}`, xx + cw / 2, yy + 25, { size: i === 0 ? 13 : 15, weight: 700, fam: i === 0 ? FB : FM, color: on ? COL.good : i === 0 ? COL.ante : COL.soft, align: 'center' });
    }
    if (d != null) txt(g, `${PH.BACK[back].t} → ${PH.BACK[back].ko} 뒤`, x + w / 2, y + h - 12, { size: 14, weight: 700, color: COL.good, align: 'center' });
    return { h };
  }
  PHS.calFig = calFig;

  // 진단서 (확인서). o: { p: 나타나기 0~1, name }
  function docNote(g, x, y, w, o = {}) {
    const name = PH.NAMES[o.name || 'kim'].t, lines = [PH.CLINIC, `Patient: ${name}`, 'was seen today for a sore throat', 'and should rest for two days.'], h = 64 + lines.length * 28 + 44, p = o.p == null ? 1 : o.p;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 10); g.fillStyle = '#FBFAF5'; g.fill(); g.restore();
    txt(g, 'DOCTOR\'S NOTE', x + w / 2, y + 30, { size: 18, weight: 800, fam: FM, color: COL.ink, align: 'center' });
    g.fillStyle = 'rgba(30,38,48,0.3)'; g.fillRect(x + 20, y + 48, w - 40, 1.4);
    lines.forEach((l, i) => fade(g, clamp(p * (lines.length + 1) - i), () => txt(g, l, x + 22, y + 72 + i * 28, { size: fit(g, l, 15, w - 44, 600), weight: i ? 600 : 700, color: i ? '#3A4450' : COL.ink })));
    fade(g, clamp(p * (lines.length + 1) - lines.length), () => { txt(g, PH.DOCTOR, x + w - 22, y + h - 22, { size: 17, weight: 600, fam: FD, color: '#1F4FA0', align: 'right' }); g.fillStyle = '#1F4FA0'; g.fillRect(x + w - 130, y + h - 12, 108, 1.4); });
    return { h };
  }
  PHS.docNote = docNote;

  // 환자 카드 (시뮬레이터와 같은 칸). o: { skip, hl, rh, vs, rows }
  function patientCard(g, x, y, w, card, o = {}) {
    const all = o.rows || PH.cardRows(card), rows = all.map((r, i) => [r, i]).filter(([, i]) => !o.skip || !o.skip.includes(i)), rh = o.rh || 34, vs = o.vs || 14.5, vx = o.vx || 100;
    const LS = rows.map(([[, v]]) => richLay(g, v, [], vs, w - vx - 14, { weight: 700 }));
    const hs = LS.map(R => Math.max(rh, R.h + 10)), h = 56 + hs.reduce((a, b) => a + b, 0) + 10;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 14); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 14); g.clip(); g.fillStyle = COL.teal; g.fillRect(x, y, w, 44); g.restore();
    icon(g, 'front', x + 24, y + 22, 22, '#FFFFFF');
    txt(g, o.title || '환자 카드 · PATIENT CARD', x + 44, y + 23, { size: 16, weight: 700, color: '#FFFFFF' });
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
  PHS.patientCard = patientCard;

  // 언제부터 (for + 기간 · since + 시작한 때). o: { for: 0~1, since: 0~1 }
  function sinceFig(g, x, y, w, o = {}) {
    const h = 210, ay = y + 134, xs = [0, 1, 2].map(i => x + 44 + i * (w - 88) / 2);
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, 'HOW LONG · 언제부터', x + 16, y + 20, { size: 12, weight: 700, fam: FM, color: COL.muted });
    g.strokeStyle = COL.line; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 24, ay); g.lineTo(x + w - 24, ay); g.stroke();
    [['그저께', '2 days ago'], ['어제', 'yesterday'], ['오늘', 'now']].forEach(([ko, en], i) => {
      circ(g, xs[i], ay, 6, i === 2 ? COL.ante : COL.soft);
      txt(g, ko, xs[i], ay + 24, { size: 14, weight: 700, color: i === 2 ? COL.ante : COL.soft, align: 'center' });
      txt(g, en, xs[i], ay + 44, { size: 12, weight: 600, fam: FM, color: COL.dim, align: 'center' });
    });
    if (o.for) fade(g, o.for, () => {
      const yb = ay - 72; g.strokeStyle = COL.clause; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(xs[0], yb + 10); g.lineTo(xs[0], yb); g.lineTo(xs[2], yb); g.lineTo(xs[2], yb + 10); g.stroke();
      txt(g, 'for two days → 길이', (xs[0] + xs[2]) / 2, yb - 14, { size: 15, weight: 800, color: COL.clause, align: 'center' });
    });
    if (o.since) fade(g, o.since, () => {
      const top = ay - 52; g.fillStyle = COL.rel; g.fillRect(xs[1] - 1.5, top, 3, 46);
      g.beginPath(); g.moveTo(xs[1] + 1.5, top); g.lineTo(xs[1] + 28, top + 8); g.lineTo(xs[1] + 1.5, top + 16); g.closePath(); g.fill();
      arrow(g, xs[1] + 8, ay - 8, xs[2] - 10, ay - 8, COL.rel, 2.4);
      txt(g, 'since yesterday → 시작한 때', xs[1] + 36, top + 10, { size: 14, weight: 800, color: COL.rel });
    });
    return { h };
  }

  // 첫 낱말 → 짧은 대답 (PH.AUX). o: { hl: 'do' | 'be' | …, at, u }
  function auxTable(g, x, y, w, o = {}) {
    const ks = Object.keys(PH.AUX), rh = 40, h = 46 + ks.length * rh;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '첫 낱말 → 짧은 대답의 짝', x + 16, y + 22, { size: 14, weight: 700, color: COL.muted });
    ks.forEach((k, i) => fade(g, o.u == null ? 1 : ramp(o.u, (o.at || 0) + i * 0.25, 0.3), () => {
      const A = PH.AUX[k], yy = y + 46 + i * rh + rh / 2 - 4, on = o.hl === k;
      if (on) { rr(g, x + 6, yy - rh / 2 + 3, w - 12, rh - 6, 8); g.fillStyle = 'rgba(110,200,255,0.12)'; g.fill(); g.strokeStyle = COL.ante; g.lineWidth = 1.8; g.stroke(); }
      txt(g, A.q, x + 16, yy, { size: 15, weight: 700, color: COL.ante });
      txt(g, A.a.split(' · ')[0], x + w - 14, yy, { size: fit(g, A.a.split(' · ')[0], 15, w - 130, 700), weight: 700, color: COL.rel, align: 'right' });
    }));
    return { h };
  }

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
  PHS.notePanel = notePanel;
  // 증상 넷 (I have …). hl: 증상 id
  const symRows = () => PH.SYM_IDS.map(id => [`I have ${PH.SYM[id].en}.`, `${PH.SYM[id].short} · My ${PH.PART[PH.SYM[id].part].n} hurts.`]);
  const symTable = (g, x, y, w, hl, o = {}) => notePanel(g, x, y, w, '증상 → I have + 증상', symRows(), Object.assign({ hl: hl ? PH.SYM_IDS.indexOf(hl) : null }, o));

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(곱하기 표)는 자막에 쓰지 않음
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '약국 · 병원 회화 · 사실에 부탁을 붙이고 복용법은 되짚는다', d: 26, caps: [
      [0.4, 5.5, '약국에서는 증상을 말하고 약을 부탁해요. 병원에서는 접수부터 처방까지 정해진 질문이 이어져요.'],
      [5.5, 10.5, '약국 카운터 → What can I get for you today? 목이 아파서 → I have a sore throat.'],
      [10.5, 16, '사실만 말하고 끝내면 약사가 무엇을 바라는지 다시 물어요. **사실에 부탁을 붙여요** → Could you recommend something for it?'],
      [16, 21, '먹는 법을 들은 뒤 → Okay. Thanks. 하고 끝내지 말고, 들은 조각을 한 줄로 되짚어 확인해요.'],
      [21, 26, '세 단계로 말해요. 열쇠 낱말과 모양을 잡고, 틀에 내 정보를 넣고, 공손하게 끝내요.'],
    ] },
    { id: 'map', n: '01', title: '약국에서 병원까지', sub: '약국 셋 · 병원 넷 · 곳마다 한두 마디', d: 30, caps: [
      [0.4, 6, '오늘의 이야기를 일곱 곳으로 나눠 봐요. 목이 아파서 먼저 Elm Street Pharmacy, 약국에 가요.'],
      [6, 12, '약국에서는 증상을 알리고, 약사의 질문에 답하고, 먹는 법과 값을 듣고 되짚어요.'],
      [12, 18, '사흘이 지나도 낫지 않아서 병원에 가요. 접수, 진료실, 진찰, 처방 순서예요.'],
      [18, 24, '보라 테두리 → 내가 먼저 말을 꺼내는 곳이에요. 약국 카운터에서 증상 알리기, 처방 끝에 진단서 부탁하기.'],
      [24, 30, '약 이름, 먹는 양, 값은 모두 지어낸 예시예요. 의학 조언이 아니니 실제로는 약사와 의사의 말을 따르세요.'],
    ] },
    { id: 'counter', n: '02', title: '약국 카운터 · 사실 + 부탁', sub: 'What can I get for you · I have a sore throat · Could you recommend · for · since', d: 34, place: 0, caps: [
      [0.4, 6, '약사 → What can I get for you today? 목이 아프다고 → My throat is sick. 목이 병들었다는 말처럼 들려요.'],
      [6, 11.5, 'Give me medicine for a sore throat. → ‘약 주세요’를 그대로 옮기면 명령처럼 들려요.'],
      [11.5, 17, '증상은 → I have a sore throat. 사실만 말하고 끝내지 말고 부탁을 질문으로 붙여요 → Could you recommend something for it?'],
      [17, 22.5, '다른 부탁 → Do you have anything for it? **사실 + 부탁**, 두 문장이면 약사가 바로 알아들어요.'],
      [22.5, 28, 'How long have you had it? → 정보 질문. 이틀 동안 → During two days? 숫자로 센 기간은 → For two days.'],
      [28, 34, '어제부터 → From yesterday? 지금까지 이어지는 일이 시작된 때는 → Since yesterday.'],
    ] },
    { id: 'ask', n: '03', title: '약사의 질문 · 짝 맞는 대답', sub: 'Do you · Are you · tablets or liquid · take · You allergic?', d: 34, place: 1, caps: [
      [0.4, 5.5, '약사의 질문은 모양이 정해져 있어요. Do you have a fever? Are you allergic to any medicine? → Yes/No 질문이에요.'],
      [5.5, 11, 'Tablets or liquid? → 고르는 질문이라 Yes만으로는 답이 안 돼요. How long → 정보 질문이에요.'],
      [11, 17, "Yes/No 질문은 첫 낱말로 짧은 대답을 만들어요. Do you → No, I don't. Are you → No, I'm not. 짝이 어긋나면 틀려요."],
      [17, 22.5, "Are you taking any other medication? 약은 eat이 아니라 take → Yes, I'm taking vitamins."],
      [22.5, 28, '빠른 말 → You allergic to anything? 열쇠 낱말을 놓쳤으면 짐작하지 말고 → Sorry, did you ask about allergies?'],
      [28, 34, 'Tablets or liquid? → 빠르면 두 낱말이 이어져 들려요 → TAB-let-ser. 고를 것을 세게 말해요.'],
    ] },
    { id: 'dose', n: '04', title: '복용법 듣고 되짚기', sub: 'Take … times a day · So, I take …? · $13.50 · drowsy', d: 36, place: 2, caps: [
      [0.4, 6.5, '약사 → Take two tablets three times a day after meals, for five days. 조각 넷 → 양, 하루 몇 번, 언제, 며칠.'],
      [6.5, 12.5, 'Okay. Thanks. → 되짚지 않으면 틀린 곳을 몰라요. 약은 eat이 아니라 take, 하루 세 번은 three times a day.'],
      [12.5, 18.5, '하루 몇 번을 잘못 되짚으면 약사가 그 조각만 고쳐 줘요. 모두 맞게 → So, I take two tablets, three times a day, after meals, for five days?'],
      [18.5, 24, '빠른 말 → Two tablets, three times a day … 놓친 조각만 물어요 → Sorry, how many times a day?'],
      [24, 30, "That's $13.50. → thirteen fifty. thirteen → 뒤를, thirty → 앞을 세게 말해요. 카드로 낼 때 → Can I pay by card?"],
      [30, 36, "may make you drowsy → 모르는 낱말이면 → Sorry, what does drowsy mean? 졸릴 수 있다는 뜻이에요 → Okay, I won't drive. Thanks."],
    ] },
    { id: 'front', n: '05', title: '병원 접수 · 이름과 생년월일', sub: 'appointment · first visit · spell · date of birth · insurance', d: 36, place: 3, caps: [
      [0.4, 6, "병원 접수 → Do you have an appointment? 예약 없이 왔으면 → No, I don't. I'd like to see a doctor, please."],
      [6, 11.5, 'Is this your first visit here? → Yes, I am first. 줄의 1등이라는 말로 들려요. Is this로 물으면 → Yes, it is.'],
      [11.5, 17.5, "What's your last name? → It's Kim, K-I-M. 철자를 불러 달라면 Yes만 하지 말고 한 글자씩 → Sure. K-I-M."],
      [17.5, 24, "date of birth → 2005, 3, 4. 숫자만 말하면 3월 4일인지 4월 3일인지 헷갈려요. 달은 이름으로 → It's March 4th, 2005."],
      [24, 30, '읽기 → March fourth, two thousand five. 미국 서류에는 달, 날, 해 순서로 03/04/2005라고 써요.'],
      [30, 36, 'health insurance → Yes, I have. have 뒤가 비어 틀려요 → Yes, I do. I have travel insurance.'],
    ] },
    { id: 'doctor', n: '06', title: '진료실 · 증상 설명', sub: 'What seems to be the problem · I have · My … hurts · took', d: 30, place: 4, caps: [
      [0.4, 6, '의사 → So, what seems to be the problem? 약국에서처럼 → My throat is sick. 이렇게 말하면 어색해요.'],
      [6, 12, '증상은 → I have a sore throat. 아픈 곳을 앞에 두고 → My throat hurts. 둘 다 좋아요.'],
      [12, 18, 'Have you taken anything for it? 약은 take, 지난 일이라 took → Yes, I took some cold medicine.'],
      [18, 24, "빠른 말 → So what brings you in today? 놓쳤으면 → Sorry, did you ask what's wrong?"],
      [24, 30, '증상 넷 → sore throat, cough, stomachache, earache. I have a … 또는 My … hurts로 말해요.'],
    ] },
    { id: 'exam', n: '07', title: '진찰 · 아픈 곳과 정도', sub: 'Where does it hurt · Does it hurt when I press · scale of one to ten', d: 34, place: 5, caps: [
      [0.4, 6.5, 'Where does it hurt? → Here is pain. 낱말 그대로 옮긴 틀린 문장이에요 → It hurts in my throat.'],
      [6.5, 12.5, 'Does it hurt when I press here? → Does로 물었으니 → Yes, it does. Yes, it is.는 짝이 어긋나요.'],
      [12.5, 20, 'How bad is the pain, on a scale of one to ten? → Very pain. 숫자가 없어요. 1부터 10 가운데 → About a six.'],
      [20, 27, "Do you have any allergies to medication? → 약국에서는 Are you로 물어서 No, I'm not. 여기는 Do you라서 → No, I don't."],
      [27, 34, "알레르기가 있으면 꼭 말해요 → Yes, I'm allergic to penicillin. 의사가 다른 약으로 바꿔 줘요."],
    ] },
    { id: 'plan', n: '08', title: '처방 · 다음 진료 · 진단서', sub: "Take one capsule … · come back in … · a doctor's note", d: 36, place: 6, caps: [
      [0.4, 6.5, "의사 → I'm going to give you some antibiotics. Take one capsule twice a day with food, for seven days."],
      [6.5, 12.5, 'Okay. Thanks. → 되짚지 않았어요. 하루 세 번으로 잘못 되짚으면 → Not quite — twice a day, not three times a day.'],
      [12.5, 18.5, "바르게 되짚으면 → So, I take one capsule, twice a day, with food, for seven days? → That's right!"],
      [18.5, 24.5, "If you're not feeling better in three days, please come back. 숫자를 되짚어요 → So, I should come back in three days if I'm not better?"],
      [24.5, 30.5, "Do you have any other questions? 진단서를 diagnosis로 옮기면 병의 이름이에요. 학교에 낼 확인서는 → a doctor's note."],
      [30.5, 36, "물어볼 것은 Yes 뒤에 바로 물어요 → Yes. Could I get a doctor's note for my class?"],
    ] },
    { id: 'method', n: '09', title: '3단계 말하기 법', sub: '일곱 곳에 한 줄씩 · 질문의 모양과 함께', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 말하기 법**으로 묶어요.'],
      [5.5, 11.5, '① **열쇠 낱말과 질문의 모양 잡기** → or → 고르기, How long → 정보, Do you · Are you · Does it → 첫 낱말로 짧은 대답.'],
      [11.5, 17.5, '② **틀에 내 정보 넣기** → I have a sore throat. 들은 복용법과 숫자는 조각을 모아 되짚어요 → So, I take …?'],
      [17.5, 23, '③ **공손하게 끝내기** → 부탁은 질문으로 → Could you recommend something? 놓쳤으면 → Sorry, how many times a day?'],
      [23, 28, '일곱 곳에 한 줄씩 적용했어요. 숫자가 많은 말일수록 되짚기가 힘이 돼요.'],
    ] },
    { id: 'practice', n: '10', title: '실전 약국 · 병원', sub: '환자 카드 하나로 네 번', d: 50, caps: [
      [0.4, 4.5, '실전이에요. 환자 카드 → 기침, 물약이 좋아요. 첫 질문 → Would you prefer tablets or liquid?'],
      [4.5, 8.5, '① 고르는 질문 → (A) Yes, please. 고른 것이 없어 탈락. ② (B) Tablets, please. → 카드와 달라 탈락.'],
      [8.5, 12.5, '정답 (C) → Liquid, please.'],
      [12.9, 17, '약사 → Take 10 ml every six hours, for five days. 셋 모두 먹는 법에 대한 말이에요.'],
      [17, 21, '② (A) Okay. Thanks. → 되짚지 않아 탈락. (B) after meals → 들은 말에 없는 조각이라 탈락.'],
      [21, 25, '정답 (C) → So, I take 10 ml, every six hours, for five days?'],
      [25.4, 29.5, "병원 접수 → And what's your date of birth? 카드 → 2004년 11월 12일. 정보 질문이에요."],
      [29.5, 33.5, '① (B) Yes. → 정보가 없어 탈락. ② (C) 2004, 11, 12. → 숫자만 한국식 순서라 탈락.'],
      [33.5, 37.5, "정답 (A) → It's November 12th, 2004."],
      [37.9, 42, '마지막 → Do you have any other questions? ① Yes/No 질문 → 셋 모두 Yes · No로 답해요.'],
      [42, 46, '② (A) Yes, please. → 물어볼 것이 없는데 Yes라서 탈락.'],
      [46, 50, "③ (B) No. → 고맙다는 말 없이 끊겨 탈락. 정답 (C) → No, that's all. Thank you so much!"],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '곳 · 열쇠 낱말과 모양 · 대답 틀', d: 22, caps: [
      [0.4, 6, '정리해요. 약국에서는 사실에 부탁을 붙여요 → I have a sore throat. Could you recommend something for it?'],
      [6, 12, '먹는 법은 조각을 모아 되짚어요 → So, I take two tablets, three times a day, after meals, for five days?'],
      [12, 17, '병원에서는 질문의 첫 낱말에 맞춰 짧게 답하고, 생년월일은 달 이름으로 말해요.'],
      [17, 22, '아래 **약국 · 병원 시뮬레이터**에서 내 환자 카드로 약국부터 처방까지 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  PHS.CHAPTERS = CHAPTERS; PHS.CAPTIONS = CAPTIONS; PHS.END = END;
  PHS.POSTER = CHAPTERS.find(c => c.id === 'dose').t + 18.3;
  PHS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  PHS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 실전 장면의 시각 (구간 시작 · 보기 · ① · ② · ③ · 정답)
  const PSEG = [0, 12.5, 25, 37.5];
  const PT = { q: 0.4, opt: [1.6, 2.2, 2.8], s1: 5.0, s2: 7.0, s3: 9.0, win: 10.0, lines: [0.4, 4.5, 8.5] };
  PHS.PSEG = PSEG;

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
  const ansParts = a => PH.segs(a).map(s => [s.t, s.r]);
  // 되짚기 한 줄을 짧게 (표 · 목록용): So, I take two tablets … for five days?
  const shortParts = a => {
    if (a.f !== 'line') return ansParts(a);
    const s = PH.segs(a); if (s.length < 8) return ansParts(a);
    return [[s[0].t + ' ', s[0].r], [s[2].t, s[2].r], [' … ', 'frame'], [s[s.length - 2].t, s[s.length - 2].r], [s[s.length - 1].t, s[s.length - 1].r]];
  };
  const shortText = a => shortParts(a).map(p => p[0]).join('');
  PHS.shortText = shortText;
  // 여러 줄로 감싸는 대답 (보기 · 되짚기)
  function wrapAns(g, a, x, y, size, maxW, o = {}) {
    const text = PH.text(a), marks = o.plain ? [] : PH.segs(a).filter(s => s.r && s.r !== 'frame').map(s => [s.t, o.dim ? 'dim' : s.r]);
    const R = richLay(g, text, marks, size, maxW, { weight: 600 });
    richDraw(g, R, x, y - (R.rows - 1) * R.lh / 2, { color: o.dim ? COL.dim : o.color || COL.text });
    return R;
  }
  const why2 = j => `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
  function whyLine(g, j, y, w = 1100, x) { const R = richLay(g, why2(j), [], 16, w, { weight: 600 }); richDraw(g, R, x != null ? x : W / 2 - R.w / 2, y, { color: j.ok ? COL.good : COL.trap }); return R; }
  const ME_FIRST = PH.ME_FIRST;
  const D = PH.DEMO, D0 = PH.DEMO_DOSE, R0 = PH.DEMO_RX;
  const okOn = (q, a, c) => PH.judge(Qobj(q), a, c || D).ok;
  const OT = PH.o;
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
  const side = (g, h = 330) => panel(g, RX, 150, RW, h, { fill: COL.panel, stroke: COL.faint });
  // 큰 십자 간판 (약국 초록 · 병원 파랑)
  function crossSign(g, x, y, s, color) {
    rr(g, x - s, y - s, s * 2, s * 2, s * 0.35); g.fillStyle = color; g.fill();
    g.fillStyle = '#FFFFFF'; g.fillRect(x - s * 0.22, y - s * 0.66, s * 0.44, s * 1.32); g.fillRect(x - s * 0.66, y - s * 0.22, s * 1.32, s * 0.44);
  }
  // 헷갈리는 숫자 짝 (13 · 30)
  function pairsFig(g, x, y, w, u, at) {
    const rh = 58, h = 52 + PH.PAIRS.length * rh + 40;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '헷갈리는 숫자 · 세게 읽는 곳', x + 16, y + 22, { size: 13.5, weight: 700, color: COL.muted });
    PH.PAIRS.forEach(([a, as, b, bs], i) => fade(g, ramp(u, at + i * 0.3, 0.35), () => {
      const yy = y + 60 + i * rh;
      [[a, as, x + 16], [b, bs, x + w / 2 + 6]].forEach(([n, s, xx]) => {
        txt(g, n, xx, yy, { size: 22, weight: 800, fam: FM, color: COL.text });
        const parts = s.match(/[A-Z]{2,}|[a-z]+/g);
        let px = xx + 46; parts.forEach(pp => { const big = /^[A-Z]{2,}$/.test(pp); px += txt(g, pp.toLowerCase(), px, yy, { size: big ? 19 : 15, weight: big ? 800 : 500, color: big ? COL.accent : COL.soft }); });
        say(xx - 4, yy - 20, w / 2 - 20, 40, PH.numWord(+n));
      });
    }));
    fade(g, ramp(u, at + 1.2, 0.4), () => txt(g, '$13.50 → thirteen fifty', x + w / 2, y + h - 22, { size: 16, weight: 700, color: COL.clause, align: 'center' }));
    say(x + 20, y + h - 40, w - 40, 36, 'thirteen fifty');
    return { h };
  }

  const SCENES = {
    /* 00 들어가며: 제목 → What can I get for you? → 사실만 × → 사실 + 부탁 ✓ → 먹는 법 → Okay. Thanks. × → 되짚기 ✓ → 세 단계 */
    intro(g, u) {
      fade(g, ramp(u, 0.2, 0.6) * (1 - ramp(u, 5.0, 0.5)), () => {
        const T = '약국 · 병원, 사실에 부탁을 붙이고 복용법은 되짚는다';
        txt(g, T, W / 2, 262, { size: fit(g, T, 48, 1140, 800, 30, FD), weight: 800, fam: FD, align: 'center' });
        txt(g, 'Pharmacy & clinic English · 약국 카운터에서 처방과 다음 진료까지 일곱 곳', W / 2, 332, { size: 23, weight: 500, color: COL.muted, align: 'center' });
        PH.PLACES.forEach((p, i) => fade(g, ramp(u, 0.9 + i * 0.22, 0.4), () => {
          const x = W / 2 + (i - 3) * 132;
          circ(g, x, 440, 32, COL.panel2); ring(g, x, 440, 32, ME_FIRST[p.id] ? COL.verb : COL.accent, 1.8);
          icon(g, p.id, x, 440, 30, COL.soft);
          txt(g, String(i + 1), x, 392, { size: 14, weight: 700, fam: FM, color: COL.accent, align: 'center' });
          const nm = p.ko.split(' · ')[0];
          txt(g, nm, x, 496, { size: fit(g, nm, 15, 126, 600), weight: 600, color: COL.muted, align: 'center' });
          if (i < 6) arrow(g, x + 38, 440, x + 92, 440, i === 2 ? 'rgba(201,167,255,0.5)' : COL.faint, 2, i === 2 ? [4, 5] : null);
        }));
      });
      const it = PH.INTRO, C = Object.assign({}, D, it.card);
      // [5.4, 15.9] 약국 카운터: 사실만 → 사실 + 부탁
      fade(g, ramp(u, 5.4, 0.4) * (1 - ramp(u, 15.8, 0.4)), () => {
        label(g, '약국 카운터 · 증상 알리기', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, it.q, { x: LX, y: 186, w: 780, at: 5.8, u, roleAt: 6.8, size: 26, shapeAt: 7.0 });
        fade(g, win(u, 6.6, 9.6), () => thought(g, '(속으로) 목이 아파요…', LX + 420, 186 + B.bh + 14, 300));
        const ay = 186 + B.bh + 84;
        const A = answer(g, { x: LX, y: ay, w: 780, A: it.half, B: u >= 14.2 ? it.ok : null, p: (u - 14.2) / 0.8, at: 8.8, u, size: 26, maxW: 640, trapAt: 10.8, strikeAt: 11.0, verdict: u >= 15.1 ? { ok: okOn(it.q, it.ok, C), at: 15.1 } : null });
        fade(g, win(u, 11.2, 14.2), () => {
          talk(g, { side: 'L', x: LX, y: ay + A.bh + 16, w: 780, text: 'Oh, okay… so what would you like?', marks: [['what would you like', 'key']], kind: 'pharm', sp: 'us', at: 11.4, u, size: 22 });
          tag(g, '사실만 말하고 끝 → 무엇을 바라는지 몰라요', A.bx + A.bw, ay + A.bh + 98, COL.trap, { align: 'right', size: 15, h: 32 });
        });
        fade(g, ramp(u, 6.0, 0.5), () => medPack(g, RX, 200, 290, { name: 'COLD RELIEF', form: '20 TABLETS' }));
      });
      // [16, 20.6] 먹는 법 → 되짚기
      fade(g, ramp(u, 16.0, 0.4) * (1 - ramp(u, 20.6, 0.5)), () => {
        label(g, '약국 · 먹는 법 듣기', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, it.rq, { x: LX, y: 186, w: 780, at: 16.2, u, all: true, size: 21 });
        const ay = 186 + B.bh + 18;
        answer(g, { x: LX, y: ay, w: 780, A: it.skip, B: u >= 18.6 ? it.line : null, p: (u - 18.6) / 0.9, at: 17.2, u, size: 21, maxW: 600, trapAt: 17.7, strikeAt: 17.8, tag: ['되짚지 않으면 틀린 곳을 몰라요', COL.trap, 17.9, 18.6], verdict: u >= 19.6 ? { ok: okOn(it.rq, it.line, C), at: 19.6 } : null });
        doseDay(g, RX - 20, 186, 320, D0, { p: ramp(u, 16.4, 2.6) });
      });
      const STEP = [
        ['①', '열쇠 낱말 + 모양', 'Tablets or liquid?', '고르는 질문 → 고른 것 + please', COL.ante, 'Tablets or liquid?'],
        ['②', '틀에 내 정보 넣기', 'So, I take ___, ___?', '들은 복용법 · 숫자 → 되짚기', COL.rel, 'So, I take two tablets, three times a day, after meals, for five days?'],
        ['③', '공손하게 끝내기', 'Could you recommend …?', '부탁은 질문으로 · please · Sorry', COL.verb, 'Could you recommend something for it?'],
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

    /* 01 약국에서 병원까지: 왼쪽 약국(셋) · 오른쪽 병원(넷) */
    map(g, u) {
      const sel = S.stop != null ? S.stop : null;
      const PB = { x: 70, y: 146, w: 500, h: 322 }, CB = { x: 610, y: 146, w: 600, h: 322 };
      const POS = { counter: [170, 318], ask: [320, 318], dose: [470, 318], front: [690, 318], doctor: [840, 318], exam: [985, 318], plan: [1130, 318] };
      const NM = { counter: ['카운터', '증상 알리기'], ask: ['약사의 질문', '열 · 알레르기'], dose: ['복용법', '값 · 조심할 점'], front: ['접수', '이름 · 생일'], doctor: ['진료실', '증상 설명'], exam: ['진찰', '아픈 곳 · 정도'], plan: ['처방', '다음 진료'] };
      fade(g, ramp(u, 0.3, 0.6), () => {
        // 약국
        panel(g, PB.x, PB.y, PB.w, PB.h, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        txt(g, `PHARMACY · ${PH.PHARMACY.toUpperCase()}`, PB.x + 20, PB.y + 24, { size: 12, weight: 700, fam: FM, color: COL.muted });
        crossSign(g, PB.x + PB.w - 34, PB.y + 28, 14, '#3FA66B');
        g.save(); g.globalAlpha *= 0.5;
        [0, 1].forEach(k => {
          const sy = PB.y + 92 + k * 52;
          for (let i = 0; i < 14; i++) { const bh = 18 + ((i * 7 + k * 3) % 3) * 7; rr(g, PB.x + 34 + i * 31, sy - bh, 24, bh, 3); g.fillStyle = ['#6EC8FF', '#7FE0A8', '#FFC15E', '#F2C29A', '#C9A7FF'][(i + k * 2) % 5]; g.fill(); }
          g.fillStyle = COL.wood; g.fillRect(PB.x + 26, sy, PB.w - 52, 6);
        });
        g.restore();
        rr(g, PB.x + 30, PB.y + 268, PB.w - 60, 36, 8); g.fillStyle = COL.wood; g.fill();
        txt(g, 'COUNTER', PB.x + PB.w / 2, PB.y + 286, { size: 11, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
        // 병원
        panel(g, CB.x, CB.y, CB.w, CB.h, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        txt(g, `CLINIC · ${PH.CLINIC.toUpperCase()}`, CB.x + 20, CB.y + 24, { size: 12, weight: 700, fam: FM, color: COL.muted });
        crossSign(g, CB.x + CB.w - 34, CB.y + 28, 14, '#3A78C2');
        rr(g, CB.x + 26, CB.y + 70, 110, 40, 8); g.fillStyle = COL.wood; g.fill();
        txt(g, 'RECEPTION', CB.x + 81, CB.y + 60, { size: 10.5, weight: 700, fam: FM, color: COL.muted, align: 'center' });
        panel(g, CB.x + 170, CB.y + 52, CB.w - 196, 84, { fill: 'rgba(238,241,244,0.04)', stroke: COL.faint, dash: true, r: 12 });
        txt(g, `EXAM ROOM 2 · ${PH.DOCTOR.toUpperCase()}`, CB.x + 186, CB.y + 70, { size: 10.5, weight: 700, fam: FM, color: COL.muted });
        rr(g, CB.x + 400, CB.y + 88, 150, 30, 8); g.fillStyle = 'rgba(191,227,255,0.16)'; g.fill();
        icon(g, 'doctor', CB.x + 210, CB.y + 104, 24, COL.muted);
      });
      fade(g, ramp(u, 11.6, 0.4), () => { arrow(g, 574, 318, 606, 318, 'rgba(201,167,255,0.75)', 2.2); txt(g, '사흘 뒤', 590, 296, { size: 12, weight: 700, color: COL.verb, align: 'center' }); });
      const AT = [1.0, 6.4, 8.6, 12.4, 13.6, 14.8, 16.0];
      PH.PLACES.forEach((p, i) => {
        const [x, y] = POS[p.id], on = sel === i, dim = sel != null && !on, me = ME_FIRST[p.id] && u >= 18.2;
        fade(g, ramp(u, AT[i], 0.45) * (dim ? 0.4 : 1), () => {
          circ(g, x, y, 24, on ? COL.accent : COL.panel2); ring(g, x, y, 24, on ? COL.accent : me ? COL.verb : COL.ante, me ? 3 : 2.2);
          icon(g, p.id, x, y, 26, on ? '#1D1305' : COL.text);
          chip(g, String(i + 1), x + 19, y - 21, { size: 11, fam: FM, weight: 700, color: '#1D1305', fill: me ? COL.verb : COL.accent, h: 18, r: 9, pad: 5, align: 'center' });
          const [l1, l2] = NM[p.id];
          txt(g, l1, x, y + 42, { size: fit(g, l1, 14, 128, 700), weight: 700, color: me ? COL.verb : COL.soft, align: 'center' });
          txt(g, l2, x, y + 60, { size: fit(g, l2, 12.5, 128, 600), weight: 600, color: me ? COL.verb : COL.muted, align: 'center' });
        });
        HITS.push({ x: x - 60, y: y - 28, w: 120, h: 100, stop: i });
      });
      // 아래 칸
      const by = 480, bh = 98;
      if (sel != null) {
        const p = PH.PLACES[sel];
        panel(g, LX, by, 1120, bh, { fill: COL.panel, stroke: COL.accent });
        icon(g, p.id, LX + 28, by + 24, 22, COL.accent);
        txt(g, `${sel + 1}. ${p.ko}`, LX + 48, by + 24, { size: 17, weight: 700, color: COL.accent });
        PH.PLACEQ[p.id].forEach((qid, k) => {
          const q = PH.Q[qid], t = q.short && /[?!.]$/.test(q.short) && q.short.length < 60 ? q.short : q.en, R = richLay(g, t, q.fast ? [] : Qm(q), 17, 590, { weight: 600 });
          shapeMark(g, q.shape, LX + 34, by + 54 + k * 28, 14, { disc: false, iw: 2.2 });
          if (R.rows > 1) txt(g, t, LX + 52, by + 54 + k * 28, { size: fit(g, t, 17, 590, 600), weight: 600, color: COL.en });
          else richDraw(g, R, LX + 52, by + 54 + k * 28, { color: COL.en });
          say(LX + 48, by + 40 + k * 28, Math.min(R.w, 600) + 8, 28, q.en);
        });
        txt(g, '대답 →', LX + 690, by + 24, { size: 14, weight: 700, color: COL.muted });
        PH.PLACEQ[p.id].map(id => PH.Q[id]).forEach((q, k) => { const a = PH.model(q, D), t = shortText(a); txt(g, t, LX + 690, by + 54 + k * 28, { size: fit(g, t, 16, 420, 600), weight: 600, color: COL.rel }); say(LX + 686, by + 40 + k * 28, 430, 28, PH.text(a)); });
      } else {
        PH.PLACES.forEach((p, i) => fade(g, ramp(u, 6.2 + i * 0.5, 0.4), () => {
          const x = LX + i * 161, q = PH.Q[PH.PLACEQ[p.id][0]], t = q.short && q.short.length < 48 ? q.short : q.en, me = ME_FIRST[p.id] && u >= 18.2;
          panel(g, x, by, 151, bh, { fill: COL.panel, stroke: me ? COL.verb : COL.faint, lw: me ? 2 : 1.5 });
          txt(g, `${i + 1}`, x + 14, by + 20, { size: 13, weight: 700, fam: FM, color: COL.accent });
          txt(g, me ? '내가 먼저' : i < 3 ? '약국' : '병원', x + 140, by + 20, { size: 12, weight: 700, color: me ? COL.verb : COL.muted, align: 'right' });
          const R = richLay(g, t, [], 14, 130, { weight: 600 });
          richDraw(g, R, x + 12, by + 48, { color: COL.en });
          say(x, by, 151, bh, q.en);
        }));
        fade(g, ramp(u, 24.2, 0.5), () => tag(g, '약 · 양 · 값은 지어낸 예시 · 의학 조언이 아니에요', 1200, 126, COL.muted, { align: 'right', size: 14, h: 26 }));
      }
    },

    /* 02 약국 카운터: 낱말 그대로 × · 명령 × → 사실만 → 사실 + 부탁 ✓ → for · since */
    counter(g, u) {
      if (S.need) {
        const s = S.need, C = Object.assign({}, D, { sym: s.sym, part: PH.SYM[s.sym].part, since: s.since === 'since' ? 'yday' : '2d' });
        const a1 = s.style === 'sick' ? OT('cs_sick', PH.SYM[s.sym].part) : OT('cs_' + s.style, s.sym);
        const r1 = exch(g, 99, { q: 'cn_what', at: -9, ok: a1, card: C, y: 150, qo: { all: true } });
        const R = whyLine(g, PH.judge(PH.Q.cn_what, a1, C), r1.y + 22, 780, LX);
        const a2 = s.since === 'since' ? OT('sn_since', 'yday') : OT('sn_for', '2d');
        exch(g, 99, { q: 'ak_long', at: -9, ok: a2, card: C, y: r1.y + R.h + 34, qo: { all: true } });
        symTable(g, RX, 150, RW, s.sym);
        return;
      }
      const [qid, sick, give, fact, rec, any] = PH.SCENE.need;
      // [0.4, 22.5] 증상 알리기
      fade(g, 1 - ramp(u, 22.2, 0.4), () => {
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        fade(g, 1 - ramp(u, 5.8, 0.3), () => answer(g, { x: LX, y, w: 780, A: sick, at: 2.6, u, size: 23, trapAt: 3.4, strikeAt: 3.5, tag: ['낱말 그대로 → ‘목이 병들었다’처럼 들려요', COL.trap, 3.8], tagY: y + 78 }));
        fade(g, ramp(u, 6.0, 0.3) * (1 - ramp(u, 11.2, 0.3)), () => answer(g, { x: LX, y, w: 780, A: give, at: 6.4, u, size: 23, maxW: 640, trapAt: 7.2, strikeAt: 7.3, tag: ['‘주세요’를 그대로 → 명령처럼 들려요 · please도 없어요', COL.trap, 7.6], tagY: y + 78 }));
        if (u >= 11.2) fade(g, ramp(u, 11.4, 0.4), () => {
          const A = answer(g, { x: LX, y, w: 780, A: fact, B: u >= 14.0 ? rec : null, p: (u - 14.0) / 0.8, at: 11.8, u, size: 23, maxW: 640, verdict: u >= 15.0 ? { ok: okOn(qid, rec), at: 15.0 } : null, tag: ['사실만 → 무엇을 바라는지 몰라요', COL.trap, 12.6, 14.0], tagY: y + 78 });
          if (u >= 17.0) fade(g, ramp(u, 17.2, 0.4), () => answer(g, { x: LX, y: y + A.bh + 14, w: 780, A: any, at: 17.6, u, size: 23, maxW: 640, verdict: { ok: okOn(qid, any), at: 18.4 } }));
        });
        // 오른쪽: 증상 넷 → 사실 + 부탁
        fade(g, ramp(u, 1.2, 0.5) * (1 - ramp(u, 16.6, 0.4)), () => symTable(g, RX, 150, RW, u >= 11.8 ? 'sorethroat' : null, { u, at: 1.4, step: 0.25 }));
        if (u >= 16.6) fade(g, ramp(u, 16.8, 0.4), () => notePanel(g, RX, 150, RW, '사실 + 부탁 · 두 문장', [
          ['I have a sore throat.', '① 사실 · 증상', COL.clause],
          ['Could you recommend something for it?', '② 부탁 · 질문으로 (추천해 주시겠어요?)', COL.verb],
          ['Do you have anything for it?', '② 부탁 · 질문으로 (먹을 만한 약 있어요?)', COL.verb],
        ], { u, at: 17.0, step: 0.5 }));
      });
      // [22.5, 34] 언제부터: for + 기간 · since + 시작한 때
      if (u >= 22.2) fade(g, ramp(u, 22.4, 0.4), () => {
        const [sq, dur, forA, fromA, sinceA] = PH.SCENE.since;
        const B = staff(g, sq, { x: LX, y: 150, w: 780, at: 22.6, u, roleAt: 23.2, size: 22, shapeAt: 23.4 });
        const y = 150 + B.bh + 14;
        fade(g, 1 - ramp(u, 27.8, 0.3), () => answer(g, { x: LX, y, w: 780, A: dur, B: u >= 25.6 ? forA : null, p: (u - 25.6) / 0.7, at: 23.8, u, size: 24, trapAt: 24.4, strikeAt: 24.5, tag: ['‘동안’ → during? 숫자로 센 기간은 for', COL.trap, 24.7, 25.6], tagY: y + 78, verdict: u >= 26.4 ? { ok: okOn(sq, forA), at: 26.4 } : null }));
        if (u >= 27.8) fade(g, ramp(u, 28.0, 0.3), () => answer(g, { x: LX, y, w: 780, A: fromA, B: u >= 30.4 ? sinceA : null, p: (u - 30.4) / 0.7, at: 28.4, u, size: 24, trapAt: 29.0, strikeAt: 29.1, tag: ['‘부터’ → from? 지금까지 이어지면 since', COL.trap, 29.3, 30.4], tagY: y + 78, verdict: u >= 31.2 ? { ok: okOn(sq, sinceA, Object.assign({}, D, { since: 'yday' })), at: 31.2 } : null }));
        sinceFig(g, LX, 330, 780, { for: ramp(u, 26.0, 0.6), since: ramp(u, 30.8, 0.6) });
        notePanel(g, RX, 150, RW, '언제부터 · 두 틀', [
          ['For two days.', 'for + 기간 (이틀 동안 · 일주일 동안)', COL.clause],
          ['Since yesterday.', 'since + 시작한 때 (어제부터 · 월요일부터)', COL.rel],
        ], { u, at: 25.8, step: 4.8 });
      });
    },

    /* 03 약사의 질문: 모양 넷 → 첫 낱말 짝 → take → 빠른 말 → 이어서 들리는 말 */
    ask(g, u) {
      if (S.shape) {
        const q = PH.Q[S.shape], Sx = PH.SHAPE[q.shape], a = PH.model(q, D);
        const B = staff(g, q, { x: LX, y: 160, w: 1100, all: true, u: 99, size: 26 });
        shapeTag(g, q.shape, LX, 160 + B.bh + 40, { size: 18, h: 42 });
        txt(g, Sx.say, LX, 160 + B.bh + 96, { size: 19, weight: 600, color: COL.soft });
        if (q.aux) txt(g, `${PH.AUX[q.aux].q} → ${PH.AUX[q.aux].a}`, LX, 160 + B.bh + 130, { size: 17, weight: 600, color: COL.ante });
        else if (q.shape === 'yn' && Sx.offer) txt(g, Sx.offer, LX, 160 + B.bh + 130, { size: 16, weight: 600, color: COL.muted });
        answer(g, { x: LX, y: 160 + B.bh + 160, w: 1100, A: a, all: true, u: 99, size: 26, maxW: 900, verdict: { ok: true, at: -1 } });
        return;
      }
      if (S.aux) {
        const q = PH.Q[S.aux.q], a = OT(S.aux.a, S.aux.v), C = Object.assign({}, D, S.aux.card || {});
        const r = exch(g, 99, { q, at: -9, ok: a, card: C, y: 160, qo: { all: true } });
        whyLine(g, PH.judge(q, a, C), r.y + 30, 780, LX);
        auxTable(g, RX, 150, RW, { hl: q.aux });
        return;
      }
      // [0.4, 11] 모양 넷
      const SH4 = PH.SCENE.shapes, RY = [150, 248, 346, 444], AT = [[0.8, 1.8], [2.8, 3.8], [5.0, 6.0, 7.2], [7.8, 8.8, 9.8]];
      fade(g, 1 - ramp(u, 10.8, 0.4), () => SH4.forEach(([qid, bad, ok], k) => {
        const [at, aAt, mAt] = AT[k];
        if (u < at - 0.4) return;
        const y = RY[k], q = PH.Q[qid], useBad = k >= 2;
        const B = staff(g, qid, { x: LX, y, w: 600, at, u, roleAt: at + 0.6, size: 20, shape: false });
        fade(g, ramp(u, at + 0.8, 0.4), () => shapeTag(g, q.shape, LX + 66, y + B.bh + 20, { size: 14, h: 28 }));
        answer(g, { x: 640, y: y + 4, w: 560, A: useBad ? bad : ok, B: useBad && u >= mAt ? ok : null, p: (u - (mAt || 0)) / 0.7, at: aAt, u, size: 22,
          trapAt: useBad ? aAt + 0.5 : null, strikeAt: useBad ? aAt + 0.6 : null,
          verdict: useBad ? (u >= mAt + 0.7 ? { ok: okOn(qid, ok), at: mAt + 0.7 } : null) : { ok: okOn(qid, ok), at: aAt + 0.6 },
          tag: useBad ? [k === 2 ? '고르는 질문에 Yes → 고른 것이 없어요' : '정보 질문에 Yes → 대답이 아니에요', COL.trap, aAt + 0.7, mAt] : null, tagY: y + 76 });
      }));
      // [11, 17] 첫 낱말의 짝
      if (u >= 10.8 && u < 17.6) fade(g, ramp(u, 11.0, 0.4) * (1 - ramp(u, 17.0, 0.4)), () => {
        const AX = [[11.4, 12.0, 12.8], [13.2, 13.8, 14.6], [15.0, 15.5, 16.1]];
        PH.SCENE.aux.forEach(([qid, bad, ok], k) => {
          const [at, aAt, mAt] = AX[k];
          if (u < at - 0.4) return;
          const y = 150 + k * 112, q = PH.Q[qid];
          staff(g, qid, { x: LX, y, w: 440, at, u, size: 20, shape: false, text: q.short || q.en });
          answer(g, { x: 500, y: y + 52, w: 380, A: bad, B: u >= mAt ? ok : null, p: (u - mAt) / 0.6, at: aAt, u, size: 21, trapAt: aAt + 0.3, strikeAt: aAt + 0.4, verdict: u >= mAt + 0.6 ? { ok: okOn(qid, ok), at: mAt + 0.6 } : null });
        });
        auxTable(g, RX, 150, RW, { hl: u < 13.2 ? 'do' : u < 15.0 ? 'be' : 'do', u, at: 11.2 });
      });
      // [17, 22.5] 다른 약: eat × → take ✓
      if (u >= 17.0 && u < 22.8) fade(g, ramp(u, 17.2, 0.4) * (1 - ramp(u, 22.4, 0.4)), () => {
        const [oq, eat, no, yes] = PH.SCENE.other, C = Object.assign({}, D, { other: 'vitamin' });
        const B = staff(g, oq, { x: LX, y: 150, w: 780, at: 17.4, u, roleAt: 18.0, size: 22, shapeAt: 18.2 });
        const y = 150 + B.bh + 14;
        const A = answer(g, { x: LX, y, w: 780, A: eat, B: u >= 20.0 ? yes : null, p: (u - 20.0) / 0.7, at: 18.4, u, size: 23, trapAt: 19.0, strikeAt: 19.1, tag: ['약은 eat이 아니라 take', COL.trap, 19.3, 20.0], tagY: y + 78, verdict: u >= 20.8 ? { ok: okOn(oq, yes, C), at: 20.8 } : null });
        fade(g, ramp(u, 21.0, 0.4), () => answer(g, { x: LX, y: y + A.bh + 14, w: 780, A: no, all: true, u: 99, size: 20, edge: 'rgba(242,194,154,0.25)' }));
        fade(g, ramp(u, 21.0, 0.4), () => tag(g, '다른 약이 없으면', LX + 260, y + A.bh + 40, COL.muted, { align: 'right', size: 14, h: 28 }));
        notePanel(g, RX, 150, RW, 'eat · take', [
          ['eat breakfast · eat an apple', 'eat → 밥 · 음식', COL.soft],
          ['take medicine · take two tablets', 'take → 약 (알약 · 물약 · 캡슐)', COL.clause],
        ], { u, at: 19.2, step: 0.6 });
      });
      // [22.5, 28] 빠른 말 → 다시 묻기
      if (u >= 22.4 && u < 28.4) fade(g, ramp(u, 22.6, 0.4) * (1 - ramp(u, 28.0, 0.4)), () => {
        const [qf, bad, rp] = PH.SCENE.fast;
        exch(g, u, { q: qf, at: 22.8, aAt: 24.2, bad, ok: rp, mAt: 25.8, tag: '열쇠 낱말을 놓쳤는데 짐작했어요', tagY: 78, y: 150, w: 780, size: 23 });
        notePanel(g, RX, 150, RW, '빠른 말 · 앞이 빠져요', [
          ['You allergic to anything?', '빠르게 말하면 Are가 들리지 않아요', COL.soft],
          ['Are you allergic to anything?', '= 같은 질문 · Yes/No 질문', COL.ante, [['Are', 'trap']]],
        ], { u, at: 23.4, step: 0.8 });
      });
      // [28, 34] 이어서 들리는 말
      if (u >= 28.0) fade(g, ramp(u, 28.2, 0.4), () => {
        staff(g, 'ak_form', { x: LX, y: 150, w: 780, at: 28.4, u, roleAt: 28.8, size: 22, shapeAt: 29.0 });
        linked(g, PH.LINKED[0], LX + 10, 280, u, 29.2, 760);
      });
    },

    /* 04 복용법: 조각 넷 → 되짚지 않음 · eat · three times one day × → 틀린 조각만 고침 → 되짚기 ✓ → 빠른 말 → 값 → drowsy */
    dose(g, u) {
      if (S.line) {
        const s = S.line, C = Object.assign({}, D, { sym: s.sym, form: s.form, dk: 'ph' }), DD = PH.doseOf(C), a = { f: 'line', line: { words: s.words } };
        const B = talk(g, { side: 'L', x: LX, y: 150, w: 780, text: PH.say(DD), marks: [], kind: 'pharm', sp: 'us', all: true, u: 99, size: 21 });
        if (!s.words.length) txt(g, '아래 조각을 골라 들은 대로 되짚어 보세요.', LX, 150 + B.bh + 40, { size: 18, weight: 600, color: COL.muted });
        else {
          const A = answer(g, { x: LX, y: 150 + B.bh + 16, w: 780, A: a, all: true, u: 99, size: 21, maxW: 640, verdict: { ok: PH.checkLine(a.line, C).ok, at: -1 } });
          const fx = PH.fixLine(a.line, C);
          const T = talk(g, { side: 'L', x: LX, y: 150 + B.bh + A.bh + 30, w: 780, text: fx.en, marks: [], kind: 'pharm', sp: 'us', all: true, u: 99, size: 21 });
          const j = PH.checkLine(a.line, C), K = richLay(g, j.why, [], 15, 770, { weight: 600 });
          richDraw(g, K, LX, 150 + B.bh + A.bh + T.bh + 60, { color: j.ok ? COL.good : COL.trap });
        }
        doseDay(g, RX - 20, 150, 320, DD, {});
        medLabel(g, RX - 20, 300, 320, DD, { name: medName(s.sym, s.form) });
        return;
      }
      const LN = PH.L(PH.LINE.words);
      // 위: 약사의 안내 (18.4까지)
      let B = { bh: 0 };
      fade(g, 1 - ramp(u, 18.2, 0.4), () => { B = staff(g, 'ds_say', { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.2, size: 22, shapeAt: 2.4 }); });
      const y0 = 150 + B.bh + 16;
      // [2.4, 6.4] 조각 넷
      fade(g, win(u, 2.4, 6.5), () => {
        const CH = [[PH.AMT[D0.amt].t, '양'], [PH.FREQ[D0.freq].t, '하루 몇 번'], [PH.WHEN[D0.time].t, '언제'], [PH.LEN[D0.len].t, '며칠']];
        let x = LX;
        CH.forEach(([en, ko], k) => fade(g, ramp(u, 2.6 + k * 0.5, 0.35), () => {
          const c = chip(g, en, x, y0 + 30, { size: 17, weight: 700, color: COL.clause, fill: COL.panel2, stroke: 'rgba(127,224,168,0.55)', h: 38, r: 10, pad: 12 });
          txt(g, `${k + 1}. ${ko}`, x + 6, y0 + 64, { size: 14, weight: 700, color: COL.muted });
          if (k < 3) arrow(g, x + c.w + 4, y0 + 30, x + c.w + 22, y0 + 30, COL.faint, 1.8);
          say(c.x, c.y, c.w, c.h, en);
          x += c.w + 28;
        }));
        fade(g, ramp(u, 4.8, 0.4), () => txt(g, PH.sayKo(D0), LX, y0 + 110, { size: 17, weight: 600, color: COL.soft }));
      });
      // [6.5, 12.4] Okay. Thanks. × → eat × → three times one day ×
      const SEQ = [[PH.SCENE.lines[0][1], 6.6, 8.6, '되짚지 않으면 틀린 곳을 몰라요'], [PH.SCENE.lines[1][1], 8.6, 10.5, '약은 eat이 아니라 take'], [PH.SCENE.lines[2][1], 10.5, 12.5, 'three times one day → three times a day']];
      SEQ.forEach(([a, s, e, tg]) => {
        if (u < s - 0.2 || u > e + 0.2) return;
        fade(g, ramp(u, s, 0.3) * (1 - ramp(u, e - 0.3, 0.3)), () => answer(g, { x: LX, y: y0, w: 780, A: a, at: s + 0.2, u, size: 21, maxW: 640, trapAt: s + 0.7, strikeAt: s + 0.8, tag: [tg, COL.trap, s + 0.9], tagY: y0 + (a.f === 'line' ? 108 : 78) }));
      });
      // [12.6, 18.4] 하루 몇 번 × → 고쳐 줌 → 바른 되짚기 ✓
      const FQ = { f: 'line', line: PH.LINE_FREQ };
      fade(g, win(u, 12.6, 15.5, 0.3), () => {
        const A = answer(g, { x: LX, y: y0, w: 780, A: FQ, at: 12.8, u, size: 21, maxW: 640, verdict: { ok: okOn('ds_say', FQ), at: 13.6 } });
        talk(g, { side: 'L', x: LX, y: y0 + A.bh + 14, w: 780, text: PH.fixLine(PH.LINE_FREQ, D).en, marks: [[PH.FREQ[D0.freq].t, 'slot']], kind: 'pharm', sp: 'us', at: 14.0, u, size: 22 });
      });
      fade(g, ramp(u, 15.4, 0.3) * (1 - ramp(u, 18.2, 0.4)), () => {
        const A = answer(g, { x: LX, y: y0, w: 780, A: LN, at: 15.6, u, size: 21, maxW: 640, verdict: { ok: okOn('ds_say', LN), at: 16.6 } });
        talk(g, { side: 'L', x: LX, y: y0 + A.bh + 14, w: 780, text: "That's right!", kind: 'pharm', sp: 'us', at: 17.0, u, size: 22 });
        fade(g, ramp(u, 17.2, 0.4), () => tag(g, '양 → 하루 몇 번 → 언제 → 며칠, 들은 차례대로', LX + 780, y0 + A.bh + 92, COL.clause, { align: 'right', size: 15, h: 30 }));
      });
      // [18.5, 24] 빠른 말 → 놓친 조각만 묻기
      if (u >= 18.2 && u < 24.4) fade(g, ramp(u, 18.4, 0.4) * (1 - ramp(u, 24.0, 0.4)), () => {
        const [qf, line, rp] = PH.SCENE.dfast;
        const r = exch(g, u, { q: qf, at: 18.6, aAt: 19.8, bad: line, ok: rp, mAt: 21.4, tag: '빠른 말을 짐작해서 되짚었어요', tagY: 108, y: 150, w: 780, size: 21 });
        talk(g, { side: 'L', x: LX, y: r.y + 14, w: 780, text: 'Three times a day.', marks: [['Three times a day', 'slot']], kind: 'pharm', sp: 'us', at: 22.6, u, size: 22 });
      });
      // 오른쪽 [0.4, 24]: 하루 시간표 + 약 봉투 라벨
      fade(g, ramp(u, 0.6, 0.5) * (1 - ramp(u, 23.8, 0.4)), () => {
        const hl = u < 2.6 ? null : u < 6.5 ? ['amt', 'freq', 'time', 'len'][Math.min(3, Math.floor((u - 2.6) / 0.5))] : u >= 12.6 && u < 15.5 ? 'freq' : null;
        doseDay(g, RX - 20, 150, 320, D0, { p: ramp(u, 1.0, 4.0), wrong: u >= 13.6 && u < 15.5 ? Object.assign({}, D0, { freq: 'f2' }) : null });
        medLabel(g, RX - 20, 300, 320, D0, { name: medName('sorethroat', 'tablets'), hl });
      });
      // [24, 30] 값
      if (u >= 23.8 && u < 30.4) fade(g, ramp(u, 24.0, 0.4) * (1 - ramp(u, 30.0, 0.4)), () => {
        const [qc, c30, c13, lit, card] = PH.SCENE.cost;
        const B2 = staff(g, qc, { x: LX, y: 150, w: 780, at: 24.2, u, roleAt: 24.8, size: 22, shapeAt: 25.0 });
        const y = 150 + B2.bh + 14;
        const A1 = answer(g, { x: LX, y, w: 780, A: c30, B: u >= 26.4 ? c13 : null, p: (u - 26.4) / 0.7, at: 25.2, u, size: 23, trapAt: 25.7, tag: ['thirty fifty → 들은 값과 달라요', COL.trap, 25.8, 26.4], verdict: u >= 27.1 ? { ok: okOn(qc, c13), at: 27.1 } : null });
        const y2 = y + A1.bh + 16;
        fade(g, ramp(u, 27.6, 0.3), () => answer(g, { x: LX, y: y2, w: 780, A: lit, B: u >= 28.8 ? card : null, p: (u - 28.8) / 0.6, at: 27.8, u, size: 23, trapAt: 28.2, strikeAt: 28.3, tag: ['낱말만 옮긴 말 · 무엇이 괜찮은지 몰라요', COL.trap, 28.4, 28.8], tagY: y2 + 78, verdict: u >= 29.4 ? { ok: okOn(qc, card), at: 29.4 } : null }));
        pairsFig(g, RX, 150, RW, u, 24.6);
      });
      // [30, 36] 조심할 점: drowsy
      if (u >= 30.0) fade(g, ramp(u, 30.2, 0.4), () => {
        const [qw, what, okw] = PH.SCENE.warn;
        const B3 = staff(g, qw, { x: LX, y: 150, w: 780, at: 30.4, u, roleAt: 31.0, size: 21, shapeAt: 31.2 });
        let y = 150 + B3.bh + 14;
        const A = answer(g, { x: LX, y, w: 780, A: what, at: 32.0, u, size: 23, verdict: { ok: okOn(qw, what), at: 32.6 } });
        y += A.bh + 12;
        const T = talk(g, { side: 'L', x: LX, y, w: 780, text: 'It means sleepy. So, no driving today.', marks: [['sleepy', 'slot']], kind: 'pharm', sp: 'us', at: 33.0, u, size: 22 });
        answer(g, { x: LX, y: y + T.bh + 12, w: 780, A: okw, at: 34.6, u, size: 23, verdict: { ok: okOn(qw, okw), at: 35.2 } });
        medPack(g, RX, 176, 290, { name: 'COLD RELIEF', form: '20 TABLETS', drowsy: u >= 31.0 });
        fade(g, ramp(u, 33.4, 0.4), () => tag(g, 'drowsy = sleepy · 졸려요', RX + 145, 400, COL.clause, { align: 'center', size: 15, h: 30 }));
      });
    },

    /* 05 병원 접수: 예약 · 처음 · 이름과 철자 · 생년월일 · 읽기 · 보험 (오른쪽 접수 서류가 채워짐) */
    front(g, u) {
      if (S.front) {
        const s = S.front, C = Object.assign({}, D, { name: s.name, dob: s.dob, ins: s.ins });
        let r = exch(g, 99, { q: 'fr_name', at: -9, ok: OT('nm_sp', s.name), card: C, y: 150, qo: { all: true } });
        r = exch(g, 99, { q: 'fr_dob', at: -9, ok: OT('db_is', s.dob), card: C, y: r.y + 18, qo: { all: true } });
        exch(g, 99, { q: 'fr_ins', at: -9, ok: OT('is_yes', s.ins), card: C, y: r.y + 18, qo: { all: true } });
        patientForm(g, RX - 10, 150, 320, { name: s.name, dob: s.dob, ins: s.ins }, { fmt: 1 });
        return;
      }
      const SC = PH.SCENE;
      // [0.4, 6] 예약
      fade(g, win(u, 0.4, 6.0, 0.3), () => exch(g, u, { q: SC.appt[0], at: 0.8, aAt: 2.2, bad: SC.appt[1], ok: SC.appt[2], mAt: 3.8, tag: '‘의사 원해요’ → 퉁명스럽게 들려요 · a도 빠졌어요', tagY: 78 }));
      // [6, 11.5] 처음 왔나
      fade(g, win(u, 6.0, 11.5, 0.3), () => exch(g, u, { q: SC.first[0], at: 6.2, aAt: 7.4, bad: SC.first[1], ok: SC.first[2], mAt: 9.2, tag: 'I am first → ‘제가 1등이에요’처럼 들려요', tagY: 78 }));
      // [11.5, 17.5] 이름 · 철자
      fade(g, win(u, 11.5, 17.5, 0.3), () => {
        const r = exch(g, u, { q: SC.name[0], at: 11.7, aAt: 12.7, ok: SC.name[1] });
        exch(g, u, { q: SC.spell[0], at: 14.0, aAt: 14.8, bad: SC.spell[1], ok: SC.spell[2], mAt: 15.9, tag: '철자를 불러 달라는 부탁에 Yes만', tagY: 78, y: r.y + 18 });
      });
      // [17.5, 24] 생년월일: 숫자만 × → 달 이름 ✓
      fade(g, win(u, 17.5, 24.0, 0.3), () => {
        const r = exch(g, u, { q: SC.dob[0], at: 17.7, aAt: 18.9, bad: SC.dob[1], ok: SC.dob[2], mAt: 21.4, tag: '숫자만 한국식 순서 → 달과 날이 헷갈려요', tagY: 78 });
        fade(g, win(u, 19.8, 21.6, 0.3), () => {
          const y = r.y + 104;
          tag(g, '3월 4일? (March 4th)', LX + 200, y, COL.trap, { align: 'center', size: 16, h: 36 });
          tag(g, '4월 3일? (April 3rd)', LX + 520, y, COL.trap, { align: 'center', size: 16, h: 36 });
        });
      });
      // [24, 30] 읽기 · 미국 서류의 순서
      fade(g, win(u, 24.0, 30.0, 0.3), () => {
        const v = '2005-03-04', big = `It's ${PH.dateText(v)}.`;
        txt(g, big, LX, 200, { size: 38, weight: 800, color: COL.en });
        say(LX - 6, 172, tw(g, big, 38, 800) + 12, 56, big);
        const words = PH.dateWords(v).replace(',', '').split(' '), grp = [[words[0], '달 (이름)'], [words[1], '날 (서수)'], [words.slice(2).join(' '), '해']];
        let x = LX;
        grp.forEach(([w, ko], k) => fade(g, ramp(u, 24.6 + k * 0.5, 0.35), () => {
          const c = chip(g, w, x, 270, { size: 19, weight: 700, color: COL.clause, fill: COL.panel2, stroke: 'rgba(127,224,168,0.55)', h: 42, r: 10, pad: 14 });
          txt(g, ko, x + 6, 306, { size: 14, weight: 700, color: COL.muted });
          say(c.x, c.y, c.w, c.h, w);
          x += c.w + 18;
        }));
        fade(g, ramp(u, 26.6, 0.4), () => {
          panel(g, LX, 350, 780, 110, { fill: COL.panel, stroke: COL.faint });
          txt(g, '미국 서류', LX + 20, 382, { size: 16, weight: 700, color: COL.muted });
          txt(g, '03 / 04 / 2005', LX + 150, 382, { size: 22, weight: 800, fam: FM, color: COL.rel });
          txt(g, '달 · 날 · 해', LX + 400, 382, { size: 16, weight: 700, color: COL.rel });
          txt(g, '한국 서류', LX + 20, 428, { size: 16, weight: 700, color: COL.muted });
          txt(g, '2005. 3. 4.', LX + 150, 428, { size: 22, weight: 800, fam: FM, color: COL.soft });
          txt(g, '해 · 달 · 날', LX + 400, 428, { size: 16, weight: 700, color: COL.soft });
          fade(g, ramp(u, 27.6, 0.4), () => txt(g, '영국은 날 · 달 · 해 (04/03/2005)', LX + 760, 428, { size: 14, weight: 600, color: COL.muted, align: 'right' }));
        });
      });
      // [30, 36] 보험 · 서류
      fade(g, ramp(u, 30.0, 0.3), () => {
        const r = exch(g, u, { q: SC.ins[0], at: 30.2, aAt: 31.4, bad: SC.ins[1], ok: SC.ins[2], mAt: 33.0, tag: 'have 뒤가 비어 문장이 끝나지 않아요', tagY: 78, maxW: 640 });
        if (u >= 33.6) exch(g, u, { q: SC.fill[0], at: 34.2, aAt: 35.0, ok: SC.fill[1], y: r.y + 18 });
      });
      // 오른쪽: 접수 서류
      const SHOW = { appt: 4.6, first: 10.0, name: 13.4, dob: 22.0, ins: 33.6 };
      const hl = u < 6 ? 'appt' : u < 11.5 ? 'first' : u < 17.5 ? 'name' : u < 30 ? 'dob' : 'ins';
      fade(g, ramp(u, 0.6, 0.5), () => patientForm(g, RX - 10, 150, 320, { appt: false, first: true, name: 'kim', dob: '2005-03-04', ins: 'travel' }, { show: k => u >= SHOW[k], hl: u >= SHOW[hl] ? hl : null, fmt: ramp(u, 26.6, 0.4) }));
    },

    /* 06 진료실: 증상 설명 · 먹은 약 · 빠른 말 · 증상 넷 */
    doctor(g, u) {
      if (S.prob) {
        const s = S.prob, C = Object.assign({}, D, { sym: s.sym, part: PH.SYM[s.sym].part, took: s.took || null });
        const r = exch(g, 99, { q: 'dc_prob', at: -9, ok: OT(s.style === 'hurt' ? 'pb_hurt' : s.style === 'sick' ? 'cs_sick' : 'pb_have', s.style === 'have' ? s.sym : PH.SYM[s.sym].part), card: C, y: 150, qo: { all: true } });
        exch(g, 99, { q: 'dc_took', at: -9, ok: s.took ? OT(s.tk === 'ate' ? 'tk_ate' : 'tk_yes', s.took) : OT('tk_no'), card: C, y: r.y + 20, qo: { all: true } });
        symTable(g, RX, 150, RW, s.sym);
        return;
      }
      const SC = PH.SCENE, [pq, sick, have, hurt] = SC.prob;
      // [0.4, 12] 증상 설명
      fade(g, 1 - ramp(u, 11.8, 0.4), () => {
        const B = staff(g, pq, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.8, size: 22, shapeAt: 2.0 });
        const y = 150 + B.bh + 14;
        fade(g, 1 - ramp(u, 6.0, 0.3), () => answer(g, { x: LX, y, w: 780, A: sick, at: 3.0, u, size: 23, trapAt: 3.8, strikeAt: 3.9, tag: ['낱말 그대로 → 어색해요', COL.trap, 4.2], tagY: y + 78 }));
        if (u >= 6.0) fade(g, ramp(u, 6.2, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: have, at: 6.6, u, size: 23, verdict: { ok: okOn(pq, have), at: 7.3 } });
          answer(g, { x: LX, y: y + A.bh + 14, w: 780, A: hurt, at: 8.8, u, size: 23, verdict: { ok: okOn(pq, hurt), at: 9.5 } });
          fade(g, ramp(u, 9.8, 0.4), () => tag(g, 'I have + 증상 · My + 아픈 곳 + hurts', LX + 780, y + A.bh + 100, COL.clause, { align: 'right', size: 15, h: 30 }));
        });
        symTable(g, RX, 150, RW, u >= 6.6 ? 'sorethroat' : null, { u, at: 1.0, step: 0.25 });
      });
      // [12, 18] 먹은 약
      if (u >= 11.8 && u < 18.4) fade(g, ramp(u, 12.0, 0.4) * (1 - ramp(u, 18.0, 0.4)), () => {
        const [tq, ate, took] = SC.took;
        exch(g, u, { q: tq, at: 12.2, aAt: 13.6, bad: ate, ok: took, mAt: 15.4, tag: '약은 eat이 아니라 take · 지난 일은 took', tagY: 78 });
        medPack(g, RX, 176, 290, { name: 'COLD RELIEF', form: '20 TABLETS' });
        fade(g, ramp(u, 15.8, 0.4), () => tag(g, 'take → took (지난 일)', RX + 145, 400, COL.clause, { align: 'center', size: 15, h: 30 }));
      });
      // [18, 24] 빠른 말
      if (u >= 18.0 && u < 24.4) fade(g, ramp(u, 18.2, 0.4) * (1 - ramp(u, 24.0, 0.4)), () => {
        const [fq, bad, rp] = SC.pfast;
        const r = exch(g, u, { q: fq, at: 18.4, aAt: 19.8, bad, ok: rp, mAt: 21.4, tag: '못 들었는데 짐작했어요', tagY: 78 });
        talk(g, { side: 'L', x: LX, y: r.y + 14, w: 780, text: "Yes — what's the problem today?", marks: [['problem', 'key']], kind: 'doctor', sp: 'ca', at: 22.4, u, size: 22 });
        notePanel(g, RX, 150, RW, '같은 뜻 · 어디가 아파서 왔어요?', [
          ['What seems to be the problem?', '진료실에서 가장 흔한 첫 질문', COL.en],
          ['What brings you in today?', '오늘 무슨 일로 오셨어요?', COL.en],
          ["What's wrong?", '어디가 안 좋아요?', COL.en],
        ], { u, at: 19.0, step: 0.5 });
      });
      // [24, 30] 증상 넷 · 두 틀
      if (u >= 24.0) fade(g, ramp(u, 24.2, 0.4), () => {
        const X = [LX, LX + 260, LX + 640], Y0 = 160, RH = 66;
        panel(g, LX - 16, Y0 - 16, 1136, 50 + PH.SYM_IDS.length * RH, { fill: COL.panel, stroke: COL.faint });
        ['증상', 'I have + 증상', 'My + 아픈 곳 + hurts'].forEach((h, i) => txt(g, h, X[i] + 8, Y0 + 10, { size: 16, weight: 700, color: COL.muted }));
        PH.SYM_IDS.forEach((id, k) => fade(g, ramp(u, 24.6 + k * 0.4, 0.4), () => {
          const S0 = PH.SYM[id], P0 = PH.PART[S0.part], y = Y0 + 52 + k * RH, a1 = `I have ${S0.en}.`, a2 = `My ${P0.n} hurts.`;
          txt(g, S0.ko, X[0] + 8, y, { size: 18, weight: 700 });
          pieces(g, [['I have ', 'frame'], [S0.en, 'slot'], ['.', 'frame']], X[1] + 8, y, 22, 360);
          pieces(g, [['My ', 'frame'], [P0.n, 'slot'], [' hurts.', 'frame']], X[2] + 8, y, 22, 420);
          say(X[1], y - 22, 360, 44, a1); say(X[2], y - 22, 420, 44, a2);
        }));
      });
    },

    /* 07 진찰: 아픈 자리 · 누르면 · 몇 점 · 알레르기 (Are you ↔ Do you) · 알레르기가 있다면 */
    exam(g, u) {
      if (S.exam) {
        const s = S.exam, C = Object.assign({}, D, { part: s.part, press: s.press, scale: s.scale });
        let r = exch(g, 99, { q: 'ex_where', at: -9, ok: OT('wh_in', s.part), card: C, y: 150, qo: { all: true } });
        r = exch(g, 99, { q: 'ex_press', at: -9, ok: OT(s.press ? 'pr_yes' : 'pr_no'), card: C, y: r.y + 16, qo: { all: true } });
        exch(g, 99, { q: 'ex_scale', at: -9, ok: OT('sc_about', s.scale), card: C, y: r.y + 16, qo: { all: true } });
        bodyFig(g, RX + 150, 330, 1.4, { hl: s.part, press: s.press ? s.part : null });
        return;
      }
      const SC = PH.SCENE;
      // [0.4, 6.5] 아픈 자리
      fade(g, win(u, 0.4, 6.5, 0.3), () => exch(g, u, { q: SC.where[0], at: 0.8, aAt: 2.0, bad: SC.where[1], ok: SC.where[2], mAt: 3.8, tag: '낱말 그대로 옮긴 틀린 문장', tagY: 78 }));
      // [6.5, 12.5] 누르면
      fade(g, win(u, 6.5, 12.5, 0.3), () => {
        const r = exch(g, u, { q: SC.press[0], at: 6.7, aAt: 8.0, bad: SC.press[1], ok: SC.press[2], mAt: 9.8, tag: 'Does로 물었는데 is → 짝이 어긋나요', tagY: 78 });
        fade(g, ramp(u, 10.6, 0.4), () => tag(g, "Does it …? → Yes, it does. · No, it doesn't.", LX + 780, r.y + 40, COL.ante, { align: 'right', size: 15, h: 30 }));
      });
      // [12.5, 20] 아픈 정도
      fade(g, win(u, 12.5, 20.0, 0.3), () => {
        exch(g, u, { q: SC.scale[0], at: 12.7, aAt: 14.2, bad: SC.scale[1], ok: SC.scale[2], mAt: 16.2, tag: 'Very pain → 틀린 문장 · 숫자도 없어요', tagY: 78 });
        fade(g, ramp(u, 13.4, 0.4), () => painScale(g, LX, 420, 780, u >= 16.9 ? 6 : null));
      });
      // 오른쪽 [0.4, 20]: 몸 (아픈 곳 · 누르는 손)
      fade(g, ramp(u, 0.6, 0.5) * (1 - ramp(u, 19.8, 0.4)), () => bodyFig(g, RX + 150, 330, 1.4, { hl: u >= 4.4 ? 'throat' : null, press: u >= 7.4 && u < 12.5 ? 'throat' : null }));
      // [20, 27] 알레르기: Are you (약국) ↔ Do you (병원)
      fade(g, win(u, 20.0, 27.0, 0.3), () => {
        const [aq, bad, ok] = SC.allergy;
        exch(g, u, { q: aq, at: 20.2, aAt: 21.6, bad, ok, mAt: 23.4, tag: 'Do you로 물었는데 I\'m not → 짝이 어긋나요', tagY: 78 });
        notePanel(g, RX, 150, RW, '같은 질문 · 첫 낱말이 달라요', [
          ['Are you allergic to any medicine?', "약국 → No, I'm not.", COL.soft, [['Are you', 'key']]],
          ['Do you have any allergies to medication?', "병원 → No, I don't.", COL.soft, [['Do you', 'key']]],
        ], { u, at: 21.0, step: 2.4 });
      });
      // [27, 34] 알레르기가 있다면
      if (u >= 26.8) fade(g, ramp(u, 27.0, 0.4), () => {
        label(g, '알레르기가 있다면', LX, 160, { color: COL.accent, size: 15 });
        const C2 = Object.assign({}, D, { allergy: 'penicillin' });
        const r = exch(g, u, { q: 'ex_allergy', at: 27.2, aAt: 28.2, ok: OT('al_yes', 'penicillin'), card: C2, y: 182 });
        const T = talk(g, { side: 'L', x: LX, y: r.y + 14, w: 780, text: "Thanks for telling me. That's important.", marks: [], kind: 'doctor', sp: 'ca', at: 29.6, u, size: 22 });
        talk(g, { side: 'L', x: LX, y: r.y + T.bh + 26, w: 780, text: "Since you're allergic to penicillin, I'll give you a different antibiotic.", marks: [['a different antibiotic', 'slot']], kind: 'doctor', sp: 'ca', at: 31.2, u, size: 21 });
        notePanel(g, RX, 160, RW, "I'm allergic to + 약 · 꼭 말해요", Object.values(PH.SLOT.allergen.vals).map(v => [`I'm allergic to ${v.t}.`, `${v.ko}에 알레르기가 있어요`, COL.clause]), { u, at: 28.6, step: 0.4 });
      });
    },

    /* 08 처방 · 다음 진료 · 진단서 */
    plan(g, u) {
      if (S.plan) {
        const s = S.plan, C = Object.assign({}, D, { sym: s.sym, allergy: s.allergy || null, dk: 'rx' }), DD = PH.doseOf(C), a = { f: 'line', line: { words: s.words } };
        const B = talk(g, { side: 'L', x: LX, y: 150, w: 780, text: PH.rxSay(s.sym, s.allergy || null), marks: [], kind: 'doctor', sp: 'ca', all: true, u: 99, size: 20 });
        if (!s.words.length) txt(g, '아래 조각을 골라 들은 대로 되짚어 보세요.', LX, 150 + B.bh + 40, { size: 18, weight: 600, color: COL.muted });
        else {
          const A = answer(g, { x: LX, y: 150 + B.bh + 16, w: 780, A: a, all: true, u: 99, size: 21, maxW: 640, verdict: { ok: PH.checkLine(a.line, C).ok, at: -1 } });
          const fx = PH.fixLine(a.line, C);
          const T = talk(g, { side: 'L', x: LX, y: 150 + B.bh + A.bh + 30, w: 780, text: fx.en, marks: [], kind: 'doctor', sp: 'ca', all: true, u: 99, size: 21 });
          const j = PH.checkLine(a.line, C), K = richLay(g, j.why, [], 15, 770, { weight: 600 });
          richDraw(g, K, LX, 150 + B.bh + A.bh + T.bh + 60, { color: j.ok ? COL.good : COL.trap });
        }
        medLabel(g, RX - 20, 150, 320, DD, { rx: true, name: rxName(s.sym, s.allergy) });
        doseDay(g, RX - 20, 390, 320, DD, {});
        return;
      }
      const SC = PH.SCENE, LR = SC.rx;
      let B = { bh: 0 };
      fade(g, 1 - ramp(u, 18.2, 0.4), () => { B = staff(g, 'pl_rx', { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.4, size: 21, shapeAt: 4.4 }); });
      const y0 = 150 + B.bh + 16;
      // [0.4, 6.5] 처방 듣기 (한국어 풀이)
      fade(g, win(u, 3.0, 6.6), () => txt(g, PH.rxSayKo('sorethroat', null), LX, y0 + 30, { size: fit(g, PH.rxSayKo('sorethroat', null), 17, 780, 600), weight: 600, color: COL.soft }));
      // [6.5, 12.5] 되짚지 않음 × → 하루 세 번 × → 고쳐 줌
      fade(g, win(u, 6.6, 8.8, 0.3), () => answer(g, { x: LX, y: y0, w: 780, A: LR[0][1], at: 6.8, u, size: 21, trapAt: 7.3, strikeAt: 7.4, tag: ['되짚지 않았어요', COL.trap, 7.5] }));
      fade(g, win(u, 8.8, 12.5, 0.3), () => {
        const A = answer(g, { x: LX, y: y0, w: 780, A: LR[1][1], at: 9.0, u, size: 21, maxW: 640, verdict: { ok: okOn('pl_rx', LR[1][1]), at: 9.8 } });
        talk(g, { side: 'L', x: LX, y: y0 + A.bh + 14, w: 780, text: PH.fixLine(PH.LINE_RXF, Object.assign({}, D, { dk: 'rx' })).en, marks: [[PH.FREQ[R0.freq].t, 'slot']], kind: 'doctor', sp: 'ca', at: 10.4, u, size: 22 });
      });
      // [12.5, 18.4] 바른 되짚기 ✓
      fade(g, ramp(u, 12.5, 0.3) * (1 - ramp(u, 18.2, 0.4)), () => {
        const A = answer(g, { x: LX, y: y0, w: 780, A: LR[2][1], at: 12.7, u, size: 21, maxW: 640, verdict: { ok: okOn('pl_rx', LR[2][1]), at: 13.8 } });
        talk(g, { side: 'L', x: LX, y: y0 + A.bh + 14, w: 780, text: "That's right!", kind: 'doctor', sp: 'ca', at: 14.4, u, size: 22 });
        fade(g, ramp(u, 15.0, 0.4), () => tag(g, '처방도 약국과 같은 틀 → So, I take …?', LX + 780, y0 + A.bh + 92, COL.clause, { align: 'right', size: 15, h: 30 }));
      });
      // 오른쪽 [0.4, 18.4]: 처방 라벨 + 하루 시간표
      fade(g, ramp(u, 0.6, 0.5) * (1 - ramp(u, 18.2, 0.4)), () => {
        const hl = u < 1.6 ? null : u < 6.5 ? ['amt', 'freq', 'time', 'len'][Math.min(3, Math.floor((u - 1.6) / 0.9))] : u >= 9.8 && u < 12.5 ? 'freq' : null;
        medLabel(g, RX - 20, 150, 320, R0, { rx: true, name: rxName('sorethroat', null), hl });
        doseDay(g, RX - 20, 390, 320, R0, { p: ramp(u, 1.4, 4.0), wrong: u >= 9.8 && u < 12.5 ? Object.assign({}, R0, { freq: 'f3' }) : null });
      });
      // [18.5, 24.5] 다시 올 날
      if (u >= 18.2 && u < 24.8) fade(g, ramp(u, 18.4, 0.4) * (1 - ramp(u, 24.4, 0.4)), () => {
        const [bq, okA, w1, d3] = SC.back;
        const B2 = staff(g, bq, { x: LX, y: 150, w: 780, at: 18.6, u, roleAt: 19.2, size: 21, shapeAt: 19.4 });
        const y = 150 + B2.bh + 14;
        const A1 = answer(g, { x: LX, y, w: 780, A: okA, at: 19.8, u, size: 22, trapAt: 20.3, strikeAt: 20.4, tag: ['숫자를 되짚지 않았어요', COL.trap, 20.5] });
        const y2 = y + A1.bh + 14;
        fade(g, ramp(u, 21.0, 0.3), () => answer(g, { x: LX, y: y2, w: 780, A: w1, B: u >= 22.4 ? d3 : null, p: (u - 22.4) / 0.7, at: 21.2, u, size: 22, maxW: 640, trapAt: 21.7, tag: ['a week → 들은 숫자와 달라요', COL.trap, 21.8, 22.4], tagY: y2 + 78, verdict: u >= 23.2 ? { ok: okOn(bq, d3), at: 23.2 } : null }));
        calFig(g, RX - 10, 160, 320, u >= 23.2 ? 'd3' : null, { wrong: u >= 21.8 && u < 22.4 ? 'w1' : null });
        fade(g, ramp(u, 19.6, 0.4), () => txt(g, PH.backSayKo('d3'), RX + 150, 300, { size: fit(g, PH.backSayKo('d3'), 14, 300, 600), weight: 600, color: COL.soft, align: 'center' }));
      });
      // [24.5, 36] 질문 · 진단서
      if (u >= 24.4) fade(g, ramp(u, 24.6, 0.4), () => {
        const [qq, diag, yes, note] = SC.q;
        const B3 = staff(g, qq, { x: LX, y: 150, w: 780, at: 24.8, u, roleAt: 25.4, size: 22, shapeAt: 25.6 });
        const y = 150 + B3.bh + 14;
        fade(g, win(u, 25.8, 28.4, 0.3), () => answer(g, { x: LX, y, w: 780, A: diag, at: 26.0, u, size: 23, maxW: 640, trapAt: 26.6, strikeAt: 26.7, tag: ['diagnosis → 진단(병의 이름)이에요', COL.trap, 26.9], tagY: y + 78 }));
        if (u >= 28.2) fade(g, ramp(u, 28.4, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: yes, B: u >= 30.6 ? note : null, p: (u - 30.6) / 0.7, at: 28.6, u, size: 23, maxW: 640, trapAt: 29.2, tag: ['Yes만 → 물어볼 것을 바로 물어요', COL.trap, 29.4, 30.6], tagY: y + 78, verdict: u >= 31.4 ? { ok: okOn(qq, note), at: 31.4 } : null });
          if (u >= 31.8) talk(g, { side: 'L', x: LX, y: y + A.bh + 14, w: 780, text: PH.reply(PH.Q.pl_q, note, D), marks: [], kind: 'doctor', sp: 'ca', at: 32.0, u, size: 21 });
        });
        fade(g, win(u, 25.8, 32.6, 0.3), () => notePanel(g, RX, 150, RW, '진단서 · 확인서', [
          ['a diagnosis', '진단 · 병의 이름 (strep throat …)', COL.soft],
          ["a doctor's note", '학교 · 회사에 내는 확인서', COL.clause],
          ['a sick note', '영국에서 쓰는 말', COL.clause],
        ], { u, at: 26.4, step: 0.6 }));
        if (u >= 32.4) fade(g, ramp(u, 32.6, 0.4), () => docNote(g, RX - 10, 150, 320, { p: ramp(u, 32.8, 2.6) }));
      });
    },

    /* 09 3단계 말하기 법 */
    method(g, u) {
      const BOX = [['①', '열쇠 낱말 + 모양', 'or → 고르기 · How long → 정보 · Do you · Are you → Y/N', COL.ante, 5.5], ['②', '틀에 내 정보 넣기', 'I have a sore throat. · So, I take …? (되짚기)', COL.rel, 11.5], ['③', '공손하게 끝내기', 'Could you …? · please · thanks · Sorry, …?', COL.verb, 17.5]];
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
      PH.METHOD.forEach(([qid, a], i) => {
        const y = 300 + i * 39, q = PH.Q[qid], p = PH.PLACE[q.place], dim = sel != null && sel !== i;
        fade(g, ramp(u, 1.4 + i * 0.3, 0.4) * (dim ? 0.35 : 1), () => {
          if (sel === i) { rr(g, LX - 6, y - 18, 1132, 36, 8); g.fillStyle = 'rgba(255,193,94,0.10)'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 1.5; g.stroke(); }
          circ(g, LX + 14, y, 15, COL.panel2); icon(g, p.id, LX + 14, y, 18, ME_FIRST[p.id] ? COL.verb : COL.soft);
          const keysOn = sel != null || u >= 6.0 + i * 0.3, ansOn = sel != null || u >= 12.0 + i * 0.4, polOn = sel != null || u >= 18.0;
          if (keysOn) shapeMark(g, q.shape, LX + 50, y, 16, { disc: false, iw: 2.2 });
          const t = q.short && /[?!.]$/.test(q.short) && q.short.length < 46 ? q.short : q.en;
          const R = richLay(g, t, keysOn ? Qm(qid) : [], 17, 430, { weight: 500 });
          if (R.rows > 1) { const t2 = q.short || q.en; txt(g, t2, LX + 70, y, { size: fit(g, t2, 17, 440, 500), weight: 500, color: COL.soft }); }
          else richDraw(g, R, LX + 70, y, { color: COL.soft });
          say(LX + 66, y - 16, Math.min(R.w, 440) + 8, 32, q.en);
          if (ansOn) fade(g, sel != null ? 1 : ramp(u, 12.0 + i * 0.4, 0.4), () => {
            txt(g, '→', 566, y, { size: 18, weight: 700, color: COL.muted });
            pieces(g, shortParts(a).map(([tt, r]) => [tt, r === 'pol' && !polOn ? 'frame' : r]), 598, y, 18, 600);
            say(594, y - 16, 606, 32, PH.text(a));
          });
        });
      });
    },

    /* 10 실전: 환자 카드 하나로 넷 */
    practice(g, u) {
      const pi = u < PSEG[1] ? 0 : u < PSEG[2] ? 1 : u < PSEG[3] ? 2 : 3, v = u - PSEG[pi];
      const P = PH.PRACTICE[pi], C = PH.PCARD, q = PH.practiceQ(P);
      const a = ramp(v, 0, 0.5) * (pi < 3 ? 1 - ramp(u, PSEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `대화 ${pi + 1} / 4 · ${PH.PLACE[q.place].ko}`, LX, 150, { size: 16, weight: 500, fam: FM, color: COL.accent });
        patientCard(g, LX, 168, 336, C, { rh: 30, vs: 13.5, rows: PROWS, hl: { ak_form: 1, ds_say: 1, fr_dob: 2, pl_q: 3 }[P.q] });
        talk(g, { side: 'L', x: 432, y: 172, w: 768, text: q.en, marks: Qm(q), kind: kindOf(q), sp: q.sp, at: PT.q, u: v, roleAt: PT.lines[0] + 0.4, size: q.en.length > 80 ? 19 : 22, shape: q.shape, shapeAt: PT.lines[0] + 0.4 });
        const J = P.opts.map(o => PH.judge(q, o, C));
        const goneAt = k => { const s = J[k].stage; if (!s) return null; const same = P.opts.map((_, i) => i).filter(i => J[i].stage === s); return [0, PT.s1, PT.s2, PT.s3][s] + same.indexOf(k) * 1.1; };
        const oy0 = q.en.length > 80 ? 300 : 262;
        P.opts.forEach((o, k) => {
          const y = oy0 + k * (q.en.length > 80 ? 52 : 60), gA = goneAt(k), won = k === P.a && v >= PT.win;
          fade(g, ramp(v, PT.opt[k], 0.4), () => {
            const isLine = o.f === 'line', hh = isLine ? 54 : 48;
            if (won) { rr(g, 432, y - hh / 2, 768, hh, 10); g.fillStyle = 'rgba(127,224,168,0.08)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
            const gone = gA != null && v >= gA, rolesOn = v >= PT.lines[1] + 0.4 || won;
            txt(g, `(${'ABC'[k]})`, 446, y, { size: 18, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
            let w;
            if (isLine) { const R = wrapAns(g, o, 494, y, 17, 590, { dim: gone, plain: !rolesOn }); w = R.w; }
            else w = pieces(g, ansParts(o).map(([t, r]) => [t, gone ? 'dim' : rolesOn ? r : '']), 494, y, 19, 560, { color: gone ? COL.dim : COL.text });
            say(490, y - hh / 2, w + 10, hh, PH.text(o));
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
        ['counter', '약국 카운터', 'wh', 'What can I get for you today?', [['I have ', 'frame'], ['a sore throat', 'slot'], ['. ', 'frame'], ['Could you recommend something for it?', 'pol']]],
        ['ask', '약사의 질문', 'yn', 'Do you … · Are you … · Tablets or liquid?', [["No, I don't. · No, I'm not. · ", 'frame'], ['Tablets', 'slot'], [', ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        ['dose', '복용법 · 값', 'note', 'Take two tablets three times a day …', [['So, I take ', 'frame'], ['two tablets', 'slot'], [' … ', 'frame'], ['for five days', 'slot'], ['? · ', 'frame'], ['Sorry', 'pol'], [', did you say ', 'frame'], ['$13.50', 'slot'], ['?', 'frame']], 'So, I take two tablets, three times a day, after meals, for five days? Sorry, did you say $13.50?'],
        ['front', '병원 접수', 'wh', 'last name · spell · date of birth', [["It's ", 'frame'], ['Kim, K-I-M', 'slot'], [". · It's ", 'frame'], ['March 4th, 2005', 'slot'], ['.', 'frame']]],
        ['doctor', '진료실', 'wh', 'What seems to be the problem? · taken anything', [['I have ', 'frame'], ['a sore throat', 'slot'], ['. · Yes, I took some ', 'frame'], ['cold medicine', 'slot'], ['.', 'frame']]],
        ['exam', '진찰', 'yn', 'Where · Does it hurt · scale of one to ten', [['It hurts ', 'frame'], ['in my throat', 'slot'], ['. · Yes, it does. · About ', 'frame'], ['a six', 'slot'], ['.', 'frame']]],
        ['plan', '처방 · 다음 진료', 'note', 'Take one capsule … · come back in …', [['So, I should come back in ', 'frame'], ['three days', 'slot'], ['? · ', 'frame'], ['Could I', 'pol'], [" get a doctor's note?", 'frame']]],
        [null, '되짚기', null, '복용법 · 값 · 다시 올 날은 조각으로', [['So, ', 'frame'], ['…', 'slot'], ['? → ', 'frame'], ["That's right! · Not quite — three times a day.", 'frame']], "That's right! Not quite — three times a day."],
        [null, '못 알아들었을 때', null, '빠른 말 · 모르는 낱말', [['Sorry', 'pol'], [', how many times a day? · ', 'frame'], ['Sorry', 'pol'], [', what does drowsy mean?', 'frame']]],
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
        else txt(g, ri === 7 ? 'So' : '?', X[0] + 32, y + 1, { size: ri === 7 ? 13 : 18, weight: 800, color: COL.verb, align: 'center' });
        txt(g, nm, X[0] + 58, y, { size: fit(g, nm, 18, X[1] - X[0] - 70, 700), weight: 700 });
        if (sh) shapeMark(g, sh, X[1] + 26, y, 15, { disc: false, iw: 2.2 });
        txt(g, keys, X[1] + (sh ? 44 : 20), y, { size: fit(g, keys, 15, X[2] - X[1] - (sh ? 56 : 34), 600), weight: 600, color: COL.ante });
        const w = pieces(g, ans, X[2] + 20, y, 16.5, 1196 - X[2] - 30);
        say(X[2] + 16, y - 18, w + 8, 36, sayT || ans.map(p => p[0]).join(''));
      }));
    },
  };
  // 실전 장면의 환자 카드 줄 (PH.PCARD와 같은 사실)
  const PC = PH.PCARD;
  const PROWS = [
    ['증상', `${PH.SYM[PC.sym].ko} · ${(PH.SLOT.sinceP.vals[PC.since] || PH.SLOT.durP.vals[PC.since] || {}).ko || ''}${PC.fever ? ' · 열이 있어요' : ' · 열은 없어요'}`],
    ['약국', `${PC.form === 'liquid' ? '물약' : '알약'}이 좋아요 · ${PC.paym === 'card' ? '카드' : '현금'}로 내요`],
    ['병원 접수', `성 ${PH.NAMES[PC.name].ko} · ${PH.dateKo(PC.dob)}`],
    ['진단서', PC.note ? '수업에 낼 진단서가 필요해요' : '필요 없어요'],
  ];
  PHS.PROWS = PROWS;

  // 이어서 들리는 말: 위 = 쓰인 낱말 (이어지는 곳은 호), 아래 = 들리는 소리 (세게 = 크고 높게)
  function linked(g, L, x, y, u, at, maxW) {
    fade(g, ramp(u, at, 0.4), () => {
      const size = 28, gap = 22; let xx = x; const pos = [];
      L.words.forEach(w => { const ww = tw(g, w, size, 600); pos.push([xx, ww]); xx += ww + gap; });
      L.words.forEach((w, i) => { txt(g, w, pos[i][0], y, { size, weight: 600, color: COL.en }); });
      listen(x - 6, y - 24, xx - x, 48, [{ text: L.say || L.en, sp: PH.Q[L.q] ? PH.Q[L.q].sp : 'us', rate: 1.2 }]);
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
  PHS.linked = linked;

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

  PHS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[PHS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    if (ch.place != null) strip(g, ch.place, ramp(u, 0.2, 0.5));
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, PHS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + PH.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔↗↘✓×÷?!~=+-–—/:…‘’\'%$&<>';
  PHS.baseText = EXTRA;
  PHS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = PHS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { PHS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
