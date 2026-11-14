/* 올리고 내리기 — 억양과 초점: 플레이어, 직접 해 보기, 끝 올림 · 내림 듣기 훈련, 억양 바꾸기 실험실, 내 높낮이 선, 따라 말하기, 듣고 고르기, 퀴즈, 영상 추출
 * 문장의 모양 · 꺾이는 곳 · 초점은 grammar.js(IN), 그림은 scenes.js(INS), 목소리와 잰 값은 voices.js(INV)가 맡습니다.
 * 소리가 겹치지 않게: 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(INV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const IN = window.IN, INS = window.INS, INV = window.INV, S = INS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = INS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L3 = 'ABC';
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const median = a => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : 0; };
// 확인(받아쓰기 · 끝 올림 · 내림 · 고르는 질문의 앞 선택지 · 초점)을 통과한 목소리 — 통과하지 못한 파일은 훈련 · 실험실에 들려주지 않아요(잰 값이 하나도 없으면 모든 목소리)
const SPS = IN.VOICES.map(v => v.sp);
const okVoices = texts => INS.passVoices(texts);
const WHO = INS.WHO;
const cv = $('cv'), ctx = cv.getContext('2d');
IN.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = INS.fonts;
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
  const ready = new Promise(res => INS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '올리고 내리기 — 억양과 초점 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { INS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: INS.iconSVG('mic'),
  rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="currentColor"/></svg>',
};
// 듣기 · 천천히 단추 묶음 (회화 영역의 듣기 연습 문제와 같은 모양 · 같은 키 R · S)
const lsnBar = () => INV.supported
  ? `<div class="lsn"><button type="button" class="lbtn say" data-act="play" aria-pressed="false">${ICO.play}<span>듣기</span><small>R</small></button><button type="button" class="lbtn say" data-act="slowplay" aria-pressed="false">${ICO.slow}<span>천천히</span><small>S</small></button><span class="ldr-now" aria-live="polite"></span></div>`
  : '<p class="ldr-nosay">이 브라우저는 음성을 쓸 수 없어 문장을 글로 보여 줘요.</p>';
function paintPlay(box, mode) {
  box.querySelectorAll('.lbtn.say').forEach(b => {
    const on = mode === b.dataset.act, k = on ? 'stop' : b.dataset.act === 'slowplay' ? 'slow' : 'play';
    b.setAttribute('aria-pressed', String(on));
    const lab = b.querySelector('span'); if (lab) lab.textContent = on ? '멈추기' : b.dataset.act === 'slowplay' ? '천천히' : '듣기';
    const ic = b.querySelector('svg'); if (ic && ic.dataset.k !== k) ic.outerHTML = ICO[k];
  });
}
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
  const cap = started ? INS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 문장과 높낮이 선을 누르면 그 소리를 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = INS.chapterAt(T);
  if (ci !== lastChap) {
    // 장이 바뀌면 고른 문장 · 짝은 내려놓아요(목소리는 그대로) — 다음 장이 영상대로 흐르게
    if (lastChap >= 0) { S.sent = null; S.pair = null; dirty = true; }
    lastChap = ci; document.querySelectorAll('.chap').forEach((b, i) => b.setAttribute('aria-current', String(i === ci))); buildLab(ci);
  }
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
  if (dirty) { dirty = false; INS.render(ctx, started ? T : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
// 직접 해 보기에서 고르면: 영상을 멈추고 그 장의 u초 장면을 보여 줌
function showAt(u) {
  const ch = CHAPTERS[INS.chapterAt(T)];
  if (playing) pause();
  T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}

/* =========================================================
   4. 소리 — 목소리 넷 (voices.js). 읽기 전에 다른 소리는 모두 멈춤
   ========================================================= */
