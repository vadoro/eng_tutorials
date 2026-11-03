/* 호텔 회화 — 규칙 엔진과 대화 자료 (상황별 영어 회화)
 *
 * 공항과 카페에서는 주로 직원의 질문에 ‘대답’했어요. 호텔에서는 내가 먼저 말을 꺼내는 일이 많아요.
 * 수건이 더 필요하고, 에어컨이 고장 나고, 짐을 맡기고 싶어요. 그래서 호텔의 핵심은 두 가지예요.
 *   부탁은 질문으로 — Could I get …? · Could you …? · Is it possible to …?
 *   문제는 사실 + 부탁 — The air conditioner isn't working. + Could you send someone to look at it?
 * 체크인 · 체크아웃의 질문은 공항처럼 거의 정해져 있어요.
 *
 * 규칙 엔진은 소리를 듣지 않고, 문제마다 적어 둔 ‘말의 뜻(intent)’과 ‘대답 틀(frame) + 내 정보(slot)’,
 * 그리고 숙박 카드(또는 상황)의 사실을 맞춰 봐요.
 *
 * 3단계 말하기 법 — HT.judge(직원의 말, 대답, 카드)
 *   ① 열쇠 낱말 잡기 — 대답이 그 말(intent)에 맞는가? 내가 먼저 부탁할 때는 ‘무엇을 부탁하나’
 *                      빠르게 말해 못 알아들은 말(fast)이면 짐작한 대답은 모두 ①에서 탈락 → 다시 묻기
 *                      (들린 만큼 되묻는 말은 실제로 들은 말과 같을 때만 통과)
 *   ② 틀에 내 정보 넣기 — 틀이 자연스러운가(한국어 그대로 · 콩글리시 · 틀린 문장이면 탈락), 칸의 정보가 카드와 맞는가,
 *                      박을 날(day)로 세지 않았나, 전화 한 줄(HT.callLine)의 순서, 문제와 부탁이 맞는가(HT.fix)
 *   ③ 공손하게 끝내기 — 명령 · 조르는 말 · 따지는 말(blunt)이나 그냥 No.로 끊긴 말(plain)이면 탈락
 * judge → { ok, stage: 0 | 1 | 2 | 3, why, tag }
 *
 * 전화 한 줄: HT.callLine(줄) — (Hi,) this is room ___ → 부탁 틀 + 필요한 것 → please → Thank you. (단순하게 줄인 규칙)
 *             HT.covered(대답, 말) — 그 대답이 이미 답한 직원의 질문 → 시뮬레이터의 직원이 건너뜀
 * 문제와 부탁: HT.fix(문제, 부탁) — 문제마다 어울리는 부탁(사람 보내기 · 방 바꾸기 · 가져다주기 · 새 카드 키)
 * 숫자: HT.roomWords('1207') → twelve-oh-seven · HT.floorOf · HT.timeWords('6:30') → six-thirty · HT.bill(카드) → 청구서
 *       영상 · 청구서 · 직원의 말이 모두 이 계산을 써요. 목소리는 HT.spoken으로 읽어요.
 *
 * 영상의 ✓·×, 직접 해 보기, 호텔 숙박 시뮬레이터, 듣고 대답 고르기, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 HT.check()가 콘솔에 경고를 내요.
 */
