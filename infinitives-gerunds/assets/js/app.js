/* 동사 자리 · to부정사 · 동명사 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(동사 옷 입히기 · 동사 짝 사전), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(IG), 그림은 scenes.js(IV)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const IG = window.IG, IV = window.IV, S = IV.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = IV;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const cv = $('cv'), ctx = cv.getContext('2d');
IG.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = IV.fonts;
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
  const ready = new Promise(res => IV.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '진짜 동사는 하나, 나머지는 to와 -ing — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { IV.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const c = started ? IV.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (c !== lastCap) { lastCap = c; capText.innerHTML = capHTML(c) || '&nbsp;'; }
  const ci = IV.chapterAt(T);
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
  if (dirty) { dirty = false; IV.render(ctx, started ? T : POSTER); }
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
const FN = IG.FORM;
const seg = (name, items, cur, attr = 'v') => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${t}</button>`).join('')}</div>`;
const enLine = (text, cls = '') => `<p class="enline ${cls}">${sayBtn(text)}<span lang="en">${esc(text)}</span></p>`;
const fw = (w, f) => `<b class="f-${f}" lang="en">${esc(w)}</b>`;
const verdict = (j, pre = '') => `<p class="verdict"><b class="${j.s === 'ok' ? 'c-ok' : 'c-no'}">${j.s === 'ok' ? '맞아요.' : '틀려요.'}</b> ${pre}${esc(j.why)}</p>`;
// 연습 문제 하나를 직접 해 보기용 빈칸 문제로 (보기 단추 → 규칙 엔진으로 채점)
function miniQ(i) {
  const it = IG.DRILL[i];
  return `<div class="mini" data-q="${i}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map(([w], k) => `<button type="button" data-k="${k}">${esc(w)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
let VTSEL = { v: '', p: '' };                                // 04장: 고르는 중인 동사 · 전치사 (둘 다 고르면 S.vt)
let VOSEL = { v: '', f: '' };                                // 08장: 고르는 중인 동사 · 모양 (둘 다 고르면 S.vo)
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ(8)}
    <p class="note">맞든 틀리든 괜찮아요. 영상 10장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  one: () => {
    const f = S.form1, j = f ? IV.oneJudge(f) : null;
    return `<h2>직접 해 보기</h2><h3>모양 바꿔 보기 → open</h3>
      ${seg('모양', IV.ONE.map(([k, w]) => [k, `<span lang="en">${esc(w)}</span>`]), f || '', 'form')}
      ${f ? `${enLine(`We are considering ${IV.ONE.find(x => x[0] === f)[1]} a new branch.`)}<p class="verdict">진짜 동사 <b>${f === 'fin' || f === 'base' ? 2 : 1}개</b> → ${f === 'fin' || f === 'base' ? '접속사 없이 둘은 안 돼요.' : 'are considering 하나.'}</p>${verdict(j, `${esc(FN[f])}. `)}`
        : '<p class="note">모양을 고르면 화면 속 문장이 바뀌고, 진짜 동사를 세어 줘요. 시제를 가진 동사가 둘이 되면 틀린 문장이에요.</p>'}
      ${f ? '<button class="btn ghost" type="button" id="labClear">처음 문장으로</button>' : ''}`;
  },
  slot: () => `<h2>직접 해 보기</h2><h3>빈칸이 진짜 동사 자리일 때</h3>${miniQ(1)}${miniQ(0)}
    <p class="note">-ing 꼴과 to부정사에는 시제가 없어서 진짜 동사가 못 돼요. 조동사 · Please 뒤에는 동사원형.</p>`,
  two: () => {
    const k = S.fix, X = k ? IV.FIX[k] : null;
    return `<h2>직접 해 보기</h2><h3>동사 둘을 고쳐 보기</h3>
      ${seg('고치는 방법', Object.entries(IV.FIX).map(([key, x]) => [key, esc(x.name)]), k || '', 'fix')}
      ${X ? `${enLine(X.text)}<p class="verdict"><b class="${IV.fixOk(k) ? 'c-ok' : 'c-no'}">${IV.fixOk(k) ? '맞아요.' : '틀려요.'}</b> 진짜 동사 ${X.fin.length}개 (${X.fin.map(w => fw(w, 'fin')).join(', ')}) · 연결어 ${X.links}개 → ${IV.fixOk(k) ? '진짜 동사 수가 연결어 수 + 1 이하예요.' : '연결어 없이 진짜 동사가 둘이에요.'}</p>`
        : '<p class="note">방법을 고르면 화면 위쪽 문장이 바뀌고, 진짜 동사와 연결어를 세어 줘요.</p>'}
      ${miniQ(3)}`;
  },
  trans: () => {
    const A = VTSEL, r = S.vt ? IV.vtTry(S.vt.v, S.vt.p) : null;
    return `<h2>직접 해 보기</h2><h3>전치사를 넣을까, 뺄까</h3>
      <div class="pick"><span>동사</span>${seg('동사', IV.VT.map(([v]) => [v, `<span lang="en">${v}</span>`]), A.v || '', 'vt')}</div>
      <div class="pick"><span>전치사</span>${seg('전치사', IV.VTP.map(p => [p || '-', p ? `<span lang="en">${p}</span>` : '없음']), A.pSet ? (A.p || '-') : '', 'vp')}</div>
      ${r ? `${enLine(r.text)}${verdict(r.j)}` : '<p class="note">동사와 전치사를 하나씩 고르면 화면 아래쪽에 문장이 생기고, 규칙 엔진이 맞고 틀림을 알려 줘요.</p>'}
      ${S.vt ? '<button class="btn ghost" type="button" id="labClear">처음 화면으로</button>' : ''}
      ${miniQ(7)}`;
  },
  choose: () => {
    const v = S.pick, V = v ? IG.VERB[v] : null;
    return `<h2>직접 해 보기</h2><h3>동사 카드 눌러 보기</h3>
      <div class="pick"><span>to</span>${seg('to부정사를 고르는 동사', IV.CARDS.to.map(x => [x, `<span lang="en">${x}</span>`]), v || '', 'pk')}</div>
      <div class="pick"><span>-ing</span>${seg('-ing 꼴을 고르는 동사', IV.CARDS.ing.map(x => [x, `<span lang="en">${x}</span>`]), v || '', 'pk')}</div>
      ${V ? `<p class="verdict">${fw(v, V.take)} (${esc(V.ko)}) → 뒤에 <b class="f-${V.take}">${esc(FN[V.take])}</b></p>${enLine(V.ex, 'small')}` : '<p class="note">카드를 고르면 화면에서 그 동사가 켜지고 예문이 나와요.</p>'}
      ${miniQ(9)}`;
  },
  toprep: () => {
    const E = S.expr ? IG.toExpr(S.expr) : null, all = IG.PREP_TO.concat(IG.INF_TO);
    return `<h2>직접 해 보기</h2><h3>to 뒤에 명사 넣어 보기</h3>
      ${seg('표현', all.map(x => [x.e, `<span lang="en">${esc(x.e)}</span>`]), S.expr || '', 'ex')}
      ${E ? `<p class="verdict"><span lang="en">${esc(E.noun)}</span> → ${IG.isPrepTo(E.e) ? '<b class="c-ok">말이 돼요.</b> to = 전치사 → 동사는 <b class="f-ing">-ing 꼴</b>' : '<b class="c-no">말이 안 돼요.</b> to = to부정사의 to → <b class="f-base">동사원형</b>'}</p>${enLine(E.ex, 'small')}`
        : '<p class="note">표현을 고르면 to 뒤에 명사를 넣어 봐요. 말이 되면 to = 전치사예요.</p>'}
      ${miniQ(11)}`;
  },
  adjn: () => `<h2>직접 해 보기</h2><h3>형용사 · 명사 + to부정사</h3>${miniQ(12)}${miniQ(13)}
    <p class="note"><i lang="en">eligible for</i> 뒤에는 명사(<i lang="en">for the program</i>), <i lang="en">eligible to</i> 뒤에는 동사원형(<i lang="en">to apply</i>).</p>`,
  obj: () => {
    const A = VOSEL, r = S.vo ? IV.voTry(S.vo.v, S.vo.f) : null;
    return `<h2>직접 해 보기</h2><h3>목적어 다음의 동사</h3>
      <div class="pick"><span>동사</span>${seg('동사', IV.VO.map(([v]) => [v, `<span lang="en">${v}</span>`]), A.v || '', 'vo')}</div>
      <div class="pick"><span>모양</span>${seg('모양', IV.VOF.map(([f, w]) => [f, `<span lang="en">${w}</span>`]), A.f || '', 'vf')}</div>
      ${r ? `${enLine(r.text)}${verdict(r.j)}` : '<p class="note">동사와 모양을 하나씩 고르면 화면 위쪽 문장이 바뀌어요. to 없이 원형을 쓰는 동사 → make · have · let.</p>'}
      ${S.vo ? '<button class="btn ghost" type="button" id="labClear">처음 화면으로</button>' : ''}
      ${miniQ(15)}`;
  },
  method: () => {
    const P = S.path || {}, R = P.E && P.L ? IG.formFromCues(P.E, P.L) : null;
    const sel = (id, name, obj, cur) => `<div class="pick"><span>${name}</span><select id="${id}" class="sel">${['<option value="">고르기</option>'].concat(Object.entries(obj).map(([k, v]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${esc(v)}</option>`)).join('')}</select></div>`;
    let out = '';
    if (R && R.bad) out = `<p class="verdict"><b class="c-no">이 조합은 맞지 않아요.</b> ${esc(R.bad)}</p>`;
    else if (R) out = `<p class="verdict">들어갈 모양: <b class="f-${R.form}">${esc(IG.NEED[R.form])}</b></p>` + (P.R ? `<p class="verdict">③ 뒤: ${esc(IG.objAdvice(P.R))}</p>` : '<p class="note">빈칸 뒤도 고르면 ③까지 켜져요.</p>');
    return `<h2>직접 해 보기</h2><h3>동사 모양 판정기</h3>
      <p class="note">문장의 진짜 동사, 빈칸 앞, 빈칸 뒤를 고르면 흐름도에 길이 켜지고 들어갈 모양이 나와요.</p>
      ${sel('labE', '진짜 동사', IG.EN, P.E)}${sel('labL', '빈칸 앞', IG.LEFT, P.L)}${sel('labR', '빈칸 뒤', IG.RIGHT, P.R)}
      ${out}${S.path ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${IG.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 동사 옷 입히기: 문장 속 동사에 맞는 모양을 입혀 진짜 동사 하나만 남기기, 동사 짝 사전</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${IG.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 동사 모양 표와 용어</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
// 직접 해 보기의 조작은 한곳에서 처리 (다시 만들어도 이어서 동작)
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = CHAPTERS[IV.chapterAt(T)].id, d = b.dataset;
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (d.seek) { seek(CHAPTERS[IV.chapterAt(T)].t + +d.seek); return; }
  if (b.id === 'labClear') {
    if (id === 'one') S.form1 = null; else if (id === 'trans') { S.vt = null; VTSEL = { v: '', p: '' }; } else if (id === 'obj') { S.vo = null; VOSEL = { v: '', f: '' }; } else S.path = null;
    touch(); buildLab(IV.chapterAt(T)); return;
  }
  if (d.k != null) {                                        // 빈칸 문제
    const box = b.closest('.mini'), it = IG.DRILL[+box.dataset.q], k = +d.k, j = IG.judgeOpt(it, k);
    box.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(j.s === 'ok' ? 'right' : 'wrong');
    box.querySelector('.mr').textContent = `${FN[it.opts[k][1]]}. ` + (j.s === 'ok' ? '맞아요! ' : '아니에요. ') + j.why;
    if (playing) pause();
    return;
  }
  if (d.form) { S.form1 = d.form; showAt(19); }
  else if (d.fix) { S.fix = d.fix; showAt(19); }
  else if (d.vt != null || d.vp != null) {
    if (d.vt != null) VTSEL.v = d.vt; else VTSEL.p = d.vp === '-' ? '' : d.vp;
    if (d.vp != null) VTSEL.pSet = true;
    if (VTSEL.v && VTSEL.pSet) { S.vt = { v: VTSEL.v, p: VTSEL.p }; showAt(2); }
  } else if (d.pk) { S.pick = d.pk; showAt(25); }
  else if (d.ex) { S.expr = d.ex; showAt(2); }
  else if (d.vo != null || d.vf != null) {
    if (d.vo != null) VOSEL.v = d.vo; else VOSEL.f = d.vf;
    if (VOSEL.v && VOSEL.f) { S.vo = { v: VOSEL.v, f: VOSEL.f }; showAt(2); }
  } else return;
  touch(); buildLab(IV.chapterAt(T));
});
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showAt(u) { const ch = CHAPTERS[IV.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (!['labE', 'labL', 'labR'].includes(t.id)) return;
  const E = $('labE').value, L = $('labL').value, R = $('labR').value;
  S.path = E || L || R ? { E, L, R } : null;
  showAt(24);
  touch(); buildLab(IV.chapterAt(T));
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // -ing(잉)처럼 화면에 적고 소리는 괄호 속 한국어로, to부정사는 한국어로
  read: [[/-[a-z]+\(([^)]+)\)/g, '$1'], [/to부정사/g, '투부정사'], [/TOEIC/g, '토익'], [/Part 5/g, '파트 5']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 — 동사 옷 입히기 · 동사 짝 사전
   ========================================================= */
