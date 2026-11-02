/* 영어 튜토리얼 공통 부품: 퀴즈
 *
 * 쓰는 법
 *   EN.quiz({
 *     list: document.getElementById('quizList'),     // <ol class="enq">
 *     score: document.getElementById('quizScore'),   // 점수 문장이 들어갈 곳 (role="status" 권장)
 *     reset: document.getElementById('quizReset'),   // 처음부터 다시 풀기 단추 (선택)
 *     done: (ok, total) => '…',                      // 다 풀었을 때 문장 (선택)
 *     questions: [
 *       // 객관식
 *       { q: '질문', opts: ['보기1', '보기2', '보기3', '보기4'], a: 2, why: '해설' },
 *       // 그림 문제: 캔버스 속 대상을 누르거나 아래 단추로 고름
 *       { q: '질문', opts: ['A', 'B', 'C', 'D'], a: 1, why: '해설',
 *         figure: {
 *           width: 400, height: 200,                   // 논리 크기 (화면에 맞춰 늘어남)
 *           label: '그림 설명 (화면 읽기 프로그램용)',
 *           draw(g, st) {},                            // st = { done, pick, answer, hover } — g는 논리 크기로 맞춰 둔 2D 컨텍스트
 *           pick(x, y) { return -1; },                 // 논리 좌표 → 보기 번호 (없으면 -1)
 *         } },
 *     ],
 *   });
 *
 * 정답 위치가 한쪽에 몰리지 않게 보기 순서를 정하세요. 해설은 바로 아래에 보여 줍니다.
 */
(function () {
  'use strict';
  var EN = (window.EN = window.EN || {});
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };

  EN.quiz = function (cfg) {
    var Q = cfg.questions, state = Q.map(function () { return { done: false, ok: false, pick: null, hover: -1 }; });
    var doneMsg = cfg.done || function (ok, total) {
      return ok === total ? '모두 맞혔어요!' : ok >= Math.ceil(total * 0.7) ? '거의 다 왔어요. 틀린 문제의 해설을 읽어 보세요.' : '영상의 해당 장면을 다시 보고 도전해 보세요.';
    };
    cfg.list.classList.add('enq');

    function drawFigure(cv, f, st, q) {
      var g = cv.getContext('2d'), s = cv.width / f.width;
      g.setTransform(s, 0, 0, s, 0, 0);
      g.clearRect(0, 0, f.width, f.height);
      f.draw(g, { done: st.done, pick: st.pick, answer: q.a, hover: st.done ? -1 : st.hover });
    }
    function answer(qi, pick) {
      var st = state[qi];
      if (st.done) return;
      st.done = true; st.pick = pick; st.ok = pick === Q[qi].a;
      render();
    }
    function render() {
      cfg.list.innerHTML = '';
      Q.forEach(function (q, qi) {
        var st = state[qi], li = document.createElement('li');
        li.className = 'enq-item' + (st.done ? (st.ok ? ' ok' : ' no') : '');
        li.innerHTML = '<p class="enq-q"><span class="enq-n">Q' + (qi + 1) + '</span>' + esc(q.q) + '</p>';
        if (q.figure) {
          var f = q.figure, cv = document.createElement('canvas');
          cv.width = f.width * 2; cv.height = f.height * 2;
          cv.className = 'enq-fig';
          cv.style.aspectRatio = f.width + ' / ' + f.height;
          cv.setAttribute('role', 'img');
          if (f.label) cv.setAttribute('aria-label', f.label);
          var at = function (e) {
            var r = cv.getBoundingClientRect();
            return f.pick((e.clientX - r.left) / r.width * f.width, (e.clientY - r.top) / r.height * f.height);
          };
          cv.addEventListener('mousemove', function (e) {
            var k = at(e);
            if (k !== st.hover) { st.hover = k; drawFigure(cv, f, st, q); }
            cv.style.cursor = k >= 0 && !st.done ? 'pointer' : 'default';
          });
          cv.addEventListener('mouseleave', function () { if (st.hover !== -1) { st.hover = -1; drawFigure(cv, f, st, q); } });
          cv.addEventListener('click', function (e) { var k = at(e); if (k >= 0) answer(qi, k); });
          li.appendChild(cv);
          drawFigure(cv, f, st, q);
        }
        var box = document.createElement('div');
        // 보기가 모두 짧으면 두 줄로, 길면 한 줄에 하나씩
        var short = q.opts.every(function (o) { return String(o).length <= 14; });
        box.className = 'enq-opts' + (q.figure ? ' enq-keys' : short ? ' enq-short' : '');
        if (q.figure) box.setAttribute('aria-label', '답 고르기');
        q.opts.forEach(function (o, oi) {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = o;
          if (st.done) {
            b.disabled = true;
            if (oi === q.a) b.classList.add('right');
            else if (oi === st.pick) b.classList.add('wrong');
          }
          b.addEventListener('click', function () { answer(qi, oi); });
          box.appendChild(b);
        });
        li.appendChild(box);
        if (st.done) {
          var p = document.createElement('p');
          p.className = 'enq-why';
          p.innerHTML = '<b>' + (st.ok ? '정답!' : '아쉬워요.') + '</b> ' + esc(q.why);
          li.appendChild(p);
        }
        cfg.list.appendChild(li);
      });
      var done = state.filter(function (s) { return s.done; }).length, ok = state.filter(function (s) { return s.ok; }).length;
      if (cfg.score) {
        cfg.score.textContent = done === Q.length
          ? ok + ' / ' + Q.length + ' 맞혔어요. ' + doneMsg(ok, Q.length)
          : done + ' / ' + Q.length + ' 문제 풀이 · ' + ok + '개 정답';
      }
    }
    if (cfg.reset) cfg.reset.addEventListener('click', function () {
      state.forEach(function (s) { s.done = false; s.ok = false; s.pick = null; s.hover = -1; });
      render();
    });
    render();
    return { render: render, state: state };
  };
})();
