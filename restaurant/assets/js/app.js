/* 식당 회화 — 플레이어, 직접 해 보기, 식당 시뮬레이터, 따라 말하기, 듣고 대답 고르기, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(RS), 그림은 scenes.js(RSS), 목소리는 voices.js(RSV)가 맡습니다.
 * 소리가 겹치지 않게: 대화를 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(RSV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const RS = window.RS, RSS = window.RSS, RSV = window.RSV, S = RSS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = RSS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cv = $('cv'), ctx = cv.getContext('2d');
RS.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = RSS.fonts;
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
  const ready = new Promise(res => RSS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '식당, 질문의 모양이 대답을 정한다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { RSS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: RSS.iconSVG('mic'),
};
const PI = id => RSS.iconSVG(id, 'pi');   // 곳 아이콘
const SHI = sh => `<span class="shp shp-${sh}">${RSS.iconSVG('shape_' + sh, 'pi')}${esc(RS.SHAPE[sh].ko)}</span>`;   // 질문의 모양 표시
// 듣기 · 천천히 · 대본 보기 단추 묶음 (공항 · 카페 · 호텔과 같은 모양 · 같은 키 R · S · T)
const lsnBar = scriptOn => RSV.supported
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
  const cap = started ? RSS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 말풍선을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = RSS.chapterAt(T);
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
  if (dirty) { dirty = false; RSS.render(ctx, started ? T : POSTER); }
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
function stopSounds() { EN.say.stop(); RSV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return RSV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름
const lpBtn = (seq, label, cls = '') => RSV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-lp]');
  if (!b) return;
  const box = b.closest('[data-slow]'), slow = !!box && box.getAttribute('data-slow') === '1';
  document.querySelectorAll('.lp-play.saying').forEach(x => x.classList.remove('saying'));
  b.classList.add('saying');
  speak(SEQS[+b.dataset.lp], { slow, onend() { b.classList.remove('saying'); } });
});
const staffSeq = q => [{ text: q.en, sp: q.sp, rate: q.fast ? 1.35 : 1 }];
const meSeq = a => [{ text: typeof a === 'string' ? a : RS.text(a), sp: 'me' }];
const WHO = { door: '호스트', drinks: '서버', order: '서버', allergy: '서버', meal: '서버', dessert: '서버', check: '서버' };
const whoOf = q => q.sp === 'ca' ? '음식 나르는 직원' : q.sp === 'gb' ? '서버 (영국)' : WHO[q.place] || '직원';

/* =========================================================
   5. 글 칠하기 — 가려진 직원의 말(marks만 드러남)과 보기의 역할 색
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
const segHTML = (a, on = true) => RS.segs(a).map(s => on && s.t.trim() && /[A-Za-z0-9]/.test(s.t) ? `<mark class="mk-${s.r}">${esc(s.t)}</mark>` : esc(s.t)).join('');
const keyMarks = q => q.key.map(t => ({ t, role: 'key' }));

/* =========================================================
   6. 듣고 대답 고르기 (이 튜토리얼 전용, 호텔 HDrill과 같은 모양) — 직원의 말은 소리 먼저, 대답 넷은 글
   생김새와 키보드는 공통 부품 EN.drill과 같게: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본 · Enter/→ 다음
   힌트 ①부터 질문의 모양 표시(스위치 · 갈림길 · 빈 상자 · 말풍선)가 서버의 말 옆에 나와요.
   ========================================================= */
function RDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null;
  const compact = !!cfg.compact, hear = RSV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && RSV.busy()) { RSV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(staffSeq(it.Q), { slow: !!slow, onitem() { paintNow(root, '.ldr-q'); say(it.Q.fast ? '직원이 빠르게 말하는 중' : '직원이 말하는 중'); },
      onend(stopped) { mode = null; paintPlay(root, null); paintNow(root, null); say(stopped ? '' : '다 들었어요. 대답을 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { RSV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; RSV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    RSV.stop();
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = RS.steps(it), place = RS.PLACE[it.place];
    const marks = []; steps.slice(0, done ? 3 : s.hints).reverse().forEach(x => marks.push(...x.marks));   // 뒤 단계의 색이 앞 단계를 덮음
    const reveal = done || !hear || s.script, mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur), showShape = (done || s.hints > 0) && !it.Q.fast;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${PI(it.place)}${esc(place.ko)}</span><span>${compact ? '듣고 대답 고르기' : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span>${done ? `<span class="edr-tag">${it.Q.fast ? '다시 묻기' : esc(RS.SHAPE[it.Q.shape].ko)}</span>` : ''}</p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(it.sit)}</p>`;
    h += lsnBar(done ? null : s.script);
    h += `<p class="ldr-q"><b>${esc(whoOf(it.Q))}</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="q" aria-label="직원의 말 다시 듣기" title="직원의 말 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.Q.en, mk('q'), reveal)}</span>${showShape ? SHI(it.Q.shape) : ''}${it.Q.fast && !done ? '<small class="adr-fast">아주 빠르게</small>' : ''}</p>`;
    h += `<p class="adr-ask">나의 대답은?</p><div class="ldr-opts" role="group" aria-label="대답 보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '', t = RS.text(op);
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-lp="${seqId(meSeq(t))}" aria-label="(${L4[k]}) 듣기" title="(${L4[k]}) 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(t, mk(k), true)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + RS.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = [[`${whoOf(it.Q)} · ${it.Q.en}`, it.Q.ko, staffSeq(it.Q)]].concat(it.opts.map((op, k) => [`(${L4[k]}) ${RS.text(op)}`, RS.ko(op), meSeq(op)]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      h += `<div class="edr-acts">${hear ? `<button type="button" class="edr-btn ghost adr-ex" data-lp="${seqId(staffSeq(it.Q).concat([{ text: RS.text(it.opts[it.a]), sp: 'me', gap: 0.5 }]))}">${ICO.play} 대화 듣기 (직원 → 나)</button>` : ''}${compact ? '' : `<button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button>`}</div>`;
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
const frameT = f => esc(RS.FRAME[f].t.replace(/[{}]/g, ''));
const LAB = {
  shape: { q: null, pick: null, yes: false },
  party: { n: 2, f: 'ps_n', v: null },
  cook: { want: 'medium', f: 'cook_pl', v: null },
  allergy: { al: 'nuts', item: 'salad', f: 'al_yes' },
  call: { need: 'water', f: 'cl_ex', rf: 'rq_could' },
  bill: { party: 2, pay: 'separate', dessert: 'none' },
  line: { words: [] },
};
const PARTY_VALS = ['p1', 'p2', 'p3', 'p4'];
const COOK_VALS = ['rare', 'mediumrare', 'medium', 'mediumwell', 'welldone', 'middle'];
const ALLERGY_ITEMS = ['steak', 'salmon', 'noodles', 'pasta', 'burger', 'salad', 'soup'];
const LINE_ORDER = ['open', 'dish', 'how', 'with', 'dress', 'without', 'please', 'allergy'];
const partyAns = () => { const r = LAB.party, F0 = RS.FRAME[r.f]; return F0.slot ? (r.v ? { f: r.f, v: r.v } : null) : { f: r.f }; };
const cookAns = () => { const r = LAB.cook, F0 = RS.FRAME[r.f]; return F0.slot ? (r.v ? { f: r.f, v: r.v } : null) : { f: r.f }; };
const allergyAns = () => { const r = LAB.allergy; return { f: r.f, v: r.al }; };
const callAns = () => { const r = LAB.call, a = { f: r.f }; if (r.rf) a.req = { f: r.rf, v: r.need }; return a; };
// 계산서 실습: 함께 온 사람의 음식을 사람 수에 맞춰 (센트까지 똑같이 나뉘게)
function billCard() {
  const b = LAB.bill, base = Object.assign({}, RS.DEMO, { party: b.party, pay: b.party > 1 ? b.pay : 'together', dessert: b.dessert }), pool = ['salmon', 'pasta', 'burger', 'noodles', 'steak'];
  for (let n = 0; n < 400; n++) {
    const others = Array.from({ length: b.party - 1 }, (_, k) => pool[(Math.floor(n / Math.pow(5, k))) % 5]);
    const c = Object.assign({}, base, { others });
    if (RS.bill(c).total % b.party === 0) return c;
  }
  return Object.assign(base, { others: Array.from({ length: b.party - 1 }, () => 'salmon') });
}
const LABS = {
  intro: () => `${labHead('먼저 골라서 대답해 보세요')}${mini('intro')}
    <p class="note">서버의 말을 듣고 대답을 고르세요. 서버의 말은 답한 뒤에 글로 보여요. 막히면 힌트(H)로 3단계를 하나씩 열어 보세요.</p>`,
  route: () => {
    const i = S.stop, p = i != null ? RS.PLACES[i] : null;
    return `${labHead('곳을 골라 한두 마디 듣기')}
      ${seg('곳', RS.PLACES.map((x, k) => [k, `${PI(x.id)}${k + 1}. ${esc(x.ko)}`]), i == null ? '' : i, 'stop')}
      ${p ? `<ul class="qlist">${RS.ROUTE[p.id].map(id => { const q = RS.Q[id]; return `<li>${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span><span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span><small>${SHI(q.shape)} ${esc(q.ko)}</small></span></li>`; }).join('')}</ul>
        ${clearBtn}` : '<p class="note">곳을 고르면 그곳에서 자주 듣는 말을 들을 수 있고, 영상 화면의 평면도에도 표시돼요. 하늘색 → 열쇠 낱말. 보라색 테두리의 곳(알레르기 · 식사 중 · 계산)에서는 내가 먼저 말을 꺼낼 때도 있어요.</p>'}`;
  },
  shapes: () => {
    const r = LAB.shape, q = r.q ? RS.Q[r.q] : null;
    let res = '';
    if (q && r.pick) res = `<p class="verdict"><b class="${r.pick === q.shape ? 'c-ok' : 'c-no'}">${r.pick === q.shape ? '맞아요' : '다시 보세요'}</b>${esc(`${RS.SHAPE[q.shape].ko} → ${RS.sayOf(q.intent)}. 대답 → ${RS.SHAPE[q.shape].ans}.`)}</p>`;
    if (q && r.yes) { const j = RS.judge(q, { f: 'g_yesp' }, {}, '상황'); res += `<p class="enline">${lpBtn(meSeq('Yes, please.'), '듣기')}<span lang="en">Yes, please.</span></p>${verdictHTML(j)}`; }
    return `${labHead('질문의 모양 맞히기')}
      <p class="note">서버의 말을 고르고, 모양을 맞혀 보세요. 그다음 <span lang="en">Yes, please.</span>로 대답하면 어떻게 되는지 규칙 엔진에 물어봐요.</p>
      ${seg('서버의 말', RS.SHAPE_QS.map(id => [id, `<span lang="en">${esc(RS.Q[id].short && /\?$|!$/.test(RS.Q[id].short) ? RS.Q[id].short : RS.Q[id].en)}</span>`]), r.q || '', 'sq')}
      ${q ? `<h3 class="mt">이 말의 모양은?</h3>${seg('모양', ['yn', 'or', 'wh', 'note'].map(sh => [sh, SHI(sh)]), r.pick || '', 'sp')}
        <div class="tg-acts mt8"><button type="button" class="btn ghost" id="shapeYes">Yes, please.로 대답해 보기</button>${lpBtn(staffSeq(q), '서버의 말 듣기')}</div>${res}${clearBtn}` : ''}`;
  },
  door: () => {
    const r = LAB.party, a = partyAns(), j = a ? RS.judge('d_many', a, { party: r.n }, '상황') : null, F0 = RS.FRAME[r.f];
    return `${labHead('몇 명인지 말하기')}
      <p class="note">호스트가 <span lang="en">How many are in your party?</span> 하고 물어요(정보 질문). 우리 일행 →</p>
      ${seg('일행', [1, 2, 3, 4].map(n => [n, `${n}명`]), r.n, 'pn')}
      <h3 class="mt">① 틀 고르기</h3>${seg('틀', ['ps_n', 'ps_table', 'ps_we', 'ps_person', 'g_yesp'].map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.f, 'pf')}
      ${F0.slot ? `<h3 class="mt">② 칸 채우기</h3>${seg('칸', PARTY_VALS.map(k => [k, `<span lang="en">${esc(RS.SLOT.party.vals[k][F0.form || 't'])}</span>`]), r.v || '', 'pv')}` : ''}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${clearBtn}` : '<p class="note">틀과 칸을 고르면 영상 화면에 사람 수가 그려지고, 규칙 엔진이 3단계로 판정해요. 일부러 <span lang="en">Yes, please.</span>나 <span lang="en">We are two.</span>를 넣어 보세요.</p>'}
      <h3 class="mt">기다리는 시간 되묻기</h3>${mini('wait')}`;
  },
  drinks: () => {
    const r = LAB.cook, a = cookAns(), j = a ? RS.judge('or_cook', a, { cook: r.want }, '상황') : null, F0 = RS.FRAME[r.f];
    return `${labHead('스테이크 굽기 말하기')}
      <p class="note">서버가 <span lang="en">How would you like your steak cooked?</span> 하고 물어요(정보 질문). 먹고 싶은 굽기 →</p>
      ${seg('굽기', COOK_VALS.slice(0, 5).map(k => [k, esc(RS.SLOT.cook.vals[k].ko)]), r.want, 'cw')}
      <h3 class="mt">① 틀 고르기</h3>${seg('틀', ['cook_pl', 'g_yesp'].map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.f, 'cf')}
      ${F0.slot ? `<h3 class="mt">② 칸 채우기</h3>${seg('칸', COOK_VALS.map(k => [k, `<span lang="en">${esc(RS.SLOT.cook.vals[k].t)}</span>`]), r.v || '', 'cv')}` : ''}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${clearBtn}` : '<p class="note">고르면 영상 화면의 굽기 띠에 표시돼요. ‘중간’을 옮긴 <span lang="en">Middle</span>도 넣어 보세요.</p>'}`;
  },
  allergy: () => {
    const r = LAB.allergy, items = [r.item], rep = RS.safeReply(items, r.al), a = allergyAns(), j = RS.judge('al_any', a, { allergy: r.al }, '상황');
    return `${labHead('알레르기 말하고 확인하기')}
      <p class="note">내 알레르기와 궁금한 음식을 고르면, 서버가 메뉴(지어낸 메뉴)를 보고 대답해요. 규칙 엔진의 <code>RS.safe</code>가 계산해요.</p>
      <div class="cv-row"><span class="cv-lab">알레르기</span>${seg('알레르기', Object.keys(RS.ALLERGENS).map(k => [k, esc(RS.ALLERGENS[k].ko)]), r.al, 'aa')}</div>
      <div class="cv-row"><span class="cv-lab">음식</span>${seg('음식', ALLERGY_ITEMS.map(k => [k, `<span lang="en">${esc(RS.MENU[k].en)}</span>`]), r.item, 'ai')}</div>
      <h3 class="mt">알레르기를 말하는 틀</h3>${seg('틀', ['al_yes', 'al_have', 'al_lit'].map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.f, 'af')}
      <p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}
      <p class="enline">${lpBtn([{ text: rep.en, sp: 'us' }], '서버의 대답 듣기')}<span lang="en">${esc(rep.en)}</span></p><p class="note">${esc(rep.ko)}</p>
      <p class="note honest-mini">알레르기가 있으면 메뉴 표시만 믿지 말고 직원에게 직접 말해요. 이 튜토리얼은 말하기 연습이에요(의학적인 조언이 아니에요).</p>${S.allergy ? clearBtn : ''}`;
  },
  meal: () => {
    const r = LAB.call, a = callAns(), j = RS.judge('ml_pass', a, { need: r.need }, '상황');
    return `${labHead('서버 부르고 부탁하기')}
      <p class="note">서버가 옆 테이블에 <span lang="en">Enjoy your meal!</span> 하며 지나가요. 필요한 것 →</p>
      ${seg('필요한 것', Object.keys(RS.SLOT.need.vals).map(k => [k, esc(RS.SLOT.need.vals[k].ko)]), r.need, 'mn')}
      <h3 class="mt">① 부르는 말</h3>${seg('부르기', RS.CALL_FRAMES.map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.f, 'mf')}
      <h3 class="mt">② 부탁 (없어도 돼요)</h3>${seg('부탁', [['', '부탁 없이']].concat(['rq_could', 'rq_we', 'rq_give'].map(f => [f, `<span lang="en">${frameT(f)}</span>`])), r.rf || '', 'mr')}
      <p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${S.call ? clearBtn : ''}`;
  },
  pay: () => {
    const b = LAB.bill, c = billCard(), B = RS.bill(c), q = RS.simQ('ck_pay', c), m = c.party > 1 ? RS.model('ck_split', c) : null;
    return `${labHead('계산서 나눠 보기')}
      <div class="cv-row"><span class="cv-lab">일행</span>${seg('일행', [1, 2, 3, 4].map(n => [n, `${n}명`]), b.party, 'bp')}</div>
      ${b.party > 1 ? `<div class="cv-row"><span class="cv-lab">계산</span>${seg('계산', [['together', '함께 내기'], ['separate', '똑같이 나눠 내기']], b.pay, 'bs')}</div>` : ''}
      <div class="cv-row"><span class="cv-lab">디저트</span>${seg('디저트', [['none', '안 먹음'], ['cake', `<span lang="en">Chocolate cake</span> <small>${(RS.MENU.cake.p / 100).toFixed(2)}</small>`], ['sorbet', `<span lang="en">Fruit sorbet</span> <small>${(RS.MENU.sorbet.p / 100).toFixed(2)}</small>`]], b.dessert, 'bd')}</div>
      <ul class="rlist">${B.items.map(it => `<li><span lang="en">${esc(it.en)}</span><b>${RS.money(it.c)}</b></li>`).join('')}<li class="tot"><span>합계 TOTAL</span><b>${RS.money(B.total)}</b></li>${c.party > 1 && c.pay === 'separate' ? `<li class="tot"><span>한 사람 EACH (÷ ${c.party})</span><b>${RS.money(RS.split(B, c.party).each)}</b></li>` : ''}</ul>
      <p class="enline">${lpBtn(staffSeq(q), '서버의 말 듣기')}<span lang="en">${esc(q.en)}</span> <small class="read">→ <span lang="en">${esc(RS.priceWords(q.fact.amount))}</span></small></p>
      ${m ? `<p class="note">서버가 먼저 묻는 말 → <span lang="en">Will this be together or separate?</span> (고르는 질문)</p><p class="enline">${lpBtn(meSeq(m), '맞는 대답 듣기')}<span lang="en">${segHTML(m)}</span></p>` : ''}
      <p class="note">값은 지어낸 메뉴의 값이고, 세금 · 봉사료는 나라마다 달라서 빼고 계산했어요. 나눠 낼 때 한 사람 몫이 센트까지 똑같이 나뉘게 함께 온 사람의 음식을 골랐어요. 영상 · 계산서 · 서버의 말이 모두 같은 계산(<code>RS.bill</code> · <code>RS.split</code>)이에요.</p>${S.bill ? clearBtn : ''}`;
  },
  oneline: () => {
    const L = LAB.line, has = L.words.length, a = { f: 'line', line: { words: L.words.slice() } };
    const rows = LINE_ORDER.map(c => `<div class="cv-row"><span class="cv-lab">${esc(RS.OCAT[c].ko)}</span><div class="seg">${RS.LINE_CHIPS[c].map(w => `<button type="button" data-lw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(RS.OW[w].t)}</span></button>`).join('')}</div></div>`).join('');
    let res = '';
    if (has) {
      const j = RS.judge('or_ready', a, {}, '상황'), ck = j.ok ? RS.coveredKo(RS.covered(a, 'or_ready')) : [];
      res = `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${j.ok ? `<p class="note">서버가 건너뛸 질문 → ${ck.length ? esc(ck.join(' · ')) : '없음 (서버가 차례로 물어요)'}</p>` : ''}`;
    }
    return `${labHead('한 줄 주문 만들기')}
      <p class="note">조각을 누르는 차례대로 문장이 만들어져요(<span lang="en">Are you ready to order?</span>에 대답). 일부러 순서를 바꿔 눌러 보세요.</p>
      ${rows}${res}
      <button class="btn ghost" type="button" id="lineClear">처음부터</button>
      <p class="note">순서(음식 → 굽기 · 맵기 → with 곁들임 → 드레싱 → without → please, 알레르기 문장은 맨 앞이나 맨 끝)는 자주 쓰는 순서를 단순하게 줄인 규칙이에요. 굽기는 스테이크에만, 맵기는 땅콩 소스 국수에만, 수프나 샐러드는 스테이크 · 연어 · 파스타에만 붙어요(메뉴판).</p>`;
  },
  method: () => {
    const i = S.place, row = i != null ? RS.METHOD[i] : null;
    return `${labHead('곳마다 3단계 적용해 보기')}
      ${seg('곳', RS.METHOD.map(([qid], k) => [k, `${PI(RS.Q[qid].place)}${esc(RS.PLACE[RS.Q[qid].place].ko)}`]), i == null ? '' : i, 'place')}
      ${row ? (() => { const [qid, a, c] = row, q = RS.Q[qid], j = RS.judge(q, a, c); return `<p class="enline">${lpBtn(staffSeq(q), '듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
        <ol class="edr-steps"><li><b>① 열쇠 낱말 + 모양</b> ${esc(q.key.join(' … '))} → ${SHI(q.shape)} ${esc(RS.sayOf(q.intent))}</li><li><b>② 틀 + 내 정보</b> <span lang="en">${segHTML(a)}</span> ${esc(RS.ko(a))}</li><li><b>③ 공손하게</b> ${esc(j.why)}</li></ol>
        <p class="enline">${lpBtn(staffSeq(q).concat([{ text: RS.text(a), sp: 'me', gap: 0.5 }]), '대화 듣기')}<span>대화 듣기</span></p>
        ${clearBtn}`; })() : '<p class="note">곳을 고르면 영상 화면의 그 줄이 켜지고, 세 단계를 글로 보여 줘요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>대화 골라 보기</h3>
    <div class="seg">${RSS.PSEG.map((t, i) => `<button type="button" data-seek="${t + 0.4}">대화 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 해 보고 싶다면 아래 <a href="#playground">식당 시뮬레이터</a>에서 내 식사 카드로 입구부터 계산까지 해 보세요. 카드는 누를 때마다 새로 만들어져요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">식당 시뮬레이터</a> — 식사 카드로 입구부터 계산까지(한 줄 주문도)</li><li><a href="#shadow">식당 표현 따라 말하기</a> — ${RS.SHADOW.length}문장 듣고 따라 하기</li>
    <li><a href="#drill">듣고 대답 고르기</a> — 일곱 곳 ${RS.DRILL.length}문제, 3단계 힌트</li><li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.querySelectorAll('.lmini').forEach(m => RDrill(m, [RS.MINI[m.dataset.mini]], { compact: true, onAnswer() { if (playing) pause(); } }));
}
function showAt(u) { const ch = CHAPTERS[RSS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const relab = () => { touch(); buildLab(RSS.chapterAt(T)); };
// 직접 해 보기 상태 → 영상 화면 상태
const syncShape = () => { const r = LAB.shape; S.shape = r.q ? { q: r.q, pick: r.pick, a: r.yes ? { f: 'g_yesp' } : null, card: {} } : null; };
const syncParty = () => { const a = partyAns(); S.party = a ? { n: LAB.party.n, a } : null; };
const syncCook = () => { const a = cookAns(); S.cook = a ? { want: LAB.cook.want, a } : null; };
const syncAllergy = () => { const r = LAB.allergy; S.allergy = { al: r.al, items: [r.item], a: allergyAns() }; };
const syncCall = () => { S.call = { a: callAns(), need: LAB.call.need }; };
const syncLine = () => { const L = LAB.line; S.line = L.words.length ? { words: L.words.slice() } : null; };
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  const d = b.dataset;
  if (d.seek) { seek(CHAPTERS[RSS.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') {
    ['stop', 'place', 'shape', 'party', 'cook', 'allergy', 'call', 'bill'].forEach(k => { S[k] = null; });
    LAB.shape = { q: null, pick: null, yes: false }; LAB.party.v = null; LAB.cook.v = null;
    relab(); return;
  }
  if (d.stop != null) { S.stop = d.stop === '' ? null : +d.stop; showAt(14.6); relab(); return; }
  // 02장
  if (d.sq) { LAB.shape = { q: d.sq, pick: null, yes: false }; syncShape(); relab(); return; }
  if (d.sp) { LAB.shape.pick = d.sp; syncShape(); relab(); return; }
  if (b.id === 'shapeYes') { LAB.shape.yes = true; syncShape(); relab(); return; }
  // 03장
  if (d.pn) { LAB.party.n = +d.pn; syncParty(); relab(); return; }
  if (d.pf) { LAB.party.f = d.pf; if (!RS.FRAME[d.pf].slot) LAB.party.v = null; syncParty(); relab(); return; }
  if (d.pv) { LAB.party.v = d.pv; syncParty(); relab(); return; }
  // 04장
  if (d.cw) { LAB.cook.want = d.cw; syncCook(); relab(); return; }
  if (d.cf) { LAB.cook.f = d.cf; if (!RS.FRAME[d.cf].slot) LAB.cook.v = null; syncCook(); relab(); return; }
  if (d.cv) { LAB.cook.v = d.cv; syncCook(); relab(); return; }
  // 05장
  if (d.aa) { LAB.allergy.al = d.aa; syncAllergy(); relab(); return; }
  if (d.ai) { LAB.allergy.item = d.ai; syncAllergy(); relab(); return; }
  if (d.af) { LAB.allergy.f = d.af; syncAllergy(); relab(); return; }
  // 06장
  if (d.mn) { LAB.call.need = d.mn; syncCall(); relab(); return; }
  if (d.mf) { LAB.call.f = d.mf; syncCall(); relab(); return; }
  if (d.mr != null) { LAB.call.rf = d.mr || null; syncCall(); relab(); return; }
  // 07장
  if (d.bp) { LAB.bill.party = +d.bp; S.bill = billCard(); relab(); return; }
  if (d.bs) { LAB.bill.pay = d.bs; S.bill = billCard(); relab(); return; }
  if (d.bd) { LAB.bill.dessert = d.bd; S.bill = billCard(); relab(); return; }
  // 08장
  if (d.lw) {
    const w = d.lw, L = LAB.line, c = RS.OW[w].c;
    if (L.words.includes(w)) L.words = L.words.filter(x => x !== w);
    else { L.words = L.words.filter(x => RS.OW[x].c !== c); L.words.push(w); }
    syncLine(); relab(); return;
  }
  if (b.id === 'lineClear') { LAB.line.words = []; S.line = null; relab(); return; }
  if (d.place != null) { S.place = d.place === '' ? null : +d.place; showAt(18.6); relab(); }
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   값은 한국어로(28달러 50센트, 앞의 영어와 붙어 읽히지 않게 마침표로 끊어요), 시각은 영어로(seven-thirty)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/\$(\d+)\.(\d{2})\b/g, (m, d, c) => (+c ? `. ${d}달러 ${+c}센트` : `. ${d}달러`)],
    [/\b(\d{1,2}):(\d{2})\b/g, (m, h, mm) => RS.timeWords(`${h}:${mm}`)],
    [/Yes\/No/g, 'Yes or No'],
    [/\s\+\s/g, ', '], [/ = /g, ', ']],
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
   10. 놀이터 — 식당 시뮬레이터
   입구 → 자리 · 음료 → 주문 → 알레르기 → 식사 중 → 디저트 · 포장 → 계산. 같은 곳에서 이미 답한 질문은 서버가 건너뛰어요(RS.covered).
   한 번만 나오는 질문(알레르기 · 계산 부탁)은 다른 곳에서 미리 답했어도 건너뛰어요(RS.CROSS).
   나온 음식(맞는지 다른지)과 오늘의 스페셜은 서버가 말해 줘요 — 듣고 써야 해요.
   ========================================================= */
const SIM = { card: null, qs: [], i: 0, frames: [], slots: {}, reqs: [], f: null, v: null, rf: undefined, rv: null, log: [], started: false, script: !RSV.supported, mode: null, react: null, why: null, done: false, listening: false, heard: null, covered: new Set(), skipped: [], building: false, line: { words: [] } };
const simQ = () => RS.simQ(SIM.qs[SIM.i], SIM.card);
const simC = () => Object.assign({}, SIM.card, simQ().fact || {});
window.__simCard = () => Object.assign({}, SIM.card);   // 확인용(읽기만): 지금 식사 카드
window.__simQ = () => Object.assign({}, simQ());          // 확인용(읽기만): 지금 서버의 말
window.__simReqs = () => SIM.reqs.map(r => r && Object.assign({}, r));   // 확인용(읽기만): 부르기에 붙일 부탁 칩
const keyOf = q => `${q.place}:${q.intent}`;
const skipLabel = ids => ids.map(id => RS.INTENT_KO[RS.Q[id].intent]).filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
const isCovered = q => SIM.covered.has(keyOf(q)) || SIM.covered.has('*:' + q.intent);
const PLACE_INTRO = {
  drinks: '자리에 앉았어요. 서버가 테이블로 와요.',
  order: '메뉴판을 보고 주문할 차례예요. 서버의 말에 오늘의 스페셜이 나오는지도 들어 보세요.',
  allergy: '주문을 받은 서버가 알레르기를 물어요.',
  meal: '음식이 나왔어요. 내가 시킨 음식인지 확인해요.',
  dessert: '식사가 거의 끝났어요.',
  check: '이제 계산할 차례예요. 많은 곳에서 테이블에서 계산해요.',
};
const SIM_LINE_CHIPS = { open: ['have', 'could', 'want'], dish: null, how: ['rare', 'mediumrare', 'medium', 'mediumwell', 'welldone', 'mild', 'spicy'], with: ['soup', 'salad'], dress: ['ranch', 'italian', 'balsamic'], without: ['nowalnuts', 'nocheese', 'noshrimp'], please: ['please'], allergy: ['a_peanuts', 'a_shrimp', 'a_milk', 'a_nuts'] };
function simNew() {
  RSV.stop(); stopListening();
  SIM.card = RS.newCard(); SIM.qs = RS.simQs(SIM.card); SIM.i = 0; SIM.log = []; SIM.done = false; SIM.react = null; SIM.why = null; SIM.heard = null;
  SIM.covered = new Set(); SIM.skipped = []; SIM.building = false; SIM.line = { words: [] };
  simPrep(); simBuild();
}
function simPrep() {
  const q = simQ(), C = simC();
  SIM.slots = {}; SIM.f = null; SIM.v = null; SIM.rf = undefined; SIM.rv = null; SIM.reqs = [];
  SIM.frames = shuffle(RS.simFrames(q.intent, C) || []);
  if (q.intent === 'call') { SIM.reqs = shuffle(RS.callReqs().filter(Boolean)).concat([null]); SIM.slots.req = RS.slotChoices('need', C); }
  SIM.frames.forEach(f => { const Fm = RS.FRAME[f]; if (Fm.slot) SIM.slots[f] = RS.slotChoices(Fm.slot, C); });
  if (!SIM.log[SIM.i]) SIM.log[SIM.i] = { q: q.id, en: q.en, sp: q.sp, place: q.place, tries: [] };
}
function simSpeak(lines, o = {}) {
  const box = $('sim');
  speak(lines, { slow: !!o.slow, onitem() { paintNow(box, '.sim-bub'); }, onend() { SIM.mode = null; paintPlay(box, null); paintNow(box, null); } });
  SIM.mode = o.slow ? 'slowplay' : 'play'; paintPlay(box, SIM.mode);
}
function simAsk(prefix, slow) { const q = simQ(); simSpeak((prefix ? [{ text: prefix.text, sp: prefix.sp || 'us' }] : []).concat([{ text: q.en, sp: q.sp, gap: 0.5 }]), { slow }); }
// 식사 중 부탁 두 가지는 어느 쪽을 먼저 말해도 돼요 → 먼저 말한 쪽으로 차례를 바꿔요 (RS.simQ의 needFirst)
function simNeedOrder(a, spoken) {
  const id = SIM.qs[SIM.i], c = SIM.card;
  if (!c.need2 || (id !== 'ml_pass' && id !== 'ml_what')) return;
  const first = c.needFirst || c.need;
  let said = null;
  if (spoken) { const n = RS.needOf(spoken); if (!n.includes(first) && n.includes(first === c.need ? c.need2 : c.need)) said = first === c.need ? c.need2 : c.need; }
  else if (a) { const r = a.req || (RS.FRAME[a.f].req ? a : null); if (r && r.v && r.v !== first && (r.v === c.need || r.v === c.need2)) said = r.v; }
  if (said) { c.needFirst = said; simPrep(); }
}
function simAnswer(a, spoken) {
  if (SIM.done || !SIM.started) return;
  simNeedOrder(a, spoken);
  const q = simQ(), C = simC(), L = SIM.log[SIM.i];
  const j = spoken ? RS.matchSpoken(spoken, q, C) : RS.judge(q, a, C);
  const model = RS.model(q, C);
  SIM.heard = spoken || null;
  if (j.repair) {
    const re = j.repair === 'what' ? 'Sure. Sparkling water is water with bubbles in it. Still water has no bubbles.' : j.repair === 'check' ? `Yes, that's right. ${q.intent === 'wait' ? `${RS.numWord(C.wait)} minutes`.replace(/^./, c => c.toUpperCase()) : `${RS.money(C.amount)}${q.each ? ' each' : ''}`}.` : null;
    SIM.react = { en: re || 'Sure. ' + q.en, ko: re ? (j.repair === 'check' ? '서버가 숫자를 확인해 줬어요. 이제 대답해 보세요.' : '서버가 알려 줬어요. 이제 대답해 보세요.') : '다시 물었어요. 서버가 천천히 한 번 더 말해요.', st: 'repair', who: whoOf(q) }; SIM.why = null; simBuild();
    simSpeak(re ? [{ text: re, sp: q.sp }] : [{ text: 'Sure.', sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }], { slow: true }); return;
  }
  L.tries.push({ t: spoken ? `(말로) ${spoken}` : RS.text(a), ok: j.ok, stage: j.stage });
  SIM.why = { j, model, spoken: !!spoken };
  if (j.ok) {
    L.final = spoken || RS.text(a);
    // 이 대답이 함께 답한 다른 질문만 (이 질문의 뜻은 빼요). 한 번만 나오는 질문은 어디서든 건너뛰어요
    (spoken ? (j.covered || [q.intent]) : RS.covered(a, q)).filter(i => i !== q.intent).forEach(i => SIM.covered.add(RS.CROSS[i] ? `*:${i}` : `${q.place}:${i}`));
    if (q.intent === 'call' && (spoken ? (j.covered || []).includes('need') : a && a.req)) SIM.covered.add(`${q.place}:need`);
    const ok = RS.REACT.ok[(SIM.i + L.tries.length) % RS.REACT.ok.length];
    let n = SIM.i + 1; const skip = [];
    while (n < SIM.qs.length && isCovered(RS.Q[SIM.qs[n]])) { skip.push(SIM.qs[n]); n++; }
    SIM.skipped.push(...skip);
    let reply = RS.reply(q, a, C);
    if (q.intent === 'dishcome' && C.dishOk === false) { SIM.card.served = SIM.card.dish; SIM.card.dishOk = true; }
    if (n >= SIM.qs.length) {
      const bye = C.paym === 'card' ? 'Thank you! Have a great night.' : 'Thank you! Here\'s your change. Have a great night.';
      SIM.done = true; SIM.react = { en: bye, ko: '계산 끝! 맛있게 드셨어요.', st: 'ok', who: whoOf(q) };
      simBuild(); simSpeak([{ text: bye, sp: q.sp }]); return;
    }
    const prevPlace = q.place;
    SIM.i = n; simPrep(); SIM.building = false;
    const nq = simQ(), moved = nq.place !== prevPlace;
    const skipKo = skipLabel(skip);
    const pre = reply || (skip.length ? 'Great.' : ok);
    SIM.react = { en: pre, ko: (skip.length ? `한 번에 말해서 ${skipKo} 질문을 건너뛰었어요. ` : '통과! ') + (moved ? PLACE_INTRO[nq.place] || '' : ''), st: 'ok', who: whoOf(q) };
    simBuild(); simAsk({ text: pre, sp: q.sp });
  } else {
    const r = j.stage === 1 ? RS.REACT[1](q) : j.stage === 2 ? RS.REACT[2](q, j, a) : j.stage === 3 ? RS.REACT[3](q, j, a) : { en: 'Sorry?', ko: '알아듣지 못했어요.' };
    SIM.react = Object.assign({ st: 'no', who: whoOf(q) }, r); SIM.f = null; SIM.v = null; SIM.rf = undefined; SIM.rv = null;
    simBuild(); simSpeak([{ text: r.en, sp: q.sp }]);
  }
}
const chipT = f => esc(RS.FRAME[f].t.replace(/[{}]/g, '')).replace('___', '<i class="blank">___</i>');
const slotLabel = (f, v) => { const F0 = RS.FRAME[f], x = RS.sv(F0.slot, v); return x ? (x[F0.form || 't'] != null ? x[F0.form || 't'] : x.t) : v; };
const badgeHTML = k => `<i class="bdg" title="${esc(RS.ALLERGENS[k].ko)}">${RS.ALLERGENS[k].badge}</i>`;
// 메뉴판 (HTML) — 값과 알레르기 표시
function menuHTML(c) {
  const row = id => { const m = RS.MENU[id]; return `<li${c && c.dish === id ? ' class="on"' : ''}><span lang="en">${esc(m.en)}</span>${Object.keys(m.has).map(badgeHTML).join('')}<b>${(m.p / 100).toFixed(2)}</b></li>`; };
  return `<div class="mnu" role="img" aria-label="메뉴판: 지어낸 식당의 메뉴와 값, 알레르기 표시"><p class="mnu-h">${esc(RS.REST.toUpperCase())}<small>MENU</small></p><ul>${RS.MAINS.map(row).join('')}</ul>
    <p class="mnu-n" lang="en">* steak · salmon · pasta → soup or salad</p><p class="mnu-s"><span lang="en">Tomato soup</span>${badgeHTML('milk')} · <span lang="en">House salad</span>${badgeHTML('nuts')} · <span lang="en">ranch</span>${badgeHTML('milk')} · <span lang="en">Italian · balsamic</span></p>
    <p class="mnu-s" lang="en">Still water free · Sparkling ${(RS.MENU.sparkling.p / 100).toFixed(2)} · Lemonade ${(RS.MENU.lemonade.p / 100).toFixed(2)} · Lemon-lime soda ${(RS.MENU.soda.p / 100).toFixed(2)} · Iced tea ${(RS.MENU.icedtea.p / 100).toFixed(2)}</p>
    <p class="mnu-s"><span lang="en">Chocolate cake ${(RS.MENU.cake.p / 100).toFixed(2)}</span>${badgeHTML('milk')} · <span lang="en">Fruit sorbet ${(RS.MENU.sorbet.p / 100).toFixed(2)}</span></p>
    <p class="mnu-sp"><span lang="en">TONIGHT'S SPECIAL — ask your server</span></p><p class="mnu-k">P 땅콩 · S 새우 · M 우유 · N 견과류 · 값과 메뉴는 지어낸 것</p></div>`;
}
// 계산서 (HTML) — 나눠 내면 한 사람 몫까지
function checkHTML(c) {
  const B = RS.bill(c), sp = c.party > 1 && c.pay === 'separate', e = RS.split(B, c.party).each;
  return `<div class="rcpt" role="img" aria-label="계산서 합계 ${RS.money(B.total)}${sp ? `, 한 사람 ${RS.money(e)}` : ''}"><p class="rc-h">${esc(RS.REST.toUpperCase())}</p><p class="rc-g">CHECK · GUESTS ${c.party}</p><ul>${B.items.map(it => `<li><span>${esc(it.en)}</span><b>${RS.money(it.c)}</b></li>`).join('')}</ul><p class="rc-t"><span>TOTAL</span><b>${RS.money(B.total)}</b></p>${sp ? `<p class="rc-t rc-fix"><span>EACH (÷ ${c.party})</span><b>${RS.money(e)}</b></p>` : ''}<p class="rc-n">읽기 → <span lang="en">${esc(RS.priceWords(sp ? e : B.total))}${sp ? ' each' : ''}</span> · 세금 · 봉사료 · 팁은 나라마다 달라서 뺐어요.</p></div>`;
}
function simBuild() {
  const hear = RSV.supported, C = SIM.card;
  const others = (C.others || []).map(d => RS.MENU[d].en).join(' · ');
  $('simCard').innerHTML = `<p class="tc-head">${PI('meal')}<b>식사 카드</b> <span lang="en">DINING CARD</span></p><dl>${RS.cardRows(C).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="tc-foot">함께 온 사람의 주문: ${others ? `<span lang="en">${esc(others)}</span>` : '없음 (혼자)'} · 오늘의 식당: ${esc(RS.REST)} (지어낸 식당)</p>`;
  $('simMenu').innerHTML = SIM.done ? '' : menuHTML(C);
  const prog = SIM.qs.map((id, k) => { const L = SIM.log[k], skipped = SIM.skipped.includes(id), c = skipped ? ' skip' : !L || !L.final ? (k === SIM.i && !SIM.done ? ' cur' : '') : L.tries[0] && L.tries[0].ok ? ' ok' : ' late'; return `<li class="${c}" title="${esc(RS.INTENT_KO[RS.Q[id].intent] || '')}${skipped ? ' (건너뜀)' : ''}">${k + 1}</li>`; }).join('');
  $('simProg').innerHTML = prog;
  const box = $('simMain');
  if (!SIM.started) {
    box.innerHTML = `<div class="sim-start"><p>왼쪽 식사 카드가 오늘 저녁의 사실이에요. 입구 → 자리 · 음료 → 주문 → 알레르기 → 식사 중 → 디저트 · 포장 → 계산 차례로 서버와 이야기해요. 먼저 <b>질문의 모양</b>을 잡고(Yes/No · 고르기 · 정보), 대답 틀 칩을 고른 뒤 카드의 정보 칩을 넣어요. 주문할 때는 <b>한 줄 주문</b>(L)으로 음식 · 굽기 · 곁들임 · 드레싱을 한 번에 말하면 서버가 그 질문을 건너뛰어요. 나온 음식이 내가 시킨 것인지, 서버가 말하는 오늘의 스페셜이 무엇인지도 들어 보세요${SRC ? ' — 마이크로 말해서 대답할 수도 있어요' : ''}.</p><button type="button" class="btn" id="simGo">입구에서 시작 (Enter)</button></div>`;
    return;
  }
  if (SIM.done) {
    const first = SIM.log.filter(L => L && L.tries[0] && L.tries[0].ok).length, asked = SIM.log.filter(Boolean).length, saved = SIM.skipped.length;
    const ml = RS.modelLine(C);
    box.innerHTML = `<div class="sim-end"><div class="end-art">${checkHTML(C)}</div><div><p class="sim-score"><b>${first} / ${asked}</b> 질문을 한 번에 통과했어요.</p>
      <p class="sim-saved">${saved ? `한 번에 말해서 서버의 질문 <b>${saved}개</b>를 건너뛰었어요 (${esc(skipLabel(SIM.skipped))}).` : `다음에는 주문할 때 한 줄로 말해 보세요 → <span lang="en">${segHTML(ml)}</span> ${lpBtn(meSeq(ml), '한 줄 주문 듣기')}`}</p>
      <p class="sim-react ok"><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>
      <ol class="sim-log">${SIM.log.filter(Boolean).map(L => `<li><span class="who">${esc(WHO[L.place] || '직원')}</span>${lpBtn([{ text: L.en, sp: L.sp }], '듣기')}<span lang="en">${esc(L.en)}</span><br><span class="who me">나</span>${lpBtn(meSeq(L.final), '듣기')}<span lang="en">${esc(L.final)}</span>${L.tries.length > 1 ? ` <small>(${L.tries.length}번째에 통과)</small>` : ''}</li>`).join('')}</ol>
      <div class="tg-acts"><button type="button" class="btn" id="simAgain">새 카드로 다시 (N)</button>${hear ? `<button type="button" class="btn ghost" data-lp="${seqId(SIM.log.filter(Boolean).flatMap(L => [{ text: L.en, sp: L.sp }, { text: L.final, sp: 'me', gap: 0.4 }]))}">대화 전체 듣기</button>` : ''}</div></div></div>`;
    return;
  }
  const q = simQ(), show = SIM.script || !hear, call = q.intent === 'call';
  let fa = null;
  if (SIM.f) { const Fm = RS.FRAME[SIM.f]; if (!Fm.slot || SIM.v) { fa = { f: SIM.f }; if (Fm.slot) fa.v = SIM.v; if (call && SIM.rf) { if (SIM.rv) fa.req = { f: SIM.rf.f, v: SIM.rv }; } } }
  const ready = fa && (!call || SIM.rf !== undefined) && !(call && SIM.rf && !SIM.rv);
  let h = `${lsnBar(SIM.script)}`;
  h += `<div class="sim-officer">${staffSVG(RSS.kindOf(q))}<p class="sim-bub"><span class="who">${esc(whoOf(q))}</span><span class="ldr-t" lang="en">${lineHTML(q.en, show ? keyMarks(q) : [], show)}</span>${show ? SHI(q.shape) : ''}${hear ? `<button type="button" class="lp-play lp-mini" data-simline="1" aria-label="다시 듣기" title="다시 듣기">${SVG_PLAY}</button>` : ''}</p></div>`;
  if (SIM.react) h += `<p class="sim-react ${SIM.react.st}"><span class="who">${esc(SIM.react.who || whoOf(q))}</span><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>`;
  if (SIM.building) {
    const L = SIM.line, a = { f: 'line', line: { words: L.words.slice() } };
    const chips = Object.assign({}, SIM_LINE_CHIPS, { dish: RS.MAINS.concat(C.special ? ['risotto'] : []) });
    h += `<div class="sim-build"><p class="sim-lab">한 줄 주문 — 조각을 누르는 차례대로 문장이 돼요 <small>L 닫기</small></p>
      ${LINE_ORDER.map(c => `<div class="cv-row"><span class="cv-lab">${esc(RS.OCAT[c].ko)}</span><div class="seg">${chips[c].map(w => `<button type="button" data-sw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(RS.OW[w].t)}</span></button>`).join('')}</div></div>`).join('')}
      <div class="sim-ans"><span class="who me">나</span>${L.words.length ? `<span lang="en" class="sim-line">${segHTML(a)}</span>` : '<span class="note">조각을 고르세요. 음식 · 굽기 · 곁들임은 식사 카드에 있어요.</span>'}</div>
      <div class="tg-acts"><button type="button" class="btn" id="simLine"${L.words.length ? '' : ' disabled'}>말하기 (Enter)</button><button type="button" class="btn ghost" id="simLineClear"${L.words.length ? '' : ' disabled'}>지우기</button><button type="button" class="btn ghost" id="simBuildOff">칩으로 하나씩</button></div></div>`;
  } else {
    h += `<p class="sim-lab">① ${call ? '부르는 말' : '대답 틀'} <small>1~${SIM.frames.length}</small></p><div class="chips" role="group" aria-label="대답 틀">${SIM.frames.map((f, k) => `<button type="button" class="chipf" data-sf="${f}" aria-pressed="${SIM.f === f}"><small>${k + 1}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}${q.intent === 'ready' ? '<button type="button" class="chipf chip-line" id="simBuildOn"><small>L</small> 한 줄 주문 (한 번에 말하기)</button>' : ''}</div>`;
    const Fm = SIM.f ? RS.FRAME[SIM.f] : null;
    if (Fm && Fm.slot) h += `<p class="sim-lab">② 내 정보 넣기 <small>A~C</small></p><div class="chips" role="group" aria-label="칸에 넣을 정보">${SIM.slots[SIM.f].map((v, k) => `<button type="button" class="chips-s" data-sv="${esc(v)}" aria-pressed="${SIM.v === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(slotLabel(SIM.f, v))}</span></button>`).join('')}</div>`;
    if (call) {
      h += `<p class="sim-lab">② 부탁 붙이기 <small>5~7</small></p><div class="chips" role="group" aria-label="부탁">${SIM.reqs.map((r, k) => `<button type="button" class="chipf chip-req" data-sr="${k}" aria-pressed="${SIM.rf === r || (SIM.rf && r && SIM.rf.f === r.f)}"><small>${k + 5}</small> ${r ? `<span lang="en">${chipT(r.f)}</span>` : '부탁 없이'}</button>`).join('')}</div>`;
      if (SIM.rf) h += `<div class="chips" role="group" aria-label="필요한 것">${SIM.slots.req.map((v, k) => `<button type="button" class="chips-s" data-srv="${esc(v)}" aria-pressed="${SIM.rv === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(RS.SLOT.need.vals[v][RS.FRAME[SIM.rf.f].form || 't'])}</span></button>`).join('')}</div>`;
    }
    h += `<div class="sim-ans"><span class="who me">나</span>${fa ? `<span lang="en" class="sim-line">${segHTML(fa)}</span>` : SIM.f ? `<span lang="en" class="sim-line">${chipT(SIM.f)}</span>` : '<span class="note">틀을 고르세요.</span>'}</div>`;
    h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${ready ? '' : ' disabled'}>대답하기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${SIM.f ? '' : ' disabled'}>지우기</button>${SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 대답하기 (M)'}</button>` : ''}</div>`;
  }
  if (SIM.heard) h += `<p class="note">들린 말: <span lang="en">${esc(SIM.heard)}</span></p>`;
  if (SIM.why) {
    const { j, model } = SIM.why, st = j.ok ? '통과' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸렸어요';
    h += `<div class="sim-why ${j.ok ? 'ok' : 'no'}"><p><b>${esc(st)}</b> ${esc(j.why)}</p>${j.ok ? '' : `<p>모범 대답 ${lpBtn(meSeq(model), '모범 대답 듣기')}<span lang="en">${segHTML(model)}</span> <small>${esc(RS.ko(model))}</small></p>`}${SIM.why.spoken ? '<p class="note">말로 한 대답은 낱말과 카드의 사실만 맞춰 봐요. 질문의 모양(yes · no만 했는지)은 보지만, 공손함과 발음은 판정하지 않아요.</p>' : ''}</div>`;
  }
  box.innerHTML = h;
  paintPlay($('sim'), SIM.mode);
}
const LOOKS = { host: ['#2F3B4A', '#E3B48D', '#3A2A20'], server: ['#1F2A30', '#D9A57C', '#1F1B18'], runner: ['#E6EAEE', '#C99169', '#2B2420'], uk: ['#3A2E4A', '#E8BC95', '#5A3A28'] };
const staffSVG = kind => { const [sh, sk, hr] = LOOKS[kind] || LOOKS.server; return `<svg class="sim-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#202A36"/><ellipse cx="24" cy="47" rx="19" ry="14" fill="${sh}"/>${kind === 'server' || kind === 'uk' ? `<rect x="16" y="36" width="16" height="12" rx="2" fill="${kind === 'uk' ? '#5A4A6A' : '#3E5A4C'}"/>` : ''}${kind === 'host' ? '<path d="M19.5 34l4.5 5 4.5-5z" fill="#EEF1F4"/><rect x="28" y="38" width="5" height="2.5" fill="#FFC15E"/>' : ''}<circle cx="24" cy="21" r="8.5" fill="${sk}"/><path d="M15.5 19a8.5 8.5 0 0 1 17 0z" fill="${hr}"/>${kind === 'runner' ? '<rect x="16.5" y="9" width="15" height="6" rx="1.5" fill="#F4F6F8"/><circle cx="20.5" cy="9" r="4" fill="#F4F6F8"/><circle cx="27.5" cy="9" r="4" fill="#F4F6F8"/>' : ''}${kind === 'uk' ? '<circle cx="24" cy="11" r="3" fill="#5A3A28"/>' : ''}<circle cx="21" cy="22" r="1" fill="#2B2420"/><circle cx="27" cy="22" r="1" fill="#2B2420"/></svg>`; };
function simKeep() { if (!$('sim').contains(document.activeElement) || !document.activeElement.isConnected) $('sim').focus({ preventScroll: true }); }
function simMic() {
  if (!SRC || SIM.done || !SIM.started) return;
  if (SIM.listening) { stopListening(); return; }
  listenOnce({
    onState(on) { SIM.listening = on; simBuild(); simKeep(); },
    onText(alts) { const q = simQ(), C = simC(), best = alts.find(t => RS.matchSpoken(t, q, C).ok) || alts[0]; simAnswer(null, best); simKeep(); },
    onFail(msg) { SIM.react = { en: '…', ko: msg, st: 'no' }; simBuild(); simKeep(); },
  });
}
function simLineSubmit() { const L = SIM.line; if (!L.words.length) return; simAnswer({ f: 'line', line: { words: L.words.slice() } }); }
function simSayChips() {
  const q = simQ(); if (!SIM.f) return;
  const Fm = RS.FRAME[SIM.f]; if (Fm.slot && !SIM.v) return;
  const a = { f: SIM.f }; if (Fm.slot) a.v = SIM.v;
  if (q.intent === 'call') { if (SIM.rf === undefined) return; if (SIM.rf) { if (!SIM.rv) return; a.req = { f: SIM.rf.f, v: SIM.rv }; } }
  simAnswer(a);
}
function simInit() {
  $('simNew').addEventListener('click', () => { simNew(); SIM.started = false; simBuild(); });
  $('sim').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.id === 'simGo') { SIM.started = true; simBuild(); simAsk(); simKeep(); return; }
    if (b.id === 'simAgain') { simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); return; }
    if (b.dataset.sf) { SIM.f = b.dataset.sf; SIM.v = null; simBuild(); simKeep(); return; }
    if (b.dataset.sv != null) { SIM.v = b.dataset.sv; simBuild(); simKeep(); return; }
    if (b.dataset.sr != null) { SIM.rf = SIM.reqs[+b.dataset.sr]; SIM.rv = null; simBuild(); simKeep(); return; }
    if (b.dataset.srv != null) { SIM.rv = b.dataset.srv; simBuild(); simKeep(); return; }
    if (b.id === 'simSay') { simSayChips(); simKeep(); return; }
    if (b.id === 'simClear') { SIM.f = null; SIM.v = null; SIM.rf = undefined; SIM.rv = null; simBuild(); simKeep(); return; }
    if (b.id === 'simMic') { simMic(); return; }
    if (b.id === 'simBuildOn') { SIM.building = true; simBuild(); simKeep(); return; }
    if (b.id === 'simBuildOff') { SIM.building = false; simBuild(); simKeep(); return; }
    if (b.dataset.sw) {
      const w = b.dataset.sw, L = SIM.line, c = RS.OW[w].c;
      if (L.words.includes(w)) L.words = L.words.filter(x => x !== w);
      else { L.words = L.words.filter(x => RS.OW[x].c !== c); L.words.push(w); }
      simBuild(); simKeep(); return;
    }
    if (b.id === 'simLine') { simLineSubmit(); simKeep(); return; }
    if (b.id === 'simLineClear') { SIM.line = { words: [] }; simBuild(); simKeep(); return; }
    if (b.dataset.simline) { simAsk(null, false); return; }
    if (b.dataset.act === 'play') { if (SIM.mode === 'play' && RSV.busy()) RSV.stop(); else simAsk(null, false); return; }
    if (b.dataset.act === 'slowplay') { if (SIM.mode === 'slowplay' && RSV.busy()) RSV.stop(); else simAsk(null, true); return; }
    if (b.dataset.act === 'script') { SIM.script = !SIM.script; simBuild(); simKeep(); }
  });
  $('sim').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), onBtn = e.target.closest && e.target.closest('button');
    if (!SIM.started) { if (e.key === 'Enter' && !onBtn) { e.preventDefault(); $('simGo').click(); } return; }
    if (SIM.done) { if (k === 'N' || (e.key === 'Enter' && !onBtn)) { e.preventDefault(); $('simAgain').click(); } return; }
    const n = '1234'.indexOf(e.key), rq = '567'.indexOf(e.key), sv = 'ABC'.indexOf(k), q = simQ();
    if (k === 'L' && q.intent === 'ready') { e.preventDefault(); SIM.building = !SIM.building; simBuild(); simKeep(); return; }
    if (SIM.building) {
      if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simLineSubmit(); simKeep(); }
      else if (e.key === 'Backspace') { e.preventDefault(); SIM.line.words.pop(); simBuild(); simKeep(); }
      return;
    }
    if (n >= 0 && n < SIM.frames.length) { e.preventDefault(); SIM.f = SIM.frames[n]; SIM.v = null; simBuild(); simKeep(); }
    else if (rq >= 0 && q.intent === 'call' && rq < SIM.reqs.length) { e.preventDefault(); SIM.rf = SIM.reqs[rq]; SIM.rv = null; simBuild(); simKeep(); }
    else if (sv >= 0 && q.intent === 'call' && SIM.rf && SIM.slots.req[sv] != null) { e.preventDefault(); SIM.rv = SIM.slots.req[sv]; simBuild(); simKeep(); }
    else if (sv >= 0 && SIM.f && RS.FRAME[SIM.f].slot && SIM.slots[SIM.f][sv] != null) { e.preventDefault(); SIM.v = SIM.slots[SIM.f][sv]; simBuild(); simKeep(); }
    else if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simSayChips(); simKeep(); }
    else if (e.key === 'Backspace') { e.preventDefault(); SIM.f = null; SIM.v = null; SIM.rf = undefined; SIM.rv = null; simBuild(); simKeep(); }
    else if (k === 'R' && RSV.supported) { e.preventDefault(); simAsk(null, false); }
    else if (k === 'S' && RSV.supported) { e.preventDefault(); simAsk(null, true); }
    else if (k === 'T' && RSV.supported) { e.preventDefault(); SIM.script = !SIM.script; simBuild(); simKeep(); }
    else if (k === 'M' && SRC) { e.preventDefault(); simMic(); }
    else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
  });
  simNew(); SIM.started = false; simBuild();
}

/* =========================================================
   11. 식당 표현 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 숫자는 15든 fifteen이든 같은 숫자로 맞춰요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = RS.PLACES.map(p => ({ p, rows: RS.SHADOW.map((s, i) => [s, i]).filter(([s]) => s.place === p.id) })).filter(g => g.rows.length);
  $('shList').innerHTML = groups.map(({ p, rows }) => `<section class="sh-grp"><h3>${PI(p.id)}${esc(p.ko)} <span lang="en">${esc(p.en)}</span></h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${RSV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-who ${s.who}">${s.who === 'me' ? '나' : esc(WHO[s.place] || '직원')}</span><span class="sh-en" lang="en">${esc(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { const s = RS.SHADOW[i]; return [{ text: s.en, sp: s.sp }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = RS.SHADOW[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, RS.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.words.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.t)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}${/Park/.test(s.en) && r.hit < r.total ? ' (이름은 음성 인식이 다르게 적기 쉬워요.)' : ''}</p>`);
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${RSV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
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
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (b) b.classList.remove('saying'); if (thenOrig && RSV.supported) speak(shSeq(i)); };
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
const qLetter = (g, x, y, k) => { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill(); g.font = qfont(12, 700); g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCDE'[k], x, y + 1); };
// 질문의 모양 넷 (A~D)
function shapeFig(label) {
  const ids = ['yn', 'or', 'wh', 'note'], Wd = 600, H = 210, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: (x, y) => y > 8 && y < H - 4 ? Math.min(3, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      ids.forEach((sh, k) => {
        const x = k * cw + cw / 2, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, k * cw + 8, 10, cw - 16, H - 22, 12); g.fillStyle = st.hover === k ? QCOL.hover : 'rgba(255,255,255,0.03)'; g.fill();
        if (on || wrong) { g.strokeStyle = on ? QCOL.p : QCOL.bad; g.lineWidth = 3; g.stroke(); }
        g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L4[k], x, 32);
        RSS.shapeMark(g, sh, x, 92, 34);
        g.font = qfont(14, 700); g.fillStyle = QCOL.text; g.fillText(RS.SHAPE[sh].ko, x, 150);
        g.font = qfont(12, 500); g.fillStyle = QCOL.muted; g.fillText(RS.SHAPE[sh].mark, x, 172);
      });
    } };
}
// 스테이크 굽기 띠 (A~E)
function doneFig(label) {
  const Wd = 600, H = 190; let boxes = [];
  return { width: Wd, height: H, label,
    pick: (x, y) => boxes.findIndex(b => x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      const hl = {}; [0, 1, 2, 3, 4].forEach(i => { if (st.done && i === st.answer) hl[i] = '#FFC15E'; else if (st.done && i === st.pick) hl[i] = '#FF8E8E'; else if (st.hover === i) hl[i] = '#6EC8FF'; });
      g.save(); boxes = RSS.doneStrip(g, 30, 40, 540, { hl, noKo: true, noHit: true, size: 14, h: 80 }); g.restore();
      boxes.forEach((b, i) => qLetter(g, b.x + 6, b.y - 2, i));
    } };
}
// 메뉴판 (주 요리 넷 A~D)
function menuFig(label, ids) {
  const Wd = 600, H = 404; let boxes = null;
  return { width: Wd, height: H, label,
    pick: (x, y) => { if (!boxes) return -1; return ids.findIndex(k => { const b = boxes[k]; return b && x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4; }); },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      const hl = {}; ids.forEach((k, i) => { if (st.done && i === st.answer) hl[k] = '#FFC15E'; else if (st.done && i === st.pick) hl[k] = '#FF8E8E'; else if (st.hover === i) hl[k] = '#6EC8FF'; });
      g.save(); boxes = RSS.menuDraw(g, 125, 12, 350, { hl }).boxes; g.restore();
      ids.forEach((k, i) => { const b = boxes[k]; if (b) qLetter(g, b.x - 16, b.y + b.h / 2, i); });
    } };
}
// 계산서 (줄 넷 A~D)
function checkFig(label, card, ids) {
  const Wd = 600, H = 360; let boxes = null;
  return { width: Wd, height: H, label,
    pick: (x, y) => { if (!boxes) return -1; return ids.findIndex(k => { const b = boxes[k]; return b && x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4; }); },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      const hl = {}; ids.forEach((k, i) => { if (st.done && i === st.answer) hl[k] = '#FFC15E'; else if (st.done && i === st.pick) hl[k] = '#FF8E8E'; else if (st.hover === i) hl[k] = '#6EC8FF'; });
      g.save(); boxes = RSS.checkDraw(g, 130, 14, 380, card, { hl }).boxes; g.restore();
      ids.forEach((k, i) => { const b = boxes[k]; if (b) qLetter(g, b.x - 18, b.y + b.h / 2, i); });
    } };
}
const QS = (() => {
  const o = RS.o, j = (q, a, c) => RS.judge(q, a, c || {}).ok, D = RS.DEMO;
  const water = [o('g_yesp'), o('wa_pl', 'sparkling'), o('wa_pl', 'still'), o('dk_could', 'lemonade')];
  const party = [o('g_yesp'), o('ps_n', 'p2'), o('st_pl', 'outside'), o('ps_n', 'p3')];
  const soda = [o('dk_short', 'cider'), o('dk_could', 'soda'), o('dk_give', 'soda'), o('wa_pl', 'still')];
  const call = [o('cl_ex', null, o('rq_could', 'water')), o('cl_hey', null, o('rq_could', 'water')), o('cl_waiter', null, o('rq_give', 'water')), o('cl_here', null, o('rq_could', 'water'))];
  const lines = [RS.LINE_BAD, { words: ['please', 'have', 'steak', 'mediumrare', 'salad'] }, { words: ['have', 'salad', 'steak', 'mediumrare', 'please'] }, RS.LINE];
  const B = RS.bill(D), each = RS.split(B, D.party).each, spIdx = B.items.findIndex(x => x.id === 'sparkling');
  const q = [
    { q: 'Still or sparkling? — 탄산수를 마시고 싶어요. 가장 알맞은 대답은?', opts: water.map(RS.text), a: 1,
      why: 'A or B? → 고르는 질문이에요. 둘 가운데 하나를 골라 + please → Sparkling, please. Yes, please.는 무엇을 골랐는지 알 수 없고, Still은 탄산이 없는 물, 레모네이드는 다른 질문(음료)의 대답이에요.',
      check: () => water.map(a => j('dk_water', a, { water: 'sparkling' })).join() === 'false,true,false,false' },
    { q: '서버가 묻는 말: How would you like your steak cooked? 이 질문의 모양은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: shapeFig('질문의 모양 넷. A Yes/No 질문(스위치), B 고르는 질문(갈림길), C 정보 질문(빈 상자), D 안내(말풍선)'),
      why: 'How would you like …? → 어떻게 구울지 정보를 묻는 정보 질문(빈 상자)이에요. 정보 + please → Medium, please. Yes · No로는 답이 안 돼요.',
      check: () => RS.Q.or_cook.shape === 'wh' },
    { q: 'No problem. How many are in your party? — 셋이 왔어요. 가장 알맞은 대답은?', opts: party.map(RS.text), a: 3,
      why: 'How many? → 정보 질문. 수 + please → Three, please. (A table for three, please.도 좋아요.) Yes, please.는 정보가 없고, Outside는 자리를 고르는 질문의 대답이에요.',
      check: () => party.map(a => j('d_many', a, { party: 3 })).join() === 'false,false,false,true' },
    { q: '호스트가 “It\'ll be about a fifty-minute wait.”라고 말했어요. 몇 분을 기다려야 하나요?', opts: ['50분', '15분', '5분', '40분'], a: 0,
      why: 'fifty → 앞(FIF)을 세게 → 50분. fifteen(15)은 뒤(TEEN)를 세게 말해요. 헷갈리면 → Sorry, did you say fifty minutes?',
      check: () => RS.numWord(50) === 'fifty' && RS.canon('fifty').includes('50') },
    { q: '스테이크를 가운데까지 분홍빛이 도는 ‘미디엄’으로 먹고 싶어요. 굽기 띠에서 medium을 누르세요.', opts: ['A', 'B', 'C', 'D', 'E'], a: 2,
      figure: doneFig('스테이크 굽기 띠. A rare, B medium-rare, C medium, D medium-well, E well-done'),
      why: '굽기는 → rare(레어) · medium-rare · medium(미디엄) · medium-well · well-done(웰던). 정보 질문이니 → Medium, please. ‘중간’을 옮긴 Middle은 굽기를 말하는 낱말이 아니에요.',
      check: () => RS.judge('or_cook', o('cook_pl', 'medium'), { cook: 'medium' }).ok && !RS.judge('or_cook', o('cook_pl', 'middle'), { cook: 'medium' }).ok },
    { q: 'Great. And can I get you something else to drink? — 사이다를 마시고 싶어요. 가장 알맞은 말은?', opts: soda.map(RS.text), a: 1,
      why: '영어로 cider는 사과로 만든 음료이고, 영국에서는 보통 술이에요. 한국의 사이다 → a lemon-lime soda. 권하는 Yes/No 질문이라 원하는 것을 바로 말해도 돼요. Give me는 명령처럼 들리고, Still은 물을 고르는 대답이에요.',
      check: () => soda.map(a => j('dk_more', a, { drink: 'soda' })).join() === 'false,true,false,false' },
    { q: '땅콩 알레르기가 있어요. 메뉴판의 표시(P 땅콩)를 보세요. 땅콩이 들어 있는 음식은? 그림 속 줄을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: menuFig('메뉴판. A Ribeye steak, B Grilled salmon, C Peanut noodles(P · S 표시), D Veggie burger(M 표시)', ['steak', 'salmon', 'noodles', 'burger']),
      why: 'Peanut noodles → 땅콩 소스(P)라 뺄 수 없어요. 서버에게 직접 말해요 → I\'m allergic to peanuts. 메뉴 표시만 믿지 말고 꼭 물어요(메뉴는 지어낸 것이에요).',
      check: () => { const s = RS.safe('noodles', 'peanuts'); return s.contains && !s.removable && ['steak', 'salmon', 'burger'].every(d => !RS.safe(d, 'peanuts').contains); } },
    { q: '물이 더 필요해요. 서버가 옆 테이블에 인사하며 지나가요. 가장 알맞은 말은?', opts: call.map(RS.text), a: 0,
      why: '서버를 부를 때 → Excuse me. (눈을 맞추거나 손을 살짝 들어요.) 부탁은 질문으로 → Could I get some more water, please? Hey! · Waiter! · Here!(‘여기요’ 그대로)는 무례하게 들려요.',
      check: () => call.map(a => j('ml_pass', a, { need: 'water' })).join() === 'true,false,false,false' },
    { q: `친구와 둘이 똑같이 나눠 내요(Separate, please.). 계산서에서 한 사람이 낼 값이 적힌 줄은? 그림 속 줄을 눌러도 돼요.`, opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: checkFig(`계산서. A Ribeye steak ${RS.money(B.items[0].c)}, B Sparkling water ${RS.money(RS.MENU.sparkling.p)}, C TOTAL ${RS.money(B.total)}, D EACH ${RS.money(each)}`, D, [0, spIdx, 'total', 'each']),
      why: `합계 ${RS.money(B.total)} → 둘이 똑같이 나누면 한 사람 ${RS.money(each)}. 서버 → That's ${RS.money(each)} each. (값은 지어낸 것이고, 세금 · 팁은 나라마다 달라서 뺐어요.)`,
      check: () => each === 2850 && spIdx > 0 },
    { q: 'Are you ready to order? — 스테이크를 미디엄 레어로, 샐러드와 함께 먹고 싶어요. 순서가 가장 자연스러운 한 줄은?', opts: lines.map(RS.lineText), a: 3,
      why: '음식 → 굽기 → with 곁들임 → please → I\'ll have the ribeye steak, medium-rare, with a salad …, please. 그러면 서버가 굽기와 곁들임을 묻지 않아요. (자주 쓰는 순서를 단순하게 줄인 규칙이에요.)',
      check: () => lines.map(L => j('or_ready', { f: 'line', line: L }, D)).join() === 'false,false,false,true' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[식당] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { if (x.a < 4) pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[식당] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { RSV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = RSS.chapterAt(T);
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
// 화면 누르기: 말풍선은 그 사람 목소리로, 영어 칩은 발음 듣기, 지도의 곳은 고르기, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * RSS.W, (e.clientY - r.top) / r.height * RSS.H]; };
const hitAt = (x, y) => started ? RSS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.stop != null) { S.stop = S.stop === h.stop ? null : h.stop; relab(); }
  else if (h && h.play && RSV.supported) speak(h.play);
  else if (h && h.say && EN.say.supported) { stopSounds(); if (playing) pause(); EN.say(RS.spoken(h.say)); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.stop != null ? '눌러서 이곳의 말 보기' : h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { RSV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = RSV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
simInit();
shInit();
RDrill($('drillRoot'), RS.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 모양 잡기 → 틀 + 내 정보 → 공손하게, 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 02 · 09 · 10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '식당의 일곱 곳과 질문의 모양이 모두 익숙해졌네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(RSS.baseText()).then(() => { dirty = true; });
setTimeout(() => RSS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
