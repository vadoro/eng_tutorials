/* 호텔 회화 — 영상 장면
 *
 * HTS.render(g, t)는 시각 t와 사용자 상태 HTS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준, 내용은 y 580 위.
 *
 * 그림 말: 호텔 단면도(일곱 곳, 01장은 크게 · 02–07장은 위쪽 작은 띠), 말풍선(직원 왼쪽 · 나 오른쪽),
 * 대답은 틀(노랑) + 내 정보(민트) 낱말 조각으로 만들고(lay · morph), 함정은 줄을 긋고 주황 이름표로 까닭을 붙여요.
 * 카드 키 봉투 · 청구서 · 객실 전화 · 에어컨 · 짐표 · 시계는 도형으로 그려요. 값과 번호는 모두 grammar.js(HT.bill · HT.roomWords)로 계산해요.
 * 역할 색: 열쇠 낱말 하늘 · 대답 틀 노랑 · 내 정보(칸에 넣는 말) 민트 · 공손한 말 보라 · 함정 주황 · 빈칸 분홍 점선
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(HT.judge · HT.callLine · HT.fix)으로 정합니다.
 * MP4에는 소리가 없어서, 말은 말풍선 속 낱말이 하나씩 나타나는 모습으로 그려요. 페이지에서는 말풍선을 누르면 그 사람 목소리로 들려줘요.
 */
