/* 동사 자리 · to부정사 · 동명사 튜토리얼 — 규칙 엔진과 예문
 *
 * 이 문제들은 보기가 대개 한 동사의 여러 모양(open · to open · opening · opened)이에요.
 * 답은 ① 진짜 동사(시제가 있는 동사)가 문장에 이미 있나 → ② 빈칸 앞 낱말이 어떤 모양을 고르나 → ③ 빈칸 뒤(목적어·전치사)가 맞나
 * 순서로 정합니다. 영상의 ✓·×, 직접 해 보기, 놀이터(동사 옷 입히기), 연습 문제, 퀴즈가 모두 judge()로 정답을 정하고,
 * 문제 데이터에 적은 정답이 judge()와 다르면 콘솔에 경고를 냅니다.
 *
 * 모양(f):   fin 진짜 동사(시제가 있음: launched, discusses) · base 동사원형 · to to부정사 · ing -ing 꼴(동명사·현재분사) · pp 과거분사 · n 명사
 * 자리(slot): { eng, gov, by, at, main, obj }
 *   eng  'empty' 문장에 진짜 동사가 없음 → 빈칸이 진짜 동사(또는 조동사·Please 뒤 원형) 자리
 *        'full'  진짜 동사가 이미 있음(main) → 빈칸은 진짜 동사가 아닌 자리
 *   gov  빈칸 앞에서 모양을 고르는 말
 *        subj 주어 · modal 조동사 · please Please(명령문) · v 동사(by가 고름) · prep 전치사 · adj 형용사 · n 명사
 *        vo 동사 + 목적어(by가 고름) · noun 명사를 꾸미는 자리(-ing) · purpose 목적(~하려고)
 *   by   모양을 고르는 낱말의 사전형 (consider, eligible, encourage …), at: 문장에 보이는 그대로 (considering)
 *   obj  빈칸 뒤: 'direct' 목적어가 바로 옴 · 'to' 'with' 'in' 'for' … 전치사가 옴 · 없으면 검사하지 않음
 * judge({ w, f, v }, slot) → { s: 'ok' | 'no', why, step }   step: 틀린 까닭이 드러나는 단계 (1 진짜 동사 · 2 앞 · 3 뒤)
 */
