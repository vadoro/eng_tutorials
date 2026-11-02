/* 듣기 ② Part 3·4 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(근거 줄 찾기 · 의도 파악 실험), 세트형 듣기 연습 문제, 퀴즈, 영상 추출
 * 규칙과 대화는 grammar.js(LT), 대화 듣기는 voices.js(LTV), 그림은 scenes.js(LTS)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const LT = window.LT, LTS = window.LTS, LTV = window.LTV, S = LTS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = LTS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L4 = 'ABCD';
const cv = $('cv'), ctx = cv.getContext('2d');
LT.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = LTS.fonts;
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
  const ready = new Promise(res => LTS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '먼저 읽고, 바꿔 말한 답을 잡아라 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { LTS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
  };
  return;
}
if (!LTV.supported) document.documentElement.classList.add('no-ltv');

/* =========================================================
   3. 플레이어
   ========================================================= */
let T = 0, playing = false, started = false, speed = 1, dirty = true, lastTs = 0, ccOn = true;
const playBtn = $('playBtn'), bigPlay = $('bigPlay'), seekEl = $('seek'), timeLbl = $('timeLbl'), capBox = $('cap'), capText = $('capText');
const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  slow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 3h5"/></svg>',
  script: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>',
  line: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>',
};
function capHTML(s) {
  return String(s).split('**').map((part, k) => {
    const inner = EN.splitLang(part).map(p => p.lang === 'en' ? `<span class="en" lang="en">${esc(p.text)}</span>` : esc(p.text)).join('');
    return k % 2 ? `<b>${inner}</b>` : inner;
  }).join('');
}
let lastBtn = '', lastCap = null, lastChap = -1;
function syncUI() {
  const btn = playing ? 'pause' : T >= END - 0.01 ? 'replay' : 'play';
  if (btn !== lastBtn) { lastBtn = btn; playBtn.innerHTML = ICON[btn]; playBtn.setAttribute('aria-label', btn === 'pause' ? '일시정지 (스페이스)' : btn === 'replay' ? '처음부터 다시 (스페이스)' : '재생 (스페이스)'); }
  seekEl.value = T;
  timeLbl.textContent = `${fmtT(T)} / ${fmtT(END)}`;
  const cap = started ? LTS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 그 화자의 목소리로 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = LTS.chapterAt(T);
  if (ci !== lastChap) { lastChap = ci; document.querySelectorAll('.chap').forEach((b, i) => b.setAttribute('aria-current', String(i === ci))); buildLab(ci); }
}
function play() {
  if (T >= END - 0.01) T = 0;
  EN.say.stop(); LTV.stop();
  playing = true; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}
function pause() { playing = false; NARR.reset(); syncUI(); dirty = true; }
function seek(t) { T = clamp(t, 0, END); started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true; }
function loop(ts) {
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
  if (playing) {
    T = NARR.hold(T, T + dt * speed);
    if (T >= END) { T = END; playing = false; NARR.reset(); }
    syncUI(); NARR.sync(T, playing); dirty = true;
  }
  if (dirty) { dirty = false; LTS.render(ctx, started ? T : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
function touch() { if (playing) pause(); dirty = true; }

/* =========================================================
   4. 대화 듣기 — 화자마다 다른 목소리 (voices.js). 듣기 단추 · 대본 줄 표시는 한곳에서 처리
   ========================================================= */
// 듣기 전에: 영상 멈추기 · 음성 해설 멈추기 · 발음 듣기 멈추기 (겹치지 않게)
const beforeListen = () => { if (playing) pause(); NARR.reset(); EN.say.stop(); };
const SPEAKING = { set: null, line: -1 };
function paintSpeaking() {
  document.querySelectorAll('.ln.speaking').forEach(x => x.classList.remove('speaking'));
  if (SPEAKING.set && SPEAKING.line >= 0) document.querySelectorAll(`.ln-list[data-set="${SPEAKING.set}"] .ln[data-li="${SPEAKING.line}"]`).forEach(x => x.classList.add('speaking'));
  document.querySelectorAll('.lbtn[data-listen]').forEach(b => {
    const on = LTV.busy && PLAYKEY === keyOf(b.dataset.listen, b.dataset.slow, b.dataset.lines);
    b.setAttribute('aria-pressed', String(on));
    const lab = b.querySelector('span'); if (lab) lab.textContent = on ? '멈추기' : b.dataset.slow ? '천천히' : '듣기';
    const ic = b.querySelector('svg'); if (ic && ic.dataset.k !== (on ? 'stop' : b.dataset.slow ? 'slow' : 'play')) ic.outerHTML = icon(on ? 'stop' : b.dataset.slow ? 'slow' : 'play');
  });
}
const icon = k => ICON[k === 'play' ? 'play' : k].replace('<svg ', `<svg data-k="${k}" `);
// 지금 읽는 묶음의 열쇠 (세트 · 천천히 · 줄) → 같은 단추를 다시 누르면 멈춤
let PLAYKEY = null;
const keyOf = (id, slow, lines) => `${id}|${slow ? 1 : 0}|${lines || ''}`;
function listen(id, o = {}) {
  const St = LT.set(id);
  if (!LTV.supported || !St) return false;
  const ok = LTV.play(St, {
    lines: o.lines, slow: o.slow, before: beforeListen,
    onLine: i => { SPEAKING.set = i >= 0 ? id : null; SPEAKING.line = i; paintSpeaking(); if (o.onLine) o.onLine(i); },
    onEnd: done => { SPEAKING.set = null; SPEAKING.line = -1; PLAYKEY = null; paintSpeaking(); if (o.onEnd) o.onEnd(done); },
  });
  PLAYKEY = LTV.busy ? (o.key || keyOf(id, o.slow, o.lines && !o.key ? 'one' : '')) : null;
  paintSpeaking();
  document.querySelectorAll(`.lsn[data-set="${id}"] .vnote`).forEach(n => { n.textContent = '목소리: ' + LTV.describe(St); n.hidden = false; });
  return ok;
}
function toggleListen(id, slow, lines) {
  const key = keyOf(id, slow, lines);
  if (LTV.busy && PLAYKEY === key) { LTV.stop(); return; }
  listen(id, { slow, key, lines: lines ? lines.split(',').map(Number) : undefined });
}
// 듣기 단추 묶음. extra: 덧붙일 단추 HTML
const lbar = (id, extra = '', lines) => { const dl = lines ? ` data-lines="${lines.join(',')}"` : ''; return `<div class="lsn" data-set="${esc(id)}">${LTV.supported ? `<button type="button" class="lbtn say" data-listen="${esc(id)}"${dl} aria-pressed="false">${icon('play')}<span>듣기</span></button><button type="button" class="lbtn say" data-listen="${esc(id)}" data-slow="1"${dl} aria-pressed="false">${icon('slow')}<span>천천히</span></button>` : '<span class="note">이 브라우저는 영어 음성을 지원하지 않아요. 대본을 보며 풀어 보세요.</span>'}${extra}<p class="vnote" hidden></p></div>`; };
// 표시 넣기: marks [{ t, role }] → <mark>
function markHTML(text, marks) {
  const ranges = [];
  (marks || []).forEach(m => {
    if (!m || !m.t) return;
    let i = text.indexOf(m.t); if (i < 0) i = text.toLowerCase().indexOf(m.t.toLowerCase()); if (i < 0) return;
    if (!ranges.some(r => i < r.e && i + m.t.length > r.s)) ranges.push({ s: i, e: i + m.t.length, role: m.role });
  });
  ranges.sort((a, b) => a.s - b.s);
  let out = '', at = 0;
  ranges.forEach(r => { out += esc(text.slice(at, r.s)) + `<mark class="mk-${r.role}">${esc(text.slice(r.s, r.e))}</mark>`; at = r.e; });
  return out + esc(text.slice(at));
}
// 대본 목록. o: { show(i) → 글 보이기, ko(i), marks(i), cls(i), names, tag: 'li' | 'button', lines: [줄] }
const spkIdx = (St, k) => Object.keys(St.spk).indexOf(k);
function scriptHTML(St, o = {}) {
  const names = o.names ? LT.names(St) : {};
  const idx = o.lines || St.lines.map((_, i) => i);
  return idx.map(i => {
    const l = St.lines[i], show = o.show ? o.show(i) : true, who = LT.spkLabel(St, l.s) + (names[l.s] ? ` · ${names[l.s]}` : '');
    const wv = '<span class="wv" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
    const body = show
      ? `<span class="tx"><span lang="en">${LTV.supported && o.lineBtn !== false ? `<button type="button" class="lline" data-sayline="${esc(St.id)}:${i}" aria-label="이 줄 듣기" title="이 줄 듣기">${ICON.line}</button>` : ''}${markHTML(l.t, o.marks ? o.marks(i) : [])}</span>${o.ko && o.ko(i) ? `<span class="ko">${esc(l.ko)}</span>` : ''}</span>`
      : `<span class="tx" aria-label="가려진 대사">${(l.t.match(/.{1,46}(\s|$)/g) || [l.t]).map(p => `<span class="hid" style="width:${Math.min(96, Math.round(p.length * 1.9))}%"></span>`).join('')}</span>`;
    const cls = 'ln' + (o.cls ? ' ' + (o.cls(i) || '') : '');
    const inner = `<span class="who" title="${esc(who)}">${esc(who)}</span>${wv}${body}`;
    return o.tag === 'button'
      ? `<li><button type="button" class="${cls}" data-li="${i}" data-k="${spkIdx(St, l.s)}" aria-label="줄 ${i + 1}: ${esc(who)}${show ? ' — ' + esc(l.t) : ''}">${inner}</button></li>`
      : `<li class="${cls}" data-li="${i}" data-k="${spkIdx(St, l.s)}">${inner}</li>`;
  }).join('');
}
const listHTML = (St, o) => `<ol class="ln-list" data-set="${esc(St.id)}" aria-label="대본">${scriptHTML(St, o)}</ol>`;
// 화면 어디서든: 듣기 단추 · 한 줄 듣기
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-listen], [data-sayline]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (b.dataset.listen) toggleListen(b.dataset.listen, !!b.dataset.slow, b.dataset.lines);
  else { const [id, i] = b.dataset.sayline.split(':'); listen(id, { lines: [+i] }); }
}, true);

