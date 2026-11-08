/* 대중교통 회화 — 영상 장면
 *
 * TRS.render(g, t)는 시각 t와 사용자 상태 TRS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준, 내용은 y 580 위.
 *
 * 그림 말: 여행 길 지도(기차역 넷 + 지하철 셋, 01장은 크게 · 02–08장은 위쪽 작은 띠), 질문의 모양 표시(스위치 · 갈림길 · 빈 상자 · 말풍선),
 * 말풍선(직원 왼쪽 · 나 오른쪽), 대답은 틀(노랑) + 내 정보(민트) 낱말 조각으로 만들고(lay · morph), 함정은 줄을 긋고 주황 이름표로 까닭을 붙여요.
 * 지하철 노선도(metroMap: 노선 셋 · 역 열다섯 · 계산된 길 · 틀린 방향은 주황 점선) · 기차표 · 출발 안내판 · 운임표 · 충전기 · 승강장 · 열차 안 · 여행 카드는 도형으로 그려요.
 * 값 · 길 · 시각은 모두 grammar.js(TR.fare · TR.fareRows · TR.route · TR.say · TR.timeWords)로 계산해요.
 * 역할 색: 열쇠 낱말 하늘 · 대답 틀 노랑 · 내 정보(칸에 넣는 말 · 되짚는 조각) 민트 · 공손한 말 보라 · 함정 주황 · 빈칸 분홍 점선
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(TR.judge · TR.checkLine)으로 정합니다.
 * MP4에는 소리가 없어서, 말은 말풍선 속 낱말이 하나씩 나타나는 모습으로 그려요. 페이지에서는 말풍선을 누르면 그 사람 목소리로 들려줘요.
 */
