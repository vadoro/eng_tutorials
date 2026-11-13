/* 입을 얼마나 벌리나 — æ · ɛ · ʌ · ɑ: 플레이어, 직접 해 보기, 듣고 가르기 훈련, 내 발음 확인, 내 모음 찍기, 따라 말하기, 듣고 고르기, 퀴즈, 영상 추출
 * 센 음절의 모음 · 짝 · 한국어식 · 외래어 함정 · 칠할 글자는 grammar.js(OV), 그림은 scenes.js(OVS)와 공통 부품 EN.mouth, 목소리와 잰 값은 voices.js(OVV)가 맡습니다.
 * 소리가 겹치지 않게: 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(OVV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const OV = window.OV, OVS = window.OVS, OVV = window.OVV, S = OVS.S, M = EN.mouth;
const { CHAPTERS, CAPTIONS, END, POSTER } = OVS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L2 = 'AB';
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const cv = $('cv'), ctx = cv.getContext('2d');
OV.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = OVS.fonts;
const FONT_SET = [[700, F.FD], [800, F.FD], [400, F.FB], [500, F.FB], [600, F.FB], [700, F.FB], [800, F.FB], [400, F.FM], [500, F.FM], [600, F.FM], [700, F.FM], [800, F.FM]];
const loadFonts = text => Promise.race([
  Promise.all(FONT_SET.map(([w, f]) => document.fonts.load(`${w} 20px ${f}`, text).catch(() => null))),
  new Promise(r => setTimeout(r, 15000)),
]).then(() => document.fonts.ready);

/* =========================================================
   2. 영상 추출 — 사이트 공통 렌더러가 쓰는 약속
   ========================================================= */
