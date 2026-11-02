/* 수 일치와 능동·수동 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(능동·수동 변환기 · 진짜 주어 누르기), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(VA), 그림은 scenes.js(VS)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const VA = window.VA, VS = window.VS, S = VS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = VS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cv = $('cv'), ctx = cv.getContext('2d');
VA.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = VS.fonts;
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
  const ready = new Promise(res => VS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '주어가 수를, 목적어가 태를 정한다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { VS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const cap = started ? VS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = VS.chapterAt(T);
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
  if (dirty) { dirty = false; VS.render(ctx, started ? T : POSTER); }
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
const L4 = 'ABCD';
const seg = (name, items, cur, attr = 'v') => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${esc(t)}</button>`).join('')}</div>`;
const enLine = (text, cls = '') => `<p class="enline ${cls}">${sayBtn(text)}<span lang="en">${esc(text)}</span></p>`;
// 연습 문제 하나를 직접 해 보기용 빈칸 문제로 (보기 단추 → 규칙 엔진으로 채점)
function miniQ(i) {
  const it = VA.DRILL[i];
  return `<div class="mini" data-q="${i}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map(([w], k) => `<button type="button" data-k="${k}">${esc(w)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
const SORT = ['occur', 'announce', 'happen', 'arise', 'review', 'rise', 'raise', 'take place', 'submit', 'emerge'];
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ(0)}
    <p class="note">맞든 틀리든 괜찮아요. 영상 10장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  korean: () => {
    const cur = S.sub != null ? S.sub : 1, sb = VA.SUBS[cur];
    return `<h2>직접 해 보기</h2><h3>주어를 바꿔 보기</h3>
      ${seg('주어', VA.SUBS.map((s, i) => [i, s.en]), cur)}
      <ul class="pairs">${VA.ROWS01.map(r => { const en = `${sb.en} ${sb.n === 's' ? r.s : r.p} ${r.rest}.`; return `<li><span class="en1">${sayBtn(en)}<span lang="en">${esc(sb.en)} <b class="v">${esc(sb.n === 's' ? r.s : r.p)}</b> ${esc(r.rest)}.</span></span><span class="ko1">${esc(sb.ko)} ${esc(r.ko)}.</span></li>`; }).join('')}</ul>
      <p class="note">주어가 <b>${sb.n === 's' ? '하나' : '여럿'}</b>이에요. 한국어 동사는 그대로인데, 영어 동사만 주어를 따라 바뀌어요.</p>`;
  },
  subject: () => `<h2>직접 해 보기</h2><h3>수식어 지우기</h3>
    <div class="row"><label class="chk"><input type="checkbox" id="labStrip"${S.strip ? ' checked' : ''}> 수식어를 지우고 보기</label></div>
    ${miniQ(2)}
    <p class="note">who 뒤의 동사도 앞 명사의 수를 따라요(the employees who <b>work</b>). 이 내용은 <a href="../relative-pronouns/index.html#c-subj">T01 관계대명사 04장</a>에서 자세히 다뤘어요.</p>`,
  quantity: () => {
    const k = S.q || 'anum', R = VA.quantSentence(k), K = VA.SUBJ[R.Q.kind];
    return `<h2>직접 해 보기</h2><h3>수량 표현 바꿔 보기</h3>
      ${seg('수량 표현', Object.entries(VA.QUANT).map(([key, q]) => [key, q.t]), k, 'q')}
      ${enLine(R.text)}
      <p class="verdict"><b class="c-${R.num === 's' ? 'one' : 'many'}">${R.num === 's' ? '하나 → 단수' : '여럿 → 복수'}</b> ${esc(R.Q.t)} ${esc(R.Q.mean)}. ${esc(K.why)}.</p>`;
  },
  single: () => `<h2>직접 해 보기</h2><h3>덩어리 주어</h3>${miniQ(7)}${miniQ(9)}`,
  voice: () => {
    const P = VA.PAIRS[S.vpair || 0], A = VA.build(P, { voice: 'act' }), B = VA.build(P, { voice: 'pass' });
    return `<h2>직접 해 보기</h2><h3>능동 ↔ 수동 바꿔 보기</h3>
      ${seg('문장', VA.PAIRS.slice(0, 4).map((p, i) => [i, p.v]), S.vpair || 0, 'vp')}
      ${seg('보기', [['', '영상대로'], ['act', '능동'], ['pass', '수동']], S.passive == null ? '' : S.passive ? 'pass' : 'act', 'pv')}
      ${enLine(A.text, 'small')}<p class="arrow-down" aria-hidden="true">↓</p>${enLine(B.text, 'small')}
      <p class="note">목적어가 주어 자리로 가면 be동사의 수도 새 주어를 따라요. 더 많은 문장과 시제는 아래 <a href="#playground">놀이터</a>의 변환기에서 바꿔 볼 수 있어요.</p>`;
  },
  object: () => `<h2>직접 해 보기</h2><h3>목적어일까, 아닐까?</h3>
    <ol class="gapq">${VA.PHRASES.map(([w, k], i) => `<li data-ph="${i}"><span lang="en" class="ph">${esc(w)}</span><span class="mo"><button type="button" data-o="obj">목적어</button><button type="button" data-o="no">목적어 아님</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>
    ${miniQ(11)}`,
  remain: () => `<h2>직접 해 보기</h2><h3>남은 목적어 · 남은 보어</h3>${miniQ(12)}${miniQ(13)}`,
  intrans: () => `<h2>직접 해 보기</h2><h3>수동태가 되는 동사일까?</h3>
    <ol class="gapq">${SORT.map(w => `<li data-w="${esc(w)}"><span lang="en" class="ph">${esc(w)}</span><span class="mo"><button type="button" data-p="1">수동태 가능</button><button type="button" data-p="0">수동태 없음</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>
    ${miniQ(14)}`,
  method: () => {
    const P = S.path || {};
    const opt = (obj, cur) => ['<option value="">고르기</option>'].concat(Object.entries(obj).map(([k, v]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${esc(typeof v === 'string' ? v : v.name)}</option>`)).join('');
    const vts = Object.fromEntries(Object.entries(VA.VT).filter(([k]) => k !== 'be'));
    let out = '';
    if (P.subj && P.vt && P.after) {
      const K = VA.SUBJ[P.subj], need = VA.need(P.vt, P.after);
      out = need ? `<p class="verdict"><b class="c-ok">${K.num === 's' ? '하나' : '여럿'} · ${need === 'act' ? '능동' : '수동'}</b> → ${esc(VA.formsFor(K.num, need))}</p><p class="note">① ${esc(K.name)}: ${esc(K.why)}. ③ ${esc(VA.needWhy(P.vt, P.after))}</p>`
        : `<p class="verdict"><b class="c-no">문장이 안 돼요.</b> ${esc(VA.needWhy(P.vt, P.after))}</p>`;
    }
    return `<h2>직접 해 보기</h2><h3>3단계 판정기</h3>
      <p class="note">주어의 종류, 동사의 종류, 빈칸 뒤에 오는 말을 고르면 흐름도에 길이 켜지고 알맞은 동사 모양이 나와요.</p>
      <div class="pick"><span>① 주어</span><select id="labS" class="sel">${opt(VA.SUBJ, P.subj)}</select></div>
      <div class="pick"><span>동사</span><select id="labV" class="sel">${opt(vts, P.vt)}</select></div>
      <div class="pick"><span>③ 뒤</span><select id="labA" class="sel">${opt(VA.AFTER, P.after)}</select></div>
      ${out}${S.path ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${VA.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 능동·수동 변환기, 진짜 주어 누르기</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${VA.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showAt(u) { const ch = CHAPTERS[VS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
// 직접 해 보기의 조작은 한곳에서 처리 (다시 만들어도 이어서 동작)
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[VS.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { S.path = null; touch(); buildLab(VS.chapterAt(T)); return; }
  if (b.dataset.k != null) {                                // 빈칸 문제
    const box = b.closest('.mini'), it = VA.DRILL[+box.dataset.q], k = +b.dataset.k, j = VA.judgeOpt(it, k);
    box.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(j.s === 'ok' ? 'right' : 'wrong');
    box.querySelector('.mr').textContent = `${VA.formName(it.opts[k][1])}. ` + (j.s === 'ok' ? '맞아요! ' : '아니에요. ') + j.why;
    if (playing) pause();
    return;
  }
  if (b.dataset.o) {                                        // 목적어일까?
    const li = b.closest('li'), [w, kind] = VA.PHRASES[+li.dataset.ph], isObj = kind === 'obj', ok = (b.dataset.o === 'obj') === isObj;
    li.querySelectorAll('button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(ok ? 'right' : 'wrong');
    li.querySelector('.mr').textContent = (ok ? '맞아요. ' : '다시 보세요. ') + `${VA.PHRASEKIND[kind]} → ` + (isObj ? '빈칸 뒤에 오면 능동.' : '목적어가 아니라서, 빈칸 뒤에 이것뿐이면 수동.');
    if (playing) pause();
    return;
  }
  if (b.dataset.p) {                                        // 수동태가 되나요?
    const li = b.closest('li'), w = li.dataset.w, D = VA.verb(w), can = VA.passable(w), ok = (b.dataset.p === '1') === can;
    li.querySelectorAll('button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(ok ? 'right' : 'wrong');
    li.querySelector('.mr').textContent = (ok ? '맞아요. ' : '다시 보세요. ') + `${w} = ${D.ko}. ` + (can ? `목적어를 갖는 타동사 → 수동태 ${D.f[3]} 가능.` : '목적어가 없는 자동사 → 수동태 없음.');
    if (playing) pause();
    return;
  }
  const id = CHAPTERS[VS.chapterAt(T)].id;
  if (b.dataset.v != null && id === 'korean') { S.sub = +b.dataset.v; showAt(9.8); }
  else if (b.dataset.q != null && id === 'quantity') { S.q = b.dataset.q; showAt(10); }
  else if (b.dataset.vp != null) { S.vpair = +b.dataset.vp; showAt(16.4); }
  else if (b.dataset.pv != null) { S.passive = b.dataset.pv === '' ? null : b.dataset.pv === 'pass'; showAt(16.4); }
  else return;
  touch(); buildLab(VS.chapterAt(T));
});
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'labStrip') { S.strip = t.checked; showAt(27); }
  else if (['labS', 'labV', 'labA'].includes(t.id)) {
    const subj = $('labS').value, vt = $('labV').value, after = $('labA').value;
    S.path = subj || vt || after ? { subj, vt, after } : null;   // 셋을 다 골라야 흐름도가 켜짐
    showAt(25);
  } else return;
  touch(); buildLab(VS.chapterAt(T));
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // be + 과거분사(p.p.)는 ‘과거분사’로 한 번만, Ms.는 이름과 이어 읽고, ‘진짜 주어 = results’의 =는 쉼으로
  read: [[/\s*\(p\.p\.\)/g, ''], [/p\.p\./g, '과거분사'], [/Ms\. /g, 'Ms '], [/ = /g, ', '], [/TOEIC/g, '토익'], [/Part 5/g, '파트 5']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 — 능동·수동 변환기 · 진짜 주어 누르기
   ========================================================= */
