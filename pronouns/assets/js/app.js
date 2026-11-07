/* 대명사 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(대명사 표 놀이터), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(PN), 그림은 scenes.js(PNS)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const PN = window.PN, PNS = window.PNS, S = PNS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = PNS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cv = $('cv'), ctx = cv.getContext('2d');
PN.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = PNS.fonts;
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
  const ready = new Promise(res => PNS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '가리키는 말이 줄을, 자리가 칸을 정한다 — 영어 튜토리얼',
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
  const cap = started ? PNS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = PNS.chapterAt(T);
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
  if (dirty) { dirty = false; PNS.render(ctx, started ? T : POSTER); }
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
const seg = (name, items, cur, attr = 'v') => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t, en]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${en ? `<span lang="en">${esc(t)}</span>` : esc(t)}</button>`).join('')}</div>`;
const enLine = (text, cls = '') => `<p class="enline ${cls}">${sayBtn(text)}<span lang="en">${esc(text)}</span></p>`;
// 연습 문제 하나를 직접 해 보기용 빈칸 문제로 (보기 단추 → 규칙 엔진으로 채점)
function miniQ(i) {
  const it = PN.DRILL[i];
  return `<div class="mini" data-q="${i}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map((w, k) => `<button type="button" data-k="${k}" lang="en">${esc(w)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
// 둘 가운데 고르는 문장 목록 (가리키는 말과 자리는 문장마다 데이터에 적어 둠)
const SORTS = { a: PN.SORT04, b: PN.SORT05, c: PN.SORT07 };
const sortList = key => `<ol class="gapq">${SORTS[key].map((it, i) => `<li data-so="${key}${i}">${it.ko ? `<span class="ko2">${esc(it.ko)}</span>` : ''}<span lang="en" class="ph long">${esc(it.q).replace('___', '<span class="blank sm">&nbsp;</span>')}</span><span class="mo">${it.opts.map((o, k) => `<button type="button" data-o="${k}" lang="en">${esc(o)}</button>`).join('')}</span><span class="mr" role="status"></span></li>`).join('')}</ol>`;
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ(12)}
    <p class="note">맞든 틀리든 괜찮아요. 영상 10장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  arrow: () => {
    const E = PN.ARROWS[S.s01 || 0];
    return `<h2>직접 해 보기</h2><h3>화살표 끝 찾기</h3>
      ${seg('문장', PN.ARROWS.map((e, i) => [i, `문장 ${i + 1}`]), S.s01 || 0, 's01')}
      ${enLine(E.s)}
      <ol class="gapq">${E.prs.map(([p], k) => `<li data-ar="${k}"><span class="ph">대명사 <b lang="en" class="v">${esc(p)}</b> →</span><span class="mo">${E.pick.map(a => `<button type="button" data-a="${esc(a)}" lang="en">${esc(a)}</button>`).join('')}</span><span class="mr" role="status"></span></li>`).join('')}</ol>
      <p class="note">한국어: ${E.ko.map(x => Array.isArray(x) ? `<s>(${esc(x[0])})</s>` : esc(x)).join('')} — 줄 그은 말은 한국어에서 흔히 빼요.</p>`;
  },
  rows: () => {
    const E = S.a02 != null ? PN.ROWS02[S.a02] : null, row = E ? E.row : null;
    return `<h2>직접 해 보기</h2><h3>가리키는 말 바꾸기</h3>
      ${seg('가리키는 말', [['', '영상대로']].concat(PN.ROWS02.map((e, i) => [i, e.a, true])), S.a02 == null ? '' : S.a02, 'a02')}
      ${E ? `${enLine(E.s)}<p class="note">${esc(E.a)} → ${esc(E.ko)} → <b lang="en">${esc(row)}</b> 줄. 이 줄의 다섯 모양이 모두 같은 대상을 가리켜요.</p>
        <ul class="pairs">${PN.CASES.map(cs => { const w = PN.cell(row, cs); return `<li><span class="en1">${w ? sayBtn(w) : ''}<span lang="en"><b class="v">${esc(w || '—')}</b></span></span><span class="ko1">${esc(PN.CASE[cs].name)}</span></li>`; }).join('')}</ul>`
      : '<p class="note">가리키는 말을 고르면 영상 속 표에서 그 줄이 켜지고, 오른쪽에 화살표가 그려져요.</p>'}
      <p class="note">회사 · 기관은 직원이 많아도 하나 → <b lang="en">it · its</b>. 사람이든 사물이든 여럿이면 → <b lang="en">they · their</b>.</p>`;
  },
  cols: () => `<h2>직접 해 보기</h2><h3>줄을 바꿔 보기</h3>
    ${seg('줄', ['they', 'she', 'it', 'we'].map(r => [r, r, true]), S.r03 || 'they', 'r03')}
    <p class="note">줄을 바꾸면 영상 속 네 칸의 모양과 예문이 바뀌어요. <b lang="en">her</b>처럼 목적격과 소유격의 모양이 같은 말도 있어요.</p>
    ${miniQ(0)}${miniQ(1)}`,
  alone: () => `<h2>직접 해 보기</h2><h3>뒤에 명사가 있나?</h3>${sortList('a')}${miniQ(2)}`,
  self: () => `<h2>직접 해 보기</h2><h3>같은 사람일까?</h3>
    ${seg('목적어', [['', '영상대로'], ['same', '주어와 같은 사람'], ['other', '다른 사람']], S.self05 || '', 'self05')}
    ${sortList('b')}${miniQ(3)}`,
  other: () => `<h2>직접 해 보기</h2><h3>몇 개 가운데?</h3>
    ${seg('무리', [['', '영상대로'], [2, '둘'], [3, '셋']], S.n06 || '', 'n06')}
    ${enLine(S.n06 === 3 ? 'We have three offices. One is in Seoul, another is in Busan, and the other is in Daegu.' : 'We have two offices. One is in Seoul, and the other is in Busan.', 'small')}
    ${miniQ(8)}`,
  others: () => `<h2>직접 해 보기</h2><h3>나머지 전부일까, 다른 몇몇일까?</h3>${sortList('c')}${miniQ(11)}`,
  that: () => {
    const E = S.c08 != null ? PN.CMP[S.c08] : null;
    return `<h2>직접 해 보기</h2><h3>되풀이 대신</h3>
      ${seg('비교 문장', [['', '영상대로']].concat(PN.CMP.map((e, i) => [i, e.head.replace(/^The /, ''), true])), S.c08 == null ? '' : S.c08, 'c08')}
      ${E ? `${enLine(E.s, 'small')}<p class="note">${esc(E.ko)} 가리키는 말 → <b lang="en">${esc(E.head)}</b>, ${E.w === 'that' ? '하나' : '여럿'}이라 <b lang="en">${esc(E.w)}</b>.</p>` : ''}
      ${miniQ(13)}${miniQ(15)}`;
  },
  method: () => {
    const P = S.path || {};
    const opt = (list, cur) => ['<option value="">고르기</option>'].concat(list.map(([k, v]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${esc(v)}</option>`)).join('');
    let out = '';
    if (P.row && P.slot && P.same) {
      const R = PN.decide(P.row, P.slot, P.same);
      out = R.ok ? `<p class="verdict"><b class="c-ok" lang="en">${esc(R.word)}</b> ${esc(R.text)}</p><p class="note">${esc(R.why)}</p>`
        : `<p class="verdict"><b class="c-no">이런 짝은 없어요.</b> ${esc(R.why)}</p>`;
    }
    return `<h2>직접 해 보기</h2><h3>대명사 표 판정기</h3>
      <p class="note">가리키는 말(줄), 빈칸의 자리(칸), 주어와 같은 사람인지를 고르면 흐름도에 길이 켜지고 알맞은 대명사가 나와요.</p>
      <div class="pick"><span>① 줄</span><select id="labR" class="sel">${opt(PN.ROWS.map(r => [r, `${r} — ${PN.ROW[r].who}`]), P.row)}</select></div>
      <div class="pick"><span>② 자리</span><select id="labS" class="sel">${opt(Object.entries(PN.SLOT), P.slot)}</select></div>
      <div class="pick"><span>③ 짝</span><select id="labM" class="sel">${opt([['no', '주어와 다른 사람 · 해당 없음'], ['yes', '주어와 같은 사람']], P.same)}</select></div>
      ${out}${S.path ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${PN.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 대명사 표 놀이터</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${PN.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showAt(u) { const ch = CHAPTERS[PNS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const markLi = (li, b, ok, msg) => {
  li.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
  b.classList.add(ok ? 'right' : 'wrong');
  li.querySelector('.mr').textContent = msg;
  if (playing) pause();
};
// 직접 해 보기의 조작은 한곳에서 처리 (다시 만들어도 이어서 동작)
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[PNS.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { S.path = null; touch(); buildLab(PNS.chapterAt(T)); return; }
  if (b.dataset.k != null) {                                // 빈칸 문제
    const box = b.closest('.mini'), it = PN.DRILL[+box.dataset.q], k = +b.dataset.k, j = PN.judgeOpt(it, k), nm = PN.kindName(it.opts[k]);
    markLi(box, b, j.s === 'ok', (j.s === 'ok' ? '맞아요! ' : '아니에요. ') + (nm && !j.why.startsWith(it.opts[k] + ' = ') ? nm + '. ' : '') + j.why);
    return;
  }
  if (b.dataset.o != null) {                                // 둘 가운데 고르기
    const li = b.closest('li'), key = li.dataset.so, it = SORTS[key[0]][+key.slice(1)], w = it.opts[+b.dataset.o], j = PN.judge(w, it.c);
    markLi(li, b, j.s === 'ok', (j.s === 'ok' ? '맞아요. ' : '다시 보세요. ') + j.why);
    return;
  }
  if (b.dataset.a != null) {                                // 화살표 끝 찾기
    const li = b.closest('li'), E = PN.ARROWS[S.s01 || 0], [p, ante, d] = E.prs[+li.dataset.ar], ok = b.dataset.a === ante;
    markLi(li, b, ok, ok ? `맞아요. ${p} → ${ante}. ${d}.` : `다시 보세요. ${p} → ${d}. 그런 말을 문장에서 찾아 화살표를 그려 보세요.`);
    return;
  }
  if (b.dataset.s01 != null) { S.s01 = +b.dataset.s01; showAt(13.4); }
  else if (b.dataset.a02 != null) { S.a02 = b.dataset.a02 === '' ? null : +b.dataset.a02; showAt(3); }
  else if (b.dataset.r03 != null) { S.r03 = b.dataset.r03; showAt(31); }
  else if (b.dataset.self05 != null) { S.self05 = b.dataset.self05 || null; showAt(1.2); }
  else if (b.dataset.n06 != null) { S.n06 = b.dataset.n06 ? +b.dataset.n06 : null; showAt(1.2); }
  else if (b.dataset.c08 != null) { S.c08 = b.dataset.c08 === '' ? null : +b.dataset.c08; showAt(1.2); }
  else return;
  touch(); buildLab(PNS.chapterAt(T));
});
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (!['labR', 'labS', 'labM'].includes(t.id)) return;
  const row = $('labR').value, slot = $('labS').value, same = $('labM').value;
  S.path = row || slot || same ? { row, slot, same } : null;   // 셋을 다 골라야 흐름도가 켜짐
  showAt(25);
  touch(); buildLab(PNS.chapterAt(T));
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // it’s는 its와 소리가 같아 it is로, (A)~(D)는 한국어 이름으로, -self는 ‘셀프’, =와 +는 쉼과 ‘플러스’로
  read: [[/it’s\b/g, 'it is'], [/It’s\b/g, 'It is'], [/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'], [/-self\b/g, ' 셀프'],
    [/ = /g, ', '], [/ \+ /g, ' 플러스 '], [/TOEIC/g, '토익'], [/Part 5/g, '파트 5']],
  rate: () => speed,
  holdBefore: 0.05,
  clips: window.EN_CLIPS,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 — 대명사 표 놀이터 (가리키는 말 × 문장 → 줄과 칸 고르기)
   ========================================================= */
