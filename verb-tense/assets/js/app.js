/* 시제 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(시간선 시제 기계), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(VT), 그림은 scenes.js(TS)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const VT = window.VT, TS = window.TS, S = TS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = TS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cv = $('cv'), ctx = cv.getContext('2d');
VT.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = TS.fonts;
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
  const ready = new Promise(res => TS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '시간선 위에 동사를 놓아라 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { TS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
// 자막: **굵게**는 강조색, 영어는 lang="en"으로 감싸 색을 달리함 (화면 읽기 프로그램도 영어로 읽음)
function capHTML(s) {
  return String(s).split('**').map((part, k) => {
    const inner = EN.splitLang(part).map(p => p.lang === 'en' ? `<span class="en" lang="en">${esc(p.text)}</span>` : esc(p.text)).join('');
    return k % 2 ? `<b>${inner}</b>` : inner;
  }).join('');
}
let lastBtn = '', lastCap = null, lastChap = -1;
function syncUI() {
  // 단추 아이콘은 상태가 바뀔 때만 교체 (매 프레임 바꾸면 누르는 사이에 클릭이 사라짐)
  const btn = playing ? 'pause' : T >= END - 0.01 ? 'replay' : 'play';
  if (btn !== lastBtn) { lastBtn = btn; playBtn.innerHTML = ICON[btn]; playBtn.setAttribute('aria-label', btn === 'pause' ? '일시정지 (스페이스)' : btn === 'replay' ? '처음부터 다시 (스페이스)' : '재생 (스페이스)'); }
  seekEl.value = T;
  timeLbl.textContent = `${fmtT(T)} / ${fmtT(END)}`;
  const cap = started ? TS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = TS.chapterAt(T);
  if (ci !== lastChap) { lastChap = ci; document.querySelectorAll('.chap').forEach((b, i) => b.setAttribute('aria-current', String(i === ci))); buildLab(ci); }
}
function play() {
  if (T >= END - 0.01) T = 0;
  EN.say.stop();
  playing = true; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}
function pause() { playing = false; NARR.reset(); syncUI(); dirty = true; }
function seek(t) { T = clamp(t, 0, END); started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true; }
function loop(ts) {
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
  if (playing) {
    T = NARR.hold(T, T + dt * speed);                    // 음성 해설이 읽는 중이면 자막 끝에서 기다림
    if (T >= END) { T = END; playing = false; NARR.reset(); }
    syncUI(); NARR.sync(T, playing); dirty = true;
  }
  if (dirty) { dirty = false; TS.render(ctx, started ? T : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
// '직접 해 보기'에서 무언가를 바꾸면: 영상은 멈추고 다시 그림
function touch() { if (playing) pause(); dirty = true; }

/* =========================================================
   4. 장면별 '직접 해 보기' — 장이 바뀔 때만 다시 만듦
   ========================================================= */