(function () {
  'use strict';
  const IG = (window.IG = {});

  const FORM = { fin: '진짜 동사', base: '동사원형', to: 'to부정사', ing: '-ing 꼴', pp: '과거분사', n: '명사' };
  const NEED = { fin: '시제가 있는 진짜 동사', base: '동사원형', to: 'to부정사(to + 동사원형)', ing: '-ing 꼴' };
  IG.FORM = FORM; IG.NEED = NEED;

  /* ---------- 동사 사전 ----------
   * [원형, -ing, take(뒤에 동사가 올 때 고르는 모양), vo(목적어 뒤에 고르는 모양), obj(목적어를 잡는 법), 뜻, 예]
   *   take: 'to' | 'ing' | ''     vo: 'to' | 'base' | ''     obj: 'direct' 바로 잡음 | 'to' 'with' 'in' 'about' 'for' 'on' 'at' 전치사와 짝 | '' 상관없음
   */
  const VERB = {};
  [
    // 뒤에 to부정사를 고르는 동사 (앞으로 할 일을 가리키는 경우가 많음)
    ['decide', 'deciding', 'to', '', '', '결정하다', 'decided to move'],
    ['plan', 'planning', 'to', '', 'direct', '계획하다', 'plan to hire'],
    ['agree', 'agreeing', 'to', '', '', '동의하다', 'agreed to help'],
    ['hope', 'hoping', 'to', '', '', '바라다', 'hope to see you'],
    ['expect', 'expecting', 'to', 'to', 'direct', '예상하다', 'expect to finish'],
    ['aim', 'aiming', 'to', '', '', '목표로 하다', 'aim to reduce costs'],
    ['intend', 'intending', 'to', '', '', '~할 작정이다', 'intend to expand'],
    ['refuse', 'refusing', 'to', '', 'direct', '거절하다', 'refused to sign'],
    ['offer', 'offering', 'to', '', 'direct', '제안하다', 'offered to drive'],
    ['want', 'wanting', 'to', 'to', 'direct', '원하다', 'want to join'],
    ['promise', 'promising', 'to', '', 'direct', '약속하다', 'promised to call'],
    ['fail', 'failing', 'to', '', '', '~하지 못하다', 'failed to arrive'],
    ['manage', 'managing', 'to', '', 'direct', '해내다', 'managed to finish'],
    // 뒤에 -ing 꼴을 고르는 동사 (이미 떠올린 일 · 하던 일 · 피하는 일이 많지만, 경향일 뿐)
    ['consider', 'considering', 'ing', '', 'direct', '검토하다', 'consider opening'],
    ['avoid', 'avoiding', 'ing', '', 'direct', '피하다', 'avoid making mistakes'],
    ['suggest', 'suggesting', 'ing', '', 'direct', '제안하다', 'suggested using less paper'],
    ['recommend', 'recommending', 'ing', '', 'direct', '권하다', 'recommend booking early'],
    ['finish', 'finishing', 'ing', '', 'direct', '끝내다', 'finished writing'],
    ['postpone', 'postponing', 'ing', '', 'direct', '미루다', 'postpone signing'],
    ['mind', 'minding', 'ing', '', 'direct', '꺼리다', "Would you mind waiting?"],
    ['enjoy', 'enjoying', 'ing', '', 'direct', '즐기다', 'enjoy working here'],
    ['deny', 'denying', 'ing', '', 'direct', '부인하다', 'denied making the error'],
    ['delay', 'delaying', 'ing', '', 'direct', '늦추다', 'delay launching'],
    ['keep', 'keeping', 'ing', '', 'direct', '계속하다', 'keep trying'],
    // 목적어 + to부정사
    ['ask', 'asking', 'to', 'to', 'direct', '부탁하다', 'asked us to wait'],
    ['encourage', 'encouraging', '', 'to', 'direct', '권하다', 'encourage employees to attend'],
    ['allow', 'allowing', '', 'to', 'direct', '허락하다', 'allow visitors to enter'],
    ['require', 'requiring', '', 'to', 'direct', '요구하다', 'require staff to wear badges'],
    ['enable', 'enabling', '', 'to', 'direct', '할 수 있게 하다', 'enable users to share files'],
    ['remind', 'reminding', '', 'to', 'direct', '다시 알려 주다', 'remind the team to submit'],
    ['advise', 'advising', '', 'to', 'direct', '조언하다', 'advise guests to arrive early'],
    ['invite', 'inviting', '', 'to', 'direct', '초대하다', 'invite you to join'],
    ['urge', 'urging', '', 'to', 'direct', '촉구하다', 'urge drivers to slow down'],
    // 목적어 + 동사원형 (사역동사)
    ['make', 'making', '', 'base', 'direct', '~하게 만들다', 'made us wait'],
    ['have', 'having', '', 'base', 'direct', '~하게 하다', 'had the interns prepare the slides'],
    ['let', 'letting', '', 'base', 'direct', '~하게 두다', 'let us know'],
    // 목적어를 바로 잡는 동사 (타동사) — 한국어 ‘~에 대해 · ~에’에 속기 쉬움
    ['discuss', 'discussing', 'ing', '', 'direct', '논의하다', 'discuss the issue'],
    ['attend', 'attending', '', '', 'direct', '참석하다', 'attend the meeting'],
    ['contact', 'contacting', '', '', 'direct', '연락하다', 'contact the client'],
    ['reach', 'reaching', '', '', 'direct', '닿다 · 연락이 되다', 'reach the station'],
    ['enter', 'entering', '', '', 'direct', '들어가다', 'enter the building'],
    ['mention', 'mentioning', 'ing', '', 'direct', '언급하다', 'mention the delay'],
    ['approach', 'approaching', '', '', 'direct', '다가가다', 'approach the desk'],
    ['answer', 'answering', '', '', 'direct', '답하다', 'answer the phone'],
    ['address', 'addressing', '', '', 'direct', '다루다', 'address the problem'],
    ['follow', 'following', '', '', 'direct', '따르다', 'follow the rules'],
    ['obey', 'obeying', '', '', 'direct', '지키다', 'obey the law'],
    ['observe', 'observing', '', '', 'direct', '지키다 · 관찰하다', 'observe the guidelines'],
    // 전치사와 짝인 동사 (자동사)
    ['respond', 'responding', '', '', 'to', '답하다', 'respond to inquiries'],
    ['reply', 'replying', '', '', 'to', '답장하다', 'reply to the e-mail'],
    ['comply', 'complying', '', '', 'with', '따르다', 'comply with the rules'],
    ['participate', 'participating', '', '', 'in', '참가하다', 'participate in the event'],
    ['talk', 'talking', '', '', 'about', '이야기하다', 'talk about the plan'],
    ['speak', 'speaking', '', '', 'about', '말하다', 'speak about the plan'],
    ['comment', 'commenting', '', '', 'on', '의견을 말하다', 'comment on the proposal'],
    ['listen', 'listening', '', '', 'to', '듣다', 'listen to the speech'],
    ['apologize', 'apologizing', '', '', 'for', '사과하다', 'apologize for the delay'],
    ['go', 'going', '', '', 'to', '가다', 'go to the fair'],
    ['arrive', 'arriving', '', '', 'at', '도착하다', 'arrive at the hotel'],
    ['apply', 'applying', '', '', 'for', '지원하다', 'apply for the program'],
    ['register', 'registering', '', '', 'for', '등록하다', 'register for the course'],
    ['work', 'working', '', '', '', '일하다', 'work with you'],
    // 그 밖에 예문에 나오는 동사
    ['open', 'opening', '', '', 'direct', '열다', 'open a branch'],
    ['move', 'moving', '', '', 'direct', '옮기다', 'move the office'],
    ['complete', 'completing', '', '', 'direct', '작성하다 · 끝내다', 'complete the form'],
    ['launch', 'launching', '', '', 'direct', '시작하다', 'launch a campaign'],
    ['meet', 'meeting', '', '', 'direct', '만나다 · 맞추다', 'meet the deadline'],
    ['improve', 'improving', '', '', 'direct', '개선하다', 'improve the service'],
    ['share', 'sharing', '', '', 'direct', '공유하다', 'share files'],
    ['know', 'knowing', '', '', '', '알다', 'let us know'],
    ['receive', 'receiving', '', '', 'direct', '받다', 'receive a manual'],
    ['prepare', 'preparing', '', '', 'direct', '준비하다', 'prepare the slides'],
    ['use', 'using', '', '', 'direct', '쓰다', 'use less paper'],
    ['reduce', 'reducing', '', '', 'direct', '줄이다', 'reduce costs'],
    ['submit', 'submitting', '', '', 'direct', '내다', 'submit the report'],
    ['leave', 'leaving', '', '', '', '떠나다', 'leave early'],
    ['increase', 'increasing', '', '', '', '늘다', 'likely to increase'],
    ['book', 'booking', '', '', 'direct', '예약하다', 'book the hotel'],
    ['be', 'being', '', '', '', '~이다', 'be eligible'],
  ].forEach(([v, ing, take, vo, obj, ko, ex]) => { VERB[v] = { v, ing, take, vo, obj, ko, ex }; });
  IG.VERB = VERB;
  IG.verb = v => VERB[String(v).toLowerCase()];
  // 한 동사의 네 모양 (놀이터·직접 해 보기). fin은 문장마다 달라서 따로 받음
  IG.formsOf = (v, fin) => ({ fin: fin || v + 'ed', base: v, to: 'to ' + v, ing: VERB[v] ? VERB[v].ing : v + 'ing' });

  /* ---------- 형용사 · 명사 + to부정사 ---------- */
  const ADJ = { eligible: '자격이 있는', able: '할 수 있는', likely: '~할 것 같은', willing: '기꺼이 ~하는', ready: '준비가 된', pleased: '기쁜' };
  const NOUN = { ability: '능력', effort: '노력', plan: '계획', opportunity: '기회', decision: '결정', chance: '기회' };
  IG.ADJ = ADJ; IG.NOUN = NOUN;

  /* ---------- to가 전치사인 표현 (뒤에 -ing 꼴) ---------- */
  IG.PREP_TO = [
    { e: 'look forward to', ko: '~하기를 고대하다', ex: 'We look forward to meeting you.', noun: 'look forward to the meeting' },
    { e: 'be committed to', ko: '~하는 데 힘쓰다', ex: 'We are committed to improving our service.', noun: 'be committed to quality' },
    { e: 'be dedicated to', ko: '~하는 데 몸 바치다', ex: 'She is dedicated to helping customers.', noun: 'be dedicated to her work' },
    { e: 'contribute to', ko: '~하는 데 이바지하다', ex: 'These changes will contribute to reducing costs.', noun: 'contribute to the project' },
    { e: 'object to', ko: '~하는 것에 반대하다', ex: 'Some residents object to building a new road.', noun: 'object to the plan' },
    { e: 'be used to', ko: '~하는 데 익숙하다', ex: 'I am used to working late.', noun: 'be used to the noise' },
  ];
  // 비교용: to부정사의 to (뒤에 명사를 넣으면 말이 안 됨)
  IG.INF_TO = [
    { e: 'hope to', ko: '~하기를 바라다', ex: 'We hope to meet you soon.', noun: 'hope to the meeting' },
    { e: 'plan to', ko: '~할 계획이다', ex: 'We plan to open a new branch.', noun: 'plan to the branch' },
  ];
  IG.toExpr = e => IG.PREP_TO.concat(IG.INF_TO).find(x => x.e === e);
  IG.isPrepTo = e => IG.PREP_TO.some(x => x.e === e);

  /* ---------- 빈칸 앞 낱말 → 필요한 모양 ---------- */
  const GOV = {
    subj: { name: '주어 뒤', sign: '문장에 진짜 동사가 없음' },
    modal: { name: '조동사 뒤', sign: 'will · must · can · should 뒤' },
    please: { name: 'Please 뒤', sign: 'Please · 명령문 맨 앞' },
    v: { name: '동사 뒤', sign: '앞 동사가 모양을 고름' },
    prep: { name: '전치사 뒤', sign: 'to · by · for 같은 전치사 뒤' },
    adj: { name: '형용사 뒤', sign: 'be eligible · able · likely' },
    n: { name: '명사 뒤', sign: 'the ability · effort · plan' },
    vo: { name: '동사 + 목적어 뒤', sign: 'encourage · ask · let + 목적어' },
    noun: { name: '명사를 꾸미는 자리', sign: '진짜 동사는 따로 있음' },
    purpose: { name: '목적 (~하려고)', sign: '진짜 동사는 따로 있음' },
  };
  IG.GOV = GOV;
  IG.need = function (slot) {
    switch (slot.gov) {
      case 'subj': return 'fin';
      case 'modal': case 'please': return 'base';
      case 'v': return (VERB[slot.by] || {}).take || '';
      case 'vo': return (VERB[slot.by] || {}).vo || '';
      case 'prep': return 'ing';
      case 'adj': return ADJ[slot.by] ? 'to' : '';
      case 'n': return NOUN[slot.by] ? 'to' : '';
      case 'noun': return 'ing';
      case 'purpose': return 'to';
    }
    return '';
  };
  // 진짜 동사를 셀 때: 이 자리의 원형이 진짜 동사 하나로 세어지나 (조동사 뒤 · 사역동사 뒤 · 전치사 to 뒤 원형은 따로 세지 않음)
  IG.baseCounts = slot => !(slot.gov === 'modal' || slot.gov === 'prep' || (slot.gov === 'vo' && IG.need(slot) === 'base'));

  /* ---------- 판정 ---------- */
  const ok = (why) => ({ s: 'ok', why, step: 3 }), no = (step, why) => ({ s: 'no', why, step });
  function why2(o, slot, need) {
    const at = slot.at || slot.by, by = slot.by;
    switch (slot.gov) {
      case 'subj': return '주어 뒤 진짜 동사 자리 → 시제가 드러나는 꼴(is · -s · -ed)이 와야 해요. 원형은 조동사 · Please 뒤에 써요.';
      case 'modal': return `조동사 ${at} 뒤 → 동사원형. 시제를 붙인 꼴은 못 와요.`;
      case 'please': return 'Please 뒤 → 동사원형. 시제를 붙인 꼴은 못 와요.';
      case 'v': return (need === 'ing' ? `${by} → 뒤에 -ing 꼴을 골라요.` : `${by} → 뒤에 to부정사를 골라요.`) + (o.f === 'to' ? ` (${by} to ×)` : o.f === 'ing' ? ` (${by} -ing ×)` : '');
      case 'prep': return o.f === 'base' && /to$/.test(at) ? `${at} → 여기서 to = 전치사. 전치사 뒤의 동사는 -ing 꼴.` : `전치사 ${at} 뒤 → -ing 꼴. to부정사는 못 와요.`;
      case 'adj': return `be ${by} → 뒤에 to부정사를 써요. (be ${by} to + 원형)`;
      case 'n': return `명사 ${by} → 뒤에서 to부정사가 꾸며요. (the ${by} to + 원형)`;
      case 'vo': return need === 'base' ? `${by} + 목적어 → to 없이 동사원형.` : `${by} + 목적어 → to부정사. to 없는 원형은 make · have · let 뒤에만 와요.`;
      case 'noun': return '명사 뒤에서 ‘~하는’으로 꾸밀 때 → -ing 꼴.';
      case 'purpose': return '‘~하려고’(목적) → to부정사.';
    }
    return '이 자리에 맞지 않아요.';
  }
  function okWhy(o, slot, need) {
    const at = slot.at || slot.by, by = slot.by;
    switch (slot.gov) {
      case 'subj': return '문장에 진짜 동사가 없어요 → 시제가 있는 동사가 들어가요.';
      case 'modal': return `조동사 ${at} 뒤 → 동사원형.`;
      case 'please': return 'Please 뒤 → 동사원형 (명령문의 진짜 동사).';
      case 'v': return `${by} → 뒤에 ${NEED[need]}.`;
      case 'prep': return /to$/.test(at) ? `${at} → to = 전치사, 뒤에 -ing 꼴.` : `전치사 ${at} 뒤 → -ing 꼴.`;
      case 'adj': return `be ${by} + to부정사 (${ADJ[by]}).`;
      case 'n': return `the ${by} + to부정사 (~할 ${NOUN[by]}).`;
      case 'vo': return `${by} + 목적어 + ${need === 'base' ? '동사원형' : 'to부정사'}.`;
      case 'noun': return `진짜 동사는 ${slot.main} 하나 → -ing 꼴로 앞 명사를 꾸며요 (~하는).`;
      case 'purpose': return `진짜 동사는 ${slot.main} 하나 → to부정사 = ~하려고 (목적).`;
    }
    return '맞아요.';
  }
  IG.judge = function (o, slot) {
    const need = IG.need(slot), V = VERB[o.v] || {};
    // ① 진짜 동사
    if (slot.eng === 'empty') {
      const tail = slot.gov === 'modal' ? '조동사 + 동사원형이라야 진짜 동사가 돼요.' : slot.gov === 'please' ? 'Please 뒤에는 동사원형이 명령문의 진짜 동사예요.' : '이 문장에는 진짜 동사가 없어요.';
      if (o.f === 'to' || o.f === 'ing') return no(1, `${FORM[o.f]} → 시제가 없어 진짜 동사가 못 돼요. ${tail}`);
      if (o.f === 'pp') return no(1, `과거분사 혼자서는 진짜 동사가 못 돼요. ${tail}`);
      if (o.f === 'n') return no(1, `명사는 진짜 동사 자리에 못 와요. ${tail}`);
    } else {
      if (o.f === 'fin') return no(1, `진짜 동사는 이미 있어요 → ${slot.main}. 접속사 없이 하나 더 쓸 수 없어요.`);
      // 모양을 바꾸지 않은 원형은 진짜 동사가 하나 더 생긴 것 (원형을 고르는 make · have · let 뒤, to가 전치사인 자리는 ②에서 가름)
      if (o.f === 'base' && need !== 'base' && slot.gov !== 'prep') return no(1, `모양을 바꾸지 않은 원형 → 진짜 동사가 하나 더 생겨요. 진짜 동사는 ${slot.main} 하나뿐이어야 해요.` + (slot.gov === 'vo' ? ' 목적어 뒤 원형은 make · have · let 뒤에만 와요.' : ''));
    }
    // ② 앞: 명사는 전치사 뒤에 올 수 있어서 ③에서 가름
    if (o.f !== need && !(o.f === 'n' && slot.gov === 'prep')) return no(2, why2(o, slot, need));
    // ③ 뒤
    if (o.f === 'n') return slot.obj === 'direct' ? no(3, '명사는 뒤에 목적어를 바로 가질 수 없어요. 목적어가 있으면 -ing 꼴.') : ok('전치사 뒤 명사.');
    if (slot.obj && V.obj) {
      if (slot.obj === 'direct' && V.obj !== 'direct') return no(3, `${o.v} → 목적어를 바로 잡지 못해요. ${o.v} ${V.obj} + 명사.`);
      if (slot.obj !== 'direct' && V.obj === 'direct') return no(3, `${o.v} → 전치사 없이 목적어를 바로 잡아요. (${o.v} ${slot.obj} ×)`);
      if (slot.obj !== 'direct' && V.obj !== slot.obj) return no(3, `${o.v} → 짝 전치사는 ${V.obj}. 빈칸 뒤 전치사와 맞지 않아요.`);
    }
    let why = okWhy(o, slot, need);
    if (slot.obj && V.obj === slot.obj) why += slot.obj === 'direct' ? ` ${o.v} → 목적어를 바로 잡아요.` : ` ${o.v} + ${slot.obj} → 짝이 맞아요.`;
    return ok(why);
  };
  IG.isOk = (o, slot) => IG.judge(o, slot).s === 'ok';

  // 접속사(연결어) 없이 이을 수 있는 진짜 동사는 하나: 진짜 동사 수 ≤ 연결어 수 + 1
  IG.clauseOk = (fin, links) => fin >= 1 && fin <= links + 1;

  /* ---------- 빈칸 앞뒤 단서 → 모양 (영상 09장 판정기) ---------- */
  IG.EN = { none: '없음 (주어 · 조동사 · Please 뒤)', one: '이미 있음' };
  IG.LEFT = {
    subj: '주어 (The team ___)', modal: '조동사 · Please (must ___, Please ___)',
    vto: 'decide · plan · hope · agree', ving: 'consider · avoid · suggest · recommend', prep: '전치사 (look forward to · by · for)',
    adjn: '형용사 · 명사 (eligible · ability)', voto: 'ask · encourage · allow + 목적어', caus: 'make · have · let + 목적어', noun: '주어 명사 (Staff ___ … will)',
  };
  IG.RIGHT = { direct: '목적어 (the issue)', prep: '전치사 (to · with · in)', other: '그 밖 (문장 끝 · 부사)' };
  const LEFT_SLOT = {
    subj: { gov: 'subj' }, modal: { gov: 'modal', by: 'will' }, vto: { gov: 'v', by: 'decide' }, ving: { gov: 'v', by: 'consider' }, prep: { gov: 'prep', by: 'to' },
    adjn: { gov: 'adj', by: 'eligible' }, voto: { gov: 'vo', by: 'encourage' }, caus: { gov: 'vo', by: 'let' }, noun: { gov: 'noun' },
  };
  IG.LEFT_EMPTY = ['subj', 'modal'];
  // E: none | one, L: LEFT 키 → { form, slot } 또는 { bad: 까닭 }
  IG.formFromCues = function (E, L) {
    if (!E || !L) return null;
    const empty = IG.LEFT_EMPTY.includes(L);
    if (E === 'none' && !empty) return { bad: '진짜 동사가 없는데 빈칸 앞이 동사·형용사예요. 그 낱말이 진짜 동사(또는 be + 형용사)인지 다시 보세요.' };
    if (E === 'one' && empty) return { bad: '진짜 동사가 이미 있으면, 주어나 조동사 바로 뒤가 빈칸일 수 없어요. 빈칸 앞 낱말을 다시 보세요.' };
    const slot = Object.assign({ eng: empty ? 'empty' : 'full' }, LEFT_SLOT[L]);
    return { form: IG.need(slot), slot };
  };
  IG.objAdvice = R => R === 'direct' ? '목적어를 바로 잡는 동사(타동사) — discuss · attend · contact' : R === 'prep' ? '그 전치사와 짝인 동사(자동사) — respond to · comply with · participate in' : '목적어 검사 없음';

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * opts: [보기, 모양, 동사], slot: 위의 자리, at: 빈칸 앞 낱말(문장 속 글자), main: 진짜 동사(문장 속 글자), back: 빈칸 뒤(문장 속 글자)
   */
  const D = (q, opts, a, slot, tag, ko, back) => ({ q, opts, a, slot, tag, ko, back });
  IG.DRILL = [
    D('Please ___ the attached form by Friday.',
      [['completing', 'ing', 'complete'], ['to complete', 'to', 'complete'], ['completion', 'n', 'complete'], ['complete', 'base', 'complete']], 3,
      { eng: 'empty', gov: 'please', at: 'Please', obj: 'direct' }, '동사 자리 · Please + 원형', '첨부한 양식을 금요일까지 작성해 주세요.', 'the attached form'),
    D('The marketing team ___ a new advertising campaign last month.',
      [['launching', 'ing', 'launch'], ['launched', 'fin', 'launch'], ['to launch', 'to', 'launch'], ['having launched', 'ing', 'launch']], 1,
      { eng: 'empty', gov: 'subj', at: 'The marketing team', obj: 'direct' }, '동사 자리 · 진짜 동사가 없음', '마케팅팀은 지난달 새 광고 캠페인을 시작했어요.', 'a new advertising campaign'),
    D('All visitors must ___ at the front desk before entering the building.',
      [['register', 'base', 'register'], ['registering', 'ing', 'register'], ['registration', 'n', 'register'], ['registered', 'fin', 'register']], 0,
      { eng: 'empty', gov: 'modal', at: 'must' }, '동사 자리 · 조동사 + 원형', '모든 방문객은 건물에 들어가기 전에 안내 데스크에서 등록해야 해요.'),
    D('Staff ___ the safety seminar will receive a training certificate.',
      [['attends', 'fin', 'attend'], ['attend', 'base', 'attend'], ['attending', 'ing', 'attend'], ['have attended', 'fin', 'attend']], 2,
      { eng: 'full', gov: 'noun', at: 'Staff', main: 'will receive', obj: 'direct' }, '동사가 둘 → -ing 꼴로 꾸미기', '안전 세미나에 참석하는 직원은 교육 수료증을 받아요.', 'the safety seminar'),
    D('___ the project deadline, the design team worked through the weekend.',
      [['To meet', 'to', 'meet'], ['Meet', 'base', 'meet'], ['Met', 'fin', 'meet'], ['Meets', 'fin', 'meet']], 0,
      { eng: 'full', gov: 'purpose', main: 'worked', obj: 'direct' }, '동사가 둘 → 목적의 to부정사', '프로젝트 마감을 맞추려고 디자인팀은 주말 내내 일했어요.', 'the project deadline'),
    D("The committee will ___ the budget proposal at tomorrow's meeting.",
      [['talk', 'base', 'talk'], ['comment', 'base', 'comment'], ['discuss', 'base', 'discuss'], ['respond', 'base', 'respond']], 2,
      { eng: 'empty', gov: 'modal', at: 'will', obj: 'direct' }, '타동사 · discuss (about ×)', '위원회는 내일 회의에서 예산안을 논의할 거예요.', 'the budget proposal'),
    D('Please ___ to customer inquiries within 24 hours.',
      [['answer', 'base', 'answer'], ['respond', 'base', 'respond'], ['contact', 'base', 'contact'], ['address', 'base', 'address']], 1,
      { eng: 'empty', gov: 'please', at: 'Please', obj: 'to' }, '자동사 + 전치사 · respond to', '고객 문의에는 24시간 안에 답해 주세요.', 'to'),
    D('Mr. Tanaka will ___ the trade fair in Shanghai next month.',
      [['participate', 'base', 'participate'], ['go', 'base', 'go'], ['arrive', 'base', 'arrive'], ['attend', 'base', 'attend']], 3,
      { eng: 'empty', gov: 'modal', at: 'will', obj: 'direct' }, '타동사 · attend (참석하다)', '다나카 씨는 다음 달 상하이 무역 박람회에 참석해요.', 'the trade fair'),
    D('We are considering ___ a new branch in Busan.',
      [['open', 'base', 'open'], ['to open', 'to', 'open'], ['opening', 'ing', 'open'], ['opened', 'fin', 'open']], 2,
      { eng: 'full', gov: 'v', by: 'consider', at: 'considering', main: 'are considering', obj: 'direct' }, 'consider + -ing', '부산에 새 지점을 여는 것을 검토하고 있어요.', 'a new branch'),
    D('The company has decided ___ its headquarters to Daejeon.',
      [['moving', 'ing', 'move'], ['to move', 'to', 'move'], ['moved', 'fin', 'move'], ['move', 'base', 'move']], 1,
      { eng: 'full', gov: 'v', by: 'decide', at: 'decided', main: 'has decided', obj: 'direct' }, 'decide + to부정사', '그 회사는 본사를 대전으로 옮기기로 했어요.', 'its headquarters'),
    D('We look forward to ___ with you on the new project.',
      [['work', 'base', 'work'], ['worked', 'fin', 'work'], ['works', 'fin', 'work'], ['working', 'ing', 'work']], 3,
      { eng: 'full', gov: 'prep', by: 'look forward to', at: 'look forward to', main: 'look' }, '전치사 to + -ing', '새 프로젝트에서 함께 일하기를 고대하고 있어요.'),
    D('Our company is committed to ___ the quality of its customer service.',
      [['improving', 'ing', 'improve'], ['improve', 'base', 'improve'], ['improved', 'fin', 'improve'], ['improvement', 'n', 'improve']], 0,
      { eng: 'full', gov: 'prep', by: 'be committed to', at: 'committed to', main: 'is', obj: 'direct' }, '전치사 to + -ing · 명사 함정', '우리 회사는 고객 서비스의 질을 높이는 데 힘쓰고 있어요.', 'the quality'),
    D('Full-time employees are eligible ___ for the leadership program.',
      [['apply', 'base', 'apply'], ['applying', 'ing', 'apply'], ['applied', 'fin', 'apply'], ['to apply', 'to', 'apply']], 3,
      { eng: 'full', gov: 'adj', by: 'eligible', at: 'eligible', main: 'are', obj: 'for' }, '형용사 + to부정사', '정규직 직원은 리더십 프로그램에 지원할 자격이 있어요.', 'for'),
    D('The new software gives users the ability ___ files instantly.',
      [['share', 'base', 'share'], ['to share', 'to', 'share'], ['sharing', 'ing', 'share'], ['shared', 'fin', 'share']], 1,
      { eng: 'full', gov: 'n', by: 'ability', at: 'ability', main: 'gives', obj: 'direct' }, '명사 + to부정사', '새 소프트웨어 덕분에 사용자는 파일을 바로 공유할 수 있어요.', 'files'),
    D('We encourage all employees ___ the free health workshop.',
      [['to attend', 'to', 'attend'], ['attend', 'base', 'attend'], ['attending', 'ing', 'attend'], ['attended', 'fin', 'attend']], 0,
      { eng: 'full', gov: 'vo', by: 'encourage', at: 'encourage all employees', main: 'encourage', obj: 'direct' }, '목적어 + to부정사', '모든 직원이 무료 건강 워크숍에 참석하기를 권해요.', 'the free health workshop'),
    D('Please let us ___ if you have any questions about your order.',
      [['knowing', 'ing', 'know'], ['to know', 'to', 'know'], ['know', 'base', 'know'], ['known', 'pp', 'know']], 2,
      { eng: 'full', gov: 'vo', by: 'let', at: 'let us', main: 'let' }, '사역동사 + 목적어 + 원형', '주문에 대해 궁금한 점이 있으면 알려 주세요.'),
  ];
  const optOf = (it, k) => ({ w: it.opts[k][0], f: it.opts[k][1], v: it.opts[k][2] });
  IG.optOf = optOf;
  IG.judgeOpt = (it, k) => IG.judge(optOf(it, k), it.slot);
  IG.fail = (it, k) => { const j = IG.judgeOpt(it, k); return j.s === 'ok' ? 0 : j.step; };

  // 3단계 풀이 (연습 문제 힌트). ① 진짜 동사 ② 앞 ③ 뒤
  IG.steps = function (it) {
    const sl = it.slot, need = IG.need(sl), ans = it.opts[it.a][0], at = sl.at, by = sl.by;
    const gone = s => it.opts.filter((o, k) => IG.fail(it, k) === s).map(o => `${o[0]}(${FORM[o[1]]})`);
    const tail = g => g.length ? ` 지울 보기: ${g.join(', ')}.` : ' 이 단계에서 지울 보기는 없어요.';
    const g1 = gone(1), g2 = gone(2), g3 = gone(3);
    let s1, m1 = [];
    if (sl.eng === 'empty') {
      s1 = sl.gov === 'modal' ? `조동사 ${at}만 있고 동사가 비었어요 → 조동사 + 빈칸 = 진짜 동사 하나.`
        : sl.gov === 'please' ? 'Please 뒤에 동사가 비었어요 → 빈칸이 명령문의 진짜 동사.'
          : '문장에 시제가 있는 진짜 동사가 없어요 → 빈칸이 진짜 동사 자리.';
      if (sl.gov !== 'subj') m1 = [{ t: at, role: 'verb' }];
    } else {
      s1 = `진짜 동사 → ${sl.main}. 빈칸은 진짜 동사가 아닌 자리예요.`;
      m1 = [{ t: sl.main, role: 'verb' }];
    }
    s1 += tail(g1);
    const S2 = {
      subj: '주어 바로 뒤 → 시제가 있는 꼴.',
      modal: `빈칸 앞 → ${at}. 조동사 뒤는 동사원형 자리예요.`,
      please: '빈칸 앞 → Please. 그 뒤는 동사원형 자리예요.',
      v: `빈칸 앞 → ${at}. ${by} → 뒤에 ${NEED[need]}.`,
      prep: `빈칸 앞 → ${at}. 전치사 뒤의 동사 → -ing 꼴.` + (/to$/.test(at || '') ? ' to 뒤에 명사를 넣어도 말이 돼요 → to = 전치사.' : ''),
      adj: `빈칸 앞 → 형용사 ${by}. be ${by} 뒤에 to부정사.`,
      n: `빈칸 앞 → 명사 ${by}. 명사 뒤에서 to부정사가 꾸며요.`,
      vo: `빈칸 앞 → ${at} (동사 + 목적어). ${by} + 목적어 → ${need === 'base' ? '동사원형' : 'to부정사'}.`,
      noun: `빈칸 앞 → 명사 ${at}. 진짜 동사가 따로 있으니 ‘~하는’으로 꾸미는 -ing 꼴.`,
      purpose: '빈칸이 문장 맨 앞, 쉼표 뒤에 완전한 문장 → ‘~하려고’(목적). to부정사.',
    };
    const s2 = S2[sl.gov] + tail(g2);
    const m2 = at && !['subj', 'modal', 'please'].includes(sl.gov) ? [{ t: at, role: 'cue' }] : [];
    let s3, m3 = [];
    if (it.back) {
      m3 = [{ t: it.back, role: 'ante' }];
      s3 = sl.obj === 'direct' ? `빈칸 뒤 → 목적어 ${it.back}. 목적어를 바로 잡는 말이 와요.` : `빈칸 뒤 → 전치사 ${sl.obj}. 이 전치사와 짝인 동사가 와요.`;
      if (g3.length) s3 += ` 지울 보기: ${g3.join(', ')}.`;
      s3 += ` 정답 → ${ans}.`;
    } else s3 = `빈칸 뒤에 걸리는 목적어는 없어요. 남은 보기 → ${ans}.`;
    return [
      { head: '① 진짜 동사를 세요.', text: s1, marks: m1 },
      { head: '② 앞을 봐요.', text: s2, marks: m2 },
      { head: '③ 뒤를 확인해요.', text: s3, marks: m3 },
    ];
  };
  IG.drillItems = () => IG.DRILL.map(it => ({
    q: it.q, opts: it.opts.map(o => o[0]), a: it.a, ko: it.ko, tag: it.tag, steps: IG.steps(it),
    notes: it.opts.map((o, k) => { const j = IG.judgeOpt(it, k); return `${FORM[o[1]]}. ` + (j.s === 'ok' ? '' : '× ') + j.why; }),
  }));

  /* ---------- 놀이터: 동사 옷 입히기 ----------
   * 문장 속 동사가 모두 사전형(원형)으로 들어 있어요. 동사마다 네 가지 옷(진짜 동사 · 원형 · to부정사 · -ing 꼴)을 입혀
   * 진짜 동사를 하나만 남기고, 앞 낱말이 고른 모양을 맞추고, 전치사를 넣거나 빼서 문장을 완성해요.
   * parts: 글자 | { v: 동사, fin: 진짜 동사 꼴, slot } | { fv: 진짜 동사 글자 } | { p: 전치사, of: 동사의 parts 번호, on: 처음 상태 }
   */
  const V_ = (v, fin, slot) => ({ v, fin, slot }), P_ = (p, of, on) => ({ p, of, on }), F_ = t => ({ fv: t });
  IG.PUZ = [
    { id: 'decide', ko: '그 회사는 부산에 새 지점을 열기로 했어요.', parts: ['The company', V_('decide', 'decided', { eng: 'empty', gov: 'subj' }), V_('open', 'opened', { eng: 'full', gov: 'v', by: 'decide', main: 'decided', obj: 'direct' }), 'a new branch in Busan.'] },
    { id: 'ask', ko: '매니저는 우리에게 사무실 이전을 검토해 달라고 했어요.', parts: ['The manager', V_('ask', 'asked', { eng: 'empty', gov: 'subj' }), 'us', V_('consider', 'considered', { eng: 'full', gov: 'vo', by: 'ask', main: 'asked' }), V_('move', 'moved', { eng: 'full', gov: 'v', by: 'consider', main: 'asked', obj: 'direct' }), 'the office.'] },
    { id: 'staff', ko: '안전 세미나에 참석하는 직원은 매뉴얼을 받아요.', parts: ['Staff', V_('attend', 'attended', { eng: 'full', gov: 'noun', main: 'will receive', obj: 'direct' }), 'the safety seminar', F_('will'), V_('receive', 'received', { eng: 'empty', gov: 'modal', by: 'will', at: 'will', obj: 'direct' }), 'a manual.'] },
    { id: 'discuss', ko: '이사회는 회의 때마다 예산을 논의해요.', parts: ['The board', V_('discuss', 'discusses', { eng: 'empty', gov: 'subj' }), P_('about', 1, true), 'the budget at every meeting.'] },
    { id: 'respond', ko: '금요일까지 설문에 답해 주세요.', parts: ['Please', V_('respond', 'responded', { eng: 'empty', gov: 'please', at: 'Please' }), P_('to', 1, false), 'the survey by Friday.'] },
    { id: 'have', ko: '이 씨는 인턴들에게 발표 자료를 준비하게 했어요.', parts: ['Ms. Lee', V_('have', 'had', { eng: 'empty', gov: 'subj' }), 'the interns', V_('prepare', 'prepared', { eng: 'full', gov: 'vo', by: 'have', main: 'had', obj: 'direct' }), 'the slides.'] },
    { id: 'eligible', ko: '정규직 직원은 그 프로그램에 지원할 자격이 있어요.', parts: ['Full-time staff', V_('be', 'are', { eng: 'empty', gov: 'subj' }), 'eligible', V_('apply', 'applied', { eng: 'full', gov: 'adj', by: 'eligible', main: 'are', obj: 'for' }), 'for the program.'] },
    { id: 'encourage', ko: '우리 팀은 모든 직원에게 워크숍 참석을 권했어요.', parts: ['Our team', V_('encourage', 'encouraged', { eng: 'empty', gov: 'subj' }), 'all employees', V_('attend', 'attended', { eng: 'full', gov: 'vo', by: 'encourage', main: 'encouraged' }), P_('in', 3, true), 'the workshop.'] },
    { id: 'commit', ko: '그 회사는 서비스를 개선하는 데 힘쓰고 있어요.', parts: ['The company', V_('be', 'is', { eng: 'empty', gov: 'subj' }), 'committed to', V_('improve', 'improved', { eng: 'full', gov: 'prep', by: 'be committed to', at: 'committed to', main: 'is', obj: 'direct' }), 'its service.'] },
    { id: 'suggest', ko: '매니저는 비용을 줄이려고 종이를 덜 쓰자고 제안했어요.', parts: ['The manager', V_('suggest', 'suggested', { eng: 'empty', gov: 'subj' }), V_('use', 'used', { eng: 'full', gov: 'v', by: 'suggest', main: 'suggested', obj: 'direct' }), 'less paper', V_('reduce', 'reduced', { eng: 'full', gov: 'purpose', main: 'suggested', obj: 'direct' }), 'costs.'] },
  ];
  // 퍼즐의 한 상태(st: { f: { 번호: 모양 }, p: { 번호: 켜짐 } })를 문장과 세 단계 판정으로
  IG.chain = function (P, st) {
    const verbs = [], preps = [];
    let fixed = 0;
    P.parts.forEach((x, i) => { if (x && x.v) verbs.push(i); else if (x && x.p) preps.push(i); else if (x && x.fv) fixed++; });
    const prepOf = i => preps.find(j => P.parts[j].of === i);
    const slotOf = i => {
      const x = P.parts[i], j = prepOf(i), s = Object.assign({}, x.slot);
      if (j != null) s.obj = st.p[j] ? P.parts[j].p : 'direct';
      return s;
    };
    const surface = i => { const x = P.parts[i], f = st.f[i], F = IG.formsOf(x.v, x.fin); return f ? F[f] : x.v; };
    // 진짜 동사 세기: 진짜 동사 꼴 + (조동사·사역동사 뒤가 아닌) 원형 + 고정된 진짜 동사(조동사 will 등)
    const finite = [];
    P.parts.forEach((x, i) => { if (x && x.fv) finite.push(x.fv); });
    verbs.forEach(i => { const f = st.f[i], s = slotOf(i); if (f === 'fin' || (f === 'base' && IG.baseCounts(s))) finite.push(surface(i)); });
    // 조동사(will) 뒤의 원형은 조동사와 한 덩어리
    const res = verbs.map(i => {
      const f = st.f[i];
      if (!f) return { i, pending: true };
      return Object.assign({ i }, IG.judge({ w: surface(i), f, v: P.parts[i].v }, slotOf(i)));
    });
    const pending = res.filter(r => r.pending).length;
    const fail = k => res.filter(r => !r.pending && r.s === 'no' && r.step === k);
    const name = r => surface(r.i);
    // 조동사 + 원형은 진짜 동사 한 덩어리로 보여 줌 (will receive)
    verbs.forEach(i => { const x = P.parts[i]; if (x.slot.gov === 'modal' && st.f[i] === 'base') { const k = finite.indexOf(x.slot.at); if (k >= 0) finite[k] = `${x.slot.at} ${surface(i)}`; } });
    const n = finite.length, f1 = fail(1), f2 = fail(2), f3 = fail(3);
    const list = f => f.map(r => `${name(r)}: ${r.why}`).join(' ');
    const s1 = f1.length || n > 1 || (n === 0 && !pending) ? 'no' : n === 1 ? 'ok' : 'wait';
    const steps = [
      { s: s1, text: `진짜 동사 ${n}개${n ? ' → ' + finite.join(', ') : ''}. ` + (f1.length ? list(f1) : n === 1 ? '하나뿐이라 좋아요.' : n > 1 ? '접속사 없이 진짜 동사는 하나만.' : '시제가 있는 진짜 동사가 하나 필요해요.') },
      { s: f2.length ? 'no' : pending ? 'wait' : 'ok', text: f2.length ? list(f2) : pending ? `아직 옷을 고르지 않은 동사가 ${pending}개 있어요.` : '앞 낱말이 고른 모양과 모두 맞아요.' },
      { s: f3.length ? 'no' : pending ? 'wait' : 'ok', text: f3.length ? list(f3) : pending ? '옷을 다 고르면 뒤(목적어 · 전치사)를 확인해요.' : preps.length ? '전치사도 맞아요.' : '뒤에 오는 목적어도 맞아요.' },
    ];
    const done = !pending && res.every(r => r.s === 'ok') && n === 1;
    const words = P.parts.map((x, i) => typeof x === 'string' ? x : x.fv ? x.fv : x.v ? surface(i) : st.p[i] ? x.p : '').filter(Boolean);
    return { text: words.join(' '), steps, done, n, finite, res, verbs, preps };
  };
  // 정답 상태 (규칙 엔진이 찾음): 동사마다 네 모양, 전치사마다 켜고 끄기를 모두 해 봄
  IG.solve = function (P) {
    const verbs = [], preps = [];
    P.parts.forEach((x, i) => { if (x && x.v) verbs.push(i); else if (x && x.p) preps.push(i); });
    const FS = ['fin', 'base', 'to', 'ing'], out = [];
    const total = Math.pow(4, verbs.length) * Math.pow(2, preps.length);
    for (let c = 0; c < total; c++) {
      let k = c; const st = { f: {}, p: {} };
      verbs.forEach(i => { st.f[i] = FS[k % 4]; k = Math.floor(k / 4); });
      preps.forEach(i => { st.p[i] = !!(k % 2); k = Math.floor(k / 2); });
      if (IG.chain(P, st).done) out.push(st);
    }
    return out;
  };

  /* ---------- 데이터 점검 ---------- */
  IG.check = function () {
    const bad = [];
    IG.DRILL.forEach((it, i) => {
      const good = it.opts.map((o, k) => IG.judgeOpt(it, k).s === 'ok' ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`연습 문제 ${i + 1}: 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      it.opts.forEach(o => { if (!VERB[o[2]]) bad.push(`연습 문제 ${i + 1}: 동사 사전에 ${o[2]}가 없어요`); if (!FORM[o[1]]) bad.push(`연습 문제 ${i + 1}: 모양 ${o[1]}을 몰라요`); });
      if (!IG.need(it.slot)) bad.push(`연습 문제 ${i + 1}: 빈칸 앞 낱말이 고르는 모양을 사전에서 못 찾았어요`);
      ['at', 'main'].forEach(f => { if (it.slot[f] && !it.q.includes(it.slot[f])) bad.push(`연습 문제 ${i + 1}: 단서 ‘${it.slot[f]}’가 문장에 없어요`); });
      if (it.back && !it.q.includes(it.back)) bad.push(`연습 문제 ${i + 1}: 빈칸 뒤 ‘${it.back}’가 문장에 없어요`);
      if (it.slot.eng === 'full' && !it.slot.main) bad.push(`연습 문제 ${i + 1}: 진짜 동사(main)가 없어요`);
      if (it.slot.obj && !it.back) bad.push(`연습 문제 ${i + 1}: 빈칸 뒤 단서(back)가 없어요`);
      if ((it.q.match(/___/g) || []).length !== 1) bad.push(`연습 문제 ${i + 1}: 빈칸이 하나가 아니에요`);
    });
    const pos = [0, 0, 0, 0]; IG.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 2) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    IG.PUZ.forEach(P => {
      P.parts.forEach(x => { if (x && x.v && !VERB[x.v]) bad.push(`퍼즐 ${P.id}: 동사 사전에 ${x.v}가 없어요`); if (x && x.v && !IG.need(x.slot)) bad.push(`퍼즐 ${P.id}: ${x.v} 자리의 모양을 못 정해요`); });
      const sol = IG.solve(P);
      if (sol.length !== 1) bad.push(`퍼즐 ${P.id}: 답이 ${sol.length}개예요`);
    });
    IG.PREP_TO.concat(IG.INF_TO).forEach(x => { if (!x.ex.includes(x.e.replace(/^be /, ''))) bad.push(`표현 ${x.e}: 예문에 표현이 없어요`); });
    bad.forEach(b => console.warn('[동사 자리] ' + b));
    return bad;
  };
})();
