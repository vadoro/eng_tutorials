/* 듣기 ② Part 3·4 튜토리얼 — 규칙 엔진과 대화·담화 데이터
 *
 * 이 튜토리얼의 핵심: Part 3·4의 정답은 들은 말을 **바꿔 말한(paraphrase)** 보기이고,
 * 세 문제는 대화 순서대로 답이 나와요. 3단계 풀이법: ① 문제 먼저 읽기 → ② 신호어 듣기 → ③ 바꿔 말한 보기 고르기.
 *
 * 세트(대화·담화) 하나 = { lines: 대본 줄, qs: 세 문제 }. 문제마다 데이터에 적어 두는 것:
 *   type  묻는 것 (topic 주제·목적 · place 장소·직업 · problem 문제점 · request 요청·제안 · next 다음에 할 일
 *         · intent 화자 의도 · graphic 시각 정보 · detail 세부 정보)
 *   who   문제가 묻는 사람 (W · M · M1 · M2 · S), ev 근거 줄, sig 근거 줄 속 신호어, kw 문제의 키워드
 *   opts  보기마다 [글, 대본과의 관계, 해석, 덧붙임]. 관계(rel):
 *         para 바꿔 말한 정답 · speaker 다른 사람의 말 · time 때가 다른 일 · none 나오지 않은 내용
 *         · contra 대화와 반대 · repeat 그대로 들린 낱말 · graphic 그림과 안 맞음
 * LT.judge(세트, 문제, 보기) → { s: 'ok' | 'no', step: 0~3, rel, why, line }  — step = 3단계 가운데 몇 단계에서 지워지는지
 *   ① 문제 키워드(누구 · 언제)와 어긋남: speaker · time   ② 근거 줄과 안 맞음: none · contra   ③ 바꿔 말하기 확인: repeat · graphic
 * 영상의 ✓·×, 직접 해 보기, 놀이터(근거 줄 찾기 · 의도 파악 실험), 연습 문제, 퀴즈가 모두 이 판정을 써요.
 * LT.check()는 정답이 꼭 하나인지, 근거 줄과 바꿔 말한 말이 대본·보기에 정말 있는지, 세 문제가 대화 순서인지,
 * 신호어가 문제 종류와 맞는지, 그림 문제의 답을 그림에서 다시 계산해도 같은지, 정답 위치가 고른지 점검해 콘솔에 경고를 냅니다.
 *
 * 단순하게 줄인 부분: 보기와 대본의 관계는 엔진이 문장을 스스로 이해해 정하는 것이 아니라 보기마다 데이터에 적어 둔 것이에요.
 * 엔진은 그 관계가 대본과 맞는지(낱말이 정말 들리는지, 말한 사람이 다른지, 그림에서 계산한 답과 같은지)를 확인해요.
 */
