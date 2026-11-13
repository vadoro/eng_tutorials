/* 워러가 되는 t — 미국식 t와 이어 말하기: 플레이어, 직접 해 보기, t 듣고 가르기 훈련, t 바꾸기 실험실, 내 목 울림 띠, 따라 말하기, 듣고 고르기, 퀴즈, 영상 추출
 * t · d의 모양과 까닭 · 이어지는 곳은 grammar.js(AT), 그림은 scenes.js(ATS), 목소리와 잰 값은 voices.js(ATV)가 맡습니다.
 * 소리가 겹치지 않게: 읽기 전에는 발음 듣기 · 음성 해설 · 녹음 재생을 멈추고 영상을 일시정지해요(ATV.play의 before).
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const AT = window.AT, ATS = window.ATS, ATV = window.ATV, S = ATS.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = ATS;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L3 = 'ABC';
const pickOne = a => a[Math.floor(Math.random() * a.length)];
// 확인(받아쓰기 · 센 음절 · t 자리 목 울림)을 통과한 목소리 — 통과하지 못한 파일은 훈련 · 실험실에 들려주지 않아요(잰 값이 하나도 없으면 모든 목소리)
const ALL_SP = AT.VOICES.map(v => v.sp);
const anyMeas = () => Object.keys(window.PRON_MEASURE || {}).length > 0;
const okVoices = words => { const ok = ALL_SP.filter(sp => words.every(w => !!ATV.meas(sp, w))); return ok.length || anyMeas() ? ok : ALL_SP; };
const cv = $('cv'), ctx = cv.getContext('2d');
AT.check();

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = ATS.fonts;
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
  const ready = new Promise(res => ATS.collectText(res)).then(loadFonts);
  window.EN_EXPORT = {
    title: '워러가 되는 t — 미국식 t와 이어 말하기 — 영어 튜토리얼',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { ATS.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  mic: ATS.iconSVG('mic'),
  rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="currentColor"/></svg>',
};
// 듣기 · 천천히 단추 묶음 (회화 영역의 듣기 연습 문제와 같은 모양 · 같은 키 R · S)
const lsnBar = () => ATV.supported
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
  const cap = started ? ATS.captionAt(T) : '재생 단추를 누르면 시작해요. 화면 속 낱말과 목 울림 띠를 누르면 그 소리를 들려줘요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = capHTML(cap) || '&nbsp;'; }
  const ci = ATS.chapterAt(T);
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
  // 입 그림이 움직이는 장(짧은 ㄹ)은 멈춰 있어도 다시 그림
  if (dirty || (started && CHAPTERS[ATS.chapterAt(T)].id === 'flap')) { dirty = false; ATS.render(ctx, started ? (playing ? T : T + (CHAPTERS[ATS.chapterAt(T)].id === 'flap' ? (ts / 1000) % 1.6 * 0 : 0)) : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
// 직접 해 보기에서 고르면: 영상을 멈추고 그 장의 u초 장면을 보여 줌
function showAt(u) {
  const ch = CHAPTERS[ATS.chapterAt(T)];
  if (playing) pause();
  T = ch.t + u; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}

/* =========================================================
   4. 소리 — 목소리 넷 + 한국어식으로 읽기 (voices.js). 읽기 전에 다른 소리는 모두 멈춤
   ========================================================= */
let audioEl = null;                       // 녹음 재생
function stopAudio() { if (audioEl) { try { audioEl.pause(); } catch (e) { /* 이미 멈춤 */ } audioEl = null; } document.querySelectorAll('.sh-play.saying').forEach(b => b.classList.remove('saying')); }
function stopSounds() { EN.say.stop(); ATV.stop(); stopAudio(); }
const SEQS = [], SEQKEY = new Map();
const seqId = seq => { const k = JSON.stringify(seq); let i = SEQKEY.get(k); if (i == null) { i = SEQS.length; SEQS.push(seq); SEQKEY.set(k, i); } return i; };
function speak(seq, o = {}) {
  return ATV.play(seq, Object.assign({ before() { NARR.reset(); if (playing) pause(); stopAudio(); stopListening(); } }, o));
}
// 듣기 단추: data-lp = 읽을 차례 번호. 가장 가까운 [data-slow] 상자의 ‘천천히’를 따름. 같은 단추를 곧바로 다시 누르면 천천히
let lastLp = { b: null, at: 0 };
const lpBtn = (seq, label, cls = '', inner) => ATV.supported ? `<button type="button" class="lp-play ${cls}" data-lp="${seqId(seq)}" aria-label="${esc(label)}" title="${esc(label)}">${inner || SVG_PLAY}</button>` : '';
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
const tSeq = (text, sp = 'tc') => [{ text, sp }];
const pairSeq = (a, b, sp = 'tc') => [{ text: a, sp }, { text: b, sp, gap: 0.8 }];
const WHO = { tc: '밝은 선생님', tf: '차분한 선생님', uf: '미국 여성', um: '미국 남성', ko: '한국어식' };

/* =========================================================
   5. 글 칠하기 — t · d 글자를 모양 색으로(mk-asp 하늘 · mk-st 모래 · mk-flap 민트 · mk-glot 보라 · mk-drop 분홍 흐리게 ·
   mk-final 회색 · mk-yu 노랑), 이어지는 곳은 노란 ‿(lk), 한국어식(mk-trap 주황). 목 울림 띠(SVG)는 ATS.bandData로
   ========================================================= */
const MKC = { asp: 'mk-asp', st: 'mk-st', flap: 'mk-flap', glot: 'mk-glot', drop: 'mk-drop', final: 'mk-final', yu: 'mk-yu' };
const tHTML = (text, o = {}) => '<span lang="en">' + AT.segs(text).map(s => {
  if (s.role === null && s.w == null && o.links !== false && /^\s+$/.test(s.t) && s.gap > 0 && AT.linkAt(text, s.gap - 1)) return '<span class="lk" title="이어짐" aria-label="이어짐">‿</span>';
  return o.paint !== false && MKC[s.role] ? `<mark class="${MKC[s.role]}" title="${esc(AT.kindName(s.x, { short: true }))}">${esc(s.t)}</mark>` : esc(s.t);
}).join('') + '</span>';
const capsOf = ATS.capsOf;
// 낱말 단추: 누르면 들려줌(곧바로 다시 누르면 천천히)
const wBtn = (text, sp = 'tc', o = {}) => ATV.supported
  ? `<button type="button" class="wbtn${o.cls ? ' ' + o.cls : ''}" data-lp="${seqId(tSeq(text, sp))}" title="듣기: ${esc(text)}${sp !== 'tc' ? ' · ' + WHO[sp] : ''}">${SVG_PLAY}${o.html || tHTML(text, o)}</button>`
  : `<span class="wbtn off">${o.html || tHTML(text, o)}</span>`;
const koBtn = (text, label) => ATV.supported ? `<button type="button" class="wbtn ko" data-lp="${seqId([{ text, sp: 'ko' }])}" title="한국어식으로 듣기: ${esc(text)}">${SVG_PLAY}${label || `<mark class="mk-trap">${esc(text)}</mark>`}</button>` : `<span class="wbtn off ko">${label || esc(text)}</span>`;
// 목 울림 띠 (SVG): 잰 값이면 그 목소리를 잰 대로, 없으면 그림으로 줄인 모양(‘잰 값 아님’)
function bandSVG(text, o = {}) {
  const B = o.data || ATS.bandData(text, o), Wd = o.w || 300, h = o.h || 56, top = 30, n = B.lv.length, ko = !!o.ko;
  const y = top + h / 2, Hh = top + h + 26;
  let d = '';
  B.lv.forEach((v, i) => { d += `${i ? 'L' : 'M'}${(6 + i / (n - 1) * (Wd - 12)).toFixed(1)} ${(y - v * h * 0.46).toFixed(1)}`; });
  for (let i = n - 1; i >= 0; i--) d += `L${(6 + i / (n - 1) * (Wd - 12)).toFixed(1)} ${(y + B.lv[i] * h * 0.46).toFixed(1)}`;
  let s = `<rect class="vb-bg" x="6" y="${top}" width="${Wd - 12}" height="${h}" rx="6"/><path class="vb ${ko ? 'ko' : ''}${B.measured ? '' : ' sch'}" d="${d}Z"/>`;
  B.syl.forEach((q, i) => { const lab = B.labels[i] || ''; s += `<text class="vb-t${ko ? ' ko' : ''}" x="${(6 + (q.a + q.b) / 2 * (Wd - 12)).toFixed(1)}" y="${top + h + 17}" text-anchor="middle">${esc(lab)}</text>`; });
  B.mk.forEach(q => {
    const X = 6 + q.at * (Wd - 12), cls = q.want === 'flap' ? 'flap' : ko ? 'ko' : 'asp';
    s += `<line class="vb-m ${cls}" x1="${X.toFixed(1)}" y1="${top - 3}" x2="${X.toFixed(1)}" y2="${top + h + 3}"/><text class="vb-l ${cls}" x="${clamp(X, 60, Wd - 60).toFixed(1)}" y="${top - 10}" text-anchor="middle">${esc(o.markText ? o.markText(q) : ATS.markLabel(q))}</text>`;
  });
  const what = o.what || (ko ? `${o.ko} (한국어식)` : `${text}${o.sp && o.sp !== 'tc' ? ' · ' + WHO[o.sp] : ''}`);
  const lab = `${what} — 목 울림 띠${B.mk.length ? ', ' + B.mk.map(q => ATS.markLabel(q)).join(' · ') : ''}${B.measured ? ' (이 목소리를 잰 값)' : ' (그림으로 줄인 모양)'}`;
  const svg = `<svg class="vband" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}" role="img" aria-label="${esc(lab)}">${s}</svg>`;
  return `<span class="bfig">${svg}<small class="meas">${o.caption || (B.measured ? '이 목소리를 잰 목 울림' : '그림으로 줄인 모양 · 잰 값 아님')}</small></span>`;
}
// t · d마다 모양 · 까닭 표
function kindTable(text) {
  const toks = AT.tokens(text), xs = AT.ts(text).filter(x => MKC[x.kind]);
  if (!xs.length) return '<p class="note">이 말에는 모양이 바뀌는 t · d가 없어요.</p>';
  return `<table class="ftab"><thead><tr><th scope="col">낱말</th><th scope="col">모양</th><th scope="col">까닭</th></tr></thead><tbody>${xs.map(x => `<tr><td lang="en" class="fw">${tHTML(toks[x.w].t)}</td><td class="fw k-${x.kind}">${esc(AT.kindName(x))}</td><td>${esc(AT.kindWhy(x))}</td></tr>`).join('')}</tbody></table>`;
}
const linkNote = text => { const ls = AT.links(text), toks = AT.tokens(text); return ls.length ? `이어지는 곳 ${ls.length}곳 → ${ls.map(l => `${toks[l.w].t}‿${toks[l.w + 1].t}`).join(' · ')}` : ''; };

