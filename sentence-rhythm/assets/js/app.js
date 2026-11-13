/* 센 낱말, 약한 낱말 — 문장 리듬: 플레이어, 직접 해 보기, can · can't 듣기 시합, 센 낱말 찾기, 내 발음 확인, 따라 말하기, 듣고 고르기, 퀴즈, 영상 추출
 * 낱말 갈래 · 강한 형태와 약한 형태 · 음절의 세기는 grammar.js(SR), 그림은 scenes.js(SRS), 목소리와 잰 값은 voices.js(SRV)가 맡습니다.
 * 소리가 겹치지 않게: 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(SRV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const SR = window.SR, SRS = window.SRS, SRV = window.SRV, S = SRS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = SRS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L3 = 'ABC';
const pickOne = a => a[Math.floor(Math.random() * a.length)];
// 짝 문장(can · can't) 둘이 모두 확인(받아쓰기 · 약한 음절이 짧은지)을 통과한 목소리 — 통과하지 못한 파일은 시합에 들려주지 않아요(잰 값이 하나도 없으면 모든 목소리)
const ALL_SP = SR.VOICES.map(v => v.sp);
const okVoices = p => { const ok = ALL_SP.filter(sp => !!SRV.meas(sp, p.can) && !!SRV.meas(sp, p.cant)); return ok.length || Object.keys(window.PRON_MEASURE || {}).length ? ok : ALL_SP; };
const okPairs = sp => SR.CAN.filter(p => sp === 'all' ? okVoices(p).length : okVoices(p).includes(sp));
const cv = $('cv'), ctx = cv.getContext('2d');
SR.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = SRS.fonts;
const FONT_SET = [[700, F.FD], [800, F.FD], [400, F.FB], [500, F.FB], [600, F.FB], [700, F.FB], [800, F.FB], [400, F.FM], [500, F.FM], [600, F.FM], [700, F.FM], [800, F.FM]];
const loadFonts = text => Promise.race([
  Promise.all(FONT_SET.map(([w, f]) => document.fonts.load(`${w} 20px ${f}`, text).catch(() => null))),
  new Promise(r => setTimeout(r, 15000)),
]).then(() => document.fonts.ready);

/* =========================================================
   2. 영상 추출 — 사이트 공통 렌더러가 쓰는 약속
   ========================================================= */
if (EXPORT) {
  cv.width = 1920; cv.height = 1080;
  const ready = new Promise(res => SRS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '센 낱말, 약한 낱말 — 문장 리듬 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { SRS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
  };
  return;
}

/* =========================================================
   3. 플레이어
   ========================================================= */
let T = 0, playing = false, started = false, speed = 1, dirty = true, lastTs = 0, ccOn = true;
const playBtn = $('playBtn'), bigPlay = $('bigPlay'), seekEl = $('seek'), timeLbl = $('timeLbl'), capBox = $('cap'), capText = $('capText');
const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/></svg>',
};
const SVG_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
const ICO = {
  play: '<svg data-k="play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>',
  stop: '<svg data-k="stop" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  slow: '<svg data-k="slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 3h5"/></svg>',
  mic: SRS.iconSVG('mic'),
  rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="currentColor"/></svg>',
};
// 듣기 · 천천히 단추 묶음 (회화 영역의 듣기 연습 문제와 같은 모양 · 같은 키 R · S)
const lsnBar = () => SRV.supported
  ? `<div class="lsn"><button type="button" class="lbtn say" data-act="play" aria-pressed="false">${ICO.play}<span>듣기</span><small>R</small></button><button type="button" class="lbtn say" data-act="slowplay" aria-pressed="false">${ICO.slow}<span>천천히</span><small>S</small></button><span class="ldr-now" aria-live="polite"></span></div>`
  : '<p class="ldr-nosay">이 브라우저는 음성을 쓸 수 없어 문장을 글로 보여 줘요.</p>';
function paintPlay(box, mode) {
  box.querySelectorAll('.lbtn.say').forEach(b => {
    const on = mode === b.dataset.act, k = on ? 'stop' : b.dataset.act === 'slowplay' ? 'slow' : 'play';
    b.setAttribute('aria-pressed', String(on));
    const lab = b.querySelector('span'); if (lab) lab.textContent = on ? '멈추기' : b.dataset.act === 'slowplay' ? '천천히' : '듣기';
    const ic = b.querySelector('svg'); if (ic && ic.dataset.k !== k) ic.outerHTML = ICO[k];
  });
}
function capHTML(s) {
  return String(s).split('**').map((part, k) => {
    const inner = EN.splitLang(part).map(p => p.lang === 'en' ? `<span class="en" lang="en">${esc(p.text)}</span>` : esc(p.text)).join('');
    return k % 2 ? `<b>${inner}</b>` : inner;
  }).join('');
}
let lastBtn = '', lastCap = null, lastChap = -1;
function syncUI() {
  const btn = playing ? 'pause' : T >= END - 0.01 ? 'replay' : 'play';
  if (btn !== lastBtn) { lastBtn = btn; playBtn.innerHTML = ICON[btn]; playBtn.setAttribute('aria-label', btn === 'pause' ? '일시정지 (스페이스)' : btn === 'replay' ? '처음부터 다시 (스페이스)' : '재생 (스페이스)'); }
  seekEl.value = T;
  timeLbl.textContent = `${fmtT(T)} / ${fmtT(END)}`;
  const cap = started ? SRS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 문장과 음절 공을 누르면 그 소리를 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = SRS.chapterAt(T);
  if (ci !== lastChap) { lastChap = ci; document.querySelectorAll('.chap').forEach((b, i) => b.setAttribute('aria-current', String(i === ci))); buildLab(ci); }
}
function play() {
  if (T >= END - 0.01) T = 0;
  stopSounds();
  playing = true; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}
