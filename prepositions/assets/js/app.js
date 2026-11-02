/* 전치사 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(까지 갈림길 · 짝 카드), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(PR), 그림은 scenes.js(PRS)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const PR = window.PR, PRS = window.PRS, S = PRS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = PRS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cv = $('cv'), ctx = cv.getContext('2d');
PR.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = PRS.fonts;
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
  const ready = new Promise(res => PRS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '전치사, 그림으로 보고 짝으로 외워라 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { PRS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const cap = started ? PRS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = PRS.chapterAt(T);
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
  if (dirty) { dirty = false; PRS.render(ctx, started ? T : POSTER); }
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
  const it = PR.DRILL[i];
  return `<div class="mini" data-q="${i}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map((w, k) => `<button type="button" data-k="${k}">${esc(w)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
// 보기 단추가 붙은 문장 목록 (자리의 뜻은 문장마다 데이터에 적어 둠)
const LISTS = { un: PR.UNITS, bu: PR.BU, fd: PR.FD, iw: PR.IW, pl: PR.PLACE, ex: PR.EXTRA, pa: PR.PAIRLAB };
const optList = name => `<ol class="gapq">${LISTS[name].map((it, i) => `<li data-l="${name}" data-i="${i}"><span lang="en" class="ph long">${esc(it.q).replace('___', '<span class="blank sm">&nbsp;</span>')}${it.hint ? ` <small lang="ko">(${esc(it.hint)})</small>` : ''}</span><span class="mo">${it.opts.map(o => `<button type="button" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</span><span class="mr" role="status"></span></li>`).join('')}</ol>`;
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ(0)}
    <p class="note">맞든 틀리든 괜찮아요. 영상 10장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  korean: () => {
    const list = S.ko == null ? PR.KO : [PR.KO[S.ko]];
    return `<h2>직접 해 보기</h2><h3>조사 하나를 골라 보기</h3>
      ${seg('한국어 조사', [['', '영상대로']].concat(PR.KO.map((k, i) => [i, k.k])), S.ko == null ? '' : S.ko, 'ko')}
      <ul class="pairs">${list.map(K => K.en.map(([w, ko, ex]) => `<li><span class="en1">${sayBtn(ex)}<span lang="en"><b class="v">${esc(w)}</b>${esc(ex.slice(w.length))}</span></span><span class="ko1">‘${esc(K.k)}’ · ${esc(ko)}</span></li>`).join('')).join('')}</ul>
      <p class="note">한국어 조사 하나가 영어에서는 뒤의 명사와 그림에 따라 여러 전치사로 나뉘어요. ‘안에’의 <span lang="en">in two weeks</span>는 ‘2주 안에’가 아니라 ‘2주 뒤’라는 점을 조심하세요.</p>`;
  },
  atonin: () => `<h2>직접 해 보기</h2><h3>크기를 골라 보기</h3>
    ${seg('크기', [['', '영상대로'], ['at', 'at · 점'], ['on', 'on · 날'], ['in', 'in · 큰 칸']], S.lvl || '', 'lvl')}
    <h3 class="mt">at · on · in 맞히기</h3>${optList('un')}`,
  byuntil: () => `<h2>직접 해 보기</h2><h3>예문 바꿔 보기</h3>
    ${seg('예문', PR.BYUNTIL.map((b, i) => [i, `${b.byN} · ${b.unN}`]), S.bu || 0, 'bu')}
    ${enLine(PR.BYUNTIL[S.bu || 0].by, 'small')}${enLine(PR.BYUNTIL[S.bu || 0].un, 'small')}
    <h3 class="mt">끝나나, 이어지나?</h3>${optList('bu')}
    <p class="note">시간선에 직접 점을 놓아 보려면 아래 <a href="#playground">놀이터 ‘까지 갈림길’</a>로 가세요.</p>`,
  fordur: () => `<h2>직접 해 보기</h2><h3>길이일까, 사건일까?</h3>${optList('fd')}${miniQ(4)}`,
  since: () => `<h2>직접 해 보기</h2><h3>since + 현재완료</h3>${miniQ(5)}
    <h3 class="mt">그만큼 뒤? 그 안에?</h3>${optList('iw')}
    <p class="note">현재완료와 since · for의 시제 이야기는 <a href="../verb-tense/index.html">T04 시제</a>에서 더 자세히 다뤄요.</p>`,
  place: () => `<h2>직접 해 보기</h2><h3>장소 그림 고르기</h3>${optList('pl')}${miniQ(8)}`,
  extra: () => `<h2>직접 해 보기</h2><h3>뜻을 더하는 전치사</h3>${optList('ex')}${miniQ(9)}`,
  pairs: () => `<h2>직접 해 보기</h2><h3>짝 고르기</h3>${optList('pa')}
    <p class="note">짝 열다섯 개를 카드로 외워 보려면 아래 <a href="#pairs-card">놀이터 ‘짝 카드’</a>로 가세요.</p>`,
  method: () => {
    const P = S.path || {};
    const opt = (pairs, cur) => ['<option value="">고르기</option>'].concat(pairs.map(([k, v]) => `<option value="${esc(k)}"${cur === k ? ' selected' : ''}>${esc(v)}</option>`)).join('');
    const nouns = !P.cls ? [] : P.cls === 'pair' ? Object.keys(PR.PAIRS).map(w => [w, w]) : PR.nounsOf(P.cls).map(n => [n, PR.NOUN[n].name]);
    const pics = P.cls && P.cls !== 'pair' && P.noun ? PR.picsOf(P.cls, P.noun).map(p => [p, PR.picName(p, P.cls, P.noun)]) : [];
    let out = '';
    if (P.cls && P.noun && (P.cls === 'pair' || P.pic)) {
      const R = PR.decide(P.cls, P.noun, P.pic);
      out = R.ok ? `<p class="verdict"><b class="c-ok" lang="en">${esc(R.text)}</b></p><p class="note">${esc(R.why)}</p>` : `<p class="verdict"><b class="c-no">이런 짝은 없어요.</b> ${esc(R.why)}</p>`;
    }
    return `<h2>직접 해 보기</h2><h3>3단계 판정기</h3>
      <p class="note">무엇을 나타내는지, 뒤의 명사가 무엇인지, 어떤 그림인지 고르면 흐름도에 길이 켜지고 알맞은 전치사가 나와요.</p>
      <div class="pick"><span>① 무엇</span><select id="labC" class="sel">${opt(Object.entries(PR.CLS).map(([k, v]) => [k, v.name]), P.cls)}</select></div>
      <div class="pick"><span>${P.cls === 'pair' ? '② 앞 낱말' : '② 뒤의 명사'}</span><select id="labN" class="sel"${P.cls ? '' : ' disabled'}${P.cls === 'pair' ? ' lang="en"' : ''}>${opt(nouns, P.noun)}</select></div>
      ${P.cls === 'pair' ? '' : `<div class="pick"><span>③ 그림</span><select id="labP" class="sel"${pics.length ? '' : ' disabled'}>${opt(pics, P.pic)}</select></div>`}
      ${out}${S.path ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${PR.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 까지 갈림길 (시간선 실험실)</li><li><a href="#pairs-card">짝 카드</a> — 짝 표현 열다섯 개 외우기</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${PR.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showAt(u) { const ch = CHAPTERS[PRS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
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
  if (b.dataset.seek) { seek(CHAPTERS[PRS.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { S.path = null; touch(); buildLab(PRS.chapterAt(T)); return; }
  if (b.dataset.k != null) {                                // 빈칸 문제
    const box = b.closest('.mini'), it = PR.DRILL[+box.dataset.q], k = +b.dataset.k, j = PR.judgeOpt(it, k);
    mark(box, b, j.s === 'ok', (j.s === 'ok' ? '맞아요! ' : '아니에요. ') + j.why);
    return;
  }
  if (b.dataset.o != null) {                                // 보기 단추가 붙은 문장
    const li = b.closest('li'), it = LISTS[li.dataset.l][+li.dataset.i], j = PR.judge(b.dataset.o, it);
    mark(li, b, j.s === 'ok', (j.s === 'ok' ? '맞아요. ' : '다시 보세요. ') + j.why);
    return;
  }
  if (b.dataset.ko != null) { S.ko = b.dataset.ko === '' ? null : +b.dataset.ko; showAt(21); }
  else if (b.dataset.lvl != null) { S.lvl = b.dataset.lvl || null; showAt(19.4); }
  else if (b.dataset.bu != null) { S.bu = +b.dataset.bu; showAt(30.6); }
  else return;
  touch(); buildLab(PRS.chapterAt(T));
});
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (!['labC', 'labN', 'labP'].includes(t.id)) return;
  const P = S.path || {};
  if (t.id === 'labC') S.path = t.value ? { cls: t.value } : null;
  else if (t.id === 'labN') S.path = Object.assign({}, P, { noun: t.value || undefined, pic: undefined });
  else S.path = Object.assign({}, P, { pic: t.value || undefined });
  if (S.path && S.path.cls && S.path.noun && !S.path.pic && S.path.cls !== 'pair') {   // 그림이 하나뿐이면 저절로 고름
    const pics = PR.picsOf(S.path.cls, S.path.noun); if (pics.length === 1) S.path.pic = pics[0];
  }
  showAt(24);
  touch(); buildLab(PRS.chapterAt(T));
  const again = $(t.id); if (again) again.focus();
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // (A)~(D)는 한국어 이름으로, a.m. · p.m.은 AM · PM으로, T04는 ‘네 번째 튜토리얼’, ‘깃발 = 금요일’의 =는 쉼으로
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/\ba\.m\./g, 'AM'], [/\bp\.m\./g, 'PM'], [/T04/g, '네 번째 튜토리얼'], [/ = /g, ', '], [/TOEIC/g, '토익'], [/Part 5/g, '파트 5']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 ① — 까지 갈림길 (시간선 실험실)
   ========================================================= */
