/* 품사 자리 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(3초 품사 감각 훈련 · 낱말 가족 사전), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(PS), 그림은 scenes.js(SV)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const PS = window.PS, SV = window.SV, S = SV.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = SV;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cv = $('cv'), ctx = cv.getContext('2d');
PS.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = SV.fonts;
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
  const ready = new Promise(res => SV.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '빈칸의 자리가 품사를 정한다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { SV.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const cap = started ? SV.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = SV.chapterAt(T);
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
  if (dirty) { dirty = false; SV.render(ctx, started ? T : POSTER); }
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
const POSN = PS.POS;
const seg = (name, items, cur) => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${esc(t)}</button>`).join('')}</div>`;
const enLine = (text, cls = '') => `<p class="enline ${cls}">${sayBtn(text)}<span lang="en">${esc(text)}</span></p>`;
// 낱말 하나: 밑 + 꼬리(품사 색). hide면 꼬리에 색을 칠하지 않음(답을 숨길 때)
function wordHTML(w, hide) {
  const d = PS.word(w) || { pos: '', tail: '' }, t = d.tail && w.toLowerCase().endsWith(d.tail) ? d.tail : '';
  return `<span class="wd" lang="en">${esc(t ? w.slice(0, -t.length) : w)}${t ? `<b class="${hide ? 'hide' : 'p-' + d.pos}">${esc(w.slice(-t.length))}</b>` : ''}</span>`;
}
// 연습 문제 하나를 직접 해 보기용 빈칸 문제로 (보기 단추 → 규칙 엔진으로 채점)
function miniQ(i) {
  const it = PS.DRILL[i];
  return `<div class="mini" data-q="${i}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map(([w], k) => `<button type="button" data-k="${k}">${esc(w)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
const SUFQ = ['decision', 'careful', 'simplify', 'applicant', 'timely', 'approval'];
const CATB = [['n', '명사'], ['adj', '형용사'], ['adv', '부사'], ['v', '동사']];
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ(0)}
    <p class="note">맞든 틀리든 괜찮아요. 영상 10장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  family: () => {
    const F = PS.family(S.fam);
    return `<h2>직접 해 보기</h2><h3>다른 낱말 가족 보기</h3>
      ${seg('낱말 가족', PS.FAMILIES.map(f => [f.id, f.forms[1][0] + f.forms[1][1]]), S.fam)}
      <ul class="fam">${F.forms.map(([b, t, pos]) => `<li>${sayBtn(b + t)}${wordHTML(b + t)}<span class="pt p-${pos}">${POSN[pos]}</span></li>`).join('')}</ul>
      <p class="note">스피커 단추를 누르면 발음을 들려줘요. 한 번 더 누르면 천천히 읽어요. 화면 속 영어 낱말을 눌러도 돼요.</p>`;
  },
  suffix: () => `<h2>직접 해 보기</h2><h3>꼬리를 보고 품사 맞히기</h3>
    <ol class="gapq">${SUFQ.map((w, i) => `<li data-w="${w}">${wordHTML(w, true)}<span class="mo">${CATB.map(([c, t]) => `<button type="button" data-c="${c}">${t}</button>`).join('')}</span><span class="mr" role="status"></span></li>`).join('')}</ol>`,
  skeleton: () => `<h2>직접 해 보기</h2><h3>꾸미는 말 빼 보기</h3>
    <div class="row"><label class="chk"><input type="checkbox" id="labStrip"${S.strip ? ' checked' : ''}> 형용사·부사 빼기</label></div>
    ${enLine('The new manager quickly reviewed the annual report.', 'small')}${enLine('The manager reviewed the report.', 'small')}
    <p class="note">명사와 동사만 남겨도 문장이 서 있어요. 형용사와 부사는 ‘꾸미는 말’이라서 빼도 되는 자리예요.</p>`,
  noun: () => `<h2>직접 해 보기</h2><h3>명사 자리 · 동명사 자리</h3>${miniQ(0)}${miniQ(7)}`,
  adjA: () => `<h2>직접 해 보기</h2><h3>명사 앞 형용사</h3>${miniQ(1)}${miniQ(15)}`,
  adjP: () => `<h2>직접 해 보기</h2><h3>보어 자리</h3>${miniQ(3)}${miniQ(4)}`,
  adv: () => `<h2>직접 해 보기</h2><h3>부사 자리</h3>${miniQ(2)}${miniQ(11)}
    <p class="note">고른 말을 빼고 읽어 보세요. 빼도 문장이 완전하면 부사 자리예요.</p>`,
  nn: () => `<h2>직접 해 보기</h2><h3>명사 + 명사 · 사람과 일</h3>${miniQ(6)}${miniQ(5)}`,
  method: () => {
    const P = S.path || {};
    const slot = P.slot, cat = slot ? PS.slotCat(slot) : null;
    return `<h2>직접 해 보기</h2><h3>자리 판정기</h3>
      <p class="note">빈칸 바로 앞과 바로 뒤의 낱말을 고르면, 흐름도에 길이 켜지고 들어갈 품사가 나와요.</p>
      <div class="pick"><span>빈칸 앞</span><select id="labL" class="sel">${['<option value="">고르기</option>'].concat(Object.entries(PS.LEFT).map(([k, v]) => `<option value="${k}"${P.L === k ? ' selected' : ''}>${esc(v)}</option>`)).join('')}</select></div>
      <div class="pick"><span>빈칸 뒤</span><select id="labR" class="sel">${['<option value="">고르기</option>'].concat(Object.entries(PS.RIGHT).map(([k, v]) => `<option value="${k}"${P.R === k ? ' selected' : ''}>${esc(v)}</option>`)).join('')}</select></div>
      ${P.L && P.R ? (slot ? `<p class="verdict"><b class="p-${cat === 'vg' ? 'v' : cat}">${esc(PS.SLOT[slot].name)} → ${esc(PS.CATNAME[cat])}</b> ${esc(PS.SLOT[slot].sign)}</p>`
        : '<p class="verdict">이 조합은 앞뒤 낱말만으로 정하기 어려워요. 문장 전체의 구조를 보세요.</p>') : ''}
      ${S.path ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${PS.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 3초 안에 빈칸의 품사 고르기, 낱말 가족 사전</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${PS.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 자리 표와 꼬리표</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
// 직접 해 보기의 조작은 한곳에서 처리 (다시 만들어도 이어서 동작)
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = CHAPTERS[SV.chapterAt(T)].id;
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[SV.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { S.path = null; touch(); buildLab(SV.chapterAt(T)); return; }
  if (b.dataset.k != null) {                                // 빈칸 문제
    const box = b.closest('.mini'), it = PS.DRILL[+box.dataset.q], k = +b.dataset.k, j = PS.judgeOpt(it, k);
    box.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(j.s === 'ok' ? 'right' : 'wrong');
    box.querySelector('.mr').textContent = `${POSN[it.opts[k][1]]}. ` + (j.s === 'ok' ? '맞아요! ' : '아니에요. ') + j.why;
    if (playing) pause();
    return;
  }
  if (b.dataset.c) {                                        // 꼬리로 품사 맞히기
    const li = b.closest('li'), d = PS.word(li.dataset.w), ok = PS.CAT[d.pos] === b.dataset.c || (d.pos === 'vg' && b.dataset.c === 'v');
    li.querySelectorAll('button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(ok ? 'right' : 'wrong');
    li.querySelector('.mr').textContent = (ok ? '맞아요. ' : '다시 보세요. ') + `${POSN[d.pos]}` + (d.tail ? ` (꼬리 -${d.tail})` : '') + (d.trap ? ' — ' + d.trap : '.');
    if (playing) pause();
    return;
  }
  const grp = b.closest('.seg'); if (!grp || b.dataset.v == null) return;
  if (id === 'family') { S.fam = b.dataset.v; showAt(20); }
  touch(); buildLab(SV.chapterAt(T));
});
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showAt(u) { const ch = CHAPTERS[SV.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'labStrip') { S.strip = t.checked; showAt(19); }
  else if (t.id === 'labL' || t.id === 'labR') {
    const L = $('labL').value, R = $('labR').value;
    S.path = L || R ? { slot: L && R ? PS.slotFromCues(L, R) : null, L, R } : null;   // slot이 없으면 흐름도는 켜지 않음
    showAt(29);
  } else return;
  touch(); buildLab(SV.chapterAt(T));
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // 꼬리표는 화면에 -tion(션)처럼 적고, 소리는 괄호 속 한국어로 읽음
  read: [[/-[a-z]+\(([^)]+)\)/g, '$1'], [/-(ly|al|er|or|ant|ize|ify)\b/g, '$1'], [/TOEIC/g, '토익'], [/Part 5/g, '파트 5'], [/~하는/g, '하는']],
  rate: () => speed,
  holdBefore: 0.05,
  clips: window.EN_CLIPS,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 — 3초 품사 감각 훈련 · 낱말 가족 사전
   ========================================================= */
