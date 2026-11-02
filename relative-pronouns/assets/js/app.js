/* 관계대명사 튜토리얼 — 플레이어, 직접 해 보기, 놀이터, 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(RP), 그림은 scenes.js(RV)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const RP = window.RP, RV = window.RV, S = RV.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = RV;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cv = $('cv'), ctx = cv.getContext('2d');
RP.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = RV.fonts;
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
  const ready = new Promise(res => RV.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '관계대명사, 빈자리를 찾아라 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { RV.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const cap = started ? RV.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = RV.chapterAt(T);
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
  if (dirty) { dirty = false; RV.render(ctx, started ? T : POSTER); }
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
// 빈칸 문제 하나 (보기 단추 → 규칙 엔진으로 채점)
function miniQ(id, q, opts, d, ansNote) {
  return `<div class="mini" data-id="${id}"><p class="mq" lang="en">${esc(q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${opts.map(o => `<button type="button" data-o="${esc(o)}" data-d='${esc(JSON.stringify(d))}'>${esc(o)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
const GAPQ = [
  { q: 'the book which I borrowed', a: 'obj', why: 'borrowed 뒤에 목적어가 없어요.' },
  { q: 'the man who called you', a: 'subj', why: 'who 바로 뒤에 동사 called가 와요.' },
  { q: 'the movie that we watched last night', a: 'obj', why: 'we watched 뒤에 목적어가 없어요.' },
  { q: 'the bus that goes to the airport', a: 'subj', why: 'that 바로 뒤에 동사 goes가 와요.' },
];
const WHATQ = [
  { q: '___ he needs is more time.', d: { ante: 'none', gap: 'obj' } },
  { q: 'This is the laptop ___ he needs.', d: { ante: 'thing', gap: 'obj' } },
  { q: "I can't believe ___ you just said.", d: { ante: 'none', gap: 'obj' } },
];
const LABS = {
  intro: () => {
    const it = RP.DRILL[0];
    return `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>
      ${miniQ('intro', it.q, it.opts, it.d)}
      <p class="note">맞든 틀리든 괜찮아요. 영상 10장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`;
  },
  order: () => {
    const ex = RV.ORDER_EX[S.ex];
    return `<h2>직접 해 보기</h2><h3>다른 예로 바꿔 보기</h3>
      ${seg('예문', RV.ORDER_EX.map((e, i) => [i, e.koN]), S.ex)}
      <p>한국어 <b>${esc(ex.koMod)} ${esc(ex.koN)}</b> → 영어</p>
      ${enLine(`${ex.n} ${ex.rel} ${ex.rest}`)}
      ${enLine(ex.short.join(' '), 'small')}
      <p class="note">스피커 단추를 누르면 발음을 들려줘요. 한 번 더 누르면 천천히 읽어요. 화면 속 영어 문장을 눌러도 돼요.</p>`;
  },
  combine: () => {
    const pr = RP.pair(S.pair);
    return `<h2>직접 해 보기</h2><h3>다른 두 문장 합치기</h3>
      ${seg('예문', ['chef', 'printer', 'candidate', 'report'].map(id => [id, RP.pair(id).name.split(' (')[0]]), S.pair)}
      ${enLine(RP.sentence(pr.A), 'small')}${enLine(RP.sentence(pr.B), 'small')}
      <p class="arrow-down" aria-hidden="true">↓</p>
      ${enLine(RP.text(RP.combine(pr)))}
      <p class="note">${esc(pr.ko)} 지원자·보고서는 목적어 자리의 him·it이 관계대명사가 되어 앞으로 가요(다음 장 ‘빈자리’).</p>`;
  },
  gap: () => `<h2>직접 해 보기</h2><h3>무엇이 빠졌을까요?</h3>
    <ol class="gapq">${GAPQ.map((g, i) => `<li data-i="${i}"><span lang="en">${esc(g.q)}</span>
      <span class="mo"><button type="button" data-a="subj">주어</button><button type="button" data-a="obj">목적어</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>`,
  subj: () => `<h2>직접 해 보기</h2><h3>동사의 수 맞추기</h3>
    ${seg('선행사', [['', '둘 다'], ['false', '단수 manager'], ['true', '복수 managers']], S.plural == null ? '' : S.plural)}
    ${enLine('The manager who oversees the project will retire.', 'small')}
    ${enLine('The managers who oversee the project will retire.', 'small')}
    <p class="note">who 자체에는 단수·복수가 없어요. who가 가리키는 선행사가 단수면 oversees, 복수면 oversee.</p>`,
  obj: () => `<h2>직접 해 보기</h2><h3>목적격 생략해 보기</h3>
    <div class="row"><label class="chk"><input type="checkbox" id="labOmit"${S.omit ? ' checked' : ''}> whom 생략하기</label></div>
    ${enLine('The candidate whom we interviewed yesterday has accepted the offer.', 'small')}
    ${enLine('The candidate we interviewed yesterday has accepted the offer.', 'small')}
    <p class="note">두 문장은 뜻이 같아요. 명사 바로 뒤에 ‘주어 + 동사’가 이어지면 목적격이 생략된 거예요.</p>`,
  whose: () => {
    const pr = RP.pair(S.poss);
    return `<h2>직접 해 보기</h2><h3>사람에게도 whose</h3>
      ${seg('예문', [['company', '회사 (사물)'], ['applicant', '지원자 (사람)']], S.poss)}
      ${enLine(RP.sentence(pr.A), 'small')}${enLine(RP.sentence(pr.B), 'small')}
      <p class="arrow-down" aria-hidden="true">↓</p>${enLine(RP.text(RP.combine(pr)))}
      <p class="note">${esc(pr.ko)}</p>`;
  },
  what: () => `<h2>직접 해 보기</h2><h3>what일까, which일까?</h3>
    ${WHATQ.map((w, i) => miniQ('what' + i, w.q, ['what', 'which'], w.d)).join('')}`,
  thatno: () => {
    const rows = [['office', { comma: S.comma }], ['agency', { prepFront: S.prepFront }]].map(([id, o]) => {
      const pr = RP.pair(id), d = RP.situation(pr, o);
      return `<p class="cands">${['who', 'whom', 'which', 'that', '∅'].map(p => { const j = RP.judge(p, d); return `<span class="c-${j.s}" title="${esc(j.why)}">${esc(p === '∅' ? '생략' : p)}</span>`; }).join('')}</p>`;
    });
    return `<h2>직접 해 보기</h2><h3>콤마와 전치사를 바꿔 보기</h3>
      <div class="row"><label class="chk"><input type="checkbox" id="labComma"${S.comma ? ' checked' : ''}> ① 콤마 넣기 (계속적 용법)</label></div>${rows[0]}
      <div class="row"><label class="chk"><input type="checkbox" id="labPrep"${S.prepFront ? ' checked' : ''}> ② 전치사 with를 관계대명사 앞에</label></div>${rows[1]}
      <p class="note">초록은 쓸 수 있는 말, 빨강은 쓸 수 없는 말이에요. 글자에 마우스를 올리면 까닭이 보여요.</p>`;
  },
  method: () => {
    const P = S.path || {};
    const res = S.path ? RP.CANDS.concat(['where']).map(p => ({ p, j: RP.judge(p, { ante: P.ante, gap: P.gap, comma: P.comma, prep: P.prep, place: P.gap === 'none' }) })) : [];
    return `<h2>직접 해 보기</h2><h3>3단계 판별기</h3>
      <p class="note">조건을 고르면 흐름도에 길이 켜지고, 쓸 수 있는 말이 나와요.</p>
      <div class="pick"><span>① 선행사</span>${seg('선행사', [['person', '사람'], ['thing', '사물'], ['none', '없음']], P.ante || '')}</div>
      <div class="pick"><span>② 빈자리</span>${seg('빈자리', [['subj', '주어'], ['obj', '목적어'], ['poss', '관사 없는 명사'], ['none', '없음']], P.gap || '')}</div>
      <div class="pick"><span>③ 함정</span>${seg('함정', [['', '없음'], ['comma', '콤마 뒤'], ['prep', '전치사 뒤']], P.comma ? 'comma' : P.prep ? 'prep' : '')}</div>
      ${S.path ? `<ul class="verdicts">${res.filter(r => r.j.s !== 'no').map(r => `<li class="c-${r.j.s}"><b lang="en">${esc(r.p === '∅' ? '생략' : r.p)}</b> ${esc(r.j.why)}</li>`).join('') || '<li class="c-no">쓸 수 있는 관계사가 없어요.</li>'}</ul>
        <button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>` : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${RP.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 두 문장을 골라 합치고, 관계대명사를 바꿔 넣어 보기</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${RP.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 표와 용어</li></ul>`,
};
function buildLab(ci) {
  const lab = $('lab'), id = CHAPTERS[ci].id;
  lab.innerHTML = LABS[id]();
}
// 직접 해 보기의 조작은 한곳에서 처리 (다시 만들어도 이어서 동작)
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = CHAPTERS[RV.chapterAt(T)].id;
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[RV.chapterAt(T)].t + +b.dataset.seek); if (!playing) dirty = true; return; }
  if (b.id === 'labClear') { S.path = null; touch(); buildLab(RV.chapterAt(T)); return; }
  if (b.dataset.o) {                                       // 빈칸 문제
    const box = b.closest('.mini'), d = JSON.parse(b.dataset.d), j = RP.judge(b.dataset.o.toLowerCase(), d);
    box.querySelectorAll('.mo button').forEach(x => { x.classList.remove('right', 'wrong'); });
    b.classList.add(j.s === 'ok' ? 'right' : 'wrong');
    box.querySelector('.mr').textContent = (j.s === 'ok' ? '맞아요! ' : j.s === 'warn' ? '시험에서는 아니에요. ' : '아니에요. ') + j.why;
    if (playing) pause();
    return;
  }
  if (b.dataset.a) {                                       // 빈자리 찾기
    const li = b.closest('li'), g = GAPQ[+li.dataset.i], ok = b.dataset.a === g.a;
    li.querySelectorAll('button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(ok ? 'right' : 'wrong');
    li.querySelector('.mr').textContent = (ok ? '맞아요. ' : '다시 보세요. ') + g.why;
    if (playing) pause();
    return;
  }
  const grp = b.closest('.seg'); if (!grp || b.dataset.v == null) return;
  const v = b.dataset.v, name = grp.getAttribute('aria-label');
  if (id === 'order') S.ex = +v;
  else if (id === 'combine') S.pair = v;
  else if (id === 'subj') S.plural = v === '' ? null : v === 'true';
  else if (id === 'whose') S.poss = v;
  else if (id === 'method') {
    const P = S.path || { ante: 'person', gap: 'subj', comma: false, prep: false };
    if (name === '선행사') P.ante = v; else if (name === '빈자리') P.gap = v; else { P.comma = v === 'comma'; P.prep = v === 'prep'; }
    S.path = P;
  }
  touch(); buildLab(RV.chapterAt(T));
});
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'labOmit') S.omit = t.checked;
  else if (t.id === 'labComma') S.comma = t.checked;
  else if (t.id === 'labPrep') S.prepFront = t.checked;
  else return;
  touch(); buildLab(RV.chapterAt(T));
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/TOEIC/g, '토익'], [/Part 5/g, '파트 5'], [/~하는/g, '하는']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 — 문장 합치기 실험실
   ========================================================= */
