/* 듣기 ① 사진과 질의응답 — 플레이어, 직접 해 보기, 듣기 연습 문제, 놀이터(함정 감별사 · 동작·상태 고르기), 퀴즈, 영상 추출
 * 규칙과 문제는 grammar.js(LP), 그림은 scenes.js(LPS), 듣기 목소리는 voices.js(LPV)가 맡습니다.
 * 소리가 겹치지 않게: 듣기 문제를 읽기 전에는 발음 듣기 · 음성 해설을 멈추고 영상을 일시정지해요(LPV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const LP = window.LP, LPS = window.LPS, LPV = window.LPV, S = LPS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = LPS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const cv = $('cv'), ctx = cv.getContext('2d');
LP.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = LPS.fonts;
const FONT_SET = [[700, F.FD], [800, F.FD], [400, F.FB], [500, F.FB], [600, F.FB], [700, F.FB], [400, F.FM], [500, F.FM]];
const loadFonts = text => Promise.race([
  Promise.all(FONT_SET.map(([w, f]) => document.fonts.load(`${w} 20px ${f}`, text).catch(() => null))),
  new Promise(r => setTimeout(r, 15000)),
]).then(() => document.fonts.ready);

/* =========================================================
   2. 영상 추출 — 사이트 공통 렌더러가 쓰는 약속
   ========================================================= */
