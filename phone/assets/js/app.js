/* 전화 (예약 · 문의) 회화 — 플레이어, 직접 해 보기, 전화 시뮬레이터, 따라 말하기, 듣고 대답 고르기, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(PN), 그림은 scenes.js(PNS), 목소리는 voices.js(PNV)가 맡습니다.
 * 소리가 겹치지 않게: 대화를 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(PNV.play의 before).
 * 식당 · 스포츠 센터 · 사람 이름 · 전화번호(555-01XX) · 시간 · 값은 모두 지어낸 예시예요.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const PN = window.PN, PNS = window.PNS, PNV = window.PNV, S = PNS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = PNS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cv = $('cv'), ctx = cv.getContext('2d');
PN.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = PNS.fonts;
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
  const ready = new Promise(res => PNS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '전화 영어, 철자는 as in · 숫자는 되짚기 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { PNS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: PNS.iconSVG('mic'),
};
const PI = id => PNS.iconSVG(id, 'pi');   // 곳 아이콘
const SHI = sh => `<span class="shp shp-${sh}">${PNS.iconSVG('shape_' + sh, 'pi')}${esc(PN.SHAPE[sh].ko)}</span>`;   // 질문의 모양 표시
// 듣기 · 천천히 · 대본 보기 단추 묶음 (공항 · 카페 · 호텔 · 식당 · 쇼핑과 같은 모양 · 같은 키 R · S · T)
const lsnBar = scriptOn => PNV.supported
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
  const cap = started ? PNS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 말풍선을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = PNS.chapterAt(T);
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
  if (dirty) { dirty = false; PNS.render(ctx, started ? T : POSTER); }
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
function stopSounds() { EN.say.stop(); PNV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return PNV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름
const lpBtn = (seq, label, cls = '') => PNV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
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
const meSeq = a => [{ text: typeof a === 'string' ? a : PN.text(a), sp: 'me' }];
// 말하는 사람 (목소리마다 한 사람): 식당 직원 벤 en-US · 안내 데스크 그레이스 en-CA · 수영 사무실 올리비아 en-GB · 디아스 코치 en-AU
const WHO = { us: '식당 직원 벤', ca: '안내 데스크 그레이스 (캐나다)', gb: '수영 사무실 올리비아 (영국)', au: '디아스 코치 (호주)' };
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
const segHTML = (a, on = true) => PN.segs(a).map(s => on && s.t.trim() && /[A-Za-z0-9]/.test(s.t) ? `<mark class="mk-${s.r}">${esc(s.t)}</mark>` : esc(s.t)).join('');
const keyMarks = q => q.key.map(t => ({ t, role: 'key' }));

/* =========================================================
   6. 듣고 대답 고르기 (이 튜토리얼 전용, 대중교통 TDrill과 같은 모양) — 상대의 말은 소리 먼저, 대답 넷은 글
   생김새와 키보드는 공통 부품 EN.drill과 같게: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본 · Enter/→ 다음
   힌트 ①부터 질문의 모양 표시(스위치 · 갈림길 · 빈 상자 · 말풍선)가 상대의 말 옆에 나와요.
   ========================================================= */
function TDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null;
  const compact = !!cfg.compact, hear = PNV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && PNV.busy()) { PNV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(staffSeq(it.Q), { slow: !!slow, onitem() { paintNow(root, '.ldr-q'); say(`${whoOf(it.Q)} · ${it.Q.fast ? '빠르게 말하는 중' : '말하는 중'}`); },
      onend(stopped) { mode = null; paintPlay(root, null); paintNow(root, null); say(stopped ? '' : '다 들었어요. 대답을 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { PNV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; PNV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    PNV.stop();
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = PN.steps(it), place = PN.PLACE[it.place];
    const marks = []; steps.slice(0, done ? 3 : s.hints).reverse().forEach(x => marks.push(...x.marks));   // 뒤 단계의 색이 앞 단계를 덮음
    const reveal = done || !hear || s.script, mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur), showShape = (done || s.hints > 0) && !it.Q.fast;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${PI(it.place)}${esc(place.ko)}</span><span>${compact ? '듣고 대답 고르기' : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span>${done ? `<span class="edr-tag">${it.Q.fast ? '다시 묻기' : esc(PN.SHAPE[it.Q.shape].ko)}</span>` : ''}</p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(it.sit)}</p>`;
    h += lsnBar(done ? null : s.script);
    h += `<p class="ldr-q"><b>${esc(whoOf(it.Q))}</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="q" aria-label="상대의 말 다시 듣기" title="상대의 말 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.Q.en, mk('q'), reveal)}</span>${showShape ? SHI(it.Q.shape) : ''}${it.Q.fast && !done ? '<small class="adr-fast">아주 빠르게</small>' : ''}</p>`;
    h += `<p class="adr-ask">나의 대답은?</p><div class="ldr-opts" role="group" aria-label="대답 보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '', t = PN.text(op);
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-lp="${seqId(meSeq(t))}" aria-label="(${L4[k]}) 듣기" title="(${L4[k]}) 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(t, mk(k), true)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + PN.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = [[`${whoOf(it.Q)} · ${it.Q.en}`, it.Q.ko, staffSeq(it.Q)]].concat(it.opts.map((op, k) => [`(${L4[k]}) ${PN.text(op)}`, PN.ko(op), meSeq(op)]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      h += `<div class="edr-acts">${hear ? `<button type="button" class="edr-btn ghost adr-ex" data-lp="${seqId(staffSeq(it.Q).concat([{ text: PN.text(it.opts[it.a]), sp: 'me', gap: 0.5 }]))}">${ICO.play} 대화 듣기 (상대 → 나)</button>` : ''}${compact ? '' : `<button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button>`}</div>`;
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
const OT = PN.o, D = PN.DEMO;
const qLine = (q, extra = []) => `<p class="enline">${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span class="who">${esc(whoOf(q))}</span><span lang="en">${lineHTML(q.en, (q.fast ? [] : keyMarks(q)).concat(extra), true)}</span></p>`;
const meLine = (a, label = '듣기') => `<p class="enline">${lpBtn(meSeq(a), label)}<span class="who me">나</span><span lang="en">${segHTML(a)}</span></p>`;
const sayLine = (q, text, sp) => text ? `<p class="enline">${lpBtn([{ text, sp: sp || q.sp }], '상대의 대답 듣기')}<span class="who">${esc(whoOf(q))}</span><span lang="en">${esc(text)}</span></p>` : '';
const seeded = n => () => (n = (n * 16807) % 2147483647) / 2147483647;
// 상대의 반응: 맞으면 맞장구(PN.reply), 틀리면 걸린 단계의 반응(PN.REACT)
const reactEn = (q, j, a, C) => j.ok ? PN.reply(q, a, C) : (j.stage === 1 ? PN.REACT[1](q) : j.stage === 2 ? PN.REACT[2](q, j, a, C) : PN.REACT[3](q, j, a)).en;
// 메시지 한 줄 조각 칩: 엔진의 조각 칩(갈래마다 맞는 조각 + 헷갈리기 쉬운 조각)
const lineChipsFor = C => PN.lineChips(C, seeded(11));
// 같은 자리의 조각을 누르면 바꿔 끼우고, 같은 조각을 다시 누르면 빼요 (누른 차례가 말하는 차례)
const toggleWord = (words, w) => words.includes(w) ? words.filter(x => x !== w) : words.filter(x => PN.OW[x].c !== PN.OW[w].c).concat([w]);
const lineRows = (C, words, attr) => lineChipsFor(C).map(gr => row(PN.OCAT[gr.c].ko, `<div class="seg">${gr.ids.map(w => `<button type="button" data-${attr}="${w}" aria-pressed="${words.includes(w)}"><span lang="en">${esc(PN.OW[w].t)}</span></button>`).join('')}</div>`)).join('');
// 헷갈리는 숫자 짝 (뒤를 세게 ↔ 앞을 세게) · 헷갈리는 글자 짝 (as in)
const pairList = () => `<ul class="qlist">${PN.PAIRS.map(([n1, s1, n2, s2]) => `<li>${lpBtn([{ text: PN.spoken(n1), sp: 'tc' }], '듣기: ' + n1)}<span><span lang="en">${esc(s1)}</span><small>${esc(n1)} · 뒤를 세게</small></span>${lpBtn([{ text: PN.spoken(n2), sp: 'tc' }], '듣기: ' + n2)}<span><span lang="en">${esc(s2)}</span><small>${esc(n2)} · 앞을 세게</small></span></li>`).join('')}</ul>`;
const alphaList = () => `<ul class="qlist">${PN.ALPHA.map(([l1, w1, l2, w2]) => `<li>${lpBtn([{ text: `${l1} as in ${w1}`, sp: 'tc' }], `듣기: ${l1} as in ${w1}`)}<span><span lang="en">${l1} as in ${esc(w1)}</span><small>${l1}</small></span>${lpBtn([{ text: `${l2} as in ${w2}`, sp: 'tc' }], `듣기: ${l2} as in ${w2}`)}<span><span lang="en">${l2} as in ${esc(w2)}</span><small>${l2}</small></span></li>`).join('')}</ul>`;
// 07장 Yes/No 질문의 짝: 질문 · 사실 · 고를 대답
const AUX_SET = [
  { q: 'nm_check', card: { sur: 'han', hok: false }, ko: '되짚은 철자 (Was that …?)', fact: '성은 Han(H-A-N)이에요. 직원이 M으로 잘못 되짚었어요', a: [['ck_wasnt', 'N'], ['ck_isnt', 'N'], ['ck_yes']] },
  { q: 'nb_check', card: { phone: '0139', pok: false }, ko: '되짚은 번호 (Is that right?)', fact: '내 번호는 555-0139예요. 직원이 0193으로 잘못 되짚었어요', a: [['nc_no', '0139'], ['nc_wasnt', '0139'], ['nc_yes']] },
  { q: 'cb_hi', card: { given: 'Jiwoo' }, ko: '찾는 사람 (Is this …?)', fact: '내가 지우(Jiwoo)예요', a: [['cb_is'], ['cb_sp'], ['g_no']] },
];
const BOOK_HOW = { ok: 'nd_book', rsv: 'nd_rsv', half: 'nd_bhalf', blunt: 'nd_bblunt' };
const FULL_OPTS = [['fl_alt', '다른 시간 묻기'], ['tm_ok', '알겠다고만'], ['tm_lit', '‘가능한 시간’을 그대로']];
const SPELL_OPTS = [['ok', '글자 + as in'], ['wrong', '헷갈리는 글자로'], ['sp_name', '이름만 다시'], ['g_yesp', 'Yes, please.만']];
const ASK_OPTS = [['nd_ask', '용건 (calling to ask about)'], ['nd_qhalf', '물어볼 게 있다고만'], ['nd_tell', '명령 (Tell me)'], ['nd_inq', '‘문의하다’를 inquiry로']];
const LAB = {
  book: { day: 'fri', how: 'ok', meal: 'dinner', ppl: 4 },
  full: { a: 'fl_alt' },
  time: { meal: 'dinner', alt: 'later', offer: 0, a: null },
  spell: { sur: 'han', how: 'ok', hok: false, a: null },
  ask: { topic: 'swim', a: 'nd_ask' },
  info: { lvl: 'beg', a: null },
  shape: { q: null, pick: null, yes: false },
  line: { lvl: 'beg', phone: '0139', words: [] },
  num: { phone: '0139', pok: false, a: null },
  aux: { k: 0, a: null },
  card: { given: 'Jiwoo', lvl: 'beg', item: 'gog', a: null },
};
const LAB0 = JSON.stringify(LAB);
const LABS = {
  intro: () => `${labHead('먼저 골라서 대답해 보세요')}${mini('intro')}
    <p class="note">상대의 말을 듣고 대답을 고르세요. 전화라서 상대의 얼굴은 보이지 않아요. 상대의 말은 답한 뒤에 글로 보여요. 막히면 힌트(H)로 3단계를 하나씩 열어 보세요.</p>`,
  map: () => {
    const i = S.stop, p = i != null ? PN.PLACES[i] : null;
    return `${labHead('곳을 골라 한두 마디 듣기')}
      ${seg('곳', PN.PLACES.map((x, k) => [k, `${PI(x.id)}${k + 1}. ${esc(x.ko)}`]), i == null ? '' : i, 'stop')}
      ${p ? `<ul class="qlist">${PN.PLACEQ[p.id].map(id => { const q = PN.simQ(id, D); return `<li>${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span><span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span><small>${SHI(q.shape)} ${esc(q.ko)}</small></span></li>`; }).join('')}</ul>
        ${PN.ME_FIRST[p.id] ? '<p class="note">이 전화는 내가 걸어요. 상대가 How can I help you? 하고 물으면 용건을 첫마디에 → <span lang="en">Hi, I\'d like to make a reservation for Friday, please.</span> · <span lang="en">Hi, I\'m calling to ask about your swimming lessons.</span></p>' : ''}${clearBtn}` : '<p class="note">곳을 고르면 그곳에서 자주 듣는 말을 들을 수 있고, 영상 화면의 통화 목록에도 표시돼요. 하늘색 → 열쇠 낱말. 보라색 테두리의 곳(예약 전화 · 문의 전화)에서는 내가 먼저 말을 꺼내요. 식당 · 스포츠 센터 · 사람 이름 · 전화번호(555-01XX) · 시간 · 값은 모두 지어낸 예시예요.</p>'}`;
  },
  book: () => {
    const r = LAB.book, C = Object.assign({}, D, { day: r.day, meal: r.meal, ppl: r.ppl });
    const a1 = OT(BOOK_HOW[r.how], r.day), j1 = PN.judge(PN.Q.bk_help, a1, C, '상황');
    const a2 = OT('ml_pl', r.meal), j2 = PN.judge(PN.Q.bk_meal, a2, C, '상황');
    const a3 = OT('pp_for', r.ppl), j3 = PN.judge(PN.Q.bk_ppl, a3, C, '상황');
    return `${labHead('첫마디에 용건 — make a reservation')}
      ${row('요일', seg('요일', Object.keys(PN.DAYS).map(k => [k, esc(PN.DAYS[k].ko)]), r.day, 'bd'))}
      ${row('말하는 방법', seg('말하는 방법', [['ok', '부탁 틀 (make a reservation)'], ['rsv', '‘예약하다’를 reserve로'], ['half', '용건 빠짐 (calling about)'], ['blunt', '명령 (Give me)']], r.how, 'bh'))}
      ${qLine(PN.Q.bk_help)}${meLine(a1)}${verdictHTML(j1)}${sayLine(PN.Q.bk_help, reactEn(PN.Q.bk_help, j1, a1, C))}
      <p class="note">얼굴이 안 보이는 전화에서는 무엇을 하려는지 첫마디에 말해요 → <span lang="en">Hi, I'd like to make a reservation for ${esc(PN.DAYS[r.day].t)}, please.</span> reserve 뒤에는 요일이 아니라 자리(a table)가 와요.</p>
      ${row('식사', seg('식사', Object.keys(PN.MEALS).map(k => [k, esc(PN.MEALS[k].ko)]), r.meal, 'bm'))}
      ${qLine(PN.Q.bk_meal)}${meLine(a2)}${verdictHTML(j2)}
      ${row('사람 수', seg('사람 수', Object.keys(PN.PPL).map(k => [k, esc(PN.PPL[k].ko)]), r.ppl, 'bp'))}
      ${qLine(PN.Q.bk_ppl)}${meLine(a3)}${verdictHTML(j3)}${meLine(OT('pp_lit', r.ppl), '듣기 (어색한 말)')}
      <p class="note">사람 수는 For + 수 → <span lang="en">For ${esc(PN.PPL[r.ppl].t)}, please.</span> ‘우리는 ○명이에요’를 We are …로 옮기면 어색해요. 고른 것은 영상 화면의 예약 메모에도 그려져요.</p>
      <h3 class="mt">빠른 말은 들린 만큼 되묻기</h3>${qLine(PN.Q.bk_fast)}${meLine(OT('rp_place'))}
      <p class="note">‘Lantern Bistro …’만 들렸으면 짐작하지 말고 들린 낱말로 되물어요 → <span lang="en">Sorry, is this Lantern Bistro?</span></p>${S.book ? clearBtn : ''}`;
  },
  time: () => {
    const r = LAB.time, C = Object.assign({}, D, { meal: r.meal, want: PN.WANT[r.meal], alt: r.alt, offer: r.offer }), q0 = PN.simQ('tm_full', C);
    const a0 = LAB.full.a === 'fl_alt' ? OT('fl_alt', r.alt) : OT(LAB.full.a), j0 = PN.judge(q0, a0, C, '상황');
    const t = PN.offerOf(C), tr = PN.timeTrap(t), q = PN.simQ('tm_offer', C);
    const OPTS = [['ok', OT('of_so', t)], ['swap', OT('of_so', tr)], ['skip', OT('of_ok')]];
    let res = '';
    if (r.a) { const a = OPTS.find(o => o[0] === r.a)[1], j = PN.judge(q, a, C, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(q, reactEn(q, j, a, C))}`; }
    return `${labHead('자리가 다 찼을 때 · 빈 시각 되짚기')}
      ${row('식사', seg('식사', Object.keys(PN.MEALS).map(k => [k, `${esc(PN.MEALS[k].ko)} (${PN.WANT[k]}시)`]), r.meal, 'tm'))}
      ${row('괜찮은 시간', seg('괜찮은 시간', Object.keys(PN.ALTS).map(k => [k, esc(PN.ALTS[k].ko)]), r.alt, 'ta'))}
      ${qLine(q0)}
      ${seg('대답', FULL_OPTS.map(([k, x]) => [k, esc(x)]), LAB.full.a, 'tf')}
      ${meLine(a0)}${verdictHTML(j0)}${sayLine(q0, reactEn(q0, j0, a0, C))}
      <p class="note">다 찼다는 안내에는 알겠다고만 하지 말고, 다른 시간이 있는지 질문으로 물어요 → <span lang="en">Oh, I see. Do you have anything ${esc(PN.ALTS[r.alt].t)}?</span> 자리가 비었는지는 possible이 아니라 <span lang="en">Do you have …?</span> · available로 물어요.</p>
      <h3 class="mt">빈 시각 듣고 되짚기</h3>
      ${row('빈 시각', seg('빈 시각', PN.OFFERS[r.meal][r.alt].map((x, k) => [k, x]), r.offer, 'to'))}
      ${qLine(q)}
      ${seg('대답', OPTS.map(([k, a]) => [k, `<span lang="en">${esc(PN.text(a))}</span>`]), r.a || '', 'tr')}
      ${res}
      ${pairList()}
      <p class="note">${esc(t)} → <span lang="en">${esc(PN.timeWords(t))}</span>(뒤를 세게) · ${esc(tr)} → <span lang="en">${esc(PN.timeWords(tr))}</span>(앞을 세게). 들은 시각은 되짚어 확인해요 → <span lang="en">So, ${esc(t)}?</span> 고른 시각은 영상 화면의 예약 메모에도 그려져요.</p>
      <h3 class="mt">빠른 말은 들린 만큼 되묻기</h3>${qLine(PN.Q.tm_fast)}${meLine(OT('rp_time'))}${S.time ? clearBtn : ''}`;
  },
  name: () => {
    const r = LAB.spell, n = PN.NAMES[r.sur], C = Object.assign({}, D, { sur: r.sur, hok: r.hok });
    const a1 = OT('nm_is', r.sur), j1 = PN.judge(PN.Q.nm_name, a1, C, '상황');
    const a2 = r.how === 'ok' ? OT('sp_it', r.sur) : r.how === 'wrong' ? OT('sp_it', r.sur + '~w') : r.how === 'sp_name' ? OT('sp_name', r.sur) : OT('g_yesp'), j2 = PN.judge(PN.Q.nm_spell, a2, C, '상황');
    const q = PN.simQ('nm_check', C), OPTS = [['no', OT('ck_no', n.L)], ['isnt', OT('ck_isnt', n.L)], ['bare', OT('g_no')], ['yes', OT('ck_yes')]];
    let res = '';
    if (r.a) { const a = OPTS.find(o => o[0] === r.a)[1], j = PN.judge(q, a, C, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(q, reactEn(q, j, a, C))}`; }
    return `${labHead('이름 철자 — 글자 + as in')}
      ${row('내 성', seg('내 성', PN.SUR_IDS.map(k => [k, `${esc(PN.NAMES[k].t)} (${esc(PN.NAMES[k].ko)})`]), r.sur, 'ns'))}
      ${qLine(PN.Q.nm_name)}${meLine(a1)}${verdictHTML(j1)}
      ${qLine(PN.Q.nm_spell)}
      ${seg('말하는 방법', SPELL_OPTS.map(([k, x]) => [k, esc(x)]), r.how, 'nh')}
      ${meLine(a2)}${verdictHTML(j2)}${sayLine(PN.Q.nm_spell, reactEn(PN.Q.nm_spell, j2, a2, C))}
      <p class="note">${esc(n.t)} → <span lang="en">${esc(n.spell)}</span>. 전화에서는 ${n.L}와 ${n.alt}처럼 헷갈리는 글자가 있어요. 헷갈리는 글자에는 흔한 이름을 붙여요 → <span lang="en">${esc(PN.asIn(n.L))}</span>.</p>
      ${alphaList()}
      <h3 class="mt">직원이 되짚은 철자</h3>
      ${row('되짚은 글자', seg('되짚은 글자', [['0', `잘못 (${n.alt} as in ${esc(PN.AS[n.alt])})`], ['1', `맞게 (${n.L} as in ${esc(PN.AS[n.L])})`]], r.hok ? '1' : '0', 'nk'))}
      ${qLine(q)}
      ${seg('대답', OPTS.map(([k, a]) => [k, `<span lang="en">${esc(PN.text(a))}</span>`]), r.a || '', 'na')}
      ${res}
      <p class="note">맞게 되짚었으면 → <span lang="en">Yes, that's right.</span> 잘못 되짚었으면 맞는 글자를 다시 → <span lang="en">No, ${esc(PN.asIn(n.L))}.</span> Was that …? 질문의 짝은 was예요(No, it wasn't.). 고른 대답은 영상 화면의 철자 카드에도 그려져요.</p>${S.spell ? clearBtn : ''}`;
  },
  ask: () => {
    const k = LAB.ask, C0 = Object.assign({}, D, { topic: k.topic }), a0 = k.a === 'nd_qhalf' ? OT('nd_qhalf') : OT(k.a, k.topic), j0 = PN.judge(PN.Q.as_help, a0, C0, '상황');
    const r = LAB.info, C = Object.assign({}, D, { lvl: r.lvl }), q = PN.simQ('as_info', C);
    const OPTS = [['ok', OT('in_so', r.lvl)], ['p', OT('in_so', r.lvl + '~p')], ['d', OT('in_so', r.lvl + '~d')], ['skip', OT('in_ok')]];
    let res = '';
    if (r.a) { const a = OPTS.find(x => x[0] === r.a)[1], j = PN.judge(q, a, C, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(q, reactEn(q, j, a, C))}`; }
    const s = LAB.shape, sq = s.q ? PN.simQ(s.q, D) : null;
    let sres = '';
    if (sq && s.pick) sres = `<p class="verdict"><b class="${s.pick === sq.shape ? 'c-ok' : 'c-no'}">${s.pick === sq.shape ? '맞아요' : '다시 보세요'}</b>${esc(`${PN.SHAPE[sq.shape].ko} → ${PN.sayOf(sq.intent)}. 대답 → ${PN.SHAPE[sq.shape].ans}.`)}</p>`;
    if (sq && s.yes) { const j = PN.judge(sq, { f: 'g_yesp' }, D, '상황'); sres += `${meLine({ f: 'g_yesp' })}${verdictHTML(j)}`; }
    return `${labHead('묻는 용건은 첫마디에 · 수업 안내 되짚기')}
      ${row('묻고 싶은 것', seg('묻고 싶은 것', Object.keys(PN.TOPICS).map(x => [x, esc(PN.TOPICS[x].ko)]), k.topic, 'at'))}
      ${qLine(PN.Q.as_help)}
      ${seg('대답', ASK_OPTS.map(([x, t]) => [x, esc(t)]), k.a, 'aa')}
      ${meLine(a0)}${verdictHTML(j0)}${sayLine(PN.Q.as_help, reactEn(PN.Q.as_help, j0, a0, C0))}
      <p class="note">묻는 용건도 첫마디에 → <span lang="en">Hi, I'm calling to ask about your ${esc(PN.TOPICS[k.topic].t)}.</span> ‘문의하다’를 inquiry로 옮기면 어색해요(inquiry는 이름씨예요).</p>
      <h3 class="mt">고르는 질문 · 모르는 낱말</h3>${mini('level')}
      ${qLine(PN.Q.as_level)}${meLine(OT('rp_wint'))}${sayLine(PN.Q.as_level, repairLine('what', PN.Q.as_level, {}))}${meLine(OT('lv_pl', 'int'))}
      <p class="note">모르는 낱말은 짐작하지 말고 물어요 → <span lang="en">Sorry, what does intermediate mean?</span> intermediate → 조금 할 줄 아는 사람의 중간 단계(중급).</p>
      <h3 class="mt">수업 안내 듣고 되짚기</h3>
      ${row('반', seg('반', PN.LVL_IDS.map(x => [x, `${esc(PN.LEVELS[x].ko)} (${esc(PN.LEVELS[x].dko)})`]), r.lvl, 'il'))}
      ${qLine(q)}
      ${seg('대답', OPTS.map(([x, a]) => [x, `<span lang="en">${esc(PN.text(a))}</span>`]), r.a || '', 'ia')}
      ${res}
      <p class="note">요일 · 시간 · 값을 그대로 되짚어요. 값은 -teen과 -ty가 헷갈리기 쉬워요(fourTEEN ↔ FORty). 고른 대답은 영상 화면의 수업 카드에도 그려져요. 수업 · 값은 지어낸 예시예요.</p>
      <h3 class="mt">빠른 말은 들린 만큼 되묻기</h3>${qLine(PN.Q.as_fast)}${meLine(OT('rp_info'))}
      <h3 class="mt">질문의 모양 맞히기</h3>
      <p class="note">상대의 말을 고르고, 모양을 맞혀 보세요. 그다음 <span lang="en">Yes, please.</span>로 대답하면 어떻게 되는지 규칙 엔진에 물어봐요. 고른 말은 영상 화면에도 그려져요.</p>
      ${seg('상대의 말', PN.SHAPE_QS.map(id => { const x = PN.simQ(id, D); return [id, `<span lang="en">${esc(x.short && /\?$|!$/.test(x.short) ? x.short : x.en)}</span>`]; }), s.q || '', 'sq')}
      ${sq ? `<h3 class="mt">이 말의 모양은?</h3>${seg('모양', ['yn', 'or', 'wh', 'note'].map(sh => [sh, SHI(sh)]), s.pick || '', 'sp')}
        <div class="tg-acts mt8"><button type="button" class="btn ghost" id="shapeYes">Yes, please.로 대답해 보기</button>${lpBtn(staffSeq(sq), '상대의 말 듣기')}</div>${sres}` : ''}${S.info || S.shape ? clearBtn : ''}`;
  },
  msg: () => {
    const r = LAB.line, C = Object.assign({}, D, { lvl: r.lvl, phone: r.phone }), a = PN.L(r.words.slice(), PN.fullName(C));
    let res = '';
    if (r.words.length) { const j = PN.judge(PN.Q.ms_go, a, C, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(PN.Q.ms_go, PN.fixLine(a.line, C).en)}`; }
    return `${labHead('메시지 한 줄 — 누구 · 무슨 일 · 부탁 · 번호')}
      ${qLine(PN.Q.ms_out)}${meLine(OT('g_yesp'))}${meLine(OT('ms_lit'), '듣기 (어색한 말)')}
      <p class="note">Would you like to leave a message?에는 → <span lang="en">Yes, please.</span> Please leave a message.는 상대에게 메시지를 남기라는 말이 돼요.</p>
      ${row('반', seg('반', PN.LVL_IDS.map(x => [x, esc(PN.LEVELS[x].ko)]), r.lvl, 'ml'))}
      ${row('내 번호', seg('내 번호', PN.PHONES.map(p => [p, `555-${p}`]), r.phone, 'mp'))}
      ${qLine(PN.Q.ms_go)}
      <p class="note">조각을 누르는 차례대로 문장이 돼요. 일부러 Here is · Tell him 조각이나 끝 두 자리를 바꾼 번호를 고르거나, 누구인지를 빼거나, 차례를 바꿔 보세요.</p>
      ${lineRows(C, r.words, 'lw')}${res}
      <div class="tg-acts mt8"><button class="btn ghost" type="button" id="lineClear">처음부터</button>${S.line ? clearBtn : ''}</div>
      <p class="note">차례(누구 → 무슨 일 → 부탁 → 번호)는 자주 쓰는 꼴을 단순하게 줄인 규칙이에요. 틀리거나 빠진 조각이 있으면 상대는 그 조각만 다시 물어요(<code>PN.fixLine</code>). 번호까지 말하면 ‘연락할 번호’ 질문을 건너뛰어요. 만든 한 줄은 영상 화면의 메시지 메모에도 그려져요.</p>
      <h3 class="mt">빠른 말은 들린 만큼 되묻기</h3>${qLine(PN.Q.ms_fast)}${meLine(OT('rp_msg'))}`;
  },
  number: () => {
    const r = LAB.num, C = Object.assign({}, D, { phone: r.phone, pok: r.pok }), q = PN.simQ('nb_check', C);
    const OPTS = [['no', OT('nc_no', r.phone)], ['wasnt', OT('nc_wasnt', r.phone)], ['bare', OT('g_no')], ['yes', OT('nc_yes')]];
    let res = '';
    if (r.a) { const a = OPTS.find(o => o[0] === r.a)[1], j = PN.judge(q, a, C, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(q, reactEn(q, j, a, C))}`; }
    const X = AUX_SET[LAB.aux.k], aq = PN.simQ(X.q, Object.assign({}, D, X.card)), XC = Object.assign({}, D, X.card);
    let ares = '';
    if (LAB.aux.a != null) { const [af, av] = X.a[LAB.aux.a], a = OT(af, av), j = PN.judge(aq, a, XC, '상황'); ares = `${meLine(a)}${verdictHTML(j)}`; }
    const ph = PN.phoneText(r.phone);
    return `${labHead('전화번호 — 하나씩 · 되짚은 번호 바로잡기')}
      ${mini('number')}
      <p class="note">${esc(ph)} → <span lang="en">${esc(PN.phoneWords(ph))}</span>. 숫자는 하나씩, 0은 oh, 묶음 사이에서 잠깐 쉬어요. ‘핸드폰’은 한국에서 만든 말이에요 → cell phone(미국) · mobile(영국).</p>
      ${row('내 번호', seg('내 번호', PN.PHONES.map(p => [p, `555-${p}`]), r.phone, 'pp'))}
      ${row('직원이 되짚은 번호', seg('되짚은 번호', [['0', `잘못 (555-${PN.phoneSwap(r.phone)})`], ['1', `맞게 (555-${r.phone})`]], r.pok ? '1' : '0', 'pk'))}
      ${qLine(q)}
      ${seg('대답', OPTS.map(([k, a]) => [k, `<span lang="en">${esc(PN.text(a))}</span>`]), r.a || '', 'pa')}
      ${res}
      <p class="note">끝 두 자리를 바꿔 읽기 쉬워요. 잘못 되짚었으면 짝 맞는 짧은 대답 + 맞는 번호 → <span lang="en">No, it isn't. It's ${esc(ph)}.</span> 고른 대답은 영상 화면의 번호 카드에도 그려져요.</p>
      <h3 class="mt">Yes/No 질문은 첫 낱말로 짝 맞추기</h3>
      ${row('질문', seg('질문', AUX_SET.map((x, k) => [k, esc(x.ko)]), LAB.aux.k, 'xk'))}
      ${qLine(aq)}<p class="note"><span lang="en">${esc(PN.AUX[aq.aux].q)}</span> → <span lang="en">${esc(PN.AUX[aq.aux].a)}</span> · 사실: ${esc(X.fact)}</p>
      ${seg('대답', X.a.map(([af, av], k) => [k, `<span lang="en">${esc(PN.text(OT(af, av)))}</span>`]), LAB.aux.a == null ? '' : LAB.aux.a, 'xa')}
      ${ares}
      <h3 class="mt">빠른 말은 들린 만큼 되묻기</h3>${qLine(PN.Q.nb_fast)}${meLine(OT('rp_nb'))}${S.num || S.aux ? clearBtn : ''}`;
  },
  call: () => {
    const r = LAB.card, C = Object.assign({}, D, { given: r.given, lvl: r.lvl, item: r.item }), first = PN.LEVELS[r.lvl].first, b = `${r.item}.${first}`;
    const hq = PN.simQ('cb_hi', C), bq = PN.simQ('cb_bring', C), ha = OT('cb_sp'), hj = PN.judge(hq, ha, C, '상황');
    const OPTS = [['ok', OT('br_so', b)], ['day', OT('br_so', `${r.item}.${PN.dayTrap(first)}`)], ['skip', OT('br_ok')]];
    let res = '';
    if (r.a) { const a = OPTS.find(o => o[0] === r.a)[1], j = PN.judge(bq, a, C, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(bq, reactEn(bq, j, a, C))}`; }
    return `${labHead('걸려 온 전화 — 받기 · 준비물 되짚기 · 끝인사')}
      ${row('내 이름', seg('내 이름', PN.GIVEN.map(x => [x, `${esc(x)} (${esc(PN.GIVEN_KO[x])})`]), r.given, 'cg'))}
      ${qLine(hq)}${meLine(ha)}${verdictHTML(hj)}${sayLine(hq, reactEn(hq, hj, ha, C))}${meLine(OT('cb_who'), '듣기 (퉁명스러운 말)')}
      <p class="note">나를 찾는 전화가 맞으면 → <span lang="en">Yes, speaking.</span>(네, 전데요) · <span lang="en">Yes, it is.</span> 상대가 이미 이름을 밝혔는데 Who are you?로 물으면 퉁명스럽게 들려요.</p>
      ${row('반', seg('반', PN.LVL_IDS.map(x => [x, `${esc(PN.LEVELS[x].ko)} (첫 수업 ${esc(PN.WDAYS[PN.LEVELS[x].first].ko)})`]), r.lvl, 'cl'))}
      ${row('준비물', seg('준비물', PN.BRING_IDS.map(x => [x, esc(PN.BRINGS[x].ko)]), r.item, 'ci'))}
      ${qLine(bq)}
      ${seg('대답', OPTS.map(([k, a]) => [k, `<span lang="en">${esc(PN.text(a))}</span>`]), r.a || '', 'ca')}
      ${res}
      <p class="note">준비물과 첫 수업 요일을 그대로 되짚어요. 같은 반의 다른 요일(${esc(PN.WDAYS[PN.dayTrap(first)].ko)})과 헷갈리기 쉬워요. 고른 대답은 영상 화면의 준비물 메모에도 그려져요.</p>
      <h3 class="mt">소리가 끊길 때</h3>${qLine(PN.Q.cb_cut)}${meLine(OT('rp_break'))}
      <h3 class="mt">끝인사</h3>${qLine(PN.Q.cb_end)}${meLine(OT('en_no'))}
      <p class="note">더 물어볼 것이 없으면 → 없다는 대답 + 고맙다는 말 + 끝인사. <span lang="en">Okay. Bye.</span>로 끊으면 퉁명스럽게 들려요.</p>${S.card ? clearBtn : ''}`;
  },
  method: () => {
    const i = S.place, rw = i != null ? PN.METHOD[i] : null;
    return `${labHead('곳마다 3단계 적용해 보기')}
      ${seg('곳', PN.METHOD.map(([qid], k) => [k, `${PI(PN.Q[qid].place)}${esc(PN.PLACE[PN.Q[qid].place].ko)}`]), i == null ? '' : i, 'place')}
      ${rw ? (() => { const [qid, a, c] = rw, q = PN.simQ(qid, Object.assign({}, D, c || {})), j = PN.judge(q, a, Object.assign({}, D, c || {})); return `<p class="enline">${lpBtn(staffSeq(q), '듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
        <ol class="edr-steps"><li><b>① 열쇠 낱말 + 모양</b> ${esc(q.key.join(' … '))} → ${SHI(q.shape)} ${esc(PN.sayOf(q.intent))}</li><li><b>② 틀 + 내 정보</b> <span lang="en">${segHTML(a)}</span> ${esc(PN.ko(a))}</li><li><b>③ 공손하게</b> ${esc(j.why)}</li></ol>
        <p class="enline">${lpBtn(staffSeq(q).concat(meSeq(a).map((x, k) => k ? x : Object.assign({}, x, { gap: 0.5 }))), '대화 듣기')}<span>대화 듣기</span></p>
        ${clearBtn}`; })() : '<p class="note">곳을 고르면 영상 화면의 그 줄이 켜지고, 세 단계를 글로 보여 줘요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>대화 골라 보기</h3>
    <div class="seg">${PNS.PSEG.map((t, i) => `<button type="button" data-seek="${t + 0.4}">대화 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 해 보고 싶다면 아래 <a href="#playground">전화 시뮬레이터</a>에서 내 카드로 식당 예약부터 코치의 전화까지 해 보세요. 카드는 누를 때마다 새로 만들어져요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">전화 시뮬레이터</a> — 내 카드로 식당 예약 · 이름 철자 · 수영 강습 문의 · 메시지 · 번호 · 걸려 온 전화(메시지 한 줄도)</li><li><a href="#shadow">전화 표현 따라 말하기</a> — ${PN.SHADOW.length}문장 듣고 따라 하기</li>
    <li><a href="#drill">듣고 대답 고르기</a> — 일곱 곳 ${PN.DRILL.length}문제, 3단계 힌트</li><li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.querySelectorAll('.lmini').forEach(m => TDrill(m, [PN.MINI[m.dataset.mini]], { compact: true, onAnswer() { if (playing) pause(); } }));
}
function showAt(u) { const ch = CHAPTERS[PNS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const relab = () => { touch(); buildLab(PNS.chapterAt(T)); };
// 직접 해 보기 상태 → 영상 화면 상태
const syncBook = () => { S.book = Object.assign({}, LAB.book); };
const syncTime = () => { const r = LAB.time; S.time = { meal: r.meal, alt: r.alt, offer: r.offer, a: r.a || 'ok' }; };
const syncSpell = () => { const r = LAB.spell; S.spell = { sur: r.sur, hok: r.hok, a: r.a || (r.hok ? 'yes' : 'no') }; };
const syncInfo = () => { S.info = { lvl: LAB.info.lvl, a: LAB.info.a || 'ok' }; S.shape = null; };
const syncShape = () => { S.shape = LAB.shape.q || null; };
const syncLine = () => { const r = LAB.line; S.line = { words: r.words.slice(), lvl: r.lvl, phone: r.phone }; };
const syncNum = () => { const r = LAB.num; S.num = { phone: r.phone, pok: r.pok, a: r.a || (r.pok ? 'yes' : 'no') }; S.aux = null; };
const syncAux = () => { const X = AUX_SET[LAB.aux.k], A = LAB.aux.a != null ? X.a[LAB.aux.a] : null; S.aux = A ? { q: X.q, a: A[0], v: A[1], card: X.card } : null; };
const syncCard = () => { const r = LAB.card; S.card = { given: r.given, lvl: r.lvl, item: r.item, a: r.a || 'ok' }; };
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  const d = b.dataset;
  if (d.seek) { seek(CHAPTERS[PNS.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') {
    ['stop', 'place', 'book', 'time', 'spell', 'info', 'shape', 'line', 'num', 'aux', 'card'].forEach(k => { S[k] = null; });
    Object.assign(LAB, JSON.parse(LAB0));
    relab(); return;
  }
  if (d.stop != null) { S.stop = d.stop === '' ? null : +d.stop; showAt(18.8); relab(); return; }
  // 02장 예약 전화
  if (d.bd) { LAB.book.day = d.bd; syncBook(); relab(); return; }
  if (d.bh) { LAB.book.how = d.bh; syncBook(); relab(); return; }
  if (d.bm) { LAB.book.meal = d.bm; syncBook(); relab(); return; }
  if (d.bp) { LAB.book.ppl = +d.bp; syncBook(); relab(); return; }
  // 03장 시간 맞추기 (다 찼을 때의 대답은 영상 화면을 바꾸지 않아요) · 빈 시각 되짚기
  if (d.tm) { LAB.time.meal = d.tm; LAB.time.offer = 0; syncTime(); relab(); return; }
  if (d.ta) { LAB.time.alt = d.ta; LAB.time.offer = 0; syncTime(); relab(); return; }
  if (d.tf) { LAB.full.a = d.tf; relab(); return; }
  if (d.to != null) { LAB.time.offer = +d.to; syncTime(); relab(); return; }
  if (d.tr) { LAB.time.a = d.tr; syncTime(); relab(); return; }
  // 04장 이름 철자
  if (d.ns) { LAB.spell.sur = d.ns; LAB.spell.a = null; syncSpell(); relab(); return; }
  if (d.nh) { LAB.spell.how = d.nh; relab(); return; }
  if (d.nk != null) { LAB.spell.hok = d.nk === '1'; LAB.spell.a = null; syncSpell(); relab(); return; }
  if (d.na) { LAB.spell.a = d.na; syncSpell(); relab(); return; }
  // 05장 문의 전화 (첫마디 대답은 영상 화면을 바꾸지 않아요) · 수업 안내 · 질문의 모양
  if (d.at) { LAB.ask.topic = d.at; relab(); return; }
  if (d.aa) { LAB.ask.a = d.aa; relab(); return; }
  if (d.il) { LAB.info.lvl = d.il; syncInfo(); relab(); return; }
  if (d.ia) { LAB.info.a = d.ia; syncInfo(); relab(); return; }
  if (d.sq) { LAB.shape = { q: d.sq, pick: null, yes: false }; syncShape(); relab(); return; }
  if (d.sp) { LAB.shape.pick = d.sp; syncShape(); relab(); return; }
  if (b.id === 'shapeYes') { LAB.shape.yes = true; syncShape(); relab(); return; }
  // 06장 메시지 한 줄
  if (d.ml) { LAB.line = { lvl: d.ml, phone: LAB.line.phone, words: [] }; syncLine(); relab(); return; }
  if (d.mp) { LAB.line = { lvl: LAB.line.lvl, phone: d.mp, words: [] }; syncLine(); relab(); return; }
  if (d.lw) { LAB.line.words = toggleWord(LAB.line.words, d.lw); syncLine(); relab(); return; }
  if (b.id === 'lineClear') { LAB.line.words = []; syncLine(); relab(); return; }
  // 07장 전화번호 · Yes/No의 짝
  if (d.pp) { LAB.num.phone = d.pp; LAB.num.a = null; syncNum(); relab(); return; }
  if (d.pk != null) { LAB.num.pok = d.pk === '1'; LAB.num.a = null; syncNum(); relab(); return; }
  if (d.pa) { LAB.num.a = d.pa; syncNum(); relab(); return; }
  if (d.xk != null) { LAB.aux = { k: +d.xk, a: null }; syncAux(); relab(); return; }
  if (d.xa != null) { LAB.aux.a = +d.xa; syncAux(); relab(); return; }
  // 08장 걸려 온 전화
  if (d.cg) { LAB.card.given = d.cg; syncCard(); relab(); return; }
  if (d.cl) { LAB.card.lvl = d.cl; LAB.card.a = null; syncCard(); relab(); return; }
  if (d.ci) { LAB.card.item = d.ci; LAB.card.a = null; syncCard(); relab(); return; }
  if (d.ca) { LAB.card.a = d.ca; syncCard(); relab(); return; }
  if (d.place != null) { S.place = d.place === '' ? null : +d.place; showAt(3.8); relab(); }
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   영어 속 전화번호 · 시각 · 값 · 철자는 영어 낱말로(555-0139 → five-five-five, oh-one-three-nine, 8:15 → eight-fifteen, $40 → forty dollars, H-A-N → H, A, N)
   세게 말하는 곳을 대문자로 적은 낱말(fifTEEN · FIFty · DINner)은 소문자로 읽어요
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/\b\d{3}-\d{4}\b|\b\d{1,2}:\d{2}\b|\$\d+|\b[A-Z](?:-[A-Z])+\b|\b(?:at|from) \d{1,2}(?: to \d{1,2})?\b/g, m => PN.spoken(m)],
    [/\b(?=[A-Za-z]*[a-z])(?=[A-Za-z]*[A-Z]{2})[A-Za-z]+\b|\bLUNCH\b/g, m => m.toLowerCase()],
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
   10. 놀이터 — 전화 시뮬레이터
   식당에 전화(내가 먼저 용건) → 점심 · 저녁 → 사람 수 → 몇 시 → 다 참(다른 시간 묻기) → 빈 시각 되짚기 → 이름 · 철자(as in) · 되짚은 철자 바로잡기
   → 스포츠 센터에 문의 전화(내가 먼저 용건) → 반 고르기 → 수업 안내 되짚기 → 코치가 없음(메시지) → 메시지 한 줄 → 번호 · 되짚은 번호 바로잡기
   → 코치의 전화 받기 → 준비물 · 첫 수업 요일 되짚기 → 끝인사.
   빈 시각 · 수업 안내 · 준비물은 내 카드에 없어요 — 상대가 말한 것을 듣고 되짚어야 해요. 메시지는 조각 칩으로 한 줄을 만들어요(PN.lineChips → PN.checkLine).
   ========================================================= */
const SIM = { card: null, qs: [], i: 0, frames: [], slots: {}, f: null, v: null, log: [], started: false, script: !PNV.supported, mode: null, react: null, why: null, done: false, listening: false, heard: null, covered: new Set(), skipped: [], line: { words: [] }, chips: [] };
const simQ = () => PN.simQ(SIM.qs[SIM.i], SIM.card);
const simC = () => Object.assign({}, SIM.card, simQ().fact || {});
window.__simCard = () => Object.assign({}, SIM.card);   // 확인용(읽기만): 지금 내 카드
window.__simQ = () => Object.assign({}, simQ());          // 확인용(읽기만): 지금 상대의 말
const keyOf = q => `${q.place}:${q.intent}`;
const skipLabel = ids => ids.map(id => PN.INTENT_KO[PN.Q[id].intent]).filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
const isCovered = q => SIM.covered.has(keyOf(q)) || SIM.covered.has('*:' + q.intent);
const LINE_INTENT = 'go';
const PLACE_INTRO = {
  time: () => '이제 시간을 맞출 차례예요. 가고 싶은 시각이 다 찼으면 알겠다고만 하지 말고 다른 시간이 있는지 질문으로 물어요. 직원이 알려 주는 빈 시각은 카드에 없어요 — 듣고 되짚어요.',
  name: () => '예약자 이름을 알려 줄 차례예요. 철자는 글자를 하나씩, 헷갈리는 글자에는 as in을 붙여요. 직원이 되짚은 철자도 잘 들어요.',
  ask: () => `이번에는 ${PN.CENTER}에 전화했어요. 여기서도 내가 먼저 용건을 말해요 — 수영 강습을 물어요. 요일 · 시간 · 값은 직원이 알려 줘요.`,
  msg: () => `수영 사무실로 돌려 줬는데 ${PN.COACH}가 자리에 없대요. 다시 전화해 달라는 메시지를 남겨요 — 조각 칩으로 한 줄을 만들어요.`,
  number: () => '연락할 번호를 불러 줄 차례예요. 숫자는 하나씩, 0은 oh. 상대가 되짚은 번호도 잘 들어요.',
  call: () => '다음 날 모르는 번호로 전화가 왔어요. 코치가 다시 걸어 준 전화예요. 준비물과 첫 수업 요일은 코치가 알려 줘요.',
};
function simNew() {
  PNV.stop(); stopListening();
  SIM.card = PN.newCard(); SIM.qs = PN.simQs(SIM.card); SIM.i = 0; SIM.log = []; SIM.done = false; SIM.react = null; SIM.why = null; SIM.heard = null;
  SIM.covered = new Set(); SIM.skipped = [];
  simPrep(); simBuild();
}
function simPrep() {
  const q = simQ(), C = simC();
  SIM.slots = {}; SIM.f = null; SIM.v = null; SIM.line = { words: [] }; SIM.chips = [];
  if (q.intent === LINE_INTENT) { SIM.frames = []; SIM.chips = PN.lineChips(C); }
  else {
    SIM.frames = shuffle(PN.simFrames(q.intent, C) || []);
    SIM.frames.forEach(f => { const Fm = PN.FRAME[f]; if (Fm.slot) SIM.slots[f] = PN.slotChoices(Fm.slot, C, Math.random, q); });
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
  if (kind === 'what') return 'Intermediate is the middle level, for people who can already swim a little.';
  return null;
}
function simAnswer(a, spoken) {
  if (SIM.done || !SIM.started) return;
  const q = simQ(), C = simC(), L = SIM.log[SIM.i];
  const j = spoken ? PN.matchSpoken(spoken, q, C) : PN.judge(q, a, C);
  const model = PN.model(q, C);
  SIM.heard = spoken || null;
  if (j.repair) {
    const re = repairLine(j.repair, q, C);
    SIM.react = { en: re || 'Sure. ' + q.en, ko: re ? (j.repair === 'check' ? '상대가 숫자를 확인해 줬어요. 이제 대답해 보세요.' : '상대가 쉬운 말로 알려 줬어요. 이제 대답해 보세요.') : '다시 물었어요. 상대가 천천히 한 번 더 말해요.', st: 'repair', who: whoOf(q) }; SIM.why = null; simBuild();
    simSpeak(re ? [{ text: re, sp: q.sp }] : [{ text: 'Sure.', sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }], { slow: true }); return;
  }
  L.tries.push({ t: spoken ? `(말로) ${spoken}` : PN.text(a), ok: j.ok, stage: j.stage });
  SIM.why = { j, model, spoken: !!spoken };
  if (j.ok) {
    L.final = spoken || PN.text(a);
    (spoken ? (j.covered || [q.intent]) : PN.covered(a, q)).filter(i => i !== q.intent).forEach(i => SIM.covered.add(PN.CROSS[i] ? `*:${i}` : `${q.place}:${i}`));
    const ok = PN.REACT.ok[(SIM.i + L.tries.length) % PN.REACT.ok.length];
    let n = SIM.i + 1; const skip = [];
    while (n < SIM.qs.length && isCovered(PN.Q[SIM.qs[n]])) { skip.push(SIM.qs[n]); n++; }
    SIM.skipped.push(...skip);
    const reply = PN.reply(q, a || model, C);
    if (n >= SIM.qs.length) {
      const bye = reply || 'Bye!';
      SIM.done = true; SIM.react = { en: bye, ko: '모두 마쳤어요! 식당 예약부터 이름 철자 · 수영 강습 문의 · 메시지 · 번호 · 걸려 온 전화까지 해냈어요.', st: 'ok', who: whoOf(q) };
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
    const r = j.stage === 1 ? PN.REACT[1](q) : j.stage === 2 ? PN.REACT[2](q, j, a, C) : j.stage === 3 ? PN.REACT[3](q, j, a) : { en: 'Sorry?', ko: '알아듣지 못했어요.' };
    SIM.react = Object.assign({ st: 'no', who: whoOf(q) }, r);
    if (q.intent !== LINE_INTENT) { SIM.f = null; SIM.v = null; }   // 메시지 한 줄은 틀린 조각만 바꿔 끼우게 그대로 둬요
    simBuild(); simSpeak([{ text: r.en, sp: q.sp }]);
  }
}
const chipT = f => esc(PN.FRAME[f].t.replace(/[{}]/g, '')).replace('___', '<i class="blank">___</i>');
const slotLabel = (f, v) => { const F0 = PN.FRAME[f], x = PN.sv(F0.slot, v); return x ? (x[F0.form || 't'] != null ? x[F0.form || 't'] : x.t) : v; };
// 통화 메모 (HTML) — 시뮬레이터의 끝: 예약 · 이름 · 수업 · 메시지 · 번호 · 준비물
function callHTML(c) {
  const L = PN.LEVELS[c.lvl], n = PN.NAMES[c.sur], t = PN.offerOf(c), first = L.first;
  const rows = [['RESERVATION', `${PN.DAYS[c.day].t.toUpperCase()} ${PN.MEALS[c.meal].t.toUpperCase()} · ${t} · PARTY OF ${c.ppl}`],
    ['NAME', `${PN.fullName(c).toUpperCase()} · ${n.spell} (${n.L} AS IN ${PN.AS[n.L].toUpperCase()})`],
    ['CLASS', `${L.t.toUpperCase()} · ${L.days.replace(' and ', ' & ').toUpperCase()} ${L.from}–${L.to} · $${L.price}/MO`],
    ['MESSAGE', `LEFT FOR ${PN.COACH.toUpperCase()}`],
    ['CALLBACK', PN.phoneText(c.phone)],
    ['BRING', `${PN.BRINGS[c.item].t.replace(/^a /, '').toUpperCase()} · ${PN.WDAYS[first].t.toUpperCase()}`]];
  return `<div class="rcpt" role="img" aria-label="통화 메모"><p class="rc-h">CALL NOTES</p><p class="rc-g">${esc(PN.BISTRO.toUpperCase())} · ${esc(PN.CENTER.toUpperCase())}</p><ul>${rows.map(([k, x]) => `<li><span>${k}</span><b>${esc(x)}</b></li>`).join('')}</ul><p class="rc-t"><span>STATUS</span><b>ALL SET</b></p></div>`
    + '<p class="rc-n">식당 · 스포츠 센터 · 사람 이름 · 전화번호(555-01XX) · 시간 · 값은 모두 지어낸 예시예요.</p>';
}
// 준비물 메모 (캔버스) — 모두 마친 뒤에만 그려요
function drawSimArt(c) {
  const cv2 = $('simArt'); if (!cv2) return;
  const W0 = 380, H0 = 272, d = 2, g = cv2.getContext('2d');
  cv2.width = W0 * d; cv2.height = H0 * d; g.setTransform(d, 0, 0, d, 0, 0);
  g.fillStyle = PNS.COL.bg; g.fillRect(0, 0, W0, H0);
  PNS.bringCard(g, 10, 11, 360, { b: `${c.item}.${PN.LEVELS[c.lvl].first}` });
}
function simBuild() {
  const hear = PNV.supported, C = SIM.card;
  $('simCard').innerHTML = `<p class="tc-head">${PI('id')}<b>내 카드</b> <span lang="en">MY CARD</span></p><dl>${PN.cardRows(C).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="tc-foot">지어낸 식당 · 센터 · 번호(555-01XX) · 빈 시각 · 수업 안내 · 준비물은 카드에 없어요 — 상대가 말하는 것을 들어요</p>`;
  const prog = SIM.qs.map((id, k) => { const L = SIM.log[k], skipped = SIM.skipped.includes(id), c = skipped ? ' skip' : !L || !L.final ? (k === SIM.i && !SIM.done ? ' cur' : '') : L.tries[0] && L.tries[0].ok ? ' ok' : ' late'; return `<li class="${c}" title="${esc(PN.INTENT_KO[PN.Q[id].intent] || '')}${skipped ? ' (건너뜀)' : ''}">${k + 1}</li>`; }).join('');
  $('simProg').innerHTML = prog;
  const box = $('simMain');
  if (!SIM.started) {
    box.innerHTML = `<div class="sim-start"><p>왼쪽 내 카드가 이번 통화들의 사실이에요. 식당에 전화해 예약하고(내가 먼저 용건을 말해요), 다 찬 시간 대신 빈 시각을 듣고 되짚고, 이름 철자를 불러요. 다음에는 스포츠 센터에 수영 강습을 묻고(내가 먼저), 코치에게 메시지를 남기고 번호를 불러요. 마지막으로 코치의 전화를 받아요. 먼저 <b>질문의 모양</b>을 잡고(Yes/No · 고르기 · 정보 · 안내), 대답 틀 칩을 고른 뒤 카드의 정보 칩을 넣어요. 빈 시각 · 수업 안내 · 준비물은 카드에 없으니 <b>상대가 말하는 것</b>을 잘 듣고 되짚으세요. 메시지는 <b>조각 칩</b>으로 한 줄을 만들어요(R 다시 듣기 · S 천천히)${SRC ? ' — 마이크로 말해서 대답할 수도 있어요' : ''}.</p><button type="button" class="btn" id="simGo">식당에 전화 걸기 (Enter)</button></div>`;
    return;
  }
  if (SIM.done) {
    const first = SIM.log.filter(L => L && L.tries[0] && L.tries[0].ok).length, asked = SIM.log.filter(Boolean).length;
    const ml = PN.modelLine(C);
    box.innerHTML = `<div class="sim-end"><div class="end-art">${callHTML(C)}<figure class="sim-map"><canvas id="simArt" role="img" aria-label="준비물 메모: ${esc(PN.bringKo(`${C.item}.${PN.LEVELS[C.lvl].first}`))}"></canvas><figcaption>첫 수업 → ${esc(PN.bringKo(`${C.item}.${PN.LEVELS[C.lvl].first}`))} · <span lang="en">${esc(PN.bringText(`${C.item}.${PN.LEVELS[C.lvl].first}`))}</span></figcaption></figure></div><div><p class="sim-score"><b>${first} / ${asked}</b> 질문을 한 번에 통과했어요.</p>
      <p class="sim-saved">메시지 한 줄 → <span lang="en">${segHTML(ml)}</span> ${lpBtn(meSeq(ml), '메시지 한 줄 듣기')}</p>
      <p class="sim-react ok"><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>
      <ol class="sim-log">${SIM.log.filter(Boolean).map(L => `<li><span class="who">${esc(WHO[L.sp] || '상대')}</span>${lpBtn([{ text: L.en, sp: L.sp }], '듣기')}<span lang="en">${esc(L.en)}</span><br><span class="who me">나</span>${lpBtn(meSeq(L.final), '듣기')}<span lang="en">${esc(L.final)}</span>${L.tries.length > 1 ? ` <small>(${L.tries.length}번째에 통과)</small>` : ''}</li>`).join('')}</ol>
      <div class="tg-acts"><button type="button" class="btn" id="simAgain">새 카드로 다시 (N)</button>${hear ? `<button type="button" class="btn ghost" data-lp="${seqId(SIM.log.filter(Boolean).flatMap(L => [{ text: L.en, sp: L.sp }, { text: L.final, sp: 'me', gap: 0.4 }]))}">대화 전체 듣기</button>` : ''}</div></div></div>`;
    drawSimArt(C);
    return;
  }
  const q = simQ(), show = SIM.script || !hear, line = q.intent === LINE_INTENT;
  let fa = null;
  if (SIM.f) { const Fm = PN.FRAME[SIM.f]; if (!Fm.slot || SIM.v) { fa = { f: SIM.f }; if (Fm.slot) fa.v = SIM.v; } }
  let h = `${lsnBar(SIM.script)}`;
  h += `<div class="sim-officer">${staffSVG(PNS.kindOf(q))}<p class="sim-bub"><span class="who">${esc(whoOf(q))}</span><span class="ldr-t" lang="en">${lineHTML(q.en, show ? keyMarks(q) : [], show)}</span>${show ? SHI(q.shape) : ''}${hear ? `<button type="button" class="lp-play lp-mini" data-simline="1" aria-label="다시 듣기" title="다시 듣기">${SVG_PLAY}</button>` : ''}</p></div>`;
  if (SIM.react) h += `<p class="sim-react ${SIM.react.st}"><span class="who">${esc(SIM.react.who || whoOf(q))}</span><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>`;
  const mic = SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 대답하기 (M)'}</button>` : '';
  if (line) {
    const L = SIM.line, a = PN.L(L.words.slice(), PN.fullName(C));
    h += `<div class="sim-build"><p class="sim-lab">메시지 한 줄 — 누구 → 무슨 일 → 부탁 → 번호 <small>같은 자리의 조각은 바꿔 끼워져요 · Backspace 하나 지우기</small></p>
      ${SIM.chips.map(gr => row(PN.OCAT[gr.c].ko, `<div class="seg">${gr.ids.map(w => `<button type="button" data-sw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(PN.OW[w].t)}</span></button>`).join('')}</div>`)).join('')}
      <div class="sim-ans"><span class="who me">나</span>${L.words.length ? `<span lang="en" class="sim-line">${segHTML(a)}</span>` : '<span class="note">조각을 고르세요. This is + 내 이름 → I\'m calling about … → Could you ask him to call me back → at + 내 번호.</span>'}</div>
      <div class="tg-acts"><button type="button" class="btn" id="simLine"${L.words.length ? '' : ' disabled'}>말하기 (Enter)</button><button type="button" class="btn ghost" id="simLineClear"${L.words.length ? '' : ' disabled'}>지우기</button>${mic}</div></div>`;
  } else {
    h += `<p class="sim-lab">① 대답 틀 <small>1~${SIM.frames.length}</small></p><div class="chips" role="group" aria-label="대답 틀">${SIM.frames.map((f, k) => `<button type="button" class="chipf" data-sf="${f}" aria-pressed="${SIM.f === f}"><small>${k + 1}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}</div>`;
    const Fm = SIM.f ? PN.FRAME[SIM.f] : null;
    if (Fm && Fm.slot) h += `<p class="sim-lab">② 내 정보 넣기 <small>A~C</small></p><div class="chips" role="group" aria-label="칸에 넣을 정보">${SIM.slots[SIM.f].map((v, k) => `<button type="button" class="chips-s" data-sv="${esc(v)}" aria-pressed="${SIM.v === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(slotLabel(SIM.f, v))}</span></button>`).join('')}</div>`;
    h += `<div class="sim-ans"><span class="who me">나</span>${fa ? `<span lang="en" class="sim-line">${segHTML(fa)}</span>` : SIM.f ? `<span lang="en" class="sim-line">${chipT(SIM.f)}</span>` : '<span class="note">틀을 고르세요.</span>'}</div>`;
    h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${fa ? '' : ' disabled'}>대답하기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${SIM.f ? '' : ' disabled'}>지우기</button>${mic}</div>`;
  }
  if (SIM.heard) h += `<p class="note">들린 말: <span lang="en">${esc(SIM.heard)}</span></p>`;
  if (SIM.why) {
    const { j, model } = SIM.why, st = j.ok ? '통과' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸렸어요';
    h += `<div class="sim-why ${j.ok ? 'ok' : 'no'}"><p><b>${esc(st)}</b> ${esc(j.why)}</p>${j.ok ? '' : `<p>모범 대답 ${lpBtn(meSeq(model), '모범 대답 듣기')}<span lang="en">${segHTML(model)}</span> <small>${esc(PN.ko(model))}</small></p>`}${SIM.why.spoken ? '<p class="note">말로 한 대답은 낱말과 카드의 사실(요일 · 시각 · 철자 · 반 · 번호 · 준비물)만 맞춰 봐요. 질문의 모양(yes · no만 했는지)은 보지만, 공손함과 발음은 판정하지 않아요.</p>' : ''}</div>`;
  }
  box.innerHTML = h;
  paintPlay($('sim'), SIM.mode);
}
// 상대 표시 (영상의 avatar와 같은 색): 전화라 얼굴은 보이지 않아요 → 어두운 원 + 수화기 + 목소리 물결
const SPCOL = { us: '#6EC8FF', ca: '#7FE0A8', gb: '#C9A7FF', au: '#FFC15E' };
const staffSVG = kind => {
  const L = PNS.LOOK[kind] || PNS.LOOK.ben, c = SPCOL[L.sp] || '#C8D0DA';
  return `<svg class="sim-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#141C26" stroke="${c}" stroke-width="1.6"/>`
    + `<g transform="translate(11 12) scale(1.05)" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${(PNS.ICON.phone || []).map(([d, m]) => m === 'f' ? `<path d="${d}" fill="${c}" stroke="none"/>` : `<path d="${d}"/>`).join('')}</g>`
    + `<g fill="none" stroke="${c}" stroke-linecap="round" stroke-width="1.8"><path d="M31 13.5a9 9 0 0 1 4.5 6.5" opacity="0.9"/><path d="M33.5 9a14 14 0 0 1 6.5 10" opacity="0.5"/></g></svg>`;
};
function simKeep() { if (!$('sim').contains(document.activeElement) || !document.activeElement.isConnected) $('sim').focus({ preventScroll: true }); }
function simMic() {
  if (!SRC || SIM.done || !SIM.started) return;
  if (SIM.listening) { stopListening(); return; }
  listenOnce({
    onState(on) { SIM.listening = on; simBuild(); simKeep(); },
    onText(alts) { const q = simQ(), C = simC(), best = alts.find(t => PN.matchSpoken(t, q, C).ok) || alts[0]; simAnswer(null, best); simKeep(); },
    onFail(msg) { SIM.react = { en: '…', ko: msg, st: 'no' }; simBuild(); simKeep(); },
  });
}
function simLineSubmit() { const L = SIM.line; if (!L.words.length) return; simAnswer(PN.L(L.words.slice(), PN.fullName(SIM.card))); }
function simSayChips() {
  if (!SIM.f) return;
  const Fm = PN.FRAME[SIM.f]; if (Fm.slot && !SIM.v) return;
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
    if (b.dataset.simline) { simAsk(null, false); return; }
    if (b.dataset.act === 'play') { if (SIM.mode === 'play' && PNV.busy()) PNV.stop(); else simAsk(null, false); return; }
    if (b.dataset.act === 'slowplay') { if (SIM.mode === 'slowplay' && PNV.busy()) PNV.stop(); else simAsk(null, true); return; }
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
    else if (sv >= 0 && SIM.f && PN.FRAME[SIM.f].slot && SIM.slots[SIM.f][sv] != null) { e.preventDefault(); SIM.v = SIM.slots[SIM.f][sv]; simBuild(); simKeep(); return; }
    else if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simSayChips(); simKeep(); return; }
    else if (e.key === 'Backspace') { e.preventDefault(); SIM.f = null; SIM.v = null; simBuild(); simKeep(); return; }
    if (k === 'R' && PNV.supported) { e.preventDefault(); simAsk(null, false); }
    else if (k === 'S' && PNV.supported) { e.preventDefault(); simAsk(null, true); }
    else if (k === 'T' && PNV.supported) { e.preventDefault(); SIM.script = !SIM.script; simBuild(); simKeep(); }
    else if (k === 'M' && SRC) { e.preventDefault(); simMic(); }
    else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
  });
  simNew(); SIM.started = false; simBuild();
}

/* =========================================================
   11. 전화 표현 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 숫자는 15든 fifteen이든 같은 숫자로 맞춰요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = PN.PLACES.map(p => ({ p, rows: PN.SHADOW.map((s, i) => [s, i]).filter(([s]) => s.place === p.id) })).filter(g => g.rows.length);
  $('shList').innerHTML = groups.map(({ p, rows }) => `<section class="sh-grp"><h3>${PI(p.id)}${esc(p.ko)} <span lang="en">${esc(p.en)}</span></h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${PNV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-who ${s.who}">${s.who === 'me' ? '나' : esc(WHO[s.sp] || '직원')}</span><span class="sh-en" lang="en">${esc(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { const s = PN.SHADOW[i]; return [{ text: s.en, sp: s.sp }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = PN.SHADOW[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, PN.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.words.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.t)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}${/Lantern|Kellport|Diaz|Jiwoo|\d|[A-Z]-[A-Z]/.test(s.en) && r.hit < r.total ? ' (이름 · 철자 · 숫자는 음성 인식이 다르게 적기 쉬워요.)' : ''}</p>`);
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${PNV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
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
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (b) b.classList.remove('saying'); if (thenOrig && PNV.supported) speak(shSeq(i)); };
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
        PNS.shapeMark(g, sh, x, 92, 34);
        g.font = qfont(14, 700); g.fillStyle = QCOL.text; g.fillText(PN.SHAPE[sh].ko, x, 150);
        g.font = qfont(12, 500); g.fillStyle = QCOL.muted; g.fillText(PN.SHAPE[sh].mark, x, 172);
      });
    } };
}
// 들은 시각 넷 (A~D) — 숫자 + 세게 말하는 곳(대문자)
function timeFig(label, rows) {
  const Wd = 600, H = 176, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: cellPick(Wd, 4, H, 4),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      rows.forEach(([t, said], k) => {
        const x = k * cw + cw / 2;
        cellBox(g, st, k, k * cw + 8, 8, cw - 16, H - 16);
        qLetter(g, x, 30, k);
        g.font = qfont(11, 700, F.FM); g.fillStyle = QCOL.muted; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TABLE AT', x, 58);
        g.font = qfont(40, 800, F.FM); g.fillStyle = QCOL.text; g.fillText(t, x, 102);
        g.font = qfont(12, 600); g.fillStyle = QCOL.muted; g.fillText(said, x, 146);
      });
    } };
}
// 메시지 한 줄 넷 (2 × 2, A~D) — 줄은 칸 너비에 맞춰 접어요
function lineFig(label, lines) {
  const Wd = 600, cw = 300, ch = 136, H = ch * 2 + 8;
  const wrap = (g, t, w) => { const out = []; let cur = ''; t.split(' ').forEach(wd => { const nx = cur ? cur + ' ' + wd : wd; if (cur && g.measureText(nx).width > w) { out.push(cur); cur = wd; } else cur = nx; }); if (cur) out.push(cur); return out; };
  return { width: Wd, height: H, label,
    pick: (x, y) => x > 0 && x < Wd && y > 4 && y < H - 4 ? Math.min(1, Math.floor(y / ch)) * 2 + Math.min(1, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      lines.forEach((Lw, k) => {
        const x0 = (k % 2) * cw, y0 = Math.floor(k / 2) * ch + 4;
        cellBox(g, st, k, x0 + 6, y0 + 2, cw - 12, ch - 8);
        qLetter(g, x0 + 28, y0 + 26, k);
        g.font = qfont(13.5, 600); g.fillStyle = QCOL.text; g.textAlign = 'left'; g.textBaseline = 'middle';
        wrap(g, PN.lineText(Lw), cw - 66).slice(0, 6).forEach((t, r) => g.fillText(t, x0 + 48, y0 + 22 + r * 19));
      });
    } };
}
// 준비물 메모 넷 (A~D) — 가져갈 것 + 첫 수업 요일
function bringFig(label, ids) {
  const Wd = 600, H = 196, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: cellPick(Wd, 4, H, 4),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      ids.forEach((v, k) => {
        const x = k * cw + cw / 2, b = PN.bringParse(v);
        cellBox(g, st, k, k * cw + 8, 8, cw - 16, H - 16);
        qLetter(g, x, 30, k);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = qfont(11, 700, F.FM); g.fillStyle = QCOL.muted; g.fillText('BRING', x, 56);
        g.font = qfont(13.5, 700); g.fillStyle = QCOL.text; g.fillText('swimsuit', x, 80); g.fillText(b.item === 'cap' ? '+ swim cap' : '+ goggles', x, 100);
        g.font = qfont(11, 700, F.FM); g.fillStyle = QCOL.muted; g.fillText('FIRST CLASS', x, 128);
        g.font = qfont(26, 800, F.FM); g.fillStyle = QCOL.p; g.fillText(b.day.toUpperCase(), x, 158);
      });
    } };
}
const QS = (() => {
  const o = PN.o, j = (q, a, c) => PN.judge(q, a, c || {}).ok;
  const need = [o('nd_qhalf'), o('nd_ask', 'yoga'), o('nd_inq', 'yoga'), o('nd_ask', 'swim')];
  const TC = { meal: 'lunch', alt: 'earlier', offer: 1 }, tq = PN.simQ('tm_offer', TC);
  const TIMES = [['11:13', 'eleven-thirTEEN'], ['1:30', 'one-THIRty'], ['11:30', 'eleven-THIRty'], ['11:03', 'eleven-oh-three']];
  const spell = [o('g_yesp'), o('sp_name', 'park'), o('sp_it', 'park~w'), o('sp_it', 'park')];
  const C5 = { lvl: 'int', phone: '0147', given: 'Minji', sur: 'kim', msg: true }, NM = PN.fullName(C5);
  const lines = [['this', 'aint', 'cab', 'p0174'], ['aint', 'cab', 'p0147'], ['this', 'aint', 'tell', 'p0147'], ['this', 'aint', 'cab', 'p0147']].map(w => PN.L(w, NM));
  const PC = { phone: '0185', pok: false }, pq = PN.simQ('nb_check', PC), pchk = [o('nc_no', '0185'), o('nc_yes'), o('g_no'), o('nc_wasnt', '0185')];
  const what = [o('g_yes'), o('rp_rude'), o('rp_wint'), o('in_ok')];
  const bq = PN.simQ('cb_bring', { item: 'cap', lvl: 'int' }), BR = ['gog.mon', 'cap.wed', 'cap.mon', 'gog.wed'];
  const bring = [o('br_ok'), o('br_so', 'cap.mon'), o('br_so', 'cap.wed'), o('g_yes')];
  const end = [o('en_no'), o('en_plain'), o('rp_rude'), o('g_yes')];
  const q = [
    { q: '스포츠 센터에 전화했어요. Kellport Sports Center, Grace speaking. How can I help you? 요가 수업에 대해 묻고 싶어요. 가장 알맞은 첫마디는?', opts: need.map(PN.text), a: 1,
      why: `얼굴이 안 보이는 전화에서는 용건을 첫마디에 → ${PN.text(need[1])} (A) 물어볼 게 있다는 말만 해서 무엇을 묻는지 몰라요. (C) inquiry는 이름씨(명사)라 want to 뒤에 올 수 없어요. 묻는 용건은 I'm calling to ask about …으로. (D) 요가가 아니라 수영 강습을 물었어요.`,
      check: () => need.map(a => j('as_help', a, { topic: 'yoga' })).join() === 'false,true,false,false' },
    { q: `수영 사무실 → ${PN.Q.ms_out.en} 마지막 질문(Would you like …?)의 모양은? 그림을 누르거나 단추를 고르세요.`, opts: ['A', 'B', 'C', 'D'], a: 0,
      figure: shapeFig('질문의 모양 넷. A Yes/No 질문(스위치), B 고르는 질문(갈림길), C 정보 질문(빈 상자), D 안내(말풍선)'),
      why: 'Would you like …? → Yes/No 질문(스위치)이에요. 권하는 말이라 Yes, please. 하고, 상대가 Go ahead.라고 하면 메시지 한 줄을 말해요. Please leave a message.는 상대에게 메시지를 남기라는 말이 돼요.',
      check: () => PN.Q.ms_out.shape === 'yn' && j('ms_out', o('g_yesp'), { msg: true }) && !j('ms_out', o('ms_lit'), { msg: true }) },
    { q: '점심을 더 이른 시간으로 바꾸려고 해요. 직원 → We have a table at eleven-THIRty. (대문자 = 세게 말하는 곳) 들은 시각은? 시각을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: timeFig(`들은 시각 넷. A ${TIMES[0][0]}, B ${TIMES[1][0]}, C ${TIMES[2][0]}, D ${TIMES[3][0]}`, TIMES),
      why: 'THIRty(앞을 세게) → 30분이라 11:30(C)이에요. thirTEEN(뒤를 세게)이면 11:13(A)이에요. -teen과 -ty는 전화에서 특히 헷갈리니 되짚어 확인해요 → So, 11:30? (B) 1:30은 점심보다 늦은 시간이고, (D) 11:03은 들은 말과 달라요.',
      check: () => tq.fact.time === TIMES[2][0] && PN.timeTrap(TIMES[2][0]) === TIMES[0][0] && j(tq, o('of_so', '11:30'), TC) && !j(tq, o('of_so', '11:13'), TC) },
    { q: '예약자 이름은 박민지(Minji Park)예요. 직원 → Could you spell that for me? 가장 알맞은 대답은?', opts: spell.map(PN.text), a: 3,
      why: `글자를 하나씩, 헷갈리는 글자에는 as in을 붙여요 → ${PN.text(spell[3])} P와 B는 전화에서 헷갈리기 쉬워요. (A) 철자를 불러 달라는 부탁에 Yes만 했어요. (B) 이름만 한 번 더 말했어요. (C) 첫 글자를 B(Bob)로 불렀어요. 내 성은 P(Peter)예요.`,
      check: () => spell.map(a => j('nm_spell', a, { sur: 'park' })).join() === 'false,false,false,true' },
    { q: `코치가 자리에 없어서 메시지를 남겨요. 직원 → Of course. Go ahead. 나는 ${NM}, 중급 반 일로 다시 전화해 달라고 하고 싶어요. 내 번호는 555-0147이에요. 가장 알맞은 한 줄은? 상자를 누르거나 단추를 고르세요.`, opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: lineFig(`메시지 한 줄 넷. A ${PN.lineText(lines[0].line)} B ${PN.lineText(lines[1].line)} C ${PN.lineText(lines[2].line)} D ${PN.lineText(lines[3].line)}`, lines.map(x => x.line)),
      why: '누구 → 무슨 일 → 부탁(질문) → 번호 → (D). (A) 번호의 끝 두 자리를 바꿔 말했어요(0147 → 0174). (B) 누구인지가 빠져서 메시지를 받은 사람이 누구에게 전화해야 할지 몰라요. (C) Tell him …은 명령처럼 들려요. 전해 달라는 부탁도 질문으로 → Could you ask him to call me back?',
      check: () => lines.map(a => j('ms_go', a, C5)).join() === 'false,false,false,true' },
    { q: `내 번호는 555-0185예요. 직원 → ${pq.en} 가장 알맞은 대답은?`, opts: pchk.map(PN.text), a: 0,
      why: `들은 번호가 다르면 짝 맞는 짧은 대답 + 맞는 번호 → ${PN.text(pchk[0])} 끝 두 자리를 바꿔 읽었어요(0185 → 0158). (B) 틀린 번호에 맞다고 했어요. (C) No만 하면 맞는 번호를 알 수 없어요. (D) Is that right? 질문의 짝은 is → No, it isn't.`,
      check: () => pq.fact.heard === '0158' && pchk.map(a => j(pq, a, PC)).join() === 'true,false,false,false' },
    { q: '직원 → Sure. Is that for the beginner class or the intermediate class? intermediate가 무슨 뜻인지 모르겠어요. 가장 알맞은 말은?', opts: what.map(PN.text), a: 2,
      why: '모르는 낱말은 짐작하지 말고 공손하게 물어요 → Sorry, what does intermediate mean? 직원이 쉬운 말로 알려 줄 거예요(조금 할 줄 아는 사람의 중간 단계). (A) 고르는 질문에 Yes만 하면 무엇을 골랐는지 몰라요. (B) What? 한 낱말은 퉁명스럽게 들려요. (D) 아직 반을 고르지 않았는데 고맙다고만 했어요.',
      check: () => what.map(a => j('as_level', a, { lvl: 'int' })).join() === 'false,false,true,false' },
    { q: `코치가 다시 전화했어요. 코치 → ${bq.en} 받아 적은 메모로 맞는 것은? 메모를 누르거나 단추를 고르세요.`, opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: bringFig('준비물 메모 넷. A 수영복 + 물안경 · 월요일, B 수영복 + 수영모 · 수요일, C 수영복 + 수영모 · 월요일, D 수영복 + 물안경 · 수요일', BR),
      why: 'a swimsuit and a swim cap on Monday → 수영복 + 수영모 · 월요일(C). 중급 반은 월 · 수에 있어서 수요일(B · D)과 헷갈리기 쉬워요. 물안경(goggles)이 아니라 수영모(a swim cap)예요.',
      check: () => bq.fact.bring === BR[2] && PN.dayTrap('mon') === 'wed' },
    { q: `코치 → ${bq.en} 제대로 들었는지 확인하려면 가장 알맞은 말은?`, opts: bring.map(PN.text), a: 1,
      why: `들은 준비물과 요일을 그대로 되짚어요 → ${PN.text(bring[1])} (A) 고맙다고만 하면 제대로 들었는지 확인하지 못해요. (C) 요일을 바꿨어요(월 → 수). (D) 안내에 Yes만 하면 무엇을 들었는지 알 수 없어요.`,
      check: () => bring.map(a => j(bq, a, {})).join() === 'false,true,false,false' },
    { q: '통화 끝에 코치 → Is there anything else I can help you with? 더 물어볼 것이 없어요. 가장 알맞은 대답은?', opts: end.map(PN.text), a: 0,
      why: `없다는 대답 + 고맙다는 말 + 끝인사 → ${PN.text(end[0])} (B) 고맙다는 말 없이 끊으면 퉁명스럽게 들려요. (C) What? 한 낱말은 퉁명스러워요. (D) Yes만 하면 더 물어볼 것이 있다는 뜻이 되는데, 무엇인지 말하지 않았어요.`,
      check: () => end.map(a => j('cb_end', a, {})).join() === 'true,false,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[전화] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { if (x.a < 4) pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[전화] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { PNV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = PNS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * PNS.W, (e.clientY - r.top) / r.height * PNS.H]; };
const hitAt = (x, y) => started ? PNS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.stop != null) { S.stop = S.stop === h.stop ? null : h.stop; relab(); }
  else if (h && h.play && PNV.supported) speak(h.play);
  else if (h && h.say && PNV.hasClip('tc', h.say)) speak([{ text: h.say, sp: 'tc' }]);   // 미리 만든 발음(음성 해설의 영어와 같은 목소리)
  else if (h && h.say && EN.say.supported) { stopSounds(); if (playing) pause(); EN.say(PN.spoken(h.say)); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.stop != null ? '눌러서 이곳의 말 보기' : h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { PNV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = PNV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 대화 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 글이 정해진 말만 모아요: 영상의 말풍선 · 발음 칩, 질문(PN.Q), 직접 해 보기(곳 · 3단계 · 예약 · 빈 시각 · 철자 · 수업 안내 · 메시지 한 줄 · 번호 · 준비물은 하나씩 골라 봄),
// 듣고 대답 고르기, 따라 말하기. 전화 시뮬레이터(카드마다 바뀌는 말)와 내가 칩으로 만든 문장은 브라우저 음성이라 빼요.
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text || !/[A-Za-z]/.test(text) || /^\(.*\)$/.test(String(text).trim())) return;   // (지문)은 읽지 않음
    const id = PNV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: PNV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(PNS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 말풍선(그 사람) · 영어 칩(발음 듣기 tc). 곳(map) · 3단계(method) 장은 하나씩 골라 놓고 한 번 더
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return ch ? [ch.t, ch.t + ch.d] : null; };
    const sweeps = [[{}, [0, END]]].concat(PN.PLACES.map((_, k) => [{ stop: k }, span('map')]), PN.METHOD.map((_, k) => [{ place: k }, span('method')])).filter(x => x[1]);
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.25) {
        PNS.render(g, t);
        PNS.hits().forEach(h => { if (h.play) addSeq(h.play, 'video'); else if (h.say) add('tc', h.say, 'video-say'); });
      }
    });
    // 2) 직접 해 보기: 장마다 처음 화면 + 곳 · 3단계는 하나씩 골라서 (듣기 단추에 걸린 말)
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* 그리기만 하는 칸 */ } });
    PN.PLACES.forEach((_, k) => { S.stop = k; try { LABS.map(); } catch (e) { /* */ } });
    S.stop = null;
    PN.METHOD.forEach((_, k) => { S.place = k; try { LABS.method(); } catch (e) { /* */ } });
    S.place = null;
    const tryLab = (k, f) => { try { f(); LABS[k](); } catch (e) { (window.__labErrs = window.__labErrs || []).push(k + ": " + e.message); } };
    Object.keys(PN.DAYS).forEach(day => Object.keys(BOOK_HOW).forEach(how => Object.keys(PN.MEALS).forEach(meal => Object.keys(PN.PPL).forEach(ppl => tryLab('book', () => { LAB.book = { day, how, meal, ppl: +ppl }; })))));
    Object.keys(PN.MEALS).forEach(meal => Object.keys(PN.ALTS).forEach(alt => [0, 1].forEach(offer => ['ok', 'swap', 'skip'].forEach(a => FULL_OPTS.forEach(([f]) => tryLab('time', () => { LAB.time = { meal, alt, offer, a }; LAB.full = { a: f }; }))))));
    PN.SUR_IDS.forEach(sur => SPELL_OPTS.forEach(([how]) => [true, false].forEach(hok => ['no', 'isnt', 'bare', 'yes'].forEach(a => tryLab('name', () => { LAB.spell = { sur, how, hok, a }; })))));
    Object.keys(PN.TOPICS).forEach(topic => ASK_OPTS.forEach(([a]) => tryLab('ask', () => { LAB.ask = { topic, a }; })));
    PN.LVL_IDS.forEach(lvl => ['ok', 'p', 'd', 'skip'].forEach(a => tryLab('ask', () => { LAB.info = { lvl, a }; })));
    PN.SHAPE_QS.forEach(q => tryLab('ask', () => { LAB.shape = { q, pick: null, yes: true }; }));
    // 메시지 한 줄: 모범 줄 · 조각 하나 빠짐 · 차례 바꿈 · 갈래마다 다른 조각으로 바꿔 끼움 (상대의 대답 PN.fixLine)
    PN.LVL_IDS.forEach(lvl => PN.PHONES.forEach(phone => {
      const C = { lvl, phone }, m = PN.lineWords(C);
      const vs = [m, [m[0], m[2], m[3], m[1]], [m[0], m[1], m[3], m[2]], m.slice(1).concat([m[0]])].concat(m.map(w => m.filter(v => v !== w)));
      lineChipsFor(C).forEach(gr => gr.ids.forEach(id => { const k = m.findIndex(w => PN.OW[w].c === gr.c); if (k >= 0 && m[k] !== id) vs.push(m.map((w, i) => i === k ? id : w)); }));
      vs.forEach(words => tryLab('msg', () => { LAB.line = { lvl, phone, words: words.slice() }; }));
    }));
    PN.PHONES.forEach(phone => [true, false].forEach(pok => ['no', 'wasnt', 'bare', 'yes'].forEach(a => tryLab('number', () => { LAB.num = { phone, pok, a }; }))));
    AUX_SET.forEach((X, k) => X.a.forEach((_, a) => tryLab('number', () => { LAB.aux = { k, a }; })));
    PN.GIVEN.forEach(given => PN.LVL_IDS.forEach(lvl => PN.BRING_IDS.forEach(item => ['ok', 'day', 'skip'].forEach(a => tryLab('call', () => { LAB.card = { given, lvl, item, a }; })))));
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 듣고 대답 고르기 · 먼저 골라 보기: 상대의 말 + 보기 넷
  PN.DRILL.concat(Object.values(PN.MINI)).forEach(it => { const Q = it.Q || PN.Q[it.q]; if (Q) addSeq(staffSeq(Q), 'drill'); it.opts.forEach(op => add('me', PN.text(op), 'drill')); });
  // 4) 따라 말하기
  PN.SHADOW.forEach((s0, i) => addSeq(shSeq(i), 'shadow'));
  // 5) 질문 목록의 나머지(상대의 말)
  Object.values(PN.Q).forEach(q => addSeq(staffSeq(q), 'q'));
  return out;
};
simInit();
shInit();
TDrill($('drillRoot'), PN.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 모양 잡기 → 틀 + 내 정보 → 공손하게, 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 03 · 04 · 06장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '식당 예약부터 메시지 · 걸려 온 전화까지 일곱 곳, 철자는 as in · 숫자는 되짚기가 모두 익숙해졌네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(PNS.baseText()).then(() => { dirty = true; });
setTimeout(() => PNS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
