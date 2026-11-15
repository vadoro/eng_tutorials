/* 미끄러지는 오, r을 품은 어 — oʊ · ɝ · ɚ: 플레이어, 직접 해 보기, 듣고 가르기 훈련, 내 발음 확인, 내 모음 찍기, 따라 말하기, 듣고 고르기, 퀴즈, 영상 추출
 * 목표 모음 · 짝 · 한국어식 · 외래어 함정 · 칠할 글자는 grammar.js(RV), 그림은 scenes.js(RVS)와 공통 부품 EN.mouth, 목소리와 잰 값은 voices.js(RVV)가 맡습니다.
 * 소리가 겹치지 않게: 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(RVV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const RV = window.RV, RVS = window.RVS, RVV = window.RVV, S = RVS.S, M = EN.mouth;
const { CHAPTERS, CAPTIONS, END, POSTER } = RVS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L2 = 'AB';
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const cv = $('cv'), ctx = cv.getContext('2d');
RV.check();
// 자막의 주장 점검: 자막에 적은 한국어식 표기 · 개수 · 잰 막대의 높낮이가 엔진 · 잰 값과 같은지 (다르면 콘솔 경고)
(() => {
  const warn = m => console.warn('[오 · r 모음] ' + m), ko = k => (RV.entry(k) || {}).ko;
  const KO = { coat: '코트', caught: '코트', boat: '보트', bought: '보트', work: '워크', walk: '워크', bird: '버드', bud: '버드', note: '노트', not: '낫', hope: '호프', hop: '합',
    hut: '헛', hurt: '허트', heart: '하트', water: '워터', doctor: '닥터', center: '센터', computer: '컴퓨터', home: '홈', phone: '폰', show: '쇼', toast: '토스트',
    ball: '볼', talk: '토크', sauce: '소스', shopping: '쇼핑', nurse: '너스', first: '퍼스트', world: '월드', burger: '버거' };
  Object.keys(KO).forEach(k => { if (ko(k) !== KO[k]) warn(`자막의 한국어식 ${k} = ${KO[k]}, 엔진은 ${ko(k)}`); });
  const O = RV.pairsOf('o'), nSame = O.filter(p => RV.koSame(p.a, p.b)).length;
  if (O.length !== 10 || nSame !== 6) warn(`03장 자막은 열 쌍 가운데 여섯 쌍, 엔진은 ${O.length}쌍 가운데 ${nSame}쌍`);
  if (RV.SENT.length !== 28 || RV.SGRP_ORDER.some(g => RV.SENT.filter(s => s.grp === g).length !== 7)) warn('08장 자막은 문장 스물여덟 개 · 묶음마다 일곱');
  // 04장: work 막대 < walk 막대, bird · bud도 (밝은 선생님) · 06장: 영어 water 막대(목소리 넷) < 한국어식 워터 막대 — 400Hz 넘게 낮아야 ‘훨씬 낮아요’
  const low = (a, sa, b, sb, what) => { const x = RVS.f3Of(a, sa), y = RVS.f3Of(b, sb); if (!x || !y) warn(`${what}: 잰 값 없음`); else if (x > y - 400) warn(`${what}: ${x}Hz가 ${y}Hz보다 400Hz 넘게 낮지 않음`); };
  low('work', 'tc', 'walk', 'tc', '04장 work < walk');
  low('bird', 'tc', 'bud', 'tc', '04장 bird < bud');
  RV.VOICES.forEach(v => low('water', v.sp, 'water', 'ko', `06장 water(${v.ko}) < 워터`));
})();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = RVS.fonts;
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
  const ready = new Promise(res => RVS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '미끄러지는 오, r을 품은 어 — oʊ · ɝ · ɚ — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { RVS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: RVS.iconSVG('mic'),
  rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="currentColor"/></svg>',
};
// 듣기 · 천천히 단추 묶음 (회화 영역의 듣기 연습 문제와 같은 모양 · 같은 키 R · S)
const lsnBar = () => RVV.supported
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
  const cap = started ? RVS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 낱말 · 지도 · 막대를 누르면 그 소리를 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = RVS.chapterAt(T);
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
  if (!playing && started && S.gword) { idleT += dt; dirty = true; }   // 미끄러지는 오 낱말을 고르면 입이 오 → 우로 되풀이
  if (dirty) { dirty = false; RVS.render(ctx, started ? T : POSTER, { idle: idleT }); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
// 직접 해 보기에서 고르면: 영상을 멈추고 그 장의 u초 장면을 보여 줌
function showAt(u) {
  const ch = CHAPTERS[RVS.chapterAt(T)];
  if (playing) pause();
  T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}

/* =========================================================
   4. 소리 — 목소리 넷 + 한국어식으로 읽기 (voices.js). 읽기 전에 다른 소리는 모두 멈춤
   ========================================================= */
