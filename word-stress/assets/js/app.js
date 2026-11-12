/* 센 음절은 하나 — 낱말 강세와 슈와: 플레이어, 직접 해 보기, 강세 공 놓기, 내 발음 확인, 따라 말하기, 듣고 고르기, 퀴즈, 영상 추출
 * 음절 · 센 음절 · 슈와는 grammar.js(WS), 그림은 scenes.js(WSS)와 공통 부품 EN.mouth, 목소리와 잰 값은 voices.js(WSV)가 맡습니다.
 * 소리가 겹치지 않게: 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(WSV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const WS = window.WS, WSS = window.WSS, WSV = window.WSV, S = WSS.S, M = EN.mouth;
const { CHAPTERS, CAPTIONS, END, POSTER } = WSS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L3 = 'ABC';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const cv = $('cv'), ctx = cv.getContext('2d');
WS.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = WSS.fonts;
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
  const ready = new Promise(res => WSS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '센 음절은 하나 — 낱말 강세와 슈와 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { WSS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: WSS.iconSVG('mic'),
  rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="currentColor"/></svg>',
};
// 듣기 · 천천히 단추 묶음 (회화 영역의 듣기 연습 문제와 같은 모양 · 같은 키 R · S)
const lsnBar = () => WSV.supported
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
  const cap = started ? WSS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 낱말과 음절 공을 누르면 그 소리를 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = WSS.chapterAt(T);
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
  if (dirty) { dirty = false; WSS.render(ctx, started ? T : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
// 직접 해 보기에서 고르면: 영상을 멈추고 그 장의 u초 장면을 보여 줌
function showAt(u) {
  const ch = CHAPTERS[WSS.chapterAt(T)];
  if (playing) pause();
  T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}

/* =========================================================
   4. 소리 — 목소리 넷 + 한국어식으로 읽기 (voices.js). 읽기 전에 다른 소리는 모두 멈춤
   ========================================================= */
let audioEl = null;                       // 녹음 재생
function stopAudio() { if (audioEl) { try { audioEl.pause(); } catch (e) { /* 이미 멈춤 */ } audioEl = null; } document.querySelectorAll('.sh-play.saying').forEach(b => b.classList.remove('saying')); }
function stopSounds() { EN.say.stop(); WSV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return WSV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름. 같은 단추를 곧바로 다시 누르면 천천히
let lastLp = { b: null, at: 0 };
const lpBtn = (seq, label, cls = '', inner) => WSV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${inner || SVG_PLAY}</button>` : '';
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
// 낱말 열쇠 → 들려줄 글 (같은 철자의 명사 · 동사는 예문)
const wSeq = (k, sp = 'tc') => [{ text: WS.sayText(k), sp }];
const tSeq = (text, sp = 'tc') => [{ text, sp }];
const pairSeq = (a, b, sp = 'tc') => [{ text: WS.sayText(a), sp }, { text: WS.sayText(b), sp, gap: 0.7 }];
// 잰 값으로 센 음절을 확인한 목소리(measure.js에 있는 줄) — 확인한 목소리가 있으면 그 가운데서 골라요.
// 측정 도구가 끝내 통과시키지 못한 소리는 센 음절이 흐릿하게 들릴 수 있어서, 센 음절을 찾는 훈련에는 확인한 소리를 먼저 써요.
const okVoices = k => WS.VOICES.map(v => v.sp).filter(sp => !!WSV.meas(sp, WS.sayText(k)));
const voicesFor = k => { const ok = okVoices(k); return ok.length ? ok : WS.VOICES.map(v => v.sp); };
const WHO = { tc: '밝은 선생님', tf: '차분한 선생님', uf: '미국 여성', um: '미국 남성', ko: '한국어식' };

/* =========================================================
   5. 글 칠하기 — 센 음절(mk-str 보라 · 굵게 · 밑줄), 슈와(mk-weak 민트), 한국어식 표기(mk-trap 주황)
   ========================================================= */
function wordHTML(k, o = {}) {
  const e = WS.entry(k); if (!e) return `<span lang="en">${esc(k)}</span>`;
  const parts = e.spell.map((s, i) => {
    const sy = e.syl[i], st = sy.st === 1, weak = !st && sy.schwa && o.weak !== false;
    const t = o.caps ? (st ? s.toUpperCase() : i === 0 && /^[A-Z]/.test(e.w) ? s : s.toLowerCase()) : s;
    return st ? `<mark class="mk-str">${esc(t)}</mark>` : weak ? `<mark class="mk-weak">${esc(t)}</mark>` : esc(t);
  });
  return `<span lang="en">${parts.join(o.dots ? '<i class="dot">·</i>' : '')}</span>`;
}
const koHTML = k => { const e = WS.entry(k); return e && e.ko ? `<mark class="mk-trap">${esc(e.ko)}</mark>` : ''; };
function sentHTML(text, keys) {
  return '<span lang="en">' + WS.segs(text, keys).map(s => s.role === 'str' ? `<mark class="mk-str">${esc(s.t)}</mark>` : s.role === 'weak' ? `<mark class="mk-weak">${esc(s.t)}</mark>` : esc(s.t)).join('') + '</span>';
}
// 낱말 단추: 누르면 들려줌(곧바로 다시 누르면 천천히)
const wBtn = (k, sp = 'tc', o = {}) => WSV.supported
  ? `<button type="button" class="wbtn${o.cls ? ' ' + o.cls : ''}" data-lp="${seqId(wSeq(k, sp))}" title="듣기: ${esc(WS.sayText(k))}${sp !== 'tc' ? ' · ' + WHO[sp] : ''}">${SVG_PLAY}${o.html || wordHTML(k, o)}</button>`
  : `<span class="wbtn off">${o.html || wordHTML(k, o)}</span>`;
const koBtn = (text, label) => WSV.supported ? `<button type="button" class="wbtn ko" data-lp="${seqId([{ text, sp: 'ko' }])}" title="한국어식으로 듣기: ${esc(text)}">${SVG_PLAY}${label || `<mark class="mk-trap">${esc(text)}</mark>`}</button>` : `<span class="wbtn off ko">${label || esc(text)}</span>`;
const sposTag = k => `<span class="ptag p-${WS.sposOf(k)}">${esc(WS.ordSyl(WS.stressAt(k), WS.nSyl(k)))}</span>`;
// 음절 공 (SVG): 잰 값이 있으면 그 목소리를 잰 대로(WSS.ballData), 없으면 엔진의 기본 모양
function ballSVG(k, o = {}) {
  const R = o.R || 17, d = WSS.ballData(k, o), n = d.b.length, hpx = R * 0.13;
  const labels = o.ko ? [...o.ko] : WS.entry(k).spell, syl = o.ko ? null : WS.syls(k);
  const step = Math.max(2 * R + 10, ...labels.map(l => l.length * R * 0.62 + 14));
  const Wd = Math.round(step * (n - 1) + 2 * R + 12), cy0 = Math.round(R * 2.3 + 4), Hh = Math.round(cy0 + R + 24);
  let s = '';
  d.b.forEach((v, i) => {
    const r = WSS.ballR(v, R), cx = 6 + R + i * step, cy = cy0 - clamp(v.H, -2, 9) * hpx;
    const role = o.ko ? 'ko' : syl[i].st === 1 ? 'str' : syl[i].schwa ? 'weak' : 'plain';
    s += `<circle class="bl ${role}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/>`;
    if (o.pick === i) s += `<circle class="bl-pick" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r + 5).toFixed(1)}"/>`;
    const t = o.ko ? labels[i] : role === 'str' ? labels[i].toUpperCase() : labels[i].toLowerCase();
    s += `<text class="bl-t ${role}" x="${cx.toFixed(1)}" y="${cy0 + R + 17}" text-anchor="middle">${esc(t)}</text>`;
  });
  const lab = o.ko ? `${o.ko} 음절 공 — 한국어식으로 고르게` : `${WS.word(k)} 음절 공 — ${WS.caps(k)}, ${WS.ordSyl(WS.stressAt(k), n)}이 세요${d.measured ? ' (이 목소리를 잰 값)' : ''}`;
  return `<svg class="balls" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="${esc(lab)}">${s}</svg>`;
}

