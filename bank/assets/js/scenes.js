(function () {
  'use strict';
  const BK = window.BK;
  const BKS = (window.BKS = {});
  const W = 1280, H = 720;
  BKS.W = W; BKS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  BKS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', paper: '#F4F1E8', ink: '#1E2630', teal: '#2F4A44', wood: '#3A2E25', red: '#B8432B',
  };
  BKS.COL = COL;
  // 역할 → 색 (낱말 조각 · 말풍선 글)
  const RC = { key: COL.ante, frame: COL.rel, slot: COL.clause, pol: COL.verb, trap: COL.trap, ok: COL.good, dim: COL.dim, bad: COL.bad };
  BKS.RC = RC;
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8', me: '#F2C29A' };
  const SHC = { yn: COL.ante, or: COL.rel, wh: COL.clause, note: COL.verb };   // 모양 표시의 색
  BKS.SHC = SHC;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (BKS.S = { stop: null, place: null, fx: null, shape: null, num: null, aux: null, doc: null, line: null, card: null });
  BKS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  BKS.hits = () => HITS;

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
     곳 일곱(fx 환전 · shop 휴대폰 가게 · sim 유심 · teller 은행 창구 · id 신분증 · form 주소 · card 카드) + 질문의 모양 넷 + 그 밖의 그림
     ========================================================= */
  const ICON = {
    fx: [['M4.5 8.5h14l-3.4-3.4', 's'], ['M19.5 15.5h-14l3.4 3.4', 's']],
    shop: [['M8 3h8a1.6 1.6 0 0 1 1.6 1.6v14.8A1.6 1.6 0 0 1 16 21H8a1.6 1.6 0 0 1-1.6-1.6V4.6A1.6 1.6 0 0 1 8 3z', 's'], ['M10.5 18h3', 's']],
    sim: [['M7 3.5h7.5L18 7v13.5H7z', 's'], ['M9.5 10.5h5.5v7h-5.5z', 's'], ['M12.25 10.5v7M9.5 14h5.5', 's']],
    teller: [['M3.5 9.5 12 4l8.5 5.5z', 's'], ['M6 10.5v7M10 10.5v7M14 10.5v7M18 10.5v7', 's'], ['M3.5 20h17', 's']],
    id: [['M3.5 6h17v12h-17z', 's'], ['M8.5 11.4a1.9 1.9 0 1 0 0-3.8a1.9 1.9 0 0 0 0 3.8zM5.6 15.6a2.9 2.9 0 0 1 5.8 0', 's'], ['M13.5 9.5h4.5M13.5 13h3', 's']],
    form: [['M4 11 12 4.5l8 6.5', 's'], ['M6 9.8v9.7h12V9.8', 's'], ['M10 19.5v-5h4v5', 's']],
    card: [['M3.5 6h17v12h-17z', 's'], ['M3.5 10h17', 's'], ['M6.5 14.5h4', 's']],
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
  };
  BKS.ICON = ICON;

  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = (typeof Path2D === 'function' ? new Path2D(d) : null));
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const parts = ICON[id]; if (!parts) return;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach(([d, m]) => { const p = path(d); if (!p) return; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  BKS.icon = icon;
  // HTML용 SVG (색은 currentColor)
  BKS.iconSVG = (id, cls = '', fill) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : m === 'b' && fill ? `<path d="${d}" fill="${fill}"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 질문의 모양 표시: 그림 + 이름 (영상 · 직접 해 보기 · 힌트 · 퀴즈) ---------- */
  function shapeMark(g, shape, cx, cy, size, o = {}) {
    const c = o.color || SHC[shape];
    if (o.disc !== false) { circ(g, cx, cy, size * 0.72, o.fill || COL.panel2); ring(g, cx, cy, size * 0.72, c, o.lw || 2); }
    icon(g, 'shape_' + shape, cx, cy, size, c, o.iw || 2);
  }
  BKS.shapeMark = shapeMark;
  function shapeTag(g, shape, x, y, o = {}) {
    const Sx = BK.SHAPE[shape], t = o.text || `${Sx.ko} → ${Sx.ans}`, size = o.size || 16, h = o.h || 36, c = SHC[shape];
    const w = tw(g, t, size, 700) + h + 22, x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    rr(g, x0, y - h / 2, w, h, 10); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = c; g.lineWidth = 1.6; g.stroke();
    icon(g, 'shape_' + shape, x0 + h / 2 + 4, y, h * 0.62, c, 2);
    txt(g, t, x0 + h + 8, y + 1, { size, weight: 700, color: c });
    return { x: x0, y: y - h / 2, w, h };
  }
  BKS.shapeTag = shapeTag;

  /* ---------- 사람 얼굴 (말풍선 옆). kind: clerk(환전 창구 · 영국) · mobile(휴대폰 가게 · 호주) · teller(은행 창구 · 미국) · banker(계좌 담당 · 캐나다) · me ---------- */
  const LOOK = {
    clerk: { shirt: '#F4F6F8', coat: '#2E5A6A', hair: '#5A3A28', skin: '#E8BC95', badge: '#FFC15E', long: true },
    mobile: { shirt: '#E07A3A', hair: '#8A5A30', skin: '#E8BC95', lanyard: '#2F4A44', glasses: true },
    teller: { shirt: '#F4F6F8', coat: '#26324A', tie: '#B8432B', hair: '#3A2A20', skin: '#E3B48D', badge: '#6EC8FF' },
    banker: { shirt: '#DCE6F0', coat: '#4A3A5A', hair: '#2B2420', skin: '#C99169', glasses: true, long: true },
    me: { shirt: '#5D6FA8', hair: '#1F1B18', skin: '#E8BC95', scarf: '#7FA8C9', long: true },
  };
  BKS.LOOK = LOOK;
  const kindOf = q => { q = typeof q === 'string' ? BK.Q[q] : q; return q.sp === 'gb' ? 'clerk' : q.sp === 'au' ? 'mobile' : q.sp === 'ca' ? 'banker' : 'teller'; };
  BKS.kindOf = kindOf;
  function avatar(g, x, y, r, kind, o = {}) {
    const L = LOOK[kind] || LOOK.teller;
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
  BKS.avatar = avatar;



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
  BKS.richLay = richLay; BKS.richDraw = richDraw;

  /* ---------- 낱말 조각 (대답 만들기): { id, t, r } → lay · morph · drawTok ---------- */
  const PUNCT = /^[.,?!]$/;
  function ansToks(a, o = {}) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    BK.segs(a).forEach(s => s.t.split(/\s+/).forEach(w => {
      if (!w) return;
      const m = w.match(/^(.*?)([.,?!]*)$/);
      if (m[1]) push(m[1], o.role != null ? o.role : s.r);
      if (m[2]) m[2].split('').forEach(p => push(p, ''));
    }));
    return out;
  }
  BKS.ansToks = ansToks;
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
      avatar(g, ax, ay, ar, o.kind || (side === 'L' ? 'teller' : 'me'), { live, sp: o.sp });
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
  BKS.talk = talk;
  // 직원의 말 (말 id로): 말풍선 + 열쇠 낱말 (+ 모양 표시)
  const Qobj = q => typeof q === 'string' ? BK.Q[q] : q;
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
    const said = LB && p > 0.5 ? (o.sayB || (o.B ? BK.text(o.B) : null)) : (o.sayA || (o.A ? BK.text(o.A) : null));
    if (!o.noHit && said) listen(bx, by, bw, bh, [{ text: said, sp: 'me' }]);
    return out;
  }
  BKS.answer = answer;
  const okOf = (q, a, c) => BK.judge(q, a, c || BK.DEMO).ok;

  /* ---------- 환전 · 휴대폰 · 은행 길 띠 (02–08장 위쪽) ---------- */
  function strip(g, cur, a = 1) {
    fade(g, a, () => {
      const x0 = 812, dx = 64, y = 92;
      g.strokeStyle = COL.faint; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 6, y); g.stroke();
      BK.PLACES.forEach((p, i) => {
        const x = x0 + i * dx, on = i === cur;
        circ(g, x, y, on ? 19 : 14, on ? COL.accent : i < cur ? '#2A3542' : COL.panel);
        ring(g, x, y, on ? 19 : 14, on ? COL.accent : BK.ME_FIRST[p.id] ? 'rgba(201,167,255,0.6)' : COL.faint, 1.5);
        icon(g, p.id, x, y, on ? 22 : 16, on ? '#1D1305' : i < cur ? COL.soft : COL.muted, on ? 2 : 1.8);
      });
      txt(g, `${cur + 1} / 7`, x0 + dx * 6 + 30, y, { size: 13, weight: 500, fam: FM, color: COL.muted });
    });
  }


  /* =========================================================
     은행 · 환전 · 휴대폰 그림: 환율 판 · 만 → thousand · 지폐 · 요금표 · 휴대폰 화면 · 번호 묶음 · 서류 카드 · 계좌 신청서 · 주소의 차례 · 숫자판 · 직불 카드 · 내 카드
     받을 달러 · 요금은 grammar.js(BK.fx · BK.planCost)로 계산해요. 은행 · 환율 · 요금 · 주소 · 번호는 모두 지어낸 예시예요
     ========================================================= */
  ICON.mail = [['M3.5 6h17v12h-17z', 's'], ['M3.5 6.5l8.5 6.5 8.5-6.5', 's']];
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
  BKS.paper = paper;

  // 환율 판 (지어낸 오늘의 환율). o: { won → 아래에 계산 줄, p: 계산 줄 나타나기 }
  function rateBoard(g, x, y, w, o = {}) {
    const h = o.won ? 206 : 134, R = `1 USD = ${BK.comma(BK.RATE)} KRW`;
    panel(g, x, y, w, h, { fill: '#0B1A14', stroke: 'rgba(127,224,168,0.45)', r: 12 });
    txt(g, 'CURRENCY EXCHANGE', x + 16, y + 22, { size: 12, weight: 700, fam: FM, color: COL.good });
    icon(g, 'fx', x + w - 26, y + 22, 18, COL.good);
    txt(g, "TODAY'S RATE", x + 16, y + 50, { size: 11, weight: 700, fam: FM, color: COL.muted });
    txt(g, R, x + 16, y + 80, { size: fit(g, R, 24, w - 32, 800, 12, FM), weight: 800, fam: FM, color: '#BFF5D2' });
    txt(g, 'NO COMMISSION · FOR EXAMPLE ONLY', x + 16, y + 112, { size: fit(g, 'NO COMMISSION · FOR EXAMPLE ONLY', 11, w - 32, 700, 8, FM), weight: 700, fam: FM, color: COL.muted });
    if (o.won) fade(g, o.p == null ? 1 : o.p, () => {
      g.fillStyle = 'rgba(127,224,168,0.25)'; g.fillRect(x + 16, y + 132, w - 32, 1.2);
      const t1 = `${BK.wonText(o.won)} ÷ ${BK.comma(BK.RATE)}`, t2 = `= ${BK.money(BK.fx(o.won))}`;
      txt(g, t1, x + 16, y + 156, { size: fit(g, t1, 16, w - 32, 700, 10, FM), weight: 700, fam: FM, color: COL.soft });
      txt(g, t2, x + 16, y + 186, { size: 24, weight: 800, fam: FM, color: COL.accent });
      say(x + 10, y + 168, w - 20, 34, BK.priceWords(BK.fx(o.won)));
    });
    return { h };
  }
  BKS.rateBoard = rateBoard;

  // 숫자를 자리 묶음으로 (오른쪽부터 n자리씩). sep: 묶음 사이 표시
  function digitGroups(g, s, n, x, y, size, color, sep, sepColor) {
    const ds = String(s).split(''), gs = [];
    for (let i = ds.length; i > 0; i -= n) gs.unshift(ds.slice(Math.max(0, i - n), i).join(''));
    let xx = x;
    gs.forEach((gp, k) => {
      if (k) xx += txt(g, sep, xx + 3, y, { size: size * 0.9, weight: 800, fam: FM, color: sepColor }) + 6;
      xx += txt(g, gp, xx, y, { size, weight: 800, fam: FM, color });
    });
    return xx - x;
  }
  // 만 → thousand: 한국어는 네 자리(만)씩, 영어는 세 자리(thousand)씩 끊어요. o: { p, traps: 0~1 }
  function manFig(g, x, y, w, won, o = {}) {
    const h = o.traps != null ? 316 : 220, p = o.p == null ? 1 : o.p;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '만 → thousand · 끊는 자리가 달라요', x + 16, y + 22, { size: fit(g, '만 → thousand · 끊는 자리가 달라요', 13.5, w - 32, 700), weight: 700, color: COL.muted });
    txt(g, '한국어 · 네 자리씩', x + 16, y + 54, { size: 12.5, weight: 700, color: COL.muted });
    digitGroups(g, won, 4, x + 16, y + 84, 24, COL.soft, '|', COL.rel);
    txt(g, `→ ${BK.manKo(won).replace(/ 원$/, '')}`, x + w - 16, y + 84, { size: 20, weight: 800, color: COL.rel, align: 'right' });
    fade(g, p, () => {
      txt(g, '영어 · 세 자리씩', x + 16, y + 122, { size: 12.5, weight: 700, color: COL.muted });
      digitGroups(g, won, 3, x + 16, y + 152, 24, COL.text, ',', COL.clause);
      const wd = BK.bigWords(won);
      txt(g, wd, x + 16, y + 190, { size: fit(g, wd, 19, w - 32, 800), weight: 800, color: COL.clause });
      say(x + 10, y + 172, w - 20, 36, BK.wonWords(won));
    });
    if (o.traps != null) fade(g, o.traps, () => {
      g.fillStyle = COL.faint; g.fillRect(x + 16, y + 216, w - 32, 1);
      BK.wonTraps(won).forEach((v, k) => {
        const yy = y + 244 + k * 34, en = BK.bigWords(v);
        txt(g, en, x + 16, yy, { size: fit(g, en, 16, w - 120, 700), weight: 700, color: COL.trap });
        txt(g, `= ${BK.manKo(v).replace(/ 원$/, '')}`, x + w - 16, yy, { size: 16, weight: 800, color: COL.trap, align: 'right' });
        say(x + 10, yy - 16, w - 20, 32, en);
      });
    });
    return { h };
  }
  BKS.manFig = manFig;

  // 지폐 (큰 지폐 50 · 100달러 · 작은 지폐 10 · 20달러). o: { sel }
  function billsFig(g, x, y, w, o = {}) {
    const h = 206;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, 'BILLS · 지폐', x + 16, y + 22, { size: 12, weight: 700, fam: FM, color: COL.muted });
    [['large', [100, 50]], ['small', [20, 10]]].forEach(([k, ns], i) => {
      const yy = y + 48 + i * 76, on = o.sel === k;
      if (on) { rr(g, x + 8, yy - 6, w - 16, 70, 10); g.fillStyle = 'rgba(127,224,168,0.10)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
      ns.forEach((n, j) => {
        const bx = x + 18 + j * 22, by = yy + j * 10;
        rr(g, bx, by, 92, 44, 5); g.fillStyle = '#D5E6CC'; g.fill(); g.strokeStyle = '#4A7A4A'; g.lineWidth = 1.5; g.stroke();
        ring(g, bx + 46, by + 22, 13, 'rgba(74,122,74,0.5)', 1.2);
        txt(g, '$' + n, bx + 46, by + 23, { size: 15, weight: 800, fam: FM, color: '#2F5A2F', align: 'center' });
      });
      const en = `${BK.BILLS[k].t} bills`;
      txt(g, en, x + 146, yy + 16, { size: 18, weight: 700, color: on ? COL.good : COL.en });
      txt(g, BK.BILLS[k].ko, x + 146, yy + 42, { size: fit(g, BK.BILLS[k].ko, 13, w - 160, 600), weight: 600, color: COL.muted });
      say(x + 140, yy, w - 150, 30, en);
    });
    return { h };
  }
  BKS.billsFig = billsFig;

  // 요금표 (한 달 · 지어낸 값). o: { plan, data }
  function planBoard(g, x, y, w, o = {}) {
    const cols = ['d15', 'd50', 'unl'], rows = ['prepaid', 'monthly'], h = 78 + rows.length * 46 + 30;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    icon(g, 'shop', x + 22, y + 22, 18, COL.muted);
    txt(g, `${BK.SHOP.toUpperCase()} · PLANS`, x + 40, y + 22, { size: fit(g, `${BK.SHOP.toUpperCase()} · PLANS`, 12, w - 56, 700, 8, FM), weight: 700, fam: FM, color: COL.muted });
    const lw = 82, cw = (w - 24 - lw) / 3, cx = i => x + 12 + lw + cw * i + cw / 2;
    cols.forEach((d, i) => { const t = d === 'unl' ? 'UNLIMITED' : BK.DATA[d].t; txt(g, t, cx(i), y + 60, { size: fit(g, t, 12.5, cw - 6, 700, 8, FM), weight: 700, fam: FM, color: o.data === d ? COL.accent : COL.soft, align: 'center' }); });
    rows.forEach((pk, r) => {
      const yy = y + 96 + r * 46, t = pk === 'prepaid' ? 'PREPAID' : 'MONTHLY';
      txt(g, t, x + 14, yy, { size: fit(g, t, 12.5, lw - 6, 700, 8, FM), weight: 700, fam: FM, color: o.plan === pk ? COL.accent : COL.soft });
      cols.forEach((d, i) => {
        const on = o.plan === pk && o.data === d, rowOn = o.plan === pk && !o.data;
        if (on || rowOn) { rr(g, cx(i) - cw / 2 + 3, yy - 17, cw - 6, 34, 8); g.fillStyle = on ? 'rgba(255,193,94,0.16)' : 'rgba(255,193,94,0.06)'; g.fill(); if (on) { g.strokeStyle = COL.accent; g.lineWidth = 2; g.stroke(); } }
        txt(g, BK.money(BK.COST[pk][d]), cx(i), yy, { size: 17, weight: 800, fam: FM, color: on ? COL.accent : COL.text, align: 'center' });
      });
    });
    txt(g, 'PER MONTH · FOR EXAMPLE ONLY', x + 14, y + h - 16, { size: 10.5, weight: 700, fam: FM, color: COL.dim });
    return { h };
  }
  BKS.planBoard = planBoard;

  // 휴대폰 화면. o: { phone, p: 번호 나타나기, nosim }
  function phoneScreen(g, x, y, w, o = {}) {
    const h = Math.round(w * 1.66), cx = x + w / 2;
    rr(g, x, y, w, h, 24); g.fillStyle = '#0A0E13'; g.fill(); g.strokeStyle = COL.line; g.lineWidth = 2; g.stroke();
    rr(g, x + 9, y + 26, w - 18, h - 50, 14); g.fillStyle = '#16212C'; g.fill();
    rr(g, cx - 22, y + 11, 44, 6, 3); g.fillStyle = '#2A3542'; g.fill();
    icon(g, 'signal', x + 28, y + 44, 14, o.nosim ? COL.dim : COL.good, 2);
    txt(g, o.nosim ? 'NO SIM' : BK.SHOP.toUpperCase(), x + 42, y + 44, { size: fit(g, o.nosim ? 'NO SIM' : BK.SHOP.toUpperCase(), 10, w - 64, 700, 7, FM), weight: 700, fam: FM, color: o.nosim ? COL.trap : COL.soft });
    if (o.nosim) {
      icon(g, 'sim', cx, y + h * 0.42, 54, COL.dim, 1.6);
      txt(g, 'INSERT SIM CARD', cx, y + h * 0.62, { size: fit(g, 'INSERT SIM CARD', 12, w - 40, 700, 8, FM), weight: 700, fam: FM, color: COL.muted, align: 'center' });
    } else {
      icon(g, 'sim', cx, y + h * 0.28, 34, COL.good, 1.8);
      txt(g, 'YOUR NEW NUMBER', cx, y + h * 0.43, { size: fit(g, 'YOUR NEW NUMBER', 11.5, w - 40, 700, 8, FM), weight: 700, fam: FM, color: COL.muted, align: 'center' });
      if (o.phone) fade(g, o.p == null ? 1 : o.p, () => {
        txt(g, o.phone, cx, y + h * 0.53, { size: fit(g, o.phone, 26, w - 36, 800, 12, FM), weight: 800, fam: FM, color: COL.accent, align: 'center' });
        say(x + 12, y + h * 0.53 - 18, w - 24, 36, BK.digits(o.phone));
      });
      txt(g, 'SIM ACTIVATED', cx, y + h * 0.7, { size: 10.5, weight: 700, fam: FM, color: COL.good, align: 'center' });
    }
    return { h };
  }
  BKS.phoneScreen = phoneScreen;

  // 전화번호는 묶음으로 끊어 한 자리씩 (0 → oh). o: { big: 0~1 → 큰 수로 읽은 함정, trap: 끝 두 자리를 바꾼 번호 }
  function numChunk(g, x, y, w, phone, o = {}) {
    const [a, b] = phone.split('-'), h = 268;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '번호 · 묶음으로 끊어 한 자리씩', x + 16, y + 22, { size: fit(g, '번호 · 묶음으로 끊어 한 자리씩', 13.5, w - 32, 700), weight: 700, color: COL.muted });
    txt(g, phone, x + 16, y + 64, { size: 32, weight: 800, fam: FM, color: COL.text });
    say(x + 10, y + 44, w - 20, 40, BK.digits(phone));
    [[a, '앞 묶음'], [b, '뒤 묶음']].forEach(([gp, ko], k) => {
      const yy = y + 112 + k * 46, t = BK.digits(gp);
      const c = chip(g, t, x + 16, yy, { size: fit(g, t, 17, w - 120, 700), weight: 700, color: COL.clause, fill: COL.panel2, stroke: 'rgba(127,224,168,0.55)', h: 36, r: 10, pad: 12 });
      txt(g, ko, x + w - 16, yy, { size: 12.5, weight: 700, color: COL.muted, align: 'right' });
      say(c.x, c.y, c.w, c.h, t);
    });
    txt(g, '0 → oh · 묶음 사이에서 잠깐 쉬어요', x + 16, y + 200, { size: fit(g, '0 → oh · 묶음 사이에서 잠깐 쉬어요', 13.5, w - 32, 700), weight: 700, color: COL.rel });
    if (o.big) fade(g, o.big, () => {
      const t = BK.bigRead(phone);
      txt(g, `× ${t}`, x + 16, y + 236, { size: fit(g, `× ${t}`, 14, w - 32, 700), weight: 700, color: COL.trap });
    });
    else if (o.trap) {
      const t = `× ${o.trap} → 끝 두 자리가 바뀌었어요`;
      txt(g, t, x + 16, y + 236, { size: fit(g, t, 14, w - 32, 700), weight: 700, color: COL.trap });
    }
    return { h };
  }
  BKS.numChunk = numChunk;

  // 서류 카드 하나 (여권 · 학생증 · 기숙사 계약서 · 학교 확인서). o: { on, gone }
  const DOC_LOOK = {
    passport: { head: '#7A2E3A', icon: 'passport', en: 'PASSPORT', sub: 'REPUBLIC OF KOREA' },
    sid: { head: '#2F4A7A', icon: 'id', en: 'STUDENT ID', sub: BK.UNI.toUpperCase() },
    lease: { head: '#2F4A44', icon: 'note', en: 'HOUSING CONTRACT', sub: 'ADDRESS ✓' },
    letter: { head: '#5A4A2A', icon: 'mail', en: 'UNIVERSITY LETTER', sub: 'ENROLLED ✓' },
  };
  function docCard(g, x, y, w, id, o = {}) {
    const L = DOC_LOOK[id], h = Math.round(w * 0.82);
    g.save(); g.globalAlpha *= o.gone ? 0.35 : 1;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 12; g.shadowOffsetY = 4; rr(g, x, y, w, h, 10); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 10); g.clip(); g.fillStyle = L.head; g.fillRect(x, y, w, 26); g.restore();
    txt(g, L.en, x + w / 2, y + 14, { size: fit(g, L.en, 11.5, w - 14, 700, 7, FM), weight: 700, fam: FM, color: '#FFFFFF', align: 'center' });
    icon(g, L.icon, x + w / 2, y + 26 + (h - 26) * 0.42, Math.min(40, h * 0.38), L.head, 1.8);
    txt(g, L.sub, x + w / 2, y + h - 16, { size: fit(g, L.sub, 10, w - 14, 700, 6.5, FM), weight: 700, fam: FM, color: '#5B6168', align: 'center' });
    g.restore();
    if (o.on) { rr(g, x - 4, y - 4, w + 8, h + 8, 13); g.strokeStyle = COL.good; g.lineWidth = 2.6; g.stroke(); }
    if (o.gone) { rr(g, x - 4, y - 4, w + 8, h + 8, 13); g.strokeStyle = COL.trap; g.lineWidth = 2; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]); txt(g, '없음', x + w / 2, y + h / 2, { size: 16, weight: 800, color: COL.trap, align: 'center' }); }
    return { h };
  }
  BKS.docCard = docCard;
  // 서류 넷 (2 × 2). o: { hl: [ids], gone: [ids], u, at }
  function docCards(g, x, y, w, o = {}) {
    const ids = ['passport', 'sid', 'lease', 'letter'], cw = (w - 14) / 2, ch = Math.round(cw * 0.82);
    panel(g, x, y, w, 40 + ch * 2 + 62, { fill: COL.panel, stroke: COL.faint });
    txt(g, 'DOCUMENTS · 서류', x + 16, y + 22, { size: 12, weight: 700, fam: FM, color: COL.muted });
    ids.forEach((id, k) => fade(g, o.u == null ? 1 : ramp(o.u, (o.at || 0) + k * 0.3, 0.35), () => {
      const xx = x + 7 + (k % 2) * (cw + 0) + (k % 2 ? 0 : 0), yy = y + 40 + Math.floor(k / 2) * (ch + 30);
      docCard(g, xx + 4, yy, cw - 8, id, { on: (o.hl || []).includes(id), gone: (o.gone || []).includes(id) });
      const ko = BK.DOCS[id].ko.replace(/\(.*\)$/, '');
      txt(g, ko, xx + cw / 2, yy + ch + 14, { size: fit(g, ko, 13, cw - 8, 700), weight: 700, color: (o.hl || []).includes(id) ? COL.good : COL.soft, align: 'center' });
      say(xx, yy, cw, ch + 24, `Here's ${BK.DOCS[id].t}.`);
    }));
    return { h: 40 + ch * 2 + 62 };
  }
  BKS.docCards = docCards;

  // 계좌 신청서 (NEW ACCOUNT). c: 카드 · o: { show(key), hl, sign: 0~1 }
  function acctForm(g, x, y, w, c, o = {}) {
    const A = BK.addrOf(c), H = BK.HALLS[A.hall];
    const rows = [['ACCOUNT', BK.SLOT.acct.vals[c.acct || 'checking'].t.replace(/^A /, '').toUpperCase(), 'acct'],
      ['ADDRESS 1', `ROOM ${A.room}, ${H.t.toUpperCase()}`, 'a1'], ['ADDRESS 2', `${H.st} ${BK.STREET.toUpperCase()}`, 'a2'], ['CITY · ZIP', `${BK.CITY.toUpperCase()} ${BK.ZIP}`, 'a3'],
      ['PHONE', c.phone || '', 'phone'], ['SIGNATURE', '', 'sign']];
    const r = paper(g, x, y, w, rows, { title: `NEW ACCOUNT · ${BK.BANK.toUpperCase()}`, icon: 'teller', show: o.show, hl: o.hl, rh: 36, vx: 104, head: '#26324A' });
    if (o.sign) {   // 서명: 구불구불한 선이 왼쪽부터 그려져요
      const sx = x + 112, sy = y + 54 + 5 * 36 + 16, n = 40, end = Math.max(1, Math.floor(n * clamp(o.sign)));
      g.strokeStyle = '#1F4FA0'; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
      for (let i = 0; i <= end; i++) { const t = i / n, px = sx + t * (w - 150), py = sy + Math.sin(t * 15) * 7 * (1 - t * 0.4) - t * 4; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.stroke();
    }
    return r;
  }
  BKS.acctForm = acctForm;

  // 주소의 차례: 한국(큰 곳 → 작은 곳) ↔ 영어(작은 곳 → 큰 곳). o: { ko: 0~1, en: 0~1, A }
  function addrOrder(g, x, y, w, o = {}) {
    const A = o.A || { room: 412, hall: 'maple' }, H = BK.HALLS[A.hall], h = 196;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '주소의 차례 · 영어는 거꾸로', x + 16, y + 22, { size: 13.5, weight: 700, color: COL.muted });
    const rowsDef = [
      ['한국 주소', [`${BK.CITY} ${BK.ZIP}`, `${BK.STREET} ${H.st}`, H.t, `${A.room}호`], COL.soft, o.ko, '큰 곳 → 작은 곳'],
      ['영어 주소', [`Room ${A.room}`, H.t, `${H.st} ${BK.STREET}`, `${BK.CITY}, ${BK.ZIP}`], COL.clause, o.en, '작은 곳 → 큰 곳'],
    ];
    rowsDef.forEach(([lab, parts, c, p, note], r) => fade(g, p == null ? 1 : p, () => {
      const yy = y + 72 + r * 68;
      txt(g, lab, x + 16, yy, { size: 15, weight: 700, color: c });
      txt(g, note, x + 16, yy + 22, { size: 11.5, weight: 600, color: COL.muted });
      let xx = x + 112;
      parts.forEach((t, k) => {
        const sz = fit(g, t, 15, 160, 700), ww = tw(g, t, sz, 700) + 20;
        rr(g, xx, yy - 17, ww, 34, 8); g.fillStyle = r ? 'rgba(127,224,168,0.10)' : 'rgba(238,241,244,0.06)'; g.fill(); g.strokeStyle = r ? 'rgba(127,224,168,0.55)' : COL.line; g.lineWidth = 1.5; g.stroke();
        txt(g, t, xx + 10, yy + 1, { size: sz, weight: 700, color: c });
        xx += ww;
        if (k < 3) { arrow(g, xx + 3, yy, xx + 19, yy, r ? COL.clause : COL.muted, 1.8); xx += 24; }
      });
      if (r) say(x + 108, yy - 18, xx - x - 104, 36, `It's ${BK.addrEn(A)}.`);
    }));
    return { h };
  }
  BKS.addrOrder = addrOrder;

  // 숫자판 (비밀번호는 누르기만 · 화면에는 점). o: { n: 누른 자리 0~4, said: 소리 내어 말함 → 경고 }
  function keypadFig(g, x, y, w, o = {}) {
    const kw = (w - 48) / 3, kh = 38, h = 96 + 4 * (kh + 8) + 14;
    rr(g, x, y, w, h, 16); g.fillStyle = '#1C2530'; g.fill(); g.strokeStyle = COL.line; g.lineWidth = 1.5; g.stroke();
    rr(g, x + 16, y + 16, w - 32, 62, 8); g.fillStyle = '#0B1A14'; g.fill();
    txt(g, 'ENTER PIN', x + w / 2, y + 34, { size: 11, weight: 700, fam: FM, color: COL.good, align: 'center' });
    for (let i = 0; i < 4; i++) { const cx = x + w / 2 + (i - 1.5) * 30; if (i < (o.n || 0)) circ(g, cx, y + 60, 7, '#BFF5D2'); else ring(g, cx, y + 60, 7, 'rgba(127,224,168,0.45)', 1.5); }
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '✕', '0', '✓'].forEach((k, i) => {
      const kx = x + 16 + (i % 3) * (kw + 8), ky = y + 92 + Math.floor(i / 3) * (kh + 8);
      rr(g, kx, ky, kw, kh, 7); g.fillStyle = k === '✓' ? '#2F6A4A' : k === '✕' ? '#6A2F2F' : '#2A3542'; g.fill();
      txt(g, k, kx + kw / 2, ky + kh / 2 + 1, { size: 17, weight: 700, fam: FM, color: COL.text, align: 'center' });
    });
    if (o.said) fade(g, o.said, () => { rr(g, x - 6, y - 6, w + 12, h + 12, 20); g.strokeStyle = COL.bad; g.lineWidth = 3; g.stroke(); });
    return { h };
  }
  BKS.keypadFig = keypadFig;

  // 직불 카드
  function debitCard(g, x, y, w, o = {}) {
    const h = Math.round(w * 0.63);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 16; g.shadowOffsetY = 6; rr(g, x, y, w, h, 14); g.fillStyle = '#26324A'; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 14); g.clip(); g.fillStyle = 'rgba(110,200,255,0.14)'; g.beginPath(); g.arc(x + w * 0.9, y + h * 1.1, w * 0.6, 0, Math.PI * 2); g.fill(); g.restore();
    txt(g, BK.BANK.toUpperCase(), x + 18, y + 26, { size: fit(g, BK.BANK.toUpperCase(), 12.5, w - 110, 700, 8, FM), weight: 700, fam: FM, color: '#DCE6F0' });
    txt(g, 'DEBIT', x + w - 18, y + 26, { size: 15, weight: 800, fam: FM, color: COL.ante, align: 'right' });
    rr(g, x + 20, y + h * 0.38, 44, 32, 6); g.fillStyle = '#C9A866'; g.fill(); g.strokeStyle = 'rgba(60,40,10,0.5)'; g.lineWidth = 1; g.stroke();
    txt(g, '••••  ••••  ••••  4821', x + 20, y + h * 0.74, { size: fit(g, '••••  ••••  ••••  4821', 16, w - 40, 700, 9, FM), weight: 700, fam: FM, color: '#EEF1F4' });
    txt(g, 'FOR EXAMPLE ONLY', x + 20, y + h - 16, { size: 10, weight: 700, fam: FM, color: '#94A0AE' });
    return { h };
  }
  BKS.debitCard = debitCard;

  // ATM 안내판 (밖으로 나가 왼쪽). o: { p }
  function atmSign(g, x, y, w, o = {}) {
    const h = 150;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    icon(g, 'atm', x + 52, y + 66, 54, COL.ante, 1.8);
    txt(g, 'ATM', x + 100, y + 56, { size: 34, weight: 800, fam: FM, color: COL.ante });
    fade(g, o.p == null ? 1 : o.p, () => {
      arrow(g, x + w - 30, y + 110, x + 112, y + 110, COL.clause, 3);
      txt(g, 'right outside, on your left', x + w - 22, y + 134, { size: fit(g, 'right outside, on your left', 13, w - 120, 700), weight: 700, color: COL.clause, align: 'right' });
    });
    return { h };
  }
  BKS.atmSign = atmSign;

  // 내 카드 (시뮬레이터와 같은 칸). o: { skip, hl, rh, vs, rows, title }
  function myCard(g, x, y, w, card, o = {}) {
    const all = o.rows || BK.cardRows(card), rows = all.map((r, i) => [r, i]).filter(([, i]) => !o.skip || !o.skip.includes(i)), rh = o.rh || 34, vs = o.vs || 14.5, vx = o.vx || 100;
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
  BKS.myCard = myCard;

  // 첫 낱말 → 짧은 대답 (BK.AUX). o: { hl: 'do' | 'be' | 'is', at, u }
  function auxTable(g, x, y, w, o = {}) {
    const ks = Object.keys(BK.AUX), rh = 40, h = 46 + ks.length * rh;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '첫 낱말 → 짧은 대답의 짝', x + 16, y + 22, { size: 14, weight: 700, color: COL.muted });
    ks.forEach((k, i) => fade(g, o.u == null ? 1 : ramp(o.u, (o.at || 0) + i * 0.25, 0.3), () => {
      const A = BK.AUX[k], yy = y + 46 + i * rh + rh / 2 - 4, on = o.hl === k, a = A.a.split(' · ')[0];
      if (on) { rr(g, x + 6, yy - rh / 2 + 3, w - 12, rh - 6, 8); g.fillStyle = 'rgba(110,200,255,0.12)'; g.fill(); g.strokeStyle = COL.ante; g.lineWidth = 1.8; g.stroke(); }
      txt(g, A.q, x + 16, yy, { size: 15, weight: 700, color: COL.ante });
      txt(g, a, x + w - 14, yy, { size: fit(g, a, 15, w - 130, 700), weight: 700, color: COL.rel, align: 'right' });
      say(x + 6, yy - rh / 2 + 3, w - 12, rh - 6, a);
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
  BKS.notePanel = notePanel;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(곱하기 표)는 자막에 쓰지 않음
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '은행 · 환전 · 휴대폰 회화 · 서류는 내밀고 숫자는 끊어 말한다', d: 26, caps: [
      [0.4, 5.4, '은행, 환전 창구, 휴대폰 가게에서는 정해진 질문이 이어져요. 대답은 서류와 숫자예요.'],
      [5.4, 11.8, '얼마를 바꿀지 물으면 → Thirty man won? 만은 영어에 없어요. 세 자리씩 끊어 → three hundred thousand won.'],
      [11.8, 16.4, "여권을 보여 달라면 → I have passport. 있다고만 하지 말고 내밀면서 → Sure. Here's my passport."],
      [16.4, 21, "새 번호를 들으면 Okay. Thanks.로 끝내지 말고, 묶음으로 끊어 되짚어요 → So, it's 555-0147?"],
      [21, 26, '세 단계로 말해요. 열쇠 낱말과 모양을 잡고, 틀에 내 정보를 넣고, 공손하게 끝내요.'],
    ] },
    { id: 'map', n: '01', title: '환전 창구에서 은행까지', sub: '환전 하나 · 휴대폰 가게 둘 · 은행 넷', d: 30, caps: [
      [0.4, 6, '오늘의 이야기를 일곱 곳으로 나눠 봐요. 교환학생으로 도착해서, 먼저 환전 창구에서 원을 달러로 바꿔요.'],
      [6, 12, '다음은 휴대폰 가게예요. 요금제를 고르고 유심을 넣으면 새 번호를 알려 줘요. 그 번호를 되짚어 적어 둬요.'],
      [12, 18, '그리고 은행에 가요. 용건을 말하고, 서류를 내밀고, 주소와 전화번호를 말하고, 카드를 만들어요.'],
      [18, 24, '보라 테두리 → 내가 먼저 말을 꺼내는 곳이에요. 환전 창구, 휴대폰 가게, 은행 창구에서는 용건부터 말해요.'],
      [24, 30, '은행 이름, 환율, 요금, 주소, 전화번호는 모두 지어낸 예시예요. 실제 서류와 절차는 은행마다 달라요.'],
    ] },
    { id: 'fx', n: '02', title: '환전 창구 · 만 → thousand', sub: "I'd like to change … · three hundred thousand won · bills · So, that's $240?", d: 40, place: 0, caps: [
      [0.4, 6, '환전 창구 → How can I help you today? 이거 달러로 바꿔요 → Change this into dollars. 명령처럼 들려요.'],
      [6, 11.5, "용건은 부탁 틀로 → I'd like to change 300,000 won into US dollars, please."],
      [11.5, 17.5, 'How much would you like to change? 30만을 → thirty man won? 만을 그대로 읽으면 못 알아들어요.'],
      [17.5, 23, 'thirty thousand는 3만, three million은 300만이에요. 영어는 세 자리씩 → 30만 = **three hundred thousand won.**'],
      [23, 29, 'Large bills or small bills? → Yes, please.는 고른 것이 없어요. 지폐는 paper가 아니라 bills → Small bills, please.'],
      [29, 34.5, "At today's rate, that comes to $240. Okay.로 넘기면 확인이 안 돼요. fourteen으로 잘못 들으면 214달러예요."],
      [34.5, 40, "되짚어 확인해요 → So, that's $240? forty는 앞을, fourteen은 뒤를 세게 말해요."],
    ] },
    { id: 'shop', n: '03', title: '휴대폰 가게 · 요금제 고르기', sub: 'SIM card · prepaid or monthly · data · for · $30', d: 39, place: 1, caps: [
      [0.4, 6, '휴대폰 가게 → What can I do for you today? 개통을 그대로 → I want to open my phone. 휴대폰을 뜯는다는 말처럼 들려요.'],
      [6, 11.5, "USIM card, please.도 한국에서 쓰는 말이에요. 용건을 부탁 틀로 → I'd like to get a SIM card for my phone, please."],
      [11.5, 17, 'Prepaid or monthly? 빠르면 pre-PAI-dor처럼 이어져요. 고르는 질문이라 Yes 대신 고른 것 → Prepaid, please.'],
      [17, 22.5, "How much data do you need? 무제한을 data free로 옮기면 ‘공짜’로 들려요. 내 카드대로 → 15 GB, please."],
      [22.5, 28, 'How long are you staying? 동안 → During six months? 숫자로 센 기간은 for → For six months.'],
      [28, 33, "빠른 말 → How much data d'you reckon you need? 짐작하지 말고 놓친 것만 물어요 → Sorry, how much data?"],
      [33, 39, "That's $30 for the first month. 되물을 때 thirteen이라고 하면 들은 값과 달라요. 카드로 낼 때 → Can I pay by card?"],
    ] },
    { id: 'sim', n: '04', title: '유심 · 새 번호 되짚기', sub: "Is it unlocked · So, it's 555-0147? · oh · top-up", d: 33, place: 2, caps: [
      [0.4, 6, 'Is your phone unlocked? → Is로 물었으니 Yes, it is. Yes, I am.은 짝이 어긋나요.'],
      [6, 12, 'Your new number is 555-0147. → Okay. Thanks. 되짚지 않으면 틀린 번호를 은행 서류에 쓰게 돼요.'],
      [12, 18, '번호를 큰 수처럼 → five hundred fifty-five? 한 자리씩 묶음으로 → five-five-five, oh-one-four-seven. 0은 oh로 읽어요.'],
      [18, 23.5, "끝 두 자리를 바꿔 되짚으면 직원이 바로잡아 줘요. 맞게 → So, it's 555-0147? → That's right."],
      [23.5, 27.5, "빠른 말 → Righto, new number's 555-0147. 놓쳤으면 → Sorry, could you say the number again, slowly?"],
      [27.5, 33, "auto top-up → 모르는 낱말은 물어요 → Sorry, what does top-up mean? 직접 충전할 거면 → No, thanks. I'll top it up myself."],
    ] },
    { id: 'teller', n: '05', title: '은행 창구 · 계좌 열기', sub: 'open a bank account · checking or savings · Are you a student?', d: 28, place: 3, caps: [
      [0.4, 6, '은행 창구 → What can I do for you today? 통장을 만들고 싶다고 → I want to make a bankbook. 영어로는 계좌를 열어요.'],
      [6, 11.5, "Make me an account.는 명령이고, I'm an exchange student.는 사실만 말했어요. 용건은 → I'd like to open a bank account, please."],
      [11.5, 17, 'Checking or savings? → 고르는 질문이에요. 월세와 생활비를 넣고 빼는 통장은 → A checking account, please.'],
      [17, 22.5, 'Are you a student? → Are로 물었으니 Yes, I do.는 짝이 어긋나요. Are you …? → Yes, I am.'],
      [22.5, 28, "Yes.만 해도 통하지만, 어느 학교 학생인지 덧붙이면 더 좋아요 → I'm an exchange student at Kellport University."],
    ] },
    { id: 'id', n: '06', title: '서류 · 내밀면서 말하기', sub: "Here's my passport · second form of ID · proof of address · Would … work?", d: 34, place: 4, caps: [
      [0.4, 6, "Can I see your passport, please? → I have passport. 있다고만 하지 말고 내밀면서 → Sure. Here's my passport."],
      [6, 12, "Do you have a second form of ID? → Yes, I have.는 끝이 비고, Yes, I am.은 짝이 어긋나요 → Yes, I do. Here's my student ID."],
      [12, 17.5, 'Do you have proof of address? 주소가 적힌 서류 → my housing contract. dormitory paper는 무슨 서류인지 몰라요.'],
      [17.5, 23.5, "서류가 없으면 No, I don't.로 끝내지 말고 사실에 부탁을 붙여요 → Would a letter from my university work?"],
      [23.5, 29, '빠른 말 → Got some ID? 짐작해서 내밀지 말고 물어요 → Sorry, did you ask for my ID?'],
      [29, 34, "서류 넷 → 여권, 학생증, 주소가 적힌 계약서, 학교 확인서. 내밀 때는 Here's my …"],
    ] },
    { id: 'form', n: '07', title: '주소 · 전화번호 · 서명', sub: "It's Room 412, … 40213 · It's 555-0147 · Sure. Right here?", d: 39, place: 5, caps: [
      [0.4, 6, "What's your address here? → I live in a dormitory. 사실이지만 주소가 없어요. 카드와 편지가 그 주소로 와요."],
      [6, 12, '한국 주소처럼 큰 곳부터 → Kellport, 40213, … 영어 주소는 거꾸로, 작은 곳에서 큰 곳으로 가요.'],
      [12, 18, '번지는 길 이름 앞에 → 200 College Avenue. 방 번호를 421로 잘못 말하거나 길을 빼면 직원이 다시 물어요.'],
      [18, 24, "모두 맞게 → It's Room 412, Maple Hall, 200 College Avenue, Kellport, 40213. 방 번호는 four-twelve로 읽어요."],
      [24, 29.5, "What's a good phone number for you? 휴대폰 가게에서 되짚어 둔 번호를 묶음으로 → It's 555-0147."],
      [29.5, 34, "Please sign here. → I'll do my sign.은 어색해요. 서명은 signature → Sure. Right here?"],
      [34, 39, "빠른 말 → And what's the address there? 놓쳤으면 → Sorry, did you ask for my address?"],
    ] },
    { id: 'card', n: '08', title: '카드 · 비밀번호 · ATM', sub: 'debit card · enter a PIN · anything else · Could you tell me …?', d: 28, place: 6, caps: [
      [0.4, 6, '직불 카드가 필요한지 물어요. 체크카드를 그대로 → a check card? 영어로는 debit card. 필요하면 → Yes, please.'],
      [6, 12, "Please enter a four-digit PIN on the keypad. → It's 7-3-9-1. 비밀번호를 소리 내어 말하면 안 돼요."],
      [12, 17, '숫자판에 누르기만 하고 짧게 답해요 → Okay. Thank you.'],
      [17, 22.5, 'Is there anything else I can help you with? → Yes.만 하면 무엇인지 다시 물어요. Where is ATM?은 툭 던지는 말이에요.'],
      [22.5, 28, '물어볼 것은 Yes 뒤에 바로, 질문으로 → Yes. Could you tell me where the nearest ATM is?'],
    ] },
    { id: 'method', n: '09', title: '3단계 말하기 법', sub: '일곱 곳에 한 줄씩 · 질문의 모양과 함께', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 말하기 법**으로 묶어요.'],
      [5.5, 11.5, '① **열쇠 낱말과 질문의 모양 잡기** → or → 고르기, How much → 정보, Do you · Are you · Is it → 첫 낱말로 짧은 대답.'],
      [11.5, 17.5, "② **틀에 내 정보 넣기** → 서류는 내밀면서 Here's my passport. 금액은 세 자리씩, 번호는 묶음으로 끊어 되짚어요."],
      [17.5, 23, '③ **공손하게 끝내기** → 부탁은 질문으로 → Would a letter from my university work? 놓쳤으면 → Sorry, how much data?'],
      [23, 28, '일곱 곳에 한 줄씩 적용했어요. 숫자와 서류가 많은 곳일수록 되짚기가 힘이 돼요.'],
    ] },
    { id: 'practice', n: '10', title: '실전 환전 · 휴대폰 · 은행', sub: '내 카드 하나로 네 번', d: 50, caps: [
      [0.4, 4.5, '실전이에요. 내 카드 → 60만 원을 바꿔요. 첫 질문 → How much would you like to change?'],
      [4.5, 8.5, '① 정보 질문 → (A) Yes. 정보가 없어 탈락. ② (B) sixty thousand won은 6만 원이라 탈락.'],
      [8.5, 12.5, '정답 (C) → Six hundred thousand won, please.'],
      [12.9, 17, '휴대폰 가게 → Your new number is 555-0162. 셋 모두 번호 안내에 맞는 말이에요.'],
      [17, 21, '② (A) Okay. Thanks. → 되짚지 않아 탈락. (B) 555-0126 → 끝 두 자리가 달라 탈락.'],
      [21, 25, "정답 (C) → So, it's 555-0162?"],
      [25.4, 29.5, '은행 → Do you have proof of address? 카드 → 주소 증명 서류는 없고 학교 확인서가 있어요.'],
      [29.5, 33.5, "② (A) No, I don't. → 부탁이 빠져 탈락. (C) housing contract → 카드와 달라 탈락."],
      [33.5, 37.5, "정답 (B) → No, I don't. Would a letter from my university work?"],
      [37.9, 42, "마지막 → What's your address here? 셋 모두 주소 한 줄이에요. 카드 → 방은 315호, 건물은 Cedar Hall이에요."],
      [42, 46, '② (A) 한국식 차례라 탈락. (B) 번지 300이 College Avenue 뒤에 와 탈락.'],
      [46, 50, "정답 (C) → It's Room 315, Cedar Hall, 300 College Avenue, Kellport, 40213."],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '곳 · 열쇠 낱말과 모양 · 대답 틀', d: 22, caps: [
      [0.4, 6, "정리해요. 용건은 부탁 틀로 → I'd like to open a bank account, please. 서류는 내밀면서 → Here's my passport."],
      [6, 12, "숫자는 끊어요. 30만 = three hundred thousand won. 들은 금액과 번호는 되짚어요 → So, it's 555-0147?"],
      [12, 17, '주소는 작은 곳에서 큰 곳으로, 비밀번호는 말하지 않고 눌러요.'],
      [17, 22, '아래 **은행 · 휴대폰 시뮬레이터**에서 내 카드로 환전 창구부터 은행 카드까지 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  BKS.CHAPTERS = CHAPTERS; BKS.CAPTIONS = CAPTIONS; BKS.END = END;
  BKS.POSTER = CHAPTERS.find(c => c.id === 'sim').t + 20.4;
  BKS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  BKS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 실전 장면의 시각 (구간 시작 · 보기 · ① · ② · ③ · 정답)
  const PSEG = [0, 12.5, 25, 37.5];
  const PT = { q: 0.4, opt: [1.6, 2.2, 2.8], s1: 5.0, s2: 7.0, s3: 9.0, win: 10.0, lines: [0.4, 4.5, 8.5] };
  BKS.PSEG = PSEG;

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
  const ansParts = a => BK.segs(a).map(s => [s.t, s.r]);
  // 주소 한 줄을 짧게 (표 · 목록용): It's Room 412 … Kellport, 40213.
  const shortParts = a => {
    if (a.f !== 'line') return ansParts(a);
    const s = BK.segs(a); if (s.length < 8) return ansParts(a);
    return [[s[0].t + ' ', s[0].r], [s[2].t, s[2].r], [' … ', 'frame'], [s[s.length - 2].t, s[s.length - 2].r], [s[s.length - 1].t, s[s.length - 1].r]];
  };
  const shortText = a => shortParts(a).map(p => p[0]).join('');
  BKS.shortText = shortText;
  // 여러 줄로 감싸는 대답 (보기 · 주소 한 줄)
  function wrapAns(g, a, x, y, size, maxW, o = {}) {
    const text = BK.text(a), marks = o.plain ? [] : BK.segs(a).filter(s => s.r && s.r !== 'frame').map(s => [s.t, o.dim ? 'dim' : s.r]);
    const R = richLay(g, text, marks, size, maxW, { weight: 600 });
    richDraw(g, R, x, y - (R.rows - 1) * R.lh / 2, { color: o.dim ? COL.dim : o.color || COL.text });
    return R;
  }
  const why2 = j => `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
  function whyLine(g, j, y, w = 1100, x) { const R = richLay(g, why2(j), [], 16, w, { weight: 600 }); richDraw(g, R, x != null ? x : W / 2 - R.w / 2, y, { color: j.ok ? COL.good : COL.trap }); return R; }
  const ME_FIRST = BK.ME_FIRST;
  const D = BK.DEMO;
  const okOn = (q, a, c) => BK.judge(Qobj(q), a, c || D).ok;
  const OT = BK.o;
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
      fade(g, ramp(u, s, 0.3) * (1 - ramp(u, e - 0.3, 0.3)), () => answer(g, { x: LX, y, w: 780, A: a, at: s + 0.2, u, size: o.size || 23, maxW: 640, trapAt: s + 0.6, strikeAt: s + 0.7, tag: tg ? [tg, COL.trap, s + 0.8] : null, tagY: y + (a.f === 'line' || BK.text(a).length > 46 ? 108 : 78) }));
    });
  }
  // 직원의 짧은 말 (말 id 없이)
  const say2 = (g, text, y, at, u, kind, sp, marks) => talk(g, { side: 'L', x: LX, y, w: 780, text, marks: marks || [], kind, sp, at, u, size: 22 });
  // 헷갈리는 숫자 짝 (14 · 40)
  function pairsFig(g, x, y, w, u, at) {
    const rh = 58, h = 52 + BK.PAIRS.length * rh + 40;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    txt(g, '헷갈리는 숫자 · 세게 읽는 곳', x + 16, y + 22, { size: 13.5, weight: 700, color: COL.muted });
    BK.PAIRS.forEach(([a, as, b, bs], i) => fade(g, ramp(u, at + i * 0.3, 0.35), () => {
      const yy = y + 60 + i * rh;
      [[a, as, x + 16], [b, bs, x + w / 2 + 6]].forEach(([n, s, xx]) => {
        txt(g, n, xx, yy, { size: 22, weight: 800, fam: FM, color: COL.text });
        const parts = s.match(/[A-Z]{2,}|[a-z]+/g);
        let px = xx + 46; parts.forEach(pp => { const big = /^[A-Z]{2,}$/.test(pp); px += txt(g, pp.toLowerCase(), px, yy, { size: big ? 19 : 15, weight: big ? 800 : 500, color: big ? COL.accent : COL.soft }); });
        say(xx - 4, yy - 20, w / 2 - 20, 40, BK.numWord(+n));
      });
    }));
    fade(g, ramp(u, at + 1.2, 0.4), () => txt(g, '$240 → two hundred forty', x + w / 2, y + h - 22, { size: 16, weight: 700, color: COL.clause, align: 'center' }));
    say(x + 20, y + h - 40, w - 40, 36, 'two hundred forty dollars');
    return { h };
  }
  // 직접 해 보기에서 고른 대답 하나 보이기 (상대의 말 + 대답 + 까닭)
  function pickView(g, q, a, C, y = 160) {
    const r = exch(g, 99, { q, at: -9, ok: a, card: C, y, qo: { all: true } });
    const R = whyLine(g, BK.judge(Qobj(q), a, C), r.y + 30, 780, LX);
    return r.y + 30 + R.h;
  }

  const SCENES = {
    /* 00 들어가며: 제목 → 만 × → thousand ✓ → I have passport × → Here's my passport ✓ → Okay. Thanks. × → 번호 되짚기 ✓ → 세 단계 */
    intro(g, u) {
      fade(g, ramp(u, 0.2, 0.6) * (1 - ramp(u, 5.0, 0.5)), () => {
        const T = '은행 · 환전 · 휴대폰, 서류는 내밀고 숫자는 끊어 말한다';
        txt(g, T, W / 2, 262, { size: fit(g, T, 48, 1140, 800, 30, FD), weight: 800, fam: FD, align: 'center' });
        txt(g, 'Bank, money exchange & phone shop English · 환전 창구에서 은행 카드까지 일곱 곳', W / 2, 332, { size: 23, weight: 500, color: COL.muted, align: 'center' });
        BK.PLACES.forEach((p, i) => fade(g, ramp(u, 0.9 + i * 0.22, 0.4), () => {
          const x = W / 2 + (i - 3) * 132;
          circ(g, x, 440, 32, COL.panel2); ring(g, x, 440, 32, ME_FIRST[p.id] ? COL.verb : COL.accent, 1.8);
          icon(g, p.id, x, 440, 30, COL.soft);
          txt(g, String(i + 1), x, 392, { size: 14, weight: 700, fam: FM, color: COL.accent, align: 'center' });
          const nm = p.ko.split(' · ')[0];
          txt(g, nm, x, 496, { size: fit(g, nm, 15, 126, 600), weight: 600, color: COL.muted, align: 'center' });
          const gap = i === 0 || i === 2;
          if (i < 6) arrow(g, x + 38, 440, x + 92, 440, gap ? 'rgba(201,167,255,0.5)' : COL.faint, 2, gap ? [4, 5] : null);
        }));
      });
      const it = BK.INTRO, C = Object.assign({}, D, it.card);
      // [5.4, 11.8] 환전 창구: 만 → thousand
      fade(g, ramp(u, 5.4, 0.4) * (1 - ramp(u, 11.6, 0.4)), () => {
        label(g, '환전 창구 · 바꿀 금액', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, it.q, { x: LX, y: 186, w: 780, at: 5.8, u, roleAt: 6.6, size: 26, shapeAt: 6.8 });
        fade(g, win(u, 6.6, 8.4), () => thought(g, '(속으로) 30만 원…', LX + 420, 186 + B.bh + 14, 300));
        const ay = 186 + B.bh + 84;
        answer(g, { x: LX, y: ay, w: 780, A: it.bad, B: u >= 9.6 ? it.ok : null, p: (u - 9.6) / 0.8, at: 7.6, u, size: 26, maxW: 640, trapAt: 8.4, strikeAt: 8.6, tag: ['만 → man? 영어에는 없는 말', COL.trap, 8.8, 9.6], tagY: ay + 84, verdict: u >= 10.5 ? { ok: okOn(it.q, it.ok, C), at: 10.5 } : null });
        fade(g, ramp(u, 6.0, 0.5), () => manFig(g, RX, 160, RW, 300000, { p: ramp(u, 9.4, 0.8) }));
      });
      // [12, 16.4] 여권: 있다고만 × → 내밀면서 ✓
      fade(g, ramp(u, 11.8, 0.4) * (1 - ramp(u, 16.2, 0.4)), () => {
        label(g, '환전 창구 · 여권', LX, 160, { color: COL.accent, size: 16 });
        exch(g, u, { q: it.dq, at: 12.2, aAt: 13.2, bad: it.dbad, ok: it.dok, mAt: 14.6, tag: '있다고만 → 내밀면서 Here\'s …', tagY: 84, y: 186, size: 26, qsize: 24 });
        docCard(g, RX + 50, 190, 200, 'passport', { on: u >= 14.8 });
        fade(g, ramp(u, 15.0, 0.4), () => icon(g, 'hand', RX + 230, 340, 46, COL.ante, 2));
      });
      // [16.6, 21] 새 번호 → 되짚기
      fade(g, ramp(u, 16.4, 0.4) * (1 - ramp(u, 20.8, 0.5)), () => {
        label(g, '휴대폰 가게 · 새 번호', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, it.rq, { x: LX, y: 186, w: 780, at: 16.6, u, size: 22, roleAt: 17.2, shapeAt: 17.4 });
        const ay = 186 + B.bh + 18;
        answer(g, { x: LX, y: ay, w: 780, A: it.skip, B: u >= 18.8 ? it.check : null, p: (u - 18.8) / 0.8, at: 17.6, u, size: 24, maxW: 600, trapAt: 18.0, strikeAt: 18.1, tag: ['되짚지 않으면 틀린 번호를 몰라요', COL.trap, 18.2, 18.8], tagY: ay + 80, verdict: u >= 19.7 ? { ok: okOn(it.rq, it.check, C), at: 19.7 } : null });
        phoneScreen(g, RX + 50, 150, 200, { phone: D.phone, p: ramp(u, 17.4, 0.6) });
      });
      const STEP = [
        ['①', '열쇠 낱말 + 모양', 'Large bills or small bills?', '고르는 질문 → 고른 것 + please', COL.ante, 'Large bills or small bills?'],
        ['②', '틀에 내 정보 넣기', "So, it's ___?", '서류는 내밀고 · 숫자는 끊어 되짚기', COL.rel, "So, it's 555-0147?"],
        ['③', '공손하게 끝내기', 'Would a letter … work?', '부탁은 질문으로 · please · Sorry', COL.verb, 'Would a letter from my university work?'],
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

    /* 01 환전 창구에서 은행까지: 환전(하나) · 휴대폰 가게(둘) · 은행(넷) */
    map(g, u) {
      const sel = S.stop != null ? S.stop : null;
      const EB = { x: 70, y: 146, w: 220, h: 322 }, PB = { x: 320, y: 146, w: 300, h: 322 }, BB = { x: 650, y: 146, w: 560, h: 322 };
      const POS = { fx: [180, 318], shop: [410, 318], sim: [530, 318], teller: [720, 318], id: [858, 318], form: [998, 318], card: [1138, 318] };
      const NM = { fx: ['환전 창구', '금액 · 지폐'], shop: ['휴대폰 가게', '요금제 · 데이터'], sim: ['유심', '새 번호 되짚기'], teller: ['은행 창구', '용건 · 통장'], id: ['서류', '여권 · 주소 증명'], form: ['신청서', '주소 · 전화번호'], card: ['카드', '비밀번호 · ATM'] };
      fade(g, ramp(u, 0.3, 0.6), () => {
        // 환전 창구
        panel(g, EB.x, EB.y, EB.w, EB.h, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        txt(g, 'EXCHANGE', EB.x + 20, EB.y + 24, { size: 12, weight: 700, fam: FM, color: COL.muted });
        rr(g, EB.x + 22, EB.y + 50, EB.w - 44, 52, 8); g.fillStyle = '#0B1A14'; g.fill();
        txt(g, 'USD 1,250', EB.x + EB.w / 2, EB.y + 76, { size: 16, weight: 800, fam: FM, color: '#BFF5D2', align: 'center' });
        rr(g, EB.x + 22, EB.y + 268, EB.w - 44, 36, 8); g.fillStyle = COL.wood; g.fill();
        txt(g, 'COUNTER', EB.x + EB.w / 2, EB.y + 286, { size: 11, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
        // 휴대폰 가게
        panel(g, PB.x, PB.y, PB.w, PB.h, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        txt(g, `PHONE SHOP · ${BK.SHOP.toUpperCase()}`, PB.x + 20, PB.y + 24, { size: fit(g, `PHONE SHOP · ${BK.SHOP.toUpperCase()}`, 12, PB.w - 40, 700, 8, FM), weight: 700, fam: FM, color: COL.muted });
        g.save(); g.globalAlpha *= 0.5;
        [0, 1].forEach(k => {
          const sy = PB.y + 96 + k * 52;
          for (let i = 0; i < 8; i++) { rr(g, PB.x + 30 + i * 31, sy - 34, 20, 32, 4); g.fillStyle = ['#6EC8FF', '#C9A7FF', '#FFC15E', '#7FE0A8'][(i + k) % 4]; g.fill(); }
          g.fillStyle = COL.wood; g.fillRect(PB.x + 22, sy, PB.w - 44, 6);
        });
        g.restore();
        rr(g, PB.x + 30, PB.y + 268, PB.w - 60, 36, 8); g.fillStyle = COL.wood; g.fill();
        txt(g, 'PHONES · SIM CARDS', PB.x + PB.w / 2, PB.y + 286, { size: 11, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
        // 은행
        panel(g, BB.x, BB.y, BB.w, BB.h, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        txt(g, `BANK · ${BK.BANK.toUpperCase()}`, BB.x + 20, BB.y + 24, { size: 12, weight: 700, fam: FM, color: COL.muted });
        icon(g, 'teller', BB.x + BB.w - 34, BB.y + 28, 24, COL.muted);
        [0, 1, 2].forEach(k => { const wx = BB.x + 40 + k * 170; rr(g, wx, BB.y + 54, 140, 80, 10); g.fillStyle = 'rgba(191,227,255,0.07)'; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.stroke(); txt(g, k < 2 ? `TELLER ${k + 1}` : 'NEW ACCOUNTS', wx + 70, BB.y + 72, { size: 10.5, weight: 700, fam: FM, color: COL.muted, align: 'center' }); });
        rr(g, BB.x + 30, BB.y + 268, BB.w - 60, 36, 8); g.fillStyle = COL.wood; g.fill();
        txt(g, 'COUNTER', BB.x + BB.w / 2, BB.y + 286, { size: 11, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
      });
      fade(g, ramp(u, 6.0, 0.4), () => arrow(g, 292, 318, 318, 318, 'rgba(201,167,255,0.75)', 2.2));
      fade(g, ramp(u, 11.8, 0.4), () => { arrow(g, 622, 318, 648, 318, 'rgba(201,167,255,0.75)', 2.2); chip(g, '새 번호', 635, 290, { size: 11.5, weight: 700, color: '#1D1305', fill: COL.verb, h: 22, r: 11, pad: 7, align: 'center' }); });
      const AT = [1.0, 6.4, 8.6, 12.4, 13.6, 14.8, 16.0];
      BK.PLACES.forEach((p, i) => {
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
        const p = BK.PLACES[sel];
        panel(g, LX, by, 1120, bh, { fill: COL.panel, stroke: COL.accent });
        icon(g, p.id, LX + 28, by + 24, 22, COL.accent);
        txt(g, `${sel + 1}. ${p.ko}`, LX + 48, by + 24, { size: 17, weight: 700, color: COL.accent });
        BK.PLACEQ[p.id].forEach((qid, k) => {
          const q = BK.Q[qid], t = q.short && /[?!.]$/.test(q.short) && q.short.length < 60 ? q.short : q.en, R = richLay(g, t, q.fast ? [] : Qm(q), 17, 590, { weight: 600 });
          shapeMark(g, q.shape, LX + 34, by + 54 + k * 28, 14, { disc: false, iw: 2.2 });
          if (R.rows > 1) txt(g, t, LX + 52, by + 54 + k * 28, { size: fit(g, t, 17, 590, 600), weight: 600, color: COL.en });
          else richDraw(g, R, LX + 52, by + 54 + k * 28, { color: COL.en });
          say(LX + 48, by + 40 + k * 28, Math.min(R.w, 600) + 8, 28, q.en);
        });
        txt(g, '대답 →', LX + 690, by + 24, { size: 14, weight: 700, color: COL.muted });
        BK.PLACEQ[p.id].map(id => BK.Q[id]).forEach((q, k) => { const a = BK.model(q, D), t = shortText(a); txt(g, t, LX + 690, by + 54 + k * 28, { size: fit(g, t, 16, 420, 600), weight: 600, color: COL.rel }); say(LX + 686, by + 40 + k * 28, 430, 28, BK.text(a)); });
      } else {
        BK.PLACES.forEach((p, i) => fade(g, ramp(u, 6.2 + i * 0.5, 0.4), () => {
          const x = LX + i * 161, q = BK.Q[BK.PLACEQ[p.id][0]], t = q.short && q.short.length < 48 ? q.short : q.en, me = ME_FIRST[p.id] && u >= 18.2;
          panel(g, x, by, 151, bh, { fill: COL.panel, stroke: me ? COL.verb : COL.faint, lw: me ? 2 : 1.5 });
          txt(g, `${i + 1}`, x + 14, by + 20, { size: 13, weight: 700, fam: FM, color: COL.accent });
          txt(g, me ? '내가 먼저' : i < 1 ? '환전' : i < 3 ? '휴대폰' : '은행', x + 140, by + 20, { size: 12, weight: 700, color: me ? COL.verb : COL.muted, align: 'right' });
          const R = richLay(g, t, [], 14, 130, { weight: 600 });
          richDraw(g, R, x + 12, by + 48, { color: COL.en });
          say(x, by, 151, bh, q.en);
        }));
        fade(g, ramp(u, 24.2, 0.5), () => tag(g, '은행 · 환율 · 요금 · 주소 · 번호는 지어낸 예시예요', 1200, 126, COL.muted, { align: 'right', size: 14, h: 26 }));
      }
    },

    /* 02 환전 창구: 명령 × → 부탁 틀 ✓ → 만 × · 3만 × · 300만 × → thousand ✓ → 지폐 → 받을 금액 되짚기 */
    fx(g, u) {
      if (S.fx) {
        const s = S.fx, C = Object.assign({}, D, { won: s.won, bills: s.bills, usd: BK.fx(s.won) });
        let r = exch(g, 99, { q: 'fx_much', at: -9, ok: OT('mc_won', s.won), card: C, y: 150, qo: { all: true } });
        r = exch(g, 99, { q: 'fx_bills', at: -9, ok: OT('bl_pl', s.bills), card: C, y: r.y + 16, qo: { all: true } });
        exch(g, 99, { q: BK.simQ('fx_get', C), at: -9, ok: OT('gt_so', C.usd), card: C, y: r.y + 16, qo: { all: true } });
        rateBoard(g, RX, 150, RW, { won: s.won });
        billsFig(g, RX, 370, RW, { sel: s.bills });
        return;
      }
      const SC = BK.SCENE;
      // [0.4, 11.5] 용건
      if (u < 11.8) fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const [qid, give, some, full] = SC.need;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[give, 2.4, 6.0, '명령처럼 들려요 · please도 없어요']]);
        if (u >= 5.8) fade(g, ramp(u, 6.0, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: full, at: 6.4, u, size: 22, maxW: 640, verdict: { ok: okOn(qid, full), at: 7.8 } });
          fade(g, ramp(u, 9.0, 0.4), () => answer(g, { x: LX, y: y + A.bh + 14, w: 780, A: some, at: 9.2, u, size: 20, edge: 'rgba(242,194,154,0.25)', verdict: { ok: okOn(qid, some), at: 9.8 }, tag: ['금액은 다음 질문에서 말해도 돼요', COL.muted, 10.0], tagY: y + A.bh + 14 + 74 }));
        });
        fade(g, ramp(u, 1.0, 0.5), () => rateBoard(g, RX, 150, RW, {}));
      });
      // [11.5, 23] 바꿀 금액: 만 → thousand
      if (u >= 11.2 && u < 23.4) fade(g, ramp(u, 11.4, 0.4) * (1 - ramp(u, 23.0, 0.4)), () => {
        const [qid, man, k30, m300, ok] = SC.won;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 11.7, u, roleAt: 12.3, size: 22, shapeAt: 12.5 });
        const y = 150 + B.bh + 14;
        fade(g, win(u, 12.2, 13.4), () => thought(g, '(속으로) 30만 원…', LX + 420, y, 300));
        trapSeq(g, u, y, [[man, 13.4, 17.6, '만 → man? 영어에는 없는 말이에요'], [k30, 17.6, 19.2, 'thirty thousand = 3만 원'], [m300, 19.2, 20.8, 'three million = 300만 원']]);
        if (u >= 20.6) fade(g, ramp(u, 20.8, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 21.0, u, size: 23, verdict: { ok: okOn(qid, ok), at: 21.7 } });
          fade(g, ramp(u, 21.9, 0.3), () => tag(g, '만 = ten thousand · 세 자리씩 끊어요', LX + 780, y + A.bh + 30, COL.clause, { align: 'right', size: 15, h: 30 }));
        });
        manFig(g, RX, 150, RW, 300000, { p: ramp(u, 15.4, 0.8), traps: ramp(u, 17.6, 0.6) });
      });
      // [23, 29] 지폐
      if (u >= 22.8 && u < 29.4) fade(g, ramp(u, 23.0, 0.4) * (1 - ramp(u, 29.0, 0.4)), () => {
        const [qid, yes, paper, ok] = SC.bills;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 23.2, u, roleAt: 23.8, size: 22, shapeAt: 24.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 24.4, 26.0, '고르는 질문에 Yes → 고른 것이 없어요'], [paper, 26.0, 27.4, '지폐 → paper? 종이로 들려요']]);
        if (u >= 27.2) fade(g, ramp(u, 27.4, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 27.6, u, size: 23, verdict: { ok: okOn(qid, ok), at: 28.2 } }));
        billsFig(g, RX, 150, RW, { sel: u >= 27.8 ? 'small' : null });
      });
      // [29, 40] 받을 금액 되짚기
      if (u >= 28.8) fade(g, ramp(u, 29.0, 0.4), () => {
        const [qid, okay, w214, so, sayA] = SC.get, q = BK.simQ(qid, D);
        const B = staff(g, q, { x: LX, y: 150, w: 780, at: 29.2, u, roleAt: 29.8, size: 22, shapeAt: 30.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[okay, 30.2, 31.9, '되짚지 않으면 틀린 금액을 몰라요']]);
        fade(g, win(u, 31.9, 34.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: w214, at: 32.1, u, size: 23, verdict: { ok: okOn(q, w214), at: 32.8 }, tag: ['fourteen → $214로 들었어요', COL.trap, 33.0] });
          say2(g, `No — it comes to ${BK.money(D.usd)}.`, y + A.bh + 14, 33.4, u, 'clerk', 'gb', [[BK.money(D.usd), 'slot']]);
        });
        if (u >= 34.4) fade(g, ramp(u, 34.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: so, at: 34.8, u, size: 23, verdict: { ok: okOn(q, so), at: 35.5 } });
          const T = say2(g, BK.reply(q, so, D), y + A.bh + 14, 35.9, u, 'clerk', 'gb');
          fade(g, ramp(u, 37.2, 0.4), () => answer(g, { x: LX, y: y + A.bh + T.bh + 28, w: 780, A: sayA, at: 37.4, u, size: 20, edge: 'rgba(242,194,154,0.25)', verdict: { ok: okOn(q, sayA), at: 38.0 }, tag: ['같은 확인 · 되묻는 말', COL.muted, 38.2] }));
        });
        fade(g, 1 - ramp(u, 34.4, 0.4), () => rateBoard(g, RX, 150, RW, { won: D.won, p: ramp(u, 29.8, 0.8) }));
        if (u >= 34.4) fade(g, ramp(u, 34.6, 0.4), () => pairsFig(g, RX, 150, RW, u, 34.8));
      });
    },

    /* 03 휴대폰 가게: 개통 × · 유심 × → SIM card ✓ → 요금제 · 데이터 · 기간 · 빠른 말 · 값 */
    shop(g, u) {
      if (S.shape) {
        const q = BK.Q[S.shape], Sx = BK.SHAPE[q.shape], a = BK.model(q, D);
        const B = staff(g, q, { x: LX, y: 160, w: 1100, all: true, u: 99, size: 26 });
        shapeTag(g, q.shape, LX, 160 + B.bh + 40, { size: 18, h: 42 });
        txt(g, Sx.say, LX, 160 + B.bh + 96, { size: 19, weight: 600, color: COL.soft });
        if (q.aux) txt(g, `${BK.AUX[q.aux].q} → ${BK.AUX[q.aux].a}`, LX, 160 + B.bh + 130, { size: 17, weight: 600, color: COL.ante });
        else if (q.shape === 'yn' && Sx.offer) txt(g, Sx.offer, LX, 160 + B.bh + 130, { size: 16, weight: 600, color: COL.muted });
        answer(g, { x: LX, y: 160 + B.bh + 160, w: 1100, A: a, all: true, u: 99, size: 26, maxW: 900, verdict: { ok: true, at: -1 } });
        return;
      }
      const SC = BK.SCENE;
      // [0.4, 11.5] 용건
      if (u < 11.8) fade(g, 1 - ramp(u, 11.3, 0.4), () => {
        const [qid, open, usim, ok] = SC.sim;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[open, 2.4, 6.2, '개통 → open? ‘휴대폰을 뜯다’로 들려요'], [usim, 6.2, 8.2, '유심 → 한국에서 쓰는 말 · a SIM card']]);
        if (u >= 8.0) fade(g, ramp(u, 8.2, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 8.4, u, size: 22, maxW: 640, verdict: { ok: okOn(qid, ok), at: 9.6 } }));
        fade(g, ramp(u, 1.0, 0.5), () => phoneScreen(g, RX + 50, 150, 200, { nosim: true }));
      });
      // [11.5, 17] 요금제 + 이어서 들리는 말
      if (u >= 11.3 && u < 17.4) fade(g, ramp(u, 11.5, 0.4) * (1 - ramp(u, 17.0, 0.4)), () => {
        const [qid, yes, ok] = SC.plan;
        exch(g, u, { q: qid, at: 11.7, aAt: 13.8, bad: yes, ok, mAt: 15.0, tag: '고르는 질문에 Yes → 고른 것이 없어요', tagY: 78, y: 150, w: 780, size: 23 });
        linked(g, BK.LINKED[1], LX + 10, 340, u, 12.6, 760);
      });
      // [17, 22.5] 데이터
      if (u >= 16.8 && u < 22.9) fade(g, ramp(u, 17.0, 0.4) * (1 - ramp(u, 22.5, 0.4)), () => {
        const [qid, free, , d15] = SC.data;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 17.2, u, roleAt: 17.8, size: 22, shapeAt: 18.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[free, 18.4, 20.6, 'data free → 공짜? 무제한은 Unlimited data']]);
        if (u >= 20.4) fade(g, ramp(u, 20.6, 0.3), () => answer(g, { x: LX, y, w: 780, A: d15, at: 20.8, u, size: 23, verdict: { ok: okOn(qid, d15), at: 21.4 } }));
      });
      // [22.5, 28] 머무는 기간
      if (u >= 22.3 && u < 28.4) fade(g, ramp(u, 22.5, 0.4) * (1 - ramp(u, 28.0, 0.4)), () => {
        const [qid, dur, ok] = SC.stay;
        exch(g, u, { q: qid, at: 22.7, aAt: 24.0, bad: dur, ok, mAt: 25.8, tag: '‘동안’ → during? 숫자로 센 기간은 for', tagY: 78 });
        notePanel(g, RX, 370, RW, '머무는 기간 · for', [
          ['For six months.', 'for + 기간 (6개월 동안)', COL.clause],
          ['During my stay.', 'during + 그때의 이름 (머무는 동안)', COL.soft],
        ], { u, at: 25.0, step: 0.6 });
      });
      // 오른쪽 [11.5, 28]: 요금표
      if (u >= 11.3 && u < 28.4) fade(g, ramp(u, 11.6, 0.5) * (1 - ramp(u, 28.0, 0.4)), () => planBoard(g, RX, 150, RW, { plan: u >= 15.6 ? 'prepaid' : null, data: u >= 21.0 ? 'd15' : null }));
      // [28, 33] 빠른 말
      if (u >= 27.8 && u < 33.4) fade(g, ramp(u, 28.0, 0.4) * (1 - ramp(u, 33.0, 0.4)), () => {
        const [qf, guess, rp] = SC.dfast;
        const r = exch(g, u, { q: qf, at: 28.2, aAt: 29.6, bad: guess, ok: rp, mAt: 31.0, tag: '빠른 말을 짐작했어요', tagY: 78 });
        say2(g, 'How much data do you need?', r.y + 14, 32.0, u, 'mobile', 'au', [['How much data', 'key']]);
        notePanel(g, RX, 150, RW, '빠른 말 · 호주식', [
          ["d'you reckon", '= do you think (호주 · 영국에서 자주 써요)', COL.soft],
          ['How much data do you need?', '= 같은 질문 · 정보 질문', COL.ante],
        ], { u, at: 28.8, step: 0.8 });
      });
      // [33, 39] 값
      if (u >= 32.8) fade(g, ramp(u, 33.0, 0.4), () => {
        const [qc, c13, c30, lit, card] = SC.cost;
        const B2 = staff(g, qc, { x: LX, y: 150, w: 780, at: 33.2, u, roleAt: 33.8, size: 22, shapeAt: 34.0 });
        const y = 150 + B2.bh + 14;
        const A1 = answer(g, { x: LX, y, w: 780, A: c13, B: u >= 35.0 ? c30 : null, p: (u - 35.0) / 0.7, at: 34.2, u, size: 23, trapAt: 34.6, tag: ['thirteen → 들은 값과 달라요', COL.trap, 34.7, 35.0], verdict: u >= 35.7 ? { ok: okOn(qc, c30), at: 35.7 } : null });
        const y2 = y + A1.bh + 16;
        fade(g, ramp(u, 36.0, 0.3), () => answer(g, { x: LX, y: y2, w: 780, A: lit, B: u >= 37.4 ? card : null, p: (u - 37.4) / 0.6, at: 36.2, u, size: 23, trapAt: 36.6, strikeAt: 36.7, tag: ['Card is okay? → 무엇이 괜찮은지 몰라요', COL.trap, 36.8, 37.4], tagY: y2 + 78, verdict: u >= 38.0 ? { ok: okOn(qc, card), at: 38.0 } : null }));
        notePanel(g, RX, 150, RW, '값 듣기 · 내기', [
          ['$30 → thirty dollars', '$13 → thirteen dollars와 헷갈려요', COL.clause, [], 'thirty dollars'],
          ['Can I pay by card?', '카드로 낼게요', COL.verb],
          ['Here you go.', '현금을 건넬 때', COL.soft],
        ], { u, at: 33.6, step: 1.4 });
      });
    },

    /* 04 유심 · 새 번호: Is it 짝 → 되짚지 않음 × · 큰 수 × · 끝 두 자리 × → 되짚기 ✓ → 빠른 말 → top-up */
    sim(g, u) {
      if (S.num) {
        const s = S.num, C = Object.assign({}, D, { phone: s.phone }), q = BK.simQ('sm_num', C);
        const a = s.a === 'ok' ? OT('nb_ok') : s.a === 'big' ? OT('nb_big', s.phone) : s.a === 'swap' ? OT('nb_so', BK.phoneTrap(s.phone)) : OT('nb_so', s.phone);
        const y = pickView(g, q, a, C);
        const j = BK.judge(q, a, C);
        say2(g, j.ok ? BK.reply(q, a, C) : BK.REACT[2](q, j, a, C).en, y + 20, -9, 99, 'mobile', 'au');
        numChunk(g, RX, 150, RW, s.phone, { big: s.a === 'big' ? 1 : 0, trap: s.a === 'swap' ? BK.phoneTrap(s.phone) : null });
        return;
      }
      const SC = BK.SCENE;
      // [0.4, 6] 잠금 해제
      if (u < 6.4) fade(g, 1 - ramp(u, 6.0, 0.4), () => {
        const [qid, am, yes] = SC.unlock;
        const r = exch(g, u, { q: qid, at: 0.8, aAt: 2.0, bad: am, ok: yes, mAt: 3.6, tag: 'Is로 물었는데 I am → 짝이 어긋나요', tagY: 78 });
        fade(g, ramp(u, 4.6, 0.4), () => tag(g, "Is it …? → Yes, it is. · No, it isn't.", LX + 780, r.y + 40, COL.ante, { align: 'right', size: 15, h: 30 }));
        auxTable(g, RX, 150, RW, { hl: 'is', u, at: 1.0 });
        fade(g, ramp(u, 1.2, 0.4), () => icon(g, 'lock', RX + 150, 340, 54, COL.soft, 1.8));
      });
      // [6, 23.5] 새 번호 되짚기
      if (u >= 5.8 && u < 23.9) fade(g, ramp(u, 6.0, 0.4) * (1 - ramp(u, 23.5, 0.4)), () => {
        const [qid, okay, big, swap, so] = SC.num, q = BK.simQ(qid, D);
        const B = staff(g, q, { x: LX, y: 150, w: 780, at: 6.2, u, roleAt: 6.8, size: 22, shapeAt: 7.6 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[okay, 8.0, 12.0, '되짚지 않으면 틀린 번호를 서류에 써요'], [big, 12.0, 18.0, '큰 수처럼 읽으면 못 알아들어요']]);
        fade(g, win(u, 18.0, 20.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: swap, at: 18.2, u, size: 23, verdict: { ok: okOn(q, swap), at: 18.8 }, tag: ['끝 두 자리가 바뀌었어요', COL.trap, 19.0] });
          say2(g, `No — it's ${D.phone}.`, y + A.bh + 14, 19.3, u, 'mobile', 'au', [[D.phone, 'slot']]);
        });
        if (u >= 20.4) fade(g, ramp(u, 20.6, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: so, at: 20.8, u, size: 23, verdict: { ok: okOn(q, so), at: 21.5 } });
          say2(g, BK.reply(q, so, D), y + A.bh + 14, 22.0, u, 'mobile', 'au');
        });
        fade(g, ramp(u, 6.4, 0.5), () => numChunk(g, RX, 150, RW, D.phone, { big: u >= 12.4 && u < 18.0 ? ramp(u, 12.6, 0.4) : 0, trap: u >= 18.6 && u < 20.6 ? BK.phoneTrap(D.phone) : null }));
      });
      // [23.5, 27.5] 빠른 말
      if (u >= 23.3 && u < 27.9) fade(g, ramp(u, 23.5, 0.4) * (1 - ramp(u, 27.5, 0.4)), () => {
        const [qf, guess, rp] = SC.nfast;
        exch(g, u, { q: qf, at: 23.7, aAt: 24.8, bad: guess, ok: rp, mAt: 26.0, tag: '빠른 말 · 번호를 짐작했어요', tagY: 78 });
        notePanel(g, RX, 150, RW, '빠른 말 · 번호는 천천히 다시', [
          ["Righto, new number's …", '빠르면 Your와 is가 줄어 들려요', COL.soft],
          ['Could you say the number again, slowly?', '다시 · 천천히 부탁해요', COL.verb],
        ], { u, at: 24.0, step: 1.2 });
      });
      // [27.5, 33] 자동 충전: 모르는 낱말 → 묻기 → 대답
      if (u >= 27.3) fade(g, ramp(u, 27.5, 0.4), () => {
        const [qid, , what, no] = SC.top;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 27.7, u, roleAt: 28.3, size: 22, shapeAt: 28.5 });
        const y = 150 + B.bh + 14;
        const A = answer(g, { x: LX, y, w: 780, A: what, at: 28.8, u, size: 23, verdict: { ok: okOn(qid, what), at: 29.5 } });
        const T = say2(g, 'It means we add money to your plan every month, automatically.', y + A.bh + 14, 29.9, u, 'mobile', 'au', [['add money', 'slot']]);
        fade(g, ramp(u, 31.2, 0.3), () => answer(g, { x: LX, y: y + A.bh + T.bh + 28, w: 780, A: no, at: 31.4, u, size: 23, verdict: { ok: okOn(qid, no), at: 32.1 } }));
        notePanel(g, RX, 150, RW, 'top up · 충전', [
          ['top up · top-up', '선불 요금을 채워 넣다 (충전)', COL.clause],
          ['auto top-up', '자동 충전', COL.clause],
          ['charge my phone', '배터리를 충전하다', COL.soft],
        ], { u, at: 28.4, step: 0.5 });
      });
    },

    /* 05 은행 창구: 통장 × · 명령 × · 사실만 × → 계좌 열기 ✓ → checking ✓ → Are you 짝 */
    teller(g, u) {
      if (S.aux) {
        const q = BK.Q[S.aux.q], a = OT(S.aux.a, S.aux.v), C = Object.assign({}, D, S.aux.card || {});
        const r = exch(g, 99, { q, at: -9, ok: a, card: C, y: 160, qo: { all: true } });
        whyLine(g, BK.judge(q, a, C), r.y + 30, 780, LX);
        auxTable(g, RX, 150, RW, { hl: q.aux });
        return;
      }
      const SC = BK.SCENE;
      // [0.4, 11.5] 용건
      if (u < 11.8) fade(g, 1 - ramp(u, 11.3, 0.4), () => {
        const [qid, book, make, half, ok] = SC.acct;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[book, 2.4, 6.0, '통장 만들기 → make a bankbook? 계좌를 열어요'], [make, 6.0, 7.8, '명령처럼 들려요'], [half, 7.8, 9.6, '사실만 → 용건이 없어요']]);
        if (u >= 9.4) fade(g, ramp(u, 9.6, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 9.8, u, size: 23, maxW: 640, verdict: { ok: okOn(qid, ok), at: 10.5 } }));
        notePanel(g, RX, 150, RW, '통장 · 계좌', [
          ['open a bank account', '계좌를 열다 (통장을 만들다)', COL.clause],
          ['a bankbook', '종이 통장 · 요즘은 잘 쓰지 않아요', COL.soft],
          ['a debit card', '체크카드 (08장)', COL.soft],
        ], { u, at: 3.0, step: 0.6 });
      });
      // [11.5, 17] 통장 고르기
      if (u >= 11.3 && u < 17.4) fade(g, ramp(u, 11.5, 0.4) * (1 - ramp(u, 17.0, 0.4)), () => {
        const [qid, book, yes, ok] = SC.type;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 11.7, u, roleAt: 12.3, size: 22, shapeAt: 12.5 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 12.8, 14.4, '고르는 질문에 Yes → 고른 것이 없어요'], [book, 14.4, 15.6, 'bankbook → 종이 통장']]);
        if (u >= 15.4) fade(g, ramp(u, 15.6, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 15.8, u, size: 23, verdict: { ok: okOn(qid, ok), at: 16.4 } }));
        notePanel(g, RX, 150, RW, 'checking · savings', [
          ['a checking account', '입출금 통장 · 월세 · 생활비 · 직불 카드', COL.clause],
          ['a savings account', '저축 통장 · 모아 두는 돈', COL.soft],
        ], { u, at: 12.6, step: 0.6, hl: u >= 16.0 ? 0 : null });
      });
      // [17, 28] 학생인가요: Are you → I am
      if (u >= 16.8) fade(g, ramp(u, 17.0, 0.4), () => {
        const [qid, doA, yes, full] = SC.student;
        const r = exch(g, u, { q: qid, at: 17.2, aAt: 18.4, bad: doA, ok: full, mAt: 20.2, tag: 'Are로 물었는데 I do → 짝이 어긋나요', tagY: 108 });
        fade(g, ramp(u, 22.8, 0.4), () => answer(g, { x: LX, y: r.y + 16, w: 780, A: yes, at: 23.0, u, size: 20, edge: 'rgba(242,194,154,0.25)', verdict: { ok: okOn(qid, yes), at: 23.6 }, tag: ['통하지만 · 어느 학교인지 덧붙이면 더 좋아요', COL.muted, 23.8], tagY: r.y + 16 + 74 }));
        auxTable(g, RX, 150, RW, { hl: 'be', u, at: 17.4 });
      });
    },

    /* 06 서류: 있다고만 × → 내밀면서 ✓ · 두 번째 신분증 짝 · 주소 증명(있을 때 · 없을 때) · 빠른 말 · 서류 넷 */
    id(g, u) {
      if (S.doc) {
        const s = S.doc, C = Object.assign({}, D, { proof: s.proof });
        const y = pickView(g, s.q, s.a, C);
        const j = BK.judge(BK.Q[s.q], s.a, C);
        say2(g, j.ok ? BK.reply(BK.Q[s.q], s.a, C) : BK.REACT[j.stage](BK.Q[s.q], j, s.a, C).en, y + 20, -9, 99, 'teller', 'us');
        const v = s.a.v && BK.DOCS[s.a.v] ? s.a.v : null;
        docCards(g, RX, 150, RW, { hl: v ? [v] : [], gone: s.proof ? [] : ['lease'] });
        return;
      }
      const SC = BK.SCENE, NP = Object.assign({}, D, { proof: false });
      // [0.4, 6] 여권
      fade(g, win(u, 0.4, 6.0, 0.3), () => exch(g, u, { q: SC.pass[0], at: 0.8, aAt: 2.0, bad: SC.pass[1], ok: SC.pass[2], mAt: 3.8, tag: '있다고만 → 내밀면서 Here\'s …', tagY: 78 }));
      // [6, 12] 두 번째 신분증
      fade(g, win(u, 6.0, 12.0, 0.3), () => {
        const [qid, have, am, yes] = SC.second;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 6.2, u, roleAt: 6.8, size: 22, shapeAt: 7.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[have, 7.4, 9.0, 'Yes, I have. → have 뒤가 비었어요'], [am, 9.0, 10.4, 'Do you로 물었는데 I am → 짝이 어긋나요']]);
        if (u >= 10.2) fade(g, ramp(u, 10.4, 0.3), () => answer(g, { x: LX, y, w: 780, A: yes, at: 10.6, u, size: 23, maxW: 640, verdict: { ok: okOn(qid, yes), at: 11.2 } }));
      });
      // [12, 17.5] 주소 증명 (있을 때)
      fade(g, win(u, 12.0, 17.5, 0.3), () => exch(g, u, { q: SC.proof[0], at: 12.2, aAt: 13.4, bad: SC.proof[1], ok: SC.proof[2], mAt: 15.2, tag: 'dormitory paper → 무슨 서류인지 몰라요', tagY: 78, maxW: 640 }));
      // [17.5, 23.5] 주소 증명 서류가 없을 때
      fade(g, win(u, 17.5, 23.5, 0.3), () => {
        label(g, '주소 증명 서류가 없다면', LX, 160, { color: COL.accent, size: 15 });
        const r = exch(g, u, { q: SC.noproof[0], at: 17.8, aAt: 18.9, bad: SC.noproof[1], ok: SC.noproof[2], mAt: 20.8, tag: '없다는 사실만 → 부탁이 빠졌어요', tagY: 108, card: NP, y: 182, maxW: 640 });
        if (u >= 21.8) say2(g, BK.reply(BK.Q.id_proof, SC.noproof[2], NP), r.y + 14, 22.0, u, 'teller', 'us', [['a letter from your university', 'slot']]);
      });
      // [23.5, 29] 빠른 말
      fade(g, win(u, 23.5, 29.0, 0.3), () => {
        const r = exch(g, u, { q: SC.ifast[0], at: 23.7, aAt: 24.8, bad: SC.ifast[1], ok: SC.ifast[2], mAt: 26.4, tag: '빠른 말을 짐작했어요', tagY: 78 });
        say2(g, 'Yes — can I see your passport?', r.y + 14, 27.4, u, 'teller', 'us', [['passport', 'key']]);
      });
      // 오른쪽 [0.4, 29]: 서류 넷
      if (u < 29.4) fade(g, ramp(u, 0.6, 0.5) * (1 - ramp(u, 29.0, 0.4)), () => {
        const hl = u < 3.8 ? [] : u < 6 ? ['passport'] : u < 10.6 ? [] : u < 12 ? ['sid'] : u < 15.2 ? [] : u < 17.5 ? ['lease'] : u < 20.8 ? [] : u < 23.5 ? ['letter'] : u >= 26.4 ? ['passport'] : [];
        docCards(g, RX, 150, RW, { hl, gone: u >= 17.5 && u < 23.5 ? ['lease'] : [] });
      });
      // [29, 34] 서류 넷 · Here's my …
      if (u >= 28.8) fade(g, ramp(u, 29.0, 0.4), () => {
        ['passport', 'sid', 'lease', 'letter'].forEach((id, k) => fade(g, ramp(u, 29.2 + k * 0.6, 0.4), () => {
          const x = LX + k * 285, cw = 240;
          docCard(g, x, 170, cw, id, {});
          const en = `Here's ${BK.DOCS[id].t}.`, ch = Math.round(cw * 0.82);
          txt(g, en, x + cw / 2, 170 + ch + 30, { size: fit(g, en, 18, 270, 700), weight: 700, color: COL.en, align: 'center' });
          txt(g, BK.DOCS[id].ko, x + cw / 2, 170 + ch + 58, { size: fit(g, BK.DOCS[id].ko, 14, 270, 600), weight: 600, color: COL.muted, align: 'center' });
          say(x - 10, 170 + ch + 12, 280, 36, en);
        }));
        fade(g, ramp(u, 31.8, 0.4), () => pieces(g, [["Here's ", 'frame'], ['my passport', 'slot'], [' · ', ''], ['Would', 'pol'], [' a letter from my university ', 'frame'], ['work', 'pol'], ['?', 'frame']], W / 2, 500, 22, 1100, { align: 'center' }));
      });
    },

    /* 07 주소 · 전화번호 · 서명: 기숙사 × → 한국 차례 × → 번지 뒤 × · 방 번호 × · 빠짐 × → 한 줄 ✓ → 번호 → 서명 → 빠른 말 */
    form(g, u) {
      if (S.line) {
        const s = S.line, C = Object.assign({}, D, { addr: { room: s.room, hall: s.hall } }), a = BK.L(s.words.slice());
        const B = staff(g, 'fm_addr', { x: LX, y: 150, w: 780, all: true, u: 99, size: 22 });
        if (!s.words.length) txt(g, '아래 조각을 골라 주소 한 줄을 만들어 보세요.', LX, 150 + B.bh + 40, { size: 18, weight: 600, color: COL.muted });
        else {
          const A = answer(g, { x: LX, y: 150 + B.bh + 16, w: 780, A: a, all: true, u: 99, size: 21, maxW: 640, verdict: { ok: BK.checkLine(a.line, C).ok, at: -1 } });
          const fx = BK.fixLine(a.line, C);
          const T = talk(g, { side: 'L', x: LX, y: 150 + B.bh + A.bh + 30, w: 780, text: fx.en, marks: [], kind: 'banker', sp: 'ca', all: true, u: 99, size: 21 });
          const j = BK.checkLine(a.line, C), K = richLay(g, j.why, [], 15, 770, { weight: 600 });
          richDraw(g, K, LX, 150 + B.bh + A.bh + T.bh + 60, { color: j.ok ? COL.good : COL.trap });
        }
        acctForm(g, RX - 10, 150, 320, C, { show: k => k !== 'phone' });
        return;
      }
      const SC = BK.SCENE, LS = {}; SC.lines.forEach(([k, a]) => { LS[k] = a; });
      let B = { bh: 0 };
      fade(g, 1 - ramp(u, 23.6, 0.4), () => { B = staff(g, 'fm_addr', { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.4, size: 22, shapeAt: 1.6 }); });
      const y0 = 150 + B.bh + 16;
      // [0.4, 6] 기숙사에 살아요 → 주소가 없어요
      fade(g, win(u, 2.0, 6.0, 0.3), () => {
        const A = answer(g, { x: LX, y: y0, w: 780, A: SC.dorm[1], at: 2.2, u, size: 23, trapAt: 2.8, strikeAt: 2.9, tag: ['사실이지만 주소가 없어요', COL.trap, 3.0] });
        say2(g, BK.BAD_REACT.ad_dorm[0], y0 + A.bh + 14, 3.8, u, 'banker', 'ca', [['full address', 'key']]);
      });
      // [6, 12] 한국 주소의 차례 ×
      fade(g, win(u, 6.0, 12.0, 0.3), () => {
        const A = answer(g, { x: LX, y: y0, w: 780, A: LS.ko, at: 6.2, u, size: 21, maxW: 640, verdict: { ok: false, at: 7.0 } });
        addrOrder(g, LX, y0 + A.bh + 20, 780, { ko: ramp(u, 7.4, 0.5), en: ramp(u, 9.4, 0.6) });
      });
      // [12, 18] 번지 뒤 × · 방 번호 × · 길 빠짐 × (틀린 조각만 고쳐 줌)
      [[LS.k, 12.0, 14.0, '번지는 길 이름 앞에'], [LS.room, 14.0, 16.0, '412 → 421로 바뀌었어요'], [LS.miss, 16.0, 18.0, '번지 + 길이 빠졌어요']].forEach(([a, s, e, tg]) => {
        if (u < s - 0.2 || u > e + 0.2) return;
        fade(g, win(u, s, e, 0.3), () => {
          const A = answer(g, { x: LX, y: y0, w: 780, A: a, at: s + 0.2, u, size: 21, maxW: 640, verdict: { ok: false, at: s + 0.7 } });
          const T = say2(g, BK.fixLine(a.line, D).en, y0 + A.bh + 14, s + 0.9, u, 'banker', 'ca');
          fade(g, ramp(u, s + 0.9, 0.3), () => tag(g, tg, LX + 780, y0 + A.bh + T.bh + 40, COL.trap, { align: 'right', size: 15, h: 30 }));
        });
      });
      // [18, 24] 바른 한 줄 ✓
      fade(g, ramp(u, 18.0, 0.3) * (1 - ramp(u, 23.6, 0.4)), () => {
        const A = answer(g, { x: LX, y: y0, w: 780, A: LS.ok, at: 18.2, u, size: 21, maxW: 640, verdict: { ok: okOn('fm_addr', LS.ok), at: 19.0 } });
        const T = say2(g, BK.fixLine(LS.ok.line, D).en, y0 + A.bh + 14, 19.4, u, 'banker', 'ca');
        fade(g, ramp(u, 20.0, 0.4), () => tag(g, '방 번호 → 건물 → 번지 + 길 → 도시 + 우편번호', LX + 780, y0 + A.bh + T.bh + 40, COL.clause, { align: 'right', size: 15, h: 30 }));
        fade(g, ramp(u, 21.0, 0.4), () => {
          const t = `Room 412 → ${BK.roomWords(412)} · 40213 → ${BK.digits('40213')}`;
          txt(g, t, LX + 780, y0 + A.bh + T.bh + 84, { size: fit(g, t, 16, 780, 700), weight: 700, color: COL.soft, align: 'right' });
          say(LX + 200, y0 + A.bh + T.bh + 66, 580, 36, `Room ${BK.roomWords(412)}. ${BK.digits('40213')}.`);
        });
      });
      // [24, 29.5] 전화번호
      fade(g, win(u, 24.0, 29.5, 0.3), () => {
        const [qid, big, swap, ok] = SC.phone;
        const B2 = staff(g, qid, { x: LX, y: 150, w: 780, at: 24.2, u, roleAt: 24.8, size: 22, shapeAt: 25.0 });
        const y = 150 + B2.bh + 14;
        trapSeq(g, u, y, [[big, 25.2, 26.8, '큰 수처럼 읽었어요'], [swap, 26.8, 28.0, '끝 두 자리가 바뀌었어요']]);
        if (u >= 27.8) fade(g, ramp(u, 28.0, 0.3), () => answer(g, { x: LX, y, w: 780, A: ok, at: 28.1, u, size: 23, verdict: { ok: okOn(qid, ok), at: 28.6 } }));
      });
      // [29.5, 34] 서명
      fade(g, win(u, 29.5, 34.0, 0.3), () => exch(g, u, { q: SC.sign[0], at: 29.7, aAt: 30.8, bad: SC.sign[1], ok: SC.sign[2], mAt: 32.4, tag: 'my sign → 내 간판? 서명은 signature', tagY: 78 }));
      // [34, 39] 빠른 말
      if (u >= 33.8) fade(g, ramp(u, 34.0, 0.3), () => exch(g, u, { q: SC.afast[0], at: 34.2, aAt: 35.4, bad: SC.afast[1], ok: SC.afast[2], mAt: 37.0, tag: '빠른 말을 짐작했어요', tagY: 108 }));
      // 오른쪽: 계좌 신청서가 채워짐
      const SH = { acct: 0, a1: 19.0, a2: 19.0, a3: 19.0, phone: 28.6, sign: 99 };
      const hl = u < 6 ? null : u < 24 ? (u >= 19.0 ? 'a1' : null) : u < 29.5 ? (u >= 28.6 ? 'phone' : null) : u < 34 ? 'sign' : null;
      fade(g, ramp(u, 0.6, 0.5), () => acctForm(g, RX - 10, 150, 320, D, { show: k => u >= SH[k], hl, sign: ramp(u, 32.8, 1.2) }));
    },

    /* 08 카드 · 비밀번호 · ATM */
    card(g, u) {
      if (S.card) {
        const s = S.card, C = Object.assign({}, D, { debit: s.debit, ask: s.ask });
        let r = exch(g, 99, { q: 'cd_debit', at: -9, ok: OT(s.debit ? 'g_yesp' : 'g_no'), card: C, y: 150, qo: { all: true } });
        r = exch(g, 99, { q: 'cd_pin', at: -9, ok: s.pin === 'say' ? OT('pn_say', D.pin) : OT('pn_ok'), card: C, y: r.y + 16, qo: { all: true } });
        exch(g, 99, { q: 'cd_else', at: -9, ok: OT(s.ask ? 'el_atm' : 'el_no'), card: C, y: r.y + 16, qo: { all: true } });
        keypadFig(g, RX + 30, 150, 240, { n: s.pin === 'say' ? 0 : 4, said: s.pin === 'say' ? 1 : 0 });
        return;
      }
      const SC = BK.SCENE;
      // [0.4, 6] 직불 카드
      if (u < 6.4) fade(g, win(u, 0.4, 6.0, 0.3), () => {
        exch(g, u, { q: SC.debit[0], at: 0.8, aAt: 2.2, bad: SC.debit[1], ok: SC.debit[2], mAt: 3.8, tag: '체크카드 → check card? 영어로는 debit card', tagY: 78 });
        debitCard(g, RX, 170, RW);
        fade(g, ramp(u, 4.2, 0.4), () => tag(g, 'debit card = 체크카드', RX + RW / 2, 400, COL.clause, { align: 'center', size: 15, h: 30 }));
      });
      // [6, 17] 비밀번호: 말하기 × → 누르기 ✓
      if (u >= 5.8 && u < 17.4) fade(g, ramp(u, 6.0, 0.4) * (1 - ramp(u, 17.0, 0.4)), () => {
        const [qid, said, ok] = SC.pin;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 6.2, u, roleAt: 6.8, size: 22, shapeAt: 7.0 });
        const y = 150 + B.bh + 14;
        fade(g, win(u, 7.4, 12.0, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: said, at: 7.6, u, size: 23, trapAt: 8.2, strikeAt: 8.3, tag: ['비밀번호를 소리 내어 말했어요', COL.bad, 8.4] });
          say2(g, BK.BAD_REACT.pn_say[0], y + A.bh + 14, 9.4, u, 'banker', 'ca', [["don't say it out loud", 'key']]);
        });
        if (u >= 11.8) fade(g, ramp(u, 12.0, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: ok, at: 12.2, u, size: 23, verdict: { ok: okOn(qid, ok), at: 12.8 } });
          fade(g, ramp(u, 13.2, 0.4), () => tag(g, '누르기만 · 소리 내어 말하지 않아요', LX + 780, y + A.bh + 30, COL.clause, { align: 'right', size: 15, h: 30 }));
          if (u >= 15.6) say2(g, BK.reply(BK.Q.cd_pin, ok, D), y + A.bh + 64, 15.8, u, 'banker', 'ca');
        });
        keypadFig(g, RX + 30, 150, 240, { n: u < 13.4 ? 0 : Math.min(4, Math.floor((u - 13.4) / 0.45) + 1), said: win(u, 8.2, 11.8) });
      });
      // [17, 28] 더 도울 일: Yes × · Where is ATM? × → 질문 ✓
      if (u >= 16.8) fade(g, ramp(u, 17.0, 0.4), () => {
        const [qid, yes, where, atm] = SC.else;
        const B = staff(g, qid, { x: LX, y: 150, w: 780, at: 17.2, u, roleAt: 17.8, size: 22, shapeAt: 18.0 });
        const y = 150 + B.bh + 14;
        trapSeq(g, u, y, [[yes, 18.4, 20.4, 'Yes만 → 무엇인지 다시 물어요'], [where, 20.4, 22.4, 'Where is ATM? → 툭 던지는 말 · the도 빠졌어요']]);
        if (u >= 22.2) fade(g, ramp(u, 22.4, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: atm, at: 22.6, u, size: 23, maxW: 640, verdict: { ok: okOn(qid, atm), at: 23.4 } });
          if (u >= 24.0) say2(g, BK.reply(BK.Q.cd_else, atm, D), y + A.bh + 14, 24.2, u, 'banker', 'ca', [['right outside', 'slot'], ['on your left', 'slot']]);
        });
        atmSign(g, RX, 160, RW, { p: ramp(u, 24.6, 0.6) });
      });
    },

    /* 09 3단계 말하기 법 */
    method(g, u) {
      const BOX = [['①', '열쇠 낱말 + 모양', 'or → 고르기 · How much → 정보 · Do you · Are you · Is it → Y/N', COL.ante, 5.5], ['②', '틀에 내 정보 넣기', "Here's my passport. · So, it's 555-0147? (되짚기)", COL.rel, 11.5], ['③', '공손하게 끝내기', 'Could you …? · Would … work? · please · Sorry, …?', COL.verb, 17.5]];
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
      BK.METHOD.forEach(([qid, a], i) => {
        const y = 300 + i * 39, q = BK.Q[qid], p = BK.PLACE[q.place], dim = sel != null && sel !== i;
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
            say(594, y - 16, 606, 32, BK.text(a));
          });
        });
      });
    },

    /* 10 실전: 내 카드 하나로 넷 */
    practice(g, u) {
      const pi = u < PSEG[1] ? 0 : u < PSEG[2] ? 1 : u < PSEG[3] ? 2 : 3, v = u - PSEG[pi];
      const P = BK.PRACTICE[pi], C = BK.PCARD, q = BK.practiceQ(P);
      const a = ramp(v, 0, 0.5) * (pi < 3 ? 1 - ramp(u, PSEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `대화 ${pi + 1} / 4 · ${BK.PLACE[q.place].ko}`, LX, 150, { size: 16, weight: 500, fam: FM, color: COL.accent });
        myCard(g, LX, 168, 336, C, { rh: 30, vs: 13.5, rows: PROWS, hl: { fx_much: 0, sm_num: 1, id_proof: 2, fm_addr: 3 }[P.q] });
        talk(g, { side: 'L', x: 432, y: 172, w: 768, text: q.en, marks: Qm(q), kind: kindOf(q), sp: q.sp, at: PT.q, u: v, roleAt: PT.lines[0] + 0.4, size: q.en.length > 80 ? 19 : 22, shape: q.shape, shapeAt: PT.lines[0] + 0.4 });
        const J = P.opts.map(o => BK.judge(q, o, C));
        const goneAt = k => { const s = J[k].stage; if (!s) return null; const same = P.opts.map((_, i) => i).filter(i => J[i].stage === s); return [0, PT.s1, PT.s2, PT.s3][s] + same.indexOf(k) * 1.1; };
        const oy0 = q.en.length > 80 ? 300 : 262;
        P.opts.forEach((o, k) => {
          const y = oy0 + k * (q.en.length > 80 ? 52 : 60), gA = goneAt(k), won = k === P.a && v >= PT.win;
          fade(g, ramp(v, PT.opt[k], 0.4), () => {
            const isLine = o.f === 'line' || BK.text(o).length > 52, hh = isLine ? 54 : 48;
            if (won) { rr(g, 432, y - hh / 2, 768, hh, 10); g.fillStyle = 'rgba(127,224,168,0.08)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
            const gone = gA != null && v >= gA, rolesOn = v >= PT.lines[1] + 0.4 || won;
            txt(g, `(${'ABC'[k]})`, 446, y, { size: 18, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
            let w;
            if (isLine) { const R = wrapAns(g, o, 494, y, 17, 590, { dim: gone, plain: !rolesOn }); w = R.w; }
            else w = pieces(g, ansParts(o).map(([t, r]) => [t, gone ? 'dim' : rolesOn ? r : '']), 494, y, 19, 560, { color: gone ? COL.dim : COL.text });
            say(490, y - hh / 2, w + 10, hh, BK.text(o));
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
        ['fx', '환전 창구', 'wh', 'How much · large or small bills · that comes to', [['Three hundred thousand won', 'slot'], [', ', 'frame'], ['please', 'pol'], [". · So, that's ", 'frame'], ['$240', 'slot'], ['?', 'frame']]],
        ['shop', '휴대폰 가게', 'or', 'Prepaid or monthly? · How much data · How long', [['Prepaid', 'slot'], [', ', 'frame'], ['please', 'pol'], ['. · ', 'frame'], ['15 GB', 'slot'], [', please. · For ', 'frame'], ['six months', 'slot'], ['.', 'frame']]],
        ['sim', '유심 · 새 번호', 'note', 'Is your phone unlocked? · Your new number is …', [["Yes, it is. · So, it's ", 'frame'], ['555-0147', 'slot'], ['?', 'frame']]],
        ['teller', '은행 창구', 'wh', 'What can I do for you? · Checking or savings?', [["I'd like to open a bank account, ", 'frame'], ['please', 'pol'], ['. · ', 'frame'], ['A checking account', 'slot'], [', please.', 'frame']]],
        ['id', '서류', 'yn', 'passport · second form of ID · proof of address', [["Here's ", 'frame'], ['my passport', 'slot'], [". · No, I don't. ", 'frame'], ['Would', 'pol'], [' a letter … ', 'frame'], ['work', 'pol'], ['?', 'frame']], "Here's my passport. No, I don't. Would a letter from my university work?"],
        ['form', '주소 · 전화번호', 'wh', "What's your address · phone number", [["It's ", 'frame'], ['Room 412', 'slot'], [' … ', 'frame'], ['Kellport, 40213', 'slot'], [". · It's ", 'frame'], ['555-0147', 'slot'], ['.', 'frame']], `It's ${BK.addrEn({ room: 412, hall: 'maple' })}. It's 555-0147.`],
        ['card', '카드 · ATM', 'yn', 'debit card · enter a PIN · anything else', [['Yes, please. · Okay. · Yes. ', 'frame'], ['Could you', 'pol'], [' tell me where the nearest ATM is?', 'frame']]],
        [null, '숫자 읽기', null, '만 → thousand · 번호 → 한 자리씩', [['30만 = ', 'frame'], ['three hundred thousand', 'slot'], [' · 555-0147 = ', 'frame'], ['five-five-five, oh-one-four-seven', 'slot']], 'three hundred thousand won. five-five-five, oh-one-four-seven.'],
        [null, '못 알아들었을 때', null, '빠른 말 · 모르는 낱말', [['Sorry', 'pol'], [', could you say the number again, slowly? · ', 'frame'], ['Sorry', 'pol'], [', what does top-up mean?', 'frame']]],
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
        else txt(g, ri === 7 ? '12' : '?', X[0] + 32, y + 1, { size: ri === 7 ? 13 : 18, weight: 800, fam: ri === 7 ? FM : FB, color: COL.verb, align: 'center' });
        txt(g, nm, X[0] + 58, y, { size: fit(g, nm, 18, X[1] - X[0] - 70, 700), weight: 700 });
        if (sh) shapeMark(g, sh, X[1] + 26, y, 15, { disc: false, iw: 2.2 });
        txt(g, keys, X[1] + (sh ? 44 : 20), y, { size: fit(g, keys, 15, X[2] - X[1] - (sh ? 56 : 34), 600), weight: 600, color: COL.ante });
        const w = pieces(g, ans, X[2] + 20, y, 16.5, 1196 - X[2] - 30);
        say(X[2] + 16, y - 18, w + 8, 36, sayT || ans.map(p => p[0]).join(''));
      }));
    },
  };
  // 실전 장면의 내 카드 줄 (BK.PCARD와 같은 사실)
  const PC = BK.PCARD;
  const PROWS = [
    ['환전', `${BK.wonKo(PC.won)} → 미국 달러`],
    ['새 번호', '휴대폰 가게에서 알려 줘요 → 되짚어 확인해요'],
    ['서류', '여권 · 학생증 · 주소 증명 서류는 없어요(학교 확인서는 있어요)'],
    ['주소 (한국식)', BK.addrKo(PC.addr)],
  ];
  BKS.PROWS = PROWS;

  // 이어서 들리는 말: 위 = 쓰인 낱말 (이어지는 곳은 호), 아래 = 들리는 소리 (세게 = 크고 높게)
  function linked(g, L, x, y, u, at, maxW) {
    fade(g, ramp(u, at, 0.4), () => {
      const size = 28, gap = 22; let xx = x; const pos = [];
      L.words.forEach(w => { const ww = tw(g, w, size, 600); pos.push([xx, ww]); xx += ww + gap; });
      L.words.forEach((w, i) => { txt(g, w, pos[i][0], y, { size, weight: 600, color: COL.en }); });
      listen(x - 6, y - 24, xx - x, 48, [{ text: L.say || L.en, sp: BK.Q[L.q] ? BK.Q[L.q].sp : 'us', rate: 1.2 }]);
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
  BKS.linked = linked;

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

  BKS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[BKS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    if (ch.place != null) strip(g, ch.place, ramp(u, 0.2, 0.5));
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, BKS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + BK.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔↗↘✓✕×÷?!~=+-–—/:…‘’\'%$&<>|•';
  BKS.baseText = EXTRA;
  BKS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = BKS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { BKS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
