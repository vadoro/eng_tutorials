/* 듣기 ② Part 3·4 튜토리얼 — 대화 듣기 (화자마다 다른 영어 목소리)
 *
 * 브라우저에 들어 있는 음성(window.speechSynthesis)을 직접 씁니다. 사이트 공통 부품(shared/)은 고치지 않아요.
 * 화자마다 다른 목소리를 고르고(미국 · 영국 · 호주 영어를 먼저 찾음), 목소리가 모자라면 높낮이(pitch)로 구별해요.
 * 말하기 전에 EN.say.stop()과 hooks.before()(영상 일시정지 + 음성 해설 멈춤)를 불러 다른 소리와 겹치지 않게 해요.
 *
 *   LTV.play(세트, { lines: [줄 번호] (없으면 모두), slow, before(), onLine(i), onEnd(끝까지 읽었는지) })
 *   LTV.stop()                 지금 읽는 것을 멈춤 (onEnd(false)를 부름)
 *   LTV.voices(세트)           { 화자: { voice, lang, pitch, rate, name } }
 *   LTV.describe(세트)         ‘여자 — Samantha (en-US) · …’ 처럼 지금 고른 목소리 설명
 *
 * 브라우저 음성은 기기마다 다르고, 실제 시험 녹음의 억양·속도·음질을 그대로 흉내 내지 못해요.
 * 이 튜토리얼은 억양에 익숙해지는 연습이 아니라 문제를 푸는 전략을 익히는 곳이에요(README 참고).
 */
(function () {
  'use strict';
  const synth = window.speechSynthesis;
  const OK = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  const LTV = (window.LTV = { supported: OK, busy: false, set: null, line: -1, slow: false });
  const REGION = { us: /^en[-_]US/i, gb: /^en[-_]GB/i, au: /^en[-_]AU/i, ca: /^en[-_]CA/i };
  const LANG = { us: 'en-US', gb: 'en-GB', au: 'en-AU', ca: 'en-CA' };
  LTV.REGN = { us: '미국', gb: '영국', au: '호주', ca: '캐나다' };
  // 목소리 이름으로 성별 짐작 (모르면 'x')
  const FEM = /(female|woman|samantha|victoria|karen|moira|tessa|fiona|serena|kate|susan|zira|aria|jenny|michelle|emma|libby|sonia|natasha|catherine|hazel|allison|ava|joanna|salli|kimberly|ivy|nicole|olivia|amy|clara|sara|linda|heather|nancy|google us english$)/i;
  const MAL = /(\bmale|daniel|alex\b|fred|oliver|arthur|george|ryan|guy|davis|christopher|eric|brian|william|james|lee\b|gordon|matthew|joey|justin|russell|thomas|mark\b|david|rishi|aaron|tom\b|liam|andrew|roger|steffan)/i;
  const genderOf = v => FEM.test(v.name) ? 'f' : MAL.test(v.name) ? 'm' : 'x';

  let VOICES = [], cache = {};
  function load() { VOICES = OK ? (synth.getVoices() || []).filter(v => /^en/i.test(v.lang)) : []; cache = {}; }
  if (OK) {
    load();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', load);
  }

  // 세트의 화자마다 목소리 고르기: 억양(지역)이 맞으면 +4, 성별이 맞으면 +3, 이미 쓴 목소리면 −8
  LTV.voices = function (S) {
    if (!VOICES.length && OK) load();
    if (cache[S.id]) return cache[S.id];
    const used = new Map(), out = {}, keys = Object.keys(S.spk), seenG = { f: 0, m: 0 };
    keys.forEach(key => {
      const [, g, acc] = S.spk[key];
      let best = null, bs = -1e9;
      VOICES.forEach(v => {
        let sc = 0;
        if (REGION[acc] && REGION[acc].test(v.lang)) sc += 4; else if (/^en[-_](US|GB|AU|CA)/i.test(v.lang)) sc += 1;
        const vg = genderOf(v); sc += vg === g ? 3 : vg === 'x' ? 0.5 : -3;
        if (used.has(v)) sc -= 8;
        if (/natural|neural|premium|enhanced|google/i.test(v.name)) sc += 0.5;
        if (sc > bs) { bs = sc; best = v; }
      });
      const nth = seenG[g]++, reuse = best ? used.get(best) || 0 : 0, vg = best ? genderOf(best) : 'x';
      // 목소리가 없거나, 다른 화자와 같은 목소리거나, 성별이 다르면 높낮이로 구별
      let pitch = 1;
      if (!best || reuse || vg !== g) pitch = g === 'f' ? 1.18 + nth * 0.12 : 0.86 - nth * 0.1;
      if (best) used.set(best, reuse + 1);
      out[key] = { voice: best, lang: best ? best.lang : LANG[acc] || 'en-US', pitch, rate: 1 - (reuse ? 0.05 * reuse : 0), name: best ? best.name : '기본 영어 음성', region: LTV.REGN[acc] };
    });
    cache[S.id] = out;
    return out;
  };
  LTV.describe = function (S) {
    const V = LTV.voices(S);
    return Object.keys(S.spk).map(k => `${S.spk[k][0]} — ${V[k].name}${V[k].voice ? ` (${V[k].lang})` : ''}${V[k].pitch !== 1 ? ', 높낮이 바꿈' : ''}`).join(' · ');
  };

  let token = 0, timer = 0, dog = 0;
  function finish(done) {
    const cb = LTV._end, ln = LTV._line;
    LTV.busy = false; LTV.line = -1; LTV.set = null; LTV._end = null; LTV._line = null;
    if (ln) ln(-1);
    if (cb) cb(done);
  }
  LTV.stop = function () {
    token++; clearTimeout(timer); clearTimeout(dog);
    if (!LTV.busy) return;
    if (OK) synth.cancel();
    finish(false);
  };
  LTV.play = function (S, o) {
    o = o || {};
    if (!OK) return false;
    LTV.stop();
    if (o.before) o.before();
    if (window.EN && EN.say && EN.say.stop) EN.say.stop();
    synth.cancel();
    if (synth.paused && synth.resume) synth.resume();
    const my = ++token, V = LTV.voices(S), idx = o.lines || S.lines.map((_, i) => i);
    Object.assign(LTV, { busy: true, set: S.id, slow: !!o.slow, _end: o.onEnd || null, _line: o.onLine || null });
    let n = 0;
    const step = () => {
      if (my !== token) return;
      if (n >= idx.length) { finish(true); return; }
      const i = idx[n++], l = S.lines[i], v = V[l.s];
      LTV.line = i; if (LTV._line) LTV._line(i);
      const u = new window.SpeechSynthesisUtterance(l.t);
      u.lang = v.lang; if (v.voice) u.voice = v.voice;
      u.pitch = v.pitch; u.rate = (o.slow ? 0.7 : 0.96) * v.rate;
      let done = false;
      const next = () => { if (done || my !== token) return; done = true; clearTimeout(dog); timer = setTimeout(step, o.slow ? 450 : 280); };
      u.onend = next;
      u.onerror = e => { if (my !== token) return; if (e && (e.error === 'interrupted' || e.error === 'canceled')) LTV.stop(); else next(); };
      synth.speak(u);
      // 끝났다는 신호(onend)가 오지 않는 브라우저를 위한 시간 제한
      dog = setTimeout(next, (l.t.length * (o.slow ? 0.13 : 0.09) + 4) * 1000);
    };
    step();
    return true;
  };
})();