/* =========================================================
   6. 듣고 고르기 (이 튜토리얼 전용, 회화 영역의 듣기 연습 문제와 같은 .edr 모양) — 소리 먼저, 글은 답한 뒤
   키보드: A · B · C 또는 1 · 2 · 3 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · Enter/→ 다음
   ========================================================= */
const KIND_KO = { stress: '센 음절은 어디?', pair: '어느 낱말?', count: '몇 음절?', sent: '문장 속 어느 숫자?' };
const SIT = { stress: '낱말 하나를 들려줘요. 센 음절(가장 길고 높게 들리는 음절)은 어디인가요?', pair: '낱말 하나를 들려줘요. 어느 낱말인가요?', count: '낱말 하나를 들려줘요. 몇 음절인가요?', sent: '문장을 들려줘요. 빈칸에 들어간 숫자는?' };
const drillSeq = q => tSeq(q.say, q.sp);
function PDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0 }));
  let cur = 0, retry = null, mode = null;
  const hear = WSV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && WSV.busy()) { WSV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(drillSeq(it), { slow: !!slow, onitem() { say(`${WHO[it.sp]} · 말하는 중`); }, onend(stopped) { mode = null; paintPlay(root, null); say(stopped ? '' : '다 들었어요. 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { WSV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; WSV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    WSV.stop();
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
    if (it.kind === 'stress') {
      const n = WS.nSyl(it.w), at = WS.stressAt(it.w);
      return it.opts.map((op, k) => k === at ? `${op} → ${WS.ordSyl(k, n)}이 세요. ${WS.ipa(it.w)} · ${WS.entry(it.w).gloss}` : `${op} → ${WS.ordSyl(k, n)}을 세게 읽은 것. 이 낱말은 ${WS.ordSyl(at, n)}이 세요.`);
    }
    if (it.kind === 'count') {
      const n = WS.nSyl(it.say), m = WS.koSyl(it.say), e = WS.entry(it.say);
      return it.opts.map((op, k) => k === it.a ? `${WS.dotted(it.say)} → ${n}음절이에요. ${WS.ipaDots(it.say)}` : `${op}이 아니에요 — ${n}음절이에요.${m && m !== n ? ` 한국어 표기 ${e.ko} → ${m}음절이라 헷갈리기 쉬워요.` : ''}`);
    }
    return it.opts.map(w => `${WS.word(w)} ${WS.ipa(w)} — ${WS.entry(w).gloss}. ${WS.ordSyl(WS.stressAt(w), WS.nSyl(w))}이 세요.`);
  }
  function optLab(it, op) {
    if (it.kind === 'stress') return `<span class="ldr-t" lang="en">${esc(op)}</span>`;
    if (it.kind === 'count') return `<span class="ldr-t">${esc(op)}</span>`;
    return `<span class="ldr-t">${wordHTML(op, { caps: false })}</span><small>${esc(WS.entry(op).gloss)}</small>`;
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = WS.hints(it);
    const o = order(), pos = o.indexOf(cur), reveal = done || !hear, n = it.opts.length;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${WSS.iconSVG('ear', 'pi')}${esc(KIND_KO[it.kind])}</span><span>${retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span><span class="edr-tag">${esc(WHO[it.sp])}</span></p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(SIT[it.kind])}</p>`;
    h += lsnBar();
    if (it.kind === 'sent') h += `<p class="ldr-q"><span class="ldr-t" lang="en">${reveal ? sentHTML(it.say) : esc(it.frame)}</span>${done && it.ko ? `<small>${esc(it.ko)}</small>` : ''}</p>`;
    else if (reveal && it.kind !== 'pair') h += `<p class="ldr-q"><span class="ldr-t">${wordHTML(WS.drillWord(it), { caps: true, dots: it.kind === 'count' })}</span>${done ? `<small>${esc(WS.entry(WS.drillWord(it)).gloss)}</small>` : ''}</p>`;
    else if (reveal) h += `<p class="ldr-q"><span class="ldr-t">${wordHTML(it.say, { caps: true })}</span></p>`;
    h += `<div class="ldr-opts ${n === 3 ? 'three' : 'two'}" role="group" aria-label="보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
      return `<div class="ldr-row${cls}" data-k="${k}"><button type="button" class="ldr-opt big" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L3[k]})</b> ${optLab(it, op)}</button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: ${L3.slice(0, n).split('').join(' · ')} 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L3[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L3[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const ws = WS.drillWords(it).filter((w, i, a) => a.indexOf(w) === i && WS.entry(w));
      h += `<div class="ldr-cmp"><span>${ws.length > 1 ? '같은 목소리로 견줘 듣기' : '음절 공 · 이 목소리를 잰 값'}</span>${ws.map(w => `<span class="cmp-w">${wBtn(w, it.sp, { caps: true })}${ballSVG(w, { sp: it.sp, R: 14 })}</span>`).join('')}${ws.length === 2 ? lpBtn(pairSeq(ws[0], ws[1], it.sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서</span>`) : ''}${it.kind === 'count' && WS.entry(it.say).ko ? koBtn(WS.entry(it.say).ko) : ''}</div>`;
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
const LAB = { lq: null, lqPick: null, lqScore: [0, 0] };
const LQ_WORDS = ['banana', 'hotel', 'vitamin', 'computer', 'guitar', 'idea', 'internet', 'energy', 'tomato', 'violin'];
const KO_ROWS = ['banana', 'hotel', 'vitamin', 'chocolate'];
const wordPick = (list, cur, attr, o = {}) => `<div class="wrow sel">${list.map(k => `<button type="button" class="pickw${cur === k ? ' on' : ''}" data-${attr}="${esc(k)}" aria-pressed="${cur === k}">${o.ko ? koHTML(k) : wordHTML(k, { caps: o.caps })}</button>`).join('')}</div>`;
// 한국어식 · 영어 공을 나란히
const koEnBalls = k => `<div class="cmpballs"><div class="cb ko"><span>한국어식</span>${koBtn(WS.entry(k).ko)}${ballSVG(k, { ko: WS.entry(k).ko })}</div><span class="arr">→</span><div class="cb en"><span>영어</span>${wBtn(k, 'tc', { caps: true })}${ballSVG(k)}</div></div>`;
const pairOpts = (cur, attr, list) => `<select class="lab-sel" data-sel="${attr}" aria-label="짝 고르기"><option value="">영상대로</option>${['word', 'num', 'pos'].filter(kd => (list || WS.PAIRS).some(p => p.kind === kd)).map(kd => `<optgroup label="${esc(WS.PAIR_KIND[kd])}">${(list || WS.PAIRS).filter(p => p.kind === kd).map(p => `<option value="${p.id}"${cur === p.id ? ' selected' : ''}>${esc(WS.word(p.a))} · ${esc(WS.word(p.b))}${kd === 'pos' ? ' (명사 · 동사)' : ''}</option>`).join('')}</optgroup>`).join('')}</select>`;
function pairPanel(p) {
  const side = (k, cls, head) => `<div class="pb ${cls}"><span class="pb-h">${head}</span>${wBtn(k, 'tc', { caps: true })}<small>${esc(WS.ipa(k))} · ${esc(WS.entry(k).gloss)}</small>${WS.entry(k).homo ? `<small class="ex" lang="en">${sentHTML(WS.HOMO_SENT[k][0], { [WS.word(k).toLowerCase()]: k })}</small>` : ballSVG(k)}</div>`;
  return `<div class="pairbox">${side(p.a, 'a', '앞이 세요')}${side(p.b, 'b', '뒤가 세요')}</div>
    ${p.kind === 'pos' ? '<p class="note">같은 철자라 낱말만으로는 소리를 정해 들려줄 수 없어요. 예문으로 들어요.</p>' : ''}
    <div class="voices4"><span>목소리 넷으로 짝 듣기</span>${WS.VOICES.map(v => lpBtn(pairSeq(p.a, p.b, v.sp), `${v.ko}: ${WS.word(p.a)} · ${WS.word(p.b)}`, 'lp-voice', `${ICO.play}<span>${esc(v.ko)}</span>`)).join('')}</div>`;
}
const LABS = {
  intro() {
    return labHead('먼저 들어 보기') + `<p>한국어 바나나, 영어 banana — 둘 다 눌러 들어 보세요. 공은 음절 하나예요 — 크기와 높이는 실제 소리를 재서 그렸어요.</p>
      ${koEnBalls('banana')}
      <p class="note">같은 단추를 곧바로 다시 누르면 천천히 들려줘요. 영어 쪽은 공 하나만 크고 높아요.</p>`;
  },
  listen() {
    const q = LAB.lq, sc = LAB.lqScore;
    let h = labHead('센 음절 찾기 (맛보기)') + '<p>낱말 하나를 무작위 목소리로 들려줘요. 가장 길고 높게 들린 음절을 고르세요. 본격적인 연습은 아래 <a href="#playground">강세 공 놓기</a>에서 해요.</p>';
    if (!q) return h + `<div class="acts"><button type="button" class="btn" id="lqNew">${ICO.play} 하나 들려주기</button></div>`;
    const e = WS.entry(q.k), at = WS.stressAt(q.k), done = LAB.lqPick != null;
    h += `<div class="lq" data-slow="0"><p class="note">${esc(WHO[q.sp])}의 목소리 · ${lpBtn(wSeq(q.k, q.sp), '다시 듣기', 'lp-voice', `${ICO.play}<span>다시 듣기</span>`)}</p><div class="wrow syls">${e.spell.map((s, i) => `<button type="button" class="pickw syl${done ? (i === at ? ' right' : i === LAB.lqPick ? ' wrong' : '') : ''}" data-lq="${i}"${done ? ' disabled' : ''} lang="en">${esc(s.toLowerCase())}</button>`).join('<i class="dot">·</i>')}</div>`;
    if (done) h += `<p class="verdict"><b class="${LAB.lqPick === at ? 'c-ok' : 'c-no'}">${LAB.lqPick === at ? '맞아요' : '아쉬워요'}</b>${wordHTML(q.k, { caps: true, dots: true })} → ${esc(WS.ordSyl(at, e.syl.length))}이 세요 · ${sc[0]} / ${sc[1]}</p><div class="cmpballs one">${ballSVG(q.k, { sp: q.sp, pick: LAB.lqPick })}</div><div class="acts"><button type="button" class="btn" id="lqNew">${ICO.play} 하나 더</button></div>`;
    return h + '</div>';
  },
  korean() {
    const k = S.kword;
    let h = labHead('한국어식 · 영어 견주기') + row('낱말', wordPick(KO_ROWS, k, 'kw', { ko: true }));
    if (!k) return h + '<p class="note">외래어를 고르면 영상이 멈추고 그 줄을 표시해요. 한국어식 공과 영어 공을 나란히 견줘 보세요.</p>';
    return h + koEnBalls(k) + `<p class="note">${esc(WS.loanNote(k))}.</p>` + clearBtn;
  },
  strong() {
    const k = S.sword;
    let h = labHead('센 음절의 신호 보기') + row('낱말', wordPick(WSS.STRONG_WORDS, k, 'sw', { caps: true })) +
      row('신호', seg('신호 고르기', [['', '모두']].concat(WSS.CUES.map(c => [c[0], c[1]])), S.cue || '', 'cue'));
    const cue = S.cue && WSS.CUES.find(c => c[0] === S.cue);
    h += `<p class="note">${cue ? `${esc(cue[1])} → ${esc(cue[2])}. ${S.cue === 'long' ? '영상의 칸 너비(밀리초)를 보세요 — 센 음절의 칸이 가장 넓어요.' : S.cue === 'loud' ? '아래 회색 띠가 소리의 크기예요.' : S.cue === 'pitch' ? '노란 선이 소리의 높낮이예요. 센 음절에서 올라갔다 내려와요.' : '센 음절의 모음은 줄이지 않고 제 소리를 내요. 약한 음절의 모음은 흔히 슈와(ə)가 돼요.'}` : '낱말을 고르면 영상이 멈추고 그 낱말의 높낮이 선과 크기 띠를 보여 줘요. 신호를 고르면 그 신호에 표시가 생겨요.'}</p>`;
    if (k) h += `<div class="cmpballs one">${wBtn(k, 'tc', { caps: true })}${ballSVG(k)}</div>`;
    return h + (k || S.cue ? clearBtn : '');
  },
  schwa() {
    const k = S.sex;
    let h = labHead('슈와가 들어 있는 낱말') + row('낱말', wordPick(WS.SCHWA_EX, k, 'sx'));
    if (!k) return h + '<p class="note">낱말을 고르면 영상이 멈추고 크게 보여 줘요. 민트 글자가 슈와(흐린 어)예요 — a · o · e · i · u 어느 글자든 슈와가 될 수 있어요.</p>';
    const L = WS.schwaLetters(k).map(x => WS.entry(k).spell[x.i]).join(' · ');
    return h + `<div class="cmpballs one">${wBtn(k)}${ballSVG(k)}</div><p class="note">${esc(WS.ipa(k))} · ${esc(WS.entry(k).gloss)} · 슈와 → ${esc(L)} · 센 음절 → ${esc(WS.entry(k).spell[WS.stressAt(k)])}</p>` + clearBtn;
  },
  pair() {
    const p = S.pair ? WS.PAIRS.find(x => x.id === S.pair) : null;
    return labHead('짝 고르기') + row('짝', pairOpts(S.pair, 'pair')) + (p ? pairPanel(p) + clearBtn : '<p class="note">짝을 고르면 영상이 멈추고 그 짝을 보여 줘요. 다른 낱말 넷 · 숫자 일곱 · 명사와 동사 넷이 있어요.</p>');
  },
  loan() {
    let h = labHead('외래어 하나씩') + row('낱말', wordPick(WS.LOAN.map(o => o.w), S.loan, 'ln', { ko: true }));
    const k = S.loan;
    if (!k) return h + '<p class="note">한국어식 표기를 고르면, 영어로 말할 때 음절 수와 센 음절을 보여 줘요.</p>';
    const row0 = WS.LROWS.find(r => r.words.indexOf(k) >= 0);
    return h + koEnBalls(k) + `<p class="note"><b>${esc(row0.ko)}</b> — ${esc(WS.loanNote(k))}.${row0.id === 'drop' ? ' 사전에 따라 음절을 하나 더 적기도 해요.' : ''}</p>` + clearBtn;
  },
  shift() {
    const f = S.fam ? WS.FAMS.find(x => x.id === S.fam) : null;
    let h = labHead('낱말 가족') + row('가족', seg('가족 고르기', [['', '영상대로']].concat(WS.FAMS.map(x => [x.id, x.words.map(w => WS.word(w)).join(' · ')])), S.fam || '', 'fam'));
    if (!f) return h + '<p class="note">가족을 고르면 영상이 멈추고 한 줄로 크게 보여 줘요.</p>';
    h += `<div class="famrow">${f.words.map(w => `<div class="fw">${wBtn(w, 'tc', { caps: true })}${ballSVG(w, { R: 14 })}${sposTag(w)}</div>`).join('<span class="arr">→</span>')}</div>`;
    const sh = WS.vowelShift(f.words[0], f.words[1]);
    if (sh.length) h += `<p class="note">같은 철자, 다른 모음 → ${sh.map(x => `<span lang="en">${esc(x.sp.toLowerCase())}</span> ${esc(x.va)} → ${esc(x.vb)}`).join(' · ')}</p>`;
    return h + clearBtn;
  },
  sentence() {
    const opts = WS.SGRP_ORDER.map(gk => `<optgroup label="${esc(WS.SGRP[gk].long)}">${WS.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk).map(([s, i]) => `<option value="${i}"${S.sent === i ? ' selected' : ''}>${esc(s.en)}</option>`).join('')}</optgroup>`).join('');
    let h = labHead('문장 고르기') + row('문장', `<select class="lab-sel" data-sel="sent" aria-label="문장 고르기"><option value="">영상대로</option>${opts}</select>`);
    if (S.sent == null) return h + '<p class="note">따라 말하기의 28문장 가운데 하나를 고르면 영상에 크게 보여 줘요.</p>';
    const s = WS.SENT[S.sent];
    return h + `<p class="enline">${lpBtn(tSeq(s.en), '듣기: ' + s.en)}${sentHTML(s.en, s.keys)}</p><p class="note">${esc(s.ko)} · ${WS.wordsIn(s.en, s.keys).map(k => wordHTML(k, { caps: true, dots: true })).join(' · ')}</p>` + clearBtn;
  },
  summary() {
    return labHead('이제 직접') + `<p>아래 <a href="#playground">강세 공 놓기</a>에서 목소리 넷으로 센 음절을 찾고, <a href="#mypron">내 발음 확인</a>에서 음성 인식이 내 말을 어느 낱말로 듣는지 확인해 보세요. <a href="#shadow">따라 말하기</a> 28문장과 <a href="#drill">듣고 고르기</a> 16문제도 있어요.</p>`;
  },
};
function buildLab(ci) {
  const id = CHAPTERS[ci].id;
  $('lab').innerHTML = (LABS[id] || (() => ''))();
}
const relab = () => buildLab(WSS.chapterAt(T));
function lqNew() {
  const words = LQ_WORDS.filter(w => !LAB.lq || w !== LAB.lq.k), vw = words.filter(w => okVoices(w).length);
  const k = pickOne(vw.length ? vw : words), sp = pickOne(voicesFor(k));
  LAB.lq = { k, sp }; LAB.lqPick = null;
  S.voice = sp; dirty = true;
  relab();
  speak(wSeq(k, sp));
}
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
  const d = b.dataset;
  if (b.id === 'lqNew') { lqNew(); return; }
  if (d.lq != null) { if (LAB.lqPick != null) return; LAB.lqPick = +d.lq; LAB.lqScore[1]++; if (+d.lq === WS.stressAt(LAB.lq.k)) LAB.lqScore[0]++; relab(); return; }
  if (b.id === 'labClear') { Object.assign(S, JSON.parse(WSS.DEFAULTS)); dirty = true; relab(); return; }
  if (d.kw != null) { S.kword = S.kword === d.kw ? null : d.kw; showAt(20); relab(); return; }
  if (d.sw != null) { S.sword = S.sword === d.sw ? null : d.sw; showAt(14); relab(); return; }
  if (d.cue != null) { S.cue = d.cue || null; showAt(14); relab(); return; }
  if (d.sx != null) { S.sex = S.sex === d.sx ? null : d.sx; showAt(15); relab(); return; }
  if (d.ln != null) { S.loan = S.loan === d.ln ? null : d.ln; showAt(33); relab(); return; }
  if (d.fam != null) { S.fam = d.fam || null; showAt(S.fam ? 8 : 1); relab(); return; }
});
$('lab').addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.sel) return;
  const v = t.value;
  if (t.dataset.sel === 'pair') { S.pair = v || null; showAt(v ? 8 : 1); }
  else if (t.dataset.sel === 'sent') { S.sent = v === '' ? null : +v; showAt(8); }
  relab();
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   한국어 속에 홀로 쓴 모음 글자(첫 a만 · 두 a는)는 글자 이름으로 읽어요. 영어 문장 속의 관사 a는 그대로
   ========================================================= */
const LETTER_KO = { a: '에이', e: '이', i: '아이', o: '오', u: '유' };
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/(^|[^A-Za-z'’])([aeiou])(?=\s*[가-힣]|[.,·]|$)/g, (m, a, c) => a + LETTER_KO[c]], [/\s\+\s/g, ', '], [/ = /g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
  enRate: WSV.EN_RATE,      // 영어 조각만 살짝 느리게 (voices.js의 EN_RATE — 낱말 소리와 같은 빠르기)
  clips: window.EN_CLIPS,   // 미리 만든 음성 파일(audio/narration/) — 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };
if (window.EN && EN.say) EN.say.rate = WSV.EN_RATE;   // 발음 듣기 단추도 같은 빠르기

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
   10. 놀이터 ① 강세 공 놓기 — 목소리 넷 × 낱말: 듣고 센 음절을 고르면 그 목소리를 잰 공이 나타남
   기록은 이 브라우저에만(localStorage 'en-ws-balls-v1'). 키보드: R 듣기 · 1~4 고르기 · Space/Enter 다음
   ========================================================= */
const HV_KEY = 'en-ws-balls-v1';
const HV_GRP = [['all', '모두'], ['loan', '외래어'], ['schwa', '약한 모음'], ['fam', '낱말 가족'], ['num', '숫자'], ['pair', '짝 낱말']];
const hvPool = grp => Object.values(WS.DICT).filter(e => !e.homo && e.syl.length >= 2 && (grp === 'all' || e.grp === grp)).map(e => e.key);
const HV = { grp: 'all', voice: 'all', cur: null, pick: null, stats: null, streak: 0, last: null };
const hvEmpty = () => ({ pos: { first: [0, 0], second: [0, 0], third: [0, 0] }, voice: { tc: [0, 0], tf: [0, 0], uf: [0, 0], um: [0, 0] } });
function hvLoad() { try { const s = JSON.parse(localStorage.getItem(HV_KEY) || 'null'); HV.stats = s && s.pos && s.voice ? s : hvEmpty(); } catch (e) { HV.stats = hvEmpty(); } }
function hvSave() { try { localStorage.setItem(HV_KEY, JSON.stringify(HV.stats)); } catch (e) { /* 저장하지 못해도 이번에는 계속 */ } }
function hvNew(auto) {
  let pool = hvPool(HV.grp).filter(k => k !== HV.last);
  const vp = pool.filter(k => HV.voice === 'all' ? okVoices(k).length : okVoices(k).includes(HV.voice));
  if (vp.length) pool = vp;
  const k = pickOne(pool), sp = HV.voice === 'all' ? pickOne(voicesFor(k)) : HV.voice;
  HV.cur = { k, sp }; HV.pick = null; HV.last = k;
  hvDraw();
  if (auto) hvPlay();
}
function hvPlay(slow) { if (!HV.cur) return; const b = $('hvPlayBtn'); if (b) b.classList.add('saying'); speak(wSeq(HV.cur.k, HV.cur.sp), { slow: !!slow, onend() { const x = $('hvPlayBtn'); if (x) x.classList.remove('saying'); } }); }
function hvAnswer(i) {
  const c = HV.cur; if (!c || HV.pick !== null || i >= WS.nSyl(c.k)) return;
  HV.pick = i;
  const ok = i === WS.stressAt(c.k), P = HV.stats.pos[WS.sposOf(c.k)], V = HV.stats.voice[c.sp];
  P[1]++; V[1]++; if (ok) { P[0]++; V[0]++; HV.streak++; } else HV.streak = 0;
  hvSave(); hvDraw();
  const nb = $('hvNext'); if (nb) nb.focus({ preventScroll: true });
}
const pct = ([ok, n]) => n ? Math.round(ok / n * 100) : null;
function hvDraw() {
  const c = HV.cur, box = $('hvMain');
  let h = '';
  if (!c) h = `<p class="hv-hello">목소리 넷 가운데 하나가 낱말 하나를 말해요. 가장 길고 높게 들린 음절을 고르면, 그 목소리를 실제로 잰 음절 공이 나타나요. 한국어처럼 고르게 들리던 낱말에서 공 하나가 커지기 시작하면 성공이에요.</p><div class="acts"><button type="button" class="btn" id="hvStart">${ICO.play} 시작하기</button></div>`;
  else {
    const e = WS.entry(c.k), at = WS.stressAt(c.k), done = HV.pick !== null, ok = done && HV.pick === at;
    h += `<div class="hv-top"><button type="button" class="btn hv-play" id="hvPlayBtn">${ICO.play} 듣기 <small>R</small></button><button type="button" class="btn ghost" id="hvSlow">${ICO.slow} 천천히</button><span class="hv-who">${esc(WHO[c.sp])} · ${e.syl.length}음절</span></div>`;
    h += `<div class="hv-opts syl n${e.syl.length}">${e.spell.map((s, i) => `<button type="button" class="hv-opt${done ? (i === at ? ' right' : i === HV.pick ? ' wrong' : ' off') : ''}" data-hv="${i}"${done ? ' disabled' : ''}><b>${i + 1}</b><span lang="en">${esc(done && i === at ? s.toUpperCase() : s.toLowerCase())}</span></button>`).join('')}</div>`;
    if (done) {
      h += `<p class="verdict"><b class="${ok ? 'c-ok' : 'c-no'}">${ok ? '맞아요' : '아쉬워요'}</b>${wordHTML(c.k, { caps: true, dots: true })} ${esc(WS.ipa(c.k))} · ${esc(e.gloss)} → ${esc(WS.ordSyl(at, e.syl.length))}이 세요${HV.streak > 1 ? ` · 연속 ${HV.streak}번!` : ''}</p>`;
      h += `<div class="cmpballs">${e.ko ? `<div class="cb ko"><span>한국어식</span>${koBtn(e.ko)}${ballSVG(c.k, { ko: e.ko, R: 15 })}</div><span class="arr">→</span>` : ''}<div class="cb en"><span>${esc(WHO[c.sp])}</span>${wBtn(c.k, c.sp, { caps: true })}${ballSVG(c.k, { sp: c.sp, pick: HV.pick })}</div></div>`;
      const pair = WS.pairOf(c.k);
      if (pair && pair.kind !== 'pos') h += `<div class="wrow"><span class="note">짝 낱말과 견주기</span>${wBtn(pair.a, c.sp, { caps: true })}${wBtn(pair.b, c.sp, { caps: true })}${lpBtn(pairSeq(pair.a, pair.b, c.sp), '이어서 듣기', 'lp-voice', `${ICO.play}<span>이어서</span>`)}</div>`;
      h += `<div class="acts"><button type="button" class="btn" id="hvNext">다음 <small>Space</small></button></div>`;
    }
  }
  box.innerHTML = h;
  const st = HV.stats, rows = WS.SPOS_ORDER.map(p => {
    const v = st.pos[p], q = pct(v);
    return `<tr><th scope="row">${esc(WS.SPOS[p].long)}</th><td>${v[0]} / ${v[1]}</td><td><span class="meter"><i style="width:${q == null ? 0 : q}%"></i></span>${q == null ? '–' : q + '%'}</td></tr>`;
  }).join('');
  const all = Object.values(st.pos).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
  $('hvStats').innerHTML = `<table class="hv-tab"><caption>센 음절의 자리마다 맞힌 비율 (이 브라우저에만 저장)</caption><tbody>${rows}<tr class="all"><th scope="row">모두</th><td>${all[0]} / ${all[1]}</td><td>${pct(all) == null ? '–' : pct(all) + '%'}</td></tr></tbody></table>
    <p class="note">목소리마다: ${WS.VOICES.map(v => `${esc(v.ko)} ${pct(st.voice[v.sp]) == null ? '–' : pct(st.voice[v.sp]) + '%'}`).join(' · ')}</p>`;
}
function hvInit() {
  hvLoad();
  $('hvCtl').innerHTML = row('낱말', seg('낱말 묶음 고르기', HV_GRP, HV.grp, 'hvg')) +
    row('목소리', seg('목소리 고르기', [['all', '넷 섞어서']].concat(WS.VOICES.map(v => [v.sp, v.ko])), HV.voice, 'hvv'));
  hvDraw();
  const root = $('hvpt');
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    const d = b.dataset;
    if (d.hvg) { HV.grp = d.hvg; root.querySelectorAll('[data-hvg]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hvNew(false); return; }
    if (d.hvv) { HV.voice = d.hvv; root.querySelectorAll('[data-hvv]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hvNew(false); return; }
    if (b.id === 'hvStart' || b.id === 'hvNext') { hvNew(true); return; }
    if (b.id === 'hvPlayBtn') { hvPlay(false); return; }
    if (b.id === 'hvSlow') { hvPlay(true); return; }
    if (d.hv != null) { hvAnswer(+d.hv); return; }
    if (b.id === 'hvReset') { HV.stats = hvEmpty(); HV.streak = 0; hvSave(); hvDraw(); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('select'))) return;
    const k = e.key.toUpperCase(), n = '12345'.indexOf(k);
    if (k === 'R') { e.preventDefault(); if (!HV.cur) hvNew(true); else hvPlay(false); }
    else if (n >= 0 && HV.cur && HV.pick === null) { e.preventDefault(); hvAnswer(n); }
    else if ((e.key === ' ' || e.key === 'Enter') && (HV.pick !== null || !HV.cur) && !(e.target.closest && e.target.closest('button:not(#hvNext):not(#hvStart)'))) { e.preventDefault(); hvNew(true); }
  });
}

/* =========================================================
   10. 놀이터 ② 내 발음 확인 — 음성 인식이 내 말을 어느 낱말로 들었나 · 녹음해서 본보기와 번갈아 듣기
   철자가 다른 짝만 써요(같은 철자의 명사 · 동사는 인식기가 같은 글로 적어서). 발음의 질은 판정하지 않아요(화면에 밝힘)
   ========================================================= */
const MP = { pair: WS.MP_PAIRS[0].id, side: 'a', url: null, res: null, busy: false };
const mpTarget = () => { const p = WS.MP_PAIRS.find(x => x.id === MP.pair); return { p, w: MP.side === 'a' ? p.a : p.b, other: MP.side === 'a' ? p.b : p.a }; };
function mpDraw() {
  const { p, w, other } = mpTarget();
  let h = `<div class="mp-ctl">${row('짝', pairOpts(MP.pair, 'mp', WS.MP_PAIRS).replace('<option value="">영상대로</option>', '').replace('data-sel="mp"', 'id="mpSel"'))}${row('말할 낱말', seg('말할 낱말', [['a', `${esc(WS.word(p.a))} · 앞이 세요`], ['b', `${esc(WS.word(p.b))} · 뒤가 세요`]], MP.side, 'mpside'))}</div>`;
  h += `<div class="mp-body"><div class="mp-fig">${ballSVG(w, { R: 24 })}<small>${esc(WS.word(w))} · 밝은 선생님을 잰 음절 공</small></div>
    <div class="mp-word"><p class="mp-big">${wordHTML(w, { caps: true, dots: true })}</p><p class="note">${esc(WS.ipa(w))} · ${esc(WS.entry(w).gloss)} · 짝 → ${wordHTML(other, { caps: true })}</p>
    <p class="note">${sposTag(w)} ${MP.side === 'a' ? '앞 음절을 길고 높게, 끝 음절은 짧게 내려요.' : '끝 음절을 길고 높게 끌어요. 앞 음절은 짧고 가볍게.'}</p>
    <div class="wrow">${wBtn(w, 'tc', { caps: true })}${wBtn(other, 'tc', { caps: true })}</div></div></div>`;
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
    h += `<p class="verdict"><b class="${cls}">${esc(WS.HEARD_KO[r.verdict])}</b>${r.verdict === 'partner' ? `받아 적은 말 → 짝 낱말 ${esc(WS.word(r.partner))}. ${MP.side === 'a' ? '앞 음절을 더 길고 높게, 끝은 짧게 내려' : '끝 음절을 더 길고 높게 끌어'} 다시 해 보세요.` : r.verdict === 'target' ? '인식기가 목표 낱말로 받아 적었어요.' : r.verdict === 'maybe' ? `목표 낱말 → ${r.rank}번째 후보. 센 음절을 조금 더 또렷하게 해 보세요.` : r.verdict === 'other' ? '목표 낱말도 짝 낱말도 아닌 말로 받아 적었어요. 낱말 하나만 또박또박 말해 보세요.' : ''}</p>`;
    if (r.alts && r.alts.length) h += `<p class="note">인식 후보: ${r.alts.map((a, i) => `<span class="alt${i === 0 ? ' top' : ''}" lang="en">${esc(a)}</span>`).join(' · ')}</p>`;
  }
  if (MP.err) h += `<p class="sh-err">${esc(MP.err)}</p>`;
  if (MP.url) h += `<div class="mo"><button type="button" class="sh-play" id="mpMine">${ICO.play} 내 목소리</button>${WSV.supported ? `<button type="button" class="sh-play" id="mpModel">${ICO.play} 본보기</button><button type="button" class="sh-play" id="mpBoth">${ICO.play} 번갈아 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`;
  box.innerHTML = h;
}
function mpInit() {
  const root = $('mypron');
  mpDraw();
  root.addEventListener('change', e => { if (e.target.id === 'mpSel') { MP.pair = e.target.value; MP.res = null; MP.err = null; mpDraw(); } });
  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.dataset.mpside) { MP.side = b.dataset.mpside; MP.res = null; MP.err = null; mpDraw(); return; }
    const { w } = mpTarget();
    if (b.id === 'mpMic') {
      if (activeRec) { stopListening(); return; }
      MP.err = null; MP.res = null; mpResult();
      listenOnce({ alts: 5,
        onState(on) { const x = $('mpMic'); if (x) { x.setAttribute('aria-pressed', String(on)); x.classList.toggle('on', on); x.querySelector('span').textContent = on ? '듣고 있어요…' : '말하고 인식 결과 보기'; } },
        onText(alts) { MP.res = Object.assign(WS.heard(w, alts), { alts }); mpResult(); },
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
        if (url) playUrl(url, $('mpMine'), () => { if (WSV.supported) speak(wSeq(w)); });
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
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 숫자를 숫자로 받아 적어도(15) 맞은 것으로 쳐요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = WS.SGRP_ORDER.map(gk => ({ gk, rows: WS.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk) }));
  $('shList').innerHTML = groups.map(({ gk, rows }) => `<section class="sh-grp"><h3><span class="ptag g-${gk}">${esc(WS.SGRP[gk].ko)}</span> ${esc(WS.SGRP[gk].long.split(' — ')[1] || '')}</h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${WSV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-en">${sentHTML(s.en, s.keys)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { return tSeq(WS.SENT[i].en); }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = WS.SENT[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, WS.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${WSV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
    shPlayMine(i, true);
  };
  SHREC.rec = mr; mr.start(); shMicState(i, true);
  shResult(i, '<span class="note">녹음 중이에요. 다 말했으면 ‘멈추기’를 눌러요(6초가 지나면 저절로 멈춰요).</span>');
  SHREC.tm = setTimeout(() => { if (SHREC.rec === mr) { SHREC.rec = null; try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 6000);
}
function shPlayMine(i, thenOrig) {
  const b = document.querySelector(`.sh-row[data-i="${i}"] [data-mine]`);
  playUrl(SHREC.url[i], b, thenOrig && WSV.supported ? () => speak(shSeq(i)) : null);
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
   12. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 그림 문제는 음절 공 · EN.mouth로 그림
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
// 입 그림 넷 (A~D)
const mouthFig = (label, poses) => panelFig(label, 4, (g, k, x) => M.draw(g, x + 2, 40, 0.34, poses[k], { mark: '#7FE0A8', gap: false }));
// 음절 공 무늬 넷 (A~D): 공마다 1 = 센 음절, 0 = 약한 음절, 0.6 = 고르게
function ballFig(label, pats, text) {
  return panelFig(label, pats.length, (g, k, x, w) => {
    const p = pats[k], n = p.length, step = Math.min(44, (w - 30) / n), x0 = x + w / 2 - step * (n - 1) / 2;
    p.forEach((v, i) => {
      const r = v === 1 ? 19 : v === 0 ? 9 : 14, cy = 112 - (v === 1 ? 14 : v === 0 ? 0 : 6);
      const c = v === 1 ? '#C9A7FF' : v === 0 ? '#7FE0A8' : '#FF9F7A';
      g.beginPath(); g.arc(x0 + i * step, cy, r, 0, Math.PI * 2); g.fillStyle = v === 0 ? 'rgba(127,224,168,0.3)' : c; g.globalAlpha = v === 0 ? 1 : 0.85; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = c; g.lineWidth = 2; g.stroke();
    });
    if (text) { g.font = qfont(14, 600); g.fillStyle = QCOL.muted; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text[k], x + w / 2, 168); }
  });
}
const QS = (() => {
  const at = k => WS.stressAt(k);
  const SCH = WS.schematic('banana');
  const q = [
    { q: '한국어 바나나 · 영어 banana — 가장 큰 차이는?', opts: ['영어는 음절 하나만 길고 크고 높아요', '영어는 음절이 더 많아요', '한국어는 끝을 올려요', '차이가 없어요'], a: 0,
      why: '둘 다 세 음절이에요. 한국어는 세 음절을 고르게 말하고, 영어는 둘째 음절 하나만 길고 크고 높게 말해요. 나머지 둘은 짧은 슈와예요.',
      check: () => WS.nSyl('banana') === 3 && WS.koSyl('banana') === 3 && at('banana') === 1 },
    { q: 'hotel → 음절 공으로 그리면? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: ballFig('음절 공 무늬 넷. A 큰 공 하나 작은 공 하나, B 작은 공 하나 큰 공 하나, C 같은 크기 둘, D 작은 공 큰 공 작은 공', [[1, 0], [0, 1], [0.6, 0.6], [0, 1, 0]], ['앞이 큼', '뒤가 큼', '고르게', '가운데가 큼']),
      why: 'B → hotel = 두 음절, 뒤 음절이 세요(ho·TEL). 한국어식 호텔처럼 고르게(C) 말하거나 앞을 세게(A) 말하지 않아요.',
      check: () => WS.pattern('hotel') === 'oO' },
    { q: '센 음절을 만드는 신호가 아닌 것은?', opts: ['모음을 더 길게', '소리를 더 높게', '모음을 또렷하게', '자음을 두 번 소리 내기'], a: 3,
      why: '센 음절은 길게 · 크게 · 높게, 그리고 모음을 줄이지 않고 또렷하게 내요. 자음을 두 번 내는 것은 신호가 아니에요.',
      check: () => SCH[1].L === 1 && SCH[1].H > SCH[0].H && SCH[1].A > SCH[0].A },
    { q: 'about · today · pencil · support → 약한 음절은 모두 같은 흐린 어(슈와)예요. 슈와를 적는 글자는?', opts: ['a뿐이에요', 'e뿐이에요', 'o뿐이에요', '어느 모음 글자든 될 수 있어요'], a: 3,
      why: 'about → a, today → o, pencil → i, support → u. 철자는 달라도 모두 슈와예요. 슈와는 철자가 아니라 약한 음절이라서 생겨요.',
      check: () => new Set(['about', 'today', 'pencil', 'support'].map(k => { const L = WS.schwaLetters(k)[0], e = WS.entry(k); return e.spell[L.i][L.at[0]].toLowerCase(); })).size === 4 },
    { q: '슈와(흐린 어)를 낼 때의 입 모양은? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: mouthFig('입 옆 단면도 넷. A 혀가 높고 입이 좁은 이, B 입을 크게 벌린 아, C 입을 조금 벌리고 혀를 가운데에 둔 슈와, D 입술을 둥글게 내민 우', ['i', 'a', 'schwa', 'u']),
      why: 'C → 입은 조금만 벌리고, 혀와 입술에 힘을 빼 가운데에 둬요. A는 이, B는 아, D는 우예요.',
      check: () => { const j = p => M.pose(p).jaw; return j('schwa') > j('i') && j('schwa') < j('a'); } },
    { q: 'desert(사막)와 dessert(후식)를 가르는 것은?', opts: ['센 음절의 자리', '끝소리 t', '음절 수', '첫소리 d'], a: 0,
      why: '둘 다 두 음절이에요. 사막은 첫음절이(DESert), 후식은 둘째 음절이(desSERT) 세요. 센 음절이 바뀌면 그 모음의 소리도 달라져요.',
      check: () => WS.nSyl('desert') === WS.nSyl('dessert') && at('desert') === 0 && at('dessert') === 1 },
    { q: '13(thirteen)과 30(thirty)을 들을 때 가장 큰 열쇠는?', opts: ['첫소리 th', '끝 음절이 길고 높게 끌리는지', '음절 수', '첫 모음'], a: 1,
      why: '열셋은 끝 음절이 세서 길고 높게 끌고, 서른은 첫음절이 세고 끝이 짧게 내려가요. 음절 수와 첫소리는 같아요.',
      check: () => at('thirteen') === 1 && at('thirty') === 0 && WS.nSyl('thirteen') === WS.nSyl('thirty') },
    { q: '명사 record(기록)와 동사 record(녹음하다)에 대해 맞는 것은?', opts: ['명사는 둘째 음절, 동사는 첫음절이 세요', '둘은 소리가 같아요', '명사는 첫음절, 동사는 둘째 음절이 세요', '동사만 세 음절이에요'], a: 2,
      why: '두 음절 짝은 흔히 명사는 앞이, 동사는 뒤가 세요 → She broke the world RECord. · Can I reCORD your answer?',
      check: () => at('record:n') === 0 && at('record:v') === 1 },
    { q: '외래어 아이디어를 영어로(idea) 말할 때 맞는 것은?', opts: ['네 음절을 고르게', '세 음절, 둘째 음절이 세요', '두 음절, 첫음절이 세요', '세 음절, 첫음절이 세요'], a: 1,
      why: '한국어 표기 아이디어는 네 음절이지만 영어 idea = 세 음절(i·DE·a), 둘째 음절이 세요.',
      check: () => WS.koSyl('idea') === 4 && WS.nSyl('idea') === 3 && at('idea') === 1 },
    { q: 'photograph → photographer → photographic, 센 음절은 어떻게 옮겨 가나요?', opts: ['첫째 → 둘째 → 셋째', '첫째 → 첫째 → 첫째', '둘째 → 둘째 → 셋째', '셋째 → 둘째 → 첫째'], a: 0,
      why: 'PHOtograph → phoTOgrapher → photoGRAPHic. 끝이 붙으면 센 음절이 옮겨 가고, 모음도 함께 바뀌어요.',
      check: () => ['photograph', 'photographer', 'photographic'].map(at).join() === '0,1,2' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[낱말 강세] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[낱말 강세] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { WSV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = WSS.chapterAt(T);
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
// 화면 누르기: 낱말 · 공 · 한글 표기는 그 목소리로, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * WSS.W, (e.clientY - r.top) / r.height * WSS.H]; };
const hitAt = (x, y) => started ? WSS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
let lastHit = { k: '', at: 0 };
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.play && WSV.supported) {
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
EN.say.wire(document, { before() { WSV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = ' ' + WSV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 영상의 낱말 · 공 · 한글 표기 · 목소리 단추, 직접 해 보기(고르는 것은 하나씩), 강세 공 놓기(낱말 × 목소리 넷), 내 발음 확인, 듣고 고르기, 따라 말하기
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text) return;
    const id = WSV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: WSV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(WSS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 누를 수 있는 낱말 · 공 · 한글 표기 · 목소리 단추. 직접 해 보기로 바뀌는 장면도 하나씩
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t, ch.t + ch.d]; };
    const sweeps = [[{}, [0, END]]]
      .concat(WSS.STRONG_WORDS.map(k => [{ sword: k }, span('strong')]), WS.SCHWA_EX.map(k => [{ sex: k }, span('schwa')]))
      .concat(WS.PAIRS.map(p => [{ pair: p.id }, span('pair')]), WS.FAMS.map(f => [{ fam: f.id }, span('shift')]), WS.SENT.map((_, i) => [{ sent: i }, span('sentence')]));
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.5) { WSS.render(g, t); WSS.hits().forEach(h => addSeq(h.play, 'video')); }
    });
    // 2) 직접 해 보기: 장마다 + 고르는 것은 하나씩
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* */ } });
    KO_ROWS.forEach(k => { S.kword = k; LABS.korean(); });
    WSS.STRONG_WORDS.forEach(k => { S.sword = k; LABS.strong(); });
    WS.SCHWA_EX.forEach(k => { S.sex = k; LABS.schwa(); });
    WS.PAIRS.forEach(p => { S.pair = p.id; LABS.pair(); });
    WS.LOAN.forEach(o => { S.loan = o.w; LABS.loan(); });
    WS.FAMS.forEach(f => { S.fam = f.id; LABS.shift(); });
    WS.SENT.forEach((_, i) => { S.sent = i; LABS.sentence(); });
    LQ_WORDS.forEach(k => WS.VOICES.forEach(v => { LAB.lq = { k, sp: v.sp }; LAB.lqPick = 0; LABS.listen(); }));
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 강세 공 놓기: 낱말 × 목소리 넷 + 한국어식 표기 · 짝 낱말 / 내 발음 확인: 짝 낱말(밝은 선생님)
  hvPool('all').forEach(k => { WS.VOICES.forEach(v => add(v.sp, WS.sayText(k), 'hvpt')); const e = WS.entry(k); if (e.ko) add('ko', e.ko, 'hvpt'); });
  WS.MP_PAIRS.forEach(p => { add('tc', WS.sayText(p.a), 'mypron'); add('tc', WS.sayText(p.b), 'mypron'); });
  // 4) 듣고 고르기: 들려주는 말 + 견줘 듣기(같은 목소리)
  WS.DRILL.forEach(q => { addSeq(drillSeq(q), 'drill'); WS.drillWords(q).forEach(w => { if (WS.entry(w)) add(q.sp, WS.sayText(w), 'drill'); }); const e = q.kind === 'count' && WS.entry(q.say); if (e && e.ko) add('ko', e.ko, 'drill'); });
  // 5) 따라 말하기
  WS.SENT.forEach((_, i) => addSeq(shSeq(i), 'shadow'));
  return out;
};
// 도구용(읽기만): 잴 줄의 정보 — tools/dialogue-lines.cjs가 audio/dialogue/measure-meta.json으로 씀 → tools/measure-syllables.py
// 낱말 하나(word: 음절 수 n · 센 음절 at) · 한국어식(ko: 글자 수 = 음절 수) · 그 밖의 문장(other: 받아쓰기만)
window.__measureMeta = lines => {
  const byText = {};
  Object.values(WS.DICT).forEach(e => { if (!e.homo) byText[WSV.spoken(WS.sayText(e.key))] = e.key; });
  return lines.map(l => {
    const o = { id: l.id, sp: l.sp, text: l.text };
    if (l.sp === 'ko') return Object.assign(o, { kind: 'ko', n: [...l.text].length });
    const k = byText[l.text];
    return k ? Object.assign(o, { kind: 'word', key: k, n: WS.nSyl(k), at: WS.stressAt(k) }) : Object.assign(o, { kind: 'other' });
  });
};
hvInit();
mpInit();
shInit();
PDrill($('drillRoot'), WS.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 센 음절의 자리, 음절 수, 강세로 갈리는 짝이 귀에 들어오네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보고, 같은 목소리로 견줘 들어 보세요.' : '처음에는 누구나 헷갈려요. 놀이터의 강세 공 놓기로 여러 목소리를 더 들어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '센 음절은 하나, 약한 음절은 슈와 — 모두 알았네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(WSS.baseText()).then(() => { dirty = true; });
setTimeout(() => WSS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