/* =========================================================
   5. 장면별 '직접 해 보기' — 장이 바뀔 때만 다시 만듦
   ========================================================= */
const seg = (name, items, cur, attr = 'v') => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${esc(t)}</button>`).join('')}</div>`;
// 세트의 한 문제를 직접 해 보기용으로 (보기 단추 → 규칙 엔진으로 채점)
function miniQ(id, qi, lines) {
  const St = LT.set(id), q = St.qs[qi];
  return `<div class="mini" data-set="${id}" data-q="${qi}">${lbar(id, '', lines)}${listHTML(St, { lines })}
    <p class="mq" lang="en">${markHTML(q.q, q.kw.map(t => ({ t, role: 'kw' })))}</p>
    <div class="mo col">${q.opts.map((o, k) => `<button type="button" data-k="${k}"><span lang="en">(${L4[k]}) ${esc(o.t)}</span></button>`).join('')}</div><p class="mr" role="status"></p></div>`;
}
const okList = (list, attr, btns) => `<ol class="gapq">${list.map((w, i) => `<li data-${attr}="${i}"><span lang="en" class="ph">${esc(w)}</span><span class="mo">${btns.map(([v, t]) => `<button type="button" data-yn="${esc(v)}">${esc(t)}</button>`).join('')}</span><span class="mr" role="status"></span></li>`).join('')}</ol>`;
const GPH = [['', '영상대로'], ['across|Elevator', 'across from the elevator'], ['next|Elevator', 'next to the elevator'], ['across|Café', 'across from the café'], ['next|Room 1', 'next to Room 1']];
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ('hotel', 1, [3, 4])}
    <p class="note">맞든 틀리든 괜찮아요. 영상 10장 ‘실전 문제 풀이’에서 3단계로 다시 풀어요.</p>`,
  preview: () => {
    const St = LT.set('hotel');
    return `<h2>직접 해 보기</h2><h3>이 문제의 답은 대화의 어디쯤?</h3>${lbar('hotel')}
      ${okList(St.qs.map(q => q.q), 'pq', [['first', '앞부분'], ['middle', '가운데'], ['last', '끝부분']])}
      <p class="note">고른 뒤 근거 줄을 보여 줘요. 세 문제의 답은 대부분 대화 순서대로 나와요.</p>`;
  },
  para: () => `<h2>직접 해 보기</h2><h3>같은 뜻일까, 같은 낱말일까?</h3>
    ${okList(LT.PAIRS.map(p => `${p.heard} → ${p.opt}`), 'pp', [['para', '같은 뜻 (정답 쪽)'], ['repeat', '같은 낱말 · 다른 뜻 (함정)']])}`,
  first: () => `<h2>직접 해 보기</h2><h3>단서를 모아 장소 맞히기</h3>${miniQ('print', 1)}
    <p class="note">장소 · 직업 문제는 낱말 하나가 아니라 단서 여럿을 모아 정해요.</p>`,
  signal: () => `<h2>직접 해 보기</h2><h3>신호어 뒤에는 무슨 답이 올까?</h3>
    ${okList(LT.SIGNALS.map(s => s + ' …'), 'sg', [['problem', '문제점'], ['request', '요청 · 제안'], ['next', '다음에 할 일']])}
    <h3 class="mt">호텔 대화 다시 듣기</h3>${lbar('hotel', '', [3, 4, 5, 6, 7])}${listHTML(LT.set('hotel'), { lines: [3, 4, 5, 6, 7] })}`,
  intent: () => {
    const k = S.ctx;
    return `<h2>직접 해 보기</h2><h3>대화를 바꿔 보기</h3>
      ${seg('대화', [['', '영상대로 (두 대화)']].concat(LT.INTENT.map(id => [id, LT.set(id).title])), k || '', 'ctx')}
      ${k ? miniQ(k, 0) : '<p class="note">대화를 고르면 화면 가운데에 그 대화만 크게 나오고, 같은 보기 넷 가운데 정답이 바뀌어요.</p>'}`;
  },
  graphic: () => {
    const cur = S.rel ? `${S.rel.rel}|${S.rel.of}` : '';
    const res = S.rel ? LT.where(LT.G.floor, S.rel.rel, S.rel.of) : null;
    return `<h2>직접 해 보기</h2><h3>들은 말을 그림에서 찾기</h3>
      ${seg('들은 말', GPH, cur, 'rel')}
      ${S.rel ? `<p class="verdict"><b class="${res ? 'c-ok' : 'c-no'}">${res ? `→ ${esc(res)}` : '→ 방 하나로 정할 수 없어요'}</b> <span class="note">${esc(S.rel.of)} → ${esc(LT.RELN[S.rel.rel])}</span></p>` : '<p class="note">말을 고르면 그림에서 그 말이 가리키는 방에 불이 켜져요. 계산은 규칙 엔진이 지도에서 해요.</p>'}
      ${miniQ('map', 1)}`;
  },
  three: () => `<h2>직접 해 보기</h2><h3>누가 누구일까?</h3>${lbar('team', '', [3, 4, 5])}${listHTML(LT.set('team'), { lines: [3, 4, 5] })}
    <div class="pick"><span>남자 1</span><select class="sel" id="labM1"><option value="">고르기</option><option>Raj</option><option>Kenji</option></select></div>
    <div class="pick"><span>남자 2</span><select class="sel" id="labM2"><option value="">고르기</option><option>Raj</option><option>Kenji</option></select></div>
    <p class="mr" id="labWho" role="status"></p>${miniQ('team', 1, [1, 2, 3])}`,
  talk: () => `<h2>직접 해 보기</h2><h3>담화 종류를 골라 흐름 보기</h3>
    ${seg('담화 종류', [['', '영상대로']].concat(LT.TALKS.map(t => [t.k, t.name])), S.talk || '', 'talk')}
    ${miniQ('dental', 2)}`,
  method: () => {
    const k = S.trap;
    let out = '';
    if (k) {
      const [id, qi, oi] = LT.TRAPEX[k], St = LT.set(id), j = LT.judge(St, qi, oi);
      out = `<p class="verdict"><b class="c-no">${esc(LT.kindName(k))} → ${esc(LT.STEPN[j.step])}에서 탈락</b></p>
        <p class="note"><span lang="en">${esc(St.qs[qi].q)}</span> → (${L4[oi]}) <span lang="en">${esc(St.qs[qi].opts[oi].t)}</span></p><p class="note">${esc(j.why)}</p>`;
    }
    return `<h2>직접 해 보기</h2><h3>함정은 몇 단계에서 지워질까?</h3>
      <p class="note">함정 갈래를 고르면 흐름도에서 그 함정이 지워지는 칸에 불이 켜지고, 예로 든 보기를 규칙 엔진이 판정해요.</p>
      <div class="pick"><span>함정</span><select id="labTrap" class="sel"><option value="">고르기</option>${Object.keys(LT.TRAPEX).map(r => `<option value="${r}"${k === r ? ' selected' : ''}>${esc(LT.kindName(r))}</option>`).join('')}</select></div>
      ${out}${k ? '<button class="btn ghost" type="button" id="labClear">흐름도 지우기</button>' : ''}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>이 대화 듣고 문제 고르기</h3>${lbar('help')}${listHTML(LT.set('help'), {})}
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 18.6, 36.6][i]}">문제 ${i + 1}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 대화 다섯 개, 열다섯 문제를 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 근거 줄 찾기 · 의도 파악 실험</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 3·4 형식 세트 다섯 개, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 한눈에 보는 표와 용어</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); paintSpeaking(); }
function showAt(u) { const ch = CHAPTERS[LTS.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }
const markBtn = (li, b, ok, msg) => {
  li.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
  b.classList.add(ok ? 'right' : 'wrong');
  li.querySelector('.mr').textContent = msg;
  if (playing) pause();
};
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-say') || b.dataset.listen) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[LTS.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { S.trap = null; touch(); buildLab(LTS.chapterAt(T)); return; }
  if (b.dataset.k != null) {                                // 문제 하나
    const box = b.closest('.mini'), St = LT.set(box.dataset.set), qi = +box.dataset.q, k = +b.dataset.k, j = LT.judge(St, qi, k);
    markBtn(box, b, j.s === 'ok', `${LT.kindName(St.qs[qi].opts[k].rel)}. ` + (j.s === 'ok' ? '맞아요! ' : `아니에요(${LT.STEPN[j.step]}에서 탈락). `) + j.why);
    return;
  }
  if (b.dataset.yn != null) {
    const li = b.closest('li'), v = b.dataset.yn;
    let ok, msg;
    if (li.dataset.pq != null) { const St = LT.set('hotel'), q = St.qs[+li.dataset.pq], part = LT.part(St, q.ev); ok = part === v; msg = `${ok ? '맞아요.' : '다시 보세요.'} 근거 줄 ${q.ev + 1} / ${St.lines.length} → ${LT.PARTN[part]}. “${St.lines[q.ev].t}”`; }
    else if (li.dataset.pp != null) { const p = LT.PAIRS[+li.dataset.pp]; ok = p.rel === v; msg = `${ok ? '맞아요.' : '다시 보세요.'} ${p.why}`; }
    else { const s = LT.SIGNALS[+li.dataset.sg], ty = LT.signalType(s); ok = ty === v; msg = `${ok ? '맞아요.' : '다시 보세요.'} ${s} → ${LT.SIGTYPE[ty]}의 신호어예요.`; }
    markBtn(li, b, ok, msg);
    return;
  }
  if (b.dataset.ctx != null) { S.ctx = b.dataset.ctx || null; showAt(S.ctx ? 3.2 : 19); }
  else if (b.dataset.rel != null) { const [rel, of] = b.dataset.rel.split('|'); S.rel = b.dataset.rel ? { rel, of } : null; showAt(S.rel ? 7 : 26); }
  else if (b.dataset.talk != null) { S.talk = b.dataset.talk || null; showAt(S.talk ? 1 : 25); }
  else return;
  touch(); buildLab(LTS.chapterAt(T));
});
$('lab').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'labTrap') { S.trap = t.value || null; showAt(24); touch(); buildLab(LTS.chapterAt(T)); return; }
  if (t.id === 'labM1' || t.id === 'labM2') {
    const m = LT.names(LT.set('team')), a = $('labM1').value, b = $('labM2').value;
    if (!a || !b) return;
    const ok = a === m.M1 && b === m.M2;
    $('labWho').textContent = ok ? `맞아요. 줄 4의 “Raj, could you …?” 다음에 대답한 남자 1 = Raj, 남은 남자 2 = Kenji.` : '다시 보세요. 이름을 부르는 말(Raj, could you …?) 바로 다음에 누가 대답하나요?';
    $('labWho').className = 'mr ' + (ok ? 'c-ok' : 'c-no');
    if (playing) pause();
  }
});

