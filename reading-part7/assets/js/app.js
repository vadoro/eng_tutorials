/* Part 7 독해 튜토리얼 — 플레이어, 직접 해 보기, 놀이터(근거 사냥), 지문 연습 문제, 퀴즈, 영상 추출
 * 규칙과 지문은 grammar.js(R7), 그림은 scenes.js(RV)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const R7 = window.R7, RV = window.RV, S = RV.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = RV;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sayBtn = (text, label) => EN.say.button(text, label);
const L4 = 'ABCD';
const cv = $('cv'), ctx = cv.getContext('2d');
R7.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = RV.fonts;
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
  const ready = new Promise(res => RV.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '답은 지문에 있다, 다른 말로 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { RV.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const c = started ? RV.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 영어 문장을 누르면 발음을 들려줘요.';
  if (c !== lastCap) { lastCap = c; capText.innerHTML = capHTML(c) || '&nbsp;'; }
  const ci = RV.chapterAt(T);
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
  if (dirty) { dirty = false; RV.render(ctx, started ? T : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
function touch() { if (playing) pause(); dirty = true; }
// 바꾼 결과가 보이는 시점보다 앞이면 그 시점으로 옮김
function showAt(u) { const ch = CHAPTERS[RV.chapterAt(T)]; if (T - ch.t < u) { T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); } }

/* =========================================================
   4. 지문 HTML 도우미 (직접 해 보기 · 놀이터 · 연습 문제)
   ========================================================= */
// 글자 하나: marks [{ t, role }]가 처음 나오는 곳을 <mark>로 (낱말 단위)
function markText(raw, marks) {
  const ranges = [];
  (marks || []).forEach(m => {
    if (!m.t) return;
    const re = new RegExp('(^|[^A-Za-z])' + m.t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])'), f = re.exec(raw);
    const i = f ? f.index + f[1].length : -1;
    if (i >= 0 && !ranges.some(r => i < r.e && i + m.t.length > r.s)) ranges.push({ s: i, e: i + m.t.length, role: m.role });
  });
  ranges.sort((a, b) => a.s - b.s);
  let out = '', at = 0;
  ranges.forEach(r => { out += esc(raw.slice(at, r.s)) + `<mark class="mk-${r.role}">${esc(raw.slice(r.s, r.e))}</mark>`; at = r.e; });
  return out + esc(raw.slice(at));
}
const KIND_EN = { email: 'E-MAIL', notice: 'NOTICE', ad: 'ADVERTISEMENT', web: 'WEB PAGE', chat: 'TEXT MESSAGES', form: 'FORM' };
/* 글 하나. o: { cls(s) → 'ev' | 'trap' | …, marks(s) → [{ t, role }], tap(단위를 단추로), ins: { n: { text, cls } }, mk(n) → 자리 표시 class, num } */
function docHTML(Sset, d, o = {}) {
  const Dc = Sset.D[d], U = R7.units(Dc), marks = s => (o.marks ? o.marks(s) : []) || [];
  const attr = s => o.tap ? ` role="button" tabindex="0" data-tap="${d}:${s}" aria-label="${esc(U[s].text)}"` : '';
  const cls = s => (o.cls ? o.cls(s) : '') || '';
  const head = Dc.head && Dc.head.length ? `<div class="head">${Dc.head.map((h, i) => `<span class="hd${i === 0 ? ' h0' : ''}">${markText(h, marks(-1))}</span>`).join('')}</div>` : '';
  let body = '';
  if (Dc.kind === 'chat') {
    const first = Dc.msgs[0].who;
    body = Dc.msgs.map((m, s) => {
      const ini = m.who.split(' ').map(w => w[0]).join(''), mm = marks(s);
      return `<div class="msg${m.who === first ? '' : ' b'}"><span class="av" aria-hidden="true">${ini}</span><div><p class="meta"><b>${esc(m.who)}</b> ${markText(m.time, mm)}</p><p class="u bubble ${cls(s)}" data-s="${s}"${attr(s)}>${markText(m.t, mm)}</p></div></div>`;
    }).join('');
  } else if (Dc.kind === 'form') {
    const thead = Dc.cols ? `<thead><tr>${Dc.cols.map((c, i) => `<th scope="col" class="${o.col === i ? 'colhl' : ''}">${esc(c)}</th>`).join('')}</tr></thead>` : '';
    const rows = Dc.rows.map((r, s) => `<tr class="u ${cls(s)}" data-s="${s}"${attr(s)}>${r.map((c, ci) => { const tag = !Dc.cols && ci === 0 ? 'th' : 'td'; const mm = marks(s).filter(m => c.includes(m.t)); return `<${tag}${tag === 'th' ? ' scope="row"' : ''} class="${o.col === ci ? 'colhl' : ''}">${markText(c, mm)}</${tag}>`; }).join('')}</tr>`).join('');
    const foot = (Dc.foot || []).map((f, j) => { const s = Dc.rows.length + j; return `<p class="u foot ${cls(s)}" data-s="${s}"${attr(s)}>${markText(f, marks(s))}</p>`; }).join('');
    body = `<div class="ftwrap"><table class="ft">${thead}<tbody>${rows}</tbody></table></div>${foot}`;
  } else {
    const pars = [];
    U.forEach((u, s) => {
      const p = pars[u.par] || (pars[u.par] = []);
      if (u.type === 'mark') {
        const ins = o.ins && o.ins[u.n];
        p.push(ins ? `<span class="u ins ${ins.cls || ''}">${esc(ins.text)}</span>` : `<span class="bk mk ${o.mk ? o.mk(u.n) : ''}" aria-label="자리 ${u.n}">[${u.n}]</span>`);
      } else p.push(`<span class="u ${cls(s)}" data-s="${s}"${attr(s)}>${markText(u.text, marks(s))}</span>`);
    });
    body = pars.filter(Boolean).map(p => `<p class="par">${p.join(' ')}</p>`).join('');
  }
  return `<div class="doc doc-${Dc.kind}" data-d="${d}"><p class="doc-kind">${o.num ? `${d + 1} · ` : ''}${KIND_EN[Dc.kind]}</p>${head}${body}</div>`;
}
// 근거 사이 연결 선: 왼쪽 여백에 꺾쇠로 (글자를 가로지르지 않음)
function drawLinks(root, links) {
  const box = root.querySelector('.pset'); if (!box) return;
  const svg = box.querySelector('svg.links'); if (!svg) return;
  const br = box.getBoundingClientRect();
  svg.setAttribute('width', br.width); svg.setAttribute('height', br.height); svg.setAttribute('viewBox', `0 0 ${br.width} ${br.height}`);
  // 선은 근거 낱말이 있는 줄 높이에서 글 카드의 왼쪽 끝까지만 (카드 안의 글자를 가로지르지 않음)
  const find = r => { const el = box.querySelector(`.doc[data-d="${r.d || 0}"] [data-s="${r.s}"]`); if (!el) return null; const m = [...el.querySelectorAll('mark')].find(x => r.t && r.t.includes(x.textContent)) || el; const b = m.getClientRects()[0] || m.getBoundingClientRect(), card = el.closest('.doc').getBoundingClientRect(); return { x: card.left - br.left + 1, y: b.top - br.top + Math.min(b.height, 26) / 2 }; };
  svg.innerHTML = '<defs><marker id="lkArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--c-link)"/></marker></defs>' + links.map(([a, b], i) => {
    const A = find(a), B = find(b); if (!A || !B) return '';
    const gx = 7 + (i % 3) * 5;
    return `<circle cx="${A.x - 3}" cy="${A.y}" r="3.2" fill="var(--c-link)"/><path d="M${A.x - 4} ${A.y}H${gx}V${B.y}H${B.x - 5}" fill="none" stroke="var(--c-link)" stroke-width="2.2" stroke-dasharray="5 4" marker-end="url(#lkArrow)"/>`;
  }).join('');
}
// 질문 글: 키워드 표시
const qHTML = (q, marks) => `<span lang="en">${markText(q.q, marks)}</span>`;

