/* 어휘 · 짝 표현 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(짝 카드 · 짝 사전), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(VC), 그림은 scenes.js(VS)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const VC = window.VC, VS = window.VS, S = VS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = VS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cv = $('cv'), ctx = cv.getContext('2d');
VC.check();

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
    title: '낱말에도 단짝이 있다 — 영어 튜토리얼',
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
const seg = (name, items, cur, attr = 'v') => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t, en]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${en ? `<span lang="en">${esc(t)}</span>` : esc(t)}</button>`).join('')}</div>`;
// 빈칸 문제 (보기 단추 → 규칙 엔진으로 채점). 문제는 이름표로 찾음
const MQ = { intro: VC.INTRO };
VC.DRILL.forEach((it, i) => { MQ['d' + i] = it; });
function miniQ(id) {
  const it = MQ[id];
  return `<div class="mini" data-q="${id}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map((w, k) => `<button type="button" data-k="${k}" lang="en">${esc(VC.show(w))}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
// 둘 가운데 고르기 목록. 보기의 첫째가 정답이라 화면에서는 줄마다 순서를 바꿔 보여 줌
const SORTS = {};
const sortList = (name, items) => {
  SORTS[name] = items;
  return `<ol class="gapq">${items.map((it, i) => {
    const order = it.opts.map((_, k) => k); if (i % 2) order.reverse();
    return `<li data-so="${name}" data-i="${i}"><span lang="en" class="ph">${esc(it.q).replace('___', '<span class="blank sm">&nbsp;</span>')}</span><span class="mo">${order.map(k => `<button type="button" data-o="${k}" lang="en">${esc(VC.show(it.opts[k]))}</button>`).join('')}</span><span class="mr" role="status"></span></li>`;
  }).join('')}</ol>`;
};
const pairVerdict = () => {
  if (S.pick == null) return '<p class="note">보기를 누르면 영상 속 그 줄이 켜지고, 그 낱말의 진짜 짝이 보여요.</p>';
  const o = VC.INTRO.opts[S.pick], j = VC.judge(o, VC.INTRO), L = VC.entry(o);
  return `<p class="verdict"><b class="${j.s === 'ok' ? 'c-ok' : 'c-no'}">${j.s === 'ok' ? '자연스러운 짝' : '쓰지 않는 짝'}</b> ${esc(j.why)}</p>
    <ul class="frl">${Object.entries(L.friends).map(([k, gl]) => { const p = VC.phrase(o, k); return `<li>${sayBtn(p)}<span lang="en">${esc(p)}</span> <span class="note">${esc(gl)}</span></li>`; }).join('')}</ul>`;
};
const probeOut = () => {
  const P = S.probe || {};
  if (!P.w || !P.k) return '';
  const j = VC.judgePair(P.w, P.k), phrase = VC.phrase(P.w, P.k);
  const head = j.s === 'ok' ? '<b class="c-ok">✓ 사전에 있는 짝</b>' : j.s === 'no' ? '<b class="c-no">× 함께 쓰지 않는 짝</b>' : '<b class="c-warn">? 사전에 없는 짝</b>';
  return `<p class="verdict">${head} <span lang="en">${esc(phrase)}</span></p><p class="note">${esc(j.why)}${j.s === '?' ? ' 영영사전이나 예문 검색으로 확인해 보세요.' : ''}</p>`;
};
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ('intro')}
    <p class="note">맞든 틀리든 괜찮아요. 02장 ‘짝이 답을 정한다’에서 함께 풀어요.</p>`,
  korean: () => {
    const r = S.ko == null ? null : VC.KO[S.ko];
    return `<h2>직접 해 보기</h2><h3>‘하다’를 영어로</h3>
      ${seg('한국어 표현', VC.KO.map((x, i) => [i, x.ko.join(' ')]), S.ko == null ? '' : S.ko)}
      ${r ? `<p class="enline">${sayBtn(`${r.v} ${r.n}`)}<span lang="en"><b class="c-ans">${esc(r.v)}</b> ${esc(r.n)}</span></p>` : '<p class="note">한국어 표현을 고르면 영상 속 그 줄이 켜지고, 영어 짝을 들을 수 있어요.</p>'}
      <h3 class="mt">make일까, do일까?</h3>${sortList('korean', VC.SORT.korean)}`;
  },
  pair: () => `<h2>직접 해 보기</h2><h3>보기를 짝과 붙여 읽기</h3>
    <p class="mq" lang="en">___ a survey</p>
    ${seg('보기', VC.INTRO.opts.map((o, i) => [i, o, true]), S.pick == null ? '' : S.pick, 'pick')}
    ${pairVerdict()}`,
  verbs: () => `<h2>직접 해 보기</h2><h3>동사의 짝 · 덩어리 완성하기</h3>${sortList('verbs', VC.SORT.verbs)}
    <p class="note">더 많은 짝은 아래 <a href="#playground">짝 카드</a>와 <a href="#dictTitle">짝 사전</a>에 있어요.</p>`,
  adjs: () => {
    const sel = S.pair == null ? 0 : S.pair, p = VC.ADJ_PAIRS[sel];
    return `<h2>직접 해 보기</h2><h3>닮은꼴 쌍 고르기</h3>
      ${seg('형용사 쌍', VC.ADJ_PAIRS.map((x, i) => [i, `${x.a} · ${x.b}`, true]), S.pair == null ? '' : S.pair, 'pair')}
      ${sortList('adjs', [Object.assign({}, p.fa, { opts: [p.a, p.b] }), Object.assign({}, p.fb, { opts: [p.b, p.a] })])}
      <p class="note">쌍을 고르면 영상 아래 칸의 두 짝이 바뀌어요. 꾸밈 받는 명사나 뒤의 전치사가 짝이에요.</p>`;
  },
  advs: () => `<h2>직접 해 보기</h2><h3>부사의 짝 · 닮은꼴</h3>${sortList('advs', VC.SORT.advs)}`,
  confv: () => `<h2>직접 해 보기</h2><h3>뒤의 구조 보기</h3>
    ${seg('목적어', [['', '영상대로'], ['no', '목적어 없음'], ['yes', '목적어 있음']], S.obj || '', 'obj')}
    <p class="note">목적어가 없으면 <b lang="en">rise</b>(오르다), 있으면 <b lang="en">raise</b>(올리다). 영상 속 문장이 켜져요.</p>
    ${sortList('confv', VC.SORT.confv)}`,
  method: () => {
    const P = S.probe || {};
    const opt = (list, cur) => ['<option value="">고르기</option>'].concat(list.map(([k, v]) => `<option value="${esc(k)}"${cur === k ? ' selected' : ''}>${esc(v)}</option>`)).join('');
    return `<h2>직접 해 보기</h2><h3>① 빈칸은 무슨 자리?</h3>
      ${seg('빈칸', [['v', '동사 빈칸'], ['adj', '형용사 빈칸'], ['adv', '부사 빈칸'], ['n', '명사 빈칸']], S.path || '', 'path')}
      <p class="note">고르면 흐름도에 짝을 찾을 곳과 확인할 함정이 켜져요.</p>
      <h3 class="mt">짝 판정기</h3>
      <p class="note">동사와 목적어를 골라 짝 사전에 물어보세요. 사전에 없는 짝은 판정하지 않아요(?).</p>
      <div class="pick"><span>동사</span><select id="labV" class="sel">${opt(VC.PROBE.verbs.map(v => [v, v]), P.w)}</select></div>
      <div class="pick"><span>목적어</span><select id="labK" class="sel">${opt(VC.PROBE.keys.map(k => [k, k.replace('___ ', '')]), P.k)}</select></div>
      ${probeOut()}${S.path ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 16.6, 32.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    ${miniQ('d4')}
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${VC.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 짝 카드 ${VC.CARDS.length}장(틀린 카드는 더 빨리 다시 나와요), 짝 사전</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${VC.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 짝의 자리 표와 용어</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
// 바꾼 결과가 보이는 구간 [lo, hi] 밖이면 그 구간으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showIn(lo, hi = 1e9) {
  const ch = CHAPTERS[VS.chapterAt(T)], u = T - ch.t;
  if (u < lo || u > hi) { T = ch.t + (u < lo ? lo : hi); started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); }
}
const markLi = (box, b, ok, msg) => {
  box.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
  b.classList.add(ok ? 'right' : 'wrong');
  box.querySelector('.mr').textContent = (ok ? '맞아요! ' : '아니에요. ') + msg;
};
// 직접 해 보기의 조작은 한곳에서 처리 (다시 만들어도 이어서 동작)
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[VS.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { S.path = null; touch(); buildLab(VS.chapterAt(T)); return; }
  if (b.dataset.k != null) {                                // 빈칸 문제
    const box = b.closest('.mini'), it = MQ[box.dataset.q], j = VC.judge(it.opts[+b.dataset.k], it);
    markLi(box, b, j.s === 'ok', j.why);
    if (playing) pause();
    return;
  }
  if (b.dataset.o != null) {                                // 둘 가운데 고르기
    const li = b.closest('li'), it = SORTS[li.dataset.so][+li.dataset.i], j = VC.judge(it.opts[+b.dataset.o], it);
    markLi(li, b, j.s === 'ok', j.why);
    if (playing) pause();
    return;
  }
  const ci = VS.chapterAt(T);
  if (b.dataset.v != null && CHAPTERS[ci].id === 'korean') { S.ko = b.dataset.v === '' ? null : +b.dataset.v; showIn(1); }
  else if (b.dataset.pick != null) { S.pick = +b.dataset.pick; showIn(1, 21.6); }
  else if (b.dataset.pair != null) { S.pair = +b.dataset.pair; showIn(13); }
  else if (b.dataset.obj != null) { S.obj = b.dataset.obj || null; showIn(1); }
  else if (b.dataset.path != null) { S.path = b.dataset.path; showIn(18); }
  else return;
  touch(); buildLab(VS.chapterAt(T));
});
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (t.id !== 'labV' && t.id !== 'labK') return;
  S.probe = { w: $('labV').value, k: $('labK').value };
  touch(); buildLab(VS.chapterAt(T));
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/TOEIC/g, '토익'], [/Part 5/g, '파트 5']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 — 짝 카드 (라이트너 상자) · 짝 사전
   ========================================================= */