function pause() { playing = false; NARR.reset(); syncUI(); dirty = true; }
function seek(t) { T = clamp(t, 0, END); started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true; }
function loop(ts) {
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
  if (playing) {
    T = NARR.hold(T, T + dt * speed);
    if (T >= END) { T = END; playing = false; NARR.reset(); }
    syncUI(); NARR.sync(T, playing); dirty = true;
  }
  if (dirty) { dirty = false; SRS.render(ctx, started ? T : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
// 직접 해 보기에서 고르면: 영상을 멈추고 그 장의 u초 장면을 보여 줌
function showAt(u) {
  const ch = CHAPTERS[SRS.chapterAt(T)];
  if (playing) pause();
  T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}

/* =========================================================
   4. 소리 — 목소리 넷 + 한국어식으로 읽기 (voices.js). 읽기 전에 다른 소리는 모두 멈춤
   ========================================================= */
let audioEl = null;                       // 녹음 재생
function stopAudio() { if (audioEl) { try { audioEl.pause(); } catch (e) { /* 이미 멈춤 */ } audioEl = null; } document.querySelectorAll('.sh-play.saying').forEach(b => b.classList.remove('saying')); }
function stopSounds() { EN.say.stop(); SRV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return SRV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름. 같은 단추를 곧바로 다시 누르면 천천히
let lastLp = { b: null, at: 0 };
const lpBtn = (seq, label, cls = '', inner) => SRV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${inner || SVG_PLAY}</button>` : '';
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-lp]');
  if (!b) return;
  const box = b.closest('[data-slow]'), again = lastLp.b === b && performance.now() - lastLp.at < 4000;
  const slow = again || (!!box && box.getAttribute('data-slow') === '1');
  lastLp = { b, at: performance.now() };
  document.querySelectorAll('.lp-play.saying, .wbtn.saying').forEach(x => x.classList.remove('saying'));
  b.classList.add('saying');
  speak(SEQS[+b.dataset.lp], { slow, onend() { b.classList.remove('saying'); } });
});
const tSeq = (text, sp = 'tc') => [{ text, sp }];
const pairSeq = (a, b, sp = 'tc') => [{ text: a, sp }, { text: b, sp, gap: 0.8 }];
const WHO = { tc: '밝은 선생님', tf: '차분한 선생님', uf: '미국 여성', um: '미국 남성', ko: '한국어식' };

/* =========================================================
   5. 글 칠하기 — 센 낱말(mk-str 보라 · 굵게 · 밑줄 / mk-str2 그 낱말의 다른 음절), 약한 낱말(mk-weak 민트),
   강한 형태로 돌아온 기능어(mk-ret 노랑), 한국어식(mk-trap 주황). 대문자 띠: i WANT tə GO tə thə STORE
   ========================================================= */
const MK = { str: 'mk-str', str2: 'mk-str2', ret: 'mk-ret', weak: 'mk-weak' };
const sentHTML = text => '<span lang="en">' + SR.segs(text).map(s => MK[s.role] ? `<mark class="${MK[s.role]}">${esc(s.t)}</mark>` : esc(s.t)).join('') + '</span>';
const capsHTML = text => `<span class="capsb" lang="en">${SR.analyze(text).map(w => { const r = w.form === 'weak' ? 'weak' : w.ret ? 'ret' : 'str'; return `<b class="cb-${r}">${esc(SR.capsWord(w))}</b>`; }).join(' ')}</span>`;
// 문장 단추: 누르면 들려줌(곧바로 다시 누르면 천천히)
const sBtn = (text, sp = 'tc', o = {}) => SRV.supported
  ? `<button type="button" class="wbtn${o.cls ? ' ' + o.cls : ''}" data-lp="${seqId(tSeq(text, sp))}" title="듣기: ${esc(text)}${sp !== 'tc' ? ' · ' + WHO[sp] : ''}">${SVG_PLAY}${o.html || sentHTML(text)}</button>`
  : `<span class="wbtn off">${o.html || sentHTML(text)}</span>`;
const koBtn = (text, label) => SRV.supported ? `<button type="button" class="wbtn ko" data-lp="${seqId([{ text, sp: 'ko' }])}" title="한국어식으로 듣기: ${esc(text)}">${SVG_PLAY}${label || `<mark class="mk-trap">${esc(text)}</mark>`}</button>` : `<span class="wbtn off ko">${label || esc(text)}</span>`;
// 음절 공 (SVG): 잰 값이 있으면 그 목소리를 잰 대로(SRS.ballData), 없으면 엔진의 기본 모양. ‘이 목소리를 잰 값’은 잰 값일 때만
function ballSVG(text, o = {}) {
  const R = o.R || 15, d = SRS.ballData(text, o), n = d.b.length, hpx = R * 0.13;
  const sy = o.ko ? null : SR.sylls(text);
  const labels = o.ko ? SR.koSyl(o.ko) : sy.map(s => s.sp), roles = SRS.ballRoles(text, o.ko);
  const step = Math.max(2 * R + 8, ...labels.map(l => (o.ko ? 1.05 : 0.62) * l.length * R + 12)), wgap = o.ko ? 0 : Math.round(R * 0.45);
  const xs = []; let acc = 0;
  for (let i = 0; i < n; i++) { if (i && sy && sy[i].w !== sy[i - 1].w) acc += wgap; xs.push(acc); acc += step; }
  const Wd = Math.round((n ? xs[n - 1] : 0) + 2 * R + 12), cy0 = Math.round(R * 2.3 + 4), Hh = Math.round(cy0 + R + 22);
  const picks = o.pick == null ? [] : [].concat(o.pick);
  let s = '';
  d.b.forEach((v, i) => {
    const r = SRS.ballR(v, R), cx = 6 + R + xs[i], cy = cy0 - clamp(v.H, -2, 9) * hpx, role = roles[i];
    s += `<circle class="bl ${role}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/>`;
    if (picks.indexOf(i) >= 0) s += `<circle class="bl-pick" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r + 5).toFixed(1)}"/>`;
    const t = o.ko ? labels[i] : role === 'str' || role === 'ret' ? labels[i].toUpperCase() : labels[i].toLowerCase();
    s += `<text class="bl-t ${role}" x="${cx.toFixed(1)}" y="${cy0 + R + 17}" text-anchor="middle">${esc(t)}</text>`;
  });
  const lab = o.ko ? `${o.ko} — 음절 공 ${n}개, 한국어식으로 고르게` : `${text} — 음절 공 ${n}개, 센 낱말 ${SR.strongCount(text)}개${d.measured ? ' (이 목소리를 잰 값)' : ''}`;
  const svg = `<svg class="balls" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="${esc(lab)}">${s}</svg>`;
  return d.measured ? `<span class="bfig">${svg}<small class="meas">이 목소리를 잰 값</small></span>` : svg;
}
// 낱말마다 갈래 · 형태 · 까닭 표
function formTable(text) {
  return `<table class="ftab"><thead><tr><th scope="col">낱말</th><th scope="col">갈래</th><th scope="col">형태</th><th scope="col">까닭</th></tr></thead><tbody>${SR.analyze(text).map(w => {
    const r = w.form === 'weak' ? 'weak' : w.ret ? 'ret' : 'str';
    return `<tr><td lang="en" class="fw ${r}">${esc(w.t)}</td><td>${esc(w.e ? SR.POS[w.e.pos].ko : '')}</td><td class="fw ${r}">${w.form === 'weak' ? `약한 형태 <span class="ipa">${esc(SR.ipa(w.k, 'weak'))}</span>` : w.ret ? `강한 형태 <span class="ipa">${esc(SR.ipa(w.k))}</span>` : '센 낱말'}</td><td>${esc(SR.WHY[w.why].ko)}</td></tr>`;
  }).join('')}</tbody></table>`;
}
const pairLabel = p => p.cant.replace("can't", 'can(’t)');

/* =========================================================
   6. 듣고 고르기 (이 튜토리얼 전용, 회화 영역의 듣기 연습 문제와 같은 .edr 모양) — 소리 먼저, 글은 답한 뒤
   키보드: A · B · C 또는 1 · 2 · 3 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · Enter/→ 다음
   ========================================================= */
const KIND_KO = { can: "can인가요, can't인가요?", count: '센 낱말이 몇 개?', which: '어느 낱말이 세게?', ko: '한국어식은 어느 쪽?', end: '강한 형태인가요, 약한 형태인가요?' };
const SIT = it => ({
  can: "문장 하나를 들려줘요. 가운데 낱말은 can(할 수 있다)인가요, can't(할 수 없다)인가요? 끝의 t 소리보다 모음과 세기를 들어요.",
  count: '구나 문장 하나를 들려줘요. 길고 크게 들린 센 낱말은 몇 개인가요?',
  which: '문장 하나를 들려줘요. 보기 셋 가운데 길고 크게 들린 낱말은?',
  ko: '같은 말을 두 가지로 이어서 들려줘요. 낱말마다 같은 세기로 또박또박 읽은 한국어식은 어느 쪽인가요?',
  end: `문장 하나를 들려줘요. 그 속의 전치사 ${it.w} → 또렷한 강한 형태인가요, 짧은 약한 형태인가요?`,
})[it.kind];
const drillSeq = q => q.seq || tSeq(q.say, q.sp);
function PDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0 }));
  let cur = 0, retry = null, mode = null;
  const hear = SRV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && SRV.busy()) { SRV.stop(); return; }
    const it = items[cur], seq = drillSeq(it);
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(seq, { slow: !!slow, onitem(i) { say(it.kind === 'ko' ? `${i ? '둘째' : '첫째'} 소리 · 말하는 중` : `${WHO[it.sp]} · 말하는 중`); }, onend(stopped) { mode = null; paintPlay(root, null); say(stopped ? '' : '다 들었어요. 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { SRV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; SRV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    SRV.stop();
    s.pick = k; s.hints = 3; render();
    const f = root.querySelector('.edr-next'); if (f) f.focus({ preventScroll: true });
  }
  function hint() { const s = st[cur]; if (s.pick !== null || s.hints >= 3) return; s.hints++; render(); }
  function dots() {
    return '<ol class="edr-dots" aria-label="문제 목록">' + items.map((it, i) => {
      const s = st[i], c = s.pick === null ? '' : s.pick === it.a ? ' ok' : ' no';
      return `<li><button type="button" data-go="${i}" class="${c}${i === cur ? ' cur' : ''}" aria-label="문제 ${i + 1}${s.pick === null ? '' : s.pick === it.a ? ' 정답' : ' 오답'}"${i === cur ? ' aria-current="step"' : ''}>${i + 1}</button></li>`;
    }).join('') + '</ol>';
  }
  // 보기마다 엔진의 까닭
  function notes(it) {
    if (it.kind === 'can') {
      const p = SR.CAN.find(x => x.can === it.say || x.cant === it.say);
      return [`can → 약한 형태 ${SR.ipa('can', 'weak')}, 짧고 흐린 어. ${p.can} 센 낱말 ${SR.strongCount(p.can)}개 → ${SR.caps(p.can)}`,
        `can't → 센 낱말 ${SR.ipa("can't")}, 길고 또렷한 애. ${p.cant} 센 낱말 ${SR.strongCount(p.cant)}개 → ${SR.caps(p.cant)}`];
    }
    if (it.kind === 'count') {
      const ws = SR.analyze(it.say), stw = ws.filter(w => w.form === 'strong').map(w => w.t), wk = ws.filter(w => w.form === 'weak').map(w => w.t);
      return it.opts.map((op, k) => k === it.a ? `센 낱말 ${stw.length}개 → ${stw.join(' · ')}. ${SR.caps(it.say)}` : k < it.a ? `${op}보다 많아요 — 센 낱말은 ${stw.join(' · ')}예요.` : `${op}는 너무 많아요 — 약한 낱말(${wk.join(' · ')})은 세지 않아요.`);
    }
    if (it.kind === 'which') {
      return it.opts.map(o => { const x = SR.wordAt(it.say, o); return `${o} = ${SR.posKo(o)} → ${x.form === 'weak' ? `약한 형태 ${SR.ipa(o, 'weak')}` : x.ret ? `강한 형태로 돌아옴(${SR.WHY[x.why].ko}) ${SR.ipa(o)}` : '센 낱말이라 길고 크게'}`; });
    }
    if (it.kind === 'ko') {
      return it.seq.map(x => x.sp === 'ko' ? `한국어식 → ${x.text}. 낱말마다 같은 세기로, 음절 ${SR.koN(x.text)}개를 고르게` : `영어 리듬 → ${SR.caps(it.en)}. 음절 ${SR.nSyl(it.en)}개, 센 낱말 ${SR.strongCount(it.en)}개만 길고 크게`);
    }
    const x = SR.wordAt(it.say, it.w), strong = x.form === 'strong';
    return [strong ? `${it.w} ${SR.ipa(it.w)} → ${SR.WHY[x.why].long}.` : `강한 형태는 ${SR.ipa(it.w)} — 여기서는 뒤에 낱말이 이어져 약해요.`,
      strong ? `약한 형태는 ${SR.ipa(it.w, 'weak')} — 여기서는 문장 끝이라 강한 형태로 돌아와요.` : `${it.w} ${SR.ipa(it.w, 'weak')} → 문장 가운데라 짧고 흐린 어예요.`];
  }
  function optLab(it, op, k) {
    if (it.kind === 'can') return `<span class="ldr-t" lang="en">${esc(op)}</span><small>${k ? '할 수 없다' : '할 수 있다'}</small>`;
    if (it.kind === 'which') return `<span class="ldr-t" lang="en">${esc(op)}</span>`;
    if (it.kind === 'end') return `<span class="ldr-t">${esc(op)}</span><small class="ipa">${esc(it.w)} ${esc(SR.ipa(it.w, k ? 'weak' : undefined))}</small>`;
    return `<span class="ldr-t">${esc(op)}</span>`;
  }
  function render() { const had = root.contains(document.activeElement); draw(); if (had && !root.contains(document.activeElement)) root.focus({ preventScroll: true }); }
  function draw() {
    const sc = score();
    if (cur < 0) {
      const wrong = items.map((_, i) => i).filter(i => st[i].pick !== items[i].a);
      root.innerHTML = dots() + `<div class="edr-card edr-end"><p class="edr-big">${sc.ok} / ${items.length}</p><p>${esc(cfg.done ? cfg.done(sc.ok, items.length) : '')}</p>
        <div class="edr-acts">${wrong.length ? `<button type="button" class="edr-btn" data-act="retry">틀린 ${wrong.length}문제 다시 풀기</button>` : ''}<button type="button" class="edr-btn ghost" data-act="reset">처음부터 다시</button></div></div>`;
      return;
    }
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = SR.hints(it);
    const o = order(), pos = o.indexOf(cur), reveal = done || !hear, n = it.opts.length;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${SRS.iconSVG('ear', 'pi')}${esc(KIND_KO[it.kind])}</span><span>${retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span><span class="edr-tag">${it.kind === 'ko' ? '소리 둘' : esc(WHO[it.sp])}</span></p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(SIT(it))}</p>`;
    h += lsnBar();
    if (reveal) {
      if (it.kind === 'ko') h += `<p class="ldr-q"><span class="ldr-t">${it.seq.map((x, k) => `<span class="kq">${k ? '둘째' : '첫째'} → ${x.sp === 'ko' ? `<mark class="mk-trap">${esc(x.text)}</mark>` : sentHTML(x.text)}</span>`).join('')}</span></p>`;
      else if (!done && it.kind === 'can') h += `<p class="ldr-q"><span class="ldr-t" lang="en">${esc(it.say.replace(/can't|can/, '___'))}</span></p>`;
      else h += `<p class="ldr-q"><span class="ldr-t">${sentHTML(it.say)}</span>${done ? `<small>${capsHTML(it.say)} · ${esc(SR.meaning(it.say))}</small>` : ''}</p>`;
    }
    h += `<div class="ldr-opts ${n === 3 ? 'three' : 'two'}" role="group" aria-label="보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
      return `<div class="ldr-row${cls}" data-k="${k}"><button type="button" class="ldr-opt big" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L3[k]})</b> ${optLab(it, op, k)}</button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: ${L3.slice(0, n).split('').join(' · ')} 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L3[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L3[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      let cmp = '', head = '음절 공';
      if (it.kind === 'can') {
        const other = SR.partnerOf(it.say);
        head = '같은 목소리로 짝 견줘 듣기';
        cmp = [it.say, other].map(t => `<span class="cmp-w">${sBtn(t, it.sp)}${ballSVG(t, { sp: it.sp, R: 13 })}</span>`).join('') + lpBtn(pairSeq(it.say, other, it.sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서</span>`);
      } else if (it.kind === 'ko') {
        const ko = it.seq.find(x => x.sp === 'ko').text, en = it.seq.find(x => x.sp !== 'ko');
        head = '한국어식 · 영어 리듬 견주기';
        cmp = `<span class="cmp-w">${koBtn(ko)}${ballSVG(en.text, { ko, R: 12 })}</span><span class="cmp-w">${sBtn(en.text, en.sp)}${ballSVG(en.text, { sp: en.sp, R: 13 })}</span>`;
      } else {
        const key = it.kind === 'end' ? it.w : it.opts[it.a];
        const pk = SR.sylls(it.say).findIndex(x => x.k === key.toLowerCase());
        cmp = `<span class="cmp-w">${sBtn(it.say, it.sp)}${ballSVG(it.say, { sp: it.sp, R: 13, pick: pk >= 0 ? pk : null })}</span>`;
      }
      h += `<div class="ldr-cmp"><span>${esc(head)}</span>${cmp}</div>`;
      h += `<div class="edr-acts"><button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button></div>`;
    }
    h += '</div>';
    root.innerHTML = h;
    paintPlay(root, mode);
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !root.contains(b) || b.hasAttribute('data-lp')) return;
    if (b.dataset.go) { retry = null; go(+b.dataset.go, false); return; }
    if (b.dataset.pick) { answer(+b.dataset.pick); return; }
    const act = b.dataset.act;
    if (act === 'play') playLine(false, true);
    else if (act === 'slowplay') playLine(true, true);
    else if (act === 'hint') hint();
    else if (act === 'next') next();
    else if (act === 'retry') { retry = items.map((_, i) => i).filter(i => st[i].pick !== items[i].a); retry.forEach(i => { st[i] = { pick: null, hints: 0 }; }); go(retry[0], true); }
    else if (act === 'reset') { retry = null; st = items.map(() => ({ pick: null, hints: 0 })); go(0, false); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || cur < 0) return;
    const k = e.key.toUpperCase(), i = L3.indexOf(k), d = '123'.indexOf(k);
    if (st[cur].pick === null && (i >= 0 || d >= 0) && k.length === 1) { e.preventDefault(); answer(i >= 0 ? i : d); }
    else if (k === 'H') { e.preventDefault(); hint(); }
    else if (k === 'R' && hear) { e.preventDefault(); playLine(false); }
    else if (k === 'S' && hear) { e.preventDefault(); playLine(true); }
    else if ((e.key === 'ArrowRight' || e.key === 'Enter') && st[cur].pick !== null && !(e.target.closest && e.target.closest('button:not(.edr-next)'))) { e.preventDefault(); next(); }
  });
  render();
  return { go, render, state: () => st };
}

/* =========================================================
   7. 장면별 '직접 해 보기' — 장이 바뀔 때만 다시 만듦
   ========================================================= */
const seg = (name, items, cur, attr) => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${t}</button>`).join('')}</div>`;
const row = (lab, html) => `<div class="cv-row"><span class="cv-lab">${esc(lab)}</span>${html}</div>`;
const labHead = h3 => `<h2>직접 해 보기</h2><div class="lab-top"><h3>${esc(h3)}</h3></div>`;
const clearBtn = '<button class="btn ghost" type="button" id="labClear">영상대로 보기</button>';
const LAB = { cq: null, cqPick: null, cqScore: [0, 0] };
// 문장 고르기 (따라 말하기 28 + 긴 문장 셋)
const poolSelect = (cur, attr) => `<select class="lab-sel" data-sel="${attr}" aria-label="문장 고르기"><option value="">영상대로</option>${SR.SGRP_ORDER.map(gk => `<optgroup label="${esc(SR.SGRP[gk].long)}">${SR.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk).map(([s, i]) => `<option value="${i}"${cur === i ? ' selected' : ''}>${esc(s.en)}</option>`).join('')}</optgroup>`).join('')}<optgroup label="긴 문장">${SR.LONG.map((s, k) => { const i = SR.SENT.length + k; return `<option value="${i}"${cur === i ? ' selected' : ''}>${esc(s.en)}</option>`; }).join('')}</optgroup></select>`;
const pairSelect = (cur, attr, o = {}) => `<select class="lab-sel" ${o.id ? `id="${o.id}"` : `data-sel="${attr}"`} aria-label="짝 문장 고르기">${o.noVideo ? '' : '<option value="">영상대로</option>'}${SR.CAN.map(p => `<option value="${p.id}"${cur === p.id ? ' selected' : ''}>${esc(pairLabel(p))}</option>`).join('')}</select>`;
// 한국어식 · 영어 리듬 공을 나란히
const koEnBalls = (en, ko) => `<div class="cmpballs"><div class="cb ko"><span>한국어식 — 또박또박</span>${koBtn(ko)}${ballSVG(en, { ko, R: 12 })}</div><span class="arr">→</span><div class="cb en"><span>영어 리듬</span>${sBtn(en)}${capsHTML(en)}${ballSVG(en)}</div></div>`;
function canPairPanel(p) {
  const ok = okVoices(p), vs = SR.VOICES.filter(v => ok.includes(v.sp));
  const side = (t, cls, head) => `<div class="pb ${cls}"><span class="pb-h">${head}</span>${sBtn(t)}<small>${esc(SR.meaning(t))} · 센 낱말 ${SR.strongCount(t)}개</small>${capsHTML(t)}${ballSVG(t)}</div>`;
  return `<div class="pairbox">${side(p.can, 'weak', 'can — 짧고 약하게')}${side(p.cant, 'str', "can't — 길고 세게")}</div>
    <div class="voices4"><span>${vs.length === SR.VOICES.length ? '목소리 넷으로 짝 듣기' : `목소리 ${['', '하나로', '둘로', '셋으로'][vs.length]} 짝 듣기 (확인을 통과한 목소리만)`}</span>${vs.map(v => lpBtn(pairSeq(p.can, p.cant, v.sp), `${v.ko}: ${p.can} · ${p.cant}`, 'lp-voice', `${ICO.play}<span>${esc(v.ko)}</span>`)).join('')}</div>`;
}
// 늘어나는 문장: 음절 수 막대 · 잰 문장 길이 막대(잰 값이 있을 때만)
function stretchRows() {
  const rows = SR.STRETCH.map(s => ({ text: s.en })).concat([{ text: SR.STRETCH[SR.STRETCH_KO.of].en, ko: SR.STRETCH_KO.ko }]);
  const durs = rows.map(r => r.ko ? SRS.durOf(r.ko, 'ko') : SRS.durOf(r.text, 'tc'));
  const measured = durs.slice(0, 3).every(Boolean), maxD = Math.max(1, ...durs.filter(Boolean)), maxN = 14;
  let h = `<table class="stab"><thead><tr><th scope="col">문장</th><th scope="col">센 낱말</th><th scope="col">음절 수${measured ? ' · 잰 길이' : ''}</th></tr></thead><tbody>`;
  rows.forEach((r, i) => {
    const n = r.ko ? SR.koN(r.ko) : SR.nSyl(r.text), d = durs[i];
    h += `<tr class="${r.ko ? 'ko' : ''}"><td>${r.ko ? koBtn(r.ko) : sBtn(r.text)}</td><td>${r.ko ? '모두 같게' : SR.strongCount(r.text) + '개'}</td><td><span class="sbar n" style="width:${(n / maxN * 100).toFixed(1)}%"></span><span class="sv">${n}음절</span>${measured && d ? `<br><span class="sbar d" style="width:${(d / maxD * 100).toFixed(1)}%"></span><span class="sv">${(d / 1000).toFixed(2)}초</span>` : ''}</td></tr>`;
  });
  h += '</tbody></table>';
  if (!measured) h += '<p class="note">잰 문장 길이가 아직 없어요 — 음성 파일을 만든 뒤 재면 길이 막대가 나타나요. 지금은 음절 수만 보여 줘요.</p>';
  else {
    const rs = SR.nSyl(rows[2].text) / SR.nSyl(rows[0].text), rd = durs[2] / durs[0];
    h += `<p class="note">이 목소리(밝은 선생님)를 잰 값 → 음절은 ${rs.toFixed(0)}배, 문장 길이는 ${rd.toFixed(1)}배${rd < rs ? ' — 음절만큼 늘지 않았어요. 약한 낱말이 짧게 줄었어요.' : ' — 이 목소리는 음절만큼 늘었어요.'} 자동으로 잰 값이고, 길이는 들려주는 빠르기(영어 0.9배 · 한국어식 1배)로 셈했어요.</p>`;
  }
  return h;
}
const LABS = {
  intro() {
    return labHead('먼저 들어 보기') + `<p>같은 문장을 한국어식으로 또박또박 읽은 소리와 영어 리듬으로 읽은 소리예요. 둘 다 눌러 들어 보세요. 공 하나가 음절 하나예요.</p>
      ${koEnBalls(SR.INTRO.en, SR.INTRO.ko)}
      <p class="note">같은 단추를 곧바로 다시 누르면 천천히 들려줘요. 한국어식은 ${SR.koN(SR.INTRO.ko)}음절을 고르게, 영어는 ${SR.nSyl(SR.INTRO.en)}음절 가운데 센 낱말 ${SR.strongCount(SR.INTRO.en)}개만 크게 말해요.</p>`;
  },
  listen() {
    const q = LAB.cq, sc = LAB.cqScore;
    let h = labHead("can · can't 맛보기") + '<p>짝 문장 하나를 무작위 목소리로 들려줘요. can인지 can\'t인지 골라 보세요. 본격적인 연습은 아래 <a href="#playground">can · can\'t 듣기 시합</a>에서 해요.</p>';
    if (!q) return h + `<div class="acts"><button type="button" class="btn" id="cqNew">${ICO.play} 하나 들려주기</button></div>`;
    const p = SR.canPair(q.id), text = p[q.side], done = LAB.cqPick != null;
    h += `<div class="lq"><p class="note">${esc(WHO[q.sp])}의 목소리 · ${lpBtn(tSeq(text, q.sp), '다시 듣기', 'lp-voice', `${ICO.play}<span>다시 듣기</span>`)}</p><div class="wrow">${[['can', 'can · 할 수 있다'], ['cant', "can't · 할 수 없다"]].map(([f, lab]) => `<button type="button" class="pickw${done ? (f === q.side ? ' right' : f === LAB.cqPick ? ' wrong' : '') : ''}" data-cq="${f}"${done ? ' disabled' : ''}>${esc(lab)}</button>`).join('')}</div>`;
    if (done) h += `<p class="verdict"><b class="${LAB.cqPick === q.side ? 'c-ok' : 'c-no'}">${LAB.cqPick === q.side ? '맞아요' : '아쉬워요'}</b>${sentHTML(text)} · ${sc[0]} / ${sc[1]}</p><div class="cmpballs">${[p.can, p.cant].map(t => `<div class="cb ${t === p.can ? 'weak' : 'en'}"><span>${t === p.can ? 'can — 작은 공' : "can't — 큰 공"}</span>${sBtn(t, q.sp)}${ballSVG(t, { sp: q.sp, R: 14 })}</div>`).join('')}</div><div class="acts"><button type="button" class="btn" id="cqNew">${ICO.play} 하나 더</button></div>`;
    return h + '</div>';
  },
  classes() {
    let h = labHead('문장 하나 갈라 보기') + row('문장', poolSelect(S.csent, 'csent'));
    if (S.csent == null) return h + `<p class="note">문장을 고르면 영상이 멈추고 그 문장을 칠해 보여 줘요. 아래 표는 엔진이 낱말마다 계산한 갈래와 형태예요.</p>${formTable('The kids are waiting for the bus.')}`;
    const s = SR.FIND_POOL[S.csent];
    return h + `<p class="enline">${sBtn(s)}</p><p class="note">${esc(SR.meaning(s))} · 센 낱말 ${SR.strongCount(s)}개</p>${formTable(s)}` + clearBtn;
  },
  weak() {
    const c = S.weak ? SR.weakCard(S.weak) : null;
    let h = labHead('약한 형태 카드 열여덟') + `<div class="wrow sel">${SR.WEAK.map(x => `<button type="button" class="pickw${S.weak === x.k ? ' on' : ''}" data-wk="${esc(x.k)}" aria-pressed="${S.weak === x.k}" lang="en">${esc(SR.entry(x.k).w)}</button>`).join('')}</div>`;
    if (!c) return h + `<p class="note">기능어를 고르면 영상이 멈추고 강한 형태와 약한 형태를 나란히 보여 줘요. 영상에는 앞의 ${SR.WEAK_SHOWN}장만 나와요. 뒤의 카드(${SR.WEAK.slice(SR.WEAK_SHOWN).map(x => SR.entry(x.k).w).join(' · ')})도 여기서 들어 보세요.</p>`;
    const e = SR.entry(c.k);
    return h + `<div class="pairbox"><div class="pb str"><span class="pb-h">강한 형태 — 혼자 말할 때</span>${sBtn(e.w)}<small class="ipa">${esc(SR.ipa(c.k))}</small></div><div class="pb weak"><span class="pb-h">약한 형태 — 문장 속에서</span>${sBtn(c.ex)}<small class="ipa">${esc(SR.ipa(c.k, 'weak'))} · ${esc(c.ko)}</small>${capsHTML(c.ex)}${ballSVG(c.ex)}</div></div>
      <p class="note">${e.reduced ? '약한 형태는 짧고, 모음이 흐린 어(슈와)가 돼요.' : '이 낱말은 모음이 크게 줄지 않고, 짧고 약하게만 지나가요.'} 사전의 약한 형태는 교재의 표준 형태를 손으로 적은 것이에요.</p>` + clearBtn;
  },
  can() {
    const p = S.pair ? SR.canPair(S.pair) : null;
    return labHead('짝 문장 고르기') + row('짝', pairSelect(S.pair, 'pair')) + (p ? canPairPanel(p) + clearBtn : '<p class="note">짝을 고르면 영상이 멈추고 그 짝을 보여 줘요. 여섯 짝 모두 can · can\'t만 달라요. 목소리 넷으로 들어 보세요.</p>');
  },
  chunk() {
    const c = S.chunk != null ? SR.CHUNKS[S.chunk] : null;
    let h = labHead('덩어리 고르기') + `<div class="wrow sel">${SR.CHUNKS.map((x, i) => `<button type="button" class="pickw${S.chunk === i ? ' on' : ''}" data-ch="${i}" aria-pressed="${S.chunk === i}">${sentHTML(x.en)}</button>`).join('')}</div>`;
    if (!c) return h + '<p class="note">덩어리를 고르면 영상이 멈추고 크게 보여 줘요. 약한 낱말은 앞뒤 센 낱말에 붙여 한 숨에 말해요.</p>';
    return h + `<div class="cmpballs one"><div class="cb en"><span>${esc(c.ko)}</span>${sBtn(c.en)}${capsHTML(c.en)}${ballSVG(c.en)}</div></div><p class="note">센 낱말 ${SR.strongCount(c.en)}개 · 약한 음절 ${SR.weakIdx(c.en).length}개. 이어 말할 때 소리가 바뀌는 연음은 다음 꼭지에서 다뤄요.</p>` + clearBtn;
  },
  stretch() {
    return labHead('늘어나는 문장 견주기') + '<p>센 낱말은 셋 그대로이고, 약한 낱말만 늘어요. 눌러 들어 보고 음절 수와 길이를 견줘 보세요.</p>' + stretchRows() +
      '<p class="note">센 낱말 사이 간격을 비슷하게 맞추려는 경향일 뿐, 똑같은 간격은 아니에요.</p>';
  },
  back() {
    const s = S.strong != null ? SR.STRONG[S.strong] : null;
    let h = labHead('강한 형태로 돌아오는 자리') + `<div class="wrow sel">${SR.STRONG.map((x, i) => `<button type="button" class="pickw${S.strong === i ? ' on' : ''}" data-st="${i}" aria-pressed="${S.strong === i}">${sentHTML(x.en)}</button>`).join('')}</div>`;
    if (!s) return h + `<p class="note">문장을 고르면 영상이 멈추고 낱말마다 강한 형태 · 약한 형태와 그 까닭을 보여 줘요. 대명사는 끝에서도 약해요 → ${SR.STAY_WEAK.map(t => sBtn(t)).join(' ')}</p>`;
    return h + `<p class="enline">${sBtn(s.en)}</p><p class="note">${esc(s.ko)} · ${capsHTML(s.en)}</p>${formTable(s.en)}${s.why === 'focus' ? '<p class="note">강조는 말하는 사람의 뜻에 따라 달라요. 합성 음성이 강조를 약하게 낼 수도 있어요.</p>' : ''}` + clearBtn;
  },
  sentence() {
    let h = labHead('문장 고르기') + row('문장', poolSelect(S.sent, 'sent'));
    if (S.sent == null) return h + '<p class="note">따라 말하기의 28문장과 긴 문장 셋 가운데 하나를 고르면 영상에 크게 보여 줘요.</p>';
    const s = SR.FIND_POOL[S.sent];
    return h + `<p class="enline">${sBtn(s)}</p><p class="note">${esc(SR.meaning(s))}</p><p>${capsHTML(s)}</p>${ballSVG(s)}<p class="note">센 낱말 ${SR.strongCount(s)}개 → ${SR.strongWords(s).map(w => esc(w.t)).join(' · ')}</p>` + clearBtn;
  },
  summary() {
    return labHead('이제 직접') + '<p>아래 <a href="#playground">can · can\'t 듣기 시합</a>에서 목소리 넷으로 가르고, <a href="#sfind">센 낱말 찾기</a>로 문장 속 센 낱말을 짚어 보고, <a href="#mypron">내 발음 확인</a>에서 음성 인식이 내 말을 어느 쪽으로 받아 적는지 확인해 보세요. <a href="#shadow">따라 말하기</a> 28문장과 <a href="#drill">듣고 고르기</a> 16문제도 있어요.</p>';
  },
};
function buildLab(ci) {
  const id = CHAPTERS[ci].id;
  $('lab').innerHTML = (LABS[id] || (() => ''))();
}
const relab = () => buildLab(SRS.chapterAt(T));
function cqNew() {
  let p, side;
  const pool = okPairs('all').length ? okPairs('all') : SR.CAN;
  do { p = pickOne(pool); side = Math.random() < 0.5 ? 'can' : 'cant'; } while (pool.length > 1 && LAB.cq && LAB.cq.id === p.id && LAB.cq.side === side);
  const ok = okVoices(p), sp = pickOne(ok.length ? ok : ALL_SP);
  LAB.cq = { id: p.id, side, sp }; LAB.cqPick = null;
  S.pair = p.id; S.voice = sp; dirty = true;
  relab();
  speak(tSeq(p[side], sp));
}
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
  const d = b.dataset;
  if (b.id === 'cqNew') { cqNew(); return; }
  if (d.cq != null) { if (LAB.cqPick != null) return; LAB.cqPick = d.cq; LAB.cqScore[1]++; if (d.cq === LAB.cq.side) LAB.cqScore[0]++; relab(); return; }
  if (b.id === 'labClear') { Object.assign(S, JSON.parse(SRS.DEFAULTS)); dirty = true; relab(); return; }
  if (d.wk != null) { S.weak = S.weak === d.wk ? null : d.wk; showAt(14); relab(); return; }
  if (d.ch != null) { S.chunk = S.chunk === +d.ch ? null : +d.ch; showAt(8); relab(); return; }
  if (d.st != null) { S.strong = S.strong === +d.st ? null : +d.st; showAt(8); relab(); }
});
$('lab').addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.sel) return;
  const v = t.value;
  if (t.dataset.sel === 'pair') { S.pair = v || null; showAt(v ? 26 : 1); }
  else if (t.dataset.sel === 'csent') { S.csent = v === '' ? null : +v; showAt(20); }
  else if (t.dataset.sel === 'sent') { S.sent = v === '' ? null : +v; showAt(8); }
  relab();
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   대문자로 쓴 낱말은 소문자로 읽고(글자 이름으로 읽지 않게), = · + 는 쉼으로 읽어요
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\b([A-Z]{2,})\b/g, m => m.toLowerCase()], [/ = /g, ', '], [/\s\+\s/g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
  enRate: SRV.EN_RATE,      // 영어 조각만 살짝 느리게 (voices.js의 EN_RATE — 문장 소리와 같은 빠르기)
  clips: window.EN_CLIPS,   // 미리 만든 음성 파일(audio/narration/) — 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };
if (window.EN && EN.say) EN.say.rate = SRV.EN_RATE;   // 발음 듣기 단추도 같은 빠르기

/* =========================================================
   9. 음성 인식 · 녹음 (따라 말하기 · 내 발음 확인)
   있는 것부터: 음성 인식(SpeechRecognition) → 녹음(MediaRecorder) → 없으면 소리 내어 따라 하기만
   ========================================================= */
const SRC = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const CAN_REC = !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const SPEAK_MODE = SRC ? 'sr' : CAN_REC ? 'rec' : 'none';
let activeRec = null;   // 지금 듣고 있는 인식기
function stopListening() { if (activeRec) { const r = activeRec; activeRec = null; try { r.abort(); } catch (e) { /* 이미 멈춤 */ } } }
const SR_ERR = {
  'not-allowed': '마이크를 쓸 수 없어요. 브라우저 주소창 옆의 설정에서 이 페이지의 마이크를 허락해 주세요.',
  'service-not-allowed': '이 브라우저에서는 음성 인식을 쓸 수 없어요. 마이크 권한이나 브라우저 설정을 확인해 주세요.',
  'no-speech': '소리가 들리지 않았어요. 마이크 가까이에서 다시 말해 보세요.',
  'audio-capture': '마이크를 찾지 못했어요. 마이크가 연결되어 있는지 확인해 주세요.',
  network: '인터넷 연결 문제로 말을 글로 바꾸지 못했어요. 연결을 확인하고 다시 해 보세요.',
  'language-not-supported': '이 브라우저는 영어 음성 인식을 지원하지 않아요.',
};
function listenOnce({ onText, onFail, onState, alts: nAlt = 3 }) {
  stopSounds(); NARR.reset(); if (playing) pause(); stopListening();
  let rec;
  try { rec = new SRC(); } catch (e) { onFail('음성 인식을 시작하지 못했어요.'); return; }
  rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = nAlt; rec.continuous = false;
  let got = false, failed = false, timer = 0;
  rec.onresult = e => { got = true; const r = e.results[0], alts = []; for (let i = 0; i < r.length; i++) alts.push(r[i].transcript); onText(alts); };
  rec.onerror = e => { failed = true; if (e.error !== 'aborted') onFail(SR_ERR[e.error] || `음성 인식에 문제가 생겼어요 (${e.error}).`); };
  rec.onend = () => { clearTimeout(timer); if (activeRec === rec) activeRec = null; onState(false); if (!got && !failed) onFail(SR_ERR['no-speech']); };
  activeRec = rec; onState(true);
  try { rec.start(); } catch (e) { activeRec = null; onState(false); onFail('음성 인식을 시작하지 못했어요. 잠시 뒤 다시 눌러 보세요.'); return; }
  timer = setTimeout(() => { try { rec.stop(); } catch (e) { /* 이미 끝남 */ } }, 9000);
}
// 녹음 한 번 (ms 뒤 저절로 멈춤) → Blob URL
async function recordOnce(ms, onState) {
  stopSounds(); NARR.reset(); if (playing) pause(); stopListening();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mr = new MediaRecorder(stream), chunks = [];
  return new Promise(res => {
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); onState(false); res(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })) : null); };
    mr.start(); onState(true);
    setTimeout(() => { try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } }, ms);
  });
}
const recErr = e => e && e.name === 'NotAllowedError' ? '마이크를 쓸 수 없어요. 브라우저 설정에서 이 페이지의 마이크를 허락해 주세요.' : e && e.name === 'NotFoundError' ? '마이크를 찾지 못했어요. 마이크가 연결되어 있는지 확인해 주세요.' : '녹음을 시작하지 못했어요.';
function playUrl(url, btn, then) {
  stopSounds(); NARR.reset(); if (playing) pause();
  if (!url) return;
  const a = new Audio(url); audioEl = a;
  if (btn) btn.classList.add('saying');
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (btn) btn.classList.remove('saying'); if (then) then(); };
  a.play().catch(() => { audioEl = null; if (btn) btn.classList.remove('saying'); });
}
const pct = ([ok, n]) => n ? Math.round(ok / n * 100) : null;
const pctTxt = v => pct(v) == null ? '–' : pct(v) + '%';
const meterTd = v => `<td><span class="meter"><i style="width:${pct(v) || 0}%"></i></span>${pctTxt(v)}</td>`;

/* =========================================================
   10. 놀이터 ① can · can't 듣기 시합 — 짝 문장 여섯 × 목소리 넷: 듣고 can인지 can't인지 고르면 그 목소리의 공 줄이 나타남
   기록은 이 브라우저에만(localStorage 'en-sr-cc-v1'). 키보드: R 듣기 · 1 can · 2 can't · Space/Enter 다음
   ========================================================= */
const CC_KEY = 'en-sr-cc-v1';
const CC = { voice: 'all', cur: null, pick: null, stats: null, streak: 0, last: '' };
const ccEmpty = () => ({ pair: Object.fromEntries(SR.CAN.map(p => [p.id, [0, 0]])), voice: Object.fromEntries(SR.VOICES.map(v => [v.sp, [0, 0]])), form: { can: [0, 0], cant: [0, 0] } });
function ccLoad() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(CC_KEY) || 'null'); } catch (e) { s = null; }
  const base = ccEmpty();
  if (s && typeof s === 'object') Object.keys(base).forEach(g => Object.keys(base[g]).forEach(k => { const v = s[g] && s[g][k]; if (Array.isArray(v) && v.length === 2) base[g][k] = v.map(x => +x || 0); }));
  CC.stats = base;
}
function ccSave() { try { localStorage.setItem(CC_KEY, JSON.stringify(CC.stats)); } catch (e) { /* 저장하지 못해도 이번에는 계속 */ } }
function ccNew(auto) {
  let p, side;
  const pool = okPairs(CC.voice).length ? okPairs(CC.voice) : SR.CAN;
  do { p = pickOne(pool); side = Math.random() < 0.5 ? 'can' : 'cant'; } while (pool.length > 1 && p.id + side === CC.last);
  const ok = okVoices(p), sp = CC.voice === 'all' ? pickOne(ok.length ? ok : ALL_SP) : CC.voice;
  CC.cur = { id: p.id, side, sp, text: p[side] }; CC.pick = null; CC.last = p.id + side;
  ccDraw();
  if (auto) ccPlay();
}
function ccPlay(slow) { if (!CC.cur) return; const b = $('ccPlayBtn'); if (b) b.classList.add('saying'); speak(tSeq(CC.cur.text, CC.cur.sp), { slow: !!slow, onend() { const x = $('ccPlayBtn'); if (x) x.classList.remove('saying'); } }); }
function ccAnswer(f) {
  const c = CC.cur; if (!c || CC.pick !== null) return;
  CC.pick = f;
  const ok = f === c.side;
  [CC.stats.pair[c.id], CC.stats.voice[c.sp], CC.stats.form[c.side]].forEach(v => { v[1]++; if (ok) v[0]++; });
  CC.streak = ok ? CC.streak + 1 : 0;
  ccSave(); ccDraw();
  const nb = $('ccNext'); if (nb) nb.focus({ preventScroll: true });
}
function ccDraw() {
  const c = CC.cur, box = $('ccMain');
  let h = '';
  if (!c) h = `<p class="hv-hello">목소리 넷 가운데 하나가 짝 문장 하나를 말해요. 가운데 낱말이 can인지 can't인지 고르면, 그 목소리의 음절 공 줄이 짝과 나란히 나타나요. 끝의 t 소리를 기다리지 말고, 가운데 낱말이 짧고 흐리게 지나가는지 길고 세게 끌리는지 들어 보세요.</p><div class="acts"><button type="button" class="btn" id="ccStart">${ICO.play} 시작하기</button></div>`;
  else {
    const p = SR.canPair(c.id), done = CC.pick !== null, ok = done && CC.pick === c.side;
    h += `<div class="hv-top"><button type="button" class="btn hv-play" id="ccPlayBtn">${ICO.play} 듣기 <small>R</small></button><button type="button" class="btn ghost" id="ccSlow">${ICO.slow} 천천히</button><span class="hv-who">${esc(WHO[c.sp])}</span></div>`;
    h += `<div class="hv-opts">${[['can', 'can', '할 수 있다'], ['cant', "can't", '할 수 없다']].map(([f, w, ko], i) => `<button type="button" class="hv-opt${done ? (f === c.side ? ' right' : f === CC.pick ? ' wrong' : ' off') : ''}" data-cc="${f}"${done ? ' disabled' : ''}><b>${i + 1}</b><span lang="en">${esc(w)}</span><small>${ko}</small></button>`).join('')}</div>`;
    if (done) {
      h += `<p class="verdict"><b class="${ok ? 'c-ok' : 'c-no'}">${ok ? '맞아요' : '아쉬워요'}</b>들린 문장 → ${sentHTML(c.text)} · ${esc(SR.meaning(c.text))}${CC.streak > 1 ? ` · 연속 ${CC.streak}번!` : ''}</p>`;
      h += `<div class="cmpballs">${[p.can, p.cant].map(t => `<div class="cb ${t === p.can ? 'weak' : 'en'}${t === c.text ? ' heard' : ''}"><span>${t === p.can ? 'can — 짧고 약하게 (작은 공)' : "can't — 길고 세게 (큰 공)"}${t === c.text ? ' · 들은 문장' : ''}</span>${sBtn(t, c.sp)}${capsHTML(t)}${ballSVG(t, { sp: c.sp, R: 15 })}</div>`).join('')}</div>`;
      h += `<div class="wrow">${lpBtn(pairSeq(p.can, p.cant, c.sp), '짝을 이어서 듣기', 'lp-voice', `${ICO.play}<span>짝을 이어서</span>`)}</div>`;
      h += `<div class="acts"><button type="button" class="btn" id="ccNext">다음 <small>Space</small></button></div>`;
    }
  }
  box.innerHTML = h;
  const st = CC.stats, rows = SR.CAN.map(p => `<tr><th scope="row" lang="en">${esc(pairLabel(p))}</th><td>${st.pair[p.id][0]} / ${st.pair[p.id][1]}</td>${meterTd(st.pair[p.id])}</tr>`).join('');
  const all = Object.values(st.form).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
  $('ccStats').innerHTML = `<table class="hv-tab"><caption>문장마다 맞힌 비율 (이 브라우저에만 저장)</caption><tbody>${rows}<tr class="all"><th scope="row">모두</th><td>${all[0]} / ${all[1]}</td><td>${pctTxt(all)}</td></tr></tbody></table>
    <p class="note">들은 쪽마다: can ${pctTxt(st.form.can)} · can't ${pctTxt(st.form.cant)}<br>목소리마다: ${SR.VOICES.map(v => `${esc(v.ko)} ${pctTxt(st.voice[v.sp])}`).join(' · ')}</p>`;
}
function ccInit() {
  ccLoad();
  $('ccCtl').innerHTML = row('목소리', seg('목소리 고르기', [['all', '넷 섞어서']].concat(SR.VOICES.map(v => [v.sp, v.ko])), CC.voice, 'ccv'));
  ccDraw();
  const root = $('cct');
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    const d = b.dataset;
    if (d.ccv) { CC.voice = d.ccv; root.querySelectorAll('[data-ccv]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); ccNew(false); return; }
    if (b.id === 'ccStart' || b.id === 'ccNext') { ccNew(true); return; }
    if (b.id === 'ccPlayBtn') { ccPlay(false); return; }
    if (b.id === 'ccSlow') { ccPlay(true); return; }
    if (d.cc) { ccAnswer(d.cc); return; }
    if (b.id === 'ccReset') { CC.stats = ccEmpty(); CC.streak = 0; ccSave(); ccDraw(); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('select'))) return;
    const k = e.key.toUpperCase();
    if (k === 'R') { e.preventDefault(); if (!CC.cur) ccNew(true); else ccPlay(false); }
    else if ((k === '1' || k === '2') && CC.cur && CC.pick === null) { e.preventDefault(); ccAnswer(k === '1' ? 'can' : 'cant'); }
    else if ((e.key === ' ' || e.key === 'Enter') && (CC.pick !== null || !CC.cur) && !(e.target.closest && e.target.closest('button:not(#ccNext):not(#ccStart)'))) { e.preventDefault(); ccNew(true); }
  });
}

/* =========================================================
   10. 놀이터 ② 센 낱말 찾기 — 문장을 듣고 센 낱말을 눌러 표시 → 엔진의 갈래와 맞춰 봄(맞은 · 빠진 · 더 누른 낱말과 까닭)
   키보드: R 듣기 · Enter 확인 / 다음
   ========================================================= */
const SF = { i: null, on: [], done: false, score: [0, 0] };
function sfNew(auto) {
  let i;
  do { i = Math.floor(Math.random() * SR.FIND_POOL.length); } while (i === SF.i);
  SF.i = i; SF.on = []; SF.done = false;
  sfDraw();
  if (auto) sfPlay();
}
function sfPlay(slow) { if (SF.i == null) return; speak(tSeq(SR.FIND_POOL[SF.i]), { slow: !!slow }); }
function sfCheck() {
  if (SF.i == null || SF.done) return;
  SF.done = true;
  const ws = SR.analyze(SR.FIND_POOL[SF.i]), ok = ws.every(w => (w.form === 'strong') === (SF.on.indexOf(w.i) >= 0));
  SF.score[1]++; if (ok) SF.score[0]++;
  sfDraw();
  const nb = $('sfNext'); if (nb) nb.focus({ preventScroll: true });
}
function sfDraw() {
  const box = $('sfMain');
  if (SF.i == null) { box.innerHTML = `<p class="hv-hello">문장 하나를 들려줘요. 길고 크게 들린 센 낱말을 눌러 표시한 뒤 확인을 누르세요. 엔진이 계산한 갈래와 맞춰 보고, 강한 형태로 돌아온 낱말과 그 까닭도 알려 줘요.</p><div class="acts"><button type="button" class="btn" id="sfStart">${ICO.play} 시작하기</button></div>`; return; }
  const text = SR.FIND_POOL[SF.i], ws = SR.analyze(text);
  let h = `<div class="hv-top"><button type="button" class="btn hv-play" id="sfPlayBtn">${ICO.play} 듣기 <small>R</small></button><button type="button" class="btn ghost" id="sfSlow">${ICO.slow} 천천히</button><span class="hv-who">${esc(SR.meaning(text))}</span></div>`;
  h += `<div class="sf-words" role="group" aria-label="센 낱말 표시하기">${ws.map(w => {
    const on = SF.on.indexOf(w.i) >= 0, strong = w.form === 'strong';
    const cls = SF.done ? (strong && on ? ' hit' : strong ? ' miss' : on ? ' extra' : ' rest') : '';
    return `<button type="button" class="sfw${cls}${w.ret && SF.done ? ' ret' : ''}" data-sf="${w.i}" aria-pressed="${on}"${SF.done ? ' disabled' : ''} lang="en">${esc(w.t)}</button>`;
  }).join('')}</div>`;
  if (!SF.done) h += `<div class="acts"><button type="button" class="btn" id="sfCheck">확인 <small>Enter</small></button><span class="note">눌러서 표시 · 다시 누르면 지워요</span></div>`;
  else {
    const hit = ws.filter(w => w.form === 'strong' && SF.on.indexOf(w.i) >= 0), miss = ws.filter(w => w.form === 'strong' && SF.on.indexOf(w.i) < 0), extra = ws.filter(w => w.form === 'weak' && SF.on.indexOf(w.i) >= 0);
    const all = !miss.length && !extra.length;
    h += `<p class="verdict"><b class="${all ? 'c-ok' : 'c-mid'}">${all ? '모두 맞아요' : '거의 다 왔어요'}</b>맞은 ${hit.length} · 빠진 ${miss.length} · 더 누른 ${extra.length} · 지금까지 ${SF.score[0]} / ${SF.score[1]}</p>`;
    const lines = miss.map(w => `<li><b class="c-no" lang="en">${esc(w.t)}</b> 빠졌어요 → ${esc(w.ret ? `강한 형태로 돌아온 ${SR.posKo(w.k)} (${SR.WHY[w.why].long})` : `${SR.posKo(w.k)}라 센 낱말이에요`)}</li>`)
      .concat(extra.map(w => `<li><b class="c-mid" lang="en">${esc(w.t)}</b> 더 눌렀어요 → ${esc(SR.posKo(w.k))}, 여기서는 약한 형태 ${esc(SR.ipa(w.k, 'weak'))}</li>`))
      .concat(hit.filter(w => w.ret).map(w => `<li><b class="c-ok" lang="en">${esc(w.t)}</b> 맞아요 → ${esc(SR.WHY[w.why].long)}</li>`));
    if (lines.length) h += `<ul class="sf-why">${lines.join('')}</ul>`;
    h += `<p class="enline">${sBtn(text)}</p><p>${capsHTML(text)}</p>${ballSVG(text)}`;
    h += `<div class="acts"><button type="button" class="btn" id="sfNext">다음 문장 <small>Enter</small></button></div>`;
  }
  box.innerHTML = h;
}
function sfInit() {
  sfDraw();
  const root = $('sfind');
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.id === 'sfStart' || b.id === 'sfNext') { sfNew(true); return; }
    if (b.id === 'sfPlayBtn') { sfPlay(false); return; }
    if (b.id === 'sfSlow') { sfPlay(true); return; }
    if (b.id === 'sfCheck') { sfCheck(); return; }
    if (b.dataset.sf != null && !SF.done) {
      const i = +b.dataset.sf, k = SF.on.indexOf(i);
      if (k >= 0) SF.on.splice(k, 1); else SF.on.push(i);
      b.setAttribute('aria-pressed', String(k < 0));
    }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.toUpperCase() === 'R') { e.preventDefault(); if (SF.i == null) sfNew(true); else sfPlay(false); }
    else if (e.key === 'Enter' && !(e.target.closest && e.target.closest('button:not(#sfCheck):not(#sfNext):not(#sfStart)'))) { e.preventDefault(); if (SF.i == null || SF.done) sfNew(true); else sfCheck(); }
  });
}

/* =========================================================
   10. 놀이터 ③ 내 발음 확인 — 음성 인식이 내 말을 can · can't 어느 쪽으로 받아 적었나 · 녹음해서 본보기와 번갈아 듣기
   발음의 질은 판정하지 않아요(화면에 밝힘)
   ========================================================= */
const MP = { pair: SR.CAN[0].id, side: 'can', url: null, res: null, err: null, busy: false };
const mpTarget = () => { const p = SR.canPair(MP.pair); return { p, text: p[MP.side], other: p[MP.side === 'can' ? 'cant' : 'can'] }; };
function mpDraw() {
  const { text, other } = mpTarget();
  let h = `<div class="mp-ctl">${row('짝', pairSelect(MP.pair, null, { id: 'mpSel', noVideo: true }))}${row('말할 쪽', seg('말할 쪽', [['can', 'can · 할 수 있다'], ['cant', "can't · 할 수 없다"]], MP.side, 'mpside'))}</div>`;
  h += `<div class="mp-body"><div class="mp-fig">${ballSVG(text, { R: 18 })}<small>밝은 선생님의 음절 공</small></div>
    <div class="mp-word"><p class="mp-big">${sentHTML(text)}</p><p>${capsHTML(text)}</p><p class="note">${esc(SR.meaning(text))} · 센 낱말 ${SR.strongCount(text)}개</p>
    <p class="note">${MP.side === 'can' ? 'can은 짧게 붙여 컨에 가깝게, 모음은 흐린 어. 힘은 뒤의 동사에 줘요.' : "can't는 길고 세게, 모음은 또렷한 애. 끝의 t는 약하게 막기만 해도 돼요."}</p>
    <div class="wrow">${sBtn(text)}${sBtn(other)}</div></div></div>`;
  h += '<div class="mp-acts">';
  if (SRC) h += `<button type="button" class="btn" id="mpMic" aria-pressed="false">${ICO.mic}<span>말하고 인식 결과 보기</span></button>`;
  if (CAN_REC) h += `<button type="button" class="btn ghost" id="mpRec" aria-pressed="false">${ICO.rec}<span>3초 녹음</span></button>`;
  if (!SRC && !CAN_REC) h += '<p class="note">이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. 본보기를 듣고 세 번 소리 내어 따라 해 보세요.</p>';
  h += '</div><div class="mp-res" id="mpRes" role="status"></div>';
  $('mpMain').innerHTML = h;
  mpResult();
}
function mpResult() {
  const box = $('mpRes'); if (!box) return;
  let h = '';
  if (MP.res) {
    const r = MP.res, cls = r.verdict === 'target' ? 'c-ok' : r.verdict === 'partner' ? 'c-no' : 'c-mid';
    const tip = MP.side === 'can' ? 'can을 더 짧고 약하게 붙이고, 뒤의 동사를 세게' : "can't를 더 길고 세게, 모음을 또렷한 애로";
    const msg = r.verdict === 'target' ? `인식기가 말하려던 쪽(${SR.FORM_KO[r.want]})으로 받아 적었어요.`
      : r.verdict === 'partner' ? `반대쪽(${SR.FORM_KO[r.got]})으로 받아 적었어요. ${tip} 다시 해 보세요.`
      : r.verdict === 'maybe' ? `말하려던 쪽은 ${r.rank}번째 후보에 있었어요. ${tip} 해 보세요.`
      : r.verdict === 'other' ? '문장을 다르게 받아 적었어요. 문장 전체를 끝까지 말해 보세요.' : '';
    h += `<p class="verdict"><b class="${cls}">${esc(SR.HEARD_KO[r.verdict])}</b>${esc(msg)}</p>`;
    if (r.alts && r.alts.length) h += `<p class="note">인식 후보: ${r.alts.map((a, i) => `<span class="alt${i === 0 ? ' top' : ''}" lang="en">${esc(a)}</span>`).join(' · ')}</p>`;
  }
  if (MP.err) h += `<p class="sh-err">${esc(MP.err)}</p>`;
  if (MP.url) h += `<div class="mo"><button type="button" class="sh-play" id="mpMine">${ICO.play} 내 목소리</button>${SRV.supported ? `<button type="button" class="sh-play" id="mpModel">${ICO.play} 본보기</button><button type="button" class="sh-play" id="mpBoth">${ICO.play} 번갈아 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`;
  box.innerHTML = h;
}
function mpInit() {
  const root = $('mypron');
  mpDraw();
  root.addEventListener('change', e => { if (e.target.id === 'mpSel') { MP.pair = e.target.value; MP.res = null; MP.err = null; mpDraw(); } });
  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.dataset.mpside) { MP.side = b.dataset.mpside; MP.res = null; MP.err = null; mpDraw(); return; }
    const { text } = mpTarget();
    if (b.id === 'mpMic') {
      if (activeRec) { stopListening(); return; }
      MP.err = null; MP.res = null; mpResult();
      listenOnce({ alts: 5,
        onState(on) { const x = $('mpMic'); if (x) { x.setAttribute('aria-pressed', String(on)); x.classList.toggle('on', on); x.querySelector('span').textContent = on ? '듣고 있어요…' : '말하고 인식 결과 보기'; } },
        onText(alts) { MP.res = Object.assign(SR.heard(text, alts), { alts }); mpResult(); },
        onFail(msg) { MP.err = msg; mpResult(); } });
      return;
    }
    if (b.id === 'mpRec') {
      if (MP.busy) return;
      MP.busy = true; MP.err = null;
      try {
        const url = await recordOnce(3000, on => { const x = $('mpRec'); if (x) { x.setAttribute('aria-pressed', String(on)); x.classList.toggle('on', on); x.querySelector('span').textContent = on ? '녹음 중… (3초)' : '3초 녹음'; } });
        if (MP.url) URL.revokeObjectURL(MP.url);
        MP.url = url; if (!url) MP.err = '녹음된 소리가 없어요. 다시 해 보세요.';
        mpResult();
        if (url) playUrl(url, $('mpMine'), () => { if (SRV.supported) speak(tSeq(text)); });
      } catch (err) { MP.err = recErr(err); mpResult(); }
      MP.busy = false;
      return;
    }
    if (b.id === 'mpMine') { playUrl(MP.url, b); return; }
    if (b.id === 'mpModel') { speak(tSeq(text)); return; }
    if (b.id === 'mpBoth') { playUrl(MP.url, $('mpMine'), () => speak(tSeq(text), { onend(stopped) { if (!stopped) playUrl(MP.url, $('mpMine'), () => speak(tSeq(text))); } })); }
  });
}

/* =========================================================
   11. 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). for를 four로, to를 two로, can\'t를 cannot으로 받아 적어도 맞은 것으로 쳐요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = SR.SGRP_ORDER.map(gk => ({ gk, rows: SR.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk) }));
  $('shList').innerHTML = groups.map(({ gk, rows }) => `<section class="sh-grp"><h3><span class="ptag g-${gk}">${esc(SR.SGRP[gk].ko)}</span> ${esc(SR.SGRP[gk].long.split(' — ')[1] || '')}</h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${SRV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-en">${sentHTML(s.en)}</span><small>${esc(s.ko)} · <span class="capsb sm" lang="en">${esc(SR.caps(s.en))}</span></small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { return tSeq(SR.SENT[i].en); }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = SR.SENT[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 센 낱말을 살려 문장을 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, SR.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.marks.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.w)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}</p>`);
    },
    onFail(msg) { shResult(i, `<p class="sh-err">${esc(msg)}</p>`); },
  });
}
async function shRecord(i) {
  if (SHREC.rec) { const r = SHREC.rec; SHREC.rec = null; try { r.stop(); } catch (e) { /* 이미 멈춤 */ } return; }
  stopSounds(); NARR.reset(); if (playing) pause();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { shResult(i, `<p class="sh-err">${esc(recErr(e))}</p>`); return; }
  let mr; try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(t => t.stop()); shResult(i, '<p class="sh-err">녹음을 시작하지 못했어요.</p>'); return; }
  const chunks = [];
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => {
    clearTimeout(SHREC.tm); stream.getTracks().forEach(t => t.stop()); if (SHREC.rec === mr) SHREC.rec = null; shMicState(i, false);
    if (!chunks.length) { shResult(i, '<p class="sh-err">녹음된 소리가 없어요. 다시 해 보세요.</p>'); return; }
    if (SHREC.url[i]) URL.revokeObjectURL(SHREC.url[i]);
    SHREC.url[i] = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${SRV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
    shPlayMine(i, true);
  };
  SHREC.rec = mr; mr.start(); shMicState(i, true);
  shResult(i, '<span class="note">녹음 중이에요. 다 말했으면 ‘멈추기’를 눌러요(6초가 지나면 저절로 멈춰요).</span>');
  SHREC.tm = setTimeout(() => { if (SHREC.rec === mr) { SHREC.rec = null; try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 6000);
}
function shPlayMine(i, thenOrig) {
  const b = document.querySelector(`.sh-row[data-i="${i}"] [data-mine]`);
  playUrl(SHREC.url[i], b, thenOrig && SRV.supported ? () => speak(shSeq(i)) : null);
}
function shInit() {
  shBuild();
  $('shadow').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.shp != null) { document.querySelectorAll('.sh-say.saying').forEach(x => x.classList.remove('saying')); b.classList.add('saying'); speak(shSeq(+d.shp), { onend() { b.classList.remove('saying'); } }); return; }
    if (d.shs != null) { speak(shSeq(+d.shs), { slow: true }); return; }
    if (d.shm != null) { const i = +d.shm; if (SPEAK_MODE === 'sr') shListen(i); else shRecord(i); return; }
    if (d.mine != null) { shPlayMine(+d.mine, false); return; }
    if (d.orig != null) { speak(shSeq(+d.orig)); return; }
    if (d.both != null) shPlayMine(+d.both, true);
  });
}