if (EXPORT) {
  cv.width = 1920; cv.height = 1080;
  const ready = new Promise(res => LPS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '첫 단어를 잡고, 들린 단어를 의심하라 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { LPS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
// 듣기 단추 아이콘 (T16과 같은 모양)
const ICO = {
  play: '<svg data-k="play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>',
  stop: '<svg data-k="stop" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  slow: '<svg data-k="slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 3h5"/></svg>',
  script: '<svg data-k="script" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>',
};
// 듣기 · 천천히 · 대본 보기 단추 묶음 (T16 듣기 튜토리얼과 같은 모양 · 같은 키 R · S · T). 읽는 동안 누른 단추는 ‘멈추기’로 바뀜
const lsnBar = scriptOn => LPV.supported
  ? `<div class="lsn"><button type="button" class="lbtn say" data-act="play" aria-pressed="false">${ICO.play}<span>듣기</span><small>R</small></button><button type="button" class="lbtn say" data-act="slowplay" aria-pressed="false">${ICO.slow}<span>천천히</span><small>S</small></button>${scriptOn == null ? '' : `<button type="button" class="lbtn tog" data-act="script" aria-pressed="${!!scriptOn}">${ICO.script}<span>대본 보기</span><small>T</small></button>`}<span class="ldr-now" aria-live="polite"></span></div>`
  : '<p class="ldr-nosay">이 브라우저는 영어 음성을 쓸 수 없어 문장을 글로 보여 줘요.</p>';
function paintPlay(box, mode) {   // mode: null | 'play' | 'slowplay'
  box.querySelectorAll('.lbtn.say').forEach(b => {
    const on = mode === b.dataset.act, k = on ? 'stop' : b.dataset.act === 'slowplay' ? 'slow' : 'play';
    b.setAttribute('aria-pressed', String(on));
    const lab = b.querySelector('span'); if (lab) lab.textContent = on ? '멈추기' : b.dataset.act === 'slowplay' ? '천천히' : '듣기';
    const ic = b.querySelector('svg'); if (ic && ic.dataset.k !== k) ic.outerHTML = ICO[k];
  });
}
// 읽는 줄 표시 (T16의 줄 표시와 같은 색)
function paintNow(box, sel) { box.querySelectorAll('.now').forEach(x => x.classList.remove('now')); if (sel) { const el = box.querySelector(sel); if (el) el.classList.add('now'); } }
const SVG_WAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4"/></svg>';
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
  const cap = started ? LPS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 그 사람의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = LPS.chapterAt(T);
  if (ci !== lastChap) { lastChap = ci; document.querySelectorAll('.chap').forEach((b, i) => b.setAttribute('aria-current', String(i === ci))); buildLab(ci); }
}
function play() {
  if (T >= END - 0.01) T = 0;
  EN.say.stop(); LPV.stop();
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
  if (dirty) { dirty = false; LPS.render(ctx, started ? T : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
function touch() { if (playing) pause(); dirty = true; }

/* =========================================================
   4. 듣기 — 말하는 사람의 목소리로 읽기 (voices.js). 읽기 전에 다른 소리는 모두 멈춤
   ========================================================= */
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return LPV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름
const lpBtn = (seq, label, cls = '') => LPV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${SVG_PLAY}</button>` : '';
const slowBtn = on => LPV.supported ? `<button type="button" class="lbtn tog lp-slow" data-act="slow" aria-pressed="${on}" title="이 칸의 듣기 단추를 천천히 읽기">${ICO.slow}<span>천천히</span></button>` : '';
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-lp]');
  if (!b) return;
  const box = b.closest('[data-slow]'), slow = !!box && box.getAttribute('data-slow') === '1';
  document.querySelectorAll('.lp-play.saying').forEach(x => x.classList.remove('saying'));
  b.classList.add('saying');
  speak(SEQS[+b.dataset.lp], { slow, onend() { b.classList.remove('saying'); } });
});
// ‘천천히’ 단추 (직접 해 보기 · 놀이터): 상자의 data-slow를 바꿈
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.lp-slow');
  if (!b || b.closest('.ldr')) return;
  const box = b.closest('[data-slow]'); if (!box) return;
  const on = box.getAttribute('data-slow') !== '1';
  box.setAttribute('data-slow', on ? '1' : '0'); b.setAttribute('aria-pressed', String(on));
});

/* =========================================================
   5. 듣기 연습 문제 (이 튜토리얼 전용) — 소리 먼저, 글은 답한 뒤에
   생김새와 키보드는 공통 부품 EN.drill과 같게: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · Enter/→ 다음
   ========================================================= */
// 글 가리기: marks에 든 낱말만 보이고 나머지는 막대. reveal이면 모두 보임
function lineHTML(text, marks, reveal) {
  const R = [];
  marks.forEach(m => {
    if (m.whole) { R.push({ s: 0, e: text.length, role: m.role }); return; }
    const i = text.indexOf(m.t); if (i >= 0) R.push({ s: i, e: i + m.t.length, role: m.role });
  });
  const roleAt = (s, e) => { const hit = R.filter(r => s < r.e && e > r.s && !(r.s === 0 && r.e === text.length && R.length > 1)); const any = R.filter(r => s < r.e && e > r.s); return (hit[0] || any[0] || {}).role; };
  // 낱말마다 역할을 정하고, 이웃한 같은 역할은 한 덩어리로 칠함 (띄어쓰기까지)
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
const seqItem = it => it.part === 1
  ? it.opts.map((o, k) => ({ text: `${L4[k]}. ${o.t}`, sp: it.sp, gap: k ? 1.1 : 0.05 }))
  : [{ text: it.q, sp: it.sp[0] }].concat(it.opts.map((o, k) => ({ text: `${L4[k]}. ${o.t}`, sp: it.sp[1], gap: k ? 0.95 : 1.3 })));
function drawPhotoCanvas(c, id, o) {
  const r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), w = Math.max(1, Math.round((r.width || 416) * d));
  c.width = w; c.height = Math.round(w * 316 / 416);
  const g = c.getContext('2d'); g.setTransform(w / 416, 0, 0, w / 416, 0, 0); g.clearRect(0, 0, 416, 316);
  LPS.photo(g, id, 8, 8, 400, 300, o || {});
}
function missingOf(it) {
  const P = LP.PHOTO[it.photo], here = P.people.concat(P.things), out = [];
  it.opts.forEach(o => (o.obj || []).forEach(ob => { if (!here.includes(ob) && !out.includes(ob)) out.push(ob); }));
  if (!P.people.length && it.opts.some(o => o.form === 'beingpp' || LP.PERSON.includes(o.who))) out.push('person');
  return out;
}
function LDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0, script: false }));
  let cur = 0, retry = null, mode = null, slowLast = false;
  const compact = !!cfg.compact, hear = LPV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  // only: 한 줄만 (Part 2는 0 = 질문). slowFlag: 천천히. toggle: 같은 단추를 다시 누르면 멈춤
  function playAll(only, slowFlag, toggle) {
    const act = slowFlag ? 'slowplay' : 'play';
    if (toggle && only == null && mode === act && LPV.busy()) { LPV.stop(); return; }
    const it = items[cur], seq = seqItem(it), list = only == null ? seq : [seq[only]];
    slowLast = !!slowFlag;
    const say = (t) => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(list, { slow: !!slowFlag, onitem(i) {
      const k = only == null ? i : only, line = it.part === 1 ? k : k - 1;
      paintNow(root, line < 0 ? '.ldr-q' : `.ldr-row[data-k="${line}"]`);
      say(line < 0 ? '질문을 읽는 중' : `(${L4[line]}) 읽는 중`);
    }, onend(stopped) {
      mode = null; paintPlay(root, null); paintNow(root, null);
      say(stopped ? '' : '다 들었어요. 답을 고르세요.');
    } });
    mode = only == null ? act : null; paintPlay(root, mode);
  }
  function go(i, auto) { LPV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playAll(); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; LPV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    LPV.stop();
    s.pick = k; s.hints = 3; render();
    const f = root.querySelector('.edr-next'); if (f) f.focus({ preventScroll: true });
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = LP.steps(it), n = it.opts.length;
    const marks = []; steps.slice(0, done ? 3 : s.hints).forEach(x => marks.push(...x.marks));
    const reveal = done || !hear || s.script;
    const mk = at => marks.filter(m => m.at === at);
    const o = order(), pos = o.indexOf(cur);
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span>${compact ? `Part ${it.part} · 듣기 문제` : retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `Part ${it.part} · 문제 ${cur + 1} / ${items.length}`}</span>${done && it.tag ? `<span class="edr-tag">${esc(it.tag)}${it.type ? ` · 유형 ${it.type}` : ''}</span>` : ''}</p>`;
    if (it.part === 1) h += `<canvas class="ldr-photo" role="img" aria-label="사진: ${esc(LP.PHOTO[it.photo].ko)}"></canvas>`;
    else h += `<p class="ldr-sheet">${compact ? '' : `${cur + 1}. `}Mark your answer on your answer sheet.</p>`;
    h += lsnBar(done ? null : s.script);
    if (it.part === 2) h += `<p class="ldr-q"><b>Q</b>${hear ? `<button type="button" class="lp-play lp-mini" data-line="-1" aria-label="질문 다시 듣기" title="질문 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(it.q, mk('q'), reveal)}</span></p>`;
    h += `<div class="ldr-opts" role="group" aria-label="보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
      return `<div class="ldr-row${cls}" data-k="${k}">${hear ? `<button type="button" class="lp-play lp-mini" data-line="${k}" aria-label="(${L4[k]}) 다시 듣기" title="(${L4[k]}) 다시 듣기">${SVG_PLAY}</button>` : ''}<button type="button" class="ldr-opt" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L4[k]})</b> <span class="ldr-t" lang="en">${lineHTML(op.t, mk(k), reveal)}</span></button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: ${n === 4 ? 'A~D' : 'A~C'} 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히 · T 대본' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + LP.notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      const lines = it.part === 1 ? it.opts.map((op, k) => [`(${L4[k]}) ${op.t}`, op.ko, [{ text: op.t, sp: it.sp }]])
        : [[`Q ${it.q}`, it.qko, [{ text: it.q, sp: it.sp[0] }]]].concat(it.opts.map((op, k) => [`(${L4[k]}) ${op.t}`, op.ko, [{ text: op.t, sp: it.sp[1] }]]));
      h += '<ul class="ldr-ko">' + lines.map(([en, ko, seq]) => `<li>${lpBtn(seq, '듣기: ' + en)}<span><span lang="en">${esc(en)}</span><small>${esc(ko)}</small></span></li>`).join('') + '</ul>';
      if (!compact) h += `<div class="edr-acts"><button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button></div>`;
    }
    h += '</div>';
    root.innerHTML = h;
    paintPlay(root, mode);
    const c = root.querySelector('canvas.ldr-photo');
    if (c) drawPhotoCanvas(c, it.photo, { ring: s.hints >= 1 || done, ghost: s.hints >= 3 || done ? missingOf(it) : [] });
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !root.contains(b) || b.hasAttribute('data-lp')) return;
    if (b.dataset.go) { retry = null; go(+b.dataset.go, false); return; }
    if (b.dataset.pick) { answer(+b.dataset.pick); return; }
    if (b.dataset.line != null) { const k = +b.dataset.line; playAll(items[cur].part === 1 ? k : k + 1, slowLast); return; }
    const act = b.dataset.act;
    if (act === 'play') playAll(null, false, true);
    else if (act === 'slowplay') playAll(null, true, true);
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
    else if (k === 'R' && hear) { e.preventDefault(); playAll(null, false); }
    else if (k === 'S' && hear) { e.preventDefault(); playAll(null, true); }
    else if (k === 'T' && hear && st[cur].pick === null) { e.preventDefault(); st[cur].script = !st[cur].script; render(); }
    else if (!compact && (e.key === 'ArrowRight' || e.key === 'Enter') && st[cur].pick !== null && !(e.target.closest && e.target.closest('button:not(.edr-next)'))) { e.preventDefault(); next(); }
  });
  render();
  return { go, render, state: () => st };
}

/* =========================================================
   6. 장면별 '직접 해 보기' — 장이 바뀔 때만 다시 만듦
   ========================================================= */
