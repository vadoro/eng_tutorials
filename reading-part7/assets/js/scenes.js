/* Part 7 독해 튜토리얼 — 영상 장면
 *
 * RV.render(g, t)는 시각 t와 사용자 상태 RV.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 무대의 주인공은 짧은 글(이메일 · 공지 · 광고 · 문자 · 표)이에요. 글은 낱말 조각으로 배치하고(layDoc),
 * 근거 문장은 보라 바탕과 밑줄, 질문 키워드는 하늘, 바꿔 말한 말은 노랑, 그대로 반복한 함정은 주황, 글 사이 연결은 민트로 그립니다.
 * 글이 둘 · 셋인 장면은 작은 글자 대신 카메라(withCam)로 다가가 읽어요.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(R7.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const R7 = window.R7;
  const RV = (window.RV = {});
  const W = 1280, H = 720;
  RV.W = W; RV.H = H;
  const L4 = 'ABCD';

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  RV.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36', paper: '#1A222D',
    accent: '#FFC15E', en: '#BFE3FF', bad: '#FF6B6B', good: '#7FE0A8',
    // 역할 색 (페이지 CSS의 --c-key 등과 같은 뜻): 키워드 하늘 · 근거 보라 · 바꿔 말한 답 노랑 · 글 사이 연결 민트 · 함정 주황 · 넣을 자리 분홍
    key: '#6EC8FF', ev: '#C9A7FF', para: '#FFC15E', link: '#7FE0A8', trap: '#FF9F7A', gap: '#FF7AA8',
  };
  RV.COL = COL;
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (RV.S = { fmt: null, pair: null, qsel: null, cell: null, notk: null, syn: null, ins: null, lnk: null, view: null, mtype: null });
  RV.DEFAULTS = JSON.stringify(S);
  let HITS = [], CAM = { x: 0, y: 0, z: 1 }, CLIP = null;
  RV.hits = () => HITS;

  // 글자를 그리는 곳은 모두 txt()를 지남 → 글꼴을 미리 받을 글자를 모을 수 있음
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
  function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  function fade(g, a, fn) { if (a <= 0.001) return; g.save(); g.globalAlpha *= Math.min(1, a); fn(); g.restore(); }
  function arrowHead(g, x, y, ang, color, s = 11) {
    g.fillStyle = color; g.beginPath(); g.moveTo(x, y);
    g.lineTo(x - Math.cos(ang - 0.45) * s, y - Math.sin(ang - 0.45) * s);
    g.lineTo(x - Math.cos(ang + 0.45) * s, y - Math.sin(ang + 0.45) * s); g.closePath(); g.fill();
  }
  function arrow(g, x0, y0, x1, y1, color, lw = 2.5) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - Math.cos(ang) * 8, y1 - Math.sin(ang) * 8); g.stroke();
    arrowHead(g, x1, y1, ang, color);
  }
  // 곡선 화살표: 조절점(cx, cy)을 지나는 2차 곡선. p: 그려진 정도. 돌려주는 값: 곡선 가운데 점
  function curve(g, x0, y0, cx, cy, x1, y1, color, p = 1, o = {}) {
    const N = 40, n = Math.max(2, Math.round(N * clamp(p)));
    const pt = k => { const s = k / N; return [(1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * cx + s * s * x1, (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * cy + s * s * y1]; };
    if (p > 0.001) {
      g.save(); g.strokeStyle = color; g.lineWidth = o.lw || 2.4; g.lineCap = 'round';
      if (o.dash !== false) g.setLineDash([7, 6]);
      g.beginPath(); for (let k = 0; k <= n; k++) { const [x, y] = pt(k); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.restore();
      if (p > 0.97 && o.head !== false) { const [ax, ay] = pt(N), [bx, by] = pt(N - 2); arrowHead(g, ax, ay, Math.atan2(ay - by, ax - bx), color, 12); }
    }
    return pt(N / 2);
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
    rr(g, x0, y - h / 2, w, h, o.r || h / 2);
    g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash(o.dash); g.stroke(); g.setLineDash([]); }
    txt(g, s, x0 + w / 2, y + 1, { size, weight: o.weight || 600, color: o.color || COL.text, align: 'center', fam: o.fam });
    return { x: x0, y: y - h / 2, w, h };
  }
  const tag = (g, s, x, y, color, o = {}) => chip(g, s, x, y, Object.assign({ size: 13, weight: 700, color, fill: 'rgba(16,21,28,0.92)', stroke: color, h: 24, pad: 8, lw: 1.2 }, o));
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash(o.dash); g.stroke(); g.setLineDash([]); }
  }
  const say = (x, y, w, h, text) => {
    const r = { x: x * CAM.z + CAM.x, y: y * CAM.z + CAM.y, w: w * CAM.z, h: h * CAM.z, say: text };
    if (CLIP && (r.x + r.w / 2 < CLIP.x || r.x + r.w / 2 > CLIP.x + CLIP.w || r.y + r.h / 2 < CLIP.y || r.y + r.h / 2 > CLIP.y + CLIP.h)) return;
    HITS.push(r);
  };
  // 줄 바꿈 글 (한국어 설명). 돌려주는 값: 줄 수 · 줄마다 너비
  function wrapText(g, s, x, y, maxW, o = {}) {
    const size = o.size || 16, lh = o.lh || size * 1.45, words = String(s).split(' '), lines = [''];
    words.forEach(w => { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (tw(g, t, size, o.weight || 500) > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; });
    const ws = lines.map((l, i) => txt(g, l, x, y + i * lh, Object.assign({ size, weight: 500 }, o)));
    return { n: lines.length, ws };
  }
  // 카메라: 그 안에서 그린 것은 (x, y)를 z배 해서 옮김. clip: 화면 좌표의 창
  function withCam(g, c, clip, fn) {
    g.save();
    if (clip) { g.beginPath(); g.rect(clip.x, clip.y, clip.w, clip.h); g.clip(); }
    g.translate(c.x, c.y); g.scale(c.z, c.z);
    const pc = CAM, pl = CLIP; CAM = c; CLIP = clip || null;
    try { fn(); } finally { CAM = pc; CLIP = pl; g.restore(); }
  }
  const scr = (c, r) => r && { x: r.x * c.z + c.x, y: r.y * c.z + c.y, w: r.w * c.z, h: r.h * c.z, cx: r.cx * c.z + c.x, cy: r.cy * c.z + c.y, top: r.top * c.z + c.y, bot: r.bot * c.z + c.y };
  // 사각형 rect(글 좌표)가 창 view에 꽉 차게 보이는 카메라
  const focus = (rect, view, zmax = 1.7) => { const z = Math.min(zmax, view.w / rect.w, view.h / rect.h); return { z, x: view.x + (view.w - rect.w * z) / 2 - rect.x * z, y: view.y + (view.h - rect.h * z) / 2 - rect.y * z }; };
  const ID = { x: 0, y: 0, z: 1 };
  // 열쇠 장면들 사이를 부드럽게: keys = [[시각, 카메라, 걸리는 시간], ...]
  function camAt(u, keys) {
    let c = keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t0, k, d = 1.2] = keys[i];
      if (u < t0) break;
      const p = ease(clamp((u - t0) / d));
      c = { x: lerp(c.x, k.x, p), y: lerp(c.y, k.y, p), z: lerp(c.z, k.z, p) };
    }
    return c;
  }

  /* ---------- 글 배치 ----------
   * layDoc(g, 글, o) → 낱말 조각(toks)과 단위별 상자. o: { x, y, w, size, lh, head, headSize, headLines, marks(삽입 표시 보이기), ins: { n: 문장 }, parGap }
   *   조각: { s 단위(-1 머리말), t 글자, r: '' | 'mark' | 'ins' | 'meta' | 'th', n, c(칸), x, y, w, size, weight, fam, line }
   */
  const NORM = s => String(s).replace(/[‘’“”"(),.;:!?]/g, '').toLowerCase();
  function layHead(g, Dc, o, L) {
    if (o.head === false || !(Dc.head && Dc.head.length)) return L.y;
    const hs = o.headSize || Math.round(o.size * 0.7), hl = hs * 1.55, lines = o.headLines || Dc.head;
    lines.forEach((h, i) => {
      let x = L.x;
      h.split(' ').forEach(w => { const ww = tw(g, w, hs, 500, FM); L.toks.push({ s: -1, t: w, x, y: L.y + i * hl, w: ww, size: hs, weight: 500, fam: FM, r: 'head', i, line: -1 - i }); x += ww + tw(g, ' ', hs, 500, FM); });
    });
    return L.y + lines.length * hl + o.size * 0.5;
  }
  function layDoc(g, Dc, o) {
    const size = o.size || 19, lh = o.lh || size * 1.58;
    const L = { D: Dc, kind: Dc.kind, x: o.x, y: o.y, w: o.w, size, lh, toks: [], box: {}, U: R7.units(Dc) };
    let y = layHead(g, Dc, o, L);
    if (Dc.kind === 'chat') y = layChat(g, Dc, o, L, y);
    else if (Dc.kind === 'form') y = layForm(g, Dc, o, L, y);
    else y = layProse(g, Dc, o, L, y);
    L.bottom = y;
    return L;
  }
  RV.layDoc = layDoc;
  function layProse(g, Dc, o, L, y0) {
    const size = L.size, lh = L.lh, sp = size * 0.28, maxW = o.w, gap = o.parGap == null ? size * 0.55 : o.parGap;
    const toks = [], lineY = [0];
    let x = 0, line = 0, par = -1;
    const nl = extra => { line++; x = 0; lineY[line] = lineY[line - 1] + lh + extra; };
    const put = tk => { if (x > 0 && x + sp + tk.w > maxW) nl(0); if (x > 0) x += sp; tk.x = x; tk.line = line; x += tk.w; toks.push(tk); };
    L.U.forEach((u, s) => {
      if (o.from != null && (s < o.from || s > o.to)) return;
      if (u.par !== par) { if (par >= 0 && toks.length) nl(gap); par = u.par; }
      if (u.type === 'mark') {
        if (o.ins && o.ins[u.n]) o.ins[u.n].split(' ').forEach(w => put({ s, t: w, r: 'ins', n: u.n, w: tw(g, w, size, 600), size, weight: 600 }));
        else if (o.marks) { const ms = size * 0.7; put({ s, t: `[${u.n}]`, r: 'mark', n: u.n, w: tw(g, `[${u.n}]`, ms, 700) + size * 0.55, size: ms, weight: 700 }); }
        return;
      }
      u.text.split(' ').forEach(w => put({ s, t: w, r: '', w: tw(g, w, size, 500), size, weight: 500 }));
    });
    toks.forEach(t => { t.x += L.x; t.y = y0 + lineY[t.line]; });
    L.toks.push(...toks);
    return y0 + lineY[line] + size * 0.75;
  }
  function layChat(g, Dc, o, L, y0) {
    const size = L.size, lh = size * 1.42, ms = Math.round(size * 0.72), indent = size * 2.1, pad = size * 0.55, maxW = o.w - indent - pad * 2;
    let y = y0 + ms * 0.4;
    Dc.msgs.forEach((m, s) => {
      if (o.from != null && (s < o.from || s > o.to)) return;
      let x = L.x + indent;
      const metaY = y;
      [[m.who, 700, COL.soft], [m.time, 500, COL.muted]].forEach(([str, wt], j) => str.split(' ').forEach(w => {
        const ww = tw(g, w, ms, wt);
        L.toks.push({ s, t: w, x, y: metaY, w: ww, size: ms, weight: wt, fam: FB, r: 'meta', mj: j, line: -1 });
        x += ww + tw(g, ' ', ms, wt);
      }) || (x += ms * 0.6));
      y += ms * 0.9 + size * 0.95;
      const ty = y; let lx = 0, line = 0, maxLine = 0;
      const toks = [];
      m.t.split(' ').forEach(w => {
        const ww = tw(g, w, size, 500);
        if (lx > 0 && lx + size * 0.28 + ww > maxW) { line++; lx = 0; }
        if (lx > 0) lx += size * 0.28;
        toks.push({ s, t: w, x: L.x + indent + pad + lx, y: ty + line * lh, w: ww, size, weight: 500, fam: FB, r: '', line });
        lx += ww; maxLine = Math.max(maxLine, lx);
      });
      L.toks.push(...toks);
      const bh = (line + 1) * lh + pad * 0.6;
      L.box[s] = { x: L.x + indent, y: ty - size * 0.82, w: maxLine + pad * 2, h: bh, metaY, who: m.who, av: { x: L.x + size * 0.85, y: metaY + size * 0.45 } };
      y = ty - size * 0.82 + bh + size * 0.75;
    });
    return y - size * 0.4;
  }
  function layForm(g, Dc, o, L, y0) {
    const size = L.size, n = Dc.rows[0].length, rh = size * 1.95, pad = size * 0.6;
    const meas = (s, wt) => tw(g, s, size, wt);
    const cw = Array.from({ length: n }, (_, c) => Math.max(Dc.cols ? meas(Dc.cols[c], 700) : 0, ...Dc.rows.map(r => meas(r[c], c === 0 && !Dc.cols ? 600 : 500))) + pad * 2);
    const sum = cw.reduce((a, b) => a + b, 0), k = o.w / sum;
    const xs = [L.x]; cw.forEach((w, c) => xs.push(xs[c] + w * k));
    L.cols = xs; L.rh = rh;
    let y = y0;
    const cell = (s, c, str, wt, r) => { let x = xs[c] + pad * k * 0.8; str.split(' ').forEach(w => { const ww = tw(g, w, size, wt); L.toks.push({ s, c, t: w, x, y: y + rh / 2, w: ww, size, weight: wt, fam: FB, r, line: 0 }); x += ww + tw(g, ' ', size, wt); }); };
    if (Dc.cols) { L.thY = y; Dc.cols.forEach((h, c) => cell(-2, c, h, 700, 'th')); y += rh; }
    L.gridTop = Dc.cols ? L.thY : y;
    Dc.rows.forEach((r, s) => { L.box[s] = { x: L.x, y, w: o.w, h: rh, cells: xs.slice(0, -1).map((x0, c) => ({ x: x0, y, w: xs[c + 1] - x0, h: rh })) }; r.forEach((v, c) => cell(s, c, v, c === 0 && !Dc.cols ? 600 : 500, '')); y += rh; });
    L.gridBot = y;
    // 표 아래 글
    const R = Dc.rows.length;
    (Dc.foot || []).forEach((f, j) => {
      const s = R + j; let x = 0, line = 0; y += j ? size * 0.25 : size * 0.7;
      const ty = y + size * 0.55;
      f.split(' ').forEach(w => { const ww = tw(g, w, size * 0.92, 500); if (x > 0 && x + size * 0.26 + ww > o.w) { line++; x = 0; } if (x > 0) x += size * 0.26; L.toks.push({ s, t: w, x: L.x + x, y: ty + line * size * 1.45, w: ww, size: size * 0.92, weight: 500, fam: FB, r: '', line }); x += ww; });
      y = ty + line * size * 1.45 + size * 0.55;
    });
    return y + size * 0.2;
  }
  // 단위 하나의 상자들 (줄마다 하나, 채팅은 말풍선, 표는 줄)
  function unitRects(L, s) {
    if (L.box[s]) return [L.box[s]];
    const by = {};
    L.toks.filter(t => t.s === s && t.r !== 'meta').forEach(t => { const k = t.line + ':' + t.y; const r = by[k] || (by[k] = { x: t.x, x1: t.x + t.w, y: t.y, size: t.size }); r.x = Math.min(r.x, t.x); r.x1 = Math.max(r.x1, t.x + t.w); });
    return Object.values(by).map(r => ({ x: r.x - 5, y: r.y - r.size * 0.78, w: r.x1 - r.x + 10, h: r.size * 1.56 }));
  }
  RV.unitRects = unitRects;
  // 조각 목록 ts에서 글자 묶음 text가 차지하는 상자들 (줄마다 하나)
  function spanToks(g, ts, text) {
    const want = String(text).split(' ').map(NORM);
    for (let i = 0; i + want.length <= ts.length; i++) {
      if (!want.every((w, k) => NORM(ts[i + k].t) === w)) continue;
      const seq = ts.slice(i, i + want.length), by = {};
      seq.forEach((t, k) => {
        let w = t.w;
        if (k === seq.length - 1) { const m = t.t.match(/[.,;:!?”’]+$/); if (m && !/^\d/.test(m[0])) w -= tw(g, m[0], t.size, t.weight, t.fam); }
        const key = t.y.toFixed(1); const r = by[key] || (by[key] = { x: t.x, x1: t.x + w, y: t.y, size: t.size }); r.x = Math.min(r.x, t.x); r.x1 = Math.max(r.x1, t.x + w);
      });
      return Object.values(by).map(r => ({ x: r.x - 3, y: r.y - r.size * 0.72, w: r.x1 - r.x + 6, h: r.size * 1.44 }));
    }
    return [];
  }
  const span = (g, L, s, text) => text ? spanToks(g, L.toks.filter(t => t.s === s), text) : unitRects(L, s);
  RV.span = span;
  // 상자 묶음의 가운데 · 위 · 아래
  const mid = rs => { if (!rs || !rs.length) return null; const x0 = Math.min(...rs.map(r => r.x)), x1 = Math.max(...rs.map(r => r.x + r.w)), y0 = Math.min(...rs.map(r => r.y)), y1 = Math.max(...rs.map(r => r.y + r.h)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, top: y0, bot: y1, first: rs[0] }; };
  const KIND_EN = { email: 'E-MAIL', notice: 'NOTICE', ad: 'ADVERTISEMENT', web: 'WEB PAGE', chat: 'TEXT MESSAGES', form: 'FORM' };
  // 종이 카드
  function paper(g, x, y, w, h, label, o = {}) {
    panel(g, x, y, w, h, { fill: COL.paper, stroke: o.stroke || COL.faint, lw: o.lw || 1.3, r: 14 });
    if (label) chip(g, label, x + 18, y, { size: 12, weight: 700, fam: FM, color: o.lcolor || COL.soft, fill: COL.panel2, stroke: o.lcolor || COL.faint, h: 22, pad: 9, lw: 1 });
  }
  /* 그리기. st: { dim(s) → 0~1 글자 진하기, hl: { s: 색 | { color, a } }, marks: [{ s, t, color, a }], glow(n) 삽입 자리 빛, say } */
  function drawDoc(g, L, st = {}) {
    const dim = st.dim || (() => 1), size = L.size;
    const hlOf = s => { const c = (st.hl || {})[s]; return !c ? null : typeof c === 'string' ? { color: c, a: 1 } : c; };
    // 표: 바탕 줄
    if (L.kind === 'form') {
      const D0 = L.D, x0 = L.x, x1 = L.cols[L.cols.length - 1];
      if (D0.cols) { rr(g, x0, L.thY, x1 - x0, L.rh, 6); g.fillStyle = COL.panel2; g.fill(); }
      g.strokeStyle = COL.faint; g.lineWidth = 1;
      for (let y = L.gridTop; y <= L.gridBot + 0.5; y += L.rh) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      L.cols.forEach(x => { g.beginPath(); g.moveTo(x, L.gridTop); g.lineTo(x, L.gridBot); g.stroke(); });
    }
    // 단위 바탕 (근거 보라 · 키워드 하늘 …)
    L.U.forEach((u, s) => {
      const h = hlOf(s); if (!h) return;
      fade(g, h.a, () => unitRects(L, s).forEach(r => {
        if (L.kind === 'chat') { rr(g, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 14); g.strokeStyle = h.color; g.lineWidth = 2.4; g.stroke(); return; }
        rr(g, r.x, r.y, r.w, r.h, L.kind === 'form' ? 4 : 7); g.fillStyle = hexA(h.color, 0.15); g.fill();
        if (L.kind !== 'form') { g.fillStyle = h.color; g.fillRect(r.x, r.y + r.h - 2.5, r.w, 2.5); }
        else { g.strokeStyle = h.color; g.lineWidth = 2; g.stroke(); }
      }));
    });
    if (st.cells) st.cells.forEach(c => { const b = L.box[c.s]; if (!b) return; const r = b.cells[c.c]; fade(g, c.a == null ? 1 : c.a, () => { rr(g, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 5); g.fillStyle = hexA(c.color, c.fill || 0.18); g.fill(); g.strokeStyle = c.color; g.lineWidth = 2.2; g.stroke(); }); });
    if (st.colHl) fade(g, st.colHl.a, () => { const c = st.colHl.c; rr(g, L.cols[c] + 2, L.gridTop + 2, L.cols[c + 1] - L.cols[c] - 4, L.gridBot - L.gridTop - 4, 6); g.fillStyle = hexA(st.colHl.color, 0.09); g.fill(); g.strokeStyle = hexA(st.colHl.color, 0.8); g.lineWidth = 1.6; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]); });
    // 말풍선
    if (L.kind === 'chat') Object.entries(L.box).forEach(([s, b]) => {
      const a = dim(+s), first = b.who === L.D.msgs[0].who;
      fade(g, 0.5 + 0.5 * a, () => {
        rr(g, b.x, b.y, b.w, b.h, 12); g.fillStyle = first ? '#22303D' : '#2A2738'; g.fill();
        g.beginPath(); g.arc(b.av.x, b.av.y, size * 0.72, 0, Math.PI * 2); g.fillStyle = first ? 'rgba(110,200,255,0.22)' : 'rgba(201,167,255,0.22)'; g.fill();
        txt(g, b.who.split(' ').map(w => w[0]).join(''), b.av.x, b.av.y + 1, { size: size * 0.62, weight: 700, color: first ? COL.key : COL.ev, align: 'center' });
      });
    });
    // 글자
    L.toks.forEach(t => {
      const a = t.s === -2 ? 1 : dim(t.s);
      if (t.r === 'mark') {
        const glow = st.glow ? st.glow(t.n) : 0, h = size * 1.08, ms = st.markState ? st.markState(t.n) : null;
        const c = ms === 'ok' ? COL.good : ms === 'no' ? COL.trap : COL.gap;
        rr(g, t.x, t.y - h / 2, t.w, h, 7);
        g.fillStyle = ms === 'ok' ? 'rgba(127,224,168,0.2)' : ms === 'no' ? 'rgba(255,159,122,0.08)' : `rgba(255,122,168,${0.1 + 0.2 * glow})`; g.fill();
        if (!ms) g.setLineDash([5, 4]);
        g.strokeStyle = c; g.lineWidth = 1.8 + glow; g.stroke(); g.setLineDash([]);
        txt(g, t.t, t.x + t.w / 2, t.y + 1, { size: t.size, weight: 700, color: c, align: 'center' });
        if (ms === 'no') { g.strokeStyle = COL.trap; g.lineWidth = 2; g.beginPath(); g.moveTo(t.x + 3, t.y + h / 2 - 3); g.lineTo(t.x + t.w - 3, t.y - h / 2 + 3); g.stroke(); }
        return;
      }
      const col = t.r === 'ins' ? (st.insColor || COL.para) : t.r === 'head' ? (t.i === 0 ? COL.soft : COL.muted) : t.r === 'meta' ? (t.mj ? COL.muted : COL.soft) : t.r === 'th' ? COL.soft : COL.text;
      fade(g, 0.28 + 0.72 * a, () => txt(g, t.t, t.x, t.y, { size: t.size, weight: t.weight, fam: t.fam, color: col }));
    });
    // 표시: 옅은 칠 + 테두리 (style 'under'는 밑줄만)
    (st.marks || []).forEach(m => {
      const a = m.a == null ? 1 : m.a;
      fade(g, a, () => span(g, L, m.s, m.t).forEach(r => {
        if (m.style === 'under') { g.fillStyle = m.color; g.fillRect(r.x + 2, r.y + r.h - 3, r.w - 4, 3); return; }
        rr(g, r.x, r.y, r.w, r.h, 6); g.fillStyle = hexA(m.color, 0.16); g.fill(); g.strokeStyle = m.color; g.lineWidth = 2; g.stroke();
      }));
    });
    // 발음 듣기: 단위마다
    if (st.say !== false) L.U.forEach((u, s) => { if (u.type === 'mark' && !L.toks.some(t => t.s === s && t.r === 'ins')) return; const text = u.type === 'mark' ? L.toks.filter(t => t.s === s && t.r === 'ins').map(t => t.t).join(' ') : u.type === 'row' ? u.cells.join(', ') : u.text; unitRects(L, s).forEach(r => { if (r.w > 0) say(r.x, r.y, r.w, r.h, text); }); });
  }
  RV.drawDoc = drawDoc;
  // 글 카드 하나를 배치 + 종이 + 그리기
  function docCard(g, Dc, x, y, w, o = {}, st = {}) {
    const pad = o.pad || 20;
    const L = layDoc(g, Dc, Object.assign({ x: x + pad, y: y + (o.top || 34), w: w - pad * 2 }, o));
    const h = o.h || L.bottom - y + (o.bottomPad || 18);
    paper(g, x, y, w, h, o.label === false ? '' : o.label || KIND_EN[Dc.kind], { stroke: o.stroke, lw: o.lw, lcolor: o.lcolor });
    drawDoc(g, L, st);
    L.card = { x, y, w, h };
    return L;
  }
  RV.docCard = docCard;

  /* ---------- 질문과 보기 ---------- */
  function layWords(g, text, x, y, w, o = {}) {
    const size = o.size || 19, lh = o.lh || size * 1.45, wt = o.weight || 500, sp = size * 0.28, toks = [];
    let lx = 0, line = 0;
    String(text).split(' ').forEach(t => { const ww = tw(g, t, size, wt); if (lx > 0 && lx + sp + ww > w) { line++; lx = 0; } if (lx > 0) lx += sp; toks.push({ t, x: x + lx, y: y + line * lh, w: ww, size, weight: wt, fam: FB, line }); lx += ww; });
    const lastW = toks.length ? toks[toks.length - 1].x + toks[toks.length - 1].w - x : 0;
    return { toks, x, y, w, size, lh, lines: line + 1, bottom: y + line * lh, lastW, text };
  }
  function drawWords(g, L, o = {}) {
    (o.marks || []).forEach(m => fade(g, m.a == null ? 1 : m.a, () => spanToks(g, L.toks, m.t).forEach(r => { rr(g, r.x, r.y, r.w, r.h, 6); g.fillStyle = hexA(m.color, 0.18); g.fill(); g.strokeStyle = m.color; g.lineWidth = 1.8; g.stroke(); })));
    L.toks.forEach(t => txt(g, t.t, t.x, t.y, { size: t.size, weight: t.weight, color: o.color || COL.text }));
  }
  // 질문 판: Q + 질문 글 + 보기 넷. st: { qmarks, state(k) → { st: 'open' | 'no' | 'win', p, tag, tc }, omarks: { k: [...] }, oa: 보기 진하기, size, osize, grid }
  function qPanel(g, q, x, y, w, st = {}) {
    const size = st.size || 20, os = st.osize || 18.5;
    let LQ = null, yy = y;
    if (q.q) {
      chip(g, 'Q', x + 14, y + size * 0.55, { size: 14, weight: 800, color: COL.bg, fill: COL.accent, h: 26, pad: 8, align: 'center' });
      LQ = layWords(g, q.q, x + 34, y + size * 0.55, w - 34, { size, weight: 600 });
      drawWords(g, LQ, { marks: st.qmarks });
      say(x + 30, y, w - 30, LQ.bottom - y + size * 0.7, q.q);
      yy = LQ.bottom + size * 1.9;
    }
    const rows = [], gridW = (w - 16) / 2;
    const oa = st.oa == null ? 1 : st.oa;
    g.save(); g.globalAlpha *= oa;      // 보이지 않아도 배치는 계산 (곡선 화살표가 보기 자리를 씀)
    q.opts.forEach((op, k) => {
      const s2 = st.state ? st.state(k) : { st: 'open' }, no = s2.st === 'no', win = s2.st === 'win';
      const gx = st.grid ? x + (k % 2) * (gridW + 16) : x, gy = st.grid ? yy + Math.floor(k / 2) * (os * 2.5) : yy, ow = st.grid ? gridW : w;
      txt(g, `(${L4[k]})`, gx + 4, gy, { size: os * 0.82, weight: 500, fam: FM, color: no ? COL.dim : COL.muted });
      const tx = gx + os * 2.1, LO = layWords(g, op.t, tx, gy, ow - os * 2.1 - 6, { size: os, weight: win ? 700 : 500 });
      drawWords(g, LO, { color: win ? COL.good : no ? COL.dim : COL.text, marks: (st.omarks || {})[k] });
      if (oa > 0.5) say(tx - 4, gy - os * 0.75, ow - os * 2.1, LO.bottom - gy + os * 1.5, op.t);
      if (no && s2.p > 0) { g.strokeStyle = COL.bad; g.lineWidth = 2.2; for (let i = 0; i < LO.lines; i++) { const lt = LO.toks.filter(t => t.line === i), x1 = lt[lt.length - 1].x + lt[lt.length - 1].w; const ly = gy + i * LO.lh + 1; g.beginPath(); g.moveTo(tx - 3, ly); g.lineTo(tx - 3 + (x1 - tx + 6) * s2.p, ly); g.stroke(); } }
      if (win) { rr(g, gx - 8, gy - os * 0.95, ow + 10, LO.bottom - gy + os * 1.9, 10); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
      let bottom = LO.bottom;
      if (s2.tag) {
        const twd = tw(g, s2.tag, 13, 700) + 16, fits = LO.lastW + 12 + twd < ow - os * 2.1 - 6;
        const tx2 = fits ? tx + LO.lastW + 12 : tx, ty2 = fits ? LO.bottom : LO.bottom + os * 1.35;
        fade(g, s2.ta == null ? 1 : s2.ta, () => tag(g, s2.tag, tx2, ty2, s2.tc || (no ? COL.trap : win ? COL.good : COL.soft)));
        if (!fits) bottom = ty2 + 8;
      }
      rows.push({ k, y: gy, L: LO, bottom });
      if (!st.grid) yy = bottom + os * (st.ogap || 1.75);
    });
    g.restore();
    return { LQ, rows, bottom: st.grid ? yy + os * 2.5 * 2 : yy };
  }
  RV.qPanel = qPanel;
  // 엔진 판정 → 보기 상태
  const verdict = (q, k, on, p = 1) => { const j = R7.judge(q, k); return on ? (j.s === 'ok' ? { st: 'win', tag: '정답', tc: COL.good } : { st: 'no', p, tag: j.name, ta: p }) : { st: 'open' }; };
  // 오른쪽 여백의 꺾쇠 화살표: from 줄 → to 줄 (글자를 가로지르지 않음)
  function bracket(g, xR, from, to, color, p, o = {}) {
    if (!from || !to || p <= 0.001) return;
    const x = xR + (o.i || 0) * 11, y0 = from.cy, y1 = to.cy, d = o.left ? -1 : 1;
    g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.arc(x - 9 * d, y0, 3.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x - 9 * d, y0); g.lineTo(x, y0); g.lineTo(x, lerp(y0, y1, clamp(p))); g.stroke();
    if (p > 0.95) { g.beginPath(); g.moveTo(x, y1); g.lineTo(x - 8 * d, y1); g.stroke(); arrowHead(g, x - 13 * d, y1, d > 0 ? Math.PI : 0, color, 9); }
    g.restore();
    if (o.label && p > 0.95) tag(g, o.label, d > 0 ? x + 7 : x - 7, (y0 + y1) / 2, color, { align: d > 0 ? 'left' : 'right' });
  }
  // 두 상자를 잇는 곡선 (글 사이 연결). 위로 휨
  function link(g, a, b, color, p, o = {}) {
    if (!a || !b || p <= 0.001) return null;
    const x0 = a.cx, y0 = o.below ? a.bot + 3 : a.top - 3, x1 = b.cx, y1 = o.below ? b.bot + 3 : b.top - 3;
    const cy = o.below ? Math.max(y0, y1) + (o.h || 50) : Math.min(y0, y1) - (o.h || 50);
    const m = curve(g, x0, y0, (x0 + x1) / 2 + (o.dx || 0), cy, x1, y1, color, p, { lw: o.lw || 2.6, dash: o.dash });
    if (o.label && p > 0.9) tag(g, o.label, m[0] + (o.lx || 0), m[1] + (o.ly || 0), color, { align: 'center', size: o.ls || 13, h: (o.ls || 13) * 1.85 });
    return m;
  }

  // 근거의 바꿔 말한 말 → 정답 보기: 글 카드 오른쪽 끝에서 보기 줄 왼쪽으로 (글자를 가로지르지 않음)
  function pairLine(g, L, s, t, row, color, p) {
    const a = mid(span(g, L, s, t));
    if (!a || !row || p <= 0.001) return;
    const x0 = L.card.x + L.card.w + 2, y0 = a.cy, x1 = row.L.x - 34, y1 = row.y;
    curve(g, x0, y0, (x0 + x1) / 2, Math.min(y0, y1) - 18, x1, y1, color, p, { lw: 2.4 });
  }

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '근거는 지문에, 답은 다른 말로', d: 24, caps: [
      [0.4, 5, '토익 **Part 7**은 독해예요. 이메일, 공지, 문자 같은 글을 읽고 질문에 답해요.'],
      [5, 10.5, '글부터 다 해석하지 않아요. 먼저 질문을 읽고 키워드를 찾아요 → the Harborview Inn.'],
      [10.5, 15.5, '키워드가 나오는 곳에서 **근거 문장**을 찾아 밑줄을 그어요 → fully booked.'],
      [15.5, 20, '함정은 (A) city marathon. 지문 낱말을 그대로 썼어요. 정답은 (B) no vacancies. 같은 뜻, 다른 말이에요.'],
      [20, 24, '근거는 지문에, 답은 다른 말로. 문제 유형과 **3단계 풀이법**을 차례로 배워요.'],
    ] },
    { id: 'format', n: '01', title: 'Part 7은 이런 문제', sub: '54문제 · 지문 세트 · 시간', d: 30, caps: [
      [0.4, 6, '읽기 시간은 75분, 문제는 100개예요. 그 가운데 54문제가 **Part 7**이에요.'],
      [6, 12, '지문은 하나짜리와 두 개, 세 개짜리 세트가 있어요. 두 개 · 세 개짜리 세트에는 문제가 다섯 개씩 나와요.'],
      [12, 18, '글의 종류도 여러 가지예요. 이메일, 공지, 광고, 기사, 문자와 채팅, 양식과 표.'],
      [18, 24, '글을 처음부터 다 해석하고 문제를 보면, 시간이 모자라기 쉬워요.'],
      [24, 30, '그래서 **질문 먼저**. 무엇을 찾을지 알고 읽으면 필요한 곳만 읽으면 돼요.'],
    ] },
    { id: 'core', n: '02', title: '근거는 지문에, 답은 다른 말로', sub: '바꿔 말하기와 그대로 반복', d: 32, caps: [
      [0.4, 6, '이 영상의 핵심이에요. 정답에는 늘 지문 속에 **근거 문장**이 있어요.'],
      [6, 12, '그런데 정답 보기는 근거를 그대로 옮기지 않아요. fully booked → no vacancies. 같은 뜻, **다른 말**이에요.'],
      [12, 18, '거꾸로, 지문 낱말을 그대로 쓴 보기는 함정일 때가 많아요. 낱말은 같아도 뜻이 달라요.'],
      [18, 25, '한국어도 같아요. ‘방이 다 찼어요’와 ‘빈방이 없어요’ → 낱말은 달라도 뜻은 같죠.'],
      [25, 32, '자주 나오는 바꿔 말하기예요. at no charge → free, postpone → move to a later date.'],
    ] },
    { id: 'purpose', n: '03', title: '목적과 요청', sub: '첫 문단 · please 문장', d: 30, caps: [
      [0.4, 6, '질문마다 근거가 있는 곳이 달라요. 먼저 **목적** 문제 → Why was the e-mail sent?'],
      [6, 12, '목적은 대개 **첫 문단**에 있어요. I am writing to let you know that … 그 뒤가 근거예요.'],
      [12, 18, 'out of service → cannot be used. 바꿔 말한 보기, 정답은 (B).'],
      [18, 24, '다음은 **요청** 문제 → What are … asked to do? 근거는 please, Could you 같은 말 뒤에 있어요.'],
      [24, 30, '키워드 a large delivery → 마지막 문단. please contact me → get in touch. 정답은 (C).'],
    ] },
    { id: 'detail', n: '04', title: '세부 정보와 표', sub: '키워드 훑기 · 필요한 칸만', d: 32, caps: [
      [0.4, 6, '**세부 정보** 문제는 날짜, 숫자, 조건을 물어요. 질문의 키워드로 지문을 훑어요.'],
      [6, 12, '키워드는 July 18. 그런데 지문에는 on the first day. 질문의 키워드도 바꿔 말해져 있어요.'],
      [12, 18, '회원은 오전 9시, 정답은 (B). 10시 → 다른 방문객의 시각이라 함정이에요.'],
      [18, 25, '**양식과 표**는 문장이 아니에요. 다 읽지 말고, 필요한 줄과 칸만 찾아요.'],
      [25, 32, 'Appointment cards 줄과 Quantity 칸이 만나는 곳 → 1,000. 옆 줄, 옆 칸의 숫자는 함정이에요.'],
    ] },
    { id: 'notinfer', n: '05', title: 'NOT과 추론', sub: '보기마다 대조 · 단서 모으기', d: 34, caps: [
      [0.4, 6, '**NOT 문제**는 지문에 없는 것을 골라요. 보기 넷을 하나씩 지문과 맞춰 봐요.'],
      [6, 12, '(A) three days → from July 18 to July 20. 바꿔 말했을 뿐, 지문에 있어요.'],
      [12, 18, '(B) less than → under, (C) credit card. 둘 다 지문에 있어요. 못 찾은 (D) → 정답이에요.'],
      [18, 26, '**추론** 문제는 most likely, suggested로 물어요. 답이 지문에 그대로 쓰여 있지 않아요.'],
      [26, 34, 'annual book sale → 해마다 여는 행사. 그러니 전에도 열었을 거예요. 정답은 (A).'],
    ] },
    { id: 'synonym', n: '06', title: '문맥 속 뜻', sub: '동의어 문제', d: 28, caps: [
      [0.4, 6, '**동의어** 문제예요. is closest in meaning to → 뜻이 가장 가까운 말을 골라요.'],
      [6, 12, '단어장에서 hold → ‘잡다’로 외웠나요? 그 뜻으로 고르면 함정이에요 → grasp.'],
      [12, 18, '영어 낱말은 뜻이 여럿이에요. 도서관 공지의 hold its annual book sale → ‘열다’, host.'],
      [18, 23, '호텔 이메일의 hold the room → 방을 ‘잡아 두다’, keep. 정답은 (C).'],
      [23, 28, '사전의 첫 뜻이 아니라 **그 문장 속 뜻**. 바꿔 넣어 읽어 보면 확인돼요.'],
    ] },
    { id: 'chatins', n: '07', title: '채팅과 문장 삽입', sub: '바로 앞 메시지 · 가리키는 말', d: 36, caps: [
      [0.4, 6, '문자와 채팅 지문에는 **의도 파악** 문제가 나와요. what does Ms. Park mean …?'],
      [6, 12, "인용한 말 → That's not it. 말 그대로는 뜻을 알 수 없어요. **바로 앞 메시지**를 봐요."],
      [12, 18, '앞 메시지 → Is the cable plugged in? 그러니 케이블 탓이 아니라는 뜻. 정답은 (A).'],
      [18, 24, '**문장 삽입**은 [1]부터 [4] 가운데 문장이 들어갈 자리를 골라요. Part 6의 문장 넣기와 같아요.'],
      [24, 30, '넣을 문장의 This panel → 가리키는 말이에요. 앞 문장에 패널이 나와야 해요.'],
      [30, 36, '[1] 앞 문장 → its control panel. 짝이 맞아요. 넣어 읽어 보면 흐름도 자연스러워요.'],
    ] },
    { id: 'linked', n: '08', title: '연계 지문', sub: '글 사이를 이어라', d: 40, caps: [
      [0.4, 6, '**이중 지문**은 두 글을 합쳐야 답이 나와요. 한 글에는 단서가 반쪽만 있어요.'],
      [6, 12.5, '이메일 → Deluxe package, 25 of us. 광고 → free for orders of 30 people or more.'],
      [12.5, 19, '25명은 30명보다 적어요. 그래서 무료 배달은 안 돼요. 두 글을 **잇는 선**이 답이에요.'],
      [19, 26, '**삼중 지문**은 글이 셋. 어느 글에 어떤 단서가 있는지부터 찾아요.'],
      [26, 33, '신청서 → 강의 이름. 일정표 → 그 강의는 Room B. 이메일 → 그 방의 강의는 다른 방으로, Room D.'],
      [33, 40, '그래서 정답은 Room D. Room B → 일정표만 본 옛 정보, 함정이에요.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: '질문 → 근거 → 바꿔 말하기', d: 26, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11, '① **질문 먼저**. 문제 유형과 키워드를 표시하고, 어디를 볼지 정해요.'],
      [11, 16.5, '② **근거 찾기**. 키워드를 지문에서 찾아 근거 문장에 밑줄. 연계 문제는 글 사이를 이어요.'],
      [16.5, 21.5, '③ **바꿔 말한 보기**. 그대로 반복한 말, 지문에 없는 말, 반대 말을 지워요.'],
      [21.5, 26, '질문 → 근거 → 바꿔 말하기. 이 순서로 실전 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: '광고 + 이메일, 문제 셋', d: 57, caps: [
      [0.4, 6.5, '실전 문제예요. 자전거 대여 광고와 이메일, 두 글짜리 세트예요. 1번 → Why did Ms. Song write the e-mail?'],
      [6.5, 13, '① 목적 문제 → 이메일 첫 문단으로. ② I am planning a team outing, would like to rent.'],
      [13, 19, '③ team outing → team event, rent → book. 정답은 (A).'],
      [19.4, 25.5, '2번 → What does Ms. Song ask about? ① 묻는 말은 Could you tell me whether … 뒤에 있어요.'],
      [25.5, 31.5, '② 근거 → whether we need to bring our own helmets. ③ helmets → safety gear.'],
      [31.5, 38, '그래서 정답은 (C). 주차, 가방 → 지문에 없는 말이라 지워요.'],
      [38.4, 44.5, "3번은 연계 문제 → What is indicated about Ms. Song's group? 두 글을 모두 봐요."],
      [44.5, 51, '이메일 → Six of us. 광고 → Groups of five or more receive 20 percent off. 여섯은 다섯 이상이에요.'],
      [51, 57, '20 percent off → a lower price. 정답은 (D). 세 문제 모두 근거를 찾고, 바꿔 말한 보기를 골랐어요.'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 Part 7', d: 20, caps: [
      [0.4, 5, '정리해요. 질문 먼저 읽고, 근거를 찾고, 바꿔 말한 보기를 골라요.'],
      [5, 10, '목적은 첫 문단, 요청은 please 뒤, 의도는 바로 앞 메시지, 표는 필요한 칸만.'],
      [10, 15, '지문 낱말을 그대로 쓴 보기, 지문에 없는 보기, 반대 보기는 지워요.'],
      [15, 20, '아래 근거 사냥 놀이터와 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  RV.CHAPTERS = CHAPTERS; RV.CAPTIONS = CAPTIONS; RV.END = END;
  RV.POSTER = CHAPTERS.find(c => c.id === 'linked').t + 37.6;
  RV.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  RV.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 영상 속 정답 표시가 규칙 엔진과 같은지 점검 (자막의 '정답은 (X)')
  const CAP_ANS = [['purpose', 'elev1'], ['purpose', 'elev2'], ['detail', 'lib1'], ['notinfer', 'lib3'], ['synonym', 'hotel3'], ['chatins', 'chat1'], ['practice', 'bike1'], ['practice', 'bike2'], ['practice', 'bike3']];
  CAP_ANS.forEach(([ch, id]) => {
    const q = R7.Q[id], L = `(${L4[R7.answer(q)[0]]})`;
    if (!CHAPTERS.find(c => c.id === ch).caps.some(c => c[2].includes(`정답은 ${L}`))) console.warn('[Part 7] 자막의 정답이 규칙 엔진과 달라요:', id, L);
  });
  if (R7.answer(R7.Q.hotel1)[0] !== 1 || R7.answer(R7.Q.lib2)[0] !== 3 || R7.answer(R7.Q.ws1)[0] !== 3 || R7.answer(R7.Q.elev3)[0] !== 0) console.warn('[Part 7] 영상 속 정답이 규칙 엔진과 달라요');

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  // 오른쪽 단계 표시 ① ② ③
  function stepper(g, x, y, k, a = 1) {
    fade(g, a, () => { let xx = x; ['① 질문 먼저', '② 근거 찾기', '③ 바꿔 말한 보기'].forEach((s, i) => {
      const on = i === k, c = on ? COL.accent : COL.dim;
      const r = chip(g, s, xx, y, { size: 14.5, weight: 700, color: on ? COL.bg : c, fill: on ? COL.accent : 'rgba(16,21,28,0.6)', stroke: on ? COL.accent : COL.faint, h: 30, pad: 10 });
      xx = r.x + r.w + 10;
    }); });
  }
  // 회색 막대 줄 (글의 모양만)
  function bars(g, x, y, ws, size) { ws.forEach(w => { rr(g, x, y - size * 0.22, w, size * 0.44, size * 0.22); g.fillStyle = 'rgba(238,241,244,0.13)'; g.fill(); x += w + 8; }); }
  function miniDoc(g, x, y, w, h, label, rows, o = {}) {
    panel(g, x, y, w, h, { fill: COL.paper, stroke: o.stroke || COL.faint, lw: o.lw || 1.2, r: 10 });
    if (label) txt(g, label, x + 12, y + 16, { size: 11, weight: 700, fam: FM, color: o.lc || COL.muted });
    rows.forEach((r, i) => bars(g, x + 12, y + 36 + i * 15, r, 14));
  }

  const SCENES = {
    /* 00 들어가며: 제목 → 이메일 + 질문 → 키워드 → 근거 → 함정과 바꿔 말한 정답 → 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.0, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '답은 지문에 있다,', W / 2, 262, { size: 62, weight: 800, fam: FD, align: 'center' });
        txt(g, '다른 말로', W / 2, 342, { size: 62, weight: 800, fam: FD, align: 'center', color: COL.accent });
        txt(g, 'TOEIC Part 7 · Reading Comprehension', W / 2, 410, { size: 24, weight: 500, color: COL.muted, align: 'center' });
      });
      [['질문 먼저', COL.key], ['근거 찾기', COL.ev], ['바꿔 말한 보기', COL.para]].forEach(([s, c], i) => {
        const a = ramp(u, 1.3 + i * 0.25, 0.4) * out1;
        fade(g, a, () => chip(g, `${'①②③'[i]} ${s}`, W / 2 - 220 + i * 220, 488 + (1 - a) * 10, { size: 19, weight: 700, color: c, fill: COL.panel2, stroke: c, align: 'center', h: 40 }));
      });
      const q = R7.Q.hotel1, Dh = R7.DOCS.hotel, a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 19.6, 0.6));
      fade(g, a2, () => {
        const evOn = ramp(u, 10.8, 0.6), judged = u > 15.8, win = u > 17.6;
        const L = docCard(g, Dh, 80, 156, 640, { size: 20, headSize: 14.5, headLines: ['From: Mia Torres, Harborview Inn · To: Daniel Cho', 'Date: March 3 · Subject: Your reservation request'] }, {
          dim: s => s === 1 || s === 3 && judged ? 1 : 1 - 0.6 * evOn,
          hl: { 1: { color: COL.ev, a: evOn } },
          marks: [{ s: 0, t: 'the Harborview Inn', color: COL.key, a: ramp(u, 7.4, 0.5) * (1 - evOn) }, { s: 1, t: 'fully booked', color: COL.para, a: ramp(u, 11.8, 0.5) }, { s: 1, t: 'city marathon', color: COL.trap, a: ramp(u, 15.8, 0.5) }, { s: 3, t: 'It', color: COL.trap, a: ramp(u, 16.6, 0.5) }],
        });
        const order = [15.8, 0, 16.6, 17.2];
        const P = qPanel(g, q, 756, 178, 452, { qmarks: [{ t: 'the Harborview Inn', color: COL.key, a: ramp(u, 6.0, 0.5) }], oa: ramp(u, 5.2, 0.6),
          state: k => win && k === q.a ? { st: 'win', tag: '정답 · 바꿔 말함', tc: COL.good } : k !== q.a && u > order[k] ? { st: 'no', p: ramp(u, order[k], 0.4), tag: R7.judge(q, k).name, ta: ramp(u, order[k], 0.4) } : { st: 'open' },
          omarks: { 0: [{ t: 'city marathon', color: COL.trap, a: ramp(u, 15.8, 0.5) }], 1: [{ t: 'no vacancies', color: COL.para, a: ramp(u, 17.6, 0.5) }] } });
        stepper(g, 756, 552, u < 10.6 ? 0 : u < 15.5 ? 1 : 2, ramp(u, 6.0, 0.5));
        pairLine(g, L, 1, 'fully booked', P.rows[1], COL.para, ramp(u, 17.8, 0.8));
      });
      const steps = [['①', '질문 먼저', '유형 · 키워드'], ['②', '근거 찾기', '근거 문장에 밑줄'], ['③', '바꿔 말한 보기', '그대로 반복은 함정']];
      steps.forEach(([n, t1, t2], k) => {
        const a = ramp(u, 20.2 + k * 0.6, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 220, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 285 + (1 - a) * 16, { size: 34, weight: 700, color: [COL.key, COL.ev, COL.para][k] });
          txt(g, t1, x0 + 28, 345 + (1 - a) * 16, { size: 25, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 400 + (1 - a) * 16, { size: 19, weight: 500, color: COL.soft });
        });
      });
    },

    /* 01 Part 7은 이런 문제: 75분 · 100문제 중 54, 지문 세트, 글 종류, 해석부터 ↔ 질문 먼저 */
    format(g, u) {
      fade(g, ramp(u, 0.5, 0.6), () => {
        panel(g, 80, 148, 560, 192, { fill: COL.panel, stroke: COL.faint });
        txt(g, '읽기 75분 · 100문제', 104, 182, { size: 22, weight: 800, fam: FD, color: COL.soft });
        const parts = [['Part 5', 30], ['Part 6', 16], ['Part 7', 54]];
        let x = 104;
        parts.forEach(([p, n], i) => {
          const w = n / 100 * 512, a = ramp(u, 1.0 + i * 0.5, 0.6), hot = i === 2;
          fade(g, a, () => {
            rr(g, x, 210, w - 5, 76, 10); g.fillStyle = hot ? 'rgba(255,193,94,0.22)' : COL.panel2; g.fill(); g.strokeStyle = hot ? COL.accent : COL.dim; g.lineWidth = hot ? 2.4 : 1.2; g.stroke();
            txt(g, p, x + 12, 236, { size: 17, weight: 700, color: hot ? COL.accent : COL.soft });
            txt(g, `${n}문제`, x + 12, 264, { size: 15, weight: 600, color: COL.muted });
          });
          x += w;
        });
        fade(g, ramp(u, 2.6, 0.5), () => txt(g, 'Part 7 = 54문제 · 읽기 문제의 절반이 넘어요', 104, 314, { size: 17, weight: 700, color: COL.accent }));
      });
      // 지문 세트
      const sets = [['지문 하나', 1, '두세 문제씩'], ['지문 둘', 2, '다섯 문제'], ['지문 셋', 3, '다섯 문제']];
      fade(g, ramp(u, 6.2, 0.6), () => {
        panel(g, 664, 148, 536, 192, { fill: COL.panel, stroke: COL.faint });
        sets.forEach(([s, n, q2], i) => {
          const x0 = 686 + i * 174, on = S.fmt != null ? S.fmt === i : u >= 7.0 + i * 1.2, a = ramp(u, 6.6 + i * 0.6, 0.5) * (S.fmt != null && !on ? 0.45 : 1);
          fade(g, a, () => {
            for (let k = 0; k < n; k++) miniDoc(g, x0 + k * 15, 166 + k * 11, 104, 82, '', [[56, 24], [70], [44, 20]], { stroke: on ? COL.link : COL.faint, lw: on ? 2 : 1.1 });
            txt(g, s, x0, 296, { size: 18, weight: 700, color: on ? COL.link : COL.soft });
            txt(g, q2, x0, 322, { size: 14.5, weight: 600, color: COL.muted });
          });
        });
      });
      // 글 종류
      const kinds = [['이메일', 'e-mail'], ['공지', 'notice'], ['광고', 'advertisement'], ['기사', 'article'], ['문자', 'text-message chain'], ['채팅', 'online chat'], ['양식', 'form'], ['청구서', 'invoice'], ['일정표', 'schedule']];
      let kx = 80, ky = 376;
      kinds.forEach(([ko, en], i) => {
        const w = tw(g, `${ko} ${en}`, 17, 700) + 28;
        if (kx + w > 1210) { kx = 80; ky += 46; }
        const x = kx, y = ky, a = ramp(u, 12.2 + i * 0.35, 0.4);
        kx += w + 10;
        fade(g, a, () => { const c = chip(g, `${ko} ${en}`, x, y, { size: 17, weight: 700, color: COL.soft, fill: COL.panel2, stroke: COL.faint, h: 38, pad: 14 }); say(c.x, c.y, c.w, c.h, en); });
      });
      // 해석부터 ↔ 질문 먼저
      const rowY = [492, 548];
      fade(g, ramp(u, 18.2, 0.6), () => {
        txt(g, '해석부터', 80, rowY[0], { size: 18, weight: 700, color: COL.trap });
        const p1 = ramp(u, 18.6, 3.2);
        rr(g, 200, rowY[0] - 15, 700, 30, 8); g.fillStyle = COL.panel; g.fill();
        rr(g, 200, rowY[0] - 15, 700 * p1, 30, 8); g.fillStyle = 'rgba(255,159,122,0.28)'; g.fill();
        txt(g, '지문 전체를 처음부터 해석', 216, rowY[0], { size: 15, weight: 700, color: COL.soft });
        if (p1 > 0.98) { const c = chip(g, '문제', 912, rowY[0], { size: 15, weight: 700, color: COL.soft, fill: COL.panel2, stroke: COL.faint, h: 30 }); tag(g, '시간이 모자라기 쉬워요', c.x + c.w + 10, rowY[0], COL.trap, { size: 15, h: 30, pad: 10 }); }
      });
      fade(g, ramp(u, 24.2, 0.6), () => {
        txt(g, '질문 먼저', 80, rowY[1], { size: 18, weight: 700, color: COL.good });
        let x = 200;
        [['질문', COL.key], ['키워드', COL.key], ['근거 찾기', COL.ev], ['보기 고르기', COL.para]].forEach(([s, c], i) => {
          const a = ramp(u, 24.6 + i * 0.5, 0.4), w = tw(g, s, 15, 700) + 24;
          const x0 = x;
          fade(g, a, () => { chip(g, s, x0, rowY[1], { size: 15, weight: 700, color: c, fill: COL.panel2, stroke: c, h: 30, pad: 12 }); if (i < 3) arrow(g, x0 + w + 6, rowY[1], x0 + w + 34, rowY[1], COL.accent, 2.2); });
          x += w + 42;
        });
        fade(g, ramp(u, 26.8, 0.5), () => tag(g, '필요한 곳만 읽어요', x + 4, rowY[1], COL.good, { size: 15, h: 30, pad: 10 }));
      });
    },

    /* 02 근거는 지문에, 답은 다른 말로: 근거 문장 · (B) 바꿔 말함 ↔ (A) 그대로 반복 · 한국어 · 바꿔 말하기 짝 */
    core(g, u) {
      const q = R7.Q.hotel1, Dh = R7.DOCS.hotel;
      const Ls = layDoc(g, Dh, { x: 110, y: 196, w: 1060, size: 28, head: false, from: 1, to: 1 });
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 86, 156, 1108, Ls.bottom - 156 + 14, { fill: COL.paper, stroke: COL.ev, lw: 1.6 });
        tag(g, '근거 문장', 104, 156, COL.ev);
        drawDoc(g, Ls, { marks: [{ s: 1, t: 'fully booked', color: COL.para, a: ramp(u, 6.4, 0.5) }, { s: 1, t: 'city marathon', color: COL.trap, a: ramp(u, 12.4, 0.5) }], hl: { 1: { color: COL.ev, a: ramp(u, 1.6, 0.6) * 0.6 } } });
      });
      // 보기 둘 (나란히)
      const rows = [[1, 6.2, 100], [0, 12.2, 660]];
      rows.forEach(([k, t0, x0]) => fade(g, ramp(u, t0 - 0.6, 0.5), () => {
        const y = 340, ok = k === q.a, on = u > t0 + 1.0, c = ok ? COL.para : COL.trap;
        panel(g, x0, y - 30, 520, 60, { fill: COL.panel, stroke: on ? (ok ? COL.good : COL.bad) : COL.faint, lw: on ? 2.2 : 1.2, r: 12 });
        txt(g, `(${L4[k]})`, x0 + 18, y, { size: 16, fam: FM, color: COL.muted });
        const LO = layWords(g, q.opts[k].t, x0 + 62, y, 420, { size: 23, weight: 600 });
        drawWords(g, LO, { marks: [{ t: ok ? 'no vacancies' : 'city marathon', color: c, a: ramp(u, t0 + 0.4, 0.5) }] });
        say(x0 + 56, y - 22, 430, 44, q.opts[k].t);
        if (on) mark(g, ok, x0 + 494, y, 18);
        const from = mid(span(g, Ls, 1, ok ? 'fully booked' : 'city marathon')), to = mid(spanToks(g, LO.toks, ok ? 'no vacancies' : 'city marathon'));
        if (from && to) curve(g, from.cx, from.bot + 2, (from.cx + to.cx) / 2, (from.bot + to.top) / 2, to.cx, to.top - 2, c, ramp(u, t0 + 0.2, 0.8), { lw: 2.4 });
        fade(g, ramp(u, t0 + 1.0, 0.5), () => tag(g, ok ? '같은 뜻 · 다른 말 → 정답' : '같은 낱말 · 다른 뜻 → 함정', x0 + 260, y + 52, ok ? COL.good : COL.trap, { size: 16, h: 32, pad: 12, align: 'center' }));
      }));
      // 한국어도 같아요
      fade(g, ramp(u, 18.2, 0.6), () => {
        panel(g, 80, 428, 520, 136, { fill: COL.panel2, stroke: COL.faint });
        txt(g, '한국어도 같아요', 104, 456, { size: 16, weight: 700, color: COL.muted });
        let x = 104;
        x += txt(g, '방이 다 찼어요', x, 500, { size: 25, weight: 700 });
        txt(g, '=', x + 14, 500, { size: 25, weight: 700, color: COL.para });
        txt(g, '빈방이 없어요', x + 42, 500, { size: 25, weight: 700, color: COL.para });
        txt(g, '낱말은 달라도 뜻은 같아요', 104, 538, { size: 16, weight: 600, color: COL.soft });
      });
      // 바꿔 말하기 짝
      const PAIRS = R7.PARA.slice(0, 4);
      fade(g, ramp(u, 24.8, 0.5), () => {
        panel(g, 620, 428, 580, 136, { fill: COL.panel2, stroke: COL.faint });
        txt(g, '자주 나오는 바꿔 말하기', 644, 452, { size: 15, weight: 700, color: COL.muted });
        PAIRS.forEach((p, i) => {
          const x = 644, y = 482 + i * 23.5, on = S.pair == null || S.pair === i, a = ramp(u, 25.2 + i * 0.5, 0.4) * (on ? 1 : 0.35);
          fade(g, a, () => {
            const w1 = txt(g, p.text, x, y, { size: 17, weight: 600, color: COL.ev });
            arrow(g, x + w1 + 8, y, x + w1 + 30, y, COL.accent, 2);
            const w2 = txt(g, p.same, x + w1 + 38, y, { size: 17, weight: 700, color: COL.para });
            txt(g, p.ko, 1180, y, { size: 13.5, weight: 600, color: COL.muted, align: 'right' });
            say(x - 4, y - 11, w1 + 42 + w2, 22, `${p.text}, ${p.same}`);
          });
        });
      });
      if (S.pair != null && S.pair >= 4) {
        const p = R7.PARA[S.pair];
        chip(g, `${p.text} → ${p.same}`, 910, 400, { size: 16, weight: 700, color: COL.para, fill: COL.panel, stroke: COL.para, h: 30, align: 'center' });
      }
    },

    /* 03 목적과 요청: 엘리베이터 이메일, 질문 둘 */
    purpose(g, u) {
      const Dc = R7.DOCS.elevator, sel = S.qsel, second = sel ? sel === 'request' : u >= 18.0;
      const q = second ? R7.Q.elev2 : R7.Q.elev1, v = second ? (sel ? 30 : u) - 18 : (sel ? 18 : u);
      const evOn = ramp(v, second ? 6.0 : 7.0, 0.6), judged = v > (second ? 7.4 : 12.0), win = v > (second ? 8.6 : 13.6);
      const please = second && v > 1.6;
      fade(g, ramp(u, 0.4, 0.6), () => {
        const L = docCard(g, Dc, 80, 156, 640, { size: 19.5, headSize: 14, headLines: ['From: Grace Lim, Facilities Office · To: All staff', 'Date: May 2 · Subject: Elevator maintenance'] }, {
          dim: s => s === q.ev[0].s ? 1 : 1 - 0.55 * evOn,
          hl: { [q.ev[0].s]: { color: COL.ev, a: evOn } },
          marks: (second ? [{ s: 3, t: 'please', color: COL.key, a: please ? ramp(v, 1.6, 0.5) : 0 }, { s: 7, t: 'please', color: COL.key, a: please ? ramp(v, 1.6, 0.5) : 0 }, { s: 7, t: 'a large delivery', color: COL.key, a: ramp(v, 6.4, 0.5) }]
            : [{ s: 0, t: 'I am writing to', color: COL.key, a: ramp(v, 6.6, 0.5) }]).concat([
            { s: q.ev[0].s, t: second ? 'contact me' : 'out of service', color: COL.para, a: ramp(v, second ? 8.6 : 12.4, 0.5) },
          ]).concat(judged ? q.opts.map(x => x.rel === 'same' && x.src ? { s: x.src.s, t: x.src.t, color: COL.trap, a: ramp(v, second ? 7.4 : 12.0, 0.5) } : null).filter(Boolean) : []),
        });
        if (!second) {
          const p0 = mid(L.U.map((uu, s) => uu.par === 0 && uu.type === 'sent' ? unitRects(L, s) : []).flat());
          if (p0) fade(g, ramp(v, 6.0, 0.5), () => { g.strokeStyle = COL.key; g.lineWidth = 2.4; g.beginPath(); g.moveTo(L.x - 8, p0.top + 2); g.lineTo(L.x - 12, p0.top + 2); g.lineTo(L.x - 12, p0.bot - 2); g.lineTo(L.x - 8, p0.bot - 2); g.stroke(); tag(g, '목적 → 첫 문단', L.card.x + L.card.w - 16, L.card.y, COL.key, { align: 'right', size: 14, h: 26 }); });
        } else fade(g, ramp(v, 1.6, 0.5), () => tag(g, '요청 → please · Could you', L.card.x + L.card.w - 16, L.card.y, COL.key, { align: 'right', size: 14, h: 26 }));
        const order = second ? [7.4, 7.9, 0, 8.3] : [12.0, 0, 12.5, 13.0];
        const P = qPanel(g, q, 756, 178, 452, { qmarks: q.key.map(t => ({ t, color: COL.key, a: ramp(v, 1.8, 0.5) })), oa: ramp(v, 0.8, 0.5),
          state: k => win && k === q.a ? { st: 'win', tag: '정답 · 바꿔 말함', tc: COL.good } : k !== q.a && v > order[k] ? { st: 'no', p: ramp(v, order[k], 0.4), tag: R7.judge(q, k).name, ta: ramp(v, order[k], 0.4) } : { st: 'open' },
          omarks: { [q.a]: (q.opts[q.a].pairs || []).map(([, y]) => ({ t: y, color: COL.para, a: ramp(v, second ? 8.6 : 13.6, 0.5) })) } });
        stepper(g, 756, 552, v < 6.0 ? 0 : v < (second ? 7.4 : 12.0) ? 1 : 2, ramp(v, 1.8, 0.5));
        pairLine(g, L, q.ev[0].s, second ? 'contact me' : 'out of service', P.rows[q.a], COL.para, ramp(v, second ? 8.8 : 13.8, 0.8));
      });
    },

    /* 04 세부 정보와 표: 도서관 공지(키워드도 바꿔 말함) → 청구서(줄 × 칸) */
    detail(g, u) {
      const formPart = S.cell ? true : u >= 18.0;
      if (!formPart) {
        const q = R7.Q.lib1, Dc = R7.DOCS.library;
        const scan = ramp(u, 6.0, 2.2), found = u > 8.4, judged = u > 12.4, win = u > 13.6;
        fade(g, ramp(u, 0.4, 0.6) * (1 - ramp(u, 17.4, 0.5)), () => {
          const L = docCard(g, Dc, 80, 156, 640, { size: 20, headSize: 14.5 }, {
            dim: s => found ? (s === 2 || (judged && s === 3) ? 1 : 0.4) : 1,
            hl: found ? { 2: { color: COL.ev, a: ramp(u, 8.4, 0.5) } } : {},
            marks: [{ s: 0, t: 'July 18', color: COL.key, a: ramp(u, 6.8, 0.4) * (1 - ramp(u, 8.4, 0.4)) }, { s: 2, t: 'on the first day', color: COL.key, a: ramp(u, 9.0, 0.5) }, { s: 2, t: '9 A.M.,', color: COL.para, a: ramp(u, 13.0, 0.5) }, { s: 3, t: '10 A.M.', color: COL.trap, a: ramp(u, 12.4, 0.5) }],
          });
          if (scan > 0 && scan < 1) { const y = lerp(L.card.y + 30, L.bottom, scan); g.fillStyle = 'rgba(110,200,255,0.22)'; g.fillRect(L.card.x + 8, y - 2, L.card.w - 16, 4); }
          fade(g, ramp(u, 9.4, 0.5), () => tag(g, '질문의 July 18 = 지문의 on the first day', L.card.x + 4, L.card.y + L.card.h + 22, COL.key, { size: 15, h: 30, pad: 12 }));
          const order = [13.0, 0, 12.4, 13.2];
          qPanel(g, q, 756, 178, 452, { qmarks: q.key.map(t => ({ t, color: COL.key, a: ramp(u, 2.0, 0.5) })), oa: ramp(u, 1.0, 0.5),
            state: k => win && k === q.a ? { st: 'win', tag: '정답', tc: COL.good } : k !== q.a && u > order[k] ? { st: 'no', p: ramp(u, order[k], 0.4), tag: R7.judge(q, k).name, ta: ramp(u, order[k], 0.4) } : { st: 'open' } });
          stepper(g, 756, 552, u < 6 ? 0 : u < 12.4 ? 1 : 2, ramp(u, 2.0, 0.5));
        });
      } else {
        const q = R7.Q.inv1, Dc = R7.DOCS.invoice, v = S.cell ? 32 : u;
        const rowOn = S.cell ? 1 : ramp(v, 25.2, 0.5), colOn = S.cell ? 1 : ramp(v, 25.8, 0.5), hit = S.cell ? 1 : ramp(v, 26.6, 0.5), judged = v > 28.0, win = v > 28.8;
        fade(g, ramp(u, 18.2, 0.6), () => {
          const L = docCard(g, Dc, 80, 156, 640, { size: 20, headSize: 14.5 }, {
            dim: s => v > 20.4 && !S.cell ? (s === 1 && rowOn > 0 ? 1 : 0.35 + 0.65 * (1 - ramp(v, 20.4, 0.6))) : 1,
            hl: { 1: { color: COL.key, a: rowOn * 0.9 } },
            colHl: { c: 1, color: COL.key, a: colOn },
            cells: (S.cell ? [{ s: S.cell[0], c: S.cell[1], color: S.cell[0] === 1 && S.cell[1] === 1 ? COL.para : COL.trap }] : [{ s: 1, c: 1, color: COL.para, a: hit }])
              .concat(judged && !S.cell ? [[0, 1], [2, 1], [1, 2]].map(([s, c], i) => ({ s, c, color: COL.trap, a: ramp(v, 28.0 + i * 0.3, 0.4), fill: 0.1 })) : []),
          });
          fade(g, hit, () => tag(g, '줄 Appointment cards × 칸 Quantity → 1,000', L.card.x + 4, L.card.y + L.card.h + 22, COL.para, { size: 15, h: 30, pad: 12 }));
          const order = [28.3, 28.0, 28.6, 0];
          const qSel = S.cell ? q.opts.findIndex(x => x.src ? x.src.s === S.cell[0] && Dc.rows[S.cell[0]][S.cell[1]] === x.src.t : S.cell[0] === q.ev[0].s && Dc.rows[S.cell[0]][S.cell[1]] === x.t) : -1;
          qPanel(g, q, 756, 178, 452, { qmarks: q.key.map(t => ({ t, color: COL.key, a: ramp(v, 19.6, 0.5) })), oa: ramp(v, 19.0, 0.5),
            state: k => S.cell ? (k === qSel ? verdict(q, k, true) : { st: 'open' }) : win && k === q.a ? { st: 'win', tag: '정답', tc: COL.good } : k !== q.a && v > order[k] ? { st: 'no', p: ramp(v, order[k], 0.4), tag: R7.judge(q, k).name, ta: ramp(v, order[k], 0.4) } : { st: 'open' } });
          stepper(g, 756, 552, v < 21 ? 0 : v < 28 ? 1 : 2, ramp(v, 19.6, 0.5));
        });
      }
    },

    /* 05 NOT과 추론: 보기마다 근거 찾기 → 못 찾은 하나 / annual → 전에도 */
    notinfer(g, u) {
      const Dc = R7.DOCS.library, inferPart = S.notk == null && u >= 18.0;
      const q = inferPart ? R7.Q.lib3 : R7.Q.lib2, v = inferPart ? u - 18 : u;
      fade(g, ramp(u, 0.4, 0.6), () => {
        const NOT_AT = [6.4, 12.2, 13.6, 15.2];
        if (!inferPart) {
          const found = k => S.notk != null ? S.notk === k : u > NOT_AT[k];
          const cur = S.notk != null ? S.notk : [0, 1, 2, 3].filter(k => u > NOT_AT[k]).pop();
          const x = cur != null ? q.opts[cur] : null;
          const L = docCard(g, Dc, 80, 156, 640, { size: 20, headSize: 14.5 }, {
            hl: x && x.src ? { [x.src.s]: { color: COL.ev, a: 1 } } : {},
            marks: q.opts.map((o2, k) => o2.src && found(k) ? [{ s: o2.src.s, t: o2.src.t, color: COL.ev, a: 1 }].concat((o2.pairs || []).map(([p]) => ({ s: o2.src.s, t: p, color: COL.para, a: 1 }))) : []).flat(),
          });
          const P = qPanel(g, q, 756, 178, 452, { qmarks: [{ t: 'NOT', color: COL.trap, a: ramp(u, 1.6, 0.5) }, { t: 'the book sale', color: COL.key, a: ramp(u, 2.2, 0.5) }], oa: ramp(u, 1.0, 0.5),
            state: k => {
              if (S.notk != null) return k === S.notk ? (q.opts[k].rel === 'stated' ? { st: 'no', p: 1, tag: '지문에 있음', tc: COL.ev } : { st: 'win', tag: '지문에 없음 → 정답', tc: COL.good }) : { st: 'open' };
              if (k === q.a) return u > NOT_AT[3] + 1.2 ? { st: 'win', tag: '지문에 없음 → 정답', tc: COL.good } : { st: 'open' };
              return u > NOT_AT[k] + 0.6 ? { st: 'no', p: ramp(u, NOT_AT[k] + 0.6, 0.4), tag: '지문에 있음', ta: ramp(u, NOT_AT[k] + 0.6, 0.4), tc: COL.ev } : { st: 'open' };
            }, omarks: Object.fromEntries(q.opts.map((o2, k) => [k, (o2.pairs || []).map(([, y]) => ({ t: y, color: COL.para, a: found(k) ? 1 : 0 }))])) });
          q.opts.forEach((o2, k) => {
            if (!o2.src || !found(k) || !P.rows[k]) return;
            const to = mid(span(g, L, o2.src.s, o2.src.t)), r = P.rows[k];
            if (to) curve(g, r.L.x - 34, r.y, (L.card.x + L.card.w + r.L.x) / 2, Math.min(to.cy, r.y) - 16, L.card.x + L.card.w + 2, to.cy, COL.ev, S.notk != null ? 1 : ramp(u, NOT_AT[k], 0.7), { lw: 2 });
          });
          stepper(g, 756, 552, u < 6 ? 0 : u < 15.2 ? 1 : 2, ramp(u, 1.6, 0.5));
        } else {
          const ann = ramp(v, 4.0, 0.5), chain = ramp(v, 8.0, 0.6), judged = v > 10.2, win = v > 11.4;
          const L = docCard(g, Dc, 80, 156, 640, { size: 20, headSize: 14.5 }, {
            dim: s => s === 0 ? 1 : 1 - 0.5 * ann,
            hl: { 0: { color: COL.ev, a: ann } },
            marks: [{ s: 0, t: 'annual', color: COL.para, a: ramp(v, 4.6, 0.5) }].concat(judged ? q.opts.map(x => x.rel !== 'match' && x.src ? { s: x.src.s, t: x.src.t, color: COL.trap, a: ramp(v, 10.2, 0.5) } : null).filter(Boolean) : []),
          });
          fade(g, chain, () => {
            const y = L.card.y + L.card.h + 24;
            const c1 = chip(g, 'annual = 해마다', 84, y, { size: 16, weight: 700, color: COL.para, fill: COL.panel2, stroke: COL.para, h: 32 });
            arrow(g, c1.x + c1.w + 10, y, c1.x + c1.w + 40, y, COL.accent, 2.4);
            chip(g, '전에도 열었을 것 (쓰여 있지 않음)', c1.x + c1.w + 50, y, { size: 16, weight: 700, color: COL.good, fill: COL.panel2, stroke: COL.good, h: 32 });
          });
          const order = [0, 10.2, 10.6, 11.0];
          const P = qPanel(g, q, 756, 178, 452, { qmarks: [{ t: 'suggested', color: COL.key, a: ramp(v, 1.4, 0.5) }, { t: 'the Ridgeway Public Library', color: COL.key, a: ramp(v, 1.8, 0.5) }], oa: ramp(v, 0.6, 0.5),
            state: k => win && k === q.a ? { st: 'win', tag: '정답 · 추론', tc: COL.good } : k !== q.a && v > order[k] ? { st: 'no', p: ramp(v, order[k], 0.4), tag: R7.judge(q, k).name, ta: ramp(v, order[k], 0.4) } : { st: 'open' },
            omarks: { 0: [{ t: 'in the past', color: COL.para, a: ramp(v, 11.4, 0.5) }] } });
          pairLine(g, L, 0, 'annual', P.rows[0], COL.para, ramp(v, 11.6, 0.8));
          stepper(g, 756, 552, v < 4 ? 0 : v < 10 ? 1 : 2, ramp(v, 1.4, 0.5));
        }
      });
    },

    /* 06 문맥 속 뜻: 단어장 hold = 잡다 ↔ 두 문장의 hold */
    synonym(g, u) {
      const q = R7.Q.hotel3;
      fade(g, ramp(u, 0.6, 0.6), () => {
        panel(g, 80, 150, 330, 184, { fill: '#F3EBD2', stroke: '#D9CBA3', r: 10 });
        for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(120,100,60,0.18)'; g.fillRect(96, 218 + i * 28, 298, 1); }
        txt(g, '단어장', 98, 174, { size: 15, weight: 700, color: '#7A6640' });
        txt(g, 'hold', 100, 226, { size: 32, weight: 700, color: '#2B2418' });
        txt(g, '= 잡다', 196, 228, { size: 30, weight: 800, color: '#B5482A' });
        txt(g, '뜻 하나만 외우면', 100, 286, { size: 15, weight: 600, color: '#6B5A3A' });
        txt(g, '함정에 빠지기 쉬워요', 100, 310, { size: 15, weight: 600, color: '#6B5A3A' });
      });
      fade(g, ramp(u, 0.8, 0.6), () => {
        panel(g, 436, 150, 764, 184, { fill: COL.panel, stroke: COL.faint });
        chip(g, 'Q', 466, 182, { size: 15, weight: 800, color: COL.bg, fill: COL.accent, h: 28, pad: 8, align: 'center' });
        const LQ = layWords(g, q.q, 490, 182, 690, { size: 20, weight: 600 });
        drawWords(g, LQ, { marks: [{ t: '“hold”', color: COL.key, a: ramp(u, 1.6, 0.5) }] });
        say(486, 166, 690, 34, q.q);
        q.opts.forEach((o2, k) => {
          const x = 460 + k * 182, y = 256, j = R7.judge(q, k);
          const on = S.syn != null ? S.syn === k : [6.6, 13.2, 19.0, 19.6][k] < u;
          const win = j.s === 'ok' && on, no = j.s === 'no' && on;
          panel(g, x, y - 28, 168, 56, { fill: win ? 'rgba(127,224,168,0.12)' : COL.panel2, stroke: win ? COL.good : no ? COL.trap : COL.faint, lw: win || no ? 2 : 1.2, r: 10 });
          txt(g, `(${L4[k]})`, x + 12, y, { size: 15, fam: FM, color: COL.muted });
          const w = txt(g, o2.t, x + 48, y, { size: 22, weight: 700, color: win ? COL.good : no ? COL.dim : COL.text });
          say(x + 42, y - 18, w + 12, 36, o2.t);
          if (no) { g.strokeStyle = COL.bad; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 44, y + 1); g.lineTo(x + 52 + w, y + 1); g.stroke(); }
          if (on) tag(g, win ? '정답 · 문장 속 뜻' : j.name, x + 84, y + 46, win ? COL.good : COL.trap, { align: 'center', size: 14, h: 26 });
        });
      });
      const SENT = [
        { D: R7.DOCS.library, s: 0, at: 12.2, mean: '열다 → host', c: COL.trap, label: '도서관 공지' },
        { D: R7.DOCS.hotel, s: 5, at: 18.2, mean: '잡아 두다 → keep', c: COL.good, label: '호텔 이메일' },
      ];
      SENT.forEach((x, i) => fade(g, ramp(u, x.at, 0.6), () => {
        const y = 412 + i * 92;
        panel(g, 80, y - 40, 1120, 80, { fill: COL.paper, stroke: COL.faint });
        txt(g, x.label, 100, y - 22, { size: 13, weight: 700, color: COL.muted });
        const sub = i === 1 ? (S.syn != null ? q.opts[S.syn].t : u > 23.4 ? 'keep' : null) : null;
        const subOk = sub ? R7.isOk(q, q.opts.findIndex(o2 => o2.t === sub)) : false;
        const text = sub ? x.D.sents[x.s].replace(/\bhold\b/, sub) : x.D.sents[x.s];
        const LO = layWords(g, text, 100, y + 10, 900, { size: 22, weight: 500 });
        drawWords(g, LO, { marks: [{ t: sub || 'hold', color: sub ? (subOk ? COL.good : COL.bad) : COL.key, a: 1 }] });
        say(96, y - 12, 910, 42, text);
        fade(g, ramp(u, x.at + 0.8, 0.5), () => tag(g, sub ? (subOk ? '바꿔 넣어도 말이 돼요' : '말이 안 돼요') : x.mean, 1182, y + 8, sub ? (subOk ? COL.good : COL.bad) : x.c, { align: 'right', size: 16, h: 32, pad: 12 }));
      }));
    },

    /* 07 채팅과 문장 삽입 */
    chatins(g, u) {
      const insPart = S.ins != null || u >= 18.0;
      if (!insPart) {
        const q = R7.Q.chat1, Dc = R7.DOCS.chat;
        const quoteOn = ramp(u, 6.2, 0.5), prevOn = ramp(u, 9.0, 0.6), judged = u > 13.0, win = u > 14.2;
        fade(g, ramp(u, 0.4, 0.6) * (1 - ramp(u, 17.4, 0.5)), () => {
          const L = docCard(g, Dc, 80, 156, 640, { size: 18.5, top: 30 }, {
            dim: s => s === 1 || s === 2 ? 1 : 1 - 0.5 * prevOn,
            hl: { 2: { color: COL.key, a: quoteOn }, 1: { color: COL.ev, a: prevOn } },
            marks: [{ s: 2, t: '10:14 A.M.', color: COL.key, a: ramp(u, 2.4, 0.5) }, { s: 2, t: 'That’s not it.', color: COL.key, a: quoteOn }, { s: 1, t: 'Is the cable plugged in?', color: COL.para, a: ramp(u, 13.6, 0.5) }].concat(judged ? [{ s: 0, t: 'Room 3', color: COL.trap, a: ramp(u, 13.0, 0.5) }] : []),
          });
          const b2 = L.box[2], b1 = L.box[1];
          if (b1 && b2) bracket(g, L.card.x + L.card.w - 16, { cy: b2.y + b2.h / 2 }, { cy: b1.y + b1.h / 2 }, COL.ev, ramp(u, 9.4, 0.7), { label: '바로 앞 메시지', left: true });
          fade(g, quoteOn * (1 - prevOn), () => tag(g, '말 그대로는 뜻을 알 수 없음', b2.x + b2.w + 12, b2.y + b2.h / 2, COL.key, { size: 14, h: 26 }));
          const order = [0, 13.0, 13.4, 13.8];
          const P = qPanel(g, q, 756, 178, 452, { qmarks: q.key.map(t => ({ t, color: COL.key, a: ramp(u, 2.0, 0.5) })), oa: ramp(u, 1.0, 0.5),
            state: k => win && k === q.a ? { st: 'win', tag: '정답 · 바꿔 말함', tc: COL.good } : k !== q.a && u > order[k] ? { st: 'no', p: ramp(u, order[k], 0.4), tag: R7.judge(q, k).name, ta: ramp(u, order[k], 0.4) } : { st: 'open' },
            omarks: { 0: [{ t: 'The cable', color: COL.para, a: ramp(u, 14.2, 0.5) }, { t: 'not causing the problem', color: COL.para, a: ramp(u, 14.2, 0.5) }] } });
          pairLine(g, L, 1, 'Is the cable plugged in?', P.rows[0], COL.para, ramp(u, 14.4, 0.8));
          stepper(g, 756, 552, u < 6 ? 0 : u < 13 ? 1 : 2, ramp(u, 2.0, 0.5));
        });
      } else {
        const q = R7.Q.elev3, Dc = R7.DOCS.elevator, v = S.ins != null ? 36 : u;
        const pick = S.ins != null ? S.ins : v > 31 ? 1 : null;
        const pulse = v > 19.6 && v < 24 ? 0.5 + 0.5 * Math.sin(v * 5) : 0;
        fade(g, ramp(u, 18.2, 0.6), () => {
          const ins = pick != null ? { [pick]: q.sent } : null;
          const checked = n => S.ins != null ? null : v > 26.6 + (n - 1) * 0.6 ? (q.opts[n - 1].rel === 'fit' ? 'ok' : 'no') : null;
          docCard(g, Dc, 80, 156, 640, { size: 18.5, headSize: 13.5, headLines: ['From: Grace Lim, Facilities Office · To: All staff', 'Date: May 2 · Subject: Elevator maintenance'], marks: true, ins }, {
            glow: () => pulse, markState: checked,
            insColor: pick != null && q.opts[pick - 1].rel === 'fit' ? COL.para : COL.bad,
            marks: v > 26.4 ? [{ s: 1, t: 'its control panel', color: COL.ev, a: ramp(v, 26.6, 0.5) }] : [],
          });
          const LS = layWords(g, q.sent, 776, 206, 416, { size: 19, weight: 600 });
          panel(g, 756, 156, 452, LS.bottom + 48 - 156, { fill: 'rgba(255,193,94,0.10)', stroke: COL.accent, lw: 1.6 });
          txt(g, '넣을 문장', 776, 174, { size: 14, weight: 700, color: COL.accent });
          drawWords(g, LS, { marks: [{ t: q.ptr.t, color: COL.key, a: ramp(v, 24.4, 0.5) }] });
          say(772, 184, 420, LS.bottom - 170, q.sent);
          fade(g, ramp(v, 25.0, 0.5), () => tag(g, '가리키는 말 → 앞에 패널이 있어야', 776, LS.bottom + 28, COL.key, { size: 14, h: 26 }));
          q.opts.forEach((x, i) => {
            const y = 312 + i * 58, j = R7.judge(q, i), on = S.ins != null ? S.ins === x.n : v > 26.6 + i * 0.6;
            const win = on && j.s === 'ok', no = on && j.s === 'no';
            fade(g, ramp(v, 19.0, 0.5), () => {
              panel(g, 756, y - 24, 452, 48, { fill: win ? 'rgba(127,224,168,0.10)' : COL.panel, stroke: win ? COL.good : no ? COL.trap : COL.faint, lw: win || no ? 1.8 : 1.1, r: 10 });
              chip(g, x.t, 776, y, { size: 16, weight: 700, color: COL.gap, fill: 'rgba(255,122,168,0.12)', stroke: COL.gap, dash: [4, 3], h: 30, pad: 8, r: 7 });
              const prev = R7.units(Dc)[x.prev].text, short = prev.length > 30 ? prev.slice(0, 28).replace(/\s\S*$/, '') + ' …' : prev;
              txt(g, `앞: ${short}`, 834, y, { size: 14.5, weight: 500, color: COL.soft });
              if (on) tag(g, win ? '짝이 맞음' : '짝 없음', 1196, y, win ? COL.good : COL.trap, { align: 'right', size: 14, h: 26 });
            });
          });
          stepper(g, 756, 552, v < 24 ? 0 : v < 30 ? 1 : 2, ramp(v, 20, 0.5));
        });
      }
    },

    /* 08 연계 지문: 이중(광고 + 이메일) → 삼중(신청서 · 일정표 · 이메일), 카메라로 다가가 읽고 글 사이 틈에서 잇기 */
    linked(g, u) {
      const triple = S.view ? S.view === 'triple' : u >= 19.0;
      const view = { x: 72, y: 186, w: 1136, h: 278 }, clip = { x: 64, y: 180, w: 1152, h: 290 };
      const strip = (q, a) => { chip(g, 'Q', 94, 152, { size: 14, weight: 800, color: COL.bg, fill: COL.accent, h: 26, pad: 8, align: 'center' }); const LQ = layWords(g, q.q, 116, 152, 1080, { size: 20, weight: 600 }); drawWords(g, LQ, { marks: q.key.map(t => ({ t, color: COL.key, a })) }); say(112, 138, 720, 30, q.q); };
      // 글 사이 틈에서 잇는 곡선 (왼쪽 카드의 오른쪽 끝 → 오른쪽 카드의 왼쪽 끝)
      const gapLink = (cL, aL, cR, aR, p, back) => {
        if (!aL || !aR || p <= 0.001) return;
        const x0 = cL.x + cL.w + 2, x1 = cR.x - 2, y0 = aL.cy, y1 = aR.cy, mx = (x0 + x1) / 2;
        g.save(); g.strokeStyle = COL.link; g.lineWidth = 2.6; g.setLineDash([6, 5]); g.lineCap = 'round';
        const n = 30, P = k => { const t = k / n, a = 1 - t; return [a * a * a * x0 + 3 * a * a * t * mx + 3 * a * t * t * mx + t * t * t * x1, a * a * a * y0 + 3 * a * a * t * y0 + 3 * a * t * t * y1 + t * t * t * y1]; };
        const m = Math.max(2, Math.round(n * clamp(p)));
        g.beginPath(); for (let k = 0; k <= m; k++) { const [x, y] = back ? P(n - k) : P(k); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.restore();
        [[x0, y0], [x1, y1]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fillStyle = COL.link; g.fill(); });
      };
      const chainRow = (items, y, a) => fade(g, a, () => {
        let x = 100;
        items.forEach(([s, c], i) => { const r = chip(g, s, x, y, { size: 15, weight: 700, color: c, fill: COL.panel2, stroke: c, h: 32, pad: 12 }); x = r.x + r.w; if (i < items.length - 1) { arrow(g, x + 8, y, x + 36, y, COL.link, 2.2); x += 46; } });
      });
      if (!triple) {
        const q = R7.Q.cater2, S2 = R7.SETS.catering, found = S.lnk || null;
        fade(g, ramp(u, 0.4, 0.6) * (S.view ? 1 : 1 - ramp(u, 18.4, 0.5)), () => {
          strip(q, ramp(u, 1.6, 0.5));
          const LA = layDoc(g, S2.D[0], { x: 100, y: 222, w: 480, size: 16, headSize: 12.5, headLines: ['GREENLEAF CATERING · Office Lunch Packages'] });
          const LB = layDoc(g, S2.D[1], { x: 680, y: 222, w: 480, size: 16, headSize: 12.5, headLines: ['From: Owen Reyes · To: Greenleaf Catering', 'Date: June 2 · Subject: Lunch order'] });
          const h = Math.max(LA.bottom, LB.bottom) - 194 + 14, cA = { x: 80, y: 194, w: 520, h }, cB = { x: 660, y: 194, w: 520, h };
          const cam = found ? ID : camAt(u, [[0, ID], [6.0, focus(cB, view, 1.5)], [9.0, focus(cA, view, 1.5)], [12.4, ID]]);
          const evA = found ? found.has('0:3') : u > 9.6, evB = found ? found.has('1:1') : u > 6.8, linkP = found ? (found.size === 2 ? 1 : 0) : ramp(u, 13.0, 0.9);
          withCam(g, cam, clip, () => {
            paper(g, cA.x, cA.y, cA.w, cA.h, '1 · ADVERTISEMENT'); paper(g, cB.x, cB.y, cB.w, cB.h, '2 · E-MAIL');
            drawDoc(g, LA, { hl: evA ? { 3: { color: COL.ev, a: 1 } } : {}, marks: [{ s: 2, t: 'Deluxe', color: COL.key, a: evA || u > 9.2 ? 1 : 0 }, { s: 3, t: '30 people or more', color: COL.para, a: evA ? 1 : 0 }] });
            drawDoc(g, LB, { hl: evB ? { 1: { color: COL.ev, a: 1 } } : {}, marks: [{ s: 0, t: 'Deluxe package', color: COL.key, a: found || u > 6.4 ? 1 : 0 }, { s: 1, t: '25 of us', color: COL.para, a: evB ? 1 : 0 }] });
          });
          if (cam === ID || linkP >= 1) gapLink(cA, mid(span(g, LA, 3, '30 people or more')), cB, mid(span(g, LB, 1, '25 of us')), linkP, true);
          chainRow([['이메일 · 25 of us', COL.para], ['광고 · 30 people or more', COL.para], ['25 < 30 → 무료 배달이 아니에요', COL.link]], cA.y + cA.h + 30, linkP);
          const judged = found ? found.size === 2 : u > 15.0, win = judged && (found || u > 16.2);
          const order = [15.0, 15.4, 0, 15.8];
          qPanel(g, { q: '', opts: q.opts }, 100, 498, 1100, { osize: 17, grid: true, oa: ramp(u, 2.0, 0.5),
            state: k => win && k === q.a ? { st: 'win', tag: '정답', tc: COL.good } : judged && k !== q.a && (found || u > order[k]) ? { st: 'no', p: found ? 1 : ramp(u, order[k], 0.4), tag: R7.judge(q, k).name, ta: found ? 1 : ramp(u, order[k], 0.4) } : { st: 'open' } });
        });
      } else {
        const q = R7.Q.ws1, S3 = R7.SETS.workshop, v = S.view ? 40 : u;
        fade(g, ramp(u, S.view ? 0 : 19.2, 0.6), () => {
          strip(q, ramp(v, 21.0, 0.5));
          // 단서를 찾는 순서대로: 3 신청서 → 1 일정표 → 2 이메일
          const o = { y: 222, w: 324, size: 14, headSize: 11.5 };
          const L3 = layDoc(g, S3.D[2], Object.assign({ x: 96 }, o));
          const L1 = layDoc(g, S3.D[0], Object.assign({ x: 482 }, o, { headLines: ['HANLEY BUSINESS CENTER', 'Workshops · Saturday, October 11'] }));
          const L2 = layDoc(g, S3.D[1], Object.assign({ x: 868 }, o, { headLines: ['From: Hanley Business Center', 'Date: October 8 · Subject: Room change'] }));
          const h = Math.max(L1.bottom, L2.bottom, L3.bottom) - 194 + 14;
          const c3 = { x: 80, y: 194, w: 356, h }, c1 = { x: 466, y: 194, w: 356, h }, c2 = { x: 852, y: 194, w: 356, h };
          const cam = S.view ? ID : camAt(v, [[0, ID], [25.6, focus(c3, view, 1.6)], [27.6, focus(c1, view, 1.6)], [29.6, focus(c2, view, 1.6)], [32.0, ID]]);
          const e3 = v > 26.2, e1 = v > 28.2, e2 = v > 30.2;
          withCam(g, cam, clip, () => {
            [[c3, '3 · FORM'], [c1, '1 · SCHEDULE'], [c2, '2 · E-MAIL']].forEach(([c, lb]) => paper(g, c.x, c.y, c.w, c.h, lb));
            drawDoc(g, L3, { hl: e3 ? { 2: { color: COL.ev, a: 1 } } : {}, marks: [{ s: 2, t: 'Writing Clear E-mails', color: COL.para, a: e3 ? 1 : 0 }, { s: 0, t: 'Nora Bell', color: COL.key, a: v > 25.8 ? 1 : 0 }] });
            drawDoc(g, L1, { hl: e1 ? { 0: { color: COL.ev, a: 1 } } : {}, marks: [{ s: 0, t: 'Writing Clear E-mails', color: COL.para, a: e1 ? 1 : 0 }, { s: 0, t: 'Room B', color: v > 33.6 ? COL.trap : COL.para, a: e1 ? 1 : 0 }] });
            drawDoc(g, L2, { hl: e2 ? { 1: { color: COL.ev, a: 1 } } : {}, marks: [{ s: 0, t: 'Room B', color: COL.key, a: e2 ? 1 : 0 }, { s: 1, t: 'Room D instead', color: COL.para, a: e2 ? 1 : 0 }] });
          });
          const lp = S.view ? 1 : ramp(v, 32.4, 0.9), lp2 = S.view ? 1 : ramp(v, 33.0, 0.9);
          if (cam === ID || lp >= 1) {
            gapLink(c3, mid(span(g, L3, 2, 'Writing Clear E-mails')), c1, mid(span(g, L1, 0, 'Writing Clear E-mails')), lp);
            gapLink(c1, mid(span(g, L1, 0, 'Room B')), c2, mid(span(g, L2, 1, 'Room D instead')), lp2);
          }
          chainRow([['신청서 · Writing Clear E-mails', COL.para], ['일정표 · Room B', COL.para], ['이메일 · Room D instead', COL.para], ['정답 Room D', COL.good]], c1.y + c1.h + 30, lp);
          const judged = v > 34.0, win = v > 35.2, order = [34.4, 34.0, 34.8, 0];
          qPanel(g, { q: '', opts: q.opts }, 100, 498, 1100, { osize: 17, grid: true, oa: ramp(v, 21.6, 0.5),
            state: k => win && k === q.a ? { st: 'win', tag: '정답 · 세 글을 이음', tc: COL.good } : judged && k !== q.a && v > order[k] ? { st: 'no', p: ramp(v, order[k], 0.4), tag: R7.judge(q, k).name, ta: ramp(v, order[k], 0.4) } : { st: 'open' } });
        });
      }
    },

    /* 09 3단계 풀이법: 단계(가로) × 문제 유형(세로) */
    method(g, u) {
      const cols = [
        { x: 230, head: '① 질문 먼저', sub: '유형 · 키워드 · 어디를', at: 5.6, c: COL.key },
        { x: 558, head: '② 근거 찾기', sub: '밑줄 · 글 사이 잇기', at: 11.2, c: COL.ev },
        { x: 886, head: '③ 바꿔 말한 보기', sub: '반복 · 없음 · 반대 지우기', at: 16.6, c: COL.para },
      ];
      const rows = [
        { k: 'purpose', name: '목적 · 요청', cells: [['Why … written? · asked to do', '첫 문단 · please 문장'], ['I am writing to … · Please …', '그 문장에 밑줄'], ['out of service', '→ cannot be used']] },
        { k: 'detail', name: '세부 · 표', cells: [['날짜 · 숫자 · 이름', '표는 줄 × 칸'], ['키워드를 훑어 찾기', 'July 18 = the first day'], ['숫자는 그대로일 때도', '옆 줄 · 옆 칸은 함정']] },
        { k: 'not', name: 'NOT · 추론', cells: [['NOT → 없는 것', 'suggested → 짐작'], ['보기마다 근거 찾기', 'annual → 해마다'], ['셋은 지문에, 하나는 없음', '쓰여 있지 않아도 단서로']] },
        { k: 'synonym', name: '동의어 · 의도', cells: [['낱말 · 인용한 말', '“hold” · “That’s not it”'], ['그 문장 · 바로 앞 메시지', 'hold the room · the cable?'], ['문장 속 뜻 · 대답의 뜻', '사전 첫 뜻 · 말 그대로는 함정']] },
        { k: 'linked', name: '삽입 · 연계', cells: [['This panel · 글 둘 · 셋', '어느 글에 무엇이?'], ['[1]~[4] 앞 문장 · 글 사이 선', '25 of us ↔ 30 people'], ['넣어 읽기 · 합친 정보', '옛 정보는 함정']] },
      ];
      cols.forEach((c, ci) => {
        fade(g, ramp(u, 0.8 + ci * 0.5, 0.6), () => {
          panel(g, c.x, 146, 316, 54, { fill: COL.panel2, stroke: c.c });
          txt(g, c.head, c.x + 16, 166, { size: 20, weight: 700, fam: FD, color: c.c });
          txt(g, c.sub, c.x + 16, 189, { size: 13, weight: 600, color: COL.muted });
          if (ci < 2) arrow(g, c.x + 318, 173, c.x + 326, 173, COL.accent, 2.4);
        });
        rows.forEach((r, ri) => {
          const on = S.mtype ? S.mtype === r.k : false;
          fade(g, ramp(u, c.at + ri * 0.4, 0.5) * (S.mtype && !on ? 0.35 : 1), () => {
            const y = 212 + ri * 70;
            if (ci === 0) { panel(g, 80, y, 138, 62, { fill: COL.panel2, stroke: on ? COL.accent : COL.faint, lw: on ? 2.2 : 1 }); txt(g, r.name, 96, y + 31, { size: 16, weight: 800, color: on ? COL.accent : COL.soft }); }
            panel(g, c.x, y, 316, 62, { fill: on ? 'rgba(255,193,94,0.10)' : COL.panel, stroke: on ? COL.accent : COL.faint, lw: on ? 2 : 1 });
            const [t1, t2] = r.cells[ci];
            txt(g, t1, c.x + 14, y + 21, { size: 15.5, weight: 700, color: COL.text });
            txt(g, t2, c.x + 14, y + 44, { size: 14, weight: 500, color: COL.soft });
          });
        });
      });
    },

    /* 10 실전 문제 세 개: 자전거 광고 + 이메일 */
    practice(g, u) {
      const SEG = [0, 19.2, 38.2, 57];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi];
      const q = [R7.Q.bike1, R7.Q.bike2, R7.Q.bike3][pi], S2 = R7.SETS.bikes;
      const AT = [[0.4, 6.6, 12.8], [0.2, 6.3, 12.3], [0.2, 6.3, 12.8]][pi];
      const s2 = v >= AT[1], s3 = v >= AT[2], win = v >= AT[2] + 0.6;
      const LA = docCard(g, S2.D[0], 72, 148, 690, { size: 17, headSize: 13, headLines: ['BRIGHTWAY BIKE RENTALS · Lakeside Park · Open every day'], top: 30, label: 'ADVERTISEMENT' }, {
        hl: Object.fromEntries(q.ev.filter(e => e.d === 0 && s2).map(e => [e.s, { color: COL.ev, a: ramp(v, AT[1] + (pi === 2 ? 1.6 : 0.2), 0.5) }])),
        marks: q.ev.filter(e => e.d === 0 && s2).map(e => ({ s: e.s, t: e.t, color: COL.ev, a: ramp(v, AT[1] + (pi === 2 ? 1.8 : 0.4), 0.5) }))
          .concat(s3 ? (q.opts[q.a].pairs || []).map(([x]) => q.ev.filter(e => e.d === 0 && R7.unitText(S2, e.d, e.s).includes(x)).map(e => ({ s: e.s, t: x, color: COL.para, a: ramp(v, AT[2], 0.5) }))).flat() : [])
          .concat(s3 ? q.opts.map(x => x.rel === 'same' && x.src && x.src.d === 0 ? { s: x.src.s, t: x.src.t, color: COL.trap, a: ramp(v, AT[2], 0.5) } : null).filter(Boolean) : []),
      });
      const LB = docCard(g, S2.D[1], 72, LA.card.y + LA.card.h + 16, 690, { size: 17, headSize: 13, headLines: ['From: Hyejin Song · To: Brightway Bike Rentals', 'Date: September 15 · Subject: Group rental'], top: 30, label: 'E-MAIL' }, {
        hl: Object.fromEntries(q.ev.filter(e => e.d === 1 && s2).map(e => [e.s, { color: COL.ev, a: ramp(v, AT[1] + 0.2, 0.5) }])),
        marks: [].concat(pi === 1 ? [{ s: 2, t: 'Could you tell me', color: COL.key, a: ramp(v, 3.0, 0.5) }] : [])
          .concat(q.ev.filter(e => e.d === 1 && s2).map(e => ({ s: e.s, t: e.t, color: COL.ev, a: ramp(v, AT[1] + 0.4, 0.5) })))
          .concat(s3 ? (q.opts[q.a].pairs || []).map(([x]) => q.ev.filter(e => e.d === 1 && R7.unitText(S2, e.d, e.s).includes(x)).map(e => ({ s: e.s, t: x, color: COL.para, a: ramp(v, AT[2], 0.5) }))).flat() : [])
          .concat(s3 ? q.opts.map(x => x.rel === 'same' && x.src && x.src.d === 1 ? { s: x.src.s, t: x.src.t, color: COL.trap, a: ramp(v, AT[2], 0.5) } : null).filter(Boolean) : []),
      });
      if (pi === 0) fade(g, ramp(v, 3.4, 0.5), () => tag(g, '목적 → 이메일 첫 문단', LB.card.x + LB.card.w - 16, LB.card.y, COL.key, { align: 'right', size: 14, h: 26 }));
      if (pi === 2) {
        const a = mid(span(g, LB, 1, 'Six of us')), b = mid(span(g, LA, 2, 'Groups of five or more'));
        if (a && b) bracket(g, LA.card.x + LA.card.w - 12, a, b, COL.link, ramp(v, AT[1] + 2.4, 0.8), { label: '6 ≥ 5', left: true });
      }
      panel(g, 782, 148, 432, 428, { fill: COL.panel, stroke: COL.faint });
      txt(g, `문제 ${pi + 1} / 3 · ${R7.TYPE[q.type].name}`, 800, 172, { size: 15, weight: 600, fam: FM, color: COL.accent });
      const P = qPanel(g, q, 800, 206, 398, { size: 18, osize: 16.5, ogap: 1.5, qmarks: q.key.map(t => ({ t, color: COL.key, a: ramp(v, AT[0] + 0.8, 0.5) })), oa: ramp(v, 0.6, 0.5),
        state: k => { const j = R7.judge(q, k), at = j.step === 2 ? AT[1] + 2.6 : AT[2]; return win && k === q.a ? { st: 'win', tag: '정답', tc: COL.good } : k !== q.a && v > at ? { st: 'no', p: ramp(v, at, 0.4), tag: j.name, ta: ramp(v, at, 0.4) } : { st: 'open' }; },
        omarks: { [q.a]: (q.opts[q.a].pairs || []).map(([, y]) => ({ t: y, color: COL.para, a: ramp(v, AT[2] + 0.4, 0.5) })) } });
      const lines = [
        ['목적 → 이메일 첫 문단', 'team outing · would like to rent', 'team event · book → (A)'],
        ['묻는 말 → Could you tell me whether', 'bring our own helmets', 'helmets → safety gear → (C)'],
        ['연계 → 두 글 모두', 'Six of us + five or more', '20 percent off → lower price → (D)'],
      ][pi];
      const ys = Math.max(P.bottom + 6, 466);
      g.fillStyle = COL.faint; g.fillRect(800, ys - 22, 396, 1);
      lines.forEach((ln, k) => fade(g, ramp(v, AT[k] + 0.3, 0.5), () => {
        const y = ys + k * 34;
        txt(g, '①②③'[k], 800, y, { size: 17, weight: 700, color: COL.accent });
        txt(g, ln, 828, y, { size: 15, weight: 600, color: k === 2 ? COL.good : COL.soft });
      }));
    },

    /* 11 정리 */
    summary(g, u) {
      const rows = [
        ['목적', COL.key, '첫 문단', 'I am writing to …'],
        ['요청', COL.key, 'please · Could you 뒤', 'Please reply by March 6.'],
        ['세부 · 표', COL.key, '키워드 · 필요한 줄과 칸', 'July 18 = the first day'],
        ['NOT · 추론', COL.ev, '보기마다 대조 · 단서 모으기', 'annual → 전에도 열었다'],
        ['동의어 · 의도', COL.ev, '그 문장 속 뜻 · 바로 앞 메시지', 'hold the room → keep'],
        ['삽입 · 연계', COL.link, '가리키는 말의 짝 · 글 사이를 잇기', 'This panel ← its control panel'],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, 140, 1160, 372, { fill: COL.panel, stroke: COL.faint });
        ['문제', '근거가 있는 곳', '예'].forEach((h, i) => txt(g, h, [96, 300, 780][i], 166, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, 186, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.0 + ri * 0.5, 0.5), () => {
        const y = 216 + ri * 50;
        chip(g, r[0], 96, y, { size: 16, weight: 800, color: r[1], fill: COL.panel2, stroke: r[1], h: 34 });
        txt(g, r[2], 300, y, { size: 19, weight: 600 });
        const w = txt(g, r[3], 780, y, { size: 19, weight: 500, color: COL.en });
        say(776, y - 16, w + 8, 32, r[3].replace(/[=→←].*$/, '').trim());
      }));
      fade(g, ramp(u, 10.2, 0.5), () => {
        let x = 80;
        [['지문 낱말 그대로', COL.trap], ['지문에 없음', COL.trap], ['반대', COL.trap]].forEach(([s, c]) => { const r = chip(g, `× ${s}`, x, 542, { size: 17, weight: 700, color: c, fill: COL.panel2, stroke: c, h: 38 }); x = r.x + r.w + 10; });
        const steps = ['① 질문 먼저', '② 근거 찾기', '③ 바꿔 말한 보기'];
        let x2 = 1200;
        steps.slice().reverse().forEach(s => { const r = chip(g, s, x2, 542, { size: 17, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 38, align: 'right' }); x2 = r.x - 12; });
      });
    },
  };

  // 영상 추출용 자막: 아래쪽 띠에 두 줄까지. **굵게**는 강조색, 영어는 연한 하늘색
  function drawCaption(g, text) {
    if (!text) return;
    const words = [];
    text.split('**').forEach((part, k) => { const bold = k % 2 === 1; part.split(/(\s+)/).forEach(w => w && words.push({ w, bold, en: /[A-Za-zÀ-ÿ]/.test(w) && !/[가-힣]/.test(w) })); });
    const units = []; let cur = null;
    words.forEach(o => {
      o.ww = tw(g, o.w, 28, o.bold ? 700 : 500);
      if (/^\s+$/.test(o.w)) { units.push({ sp: true, items: [o], w: o.ww }); cur = null; }
      else { if (!cur) { cur = { items: [], w: 0 }; units.push(cur); } cur.items.push(o); cur.w += o.ww; }
    });
    const wrap = maxW => {
      const lines = [[]]; let lw = 0;
      units.forEach(un => {
        const line = lines[lines.length - 1];
        if (!un.sp && line.length && lw + un.w > maxW) { lines.push([]); lw = 0; }
        if (un.sp && !lines[lines.length - 1].length) return;
        lines[lines.length - 1].push(...un.items); lw += un.w;
      });
      lines.forEach(l => { while (l.length && /^\s+$/.test(l[l.length - 1].w)) l.pop(); });
      return lines;
    };
    let lines = wrap(1100);
    if (lines.length > 1) {
      const total = units.reduce((s, un) => s + un.w, 0);
      for (let mw = Math.ceil(total / lines.length); mw < 1100; mw += 8) { const l2 = wrap(mw); if (l2.length === lines.length) { lines = l2; break; } }
    }
    const widthOf = l => l.reduce((s, o) => s + o.ww, 0), lh = 42, h = lines.length * lh + 22, y0 = H - 24 - h;
    const bw = Math.max(...lines.map(widthOf)) + 52;
    rr(g, (W - bw) / 2, y0, bw, h, 12); g.fillStyle = 'rgba(6,9,13,0.86)'; g.fill();
    lines.forEach((l, li) => {
      let x = (W - widthOf(l)) / 2;
      l.forEach(o => { txt(g, o.w, x, y0 + 11 + lh * li + lh / 2, { size: 28, weight: o.bold ? 700 : 500, color: o.bold ? COL.accent : o.en ? COL.en : COL.text }); x += o.ww; });
    });
  }

  RV.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[RV.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = []; CAM = ID; CLIP = null;
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, RV.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + Object.values(R7.DOCS).map(d => R7.units(d).map(x => x.text).join(' ') + (d.head || []).join(' ') + (d.cols || []).join(' ') + (d.msgs || []).map(m => m.who + m.time).join(' ')).join(' ') +
    Object.values(R7.Q).map(q => q.q + q.opts.map(x => x.t).join(' ') + (q.sent || '')).join(' ') + Object.values(R7.REL).map(r => r.name).join('') + Object.values(R7.TYPE).map(t => t.name).join('') +
    R7.PARA.map(p => p.text + p.same).join('') + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;·()[]→←↔✓×?~=+-/:…‘’“”–≥<>#$%&정답근거질문';
  RV.baseText = EXTRA;
  RV.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = RV.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S, (k, v) => v instanceof Set ? [...v] : v); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { RV.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; const k = JSON.parse(keep); if (k.lnk) k.lnk = new Set(k.lnk); Object.assign(S, k); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
