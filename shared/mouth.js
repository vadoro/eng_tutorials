/* 영어 튜토리얼 공통 부품: 입 그림 (EN.mouth) — 영어 발음 영역(pron)
 *
 * 세 가지 그림을 캔버스에 그려요. 모두 시간 t와 자세(pose)만의 함수라 같은 값이면 언제나 같은 그림이에요.
 *
 *   EN.mouth.draw(g, x, y, s, pose, opt)  입 옆 단면도. 얼굴이 왼쪽을 봐요. 상자 400 × 360(s = 1일 때)
 *   EN.mouth.top(g, x, y, s, pose, opt)   위에서 본 혀와 윗니(혀가 어디에 닿고 공기가 어디로 나가나). 상자 200 × 220
 *   EN.mouth.lips(g, x, y, s, pose, opt)  입술 앞모습. 상자 200 × 140
 *
 * 자세(pose)는 이름('l' · 'r' · 'flap' …)이나 { T, B, F, D, K, R, U, jaw, round, top } 객체예요.
 *   T 혀끝 · B 혀날 · F 혀 앞 · D 혀 몸통 · K 혀 뒤 · R 혀뿌리 · U 혀끝 아랫면 — 상자 좌표 [x, y]
 *   jaw 턱 벌림 0~1 · round 입술 모으기 0~1 · top 위에서 본 닿는 곳('tip' 혀끝 가운데 · 'sides' 양옆 · 'none')
 *   EN.mouth.mix(a, b, k)로 두 자세 사이를 k(0~1)만큼 섞어요(영상에서 자세가 바뀔 때).
 *
 * EN.mouth.contact(pose) — 혀가 입천장에 닿는지 계산해요: { touch, at, where: '윗잇몸' | '센입천장' | '여린입천장', gap }
 *   그림의 ‘닿음 · 안 닿음’ 표시와 튜토리얼의 데이터 점검(check)이 같은 계산을 써요.
 *
 * opt: { pal: 색(기본은 어두운 무대용), air: 'center' | 'side' | null, voice: 위상(숫자면 목 울림 물결),
 *        mark: 닿는 곳 · 틈 표시 색, labels: true | ['ridge', …], font: (크기, 굵기) => 글꼴 문자열, t: 초(움직임) }
 */
