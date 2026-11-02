/* 듣기 ② Part 3·4 튜토리얼 — 영상 장면
 *
 * LTS.render(g, t)는 시각 t와 사용자 상태 LTS.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 영상(MP4)으로는 음성을 들려줄 수 없어서, 대본을 말풍선 줄(화자 표시 + 소리 물결)로 보여 주고
 * 설명에 맞춰 한 줄씩 ‘말하게’ 그립니다. 오른쪽 문제 칸에는 키워드에 색을 칠해요.
 * 역할 색: 문제 키워드 하늘 · 신호어 보라 · 근거 줄 민트 · 바꿔 말한 답 노랑 · 그대로 들린 낱말(함정) 주황
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(LT.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const LT = window.LT;
  const LTS = (window.LTS = {});
  const W = 1280, H = 720;
  LTS.W = W; LTS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  LTS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36',
    ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', clause: '#7FE0A8', verb: '#C9A7FF', trap: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
  };
  LTS.COL = COL;
  // 화자 표시 색 (역할 색과 겹치지 않는 차분한 색): 세트에 나오는 차례대로
  const SPKC = ['#E7ECF2', '#9DB4CC', '#D9C49A'];
  LTS.SPKC = SPKC;
  const spkColor = (S, key) => SPKC[Math.max(0, Object.keys(S.spk).indexOf(key))];

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (LTS.S = { ctx: null, rel: null, talk: null, trap: null });
  LTS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  LTS.hits = () => HITS;

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
  function arrow(g, x0, y0, x1, y1, color, lw = 2.5, p = 1) {
    if (p <= 0.001) return;
    const ang = Math.atan2(y1 - y0, x1 - x0), ex = lerp(x0, x1, p), ey = lerp(y0, y1, p);
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex - Math.cos(ang) * 8 * (p > 0.9 ? 1 : 0), ey - Math.sin(ang) * 8 * (p > 0.9 ? 1 : 0)); g.stroke();
    if (p > 0.9) arrowHead(g, x1, y1, ang, color);
  }
  // 곡선 화살표 (가운데가 (cx, cy) 쪽으로 휨, p: 그려진 정도)
  function curve(g, x0, y0, cx, cy, x1, y1, color, p = 1, o = {}) {
    if (p <= 0.001) return;
    const N = 40, n = Math.max(2, Math.round(N * p));
    const pt = k => { const s = k / N; return [(1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * cx + s * s * x1, (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * cy + s * s * y1]; };
    g.save(); g.strokeStyle = color; g.lineWidth = o.lw || 2.4; g.lineCap = 'round';
    if (o.dash) g.setLineDash([7, 6]);
    g.beginPath(); for (let k = 0; k <= n; k++) { const [x, y] = pt(k); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.restore();
    if (p > 0.97) { const [ax, ay] = pt(N), [bx, by] = pt(N - 2); arrowHead(g, ax, ay, Math.atan2(ay - by, ax - bx), color, 12); }
    if (o.label && p > 0.6) { const [mx, my] = pt(N / 2); chip(g, o.label, mx, my + (o.ldy || 0), { size: o.lsize || 15, weight: 700, color, fill: COL.panel2, stroke: color, align: 'center', h: 30, r: 9 }); }
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
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
    txt(g, s, x0 + w / 2, y + 1, { size, weight: o.weight || 600, color: o.color || COL.text, align: 'center', fam: o.fam });
    return { x: x0, y: y - h / 2, w, h };
  }
  const tag = (g, s, x, y, color, o = {}) => chip(g, s, x, y, Object.assign({ size: 16, weight: 700, color, fill: COL.panel2, stroke: color, h: 34, r: 10 }, o));
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]); }
  }
  // 너비를 넘으면 끝을 잘라 …
  function fit(g, s, size, weight, maxW) { if (tw(g, s, size, weight) <= maxW) return s; let t = s; while (t.length > 4 && tw(g, t + '…', size, weight) > maxW) t = t.slice(0, -1); return t.trimEnd() + '…'; }
  const say = (x, y, w, h, text, set, spk) => HITS.push({ x, y, w, h, say: text, set, spk });
  const L4 = 'ABCD';
  const SET = id => LT.set(id);

  /* ---------- 영어 글: 낱말 단위 줄 바꿈 + 역할 색 ---------- */
  const RC = { cue: COL.verb, ans: COL.rel, trap: COL.trap, kw: COL.ante, ctx: COL.clause, ok: COL.good, name: COL.ante, dim: COL.dim };
  LTS.RC = RC;
  // marks: [{ t: 글, role, nth }] → 그 글에 걸친 낱말에 역할. 앞에 적은 표시가 먼저
  function richLay(g, text, marks, size, maxW, o = {}) {
    const wt = o.weight || 500, lh = o.lh || Math.round(size * 1.45);
    const words = [];
    String(text).replace(/\S+/g, (w, s) => { const core = w.replace(/[.,?!;:”"’)]+$/, ''); words.push({ w, s, e: s + core.length, core }); return w; });
    (marks || []).forEach(mk => {
      if (!mk || !mk.t) return;
      let i = -1, from = 0;
      for (let n = 0; n <= (mk.nth || 0); n++) { i = text.indexOf(mk.t, from); if (i < 0) i = text.toLowerCase().indexOf(mk.t.toLowerCase(), from); if (i < 0) break; from = i + mk.t.length; }
      if (i < 0) return;
      const e = i + mk.t.length;
      words.forEach(wd => { if (wd.s < e && wd.e > i && !wd.role) wd.role = mk.role; });
    });
    const sp = tw(g, ' ', size, wt), rows = [[]]; let x = 0;
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
  // y = 첫 줄의 가운데. o.color: 보통 글 색, o.plain: 밑줄 없이, o.rolesOff: 역할 색 끄기
  function richDraw(g, R, x, y, o = {}) {
    R.words.forEach((wd, k) => {
      const role = o.rolesOff ? null : wd.role, yy = y + wd.row * R.lh, c = role ? (RC[role] || COL.text) : (o.color || COL.text);
      txt(g, wd.w, x + wd.x, yy, { size: R.size, weight: role ? wd.wt : R.wt, color: c });
      if (role && !o.plain) {
        const nx = R.words[k + 1], join = nx && nx.role === role && nx.row === wd.row && !o.rolesOff;
        g.fillStyle = c; g.fillRect(x + wd.x, yy + R.size * 0.6, join ? nx.x - wd.x : wd.cw, 2.5);
      }
    });
  }
  // 역할이 붙은 낱말들의 상자 (첫 줄 기준)
  function roleBox(R, x, y, role) {
    const ws = R.words.filter(w => w.role === role); if (!ws.length) return null;
    const row = ws[0].row, rw = ws.filter(w => w.row === row), a = rw[0], b = rw[rw.length - 1];
    return { x: x + a.x, y: y + row * R.lh, w: b.x + b.cw - a.x };
  }
  LTS.richLay = richLay; LTS.richDraw = richDraw;

  /* ---------- 대본 말풍선: 화자 표시 + 소리 물결 + 글 ---------- */
  // 소리 물결: on(0→1)이면 막대가 시간 t에 따라 춤춤 (시드 고정이라 같은 t면 같은 모양)
  function wave(g, x, cy, w, h, t, seed, on, color) {
    const N = 8, bw = 3.5, gap = (w - N * bw) / (N - 1);
    for (let k = 0; k < N; k++) {
      const a = Math.abs(Math.sin(t * 9.1 + k * 1.9 + seed)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 4.3 + k * 0.7 + seed * 1.3)));
      const bh = 4 + on * (h - 4) * (0.25 + 0.75 * a);
      rr(g, x + k * (bw + gap), cy - bh / 2, bw, bh, 1.75);
      g.fillStyle = on > 0.05 ? color : 'rgba(238,241,244,0.22)'; g.fill();
    }
  }
  LTS.wave = wave;
  // 배치. o: { x, y, w, size, idx: [줄 번호], gap, marks: { 줄: [...] } }
  function chatLay(g, St, o) {
    const size = o.size || 18, maxW = o.w - 112, gap = o.gap == null ? 12 : o.gap, lh = Math.round(size * 1.42);
    let y = o.y; const rows = {};
    (o.idx || St.lines.map((_, i) => i)).forEach(i => {
      const R = richLay(g, St.lines[i].t, (o.marks && o.marks[i]) || [], size, maxW, { lh });
      const h = Math.max(36, R.h + 8);
      rows[i] = { i, R, x: o.x, y, w: o.w, h, tx: o.x + 102, ty: y + 18 };
      y += h + gap;
    });
    return { rows, y: o.y, bottom: y - gap, set: St };
  }
  const HLF = { ev: 'rgba(127,224,168,0.10)', trap: 'rgba(255,159,122,0.10)', ctx: 'rgba(127,224,168,0.07)', ans: 'rgba(255,193,94,0.10)', cur: 'rgba(110,200,255,0.08)' };
  const HLC = { ev: COL.clause, trap: COL.trap, ctx: 'rgba(127,224,168,0.55)', ans: COL.rel, cur: COL.ante };
  // st(i) → { a, on: 0→1 말하는 중, shown: 0→1 글, hl, hide: 글 대신 막대, name: 이름표 }
  function drawChat(g, C, u, st) {
    const St = C.set;
    Object.values(C.rows).forEach(r => {
      const s = (st && st(r.i)) || {}, a = s.a == null ? 1 : s.a;
      if (a <= 0.001) return;
      fade(g, a, () => {
        if (s.hl) { rr(g, r.x - 8, r.y - 6, r.w + 16, r.h + 12, 12); g.fillStyle = HLF[s.hl]; g.fill(); g.strokeStyle = HLC[s.hl]; g.lineWidth = 2; g.stroke(); }
        const key = St.lines[r.i].s, c = spkColor(St, key);
        g.beginPath(); g.arc(r.x + 18, r.y + 18, 17, 0, Math.PI * 2); g.fillStyle = c; g.fill();
        if (s.on > 0.05) { g.beginPath(); g.arc(r.x + 18, r.y + 18, 21 + 2 * s.on, 0, Math.PI * 2); g.strokeStyle = c; g.globalAlpha *= 0.6; g.lineWidth = 2; g.stroke(); g.globalAlpha /= 0.6; }
        txt(g, key, r.x + 18, r.y + 19, { size: key.length > 1 ? 12.5 : 15, weight: 700, color: COL.bg, align: 'center' });
        const na = s.name ? (s.nameA == null ? 1 : s.nameA) : 0;
        fade(g, 1 - na, () => wave(g, r.x + 46, r.y + 18, 46, 24, u, r.i * 1.7 + key.charCodeAt(0) * 0.31, s.on || 0, c));
        if (s.name) fade(g, na, () => chip(g, s.name, r.x + 70, r.y + 18, { size: 13, weight: 700, color: COL.ante, fill: COL.panel2, stroke: COL.ante, align: 'center', h: 24, r: 7, pad: 6 }));
        const sh = s.shown == null ? 1 : s.shown;
        if (s.hide) {
          r.R.widths.forEach((wd, k) => { rr(g, r.tx, r.ty + k * r.R.lh - 6, Math.max(40, wd), 12, 6); g.fillStyle = 'rgba(238,241,244,0.10)'; g.fill(); });
        } else fade(g, sh, () => richDraw(g, r.R, r.tx, r.ty, { color: s.dimText ? COL.muted : COL.text }));
        if (sh > 0.5 && !s.hide) say(r.x, r.y - 4, r.w, r.h + 8, St.lines[r.i].t, St.id, key);
      });
    });
  }
  // 말하는 시간표: T = { 줄: [시작, 길이] } → 줄마다 상태
  const talkSt = (u, T, extra) => i => {
    const z = T[i]; let s = { a: 1, on: 0, shown: 1 };
    if (z) { const [t0, d] = z; s = { a: ramp(u, t0 - 0.3, 0.3), on: clamp((u - t0) / 0.2) * clamp((t0 + d - u) / 0.3), shown: ramp(u, t0 + 0.25, 0.6) }; }
    return Object.assign(s, extra ? extra(i) || {} : {});
  };
  const rowBox = (C, i) => C.rows[i];
  const wordBox = (C, i, role) => { const r = C.rows[i]; return r ? roleBox(r.R, r.tx, r.ty, role) : null; };

  /* ---------- 문제 칸 ---------- */
  // o: { x, y, w, n, sz, osz, kw: 키워드 색 켜기, st(k) → { gone: 0→1, win, kind, marks, hl, a } , kinds: 이름표 자리 남기기, grid: 2열 }
  function qPanel(g, St, qi, o) {
    const q = St.qs[qi], x = o.x, w = o.w, sz = o.sz || 20, osz = o.osz || 18;
    let y = o.y;
    txt(g, o.n || `Q${qi + 1}`, x, y, { size: 15, weight: 500, fam: FM, color: COL.accent });
    if (o.label) txt(g, o.label, x + 44, y, { size: 14, weight: 600, color: COL.muted });
    y += 28;
    const R = richLay(g, q.q, o.kw ? q.kw.map(t => ({ t, role: 'kw' })) : [], sz, w, { weight: 600 });
    richDraw(g, R, x, y);
    say(x, y - sz * 0.8, R.w, R.h, q.q);
    y += R.h + 10;
    const boxes = [], colW = o.grid ? (w - 16) / 2 : w;
    q.opts.forEach((op, k) => {
      const s = (o.st && o.st(k)) || {};
      const ox = o.grid ? x + (k % 2) * (colW + 16) : x;
      const R2 = richLay(g, op.t, s.marks || [], osz, colW - 48, { weight: 500 });
      const yy = y + R2.lh / 2 + 4, kindH = o.kinds ? 20 : 0, bh = R2.h + kindH + 8;
      fade(g, s.a == null ? 1 : s.a, () => {
        if (s.win) { panel(g, ox - 10, yy - R2.lh / 2 - 4, colW + 14, bh + 2, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 10 }); }
        else if (s.hl) { panel(g, ox - 10, yy - R2.lh / 2 - 4, colW + 14, bh + 2, { fill: HLF[s.hl] || 'transparent', stroke: HLC[s.hl], r: 10 }); }
        const gone = s.gone > 0;
        txt(g, `(${L4[k]})`, ox, yy, { size: osz - 2, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
        richDraw(g, R2, ox + 44, yy, { color: gone ? COL.dim : s.win ? COL.good : COL.text, rolesOff: false });
        if (gone) { const lw0 = R2.widths[0] + 50; g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, yy + 1); g.lineTo(ox - 4 + lw0 * clamp(s.gone), yy + 1); g.stroke(); }
        if (s.win) mark(g, true, ox + colW - 14, yy, 16);
        if (s.kind) fade(g, s.kind, () => txt(g, s.kindText || LT.kindName(op.rel), ox + 44, yy + R2.h - R2.lh / 2 + 15, { size: 13, weight: 700, color: s.win ? COL.good : gone ? COL.dim : COL.muted }));
        say(ox + 40, yy - R2.lh / 2, R2.w + 8, R2.h, op.t);
      });
      boxes.push({ x: ox, y: yy, w: colW, h: bh, R: R2, tx: ox + 44 });
      if (!o.grid || k % 2 === 1) y += Math.max(bh, o.grid ? bh : 0) + (o.gap == null ? 8 : o.gap);
    });
    return { boxes, bottom: y, qR: R };
  }

  /* ---------- 그림: 지도와 표 ---------- */
  // o: { x, y, w, h, hl: { 이름: 역할 }, cross: [이름], rowHl: { 줄: 역할 }, label: { 이름: 글 }, small }
  function graphic(g, G, o) {
    const x = o.x, y = o.y, w = o.w, h = o.h, sm = o.small ? 0.82 : 1, boxes = {};
    panel(g, x, y, w, h, { fill: '#141B24', stroke: COL.faint, r: 12 });
    txt(g, G.title, x + 16, y + 20 * sm, { size: 15 * sm, weight: 700, color: COL.soft });
    if (G.kind === 'map') {
      const pad = 16, top = y + 40 * sm, unit = (w - pad * 2) / 18, hall = (h - (top - y) - pad) * 0.26, rh = (h - (top - y) - pad - hall) / 2;
      // 복도
      rr(g, x + pad, top + rh, w - pad * 2, hall, 4); g.fillStyle = 'rgba(238,241,244,0.04)'; g.fill();
      txt(g, 'Hallway', x + w / 2, top + rh + hall / 2, { size: 12 * sm, weight: 500, fam: FM, color: COL.dim, align: 'center' });
      G.items.forEach(it => {
        const bx = x + pad + it.x * unit + 2, by = it.side === 'top' ? top : top + rh + hall, bw = it.w * unit - 4, bh = rh - 2;
        const role = o.hl && o.hl[it.name], c = role ? (RC[role] || COL.text) : null;
        rr(g, bx, by, bw, bh, 6);
        g.fillStyle = role === 'ans' ? 'rgba(255,193,94,0.20)' : role === 'kw' ? 'rgba(110,200,255,0.14)' : role === 'trap' ? 'rgba(255,159,122,0.10)' : it.room ? '#1E2833' : '#19212B'; g.fill();
        g.strokeStyle = c || (it.room ? 'rgba(238,241,244,0.30)' : 'rgba(238,241,244,0.16)'); g.lineWidth = c ? 2.4 : 1.2;
        if (!it.room && !c) g.setLineDash([4, 4]); g.stroke(); g.setLineDash([]);
        const fs = (it.name.length > 7 ? 13 : 15) * sm;
        txt(g, it.name, bx + bw / 2, by + bh / 2 + (o.label && o.label[it.name] ? -9 : 0), { size: fs, weight: 700, color: c || (it.room ? COL.text : COL.muted), align: 'center' });
        if (o.label && o.label[it.name]) txt(g, o.label[it.name], bx + bw / 2, by + bh / 2 + 11, { size: 11.5 * sm, weight: 700, color: c || COL.muted, align: 'center' });
        if (o.cross && o.cross.includes(it.name)) { g.save(); g.globalAlpha *= 0.95; cross(g, bx + bw - 16, by + 15, 14, COL.trap); g.restore(); g.strokeStyle = COL.trap; g.lineWidth = 2; g.beginPath(); g.moveTo(bx + bw / 2 - tw(g, it.name, fs, 700) / 2 - 4, by + bh / 2); g.lineTo(bx + bw / 2 + tw(g, it.name, fs, 700) / 2 + 4, by + bh / 2); g.stroke(); }
        boxes[it.name] = { x: bx, y: by, w: bw, h: bh, cx: bx + bw / 2, cy: by + bh / 2 };
      });
    } else {
      const pad = 14, top = y + 40 * sm, cw = [0.2, 0.5, 0.3].map(f => f * (w - pad * 2)), rhh = (h - (top - y) - pad) / (G.rows.length + 1);
      let cx = x + pad;
      G.cols.forEach((c, ci) => { txt(g, c, cx + 8, top + rhh / 2, { size: 13 * sm, weight: 700, color: COL.muted }); cx += cw[ci]; });
      G.rows.forEach((r, ri) => {
        const ry = top + rhh * (ri + 1), role = o.rowHl && o.rowHl[ri], c = role ? RC[role] : null;
        rr(g, x + pad, ry + 2, w - pad * 2, rhh - 4, 6);
        g.fillStyle = role === 'ans' ? 'rgba(255,193,94,0.18)' : role === 'trap' ? 'rgba(255,159,122,0.10)' : role === 'kw' ? 'rgba(110,200,255,0.12)' : ri % 2 ? '#18202A' : '#1C2530'; g.fill();
        if (c) { g.strokeStyle = c; g.lineWidth = 2; g.stroke(); }
        let xx = x + pad;
        r.forEach((cell, ci) => { txt(g, cell, xx + 8, ry + rhh / 2, { size: 14.5 * sm, weight: ci === 1 ? 600 : 500, color: c || (r[1] === 'Lunch' ? COL.muted : COL.text) }); xx += cw[ci]; });
        if (o.cross && o.cross.includes(ri)) { g.strokeStyle = COL.trap; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x + pad + 4, ry + rhh / 2); g.lineTo(x + w - pad - 4, ry + rhh / 2); g.stroke(); }
        boxes[ri] = { x: x + pad, y: ry, w: w - pad * 2, h: rhh, cy: ry + rhh / 2 };
      });
    }
    return boxes;
  }
  LTS.graphic = graphic;

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '정답은 다른 말로 말해요', d: 24, caps: [
      [0.4, 5, '토익 Part 3은 두세 사람의 **대화**, Part 4는 한 사람의 **담화**를 듣고 세 문제씩 풀어요.'],
      [5, 10.5, '남자가 말해요 → fully booked. 그런데 보기에는 그 말이 없어요.'],
      [10.5, 15.5, '정답은 No rooms are available. 같은 뜻을 **다른 말**로 바꿨어요.'],
      [15.5, 20, '오히려 대화의 낱말 booked → 그대로 들어간 보기가 **함정**이에요.'],
      [20, 24, '이 원리를 **3단계 풀이법**으로 익혀 볼게요.'],
    ] },
    { id: 'preview', n: '01', title: '문제를 먼저 읽어라', sub: '키워드와 순서', d: 32, caps: [
      [0.4, 6, '문제지에는 세 문제와 보기가 인쇄되어 있어요. 대화는 한 번만 들려주니 **먼저 읽어** 두세요.'],
      [6, 12, '읽으면서 **키워드**에 표시해요. 누구에 대한 문제인지(the man · the woman), 무엇을 묻는지.'],
      [12, 18, 'Why … calling → 전화한 까닭, problem → 문제점, do next → 다음에 할 일.'],
      [18, 25, '세 문제의 답은 대부분 **대화 순서대로** 나와요. 첫 문제는 앞부분, 마지막 문제는 끝부분.'],
      [25, 32, 'Part 3은 13세트 39문제, Part 4는 10세트 30문제. 모두 세 문제씩 한 세트예요.'],
    ] },
    { id: 'para', n: '02', title: '정답은 바꿔 말한다', sub: '패러프레이즈', d: 34, caps: [
      [0.4, 6, '같은 뜻을 다른 말로 하는 것을 **패러프레이즈**(paraphrase, 바꿔 말하기)라고 해요.'],
      [6, 11.5, '한국어도 그래요. ‘방이 다 찼어요’ = ‘빈방이 없어요’. 낱말은 달라도 뜻은 같아요.'],
      [11.5, 17.5, 'fully booked → no rooms available, reserve rooms → book accommodations.'],
      [17.5, 23, '구체적인 말은 넓은 말로 바뀌어요 → projector → equipment, phone number → contact information.'],
      [23, 28.5, '반대로 대화의 낱말이 **그대로** 들어간 보기는 의심하세요. 뜻이 다른 경우가 많아요.'],
      [28.5, 34, '정리하면 → 같은 뜻 다른 말은 **정답** 쪽, 같은 말 다른 뜻은 **함정** 쪽이에요.'],
    ] },
    { id: 'first', n: '03', title: '첫 부분과 단서 낱말', sub: '주제 · 목적 · 장소 · 직업', d: 32, caps: [
      [0.4, 6, '주제나 목적을 묻는 문제는 답이 대개 **첫 부분**에 나와요. I need, I\'m calling about 같은 말 뒤예요.'],
      [6, 11.5, '여자의 첫 말 → I need two hundred posters. 정답 → Order some printed materials.'],
      [11.5, 17.5, '장소나 직업 문제는 이렇게 물어요 → Where most likely …? 직접 말하지 않아서 **추론**해야 해요.'],
      [17.5, 23.5, '단서 낱말을 여럿 모아요 → posters, printed, glossy paper, sample copy. 모두 인쇄소의 말이에요.'],
      [23.5, 28, '한 번 들린 gallery → 포스터를 쓸 곳일 뿐이에요. 낱말 하나로 고르면 함정에 빠져요.'],
      [28, 32, '정답 → At a print shop. 단서가 모두 한곳을 가리켜요.'],
    ] },
    { id: 'signal', n: '04', title: '신호어가 답을 부른다', sub: '문제점 · 요청 · 다음에 할 일', d: 44, caps: [
      [0.4, 6, '문제점을 묻는 문제의 답은 신호어 뒤에 나와요 → but, unfortunately, I\'m afraid.'],
      [6, 12, 'Unfortunately, we\'re fully booked → 바로 이 뒤가 문제점이에요.'],
      [12, 18, '요청과 제안의 신호어 → Could you, Would you mind, Why don\'t you, I suggest.'],
      [18, 24.5, '누가 누구에게 하는 말인지 꼭 확인하세요. 남자의 제안 → Why don\'t you try the Parkside Inn?'],
      [24.5, 30.5, '여자의 요청 → Could you e-mail me their phone number? 문제의 키워드가 the woman → 이 줄을 들어요.'],
      [30.5, 37, '다음에 할 일은 **끝부분**에 나와요 → I\'ll, Let me, I\'m going to.'],
      [37, 44, '이미 한 일 → Let me check, 앞으로 할 일 → I\'ll send it. 둘을 나눠 들으세요.'],
    ] },
    { id: 'intent', n: '05', title: '같은 말, 다른 뜻', sub: '화자 의도 파악', d: 32, caps: [
      [0.4, 6, '화자 의도 문제는 이렇게 물어요 → What does the man mean when he says …?'],
      [6, 12, '같은 문장이라도 앞뒤 대화에 따라 뜻이 달라져요. That\'s the third time this week.'],
      [12, 18, '복사기가 또 고장 났다는 말 뒤라면 → 불만이에요. 기계를 바꿔야 한다는 뜻이죠.'],
      [18, 23.5, '다른 팀이 또 큰 계약을 땄다는 말 뒤라면 → 감탄이에요. 정말 잘하고 있다는 뜻이에요.'],
      [23.5, 28, '그래서 따옴표 문장만 듣지 말고, 그 **앞 줄과 뒤 줄**을 들어요.'],
      [28, 32, '낱말 뜻 그대로 옮긴 보기 → 함정이에요. third → 세 번째 층처럼요.'],
    ] },
    { id: 'graphic', n: '06', title: '그림과 합쳐라', sub: '시각 정보 연계', d: 32, caps: [
      [0.4, 6, 'Look at the graphic → 그림 문제예요. 표, 지도, 일정표가 함께 나와요.'],
      [6, 11.5, '먼저 그림과 보기를 봐요. 보기가 방 이름이면, 대화에서는 방 이름 **말고 다른 말**이 들려요.'],
      [11.5, 17, '대화 → We can\'t use Room 3. 그대로 들린 Room 3 → 함정이에요.'],
      [17, 23, '이어서 → the room across from the elevator. 이 말을 그림에서 찾아야 해요.'],
      [23, 28, '엘리베이터 맞은편 → Room 2. 들은 말과 그림을 **합쳐야** 답이 나와요.'],
      [28, 32, '헷갈리지 마세요 → 바로 옆(next to) = Room 4, 맞은편(across from) = Room 2.'],
    ] },
    { id: 'three', n: '07', title: '세 사람, 누가 말했나', sub: '세 사람 대화의 화자 구분', d: 24, caps: [
      [0.4, 6, '세 사람 대화에는 남자 둘이나 여자 둘이 나와요. 목소리만으로는 헷갈리기 쉬워요.'],
      [6, 12, '이름을 부르는 말을 잡으세요 → Raj, could you …? 바로 다음에 대답하는 사람 = Raj.'],
      [12, 18, '남은 남자 한 사람 = Kenji. 문제에 이름이 나오면 그 사람의 말만 따라가요.'],
      [18, 24, 'What does Kenji offer to do? → I can record it → Record some audio. 편집은 Raj 몫이라 함정이에요.'],
    ] },
    { id: 'talk', n: '08', title: '담화에는 순서가 있다', sub: 'Part 4 담화 유형별 흐름', d: 32, caps: [
      [0.4, 6, 'Part 4는 한 사람이 말해요. 종류마다 이야기의 **순서**가 거의 정해져 있어요.'],
      [6, 12.5, '음성 메시지 → 인사와 이름, 전화한 까닭, 문제나 부탁, 연락 방법 순서예요.'],
      [12.5, 18.5, '안내 방송은 Attention으로 시작해 바뀐 일과 까닭, 할 일을 알려요.'],
      [18.5, 24.5, '광고는 질문으로 시작해 상품, 할인, 연락 방법으로 끝나요. 회의는 주제, 소식, 할 일 순서예요.'],
      [24.5, 31.5, '흐름을 알면 세 문제의 자리도 보여요 → 누가 말하나, 왜 말하나, 무엇을 하라고 하나.'],
    ] },
    { id: 'method', n: '09', title: '3단계 풀이법', sub: '미리 읽기 → 신호 듣기 → 바꿔 말하기', d: 27, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11.5, '① **미리 읽기**. 키워드와 누구에 대한 문제인지 표시해요. 다른 사람의 말, 때가 다른 일 → 여기서 지워요.'],
      [11.5, 17.5, '② **신호 듣기**. 신호어 뒤의 근거 줄을 잡아요. 나오지 않은 내용, 반대 내용 → 탈락.'],
      [17.5, 22.5, '③ **바꿔 말한 보기**를 골라요. 그대로 들린 낱말과 그림에 안 맞는 칸 → 마지막에 지워요.'],
      [22.5, 27, '세 단계를 지나 남은 하나가 정답이에요. 이 순서로 처음 듣는 대화를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '10', title: '실전 문제 풀이', sub: '토익 Part 3 한 세트', d: 54, caps: [
      [0.4, 6, '첫 문제. ① 키워드 → the woman, problem. 수리 요청이 많다는 것은 남자의 말 → (A) 탈락.'],
      [6, 12, '② 신호 → The problem is, it keeps shutting down. 전화기 이야기는 없어요 → (C) 탈락.'],
      [12, 18, '③ 그대로 들린 slides → (D) 탈락. shutting down = turning off. 정답은 (B).'],
      [18.4, 24.5, '둘째 문제. ① 키워드 → the man, suggest. 메시지는 여자가 이미 보냈어요 → (D) 탈락.'],
      [24.5, 30.5, '② 신호 → Why don\'t you borrow one of our spare laptops? 발표를 미루라는 말은 없어요 → (B) 탈락.'],
      [30.5, 36, '③ 그대로 들린 manufacturer → (A) 탈락. spare laptop = temporary device. 정답은 (C).'],
      [36.4, 42.5, '셋째 문제. ① 키워드 → the woman, next. 파일 옮기기는 남자가 할 일 → (A) 탈락.'],
      [42.5, 48.5, '② 신호 → I\'ll bring my laptop down to your office. 새 노트북 이야기는 없어요 → (B) 탈락.'],
      [48.5, 54, '③ 그대로 들린 client → (C) 탈락. your office = the help desk. 정답은 (D).'],
    ] },
    { id: 'summary', n: '11', title: '정리', sub: '한눈에 보는 표', d: 20, caps: [
      [0.4, 6, '정리해요. Part 3·4는 문제를 먼저 읽고, 신호어 뒤의 근거 줄을 잡아요.'],
      [6, 12, '정답은 같은 뜻을 **다른 말**로 해요. 그대로 들린 낱말은 의심하세요.'],
      [12, 16, '의도 문제는 앞뒤 줄로, 그림 문제는 들은 말과 그림을 합쳐 풀어요.'],
      [16, 20, '아래 놀이터와 연습 문제에서 직접 듣고 풀어 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  LTS.CHAPTERS = CHAPTERS; LTS.CAPTIONS = CAPTIONS; LTS.END = END;
  LTS.POSTER = CHAPTERS.find(c => c.id === 'graphic').t + 26;
  LTS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  LTS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };
  // 장면마다 쓰는 세트 (직접 해 보기의 ‘이 대화 듣기’)
  LTS.SETOF = { intro: 'hotel', preview: 'hotel', para: 'hotel', first: 'print', signal: 'hotel', intent: 'copier', graphic: 'map', three: 'team', talk: 'dental', practice: 'help' };

  // 실전 문제: help 세트. ①·②·③에서 지워지는 보기를 규칙 엔진으로 정함 (자막·풀이 줄과 맞는지 점검)
  // at: 오른쪽 풀이 줄이 나오는 때 · x: ①·②·③ 탈락 줄이 그어지는 때 · win: 정답 표시
  const PRACTICE = [
    { at: [0.4, 6, 12], x: [4.4, 10.2, 14.4], win: 15.6, lines: ['키워드 the woman · problem · (A) 탈락', 'The problem is → 줄 2 · (C) 탈락', 'shutting down = turning off · (D) 탈락 → (B)'] },
    { at: [0.2, 6.3, 12.3], x: [4.6, 10.6, 14.8], win: 16, lines: ['키워드 the man · suggest · (D) 탈락', "Why don't you → 줄 5 · (B) 탈락", 'spare laptop = temporary device · (A) 탈락 → (C)'] },
    { at: [0.2, 6.3, 12.3], x: [4.6, 10.6, 14.8], win: 16, lines: ['키워드 the woman · next · (A) 탈락', "I'll → 줄 6 · (B) 탈락", 'your office = the help desk · (C) 탈락 → (D)'] },
  ];
  (() => {
    const St = SET('help');
    PRACTICE.forEach((p, qi) => {
      const q = St.qs[qi];
      [1, 2, 3].forEach(step => {
        const out = q.opts.map((o, k) => LT.judge(St, qi, k).step === step ? `(${L4[k]})` : '').filter(Boolean).join(' ');
        if (!out || !p.lines[step - 1].includes(out + ' 탈락')) console.warn('[듣기 Part 3·4] 실전 문제 탈락 표시가 규칙 엔진과 달라요:', q.q, step, out);
      });
      if (!p.lines[2].includes(`(${L4[q.a]})`)) console.warn('[듣기 Part 3·4] 실전 문제 정답 표시가 데이터와 달라요:', q.q);
      const cap = CHAPTERS.find(c => c.id === 'practice').caps.slice(qi * 3, qi * 3 + 3).map(c => c[2]).join(' ');
      q.opts.forEach((o, k) => { const j = LT.judge(St, qi, k); if (j.step && !cap.includes(`(${L4[k]}) 탈락`)) console.warn('[듣기 Part 3·4] 실전 문제 자막에 탈락 표시가 없어요:', q.q, L4[k]); });
      if (!cap.includes(`정답은 (${L4[q.a]})`)) console.warn('[듣기 Part 3·4] 실전 문제 자막의 정답이 데이터와 달라요:', q.q);
    });
  })();

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  function label(g, s, x, y, o = {}) { return txt(g, s, x, y, Object.assign({ size: 16, weight: 600, color: COL.muted }, o)); }
  // 한 줄에 칩 여러 개 (가운데 맞춤 가능). 하나씩 나타남
  function chipRow(g, words, x, y, u, at, o = {}) {
    const size = o.size || 17, pad = o.pad || 14, gapX = o.gap || 12;
    const ws = words.map(w => tw(g, w, size, 700) + pad * 2), total = ws.reduce((a, b) => a + b, 0) + gapX * (words.length - 1);
    let xx = o.center ? x - total / 2 : x;
    words.forEach((w, k) => {
      const px = xx;
      fade(g, ramp(u, at + k * (o.step || 0.3), 0.4), () => chip(g, w, px, y, { size, weight: 700, color: o.color, fill: COL.panel, stroke: o.color, h: o.h || 36, r: 8, pad }));
      xx += ws[k] + gapX;
    });
    return xx;
  }
  // 들은 말 → 보기 한 줄 (패러프레이즈 짝)
  function pairRow(g, heard, opt, y, a, o = {}) {
    fade(g, a, () => {
      wave(g, LX, y, 30, 18, 0, 3, 0, COL.en);
      const hw = txt(g, heard, LX + 44, y, { size: o.size || 23, weight: 600, color: COL.en });
      say(LX + 40, y - 18, hw + 8, 36, heard);
      const ax = o.ax || 560;
      arrow(g, Math.max(LX + 60 + hw, ax - 40), y, ax + 24, y, o.color || COL.rel, 2.5, o.p == null ? 1 : o.p);
      if ((o.p == null ? 1 : o.p) > 0.9) {
        const ow = txt(g, opt, ax + 46, y, { size: o.size || 23, weight: 700, color: o.color || COL.rel });
        say(ax + 42, y - 18, ow + 8, 36, opt);
        if (o.strike) { g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(ax + 42, y + 2); g.lineTo(ax + 42 + (ow + 8) * clamp(o.strike), y + 2); g.stroke(); if (o.strike >= 1) mark(g, false, ax + 62 + ow, y, 15); }
        if (o.ok) mark(g, true, ax + 66 + ow, y, 16);
      }
    });
  }

  const SCENES = {
    /* 00 들어가며: 제목 → Part 3 문제 카드(fully booked → No rooms are available) → booked 함정 → 3단계 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.2, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '먼저 읽고, 바꿔 말한 답을 잡아라', W / 2, 282, { size: 56, weight: 800, fam: FD, align: 'center' });
        txt(g, 'TOEIC Listening · Part 3 Conversations · Part 4 Talks', W / 2, 354, { size: 24, weight: 500, color: COL.muted, align: 'center' });
      });
      fade(g, out1, () => chipRow(g, ['Part 3 · 대화', 'Part 4 · 담화', '세트마다 세 문제', '정답 = 바꿔 말한 말'], W / 2, 446, u, 1.2, { color: COL.verb, size: 18, h: 42, step: 0.35, center: true }));
      const St = SET('hotel'), a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 19.2, 0.6));
      fade(g, a2, () => {
        panel(g, LX, 148, 1120, 424, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 3 · 대화 듣기', LX + 28, 180, { size: 15, weight: 500, fam: FM, color: COL.accent });
        const marks = { 3: u > 8.2 ? [{ t: 'fully booked', role: 'ans' }] : [] };
        const C = chatLay(g, St, { x: LX + 28, y: 222, w: 590, size: 20, idx: [3, 4], marks });
        drawChat(g, C, u, talkSt(u, { 3: [5.0, 3.0], 4: [8.3, 1.4] }, i => i === 3 && u > 8.2 ? { hl: 'ev' } : {}));
        const P = qPanel(g, St, 1, { x: 730, y: 186, w: 440, kw: u > 6.2, sz: 21, osz: 19, gap: 14, kinds: true,
          st: k => ({ a: ramp(u, 5.6 + k * 0.25, 0.4), win: k === 2 && u > 12.2, kind: (k === 2 && u > 12.6) || (k === 1 && u > 16.6) ? 1 : 0,
            marks: k === 2 && u > 10.8 ? [{ t: 'No rooms are available', role: 'ans' }] : k === 1 && u > 15.8 ? [{ t: 'booked', role: 'trap' }] : [],
            gone: k === 1 ? ramp(u, 17, 0.5) : 0 }) });
        const fb = wordBox(C, 3, 'ans'), ob = P.boxes[2], r3 = C.rows[3];
        if (fb && u > 10.8) curve(g, fb.x + fb.w / 2, r3.y + r3.h + 8, fb.x + fb.w / 2 + 40, ob.y + 30, ob.x - 18, ob.y, COL.rel, ramp(u, 10.8, 1.0), { label: '같은 뜻 · 다른 말', lsize: 15, ldy: 8 });
        fade(g, ramp(u, 16.6, 0.5), () => tag(g, '그대로 들린 낱말 → 함정', LX + 28, 540, COL.trap));
      });
      const steps = [['①', '미리 읽기', '키워드 · 순서 · 그림'], ['②', '신호 듣기', "but · Could you · I'll"], ['③', '바꿔 말한 보기', '같은 뜻 다른 말']];
      steps.forEach(([n, t1, t2], k) => {
        const a = ramp(u, 19.8 + k * 0.7, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 220, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 285 + (1 - a) * 16, { size: 34, weight: 700, color: COL.accent });
          txt(g, t1, x0 + 28, 345 + (1 - a) * 16, { size: 26, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 400 + (1 - a) * 16, { size: 19, weight: 500, color: COL.en });
        });
      });
    },

    /* 01 문제를 먼저 읽어라: 문제지(세 문제 + 키워드) → 묻는 것 → 대화 시간선 위 Q1 · Q2 · Q3 → 세트 수 */
    preview(g, u) {
      const St = SET('hotel'), n = St.lines.length;
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, LX, 146, 700, 300, { fill: COL.panel, stroke: COL.faint });
        txt(g, '문제지 (Test Book)', LX + 22, 172, { size: 14, weight: 500, fam: FM, color: COL.muted });
      });
      const TYPE = ['전화한 까닭', '문제점', '다음에 할 일'];
      St.qs.forEach((q, qi) => {
        const y = 222 + qi * 82;
        fade(g, ramp(u, 0.8 + qi * 0.4, 0.5), () => {
          txt(g, `Q${qi + 1}`, LX + 22, y, { size: 15, weight: 500, fam: FM, color: COL.accent });
          const R = richLay(g, q.q, u > 6.4 + qi * 0.6 ? q.kw.map(t => ({ t, role: 'kw' })) : [], 22, 560, { weight: 600 });
          richDraw(g, R, LX + 66, y); say(LX + 60, y - 18, R.w + 12, 36, q.q);
          txt(g, fit(g, q.opts.map((o, k) => `(${L4[k]}) ${o.t}`).join('   '), 12.5, 500, 600), LX + 66, y + 32, { size: 12.5, weight: 500, color: COL.dim });
          fade(g, ramp(u, 12.4 + qi * 1.4, 0.5), () => tag(g, TYPE[qi], LX + 680, y, COL.ante, { align: 'right', size: 15, h: 30 }));
        });
      });
      // 오른쪽 안내
      const notes = [['문제 + 보기', '인쇄되어 있어요'], ['대화', '한 번만 들려줘요'], ['문제', '대화가 끝난 뒤 읽어 줘요']];
      notes.forEach(([a, b], k) => fade(g, ramp(u, 1.6 + k * 0.6, 0.5) * (1 - ramp(u, 24.6, 0.5)), () => {
        const y = 186 + k * 74;
        panel(g, 820, y - 26, 380, 56, { fill: COL.panel2, stroke: COL.faint, r: 10 });
        txt(g, a, 840, y + 2, { size: 17, weight: 700, color: COL.soft });
        txt(g, b, 1180, y + 2, { size: 16, weight: 600, color: COL.muted, align: 'right' });
      }));
      fade(g, ramp(u, 25.2, 0.6), () => {
        [['Part 3', '13세트 × 3 = 39문제', '대화 · 두세 사람'], ['Part 4', '10세트 × 3 = 30문제', '담화 · 한 사람']].forEach(([p, a, b], k) => {
          const y = 196 + k * 110;
          panel(g, 820, y - 40, 380, 92, { fill: COL.panel2, stroke: COL.accent, r: 12 });
          txt(g, p, 842, y - 12, { size: 20, weight: 800, fam: FD, color: COL.accent });
          txt(g, a, 842, y + 22, { size: 18, weight: 700 });
          txt(g, b, 1180, y - 12, { size: 14, weight: 600, color: COL.muted, align: 'right' });
        });
      });
      // 시간선: 대화의 여덟 줄
      const tx0 = LX, tw0 = 1120, seg = tw0 / n;
      fade(g, ramp(u, 18.2, 0.6), () => {
        txt(g, '대화의 흐름 →', 760, 476, { size: 15, weight: 700, color: COL.muted });
        St.lines.forEach((l, i) => {
          const x = tx0 + i * seg + 4, c = spkColor(St, l.s);
          rr(g, x, 494, seg - 8, 40, 8); g.fillStyle = COL.panel2; g.fill();
          txt(g, l.s, x + 16, 514, { size: 13, weight: 700, color: c, align: 'center' });
          wave(g, x + 30, 514, seg - 50, 22, u, i * 2.1, ramp(u, 18.6 + i * 0.25, 0.3) * (1 - ramp(u, 18.9 + i * 0.25, 0.3)), c);
        });
        [['앞부분', 0], ['가운데', 0.5], ['끝부분', 1]].forEach(([s, f]) => txt(g, s, tx0 + 40 + f * (tw0 - 80), 556, { size: 14, weight: 700, color: COL.dim, align: 'center' }));
      });
      St.qs.forEach((q, qi) => {
        const cx = tx0 + q.ev * seg + seg / 2, a = ramp(u, 20.2 + qi * 1.2, 0.5);
        fade(g, a, () => {
          rr(g, tx0 + q.ev * seg + 4, 494, seg - 8, 40, 8); g.strokeStyle = COL.rel; g.lineWidth = 2.4; g.stroke();
          chip(g, `Q${qi + 1} → ${LT.PARTN[LT.part(St, q.ev)]}`, cx, 466 - (1 - a) * 10, { size: 14, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, align: 'center', h: 28, r: 8, pad: 10 });
        });
      });
    },

    /* 02 정답은 바꿔 말한다: 한국어 예 → 짝 넷(데이터에서) → booked 함정 → 규칙 둘 */
    para(g, u) {
      fade(g, ramp(u, 0.4, 0.6), () => tag(g, '패러프레이즈 (paraphrase) = 바꿔 말하기', LX, 166, COL.accent, { size: 17, h: 38 }));
      fade(g, ramp(u, 6.2, 0.6), () => {
        const y = 232, a = chip(g, '방이 다 찼어요', LX + 10, y, { size: 22, weight: 700, color: COL.en, fill: COL.panel2, stroke: COL.en, h: 46, r: 12 });
        txt(g, '=', a.x + a.w + 30, y, { size: 28, weight: 700, color: COL.muted, align: 'center' });
        chip(g, '빈방이 없어요', a.x + a.w + 60, y, { size: 22, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, h: 46, r: 12 });
        txt(g, '한국어도 낱말만 바꿔 같은 뜻을 말해요', a.x + a.w + 280, y, { size: 17, weight: 600, color: COL.muted });
      });
      const H = SET('hotel'), M = SET('map');
      const pp = (St, qi) => St.qs[qi].opts[St.qs[qi].a].x.pp;
      const rows = [
        [pp(H, 1)[0][0], pp(H, 1)[0][1], 300, 11.8], [pp(H, 0)[0][0], pp(H, 0)[0][1], 352, 13.4],
        ["The projector isn't working", 'Some equipment is broken', 418, 17.8], [pp(H, 2)[1][0], pp(H, 2)[1][1], 470, 19.6],
      ];
      // 짝이 실제 데이터(정답의 바꿔 말하기)와 같은지
      if (!M.lines[1].t.includes("The projector there isn't working") || M.qs[0].opts[M.qs[0].a].t !== 'Some equipment is broken.') console.warn('[듣기 Part 3·4] 02장 짝이 데이터와 달라요');
      fade(g, ramp(u, 11.6, 0.4), () => label(g, '들은 말', LX + 44, 274, { size: 14, color: COL.en }));
      fade(g, ramp(u, 11.6, 0.4), () => label(g, '바꿔 말한 보기', 606, 274, { size: 14, color: COL.rel }));
      rows.forEach(([h, o, y, at]) => pairRow(g, h, o, y, ramp(u, at, 0.5), { p: ramp(u, at + 0.6, 0.6), ok: u > at + 1.6 }));
      fade(g, ramp(u, 21, 0.5), () => tag(g, '구체적인 말 → 넓은 말', W - 80, 444, COL.ante, { align: 'right', size: 15, h: 32 }));
      fade(g, ramp(u, 23.2, 0.5), () => {
        label(g, '함정', LX, 506, { size: 14, color: COL.trap });
      });
      pairRow(g, 'fully booked', 'A room was booked under the wrong name.', 534, ramp(u, 23.4, 0.5), { color: COL.trap, p: ramp(u, 24, 0.6), strike: ramp(u, 25.6, 0.6), ax: 360 });
      fade(g, ramp(u, 28.6, 0.5), () => tag(g, '같은 뜻 다른 말 → 정답 쪽', W - 80, 166, COL.rel, { align: 'right' }));
      fade(g, ramp(u, 29.6, 0.5), () => tag(g, '같은 말 다른 뜻 → 함정 쪽', W - 80, 534, COL.trap, { align: 'right' }));
    },

    /* 03 첫 부분과 단서 낱말: 인쇄소 대화 → Q1 목적(첫 줄) → Q2 장소(단서 낱말 모으기) → gallery 함정 */
    first(g, u) {
      const St = SET('print');
      const clues = St.qs[1].clues, clueOn = clues.map((c, k) => u > 17.8 + k * 0.6);
      const marks = {};
      const add = (i, t, role) => (marks[i] = marks[i] || []).push({ t, role });
      if (u > 6.8 && u < 11.4) add(0, 'I need two hundred posters', 'ans');
      if (u > 23.6) add(0, 'gallery', 'trap');
      clues.forEach(([t, i], k) => { if (clueOn[k]) add(i, t, 'kw'); });
      const C = chatLay(g, St, { x: LX, y: 160, w: 600, size: 19, marks });
      drawChat(g, C, u, talkSt(u, { 0: [0.6, 2.6], 1: [3.4, 1.4], 2: [5.0, 1.0], 3: [6.2, 1.4] }, i => i === 0 && u > 6.4 && u < 11.4 ? { hl: 'ev' } : {}));
      const q1 = 1 - ramp(u, 11.2, 0.4), q2 = ramp(u, 11.6, 0.5);
      fade(g, ramp(u, 0.4, 0.5) * q1, () => qPanel(g, St, 0, { x: 730, y: 170, w: 470, kw: u > 1.2, kinds: true,
        st: k => ({ win: k === 1 && u > 8.6, kind: k === 1 && u > 9 ? 1 : 0, marks: k === 1 && u > 8 ? [{ t: 'Order some printed materials', role: 'ans' }] : [] }) }));
      fade(g, ramp(u, 1.4, 0.5) * q1, () => tag(g, '주제 · 목적 → 첫 부분', 730, 520, COL.ante));
      let P2 = null;
      fade(g, q2, () => {
        P2 = qPanel(g, St, 1, { x: 730, y: 170, w: 470, kw: u > 12, kinds: true,
          st: k => ({ win: k === 2 && u > 28.2, kind: (k === 2 && u > 28.6) || (k === 0 && u > 25) ? 1 : 0, gone: k === 0 ? ramp(u, 24.6, 0.5) : 0,
            marks: k === 0 && u > 23.6 ? [{ t: 'gallery', role: 'trap' }] : [] }) });
        fade(g, ramp(u, 13, 0.5) * (1 - ramp(u, 17.4, 0.4)), () => tag(g, 'most likely → 추론', 730, 520, COL.ante));
        chipRow(g, clues.map(c => c[0]), 730, 506, u, 17.8, { color: COL.ante, size: 15, h: 32, step: 0.6, pad: 10, gap: 8 });
        fade(g, ramp(u, 21.4, 0.5), () => { arrow(g, 960, 526, 960, 542, COL.rel, 2.5); tag(g, '모두 인쇄소의 말', 960, 560, COL.rel, { align: 'center' }); });
      });
    },

    /* 04 신호어: Unfortunately → 문제점 · Why don't you → 제안 · Could you → 요청 · I'll → 다음 · Let me check = 이미 한 일 */
    signal(g, u) {
      const St = SET('hotel');
      const marks = {}, add = (i, t, role) => (marks[i] = marks[i] || []).push({ t, role });
      if (u > 37.2) add(3, 'Let me check', 'trap');
      if (u > 6) add(3, 'Unfortunately', 'cue');
      if (u > 7) add(3, 'fully booked', 'ans');
      if (u > 18.4) add(5, "Why don't you", 'cue');
      if (u > 24.8) add(6, 'Could you', 'cue');
      if (u > 30.8) add(7, "I'll", 'cue');
      if (u > 38.4) add(7, 'send it', 'ans');
      const C = chatLay(g, St, { x: LX, y: 150, w: 690, size: 19, idx: [3, 4, 5, 6, 7], marks, gap: 12 });
      const hl = i => (i === 3 && u > 6.4 && u < 37) ? 'ev' : (i === 5 && u > 18.6 && u < 24.5) ? 'cur' : (i === 6 && u > 25 && u < 30.5) ? 'cur' : (i === 7 && u > 31 && u < 37) ? 'ev' : null;
      drawChat(g, C, u, talkSt(u, { 3: [0.4, 1.2], 4: [1.5, 0.6], 5: [2.2, 1.0], 6: [3.3, 0.7], 7: [4.1, 0.6] }, i => ({ hl: hl(i) })));
      const tagAt = (i, s, color, a, dy = 0) => { const r = C.rows[i]; if (r) fade(g, a, () => tag(g, s, 800, r.y + 18 + dy, color, { size: 15, h: 32 })); };
      tagAt(3, '문제점', COL.verb, ramp(u, 6.6, 0.5));
      tagAt(3, 'Let me check → 이미 한 일', COL.trap, ramp(u, 37.6, 0.5), 38);
      tagAt(5, '남자 → 여자 · 제안', COL.verb, ramp(u, 19.2, 0.5));
      tagAt(6, '여자 → 남자 · 요청', COL.verb, ramp(u, 25.4, 0.5));
      fade(g, ramp(u, 26.6, 0.5) * (1 - ramp(u, 30.4, 0.4)), () => { const r = C.rows[6]; if (r) txt(g, 'What does the woman ask the man to do?', 800, r.y + 50, { size: 14, weight: 600, color: COL.ante }); });
      tagAt(7, "I'll → 다음에 할 일", COL.verb, ramp(u, 31.4, 0.5));
      tagAt(7, 'send it → 앞으로 할 일', COL.rel, ramp(u, 38.8, 0.5), 38);
      // 아래: 신호어 표
      const G3 = [['문제점', "but · unfortunately · I'm afraid", 0.4], ['요청 · 제안', "Could you · Would you mind · Why don't you · I suggest", 12.2], ['다음에 할 일', "I'll · Let me · I'm going to", 30.6]];
      G3.forEach(([h, s, at], k) => fade(g, ramp(u, at, 0.6), () => {
        const x = LX + [0, 300, 760][k], w = [280, 440, 360][k];
        panel(g, x, 482, w, 86, { fill: COL.panel2, stroke: COL.verb, r: 12 });
        txt(g, h, x + 16, 508, { size: 16, weight: 800, color: COL.verb });
        let sz = 16; while (tw(g, s, sz, 600) > w - 30 && sz > 12) sz -= 0.5;
        txt(g, s, x + 16, 544, { size: sz, weight: 600, color: COL.en });
      }));
    },

    /* 05 같은 말, 다른 뜻: 두 대화 속 "That's the third time this week." → 앞뒤 줄 → 뜻이 달라짐 */
    intent(g, u) {
      const A = SET('copier'), B = SET('contract');
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, LX, 140, 1120, 50, { fill: COL.panel2, stroke: COL.faint, r: 10 });
        const R = richLay(g, A.qs[0].q, u > 1.4 ? [{ t: 'mean', role: 'kw' }, { t: "That's the third time this week", role: 'ans' }] : [], 19, 1080, { weight: 600 });
        richDraw(g, R, LX + 20, 165); say(LX, 140, 1120, 50, A.qs[0].q);
      });
      const col = (St, x, w, at, ctxAt, ansK) => {
        const q = St.qs[0], marks = {};
        if (u > at + 2) (marks[1] = marks[1] || []).push({ t: "That's the third time this week", role: 'ans' });
        if (u > ctxAt) q.opts[ansK].x.pp.forEach(([h, , li]) => (marks[li == null ? 0 : li] = marks[li == null ? 0 : li] || []).push({ t: h, role: 'ctx' }));
        if (u > 28.4 && St.id === 'copier') (marks[0] = marks[0] || []).push({ t: 'third floor', role: 'trap' });
        const C = chatLay(g, St, { x, y: 222, w, size: 17, marks, gap: 8 });
        fade(g, ramp(u, at - 0.4, 0.5), () => { txt(g, (S.ctx ? '' : (St.id === 'copier' ? '대화 1 · ' : '대화 2 · ')) + St.title, x, 204, { size: 14, weight: 700, color: COL.soft }); });
        drawChat(g, C, u, talkSt(u, { 0: [at, 1.0], 1: [at + 1.3, 0.8], 2: [at + 2.3, 1.0] }, i => ({ hl: i === 1 && u > at + 2 ? 'ans' : (i !== 1 && u > ctxAt) ? 'ctx' : null })));
        const m = q.opts[ansK].x.mean, yb = C.bottom + 34;
        fade(g, ramp(u, ctxAt + 1.2, 0.5), () => { let sz = 16; while (tw(g, m, sz, 700) > w - 20 && sz > 12) sz -= 0.5; tag(g, m, x, yb, COL.clause, { size: sz, h: 32 }); });
        fade(g, ramp(u, ctxAt + 2.6, 0.5), () => {
          const j = LT.judge(St, 0, ansK), s = `(${L4[ansK]}) ${q.opts[ansK].t}`, ww = txt(g, s, x, yb + 46, { size: 18, weight: 700, color: j.s === 'ok' ? COL.good : COL.bad });
          mark(g, j.s === 'ok', x + ww + 18, yb + 46, 15); say(x, yb + 30, ww, 32, q.opts[ansK].t);
        });
        return C;
      };
      if (S.ctx) {
        const St = SET(S.ctx);
        col(St, LX + 180, 760, -10, -1, St.qs[0].a);
      } else {
        col(A, LX, 540, 6.2, 12.4, A.qs[0].a);
        col(B, 660, 540, 6.6, 18.4, B.qs[0].a);
      }
      fade(g, ramp(u, 23.6, 0.5) * (1 - ramp(u, 27.8, 0.4)), () => tag(g, '따옴표 문장의 앞 줄 + 뒤 줄 → 뜻', W / 2, 550, COL.clause, { align: 'center', size: 17, h: 38 }));
      fade(g, ramp(u, 28.2, 0.5), () => {
        const s = `(D) ${A.qs[0].opts[3].t}`, x = W / 2 - tw(g, s, 18, 600) / 2 - 60;
        const ww = txt(g, s, x, 552, { size: 18, weight: 600, color: COL.trap });
        g.strokeStyle = COL.bad; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - 4, 554); g.lineTo(x - 4 + (ww + 8) * ramp(u, 29, 0.6), 554); g.stroke();
        if (u > 29.6) { mark(g, false, x + ww + 22, 552, 14); txt(g, 'third → 낱말 뜻 그대로', x + ww + 44, 552, { size: 15, weight: 700, color: COL.trap }); }
      });
    },

    /* 06 그림과 합쳐라: 지도 + 들은 말. Room 3(그대로 들림) × → across from the elevator → Room 2 ✓, Room 4 = next to */
    graphic(g, u) {
      const St = SET('map'), G = LT.G[St.G], q = St.qs[1];
      const marks = {}, add = (i, t, role) => (marks[i] = marks[i] || []).push({ t, role });
      if (u > 11.8) add(1, 'Room 3', 'trap');
      if (u > 17.4 && !S.rel) add(2, 'across from the elevator', 'ans');
      const C = chatLay(g, St, { x: LX, y: 160, w: 560, size: 18, marks });
      drawChat(g, C, u, talkSt(u, { 0: [0.8, 1.2], 1: [2.2, 1.4], 2: [3.8, 1.4], 3: [5.4, 1.0] }, i => ({ hl: i === 1 && u > 11.8 && u < 17 ? 'trap' : i === 2 && u > 17.4 && !S.rel ? 'ev' : null })));
      // 지도
      const user = S.rel ? LT.where(G, S.rel.rel, S.rel.of) : null;
      const hl = {}, labelT = {};
      if (S.rel) { hl[S.rel.of] = 'kw'; if (user) { hl[user] = 'ans'; labelT[user] = { across: '맞은편', next: '바로 옆' }[S.rel.rel]; } }
      else {
        if (u > 18) hl.Elevator = 'kw';
        if (u > 23.4) { hl['Room 2'] = 'ans'; labelT['Room 2'] = '맞은편'; }
        if (u > 28.4) { hl['Room 4'] = 'trap'; labelT['Room 4'] = '바로 옆'; }
      }
      let B = {};
      fade(g, ramp(u, 0.4, 0.6), () => { B = graphic(g, G, { x: 680, y: 150, w: 520, h: 240, hl, label: labelT, cross: !S.rel && u > 12.6 ? ['Room 3'] : [] }); });
      if (S.rel && user && B[S.rel.of]) {
        const A0 = B[S.rel.of], B0 = B[user];
        if (Math.abs(A0.cy - B0.cy) < 2) { const dir = B0.cx < A0.cx ? -1 : 1; arrow(g, A0.cx + dir * (A0.w / 2 - 6), A0.y + A0.h - 12, B0.cx - dir * (B0.w / 2 - 6), B0.y + B0.h - 12, COL.rel, 2.6); }
        else arrow(g, A0.cx, B0.cy < A0.cy ? A0.y + 4 : A0.y + A0.h - 4, B0.cx, B0.cy < A0.cy ? B0.y + B0.h - 6 : B0.y + 6, COL.rel, 2.6);
      }
      if (!S.rel && B.Elevator) arrow(g, B.Elevator.cx, B.Elevator.y + 4, B['Room 2'].cx, B['Room 2'].y + B['Room 2'].h - 6, COL.rel, 2.6, ramp(u, 19.2, 1.2));
      fade(g, ramp(u, 0.8, 0.5), () => {
        const yy = 418;
        txt(g, 'Q2', 680, yy, { size: 15, weight: 500, fam: FM, color: COL.accent });
        const R = richLay(g, q.q, u > 1.4 ? q.kw.map(t => ({ t, role: 'kw' })) : [], 18, 470, { weight: 600 }); richDraw(g, R, 720, yy); say(720, yy - 16, R.w, R.h, q.q);
        const want = S.rel ? user : null;
        q.opts.forEach((o, k) => {
          const ox = 690 + (k % 2) * 260, oy = yy + R.h + 26 + Math.floor(k / 2) * 46;
          const right = S.rel ? o.t === want : k === q.a && u > 24.4, gone = S.rel ? 0 : (k === 2 ? ramp(u, 14, 0.5) : k === 3 ? ramp(u, 29.4, 0.5) : 0);
          const kwOn = !S.rel && u > 6.4 && u < 11.4;
          if (right) panel(g, ox - 10, oy - 18, 240, 36, { fill: 'rgba(127,224,168,0.08)', stroke: COL.good, r: 9 });
          txt(g, `(${L4[k]})`, ox, oy, { size: 16, weight: 500, fam: FM, color: gone ? COL.dim : COL.muted });
          const ww = txt(g, o.t, ox + 42, oy, { size: 19, weight: 700, color: right ? COL.good : gone ? COL.dim : kwOn ? COL.ante : COL.text });
          if (gone) { g.strokeStyle = COL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 4, oy + 1); g.lineTo(ox - 4 + (ww + 50) * gone, oy + 1); g.stroke(); }
          if (right) mark(g, true, ox + 200, oy, 15);
          say(ox + 38, oy - 16, ww + 8, 32, o.t);
        });
      });
      fade(g, ramp(u, 6.8, 0.5) * (1 - ramp(u, 11.2, 0.4)), () => tag(g, '보기 = 방 이름 → 대화에서는 다른 말이 들려요', LX, 540, COL.ante));
      fade(g, ramp(u, 23.4, 0.5) * (S.rel ? 0 : 1), () => tag(g, '들은 말 + 그림 → Room 2', LX, 540, COL.rel));
      if (S.rel) fade(g, 1, () => tag(g, user ? `${S.rel.of} → ${LT.RELN[S.rel.rel]} → ${user}` : `${S.rel.of} → ${LT.RELN[S.rel.rel]} → 하나로 정할 수 없어요`, LX, 540, user ? COL.rel : COL.trap));
    },

    /* 07 세 사람: 이름을 부르는 말 → 다음 화자 = Raj → 남은 남자 = Kenji → Kenji의 제안 */
    three(g, u) {
      const St = SET('team'), q = St.qs[1];
      const marks = {}, add = (i, t, role) => (marks[i] = marks[i] || []).push({ t, role });
      if (u > 6.6) add(3, 'Raj,', 'name');
      if (u > 19) add(2, 'I can record it', 'ans');
      if (u > 22) add(3, 'editing the video', 'trap');
      const C = chatLay(g, St, { x: LX, y: 150, w: 680, size: 17, marks, gap: 18 });
      const nm = { M1: u > 9 ? 'Raj' : null, M2: u > 12.8 ? 'Kenji' : null };
      drawChat(g, C, u, talkSt(u, { 0: [0.4, 0.8], 1: [1.3, 0.6], 2: [2.0, 0.7], 3: [2.8, 0.7], 4: [3.6, 0.7], 5: [4.4, 0.6] }, i => {
        const key = St.lines[i].s;
        return { name: nm[key], nameA: key === 'M1' ? ramp(u, 9, 0.5) : ramp(u, 12.8, 0.5), hl: (i === 3 || i === 4) && u > 6.6 && u < 12 ? 'cur' : i === 2 && u > 19 ? 'ev' : null };
      }));
      const r3 = C.rows[3], r4 = C.rows[4];
      if (r3 && r4) fade(g, ramp(u, 7.4, 0.5) * (1 - ramp(u, 12, 0.4)), () => curve(g, r3.x + 4, r3.y + 24, r3.x - 34, (r3.y + r4.y) / 2 + 20, r4.x + 2, r4.y + 18, COL.ante, ramp(u, 7.4, 0.8)));
      // 오른쪽: 이름표
      fade(g, ramp(u, 6.2, 0.5), () => {
        panel(g, 800, 144, 400, 100, { fill: COL.panel2, stroke: COL.faint, r: 12 });
        [['M1', 'Raj', 9, 'Raj, could you …? → 다음 화자'], ['M2', 'Kenji', 12.8, '남은 남자 한 사람']].forEach(([k, n, at, why], i) => {
          const y = 174 + i * 42, c = spkColor(St, k);
          g.beginPath(); g.arc(828, y, 15, 0, Math.PI * 2); g.fillStyle = c; g.fill();
          txt(g, k, 828, y + 1, { size: 12, weight: 700, color: COL.bg, align: 'center' });
          txt(g, '=', 858, y, { size: 18, weight: 700, color: COL.muted });
          txt(g, u > at ? n : '?', 880, y, { size: 19, weight: 800, color: u > at ? COL.ante : COL.dim });
          fade(g, ramp(u, at, 0.5), () => txt(g, why, 1184, y, { size: 13.5, weight: 600, color: COL.muted, align: 'right' }));
        });
      });
      fade(g, ramp(u, 18, 0.5), () => qPanel(g, St, 1, { x: 800, y: 270, w: 400, kw: true, sz: 19, osz: 16, kinds: true, gap: 2,
        st: k => ({ win: k === q.a && u > 20.6, kind: (k === q.a && u > 21) || (k === 0 && u > 22.6) ? 1 : 0, gone: k === 0 ? ramp(u, 22.4, 0.5) : 0,
          marks: k === q.a && u > 20.2 ? [{ t: 'Record some audio', role: 'ans' }] : [] }) }));
    },

    /* 08 담화에는 순서가 있다: 음성 메시지(줄마다 흐름 칩) → 다섯 갈래의 흐름 → 세 문제의 자리 */
    talk(g, u) {
      const St = SET('dental'), outA = S.talk ? 0 : 1 - ramp(u, 12.2, 0.5);
      fade(g, ramp(u, 0.4, 0.5) * outA, () => {
        const C = chatLay(g, St, { x: LX, y: 160, w: 720, size: 20, gap: 16 });
        drawChat(g, C, u, talkSt(u, { 0: [0.6, 1.0], 1: [1.8, 0.8], 2: [2.8, 1.2], 3: [4.2, 1.0], 4: [5.4, 0.8] }));
        St.lines.forEach((l, i) => { const r = C.rows[i]; fade(g, ramp(u, 6.4 + i * 1.1, 0.5), () => tag(g, `${i + 1} · ${LT.VSEG[l.seg]}`, 820, r.y + 18, i === 3 ? COL.verb : COL.ante, { size: 15, h: 32 })); });
      });
      const inB = S.talk ? 1 : ramp(u, 12.6, 0.6);
      fade(g, inB, () => {
        LT.TALKS.forEach((tk, k) => {
          const y = 172 + k * 70, at = S.talk ? -10 : [12.6, 13.4, 18.8, 21.4, 23.2][k], on = S.talk === tk.k, dim = S.talk && !on;
          fade(g, ramp(u, at, 0.5) * (dim ? 0.35 : 1), () => {
            if (on) panel(g, LX - 12, y - 30, 1144, 60, { fill: 'rgba(255,193,94,0.08)', stroke: COL.rel, r: 12 });
            txt(g, tk.name, LX, y - 7, { size: 20, weight: 800, color: on ? COL.rel : COL.soft });
            txt(g, tk.en, LX, y + 17, { size: 13, weight: 500, fam: FM, color: COL.muted });
            let x = LX + 190;
            tk.steps.forEach((s, i) => {
              const c = chip(g, s, x, y, { size: 17, weight: 700, color: i === tk.steps.length - 1 ? COL.verb : COL.en, fill: COL.panel2, stroke: COL.faint, h: 40, r: 10, pad: 14 });
              if (i < tk.steps.length - 1) arrow(g, c.x + c.w + 6, y, c.x + c.w + 30, y, COL.muted, 2);
              x = c.x + c.w + 38;
            });
          });
        });
        if (S.talk) { const tk = LT.TALKS.find(t => t.k === S.talk); txt(g, tk.ex, LX, 548, { size: 17, weight: 600, color: COL.en }); }
      });
      if (!S.talk) {
        const qs = [['Who is the speaker?', '처음'], ['Why is the speaker calling?', '앞부분'], ['What is the listener asked to do?', '끝부분']];
        let x = LX;
        qs.forEach(([a, b], k) => fade(g, ramp(u, 24.8 + k * 0.9, 0.5), () => {
          const c = chip(g, `${a} → ${b}`, x, 548, { size: 15, weight: 700, color: COL.ante, fill: COL.panel2, stroke: COL.ante, h: 36, r: 10, pad: 12 });
          x = c.x + c.w + 14;
        }));
      }
    },

    /* 09 3단계 풀이법 흐름도 (함정 갈래를 고르면 그 함정이 지워지는 단계에 불이 켜짐) */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 미리 읽기', sub: '듣기 전에', at: 5.4, boxes: [['키워드 표시', 'the man · the woman · 이름', COL.ante], ['묻는 것과 자리', '주제 → 처음 · 다음 할 일 → 끝', COL.ante], ['여기서 지우는 보기', '다른 사람의 말 · 때가 다른 일', COL.trap]] },
        { x: 480, head: '② 신호 듣기', sub: '들으면서', at: 11.4, boxes: [['문제점 · 요청', 'but · unfortunately · Could you', COL.verb], ['다음 할 일 · 의도', "I'll · Let me · 앞뒤 줄", COL.verb], ['여기서 지우는 보기', '나오지 않은 내용 · 대화와 반대', COL.trap]] },
        { x: 880, head: '③ 바꿔 말하기', sub: '고르면서', at: 17.4, boxes: [['같은 뜻 다른 말', 'fully booked = no rooms', COL.rel], ['그림과 합치기', '들은 말 + 표 · 지도', COL.rel], ['여기서 지우는 보기', '그대로 들린 낱말 · 안 맞는 칸', COL.trap]] },
      ];
      const P = S.trap ? LT.REL[S.trap] : null;
      cols.forEach((c, ci) => {
        fade(g, ramp(u, c.at, 0.6), () => {
          panel(g, c.x, 150, 340, 58, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 20, 179, { size: 22, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 320, 179, { size: 15, weight: 600, color: COL.muted, align: 'right' });
          c.boxes.forEach(([k, v, col], bi) => {
            const y = 222 + bi * 84, lit = P && P.step === ci + 1 && bi === 2;
            fade(g, ramp(u, c.at + 0.5 + bi * 0.55, 0.5) * (P && !lit ? 0.4 : 1), () => {
              panel(g, c.x, y, 340, 70, { fill: lit ? 'rgba(255,159,122,0.14)' : COL.panel, stroke: lit ? COL.trap : COL.faint, lw: lit ? 2.5 : 1.5 });
              txt(g, k, c.x + 16, y + 23, { size: 15, weight: 700, color: COL.soft });
              let sz = 16; while (tw(g, v, sz, 700) > 310 && sz > 12) sz -= 0.5;
              txt(g, v, c.x + 16, y + 49, { size: sz, weight: 700, color: col });
            });
          });
          if (ci < 2) fade(g, ramp(u, cols[ci + 1].at - 0.3, 0.5), () => arrow(g, c.x + 348, 179, c.x + 392, 179, COL.accent, 3));
        });
      });
      if (S.trap) {
        const ex = LT.TRAPEX[S.trap], j = LT.judge(SET(ex[0]), ex[1], ex[2]);
        const s = `${LT.kindName(S.trap)} → ${LT.STEPN[j.step]}에서 탈락 · 예: (${L4[ex[2]]}) ${SET(ex[0]).qs[ex[1]].opts[ex[2]].t}`;
        let size = 17; while (tw(g, s, size, 700) > 1100 && size > 12) size -= 0.5;
        chip(g, s, W / 2, 500, { size, weight: 700, color: COL.trap, fill: COL.panel2, stroke: COL.trap, align: 'center', h: 42, r: 10 });
      } else fade(g, ramp(u, 22.6, 0.5), () => chip(g, '정답 = 세 단계를 모두 지나 남은 하나', W / 2, 500, { size: 18, weight: 700, color: COL.good, fill: COL.panel2, stroke: COL.good, align: 'center', h: 42, r: 10 }));
    },

    /* 10 실전 문제: help 세트 세 문제. ① 키워드 → ② 근거 줄 → ③ 바꿔 말하기, 단계마다 보기 하나씩 지움 */
    practice(g, u) {
      const St = SET('help'), SEG = [0, 18.2, 36.2, 54];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi], P = PRACTICE[pi], q = St.qs[pi];
      const a = ramp(v, 0, 0.5) * (pi < 2 ? 1 - ramp(u, SEG[pi + 1] - 0.4, 0.4) : 1);
      // 대본은 장면 내내 보임 (근거 줄과 함정 낱말은 단계에 맞춰 칠함)
      const marks = {}, add = (i, t, role) => (marks[i] = marks[i] || []).push({ t, role });
      const s2 = v >= P.at[1] + 0.4, s3 = v >= P.at[2] + 0.4;
      if (s2 && q.sig) add(q.ev, q.sig, 'cue');
      if (s3) { (q.opts[q.a].x.pp || []).forEach(([h, , li]) => add(li == null ? q.ev : li, h, 'ans')); q.opts.forEach(o => { if (o.rel === 'repeat') add(o.x.ln, o.x.w, 'trap'); }); }
      const one = q.opts.find(o => LT.REL[o.rel].step === 1);
      const C = chatLay(g, St, { x: LX, y: 150, w: 600, size: 15.5, marks, gap: 9 });
      drawChat(g, C, u, i => ({ a: ramp(u, 0.2 + i * 0.12, 0.4), hl: s2 && i === q.ev ? 'ev' : (v >= P.at[0] + 1 && one && i === one.x.ln && !s2) ? 'cur' : null, dimText: s2 && i !== q.ev }));
      fade(g, a, () => {
        txt(g, `문제 ${pi + 1} / 3`, 712, 154, { size: 15, weight: 500, fam: FM, color: COL.accent });
        const Pn = qPanel(g, St, pi, { x: 712, y: 182, w: 490, kw: v >= P.at[0] + 0.4, sz: 19, osz: 17, kinds: true, gap: 4,
          st: k => {
            const j = LT.judge(St, pi, k), at = j.step ? P.x[j.step - 1] : 1e9, right = k === q.a;
            return { gone: !right && v >= at ? clamp((v - at) / 0.4) : 0, win: right && v >= P.win, kind: v >= (j.step ? at : P.win) ? 1 : 0,
              marks: right && v >= P.at[2] + 0.6 ? (q.opts[k].x.pp || []).map(p => ({ t: p[1], role: 'ans' })) : q.opts[k].rel === 'repeat' && v >= P.at[2] + 0.6 ? [{ t: q.opts[k].x.w, role: 'trap' }] : [] };
          } });
        const py = Math.max(Pn.bottom + 4, 470);
        panel(g, 700, py, 510, 574 - py, { fill: COL.panel, stroke: COL.faint, r: 12 });
        P.lines.forEach((ln, k) => fade(g, ramp(v, P.at[k] + 0.3, 0.5), () => {
          const y = py + 21 + k * ((574 - py - 12) / 3);
          txt(g, LT.STEPN[k + 1], 718, y, { size: 15, weight: 700, color: COL.accent });
          let sz = 15; while (tw(g, ln, sz, 600) > 360 && sz > 11.5) sz -= 0.5;
          txt(g, ln, 838, y, { size: sz, weight: 600, color: k === 2 && v >= P.win ? COL.good : COL.soft });
        }));
      });
    },

    /* 11 정리 표 */
    summary(g, u) {
      const X = [80, 290, 500, 820], Y0 = 146, RH = 44;
      const rows = [
        ['주제 · 목적', '첫 부분', "I'm calling about · I need", 'reserve rooms = book accommodations'],
        ['장소 · 직업', '대화 전체', '단서 낱말 여럿', 'posters · printed · sample → print shop'],
        ['문제점', '가운데', "but · unfortunately · I'm afraid", 'fully booked = no rooms available'],
        ['요청 · 제안', '가운데 · 끝', "Could you · Why don't you", 'call us back = return a call'],
        ['다음에 할 일', '끝부분', "I'll · Let me · I'm going to", 'phone number = contact information'],
        ['화자 의도', '따옴표 앞뒤', '앞 줄 + 뒤 줄', 'jammed again → keeps breaking down'],
        ['시각 정보', '그림 + 대화', '그림에 없는 쪽의 말', 'across from the elevator → Room 2'],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 8, 1160, RH * (rows.length + 1) + 10, { fill: COL.panel, stroke: COL.faint });
        ['묻는 것', '답의 자리', '신호', '바꿔 말하기 예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 18, { size: 16, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + RH - 4, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.5, 0.6), () => {
        const y = Y0 + RH * (ri + 1) + 18;
        txt(g, r[0], X[0] + 20, y, { size: 17, weight: 700 });
        txt(g, r[1], X[1] + 20, y, { size: 16, weight: 600, color: COL.soft });
        let sz = 16; while (tw(g, r[2], sz, 600) > 300 && sz > 12) sz -= 0.5;
        txt(g, r[2], X[2] + 20, y, { size: sz, weight: 600, color: COL.verb });
        sz = 16; while (tw(g, r[3], sz, 600) > 370 && sz > 12) sz -= 0.5;
        txt(g, r[3], X[3] + 20, y, { size: sz, weight: 600, color: COL.rel });
      }));
      const steps = ['① 미리 읽기', '② 신호 듣기', '③ 바꿔 말하기'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 6.5 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 540, { size: 19, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 44, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 540, c.x + c.w + 46, 540, COL.accent, 2.5);
        x = c.x + c.w + 58;
      }));
      fade(g, ramp(u, 8.4, 0.5), () => tag(g, '그대로 들린 낱말은 의심!', W - 80, 540, COL.trap, { align: 'right', size: 17, h: 40 }));
    },
  };

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

  LTS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[LTS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, LTS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + LT.allText() +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔✓×?~=+-/:…‘’“”\'';
  LTS.baseText = EXTRA;
  LTS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = LTS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { LTS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
