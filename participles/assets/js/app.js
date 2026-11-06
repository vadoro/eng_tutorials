/* 분사 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(주인 바꾸기 실험실), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(PT), 그림은 scenes.js(PTS)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const PT = window.PT, PTS = window.PTS, S = PTS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = PTS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, p) => a + (b - a) * p;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cv = $('cv'), ctx = cv.getContext('2d');
PT.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = PTS.fonts;
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
  const ready = new Promise(res => PTS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '-ing냐 -ed냐, 주인에게 물어라 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { PTS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const cap = started ? PTS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = PTS.chapterAt(T);
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
  if (dirty) { dirty = false; PTS.render(ctx, started ? T : POSTER); }
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
  const it = PT.DRILL[i];
  return `<div class="mini" data-q="${i}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map(([w], k) => `<button type="button" data-k="${k}">${esc(w)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
// -ing · -ed 두 단추로 고르는 문장 목록 (관계는 문장마다 데이터에 적어 둠)
const sortList = (list, attr) => `<ol class="gapq">${list.map((it, i) => `<li data-${attr}="${i}"><span lang="en" class="ph long">${esc(it.q).replace('___', '<span class="blank sm">&nbsp;</span>')} <small>(${esc(it.v)})</small></span><span class="mo"><button type="button" data-f="ing">${esc(PT.ing(it.v))}</button><button type="button" data-f="ed">${esc(PT.ed(it.v))}</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>`;
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ(1)}
    <p class="note">맞든 틀리든 괜찮아요. 영상 10장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  participle: () => {
    const F0 = PT.FORMS01[S.v01 || 0], D = PT.verb(F0.v);
    return `<h2>직접 해 보기</h2><h3>동사를 바꿔 보기</h3>
      ${seg('동사', PT.FORMS01.map((f, i) => [i, f.v]), S.v01 || 0, 'v01')}
      <ul class="pairs"><li><span class="en1">${sayBtn(PT.ing(F0.v))}<span lang="en"><b class="v">${esc(PT.ing(F0.v))}</b></span></span><span class="ko1">현재분사 · ${esc(F0.ko[0])}</span></li>
        <li><span class="en1">${sayBtn(PT.ed(F0.v))}<span lang="en"><b class="v">${esc(PT.ed(F0.v))}</b></span></span><span class="ko1">과거분사 · ${esc(F0.ko[1])}</span></li></ul>
      ${enLine(F0.pre[0], 'small')}${enLine(F0.post[0], 'small')}
      <p class="note">${esc(D.w)} = ${esc(D.mean)}. 과거분사는 대개 -ed로 끝나지만 written, broken처럼 모양이 다른 것도 있어요(불규칙 과거분사).</p>`;
  },
  core: () => {
    const E = PT.LAB[S.pair || 0];
    return `<h2>직접 해 보기</h2><h3>주인 바꾸기</h3>
      ${seg('문장', PT.LAB.slice(0, 4).map((e, i) => [i, e.v]), S.pair || 0, 'pair')}
      ${seg('주인', [['', '영상대로'], ['L', '하는 쪽이 주인'], ['R', '당하는 쪽이 주인']], S.own || '', 'own')}
      ${enLine(E.act, 'small')}
      <ul class="pairs"><li><span class="en1">${sayBtn(E.phr.L[0])}<span lang="en">${esc(E.phr.L[0])}</span></span><span class="ko1 c-act">하는 쪽 → -ing</span></li>
        <li><span class="en1">${sayBtn(E.phr.R[0])}<span lang="en">${esc(E.phr.R[0])}</span></span><span class="ko1 c-pass">당하는 쪽 → -ed</span></li></ul>
      <p class="note">T03의 능동·수동과 같은 질문이에요(<a href="../verb-agreement-voice/index.html#c-voice">T03 05장</a>). 더 많은 동사는 아래 <a href="#playground">놀이터</a>에서 바꿔 볼 수 있어요.</p>`;
  },
  names: () => `<h2>직접 해 보기</h2><h3>때를 바꿔 보기</h3>
    ${seg('때', [['', '영상대로']].concat(PT.WHEN.map(w => [w.k, w.t])), S.when || '', 'when')}
    ${(S.when ? PT.WHEN.filter(w => w.k === S.when) : PT.WHEN).map(w => enLine(w.s, 'small')).join('')}
    <p class="note">때가 바뀌면 문장의 동사(have shipped · will ship · will arrive)는 바뀌지만, 주문이 당하는 쪽이라는 사실은 그대로 → placed.</p>
    <h3 class="mt">늘 -ing인 자동사일까?</h3>
    <ol class="gapq">${PT.SORT_VI.map(w => `<li data-w="${esc(w)}"><span lang="en" class="ph">${esc(w)}</span><span class="mo"><button type="button" data-p="vi">자동사 → 늘 -ing</button><button type="button" data-p="vt">-ing · -ed 둘 다</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>`,
  after: () => `<h2>직접 해 보기</h2><h3>줄어든 관계사절</h3>
    <div class="row"><label class="chk"><input type="checkbox" id="labFull"${S.full ? ' checked' : ''}> 빠진 말(who are · that was) 넣어 보기</label></div>
    ${miniQ(2)}${miniQ(5)}`,
  emotion: () => {
    const EM = PT.EMO[S.emo || 0];
    return `<h2>직접 해 보기</h2><h3>감정 동사 바꿔 보기</h3>
      ${seg('감정 동사', PT.EMO.map((e, i) => [i, e.v]), S.emo || 0, 'emo')}
      ${enLine(EM.s, 'small')}
      <ul class="pairs"><li><span class="en1">${sayBtn(EM.cause)}<span lang="en">${esc(EM.cause)}</span></span><span class="ko1 c-act">일으키는 쪽 → -ing · ${esc(EM.ko[0])}</span></li>
        <li><span class="en1">${sayBtn(EM.feel)}<span lang="en">${esc(EM.feel)}</span></span><span class="ko1 c-pass">느끼는 쪽 → -ed · ${esc(EM.ko[1])}</span></li></ul>`;
  },
  korean: () => `<h2>직접 해 보기</h2><h3>일으키나, 느끼나?</h3>${sortList(PT.SORT_EMO, 'se')}
    <p class="note">‘사람이면 -ed’는 지름길일 뿐이에요. 첫 문장의 speaker처럼 사람이어도 남을 지루하게 하면 -ing.</p>`,
  clause: () => `<h2>직접 해 보기</h2><h3>분사구문의 주인</h3>${miniQ(13)}${miniQ(15)}
    <p class="note">분사구문의 주인은 콤마 뒤 주절의 주어예요. 먼저 그 주어에 손가락을 대고 물어보세요.</p>`,
  conj: () => `<h2>직접 해 보기</h2><h3>접속사 + 분사</h3>${sortList(PT.SORT_CONJ, 'sc')}${miniQ(11)}`,
  method: () => {
    const P = S.path || {};
    const opt = (obj, cur) => ['<option value="">고르기</option>'].concat(Object.entries(obj).map(([k, v]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${esc(typeof v === 'string' ? v : v.name)}</option>`)).join('');
    let out = '';
    if (P.slot && P.rel && P.after) {
      const R = PT.decide(P.slot, P.rel, P.after);
      out = R.ok ? `<p class="verdict"><b class="c-ok">${esc(R.text)}</b></p><p class="note">${esc(R.why)}</p>`
        : `<p class="verdict"><b class="c-no">이런 짝은 없어요.</b> ${esc(R.why)}</p>`;
    }
    return `<h2>직접 해 보기</h2><h3>3단계 판정기</h3>
      <p class="note">빈칸의 자리, 주인과 동사의 관계, 분사 뒤에 오는 말을 고르면 흐름도에 길이 켜지고 알맞은 분사가 나와요.</p>
      <div class="pick"><span>① 자리</span><select id="labS" class="sel">${opt(PT.SLOT, P.slot)}</select></div>
      <div class="pick"><span>② 관계</span><select id="labR" class="sel">${opt(PT.REL, P.rel)}</select></div>
      <div class="pick"><span>③ 뒤</span><select id="labA" class="sel">${opt(PT.AFTER, P.after)}</select></div>
      ${out}${S.path ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${PT.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 주인 바꾸기 실험실</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${PT.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showAt(u) { const ch = CHAPTERS[PTS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
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
  if (b.dataset.seek) { seek(CHAPTERS[PTS.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { S.path = null; touch(); buildLab(PTS.chapterAt(T)); return; }
  if (b.dataset.k != null) {                                // 빈칸 문제
    const box = b.closest('.mini'), it = PT.DRILL[+box.dataset.q], k = +b.dataset.k, j = PT.judgeOpt(it, k);
    mark(box, b, j.s === 'ok', `${PT.formName(it.opts[k][1])}. ` + (j.s === 'ok' ? '맞아요! ' : '아니에요. ') + j.why);
    return;
  }
  if (b.dataset.f) {                                        // -ing · -ed 고르기
    const li = b.closest('li'), list = li.dataset.se != null ? PT.SORT_EMO : PT.SORT_CONJ, it = list[+(li.dataset.se != null ? li.dataset.se : li.dataset.sc)];
    const j = PT.judge(b.dataset.f, PT.sortCtx(it));
    mark(li, b, j.s === 'ok', (j.s === 'ok' ? '맞아요. ' : '다시 보세요. ') + j.why);
    return;
  }
  if (b.dataset.p) {                                        // 자동사일까?
    const li = b.closest('li'), w = li.dataset.w, D = PT.verb(w), vi = D.type === 'vi', ok = (b.dataset.p === 'vi') === vi;
    mark(li, b, ok, (ok ? '맞아요. ' : '다시 보세요. ') + `${w} = ${D.mean}. ` + (vi ? `목적어 없이 쓰는 자동사 → 당할 수 없어서 늘 ${D.f[4]}.` : `목적어를 갖는 타동사 → 하는 쪽이면 ${D.f[4]}, 당하는 쪽이면 ${D.f[3]}.`));
    return;
  }
  const id = CHAPTERS[PTS.chapterAt(T)].id;
  if (b.dataset.v01 != null) { S.v01 = +b.dataset.v01; showAt(19.4); }
  else if (b.dataset.pair != null) { S.pair = +b.dataset.pair; showAt(19.6); }
  else if (b.dataset.own != null && id === 'core') { S.own = b.dataset.own || null; showAt(19.6); }
  else if (b.dataset.when != null) { S.when = b.dataset.when || null; showAt(9.6); }
  else if (b.dataset.emo != null) { S.emo = +b.dataset.emo; showAt(19.6); }
  else return;
  touch(); buildLab(PTS.chapterAt(T));
});
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'labFull') { S.full = t.checked; showAt(25.4); }
  else if (['labS', 'labR', 'labA'].includes(t.id)) {
    const slot = $('labS').value, rel = $('labR').value, after = $('labA').value;
    S.path = slot || rel || after ? { slot, rel, after } : null;   // 셋을 다 골라야 흐름도가 켜짐
    showAt(25);
  } else return;
  touch(); buildLab(PTS.chapterAt(T));
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // -ing · -ed는 한국어로 ‘잉’ · ‘이디’, (A)~(D)는 한국어 이름으로, p.p.는 ‘과거분사’, ‘주인 = file’의 =는 쉼으로
  read: [[/\s*\(p\.p\.\)/g, ''], [/p\.p\./g, '과거분사'], [/-ing\b/g, '잉'], [/-ed\b/g, '이디'],
    [/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/T03/g, '세 번째 튜토리얼'], [/ = /g, ', '], [/TOEIC/g, '토익'], [/Part 5/g, '파트 5']],
  rate: () => speed,
  holdBefore: 0.05,
  clips: window.EN_CLIPS,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 — 주인 바꾸기 실험실
   ========================================================= */