if (EXPORT) {
  cv.width = 1920; cv.height = 1080;
  const ready = new Promise(res => OVS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '입을 얼마나 벌리나 — æ · ɛ · ʌ · ɑ — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { OVS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
const SVG_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
const ICO = {
  play: '<svg data-k="play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>',
  stop: '<svg data-k="stop" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  slow: '<svg data-k="slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 3h5"/></svg>',
  mic: OVS.iconSVG('mic'),
  rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="currentColor"/></svg>',
};
// 듣기 · 천천히 단추 묶음 (회화 영역의 듣기 연습 문제와 같은 모양 · 같은 키 R · S)
const lsnBar = () => OVV.supported
  ? `<div class="lsn"><button type="button" class="lbtn say" data-act="play" aria-pressed="false">${ICO.play}<span>듣기</span><small>R</small></button><button type="button" class="lbtn say" data-act="slowplay" aria-pressed="false">${ICO.slow}<span>천천히</span><small>S</small></button><span class="ldr-now" aria-live="polite"></span></div>`
  : '<p class="ldr-nosay">이 브라우저는 음성을 쓸 수 없어 낱말을 글로 보여 줘요.</p>';
function paintPlay(box, mode) {
  box.querySelectorAll('.lbtn.say').forEach(b => {
    const on = mode === b.dataset.act, k = on ? 'stop' : b.dataset.act === 'slowplay' ? 'slow' : 'play';
    b.setAttribute('aria-pressed', String(on));
    const lab = b.querySelector('span'); if (lab) lab.textContent = on ? '멈추기' : b.dataset.act === 'slowplay' ? '천천히' : '듣기';
    const ic = b.querySelector('svg'); if (ic && ic.dataset.k !== k) ic.outerHTML = ICO[k];
  });
}
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
  const cap = started ? OVS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 낱말과 모음 지도를 누르면 그 소리를 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = OVS.chapterAt(T);
  if (ci !== lastChap) { lastChap = ci; document.querySelectorAll('.chap').forEach((b, i) => b.setAttribute('aria-current', String(i === ci))); buildLab(ci); }
}
function play() {
  if (T >= END - 0.01) T = 0;
  stopSounds();
  playing = true; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}
function pause() { playing = false; NARR.reset(); syncUI(); dirty = true; }
function seek(t) { T = clamp(t, 0, END); started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true; }
let idleT = 0;
function loop(ts) {
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
  if (playing) {
    T = NARR.hold(T, T + dt * speed);
    if (T >= END) { T = END; playing = false; NARR.reset(); }
    syncUI(); NARR.sync(T, playing); dirty = true;
  }
  if (dirty) { dirty = false; OVS.render(ctx, started ? T : POSTER, { idle: idleT }); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
// 직접 해 보기에서 고르면: 영상을 멈추고 그 장의 u초 장면을 보여 줌
function showAt(u) {
  const ch = CHAPTERS[OVS.chapterAt(T)];
  if (playing) pause();
  T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}

/* =========================================================
   4. 소리 — 목소리 넷 + 한국어식으로 읽기 (voices.js). 읽기 전에 다른 소리는 모두 멈춤
   ========================================================= */
let audioEl = null;                       // 녹음 재생
function stopAudio() { if (audioEl) { try { audioEl.pause(); } catch (e) { /* 이미 멈춤 */ } audioEl = null; } document.querySelectorAll('.sh-play.saying').forEach(b => b.classList.remove('saying')); }
function stopSounds() { EN.say.stop(); OVV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return OVV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름. 같은 단추를 곧바로 다시 누르면 천천히
let lastLp = { b: null, at: 0 };
const lpBtn = (seq, label, cls = '', inner) => OVV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${inner || SVG_PLAY}</button>` : '';
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-lp]');
  if (!b) return;
  const box = b.closest('[data-slow]'), again = lastLp.b === b && performance.now() - lastLp.at < 4000;
  const slow = again || (!!box && box.getAttribute('data-slow') === '1');
  lastLp = { b, at: performance.now() };
  document.querySelectorAll('.lp-play.saying, .wbtn.saying').forEach(x => x.classList.remove('saying'));
  b.classList.add('saying');
  speak(SEQS[+b.dataset.lp], { slow, onend() { b.classList.remove('saying'); } });
});
const wSeq = (k, sp = 'tc') => [{ text: OV.word(k), sp }];
const tSeq = (text, sp = 'tc') => [{ text, sp }];
const pairSeq = (a, b, sp = 'tc') => [{ text: OV.word(a), sp }, { text: OV.word(b), sp, gap: 0.7 }];
const koSeq = k => [{ text: OV.entry(k).ko, sp: 'ko' }];
const WHO = { tc: '밝은 선생님', tf: '차분한 선생님', uf: '미국 여성', um: '미국 남성', ko: '한국어식' };

/* =========================================================
   5. 글 칠하기 — 센 음절의 목표 모음 글자: 크게 벌린 모음(mk-a 노랑) · 덜 벌린 모음(mk-b 하늘), 한국어식(mk-trap 주황)
   ========================================================= */
const roleCls = r => r === 'a' ? 'mk-a' : 'mk-b';
function wordHTML(k, o = {}) {
  const e = OV.entry(k); if (!e) return `<span lang="en">${esc(k)}</span>`;
  return `<span lang="en">${OV.spellSegs(k).map(p => p.role && o.paint !== false ? `<mark class="${roleCls(p.role)}">${esc(p.t)}</mark>` : esc(p.t)).join('')}</span>`;
}
const koHTML = k => { const e = OV.entry(k); return e && e.ko ? `<span class="kow"><mark class="mk-trap">${esc(e.ko)}</mark></span>` : ''; };
const sentHTML = text => '<span lang="en">' + OV.segs(text).map(s => s.role ? `<mark class="${roleCls(s.role)}">${esc(s.t)}</mark>` : esc(s.t)).join('') + '</span>';
const vTag = v => `<span class="vtag ${OV.V[v].open ? 'a' : 'b'}">${esc(OV.V[v].ko)} <i lang="en">${esc(v)}</i></span>`;
// 낱말 단추: 누르면 들려줌(곧바로 다시 누르면 천천히)
const wBtn = (k, sp = 'tc', o = {}) => OVV.supported
  ? `<button type="button" class="wbtn${o.cls ? ' ' + o.cls : ''}" data-lp="${seqId(wSeq(k, sp))}" title="듣기: ${esc(OV.word(k))}${sp !== 'tc' ? ' · ' + WHO[sp] : ''}">${SVG_PLAY}${wordHTML(k, o)}</button>`
  : `<span class="wbtn off">${wordHTML(k, o)}</span>`;
const koBtn = k => OVV.supported ? `<button type="button" class="wbtn ko" data-lp="${seqId(koSeq(k))}" title="한국어식으로 듣기: ${esc(OV.entry(k).ko)}">${SVG_PLAY}${koHTML(k)}</button>` : `<span class="wbtn off ko">${koHTML(k)}</span>`;
// 모음 지도 (SVG): 잰 F1 · F2가 있으면 그 목소리의 bat · bet · but · bot으로 잡은 범위에(OVS.mapRange), 없으면 그림 자리. 화살표 = 덜 벌린 → 크게 벌린
// 낱말 묶음 가운데 이 목소리에서 확인을 통과한(잰 값이 있는) 낱말 — 하나만 빠졌으면 그것을 빼고, 아니면(잰 값 파일이 없으면) 모두
const okWords = (ws, sp) => { const m = ws.filter(k => OVS.fOf(k, sp)); return ws.length >= 3 && m.length >= ws.length - 1 ? m : ws; };
const NUM = { 2: '둘', 3: '셋', 4: '넷' };
function vmapSVG(words, sp = 'tc', o = {}) {
  const Wd = o.w || 260, Hh = o.h || 176, P = 30, x = P, y = 24, w = Wd - 2 * P, h = Hh - y - 30;
  const Fs = words.map(k => OVS.fOf(k, sp)), nF = Fs.filter(Boolean).length;
  // o.partial: 셋 이상인 낱말 묶음에서 하나만 못 재었으면 잰 점만 찍고(잰 값과 그림 자리를 섞지 않음) 빠진 낱말을 아래에 적어요
  const part = o.partial && words.length >= 3 && nF >= words.length - 1 && nF < words.length, measured = part || Fs.every(Boolean), miss = part ? words.filter((k, i) => !Fs[i]) : [];
  const box = { x, y, w, h, R: measured ? OVS.mapRange(sp, Fs) : null };
  const pts = words.map((k, i) => ({ k, v: OV.vowel(k), F: Fs[i], xy: OVS.mapXY(box, Fs[i], OV.vowel(k)) })).filter(p => !miss.includes(p.k));
  let s = `<path class="vm-box" d="M${x} ${y}H${x + w}V${y + h}H${(x + w * 0.32).toFixed(1)}Z"/>`;
  s += `<text class="vm-ax" x="${x}" y="${y - 8}">앞</text><text class="vm-ax" x="${x + w}" y="${y - 8}" text-anchor="end">뒤</text>`;
  s += `<text class="vm-ax" x="${x - 6}" y="${y + 10}" text-anchor="end">↑</text><text class="vm-ax" x="${x - 6}" y="${y + h}" text-anchor="end">↓</text>`;
  pts.forEach(p => {
    if (!OV.V[p.v] || OV.V[p.v].open) return;
    const q = pts.find(z => z.v === OV.V[p.v].mate); if (!q) return;
    const [x0, y0] = p.xy, [x1, y1] = q.xy, L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    if (L > 22) s += `<line class="vm-arr" x1="${(x0 + ux * 9).toFixed(1)}" y1="${(y0 + uy * 9).toFixed(1)}" x2="${(x1 - ux * 11).toFixed(1)}" y2="${(y1 - uy * 11).toFixed(1)}" marker-end="url(#vmh)"/>`;
  });
  pts.forEach(p => {
    const c = OV.V[p.v] && OV.V[p.v].open ? 'a' : 'b', lab = o.labels === 'ipa' ? p.v : OV.word(p.k);
    s += `<circle class="vm-pt ${c}" cx="${p.xy[0].toFixed(1)}" cy="${p.xy[1].toFixed(1)}" r="7"><title>${esc(OV.word(p.k))}${p.F ? ` — F1 ${p.F[0]} · F2 ${p.F[1]}Hz` : ''}</title></circle>`;
    s += `<text class="vm-lb ${c}" x="${p.xy[0].toFixed(1)}" y="${(p.xy[1] + (c === 'a' ? 21 : -12)).toFixed(1)}" text-anchor="middle">${esc(lab)}</text>`;
  });
  const note = measured ? `${WHO[sp]} 목소리를 잰 값${miss.length ? ` · ${miss.map(OV.word).join(' · ')} 없음` : ''}` : '그림 자리(어림)';
  s += `<text class="vm-note" x="${Wd / 2}" y="${Hh - 6}" text-anchor="middle">${esc(note)}</text>`;
  const lab = `모음 지도 — ${words.map(k => `${OV.word(k)} ${OV.V[OV.vowel(k)].ko}`).join(', ')}. ${note}. 왼쪽이 혀의 앞, 위가 혀가 높은 쪽`;
  return `<svg class="vm" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="${esc(lab)}"><defs><marker id="vmh" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="vm-head"/></marker></defs>${s}</svg>`;
}
// 모음 길이 막대: 같은 목소리로 잰 값(vd ms) — 없으면 그리지 않음
function vbarsHTML(words, sp = 'tc') {
  if (!words.every(k => OVS.vdOf(k, sp))) return '';
  return `<div class="vbars">${words.map(k => {
    const ms = OVS.vdOf(k, sp), c = OV.isOpen(k) ? 'a' : 'b';
    return `<div class="vb ${c}">${wBtn(k, sp)}<span class="vb-bar" aria-hidden="true"><i style="width:${Math.min(100, ms / 3.6).toFixed(0)}%"></i></span><small>${Math.round(ms)}ms</small></div>`;
  }).join('')}</div>`;
}
// 짝 하나: 크게 벌린 · 덜 벌린 낱말
const pairBox = (p, sp = 'tc') => `<div class="pairbox">${[p.a, p.b].map(k => `<div class="pb ${OV.isOpen(k) ? 'a' : 'b'}"><span class="pb-h">${vTag(OV.vowel(k))}</span>${wBtn(k, sp)}<small>${esc(OV.ipa(k))} · ${esc(OV.entry(k).gloss)}</small></div>`).join('')}</div>`;
const voices4 = (seqOf, label) => `<div class="voices4"><span>${esc(label)}</span>${OV.VOICES.map(v => lpBtn(seqOf(v.sp), v.ko, 'lp-voice', `${ICO.play}<span>${esc(v.ko)}</span>`)).join('')}</div>`;

/* =========================================================
   6. 듣고 고르기 (이 튜토리얼 전용, 회화 영역의 듣기 연습 문제와 같은 .edr 모양) — 소리 먼저, 글은 답한 뒤
   키보드: A · B 또는 1 · 2 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · Enter/→ 다음
   ========================================================= */
const KIND_KO = { word: '어느 낱말?', sent: '문장 속 어느 낱말?', same: '같았나요?', vowel: '센 음절의 모음은?' };
const SIT = {
  word: '낱말 하나를 들려줘요. 턱을 크게 내린 소리인가요, 조금만 벌린 소리인가요?',
  sent: '문장 하나를 들려줘요. 빈칸에 들어간 낱말은?',
  same: '낱말 둘을 이어서 들려줘요. 같은 낱말을 두 번 말했나요, 다른 낱말인가요?',
  vowel: '외래어로도 쓰는 낱말 하나를 들려줘요. 센 음절의 모음은 어느 쪽인가요?',
};
const drillSeq = q => q.kind === 'same' ? pairSeq(q.say[0], q.say[1], q.sp) : q.kind === 'sent' ? tSeq(q.say, q.sp) : wSeq(q.say, q.sp);
function PDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0 }));
  let cur = 0, retry = null, mode = null;
  const hear = OVV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && OVV.busy()) { OVV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(drillSeq(it), { slow: !!slow, onitem() { say(`${WHO[it.sp]} · 말하는 중`); }, onend(stopped) { mode = null; paintPlay(root, null); say(stopped ? '' : '다 들었어요. 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { OVV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; OVV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    OVV.stop();
    s.pick = k; s.hints = 3; render();
    const f = root.querySelector('.edr-next'); if (f) f.focus({ preventScroll: true });
  }
  function hint() { const s = st[cur]; if (s.pick !== null || s.hints >= 3) return; s.hints++; render(); }
  function dots() {
    return '<ol class="edr-dots" aria-label="문제 목록">' + items.map((it, i) => {
      const s = st[i], c = s.pick === null ? '' : s.pick === it.a ? ' ok' : ' no';
      return `<li><button type="button" data-go="${i}" class="${c}${i === cur ? ' cur' : ''}" aria-label="문제 ${i + 1}${s.pick === null ? '' : s.pick === it.a ? ' 정답' : ' 오답'}"${i === cur ? ' aria-current="step"' : ''}>${i + 1}</button></li>`;
    }).join('') + '</ol>';
  }
  const vname = k => OV.V[OV.vowel(k)].ko;
  // 보기마다 엔진의 까닭
  function notes(it) {
    if (it.kind === 'vowel') {
      const real = OV.vowel(it.say), e = OV.entry(it.say), syl = OV.syls(it.say)[OV.stressAt(it.say)].sp;
      return it.vopts.map(v => v === real ? `${e.w} ${OV.ipa(it.say)} → 센 음절 = ${syl}, 모음 = ${OV.V[v].ko}. 한글 표기(${e.ko})의 모음을 믿지 마세요.` : `아니에요 — ${e.w} → 센 음절의 모음이 ${OV.V[real].ko}예요.`);
    }
    if (it.kind === 'same') {
      const [a, b] = it.say, same = OV.word(a) === OV.word(b);
      return it.opts.map((_, k) => k === 0
        ? (same ? `같아요 — 두 번 모두 ${OV.word(a)}(${vname(a)})예요.` : `같지 않아요 — 첫째 ${OV.word(a)} = ${vname(a)}, 둘째 ${OV.word(b)} = ${vname(b)}.`)
        : (same ? `다르지 않아요 — 두 번 모두 ${OV.word(a)}예요. 짝 낱말 ${OV.word(OV.partner(a))} → ${vname(OV.partner(a))}.` : `달라요 — ${OV.word(a)} = ${vname(a)}, ${OV.word(b)} = ${vname(b)}. 한국어식 → ${OV.entry(a).ko} · ${OV.entry(b).ko}.`));
    }
    return it.opts.map(w => `${w} ${OV.ipa(w)} — ${OV.entry(w).gloss}. 센 음절의 모음 = ${vname(w)}.`);
  }
  function optLab(it, op, k) {
    if (it.kind === 'vowel') { const v = it.vopts[k]; return `<span class="ldr-t">${esc(OV.V[v].ko)}</span><small lang="en">${esc(v)}</small>`; }
    if (it.kind === 'same') return `<span class="ldr-t">${esc(op)}</span>`;
    return `<span class="ldr-t">${wordHTML(op)}</span><small>${esc(OV.entry(op).gloss)}</small>`;
  }
  function qLine(it, done) {
    if (it.kind === 'vowel') return `<p class="ldr-q"><span class="ldr-t">${wordHTML(it.say, { paint: done })}</span>${koHTML(it.say)}<small>${esc(OV.entry(it.say).gloss)} · 한글 표기의 모음은 믿지 않기</small></p>`;
    if (it.kind === 'sent') return `<p class="ldr-q"><span class="ldr-t" lang="en">${done ? sentHTML(it.say) : esc(it.frame)}</span><small>${esc(it.ko)}</small></p>`;
    if (!done) return '';
    if (it.kind === 'same') return `<p class="ldr-q"><span class="ldr-t">${wordHTML(it.say[0])} · ${wordHTML(it.say[1])}</span></p>`;
    return `<p class="ldr-q"><span class="ldr-t">${wordHTML(it.say)}</span><small>${esc(OV.entry(it.say).gloss)}</small></p>`;
  }
  function cmp(it) {
    if (it.kind === 'vowel') {
      const row = OV.LROWS.find(r => r.v === OV.vowel(it.say));
      return `<div class="ldr-cmp"><span>같은 줄의 외래어 (${esc(row.ko)})</span>${row.words.map(w => wBtn(w)).join('')}${koBtn(it.say)}</div>`;
    }
    const k = OV.drillWord(it), p = OV.pairOf(k);
    if (!p) return '';
    return `<div class="ldr-cmp"><span>같은 목소리로 견줘 듣기 · 모음 지도</span>${vmapSVG([p.a, p.b], it.sp, { w: 230, h: 160 })}<span class="cmp-w">${wBtn(p.a, it.sp)}${wBtn(p.b, it.sp)}${koBtn(p.a)}</span>${lpBtn(pairSeq(p.a, p.b, it.sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서</span>`)}</div>`;
  }
  function render() { const had = root.contains(document.activeElement); draw(); if (had && !root.contains(document.activeElement)) root.focus({ preventScroll: true }); }
  function draw() {
    const sc = score();
    if (cur < 0) {
      const wrong = items.map((_, i) => i).filter(i => st[i].pick !== items[i].a);
      root.innerHTML = dots() + `<div class="edr-card edr-end"><p class="edr-big">${sc.ok} / ${items.length}</p><p>${esc(cfg.done ? cfg.done(sc.ok, items.length) : '')}</p>
        <div class="edr-acts">${wrong.length ? `<button type="button" class="edr-btn" data-act="retry">틀린 ${wrong.length}문제 다시 풀기</button>` : ''}<button type="button" class="edr-btn ghost" data-act="reset">처음부터 다시</button></div></div>`;
      return;
    }
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = OV.hints(it);
    const o = order(), pos = o.indexOf(cur), n = it.opts.length;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${OVS.iconSVG('ear', 'pi')}${esc(KIND_KO[it.kind])}</span><span>${retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span><span class="edr-tag">${esc(WHO[it.sp])}</span></p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(SIT[it.kind])}</p>`;
    h += lsnBar();
    h += qLine(it, done || !hear);
    h += `<div class="ldr-opts two" role="group" aria-label="보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
      return `<div class="ldr-row${cls}" data-k="${k}"><button type="button" class="ldr-opt big" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L2[k]})</b> ${optLab(it, op, k)}</button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: A · B 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L2[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L2[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      h += cmp(it);
      h += `<div class="edr-acts"><button type="button" class="edr-btn edr-next" data-act="next">${sc.done === items.length || (retry && o.every(i => st[i].pick !== null)) ? '결과 보기' : '다음 문제'} →</button></div>`;
    }
    h += '</div>';
    root.innerHTML = h;
    paintPlay(root, mode);
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !root.contains(b) || b.hasAttribute('data-lp')) return;
    if (b.dataset.go) { retry = null; go(+b.dataset.go, false); return; }
    if (b.dataset.pick) { answer(+b.dataset.pick); return; }
    const act = b.dataset.act;
    if (act === 'play') playLine(false, true);
    else if (act === 'slowplay') playLine(true, true);
    else if (act === 'hint') hint();
    else if (act === 'next') next();
    else if (act === 'retry') { retry = items.map((_, i) => i).filter(i => st[i].pick !== items[i].a); retry.forEach(i => { st[i] = { pick: null, hints: 0 }; }); go(retry[0], true); }
    else if (act === 'reset') { retry = null; st = items.map(() => ({ pick: null, hints: 0 })); go(0, false); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || cur < 0) return;
    const k = e.key.toUpperCase(), i = L2.indexOf(k), d = '12'.indexOf(k);
    if (st[cur].pick === null && (i >= 0 || d >= 0) && k.length === 1) { e.preventDefault(); answer(i >= 0 ? i : d); }
    else if (k === 'H') { e.preventDefault(); hint(); }
    else if (k === 'R' && hear) { e.preventDefault(); playLine(false); }
    else if (k === 'S' && hear) { e.preventDefault(); playLine(true); }
    else if ((e.key === 'ArrowRight' || e.key === 'Enter') && st[cur].pick !== null && !(e.target.closest && e.target.closest('button:not(.edr-next)'))) { e.preventDefault(); next(); }
  });
  render();
  return { go, render, state: () => st };
}

/* =========================================================
   7. 장면별 '직접 해 보기' — 장이 바뀔 때만 다시 만듦
   ========================================================= */
const seg = (name, items, cur, attr) => `<div class="seg" role="group" aria-label="${esc(name)}">${items.map(([v, t]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(String(cur) === String(v))}">${t}</button>`).join('')}</div>`;
const row = (lab, html) => `<div class="cv-row"><span class="cv-lab">${esc(lab)}</span>${html}</div>`;
const labHead = h3 => `<h2>직접 해 보기</h2><div class="lab-top"><h3>${esc(h3)}</h3></div>`;
const clearBtn = '<button class="btn ghost" type="button" id="labClear">영상대로 보기</button>';
const voiceSeg = (cur, attr, blank) => seg('목소리 고르기', (blank ? [['', blank]] : []).concat(OV.VOICES.map(v => [v.sp, v.ko])), cur || '', attr);
const wordPick = (list, cur, attr, o = {}) => `<div class="wrow sel">${list.map(k => `<button type="button" class="pickw${cur === k ? ' on' : ''}" data-${attr}="${esc(k)}" aria-pressed="${cur === k}">${o.ko ? koHTML(k) : wordHTML(k)}</button>`).join('')}</div>`;
const pairSel = (cur, attr, list, blank = '영상대로') => {
  const groups = [['front', '애 짝 — æ · ɛ'], ['back', '아 짝 — ɑ · ʌ']].filter(([sd]) => list.some(p => p.side === sd));
  return `<select class="lab-sel" data-sel="${attr}" aria-label="짝 고르기">${blank ? `<option value="">${esc(blank)}</option>` : ''}${groups.map(([sd, lab]) => `<optgroup label="${esc(lab)}">${list.filter(p => p.side === sd).map(p => `<option value="${p.id}"${cur === p.id ? ' selected' : ''}>${esc(OV.word(p.a))} · ${esc(OV.word(p.b))}</option>`).join('')}</optgroup>`).join('')}</select>`;
};
const FRONT_PICK = OVS.FRONT_WORDS['æ'].concat(OVS.FRONT_WORDS['ɛ']);
const BACK_PICK = OVS.BACK_WORDS['ɑ'].concat(OVS.BACK_WORDS['ʌ']);
// 덜 벌린 어 · 크게 벌린 아의 길이를 잰 값으로 견준 한 줄 (잰 값이 없으면 빈칸)
function backLen(sp) {
  const W = ['cup', 'cop', 'luck', 'lock', 'hut', 'hot'], v = Object.fromEntries(W.map(k => [k, OVS.vdOf(k, sp)]));
  if (!W.every(k => v[k])) return '';
  const ms = k => `${Math.round(v[k])}ms`;
  const shorter = [['cup', 'cop'], ['luck', 'lock'], ['hut', 'hot']].filter(([a, b]) => v[a] < v[b]).length;
  return `${WHO[sp]} → cup ${ms('cup')} · cop ${ms('cop')}, luck ${ms('luck')} · lock ${ms('lock')}, hut ${ms('hut')} · hot ${ms('hot')}. 세 짝 가운데 ${shorter}짝에서 덜 벌린 어가 더 짧아요.`;
}
const LABS = {
  intro() {
    return labHead('먼저 들어 보기') + `<p>나쁜 · 침대 → 영어로 눌러 들어 보세요. 한국어식 표기는 글자만 달라요 → ${koHTML('bad')} · ${koHTML('bed')}</p>
      ${pairBox(OVS.pairById('bad-bed'))}
      <div class="wrow"><span class="note">한국어식</span>${koBtn('bad')}${koBtn('bed')}</div>
      ${voices4(sp => pairSeq('bad', 'bed', sp), '목소리 넷으로 짝 듣기')}
      <div class="wrow"><span class="note">뒤쪽 짝</span>${wBtn('cop')}${wBtn('cup')}${koBtn('cop')}${koBtn('cup')}</div>
      <p class="note">같은 단추를 곧바로 다시 누르면 천천히 들려줘요. 노란 글자 = 크게 벌린 모음, 하늘색 글자 = 덜 벌린 모음이에요.</p>`;
  },
  listen() {
    const p = S.pair ? OVS.pairById(S.pair) : null, sp = S.voice || 'tc';
    let h = labHead('짝 고르기') + row('짝', pairSel(S.pair, 'pair', OV.PAIRS)) + row('목소리', voiceSeg(S.voice, 'vc', '밝은 선생님').replace('data-vc="tc"', 'data-vc="tc" hidden'));
    if (!p) return h + '<p class="note">짝을 고르면 영상이 멈추고 그 짝과 모음 지도를 크게 보여 줘요. 목소리를 바꾸면 영상의 세 짝도 그 목소리로 바뀌어요. 본격적인 연습은 아래 <a href="#playground">듣고 가르기 훈련</a>에서 해요.</p>';
    return h + pairBox(p, sp) + `<div class="lab-fig">${vmapSVG([p.a, p.b], sp, { w: 280, h: 180 })}</div>
      <div class="wrow"><span class="note">한국어식</span>${koBtn(p.a)}${koBtn(p.b)}${lpBtn(pairSeq(p.a, p.b, sp), '이어서 듣기', 'lp-voice', `${ICO.play}<span>이어서</span>`)}</div>
      <p class="note">${OV.koSameSound(p.a, p.b) ? '한국어식으로는 글자만 다르고 소리는 같아요(요즘 많은 사람이 애 · 에를 한 소리로 말해요).' : '한국어식으로는 아 · 어로 갈리지만, 영어의 두 모음과 똑같지는 않아요.'}</p>
      ${voices4(v => pairSeq(p.a, p.b, v), '목소리 넷으로 짝 듣기')}` + clearBtn;
  },
  map() {
    const sp = S.mapVoice || 'tc';
    const ws = okWords(OVS.HVD, sp), n = NUM[ws.length];
    return labHead('잰 지도 · 목소리 고르기') + row('목소리', voiceSeg(sp, 'mv')) +
      `<div class="lab-fig">${vmapSVG(OVS.HVD, sp, { w: 300, h: 200, partial: true })}</div>
      <div class="wrow">${ws.map(k => wBtn(k, sp)).join('')}${lpBtn(ws.map((k, i) => ({ text: OV.word(k), sp, gap: i ? 0.6 : 0 })), `${n} 이어서 듣기`, 'lp-voice', `${ICO.play}<span>${n} 이어서</span>`)}</div>
      <p class="note">b + 모음 + t 틀에 모음만 바꿔 넣은 낱말이라, 모음끼리 견주기 좋아요. 화살표는 덜 벌린 모음 → 크게 벌린 모음(턱을 더 내리면)이에요. 목소리를 고르면 영상의 오른쪽 지도도 바뀌어요.</p>`;
  },
  front() {
    const k = S.fword;
    let h = labHead('앞 모음 · 낱말 고르기') + row('낱말', wordPick(FRONT_PICK, k, 'fw'));
    if (!k) return h + '<p class="note">낱말을 고르면 영상이 멈추고 그 모음의 입 모양을 앞에 보여 줘요. 점선은 덜 벌린 에의 혀예요.</p>';
    const v = OV.vowel(k), p = OV.pairOf(k);
    return h + `<p class="enline">${vTag(v)} ${wBtn(k)} <span class="note">${esc(OV.ipa(k))} · ${esc(OV.entry(k).gloss)}</span></p><p class="note">${esc(OV.V[v].tip)}</p>` + (p ? pairBox(p) : '') + clearBtn;
  },
  back() {
    const k = S.bword, len = backLen('tc');
    let h = labHead('뒤 모음 · 낱말 고르기') + row('낱말', wordPick(BACK_PICK, k, 'bw'));
    const lens = len ? vbarsHTML(['cup', 'cop', 'luck', 'lock'], 'tc') + `<p class="note">${esc(len)}</p>` : '';
    if (!k) return h + '<p class="note">낱말을 고르면 영상이 멈추고 그 모음의 입 모양과 입술 앞모습을 앞에 보여 줘요. 점선은 덜 벌린 어의 혀예요.</p>' + lens;
    const v = OV.vowel(k), p = OV.pairOf(k);
    return h + `<p class="enline">${vTag(v)} ${wBtn(k)} <span class="note">${esc(OV.ipa(k))} · ${esc(OV.entry(k).gloss)}</span></p><p class="note">${esc(OV.V[v].tip)}</p>` + (p ? pairBox(p) : '') + lens + clearBtn;
  },
  tri() {
    const i = S.tri, sp = S.triVoice || 'tc';
    let h = labHead('셋이 갈리는 줄 고르기') + row('줄', `<div class="wrow sel">${OV.TRI.map((r, k) => `<button type="button" class="pickw${i === k ? ' on' : ''}" data-tri="${k}" aria-pressed="${i === k}"><span lang="en">${r.map(esc).join(' · ')}</span></button>`).join('')}</div>`) +
      row('목소리', voiceSeg(S.triVoice, 'tv', '밝은 선생님').replace('data-tv="tc"', 'data-tv="tc" hidden'));
    const r = OV.TRI[i == null ? 0 : i], rw = okWords(r, sp), rn = NUM[rw.length];
    h += `<div class="lab-fig">${vmapSVG(r, sp, { w: 280, h: 186, partial: true })}</div>
      <div class="wrow">${rw.map(k => wBtn(k, sp)).join('')}${lpBtn(rw.map((k, j) => ({ text: OV.word(k), sp, gap: j ? 0.6 : 0 })), `${rn} 이어서 듣기`, 'lp-voice', `${ICO.play}<span>${rn} 이어서</span>`)}</div>
      <p class="note">${r.map(k => `${esc(OV.word(k))} ${esc(OV.ipa(k))} ${esc(OV.entry(k).gloss)}`).join(' · ')}</p>`;
    return h + (i == null && !S.triVoice ? '<p class="note">줄을 고르면 영상이 멈추고 그 줄과 잰 지도를 크게 보여 줘요.</p>' : clearBtn);
  },
  voices() {
    const sp = S.mapVoice || 'tc';
    return labHead('한 목소리 크게') + row('목소리', voiceSeg(sp, 'mv')) +
      `<div class="lab-fig">${vmapSVG(OVS.HVD, sp, { w: 300, h: 200, partial: true })}</div>
      <p class="note">점의 자리는 목소리마다 달라도, 화살표의 방향 — 덜 벌린 모음 → 크게 벌린 모음이 아래(턱을 더 내림)나 뒤 — 은 같아요. 내 목소리로는 아래 <a href="#myvowel">내 모음 찍기</a>에서 해 보세요.</p>`;
  },
  loan() {
    const k = S.loan;
    let h = labHead('외래어 하나씩') + row('낱말', wordPick(OV.LOAN.map(o => o.w), k, 'ln', { ko: true }));
    if (!k) return h + '<p class="note">한글 표기를 고르면 영어의 센 음절 모음이 어느 쪽인지, 한글 표기와 어긋나는지 보여 줘요.</p>';
    const v = OV.vowel(k), row0 = OV.LROWS.find(r => r.v === v), tr = OV.koTrap(k);
    return h + `<div class="wrow">${koBtn(k)}<span class="arr">→</span>${wBtn(k)}${vTag(v)}</div>
      <p class="note">${tr ? `<mark class="mk-trap">함정</mark> 한글 표기의 모음은 ${esc(tr)}, 영어는 ${esc(OV.V[v].ko)}예요.` : `한글 표기의 모음(${esc(OV.koFam(k))})이 영어 모음과 가까워요.`}</p>
      <p class="note">${esc(OV.ipa(k))} · ${esc(OV.entry(k).gloss)} · 같은 줄(${esc(row0.ko)}) → ${row0.words.map(w => wordHTML(w)).join(' · ')}</p><p class="note">${esc(OV.V[v].tip)}</p>` + clearBtn;
  },
  sentence() {
    const opts = OV.SGRP_ORDER.map(gk => `<optgroup label="${esc(OV.SGRP[gk].long)}">${OV.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk).map(([s, i]) => `<option value="${i}"${S.sent === i ? ' selected' : ''}>${esc(s.en)}</option>`).join('')}</optgroup>`).join('');
    let h = labHead('문장 고르기') + row('문장', `<select class="lab-sel" data-sel="sent" aria-label="문장 고르기"><option value="">영상대로</option>${opts}</select>`);
    if (S.sent == null) return h + '<p class="note">따라 말하기의 28문장 가운데 하나를 고르면 영상에 크게 보여 줘요.</p>';
    const s = OV.SENT[S.sent];
    return h + `<p class="enline">${lpBtn(tSeq(s.en), '듣기: ' + s.en)}${sentHTML(s.en)}</p><p class="note">${esc(s.ko)}</p><div class="wrow">${OV.wordsIn(s.en).map(k => wBtn(k)).join('')}</div>` + clearBtn;
  },
  summary() {
    return labHead('이제 직접') + `<p>아래 <a href="#playground">듣고 가르기 훈련</a>에서 목소리 넷으로 짝을 가르고, <a href="#mypron">내 발음 확인</a>에서 음성 인식이 내 말을 어느 낱말로 듣는지, <a href="#myvowel">내 모음 찍기</a>에서 내 두 모음이 떨어져 있는지 확인해 보세요. <a href="#shadow">따라 말하기</a> 28문장과 <a href="#drill">듣고 고르기</a> 16문제도 있어요.</p>
      <p class="note">man · can · hand → 콧소리(m · n) 앞의 애는 많은 미국 사람이 조금 높여 말해요(에 쪽으로). 그래서 이 튜토리얼의 짝에서는 뺐어요.</p>`;
  },
};
function buildLab(ci) {
  const id = CHAPTERS[ci].id;
  $('lab').innerHTML = (LABS[id] || (() => ''))();
}
const relab = () => buildLab(OVS.chapterAt(T));
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
  const d = b.dataset;
  if (b.id === 'labClear') { Object.assign(S, JSON.parse(OVS.DEFAULTS)); dirty = true; relab(); return; }
  if (d.vc != null) { S.voice = d.vc && d.vc !== 'tc' ? d.vc : null; if (S.pair) showAt(21); else showAt(33); relab(); return; }
  if (d.mv != null) { S.mapVoice = d.mv === 'tc' ? null : d.mv; const id = CHAPTERS[OVS.chapterAt(T)].id; showAt(id === 'map' ? 26 : 8); relab(); return; }
  if (d.fw != null) { S.fword = S.fword === d.fw ? null : d.fw; showAt(S.fword ? 26 : 1); relab(); return; }
  if (d.bw != null) { S.bword = S.bword === d.bw ? null : d.bw; showAt(S.bword ? 26 : 1); relab(); return; }
  if (d.tri != null) { S.tri = S.tri === +d.tri ? null : +d.tri; showAt(S.tri == null ? 1 : 20); relab(); return; }
  if (d.tv != null) { S.triVoice = d.tv && d.tv !== 'tc' ? d.tv : null; showAt(20); relab(); return; }
  if (d.ln != null) { S.loan = S.loan === d.ln ? null : d.ln; showAt(32); relab(); return; }
});
$('lab').addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.sel) return;
  const v = t.value;
  if (t.dataset.sel === 'pair') { S.pair = v || null; showAt(v ? 21 : 1); }
  else if (t.dataset.sel === 'sent') { S.sent = v === '' ? null : +v; showAt(8); }
  relab();
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\s\+\s/g, ', '], [/ = /g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
  enRate: OVV.EN_RATE,      // 영어 조각만 살짝 느리게 (voices.js의 EN_RATE — 낱말 소리와 같은 빠르기)
  clips: window.EN_CLIPS,   // 미리 만든 음성 파일(audio/narration/) — 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };
if (window.EN && EN.say) EN.say.rate = OVV.EN_RATE;   // 발음 듣기 단추도 같은 빠르기

/* =========================================================
   9. 음성 인식 · 녹음 (따라 말하기 · 내 발음 확인 · 내 모음 찍기)
   있는 것부터: 음성 인식(SpeechRecognition) → 녹음(MediaRecorder) → 없으면 소리 내어 따라 하기만
   ========================================================= */
const SRC = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const CAN_REC = !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const SPEAK_MODE = SRC ? 'sr' : CAN_REC ? 'rec' : 'none';
let activeRec = null;   // 지금 듣고 있는 인식기
function stopListening() { if (activeRec) { const r = activeRec; activeRec = null; try { r.abort(); } catch (e) { /* 이미 멈춤 */ } } }
const SR_ERR = {
  'not-allowed': '마이크를 쓸 수 없어요. 브라우저 주소창 옆의 설정에서 이 페이지의 마이크를 허락해 주세요.',
  'service-not-allowed': '이 브라우저에서는 음성 인식을 쓸 수 없어요. 마이크 권한이나 브라우저 설정을 확인해 주세요.',
  'no-speech': '소리가 들리지 않았어요. 마이크 가까이에서 다시 말해 보세요.',
  'audio-capture': '마이크를 찾지 못했어요. 마이크가 연결되어 있는지 확인해 주세요.',
  network: '인터넷 연결 문제로 말을 글로 바꾸지 못했어요. 연결을 확인하고 다시 해 보세요.',
  'language-not-supported': '이 브라우저는 영어 음성 인식을 지원하지 않아요.',
};
function listenOnce({ onText, onFail, onState, alts: nAlt = 3 }) {
  stopSounds(); NARR.reset(); if (playing) pause(); stopListening();
  let rec;
  try { rec = new SRC(); } catch (e) { onFail('음성 인식을 시작하지 못했어요.'); return; }
  rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = nAlt; rec.continuous = false;
  let got = false, failed = false, timer = 0;
  rec.onresult = e => { got = true; const r = e.results[0], alts = []; for (let i = 0; i < r.length; i++) alts.push(r[i].transcript); onText(alts); };
  rec.onerror = e => { failed = true; if (e.error !== 'aborted') onFail(SR_ERR[e.error] || `음성 인식에 문제가 생겼어요 (${e.error}).`); };
  rec.onend = () => { clearTimeout(timer); if (activeRec === rec) activeRec = null; onState(false); if (!got && !failed) onFail(SR_ERR['no-speech']); };
  activeRec = rec; onState(true);
  try { rec.start(); } catch (e) { activeRec = null; onState(false); onFail('음성 인식을 시작하지 못했어요. 잠시 뒤 다시 눌러 보세요.'); return; }
  timer = setTimeout(() => { try { rec.stop(); } catch (e) { /* 이미 끝남 */ } }, 9000);
}
// 녹음 한 번 (ms 뒤 저절로 멈춤) → Blob
async function recordBlob(ms, onState) {
  stopSounds(); NARR.reset(); if (playing) pause(); stopListening();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
  const mr = new MediaRecorder(stream), chunks = [];
  return new Promise(res => {
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); onState(false); res(chunks.length ? new Blob(chunks, { type: mr.mimeType || 'audio/webm' }) : null); };
    mr.start(); onState(true);
    setTimeout(() => { try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } }, ms);
  });
}
const recordOnce = (ms, onState) => recordBlob(ms, onState).then(b => b ? URL.createObjectURL(b) : null);
const recErr = e => e && e.name === 'NotAllowedError' ? '마이크를 쓸 수 없어요. 브라우저 설정에서 이 페이지의 마이크를 허락해 주세요.' : e && e.name === 'NotFoundError' ? '마이크를 찾지 못했어요. 마이크가 연결되어 있는지 확인해 주세요.' : '녹음을 시작하지 못했어요.';
function playUrl(url, btn, then) {
  stopSounds(); NARR.reset(); if (playing) pause();
  if (!url) return;
  const a = new Audio(url); audioEl = a;
  if (btn) btn.classList.add('saying');
  a.onended = () => { if (audioEl !== a) return; audioEl = null; if (btn) btn.classList.remove('saying'); if (then) then(); };
  a.play().catch(() => { audioEl = null; if (btn) btn.classList.remove('saying'); });
}

/* =========================================================
   10. 놀이터 ① 듣고 가르기 훈련 — 짝 × 목소리 넷: 낱말 하나를 듣고 짝 가운데 고르기
   기록은 이 브라우저에만(localStorage 'en-ov-hvpt-v1'). 키보드: R 듣기 · A · B(1 · 2) 고르기 · Space/Enter 다음
   ========================================================= */
const HV_KEY = 'en-ov-hvpt-v1';
const SIDE_KO = { front: '애 짝 (æ · ɛ)', back: '아 짝 (ɑ · ʌ)' };
const HV_GRP = [['all', '모두'], ['front', '애 짝'], ['back', '아 짝']];
const hvPool = side => OV.PAIRS.filter(p => side === 'all' || p.side === side);
const HV = { side: 'all', voice: 'all', cur: null, pick: null, stats: null, streak: 0, last: null };
const hvEmpty = () => ({ side: { front: [0, 0], back: [0, 0] }, role: { a: [0, 0], b: [0, 0] }, voice: { tc: [0, 0], tf: [0, 0], uf: [0, 0], um: [0, 0] } });
function hvLoad() { try { const s = JSON.parse(localStorage.getItem(HV_KEY) || 'null'); HV.stats = s && s.side && s.voice && s.role ? s : hvEmpty(); } catch (e) { HV.stats = hvEmpty(); } }
function hvSave() { try { localStorage.setItem(HV_KEY, JSON.stringify(HV.stats)); } catch (e) { /* 저장하지 못해도 이번에는 계속 */ } }
// 짝의 두 낱말이 모두 확인(받아쓰기 · 끝 올림 · 짝과 모음 자리)을 통과한 목소리만 — 통과한 줄만 잰 값이 있어요.
// 받아쓰기가 짝 낱말로 적은 소리를 들려주고 틀렸다고 하지 않게. 잰 값 파일이 없으면 넷 다 써요.
const okVoices = p => OV.VOICES.map(v => v.sp).filter(sp => !!OVV.meas(sp, OV.word(p.a)) && !!OVV.meas(sp, OV.word(p.b)));
function hvNew(auto) {
  const all = hvPool(HV.side).filter(p => p.id !== HV.last);
  const vp = all.filter(p => HV.voice === 'all' ? okVoices(p).length : okVoices(p).includes(HV.voice));
  const pool = vp.length ? vp : all;
  const p = pickOne(pool), ok = okVoices(p);
  const sp = HV.voice === 'all' ? pickOne(ok.length ? ok : OV.VOICES.map(v => v.sp)) : HV.voice, w = Math.random() < 0.5 ? p.a : p.b;
  HV.cur = { p, w, sp }; HV.pick = null; HV.last = p.id;
  hvDraw();
  if (auto) hvPlay();
}
function hvPlay(slow) { if (!HV.cur) return; const b = $('hvPlayBtn'); if (b) b.classList.add('saying'); speak(wSeq(HV.cur.w, HV.cur.sp), { slow: !!slow, onend() { const x = $('hvPlayBtn'); if (x) x.classList.remove('saying'); } }); }
function hvAnswer(i) {
  const c = HV.cur; if (!c || HV.pick !== null || i > 1) return;
  HV.pick = i;
  const ok = [c.p.a, c.p.b][i] === c.w, role = c.w === c.p.a ? 'a' : 'b';
  [HV.stats.side[c.p.side], HV.stats.voice[c.sp], HV.stats.role[role]].forEach(v => { v[1]++; if (ok) v[0]++; });
  HV.streak = ok ? HV.streak + 1 : 0;
  hvSave(); hvDraw();
  const nb = $('hvNext'); if (nb) nb.focus({ preventScroll: true });
}
const pct = ([ok, n]) => n ? Math.round(ok / n * 100) : null;
const pctTxt = v => pct(v) == null ? '–' : pct(v) + '%';
function hvDraw() {
  const c = HV.cur, box = $('hvMain');
  let h = '';
  if (!c) h = `<p class="hv-hello">목소리 넷 가운데 하나가 짝 낱말 가운데 하나를 말해요. 듣고 어느 낱말인지 고르면, 그 목소리를 잰 모음 지도와 한국어식 표기가 나타나요. 턱이 얼마나 내려갔나 — 크게 벌려 낮고 넓은 소리인가, 조금만 벌린 소리인가 — 를 들어 보세요.</p><div class="acts"><button type="button" class="btn" id="hvStart">${ICO.play} 시작하기</button></div>`;
  else {
    const { p, w, sp } = c, done = HV.pick !== null, ans = w === p.a ? 0 : 1, ok = done && HV.pick === ans;
    h += `<div class="hv-top"><button type="button" class="btn hv-play" id="hvPlayBtn">${ICO.play} 듣기 <small>R</small></button><button type="button" class="btn ghost" id="hvSlow">${ICO.slow} 천천히</button><span class="hv-who">${esc(WHO[sp])} · ${esc(SIDE_KO[p.side])}</span></div>`;
    h += `<div class="hv-opts">${[p.a, p.b].map((k, i) => `<button type="button" class="hv-opt${done ? (i === ans ? ' right' : i === HV.pick ? ' wrong' : ' off') : ''}" data-hv="${i}"${done ? ' disabled' : ''}><b>${L2[i]}</b><span>${wordHTML(k, { paint: done })}</span><small>${esc(OV.entry(k).gloss)}${done ? ' · ' + esc(OV.V[OV.vowel(k)].ko) : ''}</small></button>`).join('')}</div>`;
    if (done) {
      h += `<p class="verdict"><b class="${ok ? 'c-ok' : 'c-no'}">${ok ? '맞아요' : '아쉬워요'}</b>들은 낱말 → ${wordHTML(w)} ${esc(OV.ipa(w))} · ${esc(OV.V[OV.vowel(w)].ko)}${HV.streak > 1 ? ` · 연속 ${HV.streak}번!` : ''}</p>`;
      h += `<div class="hv-fig">${vmapSVG([p.a, p.b], sp, { w: 260, h: 172 })}<div class="hv-side"><div class="wrow">${wBtn(p.a, sp)}${wBtn(p.b, sp)}${lpBtn(pairSeq(p.a, p.b, sp), '이어서 듣기', 'lp-voice', `${ICO.play}<span>이어서</span>`)}</div><div class="wrow"><span class="note">한국어식</span>${koBtn(p.a)}${koBtn(p.b)}</div><p class="note">${esc(OV.V[OV.vowel(w)].tip)}</p></div></div>`;
      h += `<div class="acts"><button type="button" class="btn" id="hvNext">다음 <small>Space</small></button></div>`;
    }
  }
  box.innerHTML = h;
  const st = HV.stats;
  const all = [st.side.front[0] + st.side.back[0], st.side.front[1] + st.side.back[1]];
  const tr = (lab, v) => `<tr><th scope="row">${esc(lab)}</th><td>${v[0]} / ${v[1]}</td><td><span class="meter"><i style="width:${pct(v) == null ? 0 : pct(v)}%"></i></span>${pctTxt(v)}</td></tr>`;
  $('hvStats').innerHTML = `<table class="hv-tab"><caption>맞힌 비율 (이 브라우저에만 저장)</caption><tbody>${tr(SIDE_KO.front, st.side.front)}${tr(SIDE_KO.back, st.side.back)}${tr('들은 낱말이 크게 벌린 모음', st.role.a)}${tr('들은 낱말이 덜 벌린 모음', st.role.b)}<tr class="all"><th scope="row">모두</th><td>${all[0]} / ${all[1]}</td><td>${pctTxt(all)}</td></tr></tbody></table>
    <p class="note">목소리마다: ${OV.VOICES.map(v => `${esc(v.ko)} ${pctTxt(st.voice[v.sp])}`).join(' · ')}</p>`;
}
function hvInit() {
  hvLoad();
  $('hvCtl').innerHTML = row('짝', seg('짝 묶음 고르기', HV_GRP, HV.side, 'hvg')) +
    row('목소리', seg('목소리 고르기', [['all', '넷 섞어서']].concat(OV.VOICES.map(v => [v.sp, v.ko])), HV.voice, 'hvv'));
  hvDraw();
  const root = $('hvpt');
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    const d = b.dataset;
    if (d.hvg) { HV.side = d.hvg; root.querySelectorAll('[data-hvg]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hvNew(false); return; }
    if (d.hvv) { HV.voice = d.hvv; root.querySelectorAll('[data-hvv]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hvNew(false); return; }
    if (b.id === 'hvStart' || b.id === 'hvNext') { hvNew(true); return; }
    if (b.id === 'hvPlayBtn') { hvPlay(false); return; }
    if (b.id === 'hvSlow') { hvPlay(true); return; }
    if (d.hv != null) { hvAnswer(+d.hv); return; }
    if (b.id === 'hvReset') { HV.stats = hvEmpty(); HV.streak = 0; hvSave(); hvDraw(); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('select'))) return;
    const k = e.key.toUpperCase(), n = Math.max('AB'.indexOf(k), '12'.indexOf(k));
    if (k === 'R') { e.preventDefault(); if (!HV.cur) hvNew(true); else hvPlay(false); }
    else if (n >= 0 && k.length === 1 && HV.cur && HV.pick === null) { e.preventDefault(); hvAnswer(n); }
    else if ((e.key === ' ' || e.key === 'Enter') && (HV.pick !== null || !HV.cur) && !(e.target.closest && e.target.closest('button:not(#hvNext):not(#hvStart)'))) { e.preventDefault(); hvNew(true); }
  });
}

/* =========================================================
   10. 놀이터 ② 내 발음 확인 — 음성 인식이 내 말을 어느 낱말로 들었나 · 녹음해서 본보기와 번갈아 듣기
   발음의 질은 판정하지 않아요(화면에 밝힘)
   ========================================================= */
const MP = { pair: OV.MP_PAIRS[0].id, side: 'a', url: null, res: null, busy: false };
const mpTarget = () => { const p = OV.MP_PAIRS.find(x => x.id === MP.pair); return { p, w: MP.side === 'a' ? p.a : p.b, other: MP.side === 'a' ? p.b : p.a }; };
const MP_FIX = {
  front: { a: '덜 벌린 에로 들렸어요. 턱을 손가락 하나만큼 더 내리고 입꼬리를 옆으로 당겨', b: '크게 벌린 애로 들렸어요. 턱을 조금만 내리고 가볍게' },
  back: { a: '덜 벌린 어로 들렸어요. 턱을 크게 내리고 혀를 낮게 뒤로 당겨 조금 길게', b: '크게 벌린 아로 들렸어요. 턱을 조금만 내리고 힘을 빼 짧게' },
};
const sideLab = (p, s) => { const k = s === 'a' ? p.a : p.b; return `${OV.word(k)} · ${OV.V[OV.vowel(k)].ko}`; };
function mpDraw() {
  const { p, w, other } = mpTarget();
  let h = `<div class="mp-ctl">${row('짝', pairSel(MP.pair, 'mp', OV.MP_PAIRS, '').replace('data-sel="mp"', 'id="mpSel"'))}${row('말할 낱말', seg('말할 낱말', [['a', esc(sideLab(p, 'a'))], ['b', esc(sideLab(p, 'b'))]], MP.side, 'mpside'))}</div>`;
  h += `<div class="mp-body"><div class="mp-fig">${vmapSVG([p.a, p.b], 'tc', { w: 200, h: 150 })}</div>
    <div class="mp-word"><p class="mp-big">${wordHTML(w)}</p><p class="note">${esc(OV.ipa(w))} · ${esc(OV.entry(w).gloss)} · 짝 → ${wordHTML(other)}</p>
    <p class="note">${vTag(OV.vowel(w))} ${esc(OV.V[OV.vowel(w)].tip)}</p>
    <div class="wrow">${wBtn(w)}${wBtn(other)}</div></div></div>`;
  h += '<div class="mp-acts">';
  if (SRC) h += `<button type="button" class="btn" id="mpMic" aria-pressed="false">${ICO.mic}<span>말하고 인식 결과 보기</span></button>`;
  if (CAN_REC) h += `<button type="button" class="btn ghost" id="mpRec" aria-pressed="false">${ICO.rec}<span>3초 녹음</span></button>`;
  if (!SRC && !CAN_REC) h += '<p class="note">이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. 본보기를 듣고 세 번 소리 내어 따라 해 보세요.</p>';
  h += '</div><div class="mp-res" id="mpRes" role="status"></div>';
  $('mpMain').innerHTML = h;
  mpResult();
}
function mpResult() {
  const box = $('mpRes'); if (!box) return;
  const { p } = mpTarget();
  let h = '';
  if (MP.res) {
    const r = MP.res, cls = r.verdict === 'target' ? 'c-ok' : r.verdict === 'partner' ? 'c-no' : 'c-mid';
    h += `<p class="verdict"><b class="${cls}">${esc(OV.HEARD_KO[r.verdict])}</b>${r.verdict === 'partner' ? `받아 적은 말 → 짝 낱말 ${esc(OV.word(r.partner))}. ${esc(MP_FIX[p.side][MP.side])} 다시 해 보세요.` : r.verdict === 'target' ? '인식기가 목표 낱말로 받아 적었어요.' : r.verdict === 'maybe' ? `목표 낱말 → ${r.rank}번째 후보. 조금 더 또렷하게 해 보세요.` : r.verdict === 'other' ? '목표 낱말도 짝 낱말도 아닌 말로 받아 적었어요. 낱말 하나만 또박또박 말해 보세요.' : ''}</p>`;
    if (r.alts && r.alts.length) h += `<p class="note">인식 후보: ${r.alts.map((a, i) => `<span class="alt${i === 0 ? ' top' : ''}" lang="en">${esc(a)}</span>`).join(' · ')}</p>`;
  }
  if (MP.err) h += `<p class="sh-err">${esc(MP.err)}</p>`;
  if (MP.url) h += `<div class="mo"><button type="button" class="sh-play" id="mpMine">${ICO.play} 내 목소리</button>${OVV.supported ? `<button type="button" class="sh-play" id="mpModel">${ICO.play} 본보기</button><button type="button" class="sh-play" id="mpBoth">${ICO.play} 번갈아 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`;
  box.innerHTML = h;
}
function mpInit() {
  const root = $('mypron');
  mpDraw();
  root.addEventListener('change', e => { if (e.target.id === 'mpSel') { MP.pair = e.target.value; MP.res = null; MP.err = null; mpDraw(); } });
  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.dataset.mpside) { MP.side = b.dataset.mpside; MP.res = null; MP.err = null; mpDraw(); return; }
    const { w } = mpTarget();
    if (b.id === 'mpMic') {
      if (activeRec) { stopListening(); return; }
      MP.err = null; MP.res = null; mpResult();
      listenOnce({ alts: 5,
        onState(on) { const x = $('mpMic'); if (x) { x.setAttribute('aria-pressed', String(on)); x.classList.toggle('on', on); x.querySelector('span').textContent = on ? '듣고 있어요…' : '말하고 인식 결과 보기'; } },
        onText(alts) { MP.res = Object.assign(OV.heard(w, alts), { alts }); mpResult(); },
        onFail(msg) { MP.err = msg; mpResult(); } });
      return;
    }
    if (b.id === 'mpRec') {
      if (MP.busy) return;
      MP.busy = true; MP.err = null;
      try {
        const url = await recordOnce(3000, on => { const x = $('mpRec'); if (x) { x.setAttribute('aria-pressed', String(on)); x.classList.toggle('on', on); x.querySelector('span').textContent = on ? '녹음 중… (3초)' : '3초 녹음'; } });
        if (MP.url) URL.revokeObjectURL(MP.url);
        MP.url = url; if (!url) MP.err = '녹음된 소리가 없어요. 다시 해 보세요.';
        mpResult();
        if (url) playUrl(url, $('mpMine'), () => { if (OVV.supported) speak(wSeq(w)); });
      } catch (err) { MP.err = recErr(err); mpResult(); }
      MP.busy = false;
      return;
    }
    if (b.id === 'mpMine') { playUrl(MP.url, b); return; }
    if (b.id === 'mpModel') { speak(wSeq(w)); return; }
    if (b.id === 'mpBoth') { playUrl(MP.url, $('mpMine'), () => speak(wSeq(w), { onend(stopped) { if (!stopped) playUrl(MP.url, $('mpMine'), () => speak(wSeq(w))); } })); }
  });
}

/* =========================================================
   10. 놀이터 ③ 내 모음 찍기 (시험 기능) — 짝 낱말 둘을 녹음하면 내 두 모음의 F1 · F2를 브라우저 안에서 재서 지도에 찍음
   잰 방법은 tools/measure-syllables.py와 같게 줄였어요: 표본율 = 상한 × 2, 앞 강조 0.97, 25ms 해밍 창, 5ms 간격,
   크기가 가장 큰 곳에서 10dB 안쪽(모음) → 6dB 안쪽의 가운데 절반에서 10차 LPC(자기상관 · 레빈슨) → 근(뒤랑-케르너)
   → F1 = 180~1100Hz의 가장 낮은 공명, F2 = 그보다 250Hz 넘게 높은 첫 공명(대역폭 600Hz 아래) → 가운데 값.
   녹음은 이 화면의 메모리에만 있고, 소리는 어디로도 보내지 않아요(브라우저 안에서 계산).
   ========================================================= */
const VF = (() => {
  function lpc(fr, p) {
    const r = new Float64Array(p + 1);
    for (let k = 0; k <= p; k++) { let s = 0; for (let i = k; i < fr.length; i++) s += fr[i] * fr[i - k]; r[k] = s; }
    if (!(r[0] > 0)) return null;
    r[0] *= 1 + 1e-9;
    let a = new Float64Array(p + 1); a[0] = 1;
    let e = r[0];
    for (let i = 1; i <= p; i++) {
      let acc = r[i];
      for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
      const k = -acc / e, na = a.slice();
      for (let j = 1; j < i; j++) na[j] = a[j] + k * a[i - j];
      na[i] = k; a = na; e *= 1 - k * k;
      if (!(e > 0)) return null;
    }
    return a;
  }
  // 다항식 c[0] z^p + … + c[p] (c[0] = 1)의 근 — 뒤랑-케르너
  function roots(c) {
    const p = c.length - 1, re = [], im = [];
    for (let k = 0; k < p; k++) { const ang = 2 * Math.PI * k / p + 0.4; re.push(0.9 * Math.cos(ang)); im.push(0.9 * Math.sin(ang)); }
    for (let it = 0; it < 600; it++) {
      let maxd = 0;
      for (let k = 0; k < p; k++) {
        let pr = 1, pi = 0;
        for (let j = 1; j <= p; j++) { const nr = pr * re[k] - pi * im[k] + c[j]; pi = pr * im[k] + pi * re[k]; pr = nr; }
        let dr = 1, di = 0;
        for (let j = 0; j < p; j++) { if (j === k) continue; const xr = re[k] - re[j], xi = im[k] - im[j]; const nr = dr * xr - di * xi; di = dr * xi + di * xr; dr = nr; }
        const den = dr * dr + di * di || 1e-30, qr = (pr * dr + pi * di) / den, qi = (pi * dr - pr * di) / den;
        re[k] -= qr; im[k] -= qi; maxd = Math.max(maxd, Math.abs(qr) + Math.abs(qi));
      }
      if (maxd < 1e-12) break;
    }
    return re.map((r, k) => [r, im[k]]);
  }
  const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  // x: 표본율 sr(= 상한 × 2)의 소리 → { F1, F2, vd(ms), frames } | { err }
  function analyze(x, sr, ceiling) {
    const hop = Math.round(0.005 * sr), win = Math.round(0.025 * sr), n = Math.floor(x.length / hop);
    if (n < 20) return { err: 'short' };
    const env = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const s0 = Math.max(0, i * hop - (win >> 1)), s1 = Math.min(x.length, s0 + win);
      let s = 0; for (let j = s0; j < s1; j++) s += x[j] * x[j];
      env[i] = 10 * Math.log10(s / Math.max(1, s1 - s0) + 1e-12);
    }
    let m = 0; for (let i = 1; i < n; i++) if (env[i] > env[m]) m = i;
    const floor = env.slice().sort((a, b) => a - b)[Math.floor(n * 0.1)];
    if (env[m] < -55 || env[m] - floor < 15) return { err: 'quiet' };
    const run = drop => { let a = m, b = m; while (a > 0 && env[a - 1] > env[m] - drop) a--; while (b < n - 1 && env[b + 1] > env[m] - drop) b++; return [a, b]; };
    const [na, nb] = run(10), [ca, cb] = run(6), q = Math.floor((cb - ca) / 4);
    if (cb - ca < 6) return { err: 'short' };
    const y = new Float64Array(x.length); y[0] = x[0];
    for (let i = 1; i < x.length; i++) y[i] = x[i] - 0.97 * x[i - 1];
    const ham = new Float64Array(win); for (let i = 0; i < win; i++) ham[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (win - 1));
    const f1s = [], f2s = [];
    for (let fi = ca + q; fi <= cb - q; fi++) {
      const s0 = fi * hop - (win >> 1); if (s0 < 0 || s0 + win > y.length) continue;
      const fr = new Float64Array(win); let mx = 0;
      for (let i = 0; i < win; i++) { fr[i] = y[s0 + i] * ham[i]; mx = Math.max(mx, Math.abs(fr[i])); }
      if (mx < 1e-5) continue;
      const A = lpc(fr, 10); if (!A) continue;
      const cand = roots(Array.from(A)).filter(([r, i]) => i > 0.01).map(([r, i]) => ({ f: Math.atan2(i, r) * sr / (2 * Math.PI), bw: -Math.log(Math.hypot(r, i)) * sr / Math.PI }));
      const c1 = cand.filter(o => o.f >= 180 && o.f <= 1100 && o.bw < 600).map(o => o.f).sort((a, b) => a - b);
      if (!c1.length) continue;
      const c2 = cand.filter(o => o.f > c1[0] + 250 && o.f >= 600 && o.f <= ceiling - 300 && o.bw < 600).map(o => o.f).sort((a, b) => a - b);
      if (c2.length) { f1s.push(c1[0]); f2s.push(c2[0]); }
    }
    if (f1s.length < 3) return { err: 'formant' };
    return { F1: Math.round(median(f1s)), F2: Math.round(median(f2s)), vd: Math.round((nb - na + 1) * 5), frames: f1s.length };
  }
  // 녹음(Blob) → 상한 × 2의 표본율로 풀기(브라우저가 표본율을 바꿔 줌) → analyze
  async function fromBlob(blob, ceiling) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return { err: 'decode' };
    const sr = ceiling * 2, buf = await blob.arrayBuffer();
    let ab;
    try {
      const c = new OAC(1, sr, sr);
      ab = await new Promise((res, rej) => { const p = c.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); });
    } catch (e) { return { err: 'decode' }; }
    return analyze(ab.getChannelData(0), ab.sampleRate, ceiling);
  }
  return { analyze, fromBlob, lpc, roots };
})();
window.__VF = VF;   // 확인용(읽기만): 잰 값 견주기
const MV_PAIRS = ['bad-bed', 'sad-said', 'pat-pet', 'had-head', 'cop-cup', 'hot-hut', 'lock-luck'].map(id => OVS.pairById(id));
const MV_ERR = {
  short: '모음을 찾지 못했어요. 낱말 하나를 또렷하게, 모음을 조금 길게 말해 보세요.',
  quiet: '소리가 작거나 잡음이 많아요. 조용한 곳에서 마이크 가까이 말해 보세요.',
  formant: '모음의 공명(F1 · F2)을 재지 못했어요. 다시 녹음해 보거나, 목소리 높낮이 설정을 바꿔 보세요.',
  decode: '이 브라우저에서는 녹음한 소리를 풀어 잴 수 없어요.',
};
const MV = { pair: 'bad-bed', ceil: 5500, res: { a: null, b: null }, url: { a: null, b: null }, busy: false, err: null };
const MV_RANGE = { 5500: { f1: [300, 1250], f2: [800, 2700] }, 5000: { f1: [250, 1050], f2: [700, 2300] } };
function mvMapSVG() {
  const p = OVS.pairById(MV.pair), R = MV_RANGE[MV.ceil], Wd = 320, Hh = 230, x = 40, y = 26, w = Wd - 64, h = Hh - y - 40;
  const X = f2 => x + clamp((R.f2[1] - f2) / (R.f2[1] - R.f2[0])) * w, Y = f1 => y + clamp((f1 - R.f1[0]) / (R.f1[1] - R.f1[0])) * h;
  let s = `<path class="vm-box" d="M${x} ${y}H${x + w}V${y + h}H${(x + w * 0.32).toFixed(1)}Z"/>`;
  s += `<text class="vm-ax" x="${x}" y="${y - 8}">앞 (F2 높음)</text><text class="vm-ax" x="${x + w}" y="${y - 8}" text-anchor="end">뒤</text>`;
  s += `<text class="vm-ax" x="${x - 6}" y="${y + 10}" text-anchor="end">↑</text><text class="vm-ax" x="${x - 6}" y="${y + h}" text-anchor="end">↓</text>`;
  [R.f2[0], Math.round((R.f2[0] + R.f2[1]) / 2 / 100) * 100, R.f2[1]].forEach(f => { s += `<text class="vm-tick" x="${X(f).toFixed(1)}" y="${y + h + 16}" text-anchor="middle">${f}</text>`; });
  s += `<text class="vm-tick" x="${x + w + 6}" y="${y + 4}">F1 ${R.f1[0]}</text><text class="vm-tick" x="${x + w + 6}" y="${y + h}">${R.f1[1]}</text>`;
  const pts = [['a', p.a], ['b', p.b]].map(([sd, k]) => ({ sd, k, r: MV.res[sd] })).filter(o => o.r && o.r.F1);
  if (pts.length === 2) {
    const [x0, y0, x1, y1] = [X(pts[0].r.F2), Y(pts[0].r.F1), X(pts[1].r.F2), Y(pts[1].r.F1)], L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    if (L > 22) s += `<line class="vm-arr" x1="${(x0 + ux * 9).toFixed(1)}" y1="${(y0 + uy * 9).toFixed(1)}" x2="${(x1 - ux * 11).toFixed(1)}" y2="${(y1 - uy * 11).toFixed(1)}" marker-end="url(#mvh)"/>`;
  }
  pts.forEach(o => {
    const cx = X(o.r.F2), cy = Y(o.r.F1);
    s += `<circle class="vm-pt ${o.sd}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8"><title>${esc(OV.word(o.k))} — F1 ${o.r.F1} · F2 ${o.r.F2}Hz</title></circle>`;
    s += `<text class="vm-lb ${o.sd}" x="${cx.toFixed(1)}" y="${(cy + (o.sd === 'a' ? 23 : -13)).toFixed(1)}" text-anchor="middle">${esc(OV.word(o.k))}</text>`;
  });
  if (!pts.length) s += `<text class="vm-note" x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle">녹음하면 여기에 점이 찍혀요</text>`;
  s += `<text class="vm-note" x="${Wd / 2}" y="${Hh - 6}" text-anchor="middle">내 목소리를 이 브라우저에서 잰 어림값</text>`;
  return `<svg class="vm my" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="내 모음 지도 — ${esc(pts.map(o => `${OV.word(o.k)} F1 ${o.r.F1} F2 ${o.r.F2}`).join(', ') || '아직 녹음 없음')}"><defs><marker id="mvh" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="vm-head"/></marker></defs>${s}</svg>`;
}
// 내 두 점 견주기: 앞 짝 → 크게 벌린 애의 F1이 50Hz 이상 높으면 · 뒤 짝 → 크게 벌린 아의 F1이 50Hz 이상 높거나 F2가 100Hz 이상 낮으면 ‘떨어져 있어요’
function mvVerdict() {
  const p = OVS.pairById(MV.pair), A = MV.res.a, B = MV.res.b;
  if (!A || !B || !A.F1 || !B.F1) return '';
  const d1 = A.F1 - B.F1, d2 = B.F2 - A.F2, front = p.side === 'front';
  const ok = front ? d1 >= 50 : d1 >= 50 || d2 >= 100;
  const near = Math.abs(d1) < 40 && Math.abs(d2) < 120;
  const nums = `F1 차(크게 − 덜) ${d1 > 0 ? '+' : ''}${d1}Hz · F2 차(덜 − 크게) ${d2 > 0 ? '+' : ''}${d2}Hz`;
  const O = OV.V[OV.vowel(p.a)];
  if (ok) return `<p class="verdict"><b class="c-ok">두 점이 떨어져 있어요</b>${esc(OV.word(p.a))} → ${esc(O.ko)}가 ${front ? '아래' : d1 >= 50 ? '아래' : '뒤'} 쪽에 있어요. ${esc(nums)}</p>`;
  if (near) return `<p class="verdict"><b class="c-no">두 점이 거의 겹쳐요</b>${esc(OV.word(p.a))} → ${esc(O.tip)}. 다시 녹음해 보세요. ${esc(nums)}</p>`;
  return `<p class="verdict"><b class="c-mid">떨어져 있지만 방향이 달라요</b>보통 ${esc(O.ko)}는 턱이 더 내려가 ${front ? '아래(F1 높음)' : '아래(F1 높음)나 뒤(F2 낮음)'}에 찍혀요. 녹음이 흔들렸을 수도 있으니 한 번 더 해 보세요. ${esc(nums)}</p>`;
}
function mvDraw() {
  const p = OVS.pairById(MV.pair);
  let h = `<div class="mp-ctl">${row('짝', `<select class="lab-sel" id="mvSel" aria-label="짝 고르기">${MV_PAIRS.map(x => `<option value="${x.id}"${x.id === MV.pair ? ' selected' : ''}>${esc(OV.word(x.a))} · ${esc(OV.word(x.b))}</option>`).join('')}</select>`)}${row('내 목소리', seg('목소리 높낮이', [['5500', '높은 편'], ['5000', '낮은 편']], String(MV.ceil), 'mvc'))}</div>`;
  h += `<div class="mv-body"><div class="mv-fig">${mvMapSVG()}</div><div class="mv-recs">`;
  [['a', p.a], ['b', p.b]].forEach(([sd, k], i) => {
    const r = MV.res[sd];
    h += `<div class="mv-rec ${sd}"><p class="mv-h"><b>${i + 1}</b> ${wordHTML(k)} ${vTag(OV.vowel(k))}</p><div class="wrow">${wBtn(k)}${CAN_REC ? `<button type="button" class="btn${i ? ' ghost' : ''}" data-mvrec="${sd}" aria-pressed="false">${ICO.rec}<span>2초 녹음</span></button>` : ''}${MV.url[sd] ? `<button type="button" class="sh-play" data-mvplay="${sd}">${ICO.play} 내 목소리</button>` : ''}</div>`;
    h += `<p class="note mv-val">${r ? (r.err ? `<span class="sh-err">${esc(MV_ERR[r.err])}</span>` : `F1 ${r.F1}Hz · F2 ${r.F2}Hz · 모음 길이 약 ${r.vd}ms`) : '아직 녹음하지 않았어요.'}</p></div>`;
  });
  h += '</div></div>';
  if (!CAN_REC) h += '<p class="note">이 브라우저는 녹음을 쓸 수 없어요.</p>';
  h += `<div id="mvRes" role="status">${mvVerdict()}</div>`;
  if (MV.err) h += `<p class="sh-err">${esc(MV.err)}</p>`;
  $('mvMain').innerHTML = h;
}
function mvInit() {
  const root = $('myvowel');
  mvDraw();
  root.addEventListener('change', e => { if (e.target.id === 'mvSel') { MV.pair = e.target.value; MV.res = { a: null, b: null }; Object.values(MV.url).forEach(u => u && URL.revokeObjectURL(u)); MV.url = { a: null, b: null }; MV.err = null; mvDraw(); } });
  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    const d = b.dataset;
    if (d.mvc) { MV.ceil = +d.mvc; MV.res = { a: null, b: null }; MV.err = null; mvDraw(); MV.blob && Object.keys(MV.blob).forEach(async sd => { if (MV.blob[sd]) { MV.res[sd] = await VF.fromBlob(MV.blob[sd], MV.ceil); mvDraw(); } }); return; }
    if (d.mvplay) { playUrl(MV.url[d.mvplay], b); return; }
    if (d.mvrec) {
      if (MV.busy) return;
      const sd = d.mvrec;
      MV.busy = true; MV.err = null;
      try {
        const blob = await recordBlob(2000, on => { const x = root.querySelector(`[data-mvrec="${sd}"]`); if (x) { x.setAttribute('aria-pressed', String(on)); x.classList.toggle('on', on); x.querySelector('span').textContent = on ? '녹음 중… (2초)' : '2초 녹음'; } });
        if (!blob) { MV.err = '녹음된 소리가 없어요. 다시 해 보세요.'; }
        else {
          MV.blob = MV.blob || {}; MV.blob[sd] = blob;
          if (MV.url[sd]) URL.revokeObjectURL(MV.url[sd]);
          MV.url[sd] = URL.createObjectURL(blob);
          MV.res[sd] = await VF.fromBlob(blob, MV.ceil);
        }
      } catch (err) { MV.err = recErr(err); }
      MV.busy = false;
      mvDraw();
    }
  });
}

/* =========================================================
   11. 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황).', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = OV.SGRP_ORDER.map(gk => ({ gk, rows: OV.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk) }));
  $('shList').innerHTML = groups.map(({ gk, rows }) => `<section class="sh-grp"><h3><span class="ptag g-${gk}">${esc(OV.SGRP[gk].ko)}</span> ${esc(OV.SGRP[gk].long.split(' — ')[1] || '')}</h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${OVV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-en">${sentHTML(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { return tSeq(OV.SENT[i].en); }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = OV.SENT[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, OV.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
      const words = r.marks.map(w => `<span class="${w.ok ? 'w-ok' : 'w-no'}">${esc(w.w)}</span>`).join(' ');
      shResult(i, `<p class="sh-cmp" lang="en">${words}</p><p class="note">들린 말: <span lang="en">${esc(best[0])}</span> · 맞은 낱말 ${r.hit} / ${r.total}${r.hit === r.total ? ' — 모두 들렸어요!' : ' — 주황색 낱말을 한 번 더 들어 보고 따라 해 보세요.'}</p>`);
    },
    onFail(msg) { shResult(i, `<p class="sh-err">${esc(msg)}</p>`); },
  });
}
async function shRecord(i) {
  if (SHREC.rec) { const r = SHREC.rec; SHREC.rec = null; try { r.stop(); } catch (e) { /* 이미 멈춤 */ } return; }
  stopSounds(); NARR.reset(); if (playing) pause();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { shResult(i, `<p class="sh-err">${esc(recErr(e))}</p>`); return; }
  let mr; try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(t => t.stop()); shResult(i, '<p class="sh-err">녹음을 시작하지 못했어요.</p>'); return; }
  const chunks = [];
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => {
    clearTimeout(SHREC.tm); stream.getTracks().forEach(t => t.stop()); if (SHREC.rec === mr) SHREC.rec = null; shMicState(i, false);
    if (!chunks.length) { shResult(i, '<p class="sh-err">녹음된 소리가 없어요. 다시 해 보세요.</p>'); return; }
    if (SHREC.url[i]) URL.revokeObjectURL(SHREC.url[i]);
    SHREC.url[i] = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${OVV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
    shPlayMine(i, true);
  };
  SHREC.rec = mr; mr.start(); shMicState(i, true);
  shResult(i, '<span class="note">녹음 중이에요. 다 말했으면 ‘멈추기’를 눌러요(6초가 지나면 저절로 멈춰요).</span>');
  SHREC.tm = setTimeout(() => { if (SHREC.rec === mr) { SHREC.rec = null; try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 6000);
}
function shPlayMine(i, thenOrig) {
  const b = document.querySelector(`.sh-row[data-i="${i}"] [data-mine]`);
  playUrl(SHREC.url[i], b, thenOrig && OVV.supported ? () => speak(shSeq(i)) : null);
}
function shInit() {
  shBuild();
  $('shadow').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.shp != null) { document.querySelectorAll('.sh-say.saying').forEach(x => x.classList.remove('saying')); b.classList.add('saying'); speak(shSeq(+d.shp), { onend() { b.classList.remove('saying'); } }); return; }
    if (d.shs != null) { speak(shSeq(+d.shs), { slow: true }); return; }
    if (d.shm != null) { const i = +d.shm; if (SPEAK_MODE === 'sr') shListen(i); else shRecord(i); return; }
    if (d.mine != null) { shPlayMine(+d.mine, false); return; }
    if (d.orig != null) { speak(shSeq(+d.orig)); return; }
    if (d.both != null) shPlayMine(+d.both, true);
  });
}