// 라이트너 상자: 처음 보는 카드 → 맞히면 한 칸 위 상자로, 틀리면 상자 1로. 상자가 높을수록 늦게(더 많은 카드 뒤에) 다시 나와요
const GAP = [0, 3, 7, 15, 30, 60];
const LSK = 'en-vocab-cards-v1';
const K = { v: 1, turn: 0, box: {}, due: {} };
try { const s = JSON.parse(localStorage.getItem(LSK) || 'null'); if (s && s.v === 1 && s.box && s.due) Object.assign(K, s); } catch (e) { /* 저장소를 못 쓰면 이번 방문 동안만 기억 */ }
const kSave = () => { try { localStorage.setItem(LSK, JSON.stringify(K)); } catch (e) { /* 무시 */ } };
const KU = { type: 'all', view: 'q', card: null, order: [], pick: null, hint: false, last: null, ok: 0, n: 0, to: null, resetArm: 0 };
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pool = () => VC.CARDS.filter(c => KU.type === 'all' || String(c.type) === KU.type);
function kNextCard() {
  const P = pool(), seen = P.filter(c => K.box[c.id]);
  const due = seen.filter(c => K.due[c.id] <= K.turn && c.id !== KU.last).sort((a, b) => K.due[a.id] - K.due[b.id] || K.box[a.id] - K.box[b.id]);
  if (due.length) return due[0];
  const fresh = P.filter(c => !K.box[c.id]);
  if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
  const rest = seen.filter(c => c.id !== KU.last).sort((a, b) => K.due[a.id] - K.due[b.id]);
  return rest[0] || P[0];
}
// 문장에 짝 표시와 빈칸 넣기 (marks의 글자를 찾아 <mark>로 감쌈)
function markHTML(q, marks, fill) {
  const ranges = [];
  marks.forEach(m => { const i = q.indexOf(m.t); if (i >= 0 && !ranges.some(r => i < r.e && i + m.t.length > r.s)) ranges.push({ s: i, e: i + m.t.length, cls: m.cls }); });
  const b = q.indexOf('___'); if (b >= 0) ranges.push({ s: b, e: b + 3, blank: true });
  ranges.sort((x, y) => x.s - y.s);
  let out = '', at = 0;
  ranges.forEach(r => {
    if (r.s < at) return;
    out += esc(q.slice(at, r.s));
    out += r.blank ? (fill ? `<span class="kfill">${esc(fill)}</span>` : '<span class="blank">&nbsp;</span>') : `<mark class="${r.cls}">${esc(q.slice(r.s, r.e))}</mark>`;
    at = r.e;
  });
  return out + esc(q.slice(at));
}
// 짝만 보기: 괄호 속 우리말 이름표는 작은 글씨로, 나머지(빈칸 빼고)는 짝 표시
function shortHTML(c, fill) {
  const m = c.short.match(/^(.*?)(\s*\(([^)]*)\))?$/), body = m[1], tag = m[3];
  const parts = body.split('___');
  return parts.map(p => p.trim() ? `<mark class="kpt on">${esc(p)}</mark>` : esc(p)).join(fill ? `<span class="kfill">${esc(fill)}</span>` : '<span class="blank">&nbsp;</span>') + (tag ? ` <small class="ktag">${esc(tag)}</small>` : '');
}
function kBoxes() {
  const P = pool(), cnt = [0, 0, 0, 0, 0, 0];
  P.forEach(c => { cnt[K.box[c.id] || 0]++; });
  const cur = KU.card ? K.box[KU.card.id] || 0 : -1;
  $('kBoxes').innerHTML = cnt.map((n, b) => `<li class="bx${b === (KU.pick == null ? cur : KU.to) ? ' on' : ''}${b === 5 ? ' done' : ''}"><b>${n}</b><span>${b ? '상자 ' + b : '새 카드'}</span><small>${b ? (b === 5 ? '외움 · ' : '') + GAP[b] + '장 뒤' : '아직 안 봄'}</small><i style="--h:${Math.round(n / Math.max(1, P.length) * 100)}%"></i></li>`).join('');
  $('kStat').textContent = KU.n ? `이번에 ${KU.n}장 · 맞힘 ${KU.ok}` : '';
}
function kRender() {
  const c = KU.card;
  kBoxes();
  if (!c) { $('kCard').innerHTML = '<p class="note">이 유형의 카드가 없어요.</p>'; return; }
  const done = KU.pick != null, ans = c.opts[0], b = K.box[c.id] || 0;
  const J = c.opts.map(o => VC.judge(o, c));
  const front = KU.view === 'short' ? shortHTML(c, done ? VC.show(ans) : '')
    : markHTML(c.q, c.cue.map(t => ({ t, cls: 'kpt' + (KU.hint || done ? ' on' : '') })), done ? VC.show(ans) : '');
  let h = `<p class="kmeta"><span class="ktype">${c.type} · ${esc(VC.TYPES[c.type].name)}</span><span class="kbox">${b ? '상자 ' + b : '새 카드'}</span></p>
    <p class="kq${KU.view === 'short' ? ' short' : ''}" lang="en">${front}</p>
    <div class="kopts" role="group" aria-label="보기">${KU.order.map((k, i) => {
      const cls = done ? (k === 0 ? ' right' : i === KU.pick ? ' wrong' : ' off') : '';
      return `<button type="button" data-ki="${i}" class="${cls}"${done ? ' disabled' : ''}><kbd>${i + 1}</kbd><span lang="en">${esc(VC.show(c.opts[k]))}</span></button>`;
    }).join('')}</div>`;
  if (done) {
    const ok = KU.order[KU.pick] === 0, L = VC.entry(ans), phrase = VC.phrase(ans, c.key), gloss = L.friends[c.key] || '';
    const full = c.q.replace('___', VC.show(ans));
    h += `<div class="kback ${ok ? 'ok' : 'no'}">
      <p class="kphr">${/[가-힣]/.test(phrase) ? '' : sayBtn(phrase)}<b lang="en">${esc(phrase)}</b> <span>= ${esc(gloss)}</span></p>
      <ul class="knotes">${KU.order.map(k => `<li class="${k === 0 ? 'right' : ''}"><b lang="en">${esc(VC.show(c.opts[k]))}</b> ${k === 0 ? '정답. 짝이 맞아요.' : '× ' + esc(VC.noteText(c.opts[k], J[k].why))}</li>`).join('')}</ul>
      <p class="kko">${sayBtn(full, '완성 문장 듣기')}<span>${esc(c.ko)}</span></p>
      <p class="ksched" role="status"><b class="${ok ? 'c-ok' : 'c-no'}">${ok ? '맞았어요.' : '아쉬워요.'}</b> ${ok ? (KU.to === 5 ? '상자 5(외움)로 → ' : `상자 ${KU.to}로 올라가요 → `) : '상자 1로 → '}${GAP[KU.to]}장 뒤에 다시 나와요.</p></div>`;
  }
  $('kCard').innerHTML = h;
  $('kNext').hidden = !done; $('kHint').hidden = done || KU.view === 'short';
  $('kHint').setAttribute('aria-pressed', String(KU.hint));
}
function kShow() { KU.card = kNextCard(); KU.order = shuffle([0, 1, 2, 3]); KU.pick = null; KU.hint = false; KU.to = null; kRender(); }
function kAnswer(i) {
  if (!KU.card || KU.pick != null) return;
  const c = KU.card, ok = KU.order[i] === 0, b = K.box[c.id] || 0;
  KU.pick = i; KU.n++; if (ok) KU.ok++;
  K.turn++;
  KU.to = ok ? Math.min(5, Math.max(1, b) + 1) : 1;
  K.box[c.id] = KU.to; K.due[c.id] = K.turn + GAP[KU.to];
  KU.last = c.id;
  kSave(); kRender();
  $('kNext').focus({ preventScroll: true });
}
function deckInit() {
  $('kCard').addEventListener('click', e => { const b = e.target.closest('button[data-ki]'); if (b) kAnswer(+b.dataset.ki); });
  $('kNext').addEventListener('click', () => { kShow(); $('deck').focus({ preventScroll: true }); });
  $('kHint').addEventListener('click', () => { KU.hint = !KU.hint; kRender(); });
  $('kType').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    KU.type = b.dataset.v; $('kType').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    KU.last = null; kShow();
  });
  $('kView').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    KU.view = b.dataset.v; $('kView').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    kRender();
  });
  $('kReset').addEventListener('click', () => {
    const now = performance.now();
    if (now - KU.resetArm > 4000) { KU.resetArm = now; $('kReset').textContent = '한 번 더 누르면 기록을 지워요'; setTimeout(() => { $('kReset').textContent = '기록 지우기'; }, 4000); return; }
    K.turn = 0; K.box = {}; K.due = {}; KU.ok = 0; KU.n = 0; KU.last = null; KU.resetArm = 0; kSave();
    $('kReset').textContent = '기록 지우기'; kShow();
  });
  $('deck').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), n = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'ABCD'.indexOf(k);
    if (KU.pick == null && n >= 0 && e.key.length === 1) { e.preventDefault(); kAnswer(n); }
    else if (k === 'H' && KU.pick == null) { e.preventDefault(); $('kHint').click(); }
    else if ((e.key === 'Enter' || e.key === 'ArrowRight') && KU.pick != null && !(e.target.closest && e.target.closest('button:not(#kNext)'))) { e.preventDefault(); $('kNext').click(); }
  });
  kShow();
}
// 짝 사전: 유형별로 묶고, 낱말 · 짝 · 우리말 뜻으로 찾기
const DU = { type: 'all', q: '' };
function dictRender() {
  const q = DU.q.trim().toLowerCase();
  const list = Object.values(VC.LEX).filter(L => Object.keys(L.friends).length && (DU.type === 'all' || String(L.type) === DU.type));
  const hit = L => !q || [L.w, L.ko, L.ex || ''].concat(Object.keys(L.friends).map(k => VC.phrase(L.w, k)), Object.values(L.friends)).some(s => String(s).toLowerCase().includes(q));
  let nW = 0, nF = 0;
  const html = Object.keys(VC.TYPES).map(t => {
    const items = list.filter(L => String(L.type) === t && hit(L));
    if (!items.length) return '';
    nW += items.length;
    return `<section class="dgrp"><h4>${t} · ${esc(VC.TYPES[t].name)}</h4><ul class="dict">${items.map(L => {
      const fr = Object.entries(L.friends); nF += fr.length;
      return `<li><p class="hw">${sayBtn(VC.show(L.w))}<b lang="en">${esc(VC.show(L.w))}</b><small>${esc(VC.POS[L.pos])}</small><span class="dko">${esc(L.ko)}</span>${L.look ? `<em>닮은꼴 <i lang="en">${esc(L.look)}</i></em>` : ''}</p>
        <ul class="frl">${fr.map(([k, gl]) => { const p = VC.phrase(L.w, k), en = !/[가-힣]/.test(p); return `<li>${en ? sayBtn(p) : '<span class="nosay"></span>'}<span lang="en">${esc(p)}</span> <span class="dko">${esc(gl)}</span></li>`; }).join('')}
        ${L.ex ? `<li class="ex">${sayBtn(L.ex)}<span lang="en">${esc(L.ex)}</span></li>` : ''}</ul></li>`;
    }).join('')}</ul></section>`;
  }).join('');
  $('dict').innerHTML = html || '<p class="note">찾는 낱말이 없어요. 다른 낱말이나 우리말 뜻으로 찾아보세요.</p>';
  $('dCount').textContent = `낱말 ${nW}개 · 짝 ${nF}개`;
}
function dictInit() {
  $('dQ').addEventListener('input', e => { DU.q = e.target.value; dictRender(); });
  $('dType').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    DU.type = b.dataset.v; $('dType').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    dictRender();
  });
  dictRender();
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', pt: '#6EC8FF', ans: '#FFC15E', gap: '#FF7AA8', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E', line: 'rgba(238,241,244,0.26)', panel: '#18202A' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
const qkey = (g, k, x, y) => { g.font = qfont(15, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], x, y); };
// 문장 속 네 낱말에 A~D를 붙인 그림 문제 (낱말을 누르거나 단추로 고름)
function wordFig(parts, label) {
  let boxes = [];
  return {
    width: 600, height: 150, label,
    pick: (x, y) => boxes.findIndex(b => b && x >= b.x - 4 && x <= b.x + b.w + 4 && y >= 40 && y <= 125),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 150);
      let size = 22; g.font = qfont(size, 600);
      const sp = 9, wOf = w => w === '___' ? 64 : g.measureText(w).width, width = () => parts.reduce((s, [w]) => s + wOf(w) + (w === '.' ? 0 : sp), 0);
      while (width() > 570 && size > 14) { size--; g.font = qfont(size, 600); }
      let x = (600 - width()) / 2; boxes = [];
      g.textBaseline = 'middle';
      parts.forEach(([w, k]) => {
        if (w === '.') x -= sp;
        g.font = qfont(size, 600);
        const ww = wOf(w), on = st.done && k === st.answer, wrong = st.done && k >= 0 && k === st.pick && k !== st.answer;
        if (w === '___') { rrq(g, x, 76, ww, 32, 6); g.setLineDash([5, 4]); g.strokeStyle = QCOL.gap; g.lineWidth = 2; g.stroke(); g.setLineDash([]); x += ww + sp; return; }
        if (k >= 0) {
          boxes[k] = { x, w: ww };
          if (st.hover === k || on || wrong) { rrq(g, x - 4, 74, ww + 8, 36, 6); g.fillStyle = on ? 'rgba(110,200,255,0.22)' : wrong ? 'rgba(255,142,142,0.2)' : QCOL.hover; g.fill(); }
          qkey(g, k, x + ww / 2, 50);
          g.font = qfont(size, 600);
        }
        g.textAlign = 'left'; g.fillStyle = on ? QCOL.pt : QCOL.text; g.fillText(w, x, 92);
        x += ww + sp;
      });
    },
  };
}
// 짝 카드 네 장 가운데 고르는 그림 문제
function chipFig(chips, label, head) {
  const R = chips.map((_, k) => ({ x: 30 + (k % 2) * 280, y: 64 + Math.floor(k / 2) * 66, w: 260, h: 52 }));
  return {
    width: 600, height: 200, label,
    pick: (x, y) => R.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 200);
      g.font = qfont(19, 700); g.fillStyle = QCOL.ans; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(head, 300, 30);
      chips.forEach((c, k) => {
        const r = R[k], on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, r.x, r.y, r.w, r.h, 10); g.fillStyle = on ? 'rgba(127,224,168,0.16)' : wrong ? 'rgba(255,142,142,0.16)' : st.hover === k ? QCOL.hover : QCOL.panel; g.fill();
        g.strokeStyle = on ? QCOL.ok : wrong ? QCOL.bad : QCOL.line; g.lineWidth = 1.5; g.stroke();
        qkey(g, k, r.x + 22, r.y + r.h / 2);
        const parts = c.split('___');
        g.font = qfont(20, 600); g.textAlign = 'left';
        let x = r.x + 44;
        parts.forEach((p, i) => {
          if (p) { g.fillStyle = QCOL.text; g.fillText(p.trim() ? p : p, x, r.y + r.h / 2 + 1); x += g.measureText(p).width; }
          if (i < parts.length - 1) { rrq(g, x + 2, r.y + 13, 46, 26, 5); g.setLineDash([4, 3]); g.strokeStyle = QCOL.gap; g.lineWidth = 1.6; g.stroke(); g.setLineDash([]); x += 50; }
        });
      });
    },
  };
}
// 빌리는 방향 그림: 노트북이 Mina에게서 Jun에게 감
function loanFig(opts, label) {
  const R = opts.map((_, k) => ({ x: 24 + k * 142, y: 176, w: 130, h: 40 }));
  return {
    width: 600, height: 230, label,
    pick: (x, y) => R.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 230);
      const person = (cx, name) => {
        g.beginPath(); g.arc(cx, 46, 15, 0, Math.PI * 2); g.fillStyle = '#2A3644'; g.fill(); g.strokeStyle = QCOL.line; g.lineWidth = 1.5; g.stroke();
        g.beginPath(); g.arc(cx, 92, 26, Math.PI, 0); g.fill(); g.stroke();
        g.font = qfont(16, 700); g.fillStyle = QCOL.text; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, cx, 112);
      };
      person(120, 'Mina'); person(480, 'Jun');
      // 노트북 아이콘
      rrq(g, 272, 42, 56, 34, 4); g.fillStyle = '#1F2B38'; g.fill(); g.strokeStyle = QCOL.pt; g.lineWidth = 2; g.stroke();
      rrq(g, 262, 78, 76, 8, 3); g.fillStyle = QCOL.pt; g.fill();
      g.strokeStyle = QCOL.ans; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(170, 100); g.lineTo(424, 100); g.stroke();
      g.fillStyle = QCOL.ans; g.beginPath(); g.moveTo(434, 100); g.lineTo(420, 92); g.lineTo(420, 108); g.closePath(); g.fill();
      g.font = qfont(20, 600); g.fillStyle = QCOL.text; g.textAlign = 'center'; g.fillText('Jun ___ Mina’s laptop for the trip.', 300, 146);
      opts.forEach((o, k) => {
        const r = R[k], on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, r.x, r.y, r.w, r.h, 9); g.fillStyle = on ? 'rgba(127,224,168,0.16)' : wrong ? 'rgba(255,142,142,0.16)' : st.hover === k ? QCOL.hover : QCOL.panel; g.fill();
        g.strokeStyle = on ? QCOL.ok : wrong ? QCOL.bad : QCOL.line; g.lineWidth = 1.5; g.stroke();
        qkey(g, k, r.x + 18, r.y + r.h / 2);
        g.font = qfont(18, 600); g.fillStyle = QCOL.text; g.textAlign = 'left'; g.fillText(o, r.x + 34, r.y + r.h / 2 + 1);
      });
    },
  };
}
const FIG_PARTNER = wordFig([['Our', -1], ['team', 0], ['must', 1], ['___', -1], ['the', -1], ['deadline', 2], ['for', -1], ['the', -1], ['report', 3], ['.', -1]],
  '문장 Our team must 빈칸 the deadline for the report. 낱말 team, must, deadline, report에 A부터 D까지 표시된 그림');
