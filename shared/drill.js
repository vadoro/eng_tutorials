/* 영어 튜토리얼 공통 부품: 토익 Part 5 연습 문제 (한 문제씩, 단계별 힌트)
 *
 * 쓰는 법
 *   const drill = EN.drill({
 *     root: document.getElementById('drill'),
 *     items: [{
 *       q: 'The manager ___ oversees the project will retire next month.',   // 빈칸은 ___
 *       opts: ['who', 'whom', 'whose', 'what'], a: 0,
 *       ko: '그 프로젝트를 감독하는 매니저는 다음 달에 은퇴해요.',                  // 해석 (답한 뒤에 보여 줌)
 *       tag: '주격 · 사람',                                                    // 유형 (답한 뒤에 보여 줌)
 *       steps: [                                                              // 힌트 = 풀이 단계. 하나씩 열림
 *         { head: '① 앞을 봐요', text: '…', marks: [{ t: 'The manager', role: 'ante' }] },
 *         …
 *       ],
 *       notes: ['보기 A에 대한 한 줄', …],                                     // 보기마다 맞고 틀린 까닭 (답한 뒤)
 *     }],
 *     before: () => {},           // 발음 듣기 전에 부를 함수 (예: 영상 일시정지) (선택)
 *     done: (ok, total) => '…',   // 다 풀었을 때 문장 (선택)
 *   });
 *
 * marks의 role: ante(선행사) · cue(빈칸 뒤 단서) · trap(콤마·전치사 같은 함정) · verb(수 일치)
 * 단계의 marks는 그 힌트를 열었을 때부터 문장에 색으로 표시됩니다. 답하면 모든 단계가 열립니다.
 * 키보드: A~D 또는 1~4 고르기, H 힌트, → 또는 Enter 다음 문제 (연습 문제 상자 안에 초점이 있을 때)
 */
