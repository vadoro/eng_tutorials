/* 발음 듣기 글 모으기 — tools/narration-pieces.cjs가 튜토리얼 페이지 안에서 실행해요.
 * 페이지의 상태(장 · 직접 해 보기의 예문)를 바꾸니, 다 쓰고 버리는 페이지에서만 부르세요.
 *
 *   window.__collectSayLines() → 영어 글 배열 (EN.say.text로 다듬은 글, 영어 글자가 있는 것만, 중복 없음)
 *
 * 모으는 곳(글이 정해진 것만 — 미리 만든 음성 파일로 읽을 글):
 *   - 영상: 장면 부품(render · hits · END · CHAPTERS가 있는 전역, 예: RV · SV)을 0.1초마다 그려 화면 속 발음 칩(hits().say)
 *   - 페이지: 처음부터 있는 발음 단추([data-say])
 *   - 직접 해 보기(#lab): 장마다 열고, 예문 단추(.seg button)를 하나씩 눌러 가며 나오는 발음 단추와 그 상태의 영상 칩
 *   - 페이지에 window.__sayLines()가 있으면 그 글(튜토리얼마다 더 모을 것)
 * 놀이터에서 조각을 골라 만든 문장, 문제를 푼 뒤에 나오는 문장처럼 조합이 많은 글은 모으지 않아요(브라우저 음성으로 읽어요).
 */
window.__collectSayLines = function () {
  var out = [], seen = {};
  var add = function (t0) {
    var t = window.EN && EN.say && EN.say.text ? EN.say.text(t0 || '') : String(t0 || '').trim();
    if (!t || !/[A-Za-z]/.test(t) || seen[t]) return;
    seen[t] = 1; out.push(t);
  };
  var scene = null;
  Object.keys(window).some(function (k) {
    var o = /^[A-Z][A-Za-z0-9]*$/.test(k) ? window[k] : null;
    if (o && typeof o.render === 'function' && typeof o.hits === 'function' && o.CHAPTERS && o.END) { scene = o; return true; }
    return false;
  });
  var cv = document.createElement('canvas');
  cv.width = (scene && scene.W) || 1280; cv.height = (scene && scene.H) || 720;
  var ctx = cv.getContext('2d');
  var sweep = function (t0, t1) {
    if (!scene) return;
    for (var t = t0; t <= t1 + 1e-6; t += 0.1) {
      try { scene.render(ctx, t, { caption: true }); } catch (e) { continue; }
      scene.hits().forEach(function (h) { if (h.say) add(h.say); });
    }
  };
  var grab = function (root) {
    if (root) [].forEach.call(root.querySelectorAll('[data-say]'), function (e) { add(e.getAttribute('data-say')); });
  };
  sweep(0, scene ? scene.END : 0);
  grab(document);
  var chaps = document.querySelectorAll('#chapters .chap'), lab = document.getElementById('lab');
  if (scene && lab && chaps.length === scene.CHAPTERS.length) {
    scene.CHAPTERS.forEach(function (ch, i) {
      var end = i + 1 < scene.CHAPTERS.length ? scene.CHAPTERS[i + 1].t : scene.END;
      chaps[i].click();                                   // 그 장으로 가면 직접 해 보기가 그 장의 것으로 바뀌어요
      grab(lab);
      var n = lab.querySelectorAll('.seg button').length;
      for (var j = 0; j < n; j++) {
        var bs = lab.querySelectorAll('.seg button');     // 누를 때마다 다시 그리니 매번 다시 찾아요
        if (j >= bs.length) break;
        bs[j].click();
        grab(lab);
        sweep(ch.t, end);
      }
    });
    var pb = document.getElementById('playBtn');
    if (pb && /일시정지/.test(pb.getAttribute('aria-label') || pb.title || '')) pb.click();
  }
  if (typeof window.__sayLines === 'function') window.__sayLines().forEach(add);
  return out;
};
