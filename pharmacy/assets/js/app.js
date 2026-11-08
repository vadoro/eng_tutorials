/* 약국 · 병원 회화 — 플레이어, 직접 해 보기, 약국 · 병원 시뮬레이터, 따라 말하기, 듣고 대답 고르기, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(PH), 그림은 scenes.js(PHS), 목소리는 voices.js(PHV)가 맡습니다.
 * 소리가 겹치지 않게: 대화를 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(PHV.play의 before).
 * 약 이름 · 먹는 양 · 값은 모두 지어낸 예시예요. 의학 조언이 아니에요.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const PH = window.PH, PHS = window.PHS, PHV = window.PHV, S = PHS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = PHS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cv = $('cv'), ctx = cv.getContext('2d');
PH.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = PHS.fonts;
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
  const ready = new Promise(res => PHS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '약국 · 병원, 증상은 사실 + 부탁, 복용법은 되짚는다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { PHS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: PHS.iconSVG('mic'),
};
const PI = id => PHS.iconSVG(id, 'pi');   // 곳 아이콘
const SHI = sh => `<span class="shp shp-${sh}">${PHS.iconSVG('shape_' + sh, 'pi')}${esc(PH.SHAPE[sh].ko)}</span>`;   // 질문의 모양 표시
// 듣기 · 천천히 · 대본 보기 단추 묶음 (공항 · 카페 · 호텔 · 식당 · 쇼핑과 같은 모양 · 같은 키 R · S · T)
const lsnBar = scriptOn => PHV.supported
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
  const cap = started ? PHS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 말풍선을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = PHS.chapterAt(T);
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
  if (dirty) { dirty = false; PHS.render(ctx, started ? T : POSTER); }
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
function stopSounds() { EN.say.stop(); PHV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return PHV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름
const lpBtn = (seq, label, cls = '') => PHV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
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
const meSeq = a => [{ text: typeof a === 'string' ? a : PH.text(a), sp: 'me' }];
// 말하는 사람 (목소리마다 한 사람): 약사 en-US · 호주 약국의 약사 en-AU · 병원 접수 직원 en-GB · 의사 en-CA
const WHO = { us: '약사', au: '약사 (호주)', gb: '접수 직원 (영국)', ca: '의사' };
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
const segHTML = (a, on = true) => PH.segs(a).map(s => on && s.t.trim() && /[A-Za-z0-9]/.test(s.t) ? `<mark class="mk-${s.r}">${esc(s.t)}</mark>` : esc(s.t)).join('');
const keyMarks = q => q.key.map(t => ({ t, role: 'key' }));

/* =========================================================
   6. 듣고 대답 고르기 (이 튜토리얼 전용, 대중교통 TDrill과 같은 모양) — 상대의 말은 소리 먼저, 대답 넷은 글
   생김새와 키보드는 공통 부품 EN.drill과 같게: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본 · Enter/→ 다음
   힌트 ①부터 질문의 모양 표시(스위치 · 갈림길 · 빈 상자 · 말풍선)가 상대의 말 옆에 나와요.
   ========================================================= */
function PDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null;
  const compact = !!cfg.compact, hear = PHV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && PHV.busy()) { PHV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(staffSeq(it.Q), { slow: !!slow, onitem() { paintNow(root, '.ldr-q'); say(`${whoOf(it.Q)} · ${it.Q.fast ? '빠르게 말하는 중' : '말하는 중'}`); },
      onend(stopped) { mode = null; paintPlay(root, null); paintNow(root, null); say(stopped ? '' : '다 들었어요. 대답을 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { PHV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; PHV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    PHV.stop();
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = PH.steps(it), place = PH.PLACE[it.place];
    const marks = []; steps.slice(0, done ? 3 : s.hints).reverse().forEach(x => marks.push(...x.marks));   // 뒤 단계의 색이 앞 단계를 덮음
    const reveal = done || !hear || s.script, mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur), showShape = (done || s.hints > 0) && !it.Q.fast;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${PI(it.place)}${esc(place.ko)}</span><span>${compact ? '듣고 대답 고르기' : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span>${done ? `<span class="edr-tag">${it.Q.fast ? '다시 묻기' : esc(PH.SHAPE[it.Q.shape].ko)}</span>` : ''}</p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(it.sit)}</p>`;
    h += lsnBar(done ? null : s.script);
    h += `<p class="ldr-q"><b>${esc(whoOf(it.Q))}</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="q" aria-label="상대의 말 다시 듣기" title="상대의 말 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.Q.en, mk('q'), reveal)}</span>${showShape ? SHI(it.Q.shape) : ''}${it.Q.fast && !done ? '<small class="adr-fast">아주 빠르게</small>' : ''}</p>`;
    h += `<p class="adr-ask">나의 대답은?</p><div class="ldr-opts" role="group" aria-label="대답 보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '', t = PH.text(op);
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-lp="${seqId(meSeq(t))}" aria-label="(${L4[k]}) 듣기" title="(${L4[k]}) 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(t, mk(k), true)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + PH.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = [[`${whoOf(it.Q)} · ${it.Q.en}`, it.Q.ko, staffSeq(it.Q)]].concat(it.opts.map((op, k) => [`(${L4[k]}) ${PH.text(op)}`, PH.ko(op), meSeq(op)]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      h += `<div class="edr-acts">${hear ? `<button type="button" class="edr-btn ghost adr-ex" data-lp="${seqId(staffSeq(it.Q).concat([{ text: PH.text(it.opts[it.a]), sp: 'me', gap: 0.5 }]))}">${ICO.play} 대화 듣기 (상대 → 나)</button>` : ''}${compact ? '' : `<button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button>`}</div>`;
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
const OT = PH.o, D = PH.DEMO;
const qLine = (q, extra = []) => `<p class="enline">${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span class="who">${esc(whoOf(q))}</span><span lang="en">${lineHTML(q.en, (q.fast ? [] : keyMarks(q)).concat(extra), true)}</span></p>`;
const meLine = (a, label = '듣기') => `<p class="enline">${lpBtn(meSeq(a), label)}<span class="who me">나</span><span lang="en">${segHTML(a)}</span></p>`;
const sayLine = (q, text, sp) => `<p class="enline">${lpBtn([{ text, sp: sp || q.sp }], '상대의 대답 듣기')}<span class="who">${esc(whoOf(q))}</span><span lang="en">${esc(text)}</span></p>`;
const seeded = n => () => (n = (n * 16807) % 2147483647) / 2147483647;
// 되짚기 조각 칩: 되짚는 틀(So, I take · 함정 So, I eat) + 엔진의 조각 칩(맞는 조각 + 헷갈리기 쉬운 조각)
const lineChipsFor = C => [{ c: 'open', ids: ['so', 'eat'] }].concat(PH.lineChips(C, seeded(11)));
// 같은 자리의 조각을 누르면 바꿔 끼우고, 같은 조각을 다시 누르면 빼요 (누른 차례가 말하는 차례)
const toggleWord = (words, w) => words.includes(w) ? words.filter(x => x !== w) : words.filter(x => PH.OW[x].c !== PH.OW[w].c).concat([w]);
const lineRows = (C, words, attr) => lineChipsFor(C).map(gr => row(PH.OCAT[gr.c].ko, `<div class="seg">${gr.ids.map(w => `<button type="button" data-${attr}="${w}" aria-pressed="${words.includes(w)}"><span lang="en">${esc(PH.OW[w].t)}</span></button>`).join('')}</div>`)).join('');
const symSeg = (cur, attr) => seg('증상', PH.SYM_IDS.map(id => [id, esc(PH.SYM[id].short)]), cur, attr);
const unitKo = D0 => { const A = PH.AMT[D0.amt]; return A.unit === 'ml' ? 'ml' : A.unit === 'capsule' ? '캡슐' : '알'; };
const doseNote = D0 => `${PH.sayKo(D0)} → 하루 ${PH.perDay(D0)}번 · 모두 ${PH.total(D0)}${unitKo(D0)}`;
const DOB_OPTS = ['2005-03-04', '2004-11-12', '2006-08-21', '2003-12-09', '2007-01-15'];
// 03장 Yes/No 질문의 짝: 질문 · 사실 · 고를 대답
const AUX_SET = [
  { q: 'ak_fever', card: { fever: false }, ko: '열 (Do you …?)', a: [['fv_no'], ['fv_have'], ['fv_am'], ['g_no']] },
  { q: 'ak_allergy', card: { allergy: null }, ko: '알레르기 (Are you …?)', a: [['al_not'], ['al_dont'], ['al_allergy', 'penicillin'], ['g_yesp']] },
  { q: 'fr_first', card: { first: true }, ko: '처음 왔나 (Is this …?)', a: [['fs_yes'], ['fs_lit'], ['fs_no']] },
  { q: 'ex_press', card: { press: true }, ko: '누르면 아픈가 (Does it …?)', a: [['pr_yes'], ['pr_is'], ['pr_no']] },
  { q: 'dc_took', card: { took: 'cold' }, ko: '먹은 약 (Have you …?)', a: [['tk_yes', 'cold'], ['tk_ate', 'cold'], ['tk_no']] },
];
const ALG_OPTS = [['al_not'], ['al_dont'], ['al_yes', 'penicillin'], ['g_no']];
const LAB = {
  need: { sym: 'sorethroat', style: 'rec', since: 'for' },
  shape: { q: null, pick: null, yes: false },
  aux: { k: 0, a: null },
  line: { sym: 'sorethroat', form: 'tablets', words: [], skip: false },
  front: { name: 'kim', dob: '2005-03-04', ins: 'travel' },
  prob: { sym: 'sorethroat', style: 'have', took: 'cold', tk: 'took' },
  exam: { part: 'throat', press: true, scale: 6, aq: 'ex_allergy', al: null, aa: null },
  plan: { sym: 'sorethroat', allergy: null, words: [], skip: false, back: null, note: true },
};
const LAB0 = JSON.stringify(LAB);
const lineReply = (q, a, C) => { const fx = PH.fixLine(a.line, C); return sayLine(q, fx.en); };
const LABS = {
  intro: () => `${labHead('먼저 골라서 대답해 보세요')}${mini('intro')}
    <p class="note">상대의 말을 듣고 대답을 고르세요. 상대의 말은 답한 뒤에 글로 보여요. 막히면 힌트(H)로 3단계를 하나씩 열어 보세요.</p>`,
  map: () => {
    const i = S.stop, p = i != null ? PH.PLACES[i] : null;
    return `${labHead('곳을 골라 한두 마디 듣기')}
      ${seg('곳', PH.PLACES.map((x, k) => [k, `${PI(x.id)}${k + 1}. ${esc(x.ko)}`]), i == null ? '' : i, 'stop')}
      ${p ? `<ul class="qlist">${PH.PLACEQ[p.id].map(id => { const q = PH.Q[id]; return `<li>${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span><span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span><small>${SHI(q.shape)} ${esc(q.ko)}</small></span></li>`; }).join('')}</ul>
        ${PH.ME_FIRST[p.id] ? '<p class="note">이곳에서는 내가 먼저 말을 꺼내요. 약국에서는 증상을 알리고, 진료 끝에는 필요한 서류를 부탁해요.</p>' : ''}${clearBtn}` : '<p class="note">곳을 고르면 그곳에서 자주 듣는 말을 들을 수 있고, 영상 화면의 지도에도 표시돼요. 하늘색 → 열쇠 낱말. 보라색 테두리의 곳(약국 카운터 · 처방과 다음 진료)에서는 내가 먼저 말을 꺼내요. 약 이름 · 먹는 양 · 값은 모두 지어낸 예시예요 — 의학 조언이 아니니, 실제로는 약사와 의사의 말을 따르세요.</p>'}`;
  },
  counter: () => {
    const r = LAB.need, C = Object.assign({}, D, { sym: r.sym, part: PH.SYM[r.sym].part, since: r.since === 'since' ? 'yday' : '2d' });
    const a1 = r.style === 'sick' ? OT('cs_sick', PH.SYM[r.sym].part) : OT('cs_' + r.style, r.sym), j1 = PH.judge(PH.Q.cn_what, a1, C, '상황');
    const a2 = r.since === 'since' ? OT('sn_since', 'yday') : OT('sn_for', '2d'), j2 = PH.judge(PH.Q.ak_long, a2, C, '상황');
    return `${labHead('증상 알리기 — 사실 + 부탁')}
      ${row('증상', symSeg(r.sym, 'ns'))}
      ${row('말하는 방법', seg('말하는 방법', [['rec', '사실 + 추천 부탁'], ['any', '사실 + 있나 묻기'], ['fact', '사실만'], ['sick', '‘목이 아파요’를 낱말 그대로'], ['give', '‘약 주세요’를 그대로']], r.style, 'nw'))}
      ${qLine(PH.Q.cn_what)}${meLine(a1)}${verdictHTML(j1)}
      <h3 class="mt">얼마나 됐나 — for냐 since냐</h3>
      ${row('아픈 지', seg('아픈 지', [['for', '이틀 (센 기간 → For)'], ['since', '어제부터 (시작한 때 → Since)']], r.since, 'nf'))}
      ${qLine(PH.Q.ak_long)}${meLine(a2)}${verdictHTML(j2)}
      <p class="note">For + 센 기간(two days · a week) · Since + 시작한 때(yesterday · Monday). ‘이틀 동안’을 그대로 옮긴 <span lang="en">During two days.</span>는 어색해요. 고른 증상은 영상 화면의 표에도 칠해져요.</p>${S.need ? clearBtn : ''}`;
  },
  ask: () => {
    const r = LAB.shape, q = r.q ? PH.Q[r.q] : null;
    let res = '';
    if (q && r.pick) res = `<p class="verdict"><b class="${r.pick === q.shape ? 'c-ok' : 'c-no'}">${r.pick === q.shape ? '맞아요' : '다시 보세요'}</b>${esc(`${PH.SHAPE[q.shape].ko} → ${PH.sayOf(q.intent)}. 대답 → ${PH.SHAPE[q.shape].ans}.`)}</p>`;
    if (q && r.yes) { const j = PH.judge(q, { f: 'g_yesp' }, D, '상황'); res += `${meLine({ f: 'g_yesp' })}${verdictHTML(j)}`; }
    const X = AUX_SET[LAB.aux.k], aq = PH.Q[X.q];
    let ares = '';
    if (LAB.aux.a != null) { const [f, v] = X.a[LAB.aux.a], a = OT(f, v), j = PH.judge(aq, a, X.card, '상황'); ares = `${meLine(a)}${verdictHTML(j)}`; }
    return `${labHead('질문의 모양 맞히기')}
      <p class="note">상대의 말을 고르고, 모양을 맞혀 보세요. 그다음 <span lang="en">Yes, please.</span>로 대답하면 어떻게 되는지 규칙 엔진에 물어봐요.</p>
      ${seg('상대의 말', PH.SHAPE_QS.map(id => [id, `<span lang="en">${esc(PH.Q[id].short && /\?$|!$/.test(PH.Q[id].short) ? PH.Q[id].short : PH.Q[id].en)}</span>`]), r.q || '', 'sq')}
      ${q ? `<h3 class="mt">이 말의 모양은?</h3>${seg('모양', ['yn', 'or', 'wh', 'note'].map(sh => [sh, SHI(sh)]), r.pick || '', 'sp')}
        <div class="tg-acts mt8"><button type="button" class="btn ghost" id="shapeYes">Yes, please.로 대답해 보기</button>${lpBtn(staffSeq(q), '상대의 말 듣기')}</div>${res}` : ''}
      <h3 class="mt">Yes/No 질문은 첫 낱말로 짝 맞추기</h3>
      ${row('질문', seg('질문', AUX_SET.map((x, k) => [k, esc(x.ko)]), LAB.aux.k, 'xk'))}
      ${qLine(aq)}<p class="note"><span lang="en">${esc(PH.AUX[aq.aux].q)}</span> → <span lang="en">${esc(PH.AUX[aq.aux].a)}</span> · 사실: ${esc(Object.keys(X.card).map(k => PH.factKo(k, X.card[k])).join(' · '))}</p>
      ${seg('대답', X.a.map(([f, v], k) => [k, `<span lang="en">${esc(PH.text(OT(f, v)))}</span>`]), LAB.aux.a == null ? '' : LAB.aux.a, 'xa')}
      ${ares}${S.shape || S.aux ? clearBtn : ''}`;
  },
  dose: () => {
    const r = LAB.line, C = { sym: r.sym, form: r.form, dk: 'ph' }, q = PH.simQ('ds_say', C), a = PH.L(r.words.slice()), DD = PH.doseOf(C);
    let res = '';
    if (r.words.length || r.skip) {
      const A = r.skip ? OT('ds_ok') : a, j = PH.judge(q, A, C, '상황');
      res = `${meLine(A)}${verdictHTML(j)}${r.skip ? '' : lineReply(q, a, C)}`;
    }
    const price = PH.price(r.sym, r.form), tr = PH.moneyTrap(price), cq = PH.simQ('ds_cost', { amount: price }), M = PH.MEDS[PH.SYM[r.sym].med];
    return `${labHead('먹는 법 듣고 되짚기')}
      ${row('증상', symSeg(r.sym, 'ls'))}
      ${row('약', seg('약', [['tablets', '알약'], ['liquid', '물약']], r.form, 'lf'))}
      ${qLine(q)}<p class="note">${esc(doseNote(DD))}</p>
      <p class="note">조각을 누르는 차례대로 문장이 돼요. 일부러 <span lang="en">So, I eat</span>을 넣거나, <span lang="en">three times one day</span>를 고르거나, 조각 하나를 빼 보세요.</p>
      ${lineRows(C, r.words, 'lw')}${res}
      <div class="tg-acts mt8"><button class="btn ghost" type="button" id="lineSkip">되짚지 않고 → Okay. Thanks.</button><button class="btn ghost" type="button" id="lineClear">처음부터</button>${S.line ? clearBtn : ''}</div>
      <p class="note">순서(So, I take → 양 → 하루 몇 번 → 언제 → 며칠 동안)는 자주 쓰는 순서를 단순하게 줄인 규칙이에요. 틀린 조각이 있으면 약사는 그 조각만 고쳐 줘요(<code>PH.fixLine</code>). 약 이름 · 먹는 양 · 값은 지어낸 예시예요 — 실제로는 약사의 설명과 약 상자를 따르세요.</p>
      <h3 class="mt">값 듣기 — thirteen이냐 thirty냐</h3>
      ${qLine(cq, [{ t: PH.money(price), role: 'slot' }])}
      <p class="note">읽기 → <span lang="en">${esc(PH.priceWords(price))}</span> · ${esc(PH.priceKo(price))}. 헷갈리기 쉬운 값 → <span lang="en">${esc(PH.money(tr))}</span> (${esc(PH.priceWords(tr))}).</p>
      <ul class="qlist">${PH.PAIRS.map(([n1, s1, n2, s2]) => `<li>${lpBtn([{ text: PH.numWord(+n1), sp: 'tc' }], '듣기: ' + PH.numWord(+n1))}<span><span lang="en">${esc(s1)}</span><small>${n1} · 뒤를 세게</small></span>${lpBtn([{ text: PH.numWord(+n2), sp: 'tc' }], '듣기: ' + PH.numWord(+n2))}<span><span lang="en">${esc(s2)}</span><small>${n2} · 앞을 세게</small></span></li>`).join('')}</ul>
      <h3 class="mt">값을 되물어 확인하기</h3>${mini('cost')}
      ${M.drowsy ? `<h3 class="mt">조심할 점 — 모르는 낱말은 물어요</h3>${qLine(PH.Q.ds_warn)}${meLine(OT('rp_wdrowsy'))}${sayLine(PH.Q.ds_warn, repairLine('what', PH.Q.ds_warn, {}))}${meLine(OT('wn_ok'))}` : '<p class="note">이 약에는 ‘졸릴 수 있어요(drowsy)’ 안내가 없어요. 감기약 · 기침약을 골라 보세요.</p>'}`;
  },
  front: () => {
    const r = LAB.front, N = PH.NAMES[r.name];
    return `${labHead('접수 — 이름 · 철자 · 생년월일 · 보험')}
      ${row('성', seg('성', PH.NAME_IDS.map(k => [k, esc(PH.NAMES[k].ko)]), r.name, 'fn'))}
      ${row('생년월일', seg('생년월일', DOB_OPTS.map(v => [v, esc(PH.dateKo(v))]), r.dob, 'fd'))}
      ${row('보험', seg('보험', [['travel', '여행자 보험'], ['student', '학생 건강 보험']], r.ins, 'fi'))}
      ${qLine(PH.Q.fr_name)}${meLine(OT('nm_sp', r.name))}
      ${qLine(PH.Q.fr_spell)}${meLine(OT('sp_ok', N.letters))}
      <p class="note">철자는 한 글자씩 끊어 불러요 → <span lang="en">${esc(N.letters.split('-').join(', '))}</span>. 받아 적는 사람이 헷갈리기 쉬운 꼴 → <span lang="en">${esc(PH.SPELL_TRAP[r.name].join(' · '))}</span></p>
      ${qLine(PH.Q.fr_dob)}${meLine(OT('db_is', r.dob))}
      <p class="note">읽기 → <span lang="en">${esc(PH.dateWords(r.dob))}</span>. 달은 이름으로, 날은 서수(fourth · twelfth)로 말하면 헷갈리지 않아요. 서류의 날짜 칸은 나라마다 차례가 달라요 → 미국 MM/DD/YYYY(<span lang="en">${esc(PHS.mmdd(r.dob))}</span>) · 영국 DD/MM/YYYY. 숫자만 말하면 3월 4일과 4월 3일이 헷갈려요.</p>
      ${qLine(PH.Q.fr_ins)}${meLine(OT('is_yes', r.ins))}
      <h3 class="mt">생년월일 대답 골라 보기</h3>${mini('dob')}${S.front ? clearBtn : ''}`;
  },
  doctor: () => {
    const r = LAB.prob, C = Object.assign({}, D, { sym: r.sym, part: PH.SYM[r.sym].part, took: r.took || null });
    const a1 = OT(r.style === 'hurt' ? 'pb_hurt' : r.style === 'sick' ? 'cs_sick' : 'pb_have', r.style === 'have' ? r.sym : PH.SYM[r.sym].part), j1 = PH.judge(PH.Q.dc_prob, a1, C, '상황');
    const a2 = r.took ? OT(r.tk === 'ate' ? 'tk_ate' : 'tk_yes', r.took) : OT('tk_no'), j2 = PH.judge(PH.Q.dc_took, a2, C, '상황');
    return `${labHead('증상 설명 · 먹은 약')}
      ${row('증상', symSeg(r.sym, 'bs'))}
      ${row('말하는 방법', seg('말하는 방법', [['have', 'I have + 증상'], ['hurt', 'My + 곳 + hurts'], ['sick', '낱말 그대로 (is sick)']], r.style, 'bw'))}
      ${qLine(PH.Q.dc_prob)}${meLine(a1)}${verdictHTML(j1)}
      <h3 class="mt">먹은 약이 있나요?</h3>
      ${row('먹은 약', seg('먹은 약', [['', '없음']].concat(PH.MED_IDS.map(k => [k, esc(PH.MEDS[k].ko)])), r.took || '', 'bt'))}
      ${r.took ? row('말하는 방법', seg('먹었다', [['took', 'took (약을 먹다)'], ['ate', 'ate (음식을 먹다)']], r.tk, 'bk')) : ''}
      ${qLine(PH.Q.dc_took)}${meLine(a2)}${verdictHTML(j2)}
      <p class="note">약을 먹다 → <span lang="en">take · took</span>. <span lang="en">eat · ate</span>는 음식을 먹을 때 써요. 증상은 영상 화면의 표에서도 볼 수 있어요.</p>${S.prob ? clearBtn : ''}`;
  },
  exam: () => {
    const r = LAB.exam, aq = PH.Q[r.aq];
    let ares = '';
    if (r.aa != null) { const [f, v] = ALG_OPTS[r.aa], a = OT(f, v), j = PH.judge(aq, a, { allergy: r.al }, '상황'); ares = `${meLine(a)}${verdictHTML(j)}`; }
    return `${labHead('아픈 곳 · 누르면 · 몇 점')}
      ${row('아픈 곳', seg('아픈 곳', PH.PART_IDS.map(k => [k, esc(PH.PART[k].ko)]), r.part, 'ep'))}
      ${row('누르면', seg('누르면', [['1', '아파요'], ['0', '안 아파요']], r.press ? '1' : '0', 'eq'))}
      ${row('아픈 정도', seg('아픈 정도', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, String(n)]), r.scale, 'es'))}
      ${qLine(PH.Q.ex_where)}${meLine(OT('wh_in', r.part))}
      ${qLine(PH.Q.ex_press)}${meLine(OT(r.press ? 'pr_yes' : 'pr_no'))}
      ${qLine(PH.Q.ex_scale)}${meLine(OT('sc_about', String(r.scale)))}
      <p class="note">아픈 자리 → <span lang="en">It hurts in my + 곳</span>. 숫자 앞에는 a를 붙여요 → <span lang="en">About a six.</span> 고른 곳은 영상 화면의 몸 그림에 표시돼요.</p>
      <h3 class="mt">약 알레르기 — Are냐 Do냐</h3>
      ${row('질문', seg('질문', [['ak_allergy', '<span lang="en">Are you allergic …?</span>'], ['ex_allergy', '<span lang="en">Do you have any allergies …?</span>']], r.aq, 'ea'))}
      ${row('나는', seg('알레르기', [['', '알레르기 없음'], ['penicillin', '페니실린 알레르기']], r.al || '', 'el'))}
      ${qLine(aq)}
      ${seg('대답', ALG_OPTS.map(([f, v], k) => [k, `<span lang="en">${esc(PH.text(OT(f, v)))}</span>`]), r.aa == null ? '' : r.aa, 'eb')}
      ${ares}
      <p class="note">알레르기가 있으면 무엇에 있는지 꼭 말해요. 안전과 관련된 말이라 Yes만 하면 ②에서 걸러요. 의사는 알레르기에 맞춰 다른 약을 골라요(08장).</p>${S.exam ? clearBtn : ''}`;
  },
  plan: () => {
    const r = LAB.plan, C = { sym: r.sym, allergy: r.allergy, dk: 'rx' }, q = PH.simQ('pl_rx', C), a = PH.L(r.words.slice()), DD = PH.doseOf(C);
    let res = '';
    if (r.words.length || r.skip) {
      const A = r.skip ? OT('ds_ok') : a, j = PH.judge(q, A, C, '상황');
      res = `${meLine(A)}${verdictHTML(j)}${r.skip ? '' : lineReply(q, a, C)}`;
    }
    const back = PH.safeRx(r.sym, r.allergy).back, bq = PH.simQ('pl_back', { back });
    const bopts = [OT('bk_so', back), OT('bk_so', back === 'w1' ? 'd3' : 'w1'), OT('bk_ok'), OT('g_yes')];
    let bres = '';
    if (r.back != null) { const j = PH.judge(bq, bopts[r.back], { back }, '상황'); bres = `${meLine(bopts[r.back])}${verdictHTML(j)}`; }
    const nq = PH.Q.pl_q, na = PH.model(nq, { note: r.note });
    return `${labHead('처방 되짚기 · 다시 올 날 · 진단서')}
      ${row('증상', symSeg(r.sym, 'ps'))}
      ${row('알레르기', seg('알레르기', [['', '없음'], ['penicillin', '페니실린']], r.allergy || '', 'pa'))}
      ${qLine(q)}<p class="note">${esc(PH.rxSayKo(r.sym, r.allergy))} ${esc(`→ 하루 ${PH.perDay(DD)}번 · 모두 ${PH.total(DD)}${unitKo(DD)}`)}</p>
      ${lineRows(C, r.words, 'pw')}${res}
      <div class="tg-acts mt8"><button class="btn ghost" type="button" id="planSkip">되짚지 않고 → Okay. Thanks.</button><button class="btn ghost" type="button" id="planClear">처음부터</button>${S.plan ? clearBtn : ''}</div>
      <p class="note">페니실린 알레르기가 있으면 목 · 귀 항생제 대신 다른 항생제로 바뀌어요 — 약도, 먹는 법도 달라지니 다시 되짚어요. 처방 · 약 이름은 지어낸 예시예요(<code>PH.safeRx</code>).</p>
      <h3 class="mt">다시 올 날 되짚기</h3>${qLine(bq, [{ t: PH.BACK[back].t, role: 'slot' }])}
      ${seg('대답', bopts.map((x, k) => [k, `<span lang="en">${esc(PH.text(x))}</span>`]), r.back == null ? '' : r.back, 'pb')}${bres}
      <h3 class="mt">마무리 — 진단서 부탁</h3>
      ${row('진단서', seg('진단서', [['1', '수업에 낼 진단서가 필요해요'], ['0', '필요 없어요']], r.note ? '1' : '0', 'pn'))}
      ${qLine(nq)}${meLine(na)}${sayLine(nq, PH.reply(nq, na, { note: r.note }))}
      <p class="note">진단서 → <span lang="en">doctor's note</span>(학교 · 회사에 내는 확인서). <span lang="en">diagnosis</span>는 ‘진단(병명)’이라 다른 말이에요. 부탁은 질문으로 → <span lang="en">Could I get …?</span></p>`;
  },
  method: () => {
    const i = S.place, rw = i != null ? PH.METHOD[i] : null;
    return `${labHead('곳마다 3단계 적용해 보기')}
      ${seg('곳', PH.METHOD.map(([qid], k) => [k, `${PI(PH.Q[qid].place)}${esc(PH.PLACE[PH.Q[qid].place].ko)}`]), i == null ? '' : i, 'place')}
      ${rw ? (() => { const [qid, a, c] = rw, q = PH.Q[qid], j = PH.judge(q, a, c); return `<p class="enline">${lpBtn(staffSeq(q), '듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
        <ol class="edr-steps"><li><b>① 열쇠 낱말 + 모양</b> ${esc(q.key.join(' … '))} → ${SHI(q.shape)} ${esc(PH.sayOf(q.intent))}</li><li><b>② 틀 + 내 정보</b> <span lang="en">${segHTML(a)}</span> ${esc(PH.ko(a))}</li><li><b>③ 공손하게</b> ${esc(j.why)}</li></ol>
        <p class="enline">${lpBtn(staffSeq(q).concat([{ text: PH.text(a), sp: 'me', gap: 0.5 }]), '대화 듣기')}<span>대화 듣기</span></p>
        ${clearBtn}`; })() : '<p class="note">곳을 고르면 영상 화면의 그 줄이 켜지고, 세 단계를 글로 보여 줘요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>대화 골라 보기</h3>
    <div class="seg">${PHS.PSEG.map((t, i) => `<button type="button" data-seek="${t + 0.4}">대화 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 해 보고 싶다면 아래 <a href="#playground">약국 · 병원 시뮬레이터</a>에서 내 환자 카드로 약국부터 병원까지 해 보세요. 카드는 누를 때마다 새로 만들어져요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">약국 · 병원 시뮬레이터</a> — 환자 카드로 약국에서 병원까지(복용법 되짚기도)</li><li><a href="#shadow">약국 · 병원 표현 따라 말하기</a> — ${PH.SHADOW.length}문장 듣고 따라 하기</li>
    <li><a href="#drill">듣고 대답 고르기</a> — 일곱 곳 ${PH.DRILL.length}문제, 3단계 힌트</li><li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.querySelectorAll('.lmini').forEach(m => PDrill(m, [PH.MINI[m.dataset.mini]], { compact: true, onAnswer() { if (playing) pause(); } }));
}
function showAt(u) { const ch = CHAPTERS[PHS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const relab = () => { touch(); buildLab(PHS.chapterAt(T)); };
// 직접 해 보기 상태 → 영상 화면 상태
const syncNeed = () => { S.need = Object.assign({}, LAB.need); };
const syncShape = () => { S.shape = LAB.shape.q || null; if (S.shape) S.aux = null; };
const syncAux = () => { const X = AUX_SET[LAB.aux.k], A = LAB.aux.a != null ? X.a[LAB.aux.a] : null; S.aux = A ? { q: X.q, a: A[0], v: A[1], card: X.card } : null; if (S.aux) S.shape = null; };
const syncLine = () => { const r = LAB.line; S.line = { sym: r.sym, form: r.form, words: r.words.slice() }; };
const syncFront = () => { S.front = Object.assign({}, LAB.front); };
const syncProb = () => { const r = LAB.prob; S.prob = { sym: r.sym, style: r.style, took: r.took || null, tk: r.tk }; };
const syncExam = () => { const r = LAB.exam; S.exam = { part: r.part, press: r.press, scale: r.scale }; };
const syncPlan = () => { const r = LAB.plan; S.plan = { sym: r.sym, allergy: r.allergy || null, words: r.words.slice() }; };
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  const d = b.dataset;
  if (d.seek) { seek(CHAPTERS[PHS.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') {
    ['stop', 'place', 'shape', 'need', 'aux', 'line', 'front', 'prob', 'exam', 'plan'].forEach(k => { S[k] = null; });
    Object.assign(LAB, JSON.parse(LAB0));
    relab(); return;
  }
  if (d.stop != null) { S.stop = d.stop === '' ? null : +d.stop; showAt(18.8); relab(); return; }
  // 02장 증상 알리기 · for · since
  if (d.ns) { LAB.need.sym = d.ns; syncNeed(); relab(); return; }
  if (d.nw) { LAB.need.style = d.nw; syncNeed(); relab(); return; }
  if (d.nf) { LAB.need.since = d.nf; syncNeed(); relab(); return; }
  // 03장 질문의 모양 · Yes/No의 짝
  if (d.sq) { LAB.shape = { q: d.sq, pick: null, yes: false }; syncShape(); relab(); return; }
  if (d.sp) { LAB.shape.pick = d.sp; syncShape(); relab(); return; }
  if (b.id === 'shapeYes') { LAB.shape.yes = true; syncShape(); relab(); return; }
  if (d.xk != null) { LAB.aux = { k: +d.xk, a: null }; syncAux(); relab(); return; }
  if (d.xa != null) { LAB.aux.a = +d.xa; syncAux(); relab(); return; }
  // 04장 복용법 되짚기
  if (d.ls) { LAB.line = { sym: d.ls, form: LAB.line.form, words: [], skip: false }; syncLine(); relab(); return; }
  if (d.lf) { LAB.line = { sym: LAB.line.sym, form: d.lf, words: [], skip: false }; syncLine(); relab(); return; }
  if (d.lw) { LAB.line.words = toggleWord(LAB.line.words, d.lw); LAB.line.skip = false; syncLine(); relab(); return; }
  if (b.id === 'lineClear') { LAB.line.words = []; LAB.line.skip = false; syncLine(); relab(); return; }
  if (b.id === 'lineSkip') { LAB.line.words = []; LAB.line.skip = true; syncLine(); relab(); return; }
  // 05장 접수
  if (d.fn) { LAB.front.name = d.fn; syncFront(); relab(); return; }
  if (d.fd) { LAB.front.dob = d.fd; syncFront(); relab(); return; }
  if (d.fi) { LAB.front.ins = d.fi; syncFront(); relab(); return; }
  // 06장 증상 설명 · 먹은 약
  if (d.bs) { LAB.prob.sym = d.bs; syncProb(); relab(); return; }
  if (d.bw) { LAB.prob.style = d.bw; syncProb(); relab(); return; }
  if (d.bt != null) { LAB.prob.took = d.bt || null; syncProb(); relab(); return; }
  if (d.bk) { LAB.prob.tk = d.bk; syncProb(); relab(); return; }
  // 07장 진찰 (알레르기 칸은 영상 화면을 바꾸지 않아요)
  if (d.ep) { LAB.exam.part = d.ep; syncExam(); relab(); return; }
  if (d.eq != null) { LAB.exam.press = d.eq === '1'; syncExam(); relab(); return; }
  if (d.es) { LAB.exam.scale = +d.es; syncExam(); relab(); return; }
  if (d.ea) { LAB.exam.aq = d.ea; LAB.exam.aa = null; relab(); return; }
  if (d.el != null) { LAB.exam.al = d.el || null; LAB.exam.aa = null; relab(); return; }
  if (d.eb != null) { LAB.exam.aa = +d.eb; relab(); return; }
  // 08장 처방 되짚기 · 다시 올 날 · 진단서
  if (d.ps) { LAB.plan = Object.assign(LAB.plan, { sym: d.ps, words: [], skip: false, back: null }); syncPlan(); relab(); return; }
  if (d.pa != null) { LAB.plan = Object.assign(LAB.plan, { allergy: d.pa || null, words: [], skip: false, back: null }); syncPlan(); relab(); return; }
  if (d.pw) { LAB.plan.words = toggleWord(LAB.plan.words, d.pw); LAB.plan.skip = false; syncPlan(); relab(); return; }
  if (b.id === 'planClear') { LAB.plan.words = []; LAB.plan.skip = false; syncPlan(); relab(); return; }
  if (b.id === 'planSkip') { LAB.plan.words = []; LAB.plan.skip = true; syncPlan(); relab(); return; }
  if (d.pb != null) { LAB.plan.back = +d.pb; relab(); return; }
  if (d.pn != null) { LAB.plan.note = d.pn === '1'; relab(); return; }
  if (d.place != null) { S.place = d.place === '' ? null : +d.place; showAt(3.8); relab(); }
});
/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   영어 문장 속 값 · 양은 영어 낱말로($13.50 → thirteen fifty, 10 ml → ten milliliters),
   한국어 속 서류 날짜(03/04/2005)는 숫자를 하나씩 읽어요
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/\$(\d+)\.(\d{2})\b/g, (m, d, c) => PH.priceWords(+d * 100 + +c)],
    [/\b(\d+) ml\b/g, (m, n) => `${PH.numWord(+n)} milliliters`],
    [/\b(\d{2})\/(\d{2})\/(\d{4})\b/g, (m, a, b, y) => `${[a, b].map(x => x.split('').map(d => '공일이삼사오육칠팔구'[+d]).join('')).join(', ')}, ${y}`],
    [/TAB-let-ser/g, 'tab let ser'],
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
   10. 놀이터 — 약국 · 병원 시뮬레이터
   약국: 카운터(내가 먼저 증상) → 약사의 질문 → 복용법 되짚기 · 값. (며칠 뒤) 병원: 접수 → 진료실 → 진찰 → 처방 되짚기 · 다시 올 날 · 진단서.
   값 · 복용법 · 다시 올 날은 환자 카드에 없어요 — 상대가 말한 것을 듣고 써야 해요. 복용법은 조각 칩으로 되짚어요(PH.lineChips → PH.checkLine).
   ========================================================= */
const SIM = { card: null, qs: [], i: 0, frames: [], slots: {}, f: null, v: null, log: [], started: false, script: !PHV.supported, mode: null, react: null, why: null, done: false, listening: false, heard: null, covered: new Set(), skipped: [], line: { words: [] }, chips: [] };
const simQ = () => PH.simQ(SIM.qs[SIM.i], SIM.card);
const simC = () => Object.assign({}, SIM.card, simQ().fact || {});
window.__simCard = () => Object.assign({}, SIM.card);   // 확인용(읽기만): 지금 환자 카드
window.__simQ = () => Object.assign({}, simQ());          // 확인용(읽기만): 지금 상대의 말
const keyOf = q => `${q.place}:${q.intent}`;
const skipLabel = ids => ids.map(id => PH.INTENT_KO[PH.Q[id].intent]).filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
const isCovered = q => SIM.covered.has(keyOf(q)) || SIM.covered.has('*:' + q.intent);
const PLACE_INTRO = {
  ask: () => '약사가 몇 가지를 물어요. 질문의 모양부터 잡아요.',
  dose: () => '약사가 먹는 법을 알려 줘요. 길고 빨라요 — 조각으로 듣고 들은 차례대로 되짚어요.',
  front: () => '사흘이 지나도 낫지 않아 병원에 왔어요. 예약 없이 접수 창구로 가요.',
  doctor: () => '진료실에 들어왔어요. 의사가 어디가 불편한지 물어요.',
  exam: () => '의사가 진찰해요. 아픈 곳과 정도를 짧게 말해요.',
  plan: () => '의사가 처방을 알려 줘요. 먹는 법을 조각으로 되짚고, 마지막에 필요한 것을 부탁해요.',
};
function simNew() {
  PHV.stop(); stopListening();
  SIM.card = PH.newCard(); SIM.qs = PH.simQs(SIM.card); SIM.i = 0; SIM.log = []; SIM.done = false; SIM.react = null; SIM.why = null; SIM.heard = null;
  SIM.covered = new Set(); SIM.skipped = [];
  simPrep(); simBuild();
}
function simPrep() {
  const q = simQ(), C = simC();
  SIM.slots = {}; SIM.f = null; SIM.v = null; SIM.line = { words: [] }; SIM.chips = [];
  if (q.intent === 'dose') { SIM.frames = []; SIM.chips = [{ c: 'open', ids: ['so', 'eat'] }].concat(PH.lineChips(C)); }
  else {
    SIM.frames = shuffle(PH.simFrames(q.intent, C) || []);
    SIM.frames.forEach(f => { const Fm = PH.FRAME[f]; if (Fm.slot) SIM.slots[f] = PH.slotChoices(Fm.slot, C, Math.random, q); });
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
  if (kind === 'what') return 'Drowsy means sleepy. So please don\'t drive after you take it.';
  if (kind === 'check' && q.intent === 'cost') return `Yes, that's right. ${PH.money(C.amount)}.`;
  if (kind === 'check' && q.intent === 'back') return `Yes, that's right. In ${PH.BACK[C.back].t}.`;
  return null;
}
function simAnswer(a, spoken) {
  if (SIM.done || !SIM.started) return;
  const q = simQ(), C = simC(), L = SIM.log[SIM.i];
  const j = spoken ? PH.matchSpoken(spoken, q, C) : PH.judge(q, a, C);
  const model = PH.model(q, C);
  SIM.heard = spoken || null;
  if (j.repair) {
    const re = repairLine(j.repair, q, C);
    SIM.react = { en: re || 'Sure. ' + q.en, ko: re ? (j.repair === 'check' ? '상대가 숫자를 확인해 줬어요. 이제 대답해 보세요.' : '상대가 쉬운 말로 알려 줬어요. 이제 대답해 보세요.') : '다시 물었어요. 상대가 천천히 한 번 더 말해요.', st: 'repair', who: whoOf(q) }; SIM.why = null; simBuild();
    simSpeak(re ? [{ text: re, sp: q.sp }] : [{ text: 'Sure.', sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }], { slow: true }); return;
  }
  L.tries.push({ t: spoken ? `(말로) ${spoken}` : PH.text(a), ok: j.ok, stage: j.stage });
  SIM.why = { j, model, spoken: !!spoken };
  if (j.ok) {
    L.final = spoken || PH.text(a);
    (spoken ? (j.covered || [q.intent]) : PH.covered(a, q)).filter(i => i !== q.intent).forEach(i => SIM.covered.add(PH.CROSS[i] ? `*:${i}` : `${q.place}:${i}`));
    const ok = PH.REACT.ok[(SIM.i + L.tries.length) % PH.REACT.ok.length];
    let n = SIM.i + 1; const skip = [];
    while (n < SIM.qs.length && isCovered(PH.Q[SIM.qs[n]])) { skip.push(SIM.qs[n]); n++; }
    SIM.skipped.push(...skip);
    const reply = PH.reply(q, a || model, C);
    if (n >= SIM.qs.length) {
      const bye = [reply, 'Take care!'].filter(Boolean).join(' ');
      SIM.done = true; SIM.react = { en: bye, ko: '진료 끝! 약국에서 약을 사고, 병원에서 처방을 받아 먹는 법까지 되짚었어요.', st: 'ok', who: whoOf(q) };
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
    const r = j.stage === 1 ? PH.REACT[1](q) : j.stage === 2 ? PH.REACT[2](q, j, a, C) : j.stage === 3 ? PH.REACT[3](q, j, a) : { en: 'Sorry?', ko: '알아듣지 못했어요.' };
    SIM.react = Object.assign({ st: 'no', who: whoOf(q) }, r);
    if (q.intent !== 'dose') { SIM.f = null; SIM.v = null; }   // 되짚기는 틀린 조각만 바꿔 끼우게 그대로 둬요
    simBuild(); simSpeak([{ text: r.en, sp: q.sp }]);
  }
}
const chipT = f => esc(PH.FRAME[f].t.replace(/[{}]/g, '')).replace('___', '<i class="blank">___</i>');
const slotLabel = (f, v) => { const F0 = PH.FRAME[f], x = PH.sv(F0.slot, v); return x ? (x[F0.form || 't'] != null ? x[F0.form || 't'] : x.t) : v; };
// 약 봉투 라벨 둘 (HTML) — 시뮬레이터의 끝: 약국에서 산 약 · 병원 처방
function bagHTML(c) {
  const Dp = PH.otc(c.sym, c.form), Dr = PH.rx(c.sym, c.allergy || null), R = PH.safeRx(c.sym, c.allergy || null), M = PH.MEDS[PH.SYM[c.sym].med];
  const rows = D0 => [['AMOUNT', PH.AMT[D0.amt].t], ['HOW OFTEN', PH.FREQ[D0.freq].t], ['WHEN', D0.time ? PH.WHEN[D0.time].t : '—'], ['HOW LONG', PH.LEN[D0.len].t.replace(/^for /, '')]];
  const lab = (head, name, D0, extra) => `<div class="rcpt" role="img" aria-label="${esc(head)}: ${esc(PH.sayKo(D0))}"><p class="rc-h">${esc(head)}</p><p class="rc-g">${esc(name)}</p><ul>${rows(D0).map(([k, v]) => `<li><span>${k}</span><b>${esc(v)}</b></li>`).join('')}</ul>${extra}</div>`;
  return lab(PH.PHARMACY.toUpperCase(), `${M.en.toUpperCase()} · ${c.form === 'liquid' ? 'LIQUID' : 'TABLETS'}`, Dp, `<p class="rc-t"><span>PAID ${c.paym === 'cash' ? 'CASH' : 'CARD'}</span><b>${esc(PH.money(c.amount))}</b></p>`)
    + lab(`${PH.CLINIC.toUpperCase()} · Rx`, R.en.replace(/^(some|a) /, '').toUpperCase(), Dr, `<p class="rc-t"><span>COME BACK</span><b>${esc(PH.BACK[c.back].t.toUpperCase())}</b></p>${c.note ? '<p class="rc-g">DOCTOR\'S NOTE · ISSUED</p>' : ''}`)
    + '<p class="rc-n">약 이름 · 먹는 양 · 값은 지어낸 예시예요. 의학 조언이 아니에요.</p>';
}
// 하루 시간표 둘 (캔버스) — 되짚기를 마친 뒤에만 그려요
function drawSimDay(c) {
  const cv2 = $('simDay'); if (!cv2) return;
  const W0 = 380, H0 = 300, d = 2, g = cv2.getContext('2d');
  cv2.width = W0 * d; cv2.height = H0 * d; g.setTransform(d, 0, 0, d, 0, 0);
  g.fillStyle = PHS.COL.bg; g.fillRect(0, 0, W0, H0);
  PHS.doseDay(g, 6, 6, W0 - 12, PH.otc(c.sym, c.form), { title: 'PHARMACY · 약국에서 산 약', h: 140 });
  PHS.doseDay(g, 6, 154, W0 - 12, PH.rx(c.sym, c.allergy || null), { title: 'CLINIC Rx · 병원 처방', h: 140 });
}
function simBuild() {
  const hear = PHV.supported, C = SIM.card;
  $('simCard').innerHTML = `<p class="tc-head">${PI('front')}<b>환자 카드</b> <span lang="en">PATIENT CARD</span></p><dl>${PH.cardRows(C).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="tc-foot">약국: ${esc(PH.PHARMACY)} · 병원: ${esc(PH.CLINIC)} (지어낸 곳) · 값 · 먹는 법 · 다시 올 날은 카드에 없어요 — 상대가 말하는 것을 들어요</p>`;
  const prog = SIM.qs.map((id, k) => { const L = SIM.log[k], skipped = SIM.skipped.includes(id), c = skipped ? ' skip' : !L || !L.final ? (k === SIM.i && !SIM.done ? ' cur' : '') : L.tries[0] && L.tries[0].ok ? ' ok' : ' late'; return `<li class="${c}" title="${esc(PH.INTENT_KO[PH.Q[id].intent] || '')}${skipped ? ' (건너뜀)' : ''}">${k + 1}</li>`; }).join('');
  $('simProg').innerHTML = prog;
  const box = $('simMain');
  if (!SIM.started) {
    box.innerHTML = `<div class="sim-start"><p>왼쪽 환자 카드가 오늘의 사실이에요. 약국 카운터(내가 먼저 증상을 알려요) → 약사의 질문 → 먹는 법과 값, 그리고 며칠 뒤 병원 접수 → 진료실 → 진찰 → 처방 차례로 이야기해요. 먼저 <b>질문의 모양</b>을 잡고(Yes/No · 고르기 · 정보 · 안내), 대답 틀 칩을 고른 뒤 카드의 정보 칩을 넣어요. 값 · 먹는 법 · 다시 올 날은 카드에 없으니 <b>상대가 말하는 것</b>을 잘 들으세요. 먹는 법은 <b>조각 칩</b>으로 들은 차례대로 되짚어요(R 다시 듣기 · S 천천히)${SRC ? ' — 마이크로 말해서 대답할 수도 있어요' : ''}.</p><button type="button" class="btn" id="simGo">약국에서 시작 (Enter)</button></div>`;
    return;
  }
  if (SIM.done) {
    const first = SIM.log.filter(L => L && L.tries[0] && L.tries[0].ok).length, asked = SIM.log.filter(Boolean).length;
    const ml = PH.modelLine(PH.rx(C.sym, C.allergy || null));
    box.innerHTML = `<div class="sim-end"><div class="end-art">${bagHTML(C)}<figure class="sim-map"><canvas id="simDay" role="img" aria-label="하루 시간표 둘: 약국에서 산 약과 병원 처방을 먹는 때"></canvas><figcaption>하루 시간표 — 포크 = 식사 · 달 = 잠 · 초록 알약 = 약 먹는 때. 위는 약국에서 산 약, 아래는 병원 처방이에요.</figcaption></figure></div><div><p class="sim-score"><b>${first} / ${asked}</b> 질문을 한 번에 통과했어요.</p>
      <p class="sim-saved">되짚은 처방 → <span lang="en">${segHTML(ml)}</span> ${lpBtn(meSeq(ml), '되짚기 한 줄 듣기')}</p>
      <p class="sim-react ok"><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>
      <ol class="sim-log">${SIM.log.filter(Boolean).map(L => `<li><span class="who">${esc(WHO[L.sp] || '직원')}</span>${lpBtn([{ text: L.en, sp: L.sp }], '듣기')}<span lang="en">${esc(L.en)}</span><br><span class="who me">나</span>${lpBtn(meSeq(L.final), '듣기')}<span lang="en">${esc(L.final)}</span>${L.tries.length > 1 ? ` <small>(${L.tries.length}번째에 통과)</small>` : ''}</li>`).join('')}</ol>
      <div class="tg-acts"><button type="button" class="btn" id="simAgain">새 카드로 다시 (N)</button>${hear ? `<button type="button" class="btn ghost" data-lp="${seqId(SIM.log.filter(Boolean).flatMap(L => [{ text: L.en, sp: L.sp }, { text: L.final, sp: 'me', gap: 0.4 }]))}">대화 전체 듣기</button>` : ''}</div></div></div>`;
    drawSimDay(C);
    return;
  }
  const q = simQ(), show = SIM.script || !hear, line = q.intent === 'dose';
  let fa = null;
  if (SIM.f) { const Fm = PH.FRAME[SIM.f]; if (!Fm.slot || SIM.v) { fa = { f: SIM.f }; if (Fm.slot) fa.v = SIM.v; } }
  let h = `${lsnBar(SIM.script)}`;
  h += `<div class="sim-officer">${staffSVG(PHS.kindOf(q))}<p class="sim-bub"><span class="who">${esc(whoOf(q))}</span><span class="ldr-t" lang="en">${lineHTML(q.en, show ? keyMarks(q) : [], show)}</span>${show ? SHI(q.shape) : ''}${hear ? `<button type="button" class="lp-play lp-mini" data-simline="1" aria-label="다시 듣기" title="다시 듣기">${SVG_PLAY}</button>` : ''}</p></div>`;
  if (SIM.react) h += `<p class="sim-react ${SIM.react.st}"><span class="who">${esc(SIM.react.who || whoOf(q))}</span><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>`;
  const mic = SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 대답하기 (M)'}</button>` : '';
  if (line) {
    const L = SIM.line, a = PH.L(L.words.slice());
    h += `<div class="sim-build"><p class="sim-lab">되짚기 한 줄 — 들은 차례대로 조각을 누르세요 <small>같은 자리의 조각은 바꿔 끼워져요 · Backspace 하나 지우기</small></p>
      ${SIM.chips.map(gr => row(PH.OCAT[gr.c].ko, `<div class="seg">${gr.ids.map(w => `<button type="button" data-sw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(PH.OW[w].t)}</span></button>`).join('')}</div>`)).join('')}
      <div class="sim-ans"><span class="who me">나</span>${L.words.length ? `<span lang="en" class="sim-line">${segHTML(a)}</span>` : '<span class="note">조각을 고르세요. 양 · 하루 몇 번 · 언제 · 며칠 동안을 들은 차례대로.</span>'}</div>
      <div class="tg-acts"><button type="button" class="btn" id="simLine"${L.words.length ? '' : ' disabled'}>되짚기 (Enter)</button><button type="button" class="btn ghost" id="simLineClear"${L.words.length ? '' : ' disabled'}>지우기</button><button type="button" class="btn ghost" id="simSkip">되짚지 않고 → Okay. Thanks.</button>${mic}</div></div>`;
  } else {
    h += `<p class="sim-lab">① 대답 틀 <small>1~${SIM.frames.length}</small></p><div class="chips" role="group" aria-label="대답 틀">${SIM.frames.map((f, k) => `<button type="button" class="chipf" data-sf="${f}" aria-pressed="${SIM.f === f}"><small>${k + 1}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}</div>`;
    const Fm = SIM.f ? PH.FRAME[SIM.f] : null;
    if (Fm && Fm.slot) h += `<p class="sim-lab">② 내 정보 넣기 <small>A~C</small></p><div class="chips" role="group" aria-label="칸에 넣을 정보">${SIM.slots[SIM.f].map((v, k) => `<button type="button" class="chips-s" data-sv="${esc(v)}" aria-pressed="${SIM.v === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(slotLabel(SIM.f, v))}</span></button>`).join('')}</div>`;
    h += `<div class="sim-ans"><span class="who me">나</span>${fa ? `<span lang="en" class="sim-line">${segHTML(fa)}</span>` : SIM.f ? `<span lang="en" class="sim-line">${chipT(SIM.f)}</span>` : '<span class="note">틀을 고르세요.</span>'}</div>`;
    h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${fa ? '' : ' disabled'}>대답하기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${SIM.f ? '' : ' disabled'}>지우기</button>${mic}</div>`;
  }
  if (SIM.heard) h += `<p class="note">들린 말: <span lang="en">${esc(SIM.heard)}</span></p>`;
  if (SIM.why) {
    const { j, model } = SIM.why, st = j.ok ? '통과' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸렸어요';
    h += `<div class="sim-why ${j.ok ? 'ok' : 'no'}"><p><b>${esc(st)}</b> ${esc(j.why)}</p>${j.ok ? '' : `<p>모범 대답 ${lpBtn(meSeq(model), '모범 대답 듣기')}<span lang="en">${segHTML(model)}</span> <small>${esc(PH.ko(model))}</small></p>`}${SIM.why.spoken ? '<p class="note">말로 한 대답은 낱말과 카드의 사실(증상 · 들은 숫자 · 날짜 · 먹는 법)만 맞춰 봐요. 질문의 모양(yes · no만 했는지)은 보지만, 공손함과 발음은 판정하지 않아요.</p>' : ''}</div>`;
  }
  box.innerHTML = h;
  paintPlay($('sim'), SIM.mode);
}
// 상대 얼굴 (영상의 avatar와 같은 색): 약사(흰 가운 · 이름표) · 호주 약사(흰 가운 · 안경) · 접수 직원(목걸이 줄) · 의사(흰 가운 · 청진기)
const LOOKS = PHS.LOOK;
const staffSVG = kind => {
  const L = LOOKS[kind] || LOOKS.pharm;
  return `<svg class="sim-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#202A36"/>`
    + (L.long ? `<path d="M14.6 19h4v12h-4zM29.4 19h4v12h-4z" fill="${L.hair}"/>` : '')
    + `<ellipse cx="24" cy="47" rx="19" ry="14" fill="${L.shirt}"/>`
    + (L.coat ? `<path d="M5.5 47a19 14 0 0 1 12.5-13.2L22.5 48zM42.5 47a19 14 0 0 0-12.5-13.2L25.5 48z" fill="${L.coat}"/>` : '')
    + (L.steth ? `<path d="M19 34.5c0 7 2.2 9 5 9s5-2 5-9" stroke="${L.steth}" stroke-width="1.6" fill="none"/><circle cx="24" cy="44" r="1.8" fill="${L.steth}"/>` : '')
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
    onText(alts) { const q = simQ(), C = simC(), best = alts.find(t => PH.matchSpoken(t, q, C).ok) || alts[0]; simAnswer(null, best); simKeep(); },
    onFail(msg) { SIM.react = { en: '…', ko: msg, st: 'no' }; simBuild(); simKeep(); },
  });
}
function simLineSubmit() { const L = SIM.line; if (!L.words.length) return; simAnswer(PH.L(L.words.slice())); }
function simSayChips() {
  if (!SIM.f) return;
  const Fm = PH.FRAME[SIM.f]; if (Fm.slot && !SIM.v) return;
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
    if (b.id === 'simSkip') { simAnswer({ f: 'ds_ok' }); simKeep(); return; }
    if (b.dataset.simline) { simAsk(null, false); return; }
    if (b.dataset.act === 'play') { if (SIM.mode === 'play' && PHV.busy()) PHV.stop(); else simAsk(null, false); return; }
    if (b.dataset.act === 'slowplay') { if (SIM.mode === 'slowplay' && PHV.busy()) PHV.stop(); else simAsk(null, true); return; }
    if (b.dataset.act === 'script') { SIM.script = !SIM.script; simBuild(); simKeep(); }
  });
  $('sim').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), onBtn = e.target.closest && e.target.closest('button');
    if (!SIM.started) { if (e.key === 'Enter' && !onBtn) { e.preventDefault(); $('simGo').click(); } return; }
    if (SIM.done) { if (k === 'N' || (e.key === 'Enter' && !onBtn)) { e.preventDefault(); $('simAgain').click(); } return; }
    const n = '1234'.indexOf(e.key), sv = 'ABC'.indexOf(k), q = simQ();
    if (q.intent === 'dose') {
      if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simLineSubmit(); simKeep(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); SIM.line.words.pop(); simBuild(); simKeep(); return; }
    } else if (n >= 0 && n < SIM.frames.length) { e.preventDefault(); SIM.f = SIM.frames[n]; SIM.v = null; simBuild(); simKeep(); return; }
    else if (sv >= 0 && SIM.f && PH.FRAME[SIM.f].slot && SIM.slots[SIM.f][sv] != null) { e.preventDefault(); SIM.v = SIM.slots[SIM.f][sv]; simBuild(); simKeep(); return; }
    else if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simSayChips(); simKeep(); return; }
    else if (e.key === 'Backspace') { e.preventDefault(); SIM.f = null; SIM.v = null; simBuild(); simKeep(); return; }
    if (k === 'R' && PHV.supported) { e.preventDefault(); simAsk(null, false); }
    else if (k === 'S' && PHV.supported) { e.preventDefault(); simAsk(null, true); }
    else if (k === 'T' && PHV.supported) { e.preventDefault(); SIM.script = !SIM.script; simBuild(); simKeep(); }
    else if (k === 'M' && SRC) { e.preventDefault(); simMic(); }
    else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
  });
  simNew(); SIM.started = false; simBuild();
}
/* =========================================================
   11. 약국 · 병원 표현 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 숫자는 15든 fifteen이든 같은 숫자로 맞춰요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = PH.PLACES.map(p => ({ p, rows: PH.SHADOW.map((s, i) => [s, i]).filter(([s]) => s.place === p.id) })).filter(g => g.rows.length);
  $('shList').innerHTML = groups.map(({ p, rows }) => `<section class="sh-grp"><h3>${PI(p.id)}${esc(p.ko)} <span lang="en">${esc(p.en)}</span></h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${PHV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-who ${s.who}">${s.who === 'me' ? '나' : esc(WHO[s.sp] || '직원')}</span><span class="sh-en" lang="en">${esc(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { const s = PH.SHADOW[i]; return [{ text: s.en, sp: s.sp }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = PH.SHADOW[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, PH.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.words.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.t)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}${/Kim|K-I-M|drowsy|penicillin/.test(s.en) && r.hit < r.total ? ' (이름 · 철자 · 약 이름은 음성 인식이 다르게 적기 쉬워요.)' : ''}</p>`);
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${PHV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
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
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (b) b.classList.remove('saying'); if (thenOrig && PHV.supported) speak(shSeq(i)); };
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
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', p: '#FFC15E', bad: '#FF8E8E', hover: '#6EC8FF', box: '#2A3644', key: '#FFC15E', line: '#5A6878', pill: '#7FE0A8' };
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
        PHS.shapeMark(g, sh, x, 92, 34);
        g.font = qfont(14, 700); g.fillStyle = QCOL.text; g.fillText(PH.SHAPE[sh].ko, x, 150);
        g.font = qfont(12, 500); g.fillStyle = QCOL.muted; g.fillText(PH.SHAPE[sh].mark, x, 172);
      });
    } };
}
// 하루 시간표 넷 (줄마다 A~D) — 약 먹는 때는 규칙 엔진(PH.schedule)이 계산
function dayFig(label, doses) {
  const Wd = 600, rh = 74, top = 34, H = top + doses.length * rh + 8, x0 = 74, x1 = Wd - 26, ax = hr => x0 + (hr - 6) / 18 * (x1 - x0);
  return { width: Wd, height: H, label,
    pick: (x, y) => { const i = Math.floor((y - top) / rh); return i >= 0 && i < doses.length ? i : -1; },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      g.font = qfont(11, 600); g.fillStyle = QCOL.muted; g.textAlign = 'center'; g.textBaseline = 'middle';
      [6, 12, 18, 24].forEach(hr => g.fillText(`${hr}:00`, ax(hr), 16));
      doses.forEach((D0, i) => {
        const y = top + i * rh, cy = y + rh / 2, c = markOf(i, st);
        rrq(g, 8, y + 4, Wd - 16, rh - 8, 10); g.fillStyle = st.hover === i ? QCOL.box : 'rgba(255,255,255,0.03)'; g.fill();
        if (c) { g.strokeStyle = c; g.lineWidth = 2.6; g.stroke(); }
        qLetter(g, 34, cy, i);
        g.strokeStyle = QCOL.line; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, cy); g.lineTo(x1, cy); g.stroke();
        PH.MEALS.forEach(hr => PHS.icon(g, 'meal', ax(hr), cy - 18, 13, QCOL.muted, 1.5));
        PHS.icon(g, 'moon', ax(PH.BED), cy - 18, 13, QCOL.muted, 1.5);
        PH.schedule(D0).forEach(hr => { g.beginPath(); g.arc(ax(hr), cy, 8, 0, Math.PI * 2); g.fillStyle = QCOL.pill; g.fill(); g.font = qfont(10, 700); g.fillStyle = QCOL.muted; g.textAlign = 'center'; g.fillText(hr % 1 ? `${Math.floor(hr)}시 반` : `${hr}시`, ax(hr), cy + 20); });
      });
    } };
}
// 몸 그림 (곳 넷에 A~D)
function bodyQFig(label, parts) {
  const Wd = 600, H = 360, cx = 300, cy = 212, s = 1.6, letters = {};
  parts.forEach((p, k) => { letters[p] = L4[k]; });
  return { width: Wd, height: H, label,
    pick: (x, y) => { let best = -1, bd = 40; parts.forEach((p, k) => { const [px, py] = PHS.bodyAt(cx, cy, s, p), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = k; } }); return best; },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      g.save(); PHS.bodyFig(g, cx, cy, s, { letters }); g.restore();
      parts.forEach((p, k) => { const c = markOf(k, st); if (!c) return; const [px, py] = PHS.bodyAt(cx, cy, s, p); g.beginPath(); g.arc(px, py, 18, 0, Math.PI * 2); g.strokeStyle = c; g.lineWidth = 3.2; g.stroke(); });
    } };
}
// 약 봉투 라벨 (줄 넷에 A~D) — 줄 위치는 PHS.paper와 같은 셈 (머리 54 + 약 이름 30, 줄 높이 32)
function labelFig(label, D0, name) {
  const Wd = 600, lw = 400, lx = (Wd - lw) / 2 + 16, ly = 12, top = 84, rh = 32, H = ly + top + 4 * rh + 12 + 14;
  return { width: Wd, height: H, label,
    pick: (x, y) => { const i = Math.floor((y - ly - top) / rh); return x > lx - 40 && x < lx + lw && i >= 0 && i < 4 ? i : -1; },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      g.save(); PHS.medLabel(g, lx, ly, lw, D0, { rx: true, name }); g.restore();
      for (let i = 0; i < 4; i++) {
        const y = ly + top + i * rh, c = markOf(i, st);
        if (c) { rrq(g, lx + 6, y + 2, lw - 12, rh - 4, 6); g.strokeStyle = c; g.lineWidth = 2.6; g.stroke(); }
        qLetter(g, lx - 20, y + rh / 2, i);
      }
    } };
}
const QS = (() => {
  const o = PH.o, j = (q, a, c) => PH.judge(q, a, c || {}).ok;
  const need = [o('cs_fact', 'sorethroat'), o('cs_give', 'sorethroat'), o('cs_rec', 'sorethroat'), o('cs_sick', 'throat')];
  const since = [o('sn_since', 'yday'), o('sn_from', 'yday'), o('g_yes'), o('sn_dur', '2d')];
  const alg = [o('al_dont'), o('g_yesp'), o('al_allergy', 'penicillin'), o('al_not')];
  const lines = [PH.LINE_EAT, PH.LINE, PH.LINE_X3, PH.LINE_MISS];
  const DAYS = [{ amt: 't1', freq: 'f3', time: 'after', len: 'd5' }, { amt: 't1', freq: 'e4', time: null, len: 'd5' }, { amt: 't1', freq: 'f2', time: null, len: 'd5' }, { amt: 't1', freq: 'e6', time: null, len: 'd5' }];
  const dob = [o('db_ko', '2005-03-04'), o('db_is', '2005-04-03'), o('db_is', '2005-03-04'), o('g_yes')];
  const PARTS = ['ear', 'throat', 'chest', 'stomach'];
  const RXD = PH.rx('sorethroat', null);
  const note = [o('q_diag'), o('g_yes'), o('q_note'), o('q_give')];
  const q = [
    { q: '약사가 Hi there. What can I get for you today? 하고 물어요. 목이 아파서 먹을 만한 약을 사고 싶어요. 가장 알맞은 대답은?', opts: need.map(PH.text), a: 2,
      why: '증상(사실) + 부탁(질문) → I have a sore throat. Could you recommend something for it? (A) 사실만 말하면 무엇을 바라는지 몰라요. (B) Give me …는 명령처럼 들리고, (D) My throat is sick.은 낱말 그대로 옮긴 말이라 어색해요.',
      check: () => need.map(a => j('cn_what', a, { sym: 'sorethroat', part: 'throat' })).join() === 'false,false,true,false' },
    { q: 'How long have you had it? — 어제부터 아팠어요. 가장 알맞은 대답은?', opts: since.map(PH.text), a: 0,
      why: '시작한 때(yesterday · Monday) 앞에는 since → Since yesterday. 센 기간(two days) 앞에는 for → For two days. (B) From yesterday.는 끝이 없어 어색하고, (C) Yes.로는 답이 안 되고(정보 질문), (D) During은 ‘동안’을 그대로 옮긴 말이에요.',
      check: () => since.map(a => j('ak_long', a, { since: 'yday' })).join() === 'true,false,false,false' },
    { q: '약사가 묻는 말: Would you prefer tablets or liquid? 이 질문의 모양은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: shapeFig('질문의 모양 넷. A Yes/No 질문(스위치), B 고르는 질문(갈림길), C 정보 질문(빈 상자), D 안내(말풍선)'),
      why: 'A or B? → 둘 가운데 하나를 고르라는 고르는 질문(갈림길)이에요. 고른 것 + please → Tablets, please. Yes, please.로는 무엇을 골랐는지 알 수 없어요.',
      check: () => PH.Q.ak_form.shape === 'or' && !j('ak_form', o('g_yesp'), { form: 'tablets' }) && j('ak_form', o('fm_pl', 'tablets'), { form: 'tablets' }) },
    { q: 'Are you allergic to any medicine? — 약 알레르기는 없어요. 가장 알맞은 대답은?', opts: alg.map(PH.text), a: 3,
      why: 'Are you …? 질문에는 첫 낱말의 짝으로 → No, I\'m not. (A) No, I don\'t.는 Do you …? 질문의 짝이에요(Do you have any allergies? 였다면 정답). (B) Yes, please.는 알레르기가 있다는 말이 되고, (C) allergy to는 낱말이 틀렸어요(allergic to).',
      check: () => alg.map(a => j('ak_allergy', a, { allergy: null })).join() === 'false,false,false,true' },
    { q: '약사 → Take two tablets three times a day after meals, for five days. 들은 것을 되짚는 말로 가장 알맞은 것은?', opts: lines.map(PH.lineText), a: 1,
      why: 'So, I take + 들은 조각을 차례대로 → (B). (A) 약을 eat이라고 하면 음식처럼 씹어 먹는다는 말로 들려요(약은 take). (C) three times one day는 ‘하루 세 번’을 낱말 그대로 옮긴 말이에요(three times a day). (D) after meals를 빠뜨려 언제 먹는지 확인하지 못했어요.',
      check: () => lines.map(L => j('ds_say', PH.L(L.words), { sym: 'sorethroat', form: 'tablets' })).join() === 'false,true,false,false' },
    { q: '약 상자에 Take one tablet every six hours.라고 적혀 있어요. 아침 8시에 처음 먹는다면, 하루 시간표는? 줄을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: dayFig('하루 시간표 넷. A 8시 반 · 13시 반 · 19시 반, B 8시 · 12시 · 16시 · 20시, C 8시 · 19시, D 8시 · 14시 · 20시', DAYS),
      why: 'every six hours → 여섯 시간마다 → 8시 · 14시 · 20시(D). (A)는 three times a day after meals(식후 하루 세 번), (B)는 every four hours(네 시간마다), (C)는 twice a day(하루 두 번)예요. 약 이름과 먹는 법은 지어낸 예시예요.',
      check: () => PH.schedule(DAYS[3]).join() === '8,14,20' && PH.schedule(DAYS[1]).join() === '8,12,16,20' && PH.schedule(DAYS[2]).length === 2 },
    { q: 'And what\'s your date of birth? — 생년월일은 2005년 3월 4일이에요. 가장 알맞은 대답은?', opts: dob.map(PH.text), a: 2,
      why: 'It\'s + 달 이름 + 날(서수) + 해 → It\'s March 4th, 2005. (A) 숫자만 한국식 순서로 말하면 어느 것이 달인지 헷갈려요. (B) April 3rd는 달과 날이 바뀌었어요. (D) Yes.로는 답이 안 돼요(정보 질문).',
      check: () => dob.map(a => j('fr_dob', a, { dob: '2005-03-04' })).join() === 'false,false,true,false' },
    { q: '의사가 Okay. Where does it hurt? 하고 물어서 It hurts in my ear.라고 했어요. 의사가 살펴볼 곳은? 그림의 글자를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 0,
      figure: bodyQFig('몸 그림. A 귀, B 목, C 가슴, D 배', PARTS),
      why: 'in my ear → 귀(A). in my throat → 목, in my chest → 가슴, in my stomach → 배. 아픈 자리 → It hurts in my + 곳.',
      check: () => PH.PART.ear.t === 'in my ear' && j('ex_where', o('wh_in', 'ear'), { part: 'ear' }) && !j('ex_where', o('wh_in', 'throat'), { part: 'ear' }) },
    { q: '병원에서 받은 약 봉투 라벨이에요. 하루에 몇 번 먹는지 적힌 줄은? 줄을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: labelFig(`약 봉투 라벨. A AMOUNT ${PH.AMT[RXD.amt].t}, B HOW OFTEN ${PH.FREQ[RXD.freq].t}, C WHEN ${PH.WHEN[RXD.time].t}, D HOW LONG ${PH.LEN[RXD.len].t.replace(/^for /, '')}`, RXD, 'ANTIBIOTICS'),
      why: `HOW OFTEN → 얼마나 자주(하루 몇 번) → ${PH.FREQ[RXD.freq].t}(${PH.FREQ[RXD.freq].ko}). AMOUNT → 한 번에 먹는 양, WHEN → 언제(식전 · 식후 · 밥과 함께), HOW LONG → 며칠 동안. 처방은 지어낸 예시예요.`,
      check: () => RXD.freq === 'f2' && PH.FREQ[RXD.freq].per === 2 },
    { q: 'Do you have any other questions? — 수업을 빠져서 학교에 낼 진단서(확인서)가 필요해요. 가장 알맞은 말은?', opts: note.map(PH.text), a: 2,
      why: '물어볼 것이 있으면 Yes. + 부탁 질문 → Yes. Could I get a doctor\'s note for my class? (A) diagnosis는 ‘진단(병명)’이라 다른 서류로 들리고, (B) Yes.만 하면 무엇이 필요한지 모르고, (D) Give me …는 명령처럼 들려요.',
      check: () => note.map(a => j('pl_q', a, { note: true })).join() === 'false,false,true,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[약국 · 병원] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { if (x.a < 4) pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[약국 · 병원] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { PHV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = PHS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * PHS.W, (e.clientY - r.top) / r.height * PHS.H]; };
const hitAt = (x, y) => started ? PHS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.stop != null) { S.stop = S.stop === h.stop ? null : h.stop; relab(); }
  else if (h && h.play && PHV.supported) speak(h.play);
  else if (h && h.say && PHV.hasClip('tc', h.say)) speak([{ text: h.say, sp: 'tc' }]);   // 미리 만든 발음(음성 해설의 영어와 같은 목소리)
  else if (h && h.say && EN.say.supported) { stopSounds(); if (playing) pause(); EN.say(PH.spoken(h.say)); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.stop != null ? '눌러서 이곳의 말 보기' : h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { PHV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = PHV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 대화 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 글이 정해진 말만 모아요: 영상의 말풍선 · 발음 칩, 질문(PH.Q), 직접 해 보기(곳 · 3단계 · 증상 · 접수 · 진찰 · 처방은 하나씩 골라 봄),
// 듣고 대답 고르기, 따라 말하기. 약국 · 병원 시뮬레이터(카드마다 바뀌는 말)와 내가 칩으로 만든 문장은 브라우저 음성이라 빼요.
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text || !/[A-Za-z]/.test(text) || /^\(.*\)$/.test(String(text).trim())) return;   // (지문)은 읽지 않음
    const id = PHV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: PHV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(PHS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 말풍선(그 사람) · 영어 칩(발음 듣기 tc). 곳(map) · 3단계(method) 장은 하나씩 골라 놓고 한 번 더
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return ch ? [ch.t, ch.t + ch.d] : null; };
    const sweeps = [[{}, [0, END]]].concat(PH.PLACES.map((_, k) => [{ stop: k }, span('map')]), PH.METHOD.map((_, k) => [{ place: k }, span('method')])).filter(x => x[1]);
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.25) {
        PHS.render(g, t);
        PHS.hits().forEach(h => { if (h.play) addSeq(h.play, 'video'); else if (h.say) add('tc', h.say, 'video-say'); });
      }
    });
    // 2) 직접 해 보기: 장마다 처음 화면 + 곳 · 3단계는 하나씩 골라서 (듣기 단추에 걸린 말)
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* 그리기만 하는 칸 */ } });
    PH.PLACES.forEach((_, k) => { S.stop = k; try { LABS.map(); } catch (e) { /* */ } });
    S.stop = null;
    PH.METHOD.forEach((_, k) => { S.place = k; try { LABS.method(); } catch (e) { /* */ } });
    S.place = null;
    const tryLab = (k, f) => { try { f(); LABS[k](); } catch (e) { (window.__labErrs = window.__labErrs || []).push(k + ": " + e.message); } };
    PH.SYM_IDS.forEach(sym => ['rec', 'any', 'fact', 'sick', 'give'].forEach(style => tryLab('counter', () => { Object.assign(LAB.need, { sym, style }); })));
    ['for', 'since'].forEach(since => tryLab('counter', () => { LAB.need.since = since; }));
    AUX_SET.forEach((X, k) => X.a.forEach((_, a) => tryLab('ask', () => { LAB.aux = { k, a }; })));
    PH.SYM_IDS.forEach(sym => ['tablets', 'liquid'].forEach(form => tryLab('dose', () => { LAB.line = { sym, form, words: [], skip: true }; })));
    PH.NAME_IDS.forEach(name => DOB_OPTS.forEach(dob => ['travel', 'student'].forEach(ins => tryLab('front', () => { LAB.front = { name, dob, ins }; }))));
    PH.SYM_IDS.forEach(sym => ['have', 'hurt', 'sick'].forEach(style => [''].concat(PH.MED_IDS).forEach(took => ['took', 'ate'].forEach(tk => tryLab('doctor', () => { LAB.prob = { sym, style, took: took || null, tk }; })))));
    PH.PART_IDS.forEach(part => [true, false].forEach(press => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(scale => tryLab('exam', () => { Object.assign(LAB.exam, { part, press, scale }); }))));
    ['ak_allergy', 'ex_allergy'].forEach(aq => [null, 'penicillin'].forEach(al => ALG_OPTS.forEach((_, aa) => tryLab('exam', () => { Object.assign(LAB.exam, { aq, al, aa }); }))));
    PH.SYM_IDS.forEach(sym => [null, 'penicillin'].forEach(allergy => [true, false].forEach(note => [0, 1, 2, 3].forEach(back => tryLab('plan', () => { LAB.plan = { sym, allergy, words: [], skip: true, back, note }; })))));
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 듣고 대답 고르기 · 먼저 골라 보기: 상대의 말 + 보기 넷
  PH.DRILL.concat(Object.values(PH.MINI)).forEach(it => { const Q = it.Q || PH.Q[it.q]; if (Q) addSeq(staffSeq(Q), 'drill'); it.opts.forEach(op => add('me', PH.text(op), 'drill')); });
  // 4) 따라 말하기
  PH.SHADOW.forEach((s0, i) => addSeq(shSeq(i), 'shadow'));
  // 5) 질문 목록의 나머지(상대의 말)
  Object.values(PH.Q).forEach(q => addSeq(staffSeq(q), 'q'));
  return out;
};
simInit();
shInit();
PDrill($('drillRoot'), PH.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 모양 잡기 → 틀 + 내 정보 → 공손하게, 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 03 · 04 · 09장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '약국과 병원의 일곱 곳, 사실 + 부탁과 복용법 되짚기가 모두 익숙해졌네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(PHS.baseText()).then(() => { dirty = true; });
setTimeout(() => PHS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