const seg = (name, items, cur, attr) => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${esc(t)}</button>`).join('')}</div>`;
let labSlow = false;
// slow: 이 패널에 듣기 단추(O/X · 소리 짝 · 질문)가 있으면 ‘천천히’ 단추를 둠 (짧은 듣기 문제는 자기 단추가 있음)
const labHead = (h3, slow) => `<h2>직접 해 보기</h2><div class="lab-top"><h3>${esc(h3)}</h3>${slow ? slowBtn(labSlow) : ''}</div>`;
// O/X 목록: Part 1은 [사진, 문장], Part 2는 [문제, 대답 번호]. 여러 개가 맞을 수 있어요
const OX = {};
function oxList(name, rows) {
  OX[name] = rows;
  return `<ol class="ox">${rows.map((r, i) => {
    const t = r.p1 ? r.st.t : r.it.opts[r.k].t, seq = r.p1 ? [{ text: t, sp: r.sp || 'us' }] : [{ text: t, sp: r.it.sp[1] }];
    return `<li data-ox="${name}" data-i="${i}">${lpBtn(seq, '듣기: ' + t)}<span class="ox-t" lang="en">${esc(t)}</span><span class="mo"><button type="button" data-yn="1">맞아요</button><button type="button" data-yn="0">아니에요</button></span><span class="mr" role="status"></span></li>`;
  }).join('')}</ol>`;
}
const qLine = it => `<p class="enline">${lpBtn([{ text: it.q, sp: it.sp[0] }], '질문 듣기')}<span lang="en">${esc(it.q)}</span></p><p class="note">${esc(it.qko)}</p>`;
const mini = key => `<div class="lmini" data-mini="${key}"></div>`;
const MINIS = { d7: () => LP.DRILL[7], first: () => LP.MINI.first, trap: () => LP.MINI.trap, stmt: () => Object.assign({ part: 2 }, LP.MINI.stmt), d15: () => LP.DRILL[15] };
Object.values(LP.MINI).forEach(m => { m.part = 2; });
const LABS = {
  intro: () => `${labHead('먼저 풀어 보세요')}${mini('d7')}
    <p class="note">질문과 대답 셋을 듣고 고르세요. 글은 답한 뒤에 보여요. 영상 10장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  people: () => {
    const id = S.jk === 'on' ? 'jacketOn' : 'jacketWear';
    return `${labHead('사진을 바꿔 보기', true)}
      ${seg('사진', [['', '영상대로'], ['on', '입는 중인 사진'], ['wear', '다 입은 사진']], S.jk || '', 'jk')}
      <p class="note">고른 사진(${S.jk === 'on' ? '입는 중' : '다 입은 뒤'})에 두 문장을 대어 봐요. 영상 화면에도 판정이 나와요.</p>
      ${oxList('jacket', LP.EX.jacket.map(st => ({ p1: true, st, ph: id, sp: 'gb' })))}
      <p class="note">한국어 ‘입고 있다’는 입는 중 · 입은 상태 둘 다예요. 영어는 is putting on(동작) · is wearing(상태)로 나눠요.</p>`;
  },
  things: () => {
    const id = S.ch === 'man' ? 'chairsMan' : 'chairsEmpty';
    return `${labHead('사람을 넣었다 빼 보기', true)}
      ${seg('사진', [['', '영상대로'], ['empty', '사람 없음'], ['man', '사람이 쌓는 중']], S.ch || '', 'ch')}
      ${oxList('chairs', LP.EX.chairs.map(st => ({ p1: true, st, ph: id, sp: 'au' })))}
      <p class="note">being + p.p. → 누가 지금 그 일을 하는 중. 사람이 없는 사진이면 거의 늘 오답이에요. has been p.p. → 이미 그렇게 된 상태.</p>`;
  },
  missing: () => `${labHead('복사기 사진과 맞춰 보기', true)}
    ${oxList('copier', LP.LAB.copier.map(st => ({ p1: true, st, ph: 'copier', sp: 'ca' })))}
    <h3 class="mt">비슷한 소리 짝 듣기</h3>
    <ul class="pairs">${LP.SOUNDS.map(([a, b]) => `<li>${lpBtn([{ text: a, sp: 'us' }, { text: b, sp: 'us', gap: 0.7 }], `${a}, ${b} 이어 듣기`)}<span class="en1" lang="en"><b class="v">${esc(a)}</b> ↔ <b class="v">${esc(b)}</b></span></li>`).join('')}</ul>`,
  first: () => `${labHead('첫 단어 바꿔 보기', true)}
    ${seg('질문', LP.WHSET.qs.map((q, i) => [i, q.first]), S.wh == null ? '' : S.wh, 'wh')}
    ${S.wh != null ? qLine(LP.WHSET.qs[S.wh]) : '<p class="note">첫 단어를 고르면 같은 대답 여섯 가운데 무엇이 맞는지 영상 화면에 표시돼요.</p>'}
    ${S.wh != null ? '<button class="btn ghost" type="button" id="labClear">영상대로 보기</button>' : ''}
    <h3 class="mt">짧은 듣기 문제</h3>${mini('first')}`,
  heard: () => `${labHead('함정 귀로 찾기')}${mini('trap')}
    <p class="note">질문의 낱말이 그대로(또는 비슷하게) 들리는 보기를 의심해 보세요.</p>`,
  indirect: () => `${labHead('대답이 되나요?', true)}${qLine(LP.LAB.budget)}
    ${oxList('budget', LP.LAB.budget.opts.map((o, k) => ({ it: LP.LAB.budget, k })))}
    <p class="note">여기서는 맞는 대답이 여럿이에요. 바로 답한 것 말고도 모른다 · 넘기기 · 되묻기 · 확인하기 · 상황 알리기가 모두 대화를 이어 가요.</p>`,
  notq: () => `${labHead('평서문에 답하기')}${mini('stmt')}
    <p class="note">Would you mind ~ing? → mind = 꺼리다. Not at all(전혀 안 꺼려요)이 ‘해 줄게요’라는 뜻이에요.</p>`,
  yesno: () => `${labHead('사실을 바꿔 보기', true)}
    ${seg('사실', [['', '영상대로'], ['did', '전화했다'], ['didnt', '안 했다']], S.yn || '', 'fact')}
    ${qLine(LP.LAB.client)}
    ${oxList('client', LP.LAB.client.opts.map((o, k) => ({ it: LP.LAB.client, k })))}
    <p class="note">한국어 ‘네 · 아니요’는 질문이 맞는지를, 영어 Yes · No는 사실이 그런지를 말해요.</p>`,
  method: () => {
    const F = S.first ? LP.FIRSTS.find(f => f.id === S.first) : null;
    return `${labHead('첫 단어 → 기대하는 답')}
      ${seg('첫 단어', LP.FIRSTS.map(f => [f.id, f.label]), S.first || '', 'first')}
      ${F ? `<p class="verdict"><b class="c-ok">${esc(LP.PT[F.it.pt].name)}</b> 기대하는 답: ${esc(LP.expect(F.it).map(k => LP.KIND[k]).join(' · '))}</p>
        <p class="note">언제나 될 수 있는 간접 응답: 모른다 · 넘기기 · 되묻기 · 확인하기 · 상황 알리기. ${esc(LP.wantKo(F.it))}</p>
        <button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>` : '<p class="note">첫 단어를 고르면 영상 화면의 Part 2 ①칸이 켜지고, 기대하는 답의 종류가 나와요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">듣기 연습 문제</a>로 가세요. Part 1 여섯 · Part 2 열, 모두 ${LP.DRILL.length}문제예요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터 ① 함정 감별사</a> — Part 2 대답에 함정 이름 붙이기</li><li><a href="#scene-game">놀이터 ② 동작 · 상태 고르기</a> — 사진의 순간을 바꿔 보기</li>
    <li><a href="#drill">듣기 연습 문제</a> — 토익 Part 1 · 2 형식 ${LP.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab');
  lab.innerHTML = LABS[CHAPTERS[ci].id]();
  lab.setAttribute('data-slow', labSlow ? '1' : '0');
  lab.querySelectorAll('.lmini').forEach(m => { const it = MINIS[m.dataset.mini](); LDrill(m, [it], { compact: true, onAnswer() { if (playing) pause(); } }); });
}
function showAt(u) { const ch = CHAPTERS[LPS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-lp') || b.closest('.lmini')) { if (playing && !b.hasAttribute('data-lp')) pause(); return; }
  if (b.classList.contains('lp-slow')) { labSlow = $('lab').getAttribute('data-slow') === '1'; return; }
  if (b.dataset.seek) { seek(CHAPTERS[LPS.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { S.wh = null; S.first = null; touch(); buildLab(LPS.chapterAt(T)); return; }
  if (b.dataset.yn != null) {
    const li = b.closest('li'), r = OX[li.dataset.ox][+li.dataset.i], j = r.p1 ? LP.judge1(r.st, r.ph) : LP.judge2(r.it, r.k);
    const said = b.dataset.yn === '1', right = said === (j.s === 'ok');
    li.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(right ? 'right' : 'wrong');
    const what = r.p1 ? (j.s === 'ok' ? '사진과 맞는 문장이에요.' : '사진과 맞지 않는 문장이에요.') : (j.s === 'ok' ? '대답이 되는 말이에요.' : '대답이 안 되는 말이에요.');
    li.querySelector('.mr').textContent = `${right ? '맞혔어요' : '다시 보세요'} — ${what} ${j.why}`;
    if (playing) pause();
    return;
  }
  if (b.dataset.jk != null) { S.jk = b.dataset.jk || null; showAt(24.8); }
  else if (b.dataset.ch != null) { S.ch = b.dataset.ch || null; showAt(19.8); }
  else if (b.dataset.wh != null) { S.wh = b.dataset.wh === '' ? null : +b.dataset.wh; showAt(18.4); }
  else if (b.dataset.fact != null) { S.yn = b.dataset.fact || null; showAt(18.6); }
  else if (b.dataset.first != null) { S.first = b.dataset.first || null; showAt(12); }
  else return;
  touch(); buildLab(LPS.chapterAt(T));
});

/* =========================================================
   7. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // Ms. Lee → Ms Lee: 마침표에서 영어 조각이 끊겨 'Ask Ms.' · 'Lee.' 두 번에 나눠 읽지 않게
  read: [[/\b(Mrs|Mr|Ms|Dr)\. (?=[A-Z])/g, '$1 '], [/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'], [/TOEIC/g, '토익'], [/Part 1/g, '파트 1'], [/Part 2/g, '파트 2'],
    [/A or B/g, '에이 오어 비'], [/p\.p\./g, '피피'], [/ = /g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
  clips: window.EN_CLIPS,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   8. 놀이터 ① — 함정 감별사 (Part 2 대답에 함정 이름 붙이기)
   ========================================================= */
const TG = { si: 0, tags: [null, null, null], checked: false, active: 0, script: false, mode: null, slowLast: false, stats: { tags: 0, ok: 0, sets: 0, right: 0 } };
const tagMatch = (g, k, t) => { const j = LP.judge2(g, k); return j.s === 'ok' ? LP.GOOD_TAG[t] === 1 : j.tags.includes(t); };
function tgPlay(only, slowFlag, toggle) {
  const act = slowFlag ? 'slowplay' : 'play', box = $('tg');
  if (toggle && only == null && TG.mode === act && LPV.busy()) { LPV.stop(); return; }
  const g = LP.GAME[TG.si], seq = [{ text: g.q, sp: g.sp[0] }].concat(g.opts.map((o, k) => ({ text: `${L4[k]}. ${o.t}`, sp: g.sp[1], gap: k ? 0.95 : 1.3 })));
  const list = only == null ? seq : [seq[only]];
  TG.slowLast = !!slowFlag;
  speak(list, { slow: !!slowFlag, onitem(i) {
    const k = only == null ? i : only;
    paintNow(box, k === 0 ? '.tg-q' : `.tg-row[data-k="${k - 1}"]`);
  }, onend() { TG.mode = null; paintPlay(box, null); paintNow(box, null); } });
  TG.mode = only == null ? act : null; paintPlay(box, TG.mode);
}
function tgBuild() {
  const g = LP.GAME[TG.si], done = TG.checked, hear = LPV.supported;
  $('tgSets').innerHTML = LP.GAME.map((x, i) => `<button type="button" data-set="${i}" aria-pressed="${i === TG.si}" aria-label="세트 ${i + 1}">${i + 1}</button>`).join('');
  const qMarks = done ? [{ t: g.first, role: 'key' }].concat(g.opts.flatMap(o => o.same ? [{ t: o.same[0], role: 'trap' }] : o.sound ? [{ t: o.sound[0], role: 'trap' }] : [])) : [];
  const show = done || !hear || TG.script;
  $('tgQ').innerHTML = `<b>Q</b>${hear ? `<button type="button" class="lp-play lp-mini" data-tgline="0" aria-label="질문 다시 듣기" title="질문 다시 듣기">${SVG_PLAY}</button>` : ''}<span class="ldr-t" lang="en">${lineHTML(g.q, qMarks, show)}</span>${done ? `<small>${esc(g.qko)}</small>` : ''}`;
  $('tgRows').innerHTML = g.opts.map((o, k) => {
    const j = LP.judge2(g, k), mine = TG.tags[k], ok = mine && tagMatch(g, k, mine);
    const om = done ? (o.same ? [{ t: o.same[1], role: 'trap' }] : o.sound ? [{ t: o.sound[1], role: 'trap' }] : j.s === 'ok' ? [{ t: o.t, role: 'ok', whole: true }] : []) : [];
    return `<div class="tg-row${TG.active === k && !done ? ' active' : ''}${done ? (ok ? ' good' : ' bad') : ''}" data-k="${k}">
      <div class="tg-line">${hear ? `<button type="button" class="lp-play lp-mini" data-tgline="${k + 1}" aria-label="(${L4[k]}) 다시 듣기" title="(${L4[k]}) 다시 듣기">${SVG_PLAY}</button>` : ''}<b class="tg-l">(${L4[k]})</b><span class="ldr-t" lang="en">${lineHTML(o.t, om, show)}</span></div>
      <div class="seg tg-tags" role="group" aria-label="(${L4[k]})의 이름표">${LP.TAGS.map((t, i) => `<button type="button" data-tag="${t}" data-k="${k}" aria-pressed="${mine === t}"${done ? ' disabled' : ''} class="${done && (j.s === 'ok' ? LP.GOOD_TAG[t] && j.tags.includes(t) : j.tags.includes(t)) ? 'eng' : ''}"><small>${i + 1}</small> ${esc(LP.TAG[t])}</button>`).join('')}</div>
      ${done ? `<p class="tg-why"><b class="${ok ? 'c-ok' : 'c-no'}">${ok ? '맞혔어요' : mine ? '엔진과 달라요' : '고르지 않았어요'}</b> 엔진: ${esc(j.tags.map(t => LP.TAG[t]).join(' + '))}${j.s === 'ok' ? ' (정답)' : ''} — ${esc(j.why)} <span class="ko">${esc(o.ko)}</span></p>` : ''}
    </div>`;
  }).join('');
  const all = TG.tags.every(Boolean);
  $('tgCheck').disabled = done || !all;
  $('tgCheck').textContent = done ? '맞춰 봤어요' : all ? '엔진과 맞춰 보기 (Enter)' : `이름표를 모두 붙여요 (${TG.tags.filter(Boolean).length} / 3)`;
  $('tgNext').hidden = !done;
  const s = TG.stats;
  $('tgScore').textContent = s.sets ? `이름표 ${s.ok} / ${s.tags} 맞힘 · 정답 고르기 ${s.right} / ${s.sets}세트` : '';
  const sb = $('tgBar').querySelector('[data-act="script"]'); if (sb) { sb.setAttribute('aria-pressed', String(show)); sb.disabled = done; }
}
function tgSet(i) { LPV.stop(); TG.si = (i + LP.GAME.length) % LP.GAME.length; TG.tags = [null, null, null]; TG.checked = false; TG.active = 0; TG.script = false; tgBuild(); tgKeep(); }
function tgTag(k, t) {
  if (TG.checked) return;
  TG.tags[k] = t; TG.active = TG.tags.findIndex(x => !x); if (TG.active < 0) TG.active = k;
  tgBuild(); tgKeep();
}
function tgCheck() {
  if (TG.checked || !TG.tags.every(Boolean)) return;
  const g = LP.GAME[TG.si];
  TG.checked = true;
  TG.stats.sets++; TG.stats.tags += 3;
  g.opts.forEach((o, k) => { if (tagMatch(g, k, TG.tags[k])) TG.stats.ok++; });
  const picked = TG.tags.map((t, k) => LP.GOOD_TAG[t] ? k : -1).filter(k => k >= 0);
  if (picked.length === 1 && picked[0] === g.a) TG.stats.right++;
  LPV.stop(); tgBuild();
  const n = $('tgNext'); if (n && !n.hidden) n.focus({ preventScroll: true });
}
function tgKeep() { if (!$('tg').contains(document.activeElement)) $('tg').focus({ preventScroll: true }); }
function tgInit() {
  $('tgBar').innerHTML = lsnBar(false);
  $('tg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.dataset.set != null) { tgSet(+b.dataset.set); return; }
    if (b.dataset.tag) { TG.active = +b.dataset.k; tgTag(+b.dataset.k, b.dataset.tag); return; }
    if (b.dataset.tgline != null) { tgPlay(+b.dataset.tgline, TG.slowLast); return; }
    if (b.dataset.act === 'play') { tgPlay(null, false, true); return; }
    if (b.dataset.act === 'slowplay') { tgPlay(null, true, true); return; }
    if (b.dataset.act === 'script') { TG.script = !TG.script; tgBuild(); return; }
    if (b.id === 'tgCheck') { tgCheck(); return; }
    if (b.id === 'tgNext') { tgSet(TG.si + 1); tgPlay(); return; }
  });
  $('tg').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), n = '123456'.indexOf(e.key), r = 'ABC'.indexOf(k);
    if (r >= 0 && !TG.checked) { e.preventDefault(); TG.active = r; tgBuild(); tgKeep(); }
    else if (n >= 0 && !TG.checked) { e.preventDefault(); tgTag(TG.active, LP.TAGS[n]); }
    else if (k === 'R' && LPV.supported) { e.preventDefault(); tgPlay(null, false); }
    else if (k === 'S' && LPV.supported) { e.preventDefault(); tgPlay(null, true); }
    else if (k === 'T' && LPV.supported && !TG.checked) { e.preventDefault(); TG.script = !TG.script; tgBuild(); }
    else if (e.key === 'Enter' && !TG.checked && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); tgCheck(); }
    else if (e.key === 'Enter' && TG.checked && !(e.target.closest && e.target.closest('button:not(#tgNext)'))) { e.preventDefault(); tgSet(TG.si + 1); tgPlay(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); tgSet(TG.si + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); tgSet(TG.si - 1); }
  });
  tgBuild();
}