/* =========================================================
   6. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // (A)~(D)는 한국어 이름으로, = · +는 쉼으로, 약어는 한국어로
  read: [[/\(A\)/g, '에이'], [/\(B\)/g, '비'], [/\(C\)/g, '씨'], [/\(D\)/g, '디'],
    [/ = /g, ', '], [/ \+ /g, ', '], [/TOEIC/g, '토익'], [/Part (\d)·(\d)/g, '파트 $1, $2'], [/Part (\d)/g, '파트 $1']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   7. 놀이터 ① — 근거 줄 찾기
   ========================================================= */
const EX = { si: 0, qi: 0, focus: 0, rec: {} };   // rec[세트][문제] = { found, tries, picked, last, lastWhy }
const exSet = () => LT.set(LT.PG[EX.si]);
const exRec = (id, qi) => { EX.rec[id] = EX.rec[id] || [{}, {}, {}]; return EX.rec[id][qi]; };
function exGfx(St) {
  const c = $('eGfx');
  if (!St.G) { c.hidden = true; return; }
  c.hidden = false;
  const G = LT.G[St.G], r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), w = Math.max(280, r.width || 520);
  c.width = Math.round(w * d); c.height = Math.round(w * d * 0.46);
  const g = c.getContext('2d'), s = c.width / 520; g.setTransform(s, 0, 0, s, 0, 0);
  g.fillStyle = LTS.COL.bg; g.fillRect(0, 0, 520, 240);
  const q = St.qs.find(x => x.type === 'graphic'), R = exRec(St.id, q.i), hl = {};
  if (R.found || R.picked === q.a) { if (G.kind === 'map') { hl[q.look.of] = 'kw'; hl[LT.lookup(G, q.look)] = 'ans'; } }
  LTS.graphic(g, G, { x: 6, y: 6, w: 508, h: 228, hl, rowHl: G.kind === 'table' && (R.found || R.picked === q.a) ? { [LT.lookupRow(G, q.look)]: 'ans' } : {} });
}
function exBuild(keepFocus) {
  const had = $('ev').contains(document.activeElement) && document.activeElement !== $('ev');
  const St = exSet(), q = St.qs[EX.qi], R = exRec(St.id, EX.qi), sid = St.id;
  $('eSets').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === EX.si)));
  $('eListen').innerHTML = lbar(sid);
  // 대본: 찾은 근거 줄에 표시
  const done = St.qs.map((x, k) => exRec(sid, k).found);
  const marks = i => {
    const m = [];
    St.qs.forEach((x, k) => { if (!done[k]) return; const st = LT.steps(St, k)[2]; (st.lines[i] || []).forEach(z => m.push(z)); });
    return m;
  };
  $('eLines').dataset.set = sid;
  $('eLines').innerHTML = scriptHTML(St, { tag: 'button', marks, names: St.names && done.every(Boolean), lineBtn: false,
    cls: i => (LT.evLines(q).includes(i) && R.found ? 'found' : R.last === i && !R.found ? 'miss' : '') });
  $('eLines').querySelectorAll('button.ln').forEach((b, i) => { b.tabIndex = i === EX.focus ? 0 : -1; });
  $('eTabs').innerHTML = St.qs.map((x, k) => `<button type="button" data-q="${k}" aria-pressed="${k === EX.qi}" class="${exRec(sid, k).found ? 'done' : ''}">Q${k + 1}</button>`).join('');
  $('eQ').innerHTML = markHTML(q.q, q.kw.map(t => ({ t, role: 'kw' })));
  $('eQko').textContent = q.ko + ' · ' + LT.TYPES[q.type].name;
  const shown = R.found || R.picked != null;
  $('eOpts').innerHTML = q.opts.map((o, k) => {
    const j = LT.judge(St, EX.qi, k), cls = shown ? (k === q.a ? 'right' : k === R.picked ? 'wrong' : '') : '';
    const marks2 = R.found && k === q.a ? (o.x.pp || []).map(p => ({ t: p[1], role: 'ans' })) : [];
    return `<li><button type="button" data-k="${k}" class="${cls}"><b>(${L4[k]})</b><span lang="en">${markHTML(o.t, marks2)}</span>${shown ? `<small>${esc(LT.kindName(o.rel))}${j.step ? ` · ${esc(LT.STEPN[j.step])}에서 탈락` : ''}</small>` : ''}</button></li>`;
  }).join('');
  $('eAsk').textContent = R.found ? '근거 줄을 찾았어요. 다른 문제도 찾아보세요.' : `이 문제의 답을 증명하는 줄을 대본에서 누르세요.${q.type === 'place' ? ' (단서 줄 하나면 돼요)' : q.type === 'intent' ? ' (따옴표 문장의 앞뒤 줄)' : ''}`;
  $('eFb').innerHTML = R.lastWhy || '';
  const all = LT.PG.reduce((s, id) => s + (EX.rec[id] || []).filter(r => r.found).length, 0), first = LT.PG.reduce((s, id) => s + (EX.rec[id] || []).filter(r => r.found && r.tries === 1).length, 0);
  $('eScore').textContent = all ? `근거 줄 ${all} / ${LT.PG.length * 3} · 한 번에 ${first}` : '';
  exGfx(St);
  paintSpeaking();
  if (keepFocus || had) { const f = $('eLines').querySelector(`button.ln[data-li="${EX.focus}"]`); if (f && (had || keepFocus === 'line')) f.focus({ preventScroll: true }); else if (had) $('ev').focus({ preventScroll: true }); }
}
function exLine(li) {
  const St = exSet(), R = exRec(St.id, EX.qi);
  if (R.found) { EX.focus = li; exBuild(true); return; }
  const r = LT.lineRole(St, EX.qi, li);
  R.tries = (R.tries || 0) + 1; R.last = li;
  if (r.ok) R.found = true;
  R.lastWhy = `<b class="${r.ok ? 'ok' : 'no'}">${r.ok ? '근거 줄!' : '아니에요.'}</b> 줄 ${li + 1} (${esc(LT.who(St, St.lines[li].s, R.found && !!St.names))}) — ${esc(r.why)}`;
  EX.focus = li; exBuild(true);
}
function exPick(k) {
  const St = exSet(), R = exRec(St.id, EX.qi), q = St.qs[EX.qi];
  if (k < 0 || k > 3) return;
  R.picked = k;
  const j = LT.judge(St, EX.qi, k);
  R.lastWhy = `<b class="${j.s === 'ok' ? 'ok' : 'no'}">${j.s === 'ok' ? '맞아요.' : '아니에요.'}</b> (${L4[k]}) ${esc(LT.kindName(q.opts[k].rel))}. ${esc(j.why)}${R.found ? '' : ' 이제 근거 줄을 찾아 눌러 보세요.'}`;
  exBuild(); keepIn('ev');
}
function keepIn(id) { if (!$(id).contains(document.activeElement)) $(id).focus({ preventScroll: true }); }
function exInit() {
  $('eSets').innerHTML = LT.PG.map((id, i) => `<button type="button" data-i="${i}" aria-pressed="false">${esc(LT.set(id).title)}<small>&nbsp;· ${esc(LT.set(id).label.replace(/ · .*/, ''))}</small></button>`).join('');
  $('eSets').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; LTV.stop(); EX.si = +b.dataset.i; EX.qi = 0; EX.focus = 0; exBuild(); keepIn('ev'); });
  $('eTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; EX.qi = +b.dataset.q; exBuild(); keepIn('ev'); });
  $('eLines').addEventListener('click', e => { const b = e.target.closest('button.ln'); if (b) exLine(+b.dataset.li); });
  $('eOpts').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) exPick(+b.dataset.k); });
  $('ev').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const St = exSet(), n = St.lines.length, k = e.key.toUpperCase();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); EX.focus = (EX.focus + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; exBuild('line'); }
    else if (/^[1-3]$/.test(e.key)) { e.preventDefault(); EX.qi = +e.key - 1; exBuild(true); }
    else if ('ABCD'.includes(k) && k.length === 1) { e.preventDefault(); exPick('ABCD'.indexOf(k)); }
    else if (k === 'R') { e.preventDefault(); listen(St.id); }
    else if (k === 'S') { e.preventDefault(); listen(St.id, { slow: true }); }
    else if (e.key === 'Enter' && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); exLine(EX.focus); }
  });
  window.addEventListener('resize', () => exGfx(exSet()));
  exBuild();
}

