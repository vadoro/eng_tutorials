/* 쇼핑 회화 — 영상 장면
 *
 * SHS.render(g, t)는 시각 t와 사용자 상태 SHS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준, 내용은 y 580 위.
 *
 * 그림 말: 옷 가게 평면도(일곱 곳, 01장은 크게 · 03–08장은 위쪽 작은 띠), 질문의 모양 표시(스위치 · 갈림길 · 빈 상자 · 말풍선),
 * 말풍선(직원 왼쪽 · 나 오른쪽), 대답은 틀(노랑) + 내 정보(민트) 낱말 조각으로 만들고(lay · morph), 함정은 줄을 긋고 주황 이름표로 까닭을 붙여요.
 * 옷(물건 색으로 칠한 선 그림) · 옷걸이 · 값표 · 영수증 · 쇼핑 카드 · 탈의실 · 카드 단말기 · 쇼핑백 · 달력은 도형으로 그려요.
 * ‘손에 든 것 → 바라는 것’ 판(handWant)은 바꿀 점(크기 · 색)을 한눈에 보여 줘요. 값은 모두 grammar.js(SH.salePrice · SH.bill · SH.returnRule)로 계산해요.
 * 역할 색: 열쇠 낱말 하늘 · 대답 틀 노랑 · 내 정보(칸에 넣는 말) 민트 · 공손한 말 보라 · 함정 주황 · 빈칸 분홍 점선
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(SH.judge · SH.changeLine)으로 정합니다.
 * MP4에는 소리가 없어서, 말은 말풍선 속 낱말이 하나씩 나타나는 모습으로 그려요. 페이지에서는 말풍선을 누르면 그 사람 목소리로 들려줘요.
 */
