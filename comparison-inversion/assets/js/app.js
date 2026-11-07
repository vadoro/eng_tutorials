/* 비교·가정법·도치 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(신호어 스위치), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(CI), 그림은 scenes.js(CIS)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const CI = window.CI, CIS = window.CIS, S = CIS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = CIS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cv = $('cv'), ctx = cv.getContext('2d');
CI.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = CIS.fonts;
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
  const ready = new Promise(res => CIS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '신호어가 짝을 부른다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { CIS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const cap = started ? CIS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = CIS.chapterAt(T);
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
  if (dirty) { dirty = false; CIS.render(ctx, started ? T : POSTER); }
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
const seg = (name, items, cur, attr = 'v') => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${esc(t)}</button>`).join('')}</div>`;
const enLine = (text, cls = '') => `<p class="enline ${cls}">${sayBtn(text)}<span lang="en">${esc(text)}</span></p>`;
// 연습 문제 하나를 직접 해 보기용 빈칸 문제로 (보기 단추 → 규칙 엔진으로 채점)
function miniQ(i) {
  const it = CI.DRILL[i];
  return `<div class="mini" data-q="${i}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map(([w], k) => `<button type="button" data-k="${k}">${esc(w)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
// 두 단추로 고르는 목록 (판정은 규칙 엔진)
const okList = (list, attr, yes, no) => `<ol class="gapq">${list.map((w, i) => `<li data-${attr}="${i}"><span lang="en" class="ph">${esc(w)}</span><span class="mo"><button type="button" data-yn="1">${esc(yes)}</button><button type="button" data-yn="0">${esc(no)}</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>`;
const STEPN = ['', '① 신호어', '② 짝', '③ 함정'];
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ(1)}
    <p class="note">맞든 틀리든 괜찮아요. 영상 09장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  forms: () => {
    const w = CI.FORMS01[S.word || 0], D = CI.adj(w);
    return `<h2>직접 해 보기</h2><h3>낱말을 바꿔 보기</h3>
      ${seg('낱말', CI.FORMS01.map((x, i) => [i, x]), S.word || 0, 'word')}
      <ul class="pairs">${D.f.map((f, k) => `<li><span class="en1">${sayBtn(f)}<span lang="en"><b class="v">${esc(f)}</b></span></span><span class="ko1">${['원급', '비교급 (~보다 더)', '최상급 (가장)'][k]}</span></li>`).join('')}</ul>
      <p class="note">한국어는 ‘저것보다 ${esc(D.kf[2])}’, ‘가장 ${esc(D.kf[2])}’처럼 낱말 모양이 그대로예요.</p>
      <h3 class="mt">비교 표시를 한 번만 했을까?</h3>${okList(CI.SORT_DBL.map(x => x[0]), 'db', '맞는 모양', '틀린 모양')}`;
  },
  asthan: () => {
    const k = S.f02, w = k === 'less' ? 'expensive' : 'light';
    return `<h2>직접 해 보기</h2><h3>신호어 바꿔 보기</h3>
      ${seg('신호어', [['', '영상대로'], ['as', 'as … as'], ['than', 'than'], ['less', 'less … than']], k || '', 'f02')}
      ${k ? enLine(CI.sentence(CI.fam('cmp'), CI.frameOf('cmp', k), w), 'small') : ''}
      <p class="note">신호어를 바꾸면 빈칸의 모양이 바뀌어요. 더 많은 낱말과 신호어는 아래 <a href="#playground">놀이터</a>에서 바꿔 볼 수 있어요.</p>
      ${miniQ(2)}${miniQ(3)}`;
  },
  strong: () => `<h2>직접 해 보기</h2><h3>비교급 larger 앞에 올 수 있을까?</h3>${okList(CI.SORT_INT.map(w => w + ' larger'), 'in', '올 수 있어요', '안 돼요')}${miniQ(7)}`,
  sup: () => `<h2>직접 해 보기</h2><h3>최상급과 the 비교급</h3>${miniQ(5)}${miniQ(6)}
    <p class="note">one of the + 최상급 뒤의 명사는 늘 복수예요. 앞에 The + 비교급이 보이면 뒤에도 the + 비교급이 와요.</p>`,
  cond: () => {
    const k = S.cond;
    return `<h2>직접 해 보기</h2><h3>if절을 바꿔 보기</h3>
      ${seg('if절', [['', '영상대로']].concat(CI.fam('cond').frames.slice(0, 3).map(f => [f.k, f.name])), k || '', 'cond')}
      ${k ? enLine(CI.sentence(CI.fam('cond'), CI.frameOf('cond', k)), 'small') + `<p class="note">${esc(CI.frameOf('cond', k).ko())}</p>` : ''}
      <p class="note">if절의 시제가 한 칸씩 뒤로 갈 때마다 주절도 짝을 맞춰 바뀌어요: will → would → would have.</p>${miniQ(11)}`;
  },
  ifless: () => `<h2>직접 해 보기</h2><h3>if를 되살려 보기</h3>
    ${seg('보기', [['0', '도치 (영상대로)'], ['1', 'if 되살리기']], S.ifback ? '1' : '0', 'ifback')}
    <ul class="pairs">${CI.INV3.map(r => `<li><span class="en1">${sayBtn(CI.text(S.ifback ? r.a : r.b))}<span lang="en">${esc(CI.text(S.ifback ? r.a : r.b))}</span></span><span class="ko1">${esc(r.pair)} · ${esc(r.ko)}</span></li>`).join('')}</ul>
    ${miniQ(8)}`,
  neg: () => {
    const k = S.neg;
    return `<h2>직접 해 보기</h2><h3>맨 앞을 바꿔 보기</h3>
      ${seg('맨 앞', [['', '영상대로']].concat(CI.fam('inv').frames.map(f => [f.k, f.name])), k || '', 'neg')}
      ${k ? enLine(CI.sentence(CI.fam('inv'), CI.frameOf('inv', k)), 'small') : ''}
      <p class="note">맨 앞이 부정어 · only가 아니면 보통 어순(we will announce), 맞으면 도치(will we announce)예요.</p>${miniQ(13)}${miniQ(14)}`;
  },
  method: () => {
    const P = S.sig ? CI.SIGNALS.find(s => s.k === S.sig) : null;
    let out = '';
    if (P) {
      const jg = CI.judge(P.good, P.c), jb = CI.judge(P.bad, P.c);
      out = `<p class="verdict"><b class="c-ok">짝: ${esc(P.pair)}</b></p>${enLine(P.ex, 'small')}
        <p class="note">${esc(jg.why)}</p><p class="verdict"><b class="c-no">함정: ${esc(P.trap)}</b> <small>${esc(STEPN[jb.step])}에서 탈락 · ${esc(jb.why)}</small></p>`;
    }
    return `<h2>직접 해 보기</h2><h3>신호어 → 짝 → 함정</h3>
      <p class="note">신호어를 고르면 흐름도에 길이 켜지고, 그 신호어가 부르는 짝과 대표 함정이 나와요. 판정은 규칙 엔진이 해요.</p>
      <div class="pick"><span>① 신호어</span><select id="labSig" class="sel"><option value="">고르기</option>${CI.SIGNALS.map(s => `<option value="${s.k}"${S.sig === s.k ? ' selected' : ''}>${esc(s.sig)}</option>`).join('')}</select></div>
      ${out}${S.sig ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${CI.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 신호어 스위치</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${CI.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showAt(u) { const ch = CHAPTERS[CIS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const mark = (li, b, ok, msg) => {
  li.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
  b.classList.add(ok ? 'right' : 'wrong');
  li.querySelector('.mr').textContent = msg;
  if (playing) pause();
};
// 직접 해 보기의 조작은 한곳에서 처리 (다시 만들어도 이어서 동작)
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[CIS.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { S.sig = null; touch(); buildLab(CIS.chapterAt(T)); return; }
  if (b.dataset.k != null) {                                // 빈칸 문제
    const box = b.closest('.mini'), it = CI.DRILL[+box.dataset.q], k = +b.dataset.k, j = CI.judgeOpt(it, k);
    mark(box, b, j.s === 'ok', CI.fixDots(`${CI.kindName(it.opts[k][1], CI.ctxOf(it))}. `) + (j.s === 'ok' ? '맞아요! ' : `아니에요(${STEPN[j.step]}에서 탈락). `) + j.why);
    return;
  }
  if (b.dataset.yn != null) {                               // 맞는 모양일까 · 올 수 있을까
    const li = b.closest('li'), say = b.dataset.yn === '1';
    let j;
    if (li.dataset.db != null) { const [, code, base] = CI.SORT_DBL[+li.dataset.db]; j = CI.once(code, base); }
    else j = CI.judge(CI.SORT_INT[+li.dataset.in], { f: 'int', cw: 'larger' });
    const ok = (j.s === 'ok') === say;
    mark(li, b, ok, (ok ? '맞아요. ' : '다시 보세요. ') + j.why);
    return;
  }
  if (b.dataset.word != null) { S.word = +b.dataset.word; showAt(9.6); }
  else if (b.dataset.f02 != null) { S.f02 = b.dataset.f02 || null; showAt(8.6); }
  else if (b.dataset.cond != null) { S.cond = b.dataset.cond || null; showAt(S.cond ? 14.6 : 21); }
  else if (b.dataset.ifback != null) { S.ifback = b.dataset.ifback === '1'; showAt(S.ifback ? 1 : 21); }
  else if (b.dataset.neg != null) { S.neg = b.dataset.neg || null; showAt(S.neg ? 1 : 13); }
  else return;
  touch(); buildLab(CIS.chapterAt(T));
});
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'labSig') { S.sig = t.value || null; showAt(25); }
  else return;
  touch(); buildLab(CIS.chapterAt(T));
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // (A)~(D)는 한국어 이름으로, p.p.는 ‘과거분사’, -er · -or · -est는 글자 이름으로, = · +는 쉼으로
  read: [[/p\.p\./g, '과거분사'], [/-er\b/g, '이알'], [/-or\b/g, '오알'], [/-est\b/g, '이에스티'],
    [/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/ = /g, ', '], [/ \+ /g, ', '], [/TOEIC/g, '토익'], [/Part 5/g, '파트 5']],
  rate: () => speed,
  holdBefore: 0.05,
  clips: window.EN_CLIPS,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 — 신호어 스위치
   ========================================================= */
