/* 연결어 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(연결어 조립대 · 연결어 사전), 연습 문제, 퀴즈, 영상 추출
 * 규칙과 예문은 grammar.js(LK), 그림은 scenes.js(LV)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const LK = window.LK, LV = window.LV, S = LV.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = LV;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const cv = $('cv'), ctx = cv.getContext('2d');
LK.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = LV.fonts;
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
  const ready = new Promise(res => LV.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '접속사냐 전치사냐, 빈칸 뒤가 답한다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { LV.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const c = started ? LV.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (c !== lastCap) { lastCap = c; capText.innerHTML = capHTML(c) || '&nbsp;'; }
  const ci = LV.chapterAt(T);
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
  if (dirty) { dirty = false; LV.render(ctx, started ? T : POSTER); }
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
const KN = LK.KIND;
const seg = (name, items, cur, attr = 'v') => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${t}</button>`).join('')}</div>`;
const enLine = (text, cls = '') => `<p class="enline ${cls}">${sayBtn(text)}<span lang="en">${esc(text)}</span></p>`;
const kw = (w, k) => `<b class="k-${k || LK.word(w).kinds[0]}" lang="en">${esc(w)}</b>`;
// 연습 문제 하나를 직접 해 보기용 빈칸 문제로 (보기 단추 → 규칙 엔진으로 채점)
function miniQ(i) {
  const it = LK.DRILL[i];
  return `<div class="mini" data-q="${i}"><p class="mq" lang="en">${esc(it.q).replace('___', '<span class="blank">&nbsp;</span>')}</p>
    <div class="mo">${it.opts.map((w, k) => `<button type="button" data-k="${k}">${esc(w)}</button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
const KINDS3 = [
  ['conj', 'Although it rained, the concert continued.', '비가 왔지만, 공연은 계속됐어요.'],
  ['prep', 'Despite the rain, the concert continued.', '비에도 불구하고 공연은 계속됐어요.'],
  ['adv', 'It rained. However, the concert continued.', '비가 왔어요. 그러나 공연은 계속됐어요.'],
];
const ADVW = ['however', 'therefore', 'although', 'despite'];
let ADVSEL = { p: '', w: '' };                              // 06장: 고르는 중인 부호·연결어 (둘 다 고르면 S.adv)
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ(0)}
    <p class="note">맞든 틀리든 괜찮아요. 영상 09장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  kinds: () => `<h2>직접 해 보기</h2><h3>세 갈래를 하나씩 보기</h3>
    ${seg('갈래', KINDS3.map(([k]) => [k, `${KN[k]} · <span lang="en">${{ conj: 'although', prep: 'despite', adv: 'however' }[k]}</span>`]).concat([['', '모두']]), S.kind || '')}
    <ul class="trio">${KINDS3.filter(([k]) => !S.kind || S.kind === k).map(([k, en, ko]) => `<li class="k-${k}-line"><span class="pt k-${k}">${KN[k]}</span>${enLine(en, 'small')}<span class="ko">${esc(ko)}</span></li>`).join('')}</ul>
    <p class="note">뜻은 같아요. 다른 것은 뒤에 오는 말의 모양: 절(주어 + 동사) · 명사구 · 마침표 뒤 새 문장.</p>`,
  clause: () => `<h2>직접 해 보기</h2><h3>명사구일까, 절일까?</h3>
    <p class="note">빈칸 뒤에 올 조각이에요. 동사가 있는지 찾아보세요.</p>
    <ol class="gapq">${LK.FRAGS.slice(0, 6).map((fr, i) => `<li data-f="${i}"><span lang="en">${esc(fr.t)}</span><span class="mo"><button type="button" data-fr="np">명사구</button><button type="button" data-fr="cl">절</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>`,
  same: () => {
    const r = LK.TABLE.find(x => x.m === S.mean);
    return `<h2>직접 해 보기</h2><h3>같은 뜻, 세 갈래</h3>
      ${seg('뜻', LK.TABLE.map(x => [x.m, esc(x.name)]), S.mean || '')}
      ${r ? `<ul class="trio">${['conj', 'prep', 'adv'].map(k => r.ex[k] ? `<li><span class="pt k-${k}">${KN[k]}</span>${enLine(r.ex[k], 'small')}</li>`
        : `<li><span class="pt k-${k}">${KN[k]}</span><span class="note">이 뜻의 접속사는 따로 없어요. <i lang="en">and</i>로 이어요.</span></li>`).join('')}</ul>`
        : '<p class="note">뜻을 고르면 표에서 그 줄이 켜지고, 같은 내용을 세 갈래로 쓴 문장이 나와요.</p>'}`;
  },
  meaning: () => `<h2>직접 해 보기</h2><h3>보기가 모두 접속사일 때</h3>${miniQ(4)}${miniQ(6)}
    <p class="note">갈래로 줄일 수 없으면 앞뒤 관계를 한국어로 말해 보세요. ‘~하지 않으면’이면 <i lang="en">unless</i>, ‘~하도록’이면 <i lang="en">so that</i>.</p>`,
  pair: () => `<h2>직접 해 보기</h2><h3>짝 찾기</h3>
    ${seg('짝 접속사의 앞쪽', Object.keys(LK.PAIR).map(a => [a, `<span lang="en">${a}</span>`]), S.pair || '')}
    ${S.pair ? `<p class="verdict">짝: ${kw(LK.pairName(S.pair), 'pair')}</p>${enLine(LV.PAIR_EX[S.pair], 'small')}` : '<p class="note">앞쪽 낱말을 고르면 짝과 예문이 나와요.</p>'}
    ${miniQ(9)}`,
  adv: () => {
    const A = ADVSEL, r = S.adv ? LV.advTry(S.adv.p, S.adv.w) : null;
    return `<h2>직접 해 보기</h2><h3>부호와 연결어 바꿔 보기</h3>
      <div class="pick"><span>앞 부호</span>${seg('부호', [[',', '쉼표 ,'], ['.', '마침표 .'], [';', '세미콜론 ;']], A.p || '', 'p')}</div>
      <div class="pick"><span>연결어</span>${seg('연결어', ADVW.map(w => [w, `<span lang="en">${w}</span>`]), A.w || '', 'w')}</div>
      ${r ? `${enLine(r.text)}<p class="verdict"><b class="${r.j.s === 'ok' ? 'c-ok' : 'c-no'}">${r.j.s === 'ok' ? '맞아요.' : '틀려요.'}</b> ${esc(LK.kindName(S.adv.w))}. ${esc(r.j.why)}</p>`
        : '<p class="note">부호와 연결어를 하나씩 고르면 화면 위쪽 문장이 바뀌고, 규칙 엔진이 맞고 틀림을 알려 줘요.</p>'}
      ${S.adv ? '<button class="btn ghost" type="button" id="labClear">처음 문장으로</button>' : ''}`;
  },
  multi: () => `<h2>직접 해 보기</h2><h3>덩어리 전치사</h3>${miniQ(14)}${miniQ(13)}
    <p class="note"><i lang="en">in addition to</i> → 전치사(뒤에 명사구), <i lang="en">in addition</i> → 접속부사(마침표 뒤, 쉼표와 함께).</p>`,
  method: () => {
    const P = S.path || {}, fr = P.frame;
    const sel = (id, name, obj, cur) => `<div class="pick"><span>${name}</span><select id="${id}" class="sel">${['<option value="">고르기</option>'].concat(Object.entries(obj).map(([k, v]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${esc(v)}</option>`)).join('')}</select></div>`;
    const means = Object.fromEntries(['contrast', 'reason', 'result', 'cond', 'neg', 'time', 'add', 'purpose'].map(m => [m, LK.MEAN[m]]));
    let out = '';
    if (P.L && P.R) {
      if (!fr) out = '<p class="verdict"><b class="c-no">이 조합은 이어지지 않아요.</b> 절 뒤에 쉼표만 찍고 새 문장을 붙일 수는 없어요(접속사가 필요해요).</p>';
      else if (fr === 'pair') out = '<p class="verdict"><b class="k-pair">짝 접속사 자리</b> 짝을 맞추세요: <span lang="en">either … or · neither … nor · both … and · not only … but also</span></p>';
      else {
        const list = P.m ? LK.fits({ f: fr, m: P.m }) : [];
        out = `<p class="verdict"><b class="k-${LK.FRAME[fr].need}">${esc(LK.FRAME[fr].name)}</b> ${esc(LK.FRAME[fr].sign)}.</p>` +
          (P.m ? `<p class="verdict">뜻까지 맞는 말: ${list.length ? list.map(w => kw(w)).join(' · ') : '이 표에는 없어요'}</p>` : '<p class="note">뜻도 고르면 들어갈 말이 나와요.</p>');
      }
    }
    return `<h2>직접 해 보기</h2><h3>연결어 판정기</h3>
      <p class="note">빈칸 앞뒤의 모양과 뜻을 고르면, 흐름도에 길이 켜지고 들어갈 연결어가 나와요.</p>
      ${sel('labL', '빈칸 앞', LK.LEFT, P.L)}${sel('labR', '빈칸 뒤', LK.RIGHT, P.R)}${sel('labM', '뜻', means, P.m)}
      ${out}${S.path ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 37.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 문제 ${LK.DRILL.length}개를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 연결어 조립대: 두 생각을 세 가지 틀로 이어 보기, 연결어 사전</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 5 형식 ${LK.DRILL.length}문제, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 연결어 표와 용어</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
// 직접 해 보기의 조작은 한곳에서 처리 (다시 만들어도 이어서 동작)
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = CHAPTERS[LV.chapterAt(T)].id;
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[LV.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { if (id === 'adv') { S.adv = null; ADVSEL = { p: '', w: '' }; } else S.path = null; touch(); buildLab(LV.chapterAt(T)); return; }
  if (b.dataset.k != null) {                                // 빈칸 문제
    const box = b.closest('.mini'), it = LK.DRILL[+box.dataset.q], k = +b.dataset.k, j = LK.judgeOpt(it, k);
    box.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(j.s === 'ok' ? 'right' : 'wrong');
    box.querySelector('.mr').textContent = `${LK.kindName(it.opts[k])}. ` + (j.s === 'ok' ? '맞아요! ' : '아니에요. ') + j.why;
    if (playing) pause();
    return;
  }
  if (b.dataset.fr) {                                       // 명사구냐 절이냐
    const li = b.closest('li'), fr = LK.FRAGS[+li.dataset.f], ok = fr.f === b.dataset.fr;
    li.querySelectorAll('button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(ok ? 'right' : 'wrong');
    li.querySelector('.mr').textContent = (ok ? '맞아요. ' : '다시 보세요. ') + LK.fragWhy(fr);
    if (playing) pause();
    return;
  }
  if (b.dataset.p != null || b.dataset.w != null) {         // 06장: 부호 · 연결어
    if (b.dataset.p != null) ADVSEL.p = b.dataset.p; else ADVSEL.w = b.dataset.w;
    if (ADVSEL.p && ADVSEL.w) { S.adv = Object.assign({}, ADVSEL); showAt(2); }
    touch(); buildLab(LV.chapterAt(T));
    return;
  }
  const grp = b.closest('.seg'); if (!grp || b.dataset.v == null) return;
  const v = b.dataset.v || null;
  if (id === 'kinds') { S.kind = v; showAt(29); }
  else if (id === 'same') { S.mean = v; showAt(4); }
  else if (id === 'pair') { S.pair = v; showAt(3); }
  touch(); buildLab(LV.chapterAt(T));
});
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김 (장면 처음에는 아직 그림이 나오기 전이라서)
function showAt(u) { const ch = CHAPTERS[LV.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (!['labL', 'labR', 'labM'].includes(t.id)) return;
  const L = $('labL').value, R = $('labR').value, m = $('labM').value;
  S.path = L || R || m ? { L, R, m, frame: L && R ? LK.frameFromCues(L, R) : null } : null;
  showAt(23);
  touch(); buildLab(LV.chapterAt(T));
});

/* =========================================================
   5. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // -ing(잉)처럼 화면에 적고 소리는 괄호 속 한국어로, ↔는 쉼
  read: [[/-[a-z]+\(([^)]+)\)/g, '$1'], [/↔/g, ', '], [/TOEIC/g, '토익'], [/Part 5/g, '파트 5']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   6. 놀이터 — 연결어 조립대 · 연결어 사전
   ========================================================= */