/* =========================================================
   12. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 그림 문제는 모음 지도 · EN.mouth로 그림
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', p: '#FFC15E', bad: '#FF8E8E', hover: '#6EC8FF', box: '#2A3644' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
const markOf = (i, st) => st.done && i === st.answer ? QCOL.p : st.done && i === st.pick ? QCOL.bad : st.hover === i ? QCOL.hover : null;
function letter(g, x, y, k) {
  g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill();
  g.font = qfont(12, 700); g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], x, y + 1);
}
function panelFig(label, n, drawOne) {
  const Wd = 640, H = 200, cw = Wd / n;
  return { width: Wd, height: H, label,
    pick: (x, y) => y > 4 && y < H - 4 ? Math.min(n - 1, Math.floor(x / cw)) : -1,
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      for (let k = 0; k < n; k++) {
        const x = k * cw + 6;
        rrq(g, x, 6, cw - 12, H - 12, 12); g.fillStyle = st.hover === k ? QCOL.box : 'rgba(255,255,255,0.03)'; g.fill();
        g.save(); rrq(g, x, 6, cw - 12, H - 12, 12); g.clip(); drawOne(g, k, x, cw - 12); g.restore();
        const c = markOf(k, st); if (c) { rrq(g, x, 6, cw - 12, H - 12, 12); g.strokeStyle = c; g.lineWidth = 3; g.stroke(); }
        letter(g, x + 18, 22, k);
      }
    } };
}
// 입 그림 넷 (A~D)
const mouthFig = (label, poses) => panelFig(label, 4, (g, k, x) => M.draw(g, x + 2, 40, 0.34, poses[k], { mark: '#FFC15E', gap: false }));
// 모음 지도 그림: 점 넷(그림 자리) — 고른 점에 테두리
function mapFig(label, vs) {
  const Wd = 640, H = 240, bx = { x: 150, y: 40, w: 340, h: 160, R: null };
  const pos = vs.map(v => OVS.mapXY(bx, null, v));
  return { width: Wd, height: H, label,
    pick(x, y) { let best = -1, d = 40; pos.forEach(([px, py], i) => { const dd = Math.hypot(x - px, y - py); if (dd < d) { d = dd; best = i; } }); return best; },
    draw(g, st) {
      g.fillStyle = QCOL.bg; g.fillRect(0, 0, Wd, H);
      g.strokeStyle = 'rgba(238,241,244,0.25)'; g.lineWidth = 1.5; g.setLineDash([4, 5]);
      g.beginPath(); g.moveTo(bx.x, bx.y); g.lineTo(bx.x + bx.w, bx.y); g.lineTo(bx.x + bx.w, bx.y + bx.h); g.lineTo(bx.x + bx.w * 0.32, bx.y + bx.h); g.closePath(); g.stroke(); g.setLineDash([]);
      g.font = qfont(13, 700); g.fillStyle = QCOL.muted; g.textBaseline = 'bottom';
      g.textAlign = 'left'; g.fillText('앞 (혀 앞을 높이)', bx.x, bx.y - 6); g.textAlign = 'right'; g.fillText('뒤 (혀 뒤를 높이)', bx.x + bx.w, bx.y - 6);
      g.textBaseline = 'middle'; g.fillText('높게', bx.x - 10, bx.y + 10); g.fillText('낮게', bx.x - 10, bx.y + bx.h - 6);
      pos.forEach(([px, py], k) => {
        const c = markOf(k, st);
        g.beginPath(); g.arc(px, py, 10, 0, Math.PI * 2); g.fillStyle = st.hover === k ? QCOL.hover : 'rgba(238,241,244,0.75)'; g.fill();
        if (c) { g.beginPath(); g.arc(px, py, 16, 0, Math.PI * 2); g.strokeStyle = c; g.lineWidth = 3; g.stroke(); }
        letter(g, px + 24, py - 4, k);
      });
    } };
}
const QS = (() => {
  const segRoles = text => OV.segs(text).filter(s => s.role).map(s => [s.t.toLowerCase(), s.v]);
  const q = [
    { q: '나쁜 · 침대 → bad · bed. 영어에서 두 낱말을 가르는 것은?', opts: ['센 음절의 모음 — 턱을 얼마나 내리나', '첫 자음', '끝 자음', '강세의 자리'], a: 0,
      why: 'bad · bed → 첫 자음(b)과 끝 자음(d)이 같고, 모음 하나만 달라요. 크게 벌린 애 → 덜 벌린 에. 한국어식 배드 · 베드는 글자만 다르고 요즘은 같은 소리예요.',
      check: () => !!OV.pairDiff('bad', 'bed') && OV.koSameSound('bad', 'bed') },
    { q: 'cop · cup → 덜 벌린 모음(덜 벌린 어)이 든 낱말은?', opts: ['cop', 'cup', '둘 다', '둘 다 아님'], a: 1,
      why: 'cup → 덜 벌린 어, 힘을 빼고 짧게. cop → 크게 벌린 아, 턱을 크게 내려요.',
      check: () => OV.vowel('cup') === 'ʌ' && OV.vowel('cop') === 'ɑ' },
    { q: 'bad → 크게 벌린 애. 모음 지도에서 이 모음의 자리는? 점을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 2,
      figure: mapFig('모음 지도의 점 넷. A 왼쪽 가운데 높이, B 가운데쯤, C 왼쪽 아래, D 오른쪽 아래', ['ɛ', 'ʌ', 'æ', 'ɑ']),
      why: 'C → 덜 벌린 에(A)보다 훨씬 아래(턱을 크게 내림)예요. B = 덜 벌린 어, D = 크게 벌린 아.',
      check: () => OV.SCHEM['æ'].y > OV.SCHEM['ɛ'].y + 0.2 && OV.SCHEM['æ'].x < 0.5 },
    { q: 'bad → 크게 벌린 애. 이 모음을 낼 때의 입은? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: mouthFig('입 옆 단면도 넷. A 혀 앞을 가운데 높이로 들고 턱을 조금 벌림(에), B 혀 앞을 높이 들고 입을 거의 닫음(이), C 혀를 가운데에 두고 턱을 조금 벌림(어), D 턱을 크게 내리고 혀 앞이 낮음', ['eh', 'i', 'wedge', 'ae']),
      why: 'D → A(덜 벌린 에)보다 턱이 크게 내려가고 혀도 낮아요. B = 이(혀를 높이 들고 입을 거의 닫음), C = 덜 벌린 어.',
      check: () => { const ae = M.pose('ae'), eh = M.pose('eh'); return ae.jaw > eh.jaw && ae.D[1] > eh.D[1] && !M.contact('ae').touch; } },
    { q: 'cat · cut · cot → 모음의 차례는?', opts: ['덜 벌린 어 · 크게 벌린 애 · 크게 벌린 아', '크게 벌린 애 · 덜 벌린 어 · 크게 벌린 아', '크게 벌린 아 · 덜 벌린 어 · 크게 벌린 애', '셋 다 같은 모음'], a: 1,
      why: 'cat → 크게 벌린 애, cut → 덜 벌린 어, cot → 크게 벌린 아. 자음은 같고 모음만 달라 셋의 뜻이 모두 달라요.',
      check: () => OV.TRI[0].join() === 'cat,cut,cot' && OV.TRI[0].map(OV.vowel).join() === OV.TRI_V.join() },
    { q: 'bad → 모음을 한국어 에처럼 조금만 벌려 말하면, 듣는 사람에게는?', opts: ['bud', 'bad', 'bed 쪽으로', 'bid'], a: 2,
      why: '한국어 에는 영어의 덜 벌린 에와 가까워요. 턱을 크게 내리지 않으면 bad → bed 쪽으로 들리기 쉬워요.',
      check: () => OV.pairDiff('bad', 'bed') && OV.V['ɛ'].kr === '에' },
    { q: 'cup · luck · hut → 덜 벌린 어를 낼 때 알맞은 것은?', opts: ['입술을 동그랗게 내밀어요', '턱을 크게 내리고 길게 끌어요', '혀끝을 윗잇몸에 대요', '턱을 조금만 내리고 힘을 빼 짧게'], a: 3,
      why: '덜 벌린 어는 입술을 둥글리지 않고, 턱을 조금만 내려 짧고 가볍게 내요. 입술을 둥글리면 오 쪽으로 들려요.',
      check: () => ['cup', 'luck', 'hut'].every(k => OV.vowel(k) === 'ʌ') && M.pose('wedge').round <= 0.1 },
    { q: '목소리마다 모음 지도의 점이 달라도, 그대로인 것은?', opts: ['점의 Hz 값', '목소리의 높이', '차례 — 크게 벌린 모음이 덜 벌린 모음보다 아래나 뒤', '모음의 길이'], a: 2,
      why: '목과 입의 크기가 사람마다 달라 Hz 값은 달라요. 그래도 크게 벌린 모음이 덜 벌린 모음보다 아래(턱을 더 내림)나 뒤라는 차례는 같아요. 그래서 내 모음은 내 두 점끼리 견줘요.',
      check: () => true },
    { q: '센 음절의 모음이 덜 벌린 어인데, 한글로는 오로 적는 외래어는?', opts: ['oven', 'doctor', 'shopping', 'chocolate'], a: 0,
      why: 'oven → 덜 벌린 어(오븐). doctor · shopping · chocolate → 크게 벌린 아인데 한글로는 오로 적어요. 한글 표기의 모음을 믿지 말고 사전으로 확인해요.',
      check: () => OV.vowel('oven') === 'ʌ' && OV.koTrap('oven') === '오' && ['doctor', 'shopping', 'chocolate'].every(k => OV.vowel(k) === 'ɑ') },
    { q: 'Dad cut the hot bread. → 크게 벌린 모음이 든 낱말만 고르면?', opts: ['cut · bread', 'Dad · hot', 'Dad · cut', 'hot · bread'], a: 1,
      why: 'Dad → 크게 벌린 애, hot → 크게 벌린 아. cut → 덜 벌린 어, bread → 덜 벌린 에.',
      check: () => { const r = segRoles('Dad cut the hot bread.'); return r.filter(x => OV.V[x[1]].open).map(x => x[0]).join() === 'a,o'; } },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[입 벌림] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[입 벌림] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
  return q;
})();

/* =========================================================
   13. 시작
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
$('ttsBtn').addEventListener('click', () => { OVV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = OVS.chapterAt(T);
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
// 화면 누르기: 낱말 · 지도 · 한글 표기는 그 목소리로, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * OVS.W, (e.clientY - r.top) / r.height * OVS.H]; };
const hitAt = (x, y) => started ? OVS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
let lastHit = { k: '', at: 0 };
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.play && OVV.supported) {
    const k = JSON.stringify(h.play), again = lastHit.k === k && performance.now() - lastHit.at < 4000;
    lastHit = { k, at: performance.now() };
    speak(h.play, { slow: again });
  }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { const h = hitAt(...toLogical(e)); cv.style.cursor = h ? 'pointer' : 'default'; cv.title = h ? '눌러서 듣기: ' + h.play.map(x => x.text).join(' / ') : ''; });
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

// 발음 듣기 단추(공통 부품): 누르면 다른 소리를 멈추고 영상을 멈춘 뒤 읽음
EN.say.wire(document, { before() { OVV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = ' ' + OVV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 영상의 낱말 · 지도 · 한글 표기 · 목소리 단추, 직접 해 보기(고르는 것은 하나씩), 듣고 가르기 훈련(짝 × 목소리 넷), 내 발음 확인, 듣고 고르기, 따라 말하기
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text) return;
    const id = OVV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: OVV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), base = JSON.parse(OVS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 누를 수 있는 낱말 · 지도 · 한글 표기 · 목소리 단추. 직접 해 보기로 바뀌는 장면도 하나씩
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t, ch.t + ch.d]; };
    const sweeps = [[{}, [0, END]]]
      .concat(OV.PAIRS.map(p => [{ pair: p.id }, span('listen')]), OV.VOICES.map(v => [{ voice: v.sp }, span('listen')]))
      .concat(OV.VOICES.map(v => [{ mapVoice: v.sp }, span('map')]))
      .concat(...OV.TRI.map((_, i) => OV.VOICES.map(v => [{ tri: i, triVoice: v.sp }, span('tri')])))
      .concat(FRONT_PICK.map(k => [{ fword: k }, span('front')]), BACK_PICK.map(k => [{ bword: k }, span('back')]))
      .concat(OV.LOAN.map(o => [{ loan: o.w }, span('loan')]), OV.SENT.map((_, i) => [{ sent: i }, span('sentence')]));
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.5) { OVS.render(g, t); OVS.hits().forEach(h => addSeq(h.play, 'video')); }
    });
    // 2) 직접 해 보기: 장마다 + 고르는 것은 하나씩
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* */ } });
    OV.PAIRS.forEach(p => { S.pair = p.id; LABS.listen(); });
    S.pair = null;
    OV.VOICES.forEach(v => { S.mapVoice = v.sp; LABS.map(); LABS.voices(); });
    S.mapVoice = null;
    OV.TRI.forEach((_, i) => OV.VOICES.forEach(v => { S.tri = i; S.triVoice = v.sp; LABS.tri(); }));
    S.tri = null; S.triVoice = null;
    FRONT_PICK.forEach(k => { S.fword = k; LABS.front(); });
    BACK_PICK.forEach(k => { S.bword = k; LABS.back(); });
    OV.LOAN.forEach(o => { S.loan = o.w; LABS.loan(); });
    OV.SENT.forEach((_, i) => { S.sent = i; LABS.sentence(); });
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); dirty = true; }
  // 3) 듣고 가르기 훈련: 짝 × 목소리 넷 + 한국어식 / 내 발음 확인 · 내 모음 찍기: 짝 낱말(밝은 선생님)
  OV.PAIRS.forEach(p => {
    OV.VOICES.forEach(v => { add(v.sp, OV.word(p.a), 'hvpt'); add(v.sp, OV.word(p.b), 'hvpt'); });
    add('ko', OV.entry(p.a).ko, 'hvpt'); add('ko', OV.entry(p.b).ko, 'hvpt');
  });
  OV.MP_PAIRS.concat(MV_PAIRS).forEach(p => { add('tc', OV.word(p.a), 'mypron'); add('tc', OV.word(p.b), 'mypron'); });
  // 4) 듣고 고르기: 들려주는 말 + 견줘 듣기(같은 목소리) + 외래어 줄
  OV.DRILL.forEach(q => {
    addSeq(drillSeq(q), 'drill');
    const p = OV.pairOf(OV.drillWord(q)); if (p) { add(q.sp, OV.word(p.a), 'drill'); add(q.sp, OV.word(p.b), 'drill'); add('ko', OV.entry(p.a).ko, 'drill'); add('ko', OV.entry(p.b).ko, 'drill'); }
    if (q.kind === 'vowel') { OV.LROWS.find(r => r.v === OV.vowel(q.say)).words.forEach(w => add('tc', OV.word(w), 'drill')); add('ko', OV.entry(q.say).ko, 'drill'); }
  });
  // 5) 따라 말하기
  OV.SENT.forEach((_, i) => addSeq(shSeq(i), 'shadow'));
  return out;
};
// 도구용(읽기만): 잴 줄의 정보 — tools/dialogue-lines.cjs가 audio/dialogue/measure-meta.json으로 씀 → tools/measure-syllables.py
// 낱말 하나(word: 음절 수 n · 센 음절 at · 모음 지도 formant · 같은 목소리의 모음 짝 fpair · 크게 벌린 쪽 open · 앞 모음 front) · 한국어식(ko: 글자 수 = 음절 수) · 그 밖의 문장(other: 받아쓰기만)
window.__measureMeta = lines => {
  const byText = {};
  Object.values(OV.DICT).forEach(e => { byText[OVV.spoken(OV.word(e.key))] = e.key; });
  const ids = new Set(lines.map(l => l.id));
  return lines.map(l => {
    const o = { id: l.id, sp: l.sp, text: l.text };
    if (l.sp === 'ko') return Object.assign(o, { kind: 'ko', n: [...l.text].length });
    const k = byText[l.text];
    if (!k) return Object.assign(o, { kind: 'other' });
    Object.assign(o, { kind: 'word', key: k, n: OV.nSyl(k), at: OV.stressAt(k) });
    const p = OV.pairOf(k);
    if (p || OV.inGrp(k, 'loan') || OV.inGrp(k, 'hvd') || OV.inGrp(k, 'tri')) o.formant = true;
    if (p) {
      const pid = OVV.lineId(l.sp, OV.word(OV.partner(k)));
      if (ids.has(pid)) Object.assign(o, { fpair: pid, open: OV.isOpen(k), front: OV.side(k) === 'front' });
    }
    return o;
  });
};
hvInit();
mpInit();
mvInit();
shInit();
PDrill($('drillRoot'), OV.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 크게 벌린 모음과 덜 벌린 모음이 귀에 들어오네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보고, 같은 목소리로 견줘 들어 보세요.' : '처음에는 누구나 헷갈려요. 놀이터의 듣고 가르기 훈련으로 여러 목소리를 더 들어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '턱을 얼마나 내리나 — 모두 알았네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(OVS.baseText()).then(() => { dirty = true; });
setTimeout(() => OVS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