const FORMS4 = ['fin', 'base', 'to', 'ing'];
const ICONS = {
  ok: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  no: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  wait: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/></svg>',
  clock: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 10V5.6M10 10l3.3 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};
const Dz = { i: 0, st: IG.PUZ.map(P => ({ f: {}, p: Object.fromEntries(P.parts.map((x, i) => [i, x && x.p ? !!x.on : false]).filter(([, v]) => v)) })), sel: 0, solved: new Set(), shown: new Set() };
const dPuz = () => IG.PUZ[Dz.i];
const dSel = () => dPuz().parts.map((x, i) => (x && (x.v || x.p)) ? i : -1).filter(i => i >= 0);   // 고를 수 있는 조각 (동사 · 전치사)
function dRender() {
  const P = dPuz(), st = Dz.st[Dz.i], R = IG.chain(P, st), sels = dSel(), cur = sels[Dz.sel];
  if (R.done && !Dz.shown.has(Dz.i)) Dz.solved.add(Dz.i);
  $('dProg').textContent = `문장 ${Dz.i + 1} / ${IG.PUZ.length}`;
  $('dScore').textContent = `완성 ${Dz.solved.size}`;
  $('dDots').innerHTML = IG.PUZ.map((p, i) => `<button type="button" data-go="${i}" class="${Dz.solved.has(i) ? 'ok' : Dz.shown.has(i) ? 'shown' : ''}${i === Dz.i ? ' cur' : ''}" aria-label="문장 ${i + 1}${Dz.solved.has(i) ? ' 완성' : ''}"${i === Dz.i ? ' aria-current="step"' : ''}>${i + 1}</button>`).join('');
  $('dKo').innerHTML = `만들 문장: <b>${esc(P.ko)}</b>`;
  $('dSent').innerHTML = P.parts.map((x, i) => {
    if (typeof x === 'string') return `<span class="w">${esc(x)}</span>`;
    if (x.fv) return `<span class="w fixfin" title="진짜 동사(조동사)">${ICONS.clock}${esc(x.fv)}</span>`;
    const on = i === cur;
    if (x.p) return `<button type="button" class="pp ${st.p[i] ? 'on' : 'off'}${on ? ' sel' : ''}" data-i="${i}" aria-pressed="${String(!!st.p[i])}" aria-label="전치사 ${esc(x.p)} ${st.p[i] ? '넣음' : '뺌'}">${esc(x.p)}</button>`;
    const f = st.f[i], F = IG.formsOf(x.v, x.fin), r = R.res.find(q => q.i === i);
    return `<button type="button" class="vb f-${f || 'raw'}${on ? ' sel' : ''}${r && r.s === 'no' ? ' bad' : ''}" data-i="${i}" aria-label="동사 ${esc(x.v)}: ${f ? esc(FN[f]) : '아직 안 고름'}">${f === 'fin' ? ICONS.clock : ''}${esc(f ? F[f] : x.v)}</button>`;
  }).join(' ');
  const good = R.n === 1;
  $('dMeter').className = 'meter ' + (good ? 'ok' : R.n ? 'no' : 'zero');
  $('dMeter').innerHTML = `<span>진짜 동사 <b>${R.n}개</b></span><span class="clocks">${R.n ? Array.from({ length: R.n }, () => ICONS.clock).join('') : ICONS.wait}</span>${R.n ? `<span lang="en">${R.finite.map(esc).join(' · ')}</span>` : ''}`;
  const X = P.parts[cur];
  if (X && X.v) {
    const F = IG.formsOf(X.v, X.fin);
    $('dWard').innerHTML = `<span class="wl">옷 고르기 → <b lang="en">${esc(X.v)}</b></span>` + FORMS4.map((f, k) => `<button type="button" data-f="${f}" class="f-${f}" aria-pressed="${String(st.f[cur] === f)}"><kbd>${k + 1}</kbd><small>${esc(FN[f])}</small><span lang="en">${esc(F[f])}</span></button>`).join('');
  } else if (X && X.p) {
    $('dWard').innerHTML = `<span class="wl">전치사 <b lang="en">${esc(X.p)}</b></span>` + [[true, '넣기'], [false, '빼기']].map(([v, t], k) => `<button type="button" data-p="${v ? 1 : 0}" class="f-prep" aria-pressed="${String(!!st.p[cur] === v)}"><kbd>${k + 1}</kbd><small>${t}</small><span lang="en">${v ? esc(X.p) : '—'}</span></button>`).join('');
  } else $('dWard').innerHTML = '';
  $('dSteps').innerHTML = R.steps.map((s, i) => `<li class="${s.s}"><span class="ic">${ICONS[s.s]}</span><b>${['① 진짜 동사', '② 앞', '③ 뒤'][i]}</b> <span>${esc(s.text)}</span></li>`).join('');
  $('dOut').className = 'dout' + (R.done ? ' ok' : '');
  $('dOut').innerHTML = R.done ? `<b class="c-ok">${Dz.shown.has(Dz.i) ? '이렇게 완성해요.' : '완성!'}</b> ${sayBtn(R.text, '완성 문장 듣기')}<span lang="en">${esc(R.text)}</span>` : '';
  $('dNext').textContent = Dz.i + 1 < IG.PUZ.length ? '다음 문장 →' : '처음 문장으로';
  $('dDone').textContent = Dz.solved.size === IG.PUZ.length ? '열 문장을 모두 완성했어요! 진짜 동사 하나, 나머지는 앞 낱말이 고른 옷.' : '';
}
function dPick(v) {
  const sels = dSel(), cur = sels[Dz.sel], X = dPuz().parts[cur], st = Dz.st[Dz.i];
  if (X.v) st.f[cur] = v; else st.p[cur] = v;
  // 아직 옷을 안 입힌 다음 동사로 넘어감
  if (X.v) { const nx = sels.findIndex((i, k) => k > Dz.sel && dPuz().parts[i].v && !st.f[i]); if (nx >= 0) Dz.sel = nx; }
  dRender();
}
function dGo(i) { Dz.i = (i + IG.PUZ.length) % IG.PUZ.length; Dz.sel = 0; dRender(); }
function dressInit() {
  const box = $('dress');
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-say')) return;
    const d = b.dataset;
    if (d.go != null) dGo(+d.go);
    else if (d.i != null) { Dz.sel = dSel().indexOf(+d.i); const X = dPuz().parts[+d.i]; if (X.p && e.detail) { Dz.st[Dz.i].p[+d.i] = !Dz.st[Dz.i].p[+d.i]; } dRender(); }
    else if (d.f) dPick(d.f);
    else if (d.p != null) dPick(d.p === '1');
    else if (b.id === 'dNext') dGo(Dz.i + 1);
    else if (b.id === 'dReset') { const P = dPuz(); Dz.st[Dz.i] = { f: {}, p: Object.fromEntries(P.parts.map((x, i) => [i, x && x.p ? !!x.on : false]).filter(([, v]) => v)) }; Dz.shown.delete(Dz.i); Dz.solved.delete(Dz.i); Dz.sel = 0; dRender(); }
    else if (b.id === 'dShow') { const sol = IG.solve(dPuz())[0]; if (sol) { Dz.st[Dz.i] = JSON.parse(JSON.stringify(sol)); if (!Dz.solved.has(Dz.i)) Dz.shown.add(Dz.i); } dRender(); }
    else return;
    box.focus({ preventScroll: true });
  });
  box.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('[data-say]')) return;
    const sels = dSel(), X = dPuz().parts[sels[Dz.sel]];
    const n = '1234'.indexOf(e.key);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); Dz.sel = (Dz.sel + (e.key === 'ArrowRight' ? 1 : -1) + sels.length) % sels.length; dRender(); }
    else if (n >= 0 && X && X.v) { e.preventDefault(); dPick(FORMS4[n]); }
    else if (n >= 0 && n < 2 && X && X.p) { e.preventDefault(); dPick(n === 0); }
    else if (e.key === 'Enter' && IG.chain(dPuz(), Dz.st[Dz.i]).done) { e.preventDefault(); dGo(Dz.i + 1); }
    else return;
    box.focus({ preventScroll: true });
  });
  dRender();
}
function dictInit() {
  // 동사 짝 사전: 무엇이 뒤에 오는지에 따라 묶음
  const V = IG.VERB, li = (w, f, ko, ex) => `<li>${sayBtn(ex)}<b class="f-${f}" lang="en">${esc(w)}</b><span>${esc(ko)}</span><i lang="en">${esc(ex)}</i></li>`;
  const groups = [
    ['to', '뒤에 to부정사', ['decide', 'plan', 'agree', 'hope', 'expect', 'aim', 'intend', 'refuse', 'offer', 'want', 'promise', 'manage', 'fail'].map(v => li(v, 'to', V[v].ko, V[v].ex))],
    ['ing', '뒤에 -ing 꼴', ['consider', 'avoid', 'suggest', 'recommend', 'finish', 'postpone', 'mind', 'enjoy', 'deny', 'delay', 'keep'].map(v => li(v, 'ing', V[v].ko, V[v].ex))],
    ['to', '목적어 + to부정사', ['ask', 'encourage', 'allow', 'require', 'enable', 'remind', 'advise', 'invite', 'urge'].map(v => li(v, 'to', V[v].ko, V[v].ex))],
    ['base', '목적어 + 동사원형 (사역동사)', ['make', 'have', 'let'].map(v => li(v, 'base', V[v].ko, V[v].ex))],
    ['ing', 'to가 전치사 → -ing 꼴', IG.PREP_TO.map(x => li(x.e, 'ing', x.ko, x.ex))],
    ['to', '형용사 · 명사 + to부정사', Object.entries(IG.ADJ).map(([w, ko]) => li('be ' + w, 'to', ko, `be ${w} to ${{ eligible: 'apply', able: 'attend', likely: 'increase', willing: 'help', ready: 'start', pleased: 'announce' }[w]}`))
      .concat(Object.entries(IG.NOUN).map(([w, ko]) => li('the ' + w, 'to', ko, `the ${w} to ${{ ability: 'share files', effort: 'reduce costs', plan: 'expand', opportunity: 'work abroad', decision: 'merge', chance: 'win' }[w]}`)))],
    ['base', '목적어를 바로 잡는 동사 (타동사)', ['discuss', 'attend', 'contact', 'reach', 'enter', 'mention', 'approach', 'answer', 'address'].map(v => li(v, 'base', V[v].ko, V[v].ex))],
    ['prep', '전치사와 짝인 동사 (자동사)', ['respond', 'reply', 'comply', 'participate', 'talk', 'comment', 'listen', 'apologize', 'apply'].map(v => li(`${v} ${V[v].obj}`, 'prep', V[v].ko, V[v].ex))],
  ];
  $('vdict').innerHTML = groups.map(([f, title, items]) => `<section><h4 class="f-${f}">${esc(title)}</h4><ul>${items.join('')}</ul></section>`).join('');
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', fin: '#C9A7FF', to: '#7FE0A8', ing: '#6EC8FF', base: '#D4E157', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
function qclock(g, x, y, r, c) { g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - r * 0.6); g.moveTo(x, y); g.lineTo(x + r * 0.45, y + r * 0.1); g.stroke(); }
// 그림 문제 1: 문장 속 네 덩어리 → 진짜 동사는?
const FIG_FIN = (() => {
  const parts = [['We', 0, ''], ['are considering', 1, 'fin'], ['opening', 2, 'ing'], ['a new', -1, ''], ['branch', 3, ''], ['.', -1, '']];
  let boxes = [];
  return {
    width: 600, height: 150, label: '문장 We are considering opening a new branch. 네 덩어리에 A부터 D까지 표시된 그림: A We, B are considering, C opening, D branch',
    pick: (x, y) => boxes.findIndex(b => b && x >= b.x - 4 && x <= b.x + b.w + 4 && y >= 40 && y <= 125),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 150);
      const size = 22, sp = 10; g.font = qfont(size, 600); g.textBaseline = 'middle';
      const width = parts.reduce((s, [w]) => s + g.measureText(w).width + (w === '.' ? 0 : sp), 0);
      let x = (600 - width) / 2; boxes = [];
      parts.forEach(([w, k, f]) => {
        if (w === '.') x -= sp;
        g.font = qfont(size, 600);
        const ww = g.measureText(w).width, on = st.done && k === st.answer, wrong = st.done && k >= 0 && k === st.pick && k !== st.answer;
        if (k >= 0) {
          boxes[k] = { x, w: ww };
          if (st.hover === k || on || wrong) { rrq(g, x - 4, 74, ww + 8, 36, 6); g.fillStyle = on ? 'rgba(255,193,94,0.22)' : wrong ? 'rgba(255,142,142,0.2)' : QCOL.hover; g.fill(); }
          g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.fillText('ABCD'[k], x + ww / 2, 50);
          g.font = qfont(size, 600);
        }
        g.textAlign = 'left'; g.fillStyle = st.done && f ? QCOL[f] : QCOL.text; g.fillText(w, x, 92);
        if (st.done && f === 'fin') qclock(g, x + ww / 2, 122, 7, QCOL.fin);
        x += ww + sp;
      });
    },
  };
})();
// 그림 문제 2: 동사 카드 네 장 → 뒤에 -ing 꼴을 고르는 동사는?
const CARD4 = ['plan', 'hope', 'avoid', 'decide'];
const FIG_SORT = (() => {
  const box = k => ({ x: 24 + k * 142, y: 36, w: 128, h: 64 });
  return {
    width: 600, height: 150, label: '동사 카드 네 장: A plan, B hope, C avoid, D decide',
    pick: (x, y) => CARD4.findIndex((v, k) => { const b = box(k); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 150);
      g.textBaseline = 'middle';
      CARD4.forEach((v, k) => {
        const b = box(k), on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        const c = st.done ? (IG.VERB[v].take === 'ing' ? QCOL.ing : QCOL.to) : QCOL.muted;
        rrq(g, b.x, b.y, b.w, b.h, 10); g.fillStyle = on ? 'rgba(255,193,94,0.18)' : wrong ? 'rgba(255,142,142,0.18)' : st.hover === k ? QCOL.hover : '#18202A'; g.fill();
        g.strokeStyle = c; g.lineWidth = on ? 2.5 : 1.5; g.stroke();
        g.font = qfont(13, 700); g.fillStyle = QCOL.key; g.textAlign = 'left'; g.fillText('ABCD'[k], b.x + 10, b.y + 14);
        g.font = qfont(20, 700); g.fillStyle = QCOL.text; g.textAlign = 'center'; g.fillText(v, b.x + b.w / 2, b.y + b.h / 2 + 2);
        if (st.done) { g.font = qfont(12, 700); g.fillStyle = c; g.fillText(IG.VERB[v].take === 'ing' ? '+ -ing' : '+ to', b.x + b.w / 2, b.y + b.h + 14); }
      });
    },
  };
})();
const QS = (() => {
  const by = (opts, slot) => opts.map(o => IG.isOk({ w: o[0], f: o[1], v: o[2] }, slot)).join();
  const q = [
    { q: '한 문장에서 접속사 없이 쓸 수 있는 진짜 동사(시제를 가진 동사)는 몇 개?', opts: ['둘', '하나', '셋', '제한 없음'], a: 1,
      why: '진짜 동사는 한 문장에 하나예요. 동사를 더 쓰려면 접속사 · 연결어로 잇거나, to부정사 · -ing 꼴로 모양을 바꿔요.',
      check: () => IG.clauseOk(1, 0) && !IG.clauseOk(2, 0) && IG.clauseOk(2, 1) },
    { q: '‘We are considering opening a new branch.’ 시제를 가진 진짜 동사는? 덩어리를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1, figure: FIG_FIN,
      why: '시제(지금 하는 중)를 가진 진짜 동사 → are considering. opening → 동사가 -ing 꼴로 모양을 바꾼 말이라 시제가 없어요.',
      check: () => IG.judgeOpt(IG.DRILL[8], 2).s === 'ok' && IG.DRILL[8].slot.main === 'are considering' },
    { q: 'Visitors must ___ at the front desk. 빈칸에 알맞은 말은?', opts: ['registering', 'to register', 'registration', 'register'], a: 3,
      why: '조동사 must 뒤에는 동사원형이 와서 함께 진짜 동사가 돼요. -ing 꼴, to부정사, 명사는 진짜 동사가 못 돼요.',
      check: () => by([['registering', 'ing', 'register'], ['to register', 'to', 'register'], ['registration', 'n', 'register'], ['register', 'base', 'register']], { eng: 'empty', gov: 'modal', at: 'must' }) === 'false,false,false,true' },
    { q: '‘Staff attend the seminar will receive a manual.’ 이 문장이 틀린 까닭은?', opts: ['진짜 동사가 둘인데 이어 주는 접속사가 없어서', '주어가 복수라서', '관사가 두 번 나와서', '조동사 뒤에 동사원형이 와서'], a: 0,
      why: '진짜 동사 → attend, will receive. 시제를 가진 동사가 둘이에요. Staff attending the seminar … 처럼 -ing 꼴로 바꾸거나, Staff who attend … 처럼 연결어를 넣어요.',
      check: () => !IV.fixOk('raw') && IV.fixOk('who') && IV.fixOk('ing') },
    { q: 'All staff must ___ with the new safety rules. 빈칸에 알맞은 말은?', opts: ['follow', 'obey', 'comply', 'observe'], a: 2,
      why: '빈칸 뒤 → 전치사 with. 짝이 맞는 동사 → comply with(~을 따르다). follow · obey · observe → 목적어를 바로 잡아서 전치사가 필요 없어요.',
      check: () => by([['follow', 'base', 'follow'], ['obey', 'base', 'obey'], ['comply', 'base', 'comply'], ['observe', 'base', 'observe']], { eng: 'empty', gov: 'modal', at: 'must', obj: 'with' }) === 'false,false,true,false' },
    { q: '뒤에 오는 동사를 -ing 꼴로 고르는 동사는? 카드를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_SORT,
      why: 'avoid → avoid making mistakes처럼 뒤에 -ing 꼴. plan · hope · decide → 뒤에 to부정사(plan to open).',
      check: () => CARD4.map(v => IG.VERB[v].take === 'ing').join() === 'false,false,true,false' },
    { q: '다음 가운데 to → 전치사, 그래서 뒤에 -ing 꼴이 오는 표현은?', opts: ['hope to', 'plan to', 'be able to', 'look forward to'], a: 3,
      why: 'look forward to 뒤에 명사를 넣어 보세요 → look forward to the meeting. 말이 되니 to = 전치사 → 동사는 -ing 꼴: look forward to meeting.',
      check: () => ['hope to', 'plan to', 'be able to', 'look forward to'].map(e => IG.isPrepTo(e)).join() === 'false,false,false,true' },
    { q: 'The new printer is able ___ 50 pages per minute. 빈칸에 알맞은 말은?', opts: ['print', 'to print', 'printing', 'printed'], a: 1,
      why: '형용사 able → 뒤에 to부정사(be able to + 원형). 진짜 동사 is → 이미 있으니 printed → 안 돼요.',
      check: () => by([['print', 'base', 'print'], ['to print', 'to', 'print'], ['printing', 'ing', 'print'], ['printed', 'fin', 'print']], { eng: 'full', gov: 'adj', by: 'able', at: 'able', main: 'is' }) === 'false,true,false,false' },
    { q: 'The manager had his assistant ___ a table for the dinner. 빈칸에 알맞은 말은?', opts: ['book', 'to book', 'books', 'booked'], a: 0,
      why: 'have + 목적어 + 동사원형(사역동사). 같은 동사 → make · let. ask · encourage · allow → to부정사.',
      check: () => by([['book', 'base', 'book'], ['to book', 'to', 'book'], ['books', 'fin', 'book'], ['booked', 'fin', 'book']], { eng: 'full', gov: 'vo', by: 'have', at: 'had his assistant', main: 'had', obj: 'direct' }) === 'true,false,false,false' },
    { q: '동사 모양 문제를 푸는 3단계 풀이법의 순서로 알맞은 것은?', opts: ['앞 → 뒤 → 진짜 동사', '뒤 → 진짜 동사 → 앞', '진짜 동사 → 앞 → 뒤', '진짜 동사 → 뒤 → 앞'], a: 2,
      why: '① 진짜 동사를 세서 빈칸이 진짜 동사 자리인지 정하고 → ② 빈칸 앞 낱말이 고르는 모양을 보고 → ③ 빈칸 뒤의 목적어 · 전치사로 확인해요.' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[동사 자리] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[동사 자리] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
  const ci = IV.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * IV.W, (e.clientY - r.top) / r.height * IV.H]; };
const hitAt = (x, y) => started ? IV.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.say && EN.say.supported) { if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say && EN.say.supported ? '눌러서 발음 듣기: ' + h.say : ''; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-toprep)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }   // 장면 첫 0.45초는 밝아지는 중이라 조금 뒤에서 멈춤

// 발음 듣기 단추(직접 해 보기·놀이터·연습 문제·용어집): 누르면 영상을 멈추고 읽음
EN.say.wire(document, { before() { if (playing) pause(); } });
dressInit();
dictInit();
EN.drill({
  root: $('drillRoot'), items: IG.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 3단계 풀이법이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09·10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '동사 모양의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(IV.baseText()).then(() => { dirty = true; });
setTimeout(() => IV.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
