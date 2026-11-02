/* 영어 튜토리얼 공통 부품: 음성 해설 + 영어 발음 듣기
 *
 * 1) EN.narration — 브라우저 음성(speechSynthesis)으로 자막을 읽고, 다 읽을 때까지 그 자막 끝에서 영상이 기다리게 합니다.
 *    자막 속 영어(알파벳으로 된 부분)는 영어 음성으로, 나머지는 한국어 음성으로 나눠 읽습니다.
 *    한국어 음성이 영어 문장을 한국어 억양으로 읽지 않게 하려는 것입니다.
 *
 *    const narr = EN.narration({
 *      captions: [{ start: 0.5, end: 5, text: '자막' }, ...],   // 영상 전체 기준 시각(초)
 *      read: [[/TOEIC/g, '토익']],     // 이 튜토리얼에만 필요한 읽기 바꾸기 (선택)
 *      rate: () => speed,               // 지금 재생 속도 (선택, 기본 1)
 *      holdBefore: 0.05,                // 자막 끝보다 몇 초 앞에서 기다릴지
 *    });
 *    // 재생 중 매 프레임
 *    T = narr.hold(T, T + dt * speed);   // 읽는 중이면 시간이 자막 끝을 넘지 않게
 *    narr.sync(T, playing);              // 자막이 바뀌면 읽기 시작
 *    // 일시정지·이동할 때
 *    narr.reset();
 *    // 단추와 안내 문구 연결
 *    EN.narration.bind(narr, buttonEl, noteEl, { onEnable() { if (!started) play(); } });
 *
 * 2) EN.say(text, { slow }) — 영어 문장 하나를 영어 음성으로 읽습니다(발음 듣기 단추용).
 *    EN.say.supported 가 false이면 단추를 숨기세요. EN.say.stop()으로 멈춥니다.
 *
 * 3) EN.splitLang(text) — 글을 [{ lang: 'en' | 'ko', text }] 조각으로 나눕니다(자막의 영어 부분 꾸미기에도 씀).
 */
