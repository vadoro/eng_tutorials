/* 관계부사 · 복합관계사 · 명사절 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(빈자리 탐지기), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(WH), 그림은 scenes.js(WV)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const WH = window.WH, WV = window.WV, S = WV.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = WV;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cv = $('cv'), ctx = cv.getContext('2d');
WH.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = WV.fonts;
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
  const ready = new Promise(res => WV.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '빈자리가 있느냐 없느냐, 그것이 문제로다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { WV.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const c = started ? WV.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (c !== lastCap) { lastCap = c; capText.innerHTML = capHTML(c) || '&nbsp;'; }
  const ci = WV.chapterAt(T);
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
  if (dirty) { dirty = false; WV.render(ctx, started ? T : POSTER); }
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
const seg = (name, items, cur, attr = 'v') => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${t}</button>`).join('')}</div>`;
const enLine = (text, cls = '') => `<p class="enline ${cls}">${sayBtn(text)}<span lang="en">${esc(text)}</span></p>`;
const kw = w => `<b class="w-${WH.famOf(w) || 'full'}" lang="en">${esc(w)}</b>`;
// 연습 문제 하나를 직접 해 보기용 빈칸 문제로 (보기 단추 → 규칙 엔진으로 채점)
function miniQ(i) {
  const it = WH.DRILL[i];
  return `<div class="mini" data-q="${i}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map((w, k) => `<button type="button" data-k="${k}">${esc(w)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
// 빈칸 하나에 두 말 중 하나 (규칙 엔진으로 채점)
const TW = [
  { q: 'It is clear ___ we need more staff.', d: { front: 'noun', role: 'it', back: 'full', sense: 'fact' } },
  { q: '___ we need is more time.', d: { front: 'noun', role: 'subj', back: 'obj', sense: 'thing' } },
  { q: 'The report shows ___ sales rose in May.', d: { front: 'noun', role: 'obj', back: 'full', sense: 'fact' } },
  { q: 'We discussed ___ the client requested.', d: { front: 'noun', role: 'obj', back: 'obj', sense: 'thing' } },
];
const WIF = [
  { q: 'I wonder ___ the store is open.', d: { front: 'noun', role: 'obj', back: 'full', sense: 'yesno' } },
  { q: '___ the client will sign is still unclear.', d: { front: 'noun', role: 'subj', back: 'full', sense: 'yesno' } },
  { q: 'It depends on ___ we win the contract.', d: { front: 'noun', role: 'prep', back: 'full', sense: 'yesno' } },
  { q: 'Please ask him ___ he can come on Monday.', d: { front: 'noun', role: 'obj', back: 'full', sense: 'yesno' } },
  { q: 'Let me know ___ or not you can come.', d: { front: 'noun', role: 'obj', back: 'full', next: 'ornot', sense: 'yesno' } },
];
const ORD = [
  { ask: 'When does the train leave?', head: 'I don’t know when', subj: 'the train', opts: ['the train leaves', 'does the train leave'] },
  { ask: 'Where can I park?', head: 'Can you tell me where', subj: 'I', opts: ['can I park', 'I can park'] },
  { ask: 'Why was the meeting canceled?', head: 'Nobody knows why', subj: 'the meeting', opts: ['the meeting was canceled', 'was the meeting canceled'] },
];
const blankQ = q => esc(q).replace('___', '<span class="blank">&nbsp;</span>');
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ(0)}
    <p class="note">맞든 틀리든 괜찮아요. 영상 10장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  gap: () => `<h2>직접 해 보기</h2><h3>빈자리가 있을까, 없을까?</h3>
    <p class="note">빈칸 뒤에 올 절이에요. 주어나 목적어가 빠졌는지 보세요. 관계대명사가 처음이라면 <a href="../relative-pronouns/index.html">관계대명사, 빈자리를 찾아라</a>를 먼저 보고 와도 좋아요.</p>
    <ol class="gapq">${WH.FRAGS.map((fr, i) => `<li data-f="${i}"><span lang="en">${esc(fr.t)}</span><span class="mo"><button type="button" data-fg="gap">빈자리 있음</button><button type="button" data-fg="full">빠진 것 없음</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>`,
  radv: () => {
    const r = WV.RADV.find(x => x.k === S.adv);
    return `<h2>직접 해 보기</h2><h3>관계부사 고르기</h3>
      ${seg('선행사의 뜻', WV.RADV.map(x => [x.k, `${x.name} · <span lang="en">${x.w}</span>`]).concat([['', '모두']]), S.adv || '')}
      ${r ? `${enLine(r.ex, 'small')}<p class="verdict">선행사 = ${esc(r.name)} · 뒤 <i lang="en">${esc(r.clause)}</i> → 빠진 것 없음 · 절 안에서 빠진 말 = <i lang="en">${esc(r.back)}</i></p>`
        : '<p class="note">선행사의 뜻을 고르면 화면에서 그 카드가 켜져요.</p>'}
      ${miniQ(2)}`;
  },
  pw: () => {
    const k = S.pw, e = k && WV.PW[k];
    return `<h2>직접 해 보기</h2><h3>전치사 + which → 관계부사</h3>
      ${seg('뜻', Object.entries(WV.PW).map(([kk, x]) => [kk, `${x.name} · <span lang="en">${x.p} which</span>`]), k || '')}
      ${e ? `${enLine(WV.pwText(k, false), 'small')}${enLine(WV.pwText(k, true), 'small')}<p class="note">${k === 'way' ? '<i lang="en">the way</i>와 <i lang="en">how</i>는 함께 쓰지 않아요. 하나만 쓰거나 <i lang="en">the way in which</i>.' : `<i lang="en">${esc(e.p)} which</i> = <i lang="en">${esc(e.w)}</i>. 둘 다 뒤에 완전한 문장.`}</p>`
        : '<p class="note">뜻을 고르면 화면 위쪽 문장이 그 꼴로 바뀌어요.</p>'}
      ${miniQ(3)}`;
  },
  cpro: () => `<h2>직접 해 보기</h2><h3>선행사를 품은 말</h3>${miniQ(5)}${miniQ(6)}
    <p class="note"><i lang="en">whoever</i> = <i lang="en">anyone who</i>, <i lang="en">whatever</i> = <i lang="en">anything that</i>. 둘 다 뒤에 빈자리가 있어요.</p>`,
  cadv: () => `<h2>직접 해 보기</h2><h3>아무리 ~해도 · 어디서 ~하든</h3>${miniQ(7)}${miniQ(8)}
    <p class="note">빈칸 바로 뒤에 형용사가 보이면 <i lang="en">however</i>. 뒤가 완전한 문장이면 <i lang="en">wherever · whenever</i>.</p>`,
  thatwhat: () => `<h2>직접 해 보기</h2><h3>that일까, what일까?</h3>
    <ol class="gapq">${TW.map((x, i) => `<li data-tw="${i}"><span lang="en">${blankQ(x.q)}</span><span class="mo"><button type="button" data-tww="that">that</button><button type="button" data-tww="what">what</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>
    <p class="note">빈칸 뒤가 완전하면 <i lang="en">that</i>, 빈자리가 있으면 <i lang="en">what</i>.</p>`,
  whether: () => `<h2>직접 해 보기</h2><h3>if로 바꿔 쓸 수 있을까?</h3>
    <ol class="gapq">${WIF.map((x, i) => `<li data-wi="${i}"><span lang="en">${blankQ(x.q)}</span><span class="mo"><button type="button" data-wia="both">둘 다 돼요</button><button type="button" data-wia="whether">whether만</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>
    <p class="note">화면의 네 자리에 <i lang="en">if</i>를 넣어 보기:</p>
    ${seg('if를 넣어 볼 자리', WV.WROWS.map((r, i) => [String(i), esc(r.tag)]).concat([['', '원래대로']]), S.wrow == null ? '' : String(S.wrow), 'wr')}`,
  order: () => `<h2>직접 해 보기</h2><h3>질문을 문장 속에 넣어 보기</h3>
    <ol class="gapq">${ORD.map((x, i) => `<li data-or="${i}"><span lang="en">${esc(x.ask)} → ${esc(x.head)} ___?</span><span class="mo">${x.opts.map((o, k) => `<button type="button" data-ork="${k}" lang="en">${esc(o)}</button>`).join('')}</span><span class="mr" role="status"></span></li>`).join('')}</ol>`,
  method: () => {
    const P = S.path || {};
    const sel = (id, name, obj, cur) => `<div class="pick"><span>${name}</span><select id="${id}" class="sel">${['<option value="">고르기</option>'].concat(Object.entries(obj).map(([k, v]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${esc(v)}</option>`)).join('')}</select></div>`;
    let out = '';
    if (P.back && P.front) {
      const r = WH.pathWords(P.back, P.front);
      out = r.words.length
        ? `<p class="verdict">들어갈 수 있는 말: ${r.words.map(x => `${kw(x.w)}${x.sense ? ` <small>${esc(WH.SENSE[x.sense])}</small>` : ''}`).join(' · ')}</p><p class="note">뜻(사람·물건·사실·여부…)과 함정은 ③ 단계에서 하나로 좁혀요.</p>`
        : `<p class="verdict"><b class="c-no">이 조합에 맞는 말이 없어요.</b> ${P.front.startsWith('ante') && P.back === 'full' ? '사람·사물 명사 뒤 + 완전한 문장 → 관계대명사도 관계부사도 맞지 않아요. 빈자리를 다시 찾아보세요.' : '토익 빈칸에서는 잘 나오지 않는 조합이에요.'}</p>`;
    }
    return `<h2>직접 해 보기</h2><h3>관계사 · 명사절 판별기</h3>
      <p class="note">빈칸 뒤의 모양과 빈칸 앞의 자리를 고르면, 흐름도에 길이 켜지고 들어갈 수 있는 말이 나와요.</p>
      ${sel('labB', '① 뒤', WH.BACKS, P.back)}${sel('labF', '② 앞', WH.FRONTS, P.front)}
      ${out}${S.path ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${WH.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 빈자리 탐지기: 빈칸 뒤 절에서 빠진 자리를 누르고, 들어갈 말을 확인하기</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${WH.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li>
    <li><a href="../relative-pronouns/index.html">관계대명사, 빈자리를 찾아라</a> — 앞 튜토리얼(T01)</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
const verdictText = (j, extra = '') => (j.s === 'ok' ? '맞아요! ' : j.s === 'warn' ? '△ ' : '아니에요. ') + extra + j.why;
// 직접 해 보기의 조작은 한곳에서 처리 (다시 만들어도 이어서 동작)
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = CHAPTERS[WV.chapterAt(T)].id;
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[WV.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { S.path = null; touch(); buildLab(WV.chapterAt(T)); return; }
  const mark = (row, okv, msg) => {
    row.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(okv ? 'right' : 'wrong');
    row.querySelector('.mr').textContent = msg;
    if (playing) pause();
  };
  if (b.dataset.k != null) {                                // 빈칸 문제
    const box = b.closest('.mini'), it = WH.DRILL[+box.dataset.q], k = +b.dataset.k, j = WH.judgeOpt(it, k);
    mark(box, j.s === 'ok', `${it.type === 'order' ? WH.FORMNAME[j.form] : WH.kindName(it.opts[k])}. ` + verdictText(j));
    return;
  }
  if (b.dataset.fg) {                                       // 빈자리가 있나
    const li = b.closest('li'), fr = WH.FRAGS[+li.dataset.f], okv = (b.dataset.fg === 'gap') === !!fr.gap;
    mark(li, okv, (okv ? '맞아요. ' : '다시 보세요. ') + fr.why + (fr.gap ? ` → ${WH.GAPNAME[fr.gap]} 빈자리.` : ''));
    return;
  }
  if (b.dataset.tww) {                                      // that일까 what일까
    const li = b.closest('li'), x = TW[+li.dataset.tw], j = WH.judge(b.dataset.tww, x.d);
    mark(li, j.s === 'ok', verdictText(j));
    return;
  }
  if (b.dataset.wia) {                                      // if도 될까
    const li = b.closest('li'), x = WIF[+li.dataset.wi], ifOk = WH.isOk('if', x.d), okv = (b.dataset.wia === 'both') === ifOk;
    mark(li, okv, (okv ? '맞아요. ' : '다시 보세요. ') + (ifOk ? '동사의 목적어 자리 → whether도 if도 돼요.' : WH.judge('if', x.d).why));
    return;
  }
  if (b.dataset.ork != null) {                              // 어순
    const li = b.closest('li'), x = ORD[+li.dataset.or], o = x.opts[+b.dataset.ork], j = WH.judgeOrder(o, x.subj);
    mark(li, j.s === 'ok', (j.s === 'ok' ? `맞아요. ${x.head} ${o}? ` : '아니에요. ') + j.why);
    return;
  }
  if (b.dataset.wr != null) { S.wrow = b.dataset.wr === '' ? null : +b.dataset.wr; showAt(29); touch(); buildLab(WV.chapterAt(T)); return; }
  const grp = b.closest('.seg'); if (!grp || b.dataset.v == null) return;
  const v = b.dataset.v || null;
  if (id === 'radv') { S.adv = v; showAt(16); }
  else if (id === 'pw') { S.pw = v; showAt(27.5); }
  touch(); buildLab(WV.chapterAt(T));
});
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showAt(u) { const ch = CHAPTERS[WV.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (!['labB', 'labF'].includes(t.id)) return;
  const back = $('labB').value, front = $('labF').value;
  S.path = back || front ? { back, front } : null;
  showAt(25.5);
  touch(); buildLab(WV.chapterAt(T));
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
   6. 놀이터 — 빈자리 탐지기
   ========================================================= */
