/* 대명사 튜토리얼 — 규칙 엔진과 예문
 *
 * 대명사 빈칸 문제는 두 가지를 물어요. 빈칸이 누구(무엇)를 가리키나? 빈칸이 문장의 어느 자리에 있나?
 *   가리키는 말 → 대명사 표의 줄 (I · we · you · he · she · it · they)
 *   자리       → 대명사 표의 칸 (주격 · 목적격 · 소유격 · 소유대명사 · 재귀대명사)
 * 여기에 짝 표현(주어와 같은 사람 → -self, one ↔ the other, some ↔ others, of · who 앞 → that · those)을 더해
 * 3단계(① 화살표 → ② 자리 → ③ 짝)로 풀어요.
 * 영상의 ✓·×, 직접 해 보기, 놀이터(대명사 표 놀이터), 연습 문제, 퀴즈가 모두 PN.judge()로 맞고 틀림을 정하고,
 * 문제 데이터에 적은 정답이 judge()와 다르면 콘솔에 경고를 냅니다.
 *
 * 가리키는 말과 자리는 문제마다 데이터에 적어 둡니다. 규칙 엔진은 문장의 뜻을 스스로 알아내지 않아요.
 * judge(낱말, ctx) → { s: 'ok' | 'no', step: 0 | 1 | 2 | 3, why }   step = 3단계 풀이법의 몇 단계에서 지워지는지
 *   ctx.kind = 'case'   인칭대명사 · 재귀대명사:  { row: 줄, slot, same: 주어와 같은 사람인가, ante · who: 가리키는 말, subj: 주어, cue: 자리 단서 }
 *              slot: subj 동사 앞(주어) · obj 동사·전치사 뒤(목적어) · det 명사 앞 · alone 홀로(누구의 것) · emph 완전한 문장 + 강조 · itis 주어 + 동사(it is)
 *   ctx.kind = 'ind'    부정대명사:  { num: 1 하나 | 2 여럿, slot: alone 홀로 | det 명사 앞, noun: sg | pl, def: 정해진 나머지인가, set: 무리의 수, what, pair }
 *   ctx.kind = 'mutual' 서로:  { ante }
 *   ctx.kind = 'dem'    되풀이 대신 that · those:  { num, slot: subj | obj, post: of | who, ante · who, cue }
 */
