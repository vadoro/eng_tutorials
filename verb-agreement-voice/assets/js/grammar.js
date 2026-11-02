/* 수 일치와 능동·수동 튜토리얼 — 규칙 엔진과 예문
 *
 * 동사 빈칸 문제의 보기는 한 동사의 여러 모양이에요(posted · was posted · were posted · was posting).
 * 답은 두 질문이 정합니다. ① 진짜 주어가 하나인가, 여럿인가(수 일치) ② 빈칸 뒤에 목적어가 있는가(능동·수동).
 * 영상의 ✓·×, 직접 해 보기, 놀이터(능동·수동 변환기, 진짜 주어 누르기), 연습 문제, 퀴즈가 모두 VA.judge()로 맞고 틀림을 정하고,
 * 문제 데이터에 적은 정답이 judge()와 다르면 콘솔에 경고를 냅니다.
 *
 * 보기의 모양(code) = '태.수'
 *   태  a 능동 · p 수동(be + 과거분사) · c be동사(뒤에 보어) · x 진짜 동사가 아님 · n 명사
 *   수  s 단수 · p 복수 · * 수와 상관없음(과거형, will·must 뒤)
 *   x 뒤의 이름은 까닭: ing(-ing 혼자) · to(to부정사) · be(be 뒤 원형) · mod(조동사 뒤 -ing)
 * 문장(ctx) = { num: 진짜 주어의 수 's' | 'p' (조동사 뒤 빈칸이면 '*'), vt: 동사 종류, after: 빈칸 뒤 }
 *   vt     vt 타동사 · v4 주는 동사(목적어 둘) · v5 목적어 + 보어 동사 · vi 자동사 · be be동사
 *   after  obj 목적어 하나 · obj2 목적어 둘 · objComp 목적어 + 보어 · comp 보어만 · none 없음(시간·장소 표현만)
 * judge(code, ctx) → { s: 'ok' | 'no', step: 2 | 3, why }   step = 3단계 풀이법의 몇 단계에서 지워지는지
 */
