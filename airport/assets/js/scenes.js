/* 공항 회화 — 영상 장면
 *
 * APS.render(g, t)는 시각 t와 사용자 상태 APS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준, 내용은 y 580 위.
 *
 * 그림 말: 공항 길 지도(일곱 곳, 01장은 크게 · 02–08장은 위쪽 작은 띠), 말풍선(직원 왼쪽 · 여행자 오른쪽),
 * 대답은 틀(노랑) + 내 정보(민트) 낱말 조각으로 만들고(lay · morph), 함정은 줄을 긋고 주황 이름표로 까닭을 붙여요.
 * 역할 색: 열쇠 낱말 하늘 · 대답 틀 노랑 · 내 정보(칸에 넣는 말) 민트 · 공손한 말 보라 · 함정 주황 · 빈칸 분홍 점선
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(AP.judge)으로 정합니다.
 * MP4에는 소리가 없어서, 말은 말풍선 속 낱말이 하나씩 나타나는 모습으로 그려요. 페이지에서는 말풍선을 누르면 그 사람 목소리로 들려줘요.
 */
(function () {
  'use strict';
  const AP = window.AP;
  const APS = (window.APS = {});
  const W = 1280, H = 720;
  APS.W = W; APS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  APS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', paper: '#F4F1E8', ink: '#1E2630', teal: '#1B6B5F',
  };
  APS.COL = COL;
  // 역할 → 색 (낱말 조각 · 말풍선 글)
  const RC = { key: COL.ante, frame: COL.rel, slot: COL.clause, pol: COL.verb, trap: COL.trap, ok: COL.good, dim: COL.dim, bad: COL.bad };
  APS.RC = RC;
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8', me: '#F2C29A' };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (APS.S = { stop: null, pass: null, sec: null, num: null, req: null, imq: null, imAns: null, bag: null, place: null });
  APS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  APS.hits = () => HITS;

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

  /* =========================================================
     아이콘 — 24×24 격자의 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요
     [길, 'f'(채움) | 's'(선)]
     ========================================================= */
  const ICON = {
    checkin: [['M3 10h8v10H3z', 's'], ['M5.5 10V7.5h3V10', 's'], ['M13 12h9v8.5h-9z', 's'], ['M15 7h5v5h-5z', 's'], ['M2 20.5h20', 's']],
    security: [['M4 21V5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5V21', 's'], ['M7 21V7h10v14', 's'], ['M12 10.4m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0', 's'], ['M12 12.6v4M10 20.5l2-3.9 2 3.9M9.9 14.4h4.2', 's']],
    gate: [['M12 2.5c.9 0 1.5.8 1.5 1.9v5.3l7 4.1v1.9l-7-2.1v4.5l2 1.5v1.6L12 20.3l-3.5.9v-1.6l2-1.5v-4.5l-7 2.1v-1.9l7-4.1V4.4c0-1.1.6-1.9 1.5-1.9z', 'f']],
    plane: [['M6.6 4c1.1 0 1.9.7 2.1 1.8l1.5 8.2h6.3a2 2 0 0 1 2 2v1H9.6a2 2 0 0 1-2-1.6L5 6.4C4.8 5.1 5.4 4 6.6 4z', 's'], ['M9.5 17v3.5M16.5 17v3.5M7.5 20.5h11', 's'], ['M15.5 3.5h3a1.5 1.5 0 0 1 1.5 1.5v3.5A1.5 1.5 0 0 1 18.5 10h-3A1.5 1.5 0 0 1 14 8.5V5a1.5 1.5 0 0 1 1.5-1.5z', 's']],
    immig: [['M6 3h11a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 17 21H6z', 's'], ['M12.2 10.5m-3.2 0a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0', 's'], ['M9 10.5h6.4M12.2 7.3c1.3 1.7 1.3 4.7 0 6.4M12.2 7.3c-1.3 1.7-1.3 4.7 0 6.4', 's'], ['M9.5 17h5.4', 's']],
    baggage: [['M8 5.5h8a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 16 14.5H8A1.5 1.5 0 0 1 6.5 13V7A1.5 1.5 0 0 1 8 5.5z', 's'], ['M10 5.5V4h4v1.5', 's'], ['M3 17.5h18a1.75 1.75 0 0 1 0 3.5H3a1.75 1.75 0 0 1 0-3.5z', 's'], ['M6 19.25h.01M10 19.25h.01M14 19.25h.01M18 19.25h.01', 's']],
    customs: [['M6 4.5h12A1.5 1.5 0 0 1 19.5 6v14a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V6A1.5 1.5 0 0 1 6 4.5z', 's'], ['M9 3h6v3H9z', 's'], ['M8 11l1.6 1.6L13 9.2M8 16.5h8.5M14.8 11.5h2', 's']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z', 's'], ['M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6', 's']],
    horn: [['M4 10v4h3l7 5V5l-7 5z', 's'], ['M17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11', 's']],
    stamp: [['M9 3.5h6l-1 7h-4z', 's'], ['M5 13.5h14v3H5zM4 20h16', 's']],
    transfer: [['M4 8h13l-3.5-3.5M20 16H7l3.5 3.5', 's']],
    door: [['M6.5 21V3.5h11V21M3.5 21h17M14.5 12.5h.01', 's']],
  };
  APS.ICON = ICON;
  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = (typeof Path2D === 'function' ? new Path2D(d) : null));
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const parts = ICON[id]; if (!parts) return;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach(([d, m]) => { const p = path(d); if (!p) return; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  APS.icon = icon;
  // HTML용 SVG (색은 currentColor)
  APS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 사람 얼굴 (말풍선 옆). kind: officer · guard · desk · gate · crew · me ---------- */
  const LOOK = {
    officer: { suit: '#2B3E63', cap: '#1D2A44', badge: '#E8C35A', hair: '#2A221C', skin: '#D9A77E' },
    guard: { suit: '#3D4B5C', cap: '#2C3846', badge: '#9FB4C8', hair: '#3A2A20', skin: '#E3B48D' },
    desk: { suit: '#1F6F63', scarf: '#FFC15E', hair: '#2E241E', skin: '#E8BC95', bun: true },
    gate: { suit: '#265E7A', scarf: '#7FE0A8', hair: '#4A3426', skin: '#C99169', headset: true },
    crew: { suit: '#7A2E3B', scarf: '#F2C29A', hair: '#1F1B18', skin: '#E8BC95', hat: '#5E2230', bun: true },
    me: { suit: '#B9733F', hair: '#1F1B18', skin: '#E8BC95', pack: '#5B3A22' },
  };
  function avatar(g, x, y, r, kind, o = {}) {
    const L = LOOK[kind] || LOOK.desk;
    circ(g, x, y, r, COL.panel2);
    g.save(); g.beginPath(); g.arc(x, y, r - 1, 0, Math.PI * 2); g.clip();
    // 어깨
    g.fillStyle = L.suit; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
    if (L.pack) { g.strokeStyle = L.pack; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - r * 0.42, y + r * 0.45); g.lineTo(x - r * 0.5, y + r); g.moveTo(x + r * 0.42, y + r * 0.45); g.lineTo(x + r * 0.5, y + r); g.stroke(); }
    if (L.scarf) { g.fillStyle = L.scarf; g.beginPath(); g.moveTo(x - r * 0.22, y + r * 0.42); g.lineTo(x + r * 0.22, y + r * 0.42); g.lineTo(x, y + r * 0.72); g.closePath(); g.fill(); }
    if (kind === 'officer' || kind === 'guard') { g.fillStyle = '#E9E5DC'; g.beginPath(); g.moveTo(x - r * 0.14, y + r * 0.42); g.lineTo(x + r * 0.14, y + r * 0.42); g.lineTo(x, y + r * 0.62); g.closePath(); g.fill(); circ(g, x + r * 0.42, y + r * 0.68, r * 0.08, L.badge); }
    // 목 · 머리
    g.fillStyle = L.skin; g.fillRect(x - r * 0.1, y + r * 0.18, r * 0.2, r * 0.26);
    circ(g, x, y - r * 0.08, r * 0.34, L.skin);
    g.fillStyle = L.hair; g.beginPath(); g.arc(x, y - r * 0.12, r * 0.36, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
    if (L.bun) circ(g, x, y - r * 0.5, r * 0.13, L.hair);
    circ(g, x - r * 0.12, y - r * 0.04, r * 0.035, '#2B2420'); circ(g, x + r * 0.12, y - r * 0.04, r * 0.035, '#2B2420');
    g.strokeStyle = 'rgba(120,60,40,0.6)'; g.lineWidth = Math.max(1, r * 0.045); g.beginPath(); g.arc(x, y + r * 0.06, r * 0.1, 0.35, Math.PI - 0.35); g.stroke();
    if (L.cap) { g.fillStyle = L.cap; rr(g, x - r * 0.38, y - r * 0.52, r * 0.76, r * 0.24, r * 0.08); g.fill(); if (kind === 'officer') { g.fillRect(x - r * 0.44, y - r * 0.3, r * 0.88, r * 0.07); } circ(g, x, y - r * 0.4, r * 0.07, L.badge); }
    if (L.hat) { g.fillStyle = L.hat; rr(g, x - r * 0.26, y - r * 0.56, r * 0.52, r * 0.16, r * 0.06); g.fill(); }
    if (L.headset) { g.strokeStyle = '#1D2A33'; g.lineWidth = r * 0.07; g.beginPath(); g.arc(x, y - r * 0.08, r * 0.4, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.moveTo(x + r * 0.36, y - r * 0.02); g.quadraticCurveTo(x + r * 0.34, y + r * 0.2, x + r * 0.12, y + r * 0.16); g.stroke(); }
    g.restore();
    ring(g, x, y, r, o.live ? (SPC[o.sp] || COL.soft) : COL.faint, o.live ? 2.6 : 1.5);
    if (o.live) { g.save(); g.globalAlpha *= 0.45; ring(g, x, y, r + 5, SPC[o.sp] || COL.soft, 2); g.restore(); }
  }
  APS.avatar = avatar;

  /* ---------- 글 배치: 낱말 단위 줄 바꿈 + 역할 색 (말풍선 · 표) ---------- */
  // marks: [[글, 역할]] 또는 [{ t, role }] → 그 글에 걸친 낱말에 역할
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
  // y = 첫 줄의 가운데. o: { color, shown: 보이는 낱말 수, rolesOn, plain, squeeze }
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
  APS.richLay = richLay; APS.richDraw = richDraw;

  /* ---------- 낱말 조각 (대답 만들기): { id, t, r } → lay · morph · drawTok ---------- */
  const PUNCT = /^[.,?!]$/;
  // 대답 → 조각. 같은 낱말은 같은 id라 다른 대답으로 바뀔 때 미끄러져요
  function ansToks(a, o = {}) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    AP.segs(a).forEach(s => s.t.split(/\s+/).forEach(w => {
      if (!w) return;
      const m = w.match(/^(.*?)([.,?!]*)$/);
      if (m[1]) push(m[1], o.role != null ? o.role : s.r);
      if (m[2]) m[2].split('').forEach(p => push(p, ''));
    }));
    return out;
  }
  APS.ansToks = ansToks;
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
    return { items, byId, size, lines: lines.length, x: left, w: right - left, y: o.y, h: (lines.length - 1) * lh + size * 1.3 };
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
      if (POSR[r] && !o.plain && !PUNCT.test(it.t)) { g.fillStyle = c; g.fillRect(x, y + size * 0.58, w, 2.6); }
    }
    g.restore();
  }
  function drawLay(g, L, style) { L.items.forEach(it => drawTok(g, it, style ? style(it) || {} : {})); }
  // 두 배치 사이 (p: 0→1). 같은 id는 움직이고, 글자·역할이 다르면 겹쳐 바뀜
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
  // 말풍선 모양 (꼬리는 얼굴 쪽)
  function bubbleShape(g, side, bx, by, bw, bh, ax, ay, fill, stroke) {
    rr(g, bx, by, bw, bh, 16); g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke();
    const tx = side === 'L' ? bx : bx + bw, ty = clamp(ay, by + 14, by + bh - 10), d = side === 'L' ? -1 : 1;
    g.beginPath(); g.moveTo(tx, ty - 8); g.lineTo(tx + d * 11, ty); g.lineTo(tx, ty + 7); g.closePath(); g.fillStyle = fill; g.fill();
    g.beginPath(); g.moveTo(tx, ty - 8); g.lineTo(tx + d * 11, ty); g.lineTo(tx, ty + 7); g.strokeStyle = stroke; g.stroke();
    g.fillStyle = fill; g.fillRect(tx - (side === 'L' ? 0 : 2), ty - 7, 2, 13);
  }
  const FILL = { L: '#18222D', R: '#1A2622' }, EDGE = { L: 'rgba(110,200,255,0.38)', R: 'rgba(242,194,154,0.42)' };
  /* 직원 · 여행자의 한 마디 (글 말풍선)
   * o: { side: 'L' | 'R', x, y, w(칸 폭), text, marks, kind, sp, at, u, size, roleAt, fast, slow, all, strike, tag: [글, 색], verdict: { ok, at }, rate }
   * 돌려주는 값: { bx, by, bw, bh, ex: 말풍선 끝 x }
   */
  function talk(g, o) {
    const size = o.size || 22, ar = o.ar || 25, side = o.side || 'L', at = o.at == null ? -99 : o.at, u = o.u;
    const maxText = Math.min(o.maxText || 1e9, o.w - ar * 2 - 60);
    const R = richLay(g, o.text, o.marks || [], size, (o.fast ? maxText / 0.62 : maxText), { weight: 500, spread: o.slow ? 3.2 : 1 });
    const sq = o.fast ? 0.62 : 1, tW = R.w * sq, bw = tW + 34, bh = R.h + 20;
    const ax = side === 'L' ? o.x + ar : o.x + o.w - ar, ay = o.y + bh / 2;
    const bx = side === 'L' ? ax + ar + 16 : ax - ar - 16 - bw, by = o.y;
    const a = o.all ? 1 : ramp(u, at - 0.35, 0.3);
    const out = { bx, by, bw, bh, ex: bx + bw, R };
    if (a <= 0.001) return out;
    const per = WD * (o.slow ? 1.9 : o.fast ? 0.45 : 1), dur = nWords(o.text) * per, live = u >= at && u < at + dur + 0.15;
    fade(g, a, () => {
      avatar(g, ax, ay, ar, o.kind || (side === 'L' ? 'desk' : 'me'), { live, sp: o.sp });
      bubbleShape(g, side, bx, by, bw, bh, ax, ay, FILL[side], o.edge || EDGE[side]);
      const shown = o.all || o.hideText ? null : (u - at) / per;
      if (o.hideText) {
        R.widths.forEach((wd, k) => { rr(g, bx + 17, by + 10 + k * R.lh + R.lh / 2 - 6, Math.max(40, wd * sq), 12, 6); g.fillStyle = 'rgba(238,241,244,0.12)'; g.fill(); });
      } else {
        g.save(); g.translate(bx + 17, by + 10 + R.lh / 2); g.scale(sq, 1);
        richDraw(g, R, 0, 0, { shown, rolesOn: o.roleAt == null || u >= o.roleAt, color: o.color });
        g.restore();
      }
      if (o.fast && live) { g.strokeStyle = 'rgba(238,241,244,0.35)'; g.lineWidth = 2; g.lineCap = 'round'; [0, 1, 2].forEach(k => { const yy = by + 12 + k * (bh - 24) / 2, ph = ((u * 3 + k * 0.33) % 1); g.beginPath(); g.moveTo(bx + bw + 8 + ph * 18, yy); g.lineTo(bx + bw + 28 + ph * 18, yy); g.stroke(); }); }
      if (o.strike != null && u >= o.strike) { const p = clamp((u - o.strike) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.8; g.beginPath(); g.moveTo(bx + 12, by + bh / 2 + 1); g.lineTo(bx + 12 + (bw - 24) * p, by + bh / 2 + 1); g.stroke(); }
      if (o.verdict && u >= o.verdict.at) fade(g, ramp(u, o.verdict.at, 0.3), () => mark(g, o.verdict.ok, side === 'L' ? bx + bw + 22 : bx - 22, by + bh / 2, 17));
      if (o.tag && o.tagAt != null && u >= o.tagAt) fade(g, ramp(u, o.tagAt, 0.35), () => { const tx = side === 'L' ? bx + bw + 46 : bx - 46; tag(g, o.tag[0], tx, by + bh / 2, o.tag[1] || COL.trap, { align: side === 'L' ? 'left' : 'right', size: 15, h: 32 }); });
    });
    if (!o.noHit) listen(bx, by, bw, bh, [{ text: o.text, sp: o.sp || 'us', rate: o.fast ? 1.35 : o.slow ? 0.75 : 1 }]);
    return out;
  }
  APS.talk = talk;
  /* 여행자의 대답 (낱말 조각 말풍선, 두 대답 사이를 morph)
   * o: { x, y, w, A: 대답, B: 다음 대답, p: 0→1, at, u, size, strikeAt, verdict: { ok, at }, tag: [글, 색, at], role: 함정 색으로 칠하기 at }
   */
  function answer(g, o) {
    const size = o.size || 24, ar = 25, at = o.at == null ? -99 : o.at, u = o.u;
    const TA = o.toksA || ansToks(o.A, { role: o.trapAt != null && u >= o.trapAt ? 'trap' : undefined });
    const TB = o.B ? ansToks(o.B) : null;
    const LA = lay(g, TA, { x: 0, y: 0, size }), LB = TB ? lay(g, TB, { x: 0, y: 0, size }) : null;
    const p = LB ? clamp(o.p || 0) : 0, e = ease(p);
    const tW = LB ? lerp(LA.w, LB.w, e) : LA.w, bw = tW + 36, bh = size * 1.3 + 22;
    const ax = o.x + o.w - ar, ay = o.y + bh / 2, bx = ax - ar - 16 - bw, by = o.y;
    const a = o.all ? 1 : ramp(u, at - 0.35, 0.3), out = { bx, by, bw, bh };
    if (a <= 0.001) return out;
    const live = u >= at && u < at + 1.1;
    fade(g, a, () => {
      avatar(g, ax, ay, ar, 'me', { live, sp: 'me' });
      bubbleShape(g, 'R', bx, by, bw, bh, ax, ay, FILL.R, o.edge || EDGE.R);
      g.save(); g.translate(bx + 18, by + bh / 2);
      const style = () => ({});
      if (LB && p > 0) morph(g, LA, LB, p, { style }); else drawLay(g, LA);
      g.restore();
      if (o.strikeAt != null && u >= o.strikeAt && p < 0.01) { const q = clamp((u - o.strikeAt) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.8; g.beginPath(); g.moveTo(bx + 12, by + bh / 2 + 1); g.lineTo(bx + 12 + (bw - 24) * q, by + bh / 2 + 1); g.stroke(); }
      if (o.verdict && u >= o.verdict.at) fade(g, ramp(u, o.verdict.at, 0.3), () => mark(g, o.verdict.ok, bx - 22, by + bh / 2, 17));
      if (o.tag && u >= o.tag[2]) fade(g, ramp(u, o.tag[2], 0.35) * (o.tag[3] != null ? 1 - ramp(u, o.tag[3], 0.3) : 1), () => tag(g, o.tag[0], o.tagX != null ? o.tagX : o.tagY != null ? bx + bw : bx - 48, o.tagY != null ? o.tagY : by + bh / 2, o.tag[1] || COL.trap, { align: o.tagX != null ? 'left' : 'right', size: 15, h: 32 }));
    });
    const said = LB && p > 0.5 ? o.B : o.A;
    if (!o.noHit) listen(bx, by, bw, bh, [{ text: AP.text(said), sp: 'me' }]);
    return out;
  }
  APS.answer = answer;

  /* ---------- 공항 길 띠 (02–08장 위쪽) ---------- */
  function strip(g, cur, a = 1) {
    fade(g, a, () => {
      const x0 = 812, dx = 64, y = 92;
      g.strokeStyle = COL.faint; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 3, y); g.stroke();
      g.setLineDash([3, 5]); g.beginPath(); g.moveTo(x0 + dx * 3, y); g.lineTo(x0 + dx * 4, y); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.moveTo(x0 + dx * 4, y); g.lineTo(x0 + dx * 6, y); g.stroke();
      AP.PLACES.forEach((p, i) => {
        const x = x0 + i * dx, on = i === cur;
        circ(g, x, y, on ? 19 : 14, on ? COL.accent : i < cur ? '#2A3542' : COL.panel);
        ring(g, x, y, on ? 19 : 14, on ? COL.accent : COL.faint, 1.5);
        icon(g, p.id, x, y, on ? 22 : 16, on ? '#1D1305' : i < cur ? COL.soft : COL.muted, on ? 2 : 1.8);
      });
      txt(g, `${cur + 1} / 7`, x0 + dx * 6 + 30, y, { size: 13, weight: 500, fam: FM, color: COL.muted });
    });
  }

  /* ---------- 탑승권 (논리 1000×360) ---------- */
  // o: { hl: { id: 색 }, dim: [id], gate: 바뀐 탑승구 } → 돌려주는 값: 칸 위치(전체 좌표) { id: { x, y, w, h } }
  const PASSF = {
    name: [40, 104, 270, 'PASSENGER'], date: [330, 104, 150, 'DATE'], flight: [520, 104, 180, 'FLIGHT'],
    from: [40, 190, 270, 'FROM'], to: [330, 190, 370, 'TO'],
    gate: [40, 276, 120, 'GATE'], boarding: [180, 276, 170, 'BOARDING'], depart: [370, 276, 170, 'DEPARTS'], seat: [560, 276, 140, 'SEAT'],
    group: [760, 104, 210, 'GROUP'],
  };
  function boardingPass(g, x, y, w, o = {}) {
    const s = w / 1000, boxes = {};
    g.save(); g.translate(x, y); g.scale(s, s);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rr(g, 0, 0, 1000, 360, 22); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, 0, 0, 1000, 360, 22); g.clip();
    g.fillStyle = COL.teal; g.fillRect(0, 0, 1000, 66);
    icon(g, 'gate', 40, 33, 30, '#FFFFFF');
    txt(g, 'BOARDING PASS', 66, 34, { size: 26, weight: 700, fam: FM, color: '#FFFFFF' });
    txt(g, '탑승권', 330, 35, { size: 20, weight: 700, color: 'rgba(255,255,255,0.8)' });
    txt(g, 'FLIGHT 207', 975, 34, { size: 20, weight: 500, fam: FM, color: 'rgba(255,255,255,0.85)', align: 'right' });
    g.restore();
    g.setLineDash([6, 7]); g.strokeStyle = 'rgba(30,38,48,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(730, 74); g.lineTo(730, 350); g.stroke(); g.setLineDash([]);
    circ(g, 730, 0, 14, COL.bg); circ(g, 730, 360, 14, COL.bg);
    const V = { name: AP.PASS_INFO.name, date: AP.PASS_INFO.date, flight: '207', from: AP.PASS_INFO.from, to: AP.PASS_INFO.to, gate: '15', boarding: '10:20', depart: '10:50', seat: '32A', group: '3' };
    Object.entries(PASSF).forEach(([id, [fx, fy, fw, lab]]) => {
      const hl = o.hl && o.hl[id], dim = o.dim && o.dim.includes(id);
      if (hl) { rr(g, fx - 12, fy - 22, fw, id === 'group' ? 110 : 74, 10); g.fillStyle = hl + '33'; g.fill(); g.strokeStyle = hl; g.lineWidth = 3.5; g.stroke(); }
      g.save(); if (dim) g.globalAlpha *= 0.35;
      txt(g, lab, fx, fy - 4, { size: 15, weight: 500, fam: FM, color: '#5B6168' });
      const big = id === 'group' ? 56 : id === 'name' || id === 'from' || id === 'to' ? 24 : 32;
      txt(g, V[id], fx, fy + (id === 'group' ? 42 : 30), { size: big, weight: 700, fam: id === 'name' || id === 'from' || id === 'to' ? FB : FM, color: COL.ink });
      g.restore();
      if (id === 'gate' && o.gate) { g.strokeStyle = COL.bad; g.lineWidth = 4; g.beginPath(); g.moveTo(fx - 4, fy + 30); g.lineTo(fx + 50, fy + 30); g.stroke(); txt(g, o.gate, fx + 58, fy + 30, { size: 32, weight: 800, fam: FM, color: '#C2531F' }); }
      boxes[id] = { x: x + (fx - 12) * s, y: y + (fy - 22) * s, w: fw * s, h: (id === 'group' ? 110 : 74) * s };
    });
    // 바코드 · 부속 칸
    txt(g, 'SEAT 32A', 760, 250, { size: 22, weight: 700, fam: FM, color: COL.ink });
    for (let i = 0; i < 38; i++) { const bw = (i * 7) % 3 + 1.5; g.fillStyle = COL.ink; g.fillRect(760 + i * 5.4, 284, bw, 46); }
    g.restore();
    return boxes;
  }
  APS.boardingPass = boardingPass;

  /* ---------- 여행 카드 (입국 심사 · 시뮬레이터와 같은 칸) ---------- */
  function travelCard(g, x, y, w, card, o = {}) {
    const rows = AP.cardRows(card).filter((_, i) => !o.skip || !o.skip.includes(i)), rh = o.rh || 38, h = 58 + rows.length * rh + 10, pos = [];
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 14); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 14); g.clip(); g.fillStyle = '#2B3E63'; g.fillRect(x, y, w, 46); g.restore();
    icon(g, 'immig', x + 26, y + 23, 24, '#FFFFFF');
    txt(g, o.title || '여행 카드 · TRAVEL CARD', x + 46, y + 24, { size: 17, weight: 700, color: '#FFFFFF' });
    rows.forEach(([k, v], i) => {
      const yy = y + 58 + i * rh + rh / 2, hl = o.hl === i;
      if (hl) { rr(g, x + 8, yy - rh / 2 + 3, w - 16, rh - 6, 8); g.fillStyle = 'rgba(31,122,85,0.16)'; g.fill(); g.strokeStyle = '#1F7A55'; g.lineWidth = 2.5; g.stroke(); }
      txt(g, k, x + 20, yy, { size: 15, weight: 600, color: '#5B6168' });
      txt(g, v, x + 112, yy, { size: fit(g, v, 17, w - 128, 700), weight: 700, color: hl ? '#14623F' : COL.ink });
      pos.push({ x: x + 8, y: yy, w: w - 16 });
    });
    return { h, rows: pos };
  }
  APS.travelCard = travelCard;

  /* ---------- 가방 그림 (07 · 10장, 직접 해 보기) ---------- */
  const BAGC = { black: '#2A2D33', red: '#B8432B', blue: '#2F62A8', silver: '#AEB7C2', brown: '#7A4E2D', '': '#6B7A8A' };
  function suitcase(g, cx, by, spec, o = {}) {
    const f = spec || {}, big = f.size === 'large' ? 1.25 : f.size === 'small' ? 0.8 : 1, s = (o.s || 1) * big;
    const fill = BAGC[f.color || ''] || BAGC[''], edge = 'rgba(0,0,0,0.35)';
    g.save(); g.translate(cx, by); g.scale(s, s);
    if (f.thing === 'backpack') {
      rr(g, -40, -120, 80, 116, 26); g.fillStyle = fill; g.fill(); g.strokeStyle = edge; g.lineWidth = 2; g.stroke();
      rr(g, -28, -58, 56, 40, 10); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill();
      g.strokeStyle = fill; g.lineWidth = 7; g.beginPath(); g.arc(0, -120, 16, Math.PI, 0); g.stroke();
    } else if (f.thing === 'bag') {
      rr(g, -54, -76, 108, 72, 12); g.fillStyle = fill; g.fill(); g.strokeStyle = edge; g.lineWidth = 2; g.stroke();
      g.strokeStyle = fill; g.lineWidth = 6; g.beginPath(); g.arc(0, -76, 26, Math.PI, 0); g.stroke();
    } else {
      rr(g, -46, -132, 92, 124, 12); g.fillStyle = fill; g.fill(); g.strokeStyle = edge; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 3; [-22, 0, 22].forEach(dx => { g.beginPath(); g.moveTo(dx, -122); g.lineTo(dx, -18); g.stroke(); });
      g.strokeStyle = '#3B4048'; g.lineWidth = 5; g.beginPath(); g.moveTo(-14, -132); g.lineTo(-14, -150); g.lineTo(14, -150); g.lineTo(14, -132); g.stroke();
      const wheels = f.with === 'wheels' ? [-34, -12, 12, 34] : [-30, 30];
      wheels.forEach(dx => circ(g, dx, -3, 6, '#1E2228'));
    }
    if (f.material === 'leather') { g.setLineDash([3, 4]); g.strokeStyle = 'rgba(255,230,190,0.55)'; g.lineWidth = 1.6; rr(g, -38, -124, 76, 108, 9); g.stroke(); g.setLineDash([]); }
    if (f.with === 'redtag' || f.with === 'bluetag' || f.with === 'blacktag') {
      const tc = f.with === 'redtag' ? '#E0533A' : f.with === 'bluetag' ? '#3D7FE0' : '#22252B';
      g.strokeStyle = '#D9D4C7'; g.lineWidth = 2; g.beginPath(); g.moveTo(12, f.thing === 'backpack' ? -128 : -146); g.quadraticCurveTo(34, -138, 38, -118); g.stroke();
      g.save(); g.translate(42, -104); g.rotate(0.18); rr(g, -11, -16, 22, 32, 4); g.fillStyle = tc; g.fill(); circ(g, 0, -10, 2.4, '#D9D4C7'); g.restore();
    }
    if (f.with === 'ribbon') { g.strokeStyle = '#FFD24D'; g.lineWidth = 6; g.beginPath(); g.moveTo(-6, -150); g.lineTo(-16, -120); g.moveTo(6, -150); g.lineTo(18, -122); g.stroke(); }
    g.restore();
  }
  APS.suitcase = suitcase;
  // 돌아가는 벨트와 가방 (t로만 움직임)
  function carousel(g, x, y, w, h, u, o = {}) {
    rr(g, x, y, w, h, h / 2); g.fillStyle = '#2A3440'; g.fill(); g.strokeStyle = '#3A4654'; g.lineWidth = 3; g.stroke();
    rr(g, x + 22, y + 22, w - 44, h - 44, (h - 44) / 2); g.fillStyle = COL.bg; g.fill();
    g.strokeStyle = 'rgba(238,241,244,0.08)'; g.lineWidth = 1.5;
    const per = 2 * (w - h) + Math.PI * h, P = d => { d = ((d % per) + per) % per; const r = h / 2 - 11, cx1 = x + h / 2, cx2 = x + w - h / 2, cy = y + h / 2, L = w - h;
      if (d < L) return [cx1 + d, y + 11]; d -= L; if (d < Math.PI * r) { const a = -Math.PI / 2 + d / r; return [cx2 + Math.cos(a) * r, cy + Math.sin(a) * r]; } d -= Math.PI * r; if (d < L) return [cx2 - d, y + h - 11]; d -= L; const a = Math.PI / 2 + d / r; return [cx1 + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    const cols = ['#B8432B', '#2F62A8', '#7A4E2D', '#AEB7C2', '#3F8F67', '#5D4E8C'];
    for (let k = 0; k < 6; k++) { const [px, py] = P(u * 70 + k * per / 6); rr(g, px - 16, py - 11, 32, 22, 5); g.fillStyle = cols[k]; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke(); }
  }

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(곱하기 표)는 자막에 쓰지 않음
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '공항 회화 · 시범', d: 26, caps: [
      [0.4, 5, '공항에서는 영어가 쏟아질 것 같지만, 사실 **질문은 거의 정해져 있어요**.'],
      [5, 10.5, '입국 심사관이 물어요. What\'s the purpose of your visit? 뭐라고 답할까요?'],
      [10.5, 16, '한국어로 먼저 생각하면 → ‘제 목적은 여행이에요’ → My purpose is trip. 낱말만 옮긴 어색한 말이에요.'],
      [16, 21, '자연스러운 대답 → I\'m here for sightseeing. 더 짧게 → Sightseeing. 이것으로 충분해요.'],
      [21, 26, '**열쇠 낱말**을 잡고, 짧은 **대답 틀**에 내 정보를 넣고, **공손하게** 끝내요. 이 세 단계를 배워요.'],
    ] },
    { id: 'route', n: '01', title: '공항 길 지도', sub: '일곱 곳 · 곳마다 두세 질문', d: 30, caps: [
      [0.4, 6, '공항 길은 일곱 곳이에요. 출발할 때 → 체크인 카운터, 보안 검색대, 탑승구, 그리고 기내.'],
      [6, 12, '도착하면 → 입국 심사대, 수하물 찾는 곳, 세관을 차례로 지나요.'],
      [12, 18, '곳마다 듣는 질문은 두세 개뿐이에요. 체크인 → Window or aisle? 세관 → Anything to declare?'],
      [18, 24, '그래서 공항 영어는 미리 익힐 수 있어요. 곳마다 **열쇠 낱말**과 **대답 틀**을 짝으로 익혀요.'],
      [24, 30, '절차는 나라와 공항마다 조금씩 달라요. 여기서는 어디서나 자주 듣는 질문을 골랐어요.'],
    ] },
    { id: 'checkin', n: '02', title: '체크인 카운터', sub: 'Check-in · 여권 · 자리 · 짐 · 탑승권', d: 34, place: 0, caps: [
      [0.4, 6, '체크인 카운터. 직원 → Passport, please. 여권을 건네며 → Here you are.'],
      [6, 11.5, 'Window or aisle? 둘 가운데 고르라는 말이에요. 고른 것 + please → Window, please.'],
      [11.5, 17, 'Are you checking any bags? 부칠 짐이 있는지 묻는 말이에요. 하나면 → Yes, just one.'],
      [17, 23, '받은 **탑승권**(boarding pass)을 읽어 볼까요? 항공편, 탑승구, 좌석이 적혀 있어요.'],
      [23, 29, '시각이 둘이에요. **탑승 시작**(boarding) 10:20, 출발(departure) 10:50. 탑승구에는 탑승 시작 전에 가요.'],
      [29, 34, '그룹(group) 3을 부르면 줄을 서요. 좌석 32A → 32번째 줄의 A, 보통 창가예요.'],
    ] },
    { id: 'security', n: '03', title: '보안 검색대', sub: 'Security · 지시는 동사로 시작', d: 30, place: 1, caps: [
      [0.4, 6, '보안 검색대에서는 질문보다 **지시**를 많이 들어요. 동사로 시작하는 말이에요.'],
      [6, 12, 'Please take your laptop out. → 노트북을 꺼내요. Take off your belt. → 벨트를 풀어요.'],
      [12, 17.5, 'Step forward, please. → 앞으로 나와요. 대답은 말보다 행동이에요 → Okay. 그리고 그대로 해요.'],
      [17.5, 23.5, '한국어로 들으면 명령 같지만, 영어에서 → Please + 동사 = 공손하고 흔한 지시예요.'],
      [23.5, 30, 'Any liquids? → 액체가 있나요? 없으면 → No, I don\'t. 많은 공항이 기내 액체를 작은 용기만 허락해요.'],
    ] },
    { id: 'gate', n: '04', title: '탑승구와 안내 방송', sub: 'Gate · 숫자 셋 · fifteen · fifty', d: 34, place: 2, caps: [
      [0.4, 6, '탑승구 근처에서는 **안내 방송**이 나와요. 모든 낱말을 알아들을 필요는 없어요.'],
      [6, 12, '숫자 셋만 잡아요 → 항공편 Flight 207, 탑승구 Gate 50, 시각 10:20. 탑승구가 바뀌었어요.'],
      [12, 18, '조심할 숫자 → fifteen, fifty. 15는 **뒤**를 세게, 길게 읽어요 → fif-TEEN.'],
      [18, 23.5, '50은 **앞**을 세게, 끝은 짧게 → FIF-ty. 13과 30, 14와 40, 16과 60도 같아요.'],
      [23.5, 29, '방송의 다른 낱말 → boarding 탑승 시작, delayed 늦어짐, final call 마지막 안내.'],
      [29, 34, '헷갈리면 안내판을 보거나 직원에게 확인해요 → Excuse me, is this Gate 50?'],
    ] },
    { id: 'plane', n: '05', title: '기내에서', sub: 'On the plane · 고르기 · Could I have …?', d: 32, place: 3, caps: [
      [0.4, 6, '기내. 승무원이 식사를 들고 와요 → Chicken or beef? 둘 가운데 고르라는 말이에요.'],
      [6, 11.5, '고른 것 + please → Chicken, please. Something to drink? → Water, please.'],
      [11.5, 17.5, '내가 부탁할 때도 틀이 있어요 → Could I have ___, please? 빈칸에 필요한 것을 넣어요.'],
      [17.5, 23.5, 'Could I have a blanket, please? Could I have some water, please? 틀은 그대로, 칸만 바뀌어요.'],
      [23.5, 28, '‘물 주세요’를 그대로 옮기면 → Give me some water. I want some water. 명령하거나 조르는 말처럼 들려요.'],
      [28, 32, '영어는 부탁을 질문으로 하면 공손해져요 → Could I have some water, please?'],
    ] },
    { id: 'immig', n: '06', title: '입국 심사', sub: 'Immigration · 목적 · 기간 · 장소 · 직업', d: 36, place: 4, caps: [
      [0.4, 6, '입국 심사대. 심사관의 질문도 거의 정해져 있어요. 내 정보는 여행 카드에 적어 두었어요.'],
      [6, 12, 'purpose → 목적. 짧게 → Sightseeing. 다음 질문 How long → 기간을 물어요.'],
      [12, 18, '‘5일 동안’을 그대로 옮기면 → During five days. 틀린 말이에요. 기간은 for + 기간 → For five days.'],
      [18, 24, 'Where … staying → 장소. At the Maple Hotel. 첫 방문이냐고 물으면 → Yes, it\'s my first time.'],
      [24, 30, 'What do you do? → 직업. I\'m a student. 직업 앞에 꼭 → **a**. 한국어에는 없는 낱말이에요.'],
      [30, 36, '대답은 짧아도 돼요. 대신 카드의 **사실**과 맞아야 해요 → Yes, I\'m leaving on May 8.'],
    ] },
    { id: 'baggage', n: '07', title: '수하물 찾기와 분실', sub: 'Baggage claim · 벨트 번호 · 가방 묘사', d: 34, place: 5, caps: [
      [0.4, 6, '수하물 찾는 곳. 안내판에서 내 항공편의 **벨트 번호**를 찾아요 → Flight 207, carousel 4.'],
      [6, 12, '가방이 끝까지 안 나오면 안내 데스크에 말해요 → Excuse me. My suitcase didn\'t come out.'],
      [12, 17.5, '‘안 나왔어요’를 그대로 옮기면 → My bag is not come. 틀린 말이에요. 지난 일은 didn\'t + 동사원형.'],
      [17.5, 23.5, '직원이 물어요 → Can you describe your bag? 가방이 어떻게 생겼는지 말해 달라는 뜻이에요.'],
      [23.5, 29, '순서가 있어요 → 크기, 색, 물건, 그리고 with 특징. a large black suitcase with a red tag.'],
      [29, 34, '한국어는 ‘검은 큰 가방’도 괜찮지만, 영어는 크기가 색보다 앞이에요 → large black.'],
    ] },
    { id: 'customs', n: '08', title: '세관 · 못 알아들었을 때', sub: 'Customs · declare · 다시 묻기', d: 34, place: 6, caps: [
      [0.4, 6, '세관. Anything to declare? → 신고할 물건이 있나요? declare → 신고하다.'],
      [6, 12, '없으면 → No, nothing to declare. 있으면 → Yes, I have some snacks. 있는 그대로 말해요.'],
      [12, 18, '못 알아들었을 때 가장 위험한 대답 → 그냥 Yes. 무엇에 동의했는지 모르잖아요.'],
      [18, 24, '이렇게 다시 물어요 → Sorry? 또는 Could you say that again, please?'],
      [24, 29, '그래도 빠르면 → Could you speak more slowly, please? 다시 묻는 건 실례가 아니에요.'],
      [29, 34, '이 세 줄은 공항 일곱 곳 어디서나 쓰는 **구조 요청**이에요.'],
    ] },
    { id: 'method', n: '09', title: '3단계 말하기 법', sub: '일곱 곳에 한 줄씩', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 말하기 법**으로 묶어요.'],
      [5.5, 11.5, '① **열쇠 낱말 잡기** → 무엇을 묻나? 목적, 기간, 장소, 고르기, 확인, 지시.'],
      [11.5, 17.5, '② **틀에 내 정보 넣기** → 짧은 대답 틀에 사실을 넣어요. For + 기간, At + 장소.'],
      [17.5, 23, '③ **공손하게 끝내기** → please, thank you, Could I …? 못 알아들었으면 Sorry?'],
      [23, 28, '곳마다 한 줄씩 적용했어요. 열쇠 낱말 하나가 대답의 모양을 정해요.'],
    ] },
    { id: 'practice', n: '10', title: '실전 대화', sub: '입국 심사 → 수하물', d: 50, caps: [
      [0.4, 4.5, '실전이에요. 여행 카드 → 학회 참석, 3일, 하버 호텔. 첫 질문 → What\'s the purpose of your visit?'],
      [4.5, 8.5, '① purpose → 목적. (B) For three days → 기간이라 탈락. ② (A) My purpose is → 한국어 그대로라 탈락.'],
      [8.5, 12.5, '정답은 (C) → I\'m here for a conference. 더 짧게 → For a conference.'],
      [12.9, 17, 'How long will you be staying? ① 셋 모두 기간이에요. 이번에는 ②에서 갈려요.'],
      [17, 21, '(A) During → 한국어 ‘동안’ 그대로라 탈락. (B) For a week → 카드는 3일이라 탈락.'],
      [21, 25, '정답은 (C) → For three days. for + 카드의 기간이에요.'],
      [25.4, 29.5, 'Where are you staying? ① 장소를 물어요. (B) Yes, I am → Yes, No 대답이라 탈락.'],
      [29.5, 33.5, '② (A) I stay Harbor Hotel → ‘에’가 빠진 틀이라 탈락.'],
      [33.5, 37.5, '정답은 (C) → At the Harbor Hotel. at + the + 호텔 이름이에요.'],
      [37.9, 42, '가방이 안 나와 안내 데스크에 왔어요. Can you describe your bag? ① (B) Flight 207 → 항공편이라 탈락.'],
      [42, 46, '② (A) silver small → 색이 크기보다 앞이라 탈락.'],
      [46, 50, '정답은 (C) → It\'s a small silver suitcase with a blue tag. 마지막엔 → Thank you.'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '곳 · 열쇠 낱말 · 대답 틀', d: 22, caps: [
      [0.4, 6, '정리해요. 곳마다 질문은 정해져 있고, 열쇠 낱말 하나가 무엇을 묻는지 알려 줘요.'],
      [6, 12, '대답은 짧은 틀에 내 정보를 넣으면 돼요. 문법보다 사실과 맞는지가 먼저예요.'],
      [12, 17, '부탁은 Could I …? 고를 땐 + please. 못 알아들으면 → Sorry? Could you say that again?'],
      [17, 22, '아래 **입국 심사 시뮬레이터**에서 내 카드로 직접 대답해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  APS.CHAPTERS = CHAPTERS; APS.CAPTIONS = CAPTIONS; APS.END = END;
  APS.POSTER = CHAPTERS.find(c => c.id === 'immig').t + 27.0;
  APS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  APS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 실전 장면의 시각 (구간 시작 · 보기 · ① · ② · 정답)
  const PSEG = [0, 12.5, 25, 37.5];
  const PT = { q: 0.4, opt: [1.6, 2.2, 2.8], s1: 5.0, s2: 7.0, win: 9.2, lines: [0.4, 4.5, 8.5] };
  APS.PSEG = PSEG;

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  const label = (g, s, x, y, o = {}) => txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o));
  const Qm = id => { const q = AP.Q[id]; return q.key.map(k => [k, 'key']); };
  const QT = (id, short) => { const q = AP.Q[id]; return short && q.short ? q.short : q.en; };
  // 열쇠 낱말 → 대답 틀 노트 (오른쪽 칸)
  function notePanel(g, x, y, w, rows, u) {
    fade(g, ramp(u, rows.length ? rows[0][2] - 0.4 : 0, 0.4), () => {
      panel(g, x, y, w, 60 + rows.length * 84, { fill: COL.panel, stroke: COL.faint });
      txt(g, '열쇠 낱말 → 대답 틀', x + 20, y + 30, { size: 16, weight: 700, color: COL.muted });
    });
    rows.forEach(([k, f, at], i) => fade(g, ramp(u, at, 0.4), () => {
      const yy = y + 76 + i * 84;
      txt(g, k, x + 20, yy, { size: fit(g, k, 19, w - 40, 700), weight: 700, color: COL.ante });
      pieces(g, f, x + 20, yy + 34, 18, w - 40);
    }));
  }
  // [글, 역할] 이어 쓰기
  function pieces(g, parts, x, y, size, maxW, o = {}) {
    let w = 0; parts.forEach(([t, r]) => { w += tw(g, t, size, r ? 600 : 500); });
    const sz = maxW && w > maxW ? size * maxW / w : size;
    let xx = o.align === 'center' ? x - w * sz / size / 2 : x;
    parts.forEach(([t, r]) => { const c = RC[r] || o.color || COL.soft; xx += txt(g, t, xx, y, { size: sz, weight: r ? 600 : 500, color: c }); });
    return w * sz / size;
  }
  // 대답 → [글, 역할] 조각
  const ansParts = a => AP.segs(a).map(s => [s.t, s.r === 'frame' ? 'frame' : s.r]);

  const SCENES = {
    /* 00 들어가며: 제목 → 입국 심사 한 장면(한국어 그대로 → 자연스러운 말 → 짧은 말) → 3단계 */
    intro(g, u) {
      fade(g, ramp(u, 0.2, 0.6) * (1 - ramp(u, 4.0, 0.5)), () => {
        txt(g, '공항, 질문은 정해져 있다', W / 2, 270, { size: 56, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Airport English · 체크인부터 세관까지 일곱 곳', W / 2, 340, { size: 24, weight: 500, color: COL.muted, align: 'center' });
        AP.PLACES.forEach((p, i) => fade(g, ramp(u, 0.9 + i * 0.22, 0.4), () => {
          const x = W / 2 + (i - 3) * 118;
          circ(g, x, 440, 32, COL.panel2); ring(g, x, 440, 32, i < 4 ? COL.ante : COL.clause, 1.8);
          icon(g, p.id, x, 440, 30, COL.soft);
          txt(g, p.ko, x, 496, { size: 15, weight: 600, color: COL.muted, align: 'center' });
          if (i < 6) { g.fillStyle = COL.faint; g.fillRect(x + 38, 439, 42, 2); }
        }));
      });
      const it = AP.INTRO, q = AP.Q[it.q];
      fade(g, ramp(u, 4.6, 0.4) * (1 - ramp(u, 20.6, 0.5)), () => {
        fade(g, ramp(u, 4.6, 0.5), () => { label(g, '입국 심사대 · Immigration', LX, 160, { color: COL.accent, size: 16 }); });
        const B = talk(g, { side: 'L', x: LX, y: 180, w: 1120, text: q.en, marks: Qm(it.q), kind: 'officer', sp: 'us', at: 5.4, u, roleAt: 8.2, size: 26 });
        fade(g, ramp(u, 8.4, 0.4), () => tag(g, '열쇠 낱말 purpose → 목적', B.ex + 24, 180 + B.bh / 2, COL.ante, { size: 16 }));
        // 생각 구름 (한국어로 먼저 생각함)
        fade(g, ramp(u, 10.6, 0.4) * (1 - ramp(u, 16.0, 0.4)), () => {
          const x = 610, y = 290;
          panel(g, x, y, 470, 52, { fill: 'rgba(242,194,154,0.08)', stroke: 'rgba(242,194,154,0.5)', dash: true, r: 26 });
          circ(g, x + 480, y + 66, 6, 'rgba(242,194,154,0.35)'); circ(g, x + 496, y + 80, 4, 'rgba(242,194,154,0.35)');
          txt(g, '(한국어로) 제 목적은 … 여행이에요', x + 235, y + 27, { size: 20, weight: 600, color: '#F2C29A', align: 'center' });
        });
        const p1 = clamp((u - 16.2) / 1.0), p2 = clamp((u - 19.0) / 0.8);
        const A = p2 > 0 ? it.here : it.lit, Bn = p2 > 0 ? it.short : it.here, pp = p2 > 0 ? p2 : p1;
        const ans = answer(g, { x: LX, y: 372, w: 1120, A, B: u >= 16.2 ? Bn : null, p: pp, at: 12.0, u, size: 28, trapAt: u < 19.0 ? 14.2 : null, strikeAt: 14.4,
          verdict: u >= 17.6 ? { ok: true, at: u >= 19.0 ? 19.9 : 17.6 } : null });
        fade(g, ramp(u, 14.8, 0.4) * (1 - ramp(u, 16.0, 0.3)), () => tag(g, '한국어를 낱말 그대로 옮긴 말', ans.bx + ans.bw, 372 + ans.bh + 30, COL.trap, { align: 'right' }));
        fade(g, ramp(u, 17.8, 0.4) * (1 - ramp(u, 18.8, 0.3)), () => pieces(g, [['대답 틀', 'frame'], [' + ', ''], ['내 정보', 'slot'], [' → 자연스러운 말', '']], 960, 372 + 96, 19, 0, { align: 'center' }));
        fade(g, ramp(u, 20.0, 0.4), () => tag(g, '짧아도 충분해요', 1200, 372 + 96, COL.clause, { align: 'right' }));
      });
      // 3단계
      const STEPS = [['①', '열쇠 낱말 잡기', 'purpose → 목적', COL.ante], ['②', '틀에 내 정보 넣기', 'I\'m here + for sightseeing', COL.rel], ['③', '공손하게 끝내기', 'please · thank you · Could I …?', COL.verb]];
      STEPS.forEach(([n, t1, t2, c], k) => {
        const a = ramp(u, 21.2 + k * 0.5, 0.5), x0 = LX + k * 380;
        fade(g, a, () => {
          panel(g, x0, 196 + (1 - a) * 12, 360, 180, { fill: COL.panel, stroke: c, lw: 2 });
          txt(g, n, x0 + 26, 246 + (1 - a) * 12, { size: 32, weight: 700, color: c });
          txt(g, t1, x0 + 76, 246 + (1 - a) * 12, { size: 26, weight: 800, fam: FD });
          txt(g, t2, x0 + 26, 322 + (1 - a) * 12, { size: fit(g, t2, 20, 310, 600), weight: 600, color: COL.en });
          if (k < 2) arrow(g, x0 + 362, 286, x0 + 378, 286, COL.accent, 2.5);
        });
      });
      fade(g, ramp(u, 23.0, 0.5), () => txt(g, '공항 영어 = 정해진 질문 + 짧은 대답 틀 + 공손한 끝맺음', W / 2, 452, { size: 24, weight: 700, color: COL.soft, align: 'center' }));
    },

    /* 01 공항 길 지도: 일곱 곳과 곳마다의 질문 */
    route(g, u) {
      const XS = [170, 450, 730, 1010], Y1 = 178, Y2 = 392;
      const pos = i => i < 4 ? [XS[i], Y1] : [XS[i - 4], Y2];
      const sel = S.stop != null ? S.stop : null;
      // 길
      fade(g, ramp(u, 0.4, 0.8), () => {
        g.strokeStyle = 'rgba(110,200,255,0.45)'; g.lineWidth = 4; g.lineCap = 'round';
        const p1 = clamp((u - 0.6) / 2.4);
        for (let k = 0; k < 3; k++) { const a = XS[k] + 32, b = XS[k + 1] - 32, e = clamp(p1 * 3 - k); if (e > 0) { g.beginPath(); g.moveTo(a, Y1); g.lineTo(lerp(a, b, e), Y1); g.stroke(); } }
      });
      fade(g, ramp(u, 3.4, 0.6), () => {
        g.strokeStyle = 'rgba(238,241,244,0.35)'; g.lineWidth = 3; g.setLineDash([4, 8]);
        g.beginPath(); g.moveTo(XS[3] + 32, Y1); g.lineTo(1170, Y1); g.quadraticCurveTo(1200, Y1, 1200, Y1 + 30); g.lineTo(1200, 318); g.quadraticCurveTo(1200, 344, 1170, 344);
        g.lineTo(96, 344); g.quadraticCurveTo(68, 344, 68, 368); g.lineTo(68, Y2 - 22); g.quadraticCurveTo(68, Y2, 96, Y2); g.lineTo(XS[0] - 32, Y2); g.stroke(); g.setLineDash([]);
        chip(g, '비행 · 바다 건너', 640, 344, { size: 15, weight: 700, color: COL.soft, fill: COL.bg, stroke: COL.faint, h: 30 });
        icon(g, 'gate', 560, 344, 20, COL.soft);
      });
      fade(g, ramp(u, 6.2, 0.6), () => {
        g.strokeStyle = 'rgba(127,224,168,0.5)'; g.lineWidth = 4; g.lineCap = 'round';
        const p2 = clamp((u - 6.4) / 2.0);
        for (let k = 0; k < 2; k++) { const a = XS[k] + 32, b = XS[k + 1] - 32, e = clamp(p2 * 2 - k); if (e > 0) { g.beginPath(); g.moveTo(a, Y2); g.lineTo(lerp(a, b, e), Y2); g.stroke(); } }
        if (p2 >= 1) arrow(g, XS[2] + 34, Y2, XS[2] + 96, Y2, 'rgba(127,224,168,0.8)', 4);
      });
      fade(g, ramp(u, 0.5, 0.5), () => { label(g, '출발 · 서울', 310, 154, { size: 15, color: COL.ante, align: 'center' }); });
      fade(g, ramp(u, 6.0, 0.5), () => { label(g, '도착 · 시애틀', 310, 368, { size: 15, color: COL.clause, align: 'center' }); });
      fade(g, ramp(u, 8.4, 0.4), () => txt(g, '출구', XS[2] + 104, Y2, { size: 15, weight: 700, color: COL.clause }));
      AP.PLACES.forEach((p, i) => {
        const [x, y] = pos(i), at = i < 4 ? 0.7 + i * 0.6 : 6.4 + (i - 4) * 0.7, on = sel === i, dim = sel != null && !on;
        fade(g, ramp(u, at, 0.45) * (dim ? 0.4 : 1), () => {
          const c = i < 4 ? COL.ante : COL.clause;
          circ(g, x, y, 30, on ? COL.accent : COL.panel2); ring(g, x, y, 30, on ? COL.accent : c, 2.2);
          icon(g, p.id, x, y, 30, on ? '#1D1305' : COL.text);
          txt(g, p.ko, x, y + 46, { size: 19, weight: 700, align: 'center' });
          txt(g, p.en, x, y + 68, { size: 13, weight: 500, fam: FM, color: COL.muted, align: 'center' });
          // 질문
          AP.ROUTE[p.id].forEach((qid, k) => fade(g, sel != null ? 1 : ramp(u, 12.2 + i * 0.45 + k * 0.15, 0.4), () => {
            const t = QT(qid, true), yy = y + 96 + k * 24;
            txt(g, t, x, yy, { size: fit(g, t, 15, 262, 500), weight: 500, color: on ? COL.text : COL.en, align: 'center' });
            say(x - 131, yy - 11, 262, 22, AP.Q[qid].en);
          }));
        });
        HITS.push({ x: x - 34, y: y - 34, w: 68, h: 68, stop: i });
      });
      // 오른쪽 아래 칸
      const bx = 900, by = 372, bw = 300, bh = 186;
      if (sel != null) {
        const p = AP.PLACES[sel];
        panel(g, bx, by, bw, bh, { fill: COL.panel, stroke: COL.accent });
        icon(g, p.id, bx + 30, by + 30, 24, COL.accent);
        txt(g, p.ko, bx + 52, by + 30, { size: 18, weight: 700, color: COL.accent });
        AP.ROUTE[p.id].forEach((qid, k) => { const t = QT(qid); txt(g, t, bx + 20, by + 70 + k * 30, { size: fit(g, t, 16, bw - 40, 600), weight: 600, color: COL.en }); });
        const qs = AP.ROUTE[p.id].map(q => AP.Q[q]).filter(q => q.intent);
        txt(g, `열쇠 낱말 → ${qs.map(q => q.key[0]).join(' · ')}`, bx + 20, by + bh - 20, { size: fit(g, `열쇠 낱말 → ${qs.map(q => q.key[0]).join(' · ')}`, 14, bw - 40, 600), weight: 600, color: COL.ante });
      } else {
        fade(g, ramp(u, 18.2, 0.5), () => {
          panel(g, bx, by, bw, bh, { fill: COL.panel, stroke: COL.faint });
          txt(g, '7곳', bx + 22, by + 50, { size: 42, weight: 800, fam: FD, color: COL.accent });
          txt(g, '곳마다 질문 두세 개', bx + 120, by + 52, { size: 18, weight: 700 });
          pieces(g, [['열쇠 낱말', 'key'], [' + ', ''], ['대답 틀', 'frame']], bx + 22, by + 104, 20);
          txt(g, '→ 짝으로 미리 익혀요', bx + 22, by + 140, { size: 18, weight: 600, color: COL.soft });
        });
        fade(g, ramp(u, 24.2, 0.5), () => tag(g, '나라 · 공항마다 절차는 조금씩 달라요', bx + bw, by + bh + 12, COL.muted, { align: 'right', size: 14, h: 28 }));
      }
    },

    /* 02 체크인: 세 마디 → 탑승권 읽기 */
    checkin(g, u) {
      const out = 1 - ramp(u, 16.8, 0.5), sc = AP.SCENE.checkin;
      if (out > 0.001) fade(g, out, () => {
        const AT = [[0.8, 2.6], [6.2, 9.0], [11.8, 14.6]], Y = [150, 290, 430];
        sc.forEach(([qid, a], i) => {
          const B = talk(g, { side: 'L', x: LX, y: Y[i], w: 720, text: AP.Q[qid].en, marks: Qm(qid), kind: 'desk', sp: 'gb', at: AT[i][0], u, roleAt: AT[i][0] + 1.0, size: 22 });
          void B;
          answer(g, { x: LX, y: Y[i] + 62, w: 720, A: a, at: AT[i][1], u, size: 22, verdict: { ok: AP.judge(qid, a, AP.SCENE.checkinCard).ok, at: AT[i][1] + 0.8 } });
        });
        notePanel(g, 840, 150, 360, [['Passport', [['Here you are.', 'frame']], 2.8], ['Window or aisle', [['___', 'slot'], [', ', ''], ['please', 'pol'], ['.', '']], 9.2], ['checking any bags', [['Yes, just one.', 'frame']], 14.8]], u);
      });
      // 탑승권
      const pa = ramp(u, 17.4, 0.6);
      if (pa > 0.001) fade(g, pa, () => {
        const sel = S.pass;
        const hl = {}, dim = [];
        if (sel) hl[sel] = COL.accent;
        else {
          if (u >= 18.6 && u < 23) { hl.flight = COL.ante; hl.gate = COL.ante; hl.seat = COL.ante; }
          if (u >= 23.2) { hl.boarding = COL.accent; dim.push('depart'); }
          if (u >= 29.2) { hl.group = COL.clause; hl.seat = COL.clause; }
        }
        const boxes = boardingPass(g, 140, 150 + (1 - pa) * 20, 1000, { hl, dim: sel ? [] : dim });
        Object.entries(boxes).forEach(([id, b]) => { const P = AP.PASS.find(x => x.id === id); if (P) HITS.push({ x: b.x, y: b.y, w: b.w, h: b.h, say: P.say, pass: id }); });
        const note = (t, c) => fade(g, 1, () => { panel(g, 140, 524, 1000, 50, { fill: COL.panel2, stroke: c, r: 12 }); txt(g, t, 640, 549, { size: fit(g, t, 19, 960, 700), weight: 700, color: c, align: 'center' }); });
        if (sel) { const P = AP.PASS.find(x => x.id === sel); note(`${P.en} ${P.v} → ${P.ko}`, COL.accent); }
        else if (u >= 29.2) note('GROUP 3 → 이 번호를 부르면 줄을 서요 · SEAT 32A → 32번째 줄 A (보통 창가)', COL.clause);
        else if (u >= 23.2) note('BOARDING 10:20 → 탑승 시작 · 이때까지 탑승구에!   DEPARTS 10:50 → 출발 (문은 더 먼저 닫혀요)', COL.accent);
        else if (u >= 18.6) note('FLIGHT 항공편 · GATE 탑승구 · SEAT 좌석 — 칸 이름은 영어 대문자로 적혀 있어요', COL.ante);
      });
    },

    /* 03 보안 검색: 지시 → 행동 */
    security(g, u) {
      const sc = AP.SCENE.security, sel = S.sec != null ? AP.SEC[S.sec] : null;
      // 동작 카드 넷 (오른쪽)
      const CARDS = [['laptop', 700, 150], ['belt', 960, 150], ['step', 700, 318], ['liquid', 960, 318]], LIT = { laptop: 6.6, belt: 9.2, step: 12.8, liquid: 24.2 };
      fade(g, ramp(u, 0.6, 0.5), () => CARDS.forEach(([id, x, y]) => {
        const on = sel ? sel.act === id : u >= LIT[id], hot = sel ? sel.act === id : (u >= LIT[id] && u < LIT[id] + 3.4);
        panel(g, x, y, 240, 150, { fill: on ? COL.panel2 : COL.panel, stroke: hot ? COL.accent : on ? COL.line : COL.faint, lw: hot ? 2.5 : 1.5 });
        fade(g, on ? 1 : 0.35, () => actIcon(g, id, x + 120, y + 62));
        txt(g, id === 'liquid' ? '액체 확인' : AP.ACTS[id], x + 120, y + 128, { size: 17, weight: 700, color: on ? COL.text : COL.muted, align: 'center' });
      }));
      fade(g, ramp(u, 1.2, 0.5) * (1 - ramp(u, 17.2, 0.4)), () => tag(g, '지시(명령문) → 동사로 시작해요 · Take … · Step … · Put …', LX, 538, COL.rel));
      // 지시 말풍선
      const AT = [6.0, 8.8, 12.4], Y = [150, 228, 306];
      fade(g, 1 - ramp(u, 23.4, 0.4), () => sc.slice(0, 3).forEach(([qid, a], i) => {
        const q = AP.Q[qid], short = QT(qid, true), on = sel && sel.q === qid;
        const B = talk(g, { side: 'L', x: LX, y: Y[i], w: 600, text: short, marks: Qm(qid).concat([['please', 'pol']]), kind: 'guard', sp: 'us', at: AT[i], u, roleAt: AT[i] + 0.7, size: 20, edge: on ? COL.accent : undefined });
        fade(g, ramp(u, AT[i] + 1.4, 0.4), () => { const c = chip(g, 'Okay.', B.ex + 46, Y[i] + B.bh / 2, { size: 16, weight: 700, color: COL.rel, fill: '#1A2622', stroke: 'rgba(242,194,154,0.5)', h: 30 }); say(c.x, c.y, c.w, c.h, 'Okay.'); });
        void q;
      }));
      // 한국어와 다른 점
      fade(g, win(u, 17.6, 23.6), () => {
        panel(g, LX, 392, 600, 176, { fill: COL.panel2, stroke: COL.verb });
        txt(g, '한국어로 들으면', LX + 22, 424, { size: 16, weight: 600, color: COL.muted });
        txt(g, '‘노트북 꺼내세요’ → 명령 같아서 기분이 나쁠까?', LX + 22, 456, { size: 19, weight: 600, color: COL.soft });
        txt(g, '영어에서는', LX + 22, 498, { size: 16, weight: 600, color: COL.muted });
        pieces(g, [['Please', 'pol'], [' + 동사 … → 공손하고 흔한 지시예요', '']], LX + 22, 532, 20);
      });
      // 액체
      fade(g, ramp(u, 23.8, 0.4), () => {
        const [qid, a] = sc[3];
        talk(g, { side: 'L', x: LX, y: 392, w: 600, text: AP.Q[qid].en, marks: Qm(qid), kind: 'guard', sp: 'us', at: 24.0, u, roleAt: 24.6, size: 22 });
        answer(g, { x: LX, y: 452, w: 600, A: a, at: 25.4, u, size: 22, verdict: { ok: true, at: 26.2 } });
        fade(g, ramp(u, 27.0, 0.4), () => tag(g, '많은 공항 → 기내 액체는 작은 용기만 (예: 100밀리리터)', LX, 548, COL.muted, { size: 14, h: 28 }));
      });
    },

    /* 04 탑승구와 안내 방송 */
    gate(g, u) {
      const A1 = 'Attention, please. The gate for Flight 207 to Seattle has changed.', A2 = 'Flight 207 will now depart from Gate 50.', A3 = 'Boarding will begin at 10:20.';
      const outA = 1 - ramp(u, 11.8, 0.4);
      fade(g, outA, () => {
        panel(g, LX, 148, 1120, 220, { fill: COL.panel, stroke: COL.faint });
        circ(g, LX + 52, 200, 30, COL.panel2); icon(g, 'horn', LX + 52, 200, 30, COL.accent);
        label(g, '안내 방송', LX + 22, 258, { size: 14 });
        let at = 0.8;
        [A1, A2, A3].forEach((t, i) => {
          const R = richLay(g, t, [['Flight 207', 'key'], ['Gate 50', 'key'], ['10:20', 'key']], 25, 980, { weight: 500 });
          const shown = (u - at) / WD;
          richDraw(g, R, LX + 110, 196 + i * 56, { shown, rolesOn: u >= 6.4 });
          listen(LX + 104, 176 + i * 56, R.w + 12, 40, [{ text: t, sp: 'gb' }]);
          at += nWords(t) * WD + 0.3;
        });
        const CH = [['항공편 → 207', 6.6], ['탑승구 → 50', 7.4], ['시각 → 10:20', 8.2]];
        CH.forEach(([t, a], i) => fade(g, ramp(u, a, 0.4), () => tag(g, t, LX + i * 230, 412, COL.ante, { size: 19, h: 42 })));
        fade(g, ramp(u, 9.2, 0.5), () => {
          panel(g, 800, 392, 400, 120, { fill: COL.paper, r: 12 });
          txt(g, 'GATE', 826, 420, { size: 15, weight: 500, fam: FM, color: '#5B6168' });
          txt(g, '15', 826, 462, { size: 38, weight: 800, fam: FM, color: COL.ink });
          g.strokeStyle = COL.bad; g.lineWidth = 4; g.beginPath(); g.moveTo(820, 462); g.lineTo(880, 462); g.stroke();
          arrow(g, 896, 462, 960, 462, '#C2531F', 3);
          txt(g, '50', 976, 462, { size: 38, weight: 800, fam: FM, color: '#C2531F' });
          txt(g, '탑승권의 탑승구가 바뀌었어요', 1000, 492, { size: 15, weight: 600, color: '#5B6168', align: 'center' });
        });
      });
      // fifteen · fifty 힘주기
      const pr = S.num != null ? AP.NUMS[S.num] : AP.NUMS[2];
      const inB = S.num != null ? 1 : win(u, 12.2, 23.6);
      if (inB > 0.001 && u >= 11.8) fade(g, inB, () => {
        const teen = AP.numWord(pr[0]), ty = AP.numWord(pr[1]);
        const sylT = [teen.replace(/teen$/, ''), 'teen'], sylY = [ty.replace(/ty$/, ''), 'ty'];
        const draw = (cx, syl, big, n, at, note) => fade(g, S.num != null ? 1 : ramp(u, at, 0.5), () => {
          txt(g, String(n), cx - 70, 186, { size: 44, weight: 800, fam: FM, color: COL.accent, align: 'center' });
          txt(g, AP.numWord(n), cx + 40, 188, { size: 30, weight: 600, color: COL.en, align: 'center' });
          const ws = syl.map((s, k) => 110 + (k === big ? 50 : 0)), tot = ws[0] + ws[1] + 10;
          let x = cx - tot / 2;
          syl.forEach((s, k) => {
            const h = k === big ? 120 : 52, y0 = 380 - h;
            rr(g, x, y0, ws[k], h, 10); g.fillStyle = k === big ? 'rgba(255,193,94,0.25)' : 'rgba(238,241,244,0.08)'; g.fill(); g.strokeStyle = k === big ? COL.accent : COL.line; g.lineWidth = 2; g.stroke();
            txt(g, k === big ? s.toUpperCase() : s, x + ws[k] / 2, 410, { size: k === big ? 34 : 26, weight: k === big ? 800 : 500, color: k === big ? COL.accent : COL.soft, align: 'center' });
            x += ws[k] + 10;
          });
          txt(g, note, cx, 460, { size: 19, weight: 700, color: COL.soft, align: 'center' });
          say(cx - tot / 2, 240, tot, 190, AP.numWord(n));
        });
        draw(380, sylT, 1, pr[0], 12.6, '끝을 세게, 길게 (-teen)');
        draw(900, sylY, 0, pr[1], 18.2, '앞을 세게, 끝은 짧게 (-ty)');
        fade(g, S.num != null ? 1 : ramp(u, 20.0, 0.5), () => {
          const PAIRS = AP.NUMS.filter((_, i) => i !== AP.NUMS.indexOf(pr)).slice(0, 5);
          txt(g, '같은 짝', LX, 534, { size: 16, weight: 700, color: COL.muted });
          PAIRS.forEach(([a, b], i) => chip(g, `${a} · ${b}`, LX + 90 + i * 150, 534, { size: 18, weight: 700, color: COL.en, fill: COL.panel2, stroke: COL.faint, h: 36 }));
        });
      });
      // 다른 낱말 · 안내판
      if (S.num == null) fade(g, ramp(u, 23.8, 0.5), () => {
        const W4 = [['boarding', '탑승 시작'], ['delayed', '늦어짐'], ['final call', '마지막 탑승 안내'], ['gate change', '탑승구 바뀜']];
        W4.forEach(([e, k], i) => fade(g, ramp(u, 24.0 + i * 0.5, 0.4), () => {
          const x = LX + (i % 2) * 560, y = 170 + Math.floor(i / 2) * 64;
          const ww = txt(g, e, x, y, { size: 26, weight: 700, color: COL.en });
          say(x - 4, y - 18, ww + 8, 36, e);
          txt(g, '→ ' + k, x + ww + 14, y, { size: 21, weight: 600, color: COL.soft });
        }));
        fade(g, ramp(u, 29.2, 0.5), () => {
          panel(g, LX, 318, 640, 250, { fill: '#0B0F14', stroke: COL.faint });
          txt(g, 'DEPARTURES  출발', LX + 22, 346, { size: 18, weight: 700, fam: FM, color: COL.accent });
          const cols = [LX + 22, LX + 132, LX + 330, LX + 440];
          ['FLIGHT', 'TO', 'GATE', 'STATUS'].forEach((h, i) => txt(g, h, cols[i], 382, { size: 14, weight: 500, fam: FM, color: COL.muted }));
          [['207', 'SEATTLE', '50', 'BOARDING', true], ['118', 'TOKYO', '12', 'DELAYED'], ['365', 'SYDNEY', '33', 'ON TIME']].forEach((r, k) => {
            const y = 422 + k * 46;
            if (r[4]) { rr(g, LX + 10, y - 20, 616, 40, 6); g.fillStyle = 'rgba(255,193,94,0.12)'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 1.5; g.stroke(); }
            r.slice(0, 4).forEach((c, i) => txt(g, c, cols[i], y, { size: 21, weight: 600, fam: FM, color: r[4] ? COL.accent : '#E8C66A' }));
          });
        });
        answer(g, { x: 740, y: 440, w: 460, A: { f: 'gt_conf', v: '50' }, toksA: [{ id: 'e', t: 'Excuse', r: 'pol' }, { id: 'm', t: 'me', r: 'pol' }, { id: 'c', t: ',', r: '' }, { id: 'i', t: 'is', r: 'frame' }, { id: 't', t: 'this', r: 'frame' }, { id: 'g', t: 'Gate', r: 'frame' }, { id: 'n', t: '50', r: 'slot' }, { id: 'q', t: '?', r: '' }], at: 30.4, u, size: 22, noHit: true });
        if (u >= 30.0) listen(740, 440, 460, 56, [{ text: 'Excuse me, is this Gate 50?', sp: 'me' }]);
      });
    },

    /* 05 기내: 고르기 → Could I have ___, please? → 한국어 그대로의 함정 */
    plane(g, u) {
      const sc = AP.SCENE.plane, outA = 1 - ramp(u, 11.2, 0.4);
      fade(g, outA, () => {
        const AT = [[0.8, 3.6], [6.4, 8.6]], Y = [160, 320];
        sc.forEach(([qid, a], i) => {
          talk(g, { side: 'L', x: LX, y: Y[i], w: 720, text: AP.Q[qid].en, marks: Qm(qid), kind: 'crew', sp: 'gb', at: AT[i][0], u, roleAt: AT[i][0] + 1.0, size: 24 });
          answer(g, { x: LX, y: Y[i] + 70, w: 720, A: a, at: AT[i][1], u, size: 24, verdict: { ok: true, at: AT[i][1] + 0.8 } });
        });
        notePanel(g, 840, 150, 360, [['Chicken or beef', [['___', 'slot'], [', ', ''], ['please', 'pol'], ['.', '']], 4.0], ['Something to drink', [['___', 'slot'], [', ', ''], ['please', 'pol'], ['.', '']], 9.0]], u);
      });
      // 부탁 틀
      const inB = S.req ? 1 : win(u, 11.6, 23.6);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        const size = 40;
        const NEED = AP.SCENE.could, cyc = S.req ? null : u < 17.6 ? -1 : u < 20.4 ? 0 : 1;
        const fill = S.req ? null : cyc >= 0 ? NEED[cyc] : null;
        if (S.req) {
          const a = S.req, j = AP.judge('pl_help', a, { need: S.req.need || a.v }, '상황');
          const L = lay(g, ansToks(a), { x: W / 2, y: 236, size: 36, align: 'center', maxW: 1080 });
          drawLay(g, L);
          mark(g, j.ok, L.x + L.w + 30, 236, 20);
          say(L.x, 210, L.w, 52, AP.text(a));
          const why = `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
          txt(g, why, W / 2, 300, { size: fit(g, why, 18, 1100, 600), weight: 600, color: j.ok ? COL.good : COL.trap, align: 'center' });
        } else {
          const toks = [{ id: 'c', t: 'Could', r: 'pol' }, { id: 'i', t: 'I', r: 'pol' }, { id: 'h', t: 'have', r: 'frame' }];
          const fillT = fill ? AP.SLOT.need.vals[fill].t : null;
          const bwid = fillT ? tw(g, fillT, size, 600) + 12 : size * 3.4;
          toks.push({ id: 'b', t: '', r: 'blank', bw: bwid }, { id: 'cm', t: ',', r: '' }, { id: 'p', t: 'please', r: 'pol' }, { id: 'q', t: '?', r: '' });
          const L = lay(g, toks, { x: W / 2, y: 236, size, align: 'center' });
          drawLay(g, L, it => it.r === 'blank' ? { glow: fill ? 0 : 0.5 + 0.5 * Math.sin(u * 4) } : {});
          const B = L.byId.b;
          // 칸 칩
          NEED.forEach((k, i) => {
            const t = AP.SLOT.need.vals[k].t, cx = W / 2 + (i - 1.5) * 250, cy = 380;
            const isIn = fill === k, p = isIn ? clamp((u - (cyc === 0 ? 17.6 : 20.4)) / 0.6) : 0;
            const x = lerp(cx - tw(g, t, 26, 600) / 2, B.x + 6, ease(p)), y = lerp(cy, 236, ease(p)), sz = lerp(26, size, ease(p));
            fade(g, ramp(u, 13.2 + i * 0.4, 0.4), () => {
              if (p < 1) { rr(g, cx - tw(g, t, 26, 600) / 2 - 14, cy - 22, tw(g, t, 26, 600) + 28, 44, 12); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = 'rgba(127,224,168,0.45)'; g.lineWidth = 1.5; g.stroke(); }
              drawTok(g, { t, r: 'slot', x, y, w: tw(g, t, sz, 600), size: sz });
            });
            HITS.push({ x: cx - 90, y: cy - 22, w: 180, h: 44, say: `Could I have ${t}, please?` });
          });
          if (fill && u >= (cyc === 0 ? 18.4 : 21.2)) mark(g, true, L.x + L.w + 30, 236, 20);
          fade(g, ramp(u, 12.4, 0.4), () => txt(g, '틀은 그대로, 칸만 바꿔요', W / 2, 470, { size: 22, weight: 700, color: COL.soft, align: 'center' }));
          if (fill) say(L.x, 210, L.w, 52, `Could I have ${fillT}, please?`);
        }
      });
      // 한국어 그대로
      if (!S.req) fade(g, ramp(u, 23.8, 0.4), () => {
        chip(g, '(한국어로) 물 주세요', LX, 172, { size: 20, weight: 700, color: '#F2C29A', fill: 'rgba(242,194,154,0.08)', stroke: 'rgba(242,194,154,0.5)', dash: true, h: 44 });
        const [g1, g2, ok] = AP.SCENE.blunt;
        answer(g, { x: LX, y: 222, w: 760, A: g1, at: 24.2, u, size: 24, trapAt: 25.2, strikeAt: 25.3, tag: ['명령처럼 들려요', COL.trap, 25.6], tagX: 860, tagY: 222 + 26 });
        answer(g, { x: LX, y: 304, w: 760, A: g2, at: 25.6, u, size: 24, trapAt: 26.6, strikeAt: 26.7, tag: ['조르는 말처럼 들려요', COL.trap, 27.0], tagX: 860, tagY: 304 + 26 });
        answer(g, { x: LX, y: 398, w: 760, A: ok, at: 28.2, u, size: 26, verdict: { ok: true, at: 29.0 } });
        fade(g, ramp(u, 29.4, 0.4), () => tag(g, '부탁을 질문으로 → 공손해요', 860, 398 + 28, COL.verb));
      });
    },

    /* 06 입국 심사: 여행 카드 + 여섯 질문 (함정 둘) + 대답 기록 */
    immig(g, u) {
      const C = AP.DEMO, rowOf = { im_purpose: 1, im_length: 2, im_stay: 3, im_job: 4, im_first: 5, im_ret: 6 };
      // 시각: [질문, 대답(함정), 대답(맞음), 기록]
      const TT = [[6.2, null, 8.0, 9.0], [9.4, 12.2, 15.0, 16.0], [18.2, null, 19.6, 20.6], [21.0, null, 22.2, 23.2], [24.2, 25.2, 27.4, 28.4], [30.2, null, 31.4, 32.4]];
      const sel = S.imq;
      let active = -1;
      TT.forEach((tt, i) => { if (u >= tt[0] - 0.3) active = i; });
      const cardHl = sel != null ? rowOf[AP.IMMIG[sel][0]] : active >= 0 && u < TT[active][3] + 0.8 ? rowOf[AP.IMMIG[active][0]] : null;
      fade(g, ramp(u, 0.4, 0.5), () => travelCard(g, 870, 150, 330, C, { hl: cardHl }));
      // 여는 말: 여권 (시뮬레이터의 첫 질문과 같음)
      if (sel == null) fade(g, 1 - ramp(u, 5.4, 0.4), () => {
        talk(g, { side: 'L', x: LX, y: 150, w: 760, text: AP.Q.im_pass.en, marks: Qm('im_pass'), kind: 'officer', sp: 'us', at: 1.0, u, roleAt: 1.6, size: 24 });
        answer(g, { x: LX, y: 226, w: 760, A: { f: 'pp_here' }, at: 2.8, u, size: 24, verdict: { ok: AP.judge('im_pass', { f: 'pp_here' }, C).ok, at: 3.4 } });
        fade(g, ramp(u, 3.8, 0.4), () => tag(g, '여권을 건네며 → Here you are.', LX, 330, COL.rel));
      });
      if (sel != null) {
        const [qid, , ok] = AP.IMMIG[sel], a = S.imAns || ok, j = AP.judge(qid, a, C);
        talk(g, { side: 'L', x: LX, y: 150, w: 760, text: AP.Q[qid].en, marks: Qm(qid), kind: 'officer', sp: 'us', all: true, u, size: 24 });
        answer(g, { x: LX, y: 230, w: 760, A: a, all: true, u, size: 24, verdict: { ok: j.ok, at: -1 } });
        const why = `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
        const R = richLay(g, why, [], 17, 740, { weight: 600 });
        richDraw(g, R, LX, 330, { color: j.ok ? COL.good : COL.trap });
        return;
      }
      if (active >= 0) {
        const i = active, [qid, trap, ok] = AP.IMMIG[i], [tq, tt, tok] = TT[i], next = TT[i + 1] ? TT[i + 1][0] - 0.3 : 99;
        fade(g, 1 - ramp(u, next - 0.3, 0.3), () => {
          talk(g, { side: 'L', x: LX, y: 150, w: 760, text: AP.Q[qid].en, marks: Qm(qid), kind: 'officer', sp: 'us', at: tq, u, roleAt: tq + 0.6, size: 24 });
          if (trap) {
            answer(g, { x: LX, y: 226, w: 760, A: trap, B: ok, p: (u - tok) / 0.8, at: tt, u, size: 24, trapAt: tt + 0.9, strikeAt: tt + 1.0, verdict: u >= tok + 0.8 ? { ok: true, at: tok + 0.8 } : null,
              tag: [i === 1 ? '‘동안’ → during 아니에요 · for + 기간' : '한국어엔 없는 a가 빠졌어요', COL.trap, tt + 1.3, tok], tagY: 226 + 82 });
          } else answer(g, { x: LX, y: 226, w: 760, A: ok, at: tok, u, size: 24, verdict: { ok: true, at: tok + 0.7 } });
          // 카드 → 대답 점선
          if (u >= tok && u < next) fade(g, ramp(u, tok, 0.3), () => { g.strokeStyle = 'rgba(127,224,168,0.6)'; g.lineWidth = 2; g.setLineDash([5, 6]); g.beginPath(); g.moveTo(866, 150 + 58 + (rowOf[qid] - 1) * 38 + 19 + 38); g.lineTo(848, 256); g.stroke(); g.setLineDash([]); });
        });
      }
      // 기록
      fade(g, ramp(u, 8.8, 0.4), () => label(g, '대답 기록 → 열쇠 낱말 · 대답', LX, 344, { size: 15 }));
      AP.IMMIG.forEach(([qid, , ok], i) => fade(g, ramp(u, TT[i][3], 0.5), () => {
        const y = 378 + i * 34, q = AP.Q[qid];
        const kw = q.key.join(' … ');
        const w1 = txt(g, kw, LX + 10, y, { size: 17, weight: 700, color: COL.ante });
        txt(g, '→', LX + 22 + Math.max(w1, 150), y, { size: 17, weight: 700, color: COL.muted });
        pieces(g, ansParts(ok), LX + 52 + Math.max(w1, 150), y, 18);
        say(LX, y - 15, 760, 30, AP.text(ok));
      }));
    },

    /* 07 수하물: 벨트 번호 → 가방이 안 나옴 → 가방 묘사(크기 → 색 → 물건 + with) */
    baggage(g, u) {
      const outA = 1 - ramp(u, 17.0, 0.4);
      if (S.bag == null) fade(g, outA, () => {
        panel(g, LX, 150, 560, 186, { fill: '#0B0F14', stroke: COL.faint });
        txt(g, 'BAGGAGE CLAIM  수하물', LX + 22, 178, { size: 18, weight: 700, fam: FM, color: COL.accent });
        ['FLIGHT', 'FROM', 'CAROUSEL'].forEach((h, i) => txt(g, h, LX + 22 + i * 170, 212, { size: 14, weight: 500, fam: FM, color: COL.muted }));
        [['207', 'SEOUL', '4', true], ['118', 'TOKYO', '2'], ['365', 'SYDNEY', '6']].forEach((r, k) => {
          const y = 246 + k * 32;
          if (r[3] && u >= 2.0) { rr(g, LX + 10, y - 15, 536, 30, 6); g.fillStyle = 'rgba(255,193,94,0.12)'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 1.5; g.stroke(); }
          r.slice(0, 3).forEach((c, i) => txt(g, c, LX + 22 + i * 170, y, { size: 19, weight: 600, fam: FM, color: r[3] && u >= 2.0 ? COL.accent : '#E8C66A' }));
        });
        carousel(g, 680, 172, 520, 150, u);
        chip(g, '4', 940, 160, { size: 22, weight: 800, fam: FM, color: '#1D1305', fill: COL.accent, h: 40, r: 10 });
        const [lit, ok] = AP.SCENE.lost;
        answer(g, { x: LX, y: 380, w: 1120, A: ok, at: 6.6, u, size: 24, verdict: { ok: true, at: 7.6 } });
        answer(g, { x: LX, y: 460, w: 1120, A: lit, at: 12.2, u, size: 24, trapAt: 13.2, strikeAt: 13.3, tag: ['‘안 나왔어요’ 그대로 옮긴 틀린 말', COL.trap, 13.6], tagX: LX + 40, tagY: 460 + 27 });
        fade(g, ramp(u, 14.6, 0.4), () => tag(g, '지난 일 → didn\'t + 동사원형 (come out)', LX + 40, 540, COL.rel));
      });
      // 가방 묘사
      const inC = S.bag != null ? 1 : ramp(u, 17.4, 0.5);
      if (inC > 0.001) fade(g, inC, () => {
        const b = S.bag || AP.SCENE.bag, auto = S.bag == null;
        talk(g, { side: 'L', x: LX, y: 150, w: 820, text: AP.Q.ba_desc.en, marks: Qm('ba_desc'), kind: 'desk', sp: 'ca', at: auto ? 17.8 : -9, u, roleAt: auto ? 18.6 : -9, size: 24, all: !auto });
        const f = AP.bagFacts(b), order = b.words.map(w => AP.ADJ[w].c);
        // 칸 넷
        const COLS = b.words.map((w, i) => [AP.CAT[order[i]].ko, w]).concat(b.with ? [['with 특징', 'with ' + AP.WITH[b.with].t]] : []);
        const cw = 190, x0 = LX;
        COLS.forEach(([h, w], i) => fade(g, auto ? ramp(u, 19.6 + i * 0.4, 0.4) : 1, () => {
          const x = x0 + i * (cw + 14), wrongC = !AP.bagOrder(b.words).ok && i < b.words.length, va = auto ? ramp(u, 23.8 + i * 0.7, 0.4) : 1;
          panel(g, x, 252, cw, 96, { fill: COL.panel, stroke: wrongC ? COL.trap : COL.faint });
          txt(g, h, x + cw / 2, 276, { size: 15, weight: 700, color: COL.muted, align: 'center' });
          if (va < 1) fade(g, 1 - va, () => { rr(g, x + 24, 302, cw - 48, 32, 8); g.setLineDash([6, 5]); g.strokeStyle = COL.gap; g.lineWidth = 2; g.stroke(); g.setLineDash([]); });
          fade(g, va, () => txt(g, w, x + cw / 2, 318, { size: fit(g, w, 24, cw - 16, 700), weight: 700, color: COL.clause, align: 'center' }));
          if (i < COLS.length - 1) arrow(g, x + cw + 1, 300, x + cw + 13, 300, COL.accent, 2);
        }));
        const a = { f: 'ds', bag: b }, j = AP.judge('ba_desc', a, auto ? AP.SCENE.bagCard : { bag: { size: f.size, color: f.color, thing: f.thing, with: f.with, material: f.material } });
        fade(g, auto ? ramp(u, 26.6, 0.4) : 1, () => {
          const L = lay(g, ansToks(a), { x: LX, y: 396, size: 26, maxW: 820 });
          drawLay(g, L); say(L.x, 372, L.w, 50, AP.text(a));
          const ord = AP.bagOrder(b.words);
          mark(g, ord.ok, L.x + L.w + 26, 396, 18);
          if (!auto) { const R = richLay(g, ord.why, [], 17, 820, { weight: 600 }); richDraw(g, R, LX, 444, { color: ord.ok ? COL.good : COL.trap }); }
          void j;
        });
        fade(g, auto ? ramp(u, 19.8, 0.5) : 1, () => { panel(g, 960, 230, 240, 240, { fill: COL.panel, stroke: COL.faint }); if (!auto || u >= 24.0) fade(g, auto ? ramp(u, 24.0, 0.5) : 1, () => suitcase(g, 1080, 440, f, { s: 1 })); else txt(g, '?', 1080, 350, { size: 64, weight: 800, fam: FD, color: COL.dim, align: 'center' }); });
        if (auto) fade(g, ramp(u, 29.2, 0.4), () => {
          const L = lay(g, ansToks({ f: 'ds', bag: AP.SCENE.bagWrong }), { x: LX, y: 500, size: 22, maxW: 820 });
          drawLay(g, L, it => (it.t === 'black' || it.t === 'large') ? { r: 'trap' } : {});
          g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(L.x - 4, 501); g.lineTo(L.x + L.w + 4, 501); g.stroke();
          tag(g, '색이 크기보다 앞 → 어색해요', L.x + L.w + 24, 500, COL.trap, { size: 15, h: 32 });
          txt(g, '한국어는 ‘검은 큰 가방’도 괜찮아요. 영어는 크기 → 색 → 재료 → 물건', LX, 548, { size: 17, weight: 600, color: COL.soft });
        });
      });
    },

    /* 08 세관 · 못 알아들었을 때 */
    customs(g, u) {
      const outA = 1 - ramp(u, 11.8, 0.4);
      fade(g, outA, () => {
        talk(g, { side: 'L', x: LX, y: 150, w: 760, text: AP.Q.cu_any.en, marks: Qm('cu_any'), kind: 'officer', sp: 'au', at: 0.8, u, roleAt: 2.0, size: 26 });
        fade(g, ramp(u, 3.2, 0.4), () => tag(g, 'declare → (세관에) 신고하다', 640, 182, COL.ante, { size: 17 }));
        const [no, yes] = AP.SCENE.customs;
        fade(g, ramp(u, 6.0, 0.4), () => { txt(g, '없으면', LX, 270, { size: 17, weight: 700, color: COL.muted }); txt(g, '있으면', 660, 270, { size: 17, weight: 700, color: COL.muted }); });
        answer(g, { x: LX, y: 296, w: 540, A: no, at: 6.4, u, size: 22, verdict: { ok: true, at: 7.2 } });
        answer(g, { x: 660, y: 296, w: 540, A: yes, at: 8.4, u, size: 22, verdict: { ok: true, at: 9.2 } });
        fade(g, ramp(u, 9.8, 0.4), () => tag(g, '있는 그대로 말해요', LX, 400, COL.clause));
      });
      // 빠른 말 → 그냥 Yes (위험) → 다시 묻기
      const inB = win(u, 12.0, 29.0);
      if (inB > 0.001) fade(g, inB, () => {
        const fq = AP.Q.cu_fast.en;
        talk(g, { side: 'L', x: LX, y: 150, w: 1120, text: fq, kind: 'officer', sp: 'au', at: 12.2, u, size: 24, fast: true });
        fade(g, ramp(u, 12.6, 0.4), () => tag(g, '너무 빨라요!', 1200, 132, COL.trap, { align: 'right', size: 15, h: 30 }));
        fade(g, 1 - ramp(u, 18.2, 0.3), () => {
          answer(g, { x: LX, y: 236, w: 1120, A: { f: 'g_yes' }, at: 13.8, u, size: 26, trapAt: 15.0, strikeAt: 15.1, tag: ['무엇에 Yes? 그냥 Yes는 위험해요', COL.trap, 15.4], tagX: LX + 40, tagY: 236 + 30 });
        });
        const [s1, s2, s3] = AP.SCENE.repair;
        answer(g, { x: LX, y: 236, w: 1120, A: s1, B: s2, p: (u - 20.2) / 0.8, at: 18.6, u, size: 26, verdict: u >= 21.0 ? { ok: true, at: 21.0 } : null });
        talk(g, { side: 'L', x: LX, y: 322, w: 1120, text: fq, kind: 'officer', sp: 'au', at: 21.8, u, size: 22, fast: true });
        answer(g, { x: LX, y: 404, w: 1120, A: s3, at: 24.4, u, size: 26, verdict: { ok: true, at: 25.4 } });
        talk(g, { side: 'L', x: LX, y: 490, w: 1120, text: 'Are you carrying any fruit, meat, or plants?', marks: [['fruit, meat, or plants', 'key']], kind: 'officer', sp: 'au', at: 26.2, u, roleAt: 27.2, size: 22, slow: true });
      });
      // 구조 요청 세 줄
      fade(g, ramp(u, 29.2, 0.5), () => {
        txt(g, '구조 요청 세 줄', LX, 168, { size: 22, weight: 800, fam: FD, color: COL.verb });
        AP.SCENE.repair.forEach((a, i) => {
          const y = 230 + i * 76;
          panel(g, LX, y - 30, 900, 60, { fill: COL.panel, stroke: COL.faint, r: 12 });
          txt(g, String(i + 1), LX + 26, y, { size: 22, weight: 700, fam: FM, color: COL.muted });
          pieces(g, ansParts(a), LX + 64, y, 26);
          say(LX, y - 30, 900, 60, AP.text(a));
        });
        txt(g, '공항 일곱 곳 어디서나', LX, 470, { size: 18, weight: 700, color: COL.soft });
        AP.PLACES.forEach((p, i) => { circ(g, LX + 230 + i * 62, 470, 22, COL.panel2); icon(g, p.id, LX + 230 + i * 62, 470, 22, COL.soft); });
      });
    },

    /* 09 3단계 말하기 법: 상자 셋 + 곳마다 한 줄이 단계별로 채워짐 */
    method(g, u) {
      const BOX = [['①', '열쇠 낱말 잡기', '목적 · 기간 · 장소 · 고르기 · 확인 · 지시', COL.ante, 5.5], ['②', '틀에 내 정보 넣기', 'For + 기간 · At + 장소 · I\'m here + 목적', COL.rel, 11.5], ['③', '공손하게 끝내기', 'please · thank you · Could I …? · Sorry?', COL.verb, 17.5]];
      const sel = S.place;
      BOX.forEach(([n, t1, t2, c, at], k) => {
        const on = sel != null || u >= at, x0 = LX + k * 385;
        fade(g, ramp(u, 0.6 + k * 0.3, 0.5), () => {
          panel(g, x0, 146, 365, 114, { fill: on ? COL.panel2 : COL.panel, stroke: on ? c : COL.faint, lw: on ? 2.2 : 1.5 });
          txt(g, n, x0 + 20, 180, { size: 26, weight: 700, color: c });
          txt(g, t1, x0 + 62, 180, { size: 22, weight: 800, fam: FD });
          txt(g, t2, x0 + 20, 228, { size: fit(g, t2, 16, 330, 600), weight: 600, color: on ? COL.en : COL.dim });
          if (k < 2) arrow(g, x0 + 367, 203, x0 + 383, 203, COL.accent, 2.5);
        });
      });
      AP.METHOD.forEach(([qid, a], i) => {
        const y = 300 + i * 39, q = AP.Q[qid], p = AP.PLACE[q.place], dim = sel != null && sel !== i;
        fade(g, ramp(u, 1.4 + i * 0.3, 0.4) * (dim ? 0.35 : 1), () => {
          if (sel === i) { rr(g, LX - 6, y - 18, 1132, 36, 8); g.fillStyle = 'rgba(255,193,94,0.10)'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 1.5; g.stroke(); }
          circ(g, LX + 14, y, 15, COL.panel2); icon(g, p.id, LX + 14, y, 18, COL.soft);
          const keysOn = sel != null || u >= 6.0 + i * 0.3, ansOn = sel != null || u >= 12.0 + i * 0.4, polOn = sel != null || u >= 18.0;
          const R = richLay(g, q.short || q.en, keysOn ? Qm(qid) : [], 17, 520, { weight: 500 });
          richDraw(g, R, LX + 44, y, { color: COL.soft });
          say(LX + 40, y - 16, R.w + 8, 32, q.en);
          if (ansOn) fade(g, sel != null ? 1 : ramp(u, 12.0 + i * 0.4, 0.4), () => {
            txt(g, '→', 640, y, { size: 18, weight: 700, color: COL.muted });
            pieces(g, ansParts(a).map(([t, r]) => [t, r === 'pol' && !polOn ? 'frame' : r]), 676, y, 18, 520);
            say(670, y - 16, 530, 32, AP.text(a));
          });
        });
      });
    },

    /* 10 실전: 카드 하나로 입국 심사 셋 + 수하물 하나 */
    practice(g, u) {
      const pi = u < PSEG[1] ? 0 : u < PSEG[2] ? 1 : u < PSEG[3] ? 2 : 3, v = u - PSEG[pi];
      const P = AP.PRACTICE[pi], q = AP.Q[P.q], C = AP.PCARD;
      const a = ramp(v, 0, 0.5) * (pi < 3 ? 1 - ramp(u, PSEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `대화 ${pi + 1} / 4 · ${AP.PLACE[q.place].ko}`, LX, 150, { size: 16, weight: 500, fam: FM, color: COL.accent });
        if (pi < 3) travelCard(g, LX, 172, 330, C, { rh: 34, skip: [5, 6], hl: { im_purpose: 1, im_length: 2, im_stay: 3 }[P.q] });
        else {
          panel(g, LX, 172, 330, 264, { fill: COL.panel, stroke: COL.faint });
          txt(g, '잃어버린 가방', LX + 20, 198, { size: 17, weight: 700, color: COL.muted });
          suitcase(g, LX + 165, 392, C.bag, { s: 1 });
          txt(g, AP.bagKo({ words: [C.bag.size, C.bag.color, C.bag.thing], with: C.bag.with }), LX + 165, 420, { size: 16, weight: 600, color: COL.soft, align: 'center' });
        }
        talk(g, { side: 'L', x: 432, y: 172, w: 768, text: q.en, marks: Qm(P.q), kind: pi < 3 ? 'officer' : 'desk', sp: q.sp, at: PT.q, u: v, roleAt: PT.lines[0] + 0.4, size: 22 });
        const J = P.opts.map(o => AP.judge(q, o, C));
        const goneAt = k => { const s = J[k].stage; if (!s) return null; const same = P.opts.map((_, i) => i).filter(i => J[i].stage === s); return (s === 1 ? PT.s1 : PT.s2) + same.indexOf(k) * 1.1; };
        P.opts.forEach((o, k) => {
          const y = 262 + k * 60, gA = goneAt(k), won = k === P.a && v >= PT.win;
          fade(g, ramp(v, PT.opt[k], 0.4), () => {
            if (won) { rr(g, 432, y - 24, 768, 48, 10); g.fillStyle = 'rgba(127,224,168,0.08)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
            txt(g, `(${'ABC'[k]})`, 446, y, { size: 18, weight: 500, fam: FM, color: gA != null && v >= gA ? COL.dim : COL.muted });
            const gone = gA != null && v >= gA;
            const parts = ansParts(o).map(([t, r]) => [t, gone ? 'dim' : (v >= PT.lines[1] + 0.4 || won) ? r : '']);
            const w = pieces(g, parts, 494, y, 21, 600, { color: gone ? COL.dim : COL.text });
            say(490, y - 18, w + 10, 36, AP.text(o));
            if (gone) { const p = clamp((v - gA) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(440, y + 1); g.lineTo(440 + (w + 64) * p, y + 1); g.stroke();
              fade(g, ramp(v, gA + 0.3, 0.3), () => tag(g, `${['', '①', '②', '③'][J[k].stage]} 탈락`, 1180, y, COL.trap, { align: 'right', size: 15, h: 30 })); }
            if (won) mark(g, true, 1170, y, 17);
          });
        });
        panel(g, LX, 446, 1120, 128, { fill: COL.panel, stroke: COL.faint });
        const heads = ['① 열쇠 낱말', '② 틀 + 내 정보', '③ 공손 · 정답'];
        P.lines.forEach((ln, k) => fade(g, ramp(v, PT.lines[k] + 0.3, 0.5), () => {
          const y = 472 + k * 38;
          txt(g, heads[k], LX + 22, y, { size: 17, weight: 700, color: [COL.ante, COL.rel, COL.verb][k] });
          const t = ln;
          txt(g, t, LX + 178, y, { size: fit(g, t, 18, 920, 600), weight: 600, color: k === 2 && v >= PT.win ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 330, 700], Y0 = 146, RH = 46;
      const rows = [
        ['checkin', '체크인', 'Window or aisle? · checking any bags', [['___', 'slot'], [', ', ''], ['please', 'pol'], ['. · Yes, just one.', 'frame']]],
        ['security', '보안 검색', 'take … out · Step forward (지시)', [['Okay.', 'frame'], [' + 그대로 하기', '']]],
        ['gate', '탑승구', 'Gate 50 · now boarding (숫자)', [['Gate ', 'frame'], ['50', 'slot'], ['? ', 'frame'], ['Thank you', 'pol'], ['.', 'frame']]],
        ['plane', '기내', 'Chicken or beef? · Can I help you?', [['Could I', 'pol'], [' have ', 'frame'], ['___', 'slot'], [', ', ''], ['please', 'pol'], ['?', 'frame']]],
        ['immig', '입국 심사', 'purpose · How long · Where … staying', [['I\'m here ', 'frame'], ['for …', 'slot'], [' · For ', 'frame'], ['기간', 'slot'], [' · At ', 'frame'], ['장소', 'slot']]],
        ['baggage', '수하물', 'Which flight · describe', [['a ', 'frame'], ['크기 색 물건', 'slot'], [' with ', 'frame'], ['특징', 'slot']]],
        ['customs', '세관', 'declare', [['No, nothing to declare.', 'frame']]],
        [null, '못 알아들었을 때', '(빠른 말 · 처음 듣는 말)', [['Sorry? Could you', 'pol'], [' say that again, ', 'frame'], ['please', 'pol'], ['?', 'frame']]],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 10, { fill: COL.panel, stroke: COL.faint });
        ['곳', '열쇠 낱말', '대답 틀'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 18, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 4, 1120, 1);
      });
      rows.forEach(([pid, nm, keys, ans], ri) => fade(g, ramp(u, 1.0 + ri * 0.45, 0.5), () => {
        const y = Y0 + RH * (ri + 1) + 18;
        if (pid) { circ(g, X[0] + 32, y, 15, COL.panel2); icon(g, pid, X[0] + 32, y, 18, COL.soft); }
        else { circ(g, X[0] + 32, y, 15, COL.panel2); txt(g, '?', X[0] + 32, y + 1, { size: 18, weight: 800, color: COL.verb, align: 'center' }); }
        txt(g, nm, X[0] + 58, y, { size: fit(g, nm, 18, X[1] - X[0] - 70, 700), weight: 700 });
        txt(g, keys, X[1] + 20, y, { size: fit(g, keys, 17, X[2] - X[1] - 34, 600), weight: 600, color: COL.ante });
        pieces(g, ans, X[2] + 20, y, 18, 1196 - X[2] - 30);
      }));
    },
  };

  // 03장 동작 그림
  function actIcon(g, id, x, y) {
    g.save(); g.translate(x, y); g.strokeStyle = COL.soft; g.fillStyle = COL.soft; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
    if (id === 'laptop') {
      rr(g, -50, 10, 100, 34, 6); g.strokeStyle = COL.muted; g.stroke();                       // 가방
      g.strokeStyle = COL.ante; rr(g, -34, -40, 68, 40, 4); g.stroke(); g.beginPath(); g.moveTo(-44, 2); g.lineTo(44, 2); g.stroke();   // 노트북
      arrow(g, 62, 20, 62, -34, COL.accent, 3);
    } else if (id === 'belt') {
      g.strokeStyle = '#B48C64'; g.lineWidth = 12; g.beginPath(); g.moveTo(-60, 0); g.lineTo(60, 0); g.stroke();
      g.strokeStyle = '#E2C489'; g.lineWidth = 4; rr(g, -14, -14, 28, 28, 4); g.stroke(); g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 12); g.stroke();
      arrow(g, 30, -30, 64, -30, COL.accent, 3);
    } else if (id === 'step') {
      const foot = (fx, fy) => { g.beginPath(); g.ellipse(fx, fy, 9, 16, 0, 0, Math.PI * 2); g.fillStyle = COL.ante; g.fill(); };
      foot(-26, 22); foot(-6, -2); foot(14, 18); foot(34, -6);
      arrow(g, -50, -30, 50, -30, COL.accent, 3);
    } else if (id === 'liquid') {
      g.setLineDash([5, 4]); g.strokeStyle = COL.muted; rr(g, -50, -34, 100, 74, 8); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(110,200,255,0.4)'; rr(g, -30, -18, 22, 46, 5); g.fill(); g.strokeStyle = COL.ante; g.stroke();
      g.fillStyle = 'rgba(201,167,255,0.4)'; rr(g, 4, -6, 24, 34, 5); g.fill(); g.strokeStyle = COL.verb; g.stroke();
    }
    g.restore();
  }
  APS.actIcon = actIcon;

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

  APS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[APS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    if (ch.place != null) strip(g, ch.place, ramp(u, 0.2, 0.5));
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, APS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + AP.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔✓×?!~=+-/:…‘’\'%';
  APS.baseText = EXTRA;
  APS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = APS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { APS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
