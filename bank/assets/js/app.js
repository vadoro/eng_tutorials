/* 은행 · 환전 · 휴대폰 회화 — 플레이어, 직접 해 보기, 은행 · 휴대폰 시뮬레이터, 따라 말하기, 듣고 대답 고르기, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(BK), 그림은 scenes.js(BKS), 목소리는 voices.js(BKV)가 맡습니다.
 * 소리가 겹치지 않게: 대화를 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(BKV.play의 before).
 * 은행 · 가게 이름, 환율 · 요금 · 수수료, 주소 · 전화번호는 모두 지어낸 예시예요. 실제 서류와 절차는 은행 · 가게마다 달라요.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const BK = window.BK, BKS = window.BKS, BKV = window.BKV, S = BKS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = BKS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cv = $('cv'), ctx = cv.getContext('2d');
BK.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = BKS.fonts;
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
  const ready = new Promise(res => BKS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '은행 · 환전 · 휴대폰, 서류는 내밀고 숫자는 끊어 말한다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { BKS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: BKS.iconSVG('mic'),
};
const PI = id => BKS.iconSVG(id, 'pi');   // 곳 아이콘
const SHI = sh => `<span class="shp shp-${sh}">${BKS.iconSVG('shape_' + sh, 'pi')}${esc(BK.SHAPE[sh].ko)}</span>`;   // 질문의 모양 표시
// 듣기 · 천천히 · 대본 보기 단추 묶음 (공항 · 카페 · 호텔 · 식당 · 쇼핑과 같은 모양 · 같은 키 R · S · T)
const lsnBar = scriptOn => BKV.supported
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
  const cap = started ? BKS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 말풍선을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = BKS.chapterAt(T);
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
  if (dirty) { dirty = false; BKS.render(ctx, started ? T : POSTER); }
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
function stopSounds() { EN.say.stop(); BKV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return BKV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름
const lpBtn = (seq, label, cls = '') => BKV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
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
const meSeq = a => [{ text: typeof a === 'string' ? a : BK.text(a), sp: 'me' }];
// 말하는 사람 (목소리마다 한 사람): 환전 창구 직원 en-GB · 휴대폰 가게 직원 en-AU · 은행 창구 직원 en-US · 신청서 담당 직원 en-CA
const WHO = { gb: '환전 창구 직원 (영국)', au: '휴대폰 가게 직원 (호주)', us: '은행 직원', ca: '계좌 담당 직원' };
const whoOf = q => WHO[q.sp] || '직원';

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
const segHTML = (a, on = true) => BK.segs(a).map(s => on && s.t.trim() && /[A-Za-z0-9]/.test(s.t) ? `<mark class="mk-${s.r}">${esc(s.t)}</mark>` : esc(s.t)).join('');
const keyMarks = q => q.key.map(t => ({ t, role: 'key' }));

/* =========================================================
   6. 듣고 대답 고르기 (이 튜토리얼 전용, 대중교통 TDrill과 같은 모양) — 상대의 말은 소리 먼저, 대답 넷은 글
   생김새와 키보드는 공통 부품 EN.drill과 같게: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본 · Enter/→ 다음
   힌트 ①부터 질문의 모양 표시(스위치 · 갈림길 · 빈 상자 · 말풍선)가 상대의 말 옆에 나와요.
   ========================================================= */
function BDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null;
  const compact = !!cfg.compact, hear = BKV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && BKV.busy()) { BKV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(staffSeq(it.Q), { slow: !!slow, onitem() { paintNow(root, '.ldr-q'); say(`${whoOf(it.Q)} · ${it.Q.fast ? '빠르게 말하는 중' : '말하는 중'}`); },
      onend(stopped) { mode = null; paintPlay(root, null); paintNow(root, null); say(stopped ? '' : '다 들었어요. 대답을 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { BKV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; BKV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    BKV.stop();
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = BK.steps(it), place = BK.PLACE[it.place];
    const marks = []; steps.slice(0, done ? 3 : s.hints).reverse().forEach(x => marks.push(...x.marks));   // 뒤 단계의 색이 앞 단계를 덮음
    const reveal = done || !hear || s.script, mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur), showShape = (done || s.hints > 0) && !it.Q.fast;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${PI(it.place)}${esc(place.ko)}</span><span>${compact ? '듣고 대답 고르기' : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span>${done ? `<span class="edr-tag">${it.Q.fast ? '다시 묻기' : esc(BK.SHAPE[it.Q.shape].ko)}</span>` : ''}</p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(it.sit)}</p>`;
    h += lsnBar(done ? null : s.script);
    h += `<p class="ldr-q"><b>${esc(whoOf(it.Q))}</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="q" aria-label="상대의 말 다시 듣기" title="상대의 말 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.Q.en, mk('q'), reveal)}</span>${showShape ? SHI(it.Q.shape) : ''}${it.Q.fast && !done ? '<small class="adr-fast">아주 빠르게</small>' : ''}</p>`;
    h += `<p class="adr-ask">나의 대답은?</p><div class="ldr-opts" role="group" aria-label="대답 보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '', t = BK.text(op);
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-lp="${seqId(meSeq(t))}" aria-label="(${L4[k]}) 듣기" title="(${L4[k]}) 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(t, mk(k), true)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + BK.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = [[`${whoOf(it.Q)} · ${it.Q.en}`, it.Q.ko, staffSeq(it.Q)]].concat(it.opts.map((op, k) => [`(${L4[k]}) ${BK.text(op)}`, BK.ko(op), meSeq(op)]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      h += `<div class="edr-acts">${hear ? `<button type="button" class="edr-btn ghost adr-ex" data-lp="${seqId(staffSeq(it.Q).concat([{ text: BK.text(it.opts[it.a]), sp: 'me', gap: 0.5 }]))}">${ICO.play} 대화 듣기 (상대 → 나)</button>` : ''}${compact ? '' : `<button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button>`}</div>`;
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
const OT = BK.o, D = BK.DEMO;
const qLine = (q, extra = []) => `<p class="enline">${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span class="who">${esc(whoOf(q))}</span><span lang="en">${lineHTML(q.en, (q.fast ? [] : keyMarks(q)).concat(extra), true)}</span></p>`;
const meLine = (a, label = '듣기') => `<p class="enline">${lpBtn(meSeq(a), label)}<span class="who me">나</span><span lang="en">${segHTML(a)}</span></p>`;
const sayLine = (q, text, sp) => text ? `<p class="enline">${lpBtn([{ text, sp: sp || q.sp }], '상대의 대답 듣기')}<span class="who">${esc(whoOf(q))}</span><span lang="en">${esc(text)}</span></p>` : '';
const seeded = n => () => (n = (n * 16807) % 2147483647) / 2147483647;
// 상대의 반응: 맞으면 맞장구(BK.reply), 틀리면 걸린 단계의 반응(BK.REACT)
const reactEn = (q, j, a, C) => j.ok ? BK.reply(q, a, C) : (j.stage === 1 ? BK.REACT[1](q) : j.stage === 2 ? BK.REACT[2](q, j, a, C) : BK.REACT[3](q, j, a)).en;
// 주소 한 줄 조각 칩: 여는 말(It's) + 엔진의 조각 칩(맞는 조각 + 헷갈리기 쉬운 조각)
const lineChipsFor = C => [{ c: 'open', ids: ['its'] }].concat(BK.lineChips(C, seeded(11)));
// 같은 자리의 조각을 누르면 바꿔 끼우고, 같은 조각을 다시 누르면 빼요 (누른 차례가 말하는 차례)
const toggleWord = (words, w) => words.includes(w) ? words.filter(x => x !== w) : words.filter(x => BK.OW[x].c !== BK.OW[w].c).concat([w]);
const lineRows = (C, words, attr) => lineChipsFor(C).map(gr => row(BK.OCAT[gr.c].ko, `<div class="seg">${gr.ids.map(w => `<button type="button" data-${attr}="${w}" aria-pressed="${words.includes(w)}"><span lang="en">${esc(BK.OW[w].t)}</span></button>`).join('')}</div>`)).join('');
const wonSeg = (cur, attr) => seg('바꿀 돈', BK.WONS.map(v => [v, esc(BK.manKo(v))]), cur, attr);
// 05장 Yes/No 질문의 짝: 질문 · 사실 · 고를 대답
const AUX_SET = [
  { q: 'sm_unlock', card: { unlocked: true }, ko: '잠금 해제 (Is it …?)', fact: '휴대폰은 잠금 해제돼 있어요', a: [['ul_yes'], ['ul_am'], ['ul_no']] },
  { q: 'tl_student', card: { student: true }, ko: '학생인가 (Are you …?)', fact: 'Kellport University 교환학생이에요', a: [['su_yes'], ['su_do'], ['g_no']] },
  { q: 'id_second', card: {}, ko: '두 번째 신분증 (Do you …?)', fact: '학생증이 있어요', a: [['sc_yes', 'sid'], ['sc_have'], ['sc_am']] },
  { q: 'id_proof', card: { proof: false }, ko: '주소 증명 (Do you …?)', fact: '주소 증명 서류는 없고, 학교 확인서는 있어요', a: [['pf_ask'], ['pf_no'], ['pf_dorm']] },
  { q: 'cd_else', card: { ask: 'atm' }, ko: '더 도울 일 (Is there …?)', fact: '가장 가까운 ATM이 어디인지 알고 싶어요', a: [['el_atm'], ['el_where'], ['g_yes'], ['el_plain']] },
];
// 06장 서류: 질문마다 고를 대답
const DOC_Q = {
  id_pass: [['id_here', 'passport'], ['id_have'], ['g_no']],
  id_second: [['sc_yes', 'sid'], ['sc_have'], ['sc_am']],
  id_proof: [['pf_yes', 'lease'], ['pf_ask'], ['pf_no'], ['pf_dorm']],
};
const NEED_OPTS = [['nd_acct', '부탁 틀'], ['nd_book', '‘통장 만들기’를 그대로'], ['nd_make', '명령'], ['nd_half', '사실만']];
const LAB = {
  fx: { won: 300000, bills: 'small', how: 'won' },
  shape: { q: null, pick: null, yes: false },
  shop: { data: 'd15', stay: 'm6', dur: 'for' },
  num: { phone: '555-0147', a: null },
  acct: { need: 'nd_acct', type: 'checking' },
  aux: { k: 0, a: null },
  doc: { q: 'id_pass', proof: true, a: null },
  line: { room: 412, hall: 'maple', words: [] },
  card: { debit: true, pin: 'ok', ask: true },
};
const LAB0 = JSON.stringify(LAB);
const LABS = {
  intro: () => `${labHead('먼저 골라서 대답해 보세요')}${mini('intro')}
    <p class="note">상대의 말을 듣고 대답을 고르세요. 상대의 말은 답한 뒤에 글로 보여요. 막히면 힌트(H)로 3단계를 하나씩 열어 보세요.</p>`,
  map: () => {
    const i = S.stop, p = i != null ? BK.PLACES[i] : null;
    return `${labHead('곳을 골라 한두 마디 듣기')}
      ${seg('곳', BK.PLACES.map((x, k) => [k, `${PI(x.id)}${k + 1}. ${esc(x.ko)}`]), i == null ? '' : i, 'stop')}
      ${p ? `<ul class="qlist">${BK.PLACEQ[p.id].map(id => { const q = BK.Q[id]; return `<li>${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span><span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span><small>${SHI(q.shape)} ${esc(q.ko)}</small></span></li>`; }).join('')}</ul>
        ${BK.ME_FIRST[p.id] ? '<p class="note">이곳에서는 내가 먼저 말을 꺼내요. 상대가 How can I help you? 하고 물으면 용건을 부탁 틀로 말해요 → I\'d like to …, please.</p>' : ''}${clearBtn}` : '<p class="note">곳을 고르면 그곳에서 자주 듣는 말을 들을 수 있고, 영상 화면의 지도에도 표시돼요. 하늘색 → 열쇠 낱말. 보라색 테두리의 곳(환전 창구 · 휴대폰 가게 · 은행 창구)에서는 내가 먼저 용건을 말해요. 은행 이름 · 환율 · 요금 · 주소 · 전화번호는 모두 지어낸 예시예요. 실제 서류와 절차는 은행 · 가게마다 달라요.</p>'}`;
  },
  fx: () => {
    const r = LAB.fx, C = Object.assign({}, D, { won: r.won, bills: r.bills, usd: BK.fx(r.won) });
    const [t30, t300] = BK.wonTraps(r.won);
    const HOW = { won: OT('mc_won', r.won), man: OT('mc_man', r.won), k: OT('mc_won', t30), m: OT('mc_won', t300) };
    const a1 = HOW[r.how], j1 = BK.judge(BK.Q.fx_much, a1, C, '상황');
    const a2 = OT('bl_pl', r.bills), j2 = BK.judge(BK.Q.fx_bills, a2, C, '상황');
    const gq = BK.simQ('fx_get', C), a3 = OT('gt_so', C.usd), tr = BK.usdTrap(C.usd);
    return `${labHead('바꿀 금액 — 만은 thousand로')}
      ${row('바꿀 돈', wonSeg(r.won, 'fw'))}
      ${row('읽는 법', seg('읽는 법', [['won', '세 자리씩 끊어'], ['man', '만을 그대로 (man)'], ['k', `${esc(BK.manKo(t30))}으로 잘못`], ['m', `${esc(BK.manKo(t300))}으로 잘못`]], r.how, 'fh'))}
      ${qLine(BK.Q.fx_much)}${meLine(a1)}${verdictHTML(j1)}
      <p class="note">${esc(BK.wonKo(r.won))} → <span lang="en">${esc(BK.wonWords(r.won))}</span>. 만 = ten thousand라서, 한국어처럼 네 자리가 아니라 세 자리씩 끊어 읽어요(<span lang="en">${esc(BK.wonText(r.won))}</span>). 고른 금액은 영상 화면에도 그려져요.</p>
      ${row('지폐', seg('지폐', [['large', '큰 지폐 (50 · 100달러)'], ['small', '작은 지폐 (10 · 20달러)']], r.bills, 'fb'))}
      ${qLine(BK.Q.fx_bills)}${meLine(a2)}${verdictHTML(j2)}
      <h3 class="mt">받을 금액 되짚기</h3>
      ${qLine(gq, [{ t: BK.money(C.usd), role: 'slot' }])}${meLine(a3)}${sayLine(gq, BK.reply(gq, a3, C))}
      <p class="note">환율 → 1달러 = ${esc(BK.comma(BK.RATE))}원(지어낸 예시). ${esc(BK.wonText(r.won))} ÷ ${esc(BK.comma(BK.RATE))} = ${esc(BK.money(C.usd))} → <span lang="en">${esc(BK.priceWords(C.usd))}</span>. 잘못 듣기 쉬운 값 → <span lang="en">${esc(BK.money(tr))}</span> (${esc(BK.priceWords(tr))}). 큰 금액은 되짚어 확인해요.</p>
      <ul class="qlist">${BK.PAIRS.map(([n1, s1, n2, s2]) => `<li>${lpBtn([{ text: BK.numWord(+n1), sp: 'tc' }], '듣기: ' + BK.numWord(+n1))}<span><span lang="en">${esc(s1)}</span><small>${n1} · 뒤를 세게</small></span>${lpBtn([{ text: BK.numWord(+n2), sp: 'tc' }], '듣기: ' + BK.numWord(+n2))}<span><span lang="en">${esc(s2)}</span><small>${n2} · 앞을 세게</small></span></li>`).join('')}</ul>
      <h3 class="mt">금액 대답 골라 보기</h3>${mini('won')}${S.fx ? clearBtn : ''}`;
  },
  shop: () => {
    const r = LAB.shape, q = r.q ? BK.Q[r.q] : null;
    let res = '';
    if (q && r.pick) res = `<p class="verdict"><b class="${r.pick === q.shape ? 'c-ok' : 'c-no'}">${r.pick === q.shape ? '맞아요' : '다시 보세요'}</b>${esc(`${BK.SHAPE[q.shape].ko} → ${BK.sayOf(q.intent)}. 대답 → ${BK.SHAPE[q.shape].ans}.`)}</p>`;
    if (q && r.yes) { const j = BK.judge(q, { f: 'g_yesp' }, D, '상황'); res += `${meLine({ f: 'g_yesp' })}${verdictHTML(j)}`; }
    const s = LAB.shop, C = Object.assign({}, D, { data: s.data === 'free' ? 'unl' : s.data, stay: s.stay });
    const a1 = OT('dt_pl', s.data), j1 = BK.judge(BK.Q.sh_data, a1, C, '상황');
    const a2 = OT(s.dur === 'for' ? 'st_for' : 'st_dur', s.stay), j2 = BK.judge(BK.Q.sh_stay, a2, C, '상황');
    const amount = BK.planCost(C.plan, C.data), cq = BK.simQ('sh_cost', Object.assign({}, C, { amount }));
    return `${labHead('질문의 모양 맞히기 · 요금제')}
      <p class="note">상대의 말을 고르고, 모양을 맞혀 보세요. 그다음 <span lang="en">Yes, please.</span>로 대답하면 어떻게 되는지 규칙 엔진에 물어봐요.</p>
      ${seg('상대의 말', BK.SHAPE_QS.map(id => [id, `<span lang="en">${esc(BK.Q[id].short && /\?$|!$/.test(BK.Q[id].short) ? BK.Q[id].short : BK.Q[id].en)}</span>`]), r.q || '', 'sq')}
      ${q ? `<h3 class="mt">이 말의 모양은?</h3>${seg('모양', ['yn', 'or', 'wh', 'note'].map(sh => [sh, SHI(sh)]), r.pick || '', 'sp')}
        <div class="tg-acts mt8"><button type="button" class="btn ghost" id="shapeYes">Yes, please.로 대답해 보기</button>${lpBtn(staffSeq(q), '상대의 말 듣기')}</div>${res}` : ''}
      <h3 class="mt">데이터 · 머무는 기간</h3>
      ${row('데이터', seg('데이터', [['d15', '한 달 15GB'], ['d50', '한 달 50GB'], ['unl', '무제한 (Unlimited data)'], ['free', '무제한 → data free']], s.data, 'sd'))}
      ${qLine(BK.Q.sh_data)}${meLine(a1)}${verdictHTML(j1)}
      ${row('머무는 기간', seg('머무는 기간', Object.keys(BK.MONTHS_STAY).map(k => [k, esc(BK.MONTHS_STAY[k].ko)]), s.stay, 'ss'))}
      ${row('‘동안’', seg('동안', [['for', 'For + 센 기간'], ['during', 'During + 센 기간']], s.dur, 'su'))}
      ${qLine(BK.Q.sh_stay)}${meLine(a2)}${verdictHTML(j2)}
      <p class="note">숫자로 센 기간(six months) 앞에는 for → <span lang="en">For six months.</span> during은 ‘그때’를 가리키는 말 앞에 써요 → <span lang="en">during my stay</span>.</p>
      <h3 class="mt">값 듣기 — thirteen이냐 thirty냐</h3>
      ${qLine(cq, [{ t: BK.money(amount), role: 'slot' }])}
      <p class="note">읽기 → <span lang="en">${esc(BK.priceWords(amount))}</span> · ${esc(BK.priceKo(amount))}. 헷갈리기 쉬운 값 → <span lang="en">${esc(BK.money(BK.moneyTrap(amount)))}</span> (${esc(BK.priceWords(BK.moneyTrap(amount)))}). 카드로 낼 때 → <span lang="en">Can I pay by card?</span> 요금은 지어낸 예시예요.</p>${S.shape ? clearBtn : ''}`;
  },
  sim: () => {
    const r = LAB.num, C = Object.assign({}, D, { phone: r.phone }), q = BK.simQ('sm_num', C);
    const OPTS = [['so', OT('nb_so', r.phone)], ['swap', OT('nb_so', BK.phoneTrap(r.phone))], ['big', OT('nb_big', r.phone)], ['ok', OT('nb_ok')]];
    let res = '';
    if (r.a) { const a = OPTS.find(o => o[0] === r.a)[1], j = BK.judge(q, a, C, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(q, reactEn(q, j, a, C))}`; }
    return `${labHead('새 번호 듣고 되짚기')}
      ${row('새 번호', seg('새 번호', BK.PHONES.map(p => [p, esc(p)]), r.phone, 'np'))}
      ${qLine(q, [{ t: r.phone, role: 'slot' }])}
      <p class="note">읽기 → <span lang="en">${esc(BK.digits(r.phone))}</span>. 번호는 묶음(${esc(r.phone.split('-').join(' · '))})으로 끊어 한 자리씩, 0은 oh로 읽어요. 큰 수처럼 읽으면 → <span lang="en">${esc(BK.bigRead(r.phone))}</span> (알아듣기 어려워요).</p>
      ${seg('대답', OPTS.map(([k, a]) => [k, `<span lang="en">${esc(BK.text(a))}</span>`]), r.a || '', 'na')}
      ${res}
      <p class="note">끝 두 자리를 바꿔 되짚으면 직원이 바로잡아 줘요. 그래서 되짚기가 힘이 돼요. 고른 번호는 영상 화면에도 그려져요.</p>
      <h3 class="mt">Is it …? → Yes, it is.</h3>${qLine(BK.Q.sm_unlock)}${meLine(OT('ul_yes'))}
      <h3 class="mt">모르는 낱말은 물어요</h3>${qLine(BK.Q.sm_top)}${meLine(OT('rp_wtop'))}${sayLine(BK.Q.sm_top, repairLine('what', BK.Q.sm_top, {}))}${meLine(OT('tu_no'))}
      <p class="note">top up → 선불 요금을 채워 넣다(충전). <span lang="en">charge my phone</span>은 배터리를 충전한다는 말이에요.</p>${S.num ? clearBtn : ''}`;
  },
  teller: () => {
    const r = LAB.acct, C = Object.assign({}, D, { acct: r.type === 'book' ? 'checking' : r.type });
    const a1 = OT(r.need), j1 = BK.judge(BK.Q.tl_help, a1, C, '상황');
    const a2 = OT('ty_pl', r.type), j2 = BK.judge(BK.Q.tl_type, a2, C, '상황');
    const X = AUX_SET[LAB.aux.k], aq = BK.Q[X.q], XC = Object.assign({}, D, X.card);
    let ares = '';
    if (LAB.aux.a != null) { const [f, v] = X.a[LAB.aux.a], a = OT(f, v), j = BK.judge(aq, a, XC, '상황'); ares = `${meLine(a)}${verdictHTML(j)}`; }
    return `${labHead('용건 · 통장 고르기 · Yes/No의 짝')}
      ${row('말하는 방법', seg('말하는 방법', NEED_OPTS, r.need, 'tn'))}
      ${qLine(BK.Q.tl_help)}${meLine(a1)}${verdictHTML(j1)}
      ${row('통장', seg('통장', [['checking', '입출금 (checking)'], ['savings', '저축 (savings)'], ['book', '‘통장’을 bankbook으로']], r.type, 'tt'))}
      ${qLine(BK.Q.tl_type)}${meLine(a2)}${verdictHTML(j2)}
      <p class="note">통장을 만들다 → <span lang="en">open a bank account</span>. 월세 · 생활비를 넣고 빼는 통장은 <span lang="en">a checking account</span>, 모아 두는 통장은 <span lang="en">a savings account</span>예요.</p>
      <h3 class="mt">Yes/No 질문은 첫 낱말로 짝 맞추기</h3>
      ${row('질문', seg('질문', AUX_SET.map((x, k) => [k, esc(x.ko)]), LAB.aux.k, 'xk'))}
      ${qLine(aq)}<p class="note"><span lang="en">${esc(BK.AUX[aq.aux].q)}</span> → <span lang="en">${esc(BK.AUX[aq.aux].a)}</span> · 사실: ${esc(X.fact)}</p>
      ${seg('대답', X.a.map(([f, v], k) => [k, `<span lang="en">${esc(BK.text(OT(f, v)))}</span>`]), LAB.aux.a == null ? '' : LAB.aux.a, 'xa')}
      ${ares}${S.aux ? clearBtn : ''}`;
  },
  id: () => {
    const r = LAB.doc, C = Object.assign({}, D, { proof: r.proof }), q = BK.Q[r.q], opts = DOC_Q[r.q];
    let res = '';
    if (r.a != null) { const [f, v] = opts[r.a], a = OT(f, v), j = BK.judge(q, a, C, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(q, reactEn(q, j, a, C))}`; }
    return `${labHead('서류 — 내밀면서 Here\'s …')}
      ${row('질문', seg('질문', [['id_pass', '여권'], ['id_second', '두 번째 신분증'], ['id_proof', '주소 증명']], r.q, 'dq'))}
      ${row('주소 증명 서류', seg('주소 증명', [['1', '있어요 (기숙사 계약서)'], ['0', '없어요 (학교 확인서는 있어요)']], r.proof ? '1' : '0', 'dp'))}
      ${qLine(q)}
      ${seg('대답', opts.map(([f, v], k) => [k, `<span lang="en">${esc(BK.text(OT(f, v)))}</span>`]), r.a == null ? '' : r.a, 'da')}
      ${res}
      <p class="note">서류를 달라는 말에는 있다고만 하지 말고 내밀면서 → <span lang="en">Here's my …</span>. 주소 증명 서류가 없으면 사실(<span lang="en">No, I don't.</span>)에 부탁을 붙여요 → <span lang="en">Would a letter from my university work?</span> 실제로 받아 주는 서류는 은행마다 달라요. 고른 대답은 영상 화면에도 보여요.</p>
      <ul class="qlist">${Object.keys(BK.DOCS).map(k => `<li>${lpBtn([{ text: `Here's ${BK.DOCS[k].t}.`, sp: 'me' }], '듣기')}<span><span lang="en">Here's ${esc(BK.DOCS[k].t)}.</span><small>${esc(BK.DOCS[k].ko)}</small></span></li>`).join('')}</ul>${S.doc ? clearBtn : ''}`;
  },
  form: () => {
    const r = LAB.line, C = Object.assign({}, D, { addr: { room: r.room, hall: r.hall } }), a = BK.L(r.words.slice());
    let res = '';
    if (r.words.length) { const j = BK.judge(BK.Q.fm_addr, a, C, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(BK.Q.fm_addr, BK.fixLine(a.line, C).en)}`; }
    return `${labHead('주소 한 줄 — 작은 곳에서 큰 곳으로')}
      ${row('방 번호', seg('방 번호', BK.ROOMS.map(n => [n, `${n}호`]), r.room, 'lr'))}
      ${row('기숙사', seg('기숙사', BK.HALL_IDS.map(h => [h, esc(BK.HALLS[h].ko)]), r.hall, 'lh'))}
      <p class="note">내 주소(한국식으로 적어 둠) → ${esc(BK.addrKo(C.addr))}</p>
      ${qLine(BK.Q.fm_addr)}
      <p class="note">조각을 누르는 차례대로 문장이 돼요. 일부러 길 이름 뒤에 번지를 붙인 조각을 고르거나, 방 번호를 바꾸거나, 조각 하나를 빼 보세요.</p>
      ${lineRows(C, r.words, 'lw')}${res}
      <div class="tg-acts mt8"><button class="btn ghost" type="button" id="lineClear">처음부터</button>${S.line ? clearBtn : ''}</div>
      <p class="note">차례(It's → 방 번호 → 건물 → 번지 + 길 → 도시 + 우편번호)는 미국식 주소를 단순하게 줄인 규칙이에요. 틀린 조각이 있으면 직원은 그 조각만 다시 물어요(<code>BK.fixLine</code>). 방 번호는 <span lang="en">${esc(BK.roomWords(r.room))}</span>, 우편번호는 <span lang="en">${esc(BK.digits(BK.ZIP))}</span>처럼 읽어요. 주소는 지어낸 예시예요.</p>
      <h3 class="mt">전화번호 대답 골라 보기</h3>${mini('phone')}
      <h3 class="mt">서명</h3>${qLine(BK.Q.fm_sign)}${meLine(OT('sg_ok'))}
      <p class="note">서명 → <span lang="en">signature</span>(sign은 ‘표지판’, 또는 ‘서명하다’라는 동사). <span lang="en">I'll do my sign.</span>은 어색해요.</p>`;
  },
  card: () => {
    const r = LAB.card, C = Object.assign({}, D, { debit: r.debit, ask: r.ask ? 'atm' : null });
    const a1 = OT(r.debit ? 'g_yesp' : 'g_no'), j1 = BK.judge(BK.Q.cd_debit, a1, C, '상황');
    const a2 = r.pin === 'say' ? OT('pn_say', D.pin) : OT('pn_ok'), j2 = BK.judge(BK.Q.cd_pin, a2, C, '상황');
    const a3 = OT(r.ask ? 'el_atm' : 'el_no'), j3 = BK.judge(BK.Q.cd_else, a3, C, '상황');
    return `${labHead('직불 카드 · 비밀번호 · 마무리')}
      ${row('직불 카드', seg('직불 카드', [['1', '필요해요'], ['0', '필요 없어요']], r.debit ? '1' : '0', 'cb'))}
      ${qLine(BK.Q.cd_debit)}${meLine(a1)}${verdictHTML(j1)}
      <p class="note">체크카드 → <span lang="en">a debit card</span>. <span lang="en">check card</span>는 영어로는 잘 통하지 않는 말이에요.</p>
      ${row('비밀번호', seg('비밀번호', [['ok', '숫자판에 누르기만'], ['say', '소리 내어 말하기']], r.pin, 'cp'))}
      ${qLine(BK.Q.cd_pin)}${meLine(a2)}${verdictHTML(j2)}${r.pin === 'say' ? sayLine(BK.Q.cd_pin, BK.BAD_REACT.pn_say[0]) : ''}
      ${row('물어볼 것', seg('물어볼 것', [['1', '가장 가까운 ATM'], ['0', '없어요']], r.ask ? '1' : '0', 'ca'))}
      ${qLine(BK.Q.cd_else)}${meLine(a3)}${verdictHTML(j3)}${sayLine(BK.Q.cd_else, BK.reply(BK.Q.cd_else, a3, C))}
      <p class="note">물어볼 것이 있으면 Yes 뒤에 바로 질문으로 → <span lang="en">Could you tell me where the nearest ATM is?</span> 짧은 <span lang="en">Where is ATM?</span>은 툭 던지는 말로 들려요. 고른 것은 영상 화면에도 보여요.</p>${S.card ? clearBtn : ''}`;
  },
  method: () => {
    const i = S.place, rw = i != null ? BK.METHOD[i] : null;
    return `${labHead('곳마다 3단계 적용해 보기')}
      ${seg('곳', BK.METHOD.map(([qid], k) => [k, `${PI(BK.Q[qid].place)}${esc(BK.PLACE[BK.Q[qid].place].ko)}`]), i == null ? '' : i, 'place')}
      ${rw ? (() => { const [qid, a, c] = rw, q = BK.Q[qid], j = BK.judge(q, a, Object.assign({}, D, c || {})); return `<p class="enline">${lpBtn(staffSeq(q), '듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
        <ol class="edr-steps"><li><b>① 열쇠 낱말 + 모양</b> ${esc(q.key.join(' … '))} → ${SHI(q.shape)} ${esc(BK.sayOf(q.intent))}</li><li><b>② 틀 + 내 정보</b> <span lang="en">${segHTML(a)}</span> ${esc(BK.ko(a))}</li><li><b>③ 공손하게</b> ${esc(j.why)}</li></ol>
        <p class="enline">${lpBtn(staffSeq(q).concat([{ text: BK.text(a), sp: 'me', gap: 0.5 }]), '대화 듣기')}<span>대화 듣기</span></p>
        ${clearBtn}`; })() : '<p class="note">곳을 고르면 영상 화면의 그 줄이 켜지고, 세 단계를 글로 보여 줘요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>대화 골라 보기</h3>
    <div class="seg">${BKS.PSEG.map((t, i) => `<button type="button" data-seek="${t + 0.4}">대화 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 해 보고 싶다면 아래 <a href="#playground">은행 · 휴대폰 시뮬레이터</a>에서 내 카드로 환전 창구부터 은행 카드까지 해 보세요. 카드는 누를 때마다 새로 만들어져요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">은행 · 휴대폰 시뮬레이터</a> — 내 카드로 환전 · 휴대폰 개통 · 계좌 열기(주소 한 줄도)</li><li><a href="#shadow">은행 · 휴대폰 표현 따라 말하기</a> — ${BK.SHADOW.length}문장 듣고 따라 하기</li>
    <li><a href="#drill">듣고 대답 고르기</a> — 일곱 곳 ${BK.DRILL.length}문제, 3단계 힌트</li><li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.querySelectorAll('.lmini').forEach(m => BDrill(m, [BK.MINI[m.dataset.mini]], { compact: true, onAnswer() { if (playing) pause(); } }));
}
function showAt(u) { const ch = CHAPTERS[BKS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const relab = () => { touch(); buildLab(BKS.chapterAt(T)); };
// 직접 해 보기 상태 → 영상 화면 상태
const syncFx = () => { S.fx = { won: LAB.fx.won, bills: LAB.fx.bills }; };
const syncShape = () => { S.shape = LAB.shape.q || null; };
const syncNum = () => { S.num = { phone: LAB.num.phone, a: LAB.num.a }; };
const syncAux = () => { const X = AUX_SET[LAB.aux.k], A = LAB.aux.a != null ? X.a[LAB.aux.a] : null; S.aux = A ? { q: X.q, a: A[0], v: A[1], card: X.card } : null; };
const syncDoc = () => { const r = LAB.doc, A = r.a != null ? DOC_Q[r.q][r.a] : null; S.doc = A ? { q: r.q, a: OT(A[0], A[1]), proof: r.proof } : null; };
const syncLine = () => { const r = LAB.line; S.line = { room: r.room, hall: r.hall, words: r.words.slice() }; };
const syncCard = () => { S.card = Object.assign({}, LAB.card); };
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  const d = b.dataset;
  if (d.seek) { seek(CHAPTERS[BKS.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') {
    ['stop', 'place', 'fx', 'shape', 'num', 'aux', 'doc', 'line', 'card'].forEach(k => { S[k] = null; });
    Object.assign(LAB, JSON.parse(LAB0));
    relab(); return;
  }
  if (d.stop != null) { S.stop = d.stop === '' ? null : +d.stop; showAt(18.8); relab(); return; }
  // 02장 환전 창구
  if (d.fw) { LAB.fx.won = +d.fw; syncFx(); relab(); return; }
  if (d.fh) { LAB.fx.how = d.fh; syncFx(); relab(); return; }
  if (d.fb) { LAB.fx.bills = d.fb; syncFx(); relab(); return; }
  // 03장 질문의 모양 · 요금제 (데이터 · 기간은 영상 화면을 바꾸지 않아요)
  if (d.sq) { LAB.shape = { q: d.sq, pick: null, yes: false }; syncShape(); relab(); return; }
  if (d.sp) { LAB.shape.pick = d.sp; syncShape(); relab(); return; }
  if (b.id === 'shapeYes') { LAB.shape.yes = true; syncShape(); relab(); return; }
  if (d.sd) { LAB.shop.data = d.sd; relab(); return; }
  if (d.ss) { LAB.shop.stay = d.ss; relab(); return; }
  if (d.su) { LAB.shop.dur = d.su; relab(); return; }
  // 04장 새 번호 되짚기
  if (d.np) { LAB.num = { phone: d.np, a: LAB.num.a }; syncNum(); relab(); return; }
  if (d.na) { LAB.num.a = d.na; syncNum(); relab(); return; }
  // 05장 은행 창구 · Yes/No의 짝
  if (d.tn) { LAB.acct.need = d.tn; relab(); return; }
  if (d.tt) { LAB.acct.type = d.tt; relab(); return; }
  if (d.xk != null) { LAB.aux = { k: +d.xk, a: null }; syncAux(); relab(); return; }
  if (d.xa != null) { LAB.aux.a = +d.xa; syncAux(); relab(); return; }
  // 06장 서류
  if (d.dq) { LAB.doc.q = d.dq; LAB.doc.a = null; syncDoc(); relab(); return; }
  if (d.dp != null) { LAB.doc.proof = d.dp === '1'; syncDoc(); relab(); return; }
  if (d.da != null) { LAB.doc.a = +d.da; syncDoc(); relab(); return; }
  // 07장 주소 한 줄
  if (d.lr) { LAB.line = { room: +d.lr, hall: LAB.line.hall, words: [] }; syncLine(); relab(); return; }
  if (d.lh) { LAB.line = { room: LAB.line.room, hall: d.lh, words: [] }; syncLine(); relab(); return; }
  if (d.lw) { LAB.line.words = toggleWord(LAB.line.words, d.lw); syncLine(); relab(); return; }
  if (b.id === 'lineClear') { LAB.line.words = []; syncLine(); relab(); return; }
  // 08장 카드
  if (d.cb != null) { LAB.card.debit = d.cb === '1'; syncCard(); relab(); return; }
  if (d.cp) { LAB.card.pin = d.cp; syncCard(); relab(); return; }
  if (d.ca != null) { LAB.card.ask = d.ca === '1'; syncCard(); relab(); return; }
  if (d.place != null) { S.place = d.place === '' ? null : +d.place; showAt(3.8); relab(); }
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   영어 속 금액 · 원 · 번호 · 방 번호 · 우편번호 · 데이터는 영어 낱말로($240 → two hundred forty dollars, 555-0147 → five-five-five, oh-one-four-seven)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})+ won\b|\b\d{3}-\d{4}\b|\bRoom \d+|\b\d+ College Avenue\b|\b\d{5}\b|\b\d+ GB\b/g, m => BK.spoken(m)],
    [/\b\d(?:-\d){3}\b/g, m => m.split('-').map(d => BK.numWord(+d)).join(' ')],   // 비밀번호 7-3-9-1 → seven three nine one
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
   10. 놀이터 — 은행 · 휴대폰 시뮬레이터
   환전 창구(내가 먼저 용건) → 금액 · 지폐 · 받을 금액 되짚기 → 휴대폰 가게(용건 · 요금제 · 데이터 · 기간 · 값) → 유심 · 새 번호 되짚기
   → (다음 날) 은행 창구 → 서류 → 주소 한 줄 · 전화번호 · 서명 → 카드 · 비밀번호 · 마무리.
   받을 달러 · 요금 · 새 번호는 내 카드에 없어요 — 상대가 말한 것을 듣고 써야 해요. 주소는 조각 칩으로 한 줄을 만들어요(BK.lineChips → BK.checkLine).
   ========================================================= */
const SIM = { card: null, qs: [], i: 0, frames: [], slots: {}, f: null, v: null, log: [], started: false, script: !BKV.supported, mode: null, react: null, why: null, done: false, listening: false, heard: null, covered: new Set(), skipped: [], line: { words: [] }, chips: [] };
const simQ = () => BK.simQ(SIM.qs[SIM.i], SIM.card);
const simC = () => Object.assign({}, SIM.card, simQ().fact || {});
window.__simCard = () => Object.assign({}, SIM.card);   // 확인용(읽기만): 지금 내 카드
window.__simQ = () => Object.assign({}, simQ());          // 확인용(읽기만): 지금 상대의 말
const keyOf = q => `${q.place}:${q.intent}`;
const skipLabel = ids => ids.map(id => BK.INTENT_KO[BK.Q[id].intent]).filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
const isCovered = q => SIM.covered.has(keyOf(q)) || SIM.covered.has('*:' + q.intent);
const LINE_INTENT = 'addr';
const PLACE_INTRO = {
  shop: () => '같은 날, 휴대폰 가게에 왔어요. 여기서도 내가 먼저 용건을 말해요.',
  sim: () => '직원이 유심을 넣고 새 번호를 알려 줘요. 번호는 카드에 없어요 — 듣고 되짚어요. 은행 서류에 써야 해요.',
  teller: () => '다음 날, 은행에 왔어요. 용건을 부탁 틀로 말해요.',
  id: () => '직원이 서류를 보여 달라고 해요. 있다고만 하지 말고 내밀면서 말해요.',
  form: () => '신청서를 채워요. 주소는 작은 곳에서 큰 곳으로, 전화번호는 휴대폰 가게에서 들은 번호예요.',
  card: c => c.debit ? '마지막으로 직불 카드를 만들어요. 비밀번호는 말하지 않고 숫자판에 눌러요.' : '마지막으로 직원이 직불 카드를 권해요. 내 카드에는 필요 없다고 적혀 있어요 — 짧게 거절해요.',
};
function simNew() {
  BKV.stop(); stopListening();
  SIM.card = BK.newCard(); SIM.qs = BK.simQs(SIM.card); SIM.i = 0; SIM.log = []; SIM.done = false; SIM.react = null; SIM.why = null; SIM.heard = null;
  SIM.covered = new Set(); SIM.skipped = [];
  simPrep(); simBuild();
}
function simPrep() {
  const q = simQ(), C = simC();
  SIM.slots = {}; SIM.f = null; SIM.v = null; SIM.line = { words: [] }; SIM.chips = [];
  if (q.intent === LINE_INTENT) { SIM.frames = []; SIM.chips = [{ c: 'open', ids: ['its'] }].concat(BK.lineChips(C)); }
  else {
    SIM.frames = shuffle(BK.simFrames(q.intent, C) || []);
    SIM.frames.forEach(f => { const Fm = BK.FRAME[f]; if (Fm.slot) SIM.slots[f] = BK.slotChoices(Fm.slot, C, Math.random, q); });
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
// 다시 묻기에 상대가 하는 대답: 모르는 낱말 풀이 · 들은 숫자 확인, 그 밖에는 천천히 한 번 더
function repairLine(kind, q, C) {
  if (kind === 'what') return 'It means we add money to your plan every month, automatically.';
  if (kind === 'check' && q.intent === 'cost') return `Yes, that's right. ${BK.money(C.amount)}.`;
  if (kind === 'check' && q.intent === 'get') return `Yes, that's right. ${BK.money(C.usd)}.`;
  return null;
}
function simAnswer(a, spoken) {
  if (SIM.done || !SIM.started) return;
  const q = simQ(), C = simC(), L = SIM.log[SIM.i];
  const j = spoken ? BK.matchSpoken(spoken, q, C) : BK.judge(q, a, C);
  const model = BK.model(q, C);
  SIM.heard = spoken || null;
  if (j.repair) {
    const re = repairLine(j.repair, q, C);
    SIM.react = { en: re || 'Sure. ' + q.en, ko: re ? (j.repair === 'check' ? '상대가 숫자를 확인해 줬어요. 이제 대답해 보세요.' : '상대가 쉬운 말로 알려 줬어요. 이제 대답해 보세요.') : '다시 물었어요. 상대가 천천히 한 번 더 말해요.', st: 'repair', who: whoOf(q) }; SIM.why = null; simBuild();
    simSpeak(re ? [{ text: re, sp: q.sp }] : [{ text: 'Sure.', sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }], { slow: true }); return;
  }
  L.tries.push({ t: spoken ? `(말로) ${spoken}` : BK.text(a), ok: j.ok, stage: j.stage });
  SIM.why = { j, model, spoken: !!spoken };
  if (j.ok) {
    L.final = spoken || BK.text(a);
    (spoken ? (j.covered || [q.intent]) : BK.covered(a, q)).filter(i => i !== q.intent).forEach(i => SIM.covered.add(BK.CROSS[i] ? `*:${i}` : `${q.place}:${i}`));
    const ok = BK.REACT.ok[(SIM.i + L.tries.length) % BK.REACT.ok.length];
    let n = SIM.i + 1; const skip = [];
    while (n < SIM.qs.length && isCovered(BK.Q[SIM.qs[n]])) { skip.push(SIM.qs[n]); n++; }
    SIM.skipped.push(...skip);
    const reply = BK.reply(q, a || model, C);
    if (n >= SIM.qs.length) {
      const bye = [reply, 'Have a great day!'].filter(Boolean).join(' ');
      SIM.done = true; SIM.react = { en: bye, ko: '모두 마쳤어요! 돈을 바꾸고, 휴대폰을 개통하고, 은행 계좌와 카드까지 만들었어요.', st: 'ok', who: whoOf(q) };
      simBuild(); simSpeak([{ text: bye, sp: q.sp }]); return;
    }
    const prevPlace = q.place;
    SIM.i = n; simPrep();
    const nq = simQ(), moved = nq.place !== prevPlace, intro = moved && PLACE_INTRO[nq.place] ? PLACE_INTRO[nq.place](SIM.card) : '';
    const skipKo = skipLabel(skip);
    const pre = reply || (skip.length ? 'Great.' : ok);
    SIM.react = { en: pre, ko: (skip.length ? `한 번에 말해서 ${skipKo} 질문을 건너뛰었어요. ` : '통과! ') + intro, st: 'ok', who: whoOf(q) };
    simBuild();
    if (nq.sp === q.sp) simAsk({ text: pre, sp: q.sp });
    else simSpeak([{ text: pre, sp: q.sp }, { text: nq.en, sp: nq.sp, gap: 0.6 }]);
  } else {
    const r = j.stage === 1 ? BK.REACT[1](q) : j.stage === 2 ? BK.REACT[2](q, j, a, C) : j.stage === 3 ? BK.REACT[3](q, j, a) : { en: 'Sorry?', ko: '알아듣지 못했어요.' };
    SIM.react = Object.assign({ st: 'no', who: whoOf(q) }, r);
    if (q.intent !== LINE_INTENT) { SIM.f = null; SIM.v = null; }   // 주소 한 줄은 틀린 조각만 바꿔 끼우게 그대로 둬요
    simBuild(); simSpeak([{ text: r.en, sp: q.sp }]);
  }
}
const chipT = f => esc(BK.FRAME[f].t.replace(/[{}]/g, '')).replace('___', '<i class="blank">___</i>');
const slotLabel = (f, v) => { const F0 = BK.FRAME[f], x = BK.sv(F0.slot, v); return x ? (x[F0.form || 't'] != null ? x[F0.form || 't'] : x.t) : v; };
// 은행 · 휴대폰 영수증 (HTML) — 시뮬레이터의 끝: 환전 · 휴대폰 요금제 · 새 계좌
function bankHTML(c) {
  const rows = [['EXCHANGED', BK.wonText(c.won)], ['YOU GOT', `${BK.money(c.usd)} · ${BK.BILLS[c.bills].t.toUpperCase()} BILLS`], ['PHONE PLAN', `${BK.PLANS[c.plan].t.replace(/^A /, '').toUpperCase()} · ${BK.DATA[c.data].t.toUpperCase()}`], ['FIRST MONTH', BK.money(c.amount)], ['NEW NUMBER', c.phone], ['ACCOUNT', c.acct === 'savings' ? 'SAVINGS' : 'CHECKING'], ['ADDRESS', BK.addrEn(c.addr)], ['DEBIT CARD', c.debit ? 'ISSUED' : '—']];
  return `<div class="rcpt" role="img" aria-label="환전 · 휴대폰 · 새 계좌 요약"><p class="rc-h">${esc(BK.BANK.toUpperCase())}</p><p class="rc-g">EXCHANGE · ${esc(BK.SHOP.toUpperCase())} · NEW ACCOUNT</p><ul>${rows.map(([k, v]) => `<li><span>${k}</span><b>${esc(v)}</b></li>`).join('')}</ul><p class="rc-t"><span>PIN</span><b>•••• (말하지 않음)</b></p></div>`
    + '<p class="rc-n">은행 · 가게 이름 · 환율 · 요금 · 주소 · 전화번호는 지어낸 예시예요. 실제 서류와 절차는 은행 · 가게마다 달라요.</p>';
}
// 새 휴대폰 화면 + 직불 카드 (캔버스) — 모두 마친 뒤에만 그려요
function drawSimArt(c) {
  const cv2 = $('simArt'); if (!cv2) return;
  const W0 = 380, H0 = 300, d = 2, g = cv2.getContext('2d');
  cv2.width = W0 * d; cv2.height = H0 * d; g.setTransform(d, 0, 0, d, 0, 0);
  g.fillStyle = BKS.COL.bg; g.fillRect(0, 0, W0, H0);
  BKS.phoneScreen(g, 18, 22, 150, { phone: c.phone });
  if (c.debit) BKS.debitCard(g, 186, 70, 180);
  else { g.font = `700 13px ${F.FB}, sans-serif`; g.fillStyle = BKS.COL.muted; g.textAlign = 'center'; g.fillText('직불 카드 없이 계좌만 열었어요', 276, 140); }
}
function simBuild() {
  const hear = BKV.supported, C = SIM.card;
  $('simCard').innerHTML = `<p class="tc-head">${PI('id')}<b>내 카드</b> <span lang="en">MY CARD</span></p><dl>${BK.cardRows(C).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="tc-foot">환전 창구 · ${esc(BK.SHOP)} · ${esc(BK.BANK)} (지어낸 곳) · 받을 달러 · 요금 · 새 번호는 카드에 없어요 — 상대가 말하는 것을 들어요</p>`;
  const prog = SIM.qs.map((id, k) => { const L = SIM.log[k], skipped = SIM.skipped.includes(id), c = skipped ? ' skip' : !L || !L.final ? (k === SIM.i && !SIM.done ? ' cur' : '') : L.tries[0] && L.tries[0].ok ? ' ok' : ' late'; return `<li class="${c}" title="${esc(BK.INTENT_KO[BK.Q[id].intent] || '')}${skipped ? ' (건너뜀)' : ''}">${k + 1}</li>`; }).join('');
  $('simProg').innerHTML = prog;
  const box = $('simMain');
  if (!SIM.started) {
    box.innerHTML = `<div class="sim-start"><p>왼쪽 내 카드가 오늘의 사실이에요. 환전 창구(내가 먼저 용건을 말해요) → 금액 · 지폐 · 받을 금액 되짚기, 휴대폰 가게 → 요금제 · 새 번호 되짚기, 그리고 다음 날 은행 창구 → 서류 → 주소 · 전화번호 → 카드 차례로 이야기해요. 먼저 <b>질문의 모양</b>을 잡고(Yes/No · 고르기 · 정보 · 안내), 대답 틀 칩을 고른 뒤 카드의 정보 칩을 넣어요. 받을 달러 · 요금 · 새 번호는 카드에 없으니 <b>상대가 말하는 것</b>을 잘 들으세요. 주소는 <b>조각 칩</b>으로 작은 곳에서 큰 곳으로 한 줄을 만들어요(R 다시 듣기 · S 천천히)${SRC ? ' — 마이크로 말해서 대답할 수도 있어요' : ''}.</p><button type="button" class="btn" id="simGo">환전 창구에서 시작 (Enter)</button></div>`;
    return;
  }
  if (SIM.done) {
    const first = SIM.log.filter(L => L && L.tries[0] && L.tries[0].ok).length, asked = SIM.log.filter(Boolean).length;
    const ml = BK.modelLine(C.addr);
    box.innerHTML = `<div class="sim-end"><div class="end-art">${bankHTML(C)}<figure class="sim-map"><canvas id="simArt" role="img" aria-label="새 휴대폰 화면(새 번호)${C.debit ? '과 직불 카드' : ''}"></canvas><figcaption>새 번호 ${esc(C.phone)} → <span lang="en">${esc(BK.digits(C.phone))}</span>${C.debit ? ' · 직불 카드는 지어낸 그림이에요' : ''}</figcaption></figure></div><div><p class="sim-score"><b>${first} / ${asked}</b> 질문을 한 번에 통과했어요.</p>
      <p class="sim-saved">주소 한 줄 → <span lang="en">${segHTML(ml)}</span> ${lpBtn(meSeq(ml), '주소 한 줄 듣기')}</p>
      <p class="sim-react ok"><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>
      <ol class="sim-log">${SIM.log.filter(Boolean).map(L => `<li><span class="who">${esc(WHO[L.sp] || '직원')}</span>${lpBtn([{ text: L.en, sp: L.sp }], '듣기')}<span lang="en">${esc(L.en)}</span><br><span class="who me">나</span>${lpBtn(meSeq(L.final), '듣기')}<span lang="en">${esc(L.final)}</span>${L.tries.length > 1 ? ` <small>(${L.tries.length}번째에 통과)</small>` : ''}</li>`).join('')}</ol>
      <div class="tg-acts"><button type="button" class="btn" id="simAgain">새 카드로 다시 (N)</button>${hear ? `<button type="button" class="btn ghost" data-lp="${seqId(SIM.log.filter(Boolean).flatMap(L => [{ text: L.en, sp: L.sp }, { text: L.final, sp: 'me', gap: 0.4 }]))}">대화 전체 듣기</button>` : ''}</div></div></div>`;
    drawSimArt(C);
    return;
  }
  const q = simQ(), show = SIM.script || !hear, line = q.intent === LINE_INTENT;
  let fa = null;
  if (SIM.f) { const Fm = BK.FRAME[SIM.f]; if (!Fm.slot || SIM.v) { fa = { f: SIM.f }; if (Fm.slot) fa.v = SIM.v; } }
  let h = `${lsnBar(SIM.script)}`;
  h += `<div class="sim-officer">${staffSVG(BKS.kindOf(q))}<p class="sim-bub"><span class="who">${esc(whoOf(q))}</span><span class="ldr-t" lang="en">${lineHTML(q.en, show ? keyMarks(q) : [], show)}</span>${show ? SHI(q.shape) : ''}${hear ? `<button type="button" class="lp-play lp-mini" data-simline="1" aria-label="다시 듣기" title="다시 듣기">${SVG_PLAY}</button>` : ''}</p></div>`;
  if (SIM.react) h += `<p class="sim-react ${SIM.react.st}"><span class="who">${esc(SIM.react.who || whoOf(q))}</span><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>`;
  const mic = SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 대답하기 (M)'}</button>` : '';
  if (line) {
    const L = SIM.line, a = BK.L(L.words.slice());
    h += `<div class="sim-build"><p class="sim-lab">주소 한 줄 — 작은 곳에서 큰 곳으로 조각을 누르세요 <small>같은 자리의 조각은 바꿔 끼워져요 · Backspace 하나 지우기</small></p>
      ${SIM.chips.map(gr => row(BK.OCAT[gr.c].ko, `<div class="seg">${gr.ids.map(w => `<button type="button" data-sw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(BK.OW[w].t)}</span></button>`).join('')}</div>`)).join('')}
      <div class="sim-ans"><span class="who me">나</span>${L.words.length ? `<span lang="en" class="sim-line">${segHTML(a)}</span>` : '<span class="note">조각을 고르세요. It\'s → 방 번호 → 건물 → 번지 + 길 → 도시 + 우편번호.</span>'}</div>
      <div class="tg-acts"><button type="button" class="btn" id="simLine"${L.words.length ? '' : ' disabled'}>말하기 (Enter)</button><button type="button" class="btn ghost" id="simLineClear"${L.words.length ? '' : ' disabled'}>지우기</button><button type="button" class="btn ghost" id="simSkip">주소 대신 → I live in a dormitory.</button>${mic}</div></div>`;
  } else {
    h += `<p class="sim-lab">① 대답 틀 <small>1~${SIM.frames.length}</small></p><div class="chips" role="group" aria-label="대답 틀">${SIM.frames.map((f, k) => `<button type="button" class="chipf" data-sf="${f}" aria-pressed="${SIM.f === f}"><small>${k + 1}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}</div>`;
    const Fm = SIM.f ? BK.FRAME[SIM.f] : null;
    if (Fm && Fm.slot) h += `<p class="sim-lab">② 내 정보 넣기 <small>A~C</small></p><div class="chips" role="group" aria-label="칸에 넣을 정보">${SIM.slots[SIM.f].map((v, k) => `<button type="button" class="chips-s" data-sv="${esc(v)}" aria-pressed="${SIM.v === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(slotLabel(SIM.f, v))}</span></button>`).join('')}</div>`;
    h += `<div class="sim-ans"><span class="who me">나</span>${fa ? `<span lang="en" class="sim-line">${segHTML(fa)}</span>` : SIM.f ? `<span lang="en" class="sim-line">${chipT(SIM.f)}</span>` : '<span class="note">틀을 고르세요.</span>'}</div>`;
    h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${fa ? '' : ' disabled'}>대답하기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${SIM.f ? '' : ' disabled'}>지우기</button>${mic}</div>`;
  }
  if (SIM.heard) h += `<p class="note">들린 말: <span lang="en">${esc(SIM.heard)}</span></p>`;
  if (SIM.why) {
    const { j, model } = SIM.why, st = j.ok ? '통과' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸렸어요';
    h += `<div class="sim-why ${j.ok ? 'ok' : 'no'}"><p><b>${esc(st)}</b> ${esc(j.why)}</p>${j.ok ? '' : `<p>모범 대답 ${lpBtn(meSeq(model), '모범 대답 듣기')}<span lang="en">${segHTML(model)}</span> <small>${esc(BK.ko(model))}</small></p>`}${SIM.why.spoken ? '<p class="note">말로 한 대답은 낱말과 카드의 사실(금액 · 들은 숫자 · 서류 · 주소)만 맞춰 봐요. 질문의 모양(yes · no만 했는지)은 보지만, 공손함과 발음은 판정하지 않아요.</p>' : ''}</div>`;
  }
  box.innerHTML = h;
  paintPlay($('sim'), SIM.mode);
}
// 상대 얼굴 (영상의 avatar와 같은 색): 환전 창구 직원(남색 조끼 · 이름표) · 휴대폰 가게 직원(주황 셔츠 · 목걸이 줄 · 안경) · 은행 창구 직원(넥타이 · 이름표) · 신청서 담당(보라 재킷 · 안경)
const LOOKS = BKS.LOOK;
const staffSVG = kind => {
  const L = LOOKS[kind] || LOOKS.teller;
  return `<svg class="sim-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#202A36"/>`
    + (L.long ? `<path d="M14.6 19h4v12h-4zM29.4 19h4v12h-4z" fill="${L.hair}"/>` : '')
    + `<ellipse cx="24" cy="47" rx="19" ry="14" fill="${L.shirt}"/>`
    + (L.coat ? `<path d="M5.5 47a19 14 0 0 1 12.5-13.2L22.5 48zM42.5 47a19 14 0 0 0-12.5-13.2L25.5 48z" fill="${L.coat}"/>` : '')
    + (L.tie ? `<path d="M22.6 33.6h2.8l-.4 2.4 1.4 7-2.4 2.6-2.4-2.6 1.4-7z" fill="${L.tie}"/>` : '')
    + (L.badge ? `<rect x="29.5" y="39" width="6" height="3.6" rx="0.8" fill="${L.badge}"/>` : '')
    + (L.scarf ? `<rect x="17" y="32.5" width="14" height="4" rx="1.5" fill="${L.scarf}"/><rect x="26" y="34" width="3.4" height="9" rx="1.2" fill="${L.scarf}"/>` : '')
    + (L.lanyard ? `<path d="M20 33.5l3 8M28 33.5l-3 8" stroke="${L.lanyard}" stroke-width="1.6" fill="none"/><rect x="21.5" y="41" width="5" height="4" rx="1" fill="#F4F6F8"/>` : '')
    + `<circle cx="24" cy="21" r="8.5" fill="${L.skin}"/><path d="M15.5 19a8.5 8.5 0 0 1 17 0z" fill="${L.hair}"/>`
    + '<circle cx="21" cy="22" r="1" fill="#2B2420"/><circle cx="27" cy="22" r="1" fill="#2B2420"/>'
    + (L.glasses ? '<g fill="none" stroke="#2B2420" stroke-width="1"><circle cx="21" cy="22" r="2.4"/><circle cx="27" cy="22" r="2.4"/><path d="M23.4 22h1.2"/></g>' : '')
    + '</svg>';
};
function simKeep() { if (!$('sim').contains(document.activeElement) || !document.activeElement.isConnected) $('sim').focus({ preventScroll: true }); }
function simMic() {
  if (!SRC || SIM.done || !SIM.started) return;
  if (SIM.listening) { stopListening(); return; }
  listenOnce({
    onState(on) { SIM.listening = on; simBuild(); simKeep(); },
    onText(alts) { const q = simQ(), C = simC(), best = alts.find(t => BK.matchSpoken(t, q, C).ok) || alts[0]; simAnswer(null, best); simKeep(); },
    onFail(msg) { SIM.react = { en: '…', ko: msg, st: 'no' }; simBuild(); simKeep(); },
  });
}
function simLineSubmit() { const L = SIM.line; if (!L.words.length) return; simAnswer(BK.L(L.words.slice())); }
function simSayChips() {
  if (!SIM.f) return;
  const Fm = BK.FRAME[SIM.f]; if (Fm.slot && !SIM.v) return;
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
    if (b.id === 'simSkip') { simAnswer({ f: 'ad_dorm' }); simKeep(); return; }
    if (b.dataset.simline) { simAsk(null, false); return; }
    if (b.dataset.act === 'play') { if (SIM.mode === 'play' && BKV.busy()) BKV.stop(); else simAsk(null, false); return; }
    if (b.dataset.act === 'slowplay') { if (SIM.mode === 'slowplay' && BKV.busy()) BKV.stop(); else simAsk(null, true); return; }
    if (b.dataset.act === 'script') { SIM.script = !SIM.script; simBuild(); simKeep(); }
  });
  $('sim').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), onBtn = e.target.closest && e.target.closest('button');
    if (!SIM.started) { if (e.key === 'Enter' && !onBtn) { e.preventDefault(); $('simGo').click(); } return; }
    if (SIM.done) { if (k === 'N' || (e.key === 'Enter' && !onBtn)) { e.preventDefault(); $('simAgain').click(); } return; }
    const n = '1234'.indexOf(e.key), sv = 'ABC'.indexOf(k), q = simQ();
    if (q.intent === LINE_INTENT) {
      if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simLineSubmit(); simKeep(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); SIM.line.words.pop(); simBuild(); simKeep(); return; }
    } else if (n >= 0 && n < SIM.frames.length) { e.preventDefault(); SIM.f = SIM.frames[n]; SIM.v = null; simBuild(); simKeep(); return; }
    else if (sv >= 0 && SIM.f && BK.FRAME[SIM.f].slot && SIM.slots[SIM.f][sv] != null) { e.preventDefault(); SIM.v = SIM.slots[SIM.f][sv]; simBuild(); simKeep(); return; }
    else if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simSayChips(); simKeep(); return; }
    else if (e.key === 'Backspace') { e.preventDefault(); SIM.f = null; SIM.v = null; simBuild(); simKeep(); return; }
    if (k === 'R' && BKV.supported) { e.preventDefault(); simAsk(null, false); }
    else if (k === 'S' && BKV.supported) { e.preventDefault(); simAsk(null, true); }
    else if (k === 'T' && BKV.supported) { e.preventDefault(); SIM.script = !SIM.script; simBuild(); simKeep(); }
    else if (k === 'M' && SRC) { e.preventDefault(); simMic(); }
    else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
  });
  simNew(); SIM.started = false; simBuild();
}

/* =========================================================
   11. 은행 · 휴대폰 표현 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 숫자는 15든 fifteen이든 같은 숫자로 맞춰요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = BK.PLACES.map(p => ({ p, rows: BK.SHADOW.map((s, i) => [s, i]).filter(([s]) => s.place === p.id) })).filter(g => g.rows.length);
  $('shList').innerHTML = groups.map(({ p, rows }) => `<section class="sh-grp"><h3>${PI(p.id)}${esc(p.ko)} <span lang="en">${esc(p.en)}</span></h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${BKV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-who ${s.who}">${s.who === 'me' ? '나' : esc(WHO[s.sp] || '직원')}</span><span class="sh-en" lang="en">${esc(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { const s = BK.SHADOW[i]; return [{ text: s.en, sp: s.sp }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = BK.SHADOW[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, BK.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.words.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.t)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}${/Kellport|Maple Hall|College Avenue|\d/.test(s.en) && r.hit < r.total ? ' (이름 · 주소 · 숫자는 음성 인식이 다르게 적기 쉬워요.)' : ''}</p>`);
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${BKV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
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
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (b) b.classList.remove('saying'); if (thenOrig && BKV.supported) speak(shSeq(i)); };
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
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', p: '#FFC15E', bad: '#FF8E8E', hover: '#6EC8FF', box: '#2A3644', key: '#FFC15E', line: '#5A6878', good: '#7FE0A8' };
const qfont = (px, w = 500, fam) => `${w} ${px}px ${fam || F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
const qLetter = (g, x, y, k) => { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill(); g.font = qfont(12, 700); g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCDE'[k], x, y + 1); };
const markOf = (i, st) => st.done && i === st.answer ? QCOL.p : st.done && i === st.pick ? QCOL.bad : st.hover === i ? QCOL.hover : null;
// 칸 넷이 가로로 놓인 그림의 공통 틀 (칸마다 A~D)
const cellPick = (Wd, top, H, n) => (x, y) => y > top && y < H - 4 ? Math.min(n - 1, Math.floor(x / (Wd / n))) : -1;
function cellBox(g, st, k, x, y, w, h) {
  rrq(g, x, y, w, h, 12); g.fillStyle = st.hover === k ? QCOL.box : 'rgba(255,255,255,0.03)'; g.fill();
  const c = markOf(k, st); if (c) { g.strokeStyle = c; g.lineWidth = 3; g.stroke(); }
}
// 질문의 모양 넷 (A~D)
function shapeFig(label) {
  const ids = ['yn', 'or', 'wh', 'note'], Wd = 600, H = 210, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: cellPick(Wd, 8, H, 4),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      ids.forEach((sh, k) => {
        const x = k * cw + cw / 2;
        cellBox(g, st, k, k * cw + 8, 10, cw - 16, H - 22);
        g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L4[k], x, 32);
        BKS.shapeMark(g, sh, x, 92, 34);
        g.font = qfont(14, 700); g.fillStyle = QCOL.text; g.fillText(BK.SHAPE[sh].ko, x, 150);
        g.font = qfont(12, 500); g.fillStyle = QCOL.muted; g.fillText(BK.SHAPE[sh].mark, x, 172);
      });
    } };
}
// 받을 달러 넷 (A~D) — 위에 오늘의 환율(지어낸 예시)과 바꾼 원
function fxFig(label, won, amts) {
  const Wd = 600, top = 64, H = 196, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: cellPick(Wd, top, H, 4),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      rrq(g, 8, 8, Wd - 16, 44, 10); g.fillStyle = '#0B1A14'; g.fill(); g.strokeStyle = 'rgba(127,224,168,0.45)'; g.lineWidth = 1.4; g.stroke();
      g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = qfont(11, 700, F.FM); g.fillStyle = QCOL.muted; g.fillText("TODAY'S RATE", 22, 30);
      g.font = qfont(16, 800, F.FM); g.fillStyle = QCOL.good; g.fillText(`1 USD = ${BK.comma(BK.RATE)} KRW`, 118, 30);
      g.textAlign = 'right'; g.font = qfont(14, 700, F.FM); g.fillStyle = QCOL.text; g.fillText(`${BK.wonText(won)} → $ ?`, Wd - 22, 30);
      amts.forEach((c, k) => {
        const x = k * cw + cw / 2;
        cellBox(g, st, k, k * cw + 8, top, cw - 16, H - top - 8);
        qLetter(g, x, top + 24, k);
        g.font = qfont(BK.money(c).length > 5 ? 26 : 30, 800, F.FM); g.fillStyle = QCOL.text; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(BK.money(c), x, top + 76);
        g.font = qfont(11.5, 600); g.fillStyle = QCOL.muted; g.fillText('USD', x, top + 104);
      });
    } };
}
// 서류 넷 (A~D) — 서류 모양은 영상과 같은 그림(BKS.docCard)
function docFig(label, ids) {
  const Wd = 600, H = 196, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: cellPick(Wd, 4, H, 4),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      ids.forEach((id, k) => {
        const x0 = k * cw;
        cellBox(g, st, k, x0 + 6, 6, cw - 12, H - 12);
        qLetter(g, x0 + cw / 2, 26, k);
        g.save(); BKS.docCard(g, x0 + 18, 44, cw - 36, id); g.restore();
        const ko = BK.DOCS[id].ko.replace(/\(.*\)$/, '');
        g.font = qfont(13, 700); g.fillStyle = QCOL.text; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ko, x0 + cw / 2, H - 26);
      });
    } };
}
// 주소 한 줄 넷 (2 × 2, A~D) — 줄은 칸 너비에 맞춰 접어요
function addrFig(label, lines) {
  const Wd = 600, cw = 300, ch = 116, H = ch * 2 + 8;
  const wrap = (g, t, w) => { const out = []; let cur = ''; t.split(' ').forEach(wd => { const nx = cur ? cur + ' ' + wd : wd; if (cur && g.measureText(nx).width > w) { out.push(cur); cur = wd; } else cur = nx; }); if (cur) out.push(cur); return out; };
  return { width: Wd, height: H, label,
    pick: (x, y) => x > 0 && x < Wd && y > 4 && y < H - 4 ? Math.min(1, Math.floor(y / ch)) * 2 + Math.min(1, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      lines.forEach((Lw, k) => {
        const x0 = (k % 2) * cw, y0 = Math.floor(k / 2) * ch + 4;
        cellBox(g, st, k, x0 + 6, y0 + 2, cw - 12, ch - 8);
        qLetter(g, x0 + 28, y0 + 26, k);
        g.font = qfont(15, 600); g.fillStyle = QCOL.text; g.textAlign = 'left'; g.textBaseline = 'middle';
        wrap(g, BK.lineText(Lw), cw - 70).slice(0, 4).forEach((t, r) => g.fillText(t, x0 + 48, y0 + 26 + r * 22));
      });
    } };
}
const QS = (() => {
  const o = BK.o, j = (q, a, c) => BK.judge(q, a, c || {}).ok;
  const need = [o('nd_fxgive'), o('g_yesp'), o('nd_fx', 300000), o('nd_book')];
  const much = [o('mc_won', 600000), o('mc_man', 600000), o('mc_won', 60000), o('g_yes')];
  const AMTS = [2400, 21400, 240000, 24000];
  const num = [o('nb_ok'), o('nb_big', '555-0147'), o('nb_so', '555-0147'), o('nb_so', '555-0174')];
  const stu = [o('su_yes'), o('su_do'), o('g_no'), o('ul_yes')];
  const DOCS4 = ['passport', 'sid', 'lease', 'letter'];
  const proof = [o('pf_no'), o('pf_dorm'), o('pf_yes', 'lease'), o('pf_ask')];
  const A0 = { room: 412, hall: 'maple' };
  const lines = [BK.LINE_KO, BK.LINE_K, BK.LINE, BK.LINE_ROOM];
  const els = [o('el_where'), o('g_yes'), o('el_plain'), o('el_atm')];
  const q = [
    { q: '환전 창구 직원이 Hello! How can I help you today? 하고 물어요. 30만 원을 미국 달러로 바꾸고 싶어요. 가장 알맞은 대답은?', opts: need.map(BK.text), a: 2,
      why: `용건 + 금액 + 부탁 → ${BK.text(need[2])} (A) Change this into dollars.는 명령처럼 들려요. (B) Yes, please.로는 무엇을 원하는지 알 수 없어요(정보 질문). (D) make a bankbook은 ‘통장을 만들다’를 낱말 그대로 옮긴 말이고, 돈을 바꾸는 용건도 아니에요.`,
      check: () => need.map(a => j('fx_help', a, { task: 'fx', won: 300000 })).join() === 'false,false,true,false' },
    { q: 'Sure. How much would you like to change? — 60만 원을 바꾸려고 해요. 가장 알맞은 대답은?', opts: much.map(BK.text), a: 0,
      why: '‘만’은 영어에 없는 단위예요. 영어는 세 자리(thousand)씩 끊어요 → 600,000 = six hundred thousand won. (B) sixty man won은 알아듣지 못해요. (C) sixty thousand won은 6만 원이에요(0이 하나 모자라요). (D) Yes.로는 답이 안 돼요(정보 질문).',
      check: () => much.map(a => j('fx_much', a, { won: 600000 })).join() === 'true,false,false,false' },
    { q: '30만 원을 바꿨어요. 직원 → At today\'s rate, that comes to two hundred forty dollars. 들은 금액은? 금액을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: fxFig('받을 달러 넷. A 24달러, B 214달러, C 2,400달러, D 240달러. 위에 오늘의 환율 1달러 = 1,250원, 바꾼 돈 300,000원', 300000, AMTS),
      why: 'two hundred forty → $240(D). 300,000 ÷ 1,250 = 240이니 계산과도 맞아요. two hundred fourteen이면 $214(B), twenty-four면 $24(A), two thousand four hundred면 $2,400(C)예요. forty와 fourteen은 끝소리(-ty · -teen)와 강세(FORty · fourTEEN)로 가려요. 환율은 지어낸 예시예요.',
      check: () => BK.fx(300000) === AMTS[3] && BK.money(AMTS[3]) === '$240' && /^two hundred forty dollars$/.test(BK.priceWords(AMTS[3])) && BK.money(AMTS[1]) === '$214' },
    { q: '휴대폰 가게 직원이 묻는 말: Would you like a prepaid plan or a monthly plan? 이 질문의 모양은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: shapeFig('질문의 모양 넷. A Yes/No 질문(스위치), B 고르는 질문(갈림길), C 정보 질문(빈 상자), D 안내(말풍선)'),
      why: 'A or B? → 둘 가운데 하나를 고르라는 고르는 질문(갈림길)이에요. 고른 것 + please → A prepaid plan, please. Yes, please.로는 무엇을 골랐는지 알 수 없어요.',
      check: () => BK.Q.sh_plan.shape === 'or' && !j('sh_plan', o('g_yesp'), { plan: 'prepaid' }) && j('sh_plan', o('pl_pl', 'prepaid'), { plan: 'prepaid' }) },
    { q: '휴대폰 가게 직원 → Alright, you\'re all set. Your new number is 555-0147. 가장 알맞은 대답은?', opts: num.map(BK.text), a: 2,
      why: '새 번호는 은행 서류에도 써야 하니 되짚어요 → So, it\'s 555-0147?(five-five-five, oh-one-four-seven) (A) 고맙다고만 하면 제대로 받아 적었는지 확인하지 못해요. (B) 번호를 큰 수처럼(five hundred fifty-five) 읽으면 알아듣기 어려워요. 번호는 한 자리씩 묶음으로 끊어요. (D) 끝 두 자리(47 → 74)가 바뀌었어요.',
      check: () => num.map(a => j('sm_num', a, { phone: '555-0147' })).join() === 'false,false,true,false' },
    { q: '은행 직원 → Are you a student? 켈포트 대학교 교환학생이에요. 가장 알맞은 대답은?', opts: stu.map(BK.text), a: 0,
      why: 'Are you …? 질문에는 첫 낱말의 짝으로 → Yes, I am. 사실을 하나 더 붙이면 직원이 다음 질문을 하지 않아도 돼요. (B) Yes, I do.는 Do you …? 질문의 짝이에요. (C) No, thanks.는 권하는 말을 거절하는 말이에요. (D) Yes, it is.는 Is it …? 질문의 짝이에요.',
      check: () => stu.map(a => j('tl_student', a, { student: true })).join() === 'true,false,false,false' },
    { q: '은행 직원 → Do you have a second form of ID? 여권은 벌써 냈어요. 하나 더 내밀 서류는? 서류를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: docFig('서류 넷. A 여권, B 학생증, C 기숙사 계약서, D 학교 확인서', DOCS4),
      why: 'second form of ID → 두 번째 신분증 → 학생증(B): Yes, I do. Here\'s my student ID. 여권(A)은 이미 냈고, 기숙사 계약서(C)는 주소를, 학교 확인서(D)는 재학을 증명하는 서류예요. 그 둘은 proof of address(주소 증명)를 물을 때 내요.',
      check: () => j('id_second', o('sc_yes', 'sid'), { doc: 'sid' }) && !j('id_second', o('sc_yes', 'lease'), { doc: 'sid' }) && !j('id_second', o('sc_yes', 'passport'), { doc: 'sid' }) },
    { q: '은행 직원 → Do you have proof of address? 주소를 증명할 서류가 지금은 없어요. 가장 알맞은 대답은?', opts: proof.map(BK.text), a: 3,
      why: 'Do you …? → No, I don\'t.로 사실을 말하고, 대신 낼 수 있는 서류를 질문으로 물어요 → Would a letter from my university work? (A) 없다고만 하면 계좌를 열 수 없어요. (B) dormitory paper는 ‘기숙사 종이’를 그대로 옮긴 말이고, 서류가 없는데 있다고 했어요. (C) 계약서가 없는데 있다고 했어요.',
      check: () => proof.map(a => j('id_proof', a, { proof: false })).join() === 'false,false,false,true' },
    { q: `${BK.Q.fm_addr.en} — 기숙사 주소는 메이플 홀 412호예요(번지 200 College Avenue, 도시 ${BK.CITY} ${BK.ZIP}). 영어로 말하는 차례가 맞는 것은? 상자를 누르거나 단추를 고르세요.`, opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: addrFig(`주소 한 줄 넷. A ${BK.lineText(lines[0])} B ${BK.lineText(lines[1])} C ${BK.lineText(lines[2])} D ${BK.lineText(lines[3])}`, lines),
      why: '영어 주소는 작은 곳에서 큰 곳으로 → 방 번호 → 건물 → 번지 + 길 → 도시 + 우편번호(C). (A)는 한국 주소의 차례(큰 곳 → 작은 곳)예요. (B)는 번지를 길 이름 뒤에 붙였어요(200 College Avenue처럼 번지가 앞). (D)는 방 번호 412를 421로 바꿔 말했어요. 주소는 지어낸 예시예요.',
      check: () => lines.map(L => j('fm_addr', BK.L(L.words.slice()), { addr: A0 })).join() === 'false,false,true,false' },
    { q: '은행 직원 → Is there anything else I can help you with? 가장 가까운 ATM이 어디 있는지 알고 싶어요. 가장 알맞은 말은?', opts: els.map(BK.text), a: 3,
      why: 'Is there …? → Yes. + 부탁 질문 → Yes. Could you tell me where the nearest ATM is? (A) Where is ATM?은 묻는 말만 툭 던져 퉁명스럽고 the도 빠졌어요. (B) Yes.만 하면 무엇이 필요한지 몰라요. (C) No.는 물어볼 것이 있는데 없다는 말이 되고, 무뚝뚝하게 들려요.',
      check: () => els.map(a => j('cd_else', a, { ask: 'atm' })).join() === 'false,false,false,true' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[은행 · 휴대폰] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { if (x.a < 4) pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[은행 · 휴대폰] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { BKV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = BKS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * BKS.W, (e.clientY - r.top) / r.height * BKS.H]; };
const hitAt = (x, y) => started ? BKS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.stop != null) { S.stop = S.stop === h.stop ? null : h.stop; relab(); }
  else if (h && h.play && BKV.supported) speak(h.play);
  else if (h && h.say && BKV.hasClip('tc', h.say)) speak([{ text: h.say, sp: 'tc' }]);   // 미리 만든 발음(음성 해설의 영어와 같은 목소리)
  else if (h && h.say && EN.say.supported) { stopSounds(); if (playing) pause(); EN.say(BK.spoken(h.say)); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.stop != null ? '눌러서 이곳의 말 보기' : h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { BKV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = BKV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 대화 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 글이 정해진 말만 모아요: 영상의 말풍선 · 발음 칩, 질문(BK.Q), 직접 해 보기(곳 · 3단계 · 금액 · 요금제 · 새 번호 · 서류 · 주소 · 카드는 하나씩 골라 봄),
// 듣고 대답 고르기, 따라 말하기. 은행 · 휴대폰 시뮬레이터(카드마다 바뀌는 말)와 내가 칩으로 만든 문장은 브라우저 음성이라 빼요.
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text || !/[A-Za-z]/.test(text) || /^\(.*\)$/.test(String(text).trim())) return;   // (지문)은 읽지 않음
    const id = BKV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: BKV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(BKS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 말풍선(그 사람) · 영어 칩(발음 듣기 tc). 곳(map) · 3단계(method) 장은 하나씩 골라 놓고 한 번 더
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return ch ? [ch.t, ch.t + ch.d] : null; };
    const sweeps = [[{}, [0, END]]].concat(BK.PLACES.map((_, k) => [{ stop: k }, span('map')]), BK.METHOD.map((_, k) => [{ place: k }, span('method')])).filter(x => x[1]);
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.25) {
        BKS.render(g, t);
        BKS.hits().forEach(h => { if (h.play) addSeq(h.play, 'video'); else if (h.say) add('tc', h.say, 'video-say'); });
      }
    });
    // 2) 직접 해 보기: 장마다 처음 화면 + 곳 · 3단계는 하나씩 골라서 (듣기 단추에 걸린 말)
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* 그리기만 하는 칸 */ } });
    BK.PLACES.forEach((_, k) => { S.stop = k; try { LABS.map(); } catch (e) { /* */ } });
    S.stop = null;
    BK.METHOD.forEach((_, k) => { S.place = k; try { LABS.method(); } catch (e) { /* */ } });
    S.place = null;
    const tryLab = (k, f) => { try { f(); LABS[k](); } catch (e) { (window.__labErrs = window.__labErrs || []).push(k + ": " + e.message); } };
    BK.WONS.forEach(won => ['won', 'man', 'k', 'm'].forEach(how => ['large', 'small'].forEach(bills => tryLab('fx', () => { LAB.fx = { won, how, bills }; }))));
    BK.SHAPE_QS.forEach(q => tryLab('shop', () => { LAB.shape = { q, pick: null, yes: true }; }));
    ['d15', 'd50', 'unl', 'free'].forEach(data => ['m4', 'm6', 'm10'].forEach(stay => ['for', 'during'].forEach(dur => tryLab('shop', () => { LAB.shop = { data, stay, dur }; }))));
    BK.PHONES.forEach(phone => ['so', 'swap', 'big', 'ok'].forEach(a => tryLab('sim', () => { LAB.num = { phone, a }; })));
    NEED_OPTS.forEach(([need]) => ['checking', 'savings', 'book'].forEach(type => tryLab('teller', () => { LAB.acct = { need, type }; })));
    AUX_SET.forEach((X, k) => X.a.forEach((_, a) => tryLab('teller', () => { LAB.aux = { k, a }; })));
    Object.keys(DOC_Q).forEach(q => [true, false].forEach(proof => DOC_Q[q].forEach((_, a) => tryLab('id', () => { LAB.doc = { q, proof, a }; }))));
    // 주소 한 줄: 모범 줄 · 번지를 길 뒤에(k) · 방 번호 바꿈 · 우편번호 바꿈 · 조각 하나 빠짐 · 한국식 차례 · 뒤섞인 차례 (직원의 대답 BK.fixLine)
    BK.ROOMS.forEach(room => BK.HALL_IDS.forEach(hall => {
      const m = BK.lineWords({ room, hall }), st = BK.HALLS[hall].st, swap = (w, x) => m.map(v => v === w ? x : v);
      const vs = [m, swap('s' + st, 'k' + st), swap('r' + room, 'r' + BK.roomTrap(room)), swap('z' + BK.ZIP, 'z' + BK.zipTrap(BK.ZIP)), [m[0]].concat(m.slice(1).reverse()), [m[0], m[2], m[1]].concat(m.slice(3))]
        .concat(m.slice(1).map(w => m.filter(v => v !== w)));
      vs.filter(ws => ws.every(w => BK.OW[w])).forEach(words => tryLab('form', () => { LAB.line = { room, hall, words: words.slice() }; }));
    }));
    [true, false].forEach(debit => ['ok', 'say'].forEach(pin => [true, false].forEach(ask => tryLab('card', () => { LAB.card = { debit, pin, ask }; }))));
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 듣고 대답 고르기 · 먼저 골라 보기: 상대의 말 + 보기 넷
  BK.DRILL.concat(Object.values(BK.MINI)).forEach(it => { const Q = it.Q || BK.Q[it.q]; if (Q) addSeq(staffSeq(Q), 'drill'); it.opts.forEach(op => add('me', BK.text(op), 'drill')); });
  // 4) 따라 말하기
  BK.SHADOW.forEach((s0, i) => addSeq(shSeq(i), 'shadow'));
  // 5) 질문 목록의 나머지(상대의 말)
  Object.values(BK.Q).forEach(q => addSeq(staffSeq(q), 'q'));
  return out;
};
simInit();
shInit();
BDrill($('drillRoot'), BK.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 모양 잡기 → 틀 + 내 정보 → 공손하게, 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 02 · 03 · 09장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '환전 창구 · 휴대폰 가게 · 은행 창구의 일곱 곳, 서류는 내밀고 숫자는 끊어 말하기가 모두 익숙해졌네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(BKS.baseText()).then(() => { dirty = true; });
setTimeout(() => BKS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
