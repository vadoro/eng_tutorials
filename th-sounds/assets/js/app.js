/* 혀끝을 이 사이로 — th 소리 둘 — 플레이어, 직접 해 보기, 듣고 가르기 훈련, 내 발음 확인, 따라 말하기, 듣고 고르기, 퀴즈, 영상 추출
 * 규칙과 낱말은 grammar.js(TH), 그림은 scenes.js(THS)와 공통 부품 EN.mouth, 목소리는 voices.js(THV)가 맡습니다.
 * 소리가 겹치지 않게: 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(THV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const TH = window.TH, THS = window.THS, THV = window.THV, S = THS.S, M = EN.mouth;
const { CHAPTERS, CAPTIONS, END, POSTER } = THS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L2 = 'AB';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const cv = $('cv'), ctx = cv.getContext('2d');
TH.check();
// 03 · 04장 자막(‘th 소리는 s 소리보다 훨씬 약하고 … 목소리 넷의 바람 소리’ · ‘재어 보면 둘 다 s 소리보다 훨씬 약해요’)과 잰 값이 맞는지 — 잰 값이 있을 때만
if (window.PRON_MEASURE && Object.keys(window.PRON_MEASURE).length) {
  const A = THS.windRows(...THS.WIND.th), B = THS.windRows(...THS.WIND.ft);
  if (A.length !== TH.VOICES.length) console.warn('[th 소리] 03장: think · sink를 모두 잰 목소리가 넷이 아니에요:', A.map(r => r.sp));
  A.forEach(r => { if (r.b - r.a < 10) console.warn(`[th 소리] 03장: ${r.ko}의 think · sink 바람 세기 차가 10dB보다 작아요:`, r.a, r.b); });
  if (B.length !== TH.VOICES.length) console.warn('[th 소리] 04장: thin · fin을 모두 잰 목소리가 넷이 아니에요:', B.map(r => r.sp));
  // thin · fin은 둘 다 같은 목소리의 sink보다 10dB 이상 약해야 해요(th · f 사이의 차는 소리마다 달라서 따로 기준을 두지 않아요)
  const SK = {}; A.forEach(r => { SK[r.sp] = r.b; });
  B.forEach(r => { if (SK[r.sp] == null || SK[r.sp] - Math.max(r.a, r.b) < 10) console.warn(`[th 소리] 04장: ${r.ko}의 thin · fin이 sink보다 10dB 이상 약하지 않아요:`, r.a, r.b, SK[r.sp]); });
}

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = THS.fonts;
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
  const ready = new Promise(res => THS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '혀끝을 이 사이로 — th 소리 둘 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { THS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: THS.iconSVG('mic'),
  rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="currentColor"/></svg>',
};
// 듣기 · 천천히 단추 묶음 (회화 영역의 듣기 연습 문제와 같은 모양 · 같은 키 R · S)
const lsnBar = () => THV.supported
  ? `<div class="lsn"><button type="button" class="lbtn say" data-act="play" aria-pressed="false">${ICO.play}<span>듣기</span><small>R</small></button><button type="button" class="lbtn say" data-act="slowplay" aria-pressed="false">${ICO.slow}<span>천천히</span><small>S</small></button><span class="ldr-now" aria-live="polite"></span></div>`
  : '<p class="ldr-nosay">이 브라우저는 음성을 쓸 수 없어 낱말을 글로 보여 줘요.</p>';
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
  const cap = started ? THS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 낱말을 누르면 그 소리를 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = THS.chapterAt(T);
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
  if (dirty) { dirty = false; THS.render(ctx, started ? T : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
// 직접 해 보기에서 고르면: 영상을 멈추고 그 장의 u초 장면을 보여 줌
function showAt(u) {
  const ch = CHAPTERS[THS.chapterAt(T)];
  if (playing) pause();
  T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}

/* =========================================================
   4. 소리 — 목소리 넷 + 한국어식으로 읽기 (voices.js). 읽기 전에 다른 소리는 모두 멈춤
   ========================================================= */
