/* ㅅ · ㅈ 너머 — s · sh · z · zh · y 목소리 — 본보기 낱말 · 문장을 미국식 목소리 넷으로, 한국어식 표기(시 · 제로 · 이어)는 한국어 내레이터로 읽어요.
 * 끝소리 튜토리얼(final-consonants/)의 목소리 부품을 그대로 가져왔어요(잰 값 SZV.meas). 공통 부품(shared/)은 바꾸지 않아요.
 *
 * 소리는 두 가지예요.
 *   ① 미리 만든 음성 파일 (audio/dialogue/clips.js의 window.DIALOGUE_CLIPS, VoiceStudio 합성 음성) — 낱말 · 문장 · 연습 문제처럼
 *      글이 정해진 말. 파일 이름은 말하는 사람과 읽을 글로 정해요(SZV.lineId). 만드는 법은 tools/dialogue-lines.cjs → tools/voicestudio-dialogue.py
 *   ② 브라우저 음성(speechSynthesis) — 파일이 없는 말. 기기에 들어 있는 음성이라 기기마다 목소리가 달라요.
 *   한 번에 읽는 줄(seq) 안에서 같은 사람의 말은 한 가지 소리로만 읽어요(그 사람의 말 중 하나라도 파일이 없으면 그 사람은 모두 브라우저 음성).
 *
 *   SZV.play(seq, { slow, clips, before(), onitem(i), onend(stopped) })
 *     seq: [{ text, sp, gap: 앞에서 쉬는 초 }]
 *     sp: 밝은 선생님 'tc' · 차분한 선생님 'tf' · 미국 여성 'uf' · 미국 남성 'um' (모두 미국 영어) · 한국어식으로 읽는 내레이터 'ko'(시 · 제로 · 이어)
 *     말하기 전에 EN.say.stop()과 before()(음성 해설 멈춤 · 영상 일시정지 · 녹음 재생 멈춤)를 불러, 소리가 겹치지 않게 해요.
 *   SZV.stop() · SZV.status() · SZV.supported · SZV.hasClip(sp, text) · SZV.lineId(sp, text)
 *   SZV.meas(sp, text) — 그 파일을 따로 재 둔 값 (audio/dialogue/measure.js의 window.PRON_MEASURE, 없으면 null)
 *     { s: [[시작 ms, 끝 ms, 크기 dB(가장 큰 음절 = 0), 높이 Hz(못 재면 0)], …음절마다],
 *       f: [20ms마다 높이 Hz, 소리 없음 = 0], e: [20ms마다 크기 dB], fc: s · sh 바람 소리의 무게중심 Hz(짝 낱말만) } — s의 ms는 f · e와 같은 기준(파일의 처음)
 *
 * 브라우저 음성 고르기: 미국 영어 목소리를 사람마다 다르게 찾고, 모자라면 높낮이를 바꿔 구별해요. ko는 한국어 목소리.
 * 브라우저 음성은 기기마다 s · sh 바람 소리의 세기가 달라요(약하면 짝이 잘 갈리지 않기도 해요) — 미리 만든 파일이 기본이에요. 잰 값은 미리 만든 파일에만 있어요.
 */
