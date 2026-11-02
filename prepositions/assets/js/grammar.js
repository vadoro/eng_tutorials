/* 전치사 튜토리얼 — 규칙 엔진과 예문
 *
 * 전치사 빈칸 문제의 보기는 대개 전치사 넷이에요(by · until · during · among).
 * 답은 3단계로 정합니다.
 *   ① 무엇을 나타내나 — 시간 · 장소 · 뜻을 더하는 말(자격 · 숫자 · 경로 · 단위) · 앞 낱말의 짝(짝 표현)
 *   ② 뒤의 명사 — 시각 · 날 · 큰 칸 · 숫자 길이 · 사건 · 지점 · 면 · 공간 · 둘 · 무리 · 숫자 · 자격 …
 *   ③ 그림 — 그때까지 끝나나(by) 이어지나(until), 내내(for) · 그 안에(within) · 그만큼 뒤(in), 차이(by) · 도착점(to) …
 *      짝 표현은 그림 대신 짝 카드(responsible for · comply with · increase in)
 * 영상의 ✓·×, 직접 해 보기, 놀이터(까지 갈림길 · 짝 카드), 연습 문제, 퀴즈가 모두 PR.judge()로 맞고 틀림을 정하고,
 * 문제 데이터에 적은 정답이 judge()와 다르면 콘솔에 경고를 냅니다.
 *
 * 빈칸 자리의 뜻(cls · noun · pic)은 문제마다 데이터에 적어 둡니다. 규칙 엔진은 문장의 뜻을 스스로 알아내지 않아요.
 * 전치사 사전(PR.P)에는 이 튜토리얼에서 가르치는 뜻만 들어 있어요(by the window의 ‘옆’, by e-mail의 ‘수단’ 같은 뜻은 없음).
 * judge(전치사, ctx) → { s: 'ok' | 'no', step: 0 | 1 | 2 | 3, why }   step = 3단계 풀이법의 몇 단계에서 지워지는지
 *   ctx = { cls, noun: 명사 종류(하나 또는 여럿), pic: 그림, nounText: 빈칸 뒤 명사(문장 속 글자), why3: 그림의 까닭, head: 짝 표현의 앞 낱말 }
 */
