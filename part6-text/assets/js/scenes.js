/* Part 6 글 단위 문제 튜토리얼 — 영상 장면
 *
 * PV.render(g, t)는 시각 t와 사용자 상태 PV.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(../tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 *
 * 무대의 주인공은 짧은 글(공지 · 이메일)이에요. 글은 낱말 조각으로 배치하고(layP), 문장마다 보이는 정도(vis)를 줘서
 * 가려진 문장은 회색 막대로, 켠 문장은 글자로 그립니다(문맥 손전등).
 * 역할 색: 빈칸 문장 하늘 · 빈칸 분홍 점선 · 답 노랑 · 단서 보라 · 두 문장의 관계 민트 · 함정 주황.
 * 맞고 틀림은 모두 grammar.js의 규칙 엔진(PT.judge)으로 정합니다.
 */
(function () {
  'use strict';
  const PT = window.PT;
  const PV = (window.PV = {});
  const W = 1280, H = 720;
  PV.W = W; PV.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  PV.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.26)', panel: '#18202A', panel2: '#202A36', paper: '#1A222D',
    ans: '#FFC15E', gap: '#FF7AA8', trap: '#FF9F7A', bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF',
    // 역할 색 (페이지 CSS의 --c-focus 등과 같은 뜻): 빈칸 문장 하늘 · 단서 보라 · 두 문장의 관계 민트
    focus: '#6EC8FF', cue: '#C9A7FF', rel: '#7FE0A8', bar: 'rgba(238,241,244,0.12)',
  };
  PV.COL = COL;
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (PV.S = { pick: null, ctx: null, kind: null, date: null, rel: null, ptr: null, trap: null, reveal: null, mtype: null });
  PV.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  PV.hits = () => HITS;

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
      if (p > 0.97) { const [ax, ay] = pt(N), [bx, by] = pt(N - 2); arrowHead(g, ax, ay, Math.atan2(ay - by, ax - bx), color, 12); }
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
  function panel(g, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, o.r || 14); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 1.5; if (o.dash) g.setLineDash(o.dash); g.stroke(); g.setLineDash([]); }
  }
  const say = (x, y, w, h, text) => HITS.push({ x, y, w, h, say: text });
  // 줄 바꿈 글 (한국어 설명 · 보기 문장). 돌려주는 값: 줄 수
  function wrapText(g, s, x, y, maxW, o = {}) {
    const size = o.size || 16, lh = o.lh || size * 1.45, words = String(s).split(' '), lines = [''];
    words.forEach(w => { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (tw(g, t, size, o.weight || 500) > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; });
    const ws = lines.map((l, i) => txt(g, l, x, y + i * lh, Object.assign({ size, weight: 500 }, o)));
    return { n: lines.length, ws };
  }
  // 손전등 아이콘 (문맥 손전등)
  function torch(g, x, y, s, a = 1, on = true) {
    fade(g, a, () => {
      if (on) {
        const gr = g.createLinearGradient(x + s * 0.6, y, x + s * 2.8, y);
        gr.addColorStop(0, 'rgba(255,193,94,0.38)'); gr.addColorStop(1, 'rgba(255,193,94,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x + s * 0.6, y - s * 0.24); g.lineTo(x + s * 2.8, y - s * 0.95); g.lineTo(x + s * 2.8, y + s * 0.95); g.lineTo(x + s * 0.6, y + s * 0.24); g.closePath(); g.fill();
      }
      rr(g, x - s * 0.75, y - s * 0.17, s * 0.98, s * 0.34, s * 0.09); g.fillStyle = COL.soft; g.fill();
      g.fillStyle = COL.accent; g.beginPath(); g.moveTo(x + s * 0.2, y - s * 0.2); g.lineTo(x + s * 0.62, y - s * 0.32); g.lineTo(x + s * 0.62, y + s * 0.32); g.lineTo(x + s * 0.2, y + s * 0.2); g.closePath(); g.fill();
      rr(g, x - s * 0.38, y - s * 0.26, s * 0.18, s * 0.1, 2); g.fillStyle = COL.dim; g.fill();
    });
  }

  /* ---------- 글 배치와 그리기 ----------
   * layP(g, 지문, o) — 문장을 낱말 조각으로 잘라 폭 o.w 안에서 줄을 바꿈
   *   o: { x, y, w, size, lh, from, to (문장 범위), br (문장마다 새 줄), head (머리말), fills: { 빈칸 번호: 글자 }, blankW }
   *   조각: { s 문장, t 글자, r: '' | 'blank' 빈칸 | 'fill' 채운 답 | 'slot' 문장 넣기 빈칸 | 'ins' 넣은 문장, n, punct, x, y, w }
   */
  const NORM = s => String(s).replace(/[‘’“”"(),.;:!?]/g, '').toLowerCase();
  function layP(g, P, o) {
    const size = o.size || 22, lh = o.lh || size * 1.6, sp = size * 0.28, maxW = o.w;
    const fills = o.fills || {}, from = o.from || 0, to = o.to == null ? P.sents.length - 1 : o.to;
    const head = [];
    let y = o.y;
    if (o.head && P.head.length) {
      const hs = o.headSize || Math.round(size * 0.68), hl = hs * 1.55;
      const lines = o.headLines || P.head;
      lines.forEach((h, i) => head.push({ s: -1, t: h, x: o.x, y: y + i * hl, w: tw(g, h, hs, 500, FM), size: hs, i }));
      y += lines.length * hl + size * 0.55;
    }
    const toks = []; let x = 0, line = 0;
    const put = tk => {
      if (x > 0 && x + sp + tk.w > maxW) { line++; x = 0; }
      if (x > 0) x += sp;
      tk.x = x; tk.line = line; x += tk.w; toks.push(tk);
    };
    for (let s = from; s <= to; s++) {
      const raw = P.sents[s];
      if (o.br && s > from) { line++; x = 0; }
      const ins = raw.match(/^\[(\d+)\]$/);
      if (ins) {
        const n = +ins[1], f = fills[n];
        if (f && o.plain && o.plain.includes(n)) f.split(' ').forEach(w => put({ s, t: w, r: '', w: tw(g, w, size, 500), was: n }));
        else if (f) f.split(' ').forEach(w => put({ s, t: w, r: 'ins', n, w: tw(g, w, size, 500) }));
        else put({ s, t: '', r: 'slot', n, w: o.slotW || size * 5.2 });
        continue;
      }
      raw.split(' ').forEach(w => {
        const m = w.match(/^\[(\d+)\]([.,;:]?)$/);
        if (m && fills[+m[1]] && o.plain && o.plain.includes(+m[1])) {      // 이미 푼 빈칸: 보통 글처럼
          (fills[+m[1]] + m[2]).split(' ').forEach(x => put({ s, t: x, r: '', w: tw(g, x, size, 500), was: +m[1] }));
          return;
        }
        if (m) {
          const n = +m[1], f = fills[n], pw = m[2] ? tw(g, m[2], size, 500) : 0;
          const bw = f ? tw(g, f, size, 700) + size * 0.5 : (o.blankW || size * 3.4);
          put({ s, t: f || '', r: f ? 'fill' : 'blank', n, punct: m[2], bw, w: bw + pw });
        } else put({ s, t: w, r: '', w: tw(g, w, size, 500) });
      });
    }
    toks.forEach(t => { t.x += o.x; t.y = y + t.line * lh; });
    const lines = line + 1;
    return { toks, head, x: o.x, y0: o.y, y, w: maxW, size, lh, lines, bottom: y + (lines - 1) * lh + size * 0.7, P, fills };
  }
  PV.layP = layP;
  // 문장 하나가 차지하는 줄별 상자
  function sentRects(L, s) {
    if (s === -1) return L.head.map(h => ({ x: h.x - 6, y: h.y - h.size * 0.8, w: h.w + 12, h: h.size * 1.6 }));
    const by = {};
    L.toks.filter(t => t.s === s).forEach(t => { const r = by[t.line] || (by[t.line] = { x: t.x, x1: t.x + t.w, y: t.y }); r.x = Math.min(r.x, t.x); r.x1 = Math.max(r.x1, t.x + t.w); });
    return Object.values(by).map(r => ({ x: r.x - 5, y: r.y - L.size * 0.78, w: r.x1 - r.x + 10, h: L.size * 1.56 }));
  }
  // 문장 s 안의 글자 묶음 text가 차지하는 상자들 (줄마다 하나). 머리말(s = -1)도 됨
  function span(g, L, s, text) {
    if (s === -1) {
      for (const h of L.head) {
        const i = h.t.indexOf(text);
        if (i >= 0) { const x = h.x + tw(g, h.t.slice(0, i), h.size, 500, FM), w = tw(g, text, h.size, 500, FM); return [{ x: x - 3, y: h.y - h.size * 0.78, w: w + 6, h: h.size * 1.56 }]; }
      }
      return [];
    }
    const want = String(text).split(' ').map(NORM), ts = L.toks.filter(t => t.s === s);
    for (let i = 0; i + want.length <= ts.length; i++) {
      if (!want.every((w, k) => NORM(ts[i + k].t) === w)) continue;
      const seq = ts.slice(i, i + want.length), by = {};
      seq.forEach((t, k) => {
        let w = t.w;
        if (k === seq.length - 1) { const m = t.t.match(/[.,;:!?]+$/); if (m) w -= tw(g, m[0], L.size, 500); }
        const r = by[t.line] || (by[t.line] = { x: t.x, x1: t.x + w, y: t.y }); r.x = Math.min(r.x, t.x); r.x1 = Math.max(r.x1, t.x + w);
      });
      return Object.values(by).map(r => ({ x: r.x - 3, y: r.y - L.size * 0.72, w: r.x1 - r.x + 6, h: L.size * 1.44 }));
    }
    return [];
  }
  PV.span = span;
  const blankTok = (L, n) => L.toks.find(t => t.n === n && (t.r === 'blank' || t.r === 'fill' || t.r === 'slot')) || L.toks.find(t => t.n === n);
  // 상자 묶음의 가운데 · 위 · 아래
  const mid = rs => { if (!rs || !rs.length) return null; const r = rs[0], last = rs[rs.length - 1]; return { cx: rs.length > 1 ? r.x + r.w / 2 : r.x + r.w / 2, top: r.y, bot: last.y + last.h, cy: r.y + r.h / 2, x: r.x, w: r.w }; };
  /* 그리기. st: { vis(s) → 0~1, hl: { 문장: 색 }, marks: [{ s, t, color, a }], fillStyle(n) → 'ans' | 'soft' | 'good', glow, slotLabel }
   * 가려진 문장(vis < 1)은 낱말 자리만 회색 막대로 남음 */
  function drawP(g, L, st = {}) {
    const vis = st.vis || (() => 1), size = L.size;
    // 문장 바탕 (빈칸 문장 하늘 · 단서 문장 보라)
    Object.entries(st.hl || {}).forEach(([s, c]) => {
      const col = typeof c === 'string' ? c : c.color, a = typeof c === 'string' ? 1 : c.a;
      fade(g, a * clamp(vis(+s) * 1.4), () => sentRects(L, +s).forEach(r => { rr(g, r.x, r.y, r.w, r.h, 7); g.fillStyle = hexA(col, 0.13); g.fill(); g.fillStyle = col; g.fillRect(r.x, r.y + r.h - 2.5, r.w, 2.5); }));
    });
    // 머리말
    L.head.forEach(h => {
      const v = vis(-1);
      if (v < 1) fade(g, 1 - v, () => { rr(g, h.x, h.y - h.size * 0.3, h.w, h.size * 0.6, h.size * 0.3); g.fillStyle = COL.bar; g.fill(); });
      fade(g, v, () => txt(g, h.t, h.x, h.y, { size: h.size, weight: 500, fam: FM, color: h.i === 0 ? COL.soft : COL.muted }));
    });
    L.toks.forEach(t => {
      const v = vis(t.s), y = t.y;
      if (t.r === 'blank' || t.r === 'slot') {
        const bw = t.r === 'slot' ? t.w : t.bw, h = size * 1.14;
        rr(g, t.x, y - h / 2, bw, h, 8);
        g.fillStyle = `rgba(255,122,168,${0.08 + 0.14 * (st.glow || 0)})`; g.fill();
        g.setLineDash([6, 5]); g.strokeStyle = COL.gap; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]);
        txt(g, t.r === 'slot' ? `(${t.n}) ${st.slotLabel || '문장'}` : `(${t.n})`, t.x + bw / 2, y + 1, { size: size * 0.62, weight: 700, color: COL.gap, align: 'center' });
        if (t.punct) fade(g, Math.max(v, 0.25), () => txt(g, t.punct, t.x + bw, y, { size, weight: 500 }));
        return;
      }
      if (t.r === 'fill') {
        const style = st.fillStyle ? st.fillStyle(t.n) : 'ans';
        if (style === 'soft') fade(g, v, () => txt(g, t.t, t.x + size * 0.25, y, { size, weight: 600, color: COL.soft }));
        else {
          const c = style === 'good' ? COL.good : COL.ans, h = size * 1.2;
          rr(g, t.x, y - h / 2, t.bw, h, 8); g.fillStyle = hexA(c, 0.16); g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.stroke();
          txt(g, t.t, t.x + t.bw / 2, y + 1, { size, weight: 700, color: c, align: 'center' });
        }
        if (t.punct) fade(g, Math.max(v, 0.25), () => txt(g, t.punct, t.x + t.bw, y, { size, weight: 500 }));
        return;
      }
      if (v < 1) fade(g, 1 - v, () => { rr(g, t.x, y - size * 0.3, t.w, size * 0.6, size * 0.3); g.fillStyle = COL.bar; g.fill(); });
      if (t.r === 'ins') {
        const style = st.fillStyle ? st.fillStyle(t.n) : 'ans';
        fade(g, v, () => txt(g, t.t, t.x, y, { size, weight: style === 'soft' ? 500 : 600, color: style === 'soft' ? COL.soft : style === 'good' ? COL.good : COL.ans }));
      } else fade(g, v, () => txt(g, t.t, t.x, y, { size, weight: 500, color: st.textColor ? st.textColor(t.s) : COL.text }));
    });
    // 표시 (단서 보라 · 함정 주황 …): 옅은 칠 + 밑줄
    (st.marks || []).forEach(m => {
      const a = (m.a == null ? 1 : m.a) * clamp(vis(m.s) * 1.4);
      fade(g, a, () => span(g, L, m.s, m.t).forEach(r => {
        rr(g, r.x, r.y, r.w, r.h, 6); g.fillStyle = hexA(m.color, 0.16); g.fill();
        g.strokeStyle = m.color; g.lineWidth = 2; g.stroke();
      }));
    });
    // 발음 듣기: 켠 문장만 (빈칸은 채운 말로)
    if (st.say !== false) {
      const all = Object.assign({}, L.fills);
      const sents = new Set(L.toks.map(t => t.s));
      sents.forEach(s => {
        if (vis(s) < 0.6) return;
        const raw = L.P.sents[s], ins = raw.match(/^\[(\d+)\]$/);
        if (ins && !all[ins[1]]) return;
        const text = PT.sentText(L.P, s, all);
        sentRects(L, s).forEach(r => say(r.x, r.y, r.w, r.h, text));
      });
    }
  }
  PV.drawP = drawP;
  // 빈칸 → 단서 화살표 (단서가 위면 위로 휘고, 아래면 아래로). 돌려주는 값: 가운데 점
  function pointer(g, from, to, color, p, o = {}) {
    if (!from || !to || p <= 0.001) return null;
    const up = to.cy < from.cy - 4, down = to.cy > from.cy + 4;
    const x0 = from.cx, y0 = up ? from.top - 2 : down ? from.bot + 2 : from.top - 2;
    const x1 = to.cx, y1 = up ? to.bot + 2 : down ? to.top - 2 : to.top - 2;
    const cx = (x0 + x1) / 2 + (o.dx || 0), cy = up || down ? (y0 + y1) / 2 + (o.dy || 0) : Math.min(y0, y1) - (o.h || 46);
    const m = curve(g, x0, y0, cx, cy, x1, y1, color, p, o);
    if (o.label && p > 0.9) chip(g, o.label, m[0] + (o.lx || 0), m[1] + (o.ly || 0), { size: o.lsize || 14, weight: 700, color, fill: 'rgba(16,21,28,0.92)', stroke: color, align: 'center', h: (o.lsize || 14) * 1.9, pad: 9, lw: 1.3 });
    return m;
  }
  // 오른쪽 여백의 꺾쇠 화살표: 빈칸 줄 → 단서 줄 (글자를 가로지르지 않음). o: { i: 몇 번째 꺾쇠, label }
  function bracket(g, L, from, to, color, p, o = {}) {
    if (!from || !to || p <= 0.001) return;
    const x = L.x + L.w + 14 + (o.i || 0) * 11, y0 = from.cy, y1 = to.cy;
    g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.arc(x - 9, y0, 3.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x - 9, y0); g.lineTo(x, y0); g.lineTo(x, lerp(y0, y1, clamp(p))); g.stroke();
    if (p > 0.95) { g.beginPath(); g.moveTo(x, y1); g.lineTo(x - 8, y1); g.stroke(); arrowHead(g, x - 13, y1, Math.PI, color, 9); }
    g.restore();
    if (o.label && p > 0.95) chip(g, o.label, x + 7, y1, { size: o.lsize || 13, weight: 700, color, fill: 'rgba(16,21,28,0.92)', stroke: color, h: (o.lsize || 13) * 1.85, pad: 7, lw: 1.2 });
  }
  // 빈칸 조각의 상자
  function blankRect(L, n) {
    const t = blankTok(L, n);
    if (!t) return null;
    if (t.r === 'ins') { const rs = L.toks.filter(k => k.n === n && k.r === 'ins'); const r = rs.map(k => ({ x: k.x, y: k.y - L.size * 0.7, w: k.w, h: L.size * 1.4 })); return mid(r); }
    const w = t.r === 'slot' ? t.w : t.bw, h = L.size * 1.14;
    return mid([{ x: t.x, y: t.y - h / 2, w, h }]);
  }
  PV.blankRect = blankRect;

  // 보기 목록 (오른쪽 칸). st(k) → { st: 'open' | 'no' | 'win' | 'ok1', p: 지우는 정도, tag }
  function optRows(g, b, x, y, o) {
    const size = o.size || 22, gap = o.gap || size * 2.25, wmax = o.w || 380, ins = b.type === 'insert';
    let yy = y;
    const rows = [];
    b.opts.forEach((_, k) => {
      const s = PT.optText(b, k), ss = o.state(k), no = ss.st === 'no', win = ss.st === 'win';
      const color = win ? COL.good : no ? COL.dim : COL.text;
      txt(g, `(${'ABCD'[k]})`, x, yy, { size: size * 0.82, weight: 500, fam: FM, color: no ? COL.dim : COL.muted });
      const tx = x + size * 2.1;
      let w, nl = 1, ws;
      if (ins) {
        const r = wrapText(g, s, tx, yy, wmax - size * 2.1, { size, weight: win ? 700 : 500, color, lh: size * 1.3 });
        nl = r.n; ws = r.ws; w = Math.max(...ws);
        say(tx - 4, yy - size * 0.75, w + 8, nl * size * 1.3 + size * 0.2, s);
      } else { w = txt(g, s, tx, yy, { size, weight: win ? 700 : 600, color }); ws = [w]; }
      if (no && ss.p > 0) { g.strokeStyle = COL.bad; g.lineWidth = 2.4; ws.forEach((lw, i) => { const ly = yy + i * size * 1.3 + 1; g.beginPath(); g.moveTo(tx - 4, ly); g.lineTo(tx - 4 + (lw + 8) * ss.p, ly); g.stroke(); }); }
      if (win) { rr(g, x - 12, yy - size * 0.95, (ins ? wmax : tx - x + w + 30) + 12, size * (ins ? nl * 1.3 + 0.6 : 1.9), 10); g.strokeStyle = COL.good; g.lineWidth = 2; g.stroke(); }
      if (ss.tag) {
        const tx2 = tx + w + 12, ty = yy;
        if (!ins) chip(g, ss.tag, tx2, ty, { size: 13, weight: 700, color: no ? COL.trap : win ? COL.good : COL.soft, fill: 'rgba(16,21,28,0.9)', stroke: no ? COL.trap : win ? COL.good : COL.faint, h: 24, pad: 8, lw: 1.2 });
      }
      if (ss.st === 'ok1') check(g, x - 22, yy, 13, COL.soft);
      rows.push({ k, y: yy, nl });
      yy += ins ? Math.max(gap, nl * size * 1.3 + size * 0.95) : gap;
    });
    return rows;
  }
  // 엔진 판정으로 짧은 이름표
  const TAG = { form: '시제 없음', num: '수', voice: '태', time: '시간', near: '시간', kind: '', rel: '', also: 'also', order: '순서', same: '같은 낱말', clash: '어긋남', topic: '주제', ptr: '짝 없음', next: '뒤 끊김' };
  function tagOf(b, k, vis) {
    const j = PT.judge(b, k, vis);
    if (j.s !== 'no') return '';
    if (j.trap === 'kind') return PT.KIND[PT.link(PT.optText(b, k)).k];
    if (j.trap === 'rel') return PT.REL[PT.link(PT.optText(b, k)).r].name;
    if (j.trap === 'time' || j.trap === 'near') return PT.TSHORT[PT.verbForm(PT.optText(b, k)).t];
    return TAG[j.trap] || '';
  }
  PV.tagOf = tagOf;
  // 남은 보기 수 표시
  function counter(g, n, x, y, o = {}) {
    const c = n === 1 ? COL.good : COL.accent;
    panel(g, x, y - 30, o.w || 200, 60, { fill: COL.panel2, stroke: c, r: 12 });
    txt(g, '남은 보기', x + 18, y, { size: 17, weight: 700, color: COL.soft });
    txt(g, String(n), x + (o.w || 200) - 24, y + 1, { size: 32, weight: 800, fam: FD, color: c, align: 'right' });
  }

  /* ---------- 장면 정의: 장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '빈칸은 글 속에 있다', d: 24, caps: [
      [0.4, 5, '토익 **Part 6**은 글 속의 빈칸을 채우는 문제예요. 공지, 이메일 같은 짧은 글이 나와요.'],
      [5, 10.5, '먼저 빈칸이 있는 문장만 읽어 볼게요. 보기 넷 가운데 셋이 문법으로는 다 맞아요.'],
      [10.5, 15.5, '이제 앞 문장을 켜요. will begin on Monday, May 12 → 공사는 앞으로 있을 일이에요.'],
      [15.5, 19.5, '그래서 답은 will be closed 하나. 단서는 빈칸 밖, **앞뒤 문장**에 있었어요.'],
      [19.5, 24, 'Part 6의 빈칸 세 가지, 단서 찾는 법, **3단계 풀이법**을 차례로 배워요.'],
    ] },
    { id: 'format', n: '01', title: 'Part 6은 이런 문제', sub: '글 하나에 빈칸 넷', d: 30, caps: [
      [0.4, 6, '먼저 **Part 5**와 견줘 볼게요. Part 5는 문장 하나에 빈칸 하나예요.'],
      [6, 12, 'Part 6은 글 하나에 빈칸이 넷이에요. 글이 넷 나오니까 모두 16문제예요.'],
      [12, 18, '글은 공지, 이메일, 회람, 광고, 기사처럼 회사에서 주고받는 짧은 글이에요.'],
      [18, 24, '빈칸은 세 가지예요. 낱말 빈칸, 연결어 빈칸, 그리고 문장 하나를 통째로 고르는 **문장 넣기** 빈칸.'],
      [24, 30, '이 영상은 그 가운데 **글을 읽어야** 풀리는 시제, 연결어, 문장 넣기를 다뤄요.'],
    ] },
    { id: 'core', n: '02', title: '문장 하나로는 여러 개', sub: '앞뒤 문장이 하나로 줄인다', d: 32, caps: [
      [0.4, 6, '이 영상의 핵심이에요. 빈칸 문장 하나만 보면 답이 여러 개일 때가 많아요.'],
      [6, 12, 'being closed → 시제가 없어서 동사 자리에 못 와요. 남은 셋은 문법으로는 다 맞아요.'],
      [12, 18, '앞 문장을 켜요. will begin on Monday, May 12 → 공사는 앞으로. 그래서 will be closed.'],
      [18, 25, '앞 문장만 바꿔 볼게요. ended last Friday → 공사는 이미 끝났어요. 이제 답은 was closed.'],
      [25, 32, '빈칸 문장은 그대로인데 답이 바뀌었어요. **문장 하나로는 여러 개, 앞뒤 문장이 하나로 줄여요.**'],
    ] },
    { id: 'tense', n: '03', title: '시제는 글이 정한다', sub: '글을 쓴 날과 시간선', d: 40, caps: [
      [0.4, 6, '시제부터 볼게요. 한국어 공지는 ‘5월 12일부터 로비를 닫습니다’처럼 현재형으로 앞일을 말하곤 해요.'],
      [6, 12, '영어 공지에서 앞으로 있을 일 → 보통 will. 그래서 그 일이 언제인지 알아야 해요.'],
      [12, 18.5, '시간선을 그려요. 가운데는 **글을 쓴 날**이에요. 공지 맨 위의 날짜 → Posted: May 2. 바로 그날이에요.'],
      [18.5, 24.5, '공사는 5월 12일부터. 글을 쓴 날보다 뒤니까 앞으로 있을 일 → will be closed.'],
      [24.5, 30.5, '같은 글을 5월 20일에 썼다면? 공사는 이미 지난 일 → was closed. 날짜 하나가 시제를 정해요.'],
      [30.5, 35.5, '시간 단서는 머리말의 날짜, 앞뒤 문장의 next week, last Friday, 그리고 다른 동사의 시제예요.'],
      [35.5, 40, 'Thank you for attending → 이미 끝난 일. Please sign up by → 앞으로 할 일. 글의 목적도 단서예요.'],
    ] },
    { id: 'link', n: '04', title: '연결어는 두 문장의 관계', sub: '반대 · 더하기 · 결과 · 예', d: 40, caps: [
      [0.4, 6, '이번에는 연결어 빈칸이에요. 빈칸 앞이 마침표, 뒤가 쉼표면 **접속부사** 자리예요.'],
      [6, 12, '그래서 Although 같은 접속사, Despite 같은 전치사는 첫 단계에서 지워요. 그래도 접속부사가 여럿 남아요.'],
      [12, 18, '이때는 두 문장의 **관계**를 봐요. 반대면 However, 더하기면 In addition, 결과면 As a result.'],
      [18, 23.5, '예를 들면 For example, 앞에서 안 된다고 한 것 대신이면 Instead, ~하지 않으면 Otherwise.'],
      [23.5, 29.5, 'Our old printers often broke down. 다음 문장이 we replaced all of them → 원인과 결과, As a result.'],
      [29.5, 35, '다음 문장을 바꿔요 → they were cheap to repair. 고장은 잦은데 수리비는 쌌어요 → 반대, However.'],
      [35, 40, '헷갈리면 두 문장 사이에 한국어 연결어를 넣어 읽어 보세요. 그래서? 그러나? 게다가?'],
    ] },
    { id: 'pointer', n: '05', title: '문장 넣기 ① 가리키는 말', sub: 'this · these · it · also', d: 36, caps: [
      [0.4, 6, '이제 **문장 넣기**예요. 보기 넷이 모두 문장이고, 하나하나는 문법으로 다 맞아요.'],
      [6, 12.5, '한국어 공지는 ‘옆문을 이용해 주세요. 경비원이 신분증을 확인합니다.’처럼 가리키는 말을 자주 빼요.'],
      [12.5, 18.5, '영어는 앞에 나온 것을 다시 가리켜요 → this door, it, they. 이 **가리키는 말**이 열쇠예요.'],
      [18.5, 24.5, 'this, these, it, they, such, 그리고 also, another 같은 말이 보이면 앞 문장에서 짝을 찾아요.'],
      [24.5, 30.5, '보기의 this door → 앞 문장의 the side door. 넣을 문장이 앞과 이어져요.'],
      [30.5, 36, '뒤 문장의 your card → 넣은 문장의 ID cards. 뒤와도 이어지니까 이 문장이 답이에요.'],
    ] },
    { id: 'trap', n: '06', title: '문장 넣기 ② 함정 피하기', sub: '순서 · 같은 낱말 · also', d: 34, caps: [
      [0.4, 6, '문장 넣기의 오답은 그럴듯해 보여요. 자주 나오는 **함정** 셋을 볼게요.'],
      [6, 12.5, 'These cards can be picked up → 카드 이야기가 아직 안 나왔어요. 뒤에 와야 할 문장, **순서** 함정이에요.'],
      [12.5, 18.5, 'Parking on Pine Street → 글에 나온 낱말이 또 보여요. 하지만 주제가 주차라 흐름이 끊겨요.'],
      [18.5, 24.5, 'The new lobby will also have a café → also 앞에는 비슷한 것이 먼저 나와야 해요. 여기엔 없어요.'],
      [24.5, 29.5, '앞 내용과 어긋나는 문장도 함정이에요. 같은 낱말이 보인다고 답이 아니에요.'],
      [29.5, 34, '정답은 가리키는 말이 짝을 찾고, **앞과 뒤를 모두** 이어 주는 문장이에요.'],
    ] },
    { id: 'far', n: '07', title: '단서는 어디에나', sub: '뒤 문장 · 머리말 · 가까운 과거형', d: 30, caps: [
      [0.4, 6, '단서가 늘 빈칸 바로 앞에 있지는 않아요. 뒤 문장, 머리말, 멀리 있는 문장에도 있어요.'],
      [6, 12, '이 빈칸을 볼까요? The lobby ___ until Wednesday, May 21. 문장만으로는 셋이 남아요.'],
      [12, 18, '바로 앞의 was originally expected → 과거형이지만 ‘원래 예상’일 뿐이에요. **가까운 과거형** 함정이에요.'],
      [18, 24, '뒤 문장 if this date changes → 날짜가 아직 바뀔 수 있어요. 그러니 앞으로 있을 일, will not reopen.'],
      [24, 30, '맨 앞 문장의 will begin, 머리말의 날짜 Posted: May 2 → 모두 같은 답을 가리켜요. 단서가 여럿이면 더 확실해요.'],
    ] },
    { id: 'method', n: '08', title: '3단계 풀이법', sub: '문장 → 앞뒤 → 글', d: 28, caps: [
      [0.4, 5.5, '지금까지 배운 것을 **3단계 풀이법**으로 묶어 볼게요.'],
      [5.5, 11.5, '① **빈칸 문장**만 봐요. 동사 자리, 접속부사 자리 같은 Part 5 규칙으로 지울 수 있는 보기만 지워요.'],
      [11.5, 17.5, '② **앞뒤 문장**에서 단서를 찾아요. 날짜와 시간 표현, 두 문장의 관계, 가리키는 말의 짝이에요.'],
      [17.5, 23, '③ **글 전체**로 확인해요. 글을 쓴 날, 글의 목적, 흐름에 남은 답이 맞는지 봐요.'],
      [23, 28, '문장 하나로는 여러 개, 앞뒤가 하나로, 글이 확인. 이 순서로 실전 문제를 풀어 볼까요?'],
    ] },
    { id: 'practice', n: '09', title: '실전 문제 풀이', sub: '이메일 하나, 빈칸 셋', d: 60, caps: [
      [0.4, 6.5, '실전 문제예요. 회의실 예약 이메일이에요. 1번 → ① 문장만 보면 providing → 시제가 없어 지워요.'],
      [6.5, 13, '② 앞 문장의 next Friday → 행사는 앞으로. 지울 보기 → was provided, has been provided.'],
      [13, 19.5, '③ 뒤 문장의 will not be able → 이것도 미래예요. 정답은 (B) will be provided.'],
      [20.4, 26.5, '2번은 문장 넣기. ① 네 문장 모두 문법은 맞아요. 가리키는 말을 찾아 둬요: These guests, also, this number.'],
      [26.5, 33, '② 뒤 문장의 After that date → 날짜가 먼저 나와야 해요. 날짜를 내놓는 보기는 (C) 하나뿐이에요.'],
      [33, 39.5, '앞 문장의 the final number of guests → this number. 앞뒤가 모두 이어지니 정답은 (C).'],
      [40.4, 46.5, '3번은 연결어. ① 빈칸 앞 마침표, 뒤 쉼표 → 접속부사 자리. 전치사 Despite → 지워요.'],
      [46.5, 53, '② 프로젝터와 마이크가 있어요. 노트북도 빌릴 수 있어요. 좋은 점에 좋은 점을 더해요.'],
      [53, 60, '③ 더하기 → In addition. 정답은 (A). 세 문제 모두 답은 빈칸 밖에 있었어요.'],
    ] },
    { id: 'summary', n: '10', title: '정리', sub: '한눈에 보는 Part 6', d: 22, caps: [
      [0.4, 6, '정리해요. Part 6은 빈칸 문장 하나로는 답이 여러 개일 때가 많아요.'],
      [6, 12, '시제는 날짜와 다른 동사로, 연결어는 두 문장의 관계로, 문장 넣기는 가리키는 말의 짝으로 정해요.'],
      [12, 17, '빈칸 문장 → 앞뒤 문장 → 글 전체. 세 단계로 보기를 하나씩 줄여요.'],
      [17, 22, '아래 문맥 손전등과 연습 문제로 손에 익혀 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  PV.CHAPTERS = CHAPTERS; PV.CAPTIONS = CAPTIONS; PV.END = END;
  PV.POSTER = CHAPTERS.find(c => c.id === 'far').t + 27.8;
  PV.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  PV.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 실전 문제: 영상의 정답 표시가 규칙 엔진과 같은지 점검
  const PRACTICE = [
    { n: 1, at: [0.4, 6.5, 13], lines: ['빈칸은 동사 자리 → providing 지움', '앞 문장 next Friday → 앞으로', '뒤 문장도 미래 → (B) will be provided'] },
    { n: 2, at: [0.4, 6.4, 12.9], lines: ['넷 다 문법 OK → 가리키는 말 표시', '뒤 문장 After that date → 날짜 필요', 'this number = 손님 수 → (C)'] },
    { n: 3, at: [0.4, 6.4, 12.9], lines: ['마침표 . ___ , → 접속부사만', '프로젝터 · 마이크 + 노트북', '좋은 점 더하기 → (A) In addition'] },
  ];
  PRACTICE.forEach(p => {
    const b = PT.blank('westbay', p.n);
    if (!p.lines[2].includes(`(${'ABCD'[b.a]})`)) console.warn('[Part 6] 실전 문제 정답 표시가 데이터와 달라요:', p.n);
    if (!CHAPTERS.find(c => c.id === 'practice').caps.some(c => c[2].includes(`(${'ABCD'[b.a]})`))) console.warn('[Part 6] 실전 문제 자막의 정답이 데이터와 달라요:', p.n);
  });
  PV.PRACTICE = PRACTICE;

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: 15, weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: 38, weight: 800, fam: FD });
  }
  const KIND_EN = { notice: 'NOTICE', email: 'E-MAIL', memo: 'MEMO', ad: 'ADVERTISEMENT' };
  // 글 카드 (종이 느낌의 판 + 왼쪽 위 종류 이름표)
  function paper(g, x, y, w, h, label, o = {}) {
    panel(g, x, y, w, h, { fill: COL.paper, stroke: o.stroke || COL.faint, lw: o.lw || 1.3, r: 14 });
    if (label) chip(g, label, x + 18, y, { size: 12, weight: 700, fam: FM, color: COL.soft, fill: COL.panel2, stroke: COL.faint, h: 22, pad: 9, lw: 1 });
  }

  const SCENES = {
    /* 00 들어가며: 제목 → 빈칸 문장만 → 앞 문장 켜기 → 배울 것 */
    intro(g, u) {
      const out1 = 1 - ramp(u, 4.0, 0.6);
      fade(g, ramp(u, 0.3, 0.8) * out1, () => {
        txt(g, '한 문장으론 모른다,', W / 2, 262, { size: 60, weight: 800, fam: FD, align: 'center' });
        txt(g, '앞뒤 문장이 답한다', W / 2, 342, { size: 60, weight: 800, fam: FD, align: 'center', color: COL.accent });
        txt(g, 'TOEIC Part 6 · Text Completion', W / 2, 410, { size: 24, weight: 500, color: COL.muted, align: 'center' });
      });
      [['시제', COL.focus], ['연결어', COL.rel], ['문장 넣기', COL.cue]].forEach(([s, c], i) => {
        const a = ramp(u, 1.3 + i * 0.25, 0.4) * out1;
        fade(g, a, () => chip(g, s, W / 2 - 190 + i * 190, 488 + (1 - a) * 10, { size: 19, weight: 700, color: c, fill: COL.panel2, stroke: c, align: 'center', h: 40 }));
      });
      const P = PT.P.lobby, b = PT.blank('lobby', 1), a2 = ramp(u, 4.6, 0.7) * (1 - ramp(u, 19.0, 0.6));
      fade(g, a2, () => {
        panel(g, 80, 140, 1120, 428, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'TOEIC Part 6 · 글 빈칸 채우기', 112, 170, { size: 15, weight: 500, fam: FM, color: COL.accent });
        const prev = ramp(u, 10.6, 0.9), win = u > 15.6;
        const L = layP(g, P, { x: 112, y: 222, w: 536, size: 25, from: 0, to: 2, head: true, fills: win ? { 1: b.opts[b.a] } : {} });
        paper(g, 96, 196, 650, L.bottom - 196 + 26, 'NOTICE');
        const vis = s => s === 1 ? 1 : s === 0 ? prev : 0;
        drawP(g, L, { vis, hl: { 1: COL.focus }, marks: [{ s: 0, t: b.clues[0].t, color: COL.cue, a: ramp(u, 11.6, 0.5) }], glow: !win && u > 5.6 ? 0.5 + 0.5 * Math.sin(u * 4) : 0 });
        bracket(g, L, blankRect(L, 1), mid(span(g, L, 0, b.clues[0].t)), COL.cue, ramp(u, 12.2, 0.9), { label: '앞으로' });
        // 보기
        const v = new Set(u > 12.4 ? [0, 1] : [1]);
        panel(g, 770, 196, 410, 350, { fill: COL.panel2, stroke: COL.faint });
        txt(g, '보기', 794, 224, { size: 15, weight: 700, color: COL.muted });
        optRows(g, b, 800, 268, { size: 24, gap: 58, state: k => {
          const j1 = PT.judge(b, k, new Set()), j = PT.judge(b, k, v);
          if (win && k === b.a) return { st: 'win' };
          if (u > 6.6 && j1.s === 'no') return { st: 'no', p: ramp(u, 6.6, 0.5), tag: tagOf(b, k, new Set()) };
          if (u > 13.4 && j.s === 'no') return { st: 'no', p: ramp(u, 13.4, 0.5), tag: tagOf(b, k, v) };
          return { st: u > 7.6 ? 'ok1' : 'open' };
        } });
        const n = u < 6.8 ? 4 : u < 13.6 ? PT.alone(b).length : 1;
        fade(g, ramp(u, 6.8, 0.4), () => counter(g, n, 800, 506, { w: 340 }));
      });
      const steps = [['①', 'Part 6의 빈칸 세 가지', '시제 · 연결어 · 문장 넣기'], ['②', '단서 찾기', '날짜 · 관계 · 가리키는 말'], ['③', '3단계 풀이법', '문장 → 앞뒤 → 글']];
      steps.forEach(([n, t1, t2], k) => {
        const a = ramp(u, 19.8 + k * 0.6, 0.6), x0 = 100 + k * 370;
        fade(g, a, () => {
          panel(g, x0, 230 + (1 - a) * 16, 340, 220, { fill: COL.panel, stroke: COL.faint });
          txt(g, n, x0 + 28, 285 + (1 - a) * 16, { size: 34, weight: 700, color: COL.accent });
          txt(g, t1, x0 + 28, 345 + (1 - a) * 16, { size: 25, weight: 700, fam: FD });
          txt(g, t2, x0 + 28, 400 + (1 - a) * 16, { size: 19, weight: 500, color: COL.soft });
        });
      });
    },

    /* 01 Part 6은 이런 문제: Part 5(문장 하나) ↔ Part 6(글 하나 · 빈칸 넷), 글 종류, 빈칸 세 가지 */
    format(g, u) {
      fade(g, ramp(u, 0.5, 0.6), () => {
        panel(g, 80, 150, 390, 190, { fill: COL.panel, stroke: COL.faint });
        txt(g, 'Part 5', 104, 180, { size: 20, weight: 800, fam: FD, color: COL.soft });
        txt(g, '문장 하나 · 빈칸 하나', 196, 180, { size: 16, weight: 600, color: COL.muted });
        bars(g, 104, 230, [60, 40, 0, 56, 70], 22, { blankAt: 2 });
        bars(g, 104, 262, [110, 48], 22);
        [0, 1, 2, 3].forEach(k => {
          const x = 104 + (k % 2) * 170, y = 296 + Math.floor(k / 2) * 26;
          txt(g, `(${'ABCD'[k]})`, x, y, { size: 13, fam: FM, color: COL.muted });
          rr(g, x + 34, y - 6, 90, 12, 6); g.fillStyle = COL.bar; g.fill();
        });
        txt(g, '30문제', 446, 180, { size: 16, weight: 700, color: COL.muted, align: 'right' });
      });
      const a6 = ramp(u, 6.2, 0.6);
      const B = [[1, 1], [4, 0], [6, 2], [8, 3]];        // [줄, 빈칸 종류: 0 낱말 · 1 연결어 · 2 문장 넣기]
      const KINDS = [['낱말 빈칸', COL.focus, '시제 · 품사 · 어휘'], ['연결어 빈칸', COL.rel, 'However · In addition'], ['문장 넣기', COL.cue, '보기가 문장 넷']];
      const kindIdx = { 1: 0, 2: 1, 3: 2 };
      const PB = [];      // 빈칸 자리 (화살표용)
      fade(g, a6, () => {
        paper(g, 510, 150, 470, 340, 'E-MAIL');
        txt(g, 'Part 6', 534, 186, { size: 20, weight: 800, fam: FD, color: COL.soft });
        txt(g, '글 하나 · 빈칸 넷', 620, 186, { size: 16, weight: 600, color: COL.muted });
        [0, 1].forEach(i => { rr(g, 534, 212 + i * 18, [210, 160][i], 9, 4.5); g.fillStyle = 'rgba(238,241,244,0.08)'; g.fill(); });
        const rows = [[96, 70, 120, 40, 60], [50, 0, 90, 120, 40], [130, 60, 110, 70], [90, 100, 50, 120], [0, 80, 60, 130], [140, 70, 90], [0], [60, 120, 80, 70], [80, 0, 60, 90]];
        const kinds = { '1,1': 1, '4,0': 2, '6,0': 3, '8,1': 4 };
        rows.forEach((r, i) => {
          let x = 534;
          r.forEach((w, j) => {
            const key = `${i},${j}`, n = kinds[key];
            if (n) {
              const slot = n === 3, bw = slot ? 200 : 74, kd = n === 1 ? 0 : n === 2 ? 1 : n === 3 ? 2 : 0;
              const on = S.kind != null ? S.kind === kd : u >= 18.4 + kd * 1.6;
              rr(g, x, 262 + i * 24 - 10, bw, 20, 6); g.fillStyle = on ? hexA(KINDS[kd][1], 0.22) : 'rgba(255,122,168,0.12)'; g.fill();
              g.setLineDash([4, 3]); g.strokeStyle = on ? KINDS[kd][1] : COL.gap; g.lineWidth = 1.6; g.stroke(); g.setLineDash([]);
              txt(g, `(${n})`, x + bw / 2, 262 + i * 24, { size: 12, weight: 700, color: on ? KINDS[kd][1] : COL.gap, align: 'center' });
              PB.push({ n, kd, x: x + bw, y: 262 + i * 24 });
              x += bw + 10;
            } else if (w) { rr(g, x, 262 + i * 24 - 5, w, 10, 5); g.fillStyle = COL.bar; g.fill(); x += w + 10; }
          });
        });
        fade(g, ramp(u, 8.2, 0.5), () => chip(g, '지문 넷 → 모두 16문제', 962, 186, { size: 15, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'right', h: 32 }));
      });
      // 빈칸 세 가지
      KINDS.forEach(([name, c, ex], kd) => {
        const at = 18.4 + kd * 1.6, y = 222 + kd * 104, on = S.kind != null ? S.kind === kd : true;
        fade(g, ramp(u, at, 0.5) * (S.kind != null && !on ? 0.35 : 1), () => {
          panel(g, 1010, y - 36, 200, 80, { fill: COL.panel2, stroke: c, lw: on && S.kind != null ? 2.5 : 1.5 });
          const w = txt(g, name, 1026, y - 12, { size: 18, weight: 700, color: c });
          txt(g, PB.filter(p => p.kd === kd).map(p => `(${p.n})`).join(' '), 1026 + w + 8, y - 12, { size: 15, weight: 700, color: c });
          txt(g, ex, 1026, y + 18, { size: 13, weight: 500, color: COL.muted });
        });
      });
      // 글 종류
      const types = [['공지', 'notice'], ['이메일', 'e-mail'], ['회람', 'memo'], ['광고', 'advertisement'], ['기사', 'article']];
      const outT = 1 - ramp(u, 23.8, 0.5);
      let tx = 80;
      types.forEach(([ko, en], i) => {
        const x = tx, a = ramp(u, 12.2 + i * 0.5, 0.4) * outT;
        tx += tw(g, `${ko} ${en}`, 17, 700) + 28 + 12;
        fade(g, a, () => { const c = chip(g, `${ko} ${en}`, x, 532, { size: 17, weight: 700, color: COL.soft, fill: COL.panel2, stroke: COL.faint, h: 38 }); say(c.x, c.y, c.w, c.h, en); });
      });
      fade(g, ramp(u, 24.2, 0.6), () => {
        const c1 = chip(g, '이 영상에서 다루는 것: 글을 읽어야 풀리는 빈칸', 80, 532, { size: 18, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 42 });
        let x = c1.x + c1.w + 14;
        [['시제', COL.focus], ['연결어', COL.rel], ['문장 넣기', COL.cue]].forEach(([s, c]) => { const r = chip(g, s, x, 532, { size: 17, weight: 700, color: c, fill: COL.panel2, stroke: c, h: 38 }); x = r.x + r.w + 10; });
      });
    },

    /* 02 문장 하나로는 여러 개: 같은 빈칸 문장, 앞 문장 A(앞으로) ↔ B(이미 끝남) */
    core(g, u) {
      const ctxB = S.ctx ? S.ctx === 'B' : u >= 18.6;
      const P = ctxB ? PT.P.lobbyB : PT.P.lobby, b = PT.blank(P.id, 1);
      const prevOn = S.ctx ? 1 : ramp(u, 12.2, 0.9);
      const swap = S.ctx ? 1 : ramp(u, 18.6, 0.9);
      const win = S.ctx || u > 15.6;
      fade(g, ramp(u, 0.4, 0.6), () => {
        torch(g, 112, 222, 34, ramp(u, 11.6, 0.5), prevOn > 0.5);
        // 앞 문장 (A ↔ B 바뀜)
        const LA = layP(g, PT.P.lobby, { x: 190, y: 220, w: 1000, size: 26, from: 0, to: 0 });
        const LB = layP(g, PT.P.lobbyB, { x: 190, y: 220, w: 1000, size: 26, from: 0, to: 0 });
        if (!ctxB || swap < 1) fade(g, 1 - (ctxB ? swap : 0), () => drawP(g, LA, { vis: () => prevOn, marks: [{ s: 0, t: PT.blank('lobby', 1).clues[0].t, color: COL.cue, a: ramp(u, 12.8, 0.5) }], say: !ctxB }));
        if (ctxB) fade(g, swap, () => drawP(g, LB, { marks: [{ s: 0, t: PT.blank('lobbyB', 1).clues[0].t, color: COL.cue }], say: true }));
        // 빈칸 문장
        const L = layP(g, P, { x: 190, y: 304, w: 1000, size: 30, from: 1, to: 1, fills: win ? { 1: b.opts[b.a] } : {} });
        drawP(g, L, { hl: { 1: COL.focus }, glow: win ? 0 : 0.5 + 0.5 * Math.sin(u * 4) });
        const clue = mid(span(g, ctxB ? LB : LA, 0, b.clues[0].t));
        if (prevOn > 0.5) pointer(g, blankRect(L, 1), clue, COL.cue, ctxB ? swap : ramp(u, 13.0, 0.8), { label: ctxB ? '이미 끝남' : '앞으로', dx: 60 });
      });
      // 보기 네 개 (가로)
      const v = new Set(prevOn > 0.5 ? [0, 1] : [1]);
      fade(g, ramp(u, 2.0, 0.6), () => {
        b.opts.forEach((o, k) => {
          const x = 190 + k * 252, y = 420;
          const j1 = PT.judge(b, k, new Set()), j = PT.judge(b, k, v);
          const gone1 = u > 6.6 && j1.s === 'no', gone2 = !gone1 && (S.ctx || u > 13.8) && j.s === 'no', isWin = win && k === b.a && !gone1 && !gone2;
          const c = isWin ? COL.good : gone1 || gone2 ? COL.dim : COL.text;
          panel(g, x, y - 32, 236, 64, { fill: isWin ? 'rgba(127,224,168,0.10)' : COL.panel, stroke: isWin ? COL.good : COL.faint, lw: isWin ? 2.2 : 1.2, r: 12 });
          txt(g, `(${'ABCD'[k]})`, x + 14, y, { size: 15, fam: FM, color: COL.muted });
          const w = txt(g, o, x + 52, y, { size: 21, weight: 700, color: c });
          if (gone1 || gone2) {
            const p = gone1 ? ramp(u, 6.6, 0.4) : S.ctx ? 1 : ramp(u, ctxB ? 19.6 : 13.8, 0.4);
            g.strokeStyle = COL.bad; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x + 48, y + 1); g.lineTo(x + 48 + (w + 8) * p, y + 1); g.stroke();
            fade(g, p, () => txt(g, tagOf(b, k, gone1 ? new Set() : v), x + 118, y + 44, { size: 14, weight: 700, color: COL.trap, align: 'center' }));
          } else if (u > 7.4 && !isWin) txt(g, '문법 OK', x + 118, y + 44, { size: 14, weight: 700, color: COL.soft, align: 'center' });
          if (isWin) txt(g, '정답', x + 118, y + 44, { size: 14, weight: 700, color: COL.good, align: 'center' });
        });
      });
      const n = u < 6.8 && !S.ctx ? 4 : !S.ctx && u < 14 ? PT.alone(b).length : PT.cands(b, v).length;
      fade(g, ramp(u, 6.8, 0.4) * (1 - ramp(u, 24.6, 0.4)), () => counter(g, n, 960, 540, { w: 230 }));
      fade(g, ramp(u, 25.2, 0.6), () => {
        chip(g, '문장 하나로는 여러 개', 190, 540, { size: 20, weight: 700, color: COL.soft, fill: COL.panel2, stroke: COL.faint, h: 46 });
        arrow(g, 440, 540, 490, 540, COL.accent, 2.5);
        chip(g, '앞뒤 문장이 하나로 줄여요', 502, 540, { size: 20, weight: 800, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 46 });
      });
    },

    /* 03 시제는 글이 정한다: 한국어 현재형 ↔ will, 시간선(글을 쓴 날), 날짜를 바꾸면 시제도 */
    tense(g, u) {
      const out1 = 1 - ramp(u, 30.0, 0.5);
      fade(g, ramp(u, 0.6, 0.6) * out1, () => {
        panel(g, 80, 148, 540, 150, { fill: COL.panel, stroke: COL.faint });
        txt(g, '한국어 공지', 104, 176, { size: 15, weight: 700, color: COL.muted });
        let x = txt(g, '5월 12일부터 로비를 ', 104, 228, { size: 26, weight: 600 }) + 104;
        const w = txt(g, '닫습니다.', x, 228, { size: 26, weight: 800, color: COL.trap });
        g.fillStyle = COL.trap; g.fillRect(x, 246, w - 8, 3);
        chip(g, '현재형으로 앞일', x + w / 2 - 4, 274, { size: 13, weight: 700, color: COL.trap, fill: 'rgba(16,21,28,0.9)', stroke: COL.trap, align: 'center', h: 24, pad: 8 });
      });
      fade(g, ramp(u, 6.2, 0.6) * out1, () => {
        panel(g, 660, 148, 540, 150, { fill: COL.panel, stroke: COL.faint });
        txt(g, '영어 공지', 684, 176, { size: 15, weight: 700, color: COL.muted });
        const s = 'The lobby will be closed from May 12.';
        let x = 684;
        x += txt(g, 'The lobby ', x, 228, { size: 25, weight: 500 });
        const w = txt(g, 'will be closed', x, 228, { size: 25, weight: 800, color: COL.ans });
        g.fillStyle = COL.ans; g.fillRect(x, 246, w, 3);
        txt(g, ' from May 12.', x + w, 228, { size: 25, weight: 500 });
        chip(g, '앞일 → will', x + w / 2, 274, { size: 13, weight: 700, color: COL.ans, fill: 'rgba(16,21,28,0.9)', stroke: COL.ans, align: 'center', h: 24, pad: 8 });
        say(680, 205, 510, 46, s);
      });
      // 시간선
      const late = S.date ? S.date > 516 : u >= 24.6;
      const dp = S.date ? 1 : ramp(u, 24.8, 1.4);
      const doc = S.date || (u < 24.6 ? 502 : Math.round(lerp(502, 520, dp)));
      const P = PT.withDate('sched', S.date || (late ? 520 : 502)), b = P.blanks[0];
      const aTL = ramp(u, 12.2, 0.7);
      fade(g, aTL, () => {
        // 머리말 + 빈칸 문장
        const fill = u > 21 || S.date;
        const ok = PT.cands(b)[0];
        const L = layP(g, P, { x: 120, y: 334, w: 1000, size: 25, head: true, headSize: 18, fills: fill ? { 1: PT.optText(b, ok) } : {} });
        drawP(g, L, { hl: { 0: COL.focus }, marks: [{ s: -1, t: 'Posted: ' + PT.dateEn(P.date), color: COL.cue, a: ramp(u, 15.6, 0.5) }], glow: fill ? 0 : 0.5 });
        // 축
        const ax = 140, aw = 1000, ay = 458, cx = ax + aw / 2, DAY = 24;
        const dx = d => cx + (d - doc) * DAY;
        g.strokeStyle = COL.line; g.lineWidth = 3; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + aw, ay); g.stroke();
        arrowHead(g, ax + aw + 12, ay, 0, COL.line, 14);
        txt(g, '이미 끝난 일', ax, ay + 34, { size: 15, weight: 700, color: COL.muted });
        txt(g, '앞으로 있을 일', ax + aw, ay + 34, { size: 15, weight: 700, color: COL.muted, align: 'right' });
        // 공사 기간 막대
        const x0 = clamp(dx(512), ax, ax + aw), x1 = clamp(dx(516) + DAY, ax, ax + aw);
        fade(g, ramp(u, 18.6, 0.6), () => {
          rr(g, x0, ay - 16, Math.max(4, x1 - x0), 32, 8); g.fillStyle = 'rgba(201,167,255,0.22)'; g.fill(); g.strokeStyle = COL.cue; g.lineWidth = 2; g.stroke();
          txt(g, '공사 May 12–16', (x0 + x1) / 2, ay - 34, { size: 15, weight: 700, color: COL.cue, align: 'center' });
        });
        // 글을 쓴 날
        g.fillStyle = COL.accent; rr(g, cx - 2, ay - 22, 4, 44, 2); g.fill();
        chip(g, `글을 쓴 날 · ${PT.dateEn(doc)}`, cx, ay + 34, { size: 15, weight: 700, color: COL.bg, fill: COL.accent, align: 'center', h: 28, pad: 10 });
        if (fill) {
          const w = PT.clueWhen(b, b.clues[0]);
          fade(g, ramp(u, 21, 0.5), () => chip(g, `${PT.WHEN[w]} → ${PT.optText(b, ok)}`, w === 'future' ? ax + aw : ax, 542, { size: 17, weight: 700, color: COL.ans, fill: COL.panel2, stroke: COL.ans, align: w === 'future' ? 'right' : 'left', h: 36 }));
        }
      });
      // 시간 단서 네 가지
      const CL = [['머리말의 날짜', 'Posted: May 2', 'Date: October 8'], ['시간 표현', 'next week', 'last Friday · on May 12'], ['다른 동사의 시제', 'will begin', 'has been delayed'], ['글의 목적', 'Thank you for attending → 끝난 일', 'Please sign up by → 앞일']];
      CL.forEach(([h, e1, e2], k) => {
        const x = 80 + k * 283, on = k === 3 ? u >= 35.6 : u >= 30.6 + k * 1.2 && u < 35.6;
        fade(g, ramp(u, 30.6 + k * 0.5, 0.5), () => {
          panel(g, x, 148, 268, 150, { fill: on ? 'rgba(201,167,255,0.10)' : COL.panel, stroke: on ? COL.cue : COL.faint, lw: on ? 2.2 : 1.2 });
          txt(g, `${k + 1}. ${h}`, x + 18, 178, { size: 17, weight: 700, color: on ? COL.cue : COL.text });
          wrapText(g, e1, x + 18, 220, 236, { size: 15, weight: 600, color: COL.en });
          wrapText(g, e2, x + 18, 262, 236, { size: 15, weight: 600, color: COL.en });
        });
      });
    },

    /* 04 연결어: 접속부사 자리 → 관계 여섯 → 같은 앞 문장, 다른 뒤 문장 → 한국어로 이어 읽기 */
    link(g, u) {
      const outA = 1 - ramp(u, 11.6, 0.5);
      // 접속부사 자리
      fade(g, ramp(u, 0.5, 0.6) * (1 - ramp(u, 23.0, 0.5)), () => {
        let x = 160;
        const y = 178;
        bars(g, x, y, [90, 60, 110], 26); x += 300;
        txt(g, '.', x, y, { size: 34, weight: 800, color: COL.trap }); x += 22;
        rr(g, x, y - 20, 120, 40, 9); g.fillStyle = 'rgba(212,225,87,0.1)'; g.fill(); g.setLineDash([6, 5]); g.strokeStyle = COL.gap; g.lineWidth = 2.2; g.stroke(); g.setLineDash([]);
        txt(g, '접속부사', x + 60, y + 1, { size: 16, weight: 700, color: COL.gap, align: 'center' }); x += 128;
        txt(g, ',', x, y, { size: 34, weight: 800, color: COL.trap }); x += 26;
        bars(g, x, y, [80, 120, 70], 26); x += 310;
        txt(g, '.', x, y, { size: 34, weight: 800 });
      });
      const CH = [['Although', 'conj'], ['Despite', 'prep'], ['However', 'adv'], ['In addition', 'adv'], ['As a result', 'adv'], ['For example', 'adv']];
      fade(g, ramp(u, 4.0, 0.5) * outA, () => {
        let xx = 160;
        CH.forEach(([w, k], i) => {
          const at = 4.2 + i * 0.35, gone = k !== 'adv' && u > 7.6, x = xx;
          xx += tw(g, w, 19, 700) + 28 + 14;
          fade(g, ramp(u, at, 0.4), () => {
            const c = chip(g, w, x, 270, { size: 19, weight: 700, color: gone ? COL.dim : k === 'adv' ? COL.text : COL.soft, fill: COL.panel, stroke: gone ? COL.faint : COL.line, h: 42 });
            txt(g, PT.KIND[k], c.x + c.w / 2, 312, { size: 13, weight: 700, color: gone ? COL.trap : COL.muted, align: 'center' });
            if (gone) { const p = ramp(u, 7.6, 0.4); g.strokeStyle = COL.bad; g.lineWidth = 2.4; g.beginPath(); g.moveTo(c.x + 8, 270); g.lineTo(c.x + 8 + (c.w - 16) * p, 270); g.stroke(); }
            if (!gone && k === 'adv' && u > 9) check(g, c.x + c.w - 2, c.y - 2, 12, COL.good);
          });
        });
        fade(g, ramp(u, 9.4, 0.5), () => txt(g, '접속부사가 여럿 남아요 → 무엇으로 고를까?', 160, 360, { size: 19, weight: 700, color: COL.accent }));
      });
      // 관계 여섯
      const RELS = ['contrast', 'add', 'result', 'example', 'instead', 'otherwise'];
      const outG = 1 - ramp(u, 23.0, 0.5);
      RELS.forEach((r, i) => {
        const R = PT.REL[r], x = 80 + (i % 3) * 380, y = 330 + Math.floor(i / 3) * 112, at = 12.2 + (i < 3 ? i * 1.6 : 6 + (i - 3) * 1.6);
        const on = S.rel ? S.rel === r : false;
        fade(g, ramp(u, Math.min(at, i < 3 ? at : at), 0.5) * outG * (S.rel && !on ? 0.4 : 1), () => {
          panel(g, x, y - 46, 360, 98, { fill: on ? 'rgba(127,224,168,0.10)' : COL.panel, stroke: on ? COL.rel : COL.faint, lw: on ? 2.4 : 1.2 });
          txt(g, R.name, x + 18, y - 18, { size: 19, weight: 800, color: COL.rel });
          const ww = txt(g, PT.REL_WORDS[r], x + 18, y + 18, { size: 22, weight: 700, color: COL.text });
          say(x + 12, y, ww + 12, 36, PT.REL_WORDS[r]);
          txt(g, R.ko, x + 342, y - 18, { size: 16, weight: 700, color: COL.soft, align: 'right' });
        });
      });
      // 같은 앞 문장, 다른 뒤 문장
      if (u >= 23.0 || S.rel) {
        const relNow = S.rel && ['result', 'contrast', 'add', 'example'].includes(S.rel) ? S.rel : u < 29.6 ? 'result' : 'contrast';
        const id = { result: 'prResult', contrast: 'prContrast', add: 'prAdd', example: 'prExample' }[relNow], P = PT.P[id], b = P.blanks[0];
        const a = S.rel ? 1 : ramp(u, 23.4, 0.6), filled = S.rel || u > (relNow === 'result' ? 27.4 : 33.2);
        const sw = !S.rel && u >= 29.6 ? ramp(u, 29.6, 0.6) : 1;
        if (!S.rel || ['result', 'contrast', 'add', 'example'].includes(S.rel)) fade(g, a, () => {
          const L0 = layP(g, P, { x: 110, y: 200, w: 700, size: 28, from: 0, to: 0 });
          drawP(g, L0, { marks: [{ s: 0, t: b.clue.t, color: COL.cue, a: ramp(u, 24.4, 0.5) }] });
          fade(g, sw, () => {
            const L1 = layP(g, P, { x: 110, y: 290, w: 700, size: 28, from: 1, to: 1, fills: filled ? { 1: b.opts[b.a] } : {} });
            drawP(g, L1, { hl: { 1: COL.focus }, marks: [{ s: 1, t: b.here, color: COL.cue, a: ramp(u, relNow === 'result' ? 25 : 30.6, 0.5) }], glow: filled ? 0 : 0.5 });
            const bk = blankRect(L1, 1), c0 = mid(span(g, L0, 0, b.clue.t));
            if (bk && c0) {
              const p = S.rel ? 1 : ramp(u, relNow === 'result' ? 25.6 : 31.4, 0.8);
              curve(g, bk.cx - 30, bk.top - 2, 70, (bk.top + c0.bot) / 2, c0.x + 6, c0.bot + 2, COL.rel, p, { lw: 2.6 });
              if (p > 0.9) chip(g, `${PT.REL[relNow].name} · ${b.relKo}`, 110, 372, { size: 16, weight: 700, color: COL.rel, fill: COL.panel2, stroke: COL.rel, h: 34 });
            }
            // 보기
            optRows(g, b, 860, 200, { size: 22, gap: 50, state: k => {
              const j = PT.judge(b, k), t = relNow === 'result' ? 26.4 : 32.2;
              if (filled && k === b.a) return { st: 'win' };
              if ((S.rel || u > t) && j.s === 'no') return { st: 'no', p: S.rel ? 1 : ramp(u, t, 0.4), tag: tagOf(b, k) };
              return { st: 'open' };
            } });
          });
        });
        // 한국어로 이어 읽기
        fade(g, ramp(u, 35.2, 0.6), () => {
          panel(g, 80, 440, 1130, 122, { fill: COL.panel2, stroke: COL.faint });
          txt(g, '한국어로 이어 읽기', 104, 466, { size: 15, weight: 700, color: COL.muted });
          const ko0 = '자주 고장 났어요.', rows = relNow === 'result' ? [['그래서', true], ['그러나', false]] : [['그러나', true], ['그래서', false]];
          const ko1 = relNow === 'result' ? '모두 바꿨어요.' : '수리비는 쌌어요.';
          rows.forEach(([kw, ok], i) => fade(g, ramp(u, 35.8 + i * 1.2, 0.4), () => {
            const y = 500 + i * 38;
            let x = 104;
            x += txt(g, ko0 + ' ', x, y, { size: 20, weight: 500, color: COL.soft });
            const c = chip(g, kw, x, y, { size: 18, weight: 800, color: ok ? COL.good : COL.bad, fill: COL.panel, stroke: ok ? COL.good : COL.bad, h: 32, r: 8, pad: 10 });
            x = c.x + c.w + 8;
            x += txt(g, ko1, x, y, { size: 20, weight: 500, color: COL.soft });
            mark(g, ok, x + 22, y, 15);
          }));
        });
      }
    },

    /* 05 문장 넣기 ① 가리키는 말: 한국어는 빼고, 영어는 가리킨다 → this door ↔ the side door, your card ↔ ID cards */
    pointer(g, u) {
      const P = PT.P.lobby, b = PT.blank('lobby', 2);
      // 보기 넷 (모두 문법 OK)
      fade(g, ramp(u, 0.5, 0.5) * (1 - ramp(u, 5.8, 0.5)), () => {
        b.opts.forEach((o, k) => fade(g, ramp(u, 0.7 + k * 0.4, 0.4), () => {
          const y = 190 + k * 86;
          panel(g, 80, y - 32, 1000, 64, { fill: COL.panel, stroke: COL.faint, r: 12 });
          txt(g, `(${'ABCD'[k]})`, 102, y, { size: 16, fam: FM, color: COL.muted });
          const w = txt(g, o.t, 150, y, { size: 22, weight: 500 });
          say(144, y - 22, w + 12, 44, o.t);
          fade(g, ramp(u, 3.0, 0.4), () => { check(g, 1110, y, 15, COL.good); txt(g, '문법 OK', 1130, y, { size: 14, weight: 700, color: COL.good }); });
        }));
      });
      // 한국어 ↔ 영어
      const out2 = 1 - ramp(u, 24.0, 0.5);
      fade(g, ramp(u, 6.2, 0.6) * out2, () => {
        panel(g, 80, 150, 540, 190, { fill: COL.panel, stroke: COL.faint });
        txt(g, '한국어 공지', 104, 178, { size: 15, weight: 700, color: COL.muted });
        txt(g, '옆문을 이용해 주세요.', 104, 226, { size: 24, weight: 600 });
        let x = 104;
        const c = chip(g, '그 문에서', x, 280, { size: 18, weight: 700, color: COL.dim, fill: 'rgba(16,21,28,0.6)', stroke: COL.dim, h: 34, dash: [5, 4], r: 8 });
        x = c.x + c.w + 10;
        txt(g, '경비원이 신분증을 확인합니다.', x, 280, { size: 24, weight: 600 });
        txt(g, '가리키는 말을 빼도 돼요', 104, 318, { size: 15, weight: 700, color: COL.trap });
      });
      fade(g, ramp(u, 12.6, 0.6) * out2, () => {
        panel(g, 660, 150, 540, 190, { fill: COL.panel, stroke: COL.faint });
        txt(g, '영어 공지', 684, 178, { size: 15, weight: 700, color: COL.muted });
        const s1 = 'Please use the side door.', s2 = 'A guard will check ID cards at this door.';
        let x = 684;
        x += txt(g, 'Please use ', x, 226, { size: 22, weight: 500 });
        const w1 = txt(g, 'the side door', x, 226, { size: 22, weight: 700, color: COL.cue }); const ax = x + w1 / 2;
        txt(g, '.', x + w1, 226, { size: 22, weight: 500 });
        x = 684;
        x += txt(g, 'A guard will check ID cards at ', x, 280, { size: 22, weight: 500 });
        const w2 = txt(g, 'this door', x, 280, { size: 22, weight: 800, color: COL.ans });
        txt(g, '.', x + w2, 280, { size: 22, weight: 500 });
        g.fillStyle = COL.ans; g.fillRect(x, 296, w2, 3);
        curve(g, x + w2 / 2, 263, (x + w2 / 2 + ax) / 2 + 30, 262, ax, 245, COL.cue, ramp(u, 13.6, 0.7), { lw: 2.2 });
        txt(g, '앞에 나온 것을 꼭 다시 가리켜요', 684, 318, { size: 15, weight: 700, color: COL.ans });
        say(680, 205, 500, 42, s1); say(680, 259, 500, 42, s2);
      });
      // 가리키는 말 목록
      const PTR = [['this · these · that · those + 명사', 'this door · these changes'], ['it · they · them', '앞에 나온 명사를 대신'], ['such + 명사', 'such requests (그런 요청)'], ['also · as well · another', '앞에 비슷한 것이 있어야'], ['the + 앞의 명사 (되풀이)', 'a new system → the system']];
      fade(g, ramp(u, 18.6, 0.5) * out2, () => {
        PTR.forEach(([h, e], k) => fade(g, ramp(u, 18.8 + k * 0.6, 0.4), () => {
          const x = 80 + (k % 3) * 380, y = 400 + Math.floor(k / 3) * 84, on = S.ptr != null && S.ptr === k;
          panel(g, x, y - 34, 360, 72, { fill: on ? 'rgba(255,193,94,0.10)' : COL.panel, stroke: on ? COL.ans : COL.faint, lw: on ? 2.2 : 1.2 });
          txt(g, h, x + 16, y - 10, { size: 17, weight: 700, color: COL.ans });
          txt(g, e, x + 16, y + 18, { size: 14, weight: 500, color: COL.soft });
        }));
      });
      // 앞뒤로 이어 보기
      if (u >= 24.0) {
        const a = ramp(u, 24.3, 0.6), fillOn = u > 25.4;
        fade(g, a, () => {
          const L = layP(g, P, { x: 110, y: 200, w: 1060, size: 25, from: 2, to: 4, br: true, lh: 76, fills: fillOn ? { 2: b.opts[b.a].t } : {} });
          paper(g, 90, 160, 1100, 250, 'NOTICE');
          drawP(g, L, { hl: { 3: COL.focus }, marks: [{ s: 2, t: b.prev.t, color: COL.cue, a: ramp(u, 26, 0.5) }, { s: 3, t: 'this door', color: COL.ans, a: ramp(u, 26, 0.5) },
            { s: 4, t: b.next.t, color: COL.cue, a: ramp(u, 31, 0.5) }, { s: 3, t: 'ID cards', color: COL.ans, a: ramp(u, 31, 0.5) }] });
          const td = mid(span(g, L, 3, 'this door')), sd = mid(span(g, L, 2, b.prev.t)), yc = mid(span(g, L, 4, b.next.t)), ic = mid(span(g, L, 3, 'ID cards'));
          if (td && sd) pointer(g, td, sd, COL.cue, ramp(u, 26.6, 0.8), { label: '앞과 이어짐', dx: 120 });
          if (yc && ic) pointer(g, yc, ic, COL.cue, ramp(u, 31.6, 0.8), { label: '뒤와 이어짐', dx: 120 });
        });
        fade(g, ramp(u, 28.6, 0.5), () => chip(g, '앞 ✓ this door = the side door', 110, 470, { size: 18, weight: 700, color: COL.good, fill: COL.panel2, stroke: COL.good, h: 40 }));
        fade(g, ramp(u, 33.4, 0.5), () => chip(g, '뒤 ✓ your card = ID cards → 정답', 560, 470, { size: 18, weight: 700, color: COL.good, fill: COL.panel2, stroke: COL.good, h: 40 }));
      }
    },

    /* 06 함정: 순서 · 같은 낱말 · also (+ 어긋남) */
    trap(g, u) {
      const P = PT.P.lobby, b = PT.blank('lobby', 2), win = S.trap === 'win' || (S.trap == null && u > 29.8);
      fade(g, ramp(u, 0.4, 0.6), () => {
        paper(g, 80, 146, 820, 132, 'NOTICE');
        const L = layP(g, P, { x: 100, y: 180, w: 780, size: 20, from: 2, to: 4, fills: win ? { 2: b.opts[b.a].t } : {}, slotW: 150 });
        drawP(g, L, { hl: { 3: COL.focus }, marks: [{ s: 2, t: 'Pine Street', color: COL.trap, a: S.trap === 'D' || (S.trap == null && u > 13.6 && u < 24.5) ? 1 : 0 }, { s: 4, t: 'your card', color: COL.cue, a: S.trap === 'C' || (S.trap == null && u > 7 && u < 12.5) ? 1 : 0 }] });
      });
      // 함정 이름표
      fade(g, ramp(u, 24.6, 0.5) * (S.trap ? 1 : 1), () => {
        [['순서', COL.trap], ['같은 낱말', COL.trap], ['also', COL.trap], ['어긋남', COL.trap]].forEach(([s, c], i) => chip(g, s, 930 + (i % 2) * 140, 172 + Math.floor(i / 2) * 44, { size: 16, weight: 700, color: c, fill: COL.panel2, stroke: c, h: 34 }));
        txt(g, '어긋남 예: 재고 없음 ↔ 오늘 아침 배달됨', 930, 262, { size: 13, weight: 600, color: COL.muted });
      });
      const ORDER = [2, 3, 1, 0], AT = { 2: 6.2, 3: 12.6, 1: 18.6, 0: 29.8 };
      ORDER.forEach((k, i) => {
        const x = 80 + (i % 2) * 570, y = 302 + Math.floor(i / 2) * 140, o = b.opts[k], j = PT.judge(b, k), isAns = k === b.a;
        const focus = S.trap ? S.trap === 'ABCD'[k] || (S.trap === 'win' && isAns) : u >= AT[k];
        const on = S.trap ? focus : u >= AT[k];
        fade(g, ramp(u, 1.2 + i * 0.4, 0.5) * (S.trap && !focus ? 0.45 : 1), () => {
          const done = on, c = !done ? COL.faint : isAns ? COL.good : COL.trap;
          panel(g, x, y, 560, 128, { fill: done && isAns ? 'rgba(127,224,168,0.08)' : COL.panel, stroke: c, lw: done ? 2.2 : 1.2 });
          txt(g, `(${'ABCD'[k]})`, x + 18, y + 28, { size: 15, fam: FM, color: COL.muted });
          const n = wrapText(g, o.t, x + 62, y + 28, 446, { size: 19, weight: 600, color: done && !isAns ? COL.soft : COL.text, lh: 26 }).n;
          say(x + 56, y + 10, 456, n * 26 + 12, o.t);
          if (done) {
            const tag = isAns ? '정답' : PT.TRAP[j.trap];
            const t = chip(g, tag, x + 18, y + 100, { size: 14, weight: 800, color: isAns ? COL.good : COL.trap, fill: 'rgba(16,21,28,0.9)', stroke: isAns ? COL.good : COL.trap, h: 28, pad: 9 });
            const why = isAns ? '앞 the side door ← this door · 뒤 your card ← ID cards' : { order: '카드 이야기는 뒤 문장에야 나와요', same: '같은 낱말 Pine Street → 그래도 주제는 주차', also: '앞에 다른 시설이 없어요' }[j.trap] || j.why;
            txt(g, why, t.x + t.w + 12, y + 100, { size: 15, weight: 600, color: COL.soft });
            mark(g, isAns, x + 534, y + 28, 16);
          }
        });
      });
    },

    /* 07 단서는 어디에나: 로비 공지 전체, 빈칸 (4) — 가까운 과거형 함정, 뒤 문장, 머리말 */
    far(g, u) {
      const P = PT.P.lobby, b = PT.blank('lobby', 4);
      const R = S.reveal;          // 직접 해 보기에서 고른 공개 집합
      const show = s => {
        if (R) return s === b.s || R.has(s) ? 1 : 0;
        if (s === 7) return 1;
        if (s === 5 || s === 6) return ramp(u, 12.2, 0.8);
        if (s === 8) return ramp(u, 18.2, 0.8);
        return ramp(u, 24.2, 0.9);
      };
      const vis = new Set([5, 6, 7, 8, 0, 1, 2, 3, 4, -1].filter(s => show(s) > 0.5));
      fade(g, ramp(u, 0.4, 0.6), () => {
        const L = layP(g, P, { x: 100, y: 184, w: 560, size: 19, head: true, headSize: 14, lh: 30, fills: { 1: PT.ansText(PT.blank('lobby', 1)), 2: PT.ansText(PT.blank('lobby', 2)), 3: PT.ansText(PT.blank('lobby', 3)) }, plain: [1, 2, 3], blankW: 74 });
        paper(g, 80, 152, 696, L.bottom - 152 + 22, 'NOTICE');
        drawP(g, L, { vis: show, hl: { 7: COL.focus }, fillStyle: () => 'soft', glow: 0.5,
          marks: [{ s: 5, t: b.trap.t, color: COL.trap, a: R ? (R.has(5) ? 1 : 0) : ramp(u, 13.4, 0.5) }, { s: 8, t: b.clues[0].t, color: COL.cue }, { s: 0, t: b.clues[1].t, color: COL.cue }, { s: -1, t: 'Posted: May 2', color: COL.cue }] });
        const bk = blankRect(L, 4);
        const tr = mid(span(g, L, 5, b.trap.t)), c8 = mid(span(g, L, 8, b.clues[0].t)), c0 = mid(span(g, L, 0, b.clues[1].t)), hd = mid(span(g, L, -1, 'Posted: May 2'));
        if (!R) {
          fade(g, 1 - ramp(u, 18.0, 0.5), () => bracket(g, L, bk, tr, COL.trap, ramp(u, 14.2, 0.7), { label: '함정', i: 0 }));
          bracket(g, L, bk, c8, COL.cue, ramp(u, 19.2, 0.7), { label: '앞으로', i: 0 });
          bracket(g, L, bk, c0, COL.cue, ramp(u, 25.0, 0.8), { label: '앞으로', i: 1 });
          bracket(g, L, bk, hd, COL.cue, ramp(u, 26.2, 0.8), { label: '5월 2일', i: 2 });
        } else {
          if (R.has(5)) bracket(g, L, bk, tr, COL.trap, 1, { label: '함정', i: 0 });
          if (R.has(8)) bracket(g, L, bk, c8, COL.cue, 1, { label: '앞으로', i: 0 });
          if (R.has(0)) bracket(g, L, bk, c0, COL.cue, 1, { label: '앞으로', i: 1 });
          if (R.has(-1)) bracket(g, L, bk, hd, COL.cue, 1, { label: '5월 2일', i: 2 });
        }
      });
      // 오른쪽: 보기와 단서 자리
      fade(g, ramp(u, 4.0, 0.6), () => {
        panel(g, 796, 152, 414, 290, { fill: COL.panel2, stroke: COL.faint });
        txt(g, '빈칸 (4)의 보기', 818, 180, { size: 15, weight: 700, color: COL.muted });
        optRows(g, b, 824, 218, { size: 21, gap: 44, state: k => {
          const j1 = PT.judge(b, k, new Set()), j = PT.judge(b, k, vis);
          if (k === b.a && (R ? PT.cands(b, vis).length === 1 : u > 22.6)) return { st: 'win' };
          if ((R || u > 7.6) && j1.s === 'no') return { st: 'no', p: R ? 1 : ramp(u, 7.6, 0.4), tag: tagOf(b, k, new Set()) };
          if (j.s === 'no' && (R || u > 20.2)) return { st: 'no', p: R ? 1 : ramp(u, 20.2, 0.4), tag: tagOf(b, k, vis) };
          return { st: 'open' };
        } });
        counter(g, PT.cands(b, vis).length, 818, 404, { w: 370 });
      });
      const PLACES = [['머리말', -1], ['앞 문장', 6], ['뒤 문장', 8], ['멀리 있는 문장', 0]];
      fade(g, ramp(u, 1.4, 0.6), () => {
        txt(g, '단서가 있는 곳', 818, 468, { size: 15, weight: 700, color: COL.muted });
        PLACES.forEach(([s, si], i) => {
          const lit = vis.has(si), c = si === 6 ? COL.trap : COL.cue;
          chip(g, s + (si === 6 ? ' (함정)' : ''), 818 + (i % 2) * 190, 502 + Math.floor(i / 2) * 42, { size: 15, weight: 700, color: lit ? c : COL.dim, fill: COL.panel, stroke: lit ? c : COL.faint, h: 34 });
        });
      });
    },

    /* 08 3단계 풀이법: 단계(가로) × 빈칸 종류(세로) */
    method(g, u) {
      const cols = [
        { x: 80, head: '① 빈칸 문장', sub: '문법으로 지우기', at: 5.6 },
        { x: 480, head: '② 앞뒤 문장', sub: '단서로 하나로', at: 11.6 },
        { x: 880, head: '③ 글 전체', sub: '흐름으로 확인', at: 17.6 },
      ];
      const rows = [
        { k: 'tense', name: '시제', c: COL.focus, cells: [['동사 자리 · 수 · 태', '시제 없는 꼴 지우기'], ['날짜 · next week · 다른 동사', '시간선의 앞? 뒤?'], ['글을 쓴 날 · 글의 목적', '앞일 알림? 끝난 일 감사?']] },
        { k: 'link', name: '연결어', c: COL.rel, cells: [['. ___ , → 접속부사만', '접속사 · 전치사 지우기'], ['두 문장의 관계', '반대 · 더하기 · 결과 · 예 · 대신 · 조건'], ['흐름이 자연스러운가', '한국어로 이어 읽기']] },
        { k: 'insert', name: '문장 넣기', c: COL.cue, cells: [['넷 다 문법 OK', '가리키는 말 표시'], ['가리키는 말의 짝 · 뒤 문장', 'this door ← the side door'], ['주제 · 어긋남 없음', '같은 낱말 함정 조심']] },
      ];
      cols.forEach((c, ci) => {
        fade(g, ramp(u, 0.8 + ci * 0.5, 0.6), () => {
          panel(g, c.x, 146, 340, 54, { fill: COL.panel2, stroke: COL.accent });
          txt(g, c.head, c.x + 20, 173, { size: 21, weight: 700, fam: FD, color: COL.accent });
          txt(g, c.sub, c.x + 320, 173, { size: 14, weight: 600, color: COL.muted, align: 'right' });
          if (ci < 2) arrow(g, c.x + 346, 173, c.x + 392, 173, COL.accent, 3);
        });
        rows.forEach((r, ri) => {
          const on = S.mtype ? S.mtype === r.k : false;
          fade(g, ramp(u, c.at + ri * 0.5, 0.5) * (S.mtype && !on ? 0.35 : 1), () => {
            const y = 212 + ri * 100;
            panel(g, c.x, y, 340, 88, { fill: on ? 'rgba(255,193,94,0.12)' : COL.panel, stroke: on ? COL.ans : COL.faint, lw: on ? 2.4 : 1.2 });
            if (ci === 0) chip(g, r.name, c.x + 14, y + 20, { size: 13, weight: 800, color: r.c, fill: 'rgba(16,21,28,0.9)', stroke: r.c, h: 24, pad: 8 });
            const [t1, t2] = r.cells[ci];
            txt(g, t1, c.x + 16, y + (ci === 0 ? 50 : 30), { size: 17, weight: 700, color: COL.text });
            txt(g, t2, c.x + 16, y + (ci === 0 ? 72 : 58), { size: 14, weight: 500, color: COL.soft });
          });
        });
      });
      fade(g, ramp(u, 23.2, 0.6), () => {
        let x = 80;
        [['보기 넷', COL.soft], ['둘 · 셋', COL.soft], ['하나', COL.good], ['확인', COL.accent]].forEach(([s, c], i) => {
          const r = chip(g, s, x, 544, { size: 18, weight: 700, color: c, fill: COL.panel2, stroke: c, h: 40 });
          if (i < 3) arrow(g, r.x + r.w + 10, 544, r.x + r.w + 46, 544, COL.accent, 2.5);
          x = r.x + r.w + 58;
        });
      });
    },

    /* 09 실전 문제 세 개: 이메일 하나 */
    practice(g, u) {
      const SEG = [0, 20.2, 40.2, 60];
      const pi = u < SEG[1] ? 0 : u < SEG[2] ? 1 : 2, v = u - SEG[pi], pr = PRACTICE[pi];
      const P = PT.P.westbay, b = PT.blank('westbay', pr.n);
      const s1 = v >= pr.at[0] + 0.6, s2 = v >= pr.at[1], s3 = v >= pr.at[2];
      const fills = {};
      P.blanks.forEach(x => { if (x.n < b.n || (x.n === b.n && s3)) fills[x.n] = PT.ansText(x); });
      const plain = P.blanks.filter(x => x.n < b.n).map(x => x.n);
      const L = layP(g, P, { x: 92, y: 180, w: 566, size: 19.5, lh: 30.5, head: true, headSize: 14, headLines: ['From: Westbay Conference Center · To: Laura Chen', 'Date: April 14 · Subject: Your booking'], fills, plain, blankW: 70, slotW: 120 });
      paper(g, 72, 148, 700, L.bottom - 148 + 20, 'E-MAIL');
      const clueMarks = [];
      if (b.type === 'tense') { if (s2) clueMarks.push({ s: b.clues[0].s, t: b.clues[0].t, color: COL.cue, a: ramp(v, pr.at[1] + 0.3, 0.5) }); if (s3) clueMarks.push({ s: b.clues[1].s, t: b.clues[1].t, color: COL.cue, a: ramp(v, pr.at[2] + 0.3, 0.5) }); }
      if (b.type === 'insert') { if (s1) clueMarks.push({ s: b.next.s, t: b.next.t, color: COL.cue, a: ramp(v, pr.at[1] + 0.2, 0.5) }); if (v > 12.6) clueMarks.push({ s: b.prev.s, t: b.prev.t, color: COL.cue, a: ramp(v, 12.6, 0.5) }); }
      if (b.type === 'link' && s2) clueMarks.push({ s: b.clue.s, t: b.clue.t, color: COL.cue, a: ramp(v, pr.at[1] + 0.3, 0.5) }, { s: b.s, t: b.here, color: COL.cue, a: ramp(v, pr.at[1] + 2.4, 0.5) });
      drawP(g, L, { hl: { [b.s]: COL.focus }, fillStyle: n => n === b.n ? 'ans' : 'soft', glow: s3 ? 0 : 0.5 + 0.5 * Math.sin(u * 4), marks: clueMarks });
      const bk = blankRect(L, b.n);
      if (b.type === 'tense') {
        bracket(g, L, bk, mid(span(g, L, b.clues[0].s, b.clues[0].t)), COL.cue, ramp(v, pr.at[1] + 0.6, 0.7), { label: '앞으로', i: 0 });
        bracket(g, L, bk, mid(span(g, L, b.clues[1].s, b.clues[1].t)), COL.cue, ramp(v, pr.at[2] + 0.6, 0.7), { label: '미래', i: 1 });
      } else if (b.type === 'insert') {
        bracket(g, L, bk, mid(span(g, L, b.next.s, b.next.t)), COL.cue, ramp(v, pr.at[1] + 0.8, 0.7), { label: '날짜 필요', i: 0 });
        bracket(g, L, bk, mid(span(g, L, b.prev.s, b.prev.t)), COL.cue, ramp(v, 13.2, 0.7), { label: '= 손님 수', i: 1 });
      } else {
        bracket(g, L, mid(span(g, L, b.s, b.here)), mid(span(g, L, b.clue.s, b.clue.t)), COL.rel, ramp(v, pr.at[1] + 2.8, 0.8), { label: '+ 더하기', i: 0 });
      }
      // 오른쪽: 보기와 세 단계
      panel(g, 790, 148, 424, 424, { fill: COL.panel, stroke: COL.faint });
      txt(g, `문제 ${pi + 1} / 3 · 빈칸 (${b.n}) · ${PT.TYPE[b.type].name}`, 810, 174, { size: 15, weight: 600, fam: FM, color: COL.accent });
      const allVis = new Set([-1, 0, 1, 2, 3, 4, 5, 6, 7]);
      const rows = optRows(g, b, 816, 216, { size: b.type === 'insert' ? 15.5 : 21, gap: b.type === 'insert' ? 40 : 44, w: 384, state: k => {
        const j1 = PT.judge(b, k, new Set()), j = PT.judge(b, k, allVis);
        if (s3 && k === b.a) return { st: 'win' };
        if (s1 && j1.s === 'no') return { st: 'no', p: ramp(v, pr.at[0] + 0.6, 0.4), tag: tagOf(b, k, new Set()) };
        if (j.s === 'no' && v >= pr.at[1] + 1.4) return { st: 'no', p: ramp(v, pr.at[1] + 1.4, 0.4), tag: tagOf(b, k) };
        return { st: 'open' };
      } });
      const last = rows[rows.length - 1], ys = last.y + (last.nl - 1) * 20 + 46;
      g.fillStyle = COL.faint; g.fillRect(810, ys - 22, 384, 1);
      pr.lines.forEach((ln, k) => fade(g, ramp(v, pr.at[k] + 0.3, 0.5), () => {
        const y = Math.max(ys, 398) + k * 38;
        txt(g, ['①', '②', '③'][k], 810, y, { size: 17, weight: 700, color: COL.accent });
        txt(g, ln, 836, y, { size: 16, weight: 600, color: k === 2 ? COL.good : COL.soft });
      }));
    },

    /* 10 정리 */
    summary(g, u) {
      const X = [80, 300, 760], Y0 = 150, RH = 92;
      const rows = [
        ['시제', COL.focus, '머리말의 날짜 · 시간 표현 · 다른 동사', 'Posted: May 2 → will be closed'],
        ['연결어', COL.rel, '두 문장의 관계 (반대 · 더하기 · 결과 · 예 · 대신 · 조건)', 'broke down. As a result, …'],
        ['문장 넣기', COL.cue, '가리키는 말의 짝 · 뒤 문장 · 주제', 'this door ← the side door'],
      ];
      fade(g, ramp(u, 0.4, 0.6), () => {
        panel(g, 60, Y0 - 10, 1160, RH * 3 + 70, { fill: COL.panel, stroke: COL.faint });
        ['빈칸', '답을 정하는 단서', '예'].forEach((h, i) => txt(g, h, X[i] + 20, Y0 + 22, { size: 17, weight: 700, color: COL.muted }));
        g.fillStyle = COL.faint; g.fillRect(80, Y0 + 46, 1120, 1);
      });
      rows.forEach((r, ri) => fade(g, ramp(u, 1.2 + ri * 0.8, 0.6), () => {
        const y = Y0 + 46 + RH * ri + RH / 2;
        chip(g, r[0], X[0] + 20, y, { size: 18, weight: 800, color: r[1], fill: COL.panel2, stroke: r[1], h: 38 });
        wrapText(g, r[2], X[1] + 20, y - (tw(g, r[2], 18, 600) > 430 ? 12 : 0), 430, { size: 18, weight: 600, lh: 26 });
        txt(g, r[3], X[2] + 20, y, { size: 18, weight: 500, color: COL.en });
      }));
      const steps = ['① 빈칸 문장: 문법으로', '② 앞뒤 문장: 단서로', '③ 글 전체: 확인'];
      let x = 80;
      steps.forEach((s, i) => fade(g, ramp(u, 12.2 + i * 0.6, 0.5), () => {
        const c = chip(g, s, x, 530, { size: 20, weight: 700, color: COL.accent, fill: COL.panel2, stroke: COL.accent, h: 48, r: 12, pad: 20 });
        if (i < 2) arrow(g, c.x + c.w + 12, 530, c.x + c.w + 46, 530, COL.accent, 2.5);
        x = c.x + c.w + 58;
      }));
    },
  };
  // 회색 막대 줄 (글의 모양만). blankAt: 빈칸 자리
  function bars(g, x, y, ws, size, o = {}) {
    ws.forEach((w, i) => {
      if (o.blankAt === i) { rr(g, x, y - size * 0.5, 70, size, 6); g.fillStyle = 'rgba(255,122,168,0.12)'; g.fill(); g.setLineDash([4, 3]); g.strokeStyle = COL.gap; g.lineWidth = 1.6; g.stroke(); g.setLineDash([]); x += 80; return; }
      rr(g, x, y - size * 0.22, w, size * 0.44, size * 0.22); g.fillStyle = COL.bar; g.fill(); x += w + 10;
    });
  }

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
    // 두 줄이면 줄 길이를 고르게 (끝에 한두 낱말만 남는 줄이 생기지 않게)
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

  PV.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[PV.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, PV.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + Object.values(PT.P).map(P => P.sents.join(' ') + P.head.join(' ') + P.blanks.map(b => b.opts.map((_, k) => PT.optText(b, k)).join(' ')).join(' ')).join(' ') +
    Object.values(PT.REL).map(r => r.name + r.ko).join('') + Object.values(PT.TRAP).join('') + Object.values(PT.TSHORT).join('') + Object.values(PT.KIND).join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;·()[]→←↔✓×?~=+-/:…‘’–맞아요틀려요남은보기글을쓴날';
  PV.baseText = EXTRA;
  PV.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = PV.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S, (k, v) => v instanceof Set ? [...v] : v); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { PV.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; const k = JSON.parse(keep); if (k.reveal) k.reveal = new Set(k.reveal); Object.assign(S, k); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