(function () {
  'use strict';
  const TR = window.TR;
  const TRS = (window.TRS = {});
  const W = 1280, H = 720;
  TRS.W = W; TRS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  TRS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', paper: '#F4F1E8', ink: '#1E2630', teal: '#2F4A44', wood: '#3A2E25', red: '#B8432B',
  };
  TRS.COL = COL;
  // 역할 → 색 (낱말 조각 · 말풍선 글)
  const RC = { key: COL.ante, frame: COL.rel, slot: COL.clause, pol: COL.verb, trap: COL.trap, ok: COL.good, dim: COL.dim, bad: COL.bad };
  TRS.RC = RC;
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8', me: '#F2C29A' };
  const SHC = { yn: COL.ante, or: COL.rel, wh: COL.clause, note: COL.verb };   // 모양 표시의 색
  TRS.SHC = SHC;

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (TRS.S = { stop: null, place: null, shape: null, ticket: null, fare: null, plat: null, trip: null, line: null });
  TRS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  TRS.hits = () => HITS;

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
     곳 일곱(counter · ticket · fare · plat · info · route · train) + 질문의 모양 넷(shape_yn 스위치 · shape_or 갈림길 · shape_wh 빈 상자 · shape_note 말풍선) + 그 밖의 그림
     ========================================================= */
  const ICON = {
    counter: [['M3.5 20.5h17', 's'], ['M5 20.5V9h14v11.5', 's'], ['M3.5 9 12 3.8 20.5 9', 's'], ['M8.5 20.5v-6.5h7v6.5', 's'], ['M12 10.4a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z', 's']],
    ticket: [['M3.5 7h17v3a2 2 0 0 0 0 4v3h-17v-3a2 2 0 0 0 0-4z', 's'], ['M14.5 7v2M14.5 11v2M14.5 15v2', 's']],
    fare: [['M4 9a8 3 0 1 0 16 0a8 3 0 1 0-16 0z', 's'], ['M4 9v6c0 1.7 3.6 3 8 3s8-1.3 8-3V9', 's'], ['M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3', 's']],
    plat: [['M4 3.8h16v9.4H4z', 's'], ['M12 13.2v7.3', 's'], ['M8.5 20.5h7', 's'], ['M10.2 11V6.2h2.6a1.6 1.6 0 0 1 0 3.2h-2.6', 's']],
    info: [['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', 's'], ['M12 11v5.5', 's'], ['M12 7.8h.01', 's']],
    route: [['M4.5 7.5h11', 's'], ['M13 4.5l3 3-3 3', 's'], ['M19.5 16.5H8.5', 's'], ['M11 13.5l-3 3 3 3', 's']],
    train: [['M7 3.5h10a2.5 2.5 0 0 1 2.5 2.5v8.5a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 7 3.5z', 's'], ['M4.5 10h15', 's'], ['M8 13.6h.01M16 13.6h.01', 's'], ['M8.5 17 6.5 20.5M15.5 17l2 3.5', 's']],
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
    pa: [['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 's'], ['M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11', 's']],
    pin: [['M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z', 's'], ['M12 7.6a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8z', 's']],
    seat: [['M7 3.5v11h10.5', 's'], ['M7 14.5V20.5M17.5 14.5v6', 's'], ['M7 9.5h3.5', 's']],
    metro: [['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', 's'], ['M8 16V8.5l4 4.5 4-4.5V16', 's']],
  };
  TRS.ICON = ICON;

  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = (typeof Path2D === 'function' ? new Path2D(d) : null));
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const parts = ICON[id]; if (!parts) return;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach(([d, m]) => { const p = path(d); if (!p) return; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  TRS.icon = icon;
  // HTML용 SVG (색은 currentColor)
  TRS.iconSVG = (id, cls = '', fill) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : m === 'b' && fill ? `<path d="${d}" fill="${fill}"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 질문의 모양 표시: 그림 + 이름 (영상 · 직접 해 보기 · 힌트 · 퀴즈) ---------- */
  function shapeMark(g, shape, cx, cy, size, o = {}) {
    const c = o.color || SHC[shape];
    if (o.disc !== false) { circ(g, cx, cy, size * 0.72, o.fill || COL.panel2); ring(g, cx, cy, size * 0.72, c, o.lw || 2); }
    icon(g, 'shape_' + shape, cx, cy, size, c, o.iw || 2);
  }
  TRS.shapeMark = shapeMark;
  function shapeTag(g, shape, x, y, o = {}) {
    const Sx = TR.SHAPE[shape], t = o.text || `${Sx.ko} → ${Sx.ans}`, size = o.size || 16, h = o.h || 36, c = SHC[shape];
    const w = tw(g, t, size, 700) + h + 22, x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    rr(g, x0, y - h / 2, w, h, 10); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = c; g.lineWidth = 1.6; g.stroke();
    icon(g, 'shape_' + shape, x0 + h / 2 + 4, y, h * 0.62, c, 2);
    txt(g, t, x0 + h + 8, y + 1, { size, weight: 700, color: c });
    return { x: x0, y: y - h / 2, w, h };
  }
  TRS.shapeTag = shapeTag;

  /* ---------- 사람 얼굴 (말풍선 옆). kind: clerk(매표소) · uk(영국 역무원) · info(안내 데스크) · rider(지하철에서 만난 사람) · pa(안내방송) · me ---------- */
  const LOOK = {
    clerk: { shirt: '#2F4A6A', hair: '#3A2A20', skin: '#E3B48D', cap: '#1F2F4A', lanyard: '#FFC15E' },
    uk: { shirt: '#4A2E3A', hair: '#5A3A28', skin: '#E8BC95', cap: '#2B1E26', tie: '#C9A7FF', collar: true },
    info: { shirt: '#2E5A4A', hair: '#2B2420', skin: '#C99169', vest: '#F2D45A' },
    rider: { shirt: '#6A4A2E', hair: '#1F1B18', skin: '#D9A57C', scarf: '#7FA8C9' },
    me: { shirt: '#5D6FA8', hair: '#1F1B18', skin: '#E8BC95', pack: '#3A2C22' },
    pa: { speaker: true },
  };
  TRS.LOOK = LOOK;
  const kindOf = q => { q = typeof q === 'string' ? TR.Q[q] : q; return q.ann ? 'pa' : q.sp === 'ca' ? 'info' : q.sp === 'au' ? 'rider' : q.sp === 'gb' ? 'uk' : 'clerk'; };
  TRS.kindOf = kindOf;
  function avatar(g, x, y, r, kind, o = {}) {
    const L = LOOK[kind] || LOOK.clerk;
    circ(g, x, y, r, COL.panel2);
    if (L.speaker) {
      icon(g, 'pa', x, y, r * 1.05, COL.verb, 2.2);
    } else {
      g.save(); g.beginPath(); g.arc(x, y, r - 1, 0, Math.PI * 2); g.clip();
      g.fillStyle = L.shirt; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
      if (L.vest) {
        g.fillStyle = L.vest;
        [-1, 1].forEach(d => { g.beginPath(); g.moveTo(x + d * r * 0.66, y + r * 0.66); g.lineTo(x + d * r * 0.18, y + r * 0.44); g.lineTo(x + d * r * 0.1, y + r); g.lineTo(x + d * r * 0.74, y + r); g.closePath(); g.fill(); });
        g.fillStyle = '#EEF1F4'; g.fillRect(x - r * 0.66, y + r * 0.8, r * 0.52, r * 0.06); g.fillRect(x + r * 0.14, y + r * 0.8, r * 0.52, r * 0.06);
      }
      if (L.collar) { g.fillStyle = '#EEF1F4'; g.beginPath(); g.moveTo(x - r * 0.2, y + r * 0.42); g.lineTo(x, y + r * 0.62); g.lineTo(x + r * 0.2, y + r * 0.42); g.closePath(); g.fill(); }
      if (L.tie) { g.fillStyle = L.tie; g.beginPath(); g.moveTo(x - r * 0.06, y + r * 0.5); g.lineTo(x + r * 0.06, y + r * 0.5); g.lineTo(x + r * 0.09, y + r * 0.86); g.lineTo(x, y + r * 0.96); g.lineTo(x - r * 0.09, y + r * 0.86); g.closePath(); g.fill(); }
      if (L.scarf) { g.fillStyle = L.scarf; rr(g, x - r * 0.3, y + r * 0.36, r * 0.6, r * 0.16, r * 0.06); g.fill(); rr(g, x + r * 0.1, y + r * 0.42, r * 0.14, r * 0.42, r * 0.05); g.fill(); }
      if (L.lanyard) { g.strokeStyle = L.lanyard; g.lineWidth = Math.max(1, r * 0.06); g.beginPath(); g.moveTo(x - r * 0.16, y + r * 0.4); g.lineTo(x - r * 0.03, y + r * 0.72); g.moveTo(x + r * 0.16, y + r * 0.4); g.lineTo(x + r * 0.03, y + r * 0.72); g.stroke(); g.fillStyle = '#F4F6F8'; rr(g, x - r * 0.13, y + r * 0.7, r * 0.26, r * 0.18, r * 0.03); g.fill(); }
      if (L.pack) { g.strokeStyle = L.pack; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - r * 0.42, y + r * 0.45); g.lineTo(x - r * 0.5, y + r); g.moveTo(x + r * 0.42, y + r * 0.45); g.lineTo(x + r * 0.5, y + r); g.stroke(); }
      g.fillStyle = L.skin; g.fillRect(x - r * 0.1, y + r * 0.18, r * 0.2, r * 0.22);
      circ(g, x, y - r * 0.08, r * 0.34, L.skin);
      g.fillStyle = L.hair; g.beginPath(); g.arc(x, y - r * 0.12, r * 0.36, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
      if (L.cap) {   // 철도 직원 모자 (챙 + 노란 배지)
        g.fillStyle = L.cap; rr(g, x - r * 0.36, y - r * 0.56, r * 0.72, r * 0.2, r * 0.06); g.fill();
        g.beginPath(); g.ellipse(x, y - r * 0.36, r * 0.42, r * 0.08, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#FFC15E'; g.fillRect(x - r * 0.08, y - r * 0.52, r * 0.16, r * 0.1);
      }
      circ(g, x - r * 0.12, y - r * 0.04, r * 0.035, '#2B2420'); circ(g, x + r * 0.12, y - r * 0.04, r * 0.035, '#2B2420');
      g.strokeStyle = 'rgba(120,60,40,0.6)'; g.lineWidth = Math.max(1, r * 0.045); g.beginPath(); g.arc(x, y + r * 0.06, r * 0.1, 0.35, Math.PI - 0.35); g.stroke();
      g.restore();
    }
    ring(g, x, y, r, o.live ? (SPC[o.sp] || COL.soft) : COL.faint, o.live ? 2.6 : 1.5);
    if (o.live) { g.save(); g.globalAlpha *= 0.45; ring(g, x, y, r + 5, SPC[o.sp] || COL.soft, 2); g.restore(); }
  }
  TRS.avatar = avatar;



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
  TRS.richLay = richLay; TRS.richDraw = richDraw;

  /* ---------- 낱말 조각 (대답 만들기): { id, t, r } → lay · morph · drawTok ---------- */
  const PUNCT = /^[.,?!]$/;
  function ansToks(a, o = {}) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    TR.segs(a).forEach(s => s.t.split(/\s+/).forEach(w => {
      if (!w) return;
      const m = w.match(/^(.*?)([.,?!]*)$/);
      if (m[1]) push(m[1], o.role != null ? o.role : s.r);
      if (m[2]) m[2].split('').forEach(p => push(p, ''));
    }));
    return out;
  }
  TRS.ansToks = ansToks;
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
  TRS.talk = talk;
  // 직원의 말 (말 id로): 말풍선 + 열쇠 낱말 (+ 모양 표시)
  const Qobj = q => typeof q === 'string' ? TR.Q[q] : q;
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
    const said = LB && p > 0.5 ? (o.sayB || (o.B ? TR.text(o.B) : null)) : (o.sayA || (o.A ? TR.text(o.A) : null));
    if (!o.noHit && said) listen(bx, by, bw, bh, [{ text: said, sp: 'me' }]);
    return out;
  }
  TRS.answer = answer;
  const okOf = (q, a, c) => TR.judge(q, a, c || TR.DEMO).ok;

  /* ---------- 여행 길 띠 (02–08장 위쪽) ---------- */
  function strip(g, cur, a = 1) {
    fade(g, a, () => {
      const x0 = 812, dx = 64, y = 92;
      g.strokeStyle = COL.faint; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 6, y); g.stroke();
      TR.PLACES.forEach((p, i) => {
        const x = x0 + i * dx, on = i === cur;
        circ(g, x, y, on ? 19 : 14, on ? COL.accent : i < cur ? '#2A3542' : COL.panel);
        ring(g, x, y, on ? 19 : 14, on ? COL.accent : TR.ME_FIRST[p.id] ? 'rgba(201,167,255,0.6)' : COL.faint, 1.5);
        icon(g, p.id, x, y, on ? 22 : 16, on ? '#1D1305' : i < cur ? COL.soft : COL.muted, on ? 2 : 1.8);
      });
      txt(g, `${cur + 1} / 7`, x0 + dx * 6 + 30, y, { size: 13, weight: 500, fam: FM, color: COL.muted });
    });
  }

  /* =========================================================
     대중교통 그림: 노선도 · 기차표 · 출발 안내판 · 지하철 카드 충전기 · 승강장 · 열차 안 · 여행 카드 · 운임표 · 함께 가는 사람
     값과 길은 모두 grammar.js(TR.fare · TR.fareRows · TR.route · TR.say)로 계산해요
     ========================================================= */
  function polyPart(g, pts, f) {
    let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
    let left = L * clamp(f);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) { const d = seg[i - 1], k = Math.min(1, left / d); g.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)); left -= d; }
    g.stroke();
  }
  const polyLen = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  // 끝 역 → 그 노선 (방향 이름 칠하기)
  const TERM_OF = {};
  TR.LINE_IDS.forEach(l => { const s = TR.LINES[l].st; TERM_OF[s[0]] = l; TERM_OF[s[s.length - 1]] = l; });
  // 역 이름 자리 [dx, dy, 정렬] (선과 겹치지 않는 쪽)
  const LAB = {
    westfield: [0, 22, 'center'], parkroad: [0, 22, 'center'], central: [12, 19, 'left'], cityhall: [-10, 21, 'right'], harbor: [0, -20, 'center'], eastpier: [0, -20, 'center'],
    northgate: [15, 0, 'left'], university: [-14, -13, 'right'], market: [15, 0, 'left'], museum: [15, 0, 'left'], southbay: [15, 0, 'left'],
    lakeside: [0, -20, 'center'], oldtown: [12, -15, 'left'], riverside: [13, -12, 'left'], airport: [0, 22, 'center'],
  };
  // 그림 문제의 글자 자리 (이름표 · 노선과 겹치지 않는 쪽)
  const LET = {
    westfield: [0, -21], parkroad: [0, -21], central: [-18, -18], cityhall: [17, -18], harbor: [0, 21], eastpier: [0, 21],
    northgate: [-21, 0], university: [17, -18], market: [-21, 0], museum: [-21, 0], southbay: [-21, 0],
    lakeside: [0, 21], oldtown: [-17, 17], riverside: [-17, 17], airport: [17, -17],
  };
  // 노선도 상자 B = { x, y, w, h, px, py } → 역 자리
  const mapAt = (B, id) => { const s = TR.STN[id].at, px = B.px == null ? 60 : B.px, py = B.py == null ? 34 : B.py; return [B.x + px + s[0] * (B.w - 2 * px) / 6, B.y + py + s[1] * (B.h - 2 * py) / 6]; };
  function pinDraw(g, x, y, s, color) {
    g.fillStyle = color; g.beginPath(); g.arc(x, y - s * 1.3, s * 0.78, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(x, y); g.closePath(); g.fill();
    circ(g, x, y - s * 1.3, s * 0.32, COL.bg);
  }
  /* 노선도. o: { route(TR.route 결과), p(0–1 길 그리기), dim, trap: { line, from, to, p }, here, pin, labels, ls, ts, terms, hubs(0–1 고리), letters: { 역: 'A' }, bold: [역], keep: [역], line(노선 하나만 밝게), bg } */
  function metroMap(g, B, o = {}) {
    const ts = o.ts || 1, R = o.route || null, P = id => mapAt(B, id);
    if (o.bg !== false) panel(g, B.x, B.y, B.w, B.h, { fill: 'rgba(24,32,42,0.6)', stroke: COL.faint, r: 16 });
    const lit = l => o.line ? o.line === l : !R || o.dim === false;
    TR.LINE_IDS.forEach(id => {
      const Ln = TR.LINES[id], pts = Ln.st.map(P);
      g.save(); g.globalAlpha *= lit(id) ? 1 : 0.26;
      g.strokeStyle = Ln.hex; g.lineWidth = 7 * ts; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      g.restore();
    });
    if (R) {
      const legs = R.legs.map(l => ({ c: TR.LINES[l.line].hex, pts: l.via.map(P) }));
      const tot = legs.reduce((s, l) => s + polyLen(l.pts), 0); let left = tot * (o.p == null ? 1 : clamp(o.p));
      legs.forEach(l => { const L = polyLen(l.pts); if (left <= 0 || L <= 0) return; g.strokeStyle = l.c; g.lineWidth = 11 * ts; g.lineCap = 'round'; g.lineJoin = 'round'; polyPart(g, l.pts, Math.min(1, left / L)); left -= L; });
    }
    if (o.trap) {
      const Ln = TR.LINES[o.trap.line], i0 = Ln.st.indexOf(o.trap.from), i1 = Ln.st.indexOf(o.trap.to);
      const seq = i0 <= i1 ? Ln.st.slice(i0, i1 + 1) : Ln.st.slice(i1, i0 + 1).reverse(), pts = seq.map(P), f = o.trap.p == null ? 1 : clamp(o.trap.p);
      if (f > 0 && pts.length > 1) {
        g.strokeStyle = COL.trap; g.lineWidth = 4.5 * ts; g.lineCap = 'round'; g.setLineDash([9, 8]); polyPart(g, pts, f); g.setLineDash([]);
        if (f >= 0.98) { const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]]; arrowHead(g, b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), COL.trap, 14 * ts); }
      }
    }
    TR.STN_IDS.forEach(id => {
      const [x, y] = P(id), hub = TR.HUBS.includes(id), onR = R && R.legs.some(l => l.via.includes(id));
      const dimS = (R && o.dim !== false && !onR && !(o.keep || []).includes(id)) || (o.line && !TR.LINES[o.line].st.includes(id));
      g.save(); if (dimS) g.globalAlpha *= 0.42;
      const r0 = (hub ? 8.5 : 5.5) * ts;
      circ(g, x, y, r0, hub ? '#FFFFFF' : COL.bg);
      ring(g, x, y, r0, hub ? '#1E2630' : '#EEF1F4', (hub ? 2.8 : 2.2) * ts);
      if (hub && o.hubs) { g.save(); g.globalAlpha *= clamp(o.hubs); ring(g, x, y, r0 + 7 * ts, COL.accent, 2.6 * ts); g.restore(); }
      if (o.labels !== false || (o.bold || []).includes(id)) {
        const [dx, dy, al] = LAB[id], tl = o.terms && TERM_OF[id], big = (o.bold || []).includes(id);
        const tc = tl && (!o.line || o.line === tl) ? TR.LINES[tl].hex : null;
        txt(g, TR.STN[id].en, x + dx * ts, y + dy * ts, { size: (o.ls || 13) * ts * (big ? 1.12 : 1), weight: tc || big ? 800 : 600, color: tc || (big ? COL.text : COL.soft), align: al });
      }
      g.restore();
      if (o.letters && o.letters[id]) chip(g, o.letters[id], x + LET[id][0] * ts, y + LET[id][1] * ts, { size: 14 * ts, weight: 800, fam: FM, color: '#1D1305', fill: COL.accent, h: 24 * ts, r: 12 * ts, pad: 6 * ts, align: 'center' });
    });
    if (o.here) {
      const [x, y] = P(o.here);
      circ(g, x, y, 8 * ts, COL.ante); ring(g, x, y, 14 * ts, 'rgba(110,200,255,0.55)', 2.5 * ts);
      if (o.hereTag !== false) chip(g, 'YOU ARE HERE', x, y - 30 * ts, { size: 10.5 * ts, weight: 700, fam: FM, color: '#06243A', fill: COL.ante, h: 20 * ts, r: 6 * ts, pad: 6 * ts, align: 'center' });
    }
    if (o.pin) { const [x, y] = P(o.pin); pinDraw(g, x, y - 4 * ts, 12 * ts, COL.accent); }
    return { P };
  }
  TRS.metroMap = metroMap; TRS.mapAt = mapAt;
  // 노선 칩 (색 + 이름)
  function lineChip(g, id, x, y, o = {}) {
    const Ln = TR.LINES[id];
    return chip(g, Ln.en.replace(/^the /, '').replace(/^\w/, c => c.toUpperCase()), x, y, Object.assign({ size: 15, weight: 800, color: '#10151C', fill: Ln.hex, h: 30, r: 8, pad: 10 }, o));
  }

  // 기차표. c: { dest, type, party, peak, seat, amount }, o: { hl: 칸 이름, w }
  function trainTicket(g, x, y, w, c, o = {}) {
    const h = o.h || 214;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 12); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 12); g.clip(); g.fillStyle = '#B8432B'; g.fillRect(x, y, w, 40); g.restore();
    icon(g, 'ticket', x + 22, y + 20, 20, '#FFFFFF');
    txt(g, (TR.CITY + ' RAIL · TICKET').toUpperCase(), x + 42, y + 21, { size: 13, weight: 700, fam: FM, color: '#FFFFFF' });
    const f = (k, v) => v == null ? '—' : v;
    const T = c.dest ? TR.TOWNS[c.dest] : null, P = c.party ? TR.PARTY[c.party] : null;
    const cells = [
      ['from', 'FROM', 'KELLPORT CENTRAL', x + 16, y + 62, w * 0.5 - 20],
      ['dest', 'TO', T ? T.en.toUpperCase() : null, x + w * 0.5 + 4, y + 62, w * 0.5 - 20],
      ['type', 'TYPE', c.type ? c.type.toUpperCase() : null, x + 16, y + 112, w * 0.33],
      ['party', 'PASSENGERS', P ? `${P.a} ADULT${P.a > 1 ? 'S' : ''}${P.c ? ` + ${P.c} CHILD${P.c > 1 ? 'REN' : ''}` : ''}` : null, x + w * 0.36, y + 112, w * 0.62],
      ['peak', 'VALID', c.peak ? (c.peak === 'offpeak' ? 'OFF-PEAK' : 'ANYTIME') : null, x + 16, y + 162, w * 0.33],
      ['seat', 'SEAT', c.seat ? (c.seat === 'window' ? 'WINDOW' : 'AISLE') : null, x + w * 0.36, y + 162, w * 0.3],
      ['amount', 'PRICE', c.amount != null ? TR.money(c.amount) : null, x + w * 0.68, y + 162, w * 0.3],
    ];
    cells.forEach(([k, lab, v, cx, cy, cw]) => {
      if (o.hl === k) { rr(g, cx - 6, cy - 14, cw + 4, 44, 6); g.fillStyle = 'rgba(31,122,85,0.16)'; g.fill(); g.strokeStyle = '#1F7A55'; g.lineWidth = 2.2; g.stroke(); }
      txt(g, lab, cx, cy - 4, { size: 10, weight: 700, fam: FM, color: '#7A7F86' });
      txt(g, f(k, v), cx, cy + 15, { size: fit(g, f(k, v), k === 'dest' || k === 'from' ? 16 : 14, cw - 4, 700, 9, FM), weight: 700, fam: FM, color: o.hl === k ? '#14623F' : COL.ink });
    });
    g.strokeStyle = 'rgba(30,38,48,0.25)'; g.setLineDash([4, 4]); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 12, y + 92); g.lineTo(x + w - 12, y + 92); g.moveTo(x + 12, y + 142); g.lineTo(x + w - 12, y + 142); g.stroke(); g.setLineDash([]);
    return { h };
  }
  TRS.trainTicket = trainTicket;

  // 출발 안내판 (지어낸 열차). o: { s(크기), chg: 0–1 승강장이 4 → 6으로 바뀜, hl: 줄 번호 }
  const BOARD = [['10:15', 'OAKBRIDGE', 4], ['10:50', 'OAKBRIDGE', 2], ['11:13', 'ASHBY', 7], ['11:30', 'MILLBROOK', 5]];
  TRS.BOARD = BOARD;
  function departureBoard(g, x, y, w, o = {}) {
    const s = o.s || 1, rh = 40 * s, h = 58 * s + BOARD.length * rh + 12 * s, amber = '#FFB347';
    panel(g, x, y, w, h, { fill: '#0B0F14', stroke: '#2A3542', r: 10 * s });
    txt(g, 'DEPARTURES', x + 16 * s, y + 22 * s, { size: 14 * s, weight: 700, fam: FM, color: amber });
    const cx = [x + 16 * s, x + w * 0.3, x + w - 16 * s];
    ['TIME', 'TO', 'PLAT'].forEach((t, i) => txt(g, t, cx[i], y + 46 * s, { size: 10 * s, weight: 700, fam: FM, color: '#8A7140', align: i === 2 ? 'right' : 'left' }));
    BOARD.forEach(([t, to, pl], i) => {
      const yy = y + 58 * s + i * rh + rh / 2, chg = i === 0 && o.chg > 0;
      if (o.hl === i) { rr(g, x + 6 * s, yy - rh / 2 + 3 * s, w - 12 * s, rh - 6 * s, 6 * s); g.fillStyle = 'rgba(255,179,71,0.14)'; g.fill(); g.strokeStyle = amber; g.lineWidth = 1.6; g.stroke(); }
      txt(g, t, cx[0], yy, { size: 17 * s, weight: 700, fam: FM, color: amber });
      txt(g, to, cx[1], yy, { size: fit(g, to, 17 * s, w * 0.48, 700, 8, FM), weight: 700, fam: FM, color: amber });
      if (chg) {
        const blink = o.chg < 1 ? (Math.floor(o.chg * 8) % 2 === 0) : true;
        txt(g, o.chg >= 1 ? '6' : blink ? '6' : '4', cx[2], yy, { size: 19 * s, weight: 800, fam: FM, color: o.chg >= 1 ? '#FF7A5C' : amber, align: 'right' });
        if (o.chg >= 0.4) txt(g, 'PLATFORM CHANGE', cx[1], yy + 15 * s, { size: 8.5 * s, weight: 700, fam: FM, color: '#FF7A5C' });
      } else txt(g, String(pl), cx[2], yy, { size: 19 * s, weight: 800, fam: FM, color: amber, align: 'right' });
    });
    return { h };
  }
  TRS.departureBoard = departureBoard;

  // 지하철 카드 충전기. o: { bal(센트), add(센트), done }
  function topUp(g, x, y, w, o = {}) {
    const h = 300;
    panel(g, x, y, w, h, { fill: '#202A36', stroke: COL.faint, r: 16 });
    txt(g, 'METRO CARD · TOP UP', x + w / 2, y + 26, { size: 12, weight: 700, fam: FM, color: COL.muted, align: 'center' });
    rr(g, x + 24, y + 46, w - 48, 92, 10); g.fillStyle = '#0E1A16'; g.fill(); g.strokeStyle = '#2F4A44'; g.lineWidth = 1.5; g.stroke();
    const bal = o.bal == null ? 40 : o.bal, add = o.add || 0;
    txt(g, 'BALANCE', x + 40, y + 70, { size: 11, weight: 700, fam: FM, color: '#7FE0A8' });
    txt(g, TR.money(o.done ? bal + add : bal), x + w - 40, y + 70, { size: 20, weight: 800, fam: FM, color: '#7FE0A8', align: 'right' });
    if (add) { txt(g, 'ADD', x + 40, y + 108, { size: 11, weight: 700, fam: FM, color: '#FFC15E' }); txt(g, '+ ' + TR.money(add), x + w - 40, y + 108, { size: 20, weight: 800, fam: FM, color: '#FFC15E', align: 'right' }); }
    // 카드
    const cx = x + w / 2, cy = y + 214;
    g.save(); g.translate(cx, cy); g.rotate(-0.08);
    rr(g, -86, -50, 172, 104, 12); g.fillStyle = '#3F8CE0'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; g.stroke();
    icon(g, 'metro', -58, -24, 28, '#FFFFFF', 2);
    txt(g, TR.METRO.toUpperCase(), -36, -24, { size: 12, weight: 800, fam: FM, color: '#FFFFFF' });
    txt(g, 'CARD', -36, -6, { size: 10, weight: 700, fam: FM, color: 'rgba(255,255,255,0.75)' });
    g.restore();
    if (o.done) fade(g, 1, () => { check(g, x + w - 40, y + 262, 18, COL.good); });
    return { h };
  }

  // 승강장 (위에서 본 모습): 위 · 아래 선로, 가운데 승강장과 노란 선. o: { here: 'top' | 'bot', hl: 'this' | 'other', train: 'top' | 'bot' | null, p(열차 들어옴 0–1), line, top, bot(방향 이름) }
  function platformDraw(g, x, y, w, h, o = {}) {
    const Ln = TR.LINES[o.line || 'blue'], th = 54, py0 = y + th + 10, ph = h - 2 * th - 20;
    panel(g, x, y, w, h, { fill: '#141B24', stroke: COL.faint, r: 14 });
    const track = (ty, label, on, hl) => {
      g.fillStyle = 'rgba(238,241,244,0.05)'; g.fillRect(x + 10, ty, w - 20, th);
      g.strokeStyle = 'rgba(238,241,244,0.18)'; g.lineWidth = 2; [ty + 16, ty + th - 16].forEach(yy => { g.beginPath(); g.moveTo(x + 14, yy); g.lineTo(x + w - 14, yy); g.stroke(); });
      if (hl) { rr(g, x + 8, ty - 2, w - 16, th + 4, 8); g.strokeStyle = hl; g.lineWidth = 2.5; g.stroke(); }
      txt(g, label, x + w - 22, ty + th / 2, { size: 13, weight: 700, fam: FM, color: hl || COL.muted, align: 'right' });
      if (on != null) {   // 열차 (선 색)
        const tw2 = w * 0.62, tx = lerp(x - tw2, x + 24, ease(clamp(on)));
        g.save(); rr(g, x + 10, ty, w - 20, th, 0); g.clip();
        rr(g, tx, ty + 8, tw2, th - 16, 12); g.fillStyle = Ln.hex; g.fill();
        for (let k = 0; k < 6; k++) { rr(g, tx + 16 + k * (tw2 - 30) / 6, ty + 15, (tw2 - 30) / 6 - 8, th - 30, 3); g.fillStyle = 'rgba(16,21,28,0.55)'; g.fill(); }
        g.restore();
      }
    };
    track(y + 10, o.top || '← NORTH GATE', o.train === 'top' ? (o.p == null ? 1 : o.p) : null, o.hl === (o.here === 'top' ? 'this' : 'other') ? (o.hl === 'this' ? COL.trap : COL.good) : null);
    track(y + h - th - 10, o.bot || 'SOUTH BAY →', o.train === 'bot' ? (o.p == null ? 1 : o.p) : null, o.hl === (o.here === 'bot' ? 'this' : 'other') ? (o.hl === 'this' ? COL.trap : COL.good) : null);
    // 승강장 + 노란 선
    g.fillStyle = '#2A3542'; g.fillRect(x + 10, py0, w - 20, ph);
    g.fillStyle = '#F2D45A'; g.fillRect(x + 10, py0 + 8, w - 20, 4); g.fillRect(x + 10, py0 + ph - 12, w - 20, 4);
    chip(g, `${TR.STN.central.en.toUpperCase()} · ${Ln.en.replace(/^the /, '').toUpperCase()}`, x + w / 2, py0 + ph / 2, { size: 12, weight: 700, fam: FM, color: '#10151C', fill: Ln.hex, h: 24, r: 6, pad: 8, align: 'center' });
    if (o.here) { const my = o.here === 'top' ? py0 + 26 : py0 + ph - 26; avatar(g, x + 60, my, 15, 'me', {}); }
    return { h };
  }

  // 열차 안: 위쪽 LED 띠 + 창 + 자리 둘(하나에 가방이면 친구 자리). o: { led, ledP(0–1 흐름), bag, free: 빈자리 강조 }
  function trainInside(g, x, y, w, h, o = {}) {
    panel(g, x, y, w, h, { fill: '#1A222C', stroke: COL.faint, r: 16 });
    const amber = '#FFB347';
    rr(g, x + 16, y + 14, w - 32, 34, 6); g.fillStyle = '#0B0F14'; g.fill();
    if (o.led) {
      g.save(); rr(g, x + 18, y + 16, w - 36, 30, 5); g.clip();
      const tw0 = tw(g, o.led, 15, 700, FM), off = o.ledP == null ? 0 : (o.ledP * (tw0 + w)) - w * 0.2;
      txt(g, o.led, x + 26 - Math.max(0, off), y + 32, { size: 15, weight: 700, fam: FM, color: amber });
      g.restore();
    }
    [0, 1].forEach(k => { rr(g, x + 30 + k * (w - 60) / 2, y + 64, (w - 60) / 2 - 16, 90, 12); g.fillStyle = 'rgba(191,227,255,0.12)'; g.fill(); g.strokeStyle = 'rgba(238,241,244,0.18)'; g.lineWidth = 1.5; g.stroke(); });
    // 문 (왼쪽)
    rr(g, x + 10, y + 60, 12, h - 76, 4); g.fillStyle = '#5B6670'; g.fill();
    if (o.doors) txt(g, '← DOORS', x + 30, y + h - 22, { size: 11, weight: 700, fam: FM, color: amber });
    // 자리 둘
    const sy = y + h - 98, sw = (w - 90) / 2;
    [0, 1].forEach(k => {
      const sx = x + 40 + k * (sw + 10);
      rr(g, sx, sy, sw, 26, 8); g.fillStyle = '#3F5A8C'; g.fill();
      rr(g, sx, sy + 26, sw, 30, 6); g.fillStyle = '#34507E'; g.fill();
      if (k === 1 && o.bag) { rr(g, sx + sw / 2 - 26, sy - 6, 52, 40, 8); g.fillStyle = '#7A4A62'; g.fill(); g.strokeStyle = '#4A2C3C'; g.lineWidth = 3; g.beginPath(); g.arc(sx + sw / 2, sy - 6, 14, Math.PI, 0); g.stroke(); }
      if (k === 1 && o.free) { rr(g, sx - 4, sy - 8, sw + 8, 70, 10); g.strokeStyle = COL.good; g.lineWidth = 2.5; g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
      if (k === 0 && o.me) avatar(g, sx + sw / 2, sy - 6, 22, 'me', {});
    });
    return { h };
  }

  // 여행 카드 (시뮬레이터와 같은 칸). o: { skip: [줄 번호], hl: 줄 번호, rh, vs, rows } — 긴 값은 두 줄로
  function tripCard(g, x, y, w, card, o = {}) {
    const all = o.rows || TR.cardRows(card), rows = all.map((r, i) => [r, i]).filter(([, i]) => !o.skip || !o.skip.includes(i)), rh = o.rh || 34, vs = o.vs || 14.5, vx = o.vx || 100;
    const LS = rows.map(([[, v]]) => richLay(g, v, [], vs, w - vx - 14, { weight: 700 }));
    const hs = LS.map(R => Math.max(rh, R.h + 10)), h = 56 + hs.reduce((a, b) => a + b, 0) + 10;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 14); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 14); g.clip(); g.fillStyle = COL.teal; g.fillRect(x, y, w, 44); g.restore();
    icon(g, 'ticket', x + 24, y + 22, 22, '#FFFFFF');
    txt(g, o.title || '여행 카드 · TRIP CARD', x + 44, y + 23, { size: 16, weight: 700, color: '#FFFFFF' });
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
  TRS.tripCard = tripCard;

  // 운임표 (TR.fareRows로 계산). o: { hl: 'total' | 줄 번호 }
  function fareTable(g, x, y, w, c, o = {}) {
    const F = TR.fareRows(c), T = TR.TOWNS[c.dest], rh = 40, h = 70 + F.rows.length * rh + 58;
    panel(g, x, y, w, h, { fill: COL.panel, stroke: COL.faint, r: 14 });
    txt(g, `KELLPORT → ${T.en.toUpperCase()} · ${c.type === 'return' ? 'RETURN' : 'SINGLE'}`, x + 18, y + 26, { size: fit(g, `KELLPORT → ${T.en.toUpperCase()} · RETURN`, 13, w - 36, 700, 9, FM), weight: 700, fam: FM, color: COL.muted });
    txt(g, `편도 ${TR.money(T.single)} · 왕복 ${TR.money(T.ret)} (어른 한 명)`, x + 18, y + 50, { size: 13.5, weight: 600, color: COL.soft });
    F.rows.forEach((r, i) => {
      const yy = y + 70 + i * rh + rh / 2, on = o.hl === i;
      txt(g, r.ko, x + 18, yy, { size: fit(g, r.ko, 15, w - 140, 600), weight: 600, color: on ? COL.clause : COL.text });
      txt(g, (r.c < 0 ? '− ' + TR.money(-r.c) : TR.money(r.c)), x + w - 18, yy, { size: 16, weight: 700, fam: FM, color: on ? COL.clause : r.c < 0 ? COL.good : COL.text, align: 'right' });
    });
    const ty = y + 70 + F.rows.length * rh + 28;
    g.fillStyle = COL.faint; g.fillRect(x + 14, ty - 26, w - 28, 1);
    txt(g, 'TOTAL', x + 18, ty, { size: 15, weight: 800, fam: FM, color: o.hl === 'total' ? COL.ante : COL.muted });
    txt(g, TR.money(F.total), x + w - 18, ty, { size: 22, weight: 800, fam: FM, color: o.hl === 'total' ? COL.ante : COL.text, align: 'right' });
    return { h, total: F.total };
  }
  TRS.fareTable = fareTable;

  // 함께 가는 사람 (어른 크게 · 어린이 작게)
  function partyPic(g, cx, cy, party, o = {}) {
    const P = TR.PARTY[party], n = P.a + P.c, gap = 70, x0 = cx - (n - 1) * gap / 2;
    for (let i = 0; i < n; i++) {
      const kid = i >= P.a, s = kid ? 0.7 : 1, x = x0 + i * gap, top = cy - 40 * s, c = kid ? COL.clause : COL.ante;
      circ(g, x, top - 14 * s, 14 * s, c);
      rr(g, x - 18 * s, top + 4 * s, 36 * s, 54 * s, 14 * s); g.fillStyle = c; g.fill();
      txt(g, kid ? 'child' : 'adult', x, cy + 40, { size: 13, weight: 700, color: kid ? COL.clause : COL.ante, align: 'center' });
    }
  }


  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(곱하기 표)는 자막에 쓰지 않음
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '대중교통 회화 · 표는 골라 말하고 길은 되짚는다', d: 26, caps: [
      [0.4, 5.5, '기차역 매표소에서는 직원이 차례대로 물어요. 지하철에서는 길을 물으면 길고 빠른 대답이 돌아와요.'],
      [5.5, 10.5, '매표소 직원 → Single or return? 왕복표를 사려고 해서 → Yes, please.'],
      [10.5, 16, '직원이 다시 물어요. 고르는 질문에 Yes만 하면 무엇을 골랐는지 몰라요. **고른 것을 말해요** → A return, please.'],
      [16, 21, '갈아타는 길을 들은 뒤 → Okay. Thanks. 하고 끝내지 말고, 들은 조각을 한 줄로 되짚어 확인해요.'],
      [21, 26, '세 단계로 말해요. 열쇠 낱말과 모양을 잡고, 틀에 내 정보를 넣고, 공손하게 끝내요.'],
    ] },
    { id: 'map', n: '01', title: '여행 길 지도', sub: '기차역 넷 · 지하철 셋 · 곳마다 한두 마디', d: 30, caps: [
      [0.4, 6, '오늘의 여행을 일곱 곳으로 나눠 봐요. 먼저 기차역 매표소에서 Oakbridge 가는 표를 사요.'],
      [6, 12, '매표소에서 어디까지 가는지, 표 종류와 사람 수를 말하고, 할인 카드와 값을 확인해요. 그다음 승강장과 시각을 들어요.'],
      [12, 18, '시내에서는 지하철을 타요. 안내 데스크에서 길을 묻고, 갈아타는 길을 들은 뒤, 승강장과 열차 안에서 확인해요.'],
      [18, 24, '보라 테두리 → 내가 먼저 말을 꺼내는 곳이에요. 안내 데스크에서 길 묻기, 승강장과 열차 안.'],
      [24, 30, '역 이름, 노선, 값, 시각은 모두 지어낸 것이에요. 실제 역과 나라마다 절차가 달라요.'],
    ] },
    { id: 'counter', n: '02', title: '매표소 · 질문의 모양', sub: 'Where are you traveling to · 정보 · 고르기 · Yes/No · 안내', d: 34, place: 0, caps: [
      [0.4, 6, '매표소 직원의 질문은 짧고 모양이 정해져 있어요. Where are you traveling to today? → 열쇠 낱말 where → 정보 질문이에요.'],
      [6, 11.5, '정보 질문에 → Yes. 이렇게만 하면 대답이 아니에요. 가는 곳 + please → To Oakbridge, please.'],
      [11.5, 17, 'Single or return? → 고르는 질문. 고른 것 + please. Do you have a student card? → Yes/No 질문.'],
      [17, 22.5, 'It leaves at 10:15 from platform 4. → 물음표가 없는 안내예요. 이럴 때는 들은 숫자를 되짚어요 → So, platform 4 at 10:15?'],
      [22.5, 28, "I go to Oakbridge. → 한국어 ‘가요’를 옮긴 말이에요. Give me a ticket to Oakbridge. → 명령처럼 들려요."],
      [28, 34, '편도까지 한 번에 → A single to Oakbridge, please. 영국 매표소 → Morning! Where to? 같은 뜻이에요.'],
    ] },
    { id: 'ticket', n: '03', title: '표 종류와 사람 수', sub: 'Single or return · One-way or round trip · How many people · Off-peak', d: 34, place: 1, caps: [
      [0.4, 6, 'Single or return? → 편도 → single, 왕복 → return. 오늘 갔다가 돌아오면 → A return, please.'],
      [6, 11.5, 'go-and-back ticket → 통하지 않아요. 미국에서는 → One-way or round trip? 왕복이면 → Round trip, please.'],
      [11.5, 17, '많이 쓰는 말 → 영국 single · return, 미국 one-way · round trip. 어느 쪽을 말해도 알아들어요.'],
      [17, 22.5, 'And how many people are traveling? → 정보 질문. 혼자면 → Just me, please. me alone → 쓸쓸하게 들려 어색해요.'],
      [22.5, 28, '여럿이면 어른과 어린이를 나눠요 → Two adults and one child, please. two persons → 알아듣지만 딱딱해요.'],
      [28, 34, "Off-peak or anytime? 모르는 낱말이면 물어요 → Sorry, what's an off-peak ticket? 덜 붐비는 시간에 타는 싼 표예요."],
    ] },
    { id: 'fare', n: '04', title: '할인과 값', sub: "student card · railcard · fourteen or forty · Can I pay by card", d: 34, place: 2, caps: [
      [0.4, 6, "Do you have a student card? → Yes/No 질문. 없으면 → No, I don't. No, I don't have. → have 뒤가 비어서 틀려요."],
      [6, 11.5, "영국에서는 → Have you got a railcard? 모르는 낱말이면 → Sorry, what's a railcard? 기차 할인 카드예요."],
      [11.5, 17, '직원 → Okay, that\'s $14.50, please. 읽기 → fourteen fifty. 14와 40은 소리가 비슷해요.'],
      [17, 22.5, 'fourteen → 뒤를 세게, forty → 앞을 세게 말해요. 헷갈리면 → Sorry, did you say fourteen fifty?'],
      [22.5, 28, '카드로 내고 싶으면 → Can I pay by card? Card is okay? → 낱말만 옮긴 말이라 어색해요.'],
      [28, 34, 'So expensive. Cheaper, please. → 기차표 값은 정해져 있어 깎지 않아요. 조르는 말처럼 들려요.'],
    ] },
    { id: 'plat', n: '05', title: '승강장과 출발 시각', sub: 'It leaves at 10:15 from platform 4 · So, …? · which platform', d: 32, place: 3, caps: [
      [0.4, 6, 'It leaves at 10:15 from platform 4. → 숫자가 둘이에요. Platform where? → 낱말만 옮긴 말이라 어색해요.'],
      [6, 11.5, '되짚는 틀 → So, platform 4 at 10:15? 10:50으로 잘못 되짚으면 직원이 바로 고쳐 줘요.'],
      [11.5, 17, "시각 읽기 → 10:15 → ten fifteen. 9:05 → nine oh five. 3:00 → three o'clock. 시와 분을 끊어 읽어요."],
      [17, 22.5, "영국 역무원 → Right, the next one's the 10:50 from platform 2. 확인하려면 → Sorry, did you say platform 2 at 10:50?"],
      [22.5, 27.5, '안내처럼 빠른 말 → Sorry folks, platform change! 숫자를 놓쳤으면 → Sorry, which platform?'],
      [27.5, 32, '출발 안내판에서도 확인해요. 시각, 가는 곳, 승강장 → 10:15 · OAKBRIDGE. 6번 승강장.'],
    ] },
    { id: 'info', n: '06', title: '지하철 안내 데스크', sub: 'How do I get to · top up · 노선은 색 · 방향은 끝 역', d: 34, place: 4, caps: [
      [0.4, 6, '지하철 안내 데스크 → Next, please! 안내라서 내가 먼저 말해요 → Hi. How do I get to Museum, please?'],
      [6, 11.5, 'Teach me the way to Museum. → 낱말만 옮긴 말이라 어색해요. 노선을 물어도 돼요 → Hi. Which line goes to Museum?'],
      [11.5, 17, "Would you like a new metro card? 카드가 있으면 → No, thanks. I'd like to top up my card."],
      [17, 22.5, "‘충전’ → charge? 카드로 값을 낸다는 말로 들려요. 돈을 넣는 것 → top up. 얼마를 넣을지 물으면 → Twenty dollars, please."],
      [22.5, 28, '노선도 읽기 → 노선은 색 이름으로, 방향은 그 노선의 끝 역 이름으로 말해요. Park Road 역에서 동쪽 → towards East Pier.'],
      [28, 34, '흰 동그라미는 갈아타는 역이에요 → Central, City Hall, University. 직원은 갈아타기가 가장 적은 길을 알려 줘요.'],
    ] },
    { id: 'route', n: '07', title: '갈아타는 길 되짚기', sub: 'take · towards · change at · get off at · So, I …?', d: 36, place: 5, caps: [
      [0.4, 6.5, '직원의 대답이 길어요 → Take the Green Line towards East Pier and change at Central. Then take the Blue Line towards South Bay and get off at Museum.'],
      [6.5, 12.5, '조각으로 나눠 들어요. 탈 노선 → 방향 → 갈아타는 역 → 갈아탈 노선 → 내릴 역. change at → 이어서 chain-jat 소리가 나요.'],
      [12.5, 18.5, '들은 조각을 한 줄로 되짚어요 → So, I take the Green Line towards East Pier, change at Central to the Blue Line, and get off at Museum?'],
      [18.5, 24, '조각 하나가 틀리면 직원이 그 조각만 고쳐 줘요 → Not quite — towards East Pier, not Westfield.'],
      [24, 30, 'Okay. Thanks. → 되짚지 않으면 틀린 곳을 몰라요. 열차에서 내리다 → get down? 영어로는 → get off.'],
      [30, 36, "갈아타는 곳을 놓쳤으면 → Sorry, where do I change? 다 들었으면 → No, that's all. Thank you so much!"],
    ] },
    { id: 'train', n: '08', title: '열차 안과 승강장', sub: 'announcement · does this train go to · the other side · anyone sitting', d: 34, place: 6, caps: [
      [0.4, 6, '열차 안 안내방송 → The next station is Central. Change here for the Blue Line. 빠르고 한 번만 나와요.'],
      [6, 11.5, '놓쳤으면 옆 사람에게 물어요 → Excuse me, what did the announcement say? 방송은 다시 말해 주지 않아요.'],
      [11.5, 17, 'Central 역 승강장 → Please stand behind the yellow line. 안내예요. 이제 내가 먼저 확인해요 → Excuse me, does this train go to Museum?'],
      [17, 22.5, 'Is this train go to Museum? → is와 go를 함께 써서 틀린 문장이에요. 승강장을 물어도 돼요 → Excuse me, is this the right platform for Museum?'],
      [22.5, 28, 'No, this one goes to North Gate. You need the train on the other side. 고맙다는 말과 함께 → Oh, the other side. Thank you!'],
      [28, 34, '열차 안 → Excuse me, is anyone sitting here? 비어 있으면 → No, go ahead. Yes, sit down. → 누가 앉아 있다는 말이 돼요.'],
    ] },
    { id: 'method', n: '09', title: '3단계 말하기 법', sub: '일곱 곳에 한 줄씩 · 질문의 모양과 함께', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 말하기 법**으로 묶어요.'],
      [5.5, 11.5, '① **열쇠 낱말과 질문의 모양 잡기** → or → 고르기, where · how much → 정보, Do you → Yes/No, 물음표가 없으면 안내.'],
      [11.5, 17.5, '② **틀에 내 정보 넣기** → To Oakbridge, please. 들은 숫자와 길은 조각을 모아 되짚어요 → So, …?'],
      [17.5, 23, '③ **공손하게 끝내기** → please, thanks, Excuse me. 놓쳤으면 → Sorry, which platform?'],
      [23, 28, '일곱 곳에 한 줄씩 적용했어요. 길고 빠른 말일수록 되짚기가 힘이 돼요.'],
    ] },
    { id: 'practice', n: '10', title: '실전 여행', sub: '여행 카드 하나로 네 번', d: 50, caps: [
      [0.4, 4.5, '실전이에요. 여행 카드 → Ashby 왕복, 어른 두 명. 첫 질문 → Single or return?'],
      [4.5, 8.5, '① 고르는 질문 → (B) Yes, please. 고른 것이 없어 탈락. ② (C) go-and-back ticket → 한국식 말이라 탈락.'],
      [8.5, 12.5, '정답 (A) → A return, please.'],
      [12.9, 17, '승강장 안내 → It leaves at 10:15 from platform 4. 셋 모두 승강장과 시각에 대한 말이에요.'],
      [17, 21, '② (A) 10:50 → 들은 시각과 달라 탈락. (B) Platform where? → 낱말만 옮긴 말이라 탈락.'],
      [21, 25, '정답 (C) → So, platform 4 at 10:15?'],
      [25.4, 29.5, '지하철 안내 데스크 → 갈아타는 길을 들었어요. 셋 모두 그 길에 대한 말이에요.'],
      [29.5, 33.5, '② (A) Okay. Thanks. → 되짚지 않아 탈락. (B) change at City Hall → 들은 역과 달라 탈락.'],
      [33.5, 37.5, '정답 (C) → So, I take the Green Line towards East Pier, change at Central to the Blue Line, and get off at Museum?'],
      [37.9, 42, '마지막 → Is there anything else I can help you with? ① Yes/No 질문 → 셋 모두 Yes · No로 답해요.'],
      [42, 46, '② (A) Yes, please. → 더 도와줄 것이 없는데 부탁하는 말이라 탈락.'],
      [46, 50, "③ (B) No. → 고맙다는 말 없이 끊겨 탈락. 정답 (C) → No, that's all. Thank you so much!"],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '곳 · 열쇠 낱말과 모양 · 대답 틀', d: 22, caps: [
      [0.4, 6, '정리해요. 매표소에서는 질문의 모양을 잡고, 고른 것이나 정보 + please → A return, please.'],
      [6, 12, '숫자를 들으면 되짚어요 → So, platform 4 at 10:15? 값이 헷갈리면 → Sorry, did you say fourteen fifty?'],
      [12, 17, '길을 들으면 조각을 모아 한 줄로 → So, I take … and get off at Museum? 틀린 조각만 다시 들으면 돼요.'],
      [17, 22, '아래 **대중교통 시뮬레이터**에서 내 여행 카드로 매표소부터 열차 안까지 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  TRS.CHAPTERS = CHAPTERS; TRS.CAPTIONS = CAPTIONS; TRS.END = END;
  TRS.POSTER = CHAPTERS.find(c => c.id === 'route').t + 15.6;
  TRS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  TRS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 실전 장면의 시각 (구간 시작 · 보기 · ① · ② · ③ · 정답)
  const PSEG = [0, 12.5, 25, 37.5];
  const PT = { q: 0.4, opt: [1.6, 2.2, 2.8], s1: 5.0, s2: 7.0, s3: 9.0, win: 10.0, lines: [0.4, 4.5, 8.5] };
  TRS.PSEG = PSEG;

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
  const ansParts = a => TR.segs(a).map(s => [s.t, s.r]);
  // 되짚기 한 줄을 짧게 (표 · 목록용): So, I take the Green Line … get off at Museum?
  const shortParts = a => {
    if (a.f !== 'line') return ansParts(a);
    const s = TR.segs(a); if (s.length < 5) return ansParts(a);
    return [[s[0].t + ' ', s[0].r], [s[2].t, s[2].r], [' … ', 'frame'], [s[s.length - 2].t, s[s.length - 2].r], [s[s.length - 1].t, s[s.length - 1].r]];
  };
  const shortText = a => shortParts(a).map(p => p[0]).join('');
  TRS.shortText = shortText;
  // 여러 줄로 감싸는 대답 (보기 · 되짚기)
  function wrapAns(g, a, x, y, size, maxW, o = {}) {
    const text = TR.text(a), marks = o.plain ? [] : TR.segs(a).filter(s => s.r && s.r !== 'frame').map(s => [s.t, o.dim ? 'dim' : s.r]);
    const R = richLay(g, text, marks, size, maxW, { weight: 600 });
    richDraw(g, R, x, y - (R.rows - 1) * R.lh / 2, { color: o.dim ? COL.dim : o.color || COL.text });
    return R;
  }
  const why2 = j => `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
  function whyLine(g, j, y, w = 1100, x) { const R = richLay(g, why2(j), [], 17, w, { weight: 600 }); richDraw(g, R, x != null ? x : W / 2 - R.w / 2, y, { color: j.ok ? COL.good : COL.trap }); return R; }
  const ME_FIRST = TR.ME_FIRST;
  const D = TR.DEMO, DR0 = TR.DEMO_ROUTE;
  const okOn = (q, a, c) => TR.judge(q, a, c || D).ok;
  const OT = TR.o;
  /* 직원의 말 + 내 대답 (함정 → 바른 대답). o: { q | text+marks+kind+sp, at, aAt, bad, ok, mAt, tag, tagC, card, size, qsize, w, x, y, maxW, tagY, noVerdict }
     돌려주는 값: { B, A, y: 다음 줄 y } */
  function exch(g, u, o) {
    const x = o.x == null ? LX : o.x, w = o.w || 780, y = o.y == null ? 160 : o.y, at = o.at, aAt = o.aAt == null ? at + 1.4 : o.aAt, size = o.size || 24, card = o.card || D;
    const B = o.q ? staff(g, o.q, Object.assign({ x, y, w, at, u, roleAt: at + 0.8, size: o.qsize || 22, shapeAt: at + 1.0 }, o.qo || {})) : talk(g, Object.assign({ side: 'L', x, y, w, at, u, size: o.qsize || 22 }, o.talk));
    const ay = y + B.bh + (o.gap || 14), jq = o.jq || o.q;
    const vAt = o.bad ? o.mAt + 0.8 : aAt + 0.7;
    const A = answer(g, {
      x, y: ay, w, A: o.bad || o.ok, B: o.bad && u >= o.mAt ? o.ok : null, p: (u - (o.mAt || 0)) / 0.7, at: aAt, u, size, maxW: o.maxW,
      trapAt: o.bad && !o.soft ? aAt + 0.6 : null, strikeAt: o.bad && !o.soft ? aAt + 0.7 : null,
      verdict: o.noVerdict ? null : o.bad ? (o.soft && u < vAt ? { ok: false, at: aAt + 0.7 } : u >= vAt ? { ok: okOn(jq, o.ok, card), at: vAt } : null) : { ok: okOn(jq, o.ok, card), at: vAt },
      tag: o.tag ? [o.tag, o.tagC || COL.trap, aAt + 0.9, o.bad ? o.mAt : o.tagEnd] : null, tagY: o.tagY != null ? ay + o.tagY : null,
    });
    return { B, A, y: ay + A.bh };
  }
  // 오른쪽 칸
  const side = (g, h = 330) => panel(g, RX, 150, RW, h, { fill: COL.panel, stroke: COL.faint });

  const SCENES = {
    /* 00 들어가며: 제목 → Single or return? → Yes, please. × → A return, please. → 갈아타는 길 → Okay. Thanks. × → 되짚기 → 세 단계 */
    intro(g, u) {
      fade(g, ramp(u, 0.2, 0.6) * (1 - ramp(u, 5.0, 0.5)), () => {
        txt(g, '대중교통, 표는 골라 말하고 길은 되짚는다', W / 2, 262, { size: 50, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Public transport English · 기차역 매표소에서 지하철 열차 안까지 일곱 곳', W / 2, 332, { size: 23, weight: 500, color: COL.muted, align: 'center' });
        TR.PLACES.forEach((p, i) => fade(g, ramp(u, 0.9 + i * 0.22, 0.4), () => {
          const x = W / 2 + (i - 3) * 132;
          circ(g, x, 440, 32, COL.panel2); ring(g, x, 440, 32, ME_FIRST[p.id] ? COL.verb : COL.accent, 1.8);
          icon(g, p.id, x, 440, 30, COL.soft);
          txt(g, String(i + 1), x, 392, { size: 14, weight: 700, fam: FM, color: COL.accent, align: 'center' });
          txt(g, p.ko, x, 496, { size: fit(g, p.ko, 15, 126, 600), weight: 600, color: COL.muted, align: 'center' });
          if (i < 6) arrow(g, x + 38, 440, x + 92, 440, i === 3 ? 'rgba(201,167,255,0.5)' : COL.faint, 2, i === 3 ? [4, 5] : null);
        }));
      });
      const it = TR.INTRO, C = Object.assign({}, D, it.card);
      // [5.4, 15.9] 표 종류
      fade(g, ramp(u, 5.4, 0.4) * (1 - ramp(u, 15.8, 0.4)), () => {
        label(g, '기차역 매표소 · 표 종류', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, it.q, { x: LX, y: 186, w: 780, at: 5.8, u, roleAt: 6.8, size: 28, shapeAt: 7.0 });
        fade(g, win(u, 6.6, 14.4), () => thought(g, '(속으로) 왕복표 주세요…', LX + 420, 186 + B.bh + 14, 300));
        const ay = 186 + B.bh + 84;
        const A = answer(g, { x: LX, y: ay, w: 780, A: it.lit, B: u >= 14.4 ? it.ok : null, p: (u - 14.4) / 0.8, at: 7.8, u, size: 30, trapAt: 11.0, strikeAt: 11.2, verdict: u >= 15.2 ? { ok: okOn(it.q, it.ok, C), at: 15.2 } : null });
        fade(g, win(u, 11.4, 14.4), () => {
          talk(g, { side: 'L', x: LX, y: ay + A.bh + 16, w: 780, text: 'Sorry — single or return?', marks: [['single or return', 'key']], kind: 'uk', sp: 'gb', at: 11.6, u, size: 24 });
          tag(g, '고르는 질문에 Yes → 무엇을 골랐는지 몰라요', A.bx + A.bw, ay + A.bh + 100, COL.trap, { align: 'right', size: 15, h: 32 });
        });
        if (u >= 15.2) say(A.bx, ay, A.bw, A.bh, TR.text(it.ok));
        fade(g, ramp(u, 6.0, 0.5), () => trainTicket(g, RX - 10, 196, 320, { dest: 'oakbridge', type: u >= 15.2 ? 'return' : null, party: 'a1' }, { hl: u >= 15.2 ? 'type' : null }));
      });
      // [16, 20.6] 갈아타는 길 → 되짚기
      fade(g, ramp(u, 16.0, 0.4) * (1 - ramp(u, 20.6, 0.5)), () => {
        label(g, '지하철 안내 데스크 · 갈아타는 길', LX, 160, { color: COL.accent, size: 16 });
        const B = staff(g, it.rq, { x: LX, y: 186, w: 800, at: 16.2, u, all: true, size: 19 });
        const ay = 186 + B.bh + 18;
        answer(g, { x: LX, y: ay, w: 800, A: it.skip, B: u >= 18.6 ? it.line : null, p: (u - 18.6) / 0.9, at: 17.4, u, size: 21, maxW: 640, trapAt: 17.9, strikeAt: 18.0, tag: ['되짚지 않으면 틀린 곳을 몰라요', COL.trap, 18.1, 18.6], verdict: u >= 19.6 ? { ok: okOn(it.rq, it.line, C), at: 19.6 } : null });
        metroMap(g, { x: 912, y: 186, w: 290, h: 280, px: 30, py: 26 }, { route: DR0, p: ramp(u, 16.4, 3.0), ts: 0.62, labels: false, bold: ['parkroad', 'central', 'museum'], here: 'parkroad', hereTag: false, pin: 'museum' });
      });
      const STEP = [
        ['①', '열쇠 낱말 + 모양', 'Single or return?', '고르는 질문 → 고른 것 + please', COL.ante, 'Single or return?'],
        ['②', '틀에 내 정보 넣기', 'So, platform ___ at ___?', '들은 숫자 · 길 → 되짚기', COL.rel, 'So, platform 4 at 10:15?'],
        ['③', '공손하게 끝내기', 'Sorry, where do I change?', 'please · thanks · Excuse me', COL.verb, 'Sorry, where do I change?'],
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

    /* 01 여행 길 지도: 왼쪽 기차역(넷) · 오른쪽 지하철 노선도(셋) */
    map(g, u) {
      const sel = S.stop != null ? S.stop : null;
      const SB = { x: 70, y: 146, w: 520, h: 322 }, MP = { x: 620, y: 146, w: 590, h: 322 }, MB = { x: 620, y: 150, w: 430, h: 318, px: 50, py: 40 };
      // 곳 표시 자리 · 두 줄 이름 (기차역 넷은 창구와 승강장 위, 지하철 셋은 오른쪽 목록)
      const POS = { counter: [154, 252], ticket: [250, 252], fare: [346, 252], plat: [300, 380], info: [1084, 236], route: [1084, 316], train: [1084, 396] };
      const NM = { counter: ['매표소', '어디까지'], ticket: ['표 종류', '몇 명'], fare: ['할인', '값'], plat: ['승강장', '출발 시각'], info: ['안내 데스크', '길 묻기'], route: ['갈아타기', '안내'], train: ['승강장', '열차 안'] };
      const ON_MAP = { info: 'parkroad', route: 'central', train: null };
      const metroOn = u >= 12 || sel != null;
      fade(g, ramp(u, 0.3, 0.6), () => {
        panel(g, SB.x, SB.y, SB.w, SB.h, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        txt(g, `TRAIN STATION · ${TR.STATION.toUpperCase()}`, SB.x + 20, SB.y + 24, { size: 12, weight: 700, fam: FM, color: COL.muted });
        txt(g, 'TICKETS', SB.x + 180, SB.y + 50, { size: 11, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
        rr(g, SB.x + 30, SB.y + 62, 300, 118, 10); g.fillStyle = COL.wood; g.fill();
        [0, 1, 2].forEach(k => { rr(g, SB.x + 44 + k * 96, SB.y + 72, 80, 52, 6); g.fillStyle = 'rgba(191,227,255,0.14)'; g.fill(); });
        departureBoard(g, SB.x + 350, SB.y + 50, 150, { s: 0.56 });
        [0, 1].forEach(k => {
          const py = SB.y + 200 + k * 40;
          g.fillStyle = 'rgba(238,241,244,0.05)'; g.fillRect(SB.x + 24, py, SB.w - 48, 28);
          g.fillStyle = '#F2D45A'; g.fillRect(SB.x + 24, py + 28, SB.w - 48, 3);
        });
        txt(g, 'PLATFORMS 1–7', SB.x + SB.w - 30, SB.y + 290, { size: 11, weight: 700, fam: FM, color: COL.muted, align: 'right' });
        panel(g, MP.x, MP.y, MP.w, MP.h, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        metroMap(g, MB, { bg: false, route: metroOn ? DR0 : null, p: sel != null ? 1 : ramp(u, 12.2, 4.6), ts: 0.8, ls: 13.5, keep: ['parkroad', 'museum'], here: metroOn ? 'parkroad' : null, hereTag: false, pin: metroOn ? 'museum' : null });
        txt(g, `METRO · ${TR.METRO.toUpperCase()}`, MP.x + 20, MP.y + 24, { size: 12, weight: 700, fam: FM, color: COL.muted });
        g.fillStyle = COL.faint; g.fillRect(1058, 196, 1, 240);
      });
      fade(g, ramp(u, 11.6, 0.4), () => { arrow(g, 596, 300, 616, 300, 'rgba(201,167,255,0.7)', 2.2); txt(g, '다른 날 · 시내', MP.x + MP.w - 20, MP.y + 24, { size: 12, weight: 700, color: COL.verb, align: 'right' }); });
      const AT = [1.0, 3.0, 5.2, 9.4, 12.6, 14.4, 16.2];
      TR.PLACES.forEach((p, i) => {
        const [x, y] = POS[p.id], on = sel === i, dim = sel != null && !on, me = ME_FIRST[p.id] && u >= 18.2, metro = i >= 4;
        fade(g, ramp(u, AT[i], 0.45) * (dim ? 0.4 : 1), () => {
          const r = metro ? 20 : 22;
          circ(g, x, y, r, on ? COL.accent : COL.panel2); ring(g, x, y, r, on ? COL.accent : me ? COL.verb : COL.ante, me ? 3 : 2.2);
          icon(g, p.id, x, y, metro ? 22 : 24, on ? '#1D1305' : COL.text);
          chip(g, String(i + 1), x + 17, y - 19, { size: 11, fam: FM, weight: 700, color: '#1D1305', fill: COL.accent, h: 18, r: 9, pad: 5, align: 'center' });
          const [l1, l2] = NM[p.id], wood = i < 3;
          if (metro) {
            txt(g, l1, x + 30, y - 8, { size: 13, weight: 700, color: me ? COL.verb : COL.soft });
            txt(g, l2, x + 30, y + 10, { size: 12, weight: 600, color: me ? COL.verb : COL.muted });
            // 노선도 위의 번호
            const st = ON_MAP[p.id];
            const [mx, my] = st ? mapAt(MB, st) : (() => { const [ax, ay] = mapAt(MB, 'market'), [bx, by] = mapAt(MB, 'museum'); return [(ax + bx) / 2, (ay + by) / 2]; })();
            chip(g, String(i + 1), mx + (st ? 15 : 18), my - (st ? 17 : 0), { size: 11, fam: FM, weight: 700, color: '#1D1305', fill: me ? COL.verb : COL.accent, h: 18, r: 9, pad: 5, align: 'center' });
          } else {
            const ly = y + (i < 3 ? 38 : 48);
            txt(g, l1, x, ly, { size: 13, weight: 700, color: me ? COL.verb : wood ? '#F2E6D2' : COL.soft, align: 'center' });
            txt(g, l2, x, ly + 17, { size: 12, weight: 600, color: me ? COL.verb : wood ? '#E6D2B8' : COL.muted, align: 'center' });
          }
        });
        HITS.push({ x: x - 26, y: y - 26, w: metro ? 130 : 52, h: 52, stop: i });
      });
      // 아래 칸
      const by = 480, bh = 98;
      if (sel != null) {
        const p = TR.PLACES[sel];
        panel(g, LX, by, 1120, bh, { fill: COL.panel, stroke: COL.accent });
        icon(g, p.id, LX + 28, by + 24, 22, COL.accent);
        txt(g, `${sel + 1}. ${p.ko}`, LX + 48, by + 24, { size: 17, weight: 700, color: COL.accent });
        TR.ROUTE[p.id].forEach((qid, k) => {
          const q = TR.Q[qid], t = q.short && /[?!.]$/.test(q.short) && q.short.length < 60 ? q.short : q.en, R = richLay(g, t, q.fast ? [] : Qm(q), 17, 590, { weight: 600 });
          shapeMark(g, q.shape, LX + 34, by + 54 + k * 28, 14, { disc: false, iw: 2.2 });
          if (R.rows > 1) txt(g, t, LX + 52, by + 54 + k * 28, { size: fit(g, t, 17, 590, 600), weight: 600, color: COL.en });
          else richDraw(g, R, LX + 52, by + 54 + k * 28, { color: COL.en });
          say(LX + 48, by + 40 + k * 28, Math.min(R.w, 600) + 8, 28, q.en);
        });
        txt(g, '대답 →', LX + 690, by + 24, { size: 14, weight: 700, color: COL.muted });
        TR.ROUTE[p.id].map(id => TR.Q[id]).forEach((q, k) => { const a = TR.model(q, D), t = shortText(a); txt(g, t, LX + 690, by + 54 + k * 28, { size: fit(g, t, 16, 420, 600), weight: 600, color: COL.rel }); say(LX + 686, by + 40 + k * 28, 430, 28, TR.text(a)); });
      } else {
        TR.PLACES.forEach((p, i) => fade(g, ramp(u, 6.2 + i * 0.5, 0.4), () => {
          const x = LX + i * 161, q = TR.Q[TR.ROUTE[p.id][0]], t = q.short && q.short.length < 48 ? q.short : q.en, me = ME_FIRST[p.id] && u >= 18.2;
          panel(g, x, by, 151, bh, { fill: COL.panel, stroke: me ? COL.verb : COL.faint, lw: me ? 2 : 1.5 });
          txt(g, `${i + 1}`, x + 14, by + 20, { size: 13, weight: 700, fam: FM, color: COL.accent });
          txt(g, me ? '내가 먼저' : '직원이 말함', x + 140, by + 20, { size: 12, weight: 700, color: me ? COL.verb : COL.muted, align: 'right' });
          const R = richLay(g, t, [], 14, 130, { weight: 600 });
          richDraw(g, R, x + 12, by + 48, { color: COL.en });
          say(x, by, 151, bh, q.en);
        }));
        fade(g, ramp(u, 24.2, 0.5), () => tag(g, '역 · 노선 · 값 · 시각은 지어낸 것', 1200, 126, COL.muted, { align: 'right', size: 14, h: 26 }));
      }
    },

    /* 02 매표소 · 질문의 모양: 정보 · 고르기 · Yes/No · 안내 → 가는 곳 말하기의 함정 → 편도까지 한 번에 · 영국 매표소 */
    counter(g, u) {
      if (S.shape) {
        const q = TR.Q[S.shape], Sx = TR.SHAPE[q.shape], a = TR.model(q, D);
        const B = staff(g, q, { x: LX, y: 160, w: 1100, all: true, u: 99, size: 26 });
        shapeTag(g, q.shape, LX, 160 + B.bh + 40, { size: 18, h: 42 });
        txt(g, Sx.say, LX, 160 + B.bh + 96, { size: 19, weight: 600, color: COL.soft });
        if (q.shape === 'yn' && Sx.offer) txt(g, Sx.offer, LX, 160 + B.bh + 130, { size: 16, weight: 600, color: COL.muted });
        answer(g, { x: LX, y: 160 + B.bh + 160, w: 1100, A: a, all: true, u: 99, size: 26, verdict: { ok: true, at: -1 } });
        return;
      }
      const SH4 = TR.SCENE.shapes, RY = [150, 248, 346, 444], AT = [[0.8, 6.4, 9.6], [11.8, 13.2], [14.4, 15.6], [17.4, 19.0, 20.6]];
      fade(g, 1 - ramp(u, 22.2, 0.4), () => SH4.forEach(([qid, bad, ok], k) => {
        const [at, aAt, mAt] = AT[k];
        if (u < at - 0.4) return;
        const y = RY[k], q = TR.Q[qid];
        const B = staff(g, qid, { x: LX, y, w: 600, at, u, roleAt: at + 0.8, size: 20, shape: false });
        fade(g, ramp(u, at + 1.2, 0.4), () => shapeTag(g, q.shape, LX + 66, y + B.bh + 20, { size: 14, h: 28 }));
        const useBad = k === 0 || k === 3;
        answer(g, { x: 640, y: y + 4, w: 560, A: useBad ? bad : ok, B: useBad && u >= mAt ? ok : null, p: (u - (mAt || 0)) / 0.7, at: aAt, u, size: 22,
          trapAt: useBad ? aAt + 0.6 : null, strikeAt: useBad ? aAt + 0.7 : null,
          verdict: useBad ? (u >= mAt + 0.8 ? { ok: okOn(qid, ok), at: mAt + 0.8 } : null) : { ok: okOn(qid, ok), at: aAt + 0.7 },
          tag: useBad ? [k === 0 ? '정보 질문에 Yes → 대답이 아니에요' : '안내에 Yes → 들은 숫자를 되짚어요', COL.trap, aAt + 0.9, mAt] : null, tagY: y + 76 });
      }));
      // [22.5, 34] 가는 곳 말하기: 가요 · 명령 → 편도까지 한 번에 · 영국
      if (u >= 22.2) fade(g, ramp(u, 22.4, 0.4), () => {
        const [qid, goA, giveA, toA, sglA] = TR.SCENE.dest;
        const B = staff(g, qid, { x: LX, y: 160, w: 780, at: 22.6, u, roleAt: 23.2, size: 22, shapeAt: 23.4 });
        let y = 160 + B.bh + 14;
        fade(g, 1 - ramp(u, 27.8, 0.4), () => {
          const A1 = answer(g, { x: LX, y, w: 780, A: goA, at: 23.4, u, size: 23, trapAt: 24.0, strikeAt: 24.1, tag: ['한국어 ‘가요’를 옮긴 말', COL.trap, 24.3] });
          answer(g, { x: LX, y: y + A1.bh + 12, w: 780, A: giveA, at: 25.2, u, size: 23, trapAt: 25.8, strikeAt: 25.9, tag: ['명령처럼 들려요 · please도 없어요', COL.trap, 26.1] });
        });
        if (u >= 27.8) fade(g, ramp(u, 28.0, 0.4), () => {
          const A = answer(g, { x: LX, y, w: 780, A: sglA, at: 28.2, u, size: 23, verdict: { ok: okOn(qid, sglA), at: 28.9 }, tag: ['편도까지 한 번에 → 직원이 표 종류를 건너뛰어요', COL.clause, 29.2] });
          const y2 = y + A.bh + 22;
          const B2 = talk(g, { side: 'L', x: LX, y: y2, w: 780, text: TR.Q.ct_gb.en, marks: Qm('ct_gb'), kind: 'uk', sp: 'gb', at: 30.4, u, size: 22, shape: 'wh', shapeAt: 31.0 });
          fade(g, ramp(u, 31.0, 0.4), () => tag(g, '영국 매표소 · 같은 뜻', LX + 70 + B2.bw, y2 + B2.bh / 2, COL.ante, { align: 'left', size: 14, h: 28 }));
          answer(g, { x: LX, y: y2 + B2.bh + 12, w: 780, A: toA, at: 31.8, u, size: 23, verdict: { ok: okOn('ct_gb', toA), at: 32.5 } });
        });
        // 오른쪽: 기차표 (가는 곳 · 편도가 채워짐)
        trainTicket(g, RX - 10, 172, 320, { dest: u >= 28.9 ? 'oakbridge' : null, type: u >= 28.9 ? 'single' : null }, { hl: u >= 28.9 ? 'dest' : null });
      });
    },

    /* 03 표 종류와 사람 수: return ✓ · go-and-back × · 미국 말 · 두 나라 말 · 몇 명 · 어른과 어린이 · off-peak 묻기 */
    ticket(g, u) {
      if (S.ticket) {
        const s = S.ticket, us = s.country === 'us', qid = us ? 'tk_us' : 'tk_type', v = s.type === 'return' ? (us ? 'round' : 'return') : (us ? 'oneway' : 'single');
        const C = Object.assign({}, D, { type: s.type, party: s.party, peak: s.peak, seat: s.seat });
        let y = 160;
        const r1 = exch(g, 99, { q: qid, at: -9, ok: OT('tt_pl', v), card: C, y, qo: { all: true } }); y = r1.y + 22;
        const pv = s.party === 'a1' ? 'me1' : s.party;
        exch(g, 99, { q: 'tk_many', at: -9, ok: OT('pc_pl', pv), card: C, y, qo: { all: true } });
        trainTicket(g, RX - 10, 160, 320, { dest: 'oakbridge', type: s.type, party: s.party, peak: s.peak, seat: s.seat }, {});
        txt(g, us ? '미국 → one-way · round trip' : '영국 → single · return', RX + 150, 406, { size: 15, weight: 700, color: COL.ante, align: 'center' });
        return;
      }
      // [0.4, 11.4] Single or return → return ✓ · go-and-back × · 미국
      fade(g, ramp(u, 0.3, 0.4) * (1 - ramp(u, 11.2, 0.4)), () => {
        const B = staff(g, 'tk_type', { x: LX, y: 160, w: 780, at: 0.8, u, roleAt: 1.4, size: 22, shapeAt: 1.6 });
        let y = 160 + B.bh + 14;
        const A1 = answer(g, { x: LX, y, w: 780, A: OT('tt_pl', 'return'), at: 2.2, u, size: 23, verdict: { ok: okOn('tk_type', OT('tt_pl', 'return'), Object.assign({}, D, { type: 'return' })), at: 2.9 } });
        y += A1.bh + 12;
        const A2 = answer(g, { x: LX, y, w: 780, A: OT('tt_pl', 'goback'), at: 6.2, u, size: 23, trapAt: 6.8, strikeAt: 6.9, tag: ['‘왕복표’를 그대로 옮긴 말 → 통하지 않아요', COL.trap, 7.1] });
        y += A2.bh + 18;
        const B2 = talk(g, { side: 'L', x: LX, y, w: 780, text: TR.Q.tk_us.en, marks: Qm('tk_us'), kind: 'clerk', sp: 'us', at: 8.4, u, size: 22, shape: 'or', shapeAt: 9.0 });
        fade(g, ramp(u, 8.8, 0.4), () => tag(g, '미국', LX + 70 + B2.bw, y + B2.bh / 2, COL.ante, { align: 'left', size: 14, h: 28 }));
        answer(g, { x: LX, y: y + B2.bh + 12, w: 780, A: OT('tt_pl', 'round'), at: 9.6, u, size: 23, verdict: { ok: okOn('tk_us', OT('tt_pl', 'round'), Object.assign({}, D, { type: 'return' })), at: 10.3 } });
        trainTicket(g, RX - 10, 172, 320, { dest: 'oakbridge', type: u >= 2.9 ? 'return' : null }, { hl: u >= 2.9 && u < 6.0 ? 'type' : null });
      });
      // [11.6, 17] 두 나라 말 + 이어서 들리는 말
      fade(g, win(u, 11.6, 17.0), () => {
        panel(g, LX, 160, 780, 168, { fill: COL.panel, stroke: COL.faint });
        const cx = [LX + 24, LX + 260, LX + 520];
        ['', '영국 (UK)', '미국 (US)'].forEach((h, i) => txt(g, h, cx[i], 190, { size: 16, weight: 700, color: COL.muted }));
        [['편도', 'a single', 'one-way'], ['왕복', 'a return', 'round trip']].forEach(([k, a, b], r) => {
          const y = 238 + r * 52;
          txt(g, k, cx[0], y, { size: 19, weight: 700 });
          txt(g, a, cx[1], y, { size: 22, weight: 700, color: COL.clause }); say(cx[1] - 4, y - 18, 200, 36, a.replace(/^a /, '') === a ? a : a);
          txt(g, b, cx[2], y, { size: 22, weight: 700, color: COL.clause }); say(cx[2] - 4, y - 18, 220, 36, b);
        });
        fade(g, ramp(u, 13.4, 0.4), () => tag(g, '어느 쪽을 말해도 알아들어요', LX + 780, 352, COL.accent, { align: 'right', size: 15, h: 30 }));
        linked(g, TR.LINKED[0], LX + 10, 410, u, 14.0, 760);
      });
      // [17.2, 28] 몇 명
      if (u >= 17.0) fade(g, ramp(u, 17.2, 0.4) * (1 - ramp(u, 27.8, 0.4)), () => {
        const [qid, alone, me1, p2, a2c1] = TR.SCENE.many;
        const B = staff(g, qid, { x: LX, y: 160, w: 780, at: 17.4, u, roleAt: 18.0, size: 22, shapeAt: 18.2 });
        let y = 160 + B.bh + 14;
        const A1 = answer(g, { x: LX, y, w: 780, A: alone, B: u >= 20.8 ? me1 : null, p: (u - 20.8) / 0.7, at: 18.8, u, size: 23, trapAt: 19.4, strikeAt: 19.5, verdict: u >= 21.6 ? { ok: okOn(qid, me1), at: 21.6 } : null, tag: ['me alone → 쓸쓸하게 들려 어색해요', COL.trap, 19.7, 20.8] });
        y += A1.bh + 12;
        const C2 = Object.assign({}, D, { party: 'a2' }), C3 = Object.assign({}, D, { party: 'a2c1' });
        const A2 = answer(g, { x: LX, y, w: 780, A: p2, at: 22.8, u, size: 23, verdict: { ok: okOn(qid, p2, C2), at: 23.5 }, tag: ['알아듣지만 서류 말처럼 딱딱해요', COL.rel, 23.8] });
        y += A2.bh + 12;
        answer(g, { x: LX, y, w: 780, A: a2c1, at: 25.0, u, size: 23, verdict: { ok: okOn(qid, a2c1, C3), at: 25.7 }, tag: ['어른 · 어린이로 나눠요', COL.clause, 26.0] });
        side(g);
        txt(g, 'PASSENGERS', RX + RW / 2, 180, { size: 13, weight: 700, fam: FM, color: COL.muted, align: 'center' });
        partyPic(g, RX + RW / 2, 320, u >= 24.8 ? 'a2c1' : u >= 22.6 ? 'a2' : 'a1');
        const pk = u >= 24.8 ? 'a2c1' : u >= 22.6 ? 'a2' : 'a1';
        txt(g, TR.PARTY[pk].ko, RX + RW / 2, 420, { size: 17, weight: 700, color: COL.soft, align: 'center' });
        txt(g, '어린이는 반값 (지어낸 규칙)', RX + RW / 2, 450, { size: 13, weight: 600, color: COL.muted, align: 'center' });
      });
      // [28.2, 34] off-peak 묻기
      if (u >= 27.8) fade(g, ramp(u, 28.0, 0.4), () => {
        const [qid, ask, pick] = TR.SCENE.peak;
        const B = staff(g, qid, { x: LX, y: 160, w: 780, at: 28.2, u, roleAt: 28.8, size: 22, shapeAt: 29.0 });
        let y = 160 + B.bh + 14;
        const A = answer(g, { x: LX, y, w: 780, A: ask, at: 29.4, u, size: 23, verdict: { ok: okOn(qid, ask), at: 30.1 } });
        y += A.bh + 12;
        const T = talk(g, { side: 'L', x: LX, y, w: 780, text: "It's cheaper, but you can't travel before 9:30 in the morning.", marks: [['cheaper', 'key'], ['before 9:30', 'slot']], kind: 'uk', sp: 'gb', at: 30.6, u, size: 21 });
        y += T.bh + 12;
        answer(g, { x: LX, y, w: 780, A: pick, at: 32.4, u, size: 23, verdict: { ok: okOn(qid, pick), at: 33.1 } });
        trainTicket(g, RX - 10, 172, 320, { dest: 'oakbridge', type: 'single', party: 'a1', peak: u >= 33.1 ? 'offpeak' : null }, { hl: u >= 33.1 ? 'peak' : null });
      });
    },

    /* 04 할인과 값: 학생 카드 · railcard 묻기 · 값 듣기(fourteen · forty) · 되묻기 · 카드로 · 깎아 달라는 말 × */
    fare(g, u) {
      if (S.fare) {
        const c = Object.assign({}, S.fare); c.amount = TR.fare(c);
        const q = TR.simQ('fr_cost', c);
        fareTable(g, RX - 20, 150, 330, c, { hl: 'total' });
        talk(g, { side: 'L', x: LX, y: 160, w: 760, text: q.en, marks: [[TR.money(c.amount), 'slot']], kind: 'clerk', sp: 'us', all: true, u: 99, size: 24 });
        pieces(g, [['읽기 → ', ''], [TR.priceWords(c.amount), 'slot']], LX, 270, 24); say(LX, 250, 600, 40, TR.priceWords(c.amount));
        txt(g, `${TR.TOWNS[c.dest].ko} ${c.type === 'return' ? '왕복' : '편도'} · ${TR.PARTY[c.party].ko}${c.disc ? ` · 학생 카드 ${TR.DISC_OFF}% 할인` : ''}`, LX, 322, { size: 18, weight: 700, color: COL.soft });
        txt(g, `모두 ${TR.priceKo(c.amount)} · 어린이는 반값, 할인은 10센트 단위로 (지어낸 규칙)`, LX, 358, { size: 15, weight: 600, color: COL.muted });
        return;
      }
      // [0.4, 11.4] 학생 카드 · railcard
      fade(g, ramp(u, 0.3, 0.4) * (1 - ramp(u, 11.2, 0.4)), () => {
        const [qd, have, no] = TR.SCENE.disc, [qr, wr] = TR.SCENE.rail;
        const r = exch(g, u, { q: qd, at: 0.8, aAt: 2.2, bad: have, ok: no, mAt: 4.4, tag: 'have 뒤가 비어요', size: 23 });
        let y = r.y + 18;
        fade(g, ramp(u, 6.0, 0.4), () => {
          const B2 = talk(g, { side: 'L', x: LX, y, w: 780, text: TR.Q[qr].en, marks: Qm(qr), kind: 'uk', sp: 'gb', at: 6.2, u, size: 22, shape: 'yn', shapeAt: 6.8 });
          fade(g, ramp(u, 6.6, 0.4), () => tag(g, '영국', LX + 70 + B2.bw, y + B2.bh / 2, COL.ante, { align: 'left', size: 14, h: 28 }));
          y += B2.bh + 12;
          const A = answer(g, { x: LX, y, w: 780, A: wr, at: 7.6, u, size: 23, verdict: { ok: okOn(qr, wr), at: 8.3 } });
          talk(g, { side: 'L', x: LX, y: y + A.bh + 12, w: 780, text: "It's a discount card for trains.", marks: [['discount card', 'key']], kind: 'uk', sp: 'gb', at: 9.0, u, size: 21 });
        });
        side(g);
        // 학생 카드 (없음)
        rr(g, RX + 60, 196, 180, 112, 14); g.fillStyle = '#2F4A44'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 2; g.stroke();
        txt(g, 'STUDENT', RX + 150, 232, { size: 18, weight: 800, fam: FM, color: '#F2E6C9', align: 'center' }); txt(g, 'CARD', RX + 150, 260, { size: 13, weight: 700, fam: FM, color: '#CFE3D6', align: 'center' });
        if (u >= 2.2) cross(g, RX + 236, 200, 22, COL.bad);
        txt(g, '학생 카드 없음', RX + RW / 2, 340, { size: 16, weight: 700, color: COL.muted, align: 'center' });
        fade(g, ramp(u, 9.0, 0.4), () => { txt(g, 'railcard', RX + RW / 2, 400, { size: 20, weight: 800, color: COL.en, align: 'center' }); txt(g, '(영국) 기차 할인 카드', RX + RW / 2, 428, { size: 14, weight: 600, color: COL.muted, align: 'center' }); });
      });
      // [11.6, 34] 값
      if (u >= 11.2) fade(g, ramp(u, 11.6, 0.4), () => {
        const q = TR.Q.fr_cost, [, wrongN, rightN, lit, card, exp] = TR.SCENE.cost;
        const B = talk(g, { side: 'L', x: LX, y: 150, w: 780, text: q.en, marks: [['$14.50', 'slot']], kind: 'clerk', sp: 'us', at: 11.8, u, size: 23 });
        // [13.4, 17.2] fourteen · forty
        fade(g, win(u, 13.2, 17.2), () => {
          TR.PAIRS.forEach(([n1, w1, n2, w2], i) => fade(g, ramp(u, 13.4 + i * 0.4, 0.3), () => {
            const x = LX + i * 250, y = 270;
            const draw = (s, xx, yy) => { const m = s.match(/^([a-z]*)([A-Z]+)([a-z]*)$/); let x2 = xx; [[m[1], 0], [m[2], 1], [m[3], 0]].forEach(([p, big]) => { if (!p) return; x2 += txt(g, p.toLowerCase(), x2, yy, { size: big ? 26 : 19, weight: big ? 800 : 500, color: big ? COL.accent : COL.soft }); }); };
            txt(g, n1, x, y, { size: 18, weight: 700, fam: FM, color: COL.muted }); draw(w1, x + 36, y);
            txt(g, n2, x, y + 42, { size: 18, weight: 700, fam: FM, color: COL.muted }); draw(w2, x + 36, y + 42);
            say(x, y - 18, 220, 76, `${w1.toLowerCase()}, ${w2.toLowerCase()}`);
          }));
          fade(g, ramp(u, 15.0, 0.4), () => tag(g, '-teen → 뒤를 세게 · -ty → 앞을 세게', LX, 380, COL.accent, { align: 'left' }));
          fade(g, ramp(u, 12.8, 0.4), () => pieces(g, [['$14.50 → ', ''], [TR.priceWords(1450), 'slot']], LX, 440, 22));
        });
        // [17.2, 22.4] 되묻기
        fade(g, ramp(u, 17.2, 0.4) * (1 - ramp(u, 22.4, 0.4)), () => {
          const y = 150 + B.bh + 16;
          const A0 = answer(g, { x: LX, y, w: 780, A: wrongN, at: 17.3, u, size: 23, verdict: { ok: okOn('fr_cost', wrongN), at: 18.0 }, tag: ['40.50 → 들은 값과 달라요', COL.trap, 18.2] });
          const A = answer(g, { x: LX, y: y + A0.bh + 12, w: 780, A: rightN, at: 19.2, u, size: 23, verdict: { ok: okOn('fr_cost', rightN), at: 19.9 } });
          talk(g, { side: 'L', x: LX, y: y + A0.bh + A.bh + 26, w: 780, text: 'Yes, fourteen fifty.', marks: [['fourteen fifty', 'slot']], kind: 'clerk', sp: 'us', at: 20.4, u, size: 22 });
        });
        // [22.6, 34] 카드로 · 깎아 달라는 말
        if (u >= 22.4) fade(g, ramp(u, 22.6, 0.4), () => {
          let y = 150 + B.bh + 16;
          const A = answer(g, { x: LX, y, w: 780, A: lit, B: u >= 25.0 ? card : null, p: (u - 25.0) / 0.7, at: 22.8, u, size: 23, trapAt: 23.4, strikeAt: 23.5, verdict: u >= 25.8 ? { ok: okOn('fr_cost', card), at: 25.8 } : null, tag: ['낱말만 옮긴 말이라 어색해요', COL.trap, 23.7, 25.0] });
          y += A.bh + 12;
          const T = talk(g, { side: 'L', x: LX, y, w: 780, text: TR.reply(q, card, D), marks: [['tap your card', 'key']], kind: 'clerk', sp: 'us', at: 26.4, u, size: 21 });
          y += T.bh + 12;
          if (u >= 28.0) answer(g, { x: LX, y, w: 780, A: exp, at: 28.4, u, size: 23, trapAt: 29.0, strikeAt: 29.1, tag: ['조르는 말 · 기차표 값은 정해져 있어요', COL.trap, 29.3] });
        });
        // 오른쪽: 운임표 → 카드 단말기
        fade(g, 1 - ramp(u, 22.4, 0.3), () => fareTable(g, RX - 20, 150, 330, D, { hl: u >= 12.4 ? 'total' : null }));
        if (u >= 22.4) fade(g, ramp(u, 22.6, 0.4), () => {
          side(g);
          rr(g, RX + 75, 180, 150, 230, 18); g.fillStyle = '#2B3440'; g.fill(); g.strokeStyle = 'rgba(238,241,244,0.25)'; g.lineWidth = 1.5; g.stroke();
          rr(g, RX + 90, 196, 120, 76, 8); g.fillStyle = '#0E1A16'; g.fill();
          txt(g, TR.money(1450), RX + 150, 224, { size: 22, weight: 800, fam: FM, color: '#7FE0A8', align: 'center' });
          txt(g, u >= 27.0 ? 'APPROVED' : 'TAP CARD', RX + 150, 254, { size: 11, weight: 700, fam: FM, color: u >= 27.0 ? '#7FE0A8' : '#FFC15E', align: 'center' });
          icon(g, 'card', RX + 150, 330, 54, u >= 27.0 ? COL.good : COL.soft, 1.6);
          txt(g, '값은 지어낸 것 · 세금 없이', RX + RW / 2, 450, { size: 13, weight: 600, color: COL.muted, align: 'center' });
        });
      });
    },

    /* 05 승강장과 출발 시각: 숫자 둘 → Platform where? × → 10:50 × → 고쳐 줌 → 바르게 → 시각 읽기 → 영국 → 빠른 말 → 안내판 */
    plat(g, u) {
      if (S.plat) {
        const c = Object.assign({}, D, S.plat), q = TR.simQ('pl_info', c), a = OT('pt_so', TR.ptVal(c.plat, c.time));
        talk(g, { side: 'L', x: LX, y: 160, w: 780, text: q.en, marks: [[c.time, 'slot'], [`platform ${c.plat}`, 'slot']], kind: 'clerk', sp: 'us', all: true, u: 99, size: 24 });
        answer(g, { x: LX, y: 240, w: 780, A: a, all: true, u: 99, size: 26, verdict: { ok: okOn('pl_info', a, c), at: -1 } });
        pieces(g, [['읽기 → ', ''], [`platform ${TR.numWord ? TR.numWord(c.plat) : c.plat}`, 'slot'], [' at ', ''], [TR.timeWords(c.time), 'slot']], LX, 350, 22); say(LX, 330, 600, 40, `platform ${c.plat} at ${TR.timeWords(c.time)}`);
        txt(g, `${c.plat}번 승강장 · ${TR.timeKo(c.time)}`, LX, 396, { size: 18, weight: 700, color: COL.soft });
        departureBoard(g, RX - 20, 160, 330, { hl: TRS.BOARD.findIndex(r => r[0] === c.time && r[2] === c.plat) });
        return;
      }
      const q = TR.Q.pl_info, [, so50, so15, where] = TR.SCENE.plat;
      // [0.4, 11.4] 안내 → Platform where? × → 10:50 × → 고침 → 10:15 ✓
      fade(g, ramp(u, 0.3, 0.4) * (1 - ramp(u, 11.2, 0.4)), () => {
        const B = talk(g, { side: 'L', x: LX, y: 160, w: 780, text: q.en, marks: [['platform', 'key'], ['10:15', 'slot'], ['platform 4', 'slot']], kind: 'clerk', sp: 'us', at: 0.8, u, roleAt: 1.6, size: 23, shape: 'note', shapeAt: 1.8 });
        fade(g, ramp(u, 2.4, 0.4), () => { tag(g, '시각 10:15', LX + 70, 160 + B.bh + 26, COL.clause, { align: 'left', size: 15, h: 30 }); tag(g, '승강장 4', LX + 210, 160 + B.bh + 26, COL.clause, { align: 'left', size: 15, h: 30 }); });
        const y = 160 + B.bh + 58;
        fade(g, 1 - ramp(u, 6.0, 0.3), () => answer(g, { x: LX, y, w: 780, A: where, at: 3.0, u, size: 24, trapAt: 3.6, strikeAt: 3.7, tag: ['낱말만 옮긴 말 · 되짚는 틀이 없어요', COL.trap, 3.9], tagY: y + 76 }));
        if (u >= 6.0) {
          const A = answer(g, { x: LX, y, w: 780, A: so50, B: u >= 9.2 ? so15 : null, p: (u - 9.2) / 0.7, at: 6.3, u, size: 24, verdict: u >= 10.0 ? { ok: okOn('pl_info', so15), at: 10.0 } : { ok: okOn('pl_info', so50), at: 7.0 } });
          fade(g, win(u, 7.4, 10.9), () => talk(g, { side: 'L', x: LX, y: y + A.bh + 14, w: 780, text: 'No — I said platform 4 at 10:15.', marks: [['10:15', 'slot']], kind: 'clerk', sp: 'us', at: 7.6, u, size: 22 }));
        }
      });
      // [11.6, 17] 시각 읽기
      fade(g, win(u, 11.6, 17.0), () => {
        [['10:15', 11.8], ['9:05', 12.6], ['3:00', 13.4], ['10:50', 14.2]].forEach(([t, at], k) => fade(g, ramp(u, at, 0.4), () => {
          const y = 190 + k * 64;
          txt(g, t, LX + 10, y, { size: 30, weight: 800, fam: FM, color: COL.text });
          txt(g, '→', LX + 130, y, { size: 22, weight: 700, color: COL.muted });
          txt(g, TR.timeWords(t), LX + 170, y, { size: 26, weight: 700, color: COL.clause });
          say(LX + 166, y - 20, 300, 40, TR.timeWords(t));
        }));
        fade(g, ramp(u, 15.0, 0.4), () => tag(g, '시와 분을 끊어 읽어요 · 0은 oh · 00은 o\'clock', LX, 460, COL.accent, { align: 'left' }));
      });
      // [17.2, 22.4] 영국 역무원 → 되묻기
      fade(g, ramp(u, 17.2, 0.4) * (1 - ramp(u, 22.4, 0.4)), () => {
        const qg = TR.Q.pl_gb, [, sayA] = TR.SCENE.platgb, Cg = Object.assign({}, D, { plat: 2, time: '10:50' });
        const B = talk(g, { side: 'L', x: LX, y: 160, w: 780, text: qg.en, marks: [['10:50', 'slot'], ['platform 2', 'slot']], kind: 'uk', sp: 'gb', at: 17.4, u, size: 22, shape: 'note', shapeAt: 18.4 });
        const A = answer(g, { x: LX, y: 160 + B.bh + 16, w: 780, A: sayA, at: 18.8, u, size: 23, verdict: { ok: okOn('pl_gb', sayA, Cg), at: 19.5 } });
        talk(g, { side: 'L', x: LX, y: 160 + B.bh + A.bh + 30, w: 780, text: "That's right. Platform 2.", marks: [['Platform 2', 'slot']], kind: 'uk', sp: 'gb', at: 20.2, u, size: 22 });
      });
      // [22.6, 27.4] 빠른 말 → which platform
      fade(g, ramp(u, 22.6, 0.4) * (1 - ramp(u, 27.4, 0.4)), () => {
        const [qf, , rp] = TR.SCENE.platfast;
        const r = exch(g, u, { q: qf, at: 22.8, aAt: 24.6, ok: rp, size: 23, qsize: 22 });
        talk(g, { side: 'L', x: LX, y: r.y + 14, w: 780, text: 'Platform 6. Six.', marks: [['Platform 6', 'slot']], kind: 'uk', sp: 'gb', at: 25.6, u, size: 22 });
      });
      // [27.6, 32] 안내판 읽기
      fade(g, ramp(u, 27.6, 0.4), () => {
        label(g, '출발 안내판 → 시각 · 가는 곳 · 승강장', LX, 170, { color: COL.accent, size: 17 });
        [['TIME', '10:15', 'ten fifteen'], ['TO', 'OAKBRIDGE', 'Oakbridge'], ['PLAT', '6', 'platform six']].forEach(([k, v, s2], i) => fade(g, ramp(u, 28.0 + i * 0.5, 0.4), () => {
          const y = 230 + i * 62;
          txt(g, k, LX, y, { size: 15, weight: 700, fam: FM, color: COL.muted });
          txt(g, v, LX + 90, y, { size: 30, weight: 800, fam: FM, color: '#FFB347' });
          txt(g, '→ ' + s2, LX + 330, y, { size: 22, weight: 700, color: COL.en }); say(LX + 320, y - 20, 300, 40, s2);
        }));
        fade(g, ramp(u, 29.8, 0.4), () => tag(g, '말로 들은 것과 안내판을 함께 확인해요', LX, 430, COL.clause, { align: 'left' }));
      });
      departureBoard(g, RX - 20, 160, 330, { chg: u >= 23.0 ? ramp(u, 23.0, 2.2) : 0, hl: u >= 27.6 ? 0 : u >= 17.2 && u < 22.6 ? 1 : u < 11.4 ? 0 : null });
    },

    /* 06 지하철 안내 데스크: 내가 먼저 길 묻기 · teach × · which line · 카드 충전 · charge × · 노선도 읽기 · 갈아타는 역 */
    info(g, u) {
      if (S.trip) {
        const R = TR.route(S.trip.from, S.trip.to), t = TR.say(R);
        const B = talk(g, { side: 'L', x: LX, y: 160, w: 760, text: t, marks: [], kind: 'info', sp: 'ca', all: true, u: 99, size: 20 });
        const K = richLay(g, TR.sayKo(R), [], 17, 740, { weight: 600 });
        richDraw(g, K, LX, 160 + B.bh + 28, { color: COL.soft });
        txt(g, R.transfers ? `갈아타기 ${R.transfers}번 · ${R.stops}정거장` : `갈아타지 않아요 · ${R.stops}정거장`, LX, 160 + B.bh + 40 + K.h, { size: 16, weight: 700, color: COL.accent });
        metroMap(g, { x: 860, y: 150, w: 350, h: 330, px: 40, py: 30 }, { route: R, ts: 0.7, ls: 13, here: R.from, hereTag: false, pin: R.to, keep: [R.from, R.to] });
        return;
      }
      // [0.4, 11.4] 다음 분 → 길 묻기
      fade(g, ramp(u, 0.3, 0.4) * (1 - ramp(u, 11.2, 0.4)), () => {
        const [qn, teach, how] = TR.SCENE.ask;
        const r = exch(g, u, { q: qn, at: 0.8, aAt: 2.2, ok: how, size: 23, tag: '안내 → 내가 먼저 물어요', tagC: COL.clause, tagEnd: 5.8 });
        let y = r.y + 12;
        fade(g, ramp(u, 6.0, 0.3), () => {
          const A = answer(g, { x: LX, y, w: 780, A: teach, at: 6.3, u, size: 23, trapAt: 6.9, strikeAt: 7.0, tag: ['teach → ‘가르쳐’를 옮긴 말 · 어색해요', COL.trap, 7.2] });
          answer(g, { x: LX, y: y + A.bh + 12, w: 780, A: OT('aw_which', 'museum'), at: 9.0, u, size: 23, verdict: { ok: okOn(qn, OT('aw_which', 'museum')), at: 9.7 }, tag: ['노선을 물어도 돼요', COL.clause, 10.0] });
        });
        metroMap(g, { x: 900, y: 150, w: 300, h: 300, px: 30, py: 28 }, { ts: 0.62, labels: false, bold: ['parkroad', 'museum'], here: 'parkroad', hereTag: false, pin: 'museum' });
        txt(g, 'Park Road 역 → Museum 역', 1050, 476, { size: 15, weight: 700, color: COL.soft, align: 'center' });
      });
      // [11.6, 22.4] 카드 충전
      if (u >= 11.2) fade(g, ramp(u, 11.6, 0.4) * (1 - ramp(u, 22.4, 0.4)), () => {
        const [qc, charge, top] = TR.SCENE.card, [qa, amt] = TR.SCENE.amt;
        const r = exch(g, u, { q: qc, at: 11.8, aAt: 13.0, ok: top, size: 22, qsize: 21 });
        let y = r.y + 12;
        if (u >= 17.0) {
          const A = answer(g, { x: LX, y, w: 780, A: charge, at: 17.3, u, size: 22, trapAt: 17.9, strikeAt: 18.0, tag: ['charge → 카드로 값을 내다로 들려요', COL.trap, 18.2] });
          y += A.bh + 16;
          exch(g, u, { q: qa, at: 19.2, aAt: 20.6, ok: amt, y, size: 22, qsize: 21 });
        }
        topUp(g, RX, 150, RW, { bal: 40, add: u >= 21.3 ? 2000 : 0, done: u >= 21.8 });
      });
      // [22.6, 34] 노선도 읽기
      if (u >= 22.4) fade(g, ramp(u, 22.6, 0.4), () => {
        const MB = { x: 70, y: 146, w: 760, h: 420, px: 80, py: 44 };
        metroMap(g, MB, { ts: 1, ls: 14, terms: true, line: u < 28 ? 'green' : null, here: 'parkroad', hereTag: true, hubs: u >= 28 ? (Math.sin((u - 28) * 4) * 0.5 + 0.5) : 0 });
        if (u < 28) {
          const [x0, y0] = mapAt(MB, 'parkroad'), [x1, y1] = mapAt(MB, 'eastpier');
          fade(g, ramp(u, 24.0, 0.5), () => { arrow(g, x0 + 24, y0 - 40, x1 - 24, y1 - 40, COL.accent, 3); txt(g, 'towards East Pier', x1 + 6, y0 - 64, { size: 18, weight: 800, color: COL.accent, align: 'right' }); say(x1 - 160, y0 - 82, 170, 36, 'towards East Pier'); });
        }
        // 오른쪽: 노선 셋 · 방향
        panel(g, 860, 150, 340, 330, { fill: COL.panel, stroke: COL.faint });
        txt(g, '노선 → 색 이름 · 방향 → 끝 역', 880, 178, { size: 15, weight: 700, color: COL.muted });
        TR.LINE_IDS.forEach((id, k) => fade(g, ramp(u, 23.0 + k * 0.4, 0.4), () => {
          const Ln = TR.LINES[id], y = 222 + k * 76, on = u < 28 ? id === 'green' : true;
          g.save(); if (!on) g.globalAlpha *= 0.4;
          lineChip(g, id, 880, y);
          const s = Ln.st, t = `${TR.STN[s[0]].en} ↔ ${TR.STN[s[s.length - 1]].en}`;
          txt(g, t, 880, y + 32, { size: fit(g, t, 16, 300, 600), weight: 600, color: COL.soft });
          g.restore();
          say(876, y - 16, 320, 60, `${Ln.en.replace(/^the /, 'The ')}. Towards ${TR.STN[s[0]].en}, or towards ${TR.STN[s[s.length - 1]].en}.`);
        }));
        fade(g, ramp(u, 28.4, 0.4), () => {
          circ(g, 890, 452, 9, '#FFFFFF'); ring(g, 890, 452, 9, '#1E2630', 2.6); ring(g, 890, 452, 16, COL.accent, 2.4);
          txt(g, '갈아타는 역 → Central · City Hall · University', 912, 452, { size: fit(g, '갈아타는 역 → Central · City Hall · University', 15, 280, 700), weight: 700, color: COL.accent });
        });
      });
    },

    /* 07 갈아타는 길 되짚기: 긴 대답 → 조각 → 한 줄 되짚기 ✓ → 방향 틀림 → 고쳐 줌 → Okay. Thanks. × · get down × → 다시 묻기 · 끝인사 */
    route(g, u) {
      const MB = { x: 830, y: 150, w: 380, h: 320, px: 40, py: 30 };
      if (S.line) {
        const C = Object.assign({}, D, { from: S.line.from, to: S.line.to }), R = TR.route(C.from, C.to), a = { f: 'line', line: { words: S.line.words } };
        const B = talk(g, { side: 'L', x: LX, y: 160, w: 730, text: TR.say(R), marks: [], kind: 'info', sp: 'ca', all: true, u: 99, size: 19 });
        const A = answer(g, { x: LX, y: 160 + B.bh + 16, w: 730, A: a, all: true, u: 99, size: 21, maxW: 600, verdict: { ok: TR.checkLine(a.line, C).ok, at: -1 } });
        const fx = TR.fixLine(a.line, C);
        const T = talk(g, { side: 'L', x: LX, y: 160 + B.bh + A.bh + 30, w: 730, text: fx.en, marks: [], kind: 'info', sp: 'ca', all: true, u: 99, size: 21 });
        const j = TR.checkLine(a.line, C), K = richLay(g, j.why, [], 15, 720, { weight: 600 });
        richDraw(g, K, LX, 160 + B.bh + A.bh + T.bh + 60, { color: j.ok ? COL.good : COL.trap });
        metroMap(g, MB, { route: R, ts: 0.66, ls: 13, here: R.from, hereTag: false, pin: R.to, keep: [R.from, R.to] });
        return;
      }
      const q = TR.Q.ro_say, LN = TR.INTRO.line;
      // 위: 직원의 긴 대답 (30초까지)
      let B = { bh: 0 };
      fade(g, 1 - ramp(u, 29.8, 0.4), () => { B = staff(g, 'ro_say', { x: LX, y: 150, w: 730, at: 0.8, u, roleAt: 1.2, size: 20, shapeAt: 7.6 }); });
      const y0 = 150 + B.bh + 16;
      // [6.6, 12.4] 조각으로 나눠 듣기
      fade(g, win(u, 6.6, 12.4), () => {
        const CH = [['take the Green Line', '탈 노선'], ['towards East Pier', '방향'], ['change at Central', '갈아타는 역'], ['take the Blue Line', '갈아탈 노선'], ['towards South Bay', '방향'], ['get off at Museum', '내릴 역']];
        CH.forEach(([en, ko], k) => fade(g, ramp(u, 6.8 + k * 0.45, 0.35), () => {
          const col = k % 3, row = Math.floor(k / 3), x = LX + col * 246, y = y0 + 30 + row * 86;
          const c = chip(g, en, x, y, { size: 17, weight: 700, color: COL.clause, fill: COL.panel2, stroke: 'rgba(127,224,168,0.55)', h: 38, r: 10, pad: 12 });
          txt(g, `${k + 1}. ${ko}`, x + 6, y + 34, { size: 14, weight: 700, color: COL.muted });
          if (col < 2) arrow(g, x + c.w + 6, y, x + 236, y, COL.faint, 1.8);
          say(c.x, c.y, c.w, c.h, en);
        }));
        linked(g, TR.LINKED[1], MB.x + 10, 220, u, 9.4, 360);
      });
      // [12.6, 18.4] 한 줄 되짚기 ✓
      fade(g, ramp(u, 12.6, 0.4) * (1 - ramp(u, 18.4, 0.4)), () => {
        const A = answer(g, { x: LX, y: y0, w: 730, A: LN, at: 12.8, u, size: 21, maxW: 600, verdict: { ok: okOn('ro_say', LN), at: 14.6 } });
        talk(g, { side: 'L', x: LX, y: y0 + A.bh + 14, w: 730, text: TR.fixLine(LN.line, D).en, kind: 'info', sp: 'ca', at: 15.2, u, size: 22 });
        fade(g, ramp(u, 15.8, 0.4), () => tag(g, '조각 다섯을 들은 차례대로', LX + 730, y0 + A.bh + 92, COL.clause, { align: 'right', size: 15, h: 30 }));
      });
      // [18.6, 24] 방향이 틀림 → 그 조각만 고쳐 줌
      fade(g, ramp(u, 18.6, 0.4) * (1 - ramp(u, 24.0, 0.4)), () => {
        const bad = { f: 'line', line: TR.LINE_DIR };
        const A = answer(g, { x: LX, y: y0, w: 730, A: bad, at: 18.8, u, size: 21, maxW: 600, verdict: { ok: okOn('ro_say', bad), at: 19.6 } });
        talk(g, { side: 'L', x: LX, y: y0 + A.bh + 14, w: 730, text: TR.fixLine(TR.LINE_DIR, D).en, marks: [['towards East Pier', 'slot']], kind: 'info', sp: 'ca', at: 20.2, u, size: 22 });
        fade(g, ramp(u, 21.6, 0.4), () => tag(g, '방향 → 그 노선의 끝 역 · 반대쪽 끝이면 거꾸로 가요', LX + 730, y0 + A.bh + 92, COL.trap, { align: 'right', size: 15, h: 30 }));
      });
      // [24.2, 30] Okay. Thanks. × · get down ×
      fade(g, ramp(u, 24.2, 0.4) * (1 - ramp(u, 29.8, 0.4)), () => {
        const skip = TR.SCENE.lines[0][1];
        const A1 = answer(g, { x: LX, y: y0, w: 730, A: skip, at: 24.4, u, size: 22, trapAt: 25.0, strikeAt: 25.1, tag: ['되짚지 않으면 틀린 곳을 몰라요', COL.trap, 25.3] });
        const down = { f: 'line', line: TR.LINE_DOWN }, y = y0 + A1.bh + 12;
        const A2 = answer(g, { x: LX, y, w: 730, A: down, at: 26.4, u, size: 21, maxW: 600, verdict: { ok: okOn('ro_say', down), at: 27.1 } });
        talk(g, { side: 'L', x: LX, y: y + A2.bh + 12, w: 730, text: TR.fixLine(TR.LINE_DOWN, D).en, marks: [['get off', 'slot']], kind: 'info', sp: 'ca', at: 27.6, u, size: 22 });
      });
      // [30.2, 36] 빠른 말 → 다시 묻기 · 끝인사
      if (u >= 29.8) fade(g, ramp(u, 30.0, 0.4), () => {
        const [qf, rp] = TR.SCENE.fast, [qm, plain, no] = TR.SCENE.more;
        const r = exch(g, u, { q: qf, at: 30.2, aAt: 31.8, ok: rp, y: 150, w: 730, size: 22, qsize: 20 });
        exch(g, u, { q: qm, at: 33.0, aAt: 33.8, bad: plain, ok: no, mAt: 34.6, tag: '고맙다는 말 없이 끊겨요', y: r.y + 16, w: 730, size: 22, qsize: 21 });
      });
      // 오른쪽: 노선도 (말을 들으며 길이 그려짐 · 틀린 방향은 주황 점선)
      fade(g, 1 - win(u, 6.6, 12.4) * 0.92, () => metroMap(g, MB, {
        route: DR0, p: ramp(u, 0.9, 6.6), ts: 0.66, ls: 13, here: 'parkroad', hereTag: false, pin: 'museum', keep: ['parkroad', 'museum'],
        trap: u >= 19.6 && u < 24.0 ? { line: 'green', from: 'parkroad', to: 'westfield', p: ramp(u, 19.6, 0.8) } : null,
        hubs: u >= 14.6 && u < 18.4 ? 1 : 0,
      }));
    },

    /* 08 열차 안과 승강장: 안내방송 → 옆 사람에게 묻기 → 승강장 안내 → 내가 먼저 확인 → 틀린 문장 · 승강장 묻기 → 반대쪽 → 빈자리 */
    train(g, u) {
      // [0.4, 11.4] 안내방송
      fade(g, ramp(u, 0.3, 0.4) * (1 - ramp(u, 11.2, 0.4)), () => {
        const [qa, again, ann] = TR.SCENE.ann;
        const B = staff(g, qa, { x: LX, y: 160, w: 780, at: 0.8, u, size: 22 });
        fade(g, ramp(u, 3.6, 0.4), () => tag(g, '빠르고 한 번만 나와요', LX + 70, 160 + B.bh + 24, COL.verb, { align: 'left', size: 15, h: 30 }));
        let y = 160 + B.bh + 54;
        if (u >= 6.0) {
          const A = answer(g, { x: LX, y, w: 780, A: again, at: 6.2, u, size: 22, trapAt: 6.8, strikeAt: 6.9, tag: ['방송은 다시 말해 주지 않아요', COL.trap, 7.1] });
          y += A.bh + 12;
          const A2 = answer(g, { x: LX, y, w: 780, A: ann, at: 8.2, u, size: 22, verdict: { ok: okOn(qa, ann), at: 8.9 } });
          talk(g, { side: 'L', x: LX, y: y + A2.bh + 12, w: 780, text: 'It said change here for the Blue Line.', marks: [['change here', 'key'], ['the Blue Line', 'slot']], kind: 'rider', sp: 'au', at: 9.4, u, size: 21 });
        }
        trainInside(g, RX - 20, 150, 330, 320, { led: 'NEXT: CENTRAL · CHANGE FOR BLUE LINE · DOORS OPEN ON THE LEFT', ledP: ramp(u, 0.8, 9.6), doors: true, me: true });
      });
      // [11.6, 28] Central 역 승강장
      if (u >= 11.2) fade(g, ramp(u, 11.6, 0.4) * (1 - ramp(u, 27.8, 0.4)), () => {
        const [qn, wrong, does, is] = TR.SCENE.board, [qo, bye, thx] = TR.SCENE.other;
        if (u < 22.4) fade(g, 1 - ramp(u, 22.2, 0.3), () => {
          const r = exch(g, u, { q: qn, at: 11.8, aAt: 13.4, ok: does, size: 22, qsize: 22, tag: '안내 → 내가 먼저 확인해요', tagC: COL.clause, tagEnd: 16.8 });
          let y = r.y + 12;
          if (u >= 17.0) {
            const A = answer(g, { x: LX, y, w: 780, A: wrong, at: 17.3, u, size: 22, trapAt: 17.9, strikeAt: 18.0, tag: ['is와 go를 함께 써서 틀린 문장', COL.trap, 18.2] });
            answer(g, { x: LX, y: y + A.bh + 12, w: 780, A: is, at: 19.6, u, size: 22, verdict: { ok: okOn(qn, is), at: 20.3 }, tag: ['승강장을 물어도 돼요', COL.clause, 20.6] });
          }
        });
        if (u >= 22.4) fade(g, ramp(u, 22.6, 0.4), () => exch(g, u, { q: qo, at: 22.8, aAt: 25.0, bad: bye, ok: thx, mAt: 26.2, tag: '고맙다는 말 없이 끊겨요', size: 23, qsize: 21 }));
        platformDraw(g, RX - 20, 150, 330, 320, { here: 'top', train: 'top', p: ramp(u, 12.0, 1.6), top: '← NORTH GATE', bot: 'SOUTH BAY → MUSEUM', hl: u >= 23.6 ? 'other' : u >= 22.6 ? 'this' : null });
      });
      // [28.2, 34] 열차 안 · 빈자리
      if (u >= 27.8) fade(g, ramp(u, 28.0, 0.4), () => {
        const [qs, yes, go] = TR.SCENE.seatq;
        const r = exch(g, u, { q: qs, at: 28.2, aAt: 29.6, bad: yes, ok: go, mAt: 31.4, tag: 'Yes → ‘누가 앉아 있어요’라는 뜻', size: 24, qsize: 22 });
        talk(g, { side: 'L', x: LX, y: r.y + 14, w: 780, text: TR.reply(TR.Q[qs], go, D) || 'Thanks!', kind: 'rider', sp: 'au', at: 32.8, u, size: 22 });
        trainInside(g, RX - 20, 150, 330, 320, { led: 'NEXT: MARKET', free: true, me: true });
      });
    },

    /* 09 3단계 말하기 법: 상자 셋 + 곳마다 한 줄(모양 표시와 함께)이 단계별로 채워짐 */
    method(g, u) {
      const BOX = [['①', '열쇠 낱말 + 모양', 'or → 고르기 · where · how much → 정보 · Do you → Y/N', COL.ante, 5.5], ['②', '틀에 내 정보 넣기', 'To Oakbridge, please. · So, …? (되짚기)', COL.rel, 11.5], ['③', '공손하게 끝내기', 'please · thanks · Excuse me · Sorry, …?', COL.verb, 17.5]];
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
      TR.METHOD.forEach(([qid, a], i) => {
        const y = 300 + i * 39, q = TR.Q[qid], p = TR.PLACE[q.place], dim = sel != null && sel !== i;
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
            say(594, y - 16, 606, 32, TR.text(a));
          });
        });
      });
    },

    /* 10 실전: 여행 카드 하나로 넷 */
    practice(g, u) {
      const pi = u < PSEG[1] ? 0 : u < PSEG[2] ? 1 : u < PSEG[3] ? 2 : 3, v = u - PSEG[pi];
      const P = TR.PRACTICE[pi], C = TR.PCARD, q = TR.practiceQ(P);
      const a = ramp(v, 0, 0.5) * (pi < 3 ? 1 - ramp(u, PSEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `대화 ${pi + 1} / 4 · ${TR.PLACE[q.place].ko}`, LX, 150, { size: 16, weight: 500, fam: FM, color: COL.accent });
        tripCard(g, LX, 168, 336, C, { rh: 30, vs: 13.5, rows: PROWS, hl: { tk_type: 0, pl_info: 0, ro_say: 2, ro_more: 2 }[P.q] });
        talk(g, { side: 'L', x: 432, y: 172, w: 768, text: q.en, marks: Qm(q), kind: kindOf(q), sp: q.sp, at: PT.q, u: v, roleAt: PT.lines[0] + 0.4, size: q.en.length > 80 ? 19 : 22, shape: q.shape, shapeAt: PT.lines[0] + 0.4 });
        const J = P.opts.map(o => TR.judge(q, o, C));
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
            say(490, y - hh / 2, w + 10, hh, TR.text(o));
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
        ['counter', '매표소 · 어디까지', 'wh', 'Where are you traveling to? · Where to?', [['To ', 'frame'], ['Oakbridge', 'slot'], [', ', 'frame'], ['please', 'pol'], ['. · A single to ', 'frame'], ['Oakbridge', 'slot'], ['.', 'frame']]],
        ['ticket', '표 종류 · 몇 명', 'or', 'Single or return? · How many people?', [['A return', 'slot'], [', ', 'frame'], ['please', 'pol'], ['. · ', 'frame'], ['Just me', 'slot'], [', ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        ['fare', '할인 · 값', 'yn', "student card · railcard · That's $14.50.", [["No, I don't. · ", 'frame'], ['Sorry', 'pol'], [', did you say ', 'frame'], ['fourteen fifty', 'slot'], ['?', 'frame']]],
        ['plat', '승강장 · 출발 시각', 'note', 'It leaves at 10:15 from platform 4.', [['So, ', 'frame'], ['platform 4 at 10:15', 'slot'], ['? · ', 'frame'], ['Sorry', 'pol'], [', which platform?', 'frame']]],
        ['info', '지하철 안내 데스크', 'note', '(내가 먼저) Next, please! · How much?', [['Hi. How do I get to ', 'frame'], ['Museum', 'slot'], [', ', 'frame'], ['please', 'pol'], ["? · I'd like to top up my card.", 'frame']]],
        ['route', '갈아타기 안내', 'note', 'Take … towards … change at … get off at …', [['So, I ', 'frame'], ['take the Green Line', 'slot'], [' … ', 'frame'], ['change at Central', 'slot'], [' … ', 'frame'], ['get off at Museum', 'slot'], ['?', 'frame']], 'So, I take the Green Line, change at Central, and get off at Museum?'],
        ['train', '승강장 · 열차 안', 'yn', '(내가 먼저) does this train go · anyone sitting', [['Excuse me', 'pol'], [', does this train go to ', 'frame'], ['Museum', 'slot'], ['? · No, go ahead.', 'frame']]],
        [null, '되짚기', null, '숫자 · 갈아타는 역 · 방향은 조각으로', [['So, ', 'frame'], ['…', 'slot'], ['? → ', 'frame'], ["That's right! · Not quite — towards East Pier.", 'frame']], "That's right! Not quite — towards East Pier."],
        [null, '못 알아들었을 때', null, '빠른 말 · 안내방송 · 모르는 낱말', [['Sorry', 'pol'], [', where do I change? · ', 'frame'], ['Excuse me', 'pol'], [', what did the announcement say?', 'frame']]],
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
  // 실전 장면의 여행 카드 줄 (TR.PCARD와 같은 사실)
  const PROWS = [
    ['기차표', `${TR.TOWNS[TR.PCARD.dest].ko} · ${TR.PCARD.type === 'return' ? '왕복' : '편도'} · ${TR.PARTY[TR.PCARD.party].ko}`],
    ['할인 · 내기', `학생 카드 ${TR.PCARD.disc ? '있음' : '없음'} · ${TR.PCARD.paym === 'card' ? '카드' : '현금'}`],
    ['지하철', `${TR.STN[TR.PCARD.from].en} 역 → ${TR.STN[TR.PCARD.to].en} 역`],
  ];
  TRS.PROWS = PROWS;

  // 이어서 들리는 말: 위 = 쓰인 낱말 (이어지는 곳은 호), 아래 = 들리는 소리 (세게 = 크고 높게)
  function linked(g, L, x, y, u, at, maxW) {
    fade(g, ramp(u, at, 0.4), () => {
      const size = 28, gap = 22; let xx = x; const pos = [];
      L.words.forEach(w => { const ww = tw(g, w, size, 600); pos.push([xx, ww]); xx += ww + gap; });
      L.words.forEach((w, i) => { txt(g, w, pos[i][0], y, { size, weight: 600, color: COL.en }); });
      listen(x - 6, y - 24, xx - x, 48, [{ text: L.say || L.en, sp: TR.Q[L.q] ? TR.Q[L.q].sp : 'us', rate: 1.2 }]);
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

  TRS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[TRS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    if (ch.place != null) strip(g, Array.isArray(ch.place) ? (u < (ch.placeAt || 6) ? ch.place[0] : ch.place[1]) : ch.place, ramp(u, 0.2, 0.5));
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, TRS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + TR.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔↗↘✓×÷?!~=+-–—/:…‘’\'%$&<>';
  TRS.baseText = EXTRA;
  TRS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = TRS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { TRS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();