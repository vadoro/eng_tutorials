/* 길 묻기 회화 — 플레이어, 직접 해 보기, 길 찾기 시뮬레이터, 따라 말하기, 듣고 대답 고르기, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(DR), 그림은 scenes.js(DRS), 목소리는 voices.js(DRV)가 맡습니다.
 * 소리가 겹치지 않게: 대화를 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(DRV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const DR = window.DR, DRS = window.DRS, DRV = window.DRV, S = DRS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = DRS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cv = $('cv'), ctx = cv.getContext('2d');
DR.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = DRS.fonts;
const FONT_SET = [[700, F.FD], [800, F.FD], [400, F.FB], [500, F.FB], [600, F.FB], [700, F.FB], [800, F.FB], [400, F.FM], [500, F.FM], [600, F.FM], [700, F.FM]];
const loadFonts = text => Promise.race([
  Promise.all(FONT_SET.map(([w, f]) => document.fonts.load(`${w} 20px ${f}`, text).catch(() => null))),
  new Promise(r => setTimeout(r, 15000)),
]).then(() => document.fonts.ready);

/* =========================================================
   2. 영상 추출 — 사이트 공통 렌더러가 쓰는 약속
   ========================================================= */
if (EXPORT) {
  cv.width = 1920; cv.height = 1080;
  const ready = new Promise(res => DRS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '길 묻기, 들은 길은 되짚어 확인한다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { DRS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
  };
  return;
}

/* =========================================================
   3. 플레이어
   ========================================================= */
let T = 0, playing = false, started = false, speed = 1, dirty = true, lastTs = 0, ccOn = true;
const playBtn = $('playBtn'), bigPlay = $('bigPlay'), seekEl = $('seek'), timeLbl = $('timeLbl'), capText = $('capText'), capBox = $('cap');
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
  script: '<svg data-k="script" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>',
  mic: DRS.iconSVG('mic'),
};
const PI = id => DRS.iconSVG(id, 'pi');   // 단계 · 건물 아이콘
const lsnBar = scriptOn => DRV.supported
  ? `<div class="lsn"><button type="button" class="lbtn say" data-act="play" aria-pressed="false">${ICO.play}<span>듣기</span><small>R</small></button><button type="button" class="lbtn say" data-act="slowplay" aria-pressed="false">${ICO.slow}<span>천천히</span><small>S</small></button>${scriptOn == null ? '' : `<button type="button" class="lbtn tog" data-act="script" aria-pressed="${!!scriptOn}">${ICO.script}<span>대본 보기</span><small>T</small></button>`}<span class="ldr-now" aria-live="polite"></span></div>`
  : '<p class="ldr-nosay">이 브라우저는 영어 음성을 쓸 수 없어 말을 글로 보여 줘요.</p>';
function paintPlay(box, mode) {
  box.querySelectorAll('.lbtn.say').forEach(b => {
    const on = mode === b.dataset.act, k = on ? 'stop' : b.dataset.act === 'slowplay' ? 'slow' : 'play';
    b.setAttribute('aria-pressed', String(on));
    const lab = b.querySelector('span'); if (lab) lab.textContent = on ? '멈추기' : b.dataset.act === 'slowplay' ? '천천히' : '듣기';
    const ic = b.querySelector('svg'); if (ic && ic.dataset.k !== k) ic.outerHTML = ICO[k];
  });
}
function paintNow(box, sel) { box.querySelectorAll('.now').forEach(x => x.classList.remove('now')); if (sel) { const el = box.querySelector(sel); if (el) el.classList.add('now'); } }
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
  const cap = started ? DRS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 말풍선을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = DRS.chapterAt(T);
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
  if (dirty) { dirty = false; DRS.render(ctx, started ? T : POSTER); }
  if (SIM.anim) simMapDraw();
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
function touch() { if (playing) pause(); dirty = true; }

/* =========================================================
   4. 소리 — 말하는 사람의 목소리로 읽기 (voices.js). 읽기 전에 다른 소리는 모두 멈춤
   ========================================================= */
let audioEl = null;                       // 따라 말하기 녹음 재생
function stopAudio() { if (audioEl) { try { audioEl.pause(); } catch (e) { /* 이미 멈춤 */ } audioEl = null; } document.querySelectorAll('.sh-play.saying').forEach(b => b.classList.remove('saying')); }
function stopSounds() { EN.say.stop(); DRV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return DRV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
const lpBtn = (seq, label, cls = '') => DRV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-lp]');
  if (!b) return;
  const box = b.closest('[data-slow]'), slow = !!box && box.getAttribute('data-slow') === '1';
  document.querySelectorAll('.lp-play.saying').forEach(x => x.classList.remove('saying'));
  b.classList.add('saying');
  speak(SEQS[+b.dataset.lp], { slow, onend() { b.classList.remove('saying'); } });
});
const staffSeq = q => q.cue ? [] : [{ text: q.en, sp: q.sp, rate: q.fast ? 1.35 : 1 }];
const meSeq = a => [{ text: typeof a === 'string' ? a : DR.text(a), sp: 'me' }];
const whoOf = q => q.cue ? '지나가는 사람' : q.sp === 'gb' ? '길에서 만난 사람 (영국)' : q.sp === 'au' ? '관광객' : '길에서 만난 사람';

/* =========================================================
   5. 글 칠하기 — 가려진 상대의 말(marks만 드러남)과 보기의 역할 색
   ========================================================= */
function lineHTML(text, marks, reveal) {
  const R = [];
  marks.forEach(m => {
    if (m.whole) { R.push({ s: 0, e: text.length, role: m.role }); return; }
    let i = text.indexOf(m.t); if (i < 0) i = text.toLowerCase().indexOf(String(m.t).toLowerCase());
    if (i >= 0) R.push({ s: i, e: i + m.t.length, role: m.role });
  });
  const roleAt = (s, e) => { const hit = R.filter(r => s < r.e && e > r.s && !(r.s === 0 && r.e === text.length && R.length > 1)); const any = R.filter(r => s < r.e && e > r.s); return (hit[0] || any[0] || {}).role; };
  const words = []; const re = /\S+/g; let m;
  while ((m = re.exec(text))) words.push({ w: m[0], s: m.index, role: roleAt(m.index, m.index + m[0].length) });
  const out = []; let last = 0, open = null;
  const close = () => { if (open) { out.push('</mark>'); open = null; } };
  words.forEach(({ w, s: at, role }) => {
    const gap = esc(text.slice(last, at));
    if (open && role === open) out.push(gap); else { close(); out.push(gap); }
    if (role) { if (open !== role) { out.push(`<mark class="mk-${role}">`); open = role; } out.push(esc(w)); }
    else if (reveal) out.push(esc(w));
    else out.push(`<span class="ldr-hid" style="width:${(0.42 + w.length * 0.48).toFixed(2)}em" aria-hidden="true"></span>`);
    last = at + w.length;
  });
  close();
  out.push(esc(text.slice(last)));
  return out.join('');
}
const segHTML = (a, on = true) => DR.segs(a).map(s => on && s.t.trim() && /[A-Za-z0-9]/.test(s.t) ? `<mark class="mk-${s.r}">${esc(s.t)}</mark>` : esc(s.t)).join('');
const keyMarks = q => q.key.map(t => ({ t, role: 'key' }));

/* =========================================================
   6. 듣고 대답 고르기 (DDrill, 식당 RDrill과 같은 모양) — 상대의 말은 소리 먼저, 대답 넷은 글
   지나가는 사람에게 내가 먼저 말을 거는 문제(cue)는 들을 말이 없어서 상황만 보여 줘요.
   키보드: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본 · Enter/→ 다음
   ========================================================= */
function DDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null;
  const compact = !!cfg.compact, hear = DRV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play', it = items[cur];
    if (it.Q.cue) return;
    if (toggle && mode === act && DRV.busy()) { DRV.stop(); return; }
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(staffSeq(it.Q), { slow: !!slow, onitem() { paintNow(root, '.ldr-q'); say(it.Q.fast ? '아주 빠르게 말하는 중' : '말하는 중'); },
      onend(stopped) { mode = null; paintPlay(root, null); paintNow(root, null); say(stopped ? '' : '다 들었어요. 대답을 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { DRV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; DRV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    DRV.stop();
    s.pick = k; s.hints = 3; render();
    const f = root.querySelector('.edr-next') || root.querySelector('.adr-ex'); if (f) f.focus({ preventScroll: true });
    if (cfg.onAnswer) cfg.onAnswer(items[cur], k);
  }
  function hint() { const s = st[cur]; if (s.pick !== null || s.hints >= 3) return; s.hints++; render(); }
  function dots() {
    if (compact) return '';
    return '<ol class="edr-dots" aria-label="문제 목록">' + items.map((it, i) => {
      const s = st[i], c = s.pick === null ? '' : s.pick === it.a ? ' ok' : ' no';
      return `<li><button type="button" data-go="${i}" class="${c}${i === cur ? ' cur' : ''}" aria-label="문제 ${i + 1}${s.pick === null ? '' : s.pick === it.a ? ' 정답' : ' 오답'}"${i === cur ? ' aria-current="step"' : ''}>${i + 1}</button></li>`;
    }).join('') + '</ol>';
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = DR.steps(it), place = DR.PLACE[it.place], cue = !!it.Q.cue;
    const marks = []; steps.slice(0, done ? 3 : s.hints).reverse().forEach(x => marks.push(...x.marks));
    const reveal = done || !hear || s.script, mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur);
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${PI(it.place)}${esc(place.ko)}</span><span>${compact ? '듣고 대답 고르기' : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span>${done ? `<span class="edr-tag">${it.Q.fast ? '다시 묻기' : cue ? '내가 먼저' : esc(DR.INTENT_KO[it.Q.intent])}</span>` : ''}</p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(it.sit)}</p>`;
    if (!cue) h += lsnBar(done ? null : s.script);
    h += cue ? `<p class="ldr-q cue"><b>${esc(whoOf(it.Q))}</b><span>상대는 아직 말하지 않았어요. 내가 먼저 말을 걸어요.</span></p>`
      : `<p class="ldr-q"><b>${esc(whoOf(it.Q))}</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="q" aria-label="상대의 말 다시 듣기" title="상대의 말 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.Q.en, mk('q'), reveal)}</span>${it.Q.fast && !done ? '<small class="adr-fast">아주 빠르게</small>' : ''}</p>`;
    h += `<p class="adr-ask">나의 말은?</p><div class="ldr-opts" role="group" aria-label="대답 보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '', t = DR.text(op);
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-lp="${seqId(meSeq(t))}" aria-label="(${L4[k]}) 듣기" title="(${L4[k]}) 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(t, mk(k), true)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트${hear && !cue ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + DR.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = (cue ? [] : [[`${whoOf(it.Q)} · ${it.Q.en}`, it.Q.ko, staffSeq(it.Q)]]).concat(it.opts.map((op, k) => [`(${L4[k]}) ${DR.text(op)}`, DR.ko(op), meSeq(op)]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      h += `<div class="edr-acts">${hear ? `<button type="button" class="edr-btn ghost adr-ex" data-lp="${seqId(staffSeq(it.Q).concat([{ text: DR.text(it.opts[it.a]), sp: 'me', gap: 0.5 }]))}">${ICO.play} 대화 듣기${cue ? ' (나)' : ' (상대 → 나)'}</button>` : ''}${compact ? '' : `<button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button>`}</div>`;
    }
    h += '</div>';
    root.innerHTML = h;
    paintPlay(root, mode);
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !root.contains(b) || b.hasAttribute('data-lp')) return;
    if (b.dataset.go) { retry = null; go(+b.dataset.go, false); return; }
    if (b.dataset.pick) { answer(+b.dataset.pick); return; }
    if (b.dataset.line != null) { playLine(false); return; }
    const act = b.dataset.act;
    if (act === 'play') playLine(false, true);
    else if (act === 'slowplay') playLine(true, true);
    else if (act === 'script') { st[cur].script = !st[cur].script; render(); }
    else if (act === 'hint') hint();
    else if (act === 'next') next();
    else if (act === 'retry') { retry = items.map((_, i) => i).filter(i => st[i].pick !== items[i].a); retry.forEach(i => { st[i] = { pick: null, hints: 0, script: false }; }); go(retry[0], true); }
    else if (act === 'reset') { retry = null; st = items.map(() => ({ pick: null, hints: 0, script: false })); go(0, false); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || cur < 0) return;
    const k = e.key.toUpperCase(), n = items[cur].opts.length, i = L4.slice(0, n).indexOf(k), d = '1234'.slice(0, n).indexOf(k);
    if (st[cur].pick === null && (i >= 0 || d >= 0)) { e.preventDefault(); answer(i >= 0 ? i : d); }
    else if (k === 'H') { e.preventDefault(); hint(); }
    else if (k === 'R' && hear) { e.preventDefault(); playLine(false); }
    else if (k === 'S' && hear) { e.preventDefault(); playLine(true); }
    else if (k === 'T' && hear && st[cur].pick === null) { e.preventDefault(); st[cur].script = !st[cur].script; render(); }
    else if (!compact && (e.key === 'ArrowRight' || e.key === 'Enter') && st[cur].pick !== null && !(e.target.closest && e.target.closest('button:not(.edr-next)'))) { e.preventDefault(); next(); }
  });
  render();
  return { go, render, state: () => st };
}

/* =========================================================
   7. 장면별 '직접 해 보기' — 장이 바뀔 때만 다시 만듦
   ========================================================= */
const seg = (name, items, cur, attr) => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${t}</button>`).join('')}</div>`;
const labHead = h3 => `<h2>직접 해 보기</h2><div class="lab-top"><h3>${esc(h3)}</h3></div>`;
const mini = key => `<div class="lmini" data-mini="${key}"></div>`;
const verdictHTML = j => `<p class="verdict"><b class="${j.ok ? 'c-ok' : 'c-no'}">${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + '에서 걸려요'}</b>${esc(j.why)}</p>`;
const clearBtn = '<button class="btn ghost" type="button" id="labClear">영상대로 보기</button>';
const frameT = f => esc(DR.FRAME[f].t.replace(/[{}]/g, '') || '(없이)');
const placeEn = (v, form) => { const x = DR.SLOT.place.vals[v]; return x ? x[form || 'the'] : v; };
const LAB = {
  greet: { place: 'supermarket', g: 'gr_ex', f: 'ak_near', v: null },
  move: { start: 0, mv: null },
  check: { line: [] },
  bus: { num: 15, where: 'across', nth: 3 },
  oneline: { line: [] },
};
const GREET_PLACES = ['supermarket', 'convenience', 'subway', 'restroom', 'trainstation'];
const PLACE_CHIPS = { supermarket: ['supermarket', 'grocery', 'mart'], convenience: ['convenience', 'conv', 'pharmacy'], subway: ['subway', 'underground', 'trainstation'], restroom: ['restroom', 'toilet', 'museum'], trainstation: ['trainstation', 'subway', 'busstop'] };
const MOVE_STARTS = [{ key: 'H1:0', t: 0.5, h: 'E', ko: 'Main Street · 동쪽' }, { key: 'V2:1', t: 0.5, h: 'N', ko: 'Bell Street · 북쪽' }, { key: 'V2:0', t: 0.5, h: 'S', ko: 'Bell Street · 남쪽' }, { key: 'H2:2', t: 0.5, h: 'W', ko: 'River Road · 서쪽' }];
const MOVES = { straight: ['go straight (한 블록)', [{ k: 'straight' }]], left: ['turn left', [{ k: 'turn', dir: 'left', nth: 1 }]], right: ['turn right', [{ k: 'turn', dir: 'right', nth: 1 }]], left2: ['take the second left', [{ k: 'turn', dir: 'left', nth: 2 }]], twice: ['turn left twice', [{ k: 'turn', dir: 'left', nth: 1 }, { k: 'turn', dir: 'left', nth: 1 }]] };
const greetAns = () => { const r = LAB.greet; if (!r.v && DR.FRAME[r.f].slot) return null; return r.g === 'gr_none' ? { f: 'gr_none', req: { f: r.f, v: r.v } } : { f: r.g, req: { f: r.f, v: r.v } }; };
// 되짚기 칩 (06 · 08장): 데모 길의 조각 + 하나씩 틀린 조각
const DEMO_CHIPS = (() => { const c = DR.modelLine(DR.DEMO, 'blocks'); return c.concat([{ k: 'turn', dir: 'right', lm: 'bank' }, { k: 'turn', dir: 'left', lm: 'postoffice' }, { k: 'go', n: 3 }, { k: 'side', dir: 'left' }, { k: 'turn', dir: 'right' }, { k: 'rel', rel: 'across', of: 'park' }]); })();
const chipKey = c => JSON.stringify(c);
const LABS = {
  intro: () => `${labHead('먼저 골라서 대답해 보세요')}${mini('intro')}
    <p class="note">상대의 말을 듣고 대답을 고르세요. 상대의 말은 답한 뒤에 글로 보여요. 막히면 힌트(H)로 3단계를 하나씩 열어 보세요.</p>`,
  route: () => {
    const i = S.stop, p = i != null ? DR.PLACES[i] : null;
    return `${labHead('단계를 골라 대표 말 듣기')}
      ${seg('단계', DR.PLACES.map((x, k) => [k, `${PI(x.id)}${k + 1}. ${esc(x.ko)}`]), i == null ? '' : i, 'stop')}
      ${p ? `<ul class="qlist">${DR.STAGE_LINES[p.id].map(([who, en]) => `<li>${lpBtn(who === 'me' ? meSeq(en) : [{ text: en, sp: 'us' }], '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${who === 'me' ? '나' : '상대'}</small></span></li>`).join('')}</ul>
        ${clearBtn}` : '<p class="note">단계를 고르면 그 단계의 대표 말을 들을 수 있고, 영상 화면에도 표시돼요. 보라 테두리의 단계(말 걸기 · 묻기 · 되짚기)에서는 내가 먼저 말해요.</p>'}`;
  },
  greet: () => {
    const r = LAB.greet, a = greetAns(), j = a ? DR.judge('gr_cue', a, { place: r.place }, '상황') : null, F0 = DR.FRAME[r.f];
    return `${labHead('말 걸고 곳 이름 묻기')}
      <div class="cv-row"><span class="cv-lab">가려는 곳</span>${seg('가려는 곳', GREET_PLACES.map(k => [k, esc(DR.SLOT.place.vals[k].ko)]), r.place, 'gp')}</div>
      <h3 class="mt">① 말 거는 말</h3>${seg('말 거는 말', DR.GREETS.map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.g, 'gg')}
      <h3 class="mt">② 묻는 틀</h3>${seg('묻는 틀', ['ak_how', 'ak_near', 'ak_nearest', 'ak_teach', 'ak_rude'].map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.f, 'gf')}
      <h3 class="mt">③ 곳 이름</h3>${seg('곳 이름', PLACE_CHIPS[r.place].map(v => [v, `<span lang="en">${esc(placeEn(v, F0.form))}</span>`]), r.v || '', 'gv')}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${clearBtn}` : '<p class="note">고르면 영상 화면에 내 말이 그려지고, 규칙 엔진이 3단계로 판정해요. 콩글리시(mart · a convenience)와 영국 영어(underground · toilets)도 넣어 보세요.</p>'}`;
  },
  move: () => {
    const r = LAB.move;
    return `${labHead('바라보는 쪽에 따라 움직여 보기')}
      <div class="cv-row"><span class="cv-lab">출발</span>${seg('출발', MOVE_STARTS.map((s0, k) => [k, esc(s0.ko)]), r.start, 'ms')}</div>
      <div class="cv-row"><span class="cv-lab">들은 말</span>${seg('동작', Object.entries(MOVES).map(([k, [t]]) => [k, `<span lang="en">${esc(t)}</span>`]), r.mv || '', 'mm')}</div>
      <p class="note">화살표가 걷는 사람이에요. 같은 turn left도 바라보는 쪽이 다르면 화면에서 다른 쪽으로 가요. <span lang="en">take the second left</span>와 <span lang="en">turn left twice</span>도 비교해 보세요(지도 끝에서는 그쪽에 길이 없어요).</p>${S.move ? clearBtn : ''}`;
  },
  mark: () => `${labHead('건물을 골라 위치 관계 보기')}
      ${seg('건물', DR.DESTS.map(id => [id, `${PI(DR.SPOT[id].icon)}${esc(DR.SPOT[id].ko)}`]), S.rel || '', 'rel')}
      <p class="note">고르면 규칙 엔진(<code>DR.where</code>)이 지도에서 계산한 관계(across from · next to · between · on the corner of · behind)가 영상 화면에 나와요. 기준점은 지도에 이름이 보이는 곳만 써요.</p>${S.rel ? clearBtn : ''}`,
  far: () => {
    const b = LAB.bus;
    return `${labHead('버스 안내 되짚기')}
      <p class="enline">${lpBtn([{ text: DR.say(DR.BUS_DEMO, 'stop'), sp: 'us' }], '듣기')}<span lang="en">${esc(DR.say(DR.BUS_DEMO, 'stop'))}</span></p>
      <div class="cv-row"><span class="cv-lab">버스</span>${seg('버스', [15, 50].map(n => [n, `<span lang="en">number ${n}</span> <small>${DR.numWord(n)}</small>`]), b.num, 'bn')}</div>
      <div class="cv-row"><span class="cv-lab">정류장</span>${seg('정류장', [['across', '<span lang="en">across the street</span>'], ['here', '<span lang="en">this stop</span>']], b.where, 'bw')}</div>
      <div class="cv-row"><span class="cv-lab">내리는 곳</span>${seg('내리는 곳', [1, 2, 3, 4].map(n => [n, `<span lang="en">the ${DR.ordW(n)} stop</span>`]), b.nth, 'bt')}</div>
      <p class="note">고르면 영상 화면에 되짚는 줄과 판정, 틀렸으면 상대가 고쳐 주는 말이 나와요. fifteen → 뒤를 세게, fifty → 앞을 세게.</p>${S.bus ? clearBtn : ''}`;
  },
  check: () => {
    const L = LAB.check, has = L.line.length, a = DR.Lr(L.line.slice()), q = DR.dirQ(DR.DEMO, 'blocks', { dist: false });
    let res = '';
    if (has) { const j = DR.judge(q, a, DR.DEMO_CARD, '상황'); res = `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${!j.ok && j.cb && j.cb.fix ? `<p class="enline">${lpBtn([{ text: j.cb.fix.en, sp: 'us' }], '상대의 말 듣기')}<span lang="en">${esc(j.cb.fix.en)}</span></p>` : j.ok ? `<p class="enline">${lpBtn([{ text: j.cb.reply.en, sp: 'us' }], '상대의 말 듣기')}<span lang="en">${esc(j.cb.reply.en)}</span></p>` : ''}`; }
    return `${labHead('조각을 골라 되짚기')}
      <p class="enline">${lpBtn([{ text: q.en, sp: 'us' }], '길 안내 듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
      <p class="note">조각을 누르는 차례대로 <span lang="en">So, … ?</span> 한 줄이 만들어져요. 일부러 틀린 조각을 넣어 보세요.</p>
      <div class="seg">${DEMO_CHIPS.map(c => `<button type="button" data-ck="${esc(chipKey(c))}" aria-pressed="${L.line.some(x => chipKey(x) === chipKey(c))}"><span lang="en">${esc(DR.chunkText(c))}</span></button>`).join('')}</div>
      ${res}<button class="btn ghost" type="button" id="ckClear">처음부터</button>`;
  },
  repair: () => `${labHead('빠른 말 · 다시 묻기')}${mini('repair')}
    <p class="note">버스 번호가 잘 안 들렸어요. 짐작하지 말고 안 들린 부분만 되물어요.</p>`,
  oneline: () => {
    const L = LAB.oneline, cov = L.cov || [], ex = L.ex || 0, q = DR.dirQ(DR.DEMO, 'blocks', { dist: false });
    const core = DR.coreOf(DR.DEMO), need = core.map((c, i) => c.core ? i : -1).filter(i => i >= 0), done = need.every(i => cov.includes(i));
    return `${labHead('주고받는 수 세어 보기')}
      <p class="note">조각을 하나씩 되짚어도 되고, 한 줄에 여러 조각을 넣어도 돼요. 확인된 조각은 다시 말하지 않아도 돼요.</p>
      <div class="seg">${DEMO_CHIPS.slice(0, 3).map(c => `<button type="button" data-ok1="${esc(chipKey(c))}" aria-pressed="${(L.line || []).some(x => chipKey(x) === chipKey(c))}"><span lang="en">${esc(DR.chunkText(c))}</span></button>`).join('')}</div>
      <div class="tg-acts mt8"><button type="button" class="btn" id="olSay"${(L.line || []).length ? '' : ' disabled'}>되짚기</button><button type="button" class="btn ghost" id="olClear">처음부터</button></div>
      ${L.last ? `<p class="enline">${lpBtn(meSeq(L.last), '듣기')}<span lang="en">${esc(L.last)}</span></p><p class="enline">${lpBtn([{ text: L.reply, sp: 'us' }], '상대의 말 듣기')}<span lang="en">${esc(L.reply)}</span></p>` : ''}
      <p class="verdict"><b class="${done ? 'c-ok' : 'c-no'}">주고받기 ${ex}번</b>${done ? '길 전체를 확인했어요.' : `확인한 조각: ${need.filter(i => cov.includes(i)).length} / ${need.length}`}</p>`;
  },
  method: () => {
    const i = S.place, row = i != null ? DR.METHOD[i] : null;
    return `${labHead('단계마다 3단계 적용해 보기')}
      ${seg('단계', DR.METHOD.map((_, k) => [k, `${PI(DR.PLACES[k].id)}${esc(DR.PLACES[k].ko)}`]), i == null ? '' : i, 'place')}
      ${row ? (() => { const [qid, a, c, sty] = row, q = qid === 'dir' ? DR.dirQ(c.route, sty, { dist: false }) : DR.Q[qid], j = DR.judge(q, a, c); return `${q.cue ? '<p class="note">(지나가는 사람 → 내가 먼저)</p>' : `<p class="enline">${lpBtn(staffSeq(q), '듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>`}
        <ol class="edr-steps"><li><b>① 열쇠 낱말</b> ${q.cue ? '곳 이름' : esc(q.key.join(' … '))} → ${esc(q.cue ? DR.INTENT.open.say : DR.sayOf(q.intent))}</li><li><b>② 틀 + 내 정보</b> <span lang="en">${segHTML(a)}</span> ${esc(DR.ko(a))}</li><li><b>③ 공손하게</b> ${esc(j.why)}</li></ol>
        <p class="enline">${lpBtn(staffSeq(q).concat([{ text: DR.text(a), sp: 'me', gap: 0.5 }]), '대화 듣기')}<span>대화 듣기</span></p>
        ${clearBtn}`; })() : '<p class="note">단계를 고르면 영상 화면의 그 줄이 켜지고, 세 단계를 글로 보여 줘요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>대화 골라 보기</h3>
    <div class="seg">${DRS.PSEG.map((t, i) => `<button type="button" data-seek="${t + 0.4}">대화 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 해 보고 싶다면 아래 <a href="#playground">길 찾기 시뮬레이터</a>에서 내 길 카드로 직접 물어보고, 들은 길을 되짚고, 지도에서 찾아가 보세요. 카드는 누를 때마다 새로 만들어져요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">길 찾기 시뮬레이터</a> — 길 카드로 묻고, 되짚고, 지도에서 찾아가기</li><li><a href="#shadow">길 묻기 표현 따라 말하기</a> — ${DR.SHADOW.length}문장 듣고 따라 하기</li>
    <li><a href="#drill">듣고 대답 고르기</a> — 일곱 단계 ${DR.DRILL.length}문제, 3단계 힌트</li><li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.querySelectorAll('.lmini').forEach(m => DDrill(m, [DR.MINI[m.dataset.mini]], { compact: true, onAnswer() { if (playing) pause(); } }));
}
function showAt(u) { const ch = CHAPTERS[DRS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const relab = () => { touch(); buildLab(DRS.chapterAt(T)); };
const syncGreet = () => { const a = greetAns(); S.greet = a ? { a, place: LAB.greet.place } : null; };
const syncMove = () => { const r = LAB.move; if (!r.mv) { S.move = null; return; } const st = MOVE_STARTS[r.start]; S.move = { start: st, text: MOVES[r.mv][0], res: DR.applyMoves(st, MOVES[r.mv][1]) }; };
const syncCheck = () => { S.check = LAB.check.line.length ? { line: LAB.check.line.slice() } : null; };
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  const d = b.dataset;
  if (d.seek) { seek(CHAPTERS[DRS.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') { ['stop', 'place', 'greet', 'move', 'rel', 'bus', 'check'].forEach(k => { S[k] = null; }); LAB.greet.v = null; LAB.move.mv = null; relab(); return; }
  if (d.stop != null) { S.stop = d.stop === '' ? null : +d.stop; showAt(14.8); relab(); return; }
  // 02장
  if (d.gp) { LAB.greet.place = d.gp; LAB.greet.v = null; syncGreet(); relab(); return; }
  if (d.gg) { LAB.greet.g = d.gg; syncGreet(); relab(); return; }
  if (d.gf) { LAB.greet.f = d.gf; syncGreet(); relab(); return; }
  if (d.gv) { LAB.greet.v = d.gv; syncGreet(); relab(); return; }
  // 03장
  if (d.ms != null) { LAB.move.start = +d.ms; syncMove(); relab(); return; }
  if (d.mm) { LAB.move.mv = d.mm; syncMove(); relab(); return; }
  // 04장
  if (d.rel) { S.rel = S.rel === d.rel ? null : d.rel; relab(); return; }
  // 05장
  if (d.bn) { LAB.bus.num = +d.bn; S.bus = Object.assign({}, LAB.bus); relab(); return; }
  if (d.bw) { LAB.bus.where = d.bw; S.bus = Object.assign({}, LAB.bus); relab(); return; }
  if (d.bt) { LAB.bus.nth = +d.bt; S.bus = Object.assign({}, LAB.bus); relab(); return; }
  // 06장
  if (d.ck) { const c = JSON.parse(d.ck), L = LAB.check; if (L.line.some(x => chipKey(x) === d.ck)) L.line = L.line.filter(x => chipKey(x) !== d.ck); else L.line.push(c); syncCheck(); relab(); return; }
  if (b.id === 'ckClear') { LAB.check.line = []; S.check = null; relab(); return; }
  // 08장
  if (d.ok1) { const L = LAB.oneline; L.line = L.line || []; if (L.line.some(x => chipKey(x) === d.ok1)) L.line = L.line.filter(x => chipKey(x) !== d.ok1); else L.line.push(JSON.parse(d.ok1)); relab(); return; }
  if (b.id === 'olSay') {
    const L = LAB.oneline, q = DR.dirQ(DR.DEMO, 'blocks', { dist: false }), a = DR.Lr(L.line), j = DR.judge(q, a, Object.assign({}, DR.DEMO_CARD, { covered: L.cov || [] }));
    L.ex = (L.ex || 0) + 1; L.last = DR.text(a); L.reply = j.ok ? j.cb.reply.en : j.cb && j.cb.fix ? j.cb.fix.en : 'Sorry?'; if (j.ok) L.cov = j.cb.covered; L.line = []; relab(); return;
  }
  if (b.id === 'olClear') { LAB.oneline = { line: [] }; relab(); return; }
  if (d.place != null) { S.place = d.place === '' ? null : +d.place; showAt(17.2); relab(); }
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/Yes\/No/g, 'Yes or No'], [/\s\+\s/g, ', '], [/ = /g, ', '], [/ — /g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   9. 음성 인식 · 녹음 (따라 말하기 · 시뮬레이터 말로 대답하기)
   ========================================================= */
const SRC = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const CAN_REC = !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const SPEAK_MODE = SRC ? 'sr' : CAN_REC ? 'rec' : 'none';
let activeRec = null;
function stopListening() { if (activeRec) { const r = activeRec; activeRec = null; try { r.abort(); } catch (e) { /* 이미 멈춤 */ } } }
const SR_ERR = {
  'not-allowed': '마이크를 쓸 수 없어요. 브라우저 주소창 옆의 설정에서 이 페이지의 마이크를 허락해 주세요.',
  'service-not-allowed': '이 브라우저에서는 음성 인식을 쓸 수 없어요. 마이크 권한이나 브라우저 설정을 확인해 주세요.',
  'no-speech': '소리가 들리지 않았어요. 마이크 가까이에서 다시 말해 보세요.',
  'audio-capture': '마이크를 찾지 못했어요. 마이크가 연결되어 있는지 확인해 주세요.',
  network: '인터넷 연결 문제로 말을 글로 바꾸지 못했어요. 연결을 확인하고 다시 해 보세요.',
  'language-not-supported': '이 브라우저는 영어 음성 인식을 지원하지 않아요.',
};
function listenOnce({ onText, onFail, onState }) {
  stopSounds(); NARR.reset(); if (playing) pause(); stopListening();
  let rec;
  try { rec = new SRC(); } catch (e) { onFail('음성 인식을 시작하지 못했어요.'); return; }
  rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 3; rec.continuous = false;
  let got = false, failed = false, timer = 0;
  rec.onresult = e => { got = true; const r = e.results[0], alts = []; for (let i = 0; i < r.length; i++) alts.push(r[i].transcript); onText(alts); };
  rec.onerror = e => { failed = true; if (e.error !== 'aborted') onFail(SR_ERR[e.error] || `음성 인식에 문제가 생겼어요 (${e.error}).`); };
  rec.onend = () => { clearTimeout(timer); if (activeRec === rec) activeRec = null; onState(false); if (!got && !failed) onFail(SR_ERR['no-speech']); };
  activeRec = rec; onState(true);
  try { rec.start(); } catch (e) { activeRec = null; onState(false); onFail('음성 인식을 시작하지 못했어요. 잠시 뒤 다시 눌러 보세요.'); return; }
  timer = setTimeout(() => { try { rec.stop(); } catch (e) { /* 이미 끝남 */ } }, 9000);
}

/* =========================================================
   10. 놀이터 — 길 찾기 시뮬레이터
   [첫 사람: 말 걸기 → 모른대요 → Thanks anyway →] 말 걸기 → (묻기) → (멀어요 → 어떤 버스?) → 길 안내 → 되짚기(한 줄 · 한 조각씩 · 고쳐 준 조각)
   → 지도에서 가려는 곳 누르기 → 걷는 사람이 길을 따라감 → 고맙다고 끝내기
   ========================================================= */
const SIM = { card: null, steps: [], i: 0, log: [], started: false, done: false, script: !DRV.supported, mode: null, react: null, why: null, heard: null, listening: false,
  g: null, f: null, v: null, frames: [], places: [], chips: [], line: [], covered: [], ex: 0, firstFull: null, fixAt: null, fixQ: null, tap: null, tapTries: 0, walk: null, anim: false, cursor: null, mapMsg: null };
window.__simCard = () => JSON.parse(JSON.stringify(SIM.card, (k, v) => k === 'route' ? undefined : v));   // 확인용(읽기만): 지금 길 카드 (길은 빼고)
window.__simRoute = () => SIM.card && JSON.parse(JSON.stringify(SIM.card.route));                          // 확인용(읽기만): 지금 길
window.__simStep = () => SIM.steps[SIM.i];                                                                // 확인용(읽기만): 지금 단계
window.__simChips = () => SIM.chips.map(c => DR.chunkText(c));                                            // 확인용(읽기만): 되짚기 칩
window.__simLot = () => SIM.card && (SIM.card.mode === 'bus' ? SIM.card.route.stop : DR.lotOfSpot(SIM.card.place));   // 확인용(읽기만): 정답 자리
const STEP_KO = { open1: '말 걸기(첫 사람)', local: '모른대요', open: '말 걸기', need1: '묻기(첫 사람)', need: '묻기', far: '멀어요', dir: '되짚기', map: '지도에서 찾기', confirm: '고맙다고 끝내기' };
const STEP_PLACE = { open1: 'greet', local: 'thanks', open: 'greet', need1: 'ask', need: 'ask', far: 'far', dir: 'check', map: 'check', confirm: 'thanks' };
function simQ() {
  const st = SIM.steps[SIM.i], c = SIM.card;
  if (st === 'dir') return SIM.fixQ || DR.simQ('dir', c);
  if (st === 'need1') return Object.assign({}, DR.Q.ak_yes, { sp: 'au' });
  if (st === 'map') return Object.assign({}, DR.Q.cb_ok, { sp: c.sp });
  return DR.simQ(st, c);
}
const simC = () => Object.assign({}, SIM.card, simQ().fact || {}, { covered: SIM.covered });
function simNew() {
  DRV.stop(); stopListening();
  SIM.card = DR.newCard();
  SIM.steps = (SIM.card.notLocal ? ['open1', 'local'] : []).concat(['open'], SIM.card.mode === 'bus' ? ['far'] : [], ['dir', 'map', 'confirm']);
  SIM.i = 0; SIM.log = []; SIM.done = false; SIM.react = null; SIM.why = null; SIM.heard = null;
  SIM.line = []; SIM.covered = []; SIM.ex = 0; SIM.firstFull = null; SIM.fixAt = null; SIM.fixQ = null; SIM.tap = null; SIM.tapTries = 0; SIM.walk = null; SIM.anim = false; SIM.cursor = null; SIM.mapMsg = null;
  simPrep(); simBuild();
}
function simPrep() {
  const st = SIM.steps[SIM.i], c = SIM.card, q = simQ();
  SIM.g = null; SIM.f = null; SIM.v = null;
  SIM.frames = shuffle(DR.simFrames(st === 'need1' ? 'need' : st, c) || []);
  SIM.places = DR.placeChoices(c);
  if (st === 'dir' && !SIM.chips.length) SIM.chips = DR.chunkChips(c);
  if (st !== 'dir') SIM.chips = [];
  if (!SIM.log[SIM.i]) SIM.log[SIM.i] = { step: st, q: q.id, en: q.cue || st === 'map' ? '' : q.en, sp: q.sp, tries: [] };
}
function simSpeak(lines, o = {}) {
  const box = $('sim'), seq = lines.filter(x => x && x.text);
  if (!seq.length) return;
  speak(seq, { slow: !!o.slow, onitem() { paintNow(box, '.sim-bub'); }, onend() { SIM.mode = null; paintPlay(box, null); paintNow(box, null); } });
  SIM.mode = o.slow ? 'slowplay' : 'play'; paintPlay(box, SIM.mode);
}
function simAsk(prefix, slow) { const q = simQ(); simSpeak((prefix ? [{ text: prefix.text, sp: prefix.sp || 'us' }] : []).concat(q.cue ? [] : [{ text: q.en, sp: q.sp, gap: 0.5, rate: q.fast ? 1.35 : 1 }]), { slow }); }
const REPLY_OK = { open1: 'Sure?', open: 'Sure.', need1: '…', need: 'Sure.', far: 'Okay.', confirm: 'You\'re welcome. Have a good day!' };
// 다음 단계로
function simNext(pre, ko) {
  const q0 = simQ(), sp = q0.sp || SIM.card.sp;
  SIM.i++; SIM.fixQ = null; SIM.fixAt = null; SIM.line = [];
  if (SIM.i >= SIM.steps.length) { SIM.done = true; SIM.react = { en: pre, ko: ko || '끝! 길을 찾아갔어요.', st: 'ok', who: whoOf(q0) }; simBuild(); simSpeak([{ text: pre, sp }]); return; }
  simPrep();
  const st = SIM.steps[SIM.i], nq = simQ();
  SIM.react = { en: pre, ko: ko || '통과!', st: 'ok', who: whoOf(q0) };
  simBuild();
  if (st === 'map') { simSpeak([{ text: pre, sp }]); return; }
  simAsk(pre ? { text: pre, sp } : null);
}
// 대답 판정 (칩 · 말)
function simAnswer(a, spoken) {
  if (SIM.done || !SIM.started) return;
  const st = SIM.steps[SIM.i], q = simQ(), C = simC(), L = SIM.log[SIM.i];
  if (st === 'map') return;
  let j = spoken ? DR.matchSpoken(spoken, q, C) : DR.judge(q, a, C);
  SIM.heard = spoken || null;
  const model = DR.model(q, C);
  if (j.repair) {
    const re = j.repair === 'map' ? 'Sure. Here, look — we\'re here, and it\'s right here.' : null;
    SIM.react = { en: re || 'Sure. ' + q.en, ko: re ? '지도를 보여 주며 다시 알려 줘요.' : '다시 물었어요. 천천히 한 번 더 말해 줘요.', st: 'repair', who: whoOf(q) }; SIM.why = null; simBuild();
    simSpeak(re ? [{ text: re, sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }] : [{ text: 'Sure.', sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }], { slow: true }); return;
  }
  // 되짚기에서 다시 묻기 칩
  if (!spoken && a && DR.FRAME[a.f].intent === 'repair' && !q.fast && (st === 'dir') && DR.FRAME[a.f].tag === 'ok' && (DR.FRAME[a.f].kind !== 'echo' || DR.echoOk(q, DR.FRAME[a.f].echo))) {
    SIM.react = { en: DR.FRAME[a.f].kind === 'map' ? 'Sure. Here, look.' : 'Sure.', ko: '다시 물었어요. 천천히 한 번 더 말해 줘요. (주고받기에 세지 않아요)', st: 'repair', who: whoOf(q) }; SIM.why = null; simBuild();
    simSpeak([{ text: DR.FRAME[a.f].kind === 'map' ? 'Sure. Here, look.' : 'Sure.', sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }], { slow: true }); return;
  }
  const said = spoken ? `(말로) ${spoken}` : DR.text(a);
  L.tries.push({ t: said, ok: j.ok, stage: j.stage });
  SIM.why = { j, model, spoken: !!spoken };
  // 되짚기
  if (st === 'dir' && (j.cb || (j.tag === 'need' || j.tag === 'check'))) {
    SIM.ex++;
    const cb = j.cb;
    if (j.ok) {
      SIM.covered = cb.covered;
      if (SIM.firstFull == null) SIM.firstFull = cb.full;
      L.final = spoken || DR.text(a);
      if (cb.full) { SIM.log[SIM.i].reply = 'That\'s right. You can\'t miss it.'; simNext('That\'s right. You can\'t miss it.', '맞아요! 이제 지도에서 가려는 곳을 눌러 보세요.'); return; }
      SIM.fixQ = null; SIM.fixAt = null; SIM.line = [];
      SIM.react = { en: cb.reply.en, ko: '맞게 되짚은 조각까지 확인했어요. 남은 조각도 되짚어요 — 이미 확인한 조각은 다시 말하지 않아도 돼요.', st: 'ok', who: whoOf(q) };
      simBuild(); simSpeak([{ text: cb.reply.en, sp: q.sp }]); return;
    }
    if (SIM.firstFull == null) SIM.firstFull = false;
    if (cb && cb.fix && cb.err.i < 0) {
      // 들은 길에 없는 조각: 상대가 길을 처음부터 다시 말해 줘요 (다시 되짚을 한 조각이 없어요)
      SIM.fixQ = null; SIM.fixAt = null; SIM.line = [];
      const dq = DR.simQ('dir', SIM.card);
      SIM.react = { en: cb.fix.en, ko: `${cb.fix.ko} 길을 다시 듣고 되짚어요.`, st: 'no', who: whoOf(q) };
      simBuild(); simSpeak([{ text: cb.fix.en, sp: q.sp }, { text: dq.en, sp: q.sp, gap: 0.5 }]); return;
    }
    if (cb && cb.fix) {
      // 틀린 조각 앞까지 맞은 조각은 확인된 것으로
      const S0 = spoken ? (j.chunks || DR.parseCheck(spoken)) : a.line;
      for (let k = S0.length - 1; k >= 1; k--) { const c2 = DR.checkBack(SIM.card.route, S0.slice(0, k), { covered: SIM.covered }); if (c2.ok) { SIM.covered = c2.covered; break; } }
      SIM.fixAt = cb.err.i;
      SIM.fixQ = DR.fixQ(SIM.card.route, cb, { sp: q.sp });
      SIM.line = [];
      SIM.react = { en: cb.fix.en, ko: `${cb.fix.ko} 고쳐 준 조각을 다시 되짚어요.`, st: 'no', who: whoOf(q) };
      simBuild(); simSpeak([{ text: cb.fix.en, sp: q.sp }]); return;
    }
    const r = DR.REACT[2](q, j, a);
    SIM.react = Object.assign({ st: 'no', who: whoOf(q) }, r); SIM.line = [];
    simBuild(); simSpeak([{ text: r.en, sp: q.sp }]); return;
  }
  if (j.ok) {
    L.final = spoken || DR.text(a);
    // 말 거는 말만 했으면 상대가 Yes? 하고 물어요
    const greetOnly = spoken ? j.greetOnly : a && DR.FRAME[a.f].greet && !a.req;
    if ((st === 'open' || st === 'open1') && greetOnly) { SIM.steps.splice(SIM.i + 1, 0, st === 'open1' ? 'need1' : 'need'); simNext('', '말을 걸었어요. 이제 가려는 곳을 물어요.'); return; }
    if (st === 'local') { SIM.card.sp = SIM.card.sp === 'au' ? 'us' : SIM.card.sp; simNext('Okay. Good luck!', '다음 사람에게 물어봐요.'); return; }
    if (st === 'open1' || st === 'need1') { simNext('', '첫 사람은 …'); return; }
    if (st === 'open' || st === 'need') { simNext('', SIM.card.mode === 'bus' ? '버스를 타야 하는 먼 곳이에요.' : '이제 길 안내를 들어요. 동작 · 기준점 · 도착 위치를 조각으로 들어요.'); return; }
    if (st === 'far') { simNext('', '버스 안내를 들어요. 번호 · 정류장 · 내리는 곳.'); return; }
    simNext(REPLY_OK[st] || 'Sure.');
    return;
  }
  const r = j.stage === 1 ? DR.REACT[1](q) : j.stage === 2 ? DR.REACT[2](q, j, a) : j.stage === 3 ? DR.REACT[3](q, j) : { en: 'Sorry?', ko: '알아듣지 못했어요.' };
  SIM.react = Object.assign({ st: 'no', who: whoOf(q) }, r); SIM.g = null; SIM.f = null; SIM.v = null;
  simBuild(); simSpeak([{ text: r.en, sp: q.sp }]);
}
// 지도
const SIM_M = { ox: 75, oy: 76, s: 150 }, SIM_W = 600, SIM_H = 452;
function simMapCanvas() { return $('simMap'); }
function simTargets() { const c = SIM.card; return c.mode === 'bus' ? Object.keys(DR.STOPS) : Object.keys(DR.LOTS); }
function simTargetRect(id) {
  if (DR.STOPS[id]) { const st = DR.STOPS[id], p = DR.segPoint(st.key, st.t), [x, y] = DRS.TP(SIM_M, p[0], p[1] + (st.side === 'N' ? -0.088 : 0.088)); return { x: x - 16, y: y - 10, w: 32, h: 20, cx: x, cy: y }; }   // 정류장 표지판 자리 (scenes.js town과 같은 자리)
  return DRS.lotRect(SIM_M, id);
}
function simMapDraw() {
  const c = simMapCanvas(); if (!c || !SIM.card) return;
  const r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), Wd = Math.max(1, Math.round(r.width * d)), Hd = Math.max(1, Math.round(r.height * d));
  if (c.width !== Wd || c.height !== Hd) { c.width = Wd; c.height = Hd; }
  const g = c.getContext('2d'), s = c.width / SIM_W;
  g.setTransform(s, 0, 0, s, 0, 0); g.fillStyle = '#10151C'; g.fillRect(0, 0, SIM_W, SIM_H);
  const C = SIM.card, R = C.route, end = SIM.done || (SIM.steps[SIM.i] === 'confirm') || SIM.walk;
  let walker = { p: DR.segPoint(C.start.key, C.start.t), h: DRS.HANG[C.start.h] };
  if (C.mode === 'bus') walker = { p: [DR.segPoint(C.start.key, C.start.t)[0], DR.segPoint(C.start.key, C.start.t)[1] + (C.start.side === 'N' ? -0.12 : 0.12)], h: DRS.HANG[C.start.h] };
  let routeP = 0;
  if (SIM.walk) {
    const p = clamp((performance.now() - SIM.walk) / 2600);
    routeP = p;
    const at = DRS.pathAt(R.path, p); walker = { p: [at.x, at.y], h: at.ang };
    if (p >= 1 && SIM.anim) { SIM.anim = false; setTimeout(simBuildMapNote, 0); }
  } else if (end) { routeP = 1; const at = DRS.pathAt(R.path, 1); walker = { p: [at.x, at.y], h: at.ang }; }
  const hl = {};
  if (SIM.tap && !SIM.tap.ok) hl[SIM.tap.id] = '#FF6B6B';
  if (end && C.mode === 'walk') hl[C.place] = '#FFC15E';
  if (end && C.mode === 'bus') hl[R.stop] = '#FFC15E';
  DRS.draw.town(g, SIM_M, { reveal: end && C.mode === 'walk' ? [C.place] : [], route: routeP > 0 ? R : null, routeP, arrows: end && C.mode === 'walk', stops: true, hl, pin: end && C.mode === 'walk' && (!SIM.walk || routeP >= 1) ? C.place : null, cursor: SIM.steps[SIM.i] === 'map' && !end ? SIM.cursor : null, walker: { p: walker.p, h: walker.h } });
  if (SIM.steps[SIM.i] === 'map' && !end && SIM.cursor && DR.STOPS[SIM.cursor]) { const rc = simTargetRect(SIM.cursor); g.strokeStyle = '#6EC8FF'; g.lineWidth = 2.5; g.setLineDash([4, 3]); g.strokeRect(rc.x - 3, rc.y - 3, rc.w + 6, rc.h + 6); g.setLineDash([]); }
}
function simBuildMapNote() { simBuild(); }
function simTapAt(id) {
  if (SIM.steps[SIM.i] !== 'map' || SIM.walk) return;
  const C = SIM.card, want = C.mode === 'bus' ? C.route.stop : DR.lotOfSpot(C.place), ok = id === want;
  SIM.tapTries++;
  SIM.tap = { id, ok };
  const L = SIM.log[SIM.i]; L.tries.push({ t: '(지도) ' + (DR.STOPS[id] ? DR.STOPS[id].ko : '건물'), ok, stage: ok ? 0 : 2 });
  if (!ok) {
    const told = C.mode === 'bus' ? DR.chunks(C.route, C.style) : DR.modelLine(C.route, C.style);
    SIM.mapMsg = { ok: false, t: `그곳이 아니에요. 들은 조각을 차례로 따라가 보세요 → ${told.map(DR.chunkKo).join(' → ')}${C.route.rel ? ` (${DR.relText(C.route.rel, 'ko')})` : ''}` };
    simMapDraw(); simBuild(); return;
  }
  L.final = '(지도에서 찾음)';
  SIM.mapMsg = { ok: true, t: C.mode === 'bus' ? `맞아요! ${C.route.where === 'across' ? '길을 건너' : '이 정류장에서'} ${C.route.line}번 버스를 타고 ${DR.ordKo(C.route.nth)} 정류장(${DR.FAR[C.place].the})에서 내려요.` : `맞아요! 가려는 곳 → ${DR.SPOT[C.place].ko}(${DR.SPOT[C.place].en}). 들은 길을 따라 걸어가요.` };
  SIM.walk = performance.now(); SIM.anim = true;
  SIM.i++; simPrep(); simBuild();
  $('sim').focus({ preventScroll: true });   // 다음 차례(고맙다고 끝내기)의 키보드가 바로 되도록
}
const chipT = f => esc(DR.FRAME[f].t.replace(/[{}]/g, '')).replace('___', '<i class="blank">___</i>') || '(없이)';
function simBuild() {
  const hear = DRV.supported, C = SIM.card;
  $('simCard').innerHTML = `<p class="tc-head">${PI('mark')}<b>길 카드</b> <span lang="en">DIRECTIONS CARD</span></p><dl>${DR.cardRows(C).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="tc-foot">동네 · 길 이름 · 가게는 지어낸 것이에요(${esc(DR.TOWN_NAME)}). 가려는 곳은 지도에 표시되지 않아요 — 듣고 찾아가요.</p>`;
  const prog = SIM.steps.map((st, k) => { const L = SIM.log[k], c = !L || !L.final ? (k === SIM.i && !SIM.done ? ' cur' : '') : L.tries[0] && L.tries[0].ok ? ' ok' : ' late'; return `<li class="${c}" title="${esc(STEP_KO[st])}">${k + 1}</li>`; }).join('');
  $('simProg').innerHTML = prog;
  simMapDraw();
  const st = SIM.steps[SIM.i], box = $('simMain');
  $('simMapNote').innerHTML = st === 'map' && !SIM.done ? `${SIM.mapMsg && !SIM.mapMsg.ok ? `<span class="c-no">${esc(SIM.mapMsg.t)}</span><br>` : ''}<b>지도에서 ${C.mode === 'bus' ? '탈 정류장' : '가려는 곳'}을 누르세요</b> <small>(키보드: 지도를 누른 뒤 화살표로 고르고 Enter)</small>` : SIM.mapMsg ? `<span class="${SIM.mapMsg.ok ? 'c-ok' : 'c-no'}">${esc(SIM.mapMsg.t)}</span>` : '화살표 = 지금 내가 선 곳과 바라보는 쪽';
  if (!SIM.started) {
    box.innerHTML = `<div class="sim-start"><p>왼쪽 길 카드가 지금의 사실이에요(어디에 서 있는지 · 어느 쪽을 보는지 · 가려는 곳 · 걸어서인지 버스인지). 가려는 곳은 지도에 표시되지 않아요. 지나가는 사람에게 <b>말을 걸고</b>(말 거는 말 칩 + 묻는 틀 칩 + 곳 이름 칩), 길 안내를 <b>듣고</b>, 들은 조각을 <b>되짚어</b> 확인한 뒤, <b>지도에서 가려는 곳을 눌러요</b>. 걷는 사람이 그 길을 따라가요. 모른다고 하는 사람을 만날 수도 있어요${SRC ? ' — 마이크로 말해서 대답할 수도 있어요' : ''}.</p><button type="button" class="btn" id="simGo">시작 (Enter)</button></div>`;
    return;
  }
  if (SIM.done) {
    const first = SIM.log.filter(L => L && L.tries[0] && L.tries[0].ok).length, asked = SIM.log.filter(L => L && L.tries.length).length;
    const ml = C.mode === 'bus' ? DR.Lr(DR.chunks(C.route, C.style)) : DR.Lr(DR.modelLine(C.route, C.style));
    box.innerHTML = `<div class="sim-end"><p class="sim-score"><b>${first} / ${asked}</b> 차례를 한 번에 통과했어요.</p>
      <p class="sim-saved">${SIM.firstFull ? `되짚기: <b>한 줄에 모두 맞게</b> 확인했어요 (주고받기 ${SIM.ex}번).` : `되짚기: 주고받기 <b>${SIM.ex}번</b>. 다음에는 한 줄로 → <span lang="en">${segHTML(ml)}</span> ${lpBtn(meSeq(ml), '한 줄 되짚기 듣기')}`} · 지도: ${SIM.tapTries <= 1 ? '한 번에 찾았어요' : `${SIM.tapTries}번 만에 찾았어요`}.</p>
      <p class="sim-react ok"><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>
      <ol class="sim-log">${SIM.log.filter(L => L && (L.final || L.tries.length)).map(L => `<li><span class="who">${esc(STEP_KO[L.step])}</span>${L.en ? `${lpBtn([{ text: L.en, sp: L.sp }], '듣기')}<span lang="en">${esc(L.en)}</span><br>` : ''}<span class="who me">나</span>${L.final && !/^\(/.test(L.final) ? `${lpBtn(meSeq(L.final.replace(/^\(말로\) /, '')), '듣기')}<span lang="en">${esc(L.final)}</span>` : `<span>${esc(L.final || '')}</span>`}${L.tries.length > 1 ? ` <small>(${L.tries.length}번째에 통과)</small>` : ''}</li>`).join('')}</ol>
      <div class="tg-acts"><button type="button" class="btn" id="simAgain">새 카드로 다시 (N)</button>${hear ? `<button type="button" class="btn ghost" data-lp="${seqId(SIM.log.filter(L => L && L.final).flatMap(L => (L.en ? [{ text: L.en, sp: L.sp }] : []).concat(/^\(/.test(L.final) ? [] : [{ text: L.final.replace(/^\(말로\) /, ''), sp: 'me', gap: 0.4 }])))}">대화 전체 듣기</button>` : ''}</div></div>`;
    return;
  }
  const q = simQ(), show = SIM.script || !hear, isOpen = st === 'open' || st === 'open1';
  let h = q.cue ? '' : lsnBar(SIM.script);
  h += q.cue ? `<div class="sim-officer">${staffSVG(st === 'open1' ? 'tourist' : 'local')}<p class="sim-bub cue"><span class="who">${esc(whoOf(q))}</span><span>${st === 'open1' ? '한 사람이 걸어와요.' : '다른 사람이 걸어와요.'} 내가 먼저 말을 걸어요.</span></p></div>`
    : `<div class="sim-officer">${staffSVG(DRS.kindOf(q))}<p class="sim-bub"><span class="who">${esc(whoOf(q))}</span><span class="ldr-t" lang="en">${lineHTML(q.en, show ? keyMarks(q) : [], show)}</span>${hear ? `<button type="button" class="lp-play lp-mini" data-simline="1" aria-label="다시 듣기" title="다시 듣기">${SVG_PLAY}</button>` : ''}</p></div>`;
  if (SIM.react) h += `<p class="sim-react ${SIM.react.st}"><span class="who">${esc(SIM.react.who || whoOf(q))}</span><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>`;
  if (st === 'map') {
    h += `<p class="sim-lab">지도에서 ${C.mode === 'bus' ? '탈 정류장' : '가려는 곳'}을 눌러요 <small>왼쪽 지도</small></p><p class="note">들은 조각을 차례로 따라가 보세요 → <span lang="en">${esc(DR.lineText(C.mode === 'bus' ? DR.chunks(C.route, C.style) : DR.modelLine(C.route, C.style)).replace(/^So, (I )?/, '').replace(/\?$/, ''))}</span></p>`;
  } else if (st === 'dir') {
    const a = DR.Lr(SIM.line.slice()), fx = SIM.fixQ != null;
    h += `<p class="sim-lab">${fx ? '고쳐 준 조각을 다시 되짚기' : '들은 조각을 차례로 눌러 되짚기'} <small>1~${SIM.chips.length} · 같은 조각을 두 번 넣어도 돼요</small></p>`;
    if (SIM.covered.length) h += `<p class="note">확인된 조각: ${DR.coreOf(C.route).map((c, i) => SIM.covered.includes(i) && c.core ? esc(DR.chunkKo(c.k === 'turn' ? Object.assign({ k: 'turn', dir: c.dir }, c.L && c.L.lm ? { lm: c.L.lm } : c.lights ? { lights: c.lights } : { street: c.street }) : c)) : null).filter(Boolean).join(' · ') || '없음'} → 다시 말하지 않아도 돼요</p>`;
    h += `<div class="chips" role="group" aria-label="되짚을 조각">${SIM.chips.map((c, k) => `<button type="button" class="chips-s chip-ck" data-sk="${k}" aria-pressed="${SIM.line.includes(c)}"><small>${k + 1}</small> <span lang="en">${esc(DR.chunkText(c))}</span></button>`).join('')}</div>`;
    h += `<div class="sim-ans"><span class="who me">나</span>${SIM.line.length ? `<span lang="en" class="sim-line">${segHTML(a)}</span>` : '<span class="note">조각을 고르세요. <span lang="en">So, … ?</span> 한 줄이 돼요.</span>'}</div>`;
    h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${SIM.line.length ? '' : ' disabled'}>되짚기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${SIM.line.length ? '' : ' disabled'}>하나 지우기 (Backspace)</button>${SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 되짚기 (M)'}</button>` : ''}</div>`;
    h += `<p class="sim-lab">못 알아들었으면 <small>Q · W · E</small></p><div class="chips" role="group" aria-label="다시 묻기">${['rp_again', C.mode === 'bus' ? 'rp_bus' : 'rp_lr', 'rp_map'].map((f, k) => `<button type="button" class="chipf chip-req" data-rp="${f}"><small>${'QWE'[k]}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}</div>`;
  } else {
    if (isOpen) h += `<p class="sim-lab">① 말 거는 말 <small>5~8</small></p><div class="chips" role="group" aria-label="말 거는 말">${DR.GREETS.map((f, k) => `<button type="button" class="chipf chip-req" data-sg="${f}" aria-pressed="${SIM.g === f}"><small>${k + 5}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}</div>`;
    h += `<p class="sim-lab">${isOpen ? '② 묻는 틀' : '① 대답 틀'} <small>1~${SIM.frames.length}</small></p><div class="chips" role="group" aria-label="대답 틀">${SIM.frames.map((f, k) => `<button type="button" class="chipf" data-sf="${f}" aria-pressed="${SIM.f === f}"><small>${k + 1}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}</div>`;
    const Fm = SIM.f ? DR.FRAME[SIM.f] : null;
    if (Fm && Fm.slot) h += `<p class="sim-lab">${isOpen ? '③' : '②'} 곳 이름 <small>A~C</small></p><div class="chips" role="group" aria-label="곳 이름">${SIM.places.map((v, k) => `<button type="button" class="chips-s" data-sv="${esc(v)}" aria-pressed="${SIM.v === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(placeEn(v, Fm.form))}</span></button>`).join('')}</div>`;
    const fa = simChipAnswer();
    h += `<div class="sim-ans"><span class="who me">나</span>${fa ? `<span lang="en" class="sim-line">${segHTML(fa)}</span>` : '<span class="note">틀을 고르세요.</span>'}</div>`;
    h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${fa ? '' : ' disabled'}>말하기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${SIM.f || SIM.g ? '' : ' disabled'}>지우기</button>${SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 대답하기 (M)'}</button>` : ''}</div>`;
  }
  if (SIM.heard) h += `<p class="note">들린 말: <span lang="en">${esc(SIM.heard)}</span></p>`;
  if (SIM.why) {
    const { j, model } = SIM.why, sst = j.ok ? '통과' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸렸어요';
    h += `<div class="sim-why ${j.ok ? 'ok' : 'no'}"><p><b>${esc(sst)}</b> ${esc(j.why)}</p>${j.ok ? '' : `<p>모범 대답 ${lpBtn(meSeq(model), '모범 대답 듣기')}<span lang="en">${segHTML(model)}</span> <small>${esc(DR.ko(model))}</small></p>`}${SIM.why.spoken ? '<p class="note">말로 한 대답은 낱말과 카드의 사실, 되짚은 조각만 맞춰 봐요. 공손함과 발음은 판정하지 않아요.</p>' : ''}</div>`;
  }
  box.innerHTML = h;
  paintPlay($('sim'), SIM.mode);
}
// 칩으로 만든 대답 (말 걸기는 말 거는 말 + 묻는 틀 + 곳)
function simChipAnswer() {
  const st = SIM.steps[SIM.i], isOpen = st === 'open' || st === 'open1';
  if (isOpen) {
    if (!SIM.g && !SIM.f) return null;
    const req = SIM.f ? (DR.FRAME[SIM.f].slot ? (SIM.v ? { f: SIM.f, v: SIM.v } : null) : { f: SIM.f }) : undefined;
    if (SIM.f && !req) return null;
    if (!SIM.g) return null;
    return req ? { f: SIM.g, req } : { f: SIM.g };
  }
  if (!SIM.f) return null;
  const Fm = DR.FRAME[SIM.f]; if (Fm.slot && !SIM.v) return null;
  return Fm.slot ? { f: SIM.f, v: SIM.v } : { f: SIM.f };
}
const LOOKS = { local: ['#3E5A7A', '#D9A57C', '#2B2420'], cap: ['#4A6A4A', '#C99169', '#1F1B18'], tourist: ['#7A5A3A', '#E8BC95', '#5A3A28'], uk: ['#3A2E4A', '#E8BC95', '#5A3A28'] };
const staffSVG = kind => { const [sh, sk, hr] = LOOKS[kind] || LOOKS.local; return `<svg class="sim-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#202A36"/><ellipse cx="24" cy="47" rx="19" ry="14" fill="${sh}"/>${kind === 'uk' ? '<rect x="16" y="32" width="16" height="4" rx="1.5" fill="#B8432B"/>' : ''}${kind === 'tourist' ? '<rect x="19" y="37" width="10" height="6" rx="1.5" fill="#2B2F36"/>' : ''}<circle cx="24" cy="21" r="8.5" fill="${sk}"/><path d="M15.5 19a8.5 8.5 0 0 1 17 0z" fill="${hr}"/>${kind === 'cap' ? '<path d="M15.5 18a8.5 8.5 0 0 1 17 0z" fill="#B8432B"/><rect x="24" y="16.5" width="11" height="2.5" rx="1" fill="#B8432B"/>' : ''}<circle cx="21" cy="22" r="1" fill="#2B2420"/><circle cx="27" cy="22" r="1" fill="#2B2420"/></svg>`; };
function simKeep() { if (!$('sim').contains(document.activeElement) || !document.activeElement.isConnected) $('sim').focus({ preventScroll: true }); }
function simMic() {
  if (!SRC || SIM.done || !SIM.started || SIM.steps[SIM.i] === 'map') return;
  if (SIM.listening) { stopListening(); return; }
  listenOnce({
    onState(on) { SIM.listening = on; simBuild(); simKeep(); },
    onText(alts) { const q = simQ(), C = simC(), best = alts.find(t => DR.matchSpoken(t, q, C).ok) || alts[0]; simAnswer(null, best); simKeep(); },
    onFail(msg) { SIM.react = { en: '…', ko: msg, st: 'no' }; simBuild(); simKeep(); },
  });
}
function simSayChips() {
  const st = SIM.steps[SIM.i];
  if (st === 'dir') { if (!SIM.line.length) return; simAnswer({ f: 'cb_so', line: SIM.line.slice() }); return; }
  const a = simChipAnswer(); if (a) simAnswer(a);
}
function simMove(dx, dy) {
  const ids = simTargets(), cur = SIM.cursor && ids.includes(SIM.cursor) ? SIM.cursor : null;
  if (!cur) { SIM.cursor = ids[0]; simMapDraw(); return; }
  const a = simTargetRect(cur);
  let best = null, bd = 1e9;
  ids.forEach(id => { if (id === cur) return; const b = simTargetRect(id), vx = b.cx - a.cx, vy = b.cy - a.cy, along = vx * dx + vy * dy; if (along <= 4) return; const off = Math.abs(vx * dy - vy * dx), dd = along + off * 2.2; if (dd < bd) { bd = dd; best = id; } });
  if (best) { SIM.cursor = best; simMapDraw(); }
}
function simInit() {
  $('simNew').addEventListener('click', () => { simNew(); SIM.started = false; simBuild(); });
  const mc = simMapCanvas();
  mc.addEventListener('click', e => {
    if (!SIM.started || SIM.steps[SIM.i] !== 'map') return;
    const r = mc.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * SIM_W, y = (e.clientY - r.top) / r.height * SIM_H;
    const hit = simTargets().find(id => { const b = simTargetRect(id); return x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 3 && y <= b.y + b.h + 3; });
    if (hit) { SIM.cursor = hit; simTapAt(hit); simKeep(); }
  });
  mc.addEventListener('keydown', e => {
    if (SIM.steps[SIM.i] !== 'map') return;
    const k = e.key;
    if (k === 'ArrowRight') { e.preventDefault(); simMove(1, 0); } else if (k === 'ArrowLeft') { e.preventDefault(); simMove(-1, 0); } else if (k === 'ArrowUp') { e.preventDefault(); simMove(0, -1); } else if (k === 'ArrowDown') { e.preventDefault(); simMove(0, 1); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (SIM.cursor) simTapAt(SIM.cursor); }
    else if (k === 'n' || k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); $('sim').focus({ preventScroll: true }); }
  });
  $('sim').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    // 시뮬레이터를 시작하면 영상과 음성 해설을 멈춰요 (첫 차례가 말이 없는 ‘지나가는 사람’이어도)
    if (b.id === 'simGo') { NARR.reset(); if (playing) pause(); SIM.started = true; simBuild(); simAsk(); simKeep(); return; }
    if (b.id === 'simAgain') { simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); return; }
    if (b.dataset.sg) { SIM.g = b.dataset.sg; simBuild(); simKeep(); return; }
    if (b.dataset.sf) { SIM.f = b.dataset.sf; SIM.v = null; simBuild(); simKeep(); return; }
    if (b.dataset.sv != null) { SIM.v = b.dataset.sv; simBuild(); simKeep(); return; }
    // 같은 조각이 두 번 나오는 길(Take the first right. Then take the first right.)도 있어서, 누를 때마다 줄 끝에 더해요. 빼기는 ‘하나 지우기’
    if (b.dataset.sk != null) { SIM.line.push(SIM.chips[+b.dataset.sk]); simBuild(); simKeep(); return; }
    if (b.dataset.rp) { simAnswer({ f: b.dataset.rp }); simKeep(); return; }
    if (b.id === 'simSay') { simSayChips(); simKeep(); return; }
    if (b.id === 'simClear') { if (SIM.steps[SIM.i] === 'dir') SIM.line.pop(); else { SIM.g = null; SIM.f = null; SIM.v = null; } simBuild(); simKeep(); return; }
    if (b.id === 'simMic') { simMic(); return; }
    if (b.dataset.simline) { simAsk(null, false); return; }
    if (b.dataset.act === 'play') { if (SIM.mode === 'play' && DRV.busy()) DRV.stop(); else simAsk(null, false); return; }
    if (b.dataset.act === 'slowplay') { if (SIM.mode === 'slowplay' && DRV.busy()) DRV.stop(); else simAsk(null, true); return; }
    if (b.dataset.act === 'script') { SIM.script = !SIM.script; simBuild(); simKeep(); }
  });
  $('sim').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target === mc && SIM.steps[SIM.i] === 'map') return;   // 지도 차례의 화살표 · Enter는 지도가 받아요
    const k = e.key.toUpperCase(), onBtn = e.target.closest && e.target.closest('button');
    if (!SIM.started) { if (e.key === 'Enter' && !onBtn) { e.preventDefault(); $('simGo').click(); } return; }
    if (SIM.done) { if (k === 'N' || (e.key === 'Enter' && !onBtn)) { e.preventDefault(); $('simAgain').click(); } return; }
    const st = SIM.steps[SIM.i], n = '123456789'.indexOf(e.key), sv = 'ABC'.indexOf(k), isOpen = st === 'open' || st === 'open1';
    if (st === 'map') {
      if (['ARROWRIGHT', 'ARROWLEFT', 'ARROWUP', 'ARROWDOWN', 'ENTER'].includes(k) && !onBtn) { e.preventDefault(); mc.focus(); mc.dispatchEvent(new KeyboardEvent('keydown', { key: e.key })); }
      else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
      return;
    }
    if (st === 'dir') {
      if (n >= 0 && n < SIM.chips.length) { e.preventDefault(); SIM.line.push(SIM.chips[n]); simBuild(); simKeep(); return; }
      const rq = 'QWE'.indexOf(k); if (rq >= 0) { e.preventDefault(); simAnswer({ f: ['rp_again', SIM.card.mode === 'bus' ? 'rp_bus' : 'rp_lr', 'rp_map'][rq] }); simKeep(); return; }
    } else {
      if (isOpen && n >= 4 && n <= 7) { e.preventDefault(); SIM.g = DR.GREETS[n - 4]; simBuild(); simKeep(); return; }
      if (n >= 0 && n < SIM.frames.length && n < 4) { e.preventDefault(); SIM.f = SIM.frames[n]; SIM.v = null; simBuild(); simKeep(); return; }
      if (sv >= 0 && SIM.f && DR.FRAME[SIM.f].slot && SIM.places[sv] != null) { e.preventDefault(); SIM.v = SIM.places[sv]; simBuild(); simKeep(); return; }
    }
    if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simSayChips(); simKeep(); }
    else if (e.key === 'Backspace') { e.preventDefault(); if (st === 'dir') SIM.line.pop(); else { SIM.g = null; SIM.f = null; SIM.v = null; } simBuild(); simKeep(); }
    else if (k === 'R' && DRV.supported) { e.preventDefault(); simAsk(null, false); }
    else if (k === 'S' && DRV.supported) { e.preventDefault(); simAsk(null, true); }
    else if (k === 'T' && DRV.supported) { e.preventDefault(); SIM.script = !SIM.script; simBuild(); simKeep(); }
    else if (k === 'M' && SRC) { e.preventDefault(); simMic(); }
    else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
  });
  // 지도 옆 이름표 (아이콘 + 이름) — 가려는 곳은 이름 없이
  $('simLegend').innerHTML = DR.MARKS.map(id => `<li>${PI(DR.SPOT[id].icon)}<span lang="en">${esc(DR.SPOT[id].en)}</span></li>`).join('') + '<li><i class="lg-bus">BUS</i>버스 정류장</li><li><i class="lg-light"></i>신호등 · 횡단보도</li><li><i class="lg-plain"></i>이름 없는 건물</li>';
  new ResizeObserver(() => simMapDraw()).observe(mc);
  simNew(); SIM.started = false; simBuild();
}

/* =========================================================
   11. 길 묻기 표현 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 숫자는 15든 fifteen이든 같은 숫자로 맞춰요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = DR.PLACES.map(p => ({ p, rows: DR.SHADOW.map((s, i) => [s, i]).filter(([s]) => s.place === p.id) })).filter(g => g.rows.length);
  $('shList').innerHTML = groups.map(({ p, rows }) => `<section class="sh-grp"><h3>${PI(p.id)}${esc(p.ko)} <span lang="en">${esc(p.en)}</span></h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${DRV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-who ${s.who}">${s.who === 'me' ? '나' : '상대'}</span><span class="sh-en" lang="en">${esc(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { const s = DR.SHADOW[i]; return [{ text: s.en, sp: s.sp }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = DR.SHADOW[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, DR.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.words.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.t)}</span>`).join(' ');
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
  catch (e) { shResult(i, `<p class="sh-err">${esc(e && e.name === 'NotAllowedError' ? '마이크를 쓸 수 없어요. 브라우저 설정에서 이 페이지의 마이크를 허락해 주세요.' : e && e.name === 'NotFoundError' ? '마이크를 찾지 못했어요. 마이크가 연결되어 있는지 확인해 주세요.' : '녹음을 시작하지 못했어요.')}</p>`); return; }
  let mr; try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(t => t.stop()); shResult(i, '<p class="sh-err">녹음을 시작하지 못했어요.</p>'); return; }
  const chunks = [];
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => {
    clearTimeout(SHREC.tm); stream.getTracks().forEach(t => t.stop()); if (SHREC.rec === mr) SHREC.rec = null; shMicState(i, false);
    if (!chunks.length) { shResult(i, '<p class="sh-err">녹음된 소리가 없어요. 다시 해 보세요.</p>'); return; }
    if (SHREC.url[i]) URL.revokeObjectURL(SHREC.url[i]);
    SHREC.url[i] = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${DRV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
    shPlayMine(i, true);
  };
  SHREC.rec = mr; mr.start(); shMicState(i, true);
  shResult(i, '<span class="note">녹음 중이에요. 다 말했으면 ‘멈추기’를 눌러요(6초가 지나면 저절로 멈춰요).</span>');
  SHREC.tm = setTimeout(() => { if (SHREC.rec === mr) { SHREC.rec = null; try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 6000);
}
function shPlayMine(i, thenOrig) {
  stopSounds(); NARR.reset(); if (playing) pause();
  const url = SHREC.url[i]; if (!url) return;
  const a = new Audio(url); audioEl = a;
  const b = document.querySelector(`.sh-row[data-i="${i}"] [data-mine]`); if (b) b.classList.add('saying');
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (b) b.classList.remove('saying'); if (thenOrig && DRV.supported) speak(shSeq(i)); };
  a.play().catch(() => { audioEl = null; if (b) b.classList.remove('saying'); });
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
   12. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 그림 문제는 지도(규칙 엔진의 계산)
   ========================================================= */
const QCOL = { bg: '#10151C', p: '#FFC15E', bad: '#FF8E8E', hover: '#6EC8FF' };
const qLetter = (g, x, y, k) => { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill(); g.font = `700 12px ${F.FB}, sans-serif`; g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCDE'[k], x, y + 1); };
const QM = { ox: 70, oy: 70, s: 150 }, QW = 600, QH = 440;
// 지도 + 후보(자리 넷) — 고르면 그 자리를 칠해요
function mapFig(label, cands, o = {}) {
  return { width: QW, height: QH, label,
    pick: (x, y) => cands.findIndex(id => { const b = DRS.lotRect(QM, id); return x >= b.x - 5 && x <= b.x + b.w + 5 && y >= b.y - 5 && y <= b.y + b.h + 5; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, QW, QH);
      const hl = {}; cands.forEach((id, i) => { hl[id] = st.done && i === st.answer ? QCOL.p : st.done && i === st.pick ? QCOL.bad : st.hover === i ? QCOL.hover : null; if (!hl[id]) delete hl[id]; });
      DRS.draw.town(g, QM, Object.assign({ hl }, o.town || {}));
      cands.forEach((id, i) => { const b = DRS.lotRect(QM, id); qLetter(g, b.cx, b.y - 8, i); });
      if (o.after) o.after(g, st);
    } };
}
// 지도 + 길 갈래 (교차점에서 나가는 화살표 A~D). list = [[교차점, 방향], …]
function turnFig(label, list, o = {}) {
  const base = I => DRS.TP(QM, I[0], I[1]), tip = ([I, d]) => { const [x, y] = base(I), v = DR.DIRV[d]; return [x + v[0] * QM.s * 0.42, y + v[1] * QM.s * 0.42]; };
  return { width: QW, height: QH, label,
    pick: (x, y) => list.findIndex(it => { const [a, b] = tip(it); return Math.hypot(x - a, y - b) < 30; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, QW, QH);
      DRS.draw.town(g, QM, Object.assign({ walker: o.walker }, o.town || {}));
      list.forEach((it, i) => {
        const [x0, y0] = base(it[0]), [a, b] = tip(it), c = st.done && i === st.answer ? QCOL.p : st.done && i === st.pick ? QCOL.bad : st.hover === i ? QCOL.hover : 'rgba(238,241,244,0.8)';
        DRS.draw.arrow(g, x0 + (a - x0) * 0.25, y0 + (b - y0) * 0.25, a, b, c, 4);
        qLetter(g, a + DR.DIRV[it[1]][0] * 16, b + DR.DIRV[it[1]][1] * 16, i);
      });
    } };
}
const QS = (() => {
  const o = DR.o, j = (q, a, c) => DR.judge(q, a, c || {}).ok, D = DR.DEMO, DC = DR.DEMO_CARD;
  const openers = [o('gr_none', null, o('ak_bare', 'trainstation')), o('gr_ex', null, o('ak_how', 'trainstation')), o('gr_hey', null, o('ak_where', 'trainstation')), o('gr_ex', null, o('ak_how', 'museum'))];
  const marts = [o('ak_near', 'mart'), o('ak_near', 'conv'), o('ak_near', 'pharmacy'), o('ak_near', 'supermarket')];
  const nq = DR.dirQ(D, 'nth'), nl = DR.modelLine(D, 'nth');
  const checks = [DR.Lr([{ k: 'twice', dir: 'left' }, { k: 'side', dir: 'right' }]), DR.Lr([nl[0], { k: 'side', dir: 'left' }]), DR.Lr(nl), DR.Lr([Object.assign({}, nl[0], { dir: 'right' }), { k: 'side', dir: 'right' }])];
  const locals = [o('th_bye'), o('th_why'), o('th_anyway'), o('th_welcome')];
  // 그림 3: 남쪽을 보고 선 사람 → turn left
  const outs3 = ['E', 'N', 'W', 'S'];
  // 그림 4: the second left (DEMO 출발, 동쪽) — A Hill St 북쪽 · B Bell St 북쪽 · C Bell St 남쪽 · D Lark St 북쪽
  const turns4 = [[[1, 1], 'N'], [[2, 1], 'N'], [[2, 1], 'S'], [[3, 1], 'N']];
  // 그림 6: 공원 맞은편 · 은행 바로 옆 → 후보 넷 (기차역 · 공원 맞은편이지만 은행 옆이 아님 · 은행 맞은편 · 호텔)
  const c6 = ['b20nw', 'b11nw', DR.lotOfSpot('trainstation'), DR.lotOfSpot('police')];
  // 그림 10: 데모 길 → 도착하는 건물
  const c10 = [DR.lotOfSpot('trainstation'), DR.lotOfSpot('museum'), 'b20nw', 'b21w'];
  const q = [
    { q: '기차역 가는 길을 물으려 해요. 지나가는 사람에게 가장 알맞은 첫마디는?', opts: openers.map(DR.text), a: 1,
      why: '모르는 사람에게는 Excuse me부터, 그리고 묻는 틀 + 곳 이름 → Could you tell me how to get to the train station? Where is train station?은 Excuse me 없이 바로 묻는 데다 the도 빠져서 퉁명스럽게 들려요. Hey!는 친구를 부르는 말 같고, museum은 가려는 곳이 아니에요.',
      check: () => openers.map(a => j('gr_cue', a, { place: 'trainstation' })).join() === 'false,true,false,false' },
    { q: '마트(슈퍼마켓)를 찾아요. Is there ___ near here? 빈칸에 가장 알맞은 말은?', opts: marts.map(a => DR.text(a).replace(/^Is there | near here\?$/g, '')), a: 3,
      why: '마트 → a supermarket · a grocery store. mart는 가게 이름에 붙는 말이라 혼자 쓰면 헷갈리고, a convenience는 ‘편리함’이라는 뜻이라 가게로 알아듣기 어려워요. a pharmacy는 약국이에요.',
      check: () => marts.map(a => j('ak_yes', a, { place: 'supermarket' })).join() === 'false,false,false,true' },
    { q: '그림의 사람은 남쪽(화면 아래)을 보고 서 있어요. “Turn left.”를 들으면 어느 길로 가나요? 그림의 화살표를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 0,
      figure: turnFig('지도의 교차점. 사람은 남쪽을 보고 서 있고, 화살표 A 동쪽(화면 오른쪽), B 북쪽, C 서쪽(화면 왼쪽), D 남쪽', outs3.map(d => [[2, 1], d]), { walker: { p: [2, 0.62], h: 'S' }, town: { labels: ['bank', 'hotel'] } }),
      why: 'left · right는 화면이 아니라 걷는 사람이 바라보는 쪽이 기준이에요. 남쪽을 보고 서서 왼쪽으로 돌면 동쪽(화면의 오른쪽)으로 가요.',
      check: () => DR.LEFT.S === 'E' && outs3[0] === 'E' },
    { q: '그림의 사람(화살표)이 “Go down this street and take the second left.”를 들었어요. 어느 길로 들어설까요? 그림의 화살표를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: turnFig('지도. 사람은 Main Street에서 동쪽을 보고 서 있어요. A Hill Street로 북쪽, B Bell Street로 북쪽(은행 모퉁이), C Bell Street로 남쪽, D Lark Street로 북쪽', turns4, { walker: { p: DR.segPoint(DR.DEMO_START.key, DR.DEMO_START.t), h: 'E' }, town: { labels: ['bank'] } }),
      why: 'the second left → 두 번째로 나오는 왼쪽 길로 한 번 돌아요. 첫 번째 왼쪽 길은 Hill Street, 두 번째는 Bell Street(은행 모퉁이)예요. turn left twice(왼쪽으로 두 번)와 달라요.',
      check: () => { const r = DR.applyMoves(DR.DEMO_START, [{ k: 'turn', dir: 'left', nth: 2 }]); const I = r.pts[r.pts.length - 2]; return r.ok && I[0] === turns4[1][0][0] && I[1] === turns4[1][0][1] && r.h === turns4[1][1]; } },
    { q: '“It\'s on your left.”의 뜻은?', opts: ['왼쪽으로 도세요.', '왼쪽으로 두 번 도세요.', '왼쪽 길 건너편이에요.', '(걷다 보면) 왼쪽에 있어요.'], a: 3,
      why: 'on your left → 왼쪽에 있는 위치. turn left → 왼쪽으로 도는 동작. 되짚을 때도 마지막 조각은 → and it\'s on my left?',
      check: () => DR.chunkKo({ k: 'side', dir: 'left' }) === '왼쪽에 있음' && DR.checkBack(D, [{ k: 'turn', dir: 'left', lm: 'bank' }, { k: 'turn', dir: 'right' }]).err.type === 'turnVsOn' },
    { q: '“It\'s across from the park, next to the bank.” 어느 건물일까요? 그림의 건물을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: mapFig('지도. 공원과 은행에 이름이 있어요. A Bell Street 동쪽 위 건물, B Main Street 남쪽 모퉁이 건물(Hill Street 쪽), C Bell Street 동쪽 가운데 건물, D 은행 맞은편 모퉁이 건물', c6, { town: { labels: ['park', 'bank'] } }),
      why: 'across from the park → 공원 맞은편(길 건너) · next to the bank → 은행 바로 옆. 둘 다 맞는 건물은 C 하나예요(규칙 엔진 DR.where의 계산). A도 공원 맞은편이지만 은행 바로 옆은 아니에요.',
      check: () => c6.map(id => DR.where(id, 'park') === 'across' && DR.where(id, 'bank') === 'next').join() === 'false,false,true,false' },
    { q: '“Take the number fifteen bus.”라고 들었어요. 몇 번 버스인가요?', opts: ['15번', '50번', '5번', '16번'], a: 0,
      why: 'fifteen → 15(뒤 TEEN을 세게), fifty → 50(앞 FIF를 세게). 헷갈리면 되짚어요 → So, the number fifteen? One-five?',
      check: () => DR.canon('fifteen').includes('15') && DR.canon('one five').includes('15') && DR.canon('fifty').includes('50') },
    { q: `“${DR.say(D, 'nth')}” 가장 알맞은 되짚기는?`, opts: checks.map(DR.text), a: 2,
      why: 'the second left → 두 번째 왼쪽 길로 한 번(turn left twice ×), 도착 → on your right → my right로. 틀린 조각이 있으면 상대가 그 조각만 고쳐 줘요.',
      check: () => checks.map(a => j(nq, a, DC)).join() === 'false,false,true,false' },
    { q: 'Sorry, I\'m not from around here. — 가장 알맞은 대답은?', opts: locals.map(DR.text), a: 2,
      why: '모른다고 해도 시간을 내 준 사람이에요 → That\'s okay. Thanks anyway. Okay. Bye.는 무뚝뚝하고, Why not?은 따지는 말이에요. You\'re welcome은 고맙다는 말을 들었을 때 하는 대답이에요.',
      check: () => locals.map(a => j('th_local', a)).join() === 'false,false,true,false' },
    { q: `그림의 사람(화살표)이 들은 길 → “${DR.say(D, 'blocks', { open: '', dist: false }).replace('across from the park', 'next to the bank')}” 도착하는 건물은? 그림의 건물을 누르거나 단추를 고르세요.`, opts: ['A', 'B', 'C', 'D'], a: 0,
      figure: mapFig('지도. 사람은 Main Street에서 동쪽을 보고 서 있어요. 은행에 이름이 있어요. A Bell Street 동쪽 가운데, B Bell Street 서쪽 아래, C Bell Street 동쪽 위, D Bell Street 동쪽 아래', c10, { town: { walker: { p: DR.segPoint(DR.DEMO_START.key, DR.DEMO_START.t), h: 'E' }, labels: ['bank'] } }),
      why: '두 블록 → 은행에서 왼쪽(북쪽으로) → 오른쪽에 있고 은행 바로 옆 → A. 오른쪽으로 돌면 B 쪽으로 가요. 걷는 길은 규칙 엔진(DR.route)이 계산해요.',
      check: () => DR.lotOfSpot(D.dest) === c10[0] && D.arrive.side === 'right' && DR.where(D.dest, 'bank') === 'next' && DR.where(c10[2], 'bank') !== 'next' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[길 묻기] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { if (x.a < 4) pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[길 묻기] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { DRV.stop(); stopAudio(); stopListening(); }, true);
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = DRS.chapterAt(T);
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
// 화면 누르기: 말풍선은 그 사람 목소리로, 영어 칩은 발음 듣기, 단계 그림은 고르기, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * DRS.W, (e.clientY - r.top) / r.height * DRS.H]; };
const hitAt = (x, y) => started ? DRS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.stop != null) { S.stop = S.stop === h.stop ? null : h.stop; relab(); }
  else if (h && h.play && DRV.supported) speak(h.play);
  else if (h && h.say && EN.say.supported) { stopSounds(); if (playing) pause(); EN.say(DR.spoken(h.say)); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.stop != null ? '눌러서 이 단계의 말 보기' : h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

EN.say.wire(document, { before() { DRV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = DRV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
simInit();
shInit();
DDrill($('drillRoot'), DR.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 열쇠 낱말 → 틀 + 내 정보 → 공손하게, 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 03 · 06 · 08장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '말 걸기부터 되짚기까지 모두 익숙해졌네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(DRS.baseText()).then(() => { dirty = true; simMapDraw(); });
setTimeout(() => DRS.collectText(text => loadFonts(text).then(() => { dirty = true; simMapDraw(); }), 8), 400);
requestAnimationFrame(loop);
})();
