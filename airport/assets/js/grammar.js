/* 공항 회화 — 규칙 엔진과 대화 자료 (상황별 영어 회화 · 시범 튜토리얼)
 *
 * 공항 직원의 질문은 곳마다 거의 정해져 있어요. 규칙 엔진은 소리를 듣지 않고, 문제마다 적어 둔
 * ‘질문의 뜻(intent)’과 ‘대답 틀(frame) + 내 정보(slot)’, 그리고 여행 카드(또는 상황)의 사실을 맞춰 봐요.
 *
 * 3단계 말하기 법 — AP.judge(질문, 대답, 카드)
 *   ① 열쇠 낱말 잡기 — 대답이 그 질문(intent)에 맞는 대답인가? (목적 · 기간 · 장소 · 고르기 · 확인 · 지시 · 정보 · 부탁)
 *                      빠르게 말해 못 알아들은 질문(fast)이면 짐작한 대답은 모두 ①에서 탈락 → 다시 묻기
 *   ② 틀에 내 정보 넣기 — 대답 틀이 자연스러운가(한국어를 낱말 그대로 옮긴 틀 · 틀린 문장이면 탈락),
 *                      칸에 넣은 정보가 카드 · 상황의 사실과 맞는가, 가방 묘사의 순서(크기 → 색 → 재료 → 물건)가 맞는가
 *   ③ 공손하게 끝내기 — 명령 · 조르는 말 · 따지는 말(blunt)이나 please 없이 끊긴 말(plain)이면 탈락
 * judge → { ok, stage: 0 | 1 | 2 | 3, why, tag }
 *
 * 영상의 ✓·×, 직접 해 보기, 입국 심사 시뮬레이터, 듣고 대답 고르기, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 AP.check()가 콘솔에 경고를 내요.
 */
