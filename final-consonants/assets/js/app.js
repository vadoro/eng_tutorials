/* 없는 ‘으’를 넣지 마세요 — 끝소리와 자음 묶음: 플레이어, 직접 해 보기, 박자 세기, 내 발음 확인, 따라 말하기, 듣고 고르기, 퀴즈, 영상 추출
 * 박자 · 끝 자음 · 넣은 ‘으’ · 끝소리는 grammar.js(FC), 그림은 scenes.js(FCS)와 공통 부품 EN.mouth, 목소리와 잰 값은 voices.js(FCV)가 맡습니다.
 * 소리가 겹치지 않게: 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(FCV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const FC = window.FC, FCS = window.FCS, FCV = window.FCV, S = FCS.S, M = EN.mouth;
const { CHAPTERS, CAPTIONS, END, POSTER } = FCS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L3 = 'ABC';
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const cv = $('cv'), ctx = cv.getContext('2d');
FC.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = FCS.fonts;
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
  const ready = new Promise(res => FCS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '없는 ‘으’를 넣지 마세요 — 끝소리와 자음 묶음 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { FCS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: FCS.iconSVG('mic'),
  rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="currentColor"/></svg>',
};
// 듣기 · 천천히 단추 묶음 (회화 영역의 듣기 연습 문제와 같은 모양 · 같은 키 R · S)
const lsnBar = () => FCV.supported
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
  const cap = started ? FCS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 낱말과 박자 공을 누르면 그 소리를 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = FCS.chapterAt(T);
  if (ci !== lastChap) { lastChap = ci; document.querySelectorAll('.chap').forEach((b, i) => b.setAttribute('aria-current', String(i === ci))); buildLab(ci); }
}
function play() {
  if (T >= END - 0.01) T = 0;
  stopSounds();
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
  // 입 그림은 멈춰 있어도 움직여요(직접 해 보기에서 고른 자세) — 03 · 04장만
  const id = CHAPTERS[FCS.chapterAt(started ? T : POSTER)].id;
  if (!playing && started && (id === 'stop' || id === 'cluster')) { idleT += dt; dirty = true; }
  if (dirty) { dirty = false; FCS.render(ctx, started ? T : POSTER, { idle: idleT }); }
  requestAnimationFrame(loop);
}
let idleT = 0;
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
// 직접 해 보기에서 고르면: 영상을 멈추고 그 장의 u초 장면을 보여 줌
function showAt(u) {
  const ch = CHAPTERS[FCS.chapterAt(T)];
  if (playing) pause();
  T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}

/* =========================================================
   4. 소리 — 목소리 넷 + 한국어식으로 읽기 (voices.js). 읽기 전에 다른 소리는 모두 멈춤
   ========================================================= */
