/* 관계부사 · 복합관계사 · 명사절 튜토리얼 — 규칙 엔진과 예문
 *
 * 핵심 질문 하나: 빈칸 뒤 문장에 빈자리가 있나, 없나?
 *   빈자리 있음(불완전한 문장) → which · who · whom · what · whoever · whatever   (대명사 쪽: 빠진 명사를 대신함)
 *   빠진 것 없음(완전한 문장)  → where · when · why · how · that · whether · if · however · wherever · whenever   (부사·접속사 쪽)
 * 그다음 ② 빈칸 앞의 자리(명사 뒤 · 명사 자리 · 문장 밖)와 ③ 함정(뜻 · 전치사 · if를 못 쓰는 자리 · the way how)으로 하나를 고릅니다.
 * 영상의 ✓·×, 직접 해 보기, 놀이터(빈자리 탐지기), 연습 문제, 퀴즈가 모두 judge()로 정답을 정하고,
 * 문제 데이터에 적은 정답이 judge()와 다르면 콘솔에 경고를 냅니다(check).
 *
 * 빈칸의 상황 d — 문제마다 데이터에 적어 둡니다. 엔진이 문장을 읽어 알아내는 것이 아니에요.
 *   front : 'ante' 빈칸 앞에 꾸밀 명사(선행사) | 'noun' 빈칸 + 절이 명사 자리 | 'adv' 완전한 주절에 붙는 부사 자리
 *   ante  : (ante) 'person' | 'thing' | 'place' | 'time' | 'reason' | 'way'(the way) | 'content'(fact · news 같은 내용 명사)
 *   role  : (noun) 'subj' 주어 | 'obj' 동사의 목적어 | 'comp' 보어 | 'prep' 전치사의 목적어 | 'it' 가주어 It 뒤의 진짜 주어
 *   prep  : (ante) 빈칸 바로 앞이 전치사 (the room in ___)
 *   pw    : (ante) 이 절에 맞는 전치사 (the city in which → 'in'). '전치사 + which' 보기를 판정할 때 씀
 *   comma : (ante) 빈칸 앞 콤마 (계속적 용법)
 *   back  : 빈칸 뒤 문장 — 'subj' 주어가 빠짐 | 'obj' 목적어가 빠짐 | 'full' 빠진 것 없음
 *   next  : 빈칸 바로 뒤의 모양 — 'adj' 형용사·부사 | 'ornot' or not | 'to' to부정사
 *   sense : (noun · adv) 절의 뜻 — SENSE 참고
 *   or    : (adv) 절 안에 or (not)이 있음 (Whether you agree or not, …)
 *
 * judge(w, d) → { s: 'ok' | 'warn' | 'no', why, step, trap }
 *   step: 틀린 까닭이 드러나는 단계 (1 뒤 · 2 앞 · 3 함정)   trap: 3단계에서 걸린 함정의 이름표 (TRAP)
 *   warn: 실제 영어에서는 쓰지만 시험 답으로는 고르지 않는 경우 (관계부사 대신 쓰는 that, 형용사 없이 쓴 however 등)
 */
