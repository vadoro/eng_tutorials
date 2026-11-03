/* 식당 회화 — 영상 장면
 *
 * RSS.render(g, t)는 시각 t와 사용자 상태 RSS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준, 내용은 y 580 위.
 *
 * 그림 말: 식당 평면도(일곱 곳, 01장은 크게 · 03–07장은 위쪽 작은 띠), 질문의 모양 표시(스위치 · 갈림길 · 빈 상자 · 말풍선),
 * 말풍선(직원 왼쪽 · 나 오른쪽), 대답은 틀(노랑) + 내 정보(민트) 낱말 조각으로 만들고(lay · morph), 함정은 줄을 긋고 주황 이름표로 까닭을 붙여요.
 * 메뉴판 · 계산서 · 굽기 띠 · 물잔 · 접시 · 포장 그릇 · 카드 단말기는 도형으로 그려요. 값은 모두 grammar.js(RS.bill · RS.split · RS.safe)로 계산해요.
 * 역할 색: 열쇠 낱말 하늘 · 대답 틀 노랑 · 내 정보(칸에 넣는 말) 민트 · 공손한 말 보라 · 함정 주황 · 빈칸 분홍 점선
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(RS.judge · RS.orderLine · RS.safe)으로 정합니다.
 * MP4에는 소리가 없어서, 말은 말풍선 속 낱말이 하나씩 나타나는 모습으로 그려요. 페이지에서는 말풍선을 누르면 그 사람 목소리로 들려줘요.
 */
