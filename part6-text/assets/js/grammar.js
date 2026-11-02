/* Part 6 글 단위 문제 튜토리얼 — 규칙 엔진과 지문
 *
 * 지문(PT.P)은 문장 목록이고, 빈칸은 문장 속 [번호]로 적습니다. 문장 하나가 통째로 [번호]면 '문장 넣기' 빈칸이에요.
 * 빈칸마다 데이터에 적어 두는 것
 *   tense  (글로 정하는 시제, 유형 64): 주어의 수(num) · 태(voice) · 시간 단서(clues: 어느 문장의 어느 말이 언제 일인지 알려 주는지)
 *   link   (접속부사, 유형 65): 앞 문장과 빈칸 문장의 관계(rel) · 그 관계가 보이는 앞 문장의 말(clue)
 *   insert (문장 넣기, 유형 66): 앞 문장이 내놓는 것(prev.has) · 뒤 문장의 가리키는 말이 찾는 것(next.need) · 글의 주제(topic),
 *          보기 문장마다 가리키는 말(ptrs)이 찾는 것, 새로 내놓는 것(gives), 주제, 앞 내용과 어긋나는 점(clash)
 *
 * PT.judge(빈칸, 보기 번호, 보이는 문장)는 3단계 풀이법을 그대로 따라 맞고 틀림과 까닭을 정합니다.
 *   ① 빈칸 문장: 빈칸이 있는 문장만 보고 문법으로 안 되는 보기를 지움 (동사 자리 · 수 · 태, 접속부사 자리)
 *   ② 앞뒤 문장: 단서 문장이 보이면 그 단서로 지움 (시간 · 두 문장의 관계 · 가리키는 말의 짝 · 주제 · 어긋남)
 *   ③ 글 전체: 남은 하나를 글의 흐름(flow)으로 확인
 * '보이는 문장'을 주면 가려진 문장의 단서는 쓰지 않아요(놀이터 '문맥 손전등'). 주지 않으면 글 전체가 보여요.
 * 영상의 ✓·×, 직접 해 보기, 놀이터, 연습 문제의 힌트와 보기별 해설, 퀴즈 일부가 모두 이 함수의 결과를 씁니다.
 * PT.check()는 데이터가 엔진과 어긋나면 콘솔에 경고합니다.
 */