/* =========================================================
   8. 놀이터 ② — 의도 파악 실험 (같은 문장, 세 대화)
   ========================================================= */
const IT = { ci: 0, pick: {} };
function itBuild() {
  const had = $('it').contains(document.activeElement);
  const id = LT.INTENT[IT.ci], St = LT.set(id), q = St.qs[0], p = IT.pick[id];
  $('iCtx').innerHTML = LT.INTENT.map((x, i) => `<button type="button" data-i="${i}" aria-pressed="${i === IT.ci}">${esc(LT.set(x).title)}${IT.pick[x] != null ? (LT.set(x).qs[0].a === IT.pick[x] ? ' ✓' : ' ×') : ''}</button>`).join('');
  $('iListen').innerHTML = lbar(id);
  $('iLines').dataset.set = id;
  $('iLines').innerHTML = scriptHTML(St, { ko: () => p != null, marks: i => i === q.ql ? [{ t: St.quote.replace(/\.$/, ''), role: 'ans' }] : p != null ? (q.opts[q.a].x.pp || []).filter(z => (z[2] == null ? 0 : z[2]) === i).map(z => ({ t: z[0], role: 'ctx' })) : [],
    cls: i => i === q.ql ? '' : p != null ? 'ev' : '' });
  $('iQ').textContent = q.q;
  $('iOpts').innerHTML = q.opts.map((o, k) => `<li><button type="button" data-k="${k}" class="${p == null ? '' : k === q.a ? 'right' : k === p ? 'wrong' : ''}"><b>(${L4[k]})</b><span lang="en">${esc(o.t)}</span>${p != null ? `<small>${esc(o.ko)} · ${esc(LT.kindName(o.rel))}</small>` : ''}</button></li>`).join('');
  if (p != null) { const j = LT.judge(St, 0, p); $('iFb').innerHTML = `<b class="${j.s === 'ok' ? 'ok' : 'no'}">${j.s === 'ok' ? '맞아요.' : `아니에요. 정답은 (${L4[q.a]}).`}</b> ${esc(LT.judge(St, 0, q.a).why)}`; }
  else $('iFb').innerHTML = '';
  const done = LT.INTENT.filter(x => IT.pick[x] != null);
  $('iSum').hidden = done.length < LT.INTENT.length;
  if (done.length === LT.INTENT.length) {
    $('iSum').innerHTML = '<thead><tr><th>대화</th><th>앞 줄</th><th>남자의 뜻</th></tr></thead><tbody>' + LT.INTENT.map(x => { const S2 = LT.set(x), q2 = S2.qs[0]; return `<tr><td>${esc(S2.title)}</td><td lang="en">${esc(S2.lines[0].t)}</td><td>${esc(q2.opts[q2.a].x.mean)}</td></tr>`; }).join('') + '</tbody>';
  }
  paintSpeaking();
  if (had && !$('it').contains(document.activeElement)) $('it').focus({ preventScroll: true });
}
function itInit() {
  $('iCtx').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; LTV.stop(); IT.ci = +b.dataset.i; itBuild(); keepIn('it'); });
  $('iOpts').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (!b) return; IT.pick[LT.INTENT[IT.ci]] = +b.dataset.k; itBuild(); keepIn('it'); });
  $('it').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase(), id = LT.INTENT[IT.ci];
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); LTV.stop(); IT.ci = (IT.ci + (e.key === 'ArrowRight' ? 1 : -1) + 3) % 3; itBuild(); keepIn('it'); }
    else if ('ABCD'.includes(k) && k.length === 1) { e.preventDefault(); IT.pick[id] = 'ABCD'.indexOf(k); itBuild(); keepIn('it'); }
    else if (k === 'R') { e.preventDefault(); listen(id); }
    else if (k === 'S') { e.preventDefault(); listen(id, { slow: true }); }
  });
  itBuild();
}