const OX = { sw: 1000, vi: 0, oi: 0, guess: true, pick: null, tries: 0, hits: 0, pos: 0, from: 0, t0: 0, raf: 0 };
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const stageCv = $('oStage'), stageG = stageCv.getContext('2d');
const oCur = () => { const E = PT.LAB[OX.vi], O = E.owners[OX.oi]; return { E, O, X: PT.explain(E, O), side: PT.REL[O.rel].side === 'R' ? 1 : 0 }; };
function oDraw(reveal) {
  const { E } = oCur(), p = reduce ? 1 : clamp((performance.now() - OX.t0) / 600);
  PTS.stage(stageG, E, { w: OX.sw, own: lerp(OX.from, OX.pos, p), reveal });
  if (p < 1) OX.raf = requestAnimationFrame(() => oDraw(reveal));
}
// from: 고리가 움직이기 시작할 자리 (없으면 움직이지 않음)
function oBuild(from) {
  const { E, O, X, side } = oCur(), D = PT.verb(E.v), shown = !OX.guess || OX.pick != null;
  $('oVerb').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === OX.vi)));
  $('oOwner').innerHTML = E.owners.map((o, i) => `<button type="button" data-i="${i}" aria-pressed="${i === OX.oi}"><span lang="en">${esc(o.n)}</span></button>`).join('') +
    (E.owners.length < 2 ? '<span class="note">자동사라서 주인은 하는 쪽 하나뿐이에요</span>' : '');
  $('oKind').textContent = `${D.w} = ${D.mean} · ${{ vt: '타동사 (하는 쪽 · 당하는 쪽이 있음)', vi: '자동사 (받는 쪽이 없음)', emo: '감정 동사 (일으키는 쪽 · 느끼는 쪽)' }[D.type]}`;
  $('oFills').innerHTML = X.fills.map((f, k) => {
    const ok = f.j.s === 'ok', st = shown ? (ok ? ' right' : ' wrong') : '', picked = OX.pick === k ? ' picked' : '';
    return `<div class="ofill${st}${picked}"><button type="button" class="ochoose" data-k="${k}"${shown ? ' disabled' : ''} aria-label="${k + 1}번 문장 고르기"><b>${k + 1}</b> <span lang="en">${esc(f.text).replace(esc(f.w), `<u>${esc(f.w)}</u>`)}</span></button>` +
      (shown ? `<p class="owhy">${sayBtn(f.text)}<span>${ok ? '맞아요' : '×'} · ${esc(f.j.why)}</span></p>` : '') + '</div>';
  }).join('');
  $('oSteps').innerHTML = shown ? X.steps.map(s => `<li>${esc(s)}</li>`).join('') : '';
  $('oSteps').hidden = !shown;
  $('oKo').textContent = shown ? O.ko : OX.guess ? '두 문장 가운데 맞는 쪽을 골라 보세요. 그림의 하늘색 고리가 주인이에요.' : '';
  $('oScore').textContent = OX.tries ? `한 번에 맞힘 ${OX.hits} / ${OX.tries}` : '';
  OX.from = from == null ? side : from; OX.pos = side; OX.t0 = performance.now();
  cancelAnimationFrame(OX.raf);
  oDraw(shown);
}
function oSet(vi, oi) {
  const prev = oCur().side;
  OX.vi = (vi + PT.LAB.length) % PT.LAB.length; OX.oi = oi % PT.LAB[OX.vi].owners.length; OX.pick = null;
  oBuild(prev); keepFocus();
}
// 다시 그리면서 초점이 있던 단추가 사라지면 실험실 상자로 초점을 돌려 키보드 조작이 이어지게 함
function keepFocus() { if (!$('own').contains(document.activeElement)) $('own').focus({ preventScroll: true }); }
function oPick(k) {
  if (OX.pick != null || !OX.guess) return;
  const { X } = oCur();
  OX.pick = k; OX.tries++; if (X.fills[k].j.s === 'ok') OX.hits++;
  oBuild();
  const f = $('oFills').querySelector('[data-say]'); if (f) f.focus({ preventScroll: true }); else keepFocus();
}
function oResize() {
  const r = stageCv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  OX.sw = r.width < 560 ? 620 : PTS.STAGE.w;                // 좁은 화면에서는 그림을 덜 줄여 글자를 읽을 수 있게
  stageCv.style.aspectRatio = `${OX.sw} / ${PTS.STAGE.h}`;
  stageCv.width = Math.max(1, Math.round(r.width * d)); stageCv.height = Math.max(1, Math.round(r.width * d * PTS.STAGE.h / OX.sw));
  const { side } = oCur(); OX.from = OX.pos = side; oDraw(!OX.guess || OX.pick != null);
}
function ownInit() {
  $('oVerb').innerHTML = PT.LAB.map((E, i) => `<button type="button" data-i="${i}" aria-pressed="false"><span lang="en">${esc(E.v)}</span></button>`).join('');
  $('oVerb').addEventListener('click', e => { const b = e.target.closest('button'); if (b) oSet(+b.dataset.i, 0); });
  $('oOwner').addEventListener('click', e => { const b = e.target.closest('button'); if (b) oSet(OX.vi, +b.dataset.i); });
  $('oFills').addEventListener('click', e => { const b = e.target.closest('.ochoose'); if (b) oPick(+b.dataset.k); });
  $('oGuess').addEventListener('change', e => { OX.guess = e.target.checked; OX.pick = null; oBuild(); });
  $('own').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('input, select'))) return;
    const k = e.key.toLowerCase();
    if (k === '1' || k === '2') { e.preventDefault(); oPick(+k - 1); }
    else if (k === 'o') { e.preventDefault(); oSet(OX.vi, OX.oi + 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); oSet(OX.vi + 1, 0); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); oSet(OX.vi - 1, 0); }
  });
  new ResizeObserver(oResize).observe(stageCv);
  oResize(); oBuild();
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', own: '#6EC8FF', p: '#FFC15E', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
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
// 관계 그림 그림 문제: A 하는 쪽 상자 · B 화살표(동사) · C 당하는 쪽 상자
function relFig(D, label) {
  let at = null;
  return {
    width: 600, height: 170, label,
    pick: (x, y) => { if (!at || y < 40 || y > 150) return -1; const { bL, bR } = at; if (x >= bL.x && x <= bL.x + bL.w) return 0; if (x >= bR.x && x <= bR.x + bR.w) return 2; if (x > bL.x + bL.w && x < bR.x) return 1; return -1; },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 170);
      at = PTS.relDiagram(g, 300, 92, D, { size: 20, span: 400, p: 1, lab: 0, ownA: 0 });
      const { bL, bR } = at, regs = [bL, { x: bL.x + bL.w + 6, y: bL.y, w: bR.x - bL.x - bL.w - 12, h: bL.h }, bR];
      regs.forEach((r, k) => {
        const on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        if (st.hover === k || on || wrong) { rrq(g, r.x - 6, r.y - 8, r.w + 12, r.h + 16, 12); g.strokeStyle = on ? QCOL.p : wrong ? QCOL.bad : QCOL.muted; g.lineWidth = 3; g.stroke(); }
        g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABC'[k], r.x + r.w / 2, 30);
      });
    },
  };
}
const FIG_REL = relFig({ L: 'the manager', R: 'the guests', v: 'invite', ko: '초대하다' }, '관계 그림: A 상자 the manager, B 화살표 invite(초대하다), C 상자 the guests');
const FIG_CLAUSE = wordFig([['Located', 0, 'p'], ['near', -1], ['the station', 1], [',', -1], ['the hotel', 2, 'own'], ['attracts', -1], ['many tourists', 3], ['.', -1]],
  '문장 Located near the station, the hotel attracts many tourists. 네 덩어리에 A부터 D까지 표시된 그림');
