/* 쇼핑 회화 — 플레이어, 직접 해 보기, 쇼핑 시뮬레이터, 따라 말하기, 듣고 대답 고르기, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(SH), 그림은 scenes.js(SHS), 목소리는 voices.js(SHV)가 맡습니다.
 * 소리가 겹치지 않게: 대화를 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(SHV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const SH = window.SH, SHS = window.SHS, SHV = window.SHV, S = SHS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = SHS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cv = $('cv'), ctx = cv.getContext('2d');
SH.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = SHS.fonts;
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
  const ready = new Promise(res => SHS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '쇼핑, 이것에 바꿀 점만 더한다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { SHS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: SHS.iconSVG('mic'),
};
const PI = id => SHS.iconSVG(id, 'pi');   // 곳 아이콘
const CI = id => { const it = SH.ITEMS[id]; return SHS.iconSVG(id, 'pi', SH.COLORS[it.colors[0]].hex); };   // 물건 아이콘 (몸통을 그 물건의 첫 색으로)
const SHI = sh => `<span class="shp shp-${sh}">${SHS.iconSVG('shape_' + sh, 'pi')}${esc(SH.SHAPE[sh].ko)}</span>`;   // 질문의 모양 표시
// 듣기 · 천천히 · 대본 보기 단추 묶음 (공항 · 카페 · 호텔 · 식당과 같은 모양 · 같은 키 R · S · T)
const lsnBar = scriptOn => SHV.supported
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
  const cap = started ? SHS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 말풍선을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = SHS.chapterAt(T);
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
  if (dirty) { dirty = false; SHS.render(ctx, started ? T : POSTER); }
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
function stopSounds() { EN.say.stop(); SHV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return SHV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름
const lpBtn = (seq, label, cls = '') => SHV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
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
const meSeq = a => [{ text: typeof a === 'string' ? a : SH.text(a), sp: 'me' }];
// 말하는 사람 (목소리마다 한 사람): 매장 직원 en-US · 탈의실 직원 en-CA · 계산대 직원 en-AU · 영국 가게의 직원 en-GB
const WHO = { us: '매장 직원', ca: '탈의실 직원', au: '계산대 직원', gb: '직원 (영국)' };
const whoOf = q => WHO[q.sp] || '직원';

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
const segHTML = (a, on = true) => SH.segs(a).map(s => on && s.t.trim() && /[A-Za-z0-9]/.test(s.t) ? `<mark class="mk-${s.r}">${esc(s.t)}</mark>` : esc(s.t)).join('');
const keyMarks = q => q.key.map(t => ({ t, role: 'key' }));

/* =========================================================
   6. 듣고 대답 고르기 (이 튜토리얼 전용, 식당 RDrill과 같은 모양) — 직원의 말은 소리 먼저, 대답 넷은 글
   생김새와 키보드는 공통 부품 EN.drill과 같게: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본 · Enter/→ 다음
   힌트 ①부터 질문의 모양 표시(스위치 · 갈림길 · 빈 상자 · 말풍선)가 직원의 말 옆에 나와요.
   ========================================================= */
function SDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null;
  const compact = !!cfg.compact, hear = SHV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && SHV.busy()) { SHV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(staffSeq(it.Q), { slow: !!slow, onitem() { paintNow(root, '.ldr-q'); say(it.Q.fast ? '직원이 빠르게 말하는 중' : '직원이 말하는 중'); },
      onend(stopped) { mode = null; paintPlay(root, null); paintNow(root, null); say(stopped ? '' : '다 들었어요. 대답을 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { SHV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; SHV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    SHV.stop();
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = SH.steps(it), place = SH.PLACE[it.place];
    const marks = []; steps.slice(0, done ? 3 : s.hints).reverse().forEach(x => marks.push(...x.marks));   // 뒤 단계의 색이 앞 단계를 덮음
    const reveal = done || !hear || s.script, mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur), showShape = (done || s.hints > 0) && !it.Q.fast;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${PI(it.place)}${esc(place.ko)}</span><span>${compact ? '듣고 대답 고르기' : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span>${done ? `<span class="edr-tag">${it.Q.fast ? '다시 묻기' : esc(SH.SHAPE[it.Q.shape].ko)}</span>` : ''}</p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(it.sit)}</p>`;
    h += lsnBar(done ? null : s.script);
    h += `<p class="ldr-q"><b>${esc(whoOf(it.Q))}</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="q" aria-label="직원의 말 다시 듣기" title="직원의 말 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.Q.en, mk('q'), reveal)}</span>${showShape ? SHI(it.Q.shape) : ''}${it.Q.fast && !done ? '<small class="adr-fast">아주 빠르게</small>' : ''}</p>`;
    h += `<p class="adr-ask">나의 대답은?</p><div class="ldr-opts" role="group" aria-label="대답 보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '', t = SH.text(op);
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-lp="${seqId(meSeq(t))}" aria-label="(${L4[k]}) 듣기" title="(${L4[k]}) 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(t, mk(k), true)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + SH.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = [[`${whoOf(it.Q)} · ${it.Q.en}`, it.Q.ko, staffSeq(it.Q)]].concat(it.opts.map((op, k) => [`(${L4[k]}) ${SH.text(op)}`, SH.ko(op), meSeq(op)]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      h += `<div class="edr-acts">${hear ? `<button type="button" class="edr-btn ghost adr-ex" data-lp="${seqId(staffSeq(it.Q).concat([{ text: SH.text(it.opts[it.a]), sp: 'me', gap: 0.5 }]))}">${ICO.play} 대화 듣기 (직원 → 나)</button>` : ''}${compact ? '' : `<button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button>`}</div>`;
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
const frameT = f => esc(SH.FRAME[f].t.replace(/[{}]/g, ''));
const sizeT = z => esc(SH.SIZE[z].tag);
const midSize = item => { const L = SH.SIZES[SH.ITEMS[item].kind]; return L[Math.floor(L.length / 2)]; };
const LAB = {
  line: { card: 'change', words: [] },
  shape: { q: null, pick: null, yes: false },
  size: { item: 'tee', want: 'm', f: 'sz_pl', v: null },
  fit: { item: 'tee', fit: 'tight', f: 'fi_its', v: null },
  price: { item: 'hoodie', off: 50 },
  bill: { item: 'hoodie', off: 50, bogo: true, paym: 'card' },
  ret: { ret: 'exchange', days: 5, receipt: true, final: false },
};
const LAB0 = JSON.stringify(LAB);
// 02장 바꿀 점 한 줄: 상황 셋 (손에 든 것 → 바라는 것)
const LINE_CARDS = { change: SH.CHANGE_CARD, intro: SH.INTRO.card, jeans: SH.JEANS_CARD };
const LINE_ORDER = ['open', 'dem', 'size', 'color'];
const lineChips = (c, card) => { const it = SH.ITEMS[card.item]; return c === 'size' ? SH.SIZES[it.kind].map(z => 'z_' + z) : c === 'color' ? it.colors.map(k => 'k_' + k) : SH.LINE_CHIPS[c]; };
// 같은 갈래의 조각을 누르면 바꿔 끼우고, 같은 조각을 다시 누르면 빼요
const toggleWord = (words, w) => words.includes(w) ? words.filter(x => x !== w) : words.filter(x => SH.OW[x].c !== SH.OW[w].c).concat([w]);
const SIZE_ITEMS = ['tee', 'dress', 'jeans', 'sneakers'];
const FIT_ITEMS = ['tee', 'hoodie', 'jeans', 'sneakers'];
const PRICE_ITEMS = ['tee', 'hoodie', 'jacket', 'dress', 'jeans', 'sneakers'];
const BILL_ITEMS = ['tee', 'hoodie', 'jeans', 'sneakers'];
const slotAns = r => { const F0 = SH.FRAME[r.f]; return F0.slot ? (r.v ? { f: r.f, v: r.v } : null) : { f: r.f }; };
const billCard = () => { const r = LAB.bill; return { item: r.item, two: SH.ITEMS[r.item].two, off: r.off, bogo: r.bogo, paym: r.paym }; };
const retCard = () => { const r = LAB.ret; return Object.assign({}, r.ret === 'exchange' ? SH.EXCARD : SH.REFCARD, { days: r.days, receipt: r.receipt, final: r.final }); };
// 돌려주기 규칙 → 직원이 다음에 하는 말
function retNext(c) {
  const R = SH.returnRule(c), id = R.ok ? (R.why === 'exchange' ? 'rt_size' : R.why === 'choose' ? 'rt_how' : 'rt_credit') : 'rt_final';
  return { R, q: SH.simQ(id, c) };
}
const LABS = {
  intro: () => `${labHead('먼저 골라서 대답해 보세요')}${mini('intro')}
    <p class="note">직원의 말을 듣고 대답을 고르세요. 직원의 말은 답한 뒤에 글로 보여요. 막히면 힌트(H)로 3단계를 하나씩 열어 보세요.</p>`,
  route: () => {
    const i = S.stop, p = i != null ? SH.PLACES[i] : null;
    return `${labHead('곳을 골라 한두 마디 듣기')}
      ${seg('곳', SH.PLACES.map((x, k) => [k, `${PI(x.id)}${k + 1}. ${esc(x.ko)}`]), i == null ? '' : i, 'stop')}
      ${p ? `<ul class="qlist">${SH.ROUTE[p.id].map(id => { const q = SH.Q[id]; return `<li>${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span><span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span><small>${SHI(q.shape)} ${esc(q.ko)}</small></span></li>`; }).join('')}</ul>
        ${SH.ME_FIRST[p.id] ? '<p class="note">이곳에서는 직원의 말이 질문이 아닐 때가 많아요. 내가 먼저 말을 꺼내요.</p>' : ''}${clearBtn}` : '<p class="note">곳을 고르면 그곳에서 자주 듣는 말을 들을 수 있고, 영상 화면의 평면도에도 표시돼요. 하늘색 → 열쇠 낱말. 보라색 테두리의 곳(물건 찾기 · 탈의실 · 값 · 교환과 환불)에서는 내가 먼저 말을 꺼내요.</p>'}`;
  },
  change: () => {
    const L = LAB.line, card = LINE_CARDS[L.card], a = SH.L(L.words.slice());
    const rows = LINE_ORDER.map(c => row(SH.OCAT[c].ko, `<div class="seg">${lineChips(c, card).map(w => `<button type="button" data-lw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(SH.OW[w].t)}</span></button>`).join('')}</div>`)).join('');
    let res = '';
    if (L.words.length) {
      const j = SH.judge('rk_ok', a, card, '상황'), ck = j.ok ? SH.coveredKo(SH.covered(a, 'rk_ok')) : [];
      res = `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}${j.ok ? `<p class="note">직원이 건너뛸 질문 → ${ck.length ? esc(ck.join(' · ')) : '없음'}</p>` : ''}`;
    }
    return `${labHead('바꿀 점 한 줄 만들기')}
      <p class="note">직원이 <span lang="en">Are you finding everything okay?</span> 하고 물어요. 손에 든 것을 보여 주며, 조각을 누르는 차례대로 문장을 만들어요. 일부러 순서를 바꾸거나 같은 점을 넣어 보세요.</p>
      ${row('상황', seg('상황', [['change', `${CI('hoodie')}후드 티 검은색 S → 남색 M`], ['intro', `${CI('hoodie')}후드 티 검은색 S → 검은색 M`], ['jeans', `${CI('jeans')}청바지 30 → 32`]], L.card, 'lc'))}
      <p class="note">손에 든 것: ${esc(SH.itemKo(card, 'hand'))} → 바라는 것: ${esc(SH.itemKo(card))}${card.two ? ' (둘이 짝 → these)' : ''}</p>
      ${rows}${res}
      <div class="tg-acts mt8"><button class="btn ghost" type="button" id="lineClear">처음부터</button>${S.line ? clearBtn : ''}</div>
      <p class="note">순서(묻는 틀 → this · these → in + 크기 · in + 색, 크기와 색은 어느 쪽이 먼저여도 돼요)는 자주 쓰는 순서를 단순하게 줄인 규칙이에요.</p>`;
  },
  door: () => {
    const r = LAB.shape, q = r.q ? SH.Q[r.q] : null;
    let res = '';
    if (q && r.pick) res = `<p class="verdict"><b class="${r.pick === q.shape ? 'c-ok' : 'c-no'}">${r.pick === q.shape ? '맞아요' : '다시 보세요'}</b>${esc(`${SH.SHAPE[q.shape].ko} → ${SH.sayOf(q.intent)}. 대답 → ${SH.SHAPE[q.shape].ans}.`)}</p>`;
    if (q && r.yes) { const j = SH.judge(q, { f: 'g_yesp' }, {}, '상황'); res += `<p class="enline">${lpBtn(meSeq('Yes, please.'), '듣기')}<span lang="en">Yes, please.</span></p>${verdictHTML(j)}`; }
    return `${labHead('질문의 모양 맞히기')}
      <p class="note">직원의 말을 고르고, 모양을 맞혀 보세요. 그다음 <span lang="en">Yes, please.</span>로 대답하면 어떻게 되는지 규칙 엔진에 물어봐요.</p>
      ${seg('직원의 말', SH.SHAPE_QS.map(id => [id, `<span lang="en">${esc(SH.Q[id].short && /\?$|!$/.test(SH.Q[id].short) ? SH.Q[id].short : SH.Q[id].en)}</span>`]), r.q || '', 'sq')}
      ${q ? `<h3 class="mt">이 말의 모양은?</h3>${seg('모양', ['yn', 'or', 'wh', 'note'].map(sh => [sh, SHI(sh)]), r.pick || '', 'sp')}
        <div class="tg-acts mt8"><button type="button" class="btn ghost" id="shapeYes">Yes, please.로 대답해 보기</button>${lpBtn(staffSeq(q), '직원의 말 듣기')}</div>${res}${clearBtn}` : ''}`;
  },
  rack: () => {
    const r = LAB.size, I = SH.ITEMS[r.item], a = slotAns(r), F0 = SH.FRAME[r.f], C = { item: r.item, two: I.two, size: r.want }, j = a ? SH.judge('rk_size', a, C, '상황') : null;
    const vals = SH.SIZES[I.kind].concat(I.kind === 'top' ? ['msize', 'free'] : []);
    return `${labHead('크기 말하기')}
      <p class="note">직원이 <span lang="en">What size are you looking for?</span> 하고 물어요(정보 질문). 물건과 내 크기 →</p>
      ${row('물건', seg('물건', SIZE_ITEMS.map(k => [k, `${CI(k)}${esc(SH.ITEMS[k].ko)}`]), r.item, 'zi'))}
      ${row('내 크기', seg('내 크기', SH.SIZES[I.kind].map(z => [z, sizeT(z)]), r.want, 'zw'))}
      <h3 class="mt">① 틀 고르기</h3>${seg('틀', ['sz_pl', 'sz_im', 'g_yesp'].map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.f, 'zf')}
      ${F0.slot ? `<h3 class="mt">② 칸 채우기</h3>${seg('칸', vals.map(k => [k, `<span lang="en">${esc(SH.SLOT.size.vals[k].t)}</span>`]), r.v || '', 'zv')}` : ''}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}` : '<p class="note">틀과 칸을 고르면 영상 화면의 크기 줄에 표시되고, 규칙 엔진이 3단계로 판정해요. 일부러 <span lang="en">free size</span>나 <span lang="en">Yes, please.</span>를 넣어 보세요.</p>'}
      <p class="note">${esc(I.ko)} → ${esc(SH.KIND_KO[I.kind])}. 신발 크기와 허리 숫자는 나라마다 달라서 미국 크기만 보여 줘요.</p>${S.size ? clearBtn : ''}`;
  },
  fit: () => {
    const r = LAB.fit, I = SH.ITEMS[r.item], a = slotAns(r), F0 = SH.FRAME[r.f], C = { item: r.item, two: I.two, fit: r.fit }, j = a ? SH.judge('ft_how', a, C, '상황') : null;
    let next = '';
    if (r.fit !== 'good') {
      const L = SH.SIZES[I.kind], mid = L[Math.floor(L.length / 2)], nx = SH.sizeFor(r.item, mid, r.fit);
      if (nx) { const m = { f: 'su_try', v: nx }; next = `<h3 class="mt">다른 크기 입어 보기</h3><p class="note">${sizeT(mid)}를 입었는데 ${esc(SH.FIT[r.fit].ko)} → 한 칸 ${SH.FIT[r.fit].up > 0 ? '큰' : '작은'} 크기 ${sizeT(nx)}. 직원 → <span lang="en">Would you like to try a different size?</span></p><p class="enline">${lpBtn(meSeq(m), '듣기')}<span lang="en">${segHTML(m)}</span></p>`; }
    }
    return `${labHead('입어 보니 어떤지 말하기')}
      <p class="note">탈의실 직원이 <span lang="en">How did everything fit?</span> 하고 물어요(정보 질문). 입어 본 물건과 맞음새 →</p>
      ${row('물건', seg('물건', FIT_ITEMS.map(k => [k, `${CI(k)}${esc(SH.ITEMS[k].ko)}`]), r.item, 'fi'))}
      ${row('맞음새', seg('맞음새', [['tight', '꽉 껴요'], ['loose', '헐렁해요'], ['good', '잘 맞아요']], r.fit, 'ff'))}
      <h3 class="mt">① 틀 고르기</h3>${seg('틀', ['fi_its', 'fi_theyre', 'fi_good', 'fi_goods', 'fi_yes'].map(f => [f, `<span lang="en">${frameT(f)}</span>`]), r.f, 'fr')}
      ${F0.slot ? `<h3 class="mt">② 칸 채우기</h3>${seg('칸', Object.keys(SH.FIT).map(k => [k, `<span lang="en">${esc(SH.FIT[k].t)}</span> <small>${esc(SH.FIT[k].ko)}</small>`]), r.v || '', 'fv')}` : ''}
      ${a ? `<p class="enline">${lpBtn(meSeq(a), '듣기')}<span lang="en">${segHTML(a)}</span></p>${verdictHTML(j)}` : '<p class="note">틀과 칸을 고르면 규칙 엔진이 판정해요. 청바지 · 운동화는 둘이 짝이라 They로 말해요.</p>'}
      ${next}${S.fit ? clearBtn : ''}`;
  },
  price: () => {
    const r = LAB.price, I = SH.ITEMS[r.item], c = { item: r.item, two: I.two, off: r.off, ask: 'price' }, q = SH.simQ('pr_cost', c), p = SH.priceOf(c), ask = SH.model('pr_pass', c);
    return `${labHead('값 묻고 듣기')}
      ${row('물건', seg('물건', PRICE_ITEMS.map(k => [k, `${CI(k)}${esc(SH.ITEMS[k].ko)}`]), r.item, 'pi'))}
      ${row('할인', seg('할인', [[0, '할인 없음'], [20, '20%'], [30, '30%'], [50, '50%']], r.off, 'po'))}
      <p class="enline">${lpBtn(meSeq(ask), '듣기')}<span class="who me">나</span><span lang="en">${segHTML(ask)}</span></p>
      <p class="enline">${lpBtn(staffSeq(q), '직원의 말 듣기')}<span class="who">${esc(whoOf(q))}</span><span lang="en">${lineHTML(q.en, keyMarks(q).concat([{ t: SH.money(p), role: 'slot' }]), true)}</span></p>
      <p class="note">읽기 → <span lang="en">${esc(SH.priceWords(p))}</span> · ${esc(SH.priceKo(I.p))}${r.off ? ` → ${r.off}% 할인 → ${esc(SH.priceKo(p))}` : ' (할인 없음)'}. 값은 지어낸 값이고, 영상 · 값표 · 직원의 말이 모두 같은 계산(<code>SH.salePrice</code>)이에요.</p>
      <h3 class="mt">fifteen이냐 fifty냐</h3>
      <ul class="qlist">${SH.PAIRS.map(([n1, s1, n2, s2]) => `<li>${lpBtn([{ text: SH.numWord(+n1), sp: 'tc' }], '듣기: ' + SH.numWord(+n1))}<span><span lang="en">${esc(s1)}</span><small>${n1} · 뒤를 세게</small></span>${lpBtn([{ text: SH.numWord(+n2), sp: 'tc' }], '듣기: ' + SH.numWord(+n2))}<span><span lang="en">${esc(s2)}</span><small>${n2} · 앞을 세게</small></span></li>`).join('')}</ul>
      <h3 class="mt">값을 되물어 확인하기</h3>${mini('cost')}${S.price ? clearBtn : ''}`;
  },
  pay: () => {
    const r = LAB.bill, c = billCard(), B = SH.bill(c), q = SH.simQ('py_pay', c), m = SH.model(q, c);
    return `${labHead('계산대에서 합계 듣기')}
      ${row('물건', seg('물건', BILL_ITEMS.map(k => [k, `${CI(k)}${esc(SH.ITEMS[k].ko)}`]), r.item, 'bi'))}
      ${row('할인', seg('할인', [[0, '할인 없음'], [20, '20%'], [50, '50%']], r.off, 'bo'))}
      ${row('양말', seg('양말', [['1', '하나 사면 하나 더 받기'], ['0', '안 받기']], r.bogo ? '1' : '0', 'bb'))}
      ${row('내는 방법', seg('내는 방법', [['card', '카드'], ['cash', '현금']], r.paym, 'bp'))}
      <ul class="rlist">${B.items.map(it => `<li><span lang="en">${esc(it.en)}${it.off ? ` <small>(${it.off}% off)</small>` : ''}</span><b>${SH.money(it.c)}</b></li>`).join('')}<li class="tot"><span>합계 TOTAL</span><b>${SH.money(B.total)}</b></li></ul>
      <p class="enline">${lpBtn(staffSeq(q), '직원의 말 듣기')}<span class="who">${esc(whoOf(q))}</span><span lang="en">${lineHTML(q.en, keyMarks(q).concat([{ t: SH.money(B.total), role: 'slot' }]), true)}</span></p>
      <p class="note">읽기 → <span lang="en">${esc(SH.priceWords(B.total))}</span> · Cash or card? → 고르는 질문이라 고른 것 + please.</p>
      <p class="enline">${lpBtn(meSeq(m), '맞는 대답 듣기')}<span class="who me">나</span><span lang="en">${segHTML(m)}</span></p>
      <p class="note">값은 지어낸 값이고, 세금은 나라 · 주마다 달라서 빼고 계산했어요. 양말은 하나 사면 하나 더(두 켤레 값 하나). 영상 · 영수증 · 직원의 말이 모두 같은 계산(<code>SH.bill</code>)이에요.</p>${S.bill ? clearBtn : ''}`;
  },
  ret: () => {
    const r = LAB.ret, c = retCard(), { R, q } = retNext(c), m = SH.model(q, c);
    const checks = [['final sale 물건이 아닌가', !c.final], [`${SH.RETURN_DAYS}일 안인가 → ${c.days}일 뒤`, c.days <= SH.RETURN_DAYS], [c.ret === 'exchange' ? '교환 → 바꿀 크기만 말하면 돼요' : `영수증이 있나 → ${c.receipt ? '있음' : '없음'}`, c.ret === 'exchange' || c.receipt]];
    let stop = false;
    const list = checks.map(([t, ok], k) => { const on = !stop; if (k < 2 && !ok) stop = true; return `<li${on ? '' : ' class="off"'}><span>${k + 1}. ${esc(t)}</span><small>${on ? (k < 2 ? (ok ? '네 → 다음' : '아니요 → 돌려받을 수 없어요') : ok ? '네' : '아니요 → 가게 포인트로만') : '보지 않아요'}</small></li>`; }).join('');
    return `${labHead('교환 · 환불 규칙 따라가기')}
      ${row('하려는 일', seg('하려는 일', [['exchange', `${CI('jeans')}교환 (청바지 30 → 32)`], ['return', `${CI('hoodie')}환불 (후드 티)`]], r.ret, 'rr'))}
      ${row('며칠 뒤', seg('며칠 뒤', [3, 14, 29, 45].map(n => [n, `${n}일 뒤`]), r.days, 'rd'))}
      ${row('영수증', seg('영수증', [['1', '있음'], ['0', '없음']], r.receipt ? '1' : '0', 'rc'))}
      ${row('물건', seg('물건', [['0', '보통 물건'], ['1', 'final sale (마지막 할인)']], r.final ? '1' : '0', 'rf'))}
      <ol class="qlist">${list}</ol>
      <p class="enline">${lpBtn(staffSeq(q), '직원의 말 듣기')}<span class="who">${esc(whoOf(q))}</span><span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
      <p class="note">${esc(q.ko)}</p>
      <p class="enline">${lpBtn(meSeq(m), '맞는 대답 듣기')}<span class="who me">나</span><span lang="en">${segHTML(m)}</span></p>
      <p class="note">${R.ok ? '' : '가게 규칙이라 직원이 바꿀 수 없어요. 따지지 말고 공손하게 끝내요. '}가게 규칙(${SH.RETURN_DAYS}일 안 · final sale 물건은 안 됨 · 영수증이 없으면 가게 포인트로만)은 지어낸 것이에요. 실제 가게마다 달라요. 판정은 <code>SH.returnRule</code>이 해요.</p>${S.ret ? clearBtn : ''}`;
  },
  method: () => {
    const i = S.place, rw = i != null ? SH.METHOD[i] : null;
    return `${labHead('곳마다 3단계 적용해 보기')}
      ${seg('곳', SH.METHOD.map(([qid], k) => [k, `${PI(SH.Q[qid].place)}${esc(SH.PLACE[SH.Q[qid].place].ko)}`]), i == null ? '' : i, 'place')}
      ${rw ? (() => { const [qid, a, c] = rw, q = SH.Q[qid], j = SH.judge(q, a, c); return `<p class="enline">${lpBtn(staffSeq(q), '듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
        <ol class="edr-steps"><li><b>① 열쇠 낱말 + 모양</b> ${esc(q.key.join(' … '))} → ${SHI(q.shape)} ${esc(SH.sayOf(q.intent))}</li><li><b>② 틀 + 내 정보</b> <span lang="en">${segHTML(a)}</span> ${esc(SH.ko(a))}</li><li><b>③ 공손하게</b> ${esc(j.why)}</li></ol>
        <p class="enline">${lpBtn(staffSeq(q).concat([{ text: SH.text(a), sp: 'me', gap: 0.5 }]), '대화 듣기')}<span>대화 듣기</span></p>
        ${clearBtn}`; })() : '<p class="note">곳을 고르면 영상 화면의 그 줄이 켜지고, 세 단계를 글로 보여 줘요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>대화 골라 보기</h3>
    <div class="seg">${SHS.PSEG.map((t, i) => `<button type="button" data-seek="${t + 0.4}">대화 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 해 보고 싶다면 아래 <a href="#playground">쇼핑 시뮬레이터</a>에서 내 쇼핑 카드로 입구부터 교환 · 환불까지 해 보세요. 카드는 누를 때마다 새로 만들어져요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">쇼핑 시뮬레이터</a> — 쇼핑 카드로 입구부터 교환 · 환불까지(바꿀 점 한 줄도)</li><li><a href="#shadow">쇼핑 표현 따라 말하기</a> — ${SH.SHADOW.length}문장 듣고 따라 하기</li>
    <li><a href="#drill">듣고 대답 고르기</a> — 일곱 곳 ${SH.DRILL.length}문제, 3단계 힌트</li><li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.querySelectorAll('.lmini').forEach(m => SDrill(m, [SH.MINI[m.dataset.mini]], { compact: true, onAnswer() { if (playing) pause(); } }));
}
function showAt(u) { const ch = CHAPTERS[SHS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const relab = () => { touch(); buildLab(SHS.chapterAt(T)); };
// 직접 해 보기 상태 → 영상 화면 상태
const syncLine = () => { const L = LAB.line; S.line = { words: L.words.slice(), card: LINE_CARDS[L.card] }; };
const syncShape = () => { const r = LAB.shape; S.shape = r.q ? { q: r.q, pick: r.pick, a: r.yes ? { f: 'g_yesp' } : null, card: {} } : null; };
const syncSize = () => { const r = LAB.size; S.size = { item: r.item, want: r.want, a: slotAns(r) }; };
const syncFit = () => { const r = LAB.fit; S.fit = { item: r.item, fit: r.fit, a: slotAns(r) }; };
const syncPrice = () => { const r = LAB.price; S.price = { item: r.item, off: r.off }; };
const syncBill = () => { S.bill = billCard(); };
const syncRet = () => { const r = LAB.ret; S.ret = { ret: r.ret, days: r.days, receipt: r.receipt, final: r.final }; };
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  const d = b.dataset;
  if (d.seek) { seek(CHAPTERS[SHS.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') {
    ['stop', 'place', 'line', 'shape', 'size', 'fit', 'price', 'bill', 'ret'].forEach(k => { S[k] = null; });
    Object.assign(LAB, JSON.parse(LAB0));
    relab(); return;
  }
  if (d.stop != null) { S.stop = d.stop === '' ? null : +d.stop; showAt(15.2); relab(); return; }
  // 02장 바꿀 점 한 줄
  if (d.lc) { LAB.line = { card: d.lc, words: [] }; syncLine(); relab(); return; }
  if (d.lw) { LAB.line.words = toggleWord(LAB.line.words, d.lw); syncLine(); relab(); return; }
  if (b.id === 'lineClear') { LAB.line.words = []; syncLine(); relab(); return; }
  // 03장 질문의 모양
  if (d.sq) { LAB.shape = { q: d.sq, pick: null, yes: false }; syncShape(); relab(); return; }
  if (d.sp) { LAB.shape.pick = d.sp; syncShape(); relab(); return; }
  if (b.id === 'shapeYes') { LAB.shape.yes = true; syncShape(); relab(); return; }
  // 04장 크기
  if (d.zi) { LAB.size.item = d.zi; LAB.size.want = midSize(d.zi); LAB.size.v = null; syncSize(); relab(); return; }
  if (d.zw) { LAB.size.want = d.zw; syncSize(); relab(); return; }
  if (d.zf) { LAB.size.f = d.zf; if (!SH.FRAME[d.zf].slot) LAB.size.v = null; syncSize(); relab(); return; }
  if (d.zv) { LAB.size.v = d.zv; syncSize(); relab(); return; }
  // 05장 탈의실
  if (d.fi) { LAB.fit.item = d.fi; syncFit(); relab(); return; }
  if (d.ff) { LAB.fit.fit = d.ff; syncFit(); relab(); return; }
  if (d.fr) { LAB.fit.f = d.fr; if (!SH.FRAME[d.fr].slot) LAB.fit.v = null; syncFit(); relab(); return; }
  if (d.fv) { LAB.fit.v = d.fv; syncFit(); relab(); return; }
  // 06장 값
  if (d.pi) { LAB.price.item = d.pi; syncPrice(); relab(); return; }
  if (d.po != null) { LAB.price.off = +d.po; syncPrice(); relab(); return; }
  // 07장 계산대
  if (d.bi) { LAB.bill.item = d.bi; syncBill(); relab(); return; }
  if (d.bo != null) { LAB.bill.off = +d.bo; syncBill(); relab(); return; }
  if (d.bb != null) { LAB.bill.bogo = d.bb === '1'; syncBill(); relab(); return; }
  if (d.bp) { LAB.bill.paym = d.bp; syncBill(); relab(); return; }
  // 08장 교환 · 환불
  if (d.rr) { LAB.ret.ret = d.rr; syncRet(); relab(); return; }
  if (d.rd != null) { LAB.ret.days = +d.rd; syncRet(); relab(); return; }
  if (d.rc != null) { LAB.ret.receipt = d.rc === '1'; syncRet(); relab(); return; }
  if (d.rf != null) { LAB.ret.final = d.rf === '1'; syncRet(); relab(); return; }
  if (d.place != null) { S.place = d.place === '' ? null : +d.place; showAt(3.8); relab(); }
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   값은 한국어로(15달러, 앞의 영어와 붙어 읽히지 않게 마침표로 끊어요)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/\$(\d+)\.(\d{2})\b/g, (m, d, c) => (+c ? `. ${d}달러 ${+c}센트` : `. ${d}달러`)],
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
   10. 놀이터 — 쇼핑 시뮬레이터
   입구 → 물건 찾기 → 진열대 → 탈의실 → 값 → 계산대 → (며칠 뒤) 교환 · 환불.
   같은 곳에서 이미 답한 질문은 직원이 건너뛰어요(SH.covered). 찾는 물건(SH.CROSS)은 입구에서 말했으면 물건 찾기에서도 건너뛰어요.
   값은 쇼핑 카드에 없어요 — 직원이 말한 값을 듣고(fifteen · fifty) 써야 해요.
   ========================================================= */
const SIM = { card: null, qs: [], i: 0, frames: [], slots: {}, f: null, v: null, log: [], started: false, script: !SHV.supported, mode: null, react: null, why: null, done: false, listening: false, heard: null, covered: new Set(), skipped: [], building: false, line: { words: [] } };
const simQ = () => SH.simQ(SIM.qs[SIM.i], SIM.card);
const simC = () => Object.assign({}, SIM.card, simQ().fact || {});
window.__simCard = () => Object.assign({}, SIM.card);   // 확인용(읽기만): 지금 쇼핑 카드
window.__simQ = () => Object.assign({}, simQ());          // 확인용(읽기만): 지금 직원의 말
const keyOf = q => `${q.place}:${q.intent}`;
const skipLabel = ids => ids.map(id => SH.INTENT_KO[SH.Q[id].intent]).filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
const isCovered = q => SIM.covered.has(keyOf(q)) || SIM.covered.has('*:' + q.intent);
const PLACE_INTRO = {
  find: c => c.look ? '둘러보다가 사고 싶은 물건이 생겼어요. 직원이 지나가요 — 내가 먼저 물어요.' : '',
  rack: () => '진열대에서 물건을 찾았어요. 손에 든 것과 바라는 것을 견줘 보세요.',
  fit: () => '입어 보고 싶어요. 탈의실 직원이 안내해요 — 내가 먼저 물어요.',
  price: () => '값표에 값이 없어요. 지나가는 직원에게 내가 먼저 물어요. 직원이 말하는 값을 잘 들으세요.',
  pay: () => '계산대로 가요.',
  ret: c => `${c.days}일 뒤, 산 ${SH.josa.eul(SH.ITEMS[c.item].ko)} 들고 다시 가게에 왔어요.`,
};
function simNew() {
  SHV.stop(); stopListening();
  SIM.card = SH.newCard(); SIM.qs = SH.simQs(SIM.card); SIM.i = 0; SIM.log = []; SIM.done = false; SIM.react = null; SIM.why = null; SIM.heard = null;
  SIM.covered = new Set(); SIM.skipped = []; SIM.building = false; SIM.line = { words: [] };
  simPrep(); simBuild();
}
function simPrep() {
  const q = simQ(), C = simC();
  SIM.slots = {}; SIM.f = null; SIM.v = null;
  SIM.frames = shuffle(SH.simFrames(q.intent, C) || []);
  SIM.frames.forEach(f => { const Fm = SH.FRAME[f]; if (Fm.slot) SIM.slots[f] = SH.slotChoices(Fm.slot, C); });
  if (!SIM.log[SIM.i]) SIM.log[SIM.i] = { q: q.id, en: q.en, sp: q.sp, place: q.place, tries: [] };
}
function simSpeak(lines, o = {}) {
  const box = $('sim');
  // 시뮬레이터는 카드마다 말이 바뀌어 미리 만든 파일이 없어요 → 한 사람의 목소리가 바뀌지 않게 모두 브라우저 음성
  speak(lines, { slow: !!o.slow, clips: false, onitem() { paintNow(box, '.sim-bub'); }, onend() { SIM.mode = null; paintPlay(box, null); paintNow(box, null); } });
  SIM.mode = o.slow ? 'slowplay' : 'play'; paintPlay(box, SIM.mode);
}
function simAsk(prefix, slow) { const q = simQ(); simSpeak((prefix ? [{ text: prefix.text, sp: prefix.sp || 'us' }] : []).concat([{ text: q.en, sp: q.sp, gap: 0.5 }]), { slow }); }
// 다시 묻기에 직원이 하는 대답: 값 · 할인 확인, store credit 풀이, 그 밖에는 천천히 한 번 더
function repairLine(kind, q, C, spoken) {
  if (kind === 'what') return 'Sure. Store credit is money you can only spend in our store.';
  if (kind === 'check') return /percent/i.test(spoken || '') && C.off ? `Yes, that's right. ${SH.numWord(C.off)} percent off.` : `Yes, that's right. ${SH.money(C.amount)}.`;
  return null;
}
function simAnswer(a, spoken) {
  if (SIM.done || !SIM.started) return;
  const q = simQ(), C = simC(), L = SIM.log[SIM.i];
  const j = spoken ? SH.matchSpoken(spoken, q, C) : SH.judge(q, a, C);
  const model = SH.model(q, C);
  SIM.heard = spoken || null;
  if (j.repair) {
    const re = repairLine(j.repair, q, C, spoken);
    SIM.react = { en: re || 'Sure. ' + q.en, ko: re ? (j.repair === 'check' ? '직원이 숫자를 확인해 줬어요. 이제 대답해 보세요.' : '직원이 쉬운 말로 알려 줬어요. 이제 대답해 보세요.') : '다시 물었어요. 직원이 천천히 한 번 더 말해요.', st: 'repair', who: whoOf(q) }; SIM.why = null; simBuild();
    simSpeak(re ? [{ text: re, sp: q.sp }] : [{ text: 'Sure.', sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }], { slow: true }); return;
  }
  L.tries.push({ t: spoken ? `(말로) ${spoken}` : SH.text(a), ok: j.ok, stage: j.stage });
  SIM.why = { j, model, spoken: !!spoken };
  if (j.ok) {
    L.final = spoken || SH.text(a);
    // 이 대답이 함께 답한 다른 질문만 (이 질문의 뜻은 빼요). 한 번만 나오는 질문(찾는 물건)은 다른 곳에서도 건너뛰어요
    (spoken ? (j.covered || [q.intent]) : SH.covered(a, q)).filter(i => i !== q.intent).forEach(i => SIM.covered.add(SH.CROSS[i] ? `*:${i}` : `${q.place}:${i}`));
    const ok = SH.REACT.ok[(SIM.i + L.tries.length) % SH.REACT.ok.length];
    let n = SIM.i + 1; const skip = [];
    while (n < SIM.qs.length && isCovered(SH.Q[SIM.qs[n]])) { skip.push(SIM.qs[n]); n++; }
    SIM.skipped.push(...skip);
    const reply = SH.reply(q, a, C);
    if (n >= SIM.qs.length) {
      const R = SH.returnRule(SIM.card), bye = [reply, 'Thanks for coming in!'].filter(Boolean).join(' ');
      SIM.done = true; SIM.react = { en: bye, ko: R.ok ? '쇼핑 끝! 교환 · 환불까지 마쳤어요.' : '쇼핑 끝! 가게 규칙 때문에 돌려받지는 못했지만, 따지지 않고 공손하게 끝냈어요.', st: 'ok', who: whoOf(q) };
      simBuild(); simSpeak([{ text: bye, sp: q.sp }]); return;
    }
    const prevPlace = q.place;
    SIM.i = n; simPrep(); SIM.building = false;
    const nq = simQ(), moved = nq.place !== prevPlace, intro = moved && PLACE_INTRO[nq.place] ? PLACE_INTRO[nq.place](SIM.card) : '';
    const skipKo = skipLabel(skip);
    const pre = reply || (skip.length ? 'Great.' : ok);
    SIM.react = { en: pre, ko: (skip.length ? `한 번에 말해서 ${skipKo} 질문을 건너뛰었어요. ` : '통과! ') + intro, st: 'ok', who: whoOf(q) };
    simBuild(); simAsk({ text: pre, sp: q.sp });
  } else {
    const r = j.stage === 1 ? SH.REACT[1](q) : j.stage === 2 ? SH.REACT[2](q, j, a) : j.stage === 3 ? SH.REACT[3](q, j, a) : { en: 'Sorry?', ko: '알아듣지 못했어요.' };
    SIM.react = Object.assign({ st: 'no', who: whoOf(q) }, r); SIM.f = null; SIM.v = null;
    simBuild(); simSpeak([{ text: r.en, sp: q.sp }]);
  }
}
const chipT = f => esc(SH.FRAME[f].t.replace(/[{}]/g, '')).replace('___', '<i class="blank">___</i>');
const slotLabel = (f, v) => { const F0 = SH.FRAME[f], x = SH.sv(F0.slot, v); return x ? (x[F0.form || 't'] != null ? x[F0.form || 't'] : x.t) : v; };
// 영수증 (HTML) — 시뮬레이터의 끝
function receiptHTML(c) {
  const B = SH.bill(c);
  return `<div class="rcpt" role="img" aria-label="영수증 합계 ${SH.money(B.total)}"><p class="rc-h">${esc(SH.STORE.toUpperCase())}</p><p class="rc-g">RECEIPT · PAID ${c.paym === 'cash' ? 'CASH' : 'CARD'}</p><ul>${B.items.map(it => `<li><span>${esc(it.en)}${it.off ? ` · ${it.off}% OFF` : it.bogo ? ' · BOGO' : ''}</span><b>${SH.money(it.c)}</b></li>`).join('')}</ul><p class="rc-t"><span>TOTAL</span><b>${SH.money(B.total)}</b></p><p class="rc-n">읽기 → <span lang="en">${esc(SH.priceWords(B.total))}</span> · 세금은 나라 · 주마다 달라서 뺐어요. 교환 · 환불은 ${SH.RETURN_DAYS}일 안(지어낸 규칙).</p></div>`;
}
// 며칠 뒤 교환 · 환불의 결과 (한 줄)
function retKo(c) {
  const R = SH.returnRule(c), it = SH.ITEMS[c.item];
  if (!R.ok) return `${c.days}일 뒤 → ${R.ko}`;
  if (R.why === 'exchange') return `${c.days}일 뒤 → ${SH.josa.eul(it.ko)} 바꿨어요 (${SH.SIZE[c.size2].tag} → ${SH.SIZE[c.size3].tag}).`;
  return `${c.days}일 뒤 → ${R.why === 'choose' ? (c.way === 'refund' ? '돈으로 환불받았어요(refund).' : '가게 포인트로 받았어요(store credit).') : c.creditOk ? '영수증이 없어 가게 포인트로 받았어요(store credit).' : '영수증이 없어 가게 포인트만 된대요. 받지 않았어요.'}`;
}
function simBuild() {
  const hear = SHV.supported, C = SIM.card;
  $('simCard').innerHTML = `<p class="tc-head">${PI('bag')}<b>쇼핑 카드</b> <span lang="en">SHOPPING CARD</span></p><dl>${SH.cardRows(C).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="tc-foot">가게: ${esc(SH.STORE)} (지어낸 가게) · 값표에는 값이 없어요 — 직원에게 물어요 · 교환 · 환불은 ${SH.RETURN_DAYS}일 안(지어낸 규칙)</p>`;
  const prog = SIM.qs.map((id, k) => { const L = SIM.log[k], skipped = SIM.skipped.includes(id), c = skipped ? ' skip' : !L || !L.final ? (k === SIM.i && !SIM.done ? ' cur' : '') : L.tries[0] && L.tries[0].ok ? ' ok' : ' late'; return `<li class="${c}" title="${esc(SH.INTENT_KO[SH.Q[id].intent] || '')}${skipped ? ' (건너뜀)' : ''}">${k + 1}</li>`; }).join('');
  $('simProg').innerHTML = prog;
  const box = $('simMain');
  if (!SIM.started) {
    box.innerHTML = `<div class="sim-start"><p>왼쪽 쇼핑 카드가 오늘의 사실이에요. 입구 → 물건 찾기 → 진열대 → 탈의실 → 값 → 계산대 → (며칠 뒤) 교환 · 환불 차례로 직원과 이야기해요. 먼저 <b>질문의 모양</b>을 잡고(Yes/No · 고르기 · 정보 · 안내), 대답 틀 칩을 고른 뒤 카드의 정보 칩을 넣어요. 직원의 말이 질문이 아니면(안내) <b>내가 먼저</b> 말할 차례예요. 진열대에서는 <b>바꿀 점 한 줄</b>(L)로 크기와 색을 한 번에 말하면 직원이 그 질문을 건너뛰어요. 값은 카드에 없으니 직원이 말하는 값을 잘 들으세요${SRC ? ' — 마이크로 말해서 대답할 수도 있어요' : ''}.</p><button type="button" class="btn" id="simGo">입구에서 시작 (Enter)</button></div>`;
    return;
  }
  if (SIM.done) {
    const first = SIM.log.filter(L => L && L.tries[0] && L.tries[0].ok).length, asked = SIM.log.filter(Boolean).length, saved = SIM.skipped.length;
    const ml = SH.modelLine(C);
    box.innerHTML = `<div class="sim-end"><div class="end-art">${receiptHTML(C)}</div><div><p class="sim-score"><b>${first} / ${asked}</b> 질문을 한 번에 통과했어요.</p>
      <p class="sim-saved">${saved ? `한 번에 말해서 직원의 질문 <b>${saved}개</b>를 건너뛰었어요 (${esc(skipLabel(SIM.skipped))}).` : `다음에는 진열대에서 바꿀 점을 한 줄로 말해 보세요 → <span lang="en">${segHTML(ml)}</span> ${lpBtn(meSeq(ml), '바꿀 점 한 줄 듣기')}`}</p>
      <p class="note">${esc(retKo(C))}</p>
      <p class="sim-react ok"><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>
      <ol class="sim-log">${SIM.log.filter(Boolean).map(L => `<li><span class="who">${esc(WHO[L.sp] || '직원')}</span>${lpBtn([{ text: L.en, sp: L.sp }], '듣기')}<span lang="en">${esc(L.en)}</span><br><span class="who me">나</span>${lpBtn(meSeq(L.final), '듣기')}<span lang="en">${esc(L.final)}</span>${L.tries.length > 1 ? ` <small>(${L.tries.length}번째에 통과)</small>` : ''}</li>`).join('')}</ol>
      <div class="tg-acts"><button type="button" class="btn" id="simAgain">새 카드로 다시 (N)</button>${hear ? `<button type="button" class="btn ghost" data-lp="${seqId(SIM.log.filter(Boolean).flatMap(L => [{ text: L.en, sp: L.sp }, { text: L.final, sp: 'me', gap: 0.4 }]))}">대화 전체 듣기</button>` : ''}</div></div></div>`;
    return;
  }
  const q = simQ(), show = SIM.script || !hear;
  let fa = null;
  if (SIM.f) { const Fm = SH.FRAME[SIM.f]; if (!Fm.slot || SIM.v) { fa = { f: SIM.f }; if (Fm.slot) fa.v = SIM.v; } }
  let h = `${lsnBar(SIM.script)}`;
  h += `<div class="sim-officer">${staffSVG(SHS.kindOf(q))}<p class="sim-bub"><span class="who">${esc(whoOf(q))}</span><span class="ldr-t" lang="en">${lineHTML(q.en, show ? keyMarks(q) : [], show)}</span>${show ? SHI(q.shape) : ''}${hear ? `<button type="button" class="lp-play lp-mini" data-simline="1" aria-label="다시 듣기" title="다시 듣기">${SVG_PLAY}</button>` : ''}</p></div>`;
  if (SIM.react) h += `<p class="sim-react ${SIM.react.st}"><span class="who">${esc(SIM.react.who || whoOf(q))}</span><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>`;
  if (SIM.building) {
    const L = SIM.line, a = SH.L(L.words.slice());
    h += `<div class="sim-build"><p class="sim-lab">바꿀 점 한 줄 — 조각을 누르는 차례대로 문장이 돼요 <small>L 닫기</small></p>
      ${LINE_ORDER.map(c => row(SH.OCAT[c].ko, `<div class="seg">${lineChips(c, C).map(w => `<button type="button" data-sw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(SH.OW[w].t)}</span></button>`).join('')}</div>`)).join('')}
      <div class="sim-ans"><span class="who me">나</span>${L.words.length ? `<span lang="en" class="sim-line">${segHTML(a)}</span>` : '<span class="note">조각을 고르세요. 손에 든 것과 바라는 것은 쇼핑 카드에 있어요.</span>'}</div>
      <div class="tg-acts"><button type="button" class="btn" id="simLine"${L.words.length ? '' : ' disabled'}>말하기 (Enter)</button><button type="button" class="btn ghost" id="simLineClear"${L.words.length ? '' : ' disabled'}>지우기</button><button type="button" class="btn ghost" id="simBuildOff">칩으로 하나씩</button></div></div>`;
  } else {
    h += `<p class="sim-lab">① 대답 틀 <small>1~${SIM.frames.length}</small></p><div class="chips" role="group" aria-label="대답 틀">${SIM.frames.map((f, k) => `<button type="button" class="chipf" data-sf="${f}" aria-pressed="${SIM.f === f}"><small>${k + 1}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}${q.intent === 'rack' ? '<button type="button" class="chipf chip-line" id="simBuildOn"><small>L</small> 바꿀 점 한 줄 (한 번에 말하기)</button>' : ''}</div>`;
    const Fm = SIM.f ? SH.FRAME[SIM.f] : null;
    if (Fm && Fm.slot) h += `<p class="sim-lab">② 내 정보 넣기 <small>A~C</small></p><div class="chips" role="group" aria-label="칸에 넣을 정보">${SIM.slots[SIM.f].map((v, k) => `<button type="button" class="chips-s" data-sv="${esc(v)}" aria-pressed="${SIM.v === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(slotLabel(SIM.f, v))}</span></button>`).join('')}</div>`;
    h += `<div class="sim-ans"><span class="who me">나</span>${fa ? `<span lang="en" class="sim-line">${segHTML(fa)}</span>` : SIM.f ? `<span lang="en" class="sim-line">${chipT(SIM.f)}</span>` : '<span class="note">틀을 고르세요.</span>'}</div>`;
    h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${fa ? '' : ' disabled'}>대답하기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${SIM.f ? '' : ' disabled'}>지우기</button>${SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 대답하기 (M)'}</button>` : ''}</div>`;
  }
  if (SIM.heard) h += `<p class="note">들린 말: <span lang="en">${esc(SIM.heard)}</span></p>`;
  if (SIM.why) {
    const { j, model } = SIM.why, st = j.ok ? '통과' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸렸어요';
    h += `<div class="sim-why ${j.ok ? 'ok' : 'no'}"><p><b>${esc(st)}</b> ${esc(j.why)}</p>${j.ok ? '' : `<p>모범 대답 ${lpBtn(meSeq(model), '모범 대답 듣기')}<span lang="en">${segHTML(model)}</span> <small>${esc(SH.ko(model))}</small></p>`}${SIM.why.spoken ? '<p class="note">말로 한 대답은 낱말과 카드의 사실만 맞춰 봐요. 질문의 모양(yes · no만 했는지)과 this · these는 보지만, 공손함과 발음은 판정하지 않아요.</p>' : ''}</div>`;
  }
  box.innerHTML = h;
  paintPlay($('sim'), SIM.mode);
}
// 직원 얼굴 (영상의 avatar와 같은 색): 매장 직원 · 탈의실 직원(줄자) · 계산대 직원(앞치마) · 영국 가게의 직원(올린 머리)
const LOOKS = SHS.LOOK;
const staffSVG = kind => {
  const L = LOOKS[kind] || LOOKS.clerk;
  return `<svg class="sim-av" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#202A36"/><ellipse cx="24" cy="47" rx="19" ry="14" fill="${L.shirt}"/>${L.collar ? '<path d="M19.5 34l4.5 5 4.5-5z" fill="#EEF1F4"/>' : ''}${L.apron ? `<rect x="16.5" y="37" width="15" height="11" rx="2" fill="${L.apron}"/>` : ''}${L.lanyard ? `<path d="M20 33.5l3 8M28 33.5l-3 8" stroke="${L.lanyard}" stroke-width="1.6" fill="none"/><rect x="21.5" y="41" width="5" height="4" rx="1" fill="#F4F6F8"/>` : ''}${L.tape ? '<rect x="16" y="33" width="2.4" height="15" rx="1" fill="#F2D45A"/><rect x="29.6" y="33" width="2.4" height="15" rx="1" fill="#F2D45A"/>' : ''}<circle cx="24" cy="21" r="8.5" fill="${L.skin}"/><path d="M15.5 19a8.5 8.5 0 0 1 17 0z" fill="${L.hair}"/>${L.bun ? `<circle cx="24" cy="11" r="3" fill="${L.hair}"/>` : ''}<circle cx="21" cy="22" r="1" fill="#2B2420"/><circle cx="27" cy="22" r="1" fill="#2B2420"/></svg>`;
};
function simKeep() { if (!$('sim').contains(document.activeElement) || !document.activeElement.isConnected) $('sim').focus({ preventScroll: true }); }
function simMic() {
  if (!SRC || SIM.done || !SIM.started) return;
  if (SIM.listening) { stopListening(); return; }
  listenOnce({
    onState(on) { SIM.listening = on; simBuild(); simKeep(); },
    onText(alts) { const q = simQ(), C = simC(), best = alts.find(t => SH.matchSpoken(t, q, C).ok) || alts[0]; simAnswer(null, best); simKeep(); },
    onFail(msg) { SIM.react = { en: '…', ko: msg, st: 'no' }; simBuild(); simKeep(); },
  });
}
function simLineSubmit() { const L = SIM.line; if (!L.words.length) return; simAnswer(SH.L(L.words.slice())); }
function simSayChips() {
  if (!SIM.f) return;
  const Fm = SH.FRAME[SIM.f]; if (Fm.slot && !SIM.v) return;
  const a = { f: SIM.f }; if (Fm.slot) a.v = SIM.v;
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
    if (b.id === 'simSay') { simSayChips(); simKeep(); return; }
    if (b.id === 'simClear') { SIM.f = null; SIM.v = null; simBuild(); simKeep(); return; }
    if (b.id === 'simMic') { simMic(); return; }
    if (b.id === 'simBuildOn') { SIM.building = true; simBuild(); simKeep(); return; }
    if (b.id === 'simBuildOff') { SIM.building = false; simBuild(); simKeep(); return; }
    if (b.dataset.sw) { SIM.line.words = toggleWord(SIM.line.words, b.dataset.sw); simBuild(); simKeep(); return; }
    if (b.id === 'simLine') { simLineSubmit(); simKeep(); return; }
    if (b.id === 'simLineClear') { SIM.line = { words: [] }; simBuild(); simKeep(); return; }
    if (b.dataset.simline) { simAsk(null, false); return; }
    if (b.dataset.act === 'play') { if (SIM.mode === 'play' && SHV.busy()) SHV.stop(); else simAsk(null, false); return; }
    if (b.dataset.act === 'slowplay') { if (SIM.mode === 'slowplay' && SHV.busy()) SHV.stop(); else simAsk(null, true); return; }
    if (b.dataset.act === 'script') { SIM.script = !SIM.script; simBuild(); simKeep(); }
  });
  $('sim').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), onBtn = e.target.closest && e.target.closest('button');
    if (!SIM.started) { if (e.key === 'Enter' && !onBtn) { e.preventDefault(); $('simGo').click(); } return; }
    if (SIM.done) { if (k === 'N' || (e.key === 'Enter' && !onBtn)) { e.preventDefault(); $('simAgain').click(); } return; }
    const n = '1234'.indexOf(e.key), sv = 'ABC'.indexOf(k), q = simQ();
    if (k === 'L' && q.intent === 'rack') { e.preventDefault(); SIM.building = !SIM.building; simBuild(); simKeep(); return; }
    if (SIM.building) {
      if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simLineSubmit(); simKeep(); }
      else if (e.key === 'Backspace') { e.preventDefault(); SIM.line.words.pop(); simBuild(); simKeep(); }
      return;
    }
    if (n >= 0 && n < SIM.frames.length) { e.preventDefault(); SIM.f = SIM.frames[n]; SIM.v = null; simBuild(); simKeep(); }
    else if (sv >= 0 && SIM.f && SH.FRAME[SIM.f].slot && SIM.slots[SIM.f][sv] != null) { e.preventDefault(); SIM.v = SIM.slots[SIM.f][sv]; simBuild(); simKeep(); }
    else if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simSayChips(); simKeep(); }
    else if (e.key === 'Backspace') { e.preventDefault(); SIM.f = null; SIM.v = null; simBuild(); simKeep(); }
    else if (k === 'R' && SHV.supported) { e.preventDefault(); simAsk(null, false); }
    else if (k === 'S' && SHV.supported) { e.preventDefault(); simAsk(null, true); }
    else if (k === 'T' && SHV.supported) { e.preventDefault(); SIM.script = !SIM.script; simBuild(); simKeep(); }
    else if (k === 'M' && SRC) { e.preventDefault(); simMic(); }
    else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
  });
  simNew(); SIM.started = false; simBuild();
}