(function () {
  'use strict';
  var EN = (window.EN = window.EN || {});
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  var L = 'ABCD';

  // 문장에 색 표시 넣기: marks의 글자를 찾아 <mark>로 감쌈 (겹치면 앞의 것만). 빈칸(___)은 fill이 있으면 그 말로 채움
  function markup(q, marks, fill, fillCls) {
    var ranges = [];
    (marks || []).forEach(function (m) {
      var from = 0, i;
      for (var n = 0; n <= (m.nth || 0); n++) { i = q.indexOf(m.t, from); if (i < 0) break; from = i + m.t.length; }
      if (i >= 0 && !ranges.some(function (r) { return i < r.e && i + m.t.length > r.s; })) ranges.push({ s: i, e: i + m.t.length, role: m.role });
    });
    var b = q.indexOf('___');
    if (b >= 0) ranges.push({ s: b, e: b + 3, blank: true });
    ranges.sort(function (x, y) { return x.s - y.s; });
    var out = '', at = 0;
    ranges.forEach(function (r) {
      if (r.s < at) return;
      out += esc(q.slice(at, r.s));
      if (r.blank) out += fill ? '<span class="edr-fill ' + (fillCls || '') + '">' + esc(fill) + '</span>' : '<span class="edr-blank" aria-label="빈칸">&nbsp;</span>';
      else out += '<mark class="mk-' + r.role + '">' + esc(q.slice(r.s, r.e)) + '</mark>';
      at = r.e;
    });
    return out + esc(q.slice(at));
  }

  EN.drill = function (cfg) {
    var items = cfg.items, root = cfg.root;
    var st = items.map(function () { return { pick: null, hints: 0 }; });
    var cur = 0, retry = null;   // retry: 틀린 문제만 다시 풀 때 그 번호 목록
    root.classList.add('edr');
    root.tabIndex = -1;

    function score() {
      var done = st.filter(function (s) { return s.pick !== null; }).length;
      var ok = st.filter(function (s, i) { return s.pick === items[i].a; }).length;
      return { done: done, ok: ok };
    }
    function order() { return retry || items.map(function (_, i) { return i; }); }
    function go(i) { cur = i; render(); }
    function next() {
      var o = order(), k = o.indexOf(cur);
      for (var j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j]);
      for (var j2 = 0; j2 < k; j2++) if (st[o[j2]].pick === null) return go(o[j2]);
      cur = -1; render();   // 모두 풀었으면 결과 화면
    }
    function answer(k) {
      var s = st[cur];
      if (s.pick !== null) return;
      s.pick = k; s.hints = items[cur].steps.length;
      render();
      var f = root.querySelector('.edr-next'); if (f) f.focus({ preventScroll: true });
    }
    function hint() {
      var s = st[cur];
      if (s.pick !== null || s.hints >= items[cur].steps.length) return;
      s.hints++; render();
    }

    function dots() {
      return '<ol class="edr-dots" aria-label="문제 목록">' + items.map(function (it, i) {
        var s = st[i], c = s.pick === null ? '' : s.pick === it.a ? ' ok' : ' no';
        return '<li><button type="button" data-go="' + i + '" class="' + c + (i === cur ? ' cur' : '') + '" aria-label="문제 ' + (i + 1) + (s.pick === null ? '' : s.pick === it.a ? ' 정답' : ' 오답') + '"' + (i === cur ? ' aria-current="step"' : '') + '>' + (i + 1) + '</button></li>';
      }).join('') + '</ol>';
    }
    function render() {
      var sc = score();
      if (cur < 0) {
        var wrong = items.map(function (_, i) { return i; }).filter(function (i) { return st[i].pick !== items[i].a; });
        root.innerHTML = dots() +
          '<div class="edr-card edr-end"><p class="edr-big">' + sc.ok + ' / ' + items.length + '</p>' +
          '<p>' + esc(cfg.done ? cfg.done(sc.ok, items.length) : (sc.ok === items.length ? '모두 맞혔어요!' : '틀린 문제의 풀이를 다시 읽어 보세요.')) + '</p>' +
          '<div class="edr-acts">' + (wrong.length ? '<button type="button" class="edr-btn" data-act="retry">틀린 ' + wrong.length + '문제 다시 풀기</button>' : '') +
          '<button type="button" class="edr-btn ghost" data-act="reset">처음부터 다시</button></div></div>';
        return;
      }
      var it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a;
      var marks = [];
      it.steps.forEach(function (stp, i) { if (i < s.hints) marks = marks.concat(stp.marks || []); });
      var o = order(), pos = o.indexOf(cur);
      var html = dots() +
        '<div class="edr-card' + (done ? (ok ? ' ok' : ' no') : '') + '">' +
        '<p class="edr-meta"><span>' + (retry ? '다시 풀기 ' + (pos + 1) + ' / ' + o.length : '문제 ' + (cur + 1) + ' / ' + items.length) + '</span>' +
        (done && it.tag ? '<span class="edr-tag">' + esc(it.tag) + '</span>' : '') + '</p>' +
        '<p class="edr-q" lang="en">' + markup(it.q, marks, done ? it.opts[it.a] : '', done ? 'ok' : '') + '</p>' +
        '<div class="edr-opts" role="group" aria-label="보기">' + it.opts.map(function (op, k) {
          var cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
          return '<button type="button" data-pick="' + k + '" class="' + cls + '"' + (done ? ' disabled' : '') + '><b>(' + L[k] + ')</b> <span lang="en">' + esc(op) + '</span></button>';
        }).join('') + '</div>';
      if (!done) {
        html += '<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"' + (s.hints >= it.steps.length ? ' disabled' : '') + '>' +
          (s.hints ? '다음 힌트' : '힌트 보기') + ' <small>' + s.hints + ' / ' + it.steps.length + '</small></button>' +
          '<span class="edr-keys">키보드: A~D 고르기 · H 힌트</span></div>';
      }
      if (s.hints) {
        html += '<ol class="edr-steps">' + it.steps.slice(0, s.hints).map(function (stp) {
          return '<li><b>' + esc(stp.head) + '</b> ' + esc(stp.text) + '</li>';
        }).join('') + '</ol>';
      }
      if (done) {
        html += '<p class="edr-verdict"><b>' + (ok ? '정답!' : '아쉬워요. 정답은 (' + L[it.a] + ') ' + esc(it.opts[it.a]) + '.') + '</b></p>';
        if (it.notes) html += '<ul class="edr-notes">' + it.notes.map(function (t, k) {
          return '<li class="' + (k === it.a ? 'right' : '') + '"><b>(' + L[k] + ') <span lang="en">' + esc(it.opts[k]) + '</span></b> ' + esc(t) + '</li>';
        }).join('') + '</ul>';
        var full = it.q.replace('___', it.opts[it.a]);
        html += '<p class="edr-ko">' + (EN.say && EN.say.button ? EN.say.button(full, '완성 문장 듣기') : '') + '<span>' + esc(it.ko || '') + '</span></p>' +
          '<div class="edr-acts"><button type="button" class="edr-btn edr-next" data-act="next">' + (sc.done === items.length || (retry && o.every(function (i) { return st[i].pick !== null; })) ? '결과 보기' : '다음 문제') + ' →</button></div>';
      }
      html += '</div>';
      root.innerHTML = html;
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !root.contains(b)) return;
      if (b.hasAttribute('data-say')) { if (cfg.before) cfg.before(); return; }   // 읽기는 EN.say.wire가 처리
      if (b.dataset.go) { retry = null; go(+b.dataset.go); return; }
      if (b.dataset.pick) { answer(+b.dataset.pick); return; }
      var act = b.dataset.act;
      if (act === 'hint') hint();
      else if (act === 'next') next();
      else if (act === 'retry') {
        retry = items.map(function (_, i) { return i; }).filter(function (i) { return st[i].pick !== items[i].a; });
        retry.forEach(function (i) { st[i] = { pick: null, hints: 0 }; });
        go(retry[0]);
      } else if (act === 'reset') { retry = null; st = items.map(function () { return { pick: null, hints: 0 }; }); go(0); }
    });
    root.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey || cur < 0) return;
      var k = e.key.toUpperCase(), i = L.indexOf(k), n = '1234'.indexOf(k);
      if (st[cur].pick === null && (i >= 0 || n >= 0)) { e.preventDefault(); answer(i >= 0 ? i : n); }
      else if (k === 'H') { e.preventDefault(); hint(); }
      else if ((e.key === 'ArrowRight' || e.key === 'Enter') && st[cur].pick !== null && !(e.target.closest && e.target.closest('button:not(.edr-next)'))) { e.preventDefault(); next(); }
    });
    render();
    return { go: go, state: st, render: render };
  };
})();