const PG = { pair: 'chef', rel: null, comma: false, prepFront: true };
const ROLE_NAME = { ante: '선행사', rel: '관계대명사', gap: '빈자리', prep: '전치사', noun: '관사 없는 명사' };
function tokHTML(toks) {
  return toks.map(t => {
    if (t.r === 'gap') return '<span class="tk gap" title="빈자리" aria-label="빈자리"></span>';
    const cls = /^[.,]$/.test(t.t) ? 'p' : t.r === 'ante' ? 'ante' : t.r === 'rel' ? 'rel' : t.r === 'prep' ? 'prep' : t.r === 'noun' ? 'noun' : t.cl ? 'cl' : '';
    return `<span class="tk ${cls}"${ROLE_NAME[t.r] ? ` title="${ROLE_NAME[t.r]}"` : ''}>${esc(t.t)}</span>`;
  }).join(' ');
}
// 3단계 풀이에서 가리킬 '빈칸 뒤 단서': 주격은 빈자리 뒤 동사, 소유격은 관사 없는 명사, 목적격은 빈자리 앞의 주어 + 동사
function pgCue(toks) {
  const cl = toks.filter(t => t.cl && t.r !== 'rel' && !(t.r === 'prep' && toks.indexOf(t) < toks.findIndex(x => x.r === 'gap' || x.r === 'noun')));
  const g = cl.findIndex(t => t.r === 'gap');
  if (g < 0) return (cl.find(t => t.r === 'noun') || cl[0]).t;          // 소유격
  if (g === 0) return cl[1].t;                                           // 주격: 빈자리 바로 뒤 동사
  return cl.slice(0, g).filter(t => t.r !== 'prep').map(t => t.t).join(' ');   // 목적격: 빈자리 앞
}
function pgUpdate() {
  const pr = RP.pair(PG.pair), hasPrep = pr.prep != null;
  const d = RP.situation(pr, { comma: PG.comma, prepFront: PG.prepFront });
  const judged = RP.CANDS.map(p => ({ p, j: RP.judge(p, d) }));
  if (!PG.rel || !RP.CANDS.includes(PG.rel)) PG.rel = (judged.find(x => x.j.s === 'ok') || judged[0]).p;
  $('pgPairs').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === PG.pair)));
  $('pgA').innerHTML = enLine(RP.sentence(pr.A));
  $('pgB').innerHTML = enLine(RP.sentence(pr.B));
  $('pgComma').checked = PG.comma;
  $('pgPrepRow').hidden = !hasPrep;
  $('pgPrep').checked = PG.prepFront;
  // 후보 단추
  $('pgCands').innerHTML = judged.map(({ p, j }) => `<button type="button" data-rel="${esc(p)}" class="c-${j.s}" aria-pressed="${String(p === PG.rel)}">${p === '∅' ? '생략' : esc(p)}</button>`).join('');
  // 결과 문장
  const cur = judged.find(x => x.p === PG.rel);
  const toks = RP.combine(pr, { rel: PG.rel, comma: PG.comma, prepFront: PG.prepFront });
  const sent = RP.text(toks);
  $('pgOut').className = 'pgout c-' + cur.j.s;
  $('pgOut').innerHTML = `<p class="pgsent" lang="en">${sayBtn(sent)}${tokHTML(toks)}</p>
    <p class="pgverdict"><b>${cur.j.s === 'ok' ? '맞는 문장' : cur.j.s === 'warn' ? '시험에서는 피하기' : '틀린 문장'}</b> ${esc(cur.j.why)}</p>
    ${cur.j.s === 'ok' ? `<p class="note">${esc(pr.ko)}${PG.comma ? ' (콤마: 이미 정해진 대상에 설명을 덧붙이는 느낌)' : ''}</p>` : ''}`;
  // 모든 후보 표
  $('pgTable').innerHTML = judged.map(({ p, j }) => `<tr class="c-${j.s}"><th lang="en">${p === '∅' ? '생략' : esc(p)}</th><td>${j.s === 'ok' ? '○' : j.s === 'warn' ? '△' : '×'}</td><td>${esc(j.why)}</td></tr>`).join('');
  // 3단계 풀이
  const c = { ante: pr.A[pr.ante], cue: pgCue(toks), trap: hasPrep ? pr.B[pr.prep] : '' };
  const steps = RP.steps(d, c);
  $('pgSteps').innerHTML = steps.map(s => `<li><b>${esc(s.head)}</b> ${esc(s.text)}</li>`).join('');
}
function pgInit() {
  $('pgPairs').innerHTML = RP.PAIRS.map(p => `<button type="button" class="chip" data-id="${p.id}" aria-pressed="false">${esc(p.name)}</button>`).join('');
  $('pgPairs').addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (!b) return; PG.pair = b.dataset.id; PG.rel = null; PG.comma = !!RP.pair(PG.pair).comma; PG.prepFront = true; pgUpdate(); });
  $('pgCands').addEventListener('click', e => { const b = e.target.closest('button[data-rel]'); if (!b) return; PG.rel = b.dataset.rel; pgUpdate(); });
  $('pgComma').addEventListener('change', e => { PG.comma = e.target.checked; pgUpdate(); });
  $('pgPrep').addEventListener('change', e => { PG.prepFront = e.target.checked; pgUpdate(); });
  pgUpdate();
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// 그림 문제 1: 목적어 빈자리 위치 고르기
const GAPFIG = (() => {
  const words = ['the candidate', 'whom', 'we', 'interviewed', 'yesterday'];
  const slotAfter = [1, 2, 3, 4];               // A: whom 뒤, B: we 뒤, C: interviewed 뒤, D: yesterday 뒤
  let slots = [];
  return {
    width: 600, height: 150, label: '구절 the candidate whom we interviewed yesterday 사이사이에 A부터 D까지 네 자리가 표시된 그림',
    pick: (x, y) => slots.findIndex(s => x >= s.x - 8 && x <= s.x + s.w + 8 && y >= 30 && y <= 130),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 150);
      g.textBaseline = 'middle';
      const sw = 28, gap = 8;
      let size = 22;
      const totalAt = px => words.reduce((s, w, i) => { g.font = qfont(px, i <= 1 ? 700 : 500); return s + g.measureText(w).width + (slotAfter.includes(i) ? sw + gap * 2 : gap); }, 0) - gap;
      while (totalAt(size) > 572 && size > 14) size--;
      let x = (600 - totalAt(size)) / 2; slots = [];
      words.forEach((w, i) => {
        g.fillStyle = i === 0 ? QCOL.ante : i === 1 ? QCOL.rel : QCOL.text; g.textAlign = 'left';
        g.font = qfont(size, i <= 1 ? 700 : 500); g.fillText(w, x, 92);
        if (i === 0) { g.fillStyle = QCOL.ante; g.fillRect(x, 106, g.measureText(w).width, 2.5); }
        x += g.measureText(w).width + gap;
        if (slotAfter.includes(i)) {
          const k = slotAfter.indexOf(i), on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
          slots.push({ x, w: sw });
          rrq(g, x, 76, sw, 32, 6);
          g.fillStyle = on ? 'rgba(255,122,168,0.35)' : st.hover === k ? QCOL.hover : 'rgba(255,255,255,0.04)'; g.fill();
          g.setLineDash([4, 4]); g.strokeStyle = on ? QCOL.gap : wrong ? QCOL.bad : 'rgba(238,241,244,0.4)'; g.lineWidth = 1.6; g.stroke(); g.setLineDash([]);
          g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.fillText('ABCD'[k], x + sw / 2, 52);
          if (on) { g.font = qfont(13, 600); g.fillStyle = QCOL.gap; g.fillText('him', x + sw / 2, 128); }
          x += sw + gap;
        }
      });
    },
  };
})();
// 그림 문제 2: 선행사 고르기
const ANTEFIG = (() => {
  const parts = [["Mina's team", 0], ['finished', -1], ['the report', 1], ['that', -1], ['the manager', 2], ['requested', 3], ['.', -1]];
  let boxes = [];
  return {
    width: 600, height: 150, label: "문장 Mina's team finished the report that the manager requested. 네 덩어리에 A부터 D까지 표시된 그림",
    pick: (x, y) => boxes.findIndex(b => x >= b.x - 4 && x <= b.x + b.w + 4 && y >= 40 && y <= 125),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 150);
      let size = 22; g.font = qfont(size, 600);
      const sp = 9, width = () => parts.reduce((s, [w]) => s + g.measureText(w).width + (w === '.' ? 0 : sp), 0);
      while (width() > 570 && size > 14) { size--; g.font = qfont(size, 600); }
      let x = (600 - width()) / 2; boxes = [];
      g.textBaseline = 'middle';
      parts.forEach(([w, k]) => {
        if (w === '.') x -= sp;
        g.font = qfont(size, 600);
        const ww = g.measureText(w).width;
        const on = st.done && k === st.answer, wrong = st.done && k >= 0 && k === st.pick && k !== st.answer;
        if (k >= 0) {
          boxes[k] = { x, w: ww };
          if (st.hover === k || on || wrong) { rrq(g, x - 4, 74, ww + 8, 36, 6); g.fillStyle = on ? 'rgba(110,200,255,0.22)' : wrong ? 'rgba(255,142,142,0.2)' : QCOL.hover; g.fill(); }
          g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.fillText('ABCD'[k], x + ww / 2, 50);
          g.font = qfont(size, 600);
        }
        g.textAlign = 'left'; g.fillStyle = on ? QCOL.ante : w === 'that' ? QCOL.rel : QCOL.text; g.fillText(w, x, 92);
        if (on) { g.fillStyle = QCOL.ante; g.fillRect(x, 106, ww, 2.5); }
        x += ww + sp;
      });
    },
  };
})();
const QS = (() => {
  const museum = { ante: 'thing', gap: 'obj', place: true };
  const q = [
    { q: '관계대명사(예: who)가 하는 두 가지 일은?', opts: ['접속사 + 대명사', '접속사 + 형용사', '전치사 + 명사', '동사 + 대명사'], a: 0,
      why: 'who는 두 문장을 잇는 접속사 일과, 앞 문장의 명사(선행사)를 대신하는 대명사 일을 함께 해요. I know a chef. + She cooks… → a chef who cooks…' },
    { q: '‘한국 음식을 요리하는 요리사’를 영어로 옮길 때, 꾸미는 말(관계사절)은 어디에 올까요?', opts: ['명사 앞', '명사 뒤', '문장 맨 앞', '동사 바로 앞'], a: 1,
      why: '한국어는 꾸미는 말이 앞에 오지만, 영어의 긴 꾸밈말은 명사 뒤에 붙어요: a chef who cooks Korean food.' },
    { q: '‘the candidate whom we interviewed yesterday’에서 빈자리(원래 him이 있던 자리)는 어디일까요? 자리를 누르거나 아래 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: GAPFIG,
      why: 'We interviewed him yesterday에서 목적어 him이 whom이 되어 앞으로 갔어요. 그래서 interviewed 바로 뒤(C)가 비어 있어요.' },
    { q: 'whose 바로 뒤에 오는 것은?', opts: ['동사', 'the + 명사', '전치사', '관사 없는 명사'], a: 3,
      why: 'whose는 ‘그 사람의, 그것의’라는 소유격이라 바로 뒤에 관사 없는 명사가 와요: a company whose profits doubled. whose the profits는 틀려요.' },
    { q: 'Employees who ___ the safety workshop will receive a certificate. 빈칸에 알맞은 말은?', opts: ['attending', 'attends', 'to attend', 'attend'], a: 3,
      why: '관계대명사 뒤 동사의 수는 선행사에 맞춰요. 선행사 Employees가 복수이니 -s가 없는 attend.' },
    { q: "‘Mina's team finished the report that the manager requested.’ 관계대명사 that의 선행사는? 덩어리를 누르거나 단추를 고르세요.", opts: ['A', 'B', 'C', 'D'], a: 1, figure: ANTEFIG,
      why: 'that 바로 앞의 명사 the report가 선행사예요. the manager requested 뒤에 목적어(the report)가 빠져 있어요.' },
    { q: '관계대명사 what을 쓸 수 있는 때는?', opts: ['앞에 꾸밀 명사가 없을 때', '앞에 사람 명사가 있을 때', '콤마 바로 뒤', '전치사 바로 뒤'], a: 0,
      why: 'what은 the thing which처럼 선행사를 이미 품고 있어요. 그래서 앞에 명사가 없을 때만 써요: What she said surprised everyone.', check: () => RP.judge('what', { ante: 'none', gap: 'obj' }).s === 'ok' && RP.judge('what', { ante: 'person', gap: 'obj' }).s === 'no' },
    { q: 'that을 쓸 수 없는 자리는?', opts: ['사람 선행사 뒤', '사물 선행사 뒤', '콤마나 전치사 바로 뒤', '목적어가 빠진 절의 맨 앞'], a: 2,
      why: '콤마 뒤(계속적 용법)와 전치사 바로 뒤에는 that을 못 써요. 각각 which·who, with which·with whom을 써요.', check: () => RP.judge('that', { ante: 'thing', gap: 'subj', comma: true }).s === 'no' && RP.judge('that', { ante: 'thing', gap: 'obj', prep: true }).s === 'no' },
    { q: '괄호 속 관계대명사를 생략할 수 있는 것은?', opts: ['the man (who) lives next door', 'our office, (which) is on the fifth floor', 'the agency with (which) we work', 'the book (which) I bought yesterday'], a: 3,
      why: '목적격 관계대명사만 생략할 수 있어요. the book (which) I bought ▢ — bought 뒤에 목적어가 빠졌죠. 주격, 콤마 뒤, 전치사 바로 뒤에서는 생략할 수 없어요.',
      check: () => RP.judge('∅', { ante: 'thing', gap: 'obj' }).s === 'ok' && RP.judge('∅', { ante: 'person', gap: 'subj' }).s === 'no' && RP.judge('∅', { ante: 'thing', gap: 'subj', comma: true }).s === 'no' && RP.judge('∅', { ante: 'thing', gap: 'obj', prep: true }).s === 'no' },
    { q: 'The museum ___ we visited was huge. 빈칸에 알맞은 말은?', opts: ['which', 'where', 'what', 'who'], a: 0,
      why: 'visited 뒤에 목적어가 빠졌어요(빈자리 있음) → 관계대명사 which. ‘박물관’이라는 장소만 보고 where를 고르면 함정에 빠져요. where 뒤에는 완전한 문장이 와요.',
      check: () => RP.valid(museum, ['which', 'where', 'what', 'who']).join() === 'which' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[관계대명사] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[관계대명사] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
  const ci = RV.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * RV.W, (e.clientY - r.top) / r.height * RV.H]; };
const hitAt = (x, y) => started ? RV.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.say && EN.say.supported) { if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say && EN.say.supported ? '눌러서 발음 듣기: ' + h.say : ''; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-gap)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }   // 장면 첫 0.45초는 밝아지는 중이라 조금 뒤에서 멈춤

// 발음 듣기 단추(직접 해 보기·놀이터·연습 문제·용어집): 누르면 영상을 멈추고 읽음
EN.say.wire(document, { before() { if (playing) pause(); } });
pgInit();
EN.drill({
  root: $('drill'), items: RP.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 3단계 풀이법이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09·10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '관계대명사의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(RV.baseText()).then(() => { dirty = true; });
setTimeout(() => RV.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