const SX = { fi: 0, ki: 0, wi: 0, guess: true, pick: null, view: null, tries: 0, hits: 0, sw: 1000, A: null, t0: 0, raf: 0 };
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const stageCv = $('sStage'), stageG = stageCv.getContext('2d');
function sCur() {
  const Fm = CI.SW[SX.fi], fr = Fm.frames[SX.ki], ws = CI.wordsFor(Fm, fr), w = Fm.words ? Fm.words[SX.wi] : null;
  const C = CI.cands(Fm, fr, w);
  return { Fm, fr, w, ws, C, right: C.findIndex(x => x.j.s === 'ok') };
}
const revealed = () => !SX.guess || SX.pick != null;
const fillOf = () => SX.view != null ? SX.view : revealed() ? 'ans' : null;
const stageToks = () => { const { Fm, fr, w } = sCur(); return CI.build(Fm, fr, w, fillOf()); };
function sDraw() {
  const { fr, C, right } = sCur(), f = fillOf(), p = reduce || !SX.A ? 1 : clamp((performance.now() - SX.t0) / 700);
  const ci = f === 'ans' ? right : f, minW = Math.max(...C.map(x => x.w.length)) * 0.56 + 0.8;
  CIS.stage(stageG, { w: SX.sw, A: SX.A, B: stageToks(), p, fr, minW, need: revealed() ? C[right].kind : '?', ok: ci == null ? null : C[ci].j.s === 'ok' });
  if (p < 1) SX.raf = requestAnimationFrame(sDraw); else SX.A = null;
}
// from: 움직이기 시작할 토큰 (없으면 움직이지 않음)
function sBuild(from) {
  const { Fm, fr, w, ws, C, right } = sCur(), shown = revealed();
  $('sFam').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === SX.fi)));
  $('sSig').innerHTML = Fm.frames.map((f, i) => `<button type="button" data-i="${i}" aria-pressed="${i === SX.ki}"><span lang="en">${esc(f.name)}</span></button>`).join('');
  $('sWordRow').hidden = !Fm.words;
  if (Fm.words) $('sWord').innerHTML = Fm.words.map((x, i) => `<button type="button" data-i="${i}" aria-pressed="${i === SX.wi}"${ws.includes(x) ? '' : ' disabled title="이 신호어와는 어색해서 빼 두었어요"'}><span lang="en">${esc(x)}</span></button>`).join('');
  $('sNote').textContent = Fm.note;
  $('sCands').innerHTML = C.map((x, k) => {
    const ok = x.j.s === 'ok', st = shown ? (ok ? ' right' : ' wrong') : '', cur = SX.view === k ? ' picked' : '';
    return `<div class="scand${st}${cur}"><button type="button" class="schoose" data-k="${k}" aria-label="${k + 1}번 ${esc(x.w)} 넣어 보기"><b>${k + 1}</b> <span lang="en">${esc(x.w)}</span>${shown ? `<small>${esc(x.kind)}</small>` : ''}</button>` +
      (shown ? `<p class="swhy">${ok ? '<span class="sok">맞아요</span>' : `<span class="sno">× ${esc(STEPN[x.j.step])}에서 탈락</span>`} ${esc(x.j.why)}</p>` : '') + '</div>';
  }).join('');
  $('sSteps').innerHTML = shown ? CI.swSteps(Fm, fr, w).map(s => `<li>${esc(s)}</li>`).join('') : '';
  $('sSteps').hidden = !shown;
  const full = CI.sentence(Fm, fr, w);
  $('sKo').innerHTML = shown ? `${sayBtn(full)}<span><span lang="en">${esc(full)}</span><br>${esc(fr.ko(w))}</span>` : '<span>후보 가운데 빈칸에 맞는 것을 골라 보세요. 보라색 밑줄이 신호어예요.</span>';
  $('sScore').textContent = SX.tries ? `한 번에 맞힘 ${SX.hits} / ${SX.tries}` : '';
  cancelAnimationFrame(SX.raf);
  SX.A = from || null; SX.t0 = performance.now();
  sDraw();
}
// 틀·낱말·갈래 바꾸기. 같은 갈래 안에서는 토큰이 미끄러지며 바뀜
function sSet(o) {
  const before = stageToks(), sameFam = o.fi == null || o.fi === SX.fi;
  if (o.fi != null) { SX.fi = (o.fi + CI.SW.length) % CI.SW.length; SX.ki = 0; SX.wi = 0; }
  if (o.ki != null) SX.ki = (o.ki + CI.SW[SX.fi].frames.length) % CI.SW[SX.fi].frames.length;
  const Fm = CI.SW[SX.fi], fr = Fm.frames[SX.ki];
  if (o.wi != null && Fm.words) SX.wi = (o.wi + Fm.words.length) % Fm.words.length;
  if (Fm.words) {                                           // 이 신호어와 어색한 낱말이면 쓸 수 있는 낱말로
    const ws = CI.wordsFor(Fm, fr);
    if (!ws.includes(Fm.words[SX.wi])) {
      if (o.wi != null) { let k = SX.wi; do { k = (k + (o.step || 1) + Fm.words.length) % Fm.words.length; } while (!ws.includes(Fm.words[k])); SX.wi = k; }
      else SX.wi = Fm.words.indexOf(ws[0]);
    }
  }
  SX.pick = null; SX.view = null;
  sBuild(sameFam ? before : null); keepFocus();
}
function keepFocus() { if (!$('sw').contains(document.activeElement)) $('sw').focus({ preventScroll: true }); }
function sPick(k) {
  const { C } = sCur();
  if (k < 0 || k >= C.length) return;
  if (SX.guess && SX.pick == null) { SX.pick = k; SX.tries++; if (C[k].j.s === 'ok') SX.hits++; }
  SX.view = SX.view === k && !SX.guess ? null : k;
  sBuild();
  const f = $('sKo').querySelector('[data-say]'); if (f && SX.guess && SX.tries && SX.pick === k) f.focus({ preventScroll: true }); else keepFocus();
}
function sResize() {
  const r = stageCv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  SX.sw = r.width < 560 ? CIS.STAGE.nw : CIS.STAGE.w;       // 좁은 화면에서는 그림을 덜 줄여 글자를 읽을 수 있게
  const sh = SX.sw < 800 ? CIS.STAGE.nh : CIS.STAGE.h;
  stageCv.style.aspectRatio = `${SX.sw} / ${sh}`;
  stageCv.width = Math.max(1, Math.round(r.width * d)); stageCv.height = Math.max(1, Math.round(r.width * d * sh / SX.sw));
  SX.A = null; sDraw();
}
function swInit() {
  $('sFam').innerHTML = CI.SW.map((Fm, i) => `<button type="button" data-i="${i}" aria-pressed="false">${esc(Fm.name)}</button>`).join('');
  $('sFam').addEventListener('click', e => { const b = e.target.closest('button'); if (b) sSet({ fi: +b.dataset.i }); });
  $('sSig').addEventListener('click', e => { const b = e.target.closest('button'); if (b) sSet({ ki: +b.dataset.i }); });
  $('sWord').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) sSet({ wi: +b.dataset.i }); });
  $('sCands').addEventListener('click', e => { const b = e.target.closest('.schoose'); if (b) sPick(+b.dataset.k); });
  $('sGuess').addEventListener('change', e => { SX.guess = e.target.checked; SX.pick = null; SX.view = null; sBuild(); });
  $('sw').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('input, select'))) return;
    const k = e.key.toLowerCase();
    if (/^[1-5]$/.test(k)) { e.preventDefault(); sPick(+k - 1); }
    else if (k === 'n' && CI.SW[SX.fi].words) { e.preventDefault(); sSet({ wi: SX.wi + 1 }); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); sSet({ ki: SX.ki + 1 }); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); sSet({ ki: SX.ki - 1 }); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sSet({ fi: SX.fi + 1 }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sSet({ fi: SX.fi - 1 }); }
  });
  new ResizeObserver(sResize).observe(stageCv);
  sResize(); sBuild();
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', sig: '#C9A7FF', p: '#FFC15E', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// 문장 속 네 조각에 A~D를 붙인 그림 문제 (조각을 누르거나 단추로 고름). parts: [글자, 보기 번호, 답한 뒤의 색 역할]
function wordFig(parts, label) {
  let boxes = [];
  return {
    width: 600, height: 150, label,
    pick: (x, y) => boxes.findIndex(b => b && x >= b.x - 4 && x <= b.x + b.w + 4 && y >= 40 && y <= 125),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 150);
      let size = 22; g.font = qfont(size, 600);
      const sp = 9, punct = w => /^[.,]$/.test(w), width = () => parts.reduce((s, [w]) => s + g.measureText(w).width + (punct(w) ? 0 : sp), 0);
      while (width() > 570 && size > 13) { size--; g.font = qfont(size, 600); }
      let x = (600 - width()) / 2; boxes = [];
      g.textBaseline = 'middle';
      parts.forEach(([w, k, role]) => {
        if (punct(w)) x -= sp;
        g.font = qfont(size, 600);
        const ww = g.measureText(w).width, on = st.done && k === st.answer, wrong = st.done && k >= 0 && k === st.pick && k !== st.answer;
        if (k >= 0) {
          boxes[k] = { x, w: ww };
          if (st.hover === k || on || wrong) { rrq(g, x - 4, 74, ww + 8, 36, 6); g.fillStyle = on ? 'rgba(255,193,94,0.22)' : wrong ? 'rgba(255,142,142,0.2)' : QCOL.hover; g.fill(); }
          g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.fillText('ABCD'[k], x + ww / 2, 50);
          g.font = qfont(size, 600);
        }
        g.textAlign = 'left'; g.fillStyle = st.done && role ? QCOL[role] : QCOL.text; g.fillText(w, x, 92);
        x += ww + sp;
      });
    },
  };
}
const FIG_ONEOF = wordFig([['Hanbit is', -1], ['one of', 0, 'sig'], ['the largest', 1], ['supplier', 2, 'bad'], ['in Asia', 3], ['.', -1]],
  '문장 Hanbit is one of the largest supplier in Asia. 네 조각 one of, the largest, supplier, in Asia에 A부터 D까지 표시된 그림');