const PG = { ai: 0, fi: 2, guess: true, pick: null, tries: 0, hits: 0, fr: 0, fc: 0, sw: 1000 };
const stageCv = $('pStage'), stageG = stageCv.getContext('2d');
const pCur = () => ({ A: PN.PG_ANTE[PG.ai], F: PN.PG_FRAMES[PG.fi] });
function pDraw() {
  const { A, F } = pCur(), shown = PG.pick || !PG.guess, R = shown ? PN.pgJudge(A, F, ...(PG.pick || [A.row, PN.want(PN.pgCtx(A, F))])) : null;
  PNS.stage(stageG, A, F, { w: PG.sw, reveal: !!shown, word: R ? (PG.pick ? R.word || '—' : R.right.word) : null, ok: R ? R.ok : null });
}
function pBuild() {
  const { A, F } = pCur(), c = PN.pgCtx(A, F), shown = PG.pick || !PG.guess;
  const rc = PN.want(c), R = shown ? PN.pgJudge(A, F, ...(PG.pick || [A.row, rc])) : null;
  $('pAnte').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === PG.ai)));
  $('pFrame').querySelectorAll('button').forEach((b, i) => { const ok = PN.pgOk(A, PN.PG_FRAMES[i]); b.setAttribute('aria-pressed', String(i === PG.fi)); b.disabled = !ok; b.title = ok ? '' : 'it 줄에는 소유대명사가 없어서 이 문장은 쓸 수 없어요'; });
  // 표: 고른 뒤에는 정답 줄(하늘) · 정답 칸(보라) · 정답(노랑) · 틀린 칸(빨강)
  $('pTable').querySelectorAll('[data-r]').forEach(el => {
    const r = el.dataset.r, cs = el.dataset.c;
    el.classList.toggle('rowlit', !!shown && r === c.row);
    el.classList.toggle('collit', !!shown && cs === rc);
    el.classList.toggle('right', !!shown && r === c.row && cs === rc);
    el.classList.toggle('wrong', !!PG.pick && PG.pick[0] === r && PG.pick[1] === cs && !(R && R.ok));
    el.classList.toggle('same', !!PG.pick && R && R.ok && PG.pick[0] === r && PG.pick[1] === cs && !(r === c.row && cs === rc));
  });
  $('pTable').querySelectorAll('.phd').forEach(el => el.classList.toggle('collit', !!shown && el.dataset.c === rc));
  $('pTable').querySelectorAll('.plb').forEach(el => el.classList.toggle('rowlit', !!shown && el.dataset.r === c.row));
  const st = PN.pgSteps(A, F);
  if (!shown) {
    $('pOut').innerHTML = `<p class="note">문장의 빈칸에 들어갈 대명사를 표에서 골라 보세요. 먼저 화살표를 그려 <b>줄</b>을 찾고, 빈칸의 자리로 <b>칸</b>을 찾아요.</p>`;
    $('pSteps').hidden = true;
  } else {
    const rowTxt = `가리키는 말 = ${c.ante} → ${PN.ROW[c.row].who} → ${c.row} 줄`;
    const colTxt = `${PN.slotName(c)} → ${PN.CASE[rc].name} 칸${F.same ? ' (주어와 같은 사람)' : ''}`;
    let head = '';
    if (PG.pick) {
      const [pr, pc] = PG.pick, pw = PN.cell(pr, pc);
      head = `<p class="pverdict ${R.ok ? 'c-ok' : 'c-no'}"><b>${R.ok ? '맞아요!' : '아쉬워요.'}</b> 고른 칸 → <span lang="en">${esc(pw || '(빈 칸)')}</span> (${esc(pr)} 줄 · ${esc(PN.CASE[pc].name)} 칸)</p>
        <ul class="pchecks"><li class="${R.rowOk ? 'c-ok' : 'c-no'}"><b>줄 ${R.rowOk ? '✓' : '×'}</b> ${esc(rowTxt)}</li><li class="${R.colOk || R.ok ? 'c-ok' : 'c-no'}"><b>칸 ${R.colOk ? '✓' : R.ok ? '✓' : '×'}</b> ${esc(colTxt)}</li></ul>
        ${R.ok && !R.colOk ? `<p class="note">낱말은 맞아요 → <b lang="en">${esc(pw)}</b>. ${esc(PN.CASE[pc].name)}과 ${esc(PN.CASE[rc].name)}의 모양이 같아서예요. 이 자리는 ${esc(PN.CASE[rc].name)} 칸이에요.</p>` : ''}
        ${!R.ok && pw ? `<p class="note">규칙 엔진: ${esc(R.j.why)}</p>` : ''}`;
    } else head = `<ul class="pchecks"><li class="c-ok"><b>줄</b> ${esc(rowTxt)}</li><li class="c-ok"><b>칸</b> ${esc(colTxt)}</li></ul>`;
    $('pOut').innerHTML = head + `<p class="enline">${sayBtn(R.text)}<span lang="en">${esc(R.text).replace(new RegExp('\\b' + R.right.word + '\\b'), m => `<u>${m}</u>`)}</span></p><p class="note">${esc(PN.pgKo(A, F))}</p>`;
    $('pSteps').innerHTML = st.map(s => `<li>${esc(s)}</li>`).join(''); $('pSteps').hidden = false;
  }
  $('pScore').textContent = PG.tries ? `한 번에 맞힘 ${PG.hits} / ${PG.tries}` : '';
  pDraw();
}
function pSet(ai, fi) {
  PG.ai = (ai + PN.PG_ANTE.length) % PN.PG_ANTE.length; PG.fi = (fi + PN.PG_FRAMES.length) % PN.PG_FRAMES.length;
  if (!PN.pgOk(PN.PG_ANTE[PG.ai], PN.PG_FRAMES[PG.fi])) PG.fi = PN.PG_FRAMES.findIndex(F => PN.pgOk(PN.PG_ANTE[PG.ai], F));
  PG.pick = null; pBuild();
}
function pRandom() {
  const all = [];
  PN.PG_ANTE.forEach((A, ai) => PN.PG_FRAMES.forEach((F, fi) => { if (PN.pgOk(A, F) && !(ai === PG.ai && fi === PG.fi)) all.push([ai, fi]); }));
  const [ai, fi] = all[Math.floor(Math.random() * all.length)];
  pSet(ai, fi);
}
function pPick(r, cs) {
  if (!PG.guess || PG.pick) return;
  const { A, F } = pCur(), R = PN.pgJudge(A, F, r, cs);
  PG.pick = [r, cs]; PG.tries++; if (R.ok) PG.hits++;
  pBuild();
}
// 표 안에서 방향키로 칸을 옮김 (초점은 한 칸에만: roving tabindex)
function pFocus(fr, fc, move) {
  PG.fr = clamp(fr, 0, PN.ROWS.length - 1); PG.fc = clamp(fc, 0, PN.CASES.length - 1);
  $('pTable').querySelectorAll('button[data-r]').forEach(b => { b.tabIndex = (b.dataset.r === PN.ROWS[PG.fr] && b.dataset.c === PN.CASES[PG.fc]) ? 0 : -1; });
  if (move) { const b = $('pTable').querySelector(`button[data-r="${PN.ROWS[PG.fr]}"][data-c="${PN.CASES[PG.fc]}"]`); if (b) b.focus({ preventScroll: true }); }
}
function pResize() {
  const r = stageCv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  PG.sw = r.width < 560 ? 620 : PNS.STAGE.w;                // 좁은 화면에서는 그림을 덜 줄여 글자를 읽을 수 있게
  const sh = PG.sw < 800 ? PNS.STAGE.nh : PNS.STAGE.h;
  stageCv.style.aspectRatio = `${PG.sw} / ${sh}`;
  stageCv.width = Math.max(1, Math.round(r.width * d)); stageCv.height = Math.max(1, Math.round(r.width * d * sh / PG.sw));
  pDraw();
}
function pgInit() {
  $('pAnte').innerHTML = PN.PG_ANTE.map((A, i) => `<button type="button" data-i="${i}" aria-pressed="false"><span lang="en">${esc(A.s)}</span></button>`).join('');
  $('pFrame').innerHTML = PN.PG_FRAMES.map((F, i) => `<button type="button" data-i="${i}" aria-pressed="false">${esc(F.name)}</button>`).join('');
  $('pTable').innerHTML = '<span class="pcorner" aria-hidden="true"></span>' + PN.CASES.map(cs => `<span class="phd" data-c="${cs}">${esc(PN.CASE[cs].name)}</span>`).join('') +
    PN.ROWS.map(r => `<span class="plb" data-r="${r}">${esc(PN.ROW[r].ko)}</span>` + PN.CASES.map(cs => { const w = PN.cell(r, cs); return `<button type="button" data-r="${r}" data-c="${cs}" tabindex="-1" lang="en" aria-label="${esc((w || '빈 칸') + ' — ' + r + ' 줄 · ' + PN.CASE[cs].name + ' 칸')}"${w ? '' : ' class="empty"'}>${esc(w || '—')}</button>`; }).join('')).join('');
  $('pAnte').addEventListener('click', e => { const b = e.target.closest('button'); if (b) pSet(+b.dataset.i, PG.fi); });
  $('pFrame').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) pSet(PG.ai, +b.dataset.i); });
  $('pTable').addEventListener('click', e => { const b = e.target.closest('button[data-r]'); if (!b) return; pFocus(PN.ROWS.indexOf(b.dataset.r), PN.CASES.indexOf(b.dataset.c)); pPick(b.dataset.r, b.dataset.c); });
  $('pGuess').addEventListener('change', e => { PG.guess = e.target.checked; PG.pick = null; pBuild(); });
  $('pNext').addEventListener('click', pRandom);
  $('pg').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('input, select'))) return;
    const inTable = e.target.closest && e.target.closest('#pTable');
    const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (mv && inTable) { e.preventDefault(); pFocus(PG.fr + mv[0], PG.fc + mv[1], true); }
    else if (e.key.toLowerCase() === 'n') { e.preventDefault(); pRandom(); pFocus(PG.fr, PG.fc, !!inTable); }
  });
  pFocus(0, 0);
  new ResizeObserver(pResize).observe(stageCv);
  pResize(); pBuild();
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', ante: '#6EC8FF', pr: '#FFC15E', verb: '#C9A7FF', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E', line: 'rgba(238,241,244,0.26)' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
const qkey = (g, k, x, y) => { g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], x, y); };
// 문장 속 덩어리에 A~C를 붙인 그림 문제. parts: [글자, 보기 번호, 역할, 늘 색칠]
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
      parts.forEach(([w, k, role, always]) => {
        if (punct(w)) x -= sp;
        g.font = qfont(size, 600);
        const ww = g.measureText(w).width, on = st.done && k === st.answer, wrong = st.done && k >= 0 && k === st.pick && k !== st.answer;
        if (k >= 0) {
          boxes[k] = { x, w: ww };
          if (st.hover === k || on || wrong) { rrq(g, x - 4, 74, ww + 8, 36, 6); g.fillStyle = on ? 'rgba(110,200,255,0.22)' : wrong ? 'rgba(255,142,142,0.2)' : QCOL.hover; g.fill(); }
          qkey(g, k, x + ww / 2, 50);
          g.font = qfont(size, 600);
        }
        g.textAlign = 'left'; g.fillStyle = (always || st.done) && role ? QCOL[role] : QCOL.text; g.fillText(w, x, 92);
        if (always && role) { g.fillRect(x, 92 + size * 0.56, ww, 2.5); }
        x += ww + sp;
      });
    },
  };
}
// 대명사 표의 한 줄 그림 문제: 칸 넷에 A~D
function rowFig(row, label) {
  const cs4 = ['subj', 'obj', 'poss', 'pron'], X0 = 18, CW = 124;
  return {
    width: 600, height: 150, label,
    pick: (x, y) => y >= 56 && y <= 128 && x >= X0 && x < X0 + CW * 4 ? Math.floor((x - X0) / CW) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 150);
      cs4.forEach((cs, k) => {
        const x = X0 + k * CW, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        qkey(g, k, x + CW / 2, 20);
        g.font = qfont(14, 700); g.fillStyle = QCOL.muted; g.fillText(PN.CASE[cs].name, x + CW / 2, 42);
        rrq(g, x + 8, 58, CW - 16, 66, 10);
        g.fillStyle = on ? 'rgba(255,193,94,0.22)' : wrong ? 'rgba(255,142,142,0.2)' : st.hover === k ? QCOL.hover : '#18202A'; g.fill();
        g.strokeStyle = on ? QCOL.pr : wrong ? QCOL.bad : QCOL.line; g.lineWidth = on || wrong ? 2.5 : 1.5; g.stroke();
        g.font = qfont(26, 700); g.fillStyle = on ? QCOL.pr : QCOL.text; g.fillText(PN.cell(row, cs), x + CW / 2, 92);
      });
      g.font = qfont(15, 600); g.fillStyle = QCOL.ante; g.textAlign = 'left'; g.fillText(`${row} 줄`, X0 + CW * 4 + 16, 92);
    },
  };
}
// 의자 그림 문제: A 무리 밖의 의자들 · B 고장 난 두 개 · C 무리 안의 나머지 넷
const FIG_CHAIRS = {
  width: 600, height: 170, label: '그림: 점선 상자 안에 의자 여섯 개(그 가운데 두 개는 고장 표시), 상자 밖 오른쪽에 의자 세 개. A는 상자 밖 의자들, B는 고장 난 두 개, C는 상자 안의 나머지 네 개',
  pick: (x, y) => y < 34 || y > 160 ? -1 : x > 452 && x < 596 ? 0 : x > 18 && x < 154 ? 1 : x >= 154 && x < 440 ? 2 : -1,
  draw(g, st) {
    g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 170);
    const reg = [[452, 596], [18, 154], [154, 440]];
    reg.forEach(([a, b], k) => {
      const on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
      if (st.hover === k || on || wrong) { rrq(g, a, 40, b - a, 116, 10); g.fillStyle = on ? 'rgba(255,193,94,0.18)' : wrong ? 'rgba(255,142,142,0.18)' : QCOL.hover; g.fill(); }
      qkey(g, k, (a + b) / 2, 22);
    });
    rrq(g, 18, 48, 422, 100, 12); g.setLineDash([6, 5]); g.strokeStyle = QCOL.ante; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
    g.font = qfont(13, 700); g.fillStyle = QCOL.ante; g.textAlign = 'left'; g.fillText('the six chairs', 28, 62);
    for (let k = 0; k < 6; k++) {
      const x = 52 + k * 68, y = 106, broken = k < 2;
      g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.fillStyle = '#202A36'; g.fill(); g.strokeStyle = broken ? QCOL.bad : QCOL.line; g.lineWidth = 2; g.stroke();
      if (broken) { g.strokeStyle = QCOL.bad; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 7, y - 7); g.lineTo(x + 7, y + 7); g.moveTo(x + 7, y - 7); g.lineTo(x - 7, y + 7); g.stroke(); }
    }
    [[490, 92], [540, 120], [566, 78]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fillStyle = '#202A36'; g.fill(); g.strokeStyle = QCOL.line; g.lineWidth = 2; g.stroke(); });
  },
};
const FIG_ARROW = wordFig([['Ms. Kim', 0], ['finished', -1], ['the report', 1, 'ante'], ['and', -1], ['sent', -1], ['it', -1, 'pr', true], ['to', -1], ['her manager', 2], ['.', -1]],
  '문장 Ms. Kim finished the report and sent it to her manager. 덩어리 셋에 A부터 C까지 표시되고 it에 밑줄이 있는 그림');