const GCAT = [['n', '명사'], ['adj', '형용사'], ['adv', '부사'], ['vg', '동명사']];
const G = { round: [], i: 0, score: 0, streak: 0, best: 0, limit: 3, t0: 0, state: 'idle', raf: 0, miss: {} };
try { G.best = +localStorage.getItem('en-pos-best') || 0; } catch (e) { /* 저장소를 못 쓰면 기록 없이 */ }
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function gSentence(item, show) {
  let h = esc(item.q);
  item.cues.forEach(c => { h = h.replace(esc(c), `<mark class="cue${show ? ' on' : ''}">${esc(c)}</mark>`); });
  const cat = PS.slotCat(item.slot);
  return h.replace('___', show ? `<span class="gfill p-${cat === 'vg' ? 'v' : cat}">${esc(item.w)}</span>` : '<span class="blank">&nbsp;</span>');
}
function gRender() {
  const it = G.round[G.i];
  $('gScore').textContent = `점수 ${G.score}`; $('gStreak').textContent = `연속 ${G.streak}`; $('gBest').textContent = `최고 ${G.best}`;
  if (G.state === 'idle' || G.state === 'end') {
    const weak = Object.entries(G.miss).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => PS.SLOT[s].name);
    $('gQ').innerHTML = G.state === 'end'
      ? `<b>${G.score} / ${G.round.length}</b> 맞혔어요.${weak.length ? ` 다시 볼 자리: ${weak.map(esc).join(', ')}` : ' 모두 맞혔어요!'}`
      : '빈칸에 들어갈 <b>품사</b>만 고르세요. 문장을 해석하지 말고, 빈칸 앞뒤만 보면 돼요.';
    $('gProg').textContent = G.state === 'end' ? '끝' : `${G.round.length || 10}문제`;
    $('gBtns').hidden = true; $('gFb').textContent = ''; $('gBar').style.width = '0%';
    $('gStart').hidden = false; $('gStart').textContent = G.state === 'end' ? '다시 하기' : '시작';
    $('gNext').hidden = true;
    return;
  }
  $('gProg').textContent = `${G.i + 1} / ${G.round.length}`;
  $('gQ').innerHTML = gSentence(it, G.state === 'shown');
  $('gBtns').hidden = false; $('gStart').hidden = true;
  $('gBtns').querySelectorAll('button').forEach(b => { b.disabled = G.state === 'shown'; b.classList.remove('right', 'wrong'); });
  $('gNext').hidden = G.state !== 'shown';
}
function gTick() {
  if (G.state !== 'ask') return;
  if (G.limit) {
    const p = (performance.now() - G.t0) / (G.limit * 1000);
    $('gBar').style.width = `${Math.min(100, p * 100)}%`;
    if (p >= 1) { gAnswer(null); return; }
  }
  G.raf = requestAnimationFrame(gTick);
}
function gAsk() { G.state = 'ask'; G.t0 = performance.now(); $('gFb').textContent = ''; $('gBar').style.width = '0%'; gRender(); $('game').focus({ preventScroll: true }); cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(gTick); }
function gStart() { G.round = shuffle(PS.GAME).slice(0, 10); G.i = 0; G.score = 0; G.streak = 0; G.miss = {}; gAsk(); }
function gAnswer(cat) {
  const it = G.round[G.i], right = PS.slotCat(it.slot), ok = cat === right;
  cancelAnimationFrame(G.raf);
  G.state = 'shown';
  if (ok) { G.score++; G.streak++; } else { G.streak = 0; G.miss[it.slot] = (G.miss[it.slot] || 0) + 1; }
  if (G.streak > G.best) { G.best = G.streak; try { localStorage.setItem('en-pos-best', String(G.best)); } catch (e) { /* 무시 */ } }
  gRender();
  $('gBtns').querySelectorAll('button').forEach(b => { if (b.dataset.c === right) b.classList.add('right'); else if (b.dataset.c === cat) b.classList.add('wrong'); });
  const S_ = PS.SLOT[it.slot];
  $('gFb').innerHTML = `<b class="${ok ? 'c-ok' : 'c-no'}">${cat == null ? '시간이 다 됐어요.' : ok ? '정답!' : '아쉬워요.'}</b> ${esc(S_.name)} → <b>${esc(PS.CATNAME[right])}</b>. ${esc(S_.sign)}. ${sayBtn(it.q.replace('___', it.w))}`;
  $('gNext').focus({ preventScroll: true });
}
function gNext() { G.i++; if (G.i >= G.round.length) { G.state = 'end'; gRender(); } else gAsk(); }
function dictInit() {
  // 연습 문제의 보기(같은 뿌리 네 개)와 영상의 낱말 가족을 모아 사전으로
  const fams = PS.FAMILIES.map(f => ({ root: f.id, words: f.forms.map(([b, t]) => b + t) }))
    .concat(PS.DRILL.map(d => ({ root: d.root, words: d.opts.map(o => o[0].toLowerCase()) })));
  const seen = new Set();
  $('dict').innerHTML = fams.filter(f => !seen.has(f.root) && seen.add(f.root)).map(f => `<li><span class="root" lang="en">${esc(f.root)}</span>
    <span class="forms">${f.words.map(w => { const d = PS.word(w) || {}; return `<span class="form">${sayBtn(w)}${wordHTML(w)}<small class="p-${d.pos}">${esc(POSN[d.pos] || '')}</small>${d.trap ? `<em title="${esc(d.trap)}">함정</em>` : ''}</span>`; }).join('')}</span></li>`).join('');
}
function gameInit() {
  $('gBtns').innerHTML = GCAT.map(([c, t], i) => `<button type="button" data-c="${c}"><kbd>${i + 1}</kbd>${t}</button>`).join('');
  $('gBtns').addEventListener('click', e => { const b = e.target.closest('button[data-c]'); if (b && G.state === 'ask') gAnswer(b.dataset.c); });
  $('gStart').addEventListener('click', gStart);
  $('gNext').addEventListener('click', gNext);
  $('gTime').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    G.limit = +b.dataset.v; $('gTime').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (G.state === 'ask') gAsk();
  });
  $('game').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const n = '1234'.indexOf(e.key);
    if (n >= 0 && G.state === 'ask') { e.preventDefault(); gAnswer(GCAT[n][0]); }
    else if (e.key === 'Enter' && G.state === 'shown' && !(e.target.closest && e.target.closest('[data-say]'))) { e.preventDefault(); gNext(); }
  });
  gRender();
  dictInit();
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', n: '#6EC8FF', adj: '#7FE0A8', adv: '#D4E157', v: '#C9A7FF', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
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
      parts.forEach(([w, k, pos]) => {
        if (w === '.') x -= sp;
        g.font = qfont(size, 600);
        const ww = g.measureText(w).width, on = st.done && k === st.answer, wrong = st.done && k >= 0 && k === st.pick && k !== st.answer;
        if (k >= 0) {
          boxes[k] = { x, w: ww };
          if (st.hover === k || on || wrong) { rrq(g, x - 4, 74, ww + 8, 36, 6); g.fillStyle = on ? 'rgba(255,193,94,0.22)' : wrong ? 'rgba(255,142,142,0.2)' : QCOL.hover; g.fill(); }
          g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.fillText('ABCD'[k], x + ww / 2, 50);
          g.font = qfont(size, 600);
        }
        g.textAlign = 'left'; g.fillStyle = colorOf(pos, st) || QCOL.text; g.fillText(w, x, 92);
        x += ww + sp;
      });
    },
  };
}
const FIG_MOD = wordFig([['The', -1], ['company', 0, 'n'], ['reported', 1, 'v'], ['a', -1], ['significant', -1, 'adj'], ['increase', 2, 'n'], ['in', -1], ['profits', 3, 'n'], ['.', -1]],
  '문장 The company reported a significant increase in profits. 네 낱말에 A부터 D까지 표시된 그림', (pos, st) => pos === 'adj' ? QCOL.adj : st.done && pos ? QCOL[pos] : null);