/* =========================================================
   12. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 그림 문제는 음절 공 무늬(엔진의 세기로 계산)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', p: '#FFC15E', bad: '#FF8E8E', hover: '#6EC8FF', box: '#2A3644' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
const markOf = (i, st) => st.done && i === st.answer ? QCOL.p : st.done && i === st.pick ? QCOL.bad : st.hover === i ? QCOL.hover : null;
function panelFig(label, n, drawOne) {
  const Wd = 640, H = 200, cw = Wd / n;
  return { width: Wd, height: H, label,
    pick: (x, y) => y > 4 && y < H - 4 ? Math.min(n - 1, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      for (let k = 0; k < n; k++) {
        const x = k * cw + 6;
        rrq(g, x, 6, cw - 12, H - 12, 12); g.fillStyle = st.hover === k ? QCOL.box : 'rgba(255,255,255,0.03)'; g.fill();
        g.save(); rrq(g, x, 6, cw - 12, H - 12, 12); g.clip(); drawOne(g, k, x, cw - 12); g.restore();
        const c = markOf(k, st); if (c) { rrq(g, x, 6, cw - 12, H - 12, 12); g.strokeStyle = c; g.lineWidth = 3; g.stroke(); }
        g.beginPath(); g.arc(x + 18, 22, 11, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill();
        g.font = qfont(12, 700); g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], x + 18, 23);
      }
    } };
}
// 음절 공 무늬 넷 (A~D): 공마다 1 = 센 음절, 0 = 약한 음절, 0.6 = 고르게(한국어식)
function ballFig(label, pats, text) {
  return panelFig(label, pats.length, (g, k, x, w) => {
    const p = pats[k], n = p.length, step = Math.min(40, (w - 30) / n), x0 = x + w / 2 - step * (n - 1) / 2;
    p.forEach((v, i) => {
      const r = v === 1 ? 16 : v === 0 ? 8 : 12, cy = 108 - (v === 1 ? 12 : v === 0 ? 0 : 5);
      const c = v === 1 ? '#C9A7FF' : v === 0 ? '#7FE0A8' : '#FF9F7A';
      g.beginPath(); g.arc(x0 + i * step, cy, r, 0, Math.PI * 2); g.fillStyle = v === 0 ? 'rgba(127,224,168,0.3)' : c; g.globalAlpha = v === 0 ? 1 : 0.85; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = c; g.lineWidth = 2; g.stroke();
    });
    if (text) { g.font = qfont(13, 600); g.fillStyle = QCOL.muted; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text[k], x + w / 2, 166); }
  });
}
const QS = (() => {
  const pat = t => SR.levels(t).map(l => l === 1 ? 1 : l === 2 ? 0.6 : 0);
  const same = (a, b) => a.join() === b.join();
  const CANT = "I can't go.", CAN = 'I can go.', CATS = 'The cats have chased the mice.', FOR = ['We are late for class.', 'Who is it for?', 'time for lunch', 'They have left for work.'];
  const q = [
    { q: 'I want to go to the store. → 한국어식으로 또박또박 읽을 때와 영어 리듬의 가장 큰 차이는?', opts: ['영어가 음절이 더 많아요', '영어는 센 낱말만 길고 크게, 나머지는 짧게 붙여요', '한국어식은 끝을 올려요', '차이가 없어요'], a: 1,
      why: `한국어식은 ${SR.koN(SR.INTRO.ko)}음절을 고르게 또박또박 읽어요. 영어는 ${SR.nSyl(SR.INTRO.en)}음절 가운데 센 낱말 ${SR.strongCount(SR.INTRO.en)}개(want · go · store)만 길고 크게, to · the는 짧게 붙여요.`,
      check: () => SR.koN(SR.INTRO.ko) > SR.nSyl(SR.INTRO.en) && SR.strongCount(SR.INTRO.en) === 3 },
    { q: "can · can't를 들을 때 가장 믿을 만한 열쇠는?", opts: ['끝의 t 소리', '문장의 길이', '가운데 낱말의 모음과 세기', '첫 낱말'], a: 2,
      why: "미국 영어에서 can't의 t는 거의 들리지 않을 때가 많아요. can → 짧고 흐린 어(약한 형태), can't → 길고 센 또렷한 애로 갈라요.",
      check: () => SR.CAN.every(p => SR.wordAt(p.can, 'can').form === 'weak' && SR.wordAt(p.cant, "can't").form === 'strong') },
    { q: 'The kids are waiting for the bus. → 기능어(보통 약한 낱말)는?', opts: ['bus', 'waiting', 'kids', 'for'], a: 3,
      why: 'for는 전치사라 기능어예요. kids(명사) · waiting(본동사) · bus(명사)는 뜻을 나르는 내용어라 세요.',
      check: () => SR.isFunction('for') && ['bus', 'waiting', 'kids'].every(k => !SR.isFunction(k)) },
    { q: 'go to bed → 가운데 to는 보통 어떻게 말하나요?', opts: ['짧게, 모음은 흐린 어로 (터에 가깝게)', '투처럼 또렷하게', '아예 빼고 말해요', '가장 길고 크게'], a: 0,
      why: `문장 속의 to는 약한 형태 ${SR.ipa('to', 'weak')}예요. 혼자 말할 때의 강한 형태 ${SR.ipa('to')}처럼 또렷하게 내지 않지만, 빼지도 않아요.`,
      check: () => SR.wordAt('go to bed', 'to').form === 'weak' && SR.entry('to').reduced },
    { q: "I can't go. → 음절 공으로 그리면? 그림을 눌러도 돼요.", opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: ballFig('음절 공 무늬 넷. A 작은 공 둘 큰 공 하나, B 작은 공 하나 큰 공 둘, C 같은 크기 셋, D 큰 공 하나 작은 공 둘', [pat(CAN), pat(CANT), [0.6, 0.6, 0.6], [1, 0, 0]], ['작게 작게 크게', '작게 크게 크게', '고르게', '크게 작게 작게']),
      why: "B → I는 약하고, can't · go 둘 다 센 낱말이에요. A는 I can go.(can이 약해 작은 공), C는 한국어식처럼 고르게 읽은 무늬예요.",
      check: () => same(pat(CANT), [0, 1, 1]) && same(pat(CAN), [0, 0, 1]) },
    { q: 'a cup of tea → 리듬으로 맞는 것은?', opts: ['네 낱말을 같은 세기로', 'a · of를 가장 세게', 'cup · tea만 세게, a · of는 짧게 붙여 한 덩어리로', 'of에서 끊어 두 덩어리로'], a: 2,
      why: '센 낱말은 cup · tea 둘이에요. a · of는 짧은 흐린 어로 앞뒤에 붙여, 한 낱말처럼 이어 말해요.',
      check: () => SR.strongWords('a cup of tea').map(w => w.k).join() === 'cup,tea' },
    { q: 'The cats have chased the mice. → 음절 공으로 그리면? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 0,
      figure: ballFig('음절 공 무늬 넷. A 작은 공과 큰 공이 번갈아 여섯, B 같은 크기 여섯, C 큰 공과 작은 공이 번갈아 여섯, D 큰 공 셋 다음 작은 공 셋', [pat(CATS), [0.6, 0.6, 0.6, 0.6, 0.6, 0.6], [1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 0, 0]], ['작게 크게 번갈아', '고르게', '크게 작게 번갈아', '크게 셋, 작게 셋']),
      why: 'A → The(약) cats(셈) have(약) chased(셈) the(약) mice(셈). 센 낱말 셋 사이에 약한 낱말이 하나씩 끼어요.',
      check: () => same(pat(CATS), [0, 1, 0, 1, 0, 1]) },
    { q: '센 낱말 사이 간격에 대해 맞는 것은?', opts: ['센 낱말 사이는 언제나 똑같은 시간이에요', '문장 길이는 음절 수에 정확히 비례해요', '센 낱말과 약한 낱말은 길이가 같아요', '간격을 비슷하게 맞추려는 경향일 뿐, 똑같은 간격은 아니에요'], a: 3,
      why: '약한 낱말이 끼면 짧게 줄어드는 경향이 있지만, 센 낱말 사이가 똑같은 시간이라는 것은 측정으로 확인되지 않았어요.',
      check: () => SR.STRETCH.every(s => SR.strongCount(s.en) === 3) && SR.STRETCH.map(s => SR.nSyl(s.en)).join() === '3,6,9' },
    { q: '전치사 for가 강한 형태(또렷한 포)로 나오는 것은?', opts: FOR, a: 1,
      why: 'Who is it for? → for 뒤에 낱말이 없어요. 문장 끝의 전치사는 강한 형태로 돌아와요. 나머지는 for 뒤에 낱말이 이어져 약한 형태(퍼에 가깝게)예요.',
      check: () => FOR.map(t => SR.wordAt(t, 'for').form).join() === 'weak,strong,weak,weak' },
    { q: 'My sister wants a new bike. → 센 낱말은?', opts: ['My · sister · wants · a', 'sister · a · new', 'sister · wants · new · bike', 'wants · bike'], a: 2,
      why: 'sister(명사) · wants(본동사) · new(형용사) · bike(명사) — 뜻을 나르는 넷이 세요. My · a는 짧게 붙여요.',
      check: () => SR.strongWords('My sister wants a new bike.').map(w => w.t).join(' · ') === 'sister · wants · new · bike' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[문장 리듬] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 1) console.warn('[문장 리듬] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
  return q;
})();

/* =========================================================
   13. 시작
   ========================================================= */