const QS = (() => {
  // 보기마다 code를 붙여 규칙 엔진으로 정답을 확인
  const by = (codes, c) => codes.map(code => PT.judge(code, c).s === 'ok').join();
  const q = [
    { q: '‘the attached file’에서 attached가 하는 일은?', opts: ['문장의 동사예요.', '뒤의 명사 file을 꾸며요.', 'file의 목적어예요.', '과거에 일어났다는 표시예요.'], a: 1,
      why: '분사는 동사에서 나왔지만 형용사처럼 명사를 꾸며요. attached → 첨부된. 과거라는 때의 표시가 아니에요(03장).' },
    { q: '‘The manager invited the guests.’ 그림에서 ‘the invited guests’의 주인은 어디일까요? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C'], a: 2, figure: FIG_REL,
      why: 'the invited guests → 주인 = guests. 화살표가 도착하는 쪽(당하는 쪽)이라 -ed예요. A의 manager가 주인이면 하는 쪽이라 the manager inviting the guests가 돼요.',
      check: () => by(['ed', 'ing'], { slot: 'pre', rel: 'done', v: 'invite', owner: 'guests' }) === 'true,false' },
    { q: 'Orders ___ after 5 p.m. will be shipped the next day. 빈칸에 알맞은 말은?', opts: ['placed', 'placing', 'place', 'places'], a: 0,
      why: '주문은 손님이 넣는 것, 당하는 쪽이라 placed. 오늘 밤의 주문, 곧 앞으로의 일이어도 -ed예요. -ed는 과거가 아니라 당하는 쪽이라는 표시예요.',
      check: () => by(['ed', 'ing', 'v', 'v'], { slot: 'post', rel: 'done', v: 'place', owner: 'Orders', main: 'will be shipped' }) === 'true,false,false,false' },
    { q: '다음 가운데 명사를 꾸밀 때 늘 -ing로 쓰는 동사(자동사)는?', opts: ['attach', 'submit', 'renovate', 'remain'], a: 3,
      why: 'remain(남다) = 목적어 없이 쓰는 자동사라서 당할 수가 없어요 → the remaining seats. 나머지는 타동사라서 당하는 쪽이면 attached · submitted · renovated가 돼요.',
      check: () => ['attach', 'submit', 'renovate', 'remain'].map(w => PT.verb(w).type === 'vi').join() === 'false,false,false,true' },
    { q: 'Employees ___ the online training must submit a short report. 빈칸에 알맞은 말은?', opts: ['completing', 'completed', 'complete', 'completion'], a: 0,
      why: '주인 = employees, 교육을 마치는 쪽이에요. 뒤에 목적어(the online training)도 있으니 -ing. completed를 쓰면 -ed 뒤에 목적어가 오는 틀린 문장이 돼요.',
      check: () => by(['ing', 'ed', 'v', 'n'], { slot: 'post', rel: 'do', v: 'complete', owner: 'Employees', obj: true, main: 'must submit' }) === 'true,false,false,false' },
    { q: '‘The new offer excited the customers.’ 감정을 느끼는 쪽을 꾸미는 바른 말은?', opts: ['an excited offer', 'excited customers', 'exciting customers', 'an exciting offer'], a: 1,
      why: '감정을 느끼는 쪽 = customers → -ed, excited customers. an exciting offer도 바른 말이지만, 감정을 일으키는 쪽(offer)을 꾸미는 말이에요.',
      check: () => by(['ed', 'ing'], { slot: 'pre', rel: 'feel', v: 'excite', owner: 'customers' }) === 'true,false' && by(['ing', 'ed'], { slot: 'pre', rel: 'cause', v: 'excite', owner: 'offer' }) === 'true,false' },
    { q: '‘강의를 듣는 내내 나는 정말 지루했다.’ 영어로 바르게 옮긴 것은?', opts: ['I was really boring during the lecture.', 'I really bored during the lecture.', 'I was really bore during the lecture.', 'I was really bored during the lecture.'], a: 3,
      why: '내가 지루함을 느끼는 쪽 → bored. I was boring이라고 하면 ‘나는 남을 지루하게 하는 사람이었다’가 돼요. 한국어 ‘지루하다’ 하나가 영어에서는 둘로 나뉘어요.',
      check: () => by(['ing', 'ed'], { slot: 'comp', rel: 'feel', v: 'bore', owner: 'I', main: 'was' }) === 'false,true' },
    { q: 'Students ___ in the summer internship should contact Ms. Ahn by Friday. 빈칸에 알맞은 말은?', opts: ['interesting', 'interest', 'interested', 'interestingly'], a: 2,
      why: '주인 = students, 흥미를 느끼는 쪽 → interested. 뒤의 in도 단서예요 → interested in. interesting을 쓰면 ‘남에게 흥미를 주는 학생’이 돼요.',
      check: () => by(['ing', 'v', 'ed', 'adv'], { slot: 'post', rel: 'feel', v: 'interest', owner: 'Students', main: 'should contact' }) === 'false,false,true,false' },
    { q: '‘Located near the station, the hotel attracts many tourists.’ 분사구문 Located near the station의 주인은? 덩어리를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_CLAUSE,
      why: '분사구문의 주인은 콤마 뒤 주절의 주어 → the hotel. 호텔은 역 근처에 놓인 쪽(당하는 쪽)이라 Located(-ed)예요. the station은 장소를 말하는 말, many tourists는 주절의 목적어예요.' },
    { q: 'After ___ the contract, Ms. Yoon sent a copy to the legal team. 빈칸에 알맞은 말은?', opts: ['signing', 'signed', 'sign', 'signature'], a: 0,
      why: 'after 뒤에는 -ing가 와요. 주인 = 주절의 주어 Ms. Yoon, 서명하는 쪽이고 뒤에 목적어(the contract)도 있어요 → signing.',
      check: () => by(['ing', 'ed', 'v', 'n'], { slot: 'clause', rel: 'do', v: 'sign', owner: 'Ms. Yoon', obj: true, conj: 'After' }) === 'true,false,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[분사] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[분사] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
  const ci = PTS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * PTS.W, (e.clientY - r.top) / r.height * PTS.H]; };
const hitAt = (x, y) => started ? PTS.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.say && EN.say.supported) { if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say && EN.say.supported ? '눌러서 발음 듣기: ' + h.say : ''; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-core)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }   // 장면 첫 0.45초는 밝아지는 중이라 조금 뒤에서 멈춤

// 발음 듣기 단추(직접 해 보기·놀이터·연습 문제·용어집): 누르면 영상을 멈추고 읽음
EN.say.wire(document, { before() { if (playing) pause(); } });
ownInit();
EN.drill({
  root: $('drillRoot'), items: PT.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 3단계 풀이법이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09·10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '분사의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(PTS.baseText()).then(() => { dirty = true; oResize(); });
setTimeout(() => PTS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