const FORM = VT.FORM, TIME = VT.TIME;
const seg = (name, items, cur) => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${esc(t)}</button>`).join('')}</div>`;
const enLine = (text, cls = '') => `<p class="enline ${cls}">${sayBtn(text)}<span lang="en">${esc(text)}</span></p>`;
// 연습 문제 하나를 직접 해 보기용 빈칸 문제로 (보기 단추 → 규칙 엔진으로 채점)
function miniQ(i) {
  const it = VT.DRILL[i];
  return `<div class="mini" data-q="${i}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map(([w], k) => `<button type="button" data-k="${k}">${esc(w)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
// 모양 여럿을 규칙 엔진으로 채점한 목록 (✓/× + 까닭)
function verdictList(rows) {
  return `<ul class="verdicts">${rows.map(([text, j]) => `<li class="${j.s === 'ok' ? 'c-ok' : ''}"><b class="${j.s === 'ok' ? 'c-ok' : 'c-no'}">${j.s === 'ok' ? '✓' : '×'}</b><span lang="en" class="vt">${esc(text)}</span> ${esc(j.why)}</li>`).join('')}</ul>`;
}
const CLUE3 = { ago: ['two years ago', 'P'], since: ['since 2020', 'PN'], next: ['next year', 'F'] };
const SORTQ = ['in 2019', 'so far', 'in two weeks', 'over the past year', 'last week', 'soon'];
const SORTB = [['P', '과거'], ['PN', '현재완료'], ['F', '미래']];
const METHOD = [
  { id: 'since', label: 'since 2020', row: 1, frame: { time: 'PN' } },
  { id: 'ago', label: 'two years ago', row: 0, frame: { time: 'P' } },
  { id: 'next', label: 'next Monday', row: 2, frame: { time: 'F' } },
  { id: 'byF', label: 'by next March', row: 3, frame: { time: 'FB' } },
  { id: 'byP', label: 'by the time the CEO arrived', row: 3, frame: { time: 'PB' } },
  { id: 'when', label: 'When the shipment ___, we will call you.', row: 4, frame: { time: 'F', clause: 'adv' } },
  { id: 'that', label: 'recommended that every employee ___', row: 5, frame: { clause: 'that' } },
];
const methodText = m => {
  const f = VT.rightForms(m.frame)[0], place = m.frame.clause === 'that' ? '해야 할 일' : m.frame.clause === 'adv' ? '미래지만 부사절' : TIME[m.frame.time].name;
  return { place, form: `${FORM[f].name} (${FORM[f].shape})` };
};
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ(0)}
    <p class="note">맞든 틀리든 괜찮아요. 영상 10장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  line: () => `<h2>직접 해 보기</h2><h3>시간선에서 하나만 보기</h3>
    ${seg('시제', [['past', '과거 worked'], ['pres', '현재 works'], ['fut', '미래 will work']], S.base)}
    ${enLine('She worked here.', 'small')}${enLine('She works here.', 'small')}${enLine('She will work here.', 'small')}
    <p class="note">고른 시제만 밝게 보여요. 현재 시제는 ‘지금 이 순간’보다 ‘늘 되풀이되는 일’에 더 자주 써요.</p>
    ${S.base ? '<button class="btn ghost" type="button" id="labClear">모두 보기</button>' : ''}`,
  perfect: () => {
    const st = S.still, fr = { time: st ? 'PN' : 'P' };
    return `<h2>직접 해 보기</h2><h3>지금도 일하고 있나요?</h3>
      ${seg('지금도 일하나요', [['false', '아니요, 그만뒀어요'], ['true', '네, 지금도 일해요']], st)}
      ${st == null ? '<p class="note">하나를 고르면 시간선에서 그 문장이 밝아지고, 규칙 엔진이 두 모양을 채점해요.</p>'
        : verdictList([['She worked here for five years.', VT.judge('past', fr)], ['She has worked here for five years.', VT.judge('presperf', fr)]])}
      <p class="note">한국어로는 둘 다 ‘5년 일했다’예요. 영어는 지금까지 이어지는지에 따라 모양이 갈라져요.</p>`;
  },
  clue: () => {
    const c = S.clue && CLUE3[S.clue], vp = VT.VPS[0];
    return `<h2>직접 해 보기</h2><h3>단서 바꾸기</h3>
      ${seg('시간 단서', Object.entries(CLUE3).map(([k, [t]]) => [k, t]), S.clue)}
      ${c ? verdictList(['past', 'presperf', 'pres', 'fut'].map(f => [`Our company ${VT.conj(vp, f)} three new stores ${c[0]}.`, VT.judge(f, { time: c[1] })]))
        : '<p class="note">단서를 고르면 화면의 시간선과 문장이 그 단서로 바뀌고, 네 가지 시제를 규칙 엔진이 채점해요.</p>'}
      ${S.clue ? '<button class="btn ghost" type="button" id="labClear">영상 흐름으로</button>' : ''}`;
  },
  clues: () => `<h2>직접 해 보기</h2><h3>단서를 보고 시제 고르기</h3>
    <ol class="gapq">${SORTQ.map(w => `<li data-w="${esc(w)}"><span lang="en" class="cw">${esc(w)}</span><span class="mo">${SORTB.map(([c, t]) => `<button type="button" data-c="${c}">${t}</button>`).join('')}</span><span class="mr" role="status"></span></li>`).join('')}</ol>`,
  adv: () => `<h2>직접 해 보기</h2><h3>부사절의 현재 시제</h3>${miniQ(4)}${miniQ(6)}`,
  ref: () => `<h2>직접 해 보기</h2><h3>미래완료 · 과거완료</h3>${miniQ(7)}${miniQ(8)}`,
  that: () => `<h2>직접 해 보기</h2><h3>that절의 동사원형</h3>${miniQ(10)}${miniQ(12)}`,
  adverb: () => `<h2>직접 해 보기</h2><h3>시제와 짝인 부사</h3>${miniQ(13)}${miniQ(15)}`,
  method: () => {
    const m = S.path && METHOD.find(x => x.id === S.path.id);
    const r = m && methodText(m);
    return `<h2>직접 해 보기</h2><h3>단서 판정기</h3>
      <p class="note">단서를 고르면 흐름도에 길이 켜지고, 규칙 엔진이 정한 동사 모양이 나와요.</p>
      <div class="pick"><span>단서</span><select id="labM" class="sel"><option value="">고르기</option>${METHOD.map(x => `<option value="${x.id}"${m && m.id === x.id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
      ${r ? `<p class="verdict">② 시간선: <b>${esc(r.place)}</b> → ③ 모양: <b class="c-ans">${esc(r.form)}</b></p>` : ''}
      ${S.path ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${VT.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 시간선 시제 기계: 단서를 바꾸며 동사 모양이 바뀌는 것 보기</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${VT.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 단서 · 시간선 · 모양 표</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
// 직접 해 보기의 조작은 한곳에서 처리 (다시 만들어도 이어서 동작)
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = CHAPTERS[TS.chapterAt(T)].id;
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[TS.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { S.base = null; S.clue = null; S.path = null; touch(); buildLab(TS.chapterAt(T)); return; }
  if (b.dataset.k != null) {                                // 빈칸 문제
    const box = b.closest('.mini'), it = VT.DRILL[+box.dataset.q], k = +b.dataset.k, j = VT.judgeOpt(it, k);
    box.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(j.s === 'ok' ? 'right' : 'wrong');
    box.querySelector('.mr').textContent = `${VT.optName(it, k)}. ` + (j.s === 'ok' ? '맞아요! ' : '아니에요. ') + j.why;
    if (playing) pause();
    return;
  }
  if (b.dataset.c) {                                        // 단서 → 시제 고르기
    const li = b.closest('li'), w = li.dataset.w, time = VT.clueTime(w), okk = time === b.dataset.c;
    li.querySelectorAll('button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(okk ? 'right' : 'wrong');
    li.querySelector('.mr').textContent = (okk ? '맞아요. ' : '다시 보세요. ') + `${w} → ${TIME[time].name} → ${FORM[TIME[time].form].name}.`;
    if (playing) pause();
    return;
  }
  const grp = b.closest('.seg'); if (!grp || b.dataset.v == null) return;
  if (id === 'line') { S.base = b.dataset.v; showAt(2.4); }
  else if (id === 'perfect') { S.still = b.dataset.v === 'true'; showAt(3); }
  else if (id === 'clue') { S.clue = b.dataset.v; showAt(2.2); }
  touch(); buildLab(TS.chapterAt(T));
});
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showAt(u) { const ch = CHAPTERS[TS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (t.id !== 'labM') return;
  const m = METHOD.find(x => x.id === t.value);
  S.path = m ? { id: m.id, row: m.row, text: `${m.label.replace('___', '빈칸')} → ${methodText(m).form}` } : null;
  showAt(21);
  touch(); buildLab(TS.chapterAt(T));
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // p.p.(과거분사)는 ‘피피’로 읽음
  read: [[/p\.p\./g, '피피'], [/TOEIC/g, '토익'], [/Part 5/g, '파트 5']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 — 시간선 시제 기계
   문장(넷)과 단서(열넷)를 고르면 규칙 엔진이 동사 모양을 정하고, 시간선에 단서와 일을 그림.
   ‘먼저 맞히기’를 켜면 모양 일곱 가지 중 하나를 직접 고른 뒤 확인함.
   ========================================================= */
const M = { vp: 0, clue: 2, guess: false, pick: null, score: 0, tries: 0 };
const mcv = $('mCv'), mg = mcv.getContext('2d'), MH = 230;
let MW = 720;
function mDraw() {
  // 논리 너비를 화면 너비에 맞춰 바꿈 (휴대폰에서도 글자가 너무 작아지지 않게)
  const r = mcv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), cssW = r.width || 720;
  MW = Math.round(clamp(cssW, 520, 880));
  const w = Math.max(1, Math.round(cssW * d)), h = Math.max(1, Math.round(w * MH / MW));
  if (mcv.width !== w || mcv.height !== h) { mcv.width = w; mcv.height = h; }
  const ar = `${MW} / ${MH}`; if (mcv.style.aspectRatio !== ar) mcv.style.aspectRatio = ar;
  mg.setTransform(mcv.width / MW, 0, 0, mcv.width / MW, 0, 0);
  const vp = VT.VPS[M.vp], c = VT.MCLUES[M.clue], right = VT.rightForms(c.frame)[0];
  const show = !M.guess || M.pick != null;
  const L = { clue: c.frame.clause === 'that' ? '해야 할 일 · 시간선 밖' : c.frame.clause === 'adv' ? c.mark + ' …' : c.label,
    verb: show ? VT.conj(vp, right) : '?', ref: c.ref, main: c.mark2 };
  TS.machine(mg, MW, MH, c.frame, L);
}
function mRender() {
  const vp = VT.VPS[M.vp], c = VT.MCLUES[M.clue], right = VT.rightForms(c.frame)[0];
  const show = !M.guess || M.pick != null;
  $('mVp').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === M.vp)));
  $('mClue').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === M.clue)));
  const B = VT.build(vp, c, show ? right : null);
  const clueHTML = s => [[c.mark, 'cue'], [c.mark2, 'main']].reduce((h, [m, cls]) => m ? h.replace(esc(m), `<mark class="${cls}">${esc(m)}</mark>`) : h, esc(s));
  $('mSent').innerHTML = `${show ? sayBtn(B.text) : ''}<span>${clueHTML(B.parts[0])}${show ? `<b class="mfill">${esc(B.parts[1])}</b>` : '<span class="blank">&nbsp;</span>'}${clueHTML(B.parts[2])}</span>`;
  const T7 = VT.FORMS7;
  $('mForms').innerHTML = T7.map((f, i) => {
    const j = VT.judge(f, c.frame), ok = j.s === 'ok', picked = M.pick === f;
    const cls = !show ? '' : ok ? 'right' : picked ? 'wrong' : 'off';
    return `<button type="button" data-f="${f}" class="${cls}"${show && M.guess ? ' disabled' : ''}><kbd>${i + 1}</kbd><span class="fn">${esc(FORM[f].name)}</span><span lang="en" class="fv">${esc(VT.conj(vp, f))}</span>${show ? `<small>${ok ? '✓' : '×'} ${esc(j.why)}</small>` : ''}</button>`;
  }).join('');
  const where = c.frame.clause === 'that' ? '해야 할 일 (시간선 밖)' : c.frame.clause === 'adv' ? '미래의 일, 그런데 시간·조건 부사절 안' : TIME[c.frame.time].name;
  $('mWhy').innerHTML = !show ? '빈칸에 들어갈 모양을 고르세요. 키보드 1~7로도 고를 수 있어요.'
    : `${M.guess ? `<b class="${M.pick === right ? 'c-ok' : 'c-no'}">${M.pick === right ? '정답!' : '아쉬워요.'}</b> ` : ''}① 단서 <b class="c-cue" lang="en">${esc(c.label)}</b> → ② 시간선: <b>${esc(where)}</b> → ③ 모양: <b class="c-ans">${esc(FORM[right].name)} ${esc(VT.conj(vp, right))}</b>`;
  $('mScore').textContent = M.guess ? `맞힌 수 ${M.score} / ${M.tries}` : '';
  $('mNext').hidden = !M.guess;
  mDraw();
}
function mPick(f) {
  if (!M.guess || M.pick != null) return;
  M.pick = f; M.tries++;
  if (VT.judge(f, VT.MCLUES[M.clue].frame).s === 'ok') M.score++;
  mRender();
}
function mRandom() {
  let c = M.clue; while (c === M.clue) c = Math.floor(Math.random() * VT.MCLUES.length);
  M.clue = c; M.vp = Math.floor(Math.random() * VT.VPS.length); M.pick = null; mRender();
}
function machineInit() {
  $('mVp').innerHTML = VT.VPS.map((v, i) => `<button type="button" data-i="${i}" lang="en">${esc(v.S)} · ${esc(v.v[0])} ${esc(v.o)}</button>`).join('');
  $('mClue').innerHTML = VT.MCLUES.map((c, i) => `<button type="button" data-i="${i}" lang="en">${esc(c.label)}</button>`).join('');
  $('mVp').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; M.vp = +b.dataset.i; M.pick = null; mRender(); });
  $('mClue').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; M.clue = +b.dataset.i; M.pick = null; mRender(); });
  $('mForms').addEventListener('click', e => { const b = e.target.closest('button[data-f]'); if (b) mPick(b.dataset.f); });
  $('mGuess').addEventListener('change', e => { M.guess = e.target.checked; M.pick = null; if (M.guess) mRandom(); else mRender(); });
  $('mNext').addEventListener('click', mRandom);
  $('mach').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tg = e.target;
    if (tg.closest && tg.closest('input, select')) return;
    const n = '1234567'.indexOf(e.key);
    if (n >= 0 && M.guess && M.pick == null) { e.preventDefault(); mPick(VT.FORMS7[n]); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); M.clue = (M.clue + (e.key === 'ArrowRight' ? 1 : VT.MCLUES.length - 1)) % VT.MCLUES.length; M.pick = null; mRender(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); M.vp = (M.vp + (e.key === 'ArrowDown' ? 1 : VT.VPS.length - 1)) % VT.VPS.length; M.pick = null; mRender(); }
    else if ((e.key === 'r' || e.key === 'R') || (e.key === 'Enter' && M.guess && M.pick != null && !(tg.closest && tg.closest('[data-say]')))) { e.preventDefault(); mRandom(); }
  });
  new ResizeObserver(() => mDraw()).observe(mcv);
  mRender();
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', cue: '#C9A7FF', ans: '#FFC15E', ref: '#6EC8FF', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
const D = TS.draw;
// 문장 속 네 덩어리에 A~D를 붙인 그림 문제 (덩어리를 누르거나 단추로 고름)
function wordFig(parts, label, colorOf) {
  let boxes = [];
  return {
    width: 600, height: 150, label,
    pick: (x, y) => boxes.findIndex(b => b && x >= b.x - 4 && x <= b.x + b.w + 4 && y >= 40 && y <= 125),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 150);
      let size = 22; g.font = qfont(size, 600);
      const sp = 9, width = () => parts.reduce((s, [w]) => s + g.measureText(w).width + (w === '.' ? 0 : sp), 0);
      while (width() > 570 && size > 14) { size--; g.font = qfont(size, 600); }
      let x = (600 - width()) / 2; boxes = [];
      g.textBaseline = 'middle';
      parts.forEach(([w, k, role]) => {
        if (w === '.') x -= sp;
        g.font = qfont(size, 600);
        const ww = g.measureText(w).width, on = st.done && k === st.answer, wrong = st.done && k >= 0 && k === st.pick && k !== st.answer;
        if (k >= 0) {
          boxes[k] = { x, w: ww };
          if (st.hover === k || on || wrong) { rrq(g, x - 4, 74, ww + 8, 36, 6); g.fillStyle = on ? 'rgba(201,167,255,0.22)' : wrong ? 'rgba(255,142,142,0.2)' : QCOL.hover; g.fill(); }
          g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.fillText('ABCD'[k], x + ww / 2, 50);
          g.font = qfont(size, 600);
        }
        g.textAlign = 'left'; g.fillStyle = colorOf(role, st) || QCOL.text; g.fillText(w, x, 92);
        x += ww + sp;
      });
    },
  };
}
const FIG_CLUE = wordFig([['Since January,', 0, 'cue'], ['our', -1], ['company', 1], ['has hired', 2, 'ans'], ['20', -1], ['new', -1], ['employees', 3], ['.', -1]],
  '문장 Since January, our company has hired 20 new employees. 네 덩어리에 A부터 D까지 표시된 그림', (role, st) => st.done && role ? QCOL[role] : null);
