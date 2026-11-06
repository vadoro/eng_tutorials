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
 *    미리 만든 음성 파일(선택): clips: window.EN_CLIPS
 *      { voice: '목소리 이름', voiceEn: '영어 조각의 목소리 이름(다를 때만)', base: 'audio/narration/', clips: { 조각id: ['파일', 초] } }
 *      자막을 읽기 조각(한국어 · 영어)으로 나눈 뒤, 파일이 있는 조각은 그 파일을, 없는 조각은 브라우저 음성으로 읽어요.
 *      조각 id는 EN.narration.pieceId(lang, text), 조각 목록은 narr.pieces() (tools/narration-pieces.cjs가 씀).
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

  // 조각 id: 'lang|text'의 FNV-1a 32비트 (UTF-16 단위) → 'k1a2b3c4d' · 'e…' (미리 만든 음성 파일 이름)
  var pieceId = function (lang, text) {
    var s = lang + '|' + text, h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return (lang === 'en' ? 'e' : 'k') + ('0000000' + h.toString(16)).slice(-8);
  };
  // 미리 만든 음성 파일을 읽는 오디오 하나 (Safari처럼 사용자가 누를 때만 소리를 허락하는 브라우저 때문에, 단추를 누를 때 한 번 풀어 둠)
  var AUD = null, SILENT = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  var audio = function () { if (!AUD && typeof window.Audio === 'function') { AUD = new window.Audio(); AUD.preload = 'auto'; } return AUD; };
  // 잠금 풀기용 무음(0.01초)은 멈추지 않고 끝나게 둠 (곧바로 멈추면 Safari가 풀린 것으로 보지 않을 수 있어요)
  var audioStop = function () { if (AUD) { AUD.onended = AUD.onerror = null; if (AUD.src === SILENT) return; try { AUD.pause(); } catch (e) { /* 이미 멈춤 */ } } };

  /* ---------- 음성 해설 ---------- */
  EN.narration = function (opts) {
    opts = opts || {};
    var caps = opts.captions || [];
    var read = (opts.read || []).concat(BASE_READ);
    var rate = opts.rate || function () { return 1; };
    var holdBefore = opts.holdBefore == null ? 0.05 : opts.holdBefore;
    var C = opts.clips && opts.clips.clips ? opts.clips : null, CLIPS = C ? C.clips : {}, BASE = C ? (C.base || '') : '';
    var nClips = Object.keys(CLIPS).length, hasClips = nClips > 0 && typeof window.Audio === 'function';
    var clipOf = function (p) { return hasClips ? CLIPS[pieceId(p.lang, p.text)] || null : null; };
    var n = { supported: SUPPORTED || hasClips, on: false, busy: false, idx: -1, since: 0, len: 0, limit: 0, token: 0, clips: hasClips ? nClips : 0 };
    EN.narration.last = n;

    n.line = function (text) {
      return read.reduce(function (s, r) { return s.replace(r[0], r[1]); }, String(text)).replace(/\s{2,}/g, ' ').trim();
    };
    n.reset = function () {
      n.token++;
      if (SUPPORTED && n.on) synth.cancel();
      if (n.on) audioStop();
      n.busy = false; n.idx = -1;
    };
    n.set = function (on) {
      n.on = !!on && n.supported;
      if (n.on) {
        pickVoices(); n.idx = -1;
        // 단추를 누른 지금(사용자의 동작 안에서) 오디오를 한 번 풀어 둠 → 나중에 영상이 흘러가며 파일을 읽을 수 있음
        if (hasClips && audio()) { var a = AUD; a.src = SILENT; var pr = a.play(); if (pr && pr.catch) pr.catch(function () { /* 다음에 다시 시도 */ }); }
      } else { n.token++; if (SUPPORTED) synth.cancel(); audioStop(); n.busy = false; n.idx = -1; }
      return n.on;
    };
    // 읽기 조각: 읽기 바꾸기 → 한·영 나누기 → 앞뒤 기호 다듬기 (음성 파일의 조각 id도 이 글로 정해요)
    n.parts = function (text) {
      return EN.splitLang(n.line(text)).map(function (p) { return { lang: p.lang, text: p.text.replace(/^[\s,.]+|[\s,]+$/g, '') }; })
        .filter(function (p) { return /[A-Za-zÀ-ÿ0-9가-힣]/.test(p.text); });
    };
    // 모든 자막의 읽기 조각 (겹치지 않게, 처음 나온 차례대로) → 음성 파일을 미리 만들 목록
    n.pieces = function () {
      var seen = {}, out = [];
      caps.forEach(function (c, ci) {
        n.parts(c.text).forEach(function (p) {
          var id = pieceId(p.lang, p.text);
          if (!seen[id]) { seen[id] = 1; out.push({ id: id, lang: p.lang, text: p.text, cap: ci }); }
        });
      });
      return out;
    };
    // 한국어·영어 조각을 차례로 읽음. 마지막 조각이 끝나면 busy를 내림
    n.speak = function (text) {
      if (SUPPORTED) synth.cancel();
      audioStop();
      var token = ++n.token;
      var parts = n.parts(text);
      if (!parts.length) { n.busy = false; return; }
      var r = clamp(1.05 * (rate() || 1), 0.6, 2);
      n.busy = true; n.since = performance.now(); n.len = String(text).length; n.limit = 0;
      if (parts.some(clipOf)) { speakClips(parts, token, r); return; }
      if (!SUPPORTED) { n.busy = false; return; }
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
      if (performance.now() - n.since > Math.max(n.len * 0.4 + 6, n.limit) * 1000) { n.busy = false; return next; }
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
    // 조각을 차례로: 음성 파일이 있으면 파일로, 없으면 브라우저 음성으로 (파일을 못 읽으면 그 조각만 브라우저 음성으로)
    function speakClips(parts, token, r) {
      var i = 0;
      n.limit = parts.reduce(function (s, p) { var c = clipOf(p); return s + (c ? (c[1] || 3) / clamp(rate() || 1, 0.5, 2) : p.text.length * 0.3 + 1); }, 0) + 6;
      var tts = function (p) {
        if (!SUPPORTED) { next(); return; }
        var u = utter(p.text, p.lang, p.lang === 'en' ? clamp(r * 0.92, 0.6, 2) : r);
        u.onend = u.onerror = function () { if (n.token === token) next(); };
        synth.speak(u);
      };
      function next() {
        if (n.token !== token) return;
        if (i >= parts.length) { n.busy = false; return; }
        var p = parts[i++], c = clipOf(p), a = c && audio();
        if (!a) { tts(p); return; }
        var done = false, fail = function () { if (done || n.token !== token) return; done = true; tts(p); };
        a.onended = function () { if (done || n.token !== token) return; done = true; next(); };
        a.onerror = fail;
        a.src = BASE + c[0];
        a.playbackRate = clamp(rate() || 1, 0.5, 2);
        var pr = a.play();
        if (pr && pr.catch) pr.catch(fail);
      }
      next();
    }
    n.status = function () {
      var ko = VOICE.ko ? VOICE.ko.name : '기본 음성', en = VOICE.en ? VOICE.en.name : '기본 음성';
      var all = n.pieces(), kc = 0, ec = 0, kn = 0, en0 = 0;
      all.forEach(function (p) { var has = !!clipOf(p); if (p.lang === 'en') { en0++; if (has) ec++; } else { kn++; if (has) kc++; } });
      if (hasClips && kc) ko = (C.voice || '미리 만든 음성') + (kc < kn ? ' (없는 조각은 ' + ko + ')' : '');
      if (hasClips && ec) en = (C.voiceEn || C.voice || '미리 만든 음성') + (ec < en0 ? ' (없는 조각은 ' + en + ')' : '');
      return '음성 해설 켜짐 · 한국어 ' + ko + ', 영어 ' + en + '. 음성이 자막을 다 읽을 때까지 영상이 잠깐씩 기다려요.' +
        (hasClips && kc ? '' : VOICE.ko && VOICE.en ? '' : ' 운영체제 설정에서 한국어·영어 음성을 추가하면 더 자연스러워요.');
    };
    return n;
  };

  EN.narration.pieceId = pieceId;
  // 단추(aria-pressed)와 안내 문구를 연결. 음성을 쓸 수 없는 브라우저에서는 단추를 숨김 (미리 만든 음성 파일이 있으면 보임)
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