/* =========================================================
   9. 연습 문제 — 세트 다섯 개 × 세 문제 (EN.drill과 같은 모양 · 같은 키보드 + R 다시 듣기 · S 천천히)
   ========================================================= */
const KIND_EN = St => St.part === 4 ? ({ voicemail: 'telephone message', meeting: 'excerpt from a meeting', tour: 'talk' }[St.talk] || 'talk') : St.names ? 'conversation with three speakers' : St.G ? 'conversation and graphic' : 'conversation';
function listeningDrill(root, sets, cfg = {}) {
  const flat = []; sets.forEach((d, si) => d.qs.forEach((_, qi) => flat.push([si, qi])));
  let st = sets.map(d => d.qs.map(() => ({ pick: null, hints: 0 }))), cur = 0, retry = null;
  const script = sets.map(() => !LTV.supported);
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const S_ = i => flat[i];
  const order = () => retry || flat.map((_, i) => i);
  const setOf = i => S_(i)[0];
  function go(i) { if (i >= 0 && setOf(i) !== (cur >= 0 ? setOf(cur) : -1)) LTV.stop(); cur = i; render(); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) { const [si, qi] = S_(o[j]); if (st[si][qi].pick === null) return go(o[j]); }
    for (let j = 0; j < k; j++) { const [si, qi] = S_(o[j]); if (st[si][qi].pick === null) return go(o[j]); }
    LTV.stop(); cur = -1; render();
  }
  function answer(k) {
    const [si, qi] = S_(cur), s = st[si][qi];
    if (s.pick !== null) return;
    s.pick = k; s.hints = 3; render();
    const f = root.querySelector('.edr-next'); if (f) f.focus({ preventScroll: true });
  }
  function hint() { const [si, qi] = S_(cur), s = st[si][qi]; if (s.pick !== null || s.hints >= 3) return; s.hints++; render(); }
  function render() { const had = root.contains(document.activeElement); draw(); paintSpeaking(); if (had && !root.contains(document.activeElement)) root.focus({ preventScroll: true }); }
  function dots() {
    return '<ol class="edr-dots" aria-label="문제 목록">' + flat.map(([si, qi], i) => {
      const s = st[si][qi], a = sets[si].S.qs[qi].a, c = s.pick === null ? '' : s.pick === a ? ' ok' : ' no', sep = i && qi === 0 ? '<li class="sep" aria-hidden="true"></li>' : '';
      return `${sep}<li><button type="button" data-go="${i}" class="${c}${i === cur ? ' cur' : ''}" aria-label="세트 ${si + 1}의 문제 ${i + 1}${s.pick === null ? '' : s.pick === a ? ' 정답' : ' 오답'}"${i === cur ? ' aria-current="step"' : ''}>${i + 1}</button></li>`;
    }).join('') + '</ol>';
  }
  function draw() {
    const okN = flat.filter(([si, qi]) => st[si][qi].pick === sets[si].S.qs[qi].a).length, doneN = flat.filter(([si, qi]) => st[si][qi].pick !== null).length;
    if (cur < 0) {
      const wrong = flat.map((_, i) => i).filter(i => { const [si, qi] = S_(i); return st[si][qi].pick !== sets[si].S.qs[qi].a; });
      root.innerHTML = dots() + `<div class="edr-card edr-end ldr-end"><p class="edr-big">${okN} / ${flat.length}</p><p>${esc(cfg.done ? cfg.done(okN, flat.length) : '')}</p>
        <table><thead><tr><th>세트</th><th>대화</th><th>맞힌 문제</th></tr></thead><tbody>${sets.map((d, si) => `<tr><td>${si + 1}</td><td>${esc(d.S.label)}</td><td>${d.qs.filter((q, qi) => st[si][qi].pick === d.S.qs[qi].a).length} / 3</td></tr>`).join('')}</tbody></table>
        <div class="edr-acts">${wrong.length ? `<button type="button" class="edr-btn" data-act="retry">틀린 ${wrong.length}문제 다시 풀기</button>` : ''}<button type="button" class="edr-btn ghost" data-act="reset">처음부터 다시</button></div></div>`;
      return;
    }
    const [si, qi] = S_(cur), D = sets[si], St = D.S, sst = st[si], setDone = sst.every(s => s.pick !== null);
    const n0 = si * 3 + 1;
    // 대본에서 보여 줄 줄과 표시: 답한 문제의 근거 줄 + 지금 문제에서 연 힌트(②부터)
    const reveal = new Set(), lm = {};
    D.qs.forEach((x, k) => {
      const s = sst[k], open = s.pick !== null ? 3 : k === qi ? s.hints : 0;
      x.steps.slice(0, open).forEach(stp => { stp.reveal.forEach(i => reveal.add(i)); Object.entries(stp.lines).forEach(([i, m]) => { lm[i] = (lm[i] || []).concat(m); }); });
    });
    const evNow = new Set(LT.evLines(St.qs[qi]));
    const show = i => setDone || script[si] || reveal.has(i);
    const o = retry ? order() : null;
    let html = dots() + `<div class="edr-card">
      <p class="edr-meta"><span>${retry ? `다시 풀기 ${o.indexOf(cur) + 1} / ${o.length}` : `세트 ${si + 1} / ${sets.length} · ${esc(St.label)} · 문제 ${cur + 1} / ${flat.length}`}</span></p>
      <p class="ldr-dir" lang="en">Questions ${n0}–${n0 + 2} refer to the following ${KIND_EN(St)}.</p>
      ${lbar(St.id, `<button type="button" class="lbtn tog" data-act="script" aria-pressed="${script[si] || setDone}"${setDone ? ' disabled' : ''}>${ICON.script}<span>대본 보기</span></button>`)}
      ${St.G ? '<canvas class="gfx" data-gfx="1"></canvas>' : ''}
      ${listHTML(St, { show, ko: () => setDone, names: setDone, marks: i => lm[i] || [], cls: i => (sst[qi].hints >= 2 || sst[qi].pick !== null) && evNow.has(i) && show(i) ? 'ev' : '' })}
      <ol class="ldr-qs">`;
    D.qs.forEach((x, k) => {
      const q = x.q, s = sst[k], isCur = k === qi, answered = s.pick !== null, right = s.pick === q.a;
      const kwOn = answered || (isCur && s.hints >= 1);
      html += `<li class="ldr-q${isCur ? ' cur' : ''}${answered ? (right ? ' ok' : ' no') : ''}">
        <p class="ldr-qh"><span class="n">${n0 + k}.</span><span lang="en">${markHTML(q.q, kwOn ? q.kw.map(t => ({ t, role: 'kw' })) : [])}</span>${!isCur ? `<button type="button" class="go" data-goq="${flat.findIndex(([a, b]) => a === si && b === k)}">${answered ? '다시 보기' : '이 문제 풀기'}</button>` : ''}</p>`;
      if (answered) html += `<p class="ldr-qko">${esc(q.ko)} · ${esc(LT.TYPES[q.type].name)}</p>`;
      if (isCur || answered) {
        html += `<div class="edr-opts" role="group" aria-label="보기">${q.opts.map((op, j) => {
          const cls = answered ? (j === q.a ? ' right' : j === s.pick ? ' wrong' : ' off') : '';
          return `<button type="button" data-pick="${j}" class="${cls}"${answered || !isCur ? ' disabled' : ''}><b>(${L4[j]})</b> <span lang="en">${esc(op.t)}</span></button>`;
        }).join('')}</div>`;
      }
      if (isCur && !answered) html += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · T 대본</span></div>`;
      if (isCur && s.hints && !answered) html += `<ol class="edr-steps">${x.steps.slice(0, s.hints).map(z => `<li><b>${esc(z.head)}</b> ${esc(z.text)}</li>`).join('')}</ol>`;
      if (answered && isCur) {
        html += `<ol class="edr-steps">${x.steps.map(z => `<li><b>${esc(z.head)}</b> ${esc(z.text)}</li>`).join('')}</ol>`;
        html += `<p class="edr-verdict"><b>${right ? '정답!' : `아쉬워요. 정답은 (${L4[q.a]}) ${esc(q.opts[q.a].t)}`}</b></p>`;
        html += `<ul class="edr-notes">${x.notes.map((t, j) => `<li class="${j === q.a ? 'right' : ''}"><b>(${L4[j]}) <span lang="en">${esc(q.opts[j].t)}</span> <span class="ko">${esc(q.opts[j].ko)}</span></b> ${esc(t)}</li>`).join('')}</ul>`;
      }
      html += '</li>';
    });
    html += '</ol>';
    if (sst[qi].pick !== null) {
      const last = doneN === flat.length || (retry && o.every(i => { const [a, b] = S_(i); return st[a][b].pick !== null; }));
      const nextSet = !last && qi === 2;
      html += `<div class="edr-acts"><button type="button" class="edr-btn edr-next" data-act="next">${last ? '결과 보기' : nextSet || setDone ? '다음 세트' : '다음 문제'} →</button></div>`;
    }
    root.innerHTML = html + '</div>';
    const gc = root.querySelector('canvas[data-gfx]');
    if (gc) {
      const G = LT.G[St.G], w = Math.max(280, gc.getBoundingClientRect().width || 520), d = Math.min(2, window.devicePixelRatio || 1);
      gc.width = Math.round(w * d); gc.height = Math.round(w * d * 0.46);
      const g = gc.getContext('2d'), s2 = gc.width / 520; g.setTransform(s2, 0, 0, s2, 0, 0);
      g.fillStyle = LTS.COL.bg; g.fillRect(0, 0, 520, 240);
      const gq = St.qs.find(z => z.type === 'graphic'), gd = sst[gq.i].pick !== null;
      LTS.graphic(g, G, { x: 6, y: 6, w: 508, h: 228, rowHl: gd && G.kind === 'table' ? { [LT.lookupRow(G, gq.look)]: 'ans' } : {}, hl: gd && G.kind === 'map' ? { [LT.lookup(G, gq.look)]: 'ans' } : {} });
    }
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
    if (b.hasAttribute('data-say') || b.dataset.listen) { if (cfg.before) cfg.before(); return; }
    if (b.dataset.go) { retry = null; go(+b.dataset.go); return; }
    if (b.dataset.goq) { go(+b.dataset.goq); return; }
    if (b.dataset.pick) { answer(+b.dataset.pick); return; }
    const act = b.dataset.act;
    if (act === 'hint') hint();
    else if (act === 'next') next();
    else if (act === 'script') { script[setOf(cur)] = !script[setOf(cur)]; render(); }
    else if (act === 'retry') {
      retry = flat.map((_, i) => i).filter(i => { const [si, qi] = S_(i); return st[si][qi].pick !== sets[si].S.qs[qi].a; });
      retry.forEach(i => { const [si, qi] = S_(i); st[si][qi] = { pick: null, hints: 0 }; });
      go(retry[0]);
    } else if (act === 'reset') { retry = null; st = sets.map(d => d.qs.map(() => ({ pick: null, hints: 0 }))); go(0); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || cur < 0) return;
    const [si, qi] = S_(cur), k = e.key.toUpperCase(), i = L4.indexOf(k), n = '1234'.indexOf(k), s = st[si][qi];
    if (s.pick === null && k.length === 1 && (i >= 0 || n >= 0)) { e.preventDefault(); answer(i >= 0 ? i : n); }
    else if (k === 'H') { e.preventDefault(); hint(); }
    else if (k === 'R') { e.preventDefault(); listen(sets[si].S.id); }
    else if (k === 'S') { e.preventDefault(); listen(sets[si].S.id, { slow: true }); }
    else if (k === 'T') { e.preventDefault(); if (!sst(si).every(z => z.pick !== null)) { script[si] = !script[si]; render(); } }
    else if ((e.key === 'ArrowRight' || e.key === 'Enter') && s.pick !== null && !(e.target.closest && e.target.closest('button:not(.edr-next)'))) { e.preventDefault(); next(); }
  });
  const sst = si => st[si];
  render();
  return { go, state: () => st };
}

/* =========================================================
   10. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E', panel: '#18202A', kw: '#6EC8FF' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// 그림 문제 1: 지도에서 방 고르기 (맞은편 계산은 규칙 엔진)
const FIG_MAP = (() => {
  const G = LT.G.floor, ROOMS = ['Room 1', 'Room 2', 'Room 3', 'Room 4'];
  let boxes = {};
  return {
    width: 560, height: 258, label: '3층 지도: 위쪽 줄에 왼쪽부터 Room 1, Room 2, Room 3. 가운데 복도. 아래쪽 줄에 왼쪽부터 Room 4, Elevator, Stairs, Café.',
    pick: (x, y) => ROOMS.findIndex(n => { const b = boxes[n]; return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 560, 258);
      const hl = {}, ans = ROOMS[st.answer];
      ROOMS.forEach((n, k) => { if (st.hover === k) hl[n] = 'kw'; });
      if (st.done) { hl['Café'] = 'kw'; hl[ans] = 'ans'; if (st.pick !== st.answer && st.pick >= 0) hl[ROOMS[st.pick]] = 'trap'; }
      boxes = LTS.graphic(g, G, { x: 6, y: 6, w: 548, h: 246, hl, label: st.done ? { [ans]: '맞은편' } : {} });
    },
  };
})();
// 그림 문제 2: 세 사람 대화에서 Kenji가 한 줄 고르기 (이름 알아내기는 규칙 엔진)
const FIG_WHO = (() => {
  const St = LT.set('quizthree'), box = k => ({ x: 12, y: 12 + k * 56, w: 576, h: 48 });
  return {
    width: 600, height: 236, label: '세 사람 대화 네 줄: A 여자 "Kenji, Raj, the printer on our floor is broken again." B 남자 1 "I can call the repair company right now." C 여자 "Thanks. And Raj, could you print the handouts downstairs?" D 남자 2 "Sure. I\'ll go down after lunch."',
    pick: (x, y) => [0, 1, 2, 3].findIndex(k => { const b = box(k); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 236); g.textBaseline = 'middle';
      const names = st.done ? LT.names(St) : {};
      St.lines.forEach((l, k) => {
        const b = box(k), on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer, c = LTS.SPKC[Object.keys(St.spk).indexOf(l.s)];
        rrq(g, b.x, b.y, b.w, b.h, 10);
        g.fillStyle = on ? 'rgba(127,224,168,0.16)' : wrong ? 'rgba(255,142,142,0.16)' : st.hover === k ? QCOL.hover : QCOL.panel; g.fill();
        g.strokeStyle = on ? QCOL.ok : 'rgba(238,241,244,0.14)'; g.lineWidth = on ? 2.2 : 1.2; g.stroke();
        g.font = qfont(13, 700); g.fillStyle = QCOL.key; g.textAlign = 'left'; g.fillText(L4[k], b.x + 10, b.y + b.h / 2);
        g.beginPath(); g.arc(b.x + 44, b.y + b.h / 2, 15, 0, Math.PI * 2); g.fillStyle = c; g.fill();
        g.font = qfont(11.5, 700); g.fillStyle = QCOL.bg; g.textAlign = 'center'; g.fillText(l.s, b.x + 44, b.y + b.h / 2 + 1);
        g.font = qfont(14.5, 500); g.fillStyle = QCOL.text; g.textAlign = 'left';
        let t = l.t; while (g.measureText(t).width > b.w - 90 - (names[l.s] ? 60 : 0) && t.length > 10) t = t.slice(0, -2);
        g.fillText(t === l.t ? t : t + '…', b.x + 70, b.y + b.h / 2);
        if (names[l.s]) { g.font = qfont(12, 700); g.fillStyle = QCOL.kw; g.textAlign = 'right'; g.fillText(names[l.s], b.x + b.w - 10, b.y + b.h / 2); }
      });
    },
  };
})();
const QS = (() => {
  const H = LT.set('hotel'), PR = LT.set('print'), CL = LT.set('client'), DN = LT.set('dental'), Q3 = LT.set('quizthree');
  const okOf = (St, qi, texts) => texts.map(t => { const k = St.qs[qi].opts.findIndex(o => o.t === t); return k >= 0 && LT.judge(St, qi, k).s === 'ok'; }).join();
  const q = [
    { q: '토익 Part 3·4에서 정답 보기는 대화의 말과 어떤 관계일 때가 많을까요?', opts: ['같은 뜻을 다른 말로 바꿔 말해요.', '대화의 낱말을 그대로 옮겨요.', '대화에 없는 새 정보를 더해요.', '대화의 첫 문장을 그대로 써요.'], a: 0,
      why: '정답은 들은 말을 바꿔 말한(paraphrase) 보기예요. fully booked → No rooms are available. 오히려 들린 낱말이 그대로 들어간 보기(booked under the wrong name)가 함정일 때가 많아요.',
      check: () => H.qs[1].opts[H.qs[1].a].rel === 'para' && H.qs[1].opts.some(o => o.rel === 'repeat') },
    { q: '대화가 나오기 전에 문제지에서 할 일로 가장 알맞은 것은?', opts: ['보기 넷을 모두 우리말로 옮겨 적는다.', '마지막 문제부터 거꾸로 읽는다.', '세 문제를 읽고 키워드(누구 · 무엇)에 표시한다.', '대본이 나올 때까지 기다린다.'], a: 2,
      why: '대화는 한 번만 들려줘요. 미리 세 문제를 읽고 the man · the woman, problem · suggest · next 같은 키워드에 표시하면 무엇을 들을지 알 수 있어요. 시험지에 대본은 나오지 않아요.' },
    { q: '호텔 예약 대화의 세 문제(Why is the woman calling? · What problem does the man mention? · What will the man do next?)의 답은 대화의 어디에서 나올까요?', opts: ['세 문제 모두 첫 줄에서', '앞부분 → 가운데 → 끝부분, 대화 순서대로', '끝부분 → 가운데 → 앞부분', '정해진 순서가 없어요'], a: 1,
      why: `근거 줄은 ${H.qs.map(x => `${x.ev + 1}번째 줄(${LT.PARTN[LT.part(H, x.ev)]})`).join(' → ')}이에요. 세 문제의 답은 대부분 대화 순서대로 나와요.`,
      check: () => H.qs.map(x => LT.part(H, x.ev)).join() === 'first,middle,last' },
    { q: '대화에서 “We’re fully booked.”가 들렸어요. 이 말을 바꿔 말한 보기는?', opts: ['They booked a table for two.', 'The book is very popular.', 'Booking online is easy.', 'There are no vacancies.'], a: 3,
      why: 'fully booked = 빈방(자리)이 없다 → There are no vacancies. 나머지 셋은 book · booked가 그대로 들어갔지만 뜻이 다른 함정이에요.',
      check: () => LT.PAIRS[0].opt === 'There are no vacancies.' && LT.judgePair(LT.PAIRS[0]).s === 'ok' },
    { q: '대화에서 posters, printed, glossy paper, sample copy가 들렸어요. Where most likely are the speakers?', opts: ['At a print shop', 'At an art gallery', 'At a paper factory', 'At a post office'], a: 0,
      why: '장소 문제는 단서 낱말 여럿을 모아요. 포스터 · 인쇄 · 광택지 · 견본 → 인쇄소. 한 번 들린 gallery(포스터를 쓸 곳)나 paper만 듣고 고르면 함정이에요.',
      check: () => okOf(PR, 1, ['At a print shop', 'At an art gallery', 'At a paper factory', 'At a post office']) === 'true,false,false,false' },
    { q: '“Unfortunately, …” 바로 뒤에서 답이 나오기 쉬운 문제는?', opts: ['Where most likely are the speakers?', 'What problem does the man mention?', 'What will the woman do next?', 'Why is the man calling?'], a: 1,
      why: 'unfortunately · but · I\'m afraid 뒤에는 문제점이 나와요. 다음에 할 일은 I\'ll · Let me 뒤, 전화한 까닭은 I\'m calling about 뒤예요.',
      check: () => LT.signalType('Unfortunately') === 'problem' && LT.signalType("I'll") === 'next' },
    { q: '여자: “Ms. Lee from Fairway called. She wants to move our meeting again.” 남자: “That’s the third time this week.” 남자의 말은 무슨 뜻일까요?', opts: CL.qs[0].opts.map(o => o.t), a: 2,
      why: '앞 줄(또 회의를 옮기고 싶대요)이 뜻을 정해요 → 고객이 일정을 자꾸 바꾼다는 짜증이에요. 같은 문장도 복사기가 또 고장 난 뒤라면 불만, 다른 팀이 또 계약을 땄다면 감탄이 돼요.',
      check: () => CL.qs[0].opts.map((o, k) => LT.judge(CL, 0, k).s === 'ok').join() === 'false,false,true,false' },
    { q: '“Room 1 is too small. Let’s book the room across from the café.” 화자가 말하는 방은 어디일까요? 그림에서 방을 누르거나 단추를 고르세요.', opts: ['Room 1', 'Room 2', 'Room 3', 'Room 4'], a: 2, figure: FIG_MAP,
      why: '그림에서 Café를 찾고 → 복도 맞은편(across from) → Room 3. 그대로 들린 Room 1은 너무 좁다고 한 방이라 함정이에요. 들은 말과 그림을 합쳐야 답이 나와요.',
      check: () => LT.where(LT.G.floor, 'across', 'Café') === 'Room 3' },
    { q: '세 사람 대화예요. Kenji가 한 말은 어느 줄일까요? 줄을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 1, figure: FIG_WHO,
      why: 'C의 “Raj, could you …?” 바로 다음에 대답한 D(남자 2) = Raj. 남은 남자 한 사람(남자 1) = Kenji → B. 이름을 부르는 말 다음에 대답하는 사람이 그 이름의 주인이에요.',
      check: () => { const m = LT.names(Q3); return m.M1 === 'Kenji' && Q3.lines[1].s === 'M1' && Q3.lines.filter(l => l.s === 'M1').length === 1; } },
    { q: '음성 메시지(voicemail)에서 What is the listener asked to do?의 답은 보통 어디에 나올까요?', opts: ['인사와 이름 부분', '전화한 까닭 부분', '전화번호를 말하는 맺음말', '부탁하는 부분 (Could you …?)'], a: 3,
      why: '음성 메시지는 인사 · 이름 → 전화한 까닭 → 문제 · 부탁 → 연락 방법 순서예요. 부탁(Could you call us back?) 뒤에서 답이 나와요 → Return a phone call.',
      check: () => LT.signalType(DN.qs[2].sig) === 'request' && DN.lines[DN.qs[2].ev].seg === 3 },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[듣기 Part 3·4] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[듣기 Part 3·4] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
  if (q.filter(x => x.figure).length < 2) console.warn('[듣기 Part 3·4] 그림 문제가 둘보다 적어요.');
  return q;
})();

/* =========================================================
   11. 시작
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
$('ttsBtn').addEventListener('click', () => LTV.stop());          // 음성 해설을 켜고 끌 때 대화 듣기는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #drill, #quiz, #summary-table')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = LTS.chapterAt(T);
  if (e.key === ' ' || e.key === 'k') { e.preventDefault(); playing ? pause() : play(); }
  else if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); if (ci + 1 < CHAPTERS.length) seek(CHAPTERS[ci + 1].t); }
  else if (e.key === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); seek(CHAPTERS[T - CHAPTERS[ci].t < 1.5 && ci > 0 ? ci - 1 : ci].t); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); seek(T + 5); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(T - 5); }
  else if (e.key === 'c') $('ccBtn').click();
  else if (e.key === 'f') $('fsBtn').click();
  else if (e.key === 'v' && !$('ttsBtn').hidden) $('ttsBtn').click();
});
CHAPTERS.forEach((ch, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chap';
  b.innerHTML = `<span class="n">${ch.n}</span><span class="tt">${esc(ch.title)}<small>${esc(ch.sub)}</small></span><span class="tm">${fmtT(ch.t)}</span>`;
  b.addEventListener('click', () => { seek(ch.t + 0.01); if (!playing) play(); });
  $('chapters').appendChild(b);
  if (i) { const t = document.createElement('i'); t.style.left = `calc(${ch.t / END * 100}% - 1px)`; $('ticks').appendChild(t); }
});
seekEl.max = END;
$('durLbl').textContent = `${Math.floor(END / 60)}분 ${Math.round(END % 60)}초`;
// 화면 누르기: 대본 줄을 누르면 그 화자의 목소리로, 다른 영어 문장은 발음 듣기, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * LTS.W, (e.clientY - r.top) / r.height * LTS.H]; };
const hitAt = (x, y) => started ? LTS.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.set && LTV.supported) { if (playing) pause(); const St = LT.set(h.set), i = St.lines.findIndex(l => l.t === h.say); listen(h.set, { lines: [i] }); }
  else if (h && h.say && EN.say.supported) { if (playing) pause(); LTV.stop(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say ? (h.set ? '눌러서 이 화자의 목소리로 듣기: ' : '눌러서 발음 듣기: ') + h.say : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

EN.say.wire(document, { before() { if (playing) pause(); LTV.stop(); } });
exInit(); itInit();
listeningDrill($('drillRoot'), LT.drillSets(), {
  before: () => { if (playing) pause(); },
  done: (ok, total) => ok === total ? '모두 맞혔어요! 미리 읽기 → 신호 듣기 → 바꿔 말하기가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계와 근거 줄을 다시 따라가 보세요.' : '영상 09·10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? 'Part 3·4의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(LTS.baseText()).then(() => { dirty = true; });
setTimeout(() => LTS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