let audioEl = null;                       // 녹음 재생
function stopAudio() { if (audioEl) { try { audioEl.pause(); } catch (e) { /* 이미 멈춤 */ } audioEl = null; } document.querySelectorAll('.sh-play.saying').forEach(b => b.classList.remove('saying')); }
function stopSounds() { EN.say.stop(); THV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
// 확인(받아쓰기 · 센 음절 · 끝 올림 · th · s 짝의 바람 소리)을 통과하지 못한 낱말 파일은 들려주지 않아요 — 그 목소리로 미리 만든 파일은 있는데
// 잰 값이 없는 사전 낱말(영어 낱말 줄은 통과해야 잰 값이 남아요). 잰 값 파일이 아예 없으면 거르지 않고, 줄 목록을 모을 때(SWEEP)도 거르지 않아요
let SWEEP = false;
const DICT_WORDS = new Set(Object.keys(TH.DICT).map(k => TH.DICT[k].w));
const HAS_MEAS = Object.keys(window.PRON_MEASURE || {}).length > 0;
const badTake = (text, sp) => HAS_MEAS && !SWEEP && !!sp && sp !== 'ko' && DICT_WORDS.has(text) && THV.hasClip(sp, text) && !THV.meas(sp, text);
function speak(seq, o = {}) {
  seq = (seq || []).filter(it => !badTake(it.text, it.sp));
  if (!seq.length) { if (o.onend) o.onend(true); return; }
  return THV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름. 같은 단추를 곧바로 다시 누르면 천천히
let lastLp = { b: null, at: 0 };
const lpBtn = (seq, label, cls = '', inner) => THV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${inner || SVG_PLAY}</button>` : '';
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
const shown = w => { const e = TH.entry(w); return e ? e.w : w; };
const wSeq = (w, sp = 'tc') => [{ text: shown(w), sp }];
const pairSeq = (a, b, sp = 'tc') => [{ text: shown(a), sp }, { text: shown(b), sp, gap: 0.7 }];
const WHO = { tc: '밝은 선생님', tf: '차분한 선생님', uf: '미국 여성', um: '미국 남성', ko: '한국어식' };
// 짝의 두 낱말이 모두 확인(받아쓰기 · 음절 · th · s 짝은 바람 소리의 세기)을 통과한 목소리 — 통과하지 못한 파일은 들려주지 않아요(잰 값이 하나도 없으면 모든 목소리)
const ALL_SP = TH.VOICES.map(v => v.sp);
const okVoices = (a, b) => { const ok = ALL_SP.filter(sp => !!THV.meas(sp, shown(a)) && !!THV.meas(sp, shown(b))); return ok.length || Object.keys(window.PRON_MEASURE || {}).length ? ok : ALL_SP; };

/* =========================================================
   5. 글 칠하기 — th 소리를 적은 글자(mk-a 노랑) · 짝 낱말의 짝 소리 글자(mk-b 하늘), 한글 표기, 한국어식(mk-trap), 넣은 으(mk-ins)
   ========================================================= */
const MK = { 'θ': 'mk-a', 'ð': 'mk-a', s: 'mk-b', f: 'mk-b', t: 'mk-b', d: 'mk-b', z: 'mk-b' };
function wordHTML(w, o = {}) {
  const sp = TH.spans(w).filter(s => !s.bad), t = shown(w);
  let h = '', at = 0;
  sp.forEach(s => { h += esc(t.slice(at, s.s)) + ((o.only && o.only !== s.role) || (o.pos && o.pos !== s.pos) ? esc(t.slice(s.s, s.e)) : `<mark class="${MK[s.ph]}">${esc(t.slice(s.s, s.e))}</mark>`); at = s.e; });
  return `<span lang="en">${h + esc(t.slice(at))}</span>`;
}
function koHTML(w, o = {}) {
  const e = TH.entry(w); if (!e || !e.ko) return '';
  const marks = TH.koMarks(w), ins = o.ins ? TH.koInserted(w) : [];
  return [...e.ko].map((ch, i) => ins.indexOf(i) >= 0 ? `<mark class="mk-ins">${ch}</mark>` : o.trap ? `<mark class="mk-trap">${ch}</mark>` : marks[i] ? `<mark class="${MK[marks[i]]}">${ch}</mark>` : esc(ch)).join('');
}
function sentHTML(text) {
  return '<span lang="en">' + TH.segs(text).map(s => s.ph ? `<mark class="${MK[s.ph]}">${esc(s.t)}</mark>` : esc(s.t)).join('') + '</span>';
}
// 낱말 단추: 누르면 들려줌(곧바로 다시 누르면 천천히)
const wBtn = (w, sp = 'tc', o = {}) => THV.supported
  ? `<button type="button" class="wbtn${o.cls ? ' ' + o.cls : ''}" data-lp="${seqId(wSeq(w, sp))}" title="듣기: ${esc(shown(w))}${sp !== 'tc' ? ' · ' + WHO[sp] : ''}">${SVG_PLAY}${o.html || wordHTML(w)}</button>`
  : `<span class="wbtn off">${o.html || wordHTML(w)}</span>`;
const koBtn = (text, label) => THV.supported ? `<button type="button" class="wbtn ko" data-lp="${seqId([{ text, sp: 'ko' }])}" title="한국어식으로 듣기: ${esc(text)}">${SVG_PLAY}${label || esc(text)}</button>` : `<span class="wbtn off ko">${label || esc(text)}</span>`;
const koBtnW = (w, o = {}) => { const e = TH.entry(w); return e && e.ko ? koBtn(e.ko, koHTML(w, o)) : ''; };
const pairBtn = (a, b, note = '') => lpBtn(pairSeq(a, b), `이어서 듣기: ${shown(a)} · ${shown(b)}`, 'lp-voice', `${ICO.play}<span>${esc(shown(a))} · ${esc(shown(b))}${note}</span>`);
const posTag = p => `<span class="ptag p-${p}">${esc(TH.POS[p].ko)}</span>`;
const NM = ph => TH.NAME[ph] || ph;
const phLabel = ph => TH.LONG[ph] || `${NM(ph)} 소리`;
const soundName = ph => phLabel(ph);
// 낱말에서 다루는 소리: th 소리 + (짝 낱말이면) 짝 소리
const keySounds = w => { const L = TH.sounds(w).slice(), p = TH.partnerOf(w); if (p) L.push(p); return L.sort((x, y) => x.i - y.i); };
const soundsOf = w => keySounds(w).map(L => `${phLabel(L.ph)} · ${TH.POS[L.pos].ko}`).join(', ') || 'th 소리가 없어요';
const sayOf = L => TH.POS[L.pos].say;

/* =========================================================
   6. 듣고 고르기 (이 튜토리얼 전용, 회화 영역의 듣기 연습 문제와 같은 .edr 모양) — 소리 먼저, 글은 답한 뒤
   키보드: A · B 또는 1 · 2 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · Enter/→ 다음
   ========================================================= */
const KIND_KO = { word: '어느 낱말?', sent: '문장 속 어느 낱말?', same: '같은 낱말? 다른 낱말?', ko: '한국어식은 어느 쪽?' };
const drillSeq = q => q.kind === 'same' || q.kind === 'ko'
  ? q.say.map((s, i) => ({ text: TH.isKo(s) ? s : shown(s), sp: TH.isKo(s) ? 'ko' : q.sp, gap: i ? 0.9 : undefined })).map(x => { if (x.gap === undefined) delete x.gap; return x; })
  : [{ text: q.say, sp: q.sp }];
function PDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0 }));
  let cur = 0, retry = null, mode = null;
  const hear = THV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && THV.busy()) { THV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    const seq = drillSeq(it);
    speak(seq, { slow: !!slow, onitem(i) { say(`${WHO[seq[i].sp]} · 말하는 중`); }, onend(stopped) { mode = null; paintPlay(root, null); say(stopped ? '' : '다 들었어요. 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { THV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; THV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    THV.stop();
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
    if (it.kind === 'same') {
      const [a, b] = it.say, same = a === b, homo = !same && TH.homophone(a, b), d = same || homo ? null : TH.pairDiff(a, b);
      return it.opts.map((_, k) => k === 0
        ? (same ? `같아요 — 두 번 모두 같은 낱말 → ${shown(a)}` : homo ? `같아요 — 철자는 ${shown(a)} · ${shown(b)}로 다르지만 소리가 같아요 ${TH.ipa(a)}.` : `같지 않아요 — ${shown(a)} → ${shown(b)}, 소리 하나(${TH.KIND_KO[d.kind]})가 달라요.`)
        : (same ? `다르지 않아요 — 같은 낱말 ${shown(a)}, 두 번 들려줬어요.` : homo ? `다르지 않아요 — 뜻은 달라도(${shown(a)} → ${TH.entry(a).gloss} / ${shown(b)} → ${TH.entry(b).gloss}) 소리는 같아요.` : `달라요 — ${shown(a)} · ${shown(b)}. ${TH.POS[d.pos].long} 자리의 ${TH.KIND_KO[d.kind]} 짝이에요.`));
    }
    if (it.kind === 'ko') {
      const en = TH.drillWord(it), e = TH.entry(en);
      return it.say.map((s, k) => TH.isKo(s)
        ? `${k ? '둘째' : '첫째'} 소리 → 한국어식 ${s}. ${TH.koParts(en).filter(p => p.ok).map(p => `${p.ch} = ${TH.KO_KIND[p.kind]}`).join(' · ')}${TH.koInserted(en).length ? ' · 끝에 넣은 모음' : ''}.`
        : `${k ? '둘째' : '첫째'} 소리 → 영어 ${shown(en)} ${TH.ipa(en)} — ${e.gloss}. ${soundsOf(en)}.`);
    }
    return it.opts.map(w => `${shown(w)} ${TH.ipa(w)} — ${TH.entry(w).gloss}. ${soundsOf(w)}.`);
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = TH.hints(it);
    const o = order(), pos = o.indexOf(cur), reveal = done || !hear;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${THS.iconSVG('ear', 'pi')}${esc(KIND_KO[it.kind])}</span><span>${retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span><span class="edr-tag">${esc(WHO[it.sp])}</span></p>`;
    const sit = it.kind === 'same' ? '낱말 두 개를 차례로 들려줘요. 같은 소리인가요?' : it.kind === 'sent' ? '문장을 들려줘요. 빈칸에 들어간 낱말은?' : it.kind === 'ko' ? '같은 낱말을 두 번 들려줘요 — 한 번은 영어로, 한 번은 한국어식으로. 한국어식으로 읽은 쪽은?' : '낱말 하나를 들려줘요. 어느 낱말인가요?';
    h += `<p class="adr-sit"><b>상황</b> ${esc(sit)}</p>`;
    h += lsnBar();
    if (it.kind === 'sent') h += `<p class="ldr-q"><span class="ldr-t" lang="en">${reveal ? sentHTML(it.say) : esc(it.frame)}</span>${done && it.ko ? `<small>${esc(it.ko)}</small>` : ''}</p>`;
    else if ((it.kind === 'same' || it.kind === 'ko') && reveal) h += `<p class="ldr-q"><span class="ldr-t">${it.say.map(x => TH.isKo(x) ? `<mark class="mk-trap">${esc(x)}</mark>` : wordHTML(x)).join(' → ')}</span></p>`;
    else if (reveal) h += `<p class="ldr-q"><span class="ldr-t">${wordHTML(it.say)}</span></p>`;
    h += `<div class="ldr-opts two" role="group" aria-label="보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
      const lab = it.kind === 'same' || it.kind === 'ko' ? esc(op) : wordHTML(op);
      return `<div class="ldr-row${cls}" data-k="${k}"><button type="button" class="ldr-opt big" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L2[k]})</b> <span class="ldr-t">${lab}</span>${it.kind === 'word' || it.kind === 'sent' ? `<small>${esc(TH.entry(op).gloss)}</small>` : ''}</button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A · B 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L2[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L2[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const ws = TH.drillWords(it).filter((w, i, a) => a.indexOf(w) === i && TH.entry(w));
      if (it.kind === 'ko') { const en = ws[0]; h += `<div class="ldr-cmp"><span>견줘 듣기</span>${wBtn(en, it.sp)}${koBtnW(en)}</div>`; }
      else if (ws.length) h += `<div class="ldr-cmp"><span>${ws.length > 1 ? '같은 목소리로 견줘 듣기' : '같은 목소리로 다시 듣기'}</span>${ws.map(w => wBtn(w, it.sp)).join('')}${ws.length === 2 ? lpBtn(pairSeq(ws[0], ws[1], it.sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서</span>`) : ''}</div>`;
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
    const k = e.key.toUpperCase(), i = L2.indexOf(k), d = '12'.indexOf(k);
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
const LAB = { lq: null, lqPick: null, lqScore: [0, 0] };
const LQ_PAIRS = [['think', 'sink'], ['mouth', 'mouse'], ['three', 'free'], ['they', 'day']];
const PAIR_OPTS = Object.keys(TH.KINDS).map(k => [k, TH.PAIRS.filter(x => x.kind === k)]);
const pairSelect = (cur, attr, id) => `<select class="lab-sel"${id ? ` id="${id}"` : ''} data-sel="${attr}" aria-label="짝 고르기">${attr === 'mp' ? '' : '<option value="">영상대로</option>'}${PAIR_OPTS.map(([k, list]) => `<optgroup label="${esc(TH.KIND_KO[k])} 짝">${list.map(x => `<option value="${x.id}"${cur === x.id ? ' selected' : ''}>${esc(shown(x.a))} · ${esc(shown(x.b))} (${esc(TH.POS[x.pos].ko)})</option>`).join('')}</optgroup>`).join('')}</select>`;
// 입 그림의 계산(EN.mouth.tongueTeeth · lipTeeth · contact)으로 쓴 혀 설명
const mouthNote = ph => { const m = TH.MOUTH[ph], [a, b] = THS.tongueLines(ph); return `${a}(${b}) · ${m.voice ? '목이 울려요' : '목은 울리지 않아요'}`; };
const LABS = {
  intro() {
    return labHead('먼저 들어 보기') + `<p>짝 낱말 think · sink(생각하다 · 가라앉다), they · day(그들 · 하루)를 눌러 들어 보세요. 한국어식으로 적은 싱크 · 데이도 함께 들어 볼 수 있어요.</p>
      <div class="wrow">${wBtn('think')}${wBtn('sink')}${koBtnW('think', { trap: true })}</div>
      <div class="wrow">${wBtn('they')}${wBtn('day')}${koBtnW('they', { trap: true })}</div>
      <p class="note">같은 단추를 곧바로 다시 누르면 천천히 들려줘요. 둘이 다르게 들리나요? 아직 비슷하게 들려도 괜찮아요 — 이 영상의 목표가 그거예요.</p>`;
  },
  listen() {
    const q = LAB.lq, sc = LAB.lqScore;
    let h = labHead('짝 듣고 고르기 (맛보기)') + '<p>네 짝 가운데 하나를 무작위 목소리로 들려줘요. 들은 낱말을 고르세요. 본격적인 연습은 아래 <a href="#playground">듣고 가르기 훈련</a>에서 해요.</p>';
    if (!q) return h + `<div class="acts"><button type="button" class="btn" id="lqNew">${ICO.play} 하나 들려주기</button></div>`;
    h += `<div class="lq" data-slow="0"><p class="note">${esc(WHO[q.sp])}의 목소리 · ${lpBtn(wSeq(q.word, q.sp), '다시 듣기', 'lp-voice', `${ICO.play}<span>다시 듣기</span>`)}</p><div class="wrow">${q.opts.map(w => `<button type="button" class="pickw${LAB.lqPick ? (w === q.word ? ' right' : w === LAB.lqPick ? ' wrong' : '') : ''}" data-lq="${w}"${LAB.lqPick ? ' disabled' : ''}>${wordHTML(w)}</button>`).join('')}</div>`;
    if (LAB.lqPick) h += `<p class="verdict"><b class="${LAB.lqPick === q.word ? 'c-ok' : 'c-no'}">${LAB.lqPick === q.word ? '맞아요' : '아쉬워요'}</b>들려준 낱말 → ${wordHTML(q.word)} · ${sc[0]} / ${sc[1]}</p><div class="wrow">${q.opts.map(w => wBtn(w, q.sp)).join('')}${lpBtn(pairSeq(q.opts[0], q.opts[1], q.sp), '이어서 듣기', 'lp-voice', `${ICO.play}<span>이어서</span>`)}</div><div class="acts"><button type="button" class="btn" id="lqNew">${ICO.play} 하나 더</button></div>`;
    return h + '</div>';
  },
  korean() {
    const p = S.kpair ? TH.pairById(S.kpair) : null;
    let h = labHead('짝의 한국어식 표기') + row('짝', pairSelect(S.kpair, 'kpair'));
    if (!p) return h + '<p class="note">짝을 고르면 영상이 멈추고, 두 낱말이 한국어식으로 같은 표기가 되는지 보여 줘요. 같은 표기가 되는 짝이 많지만, 모두 그렇지는 않아요(three 스리 · free 프리).</p>';
    const same = TH.koSame(p.a, p.b);
    h += `<table class="koexp"><thead><tr><th>낱말</th><th>외래어 표기</th><th>한글이 적은 소리</th><th>소리</th></tr></thead><tbody>${[p.a, p.b].map(w => `<tr><td>${wBtn(w)}</td><td class="ko">${koBtnW(w)}</td><td>${esc(TH.koParts(w).filter(x => x.ok).map(x => `${x.ch} → ${TH.KO_KIND[x.kind]}`).join(', ') || '—')}</td><td>${keySounds(w).map(x => `<mark class="${MK[x.ph]}">${esc(soundName(x.ph))}</mark>`).join(' ') || '—'}</td></tr>`).join('')}</tbody></table>`;
    const by = p.kind === 'dhd' ? '혀끝으로 막느냐뿐이에요' : '혀끝의 자리(윗니 끝 ↔ 윗잇몸 가까이)뿐이에요';
    h += `<p class="note"><b>${same ? '같은 표기' : '다른 표기'}</b> — ${same ? `한국어식으로는 둘 다 ${esc(TH.entry(p.a).ko)}. 소리를 가르는 것은 ${by}.` : `${esc(TH.entry(p.a).ko)} · ${esc(TH.entry(p.b).ko)}. 표기는 달라도 ${esc(TH.KIND_KO[p.kind])} 소리는 혀끝의 자리로 갈라요.`} ${posTag(p.pos)} ${esc(TH.POS[p.pos].long)}</p>`;
    return h + clearBtn;
  },
  th() {
    const ph = S.thmode === 's' ? 's' : 'θ';
    return labHead('th 소리 · s 소리 — 혀끝의 자리') + `${row('혀끝의 자리', seg('혀끝의 자리', [['θ', 'th 소리 · 혀끝을 윗니 끝에'], ['s', 's 소리 · 혀끝을 잇몸 가까이']], ph, 'thm'))}
      <p class="note">${esc(mouthNote(ph))}. ${ph === 's' ? '혀 가운데의 좁은 길로 바람을 세게 보내요. 높고 센 바람 소리예요.' : '턱을 조금 내리고 혀끝을 윗니 끝에 가볍게 대요. 세게 물지 않고, 그 틈으로 약한 바람을 길게 흘려요.'}</p>
      <p>처음 자리의 th 소리 — 한국어식은 ㅅ</p><div class="wrow">${TH.SETS.thW.map(w => wBtn(w) + koBtnW(w)).join('')}</div>
      <p>짝으로 듣기 (th 소리 → s 소리)</p><div class="wrow">${TH.SETS.thsPairs.map(([a, b]) => pairBtn(a, b)).join('')}</div>`;
  },
  ft() {
    const ph = S.fmode || 'θ';
    return labHead('f 소리 · t 소리와 견주기') + `${row('입 모양', seg('입 모양', [['θ', 'th 소리 · 혀끝과 윗니'], ['f', 'f 소리 · 아랫입술과 윗니'], ['t', 't 소리 · 혀끝으로 막기']], ph, 'fm'))}
      <p class="note">${esc(mouthNote(ph))}. ${ph === 'f' ? '윗니 끝을 아랫입술 안쪽에 얹어요. 혀는 쉬어요. 바람의 세기는 th 소리와 비슷해요.' : ph === 't' ? '혀끝을 윗잇몸에 붙여 막았다가 터뜨려요. 바람이 이어지지 않아요.' : '입술이 아니라 혀끝이 윗니 끝에 닿아요. 막지 않고 바람을 흘려요.'}</p>
      <p>짝으로 듣기 (th 소리 → f 소리) — 귀로 가장 헷갈리는 짝</p><div class="wrow">${TH.SETS.thfPairs.map(([a, b]) => pairBtn(a, b)).join('')}</div>
      <p>짝으로 듣기 (th 소리 → t 소리)</p><div class="wrow">${TH.SETS.thtPairs.map(([a, b]) => pairBtn(a, b)).join('')}</div>`;
  },
  dh() {
    const ph = S.dmode || 'ð';
    return labHead('울림 th 소리 · 같은 혀 + 목 울림') + `${row('혀 · 목', seg('혀와 목', [['ð', '울림 th 소리 · 목 울림'], ['θ', '바람 th 소리 · 목 울림 끄기'], ['d', 'd 소리 · 혀끝으로 막기']], ph, 'dm'))}
      <p class="note">${esc(mouthNote(ph))}. ${ph === 'ð' ? '혀는 바람 th 소리와 똑같이 두고 목만 켜요. 막지 않아요.' : ph === 'θ' ? '혀는 그대로, 목만 꺼요.' : '한국어 ㄷ과 비슷해요. 울림 th 소리는 처음부터 막지 않아요.'}</p>
      <p>처음 자리의 울림 th 소리 — 아주 흔한 낱말들</p><div class="wrow">${TH.SETS.dhW.map(w => wBtn(w) + koBtnW(w)).join('')}</div>
      <p>짝으로 듣기 (울림 th 소리 → d 소리)</p><div class="wrow">${TH.SETS.dhdPairs.map(([a, b]) => pairBtn(a, b)).join('')}</div>
      <p>모음 사이의 울림 th 소리</p><div class="wrow">${TH.SETS.dhMid.map(w => wBtn(w)).join('')}</div>`;
  },
  dz() {
    const ph = S.zmode === 'z' ? 'z' : 'ð';
    return labHead('z 소리와 견주기') + `${row('혀끝의 자리', seg('혀끝의 자리', [['ð', '울림 th 소리 · 혀끝을 윗니 끝에'], ['z', 'z 소리 · 혀끝을 잇몸 가까이']], ph, 'zm'))}
      <p class="note">${esc(mouthNote(ph))}. ${ph === 'z' ? '좁은 길로 센 바람을 내며 목을 울려요. 또렷하게 떨리는 소리예요.' : '혀끝을 윗니 끝에 가볍게 댄 채 목을 울려요. z 소리보다 약하고 부드럽게 떨려요.'}</p>
      <p>짝으로 듣기 (울림 th 소리 → z 소리)</p><div class="wrow">${TH.SETS.dhzPairs.map(([a, b]) => pairBtn(a, b)).join('')}</div>
      <p>끝의 울림 th 소리 — 한국어식은 끝에 으</p><div class="wrow">${['breathe', 'with'].map(w => wBtn(w) + koBtnW(w, { ins: true })).join('')}</div>`;
  },
  place() {
    const all = TH.POS_ORDER.map(p => [p, TH.SETS.place[p]]);
    let h = labHead('낱말 속 자리') + row('낱말', `<div class="wrow sel">${all.map(([p, list]) => list.map(w => `<button type="button" class="pickw${S.pword === w ? ' on' : ''}" data-pw="${w}" aria-pressed="${S.pword === w}" title="${esc(TH.POS[p].ko)}">${wordHTML(w, { pos: p })}</button>`).join('')).join('')}</div>`);
    const w = S.pword;
    if (!w) return h + '<p class="note">낱말을 고르면 영상이 멈추고, 영어 음절과 한국어식 음절을 견줘 보여 줘요. 끝 자음 뒤의 으는 <a href="../final-consonants/index.html">끝소리 튜토리얼</a>에서 더 자세히 다뤄요.</p>';
    h += `<div class="wrow">${wBtn(w)}${koBtnW(w, { ins: true })}</div>
      <ul class="plan">${TH.sounds(w).map(L => `<li>${posTag(L.pos)} <mark class="${MK[L.ph]}">${esc(soundName(L.ph))}</mark> — ${esc(sayOf(L))}</li>`).join('')}</ul>
      <p class="note">영어 ${TH.syl(w)}음절 · 한국어식 ${TH.koSyl(w)}음절${TH.koInserted(w).length ? ' (분홍 → 넣은 모음)' : ''}.</p>`;
    return h + clearBtn;
  },
  loan() {
    let h = labHead('외래어 하나씩') + row('낱말', `<div class="wrow sel">${TH.LOAN.map(o => `<button type="button" class="pickw${S.loan === o.w ? ' on' : ''}" data-ln="${o.w}" aria-pressed="${S.loan === o.w}">${koHTML(o.w, { trap: true })}</button>`).join('')}</div>`);
    const o = S.loan && TH.LOAN.find(x => x.w === S.loan);
    if (!o) return h + '<p class="note">한국어식 표기를 고르면, 영어로 말할 때 낱말 속 소리를 하나씩 정해 줘요.</p>';
    const DO = { 'θ': '혀끝을 윗니 끝에 가볍게 대고 약한 바람을 내요', 'ð': '혀끝을 윗니 끝에 가볍게 댄 채 목을 울려요(막지 않아요)' };
    const plan = TH.sounds(o.w).map(L => `<li>${posTag(L.pos)} <mark class="${MK[L.ph]}">${esc(soundName(L.ph))}</mark> → ${esc(DO[L.ph])}${L.pos === 'cluster' ? ' — 곧바로 r 소리로, 으 없이' : ''}${L.pos === 'end' ? ', 끝에 으를 붙이지 않아요' : ''}</li>`).join('')
      || '<li><mark class="mk-b">t 소리</mark> → 철자는 th지만 혀끝을 윗잇몸에 붙였다가 터뜨려요. th 소리가 아니에요.</li>';
    return h + `<div class="wrow">${koBtnW(o.w, { trap: true })}<span class="arr">→</span>${wBtn(o.w)}</div><ol class="plan">${plan}</ol><p class="note"><b>${esc(TH.TRAP[o.trap].ko)}</b> — ${esc(TH.TRAP[o.trap].why)}.</p>` + clearBtn;
  },
  sentence() {
    const opts = TH.GROUP_ORDER.map(gp => `<optgroup label="${esc(TH.GROUPS[gp])}">${TH.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gp).map(([s, i]) => `<option value="${i}"${S.sent === i ? ' selected' : ''}>${esc(s.en)}</option>`).join('')}</optgroup>`).join('');
    let h = labHead('문장 고르기') + row('문장', `<select class="lab-sel" data-sel="sent" aria-label="문장 고르기"><option value="">영상대로</option>${opts}</select>`);
    if (S.sent == null) return h + '<p class="note">따라 말하기의 28문장 가운데 하나를 고르면 영상에 크게 보여 줘요.</p>';
    const s = TH.SENT[S.sent], c = TH.countIn(s.en);
    return h + `<p class="enline">${lpBtn(wSeq(s.en), '듣기: ' + s.en)}${sentHTML(s.en)}</p><p class="note">${esc(s.ko)} · ${['θ', 'ð'].filter(k => c[k]).map(k => `${phLabel(k)} ${c[k]}`).join(' · ')}</p>` + clearBtn;
  },
  summary() {
    return labHead('이제 직접') + `<p>아래 <a href="#playground">듣고 가르기 훈련</a>에서 목소리 넷으로 짝을 가르고, <a href="#mypron">내 발음 확인</a>에서 음성 인식이 내 말을 어느 낱말로 듣는지 확인해 보세요. <a href="#shadow">따라 말하기</a> 28문장과 <a href="#drill">듣고 고르기</a> 16문제도 있어요. 끝 자음 뒤의 으는 <a href="../final-consonants/index.html">끝소리 튜토리얼</a>에서, f 소리는 <a href="../f-v-w/index.html">입술이 하는 일</a>에서 이어서 익혀요.</p>`;
  },
};
function buildLab(ci) {
  const id = CHAPTERS[ci].id;
  $('lab').innerHTML = (LABS[id] || (() => ''))();
}
const relab = () => buildLab(THS.chapterAt(T));
function lqNew() {
  const [a, b] = pickOne(LQ_PAIRS), word = Math.random() < 0.5 ? a : b, ok = okVoices(a, b), sp = pickOne(ok.length ? ok : ALL_SP);
  LAB.lq = { word, sp, opts: [a, b], pair: a + '-' + b }; LAB.lqPick = null;
  S.pair = LAB.lq.pair; S.voice = sp; dirty = true;
  relab();
  speak(wSeq(word, sp));
}
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
  const d = b.dataset;
  if (b.id === 'lqNew') { lqNew(); return; }
  if (d.lq) { if (LAB.lqPick) return; LAB.lqPick = d.lq; LAB.lqScore[1]++; if (d.lq === LAB.lq.word) LAB.lqScore[0]++; relab(); return; }
  if (b.id === 'labClear') { Object.assign(S, JSON.parse(THS.DEFAULTS)); dirty = true; relab(); return; }
  if (d.thm) { S.thmode = d.thm; showAt(8); relab(); return; }
  if (d.fm) { S.fmode = d.fm; showAt(8); relab(); return; }
  if (d.dm) { S.dmode = d.dm; showAt(8); relab(); return; }
  if (d.zm) { S.zmode = d.zm; showAt(8); relab(); return; }
  if (d.pw) { S.pword = S.pword === d.pw ? null : d.pw; showAt(S.pword ? 8 : 1); relab(); return; }
  if (d.ln) { S.loan = S.loan === d.ln ? null : d.ln; showAt(30); relab(); return; }
});
$('lab').addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.sel) return;
  const v = t.value;
  if (t.dataset.sel === 'kpair') { S.kpair = v || null; showAt(v ? 14 : 1); }
  else if (t.dataset.sel === 'sent') { S.sent = v === '' ? null : +v; showAt(8); }
  relab();
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   혼자 쓴 로마자(th · s · f · t · d · z · r)는 한국어 이름으로, ㅅ · ㄷ은 시옷 · 디귿으로 읽어요
   ========================================================= */
const LETTER_KO = { th: '티에이치', s: '에스', f: '에프', t: '티', d: '디', z: '제트', r: '알' };
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/ㅅ/g, '시옷'], [/ㄷ/g, '디귿'], [/(^|[^A-Za-z'’-])(th|[sftdzr])(?=[\s가-힣.,·)]|$)/g, (m, a, c) => a + LETTER_KO[c]], [/\s\+\s/g, ', '], [/ = /g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
  enRate: THV.EN_RATE,      // 영어 조각만 살짝 느리게 (voices.js의 EN_RATE — 낱말 소리와 같은 빠르기)
  clips: window.EN_CLIPS,   // 미리 만든 음성 파일(audio/narration/) — 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };
if (window.EN && EN.say) EN.say.rate = THV.EN_RATE;   // 발음 듣기 단추도 같은 빠르기

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

/* =========================================================
   10. 놀이터 ① 듣고 가르기 훈련 — 목소리 넷 × 짝 낱말 20 (여러 목소리로 듣는 훈련을 줄인 것)
   기록은 이 브라우저에만(localStorage 'en-th-hvpt-v1'). 키보드: R 듣기 · 1 · 2 고르기 · Space/Enter 다음
   ========================================================= */
const HV_KEY = 'en-th-hvpt-v1';
const HV = { kind: 'all', voice: 'all', cur: null, pick: null, stats: null, streak: 0 };
const hvEmpty = () => ({ pos: { start: [0, 0], cluster: [0, 0], mid: [0, 0], end: [0, 0] }, kind: { ths: [0, 0], thf: [0, 0], tht: [0, 0], dhd: [0, 0], dhz: [0, 0] }, voice: { tc: [0, 0], tf: [0, 0], uf: [0, 0], um: [0, 0] } });
function hvLoad() { try { const s = JSON.parse(localStorage.getItem(HV_KEY) || 'null'); HV.stats = s && s.pos && s.kind && s.kind.ths && s.voice ? s : hvEmpty(); } catch (e) { HV.stats = hvEmpty(); } }
function hvSave() { try { localStorage.setItem(HV_KEY, JSON.stringify(HV.stats)); } catch (e) { /* 저장하지 못해도 이번에는 계속 */ } }
function hvNew(auto) {
  const all = TH.PAIRS.filter(p => HV.kind === 'all' || p.kind === HV.kind);
  const vp = all.filter(p => HV.voice === 'all' ? okVoices(p.a, p.b).length : okVoices(p.a, p.b).includes(HV.voice));
  const p = pickOne(vp.length ? vp : all), word = Math.random() < 0.5 ? p.a : p.b, ok = okVoices(p.a, p.b);
  const sp = HV.voice === 'all' ? pickOne(ok.length ? ok : ALL_SP) : HV.voice;
  HV.cur = { p, word, sp, opts: shuffle([p.a, p.b]) }; HV.pick = null;
  hvDraw();
  if (auto) hvPlay();
}
function hvPlay(slow) { if (!HV.cur) return; const b = $('hvPlayBtn'); if (b) b.classList.add('saying'); speak(wSeq(HV.cur.word, HV.cur.sp), { slow: !!slow, onend() { const x = $('hvPlayBtn'); if (x) x.classList.remove('saying'); } }); }
function hvAnswer(k) {
  const c = HV.cur; if (!c || HV.pick !== null) return;
  HV.pick = k;
  const ok = c.opts[k] === c.word, P = HV.stats.pos[c.p.pos], K = HV.stats.kind[c.p.kind], V = HV.stats.voice[c.sp];
  [P, K, V].forEach(x => { x[1]++; if (ok) x[0]++; });
  HV.streak = ok ? HV.streak + 1 : 0;
  hvSave(); hvDraw();
  const nb = $('hvNext'); if (nb) nb.focus({ preventScroll: true });
}
const pct = ([ok, n]) => n ? Math.round(ok / n * 100) : null;
const meterRow = (lab, v) => { const q = pct(v); return `<tr><th scope="row">${lab}</th><td>${v[0]} / ${v[1]}</td><td><span class="meter"><i style="width:${q == null ? 0 : q}%"></i></span>${q == null ? '–' : q + '%'}</td></tr>`; };
function hvDraw() {
  const c = HV.cur, box = $('hvMain');
  let h = '';
  if (!c) h = `<p class="hv-hello">목소리 넷 가운데 하나가 짝 낱말 하나를 말해요. 들은 낱말을 고르세요. 여러 목소리로 많이 들을수록 th 소리와 s · f · t · d · z 소리의 차이가 귀에 들어와요.</p><div class="acts"><button type="button" class="btn" id="hvStart">${ICO.play} 시작하기</button></div>`;
  else {
    const done = HV.pick !== null, ok = done && c.opts[HV.pick] === c.word;
    h += `<div class="hv-top"><button type="button" class="btn hv-play" id="hvPlayBtn">${ICO.play} 듣기 <small>R</small></button><button type="button" class="btn ghost" id="hvSlow">${ICO.slow} 천천히</button><span class="hv-who">${esc(WHO[c.sp])} · ${esc(TH.KIND_KO[c.p.kind])} · ${posTag(c.p.pos)}</span></div>`;
    h += `<div class="hv-opts">${c.opts.map((w, k) => `<button type="button" class="hv-opt${done ? (w === c.word ? ' right' : k === HV.pick ? ' wrong' : ' off') : ''}" data-hv="${k}"${done ? ' disabled' : ''}><b>${k + 1}</b>${wordHTML(w)}<small>${esc(TH.entry(w).gloss)}</small></button>`).join('')}</div>`;
    if (done) {
      h += `<p class="verdict"><b class="${ok ? 'c-ok' : 'c-no'}">${ok ? '맞아요' : '아쉬워요'}</b>들려준 낱말 → ${wordHTML(c.word)} ${esc(TH.ipa(c.word))}${HV.streak > 1 ? ` · 연속 ${HV.streak}번!` : ''}</p>`;
      h += `<div class="wrow">${c.opts.map(w => wBtn(w, c.sp)).join('')}${lpBtn(pairSeq(c.p.a, c.p.b, c.sp), '이어서 듣기', 'lp-voice', `${ICO.play}<span>${esc(TH.KIND_KO[c.p.kind])} 이어서</span>`)}</div>`;
      h += `<p class="note">${esc(TH.hints({ kind: 'word', say: c.word, opts: [c.p.a, c.p.b] })[0].text)}</p><div class="acts"><button type="button" class="btn" id="hvNext">다음 <small>Space</small></button></div>`;
    }
  }
  box.innerHTML = h;
  const st = HV.stats;
  const all = Object.values(st.pos).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
  $('hvStats').innerHTML = `<table class="hv-tab"><caption>자리마다 맞힌 비율 (이 브라우저에만 저장)</caption><tbody>${TH.POS_ORDER.filter(p => TH.PAIRS.some(q => q.pos === p)).map(p => meterRow(esc(TH.POS[p].long), st.pos[p])).join('')}<tr class="all"><th scope="row">모두</th><td>${all[0]} / ${all[1]}</td><td>${pct(all) == null ? '–' : pct(all) + '%'}</td></tr></tbody></table>
    <table class="hv-tab"><caption>짝마다</caption><tbody>${Object.keys(TH.KINDS).map(k => meterRow(`${esc(TH.KIND_KO[k])} 짝`, st.kind[k])).join('')}</tbody></table>
    <p class="note">목소리마다: ${TH.VOICES.map(v => `${esc(v.ko)} ${pct(st.voice[v.sp]) == null ? '–' : pct(st.voice[v.sp]) + '%'}`).join(' · ')}</p>`;
}
function hvInit() {
  hvLoad();
  $('hvCtl').innerHTML = row('짝', seg('짝 고르기', [['all', '모두']].concat(Object.keys(TH.KINDS).map(k => [k, `${TH.KIND_KO[k]} (${TH.PAIRS.filter(p => p.kind === k).length})`])), HV.kind, 'hvk')) +
    row('목소리', seg('목소리 고르기', [['all', '넷 섞어서']].concat(TH.VOICES.map(v => [v.sp, v.ko])), HV.voice, 'hvv'));
  hvDraw();
  const root = $('hvpt');
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    const d = b.dataset;
    if (d.hvk) { HV.kind = d.hvk; root.querySelectorAll('[data-hvk]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hvNew(false); return; }
    if (d.hvv) { HV.voice = d.hvv; root.querySelectorAll('[data-hvv]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hvNew(false); return; }
    if (b.id === 'hvStart' || b.id === 'hvNext') { hvNew(true); return; }
    if (b.id === 'hvPlayBtn') { hvPlay(false); return; }
    if (b.id === 'hvSlow') { hvPlay(true); return; }
    if (d.hv != null) { hvAnswer(+d.hv); return; }
    if (b.id === 'hvReset') { HV.stats = hvEmpty(); HV.streak = 0; hvSave(); hvDraw(); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('select'))) return;
    const k = e.key.toUpperCase();
    if (k === 'R') { e.preventDefault(); if (!HV.cur) hvNew(true); else hvPlay(false); }
    else if ((k === '1' || k === '2') && HV.cur && HV.pick === null) { e.preventDefault(); hvAnswer(+k - 1); }
    else if ((e.key === ' ' || e.key === 'Enter') && (HV.pick !== null || !HV.cur) && !(e.target.closest && e.target.closest('button:not(#hvNext):not(#hvStart)'))) { e.preventDefault(); hvNew(true); }
  });
}

/* =========================================================
   10. 놀이터 ② 내 발음 확인 — 음성 인식이 내 말을 어느 낱말로 들었나 · 녹음해서 본보기와 번갈아 듣기
   인식은 흔한 낱말 쪽으로 기울고 발음의 질을 판정하지 않아요(화면에 밝힘)
   ========================================================= */
const MP = { pair: TH.PAIRS[0].id, side: 'a', url: null, res: null, busy: false };
const mpTarget = () => { const p = TH.pairById(MP.pair); return { p, w: MP.side === 'a' ? p.a : p.b, other: MP.side === 'a' ? p.b : p.a }; };
// 짝을 가르는 소리(그 낱말 쪽)
const mpPhone = (p, w) => TH.pairPhone(p, w);
function mpDrawFig() {
  const c = $('mpFig'); if (!c) return;
  const { p, w } = mpTarget(), ph = mpPhone(p, w), m = TH.MOUTH[ph], g = c.getContext('2d'), d = Math.min(2, window.devicePixelRatio || 1);
  c.width = 260 * d; c.height = 234 * d; g.setTransform(d, 0, 0, d, 0, 0);
  g.fillStyle = '#10151C'; g.fillRect(0, 0, 260, 234);
  const c0 = THS.PCOL[ph], mo = m.pose === 'th' ? { teethMark: c0, labels: ['teeth', 'tip'] } : m.pose === 'f' ? { lipMark: c0, labels: ['teeth', 'llip'] } : { mark: c0, labels: ['ridge', 'tip'] };
  M.draw(g, 0, 0, 0.65, m.pose, Object.assign(mo, { voice: m.voice ? 0.3 : null, font: (sz, wt) => THS.fonts.fnt(sz, wt || 600) }));
}
const SAY_TIP = { 'θ': '혀끝을 윗니 끝에 가볍게 대고 약한 바람을 흘리며', 'ð': '혀끝을 윗니 끝에 가볍게 댄 채 목을 울리며', s: '혀끝을 윗잇몸 가까이 두고(이에 닿지 않게) 센 바람을 내며', f: '윗니 끝을 아랫입술에 얹고 바람을 내며', t: '혀끝을 윗잇몸에 붙였다가 터뜨리며', d: '혀끝을 윗잇몸에 붙였다가 떼며', z: '혀끝을 윗잇몸 가까이 두고 목을 울리며' };
function mpDraw() {
  const { p, w, other } = mpTarget(), ph = mpPhone(p, w), oph = mpPhone(p, other);
  let h = `<div class="mp-ctl">${row('짝', pairSelect(MP.pair, 'mp', 'mpSel'))}${row('말할 낱말', seg('말할 낱말', [['a', `${esc(shown(p.a))} · ${esc(phLabel(mpPhone(p, p.a)))}`], ['b', `${esc(shown(p.b))} · ${esc(phLabel(mpPhone(p, p.b)))}`]], MP.side, 'mpside'))}</div>`;
  h += `<div class="mp-body"><canvas id="mpFig" class="mp-fig" width="260" height="234" role="img" aria-label="입 모양 (${esc(shown(w))}, ${esc(phLabel(ph))}): ${esc(THS.tongueLines(ph).join(' · '))}"></canvas>
    <div class="mp-word"><p class="mp-big">${wordHTML(w)}</p><p class="note">${esc(TH.ipa(w))} · ${esc(TH.entry(w).gloss)} · 짝 → ${wordHTML(other)}</p>
    <p class="note">${posTag(p.pos)} <mark class="${MK[ph]}">${esc(phLabel(ph))}</mark> → ${esc(SAY_TIP[ph])} 말해요. 짝 낱말 → <mark class="${MK[oph]}">${esc(phLabel(oph))}</mark>.</p>
    <div class="wrow">${wBtn(w)}${wBtn(other)}</div></div></div>`;
  h += '<div class="mp-acts">';
  if (SRC) h += `<button type="button" class="btn" id="mpMic" aria-pressed="false">${ICO.mic}<span>말하고 인식 결과 보기</span></button>`;
  if (CAN_REC) h += `<button type="button" class="btn ghost" id="mpRec" aria-pressed="false">${ICO.rec}<span>3초 녹음</span></button>`;
  if (!SRC && !CAN_REC) h += '<p class="note">이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. 본보기를 듣고 세 번 소리 내어 따라 해 보세요.</p>';
  h += '</div><div class="mp-res" id="mpRes" role="status"></div>';
  $('mpMain').innerHTML = h;
  mpDrawFig();
  mpResult();
}
function mpResult() {
  const box = $('mpRes'); if (!box) return;
  let h = '';
  if (MP.res) {
    const r = MP.res, { p, w } = mpTarget(), ph = mpPhone(p, w), cls = r.verdict === 'target' ? 'c-ok' : r.verdict === 'partner' ? 'c-no' : 'c-mid';
    const fix = { 'θ': '혀끝이 윗니 끝에 닿았는지, 바람이 약하게 이어졌는지', 'ð': '혀끝으로 막지 않았는지, 목이 울렸는지', s: '혀끝이 이에 닿지 않았는지', f: '윗니 끝이 아랫입술에 닿았는지', t: '혀끝으로 막았다가 터뜨렸는지', d: '혀끝으로 막았다가 뗐는지', z: '혀끝이 이에 닿지 않았는지, 목이 울렸는지' }[ph];
    h += `<p class="verdict"><b class="${cls}">${esc(TH.HEARD_KO[r.verdict])}</b>${r.verdict === 'partner' ? `받아 적은 말 → 짝 낱말 ${esc(shown(r.partner))}. ${esc(fix)} 확인하고 다시 해 보세요.` : r.verdict === 'target' ? '인식기가 목표 낱말로 받아 적었어요.' : r.verdict === 'maybe' ? `목표 낱말 → ${r.rank}번째 후보. 조금 더 또렷하게 해 보세요.` : r.verdict === 'other' ? '목표 낱말도 짝 낱말도 아닌 말로 받아 적었어요. 낱말 하나만 또박또박 말해 보세요.' : ''}</p>`;
    if (r.alts && r.alts.length) h += `<p class="note">인식 후보: ${r.alts.map((a, i) => `<span class="alt${i === 0 ? ' top' : ''}" lang="en">${esc(a)}</span>`).join(' · ')}</p>`;
  }
  if (MP.err) h += `<p class="sh-err">${esc(MP.err)}</p>`;
  if (MP.url) h += `<div class="mo"><button type="button" class="sh-play" id="mpMine">${ICO.play} 내 목소리</button>${THV.supported ? `<button type="button" class="sh-play" id="mpModel">${ICO.play} 본보기</button><button type="button" class="sh-play" id="mpBoth">${ICO.play} 번갈아 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`;
  box.innerHTML = h;
}
function mpInit() {
  const root = $('mypron');
  mpDraw();
  root.addEventListener('change', e => { if (e.target.id === 'mpSel') { MP.pair = e.target.value; MP.res = null; MP.err = null; mpDraw(); } });
  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.dataset.mpside) { MP.side = b.dataset.mpside; MP.res = null; MP.err = null; mpDraw(); return; }
    const { w, other } = mpTarget();
    if (b.id === 'mpMic') {
      if (activeRec) { stopListening(); return; }
      MP.err = null; MP.res = null; mpResult();
      listenOnce({ alts: 5,
        onState(on) { const x = $('mpMic'); if (x) { x.setAttribute('aria-pressed', String(on)); x.classList.toggle('on', on); x.querySelector('span').textContent = on ? '듣고 있어요…' : '말하고 인식 결과 보기'; } },
        onText(alts) { MP.res = Object.assign(TH.heard(w, alts, other), { alts }); mpResult(); },
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
        if (url) playUrl(url, $('mpMine'), () => { if (THV.supported) speak(wSeq(w)); });
      } catch (err) { MP.err = recErr(err); mpResult(); }
      MP.busy = false;
      return;
    }
    if (b.id === 'mpMine') { playUrl(MP.url, b); return; }
    if (b.id === 'mpModel') { speak(wSeq(w)); return; }
    if (b.id === 'mpBoth') { playUrl(MP.url, $('mpMine'), () => speak(wSeq(w), { onend(stopped) { if (!stopped) playUrl(MP.url, $('mpMine'), () => speak(wSeq(w))); } })); }
  });
}