const RD = { sw: 1000, si: 0, prep: null, dot: null, first: {}, drag: null, hit: null };
const rCv = $('rStage'), rG = rCv.getContext('2d');
const rCur = () => PR.ROAD[RD.si];
const rItem = r => Object.assign({}, r, { opts: PR.ROAD_PREPS, a: PR.ROAD_PREPS.findIndex(p => PR.judge(p, r).s === 'ok') });
function rDraw() { RD.hit = PRS.road(rG, rCur(), RD.prep, { w: RD.sw, dot: RD.dot }); }
function rBuild() {
  const r = rCur(), j = RD.prep ? PR.judge(RD.prep, r) : null;
  $('rSent').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === RD.si)));
  $('rPrep').querySelectorAll('button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.p === RD.prep)); b.classList.toggle('right', !!j && b.dataset.p === RD.prep && j.s === 'ok'); b.classList.toggle('wrong', !!j && b.dataset.p === RD.prep && j.s !== 'ok'); });
  const filled = RD.prep ? r.q.replace('___', RD.prep) : r.q;
  $('rQ').innerHTML = (RD.prep ? sayBtn(filled) : '') + `<span lang="en">${esc(r.q).replace('___', RD.prep ? `<u>${esc(RD.prep)}</u>` : '<span class="blank">&nbsp;</span>')}</span>`;
  $('rKo').textContent = `뜻: ${r.ko}`;
  $('rVerdict').innerHTML = j ? `<b class="${j.s === 'ok' ? 'c-ok' : 'c-no'}">${j.s === 'ok' ? '맞아요' : '×'}</b> ${esc(j.why)}` : '전치사를 하나 골라 보세요. 시간선에 그 전치사의 그림이 그려져요.';
  $('rSteps').innerHTML = j ? PR.steps(rItem(r), true).map(s => `<li><b>${esc(s.head)}</b> ${esc(s.text)}</li>`).join('') : '';
  $('rSteps').hidden = !j;
  const tried = Object.keys(RD.first).length, hits = Object.values(RD.first).filter(Boolean).length;
  $('rScore').textContent = tried ? `처음 고른 전치사가 맞은 문장 ${hits} / ${tried}` : '';
  rDraw();
}
function rSet(si) { RD.si = (si + PR.ROAD.length) % PR.ROAD.length; RD.prep = null; RD.dot = null; rBuild(); rKeep(); }
function rPick(p) {
  RD.prep = p; RD.dot = null;
  if (!(RD.si in RD.first)) RD.first[RD.si] = PR.judge(p, rCur()).s === 'ok';
  rBuild(); rKeep();
}
function rKeep() { if (!$('road').contains(document.activeElement)) $('road').focus({ preventScroll: true }); }
const rLogical = e => { const r = rCv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * RD.sw; };
function rMoveTo(x) { const d = RD.hit && RD.hit.drag; if (!d) return; RD.dot = clamp((x - d.x0) / (d.x1 - d.x0)); rDraw(); }
function rResize() {
  const r = rCv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), st = PRS.ROADSTAGE;
  RD.sw = r.width < 560 ? st.nw : st.w;                       // 좁은 화면에서는 그림을 덜 줄여 글자를 읽을 수 있게
  const h = RD.sw === st.nw ? st.nh : st.h;
  rCv.style.aspectRatio = `${RD.sw} / ${h}`;
  rCv.width = Math.max(1, Math.round(r.width * d)); rCv.height = Math.max(1, Math.round(r.width * d * h / RD.sw));
  rDraw();
}
function roadInit() {
  $('rSent').innerHTML = PR.ROAD.map((r, i) => `<button type="button" data-i="${i}" aria-pressed="false"><span lang="en">${esc(r.nounText)}</span></button>`).join('');
  $('rPrep').innerHTML = PR.ROAD_PREPS.map((p, i) => `<button type="button" data-p="${p}" aria-pressed="false" aria-keyshortcuts="${i + 1}"><span lang="en">${p}</span></button>`).join('');
  $('rSent').addEventListener('click', e => { const b = e.target.closest('button'); if (b) rSet(+b.dataset.i); });
  $('rPrep').addEventListener('click', e => { const b = e.target.closest('button'); if (b) rPick(b.dataset.p); });
  // 점 끌기: 점 가까이에서 누르면 끌고, 시간선 다른 곳을 누르면 그리로 옮김
  rCv.addEventListener('pointerdown', e => { if (!RD.hit || !RD.hit.drag) return; RD.drag = true; rCv.setPointerCapture(e.pointerId); rMoveTo(rLogical(e)); });
  rCv.addEventListener('pointermove', e => { if (RD.drag) rMoveTo(rLogical(e)); else rCv.style.cursor = RD.hit && RD.hit.drag ? 'ew-resize' : 'default'; });
  const stop = () => { if (RD.drag) { RD.drag = false; rBuildStatus(); } };
  rCv.addEventListener('pointerup', stop); rCv.addEventListener('pointercancel', stop);
  $('road').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('input, select'))) return;
    const n = '1234567'.indexOf(e.key);
    if (n >= 0) { e.preventDefault(); rPick(PR.ROAD_PREPS[n]); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); rSet(RD.si + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); rSet(RD.si - 1); }
    else if ((e.key === ',' || e.key === '.') && RD.hit && RD.hit.drag) { e.preventDefault(); const d = RD.hit.drag; rMoveTo(d.x + (e.key === '.' ? 1 : -1) * (d.x1 - d.x0) * 0.04); rBuildStatus(); }
  });
  new ResizeObserver(rResize).observe(rCv);
  rResize(); rBuild();
}
// 점을 옮긴 뒤 화면 읽기 프로그램에도 결과를 알림
function rBuildStatus() { const st = RD.hit && RD.hit.status; $('rDot').textContent = st ? `점의 자리: ${st.text}` : ''; }