let audioEl = null;                       // 녹음 재생
function stopAudio() { if (audioEl) { try { audioEl.pause(); } catch (e) { /* 이미 멈춤 */ } audioEl = null; } document.querySelectorAll('.sh-play.saying').forEach(b => b.classList.remove('saying')); }
function stopSounds() { EN.say.stop(); INV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return INV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 같은 단추를 곧바로 다시 누르면 천천히
let lastLp = { b: null, at: 0 };
const lpBtn = (seq, label, cls = '', inner) => INV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${inner || SVG_PLAY}</button>` : '';
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-lp]');
  if (!b) return;
  const again = lastLp.b === b && performance.now() - lastLp.at < 4000;
  lastLp = { b, at: performance.now() };
  document.querySelectorAll('.lp-play.saying, .wbtn.saying').forEach(x => x.classList.remove('saying'));
  b.classList.add('saying');
  speak(SEQS[+b.dataset.lp], { slow: again, onend() { b.classList.remove('saying'); } });
});
const tSeq = (text, sp = 'tc') => [{ text, sp }];
const pairSeq = (a, b, sp = 'tc') => [{ text: a, sp }, { text: b, sp, gap: 0.8 }];

/* =========================================================
   5. 글 칠하기 — 꺾이는 음절은 노란 대문자(mark.nuc), 끝에 모양 화살표(.arw), 모양 이름표(.shp)
   높낮이 선(SVG)은 INS.pitchSVG — 잰 값이면 그 목소리를 잰 대로, 없으면 그림으로 줄인 모양(‘잰 값 아님’)
   ========================================================= */
const WORD_RE = /([A-Za-z]+(?:['’][A-Za-z]+)?)/;
function sHTML(text, o = {}) {
  const focus = o.focus === undefined ? IN.focusOf(text) : o.focus;
  const nuc = o.paint === false ? [] : IN.nuclei(text, { focus, shape: o.shape });
  let k = 0;
  const body = String(text).split(WORD_RE).map((p, j) => {
    if (j % 2 === 0) return esc(p);
    const i = k++;
    if (nuc.indexOf(i) < 0) return esc(p);
    const c = IN.capsW(p, p), m = c.match(/[A-Z]+/);
    if (!m) return `<mark class="nuc">${esc(c)}</mark>`;
    return `${esc(c.slice(0, m.index))}<mark class="nuc">${esc(m[0])}</mark>${esc(c.slice(m.index + m[0].length))}`;
  }).join('');
  const sh = o.shape || IN.shapeOf(text);
  return `<span class="sen" lang="en">${body}</span>${o.arrow === false ? '' : `<span class="arw s-${sh}" aria-hidden="true">${esc(IN.SHAPES[sh].arrow)}</span>`}`;
}
const shapeTag = text => { const sh = IN.shapeOf(text); return `<span class="shp s-${sh}">${esc(IN.SHAPES[sh].arrow)} ${esc(IN.SHAPES[sh].ko)}</span>`; };
// 문장 단추: 누르면 들려줌(곧바로 다시 누르면 천천히)
const wBtn = (text, sp = 'tc', o = {}) => INV.supported
  ? `<button type="button" class="wbtn${o.cls ? ' ' + o.cls : ''}" data-lp="${seqId(tSeq(text, sp))}" title="듣기: ${esc(text)}${sp !== 'tc' ? ' · ' + WHO[sp] : ''}">${SVG_PLAY}${o.html || sHTML(text, o)}</button>`
  : `<span class="wbtn off">${o.html || sHTML(text, o)}</span>`;
// 높낮이 선 하나
const fig = (text, o = {}) => INS.pitchSVG(text, Object.assign({ sp: o.sp || INS.bestSp(text) }, o));
// 그림으로만(한국어식 · 다른 뜻): 색을 바꿔 그려요
const schFig = (text, o, cls) => INS.pitchSVG(text, Object.assign({ sch: true }, o)).replace(/pl-line s-[a-z]+ sch/, `pl-line s-${cls} sch`);
// 같은 낱말 짝(. ↔ ?)을 겹쳐 그리기 — 둘 다 잰 값이면 같은 기준 높이(두 문장 울림의 가운데값)
function pairFig(a, b, sp, o = {}) {
  let A = INS.pitchData(a, { sp }), B = INS.pitchData(b, { sp });
  const both = A.measured && B.measured;
  if (both) { const ref = median(A.hz.concat(B.hz)); A = INS.pitchData(a, { sp, ref }); B = INS.pitchData(b, { sp, ref }); }
  else { A = INS.pitchData(a, { sp, sch: true }); B = INS.pitchData(b, { sp, sch: true }); }
  const cap = both ? `${WHO[sp]} 목소리를 잰 높낮이 · 두 선은 같은 기준 · 낱말 자리는 어림` : '그림으로 줄인 모양 · 잰 값 아님';
  return INS.pitchSVG(b, Object.assign({ data: B, text2: a, data2: A, caption: cap }, o));
}
const endNote = (text, sp) => { const P = INS.pitchData(text, { sp }); return P.measured ? INS.endText(P, text) : ''; };

/* =========================================================
   6. 듣고 고르기 (이 튜토리얼 전용, 회화 영역의 듣기 연습 문제와 같은 .edr 모양) — 소리 먼저, 글은 답한 뒤
   키보드: A · B · C 또는 1 · 2 · 3 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · Enter/→ 다음
   ========================================================= */
const KIND_KO = { end: '끝을 올렸나요, 내렸나요?', pair: '되묻는 쪽은 어느 소리?', shape: '어떤 질문인가요?' };
const SIT = {
  end: '문장 하나를 들려줘요. 마지막에서 소리가 위로 올라가며 끝났나요, 아래로 가라앉으며 끝났나요?',
  pair: '낱말이 똑같은 문장 둘을 차례로 들려줘요. 끝을 올려 되묻는 쪽은 첫째인가요, 둘째인가요?',
  shape: '질문 하나를 들려줘요. 첫 낱말과 끝의 움직임을 듣고, 어떤 질문인지 골라요.',
};
// 문제의 목소리가 확인을 통과하지 못했으면 통과한 목소리로
const spOf = q => { const texts = q.kind === 'pair' ? q.seq : [q.say], vs = okVoices(texts); return vs.includes(q.sp) ? q.sp : (vs[0] || q.sp); };
const qSeq = q => IN.drillSeq(q).map(x => Object.assign({}, x, { sp: spOf(q) }));
function PDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0 }));
  let cur = 0, retry = null, mode = null;
  const hear = INV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && INV.busy()) { INV.stop(); return; }
    const it = items[cur], seq = qSeq(it);
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(seq, { slow: !!slow, onitem(i) { say(it.kind === 'pair' ? `${i ? '둘째' : '첫째'} 소리 · 말하는 중` : `${WHO[spOf(it)]} · 말하는 중`); }, onend(stopped) { mode = null; paintPlay(root, null); say(stopped ? '' : '다 들었어요. 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { INV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; INV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    INV.stop();
    s.pick = k; s.hints = 3; render();
    const f = root.querySelector('.edr-next'); if (f) f.focus({ preventScroll: true });
  }
  function hint() { const s = st[cur]; if (s.pick !== null || s.hints >= 3) return; s.hints++; render(); }
  function dots() {
    return '<ol class="edr-dots" aria-label="문제 목록">' + items.map((it, i) => {
      const s = st[i], c = s.pick === null ? '' : s.pick === it.a ? ' ok' : ' no';
      return `<li><button type="button" data-go="${i}" class="${c}${i === cur ? ' cur' : ''}" aria-label="문제 ${i + 1}${s.pick === null ? '' : s.pick === it.a ? ' 정답' : ' 오답'}"${i === cur ? ' aria-current="step"' : ''}>${i + 1}</button></li>`;
    }).join('') + '</ol>';
  }
  // 보기마다 엔진의 까닭
  function notes(it) {
    const sp = spOf(it);
    if (it.kind === 'end') {
      const sh = IN.shapeOf(it.say), e = endNote(it.say, sp);
      const why = `${it.say} → ${IN.SHAPES[sh].ko} · ${IN.SHAPES[sh].long}${e ? ` (잰 ${e})` : ''}`;
      return it.opts.map((op, k) => k === it.a ? why : k === 0 ? '끝을 올리는 건 Yes/No 질문 · 되묻는 말이에요. 이 소리는 꺾이는 곳에서 내려갔어요.' : '끝을 내리는 건 평서문 · 정보 질문이에요. 이 소리는 꺾이는 곳에서부터 올라갔어요.');
    }
    if (it.kind === 'pair') return it.seq.map(t => { const sh = IN.shapeOf(t), e = endNote(t, sp); return `${t} → ${IN.SHAPES[sh].ko} · 끝 ${IN.SHAPES[sh].arrow}${e ? ` (잰 ${e})` : ''}${sh === 'decl' ? ' — 놀람 · 확인' : ' — 알려 주는 말'}`; });
    const sh = IN.shapeOf(it.say), keys = ['yn', 'wh', 'alt'];
    const wrong = { yn: 'Yes/No 질문이라면 조동사(do · is · can …)로 시작하고 끝을 올려요.', wh: '정보 질문이라면 의문사(what · where · how …)로 시작하고 끝을 내려요.', alt: '고르는 질문이라면 A or B 꼴이고, 앞 선택지에서 올렸다가 마지막에서 내려요.' };
    return it.opts.map((op, k) => keys[k] === sh ? `${it.say} → ${IN.caps(it.say)} · ${IN.SHAPES[sh].long}` : wrong[keys[k]]);
  }
  function optLab(it, op, k, done) {
    if (it.kind === 'end') return `<span class="ldr-t">${esc(op)}</span><small>${k ? '평서문 · 정보 질문' : 'Yes/No 질문 · 되묻는 말'}</small>`;
    if (it.kind === 'pair') return `<span class="ldr-t">${esc(op)}</span>${done ? `<small lang="en">${esc(it.seq[k])}</small>` : ''}`;
    return `<span class="ldr-t">${esc(op)}</span><small>${['예 · 아니오로 답해요', '정보로 답해요', '둘 중 하나를 골라요'][k]}</small>`;
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = IN.hints(it), sp = spOf(it);
    const o = order(), pos = o.indexOf(cur), reveal = done || !hear, n = it.opts.length;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${INS.iconSVG('ear', 'pi')}${esc(KIND_KO[it.kind])}</span><span>${retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span><span class="edr-tag">${esc(WHO[sp])}</span></p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(SIT[it.kind])}</p>`;
    h += lsnBar();
    if (reveal) {
      if (it.kind === 'pair') h += `<p class="ldr-q"><span class="ldr-t">${it.seq.map((t, k) => `<span class="kq">${k ? '둘째' : '첫째'} → ${sHTML(t, { paint: done, arrow: done })}</span>`).join('')}</span></p>`;
      else h += `<p class="ldr-q"><span class="ldr-t">${sHTML(it.say, { paint: done, arrow: done })}</span>${done ? `<small>${esc(IN.meaning(it.say))}</small>` : ''}</p>`;
    }
    h += `<div class="ldr-opts ${n === 3 ? 'three' : 'two'}" role="group" aria-label="보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
      return `<div class="ldr-row${cls}" data-k="${k}"><button type="button" class="ldr-opt big" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L3[k]})</b> ${optLab(it, op, k, done)}</button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: ${L3.slice(0, n).split('').join(' · ')} 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L3[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L3[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      let cmp;
      if (it.kind === 'pair') {
        const [a, b] = IN.shapeOf(it.seq[0]) === 'stmt' ? it.seq : [it.seq[1], it.seq[0]];
        cmp = `<span class="cmp-w">${pairFig(a, b, sp, { w: 300 })}</span><span class="cmp-w">${wBtn(it.seq[0], sp)}${wBtn(it.seq[1], sp)}${lpBtn(pairSeq(it.seq[0], it.seq[1], sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서</span>`)}</span>`;
      } else cmp = `<span class="cmp-w">${wBtn(it.say, sp)}${fig(it.say, { sp, w: 300 })}</span>`;
      h += `<div class="ldr-cmp"><span>높낮이 선 · ${esc(WHO[sp])}</span>${cmp}</div>`;
      h += `<div class="edr-acts"><button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button></div>`;
    }
    h += '</div>';
    root.innerHTML = h;
    paintPlay(root, mode);
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !root.contains(b) || b.hasAttribute('data-lp')) return;
    if (b.dataset.go) { retry = null; go(+b.dataset.go, false); return; }
    if (b.dataset.pick) { answer(+b.dataset.pick); return; }
    const act = b.dataset.act;
    if (act === 'play') playLine(false, true);
    else if (act === 'slowplay') playLine(true, true);
    else if (act === 'hint') hint();
    else if (act === 'next') next();
    else if (act === 'retry') { retry = items.map((_, i) => i).filter(i => st[i].pick !== items[i].a); retry.forEach(i => { st[i] = { pick: null, hints: 0 }; }); go(retry[0], true); }
    else if (act === 'reset') { retry = null; st = items.map(() => ({ pick: null, hints: 0 })); go(0, false); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || cur < 0) return;
    const k = e.key.toUpperCase(), n = items[cur].opts.length, i = L3.slice(0, n).indexOf(k), d = '123'.slice(0, n).indexOf(k);
    if (st[cur].pick === null && (i >= 0 || d >= 0) && k.length === 1) { e.preventDefault(); answer(i >= 0 ? i : d); }
    else if (k === 'H') { e.preventDefault(); hint(); }
    else if (k === 'R' && hear) { e.preventDefault(); playLine(false); }
    else if (k === 'S' && hear) { e.preventDefault(); playLine(true); }
    else if ((e.key === 'ArrowRight' || e.key === 'Enter') && st[cur].pick !== null && !(e.target.closest && e.target.closest('button:not(.edr-next)'))) { e.preventDefault(); next(); }
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
const clearBtn = '<button class="btn ghost" type="button" id="labClear">영상대로 보기</button>';
const pickRow = (list, cur, attr) => `<div class="wrow sel">${list.map(t => `<button type="button" class="pickw${cur === t ? ' on' : ''}" data-${attr}="${esc(t)}" aria-pressed="${cur === t}">${sHTML(t, { paint: false, arrow: false })}</button>`).join('')}</div>`;
// 고른 문장의 목소리: 고른 목소리가 통과했으면 그것, 아니면 통과한 첫 목소리 (영상의 bigTune과 같은 규칙)
const voiceFor = (texts, pref) => { const vs = okVoices(texts); return pref && vs.includes(pref) ? pref : texts.length === 1 ? INS.bestSp(texts[0]) : (vs[0] || 'tc'); };
const voiceSegFor = (texts, sp, attr = 'vsp') => { const vs = okVoices(texts); return vs.length ? row('목소리', seg('목소리 고르기', IN.VOICES.filter(v => vs.includes(v.sp)).map(v => [v.sp, v.ko]), sp, attr)) : '<p class="note">이 문장은 확인을 통과한 목소리가 없어 그림으로만 보여 줘요.</p>'; };
// 문장 고르기 칸 (지도 · 꺾이는 곳 · Yes/No · 정보 · 고르는 질문 · 초점)
function sentLab(h3, groups, hello, extra) {
  let h = labHead(h3) + groups.map(([lab, list]) => lab ? row(lab, pickRow(list, S.sent, 'st')) : pickRow(list, S.sent, 'st')).join('');
  const all = [].concat(...groups.map(g => g[1]));
  if (!S.sent || all.indexOf(S.sent) < 0) return h + `<p class="note">${hello}</p>`;
  const t = S.sent, sp = voiceFor([t], S.voice);
  h += voiceSegFor([t], sp);
  h += `<p class="enline">${wBtn(t, sp)} ${shapeTag(t)}</p><p class="note">${esc(IN.meaning(t))} · 꺾이는 곳 → <span lang="en">${esc(IN.caps(t))}</span></p>`;
  h += `<div class="figrow">${fig(t, { sp, w: 360 })}${extra ? extra(t, sp) : ''}</div>`;
  return h + clearBtn;
}
const LABS = {
  intro() {
    const [a, b] = IN.INTRO, sp = voiceFor([a, b]);
    return labHead('먼저 들어 보기') + `<p>낱말이 똑같은 두 문장이에요. 둘 다 눌러 들어 보고, 아래 선에서 끝의 높낮이를 견줘 보세요.</p>
      <div class="cmpballs">${[a, b].map(t => `<div class="cb s-${IN.shapeOf(t)}"><span>${esc(IN.SHAPES[IN.shapeOf(t)].ko)} · ${esc(IN.meaning(t))}</span>${wBtn(t, sp)}${fig(t, { sp, w: 280 })}</div>`).join('')}</div>
      <div class="wrow">${lpBtn(pairSeq(a, b, sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서 듣기</span>`)}</div>
      <p class="note">선은 목소리의 높낮이(반음)예요. 노란 칸이 꺾이는 곳, 가는 가로줄이 그 문장의 가운데 높이예요. 같은 단추를 곧바로 다시 누르면 천천히 들려줘요.</p>`;
  },
  listen() {
    const pairs = IN.DECL;
    let h = labHead('목소리 바꿔 듣기') + row('목소리', seg('목소리 고르기', IN.VOICES.map(v => [v.sp, v.ko]), S.voice || 'tc', 'vsp'));
    h += `<p class="note">고른 목소리로 영상의 짝을 다시 그려요. 짝마다 그 목소리가 확인을 통과하지 못했으면 통과한 다른 목소리로 들려줘요.</p>`;
    h += '<div class="pairs">' + pairs.map(([a, b]) => {
      const sp = voiceFor([a, b], S.voice || 'tc');
      return `<div class="pr">${lpBtn(pairSeq(a, b, sp), `${WHO[sp]}: ${a} · ${b}`, 'lp-voice', `${ICO.play}<span lang="en">${esc(a.slice(0, -1))} . · ?</span>`)}<small>${esc(WHO[sp])}</small>${pairFig(a, b, sp, { w: 300, h: 56 })}</div>`;
    }).join('') + '</div>';
    return h;
  },
  map() {
    return sentLab('억양의 지도 — 문장 고르기', IN.MAP.map(m => [`${IN.SHAPES[m.shape].arrow} ${IN.SHAPES[m.shape].ko}`, m.ex]),
      '문장을 고르면 영상이 멈추고 그 문장의 모양 · 꺾이는 곳 · 높낮이 선을 크게 보여 줘요.');
  },
  nucleus() {
    return sentLab('꺾이는 곳 — 문장 고르기', [['', IN.NUC]], '문장을 고르면 영상이 멈추고 꺾이는 곳(노란 글자)과 높낮이 선을 크게 보여 줘요. 꺾이는 곳 = 마지막 내용어의 센 음절이에요.');
  },
  yn() {
    return sentLab('Yes/No 질문 고르기', [['', IN.YN]], '문장을 고르면 영상이 멈추고 크게 보여 줘요. 꺾이는 곳에서부터 끝까지 올라가는지 보세요.');
  },
  wh() {
    return sentLab('정보 질문 고르기', [['', IN.WH]], '문장을 고르면 영상이 멈추고 크게 보여 줘요. 꺾이는 곳에서부터 끝까지 내려가는지 보세요.',
      t => schFig(t, { shape: 'yn', w: 300, caption: '끝을 올리면 → 되묻는 말처럼 들릴 수 있어요 (그림 · 잰 값 아님)' }, 'ko'));
  },
  alt() {
    return sentLab('고르는 질문 고르기', [['', IN.ALT]], '문장을 고르면 영상이 멈추고 크게 보여 줘요. 앞 선택지는 높고, 마지막 선택지에서 내려가는지 보세요.',
      t => schFig(t, { shape: 'yn', w: 300, caption: '끝까지 올리면 → 예 · 아니오로 답하는 Yes/No 질문 (그림 · 잰 값 아님)' }, 'yn'));
  },
  decl() {
    const i = S.pair;
    let h = labHead('짝 고르기 — 평서문 · 되묻는 말') + `<div class="wrow sel">${IN.DECL.map(([a], k) => `<button type="button" class="pickw${i === k ? ' on' : ''}" data-dp="${k}" aria-pressed="${i === k}"><span lang="en">${esc(a.slice(0, -1))}</span> <b>. · ?</b></button>`).join('')}</div>`;
    if (i == null) return h + '<p class="note">짝을 고르면 영상이 멈추고 두 선을 겹쳐 보여 줘요. 낱말은 같고 끝만 달라요.</p>';
    const [a, b] = IN.DECL[i], sp = voiceFor([a, b], S.voice);
    h += voiceSegFor([a, b], sp);
    h += `<div class="cmpballs">${[a, b].map(t => `<div class="cb s-${IN.shapeOf(t)}"><span>${esc(IN.SHAPES[IN.shapeOf(t)].ko)} · ${esc(IN.meaning(t))}</span>${wBtn(t, sp)}</div>`).join('')}</div>`;
    h += `<div class="figrow">${pairFig(a, b, sp, { w: 420 })}</div><div class="wrow">${lpBtn(pairSeq(a, b, sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서 듣기</span>`)}</div>`;
    return h + clearBtn;
  },
  focus() {
    return sentLab('초점 문장 고르기', [['', IN.FOCUS]], '문장을 고르면 영상이 멈추고 크게 보여 줘요. 고쳐 말하는 낱말이 가장 높이 솟고, 그 뒤는 낮게 눌리는지 보세요.');
  },
  summary() {
    return labHead('이제 직접') + '<p>아래 <a href="#playground">끝 올림 · 내림 듣기 훈련</a>에서 목소리 넷으로 끝의 방향을 가르고, <a href="#tswitch">억양 바꾸기 실험실</a>에서 하나만 바꾼 짝의 선이 어떻게 달라지는지 보고, <a href="#mypitch">내 높낮이 선</a>에서 내 끝을 재 보세요. <a href="#shadow">따라 말하기</a> 28문장과 <a href="#drill">듣고 고르기</a> 16문제도 있어요.</p>';
  },
};
function buildLab(ci) {
  const id = CHAPTERS[ci].id;
  $('lab').innerHTML = (LABS[id] || (() => ''))();
}
const relab = () => buildLab(INS.chapterAt(T));
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
  const d = b.dataset, id = CHAPTERS[INS.chapterAt(T)].id;
  if (b.id === 'labClear') { Object.assign(S, JSON.parse(INS.DEFAULTS)); dirty = true; relab(); return; }
  if (d.vsp != null) { S.voice = d.vsp === 'tc' ? null : d.vsp; showAt(id === 'listen' ? 12 : 8); relab(); return; }
  if (d.st != null) { S.sent = S.sent === d.st ? null : d.st; if (S.sent && S.voice && !okVoices([S.sent]).includes(S.voice)) S.voice = null; showAt(8); relab(); return; }
  if (d.dp != null) { S.pair = S.pair === +d.dp ? null : +d.dp; if (S.pair != null && S.voice && !okVoices(IN.DECL[S.pair]).includes(S.voice)) S.voice = null; showAt(8); relab(); }
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   대문자를 섞어 쓴 낱말(REAdy · TUESday)은 소문자로 읽고(글자 이름으로 읽지 않게), = · + 는 쉼으로, 화살표는 읽지 않아요
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\b([A-Za-z]*[A-Z]{2,}[A-Za-z]*)\b/g, m => m.toLowerCase()], [/Yes\/No/g, 'Yes No'], [/[↗↘]/g, ''], [/ = /g, ', '], [/\s\+\s/g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
  enRate: INV.EN_RATE,      // 영어 조각만 살짝 느리게 (voices.js의 EN_RATE — 문장 소리와 같은 빠르기)
  clips: window.EN_CLIPS,   // 미리 만든 음성 파일(audio/narration/) — 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };
if (window.EN && EN.say) EN.say.rate = INV.EN_RATE;   // 발음 듣기 단추도 같은 빠르기

/* =========================================================
   9. 음성 인식 · 녹음 (따라 말하기 · 내 높낮이 선)
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
function listenOnce({ onText, onFail, onState, alts: nAlt = 3 }) {
  stopSounds(); NARR.reset(); if (playing) pause(); stopListening();
  let rec;
  try { rec = new SRC(); } catch (e) { onFail('음성 인식을 시작하지 못했어요.'); return; }
  rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = nAlt; rec.continuous = false;
  let got = false, failed = false, timer = 0;
  rec.onresult = e => { got = true; const r = e.results[0], alts = []; for (let i = 0; i < r.length; i++) alts.push(r[i].transcript); onText(alts); };
  rec.onerror = e => { failed = true; if (e.error !== 'aborted') onFail(SR_ERR[e.error] || `음성 인식에 문제가 생겼어요 (${e.error}).`); };
  rec.onend = () => { clearTimeout(timer); if (activeRec === rec) activeRec = null; onState(false); if (!got && !failed) onFail(SR_ERR['no-speech']); };
  activeRec = rec; onState(true);
  try { rec.start(); } catch (e) { activeRec = null; onState(false); onFail('음성 인식을 시작하지 못했어요. 잠시 뒤 다시 눌러 보세요.'); return; }
  timer = setTimeout(() => { try { rec.stop(); } catch (e) { /* 이미 끝남 */ } }, 9000);
}
// 녹음 한 번 (ms 뒤 저절로 멈춤) → Blob
async function recordBlob(ms, onState) {
  stopSounds(); NARR.reset(); if (playing) pause(); stopListening();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mr = new MediaRecorder(stream), chunks = [];
  return new Promise(res => {
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); onState(false); res(chunks.length ? new Blob(chunks, { type: mr.mimeType || 'audio/webm' }) : null); };
    mr.start(); onState(true);
    setTimeout(() => { try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } }, ms);
  });
}
const recErr = e => e && e.name === 'NotAllowedError' ? '마이크를 쓸 수 없어요. 브라우저 설정에서 이 페이지의 마이크를 허락해 주세요.' : e && e.name === 'NotFoundError' ? '마이크를 찾지 못했어요. 마이크가 연결되어 있는지 확인해 주세요.' : '녹음을 시작하지 못했어요.';
function playUrl(url, btn, then) {
  stopSounds(); NARR.reset(); if (playing) pause();
  if (!url) return;
  const a = new Audio(url); audioEl = a;
  if (btn) btn.classList.add('saying');
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (btn) btn.classList.remove('saying'); if (then) then(); };
  a.play().catch(() => { audioEl = null; if (btn) btn.classList.remove('saying'); });
}
const pct = ([ok, n]) => n ? Math.round(ok / n * 100) : null;
const pctTxt = v => pct(v) == null ? '–' : pct(v) + '%';
const meterTd = v => `<td><span class="meter"><i style="width:${pct(v) || 0}%"></i></span>${pctTxt(v)}</td>`;

/* =========================================================
   10. 놀이터 ① 끝 올림 · 내림 듣기 훈련 — 문장 스물 × 목소리 넷(확인을 통과한 소리만): 끝을 올렸나 내렸나
   기록은 이 브라우저에만(localStorage 'en-in-tune-v1'). 키보드: R 듣기 · 1 올림 · 2 내림 · Space/Enter 다음
   ========================================================= */
const HV_KEY = 'en-in-tune-v1';
const HV_OPTS = [['up', '끝을 올렸어요 ↗', 'Yes/No 질문 · 되묻는 말'], ['down', '끝을 내렸어요 ↘', '평서문 · 정보 질문']];
const HV = { voice: 'all', cur: null, pick: null, stats: null, streak: 0, last: '' };
const hvPool = sp => IN.HV.filter(t => sp === 'all' ? okVoices([t]).length : okVoices([t]).includes(sp));
const hvEmpty = () => ({ kind: { up: [0, 0], down: [0, 0] }, voice: Object.fromEntries(SPS.map(sp => [sp, [0, 0]])), text: Object.fromEntries(IN.HV.map(t => [t, [0, 0]])) });
function hvLoad() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(HV_KEY) || 'null'); } catch (e) { s = null; }
  const base = hvEmpty();
  if (s && typeof s === 'object') Object.keys(base).forEach(g => Object.keys(base[g]).forEach(k => { const v = s[g] && s[g][k]; if (Array.isArray(v) && v.length === 2) base[g][k] = v.map(x => +x || 0); }));
  HV.stats = base;
}
function hvSave() { try { localStorage.setItem(HV_KEY, JSON.stringify(HV.stats)); } catch (e) { /* 저장하지 못해도 이번에는 계속 */ } }
function hvNew(auto) {
  const pool = hvPool(HV.voice).length ? hvPool(HV.voice) : IN.HV;
  let t;
  do { t = pickOne(pool); } while (pool.length > 1 && t === HV.last);
  const ok = okVoices([t]), sp = HV.voice === 'all' ? pickOne(ok.length ? ok : SPS) : HV.voice;
  HV.cur = { t, sp, kind: IN.endOf(t) }; HV.pick = null; HV.last = t;
  hvDraw();
  if (auto) hvPlay();
}
function hvPlay(slow) { if (!HV.cur) return; const b = $('hvPlayBtn'); if (b) b.classList.add('saying'); speak(tSeq(HV.cur.t, HV.cur.sp), { slow: !!slow, onend() { const x = $('hvPlayBtn'); if (x) x.classList.remove('saying'); } }); }
function hvAnswer(k) {
  const c = HV.cur; if (!c || HV.pick !== null) return;
  HV.pick = k;
  const ok = k === c.kind;
  [HV.stats.kind[c.kind], HV.stats.voice[c.sp], HV.stats.text[c.t]].forEach(v => { v[1]++; if (ok) v[0]++; });
  HV.streak = ok ? HV.streak + 1 : 0;
  hvSave(); hvDraw();
  const nb = $('hvNext'); if (nb) nb.focus({ preventScroll: true });
}
// 같은 낱말 짝(평서문 · 되묻는 말) — [평서문, 되묻는 말]
const declPair = t => IN.DECL.find(p => p.indexOf(t) >= 0) || null;
function hvDraw() {
  const c = HV.cur, box = $('hvMain');
  let h = '';
  if (!c) h = `<p class="hv-hello">목소리 넷 가운데 하나가 문장 하나를 말해요. 마지막에서 소리가 위로 올라가며 끝났는지, 아래로 가라앉으며 끝났는지 고르면 그 목소리를 잰 높낮이 선이 나타나요. 낱말보다 끝의 움직임에 귀를 모아 보세요.</p><div class="acts"><button type="button" class="btn" id="hvStart">${ICO.play} 시작하기</button></div>`;
  else {
    const done = HV.pick !== null, ok = done && HV.pick === c.kind;
    h += `<div class="hv-top"><button type="button" class="btn hv-play" id="hvPlayBtn">${ICO.play} 듣기 <small>R</small></button><button type="button" class="btn ghost" id="hvSlow">${ICO.slow} 천천히</button><span class="hv-who">${esc(WHO[c.sp])}</span></div>`;
    h += `<div class="hv-opts">${HV_OPTS.map(([k, name, sub], i) => `<button type="button" class="hv-opt k-${k}${done ? (k === c.kind ? ' right' : k === HV.pick ? ' wrong' : ' off') : ''}" data-hv="${k}"${done ? ' disabled' : ''}><b>${i + 1}</b><span>${esc(name)}</span><small>${esc(sub)}</small></button>`).join('')}</div>`;
    if (done) {
      const sh = IN.shapeOf(c.t), p = declPair(c.t), pv = p && okVoices(p).includes(c.sp), e = endNote(c.t, c.sp);
      h += `<p class="verdict"><b class="${ok ? 'c-ok' : 'c-no'}">${ok ? '맞아요' : '아쉬워요'}</b>들은 문장 → ${sHTML(c.t)} · ${esc(IN.meaning(c.t))}${HV.streak > 1 ? ` · 연속 ${HV.streak}번!` : ''}</p>`;
      h += `<p class="note">${shapeTag(c.t)} ${esc(IN.SHAPES[sh].long)}${e ? ` · 잰 ${esc(e)}` : ''}</p>`;
      h += `<div class="figrow">${pv ? pairFig(p[0], p[1], c.sp, { w: 340 }) : fig(c.t, { sp: c.sp, w: 340 })}</div>`;
      if (pv) h += `<div class="wrow">${wBtn(p[0], c.sp)}${wBtn(p[1], c.sp)}${lpBtn(pairSeq(p[0], p[1], c.sp), '짝을 이어서 듣기', 'lp-voice', `${ICO.play}<span>짝을 이어서</span>`)}</div>`;
      else h += `<div class="wrow">${wBtn(c.t, c.sp)}</div>`;
      h += `<div class="acts"><button type="button" class="btn" id="hvNext">다음 <small>Space</small></button></div>`;
    }
  }
  box.innerHTML = h;
  const st = HV.stats, all = Object.values(st.kind).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
  $('hvStats').innerHTML = `<table class="hv-tab"><caption>맞힌 비율 (이 브라우저에만 저장)</caption><tbody>${HV_OPTS.map(([k, name]) => `<tr><th scope="row" class="k-${k}">${esc(name)}</th><td>${st.kind[k][0]} / ${st.kind[k][1]}</td>${meterTd(st.kind[k])}</tr>`).join('')}${IN.VOICES.map(v => `<tr><th scope="row">${esc(v.ko)}</th><td>${st.voice[v.sp][0]} / ${st.voice[v.sp][1]}</td>${meterTd(st.voice[v.sp])}</tr>`).join('')}<tr class="all"><th scope="row">모두</th><td>${all[0]} / ${all[1]}</td><td>${pctTxt(all)}</td></tr></tbody></table>`;
}
function hvInit() {
  hvLoad();
  $('hvCtl').innerHTML = row('목소리', seg('목소리 고르기', [['all', '넷 섞어서']].concat(IN.VOICES.map(v => [v.sp, v.ko])), HV.voice, 'hvv'));
  hvDraw();
  const root = $('hvt');
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    const d = b.dataset;
    if (d.hvv) { HV.voice = d.hvv; root.querySelectorAll('[data-hvv]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hvNew(false); return; }
    if (b.id === 'hvStart' || b.id === 'hvNext') { hvNew(true); return; }
    if (b.id === 'hvPlayBtn') { hvPlay(false); return; }
    if (b.id === 'hvSlow') { hvPlay(true); return; }
    if (d.hv) { hvAnswer(d.hv); return; }
    if (b.id === 'hvReset') { HV.stats = hvEmpty(); HV.streak = 0; hvSave(); hvDraw(); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('select'))) return;
    const k = e.key.toUpperCase();
    if (k === 'R') { e.preventDefault(); if (!HV.cur) hvNew(true); else hvPlay(false); }
    else if ((k === '1' || k === '2') && HV.cur && HV.pick === null) { e.preventDefault(); hvAnswer(k === '1' ? 'up' : 'down'); }
    else if ((e.key === ' ' || e.key === 'Enter') && (HV.pick !== null || !HV.cur) && !(e.target.closest && e.target.closest('button:not(#hvNext):not(#hvStart)'))) { e.preventDefault(); hvNew(true); }
  });
}

/* =========================================================
   10. 놀이터 ② 억양 바꾸기 실험실 — 하나만 바꾼 짝(끝만 바꾸기 · 의문사 붙이기 · 하나 → 둘 중 하나)을
   A ↔ B로 바꾸며 모양 · 꺾이는 곳 · 높낮이 선이 어떻게 달라지는지 봐요. 목소리는 짝 둘이 모두 확인을 통과한 것만
   ========================================================= */
const SW = { set: IN.SWITCH[0].id, i: 0, side: 1, voice: 'tc' };
function swDraw() {
  const set = IN.switchSet(SW.set), pair = set.pairs[Math.min(SW.i, set.pairs.length - 1)], w = pair[SW.side];
  const vs = okVoices(pair), sp = vs.includes(SW.voice) ? SW.voice : (vs[0] || 'tc');
  let h = row('바꾸기', seg('무엇을 바꾸나', IN.SWITCH.map(s => [s.id, esc(s.ko)]), SW.set, 'sws'));
  h += row('짝', seg('짝 고르기', set.pairs.map((p, i) => [i, `<span lang="en">${esc(set.id === 'end' ? p[0].slice(0, -1) + ' . → ?' : p[1])}</span>`]), SW.i, 'swi'));
  h += row('목소리', vs.length ? seg('목소리 고르기', IN.VOICES.filter(v => vs.includes(v.sp)).map(v => [v.sp, v.ko]), sp, 'swv') : '<span class="note">이 짝은 확인을 통과한 목소리가 없어 그림으로만 보여 줘요.</span>');
  h += `<div class="sw-ab" role="group" aria-label="A · B 바꾸기">${pair.map((x, k) => `<button type="button" class="sw-side${SW.side === k ? ' on' : ''}" data-sw="${k}" aria-pressed="${SW.side === k}"><b>${'AB'[k]}</b><span>${sHTML(x)}</span></button>`).join('<span class="arr">↔</span>')}</div>`;
  h += `<p class="note sw-note">${esc(set.note)}</p>`;
  h += `<div class="sw-body"><div class="sw-word"><p class="mp-big">${sHTML(w)}</p><p>${shapeTag(w)} <span class="capsb">${esc(IN.meaning(w))}</span></p><div class="wrow">${wBtn(w, sp)}${lpBtn(pairSeq(pair[0], pair[1], sp), 'A · B 이어서 듣기', 'lp-pair', `${ICO.play}<span>A · B 이어서</span>`)}</div></div>`;
  h += `<div class="sw-fig">${set.id === 'end' ? pairFig(pair[0], pair[1], sp, { w: 360 }) : pair.map((x, k) => `<div class="sw-one${SW.side === k ? ' on' : ''}"><b>${'AB'[k]}</b>${fig(x, { sp, w: 320, h: 60 })}</div>`).join('')}</div></div>`;
  if (vs.length < 4 && vs.length) h += `<p class="note">이 짝은 확인을 통과한 목소리 ${vs.length}개만 보여 줘요.</p>`;
  $('swMain').innerHTML = h;
}
function swInit() {
  swDraw();
  $('tswitch').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    const d = b.dataset;
    if (d.sws) { SW.set = d.sws; SW.i = 0; SW.side = 1; swDraw(); return; }
    if (d.swi != null) { SW.i = +d.swi; swDraw(); return; }
    if (d.swv) { SW.voice = d.swv; swDraw(); return; }
    if (d.sw != null) {
      SW.side = +d.sw; swDraw();
      const set = IN.switchSet(SW.set), pair = set.pairs[SW.i], vs = okVoices(pair);
      speak(tSeq(pair[SW.side], vs.includes(SW.voice) ? SW.voice : (vs[0] || 'tc')));
    }
  });
}

/* =========================================================
   10. 놀이터 ③ 내 높낮이 선 (시험 기능) — 문장 하나를 녹음하면 브라우저 안에서 소리의 높이를 재서 선으로 그리고,
   끝이 올라갔는지 내려갔는지(반음) 보여 줘요. 잰 방법은 YIN(자기 자신과 어긋난 정도로 주기 찾기)을 줄인 것:
   16kHz로 풀기 → 40ms 창 · 10ms 간격 · 70~500Hz → 이웃 셋의 가운데값 → 끝 움직임 = 마지막 울림 0.15초 − 그 앞 0.25~0.6초
   (본보기를 잰 도구 tools/measure-syllables.py와 같은 구간, 높이를 찾는 방법은 달라요).
   녹음은 이 화면의 메모리에만 있고, 소리는 어디로도 보내지 않아요(브라우저 안에서 계산).
   ========================================================= */
const MP_SENT = ["It's raining?", "It's raining.", 'Are you ready?', 'Where are you going?', "You're leaving?", 'Coffee or tea?'];
const MPF = (() => {
  function yin(x, sr) {
    const hop = Math.round(0.01 * sr), Wn = Math.round(0.04 * sr), tmin = Math.floor(sr / 500), tmax = Math.ceil(sr / 70);
    const n = Math.floor((x.length - Wn - tmax - 2) / hop);
    if (n < 30) return null;
    const rms = []; let top = 0;
    for (let i = 0; i < n; i++) { let s = 0; const o = i * hop; for (let j = 0; j < Wn; j++) s += x[o + j] * x[o + j]; const r = Math.sqrt(s / Wn); rms.push(r); if (r > top) top = r; }
    const f = new Array(n).fill(NaN), d = new Float64Array(tmax + 2);
    for (let i = 0; i < n; i++) {
      if (!top || rms[i] < top * 0.06) continue;           // 가장 큰 곳보다 약 24dB 작으면 쉼으로
      const o = i * hop; let run = 0, best = -1;
      d[0] = 1;
      for (let tau = 1; tau <= tmax + 1; tau++) {
        let s = 0; for (let j = 0; j < Wn; j++) { const v = x[o + j] - x[o + j + tau]; s += v * v; }
        run += s; d[tau] = run ? s * tau / run : 1;
      }
      for (let tau = tmin; tau <= tmax; tau++) if (d[tau] < 0.15) { while (tau + 1 <= tmax && d[tau + 1] < d[tau]) tau++; best = tau; break; }
      if (best < 1) continue;
      const a = d[best - 1], b = d[best], c = d[best + 1], den = a - 2 * b + c, shift = den ? 0.5 * (a - c) / den : 0;
      const hz = sr / (best + clamp(shift, -1, 1));
      if (hz >= 70 && hz <= 500) f[i] = hz;
    }
    // 이웃 셋의 가운데값 (울린 칸만)
    return f.map((v, i) => { if (isNaN(v)) return v; const w = [f[i - 1], v, f[i + 1]].filter(z => z != null && !isNaN(z)); return median(w); });
  }
  function analyze(x, sr) {
    const f = yin(x, sr);
    if (!f) return { err: 'short' };
    const idx = []; f.forEach((v, i) => { if (!isNaN(v)) idx.push(i); });
    if (idx.length < 20) return { err: 'quiet' };
    const ref = median(idx.map(i => f[i])), e = idx[idx.length - 1];
    const vals = (a, b) => f.slice(Math.max(0, a), Math.max(0, b)).filter(v => !isNaN(v));
    const last = vals(e - 15, e + 1), prev = vals(e - 60, e - 25);
    const end = last.length >= 5 && prev.length >= 5 ? Math.round(12 * Math.log2(median(last) / median(prev)) * 10) / 10 : null;
    const i0 = Math.max(0, idx[0] - 6), i1 = Math.min(f.length - 1, e + 10), pts = [];
    for (let i = i0; i <= i1; i += 2) { const w = [f[i], f[i + 1]].filter(v => v != null && !isNaN(v)); pts.push(w.length ? [(i - i0) / Math.max(1, i1 - i0), 12 * Math.log2(median(w) / ref)] : null); }
    return { end, data: { measured: true, pts, words: [], end, sp: null, shape: 'mine' }, ref: Math.round(ref) };
  }
  const decode = (c, buf) => new Promise((res, rej) => { const p = c.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); });
  async function fromBlob(blob) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return { err: 'decode' };
    const sr = 16000, buf = await blob.arrayBuffer();
    let ab;
    try { ab = await decode(new OAC(1, sr, sr), buf); } catch (e) { return { err: 'decode' }; }
    if (ab.length < ab.sampleRate * 0.4) return { err: 'short' };
    return analyze(ab.getChannelData(0), ab.sampleRate);
  }
  return { yin, analyze, fromBlob };
})();
window.__MPF = MPF;   // 확인용(읽기만)
const MP_ERR = {
  short: '소리가 너무 짧아요. 문장 하나를 끝까지 말해 보세요.',
  quiet: '목이 울리는 소리를 찾지 못했어요. 조용한 곳에서 마이크 가까이 말해 보세요.',
  decode: '이 브라우저에서는 녹음한 소리를 풀어 잴 수 없어요.',
};
const MP = { t: MP_SENT[0], res: null, url: null, err: null, busy: false };
const mpDir = e => e == null ? null : e >= 2 ? 'up' : e <= -2 ? 'down' : 'mid';
function mpDraw() {
  const t = MP.t, sp = INS.bestSp(t), want = IN.endOf(t);
  let h = row('문장', `<div class="wrow sel">${MP_SENT.map(x => `<button type="button" class="pickw${MP.t === x ? ' on' : ''}" data-mpt="${esc(x)}" aria-pressed="${MP.t === x}">${sHTML(x, { paint: false })}</button>`).join('')}</div>`);
  h += `<div class="mp-body"><div class="mp-fig">${fig(t, { sp, w: 300 })}</div>
    <div class="mp-word"><p class="mp-big">${sHTML(t)}</p><p>${shapeTag(t)} <span class="capsb">${esc(IN.meaning(t))}</span></p>
    <p class="note">${want === 'up' ? '본보기 → 꺾이는 곳에서부터 끝까지 올라가요. 마지막 낱말을 위로 들어 올리듯 말해 보세요.' : IN.shapeOf(t) === 'alt' ? '본보기 → 앞 선택지에서 올렸다가 마지막 선택지에서 내려가요. 끝의 방향만 재요.' : '본보기 → 꺾이는 곳에서부터 끝으로 내려가요. 마지막 낱말을 아래로 내려놓듯 말해 보세요.'}</p>
    <div class="wrow">${wBtn(t, sp)}</div></div></div>`;
  h += '<div class="mp-acts">';
  if (CAN_REC) h += `<button type="button" class="btn" id="mpRec" aria-pressed="false">${ICO.rec}<span>3초 녹음해서 재기</span></button>`;
  else h += '<p class="note">이 브라우저는 녹음을 쓸 수 없어요. 본보기를 듣고 세 번 소리 내어 따라 해 보세요.</p>';
  h += '</div><div class="mp-res" id="mpRes" role="status"></div>';
  $('mpMain').innerHTML = h;
  mpResult();
}
function mpResult() {
  const box = $('mpRes'); if (!box) return;
  let h = '';
  if (MP.res && MP.res.data) {
    const r = MP.res, dir = mpDir(r.end), want = IN.endOf(MP.t), hit = dir === want;
    const msg = dir === 'up' ? '끝이 올라갔어요 ↗' : dir === 'down' ? '끝이 내려갔어요 ↘' : dir === 'mid' ? '끝의 움직임이 작아요 — 올렸는지 내렸는지 또렷하지 않아요' : '끝 움직임을 재지 못했어요 — 문장 끝까지 목소리를 내 보세요';
    h += `<p class="verdict"><b class="${hit ? 'c-ok' : dir === 'mid' || dir == null ? 'c-mid' : 'c-no'}">${r.end == null ? '?' : (r.end > 0 ? '+' : r.end < 0 ? '−' : '') + Math.abs(r.end).toFixed(1) + '반음'}</b>${esc(msg)}${dir === 'up' || dir === 'down' ? (hit ? ' · 본보기와 같은 쪽이에요.' : ' · 본보기와 다른 쪽이에요.') : ''}</p>`;
    h += `<div class="figrow">${INS.pitchSVG(MP.t, { data: r.data, w: 340, labels: false, caption: '내 녹음 · 브라우저에서 대략 잰 높낮이' })}</div>`;
  }
  if (MP.err) h += `<p class="sh-err">${esc(MP.err)}</p>`;
  if (MP.url) h += `<div class="mo"><button type="button" class="sh-play" id="mpMine">${ICO.play} 내 목소리</button>${INV.supported ? `<button type="button" class="sh-play" id="mpModel">${ICO.play} 본보기</button><button type="button" class="sh-play" id="mpBoth">${ICO.play} 번갈아 듣기</button>` : ''}</div>`;
  box.innerHTML = h;
}
function mpInit() {
  const root = $('mypitch');
  mpDraw();
  const model = () => tSeq(MP.t, INS.bestSp(MP.t));
  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.dataset.mpt) { MP.t = b.dataset.mpt; MP.res = null; MP.err = null; mpDraw(); return; }
    if (b.id === 'mpRec') {
      if (MP.busy) return;
      MP.busy = true; MP.err = null; MP.res = null; mpResult();
      try {
        const blob = await recordBlob(3000, on => { const x = $('mpRec'); if (x) { x.setAttribute('aria-pressed', String(on)); x.classList.toggle('on', on); x.querySelector('span').textContent = on ? '녹음 중… (3초)' : '3초 녹음해서 재기'; } });
        if (MP.url) URL.revokeObjectURL(MP.url);
        MP.url = blob ? URL.createObjectURL(blob) : null;
        if (!blob) MP.err = '녹음된 소리가 없어요. 다시 해 보세요.';
        else { const r = await MPF.fromBlob(blob); if (r.err) MP.err = MP_ERR[r.err]; else MP.res = r; }
        mpResult();
      } catch (err) { MP.err = recErr(err); mpResult(); }
      MP.busy = false;
      return;
    }
    if (b.id === 'mpMine') { playUrl(MP.url, b); return; }
    if (b.id === 'mpModel') { speak(model()); return; }
    if (b.id === 'mpBoth') { playUrl(MP.url, $('mpMine'), () => speak(model(), { onend(stopped) { if (!stopped) playUrl(MP.url, $('mpMine'), () => speak(model())); } })); }
  });
}

/* =========================================================
   11. 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 높낮이는 맞춰 보지 않아요 — 끝의 방향은 위의 <a href="#mypitch">내 높낮이 선</a>에서 재 보세요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = IN.SGRP_ORDER.map(gk => ({ gk, rows: IN.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk) }));
  $('shList').innerHTML = groups.map(({ gk, rows }) => `<section class="sh-grp"><h3><span class="ptag g-${gk}">${esc(IN.SGRP[gk].ko)}</span> ${esc(IN.SGRP[gk].long.split(' — ')[1] || '')}</h3><ol>${rows.map(([s, i]) => {
    const sp = INS.bestSp(s.en), P = INS.pitchData(s.en, { sp });
    return `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${INV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-en">${sHTML(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-fig">${INS.pitchSVG(s.en, { data: P, w: 240, h: 40, labels: false, caption: P.measured ? `${WHO[sp]} · 잰 높낮이` : '그림 · 잰 값 아님' })}</div>
      <div class="sh-res" role="status"></div></li>`;
  }).join('')}</ol></section>`).join('');
}
function shSeq(i) { const t = IN.SENT[i].en; return tSeq(t, INS.bestSp(t)); }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = IN.SENT[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 꺾이는 곳(노란 글자)을 살려 문장을 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, IN.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.marks.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.w)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}</p>`);
    },
    onFail(msg) { shResult(i, `<p class="sh-err">${esc(msg)}</p>`); },
  });
}
async function shRecord(i) {
  if (SHREC.rec) { const r = SHREC.rec; SHREC.rec = null; try { r.stop(); } catch (e) { /* 이미 멈춤 */ } return; }
  stopSounds(); NARR.reset(); if (playing) pause();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { shResult(i, `<p class="sh-err">${esc(recErr(e))}</p>`); return; }
  let mr; try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(t => t.stop()); shResult(i, '<p class="sh-err">녹음을 시작하지 못했어요.</p>'); return; }
  const chunks = [];
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => {
    clearTimeout(SHREC.tm); stream.getTracks().forEach(t => t.stop()); if (SHREC.rec === mr) SHREC.rec = null; shMicState(i, false);
    if (!chunks.length) { shResult(i, '<p class="sh-err">녹음된 소리가 없어요. 다시 해 보세요.</p>'); return; }
    if (SHREC.url[i]) URL.revokeObjectURL(SHREC.url[i]);
    SHREC.url[i] = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${INV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
    shPlayMine(i, true);
  };
  SHREC.rec = mr; mr.start(); shMicState(i, true);
  shResult(i, '<span class="note">녹음 중이에요. 다 말했으면 ‘멈추기’를 눌러요(6초가 지나면 저절로 멈춰요).</span>');
  SHREC.tm = setTimeout(() => { if (SHREC.rec === mr) { SHREC.rec = null; try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 6000);
}
function shPlayMine(i, thenOrig) {
  const b = document.querySelector(`.sh-row[data-i="${i}"] [data-mine]`);
  playUrl(SHREC.url[i], b, thenOrig && INV.supported ? () => speak(shSeq(i)) : null);
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
   12. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 그림 문제는 높낮이 선 넷
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', p: '#FFC15E', bad: '#FF8E8E', hover: '#6EC8FF', box: '#2A3644', line: '#8FA6C0', nuc: 'rgba(255,193,94,0.16)' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
const markOf = (i, st) => st.done && i === st.answer ? QCOL.p : st.done && i === st.pick ? QCOL.bad : st.hover === i ? QCOL.hover : null;
function panelFig(label, n, drawOne) {
  const Wd = 640, H = 200, cw = Wd / n;
  return { width: Wd, height: H, label,
    pick: (x, y) => y > 4 && y < H - 4 ? Math.min(n - 1, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      for (let k = 0; k < n; k++) {
        const x = k * cw + 6;
        rrq(g, x, 6, cw - 12, H - 12, 12); g.fillStyle = st.hover === k ? QCOL.box : 'rgba(255,255,255,0.03)'; g.fill();
        g.save(); rrq(g, x, 6, cw - 12, H - 12, 12); g.clip(); drawOne(g, k, x, cw - 12); g.restore();
        const c = markOf(k, st); if (c) { rrq(g, x, 6, cw - 12, H - 12, 12); g.strokeStyle = c; g.lineWidth = 3; g.stroke(); }
        g.beginPath(); g.arc(x + 18, 22, 11, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill();
        g.font = qfont(12, 700); g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], x + 18, 23);
      }
    } };
}
// 높낮이 선 넷 (그림): 꺾이는 곳(노란 칸)은 넷 모두 같은 자리
function tuneFig(label, text, curves) {
  const sc = IN.schematic(text), nuc = sc.syl.find(s => s.nuc);
  return panelFig(label, curves.length, (g, k, x, w) => {
    const x0 = x + 14, ww = w - 28, y0 = 46, h = 120, lo = -9, hi = 11;
    const X = p => x0 + p * ww, Y = st => y0 + h - (clamp(st, lo, hi) - lo) / (hi - lo) * h;
    g.fillStyle = QCOL.nuc; g.fillRect(X(nuc.a), y0 - 4, X(nuc.b) - X(nuc.a), h + 8);
    g.strokeStyle = 'rgba(238,241,244,0.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, Y(0)); g.lineTo(x0 + ww, Y(0)); g.stroke();
    const pts = curves[k];
    g.beginPath();
    pts.forEach((p, i) => { if (!i) g.moveTo(X(p[0]), Y(p[1])); else { const q = pts[i - 1], mx = (X(q[0]) + X(p[0])) / 2; g.bezierCurveTo(mx, Y(q[1]), mx, Y(p[1]), X(p[0]), Y(p[1])); } });
    g.strokeStyle = QCOL.line; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  });
}
const QS = (() => {
  const Q5 = 'Do you like coffee?';
  const q = [
    { q: "It's raining? → 끝을 올려 말하면 어떤 뜻으로 들리나요?", opts: ['비가 와요 — 알려 주는 말', '비가 온다고요? — 놀라거나 확인하며 되묻는 말', '비가 언제 와요? — 정보를 묻는 말', '비가 와요, 눈이 와요? — 고르라는 말'], a: 1,
      why: '평서문 꼴 그대로 끝만 올리면 되묻는 말이에요. 놀랐거나, 들은 것을 확인할 때 써요.',
      check: () => IN.shapeOf("It's raining?") === 'decl' && IN.endOf("It's raining?") === 'up' },
    { q: 'Where are you going? → 끝은 보통 어떻게 하나요?', opts: ['꺾이는 곳에서부터 끝까지 내려가요 ↘', '끝까지 올라가요 ↗', '평평하게 끝나요', '앞을 올리고 마지막을 내려요 ↗↘'], a: 0,
      why: '의문사로 시작하는 정보 질문은 예 · 아니오가 아니라 정보로 답해요. 기본은 꺾이는 곳(GOing)에서 내림이에요.',
      check: () => IN.shapeOf('Where are you going?') === 'wh' && IN.endOf('Where are you going?') === 'down' },
    { q: 'Are you ready? → 꺾이는 곳은 어디인가요?', opts: ['Are', 'you', '앞 음절 REA — REAdy', '끝 음절 dy — reaDY'], a: 2,
      why: '꺾이는 곳은 마지막 내용어(ready)의 센 음절이에요 → Are you REAdy? 거기서부터 끝까지 올려요.',
      check: () => IN.caps('Are you ready?') === 'Are you REAdy?' },
    { q: 'Would you like coffee or tea? → 둘 중 하나를 고르라는 뜻으로 말하려면?', opts: ['둘 다 ↗', '앞 coffee ↘ · 마지막 tea ↗', '둘 다 ↘', '앞 coffee ↗ · 마지막 tea ↘'], a: 3,
      why: '고르는 질문은 앞 선택지를 올리고 마지막 선택지를 내려요. 끝까지 올리면 마실 것을 원하느냐는 Yes/No 질문이 돼요.',
      check: () => IN.phrases('Would you like coffee or tea?').map(p => p.tone).join() === 'alt1,fall' },
    { q: `${Q5} → 높낮이 선으로 그리면? 그림을 눌러도 돼요. (노란 칸 = 꺾이는 곳 COFfee)`, opts: ['A', 'B', 'C', 'D'], a: 1,
      figure: tuneFig('높낮이 선 넷. A 꺾이는 곳에서 솟았다가 내려감, B 꺾이는 곳에서 낮게 시작해 끝까지 올라감, C 거의 평평함, D 내내 내려가다 마지막 음절만 살짝 올라감', Q5,
        [IN.schematic(Q5, { tune: 'fall' }).pts, IN.schematic(Q5).pts, [[0, 0.6], [0.3, 0.3], [0.6, 0], [1, -0.4]], [[0, 1.5], [0.3, 1], [0.55, 0.4], [0.8, -0.4], [0.9, -0.8], [1, 1.6]]]),
      why: 'Yes/No 질문은 꺾이는 곳(COFfee)에서 낮게 시작해 끝까지 올라가요(B). A는 평서문 · 정보 질문의 내림, D처럼 끝 음절만 살짝 올리면 묻는 말로 잘 들리지 않아요.',
      check: () => IN.endOf(Q5) === 'up' && IN.caps(Q5) === 'Do you like COFfee?' },
    { q: 'Is it far from here? → 꺾이는 곳은?', opts: ['far', 'Is', 'from', 'here'], a: 0,
      why: 'from · here는 뜻을 싣는 낱말이 아니거나(from) 뒤에 덧붙은 말이라, 마지막 내용어 far에서 꺾여요 → Is it FAR from here?',
      check: () => IN.caps('Is it far from here?') === 'Is it FAR from here?' },
    { q: "You're a student. → 낱말은 그대로 두고 되묻는 말로 바꾸려면?", opts: ['낱말 순서를 바꿔요', '꺾이는 곳을 첫 낱말로 옮겨요', '모음을 길게 늘여요', '끝의 높낮이 — 꺾이는 곳에서부터 올려요'], a: 3,
      why: "You're a student? → 낱말 순서는 그대로, 꺾이는 곳(STUdent)에서부터 끝을 올려요. 순서를 바꾸면(Are you a student?) Yes/No 질문이 돼요.",
      check: () => IN.shapeOf("You're a student?") === 'decl' && IN.shapeOf("You're a student.") === 'stmt' },
    { q: 'I said Tuesday, not Monday. → 가장 높이 솟는 낱말은?', opts: ['I', 'said', 'Tuesday', 'Monday'], a: 2,
      why: '고쳐 말하는 새 정보(Tuesday)로 꺾이는 곳이 옮겨 가요. 그 뒤의 not Monday는 낮게 눌러 말해요.',
      check: () => IN.focusOf('I said Tuesday, not Monday.') === 'Tuesday' && IN.nuclei('I said Tuesday, not Monday.', { focus: 'Tuesday' })[0] === 2 },
    { q: '연구(전윤실 · 오세풍 · 김기호, 2004)에서 한국인 화자는 Yes/No 질문의 초점 낱말을 어떻게 말하는 경향을 보였나요?', opts: ['초점 낱말에 높은 소리를 얹었어요', '초점 낱말을 낮게 시작해 끝을 올렸어요', '초점 낱말을 빼고 말했어요', '높낮이를 전혀 바꾸지 않았어요'], a: 0,
      why: '원어민은 초점 낱말을 낮게 시작해 끝을 올렸고(B), 한국인 화자는 초점 낱말에 높은 소리를 얹는 경향을 보였어요. 한국인 청자는 낮게 시작하는 초점을 알아듣기 어려워했어요.' },
    { q: 'Where are you going? → 끝을 크게 올려 말하면 어떻게 들리기 쉬운가요?', opts: ['명령처럼', '되묻는 말처럼 (어디 간다고요?)', '평서문처럼', '아무 차이 없어요'], a: 1,
      why: '정보 질문의 기본은 내림이에요. 크게 올리면 들은 것을 되묻는 말처럼 들릴 수 있어요. 다만 부드럽게 · 다정하게 물을 때 올리기도 해요.',
      check: () => IN.shapeOf('Where are you going?') === 'wh' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[억양] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 1) console.warn('[억양] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { INV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = INS.chapterAt(T);
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
// 화면 누르기: 문장 · 높낮이 선 · 목소리 칩은 그 목소리로, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * INS.W, (e.clientY - r.top) / r.height * INS.H]; };
const hitAt = (x, y) => started ? INS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
let lastHit = { k: '', at: 0 };
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.play && INV.supported) {
    const k = JSON.stringify(h.play), again = lastHit.k === k && performance.now() - lastHit.at < 4000;
    lastHit = { k, at: performance.now() };
    speak(h.play, { slow: again });
  }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { INV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = ' ' + INV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 영상의 문장 · 선 · 목소리 칩, 직접 해 보기(고르는 것은 하나씩), 문장 표 전체 × 목소리 넷(훈련 · 실험실 · 내 높낮이 선 · 따라 말하기), 듣고 고르기
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text) return;
    const id = INV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: INV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), base = JSON.parse(INS.DEFAULTS), n0 = SEQS.length;
  const lists = { map: [].concat(...IN.MAP.map(m => m.ex)), nucleus: IN.NUC, yn: IN.YN, wh: IN.WH, alt: IN.ALT, focus: IN.FOCUS };
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 누를 수 있는 문장 · 선 · 목소리 칩. 직접 해 보기로 바뀌는 장면도 하나씩
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t, ch.t + ch.d]; };
    const one = (id, at) => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t + at, ch.t + at]; };
    const sweeps = [[{}, [0, END]]].concat(SPS.map(sp => [{ voice: sp }, span('listen')]));
    Object.keys(lists).forEach(id => lists[id].forEach(t => sweeps.push([{ sent: t }, one(id, 8)])));
    IN.DECL.forEach((_, i) => sweeps.push([{ pair: i }, one('decl', 8)]));
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.5) { INS.render(g, t); INS.hits().forEach(h => addSeq(h.play, 'video')); }
    });
    // 2) 직접 해 보기: 장마다 + 고르는 것은 하나씩
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* */ } });
    SPS.forEach(sp => { S.voice = sp; LABS.listen(); }); S.voice = null;
    Object.keys(lists).forEach(id => lists[id].forEach(t => { S.sent = t; LABS[id](); })); S.sent = null;
    IN.DECL.forEach((_, i) => { S.pair = i; LABS.decl(); }); S.pair = null;
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); dirty = true; }
  // 3) 문장 표 전체 × 목소리 넷 — 훈련 · 실험실 · 내 높낮이 선 · 따라 말하기는 확인을 통과한 목소리를 골라 쓰니 모두 만들어 둬요
  IN.SENT_ALL.forEach(s => SPS.forEach(sp => add(sp, s.en, 'all')));
  // 4) 듣고 고르기: 들려주는 말
  IN.DRILL.forEach(q => addSeq(IN.drillSeq(q), 'drill'));
  return out;
};
// 도구용(읽기만): 잴 줄의 정보 — tools/dialogue-lines.cjs가 audio/dialogue/measure-meta.json으로 씀 → tools/measure-syllables.py
// 문장(tune): 모양 shape · 낱말 toks(받아쓰기와 맞춰 낱말 시각을 얻음) · 내용어 자리 cw · 초점 낱말 자리 focus · 고르는 질문의 앞 선택지 자리 alt
window.__measureMeta = lines => lines.map(l => {
  const toks = IN.tokens(l.text), sh = IN.shapeOf(l.text), f = IN.focusOf(l.text);
  const fi = f ? toks.findIndex(x => x.k === f.toLowerCase()) : -1;
  return { id: l.id, sp: l.sp, text: l.text, kind: 'tune', shape: sh, toks: toks.map(x => x.k), cw: toks.filter(x => x.e && x.e.kind === 'c').map(x => x.i), focus: fi >= 0 ? fi : null, alt: sh === 'alt' ? IN.phrases(l.text)[0].w : null };
});
hvInit();
swInit();
mpInit();
shInit();
PDrill($('drillRoot'), IN.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 끝의 올림 · 내림과 질문의 모양이 귀에 들어오네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보고, 높낮이 선을 견줘 보세요.' : '처음에는 누구나 헷갈려요. 놀이터의 끝 올림 · 내림 듣기 훈련으로 여러 목소리를 더 들어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '억양과 초점 — 모두 알았네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(INS.baseText()).then(() => { dirty = true; });
setTimeout(() => INS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
