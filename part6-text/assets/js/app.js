/* Part 6 글 단위 문제 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(문맥 손전등), 지문 연습 문제, 퀴즈, 영상 추출
 * 규칙과 지문은 grammar.js(PT), 그림은 scenes.js(PV)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const PT = window.PT, PV = window.PV, S = PV.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = PV;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const L4 = 'ABCD';
const cv = $('cv'), ctx = cv.getContext('2d');
PT.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = PV.fonts;
const FONT_SET = [[700, F.FD], [800, F.FD], [400, F.FB], [500, F.FB], [600, F.FB], [700, F.FB], [800, F.FB], [400, F.FM], [500, F.FM], [700, F.FM]];
const loadFonts = text => Promise.race([
  Promise.all(FONT_SET.map(([w, f]) => document.fonts.load(`${w} 20px ${f}`, text).catch(() => null))),
  new Promise(r => setTimeout(r, 15000)),
]).then(() => document.fonts.ready);

/* =========================================================
   2. 영상 추출 — 사이트 공통 렌더러가 쓰는 약속
   ========================================================= */
if (EXPORT) {
  cv.width = 1920; cv.height = 1080;
  const ready = new Promise(res => PV.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '한 문장으론 모른다, 앞뒤 문장이 답한다 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { PV.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const c = started ? PV.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (c !== lastCap) { lastCap = c; capText.innerHTML = capHTML(c) || '&nbsp;'; }
  const ci = PV.chapterAt(T);
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
  if (dirty) { dirty = false; PV.render(ctx, started ? T : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
function touch() { if (playing) pause(); dirty = true; }
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김
function showAt(u) { const ch = CHAPTERS[PV.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }

/* =========================================================
   4. 지문 HTML 도우미 (직접 해 보기 · 놀이터 · 연습 문제)
   ========================================================= */
// 문장 하나: marks [{ t, role }]는 처음 나오는 곳을 <mark>로, [n] 빈칸은 blank(n)이 돌려주는 HTML로
function sentHTML(raw, marks, blank) {
  const ranges = [];
  (marks || []).forEach(m => {
    if (!m.t) return;
    // 낱말 단위로 찾음 (it이 with 속에서 잡히지 않게)
    const re = new RegExp('(^|[^A-Za-z])' + m.t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])'), f = re.exec(raw);
    const i = f ? f.index + f[1].length : -1;
    if (i >= 0 && !ranges.some(r => i < r.e && i + m.t.length > r.s)) ranges.push({ s: i, e: i + m.t.length, role: m.role });
  });
  ranges.sort((a, b) => a.s - b.s);
  const plain = s => esc(s).replace(/\[(\d+)\]/g, (m, n) => blank(+n));
  let out = '', at = 0;
  ranges.forEach(r => { out += plain(raw.slice(at, r.s)) + `<mark class="mk-${r.role}">${plain(raw.slice(r.s, r.e))}</mark>`; at = r.e; });
  return out + plain(raw.slice(at));
}
// 지문 전체. o: { vis(s) → bool, cls(s) → 'cur' | 'clue' | '', marks(s) → [...], blank(n) → HTML, headCls, headMarks }
function passageHTML(P, o) {
  const vis = o.vis || (() => true);
  const head = P.head.map((h, i) => {
    const on = vis(-1), hm = (o.headMarks || []).find(m => h.includes(m));
    const inner = hm ? esc(h).replace(esc(hm), `<mark class="mk-cue">${esc(hm)}</mark>`) : esc(h);
    return `<span class="hd ${on ? '' : 's off'}${hm && on ? ' clue' : ''}"${on ? '' : ' aria-hidden="true"'}>${inner}</span>`;
  }).join('');
  const body = P.sents.map((raw, s) => {
    const on = vis(s), cls = o.cls ? o.cls(s) : '';
    return `<span class="s ${on ? cls : 'off'}" data-s="${s}"${on ? '' : ' aria-hidden="true"'}>${sentHTML(raw, on && o.marks ? o.marks(s) : [], o.blank)}</span>`;
  }).join(' ');
  return head + body;
}
const blankBox = (n, cls = '') => `<span class="bk ${cls}" aria-label="빈칸 ${n}">(${n})</span>`;

/* =========================================================
   5. 장면별 '직접 해 보기' — 장이 바뀔 때만 다시 만듦
   ========================================================= */
const seg = (name, items, cur, attr = 'v') => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${t}</button>`).join('')}</div>`;
const enLine = (text, cls = '') => `<p class="enline ${cls}">${sayBtn(text)}<span lang="en">${esc(text)}</span></p>`;
// 작은 손전등 문제: 앞 문장이 가려진 채로 시작, 켜면 엔진이 보기를 다시 판정
const LV = {};      // 'pid|n' → 켠 문장 Set
function miniLight(pid, n, o = {}) {
  const b = PT.blank(pid, n), key = `${pid}|${n}`, P = b.P;
  const vis = LV[key] || (LV[key] = new Set());
  const from = o.from == null ? b.s - 1 : o.from, to = o.to == null ? b.s : o.to;
  const sents = [];
  for (let s = from; s <= to; s++) {
    const on = s === b.s || vis.has(s);
    const fill = {}; P.blanks.forEach(x => { if (x.n !== n) fill[x.n] = PT.ansText(x); });
    const text = PT.sentText(P, s, fill).replace('___', '\u0001');
    sents.push(`<span class="s${on ? '' : ' off'}"${on ? '' : ' aria-hidden="true"'} lang="en">${esc(text).replace('\u0001', '<span class="blank">&nbsp;</span>')}</span>`);
  }
  const hidden = [];
  for (let s = from; s <= to; s++) if (s !== b.s && !vis.has(s)) hidden.push(s);
  const opts = b.opts.map((_, k) => `<button type="button" data-k="${k}">${esc(PT.optText(b, k))}</button>`).join('');
  return `<div class="mini" data-q="${key}"><p class="ctx">${sents.join(' ')}</p>
    ${hidden.length ? `<div class="seg"><button type="button" data-ml="${hidden.map(String).join(',')}">${hidden.every(s => s < b.s) ? '앞 문장 켜기' : hidden.every(s => s > b.s) ? '뒤 문장 켜기' : '앞뒤 문장 켜기'}</button></div>` : ''}
    <div class="mo${b.type === 'insert' ? ' col' : ''}" lang="en">${opts}</div><p class="mr" role="status"></p></div>`;
}
function judgeMini(key, k) {
  const [pid, n] = key.split('|'), b = PT.blank(pid, +n), vis = LV[key] || new Set();
  const cands = PT.cands(b, vis), j = PT.judge(b, k, vis);
  if (j.s === 'no') return { cls: 'wrong', text: `아니에요. ${PT.STEP[j.step - 1]}에서 지워져요. ${j.why}` };
  if (cands.length > 1) return { cls: k === b.a ? 'right' : '', text: `지금 보이는 문장만으로는 보기가 ${cands.length}개 남아요(${cands.map(c => L4[c]).join(' · ')}). 가려진 문장을 켜 보세요.` };
  return { cls: 'right', text: `맞아요! ${PT.judge(b, k).why}` };
}
const DATES = [[502, '5월 2일'], [509, '5월 9일'], [520, '5월 20일'], [530, '5월 30일']];
const KINDS = [[0, '낱말 빈칸'], [1, '연결어 빈칸'], [2, '문장 넣기']];
const KIND_NOTE = [
  '낱말 빈칸: 보기가 낱말이나 짧은 구예요. Part 5처럼 문장 안에서 풀리는 것도 있지만, 시제처럼 글을 읽어야 풀리는 것이 많아요.',
  '연결어 빈칸: 문장 맨 앞, 마침표 뒤 · 쉼표 앞 자리. 보기는 However · In addition 같은 접속부사예요.',
  '문장 넣기: 빈칸이 문장 하나 전체예요. 보기 넷이 모두 문장이라 앞뒤 문장과 이어지는지로 골라요.',
];
const TYPES5 = [['공지', 'notice'], ['이메일', 'e-mail'], ['회람', 'memo'], ['광고', 'advertisement'], ['기사', 'article']];
const PR_IDS = ['prResult', 'prContrast', 'prAdd', 'prExample'];
const TRAP_Q = [0, 1, 3].map(k => ({ pid: 'westbay', n: 2, k }));
const TRAP_CHOICES = ['order', 'same', 'also', 'clash', 'topic'];
const FAR_S = [[-1, '머리말'], [0, '첫 문장'], [5, '두 문장 앞'], [6, '앞 문장'], [8, '뒤 문장']];
let FARSEL = new Set();
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniLight('lobby', 1)}
    <p class="note">처음에는 빈칸 문장만 보여요. 보기를 골라 보고, ‘앞 문장 켜기’를 눌러 다시 골라 보세요. 판정은 규칙 엔진이 해요.</p>`,
  format: () => `<h2>직접 해 보기</h2><h3>빈칸 세 가지</h3>
    ${seg('빈칸 종류', KINDS.map(([v, t]) => [v, esc(t)]).concat([['', '모두']]), S.kind == null ? '' : S.kind)}
    <p class="verdict">${S.kind == null ? '종류를 고르면 화면 속 지문에서 그 빈칸이 켜져요.' : esc(KIND_NOTE[S.kind])}</p>
    <ul class="trio">${TYPES5.map(([ko, en]) => `<li>${enLine(en, 'small')}<span class="ko">${esc(ko)}</span></li>`).join('')}</ul>`,
  core: () => {
    const P = S.ctx === 'B' ? PT.P.lobbyB : PT.P.lobby, b = PT.blank(P.id, 1);
    return `<h2>직접 해 보기</h2><h3>앞 문장 바꿔 보기</h3>
      ${seg('앞 문장', [['A', '공사가 앞으로 시작'], ['B', '공사가 이미 끝남'], ['', '영상대로']], S.ctx || '')}
      ${S.ctx ? `${enLine(P.sents[0], 'small')}${enLine(PT.filled(b), '')}<p class="verdict"><b class="c-ok">${esc(PT.ansText(b))}</b> ${esc(PT.judge(b, b.a).why)}</p>
        <ul class="trio">${b.opts.map((o, k) => { const j = PT.judge(b, k); return j.s === 'no' ? `<li><span class="pt k-trap">${esc(PT.STEP[j.step - 1])}</span><span lang="en">${esc(o)}</span><span class="ko">${esc(j.why)}</span></li>` : ''; }).join('')}</ul>`
        : '<p class="note">빈칸 문장은 그대로 두고 앞 문장만 바꿔요. 답이 어떻게 바뀌는지 화면과 함께 보세요.</p>'}`;
  },
  tense: () => {
    let out = '';
    if (S.date) {
      const P = PT.withDate('sched', S.date), b = P.blanks[0], k = PT.cands(b)[0], w = PT.clueWhen(b, b.clues[0]);
      out = `${enLine(PT.sentText(P, 0, { 1: PT.optText(b, k) }), 'small')}<p class="verdict">글을 쓴 날 ${esc(PT.dateKo(S.date))} · 공사 5월 12일 ~ 16일 → <b>${esc(PT.WHEN[w])}</b> → <b lang="en">${esc(PT.optText(b, k))}</b></p>`;
    }
    return `<h2>직접 해 보기</h2><h3>글을 쓴 날 바꿔 보기</h3>
      <div class="pick"><span>글 쓴 날</span>${seg('글을 쓴 날', DATES.map(([d, t]) => [d, t]), S.date || '', 'date')}</div>
      ${out || '<p class="note">날짜를 고르면 시간선 가운데(글을 쓴 날)가 옮겨지고, 규칙 엔진이 공사 날짜와 견줘 시제를 정해요.</p>'}
      ${miniLight('quietdesk', 3, { from: 6, to: 8 })}`;
  },
  link: () => `<h2>직접 해 보기</h2><h3>같은 앞 문장, 다른 뒤 문장</h3>
    ${enLine('Our old printers often broke down.', 'small')}
    <ol class="gapq">${PR_IDS.map(id => { const b = PT.P[id].blanks[0]; return `<li data-pr="${id}"><span lang="en">${esc(PT.sentText(b.P, 1))}</span><span class="mo" lang="en">${b.opts.map((o, k) => `<button type="button" data-prk="${k}">${esc(o)}</button>`).join('')}</span><span class="mr" role="status"></span></li>`; }).join('')}</ol>
    <p class="note">관계 이름을 누르면 화면의 관계 카드가 켜져요.</p>
    ${seg('관계', Object.keys(PT.REL).map(r => [r, esc(PT.REL[r].name)]).concat([['', '모두']]), S.rel || '', 'rel')}`,
  pointer: () => `<h2>직접 해 보기</h2><h3>가리키는 말의 짝 찾기</h3>
    ${seg('가리키는 말', [[0, 'this · these'], [1, 'it · they'], [2, 'such'], [3, 'also'], [4, 'the + 명사'], ['', '모두']], S.ptr == null ? '' : S.ptr, 'ptr')}
    ${miniLight('lobby', 2, { from: 2, to: 4 })}
    <p class="note">앞뒤 문장이 가려져 있으면 엔진도 보기를 지우지 못해요. 켜 보고 다시 골라 보세요.</p>`,
  trap: () => {
    const b = PT.blank('lobby', 2), k = S.trap && S.trap !== 'win' ? L4.indexOf(S.trap) : S.trap === 'win' ? b.a : -1;
    const j = k >= 0 ? PT.judge(b, k) : null;
    return `<h2>직접 해 보기</h2><h3>함정 이름 붙이기</h3>
      ${seg('보기', [['C', '(C) 순서?'], ['D', '(D) 같은 낱말?'], ['B', '(B) also?'], ['win', '(A) 정답'], ['', '영상대로']], S.trap || '', 'trap')}
      ${j ? `<p class="verdict"><b class="${j.s === 'ok' ? 'c-ok' : 'c-no'}">${j.s === 'ok' ? '정답' : esc(PT.TRAP[j.trap])}</b> ${esc(j.why)}</p>` : ''}
      <p class="note">다른 이메일의 오답에도 이름을 붙여 보세요. 앞 문장: <i lang="en">The caterer has asked us for the final number of guests.</i> 뒤 문장: <i lang="en">After that date, we will not be able to change the order.</i></p>
      <ol class="gapq">${TRAP_Q.map((q, i) => { const bb = PT.blank(q.pid, q.n); return `<li data-tq="${i}"><span lang="en">${esc(bb.opts[q.k].t)}</span><span class="mo">${TRAP_CHOICES.map(t => `<button type="button" data-tt="${t}">${esc(PT.TRAP[t])}</button>`).join('')}</span><span class="mr" role="status"></span></li>`; }).join('')}</ol>`;
  },
  far: () => {
    const b = PT.blank('lobby', 4), vis = new Set(FARSEL), c = PT.cands(b, vis);
    return `<h2>직접 해 보기</h2><h3>어느 문장을 켜야 할까?</h3>
      <p class="note">빈칸 (4) 문장 <i lang="en">The lobby ___ until Wednesday, May 21.</i>만 보이는 상태에서 문장을 하나씩 켜 보세요.</p>
      ${`<div class="seg" role="group" aria-label="켤 문장">${FAR_S.map(([s, t]) => `<button type="button" data-far="${s}" aria-pressed="${FARSEL.has(s)}">${esc(t)}</button>`).join('')}</div>`}
      <p class="verdict">남은 보기 <b>${c.length}</b>: ${c.map(k => `<span lang="en">${esc(PT.optText(b, k))}</span>`).join(' · ')}${c.length === 1 ? ' — 답이 하나로 줄었어요!' : ''}</p>
      ${FARSEL.has(6) || FARSEL.has(5) ? `<p class="note">앞의 <i lang="en">was originally expected</i> → 과거형이지만 ‘원래 예상’일 뿐이라 단서가 아니에요. 엔진도 이 문장으로는 아무것도 지우지 않아요.</p>` : ''}
      ${FARSEL.size ? '<button class="btn ghost" type="button" id="labClear">다시 가리기</button>' : ''}`;
  },
  method: () => {
    const b = S.mtype ? { tense: PT.blank('pool', 1), link: PT.blank('chairs', 7), insert: PT.blank('move', 10) }[S.mtype] : null;
    return `<h2>직접 해 보기</h2><h3>빈칸 종류별 3단계</h3>
      ${seg('빈칸 종류', [['tense', '시제'], ['link', '연결어'], ['insert', '문장 넣기'], ['', '모두']], S.mtype || '', 'mt')}
      ${b ? `<p class="note">예: 연습 문제의 빈칸 (${b.n}) — 엔진이 만든 풀이예요.</p><ol class="links">${PT.steps(b).map(s => `<li><b>${esc(s.head)}</b> ${esc(s.text)}</li>`).join('')}</ol>` : '<p class="note">종류를 고르면 화면에서 그 줄이 켜지고, 연습 문제 하나를 엔진이 3단계로 푼 풀이가 나와요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 20.6, 40.6][i]}">문제 ${i + 1} · ${['시제', '문장 넣기', '연결어'][i]}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#drill">연습 문제</a>로 가세요. 지문 넷, 빈칸 열여섯을 3단계 힌트와 함께 풀 수 있어요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 문맥 손전등: 문장을 하나씩 켜며 단서 찾기</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 6 형식, 지문 넷 · 빈칸 열여섯, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 빈칸별 단서 표와 용어</li></ul>`,
};
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = CHAPTERS[PV.chapterAt(T)].id, rebuild = () => buildLab(PV.chapterAt(T));
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[PV.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.id === 'labClear') { FARSEL = new Set(); S.reveal = null; touch(); rebuild(); return; }
  if (b.dataset.ml) {                                        // 작은 손전등: 문장 켜기
    const key = b.closest('.mini').dataset.q; b.dataset.ml.split(',').forEach(s => (LV[key] = LV[key] || new Set()).add(+s));
    touch(); rebuild(); return;
  }
  if (b.dataset.k != null) {                                 // 작은 손전등: 보기 고르기
    const box = b.closest('.mini'), r = judgeMini(box.dataset.q, +b.dataset.k);
    box.querySelectorAll('.mo button').forEach(x => x.classList.remove('right', 'wrong'));
    if (r.cls) b.classList.add(r.cls);
    box.querySelector('.mr').textContent = r.text;
    if (playing) pause();
    return;
  }
  if (b.dataset.prk != null) {                               // 04장: 프린터 두 문장
    const li = b.closest('li'), bb = PT.P[li.dataset.pr].blanks[0], k = +b.dataset.prk, j = PT.judge(bb, k);
    li.querySelectorAll('button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(j.s === 'ok' ? 'right' : 'wrong');
    li.querySelector('.mr').textContent = j.s === 'ok' ? `맞아요. ${PT.REL[bb.rel].name}(${bb.relKo}) → ${PT.optText(bb, k)}.` : `아니에요. ${j.why}`;
    if (playing) pause();
    return;
  }
  if (b.dataset.tt) {                                        // 06장: 함정 이름
    const li = b.closest('li'), q = TRAP_Q[+li.dataset.tq], j = PT.judge(PT.blank(q.pid, q.n), q.k), ok = j.trap === b.dataset.tt;
    li.querySelectorAll('button').forEach(x => x.classList.remove('right', 'wrong'));
    b.classList.add(ok ? 'right' : 'wrong');
    li.querySelector('.mr').textContent = (ok ? '맞아요. ' : `다시 보세요. 엔진의 판정은 ‘${PT.TRAP[j.trap]}’이에요. `) + j.why;
    if (playing) pause();
    return;
  }
  if (b.dataset.far != null) {                               // 07장: 문장 켜기
    const s = +b.dataset.far; FARSEL.has(s) ? FARSEL.delete(s) : FARSEL.add(s);
    S.reveal = new Set(FARSEL); showAt(4.6); touch(); rebuild(); return;
  }
  const grp = b.closest('.seg'); if (!grp) return;
  if (b.dataset.v != null && id === 'format') { S.kind = b.dataset.v === '' ? null : +b.dataset.v; showAt(21); }
  else if (b.dataset.v != null && id === 'core') { S.ctx = b.dataset.v || null; showAt(16); }
  else if (b.dataset.date != null) { S.date = +b.dataset.date || null; showAt(22); }
  else if (b.dataset.rel != null) { S.rel = b.dataset.rel || null; showAt(S.rel && ['result', 'contrast', 'add', 'example'].includes(S.rel) ? 24 : 20); }
  else if (b.dataset.ptr != null) { S.ptr = b.dataset.ptr === '' ? null : +b.dataset.ptr; showAt(21); }
  else if (b.dataset.trap != null) { S.trap = b.dataset.trap || null; showAt(2); }
  else if (b.dataset.mt != null) { S.mtype = b.dataset.mt || null; showAt(20); }
  else return;
  touch(); rebuild();
});

/* =========================================================
   6. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/TOEIC/g, '토익'], [/Part (\d)/g, '파트 $1'], [/(\d+)–(\d+)/g, '$1에서 $2']],
  rate: () => speed,
  holdBefore: 0.05,
  clips: window.EN_CLIPS,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   7. 놀이터 — 문맥 손전등
   ========================================================= */
const FL = { pid: PT.LIGHT[0], n: PT.P[PT.LIGHT[0]].blanks[0].n, up: 0, down: 0, head: false, pick: null, rec: {} };
const flBlank = () => PT.blank(FL.pid, FL.n);
const flVis = () => PT.vis(flBlank(), FL.up, FL.down, FL.head);
const flCount = () => FL.up + FL.down + (FL.head ? 1 : 0);
const REC_LABEL = { clean: '단서로 · 가장 적게', ok: '단서로', luck: '운', miss: '틀림' };
// 다시 그릴 때 초점이 사라지지 않게 (단추가 새로 그려지면 브라우저가 초점을 body로 보내 키보드가 먹지 않음)
function flRender() {
  const had = $('fl').contains(document.activeElement);
  flDraw();
  if (had && !$('fl').contains(document.activeElement)) $('fl').focus({ preventScroll: true });
}
function flDraw() {
  const b = flBlank(), P = b.P, vis = flVis(), cands = PT.cands(b, vis), mr = PT.minReveal(b);
  $('fPas').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.p === FL.pid)));
  $('fBlank').innerHTML = P.blanks.map(x => `<button type="button" data-n="${x.n}" aria-pressed="${x.n === FL.n}">(${x.n}) ${esc(PT.TYPE[x.type].name)}</button>`).join('');
  // 단서 표시: 지금 보이는 문장에서 보기를 지운 단서
  const marks = {}, clueS = new Set(), headMarks = [];
  const add = (s, t, role = 'cue') => { if (s === -1) { headMarks.push(t); return; } (marks[s] = marks[s] || []).push({ t, role }); clueS.add(s); };
  b.opts.forEach((_, k) => { const j = PT.judge(b, k, vis); if (j.s === 'no' && j.step === 2 && j.clue) add(j.clue.s, j.clue.t || ''); });
  if (b.type === 'link' && vis.has(b.clue.s)) add(b.s, b.here);
  if (b.type === 'insert') { if (vis.has(b.prev.s)) add(b.prev.s, b.prev.t); if (b.next && vis.has(b.next.s)) add(b.next.s, b.next.t); }
  if (b.trap && vis.has(b.trap.s)) (marks[b.trap.s] = marks[b.trap.s] || []).push({ t: b.trap.t, role: 'trap' });
  const done = FL.pick != null;
  $('fText').innerHTML = passageHTML(P, {
    vis: s => s === b.s || vis.has(s),
    cls: s => s === b.s ? 'cur' : clueS.has(s) ? 'clue' : '',
    marks: s => (marks[s] || []).filter(m => m.t),
    headMarks,
    blank: n => n !== b.n ? blankBox(n) : done && FL.pick === b.a ? `<span class="bk fill ok">${esc(PT.ansText(b))}</span>` : blankBox(n, 'now' + (P.sents[b.s] === `[${n}]` ? ' slot' : '')),
  });
  $('fCtrl').querySelector('[data-rv="up"]').disabled = b.s - FL.up <= 0;
  $('fCtrl').querySelector('[data-rv="down"]').disabled = b.s + FL.down >= P.sents.length - 1;
  $('fCtrl').querySelector('[data-rv="head"]').disabled = !P.head.length || FL.head;
  const m = $('fMeter');
  m.className = 'fl-meter' + (cands.length === 1 ? ' one' : '');
  m.innerHTML = `<span>남은 보기</span><b>${cands.length}</b><span>켠 문장 ${flCount()}개 · 가장 적게 ${mr ? mr.n : '?'}개</span>`;
  $('fOpts').innerHTML = b.opts.map((_, k) => {
    const j = PT.judge(b, k, vis), gone = j.s === 'no', cls = gone ? 'gone' : done && k === FL.pick ? (k === b.a ? 'right' : 'wrong') : done && k === b.a ? 'right' : '';
    return `<li><button type="button" data-k="${k}" class="${cls}"${gone || done ? ' disabled' : ''}><b>(${L4[k]})</b><span class="o" lang="en">${esc(PT.optText(b, k))}</span>${gone ? `<span class="why">${esc(PT.STEP[j.step - 1])} · ${esc(j.why)}</span>` : ''}</button></li>`;
  }).join('');
  let v = '';
  if (done) {
    const full = PT.filled(b);
    if (FL.pick !== b.a) v = `<b class="c-no">아니에요.</b> 정답은 (${L4[b.a]}). 글 전체를 보면 ${esc(PT.STEP[PT.judge(b, FL.pick).step - 1])}에서 지워져요: ${esc(PT.judge(b, FL.pick).why)}`;
    else if (FL.lucky) v = `<b class="c-ok">정답</b>이지만 그때는 보기가 ${FL.lucky}개 남아 있었어요. 운이 좋았네요. 문장을 더 켜서 단서를 확인해 보세요.`;
    else v = `<b class="c-ok">정답! 단서로 풀었어요.</b> 켠 문장 ${flCount()}개${mr && flCount() <= mr.n ? ' — 가장 적게 켰어요.' : ` (가장 적게 ${mr.n}개).`} ${esc(PT.judge(b, b.a).why)}`;
    v += ` ${sayBtn(full, '완성 문장 듣기')}<span class="note">${esc(P.ko[b.s] || '')}</span>`;
  } else v = cands.length === 1 ? '보기가 하나 남았어요. 골라 보세요.' : flCount() ? '아직 단서가 부족해요. 문장을 더 켜 보세요.' : '빈칸 문장만으로는 보기를 다 지울 수 없어요. 문장을 켜 보세요.';
  $('fVerdict').innerHTML = v;
  // 기록
  const rows = PT.LIGHT.map(pid => `<tr><th scope="row">${esc(PT.P[pid].label)}</th>${PT.P[pid].blanks.map(x => { const r = FL.rec[`${pid}|${x.n}`]; return `<td class="${pid === FL.pid && x.n === FL.n ? 'cur' : ''}">(${x.n}) <span class="st ${r === 'clean' || r === 'ok' ? 'clean' : r === 'luck' ? 'luck' : r === 'miss' ? 'miss' : ''}">${r ? esc(REC_LABEL[r]) : '—'}</span></td>`; }).join('')}${'<td></td>'.repeat(4 - PT.P[pid].blanks.length)}</tr>`).join('');
  const recs = Object.values(FL.rec), clean = recs.filter(r => r === 'clean').length, okc = recs.filter(r => r === 'clean' || r === 'ok').length;
  const total = PT.LIGHT.reduce((s, pid) => s + PT.P[pid].blanks.length, 0);
  $('fScore').innerHTML = `단서로 푼 빈칸 <b>${okc} / ${total}</b> · 그 가운데 가장 적게 켜고 푼 빈칸 <b>${clean}</b><div class="sumwrap"><table aria-label="빈칸별 기록"><thead><tr><th scope="col">지문</th><th scope="col" colspan="4">빈칸</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function flSet(pid, n) { FL.pid = pid; FL.n = n; FL.up = 0; FL.down = 0; FL.head = false; FL.pick = null; FL.lucky = 0; flRender(); }
function flReveal(what) {
  const b = flBlank();
  if (what === 'up' && b.s - FL.up > 0) FL.up++;
  else if (what === 'down' && b.s + FL.down < b.P.sents.length - 1) FL.down++;
  else if (what === 'head' && b.P.head.length) FL.head = true;
  else if (what === 'all') { FL.up = b.s; FL.down = b.P.sents.length - 1 - b.s; FL.head = !!b.P.head.length; }
  else if (what === 'reset') { FL.up = 0; FL.down = 0; FL.head = false; FL.pick = null; FL.lucky = 0; }
  flRender();
}
function flPick(k) {
  const b = flBlank(), vis = flVis();
  if (FL.pick != null || PT.judge(b, k, vis).s === 'no') return;
  const cands = PT.cands(b, vis), mr = PT.minReveal(b), key = `${FL.pid}|${FL.n}`;
  FL.pick = k; FL.lucky = k === b.a && cands.length > 1 ? cands.length : 0;
  const r = k !== b.a ? 'miss' : cands.length > 1 ? 'luck' : mr && flCount() <= mr.n ? 'clean' : 'ok';
  const rank = { clean: 3, ok: 2, luck: 1, miss: 0 };
  if (!FL.rec[key] || rank[r] > rank[FL.rec[key]]) FL.rec[key] = r;
  flRender();
}
function flStep(d) {
  const all = PT.LIGHT.flatMap(pid => PT.P[pid].blanks.map(x => [pid, x.n]));
  const i = all.findIndex(([p, n]) => p === FL.pid && n === FL.n), [p, n] = all[(i + d + all.length) % all.length];
  flSet(p, n);
}
function flInit() {
  $('fPas').innerHTML = PT.LIGHT.map(pid => `<button type="button" data-p="${pid}">${esc(PT.P[pid].label)} · ${esc(PT.P[pid].title)}</button>`).join('');
  $('fl').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-say')) return;
    if (b.dataset.p) flSet(b.dataset.p, PT.P[b.dataset.p].blanks[0].n);
    else if (b.dataset.n) flSet(FL.pid, +b.dataset.n);
    else if (b.dataset.rv) flReveal(b.dataset.rv);
    else if (b.dataset.k != null) flPick(+b.dataset.k);
  });
  $('fl').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key, n = 'abcd'.indexOf(k.toLowerCase()), d = '1234'.indexOf(k);
    if (k === 'ArrowUp') { e.preventDefault(); flReveal('up'); }
    else if (k === 'ArrowDown') { e.preventDefault(); flReveal('down'); }
    else if (k === 'h' || k === 'H') { e.preventDefault(); flReveal('head'); }
    else if (k === '0') { e.preventDefault(); flReveal('reset'); }
    else if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); flStep(k === 'ArrowRight' ? 1 : -1); }
    else if (n >= 0 || d >= 0) { e.preventDefault(); flPick(n >= 0 ? n : d); }
  });
  flRender();
}

/* =========================================================
   8. 연습 문제 — 지문 넷 × 빈칸 넷 (EN.drill과 같은 모양 · 같은 키보드)
   ========================================================= */
function passageDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0 })), cur = 0, retry = null;
  root.classList.add('edr', 'pdr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const pidx = pid => PT.DRILL.indexOf(pid);
  function go(i) { cur = i; render(); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j]);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j]);
    cur = -1; render();
  }
  function answer(k) { const s = st[cur]; if (s.pick !== null) return; s.pick = k; s.hints = items[cur].steps.length; render(); const f = root.querySelector('.edr-next'); if (f) f.focus({ preventScroll: true }); }
  function hint() { const s = st[cur]; if (s.pick !== null || s.hints >= items[cur].steps.length) return; s.hints++; render(); }
  function render() { const had = root.contains(document.activeElement); draw(); if (had && !root.contains(document.activeElement)) root.focus({ preventScroll: true }); }
  function dots() {
    return '<ol class="edr-dots" aria-label="문제 목록">' + items.map((it, i) => {
      const s = st[i], c = s.pick === null ? '' : s.pick === it.a ? ' ok' : ' no', sep = i && items[i - 1].pid !== it.pid ? '<li class="sep" aria-hidden="true"></li>' : '';
      return `${sep}<li><button type="button" data-go="${i}" class="${c}${i === cur ? ' cur' : ''}" aria-label="지문 ${pidx(it.pid) + 1}의 빈칸 ${it.n}${s.pick === null ? '' : s.pick === it.a ? ' 정답' : ' 오답'}"${i === cur ? ' aria-current="step"' : ''}>${it.n}</button></li>`;
    }).join('') + '</ol>';
  }
  function draw() {
    const ok = st.filter((s, i) => s.pick === items[i].a).length, done = st.filter(s => s.pick !== null).length;
    if (cur < 0) {
      const wrong = items.map((_, i) => i).filter(i => st[i].pick !== items[i].a);
      root.innerHTML = dots() + `<div class="edr-card edr-end"><p class="edr-big">${ok} / ${items.length}</p><p>${esc(cfg.done ? cfg.done(ok, items.length) : '')}</p>
        <div class="edr-acts">${wrong.length ? `<button type="button" class="edr-btn" data-act="retry">틀린 ${wrong.length}문제 다시 풀기</button>` : ''}<button type="button" class="edr-btn ghost" data-act="reset">처음부터 다시</button></div></div>`;
      return;
    }
    const it = items[cur], s = st[cur], answered = s.pick !== null, right = s.pick === it.a, b = it.b, P = b.P;
    // 힌트 단계의 표시 모으기
    const sCls = {}, sMarks = {}, headMarks = [];
    it.steps.slice(0, s.hints).forEach(stp => stp.marks.forEach(m => {
      if (m.s === -1) { if (m.t) headMarks.push(m.t); return; }
      if (!m.t) { if (m.role === 'focus') sCls[m.s] = 'cur'; else if (!sCls[m.s]) sCls[m.s] = 'clue'; return; }
      (sMarks[m.s] = sMarks[m.s] || []).push({ t: m.t, role: m.role === 'cue' ? 'cue' : m.role === 'trap' ? 'trap' : 'ante' });
    }));
    if (!sCls[b.s]) sCls[b.s] = 'cur';
    const pItems = items.map((x, i) => [x, i]).filter(([x]) => x.pid === it.pid);
    const blank = n => {
      const [x, i] = pItems.find(([y]) => y.n === n), ss = st[i], slot = P.sents.some(r => r === `[${n}]`);
      if (ss.pick !== null) {
        const ans = esc(x.opts[x.a]);
        if (i === cur) return ss.pick === x.a ? `<span class="bk fill ok">${ans}</span>` : `<span class="bk fill no"><s>${esc(x.opts[ss.pick])}</s>${ans}</span>`;
        return `<span class="bk fill done">${ans}</span>`;
      }
      return blankBox(n, (i === cur ? 'now' : '') + (slot ? ' slot' : ''));
    };
    const text = passageHTML(P, { cls: s2 => sCls[s2] || '', marks: s2 => sMarks[s2] || [], blank, headMarks });
    const pdone = pItems.every(([, i]) => st[i].pick !== null);
    const first = pItems[0][0].n, last = pItems[pItems.length - 1][0].n, KIND = { notice: 'notice', email: 'e-mail', memo: 'memo', ad: 'advertisement' }[P.kind];
    const ptrMark = (o, k) => {
      if (it.type !== 'insert' || s.hints < 1) return esc(o);
      return sentHTML(o, b.opts[k].ptrs.map(p => ({ t: p.t, role: 'cue' })), () => '');
    };
    const o = retry ? order() : null;
    let html = dots() + `<div class="edr-card${answered ? (right ? ' ok' : ' no') : ''}">
      <p class="edr-meta"><span>${retry ? `다시 풀기 ${o.indexOf(cur) + 1} / ${o.length}` : `지문 ${pidx(it.pid) + 1} / 4 · ${esc(P.label)} · 문제 ${cur + 1} / ${items.length}`}</span>${answered ? `<span class="edr-tag">${esc(it.tag)}</span>` : ''}</p>
      <p class="pdr-dir" lang="en">Questions ${first}–${last} refer to the following ${KIND}.</p>
      <div class="ptext" lang="en">${text}</div>
      <p class="pdr-q">빈칸 (${it.n})에 들어갈 알맞은 ${it.type === 'insert' ? '문장' : '말'}은?</p>
      <div class="edr-opts${it.type === 'insert' ? ' col' : ''}" role="group" aria-label="보기">${it.opts.map((op, k) => {
        const cls = answered ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
        return `<button type="button" data-pick="${k}" class="${cls}"${answered ? ' disabled' : ''}><b>(${L4[k]})</b> <span lang="en">${ptrMark(op, k)}</span></button>`;
      }).join('')}</div>`;
    if (!answered) html += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= it.steps.length ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / ${it.steps.length}</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트</span></div>`;
    if (s.hints) html += `<ol class="edr-steps">${it.steps.slice(0, s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('')}</ol>`;
    if (answered) {
      html += `<p class="edr-verdict"><b>${right ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      html += `<ul class="edr-notes">${it.notes.map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]}) <span lang="en">${esc(it.opts[k])}</span></b> ${esc(t)}</li>`).join('')}</ul>`;
      html += `<p class="edr-ko">${sayBtn(it.full, '완성 문장 듣기')}<span>${esc(it.ko || '')}</span></p>`;
      if (pdone) html += `<details class="pdr-gloss"><summary>지문 전체 해석 · 듣기</summary>${sayBtn(PT.fullText(P), '지문 전체 듣기')}<ol>${P.sents.map((r, i2) => { const en = PT.sentText(P, i2, Object.fromEntries(P.blanks.map(x => [x.n, PT.ansText(x)]))); return `<li><span lang="en" style="color:var(--text)">${sayBtn(en)}${esc(en)}</span><span>${esc(P.ko[i2])}</span></li>`; }).join('')}</ol></details>`;
      html += `<div class="edr-acts"><button type="button" class="edr-btn edr-next" data-act="next">${done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button></div>`;
    }
    root.innerHTML = html + '</div>';
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
    if (b.hasAttribute('data-say')) { if (cfg.before) cfg.before(); return; }
    if (b.dataset.go) { retry = null; go(+b.dataset.go); return; }
    if (b.dataset.pick) { answer(+b.dataset.pick); return; }
    const act = b.dataset.act;
    if (act === 'hint') hint();
    else if (act === 'next') next();
    else if (act === 'retry') { retry = items.map((_, i) => i).filter(i => st[i].pick !== items[i].a); retry.forEach(i => { st[i] = { pick: null, hints: 0 }; }); go(retry[0]); }
    else if (act === 'reset') { retry = null; st = items.map(() => ({ pick: null, hints: 0 })); go(0); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || cur < 0) return;
    if (e.target.closest && e.target.closest('summary')) return;
    const k = e.key.toUpperCase(), i = L4.indexOf(k), n = '1234'.indexOf(k);
    if (st[cur].pick === null && (i >= 0 || n >= 0)) { e.preventDefault(); answer(i >= 0 ? i : n); }
    else if (k === 'H') { e.preventDefault(); hint(); }
    else if ((e.key === 'ArrowRight' || e.key === 'Enter') && st[cur].pick !== null && !(e.target.closest && e.target.closest('button:not(.edr-next)'))) { e.preventDefault(); next(); }
  });
  render();
  return { go, state: () => st };
}

