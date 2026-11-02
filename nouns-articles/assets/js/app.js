/* 명사·관사·수량 표현 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(명사 검문소), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(NA), 그림은 scenes.js(NS)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const NA = window.NA, NS = window.NS, S = NS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = NS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cv = $('cv'), ctx = cv.getContext('2d');
NA.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = NS.fonts;
const FONT_SET = [[700, F.FD], [800, F.FD], [400, F.FB], [500, F.FB], [600, F.FB], [700, F.FB], [800, F.FB], [400, F.FM], [500, F.FM]];
const loadFonts = text => Promise.race([
  Promise.all(FONT_SET.map(([w, f]) => document.fonts.load(`${w} 20px ${f}`, text).catch(() => null))),
  new Promise(r => setTimeout(r, 15000)),
]).then(() => document.fonts.ready);

/* =========================================================
   2. 영상 추출 — 사이트 공통 렌더러가 쓰는 약속
   ========================================================= */
if (EXPORT) {
  cv.width = 1920; cv.height = 1080;
  const ready = new Promise(res => NS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '명사 검문소를 통과하라 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { NS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const cap = started ? NS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = NS.chapterAt(T);
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
  if (dirty) { dirty = false; NS.render(ctx, started ? T : POSTER); }
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
const seg = (name, items, cur) => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${esc(t)}</button>`).join('')}</div>`;
const enLine = (text, cls = '') => `<p class="enline ${cls}">${sayBtn(text)}<span lang="en">${esc(text)}</span></p>`;
// 명사구를 색 입힌 HTML로 (짝 보라 · 셀 수 있는 명사 하늘 · 셀 수 없는 명사 라임 · 복수 꼬리 노랑)
function phraseHTML(p) {
  return `<span class="ph" lang="en">${NA.parts(p).map(x => {
    const cls = x.r === 'det' || x.r === 'of' ? 'c-det' : x.r === 'u' ? 'c-u' : x.r === 'n' || x.r === 'hy' ? 'c-n' : '';
    if (x.tail) { const at = x.tailAt > 0 ? x.tailAt : x.t.length - x.tail.length; return `<b class="${cls}">${esc(x.t.slice(0, at))}<i class="tail">${esc(x.tail)}</i>${esc(x.t.slice(at + x.tail.length))}</b>`; }
    return `<b class="${cls}">${esc(x.t)}</b>`;
  }).join(' ')}</span>`;
}
// 세 문의 판정을 목록으로 (멈춘 문까지)
function gatesHTML(r) {
  return `<ol class="gl">${r.gates.map((G, i) => i > (r.fail < 0 ? 2 : r.fail) ? '' : `<li class="${G.ok ? 'ok' : 'no'}"><b>${esc(NA.GATE[i])}</b> <span class="lb">${esc(G.label)}</span> <span class="wy">${esc(G.why)}</span></li>`).join('')}</ol>`;
}
// 연습 문제 하나를 직접 해 보기용 빈칸 문제로 (보기 단추 → 규칙 엔진으로 채점)
function miniQ(i) {
  const it = NA.DRILL[i];
  return `<div class="mini" data-q="${i}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map(([w], k) => `<button type="button" data-k="${k}" lang="en">${esc(w)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
const SORT = ['suggestion', 'advice', 'furniture', 'chair', 'luggage', 'bag', 'machine', 'machinery', 'feedback', 'comment'];
const pgOptions = cur => NA.PG_ROWS.map(([g, ids]) => `<optgroup label="${esc(g)}">${ids.map(id => `<option value="${id}"${cur === id ? ' selected' : ''}>${esc(NA.PG[id].label)}</option>`).join('')}</optgroup>`).join('');
const nounOptions = cur => NA.PG_NOUNS.map(n => `<option value="${n}"${cur === n ? ' selected' : ''}>${esc(n)} (${esc(NA.noun(n).ko)})</option>`).join('');
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ(0)}
    <p class="note">맞든 틀리든 괜찮아요. 영상 09장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  korean: () => {
    const B = NS.BOOKS.find(b => b.key === S.book);
    return `<h2>직접 해 보기</h2><h3>어떤 책을 샀나요?</h3>
      ${seg('뜻 고르기', NS.BOOKS.map(b => [b.key, b.key === 'bare' ? '아무것도 안 밝힘' : b.tag]), S.book)}
      ${B ? `${enLine(B.s)}<p class="verdict"><b class="${NA.judgePhrase(B.p).s === 'ok' ? 'c-ok' : 'c-no'}">${NA.judgePhrase(B.p).s === 'ok' ? '맞는 문장' : '틀린 문장'}</b> ${esc(NA.judgePhrase(B.p).why)}</p>` : '<p class="note">뜻을 고르면 그 뜻의 영어 문장이 화면에 밝게 보여요.</p>'}
      <p class="note">한국어 ‘책’ 하나가 영어에서는 a book · the book · books로 갈라져요. 맨 명사 book은 쓸 수 없어요.</p>`;
  },
  gate: () => {
    const r = S.run != null ? NA.judgePhrase(NS.RUNS[S.run]) : null;
    return `<h2>직접 해 보기</h2><h3>검문소에 보내 보기</h3>
      <div class="seg runs" role="group" aria-label="보낼 명사구">${NS.RUNS.map((p, i) => `<button type="button" data-run="${i}" aria-pressed="${String(S.run === i)}" lang="en">${esc(NA.text(p))}</button>`).join('')}</div>
      ${r ? `<div class="verdict">${phraseHTML(NS.RUNS[S.run])} → <b class="${r.s === 'ok' ? 'c-ok' : 'c-no'}">${r.s === 'ok' ? '통과' : NA.GATE[r.fail] + '에서 멈춤'}</b>${r.fix ? ` · 고친 말 ${phraseHTML(r.fix.p)}` : ''}</div>${gatesHTML(r)}
        <button class="btn ghost" type="button" id="labClear">처음 차 두 대로 돌아가기</button>` : '<p class="note">명사구를 고르면 화면의 검문소가 세 문을 차례로 판정해요.</p>'}`;
  },
  single: () => `<h2>직접 해 보기</h2><h3>셀 수 있는 단수의 짝</h3>${miniQ(1)}${miniQ(2)}`,
  uncount: () => `<h2>직접 해 보기</h2><h3>셀 수 있나, 없나?</h3>
    <p class="note">뜻이 비슷해도 셀 수 있는지가 달라요. 하나씩 골라 보세요.</p>
    <ol class="gapq">${SORT.map(w => `<li data-w="${w}">${sayBtn(w)}<span lang="en" class="wd">${esc(w)}</span><span class="mo"><button type="button" data-c="1">셀 수 있음</button><button type="button" data-c="0">셀 수 없음</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>`,
  pairs: () => `<h2>직접 해 보기</h2><h3>수량 표현과 명사의 짝</h3>${miniQ(6)}${miniQ(8)}`,
  most: () => `<h2>직접 해 보기</h2><h3>almost · most · most of</h3>${miniQ(10)}${miniQ(12)}`,
  hyphen: () => `<h2>직접 해 보기</h2><h3>숫자-하이픈 · another</h3>${miniQ(13)}${miniQ(14)}`,
  method: () => {
    const P = S.path, r = P ? NA.judgePhrase(P) : null, st = S.pathSel || { e: 'several', n: 'application', num: 'sg' };
    return `<h2>직접 해 보기</h2><h3>검문소 판정기</h3>
      <p class="note">짝과 명사, 모양을 고르면 흐름도에 길이 켜지고, 세 문의 판정이 나와요.</p>
      <div class="pick"><span>짝</span><select id="labE" class="sel">${pgOptions(st.e)}</select></div>
      <div class="pick"><span>명사</span><select id="labN" class="sel">${nounOptions(st.n)}</select></div>
      <div class="pick"><span>모양</span>${seg('모양', [['sg', '단수'], ['pl', '복수 (-s)']], st.num)}</div>
      ${r ? `<div class="verdict">${phraseHTML(P)} → <b class="${r.s === 'ok' ? 'c-ok' : 'c-no'}">${r.s === 'ok' ? '통과' : NA.GATE[r.fail] + '에서 멈춤'}</b>${r.fix ? ` · 고친 말 ${phraseHTML(r.fix.p)}` : ''}</div>${gatesHTML(r)}
        <button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>` : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${NA.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 명사 검문소: 짝과 명사를 골라 세 문을 지나 보기</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${NA.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 짝 표와 셀 수 없는 명사</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
// 직접 해 보기의 조작은 한곳에서 처리 (다시 만들어도 이어서 동작)
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = CHAPTERS[NS.chapterAt(T)].id;
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[NS.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { if (id === 'gate') S.run = null; else S.path = null; touch(); buildLab(NS.chapterAt(T)); return; }
  if (b.dataset.run != null) { S.run = +b.dataset.run; showAt(1); touch(); buildLab(NS.chapterAt(T)); return; }
  if (b.dataset.k != null) {                                // 빈칸 문제
    const box = b.closest('.mini'), it = NA.DRILL[+box.dataset.q], k = +b.dataset.k, j = NA.judgeOpt(it, k);
    box.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(j.s === 'ok' ? 'right' : 'wrong');
    box.querySelector('.mr').textContent = (j.s === 'ok' ? '맞아요! ' : '아니에요. ') + NA.note(j);
    if (playing) pause();
    return;
  }
  if (b.dataset.c != null) {                                // 셀 수 있나, 없나
    const li = b.closest('li'), n = NA.noun(li.dataset.w), ok = (b.dataset.c === '1') === n.c;
    li.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(ok ? 'right' : 'wrong');
    li.querySelector('.mr').textContent = (ok ? '맞아요. ' : '다시 보세요. ') + (n.c ? `${n.sg} (${n.ko}) → 셀 수 있어요. 복수 ${n.pl}.` : `${n.sg} (${n.ko}) → 셀 수 없어요. ${NA.pieceOf(n.id) ? `세려면 a ${NA.pieceOf(n.id)}.` : '-s 없이 써요.'}`);
    if (playing) pause();
    return;
  }
  const grp = b.closest('.seg'); if (!grp || b.dataset.v == null) return;
  if (id === 'korean') { S.book = S.book === b.dataset.v ? null : b.dataset.v; showAt(12.4); }
  else if (id === 'method') { S.pathSel = Object.assign(S.pathSel || { e: 'several', n: 'application' }, { num: b.dataset.v }); setPath(); showAt(24.5); }
  touch(); buildLab(NS.chapterAt(T));
});
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showAt(u) { const ch = CHAPTERS[NS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
function setPath() { const st = S.pathSel; S.path = NA.pgPhrase(st.e, st.n, st.num || 'sg'); }
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'labE' || t.id === 'labN') {
    S.pathSel = Object.assign(S.pathSel || { num: 'sg' }, { e: $('labE').value, n: $('labN').value });
    setPath(); showAt(24.5);
  } else return;
  touch(); buildLab(NS.chapterAt(T));
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // 복수 꼬리 -s는 한국어로 ‘에스’라고 읽음
  read: [[/(^|[\s(‘,])-s(?![A-Za-z])/g, '$1에스'], [/TOEIC/g, '토익'], [/Part 5/g, '파트 5']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 — 명사 검문소
   짝(한정사·수량 표현) · 명사 · 모양을 고르면 규칙 엔진이 세 문을 판정하고, 캔버스에서 차가 문을 지나감.
   ‘먼저 맞히기’를 켜면 무작위 명사구가 나오고, 통과할지 멈출지 먼저 고른 뒤 확인함.
   ========================================================= */
const G = { e: 'several', n: 'application', num: 'sg', guess: false, pick: null, score: 0, tries: 0, t0: 0, raf: 0 };
const gcv = $('gxCv'), gg = gcv.getContext('2d'), GH = 250;
let GW = 820;
const gPhrase = () => NA.pgPhrase(G.e, G.n, G.num);
function gDraw() {
  const r = gcv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), cssW = r.width || 820;
  GW = Math.round(clamp(cssW, 560, 900));
  const w = Math.max(1, Math.round(cssW * d)), h = Math.max(1, Math.round(w * GH / GW));
  if (gcv.width !== w || gcv.height !== h) { gcv.width = w; gcv.height = h; }
  const ar = `${GW} / ${GH}`; if (gcv.style.aspectRatio !== ar) gcv.style.aspectRatio = ar;
  gg.setTransform(gcv.width / GW, 0, 0, gcv.width / GW, 0, 0);
  const waiting = G.guess && G.pick == null;
  const s = waiting ? 0 : clamp((performance.now() - G.t0) / 2600) * 4;
  NS.pgDraw(gg, GW, GH, gPhrase(), s);
  if (!waiting && s < 4) { cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(gDraw); }
}
function gRender() {
  const p = gPhrase(), r = NA.judgePhrase(p), waiting = G.guess && G.pick == null;
  $('gxDet').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.e === G.e)));
  $('gxNoun').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.n === G.n)));
  $('gxNum').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === G.num)));
  $('gxPhrase').innerHTML = `${sayBtn(NA.text(p))}${phraseHTML(p)}`;
  if (waiting) $('gxWhy').innerHTML = '이 명사구는 검문소를 <b>통과</b>할까요, <b>멈출</b>까요? 단추를 누르거나 키보드 1(통과) · 2(멈춤)로 고르세요.';
  else {
    const verdict = G.guess ? `<b class="${(G.pick === 'ok') === (r.s === 'ok') ? 'c-ok' : 'c-no'}">${(G.pick === 'ok') === (r.s === 'ok') ? '맞혔어요!' : '아쉬워요.'}</b> ` : '';
    $('gxWhy').innerHTML = `${verdict}<b class="${r.s === 'ok' ? 'c-ok' : 'c-no'}">${r.s === 'ok' ? '통과' : esc(NA.GATE[r.fail]) + '에서 멈춤'}</b>${r.fix ? ` · 고친 말 ${phraseHTML(r.fix.p)} ${sayBtn(r.fix.text)}` : ''}${gatesHTML(r)}`;
  }
  // 이 명사(지금 모양)와 짝이 되는 말 (숫자-하이픈 줄은 빼고)
  const pass = NA.PG_ORDER.filter(e => e !== 'hy' && NA.judgePhrase(NA.pgPhrase(e, G.n, G.num)).s === 'ok');
  const n = NA.noun(G.n);
  $('gxPassHead').textContent = `${NA.form(G.n, G.num)} — 짝이 되는 말 ${pass.length}개`;
  $('gxPass').innerHTML = waiting ? '<span class="note">답을 고르면 보여요.</span>' : (!n.c && G.num === 'pl') ? `<span class="note">${esc(n.pl)} → 셀 수 없는 명사라서 어떤 짝과도 못 다녀요. 단수 모양으로 바꿔 보세요.</span>`
    : pass.map(e => `<button type="button" class="pc" data-e="${e}" lang="en">${esc(NA.PG[e].label)}</button>`).join('');
  $('gxScore').textContent = G.guess ? `맞힌 수 ${G.score} / ${G.tries}` : '';
  $('gxGuessBtns').hidden = !G.guess;
  $('gxYes').disabled = $('gxNo').disabled = !waiting;
  $('gxNext').hidden = !G.guess || waiting;
  G.t0 = performance.now(); cancelAnimationFrame(G.raf); gDraw();
}
function gRandom() {
  // 통과하는 것과 멈추는 것이 반쯤씩 나오게
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const want = Math.random() < 0.5;
  for (let k = 0; k < 200; k++) {
    const e = pick(NA.PG_ORDER), n = pick(NA.PG_NOUNS), num = Math.random() < 0.5 ? 'sg' : 'pl';
    if (e === 'hy' && !NA.noun(n).unit) continue;
    if ((NA.judgePhrase(NA.pgPhrase(e, n, num)).s === 'ok') !== want) continue;
    if (e === G.e && n === G.n && num === G.num) continue;
    Object.assign(G, { e, n, num }); break;
  }
  G.pick = null; gRender();
  if (G.guess) $('gx').focus({ preventScroll: true });   // 숨겨진 ‘다음 문제’ 단추에 초점이 남지 않게
}
function gAnswer(ok) {
  if (!G.guess || G.pick != null) return;
  G.pick = ok ? 'ok' : 'no'; G.tries++;
  if ((G.pick === 'ok') === (NA.judgePhrase(gPhrase()).s === 'ok')) G.score++;
  gRender(); $('gxNext').focus({ preventScroll: true });
}
function gStep(key, dir) {
  if (key === 'e') { const L = NA.PG_ORDER, i = L.indexOf(G.e); G.e = L[(i + dir + L.length) % L.length]; }
  else { const L = NA.PG_NOUNS, i = L.indexOf(G.n); G.n = L[(i + dir + L.length) % L.length]; }
  G.pick = null; gRender();
}
function gateInit() {
  $('gxDet').innerHTML = NA.PG_ROWS.map(([g, ids]) => `<div class="drow"><span class="dh">${esc(g)}</span>${ids.map(e => `<button type="button" data-e="${e}" lang="en">${esc(NA.PG[e].label)}</button>`).join('')}</div>`).join('');
  $('gxNoun').innerHTML = NA.PG_NOUNS.map(n => `<button type="button" data-n="${n}" lang="en" class="${NA.noun(n).c ? 'c-n' : 'c-u'}">${esc(n)}</button>`).join('');
  $('gxDet').addEventListener('click', e => { const b = e.target.closest('button[data-e]'); if (!b) return; G.e = b.dataset.e; if (G.guess) G.guess = $('gxGuess').checked = false; G.pick = null; gRender(); });
  $('gxNoun').addEventListener('click', e => { const b = e.target.closest('button[data-n]'); if (!b) return; G.n = b.dataset.n; if (G.guess) G.guess = $('gxGuess').checked = false; G.pick = null; gRender(); });
  $('gxNum').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; G.num = b.dataset.v; if (G.guess) G.guess = $('gxGuess').checked = false; G.pick = null; gRender(); });
  $('gxPass').addEventListener('click', e => { const b = e.target.closest('button[data-e]'); if (!b) return; G.e = b.dataset.e; G.pick = null; gRender(); });
  $('gxGuess').addEventListener('change', e => { G.guess = e.target.checked; G.pick = null; if (G.guess) gRandom(); else gRender(); });
  $('gxYes').addEventListener('click', () => gAnswer(true));
  $('gxNo').addEventListener('click', () => gAnswer(false));
  $('gxNext').addEventListener('click', gRandom);
  $('gxReplay').addEventListener('click', () => { G.t0 = performance.now(); gDraw(); });
  $('gx').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tg = e.target;
    if (tg.closest && tg.closest('input, select')) return;
    const waiting = G.guess && G.pick == null;
    if (waiting && (e.key === '1' || e.key === '2')) { e.preventDefault(); gAnswer(e.key === '1'); }
    else if (G.guess && !waiting && (e.key === 'Enter' || e.key === 'r' || e.key === 'R') && !(tg.closest && tg.closest('button'))) { e.preventDefault(); gRandom(); }
    else if (!G.guess && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); gStep('e', e.key === 'ArrowRight' ? 1 : -1); }
    else if (!G.guess && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); gStep('n', e.key === 'ArrowDown' ? 1 : -1); }
    else if (!G.guess && (e.key === 's' || e.key === 'S')) { e.preventDefault(); G.num = G.num === 'sg' ? 'pl' : 'sg'; gRender(); }
  });
  new ResizeObserver(() => { G.t0 = performance.now() - 2600; gDraw(); }).observe(gcv);
  gRender();
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', n: '#6EC8FF', u: '#D4E157', det: '#C9A7FF', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// 그림 문제 1: 검문소 — 어느 문에서 멈출까 (A ① · B ② · C ③ · D 통과)
const FIG_GATE = (() => {
  const p = { det: 'many', noun: 'information', num: 'pl' }, FW = 640, FH = 240;
  const zones = () => { const X = 24, Wd = FW - 48; return [0.25, 0.5, 0.75].map(f => X + Wd * f).concat([X + Wd - 40]); };
  return {
    width: FW, height: FH, label: '명사 검문소 그림: many informations가 출발점에 있고, 문 세 개(A ①, B ②, C ③)와 도착점(D 통과)이 있음',
    pick: (x, y) => zones().findIndex(z => Math.abs(x - z) < 56 && y > 40 && y < 220),
    draw(g, st) {
      NS.pgDraw(g, FW, FH, p, st.done ? 4 : 0, { quiz: true });
      zones().forEach((z, k) => {
        const on = st.hover === k || (st.done && k === st.answer), wrong = st.done && k === st.pick && k !== st.answer;
        if (on || wrong) { rrq(g, z - 52, 44, 104, 168, 12); g.strokeStyle = on ? QCOL.key : QCOL.bad; g.lineWidth = 2.5; g.stroke(); }
        g.font = qfont(17, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(k < 3 ? 'ABC'[k] : 'D 통과', z, 230);
      });
    },
  };
})();
// 그림 문제 2: Several ___ 뒤에 올 수 있는 카드
const FIG_CARD = (() => {
  const cards = [['candidate', 'sg'], ['candidate', 'pl'], ['information', 'sg'], ['equipment', 'sg']], FW = 600, FH = 200;
  let boxes = [];
  return {
    width: FW, height: FH, label: '문장 Several 빈칸 applied for the job. 아래에 낱말 카드 넷: A candidate, B candidates, C information, D equipment',
    pick: (x, y) => boxes.findIndex(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, FW, FH);
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = qfont(22, 700); g.fillStyle = QCOL.det; g.fillText('Several', 120, 48);
      const sw = g.measureText('Several ').width;
      rrq(g, 120 + sw, 30, 110, 36, 8); g.setLineDash([6, 5]); g.strokeStyle = '#FF7AA8'; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
      g.font = qfont(22, 500); g.fillStyle = QCOL.text; g.fillText('applied for the job.', 120 + sw + 122, 48);
      boxes = [];
      cards.forEach(([n, num], k) => {
        const x = 18 + k * 145, y = 92, w = 130, h = 84, c = NA.noun(n).c, ok = NA.judgePhrase({ det: 'several', noun: n, num }).s === 'ok';
        boxes[k] = { x, y, w, h };
        const on = st.hover === k, ans = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, x, y, w, h, 12); g.fillStyle = on ? QCOL.hover : '#18202A'; g.fill();
        g.strokeStyle = ans ? QCOL.ok : wrong ? QCOL.bad : c ? QCOL.n : QCOL.u; g.lineWidth = ans || wrong ? 3 : 1.5; g.stroke();
        g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.fillText('ABCD'[k], x + w / 2, y + 18);
        const word = NA.form(n, num);
        g.font = qfont(word.length > 10 ? 16 : 18, 700); g.fillStyle = c ? QCOL.n : QCOL.u; g.fillText(word, x + w / 2, y + 48);
        if (st.done) { g.font = qfont(13, 700); g.fillStyle = ok ? QCOL.ok : QCOL.bad; g.fillText(ok ? '짝 OK' : '짝 ×', x + w / 2, y + 70); }
      });
      g.textAlign = 'left';
    },
  };
})();
// 그림 문제 3: 문장 속 네 덩어리 가운데 틀린 곳
function wordFig(parts, label) {
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
          if (st.hover === k || on || wrong) { rrq(g, x - 4, 74, ww + 8, 36, 6); g.fillStyle = on ? 'rgba(255,193,94,0.22)' : wrong ? 'rgba(255,142,142,0.2)' : QCOL.hover; g.fill(); }
          g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.fillText('ABCD'[k], x + ww / 2, 50);
          g.font = qfont(size, 600);
        }
        g.textAlign = 'left'; g.fillStyle = role ? QCOL[role] : QCOL.text; g.fillText(w, x, 92);
        x += ww + sp;
      });
    },
  };
}
const FIG_HY = wordFig([['We', -1], ['need', -1], ['another', 0, 'det'], ['projector', 1, 'n'], ['for', -1], ['the', -1], ['three-days', 2, 'n'], ['workshop', 3, 'n'], ['.', -1]],
  '문장 We need another projector for the three-days workshop. 네 덩어리에 A부터 D까지 표시된 그림');
