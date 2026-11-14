/* ㅅ · ㅈ 너머 — s · sh · z · zh · y — 플레이어, 직접 해 보기, 듣고 가르기 훈련, 내 발음 확인, 따라 말하기, 듣고 고르기, 퀴즈, 영상 추출
 * 규칙과 낱말은 grammar.js(SZ), 그림은 scenes.js(SZS)와 공통 부품 EN.mouth, 목소리는 voices.js(SZV)가 맡습니다.
 * 소리가 겹치지 않게: 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(SZV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const SZ = window.SZ, SZS = window.SZS, SZV = window.SZV, S = SZS.S, M = EN.mouth;
const { CHAPTERS, CAPTIONS, END, POSTER } = SZS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L2 = 'AB';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const cv = $('cv'), ctx = cv.getContext('2d');
SZ.check();
// 03장 자막(‘네 목소리의 바람 소리를 재어 보면’ · ‘sh 소리는 s 소리보다 낮고’)과 잰 값이 맞는지 — 잰 값 파일이 있을 때만
if (window.PRON_MEASURE) {
  const R = SZS.fcRows();
  if (R.length !== SZ.VOICES.length) console.warn('[s · sh · z · zh · y] 03장: see · she를 모두 잰 목소리가 넷이 아니에요:', R.map(r => r.sp));
  R.forEach(r => { if (r.s - r.sh < 1000) console.warn(`[s · sh · z · zh · y] 03장: ${r.ko}의 see · she 바람 소리 높이 차가 1000Hz보다 작아요:`, r.s, r.sh); });
}

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = SZS.fonts;
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
  const ready = new Promise(res => SZS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: 'ㅅ · ㅈ 너머 — s · sh · z · zh · y — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { SZS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: SZS.iconSVG('mic'),
  rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="currentColor"/></svg>',
};
// 듣기 · 천천히 단추 묶음 (회화 영역의 듣기 연습 문제와 같은 모양 · 같은 키 R · S)
const lsnBar = () => SZV.supported
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
  const cap = started ? SZS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 낱말을 누르면 그 소리를 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = SZS.chapterAt(T);
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
  if (dirty) { dirty = false; SZS.render(ctx, started ? T : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
// 직접 해 보기에서 고르면: 영상을 멈추고 그 장의 u초 장면을 보여 줌
function showAt(u) {
  const ch = CHAPTERS[SZS.chapterAt(T)];
  if (playing) pause();
  T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}

/* =========================================================
   4. 소리 — 목소리 넷 + 한국어식으로 읽기 (voices.js). 읽기 전에 다른 소리는 모두 멈춤
   ========================================================= */
