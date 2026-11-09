/* 교환학생 생활 회화 — 플레이어, 직접 해 보기, 교환학생 시뮬레이터, 따라 말하기, 듣고 대답 고르기, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(CM), 그림은 scenes.js(CMS), 목소리는 voices.js(CMV)가 맡습니다.
 * 소리가 겹치지 않게: 대화를 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(CMV.play의 before).
 * 대학 · 교수 · 기숙사 이름, 과목 번호, 면담 시간, 방 번호는 모두 지어낸 예시예요. 실제 절차는 학교마다 달라요.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const CM = window.CM, CMS = window.CMS, CMV = window.CMV, S = CMS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = CMS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cv = $('cv'), ctx = cv.getContext('2d');
CM.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = CMS.fonts;
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
  const ready = new Promise(res => CMS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '교환학생 생활, 부탁은 질문으로 · 문제는 사실부터 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { CMS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: CMS.iconSVG('mic'),
};
const PI = id => CMS.iconSVG(id, 'pi');   // 곳 아이콘
const SHI = sh => `<span class="shp shp-${sh}">${CMS.iconSVG('shape_' + sh, 'pi')}${esc(CM.SHAPE[sh].ko)}</span>`;   // 질문의 모양 표시
// 듣기 · 천천히 · 대본 보기 단추 묶음 (공항 · 카페 · 호텔 · 식당 · 쇼핑과 같은 모양 · 같은 키 R · S · T)
const lsnBar = scriptOn => CMV.supported
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
  const cap = started ? CMS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 말풍선을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = CMS.chapterAt(T);
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
  if (dirty) { dirty = false; CMS.render(ctx, started ? T : POSTER); }
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
function stopSounds() { EN.say.stop(); CMV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return CMV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름
const lpBtn = (seq, label, cls = '') => CMV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
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
const meSeq = a => [{ text: typeof a === 'string' ? a : CM.text(a), sp: 'me' }];
// 말하는 사람 (목소리마다 한 사람): 등록 창구 직원 en-US · 헤일 교수 en-CA · 기숙사 사무실 직원 en-GB · RA en-AU
const WHO = { us: '등록 창구 직원', ca: '헤일 교수 (캐나다)', gb: '기숙사 사무실 직원 (영국)', au: 'RA (호주)' };
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
const segHTML = (a, on = true) => CM.segs(a).map(s => on && s.t.trim() && /[A-Za-z0-9]/.test(s.t) ? `<mark class="mk-${s.r}">${esc(s.t)}</mark>` : esc(s.t)).join('');
const keyMarks = q => q.key.map(t => ({ t, role: 'key' }));

/* =========================================================
   6. 듣고 대답 고르기 (이 튜토리얼 전용, 대중교통 TDrill과 같은 모양) — 상대의 말은 소리 먼저, 대답 넷은 글
   생김새와 키보드는 공통 부품 EN.drill과 같게: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본 · Enter/→ 다음
   힌트 ①부터 질문의 모양 표시(스위치 · 갈림길 · 빈 상자 · 말풍선)가 상대의 말 옆에 나와요.
   ========================================================= */
function CDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null;
  const compact = !!cfg.compact, hear = CMV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && CMV.busy()) { CMV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(staffSeq(it.Q), { slow: !!slow, onitem() { paintNow(root, '.ldr-q'); say(`${whoOf(it.Q)} · ${it.Q.fast ? '빠르게 말하는 중' : '말하는 중'}`); },
      onend(stopped) { mode = null; paintPlay(root, null); paintNow(root, null); say(stopped ? '' : '다 들었어요. 대답을 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { CMV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; CMV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    CMV.stop();
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = CM.steps(it), place = CM.PLACE[it.place];
    const marks = []; steps.slice(0, done ? 3 : s.hints).reverse().forEach(x => marks.push(...x.marks));   // 뒤 단계의 색이 앞 단계를 덮음
    const reveal = done || !hear || s.script, mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur), showShape = (done || s.hints > 0) && !it.Q.fast;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${PI(it.place)}${esc(place.ko)}</span><span>${compact ? '듣고 대답 고르기' : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span>${done ? `<span class="edr-tag">${it.Q.fast ? '다시 묻기' : esc(CM.SHAPE[it.Q.shape].ko)}</span>` : ''}</p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(it.sit)}</p>`;
    h += lsnBar(done ? null : s.script);
    h += `<p class="ldr-q"><b>${esc(whoOf(it.Q))}</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="q" aria-label="상대의 말 다시 듣기" title="상대의 말 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.Q.en, mk('q'), reveal)}</span>${showShape ? SHI(it.Q.shape) : ''}${it.Q.fast && !done ? '<small class="adr-fast">아주 빠르게</small>' : ''}</p>`;
    h += `<p class="adr-ask">나의 대답은?</p><div class="ldr-opts" role="group" aria-label="대답 보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '', t = CM.text(op);
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-lp="${seqId(meSeq(t))}" aria-label="(${L4[k]}) 듣기" title="(${L4[k]}) 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(t, mk(k), true)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + CM.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = [[`${whoOf(it.Q)} · ${it.Q.en}`, it.Q.ko, staffSeq(it.Q)]].concat(it.opts.map((op, k) => [`(${L4[k]}) ${CM.text(op)}`, CM.ko(op), meSeq(op)]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      h += `<div class="edr-acts">${hear ? `<button type="button" class="edr-btn ghost adr-ex" data-lp="${seqId(staffSeq(it.Q).concat([{ text: CM.text(it.opts[it.a]), sp: 'me', gap: 0.5 }]))}">${ICO.play} 대화 듣기 (상대 → 나)</button>` : ''}${compact ? '' : `<button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button>`}</div>`;
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
const OT = CM.o, D = CM.DEMO;
const qLine = (q, extra = []) => `<p class="enline">${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span class="who">${esc(whoOf(q))}</span><span lang="en">${lineHTML(q.en, (q.fast ? [] : keyMarks(q)).concat(extra), true)}</span></p>`;
const meLine = (a, label = '듣기') => `<p class="enline">${lpBtn(meSeq(a), label)}<span class="who me">나</span><span lang="en">${segHTML(a)}</span></p>`;
const sayLine = (q, text, sp) => text ? `<p class="enline">${lpBtn([{ text, sp: sp || q.sp }], '상대의 대답 듣기')}<span class="who">${esc(whoOf(q))}</span><span lang="en">${esc(text)}</span></p>` : '';
const seeded = n => () => (n = (n * 16807) % 2147483647) / 2147483647;
// 상대의 반응: 맞으면 맞장구(CM.reply), 틀리면 걸린 단계의 반응(CM.REACT)
const reactEn = (q, j, a, C) => j.ok ? CM.reply(q, a, C) : (j.stage === 1 ? CM.REACT[1](q) : j.stage === 2 ? CM.REACT[2](q, j, a, C) : CM.REACT[3](q, j, a)).en;
// 부탁 한 줄 조각 칩: 엔진의 조각 칩(갈래마다 맞는 조각 + 헷갈리기 쉬운 조각)
const lineChipsFor = C => CM.lineChips(C, seeded(11));
// 같은 자리의 조각을 누르면 바꿔 끼우고, 같은 조각을 다시 누르면 빼요 (누른 차례가 말하는 차례)
const toggleWord = (words, w) => words.includes(w) ? words.filter(x => x !== w) : words.filter(x => CM.OW[x].c !== CM.OW[w].c).concat([w]);
const lineRows = (C, words, attr) => lineChipsFor(C).map(gr => row(CM.OCAT[gr.c].ko, `<div class="seg">${gr.ids.map(w => `<button type="button" data-${attr}="${w}" aria-pressed="${words.includes(w)}"><span lang="en">${esc(CM.OW[w].t)}</span></button>`).join('')}</div>`)).join('');
const pairList = () => `<ul class="qlist">${CM.PAIRS.map(([n1, s1, n2, s2]) => `<li>${lpBtn([{ text: CM.numWord(+n1), sp: 'tc' }], '듣기: ' + CM.numWord(+n1))}<span><span lang="en">${esc(s1)}</span><small>${n1} · 뒤를 세게</small></span>${lpBtn([{ text: CM.numWord(+n2), sp: 'tc' }], '듣기: ' + CM.numWord(+n2))}<span><span lang="en">${esc(s2)}</span><small>${n2} · 앞을 세게</small></span></li>`).join('')}</ul>`;
// 07장 Yes/No 질문의 짝: 질문 · 사실 · 고를 대답
const AUX_SET = [
  { q: 'reg_taken', card: { taken: true }, ko: '들어 본 수업 (Have you …?)', fact: '한국에서 비슷한 수업을 들었어요', a: [['tk_yes'], ['tk_did'], ['tk_no']] },
  { q: 'oh_tried', card: { tried: false }, ko: '학습 안내서 (Have you …?)', fact: '학습 안내서는 아직 안 써 봤어요', a: [['tr_no'], ['tr_do'], ['tr_yes']] },
  { q: 'dm_enter', card: { enter: true }, ko: '들어가도 되나 (Is it …?)', fact: '없을 때 들어와도 괜찮아요', a: [['en_is'], ['en_do'], ['en_ok']] },
  { q: 'ra_talk', card: { talked: false }, ko: '룸메이트와 얘기 (Have you …?)', fact: '룸메이트와 아직 얘기 안 해 봤어요', a: [['tl_no'], ['tl_do'], ['tl_yes']] },
];
const NEED_OPTS = [['nd_help', '사실 + 부탁'], ['nd_hhalf', '사실만'], ['nd_hhelp', '명령'], ['nd_tlit', '‘선생님’을 그대로']];
const FIX_OPTS = [['nd_fix', '사실 + 부탁'], ['nd_fhalf', '사실만'], ['nd_fixit', '명령']];
const FULL_OPTS = [['fl_wait', '대기 명단'], ['fl_other', '다른 반'], ['fl_ok', '알겠다고만'], ['fl_res', '‘대기 예약’을 그대로'], ['fl_just', '조르기']];
const ASK_OPTS = [['qs_oh', '질문 틀'], ['g_yes', 'Yes만'], ['qs_lit', '‘선생님 · 면담 시간’을 그대로'], ['qs_tell', '명령']];
const LAB = {
  course: { n: 210, how: 'ok', sec: 'morning' },
  full: { want: 'wait', a: 'fl_wait' },
  wl: { n: 13, a: null },
  ask: { a: 'qs_oh' },
  oh: { oh: 'tt', a: null },
  shape: { q: null, pick: null, yes: false },
  help: { need: 'nd_help', trouble: 'read' },
  line: { why: 'sick', days: 2, words: [] },
  fix: { thing: 'heater', how: 'nd_fix' },
  aux: { k: 0, a: null },
  card: { issue: 'music', how: 'ok', talked: false, with: true },
};
const LAB0 = JSON.stringify(LAB);
const LABS = {
  intro: () => `${labHead('먼저 골라서 대답해 보세요')}${mini('intro')}
    <p class="note">상대의 말을 듣고 대답을 고르세요. 상대의 말은 답한 뒤에 글로 보여요. 막히면 힌트(H)로 3단계를 하나씩 열어 보세요.</p>`,
  map: () => {
    const i = S.stop, p = i != null ? CM.PLACES[i] : null;
    return `${labHead('곳을 골라 한두 마디 듣기')}
      ${seg('곳', CM.PLACES.map((x, k) => [k, `${PI(x.id)}${k + 1}. ${esc(x.ko)}`]), i == null ? '' : i, 'stop')}
      ${p ? `<ul class="qlist">${CM.PLACEQ[p.id].map(id => { const q = CM.Q[id]; return `<li>${lpBtn(staffSeq(q), '듣기: ' + q.en)}<span><span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span><small>${SHI(q.shape)} ${esc(q.ko)}</small></span></li>`; }).join('')}</ul>
        ${CM.ME_FIRST[p.id] ? '<p class="note">이곳에서는 내가 먼저 말을 꺼내요. 상대가 What can I help you with? 하고 물으면 용건은 부탁 틀로(I\'d like to …, please.), 문제는 사실 + 부탁 질문으로(… isn\'t working. Could you …?) 말해요.</p>' : ''}${clearBtn}` : '<p class="note">곳을 고르면 그곳에서 자주 듣는 말을 들을 수 있고, 영상 화면의 지도에도 표시돼요. 하늘색 → 열쇠 낱말. 보라색 테두리의 곳(수업 등록 창구 · 수업 뒤 · 교수 면담 · 기숙사 사무실 · RA)에서는 내가 먼저 말을 꺼내요. 대학 · 교수 · 기숙사 이름, 과목 번호, 면담 시간, 방 번호는 모두 지어낸 예시예요. 실제 절차는 학교마다 달라요.</p>'}`;
  },
  reg: () => {
    const r = LAB.course, C = Object.assign({}, D, { course: r.n, sec: r.sec }), sw = CM.digitSwap(r.n);
    const HOW = { ok: OT('nd_reg', r.n), swap: OT('nd_reg', sw), apply: OT('nd_apply', r.n), half: OT('nd_rhalf') };
    const a1 = HOW[r.how], j1 = CM.judge(CM.Q.reg_help, a1, C, '상황');
    const a2 = OT('sc_pl', r.sec), j2 = CM.judge(CM.Q.reg_sec, a2, C, '상황');
    return `${labHead('용건은 부탁 틀로 — register for')}
      ${row('과목', seg('과목', CM.COURSE_IDS.map(n => [n, `English ${n} · ${esc(CM.COURSES[n].ko)}`]), r.n, 'cn'))}
      ${row('말하는 방법', seg('말하는 방법', [['ok', '부탁 틀 (register for)'], ['swap', `번호를 바꿔서 (${sw})`], ['apply', '‘신청’을 apply로'], ['half', '사실만 (교환학생이에요)']], r.how, 'ch'))}
      ${qLine(CM.Q.reg_help)}${meLine(a1)}${verdictHTML(j1)}${j1.ok ? sayLine(CM.Q.reg_help, CM.reply(CM.Q.reg_help, a1, C)) : ''}
      <p class="note">과목 번호 ${r.n} → <span lang="en">${esc(CM.roomWords(r.n))}</span>. 세 자리 번호는 첫 자리와 끝 두 자리, 두 묶음으로 읽어요. 끝 두 자리를 바꾸면(${sw} → <span lang="en">${esc(CM.roomWords(sw))}</span>) 다른 과목이에요. 고른 과목은 영상 화면의 수업 목록에도 그려져요.</p>
      ${row('반', seg('반', Object.keys(CM.SECTIONS).map(k => [k, `${esc(CM.SECTIONS[k].ko)} (${esc(CM.SECTIONS[k].time)})`]), r.sec, 'cs'))}
      ${qLine(CM.Q.reg_sec)}${meLine(a2)}${verdictHTML(j2)}
      <h3 class="mt">Have you …? → Yes, I have.</h3>${qLine(CM.Q.reg_taken)}${meLine(OT('tk_yes'))}${meLine(OT('tk_ask'), '듣기 (안 들어 봤으면)')}
      <p class="note">들어 봤으면 → <span lang="en">Yes, I have.</span>에 어디서 들었는지를 덧붙여요. 안 들어 봤으면 사실에 부탁을 붙여요 → <span lang="en">No, I haven't. Could I still sign up?</span> 실제 수강 신청 방법은 학교마다 달라요.</p>${S.course ? clearBtn : ''}`;
  },
  full: () => {
    const f = LAB.full, C = Object.assign({}, D, { full: f.want }), q0 = CM.Q.fl_full;
    const a0 = f.a === 'fl_other' ? OT('fl_other', C.alt) : OT(f.a), j0 = CM.judge(q0, a0, C, '상황');
    const r = LAB.wl, WC = Object.assign({}, D, { wl: r.n }), q = CM.simQ('fl_wl', WC), sw = CM.teenSwap(r.n);
    const OPTS = [['so', OT('wl_so', r.n)], ['swap', OT('wl_so', sw)], ['skip', OT('wl_ok')]];
    let res = '';
    if (r.a) { const a = OPTS.find(o => o[0] === r.a)[1], j = CM.judge(q, a, WC, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(q, reactEn(q, j, a, WC))}`; }
    return `${labHead('반이 다 찼을 때 · 대기 번호 되짚기')}
      ${row('바라는 것', seg('바라는 것', [['wait', '대기 명단에 올리기'], ['other', `${esc(CM.SECTIONS[D.alt].ko)}도 괜찮아요`]], f.want, 'fw'))}
      ${qLine(q0)}
      ${seg('대답', FULL_OPTS.map(([k, t]) => [k, esc(t)]), f.a, 'fa')}
      ${meLine(a0)}${verdictHTML(j0)}${sayLine(q0, reactEn(q0, j0, a0, C))}
      <p class="note">다 찼다는 안내에는 알겠다고만 하지 말고, 할 수 있는 방법을 질문으로 물어요 → <span lang="en">Could you put me on the waitlist, please?</span> · <span lang="en">Could I join the afternoon section instead?</span> 자리가 나기를 기다리는 명단은 reservation이 아니라 <span lang="en">the waitlist</span>예요.</p>
      <h3 class="mt">대기 번호 듣고 되짚기</h3>
      ${row('대기 번호', seg('대기 번호', CM.WLS.map(n => [n, `${n}번`]), r.n, 'wn'))}
      ${qLine(q)}
      ${seg('대답', OPTS.map(([k, a]) => [k, `<span lang="en">${esc(CM.text(a))}</span>`]), r.a || '', 'wa')}
      ${res}
      ${pairList()}
      <p class="note">${r.n} → <span lang="en">${esc(CM.numWord(r.n))}</span>(뒤를 세게) · ${sw} → <span lang="en">${esc(CM.numWord(sw))}</span>(앞을 세게). 들은 번호는 되짚어 확인해요 → <span lang="en">So, I'm number ${r.n}?</span> 잘못 되짚으면 직원이 바로잡아 줘요. 고른 번호는 영상 화면의 대기표에도 그려져요.</p>${S.wl ? clearBtn : ''}`;
  },
  class: () => {
    const q0 = CM.Q.cl_q, a0 = OT(LAB.ask.a), j0 = CM.judge(q0, a0, D, '상황');
    const r = LAB.oh, C = Object.assign({}, D, { oh: r.oh }), q = CM.simQ('cl_oh', C), o = CM.OHS[r.oh], tr = CM.tailSwap(o.room);
    const OPTS = [['ok', OT('oh_so', r.oh)], ['~d', OT('oh_so', r.oh + '~d')], ['~r', OT('oh_so', r.oh + '~r')], ['skip', OT('oh_ok')]];
    let res = '';
    if (r.a) { const a = OPTS.find(x => x[0] === r.a)[1], j = CM.judge(q, a, C, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(q, reactEn(q, j, a, C))}`; }
    return `${labHead('교수에게 묻기 · 면담 시간 되짚기')}
      ${qLine(q0)}
      ${seg('대답', ASK_OPTS.map(([k, t]) => [k, esc(t)]), LAB.ask.a, 'ka')}
      ${meLine(a0)}${verdictHTML(j0)}${sayLine(q0, reactEn(q0, j0, a0, D))}
      <p class="note">교수님은 → <span lang="en">Professor + 성 (Professor Hale)</span>. 학생을 만나는 시간은 → <span lang="en">office hours</span>. 물어볼 것은 Yes 뒤에 바로 질문으로 → <span lang="en">Could you tell me when your office hours are?</span></p>
      <h3 class="mt">면담 시간 듣고 되짚기</h3>
      ${row('면담 시간', seg('면담 시간', CM.OH_IDS.map(id => [id, `${esc(CM.OHS[id].ko)} · ${CM.OHS[id].room}호`]), r.oh, 'on'))}
      ${qLine(q)}
      ${seg('대답', OPTS.map(([k, a]) => [k, `<span lang="en">${esc(CM.text(a))}</span>`]), r.a || '', 'oa')}
      ${res}
      <p class="note">방 ${o.room} → <span lang="en">${esc(CM.roomWords(o.room))}</span>. 헷갈리기 쉬운 값 → ${tr} (<span lang="en">${esc(CM.roomWords(tr))}</span>). 요일은 묶음으로 들어요(<span lang="en">${esc(o.days)}</span> = ${esc(o.ko)}). 고른 대답은 영상 화면의 연구실 문패에도 그려져요. 면담 시간과 방 번호는 지어낸 예시예요.</p>
      <h3 class="mt">빠른 말은 들린 만큼 되묻기</h3>${qLine(CM.Q.cl_fast)}${meLine(OT('rp_oh'))}
      <p class="note">‘… office hours …’만 들렸으면 짐작하지 말고 들린 낱말로 되물어요 → <span lang="en">Sorry, when are your office hours?</span></p>${S.oh ? clearBtn : ''}`;
  },
  hours: () => {
    const r = LAB.shape, q = r.q ? CM.Q[r.q] : null;
    let res = '';
    if (q && r.pick) res = `<p class="verdict"><b class="${r.pick === q.shape ? 'c-ok' : 'c-no'}">${r.pick === q.shape ? '맞아요' : '다시 보세요'}</b>${esc(`${CM.SHAPE[q.shape].ko} → ${CM.sayOf(q.intent)}. 대답 → ${CM.SHAPE[q.shape].ans}.`)}</p>`;
    if (q && r.yes) { const j = CM.judge(q, { f: 'g_yesp' }, D, '상황'); res += `${meLine({ f: 'g_yesp' })}${verdictHTML(j)}`; }
    const h = LAB.help, C = Object.assign({}, D, { trouble: h.trouble });
    const a1 = h.need === 'nd_tlit' ? OT('nd_tlit') : OT(h.need, h.trouble), j1 = CM.judge(CM.Q.oh_help, a1, C, '상황');
    return `${labHead('어려운 것은 사실로, 바라는 것은 질문으로')}
      ${row('어려운 것', seg('어려운 것', Object.keys(CM.TROUBLE).map(k => [k, esc(CM.TROUBLE[k].ko)]), h.trouble, 'ht'))}
      ${row('말하는 방법', seg('말하는 방법', NEED_OPTS, h.need, 'hn'))}
      ${qLine(CM.Q.oh_help)}${meLine(a1)}${verdictHTML(j1)}${sayLine(CM.Q.oh_help, reactEn(CM.Q.oh_help, j1, a1, C))}
      <p class="note">어려운 것은 사실로 → <span lang="en">I'm having trouble with the readings.</span> 바라는 것은 질문으로 → <span lang="en">Could you give me some advice?</span> 사실만 말하면 교수가 무엇을 해 주길 바라는지 짐작해야 해요.</p>
      <h3 class="mt">고르는 질문 골라 보기</h3>${mini('part')}
      <h3 class="mt">질문의 모양 맞히기</h3>
      <p class="note">상대의 말을 고르고, 모양을 맞혀 보세요. 그다음 <span lang="en">Yes, please.</span>로 대답하면 어떻게 되는지 규칙 엔진에 물어봐요. 고른 말은 영상 화면에도 그려져요.</p>
      ${seg('상대의 말', CM.SHAPE_QS.map(id => [id, `<span lang="en">${esc(CM.Q[id].short && /\?$|!$/.test(CM.Q[id].short) ? CM.Q[id].short : CM.Q[id].en)}</span>`]), r.q || '', 'sq')}
      ${q ? `<h3 class="mt">이 말의 모양은?</h3>${seg('모양', ['yn', 'or', 'wh', 'note'].map(sh => [sh, SHI(sh)]), r.pick || '', 'sp')}
        <div class="tg-acts mt8"><button type="button" class="btn ghost" id="shapeYes">Yes, please.로 대답해 보기</button>${lpBtn(staffSeq(q), '상대의 말 듣기')}</div>${res}` : ''}${S.shape ? clearBtn : ''}`;
  },
  ext: () => {
    const r = LAB.line, due = CM.dueOf(r.days), C = Object.assign({}, D, { why: r.why, days: r.days, due }), a = CM.L(r.words.slice());
    let res = '';
    if (r.words.length) { const j = CM.judge(CM.Q.ex_else, a, C, '상황'); res = `${meLine(a)}${verdictHTML(j)}${sayLine(CM.Q.ex_else, CM.fixLine(a.line, C).en)}`; }
    const dq = CM.simQ('ex_due', C), da = OT('du_so', due);
    return `${labHead('마감 연장 부탁 한 줄 — 사실 + 질문')}
      ${row('까닭', seg('까닭', CM.WHY_IDS.map(k => [k, esc(CM.WHYS[k].ko)]), r.why, 'ew'))}
      ${row('더 필요한 날', seg('날수', [2, 3].map(n => [n, `${esc(CM.DAYS[n].ko)} 더`]), r.days, 'ed'))}
      <p class="note">에세이 마감은 금요일 자정이에요. ${esc(CM.DAYS[r.days].ko)} 미루면 → ${esc(CM.DUES[due].ko)}.</p>
      ${qLine(CM.Q.ex_else)}
      <p class="note">조각을 누르는 차례대로 문장이 돼요. 일부러 Teacher · I want · report 조각을 고르거나, 까닭을 빼거나, 차례를 바꿔 보세요.</p>
      ${lineRows(C, r.words, 'lw')}${res}
      <div class="tg-acts mt8"><button class="btn ghost" type="button" id="lineClear">처음부터</button>${S.line ? clearBtn : ''}</div>
      <p class="note">차례(부르는 말 → 까닭(사실) → 부탁 틀 → 바라는 것)는 자주 쓰는 꼴을 단순하게 줄인 규칙이에요. 틀린 조각이 있으면 교수는 그 조각만 다시 물어요(<code>CM.fixLine</code>). 날수까지 말하면 ‘며칠 더’ 질문을 건너뛰어요. 만든 한 줄은 영상 화면에도 그려져요.</p>
      <h3 class="mt">며칠 더 · 새 마감 되짚기</h3>
      ${qLine(CM.Q.ex_days)}${meLine(OT('dy_pl', r.days))}
      ${qLine(dq)}${meLine(da)}${sayLine(dq, CM.reply(dq, da, C))}
      <p class="note">‘이틀 동안’의 ‘동안’을 during으로 옮기면 어색해요 → <span lang="en">Just two more days, if possible.</span> 새 마감의 요일은 되짚어 확인해요(<span lang="en">${esc(CM.DUES[due].t)}</span>).</p>`;
  },
  dorm: () => {
    const f = LAB.fix, C = Object.assign({}, D, { thing: f.thing === 'boiler' ? 'heater' : f.thing });
    const a1 = OT(f.how, f.thing), j1 = CM.judge(CM.Q.dm_help, a1, C, '상황');
    const X = AUX_SET[LAB.aux.k], aq = CM.Q[X.q], XC = Object.assign({}, D, X.card);
    let ares = '';
    if (LAB.aux.a != null) { const [af, av] = X.a[LAB.aux.a], a = OT(af, av), j = CM.judge(aq, a, XC, '상황'); ares = `${meLine(a)}${verdictHTML(j)}`; }
    const vq = CM.Q.dm_visit, va = OT('vs_so', 'a');
    return `${labHead('고장은 사실 + 부탁 · Yes/No의 짝')}
      ${row('고장 난 것', seg('고장 난 것', CM.THING_IDS.map(k => [k, esc(CM.THINGS[k].ko)]).concat([['boiler', '난방기 → boiler로']]), f.thing, 'ft'))}
      ${row('말하는 방법', seg('말하는 방법', FIX_OPTS, f.how, 'fh'))}
      ${qLine(CM.Q.dm_help)}${meLine(a1)}${verdictHTML(j1)}${sayLine(CM.Q.dm_help, reactEn(CM.Q.dm_help, j1, a1, C))}
      <p class="note">방을 데우는 기계는 → <span lang="en">heater</span>(boiler는 건물 전체의 물을 데우는 큰 기계예요). 고장은 → <span lang="en">… isn't working.</span> 바라는 것은 질문으로 → <span lang="en">Could you send someone to look at it?</span></p>
      <h3 class="mt">방 번호 대답 골라 보기</h3>${mini('room')}
      <h3 class="mt">모르는 낱말은 물어요</h3>${qLine(CM.Q.dm_enter)}${meLine(OT('rp_wmain'))}${sayLine(CM.Q.dm_enter, repairLine('what', CM.Q.dm_enter, {}))}${meLine(OT('en_ok'))}
      <p class="note">maintenance → 건물의 시설을 고치는 직원(시설 관리). 없을 때 들어와도 괜찮으면 → <span lang="en">Yes, that's fine.</span> 내가 있을 때 왔으면 → <span lang="en">Actually, I'd rather be there, if that's okay.</span></p>
      <h3 class="mt">수리 시간 되짚기</h3>${qLine(vq)}${meLine(va)}${sayLine(vq, CM.reply(vq, va, D))}
      <h3 class="mt">Yes/No 질문은 첫 낱말로 짝 맞추기</h3>
      ${row('질문', seg('질문', AUX_SET.map((x, k) => [k, esc(x.ko)]), LAB.aux.k, 'xk'))}
      ${qLine(aq)}<p class="note"><span lang="en">${esc(CM.AUX[aq.aux].q)}</span> → <span lang="en">${esc(CM.AUX[aq.aux].a)}</span> · 사실: ${esc(X.fact)}</p>
      ${seg('대답', X.a.map(([af, av], k) => [k, `<span lang="en">${esc(CM.text(OT(af, av)))}</span>`]), LAB.aux.a == null ? '' : LAB.aux.a, 'xa')}
      ${ares}${S.aux ? clearBtn : ''}`;
  },
  ra: () => {
    const r = LAB.card, C = Object.assign({}, D, { issue: r.issue, talked: r.talked, with: r.with });
    const ex = (qid, a) => { const q = CM.Q[qid], j = CM.judge(q, a, C, '상황'); return `${qLine(q)}${meLine(a)}${verdictHTML(j)}${sayLine(q, reactEn(q, j, a, C))}`; };
    return `${labHead('룸메이트 문제 — 사실 → 그래서 → 부탁')}
      ${row('문제', seg('문제', CM.ISSUE_IDS.map(k => [k, esc(CM.ISSUES[k].ko)]), r.issue, 'ri'))}
      ${row('말하는 방법', seg('말하는 방법', [['ok', '사실 + 그래서 + 부탁'], ['half', '사실만']], r.how, 'rh'))}
      ${ex('ra_help', OT(r.how === 'half' ? 'nd_ahalf' : 'nd_adv', r.issue))}
      ${row('얘기해 봤나', seg('얘기해 봤나', [['1', '해 봤어요 (달라진 게 없어요)'], ['0', '아직이요']], r.talked ? '1' : '0', 'rt'))}
      ${ex('ra_talk', OT(r.talked ? 'tl_yes' : 'tl_no'))}
      ${row('RA가 함께', seg('RA가 함께', [['1', '있어 주면 좋아요'], ['0', '먼저 혼자 얘기해 볼래요']], r.with ? '1' : '0', 'rw'))}
      ${ex('ra_with', OT(r.with ? 'wi_yes' : 'wi_no'))}
      <p class="note">‘여기가 시끄러워요’를 <span lang="en">Here is too noisy.</span>로 옮기면 어색해요 → <span lang="en">It's too noisy in my room.</span> 무엇 때문인지(사실), 그래서 어떤지(<span lang="en">so I can't sleep</span>), 바라는 것(<span lang="en">Could I get some advice?</span>)을 차례로 말해요. 도와주겠다는 말에는 → <span lang="en">Yes, please. That would really help.</span> 고른 것은 영상 화면에도 보여요. 실제 기숙사 규칙과 상담 방법은 학교마다 달라요.</p>
      <h3 class="mt">빠른 말은 들린 만큼 되묻기</h3>${qLine(CM.Q.ra_fast)}${meLine(OT('rp_talk'))}${S.card ? clearBtn : ''}`;
  },
  method: () => {
    const i = S.place, rw = i != null ? CM.METHOD[i] : null;
    return `${labHead('곳마다 3단계 적용해 보기')}
      ${seg('곳', CM.METHOD.map(([qid], k) => [k, `${PI(CM.Q[qid].place)}${esc(CM.PLACE[CM.Q[qid].place].ko)}`]), i == null ? '' : i, 'place')}
      ${rw ? (() => { const [qid, a, c] = rw, q = CM.Q[qid], j = CM.judge(q, a, Object.assign({}, D, c || {})); return `<p class="enline">${lpBtn(staffSeq(q), '듣기')}<span lang="en">${lineHTML(q.en, keyMarks(q), true)}</span></p>
        <ol class="edr-steps"><li><b>① 열쇠 낱말 + 모양</b> ${esc(q.key.join(' … '))} → ${SHI(q.shape)} ${esc(CM.sayOf(q.intent))}</li><li><b>② 틀 + 내 정보</b> <span lang="en">${segHTML(a)}</span> ${esc(CM.ko(a))}</li><li><b>③ 공손하게</b> ${esc(j.why)}</li></ol>
        <p class="enline">${lpBtn(staffSeq(q).concat([{ text: CM.text(a), sp: 'me', gap: 0.5 }]), '대화 듣기')}<span>대화 듣기</span></p>
        ${clearBtn}`; })() : '<p class="note">곳을 고르면 영상 화면의 그 줄이 켜지고, 세 단계를 글로 보여 줘요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>대화 골라 보기</h3>
    <div class="seg">${CMS.PSEG.map((t, i) => `<button type="button" data-seek="${t + 0.4}">대화 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 해 보고 싶다면 아래 <a href="#playground">교환학생 시뮬레이터</a>에서 내 카드로 수업 등록부터 RA 상담까지 해 보세요. 카드는 누를 때마다 새로 만들어져요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">교환학생 시뮬레이터</a> — 내 카드로 수업 등록 · 교수 면담 · 마감 연장 · 기숙사 · RA 상담(부탁 한 줄도)</li><li><a href="#shadow">교환학생 표현 따라 말하기</a> — ${CM.SHADOW.length}문장 듣고 따라 하기</li>
    <li><a href="#drill">듣고 대답 고르기</a> — 일곱 곳 ${CM.DRILL.length}문제, 3단계 힌트</li><li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.querySelectorAll('.lmini').forEach(m => CDrill(m, [CM.MINI[m.dataset.mini]], { compact: true, onAnswer() { if (playing) pause(); } }));
}
function showAt(u) { const ch = CHAPTERS[CMS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const relab = () => { touch(); buildLab(CMS.chapterAt(T)); };
// 직접 해 보기 상태 → 영상 화면 상태
const syncCourse = () => { S.course = Object.assign({}, LAB.course); };
const syncWl = () => { S.wl = { n: LAB.wl.n, a: LAB.wl.a }; };
const syncOh = () => { S.oh = { oh: LAB.oh.oh, a: LAB.oh.a || 'ok' }; };
const syncShape = () => { S.shape = LAB.shape.q || null; };
const syncLine = () => { const r = LAB.line; S.line = { words: r.words.slice(), why: r.why, days: r.days }; };
const syncAux = () => { const X = AUX_SET[LAB.aux.k], A = LAB.aux.a != null ? X.a[LAB.aux.a] : null; S.aux = A ? { q: X.q, a: A[0], v: A[1], card: X.card } : null; };
const syncCard = () => { S.card = Object.assign({}, LAB.card); };
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  const d = b.dataset;
  if (d.seek) { seek(CHAPTERS[CMS.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') {
    ['stop', 'place', 'course', 'shape', 'wl', 'aux', 'oh', 'line', 'card'].forEach(k => { S[k] = null; });
    Object.assign(LAB, JSON.parse(LAB0));
    relab(); return;
  }
  if (d.stop != null) { S.stop = d.stop === '' ? null : +d.stop; showAt(18.8); relab(); return; }
  // 02장 수업 등록
  if (d.cn) { LAB.course.n = +d.cn; syncCourse(); relab(); return; }
  if (d.ch) { LAB.course.how = d.ch; syncCourse(); relab(); return; }
  if (d.cs) { LAB.course.sec = d.cs; syncCourse(); relab(); return; }
  // 03장 정원 (대답은 영상 화면을 바꾸지 않아요) · 대기 번호
  if (d.fw) { LAB.full.want = d.fw; relab(); return; }
  if (d.fa) { LAB.full.a = d.fa; relab(); return; }
  if (d.wn) { LAB.wl.n = +d.wn; syncWl(); relab(); return; }
  if (d.wa) { LAB.wl.a = d.wa; syncWl(); relab(); return; }
  // 04장 수업 뒤 교수에게 · 면담 시간
  if (d.ka) { LAB.ask.a = d.ka; relab(); return; }
  if (d.on) { LAB.oh.oh = d.on; syncOh(); relab(); return; }
  if (d.oa) { LAB.oh.a = d.oa; syncOh(); relab(); return; }
  // 05장 교수 면담 · 질문의 모양
  if (d.ht) { LAB.help.trouble = d.ht; relab(); return; }
  if (d.hn) { LAB.help.need = d.hn; relab(); return; }
  if (d.sq) { LAB.shape = { q: d.sq, pick: null, yes: false }; syncShape(); relab(); return; }
  if (d.sp) { LAB.shape.pick = d.sp; syncShape(); relab(); return; }
  if (b.id === 'shapeYes') { LAB.shape.yes = true; syncShape(); relab(); return; }
  // 06장 부탁 한 줄
  if (d.ew) { LAB.line = { why: d.ew, days: LAB.line.days, words: [] }; syncLine(); relab(); return; }
  if (d.ed) { LAB.line = { why: LAB.line.why, days: +d.ed, words: [] }; syncLine(); relab(); return; }
  if (d.lw) { LAB.line.words = toggleWord(LAB.line.words, d.lw); syncLine(); relab(); return; }
  if (b.id === 'lineClear') { LAB.line.words = []; syncLine(); relab(); return; }
  // 07장 기숙사 고장 (영상 화면을 바꾸지 않아요) · Yes/No의 짝
  if (d.ft) { LAB.fix.thing = d.ft; relab(); return; }
  if (d.fh) { LAB.fix.how = d.fh; relab(); return; }
  if (d.xk != null) { LAB.aux = { k: +d.xk, a: null }; syncAux(); relab(); return; }
  if (d.xa != null) { LAB.aux.a = +d.xa; syncAux(); relab(); return; }
  // 08장 룸메이트 · RA
  if (d.ri) { LAB.card.issue = d.ri; syncCard(); relab(); return; }
  if (d.rh) { LAB.card.how = d.rh; syncCard(); relab(); return; }
  if (d.rt != null) { LAB.card.talked = d.rt === '1'; syncCard(); relab(); return; }
  if (d.rw != null) { LAB.card.with = d.rw === '1'; syncCard(); relab(); return; }
  if (d.place != null) { S.place = d.place === '' ? null : +d.place; showAt(3.8); relab(); }
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   영어 속 과목 번호 · 방 번호 · 대기 번호 · 시각은 영어 낱말로(English 210 → English two-ten, Room 318 → Room three-eighteen, number 13 → number thirteen)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/\b(?:English|Room) \d{3}\b|\bnumber \d{1,2}\b|\b(?:from|between) \d{1,2} (?:to|and) \d{1,2}\b/g, m => CM.spoken(m)],
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
   10. 놀이터 — 교환학생 시뮬레이터
   수업 등록 창구(내가 먼저 용건) → 반 · 들어 본 수업 → 반이 다 참(대기 명단 · 다른 반) → 대기 번호 되짚기
   → 수업 뒤 교수에게(면담 시간 묻기 · 되짚기) → 교수 면담(어려운 것 + 부탁 · 고르기 · 해 본 것) → 마감 연장 부탁 한 줄 · 며칠 더 · 새 마감 되짚기
   → 기숙사 사무실(고장 + 부탁 · 방 번호 · 들어가도 되나 · 수리 시간 되짚기) → RA 상담(문제 + 부탁 · 얘기해 봤나 · 함께 있어 줄까).
   대기 번호 · 면담 시간 · 새 마감 · 수리 시간은 내 카드에 없어요 — 상대가 말한 것을 듣고 되짚어야 해요. 마감 연장 부탁은 조각 칩으로 한 줄을 만들어요(CM.lineChips → CM.checkLine).
   ========================================================= */
const SIM = { card: null, qs: [], i: 0, frames: [], slots: {}, f: null, v: null, log: [], started: false, script: !CMV.supported, mode: null, react: null, why: null, done: false, listening: false, heard: null, covered: new Set(), skipped: [], line: { words: [] }, chips: [] };
const simQ = () => CM.simQ(SIM.qs[SIM.i], SIM.card);
const simC = () => Object.assign({}, SIM.card, simQ().fact || {});
window.__simCard = () => Object.assign({}, SIM.card);   // 확인용(읽기만): 지금 내 카드
window.__simQ = () => Object.assign({}, simQ());          // 확인용(읽기만): 지금 상대의 말
const keyOf = q => `${q.place}:${q.intent}`;
const skipLabel = ids => ids.map(id => CM.INTENT_KO[CM.Q[id].intent]).filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
const isCovered = q => SIM.covered.has(keyOf(q)) || SIM.covered.has('*:' + q.intent);
const LINE_INTENT = 'else';
const PLACE_INTRO = {
  full: () => '그런데 고른 반이 다 찼대요. 알겠다고만 하지 말고 할 수 있는 방법을 질문으로 물어요.',
  class: () => `첫 수업이 끝났어요. ${CM.PROF}에게 면담 시간을 물어요. 요일과 방 번호는 교수가 알려 줘요 — 듣고 되짚어요.`,
  hours: () => '면담 시간에 연구실에 왔어요. 어려운 것은 사실로, 바라는 것은 질문으로 말해요.',
  ext: () => '면담이 끝나 가요. 에세이 마감을 미뤄 달라고 부탁할 차례예요 — 조각 칩으로 사실 + 부탁 한 줄을 만들어요.',
  dorm: () => '기숙사 사무실에 왔어요. 여기서도 내가 먼저 말해요. 고장은 사실로, 바라는 것은 질문으로.',
  ra: () => '저녁에 RA를 찾아왔어요. 룸메이트 문제를 사실 → 그래서 → 부탁 차례로 말해요.',
};
function simNew() {
  CMV.stop(); stopListening();
  SIM.card = CM.newCard(); SIM.qs = CM.simQs(SIM.card); SIM.i = 0; SIM.log = []; SIM.done = false; SIM.react = null; SIM.why = null; SIM.heard = null;
  SIM.covered = new Set(); SIM.skipped = [];
  simPrep(); simBuild();
}
function simPrep() {
  const q = simQ(), C = simC();
  SIM.slots = {}; SIM.f = null; SIM.v = null; SIM.line = { words: [] }; SIM.chips = [];
  if (q.intent === LINE_INTENT) { SIM.frames = []; SIM.chips = CM.lineChips(C); }
  else {
    SIM.frames = shuffle(CM.simFrames(q.intent, C) || []);
    SIM.frames.forEach(f => { const Fm = CM.FRAME[f]; if (Fm.slot) SIM.slots[f] = CM.slotChoices(Fm.slot, C, Math.random, q); });
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
  if (kind === 'what') return 'Maintenance means the staff who fix things in the building, like the heater or the lights.';
  return null;
}
function simAnswer(a, spoken) {
  if (SIM.done || !SIM.started) return;
  const q = simQ(), C = simC(), L = SIM.log[SIM.i];
  const j = spoken ? CM.matchSpoken(spoken, q, C) : CM.judge(q, a, C);
  const model = CM.model(q, C);
  SIM.heard = spoken || null;
  if (j.repair) {
    const re = repairLine(j.repair, q, C);
    SIM.react = { en: re || 'Sure. ' + q.en, ko: re ? (j.repair === 'check' ? '상대가 숫자를 확인해 줬어요. 이제 대답해 보세요.' : '상대가 쉬운 말로 알려 줬어요. 이제 대답해 보세요.') : '다시 물었어요. 상대가 천천히 한 번 더 말해요.', st: 'repair', who: whoOf(q) }; SIM.why = null; simBuild();
    simSpeak(re ? [{ text: re, sp: q.sp }] : [{ text: 'Sure.', sp: q.sp }, { text: q.en, sp: q.sp, gap: 0.4 }], { slow: true }); return;
  }
  L.tries.push({ t: spoken ? `(말로) ${spoken}` : CM.text(a), ok: j.ok, stage: j.stage });
  SIM.why = { j, model, spoken: !!spoken };
  if (j.ok) {
    L.final = spoken || CM.text(a);
    (spoken ? (j.covered || [q.intent]) : CM.covered(a, q)).filter(i => i !== q.intent).forEach(i => SIM.covered.add(CM.CROSS[i] ? `*:${i}` : `${q.place}:${i}`));
    const ok = CM.REACT.ok[(SIM.i + L.tries.length) % CM.REACT.ok.length];
    let n = SIM.i + 1; const skip = [];
    while (n < SIM.qs.length && isCovered(CM.Q[SIM.qs[n]])) { skip.push(SIM.qs[n]); n++; }
    SIM.skipped.push(...skip);
    const reply = CM.reply(q, a || model, C);
    if (n >= SIM.qs.length) {
      const bye = [reply, 'Good luck with the semester!'].filter(Boolean).join(' ');
      SIM.done = true; SIM.react = { en: bye, ko: '모두 마쳤어요! 수업 등록부터 교수 면담 · 마감 연장 · 기숙사 수리 · RA 상담까지 해냈어요.', st: 'ok', who: whoOf(q) };
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
    const r = j.stage === 1 ? CM.REACT[1](q) : j.stage === 2 ? CM.REACT[2](q, j, a, C) : j.stage === 3 ? CM.REACT[3](q, j, a) : { en: 'Sorry?', ko: '알아듣지 못했어요.' };
    SIM.react = Object.assign({ st: 'no', who: whoOf(q) }, r);
    if (q.intent !== LINE_INTENT) { SIM.f = null; SIM.v = null; }   // 부탁 한 줄은 틀린 조각만 바꿔 끼우게 그대로 둬요
    simBuild(); simSpeak([{ text: r.en, sp: q.sp }]);
  }
}
const chipT = f => esc(CM.FRAME[f].t.replace(/[{}]/g, '')).replace('___', '<i class="blank">___</i>');
const slotLabel = (f, v) => { const F0 = CM.FRAME[f], x = CM.sv(F0.slot, v); return x ? (x[F0.form || 't'] != null ? x[F0.form || 't'] : x.t) : v; };
// 학기 첫 주 정리표 (HTML) — 시뮬레이터의 끝: 수업 · 반 · 면담 시간 · 새 마감 · 수리 · RA
function campusHTML(c) {
  const o = CM.OHS[c.oh], r = CM.roomParse(c.room), v = CM.VISITS[c.visit];
  const rows = [['COURSE', `ENGLISH ${c.course} · ${CM.COURSES[c.course].t.toUpperCase()}`],
    ['SECTION', c.full === 'wait' ? `${c.sec.toUpperCase()} · WAITLIST #${c.wl}` : `${c.alt.toUpperCase()} · ENROLLED`],
    ['OFFICE HOURS', `${o.short.toUpperCase()} ${o.from}–${o.to} · ROOM ${o.room}`],
    ['ESSAY DUE', `${CM.DUES[c.due].day.toUpperCase()} MIDNIGHT (+${c.days} DAYS)`],
    ['REPAIR', `${CM.THINGS[c.thing].t.toUpperCase()} · ${CM.HALLS[r.hall].t.toUpperCase()} ${r.n}`],
    ['VISIT', `TOMORROW ${v.from}–${v.to}${c.enter ? '' : ' · WHEN I\'M IN'}`],
    ['RA', c.with ? 'TALK TOGETHER' : 'I\'LL TALK FIRST']];
  return `<div class="rcpt" role="img" aria-label="학기 첫 주 정리"><p class="rc-h">${esc(CM.UNI.toUpperCase())}</p><p class="rc-g">FIRST WEEK · CHECKLIST</p><ul>${rows.map(([k, x]) => `<li><span>${k}</span><b>${esc(x)}</b></li>`).join('')}</ul><p class="rc-t"><span>STATUS</span><b>ALL SET</b></p></div>`
    + '<p class="rc-n">대학 · 교수 · 기숙사 이름, 과목 번호, 면담 시간, 방 번호는 지어낸 예시예요. 실제 절차는 학교마다 달라요.</p>';
}
// 새 마감 달력 (캔버스) — 모두 마친 뒤에만 그려요
function drawSimArt(c) {
  const cv2 = $('simArt'); if (!cv2) return;
  const W0 = 380, H0 = 244, d = 2, g = cv2.getContext('2d');
  cv2.width = W0 * d; cv2.height = H0 * d; g.setTransform(d, 0, 0, d, 0, 0);
  g.fillStyle = CMS.COL.bg; g.fillRect(0, 0, W0, H0);
  CMS.weekCal(g, 10, 11, 360, { days: c.days });
}
function simBuild() {
  const hear = CMV.supported, C = SIM.card;
  $('simCard').innerHTML = `<p class="tc-head">${PI('id')}<b>내 카드</b> <span lang="en">MY CARD</span></p><dl>${CM.cardRows(C).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="tc-foot">${esc(CM.UNI)} (지어낸 대학) · 대기 번호 · 면담 시간 · 새 마감 · 수리 시간은 카드에 없어요 — 상대가 말하는 것을 들어요</p>`;
  const prog = SIM.qs.map((id, k) => { const L = SIM.log[k], skipped = SIM.skipped.includes(id), c = skipped ? ' skip' : !L || !L.final ? (k === SIM.i && !SIM.done ? ' cur' : '') : L.tries[0] && L.tries[0].ok ? ' ok' : ' late'; return `<li class="${c}" title="${esc(CM.INTENT_KO[CM.Q[id].intent] || '')}${skipped ? ' (건너뜀)' : ''}">${k + 1}</li>`; }).join('');
  $('simProg').innerHTML = prog;
  const box = $('simMain');
  if (!SIM.started) {
    box.innerHTML = `<div class="sim-start"><p>왼쪽 내 카드가 이번 주의 사실이에요. 수업 등록 창구(내가 먼저 용건을 말해요) → 반 · 대기 명단, 수업 뒤 교수에게 면담 시간 묻기, 교수 면담(어려운 것 + 부탁) → 마감 연장 부탁 한 줄, 기숙사 사무실(고장 + 부탁) → RA 상담 차례로 이야기해요. 먼저 <b>질문의 모양</b>을 잡고(Yes/No · 고르기 · 정보 · 안내), 대답 틀 칩을 고른 뒤 카드의 정보 칩을 넣어요. 대기 번호 · 면담 시간 · 새 마감 · 수리 시간은 카드에 없으니 <b>상대가 말하는 것</b>을 잘 듣고 되짚으세요. 마감 연장 부탁은 <b>조각 칩</b>으로 사실 + 부탁 한 줄을 만들어요(R 다시 듣기 · S 천천히)${SRC ? ' — 마이크로 말해서 대답할 수도 있어요' : ''}.</p><button type="button" class="btn" id="simGo">수업 등록 창구에서 시작 (Enter)</button></div>`;
    return;
  }
  if (SIM.done) {
    const first = SIM.log.filter(L => L && L.tries[0] && L.tries[0].ok).length, asked = SIM.log.filter(Boolean).length;
    const ml = CM.modelLine(C);
    box.innerHTML = `<div class="sim-end"><div class="end-art">${campusHTML(C)}<figure class="sim-map"><canvas id="simArt" role="img" aria-label="에세이 마감 달력: 금요일에서 ${esc(CM.DUES[C.due].ko)}로"></canvas><figcaption>새 마감 → ${esc(CM.DUES[C.due].ko)} · <span lang="en">${esc(CM.DUES[C.due].t)}</span></figcaption></figure></div><div><p class="sim-score"><b>${first} / ${asked}</b> 질문을 한 번에 통과했어요.</p>
      <p class="sim-saved">부탁 한 줄 → <span lang="en">${segHTML(ml)}</span> ${lpBtn(meSeq(ml), '부탁 한 줄 듣기')}</p>
      <p class="sim-react ok"><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>
      <ol class="sim-log">${SIM.log.filter(Boolean).map(L => `<li><span class="who">${esc(WHO[L.sp] || '직원')}</span>${lpBtn([{ text: L.en, sp: L.sp }], '듣기')}<span lang="en">${esc(L.en)}</span><br><span class="who me">나</span>${lpBtn(meSeq(L.final), '듣기')}<span lang="en">${esc(L.final)}</span>${L.tries.length > 1 ? ` <small>(${L.tries.length}번째에 통과)</small>` : ''}</li>`).join('')}</ol>
      <div class="tg-acts"><button type="button" class="btn" id="simAgain">새 카드로 다시 (N)</button>${hear ? `<button type="button" class="btn ghost" data-lp="${seqId(SIM.log.filter(Boolean).flatMap(L => [{ text: L.en, sp: L.sp }, { text: L.final, sp: 'me', gap: 0.4 }]))}">대화 전체 듣기</button>` : ''}</div></div></div>`;
    drawSimArt(C);
    return;
  }
  const q = simQ(), show = SIM.script || !hear, line = q.intent === LINE_INTENT;
  let fa = null;
  if (SIM.f) { const Fm = CM.FRAME[SIM.f]; if (!Fm.slot || SIM.v) { fa = { f: SIM.f }; if (Fm.slot) fa.v = SIM.v; } }
  let h = `${lsnBar(SIM.script)}`;
  h += `<div class="sim-officer">${staffSVG(CMS.kindOf(q))}<p class="sim-bub"><span class="who">${esc(whoOf(q))}</span><span class="ldr-t" lang="en">${lineHTML(q.en, show ? keyMarks(q) : [], show)}</span>${show ? SHI(q.shape) : ''}${hear ? `<button type="button" class="lp-play lp-mini" data-simline="1" aria-label="다시 듣기" title="다시 듣기">${SVG_PLAY}</button>` : ''}</p></div>`;
  if (SIM.react) h += `<p class="sim-react ${SIM.react.st}"><span class="who">${esc(SIM.react.who || whoOf(q))}</span><span lang="en">${esc(SIM.react.en)}</span> <small>${esc(SIM.react.ko)}</small></p>`;
  const mic = SRC ? `<button type="button" class="btn ghost sim-mic${SIM.listening ? ' on' : ''}" id="simMic" aria-pressed="${SIM.listening}">${ICO.mic}${SIM.listening ? '듣고 있어요…' : '말로 대답하기 (M)'}</button>` : '';
  if (line) {
    const L = SIM.line, a = CM.L(L.words.slice());
    h += `<div class="sim-build"><p class="sim-lab">마감 연장 부탁 한 줄 — 부르는 말 → 까닭(사실) → 부탁 틀 → 바라는 것 <small>같은 자리의 조각은 바꿔 끼워져요 · Backspace 하나 지우기</small></p>
      ${SIM.chips.map(gr => row(CM.OCAT[gr.c].ko, `<div class="seg">${gr.ids.map(w => `<button type="button" data-sw="${w}" aria-pressed="${L.words.includes(w)}"><span lang="en">${esc(CM.OW[w].t)}</span></button>`).join('')}</div>`)).join('')}
      <div class="sim-ans"><span class="who me">나</span>${L.words.length ? `<span lang="en" class="sim-line">${segHTML(a)}</span>` : '<span class="note">조각을 고르세요. Professor Hale → 까닭(사실) → Would it be possible to get → 바라는 것.</span>'}</div>
      <div class="tg-acts"><button type="button" class="btn" id="simLine"${L.words.length ? '' : ' disabled'}>말하기 (Enter)</button><button type="button" class="btn ghost" id="simLineClear"${L.words.length ? '' : ' disabled'}>지우기</button><button type="button" class="btn ghost" id="simSkip">부탁 대신 → No, that's all. Thank you!</button>${mic}</div></div>`;
  } else {
    h += `<p class="sim-lab">① 대답 틀 <small>1~${SIM.frames.length}</small></p><div class="chips" role="group" aria-label="대답 틀">${SIM.frames.map((f, k) => `<button type="button" class="chipf" data-sf="${f}" aria-pressed="${SIM.f === f}"><small>${k + 1}</small> <span lang="en">${chipT(f)}</span></button>`).join('')}</div>`;
    const Fm = SIM.f ? CM.FRAME[SIM.f] : null;
    if (Fm && Fm.slot) h += `<p class="sim-lab">② 내 정보 넣기 <small>A~C</small></p><div class="chips" role="group" aria-label="칸에 넣을 정보">${SIM.slots[SIM.f].map((v, k) => `<button type="button" class="chips-s" data-sv="${esc(v)}" aria-pressed="${SIM.v === v}"><small>${'ABC'[k]}</small> <span lang="en">${esc(slotLabel(SIM.f, v))}</span></button>`).join('')}</div>`;
    h += `<div class="sim-ans"><span class="who me">나</span>${fa ? `<span lang="en" class="sim-line">${segHTML(fa)}</span>` : SIM.f ? `<span lang="en" class="sim-line">${chipT(SIM.f)}</span>` : '<span class="note">틀을 고르세요.</span>'}</div>`;
    h += `<div class="tg-acts"><button type="button" class="btn" id="simSay"${fa ? '' : ' disabled'}>대답하기 (Enter)</button><button type="button" class="btn ghost" id="simClear"${SIM.f ? '' : ' disabled'}>지우기</button>${mic}</div>`;
  }
  if (SIM.heard) h += `<p class="note">들린 말: <span lang="en">${esc(SIM.heard)}</span></p>`;
  if (SIM.why) {
    const { j, model } = SIM.why, st = j.ok ? '통과' : ['', '①', '②', '③'][j.stage] + ' 단계에서 걸렸어요';
    h += `<div class="sim-why ${j.ok ? 'ok' : 'no'}"><p><b>${esc(st)}</b> ${esc(j.why)}</p>${j.ok ? '' : `<p>모범 대답 ${lpBtn(meSeq(model), '모범 대답 듣기')}<span lang="en">${segHTML(model)}</span> <small>${esc(CM.ko(model))}</small></p>`}${SIM.why.spoken ? '<p class="note">말로 한 대답은 낱말과 카드의 사실(과목 · 들은 번호 · 요일 · 방 번호 · 까닭)만 맞춰 봐요. 질문의 모양(yes · no만 했는지)은 보지만, 공손함과 발음은 판정하지 않아요.</p>' : ''}</div>`;
  }
  box.innerHTML = h;
  paintPlay($('sim'), SIM.mode);
}
// 상대 얼굴 (영상의 avatar와 같은 색): 등록 창구 직원(청록 재킷 · 이름표) · 헤일 교수(갈색 재킷 · 스카프 · 안경) · 기숙사 사무실 직원(남색 재킷 · 목걸이 줄) · RA(주황 셔츠 · 목걸이 줄)
const LOOKS = CMS.LOOK;
const staffSVG = kind => {
  const L = LOOKS[kind] || LOOKS.clerk;
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
    onText(alts) { const q = simQ(), C = simC(), best = alts.find(t => CM.matchSpoken(t, q, C).ok) || alts[0]; simAnswer(null, best); simKeep(); },
    onFail(msg) { SIM.react = { en: '…', ko: msg, st: 'no' }; simBuild(); simKeep(); },
  });
}
function simLineSubmit() { const L = SIM.line; if (!L.words.length) return; simAnswer(CM.L(L.words.slice())); }
function simSayChips() {
  if (!SIM.f) return;
  const Fm = CM.FRAME[SIM.f]; if (Fm.slot && !SIM.v) return;
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
    if (b.id === 'simSkip') { simAnswer({ f: 'el_no' }); simKeep(); return; }
    if (b.dataset.simline) { simAsk(null, false); return; }
    if (b.dataset.act === 'play') { if (SIM.mode === 'play' && CMV.busy()) CMV.stop(); else simAsk(null, false); return; }
    if (b.dataset.act === 'slowplay') { if (SIM.mode === 'slowplay' && CMV.busy()) CMV.stop(); else simAsk(null, true); return; }
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
    else if (sv >= 0 && SIM.f && CM.FRAME[SIM.f].slot && SIM.slots[SIM.f][sv] != null) { e.preventDefault(); SIM.v = SIM.slots[SIM.f][sv]; simBuild(); simKeep(); return; }
    else if (e.key === 'Enter' && !onBtn) { e.preventDefault(); simSayChips(); simKeep(); return; }
    else if (e.key === 'Backspace') { e.preventDefault(); SIM.f = null; SIM.v = null; simBuild(); simKeep(); return; }
    if (k === 'R' && CMV.supported) { e.preventDefault(); simAsk(null, false); }
    else if (k === 'S' && CMV.supported) { e.preventDefault(); simAsk(null, true); }
    else if (k === 'T' && CMV.supported) { e.preventDefault(); SIM.script = !SIM.script; simBuild(); simKeep(); }
    else if (k === 'M' && SRC) { e.preventDefault(); simMic(); }
    else if (k === 'N') { e.preventDefault(); simNew(); SIM.started = true; simBuild(); simAsk(); simKeep(); }
  });
  simNew(); SIM.started = false; simBuild();
}

/* =========================================================
   11. 교환학생 표현 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 숫자는 15든 fifteen이든 같은 숫자로 맞춰요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = CM.PLACES.map(p => ({ p, rows: CM.SHADOW.map((s, i) => [s, i]).filter(([s]) => s.place === p.id) })).filter(g => g.rows.length);
  $('shList').innerHTML = groups.map(({ p, rows }) => `<section class="sh-grp"><h3>${PI(p.id)}${esc(p.ko)} <span lang="en">${esc(p.en)}</span></h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${CMV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-who ${s.who}">${s.who === 'me' ? '나' : esc(WHO[s.sp] || '직원')}</span><span class="sh-en" lang="en">${esc(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { const s = CM.SHADOW[i]; return [{ text: s.en, sp: s.sp }]; }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = CM.SHADOW[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, CM.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.words.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.t)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}${/Hale|Maple Hall|Cedar Hall|Birch Hall|\d/.test(s.en) && r.hit < r.total ? ' (이름 · 숫자는 음성 인식이 다르게 적기 쉬워요.)' : ''}</p>`);
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${CMV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
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
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (b) b.classList.remove('saying'); if (thenOrig && CMV.supported) speak(shSeq(i)); };
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
        CMS.shapeMark(g, sh, x, 92, 34);
        g.font = qfont(14, 700); g.fillStyle = QCOL.text; g.fillText(CM.SHAPE[sh].ko, x, 150);
        g.font = qfont(12, 500); g.fillStyle = QCOL.muted; g.fillText(CM.SHAPE[sh].mark, x, 172);
      });
    } };
}
// 대기 번호 넷 (A~D) — 대기표 모양
function numFig(label, nums) {
  const Wd = 600, H = 176, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: cellPick(Wd, 4, H, 4),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      nums.forEach((n, k) => {
        const x = k * cw + cw / 2;
        cellBox(g, st, k, k * cw + 8, 8, cw - 16, H - 16);
        qLetter(g, x, 30, k);
        g.font = qfont(11, 700, F.FM); g.fillStyle = QCOL.muted; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('WAITLIST NO.', x, 58);
        g.font = qfont(44, 800, F.FM); g.fillStyle = QCOL.text; g.fillText(String(n), x, 104);
        g.font = qfont(12.5, 600); g.fillStyle = QCOL.muted; g.fillText(CM.numWord(n), x, 146);
      });
    } };
}
// 새 마감 요일 넷 (A~D) — 위에 원래 마감(금요일 자정)
function dayFig(label, ids) {
  const Wd = 600, top = 62, H = 196, cw = Wd / 4;
  return { width: Wd, height: H, label, pick: cellPick(Wd, top, H, 4),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      rrq(g, 8, 8, Wd - 16, 42, 10); g.fillStyle = '#1C1608'; g.fill(); g.strokeStyle = 'rgba(255,193,94,0.45)'; g.lineWidth = 1.4; g.stroke();
      g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = qfont(11, 700, F.FM); g.fillStyle = QCOL.muted; g.fillText('ESSAY DUE', 22, 29);
      g.font = qfont(15, 800, F.FM); g.fillStyle = QCOL.p; g.fillText('FRI · MIDNIGHT', 100, 29);
      g.textAlign = 'right'; g.font = qfont(14, 700, F.FM); g.fillStyle = QCOL.text; g.fillText('NEW DEADLINE → ?', Wd - 22, 29);
      ids.forEach((id, k) => {
        const x = k * cw + cw / 2, day = CM.DUES[id].day;
        cellBox(g, st, k, k * cw + 8, top, cw - 16, H - top - 8);
        qLetter(g, x, top + 24, k);
        g.font = qfont(30, 800, F.FM); g.fillStyle = QCOL.text; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(day.slice(0, 3).toUpperCase(), x, top + 72);
        g.font = qfont(12, 600); g.fillStyle = QCOL.muted; g.fillText(day, x, top + 102);
      });
    } };
}
// 부탁 한 줄 넷 (2 × 2, A~D) — 줄은 칸 너비에 맞춰 접어요
function lineFig(label, lines) {
  const Wd = 600, cw = 300, ch = 130, H = ch * 2 + 8;
  const wrap = (g, t, w) => { const out = []; let cur = ''; t.split(' ').forEach(wd => { const nx = cur ? cur + ' ' + wd : wd; if (cur && g.measureText(nx).width > w) { out.push(cur); cur = wd; } else cur = nx; }); if (cur) out.push(cur); return out; };
  return { width: Wd, height: H, label,
    pick: (x, y) => x > 0 && x < Wd && y > 4 && y < H - 4 ? Math.min(1, Math.floor(y / ch)) * 2 + Math.min(1, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      lines.forEach((Lw, k) => {
        const x0 = (k % 2) * cw, y0 = Math.floor(k / 2) * ch + 4;
        cellBox(g, st, k, x0 + 6, y0 + 2, cw - 12, ch - 8);
        qLetter(g, x0 + 28, y0 + 26, k);
        g.font = qfont(14, 600); g.fillStyle = QCOL.text; g.textAlign = 'left'; g.textBaseline = 'middle';
        wrap(g, CM.lineText(Lw), cw - 66).slice(0, 5).forEach((t, r) => g.fillText(t, x0 + 48, y0 + 24 + r * 20));
      });
    } };
}
const QS = (() => {
  const o = CM.o, j = (q, a, c) => CM.judge(q, a, c || {}).ok;
  const need = [o('nd_apply', 245), o('nd_rhalf'), o('nd_reg', 245), o('g_yesp')];
  const full = [o('fl_ok'), o('fl_res'), o('fl_just'), o('fl_wait')];
  const WL = 14, NUMS = [14, 40, 4, 41], wlq = CM.simQ('fl_wl', { wl: WL });
  const ask = [o('qs_lit'), o('qs_oh'), o('g_yes'), o('qs_tell')];
  const ohq = CM.simQ('cl_oh', { oh: 'mw' }), oh = [o('oh_so', 'mw'), o('oh_so', 'mw~r'), o('oh_so', 'mw~d'), o('oh_ok')];
  const XC = { ask: 'ext', why: 'exams', days: 3 };
  const lines = [CM.L(['hale', 'exams', 'iwant', 'd3']), CM.L(['hale', 'exams', 'wibp', 'd3']), CM.L(['teacher', 'exams', 'wibp', 'd3']), CM.L(['hale', 'exams', 'wibp', 'rep'])];
  const DAYS4 = ['sat', 'sun', 'mon', 'tue'], dq = CM.simQ('ex_due', { due: 'mon' });
  const talk = [o('tl_yes'), o('tl_do'), o('wi_no'), o('tl_no')];
  const ent = [o('rp_rude'), o('en_do'), o('rp_wmain'), o('g_no')];
  const q = [
    { q: '수업 등록 창구 직원이 Hi there. What can I help you with? 하고 물어요. English 245(미국 단편소설)를 수강 신청하고 싶어요. 가장 알맞은 대답은?', opts: need.map(CM.text), a: 2,
      why: `용건은 부탁 틀로 → ${CM.text(need[2])} (A) apply는 입학 · 일자리에 지원할 때 써요(apply for a job). 수업은 register for예요. (B) 교환학생이라는 사실만 말해서 무엇을 하러 왔는지 알 수 없어요. (D) Yes, please.로는 정보 질문에 답이 안 돼요.`,
      check: () => need.map(a => j('reg_help', a, { course: 245 })).join() === 'false,false,true,false' },
    { q: '직원이 묻는 말: Would you like the morning section or the afternoon section? 이 질문의 모양은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: shapeFig('질문의 모양 넷. A Yes/No 질문(스위치), B 고르는 질문(갈림길), C 정보 질문(빈 상자), D 안내(말풍선)'),
      why: 'A or B? → 둘 가운데 하나를 고르라는 고르는 질문(갈림길)이에요. 고른 것 + please → The afternoon section, please. Yes, please.로는 무엇을 골랐는지 알 수 없어요.',
      check: () => CM.Q.reg_sec.shape === 'or' && !j('reg_sec', o('g_yesp'), { sec: 'afternoon' }) && j('reg_sec', o('sc_pl', 'afternoon'), { sec: 'afternoon' }) },
    { q: '직원 → Hmm, it looks like the morning section is full. 대기 명단에 이름을 올리고 싶어요. 가장 알맞은 대답은?', opts: full.map(CM.text), a: 3,
      why: '다 찼다는 안내에는 할 수 있는 방법을 질문으로 → Could you put me on the waitlist, please? (A) 알겠다고만 하면 수업을 들을 방법이 없어요. (B) reservation은 식당 · 호텔의 예약이에요. 자리가 나기를 기다리는 명단은 the waitlist예요. (C) 다 찬 반에 그냥 넣어 달라고 조르는 말이에요.',
      check: () => full.map(a => j('fl_full', a, { full: 'wait' })).join() === 'false,false,false,true' },
    { q: `직원 → ${wlq.en} 들은 대기 번호는? 번호를 누르거나 단추를 고르세요.`, opts: ['A', 'B', 'C', 'D'], a: 0,
      figure: numFig(`대기 번호 넷. A ${NUMS[0]}, B ${NUMS[1]}, C ${NUMS[2]}, D ${NUMS[3]}`, NUMS),
      why: `fourTEEN(뒤를 세게) → 14(A). FORty(앞을 세게)면 40(B)이에요. -teen과 -ty는 헷갈리기 쉬우니 되짚어 확인해요 → So, I'm number 14? 4(C) · 41(D)은 들은 말과 달라요.`,
      check: () => /\bnumber 14\b/.test(wlq.en) && CM.numWord(WL) === 'fourteen' && CM.teenSwap(WL) === NUMS[1] && j(wlq, o('wl_so', 14), {}) && !j(wlq, o('wl_so', 40), {}) },
    { q: '수업이 끝나고 헤일 교수가 Yes? Did you have a question? 하고 물어요. 면담 시간을 묻고 싶어요. 가장 알맞은 말은?', opts: ask.map(CM.text), a: 1,
      why: '물어볼 것은 Yes 뒤에 바로, 질문으로 → Yes. Could you tell me when your office hours are? (A) ‘선생님’을 Teacher로, ‘면담 시간’을 office time으로 옮겼어요. 교수님은 Professor Hale, 학생을 만나는 시간은 office hours예요. (C) Yes만 하면 무엇을 묻는지 몰라요. (D) 명령처럼 들려요.',
      check: () => ask.map(a => j('cl_q', a, {})).join() === 'false,true,false,false' },
    { q: `교수 → ${ohq.en} 되짚는 말로 가장 알맞은 것은?`, opts: oh.map(CM.text), a: 0,
      why: `들은 요일과 방 번호를 그대로 되짚어요 → So, Mondays and Wednesdays, in Room 416? (B) 416(four-sixTEEN)을 460(four-SIXty)으로 바꿨어요. (C) 요일 묶음이 달라요(월 · 수 → 수 · 금). (D) 고맙다고만 하면 찾아갈 요일과 곳을 제대로 들었는지 확인하지 못해요. 면담 시간과 방 번호는 지어낸 예시예요.`,
      check: () => oh.map(a => j(ohq, a, { oh: 'mw' })).join() === 'true,false,false,false' },
    { q: '면담 끝에 교수 → Is there anything else? 이번 주에 시험이 세 개 있었어요. 에세이 마감을 사흘 미루고 싶어요. 가장 알맞은 한 줄은? 상자를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: lineFig(`부탁 한 줄 넷. A ${CM.lineText(lines[0].line)} B ${CM.lineText(lines[1].line)} C ${CM.lineText(lines[2].line)} D ${CM.lineText(lines[3].line)}`, lines.map(x => x.line)),
      why: '부르는 말 → 까닭(사실) → 부탁 틀(질문) → 바라는 것 → (B). (A) I want …는 조르는 말처럼 들려요. 부탁은 질문으로(Would it be possible to get …?). (C) Teacher는 부르는 말로 쓰지 않아요 → Professor Hale. (D) ‘리포트’는 한국에서 쓰는 말이에요. 수업에 내는 글은 essay · paper, 마감을 미루는 것은 an extension이에요.',
      check: () => lines.map(a => j('ex_else', a, XC)).join() === 'false,true,false,false' },
    { q: `에세이 마감은 원래 금요일 자정이에요. 교수 → ${dq.en} 새 마감은 무슨 요일? 요일을 누르거나 단추를 고르세요.`, opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: dayFig('새 마감 요일 넷. A 토요일, B 일요일, C 월요일, D 화요일. 위에 원래 마감 금요일 자정', DAYS4),
      why: 'by Monday at midnight → 월요일 자정까지(C). 금요일에서 사흘을 미룬 날이에요. 요일은 되짚어 확인해요 → So, by Monday at midnight?',
      check: () => CM.dueOf(3) === DAYS4[2] && /by Monday at midnight/.test(dq.en) && j(dq, o('du_so', 'mon'), {}) && !j(dq, o('du_so', 'sun'), {}) },
    { q: 'RA → Have you talked to your roommate about it? 아직 룸메이트와 얘기해 보지 않았어요. 가장 알맞은 대답은?', opts: talk.map(CM.text), a: 3,
      why: 'Have you …? 질문에는 첫 낱말의 짝으로 → No, I haven\'t. 사실을 하나 더 붙이면 대화가 이어져요(I\'m not sure what to say.). (A) 얘기해 본 적이 없는데 있다고 했어요. (B) No, I don\'t.는 Do you …? 질문의 짝이에요. (C) RA가 함께 있어 주겠다는 말에 하는 대답이에요.',
      check: () => talk.map(a => j('ra_talk', a, { talked: false })).join() === 'false,false,false,true' },
    { q: '기숙사 사무실 직원 → Is it alright if maintenance goes in while you\'re out? maintenance가 무슨 뜻인지 모르겠어요. 가장 알맞은 말은?', opts: ent.map(CM.text), a: 2,
      why: '모르는 낱말은 짐작하지 말고 공손하게 물어요 → Sorry, what does maintenance mean? 직원이 쉬운 말로 알려 줄 거예요(건물의 시설을 고치는 직원). (A) What? 한 낱말은 퉁명스럽게 들려요. (B) Is it …? 질문에 Yes, I do.는 짝이 맞지 않아요. (D) 뜻을 모르는 채로 No만 하면 퉁명스럽고, 바라는 것도 알 수 없어요.',
      check: () => ent.map(a => j('dm_enter', a, {})).join() === 'false,false,true,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[교환학생 생활] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { if (x.a < 4) pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[교환학생 생활] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { CMV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = CMS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * CMS.W, (e.clientY - r.top) / r.height * CMS.H]; };
const hitAt = (x, y) => started ? CMS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.stop != null) { S.stop = S.stop === h.stop ? null : h.stop; relab(); }
  else if (h && h.play && CMV.supported) speak(h.play);
  else if (h && h.say && CMV.hasClip('tc', h.say)) speak([{ text: h.say, sp: 'tc' }]);   // 미리 만든 발음(음성 해설의 영어와 같은 목소리)
  else if (h && h.say && EN.say.supported) { stopSounds(); if (playing) pause(); EN.say(CM.spoken(h.say)); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.stop != null ? '눌러서 이곳의 말 보기' : h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { CMV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = CMV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 대화 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 글이 정해진 말만 모아요: 영상의 말풍선 · 발음 칩, 질문(CM.Q), 직접 해 보기(곳 · 3단계 · 과목 · 대기 번호 · 면담 시간 · 부탁 한 줄 · 고장 · 룸메이트는 하나씩 골라 봄),
// 듣고 대답 고르기, 따라 말하기. 교환학생 시뮬레이터(카드마다 바뀌는 말)와 내가 칩으로 만든 문장은 브라우저 음성이라 빼요.
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text || !/[A-Za-z]/.test(text) || /^\(.*\)$/.test(String(text).trim())) return;   // (지문)은 읽지 않음
    const id = CMV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: CMV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(CMS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 말풍선(그 사람) · 영어 칩(발음 듣기 tc). 곳(map) · 3단계(method) 장은 하나씩 골라 놓고 한 번 더
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return ch ? [ch.t, ch.t + ch.d] : null; };
    const sweeps = [[{}, [0, END]]].concat(CM.PLACES.map((_, k) => [{ stop: k }, span('map')]), CM.METHOD.map((_, k) => [{ place: k }, span('method')])).filter(x => x[1]);
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.25) {
        CMS.render(g, t);
        CMS.hits().forEach(h => { if (h.play) addSeq(h.play, 'video'); else if (h.say) add('tc', h.say, 'video-say'); });
      }
    });
    // 2) 직접 해 보기: 장마다 처음 화면 + 곳 · 3단계는 하나씩 골라서 (듣기 단추에 걸린 말)
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* 그리기만 하는 칸 */ } });
    CM.PLACES.forEach((_, k) => { S.stop = k; try { LABS.map(); } catch (e) { /* */ } });
    S.stop = null;
    CM.METHOD.forEach((_, k) => { S.place = k; try { LABS.method(); } catch (e) { /* */ } });
    S.place = null;
    const tryLab = (k, f) => { try { f(); LABS[k](); } catch (e) { (window.__labErrs = window.__labErrs || []).push(k + ": " + e.message); } };
    CM.COURSE_IDS.forEach(n => ['ok', 'swap', 'apply', 'half'].forEach(how => Object.keys(CM.SECTIONS).forEach(sec => tryLab('reg', () => { LAB.course = { n, how, sec }; }))));
    ['wait', 'other'].forEach(want => FULL_OPTS.forEach(([a]) => tryLab('full', () => { LAB.full = { want, a }; })));
    CM.WLS.forEach(n => ['so', 'swap', 'skip'].forEach(a => tryLab('full', () => { LAB.wl = { n, a }; })));
    ASK_OPTS.forEach(([a]) => tryLab('class', () => { LAB.ask = { a }; }));
    CM.OH_IDS.forEach(oh => ['ok', '~d', '~r', 'skip'].forEach(a => tryLab('class', () => { LAB.oh = { oh, a }; })));
    CM.SHAPE_QS.forEach(q => tryLab('hours', () => { LAB.shape = { q, pick: null, yes: true }; }));
    NEED_OPTS.forEach(([need]) => Object.keys(CM.TROUBLE).forEach(trouble => tryLab('hours', () => { LAB.help = { need, trouble }; })));
    // 부탁 한 줄: 모범 줄 · 조각 하나 빠짐 · 차례 바꿈 · 갈래마다 다른 조각으로 바꿔 끼움 (교수의 대답 CM.fixLine)
    CM.WHY_IDS.forEach(why => [2, 3].forEach(days => {
      const C = { why, days }, m = CM.lineWords(C);
      const vs = [m, [m[0], m[2], m[3], m[1]], [m[0], m[1], m[3], m[2]], m.slice(1).concat([m[0]])].concat(m.map(w => m.filter(v => v !== w)));
      lineChipsFor(C).forEach(gr => gr.ids.forEach(id => { const k = m.findIndex(w => CM.OW[w].c === gr.c); if (k >= 0 && m[k] !== id) vs.push(m.map((w, i) => i === k ? id : w)); }));
      vs.forEach(words => tryLab('ext', () => { LAB.line = { why, days, words: words.slice() }; }));
    }));
    CM.THING_IDS.concat(['boiler']).forEach(thing => FIX_OPTS.forEach(([how]) => tryLab('dorm', () => { LAB.fix = { thing, how }; })));
    AUX_SET.forEach((X, k) => X.a.forEach((_, a) => tryLab('dorm', () => { LAB.aux = { k, a }; })));
    CM.ISSUE_IDS.forEach(issue => ['ok', 'half'].forEach(how => [true, false].forEach(talked => [true, false].forEach(w => tryLab('ra', () => { LAB.card = { issue, how, talked, with: w }; })))));
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 듣고 대답 고르기 · 먼저 골라 보기: 상대의 말 + 보기 넷
  CM.DRILL.concat(Object.values(CM.MINI)).forEach(it => { const Q = it.Q || CM.Q[it.q]; if (Q) addSeq(staffSeq(Q), 'drill'); it.opts.forEach(op => add('me', CM.text(op), 'drill')); });
  // 4) 따라 말하기
  CM.SHADOW.forEach((s0, i) => addSeq(shSeq(i), 'shadow'));
  // 5) 질문 목록의 나머지(상대의 말)
  Object.values(CM.Q).forEach(q => addSeq(staffSeq(q), 'q'));
  return out;
};
simInit();
shInit();
CDrill($('drillRoot'), CM.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 모양 잡기 → 틀 + 내 정보 → 공손하게, 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 02 · 06 · 09장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '수업 등록부터 교수 면담 · 기숙사 · RA 상담까지 일곱 곳, 부탁은 질문으로 · 문제는 사실부터가 모두 익숙해졌네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(CMS.baseText()).then(() => { dirty = true; });
setTimeout(() => CMS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