let audioEl = null;                       // 녹음 재생
function stopAudio() { if (audioEl) { try { audioEl.pause(); } catch (e) { /* 이미 멈춤 */ } audioEl = null; } document.querySelectorAll('.sh-play.saying').forEach(b => b.classList.remove('saying')); }
function stopSounds() { EN.say.stop(); RVV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
// 확인(받아쓰기 · 센 음절 · 끝 올림 · 짝)을 통과하지 못한 낱말 파일은 들려주지 않아요 — 그 목소리로 미리 만든 파일은 있는데
// 잰 값이 없는 사전 낱말(영어 낱말 줄은 통과해야 잰 값이 남아요). 줄 목록을 모을 때(SWEEP)는 거르지 않아요(목록이 잰 값에 따라 달라지지 않게)
let SWEEP = false;
const DICT_WORDS = new Set(Object.keys(RV.DICT).map(k => RV.DICT[k].w));
const badTake = (text, sp) => !SWEEP && !!sp && sp !== 'ko' && DICT_WORDS.has(text) && RVV.hasClip(sp, text) && !RVV.meas(sp, text);
const okFor = ks => RV.VOICES.map(v => v.sp).filter(sp => !ks.some(k => k && badTake(RV.word(k), sp)));
function speak(seq, o = {}) {
  seq = (seq || []).filter(it => !badTake(it.text, it.sp));
  if (!seq.length) { if (o.onend) o.onend(true); return; }
  return RVV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름. 같은 단추를 곧바로 다시 누르면 천천히
let lastLp = { b: null, at: 0 };
const lpBtn = (seq, label, cls = '', inner) => RVV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${inner || SVG_PLAY}</button>` : '';
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
const wSeq = (k, sp = 'tc') => [{ text: RV.word(k), sp }];
const tSeq = (text, sp = 'tc') => [{ text, sp }];
const pairSeq = (a, b, sp = 'tc') => [{ text: RV.word(a), sp }, { text: RV.word(b), sp, gap: 0.7 }];
const koSeq = k => [{ text: RV.entry(k).ko, sp: 'ko' }];
const WHO = { tc: '밝은 선생님', tf: '차분한 선생님', uf: '미국 여성', um: '미국 남성', ko: '한국어식' };

/* =========================================================
   5. 글 칠하기 — 목표 모음 글자: 목표 소리 oʊ · ɝ · ɚ(mk-a 노랑) · 짝 소리 ɑ · ɔ · ʌ(mk-b 하늘) · 아 + r(mk-c 분홍), 한국어식(mk-trap 주황)
   ========================================================= */
const roleCls = r => r === 'a' ? 'mk-a' : r === 'c' ? 'mk-c' : 'mk-b';
const rc = v => (RV.V[v] || {}).role || 'b';
function wordHTML(k, o = {}) {
  const e = RV.entry(k); if (!e) return `<span lang="en">${esc(k)}</span>`;
  return `<span lang="en">${RV.spellSegs(k).map(p => p.role && o.paint !== false ? `<mark class="${roleCls(p.role)}">${esc(p.t)}</mark>` : esc(p.t)).join('')}</span>`;
}
// 한국어식: 목표 모음의 글자만 주황
const koHTML = k => { const e = RV.entry(k); return e && e.ko ? `<span class="kow">${RV.koSegs(k).map(p => p.on ? `<mark class="mk-trap">${esc(p.t)}</mark>` : esc(p.t)).join('')}</span>` : ''; };
const sentHTML = text => '<span lang="en">' + RV.segs(text).map(s => s.role ? `<mark class="${roleCls(s.role)}">${esc(s.t)}</mark>` : esc(s.t)).join('') + '</span>';
const vTag = v => `<span class="vtag ${rc(v)}">${esc(RV.V[v].ko)} <i lang="en">${esc(v)}</i></span>`;
// 낱말 단추: 누르면 들려줌(곧바로 다시 누르면 천천히)
const wBtn = (k, sp = 'tc', o = {}) => RVV.supported
  ? `<button type="button" class="wbtn${o.cls ? ' ' + o.cls : ''}" data-lp="${seqId(wSeq(k, sp))}" title="듣기: ${esc(RV.word(k))}${sp !== 'tc' ? ' · ' + WHO[sp] : ''}">${SVG_PLAY}${o.lab ? `<span>${esc(o.lab)}</span>` : wordHTML(k, o)}</button>`
  : `<span class="wbtn off">${o.lab ? esc(o.lab) : wordHTML(k, o)}</span>`;
const koBtn = k => RVV.supported ? `<button type="button" class="wbtn ko" data-lp="${seqId(koSeq(k))}" title="한국어식으로 듣기: ${esc(RV.entry(k).ko)}">${SVG_PLAY}${koHTML(k)}</button>` : `<span class="wbtn off ko">${koHTML(k)}</span>`;
const NUM = { 2: '둘', 3: '셋', 4: '넷' };
// 모음 지도 (SVG): 낱말 모두의 잰 값이 있으면 그 목소리의 낱말들로 잡은 범위에(RVS.mapRange), 하나라도 없으면 그림 자리(어림 — 잰 값과 섞지 않음).
// 미끄러지는 오 = 모음의 처음(빈 원) → 끝(화살촉) · 나머지 = 모음 가운데의 점
function vmapSVG(words, sp = 'tc', o = {}) {
  const Wd = o.w || 260, Hh = o.h || 176, P = 30, x = P, y = 24, w = Wd - 2 * P, h = Hh - y - 30;
  const Ps = words.map(k => RVS.ptsOf(k, sp)), measured = Ps.every(Boolean);
  const box = { x, y, w, h, R: measured ? RVS.mapRange([].concat(...Ps)) : null };
  let s = `<path class="vm-box" d="M${x} ${y}H${x + w}V${y + h}H${(x + w * 0.32).toFixed(1)}Z"/>`;
  s += `<text class="vm-ax" x="${x}" y="${y - 8}">앞</text><text class="vm-ax" x="${x + w}" y="${y - 8}" text-anchor="end">뒤</text>`;
  s += `<text class="vm-ax" x="${x - 6}" y="${y + 10}" text-anchor="end">↑</text><text class="vm-ax" x="${x - 6}" y="${y + h}" text-anchor="end">↓</text>`;
  const desc = [];
  words.forEach((k, i) => {
    const v = RV.vowel(k), c = rc(v), lab = o.labels === 'ipa' ? v : RV.word(k);
    if (v === 'oʊ') {
      const [x0, y0] = RVS.mapXY(box, measured ? Ps[i][0] : null, v), [x1, y1] = RVS.mapXY(box, measured ? Ps[i][1] : null, v, true);
      const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      const t = measured ? ` — 처음 F1 ${Ps[i][0][0]} · F2 ${Ps[i][0][1]} → 끝 F1 ${Ps[i][1][0]} · F2 ${Ps[i][1][1]}Hz` : '';
      s += `<circle class="vm-pt st ${c}" cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="6"><title>${esc(RV.word(k))}${t}</title></circle>`;
      if (L > 12) s += `<line class="vm-arr ${c}" x1="${(x0 + ux * 7).toFixed(1)}" y1="${(y0 + uy * 7).toFixed(1)}" x2="${(x1 - ux * 4).toFixed(1)}" y2="${(y1 - uy * 4).toFixed(1)}" marker-end="url(#vmh${c})"/>`;
      s += `<text class="vm-lb ${c}" x="${x0.toFixed(1)}" y="${(y0 + (y1 < y0 ? 20 : -11)).toFixed(1)}" text-anchor="middle">${esc(lab)}</text>`;
      desc.push(`${RV.word(k)} 처음에서 끝으로 화살표`);
    } else {
      const [cx, cy] = RVS.mapXY(box, measured ? Ps[i][0] : null, v), F = measured ? Ps[i][0] : null;
      s += `<circle class="vm-pt ${c}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7"><title>${esc(RV.word(k))}${F ? ` — F1 ${F[0]} · F2 ${F[1]}Hz` : ''}</title></circle>`;
      s += `<text class="vm-lb ${c}" x="${cx.toFixed(1)}" y="${(cy + 21).toFixed(1)}" text-anchor="middle">${esc(lab)}</text>`;
      desc.push(`${RV.word(k)} 점`);
    }
  });
  const note = measured ? `${WHO[sp]} 목소리를 잰 값` : '그림 자리(어림)';
  s += `<text class="vm-note" x="${Wd / 2}" y="${Hh - 6}" text-anchor="middle">${esc(note)}</text>`;
  const lab = `모음 지도 — ${desc.join(', ')}. ${note}. 왼쪽이 혀의 앞, 위가 혀가 높은 쪽`;
  return `<svg class="vm" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="${esc(lab)}"><defs>${['a', 'b'].map(c => `<marker id="vmh${c}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="vm-head ${c}"/></marker>`).join('')}</defs>${s}</svg>`;
}
// r 울림 막대 (SVG): 목표 모음 앞쪽의 세 번째 공명(F3, Hz) — 낮을수록 혀가 r 모양. items = [{ k, sp, lab }] (sp 'ko' = 한국어식 표기)
// 잰 값이 없으면 빈 점선 막대와 ‘잰 값 없음’(그림 자리를 꾸며 넣지 않아요)
function f3SVG(items, o = {}) {
  const n = items.length, Wd = o.w || 260, Hh = o.h || 170, x = 40, y = 20, w = Wd - x - 8, h = Hh - y - 46;
  const LO = 1000, HI = 3600, bw = Math.min(44, (w - (n - 1) * 12) / n), gap = n > 1 ? (w - bw * n) / (n - 1) : 0;
  const Y = hz => y + h - clamp((hz - LO) / (HI - LO)) * h;
  let s = '', all = true;
  [1500, 2500, 3500].forEach(hz => { s += `<line class="fb-grid" x1="${x}" x2="${x + w}" y1="${Y(hz).toFixed(1)}" y2="${Y(hz).toFixed(1)}"/><text class="vm-tick" x="${x - 5}" y="${(Y(hz) + 3.5).toFixed(1)}" text-anchor="end">${hz}</text>`; });
  const desc = [];
  items.forEach((it, i) => {
    const bx = x + i * (bw + gap), F3 = RVS.f3Of(it.k, it.sp), c = it.sp === 'ko' ? 'ko' : rc(RV.vowel(it.k));
    const lab = it.lab != null ? it.lab : it.sp === 'ko' ? RV.entry(it.k).ko : RV.word(it.k);
    if (F3) {
      s += `<rect class="fb-bar ${c}" x="${bx.toFixed(1)}" y="${Y(F3).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y + h - Y(F3)).toFixed(1)}" rx="4"><title>${esc(lab)} — F3 ${F3}Hz</title></rect>`;
      s += `<text class="fb-v ${c}" x="${(bx + bw / 2).toFixed(1)}" y="${(Y(F3) - 5).toFixed(1)}" text-anchor="middle">${F3}</text>`;
      desc.push(`${lab} ${F3}Hz`);
    } else {
      all = false;
      s += `<rect class="fb-empty" x="${bx.toFixed(1)}" y="${(y + h / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${(h / 2).toFixed(1)}" rx="4"/><text class="vm-tick" x="${(bx + bw / 2).toFixed(1)}" y="${(y + h * 0.78).toFixed(1)}" text-anchor="middle">없음</text>`;
      desc.push(`${lab} 잰 값 없음`);
    }
    s += `<text class="fb-lb ${c}" x="${(bx + bw / 2).toFixed(1)}" y="${y + h + 16}" text-anchor="middle"${it.sp === 'ko' ? '' : ' lang="en"'}>${esc(lab)}</text>`;
  });
  s += `<line class="fb-base" x1="${x}" x2="${x + w}" y1="${y + h}" y2="${y + h}"/>`;
  const note = o.note || `${all ? '' : '빈 막대 = 잰 값 없음 · '}세 번째 공명(Hz) · 낮을수록 r 울림`;
  s += `<text class="vm-note" x="${Wd / 2}" y="${Hh - 6}" text-anchor="middle">${esc(note)}</text>`;
  return `<svg class="vm fb" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="${esc(`r 울림 막대(세 번째 공명) — ${desc.join(', ')}. 막대가 낮을수록 r 울림`)}">${s}</svg>`;
}
// 짝 하나의 그림: 오 짝 = 모음 지도, r 짝 = r 울림 막대
const pairFig = (p, sp = 'tc', o = {}) => p.side === 'r' ? f3SVG([{ k: p.a, sp }, { k: p.b, sp }], Object.assign({ note: `${WHO[sp]} · 세 번째 공명(Hz) · 낮을수록 r 울림` }, o)) : vmapSVG([p.a, p.b], sp, o);
// 짝 하나: 목표 소리 · 짝 소리 낱말
const pairBox = (p, sp = 'tc') => `<div class="pairbox">${[p.a, p.b].map(k => `<div class="pb ${rc(RV.vowel(k))}"><span class="pb-h">${vTag(RV.vowel(k))}</span>${wBtn(k, sp)}<small>${esc(RV.ipa(k))} · ${esc(RV.entry(k).gloss)}</small></div>`).join('')}</div>`;
const voices4 = (seqOf, label) => { const vs = RV.VOICES.filter(v => !seqOf(v.sp).some(it => badTake(it.text, it.sp))); return voices4x(seqOf, vs.length < RV.VOICES.length ? `${label} · 확인을 통과한 목소리만` : label, vs); };
const voices4x = (seqOf, label, VS) => `<div class="voices4"><span>${esc(label)}</span>${VS.map(v => lpBtn(seqOf(v.sp), v.ko, 'lp-voice', `${ICO.play}<span>${esc(v.ko)}</span>`)).join('')}</div>`;

/* =========================================================
   6. 듣고 고르기 (이 튜토리얼 전용, 회화 영역의 듣기 연습 문제와 같은 .edr 모양) — 소리 먼저, 글은 답한 뒤
   키보드: A · B 또는 1 · 2 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · Enter/→ 다음
   ========================================================= */
const KIND_KO = { word: '어느 낱말?', sent: '문장 속 어느 낱말?', same: '같았나요?', vowel: '목표 모음은?' };
const SIT = {
  word: '낱말 하나를 들려줘요. 짝 낱말 가운데 어느 것인가요?',
  sent: '문장 하나를 들려줘요. 빈칸에 들어간 낱말은?',
  same: '낱말 둘을 이어서 들려줘요. 같은 낱말을 두 번 말했나요, 다른 낱말인가요?',
  vowel: '외래어로도 쓰는 낱말 하나를 들려줘요. 모음은 어느 쪽인가요?',
};
const drillSeq = q => q.kind === 'same' ? pairSeq(q.say[0], q.say[1], q.sp) : q.kind === 'sent' ? tSeq(q.say, q.sp) : wSeq(q.say, q.sp);
function PDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0 }));
  let cur = 0, retry = null, mode = null;
  const hear = RVV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && RVV.busy()) { RVV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(drillSeq(it), { slow: !!slow, onitem() { say(`${WHO[it.sp]} · 말하는 중`); }, onend(stopped) { mode = null; paintPlay(root, null); say(stopped ? '' : '다 들었어요. 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { RVV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; RVV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    RVV.stop();
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
  const vname = k => RV.V[RV.vowel(k)].ko;
  // 보기마다 엔진의 까닭
  function notes(it) {
    if (it.kind === 'vowel') {
      const real = RV.vowel(it.say), e = RV.entry(it.say);
      return it.vopts.map(v => v === real ? `${e.w} ${RV.ipa(it.say)} → 모음 = ${RV.V[v].ko}. 한글 표기(${e.ko})만 보고는 알 수 없어요.` : `아니에요 — ${e.w} → 모음이 ${RV.V[real].ko}예요.`);
    }
    if (it.kind === 'same') {
      const [a, b] = it.say, same = RV.word(a) === RV.word(b);
      return it.opts.map((_, k) => k === 0
        ? (same ? `같아요 — 두 번 모두 ${RV.word(a)}(${vname(a)})예요.` : `같지 않아요 — 첫째 ${RV.word(a)} = ${vname(a)}, 둘째 ${RV.word(b)} = ${vname(b)}.`)
        : (same ? `다르지 않아요 — 두 번 모두 ${RV.word(a)}예요. 짝 낱말 ${RV.word(RV.partner(a))} → ${vname(RV.partner(a))}.` : `달라요 — ${RV.word(a)} = ${vname(a)}, ${RV.word(b)} = ${vname(b)}. 한국어식 → ${RV.entry(a).ko} · ${RV.entry(b).ko}.`));
    }
    return it.opts.map(w => `${RV.word(w)} ${RV.ipa(w)} — ${RV.entry(w).gloss}. 모음 = ${vname(w)}.`);
  }
  function optLab(it, op, k) {
    if (it.kind === 'vowel') { const v = it.vopts[k]; return `<span class="ldr-t">${esc(RV.V[v].ko)}</span><small lang="en">${esc(v)}</small>`; }
    if (it.kind === 'same') return `<span class="ldr-t">${esc(op)}</span>`;
    return `<span class="ldr-t">${wordHTML(op)}</span><small>${esc(RV.entry(op).gloss)}</small>`;
  }
  function qLine(it, done) {
    if (it.kind === 'vowel') return `<p class="ldr-q"><span class="ldr-t">${wordHTML(it.say, { paint: done })}</span>${koHTML(it.say)}<small>${esc(RV.entry(it.say).gloss)} · 한글 표기의 모음은 믿지 않기</small></p>`;
    if (it.kind === 'sent') return `<p class="ldr-q"><span class="ldr-t" lang="en">${done ? sentHTML(it.say) : esc(it.frame)}</span><small>${esc(it.ko)}</small></p>`;
    if (!done) return '';
    if (it.kind === 'same') return `<p class="ldr-q"><span class="ldr-t">${wordHTML(it.say[0])} · ${wordHTML(it.say[1])}</span></p>`;
    return `<p class="ldr-q"><span class="ldr-t">${wordHTML(it.say)}</span><small>${esc(RV.entry(it.say).gloss)}</small></p>`;
  }
  function cmp(it) {
    if (it.kind === 'vowel') {
      const row = RV.LROWS.find(r => r.vs.indexOf(RV.vowel(it.say)) >= 0);
      return `<div class="ldr-cmp"><span>같은 줄의 외래어 (${esc(row.ko)})</span>${row.words.map(w => wBtn(w)).join('')}${koBtn(it.say)}</div>`;
    }
    const k = RV.drillWord(it), p = RV.pairOf(k);
    if (!p) return '';
    return `<div class="ldr-cmp"><span>같은 목소리로 견줘 듣기 · ${p.side === 'r' ? 'r 울림 막대' : '모음 지도'}</span>${pairFig(p, it.sp, { w: 230, h: 160 })}<span class="cmp-w">${wBtn(p.a, it.sp)}${wBtn(p.b, it.sp)}${koBtn(p.a)}</span>${lpBtn(pairSeq(p.a, p.b, it.sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서</span>`)}</div>`;
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = RV.hints(it);
    const o = order(), pos = o.indexOf(cur), n = it.opts.length;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${RVS.iconSVG('ear', 'pi')}${esc(KIND_KO[it.kind])}</span><span>${retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span><span class="edr-tag">${esc(WHO[it.sp])}</span></p>`;
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
const VOICE_OFF = '이 낱말은 이 목소리의 소리가 확인을 통과하지 못해 뺐어요';
const voiceSeg = (cur, attr, blank, ok) => RV.VOICES.filter(v => ok && ok.indexOf(v.sp) < 0).reduce((h, v) => h.replace(`data-${attr}="${v.sp}"`, `data-${attr}="${v.sp}" disabled title="${VOICE_OFF}"`),
  seg('목소리 고르기', (blank ? [['', blank]] : []).concat(RV.VOICES.map(v => [v.sp, v.ko])), cur || '', attr));
const offNote = ok => ok.length < RV.VOICES.length ? '<p class="note">흐린 목소리는 이 낱말의 소리가 확인(받아쓰기 · 끝 올림 · 센 음절 · 짝)을 통과하지 못해 뺐어요.</p>' : '';
// 직접 해 보기에서 목소리를 고르는 곳마다: 지금 화면에 나오는 낱말이 모두 확인을 통과한 목소리
const LAB_WORDS = {
  voice: () => (S.pair ? [S.pair] : RVS.LISTEN_PAIRS).map(id => RVS.pairById(id)).reduce((a, p) => a.concat([p.a, p.b]), []),
  mapVoice: () => S.gword ? [S.gword, RV.partner(S.gword)] : RV.MAP,
  f3Voice: () => S.rword ? [S.rword, RV.partner(S.rword)] : RVS.R_BARS,
  triVoice: () => S.tri != null ? RV.TRI[S.tri] : RV.TRI.reduce((a, r) => a.concat(r), []),
};
const labOk = key => okFor(LAB_WORDS[key]());
const fixVoices = () => Object.keys(LAB_WORDS).forEach(key => { if (S[key] && labOk(key).indexOf(S[key]) < 0) S[key] = null; });
const wordPick = (list, cur, attr, o = {}) => `<div class="wrow sel">${list.map(k => `<button type="button" class="pickw${cur === k ? ' on' : ''}" data-${attr}="${esc(k)}" aria-pressed="${cur === k}">${o.ko ? koHTML(k) : wordHTML(k)}</button>`).join('')}</div>`;
const SIDE_GRP = [['o', '오 짝 — oʊ · ɑ ɔ'], ['r', 'r 짝 — ɝ · ʌ']];
const pairSel = (cur, attr, list, blank = '영상대로') => {
  const groups = SIDE_GRP.filter(([sd]) => list.some(p => p.side === sd));
  return `<select class="lab-sel" data-sel="${attr}" aria-label="짝 고르기">${blank ? `<option value="">${esc(blank)}</option>` : ''}${groups.map(([sd, lab]) => `<optgroup label="${esc(lab)}">${list.filter(p => p.side === sd).map(p => `<option value="${p.id}"${cur === p.id ? ' selected' : ''}>${esc(RV.word(p.a))} · ${esc(RV.word(p.b))}</option>`).join('')}</optgroup>`).join('')}</select>`;
};
const GLIDE_PICK = RV.pairsOf('o').map(p => p.a);
const R_PICK = RV.pairsOf('r').map(p => p.a);
const O_SAME = RV.pairsOf('o').filter(p => RV.koSame(p.a, p.b)).length;
const LABS = {
  intro() {
    return labHead('먼저 들어 보기') + `<p>외투 · 잡았다 → 영어로 눌러 들어 보세요. 한국어식 표기는 둘 다 ${koHTML('coat')}예요.</p>
      ${pairBox(RVS.pairById('coat-caught'))}
      <div class="wrow"><span class="note">한국어식</span>${koBtn('coat')}</div>
      ${voices4(sp => pairSeq('coat', 'caught', sp), '목소리 넷으로 짝 듣기')}
      <div class="wrow"><span class="note">r 짝</span>${wBtn('work')}${wBtn('walk')}${koBtn('work')}</div>
      <p class="note">같은 단추를 곧바로 다시 누르면 천천히 들려줘요. 노란 글자 = 미끄러지는 오 · r 모음, 하늘색 글자 = 짝 소리예요.</p>`;
  },
  listen() {
    const p = S.pair ? RVS.pairById(S.pair) : null, sp = S.voice || 'tc';
    let h = labHead('짝 고르기') + row('짝', pairSel(S.pair, 'pair', RV.PAIRS)) + row('목소리', voiceSeg(S.voice, 'vc', '밝은 선생님', labOk('voice')).replace('data-vc="tc"', 'data-vc="tc" hidden')) + offNote(labOk('voice'));
    if (!p) return h + '<p class="note">짝을 고르면 영상이 멈추고 그 짝과 잰 그림(오 짝은 모음 지도, r 짝은 r 울림 막대)을 크게 보여 줘요. 목소리를 바꾸면 영상의 네 짝도 그 목소리로 바뀌어요. 본격적인 연습은 아래 <a href="#playground">듣고 가르기 훈련</a>에서 해요.</p>';
    return h + pairBox(p, sp) + `<div class="lab-fig">${pairFig(p, sp, { w: 280, h: 180 })}</div>
      <div class="wrow"><span class="note">한국어식</span>${koBtn(p.a)}${RV.koSame(p.a, p.b) ? '' : koBtn(p.b)}${lpBtn(pairSeq(p.a, p.b, sp), '이어서 듣기', 'lp-voice', `${ICO.play}<span>이어서</span>`)}</div>
      <p class="note">${RV.koSame(p.a, p.b) ? `한국어식으로는 같은 표기예요. 영어에서는 ${p.side === 'r' ? 'r 울림' : '끝의 미끄러짐'}이 두 낱말을 갈라요.` : `한국어식 표기는 달라도, ${p.side === 'r' ? 'r 울림은 한글에 보이지 않아요' : '미끄러짐은 한글에 보이지 않아요'}.`}</p>
      ${voices4(v => pairSeq(p.a, p.b, v), '목소리 넷으로 짝 듣기')}` + clearBtn;
  },
  glide() {
    const k = S.gword, sp = S.mapVoice || 'tc', ws = k ? [k, RV.partner(k)] : RV.MAP;
    let h = labHead('미끄러지는 오 · 낱말 고르기') + row('낱말', wordPick(GLIDE_PICK, k, 'gw')) + row('목소리', voiceSeg(sp, 'mv', null, labOk('mapVoice'))) + offNote(labOk('mapVoice'));
    h += `<div class="lab-fig">${vmapSVG(ws, sp, { w: 300, h: 200 })}</div>
      <div class="wrow">${ws.map(w => wBtn(w, sp)).join('')}${lpBtn(ws.map((w, i) => ({ text: RV.word(w), sp, gap: i ? 0.6 : 0 })), `${NUM[ws.length]} 이어서 듣기`, 'lp-voice', `${ICO.play}<span>${NUM[ws.length]} 이어서</span>`)}</div>`;
    if (!k) return h + '<p class="note">낱말을 고르면 영상이 멈추고 입 모양이 오 → 우로 미끄러지는 모습과, 그 낱말과 짝을 잰 지도를 보여 줘요. 화살표는 모음의 처음 → 끝이에요. 목소리를 고르면 영상의 지도도 바뀌어요.</p>';
    const v = RV.vowel(k);
    return h + `<p class="enline">${vTag(v)} ${wBtn(k)} <span class="note">${esc(RV.ipa(k))} · ${esc(RV.entry(k).gloss)}</span></p><p class="note">${esc(RV.V[v].tip)}</p><div class="wrow"><span class="note">한국어식</span>${koBtn(k)}</div>` + clearBtn;
  },
  open() {
    const p = S.opair ? RVS.pairById(S.opair) : null;
    let h = labHead('크게 벌린 아 · 짝 고르기') + row('짝', pairSel(S.opair, 'opair', RV.pairsOf('o')));
    if (!p) return h + `<p class="note">짝을 고르면 영상이 멈추고 표에서 그 짝을 칠해 보여 줘요. 열 쌍 가운데 ${O_SAME}쌍이 한국어식으로 같은 표기예요.</p>`;
    return h + pairBox(p) + `<div class="lab-fig">${vmapSVG([p.a, p.b], 'tc', { w: 280, h: 180 })}</div>
      <div class="wrow"><span class="note">한국어식</span>${koBtn(p.a)}${RV.koSame(p.a, p.b) ? '' : koBtn(p.b)}</div>
      <p class="note">${RV.koSame(p.a, p.b) ? '한국어식으로 같은 표기예요.' : '한국어식 표기는 달라요.'} ${esc(RV.V[RV.vowel(p.b)].tip)}</p>
      ${voices4(v => pairSeq(p.a, p.b, v), '목소리 넷으로 짝 듣기')}` + clearBtn;
  },
  rvowel() {
    const k = S.rword, sp = S.f3Voice || 'tc', ws = k ? [k, RV.partner(k)] : RVS.R_BARS;
    let h = labHead('r을 품은 어 · 낱말 고르기') + row('낱말', wordPick(R_PICK, k, 'rw')) + row('목소리', voiceSeg(sp, 'fv', null, labOk('f3Voice'))) + offNote(labOk('f3Voice'));
    h += `<div class="lab-fig">${f3SVG(ws.map(w => ({ k: w, sp })), { w: 300, h: 190, note: `${WHO[sp]} · 세 번째 공명(Hz) · 낮을수록 r 울림` })}</div>
      <div class="wrow">${ws.map(w => wBtn(w, sp)).join('')}</div>`;
    if (!k) return h + '<p class="note">낱말을 고르면 영상이 멈추고 그 낱말과 짝의 r 울림 막대를 보여 줘요. 막대는 모음 앞쪽의 세 번째 공명이에요. 혀가 r 모양이면 뚝 내려가요.</p>';
    const v = RV.vowel(k);
    return h + `<p class="enline">${vTag(v)} ${wBtn(k)} <span class="note">${esc(RV.ipa(k))} · ${esc(RV.entry(k).gloss)}</span></p><p class="note">${esc(RV.V[v].tip)}</p><div class="wrow"><span class="note">한국어식</span>${koBtn(k)}</div>` + clearBtn;
  },
  tri() {
    const i = S.tri, sp = S.triVoice || 'tc';
    let h = labHead('셋이 갈리는 줄 고르기') + row('줄', `<div class="wrow sel">${RV.TRI.map((r, k) => `<button type="button" class="pickw${i === k ? ' on' : ''}" data-tri="${k}" aria-pressed="${i === k}"><span lang="en">${r.map(esc).join(' · ')}</span></button>`).join('')}</div>`) +
      row('목소리', voiceSeg(S.triVoice, 'tv', '밝은 선생님', labOk('triVoice')).replace('data-tv="tc"', 'data-tv="tc" hidden')) + offNote(labOk('triVoice'));
    const r = RV.TRI[i == null ? 0 : i];
    h += `<div class="tri-cards">${r.map(k => `<div class="pb ${rc(RV.vowel(k))}"><span class="pb-h">${vTag(RV.vowel(k))}</span>${wBtn(k, sp)}<small>${esc(RV.ipa(k))} · ${esc(RV.entry(k).gloss)}</small>${RV.entry(k).ko ? koBtn(k) : ''}</div>`).join('')}</div>
      <div class="wrow">${lpBtn(r.map((k, j) => ({ text: RV.word(k), sp, gap: j ? 0.6 : 0 })), '셋 이어서 듣기', 'lp-voice', `${ICO.play}<span>셋 이어서</span>`)}</div>
      <p class="note">r을 품은 어는 처음부터 r, 아 + r은 아로 시작해 끝에서 r로 옮겨 가요. 한국어식 표기에는 r이 보이지 않아요.</p>`;
    return h + (i == null && !S.triVoice ? '<p class="note">줄을 고르면 영상이 멈추고 그 줄을 크게 보여 줘요.</p>' : clearBtn);
  },
  weak() {
    const k = S.wword, w = k || 'water';
    let h = labHead('약한 r 모음 · 낱말 고르기') + row('낱말', wordPick(RVS.WEAK_WORDS, k, 'ww'));
    h += `<div class="lab-fig">${f3SVG(RV.VOICES.map(v => ({ k: w, sp: v.sp, lab: v.ko })).concat([{ k: w, sp: 'ko', lab: '한국어식' }]), { w: 320, h: 190, note: `${RV.word(w)} 끝 음절의 세 번째 공명(Hz) · 낮을수록 r 울림` })}</div>
      ${voices4(sp => wSeq(w, sp), `${RV.word(w)} · 목소리 넷`)}<div class="wrow"><span class="note">한국어식</span>${koBtn(w)}</div>`;
    if (!k) return h + '<p class="note">낱말을 고르면 영상이 멈추고 그 낱말의 끝 음절을 목소리 넷과 한국어식으로 잰 막대를 보여 줘요.</p>';
    return h + `<p class="note">${esc(RV.ipa(k))} · ${esc(RV.entry(k).gloss)} · ${esc(RV.V['ɚ'].tip)}</p>` + clearBtn;
  },
  loan() {
    const k = S.loan;
    let h = labHead('외래어 하나씩') + row('낱말', wordPick(RV.LOAN.map(o => o.w), k, 'ln', { ko: true }));
    if (!k) return h + '<p class="note">한글 표기를 고르면 영어의 목표 모음이 무엇인지, 한글 표기가 무엇을 감추는지 보여 줘요.</p>';
    const v = RV.vowel(k), row0 = RV.LROWS.find(r => r.words.indexOf(k) >= 0), hide = RV.koHides(k);
    return h + `<div class="wrow">${koBtn(k)}<span class="arr">→</span>${wBtn(k)}${vTag(v)}</div>
      <p class="note">${hide ? `<mark class="mk-trap">감춤</mark> ${esc(RV.HIDE_KO[hide])}` : `<mark class="mk-trap">함정</mark> 한글로는 오로 적지만, 영어는 ${esc(RV.V[v].ko)}예요 — 끝까지 미끄러지지 않아요.`}</p>
      <p class="note">${esc(RV.ipa(k))} · ${esc(RV.entry(k).gloss)} · 같은 줄(${esc(row0.ko)}) → ${row0.words.map(x => wordHTML(x)).join(' · ')}</p><p class="note">${esc(RV.V[v].tip)}</p>` + clearBtn;
  },
  sentence() {
    const opts = RV.SGRP_ORDER.map(gk => `<optgroup label="${esc(RV.SGRP[gk].long)}">${RV.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk).map(([s, i]) => `<option value="${i}"${S.sent === i ? ' selected' : ''}>${esc(s.en)}</option>`).join('')}</optgroup>`).join('');
    let h = labHead('문장 고르기') + row('문장', `<select class="lab-sel" data-sel="sent" aria-label="문장 고르기"><option value="">영상대로</option>${opts}</select>`);
    if (S.sent == null) return h + '<p class="note">따라 말하기의 28문장 가운데 하나를 고르면 영상에 크게 보여 줘요.</p>';
    const s = RV.SENT[S.sent];
    return h + `<p class="enline">${lpBtn(tSeq(s.en), '듣기: ' + s.en)}${sentHTML(s.en)}</p><p class="note">${esc(s.ko)}</p><div class="wrow">${RV.wordsIn(s.en).map(k => wBtn(k)).join('')}</div>` + clearBtn;
  },
  summary() {
    return labHead('이제 직접') + `<p>아래 <a href="#playground">듣고 가르기 훈련</a>에서 목소리 넷으로 짝을 가르고, <a href="#mypron">내 발음 확인</a>에서 음성 인식이 내 말을 어느 낱말로 듣는지, <a href="#myvowel">내 모음 찍기</a>에서 내 오가 미끄러지는지 · 내 r 울림이 낮은지 확인해 보세요. <a href="#shadow">따라 말하기</a> 28문장과 <a href="#drill">듣고 고르기</a> 16문제도 있어요.</p>
      <p class="note">caught · cot → 많은 미국 사람이 같은 소리(크게 벌린 아)로 말해요. 그래서 이 튜토리얼은 사전의 ɔ와 ɑ를 함께 짝 소리로 다뤄요.</p>`;
  },
};
function buildLab(ci) {
  const id = CHAPTERS[ci].id;
  fixVoices();
  $('lab').innerHTML = (LABS[id] || (() => ''))();
}
const relab = () => buildLab(RVS.chapterAt(T));
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
  const d = b.dataset;
  if (b.id === 'labClear') { Object.assign(S, JSON.parse(RVS.DEFAULTS)); dirty = true; relab(); return; }
  if (d.vc != null) { S.voice = d.vc && d.vc !== 'tc' ? d.vc : null; showAt(S.pair ? 21 : 33); relab(); return; }
  if (d.mv != null) { S.mapVoice = d.mv === 'tc' ? null : d.mv; showAt(20); relab(); return; }
  if (d.gw != null) { S.gword = S.gword === d.gw ? null : d.gw; idleT = 0; showAt(S.gword ? 20 : 1); relab(); return; }
  if (d.rw != null) { S.rword = S.rword === d.rw ? null : d.rw; showAt(S.rword ? 30 : 1); relab(); return; }
  if (d.fv != null) { S.f3Voice = d.fv === 'tc' ? null : d.fv; showAt(30); relab(); return; }
  if (d.tri != null) { S.tri = S.tri === +d.tri ? null : +d.tri; showAt(S.tri == null ? 1 : 20); relab(); return; }
  if (d.tv != null) { S.triVoice = d.tv && d.tv !== 'tc' ? d.tv : null; showAt(20); relab(); return; }
  if (d.ww != null) { S.wword = S.wword === d.ww ? null : d.ww; showAt(S.wword ? 20 : 1); relab(); return; }
  if (d.ln != null) { S.loan = S.loan === d.ln ? null : d.ln; showAt(40); relab(); return; }
});
$('lab').addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.sel) return;
  const v = t.value;
  if (t.dataset.sel === 'pair') { S.pair = v || null; showAt(v ? 21 : 1); }
  else if (t.dataset.sel === 'opair') { S.opair = v || null; showAt(v ? 26 : 1); }
  else if (t.dataset.sel === 'sent') { S.sent = v === '' ? null : +v; showAt(8); }
  relab();
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   자막의 홀로 쓴 r은 한국어 음성으로 ‘알’, ㄹ은 ‘리을’로 읽어요(영어 음성이 r 한 글자를 읽고 조사가 붙는 것을 막음)
   ========================================================= */
const LETTER_KO = { r: '알' };
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/ㄹ/g, '리을'], [/(^|[^A-Za-z'’-])(r)(?=[\s가-힣.,·)]|$)/g, (m, a, c) => a + LETTER_KO[c]], [/\s\+\s/g, ', '], [/ = /g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
  enRate: RVV.EN_RATE,      // 영어 조각만 살짝 느리게 (voices.js의 EN_RATE — 낱말 소리와 같은 빠르기)
  clips: window.EN_CLIPS,   // 미리 만든 음성 파일(audio/narration/) — 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };
if (window.EN && EN.say) EN.say.rate = RVV.EN_RATE;   // 발음 듣기 단추도 같은 빠르기

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
   기록은 이 브라우저에만(localStorage 'en-rv-hvpt-v1'). 키보드: R 듣기 · A · B(1 · 2) 고르기 · Space/Enter 다음
   ========================================================= */
const HV_KEY = 'en-rv-hvpt-v1';
const SIDE_KO = { o: '오 짝 (oʊ · ɑ ɔ)', r: 'r 짝 (ɝ · ʌ)' };
const HV_GRP = [['all', '모두'], ['o', '오 짝'], ['r', 'r 짝']];
const hvPool = side => RV.PAIRS.filter(p => side === 'all' || p.side === side);
const HV = { side: 'all', voice: 'all', cur: null, pick: null, stats: null, streak: 0, last: null };
const hvEmpty = () => ({ side: { o: [0, 0], r: [0, 0] }, role: { a: [0, 0], b: [0, 0] }, voice: { tc: [0, 0], tf: [0, 0], uf: [0, 0], um: [0, 0] } });
function hvLoad() { try { const s = JSON.parse(localStorage.getItem(HV_KEY) || 'null'); HV.stats = s && s.side && s.side.o && s.voice && s.role ? s : hvEmpty(); } catch (e) { HV.stats = hvEmpty(); } }
function hvSave() { try { localStorage.setItem(HV_KEY, JSON.stringify(HV.stats)); } catch (e) { /* 저장하지 못해도 이번에는 계속 */ } }
// 짝의 두 낱말이 모두 확인(받아쓰기 · 짝과의 차이)을 통과한 목소리만 — 통과한 줄만 잰 값이 있어요.
// 받아쓰기가 짝 낱말로 적은 소리를 들려주고 틀렸다고 하지 않게. 잰 값 파일이 없으면 넷 다 써요.
const okVoices = p => RV.VOICES.map(v => v.sp).filter(sp => !!RVV.meas(sp, RV.word(p.a)) && !!RVV.meas(sp, RV.word(p.b)));
function hvNew(auto) {
  const all = hvPool(HV.side).filter(p => p.id !== HV.last);
  const vp = all.filter(p => HV.voice === 'all' ? okVoices(p).length : okVoices(p).includes(HV.voice));
  const pool = vp.length ? vp : all;
  const p = pickOne(pool), ok = okVoices(p);
  const sp = HV.voice === 'all' ? pickOne(ok.length ? ok : RV.VOICES.map(v => v.sp)) : HV.voice, w = Math.random() < 0.5 ? p.a : p.b;
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
  if (!c) h = `<p class="hv-hello">목소리 넷 가운데 하나가 짝 낱말 가운데 하나를 말해요. 듣고 어느 낱말인지 고르면, 그 목소리를 잰 그림(오 짝은 모음 지도, r 짝은 r 울림 막대)과 한국어식 표기가 나타나요. 끝에서 우 쪽으로 미끄러지나, 모음 내내 r 울림이 이어지나를 들어 보세요.</p><div class="acts"><button type="button" class="btn" id="hvStart">${ICO.play} 시작하기</button></div>`;
  else {
    const { p, w, sp } = c, done = HV.pick !== null, ans = w === p.a ? 0 : 1, ok = done && HV.pick === ans;
    h += `<div class="hv-top"><button type="button" class="btn hv-play" id="hvPlayBtn">${ICO.play} 듣기 <small>R</small></button><button type="button" class="btn ghost" id="hvSlow">${ICO.slow} 천천히</button><span class="hv-who">${esc(WHO[sp])} · ${esc(SIDE_KO[p.side])}</span></div>`;
    h += `<div class="hv-opts">${[p.a, p.b].map((k, i) => `<button type="button" class="hv-opt${done ? (i === ans ? ' right' : i === HV.pick ? ' wrong' : ' off') : ''}" data-hv="${i}"${done ? ' disabled' : ''}><b>${L2[i]}</b><span>${wordHTML(k, { paint: done })}</span><small>${esc(RV.entry(k).gloss)}${done ? ' · ' + esc(RV.V[RV.vowel(k)].ko) : ''}</small></button>`).join('')}</div>`;
    if (done) {
      h += `<p class="verdict"><b class="${ok ? 'c-ok' : 'c-no'}">${ok ? '맞아요' : '아쉬워요'}</b>들은 낱말 → ${wordHTML(w)} ${esc(RV.ipa(w))} · ${esc(RV.V[RV.vowel(w)].ko)}${HV.streak > 1 ? ` · 연속 ${HV.streak}번!` : ''}</p>`;
      h += `<div class="hv-fig">${pairFig(p, sp, { w: 260, h: 172 })}<div class="hv-side"><div class="wrow">${wBtn(p.a, sp)}${wBtn(p.b, sp)}${lpBtn(pairSeq(p.a, p.b, sp), '이어서 듣기', 'lp-voice', `${ICO.play}<span>이어서</span>`)}</div><div class="wrow"><span class="note">한국어식</span>${koBtn(p.a)}${RV.koSame(p.a, p.b) ? '' : koBtn(p.b)}</div><p class="note">${esc(RV.V[RV.vowel(w)].tip)}</p></div></div>`;
      h += `<div class="acts"><button type="button" class="btn" id="hvNext">다음 <small>Space</small></button></div>`;
    }
  }
  box.innerHTML = h;
  const st = HV.stats;
  const all = [st.side.o[0] + st.side.r[0], st.side.o[1] + st.side.r[1]];
  const tr = (lab, v) => `<tr><th scope="row">${esc(lab)}</th><td>${v[0]} / ${v[1]}</td><td><span class="meter"><i style="width:${pct(v) == null ? 0 : pct(v)}%"></i></span>${pctTxt(v)}</td></tr>`;
  $('hvStats').innerHTML = `<table class="hv-tab"><caption>맞힌 비율 (이 브라우저에만 저장)</caption><tbody>${tr(SIDE_KO.o, st.side.o)}${tr(SIDE_KO.r, st.side.r)}${tr('들은 낱말이 목표 소리(oʊ · ɝ)', st.role.a)}${tr('들은 낱말이 짝 소리', st.role.b)}<tr class="all"><th scope="row">모두</th><td>${all[0]} / ${all[1]}</td><td>${pctTxt(all)}</td></tr></tbody></table>
    <p class="note">목소리마다: ${RV.VOICES.map(v => `${esc(v.ko)} ${pctTxt(st.voice[v.sp])}`).join(' · ')}</p>`;
}
function hvInit() {
  hvLoad();
  $('hvCtl').innerHTML = row('짝', seg('짝 묶음 고르기', HV_GRP, HV.side, 'hvg')) +
    row('목소리', seg('목소리 고르기', [['all', '넷 섞어서']].concat(RV.VOICES.map(v => [v.sp, v.ko])), HV.voice, 'hvv'));
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
const MP = { pair: RV.MP_PAIRS[0].id, side: 'a', url: null, res: null, busy: false };
const mpTarget = () => { const p = RV.MP_PAIRS.find(x => x.id === MP.pair); return { p, w: MP.side === 'a' ? p.a : p.b, other: MP.side === 'a' ? p.b : p.a }; };
const MP_FIX = {
  o: { a: '크게 벌린 아로 들렸어요. 오로 시작해 입술을 더 모으며 우 쪽으로 미끄러져', b: '미끄러지는 오로 들렸어요. 턱을 크게 내리고 입술을 모으지 말고 끝까지 그대로' },
  r: { a: 'r 없는 소리로 들렸어요. 혀를 처음부터 r 모양으로(혀 몸통을 뭉쳐 올리거나 혀끝을 살짝 젖혀) 둔 채', b: 'r을 품은 어로 들렸어요. 혀를 r 모양으로 하지 말고 쉬게 둔 채' },
};
const sideLab = (p, s) => { const k = s === 'a' ? p.a : p.b; return `${RV.word(k)} · ${RV.V[RV.vowel(k)].ko}`; };
function mpDraw() {
  const { p, w, other } = mpTarget();
  let h = `<div class="mp-ctl">${row('짝', pairSel(MP.pair, 'mp', RV.MP_PAIRS, '').replace('data-sel="mp"', 'id="mpSel"'))}${row('말할 낱말', seg('말할 낱말', [['a', esc(sideLab(p, 'a'))], ['b', esc(sideLab(p, 'b'))]], MP.side, 'mpside'))}</div>`;
  h += `<div class="mp-body"><div class="mp-fig">${pairFig(p, 'tc', { w: 200, h: 150 })}</div>
    <div class="mp-word"><p class="mp-big">${wordHTML(w)}</p><p class="note">${esc(RV.ipa(w))} · ${esc(RV.entry(w).gloss)} · 짝 → ${wordHTML(other)}</p>
    <p class="note">${vTag(RV.vowel(w))} ${esc(RV.V[RV.vowel(w)].tip)}</p>
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
    h += `<p class="verdict"><b class="${cls}">${esc(RV.HEARD_KO[r.verdict])}</b>${r.verdict === 'partner' ? `받아 적은 말 → 짝 낱말 ${esc(RV.word(r.partner))}. ${esc(MP_FIX[p.side][MP.side])} 다시 해 보세요.` : r.verdict === 'target' ? '인식기가 목표 낱말로 받아 적었어요.' : r.verdict === 'maybe' ? `목표 낱말 → ${r.rank}번째 후보. 조금 더 또렷하게 해 보세요.` : r.verdict === 'other' ? '목표 낱말도 짝 낱말도 아닌 말로 받아 적었어요. 낱말 하나만 또박또박 말해 보세요.' : ''}</p>`;
    if (r.alts && r.alts.length) h += `<p class="note">인식 후보: ${r.alts.map((a, i) => `<span class="alt${i === 0 ? ' top' : ''}" lang="en">${esc(a)}</span>`).join(' · ')}</p>`;
  }
  if (MP.err) h += `<p class="sh-err">${esc(MP.err)}</p>`;
  if (MP.url) h += `<div class="mo"><button type="button" class="sh-play" id="mpMine">${ICO.play} 내 목소리</button>${RVV.supported ? `<button type="button" class="sh-play" id="mpModel">${ICO.play} 본보기</button><button type="button" class="sh-play" id="mpBoth">${ICO.play} 번갈아 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`;
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
        onText(alts) { MP.res = Object.assign(RV.heard(w, alts), { alts }); mpResult(); },
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
        if (url) playUrl(url, $('mpMine'), () => { if (RVV.supported) speak(wSeq(w)); });
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
   10. 놀이터 ③ 내 모음 찍기 (시험 기능) — 짝 낱말 둘을 녹음하면 브라우저 안에서 재서
   오 짝 → 모음의 처음 · 끝(F1 · F2)을 지도에 화살표로(미끄러지나), r 짝 → 모음 앞쪽의 세 번째 공명(F3)을 막대로(r 울림이 낮나)
   잰 방법은 tools/measure-syllables.py와 같게 줄였어요: 표본율 = 상한 × 2, 앞 강조 0.97, 25ms 해밍 창, 5ms 간격,
   크기가 가장 큰 곳에서 10dB 안쪽(모음 길이) · 6dB 안쪽(모음 몸통)의 틀마다
   10차 LPC(자기상관 · 레빈슨) → 근(뒤랑-케르너) → F1 = 180~1100Hz의 가장 낮은 공명, F2 = 그보다 250Hz 넘게 높은 첫 공명(대역폭 600Hz 아래),
   12차 LPC → F3 = F2보다 150Hz 넘게 높은 첫 공명(대역폭 700Hz 아래).
   몸통의 15~35% · 65~85% 틀의 가운데 값 = 처음 · 끝, 25~75% = 가운데, F3는 15~45%.
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
  const cands = (A, sr) => roots(Array.from(A)).filter(([r, i]) => i > 0.01).map(([r, i]) => ({ f: Math.atan2(i, r) * sr / (2 * Math.PI), bw: -Math.log(Math.hypot(r, i)) * sr / Math.PI }));
  // x: 표본율 sr(= 상한 × 2)의 소리 → { F1, F2, G: [[F1, F2], [F1, F2]] | null, F3 | null, vd(ms), frames } | { err }
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
    const [na, nb] = run(10), [ca, cb] = run(6);
    if (cb - ca < 6) return { err: 'short' };
    const y = new Float64Array(x.length); y[0] = x[0];
    for (let i = 1; i < x.length; i++) y[i] = x[i] - 0.97 * x[i - 1];
    const ham = new Float64Array(win); for (let i = 0; i < win; i++) ham[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (win - 1));
    const rows = [];
    for (let fi = ca; fi <= cb; fi++) {
      const s0 = fi * hop - (win >> 1); if (s0 < 0 || s0 + win > y.length) continue;
      const fr = new Float64Array(win); let mx = 0;
      for (let i = 0; i < win; i++) { fr[i] = y[s0 + i] * ham[i]; mx = Math.max(mx, Math.abs(fr[i])); }
      if (mx < 1e-5) continue;
      const A = lpc(fr, 10); if (!A) continue;
      const cand = cands(A, sr);
      const c1 = cand.filter(o => o.f >= 180 && o.f <= 1100 && o.bw < 600).map(o => o.f).sort((a, b) => a - b);
      if (!c1.length) continue;
      const c2 = cand.filter(o => o.f > c1[0] + 250 && o.f >= 600 && o.f <= ceiling - 300 && o.bw < 600).map(o => o.f).sort((a, b) => a - b);
      if (!c2.length) continue;
      let f3 = null;
      const B = lpc(fr, 12);
      if (B) { const c3 = cands(B, sr).filter(o => o.f > c2[0] + 150 && o.f <= ceiling - 150 && o.bw < 700).map(o => o.f).sort((a, b) => a - b); if (c3.length) f3 = c3[0]; }
      rows.push({ p: (fi - ca) / Math.max(1, cb - ca), f1: c1[0], f2: c2[0], f3 });
    }
    // 뒤 모음에서는 F1 · F2가 한 봉우리로 붙어 F3를 F2로 잡는 프레임이 섞여요 — F2가 900Hz 넘게 떨어진 두 무리로 갈리면 낮은 무리만 써요
    // (낮은 무리가 30% 이상일 때, 측정 도구와 같은 규칙)
    if (rows.length > 3) {
      const f2 = rows.map(r => r.f2).sort((a, b) => a - b);
      let gi = 0, gm = 0;
      for (let i = 1; i < f2.length; i++) if (f2[i] - f2[i - 1] > gm) { gm = f2[i] - f2[i - 1]; gi = i; }
      if (gm > 900) { const cut = f2[gi - 1], low = rows.filter(r => r.f2 <= cut); if (low.length >= 0.3 * rows.length) rows.splice(0, rows.length, ...low); }
    }
    const inR = (a, b) => rows.filter(r => r.p >= a && r.p <= b);
    const mid = inR(0.25, 0.75);
    if (mid.length < 3) return { err: 'formant' };
    const pt = rs => [Math.round(median(rs.map(r => r.f1))), Math.round(median(rs.map(r => r.f2)))];
    const s = inR(0.15, 0.35), e = inR(0.65, 0.85), f3s = inR(0.15, 0.45).filter(r => r.f3).map(r => r.f3);
    const [F1, F2] = pt(mid);
    return { F1, F2, G: s.length >= 2 && e.length >= 2 ? [pt(s), pt(e)] : null, F3: f3s.length >= 3 ? Math.round(median(f3s)) : null, vd: Math.round((nb - na + 1) * 5), frames: rows.length };
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
const MV_PAIRS = ['coat-caught', 'boat-bought', 'note-not', 'hope-hop', 'work-walk', 'bird-bud', 'hurt-hut', 'burn-bun'].map(id => RVS.pairById(id));
const MV_ERR = {
  short: '모음을 찾지 못했어요. 낱말 하나를 또렷하게, 모음을 조금 길게 말해 보세요.',
  quiet: '소리가 작거나 잡음이 많아요. 조용한 곳에서 마이크 가까이 말해 보세요.',
  formant: '모음의 공명을 재지 못했어요. 다시 녹음해 보거나, 목소리 높낮이 설정을 바꿔 보세요.',
  decode: '이 브라우저에서는 녹음한 소리를 풀어 잴 수 없어요.',
};
const MV = { pair: 'coat-caught', ceil: 5500, res: { a: null, b: null }, url: { a: null, b: null }, busy: false, err: null };
const MV_RANGE = { 5500: { f1: [300, 1200], f2: [600, 2200] }, 5000: { f1: [250, 1000], f2: [550, 1900] } };
const sgn = d => `${d > 0 ? '+' : ''}${d}`;
// 내 지도(오 짝): 미끄러지는 오 = 처음 → 끝 화살표, 짝 = 처음 → 끝을 옅게 + 가운데 점
function mvMapSVG(p) {
  const R = MV_RANGE[MV.ceil], Wd = 320, Hh = 230, x = 40, y = 26, w = Wd - 64, h = Hh - y - 40;
  const X = f2 => x + clamp((R.f2[1] - f2) / (R.f2[1] - R.f2[0])) * w, Y = f1 => y + clamp((f1 - R.f1[0]) / (R.f1[1] - R.f1[0])) * h;
  let s = `<path class="vm-box" d="M${x} ${y}H${x + w}V${y + h}H${(x + w * 0.32).toFixed(1)}Z"/>`;
  s += `<text class="vm-ax" x="${x}" y="${y - 8}">앞 (F2 높음)</text><text class="vm-ax" x="${x + w}" y="${y - 8}" text-anchor="end">뒤</text>`;
  s += `<text class="vm-ax" x="${x - 6}" y="${y + 10}" text-anchor="end">↑</text><text class="vm-ax" x="${x - 6}" y="${y + h}" text-anchor="end">↓</text>`;
  [R.f2[0], Math.round((R.f2[0] + R.f2[1]) / 2 / 100) * 100, R.f2[1]].forEach(f => { s += `<text class="vm-tick" x="${X(f).toFixed(1)}" y="${y + h + 16}" text-anchor="middle">${f}</text>`; });
  s += `<text class="vm-tick" x="${x + w + 6}" y="${y + 4}">F1 ${R.f1[0]}</text><text class="vm-tick" x="${x + w + 6}" y="${y + h}">${R.f1[1]}</text>`;
  const desc = [];
  [['a', p.a], ['b', p.b]].forEach(([sd, k]) => {
    const r = MV.res[sd]; if (!r || !r.F1) return;
    if (r.G) {
      const [x0, y0, x1, y1] = [X(r.G[0][1]), Y(r.G[0][0]), X(r.G[1][1]), Y(r.G[1][0])], L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      s += `<circle class="vm-pt st ${sd}" cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="6"/>`;
      if (L > 12) s += `<line class="vm-arr ${sd}" x1="${(x0 + ux * 7).toFixed(1)}" y1="${(y0 + uy * 7).toFixed(1)}" x2="${(x1 - ux * 4).toFixed(1)}" y2="${(y1 - uy * 4).toFixed(1)}" marker-end="url(#mvh${sd})"/>`;
      s += `<text class="vm-lb ${sd}" x="${x0.toFixed(1)}" y="${(y0 + (y1 < y0 ? 21 : -12)).toFixed(1)}" text-anchor="middle">${esc(RV.word(k))}</text>`;
      desc.push(`${RV.word(k)} 처음 F1 ${r.G[0][0]} F2 ${r.G[0][1]} → 끝 F1 ${r.G[1][0]} F2 ${r.G[1][1]}`);
    } else {
      const cx = X(r.F2), cy = Y(r.F1);
      s += `<circle class="vm-pt ${sd}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8"/><text class="vm-lb ${sd}" x="${cx.toFixed(1)}" y="${(cy + 23).toFixed(1)}" text-anchor="middle">${esc(RV.word(k))}</text>`;
      desc.push(`${RV.word(k)} F1 ${r.F1} F2 ${r.F2}`);
    }
  });
  if (!desc.length) s += `<text class="vm-note" x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle">녹음하면 여기에 화살표가 그려져요</text>`;
  s += `<text class="vm-note" x="${Wd / 2}" y="${Hh - 6}" text-anchor="middle">내 목소리를 이 브라우저에서 잰 어림값 · 화살표 = 모음의 처음 → 끝</text>`;
  return `<svg class="vm my" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="내 모음 지도 — ${esc(desc.join(', ') || '아직 녹음 없음')}"><defs>${['a', 'b'].map(c => `<marker id="mvh${c}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="vm-head ${c}"/></marker>`).join('')}</defs>${s}</svg>`;
}
// 내 막대(r 짝): 모음 앞쪽의 세 번째 공명
function mvBarsSVG(p) {
  const Wd = 320, Hh = 230, x = 46, y = 24, w = Wd - x - 20, h = Hh - y - 56, LO = 1000, HI = 3600, bw = 70;
  const Yh = hz => y + h - clamp((hz - LO) / (HI - LO)) * h;
  let s = '';
  [1500, 2000, 2500, 3000, 3500].forEach(hz => { s += `<line class="fb-grid" x1="${x}" x2="${x + w}" y1="${Yh(hz).toFixed(1)}" y2="${Yh(hz).toFixed(1)}"/><text class="vm-tick" x="${x - 5}" y="${(Yh(hz) + 3.5).toFixed(1)}" text-anchor="end">${hz}</text>`; });
  const desc = [];
  [['a', p.a], ['b', p.b]].forEach(([sd, k], i) => {
    const r = MV.res[sd], bx = x + w * (i ? 0.66 : 0.34) - bw / 2;
    if (r && r.F3) {
      s += `<rect class="fb-bar ${sd}" x="${bx.toFixed(1)}" y="${Yh(r.F3).toFixed(1)}" width="${bw}" height="${(y + h - Yh(r.F3)).toFixed(1)}" rx="5"/><text class="fb-v ${sd}" x="${(bx + bw / 2).toFixed(1)}" y="${(Yh(r.F3) - 6).toFixed(1)}" text-anchor="middle">${r.F3}</text>`;
      desc.push(`${RV.word(k)} F3 ${r.F3}`);
    } else s += `<rect class="fb-empty" x="${bx.toFixed(1)}" y="${(y + h / 2).toFixed(1)}" width="${bw}" height="${(h / 2).toFixed(1)}" rx="5"/>`;
    s += `<text class="fb-lb ${sd}" x="${(bx + bw / 2).toFixed(1)}" y="${y + h + 18}" text-anchor="middle" lang="en">${esc(RV.word(k))}</text>`;
  });
  s += `<line class="fb-base" x1="${x}" x2="${x + w}" y1="${y + h}" y2="${y + h}"/>`;
  s += `<text class="vm-note" x="${Wd / 2}" y="${Hh - 6}" text-anchor="middle">내 목소리를 이 브라우저에서 잰 어림값 · 낮을수록 r 울림</text>`;
  return `<svg class="vm my fb" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="내 r 울림 막대 — ${esc(desc.join(', ') || '아직 녹음 없음')}">${s}</svg>`;
}
// 견주기 — 오 짝: 미끄러지는 오의 F2가 처음 → 끝으로 80Hz 넘게 내려가고, 짝보다 100Hz 넘게 더 내려가면 ‘미끄러짐이 들어 있어요’
//          r 짝: r 모음의 F3가 짝보다 400Hz 넘게 낮으면 ‘r 울림이 또렷해요’, 150Hz 넘게 낮으면 ‘조금 있어요’
function mvVerdict() {
  const p = RVS.pairById(MV.pair), A = MV.res.a, B = MV.res.b, wa = RV.word(p.a), wb = RV.word(p.b);
  if (!A || !B || A.err || B.err) return '';
  const tip = esc(RV.V[RV.vowel(p.a)].tip);
  if (p.side === 'o') {
    if (!A.G || !B.G) return '<p class="note">모음의 처음과 끝을 재지 못했어요. 모음을 조금 길게 다시 녹음해 보세요.</p>';
    const dA = A.G[0][1] - A.G[1][1], dB = B.G[0][1] - B.G[1][1];
    const nums = `F2 내려감(처음 − 끝) → ${wa} ${sgn(dA)}Hz · ${wb} ${sgn(dB)}Hz`;
    if (dA >= 80 && dA - dB >= 100) return `<p class="verdict"><b class="c-ok">미끄러짐이 들어 있어요</b>${esc(wa)} → 끝으로 갈수록 우 쪽으로 움직였고, ${esc(wb)} → 덜 움직였어요. ${esc(nums)}</p>`;
    if (dA < 80 && dB < 80) return `<p class="verdict"><b class="c-no">둘 다 거의 미끄러지지 않아요</b>${esc(wa)} → ${tip}. 다시 녹음해 보세요. ${esc(nums)}</p>`;
    return `<p class="verdict"><b class="c-mid">미끄러짐의 차이가 작아요</b>${esc(wa)} → 오로 시작해 우 쪽으로 더 미끄러지고, ${esc(wb)} → 턱을 크게 내린 채 그대로 두세요. ${esc(nums)}</p>`;
  }
  if (!A.F3 || !B.F3) return '<p class="note">세 번째 공명을 재지 못했어요. 조용한 곳에서 다시 녹음해 보세요.</p>';
  const d = B.F3 - A.F3, nums = `세 번째 공명 → ${wa} ${A.F3}Hz · ${wb} ${B.F3}Hz (차 ${sgn(d)}Hz)`;
  if (d >= 400) return `<p class="verdict"><b class="c-ok">r 울림이 또렷해요</b>${esc(wa)} 막대가 ${esc(wb)} 막대보다 훨씬 낮아요. ${esc(nums)}</p>`;
  if (d >= 150) return `<p class="verdict"><b class="c-mid">r 울림이 조금 있어요</b>${esc(wa)} → ${tip}. 혀를 모음의 처음부터 r 모양으로 두면 더 내려가요. ${esc(nums)}</p>`;
  return `<p class="verdict"><b class="c-no">r 울림이 거의 없어요</b>${esc(wa)} → ${tip}. 다시 녹음해 보세요. ${esc(nums)}</p>`;
}
function mvDraw() {
  const p = RVS.pairById(MV.pair), r = p.side === 'r';
  let h = `<div class="mp-ctl">${row('짝', `<select class="lab-sel" id="mvSel" aria-label="짝 고르기">${SIDE_GRP.map(([sd, lab]) => `<optgroup label="${esc(lab)}">${MV_PAIRS.filter(x => x.side === sd).map(x => `<option value="${x.id}"${x.id === MV.pair ? ' selected' : ''}>${esc(RV.word(x.a))} · ${esc(RV.word(x.b))}</option>`).join('')}</optgroup>`).join('')}</select>`)}${row('내 목소리', seg('목소리 높낮이', [['5500', '높은 편'], ['5000', '낮은 편']], String(MV.ceil), 'mvc'))}</div>`;
  h += `<div class="mv-body"><div class="mv-fig">${r ? mvBarsSVG(p) : mvMapSVG(p)}</div><div class="mv-recs">`;
  [['a', p.a], ['b', p.b]].forEach(([sd, k], i) => {
    const x = MV.res[sd];
    const val = x ? (x.err ? `<span class="sh-err">${esc(MV_ERR[x.err])}</span>` : r ? (x.F3 ? `세 번째 공명 ${x.F3}Hz · 모음 길이 약 ${x.vd}ms` : '세 번째 공명을 재지 못했어요.') : x.G ? `처음 F1 ${x.G[0][0]} · F2 ${x.G[0][1]} → 끝 F1 ${x.G[1][0]} · F2 ${x.G[1][1]}Hz · 모음 길이 약 ${x.vd}ms` : `F1 ${x.F1}Hz · F2 ${x.F2}Hz · 모음 길이 약 ${x.vd}ms`) : '아직 녹음하지 않았어요.';
    h += `<div class="mv-rec ${sd}"><p class="mv-h"><b>${i + 1}</b> ${wordHTML(k)} ${vTag(RV.vowel(k))}</p><div class="wrow">${wBtn(k)}${CAN_REC ? `<button type="button" class="btn${i ? ' ghost' : ''}" data-mvrec="${sd}" aria-pressed="false">${ICO.rec}<span>2초 녹음</span></button>` : ''}${MV.url[sd] ? `<button type="button" class="sh-play" data-mvplay="${sd}">${ICO.play} 내 목소리</button>` : ''}</div>`;
    h += `<p class="note mv-val">${val}</p></div>`;
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
  root.addEventListener('change', e => { if (e.target.id === 'mvSel') { MV.pair = e.target.value; MV.res = { a: null, b: null }; Object.values(MV.url).forEach(u => u && URL.revokeObjectURL(u)); MV.url = { a: null, b: null }; MV.blob = null; MV.err = null; mvDraw(); } });
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
  const groups = RV.SGRP_ORDER.map(gk => ({ gk, rows: RV.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk) }));
  $('shList').innerHTML = groups.map(({ gk, rows }) => `<section class="sh-grp"><h3><span class="ptag g-${gk}">${esc(RV.SGRP[gk].ko)}</span> ${esc(RV.SGRP[gk].long.split(' — ')[1] || '')}</h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${RVV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-en">${sentHTML(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { return tSeq(RV.SENT[i].en); }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = RV.SENT[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, RV.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${RVV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
    shPlayMine(i, true);
  };
  SHREC.rec = mr; mr.start(); shMicState(i, true);
  shResult(i, '<span class="note">녹음 중이에요. 다 말했으면 ‘멈추기’를 눌러요(6초가 지나면 저절로 멈춰요).</span>');
  SHREC.tm = setTimeout(() => { if (SHREC.rec === mr) { SHREC.rec = null; try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 6000);
}
function shPlayMine(i, thenOrig) {
  const b = document.querySelector(`.sh-row[data-i="${i}"] [data-mine]`);
  playUrl(SHREC.url[i], b, thenOrig && RVV.supported ? () => speak(shSeq(i)) : null);
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
   12. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 그림 문제는 EN.mouth로 그림
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
const QS = (() => {
  const roleWords = (text, role) => RV.segs(text).filter(s => s.role === role).map(s => s.w);
  const q = [
    { q: '외투 · 잡았다 → coat · caught. 영어에서 두 낱말을 가르는 것은?', opts: ['모음 — 끝에서 우 쪽으로 미끄러지나', '첫 자음', '끝 자음', '강세의 자리'], a: 0,
      why: 'coat · caught → 첫 자음(k)과 끝 자음(t)이 같고, 모음 하나만 달라요. coat는 미끄러지는 오, caught는 크게 벌린 아. 한국어식으로는 둘 다 코트예요.',
      check: () => !!RV.pairDiff('coat', 'caught') && RV.koSame('coat', 'caught') },
    { q: 'work · walk → r을 품은 어가 든 낱말은?', opts: ['walk', 'work', '둘 다', '둘 다 아님'], a: 1,
      why: 'work → r을 품은 어, 혀를 처음부터 r 모양으로. walk → 크게 벌린 아, r이 없어요(l도 소리 내지 않아요). 한국어식으로는 둘 다 워크예요.',
      check: () => RV.vowel('work') === 'ɝ' && RV.vowel('walk') !== 'ɝ' && RV.koSame('work', 'walk') },
    { q: '미끄러지는 오(boat · home)를 낼 때 입의 움직임으로 알맞은 것은?', opts: ['입술을 옆으로 당기며 이 쪽으로', '혀끝을 윗잇몸에 댔다 떼며', '오로 시작해 입술을 더 모으고 혀 뒤를 조금 올려 우 쪽으로', '턱을 크게 내리며 아 쪽으로'], a: 2,
      why: '오에서 시작해 한 박자 안에서 우 쪽으로 미끄러져요. 입술은 더 둥글게 모이고 혀 뒤는 조금 올라가요. 한국어 오는 처음부터 끝까지 한 모양이에요.',
      check: () => { const o = M.pose('o'), u = M.pose('u'); return !!o && u.round > o.round && u.K[1] < o.K[1]; } },
    { q: 'bird · work → r을 품은 어를 낼 때의 입은? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: mouthFig('입 옆 단면도 넷. A 혀를 가운데에 두고 턱을 조금 벌림(어), B 턱을 크게 내리고 혀를 낮게(아), C 입술을 둥글게 모으고 혀 뒤를 조금 올림(오), D 혀 몸통을 뭉쳐 올리고 입술을 조금 모음(r 모양)', ['wedge', 'a', 'o', 'rb']),
      why: 'D → 혀 몸통을 뭉쳐 올리고 입술을 조금 모아요. 혀끝을 살짝 젖히는 사람도 있어요. 어느 쪽이든 혀끝은 입천장에 닿지 않아요. A = r 없는 어, B = 크게 벌린 아, C = 미끄러지는 오의 처음.',
      check: () => { const rb = M.pose('rb'); return rb.round >= 0.3 && !M.contact('rb').touch && M.pose('wedge').round <= 0.1; } },
    { q: 'hut · hurt · heart → 모음의 차례는?', opts: ['r을 품은 어 · r 없는 어 · 아 + r', 'r 없는 어 · r을 품은 어 · 아 + r', '아 + r · r을 품은 어 · r 없는 어', '셋 다 같은 모음'], a: 1,
      why: 'hut → r 없는 어, hurt → r을 품은 어(처음부터 r), heart → 아로 시작해 끝에서 r. 자음은 같고 모음만 달라 셋의 뜻이 모두 달라요. 한국어식 헛 · 허트 · 하트에는 r이 없어요.',
      check: () => RV.TRI[0].join() === 'hut,hurt,heart' && RV.TRI[0].map(RV.vowel).join() === RV.TRI_V.join() },
    { q: 'water · doctor → 끝 음절의 모음은?', opts: ['약한 r 모음 — 짧게, 그래도 혀는 r 모양', '한국어 어와 같은 모음', '미끄러지는 오', '크게 벌린 아'], a: 0,
      why: '끝 음절은 약하고 짧지만 혀는 r 모양이에요. 한국어식 워터 · 닥터는 끝을 어로 적어 r이 보이지 않아요.',
      check: () => ['water', 'doctor'].every(k => RV.vowel(k) === 'ɚ' && RV.targetAt(k) === RV.nSyl(k) - 1 && RV.entry(k).ko) },
    { q: '이 튜토리얼의 r 울림 막대(세 번째 공명)에 대해 알맞은 것은?', opts: ['높을수록 r 울림이 강해요', '모든 모음에서 같아요', '목소리마다 Hz 값이 같아요', '혀를 r 모양으로 하면 낮아져요'], a: 3,
      why: '혀를 r 모양으로 하면 세 번째 공명이 뚝 내려가요. 그래서 work 막대가 walk 막대보다 낮아요. Hz 값은 목소리마다 달라서, 같은 목소리의 두 막대끼리 견줘요.',
      check: () => { const a = RVS.f3Of('work', 'tc'), b = RVS.f3Of('walk', 'tc'); return !a || !b || a <= b - 400; } },
    { q: '한국어식 표기가 서로 다른 짝은?', opts: ['coat · caught', 'boat · bought', 'note · not', 'work · walk'], a: 2,
      why: 'note · not → 노트 · 낫. 나머지는 코트 · 코트, 보트 · 보트, 워크 · 워크처럼 같은 표기예요. 표기가 달라도 미끄러짐은 한글에 보이지 않아요.',
      check: () => RV.koSame('coat', 'caught') && RV.koSame('boat', 'bought') && !RV.koSame('note', 'not') && RV.koSame('work', 'walk') },
    { q: 'home · ball → 한글로는 홈 · 볼, 둘 다 오로 적어요. 영어에서는?', opts: ['home → 미끄러지는 오, ball → 크게 벌린 아', '둘 다 미끄러지는 오', '둘 다 크게 벌린 아', 'home → 크게 벌린 아, ball → 미끄러지는 오'], a: 0,
      why: 'home은 오에서 우로 미끄러지고, ball은 턱을 크게 내린 채 미끄러지지 않아요. 한글만 보고는 알 수 없어서 사전으로 확인해요.',
      check: () => RV.vowel('home') === 'oʊ' && ['ɔ', 'ɑ'].indexOf(RV.vowel('ball')) >= 0 && RV.koJamo('home') === RV.koJamo('ball') },
    { q: "I don't walk to work. → 미끄러지는 오 · r 모음(노란 글자)이 든 낱말만 고르면?", opts: ['walk · work', "don't · work", "don't · walk", 'to · walk'], a: 1,
      why: "don't → 미끄러지는 오, work → r을 품은 어. walk → 크게 벌린 아(하늘색 짝 소리)예요.",
      check: () => roleWords("I don't walk to work.", 'a').join() === "don't,work" && roleWords("I don't walk to work.", 'b').join() === 'walk' },
  ];
  q.forEach((x, i) => { let ok = false; try { ok = !x.check || x.check(); } catch (e) { ok = false; } if (!ok) console.warn(`[오 · r 모음] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[오 · r 모음] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { RVV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = RVS.chapterAt(T);
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
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * RVS.W, (e.clientY - r.top) / r.height * RVS.H]; };
const hitAt = (x, y) => started ? RVS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
let lastHit = { k: '', at: 0 };
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.play && RVV.supported) {
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
EN.say.wire(document, { before() { RVV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = ' ' + RVV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 영상의 낱말 · 지도 · 막대 · 한글 표기 · 목소리 단추, 직접 해 보기(고르는 것은 하나씩), 듣고 가르기 훈련(짝 × 목소리 넷), 내 발음 확인, 듣고 고르기, 따라 말하기
// 미리 만들지 않는 한국어식 낱말: 엔진이 여러 seed · 읽을 글로도 다른 말(샷 · 록 · 캣)로 읽은 것 — 파일을 두지 않아 브라우저의 한국어 음성으로 읽어요
const KO_NO_CLIP = new Set(['셧', '럭', '캅']);
window.__dialogueLines = () => {
  SWEEP = true;
  try { return dialogueLines(); } finally { SWEEP = false; }
};
function dialogueLines() {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text) return;
    if (sp === 'ko' && KO_NO_CLIP.has(text)) return;
    const id = RVV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: RVV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), base = JSON.parse(RVS.DEFAULTS), n0 = SEQS.length;
  const VS = RV.VOICES.map(v => v.sp);
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 누를 수 있는 낱말 · 지도 · 막대 · 한글 표기 · 목소리 단추. 직접 해 보기로 바뀌는 장면도 하나씩
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t, ch.t + ch.d]; };
    const sweeps = [[{}, [0, END]]]
      .concat(RV.PAIRS.map(p => [{ pair: p.id }, span('listen')]), VS.map(sp => [{ voice: sp }, span('listen')]))
      .concat(...RV.PAIRS.map(p => VS.map(sp => [{ pair: p.id, voice: sp }, span('listen')])))
      .concat(VS.map(sp => [{ mapVoice: sp }, span('glide')]), ...GLIDE_PICK.map(k => VS.map(sp => [{ gword: k, mapVoice: sp }, span('glide')])))
      .concat(RV.pairsOf('o').map(p => [{ opair: p.id }, span('open')]))
      .concat(VS.map(sp => [{ f3Voice: sp }, span('rvowel')]), ...R_PICK.map(k => VS.map(sp => [{ rword: k, f3Voice: sp }, span('rvowel')])))
      .concat(...RV.TRI.map((_, i) => VS.map(sp => [{ tri: i, triVoice: sp }, span('tri')])))
      .concat(RVS.WEAK_WORDS.map(k => [{ wword: k }, span('weak')]))
      .concat(RV.LOAN.map(o => [{ loan: o.w }, span('loan')]), RV.SENT.map((_, i) => [{ sent: i }, span('sentence')]));
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.5) { RVS.render(g, t); RVS.hits().forEach(h => addSeq(h.play, 'video')); }
    });
    // 2) 직접 해 보기: 장마다 + 고르는 것은 하나씩
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* */ } });
    RV.PAIRS.forEach(p => { S.pair = p.id; VS.forEach(sp => { S.voice = sp; LABS.listen(); }); });
    S.pair = null; S.voice = null;
    [null].concat(GLIDE_PICK).forEach(k => { S.gword = k; VS.forEach(sp => { S.mapVoice = sp; LABS.glide(); }); });
    S.gword = null; S.mapVoice = null;
    RV.pairsOf('o').forEach(p => { S.opair = p.id; LABS.open(); });
    S.opair = null;
    [null].concat(R_PICK).forEach(k => { S.rword = k; VS.forEach(sp => { S.f3Voice = sp; LABS.rvowel(); }); });
    S.rword = null; S.f3Voice = null;
    RV.TRI.forEach((_, i) => VS.forEach(sp => { S.tri = i; S.triVoice = sp; LABS.tri(); }));
    S.tri = null; S.triVoice = null;
    RVS.WEAK_WORDS.forEach(k => { S.wword = k; LABS.weak(); });
    S.wword = null;
    RV.LOAN.forEach(o => { S.loan = o.w; LABS.loan(); });
    RV.SENT.forEach((_, i) => { S.sent = i; LABS.sentence(); });
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); dirty = true; }
  // 3) 듣고 가르기 훈련: 짝 × 목소리 넷 + 한국어식 / 내 발음 확인 · 내 모음 찍기: 짝 낱말(밝은 선생님)
  RV.PAIRS.forEach(p => {
    VS.forEach(sp => { add(sp, RV.word(p.a), 'hvpt'); add(sp, RV.word(p.b), 'hvpt'); });
    add('ko', RV.entry(p.a).ko, 'hvpt'); add('ko', RV.entry(p.b).ko, 'hvpt');
  });
  RV.MP_PAIRS.concat(MV_PAIRS).forEach(p => { add('tc', RV.word(p.a), 'mypron'); add('tc', RV.word(p.b), 'mypron'); });
  // 4) 듣고 고르기: 들려주는 말 + 견줘 듣기(같은 목소리) + 외래어 줄
  RV.DRILL.forEach(q => {
    addSeq(drillSeq(q), 'drill');
    const p = RV.pairOf(RV.drillWord(q)); if (p) { add(q.sp, RV.word(p.a), 'drill'); add(q.sp, RV.word(p.b), 'drill'); add('ko', RV.entry(p.a).ko, 'drill'); add('ko', RV.entry(p.b).ko, 'drill'); }
    if (q.kind === 'vowel') { RV.LROWS.find(r => r.vs.indexOf(RV.vowel(q.say)) >= 0).words.forEach(w => add('tc', RV.word(w), 'drill')); add('ko', RV.entry(q.say).ko, 'drill'); }
  });
  // 5) 따라 말하기
  RV.SENT.forEach((_, i) => addSeq(shSeq(i), 'shadow'));
  return out;
}
// 도구용(읽기만): 잴 줄의 정보 — tools/dialogue-lines.cjs가 audio/dialogue/measure-meta.json으로 씀 → tools/measure-syllables.py
// 낱말 하나(word): 음절 수 n · 센 음절 at · 목표 모음의 음절 tat · formant(가운데 F) · track(처음 끝 G · 앞쪽 F3)
//   오 짝 → gpair(같은 목소리의 짝 줄) · glide(미끄러지는 쪽) / r 짝 → rpair · rv(r 모음 쪽)
// 한국어식(ko): 글자 수 = 음절 수 · f3 = 끝 음절(tat)의 F3를 잴 줄(약한 r 모음 막대의 한국어식) / 그 밖의 문장(other): 받아쓰기만
window.__measureMeta = lines => {
  const byText = {};
  Object.values(RV.DICT).forEach(e => { byText[RVV.spoken(RV.word(e.key))] = e.key; });
  const koF3 = new Set(RVS.WEAK_WORDS.map(k => RV.entry(k).ko));
  const ids = new Set(lines.map(l => l.id));
  return lines.map(l => {
    const o = { id: l.id, sp: l.sp, text: l.text };
    if (l.sp === 'ko') {
      const n = [...l.text].length;
      Object.assign(o, { kind: 'ko', n });
      if (koF3.has(l.text)) Object.assign(o, { f3: true, tat: n - 1 });
      return o;
    }
    const k = byText[l.text];
    if (!k) return Object.assign(o, { kind: 'other' });
    Object.assign(o, { kind: 'word', key: k, n: RV.nSyl(k), at: RV.stressAt(k), tat: RV.targetAt(k), formant: true, track: true });
    const p = RV.pairOf(k);
    if (p) {
      const pid = RVV.lineId(l.sp, RV.word(RV.partner(k)));
      if (ids.has(pid)) Object.assign(o, p.side === 'o' ? { gpair: pid, glide: RV.vowel(k) === 'oʊ' } : { rpair: pid, rv: RV.vowel(k) === 'ɝ' });
    }
    return o;
  });
};
hvInit();
mpInit();
mvInit();
shInit();
PDrill($('drillRoot'), RV.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 미끄러짐과 r 울림이 귀에 들어오네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보고, 같은 목소리로 견줘 들어 보세요.' : '처음에는 누구나 헷갈려요. 놀이터의 듣고 가르기 훈련으로 여러 목소리를 더 들어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '미끄러지는 오와 r 모음 — 모두 알았네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(RVS.baseText()).then(() => { dirty = true; });
setTimeout(() => RVS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
