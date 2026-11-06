/* 카페 회화 — 플레이어, 직접 해 보기, 카페 주문 시뮬레이터, 따라 말하기, 듣고 대답 고르기, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(CF), 그림은 scenes.js(CFS), 목소리는 voices.js(CFV)가 맡습니다.
 * 소리가 겹치지 않게: 대화를 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(CFV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const CF = window.CF, CFS = window.CFS, CFV = window.CFV, S = CFS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = CFS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cv = $('cv'), ctx = cv.getContext('2d');
CF.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = CFS.fonts;
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
  const ready = new Promise(res => CFS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '카페, 주문에는 순서가 있다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { CFS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: CFS.iconSVG('mic'),
};
const PI = id => CFS.iconSVG(id, 'pi');   // 단계 아이콘
// 듣기 · 천천히 · 대본 보기 단추 묶음 (T15 · T16 · 공항과 같은 모양 · 같은 키 R · S · T)
const lsnBar = scriptOn => CFV.supported
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
  const cap = started ? CFS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 말풍선을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = CFS.chapterAt(T);
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
  if (dirty) { dirty = false; CFS.render(ctx, started ? T : POSTER); }
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
function stopSounds() { EN.say.stop(); CFV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return CFV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름
const lpBtn = (seq, label, cls = '') => CFV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-lp]');
  if (!b) return;
  const box = b.closest('[data-slow]'), slow = !!box && box.getAttribute('data-slow') === '1';
  document.querySelectorAll('.lp-play.saying').forEach(x => x.classList.remove('saying'));
  b.classList.add('saying');
  // 시뮬레이터 안의 듣기 단추는 브라우저 음성으로만 (카드마다 바뀌는 말과 같은 목소리가 되게)
  speak(SEQS[+b.dataset.lp], { slow, clips: !b.closest('#sim'), onend() { b.classList.remove('saying'); } });
});
const staffSeq = q => [{ text: q.en, sp: q.sp, rate: q.fast ? 1.35 : 1 }];
const meSeq = a => [{ text: typeof a === 'string' ? a : CF.text(a), sp: 'me' }];

/* =========================================================
   5. 글 칠하기 — 가려진 바리스타 말(marks만 드러남)과 보기의 역할 색
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
const segHTML = (a, on = true) => CF.segs(a).map(s => on && s.t.trim() && /[A-Za-z0-9]/.test(s.t) ? `<mark class="mk-${s.r}">${esc(s.t)}</mark>` : esc(s.t)).join('');
const keyMarks = q => q.key.map(t => ({ t, role: 'key' }));

/* =========================================================
   6. 듣고 대답 고르기 (이 튜토리얼 전용, 공항의 ADrill과 같은 모양) — 바리스타 말은 소리 먼저, 대답 넷은 글
   생김새와 키보드는 공통 부품 EN.drill과 같게: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본 · Enter/→ 다음
   ========================================================= */
function CDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null;
  const compact = !!cfg.compact, hear = CFV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && CFV.busy()) { CFV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(staffSeq(it.Q), { slow: !!slow, onitem() { paintNow(root, '.ldr-q'); say(it.Q.fast ? '바리스타가 빠르게 말하는 중' : '바리스타가 말하는 중'); },
      onend(stopped) { mode = null; paintPlay(root, null); paintNow(root, null); say(stopped ? '' : '다 들었어요. 대답을 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { CFV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; CFV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    CFV.stop();
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = CF.steps(it), place = CF.PLACE[it.place];
    const marks = []; steps.slice(0, done ? 3 : s.hints).reverse().forEach(x => marks.push(...x.marks));   // 뒤 단계의 색이 앞 단계를 덮음
    const reveal = done || !hear || s.script, mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur), ask = CF.ASK[CF.INTENT[it.Q.intent].ask].ko;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${PI(it.place)}${esc(place.ko)}</span><span>${compact ? '듣고 대답 고르기' : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span>${done ? `<span class="edr-tag">${it.Q.fast ? '다시 묻기' : esc(ask)}</span>` : ''}</p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(it.sit)}</p>`;
    h += lsnBar(done ? null : s.script);
    h += `<p class="ldr-q"><b>바리스타</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="q" aria-label="바리스타 말 다시 듣기" title="바리스타 말 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.Q.en, mk('q'), reveal)}</span>${it.Q.fast && !done ? '<small class="adr-fast">아주 빠르게</small>' : ''}</p>`;
    h += `<p class="adr-ask">나의 대답은?</p><div class="ldr-opts" role="group" aria-label="대답 보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '', t = CF.text(op);
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-lp="${seqId(meSeq(t))}" aria-label="(${L4[k]}) 듣기" title="(${L4[k]}) 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(t, mk(k), true)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + CF.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = [[`바리스타 · ${it.Q.en}`, it.Q.ko, staffSeq(it.Q)]].concat(it.opts.map((op, k) => [`(${L4[k]}) ${CF.text(op)}`, CF.ko(op), meSeq(op)]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      h += `<div class="edr-acts">${hear ? `<button type="button" class="edr-btn ghost adr-ex" data-lp="${seqId(staffSeq(it.Q).concat([{ text: CF.text(it.opts[it.a]), sp: 'me', gap: 0.5 }]))}">${ICO.play} 대화 듣기 (바리스타 → 나)</button>` : ''}${compact ? '' : `<button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button>`}</div>`;
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
const LAB = {
  ord: { sit: 'icedam', f: 'or_can', v: null, art: true },
  cup: { q: 'sz_size', size: 'large', temp: 'iced', pick: null },
  chg: { want: 'lessice', f: 'cu_with', v: null },
  pay: { drink: 'latte', size: 'medium', temp: 'iced', milk: 'oat', shot: true, more: 'none' }, priceQ: null,
  req: { need: 'straw', f: 'hp_could', v: null },
  line: { open: 'can', words: [] },
};
// 02장: 고른 틀 · 음료 · a(an) → 대답 (a 없이 + Can I get → 틀린 꼴)
const ordAns = () => { const r = LAB.ord; if (!r.v) return null; return { f: r.f === 'or_can' && !r.art ? 'or_bare' : r.f, v: r.v }; };
// 03장: 질문마다 보기 넷 (정답 자리가 질문마다 달라요)
function cupOpts() {
  const c = LAB.cup, fr = CF.CUP_ASK[c.q], k = c.q === 'sz_size' ? 1 : 2;
  return fr.slice(k).concat(fr.slice(0, k)).map(f => { const Fm = CF.FRAME[f]; return Fm.slot ? { f, v: Fm.slot === 'size' ? c.size : c.temp } : { f }; });
}
const payOrder = () => { const p = LAB.pay; return { drink: p.drink, size: p.size, temp: p.temp, milk: p.drink === 'americano' ? 'none' : p.milk, shot: p.shot, more: p.more }; };
const LINE_ORDER = ['size', 'temp', 'drink', 'with', 'togo'];
const LABS = {
  intro: () => `${labHead('먼저 주문해 보세요')}${mini('intro')}
    <p class="note">바리스타의 말을 듣고 대답을 고르세요. 바리스타의 말은 답한 뒤에 글로 보여요. 막히면 힌트(H)로 3단계를 하나씩 열어 보세요.</p>`,
  route: () => {
    const i = S.stop, p = i != null ? CF.PLACES[i] : null;
    return `${labHead('단계를 골라 질문 듣기')}
      ${seg('단계', CF.PLACES.map((x, k) => [k, `${PI(x.id)}${k + 1}. ${esc(x.ko)}`]), i == null ? '' : i, 'stop')}
      ${p ? `<ul class="qlist">${CF.ROUTE[p.id].map(id => { const q = CF.Q[id]; return `<li>${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span><span lang="en">${lineHTML(q.en, q.intent ? keyMarks(q) : [], true)}</span><small>${esc(q.ko)}</small></span></li>`; }).join('')}</ul>
        ${clearBtn}` : '<p class="note">단계를 고르면 그 단계에서 자주 듣는 질문을 들을 수 있고, 영상 화면의 지도에도 표시돼요. 하늘색 → 열쇠 낱말.</p>'}`;
  },
  order: () => {
    const r = LAB.ord, a = ordAns(), j = a ? CF.judge('co_what', a, CF.ORD_SIT[r.sit], '상황') : null, F0 = CF.FRAME[r.f];
    return `${labHead('주문하는 말 만들기')}
      <p class="note">바리스타가 <span lang="en">What can I get you?</span> 하고 물어요. 마시고 싶은 것 →</p>
      ${seg('마시고 싶은 것', Object.entries(CF.ORD_SIT_KO).map(([k, v]) => [k, esc(v)]), r.sit, 'osit')}
      <h3 class="mt">① 틀 고르기</h3>${seg('틀', CF.ORD_FRAMES.map(f => [f, `<span lang="en">${esc(CF.FRAME[f].t.replace(/[{}]/g, ''))}</span>`]), r.f, 'of')}
      <h3 class="mt">② 음료 넣기</h3>${seg('음료', CF.ORD_VALS.map(k => [k, `<span lang="en">${esc(CF.SLOT.drink.vals[k][r.f === 'or_can' && !r.art ? 'bare' : F0.form])}</span>`]), r.v || '', 'ov')}
      ${r.f === 'or_can' ? `<div class="seg"><button type="button" data-oart="1" aria-pressed="${r.art}">a · an 넣기</button></div>` : ''}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${clearBtn}` : '<p class="note">틀과 음료를 고르면 영상 화면에 대답이 만들어지고, 규칙 엔진이 3단계로 판정해요. a · an을 빼 보거나 ‘아이스’를 그대로 옮긴 ice를 넣어 보세요.</p>'}`;
  },
  size: () => {
    const c = LAB.cup, q = CF.Q[c.q], opts = cupOpts(), want = { size: c.size, temp: c.temp };
    const pick = c.pick != null ? opts[c.pick] : null, j = pick ? CF.judge(q, pick, want, '상황') : null;
    return `${labHead('고르기 질문에 대답하기')}
      <p class="note">마시고 싶은 컵을 정하고, 바리스타의 질문에 대답을 고르세요.</p>
      <div class="cv-row"><span class="cv-lab">크기</span>${seg('크기', CF.SIZES.map(s => [s, `<span lang="en">${s}</span>`]), c.size, 'csz')}</div>
      <div class="cv-row"><span class="cv-lab">온도</span>${seg('온도', [['hot', '<span lang="en">hot</span> <small>따뜻한</small>'], ['iced', '<span lang="en">iced</span> <small>차가운</small>']], c.temp, 'ctp')}</div>
      <div class="cv-row"><span class="cv-lab">질문</span>${seg('질문', [['sz_size', '<span lang="en">What size?</span>'], ['tp_temp', '<span lang="en">Hot or iced?</span>']], c.q, 'cq')}</div>
      <p class="enline">${lpBtn(staffSeq(q), '질문 듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
      <div class="mo mo-col">${opts.map((a, k) => `<button type="button" data-ca="${k}" class="${c.pick === k ? (j.ok ? 'right' : 'wrong') : ''}"><span lang="en">${esc(CF.text(a))}</span></button>`).join('')}</div>
      ${j ? verdictHTML(j) + clearBtn : '<p class="note">대답을 고르면 영상 화면에서도 판정을 볼 수 있어요.</p>'}`;
  },
  option: () => {
    const r = LAB.chg, F0 = CF.FRAME[r.f], vals = Object.keys(CF.SLOT[F0.slot].vals), a = r.v && vals.includes(r.v) ? { f: r.f, v: r.v } : null;
    const j = a ? CF.judge('op_add', a, { chg: r.want }, '상황') : null;
    return `${labHead('옵션 부탁 만들기')}
      <p class="note">바리스타가 <span lang="en">Anything you'd like to add or change?</span> 하고 물어요. 바꾸고 싶은 것 →</p>
      ${seg('바꾸고 싶은 것', CF.CHG_SIT.map(k => [k, esc(CF.factKo('chg', k))]), r.want, 'chs')}
      <h3 class="mt">① 틀 고르기</h3>${seg('틀', CF.CHG_FRAMES.map(f => [f, `<span lang="en">${esc(CF.FRAME[f].t.replace(/[{}]/g, ''))}</span>`]), r.f, 'chf')}
      <h3 class="mt">② 칸 채우기</h3>${seg('칸', vals.map(k => [k, `<span lang="en">${esc(CF.SLOT[F0.slot].vals[k].t)}</span>`]), r.v || '', 'chv')}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${clearBtn}` : '<p class="note">틀과 칸을 고르면 영상 화면에 문장이 만들어져요. 더할 때 → with, 뺄 때 → No.</p>'}`;
  },
  name: () => `${labHead('빠른 말 듣고 되묻기')}${mini('repair')}
    <h3 class="mt">이어서 들리는 말 — 빠르게 · 보통 · 천천히</h3>
    <ul class="qlist lk">${CF.LINKED.map(L => `<li><span class="mo">${CFV.supported ? [['빠르게', 1.35], ['보통', 1], ['천천히', 0.7]].map(([t, r]) => `<button type="button" data-lp="${seqId([{ text: L.en, sp: 'us', rate: r }])}">${ICO.play} ${t}</button>`).join('') : ''}</span><span><span lang="en">${esc(L.en)}</span><small><span lang="en">${esc(L.sound.map(([s]) => s).join(' · '))}</span> — ${esc(L.ko)}</small></span></li>`).join('')}</ul>
    <p class="note">대문자는 세게 읽는 곳이에요. 소리를 한국어로 똑같이 적을 수는 없으니 그림은 대략의 모양이에요.</p>`,
  pay: () => {
    const p = LAB.pay, o = payOrder(), P = CF.price(o), t = `That'll be ${CF.money(P.total)}.`, pq = LAB.priceQ;
    return `${labHead('주문하고 값 듣기')}
      <div class="cv-row"><span class="cv-lab">음료</span>${seg('음료', Object.entries(CF.MENU).map(([k, m]) => [k, `<span lang="en">${esc(m.en)}</span>`]), p.drink, 'pdrink')}</div>
      <div class="cv-row"><span class="cv-lab">크기 · 온도</span><div class="seg2">${seg('크기', CF.SIZES.map(s => [s, `<span lang="en">${s}</span>`]), p.size, 'psize')}${seg('온도', [['hot', '<span lang="en">hot</span>'], ['iced', '<span lang="en">iced</span>']], p.temp, 'ptemp')}</div></div>
      ${p.drink !== 'americano' ? `<div class="cv-row"><span class="cv-lab">우유</span>${seg('우유', Object.entries(CF.SLOT.milk.vals).map(([k, v]) => [k, `<span lang="en">${esc(v.low)}</span>${k === 'oat' ? ' <small>+0.75</small>' : ''}`]), p.milk, 'pmilk')}</div>` : ''}
      <div class="cv-row"><span class="cv-lab">샷 · 먹을 것</span><div class="seg2"><div class="seg"><button type="button" data-pshot="1" aria-pressed="${p.shot}"><span lang="en">extra shot</span> <small>+0.75</small></button></div>${seg('먹을 것', [['none', '없음']].concat(Object.entries(CF.FOOD).map(([k, f]) => [k, `<span lang="en">${esc(f.en)}</span>`])), p.more, 'pfood')}</div></div>
      <ul class="rlist">${P.items.map(it => `<li><span lang="en">${esc(it.en)}</span><b>${CF.money(it.c)}</b></li>`).join('')}<li class="tot"><span>합계 TOTAL</span><b>${CF.money(P.total)}</b></li></ul>
      <p class="enline">${lpBtn([{ text: t, sp: 'us' }], '바리스타의 말 듣기')}<span lang="en">${esc(t)}</span> <small class="read">→ <span lang="en">${esc(CF.priceWords(P.total))}</span></small></p>
      <h3 class="mt">값 읽기 문제</h3>
      ${pq ? `<p class="enline"><span class="price">${CF.money(pq.c)}</span> 바리스타는 어떻게 말할까요?</p><div class="mo mo-col">${pq.opts.map((o2, k) => `<button type="button" data-pq="${k}" class="${pq.pick === k ? (o2 === CF.priceWords(pq.c) ? 'right' : 'wrong') : ''}"><span lang="en">${esc(o2)}</span></button>`).join('')}</div><p class="mr" role="status">${pq.pick != null ? (pq.opts[pq.pick] === CF.priceWords(pq.c) ? '맞혔어요 — 점 앞 숫자 + 점 뒤 숫자로 읽어요.' : `다시 보세요 — ${CF.money(pq.c)} → ${CF.priceWords(pq.c)}. 점 앞과 점 뒤를 따로 읽어요.`) : ''}</p>` : ''}
      <div class="tg-acts"><button class="btn ghost" type="button" id="priceNew">${pq ? '다른 값' : '문제 내기'}</button>${S.pay ? clearBtn : ''}</div>`;
  },
  pickup: () => {
    const r = LAB.req, F0 = CF.FRAME[r.f], a = !F0.slot ? { f: r.f } : r.v ? { f: r.f, v: r.v } : null, j = a ? CF.judge('pk_help', a, { need: r.need }, '상황') : null;
    return `${labHead('픽업대에서 부탁하기')}
      <p class="note">바리스타가 <span lang="en">Hi, can I help you?</span> 하고 물어요. 지금 필요한 것 →</p>
      ${seg('필요한 것', Object.entries(CF.SLOT.need.vals).map(([k, v]) => [k, esc(v.ko)]).concat([['temp', '차갑게 시켰는데 따뜻한 음료']]), r.need, 'rneed')}
      <h3 class="mt">① 틀 고르기</h3>${seg('틀', CF.REQ_FRAMES.concat(['hp_iced', 'hp_wrong']).map(f => [f, `<span lang="en">${esc(CF.FRAME[f].t.replace(/[{}]/g, ''))}</span>`]), r.f, 'rf')}
      ${F0.slot ? `<h3 class="mt">② 칸 채우기</h3>${seg('칸', Object.entries(CF.SLOT.need.vals).map(([k, v]) => [k, `<span lang="en">${esc(v.t)}</span>`]), r.v || '', 'rv')}` : ''}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${clearBtn}` : '<p class="note">틀과 칸을 고르면 영상 화면에 문장이 만들어지고, 규칙 엔진이 3단계로 판정해요.</p>'}`;
  },
  oneline: () => {
    const L = LAB.line, has = L.words.length, a = { f: 'line', line: { open: L.open, words: L.words.slice() } };
    const rows = LINE_ORDER.map(c => `<div class="cv-row"><span class="cv-lab">${esc(CF.OCAT[c].ko)}</span><div class="seg">${CF.LINE_CHIPS[c].map(w => `<button type="button" data-lw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(CF.OW[w].t)}</span></button>`).join('')}</div></div>`).join('');
    let res = '';
    if (has) {
      const j = CF.judge('co_what', a, {}, '상황'), ck = CF.coveredKo(CF.covered(a, 'co_what'), CF.lineFacts(L.words));
      res = `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${j.ok ? `<p class="note">바리스타가 건너뛸 질문 → ${ck.length ? esc(ck.join(' · ')) : '없음 (나머지는 차례로 물어요)'}</p>` : ''}`;
    }
    return `${labHead('한 문장으로 주문하기')}
      <p class="note">낱말을 누르는 차례대로 문장이 만들어져요. 일부러 순서를 바꿔 눌러 보세요.</p>
      ${seg('여는 말', [['can', '<span lang="en">Can I get …?</span>'], ['like', '<span lang="en">I\'d like …, please.</span>'], ['give', '<span lang="en">Give me …</span>']], L.open, 'lopen')}
      ${rows}${res}
      <button class="btn ghost" type="button" id="lineClear">처음부터</button>
      <p class="note">순서(크기 → 온도 → 음료 → with 옵션 → 포장)는 자주 쓰는 순서를 단순하게 줄인 규칙이에요.</p>`;
  },
  method: () => {
    const i = S.place, row = i != null ? CF.METHOD[i] : null;
    return `${labHead('단계마다 3단계 적용해 보기')}
      ${seg('단계', CF.METHOD.map(([qid], k) => [k, `${PI(CF.Q[qid].place)}${esc(CF.PLACE[CF.Q[qid].place].ko)}`]), i == null ? '' : i, 'place')}
      ${row ? (() => { const [qid, a, c] = row, q = CF.Q[qid], j = CF.judge(q, a, c); return `<p class="enline">${lpBtn(staffSeq(q), '듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
        <ol class="edr-steps"><li><b>① 열쇠 낱말</b> ${esc(q.key.join(' … '))} → ${esc(CF.sayOf(q.intent))}</li><li><b>② 틀 + 내 정보</b> <span lang="en">${segHTML(a)}</span> ${esc(CF.ko(a))}</li><li><b>③ 공손하게</b> ${esc(j.why)}</li></ol>
        <p class="enline">${lpBtn(staffSeq(q).concat([{ text: CF.text(a), sp: 'me', gap: 0.5 }]), '대화 듣기')}<span>대화 듣기</span></p>
        ${clearBtn}`; })() : '<p class="note">단계를 고르면 영상 화면의 그 줄이 켜지고, 세 단계를 글로 보여 줘요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>대화 골라 보기</h3>
    <div class="seg">${CFS.PSEG.map((t, i) => `<button type="button" data-seek="${t + 0.4}">대화 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 해 보고 싶다면 아래 <a href="#playground">카페 주문 시뮬레이터</a>에서 내 주문 카드로 주문해 보세요. 카드는 누를 때마다 새로 만들어져요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">카페 주문 시뮬레이터</a> — 주문 카드로 바리스타에게 주문하기(한 문장 주문도)</li><li><a href="#shadow">카페 표현 따라 말하기</a> — ${CF.SHADOW.length}문장 듣고 따라 하기</li>
    <li><a href="#drill">듣고 대답 고르기</a> — 일곱 단계 ${CF.DRILL.length}문제, 3단계 힌트</li><li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.querySelectorAll('.lmini').forEach(m => CDrill(m, [CF.MINI[m.dataset.mini]], { compact: true, onAnswer() { if (playing) pause(); } }));
}
function showAt(u) { const ch = CHAPTERS[CFS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const relab = () => { touch(); buildLab(CFS.chapterAt(T)); };
// 직접 해 보기 상태 → 영상 화면 상태
const syncOrd = () => { const a = ordAns(); S.ord = a ? { sit: LAB.ord.sit, a } : null; };
const syncCup = () => { const c = LAB.cup; S.cup = c.pick != null ? { q: c.q, a: cupOpts()[c.pick], want: { size: c.size, temp: c.temp } } : null; };
const syncChg = () => { const r = LAB.chg, F0 = CF.FRAME[r.f]; S.chg = r.v && CF.SLOT[F0.slot].vals[r.v] ? { a: { f: r.f, v: r.v }, want: r.want } : null; };
const syncReq = () => { const r = LAB.req, F0 = CF.FRAME[r.f]; S.req = !F0.slot ? { a: { f: r.f }, need: r.need } : r.v ? { a: { f: r.f, v: r.v }, need: r.need } : null; };
const syncLine = () => { const L = LAB.line; S.line = L.words.length ? { open: L.open, words: L.words.slice() } : null; };
function newPriceQ() {
  const all = [];
  Object.values(CF.MENU).forEach(m => m.p.forEach(c => all.push(c))); all.push(650, 925, 305, 875);
  const c = all[Math.floor(Math.random() * all.length)], d = Math.floor(c / 100), k = c % 100;
  const right = CF.priceWords(c), digits = String(k).padStart(2, '0').split('').map(x => CF.numWord(+x)).join(' ');
  const opts = shuffle([right, `${CF.numWord(d)} point ${digits}`, k ? `${CF.numWord(d)} hundred ${CF.numWord(k)}` : `${CF.numWord(d)} hundred`]);
  LAB.priceQ = { c, opts, pick: null };
}
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  const d = b.dataset;
  if (d.seek) { seek(CHAPTERS[CFS.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') { S.stop = null; S.place = null; S.ord = null; S.cup = null; S.chg = null; S.req = null; S.pay = null; LAB.ord.v = null; LAB.cup.pick = null; LAB.chg.v = null; LAB.req.v = null; relab(); return; }
  if (d.stop != null) { S.stop = d.stop === '' ? null : +d.stop; showAt(12.6); relab(); return; }
  // 02장
  if (d.osit) { LAB.ord.sit = d.osit; syncOrd(); showAt(6.2); relab(); return; }
  if (d.of) { LAB.ord.f = d.of; syncOrd(); showAt(6.2); relab(); return; }
  if (d.ov) { LAB.ord.v = d.ov; syncOrd(); showAt(6.2); relab(); return; }
  if (d.oart) { LAB.ord.art = !LAB.ord.art; syncOrd(); showAt(6.2); relab(); return; }
  // 03장
  if (d.csz) { LAB.cup.size = d.csz; syncCup(); relab(); return; }
  if (d.ctp) { LAB.cup.temp = d.ctp; syncCup(); relab(); return; }
  if (d.cq) { LAB.cup.q = d.cq; LAB.cup.pick = null; syncCup(); relab(); return; }
  if (d.ca != null) { LAB.cup.pick = +d.ca; syncCup(); relab(); return; }
  // 04장
  if (d.chs) { LAB.chg.want = d.chs; syncChg(); relab(); return; }
  if (d.chf) { LAB.chg.f = d.chf; LAB.chg.v = null; syncChg(); relab(); return; }
  if (d.chv) { LAB.chg.v = d.chv; syncChg(); relab(); return; }
  // 06장
  const P = LAB.pay;
  if (d.pdrink) { P.drink = d.pdrink; S.pay = { order: payOrder() }; relab(); return; }
  if (d.psize) { P.size = d.psize; S.pay = { order: payOrder() }; relab(); return; }
  if (d.ptemp) { P.temp = d.ptemp; S.pay = { order: payOrder() }; relab(); return; }
  if (d.pmilk) { P.milk = d.pmilk; S.pay = { order: payOrder() }; relab(); return; }
  if (d.pshot) { P.shot = !P.shot; S.pay = { order: payOrder() }; relab(); return; }
  if (d.pfood) { P.more = d.pfood; S.pay = { order: payOrder() }; relab(); return; }
  if (b.id === 'priceNew') { newPriceQ(); relab(); return; }
  if (d.pq != null) { LAB.priceQ.pick = +d.pq; relab(); speak([{ text: `That'll be ${CF.money(LAB.priceQ.c)}.`, sp: 'us' }]); return; }
  // 07장
  if (d.rneed) { LAB.req.need = d.rneed; syncReq(); relab(); return; }
  if (d.rf) { LAB.req.f = d.rf; syncReq(); relab(); return; }
  if (d.rv) { LAB.req.v = d.rv; syncReq(); relab(); return; }
  // 08장
  if (d.lopen) { LAB.line.open = d.lopen; syncLine(); relab(); return; }
  if (d.lw) {
    const w = d.lw, L = LAB.line, c = CF.OW[w].c;
    if (L.words.includes(w)) L.words = L.words.filter(x => x !== w);
    else { L.words = L.words.filter(x => { const o = CF.OW[x]; return c === 'with' ? !(o.milk && CF.OW[w].milk) : o.c !== c; }); L.words.push(w); }
    syncLine(); relab(); return;
  }
  if (b.id === 'lineClear') { LAB.line = { open: 'can', words: [] }; S.line = null; relab(); return; }
  if (d.place != null) { S.place = d.place === '' ? null : +d.place; showAt(18.6); relab(); }
});
// 06장은 처음 열 때 화면을 바꾸지 않음 (값을 바꾸면 그때 영상 화면도 바뀜)

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/\$?(\d+)\.(\d{2})\b/g, (m, d, c) => (+c ? `${d}달러 ${+c}센트` : `${d}달러`)], [/\s\+\s/g, ', '], [/ = /g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
  clips: window.EN_CLIPS,   // 미리 만든 음성 파일(audio/narration/) — 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   9. 음성 인식 · 녹음 (따라 말하기 · 시뮬레이터 말로 주문하기)
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
   10. 놀이터 — 카페 주문 시뮬레이터
   바리스타는 늘 쓰는 차례로 묻고(조금씩 달라짐), 이미 답한 질문은 건너뛰어요(CF.covered).
   ========================================================= */
const SIM = { card: null, qs: [], i: 0, frames: [], slots: {}, f: null, v: null, log: [], started: false, script: !CFV.supported, mode: null, react: null, why: null, done: false, listening: false, heard: null, covered: new Set(), skipped: [], building: false, line: { open: 'can', words: [] } };
const simQ = () => CF.simQ(SIM.qs[SIM.i], SIM.card);
window.__simCard = () => Object.assign({}, SIM.card);   // 확인용(읽기만): 지금 주문 카드
window.__simQ = () => Object.assign({}, simQ());          // 확인용(읽기만): 지금 질문
function simNew() {
  CFV.stop(); stopListening();
  SIM.card = CF.newCard(); SIM.qs = CF.simQs(SIM.card); SIM.i = 0; SIM.log = []; SIM.done = false; SIM.react = null; SIM.why = null; SIM.heard = null;
  SIM.covered = new Set(); SIM.skipped = []; SIM.building = false; SIM.line = { open: 'can', words: [] };
  simPrep(); simBuild();
}
function simPrep() {
  const q = simQ(), C = SIM.card;
  SIM.frames = shuffle(CF.SIM_FRAMES[q.intent]); SIM.slots = {};
  SIM.frames.forEach(f => { const Fm = CF.FRAME[f]; if (Fm.slot) SIM.slots[f] = CF.slotChoices(Fm.slot, C); });
  SIM.f = null; SIM.v = null;
  if (!SIM.log[SIM.i]) SIM.log[SIM.i] = { q: q.id, en: q.en, sp: q.sp, tries: [] };
}
function simSpeak(lines, o = {}) {
  const box = $('sim');
  // 시뮬레이터는 카드마다 말이 바뀌어 미리 만든 파일이 없어요 → 한 사람의 목소리가 바뀌지 않게 모두 브라우저 음성
  speak(lines, { slow: !!o.slow, clips: false, onitem() { paintNow(box, '.sim-bub'); }, onend() { SIM.mode = null; paintPlay(box, null); paintNow(box, null); } });
  SIM.mode = o.slow ? 'slowplay' : 'play'; paintPlay(box, SIM.mode);
}
function simAsk(prefix, slow) { const q = simQ(); simSpeak((prefix ? [{ text: prefix.text, sp: prefix.sp || 'us' }] : []).concat([{ text: q.en, sp: q.sp, gap: 0.5 }]), { slow }); }
function simAnswer(a, spoken) {
  if (SIM.done || !SIM.started) return;
  const q = simQ(), C = SIM.card, L = SIM.log[SIM.i];
  const j = spoken ? CF.matchSpoken(spoken, q, C) : CF.judge(q, a, C);
  const model = a && a.f === 'line' ? CF.modelLine(C) : CF.model(q, C);   // 한 문장 주문이면 모범도 한 문장
  SIM.heard = spoken || null;
  if (j.repair) { SIM.react = { en: 'Sure. ' + q.en, ko: '다시 물었어요. 바리스타가 천천히 한 번 더 말해요.', st: 'repair' }; SIM.why = null; simBuild(); simSpeak([{ text: 'Sure.', sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }], { slow: true }); return; }
  L.tries.push({ t: spoken ? `(말로) ${spoken}` : CF.text(a), ok: j.ok, stage: j.stage });
  SIM.why = { j, model, spoken: !!spoken, line: a && a.f === 'line' };
  if (j.ok) {
    L.final = spoken || CF.text(a);
    (spoken ? (j.covered || [q.intent]) : CF.covered(a, q)).forEach(i => SIM.covered.add(i));
    const ok = CF.REACT.ok[(SIM.i + L.tries.length) % CF.REACT.ok.length];
    // 다음 질문 (이미 답한 것은 건너뜀)
    let n = SIM.i + 1; const skip = [];
    while (n < SIM.qs.length && SIM.covered.has(CF.Q[SIM.qs[n]].intent)) { skip.push(SIM.qs[n]); n++; }
    SIM.skipped.push(...skip);
    if (n >= SIM.qs.length) {
      SIM.done = true; SIM.react = { en: 'Enjoy your drink!', ko: '맛있게 드세요!', st: 'ok' };
      simBuild(); simSpeak([{ text: 'Enjoy your drink!', sp: q.sp }]); return;
    }
    SIM.i = n; simPrep(); SIM.building = false;
    const nq = simQ(), skipKo = CF.coveredKo(skip.map(id => CF.Q[id].intent), C);
    const pre = nq.id === 'pk_call' ? { text: 'Thank you! Your drink will be ready at the pickup counter.', sp: 'us' } : { text: skip.length ? 'Got it.' : ok, sp: q.sp };
    SIM.react = { en: pre.text, ko: skip.length ? `한 문장에 말해서 ${skipKo.join(' · ')} 질문을 건너뛰었어요.` : nq.id === 'pk_call' ? '계산 끝! 이제 픽업대에서 이름을 부를 거예요.' : '통과! 다음 질문이에요.', st: 'ok' };
    simBuild(); simAsk(pre);
  } else {
    const r = j.stage === 1 ? CF.REACT[1](q) : j.stage === 2 ? CF.REACT[2](q, j) : j.stage === 3 ? CF.REACT[3]() : { en: 'Sorry?', ko: '알아듣지 못했어요.' };
    SIM.react = Object.assign({ st: 'no' }, r); SIM.f = null; SIM.v = null;
    simBuild(); simSpeak([{ text: r.en, sp: q.sp }]);
  }
}
const chipT = f => esc(CF.FRAME[f].t.replace(/[{}]/g, '')).replace('___', '<i class="blank">___</i>');
function simBuild() {
  const hear = CFV.supported, C = SIM.card;
  $('simCard').innerHTML = `<p class="tc-head">${PI('name')}<b>주문 카드</b> <span lang="en">ORDER CARD</span></p><dl>${CF.cardRows(C).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="tc-foot">오늘의 가게: ${esc(CF.CAFE)} (지어낸 가게)</p>`;
  const prog = SIM.qs.map((id, k) => { const L = SIM.log[k], skipped = SIM.skipped.includes(id), c = skipped ? ' skip' : !L || !L.final ? (k === SIM.i && !SIM.done ? ' cur' : '') : L.tries[0] && L.tries[0].ok ? ' ok' : ' late'; return `<li class="${c}" title="${esc(CF.INTENT_KO[CF.Q[id].intent] || '받기')}${skipped ? ' (건너뜀)' : ''}">${k + 1}</li>`; }).join('');
  $('simProg').innerHTML = prog;
  const box = $('simMain');
  if (!SIM.started) {
    box.innerHTML = `<div class="sim-start"><p>왼쪽 주문 카드가 오늘 내가 원하는 것이에요. 바리스타가 늘 쓰는 차례로 물어요. 열쇠 낱말을 듣고, 대답 틀 칩을 고른 뒤 카드의 정보 칩을 넣어 대답해요. 첫 질문에서 <b>한 번에 주문</b>(L)으로 한 문장을 만들면, 바리스타가 이미 들은 질문을 건너뛰어요${SRC ? ' — 마이크로 말해서 대답할 수도 있어요' : ''}.</p><button type="button" class="btn" id="simGo">주문 시작 (Enter)</button></div>`;
    return;
  }
  if (SIM.done) {
    const first = SIM.log.filter(L => L && L.tries[0] && L.tries[0].ok).length, asked = SIM.log.filter(Boolean).length, saved = SIM.skipped.length;
    const ml = CF.modelLine(C);
    box.innerHTML = `<div class="sim-end"><div class="end-art">${cupSVG(C)}${receiptHTML(C)}</div><div><p class="sim-score"><b>${first} / ${asked}</b> 질문을 한 번에 통과했어요.</p>
      <p class="sim-saved">${saved ? `한 문장으로 주문해서 질문 <b>${saved}개</b>를 건너뛰었어요 (${esc(CF.coveredKo(SIM.skipped.map(id => CF.Q[id].intent), C).join(' · '))}).` : `다음에는 첫 질문에서 한 문장으로 주문해 보세요 → <span lang="en">${segHTML(ml)}</span> ${lpBtn(meSeq(ml), '한 문장 주문 듣기')}`}</p>
      <p class="sim-react ok"><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>
      <ol class="sim-log">${SIM.log.filter(Boolean).map(L => `<li><span class="who">바리스타</span>${lpBtn([{ text: L.en, sp: L.sp }], '듣기')}<span lang="en">${esc(L.en)}</span><br><span class="who me">나</span>${lpBtn(meSeq(L.final), '듣기')}<span lang="en">${esc(L.final)}</span>${L.tries.length > 1 ? ` <small>(${L.tries.length}번째에 통과)</small>` : ''}</li>`).join('')}</ol>
      <div class="tg-acts"><button type="button" class="btn" id="simAgain">새 카드로 다시 (N)</button>${hear ? `<button type="button" class="btn ghost" data-lp="${seqId(SIM.log.filter(Boolean).flatMap(L => [{ text: L.en, sp: L.sp }, { text: L.final, sp: 'me', gap: 0.4 }]))}">대화 전체 듣기</button>` : ''}</div></div></div>`;
    return;
  }
  const q = simQ(), show = SIM.script || !hear;
  const fa = SIM.f ? { f: SIM.f, v: SIM.v } : null, Fm = SIM.f ? CF.FRAME[SIM.f] : null, ready = fa && (!Fm.slot || SIM.v);
  let h = `${lsnBar(SIM.script)}`;
  h += `<div class="sim-officer">${baristaSVG(q.sp === 'au')}<p class="sim-bub"><span class="ldr-t" lang="en">${lineHTML(q.en, show ? keyMarks(q) : [], show)}</span>${hear ? `<button type="button" class="lp-play lp-mini" data-simline="1" aria-label="질문 다시 듣기" title="질문 다시 듣기">${SVG_PLAY}</button>` : ''}</p></div>`;
  if (SIM.react) h += `<p class="sim-react ${SIM.react.st}"><span class="who">바리스타</span><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>`;
  if (SIM.building) {
    const L = SIM.line, a = { f: 'line', line: { open: L.open, words: L.words.slice() } };
    h += `<div class="sim-build"><p class="sim-lab">한 번에 주문 — 낱말을 누르는 차례대로 문장이 돼요 <small>L 닫기</small></p>
      ${seg('여는 말', [['can', '<span lang="en">Can I get …?</span>'], ['like', '<span lang="en">I\'d like …, please.</span>'], ['give', '<span lang="en">Give me …</span>']], L.open, 'sopen')}
      ${LINE_ORDER.map(c => `<div class="cv-row"><span class="cv-lab">${esc(CF.OCAT[c].ko)}</span><div class="seg">${CF.LINE_CHIPS[c].map(w => `<button type="button" data-sw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(CF.OW[w].t)}</span></button>`).join('')}</div></div>`).join('')}
      <div class="sim-ans"><span class="who me">나</span>${L.words.length ? `<span lang="en" class="sim-line">${segHTML(a)}</span>` : '<span class="note">낱말을 고르세요. 카드에 있는 것만 넣어요.</span>'}</div>
      <div class="tg-acts"><button type="button" class="btn" id="simLine"${L.words.length ? '' : ' disabled'}>주문하기 (Enter)</button><button type="button" class="btn ghost" id="simLineClear"${L.words.length ? '' : ' disabled'}>지우기</button><button type="button" class="btn ghost" id="simBuildOff">칩으로 하나씩</button></div></div>`;
  } else {
    h += `<p class="sim-lab">① 대답 틀 <small>1~${SIM.frames.length}</small></p><div class="chips" role="group" aria-label="대답 틀">${SIM.frames.map((f, k) => `<button type="button" class="chipf" data-sf="${f}" aria-pressed="${SIM.f === f}"><small>${k + 1}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}${q.intent === 'order' ? '<button type="button" class="chipf chip-line" id="simBuildOn"><small>L</small> 한 번에 주문 (한 문장 만들기)</button>' : ''}</div>`;
    if (Fm && Fm.slot) h += `<p class="sim-lab">② 내 정보 넣기 <small>A~C</small></p><div class="chips" role="group" aria-label="칸에 넣을 정보">${SIM.slots[SIM.f].map((v, k) => { const S0 = CF.SLOT[Fm.slot].vals[v]; return `<button type="button" class="chips-s" data-sv="${esc(v)}" aria-pressed="${SIM.v === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(S0[Fm.form || 't'])}</span></button>`; }).join('')}</div>`;
    h += `<div class="sim-ans"><span class="who me">나</span>${fa ? `<span lang="en" class="sim-line">${ready ? segHTML(fa) : chipT(SIM.f)}</span>` : '<span class="note">틀을 고르세요.</span>'}</div>`;
    h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${ready ? '' : ' disabled'}>대답하기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${fa ? '' : ' disabled'}>지우기</button>${SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 대답하기 (M)'}</button>` : ''}</div>`;
  }
  if (SIM.heard) h += `<p class="note">들린 말: <span lang="en">${esc(SIM.heard)}</span></p>`;
  if (SIM.why) {
    const { j, model } = SIM.why, st = j.ok ? '통과' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸렸어요';
    h += `<div class="sim-why ${j.ok ? 'ok' : 'no'}"><p><b>${esc(st)}</b> ${esc(j.why)}</p>${j.ok ? '' : `<p>모범 대답 ${lpBtn(meSeq(model), '모범 대답 듣기')}<span lang="en">${segHTML(model)}</span> <small>${esc(CF.ko(model))}</small></p>`}${SIM.why.spoken ? '<p class="note">말로 한 대답은 낱말과 카드의 사실만 맞춰 봐요. 공손함과 발음은 판정하지 않아요.</p>' : ''}</div>`;
  }
  box.innerHTML = h;
  paintPlay($('sim'), SIM.mode);
}
const baristaSVG = two => `<svg class="sim-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#202A36"/><ellipse cx="24" cy="47" rx="19" ry="14" fill="${two ? '#2F3B36' : '#3B4350'}"/><rect x="16" y="35" width="16" height="13" rx="2" fill="${two ? '#7FA88E' : '#B9733F'}"/><circle cx="24" cy="21" r="8.5" fill="${two ? '#C99169' : '#E3B48D'}"/>${two ? '<path d="M15.5 19a8.5 8.5 0 0 1 17 0z" fill="#5A3A28"/><circle cx="24" cy="10.5" r="3" fill="#5A3A28"/>' : '<path d="M15.2 19.5a8.8 8.8 0 0 1 17.6 0z" fill="#2B2F36"/><rect x="23" y="17.6" width="11" height="2" rx="1" fill="#2B2F36"/>'}<circle cx="21" cy="22" r="1" fill="#2B2420"/><circle cx="27" cy="22" r="1" fill="#2B2420"/></svg>`;
// 끝: 이름이 적힌 컵 + 계산한 영수증
function cupSVG(c) {
  const iced = c.temp === 'iced', [l1, l2] = CF.cupLines(c), dc = { americano: '#3A271C', latte: '#C8A07A', cappuccino: '#B3895F', mocha: '#6E4530', chai: '#C2915F' }[c.drink];
  const body = 'M30 40h80l-9 132H39z';
  const inner = iced ? `<clipPath id="cupclip"><path d="${body}"/></clipPath><path d="${body}" fill="rgba(220,235,245,.15)"/><g clip-path="url(#cupclip)"><rect x="20" y="58" width="100" height="120" fill="${dc}" opacity=".85"/><rect x="44" y="66" width="20" height="20" rx="4" fill="rgba(240,248,255,.45)"/><rect x="72" y="78" width="18" height="18" rx="4" fill="rgba(240,248,255,.45)"/><rect x="52" y="96" width="19" height="19" rx="4" fill="rgba(240,248,255,.45)"/></g><path d="${body}" fill="none" stroke="rgba(160,190,210,.9)" stroke-width="2"/><rect x="26" y="33" width="88" height="9" rx="3" fill="#C9D6DE"/><path d="M78 36 88 4" stroke="#E6DFD2" stroke-width="7" stroke-linecap="round"/>`
    : `<path d="${body}" fill="#F1ECE2" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/><path d="M34.5 104h71l-2.4 36H36.9z" fill="#A9784D"/><rect x="25" y="28" width="90" height="13" rx="5" fill="#E2DACB" stroke="rgba(0,0,0,.25)"/><rect x="38" y="20" width="64" height="10" rx="4" fill="#D6CDBC"/>`;
  return `<svg class="cupsvg" viewBox="0 0 140 182" role="img" aria-label="컵: ${esc(l1)} ${esc(l2)} ${esc(c.name)}">${inner}<rect x="36" y="${iced ? 116 : 48}" width="68" height="${l2 ? 50 : 40}" rx="3" fill="#fff" stroke="rgba(0,0,0,.2)"/><text x="70" y="${iced ? 128 : 60}" text-anchor="middle" font-size="7.5" font-weight="700" font-family="IBM Plex Mono, monospace" fill="#1E2630">${esc(l1)}</text>${l2 ? `<text x="70" y="${iced ? 138 : 70}" text-anchor="middle" font-size="7" font-weight="700" font-family="IBM Plex Mono, monospace" fill="#1E2630">${esc(l2)}</text>` : ''}<text x="70" y="${iced ? (l2 ? 158 : 148) : (l2 ? 90 : 80)}" text-anchor="middle" font-size="15" font-weight="800" font-family="Hahmlet, serif" fill="#B8432B">${esc(c.name)}</text></svg>`;
}
function receiptHTML(c) {
  const P = CF.price(c);
  return `<div class="rcpt" role="img" aria-label="영수증 합계 ${CF.money(P.total)}"><p class="rc-h">${esc(CF.CAFE.toUpperCase())}</p><ul>${P.items.map(it => `<li><span>${esc(it.en)}</span><b>${CF.money(it.c)}</b></li>`).join('')}</ul><p class="rc-t"><span>TOTAL</span><b>${CF.money(P.total)}</b></p><p class="rc-f">${c.pay === 'card' ? 'PAID BY CARD' : 'PAID IN CASH'} · THANK YOU!</p><p class="rc-n">${c.receipt ? '영수증을 받았어요.' : '영수증은 안 받았지만 여기서 확인해요.'} 읽기 → <span lang="en">${esc(CF.priceWords(P.total))}</span></p></div>`;
}
function simKeep() { if (!$('sim').contains(document.activeElement) || !document.activeElement.isConnected) $('sim').focus({ preventScroll: true }); }
function simMic() {
  if (!SRC || SIM.done || !SIM.started) return;
  if (SIM.listening) { stopListening(); return; }
  listenOnce({
    onState(on) { SIM.listening = on; simBuild(); simKeep(); },
    onText(alts) { const q = simQ(), best = alts.find(t => CF.matchSpoken(t, q, SIM.card).ok) || alts[0]; simAnswer(null, best); simKeep(); },
    onFail(msg) { SIM.react = { en: '…', ko: msg, st: 'no' }; simBuild(); simKeep(); },
  });
}
function simLineSubmit() { const L = SIM.line; if (!L.words.length) return; simAnswer({ f: 'line', line: { open: L.open, words: L.words.slice() } }); }
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
    if (b.id === 'simBuildOn') { SIM.building = true; simBuild(); simKeep(); return; }
    if (b.id === 'simBuildOff') { SIM.building = false; simBuild(); simKeep(); return; }
    if (b.dataset.sopen) { SIM.line.open = b.dataset.sopen; simBuild(); simKeep(); return; }
    if (b.dataset.sw) {
      const w = b.dataset.sw, L = SIM.line, c = CF.OW[w].c;
      if (L.words.includes(w)) L.words = L.words.filter(x => x !== w);
      else { L.words = L.words.filter(x => { const o = CF.OW[x]; return c === 'with' ? !(o.milk && CF.OW[w].milk) : o.c !== c; }); L.words.push(w); }
      simBuild(); simKeep(); return;
    }
    if (b.id === 'simLine') { simLineSubmit(); simKeep(); return; }
    if (b.id === 'simLineClear') { SIM.line.words = []; simBuild(); simKeep(); return; }
    if (b.dataset.simline) { simAsk(null, false); return; }
    if (b.dataset.act === 'play') { if (SIM.mode === 'play' && CFV.busy()) CFV.stop(); else simAsk(null, false); return; }
    if (b.dataset.act === 'slowplay') { if (SIM.mode === 'slowplay' && CFV.busy()) CFV.stop(); else simAsk(null, true); return; }
    if (b.dataset.act === 'script') { SIM.script = !SIM.script; simBuild(); simKeep(); }
  });
  $('sim').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), onBtn = e.target.closest && e.target.closest('button');
    if (!SIM.started) { if (e.key === 'Enter' && !onBtn) { e.preventDefault(); $('simGo').click(); } return; }
    if (SIM.done) { if (k === 'N' || (e.key === 'Enter' && !onBtn)) { e.preventDefault(); $('simAgain').click(); } return; }
    const n = '1234'.indexOf(e.key), sv = 'ABC'.indexOf(k);
    if (k === 'L' && simQ().intent === 'order') { e.preventDefault(); SIM.building = !SIM.building; simBuild(); simKeep(); return; }
    if (SIM.building) {
      if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simLineSubmit(); simKeep(); }
      else if (e.key === 'Backspace') { e.preventDefault(); SIM.line.words.pop(); simBuild(); simKeep(); }
      return;
    }
    if (n >= 0 && n < SIM.frames.length) { e.preventDefault(); SIM.f = SIM.frames[n]; SIM.v = null; simBuild(); simKeep(); }
    else if (sv >= 0 && SIM.f && CF.FRAME[SIM.f].slot && SIM.slots[SIM.f][sv] != null) { e.preventDefault(); SIM.v = SIM.slots[SIM.f][sv]; simBuild(); simKeep(); }
    else if (e.key === 'Enter' && !onBtn) { e.preventDefault(); if (SIM.f && (!CF.FRAME[SIM.f].slot || SIM.v)) { simAnswer({ f: SIM.f, v: SIM.v }); simKeep(); } }
    else if (e.key === 'Backspace') { e.preventDefault(); SIM.f = null; SIM.v = null; simBuild(); simKeep(); }
    else if (k === 'R' && CFV.supported) { e.preventDefault(); simAsk(null, false); }
    else if (k === 'S' && CFV.supported) { e.preventDefault(); simAsk(null, true); }
    else if (k === 'T' && CFV.supported) { e.preventDefault(); SIM.script = !SIM.script; simBuild(); simKeep(); }
    else if (k === 'M' && SRC) { e.preventDefault(); simMic(); }
    else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
  });
  simNew(); SIM.started = false; simBuild();
}

/* =========================================================
   11. 카페 표현 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황).', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = CF.PLACES.map(p => ({ p, rows: CF.SHADOW.map((s, i) => [s, i]).filter(([s]) => s.place === p.id) })).filter(g => g.rows.length);
  $('shList').innerHTML = groups.map(({ p, rows }) => `<section class="sh-grp"><h3>${PI(p.id)}${esc(p.ko)} <span lang="en">${esc(p.en)}</span></h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${CFV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-who ${s.who}">${s.who === 'me' ? '나' : '바리스타'}</span><span class="sh-en" lang="en">${esc(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { const s = CF.SHADOW[i]; return [{ text: s.en, sp: s.sp }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = CF.SHADOW[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, CF.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.words.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.t)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}${/minji|seoyeon|jisoo/i.test(s.en) && r.hit < r.total ? ' (이름은 음성 인식이 다르게 적기 쉬워요.)' : ''}</p>`);
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${CFV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
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
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (b) b.classList.remove('saying'); if (thenOrig && CFV.supported) speak(shSeq(i)); };
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
// 가게 평면도 위의 네 곳 (A~D)
function floorFig(label, ids) {
  const Wd = 600, H = 230, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: (x, y) => y > 64 && y < H - 4 ? Math.min(3, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      rrq(g, 6, 6, Wd - 12, H - 12, 14); g.strokeStyle = 'rgba(238,241,244,0.18)'; g.lineWidth = 1.5; g.stroke();
      rrq(g, 150, 18, 440, 22, 6); g.fillStyle = '#3A2E25'; g.fill(); g.fillStyle = '#6B5442'; g.fillRect(150, 18, 440, 4);
      g.font = qfont(12, 700); g.fillStyle = QCOL.muted; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('주문대 · counter', 300, 52);
      g.strokeStyle = 'rgba(110,200,255,0.45)'; g.lineWidth = 3; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(cw / 2, 128); g.lineTo(Wd - cw / 2, 128); g.stroke(); g.setLineDash([]);
      ids.forEach((id, k) => {
        const x = k * cw + cw / 2, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, k * cw + 8, 68, cw - 16, H - 80, 12); g.fillStyle = st.hover === k ? QCOL.hover : 'rgba(255,255,255,0.03)'; g.fill();
        if (on || wrong) { g.strokeStyle = on ? QCOL.p : QCOL.bad; g.lineWidth = 3; g.stroke(); }
        g.beginPath(); g.arc(x, 128, 28, 0, Math.PI * 2); g.fillStyle = '#202A36'; g.fill(); g.strokeStyle = 'rgba(238,241,244,0.3)'; g.lineWidth = 1.5; g.stroke();
        CFS.icon(g, id, x, 128, 28, '#EEF1F4');
        g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.fillText(L4[k], x, 84);
        g.font = qfont(14, 600); g.fillStyle = QCOL.text; g.fillText(CF.PLACE[id].ko, x, 182);
        g.font = qfont(12, 500); g.fillStyle = QCOL.muted; g.fillText(CF.PLACE[id].en, x, 202);
      });
    } };
}
// 메뉴판 (값 칸 넷 A~D)
function menuFig(label, keys) {
  const Wd = 600, H = 375, w = 500, x0 = 50, y0 = 0;
  let boxes = null;
  return { width: Wd, height: H, label,
    pick: (x, y) => { if (!boxes) return -1; return keys.findIndex(k => { const b = boxes[k]; return x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6; }); },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      const hl = {}; keys.forEach((k, i) => { hl[k] = st.done && i === st.answer ? '#FFC15E' : st.done && i === st.pick ? '#FF8E8E' : st.hover === i ? '#6EC8FF' : '#9AA6AA'; });
      g.save(); boxes = CFS.menuBoard(g, x0, y0, w, { hl }); g.restore();
      keys.forEach((k, i) => { const b = boxes[k], cx = b.x - 4, cy = b.y + b.h / 2; g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill(); g.font = qfont(12, 700); g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L4[i], cx, cy + 1); });
    } };
}
// 컵 넷 (A~D)
function cupsFig(label, cups) {
  const Wd = 600, H = 290, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: (x, y) => y > 6 && y < H - 4 ? Math.min(3, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      cups.forEach((c, k) => {
        const x = k * cw + cw / 2, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, k * cw + 6, 8, cw - 12, H - 16, 12); g.fillStyle = st.hover === k ? QCOL.hover : 'rgba(255,255,255,0.03)'; g.fill();
        if (on || wrong) { g.strokeStyle = on ? QCOL.p : QCOL.bad; g.lineWidth = 3; g.stroke(); }
        g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(L4[k], k * cw + 18, 26);
        CFS.cupDraw(g, x, 218, { size: c.size, temp: c.temp, drink: c.drink, s: 1.0, label: CF.cupLines(c), name: c.name });
        g.font = qfont(14, 700); g.fillStyle = QCOL.text; g.textAlign = 'center'; g.fillText(CF.callName(c), x, 244);
        g.font = qfont(15, 800); g.fillStyle = '#FF9F7A'; g.fillText(c.name, x, 266);
      });
    } };
}
const QS = (() => {
  const o = CF.o, j = (q, a, c) => CF.judge(q, a, c || {}).ok;
  const ice = [o('or_give', 'iceam'), o('or_can', 'icedam'), o('or_want', 'iceam'), o('tp_pl', 'iced')], iceC = { drink: 'americano', temp: 'iced' };
  const nm = [o('g_permit'), o('nm_lit', 'Minji'), o('nm_its', 'Minji'), o('of_yes')];
  const rep = [o('rp_togo'), o('g_yes'), o('rp_size'), o('tg_pack')];
  const lines = [['iced', 'medium', 'latte', 'oat', 'togo'], ['latte', 'medium', 'iced', 'togo', 'oat'], ['medium', 'latte', 'iced', 'oat', 'togo'], ['medium', 'iced', 'latte', 'oat', 'togo']];
  const cups = [{ size: 'small', temp: 'iced', drink: 'latte', name: 'Jisoo' }, { size: 'large', temp: 'hot', drink: 'mocha', name: 'Jiwoo' }, { size: 'large', temp: 'hot', drink: 'mocha', name: 'Jisoo' }, { size: 'large', temp: 'hot', drink: 'mocha', name: 'Minji' }];
  const q = [
    { q: 'Hi! What can I get you? — 차가운 아메리카노를 마시고 싶어요. 가장 알맞은 주문은?', opts: ice.map(CF.text), a: 1,
      why: '주문은 질문으로 → Can I get …? 차가운 음료는 iced, 그 앞에는 an. Give me는 명령처럼, I want는 조르는 말처럼 들리고, ice는 ‘얼음’이라는 낱말이에요. Iced, please.는 온도를 고르는 질문의 대답이에요.',
      check: () => ice.map(a => j('co_what', a, iceC)).join() === 'false,true,false,false' },
    { q: '주문하고 계산까지 마쳤어요. 음료를 기다리는 곳은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: floorFig('가게 평면도 위의 네 곳. A 문 · 줄 서기, B 메뉴판 · 주문대, C 계산대, D 픽업대', ['door', 'counter', 'pay', 'pickup']),
      why: '계산이 끝나면 픽업대(pickup)에서 기다려요. 바리스타가 음료와 이름을 함께 불러요 → Medium iced latte for Minji! 내 것이면 → That\'s me. Thanks!',
      check: () => CF.Q.pk_call.place === 'pickup' && CF.PLACES[6].id === 'pickup' },
    { q: '빈칸에 알맞은 말은? Can I get ___ iced latte?', opts: ['an', 'a', 'the', '(아무것도 넣지 않음)'], a: 0,
      why: '음료 한 잔은 셀 수 있어서 a(an)가 붙어요. 바로 뒤의 iced가 모음 소리로 시작하니 → an iced latte. the는 이미 말한 그 음료를 가리킬 때 써요.',
      check: () => CF.article('iced') === 'an' && !j('co_what', o('or_bare', 'icedlatte'), {}) && j('co_what', o('or_can', 'icedlatte'), {}) },
    { q: '이미 미디엄으로 주문한 음료를 큰 컵으로 바꾸고 싶어요. 알맞은 말은?', opts: ['Size up, please.', 'Give me big size.', 'Can I make it a large?', 'More size, please.'], a: 2,
      why: '‘사이즈업’은 한국에서 만든 말이에요. 바꿔 달라는 부탁 → Can I make it a large? 처음 주문할 때라면 그냥 → Large, please.',
      check: () => CF.judge('sz_size', o('sz_up'), {}).stage === 2 },
    { q: 'Room for milk? — 바리스타가 무엇을 물었을까요?', opts: ['우유를 넣을 빈자리를 남길까요?', '우유가 있는 방으로 안내할까요?', '우유를 더 넣어 드릴까요?', '우유 종류는 무엇으로 할까요?'], a: 0,
      why: 'room → 방이 아니라 ‘빈자리’. 아메리카노 같은 커피에 우유를 직접 넣을 수 있게 컵 위쪽을 비워 둘지 묻는 말이에요. 원하면 Yes, please. 아니면 No, thanks.',
      check: () => CF.Q.op_room.intent === 'room' && CF.INTENT.room.ask === 'offer' },
    { q: 'Can I get a name for that? — 가장 알맞은 대답은?', opts: nm.map(CF.text), a: 2,
      why: '컵에 적을 이름을 묻는 말이에요(허락을 묻는 말이 아니에요). 이름만 → It\'s Minji. Yes, you can.은 허락해 주는 말, Name is Minji.는 my가 빠진 문장, Yes, please.는 권하는 말의 대답이에요.',
      check: () => nm.map(a => j('nm_name', a, { name: 'Minji' })).join() === 'false,false,true,false' },
    { q: '이름을 말한 뒤 바리스타가 아주 빠르게 물었어요. 끝의 “… to go?”만 들렸어요. 가장 알맞은 말은?', opts: rep.map(CF.text), a: 0,
      why: '주문 순서로 보면 이름 다음은 보통 포장 질문이에요. 들린 만큼 되물어 확인해요 → Sorry, for here or to go? 그냥 Yes.는 무엇에 대답했는지 모르고, Sorry, what size?는 다른 질문, Packing, please.는 ‘포장’을 그대로 옮긴 말이에요.',
      check: () => rep.map(a => j('nm_fast', a)).join() === 'true,false,false,false' },
    { q: '메뉴판이에요. 라지(L) 아메리카노의 값은? 그림 속 값을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: menuFig('메뉴판. A 미디엄 아메리카노 3.75, B 라지 아메리카노 4.25, C 라지 라테 5.50, D 스몰 모카 4.75', ['americano_medium', 'americano_large', 'latte_large', 'mocha_small']),
      why: 'L 칸과 Americano 줄이 만나는 곳 → $4.25. 바리스타는 점 앞과 뒤를 따로 읽어요 → four twenty-five.',
      check: () => CF.MENU.americano.p[2] === 425 && CF.priceWords(425) === 'four twenty-five' },
    { q: '픽업대에서 “Large mocha for Jisoo!”라고 불렀어요. 지수의 음료는 어느 컵일까요? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: cupsFig('컵 넷. A 스몰 아이스 라테 Jisoo, B 라지 모카 Jiwoo, C 라지 모카 Jisoo, D 라지 모카 Minji', cups),
      why: '부르는 말 = 음료 이름 + for + 이름. 라지 모카이고 이름이 Jisoo인 컵 → C. B는 이름이 비슷한 Jiwoo예요. 받으면서 → That\'s me. Thanks!',
      check: () => CF.callName(CF.PCARD) === 'Large mocha' && CF.simQ('pk_call', CF.PCARD).en === 'Large mocha for Jisoo!' },
    { q: '한 문장으로 주문할 때 순서가 가장 자연스러운 것은?', opts: lines.map(w => CF.lineText({ open: 'can', words: w })), a: 3,
      why: '크기 → 온도 → 음료 → with 옵션 → 포장 → Can I get a medium iced latte with oat milk to go? 그러면 바리스타가 크기 · 온도 · 우유 · 포장 질문을 건너뛰어요. (자주 쓰는 순서를 단순하게 줄인 규칙이에요.)',
      check: () => lines.map(w => CF.orderLine(w).ok).join() === 'false,false,false,true' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[카페] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[카페] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { CFV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = CFS.chapterAt(T);
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
// 화면 누르기: 말풍선은 그 사람 목소리로, 영어 칩은 발음 듣기, 지도의 단계는 고르기, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * CFS.W, (e.clientY - r.top) / r.height * CFS.H]; };
const hitAt = (x, y) => started ? CFS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.stop != null) { S.stop = S.stop === h.stop ? null : h.stop; relab(); }
  else if (h && h.play && CFV.supported) speak(h.play);
  else if (h && h.say && CFV.hasClip('tc', h.say)) speak([{ text: h.say, sp: 'tc' }]);   // 미리 만든 발음(음성 해설의 영어와 같은 목소리)
  else if (h && h.say && EN.say.supported) { stopSounds(); if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.stop != null ? '눌러서 이 단계의 질문 보기' : h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { CFV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = CFV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 대화 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 글이 정해진 말만 모아요: 영상의 말풍선 · 발음 칩, 질문(CF.Q), 직접 해 보기의 처음 화면(곳 · 3단계는 하나씩 골라 봄),
// 듣고 대답 고르기, 따라 말하기. 카페 주문 시뮬레이터(카드마다 바뀌는 말)와 내가 칩으로 만든 문장은 브라우저 음성이라 빼요.
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text || !/[A-Za-z]/.test(text) || /^\(.*\)$/.test(String(text).trim())) return;   // (지문)은 읽지 않음
    const id = CFV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: CFV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(CFS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 말풍선(그 사람) · 영어 칩(발음 듣기 tc). 곳(route) · 3단계(method) 장은 하나씩 골라 놓고 한 번 더
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return ch ? [ch.t, ch.t + ch.d] : null; };
    const sweeps = [[{}, [0, END]]].concat(CF.PLACES.map((_, k) => [{ stop: k }, span('route')]), CF.METHOD.map((_, k) => [{ place: k }, span('method')])).filter(x => x[1]);
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.25) {
        CFS.render(g, t);
        CFS.hits().forEach(h => { if (h.play) addSeq(h.play, 'video'); else if (h.say) add('tc', h.say, 'video-say'); });
      }
    });
    // 2) 직접 해 보기: 장마다 처음 화면 + 곳 · 3단계는 하나씩 골라서 (듣기 단추에 걸린 말)
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* 그리기만 하는 칸 */ } });
    CF.PLACES.forEach((_, k) => { S.stop = k; try { LABS.route && LABS.route(); } catch (e) { /* */ } });
    S.stop = null;
    CF.METHOD.forEach((_, k) => { S.place = k; try { LABS.method && LABS.method(); } catch (e) { /* */ } });
    S.place = null;
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 듣고 대답 고르기 · 먼저 골라 보기: 직원의 말 + 보기 넷
  CF.DRILL.concat(Object.values(CF.MINI)).forEach(it => { const Q = it.Q || CF.Q[it.q]; if (Q) addSeq(staffSeq(Q), 'drill'); it.opts.forEach(op => add('me', CF.text(op), 'drill')); });
  // 4) 따라 말하기
  CF.SHADOW.forEach((s0, i) => addSeq(shSeq(i), 'shadow'));
  // 5) 질문 목록의 나머지(직원의 말)
  Object.values(CF.Q).forEach(q => addSeq(staffSeq(q), 'q'));
  return out;
};
simInit();
shInit();
CDrill($('drillRoot'), CF.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 열쇠 낱말 → 틀 + 내 정보 → 공손하게, 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09 · 10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '카페 주문의 일곱 단계가 모두 익숙해졌네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(CFS.baseText()).then(() => { dirty = true; });
setTimeout(() => CFS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