playBtn.addEventListener('click', () => playing ? pause() : play());
bigPlay.addEventListener('click', () => { T = 0; play(); });
seekEl.addEventListener('input', () => seek(parseFloat(seekEl.value)));
$('speed').addEventListener('change', e => { speed = parseFloat(e.target.value); });
$('ccBtn').addEventListener('click', e => { ccOn = !ccOn; e.currentTarget.setAttribute('aria-pressed', String(ccOn)); capBox.classList.toggle('off', !ccOn); });
$('fsBtn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if ($('player').requestFullscreen) $('player').requestFullscreen().catch(() => {});
});
document.addEventListener('fullscreenchange', () => setTimeout(resize, 60));
$('ttsBtn').addEventListener('click', () => { SRV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = SRS.chapterAt(T);
  if (e.key === ' ' || e.key === 'k') { e.preventDefault(); playing ? pause() : play(); }
  else if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); if (ci + 1 < CHAPTERS.length) seek(CHAPTERS[ci + 1].t); }
  else if (e.key === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); seek(CHAPTERS[T - CHAPTERS[ci].t < 1.5 && ci > 0 ? ci - 1 : ci].t); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); seek(T + 5); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(T - 5); }
  else if (e.key === 'c') $('ccBtn').click();
  else if (e.key === 'f') $('fsBtn').click();
  else if (e.key === 'v' && !$('ttsBtn').hidden) $('ttsBtn').click();
});
CHAPTERS.forEach((ch, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chap';
  b.innerHTML = `<span class="n">${ch.n}</span><span class="tt">${esc(ch.title)}<small>${esc(ch.sub)}</small></span><span class="tm">${fmtT(ch.t)}</span>`;
  b.addEventListener('click', () => { seek(ch.t + 0.01); if (!playing) play(); });
  $('chapters').appendChild(b);
  if (i) { const t = document.createElement('i'); t.style.left = `calc(${ch.t / END * 100}% - 1px)`; $('ticks').appendChild(t); }
});
seekEl.max = END;
$('durLbl').textContent = `${Math.floor(END / 60)}분 ${Math.round(END % 60)}초`;
// 화면 누르기: 문장 · 공 · 한국어식 표기는 그 목소리로, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * SRS.W, (e.clientY - r.top) / r.height * SRS.H]; };
const hitAt = (x, y) => started ? SRS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
let lastHit = { k: '', at: 0 };
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.play && SRV.supported) {
    const k = JSON.stringify(h.play), again = lastHit.k === k && performance.now() - lastHit.at < 4000;
    lastHit = { k, at: performance.now() };
    speak(h.play, { slow: again });
  }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { SRV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = ' ' + SRV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 영상의 문장 · 공 · 한국어식 · 목소리 단추, 직접 해 보기(고르는 것은 하나씩), 듣기 시합(짝 × 목소리 넷), 센 낱말 찾기, 내 발음 확인, 듣고 고르기, 따라 말하기
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text) return;
    const id = SRV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: SRV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(SRS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 누를 수 있는 문장 · 공 · 한국어식 · 목소리 단추. 직접 해 보기로 바뀌는 장면도 하나씩
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t, ch.t + ch.d]; };
    const sweeps = [[{}, [0, END]]]
      .concat(SR.CAN.map(p => [{ pair: p.id }, span('listen')]), SR.CAN.map(p => [{ pair: p.id }, span('can')]))
      .concat(SR.WEAK.map(x => [{ weak: x.k }, span('weak')]), SR.CHUNKS.map((_, i) => [{ chunk: i }, span('chunk')]), SR.STRONG.map((_, i) => [{ strong: i }, span('back')]))
      .concat(SR.FIND_POOL.map((_, i) => [{ csent: i }, span('classes')]), SR.FIND_POOL.map((_, i) => [{ sent: i }, span('sentence')]));
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.5) { SRS.render(g, t); SRS.hits().forEach(h => addSeq(h.play, 'video')); }
    });
    // 2) 직접 해 보기: 장마다 + 고르는 것은 하나씩
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* */ } });
    SR.FIND_POOL.forEach((_, i) => { S.csent = i; LABS.classes(); S.sent = i; LABS.sentence(); });
    SR.WEAK.forEach(x => { S.weak = x.k; LABS.weak(); });
    SR.CAN.forEach(p => { S.pair = p.id; LABS.can(); });
    SR.CHUNKS.forEach((_, i) => { S.chunk = i; LABS.chunk(); });
    SR.STRONG.forEach((_, i) => { S.strong = i; LABS.back(); });
    SR.CAN.forEach(p => ['can', 'cant'].forEach(side => SR.VOICES.forEach(v => { LAB.cq = { id: p.id, side, sp: v.sp }; LAB.cqPick = side; LABS.listen(); })));
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 듣기 시합: 짝 × 목소리 넷 / 센 낱말 찾기: 문장 31(밝은 선생님) / 내 발음 확인: 짝(밝은 선생님)
  SR.CAN.forEach(p => SR.VOICES.forEach(v => { add(v.sp, p.can, 'cct'); add(v.sp, p.cant, 'cct'); }));
  SR.FIND_POOL.forEach(t => add('tc', t, 'sfind'));
  SR.CAN.forEach(p => { add('tc', p.can, 'mypron'); add('tc', p.cant, 'mypron'); });
  // 4) 듣고 고르기: 들려주는 말 + 견줘 듣기(같은 목소리의 짝 문장)
  SR.DRILL.forEach(q => { addSeq(drillSeq(q), 'drill'); const o = q.kind === 'can' && SR.partnerOf(q.say); if (o) add(q.sp, o, 'drill'); });
  // 5) 따라 말하기
  SR.SENT.forEach((_, i) => addSeq(shSeq(i), 'shadow'));
  return out;
};
// 도구용(읽기만): 잴 줄의 정보 — tools/dialogue-lines.cjs가 audio/dialogue/measure-meta.json으로 씀 → tools/measure-syllables.py
// 짧은 구(word: 음절 수 n · 핵 강세 at · 약한 음절 weak) · 한국어식(ko: 한글 글자 수 = 음절 수) · 늘이기 문장(dur: 문장 길이) · 그 밖의 문장(other: 받아쓰기만)
window.__measureMeta = lines => lines.map(l => {
  const o = { id: l.id, sp: l.sp, text: l.text };
  if (l.sp === 'ko') { const k = SR.KO_LINES.find(x => x[0] === l.text); return Object.assign(o, { kind: 'ko', n: SR.koN(l.text) }, k ? { en: k[1] } : {}, l.text === SR.STRETCH_KO.ko ? { dur: true } : {}); }
  if (SR.STRETCH.some(s => s.en === l.text)) return Object.assign(o, { kind: 'other', dur: true });
  if (SR.isPhrase(l.text)) return Object.assign(o, { kind: 'word', key: l.text, n: SR.nSyl(l.text), at: SR.nuclear(l.text), weak: SR.weakIdx(l.text), str: SR.levels(l.text).map((v, i) => v === 1 ? i : -1).filter(i => i >= 0) });
  return Object.assign(o, { kind: 'other' });
});
ccInit();
sfInit();
mpInit();
shInit();
PDrill($('drillRoot'), SR.DRILL, {
  done: (ok, total) => ok === total ? "모두 맞혔어요! can · can't, 센 낱말의 수, 강한 형태로 돌아오는 자리가 귀에 들어오네요." : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보고, 같은 목소리로 견줘 들어 보세요.' : "처음에는 누구나 헷갈려요. 놀이터의 can · can't 듣기 시합으로 여러 목소리를 더 들어 보세요.",
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '센 낱말은 길고 크게, 약한 낱말은 짧게 — 모두 알았네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(SRS.baseText()).then(() => { dirty = true; });
setTimeout(() => SRS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
