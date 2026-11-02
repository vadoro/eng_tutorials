/* 관계대명사 튜토리얼 — 규칙 엔진과 예문
 *
 * 영상의 설명, '직접 해 보기', 놀이터, 연습 문제, 퀴즈가 모두 이 파일의 judge()로 정답을 정합니다.
 * 문제 데이터에 적은 정답이 judge()의 결과와 다르면 콘솔에 경고를 냅니다(설명과 정답이 어긋나지 않게).
 *
 * 빈칸의 상황(d)
 *   ante  : 'person' 사람 | 'thing' 사물·동물 | 'none' 선행사 없음
 *   gap   : 'subj' 주어가 빠짐 | 'obj' 목적어가 빠짐 | 'poss' 관사 없는 명사 앞(소유격) | 'none' 빠진 것 없음(완전한 문장)
 *   comma : 빈칸 앞에 콤마가 있음 (계속적 용법)
 *   prep  : 빈칸 바로 앞이 전치사
 *   place : 선행사가 장소 (관계부사 where를 구별할 때만)
 *
 * judge(p, d) → { s: 'ok' | 'warn' | 'no', why }
 *   warn은 '회화에서는 쓰지만 시험 답으로는 고르지 않는' 경우(목적어 자리의 who).
 */
(function () {
  'use strict';
  const RP = (window.RP = {});

  const GAPNAME = { subj: '주어', obj: '목적어', poss: '소유격', none: '없음' };
  const ANTENAME = { person: '사람', thing: '사물', none: '없음' };
  RP.GAPNAME = GAPNAME; RP.ANTENAME = ANTENAME;
  // 놀이터·판별기에서 견줘 보는 후보. '∅'은 관계대명사를 생략한 경우
  RP.CANDS = ['who', 'whom', 'which', 'that', 'whose', 'what', '∅'];

  const ok = why => ({ s: 'ok', why }), no = why => ({ s: 'no', why }), warn = why => ({ s: 'warn', why });

  RP.judge = function (p, d) {
    const { ante, gap, comma, prep, place } = d;
    const gn = GAPNAME[gap];
    // 1. 선행사가 없으면 what만
    if (p === 'what') {
      if (ante !== 'none') return no('앞에 꾸밀 명사(선행사)가 있어요. what은 선행사를 이미 품고 있어서 명사 뒤에 못 와요.');
      if (gap === 'none') return no('뒤 문장에 빠진 자리가 없어요. what 뒤에는 주어나 목적어가 빠진 문장이 와요.');
      if (gap === 'poss') return no('관사 없는 명사 앞, 소유격 자리예요. what은 소유격이 아니에요.');
      if (comma || prep) return no('what은 콤마나 전치사 뒤에서 앞 명사를 꾸미지 않아요.');
      return ok(`선행사가 없고 뒤에 ${gn}가 빠졌어요 → what(= the thing which, ~하는 것).`);
    }
    if (ante === 'none') return no('꾸밀 선행사(명사)가 없어요. 선행사 없이 쓰는 관계대명사는 what뿐이에요.');
    // 2. 관계부사 where: 뒤 문장이 완전해야 함
    if (p === 'where') {
      if (gap !== 'none') return no(`where는 관계부사라 뒤에 완전한 문장이 와요. 여기는 ${gn} 자리가 빠져 있어요.`);
      if (!place) return no('선행사가 장소가 아니에요.');
      return ok('선행사가 장소이고 뒤 문장이 완전해요 → 관계부사 where.');
    }
    if (gap === 'none') return no('뒤 문장에 빠진 자리가 없어요(완전한 문장). 관계대명사는 쓸 수 없어요 → 관계부사 자리.');
    // 3. 소유격
    if (gap === 'poss') {
      if (p === 'whose') return ok('빈칸 뒤에 관사 없는 명사가 오고 나머지가 완전해요 → 그 명사의 주인을 나타내는 소유격 whose.');
      if (p === '∅') return no('소유격은 생략할 수 없어요.');
      return no('빈칸 뒤 명사가 관사 없이 와요. 그 명사의 주인을 나타내는 소유격 whose 자리예요.');
    }
    if (p === 'whose') return no(`whose 뒤에는 관사 없는 명사가 와야 해요. 여기는 ${gn} 자리가 빠졌어요.`);
    // 4. 주격·목적격
    if (p === 'who') {
      if (ante === 'thing') return no('선행사가 사물이에요. who는 사람에만 써요.');
      if (prep) return no('전치사 바로 뒤에는 who가 아니라 목적격 whom을 써요.');
      if (gap === 'obj') return warn('목적어 자리예요. 회화에서는 who도 쓰지만, 시험에서는 목적격 whom이 정답이에요.');
      return ok('선행사가 사람이고 빈칸 바로 뒤에 동사 → 주격 who.');
    }
    if (p === 'whom') {
      if (ante === 'thing') return no('선행사가 사물이에요. whom은 사람에만 써요.');
      if (gap === 'subj') return no('빈칸 바로 뒤에 동사가 와요. 주어 자리라 목적격 whom은 못 써요.');
      return ok(prep ? '선행사가 사람이고 전치사의 목적어 자리 → whom.' : '선행사가 사람이고 목적어가 빠졌어요 → 목적격 whom.');
    }
    if (p === 'which') {
      if (ante === 'person') return no('선행사가 사람이에요. which는 사물·동물에 써요.');
      return ok(`선행사가 사물이고 ${gn}가 빠졌어요 → ${gap === 'subj' ? '주격' : '목적격'} which.`);
    }
    if (p === 'that') {
      if (comma) return no('콤마 뒤(계속적 용법)에는 that을 쓸 수 없어요.');
      if (prep) return no('전치사 바로 뒤에는 that을 쓸 수 없어요.');
      return ok(`that은 사람·사물 모두, ${gap === 'subj' ? '주격' : '목적격'}으로 쓸 수 있어요.`);
    }
    if (p === '∅') {
      if (gap === 'subj') return no('주격 관계대명사는 생략할 수 없어요.');
      if (comma) return no('콤마 뒤(계속적 용법)에서는 생략할 수 없어요.');
      if (prep) return no('전치사 바로 뒤에서는 생략할 수 없어요. 전치사를 문장 끝으로 보내면 생략할 수 있어요.');
      return ok('목적격 관계대명사는 생략할 수 있어요. 명사 바로 뒤에 주어 + 동사가 이어져요.');
    }
    return no('관계대명사가 아니에요.');
  };
  RP.valid = (d, cands = RP.CANDS) => cands.filter(p => RP.judge(p, d).s === 'ok');

  /* ---------- 3단계 풀이법: 상황 d와 문장 속 단서로 풀이 문장을 만듦 ---------- */
  // c = { ante: '선행사 글자', cue: '빈칸 뒤 단서 글자', trap: '콤마/전치사 글자' }
  RP.steps = function (d, c, opts) {
    const left = opts ? opts.filter(p => RP.judge(p.toLowerCase(), d).s === 'ok') : RP.valid(d);
    const s1 = d.ante === 'none'
      ? { head: '① 앞을 봐요.', text: '빈칸 앞에 꾸밀 명사가 없어요 → 선행사 없음. 선행사를 품은 what이 후보예요.', marks: [] }
      : { head: '① 앞을 봐요.', text: `빈칸 앞 명사 ‘${c.ante}’ → ${d.ante === 'person' ? '사람. who, whom, whose, that이 후보예요.' : '사물. which, whose, that이 후보예요.' + (d.place ? ' 장소라서 관계부사 where도 후보.' : '')}`, marks: [{ t: c.ante, role: 'ante' }] };
    const s2txt = {
      subj: `빈칸 바로 뒤가 동사 ‘${c.cue}’ → 주어가 빠졌어요 → 주격.`,
      obj: `빈칸 뒤 ‘${c.cue}’ 다음에 목적어가 없어요 → 목적어가 빠졌어요 → 목적격.`,
      poss: `빈칸 뒤에 관사 없는 명사 ‘${c.cue}’, 나머지는 완전한 문장 → 소유격 whose.`,
      none: `빈칸 뒤 ‘${c.cue}’는 빠진 것 없는 완전한 문장 → 관계대명사가 아니라 관계부사 자리.`,
    }[d.gap];
    const s2 = { head: '② 뒤를 봐요.', text: s2txt, marks: [{ t: c.cue, role: 'cue' }] };
    const traps = [];
    if (d.comma) traps.push('빈칸 앞에 콤마가 있어 that은 안 돼요');
    if (d.prep) traps.push(`빈칸 앞이 전치사 ‘${c.trap}’라서 that·who는 안 돼요`);
    const names = left.map(p => p === '∅' ? '생략' : p);
    const s3 = { head: '③ 함정을 봐요.', text: (traps.length ? traps.join('. ') + '. ' : '콤마도 전치사도 없어요. ') + `쓸 수 있는 말은 ${names.join(', ') || '없음'}.`, marks: c.trap ? [{ t: c.trap, role: 'trap' }] : [] };
    return [s1, s2, s3];
  };

  /* ---------- 두 문장 합치기 예문 (영상 장면과 놀이터가 함께 씀) ----------
   * A: 꾸밈을 받을 문장 (토큰 배열). ante: A에서 선행사 토큰 번호
   * B: 관계사절이 될 문장. share: B에서 선행사와 같은 대상을 가리키는 토큰 번호. prep: 그 앞 전치사 토큰 번호(있으면)
   * kind: 'person' | 'thing',  gap: 'subj' | 'obj' | 'poss'
   * 소유격(poss)은 share 토큰(Its, Her)이 whose로 바뀌고 빈자리가 생기지 않음
   */
  RP.PAIRS = [
    { id: 'chef', name: '요리사 (사람 · 주어)', kind: 'person', gap: 'subj',
      A: ['I', 'know', 'a chef', '.'], ante: 2, B: ['She', 'cooks', 'Korean food', '.'], share: 0,
      ko: '나는 한국 음식을 요리하는 요리사를 알아요.' },
    { id: 'printer', name: '프린터 (사물 · 주어)', kind: 'thing', gap: 'subj',
      A: ['This', 'is', 'the printer', '.'], ante: 2, B: ['It', 'copies', '50 pages', 'a minute', '.'], share: 0,
      ko: '이것이 1분에 50장을 복사하는 프린터예요.' },
    { id: 'candidate', name: '지원자 (사람 · 목적어)', kind: 'person', gap: 'obj',
      A: ['The candidate', 'has', 'accepted', 'the offer', '.'], ante: 0, B: ['We', 'interviewed', 'him', 'yesterday', '.'], share: 2,
      ko: '우리가 어제 면접 본 지원자가 제안을 받아들였어요.' },
    { id: 'report', name: '보고서 (사물 · 목적어)', kind: 'thing', gap: 'obj', keep: true,
      A: ['The report', 'was', 'approved', '.'], ante: 0, B: ['Mina', 'wrote', 'it', '.'], share: 2,
      ko: '미나가 쓴 보고서가 승인되었어요.' },
    { id: 'company', name: '회사 (사물 · 소유격)', kind: 'thing', gap: 'poss',
      A: ['We', 'work', 'with', 'a company', '.'], ante: 3, B: ['Its', 'profits', 'doubled', 'last year', '.'], share: 0,
      ko: '우리는 작년에 수익이 두 배가 된 회사와 일해요.' },
    { id: 'applicant', name: '지원자 (사람 · 소유격)', kind: 'person', gap: 'poss',
      A: ['The applicant', 'will', 'be', 'hired', '.'], ante: 0, B: ['Her', 'résumé', 'impressed', 'everyone', '.'], share: 0,
      ko: '이력서로 모두를 감동시킨 지원자가 채용될 거예요.' },
    { id: 'agency', name: '대행사 (사물 · 전치사)', kind: 'thing', gap: 'obj',
      A: ['The agency', 'has', 'moved', 'its office', '.'], ante: 0, B: ['We', 'signed', 'the contract', 'with', 'it', '.'], share: 4, prep: 3,
      ko: '우리가 계약을 맺은 대행사가 사무실을 옮겼어요.' },
    { id: 'client', name: '고객 (사람 · 전치사)', kind: 'person', gap: 'obj',
      A: ['The client', 'is', 'from', 'Busan', '.'], ante: 0, B: ['I', 'spoke', 'with', 'her', '.'], share: 3, prep: 2,
      ko: '내가 이야기를 나눈 고객은 부산 출신이에요.' },
    { id: 'office', name: '사무실 (사물 · 콤마)', kind: 'thing', gap: 'subj', comma: true,
      A: ['Our new office', 'is', 'very', 'quiet', '.'], ante: 0, B: ['It', 'is', 'on the fifth floor', '.'], share: 0,
      ko: '우리 새 사무실은 5층에 있는데, 아주 조용해요.' },
  ];
  RP.pair = id => RP.PAIRS.find(p => p.id === id);
  // 관계대명사 바꾸기에 쓰는 기본 답 (사람/사물 × 격)
  RP.base = (kind, gap, prepFront) => gap === 'poss' ? 'whose' : kind === 'person' ? (gap === 'subj' ? 'who' : 'whom') : 'which';
  RP.situation = (pr, o = {}) => ({ ante: pr.kind, gap: pr.gap, comma: o.comma != null ? !!o.comma : !!pr.comma, prep: pr.prep != null && (o.prepFront != null ? !!o.prepFront : true) });

  /* 합친 문장 만들기 → 토큰 [{ id, t, r }]
   *   o.rel: 넣을 관계대명사 ('∅'이면 생략), o.comma: 콤마로 감쌈, o.prepFront: 전치사를 관계대명사 앞으로
   *   id는 원래 문장의 토큰 번호(a0…, b0…)를 따라가서, 장면에서 두 문장 → 한 문장으로 자연스럽게 움직일 수 있음
   *   r(역할): ante 선행사 · rel 관계대명사 · gap 빈자리 · prep 전치사 · noun 관사 없는 명사 · clause 관계사절 안 · '' 나머지
   */
  RP.combine = function (pr, o = {}) {
    const rel = o.rel || RP.base(pr.kind, pr.gap), comma = o.comma != null ? o.comma : !!pr.comma, prepFront = o.prepFront != null ? o.prepFront : true;
    const A = pr.A.map((t, i) => ({ id: 'a' + i, t, r: i === pr.ante ? 'ante' : '' }));
    const out = A.slice(0, pr.ante + 1);
    if (comma) out.push({ id: 'c1', t: ',', r: '' });
    const B = pr.B.slice(0, -1);                    // 마침표 빼기
    const clause = [];
    const hasPrep = pr.prep != null;
    if (hasPrep && prepFront) clause.push({ id: 'b' + pr.prep, t: pr.B[pr.prep], r: 'prep' });
    if (rel !== '∅') clause.push({ id: 'b' + pr.share, t: rel, r: 'rel' });
    B.forEach((t, i) => {
      // 따로 쓴 문장의 첫 글자는 대문자 → 절 안에서는 소문자 (I와 이름은 그대로)
      if (i === 0 && t !== 'I' && !pr.keep) t = t.charAt(0).toLowerCase() + t.slice(1);
      if (i === pr.share) {
        if (pr.gap === 'subj' || pr.gap === 'obj') clause.push({ id: 'gap', t: '', r: 'gap' });
        return;
      }
      if (hasPrep && i === pr.prep) { if (!prepFront) clause.push({ id: 'b' + i, t, r: 'prep' }); return; }
      clause.push({ id: 'b' + i, t, r: pr.gap === 'poss' && i === pr.share + 1 ? 'noun' : 'clause' });
    });
    // 주격: 빈자리는 관계대명사 바로 뒤(원래 주어 자리). 위 반복이 이미 그 자리에 둠
    clause.forEach(tk => { tk.cl = true; });
    out.push(...clause);
    const rest = A.slice(pr.ante + 1);
    const tail = rest.slice(0, -1), dot = rest[rest.length - 1];
    if (comma && tail.length) out.push({ id: 'c2', t: ',', r: '' });
    out.push(...tail, dot);
    return out;
  };
  RP.text = toks => toks.filter(t => t.r !== 'gap').map(t => t.t).join(' ').replace(/ ([.,?!])/g, '$1');
  RP.sentence = arr => arr.join(' ').replace(/ ([.,?!])/g, '$1');

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * d: 빈칸의 상황, c: 문장 속 단서(선행사·빈칸 뒤 단서·함정 글자)
   * type 'agree'는 관계대명사 뒤 동사의 수 일치 문제 (num: 'sg' 단수 | 'pl' 복수)
   */
  RP.DRILL = [
    { q: 'The manager ___ oversees the project will retire next month.', opts: ['who', 'whom', 'whose', 'what'], a: 0,
      d: { ante: 'person', gap: 'subj' }, c: { ante: 'The manager', cue: 'oversees' }, tag: '주격 · 사람', ko: '그 프로젝트를 감독하는 매니저는 다음 달에 은퇴해요.' },
    { q: 'Ms. Kim is the consultant ___ the board hired to review the budget.', opts: ['whose', 'what', 'whom', 'which'], a: 2,
      d: { ante: 'person', gap: 'obj' }, c: { ante: 'the consultant', cue: 'the board hired' }, tag: '목적격 · 사람', ko: '김 씨는 이사회가 예산 검토를 위해 고용한 컨설턴트예요.' },
    { q: 'Applicants ___ résumés are incomplete will not be considered.', opts: ['who', 'whose', 'which', 'whom'], a: 1,
      d: { ante: 'person', gap: 'poss' }, c: { ante: 'Applicants', cue: 'résumés' }, tag: '소유격', ko: '이력서가 완전하지 않은 지원자는 고려되지 않아요.' },
    { q: 'The printer ___ is located on the third floor is out of order.', opts: ['who', 'what', 'whose', 'which'], a: 3,
      d: { ante: 'thing', gap: 'subj' }, c: { ante: 'The printer', cue: 'is located' }, tag: '주격 · 사물', ko: '3층에 있는 프린터가 고장 났어요.' },
    { q: '___ the client requested was a detailed cost estimate.', opts: ['What', 'That', 'Which', 'Whose'], a: 0,
      d: { ante: 'none', gap: 'obj' }, c: { ante: '', cue: 'the client requested' }, tag: 'what · 선행사 없음', ko: '고객이 요청한 것은 자세한 비용 견적서였어요.' },
    { q: 'The hotel, ___ was renovated last spring, now offers free parking.', opts: ['that', 'which', 'where', 'what'], a: 1,
      d: { ante: 'thing', gap: 'subj', comma: true, place: true }, c: { ante: 'The hotel', cue: 'was renovated', trap: ',' }, tag: '콤마 뒤 · that 불가', ko: '그 호텔은 지난봄에 개조되었는데, 이제 무료 주차를 제공해요.' },
    { q: 'The agency with ___ we signed the contract has moved its headquarters.', opts: ['that', 'whom', 'which', 'what'], a: 2,
      d: { ante: 'thing', gap: 'obj', prep: true }, c: { ante: 'The agency', cue: 'we signed the contract', trap: 'with' }, tag: '전치사 + 관계대명사', ko: '우리가 계약을 맺은 대행사가 본사를 옮겼어요.' },
    { q: 'Employees who ___ the safety workshop will receive a certificate.', opts: ['attends', 'attend', 'attending', 'to attend'], a: 1,
      type: 'agree', num: 'pl', c: { ante: 'Employees', cue: 'who' }, tag: '수 일치 · 복수', ko: '안전 교육에 참석하는 직원들은 수료증을 받아요.' },
    { q: 'The museum ___ we visited during the conference was designed by a famous architect.', opts: ['where', 'what', 'who', 'which'], a: 3,
      d: { ante: 'thing', gap: 'obj', place: true }, c: { ante: 'The museum', cue: 'we visited' }, tag: '관계대명사 vs 관계부사', ko: '우리가 학회 기간에 방문한 박물관은 유명한 건축가가 설계했어요.' },
    { q: 'Dr. Patel, ___ research focuses on renewable energy, will give the keynote speech.', opts: ['who', 'whom', 'whose', 'which'], a: 2,
      d: { ante: 'person', gap: 'poss', comma: true }, c: { ante: 'Dr. Patel', cue: 'research', trap: ',' }, tag: '소유격 · 콤마', ko: '파텔 박사는 재생 에너지를 연구하는데, 기조연설을 할 거예요.' },
    { q: 'The city ___ the conference will be held has an excellent subway system.', opts: ['which', 'where', 'what', 'whose'], a: 1,
      d: { ante: 'thing', gap: 'none', place: true }, c: { ante: 'The city', cue: 'the conference will be held' }, tag: '완전한 문장 → 관계부사', ko: '학회가 열릴 도시는 지하철이 훌륭해요.' },
    { q: 'Please return the forms ___ you received at the orientation.', opts: ['who', 'what', 'whose', 'that'], a: 3,
      d: { ante: 'thing', gap: 'obj' }, c: { ante: 'the forms', cue: 'you received' }, tag: '목적격 · that', ko: '오리엔테이션에서 받은 서류를 돌려주세요.' },
    { q: 'The manager who ___ the hiring process has requested two more assistants.', opts: ['oversee', 'overseeing', 'oversees', 'have overseen'], a: 2,
      type: 'agree', num: 'sg', c: { ante: 'The manager', cue: 'who' }, tag: '수 일치 · 단수', ko: '채용 과정을 감독하는 매니저가 보조 직원 두 명을 더 요청했어요.' },
    { q: 'Those ___ wish to attend the seminar must register by Friday.', opts: ['who', 'which', 'whom', 'whose'], a: 0,
      d: { ante: 'person', gap: 'subj' }, c: { ante: 'Those', cue: 'wish' }, tag: 'those who', ko: '세미나에 참석하고 싶은 사람은 금요일까지 등록해야 해요.' },
    { q: 'The candidate ___ we interviewed yesterday has accepted the offer.', opts: ['which', 'whose', 'what', 'whom'], a: 3,
      d: { ante: 'person', gap: 'obj' }, c: { ante: 'The candidate', cue: 'we interviewed' }, tag: '목적격 · 사람', ko: '우리가 어제 면접 본 지원자가 제안을 받아들였어요.' },
    { q: 'The new software includes several features ___ users have requested for months.', opts: ['which', 'who', 'what', 'whose'], a: 0,
      d: { ante: 'thing', gap: 'obj' }, c: { ante: 'several features', cue: 'users have requested' }, tag: '목적격 · 사물', ko: '새 소프트웨어에는 사용자들이 몇 달 동안 요청해 온 기능이 여럿 들어 있어요.' },
  ];

  // 수 일치 문제: 보기마다 까닭
  const AGREE_NOTE = {
    sg: (o, ante) => /s$/.test(o) && !/ing$/.test(o) && !/^(have|to )/.test(o) ? `선행사 ‘${ante}’ = 단수 → 단수 동사.` : /ing$/.test(o) ? '관계사절에도 진짜 동사가 있어야 해요. -ing만으로는 동사가 안 돼요.' : /^to /.test(o) ? 'to 부정사는 동사 자리에 못 와요.' : `선행사 ‘${ante}’ = 단수 → 복수 동사는 안 돼요.`,
    pl: (o, ante) => /ing$/.test(o) ? '관계사절에도 진짜 동사가 있어야 해요. -ing만으로는 동사가 안 돼요.' : /^to /.test(o) ? 'to 부정사는 동사 자리에 못 와요.' : /s$/.test(o) ? `선행사 ‘${ante}’ = 복수 → -s 붙은 단수 동사는 안 돼요.` : `선행사 ‘${ante}’ = 복수 → 복수 동사.`,
  };

  // 연습 문제를 공통 부품(EN.drill) 형식으로: 단계(힌트)와 보기별 까닭을 규칙 엔진으로 만듦
  RP.drillItems = function () {
    return RP.DRILL.map((it, n) => {
      if (it.type === 'agree') {
        const ante = it.c.ante;
        const steps = [
          { head: '① 보기를 봐요.', text: '보기가 모두 같은 동사의 여러 모양이에요 → 동사 자리, 수 일치 문제예요.', marks: [] },
          { head: '② 앞을 봐요.', text: `빈칸 앞 who = 선행사 ‘${ante}’. 동사의 수는 who가 아니라 선행사에 맞춰요.`, marks: [{ t: ante, role: 'ante' }, { t: it.c.cue, role: 'cue' }] },
          { head: '③ 수를 맞춰요.', text: it.num === 'sg' ? `‘${ante}’ = 한 사람(단수) → -s가 붙은 단수 동사 ${it.opts[it.a]}.` : `‘${ante}’ = 여러 사람(복수) → -s 없는 복수 동사 ${it.opts[it.a]}.`, marks: [] },
        ];
        const notes = it.opts.map(o => AGREE_NOTE[it.num](o, ante));
        return { q: it.q, opts: it.opts, a: it.a, ko: it.ko, tag: it.tag, steps, notes };
      }
      const steps = RP.steps(it.d, it.c, it.opts);
      const notes = it.opts.map(o => {
        const j = RP.judge(o.toLowerCase(), it.d);
        return (j.s === 'ok' ? '' : j.s === 'warn' ? '△ ' : '× ') + j.why;
      });
      return { q: it.q, opts: it.opts, a: it.a, ko: it.ko, tag: it.tag, steps, notes };
    });
  };

  // 데이터 점검: 연습 문제의 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, 정답 위치가 고르게 섞였는지
  RP.check = function () {
    const bad = [];
    RP.DRILL.forEach((it, i) => {
      if (it.type === 'agree') return;
      const good = it.opts.map((o, k) => RP.judge(o.toLowerCase(), it.d).s === 'ok' ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`연습 문제 ${i + 1}: 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      if (!it.q.includes(it.c.cue) || (it.c.ante && !it.q.includes(it.c.ante))) bad.push(`연습 문제 ${i + 1}: 단서 글자가 문장에 없어요`);
    });
    const pos = [0, 0, 0, 0]; RP.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 2) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    RP.PAIRS.forEach(pr => {
      const d = RP.situation(pr, { comma: !!pr.comma });
      if (RP.judge(RP.base(pr.kind, pr.gap), d).s !== 'ok') bad.push(`예문 ${pr.id}: 기본 관계대명사가 규칙 엔진과 달라요`);
    });
    bad.forEach(b => console.warn('[관계대명사] ' + b));
    return bad;
  };
})();