(function () {
  'use strict';
  const PN = (window.PN = {});

  /* ---------- 대명사 표: 줄(가리키는 대상) × 칸(자리) ---------- */
  PN.ROWS = ['I', 'we', 'you', 'he', 'she', 'it', 'they'];
  PN.ROW = {
    I:    { ko: '나', who: '말하는 사람 하나', num: 1 },
    we:   { ko: '우리', who: '말하는 사람을 넣은 여럿', num: 2 },
    you:  { ko: '너 · 여러분', who: '듣는 사람', num: 0 },
    he:   { ko: '남자 하나', who: '남자 한 사람', num: 1 },
    she:  { ko: '여자 하나', who: '여자 한 사람', num: 1 },
    it:   { ko: '사물 · 회사 하나', who: '사물 · 회사 하나', num: 1 },
    they: { ko: '여럿', who: '사람이든 사물이든 여럿', num: 2 },
  };
  PN.CASES = ['subj', 'obj', 'poss', 'pron', 'refl'];
  PN.CASE = {
    subj: { name: '주격', slot: '동사 앞 (주어)', ko: '은 · 는 · 이 · 가' },
    obj:  { name: '목적격', slot: '동사 · 전치사 뒤 (목적어)', ko: '을 · 를 · 에게' },
    poss: { name: '소유격', slot: '명사 앞 (누구의)', ko: '의' },
    pron: { name: '소유대명사', slot: '홀로 (누구의 것)', ko: '의 것' },
    refl: { name: '재귀대명사', slot: '주어와 같은 사람 · 강조', ko: '자기 자신' },
  };
  PN.TABLE = {
    I:    ['I', 'me', 'my', 'mine', 'myself'],
    we:   ['we', 'us', 'our', 'ours', 'ourselves'],
    you:  ['you', 'you', 'your', 'yours', 'yourself'],
    he:   ['he', 'him', 'his', 'his', 'himself'],
    she:  ['she', 'her', 'her', 'hers', 'herself'],
    it:   ['it', 'it', 'its', '', 'itself'],
    they: ['they', 'them', 'their', 'theirs', 'themselves'],
  };
  PN.cell = (row, cs) => PN.TABLE[row][PN.CASES.indexOf(cs)];
  PN.SLOT = { subj: '동사 앞 (주어)', obj: '동사 · 전치사 뒤 (목적어)', det: '명사 앞', alone: '홀로 (뒤에 명사 없이 누구의 것)' };

  // 낱말 → 읽을 수 있는 줄·칸 (her = 목적격 · 소유격, his = 소유격 · 소유대명사처럼 모양이 같은 칸이 있음)
  const norm = w => String(w).toLowerCase().replace(/’/g, "'");
  const READ = {};
  Object.entries(PN.TABLE).forEach(([row, forms]) => forms.forEach((w, i) => { if (w) (READ[norm(w)] = READ[norm(w)] || []).push({ row, cs: PN.CASES[i] }); }));
  READ.yourselves = [{ row: 'you', cs: 'refl' }];
  PN.readings = w => READ[norm(w)] || null;

  // 인칭대명사가 아닌 낱말
  PN.WORDS = {
    "it's":       { fam: 'contr', row: 'it' },
    one:          { fam: 'ind', num: 1, def: false, alone: true, det: 'sg' },
    another:      { fam: 'ind', num: 1, def: false, alone: true, det: 'sg' },
    'the other':  { fam: 'ind', num: 1, def: true, alone: true, det: 'any' },
    others:       { fam: 'ind', num: 2, def: false, alone: true, det: null },
    'the others': { fam: 'ind', num: 2, def: true, alone: true, det: null },
    other:        { fam: 'ind', num: null, def: false, alone: false, det: 'pl' },
    'each other': { fam: 'mutual' },
    that:         { fam: 'dem', num: 1 },
    those:        { fam: 'dem', num: 2 },
  };
  PN.word = w => PN.WORDS[norm(w)] || null;

  /* ---------- 판정 ---------- */
  const ok = why => ({ s: 'ok', step: 0, why }), no = (step, why) => ({ s: 'no', step, why });
  const rowLine = r => `${PN.ROW[r].who} → ${r} 줄`;
  const anteOf = c => c.ante ? `가리키는 말 = ${c.ante}` : `가리키는 것 = ${c.who}`;
  const WANT = { subj: 'subj', obj: 'obj', det: 'poss', alone: 'pron', emph: 'refl' };
  const want = c => c.slot === 'obj' && c.same ? 'refl' : WANT[c.slot];
  PN.want = want;
  // 자리 이름 (단서 낱말을 넣어서)
  function slotName(c) {
    if (c.slot === 'subj') return c.cue ? `동사 ${c.cue} 앞 주어 자리` : '동사 앞 주어 자리';
    if (c.slot === 'obj') return c.cue ? `${c.cue} 뒤 목적어 자리` : '동사 · 전치사 뒤 목적어 자리';
    if (c.slot === 'det') return c.cue ? `${c.cueKo == null ? '명사 ' : c.cueKo}${c.cue} 앞` : '명사 앞';
    if (c.slot === 'alone') return '뒤에 명사 없이 ‘누구의 것’을 말하는 자리';
    if (c.slot === 'emph') return '문장이 다 끝난 뒤 덧붙이는 자리';
    return '주어와 동사가 함께 필요한 자리';
  }
  PN.slotName = slotName;
  // 2단계에서 지워지는지: 자리에 맞는 칸이 있는가 (목적어 자리는 -self도 통과 → 3단계에서 같은 사람인지 확인)
  const fits = (slot, cs) => slot === 'subj' ? cs === 'subj' : slot === 'obj' ? cs === 'obj' || cs === 'refl' : slot === 'det' ? cs === 'poss' : slot === 'alone' ? cs === 'pron' : slot === 'emph' ? cs === 'refl' : false;
  function slotWhy(w, rs, c) {
    const cs = rs.map(r => r.cs), names = cs.map(x => PN.CASE[x].name).join(' · ');
    const S = PN.cell(c.row, 'subj'), O = PN.cell(c.row, 'obj'), P = PN.cell(c.row, 'poss'), PR = PN.cell(c.row, 'pron'), RF = PN.cell(c.row, 'refl');
    const target = c.slot === 'subj' ? `주격 ${S}` : c.slot === 'obj' ? (c.same ? `목적어 모양 ${O} · ${RF}` : `목적격 ${O}`) : c.slot === 'det' ? `소유격 ${P}` : c.slot === 'alone' ? (PR ? `소유대명사 ${PR}` : '(it 줄에는 소유대명사가 없어요)') : RF;
    if (c.slot === 'itis') return `빈칸 바로 뒤에 동사가 없어요. 주어와 동사가 함께 필요해요 → It’s (= It is).`;
    if (c.slot === 'emph') return `문장이 이미 완전해요(${c.subj} + 동사 + ${c.cue}). 덧붙이는 자리라서 ${names} 모양은 못 와요.`;
    if (cs.every(x => x === 'refl')) return c.slot === 'subj' ? `-self(재귀대명사)는 주어 자리에 못 와요. ${slotName(c)} → 주격 ${S}.` : `${w} = 재귀대명사(-self). ${slotName(c)} → ${target}.`;
    if (c.slot === 'alone' && cs.includes('poss')) return `${w} = 소유격이라 바로 뒤에 명사가 꼭 와야 해요. 빈칸 뒤에 명사가 없어요 → ${target}.`;
    if (c.slot !== 'alone' && cs.every(x => x === 'pron')) return `${w} = 소유대명사(누구의 것)예요. ${c.slot === 'det' ? '뒤에 명사가 있으면' : '빈칸은 물건이 아니라 사람을 가리켜요'} → ${target}.`;
    if (cs.includes('poss') && c.slot !== 'det') return `${w} = ${names}. ‘누구의’를 뜻하는 소유격은 바로 뒤에 명사가 와야 해요. ${slotName(c)} → ${target}.`;
    return `${w} = ${names}. ${slotName(c)} → ${target}.`;
  }
  function okWhy(w, c) {
    const A = `${anteOf(c)} → ${rowLine(c.row)}.`;
    if (c.slot === 'subj') return `${A} ${slotName(c)} → 주격 ${w}.`;
    if (c.slot === 'obj') return c.same ? `${A} 빈칸 = 주어 ${c.subj} 자신 → 재귀대명사 ${w}.` + (c.cue === 'by' ? ' by + -self = 혼자서.' : '')
      : `${A} ${slotName(c)} → 목적격 ${w}.`;
    if (c.slot === 'det') return `${A} ${slotName(c)} → 소유격 ${w}.` + (c.cue === 'own' ? ' own 앞에는 늘 소유격.' : '');
    if (c.slot === 'alone') return `${A} 뒤에 명사 없이 ‘누구의 것’ → 소유대명사 ${w}.`;
    return `${c.subj} → 다른 사람이 아니라 직접 → 강조의 ${w}.`;
  }
  function judgeCase(w, c) {
    const R = PN.readings(w), X = PN.word(w);
    if (X && X.fam === 'contr') {
      if (c.row !== 'it') return no(1, `it’s = it is. ${anteOf(c)} → ${rowLine(c.row)}이라 줄이 달라요.`);
      if (c.slot === 'itis') return ok(`빈칸 뒤에 동사가 없어요 → It’s = It is (주어 + 동사).`);
      return no(2, `it’s = it is, 주어와 동사를 줄인 말이에요. ${slotName(c)} → ${c.slot === 'det' ? '소유격 its' : PN.cell('it', want(c) || 'subj')}.`);
    }
    if (!R) return no(1, `${w} = 정해진 사람 · 사물을 대신하는 말이 아니에요. ${anteOf(c)} → ${rowLine(c.row)}.`);
    const rs = R.filter(r => r.row === c.row);
    if (!rs.length) return no(1, `${anteOf(c)} → ${rowLine(c.row)}. ${w} = ${R[0].row} 줄(${PN.ROW[R[0].row].who}). 줄이 달라요.`);
    const f2 = rs.filter(r => fits(c.slot, r.cs));
    if (!f2.length) return no(2, slotWhy(w, rs, c));
    if (c.slot === 'obj') {
      if (c.same && !f2.some(r => r.cs === 'refl')) return no(3, `빈칸 = 주어 ${c.subj} 자신이에요. 같은 사람이면 → ${PN.cell(c.row, 'refl')}. ${w} = 주어가 아닌 다른 ${c.row === 'it' ? '것' : '사람'}을 가리켜요.`);
      if (!c.same && !f2.some(r => r.cs === 'obj')) return no(3, `주어 = ${c.subj}, 빈칸 = 다른 사람이에요. -self는 주어와 같은 사람일 때만 써요.`);
    }
    return ok(okWhy(w, c));
  }
  const NUM = n => n === 1 ? '하나' : '여럿', NUMO = n => n === 1 ? '하나를' : '여럿을';
  function judgeInd(w, c) {
    const X = PN.word(w);
    if (c.kind === 'mutual') return X && X.fam === 'mutual' ? ok(`주어(${c.ante})가 서로에게 하는 일 → each other.`)
      : no(3, `주어(${c.ante})가 서로에게 하는 일이에요 → each other. ${w} = ${X && X.def ? '남은 하나 · 나머지만 가리켜요' : '서로라는 뜻이 없어요'}.`);
    if (!X || X.fam === 'dem' || X.fam === 'contr') return no(1, `${w} = 정해진 사람 · 사물을 대신하는 말이에요. 여기서는 ‘몇 개 가운데 하나 · 나머지’를 말해요.`);
    if (X.fam === 'mutual') return no(2, 'each other = 서로. 주어가 서로에게 하는 일을 말할 때 목적어 자리에 와요.');
    if (X.num && X.num !== c.num) return no(1, `가리키는 것 = ${c.what} → ${NUM(c.num)}. ${w} = ${NUMO(X.num)} 가리켜요.`);
    if (c.slot === 'alone' && !X.alone) return no(2, `${w} = 혼자 못 쓰고 뒤에 복수 명사가 와요(other hotels). 빈칸 뒤에 명사가 없어요.`);
    if (c.slot === 'det') {
      if (!X.det) return no(2, `${w} = 홀로 쓰는 말이라 명사 앞에 못 와요. 빈칸 바로 뒤에 명사가 있어요 → ${c.cue}.`);
      if (X.det === 'pl' && c.noun === 'sg') return no(2, `other 뒤에는 복수 명사가 와요(other hotels). 빈칸 뒤가 단수 명사 → another.`);
      if (X.det === 'sg' && c.noun === 'pl') return no(2, `${w} = an + other, 하나라서 뒤에 단수 명사가 와요. 빈칸 뒤가 복수 명사 → other.`);
    }
    if (X.def !== c.def) {
      if (c.def) return no(3, c.num === 1 ? `${c.set === 3 ? '셋' : '둘'} 가운데 남은 마지막 하나 → the other. ${w} = 아직 더 있을 때 쓰는 ‘또 하나’예요.`
        : `정해진 무리의 나머지 전부 → the others. others = 정해지지 않은 다른 몇몇이에요.`);
      return no(3, c.num === 1 ? `정해지지 않은 ‘또 하나’ → another. the other = 남은 마지막 하나예요.` : `정해지지 않은 다른 몇몇 → others. the others = 정해진 무리의 나머지 전부예요.`);
    }
    const k = norm(w);
    if (k === 'the other') return ok(`${c.set === 3 ? '셋' : '둘'} 가운데 ${c.pair ? c.pair + ' 다음 ' : ''}남은 마지막 하나 → the other.`);
    if (k === 'another') return ok(c.slot === 'det' ? `빈칸 뒤에 단수 명사 → another (= an + other, 또 하나).` : `아직 더 있는 ‘또 하나’ → another.`);
    if (k === 'others') return ok(`${c.pair ? c.pair + ' … others. ' : ''}정해지지 않은 다른 몇몇 → others.`);
    if (k === 'the others') return ok(`정해진 무리의 나머지 전부(${c.what}) → the others.`);
    if (k === 'other') return ok('빈칸 뒤에 복수 명사 → other.');
    return ok(`${c.what} → ${w}.`);
  }
  function judgeDem(w, c) {
    const X = PN.word(w), R = PN.readings(w), A = anteOf(c);
    if (X && X.fam === 'dem') {
      if (X.num !== c.num) return no(1, `${A} → ${NUM(c.num)}. ${w} = ${NUMO(X.num)} 가리켜요.`);
      return ok(c.post === 'of' ? `${A} → ${NUM(c.num)}. 같은 명사를 되풀이하지 않고 → ${w} + ${c.cue}.` : `${A} → ‘~하는 사람들’ → those who.`);
    }
    if (!R) return no(1, `${w} = 이 자리에 맞지 않아요. ${A} → ${NUM(c.num)}.`);
    const n = PN.ROW[R[0].row].num;
    if (n && n !== c.num) return no(1, `${A} → ${NUM(c.num)}. ${w} = ${NUMO(n)} 가리켜요.`);
    const cs = R.map(r => r.cs);
    if (!cs.includes(c.slot === 'subj' ? 'subj' : 'obj')) return no(2, cs.includes('poss') ? `${w} = 소유격이라 바로 뒤에 명사가 와야 해요. 빈칸 바로 뒤에 명사가 없어요.`
      : `${w} = ${cs.map(x => PN.CASE[x].name).join(' · ')}. ${c.slot === 'subj' ? '이 자리는 문장의 주어 자리예요.' : '이 자리에 맞지 않아요.'}`);
    return no(3, c.post === 'of' ? `뒤에 ${c.cue} → 앞의 명사를 되풀이하는 자리 → ${c.num === 1 ? 'that' : 'those'}. ${w} = 뒤에 of …를 붙일 수 없어요.`
      : `뒤의 who 절이 꾸미는 ‘~하는 사람들’ → Those who. ${w} = who 절로 꾸밀 수 없어요.`);
  }
  PN.judge = function (w, c) {
    if (c.kind === 'case') return judgeCase(w, c);
    if (c.kind === 'dem') return judgeDem(w, c);
    return judgeInd(w, c);
  };
  // 낱말의 이름 (보기별 해설 앞머리)
  PN.kindName = function (w) {
    const R = PN.readings(w), X = PN.word(w);
    if (R) return [...new Set(R.map(r => PN.CASE[r.cs].name))].join(' · ');
    if (!X) return '';
    return { contr: 'it is의 줄임말', ind: '부정대명사', mutual: '서로', dem: '지시대명사' }[X.fam];
  };

  /* ---------- 3단계 판정기 (영상 09장 직접 해 보기): 줄 · 자리 · 같은 사람 → 칸 ---------- */
  PN.decide = function (row, slot, same) {
    const yes = same === 'yes';
    if (slot === 'subj' && yes) return { ok: false, why: '-self는 주어 자리에 못 와요. 주어 자리는 늘 주격이에요 → Mr. Okafor and I (myself ×).' };
    if (slot === 'alone' && row === 'it') return { ok: false, why: 'it 줄에는 소유대명사가 없어요. its는 늘 명사 앞에서 써요 → its office.' };
    const cs = slot === 'obj' && yes ? 'refl' : WANT[slot], w = PN.cell(row, cs);
    const note = yes && slot === 'det' ? ' 같은 사람이어도 명사 앞이면 소유격이에요 → She introduced her team.' : yes && slot === 'alone' ? ' 같은 사람이어도 홀로 ‘누구의 것’이면 소유대명사예요.' : yes ? ' 목적어가 주어와 같은 사람 → -self.' : '';
    return { ok: true, cs, word: w, text: `${row} 줄 · ${PN.CASE[cs].name} 칸 → ${w}`, why: `${PN.ROW[row].who}, ${PN.SLOT[slot]}.${note}` };
  };

  /* ---------- 영상 01장: 화살표 그리기 (대명사 → 가리키는 말) ----------
   * prs: [대명사, 가리키는 말, 줄 · 자리 설명] · ko: 한국어 문장 조각 (배열은 한국어에서 빠지거나 바뀌는 말) · pick: 가리키는 말 후보
   */
  PN.ARROWS = [
    { s: 'Ms. Kim finished the report and sent it to her manager.', prs: [['it', 'the report', '사물 하나 · 목적어 자리'], ['her', 'Ms. Kim', '여자 한 사람 · 명사 앞']], pick: ['Ms. Kim', 'the report', 'her manager'],
      ko: ['김 씨는 보고서를 끝내고 ', ['그것을'], ' ', ['자기'], ' 매니저에게 보냈어요.'] },
    { s: 'The interns asked Mr. Park whether he could check their slides.', prs: [['he', 'Mr. Park', '남자 한 사람 · 주어 자리'], ['their', 'The interns', '여럿 · 명사 앞']], pick: ['The interns', 'Mr. Park', 'their slides'],
      ko: ['인턴들은 박 씨에게 ', ['그가'], ' ', ['자기들'], ' 슬라이드를 봐 줄 수 있는지 물었어요.'] },
    { s: 'Mr. Lee bought two laptops and gave one to his daughter.', prs: [['one', 'two laptops', '두 대 가운데 하나'], ['his', 'Mr. Lee', '남자 한 사람 · 명사 앞']], pick: ['Mr. Lee', 'two laptops', 'his daughter'],
      ko: ['이 씨는 노트북 두 대를 사서 ', ['그중'], ' 한 대를 ', ['자기'], ' 딸에게 줬어요.'] },
  ];

  /* ---------- 영상 02장: 줄 고르기 (가리키는 말 → 줄) ---------- */
  PN.ROWS02 = [
    { a: 'Hanbit Electronics', row: 'it', s: 'Hanbit Electronics said it would open a new factory.', p: 'it', ko: '회사 하나' },
    { a: 'the employees', row: 'they', s: 'The employees said they would join the event.', p: 'they', ko: '사람 여럿' },
    { a: 'Ms. Kim', row: 'she', s: 'Ms. Kim said she would call back.', p: 'she', ko: '여자 한 사람' },
    { a: 'Mr. Park', row: 'he', s: 'Mr. Park said he would call back.', p: 'he', ko: '남자 한 사람' },
    { a: 'the printers', row: 'they', s: 'The printers are old, but they still work.', p: 'they', ko: '사물 여럿' },
    { a: 'Mina and I', row: 'we', s: 'Mina and I said we would help.', p: 'we', ko: '나를 넣은 여럿' },
  ];

  /* ---------- 영상 03장: 칸 고르기 (한국어 조사 ↔ 영어 모양) ---------- */
  PN.COLS03 = {
    they: { ko: ['그들은', '그들을', '그들의', '그들의 것'], ex: [['They finished their report.', [['They', 'subj'], ['their', 'poss']]], ['The manager thanked them. The best report was theirs.', [['them', 'obj'], ['theirs', 'pron']]]] },
    she:  { ko: ['그녀는', '그녀를', '그녀의', '그녀의 것'], ex: [['She finished her report.', [['She', 'subj'], ['her', 'poss']]], ['The manager thanked her. The best report was hers.', [['her', 'obj'], ['hers', 'pron']]]] },
    it:   { ko: ['그것은', '그것을', '그것의', '(없음)'], ex: [['The printer is new. It has its own screen.', [['It', 'subj'], ['its', 'poss']]], ['Everyone likes it.', [['it', 'obj']]]] },
    we:   { ko: ['우리는', '우리를', '우리의', '우리의 것'], ex: [['We finished our report.', [['We', 'subj'], ['our', 'poss']]], ['The manager thanked us. The best report was ours.', [['us', 'obj'], ['ours', 'pron']]]] },
  };

  /* ---------- 영상 04·05·07장 직접 해 보기: 둘 가운데 고르기 (문장마다 ctx를 적어 둠) ---------- */
  const C = (o) => Object.assign({ kind: 'case' }, o);
  PN.SORT04 = [
    { q: 'The company updated ___ website last month.', opts: ['its', 'it’s'], c: C({ row: 'it', slot: 'det', ante: 'The company', cue: 'website' }) },
    { q: 'Our printer is new, and ___ very fast.', opts: ['its', 'it’s'], c: C({ row: 'it', slot: 'itis', ante: 'Our printer' }) },
    { q: 'The interns put ___ bags on this desk.', opts: ['their', 'theirs'], c: C({ row: 'they', slot: 'det', ante: 'The interns', cue: 'bags' }) },
    { q: 'The interns asked for this desk, so it is ___ now.', opts: ['their', 'theirs'], c: C({ row: 'they', slot: 'alone', ante: 'The interns' }) },
    { q: 'Ms. Cho lost an umbrella. The blue one is ___.', opts: ['her', 'hers'], c: C({ row: 'she', slot: 'alone', ante: 'Ms. Cho' }) },
    { q: 'Each branch sets ___ own hours.', opts: ['its', 'it’s'], c: C({ row: 'it', slot: 'det', ante: 'Each branch', cue: 'own', cueKo: '' }) },
  ];
  PN.SORT05 = [
    { ko: '박 씨는 거울 속 자기를 봤어요.', q: 'Mr. Park looked at ___ in the mirror.', opts: ['him', 'himself'], c: C({ row: 'he', slot: 'obj', same: true, ante: 'Mr. Park', subj: 'Mr. Park', cue: 'looked at' }) },
    { ko: '박 씨는 자기 차를 팔았어요.', q: 'Mr. Park sold ___ car.', opts: ['his', 'himself'], c: C({ row: 'he', slot: 'det', ante: 'Mr. Park', cue: 'car' }) },
    { ko: '김 씨는 손님들에게 자기를 소개했어요.', q: 'Ms. Kim introduced ___ to the guests.', opts: ['her', 'herself'], c: C({ row: 'she', slot: 'obj', same: true, ante: 'Ms. Kim', subj: 'Ms. Kim', cue: 'introduced' }) },
    { ko: '김 씨는 손님들을 자기 팀에게 소개했어요.', q: 'Ms. Kim introduced the guests to ___ team.', opts: ['her', 'herself'], c: C({ row: 'she', slot: 'det', ante: 'Ms. Kim', cue: 'team' }) },
    { ko: '그 회사는 자기를 친환경 기업이라고 불러요.', q: 'The company calls ___ an eco-friendly business.', opts: ['it', 'itself'], c: C({ row: 'it', slot: 'obj', same: true, ante: 'The company', subj: 'The company', cue: 'calls' }) },
    { ko: '우리는 그 일을 우리끼리 해냈어요.', q: 'We did all the work by ___.', opts: ['us', 'ourselves'], c: C({ row: 'we', slot: 'obj', same: true, ante: 'We', subj: 'We', cue: 'by' }) },
  ];
  PN.SORT07 = [
    { q: 'One of the two keys is mine; ___ is Ms. Cho’s.', opts: ['another', 'the other'], c: { kind: 'ind', num: 1, slot: 'alone', def: true, set: 2, pair: 'One', what: '열쇠 두 개 가운데 남은 하나' } },
    { q: 'Some customers paid in cash, and ___ used credit cards.', opts: ['others', 'the others'], c: { kind: 'ind', num: 2, slot: 'alone', def: false, pair: 'Some', what: '다른 손님 몇몇' } },
    { q: 'Three of the five rooms are booked; ___ are still available.', opts: ['others', 'the others'], c: { kind: 'ind', num: 2, slot: 'alone', def: true, set: 5, what: '방 다섯 개 가운데 남은 둘' } },
    { q: 'Would you like ___ cup of coffee?', opts: ['another', 'other'], c: { kind: 'ind', num: 1, slot: 'det', noun: 'sg', def: false, cue: 'cup', what: '커피 한 잔 더' } },
    { q: 'Unlike ___ hotels in the area, the Bayview offers free parking.', opts: ['other', 'another'], c: { kind: 'ind', num: 2, slot: 'det', noun: 'pl', def: false, cue: 'hotels', what: '이 지역의 다른 호텔들' } },
    { q: 'The two partners trust ___ completely.', opts: ['each other', 'the other'], c: { kind: 'mutual', ante: 'The two partners' } },
  ];

  /* ---------- 영상 08장: 되풀이 대신 that · those ----------
   * s: 문장 · head: 가리키는 말 · rep: 되풀이할 뻔한 말 · w: that | those · post: 꾸밈말의 첫 낱말
   */
  PN.CMP = [
    { s: 'The price of the new model is lower than that of the old model.', head: 'The price', rep: 'the price', w: 'that', post: 'of the old model', ko: '새 모델의 가격은 옛 모델의 가격보다 낮아요.' },
    { s: 'This year’s sales are higher than those of last year.', head: 'sales', rep: 'the sales', w: 'those', post: 'of last year', ko: '올해 매출은 작년 매출보다 높아요.' },
    { s: 'The quality of our service is better than that of our rivals.', head: 'The quality', rep: 'the quality', w: 'that', post: 'of our rivals', ko: '우리 서비스의 품질은 경쟁사의 품질보다 좋아요.' },
    { s: 'The rooms on the third floor are larger than those on the second floor.', head: 'The rooms', rep: 'the rooms', w: 'those', post: 'on the second floor', ko: '3층 방은 2층 방보다 넓어요.' },
    { s: 'The population of Busan is larger than that of Daegu.', head: 'The population', rep: 'the population', w: 'that', post: 'of Daegu', ko: '부산의 인구는 대구의 인구보다 많아요.' },
  ];
  PN.cmpFull = E => E.s.replace(` ${E.w} `, ` ${E.rep} `);

  /* ---------- 놀이터: 대명사 표 놀이터 (가리키는 말 × 문장 틀) ----------
   * 가리키는 말: s 주어로 쓸 때 · o 목적어로 쓸 때 · row 줄 · K 한국어 주제어 · D 한국어 ‘~에게’ · P 한국어 ‘자기’
   * 문장 틀: {S}/{O} 자리에 가리키는 말, ___ 자리에 대명사. slot · same · cue는 판정에 그대로 씀. not: 이 틀에 쓰지 않는 가리키는 말
   */
  PN.PG_ANTE = [
    { id: 'kim', s: 'Ms. Kim', o: 'Ms. Kim', row: 'she', name: '김 씨', K: '김 씨는', D: '김 씨에게', P: '자기' },
    { id: 'park', s: 'Mr. Park', o: 'Mr. Park', row: 'he', name: '박 씨', K: '박 씨는', D: '박 씨에게', P: '자기' },
    { id: 'firm', s: 'Hanbit Foods', o: 'Hanbit Foods', row: 'it', name: '한빛푸드 (회사)', K: '한빛푸드는', D: '한빛푸드에', P: '자사' },
    { id: 'partners', s: 'Our partners', o: 'our partners', row: 'they', name: '협력사들', K: '협력사들은', D: '협력사들에게', P: '자기네' },
    { id: 'we', s: 'We', o: 'us', row: 'we', name: '우리', K: '우리는', D: '우리에게', P: '우리' },
    { id: 'i', s: 'I', o: 'me', row: 'I', name: '나', K: '나는', D: '나에게', P: '내' },
  ];
  PN.PG_FRAMES = [
    { id: 'subj', name: '주어', q: '{S} announced that ___ would hire ten new staff members.', slot: 'subj', cue: 'would hire', ko: '{K} 직원 열 명을 새로 뽑겠다고 발표했어요.' },
    { id: 'obj', name: '목적어', q: 'The mayor thanked {O} and gave ___ an award.', slot: 'obj', cue: 'gave', subj: 'The mayor', ko: '시장은 {D} 고마워하며 상을 줬어요.' },
    { id: 'det', name: '명사 앞', q: '{S} moved ___ office to the third floor.', slot: 'det', cue: 'office', ko: '{K} {P} 사무실을 3층으로 옮겼어요.' },
    { id: 'alone', name: '홀로', q: '{S} booked a booth early, so the big booth near the entrance is ___.', slot: 'alone', not: ['firm'], ko: '{K} 부스를 일찍 예약해서, 입구 옆 큰 부스는 {N} 것이에요.' },
    { id: 'same', name: '같은 사람', q: '{S} prepared ___ for the busy holiday season.', slot: 'obj', same: true, cue: 'prepared', ko: '{K} 바쁜 연휴 시즌에 대비해 스스로 준비했어요.' },
    { id: 'by', name: 'by + 혼자서', q: '{S} built the new website by ___.', slot: 'obj', same: true, cue: 'by', ko: '{K} 새 웹사이트를 남의 도움 없이 혼자 힘으로 만들었어요.' },
  ];
  PN.pgOk = (A, F) => !(F.not || []).includes(A.id);
  PN.pgSentence = (A, F) => F.q.replace('{S}', A.s).replace('{O}', A.o);
  PN.pgKo = (A, F) => F.ko.replace('{K}', A.K).replace('{D}', A.D).replace('{P}', A.P).replace('{N}', A.id === 'i' ? '내' : A.name.replace(/ \(.*\)/, ''));
  PN.pgCtx = (A, F) => ({ kind: 'case', row: A.row, slot: F.slot, same: !!F.same, ante: F.q.includes('{O}') ? A.o : A.s, subj: F.subj || A.s, cue: F.cue });
  const fill = (q, w) => { const i = q.indexOf('___'); const s = q.slice(0, i) + w + q.slice(i + 3); return i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  PN.fill = fill;
  // 고른 칸 [줄, 칸]의 판정: 줄이 맞나, 칸이 맞나, 낱말이 맞나(her는 목적격 · 소유격이 같은 모양)
  PN.pgJudge = function (A, F, row, cs) {
    const c = PN.pgCtx(A, F), rc = want(c), rw = PN.cell(c.row, rc), w = PN.cell(row, cs);
    const j = w ? PN.judge(w, c) : no(row === c.row ? 2 : 1, 'it 줄에는 소유대명사가 없어요. 빈 칸이에요.');
    const rowOk = row === c.row, colOk = cs === rc, wordOk = !!w && w.toLowerCase() === rw.toLowerCase();
    return { c, rowOk, colOk, wordOk, ok: wordOk, word: w, right: { row: c.row, cs: rc, word: rw }, j, text: fill(PN.pgSentence(A, F), rw) };
  };
  PN.pgSteps = function (A, F) {
    const c = PN.pgCtx(A, F), rc = want(c);
    return [
      `① 화살표: 빈칸 → ${c.ante} → ${PN.ROW[c.row].who} → ${c.row} 줄.`,
      `② 자리: ${slotName(c)} → ${F.same ? '목적어 모양(목적격 · 재귀대명사)' : PN.CASE[rc].name + ' 칸'}.`,
      `③ 짝: ${F.same ? `빈칸 = 주어 ${c.subj} 자신 → 재귀대명사 칸` + (F.cue === 'by' ? ' (by + -self = 혼자서)' : '') : F.slot === 'obj' ? `주어 = ${c.subj}, 빈칸 = 다른 사람 → -self 아님` : '같은 사람 · 짝 표현을 따로 볼 것 없음'}. 정답 → ${PN.cell(c.row, rc)}.`,
    ];
  };

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * kind: case · ind · dem (위의 ctx 설명 참고). ante: 가리키는 말(문장 속 글자) · who: 문장에 없을 때의 설명
   * cue: 2단계의 자리 단서(문장 속 글자) · cueNth: 같은 글자가 앞에 또 있을 때 몇 번째인지 · pair: 3단계의 짝 단서(문장 속 글자)
   * ko3: 3단계에 덧붙일 말 · type: docs/toeic-100-types.md의 유형 번호
   */
  PN.DRILL = [
    { q: 'Please send ___ your comments on the draft by Friday.', opts: ['we', 'us', 'our', 'ours'], a: 1,
      kind: 'case', row: 'we', slot: 'obj', who: '이 글을 쓴 사람들(우리)', subj: 'you(명령문의 숨은 주어)', cue: 'send',
      tag: '목적격 · 동사 뒤', type: 43, ko: '초안에 대한 의견을 금요일까지 저희에게 보내 주세요.' },
    { q: 'Staff members are asked to keep ___ personal belongings in the lockers.', opts: ['they', 'them', 'their', 'theirs'], a: 2,
      kind: 'case', row: 'they', slot: 'det', ante: 'Staff members', cue: 'personal belongings',
      tag: '소유격 · 명사 앞', type: 43, ko: '직원들은 개인 소지품을 사물함에 보관해야 해요.' },
    { q: 'Ms. Grant consulted her team, but the final decision was ___.', opts: ['she', 'her', 'herself', 'hers'], a: 3,
      kind: 'case', row: 'she', slot: 'alone', ante: 'Ms. Grant', ko3: 'hers = her decision(그녀의 결정).',
      tag: '소유대명사 · 홀로', type: 43, ko: '그랜트 씨는 팀과 의논했지만, 마지막 결정은 그녀의 몫이었어요.' },
    { q: 'Mr. Okafor and ___ will lead the training session on Monday.', opts: ['I', 'me', 'my', 'myself'], a: 0,
      kind: 'case', row: 'I', slot: 'subj', who: '말하는 사람(나)', cue: 'will lead', ko3: 'Mr. Okafor and I = 주어 두 사람.',
      tag: '주격 · -self 함정', type: 43, ko: '오카포 씨와 제가 월요일 교육을 진행해요.' },
    { q: 'Ms. Novak, the new manager, introduced ___ to the staff at the start of the meeting.', opts: ['she', 'her', 'hers', 'herself'], a: 3,
      kind: 'case', row: 'she', slot: 'obj', same: true, ante: 'Ms. Novak', subj: 'Ms. Novak', cue: 'introduced',
      tag: '재귀대명사 · 주어 = 목적어', type: 44, ko: '새 매니저 노박 씨는 회의를 시작할 때 직원들에게 자기를 소개했어요.' },
    { q: 'Mr. Tanaka designed the company’s new website by ___.', opts: ['he', 'his', 'himself', 'him'], a: 2,
      kind: 'case', row: 'he', slot: 'obj', same: true, ante: 'Mr. Tanaka', subj: 'Mr. Tanaka', cue: 'by',
      tag: 'by + -self = 혼자서', type: 44, ko: '다나카 씨는 회사의 새 웹사이트를 혼자서 만들었어요.' },
    { q: 'Ms. Lopez, the CEO, will hand out the awards ___.', opts: ['herself', 'she', 'her', 'hers'], a: 0,
      kind: 'case', row: 'she', slot: 'emph', ante: 'Ms. Lopez', subj: 'Ms. Lopez', cue: 'the awards',
      tag: '강조 · 직접', type: 44, ko: '최고경영자인 로페스 씨가 직접 상을 나눠 줄 거예요.' },
    { q: 'Ms. Diaz completed the inventory check on ___ own.', opts: ['she', 'her', 'hers', 'herself'], a: 1,
      kind: 'case', row: 'she', slot: 'det', ante: 'Ms. Diaz', cue: 'own', cueKo: '', ko3: 'on one’s own = by oneself = 혼자서.',
      tag: 'on one’s own = 혼자서', type: 44, ko: '디아스 씨는 재고 점검을 혼자서 마쳤어요.' },
    { q: 'The firm has two offices: one is in Seoul, and ___ is in Busan.', opts: ['another', 'other', 'the other', 'others'], a: 2,
      kind: 'ind', num: 1, slot: 'alone', def: true, set: 2, ante: 'two offices', pair: 'one', cue: 'is in Busan', what: '두 사무실 가운데 남은 하나',
      tag: 'one … the other', type: 45, ko: '그 회사는 사무실이 둘이에요. 하나는 서울에, 다른 하나는 부산에 있어요.' },
    { q: 'If this time does not suit you, please suggest ___ date.', opts: ['another', 'other', 'others', 'the others'], a: 0,
      kind: 'ind', num: 1, slot: 'det', noun: 'sg', def: false, cue: 'date', what: '다른 날짜 하나',
      tag: 'another + 단수 명사', type: 45, ko: '이 시간이 맞지 않으면 다른 날짜를 제안해 주세요.' },
    { q: 'Some employees prefer to work from home, while ___ prefer to come to the office.', opts: ['other', 'others', 'the other', 'another'], a: 1,
      kind: 'ind', num: 2, slot: 'alone', def: false, ante: 'Some employees', pair: 'Some', cue: 'prefer to come', what: '다른 직원 몇몇',
      tag: 'some … others', type: 45, ko: '어떤 직원은 재택근무를 좋아하고, 다른 직원들은 사무실에 나오는 걸 좋아해요.' },
    { q: 'Of the three printers on this floor, one is out of order, but ___ are working normally.', opts: ['the other', 'another', 'others', 'the others'], a: 3,
      kind: 'ind', num: 2, slot: 'alone', def: true, set: 3, ante: 'three printers', pair: 'one', cue: 'are working', what: '프린터 세 대 가운데 남은 두 대',
      tag: '정해진 나머지 전부 · the others', type: 45, ko: '이 층의 프린터 세 대 가운데 한 대는 고장 났지만, 나머지는 잘 돌아가요.' },
    { q: 'Hanbit Electronics has moved ___ headquarters to Incheon.', opts: ['its', 'it', 'their', 'it’s'], a: 0,
      kind: 'case', row: 'it', slot: 'det', ante: 'Hanbit Electronics', cue: 'headquarters', ko3: '직원이 많아도 회사는 하나 → its.',
      tag: '회사 → it · its', type: 46, ko: '한빛전자는 본사를 인천으로 옮겼어요.' },
    { q: 'This year’s sales figures are much higher than ___ of last year.', opts: ['that', 'those', 'it', 'them'], a: 1,
      kind: 'dem', num: 2, slot: 'obj', post: 'of', ante: 'sales figures', cue: 'of last year',
      tag: 'those of · 비교', type: 46, ko: '올해 판매 실적은 작년 실적보다 훨씬 높아요.' },
    { q: 'The price of the new model is lower than ___ of the previous model.', opts: ['it', 'its', 'that', 'those'], a: 2,
      kind: 'dem', num: 1, slot: 'obj', post: 'of', ante: 'The price', cue: 'of the previous model',
      tag: 'that of · 비교', type: 46, ko: '새 모델의 가격은 이전 모델의 가격보다 낮아요.' },
    { q: '___ who wish to attend the workshop should register by Friday.', opts: ['They', 'Them', 'Their', 'Those'], a: 3,
      kind: 'dem', num: 2, slot: 'subj', post: 'who', who: '워크숍에 오고 싶은 사람들', cue: 'who wish',
      tag: 'those who', type: 46, ko: '워크숍에 참석하고 싶은 사람은 금요일까지 등록하세요.' },
  ];
  PN.ctxOf = it => {
    const c = { kind: it.kind };
    ['row', 'slot', 'same', 'ante', 'who', 'subj', 'cue', 'cueKo', 'num', 'noun', 'def', 'set', 'what', 'pair', 'post'].forEach(k => { if (it[k] != null) c[k] = it[k]; });
    return c;
  };
  PN.judgeOpt = (it, k) => PN.judge(it.opts[k], PN.ctxOf(it));

  // 3단계 풀이 (연습 문제 힌트). ① 화살표 ② 자리 ③ 짝
  const L = 'ABCD';
  PN.steps = function (it) {
    const c = PN.ctxOf(it);
    const out = step => it.opts.map((o, k) => [k, PN.judgeOpt(it, k)]).filter(([, j]) => j.step === step).map(([k]) => `(${L[k]}) ${it.opts[k]}`);
    const o1 = out(1), o2 = out(2), o3 = out(3), drop = o => o.length ? ` 탈락: ${o.join(' · ')}.` : '';
    let t1, t2, t3;
    if (it.kind === 'case') t1 = `${anteOf(c)} → ${rowLine(c.row)}.` + (o1.length ? drop(o1) : ' 보기가 모두 같은 줄이에요.');
    else if (it.kind === 'dem') t1 = `${anteOf(c)} → ${NUM(c.num)}.` + drop(o1);
    else t1 = `가리키는 것 = ${c.what} → ${NUM(c.num)}.` + drop(o1);
    if (it.kind === 'case') {
      t2 = c.slot === 'subj' ? `빈칸 = ${slotName(c)} → 주격.`
        : c.slot === 'obj' ? `빈칸 = ${slotName(c)} → 목적격${c.same ? ' 또는 재귀대명사' : ''}.`
        : c.slot === 'det' ? `빈칸 바로 뒤 → ${c.cue}. ${c.cue === 'own' ? 'own 앞은 소유격 자리예요.' : '명사 앞 → 소유격.'}`
        : c.slot === 'alone' ? '빈칸 뒤에 명사가 없어요. ‘누구의 것’ → 소유대명사.'
        : `빈칸 앞 문장이 이미 완전해요 → ${c.subj} + will hand out + ${c.cue}. 빈칸은 덧붙이는 자리.`;
    } else if (it.kind === 'dem') t2 = c.slot === 'subj' ? '빈칸 = 문장의 주어 자리. 바로 뒤에 명사가 없어요.' : `빈칸 = than 뒤 비교 대상 자리. 바로 뒤에 명사가 없어요 → ${c.cue}.`;
    else t2 = c.slot === 'det' ? `빈칸 바로 뒤에 ${c.noun === 'sg' ? '단수' : '복수'} 명사 → ${c.cue}.` : `빈칸 뒤에 명사 없이 동사가 와요 → ${c.cue}. 홀로 쓰는 말이 필요해요.`;
    t2 += drop(o2);
    if (it.kind === 'case') {
      t3 = c.slot === 'obj' ? (c.same ? `빈칸 = 주어 ${c.subj} 자신 → 같은 사람이면 -self.` + (c.cue === 'by' ? ' by + -self = 혼자서.' : '') : `주어 = ${c.subj}, 빈칸 = 다른 사람 → -self가 아니에요.`)
        : c.slot === 'emph' ? `${c.subj} → 다른 사람이 아니라 직접 → 강조의 -self.`
        : c.slot === 'subj' ? '-self는 주어 자리에 못 와요.'
        : '같은 사람 · 짝 표현은 따로 없어요.';
    } else if (it.kind === 'dem') t3 = c.post === 'of' ? `뒤에 ${c.cue} → 앞의 명사를 되풀이하지 않는 짝 → that · those + of.` : '뒤의 who 절 → ‘~하는 사람들’ = those who.';
    else t3 = c.def ? (c.num === 1 ? `짝 → ${c.pair} … the other. 둘 가운데 남은 마지막 하나예요.` : `짝 → ${c.pair} … the others. 정해진 무리의 나머지 전부예요.`)
      : (c.num === 1 ? '정해지지 않은 ‘또 하나’ → another.' : `짝 → ${c.pair} … others. 정해지지 않은 다른 몇몇이에요.`);
    if (it.ko3) t3 += ' ' + it.ko3;
    t3 += drop(o3) + ` 정답 (${L[it.a]}) ${it.opts[it.a]}.`;
    const inQ = t => t && it.q.includes(t);
    const m1 = inQ(it.ante) ? [{ t: it.ante, role: 'ante' }] : [];
    const m2 = inQ(it.cue) ? [{ t: it.cue, role: 'cue', nth: it.cueNth || 0 }] : [];
    const m3 = inQ(it.pair) && it.pair !== it.ante && !(it.ante || '').includes(it.pair) ? [{ t: it.pair, role: 'verb' }] : [];
    return [
      { head: '① 화살표를 그려요.', text: t1, marks: m1 },
      { head: '② 자리를 봐요.', text: t2, marks: m2 },
      { head: '③ 짝을 확인해요.', text: t3, marks: m3 },
    ];
  };
  PN.drillItems = () => PN.DRILL.map(it => ({
    q: it.q, opts: it.opts.slice(), a: it.a, ko: it.ko, tag: it.tag, steps: PN.steps(it),
    notes: it.opts.map((o, k) => { const j = PN.judgeOpt(it, k), nm = PN.kindName(o), head = nm && !j.why.startsWith(o + ' = ') ? nm + '. ' : ''; return (j.s === 'ok' ? '' : '× ') + head + j.why; }),
  }));

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용 — 직접 해 보기·놀이터로만 나오는 글자 포함)
  PN.allText = function () {
    const out = [];
    Object.values(PN.TABLE).forEach(f => out.push(f.join(' ')));
    Object.values(PN.ROW).forEach(r => out.push(r.ko, r.who));
    Object.values(PN.CASE).forEach(r => out.push(r.name, r.slot, r.ko));
    PN.ARROWS.forEach(E => out.push(E.s, E.pick.join(''), E.ko.flat().join('')));
    PN.ROWS02.forEach(E => out.push(E.a, E.s, E.ko));
    Object.values(PN.COLS03).forEach(E => out.push(E.ko.join(''), E.ex.map(x => x[0]).join('')));
    PN.CMP.forEach(E => out.push(E.s, PN.cmpFull(E), E.ko));
    PN.PG_ANTE.forEach(A => PN.PG_FRAMES.forEach(F => out.push(PN.pgSentence(A, F), PN.pgJudge(A, F, A.row, 'subj').text)));
    PN.PG_FRAMES.forEach(F => out.push(F.name));
    out.push(Object.values(PN.SLOT).join(''), '가리키는 말자리 줄 칸 정답 같은 사람 다른 사람 강조 직접 혼자서 짝');
    return out.join('');
  };

  // 데이터 점검: 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, 단서가 문장에 있는지, 보기가 사전에 있는지, 정답 위치가 고르게 섞였는지
  PN.check = function () {
    const bad = [];
    const known = w => PN.readings(w) || PN.word(w);
    PN.DRILL.forEach((it, i) => {
      const w = `연습 문제 ${i + 1}`;
      const good = it.opts.map((o, k) => PN.judgeOpt(it, k).s === 'ok' ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      [it.ante, it.cue, it.pair, it.subj && !/명령문/.test(it.subj) ? it.subj : null].filter(Boolean).forEach(t => { if (!it.q.includes(t)) bad.push(`${w}: 단서 ‘${t}’가 문장에 없어요`); });
      if ((it.q.match(/___/g) || []).length !== 1) bad.push(`${w}: 빈칸이 하나가 아니에요`);
      it.opts.forEach(o => { if (!known(o)) bad.push(`${w}: 보기 ${o}가 사전에 없어요`); });
      if (it.kind === 'case' && !PN.ROW[it.row]) bad.push(`${w}: 줄 ${it.row}가 없어요`);
      if (!it.ante && !it.who && !it.what) bad.push(`${w}: 가리키는 말이 없어요`);
      if (!PN.steps(it).every(s => s.text)) bad.push(`${w}: 풀이 단계가 비어 있어요`);
    });
    const pos = [0, 0, 0, 0]; PN.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 1) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    // 놀이터: 쓸 수 있는 짝마다 정답 칸이 비어 있지 않고, 표 전체에서 맞는 낱말이 정답 낱말 하나뿐이어야 해요
    PN.PG_ANTE.forEach(A => PN.PG_FRAMES.filter(F => PN.pgOk(A, F)).forEach(F => {
      const w = `놀이터 ${A.id}·${F.id}`, q = PN.pgSentence(A, F), c = PN.pgCtx(A, F);
      if (!q.includes('___') || !q.includes(c.ante)) bad.push(`${w}: 문장에 빈칸이나 가리키는 말이 없어요`);
      if (c.cue && !q.includes(c.cue)) bad.push(`${w}: 단서 ‘${c.cue}’가 문장에 없어요`);
      const R = PN.pgJudge(A, F, A.row, PN.want(c));
      if (!R.right.word) bad.push(`${w}: 정답 칸이 비어 있어요`);
      const oks = new Set();
      PN.ROWS.forEach(r => PN.CASES.forEach(cs => { const x = PN.cell(r, cs); if (x && PN.judge(x, c).s === 'ok') oks.add(x.toLowerCase()); }));
      if (oks.size !== 1 || !oks.has(R.right.word.toLowerCase())) bad.push(`${w}: 맞는 낱말이 하나가 아니에요 ${[...oks]}`);
      if (/\{|\}/.test(PN.pgKo(A, F))) bad.push(`${w}: 한국어 해석에 빈 곳이 있어요`);
    }));
    // 직접 해 보기: 둘 가운데 꼭 하나만 맞아야 해요
    PN.SORT04.concat(PN.SORT05, PN.SORT07).forEach((it, i) => {
      const n = it.opts.filter(o => PN.judge(o, it.c).s === 'ok').length;
      if (n !== 1) bad.push(`직접 해 보기 고르기 ${i + 1} (${it.q}): 맞는 보기가 ${n}개예요`);
      if (it.c.ante && !it.q.includes(it.c.ante)) bad.push(`직접 해 보기 고르기 ${i + 1}: 가리키는 말이 문장에 없어요`);
    });
    PN.ARROWS.forEach((E, i) => E.prs.forEach(([p, a]) => { if (!E.s.includes(' ' + p + ' ') || !E.s.includes(a) || !E.pick.includes(a)) bad.push(`01장 문장 ${i + 1}: ${p} → ${a}가 맞지 않아요`); }));
    PN.ROWS02.forEach(E => { if (!E.s.toLowerCase().includes(E.a.toLowerCase()) || PN.cell(E.row, 'subj') !== E.p || !E.s.includes(' ' + E.p + ' ')) bad.push(`02장 ${E.a}: 줄과 문장이 맞지 않아요`); });
    PN.CMP.forEach(E => { if (!E.s.includes(` ${E.w} ${E.post}`) || !E.s.includes(E.head)) bad.push(`08장 ${E.head}: 문장이 맞지 않아요`); });
    Object.entries(PN.COLS03).forEach(([row, E]) => E.ex.forEach(([s, ms]) => ms.forEach(([w, cs]) => { if (PN.cell(row, cs).toLowerCase() !== w.toLowerCase() || !new RegExp('\\b' + w + '\\b').test(s)) bad.push(`03장 ${row}: ${w}(${cs})가 맞지 않아요`); })));
    bad.forEach(b => console.warn('[대명사] ' + b));
    return bad;
  };
})();