/* =========================================================
   9. 놀이터 ② — 사진 속 동작 · 상태 고르기 (같은 장면, 다른 순간)
   ========================================================= */
const MS = { sc: 0, mo: 0, ans: {}, hide: LPV.supported, active: 0, mode: null, slowLast: false };
// 문장 넷을 차례로 (only: 한 줄만)
function msPlay(only, slowFlag, toggle) {
  const act = slowFlag ? 'slowplay' : 'play', box = $('ms');
  if (toggle && only == null && MS.mode === act && LPV.busy()) { LPV.stop(); return; }
  const sc = LP.SCENES[MS.sc], seq = sc.sts.map((st, i) => ({ text: st.t, sp: 'gb', gap: i ? 1.0 : 0.05 }));
  const list = only == null ? seq : [seq[only]];
  MS.slowLast = !!slowFlag;
  speak(list, { slow: !!slowFlag, onitem(i) { paintNow(box, `.ms-row[data-i="${only == null ? i : only}"]`); },
    onend() { MS.mode = null; paintPlay(box, null); paintNow(box, null); } });
  MS.mode = only == null ? act : null; paintPlay(box, MS.mode);
}
const msKey = (i) => `${MS.sc}:${MS.mo}:${i}`;
function msDraw() { const sc = LP.SCENES[MS.sc]; drawPhotoCanvas($('msStage'), sc.moments[MS.mo][0], { ring: true }); }
function msBuild() {
  const sc = LP.SCENES[MS.sc], ph = sc.moments[MS.mo][0], hear = LPV.supported;
  $('msScenes').innerHTML = LP.SCENES.map((s, i) => `<button type="button" data-sc="${i}" aria-pressed="${i === MS.sc}">${esc(s.name)}</button>`).join('');
  $('msMoments').innerHTML = sc.moments.map(([id, nm], i) => `<button type="button" data-mo="${i}" aria-pressed="${i === MS.mo}">${esc(nm)}</button>`).join('');
  const sb = $('msBar').querySelector('[data-act="script"]'); if (sb) sb.setAttribute('aria-pressed', String(!MS.hide));
  $('msRows').innerHTML = sc.sts.map((st, i) => {
    const a = MS.ans[msKey(i)], j = LP.judge1(st, ph), done = a != null, right = done && (a === (j.s === 'ok'));
    const P = LP.PHOTO[ph];
    const marks = done ? [{ t: st.subjT, role: j.step === 1 ? 'trap' : 'who' }, { t: st.vT, role: j.step === 2 ? 'trap' : LP.FORM[st.form].role }].concat((st.objT || []).map((t, q) => ({ t, role: P.people.concat(P.things).includes(st.obj[q]) ? 'obj' : 'trap' }))) : [];
    return `<li class="ms-row${MS.active === i ? ' active' : ''}${done ? (right ? ' good' : ' bad') : ''}" data-i="${i}">
      <div class="tg-line">${hear ? `<button type="button" class="lp-play lp-mini" data-msline="${i}" aria-label="문장 ${i + 1} 듣기" title="문장 ${i + 1} 듣기">${SVG_PLAY}</button>` : ''}<b class="tg-l">${i + 1}</b><span class="ldr-t" lang="en">${lineHTML(st.t, marks, done || !MS.hide || !hear)}</span></div>
      <span class="mo"><button type="button" data-ms="1" data-i="${i}"${done ? ' disabled' : ''} class="${done && a ? (right ? 'right' : 'wrong') : ''}">맞아요 <small>O</small></button><button type="button" data-ms="0" data-i="${i}"${done ? ' disabled' : ''} class="${done && !a ? (right ? 'right' : 'wrong') : ''}">아니에요 <small>X</small></button></span>
      ${done ? `<p class="tg-why"><b class="${right ? 'c-ok' : 'c-no'}">${right ? '맞혔어요' : '다시 보세요'}</b> ${j.s === 'ok' ? '사진과 맞아요.' : `${j.step}단계에서 탈락.`} ${esc(j.why)} <span class="ko">${esc(st.ko)}</span></p>` : ''}
    </li>`;
  }).join('');
  const keys = Object.keys(MS.ans), hits = keys.filter(k => { const [sc2, mo, i] = k.split(':').map(Number), sc3 = LP.SCENES[sc2]; return MS.ans[k] === (LP.judge1(sc3.sts[i], sc3.moments[mo][0]).s === 'ok'); }).length;
  $('msScore').textContent = keys.length ? `맞힌 판정 ${hits} / ${keys.length}` : '';
  $('msNow').textContent = `지금 사진: ${LP.PHOTO[ph].ko}`;
  msDraw();
}
function msAnswer(i, yes) { if (MS.ans[msKey(i)] != null) return; MS.ans[msKey(i)] = yes; MS.active = Math.min(LP.SCENES[MS.sc].sts.length - 1, i + 1); msBuild(); msKeep(); }
function msKeep() { if (!$('ms').contains(document.activeElement)) $('ms').focus({ preventScroll: true }); }
function msInit() {
  $('msBar').innerHTML = lsnBar(!MS.hide);
  $('ms').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.dataset.sc != null) { LPV.stop(); MS.sc = +b.dataset.sc; MS.mo = 0; MS.active = 0; msBuild(); return; }
    if (b.dataset.mo != null) { MS.mo = +b.dataset.mo; MS.active = 0; msBuild(); return; }
    if (b.dataset.ms != null) { msAnswer(+b.dataset.i, b.dataset.ms === '1'); return; }
    if (b.dataset.msline != null) { msPlay(+b.dataset.msline, MS.slowLast); return; }
    if (b.dataset.act === 'play') { msPlay(null, false, true); return; }
    if (b.dataset.act === 'slowplay') { msPlay(null, true, true); return; }
    if (b.dataset.act === 'script') { MS.hide = !MS.hide; msBuild(); return; }
    if (b.id === 'msReset') { Object.keys(MS.ans).filter(k => k.startsWith(`${MS.sc}:${MS.mo}:`)).forEach(k => delete MS.ans[k]); MS.active = 0; msBuild(); }
  });
  $('ms').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), n = '1234'.indexOf(e.key), sc = LP.SCENES[MS.sc];
    if (n >= 0) { e.preventDefault(); MS.active = n; msBuild(); msKeep(); msPlay(n, MS.slowLast); }
    else if (k === 'O') { e.preventDefault(); msAnswer(MS.active, true); }
    else if (k === 'X') { e.preventDefault(); msAnswer(MS.active, false); }
    else if (k === 'M') { e.preventDefault(); MS.mo = (MS.mo + 1) % sc.moments.length; MS.active = 0; msBuild(); msKeep(); }
    else if (k === 'T' && LPV.supported) { e.preventDefault(); MS.hide = !MS.hide; msBuild(); msKeep(); }
    else if (k === 'R' && LPV.supported) { e.preventDefault(); msPlay(null, false); }
    else if (k === 'S' && LPV.supported) { e.preventDefault(); msPlay(null, true); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); MS.sc = (MS.sc + (e.key === 'ArrowRight' ? 1 : -1) + LP.SCENES.length) % LP.SCENES.length; MS.mo = 0; MS.active = 0; msBuild(); msKeep(); }
  });
  new ResizeObserver(msDraw).observe($('msStage'));
  msBuild();
}