/* =========================================================
   11. 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). there를 their로 받아 적는 것처럼 소리가 같은 낱말은 맞은 것으로 쳐요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = TH.GROUP_ORDER.map(gp => ({ gp, rows: TH.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gp) }));
  $('shList').innerHTML = groups.map(({ gp, rows }) => `<section class="sh-grp"><h3><span class="ptag p-start">${esc(TH.GROUPS[gp])}</span> ${esc(TH.GROUPS[gp])}가 든 문장</h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${THV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-en">${sentHTML(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { return [{ text: TH.SENT[i].en, sp: 'tc' }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = TH.SENT[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, TH.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${THV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
    shPlayMine(i, true);
  };
  SHREC.rec = mr; mr.start(); shMicState(i, true);
  shResult(i, '<span class="note">녹음 중이에요. 다 말했으면 ‘멈추기’를 눌러요(6초가 지나면 저절로 멈춰요).</span>');
  SHREC.tm = setTimeout(() => { if (SHREC.rec === mr) { SHREC.rec = null; try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 6000);
}
function shPlayMine(i, thenOrig) {
  const b = document.querySelector(`.sh-row[data-i="${i}"] [data-mine]`);
  playUrl(SHREC.url[i], b, thenOrig && THV.supported ? () => speak(shSeq(i)) : null);
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
   12. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 그림 문제는 EN.mouth로 그리고, 정답은 그림의 계산으로 다시 확인
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', p: '#FFC15E', bad: '#FF8E8E', hover: '#6EC8FF', box: '#2A3644' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
const markOf = (i, st) => st.done && i === st.answer ? QCOL.p : st.done && i === st.pick ? QCOL.bad : st.hover === i ? QCOL.hover : null;
// 입 그림 넷 (A~D) — 옆 단면도의 앞쪽(입술 · 윗니)
function mouthFig(label, poses) {
  const Wd = 640, H = 200, cw = Wd / 4;
  return { width: Wd, height: H, label,
    pick: (x, y) => y > 4 && y < H - 4 ? Math.min(3, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      poses.forEach((p, k) => {
        const x = k * cw + 6;
        rrq(g, x, 6, cw - 12, H - 12, 12); g.fillStyle = st.hover === k ? QCOL.box : 'rgba(255,255,255,0.03)'; g.fill();
        g.save(); rrq(g, x, 6, cw - 12, H - 12, 12); g.clip();
        M.draw(g, x - 14, 4, 0.72, p, {});   // 입 앞쪽(입술 · 윗니)을 크게
        g.restore();
        const c = markOf(k, st); if (c) { rrq(g, x, 6, cw - 12, H - 12, 12); g.strokeStyle = c; g.lineWidth = 3; g.stroke(); }
        g.beginPath(); g.arc(x + 18, 22, 11, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill();
        g.font = qfont(12, 700); g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], x + 18, 23);
      });
    } };
}
const QS = (() => {
  const TT = p => M.tongueTeeth(p), LT = p => M.lipTeeth(p);
  const fig3 = ['s', 'th', 't', 'f'], fig6 = ['th', 't', 's', 'f'];
  const q = [
    { q: '짝 낱말 think · sink(생각하다 · 가라앉다)를 외래어 표기로 적으면?', opts: ['싱크 · 싱크 (같은 표기)', '팅크 · 싱크', '핑크 · 싱크', '딩크 · 싱크'], a: 0,
      why: '외래어 표기법은 바람 th 소리를 ㅅ으로 적어요. 그래서 둘 다 싱크가 돼요. 표기로는 가를 수 없으니 혀끝의 자리(윗니 끝 ↔ 윗잇몸 가까이)로 갈라야 해요.',
      check: () => TH.entry('think').ko === '싱크' && TH.koSame('think', 'sink') },
    { q: '듣기 연구들에서, 한국어를 쓰는 학습자는 바람 th 소리를 어떤 소리로 가장 자주 잘못 들었나요?', opts: ['s 소리', 'f 소리', 't 소리', 'z 소리'], a: 1,
      why: 'f 소리로 듣는 일이 많았어요(배문정 · 김정오 2009, 초미희 2010, Jang 2014). 두 소리 모두 약하고 부드러운 바람 소리예요. 거꾸로 s 소리를 th 소리로 듣는 일도 많았어요.',
      check: () => TH.PAIRS.some(p => p.kind === 'thf') },
    { q: 'th 소리의 혀는? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: mouthFig('입 옆 단면도 넷. A 혀끝이 윗잇몸 가까이(이에 닿지 않음), B 혀끝이 윗니 끝에 닿음, C 혀끝이 윗잇몸에 붙음, D 혀는 쉬고 아랫입술이 윗니에 닿음', fig3),
      why: 'B → 혀끝이 윗니 끝에 가볍게 닿아요. A는 s 소리(혀끝이 이에 닿지 않아요), C는 t 소리(혀끝으로 막아요), D는 f 소리(아랫입술과 윗니)예요.',
      check: () => fig3.map(p => TT(p).touch).indexOf(true) === 1 && fig3.filter(p => TT(p).touch).length === 1 && TH.MOUTH['θ'].pose === 'th' },
    { q: 'th 소리를 s 소리와 가르는 것은?', opts: ['목 울림', '입술을 둥글게 모으기', '혀끝이 윗니 끝에 닿느냐', '두 입술을 닫기'], a: 2,
      why: 's 소리는 혀끝이 윗잇몸 가까이 있고 이에 닿지 않아요. th 소리는 혀끝이 더 앞으로 나와 윗니 끝에 닿아요. 그래서 th 소리의 바람이 훨씬 약해요.',
      check: () => TT('th').touch && !TT('s').touch && !TH.MOUTH['θ'].voice && !TH.MOUTH.s.voice },
    { q: '울림 th 소리(this)를 바람 th 소리(think)와 가르는 것은?', opts: ['혀끝의 자리', '입술 모양', '혀끝으로 막기', '목 울림'], a: 3,
      why: '두 th 소리는 혀끝의 자리가 같아요(윗니 끝에 가볍게). 다른 점은 목 울림 하나예요.',
      check: () => TH.MOUTH['ð'].pose === TH.MOUTH['θ'].pose && TH.MOUTH['ð'].voice && !TH.MOUTH['θ'].voice && TH.sounds('this')[0].ph === 'ð' && TH.sounds('think')[0].ph === 'θ' },
    { q: 'f 소리의 입은? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: mouthFig('입 옆 단면도 넷. A 혀끝이 윗니 끝에 닿음, B 혀끝이 윗잇몸에 붙음, C 혀끝이 윗잇몸 가까이(이에 닿지 않음), D 혀는 쉬고 아랫입술이 윗니에 닿음', fig6),
      why: 'D → 윗니 끝이 아랫입술에 닿고 혀는 쉬어요. th 소리(A)와 바람의 세기는 비슷하지만, 닿는 곳이 달라요 — f 소리는 입술, th 소리는 혀끝.',
      check: () => fig6.map(p => LT(p).touch).indexOf(true) === 3 && fig6.filter(p => LT(p).touch).length === 1 && TH.MOUTH.f.pose === 'f' },
    { q: '그들 they를 한국어식으로 데이라고 읽으면, th 소리는 어떤 소리가 되나요?', opts: ['혀끝으로 막았다가 떼는 소리', 's 소리', 'f 소리', '소리가 없어져요'], a: 0,
      why: 'ㄷ은 혀끝으로 막았다가 떼는 소리예요(영어 d 소리와 비슷). 그래서 they · day가 같은 표기(데이)가 돼요. 울림 th 소리는 막지 않아요.',
      check: () => { const p = TH.koParts('they')[0]; return !!p && p.ok && TH.hangul(p.ch)[0].on === 3 && TH.koSame('they', 'day') && M.contact('t').touch && !M.contact('th').touch; } },
    { q: '입 mouth를 외래어 표기로 적으면 마우스예요. 영어에 없는 어떤 소리가 붙었나요?', opts: ['끝의 으', '처음의 으', '끝의 이', '붙은 소리가 없어요'], a: 0,
      why: '끝의 th 소리를 스로 적어 으가 붙어요. 영어는 혀끝을 윗니 끝에 댄 채 약한 바람으로 끝내요. 으를 붙이면 mouse(쥐)에 으를 붙인 소리와 같아져요.',
      check: () => { const k = TH.koInserted('mouth'); return k.length === 1 && [...TH.entry('mouth').ko][k[0]] === '스' && TH.koSame('mouth', 'mouse'); } },
    { q: '철자는 th지만 t 소리로 읽는 낱말은?', opts: ['three', 'thank', 'Thomas', 'thin'], a: 2,
      why: 'Thomas → 첫소리가 t 소리예요(토머스). Thailand · thyme · Thames도 그래요. three · thank · thin은 바람 th 소리예요.',
      check: () => TH.entry('Thomas').ph[0] === 't' && TH.sounds('Thomas').length === 0 && ['three', 'thank', 'thin'].every(w => TH.sounds(w)[0].ph === 'θ') },
    { q: 'This is my brother. 이 문장에서 th 소리는 몇 번 나오나요?', opts: ['한 번', '두 번', '세 번', '네 번'], a: 1,
      why: 'This의 처음과 brother의 가운데, 두 번이에요. 둘 다 목을 울리는 th 소리예요.',
      check: () => { const c = TH.countIn('This is my brother.'); return c['ð'] === 2 && c['θ'] === 0; } },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[th 소리] 퀴즈 ${i + 1}번의 정답이 규칙 엔진 · 입 그림과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[th 소리] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
  return q;
})();
THS.QUIZ = QS;

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
$('ttsBtn').addEventListener('click', () => { THV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = THS.chapterAt(T);
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
// 화면 누르기: 낱말 · 한글 표기는 그 목소리로, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * THS.W, (e.clientY - r.top) / r.height * THS.H]; };
const hitAt = (x, y) => started ? THS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
let lastHit = { k: '', at: 0 };
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.play && THV.supported) {
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
EN.say.wire(document, { before() { THV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = ' ' + THV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 영상의 낱말 · 한글 표기 · 목소리 단추, 직접 해 보기(고르는 것은 하나씩), 듣고 가르기 훈련 · 내 발음 확인(짝 20 × 목소리 넷), 듣고 고르기, 따라 말하기
// 미리 만들지 않는 한국어식 낱말: 엔진이 여러 seed · 읽을 글로도 다른 말로 읽었거나(너싱 · 댓) 받아쓰기로 확인하지 못한 것(토머스 — 늘 토마스로, 머더 — 뭐 더?로 적힘)
//   — 파일을 두지 않아 브라우저의 한국어 음성으로 읽어요
const KO_NO_CLIP = new Set(['너싱', '댓', '토머스', '머더']);
window.__dialogueLines = () => {
  SWEEP = true;
  try { return dialogueLines(); } finally { SWEEP = false; }
};
function dialogueLines() {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text) return;
    if (sp === 'ko' && KO_NO_CLIP.has(text)) return;
    const id = THV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: THV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(THS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 누를 수 있는 낱말 · 한글 표기 · 목소리 단추. 직접 해 보기로 바뀌는 장면도 하나씩
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t, ch.t + ch.d]; };
    const placeWords = [].concat(...Object.values(TH.SETS.place));
    const sweeps = [[{}, [0, END]]]
      .concat(TH.PAIRS.map(p => [{ pair: p.id }, span('listen')]), TH.PAIRS.map(p => [{ kpair: p.id }, span('korean')]))
      .concat([[{ thmode: 'θ' }, span('th')], [{ thmode: 's' }, span('th')], [{ fmode: 'θ' }, span('ft')], [{ fmode: 'f' }, span('ft')], [{ fmode: 't' }, span('ft')],
        [{ dmode: 'ð' }, span('dh')], [{ dmode: 'θ' }, span('dh')], [{ dmode: 'd' }, span('dh')], [{ zmode: 'ð' }, span('dz')], [{ zmode: 'z' }, span('dz')]])
      .concat(placeWords.map(w => [{ pword: w }, span('place')]), TH.LOAN.map(o => [{ loan: o.w }, span('loan')]), TH.SENT.map((_, i) => [{ sent: i }, span('sentence')]));
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.5) { THS.render(g, t); THS.hits().forEach(h => addSeq(h.play, 'video')); }
    });
    // 2) 직접 해 보기: 장마다 + 고르는 것은 하나씩
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* */ } });
    TH.PAIRS.forEach(p => { S.kpair = p.id; LABS.korean(); });
    ['θ', 's'].forEach(v => { S.thmode = v; LABS.th(); }); ['θ', 'f', 't'].forEach(v => { S.fmode = v; LABS.ft(); }); ['ð', 'θ', 'd'].forEach(v => { S.dmode = v; LABS.dh(); }); ['ð', 'z'].forEach(v => { S.zmode = v; LABS.dz(); });
    placeWords.forEach(w => { S.pword = w; LABS.place(); });
    TH.LOAN.forEach(o => { S.loan = o.w; LABS.loan(); });
    TH.SENT.forEach((_, i) => { S.sent = i; LABS.sentence(); });
    LQ_PAIRS.forEach(([a, b]) => TH.VOICES.forEach(v => [a, b].forEach(w => { LAB.lq = { word: w, sp: v.sp, opts: [a, b], pair: a + '-' + b }; LAB.lqPick = a; LABS.listen(); })));
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 듣고 가르기 훈련 · 내 발음 확인: 짝 20 × 목소리 넷 (+ 이어서 듣기는 같은 줄)
  TH.PAIRS.forEach(p => TH.VOICES.forEach(v => { add(v.sp, shown(p.a), 'hvpt'); add(v.sp, shown(p.b), 'hvpt'); }));
  // 4) 듣고 고르기: 들려주는 말 + 견줘 듣기(같은 목소리 · 한국어식)
  TH.DRILL.forEach(q => { addSeq(drillSeq(q), 'drill'); TH.drillWords(q).forEach(w => { if (TH.entry(w)) add(q.sp, shown(w), 'drill'); }); if (q.kind === 'ko') { const e = TH.entry(TH.drillWord(q)); if (e && e.ko) add('ko', e.ko, 'drill'); } });
  // 5) 따라 말하기
  TH.SENT.forEach((_, i) => addSeq(shSeq(i), 'shadow'));
  return out;
}
// 잴 줄의 정보 (tools/dialogue-lines.cjs가 measure-meta.json으로 씀): word = 낱말 하나(n 음절 수 · at 센 음절, 0부터) · ko = 한국어식(n 글자 수) · other = 문장 등
// th · s 짝과 th · f 짝 낱말은 wind('on' 첫 자음 · 'off' 끝 자음) · wrole(th | s | f) · 같은 목소리의 짝 줄 wpair —
// 측정 도구가 그 자음의 바람 소리 세기(wl)를 재고, th · s 짝(wgap)은 s 쪽이 10dB 이상 센지 확인해요
window.__measureMeta = lines => {
  const byText = {}, wind = {};
  Object.values(TH.DICT).forEach(e => { byText[THV.spoken(e.w)] = e.key; });
  TH.PAIRS.filter(p => p.kind === 'ths' || p.kind === 'thf').forEach(p => {
    const side = p.pos === 'end' ? 'off' : 'on';
    wind[p.a] = [side, 'th', p.b, p.kind === 'ths']; wind[p.b] = [side, p.kind === 'ths' ? 's' : 'f', p.a, p.kind === 'ths'];
  });
  return lines.map(l => {
    const o = { id: l.id, sp: l.sp, text: l.text };
    if (l.sp === 'ko') return Object.assign(o, { kind: 'ko', n: [...l.text].length });
    const k = byText[l.text];
    if (!k) return Object.assign(o, { kind: 'other' });
    Object.assign(o, { kind: 'word', key: k, n: TH.nSyl(k), at: TH.stressAt(k) });
    if (wind[k]) Object.assign(o, { wind: wind[k][0], wrole: wind[k][1], wpair: THV.lineId(l.sp, THV.spoken(shown(wind[k][2]))) }, wind[k][3] ? { wgap: true } : {});
    return o;
  });
};
hvInit();
mpInit();
shInit();
PDrill($('drillRoot'), TH.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! th 소리가 귀에 들어오네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보고, 같은 목소리로 견줘 들어 보세요.' : '처음에는 누구나 헷갈려요. 놀이터의 듣고 가르기 훈련으로 여러 목소리를 더 들어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '혀끝이 할 일 — 윗니 끝에 가볍게, 막지 않고, 목을 울리거나 끄거나 — 을 모두 알았네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(THS.baseText()).then(() => { dirty = true; });
setTimeout(() => THS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