let audioEl = null;                       // 녹음 재생
function stopAudio() { if (audioEl) { try { audioEl.pause(); } catch (e) { /* 이미 멈춤 */ } audioEl = null; } document.querySelectorAll('.sh-play.saying').forEach(b => b.classList.remove('saying')); }
function stopSounds() { EN.say.stop(); SZV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return SZV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름. 같은 단추를 곧바로 다시 누르면 천천히
let lastLp = { b: null, at: 0 };
const lpBtn = (seq, label, cls = '', inner) => SZV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${inner || SVG_PLAY}</button>` : '';
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
const shown = w => { const e = SZ.entry(w); return e ? e.w : w; };
const wSeq = (w, sp = 'tc') => [{ text: shown(w), sp }];
const pairSeq = (a, b, sp = 'tc') => [{ text: shown(a), sp }, { text: shown(b), sp, gap: 0.7 }];
const WHO = { tc: '밝은 선생님', tf: '차분한 선생님', uf: '미국 여성', um: '미국 남성', ko: '한국어식' };
// 짝의 두 낱말이 모두 확인(받아쓰기 · 음절 · s · sh 짝은 바람 소리의 높이)을 통과한 목소리 — 통과하지 못한 파일은 들려주지 않아요(잰 값이 하나도 없으면 모든 목소리)
const ALL_SP = SZ.VOICES.map(v => v.sp);
const okVoices = (a, b) => { const ok = ALL_SP.filter(sp => !!SZV.meas(sp, shown(a)) && !!SZV.meas(sp, shown(b))); return ok.length || Object.keys(window.PRON_MEASURE || {}).length ? ok : ALL_SP; };

/* =========================================================
   5. 글 칠하기 — s · z · zh · y 소리를 적은 글자(mk-a 노랑) · sh · j 소리(mk-b 하늘), 한글 표기, 빠진 y(mk-trap), 넣은 으 · 이(mk-ins)
   ========================================================= */
const MK = { s: 'mk-a', z: 'mk-a', 'ʒ': 'mk-a', j: 'mk-a', 'ʃ': 'mk-b', 'dʒ': 'mk-b', y0: 'mk-trap' };
function wordHTML(w, o = {}) {
  const sp = SZ.spans(w).filter(s => !s.bad), t = shown(w);
  let h = '', at = 0;
  sp.forEach(s => { h += esc(t.slice(at, s.s)) + ((o.only && o.only !== s.role) || (o.pos && o.pos !== s.pos) ? esc(t.slice(s.s, s.e)) : `<mark class="${MK[s.ph]}">${esc(t.slice(s.s, s.e))}</mark>`); at = s.e; });
  return `<span lang="en">${h + esc(t.slice(at))}</span>`;
}
function koHTML(w, o = {}) {
  const e = SZ.entry(w); if (!e || !e.ko) return '';
  const marks = SZ.koMarks(w), ins = o.ins ? SZ.koInserted(w) : [];
  return [...e.ko].map((ch, i) => ins.indexOf(i) >= 0 ? `<mark class="mk-ins">${ch}</mark>` : o.trap ? `<mark class="mk-trap">${ch}</mark>` : marks[i] ? `<mark class="${MK[marks[i]]}">${ch}</mark>` : esc(ch)).join('');
}
function sentHTML(text) {
  return '<span lang="en">' + SZ.segs(text).map(s => s.ph ? `<mark class="${MK[s.ph]}">${esc(s.t)}</mark>` : esc(s.t)).join('') + '</span>';
}
// 낱말 단추: 누르면 들려줌(곧바로 다시 누르면 천천히)
const wBtn = (w, sp = 'tc', o = {}) => SZV.supported
  ? `<button type="button" class="wbtn${o.cls ? ' ' + o.cls : ''}" data-lp="${seqId(wSeq(w, sp))}" title="듣기: ${esc(shown(w))}${sp !== 'tc' ? ' · ' + WHO[sp] : ''}">${SVG_PLAY}${o.html || wordHTML(w)}</button>`
  : `<span class="wbtn off">${o.html || wordHTML(w)}</span>`;
const koBtn = (text, label) => SZV.supported ? `<button type="button" class="wbtn ko" data-lp="${seqId([{ text, sp: 'ko' }])}" title="한국어식으로 듣기: ${esc(text)}">${SVG_PLAY}${label || esc(text)}</button>` : `<span class="wbtn off ko">${label || esc(text)}</span>`;
const koBtnW = (w, o = {}) => { const e = SZ.entry(w); return e && e.ko ? koBtn(e.ko, koHTML(w, o)) : ''; };
const pairBtn = (a, b, note = '') => lpBtn(pairSeq(a, b), `이어서 듣기: ${shown(a)} · ${shown(b)}`, 'lp-voice', `${ICO.play}<span>${esc(shown(a))} · ${esc(shown(b))}${note}</span>`);
const posTag = p => `<span class="ptag p-${p}">${esc(SZ.POS[p].ko)}</span>`;
const NM = ph => SZ.NAME[ph] || ph;
const phLabel = ph => ph === 'y0' ? 'y 소리 없음' : `${NM(ph)} 소리`;
const soundName = (ph, L) => ph === 's' && L && L.hi ? 's 소리(이 앞)' : ph === 'j' && L && L.hi ? 'y 소리(이 앞)' : `${NM(ph)} 소리`;
const soundsOf = w => SZ.sounds(w).map(L => `${soundName(L.ph, L)} · ${SZ.POS[L.pos].ko}`).join(', ') || '이 편의 소리가 없어요(곧바로 모음)';
const sayOf = L => L.ph === 's' && L.hi ? SZ.SI_SAY : L.ph === 'j' && L.hi ? SZ.Y_SAY : SZ.POS[L.pos].say;

/* =========================================================
   6. 듣고 고르기 (이 튜토리얼 전용, 회화 영역의 듣기 연습 문제와 같은 .edr 모양) — 소리 먼저, 글은 답한 뒤
   키보드: A · B 또는 1 · 2 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · Enter/→ 다음
   ========================================================= */
const KIND_KO = { word: '어느 낱말?', sent: '문장 속 어느 낱말?', same: '같은 낱말? 다른 낱말?', ko: '한국어식은 어느 쪽?' };
const drillSeq = q => q.kind === 'same' || q.kind === 'ko'
  ? q.say.map((s, i) => ({ text: SZ.isKo(s) ? s : shown(s), sp: SZ.isKo(s) ? 'ko' : q.sp, gap: i ? 0.9 : undefined })).map(x => { if (x.gap === undefined) delete x.gap; return x; })
  : [{ text: q.say, sp: q.sp }];
function PDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0 }));
  let cur = 0, retry = null, mode = null;
  const hear = SZV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && SZV.busy()) { SZV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    const seq = drillSeq(it);
    speak(seq, { slow: !!slow, onitem(i) { say(`${WHO[seq[i].sp]} · 말하는 중`); }, onend(stopped) { mode = null; paintPlay(root, null); say(stopped ? '' : '다 들었어요. 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { SZV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; SZV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    SZV.stop();
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
      const [a, b] = it.say, same = a === b, homo = !same && SZ.homophone(a, b), d = same || homo ? null : SZ.pairDiff(a, b);
      return it.opts.map((_, k) => k === 0
        ? (same ? `같아요 — 두 번 모두 같은 낱말 → ${shown(a)}` : homo ? `같아요 — 철자는 ${shown(a)} · ${shown(b)}로 다르지만 소리가 같아요 ${SZ.ipa(a)}.` : `같지 않아요 — ${shown(a)} → ${shown(b)}, 소리 하나(${SZ.KIND_KO[d.kind]})가 달라요.`)
        : (same ? `다르지 않아요 — 같은 낱말 ${shown(a)}, 두 번 들려줬어요.` : homo ? `다르지 않아요 — 뜻은 달라도(${shown(a)} → ${SZ.entry(a).gloss} / ${shown(b)} → ${SZ.entry(b).gloss}) 소리는 같아요.` : `달라요 — ${shown(a)} · ${shown(b)}. ${SZ.POS[d.pos].long} 자리의 ${SZ.KIND_KO[d.kind]} 짝이에요.`));
    }
    if (it.kind === 'ko') {
      const en = SZ.drillWord(it), e = SZ.entry(en);
      return it.say.map((s, k) => SZ.isKo(s)
        ? `${k ? '둘째' : '첫째'} 소리 → 한국어식 ${s}. ${SZ.koParts(en).filter(p => p.ok).map(p => `${p.ch} = ${SZ.KO_KIND[p.kind]}`).join(' · ')}${SZ.koInserted(en).length ? ' · 끝에 넣은 모음' : ''}.`
        : `${k ? '둘째' : '첫째'} 소리 → 영어 ${shown(en)} ${SZ.ipa(en)} — ${e.gloss}. ${soundsOf(en)}.`);
    }
    return it.opts.map(w => `${shown(w)} ${SZ.ipa(w)} — ${SZ.entry(w).gloss}. ${soundsOf(w)}.`);
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = SZ.hints(it);
    const o = order(), pos = o.indexOf(cur), reveal = done || !hear;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${SZS.iconSVG('ear', 'pi')}${esc(KIND_KO[it.kind])}</span><span>${retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span><span class="edr-tag">${esc(WHO[it.sp])}</span></p>`;
    const sit = it.kind === 'same' ? '낱말 두 개를 차례로 들려줘요. 같은 소리인가요?' : it.kind === 'sent' ? '문장을 들려줘요. 빈칸에 들어간 낱말은?' : it.kind === 'ko' ? '같은 낱말을 두 번 들려줘요 — 한 번은 영어로, 한 번은 한국어식으로. 한국어식으로 읽은 쪽은?' : '낱말 하나를 들려줘요. 어느 낱말인가요?';
    h += `<p class="adr-sit"><b>상황</b> ${esc(sit)}</p>`;
    h += lsnBar();
    if (it.kind === 'sent') h += `<p class="ldr-q"><span class="ldr-t" lang="en">${reveal ? sentHTML(it.say) : esc(it.frame)}</span>${done && it.ko ? `<small>${esc(it.ko)}</small>` : ''}</p>`;
    else if ((it.kind === 'same' || it.kind === 'ko') && reveal) h += `<p class="ldr-q"><span class="ldr-t">${it.say.map(x => SZ.isKo(x) ? `<mark class="mk-trap">${esc(x)}</mark>` : wordHTML(x)).join(' → ')}</span></p>`;
    else if (reveal) h += `<p class="ldr-q"><span class="ldr-t">${wordHTML(it.say)}</span></p>`;
    h += `<div class="ldr-opts two" role="group" aria-label="보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
      const lab = it.kind === 'same' || it.kind === 'ko' ? esc(op) : wordHTML(op);
      return `<div class="ldr-row${cls}" data-k="${k}"><button type="button" class="ldr-opt big" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L2[k]})</b> <span class="ldr-t">${lab}</span>${it.kind === 'word' || it.kind === 'sent' ? `<small>${esc(SZ.entry(op).gloss)}</small>` : ''}</button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A · B 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L2[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L2[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const ws = SZ.drillWords(it).filter((w, i, a) => a.indexOf(w) === i && SZ.entry(w));
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
const LQ_PAIRS = [['see', 'she'], ['sip', 'ship'], ['zest', 'jest'], ['year', 'ear']];
const PAIR_OPTS = Object.keys(SZ.KINDS).map(k => [k, SZ.PAIRS.filter(x => x.kind === k)]);
const pairSelect = (cur, attr, id) => `<select class="lab-sel"${id ? ` id="${id}"` : ''} data-sel="${attr}" aria-label="짝 고르기">${attr === 'mp' ? '' : '<option value="">영상대로</option>'}${PAIR_OPTS.map(([k, list]) => `<optgroup label="${esc(SZ.KIND_KO[k])} 짝">${list.map(x => `<option value="${x.id}"${cur === x.id ? ' selected' : ''}>${esc(shown(x.a))} · ${esc(shown(x.b))} (${esc(SZ.POS[x.pos].ko)})</option>`).join('')}</optgroup>`).join('')}</select>`;
// 입 그림의 계산(EN.mouth.contact)으로 쓴 혀 설명
const mouthNote = ph => { const m = SZ.MOUTH[ph], [a, b] = SZS.tongueLines(m.pose); return `${a}(${b}) · ${m.voice ? '목이 울려요' : '목은 울리지 않아요'}`; };
const LABS = {
  intro() {
    return labHead('먼저 들어 보기') + `<p>보다 see와 그녀 she, 해 year와 귀 ear를 눌러 들어 보세요. 한국어식으로 적은 시 · 이어도 함께 들어 볼 수 있어요.</p>
      <div class="wrow">${wBtn('see')}${wBtn('she')}${koBtnW('see', { trap: true })}</div>
      <div class="wrow">${wBtn('year')}${wBtn('ear')}${koBtnW('year', { trap: true })}</div>
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
    const p = S.kpair ? SZ.pairById(S.kpair) : null;
    let h = labHead('짝의 한국어식 표기') + row('짝', pairSelect(S.kpair, 'kpair'));
    if (!p) return h + '<p class="note">짝을 고르면 영상이 멈추고, 두 낱말이 한국어식으로 같은 표기가 되는지 보여 줘요. 같은 표기가 되는 짝이 많지만, 모두 그렇지는 않아요(sell 셀 · shell 셸).</p>';
    const same = SZ.koSame(p.a, p.b);
    h += `<table class="koexp"><thead><tr><th>낱말</th><th>외래어 표기</th><th>한글이 적은 소리</th><th>소리</th></tr></thead><tbody>${[p.a, p.b].map(w => `<tr><td>${wBtn(w)}</td><td class="ko">${koBtnW(w)}</td><td>${esc(SZ.koParts(w).filter(x => x.ok).map(x => `${x.ch} → ${SZ.KO_KIND[x.kind]}`).join(', ') || '—')}</td><td>${SZ.sounds(w).map(x => `<mark class="${MK[x.ph]}">${esc(soundName(x.ph, x))}</mark>`).join(' ') || '—'}</td></tr>`).join('')}</tbody></table>`;
    const by = p.kind === 'y0' ? 'y 소리가 있느냐뿐이에요' : '혀의 자리(와 목 울림)뿐이에요';
    h += `<p class="note"><b>${same ? '같은 표기' : '다른 표기'}</b> — ${same ? `한국어식으로는 둘 다 ${esc(SZ.entry(p.a).ko)}. 소리를 가르는 것은 ${by}.` : `${esc(SZ.entry(p.a).ko)} · ${esc(SZ.entry(p.b).ko)}. 표기는 달라도 ${esc(SZ.KIND_KO[p.kind])} 소리는 혀의 자리로 갈라요.`} ${posTag(p.pos)} ${esc(SZ.POS[p.pos].long)}</p>`;
    return h + clearBtn;
  },
  s() {
    const sh = S.spose === 'sh', ph = sh ? 'ʃ' : 's';
    return labHead('s 소리 · sh 소리 — 혀의 자리') + `${row('혀의 자리', seg('혀의 자리', [['s', 's 소리 · 혀끝을 앞에'], ['sh', 'sh 소리 · 조금 뒤 + 둥근 입술']], sh ? 'sh' : 's', 'spz'))}
      <p class="note">${esc(mouthNote(ph))}. ${sh ? '혀 앞을 넓게 올리고 입술을 동그랗게 조금 내밀어요. 바람 소리가 낮고 두툼해져요.' : '혀 가운데의 좁은 길로 바람을 세게 보내요. 입술은 옆으로 — 바람 소리가 높아요.'}</p>
      <p>이 앞의 s 소리 — 한국어식은 시</p><div class="wrow">${SZ.SETS.sI.map(w => wBtn(w) + koBtnW(w)).join('')}</div>
      <p>sh 소리</p><div class="wrow">${SZ.SETS.shW.map(w => wBtn(w)).join('')}</div>
      <div class="wrow">${SZ.SETS.ssPairs.map(([a, b]) => pairBtn(a, b)).join('')}</div>`;
  },
  z() {
    const m = S.zmode || 'z', ph = m === 's' ? 's' : m === 'dj' ? 'dʒ' : 'z';
    return labHead('z 소리 · 혀를 띄우고 목 울림') + `${row('혀 · 목', seg('혀와 목', [['z', 'z 소리 · 혀를 띄우고 목 울림'], ['s', 's 소리 · 목 울림 끄기'], ['dj', 'j 소리 · 혀를 붙였다가 떼기']], m, 'zm'))}
      <p class="note">${esc(mouthNote(ph))}. ${ph === 'z' ? '혀는 s 소리와 똑같이 두고 목만 켜요.' : ph === 's' ? '혀는 그대로, 목만 꺼요.' : '한국어 ㅈ과 비슷해요. z 소리는 처음부터 붙이지 않아요.'}</p>
      <p>처음 자리의 z 소리 — 한국어식은 ㅈ</p><div class="wrow">${SZ.SETS.zStart.map(w => wBtn(w) + koBtnW(w)).join('')}</div>
      <p>짝으로 듣기 (z 소리 → j 소리)</p><div class="wrow">${SZ.SETS.zjPairs.map(([a, b]) => pairBtn(a, b)).join('')}</div>
      <p>모음 사이의 z 소리</p><div class="wrow">${SZ.SETS.zMid.map(w => wBtn(w)).join('')}</div>`;
  },
  zh() {
    const m = S.zhmode || 'zh', ph = m === 'sh' ? 'ʃ' : m === 'dj' ? 'dʒ' : 'ʒ';
    return labHead('zh 소리 · sh 소리 + 목 울림') + `${row('혀 · 목', seg('혀와 목', [['zh', 'zh 소리 · 목 울림'], ['sh', 'sh 소리 · 목 울림 끄기'], ['dj', 'j 소리 · 혀를 붙였다가 떼기']], m, 'zhm'))}
      <p class="note">${esc(mouthNote(ph))}. ${ph === 'ʒ' ? '혀를 조금 뒤로, 입술을 조금 내밀고, 혀를 띄운 채 목을 울려요.' : ph === 'ʃ' ? '같은 혀 · 같은 입술, 목만 꺼요.' : '혀가 닿으면 j 소리가 돼요 — 한국어식 ㅈ.'}</p>
      <p>가운데의 zh 소리 — 한국어식은 ㅈ</p><div class="wrow">${SZ.SETS.zh.map(w => wBtn(w) + koBtnW(w)).join('')}</div>
      <p>끝의 zh 소리 — 한국어식은 끝에 이</p><div class="wrow">${SZ.SETS.zhEnd.map(w => wBtn(w) + koBtnW(w, { ins: true })).join('')}</div>
      <div class="wrow">${pairBtn('lesion', 'legion', ' (한국어로는 둘 다 리전)')}</div>`;
  },
  y() {
    const drop = S.ymode === 'y0', ph = drop ? 'y0' : 'j';
    return labHead('y 소리 · 이 앞에서도 혀를 먼저') + `${row('혀', seg('y 소리', [['y', 'y 소리 · 혀를 먼저 올리기'], ['y0', 'y 소리 없이 · 곧바로 모음']], drop ? 'y0' : 'y', 'ym'))}
      <p class="note">${drop ? 'y 소리를 빼면 곧바로 이 모음으로 시작해요 → year가 ear처럼 들려요.' : `${esc(mouthNote(ph))}. 혀 앞을 이 모음보다 더 높이 올렸다가 내리며 다음 모음으로 가요.`}</p>
      <p>야 · 여 · 요 · 유와 비슷한 y 소리</p><div class="wrow">${SZ.SETS.yGlide.map(w => wBtn(w) + koBtnW(w)).join('')}</div>
      <p>이 앞의 y 소리 — 한국어식은 y가 빠져요</p><div class="wrow">${SZ.SETS.yI.map(w => wBtn(w) + koBtnW(w)).join('')}</div>
      <div class="wrow">${SZ.PAIRS.filter(p => p.kind === 'y0').map(p => pairBtn(p.a, p.b)).join('')}</div>`;
  },
  place() {
    const all = SZ.POS_ORDER.map(p => [p, SZ.SETS.place[p]]);
    let h = labHead('낱말 속 자리') + row('낱말', `<div class="wrow sel">${all.map(([p, list]) => list.map(w => `<button type="button" class="pickw${S.pword === w ? ' on' : ''}" data-pw="${w}" aria-pressed="${S.pword === w}" title="${esc(SZ.POS[p].ko)}">${wordHTML(w, { pos: p })}</button>`).join('')).join('')}</div>`);
    const w = S.pword;
    if (!w) return h + '<p class="note">낱말을 고르면 영상이 멈추고, 영어 음절과 한국어식 음절을 견줘 보여 줘요. 끝 자음 뒤의 으는 <a href="../final-consonants/index.html">끝소리 튜토리얼</a>에서 더 자세히 다뤄요.</p>';
    h += `<div class="wrow">${wBtn(w)}${koBtnW(w, { ins: true })}</div>
      <ul class="plan">${SZ.sounds(w).map(L => `<li>${posTag(L.pos)} <mark class="${MK[L.ph]}">${esc(soundName(L.ph, L))}</mark> — ${esc(sayOf(L))}</li>`).join('')}</ul>
      <p class="note">영어 ${SZ.syl(w)}음절 · 한국어식 ${SZ.koSyl(w)}음절${SZ.koInserted(w).length ? ' (분홍 → 넣은 모음)' : ''}.</p>`;
    return h + clearBtn;
  },
  loan() {
    let h = labHead('외래어 하나씩') + row('낱말', `<div class="wrow sel">${SZ.LOAN.map(o => `<button type="button" class="pickw${S.loan === o.w ? ' on' : ''}" data-ln="${o.w}" aria-pressed="${S.loan === o.w}">${koHTML(o.w, { trap: true })}</button>`).join('')}</div>`);
    const o = S.loan && SZ.LOAN.find(x => x.w === S.loan);
    if (!o) return h + '<p class="note">한국어식 표기를 고르면, 영어로 말할 때 낱말 속 소리를 하나씩 정해 줘요.</p>';
    const DO = { s: '혀끝을 윗잇몸 가까이 두고 좁은 길로 바람을 내요', z: '혀를 띄운 채(닿지 않게) 목을 울려요', 'ʒ': '혀를 조금 뒤로, 입술을 조금 내밀고, 혀를 띄운 채 목을 울려요', 'ʃ': '혀를 조금 뒤로 빼고 입술을 동그랗게 내밀어요', 'dʒ': '혀를 윗잇몸 뒤에 붙였다가 떼요(한국어 ㅈ과 비슷)', j: '혀 앞을 센입천장 가까이 올렸다가 다음 모음으로 내려요' };
    const plan = SZ.sounds(o.w).map(L => `<li>${posTag(L.pos)} <mark class="${MK[L.ph]}">${esc(soundName(L.ph, L))}</mark> → ${esc(DO[L.ph])}${L.ph === 's' && L.hi ? ' — 이 앞에서도 혀끝은 앞에' : ''}${L.pos === 'end' ? ', 끝에 으 · 이를 붙이지 않아요' : ''}</li>`).join('');
    return h + `<div class="wrow">${koBtnW(o.w, { trap: true })}<span class="arr">→</span>${wBtn(o.w)}</div><ol class="plan">${plan}</ol><p class="note"><b>${esc(SZ.TRAP[o.trap].ko)}</b> — ${esc(SZ.TRAP[o.trap].why)}.</p>` + clearBtn;
  },
  sentence() {
    const opts = SZ.GROUP_ORDER.map(gp => `<optgroup label="${esc(SZ.GROUPS[gp])}">${SZ.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gp).map(([s, i]) => `<option value="${i}"${S.sent === i ? ' selected' : ''}>${esc(s.en)}</option>`).join('')}</optgroup>`).join('');
    let h = labHead('문장 고르기') + row('문장', `<select class="lab-sel" data-sel="sent" aria-label="문장 고르기"><option value="">영상대로</option>${opts}</select>`);
    if (S.sent == null) return h + '<p class="note">따라 말하기의 28문장 가운데 하나를 고르면 영상에 크게 보여 줘요.</p>';
    const s = SZ.SENT[S.sent], c = SZ.countIn(s.en);
    return h + `<p class="enline">${lpBtn(wSeq(s.en), '듣기: ' + s.en)}${sentHTML(s.en)}</p><p class="note">${esc(s.ko)} · ${['s', 'ʃ', 'z', 'ʒ', 'dʒ', 'j'].filter(k => c[k]).map(k => `${NM(k)} 소리 ${c[k]}`).join(' · ')}</p>` + clearBtn;
  },
  summary() {
    return labHead('이제 직접') + `<p>아래 <a href="#playground">듣고 가르기 훈련</a>에서 목소리 넷으로 짝을 가르고, <a href="#mypron">내 발음 확인</a>에서 음성 인식이 내 말을 어느 낱말로 듣는지 확인해 보세요. <a href="#shadow">따라 말하기</a> 28문장과 <a href="#drill">듣고 고르기</a> 16문제도 있어요. 끝 자음 뒤의 으 · 이는 <a href="../final-consonants/index.html">끝소리 튜토리얼</a>에서 이어서 익혀요.</p>`;
  },
};
function buildLab(ci) {
  const id = CHAPTERS[ci].id;
  $('lab').innerHTML = (LABS[id] || (() => ''))();
}
const relab = () => buildLab(SZS.chapterAt(T));
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
  if (b.id === 'labClear') { Object.assign(S, JSON.parse(SZS.DEFAULTS)); dirty = true; relab(); return; }
  if (d.spz) { S.spose = d.spz; showAt(8); relab(); return; }
  if (d.zm) { S.zmode = d.zm; showAt(8); relab(); return; }
  if (d.zhm) { S.zhmode = d.zhm; showAt(8); relab(); return; }
  if (d.ym) { S.ymode = d.ym; showAt(4); relab(); return; }
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
   혼자 쓴 로마자(s · sh · z · zh · j · y · m)는 한국어 이름으로, ㅅ · ㅈ은 시옷 · 지읒으로 읽어요
   ========================================================= */
const LETTER_KO = { s: '에스', sh: '에스에이치', z: '제트', zh: '제트에이치', j: '제이', y: '와이', m: '엠' };
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/ㅅ/g, '시옷'], [/ㅈ/g, '지읒'], [/(^|[^A-Za-z'’-])(sh|zh|[szjym])(?=[\s가-힣.,·)]|$)/g, (m, a, c) => a + LETTER_KO[c]], [/\s\+\s/g, ', '], [/ = /g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
  enRate: SZV.EN_RATE,      // 영어 조각만 살짝 느리게 (voices.js의 EN_RATE — 낱말 소리와 같은 빠르기)
  clips: window.EN_CLIPS,   // 미리 만든 음성 파일(audio/narration/) — 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };
if (window.EN && EN.say) EN.say.rate = SZV.EN_RATE;   // 발음 듣기 단추도 같은 빠르기

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
   기록은 이 브라우저에만(localStorage 'en-sz-hvpt-v1'). 키보드: R 듣기 · 1 · 2 고르기 · Space/Enter 다음
   ========================================================= */
const HV_KEY = 'en-sz-hvpt-v1';
const HV = { kind: 'all', voice: 'all', cur: null, pick: null, stats: null, streak: 0 };
const hvEmpty = () => ({ pos: { start: [0, 0], cluster: [0, 0], mid: [0, 0], end: [0, 0] }, kind: { ssh: [0, 0], zj: [0, 0], zhj: [0, 0], y0: [0, 0] }, voice: { tc: [0, 0], tf: [0, 0], uf: [0, 0], um: [0, 0] } });
function hvLoad() { try { const s = JSON.parse(localStorage.getItem(HV_KEY) || 'null'); HV.stats = s && s.pos && s.kind && s.voice ? s : hvEmpty(); } catch (e) { HV.stats = hvEmpty(); } }
function hvSave() { try { localStorage.setItem(HV_KEY, JSON.stringify(HV.stats)); } catch (e) { /* 저장하지 못해도 이번에는 계속 */ } }
function hvNew(auto) {
  const all = SZ.PAIRS.filter(p => HV.kind === 'all' || p.kind === HV.kind);
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
  if (!c) h = `<p class="hv-hello">목소리 넷 가운데 하나가 짝 낱말 하나를 말해요. 들은 낱말을 고르세요. 여러 목소리로 많이 들을수록 s · sh, z · j, y 소리가 있고 없음의 차이가 귀에 들어와요.</p><div class="acts"><button type="button" class="btn" id="hvStart">${ICO.play} 시작하기</button></div>`;
  else {
    const done = HV.pick !== null, ok = done && c.opts[HV.pick] === c.word;
    h += `<div class="hv-top"><button type="button" class="btn hv-play" id="hvPlayBtn">${ICO.play} 듣기 <small>R</small></button><button type="button" class="btn ghost" id="hvSlow">${ICO.slow} 천천히</button><span class="hv-who">${esc(WHO[c.sp])} · ${esc(SZ.KIND_KO[c.p.kind])} · ${posTag(c.p.pos)}</span></div>`;
    h += `<div class="hv-opts">${c.opts.map((w, k) => `<button type="button" class="hv-opt${done ? (w === c.word ? ' right' : k === HV.pick ? ' wrong' : ' off') : ''}" data-hv="${k}"${done ? ' disabled' : ''}><b>${k + 1}</b>${wordHTML(w)}<small>${esc(SZ.entry(w).gloss)}</small></button>`).join('')}</div>`;
    if (done) {
      h += `<p class="verdict"><b class="${ok ? 'c-ok' : 'c-no'}">${ok ? '맞아요' : '아쉬워요'}</b>들려준 낱말 → ${wordHTML(c.word)} ${esc(SZ.ipa(c.word))}${HV.streak > 1 ? ` · 연속 ${HV.streak}번!` : ''}</p>`;
      h += `<div class="wrow">${c.opts.map(w => wBtn(w, c.sp)).join('')}${lpBtn(pairSeq(c.p.a, c.p.b, c.sp), '이어서 듣기', 'lp-voice', `${ICO.play}<span>${esc(SZ.KIND_KO[c.p.kind])} 이어서</span>`)}</div>`;
      h += `<p class="note">${esc(SZ.hints({ kind: 'word', say: c.word, opts: [c.p.a, c.p.b] })[0].text)}</p><div class="acts"><button type="button" class="btn" id="hvNext">다음 <small>Space</small></button></div>`;
    }
  }
  box.innerHTML = h;
  const st = HV.stats;
  const all = Object.values(st.pos).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
  $('hvStats').innerHTML = `<table class="hv-tab"><caption>자리마다 맞힌 비율 (이 브라우저에만 저장)</caption><tbody>${SZ.POS_ORDER.filter(p => SZ.PAIRS.some(q => q.pos === p)).map(p => meterRow(esc(SZ.POS[p].long), st.pos[p])).join('')}<tr class="all"><th scope="row">모두</th><td>${all[0]} / ${all[1]}</td><td>${pct(all) == null ? '–' : pct(all) + '%'}</td></tr></tbody></table>
    <table class="hv-tab"><caption>짝마다</caption><tbody>${Object.keys(SZ.KINDS).map(k => meterRow(`${esc(SZ.KIND_KO[k])} 짝`, st.kind[k])).join('')}</tbody></table>
    <p class="note">목소리마다: ${SZ.VOICES.map(v => `${esc(v.ko)} ${pct(st.voice[v.sp]) == null ? '–' : pct(st.voice[v.sp]) + '%'}`).join(' · ')}</p>`;
}
function hvInit() {
  hvLoad();
  $('hvCtl').innerHTML = row('짝', seg('짝 고르기', [['all', '모두']].concat(Object.keys(SZ.KINDS).map(k => [k, `${SZ.KIND_KO[k]} (${SZ.PAIRS.filter(p => p.kind === k).length})`])), HV.kind, 'hvk')) +
    row('목소리', seg('목소리 고르기', [['all', '넷 섞어서']].concat(SZ.VOICES.map(v => [v.sp, v.ko])), HV.voice, 'hvv'));
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
const MP = { pair: SZ.PAIRS[0].id, side: 'a', url: null, res: null, busy: false };
const mpTarget = () => { const p = SZ.pairById(MP.pair); return { p, w: MP.side === 'a' ? p.a : p.b, other: MP.side === 'a' ? p.b : p.a }; };
// 짝을 가르는 소리(그 낱말 쪽) — y가 없는 쪽은 'y0'
const mpPhone = (p, w) => SZ.pairPhone(p, w);
function mpDrawFig() {
  const c = $('mpFig'); if (!c) return;
  const { p, w } = mpTarget(), ph = mpPhone(p, w), m = SZ.MOUTH[ph], g = c.getContext('2d'), d = Math.min(2, window.devicePixelRatio || 1);
  c.width = 260 * d; c.height = 234 * d; g.setTransform(d, 0, 0, d, 0, 0);
  g.fillStyle = '#10151C'; g.fillRect(0, 0, 260, 234);
  M.draw(g, 0, 0, 0.65, m.pose, { mark: ph === 'y0' ? null : SZS.PCOL[ph], voice: m.voice ? 0.3 : null, labels: ['ridge', 'tip'], font: (sz, wt) => SZS.fonts.fnt(sz, wt || 600) });
}
const SAY_TIP = { s: '혀끝을 윗잇몸 가까이 두고 좁은 길로 바람부터', 'ʃ': '혀를 조금 뒤로 빼고 입술을 동그랗게 내밀며', z: '혀를 띄운 채 목을 울리며', 'ʒ': '혀를 조금 뒤로, 입술을 내밀고, 혀를 띄운 채 목을 울리며', 'dʒ': '혀를 윗잇몸 뒤에 붙였다가 떼며', j: '혀 앞을 센입천장 가까이 먼저 올렸다가 내리며', y0: '혀를 미리 올리지 않고 곧바로 모음으로' };
function mpDraw() {
  const { p, w, other } = mpTarget(), ph = mpPhone(p, w), oph = mpPhone(p, other);
  let h = `<div class="mp-ctl">${row('짝', pairSelect(MP.pair, 'mp', 'mpSel'))}${row('말할 낱말', seg('말할 낱말', [['a', `${esc(shown(p.a))} · ${esc(phLabel(mpPhone(p, p.a)))}`], ['b', `${esc(shown(p.b))} · ${esc(phLabel(mpPhone(p, p.b)))}`]], MP.side, 'mpside'))}</div>`;
  h += `<div class="mp-body"><canvas id="mpFig" class="mp-fig" width="260" height="234" role="img" aria-label="입 모양 (${esc(shown(w))}, ${esc(phLabel(ph))}): ${esc(SZS.tongueLines(SZ.MOUTH[ph].pose).join(' · '))}"></canvas>
    <div class="mp-word"><p class="mp-big">${wordHTML(w)}</p><p class="note">${esc(SZ.ipa(w))} · ${esc(SZ.entry(w).gloss)} · 짝 → ${wordHTML(other)}</p>
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
    const fix = { s: '혀끝이 앞에 있었는지(입술은 옆으로)', 'ʃ': '혀를 조금 뒤로 빼고 입술을 내밀었는지', z: '혀가 닿지 않았는지, 목이 울렸는지', 'ʒ': '혀가 닿지 않았는지, 목이 울렸는지', 'dʒ': '혀를 붙였다가 뗐는지', j: '혀 앞을 먼저 올렸는지', y0: '혀를 미리 올리지 않았는지' }[ph];
    h += `<p class="verdict"><b class="${cls}">${esc(SZ.HEARD_KO[r.verdict])}</b>${r.verdict === 'partner' ? `받아 적은 말 → 짝 낱말 ${esc(shown(r.partner))}. ${esc(fix)} 확인하고 다시 해 보세요.` : r.verdict === 'target' ? '인식기가 목표 낱말로 받아 적었어요.' : r.verdict === 'maybe' ? `목표 낱말 → ${r.rank}번째 후보. 조금 더 또렷하게 해 보세요.` : r.verdict === 'other' ? '목표 낱말도 짝 낱말도 아닌 말로 받아 적었어요. 낱말 하나만 또박또박 말해 보세요.' : ''}</p>`;
    if (r.alts && r.alts.length) h += `<p class="note">인식 후보: ${r.alts.map((a, i) => `<span class="alt${i === 0 ? ' top' : ''}" lang="en">${esc(a)}</span>`).join(' · ')}</p>`;
  }
  if (MP.err) h += `<p class="sh-err">${esc(MP.err)}</p>`;
  if (MP.url) h += `<div class="mo"><button type="button" class="sh-play" id="mpMine">${ICO.play} 내 목소리</button>${SZV.supported ? `<button type="button" class="sh-play" id="mpModel">${ICO.play} 본보기</button><button type="button" class="sh-play" id="mpBoth">${ICO.play} 번갈아 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`;
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
        onText(alts) { MP.res = Object.assign(SZ.heard(w, alts, other), { alts }); mpResult(); },
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
        if (url) playUrl(url, $('mpMine'), () => { if (SZV.supported) speak(wSeq(w)); });
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
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). see를 sea로 받아 적는 것처럼 소리가 같은 낱말은 맞은 것으로 쳐요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = SZ.GROUP_ORDER.map(gp => ({ gp, rows: SZ.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gp) }));
  $('shList').innerHTML = groups.map(({ gp, rows }) => `<section class="sh-grp"><h3><span class="ptag p-start">${esc(SZ.GROUPS[gp])}</span> ${esc(SZ.GROUPS[gp])}가 든 문장</h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${SZV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-en">${sentHTML(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { return [{ text: SZ.SENT[i].en, sp: 'tc' }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = SZ.SENT[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, SZ.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${SZV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
    shPlayMine(i, true);
  };
  SHREC.rec = mr; mr.start(); shMicState(i, true);
  shResult(i, '<span class="note">녹음 중이에요. 다 말했으면 ‘멈추기’를 눌러요(6초가 지나면 저절로 멈춰요).</span>');
  SHREC.tm = setTimeout(() => { if (SHREC.rec === mr) { SHREC.rec = null; try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 6000);
}
function shPlayMine(i, thenOrig) {
  const b = document.querySelector(`.sh-row[data-i="${i}"] [data-mine]`);
  playUrl(SHREC.url[i], b, thenOrig && SZV.supported ? () => speak(shSeq(i)) : null);
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
  const C = p => M.contact(p);
  const fig3 = ['sh', 's', 'dj', 'y'], fig6 = ['s', 'y', 'sh', 'dj'];
  const isS = p => { const c = C(p); return !c.touch && c.where === '윗잇몸' && (M.pose(p).round || 0) < 0.1; };
  const q = [
    { q: '보다 see와 그녀 she를 외래어 표기로 적으면?', opts: ['시 · 쉬', '시 · 시 (같은 표기)', '씨 · 시', '스 · 시'], a: 1,
      why: 's 소리도 sh 소리도 ㅅ으로 적고, 이 앞에서는 둘 다 시가 돼요. 표기로는 가를 수 없으니 혀의 자리(앞 ↔ 조금 뒤 + 둥근 입술)로 갈라야 해요.',
      check: () => SZ.entry('see').ko === '시' && SZ.entry('she').ko === '시' && SZ.koSame('see', 'she') },
    { q: '한국어를 쓰는 영어 학습자의 발음 연구(Eckman & Iverson 2013)에서, 이(높은 앞 모음) 앞의 s 소리는 어떻게 나기 쉬웠나요?', opts: ['sh 소리처럼', 'z 소리처럼', 'th 소리처럼', '언제나 정확하게'], a: 0,
      why: '이 앞의 s 소리를 sh 소리로 내는 일이 많았어요. 한국어에서 ㅅ이 이 앞에서 시처럼 바뀌는 습관이 옮겨 온 것으로 설명해요. 이 구별을 익힌 학습자일수록 이런 실수가 줄었어요.',
      check: () => SZ.sounds('see')[0].hi && SZ.koSame('see', 'she') },
    { q: 's 소리의 혀는? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: mouthFig('입 옆 단면도 넷. A 혀가 조금 뒤에 있고 입술을 내밂, B 혀끝이 윗잇몸 가까이(닿지 않음), C 혀가 윗잇몸 뒤에 닿음, D 혀 앞이 센입천장 가까이', fig3),
      why: 'B → 혀끝이 윗잇몸 가까이 있지만 닿지 않고, 입술은 모으지 않아요. A는 sh 소리, C는 j 소리(한국어 ㅈ), D는 y 소리예요.',
      check: () => fig3.map(isS).indexOf(true) === 1 && fig3.filter(isS).length === 1 },
    { q: 'sh 소리를 s 소리와 가르는 입 모양은?', opts: ['목을 울려요', '혀끝을 윗니 사이로 내밀어요', '혀를 조금 뒤로 빼고 입술을 동그랗게 내밀어요', '두 입술을 닫아요'], a: 2,
      why: 'sh 소리는 혀를 s 소리보다 조금 뒤로 빼고 혀 앞을 넓게 올려요. 입술은 동그랗게 조금 내밀어요. 그래서 바람 소리가 더 낮고 두툼해요. 둘 다 목은 울리지 않아요.',
      check: () => (M.pose('sh').round || 0) >= 0.4 && (M.pose('s').round || 0) < 0.1 && C('sh').at[0] > C('s').at[0] && !SZ.MOUTH['ʃ'].voice && !SZ.MOUTH.s.voice },
    { q: 'z 소리를 s 소리와 가르는 것은?', opts: ['혀의 자리', '입술 모으기', '혀가 닿느냐', '목 울림'], a: 3,
      why: 'z 소리와 s 소리는 혀의 자리가 같아요(혀끝 → 윗잇몸 가까이, 닿지 않음). 다른 점은 목 울림 하나예요.',
      check: () => SZ.MOUTH.z.pose === SZ.MOUTH.s.pose && SZ.MOUTH.z.voice && !SZ.MOUTH.s.voice },
    { q: 'j 소리(한국어 ㅈ과 비슷)를 시작할 때의 혀는? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: mouthFig('입 옆 단면도 넷. A 혀끝이 윗잇몸 가까이(닿지 않음), B 혀 앞이 센입천장 가까이, C 혀가 조금 뒤에 있고 입술을 내밂, D 혀가 윗잇몸 뒤에 닿음', fig6),
      why: 'D → 혀끝과 혀날이 윗잇몸 뒤에 붙어 공기를 막았다가 떼요. z · zh 소리는 혀가 닿지 않아요. 그래서 제로처럼 혀를 붙이면 z 소리가 j 소리 쪽으로 가요.',
      check: () => fig6.map(p => C(p).touch).indexOf(true) === 3 && fig6.filter(p => C(p).touch).length === 1 && SZ.MOUTH['dʒ'].pose === 'dj' },
    { q: 'Seo & Lim(2011)의 연구에서, 원어민은 한국 학습자가 낸 낱말 처음의 z 소리를 무엇으로 자주 들었나요?', opts: ['s 소리', 'j 소리', 'sh 소리', 'th 소리'], a: 1,
      why: 'j 소리로 들은 일이 많았어요. 저자들은 한국어 화자가 z · zh · j 소리를 모두 ㅈ에 맞춰 듣고 낸다고 설명해요. 다만 학습자 수가 적은 연구예요.',
      check: () => SZ.koSame('zest', 'jest') && SZ.koParts('zest')[0].ch === '제' },
    { q: 'vision을 외래어 표기로 적으면(비전) zh 소리는 어떤 자음이 되나요?', opts: ['ㅅ', 'ㅊ', 'ㅈ', '없어져요'], a: 2,
      why: 'zh 소리는 ㅈ으로 적어요(비전 · 레저 · 캐주얼). ㅈ은 혀가 닿는 소리라, 영어로 말할 때는 혀를 띄운 채 목을 울려요.',
      check: () => { const p = SZ.koParts('vision').find(x => x.ph === 'ʒ'); return !!p && p.ok && SZ.hangul(p.ch)[0].on === 12; } },
    { q: '해 year를 한국어식으로 적은 이어에서 사라진 소리는?', opts: ['y 소리', 'r 소리', '이 모음', '없어요'], a: 0,
      why: '이 앞의 y 소리는 외래어 표기에서 빠져요(이어 · 이스트). 그래서 year와 ear가 같은 표기가 돼요. 영어는 이 앞에서도 혀를 먼저 높이 올렸다가 내려요.',
      check: () => SZ.koParts('year')[0].kind === 'y0' && SZ.entry('year').ph[0] === 'j' && SZ.koSame('year', 'ear') },
    { q: 'She sells sea shells. 이 문장에서 sh 소리가 나는 낱말은?', opts: ['sells · sea', 'She · sea', 'She · shells', 'sells · shells'], a: 2,
      why: 'She · shells → sh 소리예요(입술을 내밀어요). sells · sea의 s는 s 소리, sells · shells 끝의 s는 z 소리예요.',
      check: () => SZ.segs('She sells sea shells.').filter(s => s.ph === 'ʃ').map(s => s.w.toLowerCase()).join() === 'she,shells' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[s · sh · z · zh · y] 퀴즈 ${i + 1}번의 정답이 규칙 엔진 · 입 그림과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[s · sh · z · zh · y] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
  return q;
})();
SZS.QUIZ = QS;

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
$('ttsBtn').addEventListener('click', () => { SZV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = SZS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * SZS.W, (e.clientY - r.top) / r.height * SZS.H]; };
const hitAt = (x, y) => started ? SZS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
let lastHit = { k: '', at: 0 };
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.play && SZV.supported) {
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
EN.say.wire(document, { before() { SZV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = ' ' + SZV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 영상의 낱말 · 한글 표기 · 목소리 단추, 직접 해 보기(고르는 것은 하나씩), 듣고 가르기 훈련 · 내 발음 확인(짝 20 × 목소리 넷), 듣고 고르기, 따라 말하기
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text) return;
    const id = SZV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: SZV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(SZS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 누를 수 있는 낱말 · 한글 표기 · 목소리 단추. 직접 해 보기로 바뀌는 장면도 하나씩
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t, ch.t + ch.d]; };
    const placeWords = [].concat(...Object.values(SZ.SETS.place));
    const sweeps = [[{}, [0, END]]]
      .concat(SZ.PAIRS.map(p => [{ pair: p.id }, span('listen')]), SZ.PAIRS.map(p => [{ kpair: p.id }, span('korean')]))
      .concat([[{ spose: 'sh' }, span('s')], [{ spose: 's' }, span('s')], [{ zmode: 's' }, span('z')], [{ zmode: 'dj' }, span('z')], [{ zmode: 'z' }, span('z')],
        [{ zhmode: 'sh' }, span('zh')], [{ zhmode: 'dj' }, span('zh')], [{ ymode: 'y0' }, span('y')], [{ ymode: 'y' }, span('y')]])
      .concat(placeWords.map(w => [{ pword: w }, span('place')]), SZ.LOAN.map(o => [{ loan: o.w }, span('loan')]), SZ.SENT.map((_, i) => [{ sent: i }, span('sentence')]));
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.5) { SZS.render(g, t); SZS.hits().forEach(h => addSeq(h.play, 'video')); }
    });
    // 2) 직접 해 보기: 장마다 + 고르는 것은 하나씩
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* */ } });
    SZ.PAIRS.forEach(p => { S.kpair = p.id; LABS.korean(); });
    ['s', 'sh'].forEach(v => { S.spose = v; LABS.s(); }); ['z', 's', 'dj'].forEach(v => { S.zmode = v; LABS.z(); }); ['zh', 'sh', 'dj'].forEach(v => { S.zhmode = v; LABS.zh(); }); ['y', 'y0'].forEach(v => { S.ymode = v; LABS.y(); });
    placeWords.forEach(w => { S.pword = w; LABS.place(); });
    SZ.LOAN.forEach(o => { S.loan = o.w; LABS.loan(); });
    SZ.SENT.forEach((_, i) => { S.sent = i; LABS.sentence(); });
    LQ_PAIRS.forEach(([a, b]) => SZ.VOICES.forEach(v => [a, b].forEach(w => { LAB.lq = { word: w, sp: v.sp, opts: [a, b], pair: a + '-' + b }; LAB.lqPick = a; LABS.listen(); })));
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 듣고 가르기 훈련 · 내 발음 확인: 짝 20 × 목소리 넷 (+ 이어서 듣기는 같은 줄)
  SZ.PAIRS.forEach(p => SZ.VOICES.forEach(v => { add(v.sp, shown(p.a), 'hvpt'); add(v.sp, shown(p.b), 'hvpt'); }));
  // 4) 듣고 고르기: 들려주는 말 + 견줘 듣기(같은 목소리 · 한국어식)
  SZ.DRILL.forEach(q => { addSeq(drillSeq(q), 'drill'); SZ.drillWords(q).forEach(w => { if (SZ.entry(w)) add(q.sp, shown(w), 'drill'); }); if (q.kind === 'ko') { const e = SZ.entry(SZ.drillWord(q)); if (e && e.ko) add('ko', e.ko, 'drill'); } });
  // 5) 따라 말하기
  SZ.SENT.forEach((_, i) => addSeq(shSeq(i), 'shadow'));
  return out;
};
// 잴 줄의 정보 (tools/dialogue-lines.cjs가 measure-meta.json으로 씀): word = 낱말 하나(n 음절 수 · at 센 음절, 0부터) · ko = 한국어식(n 글자 수) · other = 문장 등
// s · sh 짝 낱말은 fric(s | sh)와 같은 목소리의 짝 줄 cpair — 측정 도구가 바람 소리의 무게중심(fc)을 재 sh 쪽이 낮은지 확인해요
window.__measureMeta = lines => {
  const byText = {}, fric = {};
  Object.values(SZ.DICT).forEach(e => { byText[SZV.spoken(e.w)] = e.key; });
  SZ.PAIRS.filter(p => p.kind === 'ssh').forEach(p => { fric[p.a] = ['s', p.b]; fric[p.b] = ['sh', p.a]; });
  return lines.map(l => {
    const o = { id: l.id, sp: l.sp, text: l.text };
    if (l.sp === 'ko') return Object.assign(o, { kind: 'ko', n: [...l.text].length });
    const k = byText[l.text];
    if (!k) return Object.assign(o, { kind: 'other' });
    Object.assign(o, { kind: 'word', key: k, n: SZ.nSyl(k), at: SZ.stressAt(k) });
    if (fric[k]) Object.assign(o, { fric: fric[k][0], cpair: SZV.lineId(l.sp, SZV.spoken(shown(fric[k][1]))) });
    return o;
  });
};
hvInit();
mpInit();
shInit();
PDrill($('drillRoot'), SZ.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! s · sh, z · j, y 소리가 귀에 들어오네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보고, 같은 목소리로 견줘 들어 보세요.' : '처음에는 누구나 헷갈려요. 놀이터의 듣고 가르기 훈련으로 여러 목소리를 더 들어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '혀가 할 일 — 앞인지 조금 뒤인지, 닿는지 띄우는지, 목이 울리는지 — 을 모두 알았네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(SZS.baseText()).then(() => { dirty = true; });
setTimeout(() => SZS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
