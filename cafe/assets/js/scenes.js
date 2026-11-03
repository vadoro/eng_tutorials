/* 카페 회화 — 영상 장면
 *
 * CFS.render(g, t)는 시각 t와 사용자 상태 CFS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준, 내용은 y 580 위.
 *
 * 그림 말: 카페 주문 길(일곱 단계, 01장은 가게 평면도로 크게 · 02–07장은 위쪽 작은 띠), 말풍선(바리스타 왼쪽 · 손님 오른쪽),
 * 대답은 틀(노랑) + 내 정보(민트) 낱말 조각으로 만들고(lay · morph), 함정은 줄을 긋고 주황 이름표로 까닭을 붙여요.
 * 메뉴판 · 컵 · 영수증 · 카드 단말기는 도형으로 그려요. 값은 모두 grammar.js의 CF.price로 계산해요.
 * 역할 색: 열쇠 낱말 하늘 · 대답 틀 노랑 · 내 정보(칸에 넣는 말) 민트 · 공손한 말 보라 · 함정 주황 · 빈칸 분홍 점선
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(CF.judge · CF.orderLine)으로 정합니다.
 * MP4에는 소리가 없어서, 말은 말풍선 속 낱말이 하나씩 나타나는 모습으로 그려요. 페이지에서는 말풍선을 누르면 그 사람 목소리로 들려줘요.
 */
