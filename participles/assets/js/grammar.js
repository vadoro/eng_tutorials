/* 분사 튜토리얼 — 규칙 엔진과 예문
 *
 * 분사 빈칸 문제의 보기는 한 동사의 여러 모양이에요(submits · submitting · submitted · will submit).
 * 답은 한 질문이 정합니다. 분사의 주인(분사가 꾸미거나 설명하는 말)이 그 일을 하는가, 당하는가?
 *   하는 쪽 · 감정을 일으키는 쪽 · 자동사 → -ing(현재분사) / 당하는 쪽 · 감정을 느끼는 쪽 → -ed(과거분사)
 * 영상의 ✓·×, 직접 해 보기, 놀이터(주인 바꾸기 실험실), 연습 문제, 퀴즈가 모두 PT.judge()로 맞고 틀림을 정하고,
 * 문제 데이터에 적은 정답이 judge()와 다르면 콘솔에 경고를 냅니다.
 *
 * 주인과 동사의 관계(rel)는 문제마다 데이터에 적어 둡니다. 규칙 엔진은 문장의 뜻을 스스로 알아내지 않아요.
 *   do 하는 쪽 · done 당하는 쪽 · vi 자동사(하는 쪽만) · cause 감정을 일으키는 쪽 · feel 감정을 느끼는 쪽
 * 자리(slot): pre 명사 앞 · post 명사 뒤(분사구) · comp be·find 뒤 보어 · clause 분사구문
 * 보기 모양(code): ing 현재분사 · ed 과거분사 · v 동사 모양(현재·과거·will + 원형) · n 명사 · adv 부사
 * judge(code, ctx) → { s: 'ok' | 'no', step: 0 | 1 | 2, why }   step = 3단계 풀이법의 몇 단계에서 지워지는지
 *   ctx = { slot, rel, v: 동사, owner: 주인(문장 속 글자), obj: 분사 뒤에 목적어가 있나, conj: 분사구문 앞 접속사, main: 문장의 동사 }
 */