const ICONS = {
  ok: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  no: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  warn: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.5l7 13H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 8.5v3.5M10 14.3v.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};
const FAMLINE = {
  gap: '빈자리가 있으면 → 빠진 명사를 대신하는 대명사 쪽: which · who · whom · that · what · whoever · whatever',
  full: '빠진 것이 없으면 → 부사·접속사 쪽: where · when · why · how · that · whether · if · however · wherever · whenever',
};
const DS = { i: 0, cur: 0, st: WH.DET.map(() => ({ g: null, gOk: false, gMiss: 0, f: null, fOk: false, fMiss: 0, pick: null })) };
const anteOf = it => { const b = it.q.indexOf('___'), w = it.q.slice(0, b).trim().split(' '); return w.slice(-2).join(' '); };
function detGapMsg(it, k) {
  if (k === it.gapAt) return `맞아요. ${it.why}`;
  if (it.gapAt < 0) return `그 자리는 비어 있지 않아요. ${it.why}` + (it.trapHint ? ` ${it.trapHint}` : '');
  if (k < 0) return `빠진 자리가 있어요. 동사를 찾고, 그 앞(주어)과 뒤(목적어)를 보세요.` + (it.trapHint ? ` ${it.trapHint}` : '');
  return `빈자리가 있긴 해요. 그런데 그 자리는 아니에요. ${it.d.back === 'subj' ? '동사 앞에 주어가 있나요?' : '어느 동사(전치사) 뒤에 무엇을?이 비었나요?'}` + (it.trapHint ? ` ${it.trapHint}` : '');
}
function detFrontMsg(it, f) {
  const d = it.d, okv = f === d.front;
  const right = d.front === 'ante' ? `빈칸 앞 명사 ‘${anteOf(it)}’ → 그 명사를 꾸미는 관계사 자리예요.`
    : d.front === 'noun' ? `빈칸 앞에 꾸밀 명사가 없어요. 빈칸 + 절이 문장의 ${WH.ROLE[d.role]} 자리, 곧 명사절이에요.`
    : '빈칸 + 절 뒤에 쉼표와 완전한 문장이 따로 있어요 → 그 문장에 붙는 부사절 자리예요.';
  if (okv) return '맞아요. ' + right;
  return '다시 보세요. ' + (d.front === 'ante' ? '빈칸 바로 앞에 명사가 있어요. 그 명사를 뒤에서 꾸미고 있지 않나요?'
    : d.front === 'noun' ? (d.role === 'prep' ? '빈칸 바로 앞이 전치사예요. 전치사 뒤 = 명사 자리.' : '빈칸 + 절이 문장의 주어나 목적어 노릇을 해요.')
    : '빈칸 + 절을 빼도 뒤 문장이 혼자 완전해요.');
}
function detRender() {
  const it = WH.DET[DS.i], st = DS.st[DS.i], toks = WH.detTokens(it), b = it.q.indexOf('___');
  $('dList').querySelectorAll('button').forEach((x, i) => {
    const s = DS.st[i];
    x.setAttribute('aria-pressed', String(i === DS.i));
    x.classList.toggle('done', s.fOk); x.classList.toggle('clean', s.fOk && !s.gMiss && !s.fMiss);
  });
  // 문장: 앞부분 + 빈칸 + (자리 단추 + 낱말)… + 뒷부분
  const pre = it.q.slice(0, b), rest = it.q.slice(b + 4 + it.clause.length);
  const showGap = st.gOk && it.gapAt >= 0;
  const caret = k => {
    const cls = st.g === k ? (k === it.gapAt ? ' hit' : ' miss') : '';
    if (showGap && k === it.gapAt) return '<span class="gapbox" aria-label="빈자리"></span>';
    return `<button type="button" class="caret${cls}" data-gap="${k}" aria-label="${k === 0 ? '첫 낱말 앞' : `${esc(toks[k - 1])} 뒤`}"${st.gOk ? ' disabled' : ''}><i></i></button>`;
  };
  const fillWord = st.pick ? esc(st.pick) : '', fillBad = st.pick && WH.judge(st.pick, it.d).s !== 'ok';
  let html = `<span>${esc(pre)}</span><span class="dblank${fillWord ? ' filled' : ''}${fillBad ? ' bad' : ''}">${fillWord || '&nbsp;'}</span> <span class="dclause${st.gOk ? (it.gapAt >= 0 ? ' g' : ' f') : ''}">`;
  toks.forEach((w, k) => { html += caret(k) + `<span class="w">${esc(w)}</span>`; });
  html += caret(toks.length) + `</span><span>${esc(rest)}</span>`;
  $('dQ').innerHTML = html;
  $('dNone').disabled = st.gOk;
  $('dNone').classList.toggle('hit', st.g === -1 && it.gapAt === -1);
  $('dNone').classList.toggle('miss', st.g === -1 && it.gapAt !== -1);
  $('dF1').innerHTML = st.g == null ? '' : esc(detGapMsg(it, st.g)) + (st.gOk ? `<br><b class="${it.gapAt >= 0 ? 'w-gap' : 'w-full'}">${esc(FAMLINE[it.gapAt >= 0 ? 'gap' : 'full'])}</b>` : '');
  $('dF1').className = 'dfb' + (st.g == null ? '' : st.gOk ? ' ok' : ' no');
  // ② 앞
  $('dS2').hidden = !st.gOk;
  $('dFront').querySelectorAll('button').forEach(x => {
    x.disabled = st.fOk;
    x.classList.toggle('hit', st.f === x.dataset.front && x.dataset.front === it.d.front);
    x.classList.toggle('miss', st.f === x.dataset.front && x.dataset.front !== it.d.front);
  });
  $('dF2').textContent = st.f == null ? '' : detFrontMsg(it, st.f);
  $('dF2').className = 'dfb' + (st.f == null ? '' : st.fOk ? ' ok' : ' no');
  // ③ 결과: 후보 16개를 규칙 엔진으로
  $('dS3').hidden = !st.fOk;
  if (st.fOk) {
    const js = WH.CANDS.map(w => [w, WH.judge(w, it.d)]);
    const good = js.filter(([, j]) => j.s === 'ok').map(([w]) => w);
    const grp = fam => js.filter(([w]) => (WH.famOf(w) === 'both' ? (it.gapAt >= 0 ? 'gap' : 'full') : WH.famOf(w)) === fam)
      .map(([w, j]) => `<button type="button" class="cand ${j.s}${st.pick === w ? ' cur' : ''}" data-cand="${w}" lang="en" aria-label="${w} ${j.s === 'ok' ? '맞음' : j.s === 'warn' ? '시험 답 아님' : '틀림'}"><span class="ic">${ICONS[j.s === 'ok' ? 'ok' : j.s === 'warn' ? 'warn' : 'no']}</span>${w}</button>`).join('');
    $('dCands').innerHTML = `<div class="cgrp"><h4 class="w-gap">빈자리 쪽</h4>${grp('gap')}</div><div class="cgrp"><h4 class="w-full">완전 쪽</h4>${grp('full')}</div>`;
    const pj = st.pick ? WH.judge(st.pick, it.d) : null;
    $('dWhy').innerHTML = pj ? `<b lang="en">${esc(st.pick)}</b> — ${pj.s === 'ok' ? '' : (pj.s === 'warn' ? '△ ' : '× ') + WH.STEPNAME[pj.step] + ' — '}${esc(pj.why)}` : '낱말을 누르면 맞고 틀린 까닭이 나와요.';
    const full = it.q.replace('___', good[0] || it.ans);
    $('dAns').innerHTML = `<span>들어갈 수 있는 말: ${good.map(w => kw(w)).join(' · ')}</span>` +
      `<span class="enline small">${sayBtn(full)}<span lang="en">${esc(full)}</span></span><span class="note">${esc(it.ko)}</span>` +
      `<span class="dfill">${it.gapAt >= 0 ? '빈자리를 채워 보면' : '확인'}: <i lang="en">${esc(it.fill)}</i></span>`;
  }
  const done = DS.st.filter(s => s.fOk).length, clean = DS.st.filter(s => s.fOk && !s.gMiss && !s.fMiss).length;
  $('dScore').innerHTML = `끝낸 문장 <b>${done} / ${WH.DET.length}</b> · 두 단계를 한 번에 맞힌 문장 <b>${clean}</b>${done === WH.DET.length ? ' — 다 끝냈어요!' : ''}`;
}
function detGo(i) {
  DS.i = (i + WH.DET.length) % WH.DET.length; DS.cur = 0; detRender();
  if (!$('det').contains(document.activeElement)) $('det').focus({ preventScroll: true });   // 다시 그린 단추에 있던 초점을 되살림
}
function detGap(k) {
  const it = WH.DET[DS.i], st = DS.st[DS.i]; if (st.gOk) return;
  st.g = k; st.gOk = k === it.gapAt; if (!st.gOk) st.gMiss++;
  detRender();
  if (st.gOk) { const f = $('dFront').querySelector('button'); if (f) f.focus({ preventScroll: true }); }
  else { const c = k < 0 ? $('dNone') : $('dQ').querySelector(`[data-gap="${k}"]`); if (c) c.focus({ preventScroll: true }); }
}
function detFront(f) {
  const it = WH.DET[DS.i], st = DS.st[DS.i]; if (!st.gOk || st.fOk) return;
  st.f = f; st.fOk = f === it.d.front; if (!st.fOk) st.fMiss++;
  if (st.fOk) st.pick = WH.valid(it.d)[0] || it.ans;
  detRender();
  // 고른 단추가 잠기면 초점이 사라지므로, 맞혔으면 후보 단추로 초점을 옮김 (키보드로 이어서 쓸 수 있게)
  if (st.fOk) { const nb = $('dCands').querySelector('.cand.cur') || $('dCands').querySelector('button'); if (nb) nb.focus({ preventScroll: true }); }
}
function detInit() {
  $('dList').innerHTML = WH.DET.map((it, i) => `<button type="button" data-di="${i}" aria-label="문장 ${i + 1}">${i + 1}</button>`).join('');
  $('dFront').innerHTML = Object.entries(WH.FRONT3).map(([k, v], i) => `<button type="button" data-front="${k}"><kbd>${i + 1}</kbd>${esc(v)}</button>`).join('');
  $('det').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-say')) return;
    if (b.dataset.di != null) detGo(+b.dataset.di);
    else if (b.dataset.gap != null) detGap(+b.dataset.gap);
    else if (b.id === 'dNone') detGap(-1);
    else if (b.dataset.front) detFront(b.dataset.front);
    else if (b.dataset.cand) { DS.st[DS.i].pick = b.dataset.cand; detRender(); const nb = $('dCands').querySelector(`[data-cand="${b.dataset.cand}"]`); if (nb) nb.focus({ preventScroll: true }); }
    else if (b.id === 'dPrev') detGo(DS.i - 1);
    else if (b.id === 'dNext') detGo(DS.i + 1);
  });
  $('det').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const st = DS.st[DS.i];
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); detGo(DS.i + (e.key === 'ArrowDown' ? 1 : -1)); return; }
    if (e.key === '0' || e.key === 'n') { e.preventDefault(); detGap(-1); return; }
    const n = '123'.indexOf(e.key);
    if (n >= 0 && st.gOk) { e.preventDefault(); detFront(Object.keys(WH.FRONT3)[n]); return; }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !st.gOk) {
      e.preventDefault();
      const cs = [...$('dQ').querySelectorAll('.caret'), $('dNone')];
      const at = cs.indexOf(document.activeElement);
      const k = at < 0 ? 0 : (at + (e.key === 'ArrowRight' ? 1 : -1) + cs.length) % cs.length;
      cs[k].focus({ preventScroll: true });
    }
  });
  detRender();
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', ante: '#6EC8FF', rel: '#FFC15E', gap: '#FF7AA8', cl: '#7FE0A8', v: '#C9A7FF', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// 그림 문제 1: 관계사절 속 빈자리 위치 고르기 (A~D는 낱말 사이 자리)
const FIG_GAP = (() => {
  const words = [['The hotel', QCOL.ante], ['which', QCOL.rel], ['we', QCOL.text], ['reserved', QCOL.v], ['offers', QCOL.text], ['free parking.', QCOL.text]];
  const SLOT = [2, 3, 4, 6];            // A: which 뒤, B: we 뒤, C: reserved 뒤, D: 문장 끝 (앞 낱말 수)
  let xs = null;                          // 낱말 사이 자리의 x (그릴 때 계산)
  const layout = g => {
    g.font = qfont(18, 600);
    const sp = 38, ws = words.map(([t]) => g.measureText(t).width), total = ws.reduce((s, w) => s + w, 0) + sp * (words.length - 1);
    let x = (600 - total) / 2; const pos = [], gapX = [x - sp / 2];
    ws.forEach((w, i) => { pos.push(x); x += w + sp; gapX.push(x - sp / 2); });
    gapX[words.length] = pos[words.length - 1] + ws[words.length - 1] + sp / 2;
    xs = { pos, ws, gapX };
    return xs;
  };
  return {
    width: 600, height: 170, label: '문장 The hotel which we reserved offers free parking. 낱말 사이에 A(which 뒤), B(we 뒤), C(reserved 뒤), D(문장 끝) 네 자리',
    pick: (x, y) => { if (!xs || y < 40 || y > 140) return -1; let best = -1, bd = 26; SLOT.forEach((s, k) => { const dx = Math.abs(x - xs.gapX[s]); if (dx < bd) { bd = dx; best = k; } }); return best; },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 170);
      const L = layout(g);
      g.textBaseline = 'middle';
      words.forEach(([t, c], i) => {
        g.font = qfont(18, 600); g.fillStyle = c; g.textAlign = 'left'; g.fillText(t, L.pos[i], 70);
        if (i === 0) { g.fillStyle = QCOL.ante; g.fillRect(L.pos[0], 84, L.ws[0], 3); }
      });
      // 관계사절 밑줄 (which we reserved)
      g.strokeStyle = QCOL.cl; g.lineWidth = 2; g.beginPath(); g.moveTo(L.pos[1], 96); g.lineTo(L.pos[3] + L.ws[3], 96); g.stroke();
      SLOT.forEach((s, k) => {
        const x = L.gapX[s], on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer, hv = st.hover === k;
        if (on) { rrq(g, x - 14, 54, 28, 32, 7); g.strokeStyle = QCOL.gap; g.setLineDash([5, 4]); g.lineWidth = 2; g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(255,122,168,0.18)'; g.fill(); }
        g.strokeStyle = on ? QCOL.gap : wrong ? QCOL.bad : hv ? QCOL.key : 'rgba(238,241,244,0.35)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, 104); g.lineTo(x, 124); g.stroke();
        rrq(g, x - 15, 126, 30, 28, 7); g.fillStyle = on ? 'rgba(255,193,94,0.25)' : wrong ? 'rgba(255,142,142,0.2)' : hv ? QCOL.hover : '#18202A'; g.fill();
        g.font = qfont(14, 700); g.fillStyle = QCOL.key; g.textAlign = 'center'; g.fillText('ABCD'[k], x, 141);
      });
      if (st.done) { g.font = qfont(13, 700); g.fillStyle = QCOL.gap; g.textAlign = 'center'; g.fillText('빈자리 = the hotel', L.gapX[SLOT[st.answer]], 30); }
    },
  };
})();
// 그림 문제 2: 관계부사 where 뒤에 올 수 있는 절 (완전한 문장)
const WHERE4 = [{ t: 'I work', gap: null }, { t: 'we visited', gap: 'obj' }, { t: 'Ms. Kim manages', gap: 'obj' }, { t: 'the team designed', gap: 'obj' }];
const FIG_WHERE = (() => {
  const box = k => ({ x: 20 + (k % 2) * 290, y: 56 + Math.floor(k / 2) * 62, w: 270, h: 50 });
  return {
    width: 600, height: 186, label: '문장 This is the office where ___ . 조각 네 개: A I work, B we visited, C Ms. Kim manages, D the team designed',
    pick: (x, y) => WHERE4.findIndex((f, k) => { const b = box(k); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 186);
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = qfont(17, 700); g.fillStyle = QCOL.ante; g.fillText('This is the office', 20, 26);
      const w0 = g.measureText('This is the office ').width;
      g.fillStyle = QCOL.rel; g.fillText('where', 20 + w0, 26);
      const w1 = g.measureText('where ').width;
      rrq(g, 20 + w0 + w1, 12, 70, 28, 6); g.strokeStyle = QCOL.gap; g.setLineDash([5, 4]); g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
      g.fillStyle = QCOL.muted; g.fillText('.', 20 + w0 + w1 + 76, 26);
      WHERE4.forEach((f, k) => {
        const b = box(k), on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        const c = st.done ? (f.gap ? QCOL.gap : QCOL.cl) : QCOL.muted;
        rrq(g, b.x, b.y, b.w, b.h, 10); g.fillStyle = on ? 'rgba(255,193,94,0.18)' : wrong ? 'rgba(255,142,142,0.18)' : st.hover === k ? QCOL.hover : '#18202A'; g.fill();
        g.strokeStyle = c; g.lineWidth = on ? 2.5 : 1.5; if (st.done && f.gap) g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]);
        g.font = qfont(14, 700); g.fillStyle = QCOL.key; g.textAlign = 'left'; g.fillText('ABCD'[k], b.x + 12, b.y + b.h / 2);
        g.font = qfont(18, 600); g.fillStyle = QCOL.text; g.fillText(f.t, b.x + 34, b.y + b.h / 2);
        if (st.done) { g.font = qfont(12, 700); g.fillStyle = c; g.textAlign = 'right'; g.fillText(f.gap ? '목적어 빈자리' : '완전', b.x + b.w - 10, b.y + 13); }
      });
    },
  };
})();
const QS = (() => {
  const by = (opts, d) => opts.map(w => WH.isOk(w, d)).join();
  const D = i => WH.DRILL[i].d;
  const q = [
    { q: '‘The hotel which we reserved offers free parking.’ 관계사절 속 빈자리는 어디일까요? 그림의 자리를 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_GAP,
      why: 'reserved(예약했다) → 무엇을? 목적어가 비었어요. 그 자리에 들어갈 것이 선행사 the hotel이에요. 대명사(it)가 which로 바뀌어 앞으로 갔기 때문이에요.' },
    { q: '‘This is the office where ___.’ 빈칸에 들어갈 수 있는 절은? 조각을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 0, figure: FIG_WHERE,
      why: '관계부사 where 뒤에는 완전한 문장이 와요. I work → work(일하다)는 목적어가 필요 없어 빠진 것이 없어요. 나머지는 visited · manages · designed 뒤에 목적어가 비어서 which와 어울려요.',
      check: () => WHERE4.map(f => WH.isOk('where', { front: 'ante', ante: 'place', back: f.gap || 'full' })).join() === 'true,false,false,false' },
    { q: '‘the hotel at which we stayed’ — at which 자리에 바꿔 쓸 수 있는 한 낱말은?', opts: ['what', 'that', 'when', 'where'], a: 3,
      why: 'at which = where. 선행사 the hotel → 장소, 뒤 we stayed → 빠진 것 없는 완전한 문장이에요.',
      check: () => { const d = { front: 'ante', ante: 'place', back: 'full', pw: 'at' }; return WH.isOk('at which', d) && by(['what', 'that', 'when', 'where'], d) === 'false,false,false,true'; } },
    { q: '다음 가운데 틀린 표현은?', opts: ['the way we work', 'how we work', 'the way how we work', 'the way in which we work'], a: 2,
      why: 'the way how는 쓰지 않아요. the way와 how 가운데 하나만 쓰거나, the way in which를 써요.',
      check: () => { const d = { front: 'ante', ante: 'way', back: 'full', pw: 'in' }; return !WH.isOk('how', d) && WH.isOk('in which', d); } },
    { q: '‘___ arrives first should unlock the office.’ 빈칸에 알맞은 말은?', opts: ['Who', 'Whatever', 'Whenever', 'Whoever'], a: 3,
      why: '빈칸 뒤 arrives → 주어 빈자리. 앞에 선행사가 없고 뜻이 ‘먼저 오는 사람은 누구든’ → Whoever(= Anyone who). Whenever는 뒤에 완전한 문장이 와야 해요.',
      check: () => by(['Who', 'Whatever', 'Whenever', 'Whoever'], D(5)) === 'false,false,false,true' },
    { q: '‘___ busy we are, safety comes first.’ 빈칸에 알맞은 말은?', opts: ['However', 'Whatever', 'Whenever', 'Whoever'], a: 0,
      why: '빈칸 바로 뒤에 형용사 busy → 형용사를 데리고 앞으로 나오는 However(아무리 ~해도). However busy we are = No matter how busy we are.',
      check: () => by(['However', 'Whatever', 'Whenever', 'Whoever'], D(7)) === 'true,false,false,false' },
    { q: '‘It is clear ___ we need more staff.’ ‘___ we need is more time.’ 두 빈칸에 차례로 들어갈 말은?', opts: ['what — that', 'that — what', 'that — that', 'what — what'], a: 1,
      why: '첫 문장의 빈칸 뒤 we need more staff → 완전한 문장 → that. 둘째 문장의 we need → need 뒤가 비었어요 → what(~하는 것).',
      check: () => WH.isOk('that', { front: 'noun', role: 'it', back: 'full', sense: 'fact' }) && !WH.isOk('what', { front: 'noun', role: 'it', back: 'full', sense: 'fact' }) &&
        WH.isOk('what', { front: 'noun', role: 'subj', back: 'obj', sense: 'thing' }) && !WH.isOk('that', { front: 'noun', role: 'subj', back: 'obj', sense: 'thing' }) },
    { q: 'whether를 if로 바꿔 쓸 수 없는 문장은?', opts: ['I wonder whether the store is open.', 'Ask him whether he can come.', 'It depends on whether we win the contract.', 'I don’t know whether she called.'], a: 2,
      why: '전치사(on) 바로 뒤에는 if를 못 써요. 나머지 셋은 동사(wonder · ask · know)의 목적어 자리라서 if도 돼요.',
      check: () => [['obj'], ['obj'], ['prep'], ['obj']].map(([role]) => WH.isOk('if', { front: 'noun', role, back: 'full', sense: 'yesno' })).join() === 'true,true,false,true' },
    { q: '‘Can you tell me where ___?’ 빈칸에 알맞은 것은?', opts: ['I can park', 'can I park', 'park I can', 'I parking'], a: 0,
      why: '질문(Where can I park?)이 문장 속에 들어가면 평서문 어순으로 되돌려요 → where I can park.',
      check: () => ['I can park', 'can I park', 'park I can', 'I parking'].map(o => WH.formOf(o, 'I')).join() === 'stmt,q,vs,ing' },
    { q: '빈칸 뒤 문장에 빈자리가 있을 때 들어갈 수 있는 말끼리 묶은 것은?', opts: ['where · when · why', 'what · whoever · which', 'that · whether · if', 'however · wherever · whenever'], a: 1,
      why: 'what · whoever · which는 빠진 명사(주어·목적어)를 대신하는 말이라 뒤에 빈자리가 있어요. 나머지 묶음은 뒤에 완전한 문장이 와요.',
      check: () => [['where', 'when', 'why'], ['what', 'whoever', 'which'], ['that', 'whether', 'if'], ['however', 'wherever', 'whenever']].map(ws => ws.every(w => WH.famOf(w) === 'gap')).join() === 'false,true,false,false' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[관계부사·명사절] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[관계부사·명사절] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
  const ci = WV.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * WV.W, (e.clientY - r.top) / r.height * WV.H]; };
const hitAt = (x, y) => started ? WV.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.say && EN.say.supported) { if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say && EN.say.supported ? '눌러서 발음 듣기: ' + h.say : ''; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-pw)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }   // 장면 첫 0.45초는 밝아지는 중이라 조금 뒤에서 멈춤

// 발음 듣기 단추(직접 해 보기·놀이터·연습 문제·용어집): 누르면 영상을 멈추고 읽음
EN.say.wire(document, { before() { if (playing) pause(); } });
detInit();
EN.drill({
  root: $('drillRoot'), items: WH.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 뒤 → 앞 → 함정, 3단계 풀이법이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 09·10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '빈자리 하나로 관계사와 명사절을 모두 가를 수 있게 됐어요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(WV.baseText()).then(() => { dirty = true; });
setTimeout(() => WV.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