/* =========================================================
   6. 듣고 고르기 (이 튜토리얼 전용, 회화 영역의 듣기 연습 문제와 같은 .edr 모양) — 소리 먼저, 글은 답한 뒤
   키보드: A · B · C 또는 1 · 2 · 3 고르기 · H 힌트 · R 다시 듣기 · S 천천히 · Enter/→ 다음
   ========================================================= */
const KIND_KO = { kind: '짧은 ㄹ인가요, 터지는 t인가요?', pair: '짧은 ㄹ은 어느 낱말?', ko: '한국어식은 어느 쪽?', count: '몇 낱말이 이어졌나요?' };
const SIT = {
  kind: '낱말 하나를 들려줘요. 가운데 t 소리는 혀끝으로 짧은 ㄹ처럼 톡 스쳤나요, 막았다가 숨과 함께 터졌나요?',
  pair: '낱말 둘을 차례로 들려줘요. t 소리가 짧은 ㄹ처럼 톡 스친 쪽은 첫째인가요, 둘째인가요?',
  ko: '같은 말을 두 가지로 이어서 들려줘요. 한국어식으로 글자대로 읽은 쪽은 어느 쪽인가요?',
  count: '한 덩어리로 이어 말한 소리를 들려줘요. 몇 낱말이 이어져 있나요?',
};
function PDrill(root, items, cfg = {}) {
  let st = items.map(() => ({ pick: null, hints: 0 }));
  let cur = 0, retry = null, mode = null;
  const hear = ATV.supported;
  root.classList.add('edr', 'ldr'); root.tabIndex = -1;
  const order = () => retry || items.map((_, i) => i);
  const score = () => ({ done: st.filter(s => s.pick !== null).length, ok: st.filter((s, i) => s.pick === items[i].a).length });
  function playLine(slow, toggle) {
    const act = slow ? 'slowplay' : 'play';
    if (toggle && mode === act && ATV.busy()) { ATV.stop(); return; }
    const it = items[cur], seq = AT.drillSeq(it);
    const say = t => { const n = root.querySelector('.ldr-now'); if (n) n.textContent = t; };
    speak(seq, { slow: !!slow, onitem(i) { say(it.kind === 'ko' || it.kind === 'pair' ? `${i ? '둘째' : '첫째'} 소리 · 말하는 중` : `${WHO[it.sp]} · 말하는 중`); }, onend(stopped) { mode = null; paintPlay(root, null); say(stopped ? '' : '다 들었어요. 고르세요.'); } });
    mode = act; paintPlay(root, mode);
  }
  function go(i, auto) { ATV.stop(); cur = i; render(); if (auto && hear && cur >= 0) playLine(false); }
  function next() {
    const o = order(), k = o.indexOf(cur);
    for (let j = k + 1; j < o.length; j++) if (st[o[j]].pick === null) return go(o[j], true);
    for (let j = 0; j < k; j++) if (st[o[j]].pick === null) return go(o[j], true);
    cur = -1; ATV.stop(); render();
  }
  function answer(k) {
    const s = st[cur]; if (s.pick !== null || k >= items[cur].opts.length) return;
    ATV.stop();
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
    if (it.kind === 'kind') {
      const x = AT.mainT(it.say), why = `${it.say} → ${capsOf(it.say)} · ${AT.kindWhy(x)}`;
      return it.opts.map((op, k) => k === it.a ? why : k === 0 ? '짧은 ㄹ은 t 바로 뒤가 약한 음절일 때예요 — 여기서는 t 바로 뒤가 센 음절이에요.' : '숨이 터지는 t는 낱말 처음이나 센 음절의 처음이에요 — 여기서는 t 뒤가 약한 음절이에요.');
    }
    if (it.kind === 'pair') return it.seq.map(w => { const x = AT.mainT(w); return `${w} → ${capsOf(w)} · ${AT.KIND[x.kind].ko}${x.kind === 'flap' ? ' (t 뒤가 약한 음절)' : ' (t 바로 뒤가 센 음절)'}`; });
    if (it.kind === 'ko') return it.seq.map(x => x.sp === 'ko' ? `한국어식 → ${x.text}. 글자대로 읽어 t 자리에서 목 울림이 끊겨요` : `미국 영어 → ${x.text}. ${AT.ts(x.text).filter(q => q.kind === 'flap').length ? 't 소리가 짧은 ㄹ이 되어 울림이 이어져요' : '끝 자음을 다음 모음에 붙여 이어 말해요'}`);
    const toks = AT.tokens(it.say), n = toks.length;
    return it.opts.map((op, k) => k === it.a ? `${n}낱말 → ${toks.map(t => t.t).join(' · ')}. ${linkNote(it.say)}` : k < it.a ? `${op}보다 많아요 — 이어진 곳마다 끊어 보면 낱말이 하나 더 숨어 있어요.` : `${op}는 너무 많아요 — ${toks.map(t => t.t).join(' · ')}뿐이에요.`);
  }
  function optLab(it, op, k, done) {
    if (it.kind === 'kind') return `<span class="ldr-t">${esc(op)}</span><small>${k ? '막았다가 숨과 함께 터뜨림 · 울림 끊김' : '혀끝으로 한 번 톡 · 울림 이어짐'}</small>`;
    if (it.kind === 'pair') return `<span class="ldr-t">${esc(op)}</span>${done ? `<small lang="en">${esc(it.seq[k])} · ${esc(capsOf(it.seq[k]))}</small>` : ''}`;
    if (it.kind === 'ko') return `<span class="ldr-t">${esc(op)}</span>${done ? `<small>${it.seq[k].sp === 'ko' ? '한국어식 · ' + esc(it.seq[k].text) : '미국 영어 · ' + esc(it.seq[k].text)}</small>` : ''}`;
    return `<span class="ldr-t">${esc(op)}</span>`;
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
    const it = items[cur], s = st[cur], done = s.pick !== null, ok = s.pick === it.a, steps = AT.hints(it);
    const o = order(), pos = o.indexOf(cur), reveal = done || !hear, n = it.opts.length;
    let h = dots() + `<div class="edr-card ldr-card${done ? (ok ? ' ok' : ' no') : ''}">`;
    h += `<p class="edr-meta"><span class="adr-place">${ATS.iconSVG('ear', 'pi')}${esc(KIND_KO[it.kind])}</span><span>${retry ? `다시 풀기 ${pos + 1} / ${o.length}` : `문제 ${cur + 1} / ${items.length}`}</span><span class="edr-tag">${it.kind === 'ko' ? '소리 둘' : esc(WHO[it.sp])}</span></p>`;
    h += `<p class="adr-sit"><b>상황</b> ${esc(SIT[it.kind])}</p>`;
    h += lsnBar();
    if (reveal) {
      if (it.kind === 'ko') h += `<p class="ldr-q"><span class="ldr-t">${it.seq.map((x, k) => `<span class="kq">${k ? '둘째' : '첫째'} → ${x.sp === 'ko' ? `<mark class="mk-trap">${esc(x.text)}</mark>` : tHTML(x.text, { paint: done })}</span>`).join('')}</span></p>`;
      else if (it.kind === 'pair') h += `<p class="ldr-q"><span class="ldr-t">${it.seq.map((w, k) => `<span class="kq">${k ? '둘째' : '첫째'} → ${tHTML(w, { paint: done })}</span>`).join('')}</span></p>`;
      else h += `<p class="ldr-q"><span class="ldr-t">${tHTML(it.say, { paint: done, links: done })}</span>${done ? `<small>${esc(capsOf(it.say))} · ${esc(AT.meaning(it.say))}</small>` : ''}</p>`;
    }
    h += `<div class="ldr-opts ${n === 3 ? 'three' : 'two'}" role="group" aria-label="보기">` + it.opts.map((op, k) => {
      const cls = done ? (k === it.a ? ' right' : k === s.pick ? ' wrong' : ' off') : '';
      return `<div class="ldr-row${cls}" data-k="${k}"><button type="button" class="ldr-opt big" data-pick="${k}"${done ? ' disabled' : ''}><b>(${L3[k]})</b> ${optLab(it, op, k, done)}</button></div>`;
    }).join('') + '</div>';
    if (!done) h += `<div class="edr-acts"><button type="button" class="edr-btn ghost" data-act="hint"${s.hints >= 3 ? ' disabled' : ''}>${s.hints ? '다음 힌트' : '힌트 보기'} <small>${s.hints} / 3</small></button><span class="edr-keys">키보드: ${L3.slice(0, n).split('').join(' · ')} 고르기 · H 힌트${hear ? ' · R 다시 듣기 · S 천천히' : ''}</span></div>`;
    if (s.hints || done) h += '<ol class="edr-steps">' + steps.slice(0, done ? 3 : s.hints).map(x => `<li><b>${esc(x.head)}</b> ${esc(x.text)}</li>`).join('') + '</ol>';
    if (done) {
      h += `<p class="edr-verdict"><b>${ok ? '정답!' : `아쉬워요. 정답은 (${L3[it.a]}).`}</b></p>`;
      h += '<ul class="edr-notes">' + notes(it).map((t, k) => `<li class="${k === it.a ? 'right' : ''}"><b>(${L3[k]})</b> ${esc(t)}</li>`).join('') + '</ul>';
      let cmp = '', head = '목 울림 띠';
      if (it.kind === 'kind') cmp = `<span class="cmp-w">${wBtn(it.say, it.sp)}${bandSVG(it.say, { sp: it.sp })}</span>`;
      else if (it.kind === 'pair') { head = '같은 목소리로 견줘 보기'; cmp = it.seq.map(w => `<span class="cmp-w">${wBtn(w, it.sp)}${bandSVG(w, { sp: it.sp, w: 260 })}</span>`).join('') + lpBtn(pairSeq(it.seq[0], it.seq[1], it.sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서</span>`); }
      else if (it.kind === 'ko') {
        const ko = it.seq.find(x => x.sp === 'ko').text, en = it.seq.find(x => x.sp !== 'ko');
        head = '한국어식 · 미국 영어 견주기';
        cmp = `<span class="cmp-w">${koBtn(ko)}${bandSVG(en.text, { ko, w: 260 })}</span><span class="cmp-w">${wBtn(en.text, en.sp)}${AT.tmarks(en.text).length ? bandSVG(en.text, { sp: en.sp, w: 260 }) : ''}</span>`;
      } else { head = '이어진 곳'; cmp = `<span class="cmp-w">${wBtn(it.say, it.sp)}<small>${esc(linkNote(it.say))}</small></span>`; }
      h += `<div class="ldr-cmp"><span>${esc(head)}</span>${cmp}</div>`;
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
const pickRow = (words, cur, attr, o = {}) => `<div class="wrow sel">${words.map((w, i) => { const v = o.index ? i : w; return `<button type="button" class="pickw${cur === v ? ' on' : ''}" data-${attr}="${esc(v)}" aria-pressed="${cur === v}">${o.label ? o.label(w, i) : tHTML(w)}</button>`; }).join('')}</div>`;
// 한국어식 · 미국 영어를 나란히 (띠 둘)
const koEn = (en, ko, sp = 'tc') => `<div class="cmpballs"><div class="cb ko"><span>한국어식 — 글자대로</span>${koBtn(ko)}${AT.koMarks(ko).length ? bandSVG(en, { ko, w: 260 }) : '<small class="note">이 한국어식 소리는 목 울림을 재지 않았어요</small>'}</div><span class="arr">→</span><div class="cb en"><span>미국 영어</span>${wBtn(en, sp)}<small class="capsb">${esc(capsOf(en))}</small>${AT.tmarks(en).length ? bandSVG(en, { sp, w: 260 }) : ''}</div></div>`;
const voiceSeg = () => row('목소리', seg('목소리 고르기', AT.VOICES.map(v => [v.sp, v.ko]), S.voice || 'tc', 'vsp'));
const LABS = {
  intro() {
    return labHead('먼저 들어 보기') + `<p>같은 낱말을 한국어식으로 글자대로 읽은 소리와 미국 영어로 읽은 소리예요. 둘 다 눌러 들어 보고, 아래 띠에서 t 자리의 목 울림을 견줘 보세요.</p>
      ${koEn(AT.INTRO.en, AT.INTRO.ko)}
      <p class="note">띠는 낮은 소리(60~500Hz)의 크기예요 — 목이 울리는 동안 두껍고, 소리가 끊기면 가늘어져요. 점선은 t 자리예요. 같은 단추를 곧바로 다시 누르면 천천히 들려줘요.</p>`;
  },
  listen() {
    const sp = S.voice || 'tc';
    return labHead('목소리 바꿔 듣기') + voiceSeg() +
      `<p class="note">고른 목소리로 영상의 water · hotel 띠를 다시 그려요. 짝은 목소리마다 이어서 들려줘요.</p>
      <div class="voices4"><span>t · d가 같게 들리는 짝</span>${AT.TWIN.map(([a, b]) => lpBtn(pairSeq(a, b, sp), `${WHO[sp]}: ${a} · ${b}`, 'lp-voice', `${ICO.play}<span lang="en">${esc(a)} · ${esc(b)}</span>`)).join('')}</div>
      <div class="cmpballs">${AT.CONTRAST.map(w => `<div class="cb ${AT.mainT(w).kind === 'flap' ? 'weak' : 'en'}"><span>${esc(AT.KIND[AT.mainT(w).kind].ko)}</span>${wBtn(w, sp)}<small class="capsb">${esc(capsOf(w))}</small>${bandSVG(w, { sp, w: 260 })}</div>`).join('')}</div>`;
  },
  map() {
    let h = labHead('t의 지도 — 낱말 고르기') + AT.MAP.map(m => `<div class="cv-row"><span class="cv-lab k-${m.kind}">${esc(AT.KIND[m.kind].short)}</span>${pickRow(m.words, S.kword, 'kw')}</div>`).join('');
    if (!S.kword) return h + '<p class="note">낱말을 고르면 영상이 멈추고 그 낱말의 t · d마다 모양과 까닭을 크게 보여 줘요.</p>';
    return h + `<p class="enline">${wBtn(S.kword)} <small class="capsb">${esc(capsOf(S.kword))}</small></p>${kindTable(S.kword)}` + clearBtn;
  },
  flap() {
    const w = S.flapw;
    let h = labHead('짧은 ㄹ 낱말 고르기') + row('t', pickRow(AT.FLAPS, w, 'fw')) + row('d', pickRow(AT.DFLAPS, w, 'fw'));
    if (!w) return h + '<p class="note">낱말을 고르면 영상이 멈추고 그 낱말을 크게, 목 울림 띠와 함께 보여 줘요. 입 그림은 혀끝이 윗잇몸을 한 번 톡 치는 모습이에요.</p>';
    return h + `<p class="enline">${wBtn(w)} <small class="capsb">${esc(capsOf(w))}</small></p>${bandSVG(w)}<p class="note">${esc(AT.kindWhy(AT.mainT(w)))}</p>` + clearBtn;
  },
  stress() {
    const i = S.stress;
    let h = labHead('강세 짝 고르기') + pickRow(AT.STRESS, i, 'stp', { index: true, label: p => `<span lang="en">${esc(p[0])} · ${esc(p[1])}</span>` });
    if (i == null) return h + `<p class="note">짝을 고르면 영상이 멈추고 두 낱말의 목 울림 띠를 나란히 보여 줘요. 영상에는 앞의 ${AT.STRESS_SHOWN}짝만 나와요.</p>`;
    // 두 낱말을 모두 통과한 목소리로(밝은 선생님 tc가 먼저) — 센 음절이 사전과 다르게 읽힌 소리는 들려주지 않아요
    const [a, b] = AT.STRESS[i], sp = okVoices([a, b])[0] || 'tc';
    return h + `<div class="cmpballs">${[a, b].map(w => `<div class="cb ${AT.mainT(w).kind === 'flap' ? 'weak' : 'en'}"><span>${esc(AT.KIND[AT.mainT(w).kind].ko)}</span>${wBtn(w, sp)}<small class="capsb">${esc(capsOf(w))}</small>${bandSVG(w, { w: 260, sp })}</div>`).join('')}</div>
      <div class="wrow">${lpBtn(pairSeq(a, b, sp), '이어서 듣기', 'lp-pair', `${ICO.play}<span>이어서</span>`)}</div>` + clearBtn;
  },
  glot() {
    const w = S.glotw;
    let h = labHead('막는 t · 사라지는 t') + row('막음', pickRow(AT.GLOT, w, 'gw')) + row('사라짐', pickRow(AT.DROP, w, 'gw'));
    if (!w) return h + '<p class="note">낱말을 고르면 영상이 멈추고 크게 보여 줘요. 이 두 모양은 목 울림을 재지 않았어요 — 교재의 설명이고, 또박또박 말할 때는 t 소리를 살려요.</p>';
    const e = AT.entry(w);
    return h + `<p class="enline">${wBtn(w)} <small class="capsb">${esc(capsOf(w))}</small>${e.near ? ` <span class="near">≈ ${esc(e.near)}</span>` : ''}</p>${kindTable(w)}<p class="note">합성 음성도 t 소리를 살려 읽을 수 있어요. 빠지는 쪽은 경향이에요.</p>` + clearBtn;
  },
  across() {
    const i = S.across;
    let h = labHead('낱말 사이의 t') + pickRow(AT.ACROSS.map(x => x.en), i, 'ac', { index: true });
    if (i == null) return h + '<p class="note">구를 고르면 영상이 멈추고 한국어식(낱말마다 끊어 읽기)과 미국 영어를 나란히 보여 줘요.</p>';
    const it = AT.ACROSS[i];
    return h + `<p class="note">${esc(it.mean)} · 들리는 쪽 어림 <span class="near">${esc(it.near)}</span></p>${koEn(it.en, it.ko)}${kindTable(it.en)}` + clearBtn;
  },
  link() {
    const all = AT.LINK.concat(AT.YU), i = S.link;
    let h = labHead('이어 말하기 고르기') + row('자음+모음', pickRow(AT.LINK.map(x => x.en), i, 'lk', { index: true })) + row('t·d+you', `<div class="wrow sel">${AT.YU.map((x, k) => { const v = AT.LINK.length + k; return `<button type="button" class="pickw${i === v ? ' on' : ''}" data-lk="${v}" aria-pressed="${i === v}">${tHTML(x.en)}</button>`; }).join('')}</div>`);
    if (i == null) return h + '<p class="note">구를 고르면 영상이 멈추고 크게 보여 줘요. 노란 ‿ 표시가 이어지는 곳이에요.</p>';
    const it = all[i];
    return h + `<p class="note">${esc(it.mean)} · 들리는 쪽 어림 <span class="near">${esc(it.near)}</span> · ${esc(linkNote(it.en))}</p>${it.ko ? koEn(it.en, it.ko) : `<p class="enline">${wBtn(it.en)}</p>`}${i >= AT.LINK.length ? '<p class="note">t · d + you → 츄 · 쥬는 빠르게 말할 때의 경향이에요. 또박또박 말하면 그대로 낼 수도 있어요.</p>' : ''}` + clearBtn;
  },
  sentence() {
    const sel = `<select class="lab-sel" data-sel="sent" aria-label="문장 고르기"><option value="">영상대로</option>${AT.SGRP_ORDER.map(gk => `<optgroup label="${esc(AT.SGRP[gk].long)}">${AT.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk).map(([s, i]) => `<option value="${i}"${S.sent === i ? ' selected' : ''}>${esc(s.en)}</option>`).join('')}</optgroup>`).join('')}<optgroup label="긴 문장">${AT.LONG.map((s, k) => { const i = AT.SENT.length + k; return `<option value="${i}"${S.sent === i ? ' selected' : ''}>${esc(s.en)}</option>`; }).join('')}</optgroup></select>`;
    let h = labHead('문장 고르기') + row('문장', sel);
    if (S.sent == null) return h + '<p class="note">따라 말하기의 28문장과 긴 문장 셋 가운데 하나를 고르면, 영상이 멈추고 t · d의 모양과 이어지는 곳을 크게 보여 줘요.</p>';
    const s = ATS.SENT_POOL[S.sent];
    return h + `<p class="enline">${wBtn(s)}</p><p class="note">${esc(AT.meaning(s))} · ${esc(linkNote(s) || '이어지는 곳 없음')}</p>${kindTable(s)}` + clearBtn;
  },
  summary() {
    return labHead('이제 직접') + '<p>아래 <a href="#playground">t 듣고 가르기 훈련</a>에서 목소리 넷으로 짧은 ㄹ과 터지는 t를 가르고, <a href="#tswitch">t 바꾸기 실험실</a>에서 하나만 바꾼 짝의 t가 어떻게 달라지는지 보고, <a href="#myband">내 목 울림 띠</a>에서 내 t 자리를 재 보세요. <a href="#shadow">따라 말하기</a> 28문장과 <a href="#drill">듣고 고르기</a> 16문제도 있어요.</p>';
  },
};
function buildLab(ci) {
  const id = CHAPTERS[ci].id;
  $('lab').innerHTML = (LABS[id] || (() => ''))();
}
const relab = () => buildLab(ATS.chapterAt(T));
$('lab').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
  const d = b.dataset;
  if (b.id === 'labClear') { Object.assign(S, JSON.parse(ATS.DEFAULTS)); dirty = true; relab(); return; }
  if (d.vsp != null) { S.voice = d.vsp === 'tc' ? null : d.vsp; showAt(26); relab(); return; }
  if (d.kw != null) { S.kword = S.kword === d.kw ? null : d.kw; showAt(40); relab(); return; }
  if (d.fw != null) { S.flapw = S.flapw === d.fw ? null : d.fw; showAt(20); relab(); return; }
  if (d.stp != null) { S.stress = S.stress === +d.stp ? null : +d.stp; showAt(14); relab(); return; }
  if (d.gw != null) { S.glotw = S.glotw === d.gw ? null : d.gw; showAt(20); relab(); return; }
  if (d.ac != null) { S.across = S.across === +d.ac ? null : +d.ac; showAt(26); relab(); return; }
  if (d.lk != null) { S.link = S.link === +d.lk ? null : +d.lk; showAt(8); relab(); }
});
$('lab').addEventListener('change', e => {
  const t = e.target; if (!t.dataset || t.dataset.sel !== 'sent') return;
  S.sent = t.value === '' ? null : +t.value; showAt(8); relab();
});

/* =========================================================
   8. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   대문자로 쓴 낱말은 소문자로 읽고(글자 이름으로 읽지 않게), 한국어 속에 홀로 쓴 글자(t · d · s · n · r)는 글자 이름으로, = · + 는 쉼으로 읽어요
   ========================================================= */
const LETTER_KO = { t: '티', d: '디', s: '에스', n: '엔', r: '알' };
const NARR = (window.EN && EN.narration) ? EN.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  read: [[/\b([A-Z]{2,})\b/g, m => m.toLowerCase()], [/(^|[^A-Za-z'’-])([tdsnr])(?=[\s가-힣·,.→)]|$)/g, (m, a, c) => a + LETTER_KO[c]], [/ = /g, ', '], [/\s\+\s/g, ', ']],
  rate: () => speed,
  holdBefore: 0.05,
  enRate: ATV.EN_RATE,      // 영어 조각만 살짝 느리게 (voices.js의 EN_RATE — 낱말 소리와 같은 빠르기)
  clips: window.EN_CLIPS,   // 미리 만든 음성 파일(audio/narration/) — 있는 조각은 그 목소리로, 없는 조각은 브라우저 음성으로
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };
if (window.EN && EN.say) EN.say.rate = ATV.EN_RATE;   // 발음 듣기 단추도 같은 빠르기

/* =========================================================
   9. 음성 인식 · 녹음 (따라 말하기 · 내 목 울림 띠)
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
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mr = new MediaRecorder(stream), chunks = [];
  return new Promise(res => {
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); onState(false); res(chunks.length ? new Blob(chunks, { type: mr.mimeType || 'audio/webm' }) : null); };
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
const pct = ([ok, n]) => n ? Math.round(ok / n * 100) : null;
const pctTxt = v => pct(v) == null ? '–' : pct(v) + '%';
const meterTd = v => `<td><span class="meter"><i style="width:${pct(v) || 0}%"></i></span>${pctTxt(v)}</td>`;

/* =========================================================
   10. 놀이터 ① t 듣고 가르기 훈련 — t가 하나인 낱말 스물셋 × 목소리 넷(확인을 통과한 소리만): 짧은 ㄹ인가 터지는 t인가
   기록은 이 브라우저에만(localStorage 'en-at-hvpt-v1'). 키보드: R 듣기 · 1 짧은 ㄹ · 2 터지는 t · Space/Enter 다음
   ========================================================= */
const HV_KEY = 'en-at-hvpt-v1';
const HV_OPTS = [['flap', '짧은 ㄹ 같은 t', '혀끝으로 톡 · 울림 이어짐'], ['asp', '숨이 터지는 t', '막았다가 터뜨림 · 울림 끊김']];
const HV = { voice: 'all', cur: null, pick: null, stats: null, streak: 0, last: '' };
const hvPool = sp => AT.HV.filter(w => sp === 'all' ? okVoices([w]).length : okVoices([w]).includes(sp));
const hvEmpty = () => ({ kind: { flap: [0, 0], asp: [0, 0] }, voice: Object.fromEntries(AT.VOICES.map(v => [v.sp, [0, 0]])), word: Object.fromEntries(AT.HV.map(w => [w, [0, 0]])) });
function hvLoad() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(HV_KEY) || 'null'); } catch (e) { s = null; }
  const base = hvEmpty();
  if (s && typeof s === 'object') Object.keys(base).forEach(g => Object.keys(base[g]).forEach(k => { const v = s[g] && s[g][k]; if (Array.isArray(v) && v.length === 2) base[g][k] = v.map(x => +x || 0); }));
  HV.stats = base;
}
function hvSave() { try { localStorage.setItem(HV_KEY, JSON.stringify(HV.stats)); } catch (e) { /* 저장하지 못해도 이번에는 계속 */ } }
function hvNew(auto) {
  const pool = hvPool(HV.voice).length ? hvPool(HV.voice) : AT.HV;
  let w;
  do { w = pickOne(pool); } while (pool.length > 1 && w === HV.last);
  const ok = okVoices([w]), sp = HV.voice === 'all' ? pickOne(ok.length ? ok : ALL_SP) : HV.voice;
  HV.cur = { w, sp, kind: AT.mainT(w).kind }; HV.pick = null; HV.last = w;
  hvDraw();
  if (auto) hvPlay();
}
function hvPlay(slow) { if (!HV.cur) return; const b = $('hvPlayBtn'); if (b) b.classList.add('saying'); speak(tSeq(HV.cur.w, HV.cur.sp), { slow: !!slow, onend() { const x = $('hvPlayBtn'); if (x) x.classList.remove('saying'); } }); }
function hvAnswer(k) {
  const c = HV.cur; if (!c || HV.pick !== null) return;
  HV.pick = k;
  const ok = k === c.kind;
  [HV.stats.kind[c.kind], HV.stats.voice[c.sp], HV.stats.word[c.w]].forEach(v => { v[1]++; if (ok) v[0]++; });
  HV.streak = ok ? HV.streak + 1 : 0;
  hvSave(); hvDraw();
  const nb = $('hvNext'); if (nb) nb.focus({ preventScroll: true });
}
const partnerOf = w => { const p = AT.STRESS.find(x => x.indexOf(w) >= 0) || AT.TWIN.find(x => x.indexOf(w) >= 0); return p ? p.find(x => x !== w) : null; };
function hvDraw() {
  const c = HV.cur, box = $('hvMain');
  let h = '';
  if (!c) h = `<p class="hv-hello">목소리 넷 가운데 하나가 낱말 하나를 말해요. 가운데 t 소리가 짧은 ㄹ처럼 톡 스쳤는지, 막았다가 숨과 함께 터졌는지 고르면 그 목소리의 목 울림 띠가 나타나요. 글자를 떠올리지 말고, t 자리에서 소리가 끊기는지 이어지는지 들어 보세요.</p><div class="acts"><button type="button" class="btn" id="hvStart">${ICO.play} 시작하기</button></div>`;
  else {
    const done = HV.pick !== null, ok = done && HV.pick === c.kind;
    h += `<div class="hv-top"><button type="button" class="btn hv-play" id="hvPlayBtn">${ICO.play} 듣기 <small>R</small></button><button type="button" class="btn ghost" id="hvSlow">${ICO.slow} 천천히</button><span class="hv-who">${esc(WHO[c.sp])}</span></div>`;
    h += `<div class="hv-opts">${HV_OPTS.map(([k, name, sub], i) => `<button type="button" class="hv-opt k-${k}${done ? (k === c.kind ? ' right' : k === HV.pick ? ' wrong' : ' off') : ''}" data-hv="${k}"${done ? ' disabled' : ''}><b>${i + 1}</b><span>${esc(name)}</span><small>${esc(sub)}</small></button>`).join('')}</div>`;
    if (done) {
      const x = AT.mainT(c.w), p = partnerOf(c.w), pv = p && okVoices([c.w, p]).includes(c.sp);
      h += `<p class="verdict"><b class="${ok ? 'c-ok' : 'c-no'}">${ok ? '맞아요' : '아쉬워요'}</b>들은 낱말 → ${tHTML(c.w)} · ${esc(capsOf(c.w))} · ${esc(AT.meaning(c.w))}${HV.streak > 1 ? ` · 연속 ${HV.streak}번!` : ''}</p>`;
      h += `<p class="note">${esc(AT.kindWhy(x))}</p>`;
      h += `<div class="cmpballs"><div class="cb ${c.kind === 'flap' ? 'weak' : 'en'} heard"><span>들은 소리 · ${esc(WHO[c.sp])}</span>${wBtn(c.w, c.sp)}${bandSVG(c.w, { sp: c.sp, w: 280 })}</div>${pv ? `<div class="cb ${AT.mainT(p).kind === 'flap' ? 'weak' : 'en'}"><span>짝 · 같은 목소리</span>${wBtn(p, c.sp)}${bandSVG(p, { sp: c.sp, w: 280 })}</div>` : ''}</div>`;
      if (pv) h += `<div class="wrow">${lpBtn(pairSeq(c.w, p, c.sp), '짝을 이어서 듣기', 'lp-voice', `${ICO.play}<span>짝을 이어서</span>`)}</div>`;
      h += `<div class="acts"><button type="button" class="btn" id="hvNext">다음 <small>Space</small></button></div>`;
    }
  }
  box.innerHTML = h;
  const st = HV.stats, all = Object.values(st.kind).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
  $('hvStats').innerHTML = `<table class="hv-tab"><caption>맞힌 비율 (이 브라우저에만 저장)</caption><tbody>${HV_OPTS.map(([k, name]) => `<tr><th scope="row" class="k-${k}">${esc(name)}</th><td>${st.kind[k][0]} / ${st.kind[k][1]}</td>${meterTd(st.kind[k])}</tr>`).join('')}${AT.VOICES.map(v => `<tr><th scope="row">${esc(v.ko)}</th><td>${st.voice[v.sp][0]} / ${st.voice[v.sp][1]}</td>${meterTd(st.voice[v.sp])}</tr>`).join('')}<tr class="all"><th scope="row">모두</th><td>${all[0]} / ${all[1]}</td><td>${pctTxt(all)}</td></tr></tbody></table>`;
}
function hvInit() {
  hvLoad();
  $('hvCtl').innerHTML = row('목소리', seg('목소리 고르기', [['all', '넷 섞어서']].concat(AT.VOICES.map(v => [v.sp, v.ko])), HV.voice, 'hvv'));
  hvDraw();
  const root = $('hvt');
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    const d = b.dataset;
    if (d.hvv) { HV.voice = d.hvv; root.querySelectorAll('[data-hvv]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hvNew(false); return; }
    if (b.id === 'hvStart' || b.id === 'hvNext') { hvNew(true); return; }
    if (b.id === 'hvPlayBtn') { hvPlay(false); return; }
    if (b.id === 'hvSlow') { hvPlay(true); return; }
    if (d.hv) { hvAnswer(d.hv); return; }
    if (b.id === 'hvReset') { HV.stats = hvEmpty(); HV.streak = 0; hvSave(); hvDraw(); }
  });
  root.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('select'))) return;
    const k = e.key.toUpperCase();
    if (k === 'R') { e.preventDefault(); if (!HV.cur) hvNew(true); else hvPlay(false); }
    else if ((k === '1' || k === '2') && HV.cur && HV.pick === null) { e.preventDefault(); hvAnswer(k === '1' ? 'flap' : 'asp'); }
    else if ((e.key === ' ' || e.key === 'Enter') && (HV.pick !== null || !HV.cur) && !(e.target.closest && e.target.closest('button:not(#hvNext):not(#hvStart)'))) { e.preventDefault(); hvNew(true); }
  });
}

/* =========================================================
   10. 놀이터 ② t 바꾸기 실험실 — 하나만 바꾼 짝(센 음절 옮기기 · 모음으로 시작하는 낱말 붙이기 · t → d · 앞에 n 넣기)을
   A ↔ B로 바꾸며 t의 모양 · 까닭 · 목 울림 띠가 어떻게 달라지는지 봐요. 목소리는 짝 둘이 모두 확인을 통과한 것만
   ========================================================= */
const SW = { set: AT.SWITCH[0].id, i: 0, side: 1, voice: 'tc' };
function swDraw() {
  const set = AT.switchSet(SW.set), pair = set.pairs[Math.min(SW.i, set.pairs.length - 1)], w = pair[SW.side], other = pair[1 - SW.side];
  const vs = okVoices(pair), sp = vs.includes(SW.voice) ? SW.voice : (vs[0] || 'tc');
  let h = row('바꾸기', seg('무엇을 바꾸나', AT.SWITCH.map(s => [s.id, esc(s.ko)]), SW.set, 'sws'));
  h += row('짝', seg('짝 고르기', set.pairs.map((p, i) => [i, `<span lang="en">${esc(p[0])} → ${esc(p[1])}</span>`]), SW.i, 'swi'));
  h += row('목소리', vs.length ? seg('목소리 고르기', AT.VOICES.filter(v => vs.includes(v.sp)).map(v => [v.sp, v.ko]), sp, 'swv') : '<span class="note">이 짝은 확인을 통과한 목소리가 없어요.</span>');
  h += `<div class="sw-ab" role="group" aria-label="A · B 바꾸기">${pair.map((x, k) => `<button type="button" class="sw-side${SW.side === k ? ' on' : ''}" data-sw="${k}" aria-pressed="${SW.side === k}"><b>${'AB'[k]}</b><span>${tHTML(x)}</span></button>`).join('<span class="arr">↔</span>')}</div>`;
  h += `<p class="note sw-note">${esc(set.note)}</p>`;
  h += `<div class="sw-body"><div class="sw-word"><p class="mp-big">${tHTML(w)}</p><p class="capsb">${esc(capsOf(w))} · ${esc(AT.meaning(w))}</p><div class="wrow">${wBtn(w, sp)}${lpBtn(pairSeq(pair[0], pair[1], sp), 'A · B 이어서 듣기', 'lp-pair', `${ICO.play}<span>A · B 이어서</span>`)}</div></div>`;
  h += `<div class="sw-band">${AT.tmarks(w).length ? bandSVG(w, { sp, w: 320 }) : '<p class="note">이 낱말에는 재는 자리(짧은 ㄹ · 센 음절 앞의 t)가 없어요.</p>'}</div></div>`;
  h += kindTable(w);
  if (vs.length < 4 && vs.length) h += `<p class="note">이 짝은 확인을 통과한 목소리 ${vs.length}개만 보여 줘요.</p>`;
  $('swMain').innerHTML = h;
  void other;
}
function swInit() {
  swDraw();
  $('tswitch').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    const d = b.dataset;
    if (d.sws) { SW.set = d.sws; SW.i = 0; SW.side = 1; swDraw(); return; }
    if (d.swi != null) { SW.i = +d.swi; swDraw(); return; }
    if (d.swv) { SW.voice = d.swv; swDraw(); return; }
    if (d.sw != null) {
      SW.side = +d.sw; swDraw();
      const set = AT.switchSet(SW.set), pair = set.pairs[SW.i], vs = okVoices(pair);
      speak(tSeq(pair[SW.side], vs.includes(SW.voice) ? SW.voice : (vs[0] || 'tc')));
    }
  });
}

/* =========================================================
   10. 놀이터 ③ 내 목 울림 띠 (시험 기능) — 낱말 하나를 녹음하면 브라우저 안에서 낮은 띠(60~500Hz)의 크기를 재서
   두 음절 사이에서 얼마나 떨어지는지(dB) 보여 줘요. 잰 방법은 tools/measure-syllables.py를 줄인 것:
   16kHz로 풀기 → 전체 크기(10ms 창 25ms)에서 가장 큰 봉우리 둘(100ms 넘게 떨어짐) → 두 봉우리 사이 낮은 띠의 골.
   녹음은 이 화면의 메모리에만 있고, 소리는 어디로도 보내지 않아요(브라우저 안에서 계산).
   ========================================================= */
const MB_WORDS = ['water', 'city', 'better', 'party', 'hotel', 'attack', 'thirty', 'thirteen'];
const MBF = (() => {
  const dbOf = (x, s0, s1) => { let s = 0; for (let j = s0; j < s1; j++) s += x[j] * x[j]; return 10 * Math.log10(s / Math.max(1, s1 - s0) + 1e-12); };
  const smooth = (a, k) => a.map((_, i) => { let s = 0, n = 0; for (let j = i - k; j <= i + k; j++) if (j >= 0 && j < a.length) { s += a[j]; n++; } return s / n; });
  // x: 전체 소리, lo: 낮은 띠만 남긴 소리 (같은 표본율)
  function analyze(x, lo, sr) {
    const hop = Math.round(0.01 * sr), win = Math.round(0.025 * sr), n = Math.floor(x.length / hop);
    if (n < 25) return { err: 'short' };
    const E = [], L = [];
    for (let i = 0; i < n; i++) { const s0 = Math.max(0, i * hop - (win >> 1)), s1 = Math.min(x.length, s0 + win); E.push(dbOf(x, s0, s1)); L.push(dbOf(lo, s0, s1)); }
    const e = smooth(E, 2), l = smooth(L, 1), top = Math.max(...e), floor = e.slice().sort((a, b) => a - b)[Math.floor(n * 0.1)];
    if (top < -55 || top - floor < 15) return { err: 'quiet' };
    const peaks = [];
    for (let i = 3; i < n - 3; i++) { let m = true; for (let j = i - 4; j <= i + 4; j++) if (j >= 0 && j < n && e[j] > e[i]) m = false; if (m && e[i] > top - 18) peaks.push(i); }
    peaks.sort((a, b) => e[b] - e[a]);
    const p1 = peaks[0], p2 = peaks.find(p => Math.abs(p - p1) >= 10);
    if (p1 == null || p2 == null) return { err: 'one' };
    const a = Math.min(p1, p2), b = Math.max(p1, p2);
    let mi = a; for (let i = a; i <= b; i++) if (l[i] < l[mi]) mi = i;
    const dip = Math.min(l[a], l[b]) - l[mi];
    const ltop = Math.max(...l), i0 = Math.max(0, a - 18), i1 = Math.min(n - 1, b + 18);
    const lv = []; for (let i = i0; i <= i1; i++) lv.push(clamp((Math.max(-50, l[i] - ltop) + 50) / 50));
    const X = i => (i - i0) / Math.max(1, i1 - i0);
    return { dip: Math.round(dip * 10) / 10, data: { measured: true, lv, syl: [{ a: X(a - 8), b: X(a + 8) }, { a: X(b - 8), b: X(b + 8) }], mk: [], labels: [], n: 2 }, at: X(mi) };
  }
  const decode = (c, buf) => new Promise((res, rej) => { const p = c.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); });
  async function fromBlob(blob) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return { err: 'decode' };
    const sr = 16000, buf = await blob.arrayBuffer();
    let ab;
    try { ab = await decode(new OAC(1, sr, sr), buf); } catch (e) { return { err: 'decode' }; }
    const n = ab.length;
    if (n < sr * 0.3) return { err: 'short' };
    // 낮은 띠: 60Hz 높은 통과 둘 + 500Hz 낮은 통과 둘
    let lo;
    try {
      const c2 = new OAC(1, n, ab.sampleRate), src = c2.createBufferSource(); src.buffer = ab;
      let node = src;
      [['highpass', 60], ['highpass', 60], ['lowpass', 500], ['lowpass', 500]].forEach(([t, f]) => { const q = c2.createBiquadFilter(); q.type = t; q.frequency.value = f; node.connect(q); node = q; });
      node.connect(c2.destination); src.start(0);
      const out = await new Promise((res, rej) => { c2.oncomplete = ev => res(ev.renderedBuffer); const p = c2.startRendering(); if (p && p.then) p.then(res, rej); });
      lo = out.getChannelData(0);
    } catch (e) { return { err: 'decode' }; }
    return analyze(ab.getChannelData(0), lo, ab.sampleRate);
  }
  return { analyze, fromBlob };
})();
window.__MBF = MBF;   // 확인용(읽기만)
const MB_ERR = {
  short: '소리가 너무 짧아요. 낱말 하나를 또렷하게 말해 보세요.',
  quiet: '소리가 작거나 잡음이 많아요. 조용한 곳에서 마이크 가까이 말해 보세요.',
  one: '음절 둘을 찾지 못했어요. 두 음절이 들리게 낱말 하나를 말해 보세요.',
  decode: '이 브라우저에서는 녹음한 소리를 풀어 잴 수 없어요.',
};
const MB = { w: 'water', res: null, url: null, err: null, busy: false };
const mbVerdict = d => d <= ATS.FLAP_MAX ? ['flap', '울림이 이어졌어요 — 짧은 ㄹ 쪽'] : d >= ATS.GAP_MIN ? ['asp', '울림이 끊겼어요 — 터지는 t(또는 한국어식) 쪽'] : ['mid', '가운데예요 — 어느 쪽인지 가르기 어려워요'];
function mbDraw() {
  const w = MB.w, want = AT.tmarks(w)[0].want, m = ATV.meas('tc', w), md = m && m.tk ? m.tk[0][1] : null;
  let h = row('낱말', `<div class="wrow sel">${MB_WORDS.map(x => `<button type="button" class="pickw${MB.w === x ? ' on' : ''}" data-mbw="${x}" aria-pressed="${MB.w === x}">${tHTML(x)}</button>`).join('')}</div>`);
  h += `<div class="mp-body"><div class="mp-fig">${bandSVG(w, { w: 240, caption: md != null ? `밝은 선생님 · ${Math.max(0, Math.round(md))}dB` : '밝은 선생님 (그림으로 줄인 모양)' })}</div>
    <div class="mp-word"><p class="mp-big">${tHTML(w)}</p><p class="capsb">${esc(capsOf(w))} · ${esc(AT.meaning(w))}</p>
    <p class="note">${want === 'flap' ? '본보기 → t 자리에서 울림이 이어져요(짧은 ㄹ). 혀끝으로 한 번 톡 치고, 목 울림을 멈추지 마세요.' : '본보기 → t 자리에서 울림이 끊겨요(센 음절 앞의 터지는 t). 혀끝으로 막았다가 숨과 함께 터뜨려요.'}</p>
    <div class="wrow">${wBtn(w)}</div></div></div>`;
  h += '<div class="mp-acts">';
  if (CAN_REC) h += `<button type="button" class="btn" id="mbRec" aria-pressed="false">${ICO.rec}<span>2초 녹음해서 재기</span></button>`;
  else h += '<p class="note">이 브라우저는 녹음을 쓸 수 없어요. 본보기를 듣고 세 번 소리 내어 따라 해 보세요.</p>';
  h += '</div><div class="mp-res" id="mbRes" role="status"></div>';
  $('mbMain').innerHTML = h;
  mbResult();
}
function mbResult() {
  const box = $('mbRes'); if (!box) return;
  let h = '';
  if (MB.res && MB.res.dip != null) {
    const r = MB.res, [k, msg] = mbVerdict(r.dip), want = AT.tmarks(MB.w)[0].want, hit = (want === 'flap' && k === 'flap') || (want === 'gap' && k === 'asp');
    const data = Object.assign({}, r.data, { mk: [{ want: k === 'flap' ? 'flap' : 'gap', d: r.dip, at: r.at, ok: true }], labels: [] });
    h += `<p class="verdict"><b class="${hit ? 'c-ok' : k === 'mid' ? 'c-mid' : 'c-no'}">${Math.max(0, Math.round(r.dip))}dB</b>${esc(msg)}${hit ? ' · 본보기와 같은 쪽이에요.' : ' · 본보기와 다른 쪽이에요.'}</p>`;
    h += `<div class="cmpballs one"><div class="cb ${k === 'flap' ? 'weak' : 'en'}"><span>내 목 울림 띠 (브라우저에서 잰 값)</span>${bandSVG(MB.w, { data, w: 300, caption: '내 녹음 · 대략 잰 값', what: `${MB.w} — 내 녹음` })}</div></div>`;
  }
  if (MB.err) h += `<p class="sh-err">${esc(MB.err)}</p>`;
  if (MB.url) h += `<div class="mo"><button type="button" class="sh-play" id="mbMine">${ICO.play} 내 목소리</button>${ATV.supported ? `<button type="button" class="sh-play" id="mbModel">${ICO.play} 본보기</button><button type="button" class="sh-play" id="mbBoth">${ICO.play} 번갈아 듣기</button>` : ''}</div>`;
  box.innerHTML = h;
}
function mbInit() {
  const root = $('myband');
  mbDraw();
  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.hasAttribute('data-lp')) return;
    if (b.dataset.mbw) { MB.w = b.dataset.mbw; MB.res = null; MB.err = null; mbDraw(); return; }
    if (b.id === 'mbRec') {
      if (MB.busy) return;
      MB.busy = true; MB.err = null; MB.res = null; mbResult();
      try {
        const blob = await recordBlob(2000, on => { const x = $('mbRec'); if (x) { x.setAttribute('aria-pressed', String(on)); x.classList.toggle('on', on); x.querySelector('span').textContent = on ? '녹음 중… (2초)' : '2초 녹음해서 재기'; } });
        if (MB.url) URL.revokeObjectURL(MB.url);
        MB.url = blob ? URL.createObjectURL(blob) : null;
        if (!blob) MB.err = '녹음된 소리가 없어요. 다시 해 보세요.';
        else { const r = await MBF.fromBlob(blob); if (r.err) MB.err = MB_ERR[r.err]; else MB.res = r; }
        mbResult();
      } catch (err) { MB.err = recErr(err); mbResult(); }
      MB.busy = false;
      return;
    }
    if (b.id === 'mbMine') { playUrl(MB.url, b); return; }
    if (b.id === 'mbModel') { speak(tSeq(MB.w)); return; }
    if (b.id === 'mbBoth') { playUrl(MB.url, $('mbMine'), () => speak(tSeq(MB.w), { onend(stopped) { if (!stopped) playUrl(MB.url, $('mbMine'), () => speak(tSeq(MB.w))); } })); }
  });
}

/* =========================================================
   11. 따라 말하기 — 듣기 · 천천히 · 따라 말하기(인식 → 녹음 → 소리 내어 따라 하기)
   ========================================================= */
const SHREC = { url: {}, rec: null, i: -1 };
function shBuild() {
  const modeTxt = { sr: '이 브라우저는 <b>음성 인식</b>을 쓸 수 있어요. 마이크 단추를 누르고 문장을 말하면, 들린 낱말을 글로 바꿔 원래 문장과 낱말마다 맞춰 봐요(맞은 낱말 초록 · 빠진 낱말 주황). 숫자를 숫자로 받아 적어도(13 · 30) 맞은 것으로 쳐요.', rec: '이 브라우저는 음성 인식이 없어서 <b>녹음</b>으로 연습해요. 마이크 단추로 녹음한 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 들어 보세요.', none: '이 브라우저는 음성 인식도 녹음도 쓸 수 없어요. <b>듣기 → 멈춤 → 세 번 소리 내어 따라 해 보세요.</b>' };
  $('shMode').innerHTML = modeTxt[SPEAK_MODE];
  const groups = AT.SGRP_ORDER.map(gk => ({ gk, rows: AT.SENT.map((s, i) => [s, i]).filter(([s]) => s.grp === gk) }));
  $('shList').innerHTML = groups.map(({ gk, rows }) => `<section class="sh-grp"><h3><span class="ptag g-${gk}">${esc(AT.SGRP[gk].ko)}</span> ${esc(AT.SGRP[gk].long.split(' — ')[1] || '')}</h3><ol>${rows.map(([s, i]) => `<li class="sh-row" data-i="${i}">
      <div class="sh-btns">${ATV.supported ? `<button type="button" class="lp-play sh-say" data-shp="${i}" aria-label="듣기: ${esc(s.en)}" title="듣기">${SVG_PLAY}</button><button type="button" class="lbtn tog sh-slow" data-shs="${i}" title="천천히 듣기">${ICO.slow}<span>천천히</span></button>` : ''}${SPEAK_MODE !== 'none' ? `<button type="button" class="lbtn sh-mic" data-shm="${i}" aria-pressed="false" title="따라 말하기">${ICO.mic}<span>${SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'}</span></button>` : ''}</div>
      <p class="sh-t"><span class="sh-en">${tHTML(s.en)}</span><small>${esc(s.ko)} · <span class="capsb sm" lang="en">${esc(capsOf(s.en))}</span></small></p>
      <div class="sh-res" role="status"></div></li>`).join('')}</ol></section>`).join('');
}
function shSeq(i) { return tSeq(AT.SENT[i].en); }
function shResult(i, html) { const el = document.querySelector(`.sh-row[data-i="${i}"] .sh-res`); if (el) el.innerHTML = html; }
function shMicState(i, on, label) { const b = document.querySelector(`.sh-row[data-i="${i}"] .sh-mic`); if (!b) return; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const s = b.querySelector('span'); if (s) s.textContent = label || (on ? (SPEAK_MODE === 'sr' ? '듣고 있어요…' : '멈추기') : SPEAK_MODE === 'sr' ? '따라 말하기' : '녹음'); }
function shListen(i) {
  const s = AT.SENT[i];
  if (activeRec && SHREC.i === i) { stopListening(); return; }
  SHREC.i = i;
  shResult(i, '<span class="note">듣고 있어요. t 소리와 이어지는 곳을 살려 문장을 말해 보세요.</span>');
  listenOnce({
    onState(on) { shMicState(i, on); },
    onText(alts) {
      const best = alts.map(t => [t, AT.compareWords(s.en, t)]).sort((a, b) => b[1].hit - a[1].hit)[0], r = best[1];
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
    shResult(i, `<div class="mo"><button type="button" class="sh-play" data-mine="${i}">${ICO.play} 내 목소리</button>${ATV.supported ? `<button type="button" class="sh-play" data-orig="${i}">${ICO.play} 원래 문장</button><button type="button" class="sh-play" data-both="${i}">${ICO.play} 이어서 듣기</button>` : ''}</div><p class="note">녹음은 이 화면에만 잠깐 있어요. 페이지를 닫으면 사라져요.</p>`);
    shPlayMine(i, true);
  };
  SHREC.rec = mr; mr.start(); shMicState(i, true);
  shResult(i, '<span class="note">녹음 중이에요. 다 말했으면 ‘멈추기’를 눌러요(6초가 지나면 저절로 멈춰요).</span>');
  SHREC.tm = setTimeout(() => { if (SHREC.rec === mr) { SHREC.rec = null; try { mr.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 6000);
}
function shPlayMine(i, thenOrig) {
  const b = document.querySelector(`.sh-row[data-i="${i}"] [data-mine]`);
  playUrl(SHREC.url[i], b, thenOrig && ATV.supported ? () => speak(shSeq(i)) : null);
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
   12. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 그림 문제는 목 울림 띠 무늬
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
// 목 울림 띠 무늬 넷 (A~D): 음절 덩어리 n개, 경계마다 다리 높이(0 = 끊김 · 0.72 = 이어짐)
const bandPat = (n, bridges) => { const lv = [], N = 30 * n; for (let f = 0; f <= N; f++) { const p = f / N, i = Math.min(n - 1, Math.floor(p * n)), q = p * n - i; const e = Math.min(1, Math.max(0, Math.min(q - 0.12, 0.88 - q) / 0.16)); const side = q < 0.5 ? (i ? bridges[i - 1] : 0) : (i < n - 1 ? bridges[i] : 0); lv.push(0.95 * e + side * (1 - e)); } return lv; };
function bandFig(label, pats, text) {
  return panelFig(label, pats.length, (g, k, x, w) => {
    const lv = pats[k], n = lv.length, x0 = x + 16, ww = w - 32, y = 100, h = 70;
    g.beginPath();
    lv.forEach((v, i) => { const X = x0 + i / (n - 1) * ww, Y = y - v * h * 0.46; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    for (let i = n - 1; i >= 0; i--) g.lineTo(x0 + i / (n - 1) * ww, y + lv[i] * h * 0.46);
    g.closePath(); g.fillStyle = 'rgba(143,166,192,0.6)'; g.fill(); g.strokeStyle = '#8FA6C0'; g.lineWidth = 1.2; g.stroke();
    if (text) { g.font = qfont(13, 600); g.fillStyle = QCOL.muted; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text[k], x + w / 2, 166); }
  });
}
const QS = (() => {
  const kind = w => (AT.mainT(w) || {}).kind;
  const q = [
    { q: 'water → 한국어식 워터와 미국식의 가장 큰 차이는?', opts: ['미국식은 t 자리에서 혀끝으로 한 번 톡, 목 울림이 이어져요', '미국식은 모음이 훨씬 길어요', '미국식은 첫소리를 세게 터뜨려요', '차이가 없어요'], a: 0,
      why: '미국 영어에서 water의 t는 모음 사이, 뒤가 약한 음절이라 짧은 ㄹ처럼 톡 스쳐요. 한국어식은 t 자리에서 울림이 끊겨요.',
      check: () => kind('water') === 'flap' && AT.koMarks('워터').length === 1 },
    { q: 'metal · medal → 미국 영어에서는 보통 어떻게 들리나요?', opts: ['metal의 t가 더 세게 터져요', 'medal의 d만 짧은 ㄹ이 돼요', '둘 다 짧은 ㄹ이 되어 거의 같게 들려요', '둘 다 t가 사라져요'], a: 2,
      why: '모음 사이, 약한 음절 앞의 t와 d는 둘 다 짧은 ㄹ이 돼요. 그래서 뜻은 앞뒤 말로 가려요.',
      check: () => kind('metal') === 'flap' && kind('medal') === 'flap' },
    { q: 'Italy · Italian → t 소리는?', opts: ['둘 다 짧은 ㄹ', 'Italy = 짧은 ㄹ, Italian = 숨이 터지는 t', 'Italy = 숨이 터지는 t, Italian = 짧은 ㄹ', '둘 다 숨이 터지는 t'], a: 1,
      why: 'ITaly는 t 뒤가 약한 음절이라 짧은 ㄹ, iTALian은 t 바로 뒤가 센 음절이라 터져요. 센 음절의 자리가 t를 정해요.',
      check: () => kind('Italy') === 'flap' && kind('Italian') === 'asp' },
    { q: '짧은 ㄹ 같은 t가 되는 자리는?', opts: ['낱말의 처음', 's 바로 뒤', '바로 뒤에 센 음절이 올 때', '모음(또는 r) 뒤, 약한 음절 앞'], a: 3,
      why: '앞이 모음이나 r이고 뒤가 약한 음절일 때예요(water · party). 낱말 처음 · 센 음절 앞은 터지고, s 뒤는 ㄸ에 가까워요.',
      check: () => AT.FLAPS.every(w => kind(w) === 'flap') && AT.kinds('stop').join() === 'st' && AT.kinds('top').join() === 'asp' },
    { q: 'hotel → 목 울림 띠로 그리면? 그림을 눌러도 돼요.', opts: ['A', 'B', 'C', 'D'], a: 0,
      figure: bandFig('목 울림 띠 무늬 넷. A 두 덩어리 사이가 끊김, B 두 덩어리가 이어짐, C 한 덩어리, D 세 덩어리가 끊김', [bandPat(2, [0]), bandPat(2, [0.72]), bandPat(1, []), bandPat(3, [0, 0])], ['둘 · 끊김', '둘 · 이어짐', '하나', '셋 · 끊김']),
      why: 'hoTEL은 t 바로 뒤가 센 음절이라, 막았다가 터뜨리는 동안 목 울림이 끊겨요. B는 water처럼 짧은 ㄹ이 된 낱말의 띠예요.',
      check: () => AT.tmarks('hotel').map(m => m.want).join() === 'gap' && AT.tmarks('water').map(m => m.want).join() === 'flap' },
    { q: 'button → 가운데 t 소리는 보통 어떻게 내나요?', opts: ['짧은 ㄹ처럼 톡', '혀끝을 댄 채 목에서 막았다가 코로 은', 's 뒤의 t처럼 ㄸ에 가깝게', '아주 세게 터뜨려요'], a: 1,
      why: '뒤에 약한 ‘은’ 소리가 오면 t를 터뜨리지 않고 목에서 잠깐 막아요(목에서 막는 t). 이 페이지에서 재지는 않은, 교재의 설명이에요.',
      check: () => AT.kinds('button').indexOf('glot') >= 0 },
    { q: 'twenty → 빠르게 말할 때 둘째 t는?', opts: ['더 세게 터져요', '짧은 ㄹ이 돼요', 'n 바로 뒤라 빠지기 쉬워요 (경향)', 'd로 바뀌어요'], a: 2,
      why: 'n 바로 뒤, 약한 음절 앞의 t는 빠지기 쉬워 트웨니에 가깝게 들려요. 다만 또박또박 말하면 살려요.',
      check: () => AT.kinds('twenty').join() === 'asp,drop' },
    { q: 'get it → 이어 말하면?', opts: ['겟 · 잇으로 끊어 말해요', 't 소리가 세게 터져요', 't는 사라지고 it만 남아요', 'get 끝의 t가 짧은 ㄹ이 되어 게릿에 가깝게'], a: 3,
      why: '낱말 끝의 t 뒤에 모음으로 시작하는 낱말이 오면, t가 다음 모음에 붙어 짧은 ㄹ이 돼요.',
      check: () => AT.ts('get it').some(x => x.kind === 'flap' && x.across) && AT.kinds('get').join() === 'final' },
    { q: 'pick it up → 이어지는 곳은 몇 곳인가요?', opts: ['한 곳', '두 곳', '세 곳', '이어지지 않아요'], a: 1,
      why: 'pick‿it(k가 it에), it‿up(t가 up에) — 두 곳이에요. 그래서 피키럽처럼 한 낱말로 들려요.',
      check: () => AT.links('pick it up').length === 2 },
    { q: 'did you → 빠르게 말하면 어떻게 들리기 쉬운가요?', opts: ['디쥬에 가깝게', '디드 · 유로 끊어서', '딛유', '디유'], a: 0,
      why: 'd 뒤에 you가 오면 이어져 ㅈ에 가깝게 바뀌기 쉬워요(경향). t 뒤의 you는 츄에 가깝게 → don\'t you = 돈츄.',
      check: () => AT.kinds('did you').indexOf('yu') >= 0 && AT.kinds("don't you").indexOf('yu') >= 0 },
  ];
  q.forEach((x, i) => { if (x.check && !x.check()) console.warn(`[미국식 t] 퀴즈 ${i + 1}번의 정답이 규칙 엔진과 달라요.`); });
  const pos = [0, 0, 0, 0]; q.forEach(x => { pos[x.a]++; });
  if (Math.max(...pos) - Math.min(...pos) > 1) console.warn('[미국식 t] 퀴즈 정답 위치가 한쪽에 몰려 있어요:', pos);
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
$('ttsBtn').addEventListener('click', () => { ATV.stop(); stopAudio(); stopListening(); }, true);   // 음성 해설을 켜고 끌 때 다른 소리는 멈춤
if (NARR.supported) EN.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #playground, #shadow, #drill, #quiz, #summary-table, .ldr')) return;
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = ATS.chapterAt(T);
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
// 화면 누르기: 낱말 · 띠 · 한국어식 표기는 그 목소리로, 빈 곳은 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * ATS.W, (e.clientY - r.top) / r.height * ATS.H]; };
const hitAt = (x, y) => started ? ATS.hits().slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
let lastHit = { k: '', at: 0 };
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.play && ATV.supported) {
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
EN.say.wire(document, { before() { ATV.stop(); stopAudio(); if (playing) pause(); } });
const voiceNote = () => { document.querySelectorAll('.voice-note').forEach(n => { n.textContent = ' ' + ATV.status(); }); };
voiceNote(); setTimeout(voiceNote, 1200);
if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', voiceNote);
// 확인용 · 도구용(읽기만): 미리 만들 줄 — tools/dialogue-lines.cjs가 불러 audio/dialogue/lines.json으로 씀
// 영상의 낱말 · 띠 · 한국어식 · 목소리 단추, 직접 해 보기(고르는 것은 하나씩), 훈련(낱말 × 목소리 넷), 실험실(짝 × 목소리 넷), 내 목 울림 띠, 듣고 고르기, 따라 말하기
window.__dialogueLines = () => {
  const out = [], seen = new Set();
  const add = (sp, text, from) => {
    if (!sp || !text) return;
    const id = ATV.lineId(sp, text);
    if (seen.has(id)) return;
    seen.add(id); out.push({ id, sp, text: ATV.spoken(text), from });
  };
  const addSeq = (seq, from) => (seq || []).forEach(it => add(it.sp, it.text, from));
  const keepS = JSON.stringify(S), base = JSON.parse(ATS.DEFAULTS), n0 = SEQS.length;
  try {
    // 1) 영상: 처음부터 끝까지 훑으며 누를 수 있는 낱말 · 띠 · 한국어식 · 목소리 단추. 직접 해 보기로 바뀌는 장면도 하나씩
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    const span = id => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t, ch.t + ch.d]; };
    const one = (id, at) => { const ch = CHAPTERS.find(x => x.id === id); return [ch.t + at, ch.t + at]; };
    const mapWords = [].concat(...AT.MAP.map(m => m.words));
    const sweeps = [[{}, [0, END]]]
      .concat(AT.VOICES.map(v => [{ voice: v.sp }, span('listen')]))
      .concat(mapWords.map(w => [{ kword: w }, one('map', 40)]), AT.FLAPS.concat(AT.DFLAPS).map(w => [{ flapw: w }, one('flap', 20)]))
      .concat(AT.STRESS.map((_, i) => [{ stress: i }, one('stress', 14)]), AT.GLOT.concat(AT.DROP).map(w => [{ glotw: w }, one('glot', 20)]))
      .concat(AT.ACROSS.map((_, i) => [{ across: i }, one('across', 26)]), AT.LINK.concat(AT.YU).map((_, i) => [{ link: i }, one('link', 8)]))
      .concat(ATS.SENT_POOL.map((_, i) => [{ sent: i }, one('sentence', 8)]));
    sweeps.forEach(([st, [t0, t1]]) => {
      Object.assign(S, base, st);
      for (let t = t0; t <= t1; t += 0.5) { ATS.render(g, t); ATS.hits().forEach(h => addSeq(h.play, 'video')); }
    });
    // 2) 직접 해 보기: 장마다 + 고르는 것은 하나씩
    Object.assign(S, base);
    Object.keys(LABS).forEach(k => { try { LABS[k](); } catch (e) { /* */ } });
    AT.VOICES.forEach(v => { S.voice = v.sp; LABS.listen(); }); S.voice = null;
    mapWords.forEach(w => { S.kword = w; LABS.map(); });
    AT.FLAPS.concat(AT.DFLAPS).forEach(w => { S.flapw = w; LABS.flap(); });
    AT.STRESS.forEach((_, i) => { S.stress = i; LABS.stress(); });
    AT.GLOT.concat(AT.DROP).forEach(w => { S.glotw = w; LABS.glot(); });
    AT.ACROSS.forEach((_, i) => { S.across = i; LABS.across(); });
    AT.LINK.concat(AT.YU).forEach((_, i) => { S.link = i; LABS.link(); });
    ATS.SENT_POOL.forEach((_, i) => { S.sent = i; LABS.sentence(); });
    SEQS.slice(n0).forEach(seq => addSeq(seq, 'lab'));
  } finally { Object.assign(S, JSON.parse(keepS)); dirty = true; }
  // 3) 훈련: 낱말 × 목소리 넷 / 실험실: 짝 × 목소리 넷 / 내 목 울림 띠: 본보기(밝은 선생님)
  AT.HV.forEach(w => AT.VOICES.forEach(v => add(v.sp, w, 'hvt')));
  AT.SWITCH.forEach(s => s.pairs.forEach(p => p.forEach(w => AT.VOICES.forEach(v => add(v.sp, w, 'tswitch')))));
  MB_WORDS.forEach(w => add('tc', w, 'myband'));
  // 4) 듣고 고르기: 들려주는 말
  AT.DRILL.forEach(q => addSeq(AT.drillSeq(q), 'drill'));
  // 5) 따라 말하기
  AT.SENT.forEach((_, i) => addSeq(shSeq(i), 'shadow'));
  return out;
};
// 도구용(읽기만): 잴 줄의 정보 — tools/dialogue-lines.cjs가 audio/dialogue/measure-meta.json으로 씀 → tools/measure-syllables.py
// 낱말(word: 음절 수 n · 센 음절 at · t 자리 t) · 짧은 구(word + stress: false — 센 음절은 보지 않고 t 자리만) ·
// 한국어식(ko: 한글 글자 수 = 음절 수, 영어에서 짧은 ㄹ인 자리는 끊겨야 — t) · 그 밖의 문장(other: 받아쓰기만)
const KO_EN = new Map(AT.KO_LINES.map(([ko, en]) => [ko, en]).concat(AT.ACROSS.concat(AT.LINK).map(x => [x.ko, x.en]), AT.LOAN.map(k => [AT.entry(k).ko, AT.entry(k).w])));
window.__measureMeta = lines => lines.map(l => {
  const o = { id: l.id, sp: l.sp, text: l.text };
  if (l.sp === 'ko') { const t = AT.koMarks(l.text), en = KO_EN.get(l.text); return Object.assign(o, { kind: 'ko', n: AT.koN(l.text) }, en ? { en } : {}, t.length ? { t } : {}); }
  const toks = AT.tokens(l.text), t = AT.tmarks(l.text), sentence = /[.?!]$/.test(l.text.trim());
  if (toks.length === 1 && toks[0].e && !sentence) return Object.assign(o, { kind: 'word', key: toks[0].k, n: AT.nSyl(l.text), at: AT.stressAt(toks[0].k) }, t.length ? { t } : {});
  if (toks.length > 1 && toks.every(x => x.e) && !sentence) return Object.assign(o, { kind: 'word', key: l.text, n: AT.nSyl(l.text), at: 0, stress: false }, t.length ? { t } : {});
  return Object.assign(o, { kind: 'other' });
});
hvInit();
swInit();
mbInit();
shInit();
PDrill($('drillRoot'), AT.DRILL, {
  done: (ok, total) => ok === total ? '모두 맞혔어요! 짧은 ㄹ과 터지는 t, 한국어식, 이어진 낱말이 귀에 들어오네요.' : ok >= total * 0.75 ? '잘했어요. 틀린 문제는 힌트의 세 단계를 다시 따라가 보고, 목 울림 띠를 견줘 보세요.' : '처음에는 누구나 헷갈려요. 놀이터의 t 듣고 가르기 훈련으로 여러 목소리를 더 들어 보세요.',
});
EN.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '미국식 t와 이어 말하기 — 모두 알았네요!' : '틀린 문제의 해설을 읽고 영상의 해당 장면을 다시 보세요.',
});

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
loadFonts(ATS.baseText()).then(() => { dirty = true; });
setTimeout(() => ATS.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
requestAnimationFrame(loop);
})();
