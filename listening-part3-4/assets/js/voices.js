/* 듣기 ② Part 3·4 튜토리얼 — 대화 듣기 (화자마다 다른 영어 목소리)
 *
 * 사이트 공통 부품(shared/)은 고치지 않아요. 소리는 두 가지예요.
 *   ① 미리 만든 음성 파일 (audio/dialogue/clips.js의 window.DIALOGUE_CLIPS, VoiceStudio 합성 음성) — 대화 · 담화는 글이 정해져 있어
 *      모두 파일로 읽어요. 목소리는 화자의 성별 · 억양으로 정해요('f-us' 미국 여성, 'm-gb' 영국 남성 …). 파일 이름은 그 열쇠와 읽을 글로
 *      정해요(LTV.lineId). 만드는 법: 페이지의 window.__dialogueLines() → audio/dialogue/lines.json → tools/voicestudio-dialogue.py
 *   ② 브라우저 음성(window.speechSynthesis) — 파일이 없거나 못 읽은 말. 화자마다 다른 목소리를 고르고(미국 · 영국 · 호주 영어를 먼저 찾음),
 *      목소리가 모자라면 높낮이(pitch)로 구별해요. 기기마다 목소리가 달라요.
 *   한 번에 읽는 줄 안에서 같은 화자의 말은 한 가지 소리로만 읽어요(그 화자의 줄 중 하나라도 파일이 없으면 그 화자는 모두 브라우저 음성).
 * 말하기 전에 EN.say.stop()과 hooks.before()(영상 일시정지 + 음성 해설 멈춤)를 불러 다른 소리와 겹치지 않게 해요.
 *
 *   LTV.play(세트, { lines: [줄 번호] (없으면 모두), slow, before(), onLine(i), onEnd(끝까지 읽었는지) })
 *   LTV.stop()                 지금 읽는 것을 멈춤 (onEnd(false)를 부름)
 *   LTV.voices(세트)           { 화자: { voice, lang, pitch, rate, name } } (브라우저 음성)
 *   LTV.describe(세트)         ‘여자 — 미국 여성 · …’ 처럼 지금 쓰는 목소리 설명
 *   LTV.key(세트, 화자)        목소리 열쇠 'f-us' · LTV.lineId(열쇠, 글) 파일 id · LTV.hasClip(열쇠, 글)
 *
 * 어느 쪽이든 실제 시험 녹음의 억양·속도·음질을 그대로 흉내 내지 못해요.
 * 이 튜토리얼은 억양에 익숙해지는 연습이 아니라 문제를 푸는 전략을 익히는 곳이에요(README 참고).
 */