const QS = (() => {
  const J = p => NA.judgePhrase(p).s === 'ok';
  const q = [
    { q: '‘어제 책 샀어’를 영어로 옮길 때 틀린 문장은?', opts: NS.BOOKS.map(b => b.s), a: 3,
      why: 'book은 셀 수 있는 단수라서 짝(a, the, 소유격)이 있어야 해요. 한 권이면 a book, 서로 아는 책이면 the book, 여러 권이면 books.',
      check: () => NS.BOOKS.map(b => J(b.p)).join() === 'true,true,true,false' },
    { q: 'many informations → 검문소의 어느 문에서 처음 멈출까요? 그림의 문을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1, figure: FIG_GATE,
      why: 'information은 셀 수 없는 명사라서 -s를 붙일 수 없어요 → ② 문(하나인가 여럿인가?)에서 멈춰요. -s를 떼도 many와는 짝이 아니라서 ③ 문에 걸려요. 고친 말: much information.',
      check: () => NA.judgePhrase({ det: 'many', noun: 'information', num: 'pl' }).fail === 1 },
    { q: '다음 중 맞는 문장은?', opts: ['Please submit an application.', 'Please submit application.', 'Please submit a applications.', 'Please submit much application.'], a: 0,
      why: '셀 수 있는 단수 application에는 짝이 필요해요. a/an은 단수와만 짝이고, much는 셀 수 없는 명사와 짝이에요.',
      check: () => [{ det: 'a', noun: 'application', num: 'sg' }, { noun: 'application', num: 'sg' }, { det: 'a', noun: 'application', num: 'pl' }, { det: 'much', noun: 'application', num: 'sg' }].map(J).join() === 'true,false,false,false' },
    { q: '다음 중 셀 수 없는 명사는?', opts: ['suggestion', 'chair', 'furniture', 'bag'], a: 2,
      why: 'furniture(가구)는 의자·책상·탁자를 묶어 부르는 이름이라 셀 수 없어요. suggestion(제안), chair, bag은 셀 수 있어요. 비슷한 뜻의 advice(조언)는 셀 수 없어요.',
      check: () => ['suggestion', 'chair', 'furniture', 'bag'].map(w => NA.noun(w).c).join() === 'true,true,false,true' },
    { q: '짐 두 개를 바르게 말한 것은?', opts: ['two luggages', 'two luggage', 'two piece of luggage', 'two pieces of luggage'], a: 3,
      why: 'luggage는 셀 수 없어서 -s도 숫자도 바로 붙지 않아요. 세는 말 piece를 쓰고, 둘이니까 pieces로 써요.',
      check: () => [{ det: 'two', noun: 'luggage', num: 'pl' }, { det: 'two', noun: 'luggage', num: 'sg' }, { det: 'two', noun: 'piece of luggage', num: 'sg' }, { det: 'two', noun: 'piece of luggage', num: 'pl' }].map(J).join() === 'false,false,false,true' },
    { q: 'Several ___ applied for the job. 빈칸에 들어갈 수 있는 카드는? 카드를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1, figure: FIG_CARD,
      why: 'several(몇몇)은 여럿을 가리켜서 셀 수 있는 복수와 짝이에요 → candidates. 셀 수 없는 information, equipment와는 짝이 아니에요.',
      check: () => [['candidate', 'sg'], ['candidate', 'pl'], ['information', 'sg'], ['equipment', 'sg']].map(([n, num]) => J({ det: 'several', noun: n, num })).join() === 'false,true,false,false' },
    { q: 'much와 짝이 맞는 것은?', opts: ['much information', 'much candidates', 'much suppliers', 'much employee'], a: 0,
      why: 'much는 셀 수 없는 명사와 짝이에요. 셀 수 있는 복수에는 many를 써요(many candidates).',
      check: () => [['information', 'sg'], ['candidate', 'pl'], ['supplier', 'pl'], ['employee', 'sg']].map(([n, num]) => J({ det: 'much', noun: n, num })).join() === 'true,false,false,false' },
    { q: '‘직원 대부분’을 바르게 쓴 것은?', opts: ['almost employees', 'most of employees', 'most of the employees', 'almost of the employees'], a: 2,
      why: 'most of 뒤에는 정해진 무리(the · our)가 와야 해요. almost는 부사라서 명사 앞에 바로 못 오고, almost all employees처럼 써요.',
      check: () => [{ det: 'almost', noun: 'employee', num: 'pl' }, { det: 'most', of: 'bare', noun: 'employee', num: 'pl' }, { det: 'most', of: 'the', noun: 'employee', num: 'pl' }, { det: 'almost', of: 'the', noun: 'employee', num: 'pl' }].map(J).join() === 'false,false,true,false' },
    { q: '‘We need another projector for the three-days workshop.’ 틀린 곳은? 낱말을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_HY,
      why: '명사 앞에서 꾸미는 숫자-하이픈 말은 -s 없이 단수로 써요 → the three-day workshop. another projector(하나 더)는 맞아요.',
      check: () => J({ det: 'another', noun: 'projector', num: 'sg' }) && !J({ det: 'the', hyw: ['three', 'day'], hy: 'pl', noun: 'workshop', num: 'sg' }) && J({ det: 'the', hyw: ['three', 'day'], hy: 'sg', noun: 'workshop', num: 'sg' }) },
    { q: 'Ms. Kim’s proposal was better than ___ proposals. 빈칸에 알맞은 말은?', opts: ['another', 'other', 'each', 'much'], a: 1,
      why: '뒤의 proposals가 복수예요. other + 복수가 짝이에요. another와 each는 단수와, much는 셀 수 없는 명사와 짝이에요.',
      check: () => ['another', 'other', 'each', 'much'].map(d => J({ det: d, noun: 'proposal', num: 'pl' })).join() === 'false,true,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[명사·관사] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[명사·관사] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
  const ci = NS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * NS.W, (e.clientY - r.top) / r.height * NS.H]; };
const hitAt = (x, y) => started ? NS.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.say && EN.say.supported) { if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say && EN.say.supported ? '눌러서 발음 듣기: ' + h.say : ''; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-most)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }   // 장면 첫 0.45초는 밝아지는 중이라 조금 뒤에서 멈춤

// 발음 듣기 단추(직접 해 보기·놀이터·연습 문제·용어집): 누르면 영상을 멈추고 읽음
EN.say.wire(document, { before() { if (playing) pause(); } });
gateInit();
EN.drill({
  root: $('drillRoot'), items: NA.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 검문소 세 문이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 08·09장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '명사와 짝의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(NS.baseText()).then(() => { dirty = true; gDraw(); });
setTimeout(() => NS.collectText(text => loadFonts(text).then(() => { dirty = true; gDraw(); }), 8), 400);
requestAnimationFrame(loop);
})();