(function () {
  'use strict';
  const VA = (window.VA = {});

  /* ---------- ① 진짜 주어 → 수 ---------- */
  VA.SUBJ = {
    sg:     { name: '단수 명사', num: 's', why: '하나예요' },
    pl:     { name: '복수 명사', num: 'p', why: '여럿이에요' },
    anum:   { name: 'a number of + 복수 명사', num: 'p', why: 'a number of = 많은. 중심은 뒤의 복수 명사예요' },
    thenum: { name: 'the number of + 복수 명사', num: 's', why: 'the number = 수(숫자) 하나예요' },
    each:   { name: 'each · every + 단수 명사', num: 's', why: '하나하나를 가리켜요' },
    oneof:  { name: 'one of the + 복수 명사', num: 's', why: '여럿 가운데 하나예요' },
    many:   { name: 'several · many · both + 복수 명사', num: 'p', why: '여럿을 가리켜요' },
    ger:    { name: '동명사 주어 (-ing ~)', num: 's', why: '하는 일 하나예요' },
    clause: { name: '명사절 주어 (what ~ · whether ~)', num: 's', why: '절 덩어리 하나예요' },
    mass:   { name: '셀 수 없는 명사', num: 's', why: '셀 수 없는 명사는 단수로 받아요' },
  };
  VA.NUMNAME = { s: '하나 (단수)', p: '여럿 (복수)', '*': '수와 상관없음' };

  /* ---------- ③ 빈칸 뒤 → 능동·수동 ---------- */
  VA.VT = { vt: '타동사 (announce · review)', v4: '주는 동사 (give · award)', v5: '목적어 + 보어 동사 (consider · keep)', vi: '자동사 (occur · rise)', be: 'be동사' };
  VA.AFTER = { obj: '목적어 하나', obj2: '목적어 둘 (사람 + 물건)', objComp: '목적어 + 보어', comp: '보어만 (형용사·명사)', none: '없음 (시간·장소 표현만)' };
  const NEED = {
    vt: { obj: 'act', none: 'pass' },
    v4: { obj2: 'act', obj: 'pass', none: 'pass' },
    v5: { objComp: 'act', comp: 'pass' },
    vi: { none: 'act' },
    be: { comp: 'be' },
  };
  VA.need = (vt, after) => (NEED[vt] || {})[after] || null;
  const NEEDWHY = {
    'vt.obj': '빈칸 뒤에 목적어가 있어요 → 능동태.',
    'vt.none': '빈칸 뒤에 목적어가 없어요 → 수동태.',
    'v4.obj2': '주는 동사 뒤에 목적어가 둘(사람 + 물건) → 능동태.',
    'v4.obj': '주는 동사 뒤에 목적어가 하나만 남았어요 → 수동태(4형식).',
    'v4.none': '주는 동사 뒤에 목적어가 없어요 → 수동태.',
    'v5.objComp': '목적어와 보어가 다 있어요 → 능동태.',
    'v5.comp': '목적어 없이 보어만 남았어요 → 수동태(5형식).',
    'vi.none': '자동사는 목적어를 갖지 않아요 → 수동태가 없고 늘 능동태.',
    'be.comp': 'be동사 + 보어 → 능동·수동과 상관없어요.',
  };
  VA.needWhy = (vt, after) => NEEDWHY[vt + '.' + after] ||
    (vt === 'vi' ? '자동사 뒤에는 목적어나 보어가 오지 않아요. 이 조합은 문장이 되지 않아요.' : '이 동사는 이런 뒷부분과 함께 쓰지 않아요. 다른 조합을 골라 보세요.');

  /* ---------- 판정 ---------- */
  const X = {
    ing: '-ing 혼자는 동사 자리에 못 와요. 앞에 be나 have가 있어야 해요.',
    to: 'to부정사는 동사 자리에 못 와요.',
    be: 'be 뒤에 동사원형은 올 수 없어요. 과거분사나 -ing 형태가 와야 해요.',
    mod: '조동사(will · must) 뒤에는 동사원형이 와요. -ing 형태는 올 수 없어요.',
  };
  const ok = why => ({ s: 'ok', step: 0, why }), no = (step, why) => ({ s: 'no', step, why });
  VA.judge = function (code, ctx) {
    const [v, n] = code.split('.');
    if (v === 'n') return no(2, '명사는 동사 자리에 올 수 없어요.');
    if (v === 'x') return no(2, X[n] || '진짜 동사가 아니라서 동사 자리에 못 와요.');
    if (ctx.num !== '*' && n !== '*' && n !== ctx.num)
      return no(2, ctx.num === 's' ? '진짜 주어가 하나인데 복수 동사예요.' : '진짜 주어가 여럿인데 단수 동사예요.');
    const need = VA.need(ctx.vt, ctx.after);
    const numOk = ctx.num === '*' ? '' : n === '*' ? '이 모양은 수와 상관없이 써요. ' : `주어가 ${ctx.num === 's' ? '하나 → 단수' : '여럿 → 복수'}. `;
    if (need === 'be') return v === 'c' ? ok(numOk + 'be동사 + 보어, 딱 맞아요.') : no(3, 'be동사 + 보어 자리예요.');
    if (v === 'c') return no(3, '여기는 be동사 자리가 아니에요.');
    if (need === 'act' && v === 'p') return no(3, ctx.vt === 'vi' ? '자동사는 수동태가 없어요.' : ctx.vt === 'v4' ? '목적어가 둘 다 있어요 → 능동태.'
      : ctx.vt === 'v5' ? '목적어와 보어가 다 있어요 → 능동태.' : '빈칸 뒤에 목적어가 있어요 → 능동태.');
    if (need === 'pass' && v === 'a') return no(3, ctx.vt === 'v4' ? (ctx.after === 'none' ? '주는 동사인데 뒤에 목적어가 없어요 → 수동태.' : '주는 동사인데 목적어가 하나만 남았어요 → 수동태.')
      : ctx.vt === 'v5' ? '보어만 남았어요 → 수동태.' : '빈칸 뒤에 목적어가 없어요 → 수동태.');
    if (!need) return no(3, VA.needWhy(ctx.vt, ctx.after));
    return ok(numOk + VA.needWhy(ctx.vt, ctx.after));
  };
  VA.FORM = { a: '능동', p: '수동', c: 'be동사' };
  VA.formName = code => {
    const [v, n] = code.split('.');
    if (v === 'n') return '명사';
    if (v === 'x') return { ing: '-ing 혼자', to: 'to부정사', be: 'be + 원형', mod: '조동사 + -ing' }[n] || '동사가 아님';
    return (n === 's' ? '단수 ' : n === 'p' ? '복수 ' : '') + VA.FORM[v];
  };

  /* ---------- 동사 사전: [원형, -s, 과거, 과거분사, -ing], 종류, 뜻 ---------- */
  const V = {};
  const addV = (type, list) => list.forEach(([f, ko]) => { const p = f.split('/'); V[p[0]] = { w: p[0], f: p, type, ko }; });
  addV('vt', [['announce/announces/announced/announced/announcing', '발표하다'], ['review/reviews/reviewed/reviewed/reviewing', '검토하다'],
    ['prepare/prepares/prepared/prepared/preparing', '준비하다'], ['approve/approves/approved/approved/approving', '승인하다'],
    ['post/posts/posted/posted/posting', '올리다'], ['discuss/discusses/discussed/discussed/discussing', '논의하다'],
    ['submit/submits/submitted/submitted/submitting', '제출하다'], ['install/installs/installed/installed/installing', '설치하다'],
    ['repair/repairs/repaired/repaired/repairing', '고치다'], ['wear/wears/wore/worn/wearing', '착용하다'],
    ['receive/receives/received/received/receiving', '받다'], ['take/takes/took/taken/taking', '(시간이) 걸리다'],
    ['raise/raises/raised/raised/raising', '올리다'], ['notify/notifies/notified/notified/notifying', '알리다']]);
  addV('v4', [['give/gives/gave/given/giving', '주다'], ['offer/offers/offered/offered/offering', '제공하다'],
    ['award/awards/awarded/awarded/awarding', '수여하다'], ['send/sends/sent/sent/sending', '보내다'], ['grant/grants/granted/granted/granting', '허가해 주다']]);
  addV('v5', [['consider/considers/considered/considered/considering', '~라고 여기다'], ['keep/keeps/kept/kept/keeping', '~한 상태로 두다'],
    ['name/names/named/named/naming', '~로 지명하다'], ['appoint/appoints/appointed/appointed/appointing', '~로 임명하다']]);
  addV('vi', [['occur/occurs/occurred/occurred/occurring', '일어나다'], ['happen/happens/happened/happened/happening', '일어나다'],
    ['arise/arises/arose/arisen/arising', '생기다'], ['rise/rises/rose/risen/rising', '오르다'],
    ['take place/takes place/took place/taken place/taking place', '열리다'], ['emerge/emerges/emerged/emerged/emerging', '나타나다'],
    ['complain/complains/complained/complained/complaining', '불평하다']]);
  VA.VERBS = V;
  VA.verb = w => V[w];
  VA.passable = w => ['vt', 'v4', 'v5'].includes(V[w].type);   // 수동태가 되나요?

  // 동사 모양 만들기. tense: pres 현재 · past 과거 · perf 현재완료 · will 미래
  VA.TENSE = { pres: '현재', past: '과거', perf: '현재완료', will: '미래' };
  VA.active = (w, num, tense) => {
    const f = V[w].f;
    return tense === 'pres' ? (num === 's' ? f[1] : f[0]) : tense === 'past' ? f[2] : tense === 'perf' ? (num === 's' ? 'has ' : 'have ') + f[3] : 'will ' + f[0];
  };
  VA.beFor = (num, tense) => tense === 'pres' ? (num === 's' ? 'is' : 'are') : tense === 'past' ? (num === 's' ? 'was' : 'were')
    : tense === 'perf' ? (num === 's' ? 'has been' : 'have been') : 'will be';
  VA.passive = (w, num, tense) => VA.beFor(num, tense) + ' ' + V[w].f[3];
  // 동사 모양의 code (판정용)
  VA.codeOf = (voice, num, tense) => (voice === 'act' ? 'a' : 'p') + '.' + (tense === 'will' || (voice === 'act' && tense === 'past') ? '*' : num);

  /* ---------- 능동 ↔ 수동 변환기 (영상 05·07장, 직접 해 보기, 놀이터) ----------
   * s: 능동의 주어 [글자, 수] · v: 동사 · o: 목적어 [[글자, 수]] (주는 동사는 [사람, 물건]) · c: 보어 · rest: 뒤에 붙는 말
   * 명사구는 소문자로 적고, 문장 첫머리에 올 때 대문자로 바꿔요. ko: [능동, 수동] 한국어 (기본 시제)
   */
  VA.PAIRS = [
    { id: 'announce', s: ['the company', 's'], v: 'announce', o: [['the winners', 'p']], tense: 'past', ko: ['회사가 수상자를 발표했다.', '수상자가 발표되었다.'] },
    { id: 'review', s: ['the manager', 's'], v: 'review', o: [['the reports', 'p']], tense: 'pres', ko: ['매니저가 보고서를 검토한다.', '보고서가 검토된다.'] },
    { id: 'prepare', s: ['the interns', 'p'], v: 'prepare', o: [['the agenda', 's']], tense: 'pres', ko: ['인턴들이 회의 안건을 준비한다.', '회의 안건이 준비된다.'] },
    { id: 'approve', s: ['the directors', 'p'], v: 'approve', o: [['the budget', 's']], tense: 'past', ko: ['이사들이 예산을 승인했다.', '예산이 승인되었다.'] },
    { id: 'give', s: ['the company', 's'], v: 'give', o: [['Ms. Lee', 's'], ['a bonus', 's']], tense: 'past', ko: ['회사가 이 씨에게 보너스를 주었다.', '이 씨가 보너스를 받았다.'] },
    { id: 'offer', s: ['the hotel', 's'], v: 'offer', o: [['guests', 'p'], ['a free breakfast', 's']], tense: 'pres', ko: ['호텔은 손님에게 무료 아침을 제공한다.', '손님은 무료 아침을 제공받는다.'] },
    { id: 'consider', s: ['the directors', 'p'], v: 'consider', o: [['the plan', 's']], c: 'essential', tense: 'pres', ko: ['이사들은 그 계획을 꼭 필요하다고 여긴다.', '그 계획은 꼭 필요하다고 여겨진다.'] },
    { id: 'keep', s: ['the guards', 'p'], v: 'keep', o: [['the main door', 's']], c: 'locked', tense: 'pres', ko: ['경비원들이 정문을 잠가 둔다.', '정문은 잠긴 채로 있다.'] },
    { id: 'occur', s: ['a problem', 's'], v: 'occur', o: [], rest: 'during the test', tense: 'past', ko: ['시험 중에 문제가 생겼다.', ''] },
    { id: 'rise', s: ['prices', 'p'], v: 'rise', o: [], rest: 'sharply', tense: 'past', ko: ['가격이 크게 올랐다.', ''] },
  ];
  VA.pair = id => VA.PAIRS.find(p => p.id === id) || VA.PAIRS[0];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const joinT = T => T.map(t => t.t).join(' ').replace(/ \./g, '.');
  // 토큰: { id, t, r } — r: subj 주어 · v 동사 · obj 목적어 · comp 보어 · fn 기능어(by, to) · by 행위자 · '' 보통
  // o: { voice: 'act' | 'pass', tense, sub: 0 사람 | 1 물건 (주는 동사의 새 주어), by: by + 행위자를 붙일지, vp: 동사 모양 바꾸기(틀린 쌍둥이용) }
  VA.build = function (P, o = {}) {
    const voice = o.voice || 'act', tense = o.tense || P.tense, D = V[P.v], vt = D.type, T = [];
    const add = (id, t, r) => T.push({ id, t, r });
    const verbToks = vp => {
      const n = P.v.split(' ').length, ws = vp.split(' '), main = ws.splice(ws.length - (voice === 'act' ? n : 1)).join(' ');
      if (ws.length) add('VA', ws.join(' '), 'v');
      add('VM', main, 'v');
    };
    if (voice === 'act') {
      const [st, sn] = P.s, vp = o.vp || VA.active(P.v, sn, tense);
      add('S', cap(st), 'subj'); verbToks(vp);
      P.o.forEach(([t], i) => add('O' + i, t, 'obj'));
      if (P.c) add('C', P.c, 'comp');
      if (P.rest) add('R', P.rest, '');
      add('DOT', '.', '');
      const after = vt === 'v4' ? 'obj2' : vt === 'v5' ? 'objComp' : P.o.length ? 'obj' : 'none';
      return { ok: true, voice, tense, vt, toks: T, text: joinT(T), num: sn, subj: st, vp, ctx: { num: sn, vt, after }, code: VA.codeOf('act', sn, tense) };
    }
    if (!P.o.length) return { ok: false, voice, tense, vt, toks: [], text: '', why: `${P.v} = ${D.ko}, 목적어가 없는 자동사예요. 주어 자리로 올릴 목적어가 없으니 수동태도 없어요.` };
    const k = vt === 'v4' && o.sub === 1 ? 1 : 0, [nt, nn] = P.o[k], vp = o.vp || VA.passive(P.v, nn, tense);
    add('O' + k, cap(nt), 'subj'); verbToks(vp);
    let after = 'none';
    if (vt === 'v4') {
      if (k === 0) { add('O1', P.o[1][0], 'obj'); after = 'obj'; } else { add('TO', 'to', 'fn'); add('O0', P.o[0][0], ''); }
    }
    if (P.c) { add('C', P.c, 'comp'); after = 'comp'; }
    if (P.rest) add('R', P.rest, '');
    if (o.by !== false) { add('BY', 'by', 'fn'); add('S', P.s[0], 'by'); }
    add('DOT', '.', '');
    return { ok: true, voice, tense, vt, toks: T, text: joinT(T), num: nn, subj: nt, vp, ctx: { num: nn, vt, after }, code: VA.codeOf('pass', nn, tense), sub: k };
  };
  // 변환기의 '왜?' — 단계 설명과 틀린 쌍둥이(규칙 엔진의 까닭)
  VA.explain = function (P, o = {}) {
    const B = VA.build(P, o);
    if (!B.ok) return { B, steps: [B.why].concat(P.v === 'rise' ? ['올리다 = raise, 타동사라서 수동태가 돼요 → Prices were raised.'] : []), twins: [] };
    const D = V[P.v], numW = n => n === 's' ? '하나 → 단수' : '여럿 → 복수', steps = [], twins = [];
    const nsame = B.tense === 'will' || (B.voice === 'act' && B.tense === 'past');
    if (B.voice === 'act') {
      steps.push(`① 주어 = ${cap(B.subj)} → ${B.num === 's' ? '하나' : '여럿'}.`);
      steps.push(`② ${VA.TENSE[B.tense]} 시제 → ${B.vp}` + (nsame ? ' (이 모양은 수와 상관없어요).' : ` (${numW(B.num)}).`));
      steps.push(`③ ${VA.needWhy(B.vt, B.ctx.after)}`);
    } else {
      const was = B.sub === 1 ? '목적어(물건)' : B.vt === 'v4' ? '목적어(사람)' : '목적어';
      steps.push(`① ${was}였던 말 → 주어 자리로: ${cap(B.subj)}.`);
      steps.push(`② 새 주어가 ${B.num === 's' ? '하나' : '여럿'} → ${VA.beFor(B.num, B.tense)}` + (B.tense === 'will' ? ' (will 뒤라서 수와 상관없어요).' : '.'));
      steps.push(`③ be + 과거분사(${D.f[3]}). ${VA.needWhy(B.vt, B.ctx.after)}`);
      if (o.by !== false) steps.push(`by + ${P.s[0]} → 누가 했는지 알려 줘요. 토익 문장에서는 자주 빠져요.`);
    }
    // 틀린 쌍둥이: 수만 틀린 것, 태만 틀린 것 → 규칙 엔진이 까닭을 말함
    const flip = n => n === 's' ? 'p' : 's';
    if (!nsame && !(B.voice === 'pass' && B.tense === 'will')) {
      const wn = flip(B.num), vp = B.voice === 'act' ? VA.active(P.v, wn, B.tense) : VA.passive(P.v, wn, B.tense);
      const W = VA.build(P, Object.assign({}, o, { vp, by: false }));
      twins.push({ text: W.text, j: VA.judge(VA.codeOf(B.voice, wn, B.tense), B.ctx) });
    }
    {
      const ov = B.voice === 'act' ? 'pass' : 'act', vp = ov === 'act' ? VA.active(P.v, B.num, B.tense) : VA.passive(P.v, B.num, B.tense);
      const W = VA.build(P, Object.assign({}, o, { vp, by: false }));
      twins.push({ text: W.text, j: VA.judge(VA.codeOf(ov, B.num, B.tense), B.ctx) });
    }
    return { B, steps, twins };
  };

  /* ---------- 영상 01장: 주어를 바꾸면 영어 동사만 바뀜 ---------- */
  VA.SUBS = [
    { en: 'He', ko: '그는', n: 's' }, { en: 'They', ko: '그들은', n: 'p' },
    { en: 'The manager', ko: '매니저가', n: 's' }, { en: 'The managers', ko: '매니저들이', n: 'p' },
    { en: 'My sister', ko: '언니가', n: 's' }, { en: 'My parents', ko: '부모님이', n: 'p' },
  ];
  VA.ROWS01 = [
    { s: 'goes', p: 'go', rest: 'to work early', ko: '일찍 출근한다' },
    { s: 'has', p: 'have', rest: 'a meeting today', ko: '오늘 회의가 있다' },
    { s: 'is', p: 'are', rest: 'ready', ko: '준비가 됐다' },
    { s: 'was', p: 'were', rest: 'busy yesterday', ko: '어제 바빴다' },
  ];

  /* ---------- 영상 03장: 수량 표현 ---------- */
  VA.QUANT = {
    anum:    { t: 'A number of', noun: 'applicants', kind: 'anum', mean: '= 많은' },
    thenum:  { t: 'The number of', noun: 'applicants', kind: 'thenum', mean: '= ~의 수' },
    each:    { t: 'Each', noun: 'applicant', kind: 'each', mean: '= 하나하나' },
    every:   { t: 'Every', noun: 'applicant', kind: 'each', mean: '= 모든 (하나하나)' },
    oneof:   { t: 'One of the', noun: 'applicants', kind: 'oneof', mean: '= 그 가운데 한 명' },
    eachof:  { t: 'Each of the', noun: 'applicants', kind: 'oneof', mean: '= 그 가운데 하나하나' },
    several: { t: 'Several', noun: 'applicants', kind: 'many', mean: '= 몇몇' },
    both:    { t: 'Both', noun: 'applicants', kind: 'many', mean: '= 둘 다' },
  };
  VA.quantSentence = k => { const Q = VA.QUANT[k], n = VA.SUBJ[Q.kind].num; return { Q, num: n, verb: n === 's' ? 'has' : 'have', text: `${Q.t} ${Q.noun} ${n === 's' ? 'has' : 'have'} called.` }; };

  /* ---------- 영상 06장 직접 해 보기: 목적어일까, 아닐까 ---------- */
  VA.PHRASES = [
    ['the winners', 'obj'], ['next week', 'time'], ['by Friday', 'time'], ['the new policy', 'obj'],
    ['on the website', 'place'], ['all applicants', 'obj'], ['carefully', 'adv'], ['a full refund', 'obj'],
  ];
  VA.PHRASEKIND = { obj: '목적어 (명사)', time: '시간 표현', place: '장소 표현', adv: '부사' };

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * opts: [보기, code] · subj: { kind, head: 진짜 주어(문장 속 글자), mods: 지울 수식어, quant: 수량 표현 }
   * frame: 빈칸 앞의 조동사(will · must)가 수를 정해 버리면 그 글자 · vt · after · verb · cue: 빈칸 뒤 단서(문장 속 글자)
   */
  VA.DRILL = [
    { q: 'The results of the customer survey ___ on the company website yesterday.', opts: [['posted', 'a.*'], ['was posted', 'p.s'], ['were posted', 'p.p'], ['was posting', 'a.s']], a: 2,
      subj: { kind: 'pl', head: 'results', mods: ['of the customer survey'] }, verb: 'post', vt: 'vt', after: 'none', cue: 'on the company website yesterday',
      tag: '수식어 건너뛰기 · 목적어 없음', type: 9, ko: '고객 설문 결과가 어제 회사 웹사이트에 올라왔어요.' },
    { q: 'The employees who work in the research lab ___ safety glasses at all times.', opts: [['wears', 'a.s'], ['wear', 'a.p'], ['is worn', 'p.s'], ['are worn', 'p.p']], a: 1,
      subj: { kind: 'pl', head: 'employees', mods: ['who work in the research lab'] }, verb: 'wear', vt: 'vt', after: 'obj', cue: 'safety glasses',
      tag: '관계사절 건너뛰기 · 목적어 있음', type: 9, ko: '연구실에서 일하는 직원들은 언제나 보안경을 써요.' },
    { q: 'The cost of the new office chairs ___ higher than expected.', opts: [['were', 'c.p'], ['was', 'c.s'], ['being', 'x.ing'], ['have been', 'c.p']], a: 1,
      subj: { kind: 'sg', head: 'cost', mods: ['of the new office chairs'] }, verb: 'be', vt: 'be', after: 'comp', cue: 'higher',
      tag: '수식어 건너뛰기 · be동사', type: 9, ko: '새 사무실 의자의 가격이 예상보다 높았어요.' },
    { q: 'A number of guests ___ about the late check-in time.', opts: [['has complained', 'a.s'], ['has been complained', 'p.s'], ['complaining', 'x.ing'], ['have complained', 'a.p']], a: 3,
      subj: { kind: 'anum', head: 'guests', quant: 'A number of' }, verb: 'complain', vt: 'vi', after: 'none', cue: 'about the late check-in time',
      tag: 'a number of + 복수', type: 10, ko: '많은 손님이 늦은 체크인 시간에 대해 불평했어요.' },
    { q: 'The number of online orders ___ steadily over the past year.', opts: [['have risen', 'a.p'], ['has been risen', 'p.s'], ['rising', 'x.ing'], ['has risen', 'a.s']], a: 3,
      subj: { kind: 'thenum', head: 'The number', mods: ['of online orders'] }, verb: 'rise', vt: 'vi', after: 'none', cue: 'steadily over the past year',
      tag: 'the number of · 자동사 rise', type: 10, ko: '지난 한 해 동안 온라인 주문 건수가 꾸준히 늘었어요.' },
    { q: 'Each participant ___ a certificate at the end of the workshop.', opts: [['receives', 'a.s'], ['receive', 'a.p'], ['is received', 'p.s'], ['receiving', 'x.ing']], a: 0,
      subj: { kind: 'each', head: 'Each participant' }, verb: 'receive', vt: 'vt', after: 'obj', cue: 'a certificate',
      tag: 'each + 단수 · 목적어 있음', type: 10, ko: '참가자는 워크숍이 끝날 때 각자 수료증을 받아요.' },
    { q: 'One of the photocopiers on the second floor ___ yesterday.', opts: [['was repaired', 'p.s'], ['were repaired', 'p.p'], ['repaired', 'a.*'], ['has repaired', 'a.s']], a: 0,
      subj: { kind: 'oneof', head: 'One', mods: ['of the photocopiers on the second floor'] }, verb: 'repair', vt: 'vt', after: 'none', cue: 'yesterday',
      tag: 'one of · 목적어 없음', type: 10, ko: '2층 복사기 가운데 한 대가 어제 수리됐어요.' },
    { q: 'Reviewing all of the expense reports ___ several hours every month.', opts: [['take', 'a.p'], ['is taken', 'p.s'], ['takes', 'a.s'], ['are taken', 'p.p']], a: 2,
      subj: { kind: 'ger', head: 'Reviewing', mods: ['all of the expense reports'] }, verb: 'take', vt: 'vt', after: 'obj', cue: 'several hours',
      tag: '동명사 주어', type: 11, ko: '모든 경비 보고서를 검토하는 데 매달 몇 시간이 걸려요.' },
    { q: 'What the clients want most ___ faster delivery.', opts: [['are', 'c.p'], ['were', 'c.p'], ['is', 'c.s'], ['being', 'x.ing']], a: 2,
      subj: { kind: 'clause', head: 'What the clients want most' }, verb: 'be', vt: 'be', after: 'comp', cue: 'faster delivery',
      tag: '명사절 주어', type: 11, ko: '고객이 가장 원하는 것은 더 빠른 배송이에요.' },
    { q: 'The new equipment for the fitness center ___ last weekend.', opts: [['installed', 'a.*'], ['were installed', 'p.p'], ['installing', 'x.ing'], ['was installed', 'p.s']], a: 3,
      subj: { kind: 'mass', head: 'equipment', mods: ['for the fitness center'] }, verb: 'install', vt: 'vt', after: 'none', cue: 'last weekend',
      tag: '셀 수 없는 명사 · 목적어 없음', type: 11, ko: '피트니스 센터의 새 장비가 지난 주말에 설치됐어요.' },
    { q: 'The marketing team will ___ the results of the campaign at Friday\'s meeting.', opts: [['discuss', 'a.*'], ['be discussed', 'p.*'], ['discussing', 'x.mod'], ['discussion', 'n']], a: 0,
      subj: { kind: 'sg', head: 'team' }, frame: 'will', verb: 'discuss', vt: 'vt', after: 'obj', cue: 'the results',
      tag: '목적어 있음 → 능동', type: 13, ko: '마케팅팀은 금요일 회의에서 캠페인 결과를 논의할 거예요.' },
    { q: 'All travel expense reports must be ___ by the end of the month.', opts: [['submit', 'x.be'], ['submitting', 'a.*'], ['submission', 'n'], ['submitted', 'p.*']], a: 3,
      subj: { kind: 'pl', head: 'reports' }, frame: 'must be', verb: 'submit', vt: 'vt', after: 'none', cue: 'by the end of the month',
      tag: '목적어 없음 → 수동', type: 13, ko: '모든 출장 경비 보고서는 이달 말까지 제출돼야 해요.' },
    { q: 'Ms. Kwon ___ a special bonus for her work on the merger.', opts: [['awarded', 'a.*'], ['was awarded', 'p.s'], ['were awarded', 'p.p'], ['awarding', 'x.ing']], a: 1,
      subj: { kind: 'sg', head: 'Ms. Kwon' }, verb: 'award', vt: 'v4', after: 'obj', cue: 'a special bonus',
      tag: '4형식 수동태', type: 14, ko: '권 씨는 합병 업무에 대한 특별 보너스를 받았어요.' },
    { q: 'Regular software updates ___ essential for protecting customer data.', opts: [['consider', 'a.p'], ['is considered', 'p.s'], ['are considered', 'p.p'], ['considering', 'x.ing']], a: 2,
      subj: { kind: 'pl', head: 'updates' }, verb: 'consider', vt: 'v5', after: 'comp', cue: 'essential',
      tag: '5형식 수동태', type: 14, ko: '정기적인 소프트웨어 업데이트는 고객 정보를 지키는 데 꼭 필요하다고 여겨져요.' },
    { q: 'Several problems ___ during the trial run of the new software.', opts: [['arose', 'a.*'], ['was arisen', 'p.s'], ['were arisen', 'p.p'], ['arising', 'x.ing']], a: 0,
      subj: { kind: 'many', head: 'problems', quant: 'Several' }, verb: 'arise', vt: 'vi', after: 'none', cue: 'during the trial run',
      tag: '자동사 arise', type: 15, ko: '새 소프트웨어를 시험 운영하는 동안 문제가 몇 가지 생겼어요.' },
    { q: 'The annual shareholders\' meeting ___ at the Grand Hotel last Thursday.', opts: [['was taken place', 'p.s'], ['took place', 'a.*'], ['were taken place', 'p.p'], ['taking place', 'x.ing']], a: 1,
      subj: { kind: 'sg', head: 'meeting' }, verb: 'take place', vt: 'vi', after: 'none', cue: 'at the Grand Hotel last Thursday',
      tag: '자동사 take place', type: 15, ko: '연례 주주총회는 지난 목요일 그랜드 호텔에서 열렸어요.' },
  ];
  VA.ctxOf = it => ({ num: it.frame ? '*' : VA.SUBJ[it.subj.kind].num, vt: it.vt, after: it.after });
  VA.judgeOpt = (it, k) => VA.judge(it.opts[k][1], VA.ctxOf(it));

  // 3단계 풀이 (연습 문제 힌트). ① 주어 ② 수 ③ 뒤
  const L = 'ABCD';
  VA.steps = function (it) {
    const sj = it.subj, K = VA.SUBJ[sj.kind], ctx = VA.ctxOf(it), num = K.num;
    const out2 = it.opts.map((o, k) => [k, VA.judgeOpt(it, k)]).filter(([, j]) => j.step === 2).map(([k]) => `(${L[k]}) ${it.opts[k][0]}`);
    const out3 = it.opts.map((o, k) => [k, VA.judgeOpt(it, k)]).filter(([, j]) => j.step === 3).map(([k]) => `(${L[k]}) ${it.opts[k][0]}`);
    let t1;
    if (sj.kind === 'ger') t1 = `동명사 덩어리가 주어예요 → ${sj.head} ${(sj.mods || []).join(' ')}. ${K.why}. 바로 앞의 복수 명사에 속지 마세요.`;
    else if (sj.kind === 'clause') t1 = `명사절 덩어리가 주어예요 → ${sj.head}. ${K.why}.`;
    else if (sj.kind === 'anum') t1 = `${K.why}. 진짜 주어 = ${sj.head}.`;
    else if (sj.mods) t1 = `수식어를 지워요 → ${sj.mods.join(' … ')}. 진짜 주어 = ${sj.head}, ${K.why}.`;
    else if (sj.quant) t1 = `${sj.quant} → ${K.why}. 진짜 주어 = ${sj.head}.`;
    else if (sj.kind === 'each') t1 = `each + 단수 명사 → ${K.why}. 진짜 주어 = ${sj.head}.`;
    else if (sj.kind === 'mass') t1 = `진짜 주어 = ${sj.head}. ${K.why}.`;
    else t1 = `진짜 주어 = ${sj.head}, ${K.why}.`;
    const t2 = (it.frame ? `${it.frame} 뒤의 빈칸이라 수는 따지지 않아요. 모양이 맞는 동사만 남겨요.` : `주어가 ${num === 's' ? '하나 → 단수 동사' : '여럿 → 복수 동사'}만 남겨요.`) +
      (out2.length ? ` 탈락: ${out2.join(' · ')}.` : '');
    const t3 = VA.needWhy(it.vt, it.after) + (it.vt === 'vi' ? ` (${it.verb} = ${V[it.verb].ko})` : it.vt === 'v4' ? ` (${it.verb} = 주는 동사)` : '') +
      (out3.length ? ` 탈락: ${out3.join(' · ')}.` : '') + ` 정답 (${L[it.a]}) ${it.opts[it.a][0]}.`;
    const m1 = [{ t: sj.head, role: 'ante' }].concat((sj.mods || []).map(t => ({ t, role: 'trap' }))).concat(sj.quant ? [{ t: sj.quant, role: 'cue' }] : []);
    const cueRole = ['obj', 'obj2', 'comp', 'objComp'].includes(it.after) ? 'cue' : 'trap';
    return [
      { head: '① 진짜 주어를 찾아요.', text: t1, marks: m1 },
      { head: '② 수를 맞춰요.', text: t2, marks: it.frame ? [{ t: it.frame, role: 'verb' }] : [] },
      { head: '③ 빈칸 뒤를 봐요.', text: t3, marks: it.cue ? [{ t: it.cue, role: cueRole }] : [] },
    ];
  };
  VA.drillItems = () => VA.DRILL.map(it => ({
    q: it.q, opts: it.opts.map(o => o[0]), a: it.a, ko: it.ko, tag: it.tag, steps: VA.steps(it),
    notes: it.opts.map(([, code], k) => { const j = VA.judgeOpt(it, k); return `${VA.formName(code)}. ` + (j.s === 'ok' ? '' : '× ') + j.why; }),
  }));

  /* ---------- 놀이터: 진짜 주어 누르기 ----------
   * s: 문장 · head: 진짜 주어(낱말 하나) · mod: 지울 부분 · v: 동사 · n: 수 · why: 특별히 헷갈리는 낱말의 까닭
   */
  VA.FIND = [
    { s: 'The results of the customer survey are ready.', head: 'results', mod: 'of the customer survey', v: 'are', n: 'p' },
    { s: 'The list of approved suppliers is updated every month.', head: 'list', mod: 'of approved suppliers', v: 'is updated', n: 's' },
    { s: 'The employees who work in the lab wear safety glasses.', head: 'employees', mod: 'who work in the lab', v: 'wear', n: 'p' },
    { s: 'The cost of the new chairs was higher than expected.', head: 'cost', mod: 'of the new chairs', v: 'was', n: 's' },
    { s: 'The new chairs ordered for the lobby have arrived.', head: 'chairs', mod: 'ordered for the lobby', v: 'have arrived', n: 'p' },
    { s: 'One of the printers is out of order.', head: 'One', mod: 'of the printers', v: 'is', n: 's' },
    { s: 'The number of complaints has dropped.', head: 'number', mod: 'of complaints', v: 'has dropped', n: 's' },
    { s: 'A number of guests have complained.', head: 'guests', mod: '', v: 'have complained', n: 'p', why: { number: 'a number of = 많은. 수를 정하는 것은 그 뒤의 명사예요.' } },
    { s: 'Reviewing the reports takes time.', head: 'Reviewing', mod: '', v: 'takes', n: 's', why: { reports: '검토하는 대상(목적어)이에요. 주어 덩어리의 중심은 하는 일 → Reviewing.' } },
    { s: 'The equipment in the new labs was installed last week.', head: 'equipment', mod: 'in the new labs', v: 'was installed', n: 's' },
    { s: 'Each of the rooms has a balcony.', head: 'Each', mod: 'of the rooms', v: 'has', n: 's' },
    { s: 'The manager of the sales teams has resigned.', head: 'manager', mod: 'of the sales teams', v: 'has resigned', n: 's' },
  ];
  // 문장을 낱말로 나누고 역할을 붙임: head · mod · v · ''
  VA.findToks = function (F) {
    const words = F.s.replace(/\.$/, '').split(' '), out = words.map((w, i) => ({ i, t: w, r: '' }));
    const mark = (phrase, r) => {
      if (!phrase) return;
      const p = phrase.split(' ');
      for (let i = 0; i + p.length <= words.length; i++) if (p.every((w, k) => words[i + k] === w)) { for (let k = 0; k < p.length; k++) out[i + k].r = r; return; }
    };
    mark(F.mod, 'mod'); mark(F.v, 'v');
    const h = words.indexOf(F.head); if (h >= 0) out[h].r = 'head';
    return out;
  };
  VA.findWhy = function (F, i) {
    const T = VA.findToks(F), tk = T[i];
    if (tk.r === 'head') return { ok: true, why: `진짜 주어 = ${F.head} → ${F.n === 's' ? '하나 → 단수' : '여럿 → 복수'} 동사 ${F.v.split(' ')[0]}.` };
    if (F.why && F.why[tk.t]) return { ok: false, why: F.why[tk.t] };
    if (tk.r === 'mod') return { ok: false, why: `이 낱말은 지울 부분 안에 있어요 → ${F.mod}.` };
    if (tk.r === 'v') return { ok: false, why: '동사예요. 주어는 동사 앞에서 찾아요.' };
    const hi = T.findIndex(t => t.r === 'head'), vi = T.findIndex(t => t.r === 'v');
    if (i < hi) return { ok: false, why: '꾸미는 말이에요. 그 뒤의 중심 낱말을 찾아요.' };
    if (i < vi) return { ok: false, why: '주어 덩어리 안의 말이지만 중심 낱말은 아니에요. 동사가 수를 맞추는 낱말을 찾아요.' };
    return { ok: false, why: '동사 뒤의 말이에요. 주어는 동사 앞에서 찾아요.' };
  };

  // 판정기의 결론: 수와 태 → 동사 모양
  VA.formsFor = (num, need) => need === 'be' ? (num === 's' ? 'is · was' : 'are · were')
    : need === 'pass' ? (num === 's' ? 'is · was · has been + p.p.' : 'are · were · have been + p.p.')
    : (num === 's' ? '-s 동사 · has + p.p. · 과거형' : '원형 · have + p.p. · 과거형');

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용 — 직접 해 보기로만 나오는 글자 포함)
  VA.allText = function () {
    const out = [];
    VA.SUBS.forEach(s => out.push(s.en, s.ko));
    Object.keys(VA.QUANT).forEach(k => { const q = VA.quantSentence(k); out.push(q.text, q.Q.mean); });
    VA.PAIRS.forEach(P => { out.push(P.ko.join('')); ['pres', 'past', 'perf', 'will'].forEach(tense => [0, 1].forEach(sub => ['act', 'pass'].forEach(voice => {
      const B = VA.build(P, { voice, tense, sub }); out.push(B.text || B.why || '', B.vp || '');
    }))); });
    Object.values(VA.SUBJ).forEach(s => out.push(s.name, s.why));
    out.push(Object.values(VA.VT).join(''), Object.values(VA.AFTER).join(''), Object.values(NEEDWHY).join(''), '하나여럿능동수동');
    ['s', 'p'].forEach(n => ['act', 'pass', 'be'].forEach(v => out.push(VA.formsFor(n, v))));
    return out.join('');
  };

  // 데이터 점검: 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, 단서가 문장에 있는지, 정답 위치가 고르게 섞였는지, 변환기 결과가 맞는지
  VA.check = function () {
    const bad = [];
    VA.DRILL.forEach((it, i) => {
      const good = it.opts.map((o, k) => VA.judgeOpt(it, k).s === 'ok' ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`연습 문제 ${i + 1}: 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      const texts = [it.subj.head].concat(it.subj.mods || [], it.subj.quant ? [it.subj.quant] : [], it.cue ? [it.cue] : [], it.frame ? [it.frame] : []);
      texts.forEach(c => { if (!it.q.includes(c)) bad.push(`연습 문제 ${i + 1}: 단서 ‘${c}’가 문장에 없어요`); });
      if (it.verb !== 'be' && !V[it.verb]) bad.push(`연습 문제 ${i + 1}: 동사 사전에 ${it.verb}가 없어요`);
      if (V[it.verb] && V[it.verb].type !== it.vt) bad.push(`연습 문제 ${i + 1}: ${it.verb}의 동사 종류가 사전과 달라요`);
      if (!VA.need(it.vt, it.after)) bad.push(`연습 문제 ${i + 1}: 동사 종류와 빈칸 뒤가 함께 쓰일 수 없어요`);
    });
    const pos = [0, 0, 0, 0]; VA.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 1) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    // 변환기: 기본 시제의 능동·수동 문장이 기대와 같은지
    const expect = {
      announce: ['The company announced the winners.', 'The winners were announced by the company.'],
      give: ['The company gave Ms. Lee a bonus.', 'Ms. Lee was given a bonus by the company.'],
      offer: ['The hotel offers guests a free breakfast.', 'Guests are offered a free breakfast by the hotel.'],
      consider: ['The directors consider the plan essential.', 'The plan is considered essential by the directors.'],
      rise: ['Prices rose sharply.', ''],
    };
    Object.entries(expect).forEach(([id, [a, p]]) => {
      const P = VA.pair(id), A = VA.build(P, { voice: 'act' }), B = VA.build(P, { voice: 'pass' });
      if (A.text !== a) bad.push(`변환기 ${id}: 능동 ‘${A.text}’`);
      if ((B.ok ? B.text : '') !== p) bad.push(`변환기 ${id}: 수동 ‘${B.text}’`);
      if (A.ok && VA.judge(A.code, A.ctx).s !== 'ok') bad.push(`변환기 ${id}: 능동 문장이 규칙 엔진과 달라요`);
      if (B.ok && VA.judge(B.code, B.ctx).s !== 'ok') bad.push(`변환기 ${id}: 수동 문장이 규칙 엔진과 달라요`);
    });
    VA.PAIRS.forEach(P => ['pres', 'past', 'perf', 'will'].forEach(tense => [0, 1].forEach(sub => ['act', 'pass'].forEach(voice => {
      const B = VA.build(P, { voice, tense, sub });
      if (B.ok && VA.judge(B.code, B.ctx).s !== 'ok') bad.push(`변환기 ${P.id} ${voice} ${tense}: 규칙 엔진과 달라요`);
      if (B.ok) VA.explain(P, { voice, tense, sub }).twins.forEach(w => { if (w.j.s === 'ok') bad.push(`변환기 ${P.id}: 틀린 쌍둥이가 맞다고 나와요 (${w.text})`); });
    }))));
    VA.FIND.forEach((F, i) => {
      const T = VA.findToks(F);
      if (!T.some(t => t.r === 'head')) bad.push(`진짜 주어 누르기 ${i + 1}: ${F.head}가 문장에 없어요`);
      if (F.mod && !T.some(t => t.r === 'mod')) bad.push(`진짜 주어 누르기 ${i + 1}: 지울 부분이 문장에 없어요`);
      if (!T.some(t => t.r === 'v')) bad.push(`진짜 주어 누르기 ${i + 1}: 동사가 문장에 없어요`);
    });
    Object.keys(VA.QUANT).forEach(k => { if (!VA.SUBJ[VA.QUANT[k].kind]) bad.push(`수량 표현 ${k}: 종류가 없어요`); });
    bad.forEach(b => console.warn('[수 일치·능동 수동] ' + b));
    return bad;
  };
})();