(function () {
  'use strict';
  const PT = (window.PT = {});

  /* ---------- ② 주인에게 묻기: 관계 → 모양 ---------- */
  PT.REL = {
    do:    { name: '하는 쪽', form: 'ing', side: 'L' },
    done:  { name: '당하는 쪽', form: 'ed', side: 'R' },
    vi:    { name: '자동사 (하는 쪽만)', form: 'ing', side: 'L' },
    cause: { name: '감정을 일으키는 쪽', form: 'ing', side: 'L' },
    feel:  { name: '감정을 느끼는 쪽', form: 'ed', side: 'R' },
  };
  PT.SLOT = { pre: '명사 앞', post: '명사 뒤 (분사구)', comp: 'be · find 뒤 보어', clause: '분사구문 (콤마 앞)' };
  PT.FORM = { ing: '현재분사(-ing)', ed: '과거분사(p.p.)', v: '동사 모양', n: '명사', adv: '부사' };
  PT.formName = code => PT.FORM[code] || code;

  /* ---------- 동사 사전: [원형, -s, 과거, 과거분사, -ing], 종류, 뜻, [하는 쪽, 당하는 쪽]의 한국어 ----------
   * 종류: vt 타동사 · vi 자동사 · emo 감정 동사(감정을 일으키는 동사). ko는 ‘~ 쪽’ 앞에 붙는 말
   */
  const V = {};
  const addV = (type, list) => list.forEach(([f, mean, a, b]) => { const p = f.split('/'); V[p[0]] = { w: p[0], f: p, type, mean, ko: [a, b] }; });
  addV('vt', [
    ['attach/attaches/attached/attached/attaching', '첨부하다', '첨부하는', '첨부되는'],
    ['enclose/encloses/enclosed/enclosed/enclosing', '동봉하다', '동봉하는', '동봉되는'],
    ['repair/repairs/repaired/repaired/repairing', '고치다', '고치는', '고쳐지는'],
    ['renovate/renovates/renovated/renovated/renovating', '새로 고치다', '고치는', '고쳐지는'],
    ['submit/submits/submitted/submitted/submitting', '제출하다', '제출하는', '제출되는'],
    ['tour/tours/toured/toured/touring', '둘러보다', '둘러보는', '구경거리가 되는'],
    ['lead/leads/led/led/leading', '이끌다', '이끄는', '이끌리는'],
    ['make/makes/made/made/making', '만들다', '만드는', '만들어지는'],
    ['complete/completes/completed/completed/completing', '작성하다 · 마치다', '작성하는', '작성되는'],
    ['approve/approves/approved/approved/approving', '승인하다', '승인하는', '승인되는'],
    ['found/founds/founded/founded/founding', '세우다', '세우는', '세워지는'],
    ['leave/leaves/left/left/leaving', '떠나다', '떠나는', '남겨지는'],
    ['invite/invites/invited/invited/inviting', '초대하다', '초대하는', '초대받는'],
    ['hire/hires/hired/hired/hiring', '채용하다', '채용하는', '채용되는'],
    ['review/reviews/reviewed/reviewed/reviewing', '검토하다', '검토하는', '검토되는'],
    ['write/writes/wrote/written/writing', '쓰다', '쓰는', '쓰이는'],
    ['break/breaks/broke/broken/breaking', '깨뜨리다', '깨뜨리는', '깨지는'],
    ['place/places/placed/placed/placing', '(주문을) 넣다', '주문을 넣는', '주문으로 들어오는'],
    ['prepare/prepares/prepared/prepared/preparing', '준비하다 · 작성하다', '작성하는', '작성되는'],
    ['face/faces/faced/faced/facing', '맞서다', '맞서는', '맞닥뜨려지는'],
    ['need/needs/needed/needed/needing', '필요로 하다', '필요로 하는', '필요해지는'],
    ['sign/signs/signed/signed/signing', '서명하다', '서명하는', '서명되는'],
    ['use/uses/used/used/using', '쓰다', '쓰는', '쓰이는'],
    ['finalize/finalizes/finalized/finalized/finalizing', '확정하다', '확정하는', '확정되는'],
  ]);
  addV('vi', [
    ['remain/remains/remained/remained/remaining', '남다', '남는', null],
    ['rise/rises/rose/risen/rising', '오르다', '오르는', null],
    ['exist/exists/existed/existed/existing', '있다 (존재하다)', '이미 있는', null],
    ['emerge/emerges/emerged/emerged/emerging', '떠오르다', '떠오르는', null],
    ['work/works/worked/worked/working', '일하다', '일하는', null],
  ]);
  addV('emo', [
    ['excite/excites/excited/excited/exciting', '신나게 하다', '신나게 하는', '신이 나는'],
    ['dissatisfy/dissatisfies/dissatisfied/dissatisfied/dissatisfying', '불만스럽게 하다', '불만스럽게 하는', '불만을 느끼는'],
    ['confuse/confuses/confused/confused/confusing', '헷갈리게 하다', '헷갈리게 하는', '헷갈려하는'],
    ['please/pleases/pleased/pleased/pleasing', '기쁘게 하다', '기쁘게 하는', '기뻐하는'],
    ['disappoint/disappoints/disappointed/disappointed/disappointing', '실망시키다', '실망시키는', '실망하는'],
    ['encourage/encourages/encouraged/encouraged/encouraging', '힘을 주다', '힘을 주는', '힘을 얻는'],
    ['bore/bores/bored/bored/boring', '지루하게 하다', '지루하게 하는', '지루해하는'],
    ['interest/interests/interested/interested/interesting', '흥미를 주다', '흥미를 주는', '흥미를 느끼는'],
    ['satisfy/satisfies/satisfied/satisfied/satisfying', '만족시키다', '만족시키는', '만족하는'],
    ['surprise/surprises/surprised/surprised/surprising', '놀라게 하다', '놀라게 하는', '놀라는'],
    ['impress/impresses/impressed/impressed/impressing', '감명을 주다', '감명을 주는', '감명을 받는'],
  ]);
  PT.VERBS = V;
  PT.verb = w => V[w];
  PT.ing = w => V[w].f[4];
  PT.ed = w => V[w].f[3];
  PT.koOf = (w, rel) => { const D = V[w]; return PT.REL[rel].side === 'L' ? D.ko[0] : D.ko[1]; };
  // 관계와 동사 종류가 맞는지 (vt: do·done, vi: vi, emo: cause·feel)
  const KIND = { vt: ['do', 'done'], vi: ['vi'], emo: ['cause', 'feel'] };
  PT.relFits = (w, rel) => !!V[w] && KIND[V[w].type].includes(rel);

  /* ---------- 판정 ---------- */
  const ok = why => ({ s: 'ok', step: 0, why }), no = (step, why) => ({ s: 'no', step, why });
  const VWHY = {
    pre: () => '동사 모양은 명사 앞에서 명사를 꾸밀 수 없어요.',
    post: c => `문장의 동사는 따로 있어요 → ${c.main}. 접속사 없이 동사를 하나 더 쓸 수 없어요.`,
    comp: () => '보어 자리(주인을 설명하는 자리)에는 동사 모양이 올 수 없어요.',
    clause: c => c.conj ? `접속사 ${c.conj} 뒤에 주어 없이 동사 모양이 올 수 없어요. 분사가 와야 해요.` : `주절의 동사는 따로 있어요 → ${c.main}. 콤마 앞은 분사구문 자리예요.`,
  };
  const NWHY = {
    pre: () => '명사는 이 자리에서 뒤의 명사를 꾸미지 못해요. 꾸미는 말(분사)이 필요해요.',
    post: () => '명사는 주인 뒤에서 주인을 꾸미지 못해요.',
    comp: c => `명사가 보어가 되려면 주인과 같은 것이어야 해요. 주인 = ${c.owner} → 상태를 말하는 분사가 와야 해요.`,
    clause: c => c.conj ? `접속사 ${c.conj} 뒤에 명사 혼자 올 수 없어요. 분사가 와야 해요.` : '명사로는 분사구문을 만들 수 없어요.',
  };
  const AWHY = {
    pre: () => '부사는 명사를 꾸미지 못해요.',
    post: () => '부사는 이 자리에서 명사를 꾸미지 못해요.',
    comp: () => '부사는 보어가 될 수 없어요. 주인을 설명하는 말(분사)이 와야 해요.',
    clause: () => '부사로는 분사구문을 만들 수 없어요.',
  };
  PT.judge = function (code, c) {
    if (code === 'v') return no(1, VWHY[c.slot](c));
    if (code === 'n') return no(1, NWHY[c.slot](c));
    if (code === 'adv') return no(1, AWHY[c.slot](c));
    const R = PT.REL[c.rel], D = V[c.v], ko = PT.koOf(c.v, c.rel);
    if (code === 'ed' && c.conj && /^(before|after)$/i.test(c.conj))
      return no(2, `${c.conj} 뒤에는 -ing가 와요(전치사로도 쓰는 말이라서). 당하는 뜻이면 being + p.p.로 써요.`);
    if (code === R.form) {
      if (c.rel === 'vi') return ok(`${D.w} = ${D.mean}, 목적어 없이 쓰는 자동사예요. 당할 수 없으니 늘 -ing.`);
      if (c.rel === 'do') return ok(`주인 = ${c.owner} → ${ko} 쪽(하는 쪽) → -ing.` + (c.obj ? ' 뒤의 목적어도 -ing와 맞아요.' : ''));
      if (c.rel === 'done') return ok(`주인 = ${c.owner} → ${ko} 쪽(당하는 쪽) → -ed.`);
      if (c.rel === 'cause') return ok(`주인 = ${c.owner} → 감정을 일으키는 쪽(${ko} 쪽) → -ing.`);
      return ok(`주인 = ${c.owner} → 감정을 느끼는 쪽(${ko} 쪽) → -ed.`);
    }
    if (code === 'ing') return no(2, c.rel === 'done' ? `주인 = ${c.owner} → 당하는 쪽(${ko} 쪽)이라서 -ing는 안 돼요.`
      : `주인 = ${c.owner} → 감정을 느끼는 쪽(${ko} 쪽)이라서 -ing는 안 돼요. -ing는 감정을 일으키는 쪽이에요.`);
    if (c.rel === 'vi') return no(2, `${D.w} = 자동사(${D.mean})라서 당하는 뜻의 -ed가 없어요. 늘 -ing.`);
    if (c.rel === 'do') return no(2, `주인 = ${c.owner} → 하는 쪽(${ko} 쪽)이라서 -ed는 안 돼요.` + (c.obj ? ' 게다가 -ed 뒤에는 목적어가 올 수 없어요.' : ''));
    return no(2, `주인 = ${c.owner} → 감정을 일으키는 쪽(${ko} 쪽)이라서 -ed는 안 돼요. 감정을 느끼는 건 주인이 아니에요.`);
  };
  // 모양 → 낱말 (보기 글자 점검용)
  PT.wordOf = (w, code) => code === 'ing' ? V[w].f[4] : code === 'ed' ? V[w].f[3] : null;

  /* ---------- 3단계 판정기 (영상 09장): 자리 · 관계 · 뒤 → 모양 ---------- */
  PT.AFTER = { obj: '목적어가 있음', none: '목적어가 없음 (by · 전치사구 · 시간 · 아무것도)' };
  PT.decide = function (slot, rel, after) {
    const R = PT.REL[rel];
    if (after === 'obj' && rel === 'vi') return { ok: false, why: '자동사는 목적어를 갖지 않아요. 뒤의 명사가 정말 목적어인지 다시 봐요.' };
    if (after === 'obj' && R.side === 'R') return { ok: false, why: `${R.name} 뒤에는 목적어가 남지 않아요(목적어가 주인이 됐으니까요). 목적어가 있다면 주인이 하는 쪽인지 다시 확인해요.` };
    if (after === 'obj' && slot === 'pre') return { ok: false, why: '명사 앞의 분사 바로 뒤에는 주인(명사)이 와요. 목적어가 붙으면 분사구가 되어 명사 뒤로 가요.' };
    const f = R.form === 'ing' ? '-ing (현재분사)' : '-ed (과거분사)';
    const why = rel === 'vi' ? '자동사는 당할 수 없어서 늘 -ing.' : after === 'obj' ? '목적어를 가질 수 있는 건 -ing뿐이에요.' : R.side === 'R' ? '당하는 쪽 뒤에는 목적어 대신 by · 전치사구가 자주 와요.' : '목적어가 없어도 하는 쪽이면 -ing.';
    return { ok: true, form: R.form, text: `${R.name} → ${f}`, why };
  };

  /* ---------- 영상 02장 · 놀이터: 동사 하나, 주인 둘 ----------
   * L: 하는 쪽(감정을 일으키는 쪽) · R: 당하는 쪽(느끼는 쪽) · 자동사는 R이 없음
   * owners: 주인마다 { n: 주인(문장 속 글자), rel, slot, obj: 뒤의 목적어, cue: 뒤의 단서와 종류, frame: 빈칸 문장, ko }
   * act · pass · phr: 영상 02장에서 쓰는 능동문 · 수동문 · 분사 덩어리 (타동사만)
   */
  PT.LAB = [
    { v: 'invite', L: 'the manager', R: 'the guests',
      act: 'The manager invited the guests.', pass: 'The guests were invited.',
      phr: { R: ['the invited guests', 'guests'], L: ['the manager inviting the guests', 'manager', 'the guests'] },
      owners: [
        { n: 'guests', rel: 'done', slot: 'pre', frame: 'The ___ guests will arrive at 7 p.m.', ko: '초대받은 손님들은 저녁 7시에 도착해요.' },
        { n: 'manager', rel: 'do', slot: 'post', obj: 'the guests', main: 'should greet', frame: 'The manager ___ the guests should greet them at the door.', ko: '손님을 초대하는 매니저가 문 앞에서 손님을 맞아야 해요.' },
      ] },
    { v: 'renovate', L: 'the crew', R: 'the lobby',
      act: 'The crew renovated the lobby.', pass: 'The lobby was renovated.',
      phr: { R: ['the renovated lobby', 'lobby'], L: ['the crew renovating the lobby', 'crew', 'the lobby'] },
      owners: [
        { n: 'lobby', rel: 'done', slot: 'pre', frame: 'The ___ lobby looks bright and modern.', ko: '새로 고친 로비가 밝고 산뜻해 보여요.' },
        { n: 'crew', rel: 'do', slot: 'post', obj: 'the lobby', main: 'will finish', frame: 'The crew ___ the lobby will finish on Friday.', ko: '로비를 고치는 작업팀은 금요일에 일을 마쳐요.' },
      ] },
    { v: 'hire', L: 'the company', R: 'the employees',
      act: 'The company hired the employees.', pass: 'The employees were hired.',
      phr: { R: ['the newly hired employees', 'employees'], L: ['the company hiring the employees', 'company', 'the employees'] },
      owners: [
        { n: 'employees', rel: 'done', slot: 'pre', frame: 'Newly ___ employees must attend an orientation.', ko: '새로 채용된 직원은 오리엔테이션에 꼭 참석해야 해요.' },
        { n: 'Companies', rel: 'do', slot: 'post', obj: 'new graduates', main: 'often offer', frame: 'Companies ___ new graduates often offer training programs.', ko: '신입 졸업생을 채용하는 회사는 대개 교육 프로그램을 제공해요.' },
      ] },
    { v: 'review', L: 'the committee', R: 'the report',
      act: 'The committee reviewed the report.', pass: 'The report was reviewed.',
      phr: { R: ['the report reviewed by the committee', 'report', '', 'by the committee'], L: ['the committee reviewing the report', 'committee', 'the report'] },
      owners: [
        { n: 'report', rel: 'done', slot: 'post', by: 'by the committee', main: 'contains', frame: 'The report ___ by the committee contains several errors.', ko: '위원회가 검토한 보고서에 오류가 몇 개 있어요.' },
        { n: 'committee', rel: 'do', slot: 'post', obj: 'the report', main: 'will meet', frame: 'The committee ___ the report will meet on Monday.', ko: '보고서를 검토하는 위원회는 월요일에 모여요.' },
      ] },
    { v: 'remain', L: 'the seats',
      owners: [{ n: 'seats', rel: 'vi', slot: 'pre', frame: 'The ___ seats are in the back row.', ko: '남은 좌석은 뒷줄에 있어요.' }] },
    { v: 'rise', L: 'costs',
      owners: [{ n: 'costs', rel: 'vi', slot: 'pre', frame: '___ costs are a concern for small businesses.', ko: '오르는 비용이 작은 가게들의 걱정거리예요.' }] },
    { v: 'exist', L: 'customers',
      owners: [{ n: 'customers', rel: 'vi', slot: 'pre', frame: '___ customers will receive a discount code.', ko: '기존 고객은 할인 코드를 받아요.' }] },
    { v: 'excite', L: 'the offer', R: 'the customers', act: 'The offer excited the customers.',
      owners: [
        { n: 'offer', rel: 'cause', slot: 'pre', frame: 'This is an ___ offer for new members.', ko: '새 회원에게 신나는 제안이에요.' },
        { n: 'customers', rel: 'feel', slot: 'pre', frame: '___ customers lined up outside the store.', ko: '신이 난 손님들이 가게 밖에 줄을 섰어요.' },
      ] },
    { v: 'bore', L: 'the lecture', R: 'the students', act: 'The lecture bored the students.',
      owners: [
        { n: 'lecture', rel: 'cause', slot: 'comp', main: 'was', frame: 'The lecture was so ___ that many students left early.', ko: '강의가 너무 지루해서 많은 학생이 일찍 나갔어요.' },
        { n: 'students', rel: 'feel', slot: 'pre', frame: 'The ___ students kept looking at the clock.', ko: '지루해진 학생들은 계속 시계를 봤어요.' },
      ] },
    { v: 'confuse', L: 'the manual', R: 'the staff', act: 'The manual confused the staff.',
      owners: [
        { n: 'manual', rel: 'cause', slot: 'pre', frame: 'The ___ manual has been rewritten.', ko: '헷갈리는 설명서를 새로 썼어요.' },
        { n: 'staff', rel: 'feel', slot: 'pre', frame: '___ staff members called the help desk.', ko: '헷갈린 직원들이 지원 센터에 전화했어요.' },
      ] },
    { v: 'interest', L: 'the article', R: 'the students', act: 'The article interested the students.',
      owners: [
        { n: 'article', rel: 'cause', slot: 'pre', frame: 'I read an ___ article about solar energy.', ko: '태양 에너지에 관한 흥미로운 기사를 읽었어요.' },
        { n: 'Students', rel: 'feel', slot: 'post', prep: 'in the program', main: 'should contact', frame: 'Students ___ in the program should contact Ms. Ahn.', ko: '이 프로그램에 관심 있는 학생은 안 선생님께 연락하세요.' },
      ] },
  ];
  PT.lab = v => PT.LAB.find(E => E.v === v) || PT.LAB[0];
  PT.ctxOwner = (E, O) => ({ slot: O.slot, rel: O.rel, v: E.v, owner: O.n, obj: !!O.obj, main: O.main || '' });
  // 놀이터의 풀이: 두 모양으로 채운 문장과 판정, 3단계 설명
  PT.explain = function (E, O) {
    const c = PT.ctxOwner(E, O), D = V[E.v], R = PT.REL[O.rel];
    const fills = ['ing', 'ed'].map(code => { const w = PT.wordOf(E.v, code), j = PT.judge(code, c); return { code, w, text: fill(O.frame, w), j }; });
    const steps = [];
    steps.push(O.slot === 'pre' ? `① 주인 = ${O.n}. 빈칸이 바로 뒤의 명사를 꾸며요.` : O.slot === 'post' ? `① 주인 = ${O.n}. 빈칸이 앞의 명사를 뒤에서 꾸며요.` : `① 주인 = ${O.n}. 빈칸이 주어를 설명하는 보어예요.`);
    if (O.rel === 'vi') steps.push(`② ${D.w} = ${D.mean}, 목적어 없이 쓰는 자동사예요. 주인은 ${D.ko[0]} 쪽, 당할 수가 없어요.`);
    else if (D.type === 'emo') steps.push(`② ${O.n} → 감정을 일으키나요(${D.ko[0]}), 느끼나요(${D.ko[1]})? → ${R.name}.`);
    else steps.push(`② ${O.n} → ${D.ko[0]} 쪽일까요, ${D.ko[1]} 쪽일까요? → ${R.name}.`);
    steps.push('③ ' + (O.obj ? `뒤에 목적어가 있어요 → ${O.obj}. 목적어를 가질 수 있는 건 -ing예요.`
      : O.by ? `뒤에 by + 하는 쪽 → ${O.by}. 당하는 쪽이 맞아요.`
      : O.prep ? `감정을 느끼는 쪽 뒤에 자주 오는 전치사 → ${O.prep.split(' ')[0]}.`
      : O.rel === 'vi' ? '자동사는 늘 -ing로 명사를 꾸며요.' : `그래서 ${R.form === 'ing' ? '-ing' : '-ed'} → ${PT.wordOf(E.v, R.form)}.`));
    return { c, fills, steps, right: fills.find(f => f.j.s === 'ok') };
  };
  const fill = (q, w) => { const i = q.indexOf('___'); let s = q.slice(0, i) + w + q.slice(i + 3); return i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  PT.fill = fill;

  /* ---------- 영상 01장 · 직접 해 보기: 동사 → 분사 둘 ---------- */
  PT.FORMS01 = [
    { v: 'attach', ko: ['첨부하는', '첨부된'], pre: ['the attached file', 'file'], post: ['the file attached to this e-mail', 'file', 'attached to this e-mail'] },
    { v: 'repair', ko: ['고치는', '고친'], pre: ['the repaired printer', 'printer'], post: ['the printer repaired yesterday', 'printer', 'repaired yesterday'] },
    { v: 'write', ko: ['쓰는', '쓰인'], pre: ['a written report', 'report'], post: ['a report written in English', 'report', 'written in English'] },
    { v: 'break', ko: ['깨뜨리는', '깨진'], pre: ['a broken window', 'window'], post: ['the window broken by the storm', 'window', 'broken by the storm'] },
  ];

  /* ---------- 영상 03장 직접 해 보기: 자동사일까? / 때와 상관없는 -ed ---------- */
  PT.SORT_VI = ['remain', 'attach', 'rise', 'submit', 'exist', 'invite', 'emerge', 'renovate'];
  PT.WHEN = [
    { k: 'past', t: '지난주', s: 'Orders placed last week have already shipped.', ko: '지난주에 들어온 주문은 이미 발송됐어요.' },
    { k: 'now', t: '오늘 밤', s: 'Orders placed tonight will ship tomorrow.', ko: '오늘 밤에 들어온 주문은 내일 발송돼요.' },
    { k: 'future', t: '다음 주', s: 'Orders placed next week will arrive within three days.', ko: '다음 주에 들어올 주문은 사흘 안에 도착해요.' },
  ];

  /* ---------- 영상 05장: 감정 동사 하나, 두 주인 ---------- */
  PT.EMO = [
    { v: 'excite', s: 'The offer excited the customers.', L: 'the offer', R: 'the customers', cause: 'an exciting offer', feel: 'excited customers', ko: ['신나는 제안', '신이 난 손님'] },
    { v: 'bore', s: 'The lecture bored the students.', L: 'the lecture', R: 'the students', cause: 'a boring lecture', feel: 'bored students', ko: ['지루한 강의', '지루해하는 학생'] },
    { v: 'confuse', s: 'The manual confused the staff.', L: 'the manual', R: 'the staff', cause: 'a confusing manual', feel: 'confused staff', ko: ['헷갈리는 설명서', '헷갈린 직원'] },
    { v: 'interest', s: 'The article interested the readers.', L: 'the article', R: 'the readers', cause: 'an interesting article', feel: 'interested readers', ko: ['흥미로운 기사', '흥미를 느낀 독자'] },
    { v: 'satisfy', s: 'The result satisfied the clients.', L: 'the result', R: 'the clients', cause: 'a satisfying result', feel: 'satisfied clients', ko: ['만족스러운 결과', '만족한 고객'] },
    { v: 'disappoint', s: 'The sales figures disappointed the investors.', L: 'the sales figures', R: 'the investors', cause: 'disappointing sales figures', feel: 'disappointed investors', ko: ['실망스러운 판매 실적', '실망한 투자자'] },
  ];

  /* ---------- 영상 06장 · 08장 직접 해 보기: -ing일까, -ed일까 (문장마다 관계를 적어 둠) ---------- */
  PT.SORT_EMO = [
    { q: 'The speaker was so ___ that I almost fell asleep.', v: 'bore', rel: 'cause', slot: 'comp', owner: 'speaker', main: 'was' },
    { q: '___ guests often leave good reviews.', v: 'satisfy', rel: 'feel', slot: 'pre', owner: 'guests' },
    { q: 'The test results were ___ to everyone.', v: 'surprise', rel: 'cause', slot: 'comp', owner: 'results', main: 'were' },
    { q: '___ staff members called the help desk.', v: 'confuse', rel: 'feel', slot: 'pre', owner: 'staff members' },
    { q: 'She told us an ___ story about her trip.', v: 'interest', rel: 'cause', slot: 'pre', owner: 'story' },
    { q: '___ fans waited outside the stadium for hours.', v: 'excite', rel: 'feel', slot: 'pre', owner: 'fans' },
  ];
  PT.SORT_CONJ = [
    { q: 'Before ___ the office, please turn off the lights.', v: 'leave', rel: 'do', slot: 'clause', conj: 'Before', owner: 'you (명령문의 숨은 주어)', obj: true },
    { q: 'Once ___, the plan will take effect in May.', v: 'approve', rel: 'done', slot: 'clause', conj: 'Once', owner: 'the plan' },
    { q: 'If ___, extra chairs are available in the hall.', v: 'need', rel: 'done', slot: 'clause', conj: 'If', owner: 'extra chairs' },
    { q: 'After ___ the data, the team made a final decision.', v: 'review', rel: 'do', slot: 'clause', conj: 'After', owner: 'the team', obj: true },
    { q: 'Until ___ by both parties, the contract is not valid.', v: 'sign', rel: 'done', slot: 'clause', conj: 'Until', owner: 'the contract' },
    { q: 'While ___ at the front desk, Mr. Cho answers many calls.', v: 'work', rel: 'vi', slot: 'clause', conj: 'While', owner: 'Mr. Cho' },
  ];
  PT.sortCtx = it => ({ slot: it.slot, rel: it.rel, v: it.v, owner: it.owner, obj: !!it.obj, conj: it.conj, main: it.main || '' });

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * opts: [보기, code] · owner: 주인(문장 속 글자) · v · rel · slot · main: 문장의 동사(문장 속 글자) · conj: 분사구문 앞 접속사
   * cue: [빈칸 뒤 단서(문장 속 글자), 종류] 종류: obj 목적어 · by by + 하는 쪽 · prep 감정 뒤 전치사 · time 시간·장소 표현
   * trap: 주인으로 착각하기 쉬운 말 · you: 명령문이라 주인이 숨은 주어 you · ko3: 마지막 단계에 덧붙일 말
   */
  PT.DRILL = [
    { q: 'Please read the ___ instructions carefully before using the device.', opts: [['enclose', 'v'], ['enclosed', 'ed'], ['enclosing', 'ing'], ['encloses', 'v']], a: 1,
      owner: 'instructions', v: 'enclose', rel: 'done', slot: 'pre', ko3: '한국어로 확인 → 동봉된 설명서.',
      tag: '명사 앞 · 당하는 쪽', type: 28, ko: '기기를 쓰기 전에 동봉된 설명서를 꼼꼼히 읽어 주세요.' },
    { q: 'Applications ___ after Friday will not be reviewed.', opts: [['submits', 'v'], ['submitting', 'ing'], ['submitted', 'ed'], ['will submit', 'v']], a: 2,
      owner: 'Applications', v: 'submit', rel: 'done', slot: 'post', main: 'will not be reviewed', cue: ['after Friday', 'time'],
      tag: '명사 뒤 · 당하는 쪽', type: 28, ko: '금요일 뒤에 제출된 지원서는 검토하지 않아요.' },
    { q: 'Visitors ___ the factory must wear a hard hat at all times.', opts: [['touring', 'ing'], ['toured', 'ed'], ['tour', 'v'], ['tours', 'v']], a: 0,
      owner: 'Visitors', v: 'tour', rel: 'do', slot: 'post', main: 'must wear', cue: ['the factory', 'obj'],
      tag: '명사 뒤 · 하는 쪽 + 목적어', type: 28, ko: '공장을 둘러보는 방문객은 언제나 안전모를 써야 해요.' },
    { q: 'The ___ tickets for the concert will be sold at the door.', opts: [['remain', 'v'], ['remains', 'v'], ['remained', 'ed'], ['remaining', 'ing']], a: 3,
      owner: 'tickets', v: 'remain', rel: 'vi', slot: 'pre', ko3: '한국어 ‘남은’의 -은이 과거처럼 들려도 remained는 틀려요.',
      tag: '명사 앞 · 자동사', type: 28, ko: '남은 공연 표는 입구에서 팔아요.' },
    { q: 'Hanmi Tech is a ___ supplier of solar panels in Asia.', opts: [['leading', 'ing'], ['led', 'ed'], ['leads', 'v'], ['leader', 'n']], a: 0,
      owner: 'supplier', v: 'lead', rel: 'do', slot: 'pre', ko3: '공급업체가 시장을 이끌어요 → 이끄는 공급업체.',
      tag: '명사 앞 · 하는 쪽', type: 28, ko: '한미테크는 아시아의 손꼽히는 태양광 패널 공급업체예요.' },
    { q: 'All products ___ at our Busan factory are inspected twice.', opts: [['make', 'v'], ['making', 'ing'], ['makes', 'v'], ['made', 'ed']], a: 3,
      owner: 'products', v: 'make', rel: 'done', slot: 'post', main: 'are inspected', cue: ['at our Busan factory', 'time'],
      tag: '명사 뒤 · 당하는 쪽 · 불규칙 p.p.', type: 28, ko: '부산 공장에서 만든 모든 제품은 두 번 검사해요.' },
    { q: 'The marketing team presented an ___ proposal for the spring campaign.', opts: [['excited', 'ed'], ['exciting', 'ing'], ['excite', 'v'], ['excitedly', 'adv']], a: 1,
      owner: 'proposal', v: 'excite', rel: 'cause', slot: 'pre', ko3: '제안서 자신이 신나는 게 아니라, 듣는 사람을 신나게 해요.',
      tag: '감정 · 일으키는 쪽', type: 29, ko: '마케팅팀이 봄 캠페인을 위한 신나는 제안을 내놓았어요.' },
    { q: '___ customers may return any item within 30 days for a full refund.', opts: [['Dissatisfy', 'v'], ['Dissatisfying', 'ing'], ['Dissatisfied', 'ed'], ['Dissatisfies', 'v']], a: 2,
      owner: 'customers', v: 'dissatisfy', rel: 'feel', slot: 'pre', ko3: '환불을 받는 사람 = 불만을 느낀 손님.',
      tag: '감정 · 느끼는 쪽', type: 29, ko: '불만이 있는 고객은 30일 안에 어떤 물건이든 반품하고 전액 환불받을 수 있어요.' },
    { q: 'Many employees found the new expense system ___.', opts: [['confusing', 'ing'], ['confused', 'ed'], ['confuse', 'v'], ['confusedly', 'adv']], a: 0,
      owner: 'system', v: 'confuse', rel: 'cause', slot: 'comp', trap: 'Many employees', ko3: '직원들이 헷갈려한 건 맞지만, 빈칸이 설명하는 주인은 system이에요.',
      tag: '감정 · 목적어를 설명하는 보어', type: 29, ko: '많은 직원이 새 경비 시스템을 헷갈려했어요.' },
    { q: 'The board members were ___ with the results of the first quarter.', opts: [['please', 'v'], ['pleasing', 'ing'], ['pleasure', 'n'], ['pleased', 'ed']], a: 3,
      owner: 'board members', v: 'please', rel: 'feel', slot: 'comp', main: 'were', cue: ['with', 'prep'],
      tag: '감정 · 느끼는 쪽 + with', type: 29, ko: '이사들은 1분기 실적에 기뻐했어요.' },
    { q: 'Sales figures for the third quarter were ___, so the director called an urgent meeting.', opts: [['disappointed', 'ed'], ['disappointingly', 'adv'], ['disappointing', 'ing'], ['disappoint', 'v']], a: 2,
      owner: 'Sales figures', v: 'disappoint', rel: 'cause', slot: 'comp', main: 'were', ko3: '실적은 감정을 느낄 수 없어요. 실망한 건 사람들이에요.',
      tag: '감정 · 일으키는 쪽', type: 29, ko: '3분기 판매 실적이 실망스러워서 부장이 급히 회의를 열었어요.' },
    { q: 'When ___ the online form, please use your full legal name.', opts: [['completion', 'n'], ['completing', 'ing'], ['completed', 'ed'], ['complete', 'v']], a: 1,
      owner: 'please use', you: true, v: 'complete', rel: 'do', slot: 'clause', conj: 'When', cue: ['the online form', 'obj'],
      tag: '접속사 + 분사구문 · 하는 쪽', type: 30, ko: '온라인 양식을 작성할 때는 법적 이름을 모두 쓰세요.' },
    { q: 'Once ___ by the director, the budget will be sent to the finance team.', opts: [['approving', 'ing'], ['approval', 'n'], ['approves', 'v'], ['approved', 'ed']], a: 3,
      owner: 'the budget', v: 'approve', rel: 'done', slot: 'clause', conj: 'Once', cue: ['by the director', 'by'],
      tag: '접속사 + 분사구문 · 당하는 쪽', type: 30, ko: '부장이 승인하면, 예산안은 재무팀으로 보내져요.' },
    { q: '___ in 1998, Hanbit Foods now operates more than 40 stores nationwide.', opts: [['Founded', 'ed'], ['Founding', 'ing'], ['Founds', 'v'], ['Founder', 'n']], a: 0,
      owner: 'Hanbit Foods', v: 'found', rel: 'done', slot: 'clause', main: 'operates', cue: ['in 1998', 'time'],
      tag: '분사구문 · 당하는 쪽', type: 30, ko: '1998년에 세워진 한빛푸드는 지금 전국에 40개가 넘는 매장을 운영해요.' },
    { q: 'Before ___ the building, all visitors must return their badges to the front desk.', opts: [['leave', 'v'], ['left', 'ed'], ['leaving', 'ing'], ['leaves', 'v']], a: 2,
      owner: 'all visitors', v: 'leave', rel: 'do', slot: 'clause', conj: 'Before', cue: ['the building', 'obj'],
      tag: 'before + -ing', type: 30, ko: '건물을 나가기 전에 모든 방문객은 안내 데스크에 출입증을 돌려줘야 해요.' },
    { q: '___ by the positive reviews, the owner decided to open a second store.', opts: [['Encouraging', 'ing'], ['Encouraged', 'ed'], ['Encourage', 'v'], ['Encouragement', 'n']], a: 1,
      owner: 'the owner', v: 'encourage', rel: 'feel', slot: 'clause', main: 'decided', cue: ['by the positive reviews', 'by'],
      tag: '분사구문 · 감정을 느끼는 쪽', type: 30, ko: '좋은 후기에 힘을 얻은 주인은 두 번째 가게를 열기로 했어요.' },
  ];
  PT.ctxOf = it => ({ slot: it.slot, rel: it.rel, v: it.v, owner: it.you ? 'you' : it.owner, obj: !!(it.cue && it.cue[1] === 'obj'), conj: it.conj, main: it.main || '' });
  PT.judgeOpt = (it, k) => PT.judge(it.opts[k][1], PT.ctxOf(it));

  // 3단계 풀이 (연습 문제 힌트). ① 주인 ② 질문 ③ 확인
  const L = 'ABCD';
  PT.steps = function (it) {
    const c = PT.ctxOf(it), D = V[it.v], R = PT.REL[it.rel];
    const out = step => it.opts.map((o, k) => [k, PT.judgeOpt(it, k)]).filter(([, j]) => j.step === step).map(([k]) => `(${L[k]}) ${it.opts[k][0]}`);
    const o1 = out(1), o2 = out(2), own = it.you ? 'you' : it.owner;
    let t1;
    if (it.slot === 'pre') t1 = `빈칸이 바로 뒤의 명사를 꾸며요. 주인 = ${it.owner}.`;
    else if (it.slot === 'post') t1 = `빈칸이 앞의 명사를 뒤에서 꾸며요. 주인 = ${it.owner}. 문장의 동사는 따로 있어요 → ${it.main}.`;
    else if (it.slot === 'comp') t1 = it.main ? `be동사 뒤 보어예요. 빈칸이 설명하는 주인 = 주어 ${it.owner}.` : `목적어 뒤 보어예요. 빈칸이 설명하는 주인 = 목적어 ${it.owner}.`;
    else if (it.you) t1 = `${it.conj} + 분사구문이에요. 주절이 명령문(${it.owner} ~)이라 주인 = 숨은 주어 you.`;
    else t1 = `${it.conj ? it.conj + ' + ' : ''}분사구문이에요. 주인 = 콤마 뒤 주절의 주어 → ${it.owner}.`;
    t1 += o1.length ? ` 분사가 아닌 보기 탈락: ${o1.join(' · ')}.` : '';
    let t2;
    if (it.rel === 'vi') t2 = `${D.w} = ${D.mean}, 목적어 없이 쓰는 자동사예요. ${own} → ${D.ko[0]} 쪽, 당할 수가 없어요 → -ing.`;
    else if (D.type === 'emo') t2 = `${own} → 감정을 일으키나요(${D.ko[0]}), 느끼나요(${D.ko[1]})? → ${R.name} → ${R.form === 'ing' ? '-ing' : '-ed'}.`;
    else t2 = `${own} → ${D.ko[0]} 쪽일까요, ${D.ko[1]} 쪽일까요? → ${R.name} → ${R.form === 'ing' ? '-ing' : '-ed'}.`;
    t2 += o2.length ? ` 탈락: ${o2.join(' · ')}.` : '';
    const cue = it.cue || [];
    let t3 = cue[1] === 'obj' ? `뒤에 목적어가 있어요 → ${cue[0]}. 목적어를 가질 수 있는 건 -ing예요.`
      : cue[1] === 'by' ? (it.rel === 'feel' ? `뒤에 by + 감정을 일으킨 것 → ${cue[0]}. 주인이 감정을 느끼는 쪽이 맞아요.` : `뒤에 by + 하는 쪽 → ${cue[0]}. 주인이 당하는 쪽이 맞아요.`)
      : cue[1] === 'prep' ? `감정을 느끼는 쪽 뒤에 자주 오는 전치사 → ${cue[0]}. (pleased with · interested in · excited about)`
      : cue[1] === 'time' ? `뒤에 목적어 없이 시간·장소 표현뿐이에요 → ${cue[0]}.`
      : it.rel === 'vi' ? '자동사는 늘 -ing로 명사를 꾸며요.' : '';
    if (it.conj && /^(before|after)$/i.test(it.conj)) t3 += ` ${it.conj} 뒤에는 -ing가 와요.`;
    if (it.ko3) t3 += (t3 ? ' ' : '') + it.ko3;
    t3 += ` 정답 (${L[it.a]}) ${it.opts[it.a][0]}.`;
    const m1 = [{ t: it.owner, role: it.you ? 'verb' : 'ante' }].concat(it.main && it.slot !== 'comp' ? [{ t: it.main, role: 'verb' }] : []).concat(it.trap ? [{ t: it.trap, role: 'trap' }] : []);
    return [
      { head: '① 주인을 찾아요.', text: t1.trim(), marks: m1 },
      { head: '② 주인에게 물어요.', text: t2, marks: [] },
      { head: '③ 뒤를 보고 확인해요.', text: t3.trim(), marks: cue[0] ? [{ t: cue[0], role: cue[1] === 'time' ? 'trap' : 'cue' }] : [] },
    ];
  };
  PT.drillItems = () => PT.DRILL.map(it => ({
    q: it.q, opts: it.opts.map(o => o[0]), a: it.a, ko: it.ko, tag: it.tag, steps: PT.steps(it),
    notes: it.opts.map(([, code], k) => { const j = PT.judgeOpt(it, k); return `${PT.formName(code)}. ` + (j.s === 'ok' ? '' : '× ') + j.why; }),
  }));

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용 — 직접 해 보기·놀이터로만 나오는 글자 포함)
  PT.allText = function () {
    const out = [];
    Object.values(V).forEach(D => out.push(D.f.join(' '), D.mean, D.ko.join('')));
    PT.LAB.forEach(E => { out.push(E.L, E.R || '', E.act || '', E.pass || ''); if (E.phr) out.push(E.phr.L.join(''), E.phr.R.join('')); E.owners.forEach(O => out.push(O.n, PT.explain(E, O).fills.map(f => f.text).join(''))); });
    PT.FORMS01.forEach(F => out.push(F.ko.join(''), F.pre.join(''), F.post.join('')));
    PT.WHEN.forEach(w => out.push(w.t, w.s, w.ko));
    PT.EMO.forEach(e => out.push(e.s, e.L, e.R, e.cause, e.feel, e.ko.join('')));
    Object.values(PT.REL).forEach(r => out.push(r.name));
    out.push(Object.values(PT.SLOT).join(''), Object.values(PT.AFTER).join(''), '하는 쪽당하는 쪽일으키는 쪽느끼는 쪽받는 쪽 없음주인');
    return out.join('');
  };

  // 데이터 점검: 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, 단서가 문장에 있는지, 관계와 동사 종류·목적어가 맞는지, 보기 글자가 사전과 같은지, 정답 위치가 고르게 섞였는지
  PT.check = function () {
    const bad = [];
    const relCheck = (where, v, rel, hasObj) => {
      if (!V[v]) { bad.push(`${where}: 동사 사전에 ${v}가 없어요`); return; }
      if (!PT.relFits(v, rel)) bad.push(`${where}: ${v}(${V[v].type})와 관계 ${rel}가 맞지 않아요`);
      if (hasObj && PT.REL[rel].side === 'R') bad.push(`${where}: 당하는 쪽(느끼는 쪽)인데 뒤에 목적어가 있어요`);
      if (hasObj && rel === 'vi') bad.push(`${where}: 자동사인데 뒤에 목적어가 있어요`);
    };
    PT.DRILL.forEach((it, i) => {
      const w = `연습 문제 ${i + 1}`;
      relCheck(w, it.v, it.rel, it.cue && it.cue[1] === 'obj');
      const good = it.opts.map((o, k) => PT.judgeOpt(it, k).s === 'ok' ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      [it.owner, it.main, it.conj, it.trap, it.cue && it.cue[0]].filter(Boolean).forEach(t => { if (!it.q.includes(t)) bad.push(`${w}: 단서 ‘${t}’가 문장에 없어요`); });
      if ((it.q.match(/___/g) || []).length !== 1) bad.push(`${w}: 빈칸이 하나가 아니에요`);
      it.opts.forEach(([o, code]) => { const want = V[it.v] && PT.wordOf(it.v, code); if (want && o.toLowerCase() !== want) bad.push(`${w}: 보기 ${o}가 ${code} 모양(${want})과 달라요`); });
      if (it.slot === 'clause' && !it.you && !it.q.includes(', ' + it.owner)) bad.push(`${w}: 분사구문의 주인이 콤마 바로 뒤에 없어요`);
    });
    const pos = [0, 0, 0, 0]; PT.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 1) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    // 놀이터: 문장마다 두 모양 가운데 꼭 하나만 맞아야 해요
    PT.LAB.forEach(E => E.owners.forEach(O => {
      const w = `놀이터 ${E.v}·${O.n}`;
      relCheck(w, E.v, O.rel, !!O.obj);
      if (!O.frame.includes('___')) bad.push(`${w}: 빈칸이 없어요`);
      [O.obj, O.by, O.prep, O.main].filter(Boolean).forEach(t => { if (!O.frame.includes(t)) bad.push(`${w}: ‘${t}’가 문장에 없어요`); });
      if (!new RegExp('\\b' + O.n + '\\b', 'i').test(O.frame)) bad.push(`${w}: 주인이 문장에 없어요`);
      const X = PT.explain(E, O), oks = X.fills.filter(f => f.j.s === 'ok');
      if (oks.length !== 1 || oks[0].code !== PT.REL[O.rel].form) bad.push(`${w}: 맞는 모양이 하나가 아니에요`);
    }));
    PT.LAB.filter(E => E.phr).forEach(E => ['L', 'R'].forEach(s => E.phr[s].slice(1).filter(Boolean).forEach(t => { if (!E.phr[s][0].includes(t)) bad.push(`02장 ${E.v}: ‘${t}’가 덩어리에 없어요`); })));
    PT.FORMS01.forEach(F => { if (!F.pre[0].includes(PT.ed(F.v)) || !F.post[2].startsWith(PT.ed(F.v))) bad.push(`01장 ${F.v}: 과거분사가 예문과 달라요`); });
    PT.EMO.forEach(e => { if (!e.cause.includes(PT.ing(e.v)) || !e.feel.includes(PT.ed(e.v))) bad.push(`05장 ${e.v}: 분사가 예문과 달라요`); relCheck(`05장 ${e.v}`, e.v, 'cause'); });
    PT.SORT_EMO.concat(PT.SORT_CONJ).forEach((it, i) => {
      relCheck(`직접 해 보기 고르기 ${i + 1}`, it.v, it.rel, it.obj);
      const js = ['ing', 'ed'].map(code => PT.judge(code, PT.sortCtx(it)).s);
      if (js.filter(s => s === 'ok').length !== 1) bad.push(`직접 해 보기 고르기 ${i + 1}: 맞는 모양이 하나가 아니에요`);
    });
    PT.SORT_VI.forEach(v => { if (!V[v]) bad.push(`자동사 고르기: ${v}가 사전에 없어요`); });
    bad.forEach(b => console.warn('[분사] ' + b));
    return bad;
  };
})();
