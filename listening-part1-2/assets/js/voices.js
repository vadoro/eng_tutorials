/* 듣기 문제용 목소리 — 말하는 사람마다 다른 영어 목소리로 읽어요.
 * 공통 부품(shared/)은 바꾸지 않고 이 튜토리얼 안에서만 써요. 길 묻기 튜토리얼(directions/)의 목소리 부품과 같은 방식이에요.
 *
 * 소리는 두 가지예요.
 *   ① 미리 만든 음성 파일 (audio/dialogue/clips.js의 window.DIALOGUE_CLIPS, VoiceStudio 합성 음성) — 영상 · 직접 해 보기 · 놀이터 ·
 *      듣기 연습 문제의 문장과 대답은 모두 글이 정해져 있어 파일로 읽어요. 파일 이름은 말하는 사람과 읽을 글로 정해요(LPV.lineId).
 *      만드는 법: 페이지의 window.__dialogueLines() → audio/dialogue/lines.json → tools/voicestudio-dialogue.py (README 참고)
 *   ② 브라우저 음성(speechSynthesis) — 파일이 없거나 못 읽은 말. 기기마다 목소리가 달라요.
 *   한 번에 읽는 줄(seq) 안에서 같은 사람의 말은 한 가지 소리로만 읽어요(그 사람의 말 중 하나라도 파일이 없으면 그 사람은 모두 브라우저 음성).
 *   어느 쪽이든 실제 시험의 녹음과는 억양 · 녹음 품질이 달라요.
 *
 *   LPV.play(seq, { slow, before(), onitem(i), onend(stopped) })
 *     seq: [{ text, sp: 'us' | 'gb' | 'au' | 'ca', gap: 앞에서 쉬는 초 }]
 *     말하기 전에 EN.say.stop()과 before()(음성 해설 멈춤 · 영상 일시정지)를 불러, 두 소리가 겹치지 않게 해요.
 *   LPV.stop()       지금 읽는 것을 멈춤 (읽던 쪽의 onend(true)를 부름)
 *   LPV.status()     어떤 목소리를 쓰는지 한 줄
 *   LPV.supported    파일도 브라우저 음성도 쓸 수 없으면 false → 페이지는 글을 바로 보여 줘요
 *   LPV.hasClip(sp, text) · LPV.lineId(sp, text)   미리 만든 파일이 있는지 · 파일 id
 *
 * 브라우저 음성 고르기: us → en-US, gb → en-GB, au → en-AU, ca → en-CA 목소리를 먼저 찾고,
 * 없으면 미국 영어(없으면 아무 영어) 목소리를 쓰되 높낮이 · 빠르기를 조금씩 바꿔 사람을 구별해요.
 */