(function () {
  'use strict';
  const PT = (window.PT = {});

  /* ---------- 빈칸 종류 ---------- */
  PT.TYPE = {
    tense: { name: '시제', long: '글로 정하는 시제', no: 64 },
    link: { name: '연결어', long: '접속부사 고르기', no: 65 },
    insert: { name: '문장 넣기', long: '문장 넣기와 가리키는 말', no: 66 },
  };
  PT.STEP = ['① 빈칸 문장', '② 앞뒤 문장', '③ 글 전체'];

  /* ---------- 동사 꼴 읽기 (시제 빈칸 ①단계) ----------
   * 보기 글자를 읽어 시제(t) · 진짜 동사인지(fin) · 태(v) · 주어의 수(n)를 정함
   * t: past 과거 · perfect 현재완료 · pastperf 과거완료 · now 현재진행 · future 미래
   */
  const BE = ['be', 'been', 'being', 'is', 'are', 'am', 'was', 'were'];
  const IRREG = { got: 'got', gotten: 'got', chose: 'chose', chosen: 'chose', sent: 'sent', began: 'began', begun: 'began', made: 'made', given: 'gave', gave: 'gave', taken: 'took', took: 'took', held: 'held', built: 'built', paid: 'paid', sold: 'sold' };
  const isPP = w => /ed$/.test(w) || /en$/.test(w) || IRREG[w] != null;
  PT.verbForm = function (s) {
    const ws = String(s).toLowerCase().split(/\s+/).filter(w => w && w !== 'not');
    if (!ws.length) return null;
    const f = ws[0];
    const passive = ws.some((w, i) => BE.includes(w) && ws[i + 1] && isPP(ws[i + 1]));
    const v = passive ? 'pass' : 'act';
    if (f === 'to' || f === 'being' || f === 'having' || (ws.length === 1 && /ing$/.test(f))) return { fin: false, v };
    const n = ['has', 'is', 'was', 'am'].includes(f) ? 'sg' : ['have', 'are', 'were'].includes(f) ? 'pl' : null;
    let t = null;
    if (f === 'will') t = 'future';
    else if (f === 'has' || f === 'have') t = 'perfect';
    else if (f === 'had') t = 'pastperf';
    else if (['is', 'are', 'am'].includes(f) && ws[1] && /ing$/.test(ws[1])) t = 'now';
    else if (['was', 'were', 'did'].includes(f) || (ws.length === 1 && (/ed$/.test(f) || IRREG[f]))) t = 'past';
    if (!t) return null;
    return { fin: true, t, v, n };
  };
  PT.WHEN = { future: '앞으로 있을 일', past: '이미 끝난 일', perfect: '과거부터 지금까지 이어진 일', now: '지금 하고 있는 일' };
  PT.TSHORT = { future: '미래', past: '과거', perfect: '현재완료', pastperf: '과거완료', now: '현재진행' };
  PT.TIME = { future: '미래(will)', past: '과거', perfect: '현재완료(have p.p.)', pastperf: '과거완료(had p.p.)', now: '현재진행(be -ing)' };
  const NUM = { sg: '하나', pl: '여럿' };
  // 받침이 있으면 '이라서', 없으면 '라서' (괄호 앞 한국어 낱말 기준)
  const raseo = s => { const m = String(s).replace(/\s*\(.*$/, '').match(/[가-힣](?=[^가-힣]*$)/); if (!m) return '라서'; return (m[0].charCodeAt(0) - 0xAC00) % 28 ? '이라서' : '라서'; };
  PT.raseo = raseo;
  // 날짜(월 × 100 + 일)로 언제 일인지: 글을 쓴 날 doc과 일의 기간 [from, to]
  PT.whenByDate = (doc, from, to) => doc < from ? 'future' : doc > (to || from) ? 'past' : 'now';
  PT.dateKo = d => `${Math.floor(d / 100)}월 ${d % 100}일`;
  const MON = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  PT.dateEn = d => `${MON[Math.floor(d / 100)]} ${d % 100}`;

  /* ---------- 연결어 사전 (연결어 빈칸) ----------
   * k: adv 접속부사 · conj 접속사 · prep 전치사.  r: 두 문장의 관계 (접속부사만)
   */
  PT.REL = {
    contrast: { name: '반대', ko: '그러나', desc: '앞과 반대이거나 예상과 다른 내용' },
    add: { name: '더하기', ko: '게다가', desc: '앞과 같은 쪽의 내용을 하나 더' },
    result: { name: '결과', ko: '그래서', desc: '앞 문장이 원인, 빈칸 문장이 결과' },
    example: { name: '예', ko: '예를 들어', desc: '앞 문장의 큰 이야기에 대한 구체적인 예' },
    instead: { name: '대신', ko: '그 대신', desc: '앞에서 안 된다고 한 것 대신 다른 방법' },
    otherwise: { name: '조건', ko: '그렇지 않으면', desc: '앞 문장대로 하지 않으면 생길 일' },
  };
  PT.LINK = {
    however: { k: 'adv', r: 'contrast' }, nevertheless: { k: 'adv', r: 'contrast' },
    'in addition': { k: 'adv', r: 'add' }, moreover: { k: 'adv', r: 'add' }, furthermore: { k: 'adv', r: 'add' },
    therefore: { k: 'adv', r: 'result' }, 'as a result': { k: 'adv', r: 'result' }, consequently: { k: 'adv', r: 'result' },
    'for example': { k: 'adv', r: 'example' }, 'for instance': { k: 'adv', r: 'example' },
    instead: { k: 'adv', r: 'instead' }, otherwise: { k: 'adv', r: 'otherwise' },
    although: { k: 'conj', ko: '~이지만' }, 'even though': { k: 'conj', ko: '~이긴 하지만' }, because: { k: 'conj', ko: '~ 때문에' }, unless: { k: 'conj', ko: '~하지 않으면' },
    despite: { k: 'prep', ko: '~에도 불구하고' }, 'because of': { k: 'prep', ko: '~ 때문에' },
  };
  PT.KIND = { adv: '접속부사', conj: '접속사', prep: '전치사' };
  PT.link = w => PT.LINK[String(w).toLowerCase()];
  // 영상·놀이터에서 쓰는 여섯 관계의 대표 접속부사
  PT.REL_WORDS = { contrast: 'However', add: 'In addition', result: 'As a result', example: 'For example', instead: 'Instead', otherwise: 'Otherwise' };

  /* ---------- 문장 넣기: 가리키는 말이 찾는 것 · 글의 주제 ---------- */
  PT.NEED = {
    door: '문', card: '카드', feature: '비슷한 다른 시설', number: '숫자', date: '날짜', guests: '손님', benefit: '손님이 받는 다른 혜택',
    panels: '패널', companies: '회사들', lamps: '램프', closure: '휴장 소식', 'open-option': '이용할 수 있는 다른 곳', classes: '수업',
    cause: '늦어지는 까닭', delay: '늦어짐', color: '다른 색깔', box: '상자', label: '이름표', chair: '의자', questions: '답할 질문',
    change: '다른 바뀌는 점', 'volunteer-group': '자원봉사자 무리', event: '행사', session: '교육 시간',
  };
  PT.TOPIC = {
    entrance: '옆문으로 드나들기', design: '새 로비 꾸미기', parking: '주차', catering: '점심 주문', room: '회의실 자랑', panels: '패널의 효과',
    lamp: '선물 램프', city: '도시의 소음', closure: '수영장 휴장 안내', health: '수영과 건강', delay: '배송이 늦어짐', color: '의자 색깔',
    store: '가게 영업시간', packing: '짐 싸기', furniture: '새 가구', building: '새 건물 자랑', cost: '이사 비용', feedback: '의견 듣기',
    plan: '내년 무대 계획', staff: '자원봉사자 소개',
  };

  /* ---------- 지문 ----------
   * head: 머리말(제목·날짜·보내는 사람). date: 글을 쓴 날(월 × 100 + 일). ko: 문장별 해석
   * blanks: n(빈칸 번호) · type · s(빈칸이 있는 문장) · opts · a(정답) · alone(①단계 뒤 남는 보기, 엔진과 대조) · flow(③단계 확인)
   */
  PT.P = {
    /* 영상 · 놀이터 ① 공지: 로비 공사 */
    lobby: {
      kind: 'notice', label: '공지', title: '하버 타워 로비 공사', date: 502,
      head: ['NOTICE TO ALL TENANTS', 'Harbor Tower Management Office · Posted: May 2'],
      sents: [
        'Renovation work on the main lobby of Harbor Tower will begin on Monday, May 12.',
        'During this time, the lobby [1] to all visitors.',
        'Tenants and their guests should use the side door on Pine Street.',
        '[2]',
        'Please have your card ready when you arrive.',
        'The work was originally expected to take five days.',
        '[3], the delivery of the new floor tiles has been delayed.',
        'The lobby [4] until Wednesday, May 21.',
        'We will post a new notice if this date changes.',
      ],
      ko: ['하버 타워 1층 로비 공사가 5월 12일 월요일에 시작돼요.', '이 기간 동안 로비는 모든 방문객에게 닫혀요.', '입주자와 손님은 파인 스트리트 쪽 옆문을 이용해 주세요.',
        '이 문에는 경비원이 서서 신분증을 확인할 거예요.', '도착하면 카드를 바로 보여 줄 수 있게 준비해 주세요.', '공사는 원래 5일이 걸릴 예정이었어요.',
        '그러나 새 바닥 타일의 배송이 늦어졌어요.', '로비는 5월 21일 수요일이 되어야 다시 열려요.', '이 날짜가 바뀌면 새 공지를 올릴게요.'],
      blanks: [
        { n: 1, type: 'tense', s: 1, opts: ['was closed', 'being closed', 'will be closed', 'has been closed'], a: 2, alone: [0, 2, 3],
          subj: 'the lobby', num: 'sg', voice: 'pass',
          clues: [{ s: 0, t: 'will begin on Monday, May 12', when: 'future', ko: '공사는 앞으로 시작해요' }, { s: -1, t: 'Posted: May 2', event: [512, 521] }],
          flow: '공지(5월 2일)는 앞으로 있을 공사를 미리 알리는 글이에요. 다른 동사(will begin · will post)도 미래예요.' },
        { n: 2, type: 'insert', s: 3, a: 0,
          prev: { s: 2, t: 'the side door', has: ['door'] }, next: { s: 4, t: 'your card', need: 'card' }, topic: { s: 2, k: 'entrance' },
          opts: [
            { t: 'A security guard will be stationed at this door to check ID cards.', ptrs: [{ t: 'this door', need: 'door' }], gives: ['card'], topic: 'entrance', ko: '이 문에는 경비원이 서서 신분증을 확인할 거예요.' },
            { t: 'The new lobby will also have a small café.', ptrs: [{ t: 'also', need: 'feature' }], topic: 'design', ko: '새 로비에는 작은 카페도 생길 거예요.' },
            { t: 'These cards can be picked up at the management office.', ptrs: [{ t: 'These cards', need: 'card', later: 4 }], gives: ['card'], topic: 'entrance', ko: '이 카드는 관리 사무소에서 받을 수 있어요.' },
            { t: 'Parking on Pine Street is free after 6 P.M.', ptrs: [], topic: 'parking', same: 'Pine Street', ko: '파인 스트리트 주차는 저녁 6시부터 무료예요.' },
          ],
          flow: '공사 안내 → 옆문 이용 → 그 문의 경비원과 신분증 → 카드 준비. 문장이 한 줄로 이어져요.' },
        { n: 3, type: 'link', s: 6, opts: ['However', 'For example', 'In addition', 'Although'], a: 0, alone: [0, 1, 2],
          rel: 'contrast', clue: { s: 5, t: 'originally expected to take five days' }, here: 'has been delayed', relKo: '원래 5일 예정 ↔ 타일 배송이 늦어짐',
          flow: '예정 → 그러나 늦어짐 → 그래서 다시 여는 날이 미뤄짐. 흐름이 자연스러워요.' },
        { n: 4, type: 'tense', s: 7, opts: ['did not reopen', 'will not reopen', 'had not reopened', 'not reopening'], a: 1, alone: [0, 1, 2],
          subj: 'The lobby', num: 'sg', voice: 'act',
          clues: [{ s: 8, t: 'if this date changes', when: 'future', ko: '날짜가 아직 바뀔 수 있어요' }, { s: 0, t: 'will begin on Monday, May 12', when: 'future', ko: '공사는 아직 시작 전이에요' }],
          trap: { s: 5, t: 'was originally expected', ko: '가까운 과거형은 ‘원래 예상’일 뿐이에요' },
          flow: '공사는 아직 시작 전(will begin)이에요. 다시 여는 날도 앞으로의 일이에요.' },
      ],
    },

    /* 영상 실전 문제 · 놀이터 ② 이메일: 회의실 예약 */
    westbay: {
      kind: 'email', label: '이메일', title: '웨스트베이 회의실 예약', date: 414,
      head: ['From: Westbay Conference Center', 'To: Laura Chen', 'Date: April 14', 'Subject: Your booking'],
      sents: [
        'Thank you for choosing the Westbay Conference Center for your company’s training day next Friday.',
        'Lunch for your 30 guests [1] by Seaside Catering.',
        'The caterer has asked us for the final number of guests.',
        '[2]',
        'After that date, we will not be able to change the order.',
        'Your room comes with a projector and two microphones.',
        '[3], you may borrow a laptop from our front desk at no charge.',
        'We look forward to welcoming you and your team.',
      ],
      ko: ['다음 주 금요일 연수 행사 장소로 웨스트베이 컨퍼런스 센터를 골라 주셔서 고마워요.', '손님 30명의 점심은 시사이드 케이터링이 준비할 거예요.',
        '케이터링 업체가 최종 손님 수를 알려 달라고 했어요.', '이 숫자를 4월 21일 월요일까지 보내 주세요.', '그날이 지나면 주문을 바꿀 수 없어요.',
        '회의실에는 프로젝터와 마이크 두 개가 있어요.', '게다가 안내 데스크에서 노트북을 무료로 빌릴 수 있어요.', '귀하와 팀을 맞이하기를 기다릴게요.'],
      blanks: [
        { n: 1, type: 'tense', s: 1, opts: ['was provided', 'will be provided', 'has been provided', 'providing'], a: 1, alone: [0, 1, 2],
          subj: 'Lunch', num: 'sg', voice: 'pass',
          clues: [{ s: 0, t: 'next Friday', when: 'future', ko: '연수 행사는 다음 주 금요일' }, { s: 4, t: 'will not be able to change the order', when: 'future', ko: '주문은 아직 바꿀 수 있어요' }],
          flow: '예약을 고마워하는 이메일이고, 행사는 앞으로 있을 일이에요. 뒤 문장의 will not be able도 미래예요.' },
        { n: 2, type: 'insert', s: 3, a: 2,
          prev: { s: 2, t: 'the final number of guests', has: ['number', 'guests'] }, next: { s: 4, t: 'After that date', need: 'date' }, topic: { s: 2, k: 'catering' },
          opts: [
            { t: 'These guests will also receive free parking passes.', ptrs: [{ t: 'These guests', need: 'guests' }, { t: 'also', need: 'benefit' }], topic: 'parking', ko: '이 손님들은 무료 주차권도 받을 거예요.' },
            { t: 'The Bay Room has a beautiful view of the water.', ptrs: [], topic: 'room', ko: '베이 룸은 물이 보이는 전망이 아름다워요.' },
            { t: 'Please send us this number by Monday, April 21.', ptrs: [{ t: 'this number', need: 'number' }], gives: ['date'], topic: 'catering', ko: '이 숫자를 4월 21일 월요일까지 보내 주세요.' },
            { t: 'Lunch was served at 12:30 P.M.', ptrs: [], topic: 'catering', same: 'Lunch', clash: { s: 0, t: 'next Friday', why: '행사는 다음 주 금요일이라 점심은 아직 나오지 않았어요' }, ko: '점심은 12시 30분에 나왔어요.' },
          ],
          flow: '최종 손님 수 → 그 숫자를 보낼 마감일 → 그날이 지나면 못 바꿈. 앞과 뒤가 모두 이어져요.' },
        { n: 3, type: 'link', s: 6, opts: ['In addition', 'However', 'Otherwise', 'Despite'], a: 0, alone: [0, 1, 2],
          rel: 'add', clue: { s: 5, t: 'comes with a projector and two microphones' }, here: 'borrow a laptop', relKo: '프로젝터 · 마이크가 있음 + 노트북도 빌릴 수 있음',
          flow: '회의실이 주는 편의를 하나씩 더해 가는 흐름이에요.' },
      ],
    },

    /* 놀이터 ③ 광고: 소음 막는 패널 */
    quietdesk: {
      kind: 'ad', label: '광고', title: '콰이어트데스크 패널 광고', date: 0,
      head: ['QuietDesk Sound Panels', 'Advertisement'],
      sents: [
        'Is your office too noisy for focused work?',
        'QuietDesk sound panels can help.',
        'They block up to 70 percent of the noise around your desk.',
        '[1]',
        'Many of these companies reported that their employees felt less tired.',
        'Until now, the panels have been sold only online.',
        '[2], starting next month, you will be able to try them at our new showroom in Daehan Plaza.',
        'The showroom [3] on Saturday, June 7.',
        'The first 100 visitors will receive a free desk lamp.',
      ],
      ko: ['사무실이 너무 시끄러워 일에 집중하기 어렵나요?', '콰이어트데스크 방음 패널이 도와 드려요.', '책상 주변 소음을 70퍼센트까지 막아 줘요.',
        '작년에 500곳이 넘는 회사가 사무실에 이 패널을 달았어요.', '그 회사들 가운데 많은 곳이 직원들이 덜 피곤해했다고 알려 왔어요.', '지금까지 이 패널은 온라인으로만 팔았어요.',
        '그러나 다음 달부터는 대한 플라자의 새 전시장에서 직접 써 볼 수 있어요.', '전시장은 6월 7일 토요일에 문을 열어요.', '처음 온 100명은 책상 램프를 무료로 받아요.'],
      blanks: [
        { n: 1, type: 'insert', s: 3, a: 1,
          prev: { s: 2, t: 'They', has: ['panels'] }, next: { s: 4, t: 'these companies', need: 'companies' }, topic: { s: 2, k: 'panels' },
          opts: [
            { t: 'Each panel also comes with a two-year warranty.', ptrs: [], topic: 'panels', ko: '패널마다 2년 보증도 함께 와요.' },
            { t: 'Last year, more than 500 companies installed them in their offices.', ptrs: [{ t: 'them', need: 'panels' }], gives: ['companies'], topic: 'panels', ko: '작년에 500곳이 넘는 회사가 사무실에 이 패널을 달았어요.' },
            { t: 'These lamps are available in three colors.', ptrs: [{ t: 'These lamps', need: 'lamps', later: 8 }], topic: 'lamp', ko: '이 램프는 세 가지 색이 있어요.' },
            { t: 'Noise is a common problem in many cities.', ptrs: [], topic: 'city', same: 'noise', ko: '소음은 많은 도시의 흔한 문제예요.' },
          ],
          flow: '소음 문제 → 패널이 소음을 막음 → 이미 단 회사들 → 그 회사들의 반응. 광고의 흐름이에요.' },
        { n: 2, type: 'link', s: 6, opts: ['However', 'For example', 'Therefore', 'Because'], a: 0, alone: [0, 1, 2],
          rel: 'contrast', clue: { s: 5, t: 'have been sold only online' }, here: 'try them at our new showroom', relKo: '지금까지 온라인으로만 ↔ 다음 달부터 전시장에서도',
          flow: '온라인 판매 → 그러나 새 전시장 → 여는 날과 선물. 광고가 새 소식으로 넘어가요.' },
        { n: 3, type: 'tense', s: 7, opts: ['opened', 'will open', 'has opened', 'opening'], a: 1, alone: [0, 1, 2],
          subj: 'The showroom', num: 'sg', voice: 'act',
          clues: [{ s: 6, t: 'starting next month', when: 'future', ko: '전시장은 다음 달부터' }, { s: 8, t: 'will receive', when: 'future', ko: '선물도 앞으로 줘요' }],
          flow: '광고는 다음 달에 열 전시장을 알리고 있어요. 앞뒤 동사(will be able · will receive)도 미래예요.' },
      ],
    },

    /* 연습 문제 1 · 공지: 수영장 공사 */
    pool: {
      kind: 'notice', label: '공지', title: '그린필드 스포츠 센터 수영장', date: 804,
      head: ['GREENFIELD SPORTS CENTER', 'Notice to Members · Posted: August 4'],
      sents: [
        'The indoor pool at Greenfield Sports Center needs a new heating system.',
        'Workers [1] it from August 18 to August 29.',
        'The pool will be closed during this period.',
        '[2]',
        'Members can also swim at our Riverside branch for free during this time.',
        'Just show your membership card at the front desk there.',
        'We know that many of you swim every day.',
        '[3], we have asked the workers to finish the job as quickly as possible.',
        'Swimming lessons [4] again on Monday, September 1.',
        'Sign-up for these lessons will begin next week.',
      ],
      ko: ['그린필드 스포츠 센터 실내 수영장에 새 난방 장치가 필요해요.', '8월 18일부터 29일까지 작업자들이 새 난방 장치를 설치할 거예요.', '이 기간에는 수영장이 닫혀요.',
        '그러나 헬스장과 테니스장은 평소처럼 열어요.', '이 기간에는 회원 누구나 리버사이드 지점에서도 무료로 수영할 수 있어요.', '그곳 안내 데스크에서 회원 카드만 보여 주세요.',
        '여러분 가운데 많은 분이 날마다 수영한다는 것을 알아요.', '그래서 작업자들에게 되도록 빨리 끝내 달라고 부탁했어요.', '수영 강습은 9월 1일 월요일에 다시 시작해요.',
        '이 강습의 신청은 다음 주에 시작돼요.'],
      blanks: [
        { n: 1, type: 'tense', s: 1, opts: ['installed', 'will install', 'will be installed', 'installing'], a: 1, alone: [0, 1],
          subj: 'Workers', num: 'pl', voice: 'act', obj: 'it',
          clues: [{ s: 0, t: 'needs a new heating system', when: 'future', ko: '지금 새 장치가 필요해요 → 아직 설치 전' }, { s: 2, t: 'will be closed during this period', when: 'future', ko: '공사 기간은 앞으로' }, { s: -1, t: 'Posted: August 4', event: [818, 829] }],
          flow: '휴장을 미리 알리는 공지예요(8월 4일). 공사는 8월 18일부터라 앞으로 있을 일이에요.' },
        { n: 2, type: 'insert', s: 3, a: 2,
          prev: { s: 2, t: 'The pool will be closed', has: ['closure'] }, next: { s: 4, t: 'also', need: 'open-option' }, topic: { s: 2, k: 'closure' },
          opts: [
            { t: 'These classes will be held in the main hall instead.', ptrs: [{ t: 'These classes', need: 'classes' }], gives: ['open-option'], topic: 'closure', ko: '이 수업들은 대신 큰 홀에서 열려요.' },
            { t: 'The new heating system was installed last year.', ptrs: [], topic: 'closure', clash: { s: 0, t: 'needs a new heating system', why: '새 난방 장치가 지금 필요하다고 했어요' }, ko: '새 난방 장치는 작년에 설치됐어요.' },
            { t: 'However, the gym and the tennis courts will stay open as usual.', ptrs: [{ t: 'However', need: 'closure' }], gives: ['open-option'], topic: 'closure', ko: '그러나 헬스장과 테니스장은 평소처럼 열어요.' },
            { t: 'Swimming is one of the best ways to stay healthy.', ptrs: [], topic: 'health', same: 'Swimming', ko: '수영은 건강을 지키는 가장 좋은 방법 가운데 하나예요.' },
          ],
          flow: '수영장 휴장 → 그래도 여는 곳(헬스장 · 테니스장) → 다른 지점 수영장도 가능. 안내가 이어져요.' },
        { n: 3, type: 'link', s: 7, opts: ['Therefore', 'For instance', 'In addition', 'Unless'], a: 0, alone: [0, 1, 2],
          rel: 'result', clue: { s: 6, t: 'many of you swim every day' }, here: 'as quickly as possible', relKo: '날마다 수영하는 회원이 많음 → 그래서 빨리 끝내 달라고 함',
          flow: '회원의 사정(날마다 수영) → 그래서 공사를 서두름 → 강습 다시 시작. 배려하는 흐름이에요.' },
        { n: 4, type: 'tense', s: 8, opts: ['started', 'have started', 'starting', 'will start'], a: 3, alone: [0, 1, 3],
          subj: 'Swimming lessons', num: 'pl', voice: 'act',
          clues: [{ s: 9, t: 'will begin next week', when: 'future', ko: '신청도 다음 주에 시작' }, { s: 2, t: 'will be closed during this period', when: 'future', ko: '휴장은 앞으로' }],
          flow: '공사가 끝난 뒤(8월 29일) 다시 시작하는 강습이에요. 공지를 쓴 날(8월 4일)보다 뒤예요.' },
      ],
    },

    /* 연습 문제 2 · 이메일: 의자 주문 */
    chairs: {
      kind: 'email', label: '이메일', title: '브라이트라인 의자 주문', date: 1008,
      head: ['From: Brightline Office Supply', 'To: Daniel Ortiz', 'Date: October 8', 'Subject: Your order #4471'],
      sents: [
        'Thank you for ordering twenty Ergo-Plus office chairs from Brightline Office Supply.',
        'Unfortunately, this model is currently out of stock.',
        'We [5] a new shipment from the factory on October 24.',
        '[6]',
        'If this delay causes a problem, we can send you a similar model, the Flexa 200, right away.',
        'The Flexa 200 usually costs $20 more per chair.',
        '[7], we will charge you the same price as your original order.',
        'Please reply by October 12 if you would like to switch.',
        '[8], we will ship your original order as soon as the new stock arrives.',
      ],
      ko: ['브라이트라인 오피스 서플라이에서 에르고플러스 사무용 의자 20개를 주문해 주셔서 고마워요.', '아쉽게도 이 모델은 지금 재고가 없어요.', '10월 24일에 공장에서 새 물량을 받을 거예요.',
        '그래서 의자는 처음 계획보다 2주쯤 늦게 도착할 거예요.', '이렇게 늦어져서 곤란하시면, 비슷한 모델인 플렉사 200을 바로 보내 드릴 수 있어요.', '플렉사 200은 보통 의자 하나에 20달러가 더 비싸요.',
        '그러나 처음 주문하신 가격 그대로 받을게요.', '바꾸고 싶으시면 10월 12일까지 답장해 주세요.', '그렇지 않으면 새 물량이 들어오는 대로 처음 주문을 보내 드릴게요.'],
      blanks: [
        { n: 5, type: 'tense', s: 2, opts: ['received', 'have received', 'will receive', 'receiving'], a: 2, alone: [0, 1, 2],
          subj: 'We', num: 'pl', voice: 'act', obj: 'a new shipment',
          clues: [{ s: 1, t: 'is currently out of stock', when: 'future', ko: '지금 재고가 없어요 → 새 물량은 아직' }, { s: -1, t: 'Date: October 8', event: [1024, 1024] }],
          flow: '10월 8일에 보낸 이메일이고, 물량이 들어오는 날(10월 24일)은 그보다 뒤예요.' },
        { n: 6, type: 'insert', s: 3, a: 0,
          prev: { s: 2, t: 'a new shipment from the factory on October 24', has: ['cause'] }, next: { s: 4, t: 'this delay', need: 'delay' }, topic: { s: 2, k: 'delay' },
          opts: [
            { t: 'As a result, your chairs will arrive about two weeks later than planned.', ptrs: [{ t: 'As a result', need: 'cause' }], gives: ['delay'], topic: 'delay', ko: '그래서 의자는 처음 계획보다 2주쯤 늦게 도착할 거예요.' },
            { t: 'These chairs are also available in black and gray.', ptrs: [{ t: 'also', need: 'color' }], topic: 'color', ko: '이 의자는 검은색과 회색도 있어요.' },
            { t: 'Your chairs were delivered to your office this morning.', ptrs: [], topic: 'delay', clash: { s: 1, t: 'is currently out of stock', why: '지금 재고가 없다고 했어요' }, ko: '의자는 오늘 아침 사무실로 배달됐어요.' },
            { t: 'Our store is open from 9 A.M. to 6 P.M. on weekdays.', ptrs: [], topic: 'store', ko: '저희 가게는 평일 오전 9시부터 오후 6시까지 열어요.' },
          ],
          flow: '재고 없음 → 새 물량은 10월 24일 → 그래서 늦어짐 → 이 늦어짐이 곤란하면 다른 모델. 한 줄로 이어져요.' },
        { n: 7, type: 'link', s: 6, opts: ['As a result', 'However', 'For example', 'Because'], a: 1, alone: [0, 1, 2],
          rel: 'contrast', clue: { s: 5, t: 'costs $20 more per chair' }, here: 'the same price', relKo: '20달러 더 비쌈 ↔ 같은 가격만 받음',
          flow: '더 비싼 모델 → 그러나 같은 가격 → 바꿀지 답장. 손님을 배려하는 흐름이에요.' },
        { n: 8, type: 'link', s: 8, opts: ['In addition', 'Despite', 'For instance', 'Otherwise'], a: 3, alone: [0, 2, 3],
          rel: 'otherwise', clue: { s: 7, t: 'reply by October 12 if you would like to switch' }, here: 'ship your original order', relKo: '바꾸려면 답장 → 답장이 없으면 처음 주문대로',
          flow: '두 가지 길(바꾸기 · 그대로 기다리기)을 차례로 안내하며 끝나요.' },
      ],
    },

    /* 연습 문제 3 · 회람: 사무실 이사 */
    move: {
      kind: 'memo', label: '회람', title: '부산 사무실 이사', date: 602,
      head: ['MEMO', 'To: All Busan office staff · From: Hana Yoon, Office Manager', 'Date: June 2 · Subject: Office move'],
      sents: [
        'As you know, our office will move to the Centum Tower on Saturday, June 14.',
        'Movers [9] all furniture and computers that morning.',
        'Please put your personal items in the boxes provided by Thursday, June 12.',
        '[10]',
        'These labels will help the movers place the boxes at the right desks.',
        'The new office is much larger than our current one.',
        '[11], it is only a five-minute walk from Centum City Station.',
        'Employees will not be able to park in the building’s garage.',
        '[12], they can use the public lot across the street at a discount.',
      ],
      ko: ['아시다시피 우리 사무실은 6월 14일 토요일에 센텀 타워로 옮겨요.', '그날 아침 이삿짐 직원들이 가구와 컴퓨터를 모두 쌀 거예요.', '6월 12일 목요일까지 개인 물건을 나눠 드린 상자에 담아 주세요.',
        '상자마다 이름과 자리 번호를 적은 이름표를 붙여 주세요.', '이 이름표가 있으면 이삿짐 직원들이 상자를 알맞은 책상에 놓을 수 있어요.', '새 사무실은 지금 사무실보다 훨씬 넓어요.',
        '게다가 센텀시티역에서 걸어서 5분밖에 안 걸려요.', '직원은 건물 주차장에 차를 댈 수 없어요.', '그 대신 길 건너 공영 주차장을 할인받아 쓸 수 있어요.'],
      blanks: [
        { n: 9, type: 'tense', s: 1, opts: ['will pack', 'packed', 'have packed', 'packing'], a: 0, alone: [0, 1, 2],
          subj: 'Movers', num: 'pl', voice: 'act', obj: 'all furniture and computers',
          clues: [{ s: 0, t: 'will move to the Centum Tower on Saturday, June 14', when: 'future', ko: '이사는 앞으로 · that morning = 그날 아침' }, { s: -1, t: 'Date: June 2', event: [614, 614] }],
          flow: '이사를 미리 알리는 회람(6월 2일)이에요. 상자를 싸 달라는 부탁(by June 12)도 앞으로의 일이에요.' },
        { n: 10, type: 'insert', s: 3, a: 3,
          prev: { s: 2, t: 'the boxes', has: ['box'] }, next: { s: 4, t: 'These labels', need: 'label' }, topic: { s: 2, k: 'packing' },
          opts: [
            { t: 'These chairs will be replaced with new ones.', ptrs: [{ t: 'These chairs', need: 'chair' }], topic: 'furniture', ko: '이 의자들은 새것으로 바뀌어요.' },
            { t: 'The Centum Tower also has a large rooftop garden.', ptrs: [{ t: 'also', need: 'feature' }], topic: 'building', same: 'Centum Tower', ko: '센텀 타워에는 넓은 옥상 정원도 있어요.' },
            { t: 'Moving companies usually charge more on weekends.', ptrs: [], topic: 'cost', ko: '이삿짐 회사는 대개 주말에 돈을 더 받아요.' },
            { t: 'Each box should be labeled with your name and desk number.', ptrs: [{ t: 'Each box', need: 'box' }], gives: ['label'], topic: 'packing', ko: '상자마다 이름과 자리 번호를 적은 이름표를 붙여 주세요.' },
          ],
          flow: '상자에 짐 담기 → 상자마다 이름표 → 그 이름표 덕분에 알맞은 책상으로. 짐 싸기 이야기가 이어져요.' },
        { n: 11, type: 'link', s: 6, opts: ['However', 'As a result', 'In addition', 'Although'], a: 2, alone: [0, 1, 2],
          rel: 'add', clue: { s: 5, t: 'much larger than our current one' }, here: 'only a five-minute walk', relKo: '훨씬 넓음 + 역에서도 가까움 (좋은 점 둘)',
          flow: '새 사무실의 좋은 점을 둘 늘어놓은 뒤, 주차 이야기로 넘어가요.' },
        { n: 12, type: 'link', s: 8, opts: ['For example', 'Instead', 'In addition', 'Even though'], a: 1, alone: [0, 1, 2],
          rel: 'instead', clue: { s: 7, t: 'will not be able to park in the building’s garage' }, here: 'use the public lot', relKo: '건물 주차장은 안 됨 → 그 대신 공영 주차장',
          flow: '안 되는 것(건물 주차장)을 말한 뒤, 그 대신 쓸 곳을 알려 주며 끝나요.' },
      ],
    },

    /* 연습 문제 4 · 이메일: 축제 자원봉사자에게 */
    festival: {
      kind: 'email', label: '이메일', title: '리버사이드 음식 축제', date: 922,
      head: ['From: Mina Seo, Riverside Arts Council', 'To: Festival volunteers', 'Date: September 22', 'Subject: Thank you!'],
      sents: [
        'Thank you for volunteering at the Riverside Food Festival last weekend.',
        'More than 8,000 people [13] the festival over two days.',
        'We also received many positive comments from visitors.',
        '[14], one visitor wrote that the new music stage was the best part of her weekend.',
        'We would like to hear your ideas, too.',
        '[15]',
        'Your answers will help us plan next year’s festival.',
        'As a thank-you gift, every volunteer [16] two tickets to our winter concert.',
        'The tickets will be mailed to you next week.',
      ],
      ko: ['지난 주말 리버사이드 음식 축제에서 자원봉사를 해 주셔서 고마워요.', '이틀 동안 8,000명이 넘는 사람이 축제에 왔어요.', '방문객들의 좋은 의견도 많이 받았어요.',
        '예를 들어 한 방문객은 새 음악 무대가 주말의 가장 좋은 부분이었다고 썼어요.', '여러분의 생각도 듣고 싶어요.', '몇 분만 내서 첨부한 설문지를 채워 주세요.',
        '여러분의 답이 내년 축제를 계획하는 데 도움이 될 거예요.', '고마움의 선물로 자원봉사자 한 분마다 겨울 음악회 표 두 장을 드릴 거예요.', '표는 다음 주에 우편으로 보내 드려요.'],
      blanks: [
        { n: 13, type: 'tense', s: 1, opts: ['will attend', 'are attending', 'to attend', 'attended'], a: 3, alone: [0, 1, 3],
          subj: 'More than 8,000 people', num: 'pl', voice: 'act', obj: 'the festival',
          clues: [{ s: 0, t: 'last weekend', when: 'past', ko: '축제는 지난 주말에 끝났어요' }],
          flow: '축제가 끝난 뒤 고마움을 전하는 이메일이에요. Thank you for volunteering → 이미 한 일이에요.' },
        { n: 14, type: 'link', s: 3, opts: ['For example', 'However', 'Otherwise', 'As a result'], a: 0, alone: [0, 1, 2, 3],
          rel: 'example', clue: { s: 2, t: 'many positive comments from visitors' }, here: 'one visitor wrote', relKo: '좋은 의견이 많았음 → 그 가운데 하나를 예로',
          flow: '좋은 의견이 많았다 → 예로 한 사람의 말 → 여러분 생각도 듣고 싶다. 의견 이야기가 이어져요.' },
        { n: 15, type: 'insert', s: 5, a: 1,
          prev: { s: 4, t: 'your ideas', has: ['ideas'] }, next: { s: 6, t: 'Your answers', need: 'questions' }, topic: { s: 4, k: 'feedback' },
          opts: [
            { t: 'The music stage will also be moved closer to the river.', ptrs: [{ t: 'also', need: 'change' }], topic: 'plan', same: 'music stage', ko: '음악 무대도 강 가까이로 옮길 거예요.' },
            { t: 'Please take a few minutes to fill out the attached survey.', ptrs: [], gives: ['questions'], topic: 'feedback', ko: '몇 분만 내서 첨부한 설문지를 채워 주세요.' },
            { t: 'These volunteers worked at the ticket booth.', ptrs: [{ t: 'These volunteers', need: 'volunteer-group' }], topic: 'staff', ko: '이 자원봉사자들은 매표소에서 일했어요.' },
            { t: 'Parking was free for all visitors.', ptrs: [], topic: 'parking', ko: '방문객은 모두 무료로 주차했어요.' },
          ],
          flow: '여러분 생각을 듣고 싶다 → 설문지를 채워 달라 → 그 답이 내년 계획에 도움. 부탁이 이어져요.' },
        { n: 16, type: 'tense', s: 7, opts: ['received', 'have received', 'will receive', 'receiving'], a: 2, alone: [0, 2],
          subj: 'every volunteer', num: 'sg', voice: 'act', obj: 'two tickets',
          clues: [{ s: 8, t: 'will be mailed to you next week', when: 'future', ko: '표는 다음 주에 보내요 → 아직 못 받았어요' }],
          trap: { s: 0, t: 'last weekend', ko: '축제는 지났지만 선물은 앞으로 받아요' },
          flow: '고마움의 선물은 앞으로 줄 것이라고 알리며 끝나요. 같은 이메일 안에서도 일마다 시간이 달라요.' },
      ],
    },
  };

  /* ---------- 작은 지문 (영상 · 직접 해 보기 · 퀴즈) ---------- */
  const mini = (id, o) => { PT.P[id] = Object.assign({ kind: 'mini', label: '', head: [], date: 0, ko: [] }, o); };
  // 02장: 앞 문장만 바꾼 로비 공지 → 답이 was closed로
  mini('lobbyB', {
    sents: ['Renovation work on the main lobby of Harbor Tower ended last Friday.', 'During this time, the lobby [1] to all visitors.'],
    ko: ['하버 타워 1층 로비 공사가 지난 금요일에 끝났어요.', '이 기간 동안 로비는 모든 방문객에게 닫혀 있었어요.'],
    blanks: [{ n: 1, type: 'tense', s: 1, opts: ['was closed', 'being closed', 'will be closed', 'has been closed'], a: 0, alone: [0, 2, 3],
      subj: 'the lobby', num: 'sg', voice: 'pass', clues: [{ s: 0, t: 'ended last Friday', when: 'past', ko: '공사는 이미 끝났어요' }],
      flow: '이미 끝난 공사를 돌아보는 글이에요.' }],
  });
  // 03장: 글을 쓴 날 하나로 시제가 바뀜 (date를 직접 해 보기에서 바꿈)
  mini('sched', {
    date: 502, head: ['Harbor Tower · Posted: May 2'],
    sents: ['The lobby [1] from May 12 to May 16.'],
    blanks: [{ n: 1, type: 'tense', s: 0, opts: ['was closed', 'will be closed', 'being closed', 'to be closed'], a: 1, alone: [0, 1],
      subj: 'The lobby', num: 'sg', voice: 'pass', clues: [{ s: -1, t: 'Posted', event: [512, 516] }], flow: '글을 쓴 날과 공사 날짜를 견줘요.' }],
  });
  // 04장: 같은 앞 문장, 다른 뒤 문장 → 다른 연결어
  const PR_OPTS = ['However', 'In addition', 'As a result', 'For example'];
  [['prResult', '[1], we replaced all of them last month.', 'result', 'replaced all of them', '자주 고장 남 → 그래서 모두 바꿈'],
    ['prContrast', '[1], they were cheap to repair.', 'contrast', 'cheap to repair', '자주 고장 남 ↔ 수리비는 쌌음'],
    ['prAdd', '[1], they used a lot of ink.', 'add', 'used a lot of ink', '자주 고장 남 + 잉크도 많이 씀 (나쁜 점 둘)'],
    ['prExample', '[1], the one on the third floor stopped working twice in May.', 'example', 'the one on the third floor', '자주 고장 남 → 그 예로 3층 프린터'],
  ].forEach(([id, s, rel, here, relKo]) => mini(id, {
    sents: ['Our old printers often broke down.', s],
    blanks: [{ n: 1, type: 'link', s: 1, opts: PR_OPTS, a: PR_OPTS.indexOf(PT.REL_WORDS[rel]), alone: [0, 1, 2, 3],
      rel, clue: { s: 0, t: 'often broke down' }, here, relKo, flow: '두 문장의 관계로 정해요.' }],
  }));
  // 퀴즈 3: 시제를 정하는 문장 찾기 (가까운 과거형 함정)
  mini('cafe', {
    sents: ['Last month, we asked employees how to improve the cafeteria.', 'Many of them wanted healthier food.', 'The new menu [1] more salads and soups.', 'It will be introduced on Monday, March 3.'],
    blanks: [{ n: 1, type: 'tense', s: 2, opts: ['included', 'will include', 'has included', 'including'], a: 1, alone: [0, 1, 2],
      subj: 'The new menu', num: 'sg', voice: 'act', obj: 'more salads and soups',
      clues: [{ s: 3, t: 'will be introduced on Monday, March 3', when: 'future', ko: '새 메뉴는 앞으로 나와요' }],
      trap: { s: 0, t: 'Last month', ko: '지난달에 한 일은 ‘물어본 것’이에요' }, flow: '설문 → 의견 → 새 메뉴 → 나오는 날.' }],
  });
  // 퀴즈 5: 대신(Instead)
  mini('newsletter', {
    sents: ['We will not print paper copies of the newsletter this year.', '[1], it will be sent to all staff by e-mail.'],
    blanks: [{ n: 1, type: 'link', s: 1, opts: ['For example', 'Instead', 'In addition', 'Although'], a: 1, alone: [0, 1, 2],
      rel: 'instead', clue: { s: 0, t: 'will not print paper copies' }, here: 'sent to all staff by e-mail', relKo: '종이로 안 찍음 → 그 대신 이메일', flow: '' }],
  });
  // 퀴즈 8: 문장이 들어갈 자리 고르기 ([1]~[4])
  PT.POS = {
    sent: 'During this event, every customer will receive a free notebook.', ptr: 'this event', need: 'event',
    sents: ['Brightline will open a new store in Daegu next month.', 'The store will sell office furniture and supplies.', 'On opening day, there will be a special event.', 'Please visit our website for more information.'],
    has: [['store'], ['goods'], ['event'], ['website']],
  };
  PT.fitsAt = k => PT.POS.has[k].includes(PT.POS.need);

  /* ---------- 지문 도우미 ---------- */
  Object.entries(PT.P).forEach(([id, P]) => { P.id = id; P.blanks.forEach(b => { b.P = P; b.pid = id; }); });
  PT.blank = (pid, n) => PT.P[pid].blanks.find(b => b.n === n);
  // 글을 쓴 날만 바꾼 사본 (03장 직접 해 보기 · 퀴즈). 원래 데이터는 그대로 둠
  PT.withDate = function (pid, date) {
    const P = Object.assign({}, PT.P[pid], { date, head: PT.P[pid].head.map(h => h.replace(/Posted: \w+ \d+/, 'Posted: ' + PT.dateEn(date))) });
    P.blanks = PT.P[pid].blanks.map(b => Object.assign({}, b, { P }));
    return P;
  };
  PT.optText = (b, k) => b.type === 'insert' ? b.opts[k].t : b.opts[k];
  PT.ansText = b => PT.optText(b, b.a);
  // 문장 하나 (fills: { 빈칸 번호: 넣을 말 } — 없으면 ___)
  PT.sentText = function (P, s, fills = {}) {
    return P.sents[s].replace(/\[(\d+)\]/g, (m, n) => fills[n] != null ? fills[n] : '___');
  };
  PT.filled = (b, k = b.a) => PT.sentText(b.P, b.s, { [b.n]: PT.optText(b, k) });
  // 지문 전체 글 (정답을 모두 넣음)
  PT.fullText = P => P.sents.map((s, i) => PT.sentText(P, i, Object.fromEntries(P.blanks.map(b => [b.n, PT.ansText(b)])))).join(' ');
  const quote = s => `‘${s}’`;
  const where = (b, s) => s === -1 ? '머리말' : s === b.s - 1 ? '앞 문장' : s === b.s + 1 ? '뒤 문장' : s < b.s ? `${b.s - s}문장 앞` : `${s - b.s}문장 뒤`;
  PT.where = where;
  const clueWhen = (b, c) => c.when || PT.whenByDate(b.P.date, c.event[0], c.event[1]);
  PT.clueWhen = clueWhen;
  const clueText = (b, c) => c.event ? `${c.t} (${PT.dateKo(b.P.date)}) · 일은 ${PT.dateKo(c.event[0])}` : quote(c.t);

  /* ---------- 규칙 엔진 ---------- */
  // ①단계: 빈칸 문장만 보고 지움. 지우면 { why, trap }
  function step1(b, k) {
    const o = PT.optText(b, k);
    if (b.type === 'tense') {
      const f = PT.verbForm(o);
      if (!f) return { why: `${quote(o)} → 동사 꼴을 읽지 못했어요.` };
      if (!f.fin) return { why: `${quote(o)} → 시제가 없는 꼴이에요. 빈칸은 문장의 진짜 동사 자리라서 못 와요.`, trap: 'form' };
      if (b.num && f.n && f.n !== b.num) return { why: `주어 ${b.subj} → ${NUM[b.num]}. ${quote(o)} → ${NUM[f.n]}일 때 쓰는 꼴이라 수가 안 맞아요.`, trap: 'num' };
      if (b.voice === 'act' && f.v === 'pass') return { why: `빈칸 뒤에 목적어(${b.obj})가 있어요 → 능동. ${quote(o)} → 수동(be + p.p.)이라 안 돼요.`, trap: 'voice' };
      if (b.voice === 'pass' && f.v === 'act') return { why: `주어 ${b.subj} → 스스로 하지 않고 ‘~되는’ 쪽이라 수동이어야 해요.`, trap: 'voice' };
      return null;
    }
    if (b.type === 'link') {
      const d = PT.link(o);
      if (!d) return { why: `${quote(o)} → 연결어 사전에 없어요.` };
      if (d.k !== 'adv') return { why: `${quote(o)} → ${PT.KIND[d.k]}. 빈칸 앞이 마침표, 뒤가 쉼표 → 접속부사 자리라서 못 와요.`, trap: 'kind' };
      return null;
    }
    return null;   // 문장 넣기: 보기가 모두 완전한 문장이라 ①단계에서는 지우지 않음
  }
  // ②단계: 보이는 단서로 지움. see(s): 문장 s가 보이는지
  function step2(b, k, see) {
    const o = PT.optText(b, k);
    if (b.type === 'tense') {
      const f = PT.verbForm(o), c = (b.clues || []).find(c => see(c.s));
      if (!c) return null;
      const w = clueWhen(b, c);
      if (f.t !== w) return { why: `${where(b, c.s)} ${clueText(b, c)} → ${PT.WHEN[w]}. ${quote(o)} → ${PT.TIME[f.t]}${raseo(PT.TIME[f.t])} 시간이 안 맞아요.`, clue: c, trap: b.trap && f.t === 'past' ? 'near' : 'time' };
      return null;
    }
    if (b.type === 'link') {
      if (!see(b.clue.s)) return null;
      const d = PT.link(o);
      if (d.r !== b.rel) return { why: `두 문장의 관계 → ${PT.REL[b.rel].name}(${b.relKo}). ${quote(o)} → ${PT.REL[d.r].name}(${PT.REL[d.r].ko})${raseo(PT.REL[d.r].name)} 관계가 안 맞아요.`, clue: b.clue, trap: 'rel' };
      return null;
    }
    // 문장 넣기
    const op = b.opts[k];
    if (op.clash && see(op.clash.s)) return { why: `내용이 어긋나요. ${where(b, op.clash.s)} ${quote(op.clash.t)} → ${op.clash.why}.`, clue: { s: op.clash.s, t: op.clash.t }, trap: 'clash' };
    if (see(b.prev.s)) {
      const bad = op.ptrs.find(p => !b.prev.has.includes(p.need));
      if (bad) {
        const tr = bad.t.toLowerCase() === 'also' ? 'also' : bad.later != null ? 'order' : 'ptr';
        return { why: `${quote(bad.t)} → 앞 문장에 가리킬 말(${PT.NEED[bad.need]})이 없어요.` + (tr === 'also' ? ' also 앞에는 비슷한 것이 먼저 나와야 해요.' : tr === 'order' ? ` 그 말은 ${where(b, bad.later)}에야 나와요. 순서가 거꾸로예요.` : ''), clue: { s: b.prev.s, t: b.prev.t }, trap: tr };
      }
    }
    if (b.topic && see(b.topic.s) && op.topic !== b.topic.k) {
      return { why: (op.same ? `같은 낱말(${op.same})이 보여도 ` : '') + `주제가 달라요. 글은 ${PT.TOPIC[b.topic.k]}, 이 문장은 ${PT.TOPIC[op.topic]}.`, clue: { s: b.topic.s }, trap: op.same ? 'same' : 'topic' };
    }
    const nextOk = !b.next || (op.gives || []).includes(b.next.need) || b.prev.has.includes(b.next.need);
    if (b.next && see(b.next.s) && !nextOk) return { why: `뒤 문장 ${quote(b.next.t)} → 가리킬 말(${PT.NEED[b.next.need]})이 이 문장에 없어서 뒤 문장이 이어지지 않아요.`, clue: { s: b.next.s, t: b.next.t }, trap: 'next' };
    return null;
  }
  // 판정: { s: 'ok' | 'no' | 'open', step, why, clue, trap }. vis: 보이는 문장 번호 Set(머리말은 -1). 없으면 글 전체
  PT.judge = function (b, k, vis) {
    const see = s => !vis || s === b.s || vis.has(s);
    const r1 = step1(b, k);
    if (r1) return Object.assign({ s: 'no', step: 1 }, r1);
    const r2 = step2(b, k, see);
    if (r2) return Object.assign({ s: 'no', step: 2 }, r2);
    if (vis) return { s: 'open', step: 2, why: '아직 지울 단서가 보이지 않아요.' };
    return { s: 'ok', step: 3, why: b.flow };
  };
  PT.isOk = (b, k) => PT.judge(b, k).s === 'ok';
  PT.cands = (b, vis) => b.opts.map((_, k) => k).filter(k => PT.judge(b, k, vis).s !== 'no');
  PT.alone = b => PT.cands(b, new Set());
  // 문맥 손전등: 빈칸 문장에서 위로 up, 아래로 down 문장, head면 머리말까지 보임
  PT.vis = function (b, up, down, head) {
    const v = new Set([b.s]);
    for (let i = 1; i <= up; i++) if (b.s - i >= 0) v.add(b.s - i);
    for (let i = 1; i <= down; i++) if (b.s + i < b.P.sents.length) v.add(b.s + i);
    if (head && b.P.head.length) v.add(-1);
    return v;
  };
  // 답이 하나로 줄어드는 가장 적은 공개 (켜는 문장 수가 적은 순서, 같으면 가까운 쪽부터)
  PT.minReveal = function (b) {
    let best = null;
    const N = b.P.sents.length, H = b.P.head.length ? 1 : 0;
    for (let up = 0; up <= b.s; up++) for (let down = 0; down < N - b.s; down++) for (let head = 0; head <= H; head++) {
      const n = up + down + head;
      if (best && n >= best.n) continue;
      if (PT.cands(b, PT.vis(b, up, down, head)).length === 1) best = { up, down, head: !!head, n };
    }
    return best;
  };

  /* ---------- 3단계 풀이 (연습 문제 힌트 · 영상 · 놀이터) ----------
   * marks: { s: 문장, t: 글자(없으면 문장 전체), role } — role: focus 빈칸 문장 · cue 단서 · ante 주어 · trap 함정 · head 머리말
   */
  const list = (b, ks) => ks.map(k => `${PT.optText(b, k)}`).join(' · ');
  const letters = (b, ks) => ks.map(k => `(${'ABCD'[k]})`).join(' ');
  PT.steps = function (b) {
    const all = b.opts.map((_, k) => k), j1 = all.map(k => step1(b, k));
    const gone1 = all.filter(k => j1[k]), left1 = all.filter(k => !j1[k]);
    const gone2 = left1.filter(k => k !== b.a), ans = PT.ansText(b);
    const S = [];
    if (b.type === 'tense') {
      const f = [`빈칸은 문장의 동사 자리예요. 주어 ${b.subj} → ${NUM[b.num]}`];
      f.push(b.voice === 'act' ? (b.obj ? `, 뒤에 목적어(${b.obj}) → 능동` : ', 능동') : ', ‘~되는’ 쪽 → 수동');
      const t1 = f.join('') + '. ' + (gone1.length ? `지울 보기: ${gone1.map(k => `${PT.optText(b, k)}(${j1[k].trap === 'form' ? '시제 없음' : j1[k].trap === 'num' ? '수' : '태'})`).join(', ')}. ` : '') +
        `남은 ${list(b, left1)} → 이 문장만으로는 ${['', '하나', '둘 다', '셋 모두', '넷 모두'][left1.length]} 돼요.`;
      S.push({ head: '① 빈칸 문장만 봐요.', text: t1, marks: [{ s: b.s, role: 'focus' }, { s: b.s, t: b.subj, role: 'ante' }].concat(b.obj ? [{ s: b.s, t: b.obj, role: 'ante' }] : []) });
      const cs = b.clues.filter(c => c.s !== -1), c = cs[0] || b.clues[0], w = clueWhen(b, c);
      const t2 = `${where(b, c.s)} ${clueText(b, c)} → ${PT.WHEN[w]}` + (c.ko ? `(${c.ko})` : '') + `. 지울 보기: ${gone2.map(k => `${PT.optText(b, k)}(${PT.TSHORT[PT.verbForm(PT.optText(b, k)).t]})`).join(', ')}. 남는 것 → ${ans}.` +
        (b.trap ? ` 함정: ${where(b, b.trap.s)}의 ${quote(b.trap.t)} → ${b.trap.ko}.` : '');
      S.push({ head: '② 앞뒤 문장에서 단서를 찾아요.', text: t2, marks: cs.map(c => ({ s: c.s, role: 'clue' })).concat(cs.map(c => ({ s: c.s, t: c.t, role: 'cue' }))).concat(b.trap ? [{ s: b.trap.s, t: b.trap.t, role: 'trap' }] : []) });
      const hc = b.clues.find(c => c.s === -1);
      S.push({ head: '③ 글 전체로 확인해요.', text: b.flow + (hc ? ` 머리말 ${hc.t} → 일(${PT.dateKo(hc.event[0])})보다 ${clueWhen(b, hc) === 'future' ? '앞에 쓴 글' : '뒤에 쓴 글'}이에요.` : ''), marks: hc ? [{ s: -1, t: hc.t, role: 'cue' }] : [] });
    } else if (b.type === 'link') {
      const t1 = `빈칸 앞은 마침표, 뒤는 쉼표 + 문장 → 접속부사 자리예요. ` + (gone1.length ? `지울 보기: ${gone1.map(k => `${PT.optText(b, k)}(${PT.KIND[PT.link(PT.optText(b, k)).k]})`).join(', ')}. ` : '보기가 모두 접속부사라 여기서는 못 지워요. ') +
        `남은 ${list(b, left1)} → 이 문장만으로는 못 골라요.`;
      S.push({ head: '① 빈칸 문장만 봐요.', text: t1, marks: [{ s: b.s, role: 'focus' }] });
      const R = PT.REL[b.rel];
      const t2 = `${where(b, b.clue.s)} ${quote(b.clue.t)} ↔ 빈칸 문장 ${quote(b.here)} → ${R.name}(${b.relKo}). 한국어로 ‘${R.ko}’가 어울려요. 지울 보기: ${gone2.map(k => `${PT.optText(b, k)}(${PT.REL[PT.link(PT.optText(b, k)).r].name})`).join(', ')}. 남는 것 → ${ans}.`;
      S.push({ head: '② 앞뒤 문장에서 단서를 찾아요.', text: t2, marks: [{ s: b.clue.s, role: 'clue' }, { s: b.clue.s, t: b.clue.t, role: 'cue' }, { s: b.s, t: b.here, role: 'cue' }] });
      S.push({ head: '③ 글 전체로 확인해요.', text: b.flow, marks: [] });
    } else {
      const ptrs = b.opts.map((o, k) => `(${'ABCD'[k]}) ${o.ptrs.length ? o.ptrs.map(p => p.t).join(' · ') : '없음'}`).join(', ');
      S.push({ head: '① 빈칸 문장(보기)만 봐요.', text: `보기가 모두 문장이고, 하나하나는 문법으로 다 맞아요. 가리키는 말을 찾아 두세요: ${ptrs}.`, marks: [{ s: b.s, role: 'focus' }] });
      const why = gone2.map(k => `(${'ABCD'[k]}) ${PT.judge(b, k).why}`).join(' ');
      const op = b.opts[b.a], fwd = b.next && (op.gives || []).includes(b.next.need);
      const t2 = `정답 (${'ABCD'[b.a]}) → ` +
        (op.ptrs.length ? `${quote(op.ptrs[0].t)} = 앞 문장 ${quote(b.prev.t)}. 짝이 맞아요` : `앞 문장 ${quote(b.prev.t)} → 바로 이어져요`) +
        (fwd ? `. 뒤 문장 ${quote(b.next.t)} → 가리킬 것이 이 문장에 있어요.` : '.') + ` 지울 보기: ${why}`;
      const mk = [{ s: b.prev.s, role: 'clue' }, { s: b.prev.s, t: b.prev.t, role: 'cue' }];
      if (b.next) mk.push({ s: b.next.s, role: 'clue' }, { s: b.next.s, t: b.next.t, role: 'cue' });
      S.push({ head: '② 앞뒤 문장과 이어 봐요.', text: t2, marks: mk });
      S.push({ head: '③ 글 전체로 확인해요.', text: b.flow, marks: [] });
    }
    return S;
  };
  // 보기별 해설
  PT.notes = b => b.opts.map((_, k) => {
    const j = PT.judge(b, k), ko = b.type === 'insert' ? `(${b.opts[k].ko}) ` : '';
    return ko + (j.s === 'ok' ? `정답. ${b.type === 'link' ? `${PT.REL[b.rel].name} → ${PT.REL[b.rel].ko}. ` : ''}${j.why}` : `× ${PT.STEP[j.step - 1]}에서 지워져요. ${j.why}`);
  });
  PT.tag = b => {
    if (b.type === 'tense') return `시제 · ${PT.WHEN[clueWhen(b, b.clues[0])]}`;
    if (b.type === 'link') return `연결어 · ${PT.REL[b.rel].name}`;
    return '문장 넣기 · 가리키는 말';
  };
  PT.TRAP = { order: '순서 함정', same: '같은 낱말 함정', also: 'also 함정', clash: '어긋남 함정', topic: '다른 주제', ptr: '짝 없는 가리키는 말', next: '뒤가 끊김' };

  /* ---------- 연습 문제: 지문 넷 × 빈칸 넷 ---------- */
  PT.DRILL = ['pool', 'chairs', 'move', 'festival'];
  PT.drillItems = () => PT.DRILL.map(pid => PT.P[pid].blanks).flat().map(b => ({
    b, pid: b.pid, n: b.n, type: b.type, opts: b.opts.map((_, k) => PT.optText(b, k)), a: b.a, steps: PT.steps(b), notes: PT.notes(b), tag: PT.tag(b),
    ko: b.P.ko[b.s], full: PT.filled(b),
  }));
  // 놀이터 '문맥 손전등'의 지문
  PT.LIGHT = ['lobby', 'westbay', 'quietdesk'];

  /* ---------- 데이터 점검 ---------- */
  const TIMEWORD = /\b(next|last|ago|since|yesterday|tomorrow|already|yet|so far|soon|currently|now)\b/i;
  PT.check = function () {
    const bad = [];
    Object.values(PT.P).forEach(P => {
      const nums = [];
      P.sents.forEach(s => (s.match(/\[(\d+)\]/g) || []).forEach(m => nums.push(+m.slice(1, -1))));
      P.blanks.forEach(b => {
        const id = `${P.id} (${b.n})`, sent = P.sents[b.s] || '';
        if (!sent.includes(`[${b.n}]`)) bad.push(`${id}: 빈칸 표시가 ${b.s}번 문장에 없어요`);
        if (b.opts.length !== 4) bad.push(`${id}: 보기가 넷이 아니에요`);
        const has = (s, t) => s === -1 ? P.head.join(' ').includes(t) : (P.sents[s] || '').includes(t);
        if (b.type === 'tense') {
          b.opts.forEach(o => { if (!PT.verbForm(o)) bad.push(`${id}: 동사 꼴 ‘${o}’를 읽지 못해요`); });
          if (!sent.includes(b.subj)) bad.push(`${id}: 주어 ‘${b.subj}’가 문장에 없어요`);
          if (b.obj && !sent.includes(b.obj)) bad.push(`${id}: 목적어 ‘${b.obj}’가 문장에 없어요`);
          if (!b.clues || !b.clues.length) bad.push(`${id}: 시간 단서가 없어요`);
          (b.clues || []).forEach(c => { if (!has(c.s, c.t)) bad.push(`${id}: 단서 ‘${c.t}’가 ${c.s}번 문장에 없어요`); if (c.event && !P.date) bad.push(`${id}: 글을 쓴 날(date)이 없어요`); });
          const ws = new Set((b.clues || []).map(c => clueWhen(b, c)));
          if (ws.size > 1) bad.push(`${id}: 단서끼리 시간이 달라요 ${[...ws]}`);
          if (TIMEWORD.test(sent.replace(`[${b.n}]`, ''))) bad.push(`${id}: 빈칸 문장 안에 시간 단서가 있어요 → Part 5 문제예요`);
          if (b.trap && !has(b.trap.s, b.trap.t)) bad.push(`${id}: 함정 ‘${b.trap.t}’가 문장에 없어요`);
        } else if (b.type === 'link') {
          b.opts.forEach(o => { if (!PT.link(o)) bad.push(`${id}: ‘${o}’가 연결어 사전에 없어요`); });
          if (!sent.startsWith(`[${b.n}],`)) bad.push(`${id}: 접속부사 빈칸은 문장 맨 앞 + 쉼표여야 해요`);
          if (!has(b.clue.s, b.clue.t)) bad.push(`${id}: 단서 ‘${b.clue.t}’가 ${b.clue.s}번 문장에 없어요`);
          if (!sent.includes(b.here)) bad.push(`${id}: ‘${b.here}’가 빈칸 문장에 없어요`);
          const rs = b.opts.map(o => PT.link(o)).filter(d => d && d.k === 'adv').map(d => d.r);
          if (new Set(rs).size !== rs.length) bad.push(`${id}: 같은 관계의 접속부사가 둘이에요`);
        } else {
          if (sent !== `[${b.n}]`) bad.push(`${id}: 문장 넣기 빈칸은 문장 전체여야 해요`);
          if (!has(b.prev.s, b.prev.t)) bad.push(`${id}: 앞 단서 ‘${b.prev.t}’가 문장에 없어요`);
          if (b.next && !has(b.next.s, b.next.t)) bad.push(`${id}: 뒤 단서 ‘${b.next.t}’가 문장에 없어요`);
          if (b.prev.s !== b.s - 1 || (b.next && b.next.s !== b.s + 1)) bad.push(`${id}: 앞뒤 단서는 바로 앞뒤 문장에 있어야 해요`);
          b.opts.forEach((o, k) => {
            o.ptrs.forEach(p => { if (!o.t.includes(p.t)) bad.push(`${id} (${'ABCD'[k]}): 가리키는 말 ‘${p.t}’가 문장에 없어요`); if (!PT.NEED[p.need]) bad.push(`${id}: 모르는 짝 ‘${p.need}’`); });
            if (!PT.TOPIC[o.topic]) bad.push(`${id}: 모르는 주제 ‘${o.topic}’`);
            if (o.clash && !has(o.clash.s, o.clash.t)) bad.push(`${id}: 어긋나는 말 ‘${o.clash.t}’가 문장에 없어요`);
            if (o.same && !P.sents.some(s => s.toLowerCase().includes(o.same.toLowerCase()))) bad.push(`${id}: 같은 낱말 ‘${o.same}’가 글에 없어요`);
            if (!/[.?!]$/.test(o.t)) bad.push(`${id}: 보기 문장이 마침표로 끝나지 않아요`);
          });
          if (b.opts[b.a].t !== undefined && P.ko.length && P.ko[b.s] !== b.opts[b.a].ko) bad.push(`${id}: 해석이 정답 보기와 달라요`);
        }
        // 엔진과 데이터 대조
        const a1 = PT.alone(b);
        if (b.alone && b.alone.join() !== a1.join()) bad.push(`${id}: ①단계 뒤 남는 보기 — 데이터 ${b.alone}, 규칙 엔진 ${a1}`);
        if (a1.length < 2) bad.push(`${id}: 빈칸 문장만으로 답이 정해져요 → 글이 필요 없는 문제예요`);
        const good = PT.cands(b);
        if (good.length !== 1 || good[0] !== b.a) bad.push(`${id}: 정답 ${b.a}, 규칙 엔진 ${JSON.stringify(good)}`);
        if (!a1.includes(b.a)) bad.push(`${id}: 정답이 ①단계에서 지워져요`);
      });
      if (P.ko.length && P.ko.length !== P.sents.length) bad.push(`${P.id}: 해석 수가 문장 수와 달라요`);
      if (nums.length !== P.blanks.length) bad.push(`${P.id}: 빈칸 표시 수와 빈칸 데이터 수가 달라요`);
    });
    const items = PT.drillItems();
    if (items.length !== 16) bad.push(`연습 문제가 ${items.length}개예요 (16개여야 해요)`);
    PT.DRILL.forEach(pid => { const P = PT.P[pid]; if (P.blanks.length !== 4 || P.blanks.filter(b => b.type === 'insert').length !== 1) bad.push(`${pid}: 빈칸 넷, 문장 넣기 하나여야 해요`); });
    const pos = [0, 0, 0, 0]; items.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 1) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    const ty = { tense: 0, link: 0, insert: 0 }; items.forEach(it => ty[it.type]++);
    if (ty.insert !== 4 || ty.tense < 5 || ty.link < 5) bad.push('연습 문제 유형 수: ' + JSON.stringify(ty));
    if (PT.POS.has.map((_, k) => PT.fitsAt(k)).filter(Boolean).length !== 1) bad.push('자리 고르기: 들어갈 자리가 하나가 아니에요');
    if (!PT.POS.sent.includes(PT.POS.ptr)) bad.push('자리 고르기: 가리키는 말이 문장에 없어요');
    bad.forEach(m => console.warn('[Part 6] ' + m));
    return bad;
  };
})();