const FR = ['cl', 'np', 'adv'];
const A = { scn: 0, frame: 'cl', w: null, found: {} };
const ICONS = {
  ok: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  no: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  skip: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 10h9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
};
const keyOf = () => `${A.scn}|${A.frame}`;
function asmSentence(scn, frame, w) {
  const d = w && LK.word(w), k = d ? d.kinds[0] : '', r = w ? LK.build(scn, frame, w) : null, bad = r && r.j.s === 'no' && r.j.step === 2;
  const piece = w ? `<span class="pc k-${k}${bad ? ' bad' : ''}">${esc(cap(w))}</span>` : '<span class="pc empty" aria-label="빈칸">연결어</span>';
  const box = (t, c) => `<span class="bx b-${c}">${esc(t)}</span>`;
  if (frame === 'adv') return `${box(scn.A.adv.replace(/\.$/, ''), 'cl')}<span class="stop">.</span> ${piece}, ${box(scn.B, 'cl')}.`;
  return `${piece} ${box(scn.A[frame], frame === 'np' ? 'np' : 'cl')}, ${box(scn.B, 'cl')}.`;
}
function asmRender() {
  const scn = LK.SCN[A.scn], slot = { f: A.frame, m: scn.m[A.frame] }, need = LK.FRAME[A.frame].need;
  $('aScn').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === A.scn)));
  $('aFrame').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === A.frame)));
  $('aPal').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.w === A.w)));
  $('aRel').innerHTML = `두 생각의 관계: ${esc(scn.rel)} · 이 틀에 필요한 뜻 → <b>${esc(LK.MEAN[slot.m])}</b>`;
  $('aSent').innerHTML = asmSentence(scn, A.frame, A.w);
  const r = A.w ? LK.build(scn, A.frame, A.w) : null;
  $('aSteps').innerHTML = (r ? r.steps : [{ ok: true, text: `빈칸 뒤 → ${A.frame === 'np' ? '명사구' : A.frame === 'cl' ? '절' : '마침표 뒤, 쉼표 + 문장'} → ${LK.FRAME[A.frame].name}` }, { pending: true, text: '아래에서 연결어를 골라 끼워 보세요.' }, { pending: true, text: '' }])
    .map((s, i) => `<li class="${s.pending ? 'wait' : s.skip ? 'skip' : s.ok ? 'ok' : 'no'}"><span class="ic">${s.pending ? '' : s.skip ? ICONS.skip : s.ok ? ICONS.ok : ICONS.no}</span><b>${['① 뒤', '② 갈래', '③ 뜻'][i]}</b> <span>${esc(s.text)}</span></li>`).join('');
  $('aOut').className = 'asm-out' + (r ? (r.j.s === 'ok' ? ' ok' : ' no') : '');
  $('aHint').innerHTML = !r ? '' : sayBtn(r.text, '조립한 문장 듣기') + (r.j.s === 'no'
    ? `<span>힌트: 이 자리에는 <b class="k-${need}">${esc(KN[need])}</b>, 뜻은 <b>${esc(LK.MEAN[slot.m])}</b>. 아래 연결어 사전에서 찾아보세요.</span>` : `<span>${esc(scn.ko)}</span>`);
  // 찾은 정답
  const all = LK.fits(slot, LK.PALETTE), got = A.found[keyOf()] || new Set();
  $('aFound').innerHTML = `이 틀에 맞는 연결어 <b>${got.size} / ${all.length}</b> 찾음${got.size ? ': ' + [...got].map(w => kw(w)).join(' · ') : ''}${got.size === all.length ? ' — 다 찾았어요!' : ''}`;
  $('aGrid').innerHTML = `<thead><tr><th scope="col">두 생각</th>${FR.map(f => `<th scope="col">${esc(LK.FRAMES3[f])}</th>`).join('')}</tr></thead><tbody>` + LK.SCN.map((s, si) => `<tr><th scope="row">${esc(s.name)}</th>${FR.map(f => {
    const n = LK.fits({ f, m: s.m[f] }, LK.PALETTE).length, g = (A.found[`${si}|${f}`] || new Set()).size;
    return `<td class="${g === n ? 'full' : g ? 'some' : ''}${si === A.scn && f === A.frame ? ' cur' : ''}">${g} / ${n}</td>`;
  }).join('')}</tr>`).join('') + '</tbody>';
}
function asmPick(w) {
  A.w = w;
  const scn = LK.SCN[A.scn], r = LK.build(scn, A.frame, w);
  if (r.j.s === 'ok') { (A.found[keyOf()] = A.found[keyOf()] || new Set()).add(w); }
  asmRender();
}
function asmInit() {
  $('aScn').innerHTML = LK.SCN.map((s, i) => `<button type="button" data-s="${i}">${esc(s.name)}</button>`).join('');
  $('aFrame').innerHTML = FR.map((f, i) => `<button type="button" data-f="${f}"><kbd>${i + 1}</kbd>${esc(LK.FRAMES3[f])}</button>`).join('');
  $('aPal').innerHTML = LK.PALETTE.map(w => `<button type="button" class="k-${LK.word(w).kinds[0]}" data-w="${esc(w)}" lang="en">${esc(w)}</button>`).join('');
  $('asm').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-say')) return;
    if (b.dataset.s != null) { A.scn = +b.dataset.s; A.w ? asmPick(A.w) : asmRender(); }
    else if (b.dataset.f) { A.frame = b.dataset.f; A.w ? asmPick(A.w) : asmRender(); }
    else if (b.dataset.w) asmPick(b.dataset.w);
  });
  $('asm').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const n = '123'.indexOf(e.key);
    if (n >= 0) { e.preventDefault(); A.frame = FR[n]; A.w ? asmPick(A.w) : asmRender(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const i = A.w ? LK.PALETTE.indexOf(A.w) : -1, d = e.key === 'ArrowRight' ? 1 : -1;
      asmPick(LK.PALETTE[(i + d + LK.PALETTE.length) % LK.PALETTE.length]);
      const btn = $('aPal').querySelector(`[data-w="${A.w}"]`); if (btn) btn.focus({ preventScroll: true });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      A.scn = (A.scn + (e.key === 'ArrowDown' ? 1 : -1) + LK.SCN.length) % LK.SCN.length;
      A.w ? asmPick(A.w) : asmRender();
    }
  });
  asmRender();
}
function dictInit() {
  // 연결어 사전: 갈래별로, 뜻과 함께 (짝 접속사는 짝으로)
  const groups = [['conj', '접속사 + 절'], ['prep', '전치사 + 명사구'], ['adv', '접속부사 (마침표 뒤, 쉼표와 함께)']];
  const html = groups.map(([k, title]) => {
    const ws = Object.values(LK.LEX).filter(d => d.kinds[0] === k);
    return `<section><h4 class="k-${k}">${esc(title)}</h4><ul>${ws.map(d => `<li>${sayBtn(d.w)}<b lang="en">${esc(d.w)}</b><span>${esc(d.ko)}</span>${d.kinds.length > 1 ? `<em title="전치사로도 써요">전치사도</em>` : ''}</li>`).join('')}</ul></section>`;
  }).join('') + `<section><h4 class="k-pair">짝 접속사</h4><ul>${Object.entries(LK.PAIR).map(([a, b]) => `<li>${sayBtn(LV.PAIR_EX[a])}<b lang="en">${esc(a)} … ${esc(b)}</b></li>`).join('')}</ul></section>`;
  $('dict').innerHTML = html;
}

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', conj: '#7FE0A8', prep: '#6EC8FF', adv: '#D4E157', v: '#C9A7FF', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E', gap: '#FF7AA8' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// 그림 문제 1: 빈칸 뒤에 올 조각 네 개 → 절은?
const FRAG4 = ['the heavy rain', 'the long delay', 'the store was crowded', 'his long experience'].map(t => LK.frag(t));
const FIG_FRAG = (() => {
  const box = k => ({ x: 20 + (k % 2) * 290, y: 46 + Math.floor(k / 2) * 66, w: 270, h: 52 });
  return {
    width: 600, height: 190, label: '빈칸 뒤에 올 조각 네 개: A the heavy rain, B the long delay, C the store was crowded, D his long experience',
    pick: (x, y) => FRAG4.findIndex((f, k) => { const b = box(k); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 190);
      g.textBaseline = 'middle'; g.font = qfont(15, 700); g.fillStyle = QCOL.muted; g.textAlign = 'left';
      g.fillText('Although ___ , the staff stayed calm.', 20, 22);
      FRAG4.forEach((f, k) => {
        const b = box(k), on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        const c = st.done ? (f.f === 'cl' ? QCOL.conj : QCOL.prep) : QCOL.muted;
        rrq(g, b.x, b.y, b.w, b.h, 10); g.fillStyle = on ? 'rgba(255,193,94,0.18)' : wrong ? 'rgba(255,142,142,0.18)' : st.hover === k ? QCOL.hover : '#18202A'; g.fill();
        g.strokeStyle = c; g.lineWidth = on ? 2.5 : 1.5; g.stroke();
        g.font = qfont(14, 700); g.fillStyle = QCOL.key; g.textAlign = 'left'; g.fillText('ABCD'[k], b.x + 12, b.y + b.h / 2);
        g.font = qfont(18, 600); g.fillStyle = QCOL.text; g.fillText(f.t, b.x + 34, b.y + b.h / 2);
        if (st.done) { g.font = qfont(12, 700); g.fillStyle = c; g.textAlign = 'right'; g.fillText(f.f === 'cl' ? '절' : '명사구', b.x + b.w - 10, b.y + 12); }
      });
    },
  };
})();
// 그림 문제 2: 짝 맞추기 (Neither … ___)
const KEYS4 = ['or', 'nor', 'and', 'but also'];
const FIG_PAIR = (() => {
  const keyBox = k => ({ x: 30 + k * 140, y: 104, w: 120, h: 44 });
  return {
    width: 600, height: 170, label: '문장 Neither the manager ___ her assistant was available. 아래에 or, nor, and, but also 네 조각',
    pick: (x, y) => KEYS4.findIndex((w, k) => { const b = keyBox(k); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 170);
      g.textBaseline = 'middle';
      const parts = [['Neither', QCOL.key], ['the manager', QCOL.text], ['___', QCOL.gap], ['her assistant was available.', QCOL.text]];
      g.font = qfont(19, 600);
      const sp = 8, total = parts.reduce((s, [t]) => s + g.measureText(t === '___' && st.done ? KEYS4[st.answer] : t).width + sp, -sp);
      let x = (600 - total) / 2;
      parts.forEach(([t, c]) => {
        const s = t === '___' && st.done ? KEYS4[st.answer] : t, w = g.measureText(s).width;
        if (t === '___') { rrq(g, x - 4, 30, w + 8, 34, 6); g.strokeStyle = QCOL.gap; g.setLineDash([5, 4]); g.lineWidth = 1.5; g.stroke(); g.setLineDash([]); }
        g.fillStyle = t === '___' && st.done ? QCOL.ok : t === '___' ? 'rgba(0,0,0,0)' : c; g.textAlign = 'left'; g.fillText(s, x, 47);
        x += w + sp;
      });
      KEYS4.forEach((w, k) => {
        const b = keyBox(k), on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, b.x, b.y, b.w, b.h, 10); g.fillStyle = on ? 'rgba(255,193,94,0.2)' : wrong ? 'rgba(255,142,142,0.2)' : st.hover === k ? QCOL.hover : 'rgba(127,224,168,0.12)'; g.fill();
        g.strokeStyle = on ? QCOL.key : QCOL.conj; g.lineWidth = on ? 2.5 : 1.5; g.stroke();
        g.font = qfont(12, 700); g.fillStyle = QCOL.key; g.textAlign = 'left'; g.fillText('ABCD'[k], b.x + 8, b.y + 12);
        g.font = qfont(18, 700); g.fillStyle = QCOL.conj; g.textAlign = 'center'; g.fillText(w, b.x + b.w / 2, b.y + b.h / 2 + 2);
      });
    },
  };
})();
const QS = (() => {
  const by = (opts, slot) => opts.map(w => LK.isOk(w, slot)).join();
  const q = [
    { q: '‘___ the heavy rain, the concert continued.’ 뜻이 같은 Although와 Despite 가운데 Despite만 답이 되는 까닭은?', opts: ['빈칸 뒤가 동사 없는 명사구라서', 'Despite가 더 격식 있는 말이라서', '빈칸이 문장 맨 앞이라서', 'concert가 단수라서'], a: 0,
      why: '뜻은 같아도 갈래가 달라요. Despite는 전치사라서 명사구(the heavy rain) 앞에, Although는 접속사라서 주어 + 동사(절) 앞에 와요.',
      check: () => by(['despite', 'although'], { f: 'np', m: 'contrast' }) === 'true,false' },
    { q: '마침표로 끝난 문장 다음, 새 문장 맨 앞에서 앞 문장을 가리키는 연결어(접속부사)는?', opts: ['although', 'despite', 'because of', 'however'], a: 3,
      why: 'however는 접속부사예요. It rained. However, the concert continued. 처럼 마침표 뒤에 쉼표와 함께 써요.',
      check: () => ['although', 'despite', 'because of', 'however'].map(w => LK.word(w).kinds[0] === 'adv').join() === 'false,false,false,true' },
    { q: '접속사 Although 뒤에 올 수 있는 조각(주어 + 동사가 있는 절)은? 조각을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 2, figure: FIG_FRAG,
      why: 'the store was crowded에는 주어 the store와 동사 was가 있어요. 나머지 셋은 동사가 없는 명사구라서 despite 같은 전치사와 써요.',
      check: () => FRAG4.map(f => f.f === 'cl').join() === 'false,false,true,false' },
    { q: 'because : because of = although : ___', opts: ['however', 'despite', 'whereas', 'unless'], a: 1,
      why: 'because(접속사)와 because of(전치사)는 뜻이 같고 갈래만 달라요. although(접속사)와 뜻이 같은 전치사는 despite예요.',
      check: () => LK.swap('although', 'prep').includes('despite') && by(['however', 'despite', 'whereas', 'unless'], { f: 'np', m: 'contrast' }) === 'false,true,false,false' },
    { q: 'unless와 뜻이 같은 것은?', opts: ['if … not (~하지 않으면)', 'because (~ 때문에)', 'so that (~하도록)', 'even though (~이긴 하지만)'], a: 0,
      why: 'Unless you register by Friday = If you do not register by Friday. 금요일까지 등록하지 않으면.' },
    { q: 'Please arrive ten minutes early ___ we can start on time. 빈칸에 알맞은 말은?', opts: ['whereas', 'unless', 'so that', 'despite'], a: 2,
      why: '빈칸 뒤가 절(we can start)이라 접속사 자리예요. 제시간에 시작할 수 있도록 → 목적 → so that. despite는 전치사라서 절 앞에 못 와요.',
      check: () => by(['whereas', 'unless', 'so that', 'despite'], { f: 'cl', m: 'purpose' }) === 'false,false,true,false' },
    { q: '‘Neither the manager ___ her assistant was available.’ 빈칸에 맞는 짝은? 조각을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1, figure: FIG_PAIR,
      why: 'neither는 nor와 짝이에요. either … or, both … and, not only … but also와 헷갈리지 마세요.',
      check: () => by(KEYS4, { f: 'pair', need: 'nor', with: 'neither' }) === 'false,true,false,false' },
    { q: '‘Sales rose, however profits fell.’ 이 문장을 바르게 고친 것은?', opts: ['Sales rose, however, profits fell.', 'Sales rose however, profits fell.', 'Despite sales rose, profits fell.', 'Sales rose. However, profits fell.'], a: 3,
      why: '접속부사 however는 두 절을 잇지 못해요. 마침표(또는 세미콜론)로 끊고 However 뒤에 쉼표를 찍어요. despite는 전치사라서 절(sales rose) 앞에 못 와요.',
      check: () => LK.isOk('however', { f: 'adv', m: 'contrast' }) && !LK.isOk('however', { f: 'cl', m: 'contrast' }) && !LK.isOk('despite', { f: 'cl', m: 'contrast' }) },
    { q: '___ its low price, the printer is easy to use. 빈칸에 알맞은 말은?', opts: ['In addition', 'Moreover', 'In addition to', 'Furthermore'], a: 2,
      why: '빈칸 뒤가 명사구(its low price)라서 전치사 자리예요. in addition to는 전치사, in addition · moreover · furthermore는 접속부사예요.',
      check: () => by(['in addition', 'moreover', 'in addition to', 'furthermore'], { f: 'np', m: 'add' }) === 'false,false,true,false' },
    { q: '연결어 문제를 푸는 3단계 풀이법의 순서로 알맞은 것은?', opts: ['뜻 → 갈래 → 뒤', '뒤 → 갈래 → 뜻', '갈래 → 뒤 → 뜻', '뒤 → 뜻 → 갈래'], a: 1,
      why: '① 빈칸 뒤가 명사구인지 절인지 보고 → ② 갈래로 보기를 줄인 다음 → ③ 남은 보기 가운데 뜻이 맞는 말을 골라요.' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[연결어] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[연결어] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
  const ci = LV.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * LV.W, (e.clientY - r.top) / r.height * LV.H]; };
const hitAt = (x, y) => started ? LV.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
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
asmInit();
dictInit();
EN.drill({
  root: $('drill'), items: LK.drillItems(),
  done: (ok, total) => ok === total ? '모두 맞혔어요! 3단계 풀이법이 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 08·09장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '연결어의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(LV.baseText()).then(() => { dirty = true; });
setTimeout(() => LV.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