const FIG_ONLY = wordFig([['Only after', 0, 'sig'], ['the review', 1], ['we will', 2, 'bad'], ['announce', 3], ['the results', -1], ['.', -1]],
  '문장 Only after the review we will announce the results. 네 조각 Only after, the review, we will, announce에 A부터 D까지 표시된 그림');
const QS = (() => {
  // 보기마다 code를 붙여 규칙 엔진으로 정답을 확인
  const by = (codes, c) => codes.map(code => CI.judge(code, c).s === 'ok').join();
  const q = [
    { q: '한국어 ‘이 노트북은 저것보다 가볍다’를 영어로 옮길 때, 한국어와 달리 영어에서 일어나는 일은?', opts: ['‘보다’에 해당하는 조사 하나만 붙여요.', '형용사 앞에 very를 붙여요.', '주어와 동사의 자리가 바뀌어요.', '형용사의 모양이 바뀌고(light → lighter) than이 짝으로 와요.'], a: 3,
      why: '한국어는 ‘가볍다’ 모양을 그대로 두고 ‘보다’를 붙이지만, 영어는 light → lighter로 낱말 모양이 바뀌고 짝 than이 와요 → This laptop is lighter than that one.' },
    { q: '비교 표시를 바르게 한 번만 한 것은?', opts: ['more lighter', 'most best', 'more reliable', 'more better'], a: 2,
      why: 'reliable처럼 긴 낱말은 앞에 more를 한 번 붙여요. lighter · best · better는 이미 비교급 · 최상급이라 more · most를 또 붙이면 비교 표시가 두 번이에요.',
      check: () => [['more lighter', 'dbl', 'light'], ['most best', 'dbl', 'good'], ['more reliable', 'cmp', 'reliable'], ['more better', 'dbl', 'good']].map(([, c, b]) => CI.once(c, b).s === 'ok').join() === 'false,false,true,false' },
    { q: 'The new copier is as ___ as the old one, but it costs less. 빈칸에 알맞은 말은?', opts: ['reliable', 'more reliable', 'most reliable', 'reliably'], a: 0,
      why: 'as … as 사이에는 원급이 와요. be동사 is 뒤의 보어 자리라서 형용사 reliable. as more reliable as는 짝이 어긋난 모양이에요.',
      check: () => by(['a.pos', 'a.cmp', 'a.sup', 'r.pos'], { f: 'deg', sk: 'as', p: 'a', base: 'reliable', slot: '보어' }) === 'true,false,false,false' },
    { q: '비교급 larger 앞에 올 수 없는 말은?', opts: ['much', 'even', 'far', 'very'], a: 3,
      why: 'very는 ‘매우’라는 뜻으로 원급만 꾸며요(very large). 비교급을 ‘훨씬’ 세게 할 때는 much · even · far · still · a lot을 써요.',
      check: () => by(['much', 'even', 'far', 'very'], { f: 'int', cw: 'larger' }) === 'true,true,true,false' },
    { q: 'Our service is superior ___ that of our competitors. 빈칸에 알맞은 말은?', opts: ['than', 'to', 'as', 'with'], a: 1,
      why: 'superior · inferior · prior · senior는 -or로 끝나는 라틴어 비교급이라 than이 아니라 to와 짝이에요 → superior to.',
      check: () => by(['than', 'to', 'as', 'with'], { f: 'part', sk: 'latin', sig: 'superior' }) === 'false,true,false,false' },
    { q: '‘Hanbit is one of the largest supplier in Asia.’ 틀린 곳은 어디일까요? 조각을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_ONEOF,
      why: 'one of the + 최상급 뒤에는 복수 명사가 와요(여럿 가운데 하나) → one of the largest suppliers. 한국어 ‘가장 큰 업체 중 하나’에는 복수 표시가 없어서 놓치기 쉬워요.',
      check: () => CI.judge('n.sg', { f: 'noun', sig: 'one of the largest' }).s === 'no' && CI.judge('n.pl', { f: 'noun', sig: 'one of the largest' }).s === 'ok' },
    { q: 'If we had more staff, we ___ the project on time. 빈칸에 알맞은 말은?', opts: ['will finish', 'would finish', 'would have finished', 'had finished'], a: 1,
      why: 'if절이 과거형(had) → 지금 사실의 반대(가정법 과거) → 주절은 would + 원형. 가정법에는 will을 쓰지 않고, would have finished는 지난 일의 반대에 써요.',
      check: () => by(['will', 'would', 'wouldhave', 'had'], { f: 'cond', side: 'main', mood: 'now', sig: 'If we had' }) === 'false,true,false,false' },
    { q: '‘Had we known about the delay, we would have called you.’와 뜻이 같은 문장은?', opts: ['If we knew about the delay, …', 'If we had known about the delay, …', 'If we have known about the delay, …', 'When we knew about the delay, …'], a: 1,
      why: '맨 앞의 Had + 주어 + p.p.는 if가 빠진 도치예요. if를 되살리면 → If we had known(지난 일의 반대). 주절의 would have called와도 짝이 맞아요.',
      check: () => CI.judge('Had', { f: 'front', after: 'pp', subj: 'we', rest: 'known' }).s === 'ok' },
    { q: '‘Only after the review we will announce the results.’ 틀린 곳은 어디일까요? 조각을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_ONLY,
      why: '맨 앞에 Only after …가 오면 뒤는 조동사 + 주어 어순이에요 → Only after the review will we announce the results. we will은 보통 어순이라 틀려요.',
      check: () => CI.judge('plain', { f: 'neg', front: 'neg', sig: 'Only after the review' }).s === 'no' && CI.judge('inv', { f: 'neg', front: 'neg', sig: 'Only after the review' }).s === 'ok' },
    { q: 'Mr. Lee cannot attend the meeting, and neither ___ Ms. Cho. 빈칸에 알맞은 말은?', opts: ['can', 'does', 'is', 'has'], a: 0,
      why: 'neither + 조동사 + 주어 = ‘~도 그래요(못 해요)’. 앞 절의 동사가 조동사 can(cannot)이라서 짝도 can → neither can Ms. Cho.',
      check: () => by(['can', 'does', 'is', 'has'], { f: 'so', sig: 'and neither', prev: 'cannot attend', fam: 'modal', modal: 'can' }) === 'true,false,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[비교·도치] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[비교·도치] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
  const ci = CIS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * CIS.W, (e.clientY - r.top) / r.height * CIS.H]; };
const hitAt = (x, y) => started ? CIS.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.say && EN.say.supported) { if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say && EN.say.supported ? '눌러서 발음 듣기: ' + h.say : ''; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-neg)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }   // 장면 첫 0.45초는 밝아지는 중이라 조금 뒤에서 멈춤

// 발음 듣기 단추(직접 해 보기·놀이터·연습 문제·용어집): 누르면 영상을 멈추고 읽음
EN.say.wire(document, { before() { if (playing) pause(); } });
swInit();
EN.drill({
  root: $('drillRoot'), items: CI.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 3단계 풀이법이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 08·09장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '비교와 도치의 짝을 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(CIS.baseText()).then(() => { dirty = true; sResize(); });
setTimeout(() => CIS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