/* =========================================================
   5. 장면별 '직접 해 보기' — 장이 바뀔 때만 다시 만듦
   ========================================================= */
const seg = (name, items, cur, attr = 'v') => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${t}</button>`).join('')}</div>`;
const enLine = (text, cls = '') => `<p class="enline ${cls}">${sayBtn(text)}<span lang="en">${esc(text)}</span></p>`;
// 작은 문제: 질문 + 보기, 고르면 규칙 엔진이 판정
const MQ = {};
function miniQ(id, o = {}) {
  const q = R7.Q[id], st = MQ[id] || (MQ[id] = { pick: null, ev: false });
  const opts = q.opts.map((x, k) => { const j = R7.judge(q, k), cls = st.pick == null ? '' : k === st.pick ? (j.s === 'ok' ? 'right' : 'wrong') : ''; return `<button type="button" data-mq="${id}" data-k="${k}" class="${cls}"><b>(${L4[k]})</b> <span lang="en">${esc(x.t)}</span></button>`; }).join('');
  let r = '';
  if (st.pick != null) { const j = R7.judge(q, st.pick); r = `<b class="${j.s === 'ok' ? 'c-ok' : 'c-no'}">${j.s === 'ok' ? '맞아요!' : `아니에요. ${esc(R7.STEP[j.step - 1])}에서 지워져요 · ${esc(j.name)}.`}</b> ${esc(j.why)}`; }
  const ev = st.ev ? `<p class="evbox"><b>근거</b> ${R7.evOf(q).map(e => `<span lang="en">${esc(R7.unitText(q.S, e.d || 0, e.s))}</span> <span class="note">${esc(q.S.D[e.d || 0].ko[e.s] || '')}</span>`).join('<br>')}</p>` : '';
  return `<div class="mini" data-q="${id}"><p class="mq">${qHTML(q, [])}</p>${q.sent ? `<p class="mq ins" lang="en">“${esc(q.sent)}”</p>` : ''}
    <div class="mo col">${opts}</div>${o.evBtn ? `<div class="seg"><button type="button" data-mev="${id}" aria-pressed="${st.ev}">근거 문장 보기</button></div>` : ''}${ev}<p class="mr" role="status">${r}</p></div>`;
}
const FMT_NOTE = ['지문 하나: 이메일 · 공지 · 광고 · 문자 · 양식 같은 글 하나에 두세 문제씩 나와요.', '지문 둘: 두 글(예: 광고와 그 광고를 보고 쓴 이메일)을 함께 읽고 다섯 문제를 풀어요. 두 글을 이어야 풀리는 문제가 있어요.', '지문 셋: 세 글을 함께 읽고 다섯 문제를 풀어요. 어느 글에 어떤 단서가 있는지 찾는 것이 먼저예요.'];
const KINDS = [['이메일', 'e-mail'], ['공지', 'notice'], ['광고', 'advertisement'], ['기사', 'article'], ['문자 메시지', 'text-message chain'], ['온라인 채팅', 'online chat discussion'], ['양식', 'form'], ['청구서', 'invoice'], ['일정표', 'schedule']];
const paraChoices = i => { const p = R7.PARA[i], all = [p.same, ...p.traps]; return [0, 1, 2].map(k => all[(k + i) % 3]); };   // 정답 자리를 줄마다 바꿈
const SYN_Q = R7.Q.hotel3, INS_Q = R7.Q.elev3, LNK_Q = R7.Q.cater2;
let PARA_DONE = {};
const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>먼저 풀어 보세요</h3>${miniQ('hotel1', { evBtn: true })}
    <p class="note">화면의 이메일을 보고 골라 보세요. 막히면 ‘근거 문장 보기’를 눌러요. 판정은 규칙 엔진이 해요.</p>`,
  format: () => `<h2>직접 해 보기</h2><h3>지문 세트 세 가지</h3>
    ${seg('지문 세트', [[0, '지문 하나'], [1, '지문 둘'], [2, '지문 셋'], ['', '모두']], S.fmt == null ? '' : S.fmt)}
    <p class="verdict">${S.fmt == null ? '세트를 고르면 화면에서 그 세트가 켜져요.' : esc(FMT_NOTE[S.fmt])}</p>
    <ul class="trio">${KINDS.map(([ko, en]) => `<li>${enLine(en, 'small')}<span class="ko">${esc(ko)}</span></li>`).join('')}</ul>`,
  core: () => `<h2>직접 해 보기</h2><h3>같은 뜻, 다른 말 찾기</h3>
    <p class="note">왼쪽은 지문의 말이에요. 같은 뜻의 보기를 골라 보세요. 지문 낱말이 그대로 들어 있는 것은 함정이에요.</p>
    <ol class="gapq">${R7.PARA.map((p, i) => `<li data-pp="${i}"><span lang="en"><b>${esc(p.text)}</b></span><span class="mo" lang="en">${paraChoices(i).map(c => `<button type="button" data-pc="${esc(c)}" class="${PARA_DONE[i] === c ? (c === p.same ? 'right' : 'wrong') : ''}">${esc(c)}</button>`).join('')}</span><span class="mr" role="status">${PARA_DONE[i] ? esc(PARA_DONE[i] === p.same ? `맞아요. ${p.ko}` : `아니에요. ${p.text} → ${p.same} (${p.ko})`) : ''}</span></li>`).join('')}</ol>`,
  purpose: () => `<h2>직접 해 보기</h2><h3>목적 · 요청 문제</h3>
    ${seg('문제', [['purpose', '목적 문제'], ['request', '요청 문제'], ['', '영상대로']], S.qsel || '', 'qs')}
    ${miniQ(S.qsel === 'request' ? 'elev2' : 'elev1')}
    <p class="note">목적 → 첫 문단(I am writing to …), 요청 → please · Could you 뒤를 보세요.</p>`,
  detail: () => {
    const Dc = R7.DOCS.invoice, q = R7.Q.inv1;
    let v = '';
    if (S.cell) {
      const [r, c] = S.cell, val = Dc.rows[r][c], k = q.opts.findIndex(x => x.src ? x.src.s === r && x.src.t === val : r === q.ev[0].s && val === x.t);
      v = k >= 0 ? (() => { const j = R7.judge(q, k); return `<b class="${j.s === 'ok' ? 'c-ok' : 'c-no'}">${j.s === 'ok' ? '맞아요!' : esc(j.name)}</b> ${esc(j.why)}`; })() : `<b class="c-no">질문과 관계없는 칸이에요.</b> 질문은 예약 카드(Appointment cards)의 수량(Quantity)을 물어요.`;
    }
    return `<h2>직접 해 보기</h2><h3>필요한 칸 하나 찾기</h3>
      <p class="mq" lang="en">${esc(q.q)}</p>
      <div class="cellpick" role="group" aria-label="청구서 칸"><span></span>${Dc.cols.map(c => `<span class="ch" lang="en">${esc(c)}</span>`).join('')}${Dc.rows.map((row, r) => `${row.map((val, c) => `<button type="button" data-cell="${r},${c}" aria-pressed="${!!(S.cell && S.cell[0] === r && S.cell[1] === c)}" lang="en">${esc(val)}</button>`).join('')}`).join('')}</div>
      <p class="verdict">${v || '칸을 누르면 화면의 표에도 표시돼요.'}</p>${miniQ('lib1')}`;
  },
  notinfer: () => {
    const q = R7.Q.lib2;
    return `<h2>직접 해 보기</h2><h3>NOT 문제: 보기마다 찾아보기</h3>
      <p class="mq" lang="en">${esc(q.q)}</p>
      <ol class="gapq">${q.opts.map((x, k) => `<li data-nk="${k}"><span lang="en">(${L4[k]}) ${esc(x.t)}</span><span class="mo"><button type="button" data-nv="1">지문에 있음</button><button type="button" data-nv="0">지문에 없음</button></span><span class="mr" role="status"></span></li>`).join('')}</ol>
      ${miniQ('lib3')}`;
  },
  synonym: () => {
    const q = SYN_Q, k = S.syn, j = k != null ? R7.judge(q, k) : null;
    return `<h2>직접 해 보기</h2><h3>바꿔 넣어 읽어 보기</h3>
      ${enLine(R7.DOCS.hotel.sents[5], 'small')}
      ${seg('hold 대신', q.opts.map((x, i) => [i, `<span lang="en">${esc(x.t)}</span>`]).concat([['', '영상대로']]), k == null ? '' : k, 'syn')}
      ${j ? `${enLine(R7.DOCS.hotel.sents[5].replace(/\bhold\b/, q.opts[k].t))}<p class="verdict"><b class="${j.s === 'ok' ? 'c-ok' : 'c-no'}">${j.s === 'ok' ? '말이 돼요 · 정답' : esc(j.name)}</b> ${esc(j.why)}</p>` : '<p class="note">낱말을 고르면 hold 자리에 넣어 읽어 줘요. 화면의 문장도 바뀌어요.</p>'}`;
  },
  chatins: () => {
    const q = INS_Q, n = S.ins, j = n != null ? R7.judge(q, n - 1) : null;
    return `<h2>직접 해 보기</h2><h3>문장을 넣어 보기</h3>
      <p class="mq ins" lang="en">“${esc(q.sent)}”</p>
      ${seg('자리', [1, 2, 3, 4].map(i => [i, `[${i}]`]).concat([['', '영상대로']]), n == null ? '' : n, 'ins')}
      ${j ? `<p class="verdict"><b class="${j.s === 'ok' ? 'c-ok' : 'c-no'}">${j.s === 'ok' ? '짝이 맞아요 · 정답' : esc(j.name)}</b> ${esc(j.why)}</p>` : '<p class="note">자리를 고르면 화면의 이메일에 문장이 들어가요.</p>'}
      <h3>채팅 의도 하나 더</h3>${miniQ('chat2')}`;
  },
  linked: () => {
    const Sset = R7.SETS.catering, found = S.lnk || new Set();
    const items = Sset.D.map((Dc, d) => R7.units(Dc).map((u, s) => [d, s, u.text])).flat();
    const evs = LNK_Q.ev, n = evs.filter(e => found.has(`${e.d}:${e.s}`)).length;
    return `<h2>직접 해 보기</h2><h3>근거 두 개 찾기</h3>
      <p class="mq" lang="en">${esc(LNK_Q.q)}</p>
      <div class="seg col" role="group" aria-label="문장 고르기">${items.map(([d, s, t]) => `<button type="button" data-lk="${d}:${s}" aria-pressed="${found.has(`${d}:${s}`)}"><small>${d ? '이메일' : '광고'}</small> <span lang="en">${esc(t)}</span></button>`).join('')}</div>
      <p class="verdict">찾은 근거 <b>${n} / ${evs.length}</b>${LAST_TAP ? ` · ${esc(LAST_TAP)}` : ''}${n === evs.length ? ' — 다 찾았어요! 화면의 두 글이 선으로 이어져요.' : ''}</p>
      ${seg('화면', [['double', '이중 지문'], ['triple', '삼중 지문'], ['', '영상대로']], S.view || '', 'view')}`;
  },
  method: () => {
    const ex = { purpose: 'mag1', detail: 'conf3', not: 'cls2', synonym: 'store1', linked: 'desk2' }[S.mtype];
    const q = ex ? R7.Q[ex] : null;
    return `<h2>직접 해 보기</h2><h3>문제 유형별 3단계</h3>
      ${seg('문제 유형', [['purpose', '목적 · 요청'], ['detail', '세부 · 표'], ['not', 'NOT · 추론'], ['synonym', '동의어 · 의도'], ['linked', '삽입 · 연계'], ['', '모두']], S.mtype || '', 'mt')}
      ${q ? `<p class="note">예: 연습 문제 <i lang="en">${esc(q.q)}</i> — 엔진이 만든 풀이예요.</p><ol class="links">${R7.steps(q).map(s => `<li><b>${esc(s.head)}</b> ${esc(s.text)}</li>`).join('')}</ol>` : '<p class="note">유형을 고르면 화면에서 그 줄이 켜지고, 연습 문제 하나를 엔진이 3단계로 푼 풀이가 나와요.</p>'}`;
  },
  practice: () => `<h2>직접 해 보기</h2><h3>문제 골라 보기</h3>
    <div class="seg">${[0, 1, 2].map(i => `<button type="button" data-seek="${[0.4, 19.6, 38.6][i]}">문제 ${i + 1} · ${['목적', '세부 정보', '연계'][i]}</button>`).join('')}</div>
    <p class="note">더 풀어 보고 싶다면 아래 <a href="#playground">근거 사냥</a>과 <a href="#drill">연습 문제</a>로 가세요.</p>`,
  summary: () => `<h2>직접 해 보기</h2><h3>이제 직접 해 볼 차례</h3>
    <ul class="links"><li><a href="#playground">놀이터</a> — 근거 사냥: 질문을 읽고 근거 문장을 먼저 눌러 찾기</li>
    <li><a href="#drill">연습 문제</a> — 토익 Part 7 형식, 지문 세트 다섯 · 문제 열여섯, 3단계 힌트</li>
    <li><a href="#quiz">퀴즈</a> — 개념 확인 10문제</li><li><a href="#summary-table">핵심 정리</a> — 문제 유형별 근거 표와 용어</li></ul>`,
};
let LAST_TAP = '';
function buildLab(ci) { $('lab').innerHTML = LABS[CHAPTERS[ci].id](); }
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const rebuild = () => buildLab(RV.chapterAt(T));
  if (b.hasAttribute('data-say')) { if (playing) pause(); return; }
  if (b.dataset.seek) { seek(CHAPTERS[RV.chapterAt(T)].t + +b.dataset.seek); return; }
  if (b.dataset.mq) { MQ[b.dataset.mq].pick = +b.dataset.k; if (playing) pause(); rebuild(); return; }
  if (b.dataset.mev) { MQ[b.dataset.mev].ev = !MQ[b.dataset.mev].ev; if (playing) pause(); rebuild(); return; }
  if (b.dataset.pc != null) {                                  // 02장: 바꿔 말하기 짝
    const i = +b.closest('li').dataset.pp; PARA_DONE[i] = b.dataset.pc; S.pair = i; showAt(25.6); touch(); rebuild(); return;
  }
  if (b.dataset.nv != null) {                                  // 05장: NOT 문제 보기마다
    const li = b.closest('li'), k = +li.dataset.nk, q = R7.Q.lib2, x = q.opts[k], has = x.rel === 'stated', ok = (b.dataset.nv === '1') === has;
    li.querySelectorAll('button').forEach(y => y.classList.remove('right', 'wrong'));
    b.classList.add(ok ? 'right' : 'wrong');
    li.querySelector('.mr').textContent = (ok ? '맞아요. ' : '다시 보세요. ') + (has ? `${R7.loc(q, x.src)} ‘${x.src.t}’ → 지문에 있어요.` + (x.pairs ? ` (${x.pairs.map(([p, y]) => `${p} → ${y}`).join(', ')})` : '') : '지문 어디에도 없어요 → NOT 문제의 답이에요.');
    S.notk = k; showAt(1); touch(); return;
  }
  if (b.dataset.cell) { S.cell = b.dataset.cell.split(',').map(Number); showAt(18.6); touch(); rebuild(); return; }
  if (b.dataset.lk) {                                          // 08장: 근거 찾기
    const [d, s] = b.dataset.lk.split(':').map(Number), key = `${d}:${s}`, r = R7.tap(LNK_Q, d, s);
    S.lnk = S.lnk || new Set();
    if (S.lnk.has(key)) S.lnk.delete(key); else if (r.ev >= 0) S.lnk.add(key);
    LAST_TAP = r.why; S.view = null; showAt(1); touch(); rebuild(); return;
  }
  const grp = b.closest('.seg'); if (!grp) return;
  if (b.dataset.v != null) { S.fmt = b.dataset.v === '' ? null : +b.dataset.v; showAt(8.2); }
  else if (b.dataset.qs != null) { S.qsel = b.dataset.qs || null; showAt(S.qsel === 'request' ? 18.4 : 1); }
  else if (b.dataset.syn != null) { S.syn = b.dataset.syn === '' ? null : +b.dataset.syn; showAt(19); }
  else if (b.dataset.ins != null) { S.ins = b.dataset.ins === '' ? null : +b.dataset.ins; showAt(18.6); }
  else if (b.dataset.view != null) { S.view = b.dataset.view || null; if (S.view) S.lnk = null; showAt(S.view === 'triple' ? 19.6 : 1); }
  else if (b.dataset.mt != null) { S.mtype = b.dataset.mt || null; showAt(20); }
  else return;
  touch(); rebuild();
});

/* =========================================================
   6. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/TOEIC/g, '토익'], [/Part (\d)/g, '파트 $1'], [/\[(\d)\]/g, ' $1번 자리 '], [/(\d{1,2}):(\d{2}) A\.M\./g, '$1 $2 AM'], [/(\d{1,2}):(\d{2}) P\.M\./g, '$1 $2 PM'], [/(\d+) A\.M\./g, '$1 AM'], [/(\d+) P\.M\./g, '$1 PM']],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   7. 놀이터 — 근거 사냥
   ========================================================= */
const HS = { sid: R7.HUNT[0], qi: 0, found: new Set(), wrong: new Map(), pick: null, hint: 0, msg: '', early: false, rec: {} };
const hq = () => R7.SETS[HS.sid].qs[HS.qi];
const REC_LABEL = { clean: '근거 먼저 · 정답', luck: '근거 없이 정답', miss: '틀림' };
function hRender() {
  const had = $('hunt').contains(document.activeElement), focusKey = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.tap;
  hDraw();
  if (focusKey) { const el = $('hunt').querySelector(`[data-tap="${focusKey}"]`); if (el) el.focus({ preventScroll: true }); }
  if (had && !$('hunt').contains(document.activeElement)) $('hunt').focus({ preventScroll: true });
}
function hDraw() {
  const q = hq(), Sset = q.S, evs = R7.evOf(q), all = evs.every(e => HS.found.has(`${e.d || 0}:${e.s}`)), done = HS.pick != null;
  $('hSet').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.sid === HS.sid)));
  $('hQs').innerHTML = Sset.qs.map((x, i) => { const r = HS.rec[x.id]; return `<button type="button" data-qi="${i}" aria-pressed="${i === HS.qi}">Q${i + 1} · ${esc(R7.TYPE[x.type].name)}${r ? ` <span class="st ${r}">${r === 'miss' ? '×' : '✓'}</span>` : ''}</button>`; }).join('');
  const steps = R7.steps(q), showKey = HS.hint >= 1 || all || done;
  // 지문
  const markOf = {}; const add = (d, s, t, role) => { const k = `${d}:${s}`; (markOf[k] = markOf[k] || []).push({ t, role }); };
  if (showKey) steps[0].marks.forEach(m => { if (m.t) add(m.d, m.s, m.t, 'key'); });
  evs.forEach(e => { if (HS.found.has(`${e.d || 0}:${e.s}`) && e.t) add(e.d || 0, e.s, e.t, 'cue'); });
  if (done) steps[2].marks.forEach(m => add(m.d, m.s, m.t, m.role));
  // 글마다 그 글의 표시(근거 · 키워드 · 바꿔 말한 말 · 함정)를 넘김
  $('hText').innerHTML = `<div class="pset" lang="en">${Sset.D.map((_, d) => docHTML(Sset, d, {
    tap: true, num: Sset.D.length > 1,
    cls: s => { const k = `${d}:${s}`; return HS.found.has(k) ? 'ev' : HS.wrong.has(k) ? HS.wrong.get(k) : ''; },
    marks: s => markOf[`${d}:${s}`] || [],
    ins: done && q.type === 'insert' ? { [q.opts[q.a].n]: { text: q.sent, cls: 'ok' } } : null,
  })).join('')}<svg class="links" aria-hidden="true"></svg></div>`;
  // 질문
  const qm = showKey ? steps[0].qmarks : [];
  $('hQ').innerHTML = `<p class="hq-meta">${esc(R7.TYPE[q.type].name)} (${R7.TYPE[q.type].no}) · ${esc(Sset.title)}</p><p class="hq-q">${qHTML(q, qm)} ${sayBtn(q.q, '질문 듣기')}</p>${q.sent ? `<p class="hq-ins" lang="en">“${markText(q.sent, showKey ? [{ t: q.ptr.t, role: 'key' }] : [])}”</p>` : ''}<p class="hq-ko">${esc(q.ko || '')}</p>`;
  const nf = evs.filter(e => HS.found.has(`${e.d || 0}:${e.s}`)).length, docsN = new Set(evs.map(e => e.d || 0)).size;
  const m = $('hMeter');
  m.className = 'hunt-meter' + (all ? ' one' : '');
  m.innerHTML = `<span>찾은 근거</span><b>${nf} / ${evs.length}</b><span>${q.not ? 'NOT 문제 → 지문에 있는 보기 셋의 근거' : docsN > 1 ? `글 ${docsN}개에 나뉘어 있어요` : q.type === 'insert' ? '넣을 문장의 짝이 있는 문장' : '근거 문장'}</span>`;
  // 보기
  $('hOpts').innerHTML = q.opts.map((x, k) => {
    const j = R7.judge(q, k), cls = done ? (j.s === 'ok' ? 'right' : k === HS.pick ? 'wrong' : 'gone') : '';
    const om = done ? (steps[2].omarks[k] || []).filter(o => !o.word || x.rel === 'same') : [];
    return `<li><button type="button" data-k="${k}" class="${cls}"${done ? ' disabled' : ''}><b>(${L4[k]})</b><span class="o" lang="en">${markText(x.t, om)}</span>${done ? `<span class="why"><span class="pt ${j.s === 'ok' ? 'k-ok' : 'k-trap'}">${esc(j.name)}</span> ${esc(j.why)}</span>` : ''}</button></li>`;
  }).join('');
  let v = HS.msg ? `<span>${esc(HS.msg)}</span>` : '';
  if (done) {
    const ok = HS.pick === q.a;
    v = ok ? (HS.early ? `<b class="c-ok">정답</b>이지만 근거를 다 찾기 전에 골랐어요. 근거 문장을 눌러 확인해 보세요.` : `<b class="c-ok">정답! 근거를 먼저 찾고 풀었어요.</b>`) : `<b class="c-no">아니에요.</b> 정답은 (${L4[q.a]}). 보기마다 근거와의 관계를 읽어 보세요.`;
    v += ` ${sayBtn(q.q + ' ' + q.opts[q.a].t, '질문과 정답 듣기')}`;
  } else if (all) v = '<b class="c-ok">근거를 모두 찾았어요!</b> 이제 보기를 근거와 맞춰 보고 고르세요. 바꿔 말한 보기가 정답이에요.' + (HS.msg ? ` <span class="note">${esc(HS.msg)}</span>` : '');
  else if (HS.hint) v = `<span>${esc(steps[Math.min(HS.hint, 2) - 1].head)} ${esc(steps[Math.min(HS.hint, 2) - 1].text.split('. 지울 보기')[0])}</span>` + (HS.msg ? `<br><span class="note">${esc(HS.msg)}</span>` : '');
  else if (!HS.msg) v = '질문을 읽고, 답의 근거가 되는 문장을 지문에서 눌러 보세요.';
  $('hVerdict').innerHTML = v;
  $('hHint').disabled = done || HS.hint >= 2;
  // 기록
  const rows = R7.HUNT.map(sid => `<tr><th scope="row">${esc(R7.SETS[sid].title)}</th>${R7.SETS[sid].qs.map((x, i) => { const r = HS.rec[x.id]; return `<td class="${sid === HS.sid && i === HS.qi ? 'cur' : ''}">Q${i + 1} <span class="st ${r || ''}">${r ? esc(REC_LABEL[r]) : '—'}</span></td>`; }).join('')}${'<td></td>'.repeat(3 - R7.SETS[sid].qs.length)}</tr>`).join('');
  const recs = Object.values(HS.rec), total = R7.HUNT.reduce((s, sid) => s + R7.SETS[sid].qs.length, 0);
  $('hScore').innerHTML = `근거 먼저 찾고 맞힌 문제 <b>${recs.filter(r => r === 'clean').length} / ${total}</b> · 맞힌 문제 <b>${recs.filter(r => r !== 'miss').length}</b><div class="sumwrap"><table aria-label="문제별 기록"><thead><tr><th scope="col">세트</th><th scope="col" colspan="3">문제</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  // 글 사이 연결 (근거를 다 찾았거나 답했을 때)
  const links = all || done ? steps[1].links : [];
  requestAnimationFrame(() => drawLinks($('hText'), links));
}
function hSet(sid, qi = 0) { HS.sid = sid; HS.qi = qi; HS.found = new Set(); HS.wrong = new Map(); HS.pick = null; HS.hint = 0; HS.msg = ''; HS.early = false; hRender(); }
function hTap(d, s) {
  const q = hq(); if (HS.pick != null) return;
  const r = R7.tap(q, d, s), k = `${d}:${s}`;
  if (r.ev >= 0) { HS.found.add(k); HS.wrong.delete(k); }
  else HS.wrong.set(k, r.trap != null ? 'trap' : 'miss');
  HS.msg = r.why; hRender();
}
function hPick(k) {
  const q = hq(); if (HS.pick != null) return;
  const evs = R7.evOf(q), all = evs.every(e => HS.found.has(`${e.d || 0}:${e.s}`));
  HS.pick = k; HS.early = !all; HS.msg = '';
  const r = k !== q.a ? 'miss' : all ? 'clean' : 'luck', rank = { clean: 2, luck: 1, miss: 0 };
  if (!HS.rec[q.id] || rank[r] > rank[HS.rec[q.id]]) HS.rec[q.id] = r;
  hRender();
}
function hStep(dir) {
  const all = R7.HUNT.flatMap(sid => R7.SETS[sid].qs.map((_, i) => [sid, i]));
  const i = all.findIndex(([s, qi]) => s === HS.sid && qi === HS.qi), [s, qi] = all[(i + dir + all.length) % all.length];
  hSet(s, qi);
}
function hInit() {
  $('hSet').innerHTML = R7.HUNT.map(sid => `<button type="button" data-sid="${sid}">${esc(R7.SETS[sid].title)} <small>${esc(R7.SETS[sid].label)}</small></button>`).join('');
  $('hunt').addEventListener('click', e => {
    const t = e.target.closest('[data-tap]');
    if (t && !e.target.closest('[data-say]')) { const [d, s] = t.dataset.tap.split(':').map(Number); hTap(d, s); return; }
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-say')) return;
    if (b.dataset.sid) hSet(b.dataset.sid);
    else if (b.dataset.qi != null) hSet(HS.sid, +b.dataset.qi);
    else if (b.dataset.k != null) hPick(+b.dataset.k);
    else if (b.id === 'hHint') { HS.hint = Math.min(2, HS.hint + 1); hRender(); }
    else if (b.id === 'hReset') hSet(HS.sid, HS.qi);
  });
  $('hunt').addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target.closest && e.target.closest('[data-tap]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const [d, s] = t.dataset.tap.split(':').map(Number); hTap(d, s); return; }
    if (e.target.closest && e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
    const k = e.key, n = 'abcd'.indexOf(k.toLowerCase());
    if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); hStep(k === 'ArrowRight' ? 1 : -1); }
    else if (k === 'h' || k === 'H') { e.preventDefault(); HS.hint = Math.min(2, HS.hint + 1); hRender(); }
    else if (k === '0') { e.preventDefault(); hSet(HS.sid, HS.qi); }
    else if (n >= 0) { e.preventDefault(); hPick(n); }
  });
  window.addEventListener('resize', () => { const q = hq(), evs = R7.evOf(q); if (evs.every(e => HS.found.has(`${e.d || 0}:${e.s}`)) || HS.pick != null) drawLinks($('hText'), R7.steps(q)[1].links); });
  hRender();
}