(function () {
  'use strict';
  const RS = window.RS;
  const RSS = (window.RSS = {});
  const W = 1280, H = 720;
  RSS.W = W; RSS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  RSS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', paper: '#F4F1E8', ink: '#1E2630', navy: '#22324A', wood: '#3A2E25', red: '#B8432B', green: '#2F5D4A',
  };
  RSS.COL = COL;
  // 역할 → 색 (낱말 조각 · 말풍선 글)
  const RC = { key: COL.ante, frame: COL.rel, slot: COL.clause, pol: COL.verb, trap: COL.trap, ok: COL.good, dim: COL.dim, bad: COL.bad };
  RSS.RC = RC;
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8', me: '#F2C29A' };
  const SHC = { yn: COL.ante, or: COL.rel, wh: COL.clause, note: COL.verb };   // 모양 표시의 색
  RSS.SHC = SHC;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (RSS.S = { stop: null, shape: null, party: null, cook: null, allergy: null, call: null, bill: null, line: null, place: null });
  RSS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  RSS.hits = () => HITS;

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
     [길, 'f'(채움) | 's'(선)]. 곳 일곱 + 질문의 모양 넷(shape_yn 스위치 · shape_or 갈림길 · shape_wh 빈 상자 · shape_note 말풍선)
     ========================================================= */
  const ICON = {
    door: [['M3.5 21h17', 's'], ['M6 21V3.5h8V21', 's'], ['M11.5 12.5h.01', 's'], ['M16.5 21v-7h3.5v7M15.5 14h5.5', 's']],
    drinks: [['M7 3.5h10l-1.5 16.2a1.6 1.6 0 0 1-1.6 1.3h-3.8a1.6 1.6 0 0 1-1.6-1.3z', 's'], ['M7.6 9.5h8.8', 's'], ['M11 13.5h.01M13.2 16h.01', 's']],
    order: [['M5.5 5h13v15.5h-13z', 's'], ['M9 3v4M12 3v4M15 3v4', 's'], ['M8.5 11h7M8.5 14.5h7M8.5 18h4', 's']],
    allergy: [['M4.5 19.5C4.5 11 9 6 19.5 4.5 18 15 13 19.5 4.5 19.5z', 's'], ['M4.5 19.5 12.5 11.5', 's']],
    meal: [['M7.5 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0z', 's'], ['M3 4v4.5a1.5 1.5 0 0 0 3 0V4M4.5 9v11', 's'], ['M21 4c-1.6.8-2.3 2.8-2.3 5.5V12H21v8', 's']],
    dessert: [['M4.5 20h15v-7.5h-15z', 's'], ['M4.5 16.2h15', 's'], ['M12 12.5V9', 's'], ['M12 7.4c-.9-.8-.9-1.9 0-2.9.9 1 .9 2.1 0 2.9z', 's']],
    check: [['M3.5 7h17v11h-17z', 's'], ['M3.5 10.5h17', 's'], ['M6.5 14.5h4.5', 's']],
    shape_yn: [['M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8z', 's'], ['M14.4 12a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0z', 'f']],
    shape_or: [['M12 21.5V14', 's'], ['M12 14 6 8M12 14l6-6', 's'], ['M6 8v4.4M6 8h4.4', 's'], ['M18 8v4.4M18 8h-4.4', 's']],
    shape_wh: [['M3.5 6.5h17v11h-17z', 's'], ['M8 14h8', 's']],
    shape_note: [['M4.5 5h15v10h-8l-4 3.8V15h-3z', 's'], ['M9 10h.01M12 10h.01M15 10h.01', 's']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z', 's'], ['M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6', 's']],
    hand: [['M8.5 20.5c-2-1.6-3.5-4-3.5-6.5v-2.5a1.3 1.3 0 0 1 2.6 0V13', 's'], ['M7.6 12.5V6a1.3 1.3 0 0 1 2.6 0v5.5M10.2 11V4.5a1.3 1.3 0 0 1 2.6 0V11M12.8 11V5.5a1.3 1.3 0 0 1 2.6 0V12M15.4 12V8a1.3 1.3 0 0 1 2.6 0v6c0 3.5-2 6.5-5.5 6.5h-4', 's']],
    box: [['M4 9.5h16l-1.6 10H5.6z', 's'], ['M7.5 9.5 9.5 5h5l2 4.5', 's']],
    clock: [['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', 's'], ['M12 7.5V12l3 2', 's']],
    water: [['M12 3.5c3.2 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.3-6 5.5-10z', 's']],
    calc: [['M6 3.5h12v17H6z', 's'], ['M8.5 6.5h7v3h-7z', 's'], ['M9 13h.01M12 13h.01M15 13h.01M9 16.5h.01M12 16.5h.01M15 16.5h.01', 's']],
    people: [['M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM3.5 20a5.5 5.5 0 0 1 11 0', 's'], ['M16 11a2.6 2.6 0 1 0 0-5.2M15.5 14.2a5 5 0 0 1 5 5.3', 's']],
    sun: [['M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0z', 's'], ['M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4', 's']],
    plate: [['M6 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0z', 's'], ['M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0z', 's']],
    napkins: [['M5 5h14v14H5z', 's'], ['M5 5l14 14', 's']],
    fork: [['M9 3.5v5a3 3 0 0 0 6 0v-5M12 3.5v5M12 11.5v9', 's']],
  };
  RSS.ICON = ICON;
  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = (typeof Path2D === 'function' ? new Path2D(d) : null));
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const parts = ICON[id]; if (!parts) return;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach(([d, m]) => { const p = path(d); if (!p) return; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  RSS.icon = icon;
  // HTML용 SVG (색은 currentColor)
  RSS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;
  const NEED_ICON = { water: 'water', plate: 'plate', napkins: 'napkins', fork: 'fork' };
  RSS.NEED_ICON = NEED_ICON;

  /* ---------- 질문의 모양 표시: 그림 + 이름 (영상 · 직접 해 보기 · 힌트 · 퀴즈) ---------- */
  function shapeMark(g, shape, cx, cy, size, o = {}) {
    const c = o.color || SHC[shape];
    if (o.disc !== false) { circ(g, cx, cy, size * 0.72, o.fill || COL.panel2); ring(g, cx, cy, size * 0.72, c, o.lw || 2); }
    icon(g, 'shape_' + shape, cx, cy, size, c, o.iw || 2);
  }
  RSS.shapeMark = shapeMark;
  // 모양 이름표: 그림 + ‘고르는 질문 → 고른 것 + please’
  function shapeTag(g, shape, x, y, o = {}) {
    const Sx = RS.SHAPE[shape], t = o.text || `${Sx.ko} → ${Sx.ans}`, size = o.size || 16, h = o.h || 36, c = SHC[shape];
    const w = tw(g, t, size, 700) + h + 22, x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    rr(g, x0, y - h / 2, w, h, 10); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = c; g.lineWidth = 1.6; g.stroke();
    icon(g, 'shape_' + shape, x0 + h / 2 + 4, y, h * 0.62, c, 2);
    txt(g, t, x0 + h + 8, y + 1, { size, weight: 700, color: c });
    return { x: x0, y: y - h / 2, w, h };
  }
  RSS.shapeTag = shapeTag;
  // 끝이 올라가는(↗) · 내려가는(↘) 말: 낱말 위에 그리는 높낮이 화살표
  function pitch(g, x0, x1, y, dir, color, lw = 3) {
    const up = dir === 'up', ya = up ? y + 8 : y - 10, yb = up ? y - 12 : y + 8;
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, ya); g.quadraticCurveTo((x0 + x1) / 2, up ? ya : ya - 4, x1, yb); g.stroke();
    arrowHead(g, x1 + 2, yb + (up ? -2 : 2), up ? -0.75 : 0.75, color, 10);
  }

  /* ---------- 사람 얼굴 (말풍선 옆). kind: host(입구) · server · runner(음식 나르기) · uk(영국 식당) · me ---------- */
  const LOOK = {
    host: { shirt: '#2F3B4A', hair: '#3A2A20', skin: '#E3B48D', collar: true, badge: '#FFC15E' },
    server: { shirt: '#1F2A30', apron: '#3E5A4C', hair: '#1F1B18', skin: '#D9A57C', collar: true },
    runner: { shirt: '#E6EAEE', hair: '#2B2420', skin: '#C99169', toque: true },
    uk: { shirt: '#3A2E4A', apron: '#5A4A6A', hair: '#5A3A28', skin: '#E8BC95', bun: true },
    me: { shirt: '#5D6FA8', hair: '#1F1B18', skin: '#E8BC95', pack: '#3A2C22' },
  };
  const kindOf = q => { q = typeof q === 'string' ? RS.Q[q] : q; return q.sp === 'ca' ? 'runner' : q.sp === 'gb' ? 'uk' : q.place === 'door' ? 'host' : 'server'; };
  RSS.kindOf = kindOf;
  function avatar(g, x, y, r, kind, o = {}) {
    const L = LOOK[kind] || LOOK.server;
    circ(g, x, y, r, COL.panel2);
    g.save(); g.beginPath(); g.arc(x, y, r - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = L.shirt; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
    if (L.collar) { g.fillStyle = '#EEF1F4'; g.beginPath(); g.moveTo(x - r * 0.2, y + r * 0.42); g.lineTo(x, y + r * 0.62); g.lineTo(x + r * 0.2, y + r * 0.42); g.closePath(); g.fill(); }
    if (L.apron) { g.fillStyle = L.apron; rr(g, x - r * 0.34, y + r * 0.55, r * 0.68, r * 0.7, r * 0.08); g.fill(); }
    if (L.badge) { g.fillStyle = L.badge; g.fillRect(x + r * 0.22, y + r * 0.6, r * 0.2, r * 0.1); }
    if (L.pack) { g.strokeStyle = L.pack; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - r * 0.42, y + r * 0.45); g.lineTo(x - r * 0.5, y + r); g.moveTo(x + r * 0.42, y + r * 0.45); g.lineTo(x + r * 0.5, y + r); g.stroke(); }
    if (kind === 'runner') { g.fillStyle = '#B9C2CB'; [0.62, 0.82].forEach(k => circ(g, x, y + r * k, r * 0.04, '#9AA6AA')); }
    g.fillStyle = L.skin; g.fillRect(x - r * 0.1, y + r * 0.18, r * 0.2, r * 0.22);
    circ(g, x, y - r * 0.08, r * 0.34, L.skin);
    g.fillStyle = L.hair; g.beginPath(); g.arc(x, y - r * 0.12, r * 0.36, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
    if (L.bun) circ(g, x, y - r * 0.5, r * 0.13, L.hair);
    if (L.toque) { g.fillStyle = '#F4F6F8'; rr(g, x - r * 0.3, y - r * 0.62, r * 0.6, r * 0.26, r * 0.05); g.fill(); circ(g, x - r * 0.14, y - r * 0.64, r * 0.16, '#F4F6F8'); circ(g, x + r * 0.14, y - r * 0.64, r * 0.16, '#F4F6F8'); }
    circ(g, x - r * 0.12, y - r * 0.04, r * 0.035, '#2B2420'); circ(g, x + r * 0.12, y - r * 0.04, r * 0.035, '#2B2420');
    g.strokeStyle = 'rgba(120,60,40,0.6)'; g.lineWidth = Math.max(1, r * 0.045); g.beginPath(); g.arc(x, y + r * 0.06, r * 0.1, 0.35, Math.PI - 0.35); g.stroke();
    g.restore();
    ring(g, x, y, r, o.live ? (SPC[o.sp] || COL.soft) : COL.faint, o.live ? 2.6 : 1.5);
    if (o.live) { g.save(); g.globalAlpha *= 0.45; ring(g, x, y, r + 5, SPC[o.sp] || COL.soft, 2); g.restore(); }
  }
  RSS.avatar = avatar;

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
  RSS.richLay = richLay; RSS.richDraw = richDraw;

  /* ---------- 낱말 조각 (대답 만들기): { id, t, r } → lay · morph · drawTok ---------- */
  const PUNCT = /^[.,?!]$/;
  function ansToks(a, o = {}) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    RS.segs(a).forEach(s => s.t.split(/\s+/).forEach(w => {
      if (!w) return;
      const m = w.match(/^(.*?)([.,?!]*)$/);
      if (m[1]) push(m[1], o.role != null ? o.role : s.r);
      if (m[2]) m[2].split('').forEach(p => push(p, ''));
    }));
    return out;
  }
  RSS.ansToks = ansToks;
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
   * o: { side, x, y, w(칸 폭), text, marks, kind, sp, at, u, size, roleAt, fast, slow, all, strike, verdict: { ok, at } }
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
      avatar(g, ax, ay, ar, o.kind || (side === 'L' ? 'server' : 'me'), { live, sp: o.sp });
      bubbleShape(g, side, bx, by, bw, bh, ax, ay, FILL[side], o.edge || EDGE[side]);
      const shown = o.all ? null : (u - at) / per;
      g.save(); g.translate(bx + 17, by + 10 + R.lh / 2); g.scale(sq, 1);
      richDraw(g, R, 0, 0, { shown, rolesOn: o.roleAt == null || u >= o.roleAt, color: o.color });
      g.restore();
      if (o.fast && live) { g.strokeStyle = 'rgba(238,241,244,0.35)'; g.lineWidth = 2; g.lineCap = 'round'; [0, 1, 2].forEach(k => { const yy = by + 12 + k * (bh - 24) / 2, ph = ((u * 3 + k * 0.33) % 1); g.beginPath(); g.moveTo(bx + bw + 8 + ph * 18, yy); g.lineTo(bx + bw + 28 + ph * 18, yy); g.stroke(); }); }
      if (o.strike != null && u >= o.strike) { const p = clamp((u - o.strike) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.8; g.beginPath(); g.moveTo(bx + 12, by + bh / 2 + 1); g.lineTo(bx + 12 + (bw - 24) * p, by + bh / 2 + 1); g.stroke(); }
      if (o.verdict && u >= o.verdict.at) fade(g, ramp(u, o.verdict.at, 0.3), () => mark(g, o.verdict.ok, side === 'L' ? bx + bw + 22 : bx - 22, by + bh / 2, 17));
      if (o.shape && u >= (o.shapeAt == null ? at : o.shapeAt)) fade(g, ramp(u, o.shapeAt == null ? at : o.shapeAt, 0.4), () => shapeMark(g, o.shape, bx + bw + 30, by + Math.min(bh / 2, 26), 22, {}));
    });
    if (!o.noHit) listen(bx, by, bw, bh, [{ text: o.text, sp: o.sp || 'us', rate: o.fast ? 1.35 : o.slow ? 0.75 : 1 }]);
    return out;
  }
  RSS.talk = talk;
  // 서버의 말 (질문 id로): 말풍선 + 열쇠 낱말 (+ 모양 표시)
  const Qobj = q => typeof q === 'string' ? RS.Q[q] : q;
  const Qm = q => Qobj(q).key.map(k => [k, 'key']);
  const staff = (g, q, o) => { q = Qobj(q); return talk(g, Object.assign({ side: 'L', text: q.en, marks: q.fast ? [] : Qm(q), kind: kindOf(q), sp: q.sp, fast: !!q.fast }, o)); };
  /* 나의 대답 (낱말 조각 말풍선, 두 대답 사이를 morph). maxW를 주면 여러 줄
   * o: { x, y, w, A, B, p, at, u, size, strikeAt, verdict, tag: [글, 색, at, 사라짐], trapAt, toksA, tagX, tagY, maxW }
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
      if (o.strikeAt != null && u >= o.strikeAt && p < 0.01) { const q = clamp((u - o.strikeAt) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.8; g.beginPath(); g.moveTo(bx + 12, by + bh / 2 + 1); g.lineTo(bx + 12 + (bw - 24) * q, by + bh / 2 + 1); g.stroke(); }
      if (o.verdict && u >= o.verdict.at) fade(g, ramp(u, o.verdict.at, 0.3), () => mark(g, o.verdict.ok, bx - 22, by + bh / 2, 17));
      if (o.tag && u >= o.tag[2]) fade(g, ramp(u, o.tag[2], 0.35) * (o.tag[3] != null ? 1 - ramp(u, o.tag[3], 0.3) : 1), () => tag(g, o.tag[0], o.tagX != null ? o.tagX : o.tagY != null ? bx + bw : bx - 48, o.tagY != null ? o.tagY : by + bh / 2, o.tag[1] || COL.trap, { align: o.tagX != null ? 'left' : 'right', size: 15, h: 32 }));
    });
    const said = LB && p > 0.5 ? (o.sayB || (o.B ? RS.text(o.B) : null)) : (o.sayA || (o.A ? RS.text(o.A) : null));
    if (!o.noHit && said) listen(bx, by, bw, bh, [{ text: said, sp: 'me' }]);
    return out;
  }
  RSS.answer = answer;
  const okOf = (q, a, c) => RS.judge(q, a, c || RS.DEMO).ok;

  /* ---------- 식당 길 띠 (03–07장 위쪽) ---------- */
  function strip(g, cur, a = 1) {
    fade(g, a, () => {
      const x0 = 812, dx = 64, y = 92;
      g.strokeStyle = COL.faint; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 6, y); g.stroke();
      RS.PLACES.forEach((p, i) => {
        const x = x0 + i * dx, on = i === cur;
        circ(g, x, y, on ? 19 : 14, on ? COL.accent : i < cur ? '#2A3542' : COL.panel);
        ring(g, x, y, on ? 19 : 14, on ? COL.accent : RS.ME_FIRST[p.id] ? 'rgba(201,167,255,0.6)' : COL.faint, 1.5);
        icon(g, p.id, x, y, on ? 22 : 16, on ? '#1D1305' : i < cur ? COL.soft : COL.muted, on ? 2 : 1.8);
      });
      txt(g, `${cur + 1} / 7`, x0 + dx * 6 + 30, y, { size: 13, weight: 500, fam: FM, color: COL.muted });
    });
  }

  /* =========================================================
     식당 그림: 메뉴판 · 계산서 · 굽기 띠 · 식사 카드 · 물잔 · 접시 · 포장 그릇 · 카드 단말기
     ========================================================= */
  const badge = (g, x, y, k, on) => { const A = RS.ALLERGENS[k]; circ(g, x, y, 9, on ? '#B8432B' : '#D9CFB8'); txt(g, A.badge, x, y + 0.5, { size: 11, weight: 700, fam: FM, color: on ? '#FFFFFF' : '#5B4A30', align: 'center' }); };
  // 메뉴판 (x, y 왼쪽 위, 폭 w). o: { hl: { 음식 id: 색 }, special: 이름을 보임, bad: 알레르기 → 그 성분 표시를 빨갛게 } → { boxes, h }
  function menuDraw(g, x, y, w, o = {}) {
    const s = w / 400, boxes = {}, hl = o.hl || {}, BH = 432;
    g.save(); g.translate(x, y); g.scale(s, s);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 16; g.shadowOffsetY = 6; rr(g, 0, 0, 400, BH, 12); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, 0, 0, 400, BH, 12); g.clip(); g.fillStyle = COL.green; g.fillRect(0, 0, 400, 42); g.restore();
    txt(g, RS.REST.toUpperCase(), 20, 22, { size: 16, weight: 700, fam: FM, color: '#F2E6C9' });
    txt(g, 'MENU', 380, 22, { size: 12, weight: 700, fam: FM, color: '#CFE3D6', align: 'right' });
    const row = (id, yy, label) => {
      const m = RS.MENU[id], c = hl[id];
      if (c) { rr(g, 10, yy - 14, 380, 28, 6); g.fillStyle = c + '33'; g.fill(); g.strokeStyle = c; g.lineWidth = 2.5; g.stroke(); }
      txt(g, label || m.en, 22, yy, { size: 15, weight: 700, color: COL.ink });
      const al = Object.keys(m.has); al.forEach((k, i) => badge(g, 22 + tw(g, label || m.en, 15, 700) + 16 + i * 22, yy, k, o.bad === k));
      if (m.p) txt(g, (m.p / 100).toFixed(2), 378, yy, { size: 15, weight: 600, fam: FM, color: COL.ink, align: 'right' });
      boxes[id] = { x: x + 10 * s, y: y + (yy - 14) * s, w: 380 * s, h: 28 * s };
    };
    txt(g, 'MAINS', 22, 62, { size: 11, weight: 700, fam: FM, color: '#7A6A50' });
    RS.MAINS.forEach((id, i) => row(id, 86 + i * 30));
    txt(g, '* steak · salmon · pasta → with soup or salad', 22, 236, { size: 11.5, weight: 600, fam: FM, color: '#5B6168' });
    g.fillStyle = 'rgba(30,38,48,0.18)'; g.fillRect(16, 250, 368, 1.5);
    txt(g, 'STARTERS', 22, 266, { size: 11, weight: 700, fam: FM, color: '#7A6A50' });
    [['soup', 22], ['salad', 210]].forEach(([id, xx]) => {
      const m = RS.MENU[id], c = hl[id];
      if (c) { rr(g, xx - 8, 276, 180, 26, 6); g.fillStyle = c + '33'; g.fill(); g.strokeStyle = c; g.lineWidth = 2.5; g.stroke(); }
      txt(g, m.en, xx, 289, { size: 14, weight: 700, color: COL.ink }); Object.keys(m.has).forEach((k, i) => badge(g, xx + tw(g, m.en, 14, 700) + 14 + i * 20, 289, k, o.bad === k));
      boxes[id] = { x: x + (xx - 8) * s, y: y + 276 * s, w: 180 * s, h: 26 * s };
    });
    txt(g, 'Dressings: ranch', 22, 316, { size: 12.5, weight: 600, color: '#3A4250' }); badge(g, 22 + tw(g, 'Dressings: ranch', 12.5, 600) + 13, 316, 'milk', o.bad === 'milk');
    txt(g, '· Italian · balsamic', 22 + tw(g, 'Dressings: ranch', 12.5, 600) + 28, 316, { size: 12.5, weight: 600, color: '#3A4250' });
    g.fillStyle = 'rgba(30,38,48,0.18)'; g.fillRect(16, 330, 368, 1.5);
    txt(g, 'DRINKS', 22, 346, { size: 11, weight: 700, fam: FM, color: '#7A6A50' });
    txt(g, `Still water free · Sparkling ${(RS.MENU.sparkling.p / 100).toFixed(2)} · Lemonade ${(RS.MENU.lemonade.p / 100).toFixed(2)}`, 22, 366, { size: 12, weight: 600, fam: FM, color: COL.ink });
    txt(g, `Lemon-lime soda ${(RS.MENU.soda.p / 100).toFixed(2)} · Iced tea ${(RS.MENU.icedtea.p / 100).toFixed(2)}`, 22, 384, { size: 12, weight: 600, fam: FM, color: COL.ink });
    txt(g, 'DESSERTS', 22, 404, { size: 11, weight: 700, fam: FM, color: '#7A6A50' });
    txt(g, `Chocolate cake ${(RS.MENU.cake.p / 100).toFixed(2)}`, 104, 404, { size: 12, weight: 600, fam: FM, color: COL.ink }); badge(g, 104 + tw(g, `Chocolate cake ${(RS.MENU.cake.p / 100).toFixed(2)}`, 12, 600, FM) + 12, 404, 'milk', o.bad === 'milk');
    txt(g, `· Sorbet ${(RS.MENU.sorbet.p / 100).toFixed(2)}`, 104 + tw(g, `Chocolate cake ${(RS.MENU.cake.p / 100).toFixed(2)}`, 12, 600, FM) + 26, 404, { size: 12, weight: 600, fam: FM, color: COL.ink });
    txt(g, 'P peanuts · S shrimp · M milk · N nuts', 22, 422, { size: 10.5, weight: 600, fam: FM, color: '#7A6A50' });
    g.restore();
    return { boxes, h: BH * s };
  }
  RSS.menuDraw = menuDraw;

  // 계산서 (x, y 왼쪽 위, 폭 w). card → RS.bill · RS.split. o: { shown: 보이는 줄 수, hl: { 줄 번호 | total | each: 색 } } → { h, total, each, boxes }
  function checkDraw(g, x, y, w, card, o = {}) {
    const B = RS.bill(card), n = B.items.length, sp = card.party > 1 && card.pay === 'separate', SPL = RS.split(B, card.party);
    const h = 104 + n * 28 + 48 + (sp ? 36 : 0), boxes = {}, shown = o.shown == null ? 99 : o.shown, hl = o.hl || {};
    g.save();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h);
    const zz = 14; for (let k = 0; k <= Math.round(w / zz); k++) g.lineTo(x + w - k * zz, y + h + (k % 2 ? 7 : 0));
    g.lineTo(x, y + h); g.closePath(); g.fillStyle = COL.paper; g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 16; g.shadowOffsetY = 6; g.fill(); g.restore();
    txt(g, RS.REST.toUpperCase(), x + w / 2, y + 24, { size: fit(g, RS.REST.toUpperCase(), 17, w - 30, 700, 10, FM), weight: 700, fam: FM, color: COL.ink, align: 'center' });
    const gl = `CHECK · TABLE 12 · GUESTS ${card.party}`;
    txt(g, gl, x + w / 2, y + 46, { size: fit(g, gl, 12, w - 30, 600, 9, FM), weight: 600, fam: FM, color: '#5B6168', align: 'center' });
    g.setLineDash([4, 4]); g.strokeStyle = 'rgba(30,38,48,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 16, y + 62); g.lineTo(x + w - 16, y + 62); g.stroke(); g.setLineDash([]);
    B.items.forEach((it, k) => fade(g, clamp(shown - k), () => {
      const yy = y + 84 + k * 28, c = hl[k];
      if (c) { rr(g, x + 10, yy - 13, w - 20, 26, 6); g.fillStyle = c + '30'; g.fill(); g.strokeStyle = c; g.lineWidth = 2.5; g.stroke(); }
      txt(g, it.en, x + 18, yy, { size: fit(g, it.en, 14, w - 120, 600, 9, FM), weight: 600, fam: FM, color: it.wrong ? COL.red : COL.ink });
      txt(g, RS.money(it.c), x + w - 18, yy, { size: 14, weight: 600, fam: FM, color: COL.ink, align: 'right' });
      boxes[k] = { x: x + 10, y: yy - 13, w: w - 20, h: 26 };
    }));
    fade(g, clamp(shown - n), () => {
      const yy = y + 84 + n * 28;
      g.fillStyle = 'rgba(30,38,48,0.5)'; g.fillRect(x + 16, yy - 6, w - 32, 1.5);
      if (hl.total) { rr(g, x + 10, yy + 2, w - 20, 30, 6); g.fillStyle = hl.total + '30'; g.fill(); g.strokeStyle = hl.total; g.lineWidth = 2.5; g.stroke(); }
      txt(g, 'TOTAL', x + 18, yy + 17, { size: 17, weight: 700, fam: FM, color: COL.ink });
      txt(g, RS.money(B.total), x + w - 18, yy + 17, { size: 19, weight: 700, fam: FM, color: sp ? COL.ink : COL.red, align: 'right' });
      boxes.total = { x: x + 10, y: yy + 2, w: w - 20, h: 30 };
      if (sp) {
        const y2 = yy + 50;
        if (hl.each) { rr(g, x + 10, y2 - 15, w - 20, 30, 6); g.fillStyle = hl.each + '30'; g.fill(); g.strokeStyle = hl.each; g.lineWidth = 2.5; g.stroke(); }
        txt(g, `SPLIT ${card.party} WAYS · EACH`, x + 18, y2, { size: fit(g, `SPLIT ${card.party} WAYS · EACH`, 14, w - 130, 700, 9, FM), weight: 700, fam: FM, color: COL.ink });
        txt(g, RS.money(SPL.each), x + w - 18, y2, { size: 19, weight: 700, fam: FM, color: COL.red, align: 'right' });
        boxes.each = { x: x + 10, y: y2 - 15, w: w - 20, h: 30 };
      }
    });
    return { h: h + 7, total: B.total, each: SPL.each, boxes };
  }
  RSS.checkDraw = checkDraw;

  // 스테이크 굽기 띠 (x, y 왼쪽 위, 폭 w). o: { hl: 칸 번호 → 색, card: 칸 번호, labels } → 칸 위치 [{ x, y, w, h }]
  const DONE = ['rare', 'mediumrare', 'medium', 'mediumwell', 'welldone'];
  const DONE_C = [['#B8323A', '#D96A6F'], ['#C2474C', '#E39A8E'], ['#B9645A', '#E6B7A5'], ['#8F6A55', '#C9AE98'], ['#6B4E3D', '#8E7462']];
  function doneStrip(g, x, y, w, o = {}) {
    const cw = (w - 4 * 10) / 5, h = o.h || 74, boxes = [];
    DONE.forEach((id, i) => {
      const xx = x + i * (cw + 10), [crust, inner] = DONE_C[i], c = o.hl && o.hl[i];
      rr(g, xx, y, cw, h, 12); g.fillStyle = '#4A3428'; g.fill();
      rr(g, xx + 8, y + 10, cw - 16, h - 20, 9); g.fillStyle = crust; g.fill();
      rr(g, xx + 16, y + 18, cw - 32, h - 36, 6); g.fillStyle = inner; g.fill();
      if (c) { rr(g, xx - 4, y - 4, cw + 8, h + 8, 14); g.strokeStyle = c; g.lineWidth = 3.5; g.stroke(); }
      const lb = RS.SLOT.cook.vals[id].low;
      txt(g, lb, xx + cw / 2, y + h + 20, { size: fit(g, lb, o.size || 16, cw, 700), weight: 700, color: c || COL.en, align: 'center' });
      if (!o.noKo) txt(g, RS.SLOT.cook.vals[id].ko, xx + cw / 2, y + h + 42, { size: 13, weight: 600, color: COL.muted, align: 'center' });
      boxes.push({ x: xx, y, w: cw, h: h + 50 });
      if (!o.noHit) say(xx, y, cw, h + 30, `${RS.SLOT.cook.vals[id].t}, please.`);
    });
    return boxes;
  }
  RSS.doneStrip = doneStrip;

  // 식사 카드 (시뮬레이터와 같은 칸). o: { skip: [줄 번호], hl: 줄 번호, rh }
  function dineCard(g, x, y, w, card, o = {}) {
    const all = RS.cardRows(card), rows = all.map((r, i) => [r, i]).filter(([, i]) => !o.skip || !o.skip.includes(i)), rh = o.rh || 34, h = 56 + rows.length * rh + 10;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 14); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 14); g.clip(); g.fillStyle = COL.green; g.fillRect(x, y, w, 44); g.restore();
    icon(g, 'meal', x + 24, y + 22, 22, '#FFFFFF');
    txt(g, o.title || '식사 카드 · DINING CARD', x + 44, y + 23, { size: 16, weight: 700, color: '#FFFFFF' });
    rows.forEach(([[k, v], i], j) => {
      const yy = y + 56 + j * rh + rh / 2, hl = o.hl === i;
      if (hl) { rr(g, x + 8, yy - rh / 2 + 3, w - 16, rh - 6, 8); g.fillStyle = 'rgba(31,122,85,0.16)'; g.fill(); g.strokeStyle = '#1F7A55'; g.lineWidth = 2.5; g.stroke(); }
      txt(g, k, x + 16, yy, { size: fit(g, k, 13.5, 88, 600), weight: 600, color: '#5B6168' });
      txt(g, v, x + 106, yy, { size: fit(g, v, 15, w - 118, 700, 10), weight: 700, color: hl ? '#14623F' : COL.ink });
    });
    return { h };
  }
  RSS.dineCard = dineCard;

  // 물잔 (밑 가운데 cx, by). kind: still · sparkling · soda · cider
  function glass(g, cx, by, s, kind, u = 0) {
    g.save(); g.translate(cx, by); g.scale(s, s);
    const fill = { still: 'rgba(170,215,255,0.35)', sparkling: 'rgba(170,215,255,0.45)', soda: 'rgba(196,232,150,0.55)', cider: 'rgba(222,170,80,0.7)' }[kind] || 'rgba(170,215,255,0.35)';
    g.beginPath(); g.moveTo(-34, -120); g.lineTo(34, -120); g.lineTo(26, 0); g.lineTo(-26, 0); g.closePath();
    g.fillStyle = 'rgba(238,241,244,0.06)'; g.fill();
    g.save(); g.clip(); g.fillStyle = fill; g.fillRect(-40, -92, 80, 96); g.restore();
    g.strokeStyle = 'rgba(238,241,244,0.75)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-34, -120); g.lineTo(-26, 0); g.lineTo(26, 0); g.lineTo(34, -120); g.stroke();
    if (kind === 'sparkling' || kind === 'soda') for (let k = 0; k < 9; k++) { const bx = -18 + (k * 37 % 36), ph = (u * 0.6 + k * 0.137) % 1, byy = -6 - ph * 80; ring(g, bx, byy, 2.4 + (k % 3) * 0.8, 'rgba(255,255,255,0.8)', 1.4); }
    if (kind === 'soda') { circ(g, 22, -112, 13, '#E8E36A'); ring(g, 22, -112, 13, '#B8B33A', 2); g.strokeStyle = '#B8B33A'; g.lineWidth = 1.5; [0, 1, 2].forEach(k => { const a = k * 2.1; g.beginPath(); g.moveTo(22, -112); g.lineTo(22 + Math.cos(a) * 11, -112 + Math.sin(a) * 11); g.stroke(); }); }
    g.restore();
  }
  // 사과 (cider 그림)
  function apple(g, cx, cy, r) { circ(g, cx - r * 0.35, cy, r * 0.8, '#C2473A'); circ(g, cx + r * 0.35, cy, r * 0.8, '#C2473A'); g.strokeStyle = '#6B4E3D'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy - r * 0.6); g.lineTo(cx + 3, cy - r * 1.1); g.stroke(); g.fillStyle = '#5E9E5A'; g.beginPath(); g.ellipse(cx + r * 0.35, cy - r * 1.0, r * 0.35, r * 0.16, -0.5, 0, Math.PI * 2); g.fill(); }
  // 접시 위 음식 (가운데 cx, cy, 반지름 r)
  function plateDraw(g, cx, cy, r, dish) {
    circ(g, cx, cy, r, '#E9EDF1'); ring(g, cx, cy, r, '#B9C2CB', 2); ring(g, cx, cy, r * 0.78, 'rgba(150,160,170,0.4)', 1.5);
    const k = r / 80;
    if (dish === 'steak') { g.fillStyle = '#7A4A32'; g.beginPath(); g.ellipse(cx - 6 * k, cy, 46 * k, 30 * k, -0.2, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#4A2A1A'; g.lineWidth = 4 * k; [-20, 0, 20].forEach(d => { g.beginPath(); g.moveTo(cx + d * k - 22 * k, cy - 18 * k); g.lineTo(cx + d * k + 6 * k, cy + 18 * k); g.stroke(); }); circ(g, cx + 44 * k, cy + 24 * k, 12 * k, '#6DAA5A'); }
    else if (dish === 'salmon') { g.fillStyle = '#F08A5D'; rr(g, cx - 44 * k, cy - 22 * k, 88 * k, 44 * k, 16 * k); g.fill(); g.strokeStyle = '#FBD3BE'; g.lineWidth = 3 * k; [-24, -6, 12, 30].forEach(d => { g.beginPath(); g.moveTo(cx + d * k, cy - 20 * k); g.quadraticCurveTo(cx + d * k + 8 * k, cy, cx + d * k, cy + 20 * k); g.stroke(); }); circ(g, cx + 40 * k, cy - 30 * k, 8 * k, '#F4E36A'); }
    else if (dish === 'noodles') { g.strokeStyle = '#E8C36A'; g.lineWidth = 5 * k; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(cx + (i - 2.5) * 10 * k, cy, (30 - i * 2) * k, 0.3 + i, 2.8 + i); g.stroke(); } circ(g, cx + 26 * k, cy - 22 * k, 7 * k, '#F2A0A0'); circ(g, cx - 28 * k, cy + 18 * k, 7 * k, '#F2A0A0'); }
    else if (dish === 'pasta') { g.fillStyle = '#F2E2C0'; g.beginPath(); g.ellipse(cx, cy, 44 * k, 32 * k, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#E8C36A'; g.lineWidth = 4 * k; [12, 22, 32].forEach(rd => { g.beginPath(); g.arc(cx, cy, rd * k, 0.5, 5.2); g.stroke(); }); circ(g, cx + 20 * k, cy - 14 * k, 8 * k, '#F2A0A0'); }
    else if (dish === 'burger') { g.fillStyle = '#D9A050'; g.beginPath(); g.ellipse(cx, cy - 10 * k, 40 * k, 22 * k, 0, Math.PI, 0); g.fill(); g.fillStyle = '#6DAA5A'; g.fillRect(cx - 42 * k, cy - 10 * k, 84 * k, 7 * k); g.fillStyle = '#7A4A32'; g.fillRect(cx - 40 * k, cy - 3 * k, 80 * k, 12 * k); g.fillStyle = '#D9A050'; rr(g, cx - 40 * k, cy + 9 * k, 80 * k, 14 * k, 6 * k); g.fill(); }
    else if (dish === 'risotto') { g.fillStyle = '#EFE2C4'; g.beginPath(); g.ellipse(cx, cy, 44 * k, 32 * k, 0, 0, Math.PI * 2); g.fill(); for (let i = 0; i < 9; i++) circ(g, cx + ((i * 23) % 60 - 30) * k, cy + ((i * 17) % 40 - 20) * k, 5 * k, '#9A7A5A'); }
  }
  RSS.plateDraw = plateDraw;
  // 포장 그릇
  function boxDraw(g, cx, by, s) {
    g.save(); g.translate(cx, by); g.scale(s, s);
    g.beginPath(); g.moveTo(-60, -70); g.lineTo(60, -70); g.lineTo(48, 0); g.lineTo(-48, 0); g.closePath(); g.fillStyle = '#E8E1D2'; g.fill(); g.strokeStyle = '#B9AE98'; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.moveTo(-60, -70); g.lineTo(-40, -100); g.lineTo(40, -100); g.lineTo(60, -70); g.closePath(); g.fillStyle = '#F4EFE4'; g.fill(); g.stroke();
    g.strokeStyle = '#B9AE98'; g.lineWidth = 3; g.beginPath(); g.arc(0, -100, 22, Math.PI, 0); g.stroke();
    g.restore();
  }
  // 카드 단말기 (팁 화면은 ‘나라마다 달라요’만)
  function reader(g, x, y, o = {}) {
    rr(g, x, y, 170, 260, 22); g.fillStyle = '#262C33'; g.fill(); g.strokeStyle = '#3A434D'; g.lineWidth = 2; g.stroke();
    rr(g, x + 16, y + 18, 138, 112, 10); g.fillStyle = o.state === 'ok' ? '#DFF3E6' : '#E8EEF2'; g.fill();
    if (o.state === 'tip') {
      txt(g, 'Add a tip?', x + 85, y + 38, { size: 15, weight: 700, color: COL.ink, align: 'center' });
      [0, 1, 2].forEach(k => { rr(g, x + 26 + k * 42, y + 56, 34, 26, 6); g.fillStyle = '#C9D3DB'; g.fill(); });
      rr(g, x + 26, y + 90, 118, 26, 6); g.fillStyle = '#C9D3DB'; g.fill();
      txt(g, 'No tip', x + 85, y + 103, { size: 13, weight: 600, color: COL.ink, align: 'center' });
    } else {
      txt(g, o.amount || '', x + 85, y + 48, { size: 24, weight: 700, fam: FM, color: COL.ink, align: 'center' });
      txt(g, o.state === 'ok' ? 'APPROVED' : 'TAP CARD', x + 85, y + 82, { size: 14, weight: 700, fam: FM, color: o.state === 'ok' ? '#1F7A55' : '#5B6168', align: 'center' });
      if (o.state !== 'ok') { g.strokeStyle = '#5B6168'; g.lineWidth = 2; g.lineCap = 'round'; [8, 14, 20].forEach(r => { g.beginPath(); g.arc(x + 85, y + 110, r, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); }); }
      else check(g, x + 85, y + 108, 18, '#1F7A55');
    }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { rr(g, x + 30 + c * 40, y + 148 + r * 32, 30, 22, 5); g.fillStyle = '#3A434D'; g.fill(); }
  }
  // 계산서 폴더 (테이블 위)
  function folder(g, cx, cy, s) { g.save(); g.translate(cx, cy); g.scale(s, s); g.rotate(-0.08); rr(g, -60, -80, 120, 160, 8); g.fillStyle = '#2B2F36'; g.fill(); g.strokeStyle = '#C9A24A'; g.lineWidth = 2; g.stroke(); txt(g, 'CHECK', 0, -50, { size: 15, weight: 700, fam: FM, color: '#C9A24A', align: 'center' }); rr(g, -40, -24, 80, 90, 4); g.fillStyle = COL.paper; g.fill(); g.fillStyle = 'rgba(30,38,48,0.3)'; [0, 1, 2, 3].forEach(k => g.fillRect(-30, -10 + k * 16, k === 3 ? 30 : 60, 3)); g.restore(); }

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(곱하기 표)는 자막에 쓰지 않음
     ========================================================= */
  const EACH_D = RS.money(RS.split(RS.bill(RS.DEMO), RS.DEMO.party).each), EACH_P = RS.money(RS.split(RS.bill(RS.PCARD), RS.PCARD.party).each);
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '식당 회화 · 질문의 모양이 대답을 정한다', d: 26, caps: [
      [0.4, 5.5, '식당에서는 서버가 짧은 질문을 아주 많이 해요. 물, 음료, 주문, 굽기, 곁들임까지요.'],
      [5.5, 10.5, '자리에 앉자 서버가 물어요 → Still or sparkling? 그냥 물인지, 탄산수인지요.'],
      [10.5, 16, '여기에 그냥 Yes. → 서버가 다시 물어요. 둘 가운데 하나를 고르라는 질문이었거든요.'],
      [16, 21, '고른 것 + please → Sparkling, please. **질문의 모양이 대답의 모양을 정해요.**'],
      [21, 26, 'Yes/No 질문, 고르는 질문, 정보 질문. 모양을 잡고, 틀에 내 정보를 넣고, 공손하게 끝내요.'],
    ] },
    { id: 'route', n: '01', title: '식당 길 지도', sub: '식사하는 차례대로 일곱 곳 · 곳마다 한두 마디', d: 30, caps: [
      [0.4, 6, '식당에서 보내는 시간을 일곱 곳으로 나눠 봐요. 입구에서 자리를 안내받고, 자리에 앉아 음료를 골라요.'],
      [6, 12, '주문하고, 알레르기와 부탁을 말해요. 음식이 나오면 식사 중에도 서버와 몇 마디 나눠요.'],
      [12, 18, '디저트를 고르거나 남은 음식을 싸 달라고 하고, 마지막으로 계산해요.'],
      [18, 24, '입구에서 기다리면 자리를 안내해 줘요. 자리에 앉으면 서버가 테이블로 와요. 계산도 테이블에서 할 때가 많아요.'],
      [24, 30, '이런 차례는 식당과 나라마다 달라요. 계산대에서 내는 곳도, 직접 자리를 고르는 곳도 있어요.'],
    ] },
    { id: 'shapes', n: '02', title: '질문의 모양 세 가지', sub: 'Yes/No 질문 · 고르는 질문 · 정보 질문', d: 36, caps: [
      [0.4, 6, '서버의 질문은 모양이 세 가지예요. 첫째 → **Yes/No 질문**. Are you ready to order? Do you have a reservation?'],
      [6, 12, '대답 → Yes · No + 한 마디. 권하는 말이면 원하는 것을 바로 말해도 돼요 → Just water, please.'],
      [12, 18, '둘째 → **고르는 질문**. Inside or outside? Soup or salad? 대답 → 고른 것 + please → Salad, please.'],
      [18, 24, '고르는 질문에 Yes, please. → 무엇을 골랐는지 알 수 없어요. 고르라고 할 때는 끝을 내려 말해요.'],
      [24, 30, '끝을 올려 말하면 같은 낱말이 Yes/No 질문이 되기도 해요. 서버가 고르라고 할 때는 보통 끝을 내려요.'],
      [30, 36, '셋째 → **정보 질문**. How many? How would you like your steak? 대답 → 정보 + please → Medium, please.'],
    ] },
    { id: 'door', n: '03', title: '입구와 자리', sub: 'Host stand · reservation · How many · wait · inside or outside', d: 32, place: 0, caps: [
      [0.4, 6, 'Do you have a reservation? → Yes/No 질문. 예약했으면 → Yes, under Park. 이름까지 말하면 다시 묻지 않아요.'],
      [6, 11.5, '예약이 없으면 → No, we don\'t. How many? → 정보 질문. 수 + please → Two, please.'],
      [11.5, 17, 'We are two. → ‘우리는 둘이에요’를 옮긴 말이에요. 알아듣지만 보통 → A table for two, please.'],
      [17, 22.5, 'It\'ll be about a fifteen-minute wait. 15와 50 → fifteen → 뒤를 세게, fifty → 앞을 세게 말해요.'],
      [22.5, 27.5, '헷갈리면 되물어요 → Sorry, did you say fifteen minutes? 괜찮으면 → That\'s fine. We\'ll wait.'],
      [27.5, 32, 'Inside or outside? → 고르는 질문. Yes, please. → 고른 것이 없어요. → Outside, please.'],
    ] },
    { id: 'drinks', n: '04', title: '음료와 주문', sub: 'Drinks · still or sparkling · cider · ready to order · steak', d: 36, place: [1, 2], placeAt: 18, caps: [
      [0.4, 6, 'Can I get you something to drink? → 권하는 Yes/No 질문. 원하는 것만 말해도 돼요 → Just water, please.'],
      [6, 12, 'Still or sparkling? → still → 그냥 물, sparkling → 탄산수. 수돗물 → tap water. 무료인 곳이 많지만 나라마다 달라요.'],
      [12, 18, '사이다 → cider? 영어의 cider → 사과로 만든 음료, 영국에서는 보통 술이에요. 사이다 → a lemon-lime soda.'],
      [18, 24, 'Are you ready to order? → Yes. I\'ll have the ribeye steak, please. 아직이면 → Could we have a few more minutes?'],
      [24, 30, 'How would you like your steak cooked? → 정보 질문. 굽기 → rare, medium-rare, medium, medium-well, well-done.'],
      [30, 36, 'Give me the menu. I want ribeye steak. → 명령하거나 조르는 말처럼 들려요. → Could I see the menu, please?'],
    ] },
    { id: 'allergy', n: '05', title: '알레르기와 요청', sub: 'Allergies · I\'m allergic to … · Does it have …? · without', d: 34, place: 3, caps: [
      [0.4, 6, 'Do you have any food allergies? → Yes, I\'m allergic to peanuts. 또는 → I have a peanut allergy.'],
      [6, 11.5, 'I have peanut. → ‘땅콩 있어요’를 옮긴 말이라 땅콩을 갖고 있다는 뜻이 돼요.'],
      [11.5, 17, '내가 먼저 물어요 → Does the house salad have nuts in it? 서버가 메뉴를 보고 알려 줘요.'],
      [17, 22.5, '뺄 수 있으면 → Yes, without the walnuts, please. 뺄 수 없으면 서버가 다른 음식을 권해요.'],
      [22.5, 28, '부탁도 짧게 → Not too spicy, please. Italian on the side, please. on the side → 따로.'],
      [28, 34, '알레르기가 있으면 메뉴 표시만 믿지 말고 직원에게 직접 말해요. 이 튜토리얼은 말하기 연습이에요.'],
    ] },
    { id: 'meal', n: '06', title: '식사 중', sub: 'Excuse me · How is everything · requests · wrong dish', d: 34, place: 4, caps: [
      [0.4, 6, '서버를 부를 때 → Excuse me. 눈을 맞추거나 손을 살짝 들어요. 많은 곳에서 서버가 먼저 와요.'],
      [6, 11.5, 'Hey! Waiter! Here! → ‘여기요’를 그대로 옮기면 무례하게 들려요. 박수나 큰 소리도 피해요.'],
      [11.5, 17, 'How is everything? → 정보 질문. Yes. → 어떤지 말하지 않았어요. → Great, thank you.'],
      [17, 22.5, '부탁은 질문으로 → Could I get some more water, please? Could we get an extra plate, please?'],
      [22.5, 28.5, '다른 음식이 나왔어요 → Here\'s your grilled salmon. This is wrong! → 따지는 말처럼 들려요.'],
      [28.5, 34, '사실 + 내가 시킨 것 → Excuse me, this isn\'t what I ordered. I ordered the ribeye steak.'],
    ] },
    { id: 'pay', n: '07', title: '디저트와 계산', sub: 'Box · dessert · the check · together or separate · tip', d: 34, place: [5, 6], placeAt: 12, caps: [
      [0.4, 6, 'Are you still working on that? → 아직 드시는 중인지 묻는 말. 남은 음식은 → Could I get a box for this?'],
      [6, 12, 'Can I interest you in some dessert? → No, thanks. Just the check, please. 영국에서는 → the bill.'],
      [12, 18, '‘계산해 주세요’를 옮긴 Calculate → 셈을 한다는 뜻이라 알아듣기 어려워요. → Could we get the check, please?'],
      [18, 24, 'Together or separate? → 고르는 질문. 더치페이를 옮긴 Dutch pay → 통하지 않아요. → Separate, please.'],
      [24, 29, `나눠 내면 서버가 나눈 값을 말해요 → That's ${EACH_D} each. 계산은 테이블에서 할 때가 많아요.`],
      [29, 34, 'Card or cash? → Card, please. 팁은 나라와 식당마다 달라요. 꼭 내는 곳도, 거의 안 내는 곳도 있어요.'],
    ] },
    { id: 'oneline', n: '08', title: '한 번에 주문하기', sub: '한 줄 주문 · 서버가 건너뛰는 질문', d: 32, caps: [
      [0.4, 6, '짧게 → I\'ll have the ribeye steak, please. 그러면 서버가 차례로 물어요 → 굽기, 수프나 샐러드, 드레싱.'],
      [6, 11.5, '주고받기가 네 번. 한 줄에 순서대로 넣어 볼까요? 음식 → 굽기 → with 곁들임 → 드레싱 → please.'],
      [11.5, 17.5, 'I\'ll have the ribeye steak, medium-rare, with a salad and Italian dressing, please.'],
      [17.5, 23, '그러면 서버는 굽기 · 수프나 샐러드 · 드레싱을 묻지 않아요 → Great choice.'],
      [23, 28, '알레르기도 한 줄 끝에 → I\'m allergic to nuts. 순서가 뒤섞이면 알아듣기 어려워요.'],
      [28, 32, '네 번이 한 번으로 줄었어요. 이 순서는 자주 쓰는 순서를 단순하게 줄인 규칙이에요.'],
    ] },
    { id: 'method', n: '09', title: '3단계 말하기 법', sub: '일곱 곳에 한 줄씩 · 질문의 모양과 함께', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 말하기 법**으로 묶어요.'],
      [5.5, 11.5, '① **열쇠 낱말과 질문의 모양 잡기** → or → 고르기, how · which · what → 정보, Are you · Would you → Yes/No.'],
      [11.5, 17.5, '② **틀에 내 정보 넣기** → Two, please. Sparkling, please. Medium-rare, please. I\'m allergic to + 성분.'],
      [17.5, 23, '③ **공손하게 끝내기** → please, thank you, Could I …? 부를 때는 → Excuse me.'],
      [23, 28, '일곱 곳에 한 줄씩 적용했어요. 줄마다 질문의 모양 표시를 함께 보세요.'],
    ] },
    { id: 'practice', n: '10', title: '실전 식사', sub: '식사 카드 하나로 네 번', d: 50, caps: [
      [0.4, 4.5, '실전이에요. 식사 카드 → 최하늘, 둘, 바깥 자리. 첫 질문 → Inside or outside?'],
      [4.5, 8.5, '① 고르는 질문 → (A) Yes, please. 탈락. ② (B) Inside → 카드는 바깥 자리라 탈락.'],
      [8.5, 12.5, '정답 (C) → Outside, please.'],
      [12.9, 17, 'How would you like your steak cooked? ① 정보 질문 → (B) Yes, please. 탈락.'],
      [17, 21, '② (C) Well-done → 카드는 미디엄 레어라 탈락.'],
      [21, 25, '정답 (A) → Medium-rare, please.'],
      [25.4, 29.5, '다른 음식이 나왔어요 → Here\'s your grilled salmon. ① 셋 모두 음식에 대한 말이에요.'],
      [29.5, 33.5, '② (A) Thank you. → 다른 음식을 그냥 받는 말이라 탈락.'],
      [33.5, 37.5, '③ (C) This is wrong! → 따지는 말이라 탈락. 정답 (B)'],
      [37.9, 42, '계산 → Will this be together or separate? ① (B) Yes. → 고르는 질문이라 탈락.'],
      [42, 46, '② (A) Dutch pay → 통하지 않는 콩글리시라 탈락.'],
      [46, 50, `정답 (C) → Separate, please. 서버 → That's ${EACH_P} each.`],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '곳 · 열쇠 낱말과 모양 · 대답 틀', d: 22, caps: [
      [0.4, 6, '정리해요. 질문을 들으면 먼저 모양을 잡아요 → Yes/No 질문, 고르는 질문, 정보 질문.'],
      [6, 12, '고르는 질문과 정보 질문에는 Yes 대신 → 고른 것 · 정보 + please. 권하는 말에는 원하는 것을 바로.'],
      [12, 17, '부를 때 → Excuse me. 계산 → Could we get the check, please? 나눠 내기 → Separate, please.'],
      [17, 22, '아래 **식당 시뮬레이터**에서 내 식사 카드로 입구부터 계산까지 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  RSS.CHAPTERS = CHAPTERS; RSS.CAPTIONS = CAPTIONS; RSS.END = END;
  RSS.POSTER = CHAPTERS.find(c => c.id === 'shapes').t + 33.5;
  RSS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  RSS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 실전 장면의 시각 (구간 시작 · 보기 · ① · ② · ③ · 정답)
  const PSEG = [0, 12.5, 25, 37.5];
  const PT = { q: 0.4, opt: [1.6, 2.2, 2.8], s1: 5.0, s2: 7.0, s3: 9.0, win: 10.0, lines: [0.4, 4.5, 8.5] };
  RSS.PSEG = PSEG;

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
  const ansParts = a => RS.segs(a).map(s => [s.t, s.r]);
  const why2 = j => `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
  // 판정 뒤 까닭 한 줄 (가운데)
  function whyLine(g, j, y, w = 1100) { const R = richLay(g, why2(j), [], 17, w, { weight: 600 }); richDraw(g, R, W / 2 - R.w / 2, y, { color: j.ok ? COL.good : COL.trap }); return R; }
  // 한 줄 (낱말 조각 + 조각 이름) — 08장
  const PART_COL = { open: COL.rel, dish: COL.clause, how: COL.clause, with: COL.clause, dress: COL.clause, without: COL.clause, please: COL.verb, allergy: COL.ante };

  // 01장 식당 평면도의 일곱 곳 [x, y, 이름 위치 dx, dy, 정렬]
  const MAP = {
    door: [190, 410, 0, 34, 'center'], drinks: [470, 270, 0, -34, 'center'], order: [610, 220, 0, -34, 'center'], allergy: [800, 236, 0, -34, 'center'],
    meal: [740, 336, 32, 0, 'left'], dessert: [690, 424, 0, 34, 'center'], check: [520, 424, 0, 34, 'center'],
  };
  const MAP_PATH = [[120, 410], [190, 410], [330, 410], [330, 270], [470, 270], [610, 220], [800, 236], [740, 336], [690, 424], [520, 424]];
  function polyPart(g, pts, f) {
    let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
    let left = L * clamp(f);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) { const d = seg[i - 1], k = Math.min(1, left / d); g.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)); left -= d; }
    g.stroke();
  }
  const ME_FIRST = RS.ME_FIRST;
  // 탁자 (평면도)
  const table = (g, x, y, r, on) => { circ(g, x, y, r, on ? 'rgba(255,193,94,0.16)' : 'rgba(238,241,244,0.06)'); ring(g, x, y, r, on ? COL.accent : 'rgba(238,241,244,0.22)', 1.5); [0, Math.PI].forEach(a => circ(g, x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10), 6, 'rgba(238,241,244,0.12)')); };

  const SCENES = {
    /* 00 들어가며: 제목 → Still or sparkling? → Yes. (서버가 다시 물음) → Sparkling, please. → 모양 셋 */
    intro(g, u) {
      fade(g, ramp(u, 0.2, 0.6) * (1 - ramp(u, 4.0, 0.5)), () => {
        txt(g, '식당, 질문의 모양이 대답을 정한다', W / 2, 262, { size: 54, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Restaurant English · 입구에서 계산까지 일곱 곳', W / 2, 332, { size: 24, weight: 500, color: COL.muted, align: 'center' });
        RS.PLACES.forEach((p, i) => fade(g, ramp(u, 0.9 + i * 0.22, 0.4), () => {
          const x = W / 2 + (i - 3) * 132;
          circ(g, x, 440, 32, COL.panel2); ring(g, x, 440, 32, ME_FIRST[p.id] ? COL.verb : COL.accent, 1.8);
          icon(g, p.id, x, 440, 30, COL.soft);
          txt(g, String(i + 1), x, 392, { size: 14, weight: 700, fam: FM, color: COL.accent, align: 'center' });
          txt(g, p.ko, x, 496, { size: fit(g, p.ko, 15, 126, 600), weight: 600, color: COL.muted, align: 'center' });
          if (i < 6) arrow(g, x + 38, 440, x + 92, 440, COL.faint, 2);
        }));
      });
      const it = RS.INTRO;
      fade(g, ramp(u, 4.6, 0.4) * (1 - ramp(u, 20.6, 0.5)), () => {
        label(g, '자리 · 음료 · Table', LX, 160, { color: COL.accent, size: 16 });
        fade(g, ramp(u, 4.8, 0.5), () => {
          panel(g, 960, 170, 240, 300, { fill: COL.panel, stroke: COL.faint });
          glass(g, 1020, 390, 0.9, 'still', u); glass(g, 1140, 390, 0.9, 'sparkling', u);
          txt(g, 'still', 1020, 418, { size: 18, weight: 700, color: COL.en, align: 'center' }); txt(g, '그냥 물', 1020, 444, { size: 14, weight: 600, color: COL.muted, align: 'center' });
          txt(g, 'sparkling', 1140, 418, { size: 18, weight: 700, color: COL.en, align: 'center' }); txt(g, '탄산수', 1140, 444, { size: 14, weight: 600, color: COL.muted, align: 'center' });
          say(960, 170, 120, 300, 'still water'); say(1080, 170, 120, 300, 'sparkling water');
          if (u >= 17.2) fade(g, ramp(u, 17.2, 0.4), () => { rr(g, 1086, 196, 108, 236, 12); g.strokeStyle = COL.good; g.lineWidth = 3; g.stroke(); });
        });
        const B = talk(g, { side: 'L', x: LX, y: 186, w: 860, text: 'Still or sparkling?', marks: [['Still or sparkling', 'key']], kind: 'server', sp: 'us', at: 5.4, u, roleAt: 7.0, size: 32 });
        fade(g, ramp(u, 7.6, 0.4), () => shapeTag(g, 'or', LX + 66, 186 + B.bh + 26, { text: '고르는 질문 → 둘 가운데 하나', size: 16 }));
        const p = clamp((u - 16.2) / 1.0);
        const A = answer(g, { x: LX, y: 316, w: 860, A: it.lit, B: u >= 16.2 ? it.ok : null, p, at: 10.8, u, size: 30, trapAt: 12.0, strikeAt: 12.2, verdict: u >= 17.4 ? { ok: true, at: 17.4 } : null });
        fade(g, win(u, 12.6, 16.2), () => {
          talk(g, { side: 'L', x: LX, y: 410, w: 860, text: '…Sorry — still or sparkling?', marks: [['still or sparkling', 'key']], kind: 'server', sp: 'us', at: 12.8, u, size: 24 });
          tag(g, '고르는 질문에 Yes → 무엇을 골랐는지 몰라요', A.bx + A.bw, 316 + A.bh + 22, COL.trap, { align: 'right', size: 15, h: 32 });
        });
        fade(g, ramp(u, 17.8, 0.4), () => pieces(g, [['고른 것', 'slot'], [' + ', ''], ['please', 'pol']], A.bx + A.bw, 316 + A.bh + 30, 22, 0, { align: 'right' }));
        fade(g, ramp(u, 18.8, 0.4), () => tag(g, '질문의 모양 → 대답의 모양', A.bx + A.bw, 316 + A.bh + 80, COL.accent, { align: 'right' }));
        if (u >= 17.4) say(A.bx, 316, A.bw, A.bh, RS.text(it.ok));
      });
      const COLS = [['yn', 'Are you ready to order?', 'Yes. I\'ll have the steak.'], ['or', 'Still or sparkling?', 'Sparkling, please.'], ['wh', 'How many?', 'Two, please.']];
      COLS.forEach(([sh, q, a], k) => {
        const al = ramp(u, 21.2 + k * 0.5, 0.5), x0 = LX + k * 380, Sx = RS.SHAPE[sh], c = SHC[sh];
        fade(g, al, () => {
          panel(g, x0, 196 + (1 - al) * 12, 360, 210, { fill: COL.panel, stroke: c, lw: 2 });
          shapeMark(g, sh, x0 + 40, 240 + (1 - al) * 12, 30);
          txt(g, Sx.ko, x0 + 78, 240 + (1 - al) * 12, { size: 25, weight: 800, fam: FD });
          txt(g, q, x0 + 24, 296, { size: fit(g, q, 20, 320, 600), weight: 600, color: COL.en });
          txt(g, `→ ${Sx.ans}`, x0 + 24, 334, { size: 17, weight: 700, color: c });
          txt(g, a, x0 + 24, 372, { size: fit(g, a, 19, 320, 600), weight: 600, color: COL.rel });
          say(x0, 280, 360, 30, q); say(x0, 356, 360, 30, a);
        });
      });
      fade(g, ramp(u, 23.4, 0.5), () => pieces(g, [['① ', 'key'], ['열쇠 낱말 + 모양', 'key'], ['  →  ', ''], ['② ', 'frame'], ['틀에 내 정보', 'frame'], ['  →  ', ''], ['③ ', 'pol'], ['공손하게', 'pol']], W / 2, 462, 24, 0, { align: 'center' }));
    },

    /* 01 식당 길 지도: 평면도 위의 일곱 곳과 곳마다 한두 마디 */
    route(g, u) {
      const sel = S.stop != null ? S.stop : null;
      fade(g, ramp(u, 0.3, 0.6), () => {
        panel(g, 70, 146, 1140, 322, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        // 입구
        g.fillStyle = COL.bg; g.fillRect(64, 386, 14, 52); txt(g, 'ENTRANCE', 88, 368, { size: 10, weight: 700, fam: FM, color: '#B08B62' });
        // 호스트 자리 · 기다리는 의자
        rr(g, 162, 382, 56, 22, 5); g.fillStyle = COL.wood; g.fill(); txt(g, 'HOST', 190, 393, { size: 9.5, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
        rr(g, 96, 300, 90, 20, 6); g.fillStyle = 'rgba(238,241,244,0.08)'; g.fill(); txt(g, 'WAITING', 141, 310, { size: 9.5, weight: 700, fam: FM, color: COL.dim, align: 'center' });
        // 계산대 (점선: 계산대에서 내는 곳도 있어요)
        rr(g, 96, 166, 170, 44, 8); g.setLineDash([5, 5]); g.strokeStyle = 'rgba(201,167,255,0.5)'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
        txt(g, 'CASHIER', 181, 182, { size: 10, weight: 700, fam: FM, color: COL.verb, align: 'center' }); txt(g, '계산대에서 내는 곳도', 181, 199, { size: 11, weight: 600, color: COL.muted, align: 'center' });
        // 다른 탁자 · 우리 탁자
        [[420, 186], [430, 372], [860, 404]].forEach(([x, y]) => table(g, x, y, 22, false));
        rr(g, 556, 290, 108, 62, 10); g.fillStyle = 'rgba(255,193,94,0.12)'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 1.8; g.stroke();
        txt(g, 'TABLE 12', 610, 321, { size: 11, weight: 700, fam: FM, color: COL.accent, align: 'center' });
        [[576, 280], [644, 280], [576, 362], [644, 362]].forEach(([x, y]) => circ(g, x, y, 7, 'rgba(238,241,244,0.14)'));
        // 주방 · 바깥 자리
        rr(g, 900, 162, 290, 104, 10); g.fillStyle = 'rgba(238,241,244,0.04)'; g.fill(); g.strokeStyle = 'rgba(238,241,244,0.18)'; g.lineWidth = 1.5; g.stroke();
        txt(g, 'KITCHEN', 1045, 214, { size: 12, weight: 700, fam: FM, color: COL.muted, align: 'center' });
        g.fillStyle = 'rgba(255,193,94,0.35)'; g.fillRect(896, 196, 6, 44);
        rr(g, 940, 296, 250, 160, 12); g.setLineDash([6, 6]); g.strokeStyle = 'rgba(127,224,168,0.5)'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
        txt(g, 'PATIO · OUTSIDE', 1065, 316, { size: 11, weight: 700, fam: FM, color: COL.clause, align: 'center' });
        icon(g, 'sun', 1170, 318, 18, COL.clause);
        [[1010, 390], [1120, 390]].forEach(([x, y]) => table(g, x, y, 20, false));
      });
      // 식사하는 차례로 걷는 길
      fade(g, ramp(u, 0.6, 0.5), () => { g.strokeStyle = 'rgba(110,200,255,0.5)'; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash([2, 7]); polyPart(g, MAP_PATH, sel != null ? 1 : (u - 0.8) / 14); g.setLineDash([]); });
      const AT = [0.8, 3.0, 6.2, 8.0, 9.6, 12.4, 14.4];
      RS.PLACES.forEach((p, i) => {
        const [x, y, dx, dy, al] = MAP[p.id], on = sel === i, dim = sel != null && !on, me = ME_FIRST[p.id] && u >= 18.2;
        fade(g, ramp(u, AT[i], 0.45) * (dim ? 0.4 : 1), () => {
          circ(g, x, y, 22, on ? COL.accent : COL.panel2); ring(g, x, y, 22, on ? COL.accent : me ? COL.verb : COL.ante, me ? 3 : 2.2);
          icon(g, p.id, x, y, 24, on ? '#1D1305' : COL.text);
          chip(g, String(i + 1), x + 18, y - 20, { size: 11, fam: FM, weight: 700, color: '#1D1305', fill: COL.accent, h: 18, r: 9, pad: 5, align: 'center' });
          txt(g, p.ko, x + dx, y + dy, { size: fit(g, p.ko, 14, 150, 700), weight: 700, color: me ? COL.verb : COL.soft, align: al });
        });
        HITS.push({ x: x - 26, y: y - 26, w: 52, h: 52, stop: i });
      });
      // 아래 칸
      const by = 480, bh = 98;
      if (sel != null) {
        const p = RS.PLACES[sel];
        panel(g, LX, by, 1120, bh, { fill: COL.panel, stroke: COL.accent });
        icon(g, p.id, LX + 28, by + 24, 22, COL.accent);
        txt(g, `${sel + 1}. ${p.ko}`, LX + 48, by + 24, { size: 17, weight: 700, color: COL.accent });
        RS.ROUTE[p.id].forEach((qid, k) => {
          const q = RS.Q[qid], t = q.short && /\?$/.test(q.short) ? q.short : q.en, R = richLay(g, t, Qm(q), 17, 600, { weight: 600 });
          shapeMark(g, q.shape, LX + 34, by + 54 + k * 28, 14, { disc: false, iw: 2.2 });
          richDraw(g, R, LX + 52, by + 54 + k * 28, { color: COL.en });
          say(LX + 48, by + 40 + k * 28, R.w + 8, 28, q.en);
        });
        txt(g, '대답 →', LX + 700, by + 24, { size: 14, weight: 700, color: COL.muted });
        RS.ROUTE[p.id].map(id => RS.Q[id]).forEach((q, k) => { const t = RS.text(RS.model(q, RS.DEMO)); txt(g, t, LX + 700, by + 54 + k * 28, { size: fit(g, t, 16, 410, 600), weight: 600, color: COL.rel }); });
      } else {
        RS.PLACES.forEach((p, i) => fade(g, ramp(u, 12.2 + i * 0.3, 0.4), () => {
          const x = LX + i * 161, q = RS.Q[RS.ROUTE[p.id][0]], t = q.short || q.en, me = ME_FIRST[p.id] && u >= 18.2;
          panel(g, x, by, 151, bh, { fill: COL.panel, stroke: me ? COL.verb : COL.faint, lw: me ? 2 : 1.5 });
          txt(g, `${i + 1}`, x + 14, by + 20, { size: 13, weight: 700, fam: FM, color: COL.accent });
          txt(g, me ? '내가 먼저도' : '서버가 물음', x + 140, by + 20, { size: 12, weight: 700, color: me ? COL.verb : COL.muted, align: 'right' });
          const R = richLay(g, t, [], 14, 130, { weight: 600 });
          richDraw(g, R, x + 12, by + 48, { color: COL.en });
          say(x, by, 151, bh, q.en);
        }));
        fade(g, ramp(u, 24.2, 0.5), () => tag(g, '식당 · 나라마다 달라요', 1200, 126, COL.muted, { align: 'right', size: 14, h: 26 }));
      }
    },

    /* 02 질문의 모양 세 가지: Yes/No · 고르기 · 정보, 대답의 모양, 끝이 내려가는 고르는 질문, Yes의 비대칭 */
    shapes(g, u) {
      if (S.shape) {
        const q = RS.Q[S.shape.q], j = S.shape.pick ? S.shape.pick === q.shape : null, ja = S.shape.a ? RS.judge(q, S.shape.a, S.shape.card || {}, '상황') : null;
        staff(g, q, { x: LX, y: 160, w: 1000, all: true, u: 99, size: 26 });
        ['yn', 'or', 'wh', 'note'].forEach((sh, k) => {
          const x = LX + 60 + k * 270, on = S.shape.pick === sh, right = sh === q.shape && S.shape.pick;
          panel(g, x - 50, 268, 240, 120, { fill: on ? COL.panel2 : COL.panel, stroke: right ? COL.good : on ? COL.bad : COL.faint, lw: on || right ? 2.6 : 1.5 });
          shapeMark(g, sh, x, 328, 34); txt(g, RS.SHAPE[sh].ko, x + 40, 316, { size: 19, weight: 800, fam: FD }); txt(g, RS.SHAPE[sh].ans, x + 40, 346, { size: fit(g, RS.SHAPE[sh].ans, 14, 140, 600), weight: 600, color: SHC[sh] });
        });
        if (j != null) { const R = richLay(g, j ? `맞아요 → ${RS.SHAPE[q.shape].ko}. ${RS.sayOf(q.intent)}.` : `다시 보세요 → 이 말은 ${RS.SHAPE[q.shape].ko}이에요. ${RS.sayOf(q.intent)}.`, [], 18, 1100, { weight: 600 }); richDraw(g, R, LX, 422, { color: j ? COL.good : COL.trap }); }
        if (ja) { answer(g, { x: LX, y: 456, w: 1120, A: S.shape.a, all: true, u: 99, size: 22, verdict: { ok: ja.ok, at: -1 } }); const R = richLay(g, why2(ja), [], 15, 1120, { weight: 600 }); richDraw(g, R, LX, 532, { color: ja.ok ? COL.good : COL.trap }); }
        return;
      }
      const C3 = [
        { sh: 'yn', at: 0.6, qs: ['or_ready', 'd_resv'], ans: 'Yes · No + 한 마디' },
        { sh: 'or', at: 12.2, qs: ['d_seat', 'or_side'], ans: '고른 것 + please' },
        { sh: 'wh', at: 30.2, qs: ['d_many', 'or_cook'], ans: '정보 + please' },
      ];
      C3.forEach((c, k) => {
        const x0 = LX + k * 385, al = ramp(u, c.at, 0.5), on = u >= c.at, col = SHC[c.sh];
        fade(g, 0.35 + 0.65 * al, () => {
          panel(g, x0, 146, 365, 300, { fill: on ? COL.panel : 'rgba(24,32,42,0.5)', stroke: on ? col : COL.faint, lw: on ? 2.2 : 1.5 });
          shapeMark(g, c.sh, x0 + 38, 184, 30, { color: on ? col : COL.dim });
          txt(g, RS.SHAPE[c.sh].ko, x0 + 76, 178, { size: 24, weight: 800, fam: FD, color: on ? COL.text : COL.dim });
          txt(g, RS.SHAPE[c.sh].mark, x0 + 76, 204, { size: 13, weight: 600, color: on ? col : COL.dim });
        });
        if (on) fade(g, al, () => {
          c.qs.forEach((qid, i) => { const q = RS.Q[qid], t = q.short && /\?$/.test(q.short) ? q.short : q.en, R = richLay(g, t, Qm(q), 18, 330, { weight: 600 }); richDraw(g, R, x0 + 20, 244 + i * 32, { color: COL.en, rolesOn: u >= c.at + 1.2 }); say(x0 + 16, 228 + i * 32, R.w + 8, 30, q.en); });
          txt(g, `대답 → ${c.ans}`, x0 + 20, 316, { size: 17, weight: 700, color: col });
        });
      });
      // Yes/No: 대답 · 권하는 말
      fade(g, ramp(u, 6.2, 0.4), () => {
        const a = RS.o('or_have', 'steak'); pieces(g, ansParts(a), LX + 20, 352, 17, 330); mark(g, true, LX + 345, 352, 13); say(LX + 16, 338, 330, 28, RS.text(a));
        const [qo, just] = RS.SCENE.offer;
        txt(g, RS.Q[qo].en, LX + 20, 390, { size: fit(g, RS.Q[qo].en, 15, 330, 600), weight: 600, color: COL.en }); say(LX + 16, 376, 330, 28, RS.Q[qo].en);
        pieces(g, ansParts(just), LX + 20, 420, 17, 220); mark(g, true, LX + 200, 420, 13); say(LX + 16, 406, 200, 28, RS.text(just));
        fade(g, ramp(u, 8.4, 0.4), () => tag(g, 'Yes는 빼도 돼요', LX + 350, 420, COL.ante, { align: 'right', size: 13, h: 26 }));
      });
      // 고르기: 대답 · Yes 함정
      fade(g, ramp(u, 14.6, 0.4), () => {
        const x0 = LX + 385, [, yes, ok] = RS.SCENE.orYes;
        pieces(g, ansParts(ok), x0 + 20, 352, 18, 300); mark(g, true, x0 + 170, 352, 13); say(x0 + 16, 338, 160, 28, RS.text(ok));
        if (u >= 18.2) fade(g, ramp(u, 18.2, 0.4), () => {
          const w = pieces(g, ansParts(yes).map(([t]) => [t, 'trap']), x0 + 20, 392, 18, 300);
          const p = clamp((u - 18.6) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x0 + 16, 393); g.lineTo(x0 + 16 + (w + 8) * p, 393); g.stroke();
          fade(g, ramp(u, 19.0, 0.3), () => tag(g, '무엇을 골랐는지 몰라요', x0 + 350, 392, COL.trap, { align: 'right', size: 13, h: 26 }));
          say(x0 + 16, 378, w + 8, 28, RS.text(yes));
        });
      });
      // 끝이 내려가는 고르는 질문 · 올라가면 Yes/No (아래 띠)
      const inI = win(u, 20.2, 30.4);
      if (inI > 0.001) fade(g, inI, () => {
        panel(g, LX, 458, 1120, 118, { fill: COL.panel, stroke: COL.faint });
        const row = (y, parts, dirs, note, c) => {
          let x = LX + 26; const xs = [];
          parts.forEach(([t, r]) => { const w = txt(g, t, x, y, { size: 24, weight: 700, color: r ? RC[r] : COL.en }); xs.push([x, x + w]); x += w; });
          dirs.forEach(([k, d]) => { const [a, b] = xs[k]; pitch(g, a + 4, b - 2, y - 24, d, c, 3.4); });
          txt(g, note, LX + 470, y, { size: fit(g, note, 18, 640, 700), weight: 700, color: c });
          say(LX + 20, y - 18, x - LX - 20, 36, parts.map(p => p[0]).join(''));
        };
        row(502, [['Soup', ''], [' or ', ''], ['salad?', '']], [[0, 'up'], [2, 'down']], '끝을 내려요(↘) → 고르는 질문 · 둘 가운데 하나', COL.rel);
        if (u >= 24.2) fade(g, ramp(u, 24.2, 0.4), () => row(552, [['Would you like soup or salad?', '']], [[0, 'up']], '끝을 올리면(↗) → Yes/No 질문이 되기도 해요(드릴까요?)', COL.ante));
      });
      // Yes의 비대칭 (아래 띠)
      if (u >= 30.4) fade(g, ramp(u, 30.6, 0.4), () => {
        const x0 = LX + 770, [, yes, ok] = RS.SCENE.whYes;
        pieces(g, ansParts(ok), x0 + 20, 352, 18, 300); mark(g, true, x0 + 175, 352, 13); say(x0 + 16, 338, 160, 28, RS.text(ok));
        const w = pieces(g, ansParts(yes).map(([t]) => [t, 'trap']), x0 + 20, 392, 18, 300);
        g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x0 + 16, 393); g.lineTo(x0 + 24 + w, 393); g.stroke();
        tag(g, '정보가 없어요', x0 + 350, 392, COL.trap, { align: 'right', size: 13, h: 26 });
        panel(g, LX, 458, 1120, 118, { fill: COL.panel, stroke: COL.accent });
        txt(g, 'Yes만 하면?', LX + 26, 500, { size: 22, weight: 800, fam: FD, color: COL.accent });
        txt(g, 'Yes · No만 하는 대답', LX + 26, 534, { size: 15, weight: 600, color: COL.muted });
        [['yn', '(권하는) Yes/No 질문 → 괜찮아요 · 원하는 것을 바로 말해도 돼요', true], ['or', '고르는 질문 → 안 돼요 → 고른 것 + please', false], ['wh', '정보 질문 → 안 돼요 → 정보 + please', false]].forEach(([sh, t, ok], k) => {
          const x = LX + 250, y = 482 + k * 36;
          shapeMark(g, sh, x + 12, y, 18); txt(g, t, x + 34, y, { size: fit(g, t, 18, 800, 700), weight: 700, color: ok ? COL.good : COL.trap });
          (ok ? check : cross)(g, LX + 1090, y, 14, ok ? COL.good : COL.bad);
        });
      });
    },

    /* 03 입구와 자리: 예약 → 몇 명 → We are two → 기다리는 시간(fifteen · fifty) → 되묻기 → 안쪽 · 바깥 */
    door(g, u) {
      const D = RS.DEMO;
      if (S.party) {
        const a = S.party.a, j = RS.judge('d_many', a, { party: S.party.n }, '상황');
        staff(g, 'd_many', { x: LX, y: 150, w: 900, all: true, u: 99, size: 24, shape: 'wh' });
        for (let k = 0; k < S.party.n; k++) { const x = LX + 40 + k * 70; circ(g, x, 268, 18, '#5D6FA8'); circ(g, x, 238, 12, '#E8BC95'); }
        txt(g, `${S.party.n}명`, LX + 40 + S.party.n * 70, 256, { size: 22, weight: 800, color: COL.clause });
        answer(g, { x: LX, y: 316, w: 1120, A: a, all: true, u: 99, size: 28, verdict: { ok: j.ok, at: -1 } });
        whyLine(g, j, 420);
        return;
      }
      const host = (g2, a) => fade(g2, a, () => {
        panel(g2, 900, 150, 300, 330, { fill: COL.panel, stroke: COL.faint });
        rr(g2, 990, 330, 120, 110, 8); g2.fillStyle = COL.wood; g2.fill();
        rr(g2, 975, 316, 150, 20, 6); g2.fillStyle = '#4A3A2E'; g2.fill();
        rr(g2, 950, 180, 200, 100, 10); g2.fillStyle = COL.paper; g2.fill();
        txt(g2, 'PLEASE WAIT', 1050, 212, { size: 15, weight: 700, fam: FM, color: COL.ink, align: 'center' });
        txt(g2, 'TO BE SEATED', 1050, 236, { size: 15, weight: 700, fam: FM, color: COL.ink, align: 'center' });
        txt(g2, '자리 안내를 기다려요', 1050, 262, { size: 13, weight: 600, color: '#5B6168', align: 'center' });
        txt(g2, 'HOST', 1050, 386, { size: 13, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
        say(950, 180, 200, 100, 'Please wait to be seated.');
      });
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        host(g, ramp(u, 0.4, 0.5));
        const [qr, under, no] = RS.SCENE.resv;
        const B = staff(g, qr, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 2.4, size: 22, shape: 'yn', shapeAt: 2.8 });
        answer(g, { x: LX, y: 150 + B.bh + 14, w: 780, A: under, at: 3.0, u, size: 24, verdict: { ok: okOf(qr, under, { resv: true, name: 'Park' }), at: 3.8 } });
        fade(g, ramp(u, 4.2, 0.4), () => tag(g, '이름까지 → 다시 묻지 않아요', LX + 10, 150 + B.bh + 92, COL.clause, { align: 'left', size: 15, h: 30 }));
        fade(g, ramp(u, 6.0, 0.4), () => txt(g, '예약이 없으면 ↓', LX + 330, 150 + B.bh + 92, { size: 16, weight: 700, color: COL.muted }));
        fade(g, ramp(u, 6.0, 0.4), () => {
          const y0 = 150 + B.bh + 130;
          answer(g, { x: LX, y: y0, w: 780, A: no, at: 6.2, u, size: 22, verdict: { ok: true, at: 6.9 } });
          const [qm, two] = RS.SCENE.many;
          staff(g, qm, { x: LX, y: y0 + 64, w: 780, at: 7.4, u, roleAt: 8.4, size: 22, shape: 'wh', shapeAt: 8.6 });
          answer(g, { x: LX, y: y0 + 128, w: 780, A: two, at: 9.4, u, size: 24, verdict: { ok: true, at: 10.0 } });
        });
      });
      const inB = win(u, 11.6, 17.0);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        host(g, 1);
        const [qm, , we, table] = RS.SCENE.many;
        staff(g, qm, { x: LX, y: 160, w: 780, all: true, u: 99, size: 22, shape: 'wh' });
        thought(g, '(한국어로) 우리는 둘이에요', LX, 238, 360);
        answer(g, { x: LX, y: 306, w: 780, A: we, at: 12.2, u, size: 24, verdict: { ok: true, at: 12.9 }, tag: ['통해요 · 보통은 Two, please.', COL.rel, 13.2], tagX: LX + 10, tagY: 306 + 26 });
        answer(g, { x: LX, y: 396, w: 780, A: table, at: 14.4, u, size: 24, verdict: { ok: true, at: 15.1 } });
        fade(g, ramp(u, 15.6, 0.4), () => { const c = chip(g, 'Two people.', LX + 210, 496, { size: 17, weight: 700, color: COL.rel, fill: COL.panel2, stroke: 'rgba(242,194,154,0.5)', h: 34 }); txt(g, 'person → people', LX + 10, 496, { size: 15, weight: 700, color: COL.muted }); say(c.x, c.y, c.w, c.h, 'Two people.'); });
      });
      const inC = win(u, 17.2, 27.6);
      if (inC > 0.001 && u >= 17.0) fade(g, inC, () => {
        const [qw, chk, ok] = RS.SCENE.wait;
        staff(g, qw, { x: LX, y: 150, w: 860, at: 17.4, u, roleAt: 18.6, size: 22, shape: 'yn', shapeAt: 19.0 });
        fade(g, ramp(u, 19.2, 0.4) * (1 - ramp(u, 22.4, 0.3)), () => {
          RS.PAIRS.forEach(([n1, w1, n2, w2], i) => fade(g, ramp(u, 19.4 + i * 0.4, 0.3), () => {
            const x = LX + i * 250, y = 268;
            const draw = (s, xx, yy) => { const m = s.match(/^([a-z]*)([A-Z]+)([a-z]*)$/); let x2 = xx; [[m[1], 0], [m[2], 1], [m[3], 0]].forEach(([p, big]) => { if (!p) return; x2 += txt(g, p.toLowerCase(), x2, yy, { size: big ? 26 : 19, weight: big ? 800 : 500, color: big ? COL.accent : COL.soft }); }); };
            txt(g, n1, x, y, { size: 18, weight: 700, fam: FM, color: COL.muted }); draw(w1, x + 36, y);
            txt(g, n2, x, y + 42, { size: 18, weight: 700, fam: FM, color: COL.muted }); draw(w2, x + 36, y + 42);
            say(x, y - 18, 220, 76, `${w1.toLowerCase()}, ${w2.toLowerCase()}`);
          }));
          linked(g, RS.LINKED[0], LX, 400, u, 20.4);
        });
        fade(g, ramp(u, 22.6, 0.4), () => {
          answer(g, { x: LX, y: 250, w: 860, A: chk, at: 22.8, u, size: 24, verdict: { ok: true, at: 23.6 } });
          talk(g, { side: 'L', x: LX, y: 330, w: 860, text: 'Yes, fifteen. One-five.', marks: [['fifteen', 'slot']], kind: 'host', sp: 'au', at: 24.0, u, size: 22 });
          answer(g, { x: LX, y: 410, w: 860, A: ok, at: 25.6, u, size: 24, verdict: { ok: true, at: 26.3 } });
        });
        fade(g, ramp(u, 18.0, 0.5), () => { panel(g, 960, 150, 240, 230, { fill: COL.panel, stroke: COL.faint }); clockFace(g, 1080, 250, 70, 15); txt(g, '15분 → fifteen', 1080, 350, { size: 17, weight: 700, color: COL.en, align: 'center' }); say(960, 150, 240, 230, 'fifteen minutes'); });
      });
      if (u >= 27.6) fade(g, ramp(u, 27.8, 0.4), () => {
        const [qs, yes, out] = RS.SCENE.seat;
        const B = staff(g, qs, { x: LX, y: 160, w: 860, at: 28.0, u, roleAt: 28.8, size: 24, shape: 'or', shapeAt: 29.0 });
        answer(g, { x: LX, y: 160 + B.bh + 20, w: 860, A: yes, B: out, p: (u - 30.4) / 0.7, at: 29.4, u, size: 26, trapAt: 29.8, strikeAt: 29.9, verdict: u >= 31.2 ? { ok: true, at: 31.2 } : null, tag: ['고른 것이 없어요', COL.trap, 30.0, 30.4], tagY: 160 + B.bh + 104 });
        fade(g, ramp(u, 28.4, 0.5), () => { panel(g, 960, 300, 240, 170, { fill: COL.panel, stroke: 'rgba(127,224,168,0.5)', dash: true }); icon(g, 'sun', 1080, 360, 40, COL.clause); txt(g, 'outside · patio', 1080, 420, { size: 17, weight: 700, color: COL.clause, align: 'center' }); txt(g, '바깥 자리', 1080, 446, { size: 14, weight: 600, color: COL.muted, align: 'center' }); });
      });
    },

    /* 04 음료와 주문: 권하는 말 → still · sparkling → cider → Are you ready to order? → 굽기 띠 → Give me · I want */
    drinks(g, u) {
      const D = RS.DEMO;
      if (S.cook) {
        const a = S.cook.a, j = RS.judge('or_cook', a, { cook: S.cook.want }, '상황'), f = RS.factOf(a, RS.Q.or_cook);
        staff(g, 'or_cook', { x: LX, y: 150, w: 900, all: true, u: 99, size: 24, shape: 'wh' });
        const hl = {}; hl[DONE.indexOf(S.cook.want)] = COL.clause; if (f.cook && f.cook !== S.cook.want && DONE.includes(f.cook)) hl[DONE.indexOf(f.cook)] = COL.trap;
        doneStrip(g, LX, 236, 760, { hl });
        answer(g, { x: LX, y: 380, w: 1120, A: a, all: true, u: 99, size: 28, verdict: { ok: j.ok, at: -1 } });
        whyLine(g, j, 476);
        return;
      }
      fade(g, 1 - ramp(u, 5.8, 0.4), () => {
        const [qo, just] = RS.SCENE.drink;
        const B = staff(g, qo, { x: LX, y: 160, w: 800, at: 0.8, u, roleAt: 1.8, size: 26, shape: 'yn', shapeAt: 2.2 });
        answer(g, { x: LX, y: 160 + B.bh + 24, w: 800, A: just, at: 2.8, u, size: 28, verdict: { ok: true, at: 3.6 } });
        fade(g, ramp(u, 4.0, 0.4), () => tag(g, '권하는 말 → 원하는 것만 말해도 돼요', LX + 10, 160 + B.bh + 120, COL.ante, { align: 'left', size: 15, h: 30 }));
        fade(g, ramp(u, 1.0, 0.5), () => { panel(g, 960, 160, 240, 300, { fill: COL.panel, stroke: COL.faint }); glass(g, 1080, 400, 1.1, 'still', u); });
      });
      const inB = win(u, 6.0, 12.0);
      if (inB > 0.001 && u >= 5.8) fade(g, inB, () => {
        const [qw, sp] = RS.SCENE.water;
        const B = staff(g, qw, { x: LX, y: 160, w: 860, at: 6.2, u, roleAt: 7.6, size: 22, shape: 'or', shapeAt: 7.8 });
        answer(g, { x: LX, y: 160 + B.bh + 18, w: 860, A: sp, at: 8.2, u, size: 26, verdict: { ok: true, at: 8.9 } });
        fade(g, ramp(u, 6.6, 0.5), () => {
          [['still', 'still', '그냥 물'], ['sparkling', 'sparkling', '탄산수'], ['still', 'tap water', '수돗물']].forEach(([k, en, ko], i) => {
            const cx = LX + 120 + i * 260;
            glass(g, cx, 470, 0.85, k, u);
            txt(g, en, cx + 60, 400, { size: 20, weight: 800, color: COL.en }); txt(g, ko, cx + 60, 428, { size: 15, weight: 600, color: COL.muted });
            say(cx - 40, 340, 220, 140, en);
          });
          fade(g, ramp(u, 10.2, 0.4), () => tag(g, 'tap water → 무료인 곳이 많지만 나라 · 식당마다 달라요', 1200, 520, COL.muted, { align: 'right', size: 14, h: 30 }));
        });
      });
      const inC = win(u, 12.2, 18.0);
      if (inC > 0.001 && u >= 12.0) fade(g, inC, () => {
        thought(g, '(한국어로) 사이다 주세요', LX, 160, 360);
        const [cider, soda] = RS.SCENE.cider;
        const A = answer(g, { x: LX, y: 232, w: 860, A: cider, B: u >= 15.4 ? soda : null, p: (u - 15.4) / 0.8, at: 12.6, u, size: 28, trapAt: 13.2, strikeAt: 13.3, verdict: u >= 16.4 ? { ok: true, at: 16.4 } : null });
        fade(g, win(u, 13.6, 15.4), () => talk(g, { side: 'L', x: LX, y: 232 + A.bh + 16, w: 860, text: 'Cider? Just so you know, our cider is an apple drink with alcohol in it.', marks: [['apple drink', 'trap'], ['alcohol', 'trap']], kind: 'server', sp: 'us', at: 13.8, u, size: 20 }));
        fade(g, ramp(u, 16.6, 0.4), () => tag(g, '사이다 → a lemon-lime soda (브랜드 이름으로 말하는 사람도 많아요)', LX + 10, 232 + A.bh + 40, COL.clause, { align: 'left', size: 15, h: 30 }));
        fade(g, ramp(u, 12.6, 0.5), () => {
          panel(g, LX, 420, 1120, 150, { fill: COL.panel, stroke: COL.faint });
          apple(g, LX + 90, 488, 26); glass(g, LX + 190, 548, 0.85, 'cider', u);
          txt(g, 'cider', LX + 260, 470, { size: 22, weight: 800, color: COL.trap }); txt(g, '사과로 만든 음료 · 영국은 보통 술', LX + 260, 502, { size: 15, weight: 600, color: COL.muted });
          glass(g, LX + 720, 548, 0.85, 'soda', u);
          txt(g, 'lemon-lime soda', LX + 790, 470, { size: 22, weight: 800, color: COL.clause }); txt(g, '한국의 사이다', LX + 790, 502, { size: 15, weight: 600, color: COL.muted });
          say(LX, 420, 560, 150, 'cider'); say(LX + 560, 420, 560, 150, 'a lemon-lime soda');
        });
      });
      const inD = win(u, 18.2, 24.0);
      if (inD > 0.001 && u >= 18.0) fade(g, inD, () => {
        const [qr, have, mins] = RS.SCENE.ready;
        const B = staff(g, qr, { x: LX, y: 160, w: 780, at: 18.4, u, roleAt: 19.2, size: 24, shape: 'yn', shapeAt: 19.4 });
        answer(g, { x: LX, y: 160 + B.bh + 16, w: 780, A: have, at: 19.8, u, size: 24, verdict: { ok: true, at: 20.6 } });
        fade(g, ramp(u, 21.6, 0.4), () => { txt(g, '아직 고르는 중이면 →', LX, 160 + B.bh + 116, { size: 16, weight: 700, color: COL.muted }); answer(g, { x: LX, y: 160 + B.bh + 140, w: 780, A: mins, at: 21.8, u, size: 22, verdict: { ok: true, at: 22.6 } }); });
        fade(g, ramp(u, 18.6, 0.5), () => menuDraw(g, 900, 150, 300, { hl: { steak: COL.accent } }));
      });
      const inE = win(u, 24.2, 30.0);
      if (inE > 0.001 && u >= 24.0) fade(g, inE, () => {
        const [qc, mr] = RS.SCENE.cook;
        const B = staff(g, qc, { x: LX, y: 160, w: 900, at: 24.4, u, roleAt: 25.4, size: 24, shape: 'wh', shapeAt: 25.6 });
        fade(g, ramp(u, 25.8, 0.5), () => doneStrip(g, LX, 160 + B.bh + 30, 900, { hl: u >= 28.4 ? { 1: COL.clause } : {} }));
        answer(g, { x: LX, y: 160 + B.bh + 176, w: 900, A: mr, at: 27.8, u, size: 26, verdict: { ok: true, at: 28.4 } });
      });
      if (u >= 30.0) fade(g, ramp(u, 30.2, 0.4), () => {
        const [[g1, ok1], [g2, ok2]] = RS.SCENE.blunt;
        answer(g, { x: LX, y: 160, w: 1000, A: g1, B: u >= 32.2 ? ok1 : null, p: (u - 32.2) / 0.7, at: 30.4, u, size: 26, trapAt: 31.0, strikeAt: 31.1, verdict: u >= 33.0 ? { ok: true, at: 33.0 } : null, tag: ['명령처럼 들려요', COL.trap, 31.3, 32.2], tagY: 160 + 74 });
        answer(g, { x: LX, y: 300, w: 1000, A: g2, B: u >= 33.6 ? ok2 : null, p: (u - 33.6) / 0.7, at: 31.4, u, size: 26, trapAt: 32.0, strikeAt: 32.1, verdict: u >= 34.4 ? { ok: true, at: 34.4 } : null, tag: ['조르는 말처럼 · the도 빠졌어요', COL.trap, 32.3, 33.6], tagY: 300 + 74 });
        fade(g, ramp(u, 34.6, 0.4), () => tag(g, '부탁은 질문으로 · 주문은 I\'ll have the …', 1080, 470, COL.verb, { align: 'right' }));
      });
    },

    /* 05 알레르기와 요청: I'm allergic to … → I have peanut × → Does … have … in it? → RS.safe → 부탁 → 안전 한 줄 */
    allergy(g, u) {
      const D = RS.DEMO;
      if (S.allergy) {
        const s = S.allergy, r = RS.safeReply(s.items, s.al), j = s.a ? RS.judge('al_any', s.a, { allergy: s.al }, '상황') : null;
        menuDraw(g, 880, 150, 320, { hl: Object.fromEntries(s.items.map(i => [i, r.s.contains ? (r.s.removable ? COL.accent : COL.bad) : COL.good])), bad: s.al });
        if (s.a) answer(g, { x: LX, y: 160, w: 760, A: s.a, all: true, u: 99, size: 24, verdict: { ok: j.ok, at: -1 } });
        if (j) { const R = richLay(g, why2(j), [], 16, 760, { weight: 600 }); richDraw(g, R, LX, 244, { color: j.ok ? COL.good : COL.trap }); }
        talk(g, { side: 'L', x: LX, y: 330, w: 760, text: r.en, marks: r.s.contains ? [[r.s.removable ? 'without' : 'can\'t be left out', r.s.removable ? 'ok' : 'trap']] : [['doesn\'t have', 'ok']], kind: 'server', sp: 'us', all: true, u: 99, size: 20 });
        tag(g, r.s.contains ? (r.s.removable ? `${r.s.ko} → 빼고 만들 수 있어요` : `${r.s.ko} → 뺄 수 없어요`) : '들어 있지 않아요', LX + 66, 520, r.s.contains ? (r.s.removable ? COL.accent : COL.bad) : COL.good, { align: 'left' });
        return;
      }
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const [qa, yes, have, lit] = RS.SCENE.allergy, PA = { allergy: 'peanuts' };
        const B = staff(g, qa, { x: LX, y: 150, w: 800, at: 0.8, u, roleAt: 1.8, size: 24, shape: 'yn', shapeAt: 2.0 });
        answer(g, { x: LX, y: 150 + B.bh + 16, w: 800, A: yes, at: 2.4, u, size: 26, verdict: { ok: okOf(qa, yes, PA), at: 3.2 } });
        answer(g, { x: LX, y: 150 + B.bh + 96, w: 800, A: have, at: 4.0, u, size: 24, verdict: { ok: okOf(qa, have, PA), at: 4.8 } });
        fade(g, ramp(u, 6.0, 0.4), () => {
          answer(g, { x: LX, y: 150 + B.bh + 186, w: 800, A: lit, at: 6.2, u, size: 26, trapAt: 6.8, strikeAt: 6.9, tag: ['= 땅콩을 갖고 있어요', COL.trap, 7.2], tagX: LX + 10, tagY: 150 + B.bh + 212 });
          fade(g, ramp(u, 8.4, 0.4), () => pieces(g, [['allergic to ', 'frame'], ['peanuts', 'slot'], [' · a ', 'frame'], ['peanut', 'slot'], [' allergy', 'frame']], LX + 10, 150 + B.bh + 270, 20));
        });
        fade(g, ramp(u, 1.0, 0.5), () => { panel(g, 900, 150, 300, 300, { fill: COL.panel, stroke: COL.faint }); icon(g, 'allergy', 1050, 250, 90, COL.trap, 1.6); txt(g, 'peanuts · 땅콩', 1050, 350, { size: 20, weight: 800, color: COL.en, align: 'center' }); txt(g, 'allergic to + 성분', 1050, 384, { size: 16, weight: 700, color: COL.rel, align: 'center' }); });
      });
      const inB = win(u, 11.6, 22.6);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        const [qq, does] = RS.SCENE.ask, qs = RS.simQ('al_safe', D), wo = RS.SCENE.ask2;
        const B = staff(g, qq, { x: LX, y: 150, w: 780, at: 11.8, u, roleAt: 12.6, size: 20, shape: 'yn', shapeAt: 12.8 });
        answer(g, { x: LX, y: 150 + B.bh + 12, w: 780, A: does, at: 13.4, u, size: 22, verdict: { ok: true, at: 14.2 } });
        talk(g, { side: 'L', x: LX, y: 150 + B.bh + 82, w: 780, text: qs.en.replace(/^Thanks for letting me know\. /, 'Yes, it does. '), marks: [['walnuts', 'trap'], ['without them', 'ok']], kind: 'server', sp: 'us', at: 15.0, u, size: 20 });
        answer(g, { x: LX, y: 150 + B.bh + 200, w: 780, A: wo, at: 17.6, u, size: 24, verdict: { ok: RS.judge(qs, wo, D).ok, at: 18.4 } });
        const fx = RS.safeReply(['noodles'], 'peanuts');
        fade(g, ramp(u, 19.4, 0.4), () => { txt(g, '뺄 수 없으면 (땅콩 소스 국수 · 땅콩 알레르기) →', LX, 150 + B.bh + 290, { size: 15, weight: 700, color: COL.muted }); txt(g, fx.en, LX, 150 + B.bh + 318, { size: fit(g, fx.en, 18, 780, 600), weight: 600, color: COL.en }); say(LX, 150 + B.bh + 302, 780, 32, fx.en); });
        fade(g, ramp(u, 12.0, 0.5), () => menuDraw(g, 900, 150, 300, { hl: u >= 19.4 ? { salad: COL.accent, noodles: COL.bad } : { salad: COL.accent }, bad: u >= 19.4 ? 'peanuts' : 'nuts' }));
      });
      const inC = win(u, 22.8, 28.0);
      if (inC > 0.001 && u >= 22.6) fade(g, inC, () => {
        const [qs, not] = RS.SCENE.spicy, [qd, side] = RS.SCENE.side;
        const B = staff(g, qs, { x: LX, y: 160, w: 860, at: 23.0, u, roleAt: 23.6, size: 22, shape: 'or', shapeAt: 23.8 });
        answer(g, { x: LX, y: 160 + B.bh + 14, w: 860, A: not, at: 24.0, u, size: 24, verdict: { ok: true, at: 24.7 }, tag: ['not too spicy → 너무 맵지 않게', COL.rel, 25.0], tagX: LX + 10, tagY: 160 + B.bh + 40 });
        const y2 = 160 + B.bh + 110;
        staff(g, qd, { x: LX, y: y2, w: 860, at: 25.4, u, roleAt: 25.9, size: 22, shape: 'wh', shapeAt: 26.0 });
        answer(g, { x: LX, y: y2 + 66, w: 860, A: side, at: 26.4, u, size: 24, verdict: { ok: true, at: 27.0 }, tag: ['on the side → 따로', COL.rel, 27.2], tagX: LX + 10, tagY: y2 + 92 });
      });
      if (u >= 28.0) fade(g, ramp(u, 28.2, 0.4), () => {
        panel(g, LX, 170, 1120, 300, { fill: COL.panel, stroke: COL.trap, lw: 2 });
        icon(g, 'allergy', LX + 100, 320, 110, COL.trap, 1.6);
        txt(g, '알레르기가 있으면', LX + 220, 236, { size: 26, weight: 800, fam: FD });
        txt(g, '메뉴 표시만 믿지 말고 직원에게 직접 말해요.', LX + 220, 284, { size: 26, weight: 800, fam: FD, color: COL.accent });
        fade(g, ramp(u, 29.4, 0.4), () => pieces(g, [['I\'m allergic to ', 'frame'], ['peanuts', 'slot'], ['. ', 'frame'], ['Does the ', 'frame'], ['house salad', 'slot'], [' have ', 'frame'], ['nuts', 'slot'], [' in it?', 'frame']], LX + 220, 346, 22));
        fade(g, ramp(u, 30.6, 0.4), () => { txt(g, '이 튜토리얼은 말하기 연습이에요. 의학적인 조언이 아니에요.', LX + 220, 404, { size: 18, weight: 700, color: COL.soft }); txt(g, '메뉴 · 재료는 지어낸 것이고, 실제 식당의 재료는 그곳 직원에게 확인해요.', LX + 220, 436, { size: 16, weight: 600, color: COL.muted }); });
      });
    },

    /* 06 식사 중: Excuse me → Hey · Waiter · Here × → How is everything → 부탁 → 다른 음식 → 사실 + 내가 시킨 것 */
    meal(g, u) {
      const D = RS.DEMO;
      if (S.call) {
        const a = S.call.a, q = RS.Q.ml_pass, j = RS.judge(q, a, { need: S.call.need }, '상황');
        staff(g, q, { x: LX, y: 150, w: 900, all: true, u: 99, size: 22, shape: 'note' });
        txt(g, '(서버가 옆 테이블에 인사하며 지나가요)', LX + 66, 222, { size: 15, weight: 600, color: COL.muted });
        const L = lay(g, ansToks(a), { x: W / 2, y: 300, size: 30, align: 'center', maxW: 1080 });
        drawLay(g, L); mark(g, j.ok, Math.min(1226, L.x + L.w + 30), 300, 20); say(L.x, 274, L.w, 52, RS.text(a));
        whyLine(g, j, 380);
        tag(g, `필요한 것 → ${RS.factKo('need', S.call.need)}`, W / 2, 480, COL.clause, { align: 'center', size: 18, h: 40 });
        return;
      }
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const q = RS.Q.ml_pass, [ex, hey, waiter, here] = RS.SCENE.call;
        // 옆 테이블 · 지나가는 서버
        fade(g, ramp(u, 0.4, 0.5), () => { panel(g, 900, 150, 300, 230, { fill: COL.panel, stroke: COL.faint }); table(g, 1000, 300, 34, false); table(g, 1120, 230, 24, true); avatar(g, 1150, 300, 26, 'server', { sp: 'us' }); icon(g, 'hand', 1060, 224, 40, COL.clause, 1.8); txt(g, '눈을 맞추거나 손을 살짝', 1050, 356, { size: 14, weight: 700, color: COL.muted, align: 'center' }); });
        const B = staff(g, q, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shape: 'note', shapeAt: 1.8 });
        fade(g, ramp(u, 1.8, 0.4), () => txt(g, '(옆 테이블에) → 서버가 가까이 있어요. 이제 내가 부를 차례', LX + 66, 150 + B.bh + 20, { size: 15, weight: 700, color: COL.verb }));
        answer(g, { x: LX, y: 150 + B.bh + 40, w: 780, A: ex, at: 2.8, u, size: 22, verdict: { ok: true, at: 3.6 } });
        [[hey, 6.2, 'Hey! → 친구를 부르는 말'], [waiter, 7.6, 'Waiter! → 큰 소리로 부르면 무례'], [here, 9.0, 'Here! → ‘여기요’ 그대로 · 엉뚱해요']].forEach(([a, at, t], i) => {
          const y = 150 + B.bh + 120 + i * 66;
          answer(g, { x: LX, y, w: 480, A: a, at, u, size: 22, trapAt: at + 0.4, strikeAt: at + 0.5, tag: [t, COL.trap, at + 0.7], tagX: LX + 500, tagY: y + 26 });
        });
        fade(g, ramp(u, 10.2, 0.4), () => tag(g, '박수 · 큰 소리 × · 나라마다 달라요', 1200, 420, COL.muted, { align: 'right', size: 14, h: 28 }));
      });
      const inB = win(u, 11.6, 17.0);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        const [qh, yes, great] = RS.SCENE.how;
        const B = staff(g, qh, { x: LX, y: 170, w: 900, at: 11.8, u, roleAt: 12.4, size: 28, shape: 'wh', shapeAt: 12.6 });
        answer(g, { x: LX, y: 170 + B.bh + 26, w: 900, A: yes, B: great, p: (u - 14.4) / 0.8, at: 13.0, u, size: 30, trapAt: 13.5, strikeAt: 13.6, verdict: u >= 15.4 ? { ok: true, at: 15.4 } : null, tag: ['How is … → 어떤지 묻는 정보 질문', COL.trap, 13.8, 14.4], tagY: 170 + B.bh + 120 });
        fade(g, ramp(u, 15.8, 0.4), () => shapeTag(g, 'wh', LX + 66, 170 + B.bh + 130, { text: '정보 질문 → 어떤지(정보) + thank you' }));
      });
      const inC = win(u, 17.2, 22.6);
      if (inC > 0.001 && u >= 17.0) fade(g, inC, () => {
        const qw = RS.Q.ml_what, [w1, p2] = RS.SCENE.reqs;
        const B = staff(g, qw, { x: LX, y: 160, w: 860, at: 17.4, u, roleAt: 17.9, size: 22, shape: 'wh', shapeAt: 18.0 });
        [[w1, 'water', 18.6], [p2, 'plate', 20.2]].forEach(([a, ic, at], i) => {
          const y = 160 + B.bh + 24 + i * 92;
          const A = answer(g, { x: LX, y, w: 860, A: a, at, u, size: 26, verdict: { ok: true, at: at + 0.7 } });
          fade(g, ramp(u, at - 0.2, 0.4), () => { circ(g, A.bx - 62, y + A.bh / 2, 22, COL.panel2); icon(g, ic, A.bx - 62, y + A.bh / 2, 24, COL.soft); });
        });
        fade(g, ramp(u, 21.4, 0.4), () => tag(g, '부탁은 질문으로 → Could I …? · Could we …?', LX + 10, 470, COL.verb, { align: 'left' }));
      });
      if (u >= 22.6) fade(g, ramp(u, 22.8, 0.4), () => {
        const qd = RS.simQ('ml_dish', D), [wrong, ok] = RS.SCENE.dish;
        const B = staff(g, qd, { x: LX, y: 160, w: 780, at: 23.0, u, roleAt: 23.8, size: 22, shape: 'note', shapeAt: 24.0 });
        const A = answer(g, { x: LX, y: 160 + B.bh + 20, w: 780, A: wrong, B: u >= 28.6 ? ok : null, p: (u - 28.6) / 0.9, at: 25.2, u, size: 22, trapAt: 25.8, strikeAt: 25.9, verdict: u >= 30.0 ? { ok: true, at: 30.0 } : null, tag: ['따지는 말처럼 들려요', COL.trap, 26.2, 28.6], tagY: 160 + B.bh + 100 });
        fade(g, ramp(u, 30.4, 0.4), () => talk(g, { side: 'L', x: LX, y: 160 + B.bh + 120, w: 780, text: RS.reply(RS.Q.ml_dish, ok, D), marks: [['right away', 'ok']], kind: 'runner', sp: 'ca', at: 30.6, u, size: 20 }));
        fade(g, ramp(u, 31.8, 0.4), () => pieces(g, [['사실', 'slot'], [' (내가 시킨 게 아님) + ', ''], ['내가 시킨 것', 'slot']], LX, 520, 20));
        fade(g, ramp(u, 23.2, 0.5), () => {
          panel(g, 880, 150, 320, 400, { fill: COL.panel, stroke: COL.faint });
          txt(g, '나온 음식', 1040, 176, { size: 15, weight: 700, color: COL.trap, align: 'center' });
          plateDraw(g, 1040, 262, 70, D.served); txt(g, RS.MENU[D.served].en, 1040, 352, { size: 17, weight: 700, color: COL.trap, align: 'center' });
          rr(g, 920, 384, 240, 140, 8); g.fillStyle = COL.paper; g.fill();
          txt(g, 'ORDER · TABLE 12', 1040, 404, { size: 12, weight: 700, fam: FM, color: '#5B6168', align: 'center' });
          txt(g, `1  ${RS.MENU[D.dish].en}`, 936, 434, { size: 14, weight: 700, fam: FM, color: '#1F7A55' }); txt(g, '   medium-rare · salad', 936, 456, { size: 12, weight: 600, fam: FM, color: '#5B6168' });
          txt(g, `1  ${RS.MENU[D.others[0]].en}`, 936, 484, { size: 14, weight: 700, fam: FM, color: COL.ink }); txt(g, '   (친구 주문)', 936, 506, { size: 12, weight: 600, color: '#5B6168' });
        });
      });
    },

    /* 07 디저트와 계산: box → dessert → Calculate × → check · bill → together or separate → 나눈 값 → card · 팁 */
    pay(g, u) {
      const D = S.bill || RS.DEMO;
      if (S.bill) {
        const q = RS.simQ('ck_pay', D), B = RS.bill(D);
        talk(g, { side: 'L', x: LX, y: 150, w: 760, text: q.en, marks: [[RS.money(q.fact.amount), 'key'], ['Card or cash', 'key']], kind: 'server', sp: 'us', all: true, u: 99, size: 22 });
        txt(g, '읽기 →', LX, 270, { size: 16, weight: 700, color: COL.muted });
        txt(g, RS.priceWords(q.fact.amount) + (q.each ? ' each' : ''), LX, 302, { size: fit(g, RS.priceWords(q.fact.amount), 26, 700, 700), weight: 700, color: COL.en });
        say(LX, 282, 720, 40, q.en);
        if (D.party > 1) { const m = RS.model('ck_split', D), j = RS.judge('ck_split', m, D); txt(g, 'Together or separate? →', LX, 370, { size: 16, weight: 700, color: COL.muted }); answer(g, { x: LX, y: 390, w: 760, A: m, all: true, u: 99, size: 22, verdict: { ok: j.ok, at: -1 } }); }
        checkDraw(g, 880, 150, 320, D, { hl: D.party > 1 && D.pay === 'separate' ? { each: COL.accent } : { total: COL.accent } });
        void B;
        return;
      }
      fade(g, 1 - ramp(u, 5.8, 0.4), () => {
        const [qd, box, take] = RS.SCENE.done;
        const B = staff(g, qd, { x: LX, y: 160, w: 860, at: 0.8, u, roleAt: 1.6, size: 24, shape: 'yn', shapeAt: 1.8 });
        answer(g, { x: LX, y: 160 + B.bh + 18, w: 860, A: box, at: 2.4, u, size: 22, verdict: { ok: true, at: 3.2 } });
        fade(g, ramp(u, 3.8, 0.4), () => { answer(g, { x: LX, y: 160 + B.bh + 100, w: 860, A: take, at: 3.9, u, size: 22, verdict: { ok: true, at: 4.4 }, tag: ['take out → 통해요 · 남은 음식은 보통 a box', COL.rel, 4.6], tagX: LX + 10, tagY: 160 + B.bh + 126 }); });
        fade(g, ramp(u, 2.6, 0.5), () => { boxDraw(g, 1080, 470, 0.9); txt(g, 'a box (포장 그릇)', 1080, 500, { size: 16, weight: 700, color: COL.clause, align: 'center' }); });
      });
      const inB = win(u, 6.0, 12.0);
      if (inB > 0.001 && u >= 5.8) fade(g, inB, () => {
        const [qo, calc, no] = RS.SCENE.dessert;
        const B = staff(g, qo, { x: LX, y: 160, w: 860, at: 6.2, u, roleAt: 7.0, size: 24, shape: 'yn', shapeAt: 7.2 });
        answer(g, { x: LX, y: 160 + B.bh + 20, w: 860, A: no, at: 7.8, u, size: 26, verdict: { ok: true, at: 8.6 } });
        fade(g, ramp(u, 9.4, 0.4), () => { const c = chip(g, 'Just the bill, please.', LX + 230, 160 + B.bh + 130, { size: 17, weight: 700, color: COL.rel, fill: COL.panel2, stroke: 'rgba(242,194,154,0.5)', h: 34 }); txt(g, '영국에서는 →', LX + 10, 160 + B.bh + 130, { size: 15, weight: 700, color: COL.muted }); say(c.x, c.y, c.w, c.h, 'Just the bill, please.'); });
        fade(g, ramp(u, 6.6, 0.5), () => { panel(g, 960, 170, 240, 270, { fill: COL.panel, stroke: COL.faint }); icon(g, 'dessert', 1080, 270, 90, COL.soft, 1.6); txt(g, 'dessert', 1080, 370, { size: 18, weight: 700, color: COL.en, align: 'center' }); txt(g, 'interest you in → 드시겠어요?', 1080, 402, { size: 13, weight: 600, color: COL.muted, align: 'center' }); });
        void calc;
      });
      const inC = win(u, 12.2, 18.0);
      if (inC > 0.001 && u >= 12.0) fade(g, inC, () => {
        const [qe, calc, could, bill] = RS.SCENE.check;
        thought(g, '(한국어로) 계산해 주세요', LX, 160, 360);
        answer(g, { x: LX, y: 232, w: 860, A: calc, B: u >= 15.0 ? could : null, p: (u - 15.0) / 0.8, at: 12.6, u, size: 28, trapAt: 13.2, strikeAt: 13.3, verdict: u >= 16.0 ? { ok: true, at: 16.0 } : null, tag: ['calculate → 셈하기', COL.trap, 13.6, 15.0], tagY: 232 + 82 });
        fade(g, ramp(u, 16.2, 0.4), () => tag(g, '많은 곳에서 테이블에서 계산해요 · 나라마다 달라요', LX + 10, 360, COL.muted, { align: 'left', size: 15, h: 30 }));
        fade(g, ramp(u, 12.8, 0.5), () => { panel(g, 960, 170, 240, 300, { fill: COL.panel, stroke: COL.faint }); fade(g, 1 - ramp(u, 15.0, 0.4), () => { icon(g, 'calc', 1080, 290, 110, COL.trap, 1.4); cross(g, 1080, 290, 120, COL.bad); }); fade(g, ramp(u, 15.2, 0.4), () => folder(g, 1080, 300, 0.9)); });
        void qe; void bill;
      });
      const inD = win(u, 18.2, 24.0);
      if (inD > 0.001 && u >= 18.0) fade(g, inD, () => {
        const [qs, dutch, sep, split] = RS.SCENE.split;
        const B = staff(g, qs, { x: LX, y: 160, w: 860, at: 18.4, u, roleAt: 19.2, size: 24, shape: 'or', shapeAt: 19.4 });
        answer(g, { x: LX, y: 160 + B.bh + 18, w: 860, A: dutch, B: u >= 21.6 ? sep : null, p: (u - 21.6) / 0.7, at: 19.8, u, size: 28, trapAt: 20.4, strikeAt: 20.5, verdict: u >= 22.4 ? { ok: true, at: 22.4 } : null, tag: ['더치페이 → 한국에서 만든 말', COL.trap, 20.8, 21.6], tagY: 160 + B.bh + 104 });
        fade(g, ramp(u, 22.8, 0.4), () => answer(g, { x: LX, y: 160 + B.bh + 120, w: 860, A: split, at: 22.8, u, size: 24, verdict: { ok: true, at: 23.4 } }));
        fade(g, ramp(u, 18.6, 0.5), () => { panel(g, 960, 170, 240, 270, { fill: COL.panel, stroke: COL.faint }); icon(g, 'people', 1080, 270, 90, COL.soft, 1.6); txt(g, 'separate · split', 1080, 370, { size: 18, weight: 700, color: COL.clause, align: 'center' }); txt(g, '나눠 내기', 1080, 400, { size: 14, weight: 600, color: COL.muted, align: 'center' }); });
      });
      const inE = win(u, 24.2, 29.0);
      if (inE > 0.001 && u >= 24.0) fade(g, inE, () => {
        const q = RS.simQ('ck_pay', D);
        talk(g, { side: 'L', x: LX, y: 170, w: 760, text: q.en, marks: [[RS.money(q.fact.amount), 'key'], ['each', 'key']], kind: 'server', sp: 'us', at: 24.6, u, roleAt: 25.6, size: 24 });
        fade(g, ramp(u, 26.0, 0.4), () => { txt(g, `→ ${RS.priceWords(q.fact.amount)} each`, LX + 66, 290, { size: 24, weight: 700, color: COL.en }); txt(g, `합계 ${RS.money(q.total)} ÷ 2명 = ${RS.money(q.fact.amount)}`, LX + 66, 330, { size: 18, weight: 700, color: COL.muted }); });
        fade(g, ramp(u, 24.2, 0.5), () => checkDraw(g, 880, 150, 320, D, { shown: (u - 24.6) / 0.5, hl: u >= 26.4 ? { each: COL.accent } : {} }));
      });
      if (u >= 29.0) fade(g, ramp(u, 29.2, 0.4), () => {
        const q = RS.simQ('ck_pay', D), card = RS.SCENE.pay;
        talk(g, { side: 'L', x: LX, y: 170, w: 760, text: 'Card or cash?', marks: [['Card or cash', 'key']], kind: 'server', sp: 'us', all: true, u: 99, size: 26, shape: 'or' });
        answer(g, { x: LX, y: 260, w: 760, A: card, at: 29.6, u, size: 28, verdict: { ok: RS.judge(q, card, D).ok, at: 30.2 } });
        const st = u < 31.4 ? 'tap' : 'tip';
        fade(g, ramp(u, 29.4, 0.5), () => { reader(g, 980, 170, { amount: RS.money(q.fact.amount), state: st }); if (st === 'tip') fade(g, ramp(u, 31.4, 0.4), () => { txt(g, '팁 화면', 1176, 456, { size: 15, weight: 700, color: COL.accent, align: 'right' }); }); });
        fade(g, ramp(u, 31.6, 0.4), () => { panel(g, LX, 380, 840, 96, { fill: COL.panel, stroke: 'rgba(242,194,154,0.45)' }); txt(g, '팁(tip)', LX + 20, 410, { size: 18, weight: 800, color: '#F2C29A' }); txt(g, RS.TIP_NOTE, LX + 20, 446, { size: fit(g, RS.TIP_NOTE, 17, 800, 600), weight: 600, color: COL.soft }); });
      });
    },

    /* 08 한 번에 주문하기: 짧게 → 네 번 주고받기 → 한 줄 주문 → 건너뛴 질문 → 알레르기까지 · 순서가 어색하면 → 4 → 1 */
    oneline(g, u) {
      const lab = !!S.line, L = S.line || RS.LINE, a = { f: 'line', line: L }, C = lab ? {} : RS.DEMO;
      if (!lab) fade(g, ramp(u, 0.4, 0.4) * (1 - ramp(u, 11.2, 0.4)), () => {
        txt(g, '짧게 주문하면 → 네 번 주고받기', LX, 166, { size: 20, weight: 700, color: COL.soft });
        RS.SHORT.forEach(([qid, ans], i) => {
          const y = 198 + i * 72, at = 0.8 + i * 1.4, q = RS.Q[qid];
          fade(g, ramp(u, at, 0.4), () => { circ(g, LX + 6, y + 24, 16, COL.panel2); txt(g, String(i + 1), LX + 6, y + 25, { size: 15, weight: 700, fam: FM, color: COL.accent, align: 'center' }); });
          talk(g, { side: 'L', x: LX + 30, y, w: 600, text: q.short && /\?$/.test(q.short) ? q.short : q.en, marks: Qm(q), kind: 'server', sp: 'us', at, u, roleAt: at + 0.5, size: 20, shape: q.shape, shapeAt: at + 0.5 });
          answer(g, { x: 680, y, w: 520, A: ans, at: at + 0.8, u, size: 21, verdict: { ok: true, at: at + 1.2 } });
        });
        fade(g, ramp(u, 6.4, 0.4), () => tag(g, '주고받기 4번', 1200, 500, COL.trap, { align: 'right' }));
        fade(g, ramp(u, 8.6, 0.4), () => txt(g, '한 줄에 순서대로 넣으면?', LX, 500, { size: 22, weight: 800, fam: FD, color: COL.accent }));
      });
      const segs = RS.segs(a);
      if (lab || u >= 11.4) fade(g, lab ? 1 : ramp(u, 11.4, 0.4) * (1 - ramp(u, 22.8, 0.3)), () => {
        txt(g, '순서 → 음식 → 굽기 → with 곁들임 → 드레싱 → please', LX, 160, { size: 18, weight: 700, color: COL.muted });
        const toks = ansToks(a), Ly = lay(g, toks, { x: LX, y: 236, size: 26, maxW: 1120, lh: 76 });
        const segOf = [];
        segs.forEach(s => s.t.split(/\s+/).filter(Boolean).forEach(w => { const m = w.match(/^(.*?)([.,?!]*)$/); if (m[1]) segOf.push(s); if (m[2]) m[2].split('').forEach(() => segOf.push(s)); }));
        let lastPart = null;
        Ly.items.forEach((it, k) => {
          const sg = segOf[k] || {}, on = lab || u >= 11.8 + k * 0.28;
          fade(g, on ? ramp(u, lab ? -9 : 11.8 + k * 0.28, 0.3) : 0, () => {
            drawTok(g, it, { next: Ly.items[k + 1] });
            if (sg.part && sg.part !== lastPart && !PUNCT.test(it.t)) { const cat = RS.OCAT[sg.part]; if (cat) txt(g, cat.ko, it.x, it.y - 34, { size: 14, weight: 700, color: PART_COL[sg.part] || COL.soft }); }
          });
          lastPart = sg.part && !PUNCT.test(it.t) ? sg.part : PUNCT.test(it.t) ? lastPart : null;
        });
        say(Ly.x, 210, Ly.w, 52 + (Ly.lines - 1) * 76, RS.text(a));
        if (lab) {
          const j = RS.judge('or_ready', a, C, '상황');
          const lastIt = Ly.items[Ly.items.length - 1];
          mark(g, j.ok, Math.min(1226, (lastIt ? lastIt.x + lastIt.w : LX) + 26), 236 + (Ly.lines - 1) * 76, 18);
          const R = richLay(g, why2(j), [], 17, 1120, { weight: 600 }); richDraw(g, R, LX, 300 + (Ly.lines - 1) * 76, { color: j.ok ? COL.good : COL.trap });
        } else fade(g, ramp(u, 16.6, 0.3), () => { const lastIt = Ly.items[Ly.items.length - 1]; mark(g, true, lastIt.x + lastIt.w + 26, lastIt.y, 18); });
      });
      if (lab) {
        const j = RS.judge('or_ready', a, C, '상황'), cov = j.ok ? RS.coveredKo(RS.covered(a, 'or_ready')) : [];
        txt(g, j.ok ? (cov.length ? `서버가 건너뛸 질문 → ${cov.join(' · ')}` : '음식만 말했으니 서버가 굽기 · 곁들임을 차례로 물어요') : '', LX, 548, { size: 18, weight: 700, color: cov.length ? COL.good : COL.soft });
        return;
      }
      // 서버의 대답과 건너뛴 질문
      if (u >= 17.4) fade(g, ramp(u, 17.6, 0.4) * (1 - ramp(u, 22.8, 0.3)), () => {
        talk(g, { side: 'L', x: LX, y: 386, w: 520, text: 'Great choice.', marks: [['Great choice', 'ok']], kind: 'server', sp: 'us', at: 17.8, u, size: 24 });
        ['or_cook', 'or_side', 'or_dress'].forEach((qid, i) => fade(g, ramp(u, 19.0 + i * 0.6, 0.4), () => {
          const y = 412 + i * 52, q = RS.Q[qid], t = q.short;
          const R = richLay(g, t, Qm(q), 19, 400, { weight: 500 });
          panel(g, 640, y - 21, R.w + 40, 42, { fill: COL.panel, stroke: COL.faint, r: 21 });
          richDraw(g, R, 660, y, { color: COL.dim, rolesOn: false });
          const p = clamp((u - 19.4 - i * 0.6) / 0.4); g.strokeStyle = COL.good; g.lineWidth = 2.6; g.beginPath(); g.moveTo(654, y + 1); g.lineTo(654 + (R.w + 12) * p, y + 1); g.stroke();
          chip(g, '건너뜀', 640 + R.w + 54, y, { size: 14, weight: 700, color: '#10151C', fill: COL.good, h: 26, r: 13 });
        }));
      });
      if (u >= 22.8) fade(g, ramp(u, 23.0, 0.4) * (1 - ramp(u, 28.0, 0.3)), () => {
        const al = { f: 'line', line: RS.LINE_ALLERGY }, bad = { f: 'line', line: RS.LINE_BAD }, ord = RS.orderLine(RS.LINE_BAD);
        txt(g, '알레르기도 한 줄 끝에', LX, 166, { size: 20, weight: 700, color: COL.soft });
        answer(g, { x: LX, y: 190, w: 1120, A: al, at: 23.2, u, size: 22, maxW: 960, verdict: { ok: true, at: 24.0 } });
        fade(g, ramp(u, 24.6, 0.4), () => txt(g, '순서가 어색하면', LX, 330, { size: 20, weight: 700, color: COL.soft }));
        answer(g, { x: LX, y: 354, w: 1120, A: bad, at: 24.8, u, size: 24, trapAt: 25.6, strikeAt: 25.7 });
        fade(g, ramp(u, 26.2, 0.4), () => { const R = richLay(g, ord.why, [], 16, 1100, { weight: 600 }); richDraw(g, R, LX, 448, { color: COL.trap }); });
      });
      if (u >= 28.0) fade(g, ramp(u, 28.2, 0.5), () => {
        txt(g, '스테이크 주문에 주고받는 횟수', W / 2, 172, { size: 22, weight: 700, color: COL.soft, align: 'center' });
        const big = (n, x, c, l) => { txt(g, String(n), x, 300, { size: 120, weight: 800, fam: FD, color: c, align: 'center' }); txt(g, l, x, 392, { size: 20, weight: 700, color: COL.soft, align: 'center' }); };
        big(4, 380, COL.muted, '짧게 주문하면');
        arrow(g, 500, 290, 760, 290, COL.accent, 4);
        big(1, 880, COL.good, '한 줄로 주문하면');
        fade(g, ramp(u, 29.6, 0.4), () => tag(g, '순서 규칙 = 자주 쓰는 순서를 단순하게 줄인 것', W / 2, 480, COL.muted, { align: 'center', size: 16 }));
      });
    },

    /* 09 3단계 말하기 법: 상자 셋 + 곳마다 한 줄(모양 표시와 함께)이 단계별로 채워짐 */
    method(g, u) {
      const BOX = [['①', '열쇠 낱말 + 모양', 'or → 고르기 · how → 정보 · Are you → Y/N', COL.ante, 5.5], ['②', '틀에 내 정보 넣기', 'Two, please. · allergic to + 성분', COL.rel, 11.5], ['③', '공손하게 끝내기', 'please · thank you · Excuse me', COL.verb, 17.5]];
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
      RS.METHOD.forEach(([qid, a], i) => {
        const y = 300 + i * 39, q = RS.Q[qid], p = RS.PLACE[q.place], dim = sel != null && sel !== i;
        fade(g, ramp(u, 1.4 + i * 0.3, 0.4) * (dim ? 0.35 : 1), () => {
          if (sel === i) { rr(g, LX - 6, y - 18, 1132, 36, 8); g.fillStyle = 'rgba(255,193,94,0.10)'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 1.5; g.stroke(); }
          circ(g, LX + 14, y, 15, COL.panel2); icon(g, p.id, LX + 14, y, 18, ME_FIRST[p.id] ? COL.verb : COL.soft);
          const keysOn = sel != null || u >= 6.0 + i * 0.3, ansOn = sel != null || u >= 12.0 + i * 0.4, polOn = sel != null || u >= 18.0;
          if (keysOn) shapeMark(g, q.shape, LX + 50, y, 16, { disc: false, iw: 2.2 });
          const t = q.short && /\?$|!$/.test(q.short) ? q.short : q.en;
          const R = richLay(g, t, keysOn ? Qm(qid) : [], 17, 430, { weight: 500 });
          richDraw(g, R, LX + 70, y, { color: COL.soft });
          say(LX + 66, y - 16, R.w + 8, 32, q.en);
          if (ansOn) fade(g, sel != null ? 1 : ramp(u, 12.0 + i * 0.4, 0.4), () => {
            txt(g, '→', 566, y, { size: 18, weight: 700, color: COL.muted });
            pieces(g, ansParts(a).map(([tt, r]) => [tt, r === 'pol' && !polOn ? 'frame' : r]), 598, y, 18, 600);
            say(594, y - 16, 606, 32, RS.text(a));
          });
        });
      });
    },

    /* 10 실전: 식사 카드 하나로 넷 */
    practice(g, u) {
      const pi = u < PSEG[1] ? 0 : u < PSEG[2] ? 1 : u < PSEG[3] ? 2 : 3, v = u - PSEG[pi];
      const P = RS.PRACTICE[pi], C = RS.PCARD, q = RS.practiceQ(P);
      const a = ramp(v, 0, 0.5) * (pi < 3 ? 1 - ramp(u, PSEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `대화 ${pi + 1} / 4 · ${RS.PLACE[q.place].ko}`, LX, 150, { size: 16, weight: 500, fam: FM, color: COL.accent });
        dineCard(g, LX, 172, 330, C, { rh: 30, skip: [2, 5, 6, 7], hl: { d_seat: 1, or_cook: 3, ml_dish: 3, ck_split: 8 }[P.q] });
        talk(g, { side: 'L', x: 432, y: 172, w: 768, text: q.en, marks: Qm(q), kind: kindOf(q), sp: q.sp, at: PT.q, u: v, roleAt: PT.lines[0] + 0.4, size: 22, shape: q.shape, shapeAt: PT.lines[0] + 0.4 });
        const J = P.opts.map(o => RS.judge(q, o, C));
        const goneAt = k => { const s = J[k].stage; if (!s) return null; const same = P.opts.map((_, i) => i).filter(i => J[i].stage === s); return [0, PT.s1, PT.s2, PT.s3][s] + same.indexOf(k) * 1.1; };
        P.opts.forEach((o, k) => {
          const y = 262 + k * 60, gA = goneAt(k), won = k === P.a && v >= PT.win;
          fade(g, ramp(v, PT.opt[k], 0.4), () => {
            if (won) { rr(g, 432, y - 24, 768, 48, 10); g.fillStyle = 'rgba(127,224,168,0.08)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
            txt(g, `(${'ABC'[k]})`, 446, y, { size: 18, weight: 500, fam: FM, color: gA != null && v >= gA ? COL.dim : COL.muted });
            const gone = gA != null && v >= gA;
            const parts = ansParts(o).map(([t, r]) => [t, gone ? 'dim' : (v >= PT.lines[1] + 0.4 || won) ? r : '']);
            const w = pieces(g, parts, 494, y, 19, 560, { color: gone ? COL.dim : COL.text });
            say(490, y - 18, w + 10, 36, RS.text(o));
            if (gone) { const p = clamp((v - gA) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(440, y + 1); g.lineTo(440 + (w + 64) * p, y + 1); g.stroke();
              fade(g, ramp(v, gA + 0.3, 0.3), () => tag(g, `${['', '①', '②', '③'][J[k].stage]} 탈락`, 1180, y, COL.trap, { align: 'right', size: 15, h: 30 })); }
            if (won) mark(g, true, 1170, y, 17);
          });
        });
        if (pi === 3) fade(g, ramp(v, PT.win, 0.4), () => { const B = RS.bill(C), each = RS.split(B, C.party).each; tag(g, `합계 ${RS.money(B.total)} → That's ${RS.money(each)} each.`, 1200, 431, COL.ante, { align: 'right', size: 15, h: 28 }); });
        if (pi === 2) fade(g, ramp(v, 3.0, 0.4), () => tag(g, `나온 음식 ${RS.MENU[C.served].en} · 카드 ${RS.MENU[C.dish].en}`, 1200, 431, COL.ante, { align: 'right', size: 15, h: 28 }));
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
        ['door', '입구 · 자리', 'yn', 'reservation · how many · inside or outside', [['Yes, under ', 'frame'], ['Park', 'slot'], ['. · ', 'frame'], ['Two', 'slot'], [', ', 'frame'], ['please', 'pol'], ['. · ', 'frame'], ['Outside', 'slot'], [', ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        ['drinks', '음료', 'or', 'still or sparkling · something to drink', [['Sparkling', 'slot'], [', ', 'frame'], ['please', 'pol'], ['. · Just water, ', 'frame'], ['please', 'pol'], ['. · a lemon-lime soda', 'slot']]],
        ['order', '주문', 'wh', 'ready to order · how would you like', [['I\'ll have the ', 'frame'], ['ribeye steak', 'slot'], [', ', 'frame'], ['please', 'pol'], ['. · ', 'frame'], ['Medium-rare', 'slot'], [', ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        ['allergy', '알레르기 · 요청', 'yn', 'allergies · (내가 먼저) Does it have …?', [['I\'m allergic to ', 'frame'], ['peanuts', 'slot'], ['. · Does the ', 'frame'], ['house salad', 'slot'], [' have ', 'frame'], ['nuts', 'slot'], [' in it?', 'frame']]],
        ['meal', '식사 중', 'note', 'How is everything · (내가 먼저) 부르기', [['Excuse me', 'pol'], ['. ', 'frame'], ['Could I', 'pol'], [' get ', 'frame'], ['some more water', 'slot'], [', ', 'frame'], ['please', 'pol'], ['? · Great, ', 'frame'], ['thank you', 'pol'], ['.', 'frame']]],
        ['dessert', '디저트 · 포장', 'yn', 'still working on · some dessert', [['Could I', 'pol'], [' get a box for this? · No, ', 'frame'], ['thanks', 'pol'], ['. Just the check, ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        ['check', '계산', 'or', 'together or separate · card or cash', [['Separate', 'slot'], [', ', 'frame'], ['please', 'pol'], ['. · ', 'frame'], ['Could we', 'pol'], [' get the check? · ', 'frame'], ['Card', 'slot'], [', ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        [null, '한 줄 주문', null, '음식 → 굽기 → with 곁들임 → please', [['I\'ll have the ', 'frame'], ['ribeye steak', 'slot'], [', ', 'frame'], ['medium-rare', 'slot'], [', with ', 'frame'], ['a salad', 'slot'], [', ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        [null, '못 알아들었을 때', null, '빠른 말 · 숫자 · 모르는 낱말', [['Sorry', 'pol'], [', did you say ', 'frame'], ['fifteen', 'slot'], [' minutes? · ', 'frame'], ['Sorry', 'pol'], [', still or sparkling?', 'frame']]],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 10, { fill: COL.panel, stroke: COL.faint });
        ['곳', '열쇠 낱말 · 모양', '대답 틀'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 16, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 6, 1120, 1);
      });
      rows.forEach(([pid, nm, sh, keys, ans], ri) => fade(g, ramp(u, 1.0 + ri * 0.4, 0.5), () => {
        const y = Y0 + RH * (ri + 1) + 14;
        circ(g, X[0] + 32, y, 15, COL.panel2);
        if (pid) icon(g, pid, X[0] + 32, y, 18, ME_FIRST[pid] ? COL.verb : COL.soft);
        else txt(g, ri === 7 ? '+' : '?', X[0] + 32, y + 1, { size: 18, weight: 800, color: COL.verb, align: 'center' });
        txt(g, nm, X[0] + 58, y, { size: fit(g, nm, 18, X[1] - X[0] - 70, 700), weight: 700 });
        if (sh) shapeMark(g, sh, X[1] + 26, y, 15, { disc: false, iw: 2.2 });
        txt(g, keys, X[1] + (sh ? 44 : 20), y, { size: fit(g, keys, 15, X[2] - X[1] - (sh ? 56 : 34), 600), weight: 600, color: COL.ante });
        pieces(g, ans, X[2] + 20, y, 16.5, 1196 - X[2] - 30);
      }));
    },
  };

  // 시계 (가운데 cx, cy, 반지름 r, 분 → 바늘이 그만큼 돈 부채꼴)
  function clockFace(g, cx, cy, r, mins) {
    circ(g, cx, cy, r, '#E9EDF1'); ring(g, cx, cy, r, '#9AA6AA', 3);
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r * 0.86, -Math.PI / 2, -Math.PI / 2 + mins / 60 * Math.PI * 2); g.closePath(); g.fillStyle = 'rgba(255,193,94,0.45)'; g.fill();
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.strokeStyle = '#5B6168'; g.lineWidth = k % 3 ? 2 : 3.5; g.beginPath(); g.moveTo(cx + Math.sin(a) * r * 0.82, cy - Math.cos(a) * r * 0.82); g.lineTo(cx + Math.sin(a) * r * 0.92, cy - Math.cos(a) * r * 0.92); g.stroke(); }
    const am = mins / 60 * Math.PI * 2;
    g.strokeStyle = COL.ink; g.lineCap = 'round'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(am) * r * 0.74, cy - Math.cos(am) * r * 0.74); g.stroke();
    circ(g, cx, cy, 5, COL.red);
  }

  // 이어서 들리는 말: 위 = 쓰인 낱말 (이어지는 곳은 호), 아래 = 들리는 소리 (세게 = 크고 높게)
  function linked(g, L, x, y, u, at) {
    fade(g, ramp(u, at, 0.4), () => {
      const size = 28, gap = 22; let xx = x; const pos = [];
      L.words.forEach(w => { const ww = tw(g, w, size, 600); pos.push([xx, ww]); xx += ww + gap; });
      L.words.forEach((w, i) => { txt(g, w, pos[i][0], y, { size, weight: 600, color: COL.en }); });
      listen(x - 6, y - 24, xx - x, 48, [{ text: L.say || L.en, sp: 'au', rate: 1.2 }]);
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
      fade(g, ramp(u, at + 1.6, 0.4), () => txt(g, L.ko, x, sy + 28, { size: 17, weight: 600, color: COL.soft }));
    });
  }

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

  RSS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[RSS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    if (ch.place != null) strip(g, Array.isArray(ch.place) ? (u < (ch.placeAt || 6) ? ch.place[0] : ch.place[1]) : ch.place, ramp(u, 0.2, 0.5));
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, RSS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + RS.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔↗↘✓×÷?!~=+-–—/:…‘’\'%$';
  RSS.baseText = EXTRA;
  RSS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = RSS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { RSS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