(function () {
  'use strict';
  const AP = (window.AP = {});
  const L4 = 'ABCD';

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; if (/[0-9]/.test(s[i])) return '0136781'.includes(s[i]) ? 0xAC01 : 0xAC00; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const wa = s => s + (has(s) ? '과' : '와'), eul = s => s + (has(s) ? '을' : '를'), ig = s => s + (has(s) ? '이' : '가');
  AP.josa = { wa, eul, ig };

  /* =========================================================
     공항 길 일곱 곳 (영상 · 지도 · 아이콘). sp: 그곳 직원의 목소리 (voices.js)
     ========================================================= */
  AP.PLACES = [
    { id: 'checkin', ko: '체크인 카운터', en: 'Check-in', staff: 'desk', sp: 'gb', side: 'dep' },
    { id: 'security', ko: '보안 검색대', en: 'Security', staff: 'guard', sp: 'us', side: 'dep' },
    { id: 'gate', ko: '탑승구', en: 'Gate', staff: 'gate', sp: 'au', side: 'dep' },
    { id: 'plane', ko: '기내', en: 'On the plane', staff: 'crew', sp: 'gb', side: 'dep' },
    { id: 'immig', ko: '입국 심사대', en: 'Immigration', staff: 'officer', sp: 'us', side: 'arr' },
    { id: 'baggage', ko: '수하물 찾는 곳', en: 'Baggage claim', staff: 'desk', sp: 'ca', side: 'arr' },
    { id: 'customs', ko: '세관', en: 'Customs', staff: 'officer', sp: 'au', side: 'arr' },
  ];
  AP.PLACE = {}; AP.PLACES.forEach((p, i) => { p.i = i; AP.PLACE[p.id] = p; });
  AP.ME = 'me';   // 여행자(나)의 목소리

  /* =========================================================
     질문의 종류(① 열쇠 낱말이 알려 주는 것)와 질문의 뜻(intent)
     ========================================================= */
  AP.ASK = {
    purpose: { ko: '목적', say: '왜 왔는지(목적)를 물어요' },
    length: { ko: '기간', say: '얼마나 머무는지(기간)를 물어요' },
    place: { ko: '장소', say: '어디에 머무는지(장소)를 물어요' },
    choice: { ko: '고르기', say: '둘 가운데 하나를 고르라는 말이에요' },
    yesno: { ko: '확인', say: '그런지 아닌지 확인하는 질문이에요' },
    order: { ko: '지시', say: '이렇게 하라는 지시예요' },
    info: { ko: '정보', say: '정보 하나를 묻는 질문이에요' },
    notice: { ko: '안내', say: '바뀐 것을 알려 주는 안내예요' },
    need: { ko: '부탁', say: '무엇이 필요한지 묻는 말이에요' },
    repair: { ko: '다시 묻기', say: '다시 묻는 말이에요' },
  };
  // ans: 이 뜻의 질문을 한국어로 (① 탈락 까닭: "이 대답은 ○○에 맞는 말이에요")
  // want: 기대하는 대답 한 줄 · best: 모범 대답 틀(카드에 따라 바뀌면 함수)
  const I = (ask, ans, want, best, o = {}) => Object.assign({ ask, ans, want, best }, o);
  AP.INTENT = {
    passport: I('order', '여권을 달라는 말', '여권을 건네며 → Here you are.', 'pp_here'),
    pass: I('order', '탑승권을 보여 달라는 말', '탑승권을 건네며 → Sure. Here you are.', 'ps_here', { say: '탑승권을 보여 달라는 부탁이에요' }),
    seat: I('choice', '자리를 고르라는 질문(Window or aisle?)', '고른 것 + please → Window, please.', 'seat_pl'),
    bags: I('yesno', '부칠 짐이 있는지 묻는 질문', '있으면 Yes, just one. 없으면 No, just this carry-on.', c => c.bags === 0 ? 'bg_none' : c.bags === 2 ? 'bg_two' : 'bg_one', { say: '부칠 짐이 있는지 확인하는 질문이에요' }),
    laptop: I('order', '지시(…하세요)', '그대로 하면서 → Okay.', 'or_ok'),
    belt: I('order', '지시(…하세요)', '그대로 하면서 → Okay.', 'or_ok'),
    step: I('order', '지시(…하세요)', '그대로 하면서 → Okay.', 'or_ok'),
    shoes: I('order', '지시(…하세요)', '그대로 하면서 → Okay.', 'or_ok'),
    liquid: I('yesno', '액체가 있는지 묻는 질문', '없으면 No, I don\'t. 있으면 Yes, just this water.', c => c.liquid ? 'lq_yes' : 'lq_no', { say: '액체가 있는지 확인하는 질문이에요' }),
    gate: I('notice', '바뀐 탑승구 안내', '들은 숫자를 되물어 확인 → Gate 50? Thank you.', 'gt_conf'),
    meal: I('choice', '식사를 고르라는 질문', '고른 것 + please → Chicken, please.', 'ml_pl'),
    drink: I('choice', '마실 것을 권하는 말', '원하는 것 + please → Water, please.', 'dr_pl', { say: '마실 것을 권하는 말이에요. 원하는 것을 골라요' }),
    help: I('need', '무엇이 필요한지 묻는 말', '필요한 것을 부탁 → Could I have ___, please?', c => c.need === 'lostbag' ? 'hp_lost' : 'hp_could'),
    purpose: I('purpose', '방문 목적을 묻는 질문(purpose)', 'I\'m here for … 또는 Sightseeing. 처럼 짧게', 'pu_here'),
    length: I('length', '기간을 묻는 질문(How long)', 'For + 기간 → For five days.', 'le_for'),
    stay: I('place', '머무는 곳을 묻는 질문(Where … staying)', 'At + 장소 → At the Maple Hotel.', 'st_at'),
    first: I('yesno', '첫 방문인지 묻는 질문(first visit)', '처음이면 Yes, it\'s my first time.', c => c.first === false ? 'fi_no' : 'fi_yes', { say: '처음 온 것인지 확인하는 질문이에요' }),
    job: I('info', '하는 일(직업)을 묻는 질문', 'I\'m a(an) + 직업 → I\'m a student.', 'jb_a', { say: '하는 일(직업)을 물어요' }),
    ret: I('yesno', '돌아가는 표를 묻는 질문(return ticket)', '있으면 Yes + 떠나는 날 → Yes, I\'m leaving on May 8.', c => c.retDate ? 'rt_date' : 'rt_here', { say: '돌아가는 표가 있는지 확인하는 질문이에요' }),
    flight: I('info', '타고 온 항공편을 묻는 질문(Which flight)', 'Flight + 번호 → Flight 207.', 'fl', { say: '타고 온 항공편을 물어요' }),
    describe: I('info', '가방 모양을 묻는 질문(describe)', '크기 → 색 → 물건 + with 특징', 'ds', { say: '가방이 어떻게 생겼는지 말해 달래요' }),
    declare: I('yesno', '신고할 물건을 묻는 질문(declare)', '없으면 No, nothing to declare.', c => c.declare ? 'de_yes' : 'de_no', { say: '신고할 물건이 있는지 확인하는 질문이에요' }),
    food: I('yesno', '음식을 가져왔는지 묻는 질문', '없으면 No, I\'m not. 있으면 Yes, I have some ___.', c => c.food ? 'fd_yes' : 'fd_no', { say: '음식을 가져왔는지 확인하는 질문이에요' }),
    repair: I('repair', '다시 묻는 말', '', 'rp_again'),
    // 다른 질문에 맞는 대답 (① 함정에만 쓰고 질문으로는 나오지 않음)
    g_yes: I('yesno', 'Yes · No로 묻는 질문', '', null, { generic: true }),
    g_offer: I('yesno', '무엇을 권하는 말(…드릴까요?)', '', null, { generic: true }),
    g_permit: I('yesno', '허락을 묻는 질문(Can I …? → 해도 돼요?)', '', null, { generic: true }),
    g_where: I('place', '물건이 어디에 있는지 묻는 질문', '', null, { generic: true }),
    g_have: I('yesno', '가지고 있는지 묻는 질문(Do you have …?)', '', null, { generic: true }),
  };
  AP.sayOf = intent => { const it = AP.INTENT[intent]; return it.say || AP.ASK[it.ask].say; };

  /* =========================================================
     질문 (직원이 하는 말). key: 열쇠 낱말(질문 안에 꼭 있어야 함) · fast: 너무 빨라 못 알아들은 말
     ========================================================= */
  AP.Q = {};
  const Q = (id, place, intent, en, ko, key, o = {}) => (AP.Q[id] = Object.assign({ id, place, intent, en, ko, key, sp: AP.PLACE[place].sp }, o));
  Q('ci_pass', 'checkin', 'passport', 'Passport, please.', '여권 주세요.', ['Passport']);
  Q('ci_seat', 'checkin', 'seat', 'Window or aisle?', '창가 자리로 드릴까요, 통로 자리로 드릴까요?', ['Window or aisle']);
  Q('ci_bags', 'checkin', 'bags', 'Are you checking any bags?', '부칠 짐이 있으세요?', ['checking any bags']);
  Q('se_laptop', 'security', 'laptop', 'Please take your laptop out of your bag.', '가방에서 노트북을 꺼내 주세요.', ['take your laptop out'], { short: 'Please take your laptop out.' });
  Q('se_belt', 'security', 'belt', 'Take off your belt, please.', '벨트를 풀어 주세요.', ['Take off your belt']);
  Q('se_liquid', 'security', 'liquid', 'Do you have any liquids in your bag?', '가방에 액체가 있나요?', ['any liquids']);
  Q('se_any', 'security', 'liquid', 'Any liquids?', '액체 있어요?', ['liquids']);
  Q('se_step', 'security', 'step', 'Step forward, please.', '앞으로 나오세요.', ['Step forward']);
  Q('se_shoes', 'security', 'shoes', 'Please take off your shoes.', '신발을 벗어 주세요.', ['take off your shoes']);
  Q('ga_change', 'gate', 'gate', 'Your gate has changed. Flight 207 now leaves from Gate 50.', '탑승구가 바뀌었어요. 207편은 이제 50번 탑승구에서 출발해요.', ['Gate 50'], { fact: { gate: 50 } });
  Q('ga_pass', 'gate', 'pass', 'May I see your boarding pass, please?', '탑승권을 보여 주시겠어요?', ['boarding pass'], { short: 'May I see your boarding pass?' });
  Q('ga_board', 'gate', null, 'Flight 207 is now boarding.', '207편 탑승을 시작합니다.', ['now boarding'], { notice: true });
  Q('pl_meal', 'plane', 'meal', 'Chicken or beef?', '닭고기로 드릴까요, 소고기로 드릴까요?', ['Chicken or beef']);
  Q('pl_drink', 'plane', 'drink', 'Something to drink?', '마실 것 드릴까요?', ['to drink']);
  Q('pl_help', 'plane', 'help', 'Yes? Can I help you?', '네, 무엇을 도와드릴까요?', ['help']);
  Q('im_pass', 'immig', 'passport', 'Hello. Passport, please.', '안녕하세요. 여권 주세요.', ['Passport']);
  Q('im_purpose', 'immig', 'purpose', 'What\'s the purpose of your visit?', '방문 목적이 무엇인가요?', ['purpose']);
  Q('im_length', 'immig', 'length', 'How long will you be staying?', '얼마나 머무를 건가요?', ['How long']);
  Q('im_stay', 'immig', 'stay', 'Where are you staying?', '어디에서 머무나요?', ['Where', 'staying']);
  Q('im_first', 'immig', 'first', 'Is this your first visit?', '이번이 첫 방문인가요?', ['first visit']);
  Q('im_job', 'immig', 'job', 'What do you do?', '무슨 일을 하세요?', ['What do you do']);
  Q('im_ret', 'immig', 'ret', 'Do you have a return ticket?', '돌아가는 항공권이 있나요?', ['return ticket']);
  Q('im_fast', 'immig', 'stay', 'And where will you be staying while you\'re in Seattle?', '그리고 시애틀에 있는 동안 어디서 머무를 건가요?', ['where', 'staying'], { fast: true });
  Q('ba_help', 'baggage', 'help', 'Hi. How can I help you?', '안녕하세요. 무엇을 도와드릴까요?', ['help']);
  Q('ba_flight', 'baggage', 'flight', 'Which flight were you on?', '어느 항공편을 타고 오셨어요?', ['Which flight']);
  Q('ba_desc', 'baggage', 'describe', 'Can you describe your bag?', '가방이 어떻게 생겼는지 말씀해 주시겠어요?', ['describe']);
  Q('cu_declare', 'customs', 'declare', 'Do you have anything to declare?', '신고할 물건이 있나요?', ['declare']);
  Q('cu_any', 'customs', 'declare', 'Anything to declare?', '신고할 것 있어요?', ['declare']);
  Q('cu_food', 'customs', 'food', 'Are you bringing any food?', '음식을 가져오셨나요?', ['food']);
  Q('cu_fast2', 'customs', 'declare', 'Did you pack these bags yourself, and is everything in them yours?', '이 가방들은 직접 싸셨고, 안에 든 것은 모두 본인 것인가요?', ['pack these bags'], { fast: true });
  Q('cu_fast', 'customs', 'food', 'Are you carrying any fruit, meat, or plants with you today?', '오늘 과일이나 고기, 식물을 가지고 계신가요?', ['fruit, meat, or plants'], { fast: true });
  // 곳마다 대표 질문 (영상 01장 지도 · 직접 해 보기)
  AP.ROUTE = {
    checkin: ['ci_pass', 'ci_seat', 'ci_bags'], security: ['se_laptop', 'se_any', 'se_step'], gate: ['ga_pass', 'ga_board'],
    plane: ['pl_meal', 'pl_drink'], immig: ['im_purpose', 'im_length', 'im_stay'], baggage: ['ba_flight', 'ba_desc'], customs: ['cu_any', 'cu_food'],
  };

  /* =========================================================
     칸에 넣는 내 정보 (slot). 틀(frame)이 form으로 어느 꼴을 쓸지 정해요
     ========================================================= */
  AP.SLOT = {
    seat: { key: 'seat', vals: { window: { t: 'Window', low: 'window', ko: '창가' }, aisle: { t: 'Aisle', low: 'aisle', ko: '통로' } } },
    meal: { key: 'meal', vals: { chicken: { t: 'Chicken', low: 'chicken', ko: '닭고기' }, beef: { t: 'Beef', low: 'beef', ko: '소고기' }, fish: { t: 'Fish', low: 'fish', ko: '생선' } } },
    drink: { key: 'drink', vals: { water: { t: 'Water', low: 'water', ko: '물' }, juice: { t: 'Orange juice', low: 'orange juice', ko: '오렌지 주스' }, coffee: { t: 'Coffee', low: 'coffee', ko: '커피' } } },
    need: { key: 'need', vals: { water: { t: 'some water', ko: '물' }, blanket: { t: 'a blanket', ko: '담요' }, pillow: { t: 'another pillow', ko: '베개 하나 더' }, pen: { t: 'a pen', ko: '펜' } } },
    purpose: { key: 'purpose', vals: {
      sightseeing: { here: 'for sightseeing', short: 'Sightseeing', lit: 'trip', ko: '관광' },
      business: { here: 'on business', short: 'Business', lit: 'business', ko: '출장' },
      family: { here: 'to visit my family', short: 'Visiting my family', lit: 'family visit', ko: '가족 방문' },
      conference: { here: 'for a conference', short: 'For a conference', lit: 'conference', ko: '학회 참석' },
    } },
    days: { key: 'length', num: true, vals: { 3: { t: 'three days', ko: '3일' }, 5: { t: 'five days', ko: '5일' }, 7: { t: 'a week', ko: '일주일(7일)' }, 10: { t: 'ten days', ko: '10일' }, 14: { t: 'two weeks', ko: '2주(14일)' } } },
    hotel: { key: 'stay', vals: {
      maple: { at: 'the Maple Hotel', lit: 'Maple Hotel', name: 'Maple Hotel', ko: '메이플 호텔' },
      harbor: { at: 'the Harbor Hotel', lit: 'Harbor Hotel', name: 'Harbor Hotel', ko: '하버 호텔' },
      river: { at: 'the Riverside Hotel', lit: 'Riverside Hotel', name: 'Riverside Hotel', ko: '리버사이드 호텔' },
      sunrise: { at: 'the Sunrise Hotel', lit: 'Sunrise Hotel', name: 'Sunrise Hotel', ko: '선라이즈 호텔' },
      aunt: { at: 'my aunt\'s house', lit: 'aunt house', name: 'aunt\'s house', ko: '이모 집' },
    } },
    job: { key: 'job', vals: {
      student: { a: 'a student', bare: 'student', ko: '대학생' }, engineer: { a: 'an engineer', bare: 'engineer', ko: '엔지니어' },
      teacher: { a: 'a teacher', bare: 'teacher', ko: '교사' }, nurse: { a: 'a nurse', bare: 'nurse', ko: '간호사' }, designer: { a: 'a designer', bare: 'designer', ko: '디자이너' },
    } },
    // 떠나는 날 (도착 5월 3일 + 머무는 날)
    date: { key: 'retDate', vals: {
      may6: { t: 'May 6', ko: '5월 6일', say: 'May sixth' }, may8: { t: 'May 8', ko: '5월 8일', say: 'May eighth' }, may10: { t: 'May 10', ko: '5월 10일', say: 'May tenth' },
      may13: { t: 'May 13', ko: '5월 13일', say: 'May thirteenth' }, may17: { t: 'May 17', ko: '5월 17일', say: 'May seventeenth' },
    } },
    goods: { key: 'goods', vals: { snacks: { t: 'snacks', ko: '과자' }, kimchi: { t: 'kimchi', ko: '김치' }, tea: { t: 'ginseng tea', ko: '인삼차' } } },
    num: { key: 'gate', num: true, vals: { 13: { t: '13', ko: '13' }, 30: { t: '30', ko: '30' }, 15: { t: '15', ko: '15' }, 50: { t: '50', ko: '50' } } },
    flight: { key: 'flight', num: true, vals: { 207: { t: '207', ko: '207' }, 702: { t: '702', ko: '702' }, 270: { t: '270', ko: '270' } } },
  };
  AP.ARRIVE = { t: 'May 3', ko: '5월 3일' };
  AP.dateFor = days => ({ 3: 'may6', 5: 'may8', 7: 'may10', 10: 'may13', 14: 'may17' })[days];
  const NEED_KO = { lostbag: '가방이 안 나와 찾기' };

  /* ---------- 가방 묘사: 크기 → 색 → 재료 → 물건 + with 특징 (단순화한 순서) ---------- */
  AP.ADJ = {
    large: { c: 'size', ko: '큰' }, small: { c: 'size', ko: '작은' }, 'medium-sized': { c: 'size', ko: '중간 크기' },
    black: { c: 'color', ko: '검은' }, red: { c: 'color', ko: '빨간' }, blue: { c: 'color', ko: '파란' }, silver: { c: 'color', ko: '은색' }, brown: { c: 'color', ko: '갈색' },
    leather: { c: 'material', ko: '가죽' },
    suitcase: { c: 'thing', ko: '여행 가방' }, backpack: { c: 'thing', ko: '배낭' }, bag: { c: 'thing', ko: '가방' },
  };
  AP.WITH = { redtag: { t: 'a red tag', ko: '빨간 이름표' }, bluetag: { t: 'a blue tag', ko: '파란 이름표' }, blacktag: { t: 'a black tag', ko: '검은 이름표' }, ribbon: { t: 'a yellow ribbon', ko: '노란 리본' }, wheels: { t: 'four wheels', ko: '바퀴 넷' } };
  AP.CAT = { size: { ko: '크기', n: 1 }, color: { ko: '색', n: 2 }, material: { ko: '재료', n: 3 }, thing: { ko: '물건', n: 4 } };
  // words: 크기 · 색 · 재료 · 물건 낱말을 말한 순서대로
  AP.bagOrder = function (words) {
    const cats = words.map(w => (AP.ADJ[w] || {}).c);
    if (cats.some(c => !c)) return { ok: false, why: '사전에 없는 낱말이 있어요.' };
    const things = cats.filter(c => c === 'thing').length;
    if (things !== 1) return { ok: false, why: things ? '물건 이름은 하나만 말해요.' : '물건 이름(suitcase · backpack · bag)이 빠졌어요.' };
    const want = words.slice().sort((a, b) => AP.CAT[AP.ADJ[a].c].n - AP.CAT[AP.ADJ[b].c].n);
    for (let i = 1; i < cats.length; i++) {
      if (AP.CAT[cats[i]].n < AP.CAT[cats[i - 1]].n) {
        const a = words[i - 1], b = words[i];
        const why = cats[i - 1] === 'thing' ? `물건 이름(${a})은 꾸미는 말 뒤, 맨 끝에 와요.` : `${ig(AP.CAT[cats[i]].ko + '(' + b + ')')} ${AP.CAT[cats[i - 1]].ko}(${a})보다 앞이에요.`;
        return { ok: false, why: `순서가 어색해요. ${why} 순서 → 크기 → 색 → 재료 → 물건: a ${want.join(' ')}.`, want };
      }
    }
    return { ok: true, why: `순서 → ${cats.map(c => AP.CAT[c].ko).join(' → ')}. 자연스러워요.`, want };
  };
  const bagFacts = b => { const f = {}; b.words.forEach(w => { const c = AP.ADJ[w] && AP.ADJ[w].c; if (c && !f[c]) f[c] = w; }); if (b.with) f.with = b.with; return f; };
  AP.bagFacts = bagFacts;
  AP.bagKo = b => { const f = bagFacts(b); return [f.size && AP.ADJ[f.size].ko, f.color && AP.ADJ[f.color].ko, f.material && AP.ADJ[f.material].ko, f.thing && AP.ADJ[f.thing].ko].filter(Boolean).join(' ') + (f.with ? `, ${AP.WITH[f.with].ko}` : ''); };

  /* =========================================================
     대답 틀 (frame). t: 틀 글 — ___ = 내 정보 칸, {…} = 공손한 말 / tag: ok · literal(한국어 그대로) · wrong(틀린 문장) · blunt(무례 · 조르기 · 따지기) · plain(please 없이 끊김)
     ========================================================= */
  AP.FRAME = {};
  const FR = (id, intent, t, ko, o = {}) => (AP.FRAME[id] = Object.assign({ id, intent, t, ko, tag: 'ok' }, o));
  // 체크인 · 탑승구
  FR('pp_here', 'passport', 'Here you are.', '여기 있어요.');
  FR('ps_here', 'pass', 'Sure. Here you are.', '네, 여기 있어요.');
  FR('ps_see', 'pass', 'Yes, you can see.', '(어색한 말) 네, 보셔도 돼요.', { tag: 'literal', why: 'May I see …?를 ‘봐도 돼요?’로 듣고 허락해 주는 말이에요. 실제로는 ‘보여 주세요’라는 부탁이라 건네면서 → Sure. Here you are.' });
  FR('pp_take', ['passport', 'pass'], 'Take it.', '(무례한 말) 가져가세요.', { tag: 'blunt', why: '‘가져가세요’를 그대로 옮긴 말이에요. 명령처럼 들려요. 건네면서 → Here you are.' });
  FR('seat_pl', 'seat', '___, {please}.', '___ 자리로 주세요.', { slot: 'seat' });
  FR('seat_give', 'seat', 'Give me ___.', '(무례한 말) ___ 줘요.', { slot: 'seat', form: 'low', tag: 'blunt', why: '‘창가 주세요’를 그대로 옮긴 말이에요. Give me로 시작하면 명령처럼 들려요. 고른 것 + please → Window, please.' });
  FR('bg_one', 'bags', 'Yes, just one.', '네, 하나요.', { fact: { bags: 1 } });
  FR('bg_two', 'bags', 'Yes, two bags.', '네, 가방 두 개요.', { fact: { bags: 2 } });
  FR('bg_none', 'bags', 'No, just this carry-on.', '아니요, 이 기내용 가방뿐이에요.', { fact: { bags: 0 } });
  FR('bg_lit', 'bags', 'Yes, one baggage.', '(틀린 말) 네, 짐 하나요.', { fact: { bags: 1 }, tag: 'literal', why: 'baggage는 셀 수 없는 말이라 one baggage라고 하지 않아요. 짧게 → Yes, just one.' });
  // 보안 검색
  FR('or_ok', ['laptop', 'belt', 'step', 'shoes'], 'Okay.', '네.');
  FR('or_okm', ['laptop', 'belt', 'shoes'], 'Okay. One moment.', '네, 잠시만요.');
  FR('or_why', ['laptop', 'belt', 'step', 'shoes'], 'Why?', '(따지는 말) 왜요?', { tag: 'blunt', why: '지시에 Why?로 받으면 따지는 말처럼 들려요. 보안 검색의 지시는 그대로 하면서 → Okay.' });
  FR('lq_no', 'liquid', 'No, I don\'t.', '아니요, 없어요.', { fact: { liquid: false } });
  FR('lq_yes', 'liquid', 'Yes, just this water.', '네, 이 물 하나요.', { fact: { liquid: true } });
  FR('gt_conf', 'gate', 'Gate ___? {Thank you}.', '___번 탑승구요? 고마워요.', { slot: 'num' });
  // 기내
  FR('ml_pl', 'meal', '___, {please}.', '___로 주세요.', { slot: 'meal' });
  FR('ml_give', 'meal', 'Give me ___.', '(무례한 말) ___ 줘요.', { slot: 'meal', form: 'low', tag: 'blunt', why: '‘소고기 주세요’를 그대로 옮긴 말이에요. 명령처럼 들려요. 고른 것 + please → Beef, please.' });
  FR('dr_pl', 'drink', '___, {please}.', '___ 주세요.', { slot: 'drink' });
  FR('dr_want', 'drink', 'I want ___.', '(조르는 말) ___ 원해요.', { slot: 'drink', form: 'low', tag: 'blunt', why: 'I want는 원한다는 사실만 말해서 조르는 말처럼 들려요. 원하는 것 + please → Water, please.' });
  FR('hp_could', 'help', '{Could I} have ___, {please}?', '___ 주시겠어요?', { slot: 'need' });
  FR('hp_give', 'help', 'Give me ___.', '(무례한 말) ___ 줘요.', { slot: 'need', tag: 'blunt', why: '‘물 주세요’를 그대로 옮긴 말이에요. Give me는 명령처럼 들려요. 부탁은 질문으로 → Could I have ___, please?' });
  FR('hp_want', 'help', 'I want ___.', '(조르는 말) ___ 원해요.', { slot: 'need', tag: 'blunt', why: 'I want는 원한다는 사실만 말해서 조르는 말처럼 들려요. 부탁은 질문으로 → Could I have ___, please?' });
  FR('hp_lost', 'help', '{Excuse me}. My suitcase didn\'t come out.', '실례지만, 제 여행 가방이 안 나왔어요.', { fact: { need: 'lostbag' } });
  FR('hp_lostlit', 'help', 'My bag is not come.', '(틀린 말) 제 가방이 안 왔어요.', { fact: { need: 'lostbag' }, tag: 'literal', why: '‘안 나왔어요’를 낱말 그대로 옮긴 틀린 말이에요. 지난 일은 didn\'t + 동사원형 → My suitcase didn\'t come out.' });
  // 입국 심사
  FR('pu_here', 'purpose', 'I\'m here ___.', '___ 왔어요.', { slot: 'purpose', form: 'here' });
  FR('pu_short', 'purpose', '___.', '___요.', { slot: 'purpose', form: 'short' });
  FR('pu_lit', 'purpose', 'My purpose is ___.', '(어색한 말) 제 목적은 ___이에요.', { slot: 'purpose', form: 'lit', tag: 'literal', why: '‘제 목적은 ~이에요’를 낱말 그대로 옮긴 말이에요. 영어로는 → I\'m here for sightseeing. 또는 짧게 Sightseeing.' });
  FR('pu_will', 'purpose', 'I will travel.', '(어색한 말) 여행할 거예요.', { tag: 'literal', why: '‘여행할 거예요’를 옮긴 말이에요. 목적을 묻는 질문에는 → I\'m here for sightseeing.' });
  FR('le_for', 'length', 'For ___.', '___ 동안이요.', { slot: 'days' });
  FR('le_stay', 'length', 'I\'m staying for ___.', '___ 동안 머물러요.', { slot: 'days' });
  FR('le_dur', 'length', 'During ___.', '(틀린 말) ___ 동안이요.', { slot: 'days', tag: 'literal', why: '‘~ 동안’을 during으로 옮겼어요. during 뒤에는 기간이 아니라 일(during my visit)이 와요. 기간은 → for + 기간.' });
  FR('st_at', 'stay', 'At ___.', '___에서요.', { slot: 'hotel', form: 'at' });
  FR('st_lit', 'stay', 'I stay ___.', '(틀린 말) ___ 머물러요.', { slot: 'hotel', form: 'lit', tag: 'literal', why: '‘~에 머물러요’의 ‘에’가 빠졌어요. 장소는 at + the + 호텔 이름 → At the Maple Hotel.' });
  FR('fi_yes', 'first', 'Yes, it\'s my first time.', '네, 처음이에요.', { fact: { first: true } });
  FR('fi_no', 'first', 'No, I\'ve been here before.', '아니요, 전에 와 봤어요.', { fact: { first: false } });
  FR('fi_lit', 'first', 'Yes, it\'s first.', '(틀린 말) 네, 처음이에요.', { fact: { first: true }, tag: 'literal', why: '‘처음이에요’를 낱말 그대로 옮겼어요. 영어로는 → it\'s my first time(제 첫 번째 때).' });
  FR('jb_a', 'job', 'I\'m ___.', '___예요.', { slot: 'job', form: 'a' });
  FR('jb_bare', 'job', 'I am ___.', '(틀린 말) ___예요.', { slot: 'job', form: 'bare', tag: 'literal', why: '한국어에는 a가 없어서 빠뜨리기 쉬워요. 직업 앞에는 a(an) → I\'m a student.' });
  FR('jb_why', 'job', 'Why do you ask?', '(따지는 말) 왜 물어보세요?', { tag: 'blunt', why: '심사관의 질문에 되물으면 따지는 말처럼 들려요. 사실대로 짧게 답해요.' });
  FR('rt_here', 'ret', 'Yes, here it is.', '네, 여기 있어요.', { fact: { ret: true } });
  FR('rt_date', 'ret', 'Yes, I\'m leaving on ___.', '네, ___에 떠나요.', { slot: 'date', fact: { ret: true } });
  FR('rt_lit', 'ret', 'Yes, I have a back ticket.', '(어색한 말) 네, 돌아가는 표 있어요.', { fact: { ret: true }, tag: 'literal', why: '‘돌아가는 표’를 back ticket으로 옮겼어요. 영어로는 return ticket. 떠나는 날을 말하면 더 좋아요 → Yes, I\'m leaving on + 날짜.' });
  FR('g_yesiam', 'g_yes', 'Yes, I am.', '네, 그래요.');
  FR('g_yes', 'g_yes', 'Yes.', '네.');
  // 수하물
  FR('fl', 'flight', 'Flight ___.', '___편이요.', { slot: 'flight' });
  FR('ds', 'describe', 'It\'s a ___.', '', { bag: true });
  // 세관
  FR('de_no', 'declare', 'No, nothing to declare.', '아니요, 신고할 것 없어요.', { fact: { declare: false } });
  FR('de_yes', 'declare', 'Yes, I have some ___.', '네, ___ 조금 있어요.', { slot: 'goods', fact: { declare: true } });
  FR('de_lit', 'declare', 'No declare.', '(틀린 말) 신고 없어요.', { fact: { declare: false }, tag: 'literal', why: 'declare는 ‘신고하다’라는 동사예요. 낱말만 이어 붙이면 말이 안 돼요 → No, nothing to declare.' });
  FR('fd_no', 'food', 'No, I\'m not.', '아니요, 안 가져왔어요.', { fact: { food: false } });
  FR('fd_yes', 'food', 'Yes, I have some ___.', '네, ___ 조금 있어요.', { slot: 'goods', fact: { food: true } });
  // 다시 묻기 (못 알아들었을 때)
  FR('rp_again', 'repair', '{Sorry? Could you} say that again, {please}?', '죄송한데, 다시 한 번 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_sorry', 'repair', '{Sorry}?', '네? (다시 말해 달라는 뜻)', { kind: 'again' });
  FR('rp_slow', 'repair', '{Could you} speak more slowly, {please}?', '조금 더 천천히 말씀해 주시겠어요?', { kind: 'slow' });
  FR('rp_rude', 'repair', 'Speak slowly!', '(화난 말) 천천히 말해요!', { kind: 'slow', tag: 'blunt', why: '명령문만 쓰면 화난 것처럼 들려요. 부탁은 → Could you speak more slowly, please?' });
  FR('rp_noeng', 'repair', 'I can\'t English.', '(틀린 말) 저 영어 못 해요.', { kind: 'none', tag: 'wrong', why: 'speak가 빠진 틀린 말이에요(I can\'t speak English well). 이럴 때는 다시 물어보는 말이 더 도움이 돼요.' });
  // 다른 질문에 맞는 대답 (① 함정)
  FR('g_yesplease', 'g_offer', 'Yes, {please}.', '네, 주세요.');
  FR('g_nothx', 'g_offer', 'No, {thank you}.', '아니요, 괜찮아요.');
  FR('g_permit', 'g_permit', 'Yes, you can.', '네, 그러셔도 돼요.');
  FR('g_where', 'g_where', 'It\'s in my bag.', '가방 안에 있어요.');
  FR('g_have', 'g_have', 'Yes, I have a laptop.', '네, 노트북 있어요.');

  /* ---------- 대답 글 만들기: 조각(segs) = [{ t, r: 'frame' | 'slot' | 'pol' }] ---------- */
  const slotText = (F, v) => { const S = AP.SLOT[F.slot], x = S && S.vals[v]; return x ? x[F.form || 't'] : '___'; };
  AP.segs = function (a) {
    const F = AP.FRAME[a.f]; const out = [];
    if (F.bag) {
      const b = a.bag, art = /^[aeiou]/i.test(b.words[0] || '') ? 'an' : 'a';
      const adj = b.words.slice(0, -1), last = b.words[b.words.length - 1];
      out.push({ t: `It's ${art} `, r: 'frame' });
      if (adj.length) out.push({ t: adj.join(' '), r: 'slot', part: 'adj' }, { t: ' ', r: 'frame' });
      out.push({ t: last, r: 'slot', part: 'thing' });
      if (b.with) out.push({ t: ' with ', r: 'frame' }, { t: AP.WITH[b.with].t, r: 'slot', part: 'with' });
      out.push({ t: '.', r: 'frame' });
      return out;
    }
    const re = /\{([^}]*)\}|___/g; let last = 0, m;
    while ((m = re.exec(F.t))) {
      if (m.index > last) out.push({ t: F.t.slice(last, m.index), r: 'frame' });
      if (m[0] === '___') out.push({ t: slotText(F, a.v), r: 'slot' }); else out.push({ t: m[1], r: 'pol' });
      last = m.index + m[0].length;
    }
    if (last < F.t.length) out.push({ t: F.t.slice(last), r: 'frame' });
    const f0 = out.find(s => s.t.trim());
    if (f0) { const i = f0.t.search(/\S/); f0.t = f0.t.slice(0, i) + f0.t[i].toUpperCase() + f0.t.slice(i + 1); }
    return out;
  };
  AP.text = a => AP.segs(a).map(s => s.t).join('');
  // 해석
  AP.ko = function (a) {
    const F = AP.FRAME[a.f];
    if (F.bag) return `${AP.bagKo(a.bag)}이에요.`;
    if (!F.slot) return F.ko;
    const x = AP.SLOT[F.slot].vals[a.v];
    return F.ko.replace('___', x ? x.ko : '___');
  };
  // 대답이 말하는 사실
  AP.factOf = function (a) {
    const F = AP.FRAME[a.f], f = Object.assign({}, F.fact || {});
    if (F.slot) { const S = AP.SLOT[F.slot]; f[S.key] = S.num ? Number(a.v) : a.v; }
    if (F.bag) f.bag = bagFacts(a.bag);
    return f;
  };
  // 사실을 한국어로
  AP.factKo = function (k, v) {
    const S = Object.values(AP.SLOT).find(s => s.key === k);
    if (k === 'bag') return AP.bagKo({ words: [v.size, v.color, v.material, v.thing].filter(Boolean), with: v.with });
    if (k === 'need' && NEED_KO[v]) return NEED_KO[v];
    if (k === 'length') return (AP.SLOT.days.vals[v] || {}).ko || `${v}일`;
    if (k === 'gate') return `${v}번 탑승구`;
    if (k === 'flight') return `${v}편`;
    if (k === 'first') return v ? '첫 방문' : '전에 와 본 적 있음';
    if (k === 'ret') return v ? '돌아가는 표 있음' : '돌아가는 표 없음';
    if (k === 'bags') return v === 0 ? '부칠 짐 없음' : `부칠 가방 ${v}개`;
    if (k === 'liquid') return v ? '액체 있음' : '액체 없음';
    if (k === 'declare') return v ? '신고할 물건 있음' : '신고할 물건 없음';
    if (k === 'food') return v ? '음식 있음' : '음식 없음';
    if (S && S.vals[v]) return S.vals[v].ko;
    return String(v);
  };
  const BAGK = { size: '크기', color: '색', material: '재료', thing: '물건', with: '특징' };
  const bagPartKo = (k, v) => k === 'with' ? AP.WITH[v].ko : AP.ADJ[v].ko;

  /* =========================================================
     판정 — AP.judge(질문, 대답, 카드, 출처)
     q: AP.Q의 질문(또는 id) · a: { f: 틀 id, v: 칸 값, bag } · card: 사실 · src: '카드' | '상황'
     ========================================================= */
  const res = (ok, stage, why, tag) => ({ ok, stage, why, tag: tag || (ok ? 'ok' : '') });
  AP.judge = function (q, a, card, src = '카드') {
    if (typeof q === 'string') q = AP.Q[q];
    const F = AP.FRAME[a.f], In = AP.INTENT[q.intent], C = Object.assign({}, card || {}, q.fact || {});
    const fi = [].concat(F.intent), key = q.key.join(' … ');
    // ① 열쇠 낱말 잡기
    if (q.fast) {
      if (F.intent !== 'repair') return res(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 묻는지 모르는데 짐작해서 답하면 엉뚱한 대답이 될 수 있어요. 먼저 다시 물어요.', 'guess');
    } else if (!fi.includes(q.intent)) {
      if (F.intent === 'repair') return res(false, 1, '대답이 아니라 다시 묻는 말이에요. 질문을 알아들었다면 바로 답해요.', 'intent');
      return res(false, 1, `열쇠 낱말 ${key} → ${AP.sayOf(q.intent)}. 이 대답은 ${AP.INTENT[fi[0]].ans}에 맞는 말이에요.`, 'intent');
    }
    // ② 틀에 내 정보 넣기
    if (F.tag === 'literal' || F.tag === 'wrong') return res(false, 2, F.why, F.tag);
    if (F.intent === 'repair' && C.asked && F.kind === 'again') return res(false, 2, '이미 한 번 다시 물었는데도 빨라요. 이번에는 천천히 말해 달라고 부탁해요 → Could you speak more slowly, please?', 'fact');
    if (F.bag) {
      const o = AP.bagOrder(a.bag.words);
      if (!o.ok) return res(false, 2, o.why, 'order');
    }
    const fact = AP.factOf(a);
    for (const k of Object.keys(fact)) {
      if (k === 'bag') {
        if (!C.bag) continue;
        for (const p of ['size', 'color', 'material', 'thing', 'with']) {
          if (C.bag[p] && fact.bag[p] !== C.bag[p]) return res(false, 2, `${wa(src)} 달라요. ${BAGK[p]} → ${src}: ${bagPartKo(p, C.bag[p])} · 이 대답: ${fact.bag[p] ? bagPartKo(p, fact.bag[p]) : '없음'}.`, 'fact');
        }
        continue;
      }
      if (C[k] === undefined || C[k] === fact[k]) continue;
      if (k === 'gate') return res(false, 2, `들은 말과 달라요. 직원 → Gate ${C.gate} · 이 대답 → ${fact.gate}. ${C.gate === 50 || fact.gate === 50 ? 'fifteen(15)은 끝을, fifty(50)는 앞을 세게 읽어요.' : '숫자를 다시 들어 봐요.'}`, 'fact');
      return res(false, 2, `${wa(src)} 달라요. ${src}: ${AP.factKo(k, C[k])} · 이 대답: ${AP.factKo(k, fact[k])}.`, 'fact');
    }
    // ③ 공손하게 끝내기
    if (F.tag === 'blunt' || F.tag === 'plain') return res(false, 3, F.why, F.tag);
    // 통과
    const segs = AP.segs(a), pol = segs.filter(s => s.r === 'pol').map(s => s.t);
    let why;
    if (q.fast) why = F.kind === 'slow' ? '두 번째도 빨랐으니 천천히 말해 달라고 공손하게 부탁했어요.' : '못 알아들었을 때는 짐작하지 말고 공손하게 다시 물어요.';
    else if (F.bag) why = `${AP.bagOrder(a.bag.words).why} 카드의 가방과 맞아요.`;
    else {
      const sl = segs.filter(s => s.r === 'slot').map(s => s.t);
      why = `열쇠 낱말 ${key} → ${AP.ASK[In.ask].ko}. ` + (sl.length ? `틀 + 내 정보(${sl.join(' ')}) → ${src}의 사실과 맞아요.` : Object.keys(fact).length ? `${src}의 사실(${Object.keys(fact).map(k => AP.factKo(k, fact[k])).join(' · ')})과 맞아요.` : '짧은 대답이면 충분해요.');
      if (pol.length) why += ` 공손한 말 → ${pol.join(' · ')}.`;
    }
    return res(true, 0, why);
  };
  // 모범 대답 (카드에 맞춰)
  AP.model = function (q, card) {
    if (typeof q === 'string') q = AP.Q[q];
    const C = Object.assign({}, card || {}, q.fact || {});
    if (q.fast) return { f: C.asked ? 'rp_slow' : 'rp_again' };
    const In = AP.INTENT[q.intent], id = typeof In.best === 'function' ? In.best(C) : In.best, F = AP.FRAME[id];
    if (F.bag) { const b = C.bag || { size: 'large', color: 'black', thing: 'suitcase' }; return { f: id, bag: { words: [b.size, b.color, b.material, b.thing].filter(Boolean), with: b.with } }; }
    if (!F.slot) return { f: id };
    const S = AP.SLOT[F.slot], v = C[S.key];
    return { f: id, v: v != null ? String(v) : Object.keys(S.vals)[0] };
  };

  /* =========================================================
     소리 내어 읽을 글 (화면 글 → 음성용). 숫자를 공항식으로 읽어요
     ========================================================= */
  AP.spoken = s => String(s)
    .replace(/Flight 207/g, 'Flight two-oh-seven').replace(/Flight 702/g, 'Flight seven-oh-two').replace(/Flight 270/g, 'Flight two-seventy').replace(/\b207\b/g, 'two-oh-seven')
    .replace(/10:20/g, 'ten twenty').replace(/10:50/g, 'ten fifty').replace(/\b32A\b/g, 'thirty-two A')
    .replace(/May (\d+)\b/g, (m, d) => 'May ' + ({ 3: 'third', 6: 'sixth', 8: 'eighth', 10: 'tenth', 12: 'twelfth', 13: 'thirteenth', 17: 'seventeenth' }[d] || d));

  /* =========================================================
     소리로 한 대답 맞춰 보기 — AP.matchSpoken(들린 글, 질문, 카드)
     음성 인식이 글로 바꾼 말에 그 질문의 표시 낱말과 카드의 사실이 들어 있으면 받아들여요.
     공손함 · 발음은 판정하지 않아요. 한국어 그대로 옮긴 꼴이 들리면 알림만 붙여요.
     ========================================================= */
  const NUMW = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty' };
  const CONTR = [[/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\bwhat's\b/g, 'what is'], [/\bdon't\b/g, 'do not'], [/\bdidn't\b/g, 'did not'], [/\bi've\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\bcan't\b/g, 'cannot'], [/\bi'd\b/g, 'i would'], [/\byou're\b/g, 'you are'], [/\bthat's\b/g, 'that is'], [/\bwon't\b/g, 'will not'], [/\bisn't\b/g, 'is not']];
  // 글 → 낱말 (작은 글자, 줄임말 풀기, 숫자는 낱말로)
  AP.norm = function (s) {
    let t = String(s || '').toLowerCase().replace(/[’‘]/g, '\'');
    CONTR.forEach(([r, w]) => { t = t.replace(r, w); });
    t = t.replace(/(\d+)/g, d => NUMW[+d] || d).replace(/[^a-z0-9' -]+/g, ' ').replace(/-/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '');
    return t.split(/\s+/).filter(Boolean);
  };
  const DAYS_RE = { 3: /\b(three) (days|nights)\b/, 5: /\b(five) (days|nights)\b/, 7: /\b((a|one) week|seven days|seven nights)\b/, 10: /\b(ten) (days|nights)\b/, 14: /\b((two) weeks|fourteen days)\b/ };
  const PURPOSE_RE = { sightseeing: /\b(sightseeing|vacation|holiday|tour|tourism|tourist|travel|traveling|trip)\b/, business: /\b(business|work|meeting|meetings)\b/, family: /\b(family|parents|aunt|uncle|relatives|cousin)\b/, conference: /\b(conference|seminar|meeting)\b/ };
  const SPOKEN = {
    purpose: { mark: /\b(sightseeing|vacation|holiday|tour|tourism|tourist|travel|traveling|trip|business|work|meeting|conference|seminar|visit|visiting|family|study)\b/, fact: c => PURPOSE_RE[c.purpose], lit: [[/\bmy purpose is\b/, 'My purpose is …는 한국어를 그대로 옮긴 말이에요. → I\'m here for …']] },
    length: { mark: /\b(day|days|week|weeks|month|months|night|nights)\b/, fact: c => DAYS_RE[c.length], lit: [[/\bduring\b/, '기간은 during이 아니라 for → For five days.']] },
    stay: { mark: /\b(hotel|house|home|inn|apartment|friend|aunt|uncle|place|stay|staying)\b/, fact: c => c.stay === 'aunt' ? /\baunt/ : new RegExp('\\b' + AP.SLOT.hotel.vals[c.stay].name.split(' ')[0].toLowerCase() + '\\b') },
    job: { mark: /\b(student|engineer|teacher|nurse|designer|work|job)\b/, fact: c => new RegExp('\\b' + c.job + '\\b'), lit: [[/\bi am (student|engineer|teacher|nurse|designer)\b/, '직업 앞의 a(an)가 들리지 않았어요 → I\'m a student. (음성 인식이 a를 빼고 적었을 수도 있어요.)']] },
    first: { mark: /\b(first|before|yes|no|never|again|second|times)\b/, fact: c => c.first ? /\b(first|never|yes)\b/ : /\b(before|no|second|again|times|last)\b/, not: c => c.first ? /\b(been here before|second|no)\b/ : /\b(first time|never|yes it is my first)\b/ },
    ret: { mark: /\b(yes|ticket|return|leaving|back|here|have|may)\b/, fact: () => /\b(yes|here|leaving|back|have|may)\b/, not: () => /\b(no|do not)\b/ },
    declare: { mark: /\b(nothing|no|yes|have|declare)\b/, fact: c => c.declare ? /\b(yes|have)\b/ : /\b(nothing|no)\b/ },
    passport: { mark: /\b(here|yes|sure|okay|passport)\b/, fact: () => /\b(here|sure|okay|yes)\b/ },
  };
  AP.SPOKEN = SPOKEN;
  const SPOKEN_KEY = { purpose: 'purpose', length: 'length', stay: 'stay', job: 'job', first: 'first', ret: 'ret', declare: 'declare' };
  AP.matchSpoken = function (raw, q, card) {
    if (typeof q === 'string') q = AP.Q[q];
    const w = AP.norm(raw), s = ' ' + w.join(' ') + ' ';
    if (!w.length) return { ok: false, stage: 0, why: '들린 말이 없어요. 다시 말해 보세요.', heard: '' };
    if (/\b(say that again|pardon|repeat|more slowly|slow down|sorry)\b/.test(s) && w.length <= 9) return { ok: false, stage: 1, repair: true, why: '다시 묻는 말로 들었어요. 심사관이 질문을 한 번 더 해 줄 거예요.', heard: w.join(' ') };
    const M = SPOKEN[q.intent], C = Object.assign({}, card || {}, q.fact || {});
    if (!M) return { ok: false, stage: 0, why: '이 질문은 말로 대답하기를 지원하지 않아요.', heard: w.join(' ') };
    if (!M.mark.test(s)) return { ok: false, stage: 1, why: `열쇠 낱말 ${q.key.join(' … ')} → ${AP.sayOf(q.intent)}. 들린 말에 그 대답이 없어요.`, heard: w.join(' ') };
    const fr = M.fact(C), fk = SPOKEN_KEY[q.intent];
    if (!fr || !fr.test(s) || (M.not && M.not(C).test(s))) return { ok: false, stage: 2, tag: 'fact', why: fk && C[fk] != null ? `카드와 달라요. 카드의 사실(${AP.factKo(fk, C[fk])})이 들리지 않았어요.` : '대답에 필요한 사실이 들리지 않았어요.', heard: w.join(' ') };
    const notes = (M.lit || []).filter(([r]) => r.test(s)).map(([, n]) => n);
    return { ok: true, stage: 0, why: '열쇠 낱말에 맞는 대답이고 카드의 사실이 들어 있어요.' + (notes.length ? ' 알림: ' + notes.join(' ') : ''), note: notes.join(' '), heard: w.join(' ') };
  };

  /* ---------- 따라 말하기: 낱말 맞춰 보기 (가장 긴 공통 부분열) ---------- */
  // 돌려주는 값: { words: [{ t: 화면 낱말, ok }], hit, total }
  AP.compareWords = function (target, heard) {
    const tw = String(target).split(/\s+/).filter(Boolean), tn = tw.map(x => AP.norm(x).join(' ')), hn = AP.norm(heard);
    // 줄임말이 두 낱말로 풀리면(i'm → i am) 그 묶음 전체로 맞춤
    const tt = []; tn.forEach((n, i) => n.split(' ').filter(Boolean).forEach(p => tt.push({ p, i })));
    const A = tt.map(x => x.p), B = hn, D = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) D[i][j] = A[i] === B[j] ? D[i + 1][j + 1] + 1 : Math.max(D[i + 1][j], D[i][j + 1]);
    const got = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { got.add(i); i++; j++; } else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++; }
    const okW = tw.map((_, k) => { const parts = tt.map((x, n) => [x, n]).filter(([x]) => x.i === k); return parts.length ? parts.every(([, n]) => got.has(n)) : true; });
    return { words: tw.map((t, k) => ({ t, ok: okW[k] })), hit: okW.filter(Boolean).length, total: tw.length };
  };

  /* =========================================================
     여행 카드 (입국 심사 시뮬레이터) — 도착 5월 3일, 시애틀
     ========================================================= */
  AP.NAMES = [['KIM HANEUL', '김하늘'], ['LEE JIWOO', '이지우'], ['PARK SEOYEON', '박서연'], ['CHOI MINJUN', '최민준'], ['JUNG YUNA', '정유나'], ['HAN DOYUN', '한도윤']];
  AP.newCard = function (rnd = Math.random) {
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const purpose = pick(['sightseeing', 'business', 'family', 'conference']);
    const length = pick([3, 5, 7, 10, 14]);
    const stay = purpose === 'family' ? 'aunt' : pick(['maple', 'harbor', 'river', 'sunrise']);
    const job = pick(['student', 'engineer', 'teacher', 'nurse', 'designer']);
    const name = pick(AP.NAMES);
    return { purpose, length, stay, job, first: rnd() < 0.6, ret: true, retDate: AP.dateFor(length), name: name[0], nameKo: name[1] };
  };
  // 심사 질문: 여권 + 넷 (나머지 여섯 가운데)
  AP.SIM_QS = ['im_purpose', 'im_length', 'im_stay', 'im_job', 'im_first', 'im_ret'];
  // 질문마다 틀 칩: 맞는 틀 · 한국어 그대로(또는 무례한) 틀 · 다른 질문의 틀 (+ 사실이 반대인 틀)
  AP.SIM_FRAMES = {
    passport: c => ['pp_here', 'pp_take', 'g_nothx'],
    purpose: c => ['pu_here', 'pu_lit', 'le_for'],
    length: c => ['le_for', 'le_dur', 'st_at'],
    stay: c => ['st_at', 'st_lit', 'le_for'],
    job: c => ['jb_a', 'jb_bare', 'pu_here'],
    first: c => ['fi_yes', 'fi_no', 'fi_lit', 'le_for'],
    ret: c => ['rt_date', 'rt_lit', 'st_at'],
  };
  // 칸 칩: 카드의 값 + 다른 값 둘 (rnd로 고름)
  AP.slotChoices = function (slotType, card, rnd = Math.random) {
    const S = AP.SLOT[slotType], right = card[S.key] != null ? String(card[S.key]) : null;
    const keys = Object.keys(S.vals).filter(k => k !== right);
    for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
    const out = (right ? [right] : []).concat(keys.slice(0, right ? 2 : 3));
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  };
  AP.cardRows = c => [
    ['이름', `${c.nameKo} (${c.name})`],
    ['목적', AP.factKo('purpose', c.purpose)],
    ['기간', `${AP.factKo('length', c.length)} · ${AP.ARRIVE.ko} 도착`],
    ['숙소', AP.factKo('stay', c.stay)],
    ['직업', AP.factKo('job', c.job)],
    ['첫 방문', c.first ? '예 (처음이에요)' : '아니요 (전에 와 봤어요)'],
    ['돌아가는 표', `있어요 · ${AP.factKo('retDate', c.retDate)} 떠나요`],
  ];
  // 심사관의 반응 (단계별)
  AP.REACT = {
    ok: ['Okay.', 'All right.', 'Thank you.', 'I see.'],
    1: q => ({ en: `Sorry, I asked: ${q.en}`, ko: `‘${q.key.join(' … ')}’를 물었어요.` }),
    2: (q, j) => j.tag === 'fact' ? { en: 'Hmm. Are you sure?', ko: '카드를 다시 보세요.' } : { en: 'Sorry?', ko: '알아듣기 어려운 말이에요.' },
    3: () => ({ en: '... Okay.', ko: '뜻은 통했지만 말투가 거칠어요.' }),
  };

  /* =========================================================
     듣고 대답 고르기 16문제 (모두 새로 만든 대화). card = 그 상황의 사실
     ========================================================= */
  const o = (f, v) => (v != null ? { f, v: String(v) } : { f });
  const bag = (words, w) => ({ f: 'ds', bag: { words, with: w } });
  AP.DRILL = [
    { q: 'ci_seat', sit: '창가 자리에 앉고 싶어요.', card: { seat: 'window' }, a: 2, opts: [o('g_yesplease'), o('seat_pl', 'aisle'), o('seat_pl', 'window'), o('seat_give', 'window')] },
    { q: 'ci_bags', sit: '부칠 여행 가방이 하나 있어요.', card: { bags: 1 }, a: 0, opts: [o('bg_one'), o('bg_none'), o('seat_pl', 'window'), o('bg_lit')] },
    { q: 'se_laptop', sit: '가방 안에 노트북이 있어요.', card: {}, a: 3, opts: [o('g_have'), o('g_nothx'), o('or_why'), o('or_okm')] },
    { q: 'se_liquid', sit: '가방에 물이나 화장품 같은 액체가 없어요.', card: { liquid: false }, a: 1, opts: [o('lq_yes'), o('lq_no'), o('g_where'), o('g_nothx')] },
    { q: 'ga_change', sit: '탑승구 앞에서 직원이 다가와 말해요.', card: {}, a: 2, opts: [o('pp_here'), o('gt_conf', 15), o('gt_conf', 50), o('g_nothx')] },
    { q: 'ga_pass', sit: '탑승이 시작되어 줄 맨 앞에 섰어요.', card: {}, a: 0, opts: [o('ps_here'), o('ps_see'), o('pp_take'), o('seat_pl', 'window')] },
    { q: 'pl_meal', sit: '소고기를 먹고 싶어요.', card: { meal: 'beef' }, a: 2, opts: [o('ml_pl', 'chicken'), o('g_yesplease'), o('ml_pl', 'beef'), o('ml_give', 'beef')] },
    { q: 'pl_help', sit: '추워서 승무원을 불렀어요. 담요가 필요해요.', card: { need: 'blanket' }, a: 3, opts: [o('g_permit'), o('hp_could', 'water'), o('hp_want', 'blanket'), o('hp_could', 'blanket')] },
    { q: 'im_purpose', sit: '관광하러 왔어요.', card: { purpose: 'sightseeing' }, a: 1, opts: [o('pu_lit', 'sightseeing'), o('pu_here', 'sightseeing'), o('le_for', 5), o('pu_here', 'business')] },
    { q: 'im_length', sit: '일주일(7일) 머물러요.', card: { length: 7 }, a: 3, opts: [o('st_at', 'maple'), o('le_dur', 7), o('le_for', 14), o('le_for', 7)] },
    { q: 'im_job', sit: '대학생이에요.', card: { job: 'student' }, a: 0, opts: [o('jb_a', 'student'), o('jb_bare', 'student'), o('pu_here', 'sightseeing'), o('jb_why')] },
    { q: 'im_fast', sit: '심사관이 너무 빨리 말해서 하나도 못 알아들었어요.', card: {}, a: 1, opts: [o('g_yes'), o('rp_again'), o('rp_rude'), o('rp_noeng')] },
    { q: 'ba_help', sit: '가방이 끝까지 나오지 않아 안내 데스크에 왔어요.', card: { need: 'lostbag' }, a: 3, opts: [o('hp_lostlit'), o('g_permit'), o('hp_could', 'water'), o('hp_lost')] },
    { q: 'ba_desc', sit: '잃어버린 가방 → 큰 검은 여행 가방, 빨간 이름표.', card: { bag: { size: 'large', color: 'black', thing: 'suitcase', with: 'redtag' } }, a: 1,
      opts: [bag(['black', 'large', 'suitcase'], 'redtag'), bag(['large', 'black', 'suitcase'], 'redtag'), bag(['large', 'red', 'suitcase'], 'blacktag'), o('fl', 207)] },
    { q: 'cu_declare', sit: '신고할 물건이 없어요.', card: { declare: false }, a: 2, opts: [o('de_yes', 'snacks'), o('fi_yes'), o('de_no'), o('de_lit')] },
    { q: 'cu_fast', sit: '한 번 다시 물었는데 직원이 또 빠르게 말해요.', card: { asked: 1 }, a: 0, opts: [o('rp_slow'), o('g_yes'), o('rp_again'), o('rp_rude')] },
  ];
  AP.DRILL.forEach((it, i) => { it.n = i; it.Q = AP.Q[it.q]; it.place = it.Q.place; });
  // 직접 해 보기의 짧은 문제 (00장 · 08장) — 연습 문제와 다른 상황
  AP.MINI = {
    intro: { q: 'im_purpose', sit: '이모를 만나러 왔어요.', card: { purpose: 'family' }, a: 1, opts: [o('pu_lit', 'family'), o('pu_here', 'family'), o('le_for', 10), o('pu_will')] },
    repair: { q: 'cu_fast2', sit: '세관 직원이 처음 듣는 말을 아주 빠르게 했어요.', card: {}, a: 2, opts: [o('g_yes'), o('rp_noeng'), o('rp_again'), o('rp_rude')] },
  };
  Object.values(AP.MINI).forEach(it => { it.Q = AP.Q[it.q]; it.place = it.Q.place; });

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 대화 (연습 문제와 겹치지 않게 골랐어요)
     ========================================================= */
  // 00장 · 06장: 여행 카드 (관광 · 5일 · 메이플 호텔 · 대학생 · 첫 방문)
  AP.DEMO = { purpose: 'sightseeing', length: 5, stay: 'maple', job: 'student', first: true, ret: true, retDate: 'may8', name: 'KIM HANEUL', nameKo: '김하늘' };
  // 06장 입국 심사 줄: [질문, 함정 대답(없으면 null), 맞는 대답]
  AP.IMMIG = [
    ['im_purpose', null, o('pu_short', 'sightseeing')],
    ['im_length', o('le_dur', 5), o('le_for', 5)],
    ['im_stay', null, o('st_at', 'maple')],
    ['im_first', null, o('fi_yes')],
    ['im_job', o('jb_bare', 'student'), o('jb_a', 'student')],
    ['im_ret', null, o('rt_date', 'may8')],
  ];
  // 00장: 한국어 그대로 → 자연스러운 말 → 짧은 말
  AP.INTRO = { q: 'im_purpose', lit: o('pu_lit', 'sightseeing'), here: o('pu_here', 'sightseeing'), short: o('pu_short', 'sightseeing') };
  // 02장 체크인 · 03장 보안 · 05장 기내 · 07장 수하물 · 08장 세관의 대화
  AP.SCENE = {
    checkin: [['ci_pass', o('pp_here')], ['ci_seat', o('seat_pl', 'window')], ['ci_bags', o('bg_one')]],
    checkinCard: { seat: 'window', bags: 1 },
    security: [['se_laptop', o('or_ok')], ['se_belt', o('or_ok')], ['se_step', o('or_ok')], ['se_any', o('lq_no')]],
    securityCard: { liquid: false },
    plane: [['pl_meal', o('ml_pl', 'chicken')], ['pl_drink', o('dr_pl', 'water')]],
    planeCard: { meal: 'chicken', drink: 'water' },
    // 05장 부탁 틀: 칸에 차례로 들어가는 것
    could: ['blanket', 'water', 'pillow', 'pen'],
    blunt: [o('hp_give', 'water'), o('hp_want', 'water'), o('hp_could', 'water')],
    lost: [o('hp_lostlit'), o('hp_lost')],
    bag: { words: ['large', 'black', 'suitcase'], with: 'redtag' },
    bagWrong: { words: ['black', 'large', 'suitcase'], with: 'redtag' },
    bagCard: { bag: { size: 'large', color: 'black', thing: 'suitcase', with: 'redtag' } },
    customs: [o('de_no'), o('de_yes', 'snacks')],
    repair: [o('rp_sorry'), o('rp_again'), o('rp_slow')],
  };
  // 09장: 곳마다 한 줄 (3단계 적용)
  AP.METHOD = [
    ['ci_seat', o('seat_pl', 'aisle'), { seat: 'aisle' }],
    ['se_laptop', o('or_ok'), {}],
    ['ga_change', o('gt_conf', 50), {}],
    ['pl_help', o('hp_could', 'water'), { need: 'water' }],
    ['im_length', o('le_for', 7), { length: 7 }],
    ['ba_flight', o('fl', 207), { flight: 207 }],
    ['cu_any', o('de_no'), { declare: false }],
  ];
  // 10장 실전: 여행 카드 하나로 입국 심사 → 수하물 (보기 셋, 단계마다 지워짐)
  AP.PCARD = { purpose: 'conference', length: 3, stay: 'harbor', job: 'engineer', first: false, ret: true, retDate: 'may6', name: 'LEE JIWOO', nameKo: '이지우',
    bag: { size: 'small', color: 'silver', thing: 'suitcase', with: 'bluetag' } };
  AP.PRACTICE = [
    { q: 'im_purpose', opts: [o('pu_lit', 'conference'), o('le_for', 3), o('pu_here', 'conference')], a: 2,
      lines: ['purpose → 목적을 물어요 · (B) For three days → 기간이라 탈락', '(A) My purpose is → 한국어 그대로 옮긴 말 · 탈락', 'I\'m here + 목적, 짧고 사실대로 → 정답 (C)'] },
    { q: 'im_length', opts: [o('le_dur', 3), o('le_for', 7), o('le_for', 3)], a: 2,
      lines: ['How long → 기간을 물어요 · 셋 모두 기간이에요', '(A) During → 한국어 ‘동안’ 그대로 · (B) a week → 카드는 3일 · 탈락', 'For + 카드의 기간 → 정답 (C)'] },
    { q: 'im_stay', opts: [o('st_lit', 'harbor'), o('g_yesiam'), o('st_at', 'harbor')], a: 2,
      lines: ['Where … staying → 장소를 물어요 · (B) Yes, I am → Yes · No 대답이라 탈락', '(A) I stay Harbor Hotel → ‘에’가 빠진 틀 · 탈락', 'At + the + 호텔 → 정답 (C)'] },
    { q: 'ba_desc', opts: [bag(['silver', 'small', 'suitcase'], 'bluetag'), o('fl', 207), bag(['small', 'silver', 'suitcase'], 'bluetag')], a: 2,
      lines: ['describe → 가방 모양을 물어요 · (B) Flight 207 → 항공편이라 탈락', '(A) silver small → 색이 크기보다 앞 · 탈락', '크기 → 색 → 물건 + with 특징 → 정답 (C) · 끝에 Thank you.'] },
  ];

  /* ---------- 직접 해 보기 자료 ---------- */
  // 02장 탑승권 칸: [이름, 영어 이름, 글, 읽기, 뜻]
  AP.PASS = [
    { id: 'flight', en: 'FLIGHT', v: '207', say: 'Flight 207', ko: '항공편 번호 → 안내 방송에서 이 번호를 들어요.' },
    { id: 'gate', en: 'GATE', v: '15', say: 'Gate 15', ko: '탑승구 → 방송으로 바뀔 수 있어요. 바뀌면 안내판을 다시 봐요.' },
    { id: 'boarding', en: 'BOARDING', v: '10:20', say: 'Boarding time: 10:20', ko: '탑승 시작 시각 → 이때까지 탑승구에 가 있어야 해요.' },
    { id: 'depart', en: 'DEPARTS', v: '10:50', say: 'Departure time: 10:50', ko: '출발 시각 → 비행기 문은 이보다 먼저 닫혀요.' },
    { id: 'seat', en: 'SEAT', v: '32A', say: 'Seat 32A', ko: '좌석 → 32번째 줄의 A 자리(A는 보통 창가).' },
    { id: 'group', en: 'GROUP', v: '3', say: 'Group 3', ko: '탑승 그룹 → Group 3을 부르면 줄을 서요.' },
  ];
  AP.PASS_INFO = { name: 'KIM / HANEUL', from: 'SEOUL (ICN)', to: 'SEATTLE (SEA)', date: '03 MAY' };
  // 03장 지시 ↔ 동작
  AP.SEC = [
    { q: 'se_laptop', act: 'laptop', ko: '노트북을 가방에서 꺼내 바구니에 따로 놓아요.' },
    { q: 'se_belt', act: 'belt', ko: '벨트를 풀어 바구니에 넣어요.' },
    { q: 'se_shoes', act: 'shoes', ko: '신발을 벗어 바구니에 넣어요.' },
    { q: 'se_step', act: 'step', ko: '검색대 앞으로 한 걸음 나와요.' },
  ];
  AP.ACTS = { laptop: '노트북 꺼내기', belt: '벨트 풀기', shoes: '신발 벗기', step: '앞으로 나오기' };
  // 04장 숫자 짝 (-teen은 뒤, -ty는 앞을 세게)
  AP.NUMS = [[13, 30, 'thir'], [14, 40, 'four', 'for'], [15, 50, 'fif'], [16, 60, 'six'], [17, 70, 'seven'], [18, 80, 'eigh'], [19, 90, 'nine']];
  AP.numWord = n => NUMW[n] || ({ 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' })[n] || String(n);
  // -teen · -ty 판정: 들은 숫자와 고른 숫자
  AP.judgeNum = function (heard, pick) {
    if (heard === pick) return { ok: true, why: heard < 20 ? `${AP.numWord(heard)} → 끝(-teen)을 세게, 길게 읽어요.` : `${AP.numWord(heard)} → 앞을 세게, 끝(-ty)은 짧게 읽어요.` };
    return { ok: false, why: `들린 말은 ${AP.numWord(heard)}(${heard})예요. ${heard < 20 ? '-teen은 끝을 세게' : '-ty는 앞을 세게'} 읽어요.` };
  };
  // 07장 가방 묘사 칩
  AP.BAG_CHIPS = { size: ['large', 'small'], color: ['black', 'red', 'silver'], material: ['leather'], thing: ['suitcase', 'backpack'], with: ['redtag', 'wheels', 'ribbon'] };
  // 05장 부탁 만들기 칩
  AP.REQ_FRAMES = ['hp_could', 'hp_give', 'hp_want'];

  /* =========================================================
     따라 말하기 28문장 (곳마다 직원 · 여행자 말)
     ========================================================= */
  const SH = (place, who, en, ko) => ({ place, who, en, ko, sp: who === 'me' ? 'me' : AP.PLACE[place].sp });
  AP.SHADOW = [
    SH('checkin', 'staff', 'Window or aisle?', '창가 자리요, 통로 자리요?'),
    SH('checkin', 'me', 'An aisle seat, please.', '통로 자리로 주세요.'),
    SH('checkin', 'staff', 'Are you checking any bags?', '부칠 짐이 있으세요?'),
    SH('checkin', 'me', 'Yes, just one.', '네, 하나요.'),
    SH('security', 'staff', 'Please take your laptop out of your bag.', '가방에서 노트북을 꺼내 주세요.'),
    SH('security', 'me', 'Okay. One moment.', '네, 잠시만요.'),
    SH('security', 'staff', 'Step forward, please.', '앞으로 나오세요.'),
    SH('gate', 'staff', 'Flight 207 is now boarding.', '207편 탑승을 시작합니다.'),
    SH('gate', 'me', 'Excuse me, is this Gate 50?', '실례지만, 여기가 50번 탑승구인가요?'),
    SH('gate', 'me', 'Sure. Here you are.', '네, 여기 있어요.'),
    SH('plane', 'staff', 'Chicken or beef?', '닭고기요, 소고기요?'),
    SH('plane', 'me', 'Chicken, please.', '닭고기로 주세요.'),
    SH('plane', 'me', 'Could I have a blanket, please?', '담요 하나 주시겠어요?'),
    SH('plane', 'me', 'Could I have some water, please?', '물 좀 주시겠어요?'),
    SH('immig', 'staff', 'What\'s the purpose of your visit?', '방문 목적이 무엇인가요?'),
    SH('immig', 'me', 'I\'m here for sightseeing.', '관광하러 왔어요.'),
    SH('immig', 'staff', 'How long will you be staying?', '얼마나 머무를 건가요?'),
    SH('immig', 'me', 'For five days.', '5일 동안이요.'),
    SH('immig', 'me', 'At the Maple Hotel.', '메이플 호텔에서요.'),
    SH('immig', 'me', 'I\'m a student.', '대학생이에요.'),
    SH('baggage', 'me', 'Excuse me. My suitcase didn\'t come out.', '실례지만, 제 여행 가방이 안 나왔어요.'),
    SH('baggage', 'staff', 'Can you describe your bag?', '가방이 어떻게 생겼나요?'),
    SH('baggage', 'me', 'It\'s a large black suitcase with a red tag.', '빨간 이름표가 달린 큰 검은 여행 가방이에요.'),
    SH('customs', 'staff', 'Anything to declare?', '신고할 것 있어요?'),
    SH('customs', 'me', 'No, nothing to declare.', '아니요, 신고할 것 없어요.'),
    SH('customs', 'me', 'Sorry? Could you say that again, please?', '죄송한데, 다시 한 번 말씀해 주시겠어요?'),
    SH('customs', 'me', 'Could you speak more slowly, please?', '조금 더 천천히 말씀해 주시겠어요?'),
    SH('customs', 'me', 'Thank you. Have a nice day.', '고맙습니다. 좋은 하루 보내세요.'),
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: key 열쇠 낱말 · frame 대답 틀 · slot 내 정보 · pol 공손한 말 · trap 함정 · ok 정답
     ========================================================= */
  const LL = k => `(${L4[k]})`;
  AP.judgeItem = (it, k) => AP.judge(it.Q, it.opts[k], it.card, '상황');
  const cardSay = c => Object.keys(c || {}).filter(k => k !== 'asked').map(k => AP.factKo(k, c[k])).join(' · ');
  // 보기의 조각을 표시로 (r → 역할)
  const segMarks = (a, k, roleOf) => AP.segs(a).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).map(s => ({ t: s.t.trim().replace(/^[,.?!]+|[,.?!]+$/g, ''), role: roleOf(s), at: k })).filter(m => m.t);
  AP.steps = function (it) {
    const q = it.Q, J = it.opts.map((_, k) => AP.judgeItem(it, k)), at = s => it.opts.map((_, k) => k).filter(k => J[k].stage === s);
    const best = AP.model(q, it.card);
    // ①
    let t1;
    if (q.fast) t1 = '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 묻는지 모르면 짐작해서 답하지 말고 다시 물어요.';
    else t1 = `열쇠 낱말 ${q.key.join(' … ')} → ${AP.sayOf(q.intent)}. ${AP.INTENT[q.intent].want}`;
    if (at(1).length) t1 += ' ' + at(1).map(k => LL(k)).join(' · ') + (q.fast ? ' → 짐작한 대답이라 탈락.' : ' → 다른 질문에 맞는 대답이라 탈락.');
    const m1 = q.fast ? [] : q.key.map(t => ({ t, role: 'key', at: 'q' }));
    at(1).forEach(k => m1.push({ t: AP.text(it.opts[k]).replace(/[.?!]$/, ''), role: 'trap', at: k }));
    // ②
    const sit = cardSay(it.card);
    let t2 = (q.fast ? (it.card.asked ? '상황 → 이미 한 번 다시 물었어요. ' : '상황 → 처음 듣고 못 알아들었어요. ') : sit ? `상황 → ${sit}. ` : '') + `맞는 틀 → ${AP.FRAME[best.f].t.replace(/[{}]/g, '').replace('___', '…').replace(/…\.$/, '…')}`;
    if (at(2).length) t2 += ' · ' + at(2).map(k => `${LL(k)} ${J[k].tag === 'fact' ? '상황과 다른 정보' : J[k].tag === 'order' ? '순서가 어색함' : J[k].tag === 'wrong' ? '틀린 문장' : '한국어 그대로 옮긴 틀'}`).join(' · ') + ' → 탈락.';
    else t2 += ' · 틀과 정보가 모두 맞는 보기만 남았어요.';
    const m2 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 1) return; segMarks(a, k, s => s.r === 'pol' ? '' : (J[k].stage === 2 && ((J[k].tag === 'fact' || J[k].tag === 'order') ? s.r === 'slot' : s.r === 'frame')) ? 'trap' : s.r).forEach(m => { if (m.role) m2.push(m); }); });
    // ③
    let t3 = at(3).length ? at(3).map(k => `${LL(k)} ${AP.text(it.opts[k])} → ${J[k].tag === 'plain' ? 'please 없이 끊김' : '명령 · 조르기 · 따지는 말투'}`).join(' · ') + ' → 탈락. ' : '';
    const svc = ['order', 'choice', 'need', 'notice', 'repair'].includes(AP.INTENT[q.intent].ask) || q.fast;
    if (!at(3).length) t3 += svc ? '명령하거나 조르는 말투의 보기는 없어요. ' : '심사관 · 직원의 질문에는 짧은 사실만 말해도 공손해요(please 없이도 괜찮아요). ';
    t3 += `정답 ${LL(it.a)} → ${J[it.a].why}`;
    const m3 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 3) segMarks(a, k, () => 'trap').forEach(m => m3.push(m)); else if (J[k].stage === 0) segMarks(a, k, s => s.r === 'pol' ? 'pol' : '').forEach(m => { if (m.role) m3.push(m); }); });
    m3.push({ t: AP.text(it.opts[it.a]), role: 'ok', at: it.a, whole: true });
    return [
      { head: '① 열쇠 낱말 잡기', text: t1, marks: m1 },
      { head: '② 틀에 내 정보 넣기', text: t2, marks: m2 },
      { head: '③ 공손하게 끝내기', text: t3, marks: m3 },
    ];
  };
  AP.notes = it => it.opts.map((_, k) => { const j = AP.judgeItem(it, k); return (j.ok ? '' : `× ${['', '①', '②', '③'][j.stage]} `) + j.why; });

  /* =========================================================
     데이터 점검 — 열쇠 낱말이 질문에 없거나, 맞는 보기가 하나가 아니거나, 정답 위치가 몰리면 경고
     ========================================================= */
  AP.check = function () {
    const bad = [];
    const has = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase());
    Object.values(AP.Q).forEach(q => {
      if (!AP.PLACE[q.place]) bad.push(`질문 ${q.id}: 곳 ${q.place}가 없어요`);
      if (q.intent && !AP.INTENT[q.intent]) bad.push(`질문 ${q.id}: 뜻 ${q.intent}가 없어요`);
      q.key.forEach(k => { if (!has(k, q.en)) bad.push(`질문 ${q.id}: 열쇠 낱말 ‘${k}’가 질문에 없어요`); });
    });
    Object.values(AP.FRAME).forEach(F => {
      [].concat(F.intent).forEach(i => { if (!AP.INTENT[i]) bad.push(`틀 ${F.id}: 뜻 ${i}가 없어요`); });
      if (F.slot && !AP.SLOT[F.slot]) bad.push(`틀 ${F.id}: 칸 ${F.slot}이 없어요`);
      if (F.slot && !/___/.test(F.t)) bad.push(`틀 ${F.id}: 칸이 있는데 ___가 없어요`);
      if (F.tag !== 'ok' && !F.why) bad.push(`틀 ${F.id}: 함정 틀에 까닭(why)이 없어요`);
      if (F.slot) Object.values(AP.SLOT[F.slot].vals).forEach(v => { if (v[F.form || 't'] == null) bad.push(`틀 ${F.id}: 칸 값에 ${F.form || 't'} 꼴이 없어요`); });
    });
    Object.values(AP.INTENT).forEach(In => { if (!In.generic && In.best && typeof In.best === 'string' && !AP.FRAME[In.best]) bad.push(`뜻의 모범 틀 ${In.best}가 없어요`); });
    // 연습 문제
    const pos = [0, 0, 0, 0];
    AP.DRILL.forEach((it, i) => {
      const w = `듣고 대답 고르기 ${i + 1}`;
      if (!it.Q) { bad.push(`${w}: 질문 ${it.q}가 없어요`); return; }
      const good = it.opts.map((_, k) => k).filter(k => AP.judgeItem(it, k).ok);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]}`);
      const texts = it.opts.map(AP.text);
      if (new Set(texts).size !== texts.length) bad.push(`${w}: 같은 보기가 있어요`);
      if (!it.sit) bad.push(`${w}: 상황 글이 없어요`);
      pos[it.a]++;
    });
    if (Math.max(...pos) - Math.min(...pos) > 1) bad.push(`듣고 대답 고르기 정답 위치가 몰려 있어요: ${pos.join(',')}`);
    const places = new Set(AP.DRILL.map(it => it.place));
    AP.PLACES.forEach(p => { if (!places.has(p.id)) bad.push(`듣고 대답 고르기: ${p.ko} 문제가 없어요`); });
    if (!AP.DRILL.some(it => it.Q.fast)) bad.push('듣고 대답 고르기: 다시 묻기 문제가 없어요');
    Object.entries(AP.MINI).forEach(([k, it]) => { const good = it.opts.map((_, i) => i).filter(i => AP.judgeItem(it, i).ok); if (good.length !== 1 || good[0] !== it.a) bad.push(`직접 해 보기 ${k}: 맞는 보기 ${good}`); });
    // 영상 · 직접 해 보기의 대화가 판정과 맞나
    const want = (w, q, a, c, ok) => { const j = AP.judge(q, a, c); if (j.ok !== ok) bad.push(`${w}: ${AP.text(a)} → 판정 ${j.ok ? '✓' : '×'} (${j.why})`); return j; };
    want('00장 한국어 그대로', AP.INTRO.q, AP.INTRO.lit, AP.DEMO, false); want('00장 자연스러운 말', AP.INTRO.q, AP.INTRO.here, AP.DEMO, true); want('00장 짧은 말', AP.INTRO.q, AP.INTRO.short, AP.DEMO, true);
    AP.IMMIG.forEach(([q, trap, ok], i) => { if (trap) want(`06장 함정 ${i + 1}`, q, trap, AP.DEMO, false); want(`06장 대답 ${i + 1}`, q, ok, AP.DEMO, true); });
    AP.SCENE.checkin.forEach(([q, a], i) => want(`02장 ${i + 1}`, q, a, AP.SCENE.checkinCard, true));
    AP.SCENE.security.forEach(([q, a], i) => want(`03장 ${i + 1}`, q, a, AP.SCENE.securityCard, true));
    AP.SCENE.plane.forEach(([q, a], i) => want(`05장 ${i + 1}`, q, a, AP.SCENE.planeCard, true));
    AP.SCENE.blunt.forEach((a, i) => want(`05장 부탁 ${i + 1}`, 'pl_help', a, { need: 'water' }, i === 2));
    AP.SCENE.lost.forEach((a, i) => want(`07장 ${i + 1}`, 'ba_help', a, { need: 'lostbag' }, i === 1));
    want('07장 가방', 'ba_desc', { f: 'ds', bag: AP.SCENE.bag }, AP.SCENE.bagCard, true);
    want('07장 가방 순서', 'ba_desc', { f: 'ds', bag: AP.SCENE.bagWrong }, AP.SCENE.bagCard, false);
    AP.SCENE.customs.forEach((a, i) => want(`08장 ${i + 1}`, 'cu_any', a, { declare: i === 1 }, true));
    AP.SCENE.repair.forEach((a, i) => want(`08장 다시 묻기 ${i + 1}`, 'cu_fast', a, i === 2 ? { asked: 1 } : {}, true));
    AP.METHOD.forEach(([q, a, c], i) => want(`09장 ${i + 1}`, q, a, c, true));
    // 실전: 지워지는 단계가 줄 글과 맞나
    AP.PRACTICE.forEach((p, i) => {
      const w = `실전 ${i + 1}`;
      const good = p.opts.map((_, k) => k).filter(k => AP.judge(p.q, p.opts[k], AP.PCARD).ok);
      if (good.length !== 1 || good[0] !== p.a) bad.push(`${w}: 맞는 보기 ${good}`);
      [1, 2].forEach(st => {
        const gone = p.opts.map((_, k) => k).filter(k => AP.judge(p.q, p.opts[k], AP.PCARD).stage === st).map(LL).sort().join();
        const said = (p.lines[st - 1].match(/\([A-D]\)/g) || []).sort().join();
        if (gone !== said) bad.push(`${w} ${st}단계: 엔진 ${gone || '-'} · 화면 ${said || '-'}`);
      });
      if (!p.lines[2].includes(`정답 ${LL(p.a)}`)) bad.push(`${w}: 정답 표시가 달라요`);
    });
    // 시뮬레이터: 카드 여럿을 만들어 모범 대답은 통과, 함정 틀은 원하는 단계에서 탈락하나
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 40; n++) {
      const c = AP.newCard(rnd);
      ['im_pass'].concat(AP.SIM_QS).forEach(id => {
        const q = AP.Q[id], m = AP.model(q, c), j = AP.judge(q, m, c);
        if (!j.ok) bad.push(`시뮬레이터 ${id}: 모범 대답이 탈락 (${AP.text(m)} · ${j.why})`);
        const fr = AP.SIM_FRAMES[q.intent](c);
        if (fr.filter(f => { const F = AP.FRAME[f]; const a = { f, v: F.slot ? String(c[AP.SLOT[F.slot].key] != null && [].concat(F.intent).includes(q.intent) ? c[AP.SLOT[F.slot].key] : Object.keys(AP.SLOT[F.slot].vals)[0]) : undefined }; return AP.judge(q, a, c).ok; }).length !== 1) bad.push(`시뮬레이터 ${id}: 맞는 틀이 하나가 아니에요`);
        if (AP.SPOKEN[q.intent] && !AP.matchSpoken(AP.text(m), q, c).ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 말로 해도 통과하지 못해요 (${AP.text(m)})`);
      });
    }
    // 따라 말하기: 같은 말은 모두 맞아야
    AP.SHADOW.forEach((s, i) => { const r = AP.compareWords(s.en, s.en); if (r.hit !== r.total) bad.push(`따라 말하기 ${i + 1}: 같은 글이 다 맞지 않아요`); if (!AP.PLACE[s.place]) bad.push(`따라 말하기 ${i + 1}: 곳이 없어요`); });
    bad.forEach(b => console.warn('[공항] ' + b));
    return bad;
  };

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  AP.allText = function () {
    const out = [];
    Object.values(AP.Q).forEach(q => out.push(q.en, q.ko, q.short || ''));
    Object.values(AP.FRAME).forEach(F => out.push(F.t, F.ko, F.why || ''));
    Object.values(AP.SLOT).forEach(S => Object.values(S.vals).forEach(v => out.push(Object.values(v).join(' '))));
    Object.values(AP.ADJ).forEach(a => out.push(a.ko)); Object.values(AP.WITH).forEach(a => out.push(a.t, a.ko));
    Object.keys(AP.ADJ).forEach(k => out.push(k));
    Object.values(AP.ASK).forEach(a => out.push(a.ko, a.say)); Object.values(AP.INTENT).forEach(a => out.push(a.ans, a.want || '', a.say || ''));
    AP.PLACES.forEach(p => out.push(p.ko, p.en)); AP.PASS.forEach(p => out.push(p.en, p.v, p.ko, p.say));
    AP.PRACTICE.forEach(p => out.push(p.lines.join(''))); AP.SHADOW.forEach(s => out.push(s.en, s.ko));
    AP.NAMES.forEach(n => out.push(n.join(''))); Object.values(AP.PASS_INFO).forEach(v => out.push(v));
    return out.join('');
  };
})();
