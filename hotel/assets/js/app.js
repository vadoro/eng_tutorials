/* 호텔 회화 — 플레이어, 직접 해 보기, 호텔 숙박 시뮬레이터, 따라 말하기, 듣고 대답 고르기, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(HT), 그림은 scenes.js(HTS), 목소리는 voices.js(HTV)가 맡습니다.
 * 소리가 겹치지 않게: 대화를 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(HTV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const HT = window.HT, HTS = window.HTS, HTV = window.HTV, S = HTS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = HTS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cv = $('cv'), ctx = cv.getContext('2d');
HT.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = HTS.fonts;
const FONT_SET = [[700, F.FD], [800, F.FD], [400, F.FB], [500, F.FB], [600, F.FB], [700, F.FB], [400, F.FM], [500, F.FM], [600, F.FM], [700, F.FM]];
const loadFonts = text => Promise.race([
  Promise.all(FONT_SET.map(([w, f]) => document.fonts.load(`${w} 20px ${f}`, text).catch(() => null))),
  new Promise(r => setTimeout(r, 15000)),
]).then(() => document.fonts.ready);

/* =========================================================
   2. 영상 추출 — 사이트 공통 렌더러가 쓰는 약속
   ========================================================= */
if (EXPORT) {
  cv.width = 1920; cv.height = 1080;
  const ready = new Promise(res => HTS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '호텔, 부탁은 질문으로 한다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { HTS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: HTS.iconSVG('mic'),
};
const PI = id => HTS.iconSVG(id, 'pi');   // 곳 아이콘
// 듣기 · 천천히 · 대본 보기 단추 묶음 (공항 · 카페와 같은 모양 · 같은 키 R · S · T)
const lsnBar = scriptOn => HTV.supported
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
  const cap = started ? HTS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 말풍선을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = HTS.chapterAt(T);
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
  if (dirty) { dirty = false; HTS.render(ctx, started ? T : POSTER); }
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
function stopSounds() { EN.say.stop(); HTV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return HTV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름
const lpBtn = (seq, label, cls = '') => HTV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-lp]');
  if (!b) return;
  const box = b.closest('[data-slow]'), slow = !!box && box.getAttribute('data-slow') === '1';
  document.querySelectorAll('.lp-play.saying').forEach(x => x.classList.remove('saying'));
  b.classList.add('saying');
  speak(SEQS[+b.dataset.lp], { slow, onend() { b.classList.remove('saying'); } });
});
const staffSeq = q => [{ text: q.en, sp: q.sp, rate: q.fast ? 1.35 : 1 }];
const meSeq = a => [{ text: typeof a === 'string' ? a : HT.text(a), sp: 'me' }];
const WHO = { checkin: '프런트', key: '프런트', call: '전화', problem: '전화', breakfast: '조식 식당', concierge: '컨시어지', checkout: '프런트' };

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
const segHTML = (a, on = true) => HT.segs(a).map(s => on && s.t.trim() && /[A-Za-z0-9]/.test(s.t) ? `<mark class="mk-${s.r}">${esc(s.t)}</mark>` : esc(s.t)).join('');
const keyMarks = q => q.key.map(t => ({ t, role: 'key' }));

/* =========================================================
   6. 듣고 대답 고르기 (이 튜토리얼 전용, 공항 ADrill · 카페 CDrill과 같은 모양) — 직원의 말은 소리 먼저, 대답 넷은 글
   생김새와 키보드는 공통 부품 EN.drill과 같게: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본 · Enter/→ 다음
   ========================================================= */
function HDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null;
  const compact = !!cfg.compact, hear = HTV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && HTV.busy()) { HTV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(staffSeq(it.Q), { slow: !!slow, onitem() { paintNow(root, '.ldr-q'); say(it.Q.fast ? '직원이 빠르게 말하는 중' : '직원이 말하는 중'); },
      onend(stopped) { mode = null; paintPlay(root, null); paintNow(root, null); say(stopped ? '' : '다 들었어요. 대답을 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { HTV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; HTV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    HTV.stop();
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = HT.steps(it), place = HT.PLACE[it.place];
    const marks = []; steps.slice(0, done ? 3 : s.hints).reverse().forEach(x => marks.push(...x.marks));   // 뒤 단계의 색이 앞 단계를 덮음
    const reveal = done || !hear || s.script, mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur), ask = HT.ASK[HT.INTENT[it.Q.intent].ask].ko;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${PI(it.place)}${esc(place.ko)}</span><span>${compact ? '듣고 대답 고르기' : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span>${done ? `<span class="edr-tag">${it.Q.fast ? '다시 묻기' : esc(ask)}</span>` : ''}</p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(it.sit)}</p>`;
    h += lsnBar(done ? null : s.script);
    h += `<p class="ldr-q"><b>${esc(WHO[it.place] || '직원')}</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="q" aria-label="직원의 말 다시 듣기" title="직원의 말 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.Q.en, mk('q'), reveal)}</span>${it.Q.fast && !done ? '<small class="adr-fast">아주 빠르게</small>' : ''}</p>`;
    h += `<p class="adr-ask">나의 대답은?</p><div class="ldr-opts" role="group" aria-label="대답 보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '', t = HT.text(op);
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-lp="${seqId(meSeq(t))}" aria-label="(${L4[k]}) 듣기" title="(${L4[k]}) 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(t, mk(k), true)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + HT.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = [[`${WHO[it.place] || '직원'} · ${it.Q.en}`, it.Q.ko, staffSeq(it.Q)]].concat(it.opts.map((op, k) => [`(${L4[k]}) ${HT.text(op)}`, HT.ko(op), meSeq(op)]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      h += `<div class="edr-acts">${hear ? `<button type="button" class="edr-btn ghost adr-ex" data-lp="${seqId(staffSeq(it.Q).concat([{ text: HT.text(it.opts[it.a]), sp: 'me', gap: 0.5 }]))}">${ICO.play} 대화 듣기 (직원 → 나)</button>` : ''}${compact ? '' : `<button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button>`}</div>`;
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
const frameT = f => esc(HT.FRAME[f].t.replace(/[{}]/g, ''));
const en = s => `<span lang="en">${esc(s)}</span>`;
const LAB = {
  nights: { n: 2, f: 'nt_n', v: null },
  room: null,
  call: { want: 'towels2', f: 'cl_could', v: null },
  prob: { p: 'ac', f: 'pf_isnt', v: null, rf: null, rv: null },
  cg: { want: 0, f: 'cg_hold', v: null },
  bill: { nights: 2, minibar: 'none', billErr: 'minibar' },
  line: { words: [], room: '1207' },
};
const NIGHT_VALS = ['n1', 'n2', 'n3', 'd2', 'd3', 'd4'];
const CALL_VALS = ['towels', 'towels2', 'towels3', 'pillow', 'toothbrush', 'adapter', 'hairdryer', 'dryer'];
const CG_TIMES = { wtime: ['6:13', '6:30', '7:30'], htime: ['2:00', '3:00', '4:00'] };
const LINE_ORDER = ['hi', 'room', 'ask', 'thing', 'please', 'thanks'];
const nightsAns = () => { const r = LAB.nights; return r.v ? { f: r.f, v: r.v } : null; };
const callAns = () => { const r = LAB.call; return r.v ? { f: r.f, v: r.v } : null; };
const probAns = () => { const r = LAB.prob, F0 = HT.FRAME[r.f]; if (F0.slot && !r.v) return null; const a = { f: r.f }; if (F0.slot) a.v = r.v; if (r.rf) { const R0 = HT.FRAME[r.rf]; if (R0.slot && !r.rv) return a; a.req = { f: r.rf }; if (R0.slot) a.req.v = r.rv; } return a; };
const cgAns = () => { const r = LAB.cg, F0 = HT.FRAME[r.f]; if (F0.slot && !r.v) return null; return F0.slot ? { f: r.f, v: r.v } : { f: r.f }; };
const cgCard = () => { const [want, time] = HT.CG_SIT[LAB.cg.want]; const c = { want }; if (want === 'wake') c.wake = time; if (want === 'hold') c.hold = time; return c; };
const billCard = () => Object.assign({}, HT.DEMO, { nights: LAB.bill.nights, minibar: LAB.bill.minibar, billErr: LAB.bill.minibar !== 'none' && LAB.bill.billErr === 'minibar' ? 'none' : LAB.bill.billErr });
const LABS = {
  intro: () => `${labHead('먼저 전화로 부탁해 보세요')}${mini('intro')}
    <p class="note">직원의 말을 듣고 대답을 고르세요. 직원의 말은 답한 뒤에 글로 보여요. 막히면 힌트(H)로 3단계를 하나씩 열어 보세요.</p>`,
  route: () => {
    const i = S.stop, p = i != null ? HT.PLACES[i] : null;
    return `${labHead('곳을 골라 한두 마디 듣기')}
      ${seg('곳', HT.PLACES.map((x, k) => [k, `${PI(x.id)}${k + 1}. ${esc(x.ko)}`]), i == null ? '' : i, 'stop')}
      ${p ? `<ul class="qlist">${HT.ROUTE[p.id].map(id => { const q = HT.Q[id]; return `<li>${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span><span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span><small>${esc(q.ko)}</small></span></li>`; }).join('')}</ul>
        ${clearBtn}` : '<p class="note">곳을 고르면 그곳에서 자주 듣는 말을 들을 수 있고, 영상 화면의 지도에도 표시돼요. 하늘색 → 열쇠 낱말. 보라색 테두리의 곳(전화 부탁 · 문제 · 컨시어지)에서는 내가 먼저 말을 꺼내요.</p>'}`;
  },
  checkin: () => {
    const r = LAB.nights, a = nightsAns(), j = a ? HT.judge('ci_nights', a, { nights: r.n }, '상황') : null;
    return `${labHead('며칠 밤인지 말하기')}
      <p class="note">직원이 <span lang="en">How many nights will you be staying?</span> 하고 물어요. 내 숙박 →</p>
      ${seg('숙박', [1, 2, 3].map(n => [n, HT.nightsKo(n)]), r.n, 'nn')}
      <h3 class="mt">① 틀 고르기</h3>${seg('틀', ['nt_n', 'nt_for', 'nt_during'].map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.f, 'nf')}
      <h3 class="mt">② 칸 채우기</h3>${seg('칸', NIGHT_VALS.map(k => [k, `<span lang="en">${esc(HT.SLOT.nights.vals[k][HT.FRAME[r.f].form || 't'])}</span>`]), r.v || '', 'nv')}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${clearBtn}` : '<p class="note">틀과 칸을 고르면 영상 화면에 해와 달(날과 밤)이 그려지고, 규칙 엔진이 3단계로 판정해요. 일부러 ‘날’로 세어 보세요(<span lang="en">Three days</span>).</p>'}`;
  },
  key: () => {
    const r = LAB.room;
    return `${labHead('방 번호 듣고 읽기')}
      <p class="note">방 번호를 고르면 영상 화면의 카드 키 봉투가 바뀌어요. 듣기로 읽는 법을 들어 보세요.</p>
      ${seg('방 번호', Object.keys(HT.ROOMS).map(k => [k, `<span lang="en">${k}</span>`]), r || '', 'rm')}
      ${r ? `<ul class="qlist">${[r].concat(HT.ROOMS[r]).map((n, k) => `<li>${lpBtn([{ text: `Room ${n}.`, sp: 'us' }], `듣기: room ${n}`)}<span><span lang="en">${esc(n)} → ${esc(HT.roomWords(n))}</span><small>${k ? '헷갈리기 쉬운 이웃 번호' : `${HT.floorOf(n)}층 → ${esc(HT.floorWords(HT.floorOf(n)))}`}</small></span></li>`).join('')}</ul>${clearBtn}` : ''}
      <h3 class="mt">빠른 말 듣고 되묻기</h3>${mini('repair')}`;
  },
  call: () => {
    const r = LAB.call, a = callAns(), card = HT.valFact('thing', r.want), j = a ? HT.judge('cl_help', a, card, '상황') : null, F0 = HT.FRAME[r.f];
    return `${labHead('전화로 부탁하는 말 만들기')}
      <p class="note">직원이 <span lang="en">Front desk. How can I help you?</span> 하고 받았어요. 필요한 것 →</p>
      ${seg('필요한 것', HT.CALL_THINGS.map(k => [k, esc(HT.SLOT.thing.vals[k].ko)]), r.want, 'cw')}
      <h3 class="mt">① 부탁 틀 고르기</h3>${seg('틀', HT.CALL_FRAMES.map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.f, 'cf')}
      <h3 class="mt">② 칸 채우기</h3>${seg('칸', CALL_VALS.map(k => [k, `<span lang="en">${esc(HT.SLOT.thing.vals[k][F0.form || 't'])}</span>`]), r.v || '', 'cv')}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${clearBtn}` : '<p class="note">I → 내가 받을 때, you → 직원이 해 줄 때. ‘드라이기’를 그대로 옮긴 <span lang="en">a dryer</span>나 명령하는 <span lang="en">Give me</span>도 넣어 보세요.</p>'}`;
  },
  problem: () => {
    const r = LAB.prob, a = probAns(), j = a ? HT.judge('pr_help', a, { prob: r.p }, '상황') : null, F0 = HT.FRAME[r.f], R0 = r.rf ? HT.FRAME[r.rf] : null;
    const vals = F0.slot ? Object.keys(HT.SLOT[F0.slot].vals) : [];
    return `${labHead('사실 + 부탁 만들기')}
      <p class="note">프런트에 전화했어요 → <span lang="en">Front desk. What can I do for you?</span> 지금 생긴 문제 →</p>
      ${seg('문제', HT.PR_SIT.map(k => [k, esc(HT.PROB[k].ko)]), r.p, 'pp')}
      <h3 class="mt">① 사실 틀</h3>${seg('사실', HT.PR_FACTS.map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.f, 'pf')}
      ${vals.length ? `<div class="seg">${vals.map(k => `<button type="button" data-pv="${k}" aria-pressed="${r.v === k}"><span lang="en">${esc(HT.SLOT[F0.slot].vals[k].t)}</span></button>`).join('')}</div>` : ''}
      <h3 class="mt">② 부탁 (없어도 돼요)</h3>${seg('부탁', [['', '부탁 없이']].concat(HT.PR_REQS.map(f => [f, `<span lang="en">${frameT(f)}</span>`])), r.rf || '', 'pr')}
      ${R0 && R0.slot ? `<div class="seg">${Object.keys(HT.SLOT.bring.vals).map(k => `<button type="button" data-prv="${k}" aria-pressed="${r.rv === k}"><span lang="en">${esc(HT.SLOT.bring.vals[k].t)}</span></button>`).join('')}</div>` : ''}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${clearBtn}` : '<p class="note">사실 틀과 칸을 고르면 영상 화면에 문장이 만들어지고, 규칙 엔진(HT.fix)이 문제와 부탁이 맞는지도 봐요. 콘센트 → consent를 넣어 보세요.</p>'}`;
  },
  morning: () => {
    const r = LAB.cg, a = cgAns(), card = cgCard(), j = a ? HT.judge('cg_help', a, card, '상황') : null, F0 = HT.FRAME[r.f];
    return `${labHead('컨시어지에 부탁하기')}
      <p class="note">컨시어지 → <span lang="en">Hello. How can I help you today?</span> 하고 싶은 것 →</p>
      ${seg('하고 싶은 것', HT.CG_SIT.map(([, , ko], k) => [k, esc(ko)]), r.want, 'gw')}
      <h3 class="mt">① 부탁 틀</h3>${seg('틀', HT.CG_FRAMES.map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.f, 'gf')}
      ${F0.slot ? `<h3 class="mt">② 시각</h3>${seg('시각', CG_TIMES[F0.slot].map(t => [t, `<span lang="en">${esc(HT.sv(F0.slot, t).t)}</span>`]), r.v || '', 'gv')}` : ''}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${clearBtn}` : '<p class="note">시각까지 말하면 직원이 <span lang="en">Until what time?</span> · <span lang="en">What time?</span>를 다시 묻지 않아요.</p>'}`;
  },
  checkout: () => {
    const b = LAB.bill, c = billCard(), B = HT.bill(c), qb = HT.simQ('co_bill', c), m = HT.model(qb, c);
    return `${labHead('청구서 확인하기')}
      <div class="cv-row"><span class="cv-lab">숙박</span>${seg('숙박', [1, 2, 3].map(n => [n, HT.nightsKo(n)]), b.nights, 'bn')}</div>
      <div class="cv-row"><span class="cv-lab">미니바</span>${seg('미니바', [['none', '안 씀']].concat(Object.entries(HT.MINIBAR).map(([k, v]) => [k, `<span lang="en">${esc(v.en)}</span> <small>${(v.p / 100).toFixed(2)}</small>`])), b.minibar, 'bm')}</div>
      <div class="cv-row"><span class="cv-lab">청구서</span>${seg('청구서', [['none', '맞음'], ['minibar', '안 쓴 미니바'], ['nights', '하루 더 청구']], b.billErr, 'be')}</div>
      <ul class="rlist">${B.items.map(it => `<li class="${it.wrong ? 'bad' : ''}"><span lang="en">${esc(it.en)}</span><b>${HT.money(it.c)}</b></li>`).join('')}<li class="tot"><span>합계 TOTAL</span><b>${HT.money(B.total)}</b></li></ul>
      <p class="enline">${lpBtn(staffSeq(qb), '직원의 말 듣기')}<span lang="en">${esc(qb.en)}</span> <small class="read">→ <span lang="en">${esc(HT.priceWords(B.total))}</span></small></p>
      <p class="enline">${lpBtn(meSeq(m), '맞는 대답 듣기')}<span lang="en">${segHTML(m)}</span></p>
      <p class="note">${c.billErr !== b.billErr ? '미니바를 썼다면 미니바 요금은 실수가 아니에요. ' : ''}방값(지어낸 값 ${HT.money(HT.RATE)}) × 밤 + 미니바 + 세금 ${Math.round(HT.TAX * 100)}%. 영상 · 청구서 · 직원의 말이 모두 같은 계산이에요.</p>${S.bill ? clearBtn : ''}`;
  },
  oneline: () => {
    const L = LAB.line, has = L.words.length, a = { f: 'line', line: { words: L.words.slice(), room: L.room } };
    const rows = LINE_ORDER.map(c => `<div class="cv-row"><span class="cv-lab">${esc(HT.CCAT[c].ko)}</span><div class="seg">${HT.LINE_CHIPS[c].map(w => `<button type="button" data-lw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(w === 'room' ? `this is room ${L.room}` : HT.CW[w].t)}</span></button>`).join('')}</div></div>`).join('');
    let res = '';
    if (has) {
      const card = Object.assign({}, HT.DEMO); delete card.thing; delete card.n;
      const j = HT.judge('cl_help', a, card, '상황'), ck = j.ok ? HT.coveredKo(HT.covered(a, 'cl_help')) : [];
      res = `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${j.ok ? `<p class="note">직원이 건너뛸 질문 → ${ck.length ? esc(ck.join(' · ')) : '없음 (방 번호 · 몇 개를 다시 물어요)'}</p>` : ''}`;
    }
    return `${labHead('전화 한 줄 만들기')}
      <p class="note">조각을 누르는 차례대로 문장이 만들어져요. 일부러 순서를 바꿔 눌러 보세요. 방 번호는 1207호예요.</p>
      ${rows}${res}
      <button class="btn ghost" type="button" id="lineClear">처음부터</button>
      <p class="note">순서(인사 → 방 번호 → 부탁 틀 + 필요한 것 → please → 끝인사)는 자주 쓰는 순서를 단순하게 줄인 규칙이에요.</p>`;
  },
  method: () => {
    const i = S.place, row = i != null ? HT.METHOD[i] : null;
    return `${labHead('곳마다 3단계 적용해 보기')}
      ${seg('곳', HT.METHOD.map(([qid], k) => [k, `${PI(HT.Q[qid].place)}${esc(HT.PLACE[HT.Q[qid].place].ko)}`]), i == null ? '' : i, 'place')}
      ${row ? (() => { const [qid, a, c] = row, q = HT.Q[qid], j = HT.judge(q, a, c); return `<p class="enline">${lpBtn(staffSeq(q), '듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
        <ol class="edr-steps"><li><b>① 열쇠 낱말</b> ${esc(q.key.join(' … '))} → ${esc(HT.sayOf(q.intent))}</li><li><b>② 틀 + 내 정보</b> <span lang="en">${segHTML(a)}</span> ${esc(HT.ko(a))}</li><li><b>③ 공손하게</b> ${esc(j.why)}</li></ol>
        <p class="enline">${lpBtn(staffSeq(q).concat([{ text: HT.text(a), sp: 'me', gap: 0.5 }]), '대화 듣기')}<span>대화 듣기</span></p>
        ${clearBtn}`; })() : '<p class="note">곳을 고르면 영상 화면의 그 줄이 켜지고, 세 단계를 글로 보여 줘요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>대화 골라 보기</h3>
    <div class="seg">${HTS.PSEG.map((t, i) => `<button type="button" data-seek="${t + 0.4}">대화 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 해 보고 싶다면 아래 <a href="#playground">호텔 숙박 시뮬레이터</a>에서 내 숙박 카드로 체크인부터 체크아웃까지 해 보세요. 카드는 누를 때마다 새로 만들어져요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">호텔 숙박 시뮬레이터</a> — 숙박 카드로 체크인부터 체크아웃까지(전화 한 줄도)</li><li><a href="#shadow">호텔 표현 따라 말하기</a> — ${HT.SHADOW.length}문장 듣고 따라 하기</li>
    <li><a href="#drill">듣고 대답 고르기</a> — 일곱 곳 ${HT.DRILL.length}문제, 3단계 힌트</li><li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.querySelectorAll('.lmini').forEach(m => HDrill(m, [HT.MINI[m.dataset.mini]], { compact: true, onAnswer() { if (playing) pause(); } }));
}
function showAt(u) { const ch = CHAPTERS[HTS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const relab = () => { touch(); buildLab(HTS.chapterAt(T)); };
// 직접 해 보기 상태 → 영상 화면 상태
const syncNights = () => { const a = nightsAns(); S.nights = a ? { n: LAB.nights.n, a } : null; };
const syncCall = () => { const a = callAns(); S.call = a ? { q: 'cl_help', a, card: HT.valFact('thing', LAB.call.want), want: HT.valFact('thing', LAB.call.want).thing === 'towels' ? LAB.call.want : HT.valFact('thing', LAB.call.want).thing } : null; };
const syncProb = () => { const a = probAns(); S.prob = a ? { p: LAB.prob.p, a } : null; };
const syncCg = () => { const a = cgAns(); S.cg = a ? { a, card: cgCard(), ko: HT.CG_SIT[LAB.cg.want][2] } : null; };
const syncLine = () => { const L = LAB.line; S.line = L.words.length ? { words: L.words.slice(), room: L.room } : null; };
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  const d = b.dataset;
  if (d.seek) { seek(CHAPTERS[HTS.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') {
    ['stop', 'place', 'nights', 'call', 'prob', 'cg', 'room', 'bill'].forEach(k => { S[k] = null; });
    LAB.nights.v = null; LAB.call.v = null; LAB.prob.v = null; LAB.prob.rf = null; LAB.prob.rv = null; LAB.cg.v = null; LAB.room = null;
    relab(); return;
  }
  if (d.stop != null) { S.stop = d.stop === '' ? null : +d.stop; showAt(14.6); relab(); return; }
  // 02장
  if (d.nn) { LAB.nights.n = +d.nn; syncNights(); relab(); return; }
  if (d.nf) { LAB.nights.f = d.nf; syncNights(); relab(); return; }
  if (d.nv) { LAB.nights.v = d.nv; syncNights(); relab(); return; }
  // 03장
  if (d.rm) { LAB.room = d.rm; S.room = d.rm; relab(); return; }
  // 04장
  if (d.cw) { LAB.call.want = d.cw; syncCall(); relab(); return; }
  if (d.cf) { LAB.call.f = d.cf; syncCall(); relab(); return; }
  if (d.cv) { LAB.call.v = d.cv; syncCall(); relab(); return; }
  // 05장
  if (d.pp) { LAB.prob.p = d.pp; syncProb(); relab(); return; }
  if (d.pf) { LAB.prob.f = d.pf; LAB.prob.v = null; syncProb(); relab(); return; }
  if (d.pv) { LAB.prob.v = d.pv; syncProb(); relab(); return; }
  if (d.pr != null) { LAB.prob.rf = d.pr || null; LAB.prob.rv = null; syncProb(); relab(); return; }
  if (d.prv) { LAB.prob.rv = d.prv; syncProb(); relab(); return; }
  // 06장
  if (d.gw != null) { LAB.cg.want = +d.gw; LAB.cg.v = null; syncCg(); relab(); return; }
  if (d.gf) { LAB.cg.f = d.gf; LAB.cg.v = null; syncCg(); relab(); return; }
  if (d.gv) { LAB.cg.v = d.gv; syncCg(); relab(); return; }
  // 07장
  if (d.bn) { LAB.bill.nights = +d.bn; S.bill = billCard(); relab(); return; }
  if (d.bm) { LAB.bill.minibar = d.bm; S.bill = billCard(); relab(); return; }
  if (d.be) { LAB.bill.billErr = d.be; S.bill = billCard(); relab(); return; }
  // 08장
  if (d.lw) {
    const w = d.lw, L = LAB.line, c = HT.CW[w].c;
    if (L.words.includes(w)) L.words = L.words.filter(x => x !== w);
    else { L.words = L.words.filter(x => HT.CW[x].c !== c); L.words.push(w); }
    syncLine(); relab(); return;
  }
  if (b.id === 'lineClear') { LAB.line.words = []; S.line = null; relab(); return; }
  if (d.place != null) { S.place = d.place === '' ? null : +d.place; showAt(18.6); relab(); }
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   값은 한국어로(334달러 40센트), 시각과 방 번호는 영어로(six-thirty · twelve-oh-seven), 철자는 한 글자씩
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    // 값은 한국어로. 앞의 영어 조각에 숫자가 붙어 읽히지 않게 마침표로 끊어요 (Your total is. 334달러 40센트)
    [/\$(\d+)\.(\d{2})\b/g, (m, d, c) => (+c ? `. ${d}달러 ${+c}센트` : `. ${d}달러`)],
    [/\b(\d{1,2}):(\d{2})\b/g, (m, h, mm) => HT.timeWords(`${h}:${mm}`)],
    [/\b([A-Z])-([A-Z])-([A-Z])(?:-([A-Z]))?\b/g, (m, ...p) => p.slice(0, 4).filter(x => typeof x === 'string' && /^[A-Z]$/.test(x)).join(', ')],
    [/(^|[^\d$])(\d{3,4})(?![\d호달박일층시분센])/g, (m, pre, n) => pre + HT.roomWords(n)],
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
   10. 놀이터 — 호텔 숙박 시뮬레이터
   체크인 → 방 열쇠 → 전화 부탁 → 문제 → 조식 → 컨시어지 → 체크아웃. 같은 곳에서 이미 답한 질문은 직원이 건너뛰어요(HT.covered).
   방 번호는 숙박 카드에 없어요 — 체크인 뒤 카드 키 봉투에 적혀 나와요.
   ========================================================= */
const SIM = { card: null, qs: [], i: 0, frames: [], slots: {}, reqs: [], f: null, v: null, rf: undefined, rv: null, log: [], started: false, script: !HTV.supported, mode: null, react: null, why: null, done: false, listening: false, heard: null, covered: new Set(), skipped: [], building: false, line: { words: [], room: null } };
const simQ = () => HT.simQ(SIM.qs[SIM.i], SIM.card);
const simC = () => Object.assign({}, SIM.card, simQ().fact || {});
window.__simCard = () => Object.assign({}, SIM.card);   // 확인용(읽기만): 지금 숙박 카드
window.__simQ = () => Object.assign({}, simQ());          // 확인용(읽기만): 지금 직원의 말
window.__simReqs = () => SIM.reqs.map(r => r && Object.assign({}, r));   // 확인용(읽기만): 문제 알리기의 부탁 칩
const keyOf = q => `${q.place}:${q.intent}`;
const SIM_THINGS = ['towels', 'towels2', 'towels3', 'pillow', 'toothbrush', 'adapter', 'hairdryer'];
const PLACE_INTRO = {
  key: '체크인 끝! 직원이 카드 키를 건네요. 방 번호는 왼쪽 카드 키 봉투에 적혀 있어요.',
  call: '방에 들어왔어요. 필요한 것이 있어 객실 관리팀(housekeeping)에 전화해요.',
  problem: '그런데 방에 문제가 생겼어요. 프런트에 전화해요.',
  breakfast: '다음 날 아침, 2층 조식 식당이에요.',
  concierge: '떠나는 날 아침, 컨시어지 데스크예요. 모닝콜과 짐을 부탁해요.',
  checkout: '이제 프런트에서 체크아웃해요. 청구서를 숙박 카드와 맞춰 보세요.',
};
function simNew() {
  HTV.stop(); stopListening();
  SIM.card = HT.newCard(); SIM.qs = HT.simQs(SIM.card); SIM.i = 0; SIM.log = []; SIM.done = false; SIM.react = null; SIM.why = null; SIM.heard = null;
  SIM.covered = new Set(); SIM.skipped = []; SIM.building = false; SIM.line = { words: [], room: null };
  simPrep(); simBuild();
}
function simPrep() {
  const q = simQ(), C = simC();
  SIM.slots = {}; SIM.f = null; SIM.v = null; SIM.rf = undefined; SIM.rv = null; SIM.reqs = [];
  if (q.intent === 'issue') {
    const ch = HT.issueChips(C); SIM.frames = shuffle(ch.facts); SIM.reqs = shuffle(ch.reqs.filter(Boolean)).concat([null]);
    if (SIM.reqs.some(r => r && r.f === 'rq_bring')) SIM.slots.rq_bring = HT.slotChoices('bring', C);
  } else SIM.frames = shuffle(HT.simFrames(q.intent, C) || []);
  SIM.frames.forEach(f => { const Fm = HT.FRAME[f]; if (Fm.slot) SIM.slots[f] = HT.slotChoices(Fm.slot, C); });
  if (!SIM.log[SIM.i]) SIM.log[SIM.i] = { q: q.id, en: q.en, sp: q.sp, place: q.place, tries: [] };
}
function simSpeak(lines, o = {}) {
  const box = $('sim');
  speak(lines, { slow: !!o.slow, onitem() { paintNow(box, '.sim-bub'); }, onend() { SIM.mode = null; paintPlay(box, null); paintNow(box, null); } });
  SIM.mode = o.slow ? 'slowplay' : 'play'; paintPlay(box, SIM.mode);
}
function simAsk(prefix, slow) { const q = simQ(); simSpeak((prefix ? [{ text: prefix.text, sp: prefix.sp || 'us' }] : []).concat([{ text: q.en, sp: q.sp, gap: 0.5 }]), { slow }); }
// 대답에 따라 직원이 덧붙이는 말 (다음 질문 앞)
function staffReply(q, a, C) {
  if (q.intent === 'kmore') return C.kq === 'wifi' ? `The Wi-Fi password is ${HT.WIFI}.` : C.kq === 'bfincl' ? (C.bf === 'incl' ? 'Yes, it is. Breakfast is from seven to ten.' : 'No, I\'m afraid it isn\'t, but you can add it to your room bill.') : 'Enjoy your stay!';
  if (q.intent === 'issue') { const r = a && a.req ? a.req : null, k = r ? (HT.FRAME[r.f].fix === 'bring' ? 'bring:' + r.v : HT.FRAME[r.f].fix) : !a && HT.PROB[C.prob] ? HT.PROB[C.prob].fits[0] : null; return HT.fixReply(k); }
  if (q.intent === 'help' || q.intent === 'count') return `Sure, I'll send ${C.thing === 'towels' ? 'them' : 'it'} up right away.`;
  if (q.intent === 'waketime' || (q.intent === 'ask' && C.want === 'wake')) return `Of course. We'll call you at ${HT.timeWords(C.wake)}.`;
  if (q.intent === 'holdtime' || (q.intent === 'ask' && C.want === 'hold')) return 'No problem. Here\'s your claim tag.';
  return null;
}
function simAnswer(a, spoken) {
  if (SIM.done || !SIM.started) return;
  // 컨시어지의 첫 부탁: 카드의 두 부탁(모닝콜 · 짐) 중 어느 쪽을 먼저 말해도 돼요 → 먼저 말한 쪽으로 차례를 바꿔요
  if (SIM.qs[SIM.i] === 'cg_help') {
    const F0 = a && HT.FRAME[a.f], w = spoken ? HT.wantOf(spoken) : F0 && F0.fact ? F0.fact.want : null;
    if ((w === 'wake' || w === 'hold') && w !== (SIM.card.cgFirst === 'hold' ? 'hold' : 'wake')) { SIM.card.cgFirst = w; SIM.qs = HT.simQs(SIM.card); simPrep(); }
  }
  const q = simQ(), C = simC(), L = SIM.log[SIM.i];
  const j = spoken ? HT.matchSpoken(spoken, q, C) : HT.judge(q, a, C);
  const model = HT.model(q, C);
  SIM.heard = spoken || null;
  if (j.repair) {
    const re = j.repair === 'spell' ? `Sure. It's ${HT.WIFI.split('').join(' ')}.` : j.repair === 'what' ? 'Sure. It\'s a hold on your card for extra charges, like the minibar.' : null;
    SIM.react = { en: re ? re : 'Sure. ' + q.en, ko: re ? '직원이 알려 줬어요. 이제 대답해 보세요.' : '다시 물었어요. 직원이 천천히 한 번 더 말해요.', st: 'repair' }; SIM.why = null; simBuild();
    simSpeak(re ? [{ text: re, sp: q.sp }] : [{ text: 'Sure.', sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }], { slow: true }); return;
  }
  L.tries.push({ t: spoken ? `(말로) ${spoken}` : HT.text(a), ok: j.ok, stage: j.stage });
  SIM.why = { j, model, spoken: !!spoken };
  if (j.ok) {
    L.final = spoken || HT.text(a);
    // 이 대답이 함께 답한 다른 질문만 (같은 곳에 같은 뜻의 질문이 또 있을 수 있어서 이 질문의 뜻은 빼요 — 컨시어지의 두 번째 부탁)
    (spoken ? (j.covered || [q.intent]) : HT.covered(a, q)).filter(i => i !== q.intent).forEach(i => SIM.covered.add(`${q.place}:${i}`));
    const ok = HT.REACT.ok[(SIM.i + L.tries.length) % HT.REACT.ok.length];
    let n = SIM.i + 1; const skip = [];
    while (n < SIM.qs.length && SIM.covered.has(keyOf(HT.Q[SIM.qs[n]]))) { skip.push(SIM.qs[n]); n++; }
    SIM.skipped.push(...skip);
    const reply = staffReply(q, a, C);
    if (n >= SIM.qs.length) {
      const bye = C.billErr !== 'none' ? 'Oh, I\'m so sorry about that. I\'ve fixed your bill. Thank you for staying with us!' : 'Thank you for staying with us!';
      SIM.done = true; SIM.react = { en: bye, ko: C.billErr !== 'none' ? '청구서를 고쳐 줬어요. 체크아웃 끝!' : '체크아웃 끝!', st: 'ok' };
      simBuild(); simSpeak([{ text: bye, sp: q.sp }]); return;
    }
    const prevPlace = q.place;
    SIM.i = n; simPrep(); SIM.building = false;
    const nq = simQ(), moved = nq.place !== prevPlace;
    const skipKo = HT.coveredKo(skip.map(id => HT.Q[id].intent));
    const pre = reply && (moved || skip.length || ['kmore', 'issue', 'ask'].includes(q.intent)) ? reply : (skip.length ? 'Great.' : ok);
    SIM.react = { en: pre, ko: (skip.length ? `한 번에 말해서 ${skipKo.join(' · ')} 질문을 건너뛰었어요. ` : '통과! ') + (moved ? PLACE_INTRO[nq.place] || '' : ''), st: 'ok' };
    simBuild(); simAsk({ text: pre, sp: q.sp });
  } else {
    const r = j.stage === 1 ? HT.REACT[1](q) : j.stage === 2 ? HT.REACT[2](q, j) : j.stage === 3 ? HT.REACT[3]() : { en: 'Sorry?', ko: '알아듣지 못했어요.' };
    SIM.react = Object.assign({ st: 'no' }, r); SIM.f = null; SIM.v = null; SIM.rf = undefined; SIM.rv = null;
    simBuild(); simSpeak([{ text: r.en, sp: q.sp }]);
  }
}
const chipT = f => esc(HT.FRAME[f].t.replace(/[{}]/g, '')).replace('___', '<i class="blank">___</i>');
const slotLabel = (f, v) => { const F0 = HT.FRAME[f], x = HT.sv(F0.slot, v); return x ? (x[F0.form || 't'] != null ? x[F0.form || 't'] : x.t) : v; };
const keyShown = () => SIM.started && SIM.qs.indexOf('k_any') <= SIM.i;
function simBuild() {
  const hear = HTV.supported, C = SIM.card;
  $('simCard').innerHTML = `<p class="tc-head">${PI('key')}<b>숙박 카드</b> <span lang="en">STAY CARD</span></p><dl>${HT.cardRows(C).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="tc-foot">오늘의 호텔: ${esc(HT.HOTEL)} (지어낸 호텔) · 방 번호는 체크인 때 받아요</p>`;
  $('simSleeve').innerHTML = SIM.done ? '' : keyShown() ? sleeveHTML(C.room) : '<p class="sleeve-wait">체크인을 마치면 카드 키 봉투(방 번호)가 여기에 나와요.</p>';
  const prog = SIM.qs.map((id, k) => { const L = SIM.log[k], skipped = SIM.skipped.includes(id), c = skipped ? ' skip' : !L || !L.final ? (k === SIM.i && !SIM.done ? ' cur' : '') : L.tries[0] && L.tries[0].ok ? ' ok' : ' late'; return `<li class="${c}" title="${esc(HT.INTENT_KO[HT.Q[id].intent] || '')}${skipped ? ' (건너뜀)' : ''}">${k + 1}</li>`; }).join('');
  $('simProg').innerHTML = prog;
  const box = $('simMain');
  if (!SIM.started) {
    box.innerHTML = `<div class="sim-start"><p>왼쪽 숙박 카드가 이번 여행의 사실이에요. 체크인 → 방 열쇠 → 전화 부탁 → 문제 → 조식 → 컨시어지 → 체크아웃 차례로 직원과 이야기해요. 열쇠 낱말을 듣고, 대답 틀 칩을 고른 뒤 카드의 정보 칩을 넣어요. 객실에서 전화할 때는 <b>전화 한 줄</b>(L)로 방 번호 · 필요한 것 · 몇 개를 한 번에 말하면 직원이 그 질문을 건너뛰어요. 방 번호는 체크인 뒤에 나오는 카드 키 봉투에 있어요${SRC ? ' — 마이크로 말해서 대답할 수도 있어요' : ''}.</p><button type="button" class="btn" id="simGo">체크인 시작 (Enter)</button></div>`;
    return;
  }
  if (SIM.done) {
    const first = SIM.log.filter(L => L && L.tries[0] && L.tries[0].ok).length, asked = SIM.log.filter(Boolean).length, saved = SIM.skipped.length;
    const ml = HT.modelLine(C);
    box.innerHTML = `<div class="sim-end"><div class="end-art">${sleeveHTML(C.room)}${billHTML(C)}</div><div><p class="sim-score"><b>${first} / ${asked}</b> 질문을 한 번에 통과했어요.</p>
      <p class="sim-saved">${saved ? `한 번에 말해서 직원의 질문 <b>${saved}개</b>를 건너뛰었어요 (${esc(HT.coveredKo(SIM.skipped.map(id => HT.Q[id].intent)).join(' · '))}).` : `다음에는 전화할 때 한 줄로 말해 보세요 → <span lang="en">${segHTML(ml)}</span> ${lpBtn(meSeq(ml), '전화 한 줄 듣기')}`}</p>
      <p class="sim-react ok"><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>
      <ol class="sim-log">${SIM.log.filter(Boolean).map(L => `<li><span class="who">${esc(WHO[L.place] || '직원')}</span>${lpBtn([{ text: L.en, sp: L.sp }], '듣기')}<span lang="en">${esc(L.en)}</span><br><span class="who me">나</span>${lpBtn(meSeq(L.final), '듣기')}<span lang="en">${esc(L.final)}</span>${L.tries.length > 1 ? ` <small>(${L.tries.length}번째에 통과)</small>` : ''}</li>`).join('')}</ol>
      <div class="tg-acts"><button type="button" class="btn" id="simAgain">새 카드로 다시 (N)</button>${hear ? `<button type="button" class="btn ghost" data-lp="${seqId(SIM.log.filter(Boolean).flatMap(L => [{ text: L.en, sp: L.sp }, { text: L.final, sp: 'me', gap: 0.4 }]))}">대화 전체 듣기</button>` : ''}</div></div></div>`;
    return;
  }
  const q = simQ(), show = SIM.script || !hear, issue = q.intent === 'issue';
  let fa = null;
  if (SIM.f) { const Fm = HT.FRAME[SIM.f]; if (!Fm.slot || SIM.v) { fa = { f: SIM.f }; if (Fm.slot) fa.v = SIM.v; if (issue && SIM.rf) { const R0 = HT.FRAME[SIM.rf.f]; if (!R0.slot || SIM.rv) fa.req = R0.slot ? { f: SIM.rf.f, v: SIM.rv } : { f: SIM.rf.f }; } } }
  const ready = fa && (!issue || SIM.rf !== undefined) && !(issue && SIM.rf && HT.FRAME[SIM.rf.f].slot && !SIM.rv);
  let h = `${lsnBar(SIM.script)}`;
  h += `<div class="sim-officer">${staffSVG(HTS.kindOf(q))}<p class="sim-bub"><span class="who">${esc(WHO[q.place] || '직원')}</span><span class="ldr-t" lang="en">${lineHTML(q.en, show ? keyMarks(q) : [], show)}</span>${hear ? `<button type="button" class="lp-play lp-mini" data-simline="1" aria-label="다시 듣기" title="다시 듣기">${SVG_PLAY}</button>` : ''}</p></div>`;
  if (SIM.react) h += `<p class="sim-react ${SIM.react.st}"><span class="who">${esc(WHO[q.place] || '직원')}</span><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>`;
  if (SIM.building) {
    const L = SIM.line, a = { f: 'line', line: { words: L.words.slice(), room: L.room } };
    const rooms = HT.slotChoices('room', C);
    h += `<div class="sim-build"><p class="sim-lab">전화 한 줄 — 조각을 누르는 차례대로 문장이 돼요 <small>L 닫기</small></p>
      ${LINE_ORDER.map(c => `<div class="cv-row"><span class="cv-lab">${esc(HT.CCAT[c].ko)}</span><div class="seg">${c === 'room' ? rooms.map(r => `<button type="button" data-sroom="${r}" aria-pressed="${L.words.includes('room') && L.room === r}"><span lang="en">this is room ${r}</span></button>`).join('') : (c === 'thing' ? SIM_THINGS : HT.LINE_CHIPS[c]).map(w => `<button type="button" data-sw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(HT.CW[w].t)}</span></button>`).join('')}</div></div>`).join('')}
      <div class="sim-ans"><span class="who me">나</span>${L.words.length ? `<span lang="en" class="sim-line">${segHTML(a)}</span>` : '<span class="note">조각을 고르세요. 방 번호는 카드 키 봉투에서 확인해요.</span>'}</div>
      <div class="tg-acts"><button type="button" class="btn" id="simLine"${L.words.length ? '' : ' disabled'}>말하기 (Enter)</button><button type="button" class="btn ghost" id="simLineClear"${L.words.length ? '' : ' disabled'}>지우기</button><button type="button" class="btn ghost" id="simBuildOff">칩으로 하나씩</button></div></div>`;
  } else {
    h += `<p class="sim-lab">① ${issue ? '사실 틀' : '대답 틀'} <small>1~${SIM.frames.length}</small></p><div class="chips" role="group" aria-label="대답 틀">${SIM.frames.map((f, k) => `<button type="button" class="chipf" data-sf="${f}" aria-pressed="${SIM.f === f}"><small>${k + 1}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}${q.intent === 'help' ? '<button type="button" class="chipf chip-line" id="simBuildOn"><small>L</small> 전화 한 줄 (한 번에 말하기)</button>' : ''}</div>`;
    const Fm = SIM.f ? HT.FRAME[SIM.f] : null;
    if (Fm && Fm.slot) h += `<p class="sim-lab">② 내 정보 넣기 <small>A~C</small></p><div class="chips" role="group" aria-label="칸에 넣을 정보">${SIM.slots[SIM.f].map((v, k) => `<button type="button" class="chips-s" data-sv="${esc(v)}" aria-pressed="${SIM.v === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(slotLabel(SIM.f, v))}</span></button>`).join('')}</div>`;
    if (issue) {
      h += `<p class="sim-lab">③ 부탁 붙이기 <small>5~8</small></p><div class="chips" role="group" aria-label="부탁">${SIM.reqs.map((r, k) => `<button type="button" class="chipf chip-req" data-sr="${k}" aria-pressed="${SIM.rf === r || (SIM.rf && r && SIM.rf.f === r.f && SIM.rf.v === r.v)}"><small>${k + 5}</small> ${r ? `<span lang="en">${chipT(r.f)}</span>` : '부탁 없이'}</button>`).join('')}</div>`;
      if (SIM.rf && HT.FRAME[SIM.rf.f].slot) h += `<div class="chips" role="group" aria-label="가져다줄 것">${SIM.slots.rq_bring.map((v, k) => `<button type="button" class="chips-s" data-srv="${esc(v)}" aria-pressed="${SIM.rv === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(HT.SLOT.bring.vals[v].t)}</span></button>`).join('')}</div>`;
    }
    h += `<div class="sim-ans"><span class="who me">나</span>${fa ? `<span lang="en" class="sim-line">${segHTML(fa)}</span>` : SIM.f ? `<span lang="en" class="sim-line">${chipT(SIM.f)}</span>` : '<span class="note">틀을 고르세요.</span>'}</div>`;
    h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${ready ? '' : ' disabled'}>대답하기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${SIM.f ? '' : ' disabled'}>지우기</button>${SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 대답하기 (M)'}</button>` : ''}</div>`;
  }
  if (SIM.heard) h += `<p class="note">들린 말: <span lang="en">${esc(SIM.heard)}</span></p>`;
  if (SIM.why) {
    const { j, model } = SIM.why, st = j.ok ? '통과' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸렸어요';
    h += `<div class="sim-why ${j.ok ? 'ok' : 'no'}"><p><b>${esc(st)}</b> ${esc(j.why)}</p>${j.ok ? '' : `<p>모범 대답 ${lpBtn(meSeq(model), '모범 대답 듣기')}<span lang="en">${segHTML(model)}</span> <small>${esc(HT.ko(model))}</small></p>`}${SIM.why.spoken ? '<p class="note">말로 한 대답은 낱말과 카드의 사실만 맞춰 봐요. 공손함과 발음은 판정하지 않아요.</p>' : ''}</div>`;
  }
  box.innerHTML = h;
  paintPlay($('sim'), SIM.mode);
}
const LOOKS = { desk: ['#26324A', '#E3B48D', '#2E241E'], phone: ['#3B4350', '#C99169', '#5A3A28'], host: ['#2F3B36', '#E8BC95', '#1F1B18'], concierge: ['#3A2E4A', '#D9A57C', '#2B2F36'] };
const staffSVG = kind => { const [sh, sk, hr] = LOOKS[kind] || LOOKS.desk; return `<svg class="sim-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#202A36"/><ellipse cx="24" cy="47" rx="19" ry="14" fill="${sh}"/>${kind === 'desk' || kind === 'concierge' ? `<path d="M19.5 34l4.5 5 4.5-5z" fill="#EEF1F4"/><path d="M23 35.5h2l.8 8-1.8 1.6-1.8-1.6z" fill="${kind === 'desk' ? '#B8432B' : '#C9A24A'}"/>` : kind === 'host' ? '<rect x="16" y="35" width="16" height="13" rx="2" fill="#7FA88E"/>' : ''}<circle cx="24" cy="21" r="8.5" fill="${sk}"/><path d="M15.5 19a8.5 8.5 0 0 1 17 0z" fill="${hr}"/>${kind === 'concierge' ? '<path d="M15.2 19.5a8.8 8.8 0 0 1 17.6 0z" fill="#2B2F36"/><rect x="15.2" y="17.6" width="17.6" height="1.8" fill="#C9A24A"/>' : ''}${kind === 'phone' ? '<path d="M14.5 21a9.5 9.5 0 0 1 19 0" fill="none" stroke="#1C232C" stroke-width="1.8"/><circle cx="15" cy="22" r="2.2" fill="#1C232C"/><path d="M15.4 24c.6 3 3 4 6 4" fill="none" stroke="#1C232C" stroke-width="1.3"/>' : ''}${kind === 'host' ? '<circle cx="24" cy="11" r="3" fill="#1F1B18"/>' : ''}<circle cx="21" cy="22" r="1" fill="#2B2420"/><circle cx="27" cy="22" r="1" fill="#2B2420"/></svg>`; };
// 카드 키 봉투 (HTML)
function sleeveHTML(room) {
  return `<div class="slv" role="img" aria-label="카드 키 봉투: ${esc(room)}호, ${HT.floorOf(room)}층"><p class="slv-h">${esc(HT.HOTEL.toUpperCase())}<small>KEY CARD</small></p><div class="slv-top"><p><small>ROOM</small><b class="slv-room">${esc(room)}</b></p><p><small>FLOOR</small><b>${HT.floorOf(room)}</b></p></div><dl>${HT.sleeve(room).slice(2).map(f => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.val)}</dd></div>`).join('')}</dl><p class="slv-read">${lpBtn([{ text: `Room ${room}.`, sp: 'us' }], '방 번호 듣기')}<span lang="en">${esc(HT.roomWords(room))}</span></p></div>`;
}
// 청구서 (HTML) — 실수가 있는 줄은 표시
function billHTML(c) {
  const B = HT.bill(c), wrong = B.items.some(x => x.wrong), F = wrong ? HT.bill(Object.assign({}, c, { billErr: 'none' })) : B;
  return `<div class="rcpt" role="img" aria-label="청구서 합계 ${HT.money(F.total)}"><p class="rc-h">${esc(HT.HOTEL.toUpperCase())}</p><p class="rc-g">GUEST ${esc(String(c.name).toUpperCase())} · ROOM ${esc(c.room)}</p><ul>${B.items.map(it => `<li class="${it.wrong ? 'bad' : ''}"><span>${esc(it.en)}</span><b>${HT.money(it.c)}</b></li>`).join('')}</ul><p class="rc-t"><span>TOTAL</span><b>${HT.money(B.total)}</b></p>${wrong ? `<p class="rc-t rc-fix"><span>고친 합계</span><b>${HT.money(F.total)}</b></p>` : ''}<p class="rc-n">${wrong ? '빨간 줄 → 숙박 카드와 다른 요금이에요. 실수를 알리자 직원이 고쳤어요. ' : '숙박 카드와 맞는 청구서예요. '}읽기 → <span lang="en">${esc(HT.priceWords(F.total))}</span></p></div>`;
}
function simKeep() { if (!$('sim').contains(document.activeElement) || !document.activeElement.isConnected) $('sim').focus({ preventScroll: true }); }
function simMic() {
  if (!SRC || SIM.done || !SIM.started) return;
  if (SIM.listening) { stopListening(); return; }
  listenOnce({
    onState(on) { SIM.listening = on; simBuild(); simKeep(); },
    onText(alts) { const q = simQ(), C = simC(), best = alts.find(t => HT.matchSpoken(t, q, C).ok) || alts[0]; simAnswer(null, best); simKeep(); },
    onFail(msg) { SIM.react = { en: '…', ko: msg, st: 'no' }; simBuild(); simKeep(); },
  });
}
function simLineSubmit() { const L = SIM.line; if (!L.words.length) return; simAnswer({ f: 'line', line: { words: L.words.slice(), room: L.room } }); }
function simSayChips() {
  const q = simQ(); if (!SIM.f) return;
  const Fm = HT.FRAME[SIM.f]; if (Fm.slot && !SIM.v) return;
  const a = { f: SIM.f }; if (Fm.slot) a.v = SIM.v;
  if (q.intent === 'issue') { if (SIM.rf === undefined) return; if (SIM.rf) { const R0 = HT.FRAME[SIM.rf.f]; if (R0.slot && !SIM.rv) return; a.req = R0.slot ? { f: SIM.rf.f, v: SIM.rv } : { f: SIM.rf.f }; } }
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
    if (b.dataset.sroom) { const L = SIM.line, r = b.dataset.sroom; if (L.words.includes('room') && L.room === r) { L.words = L.words.filter(x => x !== 'room'); L.room = null; } else { if (!L.words.includes('room')) L.words.push('room'); L.room = r; } simBuild(); simKeep(); return; }
    if (b.dataset.sw) {
      const w = b.dataset.sw, L = SIM.line, c = HT.CW[w].c;
      if (L.words.includes(w)) L.words = L.words.filter(x => x !== w);
      else { L.words = L.words.filter(x => HT.CW[x].c !== c); L.words.push(w); }
      simBuild(); simKeep(); return;
    }
    if (b.id === 'simLine') { simLineSubmit(); simKeep(); return; }
    if (b.id === 'simLineClear') { SIM.line = { words: [], room: null }; simBuild(); simKeep(); return; }
    if (b.dataset.simline) { simAsk(null, false); return; }
    if (b.dataset.act === 'play') { if (SIM.mode === 'play' && HTV.busy()) HTV.stop(); else simAsk(null, false); return; }
    if (b.dataset.act === 'slowplay') { if (SIM.mode === 'slowplay' && HTV.busy()) HTV.stop(); else simAsk(null, true); return; }
    if (b.dataset.act === 'script') { SIM.script = !SIM.script; simBuild(); simKeep(); }
  });
  $('sim').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), onBtn = e.target.closest && e.target.closest('button');
    if (!SIM.started) { if (e.key === 'Enter' && !onBtn) { e.preventDefault(); $('simGo').click(); } return; }
    if (SIM.done) { if (k === 'N' || (e.key === 'Enter' && !onBtn)) { e.preventDefault(); $('simAgain').click(); } return; }
    const n = '1234'.indexOf(e.key), rq = '5678'.indexOf(e.key), sv = 'ABC'.indexOf(k), q = simQ();
    if (k === 'L' && q.intent === 'help') { e.preventDefault(); SIM.building = !SIM.building; simBuild(); simKeep(); return; }
    if (SIM.building) {
      if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simLineSubmit(); simKeep(); }
      else if (e.key === 'Backspace') { e.preventDefault(); const w = SIM.line.words.pop(); if (w === 'room') SIM.line.room = null; simBuild(); simKeep(); }
      return;
    }
    if (n >= 0 && n < SIM.frames.length) { e.preventDefault(); SIM.f = SIM.frames[n]; SIM.v = null; simBuild(); simKeep(); }
    else if (rq >= 0 && q.intent === 'issue' && rq < SIM.reqs.length) { e.preventDefault(); SIM.rf = SIM.reqs[rq]; SIM.rv = null; simBuild(); simKeep(); }
    else if (sv >= 0 && q.intent === 'issue' && SIM.rf && HT.FRAME[SIM.rf.f].slot && SIM.slots.rq_bring[sv] != null && (!SIM.f || !HT.FRAME[SIM.f].slot || SIM.v)) { e.preventDefault(); SIM.rv = SIM.slots.rq_bring[sv]; simBuild(); simKeep(); }
    else if (sv >= 0 && SIM.f && HT.FRAME[SIM.f].slot && SIM.slots[SIM.f][sv] != null) { e.preventDefault(); SIM.v = SIM.slots[SIM.f][sv]; simBuild(); simKeep(); }
    else if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simSayChips(); simKeep(); }
    else if (e.key === 'Backspace') { e.preventDefault(); SIM.f = null; SIM.v = null; SIM.rf = undefined; SIM.rv = null; simBuild(); simKeep(); }
    else if (k === 'R' && HTV.supported) { e.preventDefault(); simAsk(null, false); }
    else if (k === 'S' && HTV.supported) { e.preventDefault(); simAsk(null, true); }
    else if (k === 'T' && HTV.supported) { e.preventDefault(); SIM.script = !SIM.script; simBuild(); simKeep(); }
    else if (k === 'M' && SRC) { e.preventDefault(); simMic(); }
    else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
  });
  simNew(); SIM.started = false; simBuild();
}