(function () {
  'use strict';
  const HT = window.HT;
  const HTS = (window.HTS = {});
  const W = 1280, H = 720;
  HTS.W = W; HTS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  HTS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', paper: '#F4F1E8', ink: '#1E2630', navy: '#22324A', wood: '#3A2E25', red: '#B8432B',
  };
  HTS.COL = COL;
  // 역할 → 색 (낱말 조각 · 말풍선 글)
  const RC = { key: COL.ante, frame: COL.rel, slot: COL.clause, pol: COL.verb, trap: COL.trap, ok: COL.good, dim: COL.dim, bad: COL.bad };
  HTS.RC = RC;
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8', me: '#F2C29A' };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (HTS.S = { stop: null, call: null, nights: null, prob: null, cg: null, room: null, line: null, place: null, bill: null });
  HTS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  HTS.hits = () => HITS;

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
     [길, 'f'(채움) | 's'(선)]
     ========================================================= */
  const ICON = {
    checkin: [['M4 17.5h16M2.5 20.5h19', 's'], ['M5.5 17.5a6.5 6.5 0 0 1 13 0', 's'], ['M12 11V8.8M10.2 8.8h3.6', 's']],
    key: [['M3.5 6.5h17v11h-17z', 's'], ['M6.5 9.5h3.5v3h-3.5z', 's'], ['M14 10a2.6 2.6 0 0 1 0 4M16.5 8.5a5 5 0 0 1 0 7', 's']],
    call: [['M7.2 3.5h2.4l1.5 4.2-2.1 1.3a11 11 0 0 0 6 6l1.3-2.1 4.2 1.5v2.4a2 2 0 0 1-2 2A16.5 16.5 0 0 1 5.2 5.5a2 2 0 0 1 2-2z', 's']],
    problem: [['M12 3.5 21.5 20h-19z', 's'], ['M12 9.5v5', 's'], ['M12 17.2h.01', 's']],
    breakfast: [['M5 9.5h11v4.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14z', 's'], ['M16 11h1.6a2.2 2.2 0 0 1 0 4.4H15.6', 's'], ['M3 21h16', 's'], ['M8.5 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3', 's']],
    concierge: [['M4 8h16v11.5H4z', 's'], ['M9 8V5.5h6V8', 's'], ['M8 8v11.5M16 8v11.5', 's']],
    checkout: [['M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z', 's'], ['M9 8h6M9 11.5h6M9 15h3.5', 's']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z', 's'], ['M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6', 's']],
    ac: [['M3 5.5h18v7H3z', 's'], ['M6 9.5h12', 's'], ['M7 15.5c0 1 1 1.6 1 2.8M12 15.5c0 1 1 1.6 1 2.8M17 15.5c0 1 1 1.6 1 2.8', 's']],
    shower: [['M6 21V7.5a3.5 3.5 0 0 1 7 0', 's'], ['M10 7.5h6l-1 2.5h-4z', 's'], ['M11.5 13v1.2M14 13v1.2M12.7 16v1.2M15.2 16v1.2', 's']],
    noise: [['M4 9.5v5h3l4 4v-13l-4 4z', 's'], ['M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11', 's']],
    lock: [['M6 10.5h12v10H6z', 's'], ['M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3', 's'], ['M12 14.5v2.5', 's']],
    clock: [['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0z', 's'], ['M12 7.5V12l3 2', 's']],
    moon: [['M15.5 4a7.5 7.5 0 1 0 4.5 13.5A6 6 0 0 1 15.5 4z', 's']],
    sun: [['M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0z', 's'], ['M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4', 's']],
    taxi: [['M4 16.5V12l2-4.5h12l2 4.5v4.5z', 's'], ['M4 12h16', 's'], ['M7 19.5v-3M17 19.5v-3', 's'], ['M10 5h4', 's']],
    towel: [['M6 4h12v16H6z', 's'], ['M6 8h12M6 16h12', 's']],
    tv: [['M3.5 5.5h17v11h-17z', 's'], ['M9 20.5h6M12 16.5v4', 's']],
    wifi: [['M3 9.5a13 13 0 0 1 18 0M6 13a8.5 8.5 0 0 1 12 0M9 16.4a4 4 0 0 1 6 0', 's'], ['M12 19.5h.01', 's']],
    plug: [['M8 3v5M16 3v5', 's'], ['M6 8h12v3a6 6 0 0 1-12 0z', 's'], ['M12 17v4', 's']],
  };
  HTS.ICON = ICON;
  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = (typeof Path2D === 'function' ? new Path2D(d) : null));
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const parts = ICON[id]; if (!parts) return;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach(([d, m]) => { const p = path(d); if (!p) return; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  HTS.icon = icon;
  // HTML용 SVG (색은 currentColor)
  HTS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;
  const PROB_ICON = { ac: 'ac', tv: 'tv', wifi: 'wifi', outlet: 'plug', remote: 'tv', keycard: 'key', locked: 'lock', nohot: 'shower', notp: 'towel', notowel: 'towel', noisy: 'noise', cold: 'ac' };
  HTS.PROB_ICON = PROB_ICON;

  /* ---------- 사람 얼굴 (말풍선 옆). kind: desk(프런트) · phone(전화) · host(조식) · concierge · me ---------- */
  const LOOK = {
    desk: { shirt: '#26324A', hair: '#2E241E', skin: '#E3B48D', tie: '#B8432B', collar: true },
    phone: { shirt: '#3B4350', hair: '#5A3A28', skin: '#C99169', headset: true },
    host: { shirt: '#2F3B36', apron: '#7FA88E', hair: '#1F1B18', skin: '#E8BC95', bun: true },
    concierge: { shirt: '#3A2E4A', hair: '#2B2420', skin: '#D9A57C', cap: '#2B2F36', band: '#C9A24A', tie: '#C9A24A', collar: true },
    me: { shirt: '#5D6FA8', hair: '#1F1B18', skin: '#E8BC95', pack: '#3A2C22' },
  };
  const KIND = { checkin: 'desk', key: 'desk', checkout: 'desk', call: 'phone', problem: 'phone', breakfast: 'host', concierge: 'concierge' };
  const kindOf = q => KIND[(typeof q === 'string' ? HT.Q[q] : q).place] || 'desk';
  HTS.kindOf = kindOf;
  function avatar(g, x, y, r, kind, o = {}) {
    const L = LOOK[kind] || LOOK.desk;
    circ(g, x, y, r, COL.panel2);
    g.save(); g.beginPath(); g.arc(x, y, r - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = L.shirt; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
    if (L.collar) { g.fillStyle = '#EEF1F4'; g.beginPath(); g.moveTo(x - r * 0.2, y + r * 0.42); g.lineTo(x, y + r * 0.62); g.lineTo(x + r * 0.2, y + r * 0.42); g.closePath(); g.fill(); }
    if (L.tie) { g.fillStyle = L.tie; g.beginPath(); g.moveTo(x - r * 0.06, y + r * 0.5); g.lineTo(x + r * 0.06, y + r * 0.5); g.lineTo(x + r * 0.09, y + r * 0.9); g.lineTo(x, y + r * 1.0); g.lineTo(x - r * 0.09, y + r * 0.9); g.closePath(); g.fill(); }
    if (L.apron) { g.fillStyle = L.apron; rr(g, x - r * 0.34, y + r * 0.5, r * 0.68, r * 0.7, r * 0.08); g.fill(); }
    if (L.pack) { g.strokeStyle = L.pack; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - r * 0.42, y + r * 0.45); g.lineTo(x - r * 0.5, y + r); g.moveTo(x + r * 0.42, y + r * 0.45); g.lineTo(x + r * 0.5, y + r); g.stroke(); }
    g.fillStyle = L.skin; g.fillRect(x - r * 0.1, y + r * 0.18, r * 0.2, r * 0.22);
    circ(g, x, y - r * 0.08, r * 0.34, L.skin);
    g.fillStyle = L.hair; g.beginPath(); g.arc(x, y - r * 0.12, r * 0.36, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
    if (L.bun) circ(g, x, y - r * 0.5, r * 0.13, L.hair);
    if (L.cap) { g.fillStyle = L.cap; g.beginPath(); g.arc(x, y - r * 0.18, r * 0.37, Math.PI, 0); g.closePath(); g.fill(); g.fillStyle = L.band; g.fillRect(x - r * 0.37, y - r * 0.24, r * 0.74, r * 0.07); }
    circ(g, x - r * 0.12, y - r * 0.04, r * 0.035, '#2B2420'); circ(g, x + r * 0.12, y - r * 0.04, r * 0.035, '#2B2420');
    g.strokeStyle = 'rgba(120,60,40,0.6)'; g.lineWidth = Math.max(1, r * 0.045); g.beginPath(); g.arc(x, y + r * 0.06, r * 0.1, 0.35, Math.PI - 0.35); g.stroke();
    if (L.headset) {
      g.strokeStyle = '#1C232C'; g.lineWidth = r * 0.07; g.beginPath(); g.arc(x, y - r * 0.08, r * 0.42, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      circ(g, x - r * 0.38, y - r * 0.02, r * 0.09, '#1C232C'); g.beginPath(); g.moveTo(x - r * 0.36, y + r * 0.04); g.quadraticCurveTo(x - r * 0.3, y + r * 0.22, x - r * 0.08, y + r * 0.2); g.stroke();
    }
    g.restore();
    ring(g, x, y, r, o.live ? (SPC[o.sp] || COL.soft) : COL.faint, o.live ? 2.6 : 1.5);
    if (o.live) { g.save(); g.globalAlpha *= 0.45; ring(g, x, y, r + 5, SPC[o.sp] || COL.soft, 2); g.restore(); }
  }
  HTS.avatar = avatar;

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
  HTS.richLay = richLay; HTS.richDraw = richDraw;

  /* ---------- 낱말 조각 (대답 만들기): { id, t, r } → lay · morph · drawTok ---------- */
  const PUNCT = /^[.,?!]$/;
  function ansToks(a, o = {}) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    HT.segs(a).forEach(s => s.t.split(/\s+/).forEach(w => {
      if (!w) return;
      const m = w.match(/^(.*?)([.,?!]*)$/);
      if (m[1]) push(m[1], o.role != null ? o.role : s.r);
      if (m[2]) m[2].split('').forEach(p => push(p, ''));
    }));
    return out;
  }
  HTS.ansToks = ansToks;
  const strToks = (s, r) => { const out = [], seen = {}; String(s).split(/\s+/).forEach(w => { const m = w.match(/^(.*?)([.,?!]*)$/); const push = (t, rr2) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r: rr2 }); }; if (m[1]) push(m[1], r); if (m[2]) m[2].split('').forEach(p => push(p, '')); }); return out; };
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
    const ax = side === 'L' ? o.x + ar : o.x + o.w - ar, ay = o.y + bh / 2;
    const bx = side === 'L' ? ax + ar + 16 : ax - ar - 16 - bw, by = o.y;
    const a = o.all ? 1 : ramp(u, at - 0.35, 0.3);
    const out = { bx, by, bw, bh, ex: bx + bw, R };
    if (a <= 0.001) return out;
    const per = WD * (o.slow ? 1.9 : o.fast ? 0.45 : 1), dur = nWords(o.text) * per, live = u >= at && u < at + dur + 0.15;
    fade(g, a, () => {
      avatar(g, ax, ay, ar, o.kind || (side === 'L' ? 'desk' : 'me'), { live, sp: o.sp });
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
  HTS.talk = talk;
  // 직원의 말 (질문 id로): 말풍선 + 열쇠 낱말
  const Qobj = q => typeof q === 'string' ? HT.Q[q] : q;
  const Qm = q => Qobj(q).key.map(k => [k, 'key']);
  const staff = (g, q, o) => { q = Qobj(q); return talk(g, Object.assign({ side: 'L', text: q.en, marks: q.fast ? [] : Qm(q), kind: kindOf(q), sp: q.sp, fast: !!q.fast }, o)); };
  /* 나의 대답 (낱말 조각 말풍선, 두 대답 사이를 morph)
   * o: { x, y, w, A, B, p, at, u, size, strikeAt, verdict, tag: [글, 색, at, 사라짐], trapAt, toksA, tagX, tagY }
   */
  function answer(g, o) {
    const size = o.size || 24, ar = 25, at = o.at == null ? -99 : o.at, u = o.u;
    const TA = o.toksA || ansToks(o.A, { role: o.trapAt != null && u >= o.trapAt ? 'trap' : undefined });
    const TB = o.toksB || (o.B ? ansToks(o.B) : null);
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
      if (LB && p > 0) morph(g, LA, LB, p, {}); else drawLay(g, LA);
      g.restore();
      if (o.strikeAt != null && u >= o.strikeAt && p < 0.01) { const q = clamp((u - o.strikeAt) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.8; g.beginPath(); g.moveTo(bx + 12, by + bh / 2 + 1); g.lineTo(bx + 12 + (bw - 24) * q, by + bh / 2 + 1); g.stroke(); }
      if (o.verdict && u >= o.verdict.at) fade(g, ramp(u, o.verdict.at, 0.3), () => mark(g, o.verdict.ok, bx - 22, by + bh / 2, 17));
      if (o.tag && u >= o.tag[2]) fade(g, ramp(u, o.tag[2], 0.35) * (o.tag[3] != null ? 1 - ramp(u, o.tag[3], 0.3) : 1), () => tag(g, o.tag[0], o.tagX != null ? o.tagX : o.tagY != null ? bx + bw : bx - 48, o.tagY != null ? o.tagY : by + bh / 2, o.tag[1] || COL.trap, { align: o.tagX != null ? 'left' : 'right', size: 15, h: 32 }));
    });
    const said = LB && p > 0.5 ? (o.sayB || (o.B ? HT.text(o.B) : null)) : (o.sayA || (o.A ? HT.text(o.A) : null));
    if (!o.noHit && said) listen(bx, by, bw, bh, [{ text: said, sp: 'me' }]);
    return out;
  }
  HTS.answer = answer;
  const okOf = (q, a, c) => HT.judge(q, a, c || HT.DEMO).ok;

  /* ---------- 호텔 길 띠 (02–07장 위쪽) ---------- */
  function strip(g, cur, a = 1) {
    fade(g, a, () => {
      const x0 = 812, dx = 64, y = 92;
      g.strokeStyle = COL.faint; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 6, y); g.stroke();
      HT.PLACES.forEach((p, i) => {
        const x = x0 + i * dx, on = i === cur;
        circ(g, x, y, on ? 19 : 14, on ? COL.accent : i < cur ? '#2A3542' : COL.panel);
        ring(g, x, y, on ? 19 : 14, on ? COL.accent : COL.faint, 1.5);
        icon(g, p.id, x, y, on ? 22 : 16, on ? '#1D1305' : i < cur ? COL.soft : COL.muted, on ? 2 : 1.8);
      });
      txt(g, `${cur + 1} / 7`, x0 + dx * 6 + 30, y, { size: 13, weight: 500, fam: FM, color: COL.muted });
    });
  }

  /* =========================================================
     호텔 그림: 카드 키 봉투 · 청구서 · 숙박 카드 · 객실 전화 · 에어컨 · 짐 · 시계 · 밤 세기
     ========================================================= */
  // 카드 키 봉투 (x, y 왼쪽 위, 폭 w). o: { hl: { id: 색 }, card: 0→1 (카드 키가 나옴) } → 칸 위치 { id: { x, y, w, h } }
  function keySleeve(g, x, y, w, room, o = {}) {
    const s = w / 360, boxes = {}, hl = o.hl || {};
    g.save(); g.translate(x, y); g.scale(s, s);
    // 카드 키 (봉투 뒤에서 위로 나옴)
    const up = 10 + 22 * (o.card == null ? 1 : clamp(o.card));
    g.save(); g.translate(250, 20 - up); g.rotate(0.08);
    rr(g, -60, -40, 120, 76, 9); g.fillStyle = '#2B5FA8'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3; g.lineCap = 'round'; [12, 20, 28].forEach(r2 => { g.beginPath(); g.arc(-26, -6, r2, -0.7, 0.7); g.stroke(); });
    txt(g, 'W', 30, -14, { size: 18, weight: 800, fam: FD, color: '#FFFFFF', align: 'center' });
    g.restore();
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 16; g.shadowOffsetY = 6; rr(g, 0, 0, 360, 292, 12); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, 0, 0, 360, 292, 12); g.clip(); g.fillStyle = COL.navy; g.fillRect(0, 0, 360, 44); g.restore();
    txt(g, HT.HOTEL.toUpperCase(), 20, 23, { size: 15, weight: 700, fam: FM, color: '#F2E6C9' });
    txt(g, 'KEY CARD', 340, 23, { size: 11, weight: 700, fam: FM, color: '#BFD6CC', align: 'right' });
    const box = (id, bx, by2, bw, bh) => {
      const c = hl[id];
      if (c) { rr(g, bx, by2, bw, bh, 8); g.fillStyle = c + '30'; g.fill(); g.strokeStyle = c; g.lineWidth = 3; g.stroke(); }
      boxes[id] = { x: x + bx * s, y: y + by2 * s, w: bw * s, h: bh * s };
    };
    const F = HT.sleeve(room);
    box('room', 12, 52, 196, 86); box('floor', 216, 52, 132, 86);
    txt(g, 'ROOM', 24, 70, { size: 12, weight: 700, fam: FM, color: '#5B6168' });
    txt(g, String(room), 24, 110, { size: 44, weight: 700, fam: FM, color: COL.red });
    txt(g, 'FLOOR', 228, 70, { size: 12, weight: 700, fam: FM, color: '#5B6168' });
    txt(g, String(HT.floorOf(room)), 228, 110, { size: 36, weight: 700, fam: FM, color: COL.ink });
    g.fillStyle = 'rgba(30,38,48,0.25)'; g.fillRect(16, 146, 328, 1.5);
    F.slice(2).forEach((f, i) => {
      const yy = 176 + i * 38;
      box(f.id, 12, yy - 17, 336, 34);
      txt(g, f.label, 24, yy, { size: 12, weight: 700, fam: FM, color: '#5B6168' });
      txt(g, f.val, 124, yy, { size: fit(g, f.val, 16, 214, 600, 10, FM), weight: 600, fam: FM, color: COL.ink });
    });
    g.restore();
    return boxes;
  }
  HTS.keySleeve = keySleeve;

  // 청구서 (x, y 왼쪽 위, 폭 w). card → HT.bill. o: { shown: 보이는 줄 수, hl: { id: 색 }, mark: 줄 id } → { h, total, boxes }
  function billDraw(g, x, y, w, card, o = {}) {
    const B = HT.bill(card), n = B.items.length, h = 120 + n * 30 + 56, boxes = {};
    const shown = o.shown == null ? 99 : o.shown, hl = o.hl || {};
    g.save();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h);
    const zz = 14; for (let k = 0; k <= Math.round(w / zz); k++) g.lineTo(x + w - k * zz, y + h + (k % 2 ? 7 : 0));
    g.lineTo(x, y + h); g.closePath(); g.fillStyle = COL.paper; g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 16; g.shadowOffsetY = 6; g.fill(); g.restore();
    txt(g, HT.HOTEL.toUpperCase(), x + w / 2, y + 26, { size: fit(g, HT.HOTEL.toUpperCase(), 17, w - 30, 700, 10, FM), weight: 700, fam: FM, color: COL.ink, align: 'center' });
    const gl = `GUEST ${String(card.name || '').toUpperCase()}${card.first ? ' ' + String(card.first).toUpperCase() : ''} · ROOM ${card.room || ''}`;
    txt(g, gl, x + w / 2, y + 50, { size: fit(g, gl, 12, w - 30, 600, 9, FM), weight: 600, fam: FM, color: '#5B6168', align: 'center' });
    g.setLineDash([4, 4]); g.strokeStyle = 'rgba(30,38,48,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 16, y + 66); g.lineTo(x + w - 16, y + 66); g.stroke(); g.setLineDash([]);
    B.items.forEach((it, k) => fade(g, clamp(shown - k), () => {
      const yy = y + 90 + k * 30, c = hl[it.id];
      if (c) { rr(g, x + 10, yy - 14, w - 20, 28, 6); g.fillStyle = c + '30'; g.fill(); g.strokeStyle = c; g.lineWidth = 2.5; g.stroke(); }
      txt(g, it.en, x + 18, yy, { size: fit(g, it.en, 15, w - 130, 600, 9, FM), weight: 600, fam: FM, color: COL.ink });
      txt(g, HT.money(it.c), x + w - 18, yy, { size: 15, weight: 600, fam: FM, color: COL.ink, align: 'right' });
      boxes[it.id] = { x: x + 10, y: yy - 14, w: w - 20, h: 28 };
    }));
    fade(g, clamp(shown - n), () => {
      const yy = y + 90 + n * 30;
      g.fillStyle = 'rgba(30,38,48,0.5)'; g.fillRect(x + 16, yy - 8, w - 32, 1.5);
      txt(g, 'TOTAL', x + 18, yy + 16, { size: 18, weight: 700, fam: FM, color: COL.ink });
      txt(g, HT.money(B.total), x + w - 18, yy + 16, { size: 21, weight: 700, fam: FM, color: COL.red, align: 'right' });
      boxes.total = { x: x + 10, y: yy, w: w - 20, h: 32 };
    });
    return { h: h + 7, total: B.total, boxes };
  }
  HTS.billDraw = billDraw;

  // 숙박 카드 (시뮬레이터와 같은 칸). o: { skip: [줄 번호], hl: 줄 번호, rh }
  function stayCard(g, x, y, w, card, o = {}) {
    const all = HT.cardRows(card), rows = all.map((r, i) => [r, i]).filter(([, i]) => !o.skip || !o.skip.includes(i)), rh = o.rh || 34, h = 56 + rows.length * rh + 10;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 14); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 14); g.clip(); g.fillStyle = COL.navy; g.fillRect(x, y, w, 44); g.restore();
    icon(g, 'key', x + 24, y + 22, 22, '#FFFFFF');
    txt(g, o.title || '숙박 카드 · STAY CARD', x + 44, y + 23, { size: 16, weight: 700, color: '#FFFFFF' });
    rows.forEach(([[k, v], i], j) => {
      const yy = y + 56 + j * rh + rh / 2, hl = o.hl === i;
      if (hl) { rr(g, x + 8, yy - rh / 2 + 3, w - 16, rh - 6, 8); g.fillStyle = 'rgba(31,122,85,0.16)'; g.fill(); g.strokeStyle = '#1F7A55'; g.lineWidth = 2.5; g.stroke(); }
      txt(g, k, x + 18, yy, { size: fit(g, k, 14, 86, 600), weight: 600, color: '#5B6168' });
      txt(g, v, x + 108, yy, { size: fit(g, v, 16, w - 122, 700), weight: 700, color: hl ? '#14623F' : COL.ink });
    });
    return { h };
  }
  HTS.stayCard = stayCard;

  // 객실 전화 (x, y 왼쪽 위). o: { lift: 0→1, press: 0 | 5 | 7, s }
  function phoneDraw(g, x, y, o = {}) {
    const s = o.s || 1;
    g.save(); g.translate(x, y); g.scale(s, s);
    // 몸통
    g.beginPath(); g.moveTo(20, 120); g.lineTo(240, 120); g.lineTo(220, 250); g.lineTo(40, 250); g.closePath(); g.fillStyle = '#2A313A'; g.fill(); g.strokeStyle = '#3E4752'; g.lineWidth = 2; g.stroke();
    // 수화기 (들림)
    const lf = clamp(o.lift || 0), ly = 96 - lf * 22, rot = -0.22 * lf;
    g.save(); g.translate(130, ly); g.rotate(rot);
    rr(g, -110, -18, 220, 36, 18); g.fillStyle = '#353D47'; g.fill(); g.strokeStyle = '#4A5461'; g.lineWidth = 2; g.stroke();
    rr(g, -116, -24, 56, 48, 16); g.fillStyle = '#3B4450'; g.fill(); rr(g, 60, -24, 56, 48, 16); g.fill();
    g.restore();
    // 단추 (3 × 4)
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    keys.forEach((k, i) => {
      const cx = 92 + (i % 3) * 38, cy = 146 + Math.floor(i / 3) * 24, on = String(o.press) === k;
      rr(g, cx - 15, cy - 9, 30, 18, 5); g.fillStyle = on ? COL.accent : '#46505C'; g.fill();
      txt(g, k, cx, cy + 1, { size: 11, weight: 700, fam: FM, color: on ? '#1D1305' : '#C9D1DA', align: 'center' });
    });
    // 이름표
    rr(g, 196, 134, 0, 0, 0);
    g.restore();
    // 단축 번호 안내 (옆)
    const rows = [['0', 'FRONT DESK'], ['5', 'HOUSEKEEPING'], ['7', 'CONCIERGE']];
    rows.forEach(([k, t], i) => {
      const yy = y + (262 + i * 22) * s, on = String(o.press) === k;
      txt(g, `${k}  ${t}`, x + 30 * s, yy, { size: 13 * s, weight: 700, fam: FM, color: on ? COL.accent : COL.muted });
    });
  }
  HTS.phoneDraw = phoneDraw;

  // 에어컨 (x, y 왼쪽 위, 폭 w). broken: 고장 표시
  function acUnit(g, x, y, w, broken, u) {
    const h = w * 0.36;
    rr(g, x, y, w, h, 10); g.fillStyle = '#E6EAEE'; g.fill(); g.strokeStyle = '#B9C2CB'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#C5CDD5'; for (let k = 0; k < 4; k++) g.fillRect(x + 14, y + h - 30 + k * 6, w - 28, 2.5);
    circ(g, x + w - 22, y + 18, 6, broken ? COL.bad : COL.good);
    if (!broken) { g.strokeStyle = 'rgba(110,200,255,0.55)'; g.lineWidth = 2.4; g.lineCap = 'round'; [0.25, 0.5, 0.75].forEach((f, k) => { const ph = ((u || 0) * 0.9 + k * 0.3) % 1, xx = x + w * f, y0 = y + h + 8 + ph * 10; g.beginPath(); g.moveTo(xx, y0); g.bezierCurveTo(xx - 8, y0 + 10, xx + 8, y0 + 20, xx, y0 + 30); g.stroke(); }); }
    else cross(g, x + w / 2, y + h + 34, 30, COL.bad);
  }

  // 여행 가방과 짐표
  function suitcase(g, cx, by, s, label) {
    g.save(); g.translate(cx, by); g.scale(s, s);
    rr(g, -60, -150, 120, 150, 14); g.fillStyle = '#5D6FA8'; g.fill(); g.strokeStyle = '#3F4E80'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#3F4E80'; g.lineWidth = 4; g.beginPath(); g.moveTo(-28, -150); g.lineTo(-28, -176); g.lineTo(28, -176); g.lineTo(28, -150); g.stroke();
    g.fillStyle = '#4A5A90'; g.fillRect(-30, -150, 6, 150); g.fillRect(24, -150, 6, 150);
    circ(g, -40, 6, 8, '#2B2F36'); circ(g, 40, 6, 8, '#2B2F36');
    if (label) {
      g.strokeStyle = '#C9D1DA'; g.lineWidth = 2; g.beginPath(); g.moveTo(28, -166); g.lineTo(70, -132); g.stroke();
      g.save(); g.translate(92, -112); g.rotate(0.2);
      rr(g, -32, -26, 64, 70, 6); g.fillStyle = '#FFC15E'; g.fill();
      circ(g, 0, -16, 4, '#5D6FA8');
      txt(g, 'CLAIM', 0, 2, { size: 11, weight: 700, fam: FM, color: '#1D1305', align: 'center' });
      txt(g, label, 0, 22, { size: fit(g, label, 15, 58, 700, 8, FM), weight: 700, fam: FM, color: '#1D1305', align: 'center' });
      g.restore();
    }
    g.restore();
  }

  // 시계 (가운데 cx, cy, 반지름 r, 시각 'H:MM')
  function clockDraw(g, cx, cy, r, t) {
    const [h, m] = String(t).split(':').map(Number);
    circ(g, cx, cy, r, '#E9EDF1'); ring(g, cx, cy, r, '#9AA6AA', 3);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.strokeStyle = '#5B6168'; g.lineWidth = k % 3 ? 2 : 3.5; g.beginPath(); g.moveTo(cx + Math.sin(a) * r * 0.82, cy - Math.cos(a) * r * 0.82); g.lineTo(cx + Math.sin(a) * r * 0.92, cy - Math.cos(a) * r * 0.92); g.stroke(); }
    const ah = ((h % 12) + m / 60) / 12 * Math.PI * 2, am = m / 60 * Math.PI * 2;
    g.strokeStyle = COL.ink; g.lineCap = 'round'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(ah) * r * 0.5, cy - Math.cos(ah) * r * 0.5); g.stroke();
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(am) * r * 0.74, cy - Math.cos(am) * r * 0.74); g.stroke();
    circ(g, cx, cy, 5, COL.red);
  }

  // 밤 세기: 해(날) n+1개 사이에 달(밤) n개
  function nightsCal(g, x, y, n, u, at) {
    const dx = 132;
    for (let d = 0; d <= n; d++) fade(g, ramp(u, at + d * 0.5, 0.4), () => {
      const cx = x + 40 + d * dx;
      circ(g, cx, y, 30, 'rgba(255,193,94,0.14)'); ring(g, cx, y, 30, 'rgba(255,193,94,0.6)', 2);
      icon(g, 'sun', cx, y, 30, COL.accent);
      txt(g, `${d + 1}일`, cx, y + 50, { size: 17, weight: 700, color: COL.soft, align: 'center' });
      if (d < n) fade(g, ramp(u, at + 0.3 + d * 0.5, 0.4), () => {
        const mx = cx + dx / 2;
        circ(g, mx, y - 20, 22, 'rgba(201,167,255,0.16)'); icon(g, 'moon', mx, y - 20, 24, COL.verb);
        txt(g, `${d + 1}박`, mx, y + 14, { size: 16, weight: 800, color: COL.verb, align: 'center' });
      });
    });
  }

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(곱하기 표)는 자막에 쓰지 않음
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '호텔 회화 · 부탁은 질문으로 한다', d: 26, caps: [
      [0.4, 5.5, '공항과 카페에서는 주로 대답했어요. 호텔에서는 **내가 먼저** 말을 꺼낼 때가 많아요.'],
      [5.5, 10.5, '수건이 더 필요해 프런트에 전화했어요 → Front desk. How can I help you?'],
      [10.5, 16, '한국어로 먼저 생각해 옮기면 → Give me towel. 명령처럼 들리고, 방 번호도 빠졌어요.'],
      [16, 21, 'Hi, this is room 1207. Could I get some extra towels, please? **부탁은 질문으로** 해요.'],
      [21, 26, '**열쇠 낱말** 잡기, **틀에 내 정보** 넣기, **공손하게** 끝내기. 문제가 생기면 → 사실 + 부탁.'],
    ] },
    { id: 'route', n: '01', title: '호텔 길 지도', sub: '머무는 차례대로 일곱 곳 · 곳마다 한두 마디', d: 30, caps: [
      [0.4, 6, '호텔에서 머무는 차례를 일곱 곳으로 나눠 봐요. 1층 프런트에서 체크인하고, 방 열쇠와 안내를 받아요.'],
      [6, 12, '12층 객실에서는 전화로 부탁하고, 문제가 생기면 알려요. 아침에는 2층 조식 식당에 가요.'],
      [12, 18, '떠나는 날 → 컨시어지에 짐을 맡기고, 프런트에서 체크아웃해요.'],
      [18, 24, '체크인 · 체크아웃의 질문은 거의 정해져 있어요. 객실과 컨시어지에서는 **내가 먼저** 말을 꺼내요.'],
      [24, 30, '절차와 말은 나라와 호텔마다 조금씩 달라요. 여기서는 어디서나 자주 듣는 흐름을 골랐어요.'],
    ] },
    { id: 'checkin', n: '02', title: '체크인', sub: 'Front desk · reservation · spell · nights · passport', d: 34, place: 0, caps: [
      [0.4, 6, 'Do you have a reservation? → 예약했는지 묻는 말. 대답 틀 → I have a reservation under + 성.'],
      [6, 11.5, 'Could you spell that, please? → 철자를 한 글자씩 → K-I-M. 성을 다시 말하면 같은 문제가 남아요.'],
      [11.5, 17.5, 'How many nights? → 2박 3일이면 **two nights**. 호텔은 밤(night)으로 세요.'],
      [17.5, 23, '3일을 옮긴 Three days → 3박으로 들릴 수 있어요. ‘동안’을 옮긴 During two nights도 어색해요.'],
      [23, 28.5, 'Can I see your passport, please? → 보여 달라는 부탁. 건네며 → Sure, here you go.'],
      [28.5, 34, '추가 요금(incidentals)에 대비해 카드를 잠깐 잡아 두기도 해요. 금액과 방법은 호텔마다 달라요.'],
    ] },
    { id: 'key', n: '03', title: '방 열쇠와 안내', sub: 'Key card · 방 번호 · 층 · 시각 · 되묻기', d: 32, place: 1, caps: [
      [0.4, 6, '카드 키를 주면서 숫자를 빠르게 말해요 → You\'re in room 1207, on the twelfth floor.'],
      [6, 11.5, '방 번호는 두 자리씩 → twelve-oh-seven. 0은 → oh. twelve-seventy → 1270호예요.'],
      [11.5, 17, '시각 → from seven to ten, at eleven. 헷갈리는 숫자 → fifteen, fifty. 센 곳이 달라요.'],
      [17, 22.5, '헷갈리면 되물어요 → Sorry, was that room 1207? 일부만 들렸으면 → Sorry, what time is breakfast?'],
      [22.5, 27.5, '더 물어볼 것 → Is breakfast included? ‘서비스’를 옮긴 Is breakfast service? → 통하지 않아요.'],
      [27.5, 32, '영국은 층 이름이 달라요 → 1층 = ground floor, 2층 = first floor.'],
    ] },
    { id: 'call', n: '04', title: '전화로 부탁하기', sub: 'Phone · Could I get …? · Could you …? · 콩글리시', d: 34, place: 2, caps: [
      [0.4, 6, '객실에서 전화 → Front desk. How can I help you? 이제 **내가 부탁할** 차례예요.'],
      [6, 12, '부탁 틀 둘 → Could I get + 필요한 것? 내가 받을 때. Could you bring up + 필요한 것? 직원이 해 줄 때.'],
      [12, 18, '칸만 바꿔요 → two extra towels, another pillow, a toothbrush, a plug adapter, a hair dryer.'],
      [18, 23.5, '‘드라이기’ → a dryer. 옷 말리는 건조기로 들을 수도 있어요. 분명하게 → a hair dryer.'],
      [23.5, 29, '콘센트 → outlet, 리모컨 → remote, 모닝콜 → wake-up call, 프런트 → front desk.'],
      [29, 34, 'Give me towel. → 명령처럼 들려요. 부탁을 질문으로 하면 공손해져요.'],
    ] },
    { id: 'problem', n: '05', title: '문제가 생겼을 때', sub: 'Problem · 사실 + 부탁 · 따지지 않기', d: 34, place: 3, caps: [
      [0.4, 6, '문제가 생기면 **사실 + 부탁**. 사실 → The air conditioner isn\'t working.'],
      [6, 11.5, '부탁 → Could you send someone to look at it? 문제마다 어울리는 부탁이 있어요.'],
      [11.5, 17, '사실 틀 셋 → The ___ isn\'t working. There\'s no ___. The room is too ___.'],
      [17, 22.5, '시끄러우면 → Could I change rooms? 카드 키를 두고 나왔으면 → I\'m locked out.'],
      [22.5, 28, 'Fix it. Change my room. → 따지는 말처럼 들려요. TV doesn\'t come out. → 무슨 뜻인지 알기 어려워요.'],
      [28, 34, 'Hot water doesn\'t come out. → 통하긴 해요. 보통은 There\'s no hot water. 콘센트 → outlet.'],
    ] },
    { id: 'morning', n: '06', title: '조식과 컨시어지', sub: 'Breakfast · Concierge · luggage · wake-up call', d: 34, place: [4, 5], placeAt: 12, caps: [
      [0.4, 6, '조식 식당 → What\'s your room number? 대답 → It\'s 1207. 카드 키 봉투의 번호를 써요.'],
      [6, 12, 'Room is 1207. → 틀린 문장. twelve-seventy → 다른 방이에요. Coffee or tea? → Coffee, please.'],
      [12, 18, '컨시어지 → How can I help you today? 짐을 맡기려면 → Could you hold my luggage until three?'],
      [18, 23, '시각까지 말하면 → Until what time? 질문을 건너뛰어요. Keep my bag. → 명령처럼 들려요.'],
      [23, 28.5, '택시 → Could you call a taxi for me, please? 깨워 주는 전화 → a wake-up call at 6:30.'],
      [28.5, 34, 'Is late check-out possible? 모닝콜 → morning call. 통하는 호텔이 많지만, 영어로는 보통 → wake-up call.'],
    ] },
    { id: 'checkout', n: '07', title: '체크아웃', sub: 'Check-out · minibar · How was your stay · bill', d: 34, place: 6, caps: [
      [0.4, 6, 'Checking out? → Yes, room 1207. 방 번호까지 말하면 직원이 다시 묻지 않아요.'],
      [6, 11.5, 'Did you have anything from the minibar? → 없으면 No, nothing. 과거로 물었으니 No, I don\'t. → 틀린 대답이에요.'],
      [11.5, 16.5, 'How was your stay? → 어땠는지 묻는 말이에요 → It was great, thank you.'],
      [16.5, 22.5, '합계를 말해요 → Your total is $334.40. 청구서를 숙박 카드와 맞춰 봐요.'],
      [22.5, 28.5, '쓰지 않은 미니바 요금이 있어요. This bill is wrong. → 따지는 말처럼 들려요.'],
      [28.5, 34, 'I think there\'s a mistake on my bill. I didn\'t use the minibar. I think … → 부드럽게, 무엇이 다른지 말해요.'],
    ] },
    { id: 'oneline', n: '08', title: '한 번에 말하기', sub: '전화 한 줄 · 직원이 건너뛰는 질문', d: 34, caps: [
      [0.4, 6, '짧게 → Towels, please. 그러면 직원이 다시 물어요 → What\'s your room number? How many?'],
      [6, 12, '주고받기가 세 번. 전화 한 줄에 순서대로 넣어 볼까요? 인사, 방 번호, 부탁 틀, 필요한 것, please.'],
      [12, 18, 'Hi, this is room 1207. Could I get two extra towels, please?'],
      [18, 24, '그러면 직원은 방 번호와 몇 개인지 묻지 않아요 → Sure, I\'ll send them up right away.'],
      [24, 29, '끝인사 → 맨 끝에. 맨 앞에 두면 어색해요. 방 번호는 끝에 말해도 통하지만, 먼저 말하면 더 좋아요.'],
      [29, 34, '세 번이 한 번으로 줄었어요. 이 순서는 자주 쓰는 순서를 단순하게 줄인 규칙이에요.'],
    ] },
    { id: 'method', n: '09', title: '3단계 말하기 법', sub: '일곱 곳에 한 줄씩', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 말하기 법**으로 묶어요.'],
      [5.5, 11.5, '① **열쇠 낱말 잡기** → 무엇을 묻나? 내가 먼저 말할 때는 → 무엇을 부탁하나?'],
      [11.5, 17.5, '② **틀에 내 정보 넣기** → I have a reservation under + 성. This is room + 번호. 사실 + 부탁.'],
      [17.5, 23, '③ **공손하게 끝내기** → Could I …? Could you …, please? Thank you. I think …'],
      [23, 28, '일곱 곳에 한 줄씩 적용했어요. 부탁도 문제도 질문으로 하면 공손해요.'],
    ] },
    { id: 'practice', n: '10', title: '실전 숙박', sub: '숙박 카드 하나로 네 번', d: 50, caps: [
      [0.4, 4.5, '실전이에요. 숙박 카드 → 이지수, 3박 4일, 815호. 첫 질문 → How many nights?'],
      [4.5, 8.5, '① (C) It\'s Lee. → 이름이라 탈락. ② (A) Four days. → 호텔은 밤으로 세요.'],
      [8.5, 12.5, '정답 (B) → Three nights.'],
      [12.9, 17, '조식 식당 → What\'s your room number? ① (B) Coffee, please. → 마실 것이라 탈락.'],
      [17, 21, '② (A) eight-fifty → 탈락. 카드 키 봉투의 번호 → eight-fifteen.'],
      [21, 25, '정답 (C) → It\'s 815.'],
      [25.4, 29.5, '뜨거운 물이 안 나와요. ① 셋 모두 문제를 말하는 대답이에요.'],
      [29.5, 33.5, '② (B) 수건을 가져다 달라는 부탁 → 문제와 맞지 않아 탈락.'],
      [33.5, 37.5, '③ (A) Change my room. → 명령처럼 들려 탈락. 정답 (C)'],
      [37.9, 42, '청구서 → Your total is $660.00. ① (B) Card, please. → 계산 방법이라 탈락.'],
      [42, 46, '② 청구서는 4박, 숙박 카드는 3박이에요. 남은 둘 모두 실수를 알려요.'],
      [46, 50, '③ (A) This bill is wrong. → 따지는 말이라 탈락. 정답 (C) → I only stayed three nights.'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '곳 · 열쇠 낱말 · 대답 틀과 부탁 틀', d: 22, caps: [
      [0.4, 6, '정리해요. 체크인 · 체크아웃은 열쇠 낱말로 무엇을 묻는지 잡고, 짧은 틀에 내 정보를 넣어요.'],
      [6, 12, '객실에서는 내가 먼저 → 부탁은 질문으로, 문제는 사실 + 부탁. 방 번호는 두 자리씩 → twelve-oh-seven.'],
      [12, 17, '못 알아들으면 되물어요 → Sorry, what time is breakfast? Could you spell that, please?'],
      [17, 22, '아래 **호텔 숙박 시뮬레이터**에서 내 숙박 카드로 처음부터 끝까지 머물러 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  HTS.CHAPTERS = CHAPTERS; HTS.CAPTIONS = CAPTIONS; HTS.END = END;
  HTS.POSTER = CHAPTERS.find(c => c.id === 'oneline').t + 21.5;
  HTS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  HTS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 실전 장면의 시각 (구간 시작 · 보기 · ① · ② · ③ · 정답)
  const PSEG = [0, 12.5, 25, 37.5];
  const PT = { q: 0.4, opt: [1.6, 2.2, 2.8], s1: 5.0, s2: 7.0, s3: 9.0, win: 10.0, lines: [0.4, 4.5, 8.5] };
  HTS.PSEG = PSEG;

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
  const ansParts = a => HT.segs(a).map(s => [s.t, s.r]);
  const why2 = j => `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
  // 직접 해 보기로 고른 말 · 대답을 멈춘 화면으로 (판정과 까닭)
  function qaView(g, q, a, card, o = {}) {
    q = Qobj(q);
    const y = o.y || 150, w = o.w || 760, j = HT.judge(q, a, card, o.src || '상황');
    staff(g, q, { x: LX, y, w, all: true, u: 99, size: 22 });
    answer(g, { x: LX, y: y + 78, w, A: a, all: true, u: 99, size: o.size || 22, verdict: { ok: j.ok, at: -1 } });
    const R = richLay(g, why2(j), [], 17, w, { weight: 600 });
    richDraw(g, R, LX, y + 178, { color: j.ok ? COL.good : COL.trap });
    return j;
  }
  // 틀 + 빈칸 + 칸 칩 (칩이 차례로 빈칸에 들어감). parts: [{ t, r } | { blank: true }]
  function template(g, parts, chips, x, y, u, o = {}) {
    const size = o.size || 36, fills = o.fills || [], cur = fills.filter(([, at]) => u >= at).pop();
    const fillT = cur ? chips.find(c => c.k === cur[0]).t : null;
    const toks = parts.map((p, i) => p.blank ? { id: 'b', t: '', r: 'blank', bw: fillT ? tw(g, fillT, size, 600) + 12 : size * 3.4 } : { id: 'p' + i, t: p.t, r: p.r });
    const L = lay(g, toks, { x, y, size, align: o.align || 'left' });
    drawLay(g, L, it => it.r === 'blank' ? { glow: fillT ? 0 : 0.5 + 0.5 * Math.sin(u * 4) } : {});
    const B = L.byId.b;
    chips.forEach((c, i) => {
      const cx = (o.chipX || x) + (o.chipDx || 230) * i + (o.align === 'center' ? -(o.chipDx || 230) * (chips.length - 1) / 2 : 0), cy = o.chipY || y + 90;
      const fi = cur && cur[0] === c.k, p = fi ? clamp((u - cur[1]) / 0.6) : 0, cw = tw(g, c.t, o.chipSize || 20, 600);
      const xx = lerp(o.align === 'center' ? cx - cw / 2 : cx, B.x + 6, ease(p)), yy = lerp(cy, y, ease(p)), sz = lerp(o.chipSize || 20, size, ease(p));
      fade(g, ramp(u, (o.chipAt || 0) + i * 0.3, 0.4), () => {
        const bx0 = o.align === 'center' ? cx - cw / 2 - 12 : cx - 12;
        if (p < 0.98) { rr(g, bx0, cy - 19, cw + 24, 38, 12); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = 'rgba(127,224,168,0.45)'; g.lineWidth = 1.5; g.stroke(); }
        drawTok(g, { t: c.t, r: 'slot', x: xx, y: yy, w: tw(g, c.t, sz, 600), size: sz });
      });
      if (o.say) HITS.push({ x: (o.align === 'center' ? cx - cw / 2 : cx) - 12, y: cy - 19, w: cw + 24, h: 38, say: o.say(c) });
    });
    if (fillT && o.okAt != null) mark(g, true, L.x + L.w + 30, y, 20);
    if (fillT && o.say) say(L.x, y - 26, L.w, 52, o.say(chips.find(c => c.k === cur[0])));
    return L;
  }
  // 판정 뒤 까닭 한 줄 (가운데)
  function whyLine(g, j, y, w = 1100) { const R = richLay(g, why2(j), [], 17, w, { weight: 600 }); richDraw(g, R, W / 2 - R.w / 2, y, { color: j.ok ? COL.good : COL.trap }); return R; }

  // 01장 호텔 단면도의 일곱 곳
  const MAP = {
    checkin: [150, 394], key: [290, 394], call: [700, 200], problem: [880, 200], breakfast: [760, 312], concierge: [830, 394], checkout: [430, 394],
  };
  const MAP_PATH = [[150, 394], [290, 394], [568, 394], [568, 200], [700, 200], [880, 200], [880, 216], [584, 216], [584, 312], [760, 312], [760, 328], [600, 328], [600, 410], [830, 410], [830, 422], [430, 422], [430, 394]];
  function polyPart(g, pts, f) {
    let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
    let left = L * clamp(f);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) { const d = seg[i - 1], k = Math.min(1, left / d); g.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)); left -= d; }
    g.stroke();
  }
  const ME_FIRST = { call: 1, problem: 1, concierge: 1 };   // 내가 먼저 말을 꺼내는 곳

  const SCENES = {
    /* 00 들어가며: 제목 → 객실 전화 한 장면(한국어 그대로 → 전화 한 줄) → 3단계 */
    intro(g, u) {
      fade(g, ramp(u, 0.2, 0.6) * (1 - ramp(u, 4.0, 0.5)), () => {
        txt(g, '호텔, 부탁은 질문으로 한다', W / 2, 262, { size: 56, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Hotel English · 체크인에서 체크아웃까지 일곱 곳', W / 2, 332, { size: 24, weight: 500, color: COL.muted, align: 'center' });
        HT.PLACES.forEach((p, i) => fade(g, ramp(u, 0.9 + i * 0.22, 0.4), () => {
          const x = W / 2 + (i - 3) * 132;
          circ(g, x, 440, 32, COL.panel2); ring(g, x, 440, 32, ME_FIRST[p.id] ? COL.verb : COL.accent, 1.8);
          icon(g, p.id, x, 440, 30, COL.soft);
          txt(g, String(i + 1), x, 392, { size: 14, weight: 700, fam: FM, color: COL.accent, align: 'center' });
          txt(g, p.ko, x, 496, { size: fit(g, p.ko, 15, 126, 600), weight: 600, color: COL.muted, align: 'center' });
          if (i < 6) arrow(g, x + 38, 440, x + 92, 440, COL.faint, 2);
        }));
      });
      const it = HT.INTRO, q = HT.Q[it.q];
      fade(g, ramp(u, 4.6, 0.4) * (1 - ramp(u, 20.6, 0.5)), () => {
        label(g, '객실 · 전화 부탁 · Room phone', LX, 160, { color: COL.accent, size: 16 });
        fade(g, ramp(u, 4.8, 0.5), () => phoneDraw(g, 1010, 150, { s: 0.68, lift: (u - 5.0) / 0.6, press: u >= 5.0 ? '0' : null }));
        const B = staff(g, q, { x: LX, y: 180, w: 880, at: 5.4, u, roleAt: 7.8, size: 26 });
        fade(g, ramp(u, 8.0, 0.4), () => tag(g, '열쇠 낱말 How can I help → 이제 내가 부탁할 차례', LX + 66, 180 + B.bh + 26, COL.ante, { size: 16 }));
        fade(g, ramp(u, 10.4, 0.4) * (1 - ramp(u, 16.0, 0.4)), () => { thought(g, '(한국어로) 수건 주세요', 560, 292, 360); circ(g, 926, 350, 6, 'rgba(242,194,154,0.35)'); circ(g, 942, 364, 4, 'rgba(242,194,154,0.35)'); });
        const p = clamp((u - 16.2) / 1.0);
        const ans = answer(g, { x: LX, y: 372, w: 1120, A: it.lit, B: u >= 16.2 ? it.ok : null, p, at: 11.6, u, size: 28, trapAt: 13.4, strikeAt: 13.6, verdict: u >= 17.4 ? { ok: true, at: 17.4 } : null });
        fade(g, ramp(u, 14.0, 0.4) * (1 - ramp(u, 16.0, 0.3)), () => {
          tag(g, 'Give me → 명령처럼 들려요', ans.bx + ans.bw, 372 + ans.bh + 30, COL.trap, { align: 'right' });
          tag(g, 'towel → some extra towels (여럿이면 -s)', ans.bx + ans.bw, 372 + ans.bh + 74, COL.trap, { align: 'right' });
          tag(g, '방 번호도 빠졌어요', ans.bx + ans.bw, 372 + ans.bh + 118, COL.trap, { align: 'right' });
        });
        fade(g, ramp(u, 17.8, 0.4), () => pieces(g, [['this is room ', 'frame'], ['1207', 'slot'], [' → 누구 방인지 먼저', '']], 1200, 372 + 104, 19, 0, { align: 'right' }));
        fade(g, ramp(u, 18.8, 0.4), () => tag(g, '부탁은 질문으로 → Could I get …, please?', 1200, 372 + 150, COL.verb, { align: 'right' }));
        if (u >= 17.4) say(ans.bx, 372, ans.bw, ans.bh, HT.text(it.ok));
      });
      const STEPS = [['①', '열쇠 낱말 잡기', 'How many nights? → 밤의 수', COL.ante], ['②', '틀에 내 정보 넣기', 'This is room 1207.', COL.rel], ['③', '공손하게 끝내기', 'Could I …? · Could you …, please?', COL.verb]];
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
      fade(g, ramp(u, 23.0, 0.5), () => txt(g, '호텔 영어 = 정해진 질문에 대답 + 내가 먼저 하는 부탁', W / 2, 446, { size: 24, weight: 700, color: COL.soft, align: 'center' }));
      fade(g, ramp(u, 24.0, 0.5), () => pieces(g, [['부탁은 → ', ''], ['질문으로', 'pol'], ['   ·   문제는 → ', ''], ['사실', 'slot'], [' + ', ''], ['부탁', 'pol']], W / 2, 494, 22, 0, { align: 'center' }));
    },

    /* 01 호텔 길 지도: 호텔 단면도 위의 일곱 곳과 곳마다 한두 마디 */
    route(g, u) {
      const sel = S.stop != null ? S.stop : null;
      fade(g, ramp(u, 0.3, 0.6), () => {
        panel(g, 70, 146, 1140, 322, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        // 층 띠
        [[160, 252, '12F', '객실 1207 · Room'], [280, 356, '2F', '조식 식당 · Garden Room'], [362, 464, '1F', '로비 · Lobby']].forEach(([y0, y1, f, nm]) => {
          rr(g, 90, y0, 1100, y1 - y0, 10); g.fillStyle = 'rgba(238,241,244,0.035)'; g.fill();
          txt(g, nm, 1176, y0 + 16, { size: 13, weight: 600, color: COL.muted, align: 'right' });
          txt(g, f, 1176 - tw(g, nm, 13, 600) - 10, y0 + 16, { size: 13, weight: 700, fam: FM, color: COL.accent, align: 'right' });
        });
        g.setLineDash([3, 6]); g.strokeStyle = COL.faint; g.lineWidth = 1.5; [262, 270].forEach(yy => { g.beginPath(); g.moveTo(96, yy); g.lineTo(1184, yy); g.stroke(); }); g.setLineDash([]);
        txt(g, '3F – 11F', 1176, 266, { size: 11, weight: 700, fam: FM, color: COL.dim, align: 'right' });
        // 엘리베이터
        rr(g, 552, 168, 64, 290, 6); g.fillStyle = 'rgba(110,200,255,0.06)'; g.fill(); g.strokeStyle = 'rgba(110,200,255,0.35)'; g.lineWidth = 1.5; g.stroke();
        txt(g, 'ELEVATOR', 584, 450, { size: 10, weight: 700, fam: FM, color: COL.ante, align: 'center' });
        // 객실 (방문 · 침대 · 전화 · 에어컨)
        rr(g, 640, 172, 320, 72, 8); g.strokeStyle = 'rgba(238,241,244,0.25)'; g.lineWidth = 1.5; g.stroke();
        txt(g, '1207', 948, 186, { size: 11, weight: 700, fam: FM, color: COL.red, align: 'right' });
        // 2층 식당 탁자
        [690, 840, 910].forEach(x => { circ(g, x, 330, 10, 'rgba(201,167,255,0.18)'); });
        // 1층 프런트 · 컨시어지 데스크
        rr(g, 106, 442, 380, 15, 4); g.fillStyle = COL.wood; g.fill();
        txt(g, 'FRONT DESK', 296, 450, { size: 10, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
        rr(g, 760, 442, 140, 15, 4); g.fillStyle = COL.wood; g.fill();
        txt(g, 'CONCIERGE', 830, 450, { size: 10, weight: 700, fam: FM, color: '#E6D2B8', align: 'center' });
        // 문
        g.fillStyle = COL.bg; g.fillRect(1184, 398, 12, 52);
        txt(g, 'ENTRANCE', 1176, 424, { size: 10, weight: 700, fam: FM, color: '#B08B62', align: 'right' });
      });
      // 머무는 차례로 걷는 길
      fade(g, ramp(u, 0.6, 0.5), () => { g.strokeStyle = 'rgba(110,200,255,0.5)'; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash([2, 7]); polyPart(g, MAP_PATH, sel != null ? 1 : (u - 0.8) / 14); g.setLineDash([]); });
      const AT = [0.8, 2.4, 6.2, 7.6, 9.4, 12.4, 14.4];
      HT.PLACES.forEach((p, i) => {
        const [x, y] = MAP[p.id], on = sel === i, dim = sel != null && !on, me = ME_FIRST[p.id] && u >= 18.2;
        fade(g, ramp(u, AT[i], 0.45) * (dim ? 0.4 : 1), () => {
          circ(g, x, y, 22, on ? COL.accent : COL.panel2); ring(g, x, y, 22, on ? COL.accent : me ? COL.verb : COL.ante, me ? 3 : 2.2);
          icon(g, p.id, x, y, 24, on ? '#1D1305' : COL.text);
          chip(g, String(i + 1), x + 18, y - 20, { size: 11, fam: FM, weight: 700, color: '#1D1305', fill: COL.accent, h: 18, r: 9, pad: 5, align: 'center' });
          const nm = p.ko.replace('프런트 · ', '').replace('객실 · ', '');
          txt(g, nm, x, y + 34, { size: fit(g, nm, 14, 128, 700), weight: 700, color: me ? COL.verb : COL.soft, align: 'center' });
        });
        HITS.push({ x: x - 26, y: y - 26, w: 52, h: 52, stop: i });
      });
      // 아래 칸
      const by = 480, bh = 98;
      if (sel != null) {
        const p = HT.PLACES[sel];
        panel(g, LX, by, 1120, bh, { fill: COL.panel, stroke: COL.accent });
        icon(g, p.id, LX + 28, by + 24, 22, COL.accent);
        txt(g, `${sel + 1}. ${p.ko}`, LX + 48, by + 24, { size: 17, weight: 700, color: COL.accent });
        HT.ROUTE[p.id].forEach((qid, k) => {
          const q = HT.Q[qid], R = richLay(g, q.en, Qm(q), 17, 640, { weight: 600 });
          richDraw(g, R, LX + 22, by + 54 + k * 28, { color: COL.en });
          say(LX + 18, by + 40 + k * 28, R.w + 8, 28, q.en);
        });
        txt(g, '대답 →', LX + 700, by + 24, { size: 14, weight: 700, color: COL.muted });
        HT.ROUTE[p.id].map(id => HT.Q[id]).forEach((q, k) => { const t = HT.text(HT.model(q, HT.DEMO)); txt(g, t, LX + 700, by + 54 + k * 28, { size: fit(g, t, 16, 410, 600), weight: 600, color: COL.rel }); });
      } else {
        HT.PLACES.forEach((p, i) => fade(g, ramp(u, 12.2 + i * 0.3, 0.4), () => {
          const x = LX + i * 161, q = HT.Q[HT.ROUTE[p.id][0]], t = q.short || q.en, me = ME_FIRST[p.id] && u >= 18.2;
          panel(g, x, by, 151, bh, { fill: COL.panel, stroke: me ? COL.verb : COL.faint, lw: me ? 2 : 1.5 });
          txt(g, `${i + 1}`, x + 14, by + 20, { size: 13, weight: 700, fam: FM, color: COL.accent });
          txt(g, me ? '내가 먼저' : '직원이 물음', x + 140, by + 20, { size: 12, weight: 700, color: me ? COL.verb : COL.muted, align: 'right' });
          const R = richLay(g, t, [], 14, 130, { weight: 600 });
          richDraw(g, R, x + 12, by + 48, { color: COL.en });
          say(x, by, 151, bh, q.en);
        }));
        fade(g, ramp(u, 24.2, 0.5), () => tag(g, '나라 · 호텔마다 조금씩 달라요', 1200, 126, COL.muted, { align: 'right', size: 14, h: 26 }));
      }
    },

    /* 02 체크인: 예약 → 철자 → 2박 3일 = two nights → 여권 → incidentals */
    checkin(g, u) {
      const D = HT.DEMO;
      if (S.nights) {
        const a = S.nights.a, j = HT.judge('ci_nights', a, { nights: S.nights.n }, '상황');
        staff(g, 'ci_nights', { x: LX, y: 150, w: 900, all: true, u: 99, size: 24 });
        nightsCal(g, LX + 20, 290, S.nights.n, 99, -9);
        answer(g, { x: LX, y: 386, w: 1120, A: a, all: true, u: 99, size: 28, verdict: { ok: j.ok, at: -1 } });
        whyLine(g, j, 486);
        return;
      }
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const [[q1, a1], [q2, a2]] = HT.SCENE.checkin;
        staff(g, q1, { x: LX, y: 150, w: 760, at: 0.8, u, roleAt: 2.0, size: 22 });
        answer(g, { x: LX, y: 222, w: 760, A: a1, at: 3.2, u, size: 24, verdict: { ok: okOf(q1, a1), at: 4.4 } });
        fade(g, ramp(u, 4.8, 0.4), () => tag(g, 'under + 성 → 누구 이름으로 예약했는지', LX + 30, 312, COL.clause, { align: 'left' }));
        staff(g, q2, { x: LX, y: 352, w: 760, at: 6.2, u, roleAt: 7.0, size: 22 });
        answer(g, { x: LX, y: 424, w: 760, A: a2, at: 8.0, u, size: 28, verdict: { ok: okOf(q2, a2), at: 8.8 } });
        fade(g, ramp(u, 9.2, 0.4), () => tag(g, 'spell → 한 글자씩', LX + 30, 450, COL.ante, { align: 'left' }));
        // 프런트 화면
        fade(g, ramp(u, 1.4, 0.5), () => {
          panel(g, 880, 150, 320, 300, { fill: '#0E1A24', stroke: 'rgba(110,200,255,0.35)' });
          txt(g, 'RESERVATION', 900, 178, { size: 13, weight: 700, fam: FM, color: COL.ante });
          const nm = u >= 4.4 ? 'KIM' : '…';
          txt(g, 'NAME', 900, 220, { size: 12, weight: 700, fam: FM, color: COL.muted }); txt(g, nm + (u >= 4.4 ? ', MINJI' : ''), 900, 248, { size: 24, weight: 700, fam: FM, color: '#EEF1F4' });
          txt(g, 'NIGHTS', 900, 292, { size: 12, weight: 700, fam: FM, color: COL.muted }); txt(g, u >= 4.4 ? '2' : '…', 900, 318, { size: 22, weight: 700, fam: FM, color: '#EEF1F4' });
          if (u >= 8.4) 'KIM'.split('').forEach((ch, k) => fade(g, ramp(u, 8.4 + k * 0.35, 0.3), () => { const cx = 930 + k * 70; rr(g, cx - 26, 356, 52, 60, 10); g.fillStyle = 'rgba(127,224,168,0.14)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); txt(g, ch, cx, 388, { size: 32, weight: 800, fam: FM, color: COL.good, align: 'center' }); }));
        });
      });
      const inB = win(u, 11.6, 23.0);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        staff(g, 'ci_nights', { x: LX, y: 150, w: 900, at: 11.8, u, roleAt: 12.6, size: 24 });
        fade(g, ramp(u, 13.0, 0.4), () => label(g, '2박 3일 → 밤을 세요', LX, 250, { color: COL.verb, size: 18, weight: 700 }));
        nightsCal(g, LX + 10, 330, 2, u, 13.2);
        fade(g, ramp(u, 15.4, 0.4), () => pieces(g, [['밤 두 번 → ', ''], ['two nights', 'slot']], LX + 20, 430, 24));
        const [d3, during] = HT.SCENE.nights;
        answer(g, { x: 560, y: 236, w: 640, A: d3, at: 17.6, u, size: 24, trapAt: 18.2, strikeAt: 18.3, tag: ['3일 → 3박으로 들려요', COL.trap, 18.6], tagX: 640, tagY: 236 + 74 });
        answer(g, { x: 560, y: 340, w: 640, A: during, at: 19.6, u, size: 24, trapAt: 20.2, strikeAt: 20.3, tag: ['‘동안’ 그대로 → During ×', COL.trap, 20.6], tagX: 640, tagY: 340 + 74 });
        answer(g, { x: 560, y: 444, w: 640, A: HT.SCENE.checkin[2][1], at: 21.0, u, size: 26, verdict: { ok: true, at: 21.6 } });
        fade(g, ramp(u, 21.8, 0.4), () => { const c = chip(g, 'For two nights.', LX + 250, 520, { size: 17, weight: 700, color: COL.rel, fill: COL.panel2, stroke: 'rgba(242,194,154,0.5)', h: 34 }); txt(g, '이것도 좋아요 →', LX + 120, 520, { size: 15, weight: 700, color: COL.muted }); say(c.x, c.y, c.w, c.h, 'For two nights.'); });
      });
      if (u >= 23.0) fade(g, ramp(u, 23.2, 0.4), () => {
        const [qp, trap, ok] = HT.SCENE.pass;
        staff(g, qp, { x: LX, y: 150, w: 760, at: 23.4, u, roleAt: 24.2, size: 22 });
        answer(g, { x: LX, y: 222, w: 760, A: trap, B: ok, p: (u - 26.4) / 0.8, at: 24.8, u, size: 24, trapAt: 25.4, strikeAt: 25.6, verdict: u >= 27.4 ? { ok: true, at: 27.4 } : null, tag: ['허락하는 말 → 엉뚱해요', COL.trap, 25.8, 26.4], tagY: 222 + 82 });
        const [qc, , , here] = HT.SCENE.incid;
        staff(g, qc, { x: LX, y: 330, w: 760, at: 28.6, u, roleAt: 29.6, size: 22 });
        answer(g, { x: LX, y: 402, w: 760, A: here, at: 30.6, u, size: 24, verdict: { ok: true, at: 31.2 } });
        fade(g, ramp(u, 31.8, 0.4), () => { const c = chip(g, 'Sorry, what are incidentals?', LX + 270, 510, { size: 17, weight: 700, color: COL.verb, fill: COL.panel2, stroke: 'rgba(201,167,255,0.5)', h: 34 }); txt(g, '모르는 낱말이면 →', LX + 110, 510, { size: 15, weight: 700, color: COL.muted }); say(c.x, c.y, c.w, c.h, 'Sorry, what are incidentals?'); });
        // 여권 · 카드
        fade(g, ramp(u, 24.0, 0.5), () => {
          panel(g, 880, 150, 320, 380, { fill: COL.panel, stroke: COL.faint });
          rr(g, 930, 176, 104, 140, 8); g.fillStyle = '#7A1F2B'; g.fill(); txt(g, 'PASSPORT', 982, 296, { size: 11, weight: 700, fam: FM, color: '#E8C35A', align: 'center' }); ring(g, 982, 236, 22, '#E8C35A', 2);
          fade(g, ramp(u, 29.0, 0.4), () => {
            g.save(); g.translate(1100, 404); g.rotate(-0.12); rr(g, -74, -46, 148, 92, 10); g.fillStyle = '#3D6FD6'; g.fill(); g.fillStyle = '#E8C35A'; rr(g, -56, -20, 28, 22, 4); g.fill(); g.restore();
            chip(g, 'HOLD', 1150, 352, { size: 13, fam: FM, weight: 700, color: '#1D1305', fill: COL.accent, h: 24, r: 6, align: 'center' });
            txt(g, '추가 요금에 대비해', 1040, 482, { size: 15, weight: 700, color: COL.soft, align: 'center' });
            txt(g, '잠깐 잡아 두는 금액', 1040, 506, { size: 15, weight: 700, color: COL.soft, align: 'center' });
          });
        });
      });
    },

    /* 03 방 열쇠와 안내: 카드 키 봉투 · 방 번호 읽기 · 시각 · 되묻기 · 더 물어볼 것 · 영국의 층 */
    key(g, u) {
      const D = HT.DEMO, room = S.room || D.room;
      const hlAt = S.room ? { room: COL.accent, floor: COL.ante } : u < 11.5 ? (u >= 2.0 ? { room: COL.accent, floor: COL.ante } : {}) : u < 17 ? { bf: COL.accent, co: COL.ante } : u < 22.5 ? { room: COL.accent, bf: COL.ante } : u < 27.5 ? { bf: COL.verb } : {};
      fade(g, ramp(u, 0.6, 0.5), () => { const bx = keySleeve(g, 860, 182, 340, room, { hl: hlAt, card: (u - 0.8) / 0.8 }); say(bx.room.x, bx.room.y, bx.room.w, bx.room.h, `Room ${room}`); });
      if (S.room) {
        txt(g, '방 번호 읽기 → 앞 = 층 · 뒤 두 자리 = 방', LX, 170, { size: 19, weight: 700, color: COL.soft });
        txt(g, room, LX, 250, { size: 64, weight: 800, fam: FM, color: COL.red });
        txt(g, `→ ${HT.roomWords(room)}`, LX + tw(g, room, 64, 800, FM) + 20, 252, { size: 34, weight: 700, color: COL.en });
        say(LX, 210, 700, 80, `Room ${room}`);
        pieces(g, [[`${HT.floorOf(room)}층 → `, ''], [HT.floorWords(HT.floorOf(room)), 'slot']], LX, 320, 22);
        const near = HT.ROOMS[room] || [];
        near.forEach((n, i) => { txt(g, `${n} → ${HT.roomWords(n)}`, LX, 384 + i * 40, { size: 22, weight: 600, color: COL.muted }); say(LX, 366 + i * 40, 520, 36, `Room ${n}`); });
        txt(g, '헷갈리기 쉬운 이웃 번호', LX, 370 + near.length * 40 + 8, { size: 14, weight: 700, color: COL.dim });
        return;
      }
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        staff(g, 'k_room', { x: LX, y: 150, w: 760, at: 0.8, u, roleAt: 2.4, size: 22 });
        fade(g, ramp(u, 6.2, 0.4), () => {
          txt(g, '방 번호 → 두 자리씩', LX, 266, { size: 18, weight: 700, color: COL.soft });
          linked(g, HT.LINKED[0], LX, 320, u, 6.4);
        });
        fade(g, ramp(u, 9.2, 0.4), () => {
          panel(g, LX, 480, 700, 72, { fill: COL.panel, stroke: COL.faint });
          txt(g, '1270', LX + 20, 516, { size: 28, weight: 800, fam: FM, color: COL.trap });
          txt(g, '→ twelve-seventy · 다른 방이에요', LX + 120, 516, { size: 20, weight: 700, color: COL.en });
          say(LX, 480, 700, 72, 'Room 1270');
        });
      });
      const inB = win(u, 11.6, 17.0);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        txt(g, '시각 → 숫자만 세게', LX, 168, { size: 19, weight: 700, color: COL.soft });
        linked(g, HT.LINKED[1], LX, 222, u, 11.8);
        fade(g, ramp(u, 13.8, 0.4), () => {
          txt(g, '헷갈리는 숫자 → 센 곳이 달라요', LX, 418, { size: 18, weight: 700, color: COL.soft });
          HT.PAIRS.forEach(([n1, w1, n2, w2], i) => fade(g, ramp(u, 14.0 + i * 0.4, 0.3), () => {
            const x = LX + i * 250, y = 470;
            const draw = (s, xx, yy) => { const m = s.match(/^([a-z]*)([A-Z]+)([a-z]*)$/); let x2 = xx; [[m[1], 0], [m[2], 1], [m[3], 0]].forEach(([p, big]) => { if (!p) return; x2 += txt(g, p.toLowerCase(), x2, yy, { size: big ? 24 : 18, weight: big ? 800 : 500, color: big ? COL.accent : COL.soft }); }); };
            txt(g, n1, x, y, { size: 18, weight: 700, fam: FM, color: COL.muted }); draw(w1, x + 36, y);
            txt(g, n2, x, y + 40, { size: 18, weight: 700, fam: FM, color: COL.muted }); draw(w2, x + 36, y + 40);
            say(x, y - 18, 220, 76, `${w1.toLowerCase()}, ${w2.toLowerCase()}`);
          }));
        });
      });
      const inC = win(u, 17.2, 22.5);
      if (inC > 0.001 && u >= 17.0) fade(g, inC, () => {
        const [, ok] = HT.SCENE.confirm;
        answer(g, { x: LX, y: 160, w: 760, A: ok, at: 17.4, u, size: 24, verdict: { ok: true, at: 18.2 } });
        talk(g, { side: 'L', x: LX, y: 238, w: 760, text: 'Yes, twelve-oh-seven.', marks: [['twelve-oh-seven', 'slot']], kind: 'desk', sp: 'us', at: 18.6, u, size: 22 });
        const [qf, bf] = HT.SCENE.fast;
        staff(g, qf, { x: LX, y: 330, w: 760, at: 19.4, u, size: 22 });
        fade(g, ramp(u, 19.8, 0.4), () => tag(g, '…… breakfast …… 만 들렸어요', 780, 318, COL.trap, { align: 'right', size: 14, h: 28 }));
        answer(g, { x: LX, y: 412, w: 760, A: bf, at: 20.8, u, size: 24, verdict: { ok: okOf(qf, bf, {}), at: 21.6 } });
      });
      const inD = win(u, 22.7, 27.5);
      if (inD > 0.001 && u >= 22.5) fade(g, inD, () => {
        const [qk, svc, incl] = HT.SCENE.kmore;
        staff(g, qk, { x: LX, y: 160, w: 760, at: 22.9, u, roleAt: 23.6, size: 22 });
        answer(g, { x: LX, y: 232, w: 760, A: svc, B: incl, p: (u - 25.0) / 0.8, at: 23.8, u, size: 24, trapAt: 24.3, strikeAt: 24.4, verdict: u >= 26.0 ? { ok: true, at: 26.0 } : null, tag: ['서비스(덤) → 통하지 않아요', COL.trap, 24.6, 25.0], tagY: 232 + 80 });
        talk(g, { side: 'L', x: LX, y: 350, w: 760, text: 'Yes, it is. It\'s included in your rate.', marks: [['included', 'key']], kind: 'desk', sp: 'us', at: 26.4, u, size: 22 });
      });
      if (u >= 27.5) fade(g, ramp(u, 27.7, 0.4), () => {
        txt(g, '층 이름 → 미국 · 영국', LX, 168, { size: 19, weight: 700, color: COL.soft });
        [['미국 · 한국', ['3rd floor', '2nd floor', '1st floor']], ['영국', ['2nd floor', '1st floor', 'ground floor']]].forEach(([nm, fl], k) => {
          const x = LX + 30 + k * 330;
          txt(g, nm, x + 110, 210, { size: 17, weight: 700, color: k ? COL.verb : COL.ante, align: 'center' });
          fl.forEach((f, i) => { const y = 240 + i * 82; rr(g, x, y, 220, 70, 8); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.stroke(); txt(g, f, x + 110, y + 26, { size: 20, weight: 700, color: COL.en, align: 'center' }); txt(g, `${3 - i}층`, x + 110, y + 52, { size: 14, weight: 600, color: COL.muted, align: 'center' }); say(x, y, 220, 70, f); });
        });
        fade(g, ramp(u, 29.2, 0.4), () => txt(g, '엘리베이터의 G · 0 → 땅과 같은 층', LX + 30, 506, { size: 16, weight: 700, color: COL.muted }));
      });
    },

    /* 04 전화로 부탁하기: 객실 전화 → Could I get / Could you bring up → dryer → 콩글리시 → Give me */
    call(g, u) {
      if (S.call) {
        const a = S.call.a, j = HT.judge(S.call.q, a, S.call.card, '상황');
        staff(g, S.call.q, { x: LX, y: 150, w: 900, all: true, u: 99, size: 24 });
        const L = lay(g, ansToks(a), { x: W / 2, y: 290, size: 34, align: 'center', maxW: 1080 });
        drawLay(g, L); mark(g, j.ok, L.x + L.w + 30, 290, 20); say(L.x, 264, L.w, 52, HT.text(a));
        whyLine(g, j, 360);
        tag(g, `필요한 것 → ${HT.factKo('thing', S.call.want)}`, W / 2, 470, COL.clause, { align: 'center', size: 18, h: 40 });
        return;
      }
      fade(g, 1 - ramp(u, 17.8, 0.4), () => {
        fade(g, ramp(u, 0.3, 0.5), () => phoneDraw(g, 930, 170, { s: 0.92, lift: (u - 0.6) / 0.6, press: u >= 0.5 && u < 6 ? '0' : null }));
        const B = staff(g, 'cl_help', { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.8, size: 24 });
        fade(g, ramp(u, 2.6, 0.4), () => tag(g, 'How can I help → 내가 부탁할 차례', LX + 66, 150 + B.bh + 24, COL.ante, { size: 15 }));
        const things1 = ['towels2', 'pillow', 'toothbrush'].map(k => ({ k, t: HT.SLOT.thing.vals[k].t })), things2 = ['hairdryer', 'adapter', 'towels2'].map(k => ({ k, t: HT.SLOT.thing.vals[k].t }));
        fade(g, ramp(u, 6.2, 0.4), () => {
          pieces(g, [['I → ', ''], ['내가 받을 때', 'slot']], LX, 262, 16);
          template(g, [{ t: 'Could', r: 'pol' }, { t: 'I', r: 'pol' }, { t: 'get', r: 'frame' }, { blank: true }, { t: ',', r: '' }, { t: 'please', r: 'pol' }, { t: '?', r: '' }], things1, LX, 306, u,
            { size: 30, chipY: 362, chipX: LX + 12, chipDx: 238, chipAt: 6.6, fills: [['towels2', 7.4], ['pillow', 12.2], ['toothbrush', 14.0]], say: c => `Could I get ${c.t}, please?`, chipSize: 18 });
        });
        fade(g, ramp(u, 9.2, 0.4), () => {
          pieces(g, [['you → ', ''], ['직원이 해 줄 때', 'pol']], LX, 420, 16);
          template(g, [{ t: 'Could', r: 'pol' }, { t: 'you', r: 'pol' }, { t: 'bring', r: 'frame' }, { t: 'up', r: 'frame' }, { blank: true }, { t: ',', r: '' }, { t: 'please', r: 'pol' }, { t: '?', r: '' }], things2, LX, 464, u,
            { size: 30, chipY: 520, chipX: LX + 12, chipDx: 238, chipAt: 9.6, fills: [['hairdryer', 10.4], ['adapter', 15.6]], say: c => `Could you bring up ${c.t}, please?`, chipSize: 18 });
        });
      });
      const inB = win(u, 18.2, 23.4);
      if (inB > 0.001 && u >= 17.8) fade(g, inB, () => {
        thought(g, '(한국어로) 드라이기 주세요', LX, 160, 380);
        const hd = HT.o('cl_could', 'hairdryer');
        answer(g, { x: LX, y: 240, w: 1000, A: HT.SCENE.dryer, B: hd, p: (u - 21.0) / 0.8, at: 18.8, u, size: 28, verdict: { ok: true, at: u < 21 ? 19.6 : 21.8 }, tag: ['통해요 · 다만 옷 건조기로 들릴 수도', COL.rel, 19.8, 21.0], tagY: 240 + 86 });
        fade(g, ramp(u, 21.8, 0.4), () => tag(g, 'hair dryer → 분명해요', 1080, 240 + 86, COL.clause, { align: 'right' }));
        fade(g, ramp(u, 20.0, 0.5), () => {
          [['hairdryer', 'hair dryer', '머리 말리기', 520], ['dryer', 'dryer', '옷 말리기?', 760]].forEach(([k, en, ko, x], i) => {
            panel(g, x, 400, 220, 120, { fill: COL.panel2, stroke: i ? 'rgba(255,159,122,0.5)' : COL.good, lw: 2 });
            txt(g, en, x + 110, 444, { size: 24, weight: 800, color: i ? COL.trap : COL.good, align: 'center' });
            txt(g, ko, x + 110, 484, { size: 16, weight: 600, color: COL.muted, align: 'center' });
            say(x, 400, 220, 120, en);
          });
        });
      });
      const inC = win(u, 23.7, 29.0);
      if (inC > 0.001 && u >= 23.4) fade(g, inC, () => {
        txt(g, '한국에서 만든 말 → 영어로는', LX, 166, { size: 20, weight: 700, color: COL.soft });
        const rows = [['콘센트', 'consent', 'outlet (영국 socket)', 'consent = 동의 → 안 통해요', 1], ['리모컨', 'remocon', 'remote', '한국에서 줄인 말 → 안 통해요', 1], ['드라이기', 'dryer', 'hair dryer', '통하지만 건조기로 들릴 수도', 0], ['모닝콜', 'morning call', 'wake-up call', '통하는 호텔도 많아요', 0], ['프런트', 'front', 'front desk · reception', '줄여도 알아듣는 곳이 많아요', 0]];
        rows.forEach(([ko, lit, en, note, no], i) => fade(g, ramp(u, 24.0 + i * 0.5, 0.4), () => {
          const y = 218 + i * 66;
          rr(g, LX, y - 26, 1120, 54, 10); g.fillStyle = COL.panel; g.fill();
          txt(g, ko, LX + 20, y, { size: 22, weight: 800, color: '#F2C29A' });
          txt(g, lit, LX + 170, y, { size: 19, weight: 600, color: no ? COL.trap : COL.muted });
          if (no) { g.strokeStyle = COL.trap; g.lineWidth = 2; g.beginPath(); g.moveTo(LX + 166, y + 1); g.lineTo(LX + 170 + tw(g, lit, 19, 600) + 4, y + 1); g.stroke(); }
          arrow(g, LX + 330, y, LX + 380, y, COL.accent, 2.5);
          txt(g, en, LX + 396, y, { size: 22, weight: 800, color: COL.en });
          if (note) txt(g, note, LX + 1100, y, { size: 15, weight: 600, color: no ? COL.trap : COL.muted, align: 'right' });
          say(LX + 390, y - 24, 360, 48, en.replace(/ \(.*\)/, ''));
        }));
      });
      if (u >= 29.0) fade(g, ramp(u, 29.2, 0.4), () => {
        thought(g, '(한국어로) 수건 주세요', LX, 160, 340);
        const [give, could] = HT.SCENE.give;
        answer(g, { x: LX, y: 230, w: 760, A: give, at: 29.6, u, size: 26, trapAt: 30.2, strikeAt: 30.3, tag: ['명령처럼 들려요', COL.trap, 30.6], tagX: 860, tagY: 230 + 28 });
        answer(g, { x: LX, y: 322, w: 760, A: could, at: 31.4, u, size: 26, verdict: { ok: true, at: 32.2 } });
        fade(g, ramp(u, 32.6, 0.4), () => tag(g, '부탁을 질문으로 → 공손해요', 860, 322 + 28, COL.verb));
      });
    },

    /* 05 문제가 생겼을 때: 사실 + 부탁 → 사실 틀 셋 → 방 바꾸기 · 잠김 → 명령 · 그대로 옮긴 말 → 통하는 말 · consent */
    problem(g, u) {
      if (S.prob) {
        const a = S.prob.a, j = HT.judge('pr_help', a, { prob: S.prob.p }, '상황');
        staff(g, 'pr_help', { x: LX, y: 150, w: 900, all: true, u: 99, size: 24 });
        const L = lay(g, ansToks(a), { x: W / 2, y: 290, size: 28, align: 'center', maxW: 1100 });
        drawLay(g, L); mark(g, j.ok, Math.min(1226, L.x + L.w + 26), 290, 18); say(L.x, 264, L.w, 52 + (L.lines - 1) * 42, HT.text(a));
        whyLine(g, j, 380 + (L.lines - 1) * 42);
        tag(g, `상황 → ${HT.PROB[S.prob.p].ko}`, W / 2, 500, COL.clause, { align: 'center', size: 18, h: 40 });
        return;
      }
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        fade(g, ramp(u, 0.3, 0.5), () => {
          panel(g, 900, 336, 300, 236, { fill: COL.panel, stroke: COL.faint });
          txt(g, 'ROOM 1207', 1050, 360, { size: 13, weight: 700, fam: FM, color: COL.muted, align: 'center' });
          acUnit(g, 960, 384, 180, u < 9.2, u);
          txt(g, u < 9.2 ? '에어컨이 안 돼요' : 'I\'ll send someone up.', 1050, 548, { size: fit(g, 'I\'ll send someone up.', 17, 260, 700), weight: 700, color: u < 9.2 ? COL.trap : COL.good, align: 'center' });
        });
        staff(g, 'pr_help', { x: LX, y: 150, w: 800, at: 0.8, u, roleAt: 1.6, size: 22 });
        const fact = HT.SCENE.fact[0], full = HT.SCENE.full;
        const A = answer(g, { x: LX, y: 226, w: 1120, A: fact, B: u >= 6.4 ? full : null, p: (u - 6.4) / 0.8, at: 2.4, u, size: 22, verdict: u >= 7.6 ? { ok: true, at: 7.6 } : null });
        fade(g, ramp(u, 3.4, 0.4), () => tag(g, '사실 → 무엇이 문제인지', A.bx, 226 + A.bh + 26, COL.clause, { align: 'left', size: 15, h: 30 }));
        fade(g, ramp(u, 7.8, 0.4), () => tag(g, '부탁 → 무엇을 해 주면 좋을지', A.bx + A.bw, 226 + A.bh + 26, COL.verb, { align: 'right', size: 15, h: 30 }));
        talk(g, { side: 'L', x: LX, y: 340, w: 800, text: 'I\'m so sorry. I\'ll send someone up right away.', marks: [['send someone up', 'ok']], kind: 'phone', sp: 'ca', at: 8.8, u, size: 22 });
        fade(g, ramp(u, 10.0, 0.4), () => txt(g, '사실 + 부탁 → 한 번에 끝나요', LX, 452, { size: 20, weight: 700, color: COL.accent }));
      });
      const inB = win(u, 11.6, 17.0);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        const T = [
          [[{ t: 'The', r: 'frame' }, { blank: true }, { t: 'isn\'t', r: 'frame' }, { t: 'working', r: 'frame' }, { t: '.', r: '' }], ['ac', 'tv', 'wifi'].map(k => ({ k, t: HT.SLOT.brk.vals[k].t })), 11.8, [['ac', 12.4], ['tv', 14.4], ['wifi', 15.8]], 'ac', 'The $ isn\'t working.'],
          [[{ t: 'There\'s', r: 'frame' }, { t: 'no', r: 'frame' }, { blank: true }, { t: '.', r: '' }], ['hotwater', 'toiletpaper'].map(k => ({ k, t: HT.SLOT.lack.vals[k].t })), 12.4, [['hotwater', 13.0], ['toiletpaper', 15.0]], 'shower', 'There\'s no $.'],
          [[{ t: 'The', r: 'frame' }, { t: 'room', r: 'frame' }, { t: 'is', r: 'frame' }, { t: 'too', r: 'frame' }, { blank: true }, { t: '.', r: '' }], ['noisy', 'cold'].map(k => ({ k, t: HT.SLOT.too.vals[k].t })), 13.0, [['noisy', 13.6], ['cold', 15.4]], 'noise', 'The room is too $.'],
        ];
        T.forEach(([parts, chips, at, fills, ic, sayT], i) => fade(g, ramp(u, at, 0.4), () => {
          const y = 196 + i * 124;
          circ(g, LX + 20, y, 20, COL.panel2); icon(g, ic, LX + 20, y, 24, COL.soft);
          template(g, parts, chips, LX + 56, y, u, { size: 30, chipY: y + 54, chipX: LX + 68, chipDx: 230, chipAt: at + 0.2, fills, say: c => sayT.replace('$', c.t), chipSize: 17 });
        }));
      });
      const inC = win(u, 17.2, 22.5);
      if (inC > 0.001 && u >= 17.0) fade(g, inC, () => {
        answer(g, { x: LX, y: 160, w: 1120, A: HT.o('pf_too', 'noisy', HT.o('rq_change')), at: 17.4, u, size: 24, verdict: { ok: true, at: 18.2 } });
        answer(g, { x: LX, y: 240, w: 1120, A: HT.SCENE.lock, at: 19.4, u, size: 22, verdict: { ok: true, at: 20.4 } });
        fade(g, ramp(u, 20.6, 0.5), () => {
          panel(g, LX, 330, 1120, 222, { fill: COL.panel, stroke: COL.faint });
          txt(g, '문제 → 어울리는 부탁 (HT.fix)', LX + 20, 356, { size: 16, weight: 700, color: COL.muted });
          [[['ac', 'tv', 'wifi', 'shower'], '에어컨 · TV · 와이파이 · 뜨거운 물', 'Could you send someone to look at it?'], [['noise'], '방이 시끄러움', 'Could I change rooms?'], [['lock', 'key'], '잠김 · 카드 키', 'Could you make a new key for me?'], [['towel'], '수건 · 화장지 없음', 'Could you bring up some towels, please?']].forEach(([ics, ko, en], i) => {
            const y = 392 + i * 40;
            ics.forEach((ic, k) => icon(g, ic, LX + 30 + k * 26, y, 20, COL.soft));
            txt(g, ko, LX + 140, y, { size: fit(g, ko, 16, 300, 600), weight: 600, color: COL.soft });
            arrow(g, LX + 450, y, LX + 490, y, COL.accent, 2);
            const R = richLay(g, en, [['Could you', 'pol'], ['Could I', 'pol'], ['please', 'pol']], 18, 600, { weight: 600 });
            richDraw(g, R, LX + 504, y, { color: COL.en }); say(LX + 500, y - 16, R.w + 8, 32, en);
          });
        });
      });
      const inD = win(u, 22.7, 28.0);
      if (inD > 0.001 && u >= 22.5) fade(g, inD, () => {
        const [fixIt, chg] = HT.SCENE.blunt, tvLit = HT.SCENE.lit[0];
        answer(g, { x: LX, y: 160, w: 1120, A: fixIt, at: 22.9, u, size: 24, trapAt: 23.4, strikeAt: 23.5, tag: ['Fix it. → 명령 · 따지는 말', COL.trap, 23.8], tagY: 160 + 70 });
        answer(g, { x: LX, y: 274, w: 1120, A: chg, at: 24.4, u, size: 24, trapAt: 24.9, strikeAt: 25.0, tag: ['Change my room. → 명령', COL.trap, 25.3], tagY: 274 + 70 });
        answer(g, { x: LX, y: 388, w: 1120, A: tvLit, at: 25.9, u, size: 24, trapAt: 26.4, strikeAt: 26.5, tag: ['come out = 밖으로 나오다 → The TV isn\'t working.', COL.trap, 26.8], tagY: 388 + 70 });
      });
      if (u >= 28.0) fade(g, ramp(u, 28.2, 0.4), () => {
        const hot = HT.SCENE.lit[2], [kong, outlet] = HT.SCENE.kong;
        answer(g, { x: LX, y: 160, w: 1120, A: hot, at: 28.4, u, size: 24, verdict: { ok: true, at: 29.0 }, tag: ['통해요 · 보통은 There\'s no hot water.', COL.rel, 29.4], tagY: 160 + 70 });
        answer(g, { x: LX, y: 274, w: 1120, A: kong, at: 30.6, u, size: 24, trapAt: 31.1, strikeAt: 31.2, tag: ['consent = 동의 → outlet', COL.trap, 31.5], tagY: 274 + 70 });
        answer(g, { x: LX, y: 388, w: 1120, A: outlet, at: 32.4, u, size: 24, verdict: { ok: true, at: 33.0 } });
      });
    },

    /* 06 조식과 컨시어지: 방 번호 → Coffee or tea → 짐 맡기기(시각까지) → Keep my bag → 택시 · 모닝콜 · 늦은 체크아웃 */
    morning(g, u) {
      const D = HT.DEMO;
      if (S.cg) {
        const a = S.cg.a, j = HT.judge('cg_help', a, S.cg.card, '상황');
        staff(g, 'cg_help', { x: LX, y: 150, w: 900, all: true, u: 99, size: 24 });
        const L = lay(g, ansToks(a), { x: W / 2, y: 290, size: 32, align: 'center', maxW: 1080 });
        drawLay(g, L); mark(g, j.ok, L.x + L.w + 30, 290, 20); say(L.x, 264, L.w, 52, HT.text(a));
        whyLine(g, j, 360);
        tag(g, `하고 싶은 것 → ${S.cg.ko}`, W / 2, 470, COL.clause, { align: 'center', size: 18, h: 40 });
        return;
      }
      fade(g, 1 - ramp(u, 11.8, 0.4), () => {
        const [qb, lit, wrong, ok] = HT.SCENE.bf;
        staff(g, qb, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.6, size: 22 });
        answer(g, { x: LX, y: 222, w: 780, A: ok, at: 2.6, u, size: 24, verdict: { ok: true, at: 3.4 } });
        fade(g, ramp(u, 3.8, 0.4), () => tag(g, '카드 키 봉투의 번호 → twelve-oh-seven', LX + 10, 310, COL.clause, { align: 'left', size: 15, h: 30 }));
        answer(g, { x: LX, y: 344, w: 780, A: lit, at: 6.2, u, size: 22, trapAt: 6.6, strikeAt: 6.7, tag: ['틀린 문장 (my 빠짐)', COL.trap, 6.9], tagX: LX + 10, tagY: 344 + 24 });
        answer(g, { x: LX, y: 420, w: 780, A: wrong, at: 7.6, u, size: 22, trapAt: 8.0, strikeAt: 8.1, tag: ['twelve-seventy → 다른 방', COL.trap, 8.3], tagX: LX + 10, tagY: 420 + 24 });
        const [qd, cof] = HT.SCENE.drink;
        fade(g, ramp(u, 9.4, 0.4), () => {
          staff(g, qd, { x: LX, y: 500, w: 420, at: 9.6, u, roleAt: 10.0, size: 20 });
          answer(g, { x: 480, y: 500, w: 320, A: cof, at: 10.6, u, size: 20, verdict: { ok: true, at: 11.0 } });
        });
        fade(g, ramp(u, 0.6, 0.5), () => keySleeve(g, 880, 180, 320, D.room, { hl: { room: COL.accent }, card: 0 }));
      });
      const inB = win(u, 12.2, 23.3);
      if (inB > 0.001 && u >= 11.8) fade(g, inB, () => {
        const [[hold]] = HT.SCENE.cg;
        staff(g, 'cg_help', { x: LX, y: 150, w: 780, at: 12.4, u, roleAt: 13.2, size: 22 });
        answer(g, { x: LX, y: 222, w: 780, A: hold, at: 14.0, u, size: 24, verdict: { ok: true, at: 14.8 } });
        fade(g, ramp(u, 18.2, 0.4), () => {
          const R = richLay(g, 'No problem. Until what time?', [['Until what time', 'key']], 20, 600, { weight: 500 });
          panel(g, LX, 312, R.w + 120, 40, { fill: COL.panel, stroke: COL.faint, r: 20 });
          richDraw(g, R, LX + 20, 332, { color: COL.dim });
          g.strokeStyle = COL.good; g.lineWidth = 2.6; g.beginPath(); g.moveTo(LX + 14, 333); g.lineTo(LX + 26 + R.w, 333); g.stroke();
          chip(g, '건너뜀', LX + R.w + 36, 332, { size: 14, weight: 700, color: '#10151C', fill: COL.good, h: 26, r: 13 });
          txt(g, 'until three → 시각까지 말했으니 직원이 묻지 않아요', LX, 380, { size: 17, weight: 700, color: COL.soft });
        });
        const [keep] = HT.SCENE.cgBlunt;
        answer(g, { x: LX, y: 420, w: 780, A: keep, at: 20.0, u, size: 24, trapAt: 20.6, strikeAt: 20.7, tag: ['명령처럼 들려요', COL.trap, 21.0], tagX: LX + 10, tagY: 420 + 26 });
        fade(g, ramp(u, 14.6, 0.5), () => { panel(g, 880, 150, 320, 380, { fill: COL.panel, stroke: COL.faint }); suitcase(g, 1010, 470, 1.2, '3:00 PM'); txt(g, '짐표(claim tag)를 받아요', 1040, 504, { size: 15, weight: 700, color: COL.muted, align: 'center' }); });
      });
      if (u >= 22.9) fade(g, ramp(u, 23.0, 0.4), () => {
        const rows = [[HT.SCENE.cg[1][0], 'taxi', 23.3], [HT.SCENE.cg[2][0], 'clock', 25.2], [HT.SCENE.cg[3][0], 'checkout', 28.6]];
        rows.forEach(([a, ic, at], i) => {
          const y = 160 + i * 92;
          const B = answer(g, { x: LX, y, w: 800, A: a, at, u, size: 24, verdict: { ok: true, at: at + 0.8 } });
          fade(g, ramp(u, at - 0.3, 0.4), () => { circ(g, B.bx - 62, y + B.bh / 2, 20, COL.panel2); icon(g, ic, B.bx - 62, y + B.bh / 2, 22, COL.soft); });
        });
        const [mc] = HT.SCENE.morning;
        fade(g, ramp(u, 30.4, 0.4), () => {
          panel(g, LX, 446, 820, 104, { fill: COL.panel, stroke: 'rgba(242,194,154,0.45)' });
          txt(g, '모닝콜 → morning call', LX + 20, 476, { size: 18, weight: 700, color: '#F2C29A' });
          txt(g, '통하는 호텔이 많아요 · 영어로는 보통 a wake-up call', LX + 20, 512, { size: 17, weight: 600, color: COL.soft });
          say(LX, 446, 820, 104, HT.text(mc));
        });
        fade(g, ramp(u, 25.6, 0.5), () => { panel(g, 900, 150, 300, 300, { fill: COL.panel, stroke: COL.faint }); clockDraw(g, 1050, 280, 92, D.wake); txt(g, '6:30 → six-thirty', 1050, 410, { size: 18, weight: 700, color: COL.en, align: 'center' }); say(900, 150, 300, 300, 'six-thirty'); });
      });
    },

    /* 07 체크아웃: Checking out → 미니바 → 소감 → 청구서 확인 → 따지지 않고 실수 알리기 */
    checkout(g, u) {
      const D = S.bill || HT.DEMO;
      if (S.bill) {
        const qb = HT.simQ('co_bill', D);
        talk(g, { side: 'L', x: LX, y: 150, w: 720, text: qb.en, marks: [[HT.money(qb.total), 'key']], kind: 'desk', sp: 'us', all: true, u: 99, size: 22 });
        txt(g, '읽기 →', LX, 250, { size: 16, weight: 700, color: COL.muted });
        txt(g, HT.priceWords(qb.total), LX, 284, { size: fit(g, HT.priceWords(qb.total), 24, 700, 700), weight: 700, color: COL.en });
        say(LX, 264, 720, 40, `Your total is ${HT.money(qb.total)}.`);
        const m = HT.model(qb, D), j = HT.judge(qb, m, D);
        txt(g, '맞는 대답 →', LX, 350, { size: 16, weight: 700, color: COL.muted });
        answer(g, { x: LX, y: 370, w: 760, A: m, all: true, u: 99, size: 20, verdict: { ok: j.ok, at: -1 } });
        billDraw(g, 880, 150, 320, D, { hl: D.billErr === 'minibar' ? { mini: COL.bad } : D.billErr === 'nights' ? { room: COL.bad } : {} });
        return;
      }
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const [qo, co] = HT.SCENE.co, [qm, dont, no] = HT.SCENE.mini;
        staff(g, qo, { x: LX, y: 150, w: 780, at: 0.8, u, roleAt: 1.4, size: 22 });
        answer(g, { x: LX, y: 222, w: 780, A: co, at: 2.4, u, size: 24, verdict: { ok: true, at: 3.2 } });
        fade(g, ramp(u, 3.8, 0.4), () => tag(g, '방 번호까지 → 다시 묻지 않아요', LX + 10, 310, COL.clause, { align: 'left', size: 15, h: 30 }));
        staff(g, qm, { x: LX, y: 350, w: 780, at: 6.0, u, roleAt: 6.8, size: 22 });
        answer(g, { x: LX, y: 422, w: 780, A: dont, B: no, p: (u - 9.4) / 0.8, at: 7.8, u, size: 24, trapAt: 8.4, strikeAt: 8.5, verdict: u >= 10.4 ? { ok: true, at: 10.4 } : null, tag: ['Did you → 과거 · No, I didn\'t.', COL.trap, 8.8, 9.4], tagY: 422 + 82 });
        fade(g, ramp(u, 1.4, 0.5), () => keySleeve(g, 880, 180, 320, HT.DEMO.room, { hl: { room: COL.accent }, card: 0 }));
      });
      const inB = win(u, 11.6, 16.4);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        const [qs, yes, great] = HT.SCENE.stay;
        staff(g, qs, { x: LX, y: 160, w: 900, at: 11.8, u, roleAt: 12.4, size: 26 });
        answer(g, { x: LX, y: 246, w: 900, A: yes, B: great, p: (u - 14.2) / 0.8, at: 12.8, u, size: 28, trapAt: 13.3, strikeAt: 13.4, verdict: u >= 15.2 ? { ok: true, at: 15.2 } : null, tag: ['How was … → Yes · No로는 답이 안 돼요', COL.trap, 13.6, 14.2], tagY: 246 + 90 });
        fade(g, ramp(u, 15.4, 0.4), () => tag(g, 'How was … → 어땠는지', LX + 66, 160 + 70, COL.ante, { size: 15 }));
      });
      if (u >= 16.4) fade(g, ramp(u, 16.6, 0.4), () => {
        const qb = HT.simQ('co_bill', D), [wrong, ok] = HT.SCENE.bill;
        talk(g, { side: 'L', x: LX, y: 150, w: 780, text: qb.en, marks: [['bill', 'key'], [HT.money(qb.total), 'key']], kind: 'desk', sp: 'us', at: 16.8, u, roleAt: 17.8, size: 22 });
        fade(g, ramp(u, 18.6, 0.4), () => tag(g, `→ ${HT.priceWords(qb.total)}`, LX + 66, 238, COL.ante, { size: 15, h: 30 }));
        fade(g, ramp(u, 20.0, 0.4), () => { const c = chip(g, '숙박 카드 → 미니바 안 씀', LX + 66, 286, { size: 16, weight: 700, color: '#14623F', fill: COL.paper, h: 32, r: 8 }); void c; });
        answer(g, { x: LX, y: 330, w: 780, A: wrong, at: 23.2, u, size: 24, trapAt: 23.8, strikeAt: 23.9, tag: ['따지는 말처럼 들려요', COL.trap, 24.2], tagX: LX + 10, tagY: 330 + 26 });
        answer(g, { x: LX, y: 420, w: 780, A: ok, at: 28.6, u, size: 19, verdict: { ok: true, at: 29.8 } });
        fade(g, ramp(u, 30.2, 0.4), () => tag(g, 'I think → 부드럽게 · 무엇이 다른지', LX + 10, 510, COL.verb, { align: 'left', size: 15, h: 30 }));
        fade(g, ramp(u, 17.0, 0.5), () => {
          const b = billDraw(g, 880, 150, 320, D, { shown: (u - 17.4) / 0.6, hl: u >= 22.6 ? { mini: COL.bad } : {} });
          if (u >= 22.8) fade(g, ramp(u, 22.8, 0.4), () => { const bx = b.boxes.mini; if (bx) { tag(g, '쓰지 않았어요', bx.x - 24, bx.y + bx.h / 2, COL.bad, { align: 'right', size: 13, h: 26 }); arrow(g, bx.x - 22, bx.y + bx.h / 2, bx.x - 2, bx.y + bx.h / 2, COL.bad, 2); } });
        });
      });
    },

    /* 08 한 번에 말하기: 짧은 부탁 → 세 번 주고받기 → 전화 한 줄 → 건너뛴 질문 → 순서가 어색하면 → 3 → 1 */
    oneline(g, u) {
      const L = S.line || HT.LINE, lab = !!S.line, a = { f: 'line', line: L }, C = lab ? Object.assign({}, HT.DEMO, { thing: undefined, n: undefined }) : HT.DEMO;
      if (!lab) fade(g, ramp(u, 0.4, 0.4) * (1 - ramp(u, 11.8, 0.4)), () => {
        txt(g, '짧게 부탁하면 → 세 번 주고받기', LX, 166, { size: 20, weight: 700, color: COL.soft });
        HT.SHORT.forEach(([qid, ans], i) => {
          const y = 206 + i * 84, at = 0.8 + i * 1.6;
          fade(g, ramp(u, at, 0.4), () => { circ(g, LX + 6, y + 26, 16, COL.panel2); txt(g, String(i + 1), LX + 6, y + 27, { size: 15, weight: 700, fam: FM, color: COL.accent, align: 'center' }); });
          staff(g, qid, { x: LX + 30, y, w: 560, at, u, roleAt: at + 0.5, size: 20 });
          answer(g, { x: 640, y, w: 560, A: ans, at: at + 0.9, u, size: 22, verdict: { ok: true, at: at + 1.3 } });
        });
        fade(g, ramp(u, 6.4, 0.4), () => tag(g, '주고받기 3번', 1200, 470, COL.trap, { align: 'right' }));
        fade(g, ramp(u, 8.6, 0.4), () => txt(g, '전화 한 줄에 순서대로 넣으면?', LX, 486, { size: 22, weight: 800, fam: FD, color: COL.accent }));
      });
      const segs = HT.segs(a);
      if (lab || u >= 12.0) fade(g, lab ? 1 : ramp(u, 12.0, 0.4) * (1 - ramp(u, 23.8, 0.3)), () => {
        txt(g, '순서 → 인사 → 방 번호 → 부탁 틀 + 필요한 것 → please', LX, 160, { size: 18, weight: 700, color: COL.muted });
        const toks = ansToks(a), Ly = lay(g, toks, { x: LX, y: 236, size: 30, maxW: 1120 });
        const segOf = [];
        segs.forEach(s => s.t.split(/\s+/).filter(Boolean).forEach(w => { const m = w.match(/^(.*?)([.,?!]*)$/); if (m[1]) segOf.push(s); if (m[2]) m[2].split('').forEach(() => segOf.push(s)); }));
        let lastPart = null;
        Ly.items.forEach((it, k) => {
          const sg = segOf[k] || {}, on = lab || u >= 12.4 + k * 0.32;
          fade(g, on ? ramp(u, lab ? -9 : 12.4 + k * 0.32, 0.3) : 0, () => {
            drawTok(g, it, { next: Ly.items[k + 1] });
            if (sg.part && sg.part !== lastPart && !PUNCT.test(it.t)) {
              const cat = HT.CCAT[HT.CW[sg.part] ? HT.CW[sg.part].c : sg.part] || HT.CCAT[sg.part], col = { hi: COL.verb, room: COL.clause, ask: COL.rel, thing: COL.clause, please: COL.verb, thanks: COL.verb }[sg.part] || COL.soft;
              if (cat) txt(g, cat.ko, it.x, it.y - 34, { size: 14, weight: 700, color: col });
            }
          });
          lastPart = sg.part && !PUNCT.test(it.t) ? sg.part : PUNCT.test(it.t) ? lastPart : null;
        });
        say(Ly.x, 210, Ly.w, 52 + (Ly.lines - 1) * 45, HT.text(a));
        const ord = HT.callLine(L);
        if (lab) {
          const j = HT.judge('cl_help', a, C, '상황');
          mark(g, j.ok, Math.min(1226, Ly.x + Ly.w + 26), 236, 18);
          const R = richLay(g, why2(j), [], 17, 1120, { weight: 600 }); richDraw(g, R, LX, 300 + (Ly.lines - 1) * 45, { color: j.ok ? COL.good : COL.trap });
          void ord;
        } else fade(g, ramp(u, 16.4, 0.3), () => mark(g, true, Ly.x + Ly.w + 26, 236, 18));
      });
      if (lab) {
        const j = HT.judge('cl_help', a, C, '상황'), cov = j.ok ? HT.coveredKo(HT.covered(a, 'cl_help')) : [];
        txt(g, j.ok ? (cov.length ? `직원이 건너뛸 질문 → ${cov.join(' · ')}` : '필요한 것만 말했으니 직원이 방 번호를 다시 물어요') : '', LX, 540, { size: 18, weight: 700, color: cov.length ? COL.good : COL.soft });
        return;
      }
      // 객실 전화 (오른쪽)
      fade(g, ramp(u, 12.4, 0.5) * (1 - ramp(u, 23.8, 0.3)), () => phoneDraw(g, 940, 318, { s: 0.88, lift: 1, press: u < 17.8 ? '5' : null }));
      // 직원의 대답과 건너뛴 질문
      if (u >= 17.8) fade(g, ramp(u, 18.0, 0.4) * (1 - ramp(u, 23.8, 0.3)), () => {
        talk(g, { side: 'L', x: LX, y: 300, w: 900, text: 'Sure, I\'ll send them up right away.', marks: [['right away', 'ok']], kind: 'phone', sp: 'ca', at: 18.2, u, size: 24 });
        ['cl_room', 'cl_count'].forEach((qid, i) => fade(g, ramp(u, 19.8 + i * 0.7, 0.4), () => {
          const y = 420 + i * 58, q = HT.Q[qid];
          const R = richLay(g, q.en, Qm(q), 20, 600, { weight: 500 });
          panel(g, LX, y - 22, R.w + 40, 44, { fill: COL.panel, stroke: COL.faint, r: 22 });
          richDraw(g, R, LX + 20, y, { color: COL.dim, rolesOn: false });
          const p = clamp((u - 20.2 - i * 0.7) / 0.4); g.strokeStyle = COL.good; g.lineWidth = 2.6; g.beginPath(); g.moveTo(LX + 14, y + 1); g.lineTo(LX + 14 + (R.w + 12) * p, y + 1); g.stroke();
          chip(g, '건너뜀', LX + R.w + 54, y, { size: 14, weight: 700, color: '#10151C', fill: COL.good, h: 26, r: 13 });
        }));
      });
      if (u >= 23.8) fade(g, ramp(u, 24.0, 0.4) * (1 - ramp(u, 29.0, 0.3)), () => {
        const bad = { f: 'line', line: HT.LINE_BAD }, late = { f: 'line', line: HT.LINE_LATE }, ord = HT.callLine(HT.LINE_BAD), jl = HT.callLine(HT.LINE_LATE);
        txt(g, '순서가 어색하면', LX, 166, { size: 20, weight: 700, color: COL.soft });
        answer(g, { x: LX, y: 196, w: 1120, A: bad, at: 24.2, u, size: 24, trapAt: 25.0, strikeAt: 25.1 });
        fade(g, ramp(u, 25.4, 0.4), () => { const R = richLay(g, ord.why, [], 17, 1100, { weight: 600 }); richDraw(g, R, LX, 290, { color: COL.trap }); });
        answer(g, { x: LX, y: 380, w: 1120, A: late, at: 26.8, u, size: 24, verdict: { ok: true, at: 27.6 } });
        fade(g, ramp(u, 27.8, 0.4), () => { const R = richLay(g, jl.note, [], 17, 1100, { weight: 600 }); richDraw(g, R, LX, 470, { color: COL.rel }); });
      });
      if (u >= 29.0) fade(g, ramp(u, 29.2, 0.5), () => {
        txt(g, '수건 부탁 한 번에 주고받는 횟수', W / 2, 172, { size: 22, weight: 700, color: COL.soft, align: 'center' });
        const big = (n, x, c, l) => { txt(g, String(n), x, 300, { size: 120, weight: 800, fam: FD, color: c, align: 'center' }); txt(g, l, x, 392, { size: 20, weight: 700, color: COL.soft, align: 'center' }); };
        big(3, 380, COL.muted, '짧게 부탁하면');
        arrow(g, 500, 290, 760, 290, COL.accent, 4);
        big(1, 880, COL.good, '전화 한 줄로 말하면');
        fade(g, ramp(u, 30.8, 0.4), () => tag(g, '순서 규칙 = 자주 쓰는 순서를 단순하게 줄인 것', W / 2, 480, COL.muted, { align: 'center', size: 16 }));
      });
    },

    /* 09 3단계 말하기 법: 상자 셋 + 곳마다 한 줄이 단계별로 채워짐 */
    method(g, u) {
      const BOX = [['①', '열쇠 낱말 잡기', '무엇을 묻나 · 내가 먼저면 무엇을 부탁하나', COL.ante, 5.5], ['②', '틀에 내 정보 넣기', 'under + 성 · room + 번호 · 사실 + 부탁', COL.rel, 11.5], ['③', '공손하게 끝내기', 'Could I …? · Could you …, please? · I think', COL.verb, 17.5]];
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
      HT.METHOD.forEach(([qid, a], i) => {
        const y = 300 + i * 39, q = HT.Q[qid], p = HT.PLACE[q.place], dim = sel != null && sel !== i;
        fade(g, ramp(u, 1.4 + i * 0.3, 0.4) * (dim ? 0.35 : 1), () => {
          if (sel === i) { rr(g, LX - 6, y - 18, 1132, 36, 8); g.fillStyle = 'rgba(255,193,94,0.10)'; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 1.5; g.stroke(); }
          circ(g, LX + 14, y, 15, COL.panel2); icon(g, p.id, LX + 14, y, 18, ME_FIRST[p.id] ? COL.verb : COL.soft);
          const keysOn = sel != null || u >= 6.0 + i * 0.3, ansOn = sel != null || u >= 12.0 + i * 0.4, polOn = sel != null || u >= 18.0;
          const R = richLay(g, q.short || q.en, keysOn ? Qm(qid) : [], 17, 440, { weight: 500 });
          richDraw(g, R, LX + 44, y, { color: COL.soft });
          say(LX + 40, y - 16, R.w + 8, 32, q.en);
          if (ansOn) fade(g, sel != null ? 1 : ramp(u, 12.0 + i * 0.4, 0.4), () => {
            txt(g, '→', 556, y, { size: 18, weight: 700, color: COL.muted });
            pieces(g, ansParts(a).map(([t, r]) => [t, r === 'pol' && !polOn ? 'frame' : r]), 590, y, 18, 610);
            say(584, y - 16, 616, 32, HT.text(a));
          });
        });
      });
    },

    /* 10 실전: 숙박 카드 하나로 넷 */
    practice(g, u) {
      const pi = u < PSEG[1] ? 0 : u < PSEG[2] ? 1 : u < PSEG[3] ? 2 : 3, v = u - PSEG[pi];
      const P = HT.PRACTICE[pi], C = HT.PCARD, q = P.q === 'co_bill' ? HT.simQ('co_bill', C) : HT.Q[P.q];
      const a = ramp(v, 0, 0.5) * (pi < 3 ? 1 - ramp(u, PSEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `대화 ${pi + 1} / 4 · ${HT.PLACE[q.place].ko}`, LX, 150, { size: 16, weight: 500, fam: FM, color: COL.accent });
        const sc = stayCard(g, LX, 172, 330, C, { rh: 32, skip: [2, 3, 5], hl: { ci_nights: 1, bf_room: -1, pr_help: 4, co_bill: 1 }[P.q] });
        const room = { bf_room: COL.accent };
        fade(g, 1, () => { const y = 172 + sc.h + 26, on = !!room[P.q]; rr(g, LX, y - 18, 330, 36, 8); g.fillStyle = on ? 'rgba(255,193,94,0.14)' : COL.panel2; g.fill(); g.strokeStyle = on ? COL.accent : COL.faint; g.lineWidth = on ? 2 : 1.2; g.stroke(); icon(g, 'key', LX + 20, y, 18, on ? COL.accent : COL.soft); txt(g, `카드 키 봉투 · ROOM ${C.room} · ${HT.floorOf(C.room)}F`, LX + 40, y, { size: 15, weight: 700, fam: FM, color: on ? COL.accent : COL.soft }); });
        talk(g, { side: 'L', x: 432, y: 172, w: 768, text: q.en, marks: Qm(q), kind: kindOf(q), sp: q.sp, at: PT.q, u: v, roleAt: PT.lines[0] + 0.4, size: 22 });
        const J = P.opts.map(o => HT.judge(q, o, C));
        const goneAt = k => { const s = J[k].stage; if (!s) return null; const same = P.opts.map((_, i) => i).filter(i => J[i].stage === s); return [0, PT.s1, PT.s2, PT.s3][s] + same.indexOf(k) * 1.1; };
        P.opts.forEach((o, k) => {
          const y = 262 + k * 60, gA = goneAt(k), won = k === P.a && v >= PT.win;
          fade(g, ramp(v, PT.opt[k], 0.4), () => {
            if (won) { rr(g, 432, y - 24, 768, 48, 10); g.fillStyle = 'rgba(127,224,168,0.08)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
            txt(g, `(${'ABC'[k]})`, 446, y, { size: 18, weight: 500, fam: FM, color: gA != null && v >= gA ? COL.dim : COL.muted });
            const gone = gA != null && v >= gA;
            const parts = ansParts(o).map(([t, r]) => [t, gone ? 'dim' : (v >= PT.lines[1] + 0.4 || won) ? r : '']);
            const w = pieces(g, parts, 494, y, 19, 560, { color: gone ? COL.dim : COL.text });
            say(490, y - 18, w + 10, 36, HT.text(o));
            if (gone) { const p = clamp((v - gA) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(440, y + 1); g.lineTo(440 + (w + 64) * p, y + 1); g.stroke();
              fade(g, ramp(v, gA + 0.3, 0.3), () => tag(g, `${['', '①', '②', '③'][J[k].stage]} 탈락`, 1180, y, COL.trap, { align: 'right', size: 15, h: 30 })); }
            if (won) mark(g, true, 1170, y, 17);
          });
        });
        if (pi === 3) fade(g, ramp(v, 3.0, 0.4), () => { tag(g, `청구서 4박 · 숙박 카드 3박 → ${HT.money(q.total)}`, 1200, 431, COL.ante, { align: 'right', size: 15, h: 28 }); });
        panel(g, LX, 446, 1120, 128, { fill: COL.panel, stroke: COL.faint });
        const heads = ['① 열쇠 낱말', '② 틀 + 내 정보', '③ 공손 · 정답'];
        P.lines.forEach((ln, k) => fade(g, ramp(v, PT.lines[k] + 0.3, 0.5), () => {
          const y = 472 + k * 38;
          txt(g, heads[k], LX + 22, y, { size: 17, weight: 700, color: [COL.ante, COL.rel, COL.verb][k] });
          txt(g, ln, LX + 178, y, { size: fit(g, ln, 18, 920, 600), weight: 600, color: k === 2 && v >= PT.win ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 300, 640], Y0 = 152, RH = 41;
      const rows = [
        ['checkin', '체크인', 'reservation · spell · how many nights', [['I have a reservation under ', 'frame'], ['Kim', 'slot'], ['. · ', 'frame'], ['K-I-M', 'slot'], ['. · ', 'frame'], ['Two nights', 'slot'], ['.', 'frame']]],
        ['key', '방 열쇠 · 안내', 'room 1207 · seven to ten · anything else', [['Sorry', 'pol'], [', was that room ', 'frame'], ['1207', 'slot'], ['? · Is breakfast included?', 'frame']]],
        ['call', '전화 부탁', 'How can I help (내가 부탁할 차례)', [['Could I', 'pol'], [' get ', 'frame'], ['two extra towels', 'slot'], [', ', 'frame'], ['please', 'pol'], ['? · ', 'frame'], ['Could you', 'pol'], [' bring up …?', 'frame']]],
        ['problem', '문제 알리기', 'What can I do (사실 + 부탁)', [['The ', 'frame'], ['air conditioner', 'slot'], [' isn\'t working. ', 'frame'], ['Could you', 'pol'], [' send someone to look at it?', 'frame']]],
        ['breakfast', '조식 식당', 'room number · Coffee or tea', [['It\'s ', 'frame'], ['1207', 'slot'], ['. · ', 'frame'], ['Coffee', 'slot'], [', ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        ['concierge', '컨시어지', 'How can I help (부탁 + 시각)', [['Could you', 'pol'], [' hold my luggage until ', 'frame'], ['three', 'slot'], ['? · a wake-up call at ', 'frame'], ['6:30', 'slot']]],
        ['checkout', '체크아웃', 'Checking out · minibar · bill', [['Yes, room ', 'frame'], ['1207', 'slot'], ['. · No, nothing. · ', 'frame'], ['I think', 'pol'], [' there\'s a mistake on my bill.', 'frame']]],
        [null, '전화 한 줄', '인사 → 방 번호 → 부탁 → please', [['Hi', 'pol'], [', this is room ', 'frame'], ['1207', 'slot'], ['. ', 'frame'], ['Could I', 'pol'], [' get ', 'frame'], ['two extra towels', 'slot'], [', ', 'frame'], ['please', 'pol'], ['?', 'frame']]],
        [null, '못 알아들었을 때', '빠른 말 · 숫자 · 철자', [['Sorry', 'pol'], [', what time is breakfast? · ', 'frame'], ['Could you', 'pol'], [' spell that, ', 'frame'], ['please', 'pol'], ['?', 'frame']]],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 10, { fill: COL.panel, stroke: COL.faint });
        ['곳', '열쇠 낱말', '대답 틀 · 부탁 틀'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 16, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 6, 1120, 1);
      });
      rows.forEach(([pid, nm, keys, ans], ri) => fade(g, ramp(u, 1.0 + ri * 0.4, 0.5), () => {
        const y = Y0 + RH * (ri + 1) + 14;
        circ(g, X[0] + 32, y, 15, COL.panel2);
        if (pid) icon(g, pid, X[0] + 32, y, 18, ME_FIRST[pid] ? COL.verb : COL.soft);
        else txt(g, ri === 7 ? '+' : '?', X[0] + 32, y + 1, { size: 18, weight: 800, color: COL.verb, align: 'center' });
        txt(g, nm, X[0] + 58, y, { size: fit(g, nm, 18, X[1] - X[0] - 70, 700), weight: 700 });
        txt(g, keys, X[1] + 20, y, { size: fit(g, keys, 16, X[2] - X[1] - 34, 600), weight: 600, color: COL.ante });
        pieces(g, ans, X[2] + 20, y, 17, 1196 - X[2] - 30);
      }));
    },
  };

  // 이어서 들리는 말: 위 = 쓰인 낱말 (이어지는 곳은 호), 아래 = 들리는 소리 (세게 = 크고 높게)
  function linked(g, L, x, y, u, at) {
    fade(g, ramp(u, at, 0.4), () => {
      const size = 30, gap = 22; let xx = x; const pos = [];
      L.words.forEach(w => { const ww = tw(g, w, size, 600); pos.push([xx, ww]); xx += ww + gap; });
      L.words.forEach((w, i) => { txt(g, w, pos[i][0], y, { size, weight: 600, color: COL.en }); });
      listen(x - 6, y - 24, xx - x, 48, [{ text: L.say || L.en, sp: 'us', rate: 1.2 }]);
      fade(g, ramp(u, at + 0.6, 0.4), () => L.link.forEach(([a, b]) => {
        const x1 = pos[a][0] + pos[a][1] - 6, x2 = pos[b][0] + 6;
        g.strokeStyle = COL.accent; g.lineWidth = 3; g.beginPath(); g.moveTo(x1, y + 22); g.quadraticCurveTo((x1 + x2) / 2, y + 44, x2, y + 22); g.stroke();
      }));
      let sx = x; const sy = y + 96;
      L.sound.forEach(([s, big], i) => fade(g, ramp(u, at + 1.0 + i * 0.25, 0.3), () => {
        const sz = big ? 32 : 22, w = tw(g, s, sz, big ? 800 : 500) + 24, h = big ? 64 : 42;
        rr(g, sx, sy - h, w, h, 10); g.fillStyle = big ? 'rgba(255,193,94,0.22)' : 'rgba(238,241,244,0.07)'; g.fill(); g.strokeStyle = big ? COL.accent : COL.line; g.lineWidth = 1.8; g.stroke();
        txt(g, s, sx + w / 2, sy - h / 2, { size: sz, weight: big ? 800 : 500, color: big ? COL.accent : COL.soft, align: 'center' });
        sx += w + 6;
      }));
      fade(g, ramp(u, at + 1.6, 0.4), () => txt(g, L.ko, x, sy + 30, { size: 18, weight: 600, color: COL.soft }));
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

  HTS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[HTS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    if (ch.place != null) strip(g, Array.isArray(ch.place) ? (u < (ch.placeAt || 6) ? ch.place[0] : ch.place[1]) : ch.place, ramp(u, 0.2, 0.5));
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, HTS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + HT.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔✓×?!~=+-–/:…‘’\'%$';
  HTS.baseText = EXTRA;
  HTS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = HTS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { HTS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