/* =========================================================
   11. 쇼핑 표현 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 숫자는 15든 fifteen이든 같은 숫자로 맞춰요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = SH.PLACES.map(p => ({ p, rows: SH.SHADOW.map((s, i) => [s, i]).filter(([s]) => s.place === p.id) })).filter(g => g.rows.length);
  $('shList').innerHTML = groups.map(({ p, rows }) => `<section class="sh-grp"><h3>${PI(p.id)}${esc(p.ko)} <span lang="en">${esc(p.en)}</span></h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${SHV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-who ${s.who}">${s.who === 'me' ? '나' : esc(WHO[s.sp] || '직원')}</span><span class="sh-en" lang="en">${esc(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { const s = SH.SHADOW[i]; return [{ text: s.en, sp: s.sp }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = SH.SHADOW[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, SH.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.words.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.t)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}${/Maple/.test(s.en) && r.hit < r.total ? ' (가게 이름은 음성 인식이 다르게 적기 쉬워요.)' : ''}</p>`);
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${SHV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
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
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (b) b.classList.remove('saying'); if (thenOrig && SHV.supported) speak(shSeq(i)); };
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
const hlOf = (ids, st) => { const hl = {}; ids.forEach((k, i) => { if (st.done && i === st.answer) hl[k] = '#FFC15E'; else if (st.done && i === st.pick) hl[k] = '#FF8E8E'; else if (st.hover === i) hl[k] = '#6EC8FF'; }); return hl; };
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
        SHS.shapeMark(g, sh, x, 92, 34);
        g.font = qfont(14, 700); g.fillStyle = QCOL.text; g.fillText(SH.SHAPE[sh].ko, x, 150);
        g.font = qfont(12, 500); g.fillStyle = QCOL.muted; g.fillText(SH.SHAPE[sh].mark, x, 172);
      });
    } };
}
// 크기 줄 (칸마다 A~E). cur: 지금 입은 크기에 표시
function sizeFig(label, kind, cur, curText) {
  const L = SH.SIZES[kind], Wd = 600, H = 168, cw = 84, gap = 10, x0 = (Wd - (L.length * cw + (L.length - 1) * gap)) / 2, y0 = 66;
  const box = i => ({ x: x0 + i * (cw + gap), y: y0, w: cw, h: 44 });
  return { width: Wd, height: H, label,
    pick: (x, y) => L.findIndex((z, i) => { const b = box(i); return x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 16 && y <= b.y + b.h + 36; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      g.save(); SHS.sizeRow(g, x0, y0, kind, { hl: hlOf(L, st), cw, gap, noHit: true }); g.restore();
      L.forEach((z, i) => { const b = box(i); qLetter(g, b.x + 6, b.y - 2, i); });
      const i = L.indexOf(cur);
      if (i >= 0) { const b = box(i); g.font = qfont(13, 700); g.fillStyle = QCOL.bad; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(curText, b.x + b.w / 2, 30); }
    } };
}
// 영수증 (줄 넷 A~D: 물건 줄 번호 · total · policy) — 칸 위치는 SHS.receiptDraw와 같은 셈
function receiptFig(label, card, ids) {
  const Wd = 600, w = 320, x = 140, y = 14, n = SH.bill(card).items.length, yt = y + 74 + n * 52, H = yt - y + 128 + 7 + 26;
  const box = k => k === 'total' ? { x: x + 10, y: yt + 4, w: w - 20, h: 32 } : k === 'policy' ? { x: x + 10, y: yt + 68, w: w - 20, h: 48 } : { x: x + 10, y: y + 72 + k * 52, w: w - 20, h: 44 };
  return { width: Wd, height: H, label,
    pick: (px, py) => ids.findIndex(k => { const b = box(k); return px >= b.x - 4 && px <= b.x + b.w + 4 && py >= b.y - 4 && py <= b.y + b.h + 4; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      g.save(); SHS.receiptDraw(g, x, y, w, card, { hl: hlOf(ids, st) }); g.restore();
      ids.forEach((k, i) => { const b = box(k); qLetter(g, b.x - 22, b.y + b.h / 2, i); });
    } };
}
const QS = (() => {
  const o = SH.o, j = (q, a, c) => SH.judge(q, a, c || {}).ok, D = SH.DEMO, CC = SH.CHANGE_CARD;
  const lines = [SH.LINE_BAD, SH.LINE_SAME, { words: ['give', 'this', 'z_m', 'k_navy'] }, SH.LINE];
  const browse = [o('br_look'), o('br_eye'), o('g_yes'), o('br_plain')];
  const hood = [o('lf_for', 'hoodt'), o('lf_for', 'hoodie'), o('lf_for', 'padding'), o('g_yes')];
  const size = [o('sz_pl', 'free'), o('g_yesp'), o('sz_pl', 'm'), o('cl_pl', 'navy')];
  const bag = [o('bg_vinyl'), o('g_yesp'), o('rc_lit'), o('bg_no')];
  const fin = [o('fn_ok'), o('fn_bad'), o('g_yes'), o('rt_refund')];
  const B = SH.bill(D), late = SH.returnRule(Object.assign({}, SH.EXCARD, { days: 45 }));
  const q = [
    { q: '검은색 S 후드 티를 들고 있어요. 같은 후드 티를 남색 M으로 찾고 싶어요. 직원이 Are you finding everything okay? 하고 물어요. 가장 알맞은 말은?', opts: lines.map(SH.lineText), a: 3,
      why: '이것 + 바꿀 점 → Do you have this in a medium in navy? 묻는 틀이 맨 앞, this가 그다음, 바꿀 점(크기 · 색)이 뒤예요. (A)는 순서가 뒤섞였고, (B)의 black은 손에 든 것과 같은 점이고, (C)의 Give me는 명령처럼 들려요.',
      check: () => lines.map(L => j('rk_ok', SH.L(L.words), CC)).join() === 'false,false,false,true' },
    { q: 'Hi, welcome to Maple & Thread! Can I help you find anything? — 그냥 구경하는 중이에요. 가장 알맞은 대답은?', opts: browse.map(SH.text), a: 0,
      why: '도와주겠다는 Yes/No 질문이에요. 구경만 할 때는 → I\'m just looking, thanks. ‘아이쇼핑’은 영어로 통하지 않고, Yes.는 도움이 필요하다는 뜻이 되고, 그냥 No.는 무뚝뚝하게 들려요.',
      check: () => browse.map(a => j('dr_help', a, { look: true })).join() === 'true,false,false,false' },
    { q: 'What are you looking for? — 후드 티를 찾고 있어요. 가장 알맞은 대답은?', opts: hood.map(SH.text), a: 1,
      why: '후드 티 → a hoodie. ‘후드 티’ · ‘패딩’은 한국식 말이에요(패딩 점퍼 → a puffer jacket). 정보 질문이라 Yes.로는 답이 안 돼요.',
      check: () => hood.map(a => j('fd_what', a, { item: 'hoodie' })).join() === 'false,true,false,false' },
    { q: 'What size are you looking for? — 티셔츠를 M으로 입고 싶어요. 가장 알맞은 대답은?', opts: size.map(SH.text), a: 2,
      why: '정보 질문 → 크기 + please → A medium, please. ‘프리 사이즈’는 한국식 말이라 공짜(free)로 들릴 수 있어요(누구에게나 맞는 한 가지 크기 → one size). Yes, please.는 크기가 없고, Navy는 색의 대답이에요.',
      check: () => size.map(a => j('rk_size', a, { item: 'tee', size: 'm' })).join() === 'false,false,true,false' },
    { q: '탈의실 직원이 묻는 말: How did everything fit? 이 질문의 모양은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: shapeFig('질문의 모양 넷. A Yes/No 질문(스위치), B 고르는 질문(갈림길), C 정보 질문(빈 상자), D 안내(말풍선)'),
      why: 'How did …? → 입어 보니 어땠는지 정보를 묻는 정보 질문(빈 상자)이에요. 정보로 대답해요 → It\'s a little tight. Yes, it did.로는 어땠는지가 빠져요.',
      check: () => SH.Q.ft_how.shape === 'wh' && !j('ft_how', o('fi_yes'), { item: 'tee', two: false, fit: 'tight' }) },
    { q: '티셔츠 M을 입어 보니 꽉 껴요(It\'s a little tight). 다음에 입어 볼 크기는? 크기 줄에서 칸을 누르세요.', opts: ['A', 'B', 'C', 'D', 'E'], a: 3,
      figure: sizeFig('티셔츠 크기 줄. A XS, B S, C M(지금 입은 크기, 꽉 낌), D L, E XL', 'top', 'm', '지금 입은 크기 · 꽉 껴요'),
      why: '꽉 끼면 → 한 칸 큰 크기 → L. 직원이 Would you like to try a different size? 하고 물으면 → Yes, could I try a large? 헐렁하면 한 칸 작은 크기(S)예요.',
      check: () => SH.sizeFor('tee', 'm', 'tight') === 'l' && SH.sizeFor('tee', 'm', 'loose') === 's' },
    { q: '직원이 값을 말하면서 뒤(TEEN)를 세게 말했어요 → “It\'s fif-TEEN dollars today.” 값은 얼마인가요?', opts: ['$50.00', '$15.00', '$5.00', '$1.50'], a: 1,
      why: 'fifteen(15)은 뒤(TEEN)를 세게, fifty(50)는 앞(FIF)을 세게 말해요. 헷갈리면 되물어요 → Sorry, did you say fifteen dollars? (값은 지어낸 것이에요.)',
      check: () => SH.priceWords(1500) === 'fifteen dollars' && SH.canon('fifteen').includes('15') && SH.priceWords(5000) === 'fifty dollars' },
    { q: 'Would you like a bag? — 봉투가 필요 없어요. 가방을 가져왔어요. 가장 알맞은 대답은?', opts: bag.map(SH.text), a: 3,
      why: '봉투가 필요한지 묻는 Yes/No 질문 → No, thanks. I have one. ‘비닐봉지’ → a plastic bag(vinyl bag은 비닐로 만든 가방처럼 들려요). Yes, please.는 봉투를 달라는 말이고, Receipt, no need.는 영수증에 대한 말이에요.',
      check: () => bag.map(a => j('py_bag', a, { bag: false })).join() === 'false,false,false,true' },
    { q: '계산대 직원이 Your total is …라고 말했어요. 영수증에서 모두 낼 값(합계)이 적힌 줄은? 그림 속 줄을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: receiptFig(`영수증. A HOODIE ${SH.money(B.items[0].c)} (50% 할인), B SOCKS (2 PAIRS) ${SH.money(B.items[1].c)}, C TOTAL ${SH.money(B.total)}, D RETURNS WITHIN ${SH.RETURN_DAYS} DAYS`, D, [0, 1, 'total', 'policy']),
      why: `TOTAL → 모두 낼 값 ${SH.money(B.total)} → ${SH.priceWords(B.total)}. 후드 티는 ${SH.money(SH.ITEMS.hoodie.p)}에서 50% 할인, 양말은 하나 사면 하나 더(두 켤레 값 하나). 맨 아래 줄은 교환 · 환불 기간이에요. (값은 지어낸 것이고, 세금은 뺐어요.)`,
      check: () => B.total === 2100 && SH.Q.py_pay.fact.amount === B.total && B.items.length === 2 },
    { q: '45일 전에 산 청바지를 영수증과 함께 가져갔어요. 직원이 I\'m sorry, but we only take returns within thirty days. 하고 말해요. 가장 알맞은 대답은?', opts: fin.map(SH.text), a: 0,
      why: '가게 규칙(30일 안)이라 직원이 바꿀 수 없어요. 따지지 말고 → I see. Thank you anyway. That\'s not fair! · Refund me.는 따지거나 명령하는 말이에요. (가게 규칙은 지어낸 것이고, 실제 가게마다 달라요.)',
      check: () => late.why === 'late' && fin.map(a => j('rt_final', a, {})).join() === 'true,false,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[쇼핑] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { if (x.a < 4) pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[쇼핑] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { SHV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = SHS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * SHS.W, (e.clientY - r.top) / r.height * SHS.H]; };
const hitAt = (x, y) => started ? SHS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.stop != null) { S.stop = S.stop === h.stop ? null : h.stop; relab(); }
  else if (h && h.play && SHV.supported) speak(h.play);
  else if (h && h.say && SHV.hasClip('tc', h.say)) speak([{ text: h.say, sp: 'tc' }]);   // 미리 만든 발음(음성 해설의 영어와 같은 목소리)
  else if (h && h.say && EN.say.supported) { stopSounds(); if (playing) pause(); EN.say(SH.spoken(h.say)); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.stop != null ? '눌러서 이곳의 말 보기' : h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { SHV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = SHV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 대화 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 글이 정해진 말만 모아요: 영상의 말풍선 · 발음 칩, 질문(SH.Q), 직접 해 보기의 처음 화면(곳 · 3단계는 하나씩 골라 봄),
// 듣고 대답 고르기, 따라 말하기. 쇼핑 시뮬레이터(카드마다 바뀌는 말)와 내가 칩으로 만든 문장은 브라우저 음성이라 빼요.
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text || !/[A-Za-z]/.test(text) || /^\(.*\)$/.test(String(text).trim())) return;   // (지문)은 읽지 않음
    const id = SHV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: SHV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(SHS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 말풍선(그 사람) · 영어 칩(발음 듣기 tc). 곳(route) · 3단계(method) 장은 하나씩 골라 놓고 한 번 더
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return ch ? [ch.t, ch.t + ch.d] : null; };
    const sweeps = [[{}, [0, END]]].concat(SH.PLACES.map((_, k) => [{ stop: k }, span('route')]), SH.METHOD.map((_, k) => [{ place: k }, span('method')])).filter(x => x[1]);
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.25) {
        SHS.render(g, t);
        SHS.hits().forEach(h => { if (h.play) addSeq(h.play, 'video'); else if (h.say) add('tc', h.say, 'video-say'); });
      }
    });
    // 2) 직접 해 보기: 장마다 처음 화면 + 곳 · 3단계는 하나씩 골라서 (듣기 단추에 걸린 말)
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* 그리기만 하는 칸 */ } });
    SH.PLACES.forEach((_, k) => { S.stop = k; try { LABS.route(); } catch (e) { /* */ } });
    S.stop = null;
    SH.METHOD.forEach((_, k) => { S.place = k; try { LABS.method(); } catch (e) { /* */ } });
    S.place = null;
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 듣고 대답 고르기 · 먼저 골라 보기: 직원의 말 + 보기 넷
  SH.DRILL.concat(Object.values(SH.MINI)).forEach(it => { const Q = it.Q || SH.Q[it.q]; if (Q) addSeq(staffSeq(Q), 'drill'); it.opts.forEach(op => add('me', SH.text(op), 'drill')); });
  // 4) 따라 말하기
  SH.SHADOW.forEach((s0, i) => addSeq(shSeq(i), 'shadow'));
  // 5) 질문 목록의 나머지(직원의 말)
  Object.values(SH.Q).forEach(q => addSeq(staffSeq(q), 'q'));
  return out;
};
simInit();
shInit();
SDrill($('drillRoot'), SH.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 모양 잡기 → 틀 + 내 정보 → 공손하게, 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 02 · 09 · 10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '옷 가게의 일곱 곳과 이것 + 바꿀 점이 모두 익숙해졌네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(SHS.baseText()).then(() => { dirty = true; });
setTimeout(() => SHS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