(function () {
  'use strict';
  const synth = window.speechSynthesis;
  const OK = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  const ACC = {
    tc: { re: /^en[-_]US/i, lang: 'en-US', ko: '미국', who: '밝은 선생님', pitch: 1.0, rate: 1.0 },
    tf: { re: /^en[-_]US/i, lang: 'en-US', ko: '미국', who: '차분한 선생님', pitch: 0.92, rate: 0.95 },
    uf: { re: /^en[-_]US/i, lang: 'en-US', ko: '미국', who: '미국 여성', pitch: 1.16, rate: 1.0 },
    um: { re: /^en[-_]US/i, lang: 'en-US', ko: '미국', who: '미국 남성', pitch: 0.8, rate: 1.0 },
    ko: { re: /^ko[-_]KR/i, lang: 'ko-KR', ko: '한국어', who: '한국어식으로 읽기', pitch: 1.0, rate: 1.0 },
  };
  // 영어 목소리의 보통 빠르기 — 발음을 배우는 곳이라 1배는 조금 빠르게 들려서 살짝 늦춰요(소리 높이는 그대로).
  // 음성 해설의 영어 조각(EN.narration의 enRate)과 발음 듣기(EN.say.rate)도 app.js에서 이 값을 써요. 천천히는 그대로 0.75배.
  const EN_RATE = 0.9;
  const PREF = /natural|neural|online|google|premium|enhanced|samantha|daniel|karen|moira|aria|jenny|guy|libby|ryan|natasha|william|clara|liam|serena|catherine|lee/i;
  let V = null;
  function pick() {
    const vs = OK ? (synth.getVoices() || []) : [];
    const us = vs.filter(v => /^en[-_]US/i.test(v.lang || '')), en = vs.filter(v => /^en([-_]|$)/i.test(v.lang || ''));
    const ranked = (us.length ? us : en).slice().sort((a, b) => (PREF.test(b.name || '') ? 1 : 0) - (PREF.test(a.name || '') ? 1 : 0));
    const base = ranked[0] || null, out = {};
    // 미국 영어 목소리가 여럿이면 사람마다 다른 목소리, 모자라면 같은 목소리의 높낮이로 구별
    ['tc', 'tf', 'uf', 'um'].forEach((k, i) => { out[k] = ranked[i] ? { voice: ranked[i], own: true } : { voice: base, own: false }; });
    const ko = vs.filter(v => /^ko([-_]|$)/i.test(v.lang || ''));
    out.ko = ko.length ? { voice: ko.find(v => PREF.test(v.name || '')) || ko[0], own: true } : { voice: null, own: false };
    V = out;
    return V;
  }
  if (OK) {
    pick();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', pick); else synth.onvoiceschanged = pick;
  }
  const spoken = s => String(s);

  /* ---------- 미리 만든 음성 파일 ---------- */
  // 파일 id: '말하는 사람|읽을 글'의 FNV-1a 32비트 (UTF-16 단위) → 'tc-1a2b3c4d'
  const lineId = (sp, text) => {
    const s = sp + '|' + spoken(text);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return sp + '-' + ('0000000' + h.toString(16)).slice(-8);
  };
  const CL = () => { const c = window.DIALOGUE_CLIPS; return c && c.clips && typeof window.Audio === 'function' ? c : null; };
  const clipOf = (sp, text) => { const c = CL(); return c ? c.clips[lineId(sp, text)] || null : null; };
  const has = () => !!CL() && Object.keys(CL().clips).length > 0;
  // 오디오 하나 (Safari처럼 사용자가 누를 때만 소리를 허락하는 브라우저 때문에, 누른 그 순간에 한 번 풀어 둠)
  const SILENT = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  let AUD = null;
  const audio = () => { if (!AUD && typeof window.Audio === 'function') { AUD = new window.Audio(); AUD.preload = 'auto'; } return AUD; };
  const audioStop = () => { if (!AUD) return; AUD.onended = AUD.onerror = null; if (AUD.src === SILENT) return; try { AUD.pause(); } catch (e) { /* 이미 멈춤 */ } };
  const unlock = () => { const a = audio(); if (!a) return; a.onended = a.onerror = null; a.src = SILENT; const p = a.play(); if (p && p.catch) p.catch(() => { /* 다음에 다시 */ }); };

  let token = 0, timer = 0, wd = 0, cur = null, speaking = false;
  function finish(stopped) {
    const c = cur; cur = null; speaking = false;
    if (c && c.onend) c.onend(!!stopped);
  }
  function stop() {
    token++; clearTimeout(timer); clearTimeout(wd);
    if (OK && speaking) synth.cancel();
    audioStop();
    finish(true);
  }
  function play(seq, o) {
    o = o || {};
    if (!seq || !seq.length) return false;
    // 사람마다: 그 사람의 말이 모두 파일로 있으면 파일, 하나라도 없으면 그 사람은 브라우저 음성 (브라우저 음성을 못 쓰면 있는 파일만)
    const useFile = {};
    seq.forEach(it => { const has = !!clipOf(it.sp, it.text); useFile[it.sp] = (useFile[it.sp] == null ? true : useFile[it.sp]) && has; });
    const fileOf = it => ((o.clips !== false && useFile[it.sp]) || !OK) ? clipOf(it.sp, it.text) : null;
    if (!OK && !seq.some(fileOf)) return false;
    if (o.before) o.before();
    if (window.EN && EN.say && EN.say.stop) EN.say.stop();   // 발음 듣기 멈춤
    stop();
    if (OK) synth.cancel();                                   // 다른 쪽이 넣어 둔 말도 모두 비움
    if (OK && (!V || !V.tc.voice)) pick();
    if (seq.some(fileOf)) unlock();
    cur = o;
    const my = token, slow = !!o.slow;
    const run = i => {
      if (my !== token) return;
      if (i >= seq.length) { finish(false); return; }
      const it = seq[i], gap = i ? (it.gap != null ? it.gap : 0.7) : 0.05;
      timer = setTimeout(() => {
        if (my !== token) return;
        let done = false;
        const next = () => { if (done) return; done = true; clearTimeout(wd); if (my === token) run(i + 1); };
        const c = fileOf(it);
        // 천천히 듣기는 빠른 줄도 천천히 읽음
        const fast = slow ? 1 : (it.rate || 1);
        if (c) {
          const a = audio(), base = (window.DIALOGUE_CLIPS.base || '');
          const r = Math.min(2, (slow ? 0.75 : it.sp === 'ko' ? 1 : EN_RATE) * fast);
          a.onended = next;
          a.onerror = () => { audioStop(); tts(it, slow, fast, next); };   // 파일을 못 읽으면 이 줄만 브라우저 음성
          a.defaultPlaybackRate = r;
          a.src = base + c[0];
          a.playbackRate = r;
          if ('preservesPitch' in a) a.preservesPitch = true;
          wd = setTimeout(next, ((c[1] || 3) / r + 2.5) * 1000);
          speaking = true;
          if (o.onitem) o.onitem(i);
          const p = a.play();
          if (p && p.catch) p.catch(() => { if (my === token && !done) { audioStop(); tts(it, slow, fast, next); } });
          return;
        }
        if (!OK) { next(); return; }
        if (o.onitem) o.onitem(i);
        tts(it, slow, fast, next);
      }, gap * (slow ? 1.3 : 1) * 1000);
    };
    // 브라우저 음성으로 한 줄
    const tts = (it, slow, fast, next) => {
      if (!OK) { next(); return; }
      const A = ACC[it.sp] || ACC.tc, v = (V && V[it.sp]) || (V && V.tc) || { voice: null, own: false };
      const u = new window.SpeechSynthesisUtterance(spoken(it.text));
      u.lang = v.voice && v.voice.lang ? v.voice.lang.replace('_', '-') : A.lang;
      if (v.voice) u.voice = v.voice;
      u.rate = Math.min(2, (slow ? 0.66 : 0.92 * (it.sp === 'ko' ? 1 : EN_RATE)) * fast * (v.own ? 1 : A.rate));
      u.pitch = v.own ? 1 : A.pitch;
      u.apOwner = 'sz';                                 // 확인용 표시 (어느 쪽이 말했는지)
      u.apSp = it.sp;
      u.onend = next;
      // 다른 쪽이 말을 끊으면(취소) 이어서 읽지 않음
      u.onerror = e => {
        if (e && /interrupt|cancel/i.test(e.error || '')) { if (my === token) { token++; clearTimeout(wd); finish(true); } return; }
        next();
      };
      // 끝났다는 신호가 오지 않는 브라우저를 위한 시간 제한
      clearTimeout(wd);
      wd = setTimeout(next, (it.text.length * (slow ? 0.12 : 0.08) + 2.5) * 1000);
      speaking = true;
      synth.speak(u);
    };
    run(0);
    return true;
  }
  function status() {
    const C = has() ? CL() : null;
    if (C) {
      // 이름표가 목소리 이름을 품고 있으면(또는 그 반대면) 긴 쪽 하나만 적어요
      const vn = C.voices || {}, nm = k => {
        const w = ACC[k].who, v = vn[k];
        if (!v) return `${w}(브라우저 음성)`;
        return v.includes(w) ? v : w.includes(v) ? w : `${w}(${v})`;
      };
      return `목소리: VoiceStudio로 미리 만든 합성 음성 — ${['tc', 'tf', 'uf', 'um', 'ko'].map(nm).join(' · ')}. 파일이 없는 말은 브라우저 음성으로 읽어요.`;
    }
    if (!OK) return '이 브라우저는 음성을 지원하지 않아요. 낱말을 글로 보여 줘요.';
    if (!V) pick();
    const nm = k => V[k].voice ? V[k].voice.name + (V[k].own ? '' : ' (높낮이를 바꿈)') : '없음';
    return `목소리(브라우저 음성): 밝은 선생님 ${nm('tc')} · 차분한 선생님 ${nm('tf')} · 미국 여성 ${nm('uf')} · 미국 남성 ${nm('um')} · 한국어 ${nm('ko')}.`;
  }
  // 잰 값(위의 SZV.meas): tools/measure-syllables.py가 쓴 measure.js — 통과한 줄만 있어요
  const meas = (sp, text) => { const M = window.PRON_MEASURE; return M ? M[lineId(sp, text)] || null : null; };
  window.SZV = { play, stop, status, meas, get supported() { return OK || has(); }, tts: OK, busy: () => speaking || !!cur, voices: () => (V || pick()), ACC, spoken, EN_RATE,
    lineId, hasClip: (sp, text) => !!clipOf(sp, text) };
})();