/* =========================================================
   8. 연습 문제 — 세트 다섯 · 문제 열여섯 (EN.drill과 같은 모양 · 같은 키보드)
   ========================================================= */
function passageDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0 })), cur = 0, retry = null;
  root.classList.add('edr', 'pdr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const sidx = sid => R7.DRILL.indexOf(sid);
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
      const s = st[i], c = s.pick === null ? '' : s.pick === it.a ? ' ok' : ' no', sep = i && items[i - 1].sid !== it.sid ? '<li class="sep" aria-hidden="true"></li>' : '';
      return `${sep}<li><button type="button" data-go="${i}" class="${c}${i === cur ? ' cur' : ''}" aria-label="세트 ${sidx(it.sid) + 1}의 문제 ${i + 1}${s.pick === null ? '' : s.pick === it.a ? ' 정답' : ' 오답'}"${i === cur ? ' aria-current="step"' : ''}>${i + 1}</button></li>`;
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
    const it = items[cur], s = st[cur], answered = s.pick !== null, right = s.pick === it.a, q = it.q, Sset = q.S;
    // 힌트 단계의 표시 모으기
    const ucls = {}, umk = {}, qm = [], om = {}; let links = [], insN = null;
    it.steps.slice(0, s.hints).forEach(stp => {
      (stp.marks || []).forEach(m => {
        const key = `${m.d}:${m.s}`;
        if (!m.t) { if (m.role === 'ev') ucls[key] = 'ev'; else if (!ucls[key]) ucls[key] = m.role === 'key' ? 'keyu' : ''; return; }
        (umk[key] = umk[key] || []).push({ t: m.t, role: m.role });
      });
      (stp.qmarks || []).forEach(m => qm.push(m));
      Object.entries(stp.omarks || {}).forEach(([k, ms]) => (om[k] = om[k] || []).push(...ms.filter(x => !x.word || q.opts[k].rel === 'same')));
      if (stp.links && stp.links.length) links = stp.links;
      if (stp.ins) insN = stp.ins;
    });
    const pItems = items.map((x, i) => [x, i]).filter(([x]) => x.sid === it.sid);
    const first = pItems[0][1] + 1, last = pItems[pItems.length - 1][1] + 1;
    const text = `<div class="pset" lang="en">${Sset.D.map((_, d) => docHTML(Sset, d, {
      num: Sset.D.length > 1, col: q.type === 'form' && s.hints >= 2 ? q.col : null,
      cls: s2 => ucls[`${d}:${s2}`] || '', marks: s2 => umk[`${d}:${s2}`] || [],
      ins: insN && q.type === 'insert' ? { [insN]: { text: q.sent, cls: 'ok' } } : null,
    })).join('')}<svg class="links" aria-hidden="true"></svg></div>`;
    const o = retry ? order() : null;
    let html = dots() + `<div class="edr-card${answered ? (right ? ' ok' : ' no') : ''}">
      <p class="edr-meta"><span>${retry ? `다시 풀기 ${o.indexOf(cur) + 1} / ${o.length}` : `세트 ${sidx(it.sid) + 1} / 5 · ${esc(Sset.label)} · 문제 ${cur + 1} / ${items.length}`}</span>${answered ? `<span class="edr-tag">${esc(it.tag)}</span>` : ''}</p>
      <p class="pdr-dir" lang="en">Questions ${first}–${last} refer to the following ${Sset.en}.</p>
      ${text}
      <p class="pdr-q"><span class="pdr-n">${cur + 1}.</span> ${qHTML(q, qm)} ${sayBtn(q.q, '질문 듣기')}</p>
      ${q.sent ? `<p class="pdr-ins" lang="en">“${markText(q.sent, s.hints >= 1 ? [{ t: q.ptr.t, role: 'key' }] : [])}”</p>` : ''}
      <div class="edr-opts col" role="group" aria-label="보기">${it.opts.map((op, k) => {
        const cls = answered ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
        return `<button type="button" data-pick="${k}" class="${cls}"${answered ? ' disabled' : ''}><b>(${L4[k]})</b> <span lang="en">${markText(op, om[k] || [])}</span></button>`;
      }).join('')}</div>`;
    if (!answered) html += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= it.steps.length ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / ${it.steps.length}</small></button><span class="edr-keys">키보드: A~D 고르기 · H 힌트</span></div>`;
    if (s.hints) html += `<ol class="edr-steps">${it.steps.slice(0, s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('')}</ol>`;
    if (answered) {
      html += `<p class="edr-verdict"><b>${right ? '정답!' : `아쉬워요. 정답은 (${L4[it.a]}).`}</b></p>`;
      html += `<ul class="edr-notes">${it.notes.map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L4[k]}) <span lang="en">${esc(it.opts[k])}</span></b> ${q.opts[k].ko && q.type !== 'insert' ? `<span class="okk">${esc(q.opts[k].ko)}</span> ` : ''}${esc(t)}</li>`).join('')}</ul>`;
      const evs = R7.evOf(q);
      html += `<div class="pdr-ko"><p>${sayBtn(q.q, '질문 듣기')}<span><b>질문</b> ${esc(q.ko || '')}</span></p>${q.sent ? `<p>${sayBtn(q.sent, '넣을 문장 듣기')}<span><b>넣을 문장</b> ${esc(q.sentKo)}</span></p>` : ''}${evs.map(e => { const en = R7.unitText(Sset, e.d || 0, e.s).replace(/ \| /g, ' · '), ko = Sset.D[e.d || 0].ko[e.s]; return `<p>${sayBtn(en.replace(/ · /g, ', '))}<span><b>근거</b> <span lang="en" class="en">${esc(en)}</span> ${esc(ko || '')}</span></p>`; }).join('')}</div>`;
      const pdone = pItems.every(([, i]) => st[i].pick !== null);
      if (pdone) html += `<details class="pdr-gloss"><summary>지문 전체 해석 · 듣기</summary>${Sset.D.map((Dc, d) => { const U = R7.units(Dc); const insQ = Sset.qs.find(x => x.type === 'insert'); const full = U.map((u, i) => u.type === 'mark' ? (insQ && insQ.opts[insQ.a].n === u.n ? insQ.sent : '') : u.type === 'msg' ? `${u.who}: ${u.text}` : u.type === 'row' ? u.cells.join(', ') : u.text).filter(Boolean); return `<h4>${Sset.D.length > 1 ? `${d + 1} · ` : ''}${esc(Dc.label)} ${sayBtn(full.join(' '), '글 전체 듣기')}</h4><ol>${U.map((u, i) => { if (u.type === 'mark') return insQ && insQ.opts[insQ.a].n === u.n ? `<li><span lang="en" class="en">${sayBtn(insQ.sent)}${esc(insQ.sent)}</span><span>${esc(insQ.sentKo)} (넣은 문장)</span></li>` : ''; const en = u.type === 'msg' ? `${u.who} (${u.time}): ${u.text}` : u.type === 'row' ? u.cells.join(' · ') : u.text; return `<li><span lang="en" class="en">${sayBtn(u.type === 'row' ? u.cells.join(', ') : u.text)}${esc(en)}</span><span>${esc(Dc.ko[i])}</span></li>`; }).join('')}</ol>`; }).join('')}</details>`;
      html += `<div class="edr-acts"><button type="button" class="edr-btn edr-next" data-act="next">${done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button></div>`;
    }
    root.innerHTML = html + '</div>';
    requestAnimationFrame(() => drawLinks(root, links));
    LINKS = links;
  }
  let LINKS = [];
  window.addEventListener('resize', () => { if (cur >= 0) drawLinks(root, LINKS); });
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
const QCOL = { bg: '#10151C', text: '#EEF1F4', soft: '#C9D1DA', muted: '#94A0AE', ev: '#C9A7FF', key: '#6EC8FF', trap: '#FF9F7A', ok: '#7FE0A8', bad: '#FF8E8E', hover: '#2A3644', acc: '#FFC15E', gap: '#FF7AA8', panel: '#18202A' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
function qwrap(g, s, x, y, maxW, lh) {
  const words = s.split(' '), lines = [''];
  words.forEach(w => { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (g.measureText(t).width > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; });
  lines.forEach((l, i) => g.fillText(l, x, y + i * lh));
  return lines.length;
}
// 그림 문제 1: 이메일의 목적이 드러난 문장 누르기
const QP = R7.Q.qPurp, QP_D = R7.DOCS.qPurp;
const FIG_PURP = (() => {
  const box = k => ({ x: 16, y: 14 + k * 50, w: 568, h: 44 });
  return {
    width: 600, height: 216, label: '이메일 문장 넷: ' + QP_D.sents.map((s, k) => `${L4[k]} ${s}`).join(' '),
    pick: (x, y) => [0, 1, 2, 3].findIndex(k => { const b = box(k); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 216); g.textBaseline = 'middle';
      QP_D.sents.forEach((s, k) => {
        const b = box(k), on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, b.x, b.y, b.w, b.h, 9);
        g.fillStyle = on ? 'rgba(201,167,255,0.18)' : wrong ? 'rgba(255,142,142,0.16)' : st.hover === k ? QCOL.hover : QCOL.panel; g.fill();
        g.strokeStyle = on ? QCOL.ev : 'rgba(238,241,244,0.14)'; g.lineWidth = on ? 2.4 : 1.3; g.stroke();
        g.font = qfont(13, 700); g.fillStyle = QCOL.acc; g.textAlign = 'left'; g.fillText(L4[k], b.x + 10, b.y + b.h / 2);
        g.font = qfont(15, 500); g.fillStyle = QCOL.text; g.fillText(s, b.x + 30, b.y + b.h / 2);
        if (on) { g.font = qfont(11, 700); g.fillStyle = QCOL.ev; g.textAlign = 'right'; g.fillText('근거 · I am writing to', b.x + b.w - 8, b.y + 10); }
      });
    },
  };
})();
// 그림 문제 2: 표에서 필요한 칸 누르기
const QC = R7.Q.qCell, QC_D = R7.DOCS.qCell;
const FIG_CELL = (() => {
  const X = [20, 190, 370, 580], Y0 = 54, RH = 44;
  const cellOf = k => { const x = QC.opts[k]; const r = x.src ? x.src.s : QC.ev[0].s, v = x.src ? x.src.t : QC.ev[0].t, c = QC_D.rows[r].indexOf(v); return { r, c, x: X[c], y: Y0 + (r + 1) * RH, w: X[c + 1] - X[c], h: RH }; };
  return {
    width: 600, height: 262, label: '배송 방법 표: ' + QC_D.rows.map(r => r.join(' · ')).join(' / '),
    pick: (x, y) => [0, 1, 2, 3].findIndex(k => { const b = cellOf(k); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 262); g.textBaseline = 'middle';
      g.font = qfont(14, 700); g.fillStyle = QCOL.soft; g.textAlign = 'left'; g.fillText(QC_D.head[0], 20, 26);
      rrq(g, X[0], Y0, X[3] - X[0], RH, 6); g.fillStyle = '#202A36'; g.fill();
      QC_D.cols.forEach((c, i) => { g.font = qfont(14, 700); g.fillStyle = QCOL.soft; g.fillText(c, X[i] + 12, Y0 + RH / 2); });
      const pickCells = [0, 1, 2, 3].map(cellOf);
      QC_D.rows.forEach((row, r) => row.forEach((v, c) => {
        const y = Y0 + (r + 1) * RH, k = pickCells.findIndex(p => p.r === r && p.c === c), on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        rrq(g, X[c] + 2, y + 2, X[c + 1] - X[c] - 4, RH - 4, 5);
        g.fillStyle = on ? 'rgba(127,224,168,0.2)' : wrong ? 'rgba(255,142,142,0.18)' : k >= 0 && st.hover === k ? QCOL.hover : QCOL.panel; g.fill();
        g.strokeStyle = on ? QCOL.ok : k >= 0 ? 'rgba(238,241,244,0.22)' : 'rgba(238,241,244,0.08)'; g.lineWidth = on ? 2.2 : 1; g.stroke();
        g.font = qfont(15, k >= 0 ? 600 : 500); g.fillStyle = k >= 0 ? QCOL.text : QCOL.muted; g.fillText(v, X[c] + 12, y + RH / 2);
        if (k >= 0 && !st.done) { g.font = qfont(11, 700); g.fillStyle = QCOL.acc; g.textAlign = 'right'; g.fillText(L4[k], X[c + 1] - 8, y + 12); g.textAlign = 'left'; }
      }));
      if (st.done) { g.font = qfont(12, 700); g.fillStyle = QCOL.ok; g.textAlign = 'left'; g.fillText('Express 줄 × Fee 칸 → $25', 20, 248); }
    },
  };
})();
// 그림 문제 3: 문장이 들어갈 자리 고르기 ([1]~[4])
const QI = R7.Q.qIns, QI_D = R7.DOCS.qIns;
const FIG_INS = (() => {
  const sents = R7.units(QI_D).filter(u => u.type === 'sent').map(u => u.text);
  const chipB = k => ({ x: 528, y: 76 + k * 34 - 13, w: 52, h: 26 });
  return {
    width: 600, height: 222, label: `넣을 문장: ${QI.sent} 글: ${sents.map((s, k) => `${s} [${k + 1}]`).join(' ')}`,
    pick: (x, y) => [0, 1, 2, 3].findIndex(k => { const b = chipB(k); return x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4; }),
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, 600, 222); g.textBaseline = 'middle';
      rrq(g, 14, 10, 572, 40, 9); g.fillStyle = 'rgba(255,193,94,0.12)'; g.fill(); g.strokeStyle = QCOL.acc; g.lineWidth = 1.5; g.stroke();
      g.font = qfont(14, 600); g.fillStyle = QCOL.text; g.textAlign = 'left'; g.fillText(QI.sent, 26, 30);
      sents.forEach((s, k) => {
        const y = 76 + k * 34, on = st.done && k === st.answer, wrong = st.done && k === st.pick && k !== st.answer;
        g.font = qfont(14, 500); g.fillStyle = st.done && k === st.answer ? QCOL.ev : QCOL.soft; g.textAlign = 'left'; g.fillText(s, 20, y);
        const b = chipB(k);
        rrq(g, b.x, b.y, b.w, b.h, 7); g.fillStyle = on ? 'rgba(127,224,168,0.2)' : wrong ? 'rgba(255,142,142,0.2)' : st.hover === k ? QCOL.hover : 'rgba(255,122,168,0.10)'; g.fill();
        g.setLineDash(on ? [] : [4, 3]); g.strokeStyle = on ? QCOL.ok : QCOL.gap; g.lineWidth = 1.6; g.stroke(); g.setLineDash([]);
        g.font = qfont(13, 700); g.fillStyle = on ? QCOL.ok : QCOL.gap; g.textAlign = 'center'; g.fillText(`[${k + 1}]`, b.x + b.w / 2, b.y + b.h / 2 + 1);
      });
      if (st.done) { g.font = qfont(12, 700); g.fillStyle = QCOL.ev; g.textAlign = 'left'; g.fillText('This offer → free coffee (바로 앞 문장)', 20, 210); }
    },
  };
})();
const QS = (() => {
  const eng = id => { const q = R7.Q[id]; return { opts: q.opts.map(x => x.t), a: R7.answer(q)[0] }; };
  const why = id => { const q = R7.Q[id], a = R7.answer(q)[0]; return R7.judge(q, a).why + ' ' + q.opts.map((x, k) => k === a ? '' : `(${L4[k]}) ${R7.judge(q, k).name}`).filter(Boolean).join(', ') + '.'; };
  const q = [
    { q: '토익 읽기 100문제 가운데 Part 7(독해)은 몇 문제인가요?', opts: ['16문제', '30문제', '54문제', '100문제'], a: 2,
      why: 'Part 5가 30문제, Part 6이 16문제, Part 7이 54문제예요. 읽기 시간 75분의 절반 넘게 Part 7에 써야 해서, 질문을 먼저 읽고 필요한 곳만 찾아 읽어요.' },
    Object.assign({ q: '지문: “Admission is free for children under 12.” 이 문장과 같은 뜻의 보기는?', why: why('qAdm'), check: () => R7.answer(R7.Q.qAdm)[0] === 1 }, eng('qAdm')),
    { q: '이메일의 목적이 드러난 문장은? 문장을 누르거나 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], a: QP.ev[0].s, figure: FIG_PURP,
      why: 'B → I am writing to ask if you would speak … 목적을 밝히는 신호(I am writing to)가 있어요. A는 인사, C는 장소, D는 마감이에요.', check: () => QP.ev[0].s === 1 && R7.isOk(QP, 1) },
    Object.assign({ q: '“… Before then, please return the signed contract to the HR office.” — What is Ms. Ito asked to do?', why: why('qReq'), check: () => R7.answer(R7.Q.qReq)[0] === 3 }, eng('qReq')),
    { q: 'How much does Express delivery cost? 표에서 답이 있는 칸을 누르거나 단추를 고르세요.', opts: QC.opts.map(x => x.t), a: R7.answer(QC)[0], figure: FIG_CELL,
      why: '표는 다 읽지 않아요. Express 줄과 Fee 칸이 만나는 곳 → $25. Free · $45 → 다른 줄, 2 days → 같은 줄의 다른 칸이에요.', check: () => R7.answer(QC)[0] === 1 },
    { q: 'NOT 문제(What is NOT mentioned …?)를 푸는 방법으로 알맞은 것은?', opts: ['보기 넷을 하나씩 지문과 맞춰 보고, 지문에서 찾을 수 없는 보기를 골라요.', '지문에 그대로 나온 낱말이 있는 보기를 골라요.', '지문의 첫 문장과 같은 뜻의 보기를 골라요.', '지문을 다 읽지 않고 가장 짧은 보기를 골라요.'], a: 0,
      why: 'NOT 문제는 보기 셋이 지문에 있어요(바꿔 말해 있을 때도). 하나씩 근거를 찾아 지우고, 끝까지 못 찾은 하나가 답이에요.', check: () => R7.Q.lib2.opts.filter(x => x.rel === 'stated').length === 3 },
    Object.assign({ q: '“We need to address the problem quickly.” 이 문장의 address와 뜻이 가장 가까운 말은?', why: why('qSyn'), check: () => R7.answer(R7.Q.qSyn)[0] === 2 }, eng('qSyn')),
    Object.assign({ q: '문자: David Lee (9:02 A.M.) “Can you cover my shift on Friday? I have a dentist appointment.” — Ana Ruiz (9:03 A.M.) “No problem.” 9시 3분에 루이스 씨가 쓴 뜻은?', why: why('qChat'), check: () => R7.answer(R7.Q.qChat)[0] === 0 }, eng('qChat')),
    { q: '노란 상자의 문장이 들어갈 자리는? [1]~[4]를 누르거나 단추를 고르세요.', opts: ['[1]', '[2]', '[3]', '[4]'], a: R7.answer(QI)[0], figure: FIG_INS,
      why: 'This offer → 바로 앞의 we will offer free coffee를 가리켜요. 무료 커피 문장 바로 뒤인 [3]이 자리예요.', check: () => R7.answer(QI)[0] === 2 },
    Object.assign({ q: '광고: “Free delivery on all orders over $50.” 이메일: “My order comes to $45.” — What is suggested about the customer’s order?', why: why('qLink'), check: () => R7.answer(R7.Q.qLink)[0] === 3 }, eng('qLink')),
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[Part 7] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => pos[x.a]++);
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[Part 7] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
  if (q.filter(x => x.figure).length < 2) console.warn('[Part 7] 그림 문제가 둘보다 적어요.');
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
  const ci = RV.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * RV.W, (e.clientY - r.top) / r.height * RV.H]; };
const hitAt = (x, y) => started ? RV.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
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
hInit();
passageDrill($('drillRoot'), R7.drillItems(), {
  before() { if (playing) pause(); },
  done: (ok, total) => ok === total ? '모두 맞혔어요! 질문 → 근거 → 바꿔 말하기가 손에 익었네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보세요.' : '영상 08~10장을 다시 보고, 틀린 문제를 힌트와 함께 풀어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? 'Part 7의 원리를 모두 이해했네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(RV.baseText()).then(() => { dirty = true; });
setTimeout(() => RV.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