(function () {
  'use strict';
  var EN = (window.EN = window.EN || {});

  // ── 고정된 부분(상자 좌표, 얼굴이 왼쪽) ─────────────────────────────
  var RIDGE = [[104, 112], [112, 107], [124, 103], [137, 98]];          // 윗니 뒤 → 윗잇몸
  var HARD = [[137, 98], [160, 90], [190, 84], [222, 83], [246, 88]];     // 센입천장
  var SOFT = [[246, 88], [265, 97], [280, 113], [288, 133], [287, 146]];  // 여린입천장 → 목젖 끝
  var ROOF = RIDGE.concat(HARD.slice(1), SOFT.slice(1));
  var BACKWALL = [[300, 74], [312, 110], [316, 170], [313, 240], [306, 300], [303, 360]];

  var DARK = {
    skin: '#2B3646', skinLine: '#7D90A8', inner: '#121A24', tongue: '#D9768E', tongueLine: '#F4A7B9',
    teeth: '#E9EEF3', teethLine: '#9AA8B8', label: '#C9D4E0', faint: '#5D6E84', air: '#8FD8FF', voice: '#C9A7FF',
  };
  var LIGHT = {
    skin: '#E7EBF0', skinLine: '#6B7B8E', inner: '#FFFFFF', tongue: '#E58AA0', tongueLine: '#B4506A',
    teeth: '#FFFFFF', teethLine: '#8C99A8', label: '#2A3442', faint: '#A3AFBD', air: '#2266C4', voice: '#6A45C2',
  };

  // ── 자세 ─────────────────────────────────────────────────────────
  // 숫자는 400 × 360 상자 기준. 혀끝이 윗잇몸에 닿는 자리는 대략 (121, 105)
  var P = {
    rest:  { T: [112, 172], B: [134, 160], F: [168, 148], D: [208, 142], K: [248, 160], R: [270, 208], U: [117, 188], jaw: 0.25, round: 0.15, top: 'none' },
    // 한국어 ㄹ(탄설음 [ɾ]) — 혀끝이 윗잇몸을 한 번 톡 치고 떨어짐: 닿는 순간의 자세(영상에서 짧게 오감)
    flap:  { T: [120, 108], B: [131, 120], F: [162, 136], D: [205, 142], K: [248, 160], R: [270, 208], U: [121, 126], jaw: 0.25, round: 0.1, top: 'tip' },
    // 영어 l(밝은 l, 낱말 처음) — 혀끝을 윗잇몸에 댄 채로, 혀 양옆은 내려 공기가 옆으로
    l:     { T: [120, 107], B: [131, 119], F: [160, 136], D: [204, 146], K: [247, 163], R: [269, 210], U: [121, 125], jaw: 0.3, round: 0.1, top: 'tip' },
    // 어두운 l(낱말 끝 · 자음 앞) — 혀끝은 닿고(빨리 끝나면 안 닿기도 함) 혀 뒤를 여린입천장 쪽으로 올림 · 혀뿌리는 뒤로
    dark:  { T: [120, 107], B: [131, 120], F: [160, 138], D: [202, 136], K: [242, 124], R: [262, 196], U: [121, 125], jaw: 0.25, round: 0.2, top: 'tip' },
    // 영어 r(말린 혀) — 혀끝을 들어 뒤로 젖히되 어디에도 닿지 않음 · 혀뿌리는 뒤로 · 입술은 조금 모음
    r:     { T: [157, 109], B: [151, 125], F: [172, 139], D: [208, 140], K: [246, 152], R: [262, 200], U: [139, 121], jaw: 0.22, round: 0.55, top: 'sides' },
    // 영어 r(뭉친 혀) — 혀끝은 아래에 두고 혀 몸통을 입천장 가까이 뭉쳐 올림(닿지 않음) · 혀뿌리는 뒤로 · 입술은 조금 모음
    rb:    { T: [113, 166], B: [130, 145], F: [158, 112], D: [200, 100], K: [240, 120], R: [262, 198], U: [116, 182], jaw: 0.2, round: 0.55, top: 'sides' },
    // 모음 몇 개(이어 말하기 · 다른 편용)
    a:     { T: [114, 186], B: [137, 178], F: [172, 172], D: [212, 170], K: [250, 176], R: [266, 214], U: [119, 200], jaw: 0.8, round: 0.05, top: 'none' },
    i:     { T: [112, 160], B: [128, 126], F: [158, 104], D: [198, 104], K: [240, 136], R: [272, 210], U: [116, 178], jaw: 0.12, round: 0, top: 'sides' },
    u:     { T: [114, 176], B: [138, 166], F: [172, 144], D: [216, 118], K: [254, 118], R: [266, 200], U: [119, 192], jaw: 0.15, round: 0.95, top: 'none' },
    ae:    { T: [113, 180], B: [134, 166], F: [166, 152], D: [206, 152], K: [246, 170], R: [270, 212], U: [118, 196], jaw: 0.65, round: 0, top: 'none' },
    schwa: { T: [113, 174], B: [135, 162], F: [169, 148], D: [209, 140], K: [248, 156], R: [270, 208], U: [118, 190], jaw: 0.35, round: 0.15, top: 'none' },
  };
  var KEYS = ['T', 'B', 'F', 'D', 'K', 'R', 'U'];

  function copy(p) {
    var o = {};
    for (var k in p) o[k] = Array.isArray(p[k]) ? p[k].slice() : p[k];
    return o;
  }
  function pose(p) {
    if (!p) return copy(P.rest);
    if (typeof p === 'string') {
      if (!P[p]) throw new Error('EN.mouth: 모르는 자세 ' + p);
      return copy(P[p]);
    }
    return p;
  }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function mix(a, b, k) {
    a = pose(a); b = pose(b);
    k = Math.max(0, Math.min(1, k));
    var o = {};
    KEYS.forEach(function (key) { o[key] = [lerp(a[key][0], b[key][0], k), lerp(a[key][1], b[key][1], k)]; });
    o.jaw = lerp(a.jaw || 0, b.jaw || 0, k);
    o.round = lerp(a.round || 0, b.round || 0, k);
    o.top = k < 0.5 ? a.top : b.top;
    o.topK = { from: a.top, to: b.top, k: k };
    return o;
  }

  // Catmull-Rom 곡선을 점으로(열린 곡선 · 닫힌 곡선)
  function spline(pts, closed, seg) {
    seg = seg || 10;
    var out = [], n = pts.length;
    var get = function (i) {
      if (closed) return pts[(i % n + n) % n];
      return pts[Math.max(0, Math.min(n - 1, i))];
    };
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (var j = 0; j < seg; j++) {
        var t = j / seg, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  function path(g, pts, close) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (close) g.closePath();
  }

  // 혀 윗면(혀뿌리 → 혀끝)과 혀 전체 윤곽
  function jawDrop(p) { return (p.jaw || 0) * 26; }
  function tongueUpper(p) { return spline([p.R, p.K, p.D, p.F, p.B, p.T], false, 12); }
  function tongueOutline(p) {
    var j = jawDrop(p);
    var floor = [[128, 200 + j], [186, 226 + j * 0.8], [242, 256 + j * 0.5], [268, 282]];
    var pts = [[278, 296], p.R, p.K, p.D, p.F, p.B, p.T, p.U].concat(floor);
    return spline(pts, true, 10);
  }
  var ROOF_PTS = spline(ROOF, false, 8);

  function nearest(pt, poly) {
    var best = 1e9, at = null, idx = 0;
    for (var i = 0; i < poly.length - 1; i++) {
      var a = poly[i], b = poly[i + 1];
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var t = ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy || 1);
      t = Math.max(0, Math.min(1, t));
      var q = [a[0] + dx * t, a[1] + dy * t];
      var d = Math.hypot(pt[0] - q[0], pt[1] - q[1]);
      if (d < best) { best = d; at = q; idx = i; }
    }
    return { d: best, at: at, i: idx };
  }
  function whereOn(x) { return x < 140 ? '윗잇몸' : x < 246 ? '센입천장' : '여린입천장'; }

  // 혀가 입천장에 닿나: 혀 윗면의 점 중 입천장과 가장 가까운 곳
  function contact(p) {
    p = pose(p);
    var up = tongueUpper(p), best = { d: 1e9 }, from = null;
    up.forEach(function (pt) {
      var n = nearest(pt, ROOF_PTS);
      // 입천장보다 위(안쪽)로 들어간 점도 닿은 것으로
      if (n.d < best.d) { best = n; from = pt; }
    });
    return { touch: best.d <= 4.5, at: best.at, from: from, where: whereOn(best.at[0]), gap: Math.round(best.d) };
  }

  function lipsGeom(p) {
    var j = jawDrop(p), r = p.round || 0;
    var pro = r * 11;                                     // 입술을 앞으로 내밈
    return {
      ul: [[62, 90], [53 - pro * 0.6, 110], [49 - pro, 128], [53 - pro, 141 - r * 2], [68 - pro * 0.5, 145 - r * 3], [84, 144 - r * 2]],   // 윗입술: 앞면 → 아래 가장자리
      ll: [[84, 152 + j - r * 2], [66 - pro * 0.5, 151 + j - r * 2], [52 - pro, 159 + j], [52 - pro * 0.6, 173 + j], [64, 184 + j], [72, 194 + j * 0.7]],
      open: Math.max(0, (151 + j - r * 2) - (145 - r * 3)),
    };
  }

  function draw(g, x, y, s, p, opt) {
    p = pose(p);
    opt = opt || {};
    var C = Object.assign({}, opt.light ? LIGHT : DARK, opt.pal || {});
    var j = jawDrop(p), L = lipsGeom(p);
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.lineJoin = 'round';
    g.lineCap = 'round';

    // 1) 머리 옆모습 전체(살)
    var NOSE = [[52, 0], [40, 30], [26, 52], [17, 64], [26, 74], [44, 78], [62, 90]];
    var ulS = spline(L.ul, false, 6), llS = spline(L.ll, false, 6);
    var CHIN = [[70, 214 + j * 0.6], [62, 236 + j * 0.5], [78, 262 + j * 0.3], [140, 286], [200, 300], [214, 360]];
    var front = NOSE.concat(spline(L.ul.slice(0, 4), false, 6)).concat(spline(L.ll.slice(2), false, 6)).concat(CHIN);
    g.fillStyle = C.skin;
    path(g, [[0, 0]].concat(front).concat([[400, 360], [400, 0]]), true);
    g.fill();

    // 2) 공기가 지나는 곳: 입술 사이 → 입안 → 목. 혀는 이 위에 그려요(혀 아래의 빈 곳도 여기)
    var LIP_IN_UP = ulS.slice(ulS.length - 13);          // 윗입술 아래 가장자리(앞 → 안)
    var LIP_IN_LO = llS.slice(0, 13);                    // 아랫입술 위 가장자리(안 → 앞)
    var airway = LIP_IN_UP
      .concat([[92, 146], [100, 112]])
      .concat(ROOF_PTS)
      .concat([[294, 136], [296, 112], [298, 92]])
      .concat(spline(BACKWALL, false, 8))
      .concat([[288, 360], [290, 330], [284, 304], [278, 296], [266, 280], [240, 252 + j * 0.5], [185, 222 + j * 0.8], [128, 197 + j], [108, 195 + j], [104, 166 + j], [96, 157 + j]])
      .concat(LIP_IN_LO);
    g.fillStyle = C.inner;
    path(g, airway, true);
    g.fill();

    // 3) 선: 얼굴 옆모습 · 입천장 · 목 뒷벽
    g.strokeStyle = C.skinLine;
    g.lineWidth = 2;
    path(g, NOSE.concat(ulS), false);
    g.stroke();
    path(g, llS.concat(CHIN), false);
    g.stroke();
    path(g, [[100, 112]].concat(ROOF_PTS).concat([[294, 136], [296, 112], [298, 92]]), false);
    g.stroke();
    path(g, spline(BACKWALL, false, 8), false);
    g.stroke();

    // 4) 이(윗니 · 아랫니)
    g.fillStyle = C.teeth;
    g.strokeStyle = C.teethLine;
    g.lineWidth = 1.5;
    path(g, [[96, 111], [92, 128], [93, 146], [97, 154], [101, 151], [106, 137], [111, 117], [108, 110]], true);
    g.fill(); g.stroke();
    path(g, [[99, 154 + j], [103, 158 + j], [107, 172 + j], [107, 194 + j], [96, 194 + j], [94, 173 + j], [96, 158 + j]], true);
    g.fill(); g.stroke();

    // 5) 혀
    var tg = tongueOutline(p);
    g.fillStyle = C.tongue;
    path(g, tg, true);
    g.fill();
    g.strokeStyle = C.tongueLine;
    g.lineWidth = 2;
    path(g, tongueUpper(p), false);
    g.stroke();

    // 6) 목(성대) — 울림 물결
    var vx = 292, vy = 328;
    g.strokeStyle = C.faint;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(284, vy); g.lineTo(vx + 4, vy - 2); g.moveTo(312, vy); g.lineTo(vx + 10, vy - 2); g.stroke();
    if (typeof opt.voice === 'number') {
      g.strokeStyle = C.voice;
      g.lineWidth = 2.2;
      for (var w = 0; w < 3; w++) {
        g.beginPath();
        for (var q = 0; q <= 24; q++) {
          var yy = vy - 8 - w * 7 - q * 0.0;
          var xx = 282 + q * 1.4;
          var yv = yy + Math.sin(q * 0.9 + opt.voice * 14 + w) * 2.2;
          if (q === 0) g.moveTo(xx, yv); else g.lineTo(xx, yv);
        }
        g.globalAlpha = 0.9 - w * 0.25;
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    // 7) 닿는 곳 · 틈
    var ct = contact(p);
    if (opt.mark) {
      g.fillStyle = opt.mark;
      g.strokeStyle = opt.mark;
      if (ct.touch) {
        g.beginPath(); g.arc(ct.at[0], ct.at[1], 7, 0, Math.PI * 2); g.fill();
      } else if (opt.gap !== false) {
        g.setLineDash([3, 4]);
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(ct.from[0], ct.from[1]); g.lineTo(ct.at[0], ct.at[1]); g.stroke();
        g.setLineDash([]);
        g.beginPath(); g.arc(ct.at[0], ct.at[1], 3.5, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(ct.from[0], ct.from[1], 3.5, 0, Math.PI * 2); g.fill();
      }
    }

    // 8) 공기 흐름
    if (opt.air) {
      var t = opt.t || 0;
      var route = opt.air === 'side'
        ? [[300, 330], [296, 250], [282, 170], [236, 120], [170, 112], [134, 128], [96, 150], [40, 150]]
        : [[300, 330], [296, 250], [284, 170], [240, 118], [176, 108], [130, 122], [96, 150], [40, 150]];
      var pts = spline(route, false, 8);
      g.strokeStyle = C.air;
      g.lineWidth = 2.5;
      g.setLineDash(opt.air === 'side' ? [6, 7] : [12, 7]);
      g.lineDashOffset = -t * 40;
      path(g, pts, false);
      g.stroke();
      g.setLineDash([]);
      var e = pts[pts.length - 1], e0 = pts[pts.length - 3];
      var a = Math.atan2(e[1] - e0[1], e[0] - e0[0]);
      g.fillStyle = C.air;
      g.beginPath();
      g.moveTo(e[0] + Math.cos(a) * 6, e[1] + Math.sin(a) * 6);
      g.lineTo(e[0] + Math.cos(a + 2.5) * 11, e[1] + Math.sin(a + 2.5) * 11);
      g.lineTo(e[0] + Math.cos(a - 2.5) * 11, e[1] + Math.sin(a - 2.5) * 11);
      g.closePath();
      g.fill();
    }

    // 9) 이름표
    if (opt.labels) {
      var want = opt.labels === true ? ['ridge', 'palate', 'velum', 'tip', 'back', 'lips', 'voice'] : opt.labels;
      var font = opt.font || function (sz, w) { return (w || 500) + ' ' + sz + 'px "IBM Plex Sans KR", sans-serif'; };
      var LB = {
        ridge: ['윗잇몸', [122, 103], [150, 40]],
        palate: ['센입천장', [200, 84], [212, 40]],
        velum: ['여린입천장', [272, 104], [330, 56]],
        tip: ['혀끝', p.T, [150, 214]],
        back: ['혀 뒤', p.K, [228, 214]],
        lips: ['입술', [56, 140], [6, 118]],
        voice: ['목(성대)', [298, 324], [330, 300]],
      };
      g.font = font(15, 600);
      g.textBaseline = 'middle';
      want.forEach(function (k) {
        var lb = LB[k];
        if (!lb) return;
        g.strokeStyle = C.faint;
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(lb[1][0], lb[1][1]); g.lineTo(lb[2][0], lb[2][1] + (lb[2][1] < lb[1][1] ? 8 : -8)); g.stroke();
        g.fillStyle = C.label;
        g.textAlign = lb[2][0] < 40 ? 'left' : 'center';
        g.fillText(lb[0], lb[2][0], lb[2][1]);
      });
    }
    g.restore();
    return ct;
  }

  // ── 위에서 본 그림: 윗니 말굽 + 혀, 닿는 곳(칠함)과 공기 길(화살표) ───────────────
  function top(g, x, y, s, p, opt) {
    p = pose(p);
    opt = opt || {};
    var C = Object.assign({}, opt.light ? LIGHT : DARK, opt.pal || {});
    var kind = p.top || 'none';
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.lineJoin = 'round';
    // 입천장(말굽 안쪽)
    var arch = [];
    for (var i = 0; i <= 24; i++) {
      var a = Math.PI * (i / 24);
      arch.push([100 - Math.cos(a) * 70, 196 - Math.sin(a) * 160]);
    }
    g.fillStyle = C.skin;
    path(g, [[18, 200]].concat(arch).concat([[182, 200]]), true);
    g.fill();
    // 혀(위에서): 둥근 혀끝이 앞(위쪽)
    var tip = kind === 'tip' ? 42 : kind === 'sides' ? 58 : 66;
    var tongue = spline([[42, 214], [36, 150], [50, tip + 30], [100, tip], [150, tip + 30], [164, 150], [158, 214]], false, 10);
    g.fillStyle = C.tongue;
    path(g, tongue.concat([[158, 220], [42, 220]]), true);
    g.fill();
    // 닿는 곳
    var mark = opt.mark || '#FFC15E';
    g.fillStyle = mark;
    g.globalAlpha = 0.85;
    if (kind === 'tip') {
      g.beginPath(); g.ellipse(100, 48, 30, 13, 0, 0, Math.PI * 2); g.fill();
    } else if (kind === 'sides') {
      g.beginPath(); g.ellipse(46, 140, 10, 46, 0.05, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(154, 140, 10, 46, -0.05, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // 윗니 말굽(밝은 테마에서도 보이게 테두리를 먼저)
    g.lineCap = 'round';
    var arch2 = [];
    for (i = 0; i <= 24; i++) {
      a = Math.PI * (i / 24);
      arch2.push([100 - Math.cos(a) * 82, 200 - Math.sin(a) * 172]);
    }
    g.strokeStyle = C.teethLine;
    g.lineWidth = 14;
    path(g, arch2, false);
    g.stroke();
    g.strokeStyle = C.teeth;
    g.lineWidth = 12;
    g.lineCap = 'round';
    var teeth = [];
    for (i = 0; i <= 24; i++) {
      a = Math.PI * (i / 24);
      teeth.push([100 - Math.cos(a) * 82, 200 - Math.sin(a) * 172]);
    }
    path(g, teeth, false);
    g.stroke();
    g.strokeStyle = C.teethLine;
    g.lineWidth = 1;
    for (i = 1; i < 24; i += 2) {
      a = Math.PI * (i / 24);
      g.beginPath();
      g.moveTo(100 - Math.cos(a) * 76, 200 - Math.sin(a) * 166);
      g.lineTo(100 - Math.cos(a) * 88, 200 - Math.sin(a) * 178);
      g.stroke();
    }
    // 공기 길
    if (opt.air !== false) {
      var t = opt.t || 0;
      g.strokeStyle = C.air;
      g.fillStyle = C.air;
      g.lineWidth = 3;
      g.setLineDash([9, 6]);
      g.lineDashOffset = -t * 30;
      var lanes = kind === 'tip' ? [[[72, 214], [70, 120], [66, 60], [76, 14]], [[128, 214], [130, 120], [134, 60], [124, 14]]]
        : [[[100, 214], [100, 120], [100, 70], [100, 6]]];
      lanes.forEach(function (ln) {
        var pts = spline(ln, false, 8);
        path(g, pts, false);
        g.stroke();
        var e = pts[pts.length - 1], e0 = pts[pts.length - 3];
        var an = Math.atan2(e[1] - e0[1], e[0] - e0[0]);
        g.setLineDash([]);
        g.beginPath();
        g.moveTo(e[0] + Math.cos(an) * 6, e[1] + Math.sin(an) * 6);
        g.lineTo(e[0] + Math.cos(an + 2.5) * 11, e[1] + Math.sin(an + 2.5) * 11);
        g.lineTo(e[0] + Math.cos(an - 2.5) * 11, e[1] + Math.sin(an - 2.5) * 11);
        g.closePath();
        g.fill();
        g.setLineDash([9, 6]);
      });
      g.setLineDash([]);
    }
    g.restore();
    return kind;
  }

  // ── 입술 앞모습 ──────────────────────────────────────────────
  function lips(g, x, y, s, p, opt) {
    p = pose(p);
    opt = opt || {};
    var C = Object.assign({}, opt.light ? LIGHT : DARK, opt.pal || {});
    var r = p.round || 0, j = p.jaw || 0;
    var w = 84 - r * 36;                 // 입 너비의 반
    var oh = 8 + j * 34 + r * 18;        // 벌린 높이
    var ow = Math.max(12, w - 16 - r * 14);   // 벌린 너비의 반
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    var cx = 100, cy = 70;
    // 입술 바깥
    g.fillStyle = opt.lipColor || '#C9707F';
    g.beginPath();
    g.moveTo(cx - w, cy);
    g.bezierCurveTo(cx - w * 0.6, cy - 30 - r * 4, cx - 14, cy - 34, cx, cy - 26);
    g.bezierCurveTo(cx + 14, cy - 34, cx + w * 0.6, cy - 30 - r * 4, cx + w, cy);
    g.bezierCurveTo(cx + w * 0.6, cy + 34 + oh * 0.4, cx - w * 0.6, cy + 34 + oh * 0.4, cx - w, cy);
    g.fill();
    // 입 안
    g.fillStyle = C.inner === '#FFFFFF' ? '#3A2430' : '#1A0F14';
    g.beginPath();
    g.ellipse(cx, cy + 2, ow, oh / 2 + 2, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.ellipse(cx, cy + 2, ow, oh / 2 + 2, 0, 0, Math.PI * 2);
    g.clip();
    // 윗니
    g.fillStyle = C.teeth;
    g.fillRect(cx - ow, cy + 2 - oh / 2 - 2, ow * 2, Math.min(10, oh * 0.45));
    // 혀끝(윗니 뒤에 닿아 보임)
    if (opt.tip) {
      g.fillStyle = C.tongue;
      g.beginPath();
      g.ellipse(cx, cy + 2 - oh / 2 + 8, ow * 0.5, Math.max(4, oh * 0.32), 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = C.tongue;
      g.beginPath();
      g.ellipse(cx, cy + 2 + oh / 2 + 4, ow * 0.8, Math.max(4, oh * 0.4), 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.restore();
  }

  EN.mouth = { POSES: P, pose: pose, mix: mix, draw: draw, top: top, lips: lips, contact: contact, spline: spline, ROOF: ROOF_PTS };
})();