/* =========================================================
   11. 호텔 표현 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 숫자는 1207이든 twelve-oh-seven이든 같은 숫자로 맞춰요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = HT.PLACES.map(p => ({ p, rows: HT.SHADOW.map((s, i) => [s, i]).filter(([s]) => s.place === p.id) })).filter(g => g.rows.length);
  $('shList').innerHTML = groups.map(({ p, rows }) => `<section class="sh-grp"><h3>${PI(p.id)}${esc(p.ko)} <span lang="en">${esc(p.en)}</span></h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${HTV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-who ${s.who}">${s.who === 'me' ? '나' : esc(WHO[s.place] || '직원')}</span><span class="sh-en" lang="en">${esc(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { const s = HT.SHADOW[i]; return [{ text: s.en, sp: s.sp }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = HT.SHADOW[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, HT.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.words.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.t)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}${/K-I-M|Kim/.test(s.en) && r.hit < r.total ? ' (성과 철자는 음성 인식이 다르게 적기 쉬워요.)' : ''}</p>`);
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${HTV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
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
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (b) b.classList.remove('saying'); if (thenOrig && HTV.supported) speak(shSeq(i)); };
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
// 호텔의 네 곳 (A~D) — 층과 함께
function placeFig(label, ids, floors) {
  const Wd = 600, H = 230, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: (x, y) => y > 8 && y < H - 4 ? Math.min(3, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      ids.forEach((id, k) => {
        const x = k * cw + cw / 2, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, k * cw + 8, 10, cw - 16, H - 22, 12); g.fillStyle = st.hover === k ? QCOL.hover : 'rgba(255,255,255,0.03)'; g.fill();
        if (on || wrong) { g.strokeStyle = on ? QCOL.p : QCOL.bad; g.lineWidth = 3; g.stroke(); }
        g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L4[k], x, 34);
        g.beginPath(); g.arc(x, 98, 32, 0, Math.PI * 2); g.fillStyle = '#202A36'; g.fill(); g.strokeStyle = 'rgba(238,241,244,0.3)'; g.lineWidth = 1.5; g.stroke();
        HTS.icon(g, id, x, 98, 30, '#EEF1F4');
        g.font = qfont(14, 700); g.fillStyle = QCOL.text; g.fillText(HT.PLACE[id].ko, x, 156);
        g.font = qfont(12, 500); g.fillStyle = QCOL.muted; g.fillText(HT.PLACE[id].en, x, 178);
        g.font = qfont(13, 700); g.fillStyle = '#6EC8FF'; g.fillText(floors[k], x, 198);
      });
    } };
}
// 카드 키 봉투 (칸 넷 A~D)
function sleeveFig(label, room, ids) {
  const Wd = 600, H = 400;
  let boxes = null;
  return { width: Wd, height: H, label,
    pick: (x, y) => { if (!boxes) return -1; return ids.findIndex(k => { const b = boxes[k]; return x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4; }); },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      const hl = {}; ids.forEach((k, i) => { hl[k] = st.done && i === st.answer ? '#FFC15E' : st.done && i === st.pick ? '#FF8E8E' : st.hover === i ? '#6EC8FF' : '#9AA6AA'; });
      g.save(); boxes = HTS.keySleeve(g, 90, 66, 420, room, { hl }); g.restore();
      ids.forEach((k, i) => { const b = boxes[k], cx = b.x - 2, cy = b.y + 4; g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill(); g.font = qfont(12, 700); g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L4[i], cx, cy + 1); });
    } };
}
// 청구서 (줄 넷 A~D)
function billFig(label, card, ids) {
  const Wd = 600, H = 330;
  let boxes = null;
  return { width: Wd, height: H, label,
    pick: (x, y) => { if (!boxes) return -1; return ids.findIndex(k => { const b = boxes[k]; return b && x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4; }); },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      const hl = {}; ids.forEach((k, i) => { if (st.done && i === st.answer) hl[k] = '#FFC15E'; else if (st.done && i === st.pick) hl[k] = '#FF8E8E'; else if (st.hover === i) hl[k] = '#6EC8FF'; });
      g.save(); boxes = HTS.billDraw(g, 130, 16, 400, card, { hl }).boxes; g.restore();
      ids.forEach((k, i) => { const b = boxes[k]; if (!b) return; const cx = b.x - 18, cy = b.y + b.h / 2; g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill(); g.font = qfont(12, 700); g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L4[i], cx, cy + 1); });
    } };
}
const QS = (() => {
  const o = HT.o, j = (q, a, c) => HT.judge(q, a, c || {}).ok;
  const towel = [o('cl_give', 'towels'), HT.L(['hi', 'room', 'could', 'towels', 'please'], '1207'), o('cl_want', 'towels'), o('nt_n', 'n2')], towelC = { room: '1207', thing: 'towels' };
  const nights = [o('nt_n', 'd3'), o('nt_during', 'n2'), o('nt_n', 'n3'), o('nt_n', 'n2')];
  const spell = [o('sp_spell', 'Kim'), o('nm_its', 'Kim'), o('g_permit'), o('nm_lit', 'Kim')];
  const outlet = [o('pf_isnt', 'outlet', o('rq_send')), o('pf_isnt', 'consent'), o('pf_isnt', 'outlet', o('rq_change')), o('pf_isnt', 'outlet', o('rq_fix'))];
  const wake = [o('cg_wake', '6:13'), o('cg_wakecmd', '6:30'), o('cg_hold', '3:00'), o('cg_wake', '6:30')], wakeC = { want: 'wake', wake: '6:30', hold: '3:00' };
  const lines = [{ words: ['thanks', 'hi', 'could', 'towels2', 'room'], room: '1207' }, { words: ['give', 'towels2', 'room'], room: '1207' }, { words: ['towels2', 'please', 'hi', 'room'], room: '1207' }, HT.LINE];
  const q = [
    { q: 'Front desk. How can I help you? — 1207호예요. 수건이 더 필요해요. 가장 알맞은 말은?', opts: towel.map(HT.text), a: 1,
      why: '전화 부탁은 방 번호 + 부탁을 질문으로 → Hi, this is room 1207. Could I get some extra towels, please? Give me는 명령처럼, I want는 조르는 말처럼 들려요. Two nights.는 며칠 묵는지 묻는 말의 대답이에요.',
      check: () => towel.map(a => j('cl_help', a, towelC)).join() === 'false,true,false,false' },
    { q: '체크아웃한 뒤 오후 3시까지 짐을 맡기고 싶어요. 어디로 갈까요? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: placeFig('호텔의 네 곳. A 조식 식당 2층, B 객실 12층, C 컨시어지 1층, D 방 열쇠 · 안내 1층', ['breakfast', 'call', 'concierge', 'key'], ['2F', '12F', '1F', '1F']),
      why: '짐 맡기기 · 택시 · 모닝콜 같은 부탁은 컨시어지(concierge)에서 해요(호텔에 따라 프런트가 함께 맡기도 해요). → Could you hold my luggage until three?',
      check: () => HT.PLACES[5].id === 'concierge' && j('cg_help', o('cg_hold', '3:00'), { want: 'hold', hold: '3:00' }) },
    { q: 'And how many nights will you be staying? — 2박 3일이에요. 가장 알맞은 대답은?', opts: nights.map(HT.text), a: 3,
      why: '호텔은 밤(night)으로 세요. 2박 3일 → two nights. Three days라고 하면 3박으로 알아들을 수 있고, During two nights는 ‘동안’을 그대로 옮긴 어색한 말이에요.',
      check: () => nights.map(a => j('ci_nights', a, { nights: 2 })).join() === 'false,false,false,true' },
    { q: 'Could you spell that, please? — 성은 김(Kim)이에요. 가장 알맞은 대답은?', opts: spell.map(HT.text), a: 0,
      why: 'spell → 철자를 한 글자씩 → K-I-M. 성을 다시 말하면(It\'s Kim.) 같은 문제가 남고, Yes, you can.은 허락하는 말, Name is Kim.은 my가 빠진 문장이에요.',
      check: () => spell.map(a => j('ci_spell', a, { name: 'Kim' })).join() === 'true,false,false,false' },
    { q: '카드 키 봉투예요. 아침을 먹으러 갈 때 필요한 정보(시간과 곳)가 적힌 칸은? 그림 속 칸을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: sleeveFig('카드 키 봉투. A ROOM 1207, B FLOOR 12, C BREAKFAST 7:00–10:00 · Garden Room, 2F, D CHECK-OUT 11:00', '1207', ['room', 'floor', 'bf', 'co']),
      why: 'BREAKFAST 칸 → 7시부터 10시까지(from seven to ten), 2층 가든 룸. 방은 12층이지만 조식은 2층이에요.',
      check: () => HT.sleeve('1207')[2].id === 'bf' && HT.BF.floor === 2 },
    { q: '직원이 “You\'re in room twelve-seventy.”라고 말했어요. 방 번호는?', opts: ['1270', '1207', '127', '1217'], a: 0,
      why: '방 번호는 두 자리씩 → twelve(12) + seventy(70) = 1270. 1207이었다면 twelve-oh-seven(0은 oh)이에요. 헷갈리면 → Sorry, was that room 1270?',
      check: () => HT.roomWords('1270') === 'twelve-seventy' && HT.roomWords('1207') === 'twelve-oh-seven' },
    { q: '방의 콘센트에 충전기를 꽂아도 전기가 안 들어와요. 가장 알맞은 말은?', opts: outlet.map(HT.text), a: 0,
      why: '콘센트 → outlet (영국 socket). consent는 ‘동의’라는 낱말이에요. 사실 + 부탁 → The outlet isn\'t working. Could you send someone to look at it? 방을 바꿔 달라는 부탁은 이 문제와 맞지 않고, Fix it.은 따지는 말처럼 들려요.',
      check: () => outlet.map(a => j('pr_help', a, { prob: 'outlet' })).join() === 'true,false,false,false' },
    { q: '내일 아침 6시 30분에 깨워 주는 전화를 받고 싶어요. 가장 알맞은 말은?', opts: wake.map(HT.text), a: 3,
      why: '깨워 주는 전화 → a wake-up call. 부탁은 질문으로, 시각까지 → Could I get a wake-up call at 6:30, please? 6:13(six-thirteen)은 다른 시각, Wake me up …은 명령처럼 들려요.',
      check: () => wake.map(a => j('cg_help', a, wakeC)).join() === 'false,false,false,true' },
    { q: '숙박 카드: 2박 3일 · 미니바 안 씀. 청구서에서 잘못 들어간 요금은? 그림 속 줄을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: billFig('청구서. A 방값 2박 300달러, B 미니바 물 4달러, C 세금 30달러 40센트, D 합계 334달러 40센트', HT.DEMO, ['room', 'mini', 'tax', 'total']),
      why: '미니바를 쓰지 않았는데 미니바 물값이 있어요. 따지지 말고 → I think there\'s a mistake on my bill. I didn\'t use the minibar. (세금과 합계는 그 요금 때문에 함께 달라진 것이에요.)',
      check: () => HT.bill(HT.DEMO).items.find(x => x.wrong).id === 'mini' },
    { q: '전화로 수건 두 장을 부탁해요. 순서가 가장 자연스러운 것은?', opts: lines.map(HT.lineText), a: 3,
      why: '인사 → 방 번호 → 부탁 틀 + 필요한 것 → please → Hi, this is room 1207. Could I get two extra towels, please? 그러면 직원이 방 번호와 몇 개인지 묻지 않아요. (자주 쓰는 순서를 단순하게 줄인 규칙이에요.)',
      check: () => lines.map(L => j('cl_help', { f: 'line', line: L }, { room: '1207', thing: 'towels', n: 2 })).join() === 'false,false,false,true' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[호텔] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[호텔] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { HTV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = HTS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * HTS.W, (e.clientY - r.top) / r.height * HTS.H]; };
const hitAt = (x, y) => started ? HTS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.stop != null) { S.stop = S.stop === h.stop ? null : h.stop; relab(); }
  else if (h && h.play && HTV.supported) speak(h.play);
  else if (h && h.say && EN.say.supported) { stopSounds(); if (playing) pause(); EN.say(HT.spoken(h.say)); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.stop != null ? '눌러서 이곳의 말 보기' : h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { HTV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = HTV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
simInit();
shInit();
HDrill($('drillRoot'), HT.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 열쇠 낱말 → 틀 + 내 정보 → 공손하게, 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09 · 10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '호텔의 일곱 곳이 모두 익숙해졌네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(HTS.baseText()).then(() => { dirty = true; });
setTimeout(() => HTS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