(function () {
  'use strict';
  const synth = window.speechSynthesis;
  const OK = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  const ACC = {
    us: { re: /^en[-_]US/i, lang: 'en-US', ko: '미국', pitch: 1.0, rate: 1.0 },
    gb: { re: /^en[-_]GB/i, lang: 'en-GB', ko: '영국', pitch: 1.14, rate: 0.96 },
    au: { re: /^en[-_]AU/i, lang: 'en-AU', ko: '호주', pitch: 0.84, rate: 1.03 },
    ca: { re: /^en[-_]CA/i, lang: 'en-CA', ko: '캐나다', pitch: 1.06, rate: 0.98 },
  };
  const PREF = /natural|neural|online|google|premium|enhanced|samantha|daniel|karen|moira|aria|jenny|guy|libby|ryan|natasha|william|clara|liam|serena|catherine|lee/i;
  let V = null;
  function pick() {
    const vs = OK ? (synth.getVoices() || []) : [];
    const en = vs.filter(v => /^en([-_]|$)/i.test(v.lang || ''));
    const best = list => list.filter(v => PREF.test(v.name || ''))[0] || list[0] || null;
    const base = best(en.filter(v => ACC.us.re.test(v.lang))) || best(en) || null;
    const out = {};
    Object.keys(ACC).forEach(k => {
      const m = best(en.filter(v => ACC[k].re.test(v.lang)));
      out[k] = m ? { voice: m, own: true } : { voice: base, own: false };
    });
    V = out;
    return V;
  }
  if (OK) {
    pick();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', pick); else synth.onvoiceschanged = pick;
  }

  /* ---------- 미리 만든 음성 파일 ---------- */
  // 파일 id: '말하는 사람|읽을 글'의 FNV-1a 32비트 (UTF-16 단위) → 'us-1a2b3c4d'
  const lineId = (sp, text) => {
    const s = sp + '|' + String(text);
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
    seq.forEach(it => { const h = !!clipOf(it.sp, it.text); useFile[it.sp] = (useFile[it.sp] == null ? true : useFile[it.sp]) && h; });
    const fileOf = it => (useFile[it.sp] || !OK) ? clipOf(it.sp, it.text) : null;
    if (!OK && !seq.some(fileOf)) return false;
    if (o.before) o.before();
    if (window.EN && EN.say && EN.say.stop) EN.say.stop();   // 발음 듣기 멈춤
    stop();
    if (OK) synth.cancel();                                   // 다른 쪽이 넣어 둔 말도 모두 비움
    if (OK && (!V || !V.us.voice)) pick();
    if (seq.some(fileOf)) unlock();
    cur = o;
    const my = token, slow = !!o.slow;
    const run = i => {
      if (my !== token) return;
      if (i >= seq.length) { finish(false); return; }
      const it = seq[i], gap = i ? (it.gap != null ? it.gap : 0.8) : 0.05;
      timer = setTimeout(() => {
        if (my !== token) return;
        let done = false;
        const next = () => { if (done) return; done = true; clearTimeout(wd); if (my === token) run(i + 1); };
        const c = fileOf(it);
        if (c) {
          const a = audio(), base = (window.DIALOGUE_CLIPS.base || ''), r = slow ? 0.75 : 1;
          a.onended = next;
          a.onerror = () => { audioStop(); tts(it, slow, next); };   // 파일을 못 읽으면 이 줄만 브라우저 음성
          a.defaultPlaybackRate = r;
          a.src = base + c[0];
          a.playbackRate = r;
          if ('preservesPitch' in a) a.preservesPitch = true;
          wd = setTimeout(next, ((c[1] || 3) / r + 2.5) * 1000);
          speaking = true;
          if (o.onitem) o.onitem(i);
          const p = a.play();
          if (p && p.catch) p.catch(() => { if (my === token && !done) { audioStop(); tts(it, slow, next); } });
          return;
        }
        if (!OK) { next(); return; }
        if (o.onitem) o.onitem(i);
        tts(it, slow, next);
      }, gap * (slow ? 1.3 : 1) * 1000);
    };
    // 브라우저 음성으로 한 줄
    const tts = (it, slow, next) => {
      if (!OK) { next(); return; }
      const A = ACC[it.sp] || ACC.us, v = (V && V[it.sp]) || (V && V.us) || { voice: null, own: false };
      const u = new window.SpeechSynthesisUtterance(it.text);
      u.lang = v.voice && v.voice.lang ? v.voice.lang.replace('_', '-') : A.lang;
      if (v.voice) u.voice = v.voice;
      u.rate = (slow ? 0.66 : 0.92) * (v.own ? 1 : A.rate);
      u.pitch = v.own ? 1 : A.pitch;
      u.lpOwner = 'listen';                                 // 확인용 표시 (어느 쪽이 말했는지)
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
      const vn = C.voices || {};
      return `영어 목소리: VoiceStudio로 미리 만든 합성 음성 — ${Object.keys(ACC).map(k => `${ACC[k].ko}(${vn[k] || '브라우저 음성'})`).join(' · ')}.` +
        (OK ? ' 파일을 읽지 못한 줄은 브라우저 음성으로 읽어요.' : '');
    }
    if (!OK) return '이 브라우저는 음성을 지원하지 않아요. 문장을 글로 보여 줘요.';
    if (!V) pick();
    const parts = Object.keys(ACC).map(k => `${ACC[k].ko} ${V[k].voice ? (V[k].own ? V[k].voice.name : '없음') : '없음'}`);
    const shared = Object.keys(ACC).some(k => !V[k].own);
    return `영어 목소리: ${parts.join(' · ')}.` + (shared ? ' 없는 억양은 다른 영어 목소리의 높낮이와 빠르기를 바꿔 사람을 구별해요.' : '');
  }
  window.LPV = { play, stop, status, get supported() { return OK || has(); }, tts: OK, busy: () => speaking || !!cur, voices: () => (V || pick()), ACC,
    lineId, hasClip: (sp, text) => !!clipOf(sp, text) };
})();
