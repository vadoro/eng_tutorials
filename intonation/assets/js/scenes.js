/* 올리고 내리기 — 억양과 초점: 영상 장면과 자막 (INS)
 * 그림은 시간 t와 사용자 상태(S)만의 함수예요. 문장의 모양 · 꺾이는 곳 · 초점은 규칙 엔진(IN)이 계산하고,
 * 높낮이 선은 미리 만든 음성 파일을 따로 잰 값(INV.meas의 f · w · end)으로 그려요 — 낱말 자리는 Whisper 낱말 시각이라 어림이에요.
 * 잰 값이 없으면 엔진의 기본 모양(IN.schematic)을 점선으로 그리고 ‘그림으로 줄인 모양 · 잰 값 아님’이라고 적어요.
 * 한국어식 억양은 소리로 만들지 않고 그림으로만 보여 줘요(주황 점선).
 * 역할 색: Yes/No 질문 하늘 · 정보 질문 민트 · 고르는 질문 모래 · 평서문 회색 · 되묻는 말 보라 · 꺾이는 곳 노랑 · 한국어식 주황
 */
(function () {
  'use strict';
  const IN = window.IN, V = window.INV;
  const INS = (window.INS = {});
  const W = 1280, H = 720;
  INS.W = W; INS.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const win = (u, a, b, d = 0.4) => ramp(u, a, d) * (1 - ramp(u, b - d, d));
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  INS.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151C', grid: 'rgba(238,241,244,0.045)', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', dim: '#5F6B78',
    faint: 'rgba(238,241,244,0.14)', line: 'rgba(238,241,244,0.30)', panel: '#18202A', panel2: '#202A36',
    yn: '#6EC8FF', wh: '#7FE0A8', alt: '#E8C79A', stmt: '#9AA6B4', decl: '#C9A7FF', nuc: '#FFC15E', ko: '#FF9F7A',
    bad: '#FF6B6B', good: '#7FE0A8', accent: '#FFC15E', en: '#BFE3FF', up: '#6EC8FF', down: '#7FE0A8',
  };
  INS.COL = COL;
  const SPS = ['tc', 'tf', 'uf', 'um'];
  const WHO = { tc: '밝은 선생님', tf: '차분한 선생님', uf: '미국 여성', um: '미국 남성' };
  INS.WHO = WHO;
  const median = a => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : 0; };
  // 확인을 통과한 목소리: pref가 통과했으면 pref, 아니면 통과한 첫 목소리, 없으면 pref
  const passed = (sp, text) => { const m = V.meas(sp, text); return !!(m && m.f); };
  INS.passed = passed;
  INS.bestSp = (text, pref = 'tc') => passed(pref, text) ? pref : SPS.find(sp => passed(sp, text)) || pref;
  // 말 여럿을 모두 통과한 목소리 (잰 값이 하나도 없으면 모든 목소리)
  INS.passVoices = texts => { const ok = SPS.filter(sp => texts.every(t => passed(sp, t))); return ok.length || Object.keys(window.PRON_MEASURE || {}).length ? ok : SPS.slice(); };

  // 사용자 상태 ('직접 해 보기'로 바뀜). 영상 추출은 언제나 기본값
  const S = (INS.S = { voice: null, sent: null, pair: null });
  INS.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  INS.hits = () => HITS;

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
  // 누르면 들려줌: seq = [{ text, sp }]
  const listen = (x, y, w, h, seq) => HITS.push({ x, y, w, h, play: seq });
  const hex = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  INS.hex = hex;
  const say = (text, sp) => [{ text, sp: sp || INS.bestSp(text) }];

  /* ---------- 아이콘 — 24×24 선 그림. 캔버스(Path2D)와 HTML(SVG)이 같은 길을 써요 ---------- */
  const ICON = {
    spk: [['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'f'], ['M15.5 9a4 4 0 0 1 0 6'], ['M18 6.5a7.5 7.5 0 0 1 0 11']],
    ear: [['M7.5 9.5a4.5 4.5 0 1 1 9 0c0 3.1-3 3.7-3 6.6a2.7 2.7 0 0 1-5.1 1.1'], ['M10.5 10a1.6 1.6 0 1 1 3 .9']],
    tune: [['M3 15c2.5 0 3.5-6 6-6s3 5 5.5 5 3.5-8 6.5-8'], ['M17 6h4v4']],
    focus: [['M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 1 0 0-15z'], ['M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5z', 'f']],
    wave: [['M3 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0 3 4 4.5 0']],
    mic: [['M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z'], ['M6 11a6 6 0 0 0 12 0'], ['M12 17v3.5M9 20.5h6']],
  };
  INS.ICON = ICON;
  const P2D = {};
  function icon(g, id, cx, cy, size, color, lw = 1.8) {
    const k = size / 24;
    g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(k, k);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    (ICON[id] || []).forEach(([d, m]) => { const p = P2D[d] || (P2D[d] = new Path2D(d)); if (m === 'f') g.fill(p); else g.stroke(p); });
    g.restore();
  }
  INS.icon = icon;
  INS.iconSVG = (id, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICON[id] || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`).join('')}</svg>`;

  /* ---------- 높낮이 선의 값 ----------
     잰 값(f: 20ms마다 Hz · w: 낱말 시각 · end: 끝 움직임)이 있으면 그 목소리의 선(반음, 그 문장 울림의 가운데값 = 0),
     없으면 엔진의 기본 모양(그림). 돌려줌 { measured, pts: [[0..1, 반음] | null], words: [{ t, k, a, b, nuc }], end, sp } */
  function pitchData(text, o = {}) {
    const sp = o.sp || INS.bestSp(text), focus = o.focus === undefined ? IN.focusOf(text) : o.focus;
    const toks = IN.tokens(text), nuc = IN.nuclei(text, { focus, shape: o.shape });
    const m = o.sch ? null : V.meas(sp, text);
    if (m && m.f && m.w && m.w.length === toks.length) {
      const t0 = Math.max(0, m.w[0][0] - 60), t1 = m.w[m.w.length - 1][1] + 100;
      const i0 = Math.floor(t0 / 20), i1 = Math.max(i0 + 2, Math.min(m.f.length - 1, Math.ceil(t1 / 20)));
      const hz = []; for (let i = i0; i <= i1; i++) if (m.f[i] > 0) hz.push(m.f[i]);
      const ref = o.ref || median(hz) || 200;
      const pts = []; for (let i = i0; i <= i1; i++) pts.push(m.f[i] > 0 ? [(i - i0) / (i1 - i0), 12 * Math.log2(m.f[i] / ref)] : null);
      const X = ms => clamp((ms - i0 * 20) / ((i1 - i0) * 20));
      const words = toks.map((t, k) => ({ t: t.t, k: t.k, a: X(m.w[k][0]), b: X(m.w[k][1]), nuc: nuc.indexOf(k) >= 0 }));
      return { measured: true, pts, words, end: m.end, sp, hz, ref };
    }
    const sc = IN.schematic(text, { focus, shape: o.shape, tune: o.tune });
    const words = sc.words.map((w, k) => ({ t: w.t, k: toks[k].k, a: w.a, b: w.b, nuc: nuc.indexOf(k) >= 0 }));
    return { measured: false, pts: sc.pts, words, end: null, sp, tune: o.tune, shape: o.shape };
  }
  INS.pitchData = pitchData;
  // 세로 범위(반음): 적어도 −6 ~ +8, 값에 맞춰 넓힘
  const stRange = (...Ps) => { const v = [].concat(...Ps.map(P => P.pts.filter(Boolean).map(p => p[1]))); return [Math.max(-16, Math.min(-6, ...v) - 1.5), Math.min(22, Math.max(8, ...v) + 1.5)]; };
  INS.stRange = stRange;
  // 끝의 방향: 잰 값이면 그 값의 부호, 그림이면 엔진(o.tune · o.shape)
  const endDir = (P, text) => P.measured && P.end != null ? (P.end > 0 ? 'up' : 'down') : P.tune ? (P.tune === 'fall' || P.tune === 'post' ? 'down' : 'up') : IN.SHAPES[P.shape || IN.shapeOf(text)].end;
  INS.endDir = endDir;
  const endText = (P, text) => { const d = endDir(P, text), ar = d === 'up' ? '↗' : '↘'; return P.measured && P.end != null ? `끝 ${ar} ${P.end > 0 ? '+' : '−'}${Math.abs(P.end).toFixed(1)}반음` : `끝 ${ar} 그림`; };
  INS.endText = endText;
  INS.measNote = (P, sp) => P.measured ? `${WHO[sp || P.sp] || ''} 목소리를 잰 높낮이 · 낱말 자리는 어림` : '그림으로 줄인 모양 · 잰 값 아님';
  // 옥타브를 잘못 고른 듯 크게 튀는 곳(이웃과 7반음 넘게)은 선을 끊어요
  const segsOf = P => {
    const out = []; let cur = [];
    P.pts.forEach((p, i) => {
      const prev = i ? P.pts[i - 1] : null;
      if (!p || (prev && Math.abs(p[1] - prev[1]) > 7)) { if (cur.length > 1) out.push(cur); cur = []; }
      if (p) cur.push(p);
    });
    if (cur.length > 1) out.push(cur);
    return out;
  };
  INS.segsOf = segsOf;
  // 매끈한 곡선(그림): Catmull-Rom → 베지에
  const bez = pts => { const c = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; c.push([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]]); } return c; };
  INS.bez = bez;

  /* ---------- 높낮이 선 그리기 ----------
     x, y = 상자의 왼쪽 위 · w, h = 선이 움직이는 칸. 꺾이는 낱말 칸은 노랗게 깔고, 낱말은 상자 아래에(꺾이는 낱말은 대문자 노랑).
     o.chip: 'top'(상자 위 오른쪽) | 'side'(상자 오른쪽) | false · o.tag: 아래 설명 · o.arrows: 토막마다 ↗ · ↘ 표시 */
  function drawLine(g, P, X, Y, color, lw) {
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    if (P.measured) {
      segsOf(P).forEach(sg => { g.beginPath(); sg.forEach((p, i) => { if (i) g.lineTo(X(p[0]), Y(p[1])); else g.moveTo(X(p[0]), Y(p[1])); }); g.stroke(); });
      return;
    }
    const pts = P.pts.map(p => [X(p[0]), Y(p[1])]);
    g.setLineDash([9, 7]);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); bez(pts).forEach(c => g.bezierCurveTo(...c)); g.stroke();
    g.setLineDash([]);
  }
  function lastPt(P) { for (let i = P.pts.length - 1; i >= 0; i--) if (P.pts[i]) return P.pts[i]; return [1, 0]; }
  function wordLabels(g, P, X, y, size) {
    const right = [-1e9, -1e9];
    P.words.forEach(wd => {
      const s = wd.nuc ? IN.capsW(wd.k, wd.t) : wd.t, wt = wd.nuc ? 800 : 600, cx = (X(wd.a) + X(wd.b)) / 2, ww = tw(g, s, size, wt);
      const row = cx - ww / 2 < right[0] + 5 && cx - ww / 2 >= right[1] + 5 ? 1 : 0;
      right[row] = cx + ww / 2;
      txt(g, s, cx, y + row * (size + 3), { size, weight: wt, color: wd.nuc ? COL.nuc : COL.soft, align: 'center' });
    });
  }
  function pitch(g, text, x, y, w, h, o = {}) {
    const P = o.data || pitchData(text, o), shape = o.shape || IN.shapeOf(text), c = o.color || COL[shape] || COL.yn;
    const [lo, hi] = o.range || stRange(P), lab = o.lab || 15;
    const Y = st => y + h - (clamp(st, lo, hi) - lo) / (hi - lo) * h;
    const X = p => x + 12 + p * (w - 24);
    if (o.bg !== false) { rr(g, x, y - 8, w, h + 16, 10); g.fillStyle = 'rgba(255,255,255,0.035)'; g.fill(); }
    g.strokeStyle = COL.faint; g.lineWidth = 1; g.setLineDash([3, 6]); g.beginPath(); g.moveTo(x + 10, Y(0)); g.lineTo(x + w - 10, Y(0)); g.stroke(); g.setLineDash([]);
    P.words.forEach(wd => { if (!wd.nuc) return; g.fillStyle = hex(COL.nuc, 0.11); g.fillRect(X(wd.a), y - 6, Math.max(6, X(wd.b) - X(wd.a)), h + 12); });
    drawLine(g, P, X, Y, c, o.lw || 4);
    // 끝 화살표
    const lp = lastPt(P), dir = endDir(P, text), ex = X(lp[0]), ey = Y(lp[1]), dy = dir === 'up' ? -1 : 1;
    g.strokeStyle = dir === 'up' ? COL.up : COL.down; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ex + 4, ey); g.lineTo(ex + 16, ey + dy * 12); g.moveTo(ex + 16, ey + dy * 12); g.lineTo(ex + 7, ey + dy * 12); g.moveTo(ex + 16, ey + dy * 12); g.lineTo(ex + 16, ey + dy * 3); g.stroke();
    if (o.arrows) IN.phrases(text, { focus: IN.focusOf(text), shape: o.shape }).forEach(ph => {
      const wd = P.words[ph.w]; if (!wd) return;
      const up = ph.tone === 'rise' || ph.tone === 'high' || ph.tone === 'alt1';
      txt(g, up ? '↗' : '↘', (X(wd.a) + X(wd.b)) / 2, y + 4, { size: 22, weight: 800, color: up ? COL.up : COL.down, align: 'center' });
    });
    if (o.labels !== false) wordLabels(g, P, X, y + h + lab + 4, lab);
    if (o.chip !== false) {
      const s = endText(P, text), cc = dir === 'up' ? COL.up : COL.down, cs = o.chipSize || 14;
      if (o.chip === 'side') chip(g, s, x + w + 10, y + h / 2, { size: cs, color: cc, fill: COL.panel2, stroke: cc, h: cs * 1.9, pad: 9 });
      else chip(g, s, x + w, y - 8 - cs * 1.2, { size: cs, color: cc, fill: COL.panel2, stroke: cc, h: cs * 1.9, pad: 9, align: 'right' });
    }
    if (o.tag !== false) txt(g, INS.measNote(P), x + w, y + h + lab * 2.9 + 6, { size: 12.5, weight: 600, color: COL.muted, align: 'right' });
    if (o.hit !== false) listen(x, y - 8, w, h + 16, say(text, P.sp));
    return P;
  }
  INS.pitch = pitch;

  /* ---------- 문장 쓰기: 꺾이는 낱말은 센 음절을 대문자로, 노랑 + 밑줄. o.arrow: 끝에 모양 화살표 ---------- */
  const WORD_SPLIT = /([A-Za-z]+(?:['’][A-Za-z]+)?)/;
  function sentT(g, text, x, y, size, o = {}) {
    const focus = o.focus === undefined ? IN.focusOf(text) : o.focus, nuc = o.paint === false ? [] : IN.nuclei(text, { focus, shape: o.shape });
    const toks = IN.tokens(text), pcs = []; let k = 0;
    String(text).split(WORD_SPLIT).forEach((p, j) => {
      if (!p) return;
      if (j % 2 === 0) { pcs.push({ s: p, n: false }); return; }
      const t = toks[k++], isN = nuc.indexOf(t.i) >= 0;
      pcs.push({ s: isN ? IN.capsW(t.k, t.t) : p, n: isN });
    });
    const shape = o.shape || IN.shapeOf(text), arrow = o.arrow ? ' ' + IN.SHAPES[shape].arrow : '', wt = o.weight || 600;
    const width = z => pcs.reduce((a, q) => a + tw(g, q.s, z, q.n ? 800 : wt), 0) + (arrow ? tw(g, arrow, z, 800) : 0);
    let sz = size, total = width(sz);
    if (o.maxW && total > o.maxW) { sz = size * o.maxW / total; total = width(sz); }
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const x0 = xx;
    pcs.forEach(q => {
      const ww = txt(g, q.s, xx, y, { size: sz, weight: q.n ? 800 : wt, color: q.n ? COL.nuc : (o.color || COL.text) });
      if (q.n) { g.strokeStyle = COL.nuc; g.lineWidth = Math.max(2, sz * 0.07); g.beginPath(); g.moveTo(xx, y + sz * 0.6); g.lineTo(xx + ww, y + sz * 0.6); g.stroke(); }
      xx += ww;
    });
    if (arrow) txt(g, arrow, xx, y, { size: sz, weight: 800, color: COL[shape] });
    if (o.hit !== false) listen(x0 - 8, y - sz * 0.75, total + 16, sz * 1.6, say(text, o.sp));
    return { x: x0, w: total, size: sz };
  }
  INS.sentT = sentT;
  const shapeTag = (g, shape, x, y, o = {}) => tag(g, `${IN.SHAPES[shape].arrow} ${IN.SHAPES[shape].ko}`, x, y, COL[shape], o);

  /* ---------- 칸 하나: 문장 + 작은 높낮이 선 + 끝 표시 ---------- */
  function cell(g, text, x, y, w, o = {}) {
    const sp = o.sp || INS.bestSp(text), P = pitchData(text, { sp, sch: o.sch, tune: o.tune, shape: o.shape });
    sentT(g, text, x, y, o.size || 24, { maxW: w - 160, sp, arrow: o.arrow, shape: o.shape });
    const d = endDir(P, text), cc = d === 'up' ? COL.up : COL.down;
    chip(g, endText(P, text), x + w, y, { size: 13, color: cc, fill: COL.panel2, stroke: cc, h: 26, pad: 8, align: 'right' });
    if (o.line !== false) pitch(g, text, x, y + 30, w, o.h || 56, { data: P, chip: false, tag: false, lab: o.lab || 12.5, color: o.color, shape: o.shape, arrows: o.arrows, labels: o.labels });
    return P;
  }
  INS.cell = cell;
  // 크게: 문장 · 뜻 · 모양 · 큰 높낮이 선 (직접 해 보기에서 고른 문장도)
  function bigTune(g, text, o = {}) {
    const sp = o.sp || INS.bestSp(text), shape = IN.shapeOf(text);
    sentT(g, text, 640, o.y || 196, o.size || 46, { align: 'center', maxW: 1080, sp, arrow: true, paint: o.paint });
    fade(g, o.meanA == null ? 1 : o.meanA, () => {
      txt(g, IN.meaning(text), 640, (o.y || 196) + 52, { size: 18, weight: 600, color: COL.muted, align: 'center' });
      const f = IN.focusOf(text);
      shapeTag(g, shape, 640, (o.y || 196) + 96, { align: 'center', size: 15, h: 32 });
      if (f) tag(g, `초점 → ${f}`, 820, (o.y || 196) + 96, COL.nuc, { size: 15, h: 32 });
    });
    fade(g, o.lineA == null ? 1 : o.lineA, () => pitch(g, text, 190, (o.y || 196) + 158, 900, o.h || 130, { sp, lab: 17, arrows: o.arrows }));
  }
  INS.bigTune = bigTune;
  // 목소리 넷: 같은 문장을 2 × 2 칸으로
  function voices4(g, text, a) {
    fade(g, a, () => SPS.forEach((sp, i) => {
      const x = 80 + (i % 2) * 580, y = 186 + Math.floor(i / 2) * 196;
      panel(g, x - 16, y - 34, 552, 184, { fill: COL.panel, stroke: COL.faint });
      txt(g, WHO[sp], x, y - 12, { size: 14, weight: 700, color: COL.muted });
      icon(g, 'spk', x + tw(g, WHO[sp], 14, 700) + 16, y - 12, 16, COL.accent);
      const P = pitchData(text, { sp, sch: !passed(sp, text) });
      const d = endDir(P, text), cc = d === 'up' ? COL.up : COL.down;
      chip(g, endText(P, text), x + 520, y - 12, { size: 13, color: cc, fill: COL.panel2, stroke: cc, h: 26, pad: 8, align: 'right' });
      pitch(g, text, x, y + 20, 520, 82, { data: P, chip: false, tag: false, lab: 13, hit: false });
      listen(x - 16, y - 34, 552, 184, [{ text, sp: passed(sp, text) ? sp : INS.bestSp(text) }]);
    }));
  }
  // 두 선 겹치기 (같은 낱말 . ↔ ?): 같은 기준 높이(두 문장 울림의 가운데값)
  function overlay(g, a, b, x, y, w, h, o = {}) {
    const sp = o.sp || INS.passVoices([a, b])[0] || 'tc';
    let A = pitchData(a, { sp }), B = pitchData(b, { sp });
    if (A.measured && B.measured) { const ref = median(A.hz.concat(B.hz)); A = pitchData(a, { sp, ref }); B = pitchData(b, { sp, ref }); }
    const range = stRange(A, B), [lo, hi] = range;
    rr(g, x, y - 8, w, h + 16, 10); g.fillStyle = 'rgba(255,255,255,0.035)'; g.fill();
    const Y = st => y + h - (clamp(st, lo, hi) - lo) / (hi - lo) * h, X = p => x + 12 + p * (w - 24);
    B.words.forEach(wd => { if (wd.nuc) { g.fillStyle = hex(COL.nuc, 0.11); g.fillRect(X(wd.a), y - 6, Math.max(6, X(wd.b) - X(wd.a)), h + 12); } });
    drawLine(g, A, X, Y, COL[IN.shapeOf(a)], 4);
    drawLine(g, B, X, Y, COL[IN.shapeOf(b)], 4);
    wordLabels(g, B, X, y + h + 21, 17);
    [[a, A], [b, B]].forEach(([t, P], k) => {
      const sh = IN.shapeOf(t), d = endDir(P, t), cc = d === 'up' ? COL.up : COL.down;
      const r = tag(g, `${t.slice(-1) === '?' ? '? ' : '. '}${IN.SHAPES[sh].ko}`, x + (k ? 250 : 0), y - 30, COL[sh], { size: 14, h: 28 });
      chip(g, endText(P, t), r.x + r.w + 8, y - 30, { size: 13, color: cc, fill: COL.panel2, stroke: cc, h: 26, pad: 8 });
    });
    txt(g, A.measured && B.measured ? `${WHO[sp]} 목소리를 잰 높낮이 · 기준은 두 문장 울림의 가운데값 · 낱말 자리는 어림` : '그림으로 줄인 모양 · 잰 값 아님', x + w, y + h + 50, { size: 12.5, weight: 600, color: COL.muted, align: 'right' });
    listen(x, y - 8, w / 2, h + 16, [{ text: a, sp }]);
    listen(x + w / 2, y - 8, w / 2, h + 16, [{ text: b, sp }]);
    return [A, B];
  }
  INS.overlay = overlay;

  /* =========================================================
     장(chapter)과 자막. 자막 시각은 장의 시작부터 센 초 (4~7초), 발음 기호는 자막에 쓰지 않음
     영어 낱말 바로 뒤에 조사를 붙이지 않아요(소리 내어 읽을 때 어색해서) — → 나 = 로 이어요.
     ========================================================= */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '올리고 내리기 — 억양과 초점', d: 36, caps: [
      [0.4, 6, "같은 낱말을 두 번 들어 봐요 → It's raining. 그리고 It's raining?"],
      [6, 12, '첫째는 비가 온다고 알려 주는 말이고, 둘째는 비가 온다고요? 하고 되묻는 말이에요.'],
      [12, 18, '아래 선은 목소리의 높낮이예요. 첫째는 끝이 내려가고, 둘째는 끝이 올라가요.'],
      [18, 24, '영어는 높낮이로 뜻을 더해요. 묻는 말인지 알리는 말인지, 어느 낱말이 새 정보인지를 높낮이가 알려 줘요.'],
      [24, 30, '세 단계로 익혀요. 끝의 움직임을 듣고 가르고, 꺾이는 곳에서 높낮이를 만들고, 문장 속에서 초점을 살려요.'],
      [30, 36, '미국 표준 발음을 기준으로 해요. 소리는 모두 합성 음성이고, 규칙은 경향이에요 — 사람과 상황에 따라 달라져요.'],
    ] },
    { id: 'listen', n: '01', title: '들어 보기 · 구별되나요?', sub: '① 듣고 가르기 · 같은 낱말, 다른 끝', d: 40, caps: [
      [0.4, 6, '먼저 귀부터 시험해요. 두 문장은 낱말이 똑같고, 끝의 마침표와 물음표만 달라요.'],
      [6, 12, "눌러서 들어 보세요 → You're a student. · You're a student? 끝에서 소리가 어디로 가나요?"],
      [12, 18, '마침표 쪽은 끝이 내려가고, 물음표 쪽은 끝이 올라가요. 낱말은 같고 끝의 방향만 달라요.'],
      [18, 25, "이 짝도 들어 봐요 → She's at home. · She's at home? 목소리를 바꿔 들어도 끝의 방향은 같아요."],
      [25, 32, '이렇게 평서문 꼴 그대로 끝만 올리면 되묻는 말이 돼요. 놀랐거나 확인하고 싶을 때 써요.'],
      [32, 40, '아래 **끝 올림 · 내림 듣기 훈련**에서 목소리 넷으로 연습해요.'],
    ] },
    { id: 'map', n: '02', title: '억양의 지도', sub: '① 듣고 가르기 · 문장 모양 다섯', d: 42, caps: [
      [0.4, 6, '문장의 모양에 따라 끝의 움직임이 정해져요. 다섯 가지를 지도에 놓아 봐요.'],
      [6, 12, '첫째, Yes/No 질문 → 예나 아니오로 답하는 질문이에요. 끝을 올려요 → Are you ready?'],
      [12, 18, '둘째, 정보 질문 → 의문사로 묻는 질문이에요. 끝을 내려요 → Where are you going?'],
      [18, 24, '셋째, 고르는 질문 → 둘 중 하나를 고르라는 질문이에요. 앞은 올리고 마지막은 내려요 → Is it red or blue?'],
      [24, 30, '넷째, 평서문 → 알려 주는 말이에요. 끝을 내려요 → The store is closed.'],
      [30, 36, "다섯째, 되묻는 말 → 평서문 꼴 그대로 끝만 올려 물어요 → You're leaving?"],
      [36, 42, '정리하면, Yes/No 질문과 되묻는 말은 끝을 올리고, 정보 질문과 평서문은 끝을 내려요.'],
    ] },
    { id: 'nucleus', n: '03', title: '꺾이는 곳', sub: '② 높낮이 만들기 · 마지막 센 음절', d: 42, caps: [
      [0.4, 6, '높낮이는 아무 데서나 크게 움직이지 않아요. 크게 꺾이는 곳이 있어요.'],
      [6, 12, '꺾이는 곳은 보통 마지막 내용어의 센 음절이에요. Are you ready? → 꺾이는 곳 = REAdy.'],
      [12, 18, 'Yes/No 질문은 끝이 올라가요 → Do you like coffee? 꺾이는 곳 = COFfee.'],
      [18, 24, '뒤에 기능어가 붙어도 꺾이는 곳은 그대로예요 → Is it far from here? 꺾이는 곳 = FAR.'],
      [24, 30, '정보 질문도 마찬가지예요 → How was your weekend? 꺾이는 곳 = WEEKend, 끝은 내려가요.'],
      [30, 36, '내용어는 뜻을 싣는 낱말이에요. 명사 · 동사 · 형용사 · 부사처럼요. 기능어는 그 사이를 잇는 짧은 낱말이에요.'],
      [36, 42, '요령 → 꺾이는 곳을 먼저 찾고, 그 음절을 길고 또렷하게 말한 뒤 거기서 올리거나 내려요.'],
    ] },
    { id: 'yn', n: '04', title: 'Yes/No 질문 ↗', sub: '② 높낮이 만들기 · 꺾이는 곳에서부터 올리기', d: 40, caps: [
      [0.4, 6, 'Yes/No 질문을 자세히 봐요. 조동사로 시작하고, 예나 아니오로 답하는 질문이에요.'],
      [6, 12, 'Do you like coffee? → 꺾이는 곳 = COFfee. 거기서부터 끝을 올려요.'],
      [12, 18, '이 질문들도 같아요 → Is this seat taken? · Have you been to Canada?'],
      [18, 25, '목소리 넷으로 들어 보세요. 올라가는 폭은 목소리마다 다르지만 방향은 같아요.'],
      [25, 32, '끝 음절 하나만 살짝 올리지 말고, 꺾이는 곳에서부터 그 뒤를 함께 올려요.'],
      [32, 40, '아래 **따라 말하기**의 Yes/No 질문 일곱 문장으로 연습해요. 꺾이는 곳은 노란 글자예요.'],
    ] },
    { id: 'wh', n: '05', title: '정보 질문 ↘', sub: '② 높낮이 만들기 · 꺾이는 곳에서 내리기', d: 40, caps: [
      [0.4, 6, '정보 질문은 what · where · when · why · who · how 같은 의문사로 시작해요.'],
      [6, 12, 'Where are you going? → 꺾이는 곳 = GOing. 의문사에서 높게 시작해, 끝으로 갈수록 낮아져요.'],
      [12, 18, '이 질문들도 같아요 → What time is it? · Why are you late? 끝을 내려요.'],
      [18, 25, '목소리 넷으로 들어 보세요. 모두 끝이 내려가요. 예나 아니오가 아니라 정보로 답하는 질문이에요.'],
      [25, 32, '묻는 말이니까 끝을 올려야 한다고 생각하기 쉬워요. 그렇게 올리면 되묻는 말처럼 들릴 수 있어요.'],
      [32, 40, '다만 부드럽게 묻거나 다정하게 말할 때는 정보 질문도 끝을 올리기도 해요. 기본은 내림이에요.'],
    ] },
    { id: 'alt', n: '06', title: '고르는 질문 ↗↘', sub: '③ 문장 속에서 · 앞은 올리고 마지막은 내리기', d: 42, caps: [
      [0.4, 6, '둘 중 하나를 고르라는 질문이에요 → Would you like coffee or tea? 선택지마다 한 번씩 꺾여요.'],
      [6, 12, '앞 선택지 COFfee → 높게 두고, 마지막 선택지 TEA → 내려요. 내리는 끝이 선택지가 여기까지라는 신호예요.'],
      [12, 18, '이 질문들도 같아요 → Is it red or blue? · Is it today or tomorrow?'],
      [18, 25, '끝까지 올리면 뜻이 바뀌어요. 커피나 차 같은 마실 것을 원하느냐는 Yes/No 질문이 돼요.'],
      [25, 32, '그래서 대답도 달라져요. 마지막을 내리면 둘 중 하나를 고르고, 끝까지 올리면 예나 아니오로 답해요.'],
      [32, 42, '요령 → 선택지 사이에 살짝 쉬고, 앞은 올리고 마지막은 내려요 → Would you like coffee or tea?'],
    ] },
    { id: 'decl', n: '07', title: '되묻는 말 ↗', sub: '③ 문장 속에서 · 평서문 꼴로 끝만 올리기', d: 40, caps: [
      [0.4, 6, "평서문 꼴 그대로 끝만 올리면 묻는 말이 돼요 → You're leaving? 벌써 가신다고요?"],
      [6, 12, '놀랐을 때나, 들은 것을 확인할 때 써요. 낱말 순서는 바꾸지 않아요.'],
      [12, 18, "두 선을 겹쳐 봐요 → You're leaving. · You're leaving? 끝이 어디로 가나요?"],
      [18, 25, '꺾이는 곳 = LEAVing. 거기서 하나는 내려가고, 하나는 올라가요.'],
      [25, 32, '이 문장들도 들어 보세요 → The store is closed? · He likes coffee?'],
      [32, 40, '요령 → 되묻는 말은 낱말 순서를 그대로 두고, 꺾이는 곳에서부터 크게 올려요.'],
    ] },
    { id: 'focus', n: '08', title: '초점 — 고쳐 말하는 낱말', sub: '③ 문장 속에서 · 새 정보를 가장 높게', d: 44, caps: [
      [0.4, 6, '꺾이는 곳은 옮길 수 있어요. 고쳐 말하거나 견줄 때는 새 정보인 낱말로 옮겨요.'],
      [6, 12, 'I said Tuesday, not Monday. → 월요일이 아니라 화요일이라고 했다는 말이에요. 꺾이는 곳 = TUESday.'],
      [12, 18, '선을 보세요. 가장 높이 솟는 곳 = TUESday. 뒤의 not Monday → 낮게 눌러 말해요.'],
      [18, 24, "이 문장들도 같아요 → It's ten dollars, not twenty. · We meet at seven, not eight."],
      [24, 31, '연구에서 원어민은 Yes/No 질문의 초점 낱말을 낮게 시작해 끝을 올렸고, 한국인 화자는 초점 낱말에 높은 소리를 얹는 경향을 보였어요.'],
      [31, 38, '한국인 청자는 낮게 시작하는 초점을 알아듣기 어려워했어요. 억양 곡선으로 설명하자 알아듣기가 나아졌다는 연구도 있어요.'],
      [38, 44, '요령 → 고쳐 말하는 낱말을 가장 높고 길게 말하고, 그 뒤는 낮게 눌러요.'],
    ] },
    { id: 'summary', n: '09', title: '정리', sub: '3단계 발음법 · 억양과 초점', d: 36, caps: [
      [0.4, 6, '정리해요. ① 듣고 가르기 → 끝이 올라가나 내려가나를 들어요.'],
      [6, 12, '② 높낮이 만들기 → 꺾이는 곳은 마지막 내용어의 센 음절이에요. 거기서부터 올리거나 거기서 내려요.'],
      [12, 18, 'Yes/No 질문과 되묻는 말은 올리고, 정보 질문과 평서문은 내려요. 고르는 질문은 앞을 올리고 마지막을 내려요.'],
      [18, 24, '③ 문장 속에서 → 고쳐 말하는 낱말로 꺾이는 곳을 옮기고, 그 뒤는 낮게 눌러요.'],
      [24, 30, '목표는 원어민과 똑같은 선이 아니라, 묻는 말인지 알리는 말인지가 또렷하게 들리는 말이에요.'],
      [30, 36, '아래 **끝 올림 · 내림 듣기 훈련**과 **억양 바꾸기 실험실**에서 직접 해 보세요.'],
    ] },
  ];
  let acc = 0;
  CHAPTERS.forEach(c => { c.t = acc; acc += c.d; });
  const END = acc;
  const CAPTIONS = [];
  CHAPTERS.forEach(c => c.caps.forEach(([s, e, text]) => CAPTIONS.push([+(c.t + s).toFixed(2), +(c.t + e).toFixed(2), text])));
  INS.CHAPTERS = CHAPTERS; INS.CAPTIONS = CAPTIONS; INS.END = END;
  INS.POSTER = CHAPTERS.find(c => c.id === 'intro').t + 15;
  INS.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  INS.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  /* ---------- 장면 그리기 ---------- */
  const LX = 80;
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, LX, 70, { size: fit(g, `${ch.n} · ${ch.sub}`, 15, 760, 500, 11, FM), weight: 500, fam: FM, color: COL.accent });
    txt(g, ch.title, LX, 112, { size: fit(g, ch.title, 38, 700, 800, 24, FD), weight: 800, fam: FD });
  }
  // 오른쪽 위 범례 (모양 이름)
  function legend(g, a, shapes) {
    fade(g, a, () => {
      let x = 1200;
      shapes.slice().reverse().forEach(k => {
        const s = k === 'ko' ? '한국어식 (그림)' : k === 'nuc' ? '꺾이는 곳' : `${IN.SHAPES[k].arrow} ${IN.SHAPES[k].ko}`;
        const r = tag(g, s, x, 92, COL[k], { align: 'right', size: 14, h: 28 }); x = r.x - 8;
      });
    });
  }
  // 선 설명 (오른쪽 위, 범례 아래)
  const lineNote = (g, a, texts) => fade(g, a, () => txt(g, texts.some(t => passed(INS.bestSp(t), t)) ? '선 = 이 목소리를 잰 높낮이 · 낱말 자리는 어림' : '선 = 그림으로 줄인 모양 · 잰 값 아님', 1200, 136, { size: 13, weight: 600, color: COL.muted, align: 'right' }));
  // 말하는 소리 표시 (누르기 전)
  const spk = (g, x, y, u, k = 0) => icon(g, 'spk', x, y, 40, hex(COL.accent, 0.5 + 0.5 * Math.max(0, Math.sin(u * 3 + k))));
  const voiceRow = (g, x, y, texts, seqOf, o = {}) => INS.passVoices(texts).forEach((sp, i) => {
    const cx = x + i * (o.step || 140), hl = (S.voice || 'tc') === sp;
    const c = chip(g, WHO[sp], cx, y, { size: o.size || 14, fill: COL.panel2, stroke: hl ? COL.accent : COL.line, align: 'center', pad: 26, h: o.h || 32 });
    icon(g, 'spk', c.x + 15, y, 15, COL.accent);
    listen(c.x, c.y, c.w, c.h, seqOf(sp));
  });
  // 모든 목소리를 통과한 문장 (목소리 넷 보기) — 없으면 첫 문장
  const all4 = list => list.find(t => SPS.every(sp => passed(sp, t))) || list[0];
  INS.all4 = all4;
  // 그림 칸 (한국어식 · 다른 뜻): 제목 + 그림 선 + 설명
  function schPanel(g, text, x, y, w, head, color, o = {}) {
    panel(g, x, y, w, 330, { fill: COL.panel, stroke: o.stroke || COL.faint, dash: !!o.dash });
    txt(g, head, x + 26, y + 30, { size: fit(g, head, 16, w - 52, 700), weight: 700, color });
    sentT(g, text, x + w / 2, y + 82, 30, { align: 'center', maxW: w - 60, hit: o.hit, shape: o.shape, paint: o.paint });
    pitch(g, text, x + 30, y + 140, w - 60, 100, { sch: o.sch !== false, tune: o.tune, shape: o.shape, color, chip: false, tag: false, lab: 14, hit: o.hit, arrows: o.arrows });
    txt(g, o.note || '그림으로 줄인 모양 · 잰 값 아님', x + w - 26, y + 306, { size: 12.5, weight: 600, color: COL.muted, align: 'right' });
  }

  const SCENES = {
    /* 00 들어가며 */
    intro(g, u) {
      const A = 1 - ramp(u, 23.6, 0.5), [a, b] = IN.INTRO;
      legend(g, A * ramp(u, 12, 0.5), ['stmt', 'decl', 'nuc']);
      [[a, 60, 'stmt', '알려 주는 말'], [b, 660, 'decl', '되묻는 말']].forEach(([t, x, sh, head], k) => fade(g, A * ramp(u, 0.4 + k * 0.6, 0.6), () => {
        panel(g, x, 150, 560, 380, { fill: COL.panel, stroke: COL.faint });
        txt(g, head, x + 30, 180, { size: 15, weight: 700, color: COL[sh] });
        sentT(g, t, x + 280, 236, 50, { align: 'center', paint: u >= 12, maxW: 500 });
        fade(g, ramp(u, 6, 0.5), () => txt(g, IN.meaning(t), x + 280, 288, { size: 18, weight: 600, color: COL.muted, align: 'center' }));
        if (u < 12) spk(g, x + 280, 400, u, k);
        fade(g, ramp(u, 12, 0.5), () => pitch(g, t, x + 40, 354, 480, 92, { lab: 15, chip: 'top', tag: false }));
      }));
      fade(g, A * ramp(u, 12, 0.5), () => lineNote(g, 1, IN.INTRO));
      fade(g, A * win(u, 18, 23.8), () => chip(g, '높낮이 → 묻는 말인지 · 알리는 말인지 · 어느 낱말이 새 정보인지', 640, 566, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
      const steps = [['ear', '① 듣고 가르기', '끝이 올라가나 · 내려가나'], ['tune', '② 높낮이 만들기', '꺾이는 곳에서 올리기 · 내리기'], ['focus', '③ 문장 속에서', '초점 · 고르는 질문 · 되묻기']];
      steps.forEach(([ic, h, s], i) => fade(g, ramp(u, 24.2 + i * 0.6, 0.5), () => {
        const x = 110 + i * 360;
        panel(g, x, 200, 340, 190, { fill: COL.panel, stroke: COL.faint });
        circ(g, x + 170, 252, 30, COL.panel2); icon(g, ic, x + 170, 252, 32, COL.accent);
        txt(g, h, x + 170, 314, { size: 22, weight: 800, color: COL.text, align: 'center' });
        txt(g, s, x + 170, 352, { size: fit(g, s, 16, 310, 500), weight: 500, color: COL.soft, align: 'center' });
      }));
      fade(g, ramp(u, 30, 0.5), () => chip(g, '미국 표준 발음(General American) · 합성 음성 · 규칙은 경향이에요', 640, 460, { size: 16, weight: 600, color: COL.muted, fill: COL.panel2, align: 'center' }));
    },

    /* 01 들어 보기 · 구별되나요? */
    listen(g, u) {
      const sp = S.voice || null, rows = IN.DECL.slice(1, 1 + IN.LISTEN_SHOWN), AT0 = [0.4, 18, 18.4];
      legend(g, ramp(u, 0.4, 0.5), ['stmt', 'decl', 'nuc']);
      lineNote(g, ramp(u, 12, 0.5), [].concat(...rows));
      rows.forEach(([a, b], i) => fade(g, ramp(u, AT0[i], 0.5), () => {
        const y = 186 + i * 128, hl = (i === 0 && u >= 6 && u < 18) || (i === 1 && u >= 18 && u < 25);
        panel(g, 64, y - 36, 1152, 124, { fill: hl ? hex(COL.decl, 0.05) : COL.panel, stroke: hl ? COL.decl : COL.faint });
        const vs = INS.passVoices([a, b]), s2 = sp && vs.indexOf(sp) >= 0 ? sp : vs[0] || 'tc';
        [[a, 84], [b, 664]].forEach(([t, x]) => {
          if (i === 0 && u < 12) { sentT(g, t, x, y, 24, { sp: s2, paint: false }); spk(g, x + 470, y + 40, u, x > 600 ? 1 : 0); return; }
          cell(g, t, x, y, 530, { sp: s2, h: 30, lab: 12 });
        });
      }));
      fade(g, win(u, 18, 25.2), () => voiceRow(g, 640 - 210, 566, IN.DECL[2], v => [{ text: IN.DECL[2][0], sp: v }, { text: IN.DECL[2][1], sp: v, gap: 0.8 }]));
      fade(g, win(u, 25, 32.2), () => chip(g, '평서문 꼴 + 끝 올림 → 되묻는 말 (놀람 · 확인)', 640, 566, { size: 17, color: COL.decl, fill: COL.panel2, stroke: COL.decl, align: 'center', h: 36 }));
      fade(g, ramp(u, 32, 0.5), () => chip(g, '아래 끝 올림 · 내림 듣기 훈련 — 목소리 넷', 640, 566, { size: 17, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 36 }));
    },

    /* 02 억양의 지도 */
    map(g, u) {
      if (S.sent) { legend(g, 1, IN.SHAPE_ORDER); bigTune(g, S.sent, { sp: S.voice ? S.voice : undefined, arrows: IN.shapeOf(S.sent) === 'alt' }); return; }
      legend(g, ramp(u, 0.4, 0.5), IN.SHAPE_ORDER);
      const NUM = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
      const pos = i => i < 3 ? [80 + i * 380, 150] : [270 + (i - 3) * 380, 352];
      IN.MAP.forEach((m, i) => fade(g, ramp(u, 6 + i * 6, 0.5), () => {
        const [x, y] = pos(i), c = COL[m.shape], sh = IN.SHAPES[m.shape], ex = m.ex[0];
        const hl = u >= 6 + i * 6 && u < 12 + i * 6 || (u >= 36 && (m.shape === 'yn' || m.shape === 'decl'));
        panel(g, x, y, 360, 186, { fill: hl ? hex(c, 0.07) : COL.panel, stroke: hl ? c : COL.faint });
        g.fillStyle = c; g.fillRect(x, y + 14, 5, 158);
        txt(g, NUM[i], x + 24, y + 26, { size: 13.5, weight: 700, color: COL.muted });
        txt(g, `${sh.ko} ${sh.arrow}`, x + 24, y + 56, { size: 24, weight: 800, color: c });
        const rule = sh.long.split(' — ')[1] || sh.long;
        txt(g, rule, x + 24, y + 88, { size: fit(g, rule, 15, 320, 500), weight: 500, color: COL.soft });
        const P = pitchData(ex);
        sentT(g, ex, x + 24, y + 120, 20, { maxW: 220 });
        const d = endDir(P, ex), cc = d === 'up' ? COL.up : COL.down;
        chip(g, endText(P, ex).replace('반음', ''), x + 340, y + 120, { size: 12, color: cc, fill: COL.panel2, stroke: cc, h: 24, pad: 7, align: 'right' });
        pitch(g, ex, x + 20, y + 140, 320, 30, { data: P, chip: false, tag: false, labels: false, lw: 3 });
      }));
      IN.MAP.forEach((m, i) => fade(g, ramp(u, 1.2, 0.4) * (1 - ramp(u, 6 + i * 6, 0.4)), () => { const [x, y] = pos(i); panel(g, x, y, 360, 186, { fill: 'rgba(0,0,0,0)', stroke: COL.faint, dash: true }); }));
      fade(g, ramp(u, 6, 0.5), () => lineNote(g, 1, IN.MAP.map(m => m.ex[0])));
      fade(g, ramp(u, 36, 0.5), () => chip(g, '올림 ↗ = Yes/No 질문 · 되묻는 말    내림 ↘ = 정보 질문 · 평서문', 640, 566, { size: 16.5, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 03 꺾이는 곳 */
    nucleus(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['nuc', 'yn', 'wh']);
      if (S.sent) { bigTune(g, S.sent, { sp: S.voice || undefined, arrows: IN.shapeOf(S.sent) === 'alt' }); return; }
      const AT0 = [0.4, 12, 18, 24];
      lineNote(g, ramp(u, 6, 0.5), IN.NUC);
      IN.NUC.forEach((t, i) => fade(g, ramp(u, AT0[i], 0.5), () => {
        const y = 194 + i * 98, hl = u >= AT0[i] + (i ? 0 : 5.6) && u < (AT0[i + 1] || 30);
        panel(g, 64, y - 40, 1152, 90, { fill: hl ? hex(COL.nuc, 0.05) : COL.panel, stroke: hl ? COL.nuc : COL.faint });
        sentT(g, t, 90, y, 28, { maxW: 400, paint: i > 0 || u >= 6 });
        const P = pitchData(t);
        if (i > 0 || u >= 6) {
          pitch(g, t, 520, y - 28, 520, 46, { data: P, chip: false, tag: false, lab: 12 });
          const d = endDir(P, t), cc = d === 'up' ? COL.up : COL.down;
          chip(g, endText(P, t), 1196, y - 6, { size: 13, color: cc, fill: COL.panel2, stroke: cc, h: 26, pad: 8, align: 'right' });
        }
      }));
      fade(g, win(u, 30, 36.2), () => chip(g, '내용어 = 뜻을 싣는 낱말 (명사 · 동사 · 형용사 · 부사)   기능어 = 잇는 짧은 낱말 (are · you · from · your)', 640, 566, { size: 15, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 34 }));
      fade(g, ramp(u, 36, 0.5), () => chip(g, '요령 → 꺾이는 곳 찾기 · 길고 또렷하게 · 거기서 올리거나 내리기', 640, 566, { size: 16.5, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 04 Yes/No 질문 */
    yn(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['yn', 'nuc']);
      if (S.sent) { bigTune(g, S.sent, { sp: S.voice || undefined }); return; }
      const big = 'Do you like coffee?';
      fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, 11.6, 0.4)), () => bigTune(g, big, { meanA: 1, lineA: ramp(u, 6, 0.5), paint: u >= 6 }));
      fade(g, win(u, 12, 18.2), () => ['Is this seat taken?', 'Have you been to Canada?'].forEach((t, k) => {
        panel(g, 64 + k * 580, 170, 572, 220, { fill: COL.panel, stroke: COL.faint });
        cell(g, t, 90 + k * 580, 214, 520, { h: 110, lab: 14 });
      }));
      voices4(g, all4(IN.YN), win(u, 18, 25.2));
      fade(g, ramp(u, 25, 0.5), () => IN.YN.forEach((t, i) => {
        const x = 84 + (i % 2) * 580, y = 168 + Math.floor(i / 2) * 130;
        cell(g, t, x, y, 530, { h: 48, lab: 12 });
      }));
      fade(g, ramp(u, 6, 0.5), () => lineNote(g, 1, IN.YN));
      fade(g, win(u, 25, 32.2), () => chip(g, '끝 음절만 살짝 ↗ 말고 → 꺾이는 곳에서부터 그 뒤를 함께 ↗', 640, 566, { size: 16.5, color: COL.yn, fill: COL.panel2, stroke: COL.yn, align: 'center', h: 34 }));
      fade(g, ramp(u, 32, 0.5), () => chip(g, '따라 말하기 → Yes/No 질문 일곱 문장 · 노란 글자 = 꺾이는 곳', 640, 566, { size: 16.5, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 05 정보 질문 */
    wh(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['wh', 'nuc', 'ko']);
      if (S.sent) { bigTune(g, S.sent, { sp: S.voice || undefined }); return; }
      const big = 'Where are you going?';
      fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, 11.6, 0.4)), () => bigTune(g, big, { lineA: ramp(u, 6, 0.5), paint: u >= 6 }));
      fade(g, win(u, 12, 18.2), () => ['What time is it?', 'Why are you late?'].forEach((t, k) => {
        panel(g, 64 + k * 580, 170, 572, 220, { fill: COL.panel, stroke: COL.faint });
        cell(g, t, 90 + k * 580, 214, 520, { h: 110, lab: 14 });
      }));
      voices4(g, all4(IN.WH), win(u, 18, 25.2));
      fade(g, ramp(u, 6, 0.5) * (1 - ramp(u, 24.6, 0.4)), () => lineNote(g, 1, IN.WH));
      fade(g, ramp(u, 25, 0.5), () => {
        schPanel(g, big, 64, 160, 560, '영어 — 꺾이는 곳에서 ↘', COL.wh, { sch: false, hit: undefined, note: INS.measNote(pitchData(big)) });
        schPanel(g, big, 656, 160, 560, '끝을 올림 ↗ → 되묻는 말처럼 들릴 수 있어요', COL.ko, { tune: 'rise', hit: false, dash: true, stroke: COL.ko });
      });
      fade(g, ramp(u, 32, 0.5), () => chip(g, '부드럽게 · 다정하게 물을 때는 올리기도 해요 — 기본은 내림 ↘', 640, 566, { size: 16.5, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 06 고르는 질문 */
    alt(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['alt', 'yn', 'nuc']);
      if (S.sent) { bigTune(g, S.sent, { sp: S.voice || undefined, arrows: IN.shapeOf(S.sent) === 'alt' }); return; }
      fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, 11.6, 0.4)), () => bigTune(g, 'Would you like coffee or tea?', { arrows: u >= 6, paint: true }));
      fade(g, win(u, 12, 18.2), () => ['Is it red or blue?', 'Is it today or tomorrow?'].forEach((t, k) => {
        panel(g, 64 + k * 580, 170, 572, 220, { fill: COL.panel, stroke: COL.faint });
        cell(g, t, 90 + k * 580, 214, 520, { h: 110, lab: 14, arrows: true });
      }));
      const L = 'Would you like coffee or tea?';
      fade(g, win(u, 18, 32.2), () => {
        schPanel(g, L, 64, 160, 560, '마지막을 내림 ↗↘ → 둘 중 하나를 골라요', COL.alt, { sch: !passed(INS.bestSp(L), L), arrows: true, note: INS.measNote(pitchData(L)) });
        schPanel(g, L, 656, 160, 560, '끝까지 올림 ↗ → 예 · 아니오로 답해요 (마실 것을 원하나요?)', COL.yn, { shape: 'yn', hit: false, dash: true, stroke: COL.yn });
      });
      fade(g, ramp(u, 32, 0.5), () => bigTune(g, L, { arrows: true }));
      fade(g, ramp(u, 0.4, 0.5), () => lineNote(g, 1, IN.ALT));
      fade(g, ramp(u, 32, 0.5), () => chip(g, '요령 → 선택지 사이에 살짝 쉬기 · 앞 ↗ · 마지막 ↘', 640, 566, { size: 16.5, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 07 되묻는 말 */
    decl(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['stmt', 'decl', 'nuc']);
      if (S.pair != null) {
        const [a, b] = IN.DECL[S.pair];
        sentT(g, a, 340, 190, 34, { align: 'center', maxW: 520 }); sentT(g, b, 940, 190, 34, { align: 'center', maxW: 520 });
        txt(g, IN.meaning(a), 340, 236, { size: 16, weight: 600, color: COL.muted, align: 'center' }); txt(g, IN.meaning(b), 940, 236, { size: 16, weight: 600, color: COL.muted, align: 'center' });
        overlay(g, a, b, 190, 330, 900, 150, { sp: S.voice || undefined });
        return;
      }
      const P0 = IN.DECL[5];
      fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, 11.6, 0.4)), () => bigTune(g, P0[1], { lineA: ramp(u, 0.9, 0.5) }));
      fade(g, win(u, 12, 25.2), () => {
        sentT(g, P0[0], 340, 190, 34, { align: 'center', maxW: 520 }); sentT(g, P0[1], 940, 190, 34, { align: 'center', maxW: 520 });
        overlay(g, P0[0], P0[1], 190, 320, 900, 160);
      });
      fade(g, ramp(u, 25, 0.5), () => ['The store is closed?', 'He likes coffee?'].forEach((t, k) => {
        panel(g, 64 + k * 580, 170, 572, 252, { fill: COL.panel, stroke: COL.faint });
        cell(g, t, 90 + k * 580, 214, 520, { h: 110, lab: 14 });
        txt(g, IN.meaning(t), 90 + k * 580, 402, { size: 15, weight: 600, color: COL.muted });
      }));
      fade(g, ramp(u, 0.9, 0.5), () => lineNote(g, 1, IN.DECL[5].concat(['The store is closed?', 'He likes coffee?'])));
      fade(g, ramp(u, 32, 0.5), () => chip(g, '요령 → 낱말 순서는 그대로 · 꺾이는 곳에서부터 크게 ↗', 640, 566, { size: 16.5, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 }));
    },

    /* 08 초점 */
    focus(g, u) {
      legend(g, ramp(u, 0.4, 0.5), ['stmt', 'nuc', 'ko']);
      if (S.sent) { bigTune(g, S.sent, { sp: S.voice || undefined }); return; }
      const big = IN.FOCUS[0];
      fade(g, ramp(u, 0.4, 0.5) * (1 - ramp(u, 17.6, 0.4)), () => {
        bigTune(g, big, { paint: u >= 6, meanA: ramp(u, 6, 0.5), lineA: ramp(u, 12, 0.5) });
        fade(g, ramp(u, 12, 0.5), () => chip(g, '가장 높이 = 초점 · 뒤는 낮게 눌러요', 640, 566, { size: 16.5, color: COL.nuc, fill: COL.panel2, stroke: COL.nuc, align: 'center', h: 34 }));
      });
      fade(g, win(u, 18, 24.2), () => IN.FOCUS.slice(1, 3).forEach((t, k) => {
        panel(g, 64 + k * 580, 170, 572, 252, { fill: COL.panel, stroke: COL.faint });
        cell(g, t, 90 + k * 580, 214, 520, { h: 110, lab: 14 });
        txt(g, IN.meaning(t), 90 + k * 580, 402, { size: 15, weight: 600, color: COL.muted });
      }));
      fade(g, ramp(u, 12, 0.5) * (1 - ramp(u, 23.6, 0.4)), () => lineNote(g, 1, IN.FOCUS.slice(0, 3)));
      // 24 ~ 38: 연구 — Yes/No 질문의 초점 (그림)
      const R = 'Is it today?';
      fade(g, win(u, 24, 38.2), () => {
        schPanel(g, R, 64, 150, 560, '원어민 — 초점 낱말을 낮게 시작해 끝까지 ↗', COL.yn, { tune: 'rise', hit: false });
        schPanel(g, R, 656, 150, 560, '한국인 화자 — 초점 낱말에 높은 소리 (경향)', COL.ko, { tune: 'ko', hit: false, dash: true, stroke: COL.ko });
        chip(g, u < 31 ? '연구 → 전윤실 · 오세풍 · 김기호 (2004), 음성과학' : '연구 → 억양 곡선으로 설명하자 알아듣기가 나아졌어요 (Kim · Jeon 2009)', 640, 520, { size: 15, color: COL.soft, fill: COL.panel2, stroke: COL.faint, align: 'center', h: 32 });
      });
      fade(g, ramp(u, 38, 0.5), () => {
        bigTune(g, big, {});
        chip(g, '요령 → 고쳐 말하는 낱말을 가장 높고 길게 · 그 뒤는 낮게', 640, 566, { size: 16.5, color: COL.accent, fill: COL.panel2, stroke: COL.accent, align: 'center', h: 34 });
      });
    },

    /* 09 정리 */
    summary(g, u) {
      const Y0 = 145;
      fade(g, ramp(u, 0.3, 0.5), () => panel(g, 60, Y0, 1160, 330, { fill: COL.panel, stroke: COL.faint }));
      const rows = [
        ['① 듣고 가르기', [['끝이 올라가나 ↗', COL.up], [' · 내려가나 ↘', COL.down]], 0.4],
        ['② 높낮이 만들기', [['꺾이는 곳 = 마지막 내용어의 센 음절', COL.nuc]], 6],
        ['', [['↗ Yes/No 질문 · 되묻는 말', COL.yn], ['   ↘ 정보 질문 · 평서문', COL.wh], ['   ↗↘ 고르는 질문', COL.alt]], 12],
        ['③ 문장 속에서', [['고쳐 말하는 낱말 = 가장 높게', COL.nuc], [' · 그 뒤는 낮게', COL.soft]], 18],
      ];
      rows.forEach(([h, parts, at], i) => fade(g, ramp(u, at, 0.5), () => {
        const y = Y0 + 48 + i * 76;
        txt(g, h, 96, y, { size: 20, weight: 800, color: COL.text });
        let x = 330;
        parts.forEach(([s, c]) => { x += txt(g, s, x, y, { size: fit(g, s, 20, 440, 700), weight: 700, color: c }); });
        if (i < rows.length - 1) { g.fillStyle = COL.faint; g.fillRect(96, y + 38, 1088, 1); }
      }));
      fade(g, ramp(u, 24, 0.5), () => {
        const ex = ['Are you ready?', 'Where are you going?', 'Is it red or blue?', "It's raining?"];
        let x = 110;
        ex.forEach(t => { const r = sentT(g, t, x, 516, 22, { arrow: true }); x += r.w + 44; });
      });
      fade(g, ramp(u, 30, 0.5), () => txt(g, '목표 = 묻는 말인지 알리는 말인지 또렷하게 들리는 말', 640, 566, { size: 17, weight: 700, color: COL.soft, align: 'center' }));
    },
  };
  INS.SCENES = SCENES;
  // 문장 고르기 (영상에 나오는 문장 + 따라 말하기) — 직접 해 보기
  INS.SENT_POOL = IN.SENT_ALL.map(s => s.en);

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
    return lines.length;
  }
  INS.captionLines = (g, text) => drawCaption(g, text);

  INS.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[INS.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u, t);
    g.restore();
    if (opt.caption) drawCaption(g, INS.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  /* ---------- HTML용 높낮이 선 (SVG) — 놀이터 · 연습 문제 · 따라 말하기. 색은 페이지 CSS(.pl-*)가 정해요 ----------
     o: { sp, w, h, sch, tune, shape, data, data2/text2(겹쳐 그릴 둘째 선), caption, labels } */
  INS.pitchSVG = function (text, o = {}) {
    const P = o.data || pitchData(text, o), P2 = o.text2 ? (o.data2 || pitchData(o.text2, { sp: P.sp })) : null;
    const Wd = o.w || 320, h = o.h || 74, top = 10, labH = o.labels === false ? 4 : 34, Hh = top + h + labH;
    const [lo, hi] = P2 ? stRange(P, P2) : stRange(P);
    const Y = st => top + h - (clamp(st, lo, hi) - lo) / (hi - lo) * h, X = p => 8 + p * (Wd - 16);
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const path = Q => {
      if (Q.measured) return segsOf(Q).map(sg => sg.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('')).join('');
      const pts = Q.pts.map(p => [X(p[0]), Y(p[1])]);
      return `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}` + bez(pts).map(c => `C${c.map(v => v.toFixed(1)).join(' ')}`).join('');
    };
    const shp = (Q, t) => Q.shape || (Q.tune === 'ko' ? 'ko' : IN.shapeOf(t));
    let s = `<rect class="pl-bg" x="2" y="${top - 6}" width="${Wd - 4}" height="${h + 12}" rx="8"/><line class="pl-mid" x1="8" x2="${Wd - 8}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>`;
    P.words.forEach(wd => { if (wd.nuc) s += `<rect class="pl-nuc" x="${X(wd.a).toFixed(1)}" y="${top - 4}" width="${Math.max(5, X(wd.b) - X(wd.a)).toFixed(1)}" height="${h + 8}"/>`; });
    if (P2) s += `<path class="pl-line s-${shp(P2, o.text2)}${P2.measured ? '' : ' sch'}" d="${path(P2)}"/>`;
    s += `<path class="pl-line s-${shp(P, text)}${P.measured ? '' : ' sch'}" d="${path(P)}"/>`;
    if (o.labels !== false) {
      const right = [-1e9, -1e9];
      P.words.forEach(wd => {
        const lab = wd.nuc ? IN.capsW(wd.k, wd.t) : wd.t, cx = X((wd.a + wd.b) / 2), ww = lab.length * 7.4 + 2;
        const row = cx - ww / 2 < right[0] + 4 && cx - ww / 2 >= right[1] + 4 ? 1 : 0;
        right[row] = cx + ww / 2;
        s += `<text class="pl-w${wd.nuc ? ' nuc' : ''}" x="${clamp(cx, ww / 2, Wd - ww / 2).toFixed(1)}" y="${top + h + 18 + row * 14}" text-anchor="middle">${esc(lab)}</text>`;
      });
    }
    const label = `${text}${P2 ? ' · ' + o.text2 : ''} — 높낮이 선, ${endText(P, text)}${P2 ? ' · ' + endText(P2, o.text2) : ''} (${P.measured ? '잰 값' : '그림으로 줄인 모양'})`;
    const svg = `<svg class="pline" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="${esc(label)}">${s}</svg>`;
    const cap = o.caption != null ? o.caption : INS.measNote(P);
    return `<span class="pfig">${svg}${cap ? `<small class="meas">${esc(cap)}</small>` : ''}</span>`;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용)
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + IN.allText() + Object.values(WHO).join('') +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·()[]→←↔↗↘≈≠✓✕×?!~=+-–—/:…‘’“”\'%&<>|반음끝그림첫째둘째셋째넷째다섯째';
  INS.baseText = EXTRA;
  INS.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set(), saved = INS.DEFAULTS;
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      const keep = JSON.stringify(S); Object.assign(S, JSON.parse(saved));
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { INS.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; Object.assign(S, JSON.parse(keep)); }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
})();