const FIG_ROW = rowFig('they', 'they 줄의 네 칸: A 주격 they, B 목적격 them, C 소유격 their, D 소유대명사 theirs');
const QS = (() => {
  const J = (w, c) => PN.judge(w, c).s === 'ok';
  const only = (opts, c, a) => opts.every((w, k) => J(w, c) === (k === a));
  const q = [
    { q: '‘Ms. Kim finished the report and sent it to her manager.’ 대명사 it → 무엇을 가리킬까요? 그림의 덩어리를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C'], a: 1, figure: FIG_ARROW,
      why: '화살표: it → the report. 김 씨가 보낸 것은 사물 하나(보고서)예요. 김 씨를 가리키는 대명사 → her.',
      check: () => PN.ARROWS[0].prs[0][1] === 'the report' },
    { q: '회사 이름(Hanbit Foods)을 대신하는 대명사는?', opts: ['he', 'they', 'it', 'we'], a: 2,
      why: '회사는 사람이 많이 일해도 하나 → it 줄(it · its · itself). 직원들(the employees)을 가리킬 때는 they 줄이에요.',
      check: () => only(['he', 'they', 'it', 'we'], { kind: 'case', row: 'it', slot: 'subj', ante: 'Hanbit Foods' }, 2) },
    { q: '‘The manager thanked ___ for the report.’ 가리키는 말 → the interns. 빈칸에 맞는 칸을 그림에서 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1, figure: FIG_ROW,
      why: 'the interns = 여럿 → they 줄. 동사 thanked 뒤 목적어 자리 → 목적격 칸 them.',
      check: () => only(['they', 'them', 'their', 'theirs'], { kind: 'case', row: 'they', slot: 'obj', ante: 'the interns', subj: 'The manager', cue: 'thanked' }, 1) },
    { q: '‘That umbrella isn’t mine. I think it’s ___.’ 가리키는 말 → Mr. Cho. 빈칸에 알맞은 말은?', opts: ['he', 'him', 'his', 'himself'], a: 2,
      why: '빈칸 뒤에 명사가 없고 ‘조 씨의 것’ → 소유대명사 his (소유격과 모양이 같아요). him은 목적격, himself는 주어와 같은 사람일 때만 써요.',
      check: () => only(['he', 'him', 'his', 'himself'], { kind: 'case', row: 'he', slot: 'alone', ante: 'Mr. Cho' }, 2) },
    { q: 'Ms. Ortiz taught ___ Spanish before she moved to Madrid. 빈칸에 알맞은 말은?', opts: ['she', 'her', 'hers', 'herself'], a: 3,
      why: '가르친 사람(주어)과 배운 사람(목적어)이 같은 사람 → herself. her를 쓰면 오르티스 씨가 아닌 다른 여자를 가르친 것이 돼요.',
      check: () => only(['she', 'her', 'hers', 'herself'], { kind: 'case', row: 'she', slot: 'obj', same: true, ante: 'Ms. Ortiz', subj: 'Ms. Ortiz', cue: 'taught' }, 3) },
    { q: '-self(재귀대명사)를 잘못 쓴 문장은?', opts: ['Mr. Okafor and myself will lead the session.', 'Mr. Tanaka built the website by himself.', 'Ms. Novak introduced herself to the staff.', 'Ms. Lopez will hand out the awards herself.'], a: 0,
      why: '주어 자리에는 -self가 못 와요 → Mr. Okafor and I. 나머지는 같은 사람(introduced herself), 혼자서(by himself), 강조(직접)라서 맞아요.',
      check: () => !J('myself', { kind: 'case', row: 'I', slot: 'subj', who: '나', cue: 'will lead' }) && J('himself', { kind: 'case', row: 'he', slot: 'obj', same: true, ante: 'Mr. Tanaka', subj: 'Mr. Tanaka', cue: 'by' })
        && J('herself', { kind: 'case', row: 'she', slot: 'obj', same: true, ante: 'Ms. Novak', subj: 'Ms. Novak', cue: 'introduced' }) && J('herself', { kind: 'case', row: 'she', slot: 'emph', ante: 'Ms. Lopez', subj: 'Ms. Lopez', cue: 'the awards' }) },
    { q: 'We interviewed two candidates. One had more experience, but ___ had better references. 빈칸에 알맞은 말은?', opts: ['another', 'the other', 'other', 'others'], a: 1,
      why: '둘 가운데 one 다음 남은 마지막 하나 → the other. another = 셋 이상일 때 쓰는 ‘또 하나’, other = 뒤에 명사가 필요, others = 여럿.',
      check: () => only(['another', 'the other', 'other', 'others'], { kind: 'ind', num: 1, slot: 'alone', def: true, set: 2, pair: 'One', what: '두 지원자 가운데 남은 한 명' }, 1) },
    { q: '‘Of the six chairs, two are broken, but the others are fine.’ the others → 그림의 어느 부분일까요? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C'], a: 2, figure: FIG_CHAIRS,
      why: '정해진 무리(의자 여섯 개)의 나머지 전부 → the others = 고장 나지 않은 네 개(C). 무리 밖의 다른 의자들(A)은 others예요.',
      check: () => J('the others', { kind: 'ind', num: 2, slot: 'alone', def: true, set: 6, what: '의자 여섯 개 가운데 남은 넷' }) && !J('others', { kind: 'ind', num: 2, slot: 'alone', def: true, set: 6, what: '' }) },
    { q: 'The population of Busan is larger than ___ of Daegu. 빈칸에 알맞은 말은?', opts: ['it', 'its', 'those', 'that'], a: 3,
      why: '가리키는 말 → population(하나). 되풀이 대신 that + of Daegu. 여럿이면 those, its 뒤에는 명사가 와야 하고, it 뒤에는 of 꾸밈말을 붙일 수 없어요.',
      check: () => only(['it', 'its', 'those', 'that'], { kind: 'dem', num: 1, slot: 'obj', post: 'of', ante: 'The population', cue: 'of Daegu' }, 3) },
    { q: '___ who arrive early will receive a free gift. 빈칸에 알맞은 말은?', opts: ['Those', 'They', 'Them', 'Their'], a: 0,
      why: '‘일찍 오는 사람들’ → Those who. who 절이 꾸밀 수 있는 대명사 → those (They ×, Them ×, Their ×).',
      check: () => only(['Those', 'They', 'Them', 'Their'], { kind: 'dem', num: 2, slot: 'subj', post: 'who', who: '일찍 오는 사람들', cue: 'who arrive' }, 0) },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[대명사] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[대명사] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
  return q;
})();

/* =========================================================
   8. 시작
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
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #drill, #quiz, #summary-table')) return;   // 아래 칸에서 누른 키는 영상을 건드리지 않음
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * PNS.W, (e.clientY - r.top) / r.height * PNS.H]; };
const hitAt = (x, y) => started ? PNS.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.say && EN.say.supported) { if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say && EN.say.supported ? '눌러서 발음 듣기: ' + h.say : ''; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-rows)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }   // 장면 첫 0.45초는 밝아지는 중이라 조금 뒤에서 멈춤

// 발음 듣기 단추(직접 해 보기·놀이터·연습 문제·용어집): 누르면 영상을 멈추고 읽음
EN.say.wire(document, { before() { if (playing) pause(); } });
pgInit();
EN.drill({
  root: $('drillRoot'), items: PN.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 3단계 풀이법이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09·10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '대명사의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(PNS.baseText()).then(() => { dirty = true; pResize(); });
setTimeout(() => PNS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