/* =========================================================
   7. 놀이터 ② — 짝 카드 (틀린 카드는 조금 뒤에 다시 나옴)
   ========================================================= */
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [b[i], b[k]] = [b[k], b[i]]; } return b; };
const CD = { deck: [], learned: new Set(), seen: new Set(), cur: null, opts: [], pick: null, all: false };
const CW = Object.keys(PR.PAIRS);
function cStart() { CD.deck = shuffle(CW); CD.learned = new Set(); CD.seen = new Set(); CD.pick = null; cNext(); }
function cNext() {
  const had = $('cards').contains(document.activeElement);   // 다시 그리면 초점이 있던 단추가 사라지므로 미리 확인
  CD.pick = null; CD.cur = CD.deck.shift() || null;
  if (CD.cur) CD.opts = shuffle([PR.PAIRS[CD.cur].p].concat(PR.PAIRS[CD.cur].no));
  cBuild();
  if (had) { const f = $('cOpts') && $('cOpts').querySelector('button'); (f || $('cards')).focus({ preventScroll: true }); }
}
function cAnswer(k) {
  if (!CD.cur || CD.pick != null) return;
  const w = CD.cur, P = PR.PAIRS[w], j = PR.judge(CD.opts[k], { cls: 'pair', head: w, noun: 'thing', nounText: '' });
  CD.pick = k;
  if (j.s === 'ok') { if (!CD.seen.has(w)) CD.learned.add(w); }
  else CD.deck.splice(Math.min(3, CD.deck.length), 0, w);          // 틀리면 세 장 뒤에 다시
  CD.seen.add(w);
  cBuild();
  const n = $('cNext'); if (n) n.focus({ preventScroll: true });
  void P;
}
function cBuild() {
  $('cProg').textContent = `한 번에 맞힌 카드 ${CD.learned.size} / ${CW.length} · 남은 카드 ${CD.deck.length + (CD.cur && CD.pick == null ? 1 : 0)}`;
  $('cAll').setAttribute('aria-pressed', String(CD.all));
  $('cGrid').hidden = !CD.all; $('cCard').hidden = CD.all;
  if (CD.all) {
    $('cGrid').innerHTML = ['adj', 'v', 'n'].map(pos => `<section><h4>${PR.POS[pos]} + 전치사</h4><ul>${CW.filter(w => PR.PAIRS[w].pos === pos).map(w => { const P = PR.PAIRS[w], full = P.q.replace('___', P.p); return `<li><span class="en1">${sayBtn(full)}<span lang="en"><b class="hd">${esc(w)}</b> <b class="v">${esc(P.p)}</b></span></span><span class="ko1">${esc(P.ko)}</span></li>`; }).join('')}</ul></section>`).join('');
    return;
  }
  if (!CD.cur) {
    $('cCard').className = 'pcard done';
    $('cCard').innerHTML = `<p class="pbig">${CD.learned.size} / ${CW.length}</p><p>${CD.learned.size === CW.length ? '모든 짝을 한 번에 맞혔어요!' : '틀린 카드는 다시 나와서 맞힐 때까지 풀었어요. 한 번 더 섞어서 해 보세요.'}</p><button class="btn" type="button" id="cAgain">다시 섞기</button>`;
    return;
  }
  const w = CD.cur, P = PR.PAIRS[w], done = CD.pick != null, right = done && CD.opts[CD.pick] === P.p;
  const full = P.q.replace('___', P.p);
  $('cCard').className = 'pcard' + (done ? (right ? ' flip ok' : ' flip no') : '');
  $('cCard').innerHTML = `<p class="pmeta"><span>${esc(PR.POS[P.pos])}</span><span>${esc(P.ko)}</span></p>
    <p class="pq" lang="en">${esc(P.q).replace(esc(w), `<b class="hd">${esc(w)}</b>`).replace('___', done ? `<u>${esc(P.p)}</u>` : '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo" id="cOpts" role="group" aria-label="전치사 고르기">${CD.opts.map((o, k) => `<button type="button" data-k="${k}"${done ? ' disabled' : ''} class="${done ? (o === P.p ? 'right' : k === CD.pick ? 'wrong' : '') : ''}"><b>${k + 1}</b> <span lang="en">${esc(o)}</span></button>`).join('')}</div>` +
    (done ? `<div class="pback"><p class="pbig2" lang="en"><b class="hd">${esc(w)}</b> <b class="v">${esc(P.p)}</b></p>
      <p class="pko">${sayBtn(full)}<span>${right ? '맞아요. ' : `× ${esc(CD.opts[CD.pick])} → ${esc(w)}의 짝이 아니에요. 이 카드는 조금 뒤에 다시 나와요. `}${esc(P.qko)}</span></p>
      <p class="note">${esc(P.tip)}</p><button class="btn" type="button" id="cNext">다음 카드 →</button></div>` : `<p class="pko">${esc(P.qko)}</p>`);
}
function cardsInit() {
  $('cards').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'cAll') { CD.all = !CD.all; cBuild(); return; }
    if (b.id === 'cAgain') { cStart(); $('cards').focus({ preventScroll: true }); return; }
    if (b.id === 'cNext') { cNext(); return; }
    if (b.dataset.k != null && b.closest('#cOpts')) cAnswer(+b.dataset.k);
  });
  $('cards').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || CD.all) return;
    const n = '1234'.indexOf(e.key);
    if (n >= 0 && CD.pick == null) { e.preventDefault(); cAnswer(n); }
    else if ((e.key === 'Enter' || e.key === 'ArrowRight') && CD.pick != null && !(e.target.closest && e.target.closest('button:not(#cNext)'))) { e.preventDefault(); cNext(); }
  });
  cStart();
}