const CV = { pair: 0, voice: 'pass', tense: null, sub: 0, by: true, prev: null, t0: 0, raf: 0 };
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const stageCv = $('cvStage'), stageG = stageCv.getContext('2d');
function cvState() { const P = VA.PAIRS[CV.pair]; return { P, o: { voice: CV.voice, tense: CV.tense || P.tense, sub: CV.sub, by: CV.by } }; }
function cvBuild() {
  const { P, o } = cvState(), E = VA.explain(P, o), B = E.B, vt = VA.verb(P.v).type;
  $('cvPair').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === CV.pair)));
  $('cvVoice').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === CV.voice)));
  $('cvTense').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === o.tense)));
  $('cvSub').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === CV.sub)));
  $('cvSubRow').hidden = !(vt === 'v4' && CV.voice === 'pass');
  if (vt === 'v4') $('cvSub').querySelectorAll('button').forEach((b, i) => { b.textContent = (i ? '물건 → ' : '사람 → ') + P.o[i][0]; });
  $('cvByRow').hidden = CV.voice !== 'pass' || !B.ok;
  $('cvKind').textContent = `${P.v} = ${VA.verb(P.v).ko} · ${VA.VT[vt]}`;
  if (B.ok) {
    $('cvOut').innerHTML = `${sayBtn(B.text)}<span lang="en">${B.toks.map(t => t.t === '.' ? '.' : ` <span class="r-${t.r || 'x'}">${esc(t.t)}</span>`).join('').trim()}</span>`;
  } else $('cvOut').innerHTML = `<span class="c-no">수동태로 바꿀 수 없어요.</span>`;
  $('cvSteps').innerHTML = E.steps.map(s => `<li>${esc(s)}</li>`).join('');
  $('cvTwins').innerHTML = E.twins.length ? `<p class="note">이렇게 쓰면 틀려요 (규칙 엔진의 까닭)</p><ul>${E.twins.map(w => `<li><span class="tw" lang="en">${esc(w.text)}</span> <span class="why">× ${esc(w.j.why)}</span></li>`).join('')}</ul>` : '';
  // 무대: 앞 문장에서 새 문장으로 움직임
  const act = VA.build(P, { voice: 'act', tense: o.tense });
  const next = B.ok ? B : act;
  const prev = CV.prev;
  CV.prev = next; CV.t0 = performance.now();
  cancelAnimationFrame(CV.raf);
  const opt = B.ok ? { num: next.num, voice: CV.voice } : { voice: 'act', msg: '목적어가 없는 자동사 → 수동태로 바꿀 수 없어요' };
  const frame = () => {
    const p = reduce || !prev ? 1 : clamp((performance.now() - CV.t0) / 900);
    VS.stage(stageG, prev && p < 1 ? prev : null, next, p, opt);
    if (p < 1) CV.raf = requestAnimationFrame(frame);
  };
  frame();
}
function cvResize() {
  const r = stageCv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  stageCv.width = Math.max(1, Math.round(r.width * d)); stageCv.height = Math.max(1, Math.round(r.width * d * VS.STAGE.h / VS.STAGE.w));
  if (CV.prev) { const { P } = cvState(), B = VA.build(P, cvState().o); VS.stage(stageG, null, CV.prev, 1, B.ok ? { num: CV.prev.num, voice: CV.voice } : { voice: 'act', msg: '목적어가 없는 자동사 → 수동태로 바꿀 수 없어요' }); }
}
function cvInit() {
  $('cvPair').innerHTML = VA.PAIRS.map((P, i) => `<button type="button" data-i="${i}" aria-pressed="false"><span lang="en">${esc(P.v)}</span></button>`).join('');
  $('cvTense').innerHTML = Object.entries(VA.TENSE).map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="false">${esc(v)}</button>`).join('');
  $('cvPair').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; CV.pair = +b.dataset.i; CV.tense = null; CV.sub = 0; cvBuild(); });
  $('cvVoice').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; CV.voice = b.dataset.v; cvBuild(); });
  $('cvTense').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; CV.tense = b.dataset.v; cvBuild(); });
  $('cvSub').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; CV.sub = +b.dataset.v; cvBuild(); });
  $('cvBy').addEventListener('change', e => { CV.by = e.target.checked; cvBuild(); });
  new ResizeObserver(cvResize).observe(stageCv);
  // 처음에는 능동 문장을 보여 준 뒤 수동으로 바뀌는 모습
  CV.prev = VA.build(VA.PAIRS[0], { voice: 'act' });
  cvResize(); cvBuild();
}

// 진짜 주어 누르기
const FG = { round: [], i: 0, score: 0, tries: 0, state: 'idle' };
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function fRender(wrongI) {
  $('fScore').textContent = `점수 ${FG.score}`;
  if (FG.state === 'idle' || FG.state === 'end') {
    $('fProg').textContent = FG.state === 'end' ? '끝' : '8문장';
    $('fQ').innerHTML = FG.state === 'end' ? `<span class="fend"><b>${FG.score} / ${FG.round.length}</b> 문장에서 한 번에 찾았어요.${FG.score === FG.round.length ? ' 모두 한 번에 찾았어요!' : ' 틀린 문장은 수식어를 손가락으로 가리고 다시 읽어 보세요.'}</span>`
      : '<span class="fend">문장의 동사가 어떤 낱말에 수를 맞추는지, 그 <b>진짜 주어</b>를 눌러 보세요.</span>';
    $('fStart').hidden = false; $('fStart').textContent = FG.state === 'end' ? '다시 하기' : '시작';
    $('fNext').hidden = true; $('fFb').innerHTML = '';
    return;
  }
  const F = FG.round[FG.i], Tk = VA.findToks(F), shown = FG.state === 'shown';
  $('fProg').textContent = `${FG.i + 1} / ${FG.round.length}`;
  $('fQ').innerHTML = Tk.map(t => `<button type="button" class="fw${shown ? ' f-' + (t.r || 'x') : ''}${wrongI === t.i ? ' wrong' : ''}" data-i="${t.i}"${shown ? ' disabled' : ''}>${esc(t.t)}</button>`).join(' ') + '.';
  $('fStart').hidden = true; $('fNext').hidden = !shown;
}
function fStart() { FG.round = shuffle(VA.FIND).slice(0, 8); FG.i = 0; FG.score = 0; FG.tries = 0; FG.state = 'ask'; fRender(); $('find').focus({ preventScroll: true }); }
function fPick(i) {
  if (FG.state !== 'ask') return;
  const F = FG.round[FG.i], r = VA.findWhy(F, i);
  FG.tries++;
  if (r.ok) {
    if (FG.tries === 1) FG.score++;
    FG.state = 'shown'; fRender();
    $('fFb').innerHTML = `<b class="c-ok">${FG.tries === 1 ? '정답!' : '찾았어요.'}</b> ${esc(r.why)}${F.mod ? ` 지운 부분 → <span lang="en">${esc(F.mod)}</span>.` : ''} ${sayBtn(F.s)}`;
    $('fNext').focus({ preventScroll: true });
  } else {
    fRender(i);
    $('fFb').innerHTML = `<b class="c-no">아니에요.</b> ${esc(r.why)}`;
    const b = $('fQ').querySelector(`[data-i="${i}"]`); if (b) b.focus({ preventScroll: true });
  }
}
function fNext() { FG.i++; FG.tries = 0; if (FG.i >= FG.round.length) { FG.state = 'end'; fRender(); } else { FG.state = 'ask'; $('fFb').innerHTML = ''; fRender(); const b = $('fQ').querySelector('button'); if (b) b.focus({ preventScroll: true }); } }
function findInit() {
  $('fQ').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) fPick(+b.dataset.i); });
  $('fStart').addEventListener('click', fStart);
  $('fNext').addEventListener('click', fNext);
  $('find').addEventListener('keydown', e => {
    if (e.key === 'Enter' && FG.state === 'shown' && !(e.target.closest && e.target.closest('[data-say], #fNext'))) { e.preventDefault(); fNext(); }
  });
  fRender();
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', subj: '#6EC8FF', mod: '#7FE0A8', v: '#FFC15E', obj: '#C9A7FF', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// 문장 속 네 덩어리에 A~D를 붙인 그림 문제 (덩어리를 누르거나 단추로 고름). parts: [글자, 보기 번호, 역할]
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
        g.textAlign = 'left'; g.fillStyle = st.done && role ? QCOL[role] : QCOL.text; g.fillText(w, x, 92);
        if (st.done && role === 'mod') { g.strokeStyle = QCOL.mod; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 2, 94); g.lineTo(x + ww + 2, 94); g.stroke(); }
        x += ww + sp;
      });
    },
  };
}
const FIG_SUBJ = wordFig([['The', -1], ['list', 0, 'subj'], ['of', -1, 'mod'], ['approved', 1, 'mod'], ['suppliers', 2, 'mod'], ['___', -1], ['updated', -1], ['every', -1], ['month', 3], ['.', -1]],
  '문장 The list of approved suppliers 빈칸 updated every month. 네 낱말에 A부터 D까지 표시된 그림');
const FIG_LEFT = wordFig([['Ms. Lee', 0, 'subj'], ['was', -1, 'v'], ['given', 1, 'v'], ['a bonus', 2, 'obj'], ['by', -1], ['the company', 3], ['.', -1]],
  '문장 Ms. Lee was given a bonus by the company. 네 덩어리에 A부터 D까지 표시된 그림');
const QS = (() => {
  // 보기마다 code를 붙여 규칙 엔진으로 정답을 확인
  const by = (codes, ctx) => codes.map(c => VA.judge(c, ctx).s === 'ok');
  const q = [
    { q: '동사 끝에 붙은 -s(goes, approves)가 알려 주는 것은?', opts: ['주어가 여럿이에요.', '주어가 하나예요 (현재 시제).', '과거에 일어난 일이에요.', '수동태예요.'], a: 1,
      why: '명사 끝의 -s → 여럿, 동사 끝의 -s → 주어가 하나라는 표시예요. He goes. The manager approves.' },
    { q: '‘The list of approved suppliers ___ updated every month.’ 빈칸의 동사가 수를 맞출 진짜 주어는? 낱말을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 0, figure: FIG_SUBJ,
      why: '앞의 명사를 꾸미는 수식어 → of approved suppliers. 지우면 The list ___ updated. 진짜 주어가 하나라서 → is updated.',
      check: () => VA.findWhy(VA.FIND[1], 1).ok },
    { q: 'The number of applicants ___ doubled since last year. 빈칸에 알맞은 말은?', opts: ['have', 'are', 'has', 'having'], a: 2,
      why: 'the number of = ‘~의 수’, 숫자 하나예요 → 단수 has. a number of(= 많은)였다면 복수 have예요.',
      check: () => by(['a.p', 'p.p', 'a.s', 'x.ing'], { num: VA.SUBJ.thenum.num, vt: 'vi', after: 'none' }).join() === 'false,false,true,false' },
    { q: 'Reviewing all of the applications ___ about two weeks. 빈칸에 알맞은 말은?', opts: ['take', 'are taken', 'taking', 'takes'], a: 3,
      why: '동명사 덩어리(Reviewing ~) = 하는 일 하나 → 단수. 뒤에 목적어(about two weeks)가 있으니 능동 takes. 바로 앞의 복수 명사 applications에 속지 마세요.',
      check: () => by(['a.p', 'p.p', 'x.ing', 'a.s'], { num: VA.SUBJ.ger.num, vt: 'vt', after: 'obj' }).join() === 'false,false,false,true' },
    { q: '능동태 문장을 수동태로 바꾸면 원래의 목적어는 어디로 가나요?', opts: ['주어 자리로 올라가요.', '동사 바로 뒤에 그대로 있어요.', '문장에서 사라져요.', 'by 바로 뒤로 가요.'], a: 0,
      why: 'The company announced the winners. → The winners were announced. 목적어가 주어 자리로 가서, 수동태 동사 뒤에는 목적어가 없어요. by 뒤에 가는 것은 원래의 주어예요.' },
    { q: 'All applicants will be ___ of the results by e-mail. 빈칸에 알맞은 말은?', opts: ['notify', 'notified', 'notifying', 'notification'], a: 1,
      why: '빈칸 뒤에 목적어가 없어요(of the results, by e-mail = 전치사구) → 수동 will be notified. 능동 notifying을 쓰려면 뒤에 알릴 사람(목적어)이 있어야 해요.',
      check: () => by(['x.be', 'p.*', 'a.*', 'n'], { num: '*', vt: 'vt', after: 'none' }).join() === 'false,true,false,false' },
    { q: '‘Ms. Lee was given a bonus by the company.’ 수동태인데도 동사 뒤에 남아 있는 목적어는? 덩어리를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_LEFT,
      why: 'give = 목적어가 둘(사람에게, 물건을)인 주는 동사예요. 사람(Ms. Lee)이 주어로 올라가도 물건(a bonus)은 뒤에 남아요. by 뒤의 the company = 행위자예요.',
      check: () => VA.build(VA.pair('give'), { voice: 'pass' }).toks.some(t => t.t === 'a bonus' && t.r === 'obj') },
    { q: '다음 가운데 수동태로 쓸 수 없는 동사는?', opts: ['announce', 'review', 'approve', 'occur'], a: 3,
      why: 'occur(일어나다) = 목적어가 없는 자동사라서 수동태가 없어요. was occurred → 틀린 말이에요. arise, rise, take place, happen 모두 같아요.',
      check: () => ['announce', 'review', 'approve', 'occur'].map(w => VA.passable(w)).join() === 'true,true,true,false' },
    { q: 'The brochures for the spring sale ___ to all customers last week. 빈칸에 알맞은 말은?', opts: ['were sent', 'was sent', 'sent', 'sending'], a: 0,
      why: '① 수식어(for the spring sale)를 지우면 진짜 주어 = brochures, 여럿. ② 복수 → were. ③ 빈칸 뒤에 목적어 없이 to all customers뿐 → 수동. 그래서 were sent.',
      check: () => by(['p.p', 'p.s', 'a.*', 'x.ing'], { num: 'p', vt: 'v4', after: 'none' }).join() === 'true,false,false,false' },
    { q: 'Each of the new employees ___ a laptop on the first day. 빈칸에 알맞은 말은?', opts: ['are given', 'is given', 'gives', 'give'], a: 1,
      why: 'each of → 진짜 주어 = Each, 하나 → 단수. give = 주는 동사인데 뒤에 명사(a laptop)가 하나만 남았으니 수동 → is given.',
      check: () => by(['p.p', 'p.s', 'a.s', 'a.p'], { num: VA.SUBJ.oneof.num, vt: 'v4', after: 'obj' }).join() === 'false,true,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[수 일치·능동 수동] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[수 일치·능동 수동] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
  const ci = VS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * VS.W, (e.clientY - r.top) / r.height * VS.H]; };
const hitAt = (x, y) => started ? VS.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.say && EN.say.supported) { if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say && EN.say.supported ? '눌러서 발음 듣기: ' + h.say : ''; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-voice)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }   // 장면 첫 0.45초는 밝아지는 중이라 조금 뒤에서 멈춤

// 발음 듣기 단추(직접 해 보기·놀이터·연습 문제·용어집): 누르면 영상을 멈추고 읽음
EN.say.wire(document, { before() { if (playing) pause(); } });
cvInit();
findInit();
EN.drill({
  root: $('drill'), items: VA.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 3단계 풀이법이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09·10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '수 일치와 능동·수동의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(VS.baseText()).then(() => { dirty = true; if (CV.prev) cvResize(); });
setTimeout(() => VS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