(function () {
  'use strict';
  const WH = (window.WH = {});

  /* ---------- 이름표 ---------- */
  const KIND = {
    rel: '관계대명사', that: '관계대명사 · 명사절 접속사', what: '선행사를 품은 관계대명사', cpro: '복합관계대명사',
    radv: '관계부사', cadv: '복합관계부사', conj: '명사절 접속사', pwhich: '전치사 + 관계대명사',
  };
  const FAM = { gap: '빈자리 쪽', full: '완전 쪽', both: '양쪽' };
  const ANTE = { person: '사람', thing: '사물', place: '장소', time: '시간', reason: '이유', way: '방법(the way)', content: '내용 명사' };
  const ROLE = { subj: '주어', obj: '목적어', comp: '보어', prep: '전치사의 목적어', it: '진짜 주어' };
  const GAPNAME = { subj: '주어', obj: '목적어' };
  const SENSE = {
    fact: '‘~라는 것’(사실)', yesno: '‘~인지 아닌지’', thing: '‘~하는 것’', person: '‘누가 ~하는지’',
    time: '‘언제’', place: '‘어디서’', reason: '‘왜’', manner: '‘어떻게’',
    'any-person': '‘~하는 사람은 누구든’', 'any-thing': '‘~하는 것은 무엇이든’', 'any-time': '‘언제 ~하든’',
    'any-place': '‘어디서 ~하든’', 'any-degree': '‘아무리 ~해도’', cond: '‘~라면’(조건)',
  };
  const TRAP = { ante: '선행사', sense: '뜻', prep: '전치사 뒤', comma: '콤마 뒤', way: 'the way how', ifpos: 'if를 못 쓰는 자리', case: '격', adj: '형용사 없음' };
  WH.KIND = KIND; WH.FAM = FAM; WH.ANTE = ANTE; WH.ROLE = ROLE; WH.SENSE = SENSE; WH.TRAP = TRAP; WH.GAPNAME = GAPNAME;

  /* ---------- 낱말 사전 ----------
   * fam: 'gap' 뒤에 빈자리 | 'full' 뒤에 완전한 문장 | 'both' 둘 다(that: 관계대명사 · 명사절 접속사)
   * sense: 이 말이 나타내는 뜻 (관계부사 · 복합관계사 · whether)   para: 풀어 쓴 꼴   ko: 한국어 뜻
   */
  const LEX = {
    which: { fam: 'gap', kind: 'rel', ko: '사물을 꾸밈' },
    who: { fam: 'gap', kind: 'rel', ko: '사람을 꾸밈 · 누가' },
    whom: { fam: 'gap', kind: 'rel', ko: '사람 · 목적격' },
    that: { fam: 'both', kind: 'that', ko: '꾸밈 · ~라는 것' },
    what: { fam: 'gap', kind: 'what', ko: '~하는 것', para: 'the thing which' },
    whoever: { fam: 'gap', kind: 'cpro', sense: 'any-person', para: 'anyone who', ko: '~하는 사람은 누구든' },
    whatever: { fam: 'gap', kind: 'cpro', sense: 'any-thing', para: 'anything that', ko: '~하는 것은 무엇이든' },
    where: { fam: 'full', kind: 'radv', sense: 'place', ante: 'place', para: 'in which', ko: '~하는 곳 · 어디서' },
    when: { fam: 'full', kind: 'radv', sense: 'time', ante: 'time', para: 'on which', ko: '~하는 때 · 언제' },
    why: { fam: 'full', kind: 'radv', sense: 'reason', ante: 'reason', para: 'for which', ko: '~하는 이유 · 왜' },
    how: { fam: 'full', kind: 'radv', sense: 'manner', ante: 'way', para: 'the way', ko: '~하는 방법 · 어떻게' },
    however: { fam: 'full', kind: 'cadv', sense: 'any-degree', para: 'no matter how', ko: '아무리 ~해도' },
    wherever: { fam: 'full', kind: 'cadv', sense: 'any-place', para: 'no matter where', ko: '어디서 ~하든' },
    whenever: { fam: 'full', kind: 'cadv', sense: 'any-time', para: 'no matter when', ko: '언제 ~하든' },
    whether: { fam: 'full', kind: 'conj', sense: 'yesno', ko: '~인지 아닌지' },
    if: { fam: 'full', kind: 'conj', sense: 'yesno', ko: '~인지 아닌지' },
  };
  ['in', 'at', 'on', 'for'].forEach(p => { LEX[p + ' which'] = { fam: 'full', kind: 'pwhich', prep: p, ko: '전치사 + which' }; });
  Object.keys(LEX).forEach(w => { LEX[w].w = w; });
  WH.LEX = LEX;
  WH.word = w => LEX[String(w).toLowerCase()];
  WH.kindName = w => { const d = WH.word(w); return d ? KIND[d.kind] : ''; };
  // 전치사 + which와 바꿔 쓰는 관계부사
  const PW_RADV = { place: 'where', time: 'when', reason: 'why', way: 'how' };
  WH.PW_RADV = PW_RADV;
  // 놀이터·판별기에서 견줘 보는 후보 (빈자리 쪽 → 완전 쪽)
  WH.CANDS = ['which', 'who', 'whom', 'that', 'what', 'whoever', 'whatever', 'where', 'when', 'why', 'how', 'however', 'wherever', 'whenever', 'whether', 'if'];

  const ok = (why) => ({ s: 'ok', why, step: 0 });
  const warn = (why, step = 3, trap = '') => ({ s: 'warn', why, step, trap });
  const no = (why, step, trap = '') => ({ s: 'no', why, step, trap });
  const isGap = d => d.back === 'subj' || d.back === 'obj';

  /* ---------- 판정 ---------- */
  WH.judge = function (w, d) {
    const L = WH.word(w);
    if (!L) return no('이 튜토리얼의 사전에 없는 말이에요.', 1);
    w = L.w;
    const gap = isGap(d), A = d.front === 'ante';
    const kn = KIND[L.kind];

    /* ① 뒤: 빈칸 바로 뒤의 모양, 그리고 빈자리가 있나 */
    if (d.next === 'adj' && !(w === 'however' || (w === 'how' && d.front === 'noun')))
      return no('빈칸 바로 뒤에 형용사·부사가 와요 → 그 말을 데리고 앞으로 나오는 however(아무리 ~해도) 자리예요.', 1);
    if (d.next === 'ornot' && w !== 'whether' && w !== 'if')
      return no('빈칸 바로 뒤에 or not → ‘~인지 아닌지’를 묻는 whether 자리예요.', 1);
    if (d.next === 'to' && w === 'that') return no('that 뒤에는 주어 + 동사(절)가 와요. 빈칸 뒤는 to부정사예요.', 1);
    if (d.next === 'to' && !(d.front === 'noun' && ['whether', 'if', 'how', 'where', 'when', 'what', 'who'].includes(w)))
      return no('빈칸 바로 뒤에 to부정사 → 명사 자리의 whether to · how to · what to 꼴만 써요.', 1);
    if (w === 'that') {
      if (gap && !A) return no('명사 자리의 that → 뒤에 완전한 문장이 와요. 빈칸 뒤에 ' + GAPNAME[d.back] + '가 빠졌으니 what · whoever · whatever 쪽이에요.', 1);
      if (!gap && A && !d.prep) {
        if (d.ante === 'content') { /* 동격의 that: 아래에서 판정 */ }
        else if (d.ante === 'time' || d.ante === 'reason' || d.ante === 'way')
          return warn('실제 영어에서는 관계부사 자리에 that도 써요(the day that we met). 그래도 시험 답으로는 when · why · the way를 골라요.', 1);
        else return no('관계대명사 that → 뒤에 빈자리가 있어야 해요. 빈칸 뒤가 빠진 것 없는 완전한 문장이에요.', 1);
      }
    } else if (L.fam === 'gap' && !gap && !(A && d.prep)) {
      return no(`${w} → ${kn}. 뒤에 빈자리가 있어야 해요. 그런데 빈칸 뒤는 빠진 것 없는 완전한 문장이에요.`, 1);
    } else if (L.fam === 'full' && gap) {
      return no(`${w} → ${kn}. 뒤에 완전한 문장이 와요. 그런데 빈칸 뒤에 ${GAPNAME[d.back]}가 빠졌어요.`, 1);
    }

    /* ② 앞: 빈칸은 무슨 자리인가 */
    if (A) {
      if (w === 'what') return no('빈칸 앞에 꾸밀 명사(선행사)가 있어요. what → 선행사를 이미 품은 말이라 명사 뒤에 못 와요.', 2);
      if (L.kind === 'cpro') return no(`${w} = ${L.para}. 선행사를 이미 품은 말이라 명사 뒤에 못 와요.`, 2);
      if (L.kind === 'cadv') return no(`${w} → 명사를 꾸미지 못해요. 완전한 문장에 붙는 부사절(${L.ko})을 이끌어요.`, 2);
      if (L.kind === 'conj') return no(`${w} → 명사를 꾸미지 못해요. ‘~인지 아닌지’라는 명사절을 이끌어 명사 자리에 와요.`, 2);
    } else if (d.front === 'noun') {
      if (w === 'which' || w === 'whom') return no(`${w} → 관계대명사라서 앞에 꾸밀 명사(선행사)가 있어야 해요. 선행사 없이 명사 자리에 오는 ‘~하는 것’ → what.`, 2);
      if (L.kind === 'pwhich') return no(`${w} → 명사 뒤에서 꾸미는 말이에요. 빈칸 앞에 꾸밀 명사가 없어요.`, 2);
      if (L.kind === 'cadv') return no(`${w} → 부사절을 이끄는 말이에요. 빈칸은 문장의 ${ROLE[d.role]} 자리(명사 자리)예요.`, 2);
    } else {
      if (['rel', 'that', 'what', 'pwhich'].includes(L.kind)) return no(`빈칸 + 절이 완전한 주절에 붙는 부사 자리예요. ${w} → 부사절을 이끌지 못해요.`, 2);
      if (w === 'how' || w === 'why') return no(`${w} → 부사절을 이끌지 못해요. ‘아무리 ~해도’ → however.`, 2);
    }

    /* ③ 함정: 선행사·뜻·전치사·콤마·if의 자리 */
    if (A) {
      const an = ANTE[d.ante];
      if (d.prep && (w === 'that' || w === 'who' || L.kind === 'radv' || L.kind === 'pwhich')) {
        if (w === 'that') return no('전치사 바로 뒤에는 that을 쓰지 않아요 → 전치사 + which(사물) · whom(사람).', 3, 'prep');
        if (w === 'who') return no('전치사 바로 뒤 → who 대신 목적격 whom.', 3, 'prep');
        if (L.kind === 'pwhich') return no('빈칸 앞에 전치사가 이미 있어요. 전치사가 두 번이 돼요.', 3, 'prep');
        return no(`${w} = ${L.para}. 빈칸 앞에 전치사가 이미 있으니, 전치사가 두 번이 돼요 → 전치사 + which.`, 3, 'prep');
      }
      if (d.comma && w === 'that') return no('콤마 뒤(계속적 용법)에는 that 대신 which · who를 써요.', 3, 'comma');
      if (w === 'who' || w === 'whom') {
        if (d.ante !== 'person') return no(`선행사 = ${an}. ${w} → 사람에만 써요.`, 3, 'ante');
        if (w === 'whom' && d.back === 'subj') return no('빈칸 바로 뒤에 동사 → 주어 자리. 목적격 whom은 안 돼요.', 3, 'case');
        if (w === 'who' && d.back === 'obj') return warn('목적어 자리 → 회화에서는 who도 쓰지만 시험 답은 목적격 whom.', 3, 'case');
        return ok(w === 'who' ? '선행사 = 사람, 빈칸 바로 뒤 동사 → 주격 who.' : d.prep ? '선행사 = 사람, 전치사의 목적어 → whom.' : '선행사 = 사람, 목적어가 빠짐 → 목적격 whom.');
      }
      if (w === 'which') {
        if (d.ante === 'person') return no('선행사 = 사람. which → 사물·동물에 써요.', 3, 'ante');
        if (d.prep) return ok(`전치사 + which → 뒤는 완전한 문장.${PW_RADV[d.ante] ? ` 전치사와 합친 꼴 = ${PW_RADV[d.ante]}.` : ''}`);
        return ok(`선행사 = ${an}, ${GAPNAME[d.back]}가 빠짐 → which.` + (PW_RADV[d.ante] ? ` ${an} 명사라도 뒤에 빈자리가 있으면 관계부사가 아니라 which.` : ''));
      }
      if (w === 'that') {
        if (!gap && d.ante === 'content') return ok('내용 명사(fact · news) 뒤 + 완전한 문장 → 그 내용을 풀어 주는 동격의 that.');
        return ok(`that → 사람·사물 모두, ${GAPNAME[d.back]}가 빠진 관계사절을 이끌어요.`);
      }
      if (w === 'how') {
        if (d.ante === 'way') return no('the way how → 쓰지 않아요. the way 또는 how 하나만 써요(the way in which도 돼요).', 3, 'way');
        return no('how → 명사 뒤에 오지 않아요. 방법을 말할 때는 the way 또는 how 하나만.', 3, 'way');
      }
      if (L.kind === 'radv') {
        if (d.ante !== L.ante) return no(`선행사 = ${an}. ${w} → ${ANTE[L.ante]} 명사 뒤에만 와요.`, 3, 'ante');
        return ok(`선행사 = ${an}, 뒤는 완전한 문장 → 관계부사 ${w} (= ${L.para}).`);
      }
      if (L.kind === 'pwhich') {
        if (d.ante === 'person') return no('선행사 = 사람. 사람 뒤에서는 전치사 + whom.', 3, 'ante');
        if (d.pw !== L.prep) return no(`이 문장에는 전치사 ${L.prep} → 맞지 않아요.${d.pw ? ` 맞는 꼴 = ${d.pw} which.` : ''}`, 3, 'prep');
        return ok(`${w} → 뒤에 완전한 문장.${PW_RADV[d.ante] && d.ante !== 'way' ? ` 한 낱말로 줄이면 ${PW_RADV[d.ante]}.` : ' the way in which = the way = how.'}`);
      }
    }
    if (d.front === 'noun') {
      const sn = SENSE[d.sense];
      if (w === 'that') {
        if (d.role === 'prep') return no('전치사 뒤에는 that절이 오지 않아요 → whether · what 같은 말이 와요.', 3, 'prep');
        if (d.sense === 'fact') return ok(`명사 자리(${ROLE[d.role]}) + 완전한 문장, 뜻 ‘~라는 것’ → 명사절 접속사 that.`);
        return no(`that → ‘~라는 것’(확실한 내용). 여기 뜻은 ${sn}.`, 3, 'sense');
      }
      if (w === 'what') {
        if (d.sense === 'thing' || d.sense === 'any-thing') return ok(`선행사 없이 명사 자리(${ROLE[d.role]}), 뒤에 빈자리 → what(~하는 것 = the thing which).`);
        return no(`what → 물건·일(~하는 것). 여기 뜻은 ${sn}.`, 3, 'sense');
      }
      if (w === 'who') {
        if (d.sense === 'person') return ok('‘누가 ~하는지’ → 의문사 who. 뒤에 주어 빈자리.');
        if (d.sense === 'any-person') return no('who → ‘누가 ~하는지’를 묻는 말. 여기는 ‘~하는 사람은 누구든’ → whoever.', 3, 'sense');
        return no(`who → 사람. 여기 뜻은 ${sn}.`, 3, 'sense');
      }
      if (w === 'whoever') {
        if (d.sense === 'any-person') return ok(`선행사 없이 명사 자리(${ROLE[d.role]}), 뒤에 빈자리, 뜻 ‘~하는 사람은 누구든’ → whoever (= anyone who).`);
        if (d.sense === 'person') return no('whoever → ‘누구든’. 여기는 ‘누가 ~하는지’를 묻는 자리 → who.', 3, 'sense');
        return no('whoever → 사람. 여기는 물건·일 → what · whatever.', 3, 'sense');
      }
      if (w === 'whatever') {
        if (d.sense === 'any-thing') return ok(`선행사 없이 명사 자리(${ROLE[d.role]}), 뒤에 빈자리, 뜻 ‘~하는 것은 무엇이든’ → whatever (= anything that).`);
        if (d.sense === 'thing') return warn('whatever → ‘무엇이든’. 문장은 되지만 뜻이 넓어져요. ‘~하는 것’ 하나를 말할 때는 what.', 3, 'sense');
        return no('whatever → 물건·일. 여기는 사람 → who · whoever.', 3, 'sense');
      }
      if (L.kind === 'radv') {
        if (d.sense === L.sense) return ok(`명사 자리 + 완전한 문장, 뜻 ${SENSE[L.sense]} → ${w}.`);
        return no(`${w} → ${SENSE[L.sense]}. 여기 뜻은 ${sn}.`, 3, 'sense');
      }
      if (w === 'whether') {
        if (d.sense === 'yesno') return ok(`‘~인지 아닌지’ + 완전한 문장 → whether. ${ROLE[d.role]} 자리에 쓸 수 있어요.`);
        return no(`whether → ‘~인지 아닌지’. 여기 뜻은 ${sn}.`, 3, 'sense');
      }
      if (w === 'if') {
        if (d.sense !== 'yesno') return no(`if → 명사절에서는 ‘~인지 아닌지’. 여기 뜻은 ${sn}.`, 3, 'sense');
        if (d.role === 'subj') return no('문장 맨 앞 주어 자리 → if는 못 쓰고 whether만 써요.', 3, 'ifpos');
        if (d.role === 'prep') return no('전치사 바로 뒤 → if는 못 쓰고 whether만 써요.', 3, 'ifpos');
        if (d.role === 'comp') return no('보어 자리 → if는 못 쓰고 whether만 써요.', 3, 'ifpos');
        if (d.next === 'ornot') return no('or not 바로 앞 → if는 못 쓰고 whether만 써요(whether or not).', 3, 'ifpos');
        if (d.next === 'to') return no('to부정사 앞 → if는 못 쓰고 whether만 써요(whether to go).', 3, 'ifpos');
        return ok(`동사의 ${ROLE[d.role]} 자리 → if도 돼요(= whether).`);
      }
    }
    if (d.front === 'adv') {
      const sn = SENSE[d.sense];
      if (w === 'however') {
        if (d.next === 'adj') return ok('빈칸 바로 뒤 형용사·부사 → however + 형용사 = 아무리 ~해도 (no matter how).');
        return warn('however를 형용사 없이 쓰면 ‘어떤 방법으로 ~하든’이 돼요. 시험 빈칸에서는 however + 형용사·부사 꼴로 나와요.', 3, 'adj');
      }
      if (L.kind === 'cadv' || L.kind === 'cpro') {
        if (d.sense === L.sense) return ok(`완전한 주절에 붙는 부사절, 뜻 ${SENSE[L.sense]} → ${w} (= ${L.kind === 'cpro' ? 'no matter ' + w.replace('ever', '') : L.para}).`);
        return no(`${w} → ${SENSE[L.sense]}. 여기 뜻은 ${sn}.`, 3, 'sense');
      }
      if (w === 'when') {
        if (d.sense === 'any-time' || d.sense === 'time') return ok('시간의 부사절 → 접속사 when(~할 때)도 이 자리에 와요.');
        return no(`when → ‘~할 때’. 여기 뜻은 ${sn}.`, 3, 'sense');
      }
      if (w === 'where') {
        if (d.sense === 'any-place' || d.sense === 'place') return warn('접속사 where(~하는 곳에서)도 있지만, ‘어디서 ~하든’이면 wherever.', 3, 'sense');
        return no(`where → ‘~하는 곳’. 여기 뜻은 ${sn}.`, 3, 'sense');
      }
      if (w === 'whether') {
        if (d.or || d.next === 'ornot') return ok('‘~이든 아니든’ → whether … or (not).');
        return no('whether → 부사절에서는 or (not)과 짝으로 ‘~이든 아니든’. 이 절에는 or가 없어요.', 3, 'sense');
      }
      if (w === 'if') {
        if (d.sense === 'cond') return ok('조건의 부사절 → if(~라면).');
        return no(`if → 부사절에서는 ‘~라면’(조건). 여기 뜻은 ${sn}.`, 3, 'sense');
      }
    }
    return no('이 자리에는 맞지 않아요.', 3);
  };
  WH.isOk = (w, d) => WH.judge(w, d).s === 'ok';
  WH.valid = (d, cands = WH.CANDS) => cands.filter(w => WH.isOk(w, d));
  WH.famOf = w => { const L = WH.word(w); return L ? L.fam : ''; };

  /* ---------- 판별기 (영상 09장): 빈칸 뒤 · 앞을 고르면 뜻마다 들어갈 말 ---------- */
  WH.BACKS = { subj: '주어가 빠짐 (바로 뒤 동사)', obj: '목적어가 빠짐', full: '빠진 것 없음 (완전한 문장)', adj: '바로 뒤 형용사·부사 + 주어 + 동사', ornot: '바로 뒤 or not', to: '바로 뒤 to부정사' };
  WH.FRONTS = {
    'ante-person': '명사 뒤 · 사람', 'ante-thing': '명사 뒤 · 사물', 'ante-place': '명사 뒤 · 장소', 'ante-time': '명사 뒤 · 시간',
    'ante-reason': '명사 뒤 · 이유(the reason)', 'ante-way': '명사 뒤 · 방법(the way)', 'ante-content': '명사 뒤 · 내용 명사(fact · news)', 'ante-prep': '명사 + 전치사 뒤 (in ___)',
    'noun-subj': '명사 자리 · 주어 (문장 맨 앞)', 'noun-obj': '명사 자리 · 동사의 목적어', 'noun-prep': '명사 자리 · 전치사 뒤', 'adv': '문장 밖 · 완전한 주절에 붙음',
  };
  const NOUN_SENSES = ['fact', 'yesno', 'thing', 'person', 'time', 'place', 'reason', 'manner', 'any-person', 'any-thing'];
  const ADV_SENSES = ['any-degree', 'any-place', 'any-time', 'any-person', 'any-thing'];
  WH.situationOf = function (back, front) {
    const d = { back: back === 'subj' || back === 'obj' ? back : 'full' };
    if (back === 'adj' || back === 'ornot' || back === 'to') d.next = back;
    if (front.startsWith('ante-')) {
      d.front = 'ante';
      const k = front.slice(5);
      if (k === 'prep') { d.prep = true; d.ante = 'thing'; } else d.ante = k;
    } else if (front.startsWith('noun-')) { d.front = 'noun'; d.role = front.slice(5); }
    else d.front = 'adv';
    return d;
  };
  // 뜻마다 맞는 말 → [{ w, sense }] (명사 뒤는 뜻이 선행사로 정해져서 sense 없음). 사람 선행사 + 전치사는 whom도 보여 줌
  const PW_DEFAULT = { place: 'in', time: 'on', reason: 'for', way: 'in' };
  WH.pathWords = function (back, front) {
    const d = WH.situationOf(back, front), out = [], seen = new Set();
    const add = (w, sense) => { if (!seen.has(w)) { seen.add(w); out.push({ w, sense }); } };
    if (d.front === 'ante') {
      if (PW_DEFAULT[d.ante]) d.pw = PW_DEFAULT[d.ante];
      const ds = d.prep ? [d, Object.assign({}, d, { ante: 'person' })] : [d];
      const cands = d.pw ? WH.CANDS.concat([d.pw + ' which']) : WH.CANDS;
      ds.forEach(x => cands.forEach(w => { if (WH.isOk(w, x)) add(w); }));
    } else {
      (d.front === 'noun' ? NOUN_SENSES : ADV_SENSES).forEach(sense => {
        const x = Object.assign({}, d, { sense });
        WH.CANDS.forEach(w => { if (WH.isOk(w, x)) add(w, sense); });
      });
    }
    return { d, words: out };
  };

  /* ---------- 의문사 명사절의 어순 ---------- */
  const AUX = /^(do|does|did|is|are|was|were|am|can|could|will|would|shall|should|may|might|must|has|have|had)\b/i;
  // 보기의 모양: stmt 주어 + 동사(평서문 어순) · q 조동사 + 주어(의문문 어순) · vs 동사 + 주어 · ing 진짜 동사 없음
  WH.formOf = function (opt, subj) {
    const o = String(opt).toLowerCase(), s = String(subj).toLowerCase();
    if (o.startsWith(s + ' ')) { const nx = o.slice(s.length + 1).split(' ')[0]; return /ing$/.test(nx) && !AUX.test(nx) ? 'ing' : 'stmt'; }
    if (AUX.test(o)) return 'q';
    return 'vs';
  };
  const FORMWHY = {
    stmt: '의문사 뒤 명사절 → 평서문 어순(주어 + 동사).',
    q: '조동사가 주어 앞에 온 의문문 어순이에요. 질문이 문장 속에 들어가면 주어 + 동사로 되돌려요.',
    vs: '동사가 주어 앞에 왔어요. 평서문 어순은 주어 + 동사.',
    ing: '-ing만 있고 진짜 동사가 없어요. 절에는 주어 + 동사가 있어야 해요.',
  };
  const FORMNAME = { stmt: '평서문 어순', q: '의문문 어순', vs: '동사 + 주어', ing: '동사 없음' };
  WH.FORMNAME = FORMNAME;
  WH.judgeOrder = (opt, subj) => { const f = WH.formOf(opt, subj); return f === 'stmt' ? { s: 'ok', why: FORMWHY.stmt, step: 0, form: f } : { s: 'no', why: FORMWHY[f], step: 3, form: f }; };

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * d: 빈칸의 상황, c: 문장 속 단서 — ante 선행사 · cue 빈칸 뒤 덩어리 · gapAfter 빈자리 바로 앞 낱말 · trap 전치사 · head 빈칸 바로 뒤 낱말
   * type 'order'는 어순 문제 (subj: 절의 주어, wh: 빈칸 앞 의문사)
   */
  WH.DRILL = [
    { q: 'The hotel ___ we reserved for the workshop offers a free airport shuttle.', opts: ['where', 'which', 'what', 'when'], a: 1,
      d: { front: 'ante', ante: 'place', back: 'obj' }, c: { ante: 'The hotel', cue: 'we reserved for the workshop', gapAfter: 'reserved' },
      tag: '관계대명사 vs 관계부사 · 장소 명사 함정', ko: '우리가 워크숍을 위해 예약한 호텔은 공항 셔틀을 무료로 운행해요.' },
    { q: 'The warehouse ___ our new products are stored is located near the port.', opts: ['which', 'what', 'where', 'whom'], a: 2,
      d: { front: 'ante', ante: 'place', back: 'full', pw: 'in' }, c: { ante: 'The warehouse', cue: 'our new products are stored' },
      tag: '관계부사 where', ko: '우리 신제품을 보관하는 창고는 항구 근처에 있어요.' },
    { q: 'Please confirm the date ___ the shipment is expected to arrive at our office.', opts: ['when', 'where', 'what', 'which'], a: 0,
      d: { front: 'ante', ante: 'time', back: 'full', pw: 'on' }, c: { ante: 'the date', cue: 'the shipment is expected to arrive' },
      tag: '관계부사 when', ko: '배송품이 사무실에 도착할 예정인 날짜를 확인해 주세요.' },
    { q: 'The conference room in ___ the interviews will take place has been reserved for Friday.', opts: ['where', 'that', 'what', 'which'], a: 3,
      d: { front: 'ante', ante: 'place', prep: true, back: 'full' }, c: { ante: 'The conference room', trap: 'in', cue: 'the interviews will take place' },
      tag: '전치사 + which = where', ko: '면접이 열릴 회의실은 금요일로 예약되어 있어요.' },
    { q: 'The new manual explains the way ___ the inventory system works.', opts: ['how', 'what', 'in which', 'whom'], a: 2,
      d: { front: 'ante', ante: 'way', back: 'full', pw: 'in' }, c: { ante: 'the way', cue: 'the inventory system works' },
      tag: 'the way how 함정', ko: '새 설명서는 재고 시스템이 돌아가는 방식을 설명해요.' },
    { q: '___ arrives first should unlock the office and turn on the lights.', opts: ['Whoever', 'Whatever', 'However', 'Whenever'], a: 0,
      d: { front: 'noun', role: 'subj', back: 'subj', sense: 'any-person' }, c: { cue: 'arrives', verb: 'should unlock' },
      tag: '복합관계대명사 whoever', ko: '가장 먼저 오는 사람이 누구든 사무실 문을 열고 불을 켜야 해요.' },
    { q: 'Please feel free to take ___ you need from the supply cabinet.', opts: ['whenever', 'whatever', 'however', 'whether'], a: 1,
      d: { front: 'noun', role: 'obj', back: 'obj', sense: 'any-thing' }, c: { cue: 'you need', gapAfter: 'need', verb: 'take' },
      tag: '복합관계대명사 whatever', ko: '비품 캐비닛에서 필요한 것은 무엇이든 가져가세요.' },
    { q: '___ busy the schedule becomes, all employees must complete the safety training by May.', opts: ['Whatever', 'Whenever', 'However', 'Whoever'], a: 2,
      d: { front: 'adv', back: 'full', next: 'adj', sense: 'any-degree' }, c: { cue: 'busy', head: 'busy' },
      tag: 'however + 형용사', ko: '일정이 아무리 바빠져도 모든 직원은 5월까지 안전 교육을 마쳐야 해요.' },
    { q: '___ you travel, our mobile app can help you find the nearest branch.', opts: ['What', 'Whoever', 'Whatever', 'Wherever'], a: 3,
      d: { front: 'adv', back: 'full', sense: 'any-place' }, c: { cue: 'you travel' },
      tag: '복합관계부사 wherever', ko: '어디를 여행하든 모바일 앱으로 가장 가까운 지점을 찾을 수 있어요.' },
    { q: '___ our customers value most is fast and reliable delivery.', opts: ['That', 'Which', 'Whether', 'What'], a: 3,
      d: { front: 'noun', role: 'subj', back: 'obj', sense: 'thing' }, c: { cue: 'our customers value most', gapAfter: 'value', verb: 'is' },
      tag: '명사절 what', ko: '고객이 가장 중요하게 여기는 것은 빠르고 믿을 수 있는 배송이에요.' },
    { q: 'The survey results show ___ most customers prefer online booking.', opts: ['what', 'which', 'that', 'whom'], a: 2,
      d: { front: 'noun', role: 'obj', back: 'full', sense: 'fact' }, c: { cue: 'most customers prefer online booking', verb: 'show' },
      tag: '명사절 that', ko: '설문 결과는 대부분의 고객이 온라인 예약을 더 좋아한다는 것을 보여 줘요.' },
    { q: 'The board was impressed by ___ the new director presented at the meeting.', opts: ['that', 'what', 'which', 'whether'], a: 1,
      d: { front: 'noun', role: 'prep', back: 'obj', sense: 'thing' }, c: { cue: 'the new director presented', gapAfter: 'presented', trap: 'by' },
      tag: '전치사 뒤 명사절 what', ko: '이사회는 새 이사가 회의에서 발표한 내용에 감명받았어요.' },
    { q: 'The success of the event depends on ___ enough volunteers sign up.', opts: ['if', 'whether', 'that', 'what'], a: 1,
      d: { front: 'noun', role: 'prep', back: 'full', sense: 'yesno' }, c: { cue: 'enough volunteers sign up', trap: 'on' },
      tag: 'whether vs if · 전치사 뒤', ko: '행사의 성공은 자원봉사자가 충분히 신청하느냐에 달려 있어요.' },
    { q: 'Ms. Tanaka has not decided ___ or not she will attend the trade fair.', opts: ['whether', 'if', 'that', 'what'], a: 0,
      d: { front: 'noun', role: 'obj', back: 'full', next: 'ornot', sense: 'yesno' }, c: { cue: 'or not', head: 'or not' },
      tag: 'whether or not', ko: '다나카 씨는 무역 박람회에 갈지 말지 아직 정하지 않았어요.' },
    { q: 'Please let us know when ___ so that we can arrange a pickup.', opts: ['will you arrive', 'you arriving', 'arrive you', 'you will arrive'], a: 3,
      type: 'order', subj: 'you', wh: 'when', tag: '의문사 명사절의 어순', ko: '언제 도착하는지 알려 주시면 마중을 준비할게요.' },
    { q: 'The manager asked me why ___ late for the morning meeting.', opts: ['I was', 'was I', 'did I', 'I being'], a: 0,
      type: 'order', subj: 'I', wh: 'why', tag: '의문사 명사절의 어순', ko: '매니저는 내가 왜 아침 회의에 늦었는지 물었어요.' },
  ];
  WH.judgeOpt = (it, k) => it.type === 'order' ? WH.judgeOrder(it.opts[k], it.subj) : WH.judge(it.opts[k], it.d);

  const STEPNAME = ['', '① 뒤', '② 앞', '③ 함정'];
  WH.STEPNAME = STEPNAME;
  const listGone = (it, step) => it.opts.filter((o, k) => { const j = WH.judgeOpt(it, k); return j.s !== 'ok' && j.step === step; });
  // 3단계 풀이 (연습 문제 힌트): ① 뒤 ② 앞 ③ 함정. 지울 보기는 규칙 엔진이 정함
  WH.steps = function (it) {
    const ans = it.opts[it.a];
    if (it.type === 'order') return [
      { head: '① 보기를 봐요.', text: '보기가 모두 같은 낱말이고 순서만 달라요 → 어순 문제예요.', marks: [] },
      { head: '② 앞을 봐요.', text: `빈칸 앞 ‘${it.wh}’ → 의문사가 이끄는 명사절, 곧 문장 속에 들어간 질문이에요.`, marks: [{ t: it.wh, role: 'cue' }] },
      { head: '③ 어순을 맞춰요.', text: `질문이 문장 속에 들어가면 평서문 어순(주어 + 동사) → ${ans}.`, marks: [] },
    ];
    const d = it.d, c = it.c;
    let s1;
    if (d.next === 'adj') s1 = `빈칸 바로 뒤에 형용사 ‘${c.cue}’, 그 뒤에 주어 + 동사 → 형용사를 데리고 나오는 말이 필요해요.`;
    else if (d.next === 'ornot') s1 = '빈칸 바로 뒤에 or not, 그 뒤는 완전한 문장이에요.';
    else if (d.back === 'subj') s1 = `빈칸 바로 뒤에 동사 ‘${c.cue}’ → 주어가 빠졌어요. 빈자리가 있어요.`;
    else if (d.back === 'obj') s1 = `빈칸 뒤 ‘${c.cue}’ → ${c.gapAfter} 뒤에 목적어가 없어요. 빈자리가 있어요.`;
    else s1 = `빈칸 뒤 ‘${c.cue}’ → 빠진 것 없는 완전한 문장이에요.`;
    const g1 = listGone(it, 1);
    s1 += g1.length ? ` 지울 보기: ${g1.join(', ')}.` : ' 뒤만 보고 지울 보기는 없어요.';
    let s2, m2 = [];
    if (d.front === 'ante') {
      s2 = d.prep ? `빈칸 앞 → 명사 ‘${c.ante}’, 그리고 바로 앞에 전치사 ‘${c.trap}’. 명사를 꾸미는 관계사 자리예요.` : `빈칸 앞에 명사 ‘${c.ante}’ → 명사를 꾸미는 관계사 자리예요.`;
      m2 = [{ t: c.ante, role: 'ante' }];
    } else if (d.front === 'noun') {
      s2 = d.role === 'prep' ? `빈칸 바로 앞이 전치사 ‘${c.trap}’ → 전치사의 목적어, 명사절 자리예요.` : `빈칸 앞에 꾸밀 명사가 없어요. 빈칸 + 절 = 문장의 ${ROLE[d.role]} 자리, 곧 명사절이에요.`;
      if (c.verb) m2 = [{ t: c.verb, role: 'verb' }];
    } else {
      s2 = it.q.startsWith('___') ? '빈칸 + 절 뒤에 쉼표와 완전한 문장 → 그 문장에 붙는 부사절 자리예요.' : '앞 문장이 이미 완전해요 → 그 문장에 붙는 부사절 자리예요.';
    }
    const g2 = listGone(it, 2);
    s2 += g2.length ? ` 지울 보기: ${g2.join(', ')}.` : ' 이 단계에서 지울 보기는 없어요.';
    const g3 = listGone(it, 3), aj = WH.judge(ans, d);
    const s3 = (g3.length ? `함정: ${g3.map(o => `${o}(${TRAP[WH.judgeOpt(it, it.opts.indexOf(o)).trap] || '뜻'})`).join(', ')} → 지워요. ` : '') + `${aj.why} 정답 → ${ans}.`;
    const m1 = [{ t: c.cue, role: 'cue' }];
    const m3 = c.trap ? [{ t: c.trap, role: 'trap' }] : [];
    return [
      { head: '① 뒤를 봐요.', text: s1, marks: m1 },
      { head: '② 앞을 봐요.', text: s2, marks: m2.concat(d.front === 'noun' && c.trap ? [{ t: c.trap, role: 'trap' }] : []) },
      { head: '③ 함정을 봐요.', text: s3, marks: m3 },
    ];
  };
  WH.drillItems = () => WH.DRILL.map((it, i) => ({
    q: it.q, opts: it.opts, a: it.a, ko: it.ko, tag: it.tag, steps: WH.steps(it),
    notes: it.opts.map((o, k) => {
      const j = WH.judgeOpt(it, k);
      if (it.type === 'order') return `${WH.FORMNAME[j.form]}. ` + (j.s === 'ok' ? '' : '× ') + j.why;
      return `${WH.kindName(o)}. ` + (j.s === 'ok' ? '' : (j.s === 'warn' ? '△ ' : '× ') + STEPNAME[j.step] + ' — ') + j.why;
    }),
  }));

  /* ---------- 빈칸 뒤 조각: 빈자리가 있나 없나 (영상 01장 직접 해 보기) ---------- */
  WH.FRAGS = [
    { t: 'we reserved', gap: 'obj', why: 'reserved(예약했다) → 무엇을? 목적어가 없어요.' },
    { t: 'the fair is held', gap: null, why: '수동태 is held → 목적어가 필요 없어요. 빠진 것이 없어요.' },
    { t: 'arrives first', gap: 'subj', why: '동사 arrives 앞에 주어가 없어요.' },
    { t: 'the store opened', gap: null, why: 'opened(문을 열었다) → 목적어 없이도 써요. 빠진 것이 없어요.' },
    { t: 'our customers value most', gap: 'obj', why: 'value(소중히 여기다) → 무엇을? 목적어가 없어요.' },
    { t: 'enough volunteers sign up', gap: null, why: 'sign up(신청하다) → 목적어가 필요 없어요. 빠진 것이 없어요.' },
  ];

  /* ---------- 놀이터: 빈자리 탐지기 ----------
   * clause: 빈칸 뒤 절 (낱말 사이 자리를 누름), gapAt: 빈자리가 있는 자리 번호 (0 = 첫 낱말 앞, n = 끝, -1 = 없음)
   * d: 빈칸의 상황, ans: 대표 답, fill: 빈자리를 채워 보거나(대명사) 부사를 붙여 본 문장, why: ① 뒤 설명, trapHint: 틀렸을 때 덧붙일 말
   */
  WH.DET = [
    { id: 'booked', q: 'This is the restaurant ___ we booked for the team dinner.', clause: 'we booked for the team dinner', gapAt: 2,
      d: { front: 'ante', ante: 'place', back: 'obj' }, ans: 'which', fill: 'We booked the restaurant for the team dinner.',
      why: 'booked(예약했다) → 무엇을? 목적어가 빠졌어요.', ko: '이곳이 우리가 팀 저녁을 위해 예약한 식당이에요.' },
    { id: 'had', q: 'This is the restaurant ___ we had the team dinner.', clause: 'we had the team dinner', gapAt: -1,
      d: { front: 'ante', ante: 'place', back: 'full', pw: 'at' }, ans: 'where', fill: 'We had the team dinner there (= at the restaurant).',
      why: 'had(먹었다) 뒤에 the team dinner가 있어요. 빠진 것이 없어요.', trapHint: '바로 앞 문장과 견줘 보세요. 선행사는 같은데 빈칸 뒤가 달라요.', ko: '이곳이 우리가 팀 저녁을 먹은 식당이에요.' },
    { id: 'opens', q: 'Friday is the day ___ the new branch opens.', clause: 'the new branch opens', gapAt: -1,
      d: { front: 'ante', ante: 'time', back: 'full', pw: 'on' }, ans: 'when', fill: 'The new branch opens on Friday.',
      why: 'opens(문을 열다) → 목적어 없이도 써요. 빠진 것이 없어요.', ko: '금요일은 새 지점이 문을 여는 날이에요.' },
    { id: 'waiting', q: 'Friday is the day ___ everyone has been waiting for.', clause: 'everyone has been waiting for', gapAt: 5,
      d: { front: 'ante', ante: 'time', back: 'obj' }, ans: 'which', fill: 'Everyone has been waiting for the day.',
      why: '전치사 for 뒤에 목적어가 없어요.', trapHint: '끝의 전치사 for를 보세요. 무엇을 기다려 왔나요?', ko: '금요일은 모두가 기다려 온 날이에요.' },
    { id: 'reason', q: 'Nobody knows the reason ___ the meeting was canceled.', clause: 'the meeting was canceled', gapAt: -1,
      d: { front: 'ante', ante: 'reason', back: 'full', pw: 'for' }, ans: 'why', fill: 'The meeting was canceled for that reason.',
      why: '수동태 was canceled → 목적어가 필요 없어요. 빠진 것이 없어요.', ko: '회의가 취소된 이유를 아무도 몰라요.' },
    { id: 'calls', q: '___ calls the help desk will get an answer within an hour.', clause: 'calls the help desk', gapAt: 0,
      d: { front: 'noun', role: 'subj', back: 'subj', sense: 'any-person' }, ans: 'whoever', fill: 'Anyone who calls the help desk will get an answer within an hour.',
      why: '동사 calls 앞에 주어가 없어요.', ko: '안내 데스크에 전화하는 사람은 누구든 한 시간 안에 답을 받아요.' },
    { id: 'desk', q: 'Please give this form to ___ is at the front desk.', clause: 'is at the front desk', gapAt: 0,
      d: { front: 'noun', role: 'prep', back: 'subj', sense: 'any-person' }, ans: 'whoever', fill: 'Please give this form to anyone who is at the front desk.',
      why: '동사 is 앞에 주어가 없어요.', trapHint: '빈칸 앞 전치사 to에 끌리지 마세요. 절 안에서 빠진 것은 is의 주어예요.', ko: '이 서류를 안내 데스크에 있는 사람 누구에게든 주세요.' },
    { id: 'difficult', q: '___ difficult the task is, we will finish it on time.', clause: 'difficult the task is', gapAt: -1,
      d: { front: 'adv', back: 'full', next: 'adj', sense: 'any-degree' }, ans: 'however', fill: 'The task is difficult. → However difficult the task is',
      why: 'difficult를 제자리에 넣으면 the task is difficult. 빠진 것이 없어요.', trapHint: 'difficult는 is의 보어예요. however와 한 덩어리로 앞에 나왔을 뿐이에요.', ko: '일이 아무리 어려워도 우리는 제때 끝낼 거예요.' },
    { id: 'need', q: 'Please tell me ___ you need for the presentation.', clause: 'you need for the presentation', gapAt: 2,
      d: { front: 'noun', role: 'obj', back: 'obj', sense: 'thing' }, ans: 'what', fill: 'You need something for the presentation. (what = the thing which)',
      why: 'need → 무엇을? 목적어가 빠졌어요.', ko: '발표에 필요한 것을 말해 주세요.' },
    { id: 'doubled', q: 'The report shows ___ online sales doubled last year.', clause: 'online sales doubled last year', gapAt: -1,
      d: { front: 'noun', role: 'obj', back: 'full', sense: 'fact' }, ans: 'that', fill: 'Online sales doubled last year. (that = ~라는 것)',
      why: 'doubled(두 배가 되었다) → 목적어 없이도 써요. 빠진 것이 없어요.', ko: '보고서는 작년에 온라인 매출이 두 배가 되었다는 것을 보여 줘요.' },
    { id: 'hire', q: 'We are still discussing ___ we should hire more staff.', clause: 'we should hire more staff', gapAt: -1,
      d: { front: 'noun', role: 'obj', back: 'full', sense: 'yesno' }, ans: 'whether', fill: 'Should we hire more staff? → 뽑을지 말지',
      why: 'hire 뒤에 more staff가 있어요. 빠진 것이 없어요.', ko: '우리는 직원을 더 뽑을지 아직 논의하고 있어요.' },
    { id: 'budget', q: 'The decision depends on ___ the budget is approved.', clause: 'the budget is approved', gapAt: -1,
      d: { front: 'noun', role: 'prep', back: 'full', sense: 'yesno' }, ans: 'whether', fill: 'Is the budget approved? → 승인되느냐 아니냐',
      why: '수동태 is approved → 목적어가 필요 없어요. 빠진 것이 없어요.', trapHint: '전치사 on 뒤에는 if를 못 써요.', ko: '결정은 예산이 승인되느냐에 달려 있어요.' },
  ];
  WH.FRONT3 = { ante: '명사 뒤 — 명사를 꾸밈 (관계사)', noun: '명사 자리 — 주어·목적어·전치사 뒤 (명사절)', adv: '문장 밖 — 완전한 문장에 붙음 (부사절)' };
  WH.detTokens = it => it.clause.split(' ');

  /* ---------- 데이터 점검 ---------- */
  // 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, △(시험 답이 아닌 말)가 보기에 없는지, 단서 글자가 문장에 있는지, 정답 위치가 고르게 섞였는지
  WH.check = function () {
    const bad = [];
    WH.DRILL.forEach((it, i) => {
      const n = `연습 문제 ${i + 1}`;
      if ((it.q.match(/___/g) || []).length !== 1) bad.push(`${n}: 빈칸이 하나가 아니에요`);
      if (it.type === 'order') {
        const forms = it.opts.map(o => WH.formOf(o, it.subj));
        const good = forms.map((f, k) => f === 'stmt' ? k : -1).filter(k => k >= 0);
        if (good.length !== 1 || good[0] !== it.a) bad.push(`${n}: 어순 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
        if (!it.q.includes(it.wh + ' ___')) bad.push(`${n}: 빈칸 앞 의문사 ‘${it.wh}’가 없어요`);
        return;
      }
      it.opts.forEach(o => { if (!WH.word(o)) bad.push(`${n}: ‘${o}’가 사전에 없어요`); });
      const js = it.opts.map(o => WH.judge(o, it.d));
      const good = js.map((j, k) => j.s === 'ok' ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${n}: 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      js.forEach((j, k) => { if (j.s === 'warn') bad.push(`${n}: 보기 ‘${it.opts[k]}’ → △(시험 답이 아닌 말)라 보기에서 빼요`); });
      const c = it.c;
      ['ante', 'cue', 'trap', 'verb'].forEach(f => { if (c[f] && !it.q.includes(c[f])) bad.push(`${n}: 단서 ‘${c[f]}’가 문장에 없어요`); });
      if (c.gapAfter && !(c.cue || '').includes(c.gapAfter)) bad.push(`${n}: 빈자리 앞 낱말이 단서에 없어요`);
      if (it.d.back === 'obj' && !c.gapAfter) bad.push(`${n}: 목적어 빈자리의 위치(gapAfter)가 없어요`);
      if (it.d.front === 'ante' && !c.ante) bad.push(`${n}: 선행사 글자가 없어요`);
      const b = it.q.indexOf('___');
      if (c.cue && it.q.indexOf(c.cue) < b) bad.push(`${n}: 빈칸 뒤 단서가 빈칸 앞에 있어요`);
    });
    const pos = [0, 0, 0, 0]; WH.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 2) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    WH.DET.forEach(it => {
      const n = `탐지기 ${it.id}`, toks = WH.detTokens(it), b = it.q.indexOf('___');
      if (it.q.indexOf(it.clause) !== b + 4) bad.push(`${n}: 절이 빈칸 바로 뒤에 없어요`);
      const g = isGap(it.d);
      if (g !== (it.gapAt >= 0)) bad.push(`${n}: 빈자리 표시(gapAt)와 back이 달라요`);
      if (it.d.back === 'subj' && it.gapAt !== 0) bad.push(`${n}: 주어 빈자리는 첫 낱말 앞이어야 해요`);
      if (it.gapAt > toks.length) bad.push(`${n}: 빈자리 번호가 낱말 수보다 커요`);
      if (!WH.isOk(it.ans, it.d)) bad.push(`${n}: 대표 답 ${it.ans} → 규칙 엔진과 달라요`);
    });
    bad.forEach(x => console.warn('[관계부사·명사절] ' + x));
    return bad;
  };
})();