/* =========================================================
   8. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', p: '#FFC15E', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// 그림 네 칸(A~D)을 누르는 그림 문제. draw(g, k, x, y, w, h)가 칸 하나를 그림
function gridFig(label, drawCell, H = 190) {
  const Wd = 600, cw = Wd / 4;
  return {
    width: Wd, height: H, label,
    pick: (x, y) => y > 8 && y < H - 4 ? Math.min(3, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      for (let k = 0; k < 4; k++) {
        const x = k * cw, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, x + 6, 8, cw - 12, H - 16, 12); g.fillStyle = st.hover === k ? QCOL.hover : 'rgba(255,255,255,0.03)'; g.fill();
        if (on || wrong) { g.strokeStyle = on ? QCOL.p : QCOL.bad; g.lineWidth = 3; g.stroke(); }
        g.font = qfont(16, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], x + cw / 2, 28);
        g.save(); drawCell(g, k, x + 6, 40, cw - 12, H - 56); g.restore();
      }
    },
  };
}
const FIG_TL = gridFig('작은 시간선 그림 네 개. A 깃발 전 칸 안의 점 하나, B 지금부터 깃발까지 이어진 막대, C 자로 잰 길이만큼의 막대, D 점선 상자 안의 점 하나',
  (g, k, x, y, w, h) => PRS.miniTL(g, ['by', 'until', 'for', 'within'][k], x - 18, y, w + 36, h));
const FIG_PLACE = gridFig('장소 그림 네 개. A 두 상자 사이의 점, B 동그라미 무리 가운데의 점, C 길을 따라가는 화살표, D 길을 건너는 화살표',
  (g, k, x, y, w, h) => PRS.placeIcon(g, ['between', 'among', 'along', 'across'][k], x + w / 2, y + h / 2, w - 6, h - 6, 1));
const QS = (() => {
  const by = (opts, c) => opts.map(o => PR.judge(o, c).s === 'ok').join();
  const q = [
    { q: '한국어 ‘까지’에 맞는 영어 전치사를 바르게 고른 것은?', opts: ['at · on · in', 'for · during', 'by · until', 'within · in'], a: 2,
      why: '‘까지’는 영어에서 둘로 나뉘어요. 그때까지 끝내는 일(마감)은 by, 그때까지 쭉 이어지는 일은 until. at · on · in은 ‘에’, for · during은 ‘동안’이에요.' },
    { q: 'Our weekly meeting starts ___ 9:30 a.m. 빈칸에 알맞은 말은?', opts: ['on', 'at', 'in', 'during'], a: 1,
      why: '9:30 a.m.은 시계의 한 점, 시각이에요 → at. 날은 on, 달 · 해 같은 큰 칸은 in, during 뒤에는 사건이 와요.',
      check: () => by(['on', 'at', 'in', 'during'], { cls: 'time', noun: 'clock', pic: 'at', nounText: '9:30 a.m.' }) === 'false,true,false,false' },
    { q: '‘The store will stay open ___ 9 p.m.’ 빈칸에 들어갈 전치사의 그림은 어느 것일까요? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1, figure: FIG_TL,
      why: '가게는 9시까지 쭉 열려 있다가 그때 닫아요 → 깃발까지 이어진 막대, until. A는 깃발 전에 한 번 끝내는 by, C는 숫자 길이 내내인 for, D는 그 길이 안의 한때인 within이에요.',
      check: () => PR.judge('until', PR.ROAD[1]).s === 'ok' && PR.ROAD_PIC.until === 'continue' },
    { q: 'The conference room is booked ___ three hours this afternoon. 빈칸에 알맞은 말은?', opts: ['during', 'since', 'until', 'for'], a: 3,
      why: 'three hours는 숫자로 잰 길이예요 → for. during 뒤에는 사건, since · until 뒤에는 한 시점이 와요.',
      check: () => by(['during', 'since', 'until', 'for'], { cls: 'time', noun: 'length', pic: 'span', nounText: 'three hours' }) === 'false,false,false,true' },
    { q: '‘새 지점은 지금부터 2주 뒤에 문을 열어요.’ The new branch will open ___ two weeks. 빈칸에 알맞은 말은?', opts: ['in', 'within', 'since', 'during'], a: 0,
      why: 'in + 길이 → 지금부터 그만큼 뒤의 한 점. within two weeks는 ‘2주 안 아무 때나’라서 뜻이 달라요. since 뒤에는 과거의 한 시점, during 뒤에는 사건이 와요.',
      check: () => by(['in', 'within', 'since', 'during'], PR.ROAD[6]) === 'true,false,false,false' },
    { q: '‘강을 따라 카페가 늘어서 있어요.’ Several cafés are located ___ the river. 이 빈칸의 그림은? 그림을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_PLACE,
      why: '‘강을 따라’ → 길을 따라가는 그림, along. A는 둘 사이(between), B는 셋 이상의 무리 가운데(among), D는 건너서(across)예요.',
      check: () => PR.decide('place', 'line', 'along').text === 'along' },
    { q: 'Sales rose from 2 million dollars to 2.5 million dollars. 이 사실과 맞는 문장은?', opts: ['Sales rose by 2.5 million dollars.', 'Sales rose to 25 percent.', 'Sales rose by 500,000 dollars.', 'Sales rose to 2 million dollars.'], a: 2,
      why: 'by 뒤에는 늘어난 차이가 와요. 2.5 million − 2 million = 500,000 dollars → rose by 500,000 dollars. 도착점으로 말하면 rose to 2.5 million dollars예요.',
      check: () => PR.judge('by', { cls: 'extra', noun: 'number', pic: 'diff', nounText: '500,000 dollars' }).s === 'ok' && PR.judge('to', { cls: 'extra', noun: 'number', pic: 'diff', nounText: '' }).s === 'no' },
    { q: '다음 가운데 짝이 바른 것은?', opts: ['comply to the rules', 'depend in the weather', 'interested about the job', 'responsible for the budget'], a: 3,
      why: '짝 카드 → responsible for. 나머지는 comply with, depend on, interested in이 바른 짝이에요. 한국어 ‘~을 · ~에 · ~에 대해’에 끌려 고르면 틀려요.',
      check: () => [['comply', 'to'], ['depend', 'in'], ['interested', 'about'], ['responsible', 'for']].map(([h, p]) => PR.judge(p, { cls: 'pair', head: h, noun: 'thing', nounText: '' }).s === 'ok').join() === 'false,false,false,true' },
    { q: 'Employees can request access ___ the shared drive. 빈칸에 알맞은 말은?', opts: ['for', 'to', 'in', 'at'], a: 1,
      why: '명사 access의 짝 → access to(~을 쓸 수 있는 권한). 동사 access는 전치사 없이 access the drive라고 써요.',
      check: () => by(['for', 'to', 'in', 'at'], { cls: 'pair', head: 'access', noun: 'thing', nounText: 'the shared drive' }) === 'false,true,false,false' },
    { q: 'There was an increase ___ 5 percent in online orders last month. 빈칸에 알맞은 말은?', opts: ['of', 'in', 'at', 'for'], a: 0,
      why: 'increase 뒤에 숫자가 오면 of → an increase of 5 percent. 늘어난 것 앞에는 in이 와요 → an increase in online orders. 같은 문장에 둘 다 나와요.',
      check: () => by(['of', 'in', 'at', 'for'], { cls: 'pair', head: 'increase', noun: 'number', nounText: '5 percent' }) === 'true,false,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[전치사] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[전치사] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
  return q;
})();

/* =========================================================
   9. 시작
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
  const ci = PRS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * PRS.W, (e.clientY - r.top) / r.height * PRS.H]; };
const hitAt = (x, y) => started ? PRS.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.say && EN.say.supported) { if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say && EN.say.supported ? '눌러서 발음 듣기: ' + h.say : ''; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-byuntil)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }   // 장면 첫 0.45초는 밝아지는 중이라 조금 뒤에서 멈춤

// 발음 듣기 단추(직접 해 보기·놀이터·연습 문제·용어집): 누르면 영상을 멈추고 읽음
EN.say.wire(document, { before() { if (playing) pause(); } });
roadInit();
cardsInit();
EN.drill({
  root: $('drillRoot'), items: PR.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 3단계 풀이법이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09·10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '전치사의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(PRS.baseText()).then(() => { dirty = true; rResize(); });
setTimeout(() => PRS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