(function () {
  'use strict';
  const PR = (window.PR = {});

  /* ---------- 한국어 조사 고르기 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const ig = s => s + (has(s) ? '이' : '가'), eul = s => s + (has(s) ? '을' : '를'), iye = s => s + (has(s) ? '이에요' : '예요');
  PR.josa = { ig, eul, iye };

  /* ---------- ① 무엇을 나타내나 ---------- */
  PR.CLS = {
    time:  { name: '시간', what: '때를 나타내요', box: 0 },
    place: { name: '장소', what: '곳 · 방향을 나타내요', box: 1 },
    extra: { name: '뜻을 더하는 말', what: '자격 · 숫자 · 경로 · 단위처럼 뜻을 더해요', box: 2 },
    pair:  { name: '짝 표현', what: '앞 낱말이 전치사를 골라요', box: 3 },
  };
  /* ---------- ② 뒤의 명사 ---------- */
  PR.NOUN = {
    clock:   { cls: ['time'], name: '시각', ex: '3 p.m. · noon' },
    day:     { cls: ['time'], name: '날 · 날짜 · 요일', ex: 'Monday · May 5' },
    month:   { cls: ['time'], name: '달 · 해 · 계절 같은 큰 칸', ex: 'May · 2027 · the morning' },
    point:   { cls: ['time'], name: '때를 가리키는 말', ex: 'the end of the month' },
    length:  { cls: ['time'], name: '숫자로 잰 길이', ex: 'three hours · 30 days' },
    event:   { cls: ['time'], name: '사건 · 행사', ex: 'the meeting · the flight' },
    spot:    { cls: ['place'], name: '한 지점', ex: 'the front desk · the airport' },
    surface: { cls: ['place'], name: '면 · 층', ex: 'the wall · the third floor' },
    area:    { cls: ['place'], name: '둘러싸인 공간 · 지역', ex: 'the lobby · Seoul' },
    two:     { cls: ['place', 'time'], name: '둘 (A and B)', ex: 'the bank and the café' },
    group:   { cls: ['place'], name: '셋 이상의 무리', ex: 'the staff · the members' },
    line:    { cls: ['place'], name: '길 · 강 같은 줄', ex: 'the river · Main Street' },
    limit:   { cls: ['place'], name: '경계', ex: 'the gate · the border' },
    range:   { cls: ['place'], name: '거리 · 범위', ex: 'walking distance' },
    role:    { cls: ['extra'], name: '자격 · 직책', ex: 'a consultant' },
    number:  { cls: ['extra', 'pair'], name: '숫자 · 양', ex: '20 percent · 3 million dollars' },
    route:   { cls: ['extra'], name: '경로 · 통로', ex: 'e-mail · our website' },
    unit:    { cls: ['extra'], name: '단위 하나', ex: 'person · night' },
    action:  { cls: ['extra'], name: '동작을 나타내는 명사', ex: 'arrival · request' },
    thing:   { cls: ['pair'], name: '숫자가 아닌 명사', ex: 'sales · the budget' },
  };
  /* ---------- ③ 그림 ---------- */
  PR.PIC = {
    at:       { name: '그때 · 그곳에' },
    end:      { name: '늦어도 그때까지 끝냄 (마감)' },
    continue: { name: '그때까지 쭉 이어짐' },
    from:     { name: '과거의 그때부터 지금까지' },
    span:     { name: '그 기간 동안' },
    inside:   { name: '그 길이 · 범위 안에서' },
    later:    { name: '지금부터 그만큼 뒤' },
    mid:      { name: '사이 · 가운데' },
    along:    { name: '길을 따라' },
    across:   { name: '건너서 · 가로질러' },
    whole:    { name: '곳곳에 · 처음부터 끝까지' },
    beyond:   { name: '경계를 넘어서' },
    toward:   { name: '그곳으로' },
    role:     { name: '그 자격으로' },
    diff:     { name: '늘거나 준 차이' },
    final:    { name: '다다른 도착점' },
    route:    { name: '그것을 거쳐' },
    each:     { name: '하나마다' },
    upon:     { name: '그 일이 있자마자' },
  };
  // 전치사·자리에 맞춘 그림 이름 (같은 span이라도 for는 ‘길이 내내’, during은 ‘사건이 이어지는 동안’)
  PR.picName = function (pic, cls, nouns) {
    nouns = [].concat(nouns || []);
    if (pic === 'at') return cls === 'place' ? '그곳에 있음' : '그때에 일어남';
    if (pic === 'span') return nouns.includes('event') && !nouns.includes('length') ? '그 사건이 이어지는 동안' : '그 길이 내내';
    if (pic === 'inside') return cls === 'place' ? '그 범위 안에' : '그 길이 안의 한때';
    if (pic === 'mid') return nouns.includes('group') && !nouns.includes('two') ? '무리 가운데' : '둘 사이에';
    if (pic === 'whole') return cls === 'time' ? '처음부터 끝까지 내내' : '곳곳에 (전체)';
    return PR.PIC[pic].name;
  };

  /* ---------- 전치사 사전: 뜻마다 [무엇, 뒤의 명사들, 그림, 명사 이름(선택)] ---------- */
  const POINT = ['clock', 'day', 'month', 'point', 'event'];
  PR.POINT = POINT;
  PR.P = {
    at:         { ko: '~에 (시각 · 한 지점)', s: [['time', ['clock'], 'at'], ['place', ['spot'], 'at']] },
    on:         { ko: '~에 (날 · 면 · 층)', s: [['time', ['day'], 'at'], ['place', ['surface', 'line'], 'at']] },
    in:         { ko: '~에 (큰 칸 · 공간) · ~ 뒤에', s: [['time', ['month'], 'at'], ['time', ['length'], 'later'], ['place', ['area'], 'at']] },
    by:         { ko: '~까지 (마감) · ~만큼 (차이)', s: [['time', POINT, 'end', '한 시점 (그때)'], ['extra', ['number'], 'diff']] },
    until:      { ko: '~까지 (쭉)', s: [['time', POINT, 'continue', '한 시점 (그때)']] },
    since:      { ko: '~부터 (지금까지)', s: [['time', POINT, 'from', '과거의 한 시점']] },
    for:        { ko: '~ 동안 (숫자 길이)', s: [['time', ['length'], 'span']] },
    during:     { ko: '~ 동안 (사건)', s: [['time', ['event'], 'span']] },
    within:     { ko: '~ 안에', s: [['time', ['length'], 'inside'], ['place', ['range'], 'inside']] },
    throughout: { ko: '~ 내내 · 곳곳에', s: [['time', ['event', 'month'], 'whole'], ['place', ['area'], 'whole']] },
    between:    { ko: '(둘) 사이에', s: [['time', ['two'], 'mid'], ['place', ['two'], 'mid']] },
    among:      { ko: '(셋 이상) 가운데', s: [['place', ['group'], 'mid']] },
    along:      { ko: '~을 따라', s: [['place', ['line'], 'along']] },
    across:     { ko: '~을 건너 · 곳곳에', s: [['place', ['line'], 'across'], ['place', ['area'], 'whole']] },
    beyond:     { ko: '~을 넘어', s: [['place', ['limit'], 'beyond']] },
    as:         { ko: '~로서 (자격)', s: [['extra', ['role'], 'role']] },
    to:         { ko: '~까지 (도착점) · ~로', s: [['extra', ['number'], 'final'], ['place', ['spot', 'area'], 'toward']] },
    via:        { ko: '~을 거쳐', s: [['extra', ['route'], 'route']] },
    per:        { ko: '~마다', s: [['extra', ['unit'], 'each']] },
    upon:       { ko: '~하자마자', s: [['extra', ['action'], 'upon']] },
    with:       { ko: '~와 함께 · 짝 표현', s: [] },
    of:         { ko: '~의 · 짝 표현', s: [] },
    about:      { ko: '~에 관해', s: [] },
  };
  // 보기에 섞여 나오는 접속사 (뒤에 주어 + 동사가 와야 함 → T05)
  PR.CONJ = { while: '~하는 동안', although: '비록 ~이지만', when: '~할 때', because: '~ 때문에' };
  PR.isWord = w => !!(PR.P[w] || PR.CONJ[w]);

  /* ---------- 짝 카드: 앞 낱말 → 전치사 (규칙이 아니라 외워 두는 짝) ----------
   * num: 뒤에 숫자가 오면 바뀌는 짝 (an increase in sales · an increase of 10 percent)
   * q · qko · no: 놀이터 짝 카드의 문장, 해석, 틀린 보기 셋 · tip: 한국어에 끌려 틀리기 쉬운 점
   */
  PR.POS = { adj: '형용사', v: '동사', n: '명사' };
  PR.PAIRS = {
    responsible: { p: 'for', pos: 'adj', ko: '~을 맡은 · 책임지는', q: 'Ms. Kwon is responsible ___ the annual budget.', qko: '권 씨가 연간 예산을 맡고 있어요.', no: ['to', 'with', 'on'], tip: '‘~을 책임지다’의 ‘을’ 때문에 전치사를 빼기 쉬워요. 짝은 for.' },
    eligible:    { p: 'for', pos: 'adj', ko: '~을 받을 자격이 있는', q: 'Part-time staff are not eligible ___ the year-end bonus.', qko: '시간제 직원은 연말 보너스를 받을 수 없어요.', no: ['to', 'of', 'in'], tip: '명사 앞에서는 for. 뒤에 동사가 오면 eligible to + 동사원형이에요(T07).' },
    interested:  { p: 'in', pos: 'adj', ko: '~에 관심이 있는', q: 'Many clients are interested ___ our new service.', qko: '많은 고객이 새 서비스에 관심이 있어요.', no: ['for', 'about', 'at'], tip: '‘~에 대해’ 관심이라고 about을 고르기 쉬워요. 짝은 in.' },
    familiar:    { p: 'with', pos: 'adj', ko: '~을 잘 아는', q: 'Are you familiar ___ this accounting software?', qko: '이 회계 프로그램을 잘 아세요?', no: ['to', 'in', 'for'], tip: '사람이 주어면 with. 물건이 주어면 to → The name is familiar to me.' },
    aware:       { p: 'of', pos: 'adj', ko: '~을 알고 있는', q: 'Please be aware ___ the new parking rules.', qko: '새 주차 규칙을 꼭 알아 두세요.', no: ['with', 'for', 'in'], tip: '‘~을 알다’라서 전치사를 빼기 쉬워요. 짝은 of.' },
    access:      { p: 'to', pos: 'n', ko: '~을 쓸 수 있는 권한 · 길', q: 'All employees have access ___ the shared drive.', qko: '모든 직원이 공유 드라이브를 쓸 수 있어요.', no: ['for', 'in', 'at'], tip: '명사 access 뒤에는 to. 동사 access는 전치사 없이 → access the drive.' },
    demand:      { p: 'for', pos: 'n', ko: '~에 대한 수요', q: 'Demand ___ electric cars is growing quickly.', qko: '전기차 수요가 빠르게 늘고 있어요.', no: ['to', 'about', 'with'], tip: '‘~에 대한’을 about으로 옮기기 쉬워요. 수요는 for.' },
    increase:    { p: 'in', num: 'of', pos: 'n', ko: '~의 증가', q: 'We expect an increase ___ sales next quarter.', qko: '다음 분기에 매출이 늘 것으로 봐요.', no: ['of', 'on', 'to'], tip: '늘어난 것 앞에는 in → an increase in sales. 숫자 앞에는 of → an increase of 10 percent.' },
    decrease:    { p: 'in', num: 'of', pos: 'n', ko: '~의 감소', q: 'There was a decrease ___ costs last year.', qko: '지난해 비용이 줄었어요.', no: ['on', 'at', 'to'], tip: 'increase와 같아요. 준 것 앞에는 in, 숫자 앞에는 of.' },
    solution:    { p: 'to', pos: 'n', ko: '~의 해결책', q: 'We need a solution ___ this problem.', qko: '이 문제의 해결책이 필요해요.', no: ['in', 'at', 'with'], tip: '‘문제의’를 of로 옮기기 쉬워요. 문제의 해결책 → a solution to the problem.' },
    comply:      { p: 'with', pos: 'v', ko: '~을 따르다 · 지키다', q: 'All visitors must comply ___ the safety rules.', qko: '모든 방문객은 안전 규칙을 지켜야 해요.', no: ['to', 'on', 'at'], tip: '‘~을 따르다’라서 전치사를 빼거나 to를 넣기 쉬워요. 짝은 with.' },
    respond:     { p: 'to', pos: 'v', ko: '~에 답하다', q: 'Please respond ___ this e-mail by Friday.', qko: '금요일까지 이 이메일에 답해 주세요.', no: ['for', 'at', 'with'], tip: 'reply to도 to. answer는 전치사 없이 → answer the e-mail.' },
    depend:      { p: 'on', pos: 'v', ko: '~에 달려 있다', q: 'The delivery date depends ___ the weather.', qko: '배송 날짜는 날씨에 달려 있어요.', no: ['in', 'at', 'of'], tip: '‘~에’를 at · in으로 옮기면 틀려요. 짝은 on.' },
    consist:     { p: 'of', pos: 'v', ko: '~로 이루어지다', q: 'The committee consists ___ five members.', qko: '위원회는 다섯 명으로 이루어져 있어요.', no: ['with', 'to', 'by'], tip: '‘~로’를 with로 옮기기 쉬워요. 짝은 of.' },
    participate: { p: 'in', pos: 'v', ko: '~에 참여하다', q: 'Twenty companies will participate ___ the trade fair.', qko: '스무 개 회사가 무역 박람회에 참여해요.', no: ['to', 'with', 'for'], tip: 'take part in도 in. join은 전치사 없이 → join the fair.' },
  };
  Object.keys(PR.PAIRS).forEach(w => { PR.PAIRS[w].w = w; });
  PR.pairWant = c => { const P = PR.PAIRS[c.head]; return c.noun === 'number' && P.num ? P.num : P.p; };

  /* ---------- 판정 ---------- */
  const ok = why => ({ s: 'ok', step: 0, why }), no = (step, why) => ({ s: 'no', step, why });
  const uniq = a => [...new Set(a)];
  const clsOf = w => uniq((PR.P[w] ? PR.P[w].s : []).map(s => s[0]));
  const nounNames = senses => uniq(senses.map(s => s[3] || s[1].map(n => PR.NOUN[n].name).join(' · '))).join(' · ');
  PR.judge = function (w, c) {
    if (PR.CONJ[w]) return no(1, `${w} → 접속사(${PR.CONJ[w]})라서 뒤에 주어 + 동사가 와야 해요. 뒤가 명사(${c.nounText})라서 전치사 자리예요(T05).`);
    const D = PR.P[w];
    if (!D) return no(1, `${w} → 이 튜토리얼의 전치사 사전에 없는 말이에요.`);
    if (c.cls === 'pair') {
      const P = PR.PAIRS[c.head], want = PR.pairWant(c);
      if (w === want) return ok(`짝 카드 → ${c.head} ${want} (${P.ko}).` + (P.num ? (c.noun === 'number' ? ' 뒤가 숫자라서 of예요.' : ' 뒤가 숫자가 아니라서 in이에요.') : ''));
      if (P.num && (w === P.p || w === P.num)) return no(2, c.noun === 'number'
        ? `뒤가 숫자(${c.nounText}) → ${c.head} of. ${c.head} in 뒤에는 늘거나 준 것이 와요.`
        : `뒤가 숫자가 아니라 늘거나 준 것(${c.nounText}) → ${c.head} in. ${c.head} of 뒤에는 숫자가 와요.`);
      return no(3, `짝 카드 → ${c.head} ${want}. ${w} → ${c.head}의 짝이 아니에요.`);
    }
    const S1 = D.s.filter(s => s[0] === c.cls);
    if (!S1.length) {
      const cl = clsOf(w);
      return no(1, `${w} → ${cl.length ? cl.map(k => PR.CLS[k].name).join(' · ') + '에 쓰는 말이에요' : '시간 · 장소 · 숫자를 나타내지 않아요(짝 표현에 쓰여요)'}. 여기는 ${PR.CLS[c.cls].name} 자리예요.`);
    }
    const nouns = [].concat(c.noun);
    const S2 = S1.filter(s => s[1].some(n => nouns.includes(n)));
    if (!S2.length) return no(2, `${w} 뒤에는 ${ig(nounNames(S1))} 와요. ${c.nounText} → ${iye(PR.NOUN[nouns[0]].name)}.`);
    const S3 = S2.filter(s => s[2] === c.pic);
    const here = PR.picName(c.pic, c.cls, nouns);
    if (!S3.length) return no(3, `${w} → ${PR.picName(S2[0][2], c.cls, nouns)}. 여기는 ${here}${c.why3 ? ' → ' + c.why3 : ''}.`);
    return ok(`${w} + ${S3[0][3] || PR.NOUN[nouns.find(n => S3[0][1].includes(n))].name} → ${here}.` + (c.why3 ? ` ${c.why3}.` : ''));
  };

  /* ---------- 3단계 판정기 (영상 09장 · 직접 해 보기): 무엇 · 뒤의 명사 · 그림 → 알맞은 전치사 ---------- */
  PR.nounsOf = cls => Object.keys(PR.NOUN).filter(n => PR.NOUN[n].cls.includes(cls) && cls !== 'pair');
  PR.picsOf = (cls, noun) => uniq(Object.values(PR.P).flatMap(D => D.s.filter(s => s[0] === cls && s[1].includes(noun)).map(s => s[2])));
  PR.decide = function (cls, noun, pic) {
    if (cls === 'pair') {
      const P = PR.PAIRS[noun];
      return P ? { ok: true, preps: [P.p], text: `${noun} ${P.p}`, why: `짝 카드 → ${noun} ${P.p} (${P.ko}). 그림이 아니라 외워 두는 짝이에요.` } : { ok: false, why: '앞 낱말을 고르세요.' };
    }
    const preps = Object.keys(PR.P).filter(w => PR.P[w].s.some(s => s[0] === cls && s[1].includes(noun) && s[2] === pic));
    if (!preps.length) return { ok: false, why: `${PR.NOUN[noun].name} 뒤에서 ‘${PR.picName(pic, cls, noun)}’ 그림을 그리는 전치사는 없어요.` };
    return { ok: true, preps, text: preps.join(' · '), why: `${PR.NOUN[noun].name} + ${PR.picName(pic, cls, noun)} → ${preps.join(' · ')}.` };
  };
  // 판정기 결과가 흐름도의 어느 상자를 지나는지 (②·③ 열의 상자 번호, 없으면 -1)
  PR.flow = function (cls, noun, pic) {
    const b1 = PR.CLS[cls].box;
    let b2 = -1, b3 = -1;
    if (cls === 'time') { if (pic === 'at') b2 = 0; else if (['end', 'continue', 'from'].includes(pic)) { b2 = 1; b3 = 0; } else { b2 = 2; b3 = 1; } }
    else if (cls === 'place') { b2 = 3; if (['along', 'across', 'whole', 'beyond'].includes(pic)) b3 = 2; }
    else if (cls === 'extra') { b2 = 4; if (noun === 'number') b3 = 3; }
    else b3 = 4;
    return [b1, b2, b3];
  };

  /* ---------- 영상 01장 · 직접 해 보기: 한국어 조사 하나 → 영어 전치사 여럿 ---------- */
  PR.KO = [
    { k: '에', note: '시각 · 날 · 큰 칸', en: [['at', '시각 · 한 지점', 'at 3 p.m.'], ['on', '날 · 면 · 층', 'on Monday'], ['in', '큰 칸 · 공간', 'in May']] },
    { k: '까지', note: '끝나나 · 이어지나', en: [['by', '끝나는 일 (마감)', 'by Friday'], ['until', '쭉 이어지는 일', 'until 9 p.m.']] },
    { k: '동안', note: '길이 · 사건', en: [['for', '숫자로 잰 길이', 'for three hours'], ['during', '사건 · 행사', 'during the meeting']] },
    { k: '안에', note: 'in two weeks = 2주 뒤', en: [['within', '그 길이 안에', 'within 30 days'], ['in', '조심: 그만큼 뒤', 'in two weeks']] },
  ];

  /* ---------- 영상 02장 직접 해 보기: at · on · in 크기 맞히기 ---------- */
  const T = (q, noun, nounText, opts, pic = 'at', extra = {}) => Object.assign({ q, cls: 'time', noun, nounText, opts, pic }, extra);
  PR.UNITS = [
    T('The store opens ___ 10 a.m.', 'clock', '10 a.m.', ['at', 'on', 'in']),
    T('The seminar is ___ Wednesday.', 'day', 'Wednesday', ['at', 'on', 'in']),
    T('Our office moved ___ 2024.', 'month', '2024', ['at', 'on', 'in']),
    T('Let’s have lunch ___ noon.', 'clock', 'noon', ['at', 'on', 'in']),
    T('The festival starts ___ July 3.', 'day', 'July 3', ['at', 'on', 'in']),
    T('The new model will be released ___ the spring.', 'month', 'the spring', ['at', 'on', 'in']),
  ];
  /* ---------- 영상 03장: by · until 예문 (직접 해 보기에서 바꿈) ---------- */
  PR.BYUNTIL = [
    { by: 'Please submit the report by Friday.', byAct: 'submit', byN: 'Friday', byKo: '제출', byT: ['월', '화', '수', '목', '금', '토'], byAt: 4,
      un: 'The store will stay open until 9 p.m.', unAct: 'stay open', unN: '9 p.m.', unKo: '문 열어 둠', unT: ['5시', '6시', '7시', '8시', '9시', '10시'], unAt: 4 },
    { by: 'Please return the signed form by May 10.', byAct: 'return', byN: 'May 10', byKo: '반납', byT: ['5/6', '5/7', '5/8', '5/9', '5/10', '5/11'], byAt: 4,
      un: 'The road will remain closed until Monday.', unAct: 'remain closed', unN: 'Monday', unKo: '막혀 있음', unT: ['목', '금', '토', '일', '월', '화'], unAt: 4 },
    { by: 'The repairs will be finished by noon.', byAct: 'finished', byN: 'noon', byKo: '수리 끝', byT: ['9시', '10시', '11시', '12시', '1시', '2시'], byAt: 3,
      un: 'Please wait in the lobby until noon.', unAct: 'wait', unN: 'noon', unKo: '기다림', unT: ['9시', '10시', '11시', '12시', '1시', '2시'], unAt: 3 },
  ];
  PR.BU = [
    T('The repairs will be finished ___ Thursday.', 'day', 'Thursday', ['by', 'until'], 'end', { act: 'finished', why3: '수리는 끝나는 일' }),
    T('Please wait in the lobby ___ noon.', 'clock', 'noon', ['by', 'until'], 'continue', { act: 'wait', why3: '기다리기는 쭉 이어지는 일' }),
    T('Guests must check out ___ 11 a.m.', 'clock', '11 a.m.', ['by', 'until'], 'end', { act: 'check out', why3: '체크아웃은 한 번에 끝나는 일' }),
    T('The sale continues ___ the end of the month.', 'point', 'the end of the month', ['by', 'until'], 'continue', { act: 'continues', why3: '할인은 쭉 이어지는 일' }),
    T('Please return the signed form ___ May 10.', 'day', 'May 10', ['by', 'until'], 'end', { act: 'return', why3: '반납은 한 번에 끝나는 일' }),
    T('The museum will stay closed ___ next Monday.', 'day', 'next Monday', ['by', 'until'], 'continue', { act: 'stay closed', why3: '닫혀 있는 상태가 쭉 이어지는 일' }),
  ];
  /* ---------- 영상 04장: 길이일까, 사건일까 ---------- */
  PR.FD = [
    T('The meeting lasted ___ two hours.', 'length', 'two hours', ['for', 'during'], 'span'),
    T('He fell asleep ___ the lecture.', 'event', 'the lecture', ['for', 'during'], 'span'),
    T('Please wait here ___ a few minutes.', 'length', 'a few minutes', ['for', 'during'], 'span'),
    T('The power went out twice ___ the storm.', 'event', 'the storm', ['for', 'during'], 'span'),
    T('The trial version is free ___ 14 days.', 'length', '14 days', ['for', 'during'], 'span'),
    T('Several new ideas came up ___ the discussion.', 'event', 'the discussion', ['for', 'during'], 'span'),
  ];
  /* ---------- 영상 05장: in일까, within일까 (뜻을 함께 적음) ---------- */
  PR.IW = [
    T('The new store will open ___ two weeks.', 'length', 'two weeks', ['in', 'within'], 'later', { hint: '지금부터 2주 뒤에' }),
    T('Please reply ___ two weeks.', 'length', 'two weeks', ['in', 'within'], 'inside', { hint: '2주 안에 아무 때나' }),
    T('Your order will arrive ___ three days.', 'length', 'three days', ['in', 'within'], 'inside', { hint: '사흘 안에 아무 때나' }),
    T('The workshop starts ___ ten minutes.', 'length', 'ten minutes', ['in', 'within'], 'later', { hint: '지금부터 10분 뒤에' }),
  ];
  /* ---------- 영상 06장: 장소 그림 고르기 ---------- */
  const Pl = (q, noun, nounText, opts, pic = 'at') => ({ q, cls: 'place', noun, nounText, opts, pic });
  PR.PLACE = [
    Pl('Please check in ___ the front desk.', 'spot', 'the front desk', ['at', 'on', 'in']),
    Pl('The schedule is posted ___ the bulletin board.', 'surface', 'the bulletin board', ['at', 'on', 'in']),
    Pl('Our head office is ___ Seoul.', 'area', 'Seoul', ['at', 'on', 'in']),
    Pl('The restrooms are ___ the second floor.', 'surface', 'the second floor', ['at', 'on', 'in']),
    Pl('Your key card is ___ the envelope.', 'area', 'the envelope', ['at', 'on', 'in']),
    Pl('The café is ___ the bank and the bookstore.', 'two', 'the bank and the bookstore', ['between', 'among'], 'mid'),
    Pl('Ms. Cho is popular ___ her coworkers.', 'group', 'her coworkers', ['between', 'among'], 'mid'),
  ];
  /* ---------- 영상 07장: 뜻을 더하는 전치사 ---------- */
  const Ex = (q, noun, nounText, opts, pic, why3) => ({ q, cls: 'extra', noun, nounText, opts, pic, why3 });
  PR.EXTRA = [
    Ex('Prices rose ___ 5 percent last month.', 'number', '5 percent', ['by', 'to', 'as'], 'diff', '값이 오른 차이'),
    Ex('The price dropped from 100 dollars ___ 80 dollars.', 'number', '80 dollars', ['by', 'to', 'per'], 'final', 'from A to B → 다다른 값'),
    Ex('Ms. Cho will speak ___ a guest lecturer.', 'role', 'a guest lecturer', ['as', 'via', 'upon'], 'role'),
    Ex('Please submit the form ___ our website.', 'route', 'our website', ['per', 'via', 'upon'], 'route'),
    Ex('The tour costs 30 dollars ___ person.', 'unit', 'person', ['as', 'by', 'per'], 'each'),
    Ex('Please show your ID ___ arrival.', 'action', 'arrival', ['upon', 'per', 'as'], 'upon'),
  ];
  // 07장 막대그래프: 지난해 → 올해 (차이 by · 도착점 to)
  PR.BARS = { from: 2.5, to: 3, unit: 'million dollars', pct: 20 };
  /* ---------- 영상 08장 직접 해 보기: 짝 고르기 ---------- */
  const Pa = (q, head, opts, nounText) => ({ q, cls: 'pair', head, headText: head, noun: 'thing', nounText, opts });
  PR.PAIRLAB = [
    Pa('Mr. Han is familiar ___ the new software.', 'familiar', ['with', 'to', 'in'], 'the new software'),
    Pa('The final price depends ___ the size of the order.', 'depend', ['in', 'on', 'to'], 'the size of the order'),
    Pa('Our design team consists ___ six people.', 'consist', ['with', 'in', 'of'], 'six people'),
    Pa('We are looking for a solution ___ the parking problem.', 'solution', ['to', 'in', 'at'], 'the parking problem'),
    Pa('Are you interested ___ the marketing position?', 'interested', ['about', 'in', 'for'], 'the marketing position'),
  ];

  /* ---------- 놀이터 ①: 까지 갈림길 (시간선 실험실) ----------
   * shape: once 한 번에 끝나는 일(점) · state 쭉 이어지는 일(막대)
   * tl: 시간선 { ticks: 눈금, now: 지금 눈금 번호(null이면 없음), nowLabel, at: 깃발(시점) 눈금, len: 길이(눈금 수), from: 길이가 시작하는 눈금, ev: [사건 시작, 끝] }
   */
  PR.ROAD_PREPS = ['by', 'until', 'for', 'during', 'within', 'since', 'in'];
  const R = (o) => Object.assign({ cls: 'time' }, o);
  PR.ROAD = [
    R({ q: 'Please return the keys ___ Friday.', ko: '금요일까지 열쇠를 돌려주세요.', act: 'return the keys', actKo: '열쇠 돌려주기', shape: 'once', noun: 'day', nounText: 'Friday', pic: 'end',
      why3: '돌려주기는 한 번에 끝나는 일', tl: { ticks: ['월', '화', '수', '목', '금', '토'], now: 0, at: 4 } }),
    R({ q: 'The store will stay open ___ 9 p.m.', ko: '가게는 밤 9시까지 문을 열어 둬요.', act: 'stay open', actKo: '문 열어 두기', shape: 'state', noun: 'clock', nounText: '9 p.m.', pic: 'continue',
      why3: '문 열어 두기는 쭉 이어지는 일', tl: { ticks: ['5시', '6시', '7시', '8시', '9시', '10시', '11시'], now: 0, at: 4 } }),
    R({ q: 'We waited in the lobby ___ two hours.', ko: '우리는 로비에서 두 시간 동안 기다렸어요.', act: 'waited', actKo: '기다리기', shape: 'state', noun: 'length', nounText: 'two hours', pic: 'span',
      why3: '기다리기가 그 길이 내내 이어졌어요', tl: { ticks: ['1시', '2시', '3시', '4시', '5시'], now: null, from: 1, len: 2 } }),
    R({ q: 'Meals will be served ___ the flight.', ko: '비행하는 동안 식사가 나와요.', act: 'served', actKo: '식사 나오기', shape: 'once', noun: 'event', nounText: 'the flight', pic: 'span',
      why3: '식사는 비행이 이어지는 동안 나와요', tl: { ticks: ['9시', '10시', '11시', '12시', '1시', '2시'], now: 0, ev: [1, 4], name: '비행' } }),
    R({ q: 'Refunds must be requested ___ 30 days of purchase.', ko: '환불은 산 날부터 30일 안에 요청해야 해요.', act: 'requested', actKo: '환불 요청', shape: 'once', noun: 'length', nounText: '30 days', pic: 'inside',
      why3: '요청은 30일 안에 한 번 하면 되는 일', tl: { ticks: ['산 날', '10일', '20일', '30일', '40일'], now: 0, nowLabel: '산 날', from: 0, len: 3 } }),
    R({ q: 'Mr. Han has lived in Seoul ___ 2019.', ko: '한 씨는 2019년부터 지금까지 서울에 살고 있어요.', act: 'has lived', actKo: '서울에 살기', shape: 'state', noun: 'month', nounText: '2019', pic: 'from',
      why3: 'has lived → 그때부터 지금까지 이어진 일', tl: { ticks: ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '지금'], now: 8, at: 1 } }),
    R({ q: 'The new branch will open ___ two weeks.', ko: '새 지점은 지금부터 2주 뒤에 문을 열어요.', act: 'open', actKo: '문 열기', shape: 'once', noun: 'length', nounText: 'two weeks', pic: 'later',
      why3: '지금부터 2주 지난 그때 한 번', tl: { ticks: ['지금', '1주', '2주', '3주'], now: 0, from: 0, len: 2 } }),
    R({ q: 'The road will remain closed ___ Monday.', ko: '도로는 월요일까지 막혀 있어요.', act: 'remain closed', actKo: '막혀 있기', shape: 'state', noun: 'day', nounText: 'Monday', pic: 'continue',
      why3: '막혀 있는 상태가 쭉 이어지는 일', tl: { ticks: ['목', '금', '토', '일', '월', '화'], now: 0, at: 4 } }),
  ];
  // 전치사 하나가 시간선에 그리는 그림 (놀이터 · 퀴즈 그림)
  PR.ROAD_PIC = { by: 'end', until: 'continue', since: 'from', for: 'span', during: 'span', within: 'inside', in: 'later' };

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * cls · noun · pic: 빈칸 자리의 뜻 · nounText: 빈칸 뒤 명사(문장 속 글자) · act: 그림을 정하는 동작(문장 속 글자) · why3: 그림의 까닭
   * head · headText: 짝 표현의 앞 낱말(사전 모양 · 문장 속 글자) · type: 100개 유형 번호
   */
  PR.DRILL = [
    { q: 'Please submit your expense report ___ Friday.', opts: ['until', 'by', 'among', 'during'], a: 1,
      cls: 'time', noun: 'day', nounText: 'Friday', pic: 'end', act: 'submit', why3: '제출은 한 번에 끝나는 일',
      tag: '시간 · 마감 by', type: 56, ko: '금요일까지 경비 보고서를 내 주세요.' },
    { q: 'The north entrance will remain closed ___ the end of the month.', opts: ['by', 'within', 'until', 'since'], a: 2,
      cls: 'time', noun: 'point', nounText: 'the end of the month', pic: 'continue', act: 'remain closed', why3: '닫혀 있는 상태가 쭉 이어지는 일',
      tag: '시간 · 쭉 이어짐 until', type: 56, ko: '북쪽 출입구는 이달 말까지 닫혀 있어요.' },
    { q: 'The training program will run ___ six weeks, starting on May 4.', opts: ['during', 'since', 'at', 'for'], a: 3,
      cls: 'time', noun: 'length', nounText: 'six weeks', pic: 'span', act: 'will run', why3: '교육이 그 길이 내내 이어져요',
      tag: '시간 · 숫자 길이 for', type: 56, ko: '교육 프로그램은 5월 4일부터 6주 동안 진행돼요.' },
    { q: 'Guests are asked not to use flash photography ___ the performance.', opts: ['during', 'within', 'while', 'by'], a: 0,
      cls: 'time', noun: 'event', nounText: 'the performance', pic: 'span', act: 'not to use flash photography', why3: '공연이 이어지는 동안 지킬 일',
      tag: '시간 · 사건 during', type: 56, ko: '관객은 공연하는 동안 플래시를 켜고 사진을 찍지 말아 주세요.' },
    { q: 'Defective products can be exchanged ___ 14 days of delivery.', opts: ['for', 'on', 'until', 'within'], a: 3,
      cls: 'time', noun: 'length', nounText: '14 days', pic: 'inside', act: 'exchanged', why3: '교환은 14일 안에 한 번 하면 되는 일',
      tag: '시간 · 그 안에 within', type: 56, ko: '불량품은 배송받은 날부터 14일 안에 교환할 수 있어요.' },
    { q: 'Ms. Okada has worked as the head of our design team ___ 2021.', opts: ['since', 'for', 'in', 'by'], a: 0,
      cls: 'time', noun: 'month', nounText: '2021', pic: 'from', act: 'has worked', why3: 'has worked → 과거부터 지금까지 이어진 일(현재완료)',
      tag: '시간 · since + 현재완료', type: 56, ko: '오카다 씨는 2021년부터 우리 디자인팀 팀장으로 일해 왔어요.' },
    { q: 'The new community center is located ___ the city library and Hanbit Park.', opts: ['since', 'between', 'among', 'along'], a: 1,
      cls: 'place', noun: 'two', nounText: 'the city library and Hanbit Park', pic: 'mid',
      tag: '장소 · 둘 사이 between', type: 57, ko: '새 주민 센터는 시립 도서관과 한빛 공원 사이에 있어요.' },
    { q: 'The new uniforms are popular ___ the hotel’s staff members.', opts: ['between', 'along', 'among', 'until'], a: 2,
      cls: 'place', noun: 'group', nounText: 'the hotel’s staff members', pic: 'mid',
      tag: '장소 · 무리 가운데 among', type: 57, ko: '새 유니폼은 호텔 직원들 사이에서 인기가 있어요.' },
    { q: 'Free Wi-Fi is available ___ the building, including the parking garage.', opts: ['between', 'since', 'along', 'throughout'], a: 3,
      cls: 'place', noun: 'area', nounText: 'the building', pic: 'whole', act: 'including the parking garage', why3: '주차장까지 건물 곳곳에서',
      tag: '장소 · 곳곳에 throughout', type: 57, ko: '주차장을 포함해 건물 곳곳에서 무료 와이파이를 쓸 수 있어요.' },
    { q: 'Mr. Fernandez will join the project ___ a technical consultant.', opts: ['since', 'as', 'to', 'within'], a: 1,
      cls: 'extra', noun: 'role', nounText: 'a technical consultant', pic: 'role',
      tag: '자격 as', type: 57, ko: '페르난데스 씨는 기술 컨설턴트로서 이 프로젝트에 합류해요.' },
    { q: 'The number of visitors to the museum rose ___ 18 percent over the previous year.', opts: ['to', 'as', 'by', 'within'], a: 2,
      cls: 'extra', noun: 'number', nounText: '18 percent', pic: 'diff', act: 'over the previous year', why3: '지난해보다 늘어난 차이',
      tag: '숫자 · 차이 by', type: 57, ko: '박물관 방문객 수가 지난해보다 18퍼센트 늘었어요.' },
    { q: 'Ms. Kwon is responsible ___ training all new employees at the Busan branch.', opts: ['to', 'with', 'for', 'on'], a: 2,
      cls: 'pair', head: 'responsible', headText: 'responsible', noun: 'thing', nounText: 'training all new employees',
      tag: '짝 표현 · responsible for', type: 58, ko: '권 씨가 부산 지점의 신입 사원 교육을 모두 맡고 있어요.' },
    { q: 'Only full-time employees are eligible ___ the annual performance bonus.', opts: ['for', 'at', 'of', 'with'], a: 0,
      cls: 'pair', head: 'eligible', headText: 'eligible', noun: 'thing', nounText: 'the annual performance bonus',
      tag: '짝 표현 · eligible for', type: 58, ko: '정규직 직원만 연간 성과급을 받을 수 있어요.' },
    { q: 'All contractors must comply ___ the safety regulations at the construction site.', opts: ['to', 'on', 'about', 'with'], a: 3,
      cls: 'pair', head: 'comply', headText: 'comply', noun: 'thing', nounText: 'the safety regulations',
      tag: '짝 표현 · comply with', type: 58, ko: '모든 협력 업체 직원은 공사 현장의 안전 규정을 지켜야 해요.' },
    { q: 'Customer service staff should respond ___ all inquiries within 24 hours.', opts: ['to', 'for', 'at', 'of'], a: 0,
      cls: 'pair', head: 'respond', headText: 'respond', noun: 'thing', nounText: 'all inquiries',
      tag: '짝 표현 · respond to', type: 58, ko: '고객 서비스 직원은 모든 문의에 24시간 안에 답해야 해요.' },
    { q: 'There has been a sharp increase ___ demand for electric vehicles this year.', opts: ['on', 'in', 'of', 'to'], a: 1,
      cls: 'pair', head: 'increase', headText: 'increase', noun: 'thing', nounText: 'demand',
      tag: '짝 표현 · increase in', type: 58, ko: '올해 전기차 수요가 크게 늘었어요.' },
  ];
  PR.ctxOf = it => ({ cls: it.cls, noun: it.noun, pic: it.pic, nounText: it.nounText, why3: it.why3, head: it.head });
  PR.judgeOpt = (it, k) => PR.judge(it.opts[k], PR.ctxOf(it));

  // 3단계 풀이 (연습 문제 힌트). ① 무엇 ② 뒤의 명사 ③ 그림 · 짝 카드
  const L = 'ABCD';
  // bare: 보기 앞에 (A)~(D)를 붙이지 않음 (놀이터의 전치사 일곱 개)
  PR.steps = function (it, bare) {
    const c = PR.ctxOf(it), nm = k => bare ? it.opts[k] : `(${L[k]}) ${it.opts[k]}`;
    const out = step => it.opts.map((o, k) => [k, PR.judgeOpt(it, k)]).filter(([, j]) => j.step === step).map(([k]) => nm(k));
    const o1 = out(1), o2 = out(2), o3 = out(3), right = nm(it.a);
    const drop = o => o.length ? ` 탈락: ${o.join(' · ')}.` : '';
    let t1, t2, t3, m1, m2, m3 = [];
    if (it.cls === 'pair') {
      const P = PR.PAIRS[it.head];
      t1 = `빈칸 앞 → ${it.headText}. 늘 같이 다니는 전치사가 정해진 ${PR.POS[P.pos]}예요 → 짝 표현.` + drop(o1);
      m1 = [{ t: it.headText, role: 'ante' }];
      t2 = (P.num ? (c.noun === 'number' ? `뒤 → ${it.nounText}, 숫자예요. 숫자 앞의 짝은 of.` : `뒤 → ${it.nounText}, 숫자가 아니라 늘거나 준 것이에요. 숫자 앞이라면 of, 지금은 in.`)
        : `뒤의 명사 → ${it.nounText}. 짝 표현에서는 뒤의 명사가 아니라 앞 낱말이 전치사를 골라요. 한국어 뜻으로 옮겨 고르면 함정이에요.`) + drop(o2);
      m2 = [{ t: it.nounText, role: 'cue' }];
      t3 = `짝 카드 → ${it.head} ${PR.pairWant(c)} (${P.ko}).` + drop(o3) + ` 정답 ${right}.`;
    } else {
      const N = PR.NOUN[[].concat(it.noun)[0]];
      t1 = `빈칸 뒤 → ${/\.$/.test(it.nounText) ? it.nounText : it.nounText + '.'} ${PR.CLS[it.cls].what} → ${PR.CLS[it.cls].name}.` + drop(o1);
      m1 = [{ t: it.nounText, role: 'cue' }];
      const pt = it.cls === 'time' && ['end', 'continue', 'from'].includes(it.pic) ? ', 곧 한 시점(그때)' : '';
      t2 = `${it.nounText} → ${iye(N.name + pt)}.` + drop(o2);
      m2 = [];
      t3 = `${PR.picName(it.pic, it.cls, it.noun)}` + (it.why3 ? ` → ${it.why3}.` : '.') + drop(o3) + ` 정답 ${right}.`;
      if (it.act) m3 = [{ t: it.act, role: 'verb' }];
    }
    return [
      { head: '① 무엇을 나타내나요?', text: t1, marks: m1 },
      { head: '② 뒤의 명사를 봐요.', text: t2, marks: m2 },
      { head: it.cls === 'pair' ? '③ 짝 카드로 확인해요.' : '③ 그림으로 확인해요.', text: t3, marks: m3 },
    ];
  };
  PR.drillItems = () => PR.DRILL.map(it => ({
    q: it.q, opts: it.opts, a: it.a, ko: it.ko, tag: it.tag, steps: PR.steps(it),
    notes: it.opts.map((w, k) => { const j = PR.judgeOpt(it, k); return `${PR.CONJ[w] ? '접속사 · ' + PR.CONJ[w] : PR.P[w].ko}. ` + (j.s === 'ok' ? '' : '× ') + j.why; }),
  }));

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용 — 직접 해 보기 · 놀이터로만 나오는 글자 포함)
  PR.allText = function () {
    const out = [];
    Object.values(PR.CLS).forEach(c => out.push(c.name, c.what));
    Object.values(PR.NOUN).forEach(n => out.push(n.name, n.ex));
    Object.keys(PR.PIC).forEach(p => ['time', 'place', 'extra'].forEach(c => out.push(PR.picName(p, c, ['event']), PR.picName(p, c, ['group']), PR.picName(p, c, ['length']))));
    Object.entries(PR.P).forEach(([w, D]) => out.push(w, D.ko));
    Object.entries(PR.PAIRS).forEach(([w, P]) => out.push(w, P.p, P.ko, P.q, P.qko, P.tip));
    PR.KO.forEach(k => { out.push(k.k, k.note); k.en.forEach(e => out.push(e.join(''))); });
    PR.BYUNTIL.forEach(b => out.push(Object.values(b).join('')));
    PR.ROAD.forEach(r => { out.push(r.q, r.ko, r.actKo, r.tl.ticks.join(''), r.tl.name || '', r.tl.nowLabel || '', r.why3); PR.ROAD_PREPS.forEach(w => out.push(PR.judge(w, r).why)); });
    PR.DRILL.forEach(it => out.push(it.q, it.opts.join('')));
    out.push('지금시점?길이?사건?늦었어요깃발 전깃발 뒤그 안그 밖');
    return out.join('');
  };

  // 데이터 점검: 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, 단서가 문장에 있는지, 데이터 이름이 사전에 있는지, 정답 위치가 고르게 섞였는지
  PR.check = function () {
    const bad = [];
    const ctxCheck = (w, c) => {
      if (!PR.CLS[c.cls]) bad.push(`${w}: 무엇(cls) ${c.cls}이 사전에 없어요`);
      [].concat(c.noun).forEach(n => { if (!PR.NOUN[n]) bad.push(`${w}: 명사 종류 ${n}가 사전에 없어요`); });
      if (c.cls === 'pair') { if (!PR.PAIRS[c.head]) bad.push(`${w}: 짝 카드에 ${c.head}가 없어요`); }
      else if (!PR.PIC[c.pic]) bad.push(`${w}: 그림 ${c.pic}가 사전에 없어요`);
    };
    const one = (w, it, want) => {
      ctxCheck(w, it);
      if ((it.q.match(/___/g) || []).length !== 1) bad.push(`${w}: 빈칸이 하나가 아니에요`);
      it.opts.forEach(o => { if (!PR.isWord(o)) bad.push(`${w}: 보기 ${o}가 사전에 없어요`); });
      const good = it.opts.filter(o => PR.judge(o, PR.ctxOf(it)).s === 'ok');
      if (good.length !== 1 || (want != null && good[0] !== want)) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good)}${want != null ? `, 정답 ${want}` : ''}`);
      [it.nounText, it.act, it.headText].filter(Boolean).forEach(t => { if (!it.q.includes(t)) bad.push(`${w}: 단서 ‘${t}’가 문장에 없어요`); });
      if (it.nounText && it.q.indexOf(it.nounText) < it.q.indexOf('___')) bad.push(`${w}: 뒤의 명사가 빈칸 앞에 있어요`);
      if (it.headText && it.q.indexOf(it.headText) > it.q.indexOf('___')) bad.push(`${w}: 짝 표현의 앞 낱말이 빈칸 뒤에 있어요`);
    };
    PR.DRILL.forEach((it, i) => one(`연습 문제 ${i + 1}`, it, it.opts[it.a]));
    const pos = [0, 0, 0, 0]; PR.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 1) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    [['02장', PR.UNITS], ['03장', PR.BU], ['04장', PR.FD], ['05장', PR.IW], ['06장', PR.PLACE], ['07장', PR.EXTRA], ['08장', PR.PAIRLAB]].forEach(([nm, list]) => list.forEach((it, i) => one(`직접 해 보기 ${nm} ${i + 1}`, it)));
    // 놀이터 ①: 일곱 전치사 가운데 꼭 하나만 맞아야 하고, 그림 · 모양이 시간선과 맞아야 해요
    PR.ROAD.forEach((r, i) => {
      const w = `까지 갈림길 ${i + 1}`;
      ctxCheck(w, r);
      const good = PR.ROAD_PREPS.filter(p => PR.judge(p, r).s === 'ok');
      if (good.length !== 1) bad.push(`${w}: 맞는 전치사가 하나가 아니에요 ${JSON.stringify(good)}`);
      if (!r.q.includes(r.nounText) || !r.q.includes(r.act)) bad.push(`${w}: 단서가 문장에 없어요`);
      const T = r.tl, needs = { end: 'at', continue: 'at', from: 'at', span: r.noun === 'event' ? 'ev' : 'len', inside: 'len', later: 'len' }[r.pic];
      if (T[needs] == null) bad.push(`${w}: 시간선에 ${needs}가 없어요`);
      if (r.pic === 'from' && !(T.at < T.now)) bad.push(`${w}: since의 깃발이 지금보다 앞이 아니에요`);
      if ({ once: ['end', 'inside', 'later', 'span'], state: ['continue', 'span', 'from'] }[r.shape].indexOf(r.pic) < 0) bad.push(`${w}: 동작 모양과 그림이 맞지 않아요`);
    });
    // 놀이터 ②: 짝 카드의 정답과 틀린 보기
    Object.entries(PR.PAIRS).forEach(([w, P]) => {
      const c = { cls: 'pair', head: w, noun: 'thing', nounText: '' };
      if (!PR.P[P.p]) bad.push(`짝 카드 ${w}: ${P.p}가 전치사 사전에 없어요`);
      if (PR.judge(P.p, c).s !== 'ok') bad.push(`짝 카드 ${w}: 정답이 규칙 엔진과 달라요`);
      if (P.no.length !== 3 || P.no.some(o => PR.judge(o, c).s === 'ok' || !PR.P[o])) bad.push(`짝 카드 ${w}: 틀린 보기가 이상해요`);
      if ((P.q.match(/___/g) || []).length !== 1 || !new RegExp('\\b' + w).test(P.q.toLowerCase())) bad.push(`짝 카드 ${w}: 문장이 이상해요`);
    });
    PR.DRILL.filter(it => it.cls === 'pair').forEach(it => { if (it.q.toLowerCase().indexOf(it.head) < 0) bad.push(`연습 문제: ${it.head}가 문장에 없어요`); });
    bad.forEach(b => console.warn('[전치사] ' + b));
    return bad;
  };
})();