(function () {
  'use strict';
  var EN = (window.EN = window.EN || {});

  // 모든 튜토리얼에 공통인 읽기 바꾸기: 화면용 기호를 소리 내어 읽기 좋게
  var BASE_READ = [
    [/\*\*/g, ''],
    [/①/g, '첫째, '], [/②/g, '둘째, '], [/③/g, '셋째, '], [/④/g, '넷째, '], [/⑤/g, '다섯째, '],
    [/_{2,}/g, ' 빈칸 '], [/▢/g, ' 빈자리 '],
    [/\(([A-D])\)/g, ' $1 '],
    [/[‘’“”]/g, ''], [/→/g, ', '], [/…/g, ', '], [/·/g, ', '], [/~/g, ' '],
    [/×/g, ' 곱하기 '], [/÷/g, ' 나누기 '], [/✗/g, ' 엑스 '], [/✓/g, ''],
  ];
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var synth = window.speechSynthesis;
  var SUPPORTED = !!synth && typeof window.SpeechSynthesisUtterance === 'function';

  // 영어 조각: 알파벳으로 시작해 알파벳·숫자·공백·쉼표로 이어지는 덩어리 (예: "The manager who oversees", "50 pages"는 앞 영어에 붙음)
  var EN_RUN = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9'’\-]*(?:[ ,]+(?=[A-Za-zÀ-ÿ0-9])[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9'’\-]*)*[.?!]?/g;
  EN.splitLang = function (s) {
    s = String(s);
    var out = [], last = 0, m;
    EN_RUN.lastIndex = 0;
    while ((m = EN_RUN.exec(s))) {
      if (m.index > last) out.push({ lang: 'ko', text: s.slice(last, m.index) });
      out.push({ lang: 'en', text: m[0] });
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push({ lang: 'ko', text: s.slice(last) });
    return out;
  };

  // 목소리 고르기 (목록은 늦게 도착하기도 해서 바뀔 때마다 다시 고름)
  var VOICE = { ko: null, en: null };
  function pickVoices() {
    if (!SUPPORTED) return VOICE;
    var vs = synth.getVoices() || [];
    VOICE.ko = vs.filter(function (v) { return /^ko/i.test(v.lang) && /google|yuna|sun-?hi|heami|injoon|female/i.test(v.name); })[0] ||
      vs.filter(function (v) { return /^ko/i.test(v.lang); })[0] || null;
    VOICE.en = vs.filter(function (v) { return /^en[-_]US/i.test(v.lang) && /google|samantha|aria|jenny|natural|zira|allison|ava/i.test(v.name); })[0] ||
      vs.filter(function (v) { return /^en[-_]US/i.test(v.lang); })[0] ||
      vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
    return VOICE;
  }
  // 음성을 쓸 수 없는 브라우저: <html class="no-say"> → 발음 듣기 단추를 숨김 (components.css)
  if (!SUPPORTED) document.documentElement.classList.add('no-say');
  if (SUPPORTED) {
    pickVoices();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoices);
    else synth.onvoiceschanged = pickVoices;
  }
  function utter(text, lang, rate) {
    var u = new window.SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-US' : 'ko-KR';
    var v = lang === 'en' ? VOICE.en : VOICE.ko;
    if (v) u.voice = v;
    u.rate = rate;
    return u;
  }

  /* ---------- 음성 해설 ---------- */
  EN.narration = function (opts) {
    opts = opts || {};
    var caps = opts.captions || [];
    var read = (opts.read || []).concat(BASE_READ);
    var rate = opts.rate || function () { return 1; };
    var holdBefore = opts.holdBefore == null ? 0.05 : opts.holdBefore;
    var n = { supported: SUPPORTED, on: false, busy: false, idx: -1, since: 0, len: 0, token: 0 };

    n.line = function (text) {
      return read.reduce(function (s, r) { return s.replace(r[0], r[1]); }, String(text)).replace(/\s{2,}/g, ' ').trim();
    };
    n.reset = function () {
      if (n.supported && n.on) synth.cancel();
      n.busy = false; n.idx = -1; n.token++;
    };
    n.set = function (on) {
      n.on = !!on && n.supported;
      if (n.on) { pickVoices(); n.idx = -1; }
      else { if (n.supported) synth.cancel(); n.busy = false; n.idx = -1; n.token++; }
      return n.on;
    };
    // 한국어·영어 조각을 차례로 읽음. 마지막 조각이 끝나면 busy를 내림
    n.speak = function (text) {
      synth.cancel();
      var token = ++n.token;
      var parts = EN.splitLang(n.line(text)).map(function (p) { return { lang: p.lang, text: p.text.replace(/^[\s,.]+|[\s,]+$/g, '') }; })
        .filter(function (p) { return /[A-Za-zÀ-ÿ0-9가-힣]/.test(p.text); });
      if (!parts.length) { n.busy = false; return; }
      var r = clamp(1.05 * (rate() || 1), 0.6, 2);
      n.busy = true; n.since = performance.now(); n.len = String(text).length;
      parts.forEach(function (p, i) {
        var u = utter(p.text, p.lang, p.lang === 'en' ? clamp(r * 0.92, 0.6, 2) : r);
        if (i === parts.length - 1) u.onend = function () { if (n.token === token) n.busy = false; };
        u.onerror = function () { if (n.token === token) n.busy = false; };
        synth.speak(u);
      });
    };
    // 재생 중 다음 시각을 정할 때: 아직 읽고 있으면 지금 자막의 끝을 넘지 않게
    n.hold = function (T, next) {
      if (!n.on || !n.busy) return next;
      // 끝났다는 신호(onend)가 오지 않는 브라우저를 위한 시간 제한
      if (performance.now() - n.since > (n.len * 0.4 + 6) * 1000) { n.busy = false; return next; }
      var c = caps[n.idx];
      if (!c) return next;
      return Math.min(next, Math.max(T, c.end - holdBefore));
    };
    // 지금 시각의 자막이 바뀌었으면 읽기 시작
    n.sync = function (T, playing) {
      if (!n.on || !playing) return;
      var i = -1;
      for (var k = 0; k < caps.length; k++) if (T >= caps[k].start && T < caps[k].end) { i = k; break; }
      if (i >= 0 && i !== n.idx) { n.idx = i; n.speak(caps[i].text); }
    };
    n.status = function () {
      var ko = VOICE.ko ? VOICE.ko.name : '기본 음성', en = VOICE.en ? VOICE.en.name : '기본 음성';
      return '음성 해설 켜짐 · 한국어 ' + ko + ', 영어 ' + en + '. 음성이 자막을 다 읽을 때까지 영상이 잠깐씩 기다려요.' +
        (VOICE.ko && VOICE.en ? '' : ' 운영체제 설정에서 한국어·영어 음성을 추가하면 더 자연스러워요.');
    };
    return n;
  };

  // 단추(aria-pressed)와 안내 문구를 연결. 음성을 쓸 수 없는 브라우저에서는 단추를 숨김
  EN.narration.bind = function (n, btn, note, hooks) {
    hooks = hooks || {};
    if (!btn) return;
    if (!n.supported) { btn.hidden = true; return; }
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () {
      EN.say.stop();
      var on = n.set(!n.on);
      btn.setAttribute('aria-pressed', String(on));
      if (note) { note.textContent = on ? n.status() : ''; note.hidden = !on; }
      if (on && hooks.onEnable) hooks.onEnable();
      if (!on && hooks.onDisable) hooks.onDisable();
    });
  };

  /* ---------- 영어 발음 듣기 ---------- */
  var sayToken = 0;
  EN.say = function (text, o) {
    o = o || {};
    if (!SUPPORTED) return false;
    pickVoices();
    synth.cancel();
    var token = ++sayToken;
    var u = utter(String(text).replace(/_{2,}/g, '').replace(/\s{2,}/g, ' ').trim(), 'en', o.slow ? 0.62 : 0.9);
    if (o.onend) u.onend = u.onerror = function () { if (token === sayToken) o.onend(); };
    synth.speak(u);
    return true;
  };
  EN.say.supported = SUPPORTED;
  EN.say.stop = function () { if (SUPPORTED) { sayToken++; synth.cancel(); } };
  EN.say.voice = function () { pickVoices(); return VOICE.en; };

  // [data-say="문장"] 단추를 한곳에서 처리: 누르면 읽고, 같은 단추를 곧바로 한 번 더 누르면 천천히 읽음
  // hooks.before(): 읽기 전에 부를 함수 (예: 영상 일시정지)
  var lastSay = { text: '', at: 0, slow: false };
  EN.say.wire = function (root, hooks) {
    hooks = hooks || {};
    root = root || document;
    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-say]');
      if (!b || !SUPPORTED) return;
      e.preventDefault();
      var text = b.getAttribute('data-say'), now = performance.now();
      var slow = text === lastSay.text && now - lastSay.at < 9000 ? !lastSay.slow : false;
      lastSay = { text: text, at: now, slow: slow };
      if (hooks.before) hooks.before();
      document.querySelectorAll('[data-say].saying').forEach(function (x) { x.classList.remove('saying', 'slow'); });
      b.classList.add('saying'); if (slow) b.classList.add('slow');
      EN.say(text, { slow: slow, onend: function () { b.classList.remove('saying', 'slow'); } });
    });
  };
  // 발음 듣기 단추 마크업 (아이콘은 직접 그린 SVG — 이모지는 환경마다 모양이 달라서 쓰지 않음)
  EN.say.button = function (text, label) {
    var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    return '<button type="button" class="en-say" data-say="' + esc(text) + '" title="발음 듣기 (한 번 더 누르면 천천히)" aria-label="' + esc(label || ('발음 듣기: ' + text)) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" stroke-linejoin="round"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg></button>';
  };
})();
