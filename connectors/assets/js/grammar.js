/* 연결어 튜토리얼 — 규칙 엔진과 예문
 *
 * 연결어 문제는 보기에 접속사·전치사·접속부사가 섞여 있거나, 같은 갈래인데 뜻만 달라요.
 * 답은 ① 빈칸 뒤(명사구냐 절이냐) → ② 갈래(전치사·접속사·접속부사) → ③ 뜻(대조·이유·조건·시간) 순서로 정합니다.
 * 영상의 ✓·×, 직접 해 보기, 놀이터(연결어 조립대), 연습 문제, 퀴즈가 모두 judge()로 정답을 정하고,
 * 문제 데이터에 적은 정답이 judge()와 다르면 콘솔에 경고를 냅니다.
 *
 * 갈래(kind): conj 접속사 · prep 전치사 · adv 접속부사 · pair 짝 접속사(either … or) · coord 등위접속사(but)
 * 뜻(mean):  contrast 대조·양보 · reason 이유 · result 결과 · cond 조건 · neg 부정 조건 · time 시간 · add 추가
 *            purpose 목적 · about 관련 · incl 포함 · behalf 대표 · instead 대신
 * 틀(frame): np   빈칸 + 명사(구)                          → 전치사
 *            cl   빈칸 + 주어 + 동사 (다른 절과 한 문장)      → 접속사
 *            adv  마침표·세미콜론 + 빈칸 + 쉼표 + 문장       → 접속부사
 *            pair 짝 낱말이 있는 자리 (either … ___)         → 짝의 다른 쪽
 * judge(word, slot) → { s: 'ok' | 'no', why, step }   slot = { f, m } 또는 { f: 'pair', need, with }
 *   step: 틀린 까닭이 어느 단계에서 드러나는지 (2 갈래 · 3 뜻)
 */