/* =========================================================
   9. 퀴즈 — 사이트 공통 부품(../shared/quiz.js)
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', cue: '#C9A7FF', focus: '#6EC8FF', trap: '#FF9F7A', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', key: '#FFC15E', gap: '#FF7AA8', panel: '#18202A' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
function qwrap(g, s, x, y, maxW, lh) {
  const words = s.split(' '), lines = [''];
  words.forEach(w => { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (g.measureText(t).width > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; });
  lines.forEach((l, i) => g.fillText(l, x, y + i * lh));
  return lines.length;
}
// 그림 문제 1: 시제를 정하는 문장 찾기 (cafe)
const CAFE = PT.P.cafe, CAFE_B = CAFE.blanks[0];
const FIG_CLUE = (() => {
  const box = k => ({ x: 16, y: 14 + k * 50, w: 568, h: 44 });
  return {
    width: 600, height: 216, label: '문장 넷: A Last month, we asked employees how to improve the cafeteria. B Many of them wanted healthier food. C The new menu ___ more salads and soups. D It will be introduced on Monday, March 3.',
    pick: (x, y) => [0, 1, 2, 3].findIndex(k => { const b = box(k); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 216); g.textBaseline = 'middle';
      CAFE.sents.forEach((raw, k) => {
        const b = box(k), isBlank = k === CAFE_B.s, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer, trap = st.done && CAFE_B.trap && k === CAFE_B.trap.s;
        rrq(g, b.x, b.y, b.w, b.h, 9);
        g.fillStyle = on ? 'rgba(201,167,255,0.18)' : wrong ? 'rgba(255,142,142,0.16)' : isBlank ? 'rgba(110,200,255,0.10)' : st.hover === k ? QCOL.hover : QCOL.panel; g.fill();
        g.strokeStyle = on ? QCOL.cue : trap ? QCOL.trap : isBlank ? QCOL.focus : 'rgba(238,241,244,0.14)'; g.lineWidth = on ? 2.4 : 1.3; g.stroke();
        g.font = qfont(13, 700); g.fillStyle = QCOL.key; g.textAlign = 'left'; g.fillText(L4[k], b.x + 10, b.y + b.h / 2);
        g.font = qfont(15, 500); g.fillStyle = QCOL.text;
        g.fillText(PT.sentText(CAFE, k, st.done ? { 1: PT.ansText(CAFE_B) } : {}), b.x + 30, b.y + b.h / 2);
        if (st.done && (on || trap)) { g.font = qfont(11, 700); g.fillStyle = on ? QCOL.cue : QCOL.trap; g.textAlign = 'right'; g.fillText(on ? '단서' : '함정', b.x + b.w - 8, b.y + 10); }
      });
    },
  };
})();
// 그림 문제 2: 문장이 들어갈 자리 고르기
const FIG_POS = (() => {
  const P = PT.POS, chipB = k => ({ x: 528, y: 76 + k * 34 - 13, w: 52, h: 26 });
  return {
    width: 600, height: 222, label: `넣을 문장: ${P.sent} 글: ${P.sents.map((s, k) => `${s} [${k + 1}]`).join(' ')}`,
    pick: (x, y) => [0, 1, 2, 3].findIndex(k => { const b = chipB(k); return x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 222); g.textBaseline = 'middle';
      rrq(g, 14, 10, 572, 40, 9); g.fillStyle = 'rgba(255,193,94,0.12)'; g.fill(); g.strokeStyle = QCOL.key; g.lineWidth = 1.5; g.stroke();
      g.font = qfont(14, 600); g.fillStyle = QCOL.text; g.textAlign = 'left'; g.fillText(P.sent, 26, 30);
      P.sents.forEach((s, k) => {
        const y = 76 + k * 34, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        g.font = qfont(14, 500); g.fillStyle = st.done && k === st.answer ? QCOL.cue : QCOL.soft; g.textAlign = 'left'; g.fillText(s, 20, y);
        const b = chipB(k);
        rrq(g, b.x, b.y, b.w, b.h, 7); g.fillStyle = on ? 'rgba(127,224,168,0.2)' : wrong ? 'rgba(255,142,142,0.2)' : st.hover === k ? QCOL.hover : 'rgba(255,122,168,0.10)'; g.fill();
        g.setLineDash(on ? [] : [4, 3]); g.strokeStyle = on ? QCOL.ok : QCOL.gap; g.lineWidth = 1.6; g.stroke(); g.setLineDash([]);
        g.font = qfont(13, 700); g.fillStyle = on ? QCOL.ok : QCOL.gap; g.textAlign = 'center'; g.fillText(`[${k + 1}]`, b.x + b.w / 2, b.y + b.h / 2 + 1);
      });
      if (st.done) { g.font = qfont(12, 700); g.fillStyle = QCOL.cue; g.textAlign = 'left'; g.fillText('this event → a special event (바로 앞 문장)', 20, 210); }
    },
  };
})();
const QS = (() => {
  const lobby1 = PT.blank('lobby', 1), news = PT.P.newsletter.blanks[0], late = PT.withDate('sched', 520).blanks[0];
  const prOpts = ['However', 'For example', 'Otherwise', 'As a result'];
  const q = [
    { q: '토익 Part 6에서 글(지문) 하나에 나오는 빈칸은 몇 개인가요?', opts: ['둘', '셋', '넷', '다섯'], a: 2,
      why: 'Part 6은 글 하나에 빈칸 넷이에요. 글이 넷 나오니까 모두 16문제예요. 글마다 대개 한 빈칸은 문장을 통째로 고르는 문장 넣기예요.' },
    { q: '‘During this time, the lobby ___ to all visitors.’ 이 문장만 보고 지울 수 있는 보기는?', opts: lobby1.opts, a: 1,
      why: 'being closed → 시제가 없는 꼴이라 동사 자리에 못 와요. 나머지 셋(was closed · will be closed · has been closed) → 문장만으로는 모두 문법에 맞아요. 앞 문장을 봐야 하나로 줄어요.',
      check: () => { const c = PT.alone(lobby1); return c.length === 3 && !c.includes(1); } },
    { q: '빈칸 문장 C의 시제를 정해 주는 문장은? 문장을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: 3, figure: FIG_CLUE,
      why: 'D의 It will be introduced on Monday, March 3 → 새 메뉴는 앞으로 나와요. 그래서 C → will include. A의 Last month → ‘물어본 때’일 뿐이라 가까운 과거형 함정이에요.',
      check: () => CAFE_B.clues.map(c => c.s).join() === '3' && PT.ansText(CAFE_B) === 'will include' },
    { q: '공지 머리말이 ‘Posted: May 20’이에요. ‘The lobby ___ from May 12 to May 16.’ 빈칸에 알맞은 말은?', opts: late.opts, a: 0,
      why: '글을 쓴 날(5월 20일)이 공사 기간(5월 12~16일)보다 뒤라서 이미 끝난 일 → was closed. 머리말 날짜가 5월 2일이었다면 → will be closed.',
      check: () => PT.cands(late).join() === '0' },
    { q: '‘We will not print paper copies of the newsletter this year. ___, it will be sent to all staff by e-mail.’ 빈칸에 알맞은 말은?', opts: news.opts, a: 1,
      why: '앞에서 종이로 찍지 않는다고 했고, 그 대신 이메일로 보낸다는 관계 → Instead. Although → 접속사라서 마침표 뒤 쉼표 자리에 못 와요.',
      check: () => PT.cands(news).join() === '1' },
    { q: '‘Our old printers often broke down. ___, we replaced all of them last month.’ 두 문장 사이에 ‘그래서’가 자연스러워요. 빈칸에 알맞은 말은?', opts: prOpts, a: 3,
      why: '‘그래서’ = 결과. 자주 고장 났다(원인) → 모두 바꿨다(결과) → As a result. However → 반대, For example → 예, Otherwise → ‘그렇지 않으면’이에요.',
      check: () => prOpts.map(w => PT.link(w).r === 'result').join() === 'false,false,false,true' && PT.isOk(PT.P.prResult.blanks[0], PT.P.prResult.blanks[0].opts.indexOf('As a result')) },
    { q: '‘These changes will take effect on July 1.’ 이 문장이 빈칸에 들어가려면 바로 앞 문장에 무엇이 있어야 할까요?', opts: ['바뀌는 내용 (changes가 가리킬 것)', '7월 1일이라는 날짜', '글쓴이의 이름', '질문 하나'], a: 0,
      why: 'These changes → 앞에 나온 ‘바뀌는 내용’을 가리켜요. 앞 문장에 바뀌는 내용이 없으면 가리킬 짝이 없어 들어갈 수 없어요.' },
    { q: '노란 상자의 문장이 들어갈 자리는? [1]~[4]를 누르거나 단추를 고르세요.', opts: ['[1]', '[2]', '[3]', '[4]'], a: 2, figure: FIG_POS,
      why: 'this event → 바로 앞의 a special event를 가리켜요. 행사가 나온 문장(On opening day, there will be a special event.) 바로 뒤인 [3]이 자리예요.',
      check: () => [0, 1, 2, 3].map(k => PT.fitsAt(k)).join() === 'false,false,true,false' },
    { q: 'Part 6의 단서에 대해 바르게 말한 것은?', opts: ['단서는 늘 빈칸 바로 앞 문장에 있어요.', '빈칸 바로 앞의 과거형이 빈칸의 시제를 정해요.', '단서는 뒤 문장이나 머리말의 날짜에 있을 때도 있어요.', '보기에 글에 나온 낱말이 있으면 그 보기가 답이에요.'], a: 2,
      why: '단서는 앞 문장뿐 아니라 뒤 문장(if this date changes), 머리말(Posted: May 2), 멀리 있는 문장에도 있어요. 가까운 과거형과 같은 낱말은 함정일 때가 많아요.',
      check: () => PT.blank('lobby', 4).clues.some(c => c.s > PT.blank('lobby', 4).s) },
    { q: 'Part 6 문제를 푸는 3단계 풀이법의 순서로 알맞은 것은?', opts: ['앞뒤 문장 → 빈칸 문장 → 글 전체', '빈칸 문장 → 앞뒤 문장 → 글 전체', '글 전체 → 빈칸 문장 → 앞뒤 문장', '빈칸 문장 → 글 전체 → 앞뒤 문장'], a: 1,
      why: '① 빈칸 문장만 보고 문법으로 지울 보기를 지우고 → ② 앞뒤 문장의 단서로 하나로 줄인 다음 → ③ 글 전체의 흐름으로 확인해요.' },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[Part 6] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[Part 6] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
  if (q.filter(x => x.figure).length < 2) console.warn('[Part 6] 그림 문제가 둘보다 적어요.');
  return q;
})();

/* =========================================================
   10. 시작
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
  if (tg.closest && tg.closest('input, select, textarea, #playground, #drill, #quiz, #summary-table')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = PV.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * PV.W, (e.clientY - r.top) / r.height * PV.H]; };
const hitAt = (x, y) => started ? PV.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.say && EN.say.supported) { if (playing) pause(); EN.say(h.say); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h && h.say && EN.say.supported ? '눌러서 발음 듣기: ' + h.say : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

EN.say.wire(document, { before() { if (playing) pause(); } });
flInit();
passageDrill($('drillRoot'), PT.drillItems(), {
  before() { if (playing) pause(); },
  done: (ok, total) => ok === total ? '모두 맞혔어요! 앞뒤 문장에서 단서를 찾는 눈이 생겼네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 07~09장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? 'Part 6의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(PV.baseText()).then(() => { dirty = true; });
setTimeout(() => PV.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