const FIG_ADV = wordFig([['The', -1], ['team', 0, 'n'], ['completed', 1, 'v'], ['the', -1], ['project', 2, 'n'], ['successfully', 3, 'adv'], ['.', -1]],
  '문장 The team completed the project successfully. 네 낱말에 A부터 D까지 표시된 그림', (pos, st) => st.done && pos ? QCOL[pos] : null);
const QS = (() => {
  const by = (opts, slot) => opts.map(w => PS.judge(PS.word(w).pos, slot).s === 'ok');
  const q = [
    { q: '토익 Part 5에서 보기 네 개가 renew, renewal, renewable, renewed처럼 같은 뿌리라면, 가장 먼저 볼 곳은?', opts: ['빈칸 바로 앞뒤의 낱말', '문장 전체의 해석', '보기의 철자 길이', '문장의 마지막 낱말'], a: 0,
      why: '같은 뿌리의 보기는 품사 문제예요. 빈칸 앞뒤가 자리를 정하니까, 해석보다 앞뒤를 먼저 봐요.' },
    { q: '다음 중 -ly로 끝나지만 형용사인 낱말은?', opts: ['quickly', 'steadily', 'timely', 'highly'], a: 2,
      why: 'timely(때맞춘)는 명사 time에 -ly가 붙은 형용사예요. costly, friendly도 같아요. 나머지는 형용사에 -ly가 붙은 부사예요.',
      check: () => PS.word('timely').pos === 'adj' && ['quickly', 'steadily', 'highly'].every(w => PS.word(w).pos === 'adv') },
    { q: '‘The company reported a significant increase in profits.’ 형용사 significant가 꾸미는 말은? 낱말을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_MOD,
      why: '형용사는 바로 뒤의 명사를 꾸며요. a significant increase — 큰 폭의 증가.' },
    { q: 'The new design is ___ to young customers. 빈칸에 알맞은 말은?', opts: ['attractively', 'attractive', 'attraction', 'attract'], a: 1,
      why: 'be동사 뒤에서 주어의 상태를 말하는 보어 자리 → 형용사 attractive. 부사는 보어가 될 수 없어요.', check: () => by(['attractively', 'attractive', 'attraction', 'attract'], 'comp').join() === 'false,true,false,false' },
    { q: '‘Please keep the files ___.’ 빈칸에 securely가 아니라 secure를 쓰는 까닭은?', opts: ['목적어 the files의 상태를 말하는 보어라서', '동사 keep을 꾸미기 때문에', '명사 files 앞에 오기 때문에', '문장 끝이라서'], a: 0,
      why: 'keep + 목적어 + 보어. the files = secure(파일이 안전한 상태)처럼 목적어와 등호로 이어지면 형용사예요.' },
    { q: '‘The team completed the project successfully.’ 빼도 문장이 완전한 낱말(부사)은? 낱말을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 3, figure: FIG_ADV,
      why: 'successfully를 빼도 The team completed the project. 완전한 문장이에요. 빼도 되는 꾸밈 자리가 부사예요.', check: () => PS.word('successfully').pos === 'adv' },
    { q: 'She is responsible for ___ new employees. 빈칸에 알맞은 말은?', opts: ['train', 'trainer', 'training', 'trained'], a: 2,
      why: '전치사 for 뒤에 오면서, 뒤에 목적어 new employees를 가져요 → 동명사 training. 명사 trainer는 목적어를 가질 수 없어요.', check: () => by(['train', 'trainer', 'training', 'trained'], 'ger').join() === 'false,false,true,false' },
    { q: 'We need a qualified ___ for this project. 빈칸에 알맞은 말은?', opts: ['analysis', 'analyst', 'analyze', 'analytical'], a: 1,
      why: 'qualified(자격을 갖춘)와 need가 사람을 가리켜요 → 사람 명사 analyst. analysis는 분석이라는 일이에요.', check: () => by(['analysis', 'analyst', 'analyze', 'analytical'], 'np').join() === 'false,true,false,false' },
    { q: 'All visitors must follow the ___ regulations. 빈칸에 알맞은 말은?', opts: ['safe', 'safely', 'save', 'safety'], a: 3,
      why: 'safety regulations(안전 규정)는 명사 + 명사로 굳은 짝이에요. safe regulations는 ‘안전한 규정’이라는 다른 뜻이 돼요.', check: () => by(['safe', 'safely', 'save', 'safety'], 'cmpd').join() === 'false,false,false,true' },
    { q: 'Prices were ___ reduced last month. 빈칸에 알맞은 말은?', opts: ['significantly', 'significant', 'significance', 'signify'], a: 0,
      why: 'were와 reduced 사이, 동사 덩어리 가운데예요. 빼도 Prices were reduced. 완전하니 부사 significantly.', check: () => by(['significantly', 'significant', 'significance', 'signify'], 'adv').join() === 'true,false,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[품사 자리] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[품사 자리] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
  const ci = SV.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * SV.W, (e.clientY - r.top) / r.height * SV.H]; };
const hitAt = (x, y) => started ? SV.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
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
gameInit();
EN.drill({
  root: $('drillRoot'), items: PS.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 3단계 풀이법이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09·10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '품사 자리의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(SV.baseText()).then(() => { dirty = true; });
setTimeout(() => SV.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