/* =========================================================
   10. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', p: '#FFC15E', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// 사진 네 장(A~D)을 누르는 그림 문제
function gridFig(label, ids) {
  const Wd = 600, H = 168, cw = Wd / 4;
  return {
    width: Wd, height: H, label,
    pick: (x, y) => y > 6 && y < H - 4 ? Math.min(3, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      for (let k = 0; k < 4; k++) {
        const x = k * cw, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, x + 5, 6, cw - 10, H - 12, 10); g.fillStyle = st.hover === k ? QCOL.hover : 'rgba(255,255,255,0.03)'; g.fill();
        if (on || wrong) { g.strokeStyle = on ? QCOL.p : QCOL.bad; g.lineWidth = 3; g.stroke(); }
        g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L4[k], x + cw / 2, 22);
        g.save(); LPS.photo(g, ids[k], x + 16, 40, cw - 32, (cw - 32) * 0.75); g.restore();
      }
    },
  };
}
// 사진 한 장 + 낱말 카드 네 장(A~D)
function cardFig(label, id, cards) {
  const Wd = 600, H = 250;
  return {
    width: Wd, height: H, label,
    pick: (x, y) => x > 330 && x < 594 ? Math.max(0, Math.min(3, Math.floor((y - 12) / 58))) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      g.save(); LPS.photo(g, id, 18, 22, 290, 217.5); g.restore();
      cards.forEach((c, k) => {
        const y = 14 + k * 58, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, 336, y, 252, 48, 10); g.fillStyle = st.hover === k ? QCOL.hover : 'rgba(255,255,255,0.05)'; g.fill();
        g.strokeStyle = on ? QCOL.p : wrong ? QCOL.bad : 'rgba(238,241,244,0.18)'; g.lineWidth = on || wrong ? 3 : 1.4; g.stroke();
        g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(L4[k], 352, y + 24);
        g.font = qfont(19, 600); g.fillStyle = QCOL.text; g.fillText(c, 378, y + 25);
      });
    },
  };
}
const QS = (() => {
  const j1 = (st, id) => LP.judge1(st, id).s === 'ok';
  const P2 = (q, pt, opts, extra = {}) => Object.assign({ q, pt, sp: ['us', 'gb'], opts }, extra);
  const R = (t, kind, o = {}) => Object.assign({ t, kind, ko: '' }, o);
  const contract = P2('Did you sign the contract?', 'yn', [R('Yes, this morning.', 'yes', { yn: 'yes', fact: true, factKo: '오늘 아침에 했어요' }), R('Not yet, but I will today.', 'no', { yn: 'no', fact: false, factKo: '아직 안 했어요' }), R('I\'m not sure. Ask Ms. Kim.', 'unknown', { note: '모른다 · 넘기기' }), R('Here\'s my contact number.', 'fact', { sound: ['contract', 'contact'] })], { first: 'Did you' });
  const proj = P2('Where\'s the projector?', 'wh', [R('Yes, it is.', 'yes'), R('At three o\'clock.', 'time'), R('Mr. Han borrowed it this morning.', 'news', { note: '어디 있는지 알 수 있는 상황을 알렸어요.' }), R('A new project.', 'thing', { sound: ['projector', 'project'] })], { wh: 'where', first: 'Where' });
  const taxi = P2('Why don\'t we take a taxi?', 'sugg', [R('Because it\'s raining.', 'reason'), R('Good idea. I\'ll call one.', 'accept'), R('Yes, I took it.', 'yes', { off: '택시를 타자는 제안에 ‘탔어요’는 앞뒤가 안 맞아요.' }), R('A tax form.', 'thing', { sound: ['taxi', 'tax'] })], { first: 'Why don\'t we' });
  const lock = P2('Didn\'t you lock the door?', 'neg', [R('Yes, I locked it.', 'yes', { yn: 'yes', fact: true, factKo: '잠갔어요' }), R('No, I locked it.', 'no', { yn: 'no', fact: true, factKo: '잠갔어요' }), R('No, not yet.', 'no', { yn: 'no', fact: false, factKo: '아직 안 잠갔어요' }), R('Yes, I haven\'t yet.', 'yes', { yn: 'yes', fact: false, factKo: '아직 안 잠갔어요' })], { first: 'Didn\'t you' });
  const okIdx = it => it.opts.map((_, k) => LP.judge2(it, k).s === 'ok');
  const q = [
    { q: '토익 Part 1 · Part 2의 문제지에 인쇄되어 있는 것은?', opts: ['보기 문장 넷과 대답 셋', '사진(Part 1)과 Mark your answer 한 줄(Part 2)', '질문만 인쇄되어 있어요', '정답의 해석'], a: 1,
      why: 'Part 1은 사진만, Part 2는 ‘Mark your answer on your answer sheet.’ 한 줄만 있어요. 문장과 대답은 한 번만 들려줘요. 그래서 들으면서 바로 지워야 해요.' },
    { q: '‘She is putting on a jacket.’ 이 문장과 맞는 사진은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: gridFig('사진 네 장. A 재킷을 다 입고 가방을 든 여자, B 책상에서 키보드를 치는 여자, C 재킷 한쪽 팔을 끼우는 여자, D 선반 위 상자에 손을 뻗는 여자', ['jacketWear', 'desk', 'jacketOn', 'shelfReach']),
      why: 'is putting on → 지금 입는 동작이에요. 재킷 한쪽 팔을 끼우는 C가 맞아요. A는 이미 다 입은 상태라서 is wearing으로 말해요.',
      check: () => ['jacketWear', 'desk', 'jacketOn', 'shelfReach'].map(id => j1(LP.EX.jacket[0], id)).join() === 'false,false,true,false' },
    { q: '재킷을 다 입고 가방을 든 채 서 있는 사진이에요. She ___ a jacket. 빈칸에 알맞은 말은?', opts: ['is wearing', 'is putting on', 'is taking off', 'is buying'], a: 0,
      why: '이미 다 입은 모습 → 상태, is wearing. is putting on은 입는 동작, is taking off는 벗는 동작이라 사진과 달라요.',
      check: () => j1(LP.EX.jacket[1], 'jacketWear') && !j1(LP.EX.jacket[0], 'jacketWear') },
    { q: '‘Some chairs are being stacked.’ 이 문장과 맞는 사진은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: gridFig('사진 네 장. A 사람 없는 방에 쌓인 의자, B 화분에 물을 주는 남자, C 벽을 따라 놓인 상자, D 의자를 들어 쌓는 남자', ['chairsEmpty', 'plantsMan', 'boxesEmpty', 'chairsMan']),
      why: 'being + p.p. → 누가 지금 쌓는 중이어야 해요. 남자가 의자를 쌓는 D만 맞아요. A처럼 사람이 없으면 Some chairs have been stacked.',
      check: () => ['chairsEmpty', 'plantsMan', 'boxesEmpty', 'chairsMan'].map(id => j1(LP.EX.chairs[1], id)).join() === 'false,false,false,true' },
    { q: '복사기 앞 남자 사진이에요. 사진 속에 있는 것은? 오른쪽 낱말 카드를 눌러도 돼요.', opts: ['some coffee', 'a lamp', 'some copies', 'a ladder'], a: 2,
      figure: cardFig('왼쪽에 복사기로 복사하는 남자 사진, 오른쪽에 낱말 카드 넷: A some coffee, B a lamp, C some copies, D a ladder', 'copier', ['some coffee', 'a lamp', 'some copies', 'a ladder']),
      why: '복사기에서 나온 종이 → copies가 있어요. coffee는 copies와 소리가 비슷한 함정, lamp · ladder는 사진에 없어요.',
      check: () => ['coffee', 'lamp', 'copies', 'ladder'].map(o => LP.PHOTO.copier.things.includes(o)).join() === 'false,false,true,false' },
    { q: 'When does the workshop begin? 이 질문에 알맞은 대답의 종류는?', opts: ['때 (또는 돌려 말하는 답)', '장소', 'Yes · No', '사람'], a: 0,
      why: '첫 단어 When → 때를 물어요. 장소 · 사람으로 답하면 엉뚱한 종류, 의문사 의문문이라 Yes · No 대답도 맞지 않아요. 단, I’m not sure 같은 간접 응답은 될 수 있어요.',
      check: () => LP.expect({ pt: 'wh', wh: 'when' }).join() === 'time' },
    { q: 'Did you sign the contract? 다음 대답 가운데 비슷한 소리 함정은?', opts: [contract.opts[0].t, contract.opts[1].t, contract.opts[2].t, contract.opts[3].t], a: 3,
      why: 'contract ↔ contact → 소리만 비슷하고 대답이 아니에요. 나머지는 Yes(했다) · Not yet(안 했다) · 모른다 · 넘기기로 모두 대화가 이어져요.',
      check: () => okIdx(contract).join() === 'true,true,true,false' && LP.judge2(contract, 3).tags.includes('sound') },
    { q: 'Where\'s the projector? 정답이 될 수 있는 대답은?', opts: proj.opts.map(o => o.t), a: 2,
      why: '한 씨가 빌려 갔다 → 어디 있는지 알 수 있게 상황을 알린 간접 응답이에요. Yes는 의문사 의문문에 맞지 않고, At three o’clock은 때, project는 projector와 소리가 비슷한 함정이에요.',
      check: () => okIdx(proj).join() === 'false,false,true,false' },
    { q: 'Why don\'t we take a taxi? 알맞은 대답은?', opts: taxi.opts.map(o => o.t), a: 1,
      why: 'Why don’t we ~? → 이유가 아니라 제안이에요. 좋다고 받아들인 B가 맞아요. Because는 까닭이라 엉뚱하고, tax는 taxi와 소리가 비슷한 함정이에요.',
      check: () => okIdx(taxi).join() === 'false,true,false,false' },
    { q: 'Didn\'t you lock the door? 문을 잠갔다면 알맞은 영어 대답은?', opts: lock.opts.map(o => o.t), a: 0,
      why: '영어 Yes → 했다, No → 안 했다. 잠갔으면 Yes, I locked it. 한국어로는 ‘아니요, 잠갔어요’라고 하지만, 영어로 No, I locked it은 앞뒤가 안 맞아요. No, not yet은 ‘안 잠갔다’는 뜻이에요.',
      check: () => lock.opts.map((o, k) => LP.judge2(lock, k).s === 'ok' && o.fact === true).join() === 'true,false,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[듣기 ①] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[듣기 ①] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
  return q;
})();

/* =========================================================
   대화 목소리 파일로 만들 줄 모으기 (개발용) — 글이 정해진 말만, 말하는 사람별로
   README의 ‘대화 목소리 파일 만들기’ → audio/dialogue/lines.json → tools/voicestudio-dialogue.py
   ========================================================= */
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!text || !/[A-Za-z]/.test(text)) return;
    const id = LPV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text, from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  // 1) 영상: 처음부터 끝까지 훑으며 들리는 말 줄. 직접 해 보기에서 바꾸는 상태(사진 · 첫 단어 · 사실)마다 그 장을 한 번 더
  const c = document.createElement('canvas'); c.width = 128; c.height = 72;
  const g = c.getContext('2d'), keep = JSON.stringify(S), base = { jk: null, ch: null, wh: null, yn: null, first: null };
  const span = id => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t, ch.t + ch.d]; };
  const sweeps = [[{}, [0, END]]].concat(
    ['on', 'wear'].map(v => [{ jk: v }, span('people')]), ['empty', 'man'].map(v => [{ ch: v }, span('things')]),
    LP.WHSET.qs.map((_, k) => [{ wh: k }, span('first')]), ['did', 'didnt'].map(v => [{ yn: v }, span('yesno')]),
    LP.FIRSTS.map(f => [{ first: f.id }, span('method')]));
  try {
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.1) { LPS.render(g, t); LPS.hits().forEach(h => { if (h.play) addSeq(h.play, 'video'); }); }
      // 2) 직접 해 보기: 장마다 패널을 만들면 듣기 단추의 줄이 SEQS에 모여요
      CHAPTERS.forEach(ch => { LABS[ch.id](); });
    });
  } finally { Object.assign(S, JSON.parse(keep)); dirty = true; }
  SEQS.forEach(seq => addSeq(seq, 'lab'));
  // 3) 듣기 연습 문제 · 직접 해 보기의 짧은 문제: 보기 넷(A. …) · 질문과 대답 셋, 답한 뒤 줄마다 다시 듣기(글자 없이)
  LP.DRILL.concat(Object.values(LP.MINI)).forEach(it => {
    addSeq(seqItem(it), 'drill');
    if (it.part === 1) it.opts.forEach(op => add(it.sp, op.t, 'drill'));
    else { add(it.sp[0], it.q, 'drill'); it.opts.forEach(op => add(it.sp[1], op.t, 'drill')); }
  });
  // 4) 놀이터 ① 함정 감별사 · ② 동작 · 상태 고르기
  LP.GAME.forEach(gm => { add(gm.sp[0], gm.q, 'game'); gm.opts.forEach((o, k) => add(gm.sp[1], `${L4[k]}. ${o.t}`, 'game')); });
  LP.SCENES.forEach(sc => sc.sts.forEach(st => add('gb', st.t, 'scene')));
  return out;
};

/* =========================================================
   11. 시작
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
$('ttsBtn').addEventListener('click', () => LPV.stop(), true);   // 음성 해설을 켜고 끌 때 듣기 문제 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = LPS.chapterAt(T);
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
// 화면 누르기: 들리는 말 줄을 누르면 그 사람 목소리로, 영어 낱말 칩을 누르면 발음 듣기, 빈 곳을 누르면 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * LPS.W, (e.clientY - r.top) / r.height * LPS.H]; };
const hitAt = (x, y) => started ? LPS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.play && LPV.supported) speak(h.play);
  else if (h && h.say && EN.say.supported) { LPV.stop(); if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? (h.play ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : '눌러서 발음 듣기: ' + h.say) : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 듣기 문제 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { LPV.stop(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = LPV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
tgInit();
msInit();
LDrill($('drillRoot'), LP.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 사진은 동작 · 상태로, 질문은 첫 단어로 — 3단계가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09 · 10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? 'Part 1 · 2의 함정을 모두 꿰뚫었네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(LPS.baseText()).then(() => { dirty = true; msDraw(); });
setTimeout(() => LPS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