let audioEl = null;                       // 녹음 재생
function stopAudio() { if (audioEl) { try { audioEl.pause(); } catch (e) { /* 이미 멈춤 */ } audioEl = null; } document.querySelectorAll('.sh-play.saying').forEach(b => b.classList.remove('saying')); }
function stopSounds() { EN.say.stop(); FCV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return FCV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름. 같은 단추를 곧바로 다시 누르면 천천히
let lastLp = { b: null, at: 0 };
const lpBtn = (seq, label, cls = '', inner) => FCV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${inner || SVG_PLAY}</button>` : '';
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
const wSeq = (k, sp = 'tc') => [{ text: FC.word(k), sp }];
const tSeq = (text, sp = 'tc') => [{ text, sp }];
const pairSeq = (a, b, sp = 'tc') => [{ text: FC.word(a), sp }, { text: FC.word(b), sp, gap: 0.7 }];
const koSeq = k => [{ text: FC.entry(k).ko, sp: 'ko' }];
const WHO = { tc: '밝은 선생님', tf: '차분한 선생님', uf: '미국 여성', um: '미국 남성', ko: '한국어식' };

/* =========================================================
   5. 글 칠하기 — 모음 없이 이어지는 자음 글자(mk-bare 노랑 · 밑줄), 넣은 ‘으’(mk-ins 분홍), 한국어식 표기(mk-trap 주황),
      끝 자음: 목이 울림(mk-vd 보라) · 울리지 않음(mk-vl 하늘) · 한 박자 더 [ɪd] · [ɪz](mk-ex 민트), 이어 말하기 ‿(lk)
   ========================================================= */
const endClass = snd => snd === 'ɪd' || snd === 'ɪz' ? 'mk-ex' : snd === 't' || snd === 's' ? 'mk-vl' : 'mk-vd';
const finClass = k => FC.isVoicedObs(FC.final(k)) ? 'mk-vd' : 'mk-vl';
function wordHTML(k, o = {}) {
  const e = FC.entry(k); if (!e) return `<span lang="en">${esc(k)}</span>`;
  const parts = FC.spellSegs(k), last = parts.map(p => p.bare).lastIndexOf(true);
  return `<span lang="en">${parts.map((p, i) => !p.bare || o.paint === false ? esc(p.t) : `<mark class="${o.final && i === last ? o.final : 'mk-bare'}">${esc(p.t)}</mark>`).join('')}</span>`;
}
const koHTML = k => { const parts = FC.koParts(k); return parts.length ? `<span class="kow">${parts.map(p => `<mark class="${p.role === 'ins' ? 'mk-ins' : 'mk-trap'}">${esc(p.ch)}</mark>`).join('')}</span>` : ''; };
function sentHTML(text) {
  let skip = false;
  return '<span lang="en">' + FC.segs(text).map(s => {
    if (skip && /^\s+$/.test(s.t)) { skip = false; return ''; }
    skip = false;
    const t = s.role === 'bare' ? `<mark class="mk-bare">${esc(s.t)}</mark>` : esc(s.t);
    if (s.link) { skip = true; return t + '<i class="lk" title="이어 말하기">‿</i>'; }
    return t;
  }).join('') + '</span>';
}
// 낱말 단추: 누르면 들려줌(곧바로 다시 누르면 천천히)
const wBtn = (k, sp = 'tc', o = {}) => FCV.supported
  ? `<button type="button" class="wbtn${o.cls ? ' ' + o.cls : ''}" data-lp="${seqId(wSeq(k, sp))}" title="듣기: ${esc(FC.word(k))}${sp !== 'tc' ? ' · ' + WHO[sp] : ''}">${SVG_PLAY}${o.html || wordHTML(k, o)}</button>`
  : `<span class="wbtn off">${o.html || wordHTML(k, o)}</span>`;
const koBtn = k => FCV.supported ? `<button type="button" class="wbtn ko" data-lp="${seqId(koSeq(k))}" title="한국어식으로 듣기: ${esc(FC.entry(k).ko)}">${SVG_PLAY}${koHTML(k)}</button>` : `<span class="wbtn off ko">${koHTML(k)}</span>`;
const kindTag = k => `<span class="ptag k-${FC.kindOf(k)}">${esc(FC.KIND[FC.kindOf(k)])}</span>`;
// 박자 공 (SVG): 잰 값이 있으면 그 목소리를 잰 대로(FCS.ballData), 없으면 엔진의 기본 모양. 한국어식은 넣은 ‘으’를 분홍 점선
function ballSVG(k, o = {}) {
  const R = o.R || 17, d = FCS.ballData(k, o), n = d.b.length;
  const labels = d.labels.map(String);
  const step = Math.max(2 * R + 10, ...labels.map(l => l.length * R * (o.ko ? 0.95 : 0.62) + 14));
  const Wd = Math.round(step * (n - 1) + 2 * R + 12), cy = R + 4, Hh = Math.round(cy + R + 24);
  let s = '';
  d.b.forEach((v, i) => {
    const r = FCS.ballR(v, R), cx = 6 + R + i * step, role = o.ko ? (v.ins ? 'ins' : 'ko') : 'en';
    s += `<circle class="bl ${role}" cx="${cx.toFixed(1)}" cy="${cy}" r="${r.toFixed(1)}"/>`;
    s += `<text class="bl-t ${role}" x="${cx.toFixed(1)}" y="${cy + R + 18}" text-anchor="middle">${esc(labels[i])}</text>`;
  });
  const lab = o.ko ? `${FC.entry(k).ko} 박자 공 — 한국어식 ${FC.beats(n)}, 넣은 으 ${FC.koInserted(k).length}${d.measured ? ' (잰 값)' : ''}` : `${FC.word(k)} 박자 공 — ${FC.beats(n)}${d.measured ? ' (이 목소리를 잰 값)' : ''}`;
  return `<svg class="balls" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="${esc(lab)}">${s}</svg>`;
}
// 소리 덩어리 (SVG): 잰 크기 띠(20ms마다) + 모음 자리(잰 음절)를 칠함 — 영어 낱말을 잰 값이 있을 때만
// (한국어식은 그리지 않아요 — 박자 공과 같은 까닭으로 늘 기본 모양, scenes.js ballData 참고)
blobSVG.n = 0;
function blobSVG(k, o = {}) {
  const ko = !!o.ko, e = FC.entry(k), text = ko ? e.ko : FC.word(k), sp = ko ? 'ko' : (o.sp || 'tc');
  if (ko) return '';
  const m = FCV.meas(sp, text), parts = null, n = FC.nSyl(k);
  if (!m || !m.e || !m.s || m.s.length !== n) return '';
  const Wd = o.w || 220, Hh = 52, segs = m.s, en = m.e;
  const t0 = Math.max(0, segs[0][0] - 120), t1 = Math.min(en.length * 20, segs[n - 1][1] + 160), X = t => ((t - t0) / (t1 - t0) * Wd).toFixed(1);
  const rects = segs.map((s, i) => `<rect class="bb ${ko ? (parts[i].role === 'ins' ? 'ins' : 'ko') : 'en'}" x="${X(s[0])}" y="2" width="${(+X(s[1]) - +X(s[0])).toFixed(1)}" height="${Hh - 4}" rx="3"/>`).join('');
  const pts = [`0,${Hh}`];
  en.forEach((d, i) => { const t = i * 20; if (t >= t0 && t <= t1) pts.push(`${X(t)},${(Hh - clamp((d + 42) / 42) * (Hh - 6)).toFixed(1)}`); });
  pts.push(`${Wd},${Hh}`);
  // 모음 자리 안의 띠만 색 — 밖(자음 소리)은 회색 (scenes.js blob과 같게)
  const cid = 'bc' + (++blobSVG.n), clip = segs.map(s => `<rect x="${X(s[0])}" y="0" width="${(+X(s[1]) - +X(s[0])).toFixed(1)}" height="${Hh}"/>`).join('');
  return `<svg class="blob${ko ? ' ko' : ''}" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="${esc(text)} 소리 덩어리 — 잰 크기, 칠한 곳은 모음 자리(${FC.beats(n)}), 회색은 자음 소리"><defs><clipPath id="${cid}">${clip}</clipPath></defs>${rects}<polygon class="bp" points="${pts.join(' ')}"/><polygon class="bp in" clip-path="url(#${cid})" points="${pts.join(' ')}"/></svg>`;
}
// 모음 길이 막대: 짝(a = 목이 울리는 끝, b = 울리지 않는 끝)을 같은 목소리로 잰 값 — 없으면 어림
function vbarsHTML(p, sp = 'tc') {
  return `<div class="vbars">${[[p.a, 'vd'], [p.b, 'vl']].map(([w, c]) => {
    const ms = FCS.vowelMs(w, sp), v = ms || (c === 'vd' ? 230 : 150);
    return `<div class="vb ${c}">${wBtn(w, sp, { final: 'mk-' + c })}<span class="vb-bar" aria-hidden="true"><i style="width:${Math.min(100, v / 3.6).toFixed(0)}%"></i></span><small>${ms ? Math.round(ms) + 'ms' : '어림'}</small></div>`;
  }).join('')}</div>`;
}
// 한국어식 · 영어를 나란히
const koEnBalls = (k, sp = 'tc') => `<div class="cmpballs"><div class="cb ko"><span>한국어식</span>${koBtn(k)}${ballSVG(k, { ko: true })}${blobSVG(k, { ko: true })}</div><span class="arr">→</span><div class="cb en"><span>영어 · ${esc(WHO[sp])}</span>${wBtn(k, sp)}${ballSVG(k, { sp })}${blobSVG(k, { sp })}</div></div>`;

/* =========================================================
   6. 듣고 고르기 (이 튜토리얼 전용, 회화 영역의 듣기 연습 문제와 같은 .edr 모양) — 소리 먼저, 글은 답한 뒤
   키보드: A · B · C 또는 1 · 2 · 3 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · Enter/→ 다음
   ========================================================= */
const KIND_KO = { count: '몇 박자?', ed: '-ed의 끝소리는?', vpair: '어느 낱말? (끝 유성 · 무성)', epair: '어느 낱말? (자음 묶음)' };
const SIT = { count: '낱말 하나를 들려줘요. 손뼉을 치며 박자(모음 소리)를 세어 보세요.', ed: '과거형 낱말 하나를 들려줘요. 끝의 -ed는 어떤 소리인가요?', vpair: '낱말 하나를 들려줘요. 끝 자음 앞의 모음 길이를 들어 보세요.', epair: '낱말 하나를 들려줘요. 몇 박자로 들리나요?' };
const drillSeq = q => tSeq(FC.word(q.say), q.sp);
function PDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0 }));
  let cur = 0, retry = null, mode = null;
  const hear = FCV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && FCV.busy()) { FCV.stop(); return; }
    const it = items[cur];
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(drillSeq(it), { slow: !!slow, onitem() { say(`${WHO[it.sp]} · 말하는 중`); }, onend(stopped) { mode = null; paintPlay(root, null); say(stopped ? '' : '다 들었어요. 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { FCV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; FCV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    FCV.stop();
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
  // 보기마다 엔진의 까닭
  function notes(it) {
    if (it.kind === 'count') {
      const n = FC.nSyl(it.say), m = FC.koSyl(it.say), e = FC.entry(it.say);
      return it.opts.map((op, k) => k === it.a ? `${e.w} ${FC.ipa(it.say)} → 모음 소리 ${n}개 = ${op}. ${e.gloss}` : `${op}가 아니에요 — 모음 소리가 ${n}개예요.${m && m !== n ? ` 한국어식 ${e.ko} → ${m}박자라 헷갈리기 쉬워요.` : ''}`);
    }
    if (it.kind === 'ed') {
      const x = FC.inflOf(it.say), end = FC.ending(x.base, 'ed'), last = FC.entry(x.base).ph.slice(-1)[0];
      return FC.ENDOPTS.ed.map(s => s === end.snd ? `[${s}] → 바탕 낱말 ${x.base} · 마지막 소리 /${last}/ → ${FC.END_WHY[end.why]}.` : `[${s}] → 아니에요. 마지막 소리 /${last}/ 뒤에는 [${end.snd}]${end.extra ? '' : ' — 박자는 그대로'}.`);
    }
    if (it.kind === 'vpair') return it.opts.map(w => `${w} ${FC.ipa(w)} — ${FC.entry(w).gloss}. 끝 /${FC.final(w)}/ → ${FC.isVoicedObs(FC.final(w)) ? '목이 울리는 소리라 앞 모음이 길어요' : '목이 울리지 않는 소리라 앞 모음이 짧아요'}.`);
    return it.opts.map(w => `${w} ${FC.ipa(w)} — ${FC.entry(w).gloss}. ${FC.beats(FC.nSyl(w))}${FC.nSyl(w) > 1 ? ' — 두 자음 사이에 짧은 어(ə)가 있어요' : ' — 자음에서 자음으로 바로'}.`);
  }
  function optLab(it, op) {
    if (it.kind === 'count') return `<span class="ldr-t">${esc(op)}</span>`;
    if (it.kind === 'ed') return `<span class="ldr-t ipa" lang="en">${esc(op)}</span>`;
    return `<span class="ldr-t">${wordHTML(op, it.kind === 'vpair' ? { final: finClass(op) } : {})}</span><small>${esc(FC.entry(op).gloss)}</small>`;
  }
  function qLine(it) {
    if (it.kind === 'ed') { const x = FC.inflOf(it.say); return `${wordHTML(x.base, { paint: false })} <span class="arr">→</span> ${wordHTML(it.say, { final: endClass(FC.ending(x.base, 'ed').snd) })}`; }
    return wordHTML(it.say, it.kind === 'vpair' ? { final: finClass(it.say) } : {});
  }
  function cmp(it) {
    if (it.kind === 'count') {
      const e = FC.entry(it.say);
      return `<div class="ldr-cmp"><span>박자 공 · 이 목소리를 잰 값</span><span class="cmp-w">${wBtn(it.say, it.sp)}${ballSVG(it.say, { sp: it.sp, R: 14 })}</span>${e.ko ? `<span class="cmp-w">${koBtn(it.say)}${ballSVG(it.say, { ko: true, R: 14 })}</span>` : ''}</div>`;
    }
    if (it.kind === 'ed') {
      const x = FC.inflOf(it.say);
      return `<div class="ldr-cmp"><span>바탕 낱말과 견줘 듣기</span><span class="cmp-w">${wBtn(x.base, it.sp, { paint: false })}${ballSVG(x.base, { sp: it.sp, R: 14 })}</span><span class="cmp-w">${wBtn(it.say, it.sp, { final: endClass(FC.ending(x.base, 'ed').snd) })}${ballSVG(it.say, { sp: it.sp, R: 14 })}</span>${lpBtn(pairSeq(x.base, it.say, it.sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서</span>`)}</div>`;
    }
    const [a, b] = it.opts;
    if (it.kind === 'vpair') return `<div class="ldr-cmp"><span>같은 목소리로 견줘 듣기 · 모음 길이(잰 값)</span>${vbarsHTML(FC.pairOf(a), it.sp)}${lpBtn(pairSeq(a, b, it.sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서</span>`)}</div>`;
    return `<div class="ldr-cmp"><span>같은 목소리로 견줘 듣기</span>${[a, b].map(w => `<span class="cmp-w">${wBtn(w, it.sp)}${ballSVG(w, { sp: it.sp, R: 14 })}</span>`).join('')}${lpBtn(pairSeq(a, b, it.sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서</span>`)}</div>`;
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = FC.hints(it);
    const o = order(), pos = o.indexOf(cur), reveal = done || !hear, n = it.opts.length;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${FCS.iconSVG('ear', 'pi')}${esc(KIND_KO[it.kind])}</span><span>${retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span><span class="edr-tag">${esc(WHO[it.sp])}</span></p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(SIT[it.kind])}</p>`;
    h += lsnBar();
    if (reveal && it.kind !== 'vpair' && it.kind !== 'epair') h += `<p class="ldr-q"><span class="ldr-t">${qLine(it)}</span>${done ? `<small>${esc(FC.entry(it.say).gloss)}</small>` : ''}</p>`;
    h += `<div class="ldr-opts ${n === 3 ? 'three' : 'two'}" role="group" aria-label="보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
      return `<div class="ldr-row${cls}" data-k="${k}"><button type="button" class="ldr-opt big" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L3[k]})</b> ${optLab(it, op)}</button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: ${L3.slice(0, n).split('').join(' · ')} 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L3[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L3[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
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
    const k = e.key.toUpperCase(), i = L3.indexOf(k), d = '123'.indexOf(k);
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
const LISTEN_PICK = ['milk', 'test', 'strike', 'desk', 'glass', 'Christmas'];
const KO_PICK = ['desk', 'strike', 'glass', 'cake', 'Christmas', "McDonald's"];
const CLUS_PICK = ['strike', 'desk', 'milk', 'test', 'glass', 'stress', 'sports', 'street'];
const wordPick = (list, cur, attr, o = {}) => `<div class="wrow sel">${list.map(k => `<button type="button" class="pickw${cur === k ? ' on' : ''}" data-${attr}="${esc(k)}" aria-pressed="${cur === k}">${o.ko ? koHTML(k) : wordHTML(k)}</button>`).join('')}</div>`;
const pairSel = (cur, attr, list, blank = '영상대로') => {
  const groups = [['ins', '‘으’를 넣으면 다른 낱말'], ['voice', '끝 유성 · 무성 짝']].filter(([kd]) => list.some(p => p.kind === kd));
  return `<select class="lab-sel" data-sel="${attr}" aria-label="짝 고르기">${blank ? `<option value="">${esc(blank)}</option>` : ''}${groups.map(([kd, lab]) => `<optgroup label="${esc(lab)}">${list.filter(p => p.kind === kd).map(p => `<option value="${p.id}"${cur === p.id ? ' selected' : ''}>${esc(FC.word(p.a))} · ${esc(FC.word(p.b))}</option>`).join('')}</optgroup>`).join('')}</select>`;
};
const voices4 = (seqOf, label) => `<div class="voices4"><span>${esc(label)}</span>${FC.VOICES.map(v => lpBtn(seqOf(v.sp), `${v.ko}`, 'lp-voice', `${ICO.play}<span>${esc(v.ko)}</span>`)).join('')}</div>`;
// 03장: 끝 자음마다 낱말
const STOP_WORDS = { k: ['desk', 'cake', 'book', 'back'], p: ['stop', 'help', 'cap', 'club'], t: ['cat', 'note', 'test', 'seat'] };
const LABS = {
  intro() {
    return labHead('먼저 들어 보기') + `<p>한국어식 데스크와 영어 desk — 둘 다 눌러 들어 보세요. 공은 박자 하나(모음 소리 하나)예요. 크기는 실제 소리를 재서 그렸어요.</p>
      ${koEnBalls('desk')}
      <div class="wrow"><span class="note">‘으’를 넣으면 다른 낱말</span>${wBtn('sport')}${wBtn('support', 'tc', { paint: false })}${lpBtn(pairSeq('sport', 'support'), '이어서 듣기', 'lp-voice', `${ICO.play}<span>이어서</span>`)}</div>
      <p class="note">같은 단추를 곧바로 다시 누르면 천천히 들려줘요. 노란 밑줄 글자는 모음 없이 이어지는 자음이에요.</p>`;
  },
  listen() {
    const k = S.lword;
    let h = labHead('몇 박자인가요?') + row('낱말', wordPick(LISTEN_PICK, k, 'lw')) +
      row('목소리', seg('목소리 고르기', [['', '밝은 선생님']].concat(FC.VOICES.slice(1).map(v => [v.sp, v.ko])), S.voice || '', 'vc'));
    if (!k) return h + '<p class="note">낱말을 고르면 영상이 멈추고 그 낱말의 소리 덩어리를 크게 보여 줘요. 목소리를 바꿔 들어 보세요 — 목소리가 달라도 박자 수는 같아요. 본격적인 연습은 아래 <a href="#playground">박자 세기</a>에서 해요.</p>';
    const sp = S.voice || 'tc';
    return h + koEnBalls(k, sp) + `<p class="note">${esc(FC.koNote(k))}. ${kindTag(k)}</p>` + clearBtn;
  },
  korean() {
    let h = labHead('한국어식으로 적으면') + `<p>외래어를 하나 골라 보세요. 넣은 으(분홍)와 영어의 박자를 견줘요.</p>` + row('낱말', wordPick(KO_PICK, LAB.ko, 'ko', { ko: true }));
    const k = LAB.ko;
    if (!k) return h;
    return h + koEnBalls(k) + `<p class="note">${esc(FC.koNote(k))}. 소리의 모양 ${esc(FC.shape(k))} (C = 자음 · V = 모음)</p>`;
  },
  stop() {
    const key = S.stopk;
    let h = labHead('끝 자음의 입 모양') + row('끝 자음', seg('끝 자음 고르기', [['', '영상대로'], ['k', 'k · 혀 뒤'], ['p', 'p · 두 입술'], ['t', 't · 혀끝']], key || '', 'stk'));
    if (!key) return h + '<p class="note">끝 자음을 고르면 영상이 멈추고 그 입 모양을 되풀이해 보여 줘요. 모음에서 끝 자음으로 닫고 — 목 울림은 멈춰요.</p>';
    const c = M.contact(key), closed = M.lipsClosed(key);
    h += `<p class="note">${key === 'p' ? (closed ? '두 입술이 닫혀요' : '') : c.touch ? `${esc(c.where)}에 닿아요` : ''} → 닫은 채 멈추면 끝. 혀나 입술을 떼면서 목소리를 실으면 ‘으’가 돼요.</p>`;
    h += `<div class="wrow">${STOP_WORDS[key].map(w => wBtn(w)).join('')}</div>`;
    return h + clearBtn;
  },
  cluster() {
    const k = S.clus;
    let h = labHead('자음 묶음 낱말') + row('낱말', wordPick(CLUS_PICK, k, 'cl'));
    if (!k) return h + '<p class="note">낱말을 고르면 영상이 멈추고 크게 보여 줘요. strike → 고르면 두 입 그림(영어 · 한국어식)이 함께 움직여요.</p>';
    return h + (FC.entry(k).ko ? koEnBalls(k) : `<div class="cmpballs one">${wBtn(k)}${ballSVG(k)}</div>`) + `<p class="note">${esc(FC.ipa(k))} · ${esc(FC.entry(k).gloss)} · 소리의 모양 ${esc(FC.shape(k))}</p>` + clearBtn;
  },
  voice() {
    const p = S.vpair ? FC.VPAIRS.find(x => x.id === S.vpair) : null;
    let h = labHead('짝 고르기') + row('짝', pairSel(S.vpair, 'vpair', FC.VPAIRS));
    if (!p) return h + '<p class="note">짝을 고르면 영상이 멈추고 그 짝의 모음 길이를 보여 줘요. 보라 = 목이 울리는 끝(모음이 길어요) · 하늘 = 울리지 않는 끝(짧아요).</p>';
    return h + vbarsHTML(p) + voices4(sp => pairSeq(p.a, p.b, sp), '목소리 넷으로 짝 듣기') + clearBtn;
  },
  ending() {
    const opts = ['ed', 's'].map(kd => `<optgroup label="${kd === 'ed' ? '과거형 -ed' : '복수형 -s'}">${FC.INFL.filter(x => x.kind === kd).map(x => `<option value="${x.form}"${LAB.infl === x.form ? ' selected' : ''}>${esc(x.base)} → ${esc(x.form)}</option>`).join('')}</optgroup>`).join('');
    let h = labHead('끝소리 계산기') + row('낱말', `<select class="lab-sel" data-sel="infl" aria-label="낱말 고르기"><option value="">고르세요</option>${opts}</select>`);
    const x = LAB.infl && FC.inflOf(LAB.infl);
    if (!x) return h + '<p class="note">바탕 낱말의 마지막 소리가 끝소리를 정해요. 고르면 영상이 멈추고 그 줄을 표시해요.</p>';
    const end = FC.ending(x.base, x.kind), last = FC.entry(x.base).ph.slice(-1)[0];
    h += `<div class="cmpballs"><div class="cb"><span>바탕 · ${esc(FC.beats(FC.nSyl(x.base)))}</span>${wBtn(x.base, 'tc', { paint: false })}${ballSVG(x.base)}</div><span class="arr">→</span><div class="cb en"><span>${x.kind === 'ed' ? '-ed' : '-s'} → [${esc(end.snd)}] · ${esc(FC.beats(FC.nSyl(x.form)))}</span>${wBtn(x.form, 'tc', { final: endClass(end.snd) })}${ballSVG(x.form)}</div></div>`;
    h += `<p class="note">마지막 소리 /${esc(last)}/ → ${esc(FC.END_WHY[end.why])}${end.extra ? '' : ' → 박자는 그대로'}.${FC.entry(x.form).ko ? ` 한국어식 ${koHTML(x.form)} → ${FC.koSyl(x.form)}박자.` : ''}</p>`;
    return h + clearBtn;
  },
  loan() {
    let h = labHead('외래어 하나씩') + row('낱말', wordPick(FC.LOAN.map(o => o.w), S.loan, 'ln', { ko: true }));
    const k = S.loan;
    if (!k) return h + '<p class="note">한국어식 표기를 고르면, 넣은 으를 표시하고 영어로 말할 때의 박자를 보여 줘요.</p>';
    const row0 = FC.LROWS.find(r => r.words.indexOf(k) >= 0);
    return h + koEnBalls(k) + `<p class="note"><b>${esc(row0.ko)}</b> — ${esc(FC.koNote(k))}.</p>` + clearBtn;
  },
  sentence() {
    const opts = FC.SGRP_ORDER.map(gk => `<optgroup label="${esc(FC.SGRP[gk].long)}">${FC.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk).map(([s, i]) => `<option value="${i}"${S.sent === i ? ' selected' : ''}>${esc(s.en)}</option>`).join('')}</optgroup>`).join('');
    let h = labHead('문장 고르기') + row('문장', `<select class="lab-sel" data-sel="sent" aria-label="문장 고르기"><option value="">영상대로</option>${opts}</select>`);
    if (S.sent == null) return h + '<p class="note">따라 말하기의 28문장 가운데 하나를 고르면 영상에 크게 보여 줘요. ‿ 표시는 끝 자음을 다음 낱말의 모음에 붙여 말하는 곳이에요.</p>';
    const s = FC.SENT[S.sent], L = FC.links(s.en);
    return h + `<p class="enline">${lpBtn(tSeq(s.en), '듣기: ' + s.en)}${sentHTML(s.en)}</p><p class="note">${esc(s.ko)}${L.length ? ` · 이어 말하기 → ${L.map(k => esc(FC.word(k))).join(' · ')}` : ''}</p><div class="wrow">${FC.wordsIn(s.en).map(k => wBtn(k)).join('')}</div>` + clearBtn;
  },
  summary() {
    return labHead('이제 직접') + `<p>아래 <a href="#playground">박자 세기</a>에서 목소리 넷으로 박자를 세고, <a href="#mypron">내 발음 확인</a>에서 음성 인식이 내 말을 어느 낱말로 듣는지 확인해 보세요. <a href="#shadow">따라 말하기</a> 28문장과 <a href="#drill">듣고 고르기</a> 16문제도 있어요.</p>`;
  },
};
const LAB = { ko: null, infl: null };
function buildLab(ci) {
  const id = CHAPTERS[ci].id;
  $('lab').innerHTML = (LABS[id] || (() => ''))();
}
const relab = () => buildLab(FCS.chapterAt(T));
const ENDMAP = { t: 't', d: 'd', 'ɪd': 'ɪd', s: 't', z: 'd', 'ɪz': 'ɪd' };
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
  const d = b.dataset;
  if (b.id === 'labClear') { Object.assign(S, JSON.parse(FCS.DEFAULTS)); LAB.infl = null; dirty = true; relab(); return; }
  if (d.lw != null) { S.lword = S.lword === d.lw ? null : d.lw; showAt(S.lword ? 20 : 6); relab(); return; }
  if (d.vc != null) { S.voice = d.vc || null; if (S.lword) showAt(20); else dirty = true; relab(); return; }
  if (d.ko != null) { LAB.ko = LAB.ko === d.ko ? null : d.ko; relab(); return; }
  if (d.stk != null) { S.stopk = d.stk || null; idleT = 0; showAt(S.stopk ? 8 : 1); relab(); return; }
  if (d.cl != null) { S.clus = S.clus === d.cl ? null : d.cl; idleT = 0; showAt(S.clus ? 8 : 1); relab(); return; }
  if (d.ln != null) { S.loan = S.loan === d.ln ? null : d.ln; showAt(32); relab(); return; }
});
$('lab').addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.sel) return;
  const v = t.value;
  if (t.dataset.sel === 'vpair') { S.vpair = v || null; showAt(v ? 20 : 1); }
  else if (t.dataset.sel === 'sent') { S.sent = v === '' ? null : +v; showAt(8); }
  else if (t.dataset.sel === 'infl') {
    LAB.infl = v || null;
    const x = v && FC.inflOf(v);
    S.ending = x ? ENDMAP[FC.ending(x.base, x.kind).snd] : null;
    showAt(20);
  }
  relab();
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   한국어 속에 홀로 쓴 자음 글자(t · d 뒤 · s · ch)는 글자 이름으로 읽어요. 영어 문장 속의 낱말은 그대로
   ========================================================= */
const LETTER_KO = { t: '티', d: '디', s: '에스', z: '지', k: '케이', p: '피', r: '알', l: '엘', j: '제이', sh: '에스에이치', ch: '씨에이치' };
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [
    [/-ed\b/g, '이디'], [/-s\b/g, '에스'],
    [/(^|[^A-Za-z'’-])(sh|ch|[tdszkprlj])(?=\s*[·,.→]|\s*(?:뒤|소리|발음|에서|로|와|를|는|가|이|만|같은)|$)/g, (m, a, c) => a + LETTER_KO[c]],
    [/\s\+\s/g, ', '], [/ = /g, ', '],
  ],
  rate: () => speed,
  holdBefore: 0.05,
  enRate: FCV.EN_RATE,      // 영어 조각만 살짝 느리게 (voices.js의 EN_RATE — 낱말 소리와 같은 빠르기)
  clips: window.EN_CLIPS,   // 미리 만든 음성 파일(audio/narration/) — 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };
if (window.EN && EN.say) EN.say.rate = FCV.EN_RATE;   // 발음 듣기 단추도 같은 빠르기

/* =========================================================
   9. 음성 인식 · 녹음 (따라 말하기 · 내 발음 확인)
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
// 녹음 한 번 (ms 뒤 저절로 멈춤) → Blob URL
async function recordOnce(ms, onState) {
  stopSounds(); NARR.reset(); if (playing) pause(); stopListening();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mr = new MediaRecorder(stream), chunks = [];
  return new Promise(res => {
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); onState(false); res(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })) : null); };
    mr.start(); onState(true);
    setTimeout(() => { try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } }, ms);
  });
}
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
   10. 놀이터 ① 박자 세기 — 목소리 넷 × 낱말: 듣고 박자 수를 고르면 그 목소리를 잰 박자 공과 소리 덩어리가 나타남
   기록은 이 브라우저에만(localStorage 'en-fc-beats-v1'). 키보드: R 듣기 · 1~4 고르기 · Space/Enter 다음
   ========================================================= */
const HV_KEY = 'en-fc-beats-v1';
const KIND_ORDER = ['end1', 'endcl', 'oncl', 'both', 'ed', 's'];
const HV_GRP = [['all', '모두']].concat(KIND_ORDER.map(k => [k, FC.KIND[k]]));
const HV_OPTS = ['한 박자', '두 박자', '세 박자', '네 박자'];
const hvPool = grp => Object.values(FC.DICT).map(e => e.key).filter(k => grp === 'all' || FC.kindOf(k) === grp);
const HV = { grp: 'all', voice: 'all', cur: null, pick: null, stats: null, streak: 0, last: null };
const hvEmpty = () => ({ kind: Object.fromEntries(KIND_ORDER.map(k => [k, [0, 0]])), voice: { tc: [0, 0], tf: [0, 0], uf: [0, 0], um: [0, 0] } });
function hvLoad() { try { const s = JSON.parse(localStorage.getItem(HV_KEY) || 'null'); HV.stats = s && s.kind && s.voice ? s : hvEmpty(); } catch (e) { HV.stats = hvEmpty(); } }
function hvSave() { try { localStorage.setItem(HV_KEY, JSON.stringify(HV.stats)); } catch (e) { /* 저장하지 못해도 이번에는 계속 */ } }
// 확인(받아쓰기 · 울림 조각 수 · 끝 올림 · 짝의 모음 길이)을 통과한 목소리만 — 통과한 줄만 잰 값이 있어요.
// 잰 값 파일이 없으면(브라우저 음성으로 읽을 때) 넷 다 써요.
const okVoices = k => FC.VOICES.map(v => v.sp).filter(sp => !!FCV.meas(sp, FC.word(k)));
const voicesFor = k => { const ok = okVoices(k); return ok.length ? ok : FC.VOICES.map(v => v.sp); };
function hvNew(auto) {
  const all = hvPool(HV.grp).filter(k => k !== HV.last);
  const vp = all.filter(k => HV.voice === 'all' ? okVoices(k).length : okVoices(k).includes(HV.voice));
  const pool = vp.length ? vp : all;
  const k = pickOne(pool), sp = HV.voice === 'all' ? pickOne(voicesFor(k)) : HV.voice;
  HV.cur = { k, sp }; HV.pick = null; HV.last = k;
  hvDraw();
  if (auto) hvPlay();
}
function hvPlay(slow) { if (!HV.cur) return; const b = $('hvPlayBtn'); if (b) b.classList.add('saying'); speak(wSeq(HV.cur.k, HV.cur.sp), { slow: !!slow, onend() { const x = $('hvPlayBtn'); if (x) x.classList.remove('saying'); } }); }
function hvAnswer(i) {
  const c = HV.cur; if (!c || HV.pick !== null || i >= HV_OPTS.length) return;
  HV.pick = i;
  const ok = i + 1 === FC.nSyl(c.k), K = HV.stats.kind[FC.kindOf(c.k)], V = HV.stats.voice[c.sp];
  K[1]++; V[1]++; if (ok) { K[0]++; V[0]++; HV.streak++; } else HV.streak = 0;
  hvSave(); hvDraw();
  const nb = $('hvNext'); if (nb) nb.focus({ preventScroll: true });
}
const pct = ([ok, n]) => n ? Math.round(ok / n * 100) : null;
function hvDraw() {
  const c = HV.cur, box = $('hvMain');
  let h = '';
  if (!c) h = `<p class="hv-hello">목소리 넷 가운데 하나가 낱말 하나를 말해요. 손뼉을 치며 박자를 세고 고르면, 그 목소리를 실제로 잰 박자 공과 소리 덩어리가 나타나요. 한국어식으로 세던 박자가 영어의 박자로 줄어들면 성공이에요.</p><div class="acts"><button type="button" class="btn" id="hvStart">${ICO.play} 시작하기</button></div>`;
  else {
    const e = FC.entry(c.k), n = FC.nSyl(c.k), done = HV.pick !== null, ok = done && HV.pick + 1 === n;
    h += `<div class="hv-top"><button type="button" class="btn hv-play" id="hvPlayBtn">${ICO.play} 듣기 <small>R</small></button><button type="button" class="btn ghost" id="hvSlow">${ICO.slow} 천천히</button><span class="hv-who">${esc(WHO[c.sp])} · ${esc(FC.KIND[FC.kindOf(c.k)])}</span></div>`;
    h += `<div class="hv-opts beats">${HV_OPTS.map((s, i) => `<button type="button" class="hv-opt${done ? (i + 1 === n ? ' right' : i === HV.pick ? ' wrong' : ' off') : ''}" data-hv="${i}"${done ? ' disabled' : ''}><b>${i + 1}</b><span>${esc(s)}</span></button>`).join('')}</div>`;
    if (done) {
      h += `<p class="verdict"><b class="${ok ? 'c-ok' : 'c-no'}">${ok ? '맞아요' : '아쉬워요'}</b>${wordHTML(c.k)} ${esc(FC.ipa(c.k))} · ${esc(e.gloss)} → ${esc(FC.beats(n))}${HV.streak > 1 ? ` · 연속 ${HV.streak}번!` : ''}</p>`;
      h += `<div class="cmpballs">${e.ko ? `<div class="cb ko"><span>한국어식 · ${esc(FC.beats(FC.koSyl(c.k)))}</span>${koBtn(c.k)}${ballSVG(c.k, { ko: true, R: 15 })}${blobSVG(c.k, { ko: true })}</div><span class="arr">→</span>` : ''}<div class="cb en"><span>${esc(WHO[c.sp])} · ${esc(FC.beats(n))}</span>${wBtn(c.k, c.sp)}${ballSVG(c.k, { sp: c.sp })}${blobSVG(c.k, { sp: c.sp })}</div></div>`;
      const pair = FC.pairOf(c.k);
      if (pair) h += `<div class="wrow"><span class="note">짝 낱말과 견주기</span>${wBtn(pair.a, c.sp, pair.kind === 'voice' ? { final: 'mk-vd' } : {})}${wBtn(pair.b, c.sp, pair.kind === 'voice' ? { final: 'mk-vl' } : { paint: false })}${lpBtn(pairSeq(pair.a, pair.b, c.sp), '이어서 듣기', 'lp-voice', `${ICO.play}<span>이어서</span>`)}</div>`;
      const x = FC.inflOf(c.k);
      if (x) h += `<div class="wrow"><span class="note">바탕 낱말 → ${esc(x.kind === 'ed' ? '-ed' : '-s')} [${esc(FC.ending(x.base, x.kind).snd)}]</span>${wBtn(x.base, c.sp, { paint: false })}${wBtn(c.k, c.sp, { final: endClass(FC.ending(x.base, x.kind).snd) })}</div>`;
      h += `<div class="acts"><button type="button" class="btn" id="hvNext">다음 <small>Space</small></button></div>`;
    }
  }
  box.innerHTML = h;
  const st = HV.stats, rows = KIND_ORDER.map(k => {
    const v = st.kind[k], q = pct(v);
    return `<tr><th scope="row">${esc(FC.KIND[k])}</th><td>${v[0]} / ${v[1]}</td><td><span class="meter"><i style="width:${q == null ? 0 : q}%"></i></span>${q == null ? '–' : q + '%'}</td></tr>`;
  }).join('');
  const all = Object.values(st.kind).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
  $('hvStats').innerHTML = `<table class="hv-tab"><caption>낱말의 묶음마다 맞힌 비율 (이 브라우저에만 저장)</caption><tbody>${rows}<tr class="all"><th scope="row">모두</th><td>${all[0]} / ${all[1]}</td><td>${pct(all) == null ? '–' : pct(all) + '%'}</td></tr></tbody></table>
    <p class="note">목소리마다: ${FC.VOICES.map(v => `${esc(v.ko)} ${pct(st.voice[v.sp]) == null ? '–' : pct(st.voice[v.sp]) + '%'}`).join(' · ')}</p>`;
}
function hvInit() {
  hvLoad();
  $('hvCtl').innerHTML = row('낱말', seg('낱말 묶음 고르기', HV_GRP, HV.grp, 'hvg')) +
    row('목소리', seg('목소리 고르기', [['all', '넷 섞어서']].concat(FC.VOICES.map(v => [v.sp, v.ko])), HV.voice, 'hvv'));
  hvDraw();
  const root = $('hvpt');
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    const d = b.dataset;
    if (d.hvg) { HV.grp = d.hvg; root.querySelectorAll('[data-hvg]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hvNew(false); return; }
    if (d.hvv) { HV.voice = d.hvv; root.querySelectorAll('[data-hvv]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hvNew(false); return; }
    if (b.id === 'hvStart' || b.id === 'hvNext') { hvNew(true); return; }
    if (b.id === 'hvPlayBtn') { hvPlay(false); return; }
    if (b.id === 'hvSlow') { hvPlay(true); return; }
    if (d.hv != null) { hvAnswer(+d.hv); return; }
    if (b.id === 'hvReset') { HV.stats = hvEmpty(); HV.streak = 0; hvSave(); hvDraw(); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('select'))) return;
    const k = e.key.toUpperCase(), n = '1234'.indexOf(k);
    if (k === 'R') { e.preventDefault(); if (!HV.cur) hvNew(true); else hvPlay(false); }
    else if (n >= 0 && HV.cur && HV.pick === null) { e.preventDefault(); hvAnswer(n); }
    else if ((e.key === ' ' || e.key === 'Enter') && (HV.pick !== null || !HV.cur) && !(e.target.closest && e.target.closest('button:not(#hvNext):not(#hvStart)'))) { e.preventDefault(); hvNew(true); }
  });
}

/* =========================================================
   10. 놀이터 ② 내 발음 확인 — 음성 인식이 내 말을 어느 낱말로 들었나 · 녹음해서 본보기와 번갈아 듣기
   ‘으’를 넣으면 다른 낱말이 되는 짝(sport · support)과 끝 유성 · 무성 짝(bag · back). 발음의 질은 판정하지 않아요(화면에 밝힘)
   ========================================================= */
const MP = { pair: FC.MP_PAIRS[0].id, side: 'a', url: null, res: null, busy: false };
const mpTarget = () => { const p = FC.MP_PAIRS.find(x => x.id === MP.pair); return { p, w: MP.side === 'a' ? p.a : p.b, other: MP.side === 'a' ? p.b : p.a }; };
const MP_TIP = {
  ins: { a: '첫 자음에서 다음 자음으로 바로 넘어가요. 사이에 모음을 넣지 않아요.', b: '두 자음 사이의 짧은 어(ə)를 살짝 내요. 박자가 둘이에요.' },
  voice: { a: '모음을 길게 끌다가 목을 울린 채 닫아요.', b: '모음을 짧게 끊고 닫아요. 목은 울리지 않아요.' },
};
const MP_FIX = {
  ins: { a: '첫 자음 뒤에 모음이 들어간 것으로 들렸어요. 자음끼리 붙여', b: '두 자음이 붙은 것으로 들렸어요. 사이의 짧은 어를 또렷하게 내' },
  voice: { a: '모음이 짧게 들렸어요. 모음을 더 길게 끌고 목을 울린 채 닫아', b: '모음이 길게 들렸어요. 모음을 짧게 끊고 닫아' },
};
const sideLab = (p, s) => p.kind === 'ins' ? `${FC.word(s === 'a' ? p.a : p.b)} · ${FC.beats(FC.nSyl(s === 'a' ? p.a : p.b))}` : `${FC.word(s === 'a' ? p.a : p.b)} · ${s === 'a' ? '긴 모음' : '짧은 모음'}`;
function mpDraw() {
  const { p, w, other } = mpTarget();
  const fin = k => p.kind === 'voice' ? { final: finClass(k) } : k === p.b ? { paint: false } : {};
  let h = `<div class="mp-ctl">${row('짝', pairSel(MP.pair, 'mp', FC.MP_PAIRS, '').replace('data-sel="mp"', 'id="mpSel"'))}${row('말할 낱말', seg('말할 낱말', [['a', esc(sideLab(p, 'a'))], ['b', esc(sideLab(p, 'b'))]], MP.side, 'mpside'))}</div>`;
  h += `<div class="mp-body"><div class="mp-fig">${p.kind === 'voice' ? vbarsHTML(p) : ballSVG(w, { R: 24 })}<small>${p.kind === 'voice' ? '모음 길이 · 밝은 선생님을 잰 값' : `${esc(FC.word(w))} · 밝은 선생님을 잰 박자 공`}</small></div>
    <div class="mp-word"><p class="mp-big">${wordHTML(w, fin(w))}</p><p class="note">${esc(FC.ipa(w))} · ${esc(FC.entry(w).gloss)} · 짝 → ${wordHTML(other, fin(other))}</p>
    <p class="note">${esc(MP_TIP[p.kind][MP.side])}</p>
    <div class="wrow">${wBtn(w, 'tc', fin(w))}${wBtn(other, 'tc', fin(other))}</div></div></div>`;
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
    h += `<p class="verdict"><b class="${cls}">${esc(FC.HEARD_KO[r.verdict])}</b>${r.verdict === 'partner' ? `받아 적은 말 → 짝 낱말 ${esc(FC.word(r.partner))}. ${esc(MP_FIX[p.kind][MP.side])} 다시 해 보세요.` : r.verdict === 'target' ? '인식기가 목표 낱말로 받아 적었어요.' : r.verdict === 'maybe' ? `목표 낱말 → ${r.rank}번째 후보. 조금 더 또렷하게 해 보세요.` : r.verdict === 'other' ? '목표 낱말도 짝 낱말도 아닌 말로 받아 적었어요. 낱말 하나만 또박또박 말해 보세요.' : ''}</p>`;
    if (r.alts && r.alts.length) h += `<p class="note">인식 후보: ${r.alts.map((a, i) => `<span class="alt${i === 0 ? ' top' : ''}" lang="en">${esc(a)}</span>`).join(' · ')}</p>`;
  }
  if (MP.err) h += `<p class="sh-err">${esc(MP.err)}</p>`;
  if (MP.url) h += `<div class="mo"><button type="button" class="sh-play" id="mpMine">${ICO.play} 내 목소리</button>${FCV.supported ? `<button type="button" class="sh-play" id="mpModel">${ICO.play} 본보기</button><button type="button" class="sh-play" id="mpBoth">${ICO.play} 번갈아 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`;
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
        onText(alts) { MP.res = Object.assign(FC.heard(w, alts), { alts }); mpResult(); },
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
        if (url) playUrl(url, $('mpMine'), () => { if (FCV.supported) speak(wSeq(w)); });
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
   11. 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황).', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = FC.SGRP_ORDER.map(gk => ({ gk, rows: FC.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk) }));
  $('shList').innerHTML = groups.map(({ gk, rows }) => `<section class="sh-grp"><h3><span class="ptag g-${gk}">${esc(FC.SGRP[gk].ko)}</span> ${esc(FC.SGRP[gk].long.split(' — ')[1] || '')}</h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${FCV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-en">${sentHTML(s.en)}</span><small>${esc(s.ko)}</small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { return tSeq(FC.SENT[i].en); }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = FC.SENT[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. 문장을 또박또박 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, FC.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${FCV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
    shPlayMine(i, true);
  };
  SHREC.rec = mr; mr.start(); shMicState(i, true);
  shResult(i, '<span class="note">녹음 중이에요. 다 말했으면 ‘멈추기’를 눌러요(6초가 지나면 저절로 멈춰요).</span>');
  SHREC.tm = setTimeout(() => { if (SHREC.rec === mr) { SHREC.rec = null; try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 6000);
}
function shPlayMine(i, thenOrig) {
  const b = document.querySelector(`.sh-row[data-i="${i}"] [data-mine]`);
  playUrl(SHREC.url[i], b, thenOrig && FCV.supported ? () => speak(shSeq(i)) : null);
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
   12. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 그림 문제는 박자 공 · EN.mouth로 그림
   ========================================================= */
const QCOL = { bg: '#10151C', text: '#EEF1F4', muted: '#94A0AE', p: '#FFC15E', bad: '#FF8E8E', hover: '#6EC8FF', box: '#2A3644' };
const qfont = (px, w = 500) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function rrq(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
const markOf = (i, st) => st.done && i === st.answer ? QCOL.p : st.done && i === st.pick ? QCOL.bad : st.hover === i ? QCOL.hover : null;
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
        g.beginPath(); g.arc(x + 18, 22, 11, 0, Math.PI * 2); g.fillStyle = '#FFC15E'; g.fill();
        g.font = qfont(12, 700); g.fillStyle = '#1D1305'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], x + 18, 23);
      }
    } };
}
// 입 그림 넷 (A~D)
const mouthFig = (label, poses) => panelFig(label, 4, (g, k, x) => M.draw(g, x + 2, 40, 0.34, poses[k], { mark: '#FFC15E', gap: false }));
// 박자 공 무늬 넷 (A~D): 'e' 영어 박자(하늘) · 'k' 한국어식(주황) · 'i' 넣은 으(분홍 점선)
function ballFig(label, pats, text) {
  return panelFig(label, pats.length, (g, k, x, w) => {
    const p = pats[k], n = p.length, step = Math.min(46, (w - 20) / n), x0 = x + w / 2 - step * (n - 1) / 2;
    p.forEach((v, i) => {
      const c = v === 'e' ? '#6EC8FF' : v === 'k' ? '#FF9F7A' : '#FF7AA8', r = Math.min(v === 'e' ? 20 : 12, step * 0.42), X = x0 + i * step;
      g.beginPath(); g.arc(X, 104, r, 0, Math.PI * 2);
      if (v === 'i') { g.fillStyle = 'rgba(255,122,168,0.16)'; g.fill(); g.setLineDash([4, 3]); } else { g.fillStyle = c; g.globalAlpha = 0.8; g.fill(); g.globalAlpha = 1; }
      g.strokeStyle = c; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
    });
    if (text) { g.font = qfont(14, 600); g.fillStyle = QCOL.muted; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text[k], x + w / 2, 168); }
  });
}
const QS = (() => {
  const end = (b, kd) => FC.ending(b, kd);
  const q = [
    { q: '책상(desk)은 영어로 몇 박자인가요?', opts: ['세 박자', '두 박자', '한 박자', '네 박자'], a: 2,
      why: 'desk → 모음 소리가 에(ɛ) 하나라 한 박자예요. 한국어식 데스크는 끝의 s · k 뒤에 으를 넣어 세 박자가 돼요.',
      check: () => FC.nSyl('desk') === 1 && FC.koSyl('desk') === 3 },
    { q: '한국어식 스트라이크에서 영어에 없는 ‘으’는 몇 개인가요?', opts: ['하나', '둘', '셋', '넷'], a: 2,
      why: '스 · 트 · 크 셋이에요. 이는 영어 aɪ → 뒤 조각이라 넣은 으와는 달라요. 영어 strike = 한 박자.',
      check: () => FC.koInserted('strike').length === 3 && FC.nSyl('strike') === 1 },
    { q: 'desk → 끝 k 소리에서 멈춘 입 모양은? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 0,
      figure: mouthFig('입 옆 단면도 넷. A 혀 뒤를 여린입천장에 붙여 막음, B 혀끝을 윗잇몸 가까이 대어 바람이 나감, C 혀를 내리고 입을 조금 벌림(으), D 입을 크게 벌림(아)', ['k', 's', 'eu', 'a']),
      why: 'A → 혀 뒤를 여린입천장에 붙이고 멈춰요. B는 s, C는 으, D는 아예요. k 소리에서 혀를 떼며 목소리를 실으면 C의 으가 나와요.',
      check: () => { const c = M.contact('k'); return c.touch && c.where === '여린입천장' && !M.contact('eu').touch && !M.contact('s').touch; } },
    { q: '끝 자음을 터뜨릴 때 ‘으’가 생기는 까닭은?', opts: ['입술을 닫기 때문', '혀를 떼면서 목소리(성대 울림)를 싣기 때문', '숨을 멈추기 때문', '혀끝을 윗잇몸에 대기 때문'], a: 1,
      why: '닫은 채 멈추거나 숨만 살짝 내보내면 으가 생기지 않아요. 혀나 입술을 떼는 순간 목소리를 실으면 모음 으가 되어 박자가 늘어요.',
      check: () => M.contact('k').touch && !M.contact('eu').touch },
    { q: 'strike → 영어의 박자 공으로 그리면? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 3,
      figure: ballFig('박자 공 무늬 넷. A 주황 공 셋과 분홍 점선 공 둘 — 다섯 박자, B 공 셋, C 공 둘, D 하늘 공 하나', [['i', 'i', 'k', 'k', 'i'], ['e', 'e', 'e'], ['e', 'e'], ['e']], ['다섯 박자', '세 박자', '두 박자', '한 박자']),
      why: 'D → 모음 소리가 aɪ 하나라 한 박자예요. s → t → r 소리는 모음 없이 바로 이어요. A는 한국어식 스트라이크예요.',
      check: () => FC.nSyl('strike') === 1 && FC.koSyl('strike') === 5 },
    { q: '짝 bag · back → 가를 때 가장 잘 들리는 열쇠는?', opts: ['끝 자음 뒤의 으', '끝 자음 앞 모음의 길이', '첫소리 b', '박자 수'], a: 1,
      why: 'bag → 끝이 목을 울리는 소리(g)라 모음이 길어요. back → 끝이 울리지 않는 소리(k)라 짧아요. 둘 다 한 박자이고, 으를 붙이지 않아요.',
      check: () => !!FC.voiceDiff('bag', 'back') && FC.nSyl('bag') === 1 },
    { q: '-ed가 한 박자를 더 만드는 낱말은?', opts: ['worked', 'played', 'wanted', 'asked'], a: 2,
      why: 'want → 끝이 t라서 -ed = [ɪd], wan·ted 두 박자. worked [t] · played [d] · asked [t] → 박자가 그대로예요.',
      check: () => end('want', 'ed').extra === 1 && end('work', 'ed').extra === 0 && end('play', 'ed').extra === 0 && end('ask', 'ed').extra === 0 },
    { q: '복수형 -s → [ɪz], 한 박자 느는 낱말은?', opts: ['cats', 'dogs', 'books', 'buses'], a: 3,
      why: 'bus → 끝이 s라서 -es = [ɪz], 두 박자. cats [s] · dogs [z] · books [s] → 한 박자 그대로예요.',
      check: () => end('bus', 's').snd === 'ɪz' && end('cat', 's').extra === 0 && end('dog', 's').snd === 'z' && end('book', 's').snd === 's' },
    { q: '크리스마스를 영어로(Christmas) 말하면 몇 박자인가요?', opts: ['두 박자', '세 박자', '네 박자', '다섯 박자'], a: 0,
      why: 'Christ·mas → 모음 소리 둘, 두 박자예요. 한국어식 크리스마스는 k · s · s 뒤에 으를 넣어 다섯 박자예요.',
      check: () => FC.nSyl('Christmas') === 2 && FC.koSyl('Christmas') === 5 },
    { q: 'Let me check it again. — check + it → 이어 말하면?', opts: ['체크 잇', '체킷', '체크 이트', '첵 잇'], a: 1,
      why: '끝 자음 k 소리를 다음 낱말의 첫 모음에 붙여 체킷처럼 말해요. 으를 넣을 틈이 없어요.',
      check: () => FC.links('Let me check it again.').indexOf('check') >= 0 },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[끝소리] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 2) console.warn('[끝소리] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { FCV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = FCS.chapterAt(T);
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
// 화면 누르기: 낱말 · 공 · 한글 표기는 그 목소리로, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * FCS.W, (e.clientY - r.top) / r.height * FCS.H]; };
const hitAt = (x, y) => started ? FCS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
let lastHit = { k: '', at: 0 };
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.play && FCV.supported) {
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
EN.say.wire(document, { before() { FCV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = ' ' + FCV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 영상의 낱말 · 공 · 한글 표기 · 목소리 단추, 직접 해 보기(고르는 것은 하나씩), 박자 세기(낱말 × 목소리 넷), 내 발음 확인, 듣고 고르기, 따라 말하기
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text) return;
    const id = FCV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: FCV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), keepLab = JSON.stringify(LAB), base = JSON.parse(FCS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 누를 수 있는 낱말 · 공 · 한글 표기 · 목소리 단추. 직접 해 보기로 바뀌는 장면도 하나씩
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t, ch.t + ch.d]; };
    const sweeps = [[{}, [0, END]]]
      .concat(LISTEN_PICK.map(k => [{ lword: k }, span('listen')]), FC.VOICES.map(v => [{ lword: 'desk', voice: v.sp }, span('listen')]))
      .concat(['k', 'p', 't'].map(k => [{ stopk: k }, span('stop')]), CLUS_PICK.map(k => [{ clus: k }, span('cluster')]))
      .concat(FC.VPAIRS.map(p => [{ vpair: p.id }, span('voice')]), ['t', 'd', 'ɪd'].map(k => [{ ending: k }, span('ending')]))
      .concat(FC.LOAN.map(o => [{ loan: o.w }, span('loan')]), FC.SENT.map((_, i) => [{ sent: i }, span('sentence')]));
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.5) { FCS.render(g, t); FCS.hits().forEach(h => addSeq(h.play, 'video')); }
    });
    // 2) 직접 해 보기: 장마다 + 고르는 것은 하나씩
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* */ } });
    LISTEN_PICK.forEach(k => { S.lword = k; FC.VOICES.forEach(v => { S.voice = v.sp; LABS.listen(); }); });
    KO_PICK.forEach(k => { LAB.ko = k; LABS.korean(); });
    ['k', 'p', 't'].forEach(k => { S.stopk = k; LABS.stop(); });
    CLUS_PICK.forEach(k => { S.clus = k; LABS.cluster(); });
    FC.VPAIRS.forEach(p => { S.vpair = p.id; LABS.voice(); });
    FC.INFL.forEach(x => { LAB.infl = x.form; LABS.ending(); });
    FC.LOAN.forEach(o => { S.loan = o.w; LABS.loan(); });
    FC.SENT.forEach((_, i) => { S.sent = i; LABS.sentence(); });
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); Object.assign(LAB, JSON.parse(keepLab)); dirty = true; }
  // 3) 박자 세기: 낱말 × 목소리 넷 + 한국어식 표기 · 짝 낱말 · 바탕 낱말 / 내 발음 확인: 짝 낱말(밝은 선생님)
  hvPool('all').forEach(k => {
    FC.VOICES.forEach(v => {
      add(v.sp, FC.word(k), 'hvpt');
      const p = FC.pairOf(k); if (p) { add(v.sp, FC.word(p.a), 'hvpt'); add(v.sp, FC.word(p.b), 'hvpt'); }
      const x = FC.inflOf(k); if (x) add(v.sp, FC.word(x.base), 'hvpt');
    });
    const e = FC.entry(k); if (e.ko) add('ko', e.ko, 'hvpt');
  });
  FC.MP_PAIRS.forEach(p => { add('tc', FC.word(p.a), 'mypron'); add('tc', FC.word(p.b), 'mypron'); });
  // 4) 듣고 고르기: 들려주는 말 + 견줘 듣기(같은 목소리)
  FC.DRILL.forEach(q => {
    addSeq(drillSeq(q), 'drill');
    FC.drillWords(q).forEach(w => add(q.sp, FC.word(w), 'drill'));
    const x = q.kind === 'ed' && FC.inflOf(q.say); if (x) add(q.sp, FC.word(x.base), 'drill');
    const e = q.kind === 'count' && FC.entry(q.say); if (e && e.ko) add('ko', e.ko, 'drill');
  });
  // 5) 따라 말하기
  FC.SENT.forEach((_, i) => addSeq(shSeq(i), 'shadow'));
  return out;
};
// 도구용(읽기만): 잴 줄의 정보 — tools/dialogue-lines.cjs가 audio/dialogue/measure-meta.json으로 씀 → tools/measure-syllables.py
// 낱말 하나(word: 박자 수 n · 센 음절 at · 울림 덩어리 세기 count · 크기 띠 env · 유성 · 무성 짝 pair) · 한국어식(ko: 글자 수 = 음절 수, 크기 띠) · 그 밖의 문장(other: 받아쓰기만)
window.__measureMeta = lines => {
  const byText = {};
  Object.values(FC.DICT).forEach(e => { byText[FCV.spoken(FC.word(e.key))] = e.key; });
  return lines.map(l => {
    const o = { id: l.id, sp: l.sp, text: l.text };
    if (l.sp === 'ko') return Object.assign(o, { kind: 'ko', n: [...l.text].length, env: true });
    const k = byText[l.text];
    if (!k) return Object.assign(o, { kind: 'other' });
    Object.assign(o, { kind: 'word', key: k, n: FC.nSyl(k), at: FC.stressAt(k), count: true, env: true });
    const p = FC.pairOf(k);
    if (p && p.kind === 'voice') Object.assign(o, { pair: FCV.lineId(l.sp, FC.word(p.a === k ? p.b : p.a)), long: p.a === k });
    return o;
  });
};
hvInit();
mpInit();
shInit();
PDrill($('drillRoot'), FC.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 박자, 끝소리, 짝 낱말이 귀에 들어오네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보고, 같은 목소리로 견줘 들어 보세요.' : '처음에는 누구나 헷갈려요. 놀이터의 박자 세기로 여러 목소리를 더 들어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '박자는 모음 소리만큼, 끝 자음은 닫고 멈추기 — 모두 알았네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(FCS.baseText()).then(() => { dirty = true; });
setTimeout(() => FCS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