// 네 칸에 시간선 모양 하나씩 (과거 한 점 · 지금까지 구간 · 지금 되풀이 · 미래 한 점)
const FIG_ZONE = {
  width: 600, height: 260, label: '시간선 그림 네 개: A 과거의 한 점, B 과거에서 지금까지 이어진 막대, C 지금 둘레의 여러 점, D 미래의 한 점',
  pick: (x, y) => (y < 130 ? 0 : 2) + (x < 300 ? 0 : 1),
  draw(g, st) {
    g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 260);
    ['P', 'PN', 'N', 'F'].forEach((kind, k) => {
      const ox = (k % 2) * 300, oy = Math.floor(k / 2) * 130, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
      if (st.hover === k || on || wrong) { rrq(g, ox + 6, oy + 6, 288, 118, 10); g.fillStyle = on ? 'rgba(127,224,168,0.14)' : wrong ? 'rgba(255,142,142,0.16)' : QCOL.hover; g.fill(); }
      g.font = qfont(17, 700); g.fillStyle = QCOL.key; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], ox + 18, oy + 26);
      const y = oy + 74, X = D.axis(g, ox + 52, y, 200, { now: 0.55, ls: 12 });
      if (kind === 'P') D.dot(g, X(0.2), y, '');
      if (kind === 'PN') D.bar(g, X(0.12), X(0.55) - 12, y, { lw: 6 });
      if (kind === 'N') [-0.16, -0.08, 0.08, 0.16].forEach(d => D.dot(g, X(0.55 + d), y, '', { r: 6 }));
      if (kind === 'F') D.dot(g, X(0.88), y, '');
    });
    g.strokeStyle = 'rgba(238,241,244,0.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(300, 10); g.lineTo(300, 250); g.moveTo(10, 130); g.lineTo(590, 130); g.stroke();
  },
};
// 미래완료: 지금 · 기준점(3월) 사이 어디에서 끝나나
const FB_X = [0.1, 0.32, 0.6, 0.92];
const FIG_FB = {
  width: 600, height: 190, label: '시간선 그림: 지금 표시와 next March 깃발, 그리고 A 과거, B 지금, C 지금과 3월 사이, D 3월 뒤의 네 자리',
  pick: (x) => { const X = f => 50 + 480 * f; let k = -1, best = 44; FB_X.forEach((f, i) => { const d = Math.abs(x - X(f)); if (d < best) { best = d; k = i; } }); return k; },
  draw(g, st) {
    g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 190);
    const y = 112, X = D.axis(g, 50, y, 480, { now: 0.32, ls: 13 });
    D.flag(g, X(0.78), y, 'next March', { size: 14, h: 40 });
    FB_X.forEach((f, k) => {
      const x = X(f), on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer, hov = st.hover === k;
      g.beginPath(); g.arc(x, y - 34, 15, 0, Math.PI * 2);
      g.fillStyle = on ? 'rgba(127,224,168,0.3)' : wrong ? 'rgba(255,142,142,0.3)' : hov ? QCOL.hover : 'rgba(16,21,28,0.9)'; g.fill();
      g.strokeStyle = on ? QCOL.ok : wrong ? QCOL.bad : QCOL.key; g.lineWidth = 2; g.stroke();
      g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], x, y - 33);
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fillStyle = on ? QCOL.ok : 'rgba(238,241,244,0.5)'; g.fill();
    });
    if (st.done) D.bar(g, X(0.32) + 8, X(0.6), y, { lw: 5, head: false });
  },
};
const QS = (() => {
  const by = (pairs, fr) => pairs.map(f => VT.judge(f, fr).s === 'ok').join();
  const q = [
    { q: '토익 Part 5의 보기가 worked, has worked, works, will work처럼 같은 동사의 다른 시제라면, 가장 먼저 찾을 것은?', opts: ['문장 속 시간 단서 (since, ago, next 같은 말)', '주어의 뜻', '가장 긴 보기', '문장의 마지막 낱말'], a: 0,
      why: '시제 문제의 답은 해석보다 문장 속 시간 단서가 정해요. 단서가 시간선의 어디를 가리키는지부터 봐요.' },
    { q: '‘She has worked here for five years.’ 이 일을 시간선에 놓은 그림은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1, figure: FIG_ZONE,
      why: '현재완료(has worked)는 과거에 시작해 지금까지 이어진 구간이에요. 막대가 지금에 닿아 있는 B.', check: () => FORM.presperf.time === 'PN' },
    { q: '한국어 ‘서울에서 5년 살았다’를 영어로 옮겨요. 지금도 서울에 산다면 알맞은 문장은?', opts: ['I lived in Seoul for five years.', 'I live in Seoul for five years.', 'I will live in Seoul for five years.', 'I have lived in Seoul for five years.'], a: 3,
      why: '지금까지 이어진 일이라 현재완료 have lived. 과거 lived → 이미 끝난 일(지금은 서울에 살지 않음)이 돼요.', check: () => by(['past', 'pres', 'fut', 'presperf'], { time: 'PN' }) === 'false,false,false,true' },
    { q: '‘Since January, our company has hired 20 new employees.’ 동사의 시제를 정한 단서는? 그림 속 덩어리를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 0, figure: FIG_CLUE,
      why: 'Since January(1월부터) → 지금까지 이어진 구간. 그래서 동사도 현재완료, has hired.', check: () => VT.clueTime('since January') === 'PN' },
    { q: '다음 중 현재완료(has opened)와 함께 쓸 수 없는 단서는?', opts: ['since 2020', 'so far', 'two years ago', 'over the past year'], a: 2,
      why: 'two years ago → 과거의 한 점이라 과거 시제(opened)와 짝이에요. 나머지는 지금까지 이어진 구간이에요.',
      check: () => ['since 2020', 'so far', 'two years ago', 'over the past year'].map(c => VT.judge('presperf', { time: VT.clueTime(c) }).s === 'ok').join() === 'true,true,false,true' },
    { q: 'When the new system ___ installed, we will train all staff. 빈칸에 알맞은 말은?', opts: ['will be', 'is', 'was', 'being'], a: 1,
      why: '접속사 when → 시간 부사절이에요. 미래의 일이어도 부사절에서는 현재 시제 is. will be 자리는 주절이에요.', check: () => by(['fut', 'pres', 'past', 'ing'], { time: 'F', clause: 'adv' }) === 'false,true,false,false' },
    { q: '‘By next March, she will have completed the course.’ 과정을 마치는 때로 알맞은 자리는? 그림 속 글자를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_FB,
      why: '미래완료는 기준점(next March)보다 먼저 끝나 있을 일이에요. 지금과 3월 사이의 C. 아직 끝나지 않았으니 A·B는 아니고, 3월 뒤의 D는 늦어요.', check: () => FORM.futperf.time === 'FB' },
    { q: 'The consultant suggested that Mr. Park ___ the client in person. 빈칸에 알맞은 말은?', opts: ['visits', 'visited', 'will visit', 'visit'], a: 3,
      why: 'suggest(제안하다) 뒤 that절은 동사원형 visit. 주어가 단수여도, 앞 동사가 과거여도 원형이에요.', check: () => by(['pres', 'past', 'fut', 'base'], { clause: 'that' }) === 'false,false,false,true' },
    { q: 'The renovation of the lobby will be finished ___. 빈칸에 알맞은 말은?', opts: ['recently', 'shortly', 'already', 'ago'], a: 1,
      why: '동사 will be finished → 미래. 미래와 짝인 부사는 shortly(곧). recently → 현재완료·과거, already → 완료형과 짝이에요.',
      check: () => ['recently', 'shortly', 'already', 'ago'].map(a => VT.judgeAdv(a, { form: 'fut' }).s === 'ok').join() === 'false,true,false,false' },
    { q: 'By the time the new hotel ___, the company will have hired 200 employees. 빈칸에 알맞은 말은?', opts: ['opens', 'will open', 'opened', 'opening'], a: 0,
      why: '① 단서: By the time 부사절과 주절의 will have hired ② 미래의 기준점 ③ 그런데 빈칸은 부사절 안이라 현재 시제 opens.', check: () => by(['pres', 'fut', 'past', 'ing'], { time: 'F', clause: 'adv' }) === 'true,false,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[시제] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[시제] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
  return q;
})();

/* =========================================================
   8. 시작
   ========================================================= */
// 조작
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
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #drill, #quiz, #summary-table')) return;   // 아래 칸에서 누른 키는 영상을 건드리지 않음
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = TS.chapterAt(T);
  if (e.key === ' ' || e.key === 'k') { e.preventDefault(); playing ? pause() : play(); }
  else if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); if (ci + 1 < CHAPTERS.length) seek(CHAPTERS[ci + 1].t); }
  else if (e.key === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); seek(CHAPTERS[T - CHAPTERS[ci].t < 1.5 && ci > 0 ? ci - 1 : ci].t); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); seek(T + 5); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(T - 5); }
  else if (e.key === 'c') $('ccBtn').click();
  else if (e.key === 'f') $('fsBtn').click();
  else if (e.key === 'v' && !$('ttsBtn').hidden) $('ttsBtn').click();
});
// 장 목록과 진행 막대 눈금
CHAPTERS.forEach((ch, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chap';
  b.innerHTML = `<span class="n">${ch.n}</span><span class="tt">${esc(ch.title)}<small>${esc(ch.sub)}</small></span><span class="tm">${fmtT(ch.t)}</span>`;
  b.addEventListener('click', () => { seek(ch.t + 0.01); if (!playing) play(); });
  $('chapters').appendChild(b);
  if (i) { const t = document.createElement('i'); t.style.left = `calc(${ch.t / END * 100}% - 1px)`; $('ticks').appendChild(t); }
});
seekEl.max = END;
$('durLbl').textContent = `${Math.floor(END / 60)}분 ${Math.round(END % 60)}초`;
// 화면 누르기: 영어 문장을 누르면 발음 듣기, 빈 곳을 누르면 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * TS.W, (e.clientY - r.top) / r.height * TS.H]; };
const hitAt = (x, y) => started ? TS.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.say && EN.say.supported) { if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say && EN.say.supported ? '눌러서 발음 듣기: ' + h.say : ''; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-adv)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }   // 장면 첫 0.45초는 밝아지는 중이라 조금 뒤에서 멈춤

// 발음 듣기 단추(직접 해 보기·놀이터·연습 문제·용어집): 누르면 영상을 멈추고 읽음
EN.say.wire(document, { before() { if (playing) pause(); } });
machineInit();
EN.drill({
  root: $('drillRoot'), items: VT.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 3단계 풀이법이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09·10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '시간 단서로 시제를 고르는 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(TS.baseText()).then(() => { dirty = true; mDraw(); });
setTimeout(() => TS.collectText(text => loadFonts(text).then(() => { dirty = true; mDraw(); }), 8), 400);
requestAnimationFrame(loop);
})();