(function () {
  'use strict';
  const HT = (window.HT = {});
  const L4 = 'ABCD';

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; if (/[0-9]/.test(s[i])) return '0136781'.includes(s[i]) ? 0xAC01 : 0xAC00; if (/[A-Za-z]/.test(s[i])) return /[lmnr]/i.test(s[i]) ? 0xAC01 : 0xAC00; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const rieul = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 === 8 : false; };
  const wa = s => s + (has(s) ? '과' : '와'), eul = s => s + (has(s) ? '을' : '를'), ig = s => s + (has(s) ? '이' : '가');
  const ro = s => s + (has(s) && !rieul(s) ? '으로' : '로'), ieyo = s => s + (has(s) ? '이에요' : '예요');
  HT.josa = { wa, eul, ig, ro, ieyo };

  /* =========================================================
     호텔 일곱 곳 (머무는 차례). sp: 그곳 직원의 목소리 (voices.js)
     ========================================================= */
  HT.PLACES = [
    { id: 'checkin', ko: '프런트 · 체크인', en: 'Front desk · Check-in', sp: 'us', floor: 1 },
    { id: 'key', ko: '방 열쇠 · 안내', en: 'Key card · Info', sp: 'us', floor: 1 },
    { id: 'call', ko: '객실 · 전화 부탁', en: 'Room · Phone request', sp: 'ca', floor: 12 },
    { id: 'problem', ko: '객실 · 문제', en: 'Room · Problem', sp: 'ca', floor: 12 },
    { id: 'breakfast', ko: '조식 식당', en: 'Breakfast', sp: 'au', floor: 2 },
    { id: 'concierge', ko: '컨시어지 · 짐', en: 'Concierge · Luggage', sp: 'gb', floor: 1 },
    { id: 'checkout', ko: '프런트 · 체크아웃', en: 'Front desk · Check-out', sp: 'us', floor: 1 },
  ];
  HT.PLACE = {}; HT.PLACES.forEach((p, i) => { p.i = i; HT.PLACE[p.id] = p; });
  HT.ME = 'me';
  HT.HOTEL = 'Willowmere Hotel';   // 지어낸 호텔 이름
  HT.WIFI = 'maple24';             // 지어낸 와이파이 비밀번호

  /* =========================================================
     숫자 읽기 — 방 번호 · 층 · 시각 · 값 (화면 글 → 소리)
     ========================================================= */
  const NUMW = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };
  const numWord = n => n < 20 || (n < 100 && n % 10 === 0) ? NUMW[n] : n < 100 ? `${NUMW[n - n % 10]}-${NUMW[n % 10]}` : n < 1000 ? `${NUMW[Math.floor(n / 100)]} hundred${n % 100 ? ' ' + numWord(n % 100) : ''}` : String(n);
  HT.numWord = numWord;
  const ORD = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth', 15: 'fifteenth', 16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth', 19: 'nineteenth', 20: 'twentieth' };
  HT.ordinal = n => ORD[n] || `${n}th`;
  const join2 = (a, b) => (b.includes('-') && !b.startsWith('oh-') ? `${a} ${b}` : `${a}-${b}`);
  // 방 번호: 앞 = 층, 뒤 두 자리 = 방 (1207 → twelve-oh-seven · 1270 → twelve-seventy · 815 → eight-fifteen)
  HT.roomWords = r => { r = String(r); const f = +r.slice(0, -2), n = +r.slice(-2); return join2(numWord(f), n === 0 ? 'hundred' : n < 10 ? 'oh-' + numWord(n) : numWord(n)); };
  HT.floorOf = r => +String(r).slice(0, -2);
  HT.floorWords = f => `the ${HT.ordinal(f)} floor`;
  // 시각: 6:30 → six-thirty · 6:05 → six-oh-five · 11:00 → eleven
  HT.timeWords = t => { const [h, m] = String(t).split(':').map(Number); return !m ? numWord(h) : join2(numWord(h), m < 10 ? 'oh-' + numWord(m) : numWord(m)); };
  HT.timeKo = (t, pm) => { const [h, m] = String(t).split(':').map(Number); return `${pm ? '오후 ' : ''}${h}시${m ? ` ${m}분` : ''}`; };
  // 값 (센트): $334.40 → three hundred thirty-four dollars and forty cents
  HT.money = c => '$' + (c / 100).toFixed(2);
  HT.priceWords = c => { const d = Math.floor(c / 100), k = c % 100; return `${numWord(d)} dollar${d === 1 ? '' : 's'}${k ? ` and ${numWord(k)} cent${k === 1 ? '' : 's'}` : ''}`; };
  HT.priceKo = c => { const d = Math.floor(c / 100), k = c % 100; return k ? `${d}달러 ${k}센트` : `${d}달러`; };
  // 소리 내어 읽을 글: 값 → 시각 → 서수 → 방 번호(세 · 네 자리) → 철자(K-I-M → K, I, M)
  HT.spoken = s => String(s)
    .replace(/\$(\d+)\.(\d{2})/g, (m, d, c) => HT.priceWords(+d * 100 + +c))
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (m, h, mm) => HT.timeWords(`${h}:${mm}`))
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/g, (m, n) => ORD[+n] || m)
    .replace(/\b(\d{3,4})\b/g, m => HT.roomWords(m))
    .replace(/\b[A-Z](?:-[A-Z])+\b/g, m => m.split('-').join(', '));

  /* =========================================================
     말의 종류(① 열쇠 낱말이 알려 주는 것)와 뜻(intent)
     ========================================================= */
  HT.ASK = {
    yesno: { ko: '확인', say: '그런지 아닌지 확인하는 질문이에요' },
    info: { ko: '정보', say: '정보 하나를 묻는 질문이에요' },
    choice: { ko: '고르기', say: '둘 가운데 하나를 고르라는 말이에요' },
    notice: { ko: '안내', say: '알려 주는 말이에요' },
    please: { ko: '직원의 부탁', say: '무엇을 해 달라는 직원의 부탁이에요' },
    need: { ko: '내가 부탁할 차례', say: '무엇이 필요한지 묻는 말이에요. 이제 내가 부탁할 차례예요' },
    repair: { ko: '다시 묻기', say: '다시 묻는 말이에요' },
  };
  // ans: 이 뜻의 말을 한국어로 (① 탈락 까닭) · want: 기대하는 대답 · best: 모범 틀(카드에 따라 바뀌면 함수) · turn: 차례 이름
  const I = (ask, ans, want, best, o = {}) => Object.assign({ ask, ans, want, best }, o);
  HT.INTENT = {
    resv: I('yesno', '예약이 있는지 묻는 질문', 'Yes, I have a reservation under + 성.', 'rs_under', { say: '예약했는지 확인하는 질문이에요', turn: '예약' }),
    name: I('info', '예약한 이름을 묻는 질문', 'It\'s + 성 → It\'s Kim.', 'nm_its', { say: '누구 이름으로 예약했는지(성) 묻는 말이에요', turn: '이름' }),
    spell: I('please', '철자를 불러 달라는 부탁', '한 글자씩 → K-I-M.', 'sp_spell', { say: '철자를 한 글자씩 불러 달라는 말이에요', turn: '철자' }),
    nights: I('info', '며칠 밤 묵는지 묻는 질문', '밤의 수 → Two nights. (2박 3일 = two nights)', 'nt_n', { say: '며칠 밤(night) 묵는지 묻는 말이에요', turn: '묵는 밤' }),
    passport: I('please', '여권을 보여 달라는 부탁', '건네며 → Sure, here you go.', 'pp_here', { say: '여권을 보여 달라는 말이에요', turn: '여권' }),
    incid: I('notice', '추가 요금에 대비해 카드를 잡아 둔다는 안내', '건네며 → Sure, here you go. 모르는 낱말이면 → Sorry, what are incidentals?', 'pp_here', { say: '추가 요금(incidentals)에 대비해 카드를 잠깐 잡아 둔다는 말이에요', turn: '카드' }),
    keyinfo: I('notice', '방 번호와 층을 알려 주는 안내', 'Thank you. 헷갈리면 → Sorry, was that room ___?', 'ty', { say: '방 번호와 층을 알려 주는 말이에요', turn: '방 번호 안내' }),
    bfinfo: I('notice', '조식 시간을 알려 주는 안내', 'Thank you.', 'ty', { say: '조식 시간과 곳을 알려 주는 말이에요', turn: '조식 안내' }),
    coinfo: I('notice', '체크아웃 시각을 알려 주는 안내', 'Thank you.', 'ty', { say: '체크아웃 시각을 알려 주는 말이에요', turn: '체크아웃 안내' }),
    wifiinfo: I('notice', '와이파이 비밀번호를 알려 주는 안내', 'Thank you. 받아 적으려면 → Could you spell that, please?', 'ty', { say: '와이파이 비밀번호를 알려 주는 말이에요', turn: '와이파이' }),
    kmore: I('yesno', '더 도와줄 것이 있는지 묻는 질문', '없으면 No, that\'s all. Thank you. 있으면 Yes. + 내 질문', c => c.kq === 'wifi' ? 'km_wifi' : c.kq === 'bfincl' ? 'km_incl' : 'km_no', { say: '더 물어볼 것이 있는지 확인하는 질문이에요', turn: '더 물어볼 것' }),
    help: I('need', '무엇이 필요한지 묻는 말(전화)', '(Hi,) this is room ___. Could I get ___, please?', 'line', { turn: '부탁' }),
    roomno: I('info', '방 번호를 묻는 질문', 'It\'s + 방 번호 → It\'s 1207.', 'rn_its', { say: '방 번호를 묻는 말이에요', turn: '방 번호' }),
    count: I('info', '몇 개가 필요한지 묻는 질문', '수 + please → Two, please.', 'ct_n', { say: '몇 개가 필요한지 묻는 말이에요', turn: '몇 개' }),
    issue: I('need', '무엇이 문제인지 묻는 말', '사실 + 부탁 → The ___ isn\'t working. Could you send someone to look at it?', c => (HT.PROB[c.prob] || HT.PROB.ac).fact, { turn: '문제' }),
    drink: I('choice', '마실 것을 고르라는 질문', '고른 것 + please → Coffee, please.', 'dk_pl', { say: '커피와 차 가운데 고르라는 말이에요', turn: '마실 것' }),
    charge: I('yesno', '조식값을 방으로 달아 둬도 되는지 묻는 질문', '괜찮으면 Yes, that\'s fine.', 'ch_ok', { say: '조식값을 방값에 붙여도 되는지 확인하는 질문이에요', turn: '조식값' }),
    ask: I('need', '무엇을 도와줄지 묻는 말', 'Could I get a wake-up call at ___? · Could you hold my luggage until ___?', c => ({ wake: 'cg_wake', hold: 'cg_hold', taxi: 'cg_taxi', late: 'cg_late' }[c.want] || 'cg_hold'), { turn: '부탁' }),
    waketime: I('info', '몇 시에 깨워 줄지 묻는 질문', 'At + 시각, please.', 'tm_at', { say: '모닝콜을 몇 시에 할지 묻는 말이에요', turn: '모닝콜 시각' }),
    holdtime: I('info', '짐을 언제까지 맡길지 묻는 질문', 'Until + 시각, please.', 'tm_until', { say: '짐을 몇 시까지 맡길지 묻는 말이에요', turn: '맡길 시각' }),
    co: I('yesno', '체크아웃하는지 확인하는 질문', 'Yes, room ___.', 'co_yes', { say: '체크아웃하러 왔는지 확인하는 질문이에요', turn: '체크아웃' }),
    minibar: I('yesno', '미니바에서 꺼내 먹은 것이 있는지 묻는 질문', '없으면 No, nothing. 있으면 Yes, just + 물건.', c => c.minibar && c.minibar !== 'none' ? 'mb_yes' : 'mb_no', { say: 'Did you …? → 미니바를 썼는지(과거) 묻는 말이에요', turn: '미니바' }),
    stay: I('info', '묵는 동안 어땠는지 묻는 질문', 'It was great, thank you.', 'st_great', { say: 'How was … → 어땠는지 묻는 말이에요. Yes · No로는 답이 안 돼요', turn: '소감' }),
    bill: I('notice', '청구서와 합계를 알려 주는 말', '맞으면 That looks right. Thank you. 틀리면 I think there\'s a mistake on my bill. + 까닭', c => c.billErr === 'minibar' ? 'bl_mini' : c.billErr === 'nights' ? 'bl_nights' : 'bl_ok', { say: '청구서를 보여 주며 합계를 알려 주는 말이에요. 카드와 맞는지 확인해요', turn: '청구서' }),
    repair: I('repair', '다시 묻는 말', '', 'rp_again'),
    // 다른 질문에 맞는 대답 (① 함정에만 쓰고 질문으로는 나오지 않음)
    g_yes: I('yesno', 'Yes · No로 묻는 질문', '', null, { generic: true }),
    g_permit: I('yesno', '허락을 묻는 질문(Can I …? → 해도 돼요?)', '', null, { generic: true }),
    g_pay: I('choice', '계산 방법을 묻는 질문(Card or cash?)', '', null, { generic: true }),
  };
  HT.sayOf = intent => { const it = HT.INTENT[intent]; return it.say || HT.ASK[it.ask].say; };

  /* =========================================================
     직원의 말. key: 열쇠 낱말(말 안에 꼭 있어야 함) · fast: 너무 빨라 못 알아들은 말 · short: 지도에 쓰는 짧은 꼴
     fact: 그 말이 알려 준 사실(방 번호 등) · allow: 대답 대신 해도 되는 다시 묻기(spell · what)
     ========================================================= */
  HT.Q = {};
  const Q = (id, place, intent, en, ko, key, o = {}) => (HT.Q[id] = Object.assign({ id, place, intent, en, ko, key, sp: HT.PLACE[place].sp }, o));
  // 프런트 · 체크인
  Q('ci_resv', 'checkin', 'resv', 'Hi, welcome to the Willowmere! Do you have a reservation?', '안녕하세요, 윌로미어 호텔입니다! 예약하셨어요?', ['reservation'], { short: 'Do you have a reservation?' });
  Q('ci_name', 'checkin', 'name', 'Great. Under what name?', '네. 어느 분 이름으로 하셨어요?', ['what name'], { short: 'Under what name?' });
  Q('ci_spell', 'checkin', 'spell', 'Could you spell that, please?', '철자를 불러 주시겠어요?', ['spell'], { short: 'Could you spell that?' });
  Q('ci_nights', 'checkin', 'nights', 'And how many nights will you be staying?', '그리고 며칠 밤 묵으세요?', ['how many nights'], { short: 'How many nights?' });
  Q('ci_pass', 'checkin', 'passport', 'Can I see your passport, please?', '여권을 보여 주시겠어요?', ['passport'], { short: 'Your passport, please?' });
  Q('ci_card', 'checkin', 'incid', 'We\'ll also need a credit card for incidentals.', '추가 요금에 대비해 신용카드도 필요해요.', ['incidentals'], { allow: ['what'], short: 'A card for incidentals' });
  // 방 열쇠 · 안내
  Q('k_room', 'key', 'keyinfo', 'Here\'s your key card. You\'re in room 1207, on the twelfth floor.', '카드 키 여기 있어요. 1207호, 12층이에요.', ['room 1207'], { fact: { room: '1207' }, short: 'Room 1207, 12th floor' });
  Q('k_bf', 'key', 'bfinfo', 'Breakfast is from seven to ten in the Garden Room, on the second floor.', '조식은 7시부터 10시까지 2층 가든 룸에서 해요.', ['seven to ten'], { short: 'Breakfast: seven to ten' });
  Q('k_co', 'key', 'coinfo', 'Check-out is at eleven.', '체크아웃은 11시예요.', ['eleven']);
  Q('k_wifi', 'key', 'wifiinfo', 'The Wi-Fi password is maple24.', '와이파이 비밀번호는 maple24예요.', ['Wi-Fi password'], { allow: ['spell'] });
  Q('k_fast', 'key', 'bfinfo', 'And breakfast is served from seven to ten in the Garden Room, second floor.', '그리고 조식은 7시부터 10시까지 2층 가든 룸에서 드려요.', ['breakfast'], { fast: true });
  Q('k_any', 'key', 'kmore', 'Is there anything else I can help you with?', '더 도와드릴 것이 있을까요?', ['anything else'], { short: 'Anything else?' });
  // 객실 · 전화 부탁
  Q('cl_help', 'call', 'help', 'Front desk. How can I help you?', '프런트입니다. 무엇을 도와드릴까요?', ['How can I help'], { short: 'How can I help you?' });
  Q('cl_hk', 'call', 'help', 'Housekeeping. How may I help you?', '객실 관리팀입니다. 무엇을 도와드릴까요?', ['How may I help']);
  Q('cl_room', 'call', 'roomno', 'Sure. What\'s your room number?', '네. 방 번호가 어떻게 되세요?', ['room number'], { short: 'Your room number?' });
  Q('cl_count', 'call', 'count', 'How many would you like?', '몇 개 필요하세요?', ['How many']);
  // 객실 · 문제
  Q('pr_help', 'problem', 'issue', 'Front desk. What can I do for you?', '프런트입니다. 무엇을 해 드릴까요?', ['What can I do'], { short: 'What can I do for you?' });
  Q('pr_sorry', 'problem', 'issue', 'I\'m sorry to hear that. What seems to be the problem?', '저런, 무엇이 문제인가요?', ['problem']);
  Q('pr_room', 'problem', 'roomno', 'I\'m so sorry about that. What\'s your room number?', '정말 죄송해요. 방 번호가 어떻게 되세요?', ['room number']);
  // 조식 식당
  Q('bf_room', 'breakfast', 'roomno', 'Good morning! What\'s your room number?', '안녕하세요! 방 번호가 어떻게 되세요?', ['room number'], { short: 'Room number?' });
  Q('bf_drink', 'breakfast', 'drink', 'Coffee or tea?', '커피 드릴까요, 차 드릴까요?', ['Coffee or tea']);
  Q('bf_fast', 'breakfast', 'roomno', 'Morning! Can I just grab your room number real quick?', '안녕하세요! 방 번호 좀 빨리 여쭤봐도 될까요?', ['room number'], { fast: true });
  Q('bf_charge', 'breakfast', 'charge', 'Breakfast isn\'t included in your rate, so I\'ll charge it to your room. Is that okay?', '조식이 방값에 포함되지 않아서 방으로 달아 둘게요. 괜찮으세요?', ['charge it to your room']);
  // 컨시어지 · 짐
  Q('cg_help', 'concierge', 'ask', 'Hello. How can I help you today?', '안녕하세요. 무엇을 도와드릴까요?', ['How can I help'], { short: 'How can I help you?' });
  Q('cg_more', 'concierge', 'ask', 'Of course. Anything else?', '물론이죠. 더 필요한 것 있으세요?', ['Anything else']);
  Q('cg_wtime', 'concierge', 'waketime', 'Sure. What time would you like the call?', '네. 몇 시에 전화드릴까요?', ['What time']);
  Q('cg_htime', 'concierge', 'holdtime', 'No problem. Until what time?', '그럼요. 몇 시까지요?', ['Until what time'], { short: 'Until what time?' });
  // 프런트 · 체크아웃
  Q('co_out', 'checkout', 'co', 'Good morning. Checking out?', '안녕하세요. 체크아웃하세요?', ['Checking out'], { short: 'Checking out?' });
  Q('co_room', 'checkout', 'roomno', 'Sure. What\'s your room number?', '네. 방 번호가 어떻게 되세요?', ['room number']);
  Q('co_mini', 'checkout', 'minibar', 'Did you have anything from the minibar?', '미니바에서 드신 것 있으세요?', ['minibar'], { short: 'Anything from the minibar?' });
  Q('co_stay', 'checkout', 'stay', 'How was your stay?', '머무시는 동안 어떠셨어요?', ['How was your stay']);
  Q('co_bill', 'checkout', 'bill', 'Here\'s your bill. Your total is $334.40.', '청구서 여기 있어요. 합계는 334달러 40센트예요.', ['bill', '$334.40']);
  // 곳마다 대표 말 (영상 01장 지도 · 직접 해 보기)
  HT.ROUTE = {
    checkin: ['ci_resv', 'ci_nights'], key: ['k_room', 'k_bf'], call: ['cl_help', 'cl_room'], problem: ['pr_help', 'pr_room'],
    breakfast: ['bf_room', 'bf_drink'], concierge: ['cg_help', 'cg_htime'], checkout: ['co_out', 'co_mini'],
  };

  /* =========================================================
     칸에 넣는 내 정보 (slot). 틀(frame)이 form으로 어느 꼴을 쓸지 정해요.
     fact: 이 값이 말하는 사실 · bad · why: 콩글리시 값(② 탈락) · note: 통하지만 덧붙일 말 · days: 박을 날로 센 값
     dyn: 방 번호 · 시각처럼 값이 정해져 있지 않은 칸
     ========================================================= */
  HT.NAMES = { Kim: { ko: '김', sp: 'K-I-M' }, Lee: { ko: '이', sp: 'L-E-E' }, Park: { ko: '박', sp: 'P-A-R-K' }, Choi: { ko: '최', sp: 'C-H-O-I' }, Jung: { ko: '정', sp: 'J-U-N-G' }, Kang: { ko: '강', sp: 'K-A-N-G' } };
  HT.FIRST = { Minji: '민지', Jisoo: '지수', Doyun: '도윤', Seoyeon: '서연', Haneul: '하늘', Junho: '준호' };
  const nameVals = {}, spellVals = {};
  Object.entries(HT.NAMES).forEach(([k, v]) => { nameVals[k] = { t: k, ko: v.ko + '(' + k + ')' }; spellVals[k] = { t: v.sp, ko: v.sp, fact: { name: k } }; });
  const nv = (n, unit) => `${numWord(n)} ${unit}${n === 1 ? '' : 's'}`, cap = s => s[0].toUpperCase() + s.slice(1);
  const nightVals = {};
  [1, 2, 3, 4].forEach(n => { nightVals['n' + n] = { t: cap(nv(n, 'night')), low: nv(n, 'night'), ko: `${n}박`, fact: { nights: n } }; });
  [2, 3, 4, 5].forEach(n => { nightVals['d' + n] = { t: cap(nv(n, 'day')), low: nv(n, 'day'), ko: `${n}일`, days: n, fact: { nights: n } }; });
  HT.SLOT = {
    name: { key: 'name', vals: nameVals },
    spell: { key: 'name', vals: spellVals },
    nights: { key: 'nights', vals: nightVals },
    room: { key: 'room', dyn: 'room' },
    wtime: { key: 'wake', dyn: 'time' },
    htime: { key: 'hold', dyn: 'time', word: true },
    thing: { key: 'thing', vals: {
      towels: { t: 'some extra towels', short: 'Towels', bare: 'towel', ko: '수건', fact: { thing: 'towels' }, vague: true },
      towels2: { t: 'two extra towels', short: 'Two extra towels', bare: 'two towel', ko: '수건 두 장', fact: { thing: 'towels', n: 2 } },
      towels3: { t: 'three extra towels', short: 'Three extra towels', bare: 'three towel', ko: '수건 세 장', fact: { thing: 'towels', n: 3 } },
      pillow: { t: 'another pillow', short: 'Another pillow', bare: 'pillow', ko: '베개 하나 더', fact: { thing: 'pillow' } },
      toothbrush: { t: 'a toothbrush', short: 'A toothbrush', bare: 'toothbrush', ko: '칫솔', fact: { thing: 'toothbrush' } },
      adapter: { t: 'a plug adapter', short: 'A plug adapter', bare: 'adapter', ko: '플러그 어댑터', fact: { thing: 'adapter' } },
      hairdryer: { t: 'a hair dryer', short: 'A hair dryer', bare: 'hair dryer', ko: '헤어드라이어', fact: { thing: 'hairdryer' } },
      dryer: { t: 'a dryer', short: 'A dryer', bare: 'dryer', ko: '드라이기', fact: { thing: 'hairdryer' }, note: '‘드라이기’ → dryer만 말하면 옷 말리는 건조기로 들을 수도 있어요. 분명하게 → a hair dryer.' },
    } },
    count: { key: 'n', vals: { c2: { t: 'Two', bare: 'Two towel', ko: '두 장', fact: { n: 2 } }, c3: { t: 'Three', bare: 'Three towel', ko: '세 장', fact: { n: 3 } }, c1: { t: 'One', bare: 'One towels', ko: '한 장', fact: { n: 1 } } } },
    brk: { key: 'prob', vals: {
      ac: { t: 'air conditioner', ko: '에어컨', fact: { prob: 'ac' } },
      tv: { t: 'TV', ko: 'TV', fact: { prob: 'tv' } },
      wifi: { t: 'Wi-Fi', ko: '와이파이', fact: { prob: 'wifi' } },
      outlet: { t: 'outlet', ko: '콘센트', fact: { prob: 'outlet' } },
      remote: { t: 'remote', ko: '리모컨', fact: { prob: 'remote' } },
      consent: { t: 'consent', ko: '콘센트', fact: { prob: 'outlet' }, bad: 'literal', why: '‘콘센트’를 그대로 옮긴 consent는 ‘동의’라는 낱말이라 알아듣기 어려워요. 벽의 전기 꽂는 곳 → outlet (영국은 socket).' },
      remocon: { t: 'remocon', ko: '리모컨', fact: { prob: 'remote' }, bad: 'literal', why: '‘리모컨’은 한국에서 줄여 만든 말이에요. 영어로는 → the remote (remote control).' },
    } },
    lack: { key: 'prob', vals: { hotwater: { t: 'hot water', ko: '뜨거운 물', fact: { prob: 'nohot' } }, toiletpaper: { t: 'toilet paper', ko: '화장지', fact: { prob: 'notp' } } } },
    too: { key: 'prob', vals: { noisy: { t: 'noisy', ko: '시끄러움', fact: { prob: 'noisy' } }, cold: { t: 'cold', ko: '추움', fact: { prob: 'cold' } } } },
    bring: { key: 'fixv', vals: { towels: { t: 'some towels', ko: '수건', fact: {} }, toiletpaper: { t: 'some toilet paper', ko: '화장지', fact: {} }, blanket: { t: 'an extra blanket', ko: '담요 하나 더', fact: {} }, batteries: { t: 'new batteries', ko: '새 건전지', fact: {} } } },
    drink: { key: 'drink', vals: { coffee: { t: 'Coffee', ko: '커피' }, tea: { t: 'Tea', ko: '차' } } },
    mini: { key: 'minibar', vals: { water: { t: 'a bottle of water', ko: '물 한 병' }, juice: { t: 'an orange juice', ko: '오렌지 주스 하나' }, chips: { t: 'a bag of chips', ko: '감자칩 한 봉지' } } },
  };
  // 칸 값 하나 (값이 정해져 있지 않은 칸도)
  HT.sv = function (slot, v) {
    const S = HT.SLOT[slot]; if (!S || v == null) return null;
    if (S.dyn === 'room') return /^\d{3,4}$/.test(String(v)) ? { t: String(v), ko: `${v}호`, fact: { room: String(v) } } : null;
    if (S.dyn === 'time') return /^\d{1,2}:\d{2}$/.test(String(v)) ? { t: S.word ? HT.timeWords(v) : String(v), ko: HT.timeKo(v, S.word), fact: { [S.key]: String(v) } } : null;
    return S.vals[v] || null;
  };
  const valFact = (slot, v) => { const x = HT.sv(slot, v); if (!x) return {}; return x.fact ? Object.assign({}, x.fact) : { [HT.SLOT[slot].key]: v }; };
  HT.valFact = valFact;
  // 카드와 맞는 칸 값 (콩글리시 · 날로 센 값 · 막연한 값은 빼고)
  const slotIds = slot => { const S = HT.SLOT[slot]; return S.dyn ? [] : Object.keys(S.vals).filter(id => { const x = S.vals[id]; return !x.bad && !x.days && !x.vague && !x.note; }); };
  HT.slotVal = function (slot, C) {
    const S = HT.SLOT[slot];
    if (S.dyn) { const v = C[S.key]; return v != null && HT.sv(slot, v) ? String(v) : null; }
    if (slot === 'bring') { const p = HT.PROB[C.prob]; const f = p && p.fits.find(x => x.startsWith('bring:')); return f ? f.slice(6) : null; }
    return slotIds(slot).find(id => { const f = valFact(slot, id); return Object.keys(f).length && Object.keys(f).every(k => C[k] === f[k]); }) || null;
  };

  /* =========================================================
     문제와 어울리는 부탁 — HT.fix(문제, 부탁)
     fits: send(사람 보내기) · change(방 바꾸기) · key(새 카드 키) · bring:물건(가져다주기)
     ========================================================= */
  HT.PROB = {
    ac: { ko: '에어컨이 안 돼요', fact: 'pf_isnt', v: 'ac', fits: ['send', 'change'] },
    tv: { ko: 'TV가 안 나와요', fact: 'pf_isnt', v: 'tv', fits: ['send'] },
    wifi: { ko: '와이파이가 안 돼요', fact: 'pf_isnt', v: 'wifi', fits: ['send'] },
    outlet: { ko: '콘센트가 안 돼요', fact: 'pf_isnt', v: 'outlet', fits: ['send'] },
    remote: { ko: '리모컨이 안 돼요', fact: 'pf_isnt', v: 'remote', fits: ['send', 'bring:batteries'] },
    keycard: { ko: '카드 키가 안 돼요', fact: 'pf_key', fits: ['key'] },
    locked: { ko: '카드 키를 방 안에 두고 나왔어요', fact: 'pf_lock', fits: ['key'] },
    nohot: { ko: '뜨거운 물이 안 나와요', fact: 'pf_no', v: 'hotwater', fits: ['send', 'change'] },
    notp: { ko: '화장지가 없어요', fact: 'pf_no', v: 'toiletpaper', fits: ['bring:toiletpaper'] },
    notowel: { ko: '수건이 없어요', fact: 'pf_towel', fits: ['bring:towels'] },
    noisy: { ko: '방이 너무 시끄러워요', fact: 'pf_too', v: 'noisy', fits: ['change'] },
    cold: { ko: '방이 너무 추워요', fact: 'pf_too', v: 'cold', fits: ['send', 'change', 'bring:blanket'] },
  };
  const FIX_KO = { send: '사람을 보내 달라는 부탁', change: '방을 바꿔 달라는 부탁', key: '새 카드 키를 만들어 달라는 부탁', bring: '가져다 달라는 부탁' };
  const fixKey = r => { const F = HT.FRAME[r.f]; return F.fix === 'bring' ? 'bring:' + (r.v || '') : F.fix; };
  const fixText = k => { if (k.startsWith('bring:')) { const v = HT.SLOT.bring.vals[k.slice(6)]; return `Could you bring up ${v ? v.t : '…'}, please?`; } return { send: 'Could you send someone to look at it?', change: 'Could I change rooms?', key: 'Could you make a new key for me?' }[k]; };
  HT.fixText = fixText;
  HT.fixReq = k => k.startsWith('bring:') ? { f: 'rq_bring', v: k.slice(6) } : { f: { send: 'rq_send', change: 'rq_change', key: 'rq_key' }[k] };
  HT.fix = function (prob, r) {
    const P = HT.PROB[prob]; if (!P || !r) return { ok: true };
    const k = fixKey(r);
    if (P.fits.includes(k)) return { ok: true, why: `${P.ko} → ${FIX_KO[k.split(':')[0]]}, 잘 맞아요.` };
    const what = k.startsWith('bring:') ? `${eul((HT.SLOT.bring.vals[k.slice(6)] || {}).ko || '물건')} 가져다 달라는 부탁` : FIX_KO[k];
    return { ok: false, why: `문제(${P.ko})와 부탁(${what})이 맞지 않아요. 이 문제에 맞는 부탁 → ${P.fits.map(fixText).join(' · ')}` };
  };

  /* =========================================================
     전화 한 줄 — 조각과 순서: 인사 → 방 번호 → 부탁 틀 + 필요한 것 → please → Thank you. (단순하게 줄인 규칙)
     줄 = { words: [조각 id, …], room: '1207' }
     ========================================================= */
  HT.CW = { hi: { c: 'hi', t: 'Hi,' }, room: { c: 'room', t: 'this is room ___' }, could: { c: 'ask', t: 'Could I get' }, bring: { c: 'ask', t: 'Could you bring up' }, give: { c: 'ask', t: 'Give me' }, please: { c: 'please', t: 'please' }, thanks: { c: 'thanks', t: 'Thank you.' } };
  Object.keys(HT.SLOT.thing.vals).forEach(k => { HT.CW[k] = { c: 'thing', t: HT.SLOT.thing.vals[k].t }; });
  HT.CCAT = { hi: { ko: '인사', n: 1 }, room: { ko: '방 번호', n: 2 }, ask: { ko: '부탁 틀', n: 3 }, thing: { ko: '필요한 것', n: 4 }, please: { ko: 'please', n: 5 }, thanks: { ko: '끝인사', n: 6 } };
  HT.callLine = function (L) {
    const ws = L.words, W = ws.map(w => HT.CW[w]);
    if (W.some(x => !x)) return { ok: false, why: '사전에 없는 조각이 있어요.' };
    const at = c => W.map((x, i) => (x.c === c ? i : -1)).filter(i => i >= 0), n = c => at(c).length;
    for (const c of ['hi', 'room', 'ask', 'thing', 'please', 'thanks']) if (n(c) > 1) return { ok: false, why: `${HT.CCAT[c].ko}${has(HT.CCAT[c].ko) ? '은' : '는'} 한 번만 말해요.`, stage: 2 };
    if (!n('thing')) return { ok: false, stage: 1, why: n('ask') ? '부탁 틀만 있고 무엇이 필요한지(필요한 것)가 빠졌어요.' : '부탁이 없어요. 무엇이 필요한지 말해요.' };
    const want = ws.slice().sort((a, b) => HT.CCAT[HT.CW[a].c].n - HT.CCAT[HT.CW[b].c].n);
    const bad = why => ({ ok: false, stage: 2, why: `순서가 어색해요. ${why} 자연스러운 순서 → ${HT.lineText({ words: want, room: L.room })}`, want });
    if (n('hi') && at('hi')[0] !== 0) return bad('인사 → 맨 앞에 와요.');
    if (n('thanks') && at('thanks')[0] !== ws.length - 1) return bad('끝인사 → 부탁을 다 한 뒤 맨 끝에 와요.');
    const th = at('thing')[0];
    if (n('ask') && at('ask')[0] !== th - 1) return bad('부탁 틀 바로 뒤에 필요한 것이 와요 → Could I get + 필요한 것.');
    if (n('please')) { const p = at('please')[0], a0 = n('ask') ? at('ask')[0] : th; if (p !== th + 1 && p !== a0 - 1) return bad('please → 부탁하는 문장 끝(필요한 것 바로 뒤)에 와요.'); }
    const late = n('room') && at('room')[0] > th;
    const parts = W.map(x => HT.CCAT[x.c].ko).filter((k, i, a) => a.indexOf(k) === i).join(' → ');
    return { ok: true, why: `순서 → ${parts}. 자연스러워요.`, want, note: late ? '방 번호를 끝에 말해도 통해요. 다만 전화에서는 방 번호를 먼저 말하면, 직원이 듣는 동안 방을 찾아 둘 수 있어요.' : '' };
  };
  HT.lineFacts = L => { const f = {}; L.words.forEach(w => { const x = HT.CW[w]; if (!x) return; if (x.c === 'thing') Object.assign(f, valFact('thing', w)); if (x.c === 'room' && L.room) f.room = String(L.room); }); return f; };
  HT.lineHasPol = L => L.words.some(w => ['could', 'bring', 'please', 'thanks'].includes(w));
  function lineSegs(L) {
    const out = [], ws = L.words;
    let start = true, inReq = null;
    const capF = t => (start ? t[0].toUpperCase() + t.slice(1) : t);
    const push = (t, r, part) => { out.push({ t: capF(t), r, part }); start = false; };
    const sp = () => { if (out.length) out.push({ t: ' ', r: 'frame' }); };
    const close = () => { if (inReq) { out.push({ t: inReq === 'q' ? '?' : '.', r: 'frame' }); inReq = null; start = true; } };
    ws.forEach((w, k) => {
      const x = HT.CW[w]; if (!x) return;
      if (x.c === 'hi') { close(); sp(); push('Hi', 'pol', 'hi'); out.push({ t: ',', r: 'frame' }); }
      else if (x.c === 'room') { close(); sp(); push('this is room ', 'frame', 'room'); out.push({ t: String(L.room || '___'), r: 'slot', part: 'room' }, { t: '.', r: 'frame' }); start = true; }
      else if (x.c === 'thanks') { close(); sp(); push('Thank you', 'pol', 'thanks'); out.push({ t: '.', r: 'frame' }); start = true; }
      else if (x.c === 'please') {
        const nx = HT.CW[ws[k + 1]];
        if (nx && nx.c === 'ask' && !inReq) { sp(); push('please', 'pol', 'please'); }
        else { out.push({ t: ', ', r: 'frame' }); out.push({ t: 'please', r: 'pol', part: 'please' }); start = false; }
      } else if (x.c === 'ask') {
        close(); sp();
        if (w === 'could') { push('Could I', 'pol', 'ask'); out.push({ t: ' get', r: 'frame', part: 'ask' }); inReq = 'q'; }
        else if (w === 'bring') { push('Could you', 'pol', 'ask'); out.push({ t: ' bring up', r: 'frame', part: 'ask' }); inReq = 'q'; }
        else { push('Give me', 'frame', 'ask'); inReq = 's'; }
      } else if (x.c === 'thing') {
        const v = HT.SLOT.thing.vals[w];
        if (!inReq) { sp(); push(v.short, 'slot', 'thing'); inReq = 's'; }
        else { out.push({ t: ' ', r: 'frame' }); push(v.t, 'slot', 'thing'); }
      }
    });
    close();
    return out;
  }
  HT.lineText = L => lineSegs(L).map(s => s.t).join('');

  /* =========================================================
     대답 틀 (frame). t: 틀 글 — ___ = 내 정보 칸, {…} = 공손한 말
     tag: ok · literal(한국어 그대로 · 콩글리시) · wrong(틀린 문장) · blunt(명령 · 조르기 · 따지기) · plain(그냥 No.로 끊김)
     check: 들은 번호를 되물어 확인하는 말 · req: 문제 뒤에 붙이는 부탁(fix) · note: 통하지만 덧붙일 말
     ========================================================= */
  HT.FRAME = {};
  const FR = (id, intent, t, ko, o = {}) => (HT.FRAME[id] = Object.assign({ id, intent, t, ko, tag: 'ok' }, o));
  // 체크인
  FR('rs_under', 'resv', 'Yes, I have a reservation under ___.', '네, ___(으)로 예약했어요.', { slot: 'name', fact: { resv: true } });
  FR('rs_do', 'resv', 'Yes, I do.', '네, 했어요.', { fact: { resv: true } });
  FR('rs_lit', 'resv', 'Yes, I reserved.', '(틀린 말) 네, 예약했어요.', { fact: { resv: true }, tag: 'wrong', why: '‘예약했어요’를 그대로 옮기면 reserve 뒤에 무엇을 예약했는지가 빠져요. 예약이 있다고 → Yes, I have a reservation under Kim.' });
  FR('nm_its', ['name'], 'It\'s ___.', '___(이)에요.', { slot: 'name' });
  FR('nm_lit', 'name', 'Name is ___.', '(틀린 말) 이름은 ___(이)에요.', { slot: 'name', tag: 'wrong', why: '‘이름은 ~예요’를 그대로 옮기면 my가 빠진 틀린 문장이 돼요. 짧게 성만 → It\'s Kim.' });
  FR('sp_spell', 'spell', '___.', '___.', { slot: 'spell' });
  FR('nt_n', 'nights', '___.', '___.', { slot: 'nights' });
  FR('nt_for', 'nights', 'For ___.', '___ 동안이요.', { slot: 'nights', form: 'low' });
  FR('nt_during', 'nights', 'During ___.', '(어색한 말) ___ 동안이요.', { slot: 'nights', form: 'low', tag: 'literal', why: '‘2박 동안’의 ‘동안’을 낱말 그대로 옮긴 말이에요. during 뒤에는 기간을 세는 말이 오지 않아요. 기간은 for → For two nights. 또는 그냥 Two nights.' });
  FR('pp_here', ['passport', 'incid'], '{Sure}, here you go.', '네, 여기 있어요.');
  FR('ic_why', 'incid', 'Why? I already paid.', '(따지는 말) 왜요? 이미 냈는데요.', { tag: 'blunt', why: '따지는 말처럼 들려요. incidentals는 방값이 아니라 미니바 같은 추가 요금에 대비해 카드에 잠깐 잡아 두는 금액이에요(호텔마다 달라요). 궁금하면 → Sorry, what are incidentals?' });
  // 방 열쇠 · 안내
  FR('ty', ['keyinfo', 'bfinfo', 'coinfo', 'wifiinfo'], '{Thank you}.', '고마워요.');
  FR('cf_room', 'keyinfo', '{Sorry}, was that room ___?', '죄송한데, ___호였나요?', { slot: 'room', check: true });
  FR('km_no', 'kmore', 'No, that\'s all. {Thank you}.', '아니요, 그게 다예요. 고마워요.', { fact: { kq: 'none' } });
  FR('km_wifi', 'kmore', 'Yes. What\'s the Wi-Fi password?', '네. 와이파이 비밀번호가 뭐예요?', { fact: { kq: 'wifi' } });
  FR('km_incl', 'kmore', 'Yes. Is breakfast included?', '네. 조식이 포함돼 있나요?', { fact: { kq: 'bfincl' } });
  FR('km_service', 'kmore', 'Yes. Is breakfast service?', '(콩글리시) 네. 조식은 서비스예요?', { fact: { kq: 'bfincl' }, tag: 'literal', why: '한국에서 ‘서비스’는 덤으로 공짜로 주는 것이지만, 영어 service는 ‘손님을 돕는 일’이라 뜻이 통하지 않아요. 방값에 들어 있는지 → Is breakfast included?' });
  FR('km_plain', 'kmore', 'No.', '아니요.', { fact: { kq: 'none' }, tag: 'plain', why: '그냥 No.라고 끊으면 무뚝뚝하게 들릴 수 있어요. → No, that\'s all. Thank you.' });
  // 전화 부탁
  FR('cl_could', 'help', '{Could I} get ___, {please}?', '___ 주시겠어요?', { slot: 'thing' });
  FR('cl_bring', 'help', '{Could you} bring up ___, {please}?', '___ 가져다주시겠어요?', { slot: 'thing' });
  FR('cl_short', 'help', '___, {please}.', '___ 주세요.', { slot: 'thing', form: 'short' });
  FR('cl_give', 'help', 'Give me ___.', '(무례한 말) ___ 줘요.', { slot: 'thing', form: 'bare', tag: 'blunt', why: '‘수건 주세요’를 낱말 그대로 옮긴 Give me는 명령처럼 들려요. 물건 앞의 a · some(여럿이면 towels처럼 -s)도 빠지기 쉬워요. 부탁은 질문으로 → Could I get some extra towels, please?' });
  FR('cl_want', 'help', 'I want ___.', '(조르는 말) ___ 원해요.', { slot: 'thing', tag: 'blunt', why: 'I want는 원한다는 사실만 말해서 조르는 말처럼 들려요. 부탁은 질문으로 → Could I get …, please?' });
  FR('line', 'help', '', '', { line: true });   // 전화 한 줄 (HT.callLine)
  FR('rn_its', ['roomno'], 'It\'s ___.', '___호예요.', { slot: 'room' });
  FR('rn_room', 'roomno', 'Room ___.', '___호요.', { slot: 'room' });
  FR('rn_lit', 'roomno', 'Room is ___.', '(틀린 말) 방은 ___호예요.', { slot: 'room', tag: 'wrong', why: '‘방은 1207호예요’를 그대로 옮기면 my가 빠진 틀린 문장이 돼요. 짧게 → It\'s 1207. 또는 Room 1207.' });
  FR('ct_n', 'count', '___, {please}.', '___ 주세요.', { slot: 'count' });
  FR('ct_bare', 'count', '___.', '(틀린 말) ___.', { slot: 'count', form: 'bare', tag: 'wrong', why: '둘 이상이면 낱말 끝에 -s → two towels. 짧게 수만 말해도 돼요 → Two, please.' });
  // 문제 알리기: 사실 (intent issue)
  FR('pf_isnt', 'issue', 'The ___ isn\'t working.', '___(이)가 안 돼요.', { slot: 'brk' });
  FR('pf_key', 'issue', 'My key card isn\'t working.', '카드 키가 안 돼요.', { fact: { prob: 'keycard' } });
  FR('pf_no', 'issue', 'There\'s no ___.', '___(이)가 없어요.', { slot: 'lack' });
  FR('pf_towel', 'issue', 'There are no towels in the bathroom.', '욕실에 수건이 없어요.', { fact: { prob: 'notowel' } });
  FR('pf_too', 'issue', 'The room is too ___.', '방이 너무 ___.', { slot: 'too' });
  FR('pf_lock', 'issue', 'I\'m locked out. I left my key card in the room.', '문이 잠겼어요. 카드 키를 방 안에 두고 나왔어요.', { fact: { prob: 'locked' } });
  FR('pf_hotlit', 'issue', 'Hot water doesn\'t come out.', '뜨거운 물이 안 나와요.', { fact: { prob: 'nohot' }, note: '‘안 나와요’를 그대로 옮겼지만 통해요. 보통은 → There\'s no hot water.' });
  FR('pf_tvlit', 'issue', 'TV doesn\'t come out.', '(어색한 말) TV가 안 나와요.', { fact: { prob: 'tv' }, tag: 'literal', why: '‘TV가 안 나와요’를 낱말 그대로 옮긴 말이에요. come out은 ‘밖으로 나오다’라 무슨 뜻인지 알기 어려워요. → The TV isn\'t working.' });
  FR('pf_noise', 'issue', 'My room is very noise.', '(틀린 말) 방이 아주 소음이에요.', { fact: { prob: 'noisy' }, tag: 'wrong', why: 'noise는 ‘소음’(명사)이라 방을 꾸밀 수 없어요. 시끄러우면 → The room is too noisy. (too = 불편할 만큼 너무)' });
  // 문제 뒤에 붙이는 부탁 (req)
  FR('rq_send', 'fix', '{Could you} send someone to look at it?', '사람을 보내 봐 주시겠어요?', { req: true, fix: 'send' });
  FR('rq_change', 'fix', '{Could I} change rooms?', '방을 바꿀 수 있을까요?', { req: true, fix: 'change' });
  FR('rq_bring', 'fix', '{Could you} bring up ___, {please}?', '___ 가져다주시겠어요?', { req: true, fix: 'bring', slot: 'bring' });
  FR('rq_key', 'fix', '{Could you} make a new key for me?', '새 카드 키를 만들어 주시겠어요?', { req: true, fix: 'key' });
  FR('rq_fix', 'fix', 'Fix it.', '(명령) 고쳐요.', { req: true, fix: 'send', tag: 'blunt', why: '‘고쳐 주세요’를 낱말 그대로 옮긴 명령이에요. 따지는 말처럼 들려요. → Could you send someone to look at it?' });
  FR('rq_chg', 'fix', 'Change my room.', '(명령) 방 바꿔요.', { req: true, fix: 'change', tag: 'blunt', why: '명령처럼 들려요. 방을 바꾸고 싶으면 → Could I change rooms? (지금 방 → 다른 방, 방이 둘이라 rooms)' });
  // 조식 식당
  FR('dk_pl', 'drink', '___, {please}.', '___(으)로 주세요.', { slot: 'drink' });
  FR('ch_ok', 'charge', 'Yes, that\'s fine.', '네, 괜찮아요.', { fact: { charge: true } });
  // 컨시어지 (intent ask)
  FR('cg_wake', 'ask', '{Could I} get a wake-up call at ___, {please}?', '___에 모닝콜 해 주시겠어요?', { slot: 'wtime', fact: { want: 'wake' } });
  FR('cg_wake0', 'ask', '{Could I} get a wake-up call, {please}?', '모닝콜 해 주시겠어요?', { fact: { want: 'wake' } });
  FR('cg_morning', 'ask', '{Could I} get a morning call at ___, {please}?', '___에 모닝콜 해 주시겠어요?', { slot: 'wtime', fact: { want: 'wake' }, note: '‘모닝콜’(morning call)도 통하는 호텔이 많아요(특히 아시아). 영어로는 보통 → a wake-up call.' });
  FR('cg_wakecmd', 'ask', 'Wake me up at ___.', '(명령) ___에 깨워요.', { slot: 'wtime', fact: { want: 'wake' }, tag: 'blunt', why: '명령처럼 들려요. 부탁은 질문으로 → Could I get a wake-up call at 6:30, please?' });
  FR('cg_hold', 'ask', '{Could you} hold my luggage until ___?', '___까지 짐을 맡아 주시겠어요?', { slot: 'htime', fact: { want: 'hold' } });
  FR('cg_hold0', 'ask', '{Could you} hold my luggage, {please}?', '짐을 맡아 주시겠어요?', { fact: { want: 'hold' } });
  FR('cg_keep', 'ask', 'Keep my bag.', '(명령) 내 가방 맡아요.', { fact: { want: 'hold' }, tag: 'blunt', why: '‘가방 맡아 주세요’를 그대로 옮긴 명령이에요. 부탁은 질문으로 → Could you hold my luggage until three?' });
  FR('cg_taxi', 'ask', '{Could you} call a taxi for me, {please}?', '택시를 불러 주시겠어요?', { fact: { want: 'taxi' } });
  FR('cg_late', 'ask', 'Is late check-out possible?', '늦게 체크아웃해도 될까요?', { fact: { want: 'late' } });
  FR('tm_at', 'waketime', 'At ___, {please}.', '___에요.', { slot: 'wtime' });
  FR('tm_until', 'holdtime', 'Until ___, {please}.', '___까지요.', { slot: 'htime' });
  // 체크아웃
  FR('co_yes', 'co', 'Yes, room ___.', '네, ___호예요.', { slot: 'room', fact: { co: true } });
  FR('co_yesp', 'co', 'Yes, I\'m checking out.', '네, 체크아웃할게요.', { fact: { co: true } });
  FR('co_lit', 'co', 'Yes. Room is ___.', '(틀린 말) 네. 방은 ___호예요.', { slot: 'room', fact: { co: true }, tag: 'wrong', why: '‘방은 ~호예요’를 그대로 옮기면 my가 빠진 틀린 문장이 돼요. 짧게 → Yes, room 1207.' });
  FR('mb_no', 'minibar', 'No, nothing.', '아니요, 아무것도요.', { fact: { minibar: 'none' } });
  FR('mb_yes', 'minibar', 'Yes, just ___.', '네, ___만요.', { slot: 'mini' });
  FR('mb_dont', 'minibar', 'No, I don\'t.', '(틀린 말) 아니요, 안 해요.', { fact: { minibar: 'none' }, tag: 'wrong', why: 'Did you …?(과거)로 물었으니 대답도 과거예요 → No, I didn\'t. 짧게 → No, nothing.' });
  FR('st_great', 'stay', 'It was great, {thank you}.', '아주 좋았어요, 고마워요.');
  FR('bl_ok', 'bill', 'That looks right. {Thank you}.', '맞네요. 고마워요.', { fact: { billErr: 'none' } });
  FR('bl_mini', 'bill', '{I think} there\'s a mistake on my bill. I didn\'t use the minibar.', '청구서에 실수가 있는 것 같아요. 미니바를 쓰지 않았어요.', { fact: { billErr: 'minibar' } });
  FR('bl_nights', 'bill', '{I think} there\'s a mistake on my bill. I only stayed ___.', '청구서에 실수가 있는 것 같아요. ___만 묵었어요.', { slot: 'nights', form: 'low', fact: { billErr: 'nights' } });
  FR('bl_wrong', 'bill', 'This bill is wrong.', '(따지는 말) 이 청구서 틀렸어요.', { fact: { billErr: 'mistake' }, tag: 'blunt', why: '‘틀렸어요’를 그대로 옮기면 따지는 말처럼 들려요. I think로 부드럽게, 무엇이 다른지 말해요 → I think there\'s a mistake on my bill. I didn\'t use the minibar.' });
  // 다시 묻기. echo: 들린 만큼 되묻는 말 — 실제로 들은 말이어야 통과 · kind spell · what: 대답 대신 해도 되는 말(allow)
  FR('rp_again', 'repair', '{Sorry? Could you} say that again, {please}?', '죄송한데, 다시 한 번 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_sorry', 'repair', '{Sorry}?', '네? (다시 말해 달라는 뜻)', { kind: 'again' });
  FR('rp_slow', 'repair', '{Could you} speak more slowly, {please}?', '조금 더 천천히 말씀해 주시겠어요?', { kind: 'slow' });
  FR('rp_spell', 'repair', '{Could you} spell that, {please}?', '철자를 불러 주시겠어요?', { kind: 'spell' });
  FR('rp_what', 'repair', '{Sorry}, what are incidentals?', '죄송한데, incidentals가 뭐예요?', { kind: 'what' });
  FR('rp_room', 'repair', '{Sorry}, what was the room number?', '죄송한데, 방 번호가 뭐였죠?', { kind: 'echo', echo: 'keyinfo' });
  FR('rp_bf', 'repair', '{Sorry}, what time is breakfast?', '죄송한데, 조식이 몇 시였죠?', { kind: 'echo', echo: 'bfinfo' });
  FR('rp_co', 'repair', '{Sorry}, what time is check-out?', '죄송한데, 체크아웃이 몇 시였죠?', { kind: 'echo', echo: 'coinfo' });
  FR('rp_rude', 'repair', 'Speak slowly!', '(화난 말) 천천히 말해요!', { kind: 'slow', tag: 'blunt', why: '명령문만 쓰면 화난 것처럼 들려요. 부탁은 → Could you speak more slowly, please?' });
  FR('rp_noeng', 'repair', 'I can\'t English.', '(틀린 말) 저 영어 못 해요.', { kind: 'none', tag: 'wrong', why: 'speak가 빠진 틀린 말이에요(I can\'t speak English well). 이럴 때는 다시 물어보는 말이 더 도움이 돼요.' });
  // 다른 질문에 맞는 대답 (① 함정)
  FR('g_permit', 'g_permit', 'Yes, you can.', '네, 그러셔도 돼요.');
  FR('g_yes', 'g_yes', 'Yes.', '네.');
  FR('g_yesit', 'g_yes', 'Yes, it was.', '네, 그랬어요.');
  FR('g_pay', 'g_pay', 'Card, please.', '카드로 할게요.');

  /* ---------- 대답 글 만들기: 조각(segs) = [{ t, r: 'frame' | 'slot' | 'pol', req }] ---------- */
  const slotText = (F, v) => { const x = HT.sv(F.slot, v); return x ? (x[F.form || 't'] != null ? x[F.form || 't'] : x.t) : '___'; };
  function frameSegs(F, v) {
    const out = [], re = /\{([^}]*)\}|___/g; let last = 0, m;
    while ((m = re.exec(F.t))) {
      if (m.index > last) out.push({ t: F.t.slice(last, m.index), r: 'frame' });
      if (m[0] === '___') out.push({ t: slotText(F, v), r: 'slot' }); else out.push({ t: m[1], r: 'pol' });
      last = m.index + m[0].length;
    }
    if (last < F.t.length) out.push({ t: F.t.slice(last), r: 'frame' });
    const f0 = out.find(s => s.t.trim());
    if (f0) { const i = f0.t.search(/\S/); f0.t = f0.t.slice(0, i) + f0.t[i].toUpperCase() + f0.t.slice(i + 1); }
    return out;
  }
  HT.segs = function (a) {
    const F = HT.FRAME[a.f];
    if (F.line) return lineSegs(a.line);
    const out = frameSegs(F, a.v);
    if (a.req && HT.FRAME[a.req.f]) { out.push({ t: ' ', r: 'frame' }); frameSegs(HT.FRAME[a.req.f], a.req.v).forEach(s => out.push(Object.assign(s, { req: true }))); }
    return out;
  };
  HT.text = a => HT.segs(a).map(s => s.t).join('');
  // 해석
  const koOf = (F, v) => {
    if (!F.slot) return F.ko;
    const x = HT.sv(F.slot, v), k = x ? x.ko : '___';
    return F.ko.replace('___(으)로', ro(k)).replace('___(이)에요', ieyo(k)).replace('___(이)가', ig(k)).replace('___', k);
  };
  HT.ko = function (a) {
    const F = HT.FRAME[a.f];
    if (F.line) {
      const f = HT.lineFacts(a.line), th = (HT.SLOT.thing.vals[a.line.words.find(w => HT.CW[w] && HT.CW[w].c === 'thing')] || {}).ko || '';
      const give = a.line.words.includes('give');
      return `${a.line.words.includes('hi') ? '안녕하세요, ' : ''}${f.room ? `${f.room}호예요. ` : ''}${th} ${give ? '줘요. (무례한 말)' : '주시겠어요?'}${a.line.words.includes('thanks') ? ' 고마워요.' : ''}`;
    }
    return koOf(F, a.v) + (a.req && HT.FRAME[a.req.f] ? ' ' + koOf(HT.FRAME[a.req.f], a.req.v) : '');
  };
  // 대답이 말하는 사실
  HT.factOf = function (a) {
    const F = HT.FRAME[a.f], f = Object.assign({}, F.fact || {});
    if (F.slot && HT.sv(F.slot, a.v)) Object.assign(f, valFact(F.slot, a.v));
    if (F.line) Object.assign(f, HT.lineFacts(a.line));
    return f;
  };
  // 사실을 한국어로
  HT.nightsKo = n => `${n}박 ${n + 1}일`;
  HT.factKo = function (k, v) {
    if (k === 'name') return `${(HT.NAMES[v] || {}).ko || ''}(${v})`;
    if (k === 'nights') return `${HT.nightsKo(v)} (${numWord(v)} night${v === 1 ? '' : 's'})`;
    if (k === 'room') return `${v}호 (${HT.roomWords(v)})`;
    if (k === 'thing') return (HT.SLOT.thing.vals[v === 'towels' ? 'towels' : v] || {}).ko || String(v);
    if (k === 'n') return `${v}개`;
    if (k === 'prob') return (HT.PROB[v] || {}).ko || String(v);
    if (k === 'wake') return `${HT.timeKo(v)} 모닝콜 (${HT.timeWords(v)})`;
    if (k === 'hold') return `${HT.timeKo(v, true)}까지 (${HT.timeWords(v)})`;
    if (k === 'want') return { wake: '모닝콜', hold: '짐 맡기기', taxi: '택시 부르기', late: '늦은 체크아웃' }[v] || String(v);
    if (k === 'kq') return { none: '더 물어볼 것 없음', wifi: '와이파이 비밀번호 묻기', bfincl: '조식이 포함됐는지 묻기' }[v] || String(v);
    if (k === 'minibar') return v === 'none' ? '미니바 안 씀' : `미니바: ${(HT.SLOT.mini.vals[v] || {}).ko || v}`;
    if (k === 'billErr') return { none: '청구서가 맞음', minibar: '쓰지 않은 미니바 요금이 있음', nights: '묵은 밤보다 많이 청구됨', mistake: '청구서가 틀렸다고 함' }[v] || String(v);
    if (k === 'drink') return (HT.SLOT.drink.vals[v] || {}).ko || String(v);
    if (k === 'resv') return '예약 있음';
    if (k === 'co') return '체크아웃함';
    if (k === 'charge') return '조식값을 방으로';
    return String(v);
  };
  // 사실 맞춰 보기 (청구서가 틀렸다는 말 'mistake'는 실수가 있는 모든 카드와 맞음)
  const sameFact = (k, cv, fv) => cv === fv || (k === 'billErr' && fv === 'mistake' && cv !== 'none');

  /* ---------- 이미 답한 질문 (시뮬레이터의 직원이 건너뜀) ---------- */
  const KEY2INTENT = { name: ['name'], room: ['roomno'], thing: ['help'], n: ['count'], wake: ['waketime'], hold: ['holdtime'], nights: ['nights'] };
  HT.coveredBy = (facts, intent) => { const out = new Set(intent ? [intent] : []); Object.keys(facts).forEach(k => (KEY2INTENT[k] || []).forEach(i => out.add(i))); return [...out]; };
  HT.covered = (a, q) => { if (typeof q === 'string') q = HT.Q[q]; return HT.coveredBy(HT.factOf(a), q.intent); };
  HT.INTENT_KO = { resv: '예약', name: '이름', spell: '철자', nights: '묵는 밤', passport: '여권', incid: '카드', kmore: '더 물어볼 것', help: '필요한 것', roomno: '방 번호', count: '몇 개', issue: '문제', charge: '조식값', ask: '부탁', waketime: '모닝콜 시각', holdtime: '맡길 시각', co: '체크아웃', minibar: '미니바', stay: '소감', bill: '청구서', drink: '마실 것' };
  HT.coveredKo = cov => cov.filter(i => !['help', 'ask', 'resv', 'co', 'issue'].includes(i)).map(i => HT.INTENT_KO[i]).filter((x, i, a) => x && a.indexOf(x) === i);

  /* =========================================================
     판정 — HT.judge(직원의 말, 대답, 카드, 출처)
     q: HT.Q의 말(또는 id) · a: { f: 틀 id, v: 칸 값, req: { f, v }, line } · card: 사실 · src: '카드' | '상황'
     ========================================================= */
  const res = (ok, stage, why, tag) => ({ ok, stage, why, tag: tag || (ok ? 'ok' : '') });
  HT.judge = function (q, a, card, src = '카드') {
    if (typeof q === 'string') q = HT.Q[q];
    const F = HT.FRAME[a.f], C = Object.assign({}, card || {}, q.fact || {});
    const fi = [].concat(F.intent), key = q.key.join(' … ');
    let allowed = false;
    // ① 열쇠 낱말 잡기
    if (q.fast) {
      if (F.intent !== 'repair') return res(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 말했는지 모르는데 짐작해서 답하면 엉뚱한 대답이 될 수 있어요. 먼저 다시 물어요.', 'guess');
      if (F.kind === 'echo' && F.echo !== q.intent) return res(false, 1, `되물은 말이 달라요. 들린 낱말(${key})로 보면 직원은 ${HT.INTENT[q.intent].turn}에 대해 말했어요.`, 'intent');
    } else if (F.req) {
      return res(false, 1, '무엇이 문제인지(사실)가 빠지고 부탁만 있어요. 사실부터 말해요 → The ___ isn\'t working.', 'intent');
    } else if (!fi.includes(q.intent)) {
      if (F.intent === 'repair' && q.allow && q.allow.includes(F.kind)) allowed = true;
      else if (F.intent === 'repair') return res(false, 1, '대답이 아니라 다시 묻는 말이에요. 알아들었다면 바로 답해요.', 'intent');
      else return res(false, 1, `열쇠 낱말 ${key} → ${HT.sayOf(q.intent)}. 이 대답은 ${HT.INTENT[fi[0]].ans}에 맞는 말이에요.`, 'intent');
    }
    if (F.line) { const o = HT.callLine(a.line); if (!o.ok && o.stage === 1) return res(false, 1, o.why, 'intent'); }
    // ② 틀에 내 정보 넣기
    if (F.tag === 'literal' || F.tag === 'wrong') return res(false, 2, F.why, F.tag);
    const sv = F.slot ? HT.sv(F.slot, a.v) : null;
    if (sv && sv.bad) return res(false, 2, sv.why, sv.bad);
    if (sv && sv.days) {
      const n = C.nights;
      return res(false, 2, n != null ? `${src}: ${HT.nightsKo(n)} → 호텔은 밤(night)으로 세요 → ${nv(n, 'night')}. ‘${sv.t}’라고 하면 직원은 ${sv.days}박으로 알아들을 수 있어요.` : `호텔은 밤(night)으로 세요. ‘${sv.t}’라고 하면 직원은 ${sv.days}박으로 알아들을 수 있어요.`, 'days');
    }
    if (F.line) { const o = HT.callLine(a.line); if (!o.ok) return res(false, 2, o.why, 'order'); }
    const fact = HT.factOf(a);
    for (const k of Object.keys(fact)) {
      if (C[k] === undefined || sameFact(k, C[k], fact[k])) continue;
      if (F.check) return res(false, 2, `직원이 말한 번호와 달라요. 직원: ${HT.factKo(k, C[k])} · 이 대답: ${HT.factKo(k, fact[k])}.`, 'fact');
      return res(false, 2, `${wa(src)} 달라요. ${src}: ${HT.factKo(k, C[k])} · 이 대답: ${HT.factKo(k, fact[k])}.`, 'fact');
    }
    const R = a.req ? HT.FRAME[a.req.f] : null;
    if (R) {
      const rv = R.slot ? HT.sv(R.slot, a.req.v) : null;
      if (R.slot && !rv) return res(false, 2, '부탁의 칸이 비었어요.', 'fix');
      const fx = HT.fix(fact.prob, a.req);
      if (!fx.ok) return res(false, 2, fx.why, 'fix');
    }
    // ③ 공손하게 끝내기
    if (F.tag === 'blunt' || F.tag === 'plain') return res(false, 3, F.why, F.tag);
    if (R && R.tag === 'blunt') return res(false, 3, R.why, 'blunt');
    if (F.line && a.line.words.includes('give')) return res(false, 3, 'Give me로 시작하면 명령처럼 들려요. 부탁은 질문으로 → Could I get …, please?', 'blunt');
    // 통과
    const segs = HT.segs(a), pol = segs.filter(s => s.r === 'pol').map(s => s.t).filter((x, i, arr) => arr.indexOf(x) === i);
    let why;
    if (q.fast) why = F.kind === 'echo' ? '들린 만큼 되물어 확인했어요. 무엇에 대해 말했는지 알면 그 부분만 다시 물을 수 있어요.' : F.kind === 'slow' ? '천천히 말해 달라고 공손하게 부탁했어요.' : '못 알아들었을 때는 짐작하지 말고 공손하게 다시 물어요.';
    else if (allowed) why = F.kind === 'spell' ? '받아 적어야 하는 말은 철자를 물어 확인해요. 직원이 한 글자씩 불러 줄 거예요.' : '모르는 낱말은 짐작하지 말고 물어요. 직원이 쉬운 말로 다시 알려 줄 거예요.';
    else if (F.line) {
      const o = HT.callLine(a.line), cov = HT.coveredKo(HT.covered(a, q));
      why = `${o.why} ${cov.length ? `한 줄에 ${cov.join(' · ')}까지 말해서 직원이 그 질문을 건너뛰어요.` : '필요한 것만 말했으니 직원이 방 번호 등을 다시 물어요.'}${o.note ? ' ' + o.note : ''}`;
    } else if (q.intent === 'issue') {
      const P = HT.PROB[fact.prob];
      why = R ? `사실(${P.ko}) + 부탁(${HT.text(a.req)}) → 직원이 무엇을 할지 바로 알아요. ${HT.fix(fact.prob, a.req).why}` : `사실(${P.ko})만 말해도 직원이 먼저 도와줄 방법을 말해 줄 거예요. 부탁까지 하면 한 번에 끝나요 → ${fixText(P.fits[0])}`;
    } else if (F.check) why = `직원이 말한 번호(${HT.roomWords(C.room)})와 같아요. 번호가 헷갈리면 이렇게 되물어 확인해요.`;
    else {
      const In = HT.INTENT[q.intent], sl = segs.filter(s => s.r === 'slot').map(s => s.t);
      why = `열쇠 낱말 ${key} → ${HT.ASK[In.ask].ko}. ` + (sl.length ? `틀 + 내 정보(${sl.join(' ')}) → ${src}의 사실과 맞아요.` : Object.keys(fact).length ? `${src}의 사실(${Object.keys(fact).map(k => HT.factKo(k, fact[k])).join(' · ')})과 맞아요.` : '짧은 대답이면 충분해요.');
      const cov = HT.coveredKo(HT.covered(a, q).filter(i => i !== q.intent));
      if (cov.length) why += ` ${cov.join(' · ')}까지 말해서 직원이 그 질문을 건너뛰어요.`;
    }
    if (pol.length) why += ` 공손한 말 → ${pol.join(' · ')}.`;
    if (F.note) why += ` ${F.note}`;
    if (sv && sv.note) why += ` ${sv.note}`;
    return res(true, 0, why);
  };
  // 모범 대답 (카드에 맞춰)
  HT.model = function (q, card) {
    if (typeof q === 'string') q = HT.Q[q];
    const C = Object.assign({}, card || {}, q.fact || {});
    if (q.fast) return { f: q.intent === 'bfinfo' ? 'rp_bf' : q.intent === 'keyinfo' ? 'rp_room' : q.intent === 'coinfo' ? 'rp_co' : 'rp_again' };
    if (q.intent === 'help') return HT.modelLine(C);
    if (q.intent === 'issue') { const P = HT.PROB[C.prob] || HT.PROB.ac, a = { f: P.fact }; if (P.v) a.v = P.v; a.req = HT.fixReq(P.fits[0]); return a; }
    const In = HT.INTENT[q.intent], id = typeof In.best === 'function' ? In.best(C) : In.best, F = HT.FRAME[id];
    if (!F.slot) return { f: id };
    const v = HT.slotVal(F.slot, C);
    return { f: id, v: v != null ? String(v) : (HT.SLOT[F.slot].dyn ? undefined : slotIds(F.slot)[0]) };
  };
  // 전화 한 줄의 모범 (카드의 방 번호 · 필요한 것)
  HT.modelLine = c => ({ f: 'line', line: { words: ['hi'].concat(c.room ? ['room'] : []).concat(['could', HT.slotVal('thing', c) || 'towels', 'please']), room: c.room } });

  /* =========================================================
     소리로 한 대답 맞춰 보기 — HT.matchSpoken(들린 글, 말, 카드)
     음성 인식이 글로 바꾼 말에 그 말의 표시 낱말과 카드의 사실이 들어 있으면 받아들여요.
     숫자는 낱말(twelve oh seven)이든 숫자(1207)든 같은 숫자로 맞춰요. 공손함 · 발음은 판정하지 않아요.
     ========================================================= */
  const CONTR = [[/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\bwhat's\b/g, 'what is'], [/\bdon't\b/g, 'do not'], [/\bdidn't\b/g, 'did not'], [/\bi've\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\bcan't\b/g, 'cannot'], [/\bi'd\b/g, 'i would'], [/\byou're\b/g, 'you are'], [/\bthat's\b/g, 'that is'], [/\bthere's\b/g, 'there is'], [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bdoesn't\b/g, 'does not'], [/\bwe'll\b/g, 'we will'], [/\bhere's\b/g, 'here is']];
  HT.norm = function (s) {
    let t = String(s || '').toLowerCase().replace(/[’‘]/g, '\'');
    CONTR.forEach(([r, w]) => { t = t.replace(r, w); });
    t = t.replace(/(\d):(\d)/g, '$1 $2').replace(/[^a-z0-9' -]+/g, ' ').replace(/-/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '');
    return t.split(/\s+/).filter(Boolean);
  };
  const W2N = {}; Object.entries(NUMW).forEach(([n, w]) => { W2N[w] = +n; });
  // 낱말 → 숫자 줄로 모음: twelve oh seven → 1207 · eight fifteen → 815 · six thirty → 630 · 1207 → 1207
  HT.canon = function (s) {
    const w = HT.norm(s), out = [];
    let run = null;
    const flush = () => { if (run != null) { out.push(run); run = null; } };
    for (let i = 0; i < w.length; i++) {
      const x = w[i];
      let d = null;
      if (/^\d+$/.test(x)) d = x;
      else if ((x === 'oh' || x === 'o') && run != null) d = '0';
      else if (x === 'zero') d = '0';
      else if (W2N[x] != null) {
        const n = W2N[x];
        if (n >= 20 && n % 10 === 0 && W2N[w[i + 1]] != null && W2N[w[i + 1]] > 0 && W2N[w[i + 1]] < 10) { d = String(n + W2N[w[i + 1]]); i++; }
        else d = String(n);
      }
      if (d != null) run = (run || '') + d;
      else { flush(); out.push(x); }
    }
    flush();
    return out;
  };
  const runs = toks => toks.filter(t => /^\d+$/.test(t));
  const toTime = r => r.length <= 2 ? `${+r}:00` : `${+r.slice(0, -2)}:${r.slice(-2)}`;
  const SPELL_RE = /^[a-z]$/;
  const lettersOf = toks => { let best = '', cur = ''; toks.forEach(t => { if (SPELL_RE.test(t)) cur += t; else { if (cur.length > best.length) best = cur; cur = ''; } }); return cur.length > best.length ? cur : best; };
  const SPK_THING = [['hairdryer', /\b(hair ?dryer|hair ?drier|blow ?dryer)\b/], ['dryer', /\b(dryer|drier)\b/], ['towels', /\btowels?\b/], ['pillow', /\bpillows?\b/], ['toothbrush', /\btooth ?brush(es)?\b/], ['adapter', /\b(adapter|adaptor|plug)\b/]];
  const SPK_PROB = [['nohot', /\bhot water\b/], ['ac', /\b(air conditioner|air conditioning|aircon|ac|a c)\b/], ['tv', /\b(tv|t v|television)\b/], ['wifi', /\b(wi fi|wifi|wi-fi|internet)\b/], ['outlet', /\b(outlet|socket)\b/], ['remote', /\bremote\b/], ['consent', /\bconsent\b/], ['remocon', /\b(remocon|remo con)\b/], ['locked', /\b(locked out|lock out|left my key)\b/], ['keycard', /\b(key ?card|key) (is not|does not|not) work/], ['noisy', /\b(noisy|noise|loud)\b/], ['cold', /\bcold\b/], ['notowel', /\btowels?\b/], ['notp', /\btoilet paper\b/]];
  const SPK_FIX = [['change', /\b(change rooms?|change my room|another room|different room|move rooms?)\b/], ['key', /\b(new key|new one|another key|new card|key card for me)\b/], ['bring:blanket', /\bblanket\b/], ['bring:batteries', /\bbatter(y|ies)\b/], ['bring:towels', /\bbring\b.*\btowels?\b/], ['bring:toiletpaper', /\bbring\b.*\btoilet paper\b/], ['send', /\b(send someone|send somebody|send a technician|look at it|check it|take a look|fix it|fix the)\b/]];
  const REPAIR_RE = /\b(say that again|pardon|repeat|more slowly|slow down|sorry what|sorry)\b/;
  // 컨시어지에 한 부탁의 종류 (모닝콜 · 짐 · 택시 · 늦은 체크아웃)
  const wantOf = s => /\b(wake|morning call)\b/.test(s) ? 'wake' : /\b(luggage|bags?|suitcases?|hold|keep|store)\b/.test(s) ? 'hold' : /\b(taxi|cab)\b/.test(s) ? 'taxi' : /\blate\b/.test(s) ? 'late' : null;
  HT.wantOf = raw => wantOf(' ' + HT.canon(raw).join(' ') + ' ');
  const others = (list, me) => list.filter(n => n.toLowerCase() !== String(me || '').toLowerCase());
  HT.matchSpoken = function (raw, q, card) {
    if (typeof q === 'string') q = HT.Q[q];
    const toks = HT.canon(raw), s = ' ' + toks.join(' ') + ' ', heard = HT.norm(raw).join(' ');
    if (!toks.length) return { ok: false, stage: 0, why: '들린 말이 없어요. 다시 말해 보세요.', heard: '' };
    const C = Object.assign({}, card || {}, q.fact || {});
    const R = (ok, stage, why, o = {}) => Object.assign({ ok, stage, why, heard }, o);
    const notes = [];
    const pass = (why, cov) => R(true, 0, why + (notes.length ? ' 알림: ' + notes.join(' ') : ''), { note: notes.join(' '), covered: cov || [q.intent] });
    const keyMiss = () => R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${HT.sayOf(q.intent)}. 들린 말에 그 대답이 없어요.`);
    if (REPAIR_RE.test(s) && toks.length <= 9 && !['help', 'issue', 'ask'].includes(q.intent) && !/\b(mistake|bill)\b/.test(s)) {
      if (q.allow && /\bspell\b/.test(s) && q.allow.includes('spell')) return R(false, 1, '철자를 물었어요. 직원이 한 글자씩 불러 줄 거예요.', { repair: 'spell' });
      if (q.allow && /\bincidentals?\b/.test(s) && q.allow.includes('what')) return R(false, 1, '모르는 낱말을 물었어요. 직원이 쉬운 말로 알려 줄 거예요.', { repair: 'what' });
      return R(false, 1, '다시 묻는 말로 들었어요. 직원이 한 번 더 말해 줄 거예요.', { repair: 'again' });
    }
    if (/\b(give me|i want)\b/.test(s)) notes.push('Give me · I want는 명령하거나 조르는 말처럼 들려요(말로 한 대답은 말투를 판정하지 않아요) → Could I get …, please?');
    if (/\b(fix it|change my room|this bill is wrong|wake me up|keep my bag)\b/.test(s)) notes.push('명령하거나 따지는 말처럼 들릴 수 있어요(말로 한 대답은 말투를 판정하지 않아요) → Could you …? · I think …');
    const nums = runs(toks);
    const roomCheck = (need) => {
      const rr = nums.filter(r => r.length >= 3);
      if (rr.includes(String(C.room))) return { ok: true, room: String(C.room) };
      if (rr.length) return { ok: false, res: R(false, 2, `카드와 달라요. 방 번호: ${HT.factKo('room', C.room)} · 들린 말: ${HT.factKo('room', rr[0])}.`, { tag: 'fact' }) };
      return need ? { ok: false, res: R(false, 1, '들린 말에 방 번호가 없어요. → It\'s ' + C.room + '.') } : { ok: true };
    };
    switch (q.intent) {
      case 'resv': case 'name': case 'spell': {
        const nm = String(C.name || ''), low = nm.toLowerCase(), names = Object.keys(HT.NAMES);
        const spelled = lettersOf(toks);
        const other = others(names, nm).find(n => s.includes(' ' + n.toLowerCase() + ' ') || (spelled.length >= 3 && spelled === n.toLowerCase()));
        if (other) return R(false, 2, `카드와 달라요. 카드의 성: ${nm} · 들린 말: ${other}.`, { tag: 'fact' });
        const got = s.includes(' ' + low + ' ') || spelled === low;
        if (q.intent === 'resv') {
          if (!/\b(yes|yeah|i have|i do|reservation|booking|booked|reserved)\b/.test(s)) return keyMiss();
          if (/\breserved\b/.test(s) && !/\breservation\b/.test(s)) notes.push('‘예약했어요’ → I reserved.만으로는 무엇을 예약했는지 빠져요 → I have a reservation under Kim.');
          return pass(got ? '예약이 있다고 말하고 성까지 들렸어요.' : '예약이 있다고 말했어요.', got ? ['resv', 'name'] : ['resv']);
        }
        if (q.intent === 'spell') {
          if (spelled === low) return pass('철자가 한 글자씩 들렸어요.');
          if (got) { notes.push('음성 인식이 한 글자씩 부른 철자를 낱말로 붙여 적었을 수도 있어요. 철자는 한 글자씩 또박또박 → ' + HT.NAMES[nm].sp + '.'); return pass('성이 들렸어요.'); }
          if (spelled.length >= 2) return R(false, 2, `카드의 철자와 달라요. 카드: ${HT.NAMES[nm].sp} · 들린 말: ${spelled.toUpperCase().split('').join('-')}.`, { tag: 'fact' });
          return keyMiss();
        }
        return pass(got ? '성이 들렸어요.' : `음성 인식이 성을 ‘${heard.replace(/^(it is|its|my name is|name is|under)\s+/, '')}’로 적었어요. 이름은 직원도 잘못 듣기 쉬워요. 철자를 불러 주면 좋아요 → ${(HT.NAMES[nm] || {}).sp || ''}.`);
      }
      case 'nights': {
        const n = nums.map(Number).find(x => x > 0 && x < 15);
        if (n == null) return keyMiss();
        if (/\bdays?\b/.test(s)) return R(false, 2, `${C.nights != null ? `카드: ${HT.nightsKo(C.nights)} → ` : ''}호텔은 밤(night)으로 세요 → ${nv(C.nights || 2, 'night')}. 날(day)로 말하면 직원은 ${n}박으로 알아들을 수 있어요.`, { tag: 'days' });
        if (C.nights != null && n !== C.nights) return R(false, 2, `카드와 달라요. 카드: ${HT.factKo('nights', C.nights)} · 들린 말: ${n}박.`, { tag: 'fact' });
        if (/\bduring\b/.test(s)) notes.push('‘동안’ → during은 어색해요. → For two nights. 또는 Two nights.');
        return pass('묵는 밤의 수가 들렸고 카드와 맞아요.');
      }
      case 'passport': case 'incid': case 'charge':
        if (!/\b(sure|here|okay|ok|of course|yes|yeah|fine|no problem|alright|all right)\b/.test(s)) return keyMiss();
        if (/\bwhy\b/.test(s)) notes.push('Why?로 시작하면 따지는 말처럼 들려요.');
        return pass('건네거나 괜찮다고 하는 말이 들렸어요.');
      case 'keyinfo': case 'bfinfo': case 'coinfo': case 'wifiinfo':
        if (/\b(thank|thanks|great|okay|ok|got it|perfect)\b/.test(s)) return pass('고맙다는 말이 들렸어요.');
        if (q.intent === 'keyinfo') { const r = roomCheck(true); if (!r.ok) return r.res; return pass('방 번호를 되물어 확인했어요.'); }
        return keyMiss();
      case 'kmore': {
        const said = /\b(wi fi|wifi|password|internet)\b/.test(s) ? 'wifi' : /\bbreakfast\b/.test(s) ? 'bfincl' : /\b(no|nothing|that is all|that is it|i am good|i am fine)\b/.test(s) ? 'none' : null;
        if (!said) return keyMiss();
        if (said === 'bfincl' && /\bservice\b/.test(s) && !/\binclud/.test(s)) return R(false, 2, '‘서비스(덤)’는 영어로 통하지 않아요. → Is breakfast included?', { tag: 'literal' });
        if (C.kq != null && said !== C.kq) return R(false, 2, `카드와 달라요. 카드: ${HT.factKo('kq', C.kq)} · 들린 말: ${HT.factKo('kq', said)}.`, { tag: 'fact' });
        return pass('카드에 맞는 대답이 들렸어요.');
      }
      case 'help': {
        const th = (SPK_THING.find(([, r]) => r.test(s)) || [])[0];
        if (!th) return R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → 내가 부탁할 차례예요. 들린 말에 필요한 것이 없어요.`);
        const want = th === 'dryer' ? 'hairdryer' : th;
        if (th === 'dryer') notes.push('dryer만 말하면 옷 말리는 건조기로 들을 수도 있어요 → a hair dryer.');
        if (C.thing && want !== C.thing) return R(false, 2, `카드와 달라요. 카드: ${HT.factKo('thing', C.thing)} · 들린 말: ${HT.factKo('thing', want)}.`, { tag: 'fact' });
        const r = roomCheck(false); if (!r.ok) return r.res;
        const cov = ['help'];
        if (r.room) cov.push('roomno');
        const n = nums.filter(x => x.length <= 2).map(Number).find(x => x > 0 && x < 10);
        if (n != null && want === 'towels') { if (C.n != null && n !== C.n) return R(false, 2, `카드와 달라요. 카드: 수건 ${C.n}장 · 들린 말: ${n}장.`, { tag: 'fact' }); cov.push('count'); }
        return pass('필요한 것이 들렸고 카드와 맞아요.' + (cov.length > 1 ? ` ${HT.coveredKo(cov).join(' · ')}까지 말했어요.` : ''), cov);
      }
      case 'roomno': { const r = roomCheck(true); if (!r.ok) return r.res; return pass('방 번호가 들렸고 카드와 맞아요.'); }
      case 'count': {
        const n = nums.map(Number).find(x => x > 0 && x < 10);
        if (n == null) return keyMiss();
        if (/\b(nights?|days?|room)\b/.test(s)) return R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${HT.sayOf(q.intent)}. 들린 말은 다른 질문의 대답(묵는 밤 · 방 번호)처럼 들려요. → Two, please.`);
        if (C.n != null && n !== C.n) return R(false, 2, `카드와 달라요. 카드: ${C.n}장 · 들린 말: ${n}장.`, { tag: 'fact' });
        return pass('필요한 수가 들렸고 카드와 맞아요.');
      }
      case 'issue': {
        let p = (SPK_PROB.find(([, r]) => r.test(s)) || [])[0];
        if (!p) return R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → 무엇이 문제인지 말할 차례예요. 들린 말에 문제(사실)가 없어요.`);
        if (p === 'consent') return R(false, 2, HT.SLOT.brk.vals.consent.why, { tag: 'literal' });
        if (p === 'remocon') return R(false, 2, HT.SLOT.brk.vals.remocon.why, { tag: 'literal' });
        if (p === 'notowel' && /\bbring\b/.test(s) && C.prob && C.prob !== 'notowel') p = (SPK_PROB.filter(([k]) => k !== 'notowel').find(([, r]) => r.test(s)) || [p])[0];
        if (C.prob && p !== C.prob) return R(false, 2, `카드와 달라요. 카드: ${HT.factKo('prob', C.prob)} · 들린 말: ${HT.factKo('prob', p)}.`, { tag: 'fact' });
        const fx = (SPK_FIX.find(([, r]) => r.test(s)) || [])[0];
        if (fx) { const req = HT.fixReq(fx), f = HT.fix(p, req); if (!f.ok) return R(false, 2, f.why, { tag: 'fix' }); }
        else notes.push('사실만 말해도 직원이 도와줄 방법을 말해 줄 거예요. 부탁까지 하면 한 번에 끝나요 → ' + fixText(HT.PROB[p].fits[0]));
        return pass('문제가 들렸고 카드와 맞아요.' + (fx ? ' 부탁도 문제에 맞아요.' : ''));
      }
      case 'drink': {
        const d = /\bcoffee\b/.test(s) ? 'coffee' : /\btea\b/.test(s) ? 'tea' : null;
        if (!d) return keyMiss();
        if (C.drink && d !== C.drink) return R(false, 2, `카드와 달라요. 카드: ${HT.factKo('drink', C.drink)} · 들린 말: ${HT.factKo('drink', d)}.`, { tag: 'fact' });
        return pass('고른 것이 들렸어요.');
      }
      case 'ask': case 'waketime': case 'holdtime': {
        const want = wantOf(s);
        const tr = nums.filter(r => r.length <= 4).map(toTime);
        if (q.intent === 'ask') {
          if (!want) return R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → 내가 부탁할 차례예요. 들린 말에 부탁이 없어요.`);
          if (C.want && want !== C.want) return R(false, 2, `카드와 달라요. 카드: ${HT.factKo('want', C.want)} · 들린 말: ${HT.factKo('want', want)}.`, { tag: 'fact' });
          if (/\bmorning call\b/.test(s)) notes.push('morning call도 통하는 곳이 많아요. 영어로는 보통 → a wake-up call.');
        } else if (!tr.length) return keyMiss();
        else if (/\b(room|nights?|days?)\b/.test(s)) return R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${HT.sayOf(q.intent)}. 들린 말은 다른 질문의 대답(방 번호 · 묵는 밤)처럼 들려요. → ${q.intent === 'waketime' ? 'At' : 'Until'} + 시각, please.`);
        const k = q.intent === 'waketime' || want === 'wake' ? 'wake' : 'hold';
        const cov = q.intent === 'ask' ? ['ask'] : [q.intent];
        if (tr.length && C[k]) {
          if (!tr.includes(C[k])) return R(false, 2, `카드와 달라요. 카드: ${HT.factKo(k, C[k])} · 들린 말: ${HT.factKo(k, tr[0])}.`, { tag: 'fact' });
          cov.push(k === 'wake' ? 'waketime' : 'holdtime');
        }
        return pass(q.intent === 'ask' ? '부탁이 들렸고 카드와 맞아요.' + (cov.length > 1 ? ' 시각까지 말했어요.' : '') : '시각이 들렸고 카드와 맞아요.', cov);
      }
      case 'co': {
        const r = roomCheck(false); if (!r.ok) return r.res;
        if (!/\b(yes|yeah|checking out|check out|please|i am)\b/.test(s) && !r.room) return keyMiss();
        return pass('체크아웃한다는 말이 들렸어요.' + (r.room ? ' 방 번호까지 말했어요.' : ''), r.room ? ['co', 'roomno'] : ['co']);
      }
      case 'minibar': {
        const it = /\bwater\b/.test(s) ? 'water' : /\bjuice\b/.test(s) ? 'juice' : /\b(chips|snack|crisps)\b/.test(s) ? 'chips' : null;
        const none = !it && /\b(no|nothing|did not|none|nope)\b/.test(s);
        if (!it && !none) return keyMiss();
        const said = it || 'none';
        if (C.minibar && said !== C.minibar) return R(false, 2, `카드와 달라요. 카드: ${HT.factKo('minibar', C.minibar)} · 들린 말: ${HT.factKo('minibar', said)}.`, { tag: 'fact' });
        if (/\bdo not\b/.test(s)) notes.push('Did you …?로 물었으니 → No, I didn\'t. 또는 No, nothing.');
        return pass('카드에 맞는 대답이 들렸어요.');
      }
      case 'stay':
        if (!/\b(great|good|nice|wonderful|lovely|fine|excellent|amazing|comfortable|thank)\b/.test(s)) return keyMiss();
        return pass('어땠는지 말하는 대답이 들렸어요.');
      case 'bill': {
        const said = /\b(minibar|mini bar|did not use)\b/.test(s) ? 'minibar' : /\b(nights?|only stayed|stayed)\b/.test(s) ? 'nights' : /\b(mistake|wrong|error|not right|incorrect)\b/.test(s) ? 'mistake' : /\b(right|fine|correct|looks good|okay|ok|thank|perfect)\b/.test(s) ? 'none' : null;
        if (!said) return keyMiss();
        if (C.billErr != null && !sameFact('billErr', C.billErr, said)) return R(false, 2, `카드 · 청구서와 달라요. 청구서: ${HT.factKo('billErr', C.billErr)} · 들린 말: ${HT.factKo('billErr', said)}.`, { tag: 'fact' });
        if (said === 'nights') { const n = nums.map(Number).find(x => x > 0 && x < 15); if (n != null && C.nights != null && n !== C.nights) return R(false, 2, `카드와 달라요. 카드: ${HT.factKo('nights', C.nights)} · 들린 말: ${n}박.`, { tag: 'fact' }); }
        if (/\b(this bill is wrong|wrong)\b/.test(s) && !/\bi think\b/.test(s)) notes.push('wrong만 말하면 따지는 말처럼 들릴 수 있어요 → I think there\'s a mistake on my bill.');
        return pass('청구서에 맞는 대답이 들렸어요.');
      }
      default: return R(false, 0, '이 말은 말로 대답하기를 지원하지 않아요.');
    }
  };

  /* ---------- 따라 말하기: 낱말 맞춰 보기 (가장 긴 공통 부분열, 숫자는 같은 숫자로) ---------- */
  HT.compareWords = function (target, heard) {
    const tw = String(target).split(/\s+/).filter(Boolean), tt = [];
    tw.forEach((x, i) => HT.canon(x).forEach(p => tt.push({ p, i })));
    const A = tt.map(x => x.p), B = HT.canon(heard), D = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) D[i][j] = A[i] === B[j] ? D[i + 1][j + 1] + 1 : Math.max(D[i + 1][j], D[i][j + 1]);
    const got = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { got.add(i); i++; j++; } else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++; }
    const okW = tw.map((_, k) => { const parts = tt.map((x, n) => [x, n]).filter(([x]) => x.i === k); return parts.length ? parts.every(([, n]) => got.has(n)) : true; });
    return { words: tw.map((t, k) => ({ t, ok: okW[k] })), hit: okW.filter(Boolean).length, total: tw.length };
  };

  /* =========================================================
     청구서 — HT.bill(카드): 지어낸 방값 × 묵은 밤 + 조식 + 미니바 + 세금 (단위: 센트)
     billErr: 'minibar'(쓰지 않은 미니바) · 'nights'(하루 더 청구) · 'none'
     ========================================================= */
  HT.RATE = 15000;   // 하룻밤 방값 $150.00 (지어낸 값)
  HT.BF_PRICE = 1800;
  HT.TAX = 0.1;
  HT.MINIBAR = { water: { en: 'Water', ko: '물', p: 400 }, juice: { en: 'Orange juice', ko: '오렌지 주스', p: 550 }, chips: { en: 'Chips', ko: '감자칩', p: 600 } };
  HT.bill = function (c) {
    const items = [], billed = c.nights + (c.billErr === 'nights' ? 1 : 0);
    items.push({ id: 'room', en: `Room · ${billed} night${billed === 1 ? '' : 's'} × ${HT.money(HT.RATE)}`, ko: `방값 ${billed}박`, c: HT.RATE * billed, wrong: c.billErr === 'nights' });
    if (c.bf === 'pay') items.push({ id: 'bf', en: 'Breakfast', ko: '조식', c: HT.BF_PRICE });
    if (c.minibar && c.minibar !== 'none') items.push({ id: 'mini', en: `Minibar · ${HT.MINIBAR[c.minibar].en}`, ko: `미니바 ${HT.MINIBAR[c.minibar].ko}`, c: HT.MINIBAR[c.minibar].p });
    else if (c.billErr === 'minibar') items.push({ id: 'mini', en: 'Minibar · Water', ko: '미니바 물', c: HT.MINIBAR.water.p, wrong: true });
    const sub = items.reduce((s, x) => s + x.c, 0), tax = Math.round(sub * HT.TAX);
    items.push({ id: 'tax', en: `Tax ${Math.round(HT.TAX * 100)}%`, ko: '세금', c: tax });
    return { items, sub, tax, total: sub + tax, billed };
  };

  /* =========================================================
     카드 키 봉투 — 방 번호 · 층 · 조식 · 체크아웃 · 와이파이 (영상 · 퀴즈 · 시뮬레이터)
     ========================================================= */
  HT.BF = { from: '7:00', to: '10:00', place: 'Garden Room', floor: 2 };
  HT.CO_TIME = '11:00';
  HT.sleeve = room => [
    { id: 'room', label: 'ROOM', val: String(room), ko: '방 번호' },
    { id: 'floor', label: 'FLOOR', val: String(HT.floorOf(room)), ko: '층' },
    { id: 'bf', label: 'BREAKFAST', val: `${HT.BF.from}–${HT.BF.to} · ${HT.BF.place}, ${HT.BF.floor}F`, ko: '조식' },
    { id: 'co', label: 'CHECK-OUT', val: HT.CO_TIME, ko: '체크아웃' },
    { id: 'wifi', label: 'WI-FI', val: HT.WIFI, ko: '와이파이' },
  ];

  /* =========================================================
     숙박 카드 (호텔 숙박 시뮬레이터). 방 번호는 카드에 없어요 — 체크인 때 직원이 말하고 카드 키 봉투에 적혀요
     ========================================================= */
  HT.ROOMS = { 1207: ['1270', '1027'], 815: ['850', '518'], 1418: ['1480', '1408'], 713: ['730', '703'], 604: ['640', '614'], 1032: ['1023', '1302'] };
  HT.WAKES = { '6:30': ['6:13', '7:30'], '6:15': ['6:50', '5:15'], '7:40': ['7:14', '6:40'], '5:45': ['5:40', '6:45'] };
  HT.HOLDS = ['2:00', '3:00', '4:00', '5:00'];
  HT.SIM_PROBS = ['ac', 'tv', 'wifi', 'outlet', 'remote', 'keycard', 'locked', 'nohot', 'notp', 'notowel', 'noisy', 'cold'];
  HT.SIM_THINGS = ['towels2', 'towels3', 'pillow', 'toothbrush', 'adapter', 'hairdryer'];
  HT.newCard = function (rnd = Math.random) {
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const name = pick(Object.keys(HT.NAMES)), thingId = pick(HT.SIM_THINGS), tf = valFact('thing', thingId);
    let prob = pick(HT.SIM_PROBS); if (tf.thing === 'towels' && prob === 'notowel') prob = 'notp';
    const minibar = rnd() < 0.55 ? 'none' : pick(Object.keys(HT.MINIBAR));
    const billErr = rnd() < 0.3 ? 'none' : minibar === 'none' && rnd() < 0.6 ? 'minibar' : 'nights';
    return {
      name, first: pick(Object.keys(HT.FIRST)), nights: 1 + Math.floor(rnd() * 3), room: pick(Object.keys(HT.ROOMS)),
      bf: rnd() < 0.6 ? 'incl' : 'pay', kq: pick(['none', 'wifi', 'bfincl']), thing: tf.thing, n: tf.n, prob,
      wake: pick(Object.keys(HT.WAKES)), hold: pick(HT.HOLDS), minibar, billErr, resv: true, co: true, charge: true,
    };
  };
  // 직원이 묻는 차례: 체크인 → 방 열쇠 → 전화 부탁 → 문제 → 조식 → 컨시어지 → 체크아웃 (이미 답한 질문은 건너뜀)
  HT.simQs = function (c) {
    const qs = ['ci_resv', 'ci_name', 'ci_spell', 'ci_nights', 'ci_pass', 'ci_card', 'k_any', 'cl_hk', 'cl_room'];
    if (c.thing === 'towels') qs.push('cl_count');
    qs.push('pr_help', 'pr_room', 'bf_room');
    if (c.bf === 'pay') qs.push('bf_charge');
    // 컨시어지: 카드의 두 부탁(모닝콜 · 짐) 중 손님이 먼저 말한 쪽부터(cgFirst, 시뮬레이터가 정함)
    qs.push(...(c.cgFirst === 'hold' ? ['cg_help', 'cg_htime', 'cg_more', 'cg_wtime'] : ['cg_help', 'cg_wtime', 'cg_more', 'cg_htime']), 'co_out', 'co_room', 'co_mini', 'co_bill');
    return qs;
  };
  // 카드에 따라 바뀌는 말 (방 번호 · 합계 · 부탁할 차례)
  HT.simQ = function (id, c) {
    const q = HT.Q[id];
    if (id === 'k_any') return Object.assign({}, q, { en: `Here's your key card. You're in room ${c.room}, on ${HT.floorWords(HT.floorOf(c.room))}. Is there anything else I can help you with?`, ko: `카드 키 여기 있어요. ${c.room}호, ${HT.floorOf(c.room)}층이에요. 더 도와드릴 것이 있을까요?` });
    if (id === 'co_bill') { const t = HT.bill(c).total; return Object.assign({}, q, { en: `Here's your bill. Your total is ${HT.money(t)}.`, ko: `청구서 여기 있어요. 합계는 ${HT.priceKo(t)}예요.`, key: ['bill', HT.money(t)], total: t }); }
    if (id === 'cg_help') return Object.assign({}, q, { fact: { want: c.cgFirst === 'hold' ? 'hold' : 'wake' } });
    if (id === 'cg_more') return Object.assign({}, q, { fact: { want: c.cgFirst === 'hold' ? 'wake' : 'hold' } });
    return q;
  };
  HT.PLACE_OF = id => HT.Q[id].place;
  // 질문마다 틀 칩: 맞는 틀 · 한국어 그대로(콩글리시 · 무례한 말 · 틀린 문장) 틀 · 다른 질문의 틀 (+ 사실이 다른 틀)
  HT.SIM_FRAMES = {
    resv: ['rs_under', 'rs_lit', 'nt_n'],
    name: ['nm_its', 'nm_lit', 'g_permit'],
    spell: ['sp_spell', 'nm_its', 'g_yes'],
    nights: ['nt_n', 'nt_during', 'rn_its'],
    passport: ['pp_here', 'g_permit', 'nm_its'],
    incid: ['pp_here', 'ic_why', 'nt_n'],
    kmore: c => [HT.INTENT.kmore.best(c), 'km_service', c.kq === 'none' ? 'km_plain' : 'km_no'],
    help: ['cl_could', 'cl_give', 'dk_pl'],
    roomno: ['rn_its', 'rn_lit', 'nt_n'],
    count: ['ct_n', 'ct_bare', 'nt_n'],
    charge: ['ch_ok', 'g_permit', 'nt_n'],
    // 다른 틀은 카드에 없는 부탁(택시) — 카드의 다른 부탁(모닝콜 · 짐)은 먼저 말해도 되니 함정으로 쓰지 않아요
    ask: c => c.want === 'wake' ? ['cg_wake', 'cg_wakecmd', 'cg_taxi'] : ['cg_hold', 'cg_keep', 'cg_taxi'],
    waketime: ['tm_at', 'tm_until', 'rn_its'],
    holdtime: ['tm_until', 'tm_at', 'rn_its'],
    co: ['co_yes', 'co_lit', 'mb_no'],
    minibar: c => c.minibar === 'none' ? ['mb_no', 'mb_dont', 'st_great'] : ['mb_yes', 'mb_dont', 'mb_no'],
    bill: c => c.billErr === 'none' ? ['bl_ok', 'bl_wrong', 'g_pay'] : [c.billErr === 'minibar' ? 'bl_mini' : 'bl_nights', 'bl_wrong', 'bl_ok'],
  };
  HT.simFrames = (intent, c) => { const x = HT.SIM_FRAMES[intent]; return typeof x === 'function' ? x(c) : x ? x.slice() : null; };
  // 문제 알리기 칩: 사실 틀 셋(맞는 틀 · 함정 · 다른 문제) + 부탁 넷(맞는 부탁 · 안 맞는 부탁 · 명령 · 부탁 없이)
  HT.issueChips = function (c, rnd = Math.random) {
    const P = HT.PROB[c.prob], right = P.fact;
    const trap = c.prob === 'tv' ? 'pf_noise' : c.prob === 'noisy' ? 'pf_tvlit' : (rnd() < 0.5 ? 'pf_tvlit' : 'pf_noise');
    const pool = ['pf_isnt', 'pf_no', 'pf_too', 'pf_key', 'pf_lock', 'pf_towel'].filter(f => f !== right);
    const other = pool[Math.floor(rnd() * pool.length) % pool.length];
    // 안 맞는 부탁: 맞는 부탁이 ‘가져다주기’면 다른 종류에서 골라요(같은 틀 칩이 둘 보이지 않게)
    const fit = P.fits[0], bad = ['send', 'change', 'key', 'bring:towels', 'bring:blanket'].filter(k => !P.fits.includes(k) && !(fit.startsWith('bring:') && k.startsWith('bring:')));
    const mis = bad[Math.floor(rnd() * bad.length) % bad.length], blunt = fit === 'change' ? 'rq_chg' : 'rq_fix';
    return { facts: [right, trap, other], reqs: [HT.fixReq(fit), HT.fixReq(mis), { f: blunt }, null] };
  };
  // 칸 칩: 카드의 값 + 다른 값 둘 (방 번호 · 시각은 헷갈리기 쉬운 이웃 값, 묵는 밤은 날로 센 값을 함께)
  HT.slotChoices = function (slot, card, rnd = Math.random) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let out;
    if (slot === 'room') out = [card.room].concat(HT.ROOMS[card.room] || []);
    else if (slot === 'wtime') out = [card.wake].concat(HT.WAKES[card.wake] || []);
    else if (slot === 'htime') out = [card.hold].concat(shuffle(HT.HOLDS.filter(h => h !== card.hold)).slice(0, 2));
    else if (slot === 'nights') out = ['n' + card.nights, 'd' + (card.nights + 1), 'n' + (card.nights === 1 ? 2 : card.nights - 1)];
    else if (slot === 'spell') out = [card.name].concat(shuffle(Object.keys(HT.NAMES).filter(n => n !== card.name)).slice(0, 2));
    else if (slot === 'name') out = [card.name].concat(shuffle(Object.keys(HT.NAMES).filter(n => n !== card.name)).slice(0, 2));
    else if (slot === 'count') out = ['c' + (card.n || 2), 'c' + ((card.n || 2) === 2 ? 3 : 2), 'c1'];
    else if (slot === 'mini') out = [card.minibar].concat(shuffle(Object.keys(HT.MINIBAR).filter(m => m !== card.minibar)).slice(0, 2));
    else if (slot === 'brk') { const right = HT.PROB[card.prob] && HT.PROB[card.prob].fact === 'pf_isnt' ? card.prob : null; const kong = right === 'outlet' ? 'consent' : right === 'remote' ? 'remocon' : null; out = (right ? [right] : []).concat(kong ? [kong] : []); shuffle(['ac', 'tv', 'wifi', 'outlet', 'remote'].filter(k => !out.includes(k))).forEach(k => { if (out.length < 3) out.push(k); }); }
    else {
      const right = HT.slotVal(slot, card), keys = shuffle(slotIds(slot).filter(k => k !== right));
      out = (right ? [right] : []).concat(keys.slice(0, right ? 2 : 3));
    }
    return shuffle(out.filter((x, i, a) => x != null && a.indexOf(x) === i));
  };
  HT.cardRows = c => [
    ['이름', `${HT.NAMES[c.name].ko}${HT.FIRST[c.first] || ''} (${c.first} ${c.name})`],
    ['숙박', `${HT.nightsKo(c.nights)} · 조식 ${c.bf === 'incl' ? '포함' : '불포함 (먹고 방으로 달기)'}`],
    ['더 물어볼 것', HT.factKo('kq', c.kq)],
    ['전화 부탁', HT.factKo('thing', HT.slotVal('thing', c) || c.thing)],
    ['문제', HT.PROB[c.prob].ko],
    ['컨시어지', `모닝콜 ${HT.timeKo(c.wake)} · 짐 ${HT.timeKo(c.hold, true)}까지`],
    ['미니바', c.minibar === 'none' ? '안 씀' : (HT.SLOT.mini.vals[c.minibar] || {}).ko],
  ];
  // 직원의 반응 (단계별)
  HT.REACT = {
    ok: ['Sure.', 'Of course.', 'Certainly.', 'Great.', 'Perfect.'],
    1: q => ({ en: `Sorry — ${q.en}`, ko: `‘${q.key.join(' … ')}’를 말했어요.` }),
    2: (q, j) => j.tag === 'fact' ? { en: 'Hmm, are you sure?', ko: '숙박 카드(또는 카드 키 봉투)를 다시 보세요.' } : j.tag === 'days' ? { en: 'Sorry — how many nights?', ko: '호텔은 밤(night)으로 세요.' } : j.tag === 'order' ? { en: 'Sorry, could you say that again?', ko: '순서가 어색해 알아듣기 어려워요.' } : j.tag === 'fix' ? { en: 'Sorry, what would you like us to do?', ko: '문제와 부탁이 맞지 않아요.' } : { en: 'Sorry?', ko: '알아듣기 어려운 말이에요.' },
    3: () => ({ en: '... Okay.', ko: '뜻은 통했지만 말투가 거칠어요.' }),
  };
  // 문제를 알린 뒤 직원의 말 (부탁에 따라)
  HT.fixReply = k => !k ? 'I\'m so sorry about that. Let me send someone up to take a look.' : k === 'change' ? 'I\'m so sorry. Let me check what\'s available, and I\'ll call you right back.' : k === 'key' ? 'No problem. Please come down to the front desk, and we\'ll make you a new one.' : k.startsWith('bring:') ? 'I\'m sorry about that. Housekeeping will bring that up right away.' : 'I\'m so sorry. I\'ll send someone up right away.';

  /* =========================================================
     듣고 대답 고르기 16문제 (모두 새로 만든 대화). card = 그 상황의 사실
     ========================================================= */
  const o = (f, v, req) => { const a = { f }; if (v != null) a.v = String(v); if (req) a.req = req; return a; };
  const L = (words, room) => ({ f: 'line', line: { words, room } });
  HT.o = o; HT.L = L;
  HT.DRILL = [
    { q: 'ci_resv', sit: '김(Kim)이라는 성으로 방을 예약해 두었어요.', card: { name: 'Kim', resv: true }, a: 2, opts: [o('rs_lit'), o('rs_under', 'Lee'), o('rs_under', 'Kim'), o('nt_n', 'n2')] },
    { q: 'ci_spell', sit: '성을 말했더니 철자를 물었어요. 내 성은 박(Park)이에요.', card: { name: 'Park' }, a: 1, opts: [o('nm_its', 'Park'), o('sp_spell', 'Park'), o('sp_spell', 'Lee'), o('g_permit')] },
    { q: 'ci_nights', sit: '2박 3일 동안 묵을 거예요.', card: { nights: 2 }, a: 3, opts: [o('nt_n', 'd3'), o('nt_during', 'n2'), o('nm_its', 'Kim'), o('nt_n', 'n2')] },
    { q: 'k_room', sit: '직원이 방 번호를 말했어요. 제대로 들었는지 확인하고 싶어요.', card: {}, a: 0, opts: [o('cf_room', '1207'), o('cf_room', '1270'), o('rn_lit', '1207'), o('cg_late')] },
    { q: 'k_fast', sit: '직원이 아주 빠르게 말했어요. 가운데 ‘… breakfast …’만 들렸어요.', card: {}, a: 1, opts: [o('rp_room'), o('rp_bf'), o('km_no'), o('rp_rude')] },
    { q: 'cl_help', sit: '1207호예요. 전화로 수건 두 장을 더 받고 싶어요.', card: { room: '1207', thing: 'towels', n: 2 }, a: 2, opts: [o('cl_give', 'towels2'), L(['hi', 'room', 'could', 'towels2', 'please'], '1270'), L(['hi', 'room', 'could', 'towels2', 'please'], '1207'), o('nt_n', 'n2')] },
    { q: 'cl_hk', sit: '머리를 말리고 싶은데 방에 헤어드라이어가 없어요.', card: { thing: 'hairdryer' }, a: 0, opts: [o('cl_bring', 'hairdryer'), o('cl_bring', 'toothbrush'), o('cl_want', 'hairdryer'), o('dk_pl', 'coffee')] },
    { q: 'pr_help', sit: '방의 에어컨이 고장 났어요.', card: { prob: 'ac' }, a: 3, opts: [o('pf_isnt', 'ac', o('rq_bring', 'towels')), o('pf_isnt', 'ac', o('rq_fix')), o('rp_again'), o('pf_isnt', 'ac', o('rq_send'))] },
    { q: 'pr_sorry', sit: '카드 키를 방 안에 두고 문을 닫아 버렸어요.', card: { prob: 'locked' }, a: 2, opts: [o('pf_lock', null, o('rq_send')), o('rq_chg'), o('pf_lock', null, o('rq_key')), o('pf_key', null, o('rq_change'))] },
    { q: 'pr_help', sit: '옆방이 밤새 시끄러워서 방을 바꾸고 싶어요.', card: { prob: 'noisy' }, a: 1, opts: [o('pf_noise', null, o('rq_change')), o('pf_too', 'noisy', o('rq_change')), o('pf_too', 'noisy', o('rq_chg')), o('pf_too', 'cold', o('rq_change'))] },
    { q: 'bf_room', sit: '조식 식당 입구예요. 내 방은 815호예요.', card: { room: '815' }, a: 0, opts: [o('rn_its', '815'), o('rn_its', '850'), o('rn_lit', '815'), o('g_yes')] },
    { q: 'bf_fast', sit: '조식 식당 직원이 아주 빠르게 말해서 하나도 못 알아들었어요.', card: {}, a: 3, opts: [o('dk_pl', 'coffee'), o('rn_its', '1207'), o('rp_noeng'), o('rp_again')] },
    { q: 'cg_help', sit: '체크아웃한 뒤 오후 3시까지 짐을 맡기고 싶어요.', card: { want: 'hold', hold: '3:00' }, a: 2, opts: [o('cg_hold', '2:00'), o('cg_keep'), o('cg_hold', '3:00'), o('cg_taxi')] },
    { q: 'cg_help', sit: '내일 아침 6시 30분에 깨워 주는 전화를 받고 싶어요.', card: { want: 'wake', wake: '6:30' }, a: 1, opts: [o('cg_wake', '6:13'), o('cg_wake', '6:30'), o('cg_wakecmd', '6:30'), o('cg_late')] },
    { q: 'co_mini', sit: '미니바는 열어 보지도 않았어요.', card: { minibar: 'none' }, a: 3, opts: [o('mb_dont'), o('mb_yes', 'water'), o('st_great'), o('mb_no')] },
    { q: 'co_bill', sit: '청구서에 미니바 물값이 있어요. 미니바는 쓰지 않았어요.', card: { billErr: 'minibar' }, a: 0, opts: [o('bl_mini'), o('bl_wrong'), o('bl_ok'), o('g_pay')] },
  ];
  HT.DRILL.forEach((it, i) => { it.n = i; it.Q = HT.Q[it.q]; it.place = it.Q.place; });
  // 직접 해 보기의 짧은 문제 (00장 · 03장) — 연습 문제와 다른 상황
  HT.MINI = {
    intro: { q: 'cl_help', sit: '1418호예요. 베개가 하나 더 있으면 좋겠어요.', card: { room: '1418', thing: 'pillow' }, a: 1, opts: [o('cl_give', 'pillow'), L(['hi', 'room', 'could', 'pillow', 'please'], '1418'), L(['hi', 'room', 'could', 'pillow', 'please'], '1480'), o('rn_its', '1418')] },
    repair: { q: 'k_fast', sit: '직원이 카드 키를 주며 아주 빠르게 말했어요. ‘… breakfast …’만 들렸어요.', card: {}, a: 2, opts: [o('ty'), o('rp_co'), o('rp_bf'), o('km_service')] },
  };
  Object.values(HT.MINI).forEach(it => { it.Q = HT.Q[it.q]; it.place = it.Q.place; });

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 대화 (연습 문제와 겹치지 않게 골랐어요)
     ========================================================= */
  // 02–08장의 숙박: 김민지 · 2박 3일 · 1207호 · 조식 포함 · 수건 두 장 · 에어컨 고장 · 모닝콜 6:30 · 짐 3시까지 · 미니바 안 씀 · 청구서에 미니바 실수
  HT.DEMO = { name: 'Kim', first: 'Minji', nights: 2, room: '1207', bf: 'incl', kq: 'bfincl', thing: 'towels', n: 2, prob: 'ac', wake: '6:30', hold: '3:00', minibar: 'none', billErr: 'minibar', resv: true, co: true, charge: true };
  // 00장: 한국어 그대로 → 자연스러운 전화 한 줄
  HT.INTRO = { q: 'cl_help', lit: o('cl_give', 'towels'), ok: L(['hi', 'room', 'could', 'towels', 'please'], '1207'), card: { room: '1207', thing: 'towels' } };
  HT.SCENE = {
    // 02장 체크인
    checkin: [['ci_resv', o('rs_under', 'Kim')], ['ci_spell', o('sp_spell', 'Kim')], ['ci_nights', o('nt_n', 'n2')]],
    nights: [o('nt_n', 'd3'), o('nt_during', 'n2'), o('nt_for', 'n2')],
    pass: ['ci_pass', o('g_permit'), o('pp_here')],
    incid: ['ci_card', o('ic_why'), o('rp_what'), o('pp_here')],
    // 03장 방 열쇠와 안내
    confirm: [o('cf_room', '1270'), o('cf_room', '1207')],
    fast: ['k_fast', o('rp_bf'), o('rp_room')],
    kmore: ['k_any', o('km_service'), o('km_incl')],
    // 04장 전화 부탁
    call: [['cl_help', o('cl_could', 'towels2')], ['cl_hk', o('cl_bring', 'hairdryer')]],
    things: ['towels2', 'pillow', 'toothbrush', 'adapter', 'hairdryer'],
    dryer: o('cl_could', 'dryer'),
    give: [o('cl_give', 'towels'), o('cl_could', 'towels')],
    // 05장 문제
    fact: [o('pf_isnt', 'ac'), o('pf_no', 'hotwater'), o('pf_too', 'noisy')],
    full: o('pf_isnt', 'ac', o('rq_send')),
    blunt: [o('pf_isnt', 'ac', o('rq_fix')), o('pf_too', 'noisy', o('rq_chg'))],
    lit: [o('pf_tvlit'), o('pf_noise'), o('pf_hotlit')],
    lock: o('pf_lock', null, o('rq_key')),
    mismatch: o('pf_isnt', 'ac', o('rq_bring', 'towels')),
    kong: [o('pf_isnt', 'consent'), o('pf_isnt', 'outlet', o('rq_send'))],
    // 06장 조식과 컨시어지
    bf: ['bf_room', o('rn_lit', '1207'), o('rn_its', '1270'), o('rn_its', '1207')],
    drink: ['bf_drink', o('dk_pl', 'coffee')],
    cg: [[o('cg_hold', '3:00'), { want: 'hold', hold: '3:00' }], [o('cg_taxi'), { want: 'taxi' }], [o('cg_wake', '6:30'), { want: 'wake', wake: '6:30' }], [o('cg_late'), { want: 'late' }]],
    cgBlunt: [o('cg_keep'), { want: 'hold' }],
    morning: [o('cg_morning', '6:30'), { want: 'wake', wake: '6:30' }],
    // 07장 체크아웃
    co: ['co_out', o('co_yes', '1207')],
    mini: ['co_mini', o('mb_dont'), o('mb_no')],
    stay: ['co_stay', o('g_yesit'), o('st_great')],
    bill: [o('bl_wrong'), o('bl_mini')],
  };
  // 08장: 전화 한 줄
  HT.LINE = { words: ['hi', 'room', 'could', 'towels2', 'please'], room: '1207' };
  HT.LINE_LATE = { words: ['could', 'towels2', 'please', 'room'], room: '1207' };
  HT.LINE_BAD = { words: ['thanks', 'could', 'towels2', 'room'], room: '1207' };
  HT.SHORT = [['cl_help', o('cl_short', 'towels')], ['cl_room', o('rn_its', '1207')], ['cl_count', o('ct_n', 'c2')]];
  // 08장 직접 해 보기 칩
  HT.LINE_CHIPS = { hi: ['hi'], room: ['room'], ask: ['could', 'bring', 'give'], thing: ['towels', 'towels2', 'pillow', 'toothbrush', 'adapter', 'hairdryer'], please: ['please'], thanks: ['thanks'] };
  // 09장: 곳마다 한 줄 (3단계 적용)
  HT.METHOD = [
    ['ci_resv', o('rs_under', 'Kim'), { name: 'Kim', resv: true }],
    ['k_any', o('km_incl'), { kq: 'bfincl' }],
    ['cl_help', L(['hi', 'room', 'could', 'towels2', 'please'], '1207'), { room: '1207', thing: 'towels', n: 2 }],
    ['pr_help', o('pf_isnt', 'ac', o('rq_send')), { prob: 'ac' }],
    ['bf_room', o('rn_its', '1207'), { room: '1207' }],
    ['cg_help', o('cg_hold', '3:00'), { want: 'hold', hold: '3:00' }],
    ['co_bill', o('bl_mini'), { billErr: 'minibar' }],
  ];
  // 10장 실전: 숙박 카드 하나로 넷 (보기 셋, 단계마다 지워짐)
  HT.PCARD = { name: 'Lee', first: 'Jisoo', nights: 3, room: '815', bf: 'incl', kq: 'none', thing: 'hairdryer', prob: 'nohot', wake: '6:15', hold: '4:00', minibar: 'none', billErr: 'nights', resv: true, co: true, charge: true };
  HT.PRACTICE = [
    { q: 'ci_nights', opts: [o('nt_n', 'd4'), o('nt_n', 'n3'), o('nm_its', 'Lee')], a: 1,
      lines: ['how many nights → 며칠 밤 · (C) It\'s Lee → 이름이라 탈락', '(A) Four days → 3박 4일의 4일 · 호텔은 밤으로 세서 탈락', '밤의 수 → 정답 (B) Three nights.'] },
    { q: 'bf_room', opts: [o('rn_its', '850'), o('dk_pl', 'coffee'), o('rn_its', '815')], a: 2,
      lines: ['room number → 방 번호 · (B) Coffee, please → 마실 것이라 탈락', '(A) 850 → eight-fifty · 카드 키 봉투는 815(eight-fifteen)라 탈락', 'It\'s + 방 번호 → 정답 (C)'] },
    { q: 'pr_help', opts: [o('pf_no', 'hotwater', o('rq_chg')), o('pf_no', 'hotwater', o('rq_bring', 'towels')), o('pf_no', 'hotwater', o('rq_send'))], a: 2,
      lines: ['What can I do → 문제를 말할 차례 · 셋 모두 뜨거운 물 이야기', '(B) 수건을 가져다 달라는 부탁 → 문제와 맞지 않아 탈락', '(A) Change my room → 명령처럼 들려 탈락 · 정답 (C)'] },
    { q: 'co_bill', opts: [o('bl_wrong'), o('g_pay'), o('bl_nights', 'n3')], a: 2,
      lines: ['bill … total → 청구서 확인 · (B) Card, please → 계산 방법이라 탈락', '청구서 4박 → 카드는 3박. 남은 둘 모두 실수를 알려요', '(A) This bill is wrong → 따지는 말이라 탈락 · 정답 (C)'] },
  ];

  /* ---------- 빠른 말: 숫자가 이어져 들리는 모양 (03장 · 직접 해 보기). 대문자 = 세게 ---------- */
  HT.LINKED = [
    { q: 'k_room', en: 'Room 1207', say: 'Room twelve-oh-seven', words: ['Room', 'twelve', 'oh', 'seven'], sound: [['room', 0], ['TWEL', 1], ['vo', 0], ['SEV', 1], ['n', 0]], link: [[1, 2], [2, 3]], ko: '0은 oh로 읽어요 · twelve + oh → twel-vo' },
    { q: 'k_bf', en: 'from seven to ten', say: 'from seven to ten', words: ['from', 'seven', 'to', 'ten'], sound: [['frm', 0], ['SEV', 1], ['n', 0], ['tuh', 0], ['TEN', 1]], link: [[1, 2]], ko: 'from → frm, to → tuh: 약하게 · 숫자만 세게' },
  ];
  // 헷갈리는 숫자 짝 (03장): 앞이 세면 -ty, 뒤가 세면 -teen
  HT.PAIRS = [['15', 'fifTEEN', '50', 'FIFty'], ['13', 'thirTEEN', '30', 'THIRty'], ['14', 'fourTEEN', '40', 'FORty']];

  /* ---------- 직접 해 보기 자료 ---------- */
  HT.CALL_THINGS = ['towels2', 'pillow', 'toothbrush', 'adapter', 'hairdryer'];
  HT.CALL_FRAMES = ['cl_could', 'cl_bring', 'cl_short', 'cl_give', 'cl_want'];
  HT.PR_SIT = ['ac', 'nohot', 'noisy', 'locked', 'outlet', 'notp'];
  HT.PR_FACTS = ['pf_isnt', 'pf_no', 'pf_too', 'pf_lock', 'pf_tvlit', 'pf_noise'];
  HT.PR_REQS = ['rq_send', 'rq_change', 'rq_key', 'rq_bring', 'rq_fix', 'rq_chg'];
  HT.CG_SIT = [['hold', '3:00', '오후 3시까지 짐 맡기기'], ['wake', '6:30', '6시 30분 모닝콜'], ['taxi', null, '택시 부르기'], ['late', null, '늦은 체크아웃']];
  HT.CG_FRAMES = ['cg_hold', 'cg_wake', 'cg_morning', 'cg_taxi', 'cg_late', 'cg_keep', 'cg_wakecmd'];

  /* =========================================================
     따라 말하기 28문장 (곳마다 직원 · 나의 말)
     ========================================================= */
  const SH = (place, who, en, ko) => ({ place, who, en, ko, sp: who === 'me' ? 'me' : HT.PLACE[place].sp });
  HT.SHADOW = [
    SH('checkin', 'staff', 'Do you have a reservation?', '예약하셨어요?'),
    SH('checkin', 'me', 'Yes, I have a reservation under Kim.', '네, 김으로 예약했어요.'),
    SH('checkin', 'me', 'K-I-M.', '케이, 아이, 엠.'),
    SH('checkin', 'me', 'Two nights.', '2박이요.'),
    SH('key', 'staff', 'You\'re in room 1207, on the twelfth floor.', '1207호, 12층이에요.'),
    SH('key', 'staff', 'Breakfast is from seven to ten.', '조식은 7시부터 10시까지예요.'),
    SH('key', 'me', 'Sorry, what time is breakfast?', '죄송한데, 조식이 몇 시였죠?'),
    SH('key', 'me', 'Is breakfast included?', '조식이 포함돼 있나요?'),
    SH('call', 'staff', 'Front desk. How can I help you?', '프런트입니다. 무엇을 도와드릴까요?'),
    SH('call', 'me', 'Hi, this is room 1207. Could I get two extra towels, please?', '안녕하세요, 1207호예요. 수건 두 장 더 주시겠어요?'),
    SH('call', 'me', 'Could you bring up a hair dryer, please?', '헤어드라이어를 가져다주시겠어요?'),
    SH('call', 'me', 'Could I get a plug adapter, please?', '플러그 어댑터 하나 주시겠어요?'),
    SH('problem', 'me', 'The air conditioner isn\'t working. Could you send someone to look at it?', '에어컨이 안 돼요. 사람을 보내 봐 주시겠어요?'),
    SH('problem', 'me', 'The room is too noisy. Could I change rooms?', '방이 너무 시끄러워요. 방을 바꿀 수 있을까요?'),
    SH('problem', 'me', 'I\'m locked out. I left my key card in the room.', '문이 잠겼어요. 카드 키를 방 안에 두고 나왔어요.'),
    SH('problem', 'me', 'There\'s no hot water.', '뜨거운 물이 안 나와요.'),
    SH('breakfast', 'staff', 'Good morning! What\'s your room number?', '안녕하세요! 방 번호가 어떻게 되세요?'),
    SH('breakfast', 'me', 'It\'s 1207.', '1207호예요.'),
    SH('breakfast', 'staff', 'Coffee or tea?', '커피 드릴까요, 차 드릴까요?'),
    SH('breakfast', 'me', 'Coffee, please.', '커피로 주세요.'),
    SH('concierge', 'me', 'Could you hold my luggage until three?', '3시까지 짐을 맡아 주시겠어요?'),
    SH('concierge', 'me', 'Could you call a taxi for me, please?', '택시를 불러 주시겠어요?'),
    SH('concierge', 'me', 'Could I get a wake-up call at 6:30, please?', '6시 30분에 모닝콜 해 주시겠어요?'),
    SH('concierge', 'me', 'Is late check-out possible?', '늦게 체크아웃해도 될까요?'),
    SH('checkout', 'staff', 'Did you have anything from the minibar?', '미니바에서 드신 것 있으세요?'),
    SH('checkout', 'me', 'No, nothing.', '아니요, 아무것도요.'),
    SH('checkout', 'me', 'It was great, thank you.', '아주 좋았어요, 고마워요.'),
    SH('checkout', 'me', 'I think there\'s a mistake on my bill. I didn\'t use the minibar.', '청구서에 실수가 있는 것 같아요. 미니바를 쓰지 않았어요.'),
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: key 열쇠 낱말 · frame 대답 틀 · slot 내 정보 · pol 공손한 말 · trap 함정 · ok 정답
     ========================================================= */
  const LL = k => `(${L4[k]})`;
  HT.judgeItem = (it, k) => HT.judge(it.Q, it.opts[k], it.card, '상황');
  const cardSay = c => Object.keys(c || {}).filter(k => !['resv', 'co', 'charge'].includes(k)).map(k => HT.factKo(k, c[k])).join(' · ');
  const segMarks = (a, k, roleOf) => HT.segs(a).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).map(s => ({ t: s.t.trim().replace(/^[,.?!]+|[,.?!]+$/g, ''), role: roleOf(s), at: k })).filter(m => m.t);
  const tagKo = j => j.tag === 'fact' ? '상황과 다른 정보' : j.tag === 'days' ? '박을 날(day)로 셈' : j.tag === 'fix' ? '문제와 맞지 않는 부탁' : j.tag === 'order' ? '순서가 어색함' : j.tag === 'wrong' ? '틀린 문장' : '한국어 그대로 옮긴 말 · 콩글리시';
  HT.steps = function (it) {
    const q = it.Q, J = it.opts.map((_, k) => HT.judgeItem(it, k)), at = s => it.opts.map((_, k) => k).filter(k => J[k].stage === s);
    const best = it.opts[it.a];
    // ①
    let t1;
    if (q.fast) t1 = '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 말했는지 모르면 짐작해서 답하지 말고 다시 물어요. 들린 낱말이 있으면 그 부분만 되물어요.';
    else t1 = `열쇠 낱말 ${q.key.join(' … ')} → ${HT.sayOf(q.intent)}. ${HT.INTENT[q.intent].want}`;
    if (at(1).length) t1 += ' ' + at(1).map(k => LL(k)).join(' · ') + (q.fast ? ' → 짐작한 대답이거나 다른 말을 되물어 탈락.' : ' → 다른 말에 맞는 대답이라 탈락.');
    const m1 = q.fast ? [] : q.key.map(t => ({ t, role: 'key', at: 'q' }));
    at(1).forEach(k => m1.push({ t: HT.text(it.opts[k]).replace(/[.?!]$/, ''), role: 'trap', at: k }));
    // ②
    const sit = cardSay(it.card);
    const Fb = HT.FRAME[best.f], ft = Fb.t && !best.req ? Fb.t.replace(/[{}]/g, '').replace('___', '…') : HT.text(best);
    let t2 = (q.fast ? '상황 → 처음 듣고 다 알아듣지 못했어요. ' : sit ? `상황 → ${sit}. ` : '') + `맞는 틀 → ${ft}`;
    if (at(2).length) t2 += ' · ' + at(2).map(k => `${LL(k)} ${tagKo(J[k])}`).join(' · ') + ' → 탈락.';
    else t2 += ' · 틀과 정보가 모두 맞는 보기만 남았어요.';
    const m2 = [];
    it.opts.forEach((a, k) => {
      if (J[k].stage === 1) return;
      const F = HT.FRAME[a.f], sb = F.slot && HT.sv(F.slot, a.v) && (HT.sv(F.slot, a.v).bad || HT.sv(F.slot, a.v).days);
      const trapOf = s => J[k].stage !== 2 ? false : J[k].tag === 'fix' ? !!s.req : (J[k].tag === 'fact' || J[k].tag === 'days' || sb) ? s.r === 'slot' && !s.req : !s.req && s.r === 'frame';
      segMarks(a, k, s => s.r === 'pol' ? '' : trapOf(s) ? 'trap' : s.r).forEach(m => { if (m.role) m2.push(m); });
    });
    // ③
    let t3 = at(3).length ? at(3).map(k => `${LL(k)} ${HT.text(it.opts[k])} → ${J[k].tag === 'plain' ? '그냥 No.로 끊김' : '명령 · 조르기 · 따지는 말투'}`).join(' · ') + ' → 탈락. ' : '명령하거나 따지는 말투의 보기는 없어요. ';
    t3 += `정답 ${LL(it.a)} → ${J[it.a].why}`;
    const m3 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 3) segMarks(a, k, () => 'trap').forEach(m => m3.push(m)); else if (J[k].stage === 0) segMarks(a, k, s => s.r === 'pol' ? 'pol' : '').forEach(m => { if (m.role) m3.push(m); }); });
    m3.push({ t: HT.text(it.opts[it.a]), role: 'ok', at: it.a, whole: true });
    return [
      { head: '① 열쇠 낱말 잡기', text: t1, marks: m1 },
      { head: '② 틀에 내 정보 넣기', text: t2, marks: m2 },
      { head: '③ 공손하게 끝내기', text: t3, marks: m3 },
    ];
  };
  HT.notes = it => it.opts.map((_, k) => { const j = HT.judgeItem(it, k); return (j.ok ? '' : `× ${['', '①', '②', '③'][j.stage]} `) + j.why; });

  /* =========================================================
     데이터 점검 — 열쇠 낱말이 말에 없거나, 맞는 보기가 하나가 아니거나, 정답 위치가 몰리면 경고
     ========================================================= */
  HT.check = function () {
    const bad = [];
    const hasT = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase());
    Object.values(HT.Q).forEach(q => {
      if (!HT.PLACE[q.place]) bad.push(`말 ${q.id}: 곳 ${q.place}가 없어요`);
      if (q.intent && !HT.INTENT[q.intent]) bad.push(`말 ${q.id}: 뜻 ${q.intent}가 없어요`);
      q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`말 ${q.id}: 열쇠 낱말 ‘${k}’가 말에 없어요`); });
    });
    Object.values(HT.FRAME).forEach(F => {
      [].concat(F.intent).forEach(i => { if (i !== 'fix' && !HT.INTENT[i]) bad.push(`틀 ${F.id}: 뜻 ${i}가 없어요`); });
      if (F.slot && !HT.SLOT[F.slot]) bad.push(`틀 ${F.id}: 칸 ${F.slot}이 없어요`);
      if (F.slot && !/___/.test(F.t)) bad.push(`틀 ${F.id}: 칸이 있는데 ___가 없어요`);
      if (F.tag !== 'ok' && !F.why) bad.push(`틀 ${F.id}: 함정 틀에 까닭(why)이 없어요`);
      if (F.slot && HT.SLOT[F.slot] && !HT.SLOT[F.slot].dyn) Object.values(HT.SLOT[F.slot].vals).forEach(v => { if (F.form && v[F.form] == null) bad.push(`틀 ${F.id}: 칸 값에 ${F.form} 꼴이 없어요`); });
    });
    Object.values(HT.INTENT).forEach(In => { if (!In.generic && In.best && typeof In.best === 'string' && !HT.FRAME[In.best]) bad.push(`뜻의 모범 틀 ${In.best}가 없어요`); });
    Object.entries(HT.PROB).forEach(([k, P]) => {
      if (!HT.FRAME[P.fact]) bad.push(`문제 ${k}: 사실 틀이 없어요`);
      const a = { f: P.fact }; if (P.v) a.v = P.v;
      if (HT.factOf(a).prob !== k) bad.push(`문제 ${k}: 사실 틀이 다른 문제를 말해요`);
      P.fits.forEach(x => { const r = HT.fixReq(x); if (!HT.FRAME[r.f]) bad.push(`문제 ${k}: 부탁 ${x}의 틀이 없어요`); else if (!HT.fix(k, r).ok) bad.push(`문제 ${k}: 부탁 ${x}가 맞지 않아요`); });
    });
    // 숫자 읽기
    [['1207', 'twelve-oh-seven'], ['1270', 'twelve-seventy'], ['815', 'eight-fifteen'], ['850', 'eight-fifty'], ['1027', 'ten twenty-seven'], ['604', 'six-oh-four']].forEach(([r, w]) => { if (HT.roomWords(r) !== w) bad.push(`방 번호 읽기 ${r}: ${HT.roomWords(r)}`); });
    [['6:30', 'six-thirty'], ['2:15', 'two-fifteen'], ['2:50', 'two-fifty'], ['11:00', 'eleven'], ['6:05', 'six-oh-five'], ['5:45', 'five forty-five']].forEach(([t, w]) => { if (HT.timeWords(t) !== w) bad.push(`시각 읽기 ${t}: ${HT.timeWords(t)}`); });
    if (HT.floorOf('1207') !== 12 || HT.floorWords(12) !== 'the twelfth floor') bad.push('층 읽기가 이상해요');
    [['1207', '1207'], ['twelve oh seven', '1207'], ['twelve seventy', '1270'], ['eight fifteen', '815'], ['six thirty', '630'], ['12 07', '1207']].forEach(([s, r]) => { if (!HT.canon(s).includes(r)) bad.push(`숫자 맞추기 ${s}: ${HT.canon(s).join(' ')}`); });
    if (HT.spoken('It\'s 1207.') !== 'It\'s twelve-oh-seven.') bad.push(`읽을 글: ${HT.spoken('It\'s 1207.')}`);
    // 연습 문제
    const pos = [0, 0, 0, 0];
    HT.DRILL.forEach((it, i) => {
      const w = `듣고 대답 고르기 ${i + 1}`;
      if (!it.Q) { bad.push(`${w}: 말 ${it.q}가 없어요`); return; }
      const good = it.opts.map((_, k) => k).filter(k => HT.judgeItem(it, k).ok);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]}`);
      const texts = it.opts.map(HT.text);
      if (new Set(texts).size !== texts.length) bad.push(`${w}: 같은 보기가 있어요`);
      if (!it.sit) bad.push(`${w}: 상황 글이 없어요`);
      pos[it.a]++;
    });
    if (Math.max(...pos) - Math.min(...pos) > 0) bad.push(`듣고 대답 고르기 정답 위치가 몰려 있어요: ${pos.join(',')}`);
    const places = new Set(HT.DRILL.map(it => it.place));
    HT.PLACES.forEach(p => { if (!places.has(p.id)) bad.push(`듣고 대답 고르기: ${p.ko} 문제가 없어요`); });
    if (HT.DRILL.filter(it => it.Q.fast).length < 2) bad.push('듣고 대답 고르기: 빠른 말(다시 묻기) 문제가 둘보다 적어요');
    Object.entries(HT.MINI).forEach(([k, it]) => { const good = it.opts.map((_, i) => i).filter(i => HT.judgeItem(it, i).ok); if (good.length !== 1 || good[0] !== it.a) bad.push(`직접 해 보기 ${k}: 맞는 보기 ${good}`); });
    // 영상 · 직접 해 보기의 대화가 판정과 맞나
    const want = (w, q, a, c, ok) => { const j = HT.judge(q, a, c); if (j.ok !== ok) bad.push(`${w}: ${HT.text(a)} → 판정 ${j.ok ? '✓' : '×'} (${j.why})`); return j; };
    const D = HT.DEMO, SC = HT.SCENE;
    want('00장 한국어 그대로', HT.INTRO.q, HT.INTRO.lit, HT.INTRO.card, false); want('00장 전화 한 줄', HT.INTRO.q, HT.INTRO.ok, HT.INTRO.card, true);
    SC.checkin.forEach(([q, a], i) => want(`02장 ${i + 1}`, q, a, D, true));
    SC.nights.forEach((a, i) => want(`02장 밤 ${i + 1}`, 'ci_nights', a, D, i === 2));
    want('02장 여권 함정', SC.pass[0], SC.pass[1], D, false); want('02장 여권', SC.pass[0], SC.pass[2], D, true);
    SC.incid.slice(1).forEach((a, i) => want(`02장 카드 ${i + 1}`, SC.incid[0], a, D, i > 0));
    SC.confirm.forEach((a, i) => want(`03장 확인 ${i + 1}`, 'k_room', a, D, i === 1));
    want('03장 빠른 말 1', SC.fast[0], SC.fast[1], {}, true); want('03장 빠른 말 2', SC.fast[0], SC.fast[2], {}, false);
    want('03장 서비스', SC.kmore[0], SC.kmore[1], D, false); want('03장 포함', SC.kmore[0], SC.kmore[2], D, true);
    SC.call.forEach(([q, a], i) => want(`04장 ${i + 1}`, q, a, i ? { thing: 'hairdryer' } : D, true));
    SC.things.forEach(v => want(`04장 ${v}`, 'cl_help', { f: 'cl_could', v }, valFact('thing', v), true));
    want('04장 dryer', 'cl_help', SC.dryer, { thing: 'hairdryer' }, true);
    SC.give.forEach((a, i) => want(`04장 give ${i + 1}`, 'cl_help', a, D, i === 1));
    SC.fact.forEach((a, i) => want(`05장 사실 ${i + 1}`, 'pr_help', a, { prob: HT.factOf(a).prob }, true));
    want('05장 사실 + 부탁', 'pr_help', SC.full, D, true);
    SC.blunt.forEach((a, i) => want(`05장 명령 ${i + 1}`, 'pr_help', a, { prob: HT.factOf(a).prob }, false));
    SC.lit.forEach((a, i) => want(`05장 그대로 ${i + 1}`, 'pr_help', a, { prob: HT.factOf(a).prob }, i === 2));
    want('05장 잠김', 'pr_help', SC.lock, { prob: 'locked' }, true);
    want('05장 안 맞는 부탁', 'pr_help', SC.mismatch, D, false);
    want('05장 consent', 'pr_help', SC.kong[0], { prob: 'outlet' }, false); want('05장 outlet', 'pr_help', SC.kong[1], { prob: 'outlet' }, true);
    SC.bf.slice(1).forEach((a, i) => want(`06장 방 번호 ${i + 1}`, SC.bf[0], a, D, i === 2));
    want('06장 마실 것', SC.drink[0], SC.drink[1], { drink: 'coffee' }, true);
    SC.cg.forEach(([a, c], i) => want(`06장 컨시어지 ${i + 1}`, 'cg_help', a, c, true));
    want('06장 Keep my bag', 'cg_help', SC.cgBlunt[0], SC.cgBlunt[1], false); want('06장 morning call', 'cg_help', SC.morning[0], SC.morning[1], true);
    want('07장 체크아웃', SC.co[0], SC.co[1], D, true);
    want('07장 미니바 함정', SC.mini[0], SC.mini[1], D, false); want('07장 미니바', SC.mini[0], SC.mini[2], D, true);
    want('07장 소감 함정', SC.stay[0], SC.stay[1], D, false); want('07장 소감', SC.stay[0], SC.stay[2], D, true);
    const qb = HT.simQ('co_bill', D);
    want('07장 청구서 함정', qb, SC.bill[0], D, false); want('07장 청구서', qb, SC.bill[1], D, true);
    if (HT.Q.co_bill.en !== qb.en) bad.push(`07장 청구서: ${HT.Q.co_bill.en} ≠ ${qb.en}`);
    if (HT.bill(D).total !== 33440) bad.push(`07장 합계: ${HT.money(HT.bill(D).total)} (≠ $334.40)`);
    if (HT.priceWords(33440) !== 'three hundred thirty-four dollars and forty cents') bad.push(`값 읽기: ${HT.priceWords(33440)}`);
    if (HT.Q.k_room.en !== HT.simQ('k_any', D).en.split(' Is there')[0]) bad.push(`03장 방 안내: ${HT.Q.k_room.en} ≠ ${HT.simQ('k_any', D).en}`);
    // 전화 한 줄
    want('08장 한 줄', 'cl_help', { f: 'line', line: HT.LINE }, D, true);
    want('08장 방 번호 끝', 'cl_help', { f: 'line', line: HT.LINE_LATE }, D, true);
    want('08장 순서 어색', 'cl_help', { f: 'line', line: HT.LINE_BAD }, D, false);
    const cov = HT.covered({ f: 'line', line: HT.LINE }, 'cl_help').sort().join();
    if (cov !== ['help', 'roomno', 'count'].sort().join()) bad.push(`08장 한 줄이 답한 질문: ${cov}`);
    HT.SHORT.forEach(([q, a], i) => want(`08장 짧게 ${i + 1}`, q, a, D, true));
    if (HT.covered(HT.SHORT[0][1], 'cl_help').join() !== 'help') bad.push('08장 짧은 부탁이 다른 질문까지 답해요');
    HT.METHOD.forEach(([q, a, c], i) => want(`09장 ${i + 1}`, q, a, c, true));
    // 실전: 지워지는 단계가 줄 글과 맞나
    HT.PRACTICE.forEach((p, i) => {
      const w = `실전 ${i + 1}`, q = p.q === 'co_bill' ? HT.simQ('co_bill', HT.PCARD) : p.q;
      const J = p.opts.map(a => HT.judge(q, a, HT.PCARD));
      const good = J.map((j, k) => j.ok ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== p.a) bad.push(`${w}: 맞는 보기 ${good}`);
      [1, 2, 3].forEach(st => {
        const gone = J.map((j, k) => j.stage === st ? LL(k) : null).filter(Boolean).sort().join();
        const said = (p.lines[st - 1].match(/\([A-D]\)/g) || []).filter(x => st < 3 || x !== LL(p.a)).sort().join();
        if (gone !== said) bad.push(`${w} ${st}단계: 엔진 ${gone || '-'} · 화면 ${said || '-'}`);
      });
      if (!p.lines[2].includes(`정답 ${LL(p.a)}`)) bad.push(`${w}: 정답 표시가 달라요`);
    });
    // 시뮬레이터: 카드 여럿 — 모범 대답은 통과, 틀 칩 가운데 맞는 것이 하나뿐인지, 모범 대답을 말로 해도 통과하는지
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 40; n++) {
      const c = HT.newCard(rnd);
      HT.simQs(c).forEach(id => {
        const q = HT.simQ(id, c), C = Object.assign({}, c, q.fact || {}), m = HT.model(q, C), j = HT.judge(q, m, C);
        if (!j.ok) bad.push(`시뮬레이터 ${id}: 모범 대답이 탈락 (${HT.text(m)} · ${j.why})`);
        const ms = HT.matchSpoken(HT.spoken(HT.text(m)), q, C);
        if (!ms.ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 말로 해도 통과하지 못해요 (${HT.text(m)} · ${ms.why})`);
        if (q.intent === 'issue') {
          const ch = HT.issueChips(C, rnd), okF = ch.facts.filter(f => { const F = HT.FRAME[f]; const vs = F.slot ? HT.slotChoices(F.slot, C, rnd) : [undefined]; return vs.some(v => HT.judge(q, { f, v }, C).ok); });
          if (okF.length !== 1 || okF[0] !== HT.PROB[C.prob].fact) bad.push(`시뮬레이터 문제 ${C.prob}: 맞는 사실 틀 ${okF}`);
          const fa = { f: HT.PROB[C.prob].fact }; if (HT.PROB[C.prob].v) fa.v = HT.PROB[C.prob].v;
          const okR = ch.reqs.filter(r => HT.judge(q, Object.assign({}, fa, r ? { req: r } : {}), C).ok).length;
          if (okR !== 2) bad.push(`시뮬레이터 문제 ${C.prob}: 통과하는 부탁 칩 ${okR}개(맞는 부탁 + 부탁 없이 = 2)`);
          return;
        }
        const fr = HT.simFrames(q.intent, C);
        if (!fr) { bad.push(`시뮬레이터 ${id}: 틀 칩이 없어요`); return; }
        const okN = fr.filter(f => { const F = HT.FRAME[f]; if (!F.slot) return HT.judge(q, { f }, C).ok; const right = [].concat(F.intent).includes(q.intent) ? HT.slotVal(F.slot, C) : null; const vs = right ? [right] : HT.slotChoices(F.slot, C, rnd); return vs.some(v => HT.judge(q, { f, v }, C).ok); }).length;
        if (okN !== 1) bad.push(`시뮬레이터 ${id}: 맞는 틀이 ${okN}개예요 (${fr.join(',')})`);
        fr.forEach(f => { const F = HT.FRAME[f]; if (F.slot && !HT.slotChoices(F.slot, C, rnd).length) bad.push(`시뮬레이터 ${id}: ${f}의 칸 칩이 없어요`); });
        if (q.intent === 'help') { const L0 = HT.modelLine(C); const ml = HT.matchSpoken(HT.spoken(HT.text(L0)), q, C); if (!ml.ok || HT.covered(L0, q).filter(i => !ml.covered.includes(i)).length) bad.push(`시뮬레이터 전화 한 줄을 말로: ${HT.text(L0)} · ${ml.why} · ${ml.covered}`); }
      });
    }
    // 말로 대답하기: 다른 질문의 대답 · 다른 이름 · 다른 방 번호는 통과하지 않아야
    const D2 = HT.DEMO, nope = (w, raw, q, c) => { const r = HT.matchSpoken(raw, q, c); if (r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과해요`); };
    nope('다른 방 번호', 'It\'s twelve seventy.', 'bf_room', D2); nope('다른 방 번호(숫자)', 'Room 1270', 'co_room', D2);
    nope('다른 이름', 'I have a reservation under Lee.', 'ci_resv', D2); nope('다른 철자', 'L E E', 'ci_spell', D2);
    nope('날로 셈', 'Three days.', 'ci_nights', D2); nope('다른 질문의 대답', 'Two nights.', 'cl_help', Object.assign({}, D2));
    nope('다른 질문의 대답(방)', 'Coffee, please.', 'bf_room', D2); nope('다른 문제', 'The TV isn\'t working.', 'pr_help', D2);
    nope('안 맞는 부탁', 'The air conditioner isn\'t working. Could you bring up some towels?', 'pr_help', D2);
    nope('다른 시각', 'Could I get a wake-up call at six thirteen?', HT.simQ('cg_help', D2), D2);
    nope('서비스', 'Yes. Is breakfast service?', 'k_any', D2); nope('청구서', 'That looks right, thank you.', 'co_bill', D2);
    nope('미니바', 'Yes, just a bottle of water.', 'co_mini', D2); nope('다른 물건', 'Could I get a toothbrush?', 'cl_help', D2);
    // 따라 말하기: 같은 말은 모두 맞아야 · 숫자 낱말로 말해도 맞아야
    HT.SHADOW.forEach((s, i) => { const r = HT.compareWords(s.en, s.en), r2 = HT.compareWords(s.en, HT.spoken(s.en)); if (r.hit !== r.total || r2.hit !== r2.total) bad.push(`따라 말하기 ${i + 1}: 같은 글이 다 맞지 않아요`); if (!HT.PLACE[s.place]) bad.push(`따라 말하기 ${i + 1}: 곳이 없어요`); });
    if (HT.SHADOW.length !== 28) bad.push(`따라 말하기 문장 수: ${HT.SHADOW.length}`);
    bad.forEach(b => console.warn('[호텔] ' + b));
    return bad;
  };

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  HT.allText = function () {
    const out = [];
    Object.values(HT.Q).forEach(q => out.push(q.en, q.ko, q.short || ''));
    Object.values(HT.FRAME).forEach(F => out.push(F.t, F.ko, F.why || '', F.note || ''));
    Object.values(HT.SLOT).forEach(S => Object.values(S.vals || {}).forEach(v => out.push(Object.values(v).filter(x => typeof x === 'string').join(' '))));
    Object.values(HT.ASK).forEach(a => out.push(a.ko, a.say)); Object.values(HT.INTENT).forEach(a => out.push(a.ans, a.want || '', a.say || '', a.turn || ''));
    HT.PLACES.forEach(p => out.push(p.ko, p.en)); Object.values(HT.PROB).forEach(p => out.push(p.ko)); Object.values(HT.MINIBAR).forEach(m => out.push(m.en, m.ko));
    HT.PRACTICE.forEach(p => out.push(p.lines.join(''))); HT.SHADOW.forEach(s => out.push(s.en, s.ko));
    HT.LINKED.forEach(l => out.push(l.en, l.ko, l.sound.map(s => s[0]).join(''))); HT.PAIRS.forEach(p => out.push(p.join('')));
    Object.values(HT.CCAT).forEach(c => out.push(c.ko)); Object.values(HT.CW).forEach(w => out.push(w.t));
    out.push(HT.HOTEL, HT.HOTEL.toUpperCase(), HT.WIFI, '$0123456789.·+×–', 'ROOM FLOOR BREAKFAST CHECK-OUT WI-FI TOTAL TAX SUBTOTAL KEY CARD GUEST BILL THANK YOU FRONT DESK HOUSEKEEPING CONCIERGE LOBBY ELEVATOR');
    return out.join('');
  };
})();
