/* 듣기 문제용 목소리 — 브라우저 음성(speechSynthesis)으로 말하는 사람마다 다른 영어 목소리를 골라 읽어요.
 *
 * 녹음 파일이 없어서 기기에 들어 있는 음성을 써요. 기기마다 목소리가 다르고, 실제 시험의 억양 · 녹음 품질과는 달라요.
 * 공통 부품(shared/)은 바꾸지 않고 이 튜토리얼 안에서만 써요.
 *
 *   LPV.play(seq, { slow, before(), onitem(i), onend(stopped) })
 *     seq: [{ text, sp: 'us' | 'gb' | 'au' | 'ca', gap: 앞에서 쉬는 초 }]
 *     말하기 전에 EN.say.stop()과 before()(음성 해설 멈춤 · 영상 일시정지)를 불러, 두 소리가 겹치지 않게 해요.
 *   LPV.stop()       지금 읽는 것을 멈춤 (읽던 쪽의 onend(true)를 부름)
 *   LPV.status()     어떤 목소리를 쓰는지 한 줄
 *   LPV.supported    음성을 쓸 수 없으면 false → 페이지는 글을 바로 보여 줘요
 *
 * 목소리 고르기: us → en-US, gb → en-GB, au → en-AU, ca → en-CA 목소리를 먼저 찾고,
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

  let token = 0, timer = 0, wd = 0, cur = null, speaking = false;
  function finish(stopped) {
    const c = cur; cur = null; speaking = false;
    if (c && c.onend) c.onend(!!stopped);
  }
  function stop() {
    token++; clearTimeout(timer); clearTimeout(wd);
    if (OK && speaking) synth.cancel();
    finish(true);
  }
  function play(seq, o) {
    o = o || {};
    if (!OK || !seq || !seq.length) return false;
    if (o.before) o.before();
    if (window.EN && EN.say && EN.say.stop) EN.say.stop();   // 발음 듣기 멈춤
    stop();
    synth.cancel();                                           // 다른 쪽이 넣어 둔 말도 모두 비움
    if (!V || !V.us.voice) pick();
    cur = o;
    const my = token, slow = !!o.slow;
    const run = i => {
      if (my !== token) return;
      if (i >= seq.length) { finish(false); return; }
      const it = seq[i], gap = i ? (it.gap != null ? it.gap : 0.8) : 0.05;
      timer = setTimeout(() => {
        if (my !== token) return;
        const A = ACC[it.sp] || ACC.us, v = (V && V[it.sp]) || (V && V.us) || { voice: null, own: false };
        const u = new window.SpeechSynthesisUtterance(it.text);
        u.lang = v.voice && v.voice.lang ? v.voice.lang.replace('_', '-') : A.lang;
        if (v.voice) u.voice = v.voice;
        u.rate = (slow ? 0.66 : 0.92) * (v.own ? 1 : A.rate);
        u.pitch = v.own ? 1 : A.pitch;
        u.lpOwner = 'listen';                                 // 확인용 표시 (어느 쪽이 말했는지)
        let done = false;
        const next = () => { if (done) return; done = true; clearTimeout(wd); if (my === token) run(i + 1); };
        u.onend = next;
        // 다른 쪽이 말을 끊으면(취소) 이어서 읽지 않음
        u.onerror = e => {
          if (e && /interrupt|cancel/i.test(e.error || '')) { if (my === token) { token++; clearTimeout(wd); finish(true); } return; }
          next();
        };
        // 끝났다는 신호가 오지 않는 브라우저를 위한 시간 제한
        wd = setTimeout(next, (it.text.length * (slow ? 0.12 : 0.08) + 2.5) * 1000);
        speaking = true;
        if (o.onitem) o.onitem(i);
        synth.speak(u);
      }, gap * (slow ? 1.3 : 1) * 1000);
    };
    run(0);
    return true;
  }
  function status() {
    if (!OK) return '이 브라우저는 음성을 지원하지 않아요. 문장을 글로 보여 줘요.';
    if (!V) pick();
    const parts = Object.keys(ACC).map(k => `${ACC[k].ko} ${V[k].voice ? (V[k].own ? V[k].voice.name : '없음') : '없음'}`);
    const shared = Object.keys(ACC).some(k => !V[k].own);
    return `영어 목소리: ${parts.join(' · ')}.` + (shared ? ' 없는 억양은 다른 영어 목소리의 높낮이와 빠르기를 바꿔 사람을 구별해요.' : '');
  }
  window.LPV = { play, stop, status, supported: OK, busy: () => speaking || !!cur, voices: () => (V || pick()), ACC };
})();
