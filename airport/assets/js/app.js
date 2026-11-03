/* 공항 회화 — 플레이어, 직접 해 보기, 입국 심사 시뮬레이터, 따라 말하기, 듣고 대답 고르기, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(AP), 그림은 scenes.js(APS), 목소리는 voices.js(APV)가 맡습니다.
 * 소리가 겹치지 않게: 대화를 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(APV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const AP = window.AP, APS = window.APS, APV = window.APV, S = APS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = APS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cv = $('cv'), ctx = cv.getContext('2d');
AP.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = APS.fonts;
const FONT_SET = [[700, F.FD], [800, F.FD], [400, F.FB], [500, F.FB], [600, F.FB], [700, F.FB], [400, F.FM], [500, F.FM], [700, F.FM], [800, F.FM]];
const loadFonts = text => Promise.race([
  Promise.all(FONT_SET.map(([w, f]) => document.fonts.load(`${w} 20px ${f}`, text).catch(() => null))),
  new Promise(r => setTimeout(r, 15000)),
]).then(() => document.fonts.ready);

/* =========================================================
   2. 영상 추출 — 사이트 공통 렌더러가 쓰는 약속
   ========================================================= */
if (EXPORT) {
  cv.width = 1920; cv.height = 1080;
  const ready = new Promise(res => APS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '공항, 질문은 정해져 있다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { APS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  script: '<svg data-k="script" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>',
  mic: APS.iconSVG('mic'),
};
const PI = id => APS.iconSVG(id, 'pi');   // 곳 아이콘
// 듣기 · 천천히 · 대본 보기 단추 묶음 (T15 · T16과 같은 모양 · 같은 키 R · S · T)
const lsnBar = scriptOn => APV.supported
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
  const cap = started ? APS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 말풍선을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = APS.chapterAt(T);
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
  if (dirty) { dirty = false; APS.render(ctx, started ? T : POSTER); }
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
function stopSounds() { EN.say.stop(); APV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return APV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름
const lpBtn = (seq, label, cls = '') => APV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-lp]');
  if (!b) return;
  const box = b.closest('[data-slow]'), slow = !!box && box.getAttribute('data-slow') === '1';
  document.querySelectorAll('.lp-play.saying').forEach(x => x.classList.remove('saying'));
  b.classList.add('saying');
  speak(SEQS[+b.dataset.lp], { slow, onend() { b.classList.remove('saying'); } });
});
const staffSeq = q => [{ text: q.en, sp: q.sp, rate: q.fast ? 1.35 : 1 }];
const meSeq = a => [{ text: typeof a === 'string' ? a : AP.text(a), sp: 'me' }];

/* =========================================================
   5. 글 칠하기 — 가려진 직원 말(marks만 드러남)과 보기의 역할 색
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
// 대답 → 역할 색 HTML (틀 노랑 · 칸 민트 · 공손한 말 보라)
const segHTML = (a, on = true) => AP.segs(a).map(s => on && s.t.trim() && /[A-Za-z0-9]/.test(s.t) ? `<mark class="mk-${s.r}">${esc(s.t)}</mark>` : esc(s.t)).join('');

/* =========================================================
   6. 듣고 대답 고르기 (이 튜토리얼 전용) — 직원 말은 소리 먼저, 대답 넷은 글
   생김새와 키보드는 공통 부품 EN.drill과 같게: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본 · Enter/→ 다음
   ========================================================= */
function ADrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null;
  const compact = !!cfg.compact, hear = APV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && APV.busy()) { APV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(staffSeq(it.Q), { slow: !!slow, onitem() { paintNow(root, '.ldr-q'); say(it.Q.fast ? '직원이 빠르게 말하는 중' : '직원이 말하는 중'); },
      onend(stopped) { mode = null; paintPlay(root, null); paintNow(root, null); say(stopped ? '' : '다 들었어요. 대답을 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { APV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; APV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    APV.stop();
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = AP.steps(it), place = AP.PLACE[it.place];
    const marks = []; steps.slice(0, done ? 3 : s.hints).reverse().forEach(x => marks.push(...x.marks));   // 뒤 단계의 색이 앞 단계를 덮음
    const reveal = done || !hear || s.script, mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur), ask = AP.ASK[AP.INTENT[it.Q.intent].ask].ko;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${PI(it.place)}${esc(place.ko)}</span><span>${compact ? '듣고 대답 고르기' : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span>${done ? `<span class="edr-tag">${it.Q.fast ? '다시 묻기' : esc(ask)}</span>` : ''}</p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(it.sit)}</p>`;
    h += lsnBar(done ? null : s.script);
    h += `<p class="ldr-q"><b>직원</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="q" aria-label="직원 말 다시 듣기" title="직원 말 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.Q.en, mk('q'), reveal)}</span>${it.Q.fast && !done ? '<small class="adr-fast">아주 빠르게</small>' : ''}</p>`;
    h += `<p class="adr-ask">나의 대답은?</p><div class="ldr-opts" role="group" aria-label="대답 보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '', t = AP.text(op);
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-lp="${seqId(meSeq(t))}" aria-label="(${L4[k]}) 듣기" title="(${L4[k]}) 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(t, mk(k), true)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + AP.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = [[`직원 · ${it.Q.en}`, it.Q.ko, staffSeq(it.Q)]].concat(it.opts.map((op, k) => [`(${L4[k]}) ${AP.text(op)}`, AP.ko(op), meSeq(op)]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      h += `<div class="edr-acts">${hear ? `<button type="button" class="edr-btn ghost adr-ex" data-lp="${seqId(staffSeq(it.Q).concat([{ text: AP.text(it.opts[it.a]), sp: 'me', gap: 0.5 }]))}">${ICO.play} 대화 듣기 (직원 → 나)</button>` : ''}${compact ? '' : `<button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button>`}</div>`;
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
const LAB = { req: { f: 'hp_could', v: null, need: 'blanket' }, num: { heard: null, score: [0, 0] }, sec: {}, imq: 0, bag: { words: [], with: null } };
// 06장 직접 해 보기: 질문 i의 대답 보기 (시뮬레이터와 같은 틀, 카드의 정보로 채움 · 정답 자리가 돌아가요)
function immigOpts(i) {
  const q = AP.Q[AP.IMMIG[i][0]], C = AP.DEMO, fr = AP.SIM_FRAMES[q.intent](C), k = i % fr.length;
  return fr.slice(k).concat(fr.slice(0, k)).map(f => { const Fm = AP.FRAME[f]; return Fm.slot ? { f, v: String(C[AP.SLOT[Fm.slot].key] != null ? C[AP.SLOT[Fm.slot].key] : Object.keys(AP.SLOT[Fm.slot].vals)[0]) } : { f }; });
}
const LABS = {
  intro: () => `${labHead('먼저 대답해 보세요')}${mini('intro')}
    <p class="note">입국 심사관의 질문을 듣고 대답을 고르세요. 직원의 말은 답한 뒤에 글로 보여요. 막히면 힌트(H)로 3단계를 하나씩 열어 보세요.</p>`,
  route: () => {
    const i = S.stop, p = i != null ? AP.PLACES[i] : null;
    return `${labHead('곳을 골라 질문 듣기')}
      ${seg('곳', AP.PLACES.map((x, k) => [k, `${PI(x.id)}${esc(x.ko)}`]), i == null ? '' : i, 'stop')}
      ${p ? `<ul class="qlist">${AP.ROUTE[p.id].map(id => { const q = AP.Q[id]; return `<li>${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span><span lang="en">${lineHTML(q.en, q.key.map(t => ({ t, role: 'key' })), true)}</span><small>${esc(q.ko)}</small></span></li>`; }).join('')}</ul>
        <button class="btn ghost" type="button" id="labClear">영상대로 보기</button>` : '<p class="note">곳을 고르면 그곳에서 자주 듣는 질문을 들을 수 있고, 영상 화면의 지도에도 표시돼요. 하늘색 → 열쇠 낱말.</p>'}`;
  },
  checkin: () => {
    const P = S.pass ? AP.PASS.find(x => x.id === S.pass) : null;
    return `${labHead('탑승권 칸 눌러 보기')}
      ${seg('탑승권 칸', AP.PASS.map(x => [x.id, `<span lang="en">${x.en}</span>`]), S.pass || '', 'pass')}
      ${P ? `<p class="enline">${lpBtn([{ text: P.say, sp: 'gb' }], '듣기: ' + P.say)}<span lang="en">${esc(P.en)} ${esc(P.v)}</span></p><p class="note">${esc(P.ko)}</p>` : '<p class="note">칸을 누르면 영상 속 탑승권에 표시되고, 영어로 읽어 줘요.</p>'}
      <h3 class="mt">탑승구에는 늦어도 언제까지 가야 할까요?</h3>
      <div class="mo" id="passQ"><button type="button" data-time="boarding">10:20 (BOARDING)</button><button type="button" data-time="depart">10:50 (DEPARTS)</button></div>
      <p class="mr" id="passA" role="status"></p>`;
  },
  security: () => `${labHead('지시를 듣고 할 일 고르기')}
    <ol class="ox">${AP.SEC.map((x, i) => { const q = AP.Q[x.q], pick = LAB.sec[i]; return `<li data-sec="${i}">${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span class="ox-t" lang="en">${lineHTML(q.en, q.key.map(t => ({ t, role: 'key' })), true)}</span>
      <span class="mo">${Object.entries(AP.ACTS).map(([k, t]) => `<button type="button" data-act2="${k}" class="${pick === k ? (k === x.act ? 'right' : 'wrong') : ''}">${t}</button>`).join('')}</span>
      <span class="mr" role="status">${pick ? (pick === x.act ? `맞혔어요 — ${esc(x.ko)} 대답은 ${esc(AP.text({ f: 'or_ok' }))} (${esc(AP.judge(x.q, { f: 'or_ok' }, {}).why)})` : '다시 들어 보세요. 동사(take out · take off · step)가 할 일을 알려 줘요.') : ''}</span></li>`; }).join('')}</ol>
    <p class="note">보안 검색의 지시는 동사로 시작하는 명령문이에요. Please가 붙으면 공손한 말투예요. 대답은 Okay. 그리고 그대로 하기.</p>`,
  gate: () => {
    const i = S.num == null ? 2 : S.num, [a, b] = AP.NUMS[i], h = LAB.num;
    return `${labHead('-teen이냐 -ty냐 듣고 고르기')}
      ${seg('숫자 짝', AP.NUMS.map(([x, y], k) => [k, `${x} · ${y}`]), i, 'num')}
      <p class="note">짝을 고르면 영상 화면에 힘주는 곳이 그려져요. ‘듣기’를 누르면 둘 가운데 하나를 읽어요.</p>
      <div class="mo">${APV.supported ? '<button type="button" id="numPlay">듣기 (둘 중 하나)</button>' : ''}<button type="button" data-heard="${a}">${a} · ${AP.numWord(a)}</button><button type="button" data-heard="${b}">${b} · ${AP.numWord(b)}</button></div>
      <p class="mr" id="numA" role="status">${h.score[1] ? `맞힌 수 ${h.score[0]} / ${h.score[1]}` : ''}</p>`;
  },
  plane: () => {
    const r = LAB.req, a = r.v ? { f: r.f, v: r.v } : null, j = a ? AP.judge('pl_help', a, { need: r.need }, '상황') : null;
    return `${labHead('부탁하는 말 만들기')}
      <p class="note">상황: 승무원이 다가와 <span lang="en">Can I help you?</span> 하고 물어요. 지금 필요한 것 →</p>
      ${seg('필요한 것', Object.entries(AP.SLOT.need.vals).map(([k, v]) => [k, esc(v.ko)]), r.need, 'need')}
      <h3 class="mt">① 틀 고르기</h3>${seg('틀', AP.REQ_FRAMES.map(f => [f, `<span lang="en">${esc(AP.FRAME[f].t.replace(/[{}]/g, ''))}</span>`]), r.f, 'rf')}
      <h3 class="mt">② 칸 채우기</h3>${seg('칸', Object.entries(AP.SLOT.need.vals).map(([k, v]) => [k, `<span lang="en">${esc(v.t)}</span>`]), r.v || '', 'rv')}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p><p class="verdict"><b class="${j.ok ? 'c-ok' : 'c-no'}">${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + '에서 걸려요'}</b>${esc(j.why)}</p>` : '<p class="note">틀과 칸을 고르면 영상 화면에 문장이 만들어지고, 규칙 엔진이 3단계로 판정해요.</p>'}`;
  },
  immig: () => {
    const i = S.imq == null ? 0 : S.imq, [qid] = AP.IMMIG[i], q = AP.Q[qid], C = AP.DEMO;
    const fr = immigOpts(i);
    const cur = S.imAns ? AP.text(S.imAns) : null;
    return `${labHead('여행 카드 보고 대답하기')}
      <dl class="mcard">${AP.cardRows(C).slice(1).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${seg('질문', AP.IMMIG.map(([id], k) => [k, `<span lang="en">${esc(AP.Q[id].key[0])}</span>`]), S.imq == null ? '' : i, 'imq')}
      <p class="enline">${lpBtn(staffSeq(q), '질문 듣기')}<span lang="en">${lineHTML(q.en, q.key.map(t => ({ t, role: 'key' })), true)}</span></p>
      <div class="mo mo-col">${fr.map((a, k) => `<button type="button" data-ima="${k}" class="${cur === AP.text(a) ? (AP.judge(q, a, C).ok ? 'right' : 'wrong') : ''}"><span lang="en">${esc(AP.text(a))}</span></button>`).join('')}</div>
      ${S.imAns ? (() => { const j = AP.judge(q, S.imAns, C); return `<p class="verdict"><b class="${j.ok ? 'c-ok' : 'c-no'}">${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + '에서 걸려요'}</b>${esc(j.why)}</p>`; })() : '<p class="note">대답을 고르면 영상 화면에서도 판정을 볼 수 있어요.</p>'}`;
  },
  baggage: () => {
    const b = LAB.bag, has = b.words.length, ord = has ? AP.bagOrder(b.words) : null;
    const chips = Object.entries(AP.BAG_CHIPS).filter(([k]) => k !== 'with').map(([c, ws]) => `<div class="cv-row"><span class="cv-lab">${esc(AP.CAT[c].ko)}</span><div class="seg">${ws.map(w => `<button type="button" data-bw="${w}" aria-pressed="${b.words.includes(w)}"><span lang="en">${w}</span> <small>${esc(AP.ADJ[w].ko)}</small></button>`).join('')}</div></div>`).join('');
    return `${labHead('가방 묘사 만들기')}
      <p class="note">낱말을 누르는 차례대로 문장이 만들어져요. 일부러 순서를 바꿔 눌러 보세요.</p>
      ${chips}
      <div class="cv-row"><span class="cv-lab">with 특징</span><div class="seg">${AP.BAG_CHIPS.with.map(w => `<button type="button" data-bwith="${w}" aria-pressed="${b.with === w}"><span lang="en">${esc(AP.WITH[w].t)}</span></button>`).join('')}</div></div>
      ${has ? `<p class="enline">${lpBtn(meSeq({ f: 'ds', bag: b }), '듣기')}<span lang="en">${segHTML({ f: 'ds', bag: b })}</span></p><p class="verdict"><b class="${ord.ok ? 'c-ok' : 'c-no'}">${ord.ok ? '자연스러워요' : '② 순서'}</b>${esc(ord.why)}</p>` : ''}
      <button class="btn ghost" type="button" id="bagClear">처음부터</button>
      <p class="note">순서 규칙은 시험 문법이 아니라 말할 때 자연스러운 차례를 단순하게 줄인 거예요(크기 → 색 → 재료 → 물건).</p>`;
  },
  customs: () => `${labHead('못 알아들었을 때')}${mini('repair')}
    <p class="note">빠른 말은 짐작하지 말고 다시 물어요. 두 번째도 빠르면 → <span lang="en">Could you speak more slowly, please?</span></p>
    <ul class="qlist">${AP.SCENE.repair.map(a => `<li>${lpBtn(meSeq(a), '듣기')}<span><span lang="en">${segHTML(a)}</span><small>${esc(AP.ko(a))}</small></span></li>`).join('')}</ul>`,
  method: () => {
    const i = S.place, row = i != null ? AP.METHOD[i] : null;
    return `${labHead('곳마다 3단계 적용해 보기')}
      ${seg('곳', AP.METHOD.map(([qid], k) => [k, `${PI(AP.Q[qid].place)}${esc(AP.PLACE[AP.Q[qid].place].ko)}`]), i == null ? '' : i, 'place')}
      ${row ? (() => { const [qid, a, c] = row, q = AP.Q[qid], j = AP.judge(q, a, c); return `<p class="enline">${lpBtn(staffSeq(q), '듣기')}<span lang="en">${lineHTML(q.en, q.key.map(t => ({ t, role: 'key' })), true)}</span></p>
        <ol class="edr-steps"><li><b>① 열쇠 낱말</b> ${esc(q.key.join(' … '))} → ${esc(AP.sayOf(q.intent))}</li><li><b>② 틀 + 내 정보</b> <span lang="en">${segHTML(a)}</span> ${esc(AP.ko(a))}</li><li><b>③ 공손하게</b> ${esc(j.why)}</li></ol>
        <p class="enline">${lpBtn(staffSeq(q).concat([{ text: AP.text(a), sp: 'me', gap: 0.5 }]), '대화 듣기')}<span>대화 듣기</span></p>
        <button class="btn ghost" type="button" id="labClear">영상대로 보기</button>`; })() : '<p class="note">곳을 고르면 영상 화면의 그 줄이 켜지고, 세 단계를 글로 보여 줘요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>대화 골라 보기</h3>
    <div class="seg">${APS.PSEG.map((t, i) => `<button type="button" data-seek="${t + 0.4}">대화 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 해 보고 싶다면 아래 <a href="#playground">입국 심사 시뮬레이터</a>에서 내 카드로 대답해 보세요. 카드는 누를 때마다 새로 만들어져요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">입국 심사 시뮬레이터</a> — 여행 카드로 심사관에게 대답하기</li><li><a href="#shadow">공항 표현 따라 말하기</a> — ${AP.SHADOW.length}문장 듣고 따라 하기</li>
    <li><a href="#drill">듣고 대답 고르기</a> — 일곱 곳 ${AP.DRILL.length}문제, 3단계 힌트</li><li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.querySelectorAll('.lmini').forEach(m => ADrill(m, [AP.MINI[m.dataset.mini]], { compact: true, onAnswer() { if (playing) pause(); } }));
}
function showAt(u) { const ch = CHAPTERS[APS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const relab = () => { touch(); buildLab(APS.chapterAt(T)); };
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  const d = b.dataset;
  if (d.seek) { seek(CHAPTERS[APS.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') { S.stop = null; S.place = null; relab(); return; }
  if (d.stop != null) { S.stop = d.stop === '' ? null : +d.stop; showAt(12.6); relab(); return; }
  if (d.pass != null) { S.pass = d.pass || null; showAt(17.8); relab(); const P = AP.PASS.find(x => x.id === S.pass); if (P) speak([{ text: P.say, sp: 'gb' }]); return; }
  if (d.time) { const ok = d.time === 'boarding', P = AP.PASS.find(x => x.id === d.time); b.parentNode.querySelectorAll('button').forEach(x => x.classList.remove('right', 'wrong')); b.classList.add(ok ? 'right' : 'wrong'); $('passA').textContent = `${ok ? '맞혔어요' : '다시 보세요'} — ${P.ko}${ok ? '' : ' 탑승은 출발보다 먼저 시작하고 먼저 끝나요.'}`; S.pass = d.time; showAt(23.4); touch(); return; }
  if (d.act2) { const li = b.closest('li'), i = +li.dataset.sec; LAB.sec[i] = d.act2; S.sec = i; showAt(13.2); relab(); return; }
  if (d.num != null) { S.num = +d.num; LAB.num.heard = null; showAt(12.8); relab(); return; }
  if (b.id === 'numPlay') { const [a, c] = AP.NUMS[S.num == null ? 2 : S.num]; LAB.num.heard = Math.random() < 0.5 ? a : c; speak([{ text: 'Gate ' + AP.numWord(LAB.num.heard) + '.', sp: 'gb' }]); $('numA').textContent = '들었으면 숫자를 고르세요.'; return; }
  if (d.heard) {
    const h = LAB.num, pick = +d.heard;
    if (h.heard == null) { $('numA').textContent = APV.supported ? '먼저 ‘듣기’를 눌러 숫자를 들어 보세요.' : AP.judgeNum(pick, pick).why; return; }
    const j = AP.judgeNum(h.heard, pick); h.score[1]++; if (j.ok) h.score[0]++;
    $('numA').textContent = `${j.ok ? '맞혔어요' : '다시 들어 보세요'} — ${j.why} 맞힌 수 ${h.score[0]} / ${h.score[1]}`; h.heard = null; if (playing) pause(); return;
  }
  if (d.need) { LAB.req.need = d.need; if (LAB.req.v) S.req = { f: LAB.req.f, v: LAB.req.v, need: d.need }; showAt(12.2); relab(); return; }
  if (d.rf) { LAB.req.f = d.rf; if (LAB.req.v) S.req = { f: d.rf, v: LAB.req.v, need: LAB.req.need }; showAt(12.2); relab(); return; }
  if (d.rv) { LAB.req.v = d.rv; S.req = { f: LAB.req.f, v: d.rv, need: LAB.req.need }; showAt(12.2); relab(); return; }
  if (d.imq != null) { S.imq = +d.imq; S.imAns = null; showAt(6.4); relab(); return; }
  if (d.ima != null) {
    const i = S.imq == null ? 0 : S.imq;
    S.imq = i; S.imAns = immigOpts(i)[+d.ima];
    showAt(6.4); relab(); return;
  }
  if (d.bw) {
    const w = d.bw, B = LAB.bag, c = AP.ADJ[w].c;
    if (B.words.includes(w)) B.words = B.words.filter(x => x !== w);
    else { B.words = B.words.filter(x => AP.ADJ[x].c !== c || c === 'material'); B.words.push(w); }
    S.bag = B.words.length ? { words: B.words.slice(), with: B.with } : null; showAt(27); relab(); return;
  }
  if (d.bwith) { const B = LAB.bag; B.with = B.with === d.bwith ? null : d.bwith; S.bag = B.words.length ? { words: B.words.slice(), with: B.with } : null; showAt(27); relab(); return; }
  if (b.id === 'bagClear') { LAB.bag = { words: [], with: null }; S.bag = null; relab(); return; }
  if (d.place != null) { S.place = d.place === '' ? null : +d.place; showAt(18.6); relab(); }
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'], [/fif-TEEN/g, 'fifteen'], [/FIF-ty/g, 'fifty'],
    [/(\d{1,2}):(\d{2})/g, '$1시 $2분'], [/Flight 207/g, 'Flight two-oh-seven'], [/May 8\b/g, 'May eighth'], [/32A/g, '32 A'], [/\s\+\s/g, ', '], [/ = /g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   9. 음성 인식 · 녹음 (따라 말하기 · 시뮬레이터 말로 대답하기)
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
// 한 번 듣기: onText(글들), onFail(안내 글), onState(듣는 중?)
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
   10. 놀이터 — 입국 심사 시뮬레이터
   ========================================================= */
const SIM = { card: null, qs: [], i: 0, frames: [], slots: {}, f: null, v: null, log: [], started: false, script: !APV.supported, mode: null, react: null, why: null, done: false, listening: false, heard: null };
const simQ = () => AP.Q[SIM.qs[SIM.i]];
window.__simCard = () => Object.assign({}, SIM.card);   // 확인용(읽기만): 지금 여행 카드
function simNew() {
  APV.stop(); stopListening();
  SIM.card = AP.newCard(); SIM.qs = ['im_pass'].concat(shuffle(AP.SIM_QS).slice(0, 4)); SIM.i = 0; SIM.log = []; SIM.done = false; SIM.react = null; SIM.why = null; SIM.heard = null;
  simPrep(); simBuild();
}
function simPrep() {
  const q = simQ(), C = SIM.card;
  SIM.frames = shuffle(AP.SIM_FRAMES[q.intent](C)); SIM.slots = {};
  SIM.frames.forEach(f => { const Fm = AP.FRAME[f]; if (Fm.slot) SIM.slots[f] = AP.slotChoices(Fm.slot, C); });
  SIM.f = null; SIM.v = null;
  if (!SIM.log[SIM.i]) SIM.log[SIM.i] = { q: q.id, tries: [] };
}
function simSpeak(lines, o = {}) {
  const box = $('sim');
  speak(lines, { slow: !!o.slow, onitem() { paintNow(box, '.sim-bub'); }, onend() { SIM.mode = null; paintPlay(box, null); paintNow(box, null); } });
  SIM.mode = o.slow ? 'slowplay' : 'play'; paintPlay(box, SIM.mode);
}
function simAsk(prefix, slow) { const q = simQ(); simSpeak((prefix ? [{ text: prefix, sp: 'us' }] : []).concat([{ text: q.en, sp: 'us', gap: 0.5 }]), { slow }); }
function simAnswer(a, spoken) {
  if (SIM.done || !SIM.started) return;
  const q = simQ(), C = SIM.card, L = SIM.log[SIM.i];
  const j = spoken ? AP.matchSpoken(spoken, q, C) : AP.judge(q, a, C);
  const model = AP.model(q, C);
  SIM.heard = spoken || null;
  if (j.repair) { SIM.react = { en: 'Sure. ' + q.en, ko: '다시 물었어요. 심사관이 천천히 한 번 더 말해요.', st: 'repair' }; SIM.why = null; simBuild(); simSpeak([{ text: 'Sure.', sp: 'us' }, { text: q.en, sp: 'us', gap: 0.4 }], { slow: true }); return; }
  L.tries.push({ t: spoken ? `(말로) ${spoken}` : AP.text(a), ok: j.ok, stage: j.stage });
  SIM.why = { j, model, spoken: !!spoken };
  if (j.ok) {
    L.final = spoken || AP.text(a);
    const ok = AP.REACT.ok[(SIM.i + L.tries.length) % AP.REACT.ok.length];
    if (SIM.i + 1 >= SIM.qs.length) { SIM.done = true; SIM.react = { en: 'Welcome to Seattle. Enjoy your stay!', ko: '시애틀에 오신 걸 환영해요. 즐거운 여행 되세요!', st: 'ok' }; simBuild(); simSpeak([{ text: ok, sp: 'us' }, { text: 'Welcome to Seattle. Enjoy your stay!', sp: 'us', gap: 0.4 }]); return; }
    SIM.i++; simPrep();
    SIM.react = { en: ok, ko: '통과! 다음 질문이에요.', st: 'ok' };
    simBuild(); simAsk(ok);
  } else {
    const r = j.stage === 1 ? AP.REACT[1](q) : j.stage === 2 ? AP.REACT[2](q, j) : j.stage === 3 ? AP.REACT[3]() : { en: 'Sorry?', ko: '알아듣지 못했어요.' };
    SIM.react = Object.assign({ st: 'no' }, r); SIM.f = null; SIM.v = null;
    simBuild(); simSpeak([{ text: r.en, sp: 'us' }]);
  }
}
function simBuild() {
  const hear = APV.supported, C = SIM.card;
  $('simCard').innerHTML = `<p class="tc-head">${PI('immig')}<b>여행 카드</b> <span lang="en">TRAVEL CARD</span></p><dl>${AP.cardRows(C).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="tc-foot">도착: 시애틀 (SEA) · ${esc(AP.ARRIVE.ko)}</p>`;
  const prog = SIM.qs.map((id, k) => { const L = SIM.log[k], c = !L || !L.final ? (k === SIM.i && !SIM.done ? ' cur' : '') : L.tries[0] && L.tries[0].ok ? ' ok' : ' late'; return `<li class="${c}" title="${esc(AP.Q[id].key[0])}">${k + 1}</li>`; }).join('');
  $('simProg').innerHTML = prog;
  const box = $('simMain');
  if (!SIM.started) {
    box.innerHTML = `<div class="sim-start"><p>왼쪽 여행 카드가 오늘의 ‘나’예요. 심사관이 질문 다섯 개를 해요. 열쇠 낱말을 듣고, 대답 틀 칩을 고른 뒤 카드의 정보 칩을 넣어 대답해요${SRC ? ' — 마이크로 말해서 대답할 수도 있어요' : ''}.</p><button type="button" class="btn" id="simGo">심사 시작 (Enter)</button></div>`;
    return;
  }
  if (SIM.done) {
    const first = SIM.log.filter(L => L.tries[0] && L.tries[0].ok).length;
    box.innerHTML = `<div class="sim-end">${stampSVG()}<div><p class="sim-score"><b>${first} / ${SIM.qs.length}</b> 질문을 한 번에 통과했어요.</p>
      <p class="sim-react ok"><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>
      <ol class="sim-log">${SIM.log.map((L, k) => { const q = AP.Q[L.q]; return `<li><span class="who">심사관</span>${lpBtn(staffSeq(q), '듣기')}<span lang="en">${esc(q.en)}</span><br><span class="who me">나</span>${lpBtn(meSeq(L.final), '듣기')}<span lang="en">${esc(L.final)}</span>${L.tries.length > 1 ? ` <small>(${L.tries.length}번째에 통과)</small>` : ''}</li>`; }).join('')}</ol>
      <div class="tg-acts"><button type="button" class="btn" id="simAgain">새 카드로 다시 (N)</button>${hear ? `<button type="button" class="btn ghost" data-lp="${seqId(SIM.log.flatMap(L => staffSeq(AP.Q[L.q]).concat([{ text: L.final, sp: 'me', gap: 0.4 }])))}">대화 전체 듣기</button>` : ''}</div></div></div>`;
    return;
  }
  const q = simQ(), show = SIM.script || !hear;
  const fa = SIM.f ? { f: SIM.f, v: SIM.v } : null, Fm = SIM.f ? AP.FRAME[SIM.f] : null, ready = fa && (!Fm.slot || SIM.v);
  const chipT = f => esc(AP.FRAME[f].t.replace(/[{}]/g, '')).replace('___', '<i class="blank">___</i>');
  let h = `${lsnBar(SIM.script)}`;
  h += `<div class="sim-officer">${officerSVG()}<p class="sim-bub"><span class="ldr-t" lang="en">${lineHTML(q.en, show ? q.key.map(t => ({ t, role: 'key' })) : [], show)}</span>${hear ? `<button type="button" class="lp-play lp-mini" data-simline="1" aria-label="질문 다시 듣기" title="질문 다시 듣기">${SVG_PLAY}</button>` : ''}</p></div>`;
  if (SIM.react) h += `<p class="sim-react ${SIM.react.st}"><span class="who">심사관</span><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>`;
  h += `<p class="sim-lab">① 대답 틀 <small>1~${SIM.frames.length}</small></p><div class="chips" role="group" aria-label="대답 틀">${SIM.frames.map((f, k) => `<button type="button" class="chipf" data-sf="${f}" aria-pressed="${SIM.f === f}"><small>${k + 1}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}</div>`;
  if (Fm && Fm.slot) h += `<p class="sim-lab">② 내 정보 넣기 <small>A~C</small></p><div class="chips" role="group" aria-label="칸에 넣을 정보">${SIM.slots[SIM.f].map((v, k) => { const S0 = AP.SLOT[Fm.slot].vals[v]; return `<button type="button" class="chips-s" data-sv="${esc(v)}" aria-pressed="${SIM.v === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(S0[Fm.form || 't'])}</span></button>`; }).join('')}</div>`;
  h += `<div class="sim-ans"><span class="who me">나</span>${fa ? `<span lang="en" class="sim-line">${ready ? segHTML(fa) : chipT(SIM.f)}</span>` : '<span class="note">틀을 고르세요.</span>'}</div>`;
  h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${ready ? '' : ' disabled'}>대답하기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${fa ? '' : ' disabled'}>지우기</button>${SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 대답하기 (M)'}</button>` : ''}</div>`;
  if (SIM.heard) h += `<p class="note">들린 말: <span lang="en">${esc(SIM.heard)}</span></p>`;
  if (SIM.why) {
    const { j, model } = SIM.why, st = j.ok ? '통과' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸렸어요';
    h += `<div class="sim-why ${j.ok ? 'ok' : 'no'}"><p><b>${esc(st)}</b> ${esc(j.why)}</p>${j.ok ? '' : `<p>모범 대답 ${lpBtn(meSeq(model), '모범 대답 듣기')}<span lang="en">${segHTML(model)}</span> <small>${esc(AP.ko(model))}</small></p>`}${SIM.why.spoken ? '<p class="note">말로 한 대답은 낱말과 카드의 사실만 맞춰 봐요. 공손함과 발음은 판정하지 않아요.</p>' : ''}</div>`;
  }
  box.innerHTML = h;
  paintPlay($('sim'), SIM.mode);
}
const officerSVG = () => '<svg class="sim-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#202A36"/><ellipse cx="24" cy="47" rx="19" ry="14" fill="#2B3E63"/><circle cx="24" cy="21" r="8.5" fill="#D9A77E"/><rect x="14.5" y="10.5" width="19" height="6" rx="2" fill="#1D2A44"/><rect x="13" y="15.5" width="22" height="2" fill="#1D2A44"/><circle cx="24" cy="13" r="1.6" fill="#E8C35A"/><circle cx="21" cy="22" r="1" fill="#2B2420"/><circle cx="27" cy="22" r="1" fill="#2B2420"/></svg>';
const stampSVG = () => `<svg class="stamp" viewBox="0 0 200 200" role="img" aria-label="입국 도장: ADMITTED"><g transform="rotate(-12 100 100)"><circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" stroke-width="2"/><text x="100" y="92" text-anchor="middle" font-size="27" font-weight="800" fill="currentColor" font-family="IBM Plex Mono, monospace">ADMITTED</text><text x="100" y="122" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor" font-family="IBM Plex Mono, monospace">SEA · 03 MAY</text><path d="M48 136h104" stroke="currentColor" stroke-width="3"/></g></svg>`;
function simKeep() { if (!$('sim').contains(document.activeElement) || !document.activeElement.isConnected) $('sim').focus({ preventScroll: true }); }
function simMic() {
  if (!SRC || SIM.done || !SIM.started) return;
  if (SIM.listening) { stopListening(); return; }
  listenOnce({
    onState(on) { SIM.listening = on; simBuild(); simKeep(); },
    onText(alts) { const q = simQ(), best = alts.find(t => AP.matchSpoken(t, q, SIM.card).ok) || alts[0]; simAnswer(null, best); simKeep(); },
    onFail(msg) { SIM.react = { en: '…', ko: msg, st: 'no' }; simBuild(); simKeep(); },
  });
}
function simInit() {
  $('simNew').addEventListener('click', () => { simNew(); SIM.started = false; simBuild(); });
  $('sim').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.id === 'simGo') { SIM.started = true; simBuild(); simAsk(); simKeep(); return; }
    if (b.id === 'simAgain') { simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); return; }
    if (b.dataset.sf) { SIM.f = b.dataset.sf; SIM.v = null; simBuild(); simKeep(); return; }
    if (b.dataset.sv != null) { SIM.v = b.dataset.sv; simBuild(); simKeep(); return; }
    if (b.id === 'simSay') { simAnswer({ f: SIM.f, v: SIM.v }); simKeep(); return; }
    if (b.id === 'simClear') { SIM.f = null; SIM.v = null; simBuild(); simKeep(); return; }
    if (b.id === 'simMic') { simMic(); return; }
    if (b.dataset.simline) { simAsk(null, false); return; }
    if (b.dataset.act === 'play') { if (SIM.mode === 'play' && APV.busy()) APV.stop(); else simAsk(null, false); return; }
    if (b.dataset.act === 'slowplay') { if (SIM.mode === 'slowplay' && APV.busy()) APV.stop(); else simAsk(null, true); return; }
    if (b.dataset.act === 'script') { SIM.script = !SIM.script; simBuild(); simKeep(); }
  });
  $('sim').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), onBtn = e.target.closest && e.target.closest('button');
    if (!SIM.started) { if (e.key === 'Enter' && !onBtn) { e.preventDefault(); $('simGo').click(); } return; }
    if (SIM.done) { if (k === 'N' || (e.key === 'Enter' && !onBtn)) { e.preventDefault(); $('simAgain').click(); } return; }
    const n = '1234'.indexOf(e.key), sv = 'ABC'.indexOf(k);
    if (n >= 0 && n < SIM.frames.length) { e.preventDefault(); SIM.f = SIM.frames[n]; SIM.v = null; simBuild(); simKeep(); }
    else if (sv >= 0 && SIM.f && AP.FRAME[SIM.f].slot && SIM.slots[SIM.f][sv] != null) { e.preventDefault(); SIM.v = SIM.slots[SIM.f][sv]; simBuild(); simKeep(); }
    else if (e.key === 'Enter' && !onBtn) { e.preventDefault(); if (SIM.f && (!AP.FRAME[SIM.f].slot || SIM.v)) { simAnswer({ f: SIM.f, v: SIM.v }); simKeep(); } }
    else if (e.key === 'Backspace') { e.preventDefault(); SIM.f = null; SIM.v = null; simBuild(); simKeep(); }
    else if (k === 'R' && APV.supported) { e.preventDefault(); simAsk(null, false); }
    else if (k === 'S' && APV.supported) { e.preventDefault(); simAsk(null, true); }
    else if (k === 'T' && APV.supported) { e.preventDefault(); SIM.script = !SIM.script; simBuild(); simKeep(); }
    else if (k === 'M' && SRC) { e.preventDefault(); simMic(); }
    else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
  });
  simNew(); SIM.started = false; simBuild();
}

/* =========================================================
   11. 공항 표현 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황).', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = AP.PLACES.map(p => ({ p, rows: AP.SHADOW.map((s, i) => [s, i]).filter(([s]) => s.place === p.id) })).filter(g => g.rows.length);
  $('shList').innerHTML = groups.map(({ p, rows }) => `<section class="sh-grp"><h3>${PI(p.id)}${esc(p.ko)} <span lang="en">${esc(p.en)}</span></h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${APV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-who ${s.who}">${s.who === 'me' ? '나' : '직원'}</span><span class="sh-en" lang="en">${esc(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i, slow) { const s = AP.SHADOW[i]; return [{ text: s.en, sp: s.sp }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = AP.SHADOW[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, AP.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${APV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
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
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (b) b.classList.remove('saying'); if (thenOrig && APV.supported) speak(shSeq(i)); };
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
   12. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', p: '#FFC15E', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// 곳 넷이 놓인 길 (A~D)
function routeFig(label, ids) {
  const Wd = 600, H = 210, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: (x, y) => y > 40 && y < H - 4 ? Math.min(3, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      g.fillStyle = '#18222D'; rrq(g, 150, 8, 300, 34, 12); g.fill(); g.strokeStyle = 'rgba(110,200,255,0.4)'; g.lineWidth = 1.5; g.stroke();
      g.font = qfont(17, 600); g.fillStyle = '#BFE3FF'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('“Anything to declare?”', 300, 26);
      g.strokeStyle = 'rgba(238,241,244,0.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cw / 2, 116); g.lineTo(Wd - cw / 2, 116); g.stroke();
      ids.forEach((id, k) => {
        const x = k * cw + cw / 2, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, k * cw + 6, 54, cw - 12, H - 60, 12); g.fillStyle = st.hover === k ? QCOL.hover : 'rgba(255,255,255,0.03)'; g.fill();
        if (on || wrong) { g.strokeStyle = on ? QCOL.p : QCOL.bad; g.lineWidth = 3; g.stroke(); }
        g.beginPath(); g.arc(x, 116, 30, 0, Math.PI * 2); g.fillStyle = '#202A36'; g.fill(); g.strokeStyle = 'rgba(238,241,244,0.3)'; g.lineWidth = 1.5; g.stroke();
        APS.icon(g, id, x, 116, 30, '#EEF1F4');
        g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.fillText(L4[k], x, 70);
        g.font = qfont(15, 600); g.fillStyle = QCOL.text; g.fillText(AP.PLACE[id].ko, x, 172);
      });
    } };
}
// 탑승권 (칸 넷 A~D)
function passFig(label, ids) {
  const Wd = 600, H = 232, x0 = 10, y0 = 14, pw = 580;
  let boxes = null;
  return { width: Wd, height: H, label,
    pick: (x, y) => { if (!boxes) return -1; const k = ids.findIndex(id => { const b = boxes[id]; return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }); return k; },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      const hl = {}; ids.forEach((id, k) => { hl[id] = st.done && k === st.answer ? '#E8A33A' : st.done && k === st.pick ? '#E05A4A' : st.hover === k ? '#6EC8FF' : '#9AA6AA'; });
      g.save(); boxes = APS.boardingPass(g, x0, y0, pw, { hl }); g.restore();
      ids.forEach((id, k) => { const b = boxes[id], cx = b.x + b.w - 12, cy = b.y + 12; g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fillStyle = '#1D1305'; g.fill(); g.font = qfont(13, 700); g.fillStyle = QCOL.p; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L4[k], cx, cy + 1); });
    } };
}
// 공항 표지판 넷 (A~D)
function signFig(label, signs) {
  const Wd = 600, H = 170, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: (x, y) => y > 6 && y < H - 4 ? Math.min(3, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      signs.forEach(([en, ko, ic, arrow], k) => {
        const x = k * cw, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, x + 6, 10, cw - 12, H - 20, 10); g.fillStyle = st.hover === k ? '#3A3220' : '#2A2416'; g.fill();
        g.strokeStyle = on ? QCOL.p : wrong ? QCOL.bad : 'rgba(255,193,94,0.35)'; g.lineWidth = on || wrong ? 3 : 1.5; g.stroke();
        g.font = qfont(14, 700); g.fillStyle = QCOL.key; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(L4[k], x + 16, 26);
        APS.icon(g, ic, x + cw / 2, 62, 36, '#FFC15E');
        g.font = qfont(16, 700); g.fillStyle = '#FFE3A8'; g.textAlign = 'center'; g.fillText(en, x + cw / 2, 108);
        g.font = qfont(13, 600); g.fillStyle = QCOL.muted; g.fillText(ko + ' ' + arrow, x + cw / 2, 134);
      });
    } };
}
const QS = (() => {
  const j = (q, a, c) => AP.judge(q, a, c || {}).ok;
  const o = (f, v) => (v != null ? { f, v: String(v) } : { f });
  const shoes = [o('or_ok'), o('g_nothx'), o('g_have'), o('or_why')];
  const water = [o('hp_give', 'water'), o('hp_want', 'water'), o('hp_could', 'water'), o('g_permit')];
  const len = [o('le_for', 10), o('le_dur', 10), o('st_at', 'harbor'), o('le_for', 3)];
  const bagO = [['black', 'small', 'backpack'], ['backpack', 'small', 'black'], ['small', 'backpack', 'black'], ['small', 'black', 'backpack']];
  const rep = [o('g_yes'), o('rp_noeng'), o('rp_again'), o('rp_rude')];
  const q = [
    { q: 'What\'s the purpose of your visit? 관광하러 왔다면 가장 자연스러운 대답은?', opts: ['My purpose is trip.', 'Sightseeing.', 'During a week.', 'I will travel.'], a: 1,
      why: '짧게 Sightseeing.이면 충분해요(I\'m here for sightseeing.도 좋아요). My purpose is trip.과 I will travel.은 한국어를 낱말 그대로 옮긴 말, During a week.는 기간(그것도 틀린 꼴)이에요.',
      check: () => [o('pu_lit', 'sightseeing'), o('pu_short', 'sightseeing'), o('pu_will')].map(a => j('im_purpose', a, AP.DEMO)).join() === 'false,true,false' },
    { q: '‘Anything to declare?’를 듣는 곳은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: routeFig('공항 길 위의 네 곳. A 체크인 카운터, B 보안 검색대, C 수하물 찾는 곳, D 세관. 위에 “Anything to declare?” 말풍선', ['checkin', 'security', 'baggage', 'customs']),
      why: 'declare → (세관에) 신고하다. 짐을 찾은 뒤 마지막으로 지나는 세관에서 들어요. 없으면 → No, nothing to declare.',
      check: () => AP.Q.cu_any.place === 'customs' },
    { q: '탑승권이에요. 탑승구에 늦어도 이때까지는 가 있어야 하는 시각은? 그림 속 칸을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: passFig('탑승권. A 탑승구 GATE 15, B 탑승 시작 BOARDING 10:20, C 출발 시각 DEPARTS 10:50, D 좌석 SEAT 32A', ['gate', 'boarding', 'depart', 'seat']),
      why: 'BOARDING 10:20 → 탑승 시작 시각이에요. 출발(DEPARTS 10:50)에 맞춰 가면 늦어요. 비행기 문은 출발보다 먼저 닫혀요.',
      check: () => AP.PASS.find(x => x.id === 'boarding').v === '10:20' },
    { q: '보안 검색대 직원 → Please take off your shoes. 알맞은 반응은?', opts: shoes.map(AP.text), a: 0,
      why: '지시(명령문)예요. Okay. 하고 신발을 벗으면 돼요. No, thank you.는 권하는 말을 거절하는 말, Yes, I have a laptop.은 다른 질문의 대답, Why?는 따지는 말처럼 들려요.',
      check: () => shoes.map(a => j('se_shoes', a)).join() === 'true,false,false,false' },
    { q: '방송 → Flight 207 will now depart from Gate 50. 어디로 가고, 그 숫자는 어디를 세게 읽나요?', opts: ['15번 · 끝을 세게', '207번 · 앞을 세게', '50번 · 끝을 세게', '50번 · 앞을 세게'], a: 3,
      why: 'Gate 50 → fifty는 앞을 세게(FIF-ty), 끝은 짧게 읽어요. fifteen(15)은 끝을 세게, 길게(fif-TEEN). 207은 항공편 번호예요.',
      check: () => AP.judgeNum(50, 50).ok && AP.Q.ga_change.fact.gate === 50 },
    { q: '기내 → 승무원이 Can I help you? 하고 물어요. 물을 부탁하는 가장 알맞은 말은?', opts: water.map(AP.text), a: 2,
      why: 'Could I have ___, please? → 부탁을 질문으로 하면 공손해요. Give me는 명령처럼, I want는 조르는 말처럼 들려요. Yes, you can.은 ‘도와드릴까요?’를 허락을 묻는 말로 잘못 들은 대답이에요.',
      check: () => water.map(a => j('pl_help', a, { need: 'water' })).join() === 'false,false,true,false' },
    { q: 'How long will you be staying? 여행 카드에는 ‘10일’이라고 적혀 있어요. 알맞은 대답은?', opts: len.map(AP.text), a: 0,
      why: '기간은 for + 기간 → For ten days. During은 한국어 ‘동안’을 그대로 옮긴 틀린 꼴, At the Harbor Hotel.은 장소, For three days.는 카드와 달라요.',
      check: () => len.map(a => j('im_length', a, { length: 10 })).join() === 'true,false,false,false' },
    { q: '입국 심사를 마쳤어요. 부친 가방을 찾으려면 어느 표지판을 따라가야 할까요? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: signFig('공항 표지판 넷. A Departures 출발, B Baggage Claim 수하물 찾는 곳, C Transfer 갈아타는 곳, D Gates 1–30 탑승구', [['Departures', '출발', 'gate', '↑'], ['Baggage Claim', '수하물', 'baggage', '→'], ['Transfer', '환승', 'transfer', '←'], ['Gates 1–30', '탑승구', 'door', '↑']]),
      why: 'Baggage Claim → 부친 짐을 찾는 곳이에요. 안내판에서 내 항공편의 벨트(carousel) 번호를 확인해요. Departures · Gates는 떠날 때, Transfer는 갈아탈 때 따라가요.',
      check: () => AP.PLACE.baggage.en === 'Baggage claim' },
    { q: '잃어버린 가방 → 빨간 이름표가 달린 작은 검은 배낭. 가장 자연스러운 묘사는?', opts: bagO.map(w => AP.text({ f: 'ds', bag: { words: w, with: 'redtag' } })), a: 3,
      why: '크기 → 색 → 물건, 특징은 with로 뒤에 → a small black backpack with a red tag. 색을 크기보다 앞에 두거나, 물건 이름을 꾸미는 말보다 앞에 두면 어색해요.',
      check: () => bagO.map(w => AP.bagOrder(w).ok).join() === 'false,false,false,true' },
    { q: '심사관이 너무 빨리 말해서 하나도 못 알아들었어요. 가장 알맞은 말은?', opts: rep.map(AP.text), a: 2,
      why: '못 알아들었으면 짐작하지 말고 공손하게 다시 물어요 → Sorry? Could you say that again, please? 그냥 Yes.는 무엇에 동의했는지 몰라 위험하고, Speak slowly!는 화난 말처럼 들려요.',
      check: () => rep.map(a => j('im_fast', a)).join() === 'false,false,true,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[공항] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[공항] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { APV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = APS.chapterAt(T);
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
// 화면 누르기: 말풍선은 그 사람 목소리로, 영어 칩은 발음 듣기, 지도의 곳 · 탑승권 칸은 고르기, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * APS.W, (e.clientY - r.top) / r.height * APS.H]; };
const hitAt = (x, y) => started ? APS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.stop != null) { S.stop = S.stop === h.stop ? null : h.stop; relab(); }
  else if (h && h.pass) { S.pass = h.pass; relab(); if (APV.supported) speak([{ text: h.say, sp: 'gb' }]); }
  else if (h && h.play && APV.supported) speak(h.play);
  else if (h && h.say && EN.say.supported) { stopSounds(); if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.stop != null ? '눌러서 이 곳의 질문 보기' : h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { APV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = APV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
simInit();
shInit();
ADrill($('drillRoot'), AP.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 열쇠 낱말 → 틀 + 내 정보 → 공손하게, 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09 · 10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '공항 일곱 곳의 질문이 모두 익숙해졌네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(APS.baseText()).then(() => { dirty = true; });
setTimeout(() => APS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