(function () {
  'use strict';
  const LT = (window.LT = {});
  const L4 = 'ABCD';

  /* ---------- 관계와 단계 ---------- */
  LT.REL = {
    para: { step: 0, name: '바꿔 말한 정답' },
    speaker: { step: 1, name: '다른 사람의 말' },
    time: { step: 1, name: '때가 다른 일' },
    none: { step: 2, name: '나오지 않은 내용' },
    contra: { step: 2, name: '대화와 반대' },
    repeat: { step: 3, name: '그대로 들린 낱말' },
    graphic: { step: 3, name: '그림과 안 맞음' },
  };
  LT.STEPN = ['', '① 미리 읽기', '② 신호 듣기', '③ 바꿔 말하기'];
  LT.TYPES = {
    topic: { name: '주제 · 목적', where: '답은 첫 부분에 나와요.', listen: "I'm calling about · I'd like to · I need 같은 첫 말을 들어요." },
    place: { name: '장소 · 직업', where: '단서 낱말이 대화 전체에 흩어져 있어요.', listen: '장소·직업과 관계있는 낱말을 여럿 모아요 (낱말 하나로 정하지 않기).' },
    problem: { name: '문제점 · 걱정', where: '답은 대개 가운데에 나와요.', listen: "but · unfortunately · I'm afraid · The problem is 뒤를 들어요." },
    request: { name: '요청 · 제안', where: '답은 가운데나 끝부분에 나와요.', listen: "Could you · Why don't you · Please · I'd like you to 뒤를 들어요." },
    next: { name: '다음에 할 일', where: '답은 끝부분에 나와요.', listen: "I'll · Let me · I'm going to 뒤를 들어요. 이미 한 일과 나눠 들어요." },
    intent: { name: '화자 의도', where: '따옴표 문장의 앞뒤가 뜻을 정해요.', listen: '따옴표 문장의 앞 줄과 뒤 줄을 들어요.' },
    graphic: { name: '시각 정보', where: '들은 말과 그림을 합쳐야 해요.', listen: '보기에 있는 말 말고, 그림의 다른 칸에 있는 말이 들려요.' },
    detail: { name: '세부 정보', where: '문제의 키워드가 들리는 곳에 답이 있어요.', listen: '문제의 키워드(또는 같은 뜻의 말)가 들리는 곳을 들어요.' },
  };
  // 신호어 → 어떤 문제의 답이 뒤따르는지 (앞에서부터 맞춰 봄)
  const SIG_RE = [
    ['request', /^(could you|would you mind|why don't you|i suggest|please|i'd like (you|each|everyone|all)|you should|you might want to)\b/i],
    ['next', /^(i'll|let me|i'm going to|we'll)\b/i],
    ['problem', /^(but|unfortunately|i'm afraid|the problem is|i'm sorry, but|i'm sorry)\b/i],
    ['topic', /^(i'm calling (about|to)|i'd like to|i need|i have some news)\b/i],
  ];
  LT.signalType = s => { const t = String(s).trim(); const f = SIG_RE.find(([, re]) => re.test(t)); return f ? f[0] : null; };
  // 06장 '신호어 → 무슨 문제?' 고르기
  LT.SIGNALS = ['Unfortunately', 'Could you', "I'll", "I'm afraid", "Why don't you", 'Let me', 'Would you mind', "I'm going to", 'The problem is', 'I suggest'];
  LT.SIGTYPE = { problem: '문제점', request: '요청 · 제안', next: '다음에 할 일', topic: '주제 · 목적' };

  /* ---------- 그림(시각 정보) ---------- */
  // 지도: 가운데 복도를 사이에 두고 위·아래 줄에 방이 있음 (x · w는 칸 단위)
  LT.G = {
    floor: { kind: 'map', title: '3rd Floor', items: [
      { name: 'Room 1', side: 'top', x: 0, w: 6, room: true }, { name: 'Room 2', side: 'top', x: 6, w: 6, room: true }, { name: 'Room 3', side: 'top', x: 12, w: 6, room: true },
      { name: 'Room 4', side: 'bottom', x: 0, w: 6, room: true }, { name: 'Elevator', side: 'bottom', x: 6, w: 4 }, { name: 'Stairs', side: 'bottom', x: 10, w: 3 }, { name: 'Café', side: 'bottom', x: 13, w: 5 },
    ] },
    training: { kind: 'table', title: 'Monday Training Workshops', cols: ['Time', 'Workshop', 'Room'], rows: [
      ['9:00', 'Spreadsheet Basics', 'Room A'], ['11:00', 'Presentation Skills', 'Room B'], ['12:30', 'Lunch', 'Cafeteria'],
      ['1:30', 'Time Management', 'Room C'], ['3:30', 'Customer Service', 'Room D'],
    ] },
  };
  LT.RELN = { across: '맞은편 (across from)', next: '바로 옆 (next to)' };
  // 지도에서 ‘~의 맞은편 · 바로 옆’ 방 찾기. 답이 둘 이상이거나 없으면 null
  LT.where = function (G, rel, of, roomOnly = true) {
    const A = G.items.find(i => i.name === of); if (!A) return null;
    let c = G.items.filter(b => b !== A && (!roomOnly || b.room));
    if (rel === 'across') c = c.filter(b => b.side !== A.side).map(b => [b, Math.min(A.x + A.w, b.x + b.w) - Math.max(A.x, b.x)]).filter(([, o]) => o > 0).sort((p, q) => q[1] - p[1]);
    else if (rel === 'next') c = c.filter(b => b.side === A.side && (b.x === A.x + A.w || b.x + b.w === A.x)).map(b => [b, 1]);
    else return null;
    if (!c.length || (c[1] && c[1][1] === c[0][1])) return null;
    return c[0][0].name;
  };
  // 그림에서 답 계산: 지도 { rel, of } · 표 { after: 앞 줄의 칸, col: 꺼낼 칸 }
  LT.lookup = function (G, look) {
    if (G.kind === 'map') return LT.where(G, look.rel, look.of);
    const i = G.rows.findIndex(r => r.includes(look.after)), ci = G.cols.indexOf(look.col);
    return i >= 0 && G.rows[i + 1] && ci >= 0 ? G.rows[i + 1][ci] : null;
  };
  LT.lookupRow = (G, look) => { const i = G.rows.findIndex(r => r.includes(look.after)); return i >= 0 ? i + 1 : -1; };
  LT.explainLook = function (G, look) {
    if (G.kind === 'map') return `그림에서 ${look.of} → ${LT.RELN[look.rel]} → ${LT.lookup(G, look)}`;
    const r = G.rows[LT.lookupRow(G, look)];
    return `그림에서 ${look.after} 바로 다음 줄 → ${r.join(' · ')} → ${LT.lookup(G, look)}`;
  };

  /* ---------- 세트: 대화·담화 ---------- */
  const SETS = (LT.SETS = {});
  // spk: { 기호: [이름표, 성별, 억양] } — 억양은 목소리 고르기에만 써요 (us · gb · au)
  function def(id, o) {
    o.id = id;
    o.lines = o.lines.map(([s, t, ko, x]) => Object.assign({ s, t, ko }, x || {}));
    o.qs.forEach((q, qi) => {
      q.i = qi;
      q.opts = q.opts.map(([t, rel, ko, x]) => ({ t, rel, ko, x: x || {} }));
      q.a = q.opts.findIndex(o2 => o2.rel === 'para');
    });
    SETS[id] = o;
    return o;
  }
  const P3 = 'Part 3 · 두 사람 대화', P3T = 'Part 3 · 세 사람 대화', P3G = 'Part 3 · 대화 + 그림';

  /* 호텔 단체 예약 (영상 00 · 01 · 02 · 04장, 놀이터) */
  def('hotel', {
    part: 3, label: P3, title: '호텔 단체 예약', spk: { W: ['여자', 'f', 'us'], M: ['남자', 'm', 'gb'] },
    lines: [
      ['W', "Hi, this is Dana Kim from Brightline Consulting. I'd like to reserve twenty rooms for our sales conference next month.", '안녕하세요, 브라이트라인 컨설팅의 대나 김이에요. 다음 달 영업 회의 때문에 방 스무 개를 예약하고 싶어요.'],
      ['M', 'Certainly. Which dates do you need?', '물론이죠. 어느 날짜가 필요하세요?'],
      ['W', 'May twelfth through the fifteenth. Our first session starts early on the thirteenth, so everyone has to arrive the night before.', '5월 12일부터 15일까지요. 첫 세션이 13일 아침 일찍 시작해서 모두 전날 밤에 도착해야 해요.'],
      ['M', "Let me check. Unfortunately, we're fully booked on the twelfth. There's a medical convention in town that week.", '확인해 볼게요. 안타깝게도 12일은 예약이 다 찼어요. 그 주에 시내에서 의학 학회가 열리거든요.'],
      ['W', "Oh, no. That's the night we need most.", '아, 이런. 그날 밤이 가장 필요한데요.'],
      ['M', "Why don't you try the Parkside Inn? It's our sister hotel, just two blocks away, and it still has rooms that night.", '파크사이드 인에 알아보시는 건 어떠세요? 저희 자매 호텔인데 두 블록 거리이고, 그날 밤 아직 방이 있어요.'],
      ['W', 'That sounds good. Could you e-mail me their phone number?', '좋네요. 그곳 전화번호를 이메일로 보내 주시겠어요?'],
      ['M', "Sure. I'll send it to you right after this call.", '그럼요. 이 통화가 끝나면 바로 보내 드릴게요.'],
    ],
    qs: [
      { type: 'topic', who: 'W', q: 'Why is the woman calling?', ko: '여자는 왜 전화하고 있나요?', kw: ['Why', 'the woman', 'calling'], ev: 0, sig: "I'd like to",
        opts: [
          ['To change the date of a conference', 'none', '회의 날짜를 바꾸려고', { note: '날짜를 바꾼다는 말은 없어요.' }],
          ['To book accommodations for a group', 'para', '단체 숙소를 예약하려고', { pp: [['reserve twenty rooms', 'book accommodations for a group']] }],
          ['To register for a medical convention', 'repeat', '의학 학회에 등록하려고', { w: 'convention', ln: 3, note: '학회는 호텔이 꽉 찬 까닭일 뿐이에요.' }],
          ['To confirm an earlier reservation', 'contra', '전에 한 예약을 확인하려고', { ln: 0, t: "I'd like to reserve", note: '이제 새로 예약하려는 전화예요.' }],
        ] },
      { type: 'problem', who: 'M', q: 'What problem does the man mention?', ko: '남자는 어떤 문제를 말하나요?', kw: ['problem', 'the man'], ev: 3, sig: 'Unfortunately',
        opts: [
          ['A session starts early in the morning.', 'speaker', '세션이 아침 일찍 시작한다.', { ln: 2, note: '이른 세션은 여자가 한 말이에요.' }],
          ['A room was booked under the wrong name.', 'repeat', '방이 다른 이름으로 예약되었다.', { w: 'booked', ln: 3 }],
          ['No rooms are available on one night.', 'para', '하룻밤은 빈방이 없다.', { pp: [['fully booked on the twelfth', 'No rooms are available on one night']] }],
          ['The hotel is closed for repairs.', 'none', '호텔이 수리 때문에 문을 닫았다.'],
        ] },
      { type: 'next', who: 'M', q: 'What will the man most likely do next?', ko: '남자는 다음에 무엇을 할 것 같나요?', kw: ['the man', 'do next'], ev: 7, sig: "I'll",
        opts: [
          ['Call the Parkside Inn', 'speaker', '파크사이드 인에 전화한다', { ln: 5, note: '남자는 그곳을 권했을 뿐, 연락은 여자가 할 일이에요.' }],
          ['Check a reservation system', 'time', '예약 시스템을 확인한다', { ln: 3, t: 'Let me check', when: 'past' }],
          ['Reserve twenty rooms', 'repeat', '방 스무 개를 예약한다', { w: 'twenty rooms', ln: 0, note: '12일은 이미 꽉 찼어요.' }],
          ['Send some contact information', 'para', '연락처 정보를 보낸다', { pp: [["I'll send it", 'Send'], ['their phone number', 'contact information', 6]] }],
        ] },
    ],
  });

  /* 인쇄소 (영상 03장) */
  def('print', {
    part: 3, label: P3, title: '포스터 주문', spk: { W: ['여자', 'f', 'au'], M: ['남자', 'm', 'us'] },
    lines: [
      ['W', "Hi, I need two hundred posters for our gallery's opening night next Saturday. Can you have them ready by Thursday?", '안녕하세요, 다음 주 토요일 저희 갤러리 개관 행사에 쓸 포스터 200장이 필요해요. 목요일까지 준비해 주실 수 있나요?'],
      ['M', 'Sure. Would you like them printed on glossy paper or matte?', '그럼요. 광택지에 인쇄할까요, 무광지에 인쇄할까요?'],
      ['W', 'Glossy, please. The design file is on this USB drive.', '광택지로 해 주세요. 디자인 파일은 이 USB에 있어요.'],
      ['M', "Great. I'll print one sample copy first so you can check the colors.", '좋아요. 색을 확인하실 수 있게 먼저 견본을 한 장 뽑아 드릴게요.'],
    ],
    qs: [
      { type: 'topic', who: 'W', q: 'What does the woman want to do?', ko: '여자는 무엇을 하고 싶어 하나요?', kw: ['the woman', 'want to do'], ev: 0, sig: 'I need',
        opts: [
          ['Open an art gallery', 'repeat', '미술관을 연다', { w: 'gallery', ln: 0, note: '갤러리는 포스터를 쓸 곳이에요.' }],
          ['Order some printed materials', 'para', '인쇄물을 주문한다', { pp: [['I need two hundred posters', 'Order some printed materials']] }],
          ['Sell some paintings', 'none', '그림을 판다'],
          ['Change an event date', 'none', '행사 날짜를 바꾼다'],
        ] },
      { type: 'place', who: null, q: 'Where most likely are the speakers?', ko: '화자들은 어디에 있을 것 같나요?', kw: ['Where', 'most likely'], ev: 1,
        clues: [['posters', 0], ['printed', 1], ['glossy paper', 1], ['design file', 2], ['sample copy', 3]], sum: '인쇄소',
        opts: [
          ['At an art gallery', 'repeat', '미술관', { w: 'gallery', ln: 0, note: '한 번 들린 낱말일 뿐, 포스터를 쓸 곳이에요.' }],
          ['At a paper factory', 'repeat', '제지 공장', { w: 'paper', ln: 1 }],
          ['At a print shop', 'para', '인쇄소'],
          ['At a post office', 'none', '우체국'],
        ] },
      { type: 'next', who: 'M', q: 'What will the man do first?', ko: '남자는 먼저 무엇을 할 건가요?', kw: ['the man', 'first'], ev: 3, sig: "I'll",
        opts: [
          ['Make a test print', 'para', '시험 인쇄를 한다', { pp: [['print one sample copy first', 'Make a test print']] }],
          ['Finish all the posters', 'time', '포스터를 모두 끝낸다', { ln: 0, t: 'by Thursday', when: 'later' }],
          ['Choose a type of paper', 'speaker', '종이 종류를 고른다', { ln: 2, note: '종이는 여자가 이미 골랐어요(Glossy, please).' }],
          ['Call another store', 'none', '다른 가게에 전화한다'],
        ] },
    ],
  });

  /* 의도 파악: 같은 문장 "That's the third time this week." — 세 대화 (영상 05장, 놀이터, 퀴즈) */
  const QUOTE = "That's the third time this week.";
  const INTENT_OPTS = [['A machine keeps breaking down.', '기계가 자꾸 고장 난다.'], ['A team has been very successful.', '한 팀이 아주 잘하고 있다.'], ['A client keeps changing a schedule.', '고객이 일정을 자꾸 바꾼다.'], ['He has visited the third floor often.', '그는 3층에 자주 갔다.']];
  function intentSet(id, title, l0, l2, ans, pp, mean) {
    const opts = INTENT_OPTS.map(([t, ko], k) => k === ans ? [t, 'para', ko, { pp, mean }] : k === 3 ? [t, 'repeat', ko, { w: 'third', ln: 1, note: '‘세 번째’라는 낱말 뜻 그대로 옮긴 보기예요.' }] : [t, 'none', ko]);
    return def(id, {
      part: 3, label: P3, title, spk: { W: ['여자', 'f', 'gb'], M: ['남자', 'm', 'us'] }, quote: QUOTE,
      lines: [l0, ['M', QUOTE, '이번 주에만 세 번째예요.'], l2],
      qs: [{ type: 'intent', who: 'M', q: `What does the man mean when he says, "${QUOTE.replace(/\.$/, '')}"?`, ko: `남자가 "${QUOTE.replace(/\.$/, '')}"라고 말할 때 무슨 뜻인가요?`, kw: ['the man', 'mean'], ev: 0, ql: 1, ctx: [0, 2], opts }],
    });
  }
  intentSet('copier', '복사기',
    ['W', 'The copier on the third floor jammed again this morning.', '3층 복사기가 오늘 아침에 또 종이가 걸렸어요.'],
    ['W', "I know. I'll ask the office manager about getting a new one.", '그러게요. 새 걸 들이는 문제를 사무장님께 여쭤볼게요.'],
    0, [['jammed again', 'keeps breaking down'], ['getting a new one', 'machine', 2]], '또 고장 났다는 불만 → 기계를 바꿔야 한다');
  intentSet('contract', '계약',
    ['W', "Did you hear? Mina's team just signed another big contract.", '들었어요? 미나 팀이 방금 또 큰 계약을 따냈대요.'],
    ['W', 'They really deserve the sales award this year.', '올해 영업상은 정말 그 팀이 받을 만해요.'],
    1, [['signed another big contract', 'very successful'], ['deserve the sales award', 'very successful', 2]], '또 계약을 땄다는 감탄 → 정말 잘하고 있다');
  intentSet('client', '고객 일정',
    ['W', 'Ms. Lee from Fairway called. She wants to move our meeting again.', '페어웨이의 이 부장님이 전화했어요. 회의를 또 옮기고 싶대요.'],
    ['W', "Let's ask her to confirm the new time by e-mail.", '새 시간을 이메일로 확정해 달라고 해요.'],
    2, [['move our meeting again', 'keeps changing a schedule']], '또 일정을 바꿨다는 짜증 → 고객이 자꾸 바꾼다');
  LT.INTENT = ['copier', 'contract', 'client'];

  /* 회의실 지도 (영상 06장, 놀이터) */
  def('map', {
    part: 3, label: P3G, title: '워크숍 회의실', spk: { M: ['남자', 'm', 'au'], W: ['여자', 'f', 'us'] }, G: 'floor',
    lines: [
      ['M', "Ana, is everything ready for this afternoon's training workshop?", '애나, 오늘 오후 교육 워크숍 준비 다 됐어요?'],
      ['W', "Almost. But we can't use Room 3. The projector there isn't working.", '거의요. 그런데 3호실을 못 써요. 거기 프로젝터가 고장 났거든요.'],
      ['M', "Hmm. What about the room across from the elevator? It's about the same size.", '음. 엘리베이터 맞은편 방은 어때요? 크기가 거의 같은데요.'],
      ['W', "Good idea. I'll move the chairs and the handouts there now.", '좋은 생각이에요. 지금 의자와 유인물을 그리로 옮길게요.'],
    ],
    qs: [
      { type: 'problem', who: 'W', q: 'What problem does the woman mention?', ko: '여자는 어떤 문제를 말하나요?', kw: ['problem', 'the woman'], ev: 1, sig: 'But',
        opts: [
          ['Some equipment is broken.', 'para', '장비가 고장 났다.', { pp: [['projector', 'equipment'], ["isn't working", 'is broken']] }],
          ['A workshop has been canceled.', 'contra', '워크숍이 취소되었다.', { ln: 0, t: "this afternoon's training workshop", note: '워크숍은 오늘 오후에 열려요.' }],
          ['A room is too small.', 'none', '방이 너무 좁다.', { note: '크기는 거의 같다고 했어요.' }],
          ['Some handouts are missing.', 'repeat', '유인물이 없어졌다.', { w: 'handouts', ln: 3 }],
        ] },
      { type: 'graphic', who: null, q: 'Look at the graphic. Where will the workshop most likely be held?', ko: '그림을 보세요. 워크숍은 어디에서 열릴 것 같나요?', kw: ['Look at the graphic', 'Where'], ev: 2, sig: 'across from the elevator',
        look: { rel: 'across', of: 'Elevator' },
        opts: [
          ['Room 1', 'none', '1호실', { note: '1호실 이야기는 없어요.' }],
          ['Room 2', 'para', '2호실', { pp: [['the room across from the elevator', 'Room 2']] }],
          ['Room 3', 'graphic', '3호실', { ln: 1, w: 'Room 3', note: '그대로 들린 Room 3 → 프로젝터가 고장 나 못 쓰는 방이에요.' }],
          ['Room 4', 'graphic', '4호실', { ln: 2, note: '4호실 → 엘리베이터 바로 옆(next to)이에요. 맞은편(across from)이 아니에요.' }],
        ] },
      { type: 'next', who: 'W', q: 'What will the woman most likely do next?', ko: '여자는 다음에 무엇을 할 것 같나요?', kw: ['the woman', 'next'], ev: 3, sig: "I'll",
        opts: [
          ['Repair a projector', 'repeat', '프로젝터를 고친다', { w: 'projector', ln: 1 }],
          ['Lead a training session', 'time', '교육을 진행한다', { ln: 0, t: 'this afternoon', when: 'later' }],
          ['Prepare a different room', 'para', '다른 방을 준비한다', { pp: [['move the chairs and the handouts there', 'Prepare a different room']] }],
          ['Call a technician', 'none', '기술자를 부른다'],
        ] },
    ],
  });

  /* 세 사람 대화 (영상 07장, 놀이터, 퀴즈) */
  def('team', {
    part: 3, label: P3T, title: '앞당겨진 마감', spk: { W: ['여자', 'f', 'us'], M1: ['남자 1', 'm', 'gb'], M2: ['남자 2', 'm', 'au'] },
    names: { Olivia: 'f', Raj: 'm', Kenji: 'm' }, truth: { W: 'Olivia', M1: 'Raj', M2: 'Kenji' },
    lines: [
      ['W', 'Raj, Kenji, thanks for coming. The client just moved our deadline up to this Friday.', '라지, 켄지, 와 줘서 고마워요. 고객이 방금 마감을 이번 주 금요일로 앞당겼어요.', { to: ['Raj', 'Kenji'] }],
      ['M1', "This Friday? We haven't even recorded the voice-over yet.", '이번 주 금요일이요? 아직 내레이션 녹음도 안 했는데요.'],
      ['M2', 'I can record it tomorrow morning. The studio downstairs is free.', '제가 내일 아침에 녹음할 수 있어요. 아래층 스튜디오가 비어 있어요.'],
      ['W', 'Great. Then, Raj, could you finish editing the video by Thursday?', '좋아요. 그럼 라지, 목요일까지 영상 편집을 끝내 줄 수 있어요?', { to: 'Raj' }],
      ['M1', "I'll do my best, but I'll need Kenji's recording by noon tomorrow.", '최선을 다할게요. 그런데 켄지의 녹음이 내일 정오까지 필요해요.'],
      ['M2', "No problem. I'll send it to you as soon as I'm done.", '문제없어요. 끝나자마자 보내 줄게요.'],
    ],
    qs: [
      { type: 'topic', who: null, q: 'What are the speakers mainly discussing?', ko: '화자들은 주로 무엇을 이야기하나요?', kw: ['mainly discussing'], ev: 0, sig: 'The client just moved',
        opts: [
          ['Training a new employee', 'none', '신입 직원 교육'],
          ['An earlier deadline', 'para', '앞당겨진 마감', { pp: [['moved our deadline up', 'An earlier deadline']] }],
          ['A broken camera', 'none', '고장 난 카메라'],
          ['A team dinner on Friday', 'repeat', '금요일 팀 회식', { w: 'Friday', ln: 0, note: '금요일은 새 마감 날이에요.' }],
        ] },
      { type: 'request', who: 'M2', q: 'What does Kenji offer to do?', ko: '켄지는 무엇을 하겠다고 하나요?', kw: ['Kenji', 'offer'], ev: 2, sig: 'I can', name: true,
        opts: [
          ['Edit a video', 'speaker', '영상을 편집한다', { ln: 3, note: '편집은 여자가 Raj에게 부탁한 일이에요.' }],
          ['Record some audio', 'para', '음성을 녹음한다', { pp: [['I can record it', 'Record some audio'], ['the voice-over', 'audio', 1]] }],
          ['Call the client', 'none', '고객에게 전화한다'],
          ['Book a studio downstairs', 'repeat', '아래층 스튜디오를 예약한다', { w: 'studio downstairs', ln: 2, note: '스튜디오가 비어 있다고 했을 뿐, 예약 이야기는 없어요.' }],
        ] },
      { type: 'detail', who: 'M1', q: 'What does Raj say he needs?', ko: '라지는 무엇이 필요하다고 하나요?', kw: ['Raj', 'needs'], ev: 4, sig: "I'll need", name: true,
        opts: [
          ['An audio file by a specific time', 'para', '정해진 시간까지 음성 파일', { pp: [["Kenji's recording", 'An audio file'], ['by noon tomorrow', 'by a specific time']] }],
          ['A later deadline', 'none', '더 늦은 마감', { note: '마감을 늦춰 달라는 말은 없어요(I\'ll do my best).' }],
          ['A finished video by Thursday', 'speaker', '목요일까지 완성된 영상', { ln: 3, note: '목요일까지 영상을 바라는 사람은 여자예요.' }],
          ['A free studio', 'repeat', '비어 있는 스튜디오', { w: 'free', ln: 2 }],
        ] },
    ],
  });

  /* 음성 메시지 (Part 4, 영상 08장, 놀이터) */
  def('dental', {
    part: 4, label: 'Part 4 · 음성 메시지', title: '치과 예약 변경', talk: 'voicemail', spk: { S: ['화자', 'f', 'gb'] },
    lines: [
      ['S', 'Hello, Mr. Alvarez. This is Grace from Sunbridge Dental Clinic.', '안녕하세요, 알바레즈 씨. 선브리지 치과의 그레이스예요.', { seg: 0 }],
      ['S', "I'm calling about your appointment tomorrow at ten.", '내일 10시 예약 때문에 전화드렸어요.', { seg: 1 }],
      ['S', "Unfortunately, Dr. Patel has to attend a conference, so she won't be in the office tomorrow morning.", '안타깝게도 파텔 선생님이 학회에 가셔야 해서 내일 오전에는 진료실에 안 계세요.', { seg: 2 }],
      ['S', 'Could you call us back to choose a new time? We have openings on Thursday afternoon.', '다시 전화 주셔서 새 시간을 골라 주시겠어요? 목요일 오후에 빈 시간이 있어요.', { seg: 3 }],
      ['S', "Our number is 555-0148, and we're open until six today. Thank you.", '저희 번호는 555-0148이고, 오늘은 6시까지 열어요. 감사합니다.', { seg: 4 }],
    ],
    qs: [
      { type: 'place', who: 'S', q: 'Where does the speaker most likely work?', ko: '화자는 어디에서 일할 것 같나요?', kw: ['Where', 'the speaker', 'work'], ev: 0,
        clues: [['Dental Clinic', 0], ['appointment', 1], ['Dr. Patel', 2]], sum: '치과(진료소)',
        opts: [
          ['At a medical office', 'para', '병원(진료소)'],
          ['At a conference center', 'repeat', '회의장', { w: 'conference', ln: 2, note: '학회는 의사가 가는 곳이에요.' }],
          ['At a travel agency', 'none', '여행사'],
          ['At a phone company', 'none', '전화 회사'],
        ] },
      { type: 'topic', who: 'S', q: 'Why is the speaker calling?', ko: '화자는 왜 전화하나요?', kw: ['Why', 'calling'], ev: 1, sig: "I'm calling about",
        opts: [
          ['To confirm a payment', 'none', '결제를 확인하려고'],
          ['To reschedule an appointment', 'para', '예약 시간을 바꾸려고', { pp: [['your appointment tomorrow', 'an appointment'], ['choose a new time', 'reschedule', 3]] }],
          ['To announce new opening hours', 'repeat', '새 영업시간을 알리려고', { w: 'open', ln: 4, note: '6시까지 연다는 말은 연락할 때 참고하라는 말이에요.' }],
          ['To recommend a different dentist', 'none', '다른 치과 의사를 추천하려고'],
        ] },
      { type: 'request', who: 'S', q: 'What is the listener asked to do?', ko: '청자는 무엇을 하라고 요청받나요?', kw: ['listener', 'asked to do'], ev: 3, sig: 'Could you',
        opts: [
          ['Arrive before ten', 'repeat', '10시 전에 도착한다', { w: 'ten', ln: 1, note: '10시는 원래 예약 시간이에요.' }],
          ['Visit on Thursday morning', 'contra', '목요일 오전에 온다', { ln: 3, t: 'Thursday afternoon', note: '빈 시간은 목요일 오후예요.' }],
          ['Return a phone call', 'para', '다시 전화한다', { pp: [['call us back', 'Return a phone call']] }],
          ['Attend a conference', 'speaker', '학회에 참석한다', { ln: 2, note: '학회에 가는 사람은 파텔 선생님이에요.' }],
        ] },
    ],
  });
  // Part 4 담화의 흐름 (영상 08장, 직접 해 보기)
  LT.TALKS = [
    { k: 'voicemail', name: '음성 메시지', en: 'voicemail', steps: ['인사 · 이름', '전화한 까닭', '문제 · 부탁', '연락 방법'], ex: "Hi, this is … · I'm calling about …" },
    { k: 'announce', name: '안내 방송', en: 'announcement', steps: ['Attention, …', '바뀐 일', '까닭', '할 일'], ex: 'Attention, passengers. … has been delayed …' },
    { k: 'ad', name: '광고', en: 'advertisement', steps: ['질문으로 끌기', '상품 · 서비스', '할인 · 혜택', '방문 · 연락'], ex: 'Are you looking for …? · Visit our website …' },
    { k: 'meeting', name: '회의 발췌', en: 'meeting excerpt', steps: ['주제', '소식 · 결과', '계획', '할 일 부탁'], ex: 'I have some news about … · I\'d like each of you to …' },
    { k: 'tour', name: '관광 안내', en: 'tour guide', steps: ['환영 · 소개', '일정', '주의 사항', '출발'], ex: "Welcome to … · I'll be your guide …" },
  ];
  LT.VSEG = ['인사 · 이름', '전화한 까닭', '문제', '부탁', '연락 방법'];

  /* 실전 문제 풀이 (영상 10장) */
  def('help', {
    part: 3, label: P3, title: 'IT 지원팀', spk: { M: ['남자', 'm', 'us'], W: ['여자', 'f', 'au'] },
    lines: [
      ['M', 'Hi, this is Jason from the IT help desk. You sent us a message about your laptop?', '안녕하세요, IT 지원팀의 제이슨이에요. 노트북 때문에 메시지를 보내셨죠?'],
      ['W', "Yes, thanks for calling back. The problem is, it keeps shutting down while I'm working, and I have a client presentation at three.", '네, 다시 전화 주셔서 고마워요. 문제는 일하는 중에 자꾸 꺼진다는 거예요. 그리고 3시에 고객 발표가 있어요.'],
      ['M', "I see. I'm afraid we can't fix it today. We have a lot of repair requests, so we'll have to send it to the manufacturer.", '그렇군요. 죄송하지만 오늘은 고칠 수 없어요. 수리 요청이 많아서 제조사로 보내야 해요.'],
      ['W', 'Oh, no. All my slides are on that laptop.', '아, 이런. 제 슬라이드가 전부 그 노트북에 있어요.'],
      ['M', "Why don't you borrow one of our spare laptops for the afternoon? I can copy your files onto it.", '오후 동안 저희 여분 노트북을 빌려 쓰시는 건 어때요? 파일은 제가 옮겨 드릴 수 있어요.'],
      ['W', "That would be perfect. I'll bring my laptop down to your office right now.", '그러면 딱 좋겠어요. 지금 바로 노트북을 그쪽 사무실로 가져갈게요.'],
    ],
    qs: [
      { type: 'problem', who: 'W', q: 'What problem does the woman mention?', ko: '여자는 어떤 문제를 말하나요?', kw: ['problem', 'the woman'], ev: 1, sig: 'The problem is',
        opts: [
          ['There are too many repair requests.', 'speaker', '수리 요청이 너무 많다.', { ln: 2, note: '수리 요청 이야기는 남자가 했어요.' }],
          ['Her computer keeps turning off.', 'para', '컴퓨터가 자꾸 꺼진다.', { pp: [['keeps shutting down', 'keeps turning off'], ['laptop', 'computer', 0]] }],
          ['Her office phone is not working.', 'none', '사무실 전화가 안 된다.'],
          ['Her slides contain some errors.', 'repeat', '슬라이드에 오류가 있다.', { w: 'slides', ln: 3 }],
        ] },
      { type: 'request', who: 'M', q: 'What does the man suggest the woman do?', ko: '남자는 여자에게 무엇을 하라고 제안하나요?', kw: ['the man', 'suggest'], ev: 4, sig: "Why don't you",
        opts: [
          ['Contact the manufacturer', 'repeat', '제조사에 연락한다', { w: 'manufacturer', ln: 2, note: '제조사로 보내는 일은 지원팀이 해요.' }],
          ['Postpone her presentation', 'none', '발표를 미룬다'],
          ['Use a temporary device', 'para', '임시 기기를 쓴다', { pp: [['borrow one of our spare laptops', 'Use a temporary device']] }],
          ['Send a message to the help desk', 'time', '지원팀에 메시지를 보낸다', { ln: 0, t: 'You sent us a message', when: 'past' }],
        ] },
      { type: 'next', who: 'W', q: 'What will the woman most likely do next?', ko: '여자는 다음에 무엇을 할 것 같나요?', kw: ['the woman', 'next'], ev: 5, sig: "I'll",
        opts: [
          ['Copy some files', 'speaker', '파일을 옮긴다', { ln: 4, note: '파일은 남자가 옮겨 주겠다고 했어요.' }],
          ['Buy a new laptop', 'none', '새 노트북을 산다'],
          ['Call a client', 'repeat', '고객에게 전화한다', { w: 'client', ln: 1 }],
          ['Go to the help desk', 'para', '지원팀으로 간다', { pp: [['bring my laptop down to your office', 'Go to the help desk']] }],
        ] },
    ],
  });

  /* ---------- 연습 문제: 다섯 세트 × 세 문제 ---------- */
  def('car', {
    part: 3, label: P3, title: '렌터카', spk: { W: ['여자', 'f', 'au'], M: ['남자', 'm', 'us'] },
    lines: [
      ['W', 'Hi, I have a reservation for a compact car. The name is Laura Chen.', '안녕하세요, 소형차를 예약했어요. 이름은 로라 첸이에요.'],
      ['M', "Welcome, Ms. Chen. Hmm, I'm afraid all of our compact cars are out right now. A flight was delayed, so several customers haven't returned theirs yet.", '어서 오세요, 첸 씨. 음, 죄송하지만 지금 소형차가 모두 나가 있어요. 항공편이 늦어져서 여러 손님이 아직 차를 반납하지 않으셨거든요.'],
      ['W', "Oh, no. I have a meeting downtown at five, so I can't wait.", '아, 이런. 5시에 시내에서 회의가 있어서 기다릴 수 없어요.'],
      ['M', "I understand. Why don't you take one of our larger models? There's no extra charge.", '알겠습니다. 저희 큰 차 가운데 하나를 가져가시는 건 어떠세요? 추가 요금은 없어요.'],
      ['W', "That's very kind of you. Here's my driver's license.", '정말 친절하시네요. 여기 제 운전면허증이에요.'],
      ['M', "Thank you. Let me get the keys, and I'll walk you to the car.", '감사합니다. 열쇠를 가져와서 차까지 모셔다드릴게요.'],
    ],
    qs: [
      { type: 'place', who: null, q: 'Where most likely are the speakers?', ko: '화자들은 어디에 있을 것 같나요?', kw: ['Where', 'most likely'], ev: 0,
        clues: [['reservation for a compact car', 0], ['returned', 1], ['larger models', 3], ["driver's license", 4], ['keys', 5]], sum: '렌터카 회사',
        opts: [
          ['At a travel agency', 'none', '여행사', { note: '항공편(flight)이 들렸다고 여행사를 고르면 안 돼요. 항공편은 차가 늦게 돌아온 까닭일 뿐이에요.' }],
          ['At a car rental agency', 'para', '렌터카 회사'],
          ['At an auto repair shop', 'none', '자동차 정비소', { note: '고친다는 말은 없어요.' }],
          ['At a hotel front desk', 'none', '호텔 프런트', { note: '예약(reservation)은 들렸지만 호텔 이야기는 없어요.' }],
        ] },
      { type: 'problem', who: 'M', q: 'What problem does the man mention?', ko: '남자는 어떤 문제를 말하나요?', kw: ['problem', 'the man'], ev: 1, sig: "I'm afraid",
        opts: [
          ['A flight has been canceled.', 'contra', '항공편이 취소되었다.', { ln: 1, t: 'A flight was delayed', note: '취소가 아니라 늦어졌어요.' }],
          ['A reservation cannot be found.', 'repeat', '예약을 찾을 수 없다.', { w: 'reservation', ln: 0, note: '남자는 이름을 듣고 바로 맞아요(Welcome, Ms. Chen).' }],
          ['A meeting has been moved.', 'speaker', '회의가 옮겨졌다.', { ln: 2, note: '회의는 여자의 일정이고, 옮겨졌다는 말도 없어요.' }],
          ['The requested vehicles are unavailable.', 'para', '요청한 차종을 쓸 수 없다.', { pp: [['all of our compact cars are out', 'The requested vehicles are unavailable']] }],
        ] },
      { type: 'request', who: 'M', q: 'What does the man suggest?', ko: '남자는 무엇을 제안하나요?', kw: ['the man', 'suggest'], ev: 3, sig: "Why don't you",
        opts: [
          ['Choosing a bigger vehicle', 'para', '더 큰 차를 고르는 것', { pp: [['take one of our larger models', 'Choosing a bigger vehicle']] }],
          ['Waiting for a delayed flight', 'repeat', '늦어진 항공편을 기다리는 것', { w: 'delayed', ln: 1 }],
          ['Paying an extra charge', 'contra', '추가 요금을 내는 것', { ln: 3, t: "There's no extra charge", note: '추가 요금은 없다고 했어요.' }],
          ['Using a shuttle bus', 'none', '셔틀버스를 타는 것'],
        ] },
    ],
  });
  def('move', {
    part: 3, label: P3T, title: '사무실 이사', spk: { M1: ['남자 1', 'm', 'us'], W: ['여자', 'f', 'gb'], M2: ['남자 2', 'm', 'au'] },
    names: { Tom: 'm', Sora: 'f', Mark: 'm' }, truth: { M1: 'Tom', W: 'Sora', M2: 'Mark' },
    lines: [
      ['M1', 'Sora, Mark, have you seen the schedule for the office move?', '소라, 마크, 사무실 이사 일정 봤어요?', { to: ['Sora', 'Mark'] }],
      ['W', 'Yes. The movers are coming on Saturday, so we have to pack our desks by Friday afternoon.', '네. 이삿짐 업체가 토요일에 와서 금요일 오후까지 책상을 다 싸야 해요.'],
      ['M2', "Friday afternoon? I'll be visiting clients all day on Friday.", '금요일 오후요? 저는 금요일에 하루 종일 고객을 방문해요.'],
      ['W', "Don't worry. I'll be here all week.", '걱정 마세요. 저는 이번 주 내내 여기 있어요.'],
      ['M2', "Really? That would be a huge help. I'll label my boxes before I leave on Thursday.", '정말요? 큰 도움이 되겠어요. 목요일에 나가기 전에 상자에 이름표를 붙여 둘게요.'],
      ['M1', 'And Mark, could you return the projector to the storage room before you go?', '그리고 마크, 가기 전에 프로젝터를 창고에 갖다 놓아 줄래요?', { to: 'Mark' }],
      ['M2', "Sure. I'll take care of it on Thursday.", '그럼요. 목요일에 처리할게요.'],
    ],
    qs: [
      { type: 'topic', who: null, q: 'What are the speakers mainly discussing?', ko: '화자들은 주로 무엇을 이야기하나요?', kw: ['mainly discussing'], ev: 0, sig: 'have you seen the schedule',
        opts: [
          ['Moving to a new office', 'para', '새 사무실로 옮기는 일', { pp: [['the office move', 'Moving to a new office']] }],
          ['Visiting some clients', 'repeat', '고객을 방문하는 일', { w: 'clients', ln: 2, note: '고객 방문은 한 사람의 금요일 일정일 뿐이에요.' }],
          ['Choosing a moving company', 'none', '이삿짐 업체를 고르는 일', { note: '업체는 이미 정해져 토요일에 와요.' }],
          ['Planning a holiday party', 'none', '연말 파티를 계획하는 일'],
        ] },
      { type: 'intent', who: 'W', q: `Why does the woman say, "I'll be here all week"?`, ko: '여자는 왜 "I\'ll be here all week"라고 말하나요?', kw: ['the woman', 'Why', 'say'], ev: 2, ql: 3, ctx: [2, 4], quote: "I'll be here all week.",
        opts: [
          ['To complain about her schedule', 'none', '자기 일정에 불평하려고'],
          ['To offer to help a coworker', 'para', '동료를 도와주겠다고 하려고', { pp: [["I'll be visiting clients all day on Friday", 'a coworker'], ['That would be a huge help', 'help', 4]], mean: '내가 대신 챙겨 줄게요 → 도와주겠다는 제안' }],
          ['To ask for time off on Friday', 'contra', '금요일에 휴가를 내려고', { ln: 3, t: "I'll be here all week", note: '쉬는 게 아니라 이번 주 내내 있어요.' }],
          ['To explain where the office is', 'repeat', '사무실이 어디 있는지 설명하려고', { w: 'here', ln: 3, note: 'here를 ‘장소’로만 옮긴 보기예요.' }],
        ] },
      { type: 'request', who: 'M1', q: 'What does Tom ask Mark to do?', ko: '톰은 마크에게 무엇을 해 달라고 하나요?', kw: ['Tom', 'Mark', 'ask'], ev: 5, sig: 'could you', name: true,
        opts: [
          ['Label some boxes', 'speaker', '상자에 이름표를 붙인다', { ln: 4, note: '이름표는 Mark가 스스로 하겠다고 한 일이에요.' }],
          ['Pack a desk on Saturday', 'time', '토요일에 책상을 싼다', { ln: 1, t: 'by Friday afternoon', when: 'other', note: '토요일은 이삿짐 업체가 오는 날, 책상은 금요일까지예요.' }],
          ['Put some equipment away', 'para', '장비를 제자리에 갖다 둔다', { pp: [['return the projector to the storage room', 'Put some equipment away']] }],
          ['Meet the movers', 'none', '이삿짐 업체 사람들을 맞는다'],
        ] },
    ],
  });
  def('workshop', {
    part: 3, label: P3G, title: '교육 워크숍 신청', spk: { W: ['여자', 'f', 'us'], M: ['남자', 'm', 'gb'] }, G: 'training',
    lines: [
      ['W', 'Ben, have you signed up for one of the training workshops on Monday?', '벤, 월요일 교육 워크숍 가운데 하나 신청했어요?'],
      ['M', "Not yet. I'm meeting a client in the morning, so it has to be in the afternoon.", '아직이요. 오전에 고객을 만나서 오후 것이어야 해요.'],
      ['W', "How about Customer Service? I heard it's really good.", '고객 서비스는 어때요? 아주 좋다고 들었어요.'],
      ['M', 'It sounds interesting, but it runs until five, and I have to leave at four-thirty on Mondays.', '재미있겠지만 5시까지 하는데, 저는 월요일마다 4시 반에 나가야 해요.'],
      ['W', 'Then take the one right after lunch. I took it last year, and it really helped me organize my day.', '그럼 점심 바로 다음 것을 들으세요. 작년에 들었는데 하루를 정리하는 데 정말 도움이 됐어요.'],
      ['M', "OK, I'll sign up for that one. Could you send me the link to the registration page?", '좋아요, 그걸 신청할게요. 신청 페이지 링크 좀 보내 줄래요?'],
      ['W', "Sure. I'll forward it to you right now.", '그럼요. 지금 바로 전달할게요.'],
    ],
    qs: [
      { type: 'detail', who: 'M', q: "Why can't the man attend a morning workshop?", ko: '남자는 왜 오전 워크숍에 갈 수 없나요?', kw: ['Why', 'the man', 'morning'], ev: 1, sig: "I'm meeting a client in the morning",
        opts: [
          ['He has to leave work early.', 'time', '일찍 퇴근해야 한다.', { ln: 3, t: 'leave at four-thirty', when: 'other', note: '4시 반에 나가는 것은 오후 이야기예요. 문제는 오전을 물어요.' }],
          ['He already took the workshop.', 'speaker', '이미 그 워크숍을 들었다.', { ln: 4, note: '작년에 들은 사람은 여자예요.' }],
          ['He has a business appointment.', 'para', '업무 약속이 있다.', { pp: [['meeting a client', 'a business appointment']] }],
          ['His workshop was canceled.', 'none', '그의 워크숍이 취소되었다.'],
        ] },
      { type: 'graphic', who: 'M', q: 'Look at the graphic. Which room will the man go to on Monday?', ko: '그림을 보세요. 남자는 월요일에 어느 방으로 갈까요?', kw: ['Look at the graphic', 'Which room'], ev: 4, sig: 'right after lunch',
        look: { after: 'Lunch', col: 'Room' },
        opts: [
          ['Room B', 'contra', 'B실', { ln: 1, t: 'it has to be in the afternoon', note: 'B실은 11시, 오전 강좌예요.' }],
          ['Cafeteria', 'graphic', '구내식당', { ln: 4, w: 'lunch', note: '들린 lunch의 줄 → 점심 장소일 뿐이에요.' }],
          ['Room C', 'para', 'C실', { pp: [['the one right after lunch', 'Room C']] }],
          ['Room D', 'graphic', 'D실', { ln: 3, note: 'D실 → Customer Service 줄이에요. 5시까지라 안 된다고 했어요.' }],
        ] },
      { type: 'next', who: 'W', q: 'What will the woman most likely do next?', ko: '여자는 다음에 무엇을 할 것 같나요?', kw: ['the woman', 'next'], ev: 6, sig: "I'll",
        opts: [
          ['Share a web link', 'para', '웹 링크를 공유한다', { pp: [["I'll forward it", 'Share'], ['the link', 'a web link', 5]] }],
          ['Organize her day', 'repeat', '하루 일정을 정리한다', { w: 'organize', ln: 4 }],
          ['Sign up for a workshop', 'speaker', '워크숍을 신청한다', { ln: 5, note: '신청은 남자가 할 일이에요.' }],
          ['Print a schedule', 'none', '일정표를 인쇄한다'],
        ] },
    ],
  });
  def('survey', {
    part: 4, label: 'Part 4 · 회의 발췌', title: '고객 설문 결과', talk: 'meeting', spk: { S: ['화자', 'f', 'au'] },
    lines: [
      ['S', 'Good morning, everyone. Before we start, I have some news about our customer survey.', '좋은 아침이에요, 여러분. 시작하기 전에 고객 설문 조사 소식이 있어요.'],
      ['S', "Last month, more than two thousand customers filled it out. That's twice as many as last year.", '지난달 2천 명이 넘는 고객이 설문지를 작성했어요. 작년의 두 배예요.'],
      ['S', 'Most of them were happy with our delivery times, but many said our mobile app is hard to use.', '대부분 배송 시간에는 만족했지만, 많은 분이 모바일 앱을 쓰기 어렵다고 했어요.'],
      ['S', "So we've hired a design firm to improve it, and their team will visit us on Wednesday.", '그래서 앱을 개선하려고 디자인 회사를 고용했고, 그 회사 팀이 수요일에 방문해요.'],
      ['S', "I'd like each team leader to meet with them and share your customers' comments.", '팀장님들은 각자 그 팀을 만나서 고객 의견을 전해 주세요.'],
      ['S', "Now, let's move on to this month's sales figures.", '자, 이제 이번 달 매출 수치로 넘어갈게요.'],
    ],
    qs: [
      { type: 'topic', who: 'S', q: 'What is the speaker mainly talking about?', ko: '화자는 주로 무엇에 대해 말하나요?', kw: ['mainly talking about'], ev: 0, sig: 'I have some news about',
        opts: [
          ["This month's sales figures", 'time', '이번 달 매출 수치', { ln: 5, t: "let's move on to this month's sales figures", when: 'later', note: '매출은 이 이야기 다음에 넘어갈 주제예요.' }],
          ['The results of a survey', 'para', '설문 조사 결과', { pp: [['news about our customer survey', 'The results of a survey']] }],
          ['A delivery company', 'repeat', '배송 회사', { w: 'delivery', ln: 2 }],
          ['A job opening', 'none', '채용 공고'],
        ] },
      { type: 'intent', who: 'S', q: `Why does the speaker say, "That's twice as many as last year"?`, ko: '화자는 왜 "That\'s twice as many as last year"라고 말하나요?', kw: ['Why', 'the speaker', 'say'], ev: 1, ql: 1, ctx: [1, 1], quote: "That's twice as many as last year.",
        opts: [
          ['To correct an error in a report', 'none', '보고서의 오류를 바로잡으려고'],
          ['To suggest hiring more staff', 'none', '직원을 더 뽑자고 하려고'],
          ['To point out that more people responded', 'para', '응답한 사람이 늘었다는 점을 짚으려고', { pp: [['more than two thousand customers filled it out', 'more people responded']], mean: '작년보다 훨씬 많이 참여했다 → 응답이 늘었다는 점을 강조' }],
          ['To say the survey was given twice', 'repeat', '설문을 두 번 했다고 말하려고', { w: 'twice', ln: 1, note: 'twice를 ‘두 번 했다’로 옮긴 보기예요.' }],
        ] },
      { type: 'request', who: 'S', q: 'What are team leaders asked to do?', ko: '팀장들은 무엇을 하라고 요청받나요?', kw: ['team leaders', 'asked to do'], ev: 4, sig: "I'd like each team leader to",
        opts: [
          ['Improve a mobile app', 'speaker', '모바일 앱을 개선한다', { ln: 3, note: '앱을 고치는 쪽은 디자인 회사예요.' }],
          ['Fill out a survey', 'repeat', '설문지를 작성한다', { w: 'fill', ln: 1, note: '설문지를 낸 사람은 고객이에요.' }],
          ['Visit a design firm', 'contra', '디자인 회사를 방문한다', { ln: 3, t: 'their team will visit us', note: '그 회사 팀이 우리 쪽으로 와요.' }],
          ['Talk with some designers', 'para', '디자이너들과 이야기한다', { pp: [['meet with them', 'Talk with'], ['a design firm', 'some designers', 3]] }],
        ] },
    ],
  });
  def('boat', {
    part: 4, label: 'Part 4 · 관광 안내', title: '유람선 관광', talk: 'tour', spk: { S: ['화자', 'm', 'us'] },
    lines: [
      ['S', "Welcome aboard the Riverside Boat Tour. My name is Paolo, and I'll be your guide this afternoon.", '리버사이드 보트 투어에 오신 것을 환영해요. 저는 파올로이고, 오늘 오후 여러분의 가이드예요.'],
      ['S', "Our trip will take about ninety minutes, and we'll pass under six of the city's famous bridges.", '여행은 90분쯤 걸리고, 이 도시의 유명한 다리 여섯 개 아래를 지나가요.'],
      ['S', "Halfway through the tour, we'll stop at Lantern Island, where you can buy snacks and souvenirs.", '투어 중간에 랜턴섬에 들르는데, 그곳에서 간식과 기념품을 살 수 있어요.'],
      ['S', "Please keep your tickets with you. You'll need to show them to get back on the boat.", '표는 꼭 가지고 계세요. 배에 다시 탈 때 보여 주셔야 해요.'],
      ['S', "All right, we're about to leave, so please take your seats.", '자, 곧 출발하니 자리에 앉아 주세요.'],
    ],
    qs: [
      { type: 'place', who: null, q: 'Who most likely are the listeners?', ko: '청자는 누구일 것 같나요?', kw: ['Who', 'most likely', 'listeners'], ev: 0,
        clues: [['Welcome aboard', 0], ['Boat Tour', 0], ['your guide', 0], ['Our trip', 1], ['famous bridges', 1]], sum: '관광객(유람선 승객)',
        opts: [
          ['People on a sightseeing cruise', 'para', '관광 유람선 승객'],
          ['Bridge engineers', 'repeat', '다리 기술자', { w: 'bridge', ln: 1 }],
          ['Shop owners', 'none', '가게 주인', { note: '간식·기념품을 살 수 있다고 했을 뿐이에요.' }],
          ['Boat crew members', 'repeat', '배 승무원', { w: 'Boat', ln: 0, note: '승무원에게 하는 인사가 아니라 손님에게 하는 인사예요.' }],
        ] },
      { type: 'detail', who: 'S', q: 'What will happen halfway through the tour?', ko: '투어 중간에 무슨 일이 있나요?', kw: ['halfway through the tour'], ev: 2, sig: 'Halfway through the tour',
        opts: [
          ['A meal will be served.', 'contra', '식사가 나온다.', { ln: 2, t: 'you can buy snacks', note: '간식은 직접 사요.' }],
          ['The boat will make a stop.', 'para', '배가 한 곳에 들른다.', { pp: [["we'll stop at Lantern Island", 'The boat will make a stop']] }],
          ['The tour will end.', 'contra', '투어가 끝난다.', { ln: 1, t: 'about ninety minutes', note: '중간이라 끝나는 때가 아니에요.' }],
          ['A guide will be introduced.', 'time', '가이드가 소개된다.', { ln: 0, t: 'My name is Paolo', when: 'past' }],
        ] },
      { type: 'request', who: 'S', q: 'Why are the listeners asked to keep their tickets?', ko: '청자는 왜 표를 가지고 있으라고 요청받나요?', kw: ['Why', 'keep their tickets'], ev: 3, sig: 'Please keep',
        opts: [
          ['To get a discount on souvenirs', 'repeat', '기념품을 할인받으려고', { w: 'souvenirs', ln: 2 }],
          ['To enter a museum', 'none', '박물관에 들어가려고'],
          ['To take seats in the front', 'repeat', '앞쪽 자리에 앉으려고', { w: 'seats', ln: 4 }],
          ['To board again after a stop', 'para', '들른 뒤 다시 타려고', { pp: [['to get back on the boat', 'To board again after a stop']] }],
        ] },
    ],
  });
  // 퀴즈 그림 문제: 세 사람 대화 네 줄 (Kenji가 한 줄 고르기)
  def('quizthree', {
    part: 3, label: P3T, title: '고장 난 프린터', spk: { W: ['여자', 'f', 'us'], M1: ['남자 1', 'm', 'gb'], M2: ['남자 2', 'm', 'au'] },
    names: { Kenji: 'm', Raj: 'm' }, truth: { M1: 'Kenji', M2: 'Raj' },
    lines: [
      ['W', 'Kenji, Raj, the printer on our floor is broken again.', '켄지, 라지, 우리 층 프린터가 또 고장 났어요.', { to: ['Kenji', 'Raj'] }],
      ['M1', 'I can call the repair company right now.', '제가 지금 바로 수리 업체에 전화할게요.'],
      ['W', 'Thanks. And Raj, could you print the handouts downstairs?', '고마워요. 그리고 라지, 유인물은 아래층에서 뽑아 줄래요?', { to: 'Raj' }],
      ['M2', "Sure. I'll go down after lunch.", '그럼요. 점심 먹고 내려갈게요.'],
    ],
    qs: [],
  });
  // 09장 직접 해 보기: 함정 갈래마다 예로 쓸 보기 [세트, 문제, 보기]
  LT.TRAPEX = { speaker: ['help', 0, 0], time: ['help', 1, 3], none: ['help', 0, 2], contra: ['car', 1, 0], repeat: ['hotel', 1, 1], graphic: ['map', 1, 2] };
  LT.DRILL = ['car', 'move', 'workshop', 'survey', 'boat'];
  LT.PG = ['hotel', 'map', 'team', 'dental'];

  /* ---------- 도우미 ---------- */
  LT.set = id => SETS[id];
  LT.spkLabel = (S, key) => S.spk[key] ? S.spk[key][0] : key;
  // 세 사람 대화의 이름 알아내기: ① 한 사람만 부른 말 다음에 다른 사람이 말하면 그 사람 ② 남은 이름은 성별로 하나씩
  LT.names = function (S) {
    if (!S.names) return {};
    const map = {}, L = S.lines;
    L.forEach((l, i) => { if (typeof l.to === 'string' && L[i + 1] && L[i + 1].s !== l.s && !map[L[i + 1].s]) map[L[i + 1].s] = l.to; });
    ['m', 'f'].forEach(g => {
      const names = Object.keys(S.names).filter(n => S.names[n] === g && !Object.values(map).includes(n));
      const keys = Object.keys(S.spk).filter(k => S.spk[k][1] === g && !map[k]);
      if (names.length === 1 && keys.length === 1) map[keys[0]] = names[0];
    });
    return map;
  };
  LT.who = (S, key, named) => { const n = named ? LT.names(S)[key] : null; return LT.spkLabel(S, key) + (n ? ` · ${n}` : ''); };
  // 줄 i가 대화의 어디쯤인지 (앞부분 · 가운데 · 끝부분)
  LT.part = (S, i) => { const r = i / Math.max(1, S.lines.length - 1); return r <= 1 / 3 ? 'first' : r >= 2 / 3 ? 'last' : 'middle'; };
  LT.PARTN = { first: '앞부분', middle: '가운데', last: '끝부분' };
  LT.evLines = q => q.type === 'place' ? [...new Set(q.clues.map(c => c[1]))] : q.type === 'intent' ? [...new Set(q.ctx.concat(q.ql))] : [q.ev];
  // 받침에 맞는 조사 (을/를): 괄호로 끝나면 괄호 앞 글자로 봄
  const josa = (w, a, b) => { const c = String(w).replace(/\)$/, '').replace(/\([^)]*$/, '').slice(-1).charCodeAt(0); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b); };
  LT.josa = josa;
  const quoteLine = (S, i, named = true) => `줄 ${i + 1} (${LT.who(S, S.lines[i].s, named)}) “${S.lines[i].t}”`;

  /* ---------- 규칙 엔진 ---------- */
  LT.judge = function (S, qi, k) {
    const q = S.qs[qi], o = q.opts[k], x = o.x, R = LT.REL[o.rel];
    const res = (why, line) => ({ s: o.rel === 'para' ? 'ok' : 'no', step: R.step, rel: o.rel, why, line: line == null ? (x.ln == null ? q.ev : x.ln) : line });
    const note = x.note ? ' ' + x.note : '';
    const asked = q.who ? LT.who(S, q.who, true) : '화자들';
    switch (o.rel) {
      case 'para':
        if (q.type === 'place') return res(`단서 낱말 → ${q.clues.map(c => c[0]).join(' · ')}. 모두 ${q.sum}에서 나올 말이에요. 낱말 하나가 아니라 여럿이 같은 곳을 가리켜요.`, q.ev);
        if (q.type === 'graphic') { const G = LT.G[S.G]; return res(`들은 말 → “${x.pp[0][0]}” (${quoteLine(S, q.ev).split(' “')[0]}). ${LT.explainLook(G, q.look)}. 들은 말과 그림을 합쳐야 답이 나와요.`, q.ev); }
        if (q.type === 'intent') return res(`앞뒤 줄이 뜻을 정해요 → ${q.ctx.filter((v, i, a) => a.indexOf(v) === i).map(i => quoteLine(S, i)).join(' · ')}. 따옴표 문장의 뜻 = ${x.mean}.`, q.ctx[0]);
        return res(`근거 → ${quoteLine(S, q.ev)}. 바꿔 말하기: ${x.pp.map(p => `${p[0]} = ${p[1]}`).join(' · ')}.`, q.ev);
      case 'speaker': return res(`${quoteLine(S, x.ln)} → 문제가 묻는 사람과 다른 사람의 말이나 일이에요. 문제가 묻는 사람 → ${asked}.${note}`);
      case 'time': {
        const when = x.when === 'past' ? '이미 한 일' : x.when === 'later' ? '나중 일' : '다른 때의 일';
        return res(`줄 ${x.ln + 1}의 ${x.t} → ${when}이에요. 문제의 키워드(${q.kw.join(' · ')})와 때가 맞지 않아요.${note}`);
      }
      case 'none': return res(`대화에 나오지 않은 내용이에요.${note}`, q.ev);
      case 'contra': return res(`줄 ${x.ln + 1}의 ${x.t} → 보기와 반대예요.${note}`);
      case 'repeat': return res(`줄 ${x.ln + 1}에서 ${x.w} → 그대로 들렸지만 뜻이 달라요. 그대로 들린 낱말은 의심!${note}`);
      case 'graphic': { const G = LT.G[S.G]; return res(`${x.note} ${LT.explainLook(G, q.look)}.`); }
    }
    return res('', q.ev);
  };
  LT.kindName = rel => LT.REL[rel].name;

  // 3단계 풀이 (연습 문제 힌트 · 실전 문제). marks: { q: 문제 속 키워드, lines: { 줄: [{ t, role }] } }, reveal: 대본에서 보여 줄 줄
  LT.steps = function (S, qi) {
    const q = S.qs[qi], T = LT.TYPES[q.type];
    const out = step => q.opts.map((o, k) => [k, LT.judge(S, qi, k)]).filter(([, j]) => j.step === step).map(([k]) => `(${L4[k]}) ${q.opts[k].t.replace(/\.$/, '')}`);
    const drop = list => list.length ? ` 탈락: ${list.join(' · ')}.` : '';
    const fix = s => s.replace(/([.?!])\.(?=\s|$)/g, '$1');
    const lm = {}; const add = (i, t, role) => { if (i == null || !t) return; (lm[i] = lm[i] || []).push({ t, role }); };
    // ①
    const t1 = `키워드 → ${q.kw.join(' · ')}. ${T.name} 문제 → ${T.where}${q.name ? ' 이름이 나오면 이름을 부르는 말로 누가 누구인지 확인해요.' : ''}`;
    // ②
    let t2, reveal;
    if (q.type === 'place') {
      q.clues.forEach(([t, i]) => add(i, t, 'cue'));
      reveal = LT.evLines(q);
      t2 = `단서 낱말을 모아요 → ${q.clues.map(c => c[0]).join(' · ')}.`;
    } else if (q.type === 'intent') {
      q.ctx.forEach(i => add(i, S.lines[i].t.replace(/[.?!]$/, ''), 'ctx')); add(q.ql, (q.quote || S.quote).replace(/[.?!]$/, ''), 'ans');
      reveal = LT.evLines(q);
      t2 = `따옴표 문장 앞뒤를 들어요 → ${q.ctx.filter((v, i, a) => a.indexOf(v) === i).map(i => quoteLine(S, i)).join(' · ')}.`;
    } else {
      add(q.ev, q.sig, 'cue'); reveal = [q.ev];
      t2 = `${q.type === 'graphic' ? '그림에 없는 쪽의 말' : '신호어'} → ${q.sig}. 근거 → ${quoteLine(S, q.ev)}.`;
    }
    // ③
    const a = q.opts[q.a], ax = a.x;
    let t3;
    if (q.type === 'place') t3 = `여러 단서가 모두 ${josa(q.sum, '을', '를')} 가리켜요.`;
    else if (q.type === 'graphic') t3 = `${LT.explainLook(LT.G[S.G], q.look)}.`;
    else if (q.type === 'intent') t3 = `뜻 = ${ax.mean}.`;
    else t3 = `바꿔 말하기: ${ax.pp.map(p => `${p[0]} = ${p[1]}`).join(' · ')}.`;
    (ax.pp || []).forEach(p => add(p[2] == null ? q.ev : p[2], p[0], 'ans'));
    q.opts.forEach(o => { if (o.rel === 'repeat' && o.x.w) add(o.x.ln, o.x.w, 'trap'); if (o.rel === 'graphic' && o.x.w) add(o.x.ln, o.x.w, 'trap'); });
    const r3 = [...new Set(reveal.concat(Object.keys(lm).map(Number)))];
    return [
      { head: '① 문제를 먼저 읽어요.', text: fix(t1 + drop(out(1))), q: q.kw, lines: {}, reveal: [] },
      { head: '② 신호어를 들어요.', text: fix(t2 + drop(out(2))), q: [], lines: Object.fromEntries(Object.entries(lm).map(([i, m]) => [i, m.filter(z => z.role === 'cue' || z.role === 'ctx')])), reveal },
      { head: '③ 바꿔 말한 보기를 골라요.', text: fix(`${t3}${drop(out(3))} 정답 (${L4[q.a]}) ${a.t}.`), q: [], lines: lm, reveal: r3 },
    ];
  };

  // 놀이터 ‘근거 줄 찾기’: 누른 줄이 이 문제에 어떤 줄인지
  LT.lineRole = function (S, qi, li) {
    const q = S.qs[qi], evs = LT.evLines(q), j = LT.judge(S, qi, q.a);
    if (evs.includes(li)) return { ok: true, why: `근거 줄이에요. ${j.why}` };
    const trap = q.opts.map((o, k) => [o, k]).find(([o]) => o.x.ln === li && o.rel !== 'para');
    if (trap) return { ok: false, trap: trap[1], why: `이 줄은 (${L4[trap[1]]}) ${trap[0].t} → ${LT.kindName(trap[0].rel)} 함정의 출처예요. ${LT.judge(S, qi, trap[1]).why}` };
    const other = S.qs.findIndex((x, k) => k !== qi && LT.evLines(x).includes(li));
    if (other >= 0) return { ok: false, why: `이 줄은 Q${other + 1}의 근거예요. 세 문제는 대화 순서대로 답이 나와요 → Q${qi + 1}의 근거는 이 줄보다 ${other < qi ? '뒤' : '앞'}에 있어요.` };
    return { ok: false, why: `이 줄에는 Q${qi + 1}의 답이 없어요. ${LT.TYPES[q.type].listen}` };
  };

  // 02장 ‘같은 뜻일까?’ — 들은 말과 보기 한 쌍
  LT.PAIRS = [
    { heard: "We're fully booked.", opt: 'There are no vacancies.', rel: 'para', why: 'fully booked = 빈방이 없다. 낱말은 달라도 뜻이 같아요.' },
    { heard: "We're fully booked.", opt: 'She booked a flight.', rel: 'repeat', w: 'booked', why: 'booked가 그대로 들어갔지만 ‘비행기를 예약했다’는 다른 뜻이에요.' },
    { heard: 'The printer is out of order.', opt: 'The machine is not working.', rel: 'para', why: 'out of order = 고장 나서 안 된다 · printer → machine(넓은 말).' },
    { heard: 'The printer is out of order.', opt: 'An order was placed.', rel: 'repeat', w: 'order', why: 'order가 그대로 들어갔지만 ‘주문’이라는 다른 뜻이에요.' },
    { heard: 'Could you call us back?', opt: 'Return a phone call', rel: 'para', why: 'call back = 다시 전화하다 = return a call.' },
    { heard: 'The client moved our deadline up.', opt: 'The client moved to a new office.', rel: 'repeat', w: 'moved', why: 'moved가 그대로 들어갔지만 ‘이사했다’는 다른 뜻이에요.' },
  ];
  LT.judgePair = p => p.rel === 'para' ? { s: 'ok', why: p.why } : { s: 'no', step: 3, why: p.why };

  // 실전 문제·연습 문제용: 정답이 하나인 보기 목록
  LT.okOpts = (S, qi) => S.qs[qi].opts.map((o, k) => LT.judge(S, qi, k).s === 'ok' ? k : -1).filter(k => k >= 0);

  // 연습 문제 항목 (세트 단위)
  LT.drillSets = () => LT.DRILL.map(id => {
    const S = SETS[id];
    return { S, qs: S.qs.map((q, qi) => ({ q, steps: LT.steps(S, qi), notes: q.opts.map((o, k) => { const j = LT.judge(S, qi, k); return `${LT.kindName(o.rel)}. ` + (j.s === 'ok' ? '' : `× (${LT.STEPN[j.step]}에서 탈락) `) + j.why; }) })) };
  });

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  LT.allText = function () {
    const out = [];
    Object.values(SETS).forEach(S => {
      out.push(S.title, S.label, Object.values(S.spk).map(s => s[0]).join(''), Object.keys(S.names || {}).join(''));
      S.lines.forEach(l => out.push(l.t, l.ko));
      S.qs.forEach((q, qi) => { out.push(q.q, q.ko, q.kw.join('')); q.opts.forEach((o, k) => out.push(o.t, o.ko, LT.judge(S, qi, k).why)); LT.steps(S, qi).forEach(s => out.push(s.head, s.text)); });
    });
    Object.values(LT.G).forEach(G => out.push(G.title, G.kind === 'map' ? G.items.map(i => i.name).join('') : G.cols.join('') + G.rows.flat().join('')));
    LT.TALKS.forEach(t => out.push(t.name, t.en, t.steps.join(''), t.ex));
    LT.PAIRS.forEach(p => out.push(p.heard, p.opt, p.why));
    out.push(Object.values(LT.REL).map(r => r.name).join(''), LT.STEPN.join(''), Object.values(LT.TYPES).map(t => t.name + t.where + t.listen).join(''), LT.SIGNALS.join(''), Object.values(LT.SIGTYPE).join(''), LT.VSEG.join(''), Object.values(LT.RELN).join(''));
    return out.join('');
  };

  /* ---------- 데이터 점검 ---------- */
  const has = (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase());
  LT.check = function () {
    const bad = [];
    const pos = [0, 0, 0, 0];
    Object.values(SETS).forEach(S => {
      const w = `세트 ${S.id}`;
      S.qs.forEach((q, qi) => {
        const ww = `${w} Q${qi + 1}`, line = i => S.lines[i] ? S.lines[i].t : null;
        const good = LT.okOpts(S, qi);
        if (good.length !== 1 || good[0] !== q.a) bad.push(`${ww}: 맞는 보기가 ${good.length}개예요`);
        if (q.opts.length !== 4) bad.push(`${ww}: 보기가 넷이 아니에요`);
        if (!line(q.ev)) bad.push(`${ww}: 근거 줄 ${q.ev + 1}이 대본에 없어요`);
        q.kw.forEach(k => { if (!q.q.includes(k)) bad.push(`${ww}: 키워드 ‘${k}’가 문제에 없어요`); });
        if (q.sig && line(q.ev) && !has(line(q.ev), q.sig)) bad.push(`${ww}: 신호어 ‘${q.sig}’가 근거 줄에 없어요`);
        if (['problem', 'request', 'next'].includes(q.type) && LT.signalType(q.sig) !== q.type && !(q.type === 'request' && /^I can/.test(q.sig))) bad.push(`${ww}: 신호어 ‘${q.sig}’가 ${q.type} 문제의 신호어가 아니에요`);
        if (q.type === 'topic' && LT.part(S, q.ev) !== 'first') bad.push(`${ww}: 주제 문제의 근거가 첫 부분이 아니에요`);
        if (q.type === 'next' && LT.part(S, q.ev) !== 'last') bad.push(`${ww}: 다음 할 일 문제의 근거가 끝부분이 아니에요`);
        if (q.who && !S.spk[q.who]) bad.push(`${ww}: 묻는 사람 ${q.who}가 없어요`);
        if (q.name && !q.q.includes(LT.names(S)[q.who])) bad.push(`${ww}: 문제의 이름과 대본에서 알아낸 이름이 달라요`);
        if (q.type === 'place') q.clues.forEach(([t, i]) => { if (!line(i) || !has(line(i), t)) bad.push(`${ww}: 단서 ‘${t}’가 줄 ${i + 1}에 없어요`); });
        if (q.type === 'intent') {
          if (!has(line(q.ql) || '', q.quote || S.quote)) bad.push(`${ww}: 따옴표 문장이 대본 줄 ${q.ql + 1}과 달라요`);
          if (!q.q.includes(String(q.quote || S.quote).replace(/\.$/, ''))) bad.push(`${ww}: 문제 속 따옴표 문장이 대본과 달라요`);
          q.ctx.forEach(i => { if (Math.abs(i - q.ql) > 1) bad.push(`${ww}: 앞뒤 줄 ${i + 1}이 따옴표 문장 옆이 아니에요`); });
        }
        if (q.type === 'graphic') {
          const G = LT.G[S.G], ans = G ? LT.lookup(G, q.look) : null;
          if (!G || ans !== q.opts[q.a].t) bad.push(`${ww}: 그림에서 계산한 답(${ans})과 정답이 달라요`);
          q.opts.forEach(o => { const inG = G && (G.kind === 'map' ? G.items.some(i => i.name === o.t) : G.rows.some(r => r.includes(o.t))); if (!inG) bad.push(`${ww}: 보기 ${o.t}가 그림에 없어요`); });
        }
        q.opts.forEach((o, k) => {
          const x = o.x, wk = `${ww} (${L4[k]})`;
          if (!LT.REL[o.rel]) bad.push(`${wk}: 모르는 관계 ${o.rel}`);
          if (!o.ko || /[A-Za-z]{3,}/.test(o.ko)) bad.push(`${wk}: 해석이 없거나 영어가 섞여 있어요`);
          if (x.ln != null && !line(x.ln)) bad.push(`${wk}: 줄 ${x.ln + 1}이 없어요`);
          if (o.rel === 'para' && x.pp) x.pp.forEach(([h, s, li]) => {
            const L = line(li == null ? q.ev : li);
            if (!L || !has(L, h)) bad.push(`${wk}: 들은 말 ‘${h}’가 대본에 없어요`);
            if (q.type !== 'intent' && !has(o.t, s)) bad.push(`${wk}: 바꾼 말 ‘${s}’가 보기에 없어요`);
          });
          if (o.rel === 'para' && !['place', 'graphic', 'intent'].includes(q.type) && !(x.pp && x.pp.length)) bad.push(`${wk}: 바꿔 말하기 짝이 없어요`);
          if (o.rel === 'repeat' && (!has(line(x.ln) || '', x.w) || !has(o.t, x.w))) bad.push(`${wk}: 그대로 들린 낱말 ‘${x.w}’가 대본 줄이나 보기에 없어요`);
          if (o.rel === 'speaker') { const sp = S.lines[x.ln] && S.lines[x.ln].s; if (q.who && sp === q.who && !x.note) bad.push(`${wk}: 다른 사람의 말인데 같은 사람이 말한 줄이에요`); }
          if (['time', 'contra'].includes(o.rel) && (!x.t || !has(line(x.ln) || '', x.t))) bad.push(`${wk}: 근거 글 ‘${x.t}’가 줄 ${x.ln + 1}에 없어요`);
        });
        if (q.ko && /[가-힣]/.test(q.ko) === false) bad.push(`${ww}: 문제 해석이 없어요`);
        if (LT.DRILL.includes(S.id)) pos[q.a]++;
      });
      // 세 문제의 답은 대화 순서대로
      const evs = S.qs.map(q => q.ev);
      if (evs.some((e, i) => i && e < evs[i - 1])) bad.push(`${w}: 세 문제의 근거 줄이 대화 순서가 아니에요 (${evs.map(e => e + 1).join(', ')})`);
      S.lines.forEach((l, i) => { if (!S.spk[l.s]) bad.push(`${w} 줄 ${i + 1}: 화자 ${l.s}가 없어요`); if (!l.ko || /[A-Za-z]{3,}/.test(l.ko.replace(/IT|USB/g, ''))) bad.push(`${w} 줄 ${i + 1}: 해석이 없거나 영어가 섞여 있어요`); });
      if (S.names) { const m = LT.names(S); Object.keys(S.truth).forEach(k => { if (m[k] !== S.truth[k]) bad.push(`${w}: 대본만으로 ${k} = ${S.truth[k]}을(를) 알 수 없어요 (엔진: ${m[k]})`); }); }
    });
    if (Math.max(...pos) - Math.min(...pos) > 1) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    // 의도 파악 실험: 세 대화의 보기가 같고 정답이 모두 달라야 해요
    const IA = LT.INTENT.map(id => SETS[id].qs[0]);
    if (new Set(IA.map(q => q.a)).size !== IA.length) bad.push('의도 파악 실험: 대화마다 정답이 달라야 해요');
    if (IA.some(q => q.opts.map(o => o.t).join('|') !== IA[0].opts.map(o => o.t).join('|'))) bad.push('의도 파악 실험: 세 대화의 보기가 같지 않아요');
    LT.PAIRS.forEach((p, i) => { if (p.rel === 'repeat' && (!has(p.heard, p.w) || !has(p.opt, p.w))) bad.push(`02장 짝 ${i + 1}: ${p.w}가 두 말에 모두 있어야 해요`); });
    LT.SIGNALS.forEach(s => { if (!LT.signalType(s)) bad.push(`04장 신호어 ${s}: 종류를 알 수 없어요`); });
    Object.entries(LT.TRAPEX).forEach(([r, [id, qi, k]]) => { const o = SETS[id] && SETS[id].qs[qi] && SETS[id].qs[qi].opts[k]; if (!o || o.rel !== r) bad.push(`09장 함정 예 ${r}: 데이터의 관계와 달라요`); });
    bad.forEach(b => console.warn('[듣기 Part 3·4] ' + b));
    return bad;
  };
})();