(function () {
  'use strict';
  const synth = window.speechSynthesis;
  const OK = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  const LTV = (window.LTV = { busy: false, set: null, line: -1, slow: false, tts: OK });
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
    const C = CL(), U = fileSpk(S, S.lines.map((_, i) => i)), V = OK ? LTV.voices(S) : {};
    return Object.keys(S.spk).map(k => {
      if (U[k] || !OK) return `${S.spk[k][0]} — ${(C && C.voices && C.voices[keyOf(S, k)]) || '미리 만든 음성'}`;
      return `${S.spk[k][0]} — ${V[k].name}${V[k].voice ? ` (${V[k].lang})` : ''}${V[k].pitch !== 1 ? ', 높낮이 바꿈' : ''}`;
    }).join(' · ') + (Object.keys(S.spk).some(k => U[k]) ? ' (VoiceStudio로 미리 만든 합성 음성)' : '');
  };

  /* ---------- 미리 만든 음성 파일 ---------- */
  // 목소리 열쇠: 성별-억양 ('f-us'). 파일 id: '열쇠|읽을 글'의 FNV-1a 32비트 (UTF-16 단위) → 'f-us-1a2b3c4d'
  const keyOf = (S, s) => { const p = S.spk[s]; return p[1] + '-' + p[2]; };
  const lineId = (sp, text) => {
    const s = sp + '|' + String(text);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return sp + '-' + ('0000000' + h.toString(16)).slice(-8);
  };
  const CL = () => { const c = window.DIALOGUE_CLIPS; return c && c.clips && typeof window.Audio === 'function' ? c : null; };
  const clipOf = (sp, text) => { const c = CL(); return c ? c.clips[lineId(sp, text)] || null : null; };
  const has = () => !!CL() && Object.keys(CL().clips).length > 0;
  Object.defineProperty(LTV, 'supported', { get: () => OK || has(), enumerable: true });
  Object.assign(LTV, { key: keyOf, lineId, hasClip: (sp, text) => !!clipOf(sp, text) });
  // 화자마다 파일로 읽을 수 있는지 (읽을 줄이 모두 파일로 있어야)
  const fileSpk = (S, idx) => {
    const u = {};
    idx.forEach(i => { const l = S.lines[i], h = !!clipOf(keyOf(S, l.s), l.t); u[l.s] = (u[l.s] == null ? true : u[l.s]) && h; });
    return u;
  };
  // 오디오 하나 (Safari처럼 사용자가 누를 때만 소리를 허락하는 브라우저 때문에, 누른 그 순간에 한 번 풀어 둠)
  const SILENT = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  let AUD = null;
  const audio = () => { if (!AUD && typeof window.Audio === 'function') { AUD = new window.Audio(); AUD.preload = 'auto'; } return AUD; };
  const audioStop = () => { if (!AUD) return; AUD.onended = AUD.onerror = null; if (AUD.src === SILENT) return; try { AUD.pause(); } catch (e) { /* 이미 멈춤 */ } };
  const unlock = () => { const a = audio(); if (!a) return; a.onended = a.onerror = null; a.src = SILENT; const p = a.play(); if (p && p.catch) p.catch(() => { /* 다음에 다시 */ }); };

  let token = 0, timer = 0, dog = 0;
  function finish(done) {
    const cb = LTV._end, ln = LTV._line;
    LTV.busy = false; LTV.line = -1; LTV.set = null; LTV._end = null; LTV._line = null;
    if (ln) ln(-1);
    if (cb) cb(done);
  }
  LTV.stop = function () {
    token++; clearTimeout(timer); clearTimeout(dog);
    audioStop();
    if (!LTV.busy) return;
    if (OK) synth.cancel();
    finish(false);
  };
  LTV.play = function (S, o) {
    o = o || {};
    const idx = o.lines || S.lines.map((_, i) => i), U = fileSpk(S, idx);
    const fileOf = l => (U[l.s] || !OK) ? clipOf(keyOf(S, l.s), l.t) : null;
    if (!OK && !idx.some(i => fileOf(S.lines[i]))) return false;
    LTV.stop();
    if (o.before) o.before();
    if (window.EN && EN.say && EN.say.stop) EN.say.stop();
    if (OK) { synth.cancel(); if (synth.paused && synth.resume) synth.resume(); }
    if (idx.some(i => fileOf(S.lines[i]))) unlock();
    const my = ++token, V = OK ? LTV.voices(S) : {};
    Object.assign(LTV, { busy: true, set: S.id, slow: !!o.slow, _end: o.onEnd || null, _line: o.onLine || null });
    let n = 0;
    const step = () => {
      if (my !== token) return;
      if (n >= idx.length) { finish(true); return; }
      const i = idx[n++], l = S.lines[i];
      LTV.line = i; if (LTV._line) LTV._line(i);
      let done = false;
      const next = () => { if (done || my !== token) return; done = true; clearTimeout(dog); timer = setTimeout(step, o.slow ? 450 : 280); };
      const c = fileOf(l);
      if (c) {
        const a = audio(), r = o.slow ? 0.75 : 1;
        a.onended = next;
        a.onerror = () => { audioStop(); tts(l, next); };   // 파일을 못 읽으면 이 줄만 브라우저 음성
        a.defaultPlaybackRate = r;
        a.src = (window.DIALOGUE_CLIPS.base || '') + c[0];
        a.playbackRate = r;
        if ('preservesPitch' in a) a.preservesPitch = true;
        dog = setTimeout(next, ((c[1] || 3) / r + 2.5) * 1000);
        const p = a.play();
        if (p && p.catch) p.catch(() => { if (my === token && !done) { audioStop(); tts(l, next); } });
        return;
      }
      tts(l, next);
    };
    // 브라우저 음성으로 한 줄
    const tts = (l, next) => {
      if (!OK) { next(); return; }
      const v = V[l.s];
      const u = new window.SpeechSynthesisUtterance(l.t);
      u.lang = v.lang; if (v.voice) u.voice = v.voice;
      u.pitch = v.pitch; u.rate = (o.slow ? 0.7 : 0.96) * v.rate;
      u.onend = next;
      u.onerror = e => { if (my !== token) return; if (e && (e.error === 'interrupted' || e.error === 'canceled')) LTV.stop(); else next(); };
      synth.speak(u);
      // 끝났다는 신호(onend)가 오지 않는 브라우저를 위한 시간 제한
      clearTimeout(dog);
      dog = setTimeout(next, (l.t.length * (o.slow ? 0.13 : 0.09) + 4) * 1000);
    };
    step();
    return true;
  };
})();