const ADV_CHIPS = [['___ qualified', '___ qualified'], ['___ 200 people', '___ + 숫자'], ['___ after the meeting', '___ after'], ['respond ___', 'respond ___']];
const FIG_ADV = chipFig(ADV_CHIPS.map(c => c[0]), 'A ___ qualified, B ___ 200 people, C ___ after the meeting, D respond ___ 네 장의 짝 카드 그림', 'approximately가 들어갈 자리는?');
const LOAN = { key: '___ + 물건 (+ from)', need: 'v', dir: 'in', mean: 'loan', opts: ['lent', 'borrowed', 'reminded', 'raised'] };
const FIG_LOAN = loanFig(LOAN.opts, 'Mina에게서 Jun에게 노트북이 가는 화살표 그림과 문장 Jun 빈칸 Mina’s laptop for the trip. 보기 A lent, B borrowed, C reminded, D raised');
const QS = (() => {
  const by = (fr, opts) => opts.map(o => VC.judge(o, fr).s === 'ok');
  const q = [
    { q: '토익 어휘 문제의 보기가 conduct · attend · reserve · earn처럼 모두 같은 모양의 동사라면, 답을 정하는 것은?', opts: ['네 보기의 품사', '빈칸과 짝을 이루는 말', '보기 낱말의 길이', '문장의 시제'], a: 1,
      why: '넷 다 동사원형이라 문법으로는 모두 빈칸에 들어갈 수 있어요. 빈칸 뒤의 목적어 survey와 함께 쓰는 동사, conduct가 답이에요.', check: () => by(VC.INTRO, VC.INTRO.opts).join() === 'true,false,false,false' },
    { q: '한국어 ‘결정을 하다’를 영어로 옮길 때, decision과 짝을 이루는 동사는?', opts: ['do', 'hold', 'make', 'place'], a: 2,
      why: '하다를 그대로 do로 옮기면 틀려요. make a decision(결정을 내리다)이 짝이에요. reach a decision도 써요.', check: () => by({ key: '___ a decision', need: 'v' }, ['do', 'hold', 'make', 'place']).join() === 'false,false,true,false' },
    { q: '‘Our team must ___ the deadline for the report.’ 동사 빈칸의 짝은 어느 낱말일까요? 낱말을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_PARTNER,
      why: '동사 빈칸의 짝은 뒤의 목적어예요. 목적어 덩어리 the deadline for the report에서 중심 낱말은 deadline → meet the deadline(마감을 지키다).', check: () => VC.judgePair('meet', '___ a deadline').s === 'ok' },
    { q: '‘We need to address the issue quickly.’ 여기서 address의 뜻은?', opts: ['문제를 다루다 (해결하다)', '주소를 적다', '연설을 하다', '문제를 미루다'], a: 0,
      why: 'address an issue = 문제를 다루다. 낱말의 뜻은 짝이 정해요. address the audience처럼 사람이 짝이면 ‘연설하다’라는 뜻이 돼요.', check: () => VC.judgePair('address', '___ an issue').s === 'ok' },
    { q: 'The printer paper you ordered is out of ___. More will arrive next week. 빈칸에 알맞은 말은?', opts: ['order', 'charge', 'place', 'stock'], a: 3,
      why: 'out of stock = 재고가 없는. out of order는 ‘고장 난’, out of place는 ‘어울리지 않는’이라는 다른 덩어리예요.', check: () => by({ key: 'out of ___ (재고)', need: 'n' }, ['order', 'charge', 'place/n', 'stock']).join() === 'false,false,false,true' },
    { q: 'Ms. Wong is always ___ of others, so her team enjoys working with her. 빈칸에 알맞은 말은?', opts: ['considerate', 'considerable', 'considerably', 'consideration'], a: 0,
      why: 'be considerate of others = 남을 배려하다. considerable(상당한)은 양 · 정도에 쓰는 닮은꼴이에요. a considerable amount.', check: () => by({ key: 'be ___ of (사람)', need: 'adj' }, ['considerate', 'considerable', 'considerably', 'consideration']).join() === 'true,false,false,false' },
    { q: 'approximately(약)가 짝으로 고르는 자리는? 카드를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1, figure: FIG_ADV,
      why: 'approximately는 숫자 앞에 와요. approximately 200 people. highly qualified, shortly after, respond promptly처럼 다른 부사에도 저마다 짝이 있어요.', check: () => ADV_CHIPS.map(c => VC.judgePair('approximately', c[1]).s === 'ok').join() === 'false,true,false,false' },
    { q: 'The music was so loud that I could ___ hear my phone. 빈칸에 알맞은 말은?', opts: ['hard', 'highly', 'shortly', 'hardly'], a: 3,
      why: 'could hardly hear = 거의 들을 수 없었다. hard(열심히)는 꼬리만 다른 닮은꼴이에요.', check: () => by({ key: 'can · could ___', need: 'adv' }, ['hard', 'highly', 'shortly', 'hardly']).join() === 'false,false,false,true' },
    { q: '그림을 보고 빈칸에 알맞은 말을 고르세요. 노트북이 Mina에게서 Jun에게 가요. 보기를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1, figure: FIG_LOAN,
      why: 'Jun은 빌려 오는 쪽(남 → 주어)이라 borrowed. Mina가 주어라면 Mina lent Jun her laptop.', check: () => by(LOAN, LOAN.opts).join() === 'false,true,false,false' },
    { q: '3단계 풀이법의 순서로 알맞은 것은?', opts: ['함정 확인 → 짝 찾기 → 짝 맞추기', '짝 맞추기 → 함정 확인 → 짝 찾기', '문장 전체 해석 → 짝 맞추기 → 함정 확인', '짝 찾기 → 짝 맞추기 → 함정 확인'], a: 3,
      why: '① 빈칸 가까이에서 짝을 찾고, ② 그 짝과 함께 쓰는 보기를 고르고, ③ 닮은꼴 · 뒤의 구조 · 방향 같은 함정을 확인해요.' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[어휘 · 짝] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[어휘 · 짝] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-adjs)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }   // 장면 첫 0.45초는 밝아지는 중이라 조금 뒤에서 멈춤

// 발음 듣기 단추(직접 해 보기·놀이터·연습 문제·용어집): 누르면 영상을 멈추고 읽음
EN.say.wire(document, { before() { if (playing) pause(); } });
deckInit();
dictInit();
EN.drill({
  root: $('drillRoot'), items: VC.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 짝을 보는 눈이 생겼네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 07 · 08장을 다시 보고, 짝 카드로 짝을 더 모아 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '짝으로 푸는 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(VS.baseText()).then(() => { dirty = true; });
setTimeout(() => VS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
