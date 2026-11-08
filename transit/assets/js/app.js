/* 대중교통 회화 — 플레이어, 직접 해 보기, 대중교통 시뮬레이터, 따라 말하기, 듣고 대답 고르기, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(TR), 그림은 scenes.js(TRS), 목소리는 voices.js(TRV)가 맡습니다.
 * 소리가 겹치지 않게: 대화를 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(TRV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const TR = window.TR, TRS = window.TRS, TRV = window.TRV, S = TRS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = TRS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cv = $('cv'), ctx = cv.getContext('2d');
TR.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = TRS.fonts;
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
  const ready = new Promise(res => TRS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '대중교통, 표는 골라 말하고 길은 되짚는다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { TRS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: TRS.iconSVG('mic'),
};
const PI = id => TRS.iconSVG(id, 'pi');   // 곳 아이콘
const SHI = sh => `<span class="shp shp-${sh}">${TRS.iconSVG('shape_' + sh, 'pi')}${esc(TR.SHAPE[sh].ko)}</span>`;   // 질문의 모양 표시
// 듣기 · 천천히 · 대본 보기 단추 묶음 (공항 · 카페 · 호텔 · 식당 · 쇼핑과 같은 모양 · 같은 키 R · S · T)
const lsnBar = scriptOn => TRV.supported
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
  const cap = started ? TRS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 말풍선을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = TRS.chapterAt(T);
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
  if (dirty) { dirty = false; TRS.render(ctx, started ? T : POSTER); }
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
function stopSounds() { EN.say.stop(); TRV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return TRV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름
const lpBtn = (seq, label, cls = '') => TRV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
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
const meSeq = a => [{ text: typeof a === 'string' ? a : TR.text(a), sp: 'me' }];
// 말하는 사람 (목소리마다 한 사람): 매표소 직원 en-US · 안내 데스크 직원 en-CA · 지하철에서 만난 사람 en-AU · 영국 역무원 · 안내방송 en-GB
const WHO = { us: '매표소 직원', ca: '안내 데스크 직원', au: '지하철에서 만난 사람', gb: '역무원 (영국)' };
const whoOf = q => q.ann ? '안내방송' : WHO[q.sp] || '직원';

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
// 대답 → 역할 색 HTML (틀 노랑 · 칸 민트 · 공손한 말 보라)
const segHTML = (a, on = true) => TR.segs(a).map(s => on && s.t.trim() && /[A-Za-z0-9]/.test(s.t) ? `<mark class="mk-${s.r}">${esc(s.t)}</mark>` : esc(s.t)).join('');
const keyMarks = q => q.key.map(t => ({ t, role: 'key' }));

/* =========================================================
   6. 듣고 대답 고르기 (이 튜토리얼 전용, 쇼핑 SDrill과 같은 모양) — 상대의 말은 소리 먼저, 대답 넷은 글
   생김새와 키보드는 공통 부품 EN.drill과 같게: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본 · Enter/→ 다음
   힌트 ①부터 질문의 모양 표시(스위치 · 갈림길 · 빈 상자 · 말풍선)가 상대의 말 옆에 나와요.
   ========================================================= */
function TDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null;
  const compact = !!cfg.compact, hear = TRV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && TRV.busy()) { TRV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(staffSeq(it.Q), { slow: !!slow, onitem() { paintNow(root, '.ldr-q'); say(`${whoOf(it.Q)} · ${it.Q.fast ? '빠르게 말하는 중' : '말하는 중'}`); },
      onend(stopped) { mode = null; paintPlay(root, null); paintNow(root, null); say(stopped ? '' : '다 들었어요. 대답을 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { TRV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; TRV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    TRV.stop();
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = TR.steps(it), place = TR.PLACE[it.place];
    const marks = []; steps.slice(0, done ? 3 : s.hints).reverse().forEach(x => marks.push(...x.marks));   // 뒤 단계의 색이 앞 단계를 덮음
    const reveal = done || !hear || s.script, mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur), showShape = (done || s.hints > 0) && !it.Q.fast;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${PI(it.place)}${esc(place.ko)}</span><span>${compact ? '듣고 대답 고르기' : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span>${done ? `<span class="edr-tag">${it.Q.fast ? '다시 묻기' : esc(TR.SHAPE[it.Q.shape].ko)}</span>` : ''}</p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(it.sit)}</p>`;
    h += lsnBar(done ? null : s.script);
    h += `<p class="ldr-q"><b>${esc(whoOf(it.Q))}</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="q" aria-label="상대의 말 다시 듣기" title="상대의 말 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.Q.en, mk('q'), reveal)}</span>${showShape ? SHI(it.Q.shape) : ''}${it.Q.fast && !done ? '<small class="adr-fast">아주 빠르게</small>' : ''}</p>`;
    h += `<p class="adr-ask">나의 대답은?</p><div class="ldr-opts" role="group" aria-label="대답 보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '', t = TR.text(op);
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-lp="${seqId(meSeq(t))}" aria-label="(${L4[k]}) 듣기" title="(${L4[k]}) 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(t, mk(k), true)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + TR.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = [[`${whoOf(it.Q)} · ${it.Q.en}`, it.Q.ko, staffSeq(it.Q)]].concat(it.opts.map((op, k) => [`(${L4[k]}) ${TR.text(op)}`, TR.ko(op), meSeq(op)]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      h += `<div class="edr-acts">${hear ? `<button type="button" class="edr-btn ghost adr-ex" data-lp="${seqId(staffSeq(it.Q).concat([{ text: TR.text(it.opts[it.a]), sp: 'me', gap: 0.5 }]))}">${ICO.play} 대화 듣기 (상대 → 나)</button>` : ''}${compact ? '' : `<button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button>`}</div>`;
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
const row = (lab, html) => `<div class="cv-row"><span class="cv-lab">${esc(lab)}</span>${html}</div>`;
const labHead = h3 => `<h2>직접 해 보기</h2><div class="lab-top"><h3>${esc(h3)}</h3></div>`;
const mini = key => `<div class="lmini" data-mini="${key}"></div>`;
const verdictHTML = j => `<p class="verdict"><b class="${j.ok ? 'c-ok' : 'c-no'}">${j.ok ? '좋아요' : ['', '①', '②', '③'][j.stage] + '에서 걸려요'}</b>${esc(j.why)}</p>`;
const clearBtn = '<button class="btn ghost" type="button" id="labClear">영상대로 보기</button>';
const OT = TR.o, D = TR.DEMO;
const qLine = (q, extra = []) => `<p class="enline">${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span class="who">${esc(whoOf(q))}</span><span lang="en">${lineHTML(q.en, (q.fast ? [] : keyMarks(q)).concat(extra), true)}</span></p>`;
const meLine = (a, label = '듣기') => `<p class="enline">${lpBtn(meSeq(a), label)}<span class="who me">나</span><span lang="en">${segHTML(a)}</span></p>`;
const stnOpts = cur => TR.STN_IDS.map(id => `<option value="${id}"${id === cur ? ' selected' : ''}>${esc(TR.STN[id].en)}</option>`).join('');
// 07장에서 고를 수 있는 길: Central에서 갈아타기(영상) · City Hall에서 갈아타기 · 갈아타지 않는 길
const LINE_TRIPS = [
  { from: 'parkroad', to: 'museum', ko: 'Park Road → Museum (영상의 길)' },
  { from: 'harbor', to: 'oldtown', ko: 'Harbor → Old Town' },
  { from: 'university', to: 'southbay', ko: 'University → South Bay' },
];
const seeded = n => () => (n = (n * 16807) % 2147483647) / 2147483647;
const lineChipsFor = T => [{ c: 'open', ids: ['so'] }].concat(TR.lineChips(T, seeded(11)));
// 같은 자리의 조각을 누르면 바꿔 끼우고, 같은 조각을 다시 누르면 빼요 (누른 차례가 말하는 차례)
const toggleWord = (words, w) => words.includes(w) ? words.filter(x => x !== w) : words.filter(x => TR.OW[x].c !== TR.OW[w].c).concat([w]);
// 08장 승강장 · 열차 안: 상황마다 상대의 말 · 사실 · 고를 틀
const TRAIN_SIT = {
  board: { q: 'tb_note', ko: '승강장 안내 → 열차 확인', card: { to: 'museum' }, frames: ['bd_does', 'bd_is', 'bd_wrong', 'bd_lit'], v: 'museum' },
  other: { q: 'tb_no', ko: '반대쪽 열차', card: {}, frames: ['ww_thx', 'ww_this', 'ww_bye'] },
  seat: { q: 'tb_seat', ko: '옆자리', card: null, frames: ['sq_go', 'sq_taken', 'sq_yes'] },
  ann: { q: 'tb_fast', ko: '열차 안 안내방송', card: {}, frames: ['rp_ann', 'rp_again', 'g_yes'] },
};
const LAB = {
  shape: { q: null, pick: null, yes: false },
  ticket: { country: 'gb', type: 'return', party: 'a1', peak: 'offpeak', seat: 'window', ans: 'ok' },
  fare: { dest: 'oakbridge', type: 'single', party: 'a1', disc: false },
  plat: { row: 0, v: null },
  trip: { from: 'parkroad', to: 'museum' },
  line: { trip: 0, words: [] },
  train: { sit: 'board', f: null, free: true },
};
const LAB0 = JSON.stringify(LAB);
const ticketQ = () => TR.Q[LAB.ticket.country === 'us' ? 'tk_us' : 'tk_type'];
const ticketV = (country, type, bad) => bad === 'goback' ? 'goback' : country === 'us' ? (type === 'return' ? 'round' : 'oneway') : type;
const platCard = () => { const B = TRS.BOARD[LAB.plat.row]; return Object.assign({}, D, { plat: B[2], time: B[0] }); };
const platChoices = c => [TR.ptVal(c.plat, c.time), TR.ptVal(c.plat, TR.timeTrap(c.time)), TR.ptVal(c.plat === 9 ? 8 : c.plat + 1, c.time)];
const LABS = {
  intro: () => `${labHead('먼저 골라서 대답해 보세요')}${mini('intro')}
    <p class="note">상대의 말을 듣고 대답을 고르세요. 상대의 말은 답한 뒤에 글로 보여요. 막히면 힌트(H)로 3단계를 하나씩 열어 보세요.</p>`,
  map: () => {
    const i = S.stop, p = i != null ? TR.PLACES[i] : null;
    return `${labHead('곳을 골라 한두 마디 듣기')}
      ${seg('곳', TR.PLACES.map((x, k) => [k, `${PI(x.id)}${k + 1}. ${esc(x.ko)}`]), i == null ? '' : i, 'stop')}
      ${p ? `<ul class="qlist">${TR.ROUTE[p.id].map(id => { const q = TR.Q[id]; return `<li>${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span><span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span><small>${SHI(q.shape)} ${esc(q.ko)}</small></span></li>`; }).join('')}</ul>
        ${TR.ME_FIRST[p.id] ? '<p class="note">이곳에서는 상대의 말이 질문이 아닐 때가 많아요. 내가 먼저 말을 꺼내요.</p>' : ''}${clearBtn}` : '<p class="note">곳을 고르면 그곳에서 자주 듣는 말을 들을 수 있고, 영상 화면의 지도에도 표시돼요. 하늘색 → 열쇠 낱말. 보라색 테두리의 곳(안내 데스크 · 승강장과 열차 안)에서는 내가 먼저 말을 꺼내요.</p>'}`;
  },
  counter: () => {
    const r = LAB.shape, q = r.q ? TR.Q[r.q] : null;
    let res = '';
    if (q && r.pick) res = `<p class="verdict"><b class="${r.pick === q.shape ? 'c-ok' : 'c-no'}">${r.pick === q.shape ? '맞아요' : '다시 보세요'}</b>${esc(`${TR.SHAPE[q.shape].ko} → ${TR.sayOf(q.intent)}. 대답 → ${TR.SHAPE[q.shape].ans}.`)}</p>`;
    if (q && r.yes) { const j = TR.judge(q, { f: 'g_yesp' }, {}, '상황'); res += `${meLine({ f: 'g_yesp' })}${verdictHTML(j)}`; }
    return `${labHead('질문의 모양 맞히기')}
      <p class="note">상대의 말을 고르고, 모양을 맞혀 보세요. 그다음 <span lang="en">Yes, please.</span>로 대답하면 어떻게 되는지 규칙 엔진에 물어봐요.</p>
      ${seg('상대의 말', TR.SHAPE_QS.map(id => [id, `<span lang="en">${esc(TR.Q[id].short && /\?$|!$/.test(TR.Q[id].short) ? TR.Q[id].short : TR.Q[id].en)}</span>`]), r.q || '', 'sq')}
      ${q ? `<h3 class="mt">이 말의 모양은?</h3>${seg('모양', ['yn', 'or', 'wh', 'note'].map(sh => [sh, SHI(sh)]), r.pick || '', 'sp')}
        <div class="tg-acts mt8"><button type="button" class="btn ghost" id="shapeYes">Yes, please.로 대답해 보기</button>${lpBtn(staffSeq(q), '상대의 말 듣기')}</div>${res}${clearBtn}` : ''}`;
  },
  ticket: () => {
    const r = LAB.ticket, q = ticketQ(), C = { type: r.type, party: r.party, peak: r.peak, seat: r.seat };
    const a = r.ans === 'yes' ? { f: 'g_yesp' } : OT('tt_pl', ticketV(r.country, r.type, r.ans)), j = TR.judge(q, a, C, '상황');
    const pv = r.party === 'a1' ? 'me1' : r.party;
    return `${labHead('표 종류 · 사람 수 · 시간대 · 자리')}
      ${row('나라', seg('나라', [['gb', '영국 기차역'], ['us', '미국 기차역']], r.country, 'tc'))}
      ${row('표', seg('표', [['single', '편도 (가기만)'], ['return', '왕복 (갔다 오기)']], r.type, 'tt'))}
      ${row('사람', seg('사람', ['a1', 'a2', 'a1c1', 'a2c1'].map(k => [k, esc(TR.PARTY[k].ko)]), r.party, 'tp'))}
      ${row('시간대', seg('시간대', [['offpeak', '덜 붐비는 시간 (off-peak)'], ['anytime', '아무 때나 (anytime)']], r.peak, 'tk'))}
      ${row('자리', seg('자리', [['window', '창가'], ['aisle', '통로']], r.seat, 'ts'))}
      <h3 class="mt">첫 질문에 대답하는 방법</h3>${seg('대답', [['ok', '고른 것 + please'], ['goback', '‘왕복표’를 낱말 그대로'], ['yes', 'Yes, please.']], r.ans, 'ta')}
      ${qLine(q)}${meLine(a)}${verdictHTML(j)}
      ${qLine(TR.Q.tk_many)}${meLine(OT('pc_pl', pv))}
      ${qLine(TR.Q.tk_peak)}${meLine(OT('pk_pl', r.peak))}
      ${qLine(TR.Q.tk_seat)}${meLine(OT('se_pl', r.seat))}
      <p class="note">${r.country === 'us' ? '미국 → one-way · round trip' : '영국 → single · return'}. 어느 쪽을 말해도 알아들어요. 덜 붐비는 시간(off-peak) 표는 붐비는 시간에는 못 타는 대신 값이 싸요 — 시간대는 회사와 나라마다 달라요. 고른 표는 영상 화면의 기차표에도 나와요.</p>${S.ticket ? clearBtn : ''}`;
  },
  fare: () => {
    const r = LAB.fare, c = { dest: r.dest, type: r.type, party: r.party, disc: r.disc }, F = TR.fareRows(c);
    c.amount = F.total;
    const q = TR.simQ('fr_cost', c), tr = TR.moneyTrap(c.amount);
    return `${labHead('값 듣기와 되묻기')}
      ${row('가는 곳', seg('가는 곳', TR.TOWN_IDS.map(k => [k, esc(TR.TOWNS[k].ko)]), r.dest, 'fd'))}
      ${row('표', seg('표', [['single', '편도'], ['return', '왕복']], r.type, 'fy'))}
      ${row('사람', seg('사람', ['a1', 'a2', 'a1c1', 'a2c1'].map(k => [k, esc(TR.PARTY[k].ko)]), r.party, 'fp'))}
      ${row('학생 카드', seg('학생 카드', [['0', '없음'], ['1', `있음 (${TR.DISC_OFF}% 할인)`]], r.disc ? '1' : '0', 'fc'))}
      <ul class="rlist">${F.rows.map(x => `<li><span>${esc(x.ko)}</span><b>${x.c < 0 ? '−' + TR.money(-x.c) : TR.money(x.c)}</b></li>`).join('')}<li class="tot"><span>모두 TOTAL</span><b>${TR.money(F.total)}</b></li></ul>
      ${qLine(q, [{ t: TR.money(c.amount), role: 'slot' }])}
      <p class="note">읽기 → <span lang="en">${esc(TR.priceWords(c.amount))}</span> · ${esc(TR.priceKo(c.amount))}. 헷갈리기 쉬운 값 → <span lang="en">${esc(TR.money(tr))}</span> (${esc(TR.priceWords(tr))}). 값은 지어낸 값이고, 어린이는 반값 · 학생 카드는 ${TR.DISC_OFF}% 할인(10센트 단위)도 지어낸 규칙이에요. 영상 · 운임표 · 직원의 말이 모두 같은 계산(<code>TR.fare</code>)이에요.</p>
      ${meLine(OT('co_card'), '맞는 대답 듣기')}
      <h3 class="mt">fourteen이냐 forty냐</h3>
      <ul class="qlist">${TR.PAIRS.map(([n1, s1, n2, s2]) => `<li>${lpBtn([{ text: TR.numWord(+n1), sp: 'tc' }], '듣기: ' + TR.numWord(+n1))}<span><span lang="en">${esc(s1)}</span><small>${n1} · 뒤를 세게</small></span>${lpBtn([{ text: TR.numWord(+n2), sp: 'tc' }], '듣기: ' + TR.numWord(+n2))}<span><span lang="en">${esc(s2)}</span><small>${n2} · 앞을 세게</small></span></li>`).join('')}</ul>
      <h3 class="mt">값을 되물어 확인하기</h3>${mini('cost')}${S.fare ? clearBtn : ''}`;
  },
  plat: () => {
    const r = LAB.plat, c = platCard(), q = TR.simQ('pl_info', c), ch = platChoices(c);
    let res = '';
    if (r.v) {
      const a = OT('pt_so', r.v), j = TR.judge(q, a, c, '상황');
      res = `${meLine(a)}${verdictHTML(j)}`;
      if (!j.ok) { const re = TR.REACT[2](q, j, a, c); res += `<p class="enline">${lpBtn([{ text: re.en, sp: q.sp }], '직원의 대답 듣기')}<span class="who">${esc(whoOf(q))}</span><span lang="en">${esc(re.en)}</span></p>`; }
    }
    return `${labHead('승강장과 시각 되짚기')}
      <p class="note">출발 안내판에서 열차를 고르면, 직원이 그 열차의 승강장과 시각을 알려 줘요. 숫자 둘을 되짚어 확인해 보세요.</p>
      ${row('열차', seg('열차', TRS.BOARD.map(([t, to, pl], k) => [k, `<span lang="en">${t} · ${esc(to)} · ${pl}</span>`]), r.row, 'pr'))}
      ${qLine(q, [{ t: c.time, role: 'slot' }, { t: `platform ${c.plat}`, role: 'slot' }])}
      <p class="note">읽기 → <span lang="en">platform ${esc(TR.numWord(c.plat))} at ${esc(TR.timeWords(c.time))}</span> · ${c.plat}번 승강장 · ${esc(TR.timeKo(c.time))}</p>
      <h3 class="mt">되짚기 <span lang="en">So, ___?</span></h3>${seg('되짚기', ch.map(v => [v, `<span lang="en">${esc(TR.sv('pt', v).t)}</span>`]), r.v || '', 'pv')}
      ${res}
      <p class="note">시각은 두 자리씩 끊어 읽어요 → <span lang="en">11:13 → eleven thirteen</span> · <span lang="en">9:05 → nine oh five</span>. 열차와 시각은 지어낸 것이에요.</p>${S.plat ? clearBtn : ''}`;
  },
  info: () => {
    const r = LAB.trip, same = r.from === r.to, R = same ? null : TR.route(r.from, r.to);
    const ask = OT('aw_how', r.to), q = R ? TR.simQ('ro_say', { from: r.from, to: r.to }) : null;
    return `${labHead('길 묻고 노선도 읽기')}
      <div class="cv-row"><span class="cv-lab">지금 있는 역</span><select class="sel" data-tf="from" aria-label="지금 있는 역">${stnOpts(r.from)}</select></div>
      <div class="cv-row"><span class="cv-lab">가려는 역</span><select class="sel" data-tf="to" aria-label="가려는 역">${stnOpts(r.to)}</select></div>
      ${qLine(TR.Q.in_next)}${meLine(ask)}
      ${R ? `${qLine(q)}<p class="note">${esc(TR.sayKo(R))}</p>
        <p class="note">${R.transfers ? `갈아타기 한 번 → ${esc(TR.STN[R.legs[1].from].ko)} · 모두 ${R.stops}정거장` : `갈아타지 않아요 · ${R.stops}정거장`}. 직원은 갈아타기가 가장 적은 길(그다음 정거장이 적은 길)을 알려 줘요 — 규칙 엔진(<code>TR.route</code>)의 계산이에요. 방향(towards)은 그 노선의 끝 역 이름이에요.</p>` : '<p class="note">지금 있는 역과 가려는 역이 같아요. 다른 역을 골라 보세요.</p>'}
      <h3 class="mt">지하철 카드에 돈 넣기</h3>
      ${qLine(TR.Q.in_card)}${meLine(OT('mc_top'))}${qLine(TR.Q.in_amt)}${meLine(OT('ta_pl', '2000'))}
      <p class="note">‘충전’ → <span lang="en">charge</span>로 옮기면 카드로 값을 낸다는 말로 들려요. 돈을 넣는 것은 → <span lang="en">top up · add money</span>. 노선 · 역 이름은 지어낸 것이에요.</p>${S.trip ? clearBtn : ''}`;
  },
  route: () => {
    const L = LAB.line, T = LINE_TRIPS[L.trip], C = { from: T.from, to: T.to }, q = TR.simQ('ro_say', C), a = TR.L(L.words.slice());
    const rows = lineChipsFor(C).map(gr => row(TR.OCAT[gr.c].ko, `<div class="seg">${gr.ids.map(w => `<button type="button" data-lw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(TR.OW[w].t)}</span></button>`).join('')}</div>`)).join('');
    let res = '';
    if (L.words.length || L.skip) {
      const A = L.skip ? OT('ro_ok') : a, j = TR.judge(q, A, C, '상황'), fx = L.skip ? null : TR.fixLine(a.line, C);
      res = `${meLine(A)}${verdictHTML(j)}${fx ? `<p class="enline">${lpBtn([{ text: fx.en, sp: q.sp }], '직원의 대답 듣기')}<span class="who">${esc(whoOf(q))}</span><span lang="en">${esc(fx.en)}</span></p>` : ''}`;
    }
    return `${labHead('들은 길을 한 줄로 되짚기')}
      ${row('길', seg('길', LINE_TRIPS.map((x, k) => [k, esc(x.ko)]), L.trip, 'lt'))}
      ${qLine(q)}
      <p class="note">조각을 누르는 차례대로 문장이 돼요. 일부러 순서를 바꾸거나, 방향을 반대쪽 끝 역으로 바꾸거나, <span lang="en">get down</span>을 넣어 보세요.</p>
      ${rows}${res}
      <div class="tg-acts mt8"><button class="btn ghost" type="button" id="lineSkip">되짚지 않고 → Okay. Thanks.</button><button class="btn ghost" type="button" id="lineClear">처음부터</button>${S.line ? clearBtn : ''}</div>
      <p class="note">순서(So, I → 탈 노선 → 방향 → 갈아타는 역 → 갈아탈 노선 → 내릴 역)는 자주 쓰는 순서를 단순하게 줄인 규칙이에요. 틀린 조각이 있으면 직원은 그 조각만 고쳐 줘요(<code>TR.fixLine</code>).</p>`;
  },
  train: () => {
    const r = LAB.train, X = TRAIN_SIT[r.sit], q = TR.Q[X.q], C = X.card || { seatFree: r.free };
    let res = '';
    if (r.f) {
      const a = TR.FRAME[r.f].slot ? OT(r.f, X.v) : OT(r.f), j = TR.judge(q, a, C, '상황');
      res = `${meLine(a)}${verdictHTML(j)}`;
      if (j.ok) { const rp = TR.reply(q, a, C) || (q.ann ? 'It said the next station is Central. Change there for the Blue Line.' : null); if (rp) res += `<p class="enline">${lpBtn([{ text: rp, sp: q.ann ? 'au' : q.sp }], '상대의 대답 듣기')}<span class="who">${esc(q.ann ? WHO.au : whoOf(q))}</span><span lang="en">${esc(rp)}</span></p>`; }
    }
    return `${labHead('승강장과 열차 안에서')}
      ${row('상황', seg('상황', Object.entries(TRAIN_SIT).map(([k, x]) => [k, esc(x.ko)]), r.sit, 'rs'))}
      ${r.sit === 'seat' ? row('옆자리', seg('옆자리', [['1', '비어 있음'], ['0', '친구 자리 (가방)']], r.free ? '1' : '0', 'rf')) : ''}
      ${q.ann ? `<p class="enline">${lpBtn(staffSeq(q), '안내방송 듣기 (아주 빠르게)')}<span class="who">${esc(whoOf(q))}</span><span class="note">아주 빠르게 한 번만 나와요. 글은 영상 08장에 있어요.</span></p>` : qLine(q)}
      ${r.sit === 'board' ? '<p class="note">Museum 역에 가는 열차인지 확인하고 싶어요. 승강장 안내는 질문이 아니에요 — 내가 먼저 물어요.</p>' : r.sit === 'other' ? '<p class="note">Museum 역에 가냐고 물었더니 이렇게 대답했어요.</p>' : r.sit === 'ann' ? '<p class="note">하나도 못 알아들었어요. 옆 사람에게 물어요.</p>' : ''}
      <h3 class="mt">대답 고르기</h3>${seg('대답', X.frames.map(f => [f, `<span lang="en">${esc(TR.text(TR.FRAME[f].slot ? OT(f, X.v) : OT(f)))}</span>`]), r.f || '', 'rt')}
      ${res}`;
  },
  method: () => {
    const i = S.place, rw = i != null ? TR.METHOD[i] : null;
    return `${labHead('곳마다 3단계 적용해 보기')}
      ${seg('곳', TR.METHOD.map(([qid], k) => [k, `${PI(TR.Q[qid].place)}${esc(TR.PLACE[TR.Q[qid].place].ko)}`]), i == null ? '' : i, 'place')}
      ${rw ? (() => { const [qid, a, c] = rw, q = TR.Q[qid], j = TR.judge(q, a, c); return `<p class="enline">${lpBtn(staffSeq(q), '듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
        <ol class="edr-steps"><li><b>① 열쇠 낱말 + 모양</b> ${esc(q.key.join(' … '))} → ${SHI(q.shape)} ${esc(TR.sayOf(q.intent))}</li><li><b>② 틀 + 내 정보</b> <span lang="en">${segHTML(a)}</span> ${esc(TR.ko(a))}</li><li><b>③ 공손하게</b> ${esc(j.why)}</li></ol>
        <p class="enline">${lpBtn(staffSeq(q).concat([{ text: TR.text(a), sp: 'me', gap: 0.5 }]), '대화 듣기')}<span>대화 듣기</span></p>
        ${clearBtn}`; })() : '<p class="note">곳을 고르면 영상 화면의 그 줄이 켜지고, 세 단계를 글로 보여 줘요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>대화 골라 보기</h3>
    <div class="seg">${TRS.PSEG.map((t, i) => `<button type="button" data-seek="${t + 0.4}">대화 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 해 보고 싶다면 아래 <a href="#playground">대중교통 시뮬레이터</a>에서 내 여행 카드로 매표소부터 열차 안까지 해 보세요. 카드는 누를 때마다 새로 만들어져요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">대중교통 시뮬레이터</a> — 여행 카드로 매표소부터 열차 안까지(갈아타는 길 되짚기도)</li><li><a href="#shadow">대중교통 표현 따라 말하기</a> — ${TR.SHADOW.length}문장 듣고 따라 하기</li>
    <li><a href="#drill">듣고 대답 고르기</a> — 일곱 곳 ${TR.DRILL.length}문제, 3단계 힌트</li><li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.querySelectorAll('.lmini').forEach(m => TDrill(m, [TR.MINI[m.dataset.mini]], { compact: true, onAnswer() { if (playing) pause(); } }));
}
function showAt(u) { const ch = CHAPTERS[TRS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const relab = () => { touch(); buildLab(TRS.chapterAt(T)); };
// 직접 해 보기 상태 → 영상 화면 상태
const syncShape = () => { S.shape = LAB.shape.q || null; };
const syncTicket = () => { const r = LAB.ticket; S.ticket = { country: r.country, type: r.type, party: r.party, peak: r.peak, seat: r.seat }; };
const syncFare = () => { const r = LAB.fare; S.fare = { dest: r.dest, type: r.type, party: r.party, disc: r.disc }; };
const syncPlat = () => { const c = platCard(); S.plat = { plat: c.plat, time: c.time }; };
const syncTrip = () => { const r = LAB.trip; S.trip = r.from !== r.to ? { from: r.from, to: r.to } : null; };
const syncLine = () => { const L = LAB.line, T = LINE_TRIPS[L.trip]; S.line = L.words.length ? { from: T.from, to: T.to, words: L.words.slice() } : null; };
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  const d = b.dataset;
  if (d.seek) { seek(CHAPTERS[TRS.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') {
    ['stop', 'place', 'shape', 'ticket', 'fare', 'plat', 'trip', 'line'].forEach(k => { S[k] = null; });
    Object.assign(LAB, JSON.parse(LAB0));
    relab(); return;
  }
  if (d.stop != null) { S.stop = d.stop === '' ? null : +d.stop; showAt(18.8); relab(); return; }
  // 02장 질문의 모양
  if (d.sq) { LAB.shape = { q: d.sq, pick: null, yes: false }; syncShape(); relab(); return; }
  if (d.sp) { LAB.shape.pick = d.sp; syncShape(); relab(); return; }
  if (b.id === 'shapeYes') { LAB.shape.yes = true; syncShape(); relab(); return; }
  // 03장 표 종류 · 사람 수
  if (d.tc) { LAB.ticket.country = d.tc; syncTicket(); relab(); return; }
  if (d.tt) { LAB.ticket.type = d.tt; syncTicket(); relab(); return; }
  if (d.tp) { LAB.ticket.party = d.tp; syncTicket(); relab(); return; }
  if (d.tk) { LAB.ticket.peak = d.tk; syncTicket(); relab(); return; }
  if (d.ts) { LAB.ticket.seat = d.ts; syncTicket(); relab(); return; }
  if (d.ta) { LAB.ticket.ans = d.ta; syncTicket(); relab(); return; }
  // 04장 할인 · 값
  if (d.fd) { LAB.fare.dest = d.fd; syncFare(); relab(); return; }
  if (d.fy) { LAB.fare.type = d.fy; syncFare(); relab(); return; }
  if (d.fp) { LAB.fare.party = d.fp; syncFare(); relab(); return; }
  if (d.fc != null) { LAB.fare.disc = d.fc === '1'; syncFare(); relab(); return; }
  // 05장 승강장 · 시각
  if (d.pr != null) { LAB.plat = { row: +d.pr, v: null }; syncPlat(); relab(); return; }
  if (d.pv) { LAB.plat.v = d.pv; syncPlat(); relab(); return; }
  // 07장 되짚기
  if (d.lt != null) { LAB.line = { trip: +d.lt, words: [] }; syncLine(); relab(); return; }
  if (d.lw) { LAB.line.words = toggleWord(LAB.line.words, d.lw); LAB.line.skip = false; syncLine(); relab(); return; }
  if (b.id === 'lineClear') { LAB.line.words = []; LAB.line.skip = false; syncLine(); relab(); return; }
  if (b.id === 'lineSkip') { LAB.line.words = []; LAB.line.skip = true; syncLine(); relab(); return; }
  // 08장 승강장 · 열차 안 (영상 화면은 그대로)
  if (d.rs) { LAB.train = { sit: d.rs, f: null, free: LAB.train.free }; relab(); return; }
  if (d.rf != null) { LAB.train.free = d.rf === '1'; LAB.train.f = null; relab(); return; }
  if (d.rt) { LAB.train.f = d.rt; relab(); return; }
  if (d.place != null) { S.place = d.place === '' ? null : +d.place; showAt(3.8); relab(); }
});
// 06장 역 고르기
$('lab').addEventListener('change', e => {
  const s = e.target; if (!s || !s.dataset || !s.dataset.tf) return;
  LAB.trip[s.dataset.tf] = s.value; syncTrip(); relab();
});
/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   영어 문장 속 값 · 시각 · 승강장 번호는 영어 낱말로($14.50 → fourteen fifty, at 10:15 → at ten fifteen),
   한국어 속 시각은 한국어로(10:50으로 → 10시 50분으로) 읽어요
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/\$(\d+)\.(\d{2})\b/g, (m, d, c) => TR.priceWords(+d * 100 + +c)],
    [/\b(at|the|from|is) (\d{1,2}:\d{2})\b/g, (m, w, t) => `${w} ${TR.timeWords(t)}`],
    [/\bplatform (\d{1,2})\b/g, (m, n) => `platform ${TR.numWord(+n)}`],
    [/\b(\d{1,2}):(\d{2})\b/g, (m, h, mm) => (+mm ? `${+h}시 ${+mm}분` : `${+h}시`)],
    [/OAKBRIDGE/g, 'Oakbridge'],
    [/Yes\/No/g, 'Yes or No'],
    [/\s\+\s/g, ', '], [/ = /g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
  clips: window.EN_CLIPS,   // 미리 만든 음성 파일(audio/narration/) — 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로
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
   10. 놀이터 — 대중교통 시뮬레이터
   기차역: 매표소 → 표 종류 · 몇 명 → 할인 · 값 → 승강장. (다른 날) 지하철: 안내 데스크 → 갈아타기 안내 → 승강장 · 열차 안.
   값 · 승강장 · 시각은 여행 카드에 없어요 — 직원이 말한 숫자를 듣고 써야 해요. 갈아타는 길은 조각 칩으로 되짚어요(TR.lineChips → TR.checkLine).
   같은 곳에서 이미 답한 질문은 건너뛰어요(TR.covered). 편도 · 왕복(TR.CROSS)은 매표소에서 말했으면 건너뛰어요.
   ========================================================= */
const SIM = { card: null, qs: [], i: 0, frames: [], slots: {}, f: null, v: null, log: [], started: false, script: !TRV.supported, mode: null, react: null, why: null, done: false, listening: false, heard: null, covered: new Set(), skipped: [], line: { words: [] }, chips: [] };
const simQ = () => TR.simQ(SIM.qs[SIM.i], SIM.card);
const simC = () => Object.assign({}, SIM.card, simQ().fact || {});
window.__simCard = () => Object.assign({}, SIM.card);   // 확인용(읽기만): 지금 여행 카드
window.__simQ = () => Object.assign({}, simQ());          // 확인용(읽기만): 지금 상대의 말
const keyOf = q => `${q.place}:${q.intent}`;
const skipLabel = ids => ids.map(id => TR.INTENT_KO[TR.Q[id].intent]).filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
const isCovered = q => SIM.covered.has(keyOf(q)) || SIM.covered.has('*:' + q.intent);
const METRO_PLACES = { info: 1, route: 1, train: 1 };
const PLACE_INTRO = {
  plat: () => '표를 샀어요. 직원이 승강장과 출발 시각을 알려 줘요. 숫자 둘을 잘 듣고 되짚어요.',
  info: () => '다른 날, 시내에서 지하철을 타요. 안내 데스크에서 내 차례가 됐어요 — 내가 먼저 길을 물어요.',
  route: () => '직원이 갈아타는 길을 알려 줘요. 길고 빨라요 — 조각으로 듣고 들은 차례대로 되짚어요. 노선도를 보세요.',
  train: () => '승강장에 왔어요. 역무원의 안내를 듣고, 이 열차가 맞는지 내가 먼저 물어요.',
};
function simNew() {
  TRV.stop(); stopListening();
  SIM.card = TR.newCard(); SIM.qs = TR.simQs(SIM.card); SIM.i = 0; SIM.log = []; SIM.done = false; SIM.react = null; SIM.why = null; SIM.heard = null;
  SIM.covered = new Set(); SIM.skipped = [];
  simPrep(); simBuild();
}
function simPrep() {
  const q = simQ(), C = simC();
  SIM.slots = {}; SIM.f = null; SIM.v = null; SIM.line = { words: [] }; SIM.chips = [];
  if (q.intent === 'route') { SIM.frames = []; SIM.chips = [{ c: 'open', ids: ['so'] }].concat(TR.lineChips(C)); }
  else {
    SIM.frames = shuffle(TR.simFrames(q.intent, C) || []);
    SIM.frames.forEach(f => { const Fm = TR.FRAME[f]; if (Fm.slot) SIM.slots[f] = TR.slotChoices(Fm.slot, C, Math.random, q); });
  }
  if (!SIM.log[SIM.i]) SIM.log[SIM.i] = { q: q.id, en: q.en, sp: q.sp, place: q.place, tries: [] };
}
function simSpeak(lines, o = {}) {
  const box = $('sim');
  // 시뮬레이터는 카드마다 말이 바뀌어 미리 만든 파일이 없어요 → 한 사람의 목소리가 바뀌지 않게 모두 브라우저 음성
  speak(lines, { slow: !!o.slow, clips: false, onitem() { paintNow(box, '.sim-bub'); }, onend() { SIM.mode = null; paintPlay(box, null); paintNow(box, null); } });
  SIM.mode = o.slow ? 'slowplay' : 'play'; paintPlay(box, SIM.mode);
}
function simAsk(prefix, slow) { const q = simQ(); simSpeak((prefix ? [{ text: prefix.text, sp: prefix.sp || 'us' }] : []).concat([{ text: q.en, sp: q.sp, gap: 0.5 }]), { slow }); }
// 다시 묻기에 상대가 하는 대답: 모르는 낱말 풀이 · 값 확인, 그 밖에는 천천히 한 번 더
function repairLine(kind, q, C) {
  if (kind === 'what') return q.intent === 'peak' ? 'Sure. An off-peak ticket is cheaper, but you can\'t use it at the busiest times.' : 'Sure. A railcard is a discount card for trains.';
  if (kind === 'check' && q.intent === 'cost') return `Yes, that's right. ${TR.money(C.amount)}.`;
  return null;
}
function simAnswer(a, spoken) {
  if (SIM.done || !SIM.started) return;
  const q = simQ(), C = simC(), L = SIM.log[SIM.i];
  const j = spoken ? TR.matchSpoken(spoken, q, C) : TR.judge(q, a, C);
  const model = TR.model(q, C);
  SIM.heard = spoken || null;
  if (j.repair) {
    const re = repairLine(j.repair, q, C);
    SIM.react = { en: re || 'Sure. ' + q.en, ko: re ? (j.repair === 'check' ? '직원이 숫자를 확인해 줬어요. 이제 대답해 보세요.' : '직원이 쉬운 말로 알려 줬어요. 이제 대답해 보세요.') : '다시 물었어요. 상대가 천천히 한 번 더 말해요.', st: 'repair', who: whoOf(q) }; SIM.why = null; simBuild();
    simSpeak(re ? [{ text: re, sp: q.sp }] : [{ text: 'Sure.', sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }], { slow: true }); return;
  }
  L.tries.push({ t: spoken ? `(말로) ${spoken}` : TR.text(a), ok: j.ok, stage: j.stage });
  SIM.why = { j, model, spoken: !!spoken };
  if (j.ok) {
    L.final = spoken || TR.text(a);
    // 이 대답이 함께 답한 다른 질문만 (이 질문의 뜻은 빼요). 한 번만 나오는 질문(편도 · 왕복)은 다른 곳에서도 건너뛰어요
    (spoken ? (j.covered || [q.intent]) : TR.covered(a, q)).filter(i => i !== q.intent).forEach(i => SIM.covered.add(TR.CROSS[i] ? `*:${i}` : `${q.place}:${i}`));
    const ok = TR.REACT.ok[(SIM.i + L.tries.length) % TR.REACT.ok.length];
    let n = SIM.i + 1; const skip = [];
    while (n < SIM.qs.length && isCovered(TR.Q[SIM.qs[n]])) { skip.push(SIM.qs[n]); n++; }
    SIM.skipped.push(...skip);
    const reply = TR.reply(q, a || model, C);
    if (n >= SIM.qs.length) {
      const bye = [reply, 'Have a good trip!'].filter(Boolean).join(' ');
      SIM.done = true; SIM.react = { en: bye, ko: '여행 끝! 기차표를 사고, 지하철을 갈아타 가려는 역까지 왔어요.', st: 'ok', who: whoOf(q) };
      simBuild(); simSpeak([{ text: bye, sp: q.sp }]); return;
    }
    const prevPlace = q.place;
    SIM.i = n; simPrep();
    const nq = simQ(), moved = nq.place !== prevPlace, intro = moved && PLACE_INTRO[nq.place] ? PLACE_INTRO[nq.place](SIM.card) : '';
    const skipKo = skipLabel(skip);
    const pre = reply || (skip.length ? 'Great.' : ok);
    // 곳이 바뀌면 다른 사람이 말해요: 앞사람의 맺는 말 → 새 사람의 말
    SIM.react = { en: pre, ko: (skip.length ? `한 번에 말해서 ${skipKo} 질문을 건너뛰었어요. ` : '통과! ') + intro, st: 'ok', who: whoOf(q) };
    simBuild();
    if (nq.sp === q.sp) simAsk({ text: pre, sp: q.sp });
    else simSpeak([{ text: pre, sp: q.sp }, { text: nq.en, sp: nq.sp, gap: 0.6 }]);
  } else {
    const r = j.stage === 1 ? TR.REACT[1](q) : j.stage === 2 ? TR.REACT[2](q, j, a, C) : j.stage === 3 ? TR.REACT[3](q, j, a) : { en: 'Sorry?', ko: '알아듣지 못했어요.' };
    SIM.react = Object.assign({ st: 'no', who: whoOf(q) }, r);
    if (q.intent !== 'route') { SIM.f = null; SIM.v = null; }   // 되짚기는 틀린 조각만 바꿔 끼우게 그대로 둬요
    simBuild(); simSpeak([{ text: r.en, sp: q.sp }]);
  }
}
const chipT = f => esc(TR.FRAME[f].t.replace(/[{}]/g, '')).replace('___', '<i class="blank">___</i>');
const slotLabel = (f, v) => { const F0 = TR.FRAME[f], x = TR.sv(F0.slot, v); return x ? (x[F0.form || 't'] != null ? x[F0.form || 't'] : x.t) : v; };
// 기차표 (HTML) — 시뮬레이터의 끝
function ticketHTML(c) {
  const T = TR.TOWNS[c.dest], P = TR.PARTY[c.party];
  const rows = [['FROM', TR.STATION.toUpperCase()], ['TO', T.en.toUpperCase()],
    ['TYPE', c.type === 'return' ? (c.us ? 'ROUND TRIP' : 'RETURN') : (c.us ? 'ONE-WAY' : 'SINGLE')],
    ['PASSENGERS', `${P.a} ADULT${P.a > 1 ? 'S' : ''}${P.c ? ` + ${P.c} CHILD${P.c > 1 ? 'REN' : ''}` : ''}`],
    ['VALID', c.peak === 'offpeak' ? 'OFF-PEAK' : 'ANYTIME'], ['SEAT', c.seat === 'window' ? 'WINDOW' : 'AISLE'],
    ['PLATFORM', `${c.plat} · ${c.time}`]];
  return `<div class="rcpt" role="img" aria-label="기차표: ${esc(T.ko)} · ${esc(TR.money(c.amount))} · ${c.plat}번 승강장 ${esc(TR.timeKo(c.time))}"><p class="rc-h">${esc((TR.CITY + ' Rail · Ticket').toUpperCase())}</p><p class="rc-g">PAID ${c.paym === 'cash' ? 'CASH' : 'CARD'}${c.disc ? ` · STUDENT ${TR.DISC_OFF}% OFF` : ''}</p><ul>${rows.map(([k, v]) => `<li><span>${k}</span><b>${esc(v)}</b></li>`).join('')}</ul><p class="rc-t"><span>PRICE</span><b>${esc(TR.money(c.amount))}</b></p><p class="rc-n">값 읽기 → <span lang="en">${esc(TR.priceWords(c.amount))}</span> · 시각 읽기 → <span lang="en">${esc(TR.timeWords(c.time))}</span>. 역 · 값 · 시각은 지어낸 것이에요.</p></div>`;
}
// 지하철 길 (한 줄)
function tripKo(c) {
  const R = TR.route(c.from, c.to);
  return `지하철 → ${TR.STN[c.from].ko}에서 ${TR.STN[c.to].ko}까지, ${R.transfers ? `${TR.STN[R.legs[1].from].ko}에서 한 번 갈아타고` : '갈아타지 않고'} ${R.stops}정거장. 열차 안에서는 ${c.seatFree ? '빈 옆자리를 내어 줬어요' : '친구 자리라고 공손하게 알렸어요'}.`;
}
// 노선도 (캔버스) — 지금 있는 역(하늘) · 가려는 역(핀). 길은 되짚기를 마친 뒤에만 그려요
function drawSimMap(C, showRoute) {
  const c = $('simMap'); if (!c) return;
  const W0 = 380, H0 = 320, d = 2, g = c.getContext('2d');
  c.width = W0 * d; c.height = H0 * d; g.setTransform(d, 0, 0, d, 0, 0);
  g.fillStyle = TRS.COL.bg; g.fillRect(0, 0, W0, H0);
  TRS.metroMap(g, { x: 0, y: 0, w: W0, h: H0, px: 44, py: 36 }, { ts: 0.74, ls: 14, route: showRoute ? TR.route(C.from, C.to) : null, here: C.from, hereTag: false, pin: C.to, keep: [C.from, C.to], terms: true });
}
const mapFig = (C, showRoute) => `<figure class="sim-map"><canvas id="simMap" role="img" aria-label="노선도: 지금 있는 역 ${esc(TR.STN[C.from].en)} · 가려는 역 ${esc(TR.STN[C.to].en)}"></canvas><figcaption>노선도 — 하늘색 점 = 지금 있는 역(${esc(TR.STN[C.from].en)}) · 노란 핀 = 가려는 역(${esc(TR.STN[C.to].en)}) · 흰 동그라미 = 갈아타는 역 · 색 이름 = 그 노선의 끝 역(방향)${showRoute ? ' · 굵은 선 = 되짚은 길' : ''}</figcaption></figure>`;
function simBuild() {
  const hear = TRV.supported, C = SIM.card;
  $('simCard').innerHTML = `<p class="tc-head">${PI('ticket')}<b>여행 카드</b> <span lang="en">TRAVEL CARD</span></p><dl>${TR.cardRows(C).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="tc-foot">기차역: ${esc(TR.STATION)} · 지하철: ${esc(TR.METRO)} (지어낸 곳) · 값 · 승강장 · 시각은 카드에 없어요 — 직원이 말하는 숫자를 들어요</p>`;
  const prog = SIM.qs.map((id, k) => { const L = SIM.log[k], skipped = SIM.skipped.includes(id), c = skipped ? ' skip' : !L || !L.final ? (k === SIM.i && !SIM.done ? ' cur' : '') : L.tries[0] && L.tries[0].ok ? ' ok' : ' late'; return `<li class="${c}" title="${esc(TR.INTENT_KO[TR.Q[id].intent] || '')}${skipped ? ' (건너뜀)' : ''}">${k + 1}</li>`; }).join('');
  $('simProg').innerHTML = prog;
  const box = $('simMain');
  if (!SIM.started) {
    box.innerHTML = `<div class="sim-start"><p>왼쪽 여행 카드가 오늘의 사실이에요. 기차역 매표소 → 표 종류 · 몇 명 → 할인 · 값 → 승강장, 그리고 다른 날 지하철 안내 데스크 → 갈아타기 안내 → 승강장 · 열차 안 차례로 이야기해요. 먼저 <b>질문의 모양</b>을 잡고(Yes/No · 고르기 · 정보 · 안내), 대답 틀 칩을 고른 뒤 카드의 정보 칩을 넣어요. 값 · 승강장 · 시각은 카드에 없으니 <b>직원이 말하는 숫자</b>를 잘 들으세요. 갈아타는 길은 <b>조각 칩</b>으로 들은 차례대로 되짚어요(R 다시 듣기 · S 천천히)${SRC ? ' — 마이크로 말해서 대답할 수도 있어요' : ''}.</p><button type="button" class="btn" id="simGo">매표소에서 시작 (Enter)</button></div>`;
    return;
  }
  if (SIM.done) {
    const first = SIM.log.filter(L => L && L.tries[0] && L.tries[0].ok).length, asked = SIM.log.filter(Boolean).length, saved = SIM.skipped.length;
    const ml = TR.modelLine(TR.route(C.from, C.to));
    box.innerHTML = `<div class="sim-end"><div class="end-art">${ticketHTML(C)}${mapFig(C, true)}</div><div><p class="sim-score"><b>${first} / ${asked}</b> 질문을 한 번에 통과했어요.</p>
      <p class="sim-saved">${saved ? `한 번에 말해서 상대의 질문 <b>${saved}개</b>를 건너뛰었어요 (${esc(skipLabel(SIM.skipped))}).` : `되짚은 길 → <span lang="en">${segHTML(ml)}</span> ${lpBtn(meSeq(ml), '되짚기 한 줄 듣기')}`}</p>
      <p class="note">${esc(tripKo(C))}</p>
      <p class="sim-react ok"><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>
      <ol class="sim-log">${SIM.log.filter(Boolean).map(L => `<li><span class="who">${esc(WHO[L.sp] || '직원')}</span>${lpBtn([{ text: L.en, sp: L.sp }], '듣기')}<span lang="en">${esc(L.en)}</span><br><span class="who me">나</span>${lpBtn(meSeq(L.final), '듣기')}<span lang="en">${esc(L.final)}</span>${L.tries.length > 1 ? ` <small>(${L.tries.length}번째에 통과)</small>` : ''}</li>`).join('')}</ol>
      <div class="tg-acts"><button type="button" class="btn" id="simAgain">새 카드로 다시 (N)</button>${hear ? `<button type="button" class="btn ghost" data-lp="${seqId(SIM.log.filter(Boolean).flatMap(L => [{ text: L.en, sp: L.sp }, { text: L.final, sp: 'me', gap: 0.4 }]))}">대화 전체 듣기</button>` : ''}</div></div></div>`;
    drawSimMap(C, true);
    return;
  }
  const q = simQ(), show = SIM.script || !hear, route = q.intent === 'route';
  let fa = null;
  if (SIM.f) { const Fm = TR.FRAME[SIM.f]; if (!Fm.slot || SIM.v) { fa = { f: SIM.f }; if (Fm.slot) fa.v = SIM.v; } }
  let h = `${lsnBar(SIM.script)}`;
  h += `<div class="sim-officer">${staffSVG(TRS.kindOf(q))}<p class="sim-bub"><span class="who">${esc(whoOf(q))}</span><span class="ldr-t" lang="en">${lineHTML(q.en, show ? keyMarks(q) : [], show)}</span>${show ? SHI(q.shape) : ''}${hear ? `<button type="button" class="lp-play lp-mini" data-simline="1" aria-label="다시 듣기" title="다시 듣기">${SVG_PLAY}</button>` : ''}</p></div>`;
  if (SIM.react) h += `<p class="sim-react ${SIM.react.st}"><span class="who">${esc(SIM.react.who || whoOf(q))}</span><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>`;
  const mic = SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 대답하기 (M)'}</button>` : '';
  if (route) {
    const L = SIM.line, a = TR.L(L.words.slice());
    h += `<div class="sim-build"><p class="sim-lab">되짚기 한 줄 — 들은 차례대로 조각을 누르세요 <small>같은 자리의 조각은 바꿔 끼워져요 · Backspace 하나 지우기</small></p>
      ${SIM.chips.map(gr => row(TR.OCAT[gr.c].ko, `<div class="seg">${gr.ids.map(w => `<button type="button" data-sw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(TR.OW[w].t)}</span></button>`).join('')}</div>`)).join('')}
      <div class="sim-ans"><span class="who me">나</span>${L.words.length ? `<span lang="en" class="sim-line">${segHTML(a)}</span>` : '<span class="note">조각을 고르세요. 노선 · 방향 · 갈아타는 역 · 내릴 역을 들은 차례대로.</span>'}</div>
      <div class="tg-acts"><button type="button" class="btn" id="simLine"${L.words.length ? '' : ' disabled'}>되짚기 (Enter)</button><button type="button" class="btn ghost" id="simLineClear"${L.words.length ? '' : ' disabled'}>지우기</button><button type="button" class="btn ghost" id="simSkip">되짚지 않고 → Okay. Thanks.</button>${mic}</div></div>`;
  } else {
    h += `<p class="sim-lab">① 대답 틀 <small>1~${SIM.frames.length}</small></p><div class="chips" role="group" aria-label="대답 틀">${SIM.frames.map((f, k) => `<button type="button" class="chipf" data-sf="${f}" aria-pressed="${SIM.f === f}"><small>${k + 1}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}</div>`;
    const Fm = SIM.f ? TR.FRAME[SIM.f] : null;
    if (Fm && Fm.slot) h += `<p class="sim-lab">② 내 정보 넣기 <small>A~C</small></p><div class="chips" role="group" aria-label="칸에 넣을 정보">${SIM.slots[SIM.f].map((v, k) => `<button type="button" class="chips-s" data-sv="${esc(v)}" aria-pressed="${SIM.v === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(slotLabel(SIM.f, v))}</span></button>`).join('')}</div>`;
    h += `<div class="sim-ans"><span class="who me">나</span>${fa ? `<span lang="en" class="sim-line">${segHTML(fa)}</span>` : SIM.f ? `<span lang="en" class="sim-line">${chipT(SIM.f)}</span>` : '<span class="note">틀을 고르세요.</span>'}</div>`;
    h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${fa ? '' : ' disabled'}>대답하기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${SIM.f ? '' : ' disabled'}>지우기</button>${mic}</div>`;
  }
  if (SIM.heard) h += `<p class="note">들린 말: <span lang="en">${esc(SIM.heard)}</span></p>`;
  if (SIM.why) {
    const { j, model } = SIM.why, st = j.ok ? '통과' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸렸어요';
    h += `<div class="sim-why ${j.ok ? 'ok' : 'no'}"><p><b>${esc(st)}</b> ${esc(j.why)}</p>${j.ok ? '' : `<p>모범 대답 ${lpBtn(meSeq(model), '모범 대답 듣기')}<span lang="en">${segHTML(model)}</span> <small>${esc(TR.ko(model))}</small></p>`}${SIM.why.spoken ? '<p class="note">말로 한 대답은 낱말과 카드의 사실(들은 숫자 · 노선 · 역 이름)만 맞춰 봐요. 질문의 모양(yes · no만 했는지)은 보지만, 공손함과 발음은 판정하지 않아요.</p>' : ''}</div>`;
  }
  const metro = METRO_PLACES[q.place], known = metro && SIM.qs.indexOf('ro_say') < SIM.i;
  if (metro) h += mapFig(C, known);
  box.innerHTML = h;
  if (metro) drawSimMap(C, known);
  paintPlay($('sim'), SIM.mode);
}
// 상대 얼굴 (영상의 avatar와 같은 색): 매표소 직원(모자 · 목걸이 줄) · 영국 역무원(모자 · 넥타이) · 안내 데스크 직원(형광 조끼) · 지하철에서 만난 사람(목도리) · 안내방송(스피커)
const LOOKS = TRS.LOOK;
const staffSVG = kind => {
  const L = LOOKS[kind] || LOOKS.clerk;
  if (L.speaker) return `<svg class="sim-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#202A36"/><g transform="translate(12 12)" fill="none" stroke="#C9A7FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRS.ICON.pa.map(([d]) => `<path d="${d}"/>`).join('')}</g></svg>`;
  return `<svg class="sim-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#202A36"/><ellipse cx="24" cy="47" rx="19" ry="14" fill="${L.shirt}"/>`
    + (L.vest ? `<path d="M15 37l7-3v14h-9zM33 37l-7-3v14h9z" fill="${L.vest}"/><rect x="13.5" y="42" width="8" height="1.6" fill="#EEF1F4"/><rect x="26.5" y="42" width="8" height="1.6" fill="#EEF1F4"/>` : '')
    + (L.collar ? '<path d="M20 34l4 4.5 4-4.5z" fill="#EEF1F4"/>' : '')
    + (L.tie ? `<path d="M23 36.5h2l.8 7-1.8 2.2-1.8-2.2z" fill="${L.tie}"/>` : '')
    + (L.scarf ? `<rect x="17" y="32.5" width="14" height="4" rx="1.5" fill="${L.scarf}"/><rect x="26" y="34" width="3.4" height="9" rx="1.2" fill="${L.scarf}"/>` : '')
    + (L.lanyard ? `<path d="M20 33.5l3 8M28 33.5l-3 8" stroke="${L.lanyard}" stroke-width="1.6" fill="none"/><rect x="21.5" y="41" width="5" height="4" rx="1" fill="#F4F6F8"/>` : '')
    + (L.pack ? `<path d="M14 35l-1.5 12M34 35l1.5 12" stroke="${L.pack}" stroke-width="3" fill="none"/>` : '')
    + `<circle cx="24" cy="21" r="8.5" fill="${L.skin}"/><path d="M15.5 19a8.5 8.5 0 0 1 17 0z" fill="${L.hair}"/>`
    + (L.cap ? `<rect x="15" y="10.5" width="18" height="5" rx="1.5" fill="${L.cap}"/><ellipse cx="24" cy="15.6" rx="10.5" ry="2" fill="${L.cap}"/><rect x="22.3" y="11.4" width="3.4" height="2.4" fill="#FFC15E"/>` : '')
    + '<circle cx="21" cy="22" r="1" fill="#2B2420"/><circle cx="27" cy="22" r="1" fill="#2B2420"/></svg>';
};
function simKeep() { if (!$('sim').contains(document.activeElement) || !document.activeElement.isConnected) $('sim').focus({ preventScroll: true }); }
function simMic() {
  if (!SRC || SIM.done || !SIM.started) return;
  if (SIM.listening) { stopListening(); return; }
  listenOnce({
    onState(on) { SIM.listening = on; simBuild(); simKeep(); },
    onText(alts) { const q = simQ(), C = simC(), best = alts.find(t => TR.matchSpoken(t, q, C).ok) || alts[0]; simAnswer(null, best); simKeep(); },
    onFail(msg) { SIM.react = { en: '…', ko: msg, st: 'no' }; simBuild(); simKeep(); },
  });
}
function simLineSubmit() { const L = SIM.line; if (!L.words.length) return; simAnswer(TR.L(L.words.slice())); }
function simSayChips() {
  if (!SIM.f) return;
  const Fm = TR.FRAME[SIM.f]; if (Fm.slot && !SIM.v) return;
  const a = { f: SIM.f }; if (Fm.slot) a.v = SIM.v;
  simAnswer(a);
}
function simInit() {
  $('simNew').addEventListener('click', () => { simNew(); SIM.started = false; simBuild(); });
  $('sim').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.id === 'simGo') { SIM.started = true; stopSounds(); NARR.reset(); if (playing) pause(); simBuild(); simAsk(); simKeep(); return; }
    if (b.id === 'simAgain') { simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); return; }
    if (b.dataset.sf) { SIM.f = b.dataset.sf; SIM.v = null; simBuild(); simKeep(); return; }
    if (b.dataset.sv != null) { SIM.v = b.dataset.sv; simBuild(); simKeep(); return; }
    if (b.id === 'simSay') { simSayChips(); simKeep(); return; }
    if (b.id === 'simClear') { SIM.f = null; SIM.v = null; simBuild(); simKeep(); return; }
    if (b.id === 'simMic') { simMic(); return; }
    if (b.dataset.sw) { SIM.line.words = toggleWord(SIM.line.words, b.dataset.sw); simBuild(); simKeep(); return; }
    if (b.id === 'simLine') { simLineSubmit(); simKeep(); return; }
    if (b.id === 'simLineClear') { SIM.line = { words: [] }; simBuild(); simKeep(); return; }
    if (b.id === 'simSkip') { simAnswer({ f: 'ro_ok' }); simKeep(); return; }
    if (b.dataset.simline) { simAsk(null, false); return; }
    if (b.dataset.act === 'play') { if (SIM.mode === 'play' && TRV.busy()) TRV.stop(); else simAsk(null, false); return; }
    if (b.dataset.act === 'slowplay') { if (SIM.mode === 'slowplay' && TRV.busy()) TRV.stop(); else simAsk(null, true); return; }
    if (b.dataset.act === 'script') { SIM.script = !SIM.script; simBuild(); simKeep(); }
  });
  $('sim').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), onBtn = e.target.closest && e.target.closest('button');
    if (!SIM.started) { if (e.key === 'Enter' && !onBtn) { e.preventDefault(); $('simGo').click(); } return; }
    if (SIM.done) { if (k === 'N' || (e.key === 'Enter' && !onBtn)) { e.preventDefault(); $('simAgain').click(); } return; }
    const n = '1234'.indexOf(e.key), sv = 'ABC'.indexOf(k), q = simQ();
    if (q.intent === 'route') {
      if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simLineSubmit(); simKeep(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); SIM.line.words.pop(); simBuild(); simKeep(); return; }
    } else if (n >= 0 && n < SIM.frames.length) { e.preventDefault(); SIM.f = SIM.frames[n]; SIM.v = null; simBuild(); simKeep(); return; }
    else if (sv >= 0 && SIM.f && TR.FRAME[SIM.f].slot && SIM.slots[SIM.f][sv] != null) { e.preventDefault(); SIM.v = SIM.slots[SIM.f][sv]; simBuild(); simKeep(); return; }
    else if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simSayChips(); simKeep(); return; }
    else if (e.key === 'Backspace') { e.preventDefault(); SIM.f = null; SIM.v = null; simBuild(); simKeep(); return; }
    if (k === 'R' && TRV.supported) { e.preventDefault(); simAsk(null, false); }
    else if (k === 'S' && TRV.supported) { e.preventDefault(); simAsk(null, true); }
    else if (k === 'T' && TRV.supported) { e.preventDefault(); SIM.script = !SIM.script; simBuild(); simKeep(); }
    else if (k === 'M' && SRC) { e.preventDefault(); simMic(); }
    else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
  });
  simNew(); SIM.started = false; simBuild();
}
/* =========================================================
   11. 대중교통 표현 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 숫자는 15든 fifteen이든 같은 숫자로 맞춰요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = TR.PLACES.map(p => ({ p, rows: TR.SHADOW.map((s, i) => [s, i]).filter(([s]) => s.place === p.id) })).filter(g => g.rows.length);
  $('shList').innerHTML = groups.map(({ p, rows }) => `<section class="sh-grp"><h3>${PI(p.id)}${esc(p.ko)} <span lang="en">${esc(p.en)}</span></h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${TRV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-who ${s.who}">${s.who === 'me' ? '나' : esc(WHO[s.sp] || '직원')}</span><span class="sh-en" lang="en">${esc(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { const s = TR.SHADOW[i]; return [{ text: s.en, sp: s.sp }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = TR.SHADOW[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, TR.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.words.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.t)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}${/Oakbridge|Millbrook|Museum|Central|East Pier/.test(s.en) && r.hit < r.total ? ' (역 · 도시 이름은 음성 인식이 다르게 적기 쉬워요.)' : ''}</p>`);
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${TRV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
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
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (b) b.classList.remove('saying'); if (thenOrig && TRV.supported) speak(shSeq(i)); };
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
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', p: '#FFC15E', bad: '#FF8E8E', hover: '#6EC8FF', box: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
const qLetter = (g, x, y, k) => { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill(); g.font = qfont(12, 700); g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCDE'[k], x, y + 1); };
const markOf = (i, st) => st.done && i === st.answer ? QCOL.p : st.done && i === st.pick ? QCOL.bad : st.hover === i ? QCOL.hover : null;
// 질문의 모양 넷 (A~D)
function shapeFig(label) {
  const ids = ['yn', 'or', 'wh', 'note'], Wd = 600, H = 210, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: (x, y) => y > 8 && y < H - 4 ? Math.min(3, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      ids.forEach((sh, k) => {
        const x = k * cw + cw / 2, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, k * cw + 8, 10, cw - 16, H - 22, 12); g.fillStyle = st.hover === k ? QCOL.box : 'rgba(255,255,255,0.03)'; g.fill();
        if (on || wrong) { g.strokeStyle = on ? QCOL.p : QCOL.bad; g.lineWidth = 3; g.stroke(); }
        g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L4[k], x, 32);
        TRS.shapeMark(g, sh, x, 92, 34);
        g.font = qfont(14, 700); g.fillStyle = QCOL.text; g.fillText(TR.SHAPE[sh].ko, x, 150);
        g.font = qfont(12, 500); g.fillStyle = QCOL.muted; g.fillText(TR.SHAPE[sh].mark, x, 172);
      });
    } };
}
// 출발 안내판 (줄 넷 A~D) — 줄 위치는 TRS.departureBoard와 같은 셈
function boardFig(label) {
  const Wd = 600, bw = 380, bx = (Wd - bw) / 2 + 12, by = 12, rh = 40, H = by + 58 + TRS.BOARD.length * rh + 12 + 14;
  const box = i => ({ x: bx + 6, y: by + 58 + i * rh + 3, w: bw - 12, h: rh - 6 });
  return { width: Wd, height: H, label,
    pick: (x, y) => TRS.BOARD.findIndex((_, i) => { const b = box(i); return x >= b.x - 30 && x <= b.x + b.w && y >= b.y - 3 && y <= b.y + b.h + 3; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      g.save(); TRS.departureBoard(g, bx, by, bw, {}); g.restore();
      TRS.BOARD.forEach((_, i) => {
        const b = box(i), c = markOf(i, st);
        if (c) { rrq(g, b.x, b.y, b.w, b.h, 6); g.strokeStyle = c; g.lineWidth = 2.6; g.stroke(); }
        qLetter(g, bx - 18, b.y + b.h / 2, i);
      });
    } };
}
// 노선도 (역 넷에 A~D). o: { here, pin, route }
function metroFig(label, ids, o = {}) {
  const Wd = 600, H = 470, B = { x: 14, y: 10, w: 572, h: 450, px: 62, py: 44 }, ts = 1.05;
  const P = id => TRS.mapAt(B, id), letters = {};
  ids.forEach((id, k) => { letters[id] = L4[k]; });
  return { width: Wd, height: H, label,
    pick: (x, y) => { let best = -1, bd = 34; ids.forEach((id, k) => { const [px, py] = P(id), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = k; } }); return best; },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      g.save(); TRS.metroMap(g, B, { ts, ls: 14, here: o.here, hereTag: false, pin: o.pin, route: o.route || null, keep: ids.concat([o.here, o.pin].filter(Boolean)), letters, terms: true, dim: o.route ? undefined : false }); g.restore();
      ids.forEach((id, k) => { const c = markOf(k, st); if (!c) return; const [x, y] = P(id); g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.strokeStyle = c; g.lineWidth = 3.2; g.stroke(); });
    } };
}
const QS = (() => {
  const o = TR.o, j = (q, a, c) => TR.judge(q, a, c || {}).ok;
  const dest = [o('ds_go', 'oakbridge'), o('g_yes'), o('ds_to', 'oakbridge'), o('ds_give', 'oakbridge')];
  const many = [o('pc_pl', 'a2'), o('pc_pl', 'a2c1'), o('pc_pl', 'alone'), o('g_yes')];
  const rail = [o('g_yes'), o('dc_have'), o('rp_rude'), o('rp_wrail')];
  const lines = [TR.LINE_DIR, TR.LINE_CHG, TR.LINE_DOWN, TR.LINE];
  const other = [o('ww_thx'), o('ww_bye'), o('ww_this'), o('sq_go')];
  const R0 = TR.route('parkroad', 'museum'), MB = TRS.BOARD[3];
  const q = [
    { q: '매표소 직원이 Hi there. Where are you traveling to today? 하고 물어요. 오크브리지(Oakbridge)까지 가요. 가장 알맞은 대답은?', opts: dest.map(TR.text), a: 2,
      why: 'Where → 어디까지 가는지 묻는 정보 질문 → 가는 곳 + please → To Oakbridge, please. (A) I go to …는 ‘평소에 다녀요’처럼 들리고, (B) Yes.로는 답이 안 되고, (D) Give me …는 명령처럼 들려요.',
      check: () => dest.map(a => j('ct_where', a, { dest: 'oakbridge' })).join() === 'false,false,true,false' },
    { q: '영국 역무원이 묻는 말: Single or return? 이 질문의 모양은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: shapeFig('질문의 모양 넷. A Yes/No 질문(스위치), B 고르는 질문(갈림길), C 정보 질문(빈 상자), D 안내(말풍선)'),
      why: 'A or B? → 둘 가운데 하나를 고르라는 고르는 질문(갈림길)이에요. 고른 것 + please → A return, please. Yes, please.로는 무엇을 골랐는지 알 수 없어요.',
      check: () => TR.Q.tk_type.shape === 'or' && !j('tk_type', o('g_yesp'), { type: 'return' }) && j('tk_type', o('tt_pl', 'return'), { type: 'return' }) },
    { q: 'And how many people are traveling? — 어른 두 명과 어린이 한 명이 함께 가요. 가장 알맞은 대답은?', opts: many.map(TR.text), a: 1,
      why: '몇 명인지 묻는 정보 질문 → 어른과 어린이를 나눠 말해요 → Two adults and one child, please. 어린이 표는 값이 달라서 나눠 말해야 해요(이 튜토리얼에서는 반값, 지어낸 규칙). (A)는 어린이가 빠졌고, me alone은 ‘나 혼자 남았어’처럼 쓸쓸하게 들리고, Yes.로는 답이 안 돼요.',
      check: () => many.map(a => j('tk_many', a, { party: 'a2c1' })).join() === 'false,true,false,false' },
    { q: '밀브룩(Millbrook)에 가요. 출발 안내판에서 탈 열차의 줄은? 그림 속 줄을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: boardFig('출발 안내판. A 10:15 OAKBRIDGE 4번, B 10:50 OAKBRIDGE 2번, C 11:13 ASHBY 7번, D 11:30 MILLBROOK 5번'),
      why: `TO 칸 → 가는 곳, TIME → 떠나는 시각, PLAT → 승강장. 밀브룩 → ${MB[0]} · ${MB[2]}번 승강장 → 읽기 ${TR.timeWords(MB[0])}. 직원에게 확인하려면 → So, platform ${MB[2]} at ${MB[0]}? (열차와 시각은 지어낸 것이에요.)`,
      check: () => MB[1] === 'MILLBROOK' && TRS.BOARD.filter(r => r[1] === 'MILLBROOK').length === 1 && j(TR.simQ('pl_info', { plat: MB[2], time: MB[0] }), o('pt_so', TR.ptVal(MB[2], MB[0])), {}) },
    { q: '직원이 값을 말하면서 뒤(TEEN)를 세게 말했어요 → “Okay, that\'s four-TEEN fifty, please.” 값은 얼마인가요?', opts: ['$40.50', '$4.50', '$14.50', '$14.15'], a: 2,
      why: 'fourteen(14)은 뒤(TEEN)를 세게, forty(40)는 앞(FOR)을 세게 말해요. fourteen fifty → $14.50. 값은 두 자리씩 끊어 읽어요(달러 · 센트). 헷갈리면 되물어요 → Sorry, did you say fourteen fifty?',
      check: () => TR.priceWords(1450) === 'fourteen fifty' && TR.moneyTrap(1450) === 4050 && TR.priceWords(4050) === 'forty fifty' },
    { q: '영국 매표소에서 Have you got a railcard? 하고 물어요. railcard가 무엇인지 몰라요(할인 카드는 없어요). 가장 알맞은 말은?', opts: rail.map(TR.text), a: 3,
      why: '모르는 낱말이 나오면 짐작해서 Yes.라고 하지 말고 물어요 → Sorry, what\'s a railcard? (railcard는 영국의 기차 할인 카드예요.) (A) Yes.는 카드가 있다는 말이 되고, (B) No, I don\'t have.는 have 뒤가 비어 문장이 끝나지 않고, (C) What? 한 낱말은 퉁명스럽게 들려요.',
      check: () => rail.map(a => j('fr_gb', a, { disc: false })).join() === 'false,false,false,true' },
    { q: 'Park Road 역에서 Museum 역에 가요. 갈아타는 역은? 노선도의 글자를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 0,
      figure: metroFig('노선도. 하늘색 점 Park Road(지금 있는 역), 노란 핀 Museum(가려는 역). A Central, B City Hall, C University, D Market', ['central', 'cityhall', 'university', 'market'], { here: 'parkroad', pin: 'museum' }),
      why: `Park Road → ${TR.LINES.green.ko}, Museum → ${TR.LINES.blue.ko}. 두 노선이 만나는 흰 동그라미 → Central. 직원 → change at Central. 직원은 갈아타기가 가장 적은 길을 알려 줘요(길은 규칙 엔진이 계산해요).`,
      check: () => R0.transfers === 1 && R0.legs[1].from === 'central' },
    { q: '직원 → Take the Green Line towards East Pier and change at Central. Then take the Blue Line towards South Bay and get off at Museum. 들은 길을 되짚는 말로 가장 알맞은 것은?', opts: lines.map(TR.lineText), a: 3,
      why: 'So, I + 들은 조각을 차례대로 → (D). (A) towards Westfield → 초록 노선의 반대쪽 끝 역이라 거꾸로 가는 열차예요. (B) change at City Hall → 갈아타는 역이 달라요. (C) get down → ‘몸을 숙이다 · 내려오다’로 들려요. 열차에서 내리다 → get off.',
      check: () => lines.map(L => j('ro_say', TR.L(L.words), {})).join() === 'false,false,false,true' },
    { q: 'Park Road 역에서 초록 노선(Green Line)을 타고 Central · City Hall 쪽(동쪽)으로 가요. 직원은 방향을 어떻게 말할까요? towards 뒤에 올 역을 노선도에서 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: metroFig('노선도. 하늘색 점 Park Road. A Westfield, B East Pier, C City Hall, D Harbor', ['westfield', 'eastpier', 'cityhall', 'harbor'], { here: 'parkroad' }),
      why: '방향은 그 노선의 끝 역(종점) 이름으로 말해요. 초록 노선의 동쪽 끝 → East Pier → towards East Pier. Westfield는 반대쪽 끝이라 거꾸로 가고, City Hall · Harbor는 가는 길에 있는 역이에요.',
      check: () => TR.towards('green', 'parkroad', 'cityhall') === 'eastpier' && TR.otherEnd('green', 'eastpier') === 'westfield' },
    { q: 'Excuse me, does this train go to Museum? 하고 물었더니 → No, this one goes to North Gate. You need the train on the other side. 가장 알맞은 대답은?', opts: other.map(TR.text), a: 0,
      why: '들은 것을 짧게 되짚고 고맙다고 해요 → Oh, the other side. Thank you! (B) Okay. Bye.는 고맙다는 말 없이 끊겨 무뚝뚝하고, (C) this side는 들은 것(반대쪽)과 달라요. (D)는 옆자리에 대한 대답이에요.',
      check: () => other.map(a => j('tb_no', a, {})).join() === 'true,false,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[대중교통] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { if (x.a < 4) pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[대중교통] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { TRV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = TRS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * TRS.W, (e.clientY - r.top) / r.height * TRS.H]; };
const hitAt = (x, y) => started ? TRS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.stop != null) { S.stop = S.stop === h.stop ? null : h.stop; relab(); }
  else if (h && h.play && TRV.supported) speak(h.play);
  else if (h && h.say && TRV.hasClip('tc', h.say)) speak([{ text: h.say, sp: 'tc' }]);   // 미리 만든 발음(음성 해설의 영어와 같은 목소리)
  else if (h && h.say && EN.say.supported) { stopSounds(); if (playing) pause(); EN.say(TR.spoken(h.say)); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.stop != null ? '눌러서 이곳의 말 보기' : h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { TRV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = TRV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 대화 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 글이 정해진 말만 모아요: 영상의 말풍선 · 발음 칩, 질문(TR.Q), 직접 해 보기의 처음 화면(곳 · 3단계 · 표 · 승강장 · 되짚을 길 · 열차 안은 하나씩 골라 봄),
// 듣고 대답 고르기, 따라 말하기. 대중교통 시뮬레이터(카드마다 바뀌는 말)와 내가 칩으로 만든 문장은 브라우저 음성이라 빼요.
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text || !/[A-Za-z]/.test(text) || /^\(.*\)$/.test(String(text).trim())) return;   // (지문)은 읽지 않음
    const id = TRV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: TRV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(TRS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 말풍선(그 사람) · 영어 칩(발음 듣기 tc). 곳(map) · 3단계(method) 장은 하나씩 골라 놓고 한 번 더
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return ch ? [ch.t, ch.t + ch.d] : null; };
    const sweeps = [[{}, [0, END]]].concat(TR.PLACES.map((_, k) => [{ stop: k }, span('map')]), TR.METHOD.map((_, k) => [{ place: k }, span('method')])).filter(x => x[1]);
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.25) {
        TRS.render(g, t);
        TRS.hits().forEach(h => { if (h.play) addSeq(h.play, 'video'); else if (h.say) add('tc', h.say, 'video-say'); });
      }
    });
    // 2) 직접 해 보기: 장마다 처음 화면 + 곳 · 3단계는 하나씩 골라서 (듣기 단추에 걸린 말)
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* 그리기만 하는 칸 */ } });
    TR.PLACES.forEach((_, k) => { S.stop = k; try { LABS.map(); } catch (e) { /* */ } });
    S.stop = null;
    TR.METHOD.forEach((_, k) => { S.place = k; try { LABS.method(); } catch (e) { /* */ } });
    S.place = null;
    const tryLab = (k, f) => { try { f(); LABS[k](); } catch (e) { /* */ } };
    ['gb', 'us'].forEach(country => ['single', 'return'].forEach(type => ['ok', 'goback', 'yes'].forEach(ans => ['a1', 'a2', 'a1c1', 'a2c1'].forEach(party => tryLab('ticket', () => { Object.assign(LAB.ticket, { country, type, ans, party }); })))));
    ['offpeak', 'anytime'].forEach(peak => ['window', 'aisle'].forEach(seat => tryLab('ticket', () => { Object.assign(LAB.ticket, { peak, seat }); })));
    TRS.BOARD.forEach((_, row) => { tryLab('plat', () => { LAB.plat = { row, v: null }; }); platChoices(platCard()).forEach(v => tryLab('plat', () => { LAB.plat.v = v; })); });
    LINE_TRIPS.forEach((_, trip) => { tryLab('route', () => { LAB.line = { trip, words: [], skip: true }; }); });
    Object.keys(TRAIN_SIT).forEach(sit => [true, false].forEach(free => TRAIN_SIT[sit].frames.forEach(f => tryLab('train', () => { LAB.train = { sit, f, free }; }))));
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 듣고 대답 고르기 · 먼저 골라 보기: 상대의 말 + 보기 넷
  TR.DRILL.concat(Object.values(TR.MINI)).forEach(it => { const Q = it.Q || TR.Q[it.q]; if (Q) addSeq(staffSeq(Q), 'drill'); it.opts.forEach(op => add('me', TR.text(op), 'drill')); });
  // 4) 따라 말하기
  TR.SHADOW.forEach((s0, i) => addSeq(shSeq(i), 'shadow'));
  // 5) 질문 목록의 나머지(상대의 말)
  Object.values(TR.Q).forEach(q => addSeq(staffSeq(q), 'q'));
  return out;
};
simInit();
shInit();
TDrill($('drillRoot'), TR.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 모양 잡기 → 틀 + 내 정보 → 공손하게, 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 02 · 07 · 09장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '기차역과 지하철의 일곱 곳, 고르는 질문과 되짚기가 모두 익숙해졌네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(TRS.baseText()).then(() => { dirty = true; });
setTimeout(() => TRS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();