(function () {
  'use strict';
  const LK = (window.LK = {});

  const KIND = { conj: '접속사', prep: '전치사', adv: '접속부사', pair: '짝 접속사', coord: '등위접속사' };
  const MEAN = {
    contrast: '대조', reason: '이유', result: '결과', cond: '조건', neg: '부정 조건', time: '시간', add: '추가',
    purpose: '목적', about: '관련', incl: '포함', behalf: '대표', instead: '대신',
  };
  const FRAME = {
    np: { need: 'prep', name: '전치사 자리', sign: '빈칸 뒤가 동사 없는 명사(구)' },
    cl: { need: 'conj', name: '접속사 자리', sign: '빈칸 뒤가 주어 + 동사(절)' },
    adv: { need: 'adv', name: '접속부사 자리', sign: '빈칸 앞 마침표·세미콜론, 뒤 쉼표 + 문장' },
    pair: { need: 'pair', name: '짝 접속사 자리', sign: '앞이나 뒤에 짝 낱말' },
  };
  LK.KIND = KIND; LK.MEAN = MEAN; LK.FRAME = FRAME;

  /* ---------- 연결어 사전: [낱말, [[갈래, 뜻], …], 한국어 뜻] ---------- */
  const LEX = {};
  [
    // 접속사 (부사절 접속사)
    ['although', [['conj', 'contrast']], '~이지만'],
    ['though', [['conj', 'contrast']], '~이지만'],
    ['even though', [['conj', 'contrast']], '~이긴 하지만'],
    ['whereas', [['conj', 'contrast']], '~인 반면'],
    ['while', [['conj', 'time'], ['conj', 'contrast']], '~하는 동안 · ~인 반면'],
    ['because', [['conj', 'reason']], '~ 때문에'],
    ['since', [['conj', 'reason'], ['conj', 'time'], ['prep', 'time']], '~ 때문에 · ~ 이후로'],
    ['if', [['conj', 'cond']], '~하면'],
    ['unless', [['conj', 'neg']], '~하지 않으면'],
    ['once', [['conj', 'time'], ['conj', 'cond']], '일단 ~하면'],
    ['as long as', [['conj', 'cond']], '~하는 한'],
    ['provided that', [['conj', 'cond']], '~라면'],
    ['so that', [['conj', 'purpose']], '~하도록'],
    ['when', [['conj', 'time']], '~할 때'],
    ['as soon as', [['conj', 'time']], '~하자마자'],
    ['before', [['conj', 'time'], ['prep', 'time']], '~ 전에'],
    ['after', [['conj', 'time'], ['prep', 'time']], '~ 뒤에'],
    ['until', [['conj', 'time'], ['prep', 'time']], '~까지'],
    // 전치사 (여러 낱말·-ing 꼴 포함)
    ['despite', [['prep', 'contrast']], '~에도 불구하고'],
    ['in spite of', [['prep', 'contrast']], '~에도 불구하고'],
    ['because of', [['prep', 'reason']], '~ 때문에'],
    ['due to', [['prep', 'reason']], '~ 때문에'],
    ['owing to', [['prep', 'reason']], '~ 때문에'],
    ['during', [['prep', 'time']], '~ 동안'],
    ['prior to', [['prep', 'time']], '~ 전에'],
    ['following', [['prep', 'time']], '~ 뒤에'],
    ['without', [['prep', 'neg']], '~ 없이'],
    ['in addition to', [['prep', 'add']], '~에 더해'],
    ['on behalf of', [['prep', 'behalf']], '~을 대표해'],
    ['including', [['prep', 'incl']], '~을 포함해'],
    ['regarding', [['prep', 'about']], '~에 관해'],
    ['concerning', [['prep', 'about']], '~에 관해'],
    ['instead of', [['prep', 'instead']], '~ 대신'],
    // 접속부사
    ['however', [['adv', 'contrast']], '그러나'],
    ['nevertheless', [['adv', 'contrast']], '그런데도'],
    ['therefore', [['adv', 'result']], '그러므로'],
    ['as a result', [['adv', 'result']], '그 결과'],
    ['consequently', [['adv', 'result']], '그 결과'],
    ['moreover', [['adv', 'add']], '게다가'],
    ['furthermore', [['adv', 'add']], '더욱이'],
    ['in addition', [['adv', 'add']], '게다가'],
    ['otherwise', [['adv', 'neg']], '그렇지 않으면'],
    ['meanwhile', [['adv', 'time']], '그동안'],
    ['instead', [['adv', 'instead']], '그 대신'],
    // 짝 접속사 (앞쪽 · 뒤쪽)
    ['either', [['pair', '']], '둘 중 하나'], ['or', [['pair', '']], '또는'],
    ['neither', [['pair', '']], '둘 다 아님'], ['nor', [['pair', '']], '~도 아닌'],
    ['both', [['pair', '']], '둘 다'], ['and', [['pair', '']], '그리고'],
    ['not only', [['pair', '']], '~뿐 아니라'], ['but also', [['pair', '']], '~도'],
    ['but', [['coord', '']], '그러나'],
  ].forEach(([w, s, ko]) => { LEX[w] = { w, s, ko, kinds: [...new Set(s.map(x => x[0]))] }; });
  LK.LEX = LEX;
  LK.word = w => LEX[String(w).toLowerCase()];
  LK.kindName = w => { const d = LK.word(w); return d ? d.kinds.map(k => KIND[k]).join('·') : ''; };
  LK.meanName = w => { const d = LK.word(w); return d ? [...new Set(d.s.map(x => x[1]).filter(Boolean))].map(m => MEAN[m]).join('·') : ''; };

  // 짝 접속사: 앞쪽 → 뒤쪽
  const PAIR = { either: 'or', neither: 'nor', both: 'and', 'not only': 'but also' };
  const PAIR_BACK = Object.fromEntries(Object.entries(PAIR).map(([a, b]) => [b, a]));
  LK.PAIR = PAIR;
  LK.partner = w => { w = String(w).toLowerCase(); return PAIR[w] || PAIR_BACK[w] || ''; };
  const pairName = w => { w = String(w).toLowerCase(); return PAIR[w] ? `${w} … ${PAIR[w]}` : PAIR_BACK[w] ? `${PAIR_BACK[w]} … ${w}` : w; };
  LK.pairName = pairName;

  /* ---------- 판정 ---------- */
  // 갈래가 틀린 까닭: [틀][낱말의 갈래]
  const KINDWHY = {
    np: {
      conj: '접속사 뒤에는 주어 + 동사(절)가 와야 해요. 빈칸 뒤는 동사 없는 명사(구)예요.',
      adv: '접속부사는 명사(구)를 이끌지 못해요. 마침표 뒤에서 쉼표와 함께 써요.',
    },
    cl: {
      prep: '전치사 뒤에는 명사(구)만 와요. 빈칸 뒤에 주어 + 동사가 있어요.',
      adv: '접속부사는 두 절을 잇지 못해요. 절과 절 사이에는 접속사가 필요해요.',
    },
    adv: {
      conj: '마침표 뒤 문장에는 절이 하나뿐이라, 접속사가 이을 짝이 없어요.',
      prep: '전치사 뒤에는 명사(구)가 와야 하는데, 쉼표와 문장이 이어져요.',
    },
  };
  const ok = (why, step = 3) => ({ s: 'ok', why, step }), no = (why, step) => ({ s: 'no', why, step });

  LK.judge = function (w, slot) {
    const d = LK.word(w);
    if (!d) return no('사전에 없는 말이에요.', 2);
    if (slot.f === 'pair') {
      const need = slot.need.toLowerCase();
      if (d.w === need) return ok(`짝 ${pairName(need)} → 맞아요.`);
      if (d.kinds.includes('pair')) return no(`${d.w} → 짝은 ${pairName(d.w)}. 이 문장의 짝은 ${pairName(need)}.`, 3);
      return no(`${d.w} → 혼자서는 짝이 아니에요. 이 문장의 짝은 ${pairName(need)}.`, 3);
    }
    const F = FRAME[slot.f], need = F.need;
    const fit = d.s.filter(([k]) => k === need);
    if (!fit.length) {
      const k = d.kinds[0];
      if (k === 'pair') return no('짝 접속사의 한쪽이에요. 짝 낱말(either … or)이 함께 있을 때만 써요.', 2);
      if (k === 'coord') return no('but → 등위접속사. 이 틀에서는 쓰지 않아요.', 2);
      return no(KINDWHY[slot.f][k] || `${F.name}가 아니에요.`, 2);
    }
    if (fit.some(([, m]) => m === slot.m)) return ok(`${F.name}. 뜻 ‘${d.ko}’ → ${MEAN[slot.m]} 관계에 맞아요.`);
    const ms = [...new Set(fit.map(([, m]) => MEAN[m]))].join('·');
    return no(`갈래는 맞지만 뜻이 달라요. ‘${d.ko}’ → ${ms}. 여기는 ${MEAN[slot.m]} 관계가 필요해요.`, 3);
  };
  LK.isOk = (w, slot) => LK.judge(w, slot).s === 'ok';
  // 이 틀과 뜻에 맞는 연결어 (목록을 주면 그 안에서)
  LK.fits = (slot, list) => (list || Object.keys(LEX)).filter(w => LK.isOk(w, slot));

  /* ---------- 빈칸 앞뒤 단서 → 틀 (영상 08장 판정기) ----------
   * left:  start 문장 맨 앞 · mid 절 뒤(문장 가운데) · stop 마침표·세미콜론 뒤 · pair 앞이나 뒤에 짝 낱말
   * right: np 명사(구) · -ing 덩어리 · cl 주어 + 동사(절) · sent 쉼표 + 완전한 문장
   */
  LK.LEFT = { start: '문장 맨 앞', mid: '절 뒤 (문장 가운데)', stop: '마침표 · 세미콜론 뒤', pair: '짝 낱말 (either · neither · both · not only)' };
  LK.RIGHT = { np: '명사(구) · -ing 덩어리', cl: '주어 + 동사 (절)', sent: '쉼표 + 완전한 문장' };
  LK.frameFromCues = function (L, R) {
    if (L === 'pair') return 'pair';
    if (R === 'np') return 'np';
    if (R === 'cl') return 'cl';
    if (R === 'sent') return L === 'stop' || L === 'start' ? 'adv' : null;
    return null;
  };

  /* ---------- 같은 뜻, 세 갈래 (영상 03장, 놀이터의 표) ---------- */
  // ex: 같은 뜻을 세 갈래로 쓴 예문 (직접 해 보기)
  LK.TABLE = [
    { m: 'contrast', name: '대조·양보', ko: '~지만', conj: ['although', 'even though'], prep: ['despite', 'in spite of'], adv: ['however', 'nevertheless'],
      ex: { conj: 'Although it rained, the concert continued.', prep: 'Despite the rain, the concert continued.', adv: 'It rained. However, the concert continued.' } },
    { m: 'reason', name: '이유 → 결과', ko: '~ 때문에 · 그래서', conj: ['because', 'since'], prep: ['because of', 'due to'], adv: ['therefore', 'as a result'], advM: 'result',
      ex: { conj: 'Because the train was delayed, we missed the speech.', prep: 'Due to the train delay, we missed the speech.', adv: 'The train was delayed. Therefore, we missed the speech.' } },
    { m: 'time', name: '시간', ko: '~ 동안 · ~ 전에', conj: ['while', 'before'], prep: ['during', 'prior to'], adv: ['meanwhile'],
      ex: { conj: 'While the guests were arriving, the staff set the tables.', prep: 'During the reception, the staff set the tables.', adv: 'The guests were arriving. Meanwhile, the staff set the tables.' } },
    { m: 'neg', name: '부정 조건', ko: '~하지 않으면', conj: ['unless'], prep: ['without'], adv: ['otherwise'],
      ex: { conj: 'Unless you have a pass, you cannot enter the lab.', prep: 'Without a pass, you cannot enter the lab.', adv: 'You need a pass. Otherwise, you cannot enter the lab.' } },
    { m: 'add', name: '추가', ko: '게다가', conj: [], prep: ['in addition to'], adv: ['moreover', 'in addition'],
      ex: { prep: 'In addition to its low price, the printer is fast.', adv: 'The printer is cheap. Moreover, it is fast.' } },
  ];
  // 같은 뜻의 다른 갈래 (예: although → prep → despite, in spite of)
  LK.swap = function (w, kind) {
    const row = LK.TABLE.find(r => ['conj', 'prep', 'adv'].some(k => r[k].includes(String(w).toLowerCase())));
    return row ? row[kind] : [];
  };

  /* ---------- 빈칸 뒤 조각: 명사구냐 절이냐 (영상 02장, 직접 해 보기, 퀴즈 그림) ---------- */
  LK.FRAGS = [
    { t: 'the heavy rain', f: 'np' },
    { t: 'it rained heavily', f: 'cl', subj: 'it', verb: 'rained' },
    { t: 'being late', f: 'np', ing: true },
    { t: 'the store was crowded', f: 'cl', subj: 'the store', verb: 'was' },
    { t: 'his long experience', f: 'np' },
    { t: 'we missed the train', f: 'cl', subj: 'we', verb: 'missed' },
    { t: 'having little experience', f: 'np', ing: true },
    { t: 'the new policy', f: 'np' },
    { t: 'the long delay', f: 'np' },
  ];
  LK.frag = t => LK.FRAGS.find(f => f.t === t);
  LK.fragWhy = fr => fr.f === 'cl'
    ? `절 — 주어 ${fr.subj}, 동사 ${fr.verb}. 접속사(although)가 와요.`
    : fr.ing ? '명사구 — -ing 덩어리(동명사)는 명사처럼 써요. 전치사(despite)가 와요.'
      : '명사구 — 동사가 없어요. 전치사(despite)가 와요.';

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * slot: 틀과 뜻, back: 빈칸 뒤 덩어리(문장 속 글자), subj·verb: 절의 주어·동사, rel: 앞뒤 관계를 한국어로
   */
  LK.DRILL = [
    { q: '___ the heavy rain, the outdoor concert was not canceled.', opts: ['Although', 'Despite', 'However', 'Because'], a: 1,
      slot: { f: 'np', m: 'contrast' }, back: 'the heavy rain', rel: '비가 많이 왔는데도 공연은 취소되지 않음', tag: '전치사 vs 접속사', ko: '폭우에도 불구하고 야외 공연은 취소되지 않았어요.' },
    { q: '___ the store was crowded, the staff served every customer quickly.', opts: ['Despite', 'Because of', 'Even though', 'Therefore'], a: 2,
      slot: { f: 'cl', m: 'contrast' }, back: 'the store was crowded', subj: 'the store', verb: 'was', rel: '붐볐는데도 빠르게 응대함', tag: '접속사 vs 전치사', ko: '가게가 붐볐지만 직원들은 모든 손님을 빠르게 응대했어요.' },
    { q: 'Please keep your mobile phone switched off ___ the presentation.', opts: ['while', 'whereas', 'unless', 'during'], a: 3,
      slot: { f: 'np', m: 'time' }, back: 'the presentation', rel: '발표가 이어지는 동안', tag: 'during vs while', ko: '발표하는 동안 휴대 전화를 꺼 두세요.' },
    { q: 'The flight to Jeju was delayed ___ a mechanical problem.', opts: ['due to', 'because', 'although', 'so that'], a: 0,
      slot: { f: 'np', m: 'reason' }, back: 'a mechanical problem', rel: '기계 문제가 지연의 원인', tag: '덩어리 전치사 · 이유', ko: '제주행 항공편이 기계 문제 때문에 늦어졌어요.' },
    { q: '___ you register by Friday, the early-bird discount will not apply.', opts: ['Despite', 'Because', 'Whereas', 'Unless'], a: 3,
      slot: { f: 'cl', m: 'neg' }, back: 'you register', subj: 'you', verb: 'register', rel: '금요일까지 등록하지 않으면 할인이 없음', tag: '접속사의 뜻 · unless', ko: '금요일까지 등록하지 않으면 조기 등록 할인이 적용되지 않아요.' },
    { q: 'You may borrow the company van ___ you return it by 6 P.M.', opts: ['even though', 'as long as', 'so that', 'whereas'], a: 1,
      slot: { f: 'cl', m: 'cond' }, back: 'you return it', subj: 'you', verb: 'return', rel: '6시까지 돌려준다면 빌려도 됨', tag: '접속사의 뜻 · as long as', ko: '오후 6시까지 돌려주기만 하면 회사 승합차를 빌려도 돼요.' },
    { q: 'Please speak into the microphone ___ everyone in the hall can hear you.', opts: ['so that', 'whereas', 'although', 'because of'], a: 0,
      slot: { f: 'cl', m: 'purpose' }, back: 'everyone in the hall can hear you', subj: 'everyone', verb: 'can hear', rel: '모두가 들을 수 있게 하려는 것', tag: '접속사의 뜻 · so that', ko: '홀에 있는 모든 사람이 들을 수 있도록 마이크에 대고 말해 주세요.' },
    { q: 'Sales of the new model rose in Asia, ___ they fell slightly in Europe.', opts: ['despite', 'unless', 'whereas', 'so that'], a: 2,
      slot: { f: 'cl', m: 'contrast' }, back: 'they fell', subj: 'they', verb: 'fell', rel: '아시아는 늘고 유럽은 줄어 서로 맞섬', tag: '접속사의 뜻 · whereas', ko: '새 모델의 판매가 아시아에서는 늘었지만, 유럽에서는 조금 줄었어요.' },
    { q: 'Applications can be submitted either online ___ by mail.', opts: ['and', 'nor', 'or', 'but'], a: 2,
      slot: { f: 'pair', need: 'or', with: 'either' }, tag: '짝 접속사 · either', ko: '지원서는 온라인이나 우편으로 낼 수 있어요.' },
    { q: '___ the manager nor her assistant was available for comment.', opts: ['Either', 'Both', 'Not only', 'Neither'], a: 3,
      slot: { f: 'pair', need: 'neither', with: 'nor' }, tag: '짝 접속사 · nor', ko: '매니저도 비서도 질문에 답할 수 없었어요.' },
    { q: 'The new laptop is not only lighter ___ faster than the previous model.', opts: ['but also', 'and', 'or', 'nor'], a: 0,
      slot: { f: 'pair', need: 'but also', with: 'not only' }, tag: '짝 접속사 · not only', ko: '새 노트북은 이전 모델보다 가벼울 뿐 아니라 더 빨라요.' },
    { q: 'Our sales rose last quarter. ___, our profits fell.', opts: ['Although', 'However', 'Despite', 'Therefore'], a: 1,
      slot: { f: 'adv', m: 'contrast' }, rel: '매출은 올랐는데 이익은 줄어 반대', tag: '접속부사 · however', ko: '지난 분기에 매출은 올랐어요. 그러나 이익은 줄었어요.' },
    { q: 'Please submit your expense report by noon; ___, it will not be processed until next month.', opts: ['unless', 'moreover', 'in addition to', 'otherwise'], a: 3,
      slot: { f: 'adv', m: 'neg' }, rel: '정오까지 내지 않으면 다음 달에 처리됨', tag: '접속부사 · otherwise', ko: '경비 보고서를 정오까지 내 주세요. 그렇지 않으면 다음 달에야 처리돼요.' },
    { q: 'The hotel is only ten minutes from the airport. ___, it offers free breakfast to all guests.', opts: ['In addition to', 'Despite', 'Moreover', 'Unless'], a: 2,
      slot: { f: 'adv', m: 'add' }, rel: '좋은 점에 좋은 점을 더함', tag: '접속부사 vs 전치사 · in addition to 함정', ko: '그 호텔은 공항에서 10분 거리예요. 게다가 모든 손님에게 무료 아침을 줘요.' },
    { q: '___ the board meeting, please review the attached agenda.', opts: ['Due to', 'Prior to', 'Moreover', 'As soon as'], a: 1,
      slot: { f: 'np', m: 'time' }, back: 'the board meeting', rel: '회의보다 먼저 안건을 봄', tag: '덩어리 전치사 · prior to', ko: '이사회 회의 전에 첨부한 안건을 검토해 주세요.' },
    { q: '___ the merger, the company will move its headquarters to Busan.', opts: ['Following', 'Although', 'Meanwhile', 'Unless'], a: 0,
      slot: { f: 'np', m: 'time' }, back: 'the merger', rel: '합병 뒤에 본사를 옮김', tag: '-ing 꼴 전치사 · following', ko: '합병 뒤에 회사는 본사를 부산으로 옮길 거예요.' },
  ];
  LK.judgeOpt = (it, k) => LK.judge(it.opts[k], it.slot);

  // 빈칸 앞의 마침표·세미콜론을 표시하려면 몇 번째인지 알아야 함 (연습 문제 공통 부품의 nth)
  LK.stopMark = function (q) {
    const b = q.indexOf('___'), p = Math.max(q.lastIndexOf('.', b), q.lastIndexOf(';', b));
    if (p < 0) return null;
    const ch = q[p]; let nth = 0, i = -1;
    while ((i = q.indexOf(ch, i + 1)) >= 0 && i < p) nth++;
    return { t: ch, nth };
  };

  // 3단계 풀이 (연습 문제 힌트). ① 뒤 ② 갈래 ③ 뜻
  LK.steps = function (it) {
    const sl = it.slot, ans = it.opts[it.a];
    if (sl.f === 'pair') {
      const wi = it.q.toLowerCase().indexOf(sl.with), b = it.q.indexOf('___');
      const where = wi < b ? '앞' : '뒤';
      const m = it.q.substr(wi, sl.with.length);
      return [
        { head: '① 앞뒤를 봐요.', text: `빈칸 ${where}에 ‘${m}’ → 짝을 이루는 낱말이 보여요.`, marks: [{ t: m, role: 'cue' }] },
        { head: '② 갈래를 정해요.', text: '짝 접속사 자리 → 짝이 맞는 말만 들어가요.', marks: [] },
        { head: '③ 짝을 맞춰요.', text: `${pairName(sl.need)} → ${ans}.`, marks: [] },
      ];
    }
    const F = FRAME[sl.f];
    let s1, m1 = [];
    if (sl.f === 'np') {
      const ing = /^\w+ing\b/.test(it.back) && !/^(the|a|an)\b/i.test(it.back);
      s1 = `빈칸 뒤 ‘${it.back}’ → 동사가 없는 명사(구)예요.` + (ing ? ' -ing 덩어리도 명사처럼 써요.' : '');
      m1 = [{ t: it.back, role: 'ante' }];
    } else if (sl.f === 'cl') {
      s1 = `빈칸 뒤 ‘${it.back}’ → 주어 ${it.subj}, 동사 ${it.verb}. 절이에요.`;
      m1 = [{ t: it.subj, role: 'ante' }, { t: it.verb, role: 'verb' }];
    } else {
      const st = LK.stopMark(it.q);
      s1 = `빈칸 앞은 ${st && st.t === ';' ? '세미콜론' : '마침표'}, 뒤는 쉼표 + 완전한 문장이에요.`;
      if (st) m1 = [{ t: st.t, nth: st.nth, role: 'cue' }];
    }
    const gone = it.opts.filter(o => LK.judge(o, sl).step === 2 && !LK.isOk(o, sl));
    const left = it.opts.filter(o => !gone.includes(o));
    const s2 = `${F.name}. ` + (gone.length ? `지울 보기: ${gone.map(o => `${o}(${LK.kindName(o)})`).join(', ')}.`
      : `보기가 모두 ${KIND[F.need]}라서 갈래로는 못 줄여요. 뜻으로 골라요.`);
    const s3 = `${it.rel} → ${MEAN[sl.m]}. ` + (left.length > 1 ? `남은 보기: ${left.map(o => `${o}(${LK.word(o).ko})`).join(', ')} → ${ans}.` : `남은 ${ans} → 뜻 ‘${LK.word(ans).ko}’도 맞아요.`);
    return [
      { head: '① 뒤를 봐요.', text: s1, marks: m1 },
      { head: '② 갈래를 정해요.', text: s2, marks: [] },
      { head: '③ 뜻을 골라요.', text: s3, marks: [] },
    ];
  };
  LK.drillItems = () => LK.DRILL.map(it => ({
    q: it.q, opts: it.opts, a: it.a, ko: it.ko, tag: it.tag, steps: LK.steps(it),
    notes: it.opts.map(w => { const j = LK.judge(w, it.slot); return `${LK.kindName(w)}. ` + (j.s === 'ok' ? '' : '× ') + j.why; }),
  }));

  /* ---------- 놀이터: 연결어 조립대 ----------
   * 두 생각(A, B)을 세 가지 틀로 이어 봄. frame: cl (연결어 + 절, 문장) · np (연결어 + 명사구, 문장) · adv (문장. 연결어, 문장)
   * m: 틀마다 연결어가 이끄는 쪽의 뜻 (접속부사는 뒤 문장 앞에 붙어서, 이유 대신 결과를 이끌기도 함)
   */
  LK.SCN = [
    { id: 'rain', name: '비와 공연', rel: '비가 많이 왔다 ↔ 공연은 계속됐다 (예상과 반대)', m: { cl: 'contrast', np: 'contrast', adv: 'contrast' },
      A: { cl: 'it rained heavily', np: 'the heavy rain', adv: 'It rained heavily.' }, B: 'the concert continued', ko: '비가 많이 왔지만 공연은 계속됐어요.' },
    { id: 'train', name: '기차와 연설', rel: '기차가 늦었다 → 개막 연설을 놓쳤다 (원인 → 결과)', m: { cl: 'reason', np: 'reason', adv: 'result' },
      A: { cl: 'the train was delayed', np: 'the train delay', adv: 'The train was delayed.' }, B: 'we missed the opening speech', ko: '기차가 늦어서 개막 연설을 놓쳤어요.' },
    { id: 'pass', name: '출입증과 실험실', rel: '출입증이 없다 → 실험실에 못 들어간다 (~하지 않으면)', m: { cl: 'neg', np: 'neg', adv: 'neg' },
      A: { cl: 'you have a visitor pass', np: 'a visitor pass', adv: 'You need a visitor pass.' }, B: 'you cannot enter the lab', ko: '출입증이 없으면 실험실에 들어갈 수 없어요.' },
  ];
  LK.PALETTE = ['although', 'even though', 'because', 'since', 'unless', 'if', 'so that',
    'despite', 'in spite of', 'because of', 'due to', 'without',
    'however', 'nevertheless', 'therefore', 'as a result', 'otherwise', 'moreover'];
  LK.FRAMES3 = { cl: '연결어 + 절, 문장', np: '연결어 + 명사구, 문장', adv: '문장. 연결어, 문장' };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // 조립한 문장과 세 단계 판정
  LK.build = function (scn, frame, w) {
    const slot = { f: frame, m: scn.m[frame] }, j = LK.judge(w, slot), d = LK.word(w);
    const text = frame === 'adv' ? `${scn.A.adv} ${cap(w)}, ${scn.B}.` : `${cap(w)} ${scn.A[frame]}, ${scn.B}.`;
    const back = frame === 'np' ? `명사구 ‘${scn.A.np}’ (동사 없음)` : frame === 'cl' ? `절 ‘${scn.A.cl}’ (주어 + 동사)` : `마침표 뒤, 쉼표 + 문장 ‘${scn.B}’`;
    const kindOk = !(j.s === 'no' && j.step === 2);
    return {
      text, slot, j,
      steps: [
        { ok: true, text: `빈칸 뒤 → ${back} → ${FRAME[frame].name}` },
        { ok: kindOk, text: kindOk ? `${w} → ${KIND[FRAME[frame].need]} · 갈래가 맞아요.` : `${w} → ${LK.kindName(w)}. ${j.why}` },
        { ok: j.s === 'ok', skip: !kindOk, text: !kindOk ? '갈래부터 맞춰야 뜻을 볼 수 있어요.' : j.s === 'ok' ? `뜻 ‘${d.ko}’ → ${MEAN[slot.m]}, 맞아요.` : j.why },
      ],
    };
  };

  // 데이터 점검: 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, 단서가 문장에 있는지, 정답 위치가 고르게 섞였는지
  LK.check = function () {
    const bad = [];
    LK.DRILL.forEach((it, i) => {
      it.opts.forEach(o => { if (!LK.word(o)) bad.push(`연습 문제 ${i + 1}: ‘${o}’가 연결어 사전에 없어요`); });
      const good = it.opts.map((o, k) => LK.isOk(o, it.slot) ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`연습 문제 ${i + 1}: 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      ['back', 'subj', 'verb'].forEach(f => { if (it[f] && !it.q.includes(it[f])) bad.push(`연습 문제 ${i + 1}: 단서 ‘${it[f]}’가 문장에 없어요`); });
      if (it.slot.f === 'cl' && !(it.subj && it.verb)) bad.push(`연습 문제 ${i + 1}: 절의 주어·동사가 없어요`);
      if (it.slot.f === 'np' && !it.back) bad.push(`연습 문제 ${i + 1}: 빈칸 뒤 명사구가 없어요`);
      if (it.slot.f === 'pair' && !it.q.toLowerCase().includes(it.slot.with)) bad.push(`연습 문제 ${i + 1}: 짝 낱말 ‘${it.slot.with}’가 문장에 없어요`);
      if (it.slot.f === 'adv' && !LK.stopMark(it.q)) bad.push(`연습 문제 ${i + 1}: 빈칸 앞 마침표가 없어요`);
      if ((it.q.match(/___/g) || []).length !== 1) bad.push(`연습 문제 ${i + 1}: 빈칸이 하나가 아니에요`);
    });
    const pos = [0, 0, 0, 0]; LK.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 2) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    LK.TABLE.forEach(r => ['conj', 'prep', 'adv'].forEach(k => r[k].forEach(w => {
      const d = LK.word(w), m = k === 'adv' && r.advM ? r.advM : r.m;
      if (!d || !d.s.some(([kk, mm]) => kk === k && mm === m)) bad.push(`표: ${w}의 갈래·뜻이 사전과 달라요`);
    })));
    LK.TABLE.forEach(r => Object.entries(r.ex || {}).forEach(([k, s]) => {
      if (!r[k].some(w => s.toLowerCase().includes(w + (k === 'adv' ? ',' : ' ')))) bad.push(`표 예문: ‘${s}’에 ${LK.KIND[k]}가 없어요`);
    }));
    LK.PALETTE.forEach(w => { if (!LK.word(w)) bad.push(`조립대: ‘${w}’가 사전에 없어요`); });
    LK.SCN.forEach(s => ['cl', 'np', 'adv'].forEach(f => { if (!LK.fits({ f, m: s.m[f] }, LK.PALETTE).length) bad.push(`조립대 ${s.id}: ${f} 틀에 맞는 연결어가 없어요`); }));
    LK.FRAGS.forEach(fr => { if (fr.f === 'cl' && !(fr.t.includes(fr.subj) && fr.t.includes(fr.verb))) bad.push(`조각 ‘${fr.t}’: 주어·동사가 조각에 없어요`); });
    bad.forEach(b => console.warn('[연결어] ' + b));
    return bad;
  };
})();
