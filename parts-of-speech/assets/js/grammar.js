/* 품사 자리 튜토리얼 — 규칙 엔진과 예문
 *
 * 품사 문제는 보기 네 개가 한 낱말 가족(같은 뿌리)이에요. 답은 뜻이 아니라 빈칸의 '자리'가 정합니다.
 * 영상의 ✓·×, 직접 해 보기, 놀이터(3초 감각 훈련), 연습 문제, 퀴즈가 모두 judge()로 정답을 정하고,
 * 문제 데이터에 적은 정답이 judge()와 다르면 콘솔에 경고를 냅니다.
 *
 * 품사(pos):  n 명사(일·개념) · np 사람 명사 · v 동사(원형·변화형) · vg 동명사(-ing + 목적어) · adj 형용사 · adv 부사
 * 자리(slot): n 명사 · np 사람 명사 · nabs 일·개념 명사 · cmpd 명사 + 명사 · ger 동명사
 *             adj 명사 앞 형용사 · comp 보어(be·remain 뒤) · oc 목적격 보어(keep + 목적어 뒤) · adv 부사
 * judge(pos, slot) → { s: 'ok' | 'no', why }
 */
(function () {
  'use strict';
  const PS = (window.PS = {});

  const POS = { n: '명사', np: '사람 명사', v: '동사', vg: '동명사', adj: '형용사', adv: '부사' };
  PS.POS = POS;
  // 큰 갈래 (3초 감각 훈련의 단추): 명사 · 형용사 · 부사 · 동명사
  PS.CAT = { n: 'n', np: 'n', v: 'v', vg: 'vg', adj: 'adj', adv: 'adv' };
  PS.CATNAME = { n: '명사', adj: '형용사', adv: '부사', vg: '동명사', v: '동사' };

  const SLOT = {
    n:    { name: '명사 자리', ok: ['n', 'np'], sign: '관사·소유격·형용사 뒤, 전치사 앞' },
    np:   { name: '사람 명사 자리', ok: ['np'], sign: '단서가 사람을 가리킴' },
    nabs: { name: '일·개념 명사 자리', ok: ['n'], sign: '관사 없는 단수, 사람이 할 수 없는 일' },
    cmpd: { name: '명사 + 명사 자리', ok: ['n'], sign: '명사와 명사 사이, 굳어진 짝' },
    ger:  { name: '동명사 자리', ok: ['vg'], sign: '전치사 뒤 + 뒤에 목적어' },
    adj:  { name: '명사 앞 형용사 자리', ok: ['adj'], sign: '관사·소유격과 명사 사이' },
    comp: { name: '보어 자리', ok: ['adj'], sign: 'be·remain·become·seem 뒤' },
    oc:   { name: '목적격 보어 자리', ok: ['adj'], sign: 'keep·find·make + 목적어 뒤' },
    adv:  { name: '부사 자리', ok: ['adv'], sign: '빼도 문장이 완전한 자리' },
  };
  PS.SLOT = SLOT;
  PS.slotCat = slot => slot === 'ger' ? 'vg' : ['adj', 'comp', 'oc'].includes(slot) ? 'adj' : slot === 'adv' ? 'adv' : 'n';

  const OK = {
    n: '관사·형용사 뒤, 전치사 앞 → 명사 자리에 명사.',
    np: '단서가 사람을 가리켜요 → 사람 명사.',
    nabs: '사람이 아니라 일·개념이 들어갈 자리 → 일·개념 명사.',
    cmpd: '명사와 명사가 한 덩어리로 굳은 말(복합명사) → 명사.',
    ger: '전치사 뒤에 오면서 뒤에 목적어를 가짐 → 동명사.',
    adj: '뒤의 명사를 꾸미는 자리 → 형용사.',
    comp: 'be·remain 같은 동사 뒤에서 주어의 상태를 말함 → 형용사.',
    oc: '목적어의 상태를 말함 (목적어 = 보어) → 형용사.',
    adv: '빼도 문장이 완전한 꾸밈 자리 → 부사.',
  };
  const ok = why => ({ s: 'ok', why }), no = why => ({ s: 'no', why });

  PS.judge = function (pos, slot) {
    const S = SLOT[slot];
    if (S.ok.includes(pos)) return ok(OK[slot]);
    const where = S.name;
    switch (pos) {
      case 'v':
        return no(`동사는 이 자리에 못 와요. 문장에는 이미 동사가 있고, 빈칸은 ${where}예요.`);
      case 'adv':
        return no(slot === 'comp' || slot === 'oc' ? '부사는 보어가 될 수 없어요. 상태를 말하는 것은 형용사예요.'
          : '부사는 명사를 꾸미거나 명사 자리에 올 수 없어요.');
      case 'adj':
        return no(slot === 'adv' ? '형용사는 동사나 형용사를 꾸미지 못해요. 여기는 부사 자리예요.'
          : slot === 'cmpd' ? '여기는 명사 + 명사로 굳어진 짝이에요. 형용사를 넣으면 뜻이 달라져요.'
          : slot === 'ger' ? '전치사 뒤에서 목적어를 가지려면 동명사가 필요해요.'
          : '형용사 뒤에는 꾸밈 받을 명사가 있어야 해요. 여기는 명사 자체가 들어갈 자리예요.');
      case 'vg':
        return no(slot === 'n' || slot === 'nabs' ? '빈칸 뒤에 목적어가 없어요(전치사가 와요) → 동명사가 아니라 명사예요.'
          : `-ing는 이 자리의 답이 아니에요. 빈칸은 ${where}예요.`);
      case 'np':
        if (slot === 'nabs') return no('사람 명사는 셀 수 있어서 관사가 필요하고, 뜻도 맞지 않아요. 일·개념 명사가 와야 해요.');
        if (slot === 'cmpd') return no('사람이 아니라 일·개념을 나타내는 명사가 들어갈 짝이에요.');
        // 나머지는 명사와 같음
      // falls through
      case 'n':
        return no(slot === 'ger' ? '명사는 바로 뒤에 목적어를 가질 수 없어요. 목적어가 있으면 동명사예요.'
          : slot === 'np' ? '단서가 사람을 가리키는데, 이 말은 사람이 아니라 일·개념이에요.'
          : slot === 'adj' ? '명사도 명사를 꾸밀 수 있지만(복합명사), 굳어진 짝이 아니면 형용사가 답이에요.'
          : slot === 'comp' || slot === 'oc' ? '보어 자리의 명사는 주어·목적어와 같은 대상일 때만 써요. 여기는 상태를 말하는 형용사 자리예요.'
          : `명사는 이 자리에 못 와요. 빈칸은 ${where}예요.`);
    }
    return no('이 자리에 맞지 않아요.');
  };

  /* ---------- 빈칸 앞뒤 단서 → 자리 (영상 09장 판정기) ----------
   * left:  det 관사·소유격 | adj 형용사 | link be·remain·become | ocv keep·find + 목적어 | aux have·be(동사 덩어리) | prep 전치사 | verb 일반 동사 | noun 명사
   * right: noun 명사 | prep 전치사 | end 문장 끝 | obj 목적어(명사구) | pp 과거분사·동사 | adj 형용사
   */
  PS.LEFT = { det: '관사·소유격 (a, the, your)', adj: '형용사 (prior, new)', link: 'be · remain · become', ocv: 'keep · find + 목적어', aux: 'have · be (동사 덩어리)', prep: '전치사 (by, for)', verb: '일반 동사 (responded)', noun: '명사 (customer)' };
  PS.RIGHT = { noun: '명사 (increase)', prep: '전치사 (of, to)', end: '문장 끝 (.)', obj: '목적어 (the budget)', pp: '과거분사 (increased, qualified)', adj: '형용사' };
  PS.slotFromCues = function (L, R) {
    if (R === 'pp' || R === 'adj') return 'adv';
    if (L === 'aux') return 'adv';
    if (L === 'prep' && R === 'obj') return 'ger';
    if (L === 'noun' && R === 'noun') return 'cmpd';
    if ((L === 'det' || L === 'adj') && R === 'noun') return 'adj';
    if (L === 'det' || L === 'adj') return 'n';
    if (L === 'link') return 'comp';
    if (L === 'ocv') return 'oc';
    if (L === 'verb') return R === 'obj' || R === 'noun' ? null : 'adv';
    if (L === 'prep') return R === 'noun' ? 'adj' : 'n';
    if (L === 'noun') return R === 'end' || R === 'prep' ? null : null;
    return null;
  };

  /* ---------- 낱말 가족 (영상 01장, 놀이터의 사전) ----------
   * forms: [밑, 꼬리, 품사] — 화면에서 꼬리를 품사 색으로 칠함
   */
  PS.FAMILIES = [
    { id: 'success', ko: [['성공', '하다', 'v'], ['성공', '', 'n'], ['성공', '적인', 'adj'], ['성공', '적으로', 'adv']],
      forms: [['succeed', '', 'v'], ['success', '', 'n'], ['success', 'ful', 'adj'], ['success', 'fully', 'adv']] },
    { id: 'compete', ko: [['경쟁', '하다', 'v'], ['경쟁', '', 'n'], ['경쟁', '자', 'np'], ['경쟁', '력 있는', 'adj'], ['경쟁', '력 있게', 'adv']],
      forms: [['compet', 'e', 'v'], ['compet', 'ition', 'n'], ['compet', 'itor', 'np'], ['compet', 'itive', 'adj'], ['compet', 'itively', 'adv']] },
    { id: 'rely', ko: [['의지', '하다', 'v'], ['의지', '', 'n'], ['믿을', ' 수 있는', 'adj'], ['믿을', ' 수 있게', 'adv']],
      forms: [['rel', 'y', 'v'], ['reli', 'ance', 'n'], ['reli', 'able', 'adj'], ['reli', 'ably', 'adv']] },
    { id: 'apply', ko: [['지원', '하다', 'v'], ['지원', '', 'n'], ['지원', '자', 'np'], ['적용', ' 가능한', 'adj']],
      forms: [['appl', 'y', 'v'], ['applic', 'ation', 'n'], ['applic', 'ant', 'np'], ['applic', 'able', 'adj']] },
  ];
  PS.family = id => PS.FAMILIES.find(f => f.id === id);

  /* ---------- 꼬리표 (영상 02장) ---------- */
  PS.SUFFIX = {
    n: ['-tion', '-ment', '-ness', '-ance', '-ity'],
    np: ['-er', '-or', '-ant', '-ist', '-ee'],
    adj: ['-ive', '-able', '-ful', '-ous', '-al'],
    adv: ['형용사 + -ly'],
    v: ['-ize', '-ify', '-ate', '-en'],
  };
  // 낱말 하나하나의 품사와 꼬리 (영상·직접 해 보기·사전이 함께 씀). trap: 꼬리가 속이는 말
  const W = {};
  const add = (pos, list, trap) => list.forEach(([w, tail]) => { W[w] = { pos, tail, trap: trap || '' }; });
  add('n', [['payment', 'ment'], ['decision', 'sion'], ['kindness', 'ness'], ['reliability', 'ity'], ['success', ''], ['competition', 'ition'], ['reliance', 'ance'], ['application', 'ation'],
    ['renewal', 'al'], ['significance', 'ance'], ['steadiness', 'ness'], ['security', 'ity'], ['consultation', 'ation'], ['satisfaction', 'tion'], ['review', ''], ['quickness', 'ness'],
    ['time', ''], ['timing', 'ing'], ['approval', 'al'], ['height', ''], ['popularity', 'ity'], ['registration', 'tion'], ['persuasion', 'sion'], ['proposal', 'al'], ['instructions', 'tion'],
    ['cooperation', 'tion'], ['safety', 'ty'], ['analysis', 'sis'], ['attraction', 'tion']]);
  add('np', [['employer', 'er'], ['consultant', 'ant'], ['applicant', 'ant'], ['competitor', 'or'], ['reviewer', 'er'], ['registrant', 'ant'], ['representative', 'ive'], ['executive', 'ive'], ['analyst', 'ist'], ['trainer', 'er']]);
  add('adj', [['effective', 'ive'], ['reliable', 'able'], ['careful', 'ful'], ['various', 'ous'], ['successful', 'ful'], ['competitive', 'itive'], ['applicable', 'able'], ['renewable', 'able'],
    ['significant', 'ant'], ['steady', ''], ['secure', ''], ['consultative', 'ive'], ['satisfied', 'ed'], ['quick', ''], ['high', ''], ['popular', 'ar'], ['persuasive', 'ive'],
    ['analytical', 'al'], ['attractive', 'ive'], ['safe', '']]);
  add('adj', [['timely', 'ly'], ['costly', 'ly'], ['friendly', 'ly']], 'ly로 끝나지만 형용사예요(명사 + ly).');
  add('adv', [['effectively', 'ly'], ['carefully', 'ly'], ['successfully', 'ly'], ['competitively', 'ly'], ['reliably', 'ly'], ['significantly', 'ly'], ['steadily', 'ly'], ['securely', 'ly'],
    ['satisfactorily', 'ly'], ['quickly', 'ly'], ['highly', 'ly'], ['popularly', 'ly'], ['persuasively', 'ly'], ['attractively', 'ly'], ['safely', 'ly']]);
  add('v', [['finalize', 'ize'], ['simplify', 'ify'], ['activate', 'ate'], ['succeed', ''], ['compete', ''], ['rely', ''], ['apply', ''], ['renew', ''], ['renewed', 'ed'], ['signify', 'ify'], ['steadied', 'ed'],
    ['secures', 's'], ['consult', ''], ['satisfy', 'ify'], ['reviewed', 'ed'], ['quicken', 'en'], ['timed', 'ed'], ['approve', ''], ['approved', 'ed'], ['heighten', 'en'], ['popularize', 'ize'],
    ['register', ''], ['registered', 'ed'], ['persuade', ''], ['analyze', 'yze'], ['attract', ''], ['train', ''], ['trained', 'ed'], ['save', '']]);
  add('vg', [['reviewing', 'ing'], ['securing', 'ing'], ['approving', 'ing'], ['training', 'ing']]);
  W.approval.trap = W.renewal.trap = W.proposal.trap = 'al로 끝나지만 명사예요(동사 + al).';
  W.representative.trap = W.executive.trap = 'ive로 끝나지만 사람을 뜻하는 명사예요.';
  W.secure.trap = '동사(지키다)로도 쓰지만, 보어 자리에서는 형용사(안전한)예요.';
  PS.WORDS = W;
  PS.word = w => W[String(w).toLowerCase()];

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * opts: [낱말, 품사], slot: 빈칸의 자리, cues: 빈칸 앞뒤 단서(문장 속 글자), root: 낱말 가족 이름
   */
  PS.DRILL = [
    { q: 'The ___ of the service contract must be signed by Friday.', opts: [['renew', 'v'], ['renewable', 'adj'], ['renewal', 'n'], ['renewed', 'v']], a: 2,
      slot: 'n', cues: ['The', 'of'], root: 'renew', tag: '명사 자리 · -al 함정', ko: '서비스 계약의 갱신은 금요일까지 서명되어야 해요.' },
    { q: 'The company reported a ___ increase in quarterly profits.', opts: [['significant', 'adj'], ['significantly', 'adv'], ['significance', 'n'], ['signify', 'v']], a: 0,
      slot: 'adj', cues: ['a', 'increase'], root: 'signify', tag: '명사 앞 형용사', ko: '그 회사는 분기 이익이 크게 늘었다고 발표했어요.' },
    { q: 'Online sales have ___ increased since the website was redesigned.', opts: [['steady', 'adj'], ['steadily', 'adv'], ['steadiness', 'n'], ['steadied', 'v']], a: 1,
      slot: 'adv', cues: ['have', 'increased'], root: 'steady', tag: '부사 · 동사 덩어리 가운데', ko: '웹사이트를 새로 꾸민 뒤로 온라인 판매가 꾸준히 늘었어요.' },
    { q: 'Despite rising costs, our prices remain ___.', opts: [['compete', 'v'], ['competition', 'n'], ['competitively', 'adv'], ['competitive', 'adj']], a: 3,
      slot: 'comp', cues: ['remain'], root: 'compete', tag: '보어 · remain 뒤', ko: '비용이 오르는데도 우리 가격은 여전히 경쟁력이 있어요.' },
    { q: 'Please keep all customer records ___ at all times.', opts: [['securely', 'adv'], ['security', 'n'], ['securing', 'vg'], ['secure', 'adj']], a: 3,
      slot: 'oc', cues: ['keep', 'records'], root: 'secure', tag: '목적격 보어 · keep 뒤', ko: '모든 고객 기록을 언제나 안전하게 보관해 주세요.' },
    { q: 'We plan to hire an experienced ___ to review our tax procedures.', opts: [['consult', 'v'], ['consultant', 'np'], ['consultation', 'n'], ['consultative', 'adj']], a: 1,
      slot: 'np', cues: ['hire', 'experienced'], root: 'consult', tag: '사람 명사 vs 일 명사', ko: '세무 절차를 검토할 경험 많은 컨설턴트를 고용할 계획이에요.' },
    { q: 'Please complete the customer ___ survey by Friday.', opts: [['satisfied', 'adj'], ['satisfy', 'v'], ['satisfaction', 'n'], ['satisfactorily', 'adv']], a: 2,
      slot: 'cmpd', cues: ['customer', 'survey'], root: 'satisfy', tag: '명사 + 명사', ko: '금요일까지 고객 만족도 설문을 작성해 주세요.' },
    { q: 'You can reduce costs by ___ the budget carefully.', opts: [['reviewing', 'vg'], ['review', 'n'], ['reviewer', 'np'], ['reviewed', 'v']], a: 0,
      slot: 'ger', cues: ['by', 'the budget'], root: 'review', tag: '동명사 vs 명사', ko: '예산을 꼼꼼히 검토하면 비용을 줄일 수 있어요.' },
    { q: 'Ms. Ito responded ___ to every customer complaint.', opts: [['quickly', 'adv'], ['quick', 'adj'], ['quicken', 'v'], ['quickness', 'n']], a: 0,
      slot: 'adv', cues: ['responded', 'to'], root: 'quick', tag: '부사 · 동사 뒤', ko: '이토 씨는 모든 고객 불만에 빠르게 응답했어요.' },
    { q: 'Thank you for your ___ response to our inquiry.', opts: [['time', 'n'], ['timely', 'adj'], ['timing', 'n'], ['timed', 'v']], a: 1,
      slot: 'adj', cues: ['your', 'response'], root: 'time', tag: '-ly 형용사 함정', ko: '저희 문의에 제때 답해 주셔서 감사해요.' },
    { q: 'The new policy requires prior ___ from a supervisor.', opts: [['approve', 'v'], ['approving', 'vg'], ['approval', 'n'], ['approved', 'v']], a: 2,
      slot: 'n', cues: ['prior', 'from'], root: 'approve', tag: '형용사 뒤 명사 · -al 함정', ko: '새 정책은 상사의 사전 승인을 요구해요.' },
    { q: 'All applicants for this position must be ___ qualified.', opts: [['high', 'adj'], ['height', 'n'], ['heighten', 'v'], ['highly', 'adv']], a: 3,
      slot: 'adv', cues: ['be', 'qualified'], root: 'high', tag: '부사 · 형용사 앞', ko: '이 자리에 지원하는 사람은 모두 자격을 충분히 갖춰야 해요.' },
    { q: 'The new software has become ___ among small businesses.', opts: [['popular', 'adj'], ['popularity', 'n'], ['popularly', 'adv'], ['popularize', 'v']], a: 0,
      slot: 'comp', cues: ['become'], root: 'popular', tag: '보어 · become 뒤', ko: '새 소프트웨어는 소규모 업체 사이에서 인기를 얻었어요.' },
    { q: 'Each ___ must submit two letters of recommendation.', opts: [['apply', 'v'], ['applicant', 'np'], ['applicable', 'adj'], ['application', 'n']], a: 1,
      slot: 'np', cues: ['Each', 'submit'], root: 'apply', tag: '사람 명사 · -ant', ko: '지원자는 각자 추천서 두 통을 내야 해요.' },
    { q: '___ for the annual conference closes on May 3.', opts: [['Registrant', 'np'], ['Register', 'v'], ['Registration', 'n'], ['Registered', 'v']], a: 2,
      slot: 'nabs', cues: ['for', 'closes'], root: 'register', tag: '일·개념 명사', ko: '연례 학회 등록은 5월 3일에 마감돼요.' },
    { q: 'Ms. Han gave a ___ presentation on the new marketing strategy.', opts: [['persuade', 'v'], ['persuasion', 'n'], ['persuasively', 'adv'], ['persuasive', 'adj']], a: 3,
      slot: 'adj', cues: ['a', 'presentation'], root: 'persuade', tag: '명사 앞 형용사', ko: '한 씨는 새 마케팅 전략에 대해 설득력 있는 발표를 했어요.' },
  ];
  PS.judgeOpt = (it, k) => PS.judge(it.opts[k][1], it.slot);

  // 3단계 풀이 (연습 문제 힌트). ① 보기 ② 자리 ③ 꼬리
  PS.steps = function (it) {
    const S = SLOT[it.slot], ans = it.opts[it.a][0], w = PS.word(ans) || {};
    const b = it.q.indexOf('___'), pre = it.cues.filter(c => it.q.indexOf(c) < b), post = it.cues.filter(c => it.q.indexOf(c) > b);
    const cue = [pre.length ? `빈칸 앞 ‘${pre.join(' … ')}’` : '', post.length ? `${pre.length ? '' : '빈칸 '}뒤 ‘${post.join(' … ')}’` : ''].filter(Boolean).join(', ');
    const cat = PS.slotCat(it.slot), catName = { n: '명사', adj: '형용사', adv: '부사', vg: '동명사' }[cat];
    const tail = it.slot === 'np' ? `사람을 뜻하는 꼬리 -${w.tail} → ${ans}.` : it.slot === 'nabs' ? `일·개념 명사 꼬리 -${w.tail} → ${ans}.`
      : w.tail ? `${catName} 꼬리 -${w.tail} → ${ans}.` : `${ans} → ${catName}.`;
    return [
      { head: '① 보기를 봐요.', text: `보기가 모두 ${it.root} 가족 → 품사 문제. 해석보다 자리를 먼저 봐요.`, marks: [] },
      { head: '② 자리를 봐요.', text: `${cue} → ${S.name} (${S.sign}).`, marks: it.cues.map(t => ({ t, role: 'cue' })) },
      { head: '③ 꼬리를 봐요.', text: tail + (w.trap ? ' ' + w.trap : ''), marks: [] },
    ];
  };
  PS.drillItems = () => PS.DRILL.map(it => ({
    q: it.q, opts: it.opts.map(o => o[0]), a: it.a, ko: it.ko, tag: it.tag, steps: PS.steps(it),
    notes: it.opts.map(([w, pos]) => { const j = PS.judge(pos, it.slot); return `${POS[pos]}. ` + (j.s === 'ok' ? '' : '× ') + j.why; }),
  }));

  /* ---------- 3초 품사 감각 훈련 (놀이터) ---------- */
  PS.GAME = PS.DRILL.map(it => ({ q: it.q, slot: it.slot, cues: it.cues, w: it.opts[it.a][0] })).concat([
    { q: 'Please read the ___ carefully before you sign.', slot: 'n', cues: ['the', 'carefully'], w: 'instructions' },
    { q: 'The new system is ___ efficient.', slot: 'adv', cues: ['is', 'efficient'], w: 'remarkably' },
    { q: 'The hotel offers ___ rates for large groups.', slot: 'adj', cues: ['offers', 'rates'], w: 'reasonable' },
    { q: 'He explained the new process ___.', slot: 'adv', cues: ['process'], w: 'clearly' },
    { q: 'We appreciate your ___ in this matter.', slot: 'n', cues: ['your', 'in'], w: 'cooperation' },
    { q: 'She is responsible for ___ new employees.', slot: 'ger', cues: ['for', 'new employees'], w: 'training' },
    { q: 'The board found the proposal ___.', slot: 'oc', cues: ['found', 'proposal'], w: 'impressive' },
    { q: 'Our customers seem ___ with the new service.', slot: 'comp', cues: ['seem', 'with'], w: 'satisfied' },
  ]);

  // 데이터 점검: 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, 단서가 문장에 있는지, 정답 위치가 고르게 섞였는지
  PS.check = function () {
    const bad = [];
    PS.DRILL.forEach((it, i) => {
      const good = it.opts.map(([, pos], k) => PS.judge(pos, it.slot).s === 'ok' ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`연습 문제 ${i + 1}: 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      it.cues.forEach(c => { if (!it.q.includes(c)) bad.push(`연습 문제 ${i + 1}: 단서 ‘${c}’가 문장에 없어요`); });
      it.opts.forEach(([w, pos]) => { const d = PS.word(w); if (!d || d.pos !== pos) bad.push(`연습 문제 ${i + 1}: 낱말 사전의 ${w} 품사가 달라요`); });
    });
    const pos = [0, 0, 0, 0]; PS.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 2) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    PS.GAME.forEach((g, i) => g.cues.forEach(c => { if (!g.q.includes(c)) bad.push(`감각 훈련 ${i + 1}: 단서 ‘${c}’가 문장에 없어요`); }));
    bad.forEach(b => console.warn('[품사 자리] ' + b));
    return bad;
  };
})();