(function () {
  'use strict';
  const CF = window.CF;
  const CFS = (window.CFS = {});
  const W = 1280, H = 720;
  CFS.W = W; CFS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));   // a에 나타나 b에 사라짐
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  CFS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', paper: '#F4F1E8', ink: '#1E2630', coffee: '#5A3A28', wood: '#3A2E25',
  };
  CFS.COL = COL;
  // 역할 → 색 (낱말 조각 · 말풍선 글)
  const RC = { key: COL.ante, frame: COL.rel, slot: COL.clause, pol: COL.verb, trap: COL.trap, ok: COL.good, dim: COL.dim, bad: COL.bad };
  CFS.RC = RC;
  const SPC = { us: '#6EC8FF', gb: '#C9A7FF', au: '#FFC15E', ca: '#7FE0A8', me: '#F2C29A' };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (CFS.S = { stop: null, ord: null, cup: null, chg: null, pay: null, req: null, line: null, place: null });
  CFS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  CFS.hits = () => HITS;

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
    door: [['M6.5 21V3.5h11V21M3.5 21h17', 's'], ['M14.5 12.5h.01', 's']],
    counter: [['M4 3.5h16v10H4z', 's'], ['M7 7h6.5M7 10h4.5M16 7h1.2M16 10h1.2', 's'], ['M2.5 17.5h19M5 17.5v3.5M19 17.5v3.5', 's']],
    size: [['M2.8 13.5h4.4l-.6 7H3.4z', 's'], ['M9 10.5h5.6l-.8 10h-4z', 's'], ['M16.2 6.5h6l-1 14h-4z', 's']],
    option: [['M4 9.5 6 6.5h5l2 3V21H4z', 's'], ['M4 9.5h9M6 6.5V3.5h5v3', 's'], ['M15.5 13h5.5l-.7 8h-4.1z', 's'], ['M16 16.5h4.6', 's']],
    name: [['M6.5 6.5h11l-1.3 14.5H7.8z', 's'], ['M5.5 4h13v2.5h-13z', 's'], ['M7.2 11h9.6l-.4 5H7.6z', 's'], ['M9.2 13.5h3.5', 's']],
    pay: [['M7 3h10a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 17 21H7a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 7 3z', 's'], ['M8.5 6h7v5h-7z', 's'], ['M9 14.5h.01M12 14.5h.01M15 14.5h.01M9 17.5h.01M12 17.5h.01M15 17.5h.01', 's']],
    pickup: [['M7.5 5.5h7l-1 10h-5z', 's'], ['M6.8 3.5h8.4v2H6.8z', 's'], ['M2.5 18h19M4.5 18v3M19.5 18v3', 's'], ['M17.5 7.5l2.5-1.5M18 11h3', 's']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z', 's'], ['M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6', 's']],
    hot: [['M8 20c-1.6-2.2 1.6-3.6 0-6s1.6-3.8 0-6M12 20c-1.6-2.2 1.6-3.6 0-6s1.6-3.8 0-6M16 20c-1.6-2.2 1.6-3.6 0-6s1.6-3.8 0-6', 's']],
    iced: [['M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9', 's'], ['M9.6 4.6 12 6.4l2.4-1.8M9.6 19.4 12 17.6l2.4 1.8', 's']],
    receipt: [['M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z', 's'], ['M9 8h6M9 11.5h6M9 15h3.5', 's']],
    card: [['M3 6.5h18v11H3z', 's'], ['M3 10h18M6 14.5h4', 's']],
    bag: [['M5 8h14l-1.2 13H6.2z', 's'], ['M9 8V6a3 3 0 0 1 6 0v2', 's']],
    table: [['M3 9h18M6 9v11M18 9v11', 's'], ['M10 5.5h4l-.5 3.5h-3z', 's']],
  };
  CFS.ICON = ICON;
  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = (typeof Path2D === 'function' ? new Path2D(d) : null));
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const parts = ICON[id]; if (!parts) return;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    parts.forEach(([d, m]) => { const p = path(d); if (!p) return; if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  CFS.icon = icon;
  // HTML용 SVG (색은 currentColor)
  CFS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 사람 얼굴 (말풍선 옆). kind: barista · barista2 · me ---------- */
  const LOOK = {
    barista: { shirt: '#3B4350', apron: '#B9733F', hair: '#2E241E', skin: '#E3B48D', cap: '#2B2F36' },
    barista2: { shirt: '#2F3B36', apron: '#7FA88E', hair: '#5A3A28', skin: '#C99169', bun: true },
    me: { shirt: '#5D6FA8', hair: '#1F1B18', skin: '#E8BC95', pack: '#3A2C22' },
  };
  function avatar(g, x, y, r, kind, o = {}) {
    const L = LOOK[kind] || LOOK.barista;
    circ(g, x, y, r, COL.panel2);
    g.save(); g.beginPath(); g.arc(x, y, r - 1, 0, Math.PI * 2); g.clip();
    // 어깨 · 앞치마
    g.fillStyle = L.shirt; g.beginPath(); g.ellipse(x, y + r * 0.98, r * 0.8, r * 0.58, 0, 0, Math.PI * 2); g.fill();
    if (L.apron) {
      g.fillStyle = L.apron; rr(g, x - r * 0.34, y + r * 0.5, r * 0.68, r * 0.7, r * 0.08); g.fill();
      g.strokeStyle = L.apron; g.lineWidth = r * 0.07; g.beginPath(); g.moveTo(x - r * 0.3, y + r * 0.52); g.lineTo(x - r * 0.12, y + r * 0.32); g.moveTo(x + r * 0.3, y + r * 0.52); g.lineTo(x + r * 0.12, y + r * 0.32); g.stroke();
    }
    if (L.pack) { g.strokeStyle = L.pack; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - r * 0.42, y + r * 0.45); g.lineTo(x - r * 0.5, y + r); g.moveTo(x + r * 0.42, y + r * 0.45); g.lineTo(x + r * 0.5, y + r); g.stroke(); }
    // 목 · 머리
    g.fillStyle = L.skin; g.fillRect(x - r * 0.1, y + r * 0.18, r * 0.2, r * 0.22);
    circ(g, x, y - r * 0.08, r * 0.34, L.skin);
    g.fillStyle = L.hair; g.beginPath(); g.arc(x, y - r * 0.12, r * 0.36, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
    if (L.bun) circ(g, x, y - r * 0.5, r * 0.13, L.hair);
    if (L.cap) { g.fillStyle = L.cap; g.beginPath(); g.arc(x, y - r * 0.18, r * 0.37, Math.PI, 0); g.closePath(); g.fill(); g.fillRect(x - r * 0.04, y - r * 0.24, r * 0.5, r * 0.08); }
    circ(g, x - r * 0.12, y - r * 0.04, r * 0.035, '#2B2420'); circ(g, x + r * 0.12, y - r * 0.04, r * 0.035, '#2B2420');
    g.strokeStyle = 'rgba(120,60,40,0.6)'; g.lineWidth = Math.max(1, r * 0.045); g.beginPath(); g.arc(x, y + r * 0.06, r * 0.1, 0.35, Math.PI - 0.35); g.stroke();
    g.restore();
    ring(g, x, y, r, o.live ? (SPC[o.sp] || COL.soft) : COL.faint, o.live ? 2.6 : 1.5);
    if (o.live) { g.save(); g.globalAlpha *= 0.45; ring(g, x, y, r + 5, SPC[o.sp] || COL.soft, 2); g.restore(); }
  }
  CFS.avatar = avatar;

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
  // y = 첫 줄의 가운데. o: { color, shown: 보이는 낱말 수, rolesOn, plain }
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
  CFS.richLay = richLay; CFS.richDraw = richDraw;

  /* ---------- 낱말 조각 (대답 만들기): { id, t, r } → lay · morph · drawTok ---------- */
  const PUNCT = /^[.,?!]$/;
  // 대답 → 조각. 같은 낱말은 같은 id라 다른 대답으로 바뀔 때 미끄러져요
  function ansToks(a, o = {}) {
    const out = [], seen = {};
    const push = (t, r) => { const k = t.toLowerCase(); seen[k] = seen[k] || 0; out.push({ id: k + '#' + seen[k]++, t, r }); };
    CF.segs(a).forEach(s => s.t.split(/\s+/).forEach(w => {
      if (!w) return;
      const m = w.match(/^(.*?)([.,?!]*)$/);
      if (m[1]) push(m[1], o.role != null ? o.role : s.r);
      if (m[2]) m[2].split('').forEach(p => push(p, ''));
    }));
    return out;
  }
  CFS.ansToks = ansToks;
  // 글 → 조각 (모두 같은 역할)
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
        // 같은 역할의 다음 조각까지 밑줄을 이어 그림 (빈틈 없이)
        const nx = o.next;
        g.fillStyle = c; g.fillRect(x, y + size * 0.58, nx && nx.r === r && !PUNCT.test(nx.t) && Math.abs(nx.y - y) < 1 ? nx.x - x : w, 2.6);
      }
    }
    g.restore();
  }
  function drawLay(g, L, style) { L.items.forEach((it, k) => drawTok(g, it, Object.assign({ next: L.items[k + 1] }, style ? style(it) || {} : {}))); }
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
  function bubbleShape(g, side, bx, by, bw, bh, ax, ay, fill, stroke) {
    rr(g, bx, by, bw, bh, 16); g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke();
    const tx = side === 'L' ? bx : bx + bw, ty = clamp(ay, by + 14, by + bh - 10), d = side === 'L' ? -1 : 1;
    g.beginPath(); g.moveTo(tx, ty - 8); g.lineTo(tx + d * 11, ty); g.lineTo(tx, ty + 7); g.closePath(); g.fillStyle = fill; g.fill();
    g.beginPath(); g.moveTo(tx, ty - 8); g.lineTo(tx + d * 11, ty); g.lineTo(tx, ty + 7); g.strokeStyle = stroke; g.stroke();
    g.fillStyle = fill; g.fillRect(tx - (side === 'L' ? 0 : 2), ty - 7, 2, 13);
  }
  const FILL = { L: '#18222D', R: '#1A2622' }, EDGE = { L: 'rgba(110,200,255,0.38)', R: 'rgba(242,194,154,0.42)' };
  /* 바리스타 · 손님의 한 마디 (글 말풍선)
   * o: { side: 'L' | 'R', x, y, w(칸 폭), text, marks, kind, sp, at, u, size, roleAt, fast, slow, all, strike, tag: [글, 색], verdict: { ok, at } }
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
      avatar(g, ax, ay, ar, o.kind || (side === 'L' ? 'barista' : 'me'), { live, sp: o.sp });
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
  CFS.talk = talk;
  /* 손님의 대답 (낱말 조각 말풍선, 두 대답 사이를 morph)
   * o: { x, y, w, A: 대답, B: 다음 대답, p: 0→1, at, u, size, strikeAt, verdict: { ok, at }, tag: [글, 색, at, 사라짐], trapAt, toksA }
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
    const said = LB && p > 0.5 ? (o.sayB || (o.B ? CF.text(o.B) : null)) : (o.sayA || (o.A ? CF.text(o.A) : null));
    if (!o.noHit && said) listen(bx, by, bw, bh, [{ text: said, sp: 'me' }]);
    return out;
  }
  CFS.answer = answer;

  /* ---------- 주문 길 띠 (02–07장 위쪽) ---------- */
  function strip(g, cur, a = 1) {
    fade(g, a, () => {
      const x0 = 812, dx = 64, y = 92;
      g.strokeStyle = COL.faint; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 6, y); g.stroke();
      CF.PLACES.forEach((p, i) => {
        const x = x0 + i * dx, on = i === cur;
        circ(g, x, y, on ? 19 : 14, on ? COL.accent : i < cur ? '#2A3542' : COL.panel);
        ring(g, x, y, on ? 19 : 14, on ? COL.accent : COL.faint, 1.5);
        icon(g, p.id, x, y, on ? 22 : 16, on ? '#1D1305' : i < cur ? COL.soft : COL.muted, on ? 2 : 1.8);
      });
      txt(g, `${cur + 1} / 7`, x0 + dx * 6 + 30, y, { size: 13, weight: 500, fam: FM, color: COL.muted });
    });
  }

  /* =========================================================
     카페 그림: 컵 · 메뉴판 · 영수증 · 카드 단말기 · 주문 카드
     ========================================================= */
  const DRINKC = { americano: '#3A271C', latte: '#C8A07A', cappuccino: '#B3895F', mocha: '#6E4530', chai: '#C2915F' };
  // 컵 (바닥 가운데 cx, by). o: { size, temp, drink, s, label: [줄…], name, steam, u, room }
  function cupDraw(g, cx, by, o = {}) {
    const s = (o.s || 1) * (o.size === 'large' ? 1.18 : o.size === 'small' ? 0.82 : 1);
    const tw2 = 74 * s, bw2 = 52 * s, h = 124 * s;
    g.save(); g.translate(cx, by);
    const body = () => { g.beginPath(); g.moveTo(-tw2 / 2, -h); g.lineTo(tw2 / 2, -h); g.lineTo(bw2 / 2, 0); g.lineTo(-bw2 / 2, 0); g.closePath(); };
    if (o.temp === 'iced') {
      body(); g.fillStyle = 'rgba(220,235,245,0.10)'; g.fill();
      g.save(); body(); g.clip();
      g.fillStyle = DRINKC[o.drink] || DRINKC.latte; g.globalAlpha *= 0.82; g.fillRect(-tw2, -h * (o.room ? 0.66 : 0.86), tw2 * 2, h * 2);
      g.globalAlpha = 1;
      [[-14, -0.78, 20], [8, -0.7, 18], [-4, -0.55, 19], [14, -0.48, 16], [-16, -0.38, 17]].forEach(([dx, fy, sz]) => { rr(g, dx * s - sz * s / 2, h * fy - sz * s / 2, sz * s, sz * s, 4 * s); g.fillStyle = 'rgba(240,248,255,0.38)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; g.stroke(); });
      g.restore();
      body(); g.strokeStyle = 'rgba(225,238,248,0.65)'; g.lineWidth = 2; g.stroke();
      rr(g, -tw2 / 2 - 4 * s, -h - 7 * s, tw2 + 8 * s, 8 * s, 3 * s); g.fillStyle = 'rgba(225,238,248,0.75)'; g.fill();
      g.strokeStyle = '#E6DFD2'; g.lineWidth = 6 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(8 * s, -h - 4 * s); g.lineTo(16 * s, -h - 46 * s); g.stroke();
    } else {
      body(); g.fillStyle = '#F1ECE2'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.5; g.stroke();
      g.save(); body(); g.clip(); g.fillStyle = '#A9784D'; g.fillRect(-tw2, -h * 0.6, tw2 * 2, h * 0.3); g.restore();
      rr(g, -tw2 / 2 - 5 * s, -h - 11 * s, tw2 + 10 * s, 12 * s, 5 * s); g.fillStyle = '#E2DACB'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.2; g.stroke();
      rr(g, -tw2 / 2 + 8 * s, -h - 18 * s, tw2 - 16 * s, 9 * s, 4 * s); g.fillStyle = '#D6CDBC'; g.fill();
      if (o.steam) { g.strokeStyle = 'rgba(238,241,244,0.45)'; g.lineWidth = 2.4; g.lineCap = 'round'; [-14, 0, 14].forEach((dx, k) => { const ph = ((o.u || 0) * 0.8 + k * 0.3) % 1, y0 = -h - 24 * s - ph * 10; g.beginPath(); g.moveTo(dx * s, y0); g.bezierCurveTo(dx * s - 8, y0 - 10, dx * s + 8, y0 - 18, dx * s, y0 - 28); g.stroke(); }); }
    }
    if (o.room) { g.setLineDash([4, 4]); g.strokeStyle = COL.gap; g.lineWidth = 2; g.beginPath(); g.moveTo(-tw2 / 2 + 5, -h * 0.66); g.lineTo(tw2 / 2 - 5, -h * 0.66); g.stroke(); g.setLineDash([]); }
    if (o.label || o.name) {
      const lw = tw2 * 0.86, lh = (o.name ? 22 : 12) * s + (o.label ? o.label.length : 0) * 11 * s, ly = o.temp === 'iced' ? -h * 0.4 : -h * 0.95;
      rr(g, -lw / 2, ly, lw, lh, 3); g.fillStyle = '#FFFFFF'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1; g.stroke();
      let yy = ly + 8 * s;
      (o.label || []).forEach(l => { if (l) txt(g, l, 0, yy, { size: fit(g, l, 8.5 * s, lw - 6, 700, 6, FM), weight: 700, fam: FM, color: COL.ink, align: 'center' }); yy += 11 * s; });
      if (o.name) txt(g, o.name, 0, yy + 3 * s, { size: fit(g, o.name, 14 * s, lw - 6, 700, 7, FD), weight: 800, fam: FD, color: '#B8432B', align: 'center' });
    }
    g.restore();
    return { top: by - h - (o.temp === 'iced' ? 46 : 18) * s, h };
  }
  CFS.cupDraw = cupDraw;

  // 메뉴판 (x, y 왼쪽 위, 폭 w). o: { hl: { 'latte_medium': 색, 'oat': 색 }, sc } → 칸 위치 { id: { x, y, w, h } }
  function menuBoard(g, x, y, w, o = {}) {
    const s = w / 400, boxes = {}, hl = o.hl || {};
    g.save(); g.translate(x, y); g.scale(s, s);
    rr(g, 0, 0, 400, 300, 14); g.fillStyle = '#5A4632'; g.fill();
    rr(g, 8, 8, 384, 284, 10); g.fillStyle = '#1C2622'; g.fill();
    txt(g, CF.CAFE.toUpperCase() + ' · MENU', 200, 32, { size: 16, weight: 700, fam: FM, color: '#F2E6C9', align: 'center' });
    const cols = [236, 290, 344];
    ['S', 'M', 'L'].forEach((c, i) => txt(g, c, cols[i], 62, { size: 15, weight: 700, fam: FM, color: '#BFD6CC', align: 'center' }));
    Object.entries(CF.MENU).forEach(([id, m], r) => {
      const yy = 92 + r * 30;
      txt(g, m.en, 24, yy, { size: 16, weight: 600, color: '#F2E6C9' });
      m.p.forEach((c, i) => {
        const key = `${id}_${CF.SIZES[i]}`, col = hl[key];
        if (col) { rr(g, cols[i] - 26, yy - 13, 52, 26, 6); g.fillStyle = col + '40'; g.fill(); g.strokeStyle = col; g.lineWidth = 2.5; g.stroke(); }
        txt(g, (c / 100).toFixed(2), cols[i], yy, { size: 15, weight: 600, fam: FM, color: col || '#E8DDBF', align: 'center' });
        boxes[key] = { x: x + (cols[i] - 26) * s, y: y + (yy - 13) * s, w: 52 * s, h: 26 * s };
      });
    });
    g.fillStyle = 'rgba(242,230,201,0.2)'; g.fillRect(24, 236, 352, 1);
    const ex = Object.entries(CF.EXTRA);
    ex.forEach(([id, m], i) => {
      const xx = 24 + i * 180, col = hl[id];
      if (col) { rr(g, xx - 6, 246, 168, 24, 6); g.fillStyle = col + '40'; g.fill(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); }
      txt(g, `+ ${m.en} ${(m.p / 100).toFixed(2)}`, xx, 258, { size: 13, weight: 600, fam: FM, color: col || '#BFD6CC' });
      boxes[id] = { x: x + (xx - 6) * s, y: y + 246 * s, w: 168 * s, h: 24 * s };
    });
    txt(g, Object.values(CF.FOOD).map(f => `${f.en} ${(f.p / 100).toFixed(2)}`).join(' · '), 200, 280, { size: 12, weight: 500, fam: FM, color: '#9FB3AA', align: 'center' });
    g.restore();
    return boxes;
  }
  CFS.menuBoard = menuBoard;

  // 영수증 (x, y 왼쪽 위, 폭 w). order → CF.price. o: { shown: 보이는 줄 수, pay }
  function receiptDraw(g, x, y, w, order, o = {}) {
    const P = CF.price(order), n = P.items.length, h = 120 + n * 30 + 60;
    const shown = o.shown == null ? 99 : o.shown;
    g.save();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h);
    const zz = 14; for (let k = 0; k <= Math.round(w / zz); k++) g.lineTo(x + w - k * zz, y + h + (k % 2 ? 7 : 0));
    g.lineTo(x, y + h); g.closePath(); g.fillStyle = COL.paper; g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 16; g.shadowOffsetY = 6; g.fill(); g.restore();
    txt(g, CF.CAFE.toUpperCase(), x + w / 2, y + 30, { size: 18, weight: 700, fam: FM, color: COL.ink, align: 'center' });
    g.setLineDash([4, 4]); g.strokeStyle = 'rgba(30,38,48,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 18, y + 54); g.lineTo(x + w - 18, y + 54); g.stroke(); g.setLineDash([]);
    P.items.forEach((it, k) => fade(g, clamp(shown - k), () => {
      const yy = y + 78 + k * 30;
      txt(g, it.en, x + 20, yy, { size: fit(g, it.en, 16, w - 120, 600, 10, FM), weight: 600, fam: FM, color: COL.ink });
      txt(g, CF.money(it.c), x + w - 20, yy, { size: 16, weight: 600, fam: FM, color: COL.ink, align: 'right' });
    }));
    fade(g, clamp(shown - n), () => {
      const yy = y + 78 + n * 30;
      g.fillStyle = 'rgba(30,38,48,0.5)'; g.fillRect(x + 18, yy - 8, w - 36, 1.5);
      txt(g, 'TOTAL', x + 20, yy + 18, { size: 19, weight: 700, fam: FM, color: COL.ink });
      txt(g, CF.money(P.total), x + w - 20, yy + 18, { size: 22, weight: 700, fam: FM, color: '#B8432B', align: 'right' });
      if (o.pay) txt(g, o.pay === 'card' ? 'PAID BY CARD · THANK YOU!' : 'PAID IN CASH · THANK YOU!', x + w / 2, yy + 52, { size: 12, weight: 500, fam: FM, color: '#5B6168', align: 'center' });
    });
    return { h: h + 7, total: P.total };
  }
  CFS.receiptDraw = receiptDraw;

  // 카드 단말기 (x, y 왼쪽 위). o: { amount, state: 'tap' | 'ok' | 'tip', tap: 0→1 }
  function reader(g, x, y, o = {}) {
    rr(g, x, y, 170, 260, 22); g.fillStyle = '#262C33'; g.fill(); g.strokeStyle = '#3A434D'; g.lineWidth = 2; g.stroke();
    rr(g, x + 16, y + 18, 138, 112, 10); g.fillStyle = o.state === 'ok' ? '#DFF3E6' : '#E8EEF2'; g.fill();
    if (o.state === 'tip') {
      txt(g, 'Add a tip?', x + 85, y + 38, { size: 15, weight: 700, color: COL.ink, align: 'center' });
      [0, 1, 2].forEach(k => { rr(g, x + 26 + k * 42, y + 56, 34, 26, 6); g.fillStyle = '#C9D3DB'; g.fill(); });
      rr(g, x + 26, y + 90, 118, 26, 6); g.fillStyle = '#C9D3DB'; g.fill();
      txt(g, 'No tip', x + 85, y + 103, { size: 13, weight: 600, color: COL.ink, align: 'center' });
    } else {
      txt(g, o.amount || '', x + 85, y + 48, { size: 26, weight: 700, fam: FM, color: COL.ink, align: 'center' });
      txt(g, o.state === 'ok' ? 'APPROVED' : 'TAP CARD', x + 85, y + 82, { size: 14, weight: 700, fam: FM, color: o.state === 'ok' ? '#1F7A55' : '#5B6168', align: 'center' });
      if (o.state !== 'ok') { g.strokeStyle = '#5B6168'; g.lineWidth = 2; g.lineCap = 'round'; [8, 14, 20].forEach(r => { g.beginPath(); g.arc(x + 85, y + 110, r, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); }); }
      else check(g, x + 85, y + 108, 18, '#1F7A55');
    }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { rr(g, x + 30 + c * 40, y + 148 + r * 32, 30, 22, 5); g.fillStyle = '#3A434D'; g.fill(); }
    if (o.tap != null && o.tap > 0) {
      const p = ease(clamp(o.tap)), cx = lerp(x + 260, x + 100, p), cy = lerp(y + 30, y + 60, p);
      g.save(); g.translate(cx, cy); g.rotate(-0.25);
      rr(g, -50, -32, 100, 64, 8); g.fillStyle = '#3D6FD6'; g.fill(); g.fillStyle = '#E8C35A'; rr(g, -36, -12, 18, 14, 3); g.fill();
      g.restore();
      if (p > 0.8) { g.strokeStyle = COL.ante; g.lineWidth = 2.5; [0, 1, 2].forEach(k => { g.beginPath(); g.arc(x + 85, y + 20, 16 + k * 10, Math.PI * 1.15, Math.PI * 1.85); g.globalAlpha = (1 - k * 0.3) * clamp((p - 0.8) * 5); g.stroke(); }); g.globalAlpha = 1; }
    }
  }

  // 주문 카드 (시뮬레이터와 같은 칸)
  function orderCard(g, x, y, w, card, o = {}) {
    const rows = CF.cardRows(card).filter((_, i) => !o.skip || !o.skip.includes(i)), rh = o.rh || 36, h = 58 + rows.length * rh + 10, pos = [];
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, 14); g.fillStyle = COL.paper; g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, 14); g.clip(); g.fillStyle = COL.coffee; g.fillRect(x, y, w, 46); g.restore();
    icon(g, 'name', x + 26, y + 23, 24, '#FFFFFF');
    txt(g, o.title || '주문 카드 · ORDER CARD', x + 46, y + 24, { size: 17, weight: 700, color: '#FFFFFF' });
    const all = CF.cardRows(card);
    rows.forEach(([k, v], i) => {
      const yy = y + 58 + i * rh + rh / 2, hl = o.hl === all.findIndex(r => r[0] === k);
      if (hl) { rr(g, x + 8, yy - rh / 2 + 3, w - 16, rh - 6, 8); g.fillStyle = 'rgba(31,122,85,0.16)'; g.fill(); g.strokeStyle = '#1F7A55'; g.lineWidth = 2.5; g.stroke(); }
      txt(g, k, x + 20, yy, { size: 15, weight: 600, color: '#5B6168' });
      txt(g, v, x + 104, yy, { size: fit(g, v, 17, w - 120, 700), weight: 700, color: hl ? '#14623F' : COL.ink });
      pos.push({ x: x + 8, y: yy, w: w - 16 });
    });
    return { h, rows: pos };
  }
  CFS.orderCard = orderCard;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 화면용 기호(곱하기 표)는 자막에 쓰지 않음
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '카페 회화 · 주문에는 순서가 있다', d: 26, caps: [
      [0.4, 5, '카페 주문대에서 듣는 질문은 거의 같고, **순서**도 거의 정해져 있어요.'],
      [5, 10.5, '바리스타가 물어요 → Hi! What can I get you? 무엇을 주문할지 묻는 말이에요.'],
      [10.5, 16, '한국어로 먼저 생각해 옮기면 → Give me one ice americano. 명령처럼 들리고 낱말도 어색해요.'],
      [16, 21, '자연스러운 주문 → Can I get an iced americano? 차가운 음료는 iced, 그 앞에는 an.'],
      [21, 26, '**열쇠 낱말** 잡기, **대답 틀**에 내 정보 넣기, **공손하게** 끝내기. 순서를 알면 다음 질문도 들려요.'],
    ] },
    { id: 'route', n: '01', title: '주문 길 지도', sub: '일곱 단계 · 단계마다 질문 한두 개', d: 30, caps: [
      [0.4, 6, '카페 주문 길은 일곱 단계예요. 문으로 들어가 줄을 서고, 메뉴판을 보며 주문해요.'],
      [6, 12, '그다음 → 크기와 온도, 옵션, 이름과 포장, 계산대, 그리고 픽업대에서 음료를 받아요.'],
      [12, 18, '단계마다 듣는 질문은 한두 개뿐이에요. 크기 → What size? 포장 → For here or to go?'],
      [18, 24, '순서를 알면 다음 질문을 **미리** 알 수 있어요. 빠르게 말해도 들리는 까닭이에요.'],
      [24, 30, '질문과 순서는 가게와 나라마다 조금씩 달라요. 여기서는 어디서나 자주 듣는 흐름을 골랐어요.'],
    ] },
    { id: 'order', n: '02', title: '인사와 주문', sub: 'Menu · Order · Can I get …? · a · an · iced', d: 34, place: [0, 1], caps: [
      [0.4, 6, '줄 맨 앞에 서면 → Are you ready to order? 아직 고르는 중이면 → Not yet. Just a minute, please.'],
      [6, 11.5, 'What can I get you? → 무엇을 주문할지 물어요. 대답 틀 → Can I get + 음료?'],
      [11.5, 17, '같은 뜻의 질문 → What would you like? 다른 틀로 → I\'d like + 음료, please.'],
      [17, 23, '음료 한 잔 앞에는 **a**. 모음 소리로 시작하는 말 앞에서는 **an** → a latte, an americano, an iced latte.'],
      [23, 28.5, '아이스 아메리카노를 그대로 옮기면 → an ice americano. 얼음을 넣어 차갑게 만든 음료 → iced.'],
      [28.5, 34, 'Give me one americano. I want a latte. 명령하거나 조르는 말처럼 들려요. 주문은 → Can I get …?'],
    ] },
    { id: 'size', n: '03', title: '크기와 온도', sub: 'Size · Hot or iced · 고르기 질문', d: 32, place: 2, caps: [
      [0.4, 6, '다음은 크기. What size? → 고른 크기 + please → Medium, please. 문장 전체가 아니어도 돼요.'],
      [6, 12, 'Hot or iced? → 둘 가운데 고르라는 말이에요. 아이스를 그대로 옮긴 Ice 대신 → Iced, please.'],
      [12, 18, '고르기 질문의 열쇠 낱말 → or. 고른 것을 말해야 해요. Yes, please. → 무엇을 골랐는지 몰라요.'],
      [18, 24.5, '크기 이름은 가게마다 달라요. 흔한 이름 → small, medium, large. 낯설면 컵을 가리키며 → This one, please.'],
      [24.5, 31.5, '‘사이즈업’은 한국에서 만든 말이에요. 이미 주문한 음료를 키우려면 → Can I make it a large?'],
    ] },
    { id: 'option', n: '04', title: '옵션', sub: 'Options · 우유 · 샷 · with · No …', d: 36, place: 3, caps: [
      [0.4, 6, '옵션. What kind of milk? → 우유 종류를 고르라는 말 → Oat milk, please.'],
      [6, 12, 'Would you like an extra shot? → 샷을 더 넣을지 권하는 말. 원하면 → Yes, please. 아니면 → No, thanks.'],
      [12, 18, '‘샷 추가’를 그대로 옮기면 → Shot add, please. 어색해요. 거절할 때는 No. 대신 → No, thanks.'],
      [18, 24, '내가 먼저 바꿀 때 → Can I get it with + 옵션? 빼고 싶으면 → No + 옵션, please.'],
      [24, 29.5, 'Can I get it with less ice? No sugar, please. 틀은 그대로, 칸만 바꿔요.'],
      [29.5, 36, '아메리카노를 시키면 → Room for milk? room → 방이 아니라 우유를 넣을 빈자리예요.'],
    ] },
    { id: 'name', n: '05', title: '이름과 포장', sub: 'Name · For here or to go · 빠른 말', d: 36, place: 4, caps: [
      [0.4, 6, 'Can I get a name for that? → 컵에 적을 이름을 물어요. 허락을 묻는 말이 아니에요.'],
      [6, 11.5, '그래서 Yes, you can. → 엉뚱한 대답. 이름만 말해요 → It\'s Minji. 낯선 이름이면 철자도 불러 줘요.'],
      [11.5, 17.5, 'For here or to go? → 여기서 마실지, 가져갈지. To go, please. 또는 For here, please.'],
      [17.5, 23.5, '테이크아웃 → Take out, 통하긴 해요. 카페에서는 보통 to go, 영국은 takeaway. ‘포장’ → Packing, 이건 안 통해요.'],
      [23.5, 29.5, '이 질문은 하루에도 수백 번 해서 아주 빨라요. 낱말이 이어져 한 덩어리로 들려요.'],
      [29.5, 36, '못 알아들었으면 들린 만큼 되물어요 → Sorry, for here or to go? 또는 Could you say that again, please?'],
    ] },
    { id: 'pay', n: '06', title: '계산', sub: 'Pay · Anything else · 값 읽기 · Card or cash', d: 34, place: 5, caps: [
      [0.4, 6, '계산대. Anything else? → 더 주문할 것이 있나요? 없으면 → No, that\'s it. Thanks.'],
      [6, 12, '바리스타가 값을 말해요 → That\'ll be six fifty. 화면의 값 → $6.50.'],
      [12, 18, '값은 점 앞과 점 뒤를 따로 읽어요. 4.25 → four twenty-five. 5.00 → five dollars.'],
      [18, 24, 'Card or cash? → Card, please. ‘카드 계산이요’를 그대로 옮기면 → Card calculate. 어색해요.'],
      [24, 29.5, '카드는 단말기에 대요(tap). 팁(tip)을 고르는 화면이 나오는 나라도 있어요. 팁 문화는 나라마다 달라요.'],
      [29.5, 34, 'Would you like a receipt? → 필요 없으면 No, thanks. 필요하면 Yes, please.'],
    ] },
    { id: 'pickup', n: '07', title: '받기와 문제가 생겼을 때', sub: 'Pickup · That\'s me · Excuse me, I ordered …', d: 32, place: 6, caps: [
      [0.4, 5.5, '픽업대에서는 음료와 이름을 함께 불러요 → Medium iced latte for Minji!'],
      [5.5, 10.5, '내 것이면 → That\'s me. Thanks! 그런데 음료가 주문과 다르다면?'],
      [10.5, 16, '이거 틀렸어요 → This is wrong. 따지는 말처럼 들려요. 무엇이 다른지 말해요.'],
      [16, 21.5, 'Excuse me, I ordered it iced, but this one is hot. 차갑게 시켰는데 따뜻하다고 차분히 말해요.'],
      [21.5, 27, '필요한 것은 부탁 틀로 → Could I get a lid, please? 칸만 바꿔요 → a straw, some napkins.'],
      [27, 32, 'Give me a straw. → 명령처럼 들려요. 부탁을 질문으로 하면 공손해져요.'],
    ] },
    { id: 'oneline', n: '08', title: '한 번에 말하기', sub: '순서대로 한 문장 · 바리스타가 건너뛰는 질문', d: 36, caps: [
      [0.4, 6, '질문을 하나씩 기다리면 여섯 번 주고받아야 해요. 한 문장에 여러 조각을 **순서대로** 넣어 볼까요?'],
      [6, 12, '순서 → 크기, 온도, 음료, with 옵션, 포장. Can I get a medium iced latte with oat milk to go?'],
      [12, 18, '그러면 바리스타는 이미 들은 질문을 건너뛰어요. 크기, 온도, 우유, 포장 → 다시 묻지 않아요.'],
      [18, 24, '말하지 않은 것만 물어요 → Would you like an extra shot? Yes, please. 그리고 이름.'],
      [24, 30, '순서가 뒤섞이면 → an iced medium latte to go with oat milk. 알아듣기 어려워요.'],
      [30, 36, '질문 여섯 개가 둘로 줄었어요. 이 순서는 자주 쓰는 순서를 단순하게 줄인 규칙이에요.'],
    ] },
    { id: 'method', n: '09', title: '3단계 말하기 법', sub: '일곱 단계에 한 줄씩', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 말하기 법**으로 묶어요.'],
      [5.5, 11.5, '① **열쇠 낱말 잡기** → 무엇을 묻나? 음료, 크기, 온도, 우유, 이름, 포장, 계산.'],
      [11.5, 17.5, '② **틀에 내 정보 넣기** → 고른 것 + please. Can I get + 음료? It\'s + 이름.'],
      [17.5, 23, '③ **공손하게 끝내기** → please, thanks, Can I get …? 못 알아들었으면 → Sorry?'],
      [23, 28, '일곱 단계에 한 줄씩 적용했어요. 열쇠 낱말 하나가 대답의 모양을 정해요.'],
    ] },
    { id: 'practice', n: '10', title: '실전 주문', sub: '주문 카드 하나로 네 번', d: 50, caps: [
      [0.4, 4.5, '실전이에요. 주문 카드 → 라지 모카, 따뜻하게, 무지방 우유, 여기서. 첫 질문 → What can I get you?'],
      [4.5, 8.5, '① 무엇을 주문할지 물어요. (B) Large, please. → 크기라 탈락. ② 남은 둘은 정보가 맞아요.'],
      [8.5, 12.5, '③ (A) Give me → 명령처럼 들려 탈락. 정답 (C) → Can I get a mocha?'],
      [12.9, 17, 'Hot or iced? ① 고르기 질문이에요. (B) Yes, please. → 고르지 않았으니 탈락.'],
      [17, 21, '② (A) Iced, please. → 카드는 따뜻한 음료라 탈락.'],
      [21, 25, '정답 (C) → Hot, please. 고른 것 + please.'],
      [25.4, 29.5, 'For here or to go? ① 셋 모두 포장에 대한 대답이에요.'],
      [29.5, 33.5, '② (A) Packing → ‘포장’ 그대로라 탈락. (B) To go → 카드는 여기서 마셔요.'],
      [33.5, 37.5, '정답 (C) → For here, please.'],
      [37.9, 42, 'Anything else? ① (B) Cash, please. → 계산 방법이라 탈락.'],
      [42, 46, '② (A) No, that\'s it. → 카드에 크루아상이 있어서 탈락.'],
      [46, 50, '정답 (C) → Yes, can I also get a croissant? 합계 → nine twenty-five.'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '단계 · 열쇠 낱말 · 대답 틀', d: 22, caps: [
      [0.4, 6, '정리해요. 카페 주문은 순서가 거의 같고, 열쇠 낱말 하나가 무엇을 묻는지 알려 줘요.'],
      [6, 12, '대답은 짧은 틀에 내 정보를 넣으면 돼요. 고를 땐 + please, 주문과 부탁은 → Can I get …?'],
      [12, 17, '한 문장에 순서대로 말하면 질문이 줄어요. 못 알아들으면 → Sorry, for here or to go?'],
      [17, 22, '아래 **카페 주문 시뮬레이터**에서 내 주문 카드로 직접 주문해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  CFS.CHAPTERS = CHAPTERS; CFS.CAPTIONS = CAPTIONS; CFS.END = END;
  CFS.POSTER = CHAPTERS.find(c => c.id === 'oneline').t + 22.5;
  CFS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  CFS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 실전 장면의 시각 (구간 시작 · 보기 · ① · ② · ③ · 정답)
  const PSEG = [0, 12.5, 25, 37.5];
  const PT = { q: 0.4, opt: [1.6, 2.2, 2.8], s1: 5.0, s2: 7.0, s3: 9.0, win: 10.0, lines: [0.4, 4.5, 8.5] };
  CFS.PSEG = PSEG;

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  const label = (g, s, x, y, o = {}) => txt(g, s, x, y, Object.assign({ size: 17, weight: 600, color: COL.muted }, o));
  const Qobj = q => typeof q === 'string' ? CF.Q[q] : q;
  const Qm = q => Qobj(q).key.map(k => [k, 'key']);
  // 열쇠 낱말 → 대답 틀 노트 (오른쪽 칸)
  function notePanel(g, x, y, w, rows, u, o = {}) {
    const rh = o.rh || 84;
    fade(g, ramp(u, rows.length ? rows[0][2] - 0.4 : 0, 0.4), () => {
      panel(g, x, y, w, 60 + rows.length * rh, { fill: COL.panel, stroke: COL.faint });
      txt(g, o.title || '열쇠 낱말 → 대답 틀', x + 20, y + 30, { size: 16, weight: 700, color: COL.muted });
    });
    rows.forEach(([k, f, at], i) => fade(g, ramp(u, at, 0.4), () => {
      const yy = y + 76 + i * rh;
      txt(g, k, x + 20, yy, { size: fit(g, k, 19, w - 40, 700), weight: 700, color: COL.ante });
      pieces(g, f, x + 20, yy + 34, 18, w - 40);
    }));
  }
  // [글, 역할] 이어 쓰기
  function pieces(g, parts, x, y, size, maxW, o = {}) {
    let w = 0; parts.forEach(([t, r]) => { w += tw(g, t, size, r ? 600 : 500); });
    const sz = maxW && w > maxW ? size * maxW / w : size;
    let xx = o.align === 'center' ? x - w * sz / size / 2 : o.align === 'right' ? x - w * sz / size : x;
    parts.forEach(([t, r]) => { const c = RC[r] || o.color || COL.soft; xx += txt(g, t, xx, y, { size: sz, weight: r ? 600 : 500, color: c }); });
    return w * sz / size;
  }
  // 대답 → [글, 역할] 조각
  const ansParts = a => CF.segs(a).map(s => [s.t, s.r]);
  const why2 = j => `${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸려요'} → ${j.why}`;
  // 직접 해 보기로 고른 질문 · 대답을 멈춘 화면으로 (판정과 까닭)
  function qaView(g, q, a, card, o = {}) {
    q = Qobj(q);
    const y = o.y || 150, w = o.w || 760, j = CF.judge(q, a, card, o.src || '상황');
    talk(g, { side: 'L', x: LX, y, w, text: q.en, marks: Qm(q), kind: o.kind || (q.place === 'pickup' ? 'barista2' : 'barista'), sp: q.sp, all: true, u: 99, size: 24 });
    answer(g, { x: LX, y: y + 78, w, A: a, all: true, u: 99, size: 24, verdict: { ok: j.ok, at: -1 } });
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
      const fi = cur && cur[0] === c.k, p = fi ? clamp((u - cur[1]) / 0.6) : 0, cw = tw(g, c.t, 22, 600);
      const xx = lerp(o.align === 'center' ? cx - cw / 2 : cx, B.x + 6, ease(p)), yy = lerp(cy, y, ease(p)), sz = lerp(22, size, ease(p));
      fade(g, ramp(u, (o.chipAt || 0) + i * 0.3, 0.4), () => {
        const bx0 = o.align === 'center' ? cx - cw / 2 - 12 : cx - 12;
        if (p < 1) { rr(g, bx0, cy - 20, cw + 24, 40, 12); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = 'rgba(127,224,168,0.45)'; g.lineWidth = 1.5; g.stroke(); }
        drawTok(g, { t: c.t, r: 'slot', x: xx, y: yy, w: tw(g, c.t, sz, 600), size: sz });
      });
      if (o.say) HITS.push({ x: (o.align === 'center' ? cx - cw / 2 : cx) - 12, y: cy - 20, w: cw + 24, h: 40, say: o.say(c) });
    });
    if (fillT && o.okAt != null) mark(g, true, L.x + L.w + 30, y, 20);
    if (fillT && o.say) say(L.x, y - 26, L.w, 52, o.say(chips.find(c => c.k === cur[0])));
    return L;
  }

  const SCENES = {
    /* 00 들어가며: 제목 → 주문대 한 장면(한국어 그대로 → 자연스러운 말) → 3단계 */
    intro(g, u) {
      fade(g, ramp(u, 0.2, 0.6) * (1 - ramp(u, 4.0, 0.5)), () => {
        txt(g, '카페, 주문에는 순서가 있다', W / 2, 262, { size: 56, weight: 800, fam: FD, align: 'center' });
        txt(g, 'Café English · 문에서 픽업대까지 일곱 단계', W / 2, 332, { size: 24, weight: 500, color: COL.muted, align: 'center' });
        CF.PLACES.forEach((p, i) => fade(g, ramp(u, 0.9 + i * 0.22, 0.4), () => {
          const x = W / 2 + (i - 3) * 132;
          circ(g, x, 440, 32, COL.panel2); ring(g, x, 440, 32, COL.accent, 1.8);
          icon(g, p.id, x, 440, 30, COL.soft);
          txt(g, String(i + 1), x, 392, { size: 14, weight: 700, fam: FM, color: COL.accent, align: 'center' });
          txt(g, p.ko, x, 496, { size: 15, weight: 600, color: COL.muted, align: 'center' });
          if (i < 6) arrow(g, x + 38, 440, x + 92, 440, COL.faint, 2);
        }));
      });
      const it = CF.INTRO, q = CF.Q[it.q];
      fade(g, ramp(u, 4.6, 0.4) * (1 - ramp(u, 20.6, 0.5)), () => {
        label(g, '메뉴판 · 주문대 · Counter', LX, 160, { color: COL.accent, size: 16 });
        const B = talk(g, { side: 'L', x: LX, y: 180, w: 1120, text: q.en, marks: Qm(q), kind: 'barista', sp: q.sp, at: 5.4, u, roleAt: 7.8, size: 26 });
        fade(g, ramp(u, 8.0, 0.4), () => tag(g, '열쇠 낱말 What … get → 무엇을 주문할지', B.ex + 24, 180 + B.bh / 2, COL.ante, { size: 16 }));
        // 생각 구름 (한국어로 먼저 생각함)
        fade(g, ramp(u, 10.4, 0.4) * (1 - ramp(u, 16.0, 0.4)), () => {
          const x = 640, y = 290;
          panel(g, x, y, 440, 52, { fill: 'rgba(242,194,154,0.08)', stroke: 'rgba(242,194,154,0.5)', dash: true, r: 26 });
          circ(g, x + 450, y + 66, 6, 'rgba(242,194,154,0.35)'); circ(g, x + 466, y + 80, 4, 'rgba(242,194,154,0.35)');
          txt(g, '(한국어로) 아이스 아메리카노 주세요', x + 220, y + 27, { size: 20, weight: 600, color: '#F2C29A', align: 'center' });
        });
        const p = clamp((u - 16.2) / 1.0);
        const ans = answer(g, { x: LX, y: 372, w: 1120, A: it.lit, B: u >= 16.2 ? it.ok : null, p, at: 11.6, u, size: 28, trapAt: 13.4, strikeAt: 13.6, verdict: u >= 17.4 ? { ok: true, at: 17.4 } : null });
        fade(g, ramp(u, 14.0, 0.4) * (1 - ramp(u, 16.0, 0.3)), () => {
          tag(g, 'Give me → 명령처럼 들려요', ans.bx + ans.bw, 372 + ans.bh + 30, COL.trap, { align: 'right' });
          tag(g, 'ice → iced (얼음을 넣은)', ans.bx + ans.bw, 372 + ans.bh + 76, COL.trap, { align: 'right' });
        });
        fade(g, ramp(u, 17.8, 0.4), () => pieces(g, [['Can I', 'pol'], [' get', 'frame'], [' + ', ''], ['an iced americano', 'slot'], [' → 주문을 질문으로', '']], 1200, 372 + 100, 19, 0, { align: 'right' }));
        fade(g, ramp(u, 19.0, 0.4), () => tag(g, 'a · an + iced + 음료', 1200, 372 + 146, COL.clause, { align: 'right' }));
        if (u >= 17.4) say(ans.bx, 372, ans.bw, ans.bh, CF.text(it.ok));
      });
      // 3단계
      const STEPS = [['①', '열쇠 낱말 잡기', 'What size? → 크기', COL.ante], ['②', '틀에 내 정보 넣기', 'Medium, please.', COL.rel], ['③', '공손하게 끝내기', 'Can I get …? · please · thanks', COL.verb]];
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
      fade(g, ramp(u, 23.0, 0.5), () => txt(g, '카페 영어 = 순서가 정해진 질문 + 짧은 대답 틀 + 공손한 끝맺음', W / 2, 446, { size: 24, weight: 700, color: COL.soft, align: 'center' }));
      fade(g, ramp(u, 24.0, 0.5), () => txt(g, '순서를 알면 → 다음 질문이 미리 들려요', W / 2, 494, { size: 21, weight: 600, color: COL.accent, align: 'center' }));
    },

    /* 01 주문 길 지도: 가게 평면도 위의 일곱 단계와 단계마다의 질문 */
    route(g, u) {
      const XS = [130, 320, 470, 620, 770, 935, 1110], YS = 300;
      const sel = S.stop != null ? S.stop : null;
      // 가게
      fade(g, ramp(u, 0.3, 0.6), () => {
        panel(g, 70, 146, 1140, 270, { fill: 'rgba(24,32,42,0.55)', stroke: COL.faint, r: 18 });
        // 벽의 메뉴판 · 기계 · 진열장 · 픽업 표지
        rr(g, 270, 156, 220, 38, 6); g.fillStyle = '#1C2622'; g.fill(); g.strokeStyle = '#5A4632'; g.lineWidth = 3; g.stroke();
        txt(g, 'MENU', 300, 175, { size: 14, weight: 700, fam: FM, color: '#F2E6C9' });
        g.fillStyle = 'rgba(242,230,201,0.4)'; [0, 1].forEach(k => g.fillRect(352, 168 + k * 12, 120 - k * 30, 3));
        rr(g, 600, 158, 110, 40, 6); g.fillStyle = '#4A525C'; g.fill(); g.fillStyle = '#2B3139'; g.fillRect(620, 186, 10, 12); g.fillRect(680, 186, 10, 12);
        rr(g, 760, 160, 120, 38, 6); g.fillStyle = 'rgba(238,241,244,0.08)'; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.stroke();
        [0, 1, 2].forEach(k => circ(g, 786 + k * 34, 180, 9, '#C49A64'));
        chip(g, 'PICKUP', 1110, 176, { size: 13, fam: FM, weight: 700, color: '#1D1305', fill: COL.accent, h: 26, r: 6, align: 'center' });
        // 주문대
        rr(g, 250, 206, 940, 34, 8); g.fillStyle = COL.wood; g.fill(); g.fillStyle = '#6B5442'; g.fillRect(250, 206, 940, 5);
        icon(g, 'pay', 935, 222, 24, '#C9D1DA');
        // 문 (평면도 기호: 벽의 틈 + 문짝 + 열리는 호)
        g.fillStyle = COL.bg; g.fillRect(64, 268, 12, 64);
        g.strokeStyle = '#B08B62'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(70, 268); g.lineTo(112, 268); g.stroke();
        g.strokeStyle = 'rgba(176,139,98,0.55)'; g.lineWidth = 1.5; g.setLineDash([4, 4]); g.beginPath(); g.arc(70, 268, 42, 0, Math.PI / 2); g.stroke(); g.setLineDash([]);
        txt(g, 'DOOR', 96, 252, { size: 11, weight: 700, fam: FM, color: '#B08B62', align: 'center' });
      });
      // 손님이 걷는 길
      fade(g, ramp(u, 0.6, 0.5), () => {
        g.strokeStyle = 'rgba(110,200,255,0.45)'; g.lineWidth = 4; g.lineCap = 'round';
        for (let k = 0; k < 6; k++) {
          const st = k === 0 ? 1.0 : 6.2 + (k - 1) * 0.9, e = clamp((u - st) / 0.7);
          if (e > 0) { const a = XS[k] + 30, b = XS[k + 1] - 30; if (k >= 1 && k <= 3) g.setLineDash([2, 8]); g.beginPath(); g.moveTo(a, YS); g.lineTo(lerp(a, b, e), YS); g.stroke(); g.setLineDash([]); }
        }
      });
      fade(g, ramp(u, 7.0, 0.5), () => {
        g.strokeStyle = 'rgba(255,193,94,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(XS[1] - 20, 262); g.lineTo(XS[1] - 20, 252); g.lineTo(XS[4] + 20, 252); g.lineTo(XS[4] + 20, 262); g.stroke();
        txt(g, '주문대 앞에서 차례로 묻는 질문', (XS[1] + XS[4]) / 2, 224, { size: 15, weight: 700, color: COL.accent, align: 'center' });
      });
      CF.PLACES.forEach((p, i) => {
        const x = XS[i], at = i === 0 ? 0.8 : i === 1 ? 2.4 : 6.2 + (i - 2) * 0.9, on = sel === i, dim = sel != null && !on;
        fade(g, ramp(u, at, 0.45) * (dim ? 0.4 : 1), () => {
          circ(g, x, YS, 28, on ? COL.accent : COL.panel2); ring(g, x, YS, 28, on ? COL.accent : COL.ante, 2.2);
          icon(g, p.id, x, YS, 28, on ? '#1D1305' : COL.text);
          chip(g, String(i + 1), x + 22, YS - 24, { size: 12, fam: FM, weight: 700, color: '#1D1305', fill: COL.accent, h: 20, r: 10, pad: 6, align: 'center' });
          txt(g, p.ko, x, YS + 46, { size: fit(g, p.ko, 17, 148, 700), weight: 700, align: 'center' });
          // 질문
          CF.ROUTE[p.id].forEach((qid, k) => fade(g, sel != null ? 1 : ramp(u, 12.2 + i * 0.45 + k * 0.15, 0.4), () => {
            const q = CF.Q[qid], t = q.short || q.en, yy = YS + 72 + k * 22;
            txt(g, t, x, yy, { size: fit(g, t, 14, 146, 500), weight: 500, color: on ? COL.text : COL.en, align: 'center' });
            say(x - 74, yy - 10, 148, 20, q.en);
          }));
        });
        HITS.push({ x: x - 32, y: YS - 32, w: 64, h: 64, stop: i });
      });
      // 아래 칸
      const by = 432, bh = 136;
      if (sel != null) {
        const p = CF.PLACES[sel];
        panel(g, LX, by, 1120, bh, { fill: COL.panel, stroke: COL.accent });
        icon(g, p.id, LX + 30, by + 30, 24, COL.accent);
        txt(g, `${sel + 1}. ${p.ko}`, LX + 52, by + 30, { size: 18, weight: 700, color: COL.accent });
        CF.ROUTE[p.id].forEach((qid, k) => {
          const q = CF.Q[qid];
          const R = richLay(g, q.en, q.intent ? Qm(q) : [], 20, 520, { weight: 600 });
          richDraw(g, R, LX + 24, by + 70 + k * 36, { color: COL.en });
          txt(g, q.ko, LX + 40 + R.w, by + 70 + k * 36, { size: 15, weight: 500, color: COL.muted });
        });
        const qs = CF.ROUTE[p.id].map(q => CF.Q[q]).filter(q => q.intent);
        const ans = qs.map(q => CF.text(CF.model(q, CF.DEMO)));
        txt(g, '대답 →', LX + 760, by + 30, { size: 15, weight: 700, color: COL.muted });
        ans.forEach((t, k) => txt(g, t, LX + 760, by + 70 + k * 36, { size: fit(g, t, 18, 340, 600), weight: 600, color: COL.rel }));
      } else {
        fade(g, ramp(u, 18.2, 0.5), () => {
          panel(g, LX, by, 640, bh, { fill: COL.panel, stroke: COL.faint });
          txt(g, '7단계', LX + 24, by + 46, { size: 40, weight: 800, fam: FD, color: COL.accent });
          txt(g, '단계마다 질문 한두 개, 순서는 거의 같아요', LX + 160, by + 48, { size: 19, weight: 700 });
          pieces(g, [['순서를 알면', ''], [' → ', ''], ['다음 질문', 'key'], ['을 미리 짐작해요', '']], LX + 24, by + 100, 20);
        });
        fade(g, ramp(u, 20.5, 0.5), () => {
          panel(g, 740, by, 460, bh, { fill: COL.panel, stroke: COL.faint });
          txt(g, '예: 이름을 말한 뒤에는?', 764, by + 34, { size: 16, weight: 700, color: COL.muted });
          const R = richLay(g, 'For here or to go?', [['For here or to go', 'key']], 24, 420, { weight: 600 });
          richDraw(g, R, 764, by + 78);
          txt(g, '→ 빨라도 짐작할 수 있어요', 764, by + 114, { size: 16, weight: 600, color: COL.soft });
        });
        fade(g, ramp(u, 24.2, 0.5), () => tag(g, '가게 · 나라마다 조금씩 달라요', 1200, 126, COL.muted, { align: 'right', size: 14, h: 26 }));
      }
    },

    /* 02 인사와 주문: 준비됐나요? → 주문 틀 둘 → a · an → ice → iced → 무례한 말 */
    order(g, u) {
      const sc = CF.SCENE.order;
      if (S.ord) {
        qaView(g, 'co_what', S.ord.a, CF.ORD_SIT[S.ord.sit]);
        fade(g, 1, () => { panel(g, 900, 150, 300, 110, { fill: COL.panel, stroke: COL.faint }); txt(g, '마시고 싶은 것', 920, 180, { size: 15, weight: 700, color: COL.muted }); txt(g, CF.ORD_SIT_KO[S.ord.sit], 920, 222, { size: 24, weight: 800, fam: FD, color: COL.clause }); });
        return;
      }
      // 메뉴판 (처음)
      fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, 5.6, 0.4)), () => { menuBoard(g, 840, 150, 360); });
      fade(g, 1 - ramp(u, 5.6, 0.4), () => {
        const [qid, a, c] = sc[0];
        talk(g, { side: 'L', x: LX, y: 150, w: 740, text: CF.Q[qid].en, marks: Qm(qid), kind: 'barista', sp: 'us', at: 0.8, u, roleAt: 1.6, size: 24 });
        answer(g, { x: LX, y: 226, w: 740, A: a, at: 3.0, u, size: 24, verdict: { ok: CF.judge(qid, a, c).ok, at: 3.8 } });
        fade(g, ramp(u, 4.2, 0.4), () => tag(g, '아직이면 → 잠깐 기다려 달라고', LX, 330, COL.rel));
      });
      const out = 1 - ramp(u, 16.8, 0.4);
      if (u >= 5.8) fade(g, out, () => {
        [[sc[1], 150, 6.2, 8.4], [sc[2], 290, 11.6, 13.4]].forEach(([[qid, a, c], y, tq, ta]) => {
          talk(g, { side: 'L', x: LX, y, w: 720, text: CF.Q[qid].en, marks: Qm(qid), kind: 'barista', sp: 'us', at: tq, u, roleAt: tq + 0.8, size: 24 });
          answer(g, { x: LX, y: y + 70, w: 720, A: a, at: ta, u, size: 24, verdict: { ok: CF.judge(qid, a, c).ok, at: ta + 0.8 } });
        });
        notePanel(g, 840, 150, 360, [['ready to order', [['Not yet. Just a minute, ', 'frame'], ['please', 'pol'], ['.', '']], 6.0], ['What can I get', [['Can I', 'pol'], [' get ', 'frame'], ['___', 'slot'], ['?', '']], 9.2], ['What would you like', [['I\'d like', 'pol'], [' ___', 'slot'], [', ', ''], ['please', 'pol'], ['.', '']], 14.2]], u);
      });
      // a · an
      const inB = win(u, 17.2, 28.6);
      if (inB > 0.001 && u >= 16.8) fade(g, inB, () => {
        txt(g, '음료 한 잔 → a · 모음 소리 앞 → an', LX, 168, { size: 20, weight: 700, color: COL.soft });
        CF.SCENE.arts.forEach(([art, w], i) => fade(g, ramp(u, 17.6 + i * 0.6, 0.4), () => {
          const x = LX + (i % 2) * 560, y = 222 + Math.floor(i / 2) * 64;
          const wa = txt(g, art, x, y, { size: 30, weight: 700, color: COL.rel });
          g.fillStyle = COL.rel; g.fillRect(x, y + 18, wa, 2.6);
          const first = w[0], rest = w.slice(1), fx = x + wa + 12;
          const w1 = txt(g, first, fx, y, { size: 30, weight: 700, color: art === 'an' ? COL.ante : COL.clause });
          txt(g, rest, fx + w1, y, { size: 30, weight: 600, color: COL.clause });
          say(x - 6, y - 22, wa + 12 + tw(g, w, 30, 700) + 12, 44, `${art} ${w}`);
          if (art === 'an') txt(g, `${first} → 모음 소리`, fx + tw(g, w, 30, 700) + 22, y + 2, { size: 15, weight: 600, color: COL.ante });
        }));
        // ice → iced
        const [iceA, iceB] = CF.SCENE.ice, p = clamp((u - 25.2) / 0.9);
        const A = answer(g, { x: LX, y: 400, w: 860, A: iceA, B: iceB, p, at: 23.4, u, size: 28, trapAt: 24.0, strikeAt: 24.2, verdict: u >= 26.2 ? { ok: true, at: 26.2 } : null });
        fade(g, ramp(u, 24.4, 0.4) * (1 - ramp(u, 25.2, 0.3)), () => tag(g, '‘아이스’ 그대로 → ice', A.bx - 18, 400 + A.bh / 2, COL.trap, { align: 'right' }));
        fade(g, ramp(u, 26.4, 0.4), () => {
          panel(g, 960, 380, 240, 150, { fill: COL.panel, stroke: COL.faint });
          icon(g, 'iced', 1000, 420, 30, COL.ante);
          txt(g, 'iced', 1030, 420, { size: 26, weight: 800, color: COL.ante });
          txt(g, '얼음을 넣어', 984, 462, { size: 16, weight: 600, color: COL.soft });
          txt(g, '차갑게 만든', 984, 488, { size: 16, weight: 600, color: COL.soft });
          txt(g, '(ice = 얼음)', 984, 514, { size: 14, weight: 500, color: COL.muted });
        });
      });
      // 무례한 말
      if (u >= 28.2) fade(g, ramp(u, 28.4, 0.4), () => {
        chip(g, '(한국어로) 아메리카노 주세요', LX, 172, { size: 20, weight: 700, color: '#F2C29A', fill: 'rgba(242,194,154,0.08)', stroke: 'rgba(242,194,154,0.5)', dash: true, h: 44 });
        const [g1, g2, ok] = CF.SCENE.blunt;
        answer(g, { x: LX, y: 222, w: 760, A: g1, at: 28.8, u, size: 24, trapAt: 29.4, strikeAt: 29.5, tag: ['명령처럼 들려요', COL.trap, 29.8], tagX: 860, tagY: 222 + 26 });
        answer(g, { x: LX, y: 304, w: 760, A: g2, at: 29.9, u, size: 24, trapAt: 30.5, strikeAt: 30.6, tag: ['조르는 말처럼 들려요', COL.trap, 30.9], tagX: 860, tagY: 304 + 26 });
        answer(g, { x: LX, y: 398, w: 760, A: ok, at: 31.4, u, size: 26, verdict: { ok: true, at: 32.2 } });
        fade(g, ramp(u, 32.6, 0.4), () => tag(g, '주문을 질문으로 → 공손해요', 860, 398 + 28, COL.verb));
      });
    },

    /* 03 크기와 온도: What size? → Hot or iced? → or = 고르기 → 크기 이름 → 사이즈업 */
    size(g, u) {
      if (S.cup) {
        qaView(g, S.cup.q, S.cup.a, S.cup.want, { w: 700 });
        cupsPanel(g, 820, 150, S.cup.want, 99);
        return;
      }
      const sc = CF.SCENE.size, outA = 1 - ramp(u, 17.8, 0.4);
      fade(g, outA, () => {
        const [[q1, a1], [q2, a2]] = sc;
        talk(g, { side: 'L', x: LX, y: 150, w: 660, text: CF.Q[q1].en, marks: Qm(q1), kind: 'barista', sp: 'us', at: 0.8, u, roleAt: 1.4, size: 24 });
        answer(g, { x: LX, y: 222, w: 660, A: a1, at: 2.8, u, size: 24, verdict: { ok: CF.judge(q1, a1, CF.DEMO).ok, at: 3.6 } });
        talk(g, { side: 'L', x: LX, y: 300, w: 660, text: CF.Q[q2].en, marks: Qm(q2), kind: 'barista', sp: 'us', at: 6.2, u, roleAt: 6.8, size: 24 });
        const [ice, yes] = CF.SCENE.tempTrap;
        answer(g, { x: LX, y: 372, w: 660, A: ice, B: a2, p: (u - 9.8) / 0.8, at: 7.8, u, size: 24, trapAt: 8.6, strikeAt: 8.8, verdict: u >= 10.8 ? { ok: true, at: 10.8 } : null, tag: ['ice → iced', COL.trap, 9.0, 9.8], tagY: 372 + 78 });
        // or = 고르기
        fade(g, ramp(u, 12.2, 0.4), () => {
          answer(g, { x: LX, y: 470, w: 660, A: yes, at: 12.6, u, size: 22, trapAt: 13.4, strikeAt: 13.5, tag: ['무엇을 골랐나요?', COL.trap, 13.8], tagX: LX + 30, tagY: 470 + 25 });
          fade(g, ramp(u, 14.6, 0.4), () => tag(g, 'or → 고르기 질문', 350, 300 + 26, COL.ante, { size: 15 }));
        });
        cupsPanel(g, 780, 150, { size: u >= 3.6 ? 'medium' : null, temp: u >= 10.8 ? 'iced' : null }, u);
      });
      // 크기 이름 · This one
      const inB = win(u, 18.2, 24.4);
      if (inB > 0.001 && u >= 17.8) fade(g, inB, () => {
        txt(g, '크기 이름은 가게마다 달라요', LX, 170, { size: 22, weight: 800, fam: FD, color: COL.soft });
        [['small', 'medium', 'large'], ['regular', 'large'], ['12 oz', '16 oz', '20 oz']].forEach((row, r) => fade(g, ramp(u, 18.8 + r * 0.6, 0.4), () => {
          txt(g, ['흔한 이름', '두 가지만', '용량으로'][r], LX, 230 + r * 54, { size: 16, weight: 700, color: COL.muted });
          let x = LX + 120; row.forEach(w => { const c = chip(g, w, x, 230 + r * 54, { size: 18, weight: 700, color: COL.en, fill: COL.panel2, stroke: COL.faint, h: 38 }); x += c.w + 12; say(c.x, c.y, c.w, c.h, w); });
        }));
        fade(g, ramp(u, 21.0, 0.4), () => {
          answer(g, { x: LX, y: 420, w: 700, toksA: strToks('This one, please.', 'frame').map(t => t.t === 'please' ? Object.assign(t, { r: 'pol' }) : t), sayA: 'This one, please.', at: 21.2, u, size: 26, verdict: { ok: true, at: 22.0 } });
          txt(g, '낯선 이름이면 → 컵 그림을 가리키며', LX, 400, { size: 17, weight: 600, color: COL.soft });
        });
        cupsPanel(g, 820, 150, { size: u >= 21.6 ? 'large' : null }, u, { point: u >= 21.2 });
      });
      // 사이즈업
      if (u >= 24.2) fade(g, ramp(u, 24.4, 0.4), () => {
        chip(g, '(한국어로) 사이즈업 해 주세요', LX, 172, { size: 20, weight: 700, color: '#F2C29A', fill: 'rgba(242,194,154,0.08)', stroke: 'rgba(242,194,154,0.5)', dash: true, h: 44 });
        answer(g, { x: LX, y: 222, w: 760, A: CF.o('sz_up'), at: 24.8, u, size: 26, trapAt: 25.6, strikeAt: 25.7, tag: ['한국에서 만든 말(콩글리시)', COL.trap, 26.0], tagX: 860, tagY: 222 + 28 });
        const T = [{ id: 'c', t: 'Can', r: 'pol' }, { id: 'i', t: 'I', r: 'pol' }, { id: 'm', t: 'make', r: 'frame' }, { id: 'it', t: 'it', r: 'frame' }, { id: 'a', t: 'a', r: 'frame' }, { id: 'l', t: 'large', r: 'slot' }, { id: 'q', t: '?', r: '' }];
        answer(g, { x: LX, y: 312, w: 760, toksA: T, sayA: 'Can I make it a large?', at: 27.4, u, size: 28, verdict: { ok: true, at: 28.2 } });
        fade(g, ramp(u, 28.6, 0.4), () => {
          tag(g, '이미 주문한 음료를 키울 때', 860, 312 + 30, COL.clause);
          pieces(g, [['처음 주문할 때 → 그냥 ', ''], ['Large', 'slot'], [', ', ''], ['please', 'pol'], ['.', '']], LX, 430, 22);
        });
      });
    },

    /* 04 옵션: 우유 → 샷 → 함정 → with / No 틀 → Room for milk */
    option(g, u) {
      if (S.chg) {
        const a = S.chg.a, j = CF.judge('op_add', a, { chg: S.chg.want }, '상황');
        talk(g, { side: 'L', x: LX, y: 150, w: 800, text: CF.Q.op_add.en, marks: Qm('op_add'), kind: 'barista', sp: 'us', all: true, u: 99, size: 24 });
        const L = lay(g, ansToks(a), { x: W / 2, y: 290, size: 36, align: 'center', maxW: 1080 });
        drawLay(g, L); mark(g, j.ok, L.x + L.w + 30, 290, 20); say(L.x, 264, L.w, 52, CF.text(a));
        const R = richLay(g, why2(j), [], 18, 1080, { weight: 600 });
        richDraw(g, R, W / 2 - R.w / 2, 360, { color: j.ok ? COL.good : COL.trap });
        tag(g, `원하는 것 → ${CF.factKo('chg', S.chg.want)}`, W / 2, 470, COL.clause, { align: 'center', size: 18, h: 40 });
        return;
      }
      const sc = CF.SCENE.option, outA = 1 - ramp(u, 11.8, 0.4);
      fade(g, outA, () => {
        const [[q1, a1], [q2, a2]] = sc;
        talk(g, { side: 'L', x: LX, y: 150, w: 720, text: CF.Q[q1].en, marks: Qm(q1), kind: 'barista', sp: 'us', at: 0.8, u, roleAt: 1.6, size: 24 });
        answer(g, { x: LX, y: 222, w: 720, A: a1, at: 3.0, u, size: 24, verdict: { ok: CF.judge(q1, a1, CF.DEMO).ok, at: 3.8 } });
        talk(g, { side: 'L', x: LX, y: 310, w: 720, text: CF.Q[q2].en, marks: Qm(q2), kind: 'barista', sp: 'us', at: 6.2, u, roleAt: 7.0, size: 24 });
        const B = answer(g, { x: LX, y: 382, w: 720, A: a2, at: 8.4, u, size: 24, verdict: { ok: true, at: 9.2 } });
        fade(g, ramp(u, 9.8, 0.4), () => { const yy = 382 + B.bh + 34; txt(g, '샷이 필요 없으면 →', B.bx - 40, yy, { size: 16, weight: 700, color: COL.muted, align: 'right' }); const c = chip(g, 'No, thanks.', B.bx - 26, yy, { size: 18, weight: 700, color: COL.rel, fill: COL.panel2, stroke: 'rgba(242,194,154,0.5)', h: 36 }); say(c.x, c.y, c.w, c.h, 'No, thanks.'); });
        // 우유 칸
        fade(g, ramp(u, 1.4, 0.4), () => {
          panel(g, 840, 150, 360, 300, { fill: COL.panel, stroke: COL.faint });
          txt(g, '우유 종류 · kind of milk', 860, 180, { size: 16, weight: 700, color: COL.muted });
          Object.entries(CF.SLOT.milk.vals).forEach(([k, v], i) => {
            const y = 230 + i * 62, on = k === 'oat' && u >= 3.8;
            if (on) { rr(g, 852, y - 26, 336, 52, 10); g.fillStyle = 'rgba(127,224,168,0.12)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
            icon(g, 'option', 884, y, 30, on ? COL.good : COL.soft);
            txt(g, v.low, 914, y - 9, { size: 20, weight: 700, color: COL.en });
            txt(g, v.ko, 914, y + 14, { size: 14, weight: 600, color: COL.muted });
            say(904, y - 22, 280, 44, v.t);
          });
          fade(g, ramp(u, 9.2, 0.4), () => { txt(g, 'an extra shot → 샷 하나 더', 860, 424, { size: 17, weight: 700, color: COL.clause }); });
        });
      });
      // 함정: 샷 추가 · 그냥 No.
      const inB = win(u, 12.0, 18.0);
      if (inB > 0.001 && u >= 11.8) fade(g, inB, () => {
        chip(g, '(한국어로) 샷 추가요', LX, 172, { size: 20, weight: 700, color: '#F2C29A', fill: 'rgba(242,194,154,0.08)', stroke: 'rgba(242,194,154,0.5)', dash: true, h: 44 });
        const [lit, plain, no] = CF.SCENE.shotTrap;
        answer(g, { x: LX, y: 222, w: 760, A: lit, at: 12.4, u, size: 24, trapAt: 13.0, strikeAt: 13.1, tag: ['샷 추가 → an extra shot', COL.trap, 13.4], tagX: 860, tagY: 222 + 26 });
        txt(g, '샷이 필요 없을 때', LX, 320, { size: 17, weight: 700, color: COL.muted });
        answer(g, { x: LX, y: 344, w: 760, A: plain, at: 14.8, u, size: 24, trapAt: 15.4, strikeAt: 15.5, tag: ['그냥 No. → 무뚝뚝해요', COL.trap, 15.8], tagX: 860, tagY: 344 + 26 });
        answer(g, { x: LX, y: 426, w: 760, A: no, at: 16.4, u, size: 26, verdict: { ok: true, at: 17.0 } });
      });
      // with · No 틀
      const inC = win(u, 18.2, 29.4);
      if (inC > 0.001 && u >= 18.0) fade(g, inC, () => {
        txt(g, '내가 먼저 바꿀 때', LX, 166, { size: 18, weight: 700, color: COL.muted });
        template(g, [{ t: 'Can', r: 'pol' }, { t: 'I', r: 'pol' }, { t: 'get', r: 'frame' }, { t: 'it', r: 'frame' }, { t: 'with', r: 'frame' }, { blank: true }, { t: '?', r: '' }],
          CF.SCENE.withs.map(k => ({ k, t: CF.SLOT.chgw.vals[k].t })), LX, 220, u, { size: 34, chipY: 296, chipX: LX + 10, chipDx: 250, chipAt: 18.8, fills: [['oat', 20.4], ['lessice', 24.6]], say: c => `Can I get it with ${c.t}?` });
        template(g, [{ t: 'No', r: 'frame' }, { blank: true }, { t: ',', r: '' }, { t: 'please', r: 'pol' }, { t: '.', r: '' }],
          CF.SCENE.nos.map(k => ({ k, t: CF.SLOT.chgn.vals[k].t })), LX, 384, u, { size: 34, chipY: 460, chipX: LX + 10, chipDx: 250, chipAt: 19.4, fills: [['nosugar', 25.6]], say: c => `No ${c.t}, please.` });
        fade(g, ramp(u, 26.6, 0.4), () => txt(g, '틀은 그대로, 칸만 바꿔요', 1200, 528, { size: 22, weight: 700, color: COL.soft, align: 'right' }));
      });
      // Room for milk
      if (u >= 29.2) fade(g, ramp(u, 29.4, 0.4), () => {
        const [qid, a] = CF.SCENE.room;
        label(g, '아메리카노를 시키면', LX, 160, { color: COL.accent, size: 16 });
        talk(g, { side: 'L', x: LX, y: 180, w: 760, text: CF.Q[qid].en, marks: Qm(qid), kind: 'barista', sp: 'us', at: 29.8, u, roleAt: 30.4, size: 26 });
        fade(g, ramp(u, 30.8, 0.4), () => tag(g, 'room → 방이 아니라 빈자리', LX + 360, 210, COL.ante, { size: 16 }));
        answer(g, { x: LX, y: 270, w: 760, A: a, at: 32.4, u, size: 26, verdict: { ok: true, at: 33.2 } });
        fade(g, ramp(u, 33.6, 0.4), () => pieces(g, [['우유를 직접 넣으려면 → ', ''], ['Yes', 'frame'], [', ', ''], ['please', 'pol'], ['.', '']], LX, 380, 22));
        fade(g, ramp(u, 30.6, 0.5), () => {
          panel(g, 900, 160, 300, 380, { fill: COL.panel, stroke: COL.faint });
          const by = 500, h = 124 * 1.5;
          cupDraw(g, 1030, by, { temp: 'iced', drink: 'americano', s: 1.5, room: true });
          g.strokeStyle = COL.gap; g.lineWidth = 2; g.beginPath(); g.moveTo(1098, by - h + 4); g.lineTo(1106, by - h + 4); g.lineTo(1106, by - h * 0.66); g.lineTo(1098, by - h * 0.66); g.stroke();
          txt(g, 'room', 1114, by - h * 0.83, { size: 22, weight: 800, color: COL.gap });
          txt(g, '= 우유를 넣을 빈자리', 1050, 190, { size: 17, weight: 700, color: COL.soft, align: 'center' });
          txt(g, '(컵 위쪽을 비워 둬요)', 1050, 524, { size: 14, weight: 500, color: COL.muted, align: 'center' });
        });
      });
    },

    /* 05 이름 · 포장: 이름(허락 아님) → For here or to go → take out · packing → 빠른 말 → 다시 묻기 */
    name(g, u) {
      fade(g, 1 - ramp(u, 11.2, 0.4), () => {
        const [qid, trap, ok] = CF.SCENE.name;
        talk(g, { side: 'L', x: LX, y: 150, w: 760, text: CF.Q[qid].en, marks: Qm(qid), kind: 'barista', sp: 'us', at: 0.8, u, roleAt: 1.8, size: 26 });
        fade(g, ramp(u, 2.4, 0.4), () => tag(g, 'Can I get …? → 허락이 아니라 부탁', LX + 70, 236, COL.ante, { size: 16 }));
        answer(g, { x: LX, y: 280, w: 760, A: trap, B: ok, p: (u - 6.6) / 0.8, at: 3.4, u, size: 26, trapAt: 4.4, strikeAt: 4.6, verdict: u >= 7.6 ? { ok: true, at: 7.6 } : null, tag: ['허락해 주는 대답 → 엉뚱해요', COL.trap, 4.9, 6.6], tagY: 280 + 86 });
        fade(g, ramp(u, 8.6, 0.4), () => { tag(g, '낯선 이름이면 철자도 → M-I-N-J-I', LX + 760, 400, COL.clause, { align: 'right' }); say(LX + 400, 382, 360, 36, 'M-I-N-J-I'); });
        fade(g, ramp(u, 7.6, 0.5), () => {
          panel(g, 900, 150, 300, 330, { fill: COL.panel, stroke: COL.faint });
          const d = CF.DEMO;
          cupDraw(g, 1050, 440, { temp: d.temp, drink: d.drink, s: 1.45, label: CF.cupLines(d), name: u >= 8.0 ? d.name : null });
          txt(g, '컵에 이름을 적어요', 1050, 466, { size: 15, weight: 600, color: COL.muted, align: 'center' });
        });
      });
      const inB = win(u, 11.6, 23.4);
      if (inB > 0.001 && u >= 11.2) fade(g, inB, () => {
        const [qid, a] = CF.SCENE.togo;
        talk(g, { side: 'L', x: LX, y: 150, w: 760, text: CF.Q[qid].en, marks: Qm(qid), kind: 'barista', sp: 'us', at: 11.8, u, roleAt: 12.4, size: 26 });
        answer(g, { x: LX, y: 226, w: 760, A: a, at: 13.4, u, size: 26, verdict: { ok: true, at: 14.2 } });
        fade(g, ramp(u, 14.8, 0.4), () => { const c = chip(g, 'For here, please.', LX + 270, 340, { size: 18, weight: 700, color: COL.rel, fill: COL.panel2, stroke: 'rgba(242,194,154,0.5)', h: 36 }); txt(g, '여기서 마시면 →', LX + 120, 340, { size: 16, weight: 700, color: COL.muted }); say(c.x, c.y, c.w, c.h, 'For here, please.'); });
        answer(g, { x: LX, y: 390, w: 760, A: CF.SCENE.take, at: 17.8, u, size: 24, verdict: { ok: CF.judge(qid, CF.SCENE.take, CF.DEMO).ok, at: 18.4 }, tag: ['통해요 · 카페에서는 보통 to go (영국 takeaway)', COL.rel, 18.8], tagX: LX + 10, tagY: 390 + 25 });
        answer(g, { x: LX, y: 476, w: 760, A: CF.SCENE.pack, at: 20.6, u, size: 24, trapAt: 21.2, strikeAt: 21.3, tag: ['‘포장’ → packing = 짐 싸기', COL.trap, 21.6], tagX: LX + 10, tagY: 476 + 25 });
        fade(g, ramp(u, 12.4, 0.5), () => {
          [['table', 'For here', '여기서 마시기', 15.4], ['bag', 'To go', '가져가기', 14.2]].forEach(([ic, en, ko, at], i) => {
            const x = 900, y = 160 + i * 130, on = u >= at && i === 1;
            panel(g, x, y, 300, 110, { fill: on ? COL.panel2 : COL.panel, stroke: on ? COL.good : COL.faint, lw: on ? 2.2 : 1.5 });
            icon(g, ic, x + 52, y + 55, 44, on ? COL.good : COL.soft);
            txt(g, en, x + 100, y + 42, { size: 24, weight: 800, color: COL.en });
            txt(g, ko, x + 100, y + 76, { size: 16, weight: 600, color: COL.muted });
            say(x, y, 300, 110, en + ', please.');
          });
        });
      });
      // 빠른 말 → 이어서 들리는 모양
      const inC = win(u, 23.6, 29.4);
      if (inC > 0.001 && u >= 23.4) fade(g, inC, () => {
        txt(g, '빠르게 말하면 낱말이 이어져요', LX, 166, { size: 22, weight: 800, fam: FD, color: COL.soft });
        linked(g, CF.LINKED[0], LX, 218, u, 23.9);
        linked(g, CF.LINKED[1], LX, 402, u, 26.2);
      });
      // 다시 묻기
      if (u >= 29.2) fade(g, ramp(u, 29.4, 0.4), () => {
        const [qid, echo, again] = CF.SCENE.repair;
        talk(g, { side: 'L', x: LX, y: 150, w: 1120, text: CF.Q[qid].en, kind: 'barista', sp: 'us', at: 29.8, u, size: 26, fast: true });
        fade(g, ramp(u, 30.2, 0.4), () => tag(g, '…… to go? 만 들렸어요', 1200, 132, COL.trap, { align: 'right', size: 15, h: 30 }));
        answer(g, { x: LX, y: 240, w: 1120, A: echo, at: 31.4, u, size: 28, verdict: { ok: CF.judge(qid, echo, {}).ok, at: 32.2 } });
        fade(g, ramp(u, 32.4, 0.4), () => tag(g, '이름 다음은 보통 포장 질문 → 짐작해 되묻기', 1200, 240 + 92, COL.clause, { align: 'right' }));
        fade(g, ramp(u, 33.4, 0.3), () => txt(g, '하나도 못 들었으면 →', LX, 430, { size: 17, weight: 700, color: COL.muted }));
        answer(g, { x: LX, y: 450, w: 1120, A: again, at: 33.6, u, size: 26, verdict: { ok: CF.judge(qid, again, {}).ok, at: 34.4 } });
      });
    },

    /* 06 계산: Anything else → 값 → 값 읽기 → Card or cash → 단말기 · 팁 화면 → 영수증 */
    pay(g, u) {
      const D = S.pay ? S.pay.order : CF.DEMO, P = CF.price(D);
      if (S.pay) {
        txt(g, '이 주문의 값', LX, 166, { size: 18, weight: 700, color: COL.muted });
        menuBoard(g, LX, 186, 420, { hl: Object.assign({ [`${D.drink}_${D.size}`]: COL.accent }, D.milk === 'oat' ? { oat: COL.clause } : {}, D.shot ? { shot: COL.clause } : {}) });
        receiptDraw(g, 560, 160, 300, D, { pay: 'card' });
        const t = `That'll be ${CF.money(P.total)}.`;
        talk(g, { side: 'L', x: 890, y: 180, w: 320, text: t, marks: [[CF.money(P.total), 'key']], kind: 'barista', sp: 'us', all: true, u: 99, size: 22 });
        txt(g, '읽기 →', 900, 300, { size: 16, weight: 700, color: COL.muted });
        txt(g, CF.priceWords(P.total), 900, 336, { size: fit(g, CF.priceWords(P.total), 26, 300, 700), weight: 700, color: COL.en });
        say(890, 316, 310, 40, `That'll be ${CF.priceWords(P.total)}.`);
        return;
      }
      fade(g, 1 - ramp(u, 17.8, 0.4), () => {
        const [qid, a] = CF.SCENE.more;
        talk(g, { side: 'L', x: LX, y: 150, w: 700, text: CF.Q[qid].en, marks: Qm(qid), kind: 'barista', sp: 'us', at: 0.8, u, roleAt: 1.4, size: 24 });
        answer(g, { x: LX, y: 220, w: 700, A: a, at: 2.8, u, size: 24, verdict: { ok: true, at: 3.6 } });
        fade(g, ramp(u, 4.2, 0.4), () => pieces(g, [['더 사려면 → Yes, ', ''], ['can I', 'pol'], [' also get ', 'frame'], ['a muffin', 'slot'], ['?', '']], LX, 316, 18));
        // 값
        const total = `That'll be ${CF.money(P.total)}.`;
        talk(g, { side: 'L', x: LX, y: 350, w: 700, text: total, marks: [[CF.money(P.total), 'key']], kind: 'barista', sp: 'us', at: 6.6, u, roleAt: 7.4, size: 24 });
        fade(g, ramp(u, 8.2, 0.4), () => tag(g, `→ ${CF.priceWords(P.total)}`, LX + 420, 376, COL.ante, { size: 18, h: 38 }));
        fade(g, ramp(u, 12.2, 0.4), () => {
          panel(g, LX, 430, 680, 140, { fill: COL.panel, stroke: COL.faint });
          txt(g, '값 읽기 → 점 앞 + 점 뒤', LX + 20, 456, { size: 16, weight: 700, color: COL.muted });
          [650, 425, 500, 1075].forEach((c, i) => fade(g, ramp(u, 12.6 + i * 0.6, 0.4), () => {
            const x = LX + 20 + (i % 2) * 330, y = 496 + Math.floor(i / 2) * 44;
            txt(g, CF.money(c), x, y, { size: 22, weight: 700, fam: FM, color: COL.accent });
            txt(g, '→ ' + CF.priceWords(c), x + 96, y, { size: 19, weight: 600, color: COL.en });
            say(x - 4, y - 18, 310, 36, CF.priceWords(c));
          }));
        });
        fade(g, ramp(u, 5.8, 0.5), () => receiptDraw(g, 840, 150, 330, D, { shown: (u - 6.0) / 0.5 }));
      });
      if (u >= 17.8) fade(g, ramp(u, 18.0, 0.4), () => {
        const [qid, a, lit] = CF.SCENE.pay;
        talk(g, { side: 'L', x: LX, y: 150, w: 700, text: CF.Q[qid].en, marks: Qm(qid), kind: 'barista', sp: 'us', at: 18.2, u, roleAt: 18.8, size: 24 });
        answer(g, { x: LX, y: 222, w: 700, A: a, at: 19.6, u, size: 24, verdict: { ok: true, at: 20.4 } });
        answer(g, { x: LX, y: 300, w: 700, A: lit, at: 21.0, u, size: 24, trapAt: 21.6, strikeAt: 21.7, tag: ['‘카드 계산’ 그대로 → 어색해요', COL.trap, 22.0], tagX: LX + 10, tagY: 300 + 26 });
        const [rq, ra] = CF.SCENE.receipt;
        talk(g, { side: 'L', x: LX, y: 396, w: 700, text: CF.Q[rq].en, marks: Qm(rq), kind: 'barista', sp: 'us', at: 29.6, u, roleAt: 30.2, size: 24 });
        answer(g, { x: LX, y: 468, w: 700, A: ra, at: 31.2, u, size: 24, verdict: { ok: true, at: 32.0 } });
        // 단말기
        const state = u < 25.4 ? 'tap' : u < 26.6 ? 'ok' : 'tip';
        fade(g, ramp(u, 23.6, 0.4), () => {
          reader(g, 880, 160, { amount: CF.money(P.total), state, tap: u < 26.6 ? (u - 24.2) / 1.0 : null });
          if (state === 'tip') fade(g, ramp(u, 26.6, 0.4), () => { txt(g, '팁을 고르는 화면', 1100, 220, { size: 15, weight: 700, color: COL.accent }); txt(g, '나라 · 가게마다', 1100, 246, { size: 14, weight: 600, color: COL.muted }); txt(g, '문화가 달라요', 1100, 268, { size: 14, weight: 600, color: COL.muted }); });
          txt(g, 'tap → 카드를 대요', 965, 450, { size: 17, weight: 700, color: COL.soft, align: 'center' });
        });
      });
    },

    /* 07 받기와 문제가 생겼을 때 */
    pickup(g, u) {
      if (S.req) {
        const a = S.req.a, j = CF.judge('pk_help', a, { need: S.req.need }, '상황');
        talk(g, { side: 'L', x: LX, y: 150, w: 800, text: CF.Q.pk_help.en, marks: Qm('pk_help'), kind: 'barista2', sp: 'au', all: true, u: 99, size: 24 });
        const L = lay(g, ansToks(a), { x: W / 2, y: 290, size: 32, align: 'center', maxW: 1080 });
        drawLay(g, L); mark(g, j.ok, L.x + L.w + 30, 290, 20); say(L.x, 264, L.w, 52, CF.text(a));
        const R = richLay(g, why2(j), [], 18, 1080, { weight: 600 });
        richDraw(g, R, W / 2 - R.w / 2, 360, { color: j.ok ? COL.good : COL.trap });
        tag(g, `상황 → ${CF.factKo('need', S.req.need)}`, W / 2, 470, COL.clause, { align: 'center', size: 18, h: 40 });
        return;
      }
      const d = CF.DEMO;
      fade(g, 1 - ramp(u, 21.2, 0.4), () => {
        // 픽업대와 컵
        fade(g, ramp(u, 0.4, 0.5), () => {
          panel(g, 860, 150, 340, 380, { fill: COL.panel, stroke: COL.faint });
          rr(g, 870, 470, 320, 20, 6); g.fillStyle = COL.wood; g.fill();
          chip(g, 'PICKUP', 1030, 176, { size: 13, fam: FM, weight: 700, color: '#1D1305', fill: COL.accent, h: 26, r: 6, align: 'center' });
          const hot = u >= 6.0, sl = clamp((u - 0.6) / 0.8);
          cupDraw(g, lerp(1240, 1030, ease(sl)), 470, { temp: hot ? 'hot' : 'iced', drink: d.drink, s: 1.5, label: hot ? CF.cupLines(Object.assign({}, d, { temp: 'hot' })) : CF.cupLines(d), name: d.name, steam: hot, u });
          if (hot) fade(g, ramp(u, 6.0, 0.4), () => tag(g, '주문: 아이스 · 나온 것: 따뜻한', 1030, 512, COL.trap, { align: 'center', size: 14, h: 30 }));
        });
        const q = CF.simQ('pk_call', d);
        talk(g, { side: 'L', x: LX, y: 150, w: 740, text: q.en, marks: [['Medium iced latte', 'slot'], ...Qm(q)], kind: 'barista2', sp: 'au', at: 1.0, u, roleAt: 2.0, size: 26 });
        answer(g, { x: LX, y: 226, w: 740, A: CF.SCENE.call[1], at: 3.6, u, size: 26, verdict: { ok: CF.judge(q, CF.SCENE.call[1], d).ok, at: 4.4 } });
        // 다르게 나옴
        const [wrong, ok] = CF.SCENE.wrong;
        talk(g, { side: 'L', x: LX, y: 312, w: 740, text: CF.Q.pk_help.en, marks: Qm('pk_help'), kind: 'barista2', sp: 'au', at: 10.6, u, roleAt: 11.2, size: 24 });
        answer(g, { x: LX, y: 386, w: 740, A: wrong, at: 12.2, u, size: 24, trapAt: 13.0, strikeAt: 13.1, tag: ['따지는 말처럼 들려요', COL.trap, 13.4, 16.0], tagX: LX + 10, tagY: 386 + 26 });
        answer(g, { x: LX, y: 470, w: 760, A: ok, at: 16.2, u, size: 22, verdict: { ok: true, at: 17.4 } });
        fade(g, ramp(u, 18.0, 0.4), () => tag(g, '무엇이 다른지 차분히', LX, 446 - 30, COL.clause, { size: 15, h: 30 }));
      });
      // 부탁 틀
      const inB = S.req ? 0 : win(u, 21.4, 32.4);
      if (inB > 0.001 && u >= 21.2) fade(g, inB, () => {
        template(g, [{ t: 'Could', r: 'pol' }, { t: 'I', r: 'pol' }, { t: 'get', r: 'frame' }, { blank: true }, { t: ',', r: '' }, { t: 'please', r: 'pol' }, { t: '?', r: '' }],
          CF.SCENE.could.map(k => ({ k, t: CF.SLOT.need.vals[k].t })), W / 2, 210, u, { size: 38, align: 'center', chipY: 290, chipX: W / 2, chipDx: 250, chipAt: 21.8, fills: [['lid', 22.6], ['straw', 24.4], ['napkins', 26.0]], say: c => `Could I get ${c.t}, please?`, okAt: 23.2 });
        const [give, could] = CF.SCENE.needBlunt;
        answer(g, { x: LX, y: 370, w: 760, A: give, at: 27.2, u, size: 24, trapAt: 27.8, strikeAt: 27.9, tag: ['명령처럼 들려요', COL.trap, 28.2], tagX: 860, tagY: 370 + 26 });
        answer(g, { x: LX, y: 452, w: 760, A: could, at: 29.0, u, size: 26, verdict: { ok: true, at: 29.8 } });
        fade(g, ramp(u, 30.2, 0.4), () => tag(g, '부탁을 질문으로 → 공손해요', 860, 452 + 28, COL.verb));
      });
    },

    /* 08 한 번에 말하기: 질문 여섯 → 한 문장 → 건너뛴 질문 → 남은 질문 → 순서가 뒤섞이면 → 6 → 2 */
    oneline(g, u) {
      const L = S.line || CF.LINE, lab = !!S.line, a = { f: 'line', line: L }, C = lab ? {} : CF.DEMO;
      const QS6 = ['co_what', 'sz_size', 'tp_temp', 'op_milk', 'op_shot', 'nm_togo'];
      // 질문 여섯 (하나씩 기다리면)
      if (!lab) fade(g, ramp(u, 0.4, 0.4) * (1 - ramp(u, 5.8, 0.4)), () => {
        txt(g, '하나씩 기다리면 → 여섯 번 주고받기', LX, 166, { size: 20, weight: 700, color: COL.soft });
        QS6.forEach((qid, i) => fade(g, ramp(u, 0.8 + i * 0.5, 0.4), () => {
          const x = LX + (i % 2) * 560, y = 226 + Math.floor(i / 2) * 76, q = CF.Q[qid];
          circ(g, x + 18, y, 18, COL.panel2); txt(g, String(i + 1), x + 18, y + 1, { size: 16, weight: 700, fam: FM, color: COL.accent, align: 'center' });
          const R = richLay(g, q.en, Qm(qid), 22, 480, { weight: 500 }); richDraw(g, R, x + 50, y, { color: COL.en });
          listen(x + 46, y - 18, R.w + 8, 36, [{ text: q.en, sp: 'us' }]);
        }));
        fade(g, ramp(u, 4.2, 0.4), () => txt(g, '한 문장에 순서대로 넣으면?', LX, 486, { size: 22, weight: 800, fam: FD, color: COL.accent }));
      });
      // 한 문장 만들기
      const segs = CF.segs(a);
      if (lab || u >= 6.0) fade(g, lab ? 1 : ramp(u, 6.0, 0.4) * (1 - ramp(u, 23.6, 0.3)), () => {
        txt(g, '틀 → Can I get a + 크기 + 온도 + 음료 + with 옵션 + 포장?', LX, 160, { size: 18, weight: 700, color: COL.muted });
        const toks = ansToks(a), Ly = lay(g, toks, { x: LX, y: 236, size: 32, maxW: 1120 });
        // 낱말 조각마다 범주 이름 (위쪽). ansToks와 같은 방법으로 조각 → 조각이 온 segs
        const segOf = [];
        segs.forEach(s => s.t.split(/\s+/).filter(Boolean).forEach(w => { const m = w.match(/^(.*?)([.,?!]*)$/); if (m[1]) segOf.push(s); if (m[2]) m[2].split('').forEach(() => segOf.push(s)); }));
        let lastPart = null;
        Ly.items.forEach((it, k) => {
          const sg = segOf[k] || {}, on = lab || u >= 6.4 + k * 0.45;
          fade(g, on ? ramp(u, lab ? -9 : 6.4 + k * 0.45, 0.3) : 0, () => {
            drawTok(g, it, { next: Ly.items[k + 1] });
            if (sg.part && sg.part !== lastPart) {
              const cat = CF.OCAT[sg.part], col = { size: COL.ante, temp: COL.ante, drink: COL.clause, with: COL.verb, togo: COL.rel }[sg.part];
              txt(g, cat.ko, it.x, it.y - 34, { size: 14, weight: 700, color: col });
            }
          });
          if (sg.part) lastPart = sg.part; else lastPart = null;
        });
        say(Ly.x, 210, Ly.w, 52, CF.text(a));
        const ord = CF.orderLine(L.words);
        if (lab) {
          mark(g, ord.ok, Ly.x + Ly.w + 26, 236, 18);
          const R = richLay(g, ord.why, [], 17, 1120, { weight: 600 }); richDraw(g, R, LX, 292, { color: ord.ok ? COL.good : COL.trap });
        } else fade(g, ramp(u, 10.6, 0.3), () => mark(g, true, Ly.x + Ly.w + 26, 236, 18));
      });
      // 일곱 단계 띠: 건너뛴 질문
      const cov = ord_cov(a, C);
      const stripA = lab ? 1 : ramp(u, 12.0, 0.4) * (1 - ramp(u, 23.6, 0.3));
      if (stripA > 0.001) fade(g, stripA, () => bigStrip(g, lab ? 360 : 330, cov, lab ? 99 : u, 12.4));
      // 남은 질문
      if (!lab) fade(g, ramp(u, 18.2, 0.4) * (1 - ramp(u, 23.6, 0.3)), () => {
        talk(g, { side: 'L', x: LX, y: 462, w: 560, text: 'Got it. Would you like an extra shot?', marks: [['Got it', 'ok'], ['extra shot', 'key']], kind: 'barista', sp: 'us', at: 18.6, u, roleAt: 19.6, size: 22 });
        answer(g, { x: 640, y: 462, w: 280, A: CF.o('of_yes'), at: 20.6, u, size: 22, verdict: { ok: true, at: 21.2 } });
        fade(g, ramp(u, 21.6, 0.4), () => { const R = richLay(g, 'Can I get a name for that?', Qm('nm_name'), 20, 300, { weight: 500 }); richDraw(g, R, 940, 488, { color: COL.en }); txt(g, '그리고 →', 940, 456, { size: 14, weight: 700, color: COL.muted }); });
      });
      if (lab) {
        const ck = CF.coveredKo(CF.covered(a, 'co_what'), { drink: (CF.lineFacts(L.words).drink) });
        txt(g, ck.length ? `바리스타가 건너뛸 질문 → ${ck.join(' · ')}` : '음료만 말했으니 나머지는 바리스타가 차례로 물어요', LX, 540, { size: 18, weight: 700, color: ck.length ? COL.good : COL.soft });
        return;
      }
      // 순서가 뒤섞이면
      if (u >= 23.6) fade(g, ramp(u, 23.8, 0.4) * (1 - ramp(u, 29.8, 0.3)), () => {
        const bad = { f: 'line', line: CF.LINE_BAD }, ord = CF.orderLine(CF.LINE_BAD.words);
        txt(g, '순서가 뒤섞이면', LX, 166, { size: 20, weight: 700, color: COL.soft });
        answer(g, { x: LX, y: 196, w: 1120, A: bad, at: 24.2, u, size: 26, trapAt: 25.2, strikeAt: 25.3 });
        fade(g, ramp(u, 25.6, 0.4), () => { const R = richLay(g, ord.why, [], 18, 1100, { weight: 600 }); richDraw(g, R, LX, 300, { color: COL.trap }); });
        answer(g, { x: LX, y: 400, w: 1120, A: a, at: 27.2, u, size: 26, verdict: { ok: true, at: 28.0 } });
      });
      // 6 → 2
      if (u >= 29.8) fade(g, ramp(u, 30.0, 0.5), () => {
        txt(g, '음료부터 포장까지 주고받는 횟수', W / 2, 172, { size: 22, weight: 700, color: COL.soft, align: 'center' });
        const big = (n, x, c, l) => { txt(g, String(n), x, 300, { size: 120, weight: 800, fam: FD, color: c, align: 'center' }); txt(g, l, x, 392, { size: 20, weight: 700, color: COL.soft, align: 'center' }); };
        big(6, 380, COL.muted, '하나씩 기다리면');
        arrow(g, 500, 290, 760, 290, COL.accent, 4);
        big(2, 880, COL.good, '한 문장으로 말하면');
        txt(g, '(음료 + 샷 질문)', 880, 422, { size: 15, weight: 600, color: COL.muted, align: 'center' });
        fade(g, ramp(u, 31.6, 0.4), () => tag(g, '순서 규칙 = 자주 쓰는 순서를 단순하게 줄인 것', W / 2, 500, COL.muted, { align: 'center', size: 16 }));
      });
    },

    /* 09 3단계 말하기 법: 상자 셋 + 단계마다 한 줄이 단계별로 채워짐 */
    method(g, u) {
      const BOX = [['①', '열쇠 낱말 잡기', '음료 · 크기 · 온도 · 우유 · 이름 · 포장 · 계산', COL.ante, 5.5], ['②', '틀에 내 정보 넣기', '고른 것 + please · Can I get + 음료?', COL.rel, 11.5], ['③', '공손하게 끝내기', 'please · thanks · Can I get …? · Sorry?', COL.verb, 17.5]];
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
      CF.METHOD.forEach(([qid, a], i) => {
        const y = 300 + i * 39, q = CF.Q[qid], p = CF.PLACE[q.place], dim = sel != null && sel !== i;
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
            say(670, y - 16, 530, 32, CF.text(a));
          });
        });
      });
    },

    /* 10 실전: 주문 카드 하나로 넷 */
    practice(g, u) {
      const pi = u < PSEG[1] ? 0 : u < PSEG[2] ? 1 : u < PSEG[3] ? 2 : 3, v = u - PSEG[pi];
      const P = CF.PRACTICE[pi], q = CF.Q[P.q], C = CF.PCARD;
      const a = ramp(v, 0, 0.5) * (pi < 3 ? 1 - ramp(u, PSEG[pi + 1] - 0.4, 0.4) : 1);
      fade(g, a, () => {
        txt(g, `대화 ${pi + 1} / 4 · ${CF.PLACE[q.place].ko}`, LX, 150, { size: 16, weight: 500, fam: FM, color: COL.accent });
        orderCard(g, LX, 172, 330, C, { rh: 32, skip: [6], hl: { co_what: 1, tp_temp: 1, nm_togo: 4, pa_more: 5 }[P.q] });
        talk(g, { side: 'L', x: 432, y: 172, w: 768, text: q.en, marks: Qm(P.q), kind: 'barista', sp: q.sp, at: PT.q, u: v, roleAt: PT.lines[0] + 0.4, size: 22 });
        const J = P.opts.map(o => CF.judge(q, o, C));
        const goneAt = k => { const s = J[k].stage; if (!s) return null; const same = P.opts.map((_, i) => i).filter(i => J[i].stage === s); return [0, PT.s1, PT.s2, PT.s3][s] + same.indexOf(k) * 1.1; };
        P.opts.forEach((o, k) => {
          const y = 262 + k * 60, gA = goneAt(k), won = k === P.a && v >= PT.win;
          fade(g, ramp(v, PT.opt[k], 0.4), () => {
            if (won) { rr(g, 432, y - 24, 768, 48, 10); g.fillStyle = 'rgba(127,224,168,0.08)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
            txt(g, `(${'ABC'[k]})`, 446, y, { size: 18, weight: 500, fam: FM, color: gA != null && v >= gA ? COL.dim : COL.muted });
            const gone = gA != null && v >= gA;
            const parts = ansParts(o).map(([t, r]) => [t, gone ? 'dim' : (v >= PT.lines[1] + 0.4 || won) ? r : '']);
            const w = pieces(g, parts, 494, y, 21, 600, { color: gone ? COL.dim : COL.text });
            say(490, y - 18, w + 10, 36, CF.text(o));
            if (gone) { const p = clamp((v - gA) / 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(440, y + 1); g.lineTo(440 + (w + 64) * p, y + 1); g.stroke();
              fade(g, ramp(v, gA + 0.3, 0.3), () => tag(g, `${['', '①', '②', '③'][J[k].stage]} 탈락`, 1180, y, COL.trap, { align: 'right', size: 15, h: 30 })); }
            if (won) mark(g, true, 1170, y, 17);
          });
        });
        if (pi === 3) fade(g, ramp(v, PT.win + 0.6, 0.4), () => { const t = CF.price(C).total; tag(g, `합계 ${CF.money(t)} → ${CF.priceWords(t)}`, 1200, 424, COL.ante, { align: 'right', size: 15, h: 30 }); });
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
        ['door', '문 · 줄', 'ready to order', [['Not yet. Just a minute, ', 'frame'], ['please', 'pol'], ['.', 'frame']]],
        ['counter', '주문대', 'What can I get · What would you like', [['Can I', 'pol'], [' get ', 'frame'], ['a latte', 'slot'], ['? · ', 'frame'], ['I\'d like', 'pol'], [' … , ', 'frame'], ['please', 'pol']]],
        ['size', '크기 · 온도', 'What size · Hot or iced (or = 고르기)', [['Medium', 'slot'], [', ', 'frame'], ['please', 'pol'], [' · ', 'frame'], ['Iced', 'slot'], [', ', 'frame'], ['please', 'pol']]],
        ['option', '옵션', 'kind of milk · extra shot · Room for milk', [['Oat milk', 'slot'], [', ', 'frame'], ['please', 'pol'], [' · Yes, ', 'frame'], ['please', 'pol'], [' / No, ', 'frame'], ['thanks', 'pol']]],
        ['name', '이름 · 포장', 'name · For here or to go', [['It\'s ', 'frame'], ['Minji', 'slot'], ['. · ', 'frame'], ['To go', 'slot'], [', ', 'frame'], ['please', 'pol']]],
        ['pay', '계산대', 'Anything else · Card or cash · receipt', [['No, that\'s it. ', 'frame'], ['Thanks', 'pol'], ['. · ', 'frame'], ['Card', 'slot'], [', ', 'frame'], ['please', 'pol']]],
        ['pickup', '픽업대', 'for + 내 이름 · help', [['That\'s me. ', 'frame'], ['Thanks', 'pol'], ['! · ', 'frame'], ['Could I', 'pol'], [' get ', 'frame'], ['a lid', 'slot'], [', ', 'frame'], ['please', 'pol'], ['?', 'frame']]],
        [null, '한 번에 주문', '크기 → 온도 → 음료 → with → 포장', [['Can I', 'pol'], [' get a ', 'frame'], ['medium iced latte', 'slot'], [' with ', 'frame'], ['oat milk', 'slot'], [' ', 'frame'], ['to go', 'slot'], ['?', 'frame']]],
        [null, '못 알아들었을 때', '빠른 말 · 처음 듣는 말', [['Sorry', 'pol'], [', for here or to go? · ', 'frame'], ['Could you', 'pol'], [' say that again, ', 'frame'], ['please', 'pol'], ['?', 'frame']]],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 10, { fill: COL.panel, stroke: COL.faint });
        ['단계', '열쇠 낱말', '대답 틀'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 16, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 6, 1120, 1);
      });
      rows.forEach(([pid, nm, keys, ans], ri) => fade(g, ramp(u, 1.0 + ri * 0.4, 0.5), () => {
        const y = Y0 + RH * (ri + 1) + 14;
        circ(g, X[0] + 32, y, 15, COL.panel2);
        if (pid) icon(g, pid, X[0] + 32, y, 18, COL.soft);
        else txt(g, ri === 7 ? '+' : '?', X[0] + 32, y + 1, { size: 18, weight: 800, color: COL.verb, align: 'center' });
        txt(g, nm, X[0] + 58, y, { size: fit(g, nm, 18, X[1] - X[0] - 70, 700), weight: 700 });
        txt(g, keys, X[1] + 20, y, { size: fit(g, keys, 16, X[2] - X[1] - 34, 600), weight: 600, color: COL.ante });
        pieces(g, ans, X[2] + 20, y, 17, 1196 - X[2] - 30);
      }));
    },
  };

  // 03장 컵 셋 (S · M · L)과 온도
  function cupsPanel(g, x, y, want, u, o = {}) {
    fade(g, 1, () => {
      panel(g, x, y, 380, 300, { fill: COL.panel, stroke: COL.faint });
      CF.SIZES.forEach((sz, i) => {
        const cx = x + 74 + i * 116, on = want && want.size === sz;
        if (on) { rr(g, cx - 54, y + 30, 108, 196, 12); g.fillStyle = 'rgba(127,224,168,0.10)'; g.fill(); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
        cupDraw(g, cx, y + 200, { size: sz, temp: want && want.temp === 'iced' ? 'iced' : 'hot', drink: 'latte', s: 0.9 });
        txt(g, sz, cx, y + 216, { size: 16, weight: 700, color: on ? COL.good : COL.en, align: 'center' });
        say(cx - 50, y + 30, 100, 196, sz);
        if (o.point && sz === 'large') arrow(g, cx - 96, y + 150, cx - 42, y + 132, COL.accent, 3);
      });
      [['hot', 'Hot', '따뜻한'], ['iced', 'Iced', '차가운']].forEach(([k, en, ko], i) => {
        const bx = x + 40 + i * 160, on = want && want.temp === k;
        rr(g, bx, y + 236, 140, 48, 10); g.fillStyle = on ? 'rgba(127,224,168,0.12)' : COL.panel2; g.fill(); g.strokeStyle = on ? COL.good : COL.faint; g.lineWidth = on ? 2 : 1.5; g.stroke();
        icon(g, k, bx + 26, y + 260, 24, on ? COL.good : COL.soft);
        txt(g, en, bx + 48, y + 252, { size: 17, weight: 700, color: COL.en }); txt(g, ko, bx + 48, y + 272, { size: 12, weight: 600, color: COL.muted });
        say(bx, y + 236, 140, 48, en);
      });
    });
  }
  // 08장 큰 띠: 한 문장이 답한 단계에 ✓와 ‘건너뜀’
  function ord_cov(a, C) { return CF.covered(a, 'co_what').filter(i => !(i === 'room' && C.drink !== 'americano')); }
  function bigStrip(g, y, cov, u, at) {
    const x0 = 150, dx = 163;
    g.strokeStyle = COL.faint; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dx * 6, y); g.stroke();
    const STEP_INTENTS = [['ready'], ['order'], ['size', 'temp'], ['milk', 'shot'], ['name', 'togo'], ['more', 'pay', 'receipt'], ['call']];
    CF.PLACES.forEach((p, i) => {
      const x = x0 + i * dx, ints = STEP_INTENTS[i], done = ints.filter(t => cov.includes(t));
      const part = i === 1 ? 'said' : done.length === ints.length ? 'skip' : done.length ? 'half' : 'ask';
      const a = ramp(u, at + i * 0.25, 0.4);
      const col = part === 'said' ? COL.accent : part === 'skip' ? COL.good : part === 'half' ? COL.clause : COL.muted;
      circ(g, x, y, 24, COL.panel2); ring(g, x, y, 24, a > 0.5 ? col : COL.faint, 2);
      icon(g, p.id, x, y, 24, a > 0.5 && part !== 'ask' ? col : COL.soft);
      txt(g, p.ko, x, y + 42, { size: fit(g, p.ko, 15, 150, 700), weight: 700, color: COL.soft, align: 'center' });
      fade(g, a, () => {
        const lab = part === 'said' ? '한 문장으로 말함' : part === 'skip' ? '건너뜀' : part === 'half' ? `${done.map(t => CF.INTENT_KO[t]).join(' · ')} 건너뜀` : i < 5 && i > 1 ? '물어봐요' : '';
        if (lab) txt(g, lab, x, y + 66, { size: fit(g, lab, 14, 158, 700), weight: 700, color: col, align: 'center' });
        if (part === 'skip' || part === 'said') { circ(g, x + 20, y - 20, 11, col); check(g, x + 20, y - 20, 11, '#10151C'); }
      });
    });
  }
  // 05장 이어서 들리는 말: 위 = 쓰인 낱말 (이어지는 곳은 호), 아래 = 들리는 소리 (세게 = 크고 높게)
  function linked(g, L, x, y, u, at) {
    fade(g, ramp(u, at, 0.4), () => {
      const size = 30, gap = 22; let xx = x; const pos = [];
      L.words.forEach(w => { const ww = tw(g, w, size, 600); pos.push([xx, ww]); xx += ww + gap; });
      L.words.forEach((w, i) => { txt(g, w, pos[i][0], y, { size, weight: 600, color: COL.en }); });
      listen(x - 6, y - 24, xx - x, 48, [{ text: L.en, sp: 'us', rate: 1.35 }]);
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

  CFS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[CFS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    if (ch.place != null) strip(g, Array.isArray(ch.place) ? (u < 6 ? ch.place[0] : ch.place[1]) : ch.place, ramp(u, 0.2, 0.5));
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, CFS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + CF.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔✓×?!~=+-/:…‘’\'%$É';
  CFS.baseText = EXTRA;
  CFS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = CFS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { CFS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