(function () {
  'use strict';
  const SH = window.SH;
  const SHS = (window.SHS = {});
  const W = 1280, H = 720;
  SHS.W = W; SHS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  SHS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', paper: '#F4F1E8', ink: '#1E2630', teal: '#2F4A44', wood: '#3A2E25', red: '#B8432B',
  };
  SHS.COL = COL;
  // 역할 → 색 (낱말 조각 · 말풍선 글)
  const RC = { key: COL.ante, frame: COL.rel, slot: COL.clause, pol: COL.verb, trap: COL.trap, ok: COL.good, dim: COL.dim, bad: COL.bad };
  SHS.RC = RC;
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8', me: '#F2C29A' };
  const SHC = { yn: COL.ante, or: COL.rel, wh: COL.clause, note: COL.verb };   // 모양 표시의 색
  SHS.SHC = SHC;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (SHS.S = { stop: null, line: null, shape: null, size: null, fit: null, price: null, bill: null, ret: null, place: null });
  SHS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  SHS.hits = () => HITS;

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
     [길, 's'(선) | 'f'(채움) | 'b'(옷 몸통: 캔버스는 물건 색으로 칠하고 테두리, HTML은 선)]
     곳 일곱 + 질문의 모양 넷(shape_yn 스위치 · shape_or 갈림길 · shape_wh 빈 상자 · shape_note 말풍선) + 옷 여덟
     ========================================================= */
  const TEE = 'M8.5 4 4 6.5 5.6 10.2 7.5 9.3V20h9V9.3l1.9.9L20 6.5 15.5 4c-.6 1.6-1.9 2.4-3.5 2.4S9.1 5.6 8.5 4z';
  const ICON = {
    door: [['M3.5 9.5h17l-1.5-5h-14z', 's'], ['M5 9.5V20.5h14V9.5', 's'], ['M10 20.5v-6h4v6', 's']],
    find: [['M4 10.5a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0z', 's'], ['M15.3 15.3 20.5 20.5', 's']],
    rack: [['M10 5.5a2 2 0 1 1 2 2v2', 's'], ['M12 9.5 3.5 16a1 1 0 0 0 .6 1.8h15.8a1 1 0 0 0 .6-1.8z', 's']],
    fit: [['M3.5 4h17', 's'], ['M6 4v16.5h4.5C9.2 14.5 9 9 10 4', 's'], ['M18 4v16.5h-4.5c1.3-6 1.5-11.5.5-16.5', 's']],
    price: [['M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.5 6.5a1.4 1.4 0 0 1-2 0z', 's'], ['M8 8h.01', 's']],
    pay: [['M4 11h16v9.5H4z', 's'], ['M6.5 11V6h7v5', 's'], ['M15.5 8.5h3V11', 's'], ['M7 14.5h.01M10 14.5h.01M13 14.5h.01M7 17.5h.01M10 17.5h.01M13 17.5h.01', 's'], ['M16 14.5h2', 's']],
    ret: [['M9 4.5 4.5 9 9 13.5', 's'], ['M4.5 9h10a5 5 0 0 1 0 10h-6', 's']],
    shape_yn: [['M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8z', 's'], ['M14.4 12a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0z', 'f']],
    shape_or: [['M12 21.5V14', 's'], ['M12 14 6 8M12 14l6-6', 's'], ['M6 8v4.4M6 8h4.4', 's'], ['M18 8v4.4M18 8h-4.4', 's']],
    shape_wh: [['M3.5 6.5h17v11h-17z', 's'], ['M8 14h8', 's']],
    shape_note: [['M4.5 5h15v10h-8l-4 3.8V15h-3z', 's'], ['M9 10h.01M12 10h.01M15 10h.01', 's']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z', 's'], ['M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6', 's']],
    hand: [['M8.5 20.5c-2-1.6-3.5-4-3.5-6.5v-2.5a1.3 1.3 0 0 1 2.6 0V13', 's'], ['M7.6 12.5V6a1.3 1.3 0 0 1 2.6 0v5.5M10.2 11V4.5a1.3 1.3 0 0 1 2.6 0V11M12.8 11V5.5a1.3 1.3 0 0 1 2.6 0V12M15.4 12V8a1.3 1.3 0 0 1 2.6 0v6c0 3.5-2 6.5-5.5 6.5h-4', 's']],
    clock: [['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', 's'], ['M12 7.5V12l3 2', 's']],
    people: [['M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM3.5 20a5.5 5.5 0 0 1 11 0', 's'], ['M16 11a2.6 2.6 0 1 0 0-5.2M15.5 14.2a5 5 0 0 1 5 5.3', 's']],
    bag: [['M5 8h14l-1 12.5H6z', 's'], ['M9 8V6.5a3 3 0 0 1 6 0V8', 's']],
    card: [['M3.5 6h17v12h-17z', 's'], ['M3.5 10h17', 's'], ['M6.5 14.5h4', 's']],
    cash: [['M3 7h18v10H3z', 's'], ['M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0z', 's'], ['M6 10v4M18 10v4', 's']],
    receipt: [['M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z', 's'], ['M9 8h6M9 11.5h6M9 15h4', 's']],
    // 옷
    tee: [[TEE, 'b']],
    shirt: [[TEE, 'b'], ['M9.5 4.3 12 7.6l2.5-3.3', 's'], ['M12 9.8v.01M12 12.8v.01M12 15.8v.01', 's']],
    hoodie: [['M8 6 4 8.5l1.6 3.7 1.9-.9V20h9v-8.7l1.9.9L20 8.5 16 6z', 'b'], ['M8 6c0-2 1.8-3 4-3s4 1 4 3c0 1.8-1.8 3-4 3S8 7.8 8 6z', 'b'], ['M9.5 15.5h5l.5 2.5H9z', 's'], ['M11 9v2.5M13 9v2.5', 's']],
    jacket: [['M8 4.5h8l3.5 3v12.5H4.5V7.5z', 'b'], ['M12 4.5V20', 's'], ['M4.5 11h15M4.5 15.5h15', 's'], ['M8 4.5 12 7l4-2.5', 's']],
    dress: [['M9.5 3.5h5l-.8 4 5.3 12.5H5L10.3 7.5z', 'b'], ['M10.3 7.5h3.4', 's']],
    jeans: [['M6 3.5h12l1 17h-5l-2-10-2 10H5z', 'b'], ['M6 6.5h12', 's'], ['M12 6.5v4', 's']],
    sneakers: [['M3.5 9.5c1.5 0 2.5 1 4.5 1.5l3 1 6 1.2c2 .4 3.5 1.6 3.5 3.3V18H3.5z', 'b'], ['M3.5 18h17', 's'], ['M8.5 11.5l1.2-1.6M11 12.3l1.2-1.6', 's']],
    socks: [['M8 3.5h6v8.5l4.2 3.3a2.6 2.6 0 0 1-3.2 4.1l-6-4.3A2.5 2.5 0 0 1 8 13z', 'b'], ['M8 6.5h6', 's']],
  };
  SHS.ICON = ICON;
  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = (typeof Path2D === 'function' ? new Path2D(d) : null));
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const parts = ICON[id]; if (!parts) return;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach(([d, m]) => { const p = path(d); if (!p) return; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  SHS.icon = icon;
  // HTML용 SVG (색은 currentColor). fill을 주면 옷 몸통('b')을 그 색으로 칠해요
  SHS.iconSVG = (id, cls = '', fill) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : m === 'b' && fill ? `<path d="${d}" fill="${fill}"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 질문의 모양 표시: 그림 + 이름 (영상 · 직접 해 보기 · 힌트 · 퀴즈) ---------- */
  function shapeMark(g, shape, cx, cy, size, o = {}) {
    const c = o.color || SHC[shape];
    if (o.disc !== false) { circ(g, cx, cy, size * 0.72, o.fill || COL.panel2); ring(g, cx, cy, size * 0.72, c, o.lw || 2); }
    icon(g, 'shape_' + shape, cx, cy, size, c, o.iw || 2);
  }
  SHS.shapeMark = shapeMark;
  function shapeTag(g, shape, x, y, o = {}) {
    const Sx = SH.SHAPE[shape], t = o.text || `${Sx.ko} → ${Sx.ans}`, size = o.size || 16, h = o.h || 36, c = SHC[shape];
    const w = tw(g, t, size, 700) + h + 22, x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    rr(g, x0, y - h / 2, w, h, 10); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = c; g.lineWidth = 1.6; g.stroke();
    icon(g, 'shape_' + shape, x0 + h / 2 + 4, y, h * 0.62, c, 2);
    txt(g, t, x0 + h + 8, y + 1, { size, weight: 700, color: c });
    return { x: x0, y: y - h / 2, w, h };
  }
  SHS.shapeTag = shapeTag;

  /* ---------- 사람 얼굴 (말풍선 옆). kind: clerk(매장) · fitter(탈의실) · cashier(계산대) · uk(영국 매장) · me ---------- */
  const LOOK = {
    clerk: { shirt: '#2F4A44', hair: '#3A2A20', skin: '#E3B48D', lanyard: '#FFC15E' },
    fitter: { shirt: '#5A3E52', hair: '#2B2420', skin: '#C99169', tape: true },
    cashier: { shirt: '#1F2A30', apron: '#B8432B', hair: '#1F1B18', skin: '#D9A57C', collar: true },
    uk: { shirt: '#3A2E4A', hair: '#5A3A28', skin: '#E8BC95', bun: true, lanyard: '#C9A7FF' },
    me: { shirt: '#5D6FA8', hair: '#1F1B18', skin: '#E8BC95', pack: '#3A2C22' },
  };
  SHS.LOOK = LOOK;
  const kindOf = q => { q = typeof q === 'string' ? SH.Q[q] : q; return q.sp === 'ca' ? 'fitter' : q.sp === 'au' ? 'cashier' : q.sp === 'gb' ? 'uk' : 'clerk'; };
  SHS.kindOf = kindOf;
  function avatar(g, x, y, r, kind, o = {}) {
    const L = LOOK[kind] || LOOK.clerk;
    circ(g, x, y, r, COL.panel2);
    g.save(); g.beginPath(); g.arc(x, y, r - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = L.shirt; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
    if (L.collar) { g.fillStyle = '#EEF1F4'; g.beginPath(); g.moveTo(x - r * 0.2, y + r * 0.42); g.lineTo(x, y + r * 0.62); g.lineTo(x + r * 0.2, y + r * 0.42); g.closePath(); g.fill(); }
    if (L.apron) { g.fillStyle = L.apron; rr(g, x - r * 0.34, y + r * 0.55, r * 0.68, r * 0.7, r * 0.08); g.fill(); }
    if (L.lanyard) { g.strokeStyle = L.lanyard; g.lineWidth = Math.max(1, r * 0.06); g.beginPath(); g.moveTo(x - r * 0.16, y + r * 0.4); g.lineTo(x - r * 0.03, y + r * 0.72); g.moveTo(x + r * 0.16, y + r * 0.4); g.lineTo(x + r * 0.03, y + r * 0.72); g.stroke(); g.fillStyle = '#F4F6F8'; rr(g, x - r * 0.13, y + r * 0.7, r * 0.26, r * 0.18, r * 0.03); g.fill(); }
    if (L.tape) { g.fillStyle = '#F2D45A'; rr(g, x - r * 0.32, y + r * 0.42, r * 0.1, r * 0.62, r * 0.03); g.fill(); rr(g, x + r * 0.22, y + r * 0.42, r * 0.1, r * 0.62, r * 0.03); g.fill(); }
    if (L.pack) { g.strokeStyle = L.pack; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - r * 0.42, y + r * 0.45); g.lineTo(x - r * 0.5, y + r); g.moveTo(x + r * 0.42, y + r * 0.45); g.lineTo(x + r * 0.5, y + r); g.stroke(); }
    g.fillStyle = L.skin; g.fillRect(x - r * 0.1, y + r * 0.18, r * 0.2, r * 0.22);
    circ(g, x, y - r * 0.08, r * 0.34, L.skin);
    g.fillStyle = L.hair; g.beginPath(); g.arc(x, y - r * 0.12, r * 0.36, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
    if (L.bun) circ(g, x, y - r * 0.5, r * 0.13, L.hair);
    circ(g, x - r * 0.12, y - r * 0.04, r * 0.035, '#2B2420'); circ(g, x + r * 0.12, y - r * 0.04, r * 0.035, '#2B2420');
    g.strokeStyle = 'rgba(120,60,40,0.6)'; g.lineWidth = Math.max(1, r * 0.045); g.beginPath(); g.arc(x, y + r * 0.06, r * 0.1, 0.35, Math.PI - 0.35); g.stroke();
    g.restore();
    ring(g, x, y, r, o.live ? (SPC[o.sp] || COL.soft) : COL.faint, o.live ? 2.6 : 1.5);
    if (o.live) { g.save(); g.globalAlpha *= 0.45; ring(g, x, y, r + 5, SPC[o.sp] || COL.soft, 2); g.restore(); }
  }
  SHS.avatar = avatar;

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
  SHS.richLay = richLay; SHS.richDraw = richDraw;

  /* ---------- 낱말 조각 (대답 만들기): { id, t, r } → lay · morph · drawTok ---------- */
  const PUNCT = /^[.,?!]$/;
  function ansToks(a, o = {}) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    SH.segs(a).forEach(s => s.t.split(/\s+/).forEach(w => {
      if (!w) return;
      const m = w.match(/^(.*?)([.,?!]*)$/);
      if (m[1]) push(m[1], o.role != null ? o.role : s.r);
      if (m[2]) m[2].split('').forEach(p => push(p, ''));
    }));
    return out;
  }
  SHS.ansToks = ansToks;
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
  SHS.talk = talk;
  // 직원의 말 (말 id로): 말풍선 + 열쇠 낱말 (+ 모양 표시)
  const Qobj = q => typeof q === 'string' ? SH.Q[q] : q;
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
    const said = LB && p > 0.5 ? (o.sayB || (o.B ? SH.text(o.B) : null)) : (o.sayA || (o.A ? SH.text(o.A) : null));
    if (!o.noHit && said) listen(bx, by, bw, bh, [{ text: said, sp: 'me' }]);
    return out;
  }
  SHS.answer = answer;
  const okOf = (q, a, c) => SH.judge(q, a, c || SH.DEMO).ok;

  /* ---------- 가게 길 띠 (03–08장 위쪽) ---------- */
  function strip(g, cur, a = 1) {
    fade(g, a, () => {
      const x0 = 812, dx = 64, y = 92;
      g.strokeStyle = COL.faint; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 6, y); g.stroke();
      SH.PLACES.forEach((p, i) => {
        const x = x0 + i * dx, on = i === cur;
        circ(g, x, y, on ? 19 : 14, on ? COL.accent : i < cur ? '#2A3542' : COL.panel);
        ring(g, x, y, on ? 19 : 14, on ? COL.accent : SH.ME_FIRST[p.id] ? 'rgba(201,167,255,0.6)' : COL.faint, 1.5);
        icon(g, p.id, x, y, on ? 22 : 16, on ? '#1D1305' : i < cur ? COL.soft : COL.muted, on ? 2 : 1.8);
      });
      txt(g, `${cur + 1} / 7`, x0 + dx * 6 + 30, y, { size: 13, weight: 500, fam: FM, color: COL.muted });
    });
  }

  /* =========================================================
     쇼핑 그림: 옷 · 옷걸이 · 손에 든 것 → 바라는 것 · 크기 줄 · 값표 · 영수증 · 쇼핑 카드 · 가게 앞 · 탈의실 · 단말기 · 쇼핑백 · 달력
     ========================================================= */
  const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
  // 옷 (가운데 cx, cy, 한 변 size) — 아이콘 길을 물건 색으로 칠해요
  function clothDraw(g, cx, cy, size, item, color, o = {}) {
    const parts = ICON[item]; if (!parts) return;
    const hex = (SH.COLORS[color] || {}).hex || '#8E949C', line = o.line || (lum(hex) > 0.5 ? '#4A525C' : 'rgba(238,241,244,0.82)');
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = o.lw || 1.2;
    parts.forEach(([d, m]) => { const p = path(d); if (p && m === 'b') { g.fillStyle = hex; g.fill(p); g.strokeStyle = line; g.stroke(p); } });
    parts.forEach(([d, m]) => { const p = path(d); if (!p || m === 'b') return; g.strokeStyle = line; g.fillStyle = line; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  SHS.clothDraw = clothDraw;
  // 옷걸이에 건 옷 (위 가운데 cx, top, 배율 s). 신발 · 양말은 옷걸이 없이. tagText → 크기 이름표
  const HANG = { top: 1, waist: 1 };
  function hung(g, cx, top, s, item, color, tagText, o = {}) {
    const it = SH.ITEMS[item], hang = HANG[it.kind];
    if (hang) {
      g.strokeStyle = '#AEB7C0'; g.lineWidth = 2.4 * s; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.arc(cx, top + 7 * s, 6 * s, Math.PI, Math.PI * 2.15); g.stroke();
      g.beginPath(); g.moveTo(cx + 0.5 * s, top + 13 * s); g.lineTo(cx - 40 * s, top + 34 * s); g.lineTo(cx + 40 * s, top + 34 * s); g.closePath(); g.stroke();
    }
    const cy = top + (hang ? 82 : 70) * s;
    clothDraw(g, cx, cy, 116 * s, item, color);
    if (tagText) {
      const k = Math.max(0.8, s);
      chip(g, tagText, cx + 30 * s, cy - 26 * s, { size: 13 * k, weight: 800, fam: FM, color: COL.ink, fill: '#F4F1E8', stroke: o.tagStroke, lw: 2.6, h: 24 * k, r: 5, pad: 7 });
    }
    return { cy, bottom: cy + 50 * s };
  }
  SHS.hung = hung;
  // 손에 든 것 → 바라는 것 (x, y 왼쪽 위, 폭 w). 크기 · 색 줄마다 다르면 민트(바꿀 점), 같으면 흐리게
  function handWant(g, x, y, w, c, o = {}) {
    const h = o.h || 330, it = SH.ITEMS[c.item], showWant = o.want !== false, p = o.p == null ? 1 : o.p;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    const cx1 = lerp(x + w / 2, x + w * 0.27, showWant ? p : 0), cx2 = x + w * 0.73, top = y + 20, s = 0.8;
    const ch = SH.changes(c);
    hung(g, cx1, top, s, c.item, c.hcolor, SH.SIZE[c.hsize] ? SH.SIZE[c.hsize].tag : '');
    txt(g, '손에 든 것', cx1, y + 168, { size: 15, weight: 700, color: COL.muted, align: 'center' });
    if (showWant) fade(g, p, () => {
      hung(g, cx2, top, s, c.item, c.color, SH.SIZE[c.size] ? SH.SIZE[c.size].tag : '', { tagStroke: ch.includes('size') ? '#1F7A55' : null });
      txt(g, '바라는 것', cx2, y + 168, { size: 15, weight: 700, color: COL.clause, align: 'center' });
      txt(g, '→', x + w / 2, top + 66, { size: 22, weight: 700, color: COL.accent, align: 'center' });
    });
    g.fillStyle = COL.faint; g.fillRect(x + 16, y + 190, w - 32, 1);
    [['size', '크기', z => SH.SIZE[z] ? SH.SIZE[z].tag : z], ['color', '색', k => SH.COLORS[k] ? SH.COLORS[k].ko : k]].forEach(([k, nm, f], i) => {
      const yy = y + 218 + i * 40, diff = ch.includes(k);
      txt(g, nm, x + 18, yy, { size: 15, weight: 700, color: COL.muted });
      const hv = f(c['h' + k]);
      txt(g, hv, x + 62, yy, { size: fit(g, hv, 16, 96, 700), weight: 700, color: COL.soft });
      if (showWant) fade(g, p, () => {
        const wv = f(c[k]);
        txt(g, '→', x + 160, yy, { size: 16, weight: 700, color: COL.muted });
        txt(g, wv, x + 182, yy, { size: fit(g, wv, 16, w - 196, 700), weight: 700, color: diff ? COL.clause : COL.dim });
      });
    });
    if (showWant) fade(g, p, () => {
      const t = ch.length ? `바꿀 점 → ${ch.map(k => k === 'size' ? '크기' : '색').join(' · ')}` : '바꿀 점 없음';
      chip(g, t, x + w / 2, y + h - 30, { size: 15, weight: 700, color: ch.length ? COL.clause : COL.muted, fill: COL.panel2, stroke: ch.length ? COL.clause : COL.faint, h: 32, r: 10, align: 'center' });
      if (it.two) txt(g, '둘이 짝 → these', x + w - 16, y + 18, { size: 13, weight: 700, color: COL.rel, align: 'right' });
    });
  }
  SHS.handWant = handWant;
  // 크기 줄 (x, y 왼쪽 위). o: { hl: { 크기 id: 색 }, cw, noLow, noHit } → 칸 위치
  function sizeRow(g, x, y, kind, o = {}) {
    const L = SH.SIZES[kind] || [], cw = o.cw || 66, gap = o.gap || 10, boxes = {};
    L.forEach((id, i) => {
      const z = SH.SIZE[id], xx = x + i * (cw + gap), c = o.hl && o.hl[id];
      rr(g, xx, y, cw, 44, 10); g.fillStyle = c ? c + '2A' : COL.panel2; g.fill(); g.strokeStyle = c || COL.faint; g.lineWidth = c ? 2.6 : 1.5; g.stroke();
      txt(g, z.tag, xx + cw / 2, y + 23, { size: fit(g, z.tag, 19, cw - 10, 800, 10, FM), weight: 800, fam: FM, color: c || COL.soft, align: 'center' });
      if (!o.noLow) txt(g, z.low, xx + cw / 2, y + 62, { size: fit(g, z.low, 14, cw + gap - 4, 600, 9), weight: 600, color: c || COL.muted, align: 'center' });
      boxes[id] = { x: xx, y, w: cw, h: 44 };
      if (!o.noHit) say(xx, y, cw, 70, `${z.low[0].toUpperCase()}${z.low.slice(1)}, please.`);
    });
    return boxes;
  }
  SHS.sizeRow = sizeRow;
  // 색 동그라미
  function swatch(g, cx, cy, r, color, on) { circ(g, cx, cy, r, SH.COLORS[color].hex); ring(g, cx, cy, r, on ? COL.clause : 'rgba(238,241,244,0.4)', on ? 3.5 : 1.5); }

  // 값표 (왼쪽 위 x, y, 배율 s). c: { item, size, color, off } · o: { hide: 값 대신 ? } → { w, h, now }
  function priceTag(g, x, y, s, c, o = {}) {
    const I = SH.ITEMS[c.item], w = 230, h = 300, now = SH.salePrice(I.p, c.off);
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = 'rgba(238,241,244,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, -30); g.quadraticCurveTo(w / 2 + 16, -12, w / 2, 22); g.stroke();
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 14; g.shadowOffsetY = 5;
    g.beginPath(); g.moveTo(30, 0); g.lineTo(w - 30, 0); g.lineTo(w, 30); g.lineTo(w, h - 12); g.quadraticCurveTo(w, h, w - 12, h); g.lineTo(12, h); g.quadraticCurveTo(0, h, 0, h - 12); g.lineTo(0, 30); g.closePath();
    g.fillStyle = COL.paper; g.fill(); g.restore();
    circ(g, w / 2, 22, 7, COL.bg); ring(g, w / 2, 22, 7, '#B9AE98', 2);
    txt(g, SH.STORE.toUpperCase(), w / 2, 50, { size: 13, weight: 700, fam: FM, color: COL.teal, align: 'center' });
    g.fillStyle = 'rgba(30,38,48,0.2)'; g.fillRect(20, 66, w - 40, 1.5);
    const name = I.en.toUpperCase();
    txt(g, name, w / 2, 92, { size: fit(g, name, 20, w - 30, 800, 10, FM), weight: 800, fam: FM, color: COL.ink, align: 'center' });
    if (c.size) chip(g, SH.SIZE[c.size].tag, 24, 126, { size: 15, weight: 800, fam: FM, color: '#FFFFFF', fill: COL.teal, h: 28, r: 6, pad: 9 });
    if (c.color) { circ(g, w - 84, 126, 11, SH.COLORS[c.color].hex); ring(g, w - 84, 126, 11, '#5B6168', 1.5); txt(g, c.color.toUpperCase(), w - 66, 126, { size: 12, weight: 700, fam: FM, color: '#3A4250' }); }
    g.fillStyle = 'rgba(30,38,48,0.2)'; g.fillRect(20, 152, w - 40, 1.5);
    if (o.hide) {
      txt(g, '?', w / 2, 218, { size: 72, weight: 800, fam: FD, color: '#9AA3AD', align: 'center' });
      txt(g, '값표에 값이 없어요', w / 2, 276, { size: 14, weight: 700, color: '#5B6168', align: 'center' });
    } else if (c.off) {
      const was = 'WAS ' + SH.money(I.p), ww = tw(g, was, 15, 600, FM);
      txt(g, was, w / 2, 178, { size: 15, weight: 600, fam: FM, color: '#5B6168', align: 'center' });
      g.strokeStyle = COL.red; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2 - ww / 2 - 4, 179); g.lineTo(w / 2 + ww / 2 + 4, 179); g.stroke();
      txt(g, SH.money(now), w / 2, 222, { size: 44, weight: 800, fam: FM, color: COL.red, align: 'center' });
      chip(g, `${c.off}% OFF`, w / 2, 270, { size: 16, weight: 800, fam: FM, color: '#FFFFFF', fill: COL.red, h: 32, r: 8, align: 'center' });
    } else txt(g, SH.money(I.p), w / 2, 214, { size: 46, weight: 800, fam: FM, color: COL.ink, align: 'center' });
    g.restore();
    return { w: w * s, h: h * s, now };
  }
  SHS.priceTag = priceTag;

  // 영수증 (x, y 왼쪽 위, 폭 w). card → SH.bill. o: { shown: 보이는 줄 수, hl: { 줄 번호 | total | policy: 색 } } → { h, total }
  function receiptDraw(g, x, y, w, c, o = {}) {
    const B = SH.bill(c), n = B.items.length, hl = o.hl || {}, shown = o.shown == null ? 99 : o.shown;
    const yt = y + 74 + n * 52, h = yt - y + 128;
    g.save();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h);
    const zz = 14; for (let k = 0; k <= Math.round(w / zz); k++) g.lineTo(x + w - k * zz, y + h + (k % 2 ? 7 : 0));
    g.lineTo(x, y + h); g.closePath(); g.fillStyle = COL.paper; g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 16; g.shadowOffsetY = 6; g.fill(); g.restore();
    const nm = SH.STORE.toUpperCase();
    txt(g, nm, x + w / 2, y + 24, { size: fit(g, nm, 17, w - 30, 700, 10, FM), weight: 700, fam: FM, color: COL.ink, align: 'center' });
    txt(g, 'RECEIPT', x + w / 2, y + 46, { size: 12, weight: 600, fam: FM, color: '#5B6168', align: 'center' });
    g.setLineDash([4, 4]); g.strokeStyle = 'rgba(30,38,48,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 16, y + 62); g.lineTo(x + w - 16, y + 62); g.stroke(); g.setLineDash([]);
    B.items.forEach((it, k) => fade(g, clamp(shown - k), () => {
      const yy = y + 88 + k * 52, col = hl[k];
      if (col) { rr(g, x + 10, yy - 16, w - 20, 44, 6); g.fillStyle = col + '30'; g.fill(); g.strokeStyle = col; g.lineWidth = 2.5; g.stroke(); }
      const t = it.bogo ? 'SOCKS (2 PAIRS)' : it.en.toUpperCase();
      txt(g, t, x + 18, yy, { size: fit(g, t, 14, w - 120, 700, 9, FM), weight: 700, fam: FM, color: COL.ink });
      txt(g, SH.money(it.c), x + w - 18, yy, { size: 14, weight: 700, fam: FM, color: COL.ink, align: 'right' });
      const sub = it.bogo ? 'BUY ONE, GET ONE FREE' : it.off ? `WAS ${SH.money(it.was)} · ${it.off}% OFF` : '';
      if (sub) txt(g, sub, x + 18, yy + 18, { size: fit(g, sub, 11.5, w - 36, 600, 8, FM), weight: 600, fam: FM, color: COL.red });
    }));
    fade(g, clamp(shown - n), () => {
      g.fillStyle = 'rgba(30,38,48,0.5)'; g.fillRect(x + 16, yt - 4, w - 32, 1.5);
      if (hl.total) { rr(g, x + 10, yt + 4, w - 20, 32, 6); g.fillStyle = hl.total + '30'; g.fill(); g.strokeStyle = hl.total; g.lineWidth = 2.5; g.stroke(); }
      txt(g, 'TOTAL', x + 18, yt + 20, { size: 17, weight: 700, fam: FM, color: COL.ink });
      txt(g, SH.money(B.total), x + w - 18, yt + 20, { size: 19, weight: 700, fam: FM, color: COL.red, align: 'right' });
      txt(g, `PAID · ${c.paym === 'cash' ? 'CASH' : 'CARD'}`, x + 18, yt + 50, { size: 12, weight: 600, fam: FM, color: '#5B6168' });
      if (hl.policy) { rr(g, x + 10, yt + 68, w - 20, 48, 6); g.fillStyle = hl.policy + '30'; g.fill(); g.strokeStyle = hl.policy; g.lineWidth = 2.5; g.stroke(); }
      txt(g, `RETURNS WITHIN ${SH.RETURN_DAYS} DAYS`, x + w / 2, yt + 84, { size: fit(g, `RETURNS WITHIN ${SH.RETURN_DAYS} DAYS`, 12.5, w - 30, 700, 8, FM), weight: 700, fam: FM, color: COL.ink, align: 'center' });
      txt(g, 'WITH RECEIPT · THANK YOU', x + w / 2, y + h - 22, { size: fit(g, 'WITH RECEIPT · THANK YOU', 11.5, w - 30, 600, 8, FM), weight: 600, fam: FM, color: '#5B6168', align: 'center' });
    });
    return { h: h + 7, total: B.total };
  }
  SHS.receiptDraw = receiptDraw;

  // 쇼핑 카드 (시뮬레이터와 같은 칸). o: { skip: [줄 번호], hl: 줄 번호, rh, vs, rows } — 긴 값은 두 줄로
  function shopCard(g, x, y, w, card, o = {}) {
    const all = o.rows || SH.cardRows(card), rows = all.map((r, i) => [r, i]).filter(([, i]) => !o.skip || !o.skip.includes(i)), rh = o.rh || 34, vs = o.vs || 14.5, vx = o.vx || 100;
    const LS = rows.map(([[, v]]) => richLay(g, v, [], vs, w - vx - 14, { weight: 700 }));
    const hs = LS.map(R => Math.max(rh, R.h + 10)), h = 56 + hs.reduce((a, b) => a + b, 0) + 10;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 14); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 14); g.clip(); g.fillStyle = COL.teal; g.fillRect(x, y, w, 44); g.restore();
    icon(g, 'bag', x + 24, y + 22, 22, '#FFFFFF');
    txt(g, o.title || '쇼핑 카드 · SHOPPING CARD', x + 44, y + 23, { size: 16, weight: 700, color: '#FFFFFF' });
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
  SHS.shopCard = shopCard;

  // 가게 앞 (간판 · 차양 · 진열창 · 문)
  function storefront(g, x, y, w, h) {
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    rr(g, x + 18, y + 16, w - 36, 38, 8); g.fillStyle = COL.teal; g.fill();
    const nm = SH.STORE.toUpperCase();
    txt(g, nm, x + w / 2, y + 36, { size: fit(g, nm, 17, w - 60, 800, 10, FM), weight: 800, fam: FM, color: '#F2E6C9', align: 'center' });
    const ax = x + 18, aw = w - 36, ay = y + 62, n = 8, sw = aw / n;
    for (let k = 0; k < n; k++) { g.fillStyle = k % 2 ? '#F4F1E8' : COL.red; g.beginPath(); g.moveTo(ax + k * sw, ay); g.lineTo(ax + (k + 1) * sw, ay); g.lineTo(ax + (k + 1) * sw, ay + 20); g.arc(ax + k * sw + sw / 2, ay + 20, sw / 2, 0, Math.PI); g.closePath(); g.fill(); }
    const wy = ay + 44, wh = y + h - 16 - wy, ww = aw * 0.58;
    rr(g, ax, wy, ww, wh, 6); g.fillStyle = 'rgba(170,215,255,0.08)'; g.fill(); g.strokeStyle = 'rgba(238,241,244,0.3)'; g.lineWidth = 2; g.stroke();
    hung(g, ax + ww * 0.3, wy + 10, 0.55, 'tee', 'white'); hung(g, ax + ww * 0.72, wy + 10, 0.55, 'dress', 'navy');
    chip(g, 'NEW IN', ax + ww / 2, wy + wh - 22, { size: 11, weight: 800, fam: FM, color: COL.ink, fill: COL.accent, h: 20, r: 5, align: 'center', pad: 6 });
    const dx = ax + ww + 12, dw = aw - ww - 12;
    rr(g, dx, wy, dw, wh, 6); g.fillStyle = COL.wood; g.fill(); g.strokeStyle = 'rgba(238,241,244,0.3)'; g.stroke();
    rr(g, dx + 9, wy + 12, dw - 18, wh * 0.45, 4); g.fillStyle = 'rgba(170,215,255,0.12)'; g.fill();
    circ(g, dx + dw - 12, wy + wh * 0.62, 4, '#C9A24A');
    chip(g, 'OPEN', dx + dw / 2, wy + wh * 0.32, { size: 11, weight: 800, fam: FM, color: '#10151C', fill: COL.good, h: 20, r: 5, align: 'center', pad: 6 });
  }
  // 바지 진열대 (접힌 청바지 더미)
  function jeansShelf(g, x, y, w, h) {
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    chip(g, 'BOTTOMS · JEANS', x + w / 2, y + 30, { size: 13, weight: 700, fam: FM, color: '#F2E6C9', fill: COL.teal, h: 28, r: 6, align: 'center' });
    [0, 1].forEach(r => { g.fillStyle = COL.wood; g.fillRect(x + 20, y + 150 + r * 120, w - 40, 8); });
    [0, 1].forEach(r => [0, 1, 2].forEach(k => {
      const sx = x + 40 + k * 82, sy = y + 150 + r * 120;
      for (let i = 0; i < 4; i++) { rr(g, sx, sy - 14 - i * 14, 66, 13, 3); g.fillStyle = r ? '#2A2D33' : ['#4E79B5', '#3F6799', '#5A86C0', '#4E79B5'][i]; g.fill(); g.strokeStyle = 'rgba(238,241,244,0.25)'; g.lineWidth = 1; g.stroke(); }
      chip(g, ['28', '30', '32'][k], sx + 33, sy + 22, { size: 11, weight: 800, fam: FM, color: COL.ink, fill: '#F4F1E8', h: 18, r: 4, pad: 5, align: 'center' });
    }));
    clothDraw(g, x + w - 52, y + 84, 62, 'jeans', 'blue');
  }
  // 탈의실 (칸 셋, open: 커튼을 반쯤 연 칸)
  function fittingRoom(g, x, y, w, h, o = {}) {
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint });
    chip(g, 'FITTING ROOMS', x + w / 2, y + 28, { size: 13, weight: 700, fam: FM, color: '#F2E6C9', fill: COL.teal, h: 28, r: 6, align: 'center' });
    const n = 3, bw = (w - 40) / n, top = y + 60, bh = h - 84;
    for (let k = 0; k < n; k++) {
      const bx = x + 20 + k * bw;
      g.fillStyle = 'rgba(238,241,244,0.05)'; g.fillRect(bx + 4, top, bw - 8, bh);
      g.strokeStyle = '#AEB7C0'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx + 2, top); g.lineTo(bx + bw - 2, top); g.stroke();
      const cw = (bw - 8) * (o.open === k ? 0.42 : 1), col = ['#7A4A62', '#3E5A4C', '#5A4A7A'][k];
      g.fillStyle = col; g.beginPath(); g.moveTo(bx + 4, top + 2);
      for (let i = 0; i <= 6; i++) g.lineTo(bx + 4 + cw * i / 6, top + 2 + (i % 2) * 3);
      g.lineTo(bx + 4 + cw, top + bh); g.lineTo(bx + 4, top + bh); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; for (let i = 1; i < 6; i++) { const xx = bx + 4 + cw * i / 6; g.beginPath(); g.moveTo(xx, top + 6); g.lineTo(xx, top + bh - 4); g.stroke(); }
      if (o.open === k) { g.fillStyle = 'rgba(238,241,244,0.12)'; rr(g, bx + bw - 30, top + 30, 18, 60, 4); g.fill(); }
    }
    g.fillStyle = 'rgba(238,241,244,0.12)'; g.fillRect(x + 20, top + bh, w - 40, 3);
  }
  // 탈의실 번호표
  function numTag(g, cx, cy, n) {
    rr(g, cx - 34, cy - 46, 68, 92, 12); g.fillStyle = '#E6EAEE'; g.fill(); g.strokeStyle = '#9AA6AA'; g.lineWidth = 2; g.stroke();
    circ(g, cx, cy - 32, 6, COL.bg);
    txt(g, String(n), cx, cy + 10, { size: 46, weight: 800, fam: FD, color: COL.teal, align: 'center' });
  }
  // 카드 단말기
  function reader(g, x, y, o = {}) {
    rr(g, x, y, 170, 260, 22); g.fillStyle = '#262C33'; g.fill(); g.strokeStyle = '#3A434D'; g.lineWidth = 2; g.stroke();
    rr(g, x + 16, y + 18, 138, 112, 10); g.fillStyle = o.state === 'ok' ? '#DFF3E6' : '#E8EEF2'; g.fill();
    txt(g, o.amount || '', x + 85, y + 48, { size: 24, weight: 700, fam: FM, color: COL.ink, align: 'center' });
    txt(g, o.state === 'ok' ? 'APPROVED' : 'TAP CARD', x + 85, y + 82, { size: 14, weight: 700, fam: FM, color: o.state === 'ok' ? '#1F7A55' : '#5B6168', align: 'center' });
    if (o.state !== 'ok') { g.strokeStyle = '#5B6168'; g.lineWidth = 2; g.lineCap = 'round'; [8, 14, 20].forEach(r => { g.beginPath(); g.arc(x + 85, y + 110, r, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); }); }
    else check(g, x + 85, y + 108, 18, '#1F7A55');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { rr(g, x + 30 + c * 40, y + 148 + r * 32, 30, 22, 5); g.fillStyle = '#3A434D'; g.fill(); }
  }
  // 쇼핑백 (밑 가운데)
  function shopBag(g, cx, by, s) {
    g.save(); g.translate(cx, by); g.scale(s, s);
    g.strokeStyle = '#8A6A48'; g.lineWidth = 5; g.beginPath(); g.arc(0, -120, 26, Math.PI, 0); g.stroke();
    g.beginPath(); g.moveTo(-62, -120); g.lineTo(62, -120); g.lineTo(54, 0); g.lineTo(-54, 0); g.closePath(); g.fillStyle = '#C9A57A'; g.fill(); g.strokeStyle = '#8A6A48'; g.lineWidth = 2.5; g.stroke();
    txt(g, 'MAPLE', 0, -72, { size: 16, weight: 800, fam: FM, color: '#5A4026', align: 'center' }); txt(g, '& THREAD', 0, -50, { size: 14, weight: 800, fam: FM, color: '#5A4026', align: 'center' });
    g.restore();
  }
  // 달력 (며칠 뒤)
  function calendar(g, x, y, w, days, o = {}) {
    const h = w * 1.05;
    rr(g, x, y, w, h, 12); g.fillStyle = COL.paper; g.fill();
    g.save(); rr(g, x, y, w, h, 12); g.clip(); g.fillStyle = o.bad ? COL.red : COL.teal; g.fillRect(x, y, w, 36); g.restore();
    txt(g, o.head || 'DAYS LATER', x + w / 2, y + 18, { size: 13, weight: 700, fam: FM, color: '#FFFFFF', align: 'center' });
    txt(g, String(days), x + w / 2, y + h / 2 + 12, { size: w * 0.42, weight: 800, fam: FD, color: o.bad ? COL.red : COL.ink, align: 'center' });
    if (o.sub) txt(g, o.sub, x + w / 2, y + h - 18, { size: fit(g, o.sub, 13, w - 16, 700), weight: 700, color: '#5B6168', align: 'center' });
    [0.3, 0.7].forEach(k => { rr(g, x + w * k - 4, y - 8, 8, 18, 4); g.fillStyle = '#9AA6AA'; g.fill(); });
  }
  // 동전 (거스름돈)
  function coins(g, cx, cy) { [[-26, 6], [0, -6], [26, 8]].forEach(([dx, dy]) => { circ(g, cx + dx, cy + dy, 22, '#D9B45A'); ring(g, cx + dx, cy + dy, 22, '#A8842E', 3); ring(g, cx + dx, cy + dy, 14, 'rgba(168,132,46,0.6)', 1.5); }); }
  // 맞음새 그림: 옷 + 화살표 (꽉 낌 → 안으로 · 헐렁함 → 밖으로 · 잘 맞음 → ✓)
  function fitPic(g, cx, top, s, item, color, f) {
    const H0 = hung(g, cx, top, s, item, color), cy = H0.cy, dx = 64 * s;
    if (f === 'good') { check(g, cx + dx + 10, cy - 20, 22, COL.good); return; }
    const inw = SH.FIT[f] && SH.FIT[f].up > 0, c = inw ? COL.trap : COL.ante;
    [-1, 1].forEach(sd => { const x0 = cx + sd * (dx + (inw ? 34 : 6)), x1 = cx + sd * (dx + (inw ? 6 : 34)); arrow(g, x0, cy, x1, cy, c, 3); });
  }

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(곱하기 표)는 자막에 쓰지 않음
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '쇼핑 회화 · 이것에 바꿀 점만 더한다', d: 26, caps: [
      [0.4, 5.5, '옷 가게에서는 직원이 먼저 말을 걸지만, 크기와 색을 바꾸고 값을 묻는 건 내가 먼저 해야 해요.'],
      [5.5, 10.5, '검은색 S 후드 티를 들고 있어요. M 크기를 찾고 싶어서 → M size is there?'],
      [10.5, 16, '직원이 고개를 갸웃해요. 묻는 틀이 없어서 무엇을 바라는지 알아듣기 어렵거든요.'],
      [16, 21, '이것 + 바꿀 점 → Do you have this in a medium? **손에 든 것에 바꿀 점만 더해요.**'],
      [21, 26, '세 단계로 말해요. 열쇠 낱말과 모양을 잡고, 틀에 내 정보를 넣고, 공손하게 끝내요.'],
    ] },
    { id: 'route', n: '01', title: '옷 가게 길 지도', sub: '쇼핑하는 차례대로 일곱 곳 · 곳마다 한두 마디', d: 30, caps: [
      [0.4, 6, '옷 가게에서 보내는 시간을 일곱 곳으로 나눠 봐요. 들어가면 직원이 인사하고, 찾는 물건을 물어봐요.'],
      [6, 12, '진열대에서 크기와 색을 고르고, 탈의실에서 입어 봐요. 그다음 값과 할인을 확인해요.'],
      [12, 18, '계산대에서 계산하고, 며칠 뒤에 교환이나 환불을 하러 다시 올 수도 있어요.'],
      [18, 24, '보라 테두리 → 내가 먼저 말을 꺼내는 곳이에요. 물건 찾기, 입어 보기, 값 묻기, 교환과 환불.'],
      [24, 30, '가게 이름과 값, 규칙은 지어낸 것이에요. 실제 가게마다 차례와 규칙이 달라요.'],
    ] },
    { id: 'change', n: '02', title: '이것 + 바꿀 점', sub: 'Do you have this …? · in + 크기 · in + 색 · these', d: 36, caps: [
      [0.4, 6, '쇼핑 영어의 뼈대는 하나예요. 손에 든 것을 보여 주며 → Do you have this …? 그리고 바꿀 점을 더해요.'],
      [6, 12, '크기만 다르면 → Do you have this in a medium? 색만 다르면 → Do you have this in navy?'],
      [12, 18, '둘 다 다르면 이어서 → Do you have this in a medium in navy? 크기와 색은 어느 쪽이 먼저여도 돼요.'],
      [18, 24, '같은 점은 말하지 않아요. 손에 든 것도 검은색인데 → in black? 그러면 직원이 헷갈려요.'],
      [24, 30, '청바지, 운동화, 양말 → 둘이 짝이라 this 대신 **these**. Do you have these in a 32?'],
      [30, 36, '긴 말도 통하지만 → this hoodie in medium size in navy color. 짧게 → this in a medium in navy.'],
    ] },
    { id: 'door', n: '03', title: '입구와 물건 찾기', sub: 'Can I help you find anything · just looking · where can I find', d: 34, place: [0, 1], placeAt: 17, caps: [
      [0.4, 6, "Can I help you find anything? → 도와주겠다는 Yes/No 질문이에요. 그냥 보는 중이면 → I'm just looking, thanks."],
      [6, 11.5, '아이쇼핑을 옮긴 Just eye shopping. → 영어로는 통하지 않아요. No. → 한 마디로 끊으면 무뚝뚝하게 들려요.'],
      [11.5, 17, "찾는 게 있으면 → Yes, I'm looking for a hoodie. 영국에서는 → Are you alright there? 같은 뜻이에요."],
      [17, 22.5, '둘러보다 직원이 지나가면 → Let me know if you need anything! 이제 내가 먼저 물을 차례예요.'],
      [22.5, 28, 'Excuse me, where can I find jeans? 이 틀 하나면 물건이 하나든 여럿이든 → is · are 고민이 없어요.'],
      [28, 34, '물건 이름도 조심해요. 후드 티 → a hoodie, 원피스 → a dress, 패딩 → a puffer jacket, 와이셔츠 → a shirt.'],
    ] },
    { id: 'rack', n: '04', title: '크기와 색', sub: 'What size · a medium · one size · navy or gray · this in', d: 34, place: 2, caps: [
      [0.4, 6, 'What size are you looking for? → 정보 질문. Yes, please. → 크기가 없어요. → A medium, please.'],
      [6, 11.5, "I'm a medium. → 이렇게 말해도 돼요. Free size → 공짜로 들릴 수 있어요. 한 가지 크기는 → one size."],
      [11.5, 17, 'M size → 알아듣지만 보통 → a medium. 바지는 허리 숫자 → a 32, 신발은 → a size 9.'],
      [17, 22.5, 'Would you like it in navy or gray? → 고르는 질문. 고른 것 + please → Navy, please.'],
      [22.5, 28.5, 'Are you finding everything okay? → 바꿀 점을 바로 말해요 → Do you have this in a medium?'],
      [28.5, 34, 'this in → 이어서 → thi-sin. Give me a bigger one. → 명령처럼 들리고 얼마나 큰지도 몰라요.'],
    ] },
    { id: 'fit', n: '05', title: '탈의실', sub: 'Could I try this on · How many items · How did everything fit', d: 34, place: 3, caps: [
      [0.4, 6, 'The fitting rooms are right over there. → 안내예요. 입어 보고 싶으면 내가 먼저 → Could I try this on?'],
      [6, 11.5, 'Can I fitting? → 통하지 않아요. Can I wear this? → 사서 입고 나가겠다는 말처럼 들려요.'],
      [11.5, 17, 'How many items do you have? → 정보 질문. 수만 말해요 → Two. 번호표를 받는 곳도 있어요.'],
      [17, 22.5, 'How did everything fit? → 어땠는지 묻는 정보 질문. Yes, it did. → 어땠는지가 빠졌어요.'],
      [22.5, 28, "맞지 않으면 → It's a little tight. 둘이 짝이면 → They're a little loose. 잘 맞으면 → It fits great."],
      [28, 34, 'Would you like to try a different size? 꽉 끼면 한 칸 큰 것 → Yes, could I try a large?'],
    ] },
    { id: 'price', n: '06', title: '값과 할인', sub: 'How much is this · on sale · fifteen or fifty · buy one, get one free', d: 34, place: 4, caps: [
      [0.4, 6, '값표가 없으면 내가 먼저 물어요 → Excuse me, how much is this? 둘이 짝이면 → how much are these?'],
      [6, 11.5, 'How much money? → 값을 물을 땐 money 없이 말해요. D.C.(디시) → 영어로는 → Is this on sale?'],
      [11.5, 17, "직원 → It's $15.00 today. That's fifty percent off. 15와 50 → fifteen → 뒤를 세게, fifty → 앞을 세게 말해요."],
      [17, 22.5, '헷갈리면 되물어요 → Sorry, did you say fifteen dollars? 숫자만 확인하면 되니 겁내지 말고 물어요.'],
      [22.5, 28, "Too expensive. Cheaper, please. → 이런 가게에서는 보통 값을 깎지 않아요. 사려면 → Great. I'll take it."],
      [28, 34, 'Our socks are buy one, get one free. 원 플러스 원 → 영어로는 buy one, get one free. 원하면 → Yes, please.'],
    ] },
    { id: 'pay', n: '07', title: '계산대', sub: 'Did you find everything · rewards card · a bag · cash or card · receipt', d: 32, place: 5, caps: [
      [0.4, 6, 'Did you find everything okay? → Yes, I found. → 문장이 끝나지 않아요. → Yes, I did. Thanks.'],
      [6, 11.5, "Do you have a rewards card with us? → 회원 카드예요. 없으면 → No, I don't. (No, I don't have. → 끝이 비어요)"],
      [11.5, 17, 'Would you like a bag? → 비닐봉지를 옮긴 vinyl bag → 어색해요. 필요하면 → Yes, please. 아니면 → No, thanks. I have one.'],
      [17, 22.5, 'Your total is $21.00. Cash or card? → 고르는 질문. Yes, please. → 고른 것이 없어요. → Card, please.'],
      [22.5, 27.5, '후드 티 15달러와 양말 두 켤레 6달러 → 모두 21달러. 세금은 빼고 계산한 지어낸 값이에요.'],
      [27.5, 32, 'Would you like your receipt? → 교환 · 환불하려면 영수증이 필요해요 → Yes, please.'],
    ] },
    { id: 'ret', n: '08', title: '교환과 환불', sub: "I'd like to exchange · return · receipt · refund or store credit", d: 36, place: 6, caps: [
      [0.4, 6, '며칠 뒤, 청바지가 작아서 바꾸러 왔어요. Hi, how can I help you? → 하고 싶은 것을 말해요.'],
      [6, 12, "교환 → change? 거스름돈으로 들려요. → I'd like to exchange these. 돌려주고 돈을 받으려면 → return."],
      [12, 18, "Refund me. → 명령처럼 들려요. → I'd like to return this. Do you have your receipt? → Yes, here it is."],
      [18, 24, "What's the reason? → They're too small. What size would you like instead? → A 32, please."],
      [24, 30, '환불이면 → Would you like a refund or store credit? store credit → 그 가게에서만 쓰는 돈이에요. 모르면 물어요.'],
      [30, 36, "규칙상 안 되면 → I'm sorry, but we only take returns within thirty days. 따지지 말고 → I see. Thank you anyway."],
    ] },
    { id: 'method', n: '09', title: '3단계 말하기 법', sub: '일곱 곳에 한 줄씩 · 질문의 모양과 함께', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 말하기 법**으로 묶어요.'],
      [5.5, 11.5, '① **열쇠 낱말과 질문의 모양 잡기** → or → 고르기, how · what → 정보, Can I · Do you → Yes/No.'],
      [11.5, 17.5, '② **틀에 내 정보 넣기** → 이것 + 바꿀 점. A medium, please. 둘이 짝이면 these · they · them.'],
      [17.5, 23, '③ **공손하게 끝내기** → please, thanks, Could I …? 부를 때는 → Excuse me.'],
      [23, 28, '일곱 곳에 한 줄씩 적용했어요. 내가 먼저 말하는 곳도 직원의 말에 대한 대답으로 볼 수 있어요.'],
    ] },
    { id: 'practice', n: '10', title: '실전 쇼핑', sub: '쇼핑 카드 하나로 네 번', d: 50, caps: [
      [0.4, 4.5, '실전이에요. 쇼핑 카드 → 청바지 30을 들고, 32를 찾아요. 첫 질문 → Are you finding everything okay?'],
      [4.5, 8.5, '① 셋 모두 바꿀 점을 묻는 말이에요. ② (A) this → 청바지는 these. (B) 30 → 손에 든 것과 같아요.'],
      [8.5, 12.5, '정답 (C) → Do you have these in a 32?'],
      [12.9, 17, 'How did everything fit? ① 정보 질문 → (A) Yes, it did. 어땠는지가 빠져 탈락.'],
      [17, 21, '② (B) It fits → 청바지는 둘이 짝이라 → They fit. 탈락.'],
      [21, 25, '정답 (C) → They fit great, thanks.'],
      [25.4, 29.5, '계산대 → Cash or card? ① 고르는 질문 → (B) Yes, please. 탈락.'],
      [29.5, 33.5, '② (C) Cash → 카드로 내기로 했어요. 탈락.'],
      [33.5, 37.5, '정답 (A) → Card, please.'],
      [37.9, 42, '며칠 뒤 → How can I help you? ① 셋 모두 돌려주는 일에 대한 말이에요.'],
      [42, 46, '② (B) Change, please. → 거스름돈으로 들려 탈락.'],
      [46, 50, "③ (A) Refund me. → 명령처럼 들려 탈락. 정답 (C) → I'd like to return these."],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '곳 · 열쇠 낱말과 모양 · 대답 틀', d: 22, caps: [
      [0.4, 6, '정리해요. 바꾸고 싶으면 → 이것 + 바꿀 점. Do you have this in a medium? 같은 점은 빼요.'],
      [6, 12, '둘이 짝인 물건 → these · they · them. 내가 먼저 → Excuse me, where can I find …? Could I try this on?'],
      [12, 17, '값 → How much is this? 숫자가 헷갈리면 → Sorry, did you say fifteen dollars?'],
      [17, 22, '아래 **쇼핑 시뮬레이터**에서 내 쇼핑 카드로 입구부터 교환 · 환불까지 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  SHS.CHAPTERS = CHAPTERS; SHS.CAPTIONS = CAPTIONS; SHS.END = END;
  SHS.POSTER = CHAPTERS.find(c => c.id === 'change').t + 17.2;
  SHS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  SHS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 실전 장면의 시각 (구간 시작 · 보기 · ① · ② · ③ · 정답)
  const PSEG = [0, 12.5, 25, 37.5];
  const PT = { q: 0.4, opt: [1.6, 2.2, 2.8], s1: 5.0, s2: 7.0, s3: 9.0, win: 10.0, lines: [0.4, 4.5, 8.5] };
  SHS.PSEG = PSEG;

  /* ---------- 장면 그리기 ---------- */
  const LX = 80, RX = 900, RW = 300;
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
  const ansParts = a => SH.segs(a).map(s => [s.t, s.r]);
  const why2 = j => `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
  // 판정 뒤 까닭 한 줄 (가운데 또는 왼쪽)
  function whyLine(g, j, y, w = 1100, x) { const R = richLay(g, why2(j), [], 17, w, { weight: 600 }); richDraw(g, R, x != null ? x : W / 2 - R.w / 2, y, { color: j.ok ? COL.good : COL.trap }); return R; }

  // 01장 가게 평면도의 일곱 곳 [x, y, 이름 위치 dx, dy, 정렬]
  const MAP = {
    door: [160, 410, 0, -36, 'center'], find: [240, 320, 0, 36, 'center'], rack: [470, 320, 0, 36, 'center'], fit: [760, 296, 0, 36, 'center'],
    price: [1060, 296, 0, 36, 'center'], pay: [900, 410, -32, 0, 'right'], ret: [1100, 410, 30, 0, 'left'],
  };
  const MAP_PATH = [[86, 410], [160, 410], [240, 410], [240, 320], [470, 320], [620, 320], [760, 296], [900, 296], [1060, 296], [1060, 360], [900, 360], [900, 410], [1100, 410]];
  function polyPart(g, pts, f) {
    let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
    let left = L * clamp(f);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) { const d = seg[i - 1], k = Math.min(1, left / d); g.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)); left -= d; }
    g.stroke();
  }
  const ME_FIRST = SH.ME_FIRST;
  // 옷걸이 봉 (평면도 · 위에서 본 모습)
  const rackBar = (g, x, y, w, cols) => { g.fillStyle = '#5B6670'; g.fillRect(x, y - 2, w, 4); cols.forEach((c, k) => { rr(g, x + 8 + k * ((w - 16) / cols.length), y - 9, (w - 16) / cols.length - 4, 18, 3); g.fillStyle = SH.COLORS[c].hex; g.fill(); }); };
  // 01장 · 09장의 대표 카드 (값 · 돌려받기까지)
  const ROUTE_CARD = Object.assign({}, SH.DEMO, { ret: 'return', way: 'refund', days: 5, receipt: true });

  const SCENES = {
    /* 00 들어가며: 제목 → 검은 S 후드 티를 들고 M size is there? → 직원이 갸웃 → Do you have this in a medium? → 세 단계 */
    intro(g, u) {
      fade(g, ramp(u, 0.2, 0.6) * (1 - ramp(u, 5.0, 0.5)), () => {
        txt(g, '쇼핑, 이것에 바꿀 점만 더한다', W / 2, 262, { size: 54, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Shopping English · 입구에서 교환 · 환불까지 일곱 곳', W / 2, 332, { size: 24, weight: 500, color: COL.muted, align: 'center' });
        SH.PLACES.forEach((p, i) => fade(g, ramp(u, 0.9 + i * 0.22, 0.4), () => {
          const x = W / 2 + (i - 3) * 132;
          circ(g, x, 440, 32, COL.panel2); ring(g, x, 440, 32, ME_FIRST[p.id] ? COL.verb : COL.accent, 1.8);
          icon(g, p.id, x, 440, 30, COL.soft);
          txt(g, String(i + 1), x, 392, { size: 14, weight: 700, fam: FM, color: COL.accent, align: 'center' });
          txt(g, p.ko, x, 496, { size: fit(g, p.ko, 15, 126, 600), weight: 600, color: COL.muted, align: 'center' });
          if (i < 6) arrow(g, x + 38, 440, x + 92, 440, COL.faint, 2);
        }));
      });
      const it = SH.INTRO, C = it.card;
      fade(g, ramp(u, 5.4, 0.4) * (1 - ramp(u, 20.6, 0.5)), () => {
        label(g, '진열대 · 크기와 색', LX, 160, { color: COL.accent, size: 16 });
        fade(g, ramp(u, 5.6, 0.5), () => handWant(g, 930, 150, 270, C, { want: u >= 16.2, p: ramp(u, 16.2, 0.7) }));
        const B = staff(g, it.q, { x: LX, y: 186, w: 820, at: 5.8, u, roleAt: 6.8, size: 26, shapeAt: 7.0 });
        fade(g, win(u, 6.6, 16.2), () => thought(g, '(한국어로) 이거 M 있어요?', LX + 440, 186 + B.bh + 14, 340));
        const ay = 186 + B.bh + 84;
        const A = answer(g, { x: LX, y: ay, w: 820, A: it.lit, B: u >= 16.2 ? it.ok : null, p: (u - 16.2) / 1.0, at: 7.6, u, size: 30, trapAt: 11.0, strikeAt: 11.2, verdict: u >= 17.4 ? { ok: okOf(it.q, it.ok, C), at: 17.4 } : null });
        fade(g, win(u, 11.4, 16.2), () => {
          talk(g, { side: 'L', x: LX, y: ay + A.bh + 16, w: 820, text: 'Sorry?', kind: 'clerk', sp: 'us', at: 11.6, u, size: 24 });
          tag(g, '묻는 틀이 없어요 → 무엇을 바라는지 몰라요', A.bx + A.bw, ay + A.bh + 100, COL.trap, { align: 'right', size: 15, h: 32 });
        });
        fade(g, ramp(u, 17.8, 0.4), () => pieces(g, [['이것', 'frame'], [' + ', ''], ['바꿀 점', 'slot'], ['   →   ', ''], ['Do you have this', 'frame'], [' + ', ''], ['in a medium', 'slot']], A.bx + A.bw, ay + A.bh + 32, 21, 0, { align: 'right' }));
        fade(g, ramp(u, 18.8, 0.4), () => tag(g, '손에 든 것에 바꿀 점만 더해요', A.bx + A.bw, ay + A.bh + 82, COL.accent, { align: 'right' }));
        if (u >= 17.4) say(A.bx, ay, A.bw, A.bh, SH.text(it.ok));
      });
      const STEP = [
        ['①', '열쇠 낱말 + 모양', 'Are you finding everything okay?', 'Yes/No 질문 → 바꿀 점을 바로', COL.ante],
        ['②', '틀에 내 정보 넣기', 'Do you have this ___?', '___ → in a medium · in navy', COL.rel],
        ['③', '공손하게 끝내기', 'Excuse me, could I try this on?', 'please · thanks · Could I …?', COL.verb],
      ];
      STEP.forEach(([n, t1, en, t2, c], k) => {
        const al = ramp(u, 21.2 + k * 0.5, 0.5), x0 = LX + k * 380, dy = (1 - al) * 12;
        fade(g, al, () => {
          panel(g, x0, 196 + dy, 360, 210, { fill: COL.panel, stroke: c, lw: 2 });
          txt(g, n, x0 + 24, 240 + dy, { size: 28, weight: 700, color: c });
          txt(g, t1, x0 + 66, 240 + dy, { size: 24, weight: 800, fam: FD });
          txt(g, en, x0 + 24, 300 + dy, { size: fit(g, en, 20, 320, 600), weight: 600, color: COL.en });
          txt(g, t2, x0 + 24, 344 + dy, { size: fit(g, t2, 17, 320, 700), weight: 700, color: c });
          say(x0, 284, 360, 32, en.replace(/___/, 'in a medium'));
        });
      });
      fade(g, ramp(u, 23.4, 0.5), () => pieces(g, [['① ', 'key'], ['열쇠 낱말 + 모양', 'key'], ['  →  ', ''], ['② ', 'frame'], ['틀에 내 정보', 'frame'], ['  →  ', ''], ['③ ', 'pol'], ['공손하게', 'pol']], W / 2, 462, 24, 0, { align: 'center' }));
    },

    /* 01 옷 가게 길 지도: 평면도 위의 일곱 곳과 곳마다 한두 마디 */
    route(g, u) {
      const sel = S.stop != null ? S.stop : null;
      fade(g, ramp(u, 0.3, 0.6), () => {
        panel(g, 70, 146, 1140, 322, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        // 입구
        g.fillStyle = COL.bg; g.fillRect(64, 386, 14, 52); txt(g, 'ENTRANCE', 88, 448, { size: 10, weight: 700, fam: FM, color: '#B08B62' });
        // 진열대 (윗옷 · 바지)
        txt(g, 'TOPS', 210, 172, { size: 11, weight: 700, fam: FM, color: COL.muted });
        rackBar(g, 210, 196, 300, ['black', 'navy', 'gray', 'beige', 'white', 'navy', 'black']);
        txt(g, 'BOTTOMS · JEANS', 210, 228, { size: 11, weight: 700, fam: FM, color: COL.muted });
        rackBar(g, 210, 252, 300, ['blue', 'blue', 'black', 'blue', 'black', 'blue']);
        // 신발 선반
        rr(g, 300, 432, 240, 20, 4); g.fillStyle = 'rgba(238,241,244,0.08)'; g.fill(); txt(g, 'SHOES · SOCKS', 420, 442, { size: 10, weight: 700, fam: FM, color: COL.dim, align: 'center' });
        // 탈의실
        rr(g, 600, 160, 300, 92, 10); g.fillStyle = 'rgba(238,241,244,0.04)'; g.fill(); g.strokeStyle = 'rgba(238,241,244,0.18)'; g.lineWidth = 1.5; g.stroke();
        txt(g, 'FITTING ROOMS', 750, 176, { size: 11, weight: 700, fam: FM, color: COL.muted, align: 'center' });
        [0, 1, 2].forEach(k => { const x = 618 + k * 92; g.fillStyle = ['#7A4A62', '#3E5A4C', '#5A4A7A'][k]; rr(g, x, 192, 80, 50, 4); g.fill(); });
        // 할인 탁자
        rr(g, 960, 172, 220, 76, 10); g.fillStyle = 'rgba(184,67,43,0.16)'; g.fill(); g.strokeStyle = 'rgba(184,67,43,0.6)'; g.lineWidth = 1.5; g.stroke();
        txt(g, 'SALE', 1070, 196, { size: 14, weight: 800, fam: FM, color: '#FF8A6B', align: 'center' }); txt(g, '% OFF · BUY ONE, GET ONE FREE', 1070, 222, { size: 10, weight: 700, fam: FM, color: COL.muted, align: 'center' });
        // 계산대 · 교환 환불
        rr(g, 820, 432, 160, 26, 6); g.fillStyle = COL.wood; g.fill(); txt(g, 'CASHIER', 900, 445, { size: 10.5, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
        rr(g, 1020, 432, 170, 26, 6); g.setLineDash([5, 5]); g.strokeStyle = 'rgba(201,167,255,0.6)'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
        txt(g, 'RETURNS · EXCHANGES', 1105, 445, { size: 10, weight: 700, fam: FM, color: COL.verb, align: 'center' });
      });
      // 쇼핑하는 차례로 걷는 길
      fade(g, ramp(u, 0.6, 0.5), () => { g.strokeStyle = 'rgba(110,200,255,0.5)'; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash([2, 7]); polyPart(g, MAP_PATH, sel != null ? 1 : (u - 0.8) / 14.4); g.setLineDash([]); });
      fade(g, ramp(u, 14.4, 0.4), () => txt(g, '며칠 뒤', 1000, 396, { size: 13, weight: 700, color: COL.verb, align: 'center' }));
      const AT = [1.0, 3.4, 6.4, 8.4, 10.4, 12.6, 14.6];
      SH.PLACES.forEach((p, i) => {
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
        const p = SH.PLACES[sel];
        panel(g, LX, by, 1120, bh, { fill: COL.panel, stroke: COL.accent });
        icon(g, p.id, LX + 28, by + 24, 22, COL.accent);
        txt(g, `${sel + 1}. ${p.ko}`, LX + 48, by + 24, { size: 17, weight: 700, color: COL.accent });
        SH.ROUTE[p.id].forEach((qid, k) => {
          const q = SH.Q[qid], t = q.short && /[?!]$/.test(q.short) ? q.short : q.en, R = richLay(g, t, Qm(q), 17, 600, { weight: 600 });
          shapeMark(g, q.shape, LX + 34, by + 54 + k * 28, 14, { disc: false, iw: 2.2 });
          richDraw(g, R, LX + 52, by + 54 + k * 28, { color: COL.en });
          say(LX + 48, by + 40 + k * 28, R.w + 8, 28, q.en);
        });
        txt(g, '대답 →', LX + 700, by + 24, { size: 14, weight: 700, color: COL.muted });
        SH.ROUTE[p.id].map(id => SH.Q[id]).forEach((q, k) => { const t = SH.text(SH.model(q, ROUTE_CARD)); txt(g, t, LX + 700, by + 54 + k * 28, { size: fit(g, t, 16, 410, 600), weight: 600, color: COL.rel }); say(LX + 696, by + 40 + k * 28, 420, 28, t); });
      } else {
        SH.PLACES.forEach((p, i) => fade(g, ramp(u, 12.2 + i * 0.3, 0.4), () => {
          const x = LX + i * 161, q = SH.Q[SH.ROUTE[p.id][0]], t = q.short || q.en, me = ME_FIRST[p.id] && u >= 18.2;
          panel(g, x, by, 151, bh, { fill: COL.panel, stroke: me ? COL.verb : COL.faint, lw: me ? 2 : 1.5 });
          txt(g, `${i + 1}`, x + 14, by + 20, { size: 13, weight: 700, fam: FM, color: COL.accent });
          txt(g, me ? '내가 먼저' : '직원이 물음', x + 140, by + 20, { size: 12, weight: 700, color: me ? COL.verb : COL.muted, align: 'right' });
          const R = richLay(g, t, [], 14, 130, { weight: 600 });
          richDraw(g, R, x + 12, by + 48, { color: COL.en });
          say(x, by, 151, bh, q.en);
        }));
        fade(g, ramp(u, 24.2, 0.5), () => tag(g, '가게 · 값 · 규칙은 지어낸 것', 1200, 126, COL.muted, { align: 'right', size: 14, h: 26 }));
      }
    },

    /* 02 이것 + 바꿀 점: 뼈대 → 크기만 · 색만 → 둘 다(순서는 자유) → 같은 점 × → these → 긴 말과 짧은 말 */
    change(g, u) {
      if (S.line) {
        const c = S.line.card, a = SH.L(S.line.words), j = S.line.words.length ? SH.judge('rk_ok', a, c, '상황') : null;
        handWant(g, RX, 150, RW, c, {});
        staff(g, 'rk_ok', { x: LX, y: 160, w: 780, all: true, u: 99, size: 24 });
        if (j) {
          const A = answer(g, { x: LX, y: 240, w: 780, A: a, all: true, u: 99, size: 26, maxW: 600, verdict: { ok: j.ok, at: -1 } });
          const R = richLay(g, why2(j), [], 16, 780, { weight: 600 }); richDraw(g, R, LX, A.by + A.bh + 30, { color: j.ok ? COL.good : COL.trap });
        } else txt(g, '조각을 고르면 여기에 문장이 만들어져요.', LX, 270, { size: 18, weight: 600, color: COL.muted });
        return;
      }
      const C1 = { item: 'hoodie', two: false, hsize: 's', hcolor: 'black', size: 'm', color: 'black' };   // 크기만 다름
      const C2 = { item: 'hoodie', two: false, hsize: 's', hcolor: 'black', size: 's', color: 'navy' };    // 색만 다름
      const CC = SH.CHANGE_CARD, JC = SH.JEANS_CARD, SC = SH.SCENE;
      const card = u < 9.0 ? C1 : u < 12 ? C2 : u < 24 ? CC : u < 30 ? JC : CC;
      fade(g, ramp(u, 0.4, 0.5), () => handWant(g, RX, 150, RW, u < 6 ? CC : card, { want: u >= 6, p: u < 9 ? ramp(u, 6.0, 0.6) : 1 }));
      // [0.4, 6] 뼈대
      fade(g, ramp(u, 0.6, 0.4) * (1 - ramp(u, 5.8, 0.3)), () => {
        label(g, '손에 든 것을 보여 주며', LX, 166, { color: COL.accent });
        pieces(g, [['Do you have ', 'frame'], ['this', 'frame'], [' …?', 'frame']], LX, 228, 36);
        fade(g, ramp(u, 2.0, 0.4), () => { pieces(g, [['+  ', ''], ['바꿀 점', 'slot']], LX + 380, 228, 32); });
        fade(g, ramp(u, 3.0, 0.4), () => {
          pieces(g, [['바꿀 점 = ', ''], ['in', 'frame'], [' + 크기 → ', ''], ['in a medium', 'slot']], LX, 306, 22);
          pieces(g, [['바꿀 점 = ', ''], ['in', 'frame'], [' + 색 → ', ''], ['in navy', 'slot']], LX, 350, 22);
        });
        fade(g, ramp(u, 4.4, 0.4), () => tag(g, 'this → 손에 든 것 · 크기 · 색은 in으로 붙여요', LX, 420, COL.rel, { align: 'left' }));
        say(LX, 204, 360, 48, 'Do you have this?');
      });
      // [6, 12] 크기만 · 색만
      fade(g, ramp(u, 6.0, 0.4) * (1 - ramp(u, 11.8, 0.3)), () => {
        label(g, '크기만 다르면', LX, 166);
        answer(g, { x: LX, y: 190, w: 780, A: SC.size1, at: 6.6, u, size: 28, verdict: { ok: okOf('rk_ok', SC.size1, C1), at: 7.4 }, tag: ['바꿀 점 = 크기', COL.clause, 7.6] });
        fade(g, ramp(u, 8.8, 0.4), () => label(g, '색만 다르면', LX, 316));
        answer(g, { x: LX, y: 340, w: 780, A: SC.color1, at: 9.2, u, size: 28, verdict: { ok: okOf('rk_ok', SC.color1, C2), at: 10.0 }, tag: ['바꿀 점 = 색', COL.clause, 10.2] });
      });
      // [12, 18] 둘 다 → 이어서 (순서는 자유)
      fade(g, ramp(u, 12.0, 0.4) * (1 - ramp(u, 17.8, 0.3)), () => {
        label(g, '둘 다 다르면 → 이어서', LX, 166);
        const a1 = SH.L(SH.LINE.words), a2 = SH.L(['have', 'this', 'k_navy', 'z_m']);
        answer(g, { x: LX, y: 190, w: 780, A: a1, at: 12.4, u, size: 26, verdict: { ok: okOf('rk_ok', a1, CC), at: 13.4 } });
        fade(g, ramp(u, 14.8, 0.4), () => label(g, '순서를 바꿔도', LX, 316));
        answer(g, { x: LX, y: 340, w: 780, A: a2, at: 15.0, u, size: 26, verdict: { ok: okOf('rk_ok', a2, CC), at: 15.8 } });
        fade(g, ramp(u, 16.2, 0.4), () => tag(g, '크기와 색 → 어느 쪽이 먼저여도 돼요', LX, 448, COL.clause, { align: 'left' }));
      });
      // [18, 24] 같은 점은 말하지 않아요
      fade(g, ramp(u, 18.0, 0.4) * (1 - ramp(u, 23.8, 0.3)), () => {
        label(g, '같은 점은 말하지 않아요', LX, 166);
        const A = answer(g, { x: LX, y: 190, w: 780, A: SC.same, at: 18.6, u, size: 28, trapAt: 19.4, strikeAt: 19.5, tag: ['손에 든 것도 검은색', COL.trap, 19.8] });
        talk(g, { side: 'L', x: LX, y: 190 + A.bh + 18, w: 780, text: 'That one is already black. Did you want a different color?', marks: [['already black', 'trap']], kind: 'clerk', sp: 'us', at: 20.6, u, size: 21 });
        fade(g, ramp(u, 22.4, 0.4), () => whyLine(g, SH.judge('rk_ok', SC.same, CC), 410, 780, LX));
      });
      // [24, 30] 둘이 짝 → these
      fade(g, ramp(u, 24.0, 0.4) * (1 - ramp(u, 29.8, 0.3)), () => {
        label(g, '둘이 짝인 물건 → these', LX, 166);
        const A = answer(g, { x: LX, y: 190, w: 780, A: SC.jeansThis, B: u >= 26.6 ? SC.jeans : null, p: (u - 26.6) / 0.7, at: 24.6, u, size: 28, trapAt: 25.2, strikeAt: 25.3, verdict: u >= 27.4 ? { ok: okOf('rk_ok', SC.jeans, JC), at: 27.4 } : null, tag: ['청바지 → 둘이 짝', COL.trap, 25.5, 26.6] });
        fade(g, ramp(u, 27.8, 0.4), () => pieces(g, [['this', 'frame'], [' → ', ''], ['these', 'slot'], ['      it', 'frame'], [' → ', ''], ['them', 'slot'], ['      It\'s', 'frame'], [' → ', ''], ['They\'re', 'slot']], LX, 190 + A.bh + 50, 24));
        fade(g, ramp(u, 28.4, 0.4), () => [['jeans', 'blue', '청바지'], ['sneakers', 'white', '운동화'], ['socks', 'gray', '양말']].forEach(([id, c, ko], k) => {
          const x = LX + 60 + k * 200;
          clothDraw(g, x, 400, 62, id, c); txt(g, ko, x + 46, 392, { size: 17, weight: 700 }); txt(g, SH.ITEMS[id].en, x + 46, 416, { size: 14, weight: 600, color: COL.en });
        }));
      });
      // [30, 36] 긴 말과 짧은 말
      if (u >= 29.8) fade(g, ramp(u, 30.0, 0.4), () => {
        label(g, '긴 말도 통하지만', LX, 166);
        const B = SH.L(SH.LINE.words);
        const A = answer(g, { x: LX, y: 190, w: 780, toksA: plainToks(SH.LONG, ['hoodie', 'size', 'color']), sayA: SH.LONG, B: u >= 32.8 ? B : null, p: (u - 32.8) / 0.9, at: 30.6, u, size: 25, maxW: 640, verdict: u >= 33.8 ? { ok: okOf('rk_ok', B, CC), at: 33.8 } : null, tag: ['통해요 · 그런데 조금 길어요', COL.rel, 31.4, 32.8] });
        fade(g, ramp(u, 34.2, 0.4), () => tag(g, '짧게 → this + 바꿀 점만', A.bx + A.bw, 190 + A.bh + 34, COL.clause, { align: 'right' }));
      });
    },

    /* 03 입구와 물건 찾기: 도와줄까요 → just looking · eye shopping × · No. × → looking for · 영국 → 지나가는 직원 → where can I find → 물건 이름 */
    door(g, u) {
      if (S.shape) {
        const q = SH.Q[S.shape.q], j = S.shape.pick ? S.shape.pick === q.shape : null, ja = S.shape.a ? SH.judge(q, S.shape.a, S.shape.card || {}, '상황') : null;
        staff(g, q, { x: LX, y: 160, w: 1000, all: true, u: 99, size: 24, shape: false });
        ['yn', 'or', 'wh', 'note'].forEach((sh, k) => {
          const x = LX + 60 + k * 270, on = S.shape.pick === sh, right = sh === q.shape && S.shape.pick;
          panel(g, x - 50, 268, 240, 120, { fill: on ? COL.panel2 : COL.panel, stroke: right ? COL.good : on ? COL.bad : COL.faint, lw: on || right ? 2.6 : 1.5 });
          shapeMark(g, sh, x, 328, 34); txt(g, SH.SHAPE[sh].ko, x + 40, 316, { size: 19, weight: 800, fam: FD }); txt(g, SH.SHAPE[sh].ans, x + 40, 346, { size: fit(g, SH.SHAPE[sh].ans, 14, 140, 600), weight: 600, color: SHC[sh] });
        });
        if (j != null) { const R = richLay(g, j ? `맞아요 → ${SH.SHAPE[q.shape].ko}. ${SH.sayOf(q.intent)}.` : `다시 보세요 → 이 말은 ${SH.josa.ieyo(SH.SHAPE[q.shape].ko)}. ${SH.sayOf(q.intent)}.`, [], 18, 1100, { weight: 600 }); richDraw(g, R, LX, 422, { color: j ? COL.good : COL.trap }); }
        if (ja) { answer(g, { x: LX, y: 456, w: 1120, A: S.shape.a, all: true, u: 99, size: 22, verdict: { ok: ja.ok, at: -1 } }); const R = richLay(g, why2(ja), [], 15, 1120, { weight: 600 }); richDraw(g, R, LX, 532, { color: ja.ok ? COL.good : COL.trap }); }
        return;
      }
      fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, 17.0, 0.4)), () => storefront(g, RX, 150, RW, 330));
      fade(g, ramp(u, 17.4, 0.5) * (1 - ramp(u, 28.0, 0.4)), () => jeansShelf(g, RX, 150, RW, 330));
      const [qb, look, eye, forH, plain] = SH.SCENE.browse;
      // [0.4, 11.4] 둘러보기
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const B = staff(g, qb, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 2.6, size: 22, shapeAt: 2.8 });
        let y = 150 + B.bh + 14;
        const A1 = answer(g, { x: LX, y, w: 780, A: look, at: 3.0, u, size: 24, verdict: { ok: okOf(qb, look, { look: true }), at: 3.8 }, tag: ['그냥 보는 중 → just looking', COL.clause, 4.2] });
        y += A1.bh + 14;
        const A2 = answer(g, { x: LX, y, w: 780, A: eye, at: 6.2, u, size: 24, trapAt: 6.8, strikeAt: 6.9, tag: ['아이쇼핑 → 영어로는 통하지 않아요', COL.trap, 7.2] });
        y += A2.bh + 14;
        answer(g, { x: LX, y, w: 780, A: plain, at: 8.8, u, size: 24, trapAt: 9.4, strikeAt: 9.5, tag: ['No. → 무뚝뚝하게 들려요', COL.trap, 9.8] });
      });
      // [11.6, 17] 찾는 물건이 있으면 · 영국에서는
      const inB = win(u, 11.6, 17.0);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        const B = staff(g, qb, { x: LX, y: 150, w: 780, all: true, u: 99, size: 22 });
        const A = answer(g, { x: LX, y: 150 + B.bh + 14, w: 780, A: forH, at: 11.8, u, size: 24, verdict: { ok: okOf(qb, forH, { look: false, item: 'hoodie' }), at: 12.6 }, tag: ['찾는 물건 → I\'m looking for + 물건', COL.clause, 13.0] });
        const y2 = 150 + B.bh + A.bh + 64;
        fade(g, ramp(u, 14.0, 0.4), () => {
          label(g, '영국에서는', LX, y2, { size: 15 });
          const B2 = staff(g, 'dr_gb', { x: LX, y: y2 + 18, w: 780, at: 14.2, u, roleAt: 15.0, size: 22, shapeAt: 15.2 });
          fade(g, ramp(u, 15.6, 0.4), () => tag(g, '= Can I help you find anything?', LX + 66, y2 + 18 + B2.bh + 28, COL.ante, { align: 'left', size: 15, h: 30 }));
        });
      });
      // [17.2, 28] 지나가는 직원 → 내가 먼저 묻기
      const inC = win(u, 17.2, 28.0);
      if (inC > 0.001 && u >= 17.0) fade(g, inC, () => {
        const [qa, where, is] = SH.SCENE.ask;
        const B = staff(g, qa, { x: LX, y: 150, w: 780, at: 17.4, u, roleAt: 18.4, size: 22, shapeAt: 18.6 });
        fade(g, ramp(u, 19.2, 0.4), () => tag(g, '질문이 아니라 안내 → 이제 내가 먼저 물어요', LX + 66, 150 + B.bh + 26, COL.verb, { align: 'left', size: 15, h: 30 }));
        const y = 150 + B.bh + 66;
        const A = answer(g, { x: LX, y, w: 780, A: where, at: 22.8, u, size: 24, verdict: { ok: okOf(qa, where, { item: 'jeans' }), at: 23.6 } });
        answer(g, { x: LX, y: y + A.bh + 14, w: 780, A: is, at: 24.6, u, size: 24, trapAt: 25.2, strikeAt: 25.3, tag: ['jeans → 여럿 · is가 아니라 are', COL.trap, 25.6] });
        fade(g, ramp(u, 26.4, 0.4), () => pieces(g, [['Excuse me', 'pol'], [', where can I find ', 'frame'], ['jeans', 'slot'], ['?', 'frame'], ['   → 하나든 여럿이든 이 틀 하나', '']], LX, y + 2 * A.bh + 60, 19, 780));
      });
      // [28.2, 34] 물건 이름 (콩글리시 → 영어)
      if (u >= 28.0) fade(g, ramp(u, 28.2, 0.4), () => {
        label(g, '물건 이름도 조심해요', LX, 160, { color: COL.accent });
        const NOTE = { hoodt: '한국식 말', onepiece: '영어로는 보통 수영복', padding: '옷 속에 넣는 솜', yshirt: 'white shirt가 줄어든 말' };
        SH.SCENE.names.forEach(([bad, ok], k) => fade(g, ramp(u, 28.6 + k * 1.2, 0.4), () => {
          const y = 214 + k * 86, Bv = SH.SLOT.item.vals[bad], Ov = SH.SLOT.item.vals[ok], at = 28.6 + k * 1.2;
          panel(g, LX, y - 36, 1120, 72, { fill: COL.panel, stroke: COL.faint });
          clothDraw(g, LX + 46, y, 58, ok, ['gray', 'navy', 'black', 'white'][k]);
          txt(g, Bv.ko, LX + 96, y, { size: 22, weight: 800, fam: FD });
          const w = txt(g, Bv.t, LX + 250, y, { size: 22, weight: 700, color: COL.trap });
          strikeLine(g, LX + 244, LX + 256 + w, y + 1, (u - at - 0.5) / 0.4);
          txt(g, '→', LX + 520, y, { size: 22, weight: 700, color: COL.muted });
          txt(g, Ov.t, LX + 566, y, { size: 24, weight: 800, color: COL.clause });
          txt(g, NOTE[bad], LX + 1100, y, { size: 15, weight: 600, color: COL.muted, align: 'right' });
          say(LX + 560, y - 30, 300, 60, Ov.t);
        }));
      });
    },

    /* 04 크기와 색: What size → Yes × → a medium · I'm a medium · free size × · M size · 크기 말하기 → navy or gray → 바꿀 점 바로 → this in · Give me × */
    rack(g, u) {
      if (S.size) {
        const s = S.size, I = SH.ITEMS[s.item], C = { item: s.item, two: I.two, size: s.want }, j = s.a ? SH.judge('rk_size', s.a, C, '상황') : null, f = s.a ? SH.factOf(s.a, SH.Q.rk_size) : {};
        staff(g, 'rk_size', { x: LX, y: 150, w: 780, all: true, u: 99, size: 24 });
        const hl = { [s.want]: COL.clause }; if (f.size && f.size !== s.want && SH.SIZE[f.size]) hl[f.size] = COL.trap;
        txt(g, `${I.ko} → ${SH.KIND_KO[I.kind]}`, LX, 236, { size: 17, weight: 700, color: COL.muted });
        sizeRow(g, LX, 256, I.kind, { hl, cw: 84 });
        hung(g, RX + RW / 2, 170, 1.1, s.item, I.colors[0], SH.SIZE[s.want].tag, { tagStroke: '#1F7A55' });
        if (s.a) { const A = answer(g, { x: LX, y: 360, w: 780, A: s.a, all: true, u: 99, size: 26, verdict: { ok: j.ok, at: -1 } }); const R = richLay(g, why2(j), [], 16, 1100, { weight: 600 }); richDraw(g, R, LX, A.by + A.bh + 30, { color: j.ok ? COL.good : COL.trap }); }
        return;
      }
      const [qz, yes, med, im, free, msize] = SH.SCENE.size, ZC = { item: 'hoodie', two: false, size: 'm' };
      // [0.4, 11.4] What size?
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const B = staff(g, qz, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 24, shapeAt: 1.8 });
        const y = 150 + B.bh + 16;
        const A = answer(g, { x: LX, y, w: 780, A: yes, B: u >= 3.6 ? med : null, p: (u - 3.6) / 0.7, at: 2.2, u, size: 26, trapAt: 2.8, strikeAt: 2.9, verdict: u >= 4.4 ? { ok: okOf(qz, med, ZC), at: 4.4 } : null, tag: ['정보 질문 → 크기가 없어요', COL.trap, 3.0, 3.6] });
        fade(g, ramp(u, 6.2, 0.4), () => {
          const y2 = y + A.bh + 16;
          const A2 = answer(g, { x: LX, y: y2, w: 780, A: im, at: 6.4, u, size: 24, verdict: { ok: okOf(qz, im, ZC), at: 7.2 }, tag: ['I\'m a medium. → 이렇게 말해도 돼요', COL.clause, 7.4] });
          answer(g, { x: LX, y: y2 + A2.bh + 16, w: 780, A: free, at: 8.4, u, size: 24, trapAt: 9.0, strikeAt: 9.1, tag: ['free → 공짜로 들려요 · 한 가지 크기 → one size', COL.trap, 9.4] });
        });
        fade(g, ramp(u, 0.6, 0.5), () => {
          panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
          hung(g, RX + RW / 2, 168, 1.1, 'hoodie', 'gray', u >= 4.4 ? 'M' : '');
          sizeRow(g, RX + 17, 398, 'top', { cw: 46, noLow: true, hl: u >= 4.4 ? { m: COL.clause } : {} });
          txt(g, 'S · M · L → a small · a medium · a large', RX + RW / 2, 462, { size: 12.5, weight: 600, color: COL.muted, align: 'center' });
        });
      });
      // [11.6, 17] M size · 물건마다 크기 말하기
      const inB = win(u, 11.6, 17.0);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        const A = answer(g, { x: LX, y: 150, w: 1120, A: msize, at: 11.8, u, size: 24, verdict: { ok: okOf(qz, msize, ZC), at: 12.5 }, tag: ['M size → 알아듣지만 보통 a medium', COL.rel, 12.6] });
        const ROWS = [['top', '윗옷 · 원피스', 'm', 13.4], ['waist', '바지 · 허리 숫자', 'w32', 14.2], ['shoe', '신발 · 미국 크기', 'u9', 15.0]];
        ROWS.forEach(([kind, nm, hi, at], k) => fade(g, ramp(u, at, 0.4), () => {
          const y = 150 + A.bh + 36 + k * 96;
          txt(g, nm, LX, y + 22, { size: 18, weight: 700 });
          clothDraw(g, LX + 196, y + 22, 44, kind === 'top' ? 'tee' : kind === 'waist' ? 'jeans' : 'sneakers', kind === 'waist' ? 'blue' : 'white');
          sizeRow(g, LX + 250, y, kind, { cw: 92, hl: { [hi]: COL.clause } });
        }));
      });
      // [17.2, 22.6] 고르는 질문: navy or gray
      const inC = win(u, 17.2, 22.6);
      if (inC > 0.001 && u >= 17.0) fade(g, inC, () => {
        const [qc, y0, navy] = SH.SCENE.color;
        const B = staff(g, qc, { x: LX, y: 160, w: 780, at: 17.4, u, roleAt: 18.4, size: 24, shapeAt: 18.6 });
        answer(g, { x: LX, y: 160 + B.bh + 20, w: 780, A: y0, B: u >= 20.2 ? navy : null, p: (u - 20.2) / 0.7, at: 18.8, u, size: 26, trapAt: 19.3, strikeAt: 19.4, verdict: u >= 21.0 ? { ok: okOf(qc, navy, { color: 'navy' }), at: 21.0 } : null, tag: ['고르는 질문 → 고른 것이 없어요', COL.trap, 19.6, 20.2] });
        panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
        [['navy', RX + 80], ['gray', RX + 220]].forEach(([c, x]) => {
          hung(g, x, 180, 0.85, 'hoodie', c);
          txt(g, c, x, 340, { size: 20, weight: 800, color: COL.en, align: 'center' }); txt(g, SH.COLORS[c].ko, x, 366, { size: 13, weight: 600, color: COL.muted, align: 'center' });
          if (c === 'navy' && u >= 21.0) fade(g, ramp(u, 21.0, 0.3), () => { rr(g, x - 66, 168, 132, 214, 12); g.strokeStyle = COL.good; g.lineWidth = 3; g.stroke(); });
          say(x - 66, 168, 132, 214, `${c[0].toUpperCase()}${c.slice(1)}, please.`);
        });
        txt(g, '끝을 내려 말하면 → 고르는 질문', RX + RW / 2, 430, { size: 14, weight: 700, color: COL.rel, align: 'center' });
      });
      // [22.8, 28.4] 잘 찾고 있어요? → 바꿀 점을 바로
      const inD = win(u, 22.8, 28.4);
      if (inD > 0.001 && u >= 22.6) fade(g, inD, () => {
        const [qr, ok] = SH.SCENE.rack, C = SH.INTRO.card;
        const B = staff(g, qr, { x: LX, y: 160, w: 780, at: 23.0, u, roleAt: 23.8, size: 24, shapeAt: 24.0 });
        const A = answer(g, { x: LX, y: 160 + B.bh + 18, w: 780, A: ok, at: 24.6, u, size: 26, verdict: { ok: okOf(qr, ok, C), at: 25.4 } });
        fade(g, ramp(u, 25.8, 0.4), () => tag(g, '바꿀 점을 바로 → 직원이 찾아 줘요', LX + 10, 160 + B.bh + A.bh + 54, COL.clause, { align: 'left' }));
        talk(g, { side: 'L', x: LX, y: 160 + B.bh + A.bh + 92, w: 780, text: SH.reply(SH.Q[qr], ok, C) || 'Sure! Here you go.', kind: 'clerk', sp: 'us', at: 26.6, u, size: 22 });
        handWant(g, RX, 150, RW, C, {});
      });
      // [28.6, 34] this in → thi-sin · Give me a bigger one ×
      if (u >= 28.4) fade(g, ramp(u, 28.6, 0.4), () => {
        const G = { item: 'hoodie', two: false, hsize: 'm', hcolor: 'black', size: 'l', color: 'black' }, [, , give] = SH.SCENE.rack, L0 = SH.o('ch_this', 'z_l');
        linked(g, SH.LINKED[0], LX, 196, u, 28.8);
        answer(g, { x: LX, y: 370, w: 780, A: give, B: u >= 32.8 ? L0 : null, p: (u - 32.8) / 0.7, at: 31.0, u, size: 26, trapAt: 31.6, strikeAt: 31.7, verdict: u >= 33.6 ? { ok: okOf('rk_ok', L0, G), at: 33.6 } : null, tag: ['명령처럼 · 얼마나 큰지 몰라요', COL.trap, 31.9, 32.8] });
        handWant(g, RX, 150, RW, G, {});
      });
    },

    /* 05 탈의실: 안내 → Could I try this on? · this on → fitting × · wear × → 몇 벌 → 어땠나요 → Yes, it did × → tight · loose · fits → 다른 크기 */
    fit(g, u) {
      if (S.fit) {
        const s = S.fit, I = SH.ITEMS[s.item], C = { item: s.item, two: I.two, fit: s.fit }, j = s.a ? SH.judge('ft_how', s.a, C, '상황') : null;
        staff(g, 'ft_how', { x: LX, y: 150, w: 780, all: true, u: 99, size: 24 });
        panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
        fitPic(g, RX + RW / 2, 176, 1.0, s.item, I.colors[0], s.fit);
        txt(g, s.fit === 'good' ? '잘 맞아요' : SH.FIT[s.fit].ko, RX + RW / 2, 330, { size: 20, weight: 800, color: s.fit === 'good' ? COL.good : COL.trap, align: 'center' });
        txt(g, I.two ? `${I.ko} → 둘이 짝 → They` : `${I.ko} → 하나 → It`, RX + RW / 2, 362, { size: 15, weight: 700, color: COL.rel, align: 'center' });
        if (s.fit !== 'good') {
          const L = SH.SIZES[I.kind], mid = L[Math.floor(L.length / 2)], nx = SH.sizeFor(s.item, mid, s.fit);
          if (nx) txt(g, `${SH.SIZE[mid].tag} → ${SH.FIT[s.fit].ko} → 다음 크기 ${SH.SIZE[nx].tag}`, RX + RW / 2, 420, { size: 15, weight: 700, color: COL.clause, align: 'center' });
        }
        if (s.a) { const A = answer(g, { x: LX, y: 236, w: 780, A: s.a, all: true, u: 99, size: 26, verdict: { ok: j.ok, at: -1 } }); const R = richLay(g, why2(j), [], 16, 780, { weight: 600 }); richDraw(g, R, LX, A.by + A.bh + 30, { color: j.ok ? COL.good : COL.trap }); }
        else txt(g, '대답 틀과 칸을 고르면 규칙 엔진이 판정해요.', LX, 270, { size: 17, weight: 600, color: COL.muted });
        return;
      }
      const [qt, could, fitting, wear] = SH.SCENE.tryon, ONE = { item: 'hoodie', two: false };
      // 오른쪽: 탈의실 · 번호표 · 맞음새 · 크기
      fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, 17.0, 0.4)), () => {
        fittingRoom(g, RX, 150, RW, 330, { open: 1 });
        if (u >= 14.6) fade(g, ramp(u, 14.6, 0.4), () => { numTag(g, RX + RW / 2, 330, 2); txt(g, '번호표를 주는 곳도 있어요', RX + RW / 2, 456, { size: 14, weight: 700, color: COL.soft, align: 'center' }); });
      });
      // [0.4, 11.4] 입어 보기
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const B = staff(g, qt, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.8, size: 24, shapeAt: 2.0 });
        const y = 150 + B.bh + 16;
        const A = answer(g, { x: LX, y, w: 780, A: could, at: 2.6, u, size: 26, verdict: { ok: okOf(qt, could, ONE), at: 3.4 } });
        fade(g, win(u, 3.8, 6.2), () => linked(g, SH.LINKED[1], LX + 10, y + A.bh + 54, u, 3.8));
        fade(g, ramp(u, 6.2, 0.4), () => {
          const y2 = y + A.bh + 16;
          const A2 = answer(g, { x: LX, y: y2, w: 780, A: fitting, at: 6.4, u, size: 24, trapAt: 7.0, strikeAt: 7.1, tag: ['입어 보기 → try on', COL.trap, 7.4] });
          answer(g, { x: LX, y: y2 + A2.bh + 16, w: 780, A: wear, at: 8.8, u, size: 24, trapAt: 9.4, strikeAt: 9.5, tag: ['wear → 사서 입고 나가는 말처럼', COL.trap, 9.8] });
        });
      });
      // [11.6, 17] 몇 벌
      const inB = win(u, 11.6, 17.0);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        const [qi, two] = SH.SCENE.items;
        const B = staff(g, qi, { x: LX, y: 160, w: 780, at: 11.8, u, roleAt: 12.6, size: 24, shapeAt: 12.8 });
        const A = answer(g, { x: LX, y: 160 + B.bh + 18, w: 780, A: two, at: 13.2, u, size: 28, verdict: { ok: okOf(qi, two, { count: 2 }), at: 14.0 } });
        fade(g, ramp(u, 14.4, 0.4), () => tag(g, '정보 질문 → 수만 말해요', LX + 10, 160 + B.bh + A.bh + 56, COL.clause, { align: 'left' }));
        fade(g, ramp(u, 13.0, 0.5), () => { hung(g, LX + 120, 380, 0.7, 'hoodie', 'navy', 'M'); hung(g, LX + 250, 380, 0.7, 'hoodie', 'navy', 'L'); txt(g, '두 벌 → Two.', LX + 340, 440, { size: 18, weight: 700, color: COL.clause }); });
      });
      // [17.2, 28.2] 어땠나요?
      const inC = win(u, 17.2, 28.2);
      if (inC > 0.001 && u >= 17.0) fade(g, inC, () => {
        const [qh, yes, tight] = SH.SCENE.fit, F = SH.FITCARD;
        const B = staff(g, qh, { x: LX, y: 150, w: 780, at: 17.4, u, roleAt: 18.0, size: 24, shapeAt: 18.2 });
        const y = 150 + B.bh + 16;
        fade(g, 1 - ramp(u, 22.0, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: yes, at: 18.8, u, size: 26, trapAt: 19.4, strikeAt: 19.5, tag: ['어땠는지가 빠졌어요', COL.trap, 19.8] });
          fade(g, ramp(u, 20.4, 0.4), () => pieces(g, [['Did it fit?', 'key'], [' → Yes, it did.      ', ''], ['How did it fit?', 'key'], [' → 어땠는지 말해요', '']], LX, y + A.bh + 36, 19, 780));
        });
        if (u >= 22.0) {
          const loose = SH.o('fi_theyre', 'loose'), good = SH.o('fi_good');
          const A1 = answer(g, { x: LX, y, w: 780, A: tight, at: 22.6, u, size: 24, verdict: { ok: okOf(qh, tight, F), at: 23.3 }, tag: ['후드 티 → It\'s', COL.clause, 23.5] });
          const A2 = answer(g, { x: LX, y: y + A1.bh + 14, w: 780, A: loose, at: 24.2, u, size: 24, verdict: { ok: okOf(qh, loose, { item: 'jeans', two: true, fit: 'loose' }), at: 24.9 }, tag: ['청바지 → They\'re', COL.clause, 25.1] });
          answer(g, { x: LX, y: y + A1.bh + A2.bh + 28, w: 780, A: good, at: 25.8, u, size: 24, verdict: { ok: okOf(qh, good, { item: 'hoodie', two: false, fit: 'good' }), at: 26.5 }, tag: ['잘 맞으면', COL.clause, 26.7] });
        }
        panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
        const ph = u < 24.2 ? ['hoodie', 'navy', 'tight', '꽉 껴요 · tight'] : u < 25.8 ? ['jeans', 'blue', 'loose', '헐렁해요 · loose'] : ['hoodie', 'navy', 'good', '잘 맞아요'];
        fitPic(g, RX + RW / 2, 176, 1.0, ph[0], ph[1], ph[2]);
        txt(g, ph[3], RX + RW / 2, 350, { size: 20, weight: 800, color: ph[2] === 'good' ? COL.good : COL.trap, align: 'center' });
      });
      // [28.4, 34] 다른 크기 → 한 칸 큰 것
      if (u >= 28.2) fade(g, ramp(u, 28.4, 0.4), () => {
        const [qn, small, large] = SH.SCENE.next, F = SH.FITCARD;
        const B = staff(g, qn, { x: LX, y: 160, w: 780, at: 28.6, u, roleAt: 29.2, size: 24, shapeAt: 29.4 });
        answer(g, { x: LX, y: 160 + B.bh + 20, w: 780, A: small, B: u >= 31.4 ? large : null, p: (u - 31.4) / 0.7, at: 29.8, u, size: 26, trapAt: 30.4, strikeAt: 30.5, verdict: u >= 32.2 ? { ok: okOf(qn, large, F), at: 32.2 } : null, tag: ['꽉 끼는데 더 작은 것?', COL.trap, 30.7, 31.4] });
        panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'M → 꽉 껴요', RX + RW / 2, 186, { size: 18, weight: 800, color: COL.trap, align: 'center' });
        const bx = sizeRow(g, RX + 17, 230, 'top', { cw: 46, noLow: true, hl: u >= 32.2 ? { m: COL.ante, l: COL.clause } : { m: COL.ante } });
        if (u >= 32.2) fade(g, ramp(u, 32.2, 0.4), () => { const a = bx.m, b = bx.l; g.strokeStyle = COL.clause; g.lineWidth = 3; g.beginPath(); g.moveTo(a.x + a.w / 2, a.y + 52); g.quadraticCurveTo((a.x + b.x + b.w) / 2, a.y + 84, b.x + b.w / 2, a.y + 56); g.stroke(); arrowHead(g, b.x + b.w / 2, a.y + 52, -1.2, COL.clause, 11); });
        fade(g, ramp(u, 32.6, 0.4), () => { txt(g, '꽉 끼면 → 한 칸 큰 것', RX + RW / 2, 340, { size: 17, weight: 700, color: COL.clause, align: 'center' }); txt(g, '헐렁하면 → 한 칸 작은 것', RX + RW / 2, 370, { size: 17, weight: 700, color: COL.ante, align: 'center' }); });
      });
    },

    /* 06 값과 할인: how much is this · are these → money × · D.C. × → on sale → $15.00 · fifty percent → fifteen · fifty → 되묻기 → 깎기 × → BOGO */
    price(g, u) {
      if (S.price) {
        const s = S.price, I = SH.ITEMS[s.item], c = { item: s.item, two: I.two, off: s.off, ask: 'price', size: I.kind === 'one' ? null : SH.SIZES[I.kind][1], color: I.colors[0] }, q = SH.simQ('pr_cost', c), p = SH.priceOf(c);
        priceTag(g, RX + 30, 170, 1.0, c);
        talk(g, { side: 'L', x: LX, y: 160, w: 780, text: q.en, marks: q.key.map(k => [k, 'key']).concat([[SH.money(p), 'slot']]), kind: 'clerk', sp: 'us', all: true, u: 99, size: 24 });
        pieces(g, [['읽기 → ', ''], [SH.priceWords(p), 'slot']], LX, 270, 24);
        txt(g, `${SH.priceKo(I.p)}${s.off ? ` → ${s.off}% 할인 → ${SH.priceKo(p)}` : ' (할인 없음)'}`, LX, 318, { size: 18, weight: 700, color: COL.soft });
        txt(g, s.off ? `계산: ${SH.money(I.p)} × (100 − ${s.off}) ÷ 100 = ${SH.money(p)}` : '할인이 없으면 값표의 값 그대로예요.', LX, 356, { size: 16, weight: 600, color: COL.muted });
        say(LX, 250, 600, 40, SH.priceWords(p));
        return;
      }
      const [qp, is, are, money, dc, sale] = SH.SCENE.askp, HC = { item: 'hoodie', two: false, ask: 'price' };
      // [0.4, 11.4] 내가 먼저 값 묻기
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const B = staff(g, qp, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22, shapeAt: 1.8 });
        let y = 150 + B.bh + 14;
        const A1 = answer(g, { x: LX, y, w: 780, A: is, at: 2.6, u, size: 23, verdict: { ok: okOf(qp, is, HC), at: 3.3 } });
        y += A1.bh + 12;
        const A2 = answer(g, { x: LX, y, w: 780, A: are, at: 4.0, u, size: 23, verdict: { ok: okOf(qp, are, { item: 'socks', two: true, ask: 'price' }), at: 4.7 }, tag: ['둘이 짝 → are these', COL.clause, 4.9] });
        y += A2.bh + 12;
        const A3 = answer(g, { x: LX, y, w: 780, A: money, at: 6.4, u, size: 23, trapAt: 7.0, strikeAt: 7.1, tag: ['money → 붙이지 않아요', COL.trap, 7.3] });
        y += A3.bh + 12;
        answer(g, { x: LX, y, w: 780, A: dc, B: u >= 9.8 ? sale : null, p: (u - 9.8) / 0.7, at: 8.4, u, size: 23, trapAt: 9.0, strikeAt: 9.1, verdict: u >= 10.6 ? { ok: okOf(qp, sale, { item: 'hoodie', two: false, ask: 'sale' }), at: 10.6 } : null, tag: ['D.C. → 통하지 않아요', COL.trap, 9.2, 9.8] });
      });
      // 오른쪽: 값표 (처음엔 값이 없고, 직원이 말한 뒤 할인 값)
      const tagC = { item: 'hoodie', size: 'm', color: 'navy', off: 50 };
      fade(g, ramp(u, 0.6, 0.5) * (1 - ramp(u, 28.0, 0.4)), () => priceTag(g, RX + 35, 172, 1.0, tagC, { hide: u < 12.4 }));
      // [11.6, 17] 직원이 말한 값 · fifteen과 fifty
      const inC = win(u, 11.6, 28.2);
      if (inC > 0.001 && u >= 11.2) fade(g, inC, () => {
        const [qc, chk, , take] = SH.SCENE.cost, q = SH.Q[qc], CC = { item: 'hoodie', two: false, amount: 1500, off: 50, take: true };
        const B = talk(g, { side: 'L', x: LX, y: 150, w: 780, text: q.en, marks: [['$15.00', 'slot'], ['fifty percent off', 'key']], kind: kindOf(q), sp: q.sp, at: 11.8, u, size: 23 });
        fade(g, win(u, 13.4, 17.2), () => {
          SH.PAIRS.forEach(([n1, w1, n2, w2], i) => fade(g, ramp(u, 13.6 + i * 0.4, 0.3), () => {
            const x = LX + i * 250, y = 270;
            const draw = (s, xx, yy) => { const m = s.match(/^([a-z]*)([A-Z]+)([a-z]*)$/); let x2 = xx; [[m[1], 0], [m[2], 1], [m[3], 0]].forEach(([p, big]) => { if (!p) return; x2 += txt(g, p.toLowerCase(), x2, yy, { size: big ? 26 : 19, weight: big ? 800 : 500, color: big ? COL.accent : COL.soft }); }); };
            txt(g, n1, x, y, { size: 18, weight: 700, fam: FM, color: COL.muted }); draw(w1, x + 36, y);
            txt(g, n2, x, y + 42, { size: 18, weight: 700, fam: FM, color: COL.muted }); draw(w2, x + 36, y + 42);
            say(x, y - 18, 220, 76, `${w1.toLowerCase()}, ${w2.toLowerCase()}`);
          }));
          fade(g, ramp(u, 15.4, 0.4), () => tag(g, '-teen → 뒤를 세게 · -ty → 앞을 세게', LX, 380, COL.accent, { align: 'left' }));
        });
        // [17.2, 22.4] 되묻기
        fade(g, ramp(u, 17.2, 0.4), () => {
          const y = 150 + B.bh + 16;
          const A = answer(g, { x: LX, y, w: 780, A: chk, at: 17.4, u, size: 24, verdict: { ok: okOf(qc, chk, CC), at: 18.2 } });
          const T = talk(g, { side: 'L', x: LX, y: y + A.bh + 14, w: 780, text: 'Yes, fifteen. One-five.', marks: [['fifteen', 'slot']], kind: 'clerk', sp: 'us', at: 18.8, u, size: 22 });
          fade(g, ramp(u, 20.4, 0.4) * (1 - ramp(u, 22.4, 0.3)), () => tag(g, '숫자만 확인하면 돼요 → 겁내지 말고 물어요', LX + 66, y + A.bh + T.bh + 44, COL.clause, { align: 'left', size: 15, h: 30 }));
          // [22.6, 28] 깎아 달라는 말 × → 사기
          if (u >= 22.4) {
            const cheap = SH.o('pc_cheap'), y2 = y + A.bh + T.bh + 28;
            const A2 = answer(g, { x: LX, y: y2, w: 780, A: cheap, B: u >= 25.2 ? take : null, p: (u - 25.2) / 0.7, at: 22.8, u, size: 24, trapAt: 23.4, strikeAt: 23.5, verdict: u >= 26.0 ? { ok: okOf(qc, take, CC), at: 26.0 } : null, tag: ['조르는 말 · 이런 가게는 보통 값을 깎지 않아요', COL.trap, 23.7, 25.2] });
            talk(g, { side: 'L', x: LX, y: y2 + A2.bh + 14, w: 780, text: SH.reply(q, take, CC) || 'Great choice!', kind: 'clerk', sp: 'us', at: 26.6, u, size: 22 });
          }
        });
      });
      // [28.2, 34] 하나 사면 하나 더
      if (u >= 28.0) fade(g, ramp(u, 28.2, 0.4), () => {
        const [qb, lit, yes] = SH.SCENE.bogo;
        const B = staff(g, qb, { x: LX, y: 160, w: 780, at: 28.4, u, roleAt: 29.4, size: 22, shapeAt: 29.6 });
        answer(g, { x: LX, y: 160 + B.bh + 20, w: 780, A: lit, B: u >= 31.6 ? yes : null, p: (u - 31.6) / 0.7, at: 30.0, u, size: 26, trapAt: 30.6, strikeAt: 30.7, verdict: u >= 32.4 ? { ok: okOf(qb, yes, { bogo: true }), at: 32.4 } : null, tag: ['1+1 → buy one, get one free', COL.trap, 30.9, 31.6] });
        panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
        chip(g, 'BUY 1, GET 1 FREE', RX + RW / 2, 188, { size: 15, weight: 800, fam: FM, color: '#FFFFFF', fill: COL.red, h: 34, r: 8, align: 'center' });
        clothDraw(g, RX + 100, 290, 110, 'socks', 'gray'); clothDraw(g, RX + 200, 290, 110, 'socks', 'white');
        txt(g, '+', RX + RW / 2, 290, { size: 30, weight: 800, color: COL.accent, align: 'center' });
        txt(g, `양말 ${SH.money(SH.ITEMS.socks.p)} → 두 켤레`, RX + RW / 2, 390, { size: 17, weight: 700, color: COL.soft, align: 'center' });
        txt(g, '줄여서 BOGO(보고)라고도 해요', RX + RW / 2, 424, { size: 14, weight: 600, color: COL.muted, align: 'center' });
        say(RX, 150, RW, 330, 'buy one, get one free');
      });
    },

    /* 07 계산대: found × → did · don't have × → don't · vinyl bag × → please · cash or card → 영수증 계산 → 영수증 받기 */
    pay(g, u) {
      if (S.bill) {
        const c = S.bill, q = SH.simQ('py_pay', c), B = SH.bill(c);
        receiptDraw(g, RX - 10, 150, 320, c, { hl: { total: COL.ante } });
        talk(g, { side: 'L', x: LX, y: 160, w: 780, text: q.en, marks: [['Cash or card', 'key'], [SH.money(B.total), 'slot']], kind: 'cashier', sp: 'au', all: true, u: 99, size: 24 });
        pieces(g, [['읽기 → ', ''], [SH.priceWords(B.total), 'slot']], LX, 270, 24); say(LX, 250, 600, 40, SH.priceWords(B.total));
        B.items.forEach((it, k) => txt(g, `${it.ko} ${SH.priceKo(it.c)}${it.off ? ` (${SH.priceKo(it.was)}에서 ${it.off}% 할인)` : it.bogo ? ' (하나 사면 하나 더)' : ''}`, LX, 322 + k * 34, { size: 18, weight: 700, color: COL.soft }));
        txt(g, `모두 ${SH.priceKo(B.total)} · 세금은 빼고 계산한 지어낸 값`, LX, 322 + B.items.length * 34 + 10, { size: 18, weight: 800, color: COL.ante });
        return;
      }
      const D = SH.DEMO;
      const step = (sc, at, mAt, tagT, c, o = {}) => {
        const [qid, bad, ok] = SH.SCENE[sc];
        const B = staff(g, qid, { x: LX, y: 160, w: 780, at, u, roleAt: at + 0.8, size: 24, shapeAt: at + 1.0 });
        const A = answer(g, { x: LX, y: 160 + B.bh + 20, w: 780, A: bad, B: u >= mAt ? ok : null, p: (u - mAt) / 0.7, at: at + 1.4, u, size: 26, trapAt: at + 2.0, strikeAt: at + 2.1, verdict: u >= mAt + 0.8 ? { ok: okOf(qid, ok, c), at: mAt + 0.8 } : null, tag: [tagT, COL.trap, at + 2.3, mAt] });
        return { B, A };
      };
      const counter = (g2, extra) => { panel(g2, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint }); chip(g2, 'CHECKOUT', RX + RW / 2, 186, { size: 13, weight: 700, fam: FM, color: '#E6D2B8', fill: COL.wood, h: 28, r: 6, align: 'center' }); rr(g2, RX + 20, 420, RW - 40, 30, 6); g2.fillStyle = COL.wood; g2.fill(); extra(); };
      // [0.4, 6] 다 찾았나요?
      fade(g, ramp(u, 0.4, 0.4) * (1 - ramp(u, 6.0, 0.3)), () => {
        step('found', 0.8, 4.0, '문장이 끝나지 않아요', {});
        counter(g, () => { hung(g, RX + 110, 220, 0.75, 'hoodie', 'navy', 'L'); clothDraw(g, RX + 210, 330, 70, 'socks', 'gray'); icon(g, 'pay', RX + 220, 240, 60, COL.soft, 1.6); });
      });
      // [6.2, 11.4] 회원 카드
      fade(g, ramp(u, 6.2, 0.4) * (1 - ramp(u, 11.4, 0.3)), () => {
        step('member', 6.4, 9.2, 'have 뒤가 비어요', { member: false });
        counter(g, () => {
          rr(g, RX + 60, 236, 180, 112, 14); g.fillStyle = '#2F4A44'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 2; g.stroke();
          txt(g, 'REWARDS', RX + 150, 270, { size: 18, weight: 800, fam: FM, color: '#F2E6C9', align: 'center' }); txt(g, SH.STORE.toUpperCase(), RX + 150, 300, { size: 11, weight: 700, fam: FM, color: '#CFE3D6', align: 'center' });
          cross(g, RX + 236, 240, 22, COL.bad);
          txt(g, '회원 카드 없음', RX + RW / 2, 380, { size: 16, weight: 700, color: COL.muted, align: 'center' });
        });
      });
      // [11.6, 17] 봉투
      fade(g, ramp(u, 11.6, 0.4) * (1 - ramp(u, 17.0, 0.3)), () => {
        const { B, A } = step('bag', 11.8, 14.4, 'vinyl bag → 비닐 소재 가방처럼 들려요', { bag: true });
        fade(g, ramp(u, 15.6, 0.4), () => { txt(g, '아니면 →', LX + 120, 160 + B.bh + A.bh + 60, { size: 16, weight: 700, color: COL.muted }); answer(g, { x: LX, y: 160 + B.bh + A.bh + 40, w: 780, A: SH.o('bg_no'), all: true, u: 99, size: 22, verdict: { ok: true, at: -1 } }); });
        counter(g, () => { shopBag(g, RX + 110, 400, 1.0); txt(g, 'a bag', RX + 220, 290, { size: 20, weight: 800, color: COL.en, align: 'center' }); txt(g, 'a plastic bag', RX + 220, 322, { size: 14, weight: 700, color: COL.muted, align: 'center' }); txt(g, '(비닐봉지)', RX + 220, 344, { size: 13, weight: 600, color: COL.muted, align: 'center' }); });
      });
      // [17.2, 22.4] 현금이냐 카드냐
      fade(g, ramp(u, 17.2, 0.4) * (1 - ramp(u, 22.4, 0.3)), () => {
        step('paym', 17.4, 20.2, '고른 것이 없어요', { paym: 'card' });
        panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
        reader(g, RX + 65, 180, { amount: SH.money(SH.bill(D).total), state: u >= 21.2 ? 'ok' : 'tap' });
        icon(g, 'card', RX + 60, 460, 30, COL.clause); icon(g, 'cash', RX + 240, 460, 30, COL.muted);
      });
      // [22.6, 27.4] 영수증의 계산
      fade(g, ramp(u, 22.6, 0.4) * (1 - ramp(u, 27.4, 0.3)), () => {
        const R = receiptDraw(g, RX - 40, 150, 340, D, { hl: u >= 25.2 ? { total: COL.ante } : u >= 24.0 ? { 1: COL.clause } : { 0: COL.rel } });
        const B = SH.bill(D), [h0, s0] = B.items;
        const rows = [
          [22.8, [['후드 티 ', ''], [SH.money(h0.was), 'dim'], [' → 50% 할인 → ', ''], [SH.money(h0.c), 'frame']]],
          [24.0, [['양말 두 켤레 ', ''], [SH.money(s0.c), 'slot'], [' → 하나 사면 하나 더', '']]],
          [25.2, [['TOTAL ', ''], [SH.money(B.total), 'key'], ['  → ', ''], [SH.priceWords(B.total), 'key']]],
        ];
        rows.forEach(([at, parts], k) => fade(g, ramp(u, at, 0.4), () => pieces(g, parts, LX, 196 + k * 64, 24, 760)));
        fade(g, ramp(u, 26.0, 0.4), () => tag(g, '세금은 빼고 계산한 지어낸 값 · 영상 · 영수증 · 직원의 말이 같은 계산', LX, 400, COL.muted, { align: 'left', size: 14, h: 30 }));
        void R;
      });
      // [27.6, 32] 영수증 받기
      if (u >= 27.4) fade(g, ramp(u, 27.6, 0.4), () => {
        const [qr, yes] = SH.SCENE.rcpt;
        const B = staff(g, qr, { x: LX, y: 160, w: 760, at: 27.8, u, roleAt: 28.6, size: 24, shapeAt: 28.8 });
        answer(g, { x: LX, y: 160 + B.bh + 20, w: 760, A: yes, at: 29.2, u, size: 26, verdict: { ok: okOf(qr, yes, { receipt: true }), at: 29.9 } });
        fade(g, ramp(u, 30.4, 0.4), () => tag(g, '교환 · 환불하려면 영수증이 필요해요', LX + 10, 160 + B.bh + 120, COL.clause, { align: 'left' }));
        receiptDraw(g, RX - 20, 150, 320, D, { hl: u >= 30.0 ? { policy: COL.clause } : {} });
      });
    },

    /* 08 교환과 환불: 며칠 뒤 → change × → exchange these → Refund me × → return this → 영수증 → 까닭 → 바꿀 크기 → refund or store credit → 규칙상 안 됨 */
    ret(g, u) {
      if (S.ret) {
        const s = S.ret, base = s.ret === 'exchange' ? SH.EXCARD : SH.REFCARD, c = Object.assign({}, base, { days: s.days, receipt: s.receipt, final: s.final }), r = SH.returnRule(c);
        const en = r.ok ? (r.why === 'exchange' ? SH.Q.rt_size.en : r.why === 'choose' ? SH.Q.rt_how.en : SH.Q.rt_credit.en) : r.en;
        const ko = r.ok ? (r.why === 'exchange' ? '교환 → 바꿀 크기를 물어요' : r.why === 'choose' ? '영수증이 있어요 → 환불과 가게 포인트 가운데 골라요' : '영수증이 없어요 → 가게 포인트로만 돌려받아요') : r.ko;
        talk(g, { side: 'L', x: LX, y: 160, w: 780, text: en, marks: r.ok ? [] : [['within thirty days', 'trap'], ['final sale', 'trap']], kind: 'cashier', sp: 'au', all: true, u: 99, size: 22 });
        txt(g, ko, LX + 66, 260, { size: 17, weight: 700, color: r.ok ? COL.good : COL.trap });
        const CH = [['final sale 물건이 아닌가?', !c.final], [`${SH.RETURN_DAYS}일 안인가? → ${c.days}일 뒤`, c.days <= SH.RETURN_DAYS], [c.ret === 'exchange' ? '교환이면 → 바꿀 크기만' : `영수증이 있나? → ${c.receipt ? '있음' : '없음'}`, c.ret === 'exchange' ? true : c.receipt]];
        let stop = false;
        CH.forEach(([t, ok], k) => {
          const y = 320 + k * 56, on = !stop;
          fade(g, on ? 1 : 0.35, () => { panel(g, LX, y - 22, 640, 44, { fill: COL.panel, stroke: on ? (ok ? COL.good : COL.trap) : COL.faint }); txt(g, `${k + 1}. ${t}`, LX + 20, y, { size: 17, weight: 700 }); if (on) mark(g, k < 2 ? ok : true, LX + 610, y, 15); });
          if (k < 2 && !ok) stop = true;
        });
        calendar(g, RX + 70, 160, 160, c.days, { head: 'DAYS LATER', bad: c.days > SH.RETURN_DAYS, sub: `${SH.RETURN_DAYS}일 안에만` });
        if (c.final) chip(g, 'FINAL SALE', RX + 150, 380, { size: 16, weight: 800, fam: FM, color: '#FFFFFF', fill: COL.red, h: 34, r: 8, align: 'center' });
        txt(g, '가게 규칙은 지어낸 것 · 실제 가게마다 달라요', RX + 150, 440, { size: 13, weight: 600, color: COL.muted, align: 'center' });
        return;
      }
      const EX = SH.EXCARD, RF = SH.REFCARD, [qh, change, refund, exch, retn] = SH.SCENE.retw;
      // [0.4, 12] 교환하러 왔어요
      fade(g, ramp(u, 0.4, 0.4) * (1 - ramp(u, 11.8, 0.3)), () => {
        label(g, '며칠 뒤 · 청바지(30)가 작아요', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, qh, { x: LX, y: 182, w: 780, at: 0.8, u, roleAt: 1.6, size: 24, shapeAt: 1.8 });
        const A = answer(g, { x: LX, y: 182 + B.bh + 20, w: 780, A: change, B: u >= 8.8 ? exch : null, p: (u - 8.8) / 0.7, at: 6.2, u, size: 26, trapAt: 6.8, strikeAt: 6.9, verdict: u >= 9.6 ? { ok: okOf(qh, exch, EX), at: 9.6 } : null, tag: ['change → 거스름돈', COL.trap, 7.1, 8.8] });
        fade(g, ramp(u, 10.2, 0.4), () => tag(g, '돌려주고 돈을 받으려면 → I\'d like to return …', LX + 10, 182 + B.bh + A.bh + 60, COL.clause, { align: 'left' }));
        panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
        if (u < 6.4) { calendar(g, RX + 24, 176, 110, EX.days, { sub: '5일 뒤' }); hung(g, RX + 220, 170, 0.8, 'jeans', 'blue', '30'); txt(g, '작아요 · small', RX + 220, 330, { size: 16, weight: 700, color: COL.trap, align: 'center' }); }
        else fade(g, ramp(u, 6.4, 0.4), () => {
          coins(g, RX + 150, 230);
          txt(g, 'change', RX + 150, 300, { size: 24, weight: 800, color: COL.trap, align: 'center' }); txt(g, '거스름돈 · 잔돈', RX + 150, 330, { size: 15, weight: 600, color: COL.muted, align: 'center' });
          txt(g, 'exchange → 바꾸기', RX + 150, 390, { size: 18, weight: 800, color: COL.clause, align: 'center' }); txt(g, 'return → 돌려주기(환불)', RX + 150, 424, { size: 16, weight: 700, color: COL.ante, align: 'center' });
        });
      });
      // [12.2, 18] 환불이면 · 영수증
      fade(g, ramp(u, 12.2, 0.4) * (1 - ramp(u, 18.0, 0.3)), () => {
        label(g, '마음이 바뀐 후드 티 → 환불', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, qh, { x: LX, y: 182, w: 780, all: true, u: 99, size: 22 });
        const A = answer(g, { x: LX, y: 182 + B.bh + 14, w: 780, A: refund, B: u >= 14.0 ? retn : null, p: (u - 14.0) / 0.7, at: 12.4, u, size: 25, trapAt: 13.0, strikeAt: 13.1, verdict: u >= 14.8 ? { ok: okOf(qh, retn, RF), at: 14.8 } : null, tag: ['명령처럼 들려요', COL.trap, 13.3, 14.0] });
        const [qr, here] = SH.SCENE.rcpt2, y2 = 182 + B.bh + A.bh + 28;
        const B2 = staff(g, qr, { x: LX, y: y2, w: 780, at: 15.4, u, roleAt: 16.0, size: 22, shapeAt: 16.2 });
        answer(g, { x: LX, y: y2 + B2.bh + 14, w: 780, A: here, at: 16.8, u, size: 25, verdict: { ok: okOf(qr, here, RF), at: 17.4 } });
        panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
        hung(g, RX + RW / 2, 170, 0.9, 'hoodie', 'beige');
        fade(g, ramp(u, 16.8, 0.4), () => { icon(g, 'receipt', RX + RW / 2, 380, 70, COL.clause, 1.6); txt(g, 'Here it is.', RX + RW / 2, 446, { size: 16, weight: 700, color: COL.clause, align: 'center' }); });
      });
      // [18.2, 24] 까닭 · 바꿀 크기
      fade(g, ramp(u, 18.2, 0.4) * (1 - ramp(u, 24.0, 0.3)), () => {
        const [qw, small] = SH.SCENE.why, [qz, w32] = SH.SCENE.exsize, qwx = SH.simQ(qw, EX);
        label(g, '다시 청바지 교환', LX, 160, { color: COL.accent, size: 16 });
        const B = talk(g, { side: 'L', x: LX, y: 182, w: 780, text: qwx.en, marks: Qm(qwx), kind: kindOf(qwx), sp: qwx.sp, at: 18.4, u, roleAt: 19.0, size: 22, shape: qwx.shape, shapeAt: 19.2 });
        const A = answer(g, { x: LX, y: 182 + B.bh + 14, w: 780, A: small, at: 19.8, u, size: 25, verdict: { ok: okOf(SH.simQ(qw, EX), small, EX), at: 20.5 }, tag: ['청바지 → They\'re', COL.clause, 20.7] });
        const y2 = 182 + B.bh + A.bh + 28;
        const B2 = staff(g, qz, { x: LX, y: y2, w: 780, at: 21.2, u, roleAt: 21.8, size: 22, shapeAt: 22.0 });
        answer(g, { x: LX, y: y2 + B2.bh + 14, w: 780, A: w32, at: 22.6, u, size: 25, verdict: { ok: okOf(SH.simQ(qz, Object.assign({}, EX, { size2: 'w30', size3: 'w32', retWhy: 'small' })), w32, EX), at: 23.2 } });
        panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
        hung(g, RX + 90, 170, 0.75, 'jeans', 'blue', '30'); hung(g, RX + 210, 170, 0.75, 'jeans', 'blue', '32', { tagStroke: '#1F7A55' });
        txt(g, '→', RX + 150, 236, { size: 22, weight: 700, color: COL.accent, align: 'center' });
        sizeRow(g, RX + 20, 360, 'waist', { cw: 58, gap: 8, noLow: true, hl: u >= 23.2 ? { w30: COL.ante, w32: COL.clause } : { w30: COL.ante } });
        txt(g, '작으면 → 한 칸 큰 것', RX + RW / 2, 442, { size: 15, weight: 700, color: COL.clause, align: 'center' });
      });
      // [24.2, 30] 환불이냐 가게 포인트냐
      fade(g, ramp(u, 24.2, 0.4) * (1 - ramp(u, 30.0, 0.3)), () => {
        const [qw, , refundA] = SH.SCENE.way, what = SH.o('rp_what');
        const B = staff(g, qw, { x: LX, y: 160, w: 780, at: 24.4, u, roleAt: 25.0, size: 22, shapeAt: 25.2 });
        const A = answer(g, { x: LX, y: 160 + B.bh + 14, w: 780, A: what, at: 25.6, u, size: 24, verdict: { ok: okOf(qw, what, RF), at: 26.2 }, tag: ['모르면 물어요', COL.clause, 26.3] });
        const T = talk(g, { side: 'L', x: LX, y: 160 + B.bh + A.bh + 28, w: 780, text: 'It\'s money you can only spend in our store.', marks: [['only spend in our store', 'slot']], kind: 'cashier', sp: 'au', at: 26.6, u, size: 22 });
        answer(g, { x: LX, y: 160 + B.bh + A.bh + T.bh + 42, w: 780, A: refundA, at: 28.0, u, size: 26, verdict: { ok: okOf(qw, refundA, RF), at: 28.7 } });
        panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
        [['a refund', '돈으로 돌려받기 (카드 · 현금)', 'cash', COL.clause, 196], ['store credit', '이 가게에서만 쓰는 돈', 'card', COL.ante, 316]].forEach(([en, ko, ic, c, y]) => {
          panel(g, RX + 20, y, RW - 40, 96, { fill: COL.panel2, stroke: c, lw: u >= 28.7 && ic === 'cash' ? 3 : 1.5 });
          icon(g, ic, RX + 56, y + 48, 34, c, 1.7);
          txt(g, en, RX + 90, y + 34, { size: 20, weight: 800, color: c }); txt(g, ko, RX + 90, y + 64, { size: fit(g, ko, 14, RW - 120, 600), weight: 600, color: COL.muted });
          say(RX + 20, y, RW - 40, 96, en);
        });
      });
      // [30.2, 36] 규칙상 안 될 때
      if (u >= 30.0) fade(g, ramp(u, 30.2, 0.4), () => {
        const [qf, bad, ok] = SH.SCENE.final;
        const B = staff(g, qf, { x: LX, y: 160, w: 780, at: 30.4, u, roleAt: 31.2, size: 22, shapeAt: 31.4 });
        answer(g, { x: LX, y: 160 + B.bh + 20, w: 780, A: bad, B: u >= 33.6 ? ok : null, p: (u - 33.6) / 0.7, at: 32.0, u, size: 25, maxW: 560, trapAt: 32.6, strikeAt: 32.7, verdict: u >= 34.4 ? { ok: okOf(qf, ok, {}), at: 34.4 } : null, tag: ['따지는 말 · 직원이 바꿀 수 없는 규칙', COL.trap, 32.9, 33.6] });
        panel(g, RX, 150, RW, 330, { fill: COL.panel, stroke: COL.faint });
        calendar(g, RX + 24, 180, 116, 45, { head: 'DAYS LATER', bad: true, sub: '45일 뒤' });
        calendar(g, RX + 160, 180, 116, SH.RETURN_DAYS, { head: 'RETURNS', sub: `${SH.RETURN_DAYS}일 안에만` });
        txt(g, '45 > 30', RX + RW / 2, 368, { size: 26, weight: 800, fam: FM, color: COL.trap, align: 'center' });
        txt(g, '규칙상 안 되면 → 알겠다고 하고 고맙다고', RX + RW / 2, 420, { size: 14, weight: 700, color: COL.clause, align: 'center' });
      });
    },

    /* 09 3단계 말하기 법: 상자 셋 + 곳마다 한 줄(모양 표시와 함께)이 단계별로 채워짐 */
    method(g, u) {
      const BOX = [['①', '열쇠 낱말 + 모양', 'or → 고르기 · how · what → 정보 · Can I → Y/N', COL.ante, 5.5], ['②', '틀에 내 정보 넣기', '이것 + 바꿀 점 · A medium, please.', COL.rel, 11.5], ['③', '공손하게 끝내기', 'please · thanks · Could I …? · Excuse me', COL.verb, 17.5]];
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
      SH.METHOD.forEach(([qid, a], i) => {
        const y = 300 + i * 39, q = SH.Q[qid], p = SH.PLACE[q.place], dim = sel != null && sel !== i;
        fade(g, ramp(u, 1.4 + i * 0.3, 0.4) * (dim ? 0.35 : 1), () => {
          if (sel === i) { rr(g, LX - 6, y - 18, 1132, 36, 8); g.fillStyle = 'rgba(255,193,94,0.10)'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 1.5; g.stroke(); }
          circ(g, LX + 14, y, 15, COL.panel2); icon(g, p.id, LX + 14, y, 18, ME_FIRST[p.id] ? COL.verb : COL.soft);
          const keysOn = sel != null || u >= 6.0 + i * 0.3, ansOn = sel != null || u >= 12.0 + i * 0.4, polOn = sel != null || u >= 18.0;
          if (keysOn) shapeMark(g, q.shape, LX + 50, y, 16, { disc: false, iw: 2.2 });
          const t = q.short && /[?!]$/.test(q.short) ? q.short : q.en;
          const R = richLay(g, t, keysOn ? Qm(qid) : [], 17, 430, { weight: 500 });
          richDraw(g, R, LX + 70, y, { color: COL.soft });
          say(LX + 66, y - 16, R.w + 8, 32, q.en);
          if (ansOn) fade(g, sel != null ? 1 : ramp(u, 12.0 + i * 0.4, 0.4), () => {
            txt(g, '→', 566, y, { size: 18, weight: 700, color: COL.muted });
            pieces(g, ansParts(a).map(([tt, r]) => [tt, r === 'pol' && !polOn ? 'frame' : r]), 598, y, 18, 600);
            say(594, y - 16, 606, 32, SH.text(a));
          });
        });
      });
    },

    /* 10 실전: 쇼핑 카드 하나로 넷 */
    practice(g, u) {
      const pi = u < PSEG[1] ? 0 : u < PSEG[2] ? 1 : u < PSEG[3] ? 2 : 3, v = u - PSEG[pi];
      const P = SH.PRACTICE[pi], C = SH.PCARD, q = SH.practiceQ(P);
      const a = ramp(v, 0, 0.5) * (pi < 3 ? 1 - ramp(u, PSEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `대화 ${pi + 1} / 4 · ${SH.PLACE[q.place].ko}`, LX, 150, { size: 16, weight: 500, fam: FM, color: COL.accent });
        shopCard(g, LX, 168, 336, C, { rh: 30, vs: 13.5, skip: [0, 4], hl: { rk_ok: 2, ft_how: 3, py_pay: 5, rt_help: 6 }[P.q] });
        talk(g, { side: 'L', x: 432, y: 172, w: 768, text: q.en, marks: Qm(q), kind: kindOf(q), sp: q.sp, at: PT.q, u: v, roleAt: PT.lines[0] + 0.4, size: 22, shape: q.shape, shapeAt: PT.lines[0] + 0.4 });
        const J = P.opts.map(o => SH.judge(q, o, C));
        const goneAt = k => { const s = J[k].stage; if (!s) return null; const same = P.opts.map((_, i) => i).filter(i => J[i].stage === s); return [0, PT.s1, PT.s2, PT.s3][s] + same.indexOf(k) * 1.1; };
        P.opts.forEach((o, k) => {
          const y = 262 + k * 60, gA = goneAt(k), won = k === P.a && v >= PT.win;
          fade(g, ramp(v, PT.opt[k], 0.4), () => {
            if (won) { rr(g, 432, y - 24, 768, 48, 10); g.fillStyle = 'rgba(127,224,168,0.08)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
            const gone = gA != null && v >= gA;
            txt(g, `(${'ABC'[k]})`, 446, y, { size: 18, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
            const parts = ansParts(o).map(([t, r]) => [t, gone ? 'dim' : (v >= PT.lines[1] + 0.4 || won) ? r : '']);
            const w = pieces(g, parts, 494, y, 19, 560, { color: gone ? COL.dim : COL.text });
            say(490, y - 18, w + 10, 36, SH.text(o));
            if (gone) {
              strikeLine(g, 440, 440 + w + 64, y + 1, (v - gA) / 0.4);
              fade(g, ramp(v, gA + 0.3, 0.3), () => tag(g, `${['', '①', '②', '③'][J[k].stage]} 탈락`, 1180, y, COL.trap, { align: 'right', size: 15, h: 30 }));
            }
            if (won) mark(g, true, 1170, y, 17);
          });
        });
        if (pi === 0) fade(g, ramp(v, 3.0, 0.4), () => tag(g, `손에 든 것 ${SH.SIZE[C.hsize].tag} · 바라는 것 ${SH.SIZE[C.size].tag} · 둘이 짝`, 1200, 431, COL.ante, { align: 'right', size: 15, h: 28 }));
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
        ['door', '입구 · 둘러보기', 'yn', 'Can I help you find anything?', [['I\'m just looking, ', 'frame'], ['thanks', 'pol'], ['. · Yes, I\'m looking for ', 'frame'], ['a hoodie', 'slot'], ['.', 'frame']]],
        ['find', '물건 찾기', 'note', '(내가 먼저) Let me know if you need anything!', [['Excuse me', 'pol'], [', where can I find ', 'frame'], ['jeans', 'slot'], ['?', 'frame']]],
        ['rack', '크기와 색', 'wh', 'What size · navy or gray · finding everything', [['A medium', 'slot'], [', ', 'frame'], ['please', 'pol'], ['. · Do you have this ', 'frame'], ['in a medium', 'slot'], ['?', 'frame']]],
        ['fit', '탈의실', 'wh', '(내가 먼저) try on · How did everything fit?', [['Could I', 'pol'], [' try this on? · It\'s a little ', 'frame'], ['tight', 'slot'], ['.', 'frame']]],
        ['price', '값 · 할인', 'note', '(내가 먼저) how much · on sale · percent off', [['Excuse me', 'pol'], [', how much is this? · Great. I\'ll take ', 'frame'], ['it', 'slot'], ['.', 'frame']]],
        ['pay', '계산대', 'or', 'rewards card · a bag · cash or card', [['No, I don\'t. · Yes, ', 'frame'], ['please', 'pol'], ['. · ', 'frame'], ['Card', 'slot'], [', ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        ['ret', '교환 · 환불', 'wh', '(내가 먼저) receipt · refund or store credit', [['I\'d like to exchange ', 'frame'], ['these', 'slot'], ['. · ', 'frame'], ['A refund', 'slot'], [', ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        [null, '이것 + 바꿀 점', null, '손에 든 것과 다른 점만 · 둘이 짝이면 these', [['Do you have ', 'frame'], ['this', 'frame'], [' in a medium', 'slot'], [' in navy', 'slot'], ['?', 'frame']]],
        [null, '못 알아들었을 때', null, '빠른 말 · 숫자 · 모르는 낱말', [['Sorry', 'pol'], [', did you say ', 'frame'], ['fifteen dollars', 'slot'], ['? · ', 'frame'], ['Sorry', 'pol'], [', what\'s store credit?', 'frame']]],
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
        const w = pieces(g, ans, X[2] + 20, y, 16.5, 1196 - X[2] - 30);
        say(X[2] + 16, y - 18, w + 8, 36, ans.map(p => p[0]).join(''));
      }));
    },
  };

  // 이어서 들리는 말: 위 = 쓰인 낱말 (이어지는 곳은 호), 아래 = 들리는 소리 (세게 = 크고 높게)
  function linked(g, L, x, y, u, at) {
    fade(g, ramp(u, at, 0.4), () => {
      const size = 28, gap = 22; let xx = x; const pos = [];
      L.words.forEach(w => { const ww = tw(g, w, size, 600); pos.push([xx, ww]); xx += ww + gap; });
      L.words.forEach((w, i) => { txt(g, w, pos[i][0], y, { size, weight: 600, color: COL.en }); });
      listen(x - 6, y - 24, xx - x, 48, [{ text: L.say || L.en, sp: SH.Q[L.q] ? SH.Q[L.q].sp : 'us', rate: 1.2 }]);
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

  SHS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[SHS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    if (ch.place != null) strip(g, Array.isArray(ch.place) ? (u < (ch.placeAt || 6) ? ch.place[0] : ch.place[1]) : ch.place, ramp(u, 0.2, 0.5));
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, SHS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + SH.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔↗↘✓×÷?!~=+-–—/:…‘’\'%$&<>';
  SHS.baseText = EXTRA;
  SHS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = SHS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { SHS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
