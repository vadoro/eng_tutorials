/* 은행 · 환전 · 휴대폰 회화 — 규칙 엔진과 대화 자료 (상황별 영어 회화)
 *
 * 은행 · 환전 창구 · 휴대폰 가게의 질문은 정해져 있어요. 대답은 서류와 숫자예요 — 공항 · 호텔 튜토리얼과 가까워요.
 *   서류는 내밀면서 → Sure. Here's my passport.
 *   숫자는 끊어서 → 30만 원 = three hundred thousand won (만 = ten thousand) · 555-0147 = five-five-five, oh-one-four-seven
 *   주소는 작은 곳에서 큰 곳으로 → Room 412, Maple Hall, 200 College Avenue, Kellport, 40213.
 * 상대가 알려 주는 큰 숫자(바꿔 줄 달러 · 새 전화번호)는 되짚어 확인해요(So, that's $240?).
 * 짧은 질문은 모양(Yes/No · 고르는 질문 · 정보 질문)이 대답을 정하고, Yes/No 질문은 첫 낱말이 짧은 대답의 짝을 정해요.
 *
 * 규칙 엔진은 소리를 듣지 않고, 말마다 적어 둔 ‘뜻(intent) · 모양(shape)’과 ‘대답 틀(frame) + 내 정보(slot)’,
 * 그리고 내 카드(또는 상황)의 사실을 맞춰 봐요. 달러 · 요금은 지어낸 환율과 요금표에서 계산해요(BK.fx · BK.planCost).
 *
 * 3단계 말하기 법 — BK.judge(상대의 말, 대답, 카드)
 *   ① 열쇠 낱말 + 질문의 모양 잡기 — 고르는 질문 · 정보 질문에 Yes · No만 하면 탈락, 고르는 질문이면 상대가 말한 것 가운데 골랐나,
 *                      대답이 그 말(intent)에 맞나. 빠르게 말해 못 알아들은 말(fast)이면 짐작한 대답은 탈락 → 다시 묻기
 *   ② 틀에 내 정보 넣기 — 틀이 자연스러운가(한국어 그대로 · 틀린 문장 · Yes/No 짝이 다른 대답이면 탈락), 금액 · 서류 · 번호가 카드와 맞나,
 *                      사실만 말하고 부탁이 빠졌나, 들은 숫자를 되짚었나, 주소의 조각과 차례가 맞나, 비밀번호를 소리 내어 말하지 않았나
 *   ③ 공손하게 끝내기 — 명령 · 따지는 말(blunt)이나 고맙다는 말 없이 끊긴 말(plain)이면 탈락
 * judge → { ok, stage: 0 | 1 | 2 | 3, why, tag }
 *
 * 주소 한 줄: BK.checkLine(낱말, 카드) — (It's) 방 번호 → 건물 → 번지 + 길 → 도시 + 우편번호
 *            BK.fixLine(낱말, 카드) — 틀린 첫 조각을 고쳐 주는 상대의 말(Sorry — Room 412, not 421?)
 * 숫자: BK.wonWords(300000 → three hundred thousand won) · BK.digits(555-0147 → five-five-five, oh-one-four-seven)
 *       BK.roomWords(412 → four-twelve) · BK.priceWords($240 → two hundred forty dollars) · BK.spoken(화면 글 → 소리)
 *
 * 영상의 ✓·×, 직접 해 보기, 은행 · 휴대폰 시뮬레이터, 듣고 대답 고르기, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 BK.check()가 콘솔에 경고를 내요.
 * 은행 · 가게 이름 · 환율 · 요금 · 주소 · 전화번호는 영어 연습을 위해 지어낸 예시예요. 실제 서류와 절차는 은행 · 나라마다 달라요.
 */
(function () {
  'use strict';
  const BK = (window.BK = {});
  const L4 = 'ABCD';

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s).replace(/\s*\([^()]*\)\s*$/, ''); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; if (/[0-9]/.test(s[i])) return '0136781'.includes(s[i]) ? 0xAC01 : 0xAC00; if (/[A-Za-z]/.test(s[i])) return /[lmnr]/i.test(s[i]) ? 0xAC01 : 0xAC00; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const rieul = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 === 8 : false; };
  const wa = s => s + (has(s) ? '과' : '와'), eul = s => s + (has(s) ? '을' : '를'), ig = s => s + (has(s) ? '이' : '가');
  const ro = s => s + (has(s) && !rieul(s) ? '으로' : '로'), ieyo = s => s + (has(s) ? '이에요' : '예요'), eun = s => s + (has(s) ? '은' : '는');
  BK.josa = { wa, eul, ig, ro, ieyo, eun };

  /* =========================================================
     일곱 곳 (도착해서 하는 차례: 환전 → 휴대폰 → 은행). sp: 그곳 상대의 목소리 (voices.js)
     ========================================================= */
  BK.PLACES = [
    { id: 'fx', ko: '환전 창구', en: 'Currency exchange', sp: 'gb' },
    { id: 'shop', ko: '휴대폰 가게 · 요금제', en: 'Phone shop · Plans', sp: 'au' },
    { id: 'sim', ko: '유심 · 새 번호', en: 'SIM card · New number', sp: 'au' },
    { id: 'teller', ko: '은행 창구 · 용건', en: 'Bank teller · What you need', sp: 'us' },
    { id: 'id', ko: '신분증 · 서류', en: 'ID · Documents', sp: 'us' },
    { id: 'form', ko: '주소 · 연락처', en: 'Address · Phone number', sp: 'ca' },
    { id: 'card', ko: '카드 · 비밀번호', en: 'Debit card · PIN', sp: 'ca' },
  ];
  BK.PLACE = {}; BK.PLACES.forEach((p, i) => { p.i = i; BK.PLACE[p.id] = p; });
  BK.ME = 'me';
  BK.CITY = 'Kellport';                     // 지어낸 도시
  BK.BANK = 'Kellport Harbor Bank';         // 지어낸 은행
  BK.SHOP = 'Kellport Mobile';              // 지어낸 휴대폰 가게
  BK.UNI = 'Kellport University';           // 지어낸 대학
  // 내가 먼저 용건을 꺼내는 곳 (환전 창구 · 휴대폰 가게 · 은행 창구)
  BK.ME_FIRST = { fx: 1, shop: 1, teller: 1 };

  /* =========================================================
     질문의 모양 세 가지 (+ 안내). mark: 그림 이름 (scenes.js의 shape_yn · shape_or · shape_wh · shape_note)
     ========================================================= */
  BK.SHAPE = {
    yn: { ko: 'Yes/No 질문', mark: '스위치', ans: 'Yes · No + 짝 맞는 짧은 대답', say: 'Yes/No 질문이에요. 질문의 첫 낱말로 짧은 대답을 만들어요', offer: '권하거나 부탁하는 말이면 Yes · No 대신 바로 답하거나 내밀어도 돼요' },
    or: { ko: '고르는 질문', mark: '갈림길', ans: '고른 것 + please', say: '고르는 질문(A or B?)이에요. 상대가 말한 것 가운데 하나를 골라 말해요' },
    wh: { ko: '정보 질문', mark: '빈 상자', ans: '정보 + please', say: '정보 질문이에요. 묻는 정보를 채워 말해요' },
    note: { ko: '안내', mark: '말풍선', ans: '되짚기 · 짧게 답하기', say: '질문이 아니라 알려 주는 말이에요' },
  };
  BK.shapeOf = q => (typeof q === 'string' ? BK.Q[q] : q).shape;
  // 글만 보고 짐작한 모양 (점검용): 물음표 문장 가운데 마지막 것 → or가 있으면 고르기, 의문사로 시작하면 정보, 아니면 Yes/No
  BK.shapeGuess = function (en) {
    const qs = String(en).match(/[^.!?]*\?/g);
    if (!qs) return 'note';
    let s = qs[qs.length - 1].trim().toLowerCase().replace(/^(and|so|great|okay|sure|perfect|thanks|now|no problem|hi|hey|hello|hiya|morning|right|alright|lovely)[,!]?\s+/, '');
    if (/\bor\b/.test(s)) return 'or';
    if (/^(how|what|which|where|when|who|why)\b/.test(s)) return 'wh';
    return 'yn';
  };
  // Yes/No 질문의 짝 (질문의 첫 낱말 → 짧은 대답)
  BK.AUX = {
    do: { q: 'Do you …?', a: 'Yes, I do. · No, I don\'t.' },
    be: { q: 'Are you …?', a: 'Yes, I am. · No, I\'m not.' },
    is: { q: 'Is it …?', a: 'Yes, it is. · No, it isn\'t.' },
  };

  /* =========================================================
     숫자 읽기 — 원 · 달러 · 전화번호 · 방 번호 · 우편번호 (화면 글 → 소리)
     ========================================================= */
  const NUMW = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };
  const numWord = n => n < 20 || (n < 100 && n % 10 === 0) ? NUMW[n] : n < 100 ? `${NUMW[n - n % 10]}-${NUMW[n % 10]}` : n < 1000 ? `${NUMW[Math.floor(n / 100)]} hundred${n % 100 ? ' ' + numWord(n % 100) : ''}` : String(n);
  BK.numWord = numWord;
  // 큰 수: 300000 → three hundred thousand · 1000000 → one million
  const bigWords = n => {
    if (n >= 1000000) { const m = Math.floor(n / 1000000), r = n % 1000000; return `${numWord(m)} million${r ? ' ' + bigWords(r) : ''}`; }
    if (n >= 1000) { const k = Math.floor(n / 1000), r = n % 1000; return `${numWord(k)} thousand${r ? ' ' + numWord(r) : ''}`; }
    return numWord(n);
  };
  BK.bigWords = bigWords;
  const comma = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  BK.comma = comma;
  // 원: 화면 · 소리 · 한국어(만 단위)
  BK.wonText = w => `${comma(w)} won`;
  BK.wonWords = w => `${bigWords(w)} won`;
  BK.manKo = w => { const m = Math.floor(w / 10000), r = w % 10000; return m ? `${m}만${r ? ' ' + comma(r) : ''} 원` : `${comma(w)} 원`; };
  BK.wonKo = w => `${BK.manKo(w)}(${comma(w)}원)`;
  // 달러 (센트로 셈)
  BK.money = c => '$' + (c % 100 ? (c / 100).toFixed(2) : comma(c / 100));
  BK.priceWords = c => { const d = Math.floor(c / 100), k = c % 100; return `${bigWords(d)} dollar${d === 1 ? '' : 's'}${k ? ` and ${numWord(k)} cents` : ''}`; };
  BK.priceKo = c => { const d = Math.floor(c / 100), k = c % 100; return k ? `${comma(d)}달러 ${k}센트` : `${comma(d)}달러`; };
  // 한 자리씩 (0 → oh), 묶음은 쉼표로: 555-0147 → five-five-five, oh-one-four-seven
  const DIG = ['oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  BK.digits = s => String(s).split('-').map(gp => gp.split('').map(d => DIG[+d]).join('-')).join(', ');
  // 묶음을 큰 수처럼 읽은 말 (함정): 555-0147 → five hundred fifty-five, one hundred forty-seven
  BK.bigRead = s => String(s).split('-').map(gp => numWord(+gp)).join(', ');
  // 방 번호: 412 → four-twelve · 405 → four-oh-five
  BK.roomWords = n => { const h = Math.floor(n / 100), r = n % 100; return `${NUMW[h]}-${r < 10 ? 'oh-' + NUMW[r] : numWord(r)}`; };
  // 길 번지: 200 → two hundred
  BK.streetWords = n => numWord(n);
  // 소리 내어 읽을 글
  BK.spoken = s => String(s)
    .replace(/\$(\d{1,3}(?:,\d{3})*)(?:\.(\d{2}))?/g, (m, d, c) => BK.priceWords(+d.replace(/,/g, '') * 100 + (c ? +c : 0)))
    .replace(/\b(\d{1,3}(?:,\d{3})+) won\b/g, (m, d) => BK.wonWords(+d.replace(/,/g, '')))
    .replace(/\b(\d{3})-(\d{4})\b/g, m => BK.digits(m))
    .replace(/\bRoom (\d{3})\b/g, (m, d) => `Room ${BK.roomWords(+d)}`)
    .replace(/\b(\d{5})\b/g, m => m.split('').map(d => DIG[+d]).join('-'))
    .replace(/\b(\d{3}) (College Avenue)\b/g, (m, d, st) => `${numWord(+d)} ${st}`)
    .replace(/\b(\d+) GB\b/g, (m, d) => `${numWord(+d)} gigabytes`)
    .replace(/\b(\d{1,2})\b/g, (m, d) => numWord(+d));
  // 헷갈리는 숫자 짝: 13~19 ↔ 30~90 (sixTEEN ↔ SIXty)
  BK.teenSwap = n => n >= 13 && n <= 19 ? (n - 10) * 10 : n >= 30 && n <= 90 && n % 10 === 0 ? n / 10 + 10 : null;
  // 끝 두 자리의 teen ↔ ty: 240 → 214 · 160 → 116 · 30 → 13
  BK.tailSwap = n => { const h = n - n % 100, t = BK.teenSwap(n % 100); return t != null ? h + t : null; };

  /* =========================================================
     환전 (지어낸 환율 · 수수료 없음 — 단순하게 줄인 계산)
     ========================================================= */
  BK.RATE = 1250;                         // 1달러 = 1,250원 (지어낸 오늘의 환율)
  BK.WONS = [200000, 300000, 600000, 700000];
  BK.fx = w => Math.round(w * 100 / BK.RATE);   // 받을 달러 (센트)
  // 만 단위를 잘못 옮긴 값 (함정): 30만 → 3만(thirty thousand) · 300만(three million)
  BK.wonTraps = w => [w / 10, w * 10];
  BK.BILLS = { large: { t: 'Large', ko: '큰 지폐(50 · 100달러)' }, small: { t: 'Small', ko: '작은 지폐(10 · 20달러)' } };

  /* =========================================================
     휴대폰 요금제 (지어낸 요금표, 한 달) · 데이터 · 머무는 기간
     ========================================================= */
  BK.PLANS = { prepaid: { t: 'Prepaid', ko: '선불 요금제(먼저 내고 쓰기)' }, monthly: { t: 'A monthly plan', ko: '월 요금제(약정)' } };
  BK.DATA = { d15: { t: '15 GB', ko: '한 달 15GB', gb: 15 }, d50: { t: '50 GB', ko: '한 달 50GB', gb: 50 }, unl: { t: 'Unlimited data', ko: '데이터 무제한' } };
  BK.COST = { prepaid: { d15: 3000, d50: 4500, unl: 6000 }, monthly: { d15: 2500, d50: 4000, unl: 5500 } };
  BK.planCost = (plan, data) => BK.COST[plan][data];
  BK.MONTHS_STAY = { m4: { t: 'four months', ko: '넉 달(4개월)' }, m6: { t: 'six months', ko: '6개월' }, m10: { t: 'ten months', ko: '10개월' } };
  // 새 전화번호 (555-01xx는 영화 · 드라마에 쓰는 가상의 번호 관례)
  BK.PHONES = ['555-0147', '555-0162', '555-0138', '555-0185', '555-0129', '555-0153'];
  BK.phoneTrap = p => p.slice(0, -2) + p.slice(-1) + p.slice(-2, -1);   // 끝 두 자리 바꿈: 0147 → 0174

  /* =========================================================
     서류 · 주소 (기숙사 — 지어낸 이름)
     ========================================================= */
  BK.DOCS = {
    passport: { t: 'my passport', ko: '여권' },
    sid: { t: 'my student ID', ko: '학생증' },
    lease: { t: 'my housing contract', ko: '기숙사 계약서' },
    letter: { t: 'a letter from my university', ko: '학교 확인서(재학 확인 편지)' },
  };
  BK.HALLS = { maple: { t: 'Maple Hall', ko: '메이플 홀', st: 200 }, cedar: { t: 'Cedar Hall', ko: '시더 홀', st: 300 }, birch: { t: 'Birch Hall', ko: '버치 홀', st: 500 } };
  BK.HALL_IDS = Object.keys(BK.HALLS);
  BK.STREET = 'College Avenue';
  BK.ZIP = '40213';
  BK.ROOMS = [212, 315, 412, 518, 614];
  BK.roomTrap = n => n - n % 100 + (n % 10) * 10 + Math.floor(n % 100 / 10);   // 412 → 421
  BK.zipTrap = z => z.slice(0, -2) + z.slice(-1) + z.slice(-2, -1);              // 40213 → 40231
  // 주소 (화면 · 영어 차례 · 한국식 차례)
  BK.addrEn = A => `Room ${A.room}, ${BK.HALLS[A.hall].t}, ${BK.HALLS[A.hall].st} ${BK.STREET}, ${BK.CITY}, ${BK.ZIP}`;
  BK.addrKo = A => `${BK.CITY} ${BK.ZIP}, ${BK.STREET} ${BK.HALLS[A.hall].st}, ${BK.HALLS[A.hall].t} ${A.room}호`;
  BK.PINS = ['0412', '2580', '7391', '1606'];
  /* =========================================================
     말의 뜻(intent) — 질문의 모양과 기대하는 대답
     yn: Yes/No 질문에 그냥 Yes · No로만 답할 때 → { yes: 카드 → 카드가 바라는 Yes(true) · No(false) · 모름(null), need: 통과하지만 덧붙일 말, strict: 탈락 까닭 }
     key: 고르는 질문에서 고른 것을 담는 사실 이름 · best(카드, 말): 모범 틀
     ========================================================= */
  const I = (shape, ans, want, best, o = {}) => Object.assign({ shape, ans, want, best }, o);
  BK.INTENT = {
    need: I('wh', '무엇을 도와줄지 묻는 질문', '용건을 부탁 틀로 → I\'d like to change 300,000 won into US dollars, please. · I\'d like to open a bank account, please.', (c, q) => q && q.place === 'shop' ? 'nd_sim' : q && q.place === 'teller' ? 'nd_acct' : 'nd_fx', { turn: '용건 말하기' }),
    much: I('wh', '얼마를 바꿀지 묻는 질문', '금액 + please → Three hundred thousand won, please. (30만 = three hundred thousand)', 'mc_won', { turn: '바꿀 금액' }),
    bills: I('or', '큰 지폐와 작은 지폐 가운데 고르라는 질문', '고른 것 + please → Small bills, please.', 'bl_pl', { turn: '지폐 고르기', key: 'bills' }),
    get: I('note', '바꿔 줄 달러를 알려 주는 말', '들은 금액을 되짚어 → So, that\'s $240? · Sorry, did you say two hundred forty?', 'gt_so', { turn: '받을 금액 되짚기', say: '바꿔 줄 금액을 알려 주는 말이에요. 큰 숫자는 되짚어 확인해요' }),
    id: I('yn', '여권(신분증)을 보여 달라는 부탁', '내밀면서 → Sure. Here\'s my passport.', 'id_here', { turn: '여권 내밀기', offer: true, yn: { yes: () => true, need: '내밀면서 Here\'s my passport.를 붙이면 더 자연스러워요.' } }),
    plan: I('or', '선불과 월 요금제 가운데 고르라는 질문', '고른 것 + please → Prepaid, please.', 'pl_pl', { turn: '요금제 고르기', key: 'plan' }),
    data: I('wh', '데이터가 얼마나 필요한지 묻는 질문', '양 + please → 15 GB, please. · Unlimited data, please.', 'dt_pl', { turn: '데이터' }),
    stay: I('wh', '얼마나 머무는지 묻는 질문', 'For + 기간 → For six months.', 'st_for', { turn: '머무는 기간' }),
    cost: I('note', '값을 알려 주는 말', '카드로 내려면 Can I pay by card? 현금이면 Here you go. 숫자가 헷갈리면 → Sorry, did you say thirty dollars?', c => c.paym === 'cash' ? 'co_here' : 'co_card', { turn: '값 듣기', say: '값을 알려 주는 말이에요. 숫자를 잘 들었는지 확인하고 내는 방법을 말해요' }),
    unlock: I('yn', '휴대폰이 잠금 해제됐는지 묻는 질문', 'Is it …? → Yes, it is. · No, it isn\'t.', c => c.unlocked === false ? 'ul_no' : 'ul_yes', { turn: '잠금 해제', yn: { yes: c => c.unlocked == null ? null : !!c.unlocked } }),
    number: I('note', '새 전화번호를 알려 주는 말', '한 자리씩 묶음으로 되짚어 → So, it\'s 555-0147? (five-five-five, oh-one-four-seven)', 'nb_so', { turn: '새 번호 되짚기', say: '새 전화번호를 알려 주는 말이에요. 번호는 묶음으로 끊어 되짚어요' }),
    topup: I('yn', '자동 충전을 하겠는지 묻는 말', '하지 않으면 → No, thanks. I\'ll top it up myself. · 하려면 → Yes, please.', c => c.auto ? 'g_yesp' : 'tu_no', { turn: '자동 충전', offer: true, yn: { yes: c => c.auto == null ? null : !!c.auto } }),
    type: I('or', '입출금 통장과 저축 통장 가운데 고르라는 질문', '고른 것 + please → A checking account, please.', 'ty_pl', { turn: '통장 고르기', key: 'acct' }),
    student: I('yn', '학생인지 묻는 질문', 'Are you …? → Yes, I am. I\'m an exchange student.', 'su_yes', { turn: '학생인가', yn: { yes: () => true, need: '어느 학교 학생인지 덧붙이면 좋아요 → Yes, I am. I\'m an exchange student at Kellport University.' } }),
    second: I('yn', '다른 신분증이 있는지 묻는 질문', 'Do you …? → Yes, I do. Here\'s my student ID.', 'sc_yes', { turn: '두 번째 신분증', yn: { yes: () => true, need: '있다고만 하지 말고 내밀어요 → Yes, I do. Here\'s my student ID.' } }),
    proof: I('yn', '주소를 증명할 서류가 있는지 묻는 질문', '있으면 → Yes, I do. Here\'s my housing contract. 없으면 사실 + 부탁 → No, I don\'t. Would a letter from my university work?', c => c.proof ? 'pf_yes' : 'pf_ask', { turn: '주소 증명', yn: { yes: c => c.proof === undefined ? null : !!c.proof, need: '서류를 내밀며 Here\'s my housing contract.를 붙여요.', noStrict: '없다고만 하면 계좌를 열 수 없어요. 대신 낼 수 있는 서류를 질문으로 물어요 → No, I don\'t. Would a letter from my university work?' } }),
    addr: I('wh', '주소를 묻는 질문', '작은 곳에서 큰 곳으로 → It\'s Room 412, Maple Hall, 200 College Avenue, Kellport, 40213.', 'line', { turn: '주소 말하기' }),
    phone: I('wh', '전화번호를 묻는 질문', 'It\'s + 번호(묶음으로 끊어) → It\'s 555-0147.', 'ph_is', { turn: '전화번호' }),
    sign: I('note', '서명해 달라는 안내', '알겠다고 짧게 → Sure. Right here?', 'sg_ok', { turn: '서명', say: '서명해 달라는 안내예요. 알겠다고 짧게 답해요' }),
    debit: I('yn', '직불 카드(체크카드)가 필요한지 묻는 말', '필요하면 → Yes, please. · 아니면 → No, thanks.', c => c.debit === false ? 'g_no' : 'g_yesp', { turn: '직불 카드', offer: true, yn: { yes: c => c.debit == null ? null : !!c.debit } }),
    pin: I('note', '비밀번호를 기계에 눌러 달라는 안내', '말하지 않고 누르며 짧게 → Okay. (비밀번호는 소리 내어 말하지 않아요)', 'pn_ok', { turn: '비밀번호', say: '비밀번호(PIN)를 기계에 눌러 달라는 안내예요. 비밀번호는 말하지 않고 눌러요' }),
    else: I('yn', '더 도와줄 것이 있는지 묻는 질문', '물어볼 것이 있으면 바로 → Yes. Could you tell me where the nearest ATM is? 없으면 → No, that\'s everything. Thank you!', c => c.ask ? 'el_atm' : 'el_no', { turn: 'ATM · 마무리', yn: { yes: c => c.ask == null ? null : !!c.ask, strict: '물어볼 것이 있으면 Yes만 하지 말고 바로 물어요 → Yes. Could you tell me where the nearest ATM is?' } }),
    repair: I(null, '다시 묻는 말', '', 'rp_again'),
  };
  BK.sayOf = intent => { const it = BK.INTENT[intent]; return it.say || BK.SHAPE[it.shape].say; };
  BK.INTENT_KO = {}; Object.entries(BK.INTENT).forEach(([k, v]) => { BK.INTENT_KO[k] = v.turn || ''; });
  BK.CROSS = {};

  /* =========================================================
     상대의 말. key: 열쇠 낱말(말 안에 꼭 있어야 함) · shape: 질문의 모양 · choices: 고르는 질문에서 고를 것(사실 값)
     fast: 너무 빨라 못 알아들은 말 · short: 지도에 쓰는 짧은 꼴 · fact: 그 말이 알려 준 사실 · allow: 대답 대신 해도 되는 다시 묻기(틀 id)
     aux: Yes/No 질문의 첫 낱말 짝(do · be · is)
     ========================================================= */
  BK.Q = {};
  const Q = (id, place, intent, en, ko, key, o = {}) => (BK.Q[id] = Object.assign({ id, place, intent, en, ko, key, shape: BK.INTENT[intent].shape, sp: BK.PLACE[place].sp }, o));
  // 환전 창구 (내가 먼저)
  Q('fx_help', 'fx', 'need', 'Hello! How can I help you today?', '안녕하세요! 무엇을 도와드릴까요?', ['How can I help'], { fact: { task: 'fx' }, short: 'How can I help you?' });
  Q('fx_fast', 'fx', 'need', 'Hiya, what can I do for you?', '안녕하세요, 뭘 해 드릴까요?', ['do for you'], { fact: { task: 'fx' }, fast: true });
  Q('fx_much', 'fx', 'much', 'Sure. How much would you like to change?', '네. 얼마를 바꾸시겠어요?', ['How much'], { short: 'How much would you like to change?' });
  Q('fx_bills', 'fx', 'bills', 'Would you like large bills or small bills?', '큰 지폐로 드릴까요, 작은 지폐로 드릴까요?', ['large bills or small bills'], { choices: ['large', 'small'], short: 'Large bills or small bills?' });
  Q('fx_get', 'fx', 'get', 'At today\'s rate, that comes to $240.', '오늘 환율로 240달러예요.', ['$240'], { fact: { usd: 24000 }, short: 'That comes to $240.' });
  Q('fx_pass', 'fx', 'id', 'Can I see your passport, please?', '여권을 보여 주시겠어요?', ['passport'], { fact: { doc: 'passport' }, short: 'Can I see your passport?' });
  // 휴대폰 가게 · 요금제 (내가 먼저)
  Q('sh_help', 'shop', 'need', 'Hi there! What can I do for you today?', '안녕하세요! 오늘 무엇을 도와드릴까요?', ['What can I do'], { fact: { task: 'sim' }, short: 'What can I do for you?' });
  Q('sh_plan', 'shop', 'plan', 'Would you like a prepaid plan or a monthly plan?', '선불 요금제로 하시겠어요, 월 요금제로 하시겠어요?', ['prepaid', 'or a monthly plan'], { choices: ['prepaid', 'monthly'], short: 'Prepaid or monthly?' });
  Q('sh_data', 'shop', 'data', 'And how much data do you need?', '그리고 데이터는 얼마나 필요하세요?', ['how much data'], { short: 'How much data do you need?' });
  Q('sh_stay', 'shop', 'stay', 'How long are you staying?', '얼마나 머무세요?', ['How long'], { short: 'How long are you staying?' });
  Q('sh_cost', 'shop', 'cost', 'Okay, that\'s $30 for the first month.', '네, 첫 달은 30달러예요.', ['$30'], { fact: { amount: 3000 }, short: 'That\'s $30 for the first month.' });
  Q('sh_fast', 'shop', 'data', 'How much data d\'you reckon you need?', '데이터 얼마나 필요할 것 같아요?', ['data'], { fast: true });
  // 유심 · 새 번호
  Q('sm_unlock', 'sim', 'unlock', 'Is your phone unlocked?', '휴대폰이 잠금 해제돼 있어요?', ['unlocked'], { aux: 'is', short: 'Is your phone unlocked?' });
  Q('sm_num', 'sim', 'number', 'Alright, you\'re all set. Your new number is 555-0147.', '다 됐어요. 새 번호는 555-0147이에요.', ['new number'], { fact: { phone: '555-0147' }, short: 'Your new number is 555-0147.' });
  Q('sm_top', 'sim', 'topup', 'Would you like to set up auto top-up?', '자동 충전을 설정해 드릴까요?', ['auto top-up'], { allow: ['rp_wtop'], short: 'Would you like auto top-up?' });
  Q('sm_fast', 'sim', 'number', 'Righto, new number\'s 555-0147.', '자, 새 번호는 555-0147이에요.', ['new number'], { fact: { phone: '555-0147' }, fast: true });
  // 은행 창구 · 용건 (내가 먼저)
  Q('tl_help', 'teller', 'need', 'Good morning. What can I do for you today?', '안녕하세요. 오늘 무엇을 도와드릴까요?', ['What can I do'], { fact: { task: 'acct' }, short: 'What can I do for you?' });
  Q('tl_type', 'teller', 'type', 'Would you like a checking account or a savings account?', '입출금 통장으로 하시겠어요, 저축 통장으로 하시겠어요?', ['checking account or a savings account'], { choices: ['checking', 'savings'], short: 'Checking or savings?' });
  Q('tl_student', 'teller', 'student', 'Are you a student?', '학생이세요?', ['student'], { aux: 'be', short: 'Are you a student?' });
  // 신분증 · 서류
  Q('id_pass', 'id', 'id', 'Can I see your passport, please?', '여권을 보여 주시겠어요?', ['passport'], { fact: { doc: 'passport' }, short: 'Can I see your passport?' });
  Q('id_second', 'id', 'second', 'Do you have a second form of ID?', '다른 신분증이 하나 더 있으세요?', ['second form of ID'], { aux: 'do', fact: { doc: 'sid' }, short: 'Do you have a second form of ID?' });
  Q('id_proof', 'id', 'proof', 'Do you have proof of address?', '주소를 증명할 서류가 있으세요?', ['proof of address'], { aux: 'do', short: 'Do you have proof of address?' });
  Q('id_fast', 'id', 'id', 'Got some ID?', '신분증 있어요?', ['ID'], { fact: { doc: 'passport' }, fast: true });
  // 주소 · 연락처
  Q('fm_addr', 'form', 'addr', 'Okay. What\'s your address here?', '네. 여기 주소가 어떻게 되세요?', ['address'], { short: 'What\'s your address?' });
  Q('fm_phone', 'form', 'phone', 'And what\'s a good phone number for you?', '그리고 연락받을 전화번호는요?', ['phone number'], { short: 'What\'s your phone number?' });
  Q('fm_sign', 'form', 'sign', 'Great. Please sign here.', '좋아요. 여기에 서명해 주세요.', ['sign here'], { short: 'Please sign here.' });
  Q('fm_fast', 'form', 'addr', 'And what\'s the address there?', '그리고 거기 주소는요?', ['address'], { fast: true });
  // 카드 · 비밀번호
  Q('cd_debit', 'card', 'debit', 'Would you like a debit card with your account?', '계좌에 직불 카드도 만들어 드릴까요?', ['debit card'], { short: 'Would you like a debit card?' });
  Q('cd_pin', 'card', 'pin', 'Please enter a four-digit PIN on the keypad.', '숫자판에 네 자리 비밀번호를 눌러 주세요.', ['PIN'], { short: 'Please enter a PIN.' });
  Q('cd_else', 'card', 'else', 'Is there anything else I can help you with?', '더 도와드릴 일이 있을까요?', ['anything else'], { aux: 'is', short: 'Anything else?' });
  // 곳마다 대표 말 (영상 01장 지도 · 직접 해 보기)
  BK.PLACEQ = {
    fx: ['fx_help', 'fx_get'], shop: ['sh_help', 'sh_plan'], sim: ['sm_unlock', 'sm_num'], teller: ['tl_help', 'tl_type'],
    id: ['id_pass', 'id_proof'], form: ['fm_addr', 'fm_phone'], card: ['cd_debit', 'cd_pin'],
  };

  /* =========================================================
     칸에 넣는 내 정보 (slot). 틀(frame)이 form으로 어느 꼴을 쓸지 정해요.
     fact: 이 값이 말하는 사실 · bad · why: 콩글리시 값(② 탈락) · note: 통하지만 덧붙일 말 · dyn: 값이 정해져 있지 않은 칸
     ========================================================= */
  BK.SLOT = {
    won: { key: 'won', dyn: 'won' },
    usd: { key: 'usd', dyn: 'usd' },
    money: { key: 'amount', dyn: 'money' },
    phone: { key: 'phone', dyn: 'phone' },
    pin: { key: 'pin', dyn: 'pin' },
    bills: { key: 'bills', vals: Object.fromEntries(Object.entries(BK.BILLS).map(([k, v]) => [k, Object.assign({}, v)])) },
    plan: { key: 'plan', vals: Object.fromEntries(Object.entries(BK.PLANS).map(([k, v]) => [k, Object.assign({}, v)])) },
    data: { key: 'data', vals: Object.assign(Object.fromEntries(Object.entries(BK.DATA).map(([k, v]) => [k, Object.assign({}, v)])),
      { free: { t: 'Data free', ko: '(어색한 말) 데이터 공짜', fact: { data: 'unl' }, bad: 'literal', why: '‘데이터 무제한’을 data free로 옮기면 ‘데이터는 공짜로’처럼 들려요. 마음껏 쓰는 요금제는 → Unlimited data, please.' } }) },
    months: { key: 'stay', vals: Object.fromEntries(Object.entries(BK.MONTHS_STAY).map(([k, v]) => [k, Object.assign({}, v)])) },
    acct: { key: 'acct', vals: { checking: { t: 'A checking account', ko: '입출금 통장(checking)' }, savings: { t: 'A savings account', ko: '저축 통장(savings)' },
      book: { t: 'A bankbook', ko: '(어색한 말) 통장', fact: { acct: 'checking' }, bad: 'literal', why: '‘통장’을 bankbook으로 옮겼어요. 요즘은 종이 통장보다 계좌의 종류로 말해요 → A checking account, please.' } } },
    doc: { key: 'doc', vals: Object.fromEntries(Object.entries(BK.DOCS).map(([k, v]) => [k, Object.assign({}, v)])) },
  };
  // 칸 값 하나 (값이 정해져 있지 않은 칸도)
  BK.sv = function (slot, v) {
    const S = BK.SLOT[slot]; if (!S || v == null) return null;
    if (S.dyn === 'won') return /^\d+$/.test(String(v)) ? { t: BK.wonWords(+v), num: BK.wonText(+v), man: `${numWord(Math.floor(+v / 10000))} man won`, ko: BK.manKo(+v), fact: { won: +v } } : null;
    if (S.dyn === 'usd' || S.dyn === 'money') return /^\d+$/.test(String(v)) ? { t: BK.money(+v), ko: BK.priceKo(+v), fact: { [S.key]: +v } } : null;
    if (S.dyn === 'phone') return /^\d{3}-\d{4}$/.test(String(v)) ? { t: String(v), big: BK.bigRead(v), ko: `${v} (한 자리씩)`, fact: { phone: String(v) } } : null;
    if (S.dyn === 'pin') return /^\d{4}$/.test(String(v)) ? { t: String(v).split('').join('-'), ko: `비밀번호 ${v}`, fact: { pin: String(v) } } : null;
    return S.vals[v] || null;
  };
  const valFact = (slot, v) => { const x = BK.sv(slot, v); if (!x) return {}; return x.fact ? Object.assign({}, x.fact) : { [BK.SLOT[slot].key]: v }; };
  BK.valFact = valFact;
  // 카드와 맞는 칸 값 (콩글리시 · 알림이 붙는 값은 빼고)
  const slotIds = slot => { const S = BK.SLOT[slot]; return S.dyn ? [] : Object.keys(S.vals).filter(id => { const x = S.vals[id]; return !x.bad && !x.note; }); };
  BK.slotIds = slotIds;
  BK.slotVal = function (slot, C, q) {
    const S = BK.SLOT[slot];
    if (S.dyn) { const v = C[S.key]; return v != null ? String(v) : null; }
    if (slot === 'doc') return q && q.intent === 'second' ? 'sid' : q && q.intent === 'proof' ? (C.proof ? 'lease' : 'letter') : 'passport';
    const ids = slotIds(slot);
    const fit = id => { const f = valFact(slot, id); return Object.keys(f).length && Object.keys(f).every(k => C[k] === f[k]); };
    return ids.find(fit) || null;
  };

  /* =========================================================
     주소 한 줄 — 조각과 순서: (It's) → 방 번호 → 건물 → 번지 + 길 → 도시 + 우편번호
     영어 주소는 작은 곳에서 큰 곳으로 가요(한국 주소와 거꾸로). 들어갈 조각을 모두 넣어요. (자주 쓰는 꼴을 단순하게 줄인 규칙)
     줄 = { words: [조각 id, …] }
     ========================================================= */
  BK.OW = { its: { c: 'open', t: 'It\'s' } };
  const ROOM_ALL = BK.ROOMS.concat(BK.ROOMS.map(BK.roomTrap));
  ROOM_ALL.forEach(n => { BK.OW['r' + n] = { c: 'room', t: `Room ${n}`, v: n, ko: `${n}호` }; });
  BK.HALL_IDS.forEach(h => { BK.OW[h] = { c: 'hall', t: BK.HALLS[h].t, v: h, ko: BK.HALLS[h].ko }; });
  BK.HALL_IDS.forEach(h => {
    const n = BK.HALLS[h].st;
    BK.OW['s' + n] = { c: 'st', t: `${n} ${BK.STREET}`, v: n, ko: `${BK.STREET} ${n}번지` };
    BK.OW['k' + n] = { c: 'st', t: `${BK.STREET} ${n}`, v: n, ko: `(한국식) ${BK.STREET} ${n}`, bad: 'literal', why: `한국 주소처럼 길 이름 뒤에 번지를 붙였어요. 영어 주소는 번지를 먼저 → ${n} ${BK.STREET}.` };
  });
  [BK.ZIP, BK.zipTrap(BK.ZIP)].forEach(z => { BK.OW['z' + z] = { c: 'city', t: `${BK.CITY}, ${z}`, v: z, ko: `${BK.CITY} ${z}` }; });
  Object.entries(BK.OW).forEach(([id, w]) => { w.id = id; });
  BK.OCAT = { open: { ko: '여는 말(It\'s)', n: 0 }, room: { ko: '방 번호', n: 1 }, hall: { ko: '건물(기숙사)', n: 2 }, st: { ko: '번지 + 길', n: 3 }, city: { ko: '도시 + 우편번호', n: 4 } };
  // 카드의 주소 → 모범 한 줄
  BK.addrOf = C => C.addr || { room: 412, hall: 'maple' };
  BK.lineWords = A => ['its', 'r' + A.room, A.hall, 's' + BK.HALLS[A.hall].st, 'z' + BK.ZIP];
  // 틀린 조각 찾기 → { type, word, right } (첫 번째 것)
  function lineErr(W, A) {
    for (const x of W) {
      if (x.c === 'room' && x.v !== A.room) return { type: 'room', word: x, right: 'r' + A.room };
      if (x.c === 'hall' && x.v !== A.hall) return { type: 'hall', word: x, right: A.hall };
      if (x.c === 'st' && x.v !== BK.HALLS[A.hall].st) return { type: 'st', word: x, right: 's' + BK.HALLS[A.hall].st };
      if (x.c === 'city' && x.v !== BK.ZIP) return { type: 'city', word: x, right: 'z' + BK.ZIP };
    }
    return null;
  }
  const ERR_KO = { room: '방 번호', hall: '건물(기숙사) 이름', st: '번지', city: '우편번호' };
  BK.ERR_KO = ERR_KO;
  const isKoOrder = W => { const n = W.filter(x => x.c !== 'open').map(x => BK.OCAT[x.c].n); return n.length >= 2 && n.every((v, i) => !i || v < n[i - 1]); };
  BK.checkLine = function (Lw, C = {}) {
    const ws = Lw.words || Lw, W = ws.map(w => BK.OW[w]);
    if (!ws.length) return { ok: false, stage: 1, why: '아직 아무것도 고르지 않았어요.' };
    if (W.some(x => !x)) return { ok: false, stage: 2, why: '사전에 없는 조각이 있어요.' };
    const A = BK.addrOf(C), want = BK.lineWords(A);
    const n = c => W.filter(x => x.c === c).length;
    for (const c of Object.keys(BK.OCAT)) if (n(c) > 1) return { ok: false, stage: 2, why: `${eun(BK.OCAT[c].ko)} 한 번만 말해요.`, want, tag: 'order' };
    if (n('open') && W[0].c !== 'open') return { ok: false, stage: 2, why: 'It\'s는 맨 앞에 와요.', want, tag: 'order' };
    if (isKoOrder(W)) return { ok: false, stage: 2, why: `한국 주소의 차례(큰 곳 → 작은 곳)로 말했어요. 영어 주소는 거꾸로, 작은 곳(방 번호)에서 큰 곳(도시)으로 가요 → ${BK.lineText({ words: want })}`, want, tag: 'order', ko: true };
    const body = W.filter(x => x.c !== 'open');
    for (let k = 1; k < body.length; k++) if (BK.OCAT[body[k].c].n <= BK.OCAT[body[k - 1].c].n) return { ok: false, stage: 2, why: `차례가 뒤섞였어요. 작은 곳에서 큰 곳으로 → ${BK.lineText({ words: want })}`, want, tag: 'order' };
    const bad = W.find(x => x.bad);
    if (bad) return { ok: false, stage: 2, why: bad.why, want, tag: bad.bad, badW: bad };
    const e = lineErr(W, A);
    if (e) {
      const why = `카드의 주소와 달라요(${ERR_KO[e.type]}). 카드: ${BK.OW[e.right].t} · 이 대답: ${e.word.t}.` + (e.type === 'room' || e.type === 'city' ? ' 숫자는 한 자리씩 또박또박 → ' + (e.type === 'room' ? BK.roomWords(A.room) : BK.digits(BK.ZIP)) + '.' : '');
      return { ok: false, stage: 2, why, want, tag: 'fact', err: e };
    }
    const need = ['room', 'hall', 'st', 'city'].filter(c => !W.some(x => x.c === c));
    if (need.length) return { ok: false, stage: 2, why: `빠진 조각이 있어요: ${need.map(c => BK.OCAT[c].ko).join(' · ')}. 카드나 편지가 그 주소로 와야 해서 모두 말해요 → ${BK.lineText({ words: want })}`, want, tag: 'need', missing: need };
    return { ok: true, why: `${body.map(x => BK.OCAT[x.c].ko).join(' → ')}. 작은 곳에서 큰 곳으로, 빠짐없이 말했어요.`, want };
  };
  // 상대가 되묻거나 고쳐 주는 말 (틀린 첫 조각만) · 맞으면 Great, thanks.
  BK.fixLine = function (Lw, C) {
    const o = BK.checkLine(Lw, C), A = BK.addrOf(C || {});
    if (o.ok) return { en: 'Great, thank you.', ko: '좋아요, 고마워요.' };
    if (o.tag === 'fact' && o.err) return { en: `Sorry — ${o.err.word.t}? Could you check that for me?`, ko: `${o.err.word.t}가 맞는지 다시 봐 달라고 해요. 카드: ${BK.OW[o.err.right].t}.` };
    if (o.tag === 'need') return { en: `And the ${o.missing.map(c => ({ room: 'room number', hall: 'building', st: 'street address', city: 'city and ZIP code' })[c]).join(' and the ')}?`, ko: `빠진 조각을 물어요: ${o.missing.map(c => BK.OCAT[c].ko).join(' · ')}.` };
    if (o.tag === 'literal') return { en: `Oh — ${BK.HALLS[A.hall].st} ${BK.STREET}?`, ko: '번지는 길 이름 앞에 와요.' };
    if (o.ko) return { en: 'Sorry — let me write that down. What\'s the room number first?', ko: '영어 주소는 방 번호부터 말해요.' };
    return { en: 'Sorry, could you say that again?', ko: '차례가 뒤섞여 알아듣기 어려워요.' };
  };
  BK.lineFacts = () => ({});
  function lineSegs(Lw) {
    const ws = Lw.words || Lw, W = ws.map(w => BK.OW[w]).filter(Boolean), out = [];
    W.forEach((x, i) => {
      if (i) out.push({ t: i === 1 && W[0].c === 'open' ? ' ' : ', ', r: 'frame' });
      if (x.c === 'open') out.push({ t: x.t, r: 'frame', part: 'open' });
      else out.push({ t: x.t, r: x.bad ? 'trap' : 'slot', part: x.c });
    });
    if (out.length) { out[0].t = out[0].t[0].toUpperCase() + out[0].t.slice(1); out.push({ t: '.', r: 'frame' }); }
    return out;
  }
  BK.lineSegs = lineSegs;
  BK.lineText = Lw => lineSegs(Lw).map(s => s.t).join('');
  BK.lineKo = function (Lw) {
    const W = (Lw.words || Lw).map(w => BK.OW[w]).filter(Boolean).filter(x => x.c !== 'open');
    return `주소는 ${W.map(x => x.ko).join(', ')}이에요.`;
  };
  /* =========================================================
     대답 틀 (frame). t: 틀 글 — ___ = 내 정보 칸, {…} = 공손한 말
     tag: ok · literal(한국어 그대로 · 콩글리시) · wrong(틀린 문장) · safe(비밀번호를 소리 내어 말함) · blunt(명령 · 따지기) · plain(고맙다는 말 없이 끊김)
     bare: Yes · No만 하는 대답(yes: true · false) · aux: 짧은 대답의 짝(do · be · is)
     half: 사실만 말하고 부탁 · 정보가 빠진 말 · check: 들은 값을 되짚어 확인하는 말 · skip: 되짚지 않고 넘어가는 말
     ========================================================= */
  BK.FRAME = {};
  const FR = (id, intent, t, ko, o = {}) => (BK.FRAME[id] = Object.assign({ id, intent, t, ko, tag: 'ok' }, o));
  // Yes · No만 하는 대답 (고르는 질문 · 정보 질문에는 ① 탈락)
  FR('g_yes', 'yn', 'Yes.', '네.', { bare: true, yes: true });
  FR('g_yesp', 'yn', 'Yes, {please}.', '네, 그렇게 해 주세요.', { bare: true, yes: true });
  FR('g_no', 'yn', 'No, {thanks}.', '아니요, 괜찮아요.', { bare: true, yes: false });
  // 용건 (내가 먼저): 부탁 틀 + 무엇을
  FR('nd_fx', 'need', 'I\'d like to change ___ into US dollars, {please}.', '___을 미국 달러로 바꾸고 싶어요.', { slot: 'won', fact: { task: 'fx' } });
  FR('nd_fxs', 'need', 'I\'d like to change some money, {please}.', '돈을 좀 바꾸고 싶어요.', { fact: { task: 'fx' } });
  FR('nd_fxgive', 'need', 'Change this into dollars.', '(명령) 이거 달러로 바꿔요.', { fact: { task: 'fx' }, tag: 'blunt', why: '명령처럼 들려요. 용건은 부탁 틀로 → I\'d like to change 300,000 won into US dollars, please.' });
  FR('nd_sim', 'need', 'I\'d like to get a SIM card for my phone, {please}.', '제 휴대폰에 넣을 유심(SIM 카드)을 사고 싶어요.', { fact: { task: 'sim' } });
  FR('nd_open', 'need', 'I want to open my phone.', '(어색한 말) 휴대폰을 개통하고 싶어요.', { fact: { task: 'sim' }, tag: 'literal', why: '‘개통’을 open으로 옮기면 ‘휴대폰을 열다(뜯다) · 잠금을 풀다’로 들려요. 번호를 받아 쓰려면 → I\'d like to get a SIM card for my phone, please.' });
  FR('nd_usim', 'need', 'USIM card, {please}.', '(어색한 말) 유심 카드 주세요.', { fact: { task: 'sim' }, tag: 'literal', why: '유심(USIM)은 한국에서 흔한 말이에요. 영어권 가게에서는 → a SIM card. 무엇을 하려는지도 부탁 틀로 → I\'d like to get a SIM card for my phone, please.' });
  FR('nd_acct', 'need', 'I\'d like to open a bank account, {please}.', '은행 계좌를 열고 싶어요.', { fact: { task: 'acct' } });
  FR('nd_book', 'need', 'I want to make a bankbook.', '(어색한 말) 통장을 만들고 싶어요.', { fact: { task: 'acct' }, tag: 'literal', why: '‘통장을 만들다’를 make a bankbook으로 옮겼어요. 영어로는 계좌를 연다고 해요 → I\'d like to open a bank account, please.' });
  FR('nd_half', 'need', 'I\'m an exchange student.', '저는 교환학생이에요.', { fact: { task: 'acct' }, half: true, why: '나에 대한 사실만 말하고 끝났어요. 무엇을 하러 왔는지(용건)를 부탁 틀로 덧붙여요 → I\'m an exchange student. I\'d like to open a bank account, please.' });
  FR('nd_make', 'need', 'Make me an account.', '(명령) 계좌 만들어 줘요.', { fact: { task: 'acct' }, tag: 'blunt', why: '명령처럼 들려요. 용건은 부탁 틀로 → I\'d like to open a bank account, please.' });
  // 바꿀 금액 · 지폐 · 받을 금액
  FR('mc_won', 'much', '___, {please}.', '___이요.', { slot: 'won' });
  FR('mc_man', 'much', '___, {please}.', '(어색한 말) ___이요.', { slot: 'won', form: 'man', tag: 'literal', why: '‘만’을 그대로 man으로 읽으면 알아듣지 못해요. 영어는 세 자리(천 thousand)씩 끊어요 → 300,000 = three hundred thousand won.' });
  FR('bl_pl', 'bills', '___ bills, {please}.', '___로 주세요.', { slot: 'bills' });
  FR('bl_paper', 'bills', '___ paper, {please}.', '(어색한 말) ___ 종이로 주세요.', { slot: 'bills', tag: 'literal', why: '‘지폐’를 paper로 옮기면 ‘종이’로 들려요. 지폐는 → bills (Small bills, please.)' });
  FR('gt_so', 'get', 'So, that\'s ___?', '그러니까 ___이죠?', { slot: 'usd', check: true });
  FR('gt_say', 'get', '{Sorry}, did you say ___?', '죄송한데, ___라고 하셨어요?', { slot: 'usd', check: true });
  FR('gt_ok', 'get', 'Okay. {Thanks}.', '알겠어요. 고마워요.', { skip: true, why: '고맙다고만 하면 받을 금액이 맞는지 확인하지 못해요. 큰 숫자는 되짚어 확인해요 → So, that\'s $240?' });
  // 서류 내밀기
  FR('id_here', 'id', '{Sure.} Here\'s ___.', '네. 여기 ___이요.', { slot: 'doc' });
  FR('id_have', 'id', 'I have passport.', '(틀린 말) 여권 있어요.', { fact: { doc: 'passport' }, tag: 'wrong', why: 'passport 앞에 my가 빠졌고, ‘있다’고만 해서 내미는 말이 아니에요. 서류를 건넬 때는 → Sure. Here\'s my passport.' });
  FR('sc_yes', 'second', 'Yes, I do. Here\'s ___.', '네, 있어요. 여기 ___이요.', { slot: 'doc', aux: 'do' });
  FR('sc_have', 'second', 'Yes, I have.', '(틀린 말) 네, 있어요.', { tag: 'wrong', why: 'have 뒤에 무엇이 있는지가 빠져 문장이 끝나지 않아요. Do you have …? 질문에는 → Yes, I do. Here\'s my student ID.' });
  FR('sc_am', 'second', 'Yes, I am.', '네, 그래요.', { aux: 'be' });
  FR('pf_yes', 'proof', 'Yes, I do. Here\'s ___.', '네, 있어요. 여기 ___이요.', { slot: 'doc', aux: 'do', fact: { proof: true } });
  FR('pf_ask', 'proof', 'No, I don\'t. {Would} a letter from my university {work}?', '아니요, 없어요. 학교 확인서도 될까요?', { aux: 'do', fact: { proof: false } });
  FR('pf_no', 'proof', 'No, I don\'t.', '아니요, 없어요.', { aux: 'do', fact: { proof: false }, half: true, why: '없다고만 하면 계좌를 열 수 없어요. 대신 낼 수 있는 서류를 질문으로 물어요 → No, I don\'t. Would a letter from my university work?' });
  FR('pf_dorm', 'proof', 'Yes. Here\'s my dormitory paper.', '(어색한 말) 네. 여기 기숙사 종이요.', { fact: { proof: true }, tag: 'literal', why: '‘기숙사 서류’를 dormitory paper로 옮기면 무슨 서류인지 알기 어려워요. 주소가 적힌 계약서는 → my housing contract.' });
  FR('su_yes', 'student', 'Yes, I am. I\'m an exchange student at Kellport University.', '네, 켈포트 대학교 교환학생이에요.', { aux: 'be', fact: { student: true } });
  FR('su_do', 'student', 'Yes, I do.', '네, 그래요.', { aux: 'do', fact: { student: true } });
  // 고르는 질문 · 정보 질문
  FR('ty_pl', 'type', '___, {please}.', '___으로 할게요.', { slot: 'acct' });
  FR('pl_pl', 'plan', '___, {please}.', '___로 할게요.', { slot: 'plan' });
  FR('dt_pl', 'data', '___, {please}.', '___로 할게요.', { slot: 'data' });
  FR('st_for', 'stay', 'For ___.', '___이요.', { slot: 'months' });
  FR('st_dur', 'stay', 'During ___.', '(어색한 말) ___ 동안이요.', { slot: 'months', tag: 'literal', why: '‘6개월 동안’의 ‘동안’을 during으로 옮겼어요. during 뒤에는 그때의 이름(my trip · the semester)이 와요. 숫자로 센 기간은 → For six months.' });
  // 값
  FR('co_card', 'cost', 'Can I pay by card?', '카드로 내도 돼요?', { fact: { paym: 'card' } });
  FR('co_here', 'cost', 'Here you go.', '여기요.', { fact: { paym: 'cash' } });
  FR('co_say', 'cost', '{Sorry}, did you say ___?', '죄송한데, ___라고 하셨어요?', { slot: 'money', check: true });
  FR('co_lit', 'cost', 'Card is okay?', '(어색한 말) 카드 돼요?', { fact: { paym: 'card' }, tag: 'literal', why: '‘카드 돼요?’를 낱말 그대로 옮긴 말이라 무엇이 괜찮은지 알기 어려워요. 카드로 내도 되는지 물을 때는 → Can I pay by card?' });
  // 유심 · 새 번호
  FR('ul_yes', 'unlock', 'Yes, it is.', '네, 해제돼 있어요.', { aux: 'is', fact: { unlocked: true } });
  FR('ul_no', 'unlock', 'No, it isn\'t.', '아니요, 안 돼 있어요.', { aux: 'is', fact: { unlocked: false } });
  FR('ul_am', 'unlock', 'Yes, I am.', '네, 그래요.', { aux: 'be', fact: { unlocked: true } });
  FR('nb_so', 'number', 'So, it\'s ___?', '그러니까 ___이죠?', { slot: 'phone', check: true });
  FR('nb_big', 'number', 'So, it\'s ___?', '(어색한 말) 그러니까 ___이죠?', { slot: 'phone', form: 'big', check: true, tag: 'literal', why: '전화번호를 큰 수처럼(five hundred fifty-five) 읽으면 알아듣기 어려워요. 번호는 한 자리씩 묶음으로 → five-five-five, oh-one-four-seven (0은 oh).' });
  FR('nb_ok', 'number', 'Okay. {Thanks}.', '알겠어요. 고마워요.', { skip: true, why: '고맙다고만 하면 번호를 제대로 받아 적었는지 확인하지 못해요. 새 번호는 은행 서류에도 써야 하니 되짚어요 → So, it\'s 555-0147?' });
  FR('tu_no', 'topup', 'No, {thanks}. I\'ll top it up myself.', '아니요, 괜찮아요. 제가 직접 충전할게요.', { fact: { auto: false } });
  FR('tu_charge', 'topup', 'No. I\'ll charge it myself.', '(어색한 말) 아니요. 제가 충전할게요.', { fact: { auto: false }, tag: 'literal', why: '요금 ‘충전’을 charge로 옮기면 배터리 충전이나 ‘요금을 물리다’로 들려요. 요금을 채우는 것은 → top up (미국에서는 add money · refill도).' });
  // 주소 · 연락처 · 서명
  FR('line', 'addr', '', '', { line: true });   // 주소 한 줄 (BK.checkLine)
  FR('ad_dorm', 'addr', 'I live in a dormitory.', '기숙사에 살아요.', { half: true, why: '사는 곳의 종류만 말했어요. 서류에 적을 주소를 작은 곳에서 큰 곳으로 → It\'s Room 412, Maple Hall, 200 College Avenue, Kellport, 40213.' });
  FR('ph_is', 'phone', 'It\'s ___.', '___이에요.', { slot: 'phone' });
  FR('ph_big', 'phone', 'It\'s ___.', '(어색한 말) ___이에요.', { slot: 'phone', form: 'big', tag: 'literal', why: '전화번호를 큰 수처럼(five hundred fifty-five) 읽으면 알아듣기 어려워요. 번호는 한 자리씩 묶음으로 → five-five-five, oh-one-four-seven.' });
  FR('sg_ok', 'sign', '{Sure.} Right here?', '네. 여기요?', {});
  FR('sg_lit', 'sign', 'Okay. I\'ll do my sign.', '(어색한 말) 네. 제 사인을 할게요.', { tag: 'literal', why: '‘사인’을 sign으로 옮겨 my sign이라고 하면 ‘내 간판 · 내 별자리’로 들려요. 서명은 → signature, 서명하다는 → sign (Sure. Right here?).' });
  // 카드 · 비밀번호 · 마무리
  FR('db_check', 'debit', 'Yes, a check card, {please}.', '(어색한 말) 네, 체크카드 주세요.', { fact: { debit: true }, tag: 'literal', why: '‘체크카드’는 한국에서 만든 말이에요. 계좌의 돈이 바로 빠져나가는 카드는 → a debit card (Yes, please.).' });
  FR('pn_ok', 'pin', 'Okay. {Thank you}.', '네. 고마워요.', {});
  FR('pn_say', 'pin', 'It\'s ___.', '___이에요.', { slot: 'pin', tag: 'safe', why: '비밀번호(PIN)는 소리 내어 말하지 않아요. 직원도 말로 묻지 않고, 숫자판에 직접 눌러요. 누가 말로 알려 달라고 하면 → I\'d rather not say it out loud.' });
  FR('el_atm', 'else', 'Yes. {Could you} tell me where the nearest ATM is?', '네. 가장 가까운 ATM이 어디 있는지 알려 주시겠어요?', { fact: { ask: 'atm' } });
  FR('el_no', 'else', 'No, that\'s everything. {Thank you}!', '아니요, 그거면 다 됐어요. 고마워요!', { fact: { ask: null } });
  FR('el_plain', 'else', 'No.', '아니요.', { fact: { ask: null }, tag: 'plain', why: '그냥 No.라고 끊으면 무뚝뚝하게 들려요. 도와준 직원에게는 → No, that\'s everything. Thank you!' });
  FR('el_where', 'else', 'Where is ATM?', '(퉁명스러운 말) ATM 어디예요?', { fact: { ask: 'atm' }, tag: 'blunt', why: '묻는 말만 툭 던지면 퉁명스럽게 들려요(the도 빠졌어요). 부탁은 질문 틀로 → Could you tell me where the nearest ATM is?' });
  // 다시 묻기. echo: 들린 만큼 되묻는 말 — 실제로 들은 말이어야 통과 · what: 모르는 낱말 묻기(allow)
  FR('rp_again', 'repair', '{Sorry? Could you} say that again, {please}?', '죄송한데, 다시 한 번 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_sorry', 'repair', '{Sorry}?', '네? (다시 말해 달라는 뜻)', { kind: 'again' });
  FR('rp_slow', 'repair', '{Could you} say that more slowly, {please}?', '조금 더 천천히 말씀해 주시겠어요?', { kind: 'slow' });
  FR('rp_need', 'repair', '{Sorry}, did you ask what I need?', '죄송한데, 무엇이 필요한지 물으셨어요?', { kind: 'echo', echo: 'need' });
  FR('rp_data', 'repair', '{Sorry}, how much data?', '죄송한데, 데이터가 얼마나요?', { kind: 'echo', echo: 'data' });
  FR('rp_num', 'repair', '{Sorry, could you} say the number again, slowly?', '죄송한데, 번호를 천천히 다시 말씀해 주시겠어요?', { kind: 'echo', echo: 'number' });
  FR('rp_id', 'repair', '{Sorry}, did you ask for my ID?', '죄송한데, 신분증을 달라고 하셨어요?', { kind: 'echo', echo: 'id' });
  FR('rp_addr', 'repair', '{Sorry}, did you ask for my address?', '죄송한데, 주소를 물으셨어요?', { kind: 'echo', echo: 'addr' });
  FR('rp_wtop', 'repair', '{Sorry}, what does top-up mean?', '죄송한데, top-up이 무슨 뜻이에요?', { kind: 'what' });
  FR('rp_rude', 'repair', 'What?', '(퉁명스러운 말) 뭐라고요?', { kind: 'again', tag: 'blunt', why: 'What? 한 낱말은 퉁명스럽게 들릴 수 있어요. 못 알아들었으면 → Sorry? Could you say that again, please?' });

  /* ---------- 대답 글 만들기: 조각(segs) = [{ t, r: 'frame' | 'slot' | 'pol' }] ---------- */
  const slotText = (F, v) => { const x = BK.sv(F.slot, v); if (!x) return '___'; if (F.form === 'man') return x.man || x.t; return x[F.form || 't'] != null ? x[F.form || 't'] : x.t; };
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
  BK.segs = function (a) {
    const F = BK.FRAME[a.f];
    if (F.line) return lineSegs(a.line);
    return frameSegs(F, a.v);
  };
  BK.text = a => BK.segs(a).map(s => s.t).join('');
  // 해석
  const koOf = (F, v) => {
    if (!F.slot) return F.ko;
    const x = BK.sv(F.slot, v), k = x ? x.ko : '___';
    return F.ko.replace('___으로', ro(k)).replace('___로', ro(k)).replace('___이에요', ieyo(k)).replace('___이요', /요$/.test(k) ? k : k + (has(k) ? '이요' : '요')).replace('___이죠', k + (has(k) ? '이죠' : '죠')).replace('___을', eul(k)).replace('___', k);
  };
  BK.ko = function (a) {
    const F = BK.FRAME[a.f];
    if (F.line) return BK.lineKo(a.line);
    return koOf(F, a.v);
  };
  // 대답이 말하는 사실
  BK.factOf = function (a) {
    const F = BK.FRAME[a.f], f = Object.assign({}, F.fact || {});
    if (F.slot && BK.sv(F.slot, a.v)) Object.assign(f, valFact(F.slot, a.v));
    return f;
  };
  // 사실을 한국어로
  const TASK = { fx: '돈 바꾸기(환전)', sim: '유심 사기 · 개통', acct: '계좌 열기' };
  BK.factKo = function (k, v) {
    if (k === 'task') return TASK[v] || String(v);
    if (k === 'won') return BK.wonKo(v);
    if (k === 'usd' || k === 'amount') return `${BK.money(v)} (${BK.priceWords(v)})`;
    if (k === 'bills') return BK.BILLS[v] ? BK.BILLS[v].ko : String(v);
    if (k === 'doc') return BK.DOCS[v] ? BK.DOCS[v].ko : String(v);
    if (k === 'proof') return v ? '주소 증명 서류(기숙사 계약서) 있음' : '주소 증명 서류 없음(학교 확인서는 있음)';
    if (k === 'student') return v ? '학생' : '학생 아님';
    if (k === 'plan') return BK.PLANS[v] ? BK.PLANS[v].ko : String(v);
    if (k === 'data') return BK.DATA[v] ? BK.DATA[v].ko : String(v);
    if (k === 'stay') return BK.MONTHS_STAY[v] ? `${BK.MONTHS_STAY[v].ko} 머묾` : String(v);
    if (k === 'paym') return v === 'card' ? '카드로 내기' : '현금으로 내기';
    if (k === 'unlocked') return v ? '잠금 해제됨' : '잠금 해제 안 됨';
    if (k === 'phone') return `${v} (${BK.digits(v)})`;
    if (k === 'auto') return v ? '자동 충전 함' : '자동 충전 안 함(직접 충전)';
    if (k === 'acct') return BK.SLOT.acct.vals[v] ? BK.SLOT.acct.vals[v].ko : String(v);
    if (k === 'debit') return v ? '직불 카드 필요' : '직불 카드 필요 없음';
    if (k === 'pin') return '비밀번호';
    if (k === 'ask') return v ? '가장 가까운 ATM 위치 묻기' : '물어볼 것 없음';
    if (k === 'addr') return BK.addrEn(v);
    const S = Object.values(BK.SLOT).find(s => s.key === k && s.vals && s.vals[v]);
    return S ? S.vals[v].ko : String(v);
  };

  /* ---------- 이미 답한 질문 (시뮬레이터의 상대가 건너뜀) — 용건에 금액까지 말하면 ‘얼마’ 질문은 건너뜀 ---------- */
  BK.coveredBy = (facts, intent) => (intent ? [intent] : []).concat(intent === 'need' && facts.won != null ? ['much'] : []);
  BK.covered = (a, q) => { if (typeof q === 'string') q = BK.Q[q]; return BK.coveredBy(BK.factOf(a), q.intent); };
  BK.coveredKo = cov => cov.filter(x => x === 'much').map(() => '바꿀 금액');

  /* =========================================================
     판정 — BK.judge(상대의 말, 대답, 카드, 출처)
     q: BK.Q의 말(또는 id) · a: { f: 틀 id, v: 칸 값, line } · card: 사실 · src: '카드' | '상황'
     ========================================================= */
  const res = (ok, stage, why, tag) => ({ ok, stage, why, tag: tag || (ok ? 'ok' : '') });
  const shapeHead = q => `${q.key.join(' … ')} → ${BK.SHAPE[q.shape].ko}`;
  BK.judge = function (q, a, card, src = '카드') {
    if (typeof q === 'string') q = BK.Q[q];
    const F = BK.FRAME[a.f], C = Object.assign({}, card || {}, q.fact || {});
    const fi = [].concat(F.intent), key = q.key.join(' … '), In = BK.INTENT[q.intent], SHp = BK.SHAPE[q.shape];
    let allowed = false;
    const notes = [];
    // ① 열쇠 낱말 + 질문의 모양 잡기
    if (q.fast) {
      if (F.intent !== 'repair') return res(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 말했는지 모르는데 짐작해서 답하면 엉뚱한 대답이 될 수 있어요. 먼저 다시 물어요.', 'guess');
      if (F.kind === 'echo' && F.echo !== q.intent) return res(false, 1, `되물은 말이 달라요. 들린 낱말(${key})로 보면 상대는 ${In.turn}에 대해 말했어요.`, 'intent');
      if (F.kind === 'what') return res(false, 1, '모르는 낱말을 묻는 말이에요. 무엇을 말했는지 못 알아들었으면 다시 말해 달라고 해요.', 'intent');
    } else if (F.bare) {
      if (q.shape === 'or') return res(false, 1, `${shapeHead(q)}. 둘 가운데 하나를 고르라는 말이라 ${F.yes ? 'Yes' : 'No'}만으로는 무엇을 골랐는지 알 수 없어요 → ${In.want}`, 'shape');
      if (q.shape === 'wh') return res(false, 1, `${shapeHead(q)}. 정보를 묻는 말이라 ${F.yes ? 'Yes' : 'No'}로는 답이 안 돼요 → ${In.want}`, 'shape');
      if (q.shape === 'note') return res(false, 1, `열쇠 낱말 ${key} → ${BK.sayOf(q.intent)}. 묻는 말이 아니라서 ${F.yes ? 'Yes' : 'No'}로 답할 일이 아니에요 → ${In.want}`, 'shape');
    } else if (!fi.includes(q.intent)) {
      if (F.intent === 'repair' && q.allow && q.allow.includes(F.id)) allowed = true;
      else if (F.intent === 'repair') return res(false, 1, '대답이 아니라 다시 묻는 말이에요. 알아들었다면 바로 답해요.', 'intent');
      else {
        const other = BK.INTENT[fi[0]];
        return res(false, 1, `${shapeHead(q)}${q.shape === 'note' ? '' : `(${SHp.ans})`}. 이 대답은 ${other.ans}에 맞는 말이에요.`, 'intent');
      }
    }
    // 고르는 질문: 상대가 말한 것 가운데 골랐나
    const fact = BK.factOf(a);
    if (q.shape === 'or' && q.choices && !F.bare && F.intent !== 'repair' && In.key) {
      const v = fact[In.key];
      if (v != null && !q.choices.includes(v)) return res(false, 1, `${shapeHead(q)}. 상대가 말한 것(${q.choices.map(c => BK.factKo(In.key, c)).join(' · ')}) 가운데 하나를 골라요. ${eun(BK.factKo(In.key, v))} 묻지 않았어요.`, 'choice');
    }
    if (F.line) { const o = BK.checkLine(a.line, C); if (!o.ok && o.stage === 1) return res(false, 1, o.why, 'intent'); }
    // ② 틀에 내 정보 넣기
    if (F.tag === 'literal' || F.tag === 'wrong' || F.tag === 'safe') return res(false, 2, F.why, F.tag);
    if (F.aux && q.aux && F.aux !== q.aux) return res(false, 2, `${BK.AUX[q.aux].q} 질문에는 첫 낱말의 짝으로 답해요 → ${BK.AUX[q.aux].a} 이 대답(${BK.text(a)})은 ${BK.AUX[F.aux].q} 질문의 짝이에요.`, 'wrong');
    const sv = F.slot ? BK.sv(F.slot, a.v) : null;
    if (F.slot && !sv) return res(false, 2, '칸이 비었어요.', 'fact');
    if (sv && sv.bad) return res(false, 2, sv.why, sv.bad);
    if (F.bare) {
      const Y = In.yn, want = Y && Y.yes ? Y.yes(C) : null;
      if (want != null && want !== F.yes) return res(false, 2, `${wa(src)} 달라요. ${src}: ${F.yes ? 'No' : 'Yes'} 쪽이에요(${In.turn}). 이 대답: ${F.yes ? 'Yes' : 'No'}.`, 'fact');
      if (F.yes && Y && Y.strict) return res(false, 2, Y.strict, 'need');
      if (!F.yes && Y && Y.noStrict) return res(false, 2, Y.noStrict, 'need');
      if (Y && Y.need && F.yes === !!(Y.yes && Y.yes(C))) notes.push(Y.need);
      if (q.aux) notes.push(`짝 맞는 짧은 대답도 좋아요 → ${BK.AUX[q.aux].a}`);
    }
    if (F.line) { const o = BK.checkLine(a.line, C); if (!o.ok) return res(false, 2, o.why, o.tag || 'order'); }
    // 서류: 주소 증명에는 주소가 적힌 서류(기숙사 계약서) · 여권을 달라면 여권 · 두 번째 신분증은 학생증
    if (fact.doc && q.intent === 'proof' && fact.doc !== 'lease') return res(false, 2, `${BK.factKo('doc', fact.doc)}에는 지금 사는 주소가 없어요. 주소 증명은 주소가 적힌 서류 → my housing contract. 없으면 → No, I don't. Would a letter from my university work?`, 'fact');
    if (F.check) {
      for (const k of Object.keys(fact)) if (C[k] != null && fact[k] !== C[k]) return res(false, 2, `들은 값과 달라요. 상대: ${BK.factKo(k, C[k])} · 이 대답: ${BK.factKo(k, fact[k])}.` + (k === 'usd' || k === 'amount' ? ' -teen과 -ty는 헷갈리기 쉬워요. 뒤가 세면 fourTEEN, 앞이 세면 FORty.' : k === 'phone' ? ' 번호는 한 자리씩 받아 적어요.' : ''), 'fact');
    } else {
      for (const k of Object.keys(fact)) {
        if (C[k] === undefined || C[k] === fact[k]) continue;
        if (k === 'won') return res(false, 2, `${wa(src)} 달라요. ${src}: ${BK.factKo(k, C[k])} · 이 대답: ${BK.factKo(k, fact[k])}. 만은 ten thousand예요 — 세 자리씩 끊으면 ${BK.comma(C[k])} = ${BK.bigWords(C[k])}.`, 'fact');
        return res(false, 2, `${wa(src)} 달라요. ${src}: ${BK.factKo(k, C[k])} · 이 대답: ${BK.factKo(k, fact[k])}.`, 'fact');
      }
    }
    if (F.skip || F.half) return res(false, 2, F.why, 'need');
    // ③ 공손하게 끝내기
    if (F.tag === 'blunt' || F.tag === 'plain') return res(false, 3, F.why, F.tag);
    // 통과
    const segs = BK.segs(a), pol = segs.filter(s => s.r === 'pol').map(s => s.t).filter((x, i, arr) => arr.indexOf(x) === i);
    let why;
    if (q.fast) why = F.kind === 'echo' ? '들린 만큼 되물어 확인했어요. 무엇에 대해 말했는지 알면 그 부분만 다시 물을 수 있어요.' : F.kind === 'slow' ? '천천히 말해 달라고 공손하게 부탁했어요.' : '못 알아들었을 때는 짐작하지 말고 공손하게 다시 물어요.';
    else if (allowed) why = '모르는 낱말은 짐작하지 말고 물어요. 상대가 쉬운 말로 다시 알려 줄 거예요.';
    else if (F.line) why = `${BK.checkLine(a.line, C).why} 직원이 서류에 그대로 받아 적을 수 있어요.`;
    else if (F.check) why = `들은 값(${Object.keys(fact).map(k => BK.factKo(k, fact[k])).join(' · ')})과 같아요. 큰 숫자 · 번호는 이렇게 되짚어 확인해요.`;
    else if (F.bare) why = `${shapeHead(q)} → ${SHp.ans}. ${In.offer ? '권하거나 부탁하는 말이라' : 'Yes/No 질문이라'} ${F.yes ? 'Yes' : 'No'}로 답할 수 있어요.`;
    else {
      const sl = segs.filter(s => s.r === 'slot').map(s => s.t), fk = Object.keys(fact).filter(k => fact[k] != null && k !== 'task');
      why = `${shapeHead(q)} → ${SHp.ans}. ` + (F.aux && q.aux ? `${BK.AUX[q.aux].q} → 짝 맞는 대답(${BK.AUX[q.aux].a}). ` : '') + (sl.length ? `틀 + 내 정보(${sl.join(' ')}) → ${src}의 사실과 맞아요.` : fk.length ? `${src}의 사실(${fk.map(k => BK.factKo(k, fact[k])).join(' · ')})과 맞아요.` : '짧은 대답이면 충분해요.');
      if (q.intent === 'need') why += ' 부탁 틀(I\'d like to …) + 용건 → 무엇을 하러 왔는지 바로 알 수 있어요.';
      if (q.intent === 'proof' && fact.proof === false) why += ' 사실(없어요) + 부탁(질문) → 대신 낼 서류를 물었어요.';
      if (q.shape === 'yn' && In.offer && !/^(Yes|No)\b/.test(BK.text(a))) why += ` ${SHp.offer}.`;
    }
    if (pol.length) why += ` 공손한 말 → ${pol.join(' · ')}.`;
    notes.forEach(n => { why += ` ${n}`; });
    if (F.note) why += ` ${F.note}`;
    if (sv && sv.note) why += ` ${sv.note}`;
    return res(true, 0, why);
  };
  // 모범 대답 (카드에 맞춰)
  const ECHO_OF = { need: 'rp_need', data: 'rp_data', number: 'rp_num', id: 'rp_id', addr: 'rp_addr' };
  BK.model = function (q, card) {
    if (typeof q === 'string') q = BK.Q[q];
    const C = Object.assign({}, card || {}, q.fact || {});
    if (q.fast) return { f: ECHO_OF[q.intent] || 'rp_again' };
    if (q.intent === 'addr') return BK.modelLine(BK.addrOf(C));
    const In = BK.INTENT[q.intent], id = typeof In.best === 'function' ? In.best(C, q) : In.best, F = BK.FRAME[id];
    if (id === 'nd_fx' && C.won == null) return { f: 'nd_fxs' };
    if (!F.slot) return { f: id };
    const v = BK.slotVal(F.slot, C, q);
    return { f: id, v: v != null ? String(v) : (BK.SLOT[F.slot].dyn ? undefined : slotIds(F.slot)[0]) };
  };
  // 주소 한 줄의 모범
  BK.modelLine = A => ({ f: 'line', line: { words: BK.lineWords(A) } });

  /* =========================================================
     소리로 한 대답 맞춰 보기 — BK.matchSpoken(들린 글, 말, 카드)
     음성 인식이 글로 바꾼 말에 그 말의 표시 낱말과 카드의 사실이 들어 있으면 받아들여요.
     질문의 모양 규칙은 같아요: 고르는 질문 · 정보 질문에 yes · no만 들리면 ①. 숫자는 낱말(three hundred thousand · five five five)이든 숫자든 같게 맞춰요.
     주소는 들린 조각을 차례대로 모아 BK.checkLine으로 맞춰 봐요. 문법 · 공손함 · 발음은 판정하지 않아요(알림만 붙여요).
     ========================================================= */
  const CONTR = [[/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\bwhat's\b/g, 'what is'], [/\bdon't\b/g, 'do not'], [/\bdidn't\b/g, 'did not'], [/\bi've\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\bcan't\b/g, 'cannot'], [/\bi'd\b/g, 'i would'], [/\byou're\b/g, 'you are'], [/\bthat's\b/g, 'that is'], [/\bthere's\b/g, 'there is'], [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bdoesn't\b/g, 'does not'], [/\bhaven't\b/g, 'have not'], [/\bwon't\b/g, 'will not'], [/\bhere's\b/g, 'here is'], [/\blet's\b/g, 'let us'], [/\bnumber's\b/g, 'number is']];
  BK.norm = function (s) {
    let t = String(s || '').toLowerCase().replace(/[’‘]/g, '\'');
    CONTR.forEach(([r, w]) => { t = t.replace(r, w); });
    t = t.replace(/(\d),(\d{3})/g, '$1$2').replace(/(\d),(\d{3})/g, '$1$2').replace(/\$/g, ' ').replace(/(\d)\.(\d)/g, '$1 $2').replace(/%/g, ' percent ').replace(/[^a-z0-9' -]+/g, ' ').replace(/-/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '')
      .replace(/\b(gigabytes?|gigs?)\b/g, 'gb').replace(/\bid card\b/g, 'id').replace(/\btop up\b/g, 'topup');
    return t.split(/\s+/).filter(Boolean);
  };
  const W2N = {}; Object.entries(NUMW).forEach(([n, w]) => { W2N[w] = +n; });
  const MULT = { hundred: 100, thousand: 1000, million: 1000000 };
  // 숫자 덩어리 하나 → 숫자 글: 곱하는 말(hundred · thousand · million)이 있으면 더해서(two hundred forty → 240),
  // 없으면 이어 붙여서(five five five oh one four seven → 5550147 · four twelve → 412 · 555 0147 → 5550147)
  const phraseNum = P => {
    if (P.some(x => MULT[x])) {
      let total = 0, cur = 0;
      P.forEach(x => {
        if (x === 'hundred') cur = (cur || 1) * 100;
        else if (x === 'thousand' || x === 'million') { total += (cur || 1) * MULT[x]; cur = 0; }
        else if (/^\d+$/.test(x)) cur += +x;
        else if (W2N[x] != null) cur += W2N[x];
      });
      return String(total + cur);
    }
    let out = '';
    for (let i = 0; i < P.length; i++) {
      const x = P[i];
      if (/^\d+$/.test(x)) { out += x; continue; }
      if (x === 'oh' || x === 'o') { out += '0'; continue; }
      const n = W2N[x];
      if (n >= 20 && n % 10 === 0 && W2N[P[i + 1]] > 0 && W2N[P[i + 1]] < 10) { out += String(n + W2N[P[i + 1]]); i++; continue; }
      out += String(n);
    }
    return out;
  };
  // 낱말 → 숫자 덩어리로 모음. 조각마다 원래 낱말 번호(i)를 따라가요 (따라 말하기의 낱말 색칠)
  const canonCore = R => {
    const out = [];
    let P = null, I = null;
    const isNum = (x, k) => /^\d+$/.test(x) || W2N[x] != null || MULT[x] || ((x === 'oh' || x === 'o') && P) || (x === 'a' && R[k + 1] && MULT[R[k + 1].x]) || (x === 'and' && P && P.some(y => MULT[y]) && R[k + 1] && (W2N[R[k + 1].x] != null || /^\d+$/.test(R[k + 1].x)));
    const flush = () => { if (P) { out.push({ p: phraseNum(P), ws: I }); P = null; I = null; } };
    R.forEach((r, k) => {
      if (isNum(r.x, k)) { if (r.x === 'and') return; (P = P || []).push(r.x === 'a' ? 'one' : r.x); (I = I || []).push(r.i); }
      else { flush(); out.push({ p: r.x, ws: [r.i] }); }
    });
    flush();
    return out;
  };
  BK.canon = s => canonCore(BK.norm(s).map(x => ({ x, i: 0 }))).map(o => o.p);
  const runs = toks => toks.filter(t => /^\d+$/.test(t));
  // 들린 원: 숫자 뒤에 won → 그 숫자 · ‘만’을 man으로 읽은 말이면 { man: true }
  const heardWon = toks => { if (toks.includes('man')) return { man: true }; const i = toks.findIndex((t, k) => /^\d+$/.test(t) && (toks[k + 1] === 'won' || +t >= 10000)); return i < 0 ? null : { won: +toks[i] }; };
  // 들린 달러 (센트): 240 dollars → 24000 · and 30 cents
  const heardUsd = toks => { const i = toks.findIndex(t => /^\d+$/.test(t)); if (i < 0) return null; let c = +toks[i] * 100; const j = toks.indexOf('cents'); if (j > 0 && /^\d+$/.test(toks[j - 1]) && j - 1 !== i) c += +toks[j - 1]; return c; };
  // 들린 번호: 일곱 자리 → 555-0147 꼴
  const heardPhone = toks => { const r = runs(toks).join(''); const m = /(\d{7})/.exec(r); return m ? m[1].slice(0, 3) + '-' + m[1].slice(3) : null; };
  const BARE_RE = /^(yes|yeah|yep|no|nope|please|sure|thanks|thank|you|okay|ok|of|course|it|is|i|do|am|not|that|would|like|great|uh|um|well)$/;
  const REPAIR_RE = /\b(say that again|pardon|repeat|more slowly|slow down|sorry what|come again)\b|^ ?sorry ?$/;
  // 주소 말에서 조각 모으기 → 줄 낱말 (들린 차례대로)
  BK.parseLine = function (raw) {
    const s = ' ' + BK.canon(raw).join(' ') + ' ', hits = [];
    const scan = (re, fn) => { re.lastIndex = 0; let m; while ((m = re.exec(s))) { const w = fn(m); if (w) hits.push([m.index, w]); } };
    scan(/\b(room|apartment|apt|number) (\d{3})\b/g, m => BK.OW['r' + m[2]] ? 'r' + m[2] : null);
    BK.HALL_IDS.forEach(h => scan(new RegExp('\\b' + h + '( hall)?\\b', 'g'), () => h));
    scan(/\b(\d{3}) college (avenue|ave)\b/g, m => BK.OW['s' + m[1]] ? 's' + m[1] : null);
    scan(/\bcollege (avenue|ave) (\d{3})\b/g, m => BK.OW['k' + m[2]] ? 'k' + m[2] : null);
    scan(/\b(\d{5})\b/g, m => BK.OW['z' + m[1]] ? 'z' + m[1] : null);
    hits.sort((a, b) => a[0] - b[0]);
    const ws = hits.map(h => h[1]).filter((w, i, a) => a.indexOf(w) === i);
    return (/^ (it is|my address is|its)\b/.test(s) ? ['its'] : []).concat(ws);
  };
  BK.matchSpoken = function (raw, q, card) {
    if (typeof q === 'string') q = BK.Q[q];
    const toks = BK.canon(raw), s = ' ' + toks.join(' ') + ' ', heard = BK.norm(raw).join(' ');
    if (!toks.length) return { ok: false, stage: 0, why: '들린 말이 없어요. 다시 말해 보세요.', heard: '' };
    const C = Object.assign({}, card || {}, q.fact || {}), SHp = BK.SHAPE[q.shape], It = BK.INTENT[q.intent];
    const R = (ok, stage, why, o = {}) => Object.assign({ ok, stage, why, heard }, o);
    const notes = [];
    const pass = (why, cov) => R(true, 0, why + (notes.length ? ' 알림: ' + notes.join(' ') : ''), { note: notes.join(' '), covered: cov || [q.intent] });
    const keyMiss = () => R(false, 1, `${shapeHead(q)}(${SHp.ans}). 들린 말에 그 대답이 없어요.`);
    const differ = (k, v) => R(false, 2, `카드와 달라요. 카드: ${BK.factKo(k, C[k])} · 들린 말: ${BK.factKo(k, v)}.`, { tag: 'fact' });
    const lit = id => R(false, 2, BK.FRAME[id].why, { tag: 'literal' });
    // 빠른 말: 다시 묻는 말만 (들린 만큼 되묻는 말은 실제 말과 같아야)
    if (q.fast) {
      const echo = /\b(how much data|data)\b/.test(s) ? 'data' : /\bnumber\b/.test(s) ? 'number' : /\b(my id|for id|passport)\b/.test(s) ? 'id' : /\baddress\b/.test(s) ? 'addr' : /\b(what i need|what do i need|help)\b/.test(s) ? 'need' : null;
      if (echo) return echo === q.intent ? R(false, 1, '들린 만큼 되물었어요. 상대가 다시 말해 줄 거예요.', { repair: 'again' }) : R(false, 1, `되물은 말이 달라요. 들린 낱말(${q.key.join(' … ')})로 보면 상대는 ${It.turn}에 대해 말했어요.`);
      if (REPAIR_RE.test(s) || /\b(sorry|again|slowly)\b/.test(s)) return R(false, 1, '다시 묻는 말로 들었어요. 상대가 한 번 더 말해 줄 거예요.', { repair: 'again' });
      return R(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 짐작해서 답하지 말고 먼저 다시 물어요 → Sorry? Could you say that again, please?');
    }
    // 모르는 낱말 묻기 (top-up)
    if (q.allow && /\bwhat (does|is) topup\b|\btopup mean\b/.test(s)) return R(false, 1, '모르는 낱말을 물었어요. 상대가 쉬운 말로 알려 줄 거예요.', { repair: 'what' });
    // 들은 값을 되묻는 말 (값 → 다시 들은 뒤 내는 방법)
    if (/\b(did you say|was that|is that)\b/.test(s) && runs(toks).length && q.intent === 'cost') {
      const amt = heardUsd(toks), want = C.amount;
      if (want != null && amt !== want) return R(false, 2, `상대가 말한 값과 달라요. 상대: ${BK.factKo('amount', want)} · 들린 말: ${BK.factKo('amount', amt)}.`, { tag: 'fact' });
      return R(false, 1, '들은 값을 되물어 확인했어요. 상대가 맞다고 할 거예요.', { repair: 'check' });
    }
    if ((REPAIR_RE.test(s) || /\b(could you say|say again)\b/.test(s)) && toks.length <= 9) return R(false, 1, '다시 묻는 말로 들었어요. 상대가 한 번 더 말해 줄 거예요.', { repair: 'again' });
    if (/\b(give me|i want|make me)\b/.test(s)) notes.push('Give me · I want는 명령하거나 조르는 말처럼 들려요(말로 한 대답은 말투를 판정하지 않아요) → I\'d like to …, please.');
    const bare = toks.every(t => BARE_RE.test(t)) && /\b(yes|yeah|yep|no|nope|sure|okay|ok)\b/.test(s);
    const yesHeard = /\b(yes|yeah|yep|sure|okay|ok)\b/.test(s), noHeard = /\b(no|nope)\b/.test(s);
    if (bare && (q.shape === 'or' || q.shape === 'wh')) return R(false, 1, `${shapeHead(q)}. ${q.shape === 'or' ? '둘 가운데 하나를 고르라는 말이라 yes · no만으로는 무엇을 골랐는지 알 수 없어요' : '정보를 묻는 말이라 yes · no로는 답이 안 돼요'} → ${It.want}`, { tag: 'shape' });
    if (bare && q.shape === 'note' && !/^(sign|pin)$/.test(q.intent)) return R(false, q.intent === 'get' || q.intent === 'number' ? 2 : 1, q.intent === 'get' ? BK.FRAME.gt_ok.why : q.intent === 'number' ? BK.FRAME.nb_ok.why : `열쇠 낱말 ${q.key.join(' … ')} → ${BK.sayOf(q.intent)} → ${It.want}`, { tag: q.intent === 'get' || q.intent === 'number' ? 'need' : 'shape' });
    if (q.shape === 'or' && yesHeard && !bare) notes.push('고르는 질문에는 Yes 없이 고른 것만 말해도 돼요.');
    const auxNote = () => { if (!q.aux) return; const said = /\b(i|it) (do|am|is)( not)?\b/.exec(s); const map = { do: 'do', am: 'be', is: 'is' }; if (said && map[said[2]] !== q.aux) notes.push(`${BK.AUX[q.aux].q} 질문의 짧은 대답은 → ${BK.AUX[q.aux].a}(말로 한 대답은 문법을 판정하지 않아요)`); };
    const yn = (k, v, okWhy) => { if (C[k] != null && v !== !!C[k]) return differ(k, v); auxNote(); return pass(okWhy); };
    const wonCheck = (w, after) => {
      if (w.man) return lit('mc_man');
      if (C.won != null && w.won !== C.won) return R(false, 2, `카드와 달라요. 카드: ${BK.factKo('won', C.won)} · 들린 말: ${BK.factKo('won', w.won)}. 만은 ten thousand예요 — 세 자리씩 끊으면 ${BK.comma(C.won)} = ${BK.bigWords(C.won)}.`, { tag: 'fact' });
      return after();
    };
    switch (q.intent) {
      case 'need': {
        const task = q.fact && q.fact.task;
        if (task === 'fx') {
          const w = heardWon(toks);
          if (!/\b(change|exchange|swap)\b/.test(s) && !w) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : /\b(account|sim|phone)\b/.test(s) ? R(false, 2, '상황과 달라요. 여기는 환전 창구예요.', { tag: 'fact' }) : keyMiss();
          if (w) return wonCheck(w, () => pass('바꿀 금액과 용건이 들렸고 카드와 맞아요.', ['need', 'much']));
          return pass('돈을 바꾸고 싶다는 용건이 들렸어요.');
        }
        if (task === 'sim') {
          if (/\bopen (my|the) phone\b/.test(s)) return lit('nd_open');
          if (/\busim\b/.test(s)) return lit('nd_usim');
          if (!/\b(sim|phone number|plan|number)\b/.test(s)) return /\b(account|change|exchange)\b/.test(s) ? R(false, 2, '상황과 달라요. 여기는 휴대폰 가게예요.', { tag: 'fact' }) : keyMiss();
          return pass('유심(SIM 카드)을 사고 싶다는 용건이 들렸어요.');
        }
        if (/\bbank ?book\b/.test(s)) return lit('nd_book');
        if (!/\b(open|set up|get)\b.*\baccount\b/.test(s)) {
          if (/\bexchange student\b/.test(s)) return R(false, 2, BK.FRAME.nd_half.why, { tag: 'need' });
          return /\b(sim|change|exchange)\b/.test(s) ? R(false, 2, '상황과 달라요. 여기는 은행 창구예요.', { tag: 'fact' }) : keyMiss();
        }
        return pass('계좌를 열고 싶다는 용건이 들렸어요.');
      }
      case 'much': {
        const w = heardWon(toks);
        if (!w) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        return wonCheck(w, () => pass('바꿀 금액이 들렸고 카드와 맞아요.'));
      }
      case 'bills': {
        if (/\bpaper\b/.test(s)) return lit('bl_paper');
        const v = /\b(large|big)\b/.test(s) ? 'large' : /\bsmall\b/.test(s) ? 'small' : null;
        if (!v) return keyMiss();
        if (C.bills != null && v !== C.bills) return differ('bills', v);
        return pass('고른 지폐가 들렸고 카드와 맞아요.');
      }
      case 'get': {
        const amt = heardUsd(toks);
        if (amt == null) return /\b(thank|thanks|okay|ok|great)\b/.test(s) ? R(false, 2, BK.FRAME.gt_ok.why, { tag: 'need' }) : keyMiss();
        if (C.usd != null && amt !== C.usd) return R(false, 2, `상대가 말한 금액과 달라요. 상대: ${BK.factKo('usd', C.usd)} · 들린 말: ${BK.factKo('usd', amt)}. -teen과 -ty는 헷갈리기 쉬워요.`, { tag: 'fact' });
        return pass('들은 금액을 되짚었어요. 숫자가 맞아요.');
      }
      case 'id': case 'second': {
        if (/\bi have passport\b/.test(s)) notes.push('서류를 건넬 때는 Here\'s my passport.가 자연스러워요(말로 한 대답은 문법을 판정하지 않아요).');
        if (q.intent === 'second' && /\bi have ?$/.test(s)) notes.push('Yes, I have.는 have 뒤가 비어 문장이 끝나지 않아요 → Yes, I do.');
        if (noHeard && !yesHeard) return differ(q.intent === 'id' ? 'doc' : 'doc', 'none');
        if (!/\b(here|passport|student id|yes|sure|of course)\b/.test(s)) return keyMiss();
        if (q.intent === 'second' && !/\b(student id|student card)\b/.test(s)) notes.push(It.yn.need);
        auxNote();
        return pass('서류를 내미는 말이 들렸어요.');
      }
      case 'proof': {
        if (/\bdormitory paper\b/.test(s)) return lit('pf_dorm');
        const lease = /\b(housing contract|lease|contract)\b/.test(s), letter = /\bletter\b/.test(s);
        if (lease) { if (C.proof === false) return differ('proof', true); return pass('주소가 적힌 서류를 내미는 말이 들렸어요.'); }
        if (letter || noHeard) {
          if (C.proof) return differ('proof', false);
          if (!letter || !/\b(would|could|can|is|will)\b/.test(s)) return R(false, 2, It.yn.noStrict, { tag: 'need' });
          auxNote();
          return pass('없다는 사실과 대신 낼 서류를 묻는 말이 들렸어요.');
        }
        if (yesHeard) { if (C.proof === false) return differ('proof', true); notes.push(It.yn.need); return pass('있다는 말이 들렸어요.'); }
        return keyMiss();
      }
      case 'student': {
        if (noHeard) return differ('student', false);
        if (!yesHeard && !/\bstudent\b/.test(s)) return keyMiss();
        auxNote();
        if (!/\bstudent\b/.test(s)) notes.push(It.yn.need);
        return pass('학생이라는 말이 들렸어요.');
      }
      case 'type': {
        if (/\bbank ?book\b/.test(s)) return lit('nd_book');
        const v = /\bchecking\b/.test(s) ? 'checking' : /\bsavings?\b/.test(s) ? 'savings' : null;
        if (!v) return keyMiss();
        if (C.acct != null && v !== C.acct) return differ('acct', v);
        return pass('고른 통장이 들렸고 카드와 맞아요.');
      }
      case 'plan': {
        const v = /\bprepaid\b|\bpay as you go\b/.test(s) ? 'prepaid' : /\b(monthly|contract)\b/.test(s) ? 'monthly' : null;
        if (!v) return keyMiss();
        if (C.plan != null && v !== C.plan) return differ('plan', v);
        return pass('고른 요금제가 들렸고 카드와 맞아요.');
      }
      case 'data': {
        if (/\b(data free|free data)\b/.test(s)) return R(false, 2, BK.SLOT.data.vals.free.why, { tag: 'literal' });
        const n = runs(toks).map(Number)[0], v = /\bunlimited\b/.test(s) ? 'unl' : n === 15 ? 'd15' : n === 50 ? 'd50' : null;
        if (!v) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.data != null && v !== C.data) return R(false, 2, `카드와 달라요. 카드: ${BK.factKo('data', C.data)} · 들린 말: ${BK.factKo('data', v)}.` + (v !== 'unl' && C.data !== 'unl' ? ' fifTEEN(뒤를 세게)과 FIFty(앞을 세게)는 헷갈리기 쉬워요.' : ''), { tag: 'fact' });
        return pass('데이터 양이 들렸고 카드와 맞아요.');
      }
      case 'stay': {
        if (/\bduring\b/.test(s)) return lit('st_dur');
        const n = runs(toks).map(Number)[0], v = n === 4 ? 'm4' : n === 6 ? 'm6' : n === 10 ? 'm10' : null;
        if (!v || !/\bmonths?\b/.test(s)) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.stay && v !== C.stay) return differ('stay', v);
        return pass('머무는 기간이 들렸고 카드와 맞아요.');
      }
      case 'cost': {
        if (/\bcard is (okay|ok|possible|fine)\b/.test(s)) return lit('co_lit');
        const v = /\bcard\b/.test(s) ? 'card' : /\b(cash|here you go|here you are|here it is)\b/.test(s) ? 'cash' : null;
        if (!v) return bare ? R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${BK.sayOf(q.intent)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.paym != null && v !== C.paym) return differ('paym', v);
        return pass(v === 'card' ? '카드로 내겠다는 말이 들렸어요.' : '현금을 건네는 말이 들렸어요.');
      }
      case 'unlock': {
        if (!yesHeard && !noHeard) return keyMiss();
        return yn('unlocked', !noHeard, noHeard ? '아니라는 말이 들렸고 카드와 맞아요.' : '그렇다는 말이 들렸고 카드와 맞아요.');
      }
      case 'number': case 'phone': {
        if (/\bhundred\b/.test(heard)) return lit(q.intent === 'number' ? 'nb_big' : 'ph_big');
        const p = heardPhone(toks);
        if (!p) return q.intent === 'number' && /\b(thank|thanks|okay|ok|great)\b/.test(s) ? R(false, 2, BK.FRAME.nb_ok.why, { tag: 'need' }) : bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.phone && p !== C.phone) return R(false, 2, `${q.intent === 'number' ? '상대가 말한 번호' : '휴대폰 가게에서 받은 번호'}와 달라요. ${q.intent === 'number' ? '상대' : '받은 번호'}: ${BK.factKo('phone', C.phone)} · 들린 말: ${BK.factKo('phone', p)}.`, { tag: 'fact' });
        return pass(q.intent === 'number' ? '새 번호를 한 자리씩 되짚었어요. 번호가 맞아요.' : '받은 번호를 한 자리씩 말했어요. 번호가 맞아요.');
      }
      case 'topup': {
        if (/\bcharge\b/.test(s)) return lit('tu_charge');
        if (!yesHeard && !noHeard) return keyMiss();
        return yn('auto', !noHeard, noHeard ? '자동 충전은 하지 않겠다는 말이 들렸어요.' : '자동 충전을 하겠다는 말이 들렸어요.');
      }
      case 'addr': {
        const ws = BK.parseLine(raw);
        if (ws.filter(w => w !== 'its').length < 1) return /\bdormitory\b/.test(s) ? R(false, 2, BK.FRAME.ad_dorm.why, { tag: 'need' }) : keyMiss();
        const o = BK.checkLine({ words: ws }, C);
        if (!o.ok) return R(false, o.stage || 2, o.why, { tag: o.tag || 'fact', line: ws, fix: BK.fixLine({ words: ws }, C) });
        return pass('주소를 작은 곳에서 큰 곳으로 빠짐없이 말했어요.');
      }
      case 'sign': {
        if (/\bmy sign\b/.test(s)) return lit('sg_lit');
        if (!/\b(sure|okay|ok|right here|here|where|yes|of course)\b/.test(s)) return keyMiss();
        return pass('알겠다는 말이 들렸어요.');
      }
      case 'debit': {
        if (/\bcheck card\b/.test(s)) return lit('db_check');
        if (!yesHeard && !noHeard) return /\bdebit card\b/.test(s) ? yn('debit', true, '직불 카드가 필요하다는 말이 들렸어요.') : keyMiss();
        return yn('debit', !noHeard, noHeard ? '필요 없다는 말이 들렸어요.' : '필요하다는 말이 들렸어요.');
      }
      case 'pin': {
        if (runs(toks).some(t => t.length >= 4) || runs(toks).length >= 3) return R(false, 2, BK.FRAME.pn_say.why, { tag: 'safe' });
        if (!/\b(okay|ok|sure|alright|thank|thanks|yes)\b/.test(s)) return keyMiss();
        return pass('알겠다는 말이 들렸어요. 비밀번호는 숫자판에 눌러요.');
      }
      case 'else': {
        const atm = /\b(atm|cash machine)\b/.test(s);
        if (atm) { if (C.ask === null) return differ('ask', 'atm'); if (!/\b(could|can|would|where is the nearest|do you know)\b/.test(s)) notes.push('묻는 말만 툭 던지면 퉁명스럽게 들려요 → Could you tell me where the nearest ATM is?'); return pass('ATM 위치를 묻는 말이 들렸어요.'); }
        if (noHeard || /\b(that is everything|that is all|i am good)\b/.test(s)) { if (C.ask) return differ('ask', null); if (!/\b(thank|thanks)\b/.test(s)) notes.push('No만 하면 무뚝뚝하게 들릴 수 있어요 → No, that\'s everything. Thank you!'); return pass('다 됐다는 말이 들렸어요.'); }
        if (yesHeard) return R(false, 2, It.yn.strict, { tag: 'need' });
        return keyMiss();
      }
      default: return R(false, 0, '이 말은 말로 대답하기를 지원하지 않아요.');
    }
  };

  /* ---------- 따라 말하기: 낱말 맞춰 보기 (가장 긴 공통 부분열, 숫자는 같은 숫자로 — 숫자 덩어리가 낱말 여럿에 걸치면 함께 칠해요) ---------- */
  BK.compareWords = function (target, heard) {
    const tw = String(target).split(/\s+/).filter(Boolean), raw = [];
    tw.forEach((w, i) => BK.norm(w).forEach(x => raw.push({ x, i })));
    const T = canonCore(raw), A = T.map(o => o.p), B = BK.canon(heard), D = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) D[i][j] = A[i] === B[j] ? D[i + 1][j + 1] + 1 : Math.max(D[i + 1][j], D[i][j + 1]);
    const got = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { got.add(i); i++; j++; } else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++; }
    const okW = tw.map(() => true);
    T.forEach((o, n) => { if (!got.has(n)) o.ws.forEach(w => { okW[w] = false; }); });
    return { words: tw.map((t, k) => ({ t, ok: okW[k] })), hit: okW.filter(Boolean).length, total: tw.length };
  };

  /* =========================================================
     내 카드 (은행 · 휴대폰 시뮬레이터): 환전 창구 → 휴대폰 가게 → 은행 창구
     새 전화번호는 카드에 없어요 — 휴대폰 가게에서 듣고 은행 서류에 써야 해요.
     ========================================================= */
  BK.newCard = function (rnd = Math.random) {
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const won = pick(BK.WONS), plan = pick(['prepaid', 'monthly']), data = pick(['d15', 'd50', 'unl']);
    const c = { won, bills: pick(['large', 'small']), plan, data, stay: pick(['m4', 'm6', 'm10']), paym: pick(['card', 'cash']), unlocked: true, auto: rnd() < 0.4,
      phone: pick(BK.PHONES), acct: pick(['checking', 'savings']), student: true, proof: rnd() < 0.5, addr: { room: pick(BK.ROOMS), hall: pick(BK.HALL_IDS) },
      debit: rnd() < 0.7, pin: pick(BK.PINS), ask: rnd() < 0.5 ? 'atm' : null, v1: pick(['student', 'second']) };
    c.usd = BK.fx(won);
    c.amount = BK.planCost(plan, data);
    return c;
  };
  // 상대가 말하는 차례
  BK.simQs = c => ['fx_help', 'fx_much', 'fx_bills', 'fx_get', 'sh_help', 'sh_plan', 'sh_data', 'sh_cost', 'sm_unlock', 'sm_num', 'sm_top',
    'tl_help', 'tl_type'].concat(c.v1 === 'student' ? ['tl_student', 'id_pass'] : ['id_pass', 'id_second']).concat(['id_proof', 'fm_addr', 'fm_phone', 'cd_debit']).concat(c.debit ? ['cd_pin'] : []).concat(['cd_else']);   // 직불 카드를 거절하면 비밀번호는 묻지 않아요
  // 카드에 따라 바뀌는 말 (받을 달러 · 요금 · 새 번호)
  BK.simQ = function (id, c) {
    const q = BK.Q[id];
    if (id === 'fx_get') return Object.assign({}, q, { en: `At today's rate, that comes to ${BK.money(c.usd)}.`, ko: `오늘 환율로 ${ieyo(BK.priceKo(c.usd))}.`, key: [BK.money(c.usd)], fact: { usd: c.usd }, short: `That comes to ${BK.money(c.usd)}.` });
    if (id === 'sh_cost') return Object.assign({}, q, { en: `Okay, that's ${BK.money(c.amount)} for the first month.`, ko: `네, 첫 달은 ${ieyo(BK.priceKo(c.amount))}.`, key: [BK.money(c.amount)], fact: { amount: c.amount }, short: `That's ${BK.money(c.amount)} for the first month.` });
    if (id === 'sm_num') return Object.assign({}, q, { en: `Alright, you're all set. Your new number is ${c.phone}.`, ko: `다 됐어요. 새 번호는 ${ieyo(c.phone)}.`, fact: { phone: c.phone }, short: `Your new number is ${c.phone}.` });
    return q;
  };
  BK.PLACE_OF = id => BK.Q[id].place;
  // 질문마다 틀 칩: 맞는 틀 · 한국어 그대로(콩글리시 · 틀린 문장 · 짝이 다른 대답) 틀 · Yes만 하는 대답. 주소는 조각 칩(BK.lineChips)으로 말해요
  BK.SIM_FRAMES = {
    need: c => c.task === 'fx' ? ['nd_fx', 'nd_fxgive', 'g_yesp'] : c.task === 'sim' ? ['nd_sim', 'nd_open', 'nd_usim'] : ['nd_acct', 'nd_book', 'nd_half'],
    much: ['mc_won', 'mc_man', 'g_yesp'],
    bills: ['bl_pl', 'bl_paper', 'g_yesp'],
    get: ['gt_so', 'gt_ok', 'g_yes'],
    id: ['id_here', 'id_have', 'g_no'],
    plan: ['pl_pl', 'g_yesp', 'dt_pl'],
    data: ['dt_pl', 'g_yesp', 'st_for'],
    stay: ['st_for', 'st_dur', 'g_yes'],
    cost: c => c.paym === 'card' ? ['co_card', 'co_lit', 'co_here'] : ['co_here', 'co_card', 'co_lit'],
    unlock: c => c.unlocked === false ? ['ul_no', 'ul_am', 'ul_yes'] : ['ul_yes', 'ul_am', 'ul_no'],
    number: ['nb_so', 'nb_big', 'nb_ok'],
    topup: c => c.auto ? ['g_yesp', 'tu_charge', 'tu_no'] : ['tu_no', 'tu_charge', 'g_yesp'],
    type: ['ty_pl', 'g_yesp', 'nd_book'],
    student: ['su_yes', 'su_do', 'g_no'],
    second: ['sc_yes', 'sc_have', 'sc_am'],
    proof: c => c.proof ? ['pf_yes', 'pf_ask', 'pf_dorm'] : ['pf_ask', 'pf_no', 'pf_yes'],
    addr: ['line', 'ad_dorm'],
    phone: ['ph_is', 'ph_big', 'g_yes'],
    sign: ['sg_ok', 'sg_lit', 'g_no'],
    debit: c => c.debit ? ['g_yesp', 'db_check', 'g_no'] : ['g_no', 'db_check', 'g_yesp'],
    pin: ['pn_ok', 'pn_say', 'g_no'],
    else: c => c.ask ? ['el_atm', 'el_where', 'g_yes'] : ['el_no', 'el_plain', 'g_yes'],
  };
  BK.simFrames = (intent, c) => { const x = BK.SIM_FRAMES[intent]; return typeof x === 'function' ? x(c) : x ? x.slice() : null; };
  // 칸 칩: 카드의 값 + 헷갈리기 쉬운 값 (원은 만 단위를 잘못 옮긴 값 · 달러는 teen ↔ ty · 번호는 끝 두 자리를 바꾼 값)
  const moneyTrap = a => { const d = Math.floor(a / 100), k = a % 100, t = BK.teenSwap(d); return t != null ? t * 100 + k : a + 1000; };
  BK.moneyTrap = moneyTrap;
  const usdTrap = c => { const t = BK.tailSwap(Math.floor(c / 100)); return t != null ? t * 100 : c + 1000; };
  BK.usdTrap = usdTrap;
  BK.slotChoices = function (slot, card, rnd = Math.random, q) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let out;
    if (slot === 'won') { const w = card.won || 300000; out = [w].concat(BK.wonTraps(w)).map(String); }
    else if (slot === 'usd') { const u = card.usd != null ? card.usd : BK.fx(card.won || 300000); out = [u, usdTrap(u), u + 1000].map(String); }
    else if (slot === 'money') { const a = card.amount; out = [a, moneyTrap(a), a >= 3500 ? a - 500 : a + 500].map(String); }
    else if (slot === 'phone') { const p = card.phone || BK.PHONES[0]; out = [p, BK.phoneTrap(p), BK.PHONES.find(x => x !== p && x !== BK.phoneTrap(p))]; }
    else if (slot === 'pin') { const p = card.pin || BK.PINS[0]; out = [p].concat(BK.PINS.filter(x => x !== p).slice(0, 2)); }
    else if (slot === 'data') { const r = BK.slotVal('data', card, q); out = [r, r === 'unl' ? 'free' : shuffle(slotIds('data').filter(k => k !== r))[0], shuffle(slotIds('data').filter(k => k !== r))[0]]; }
    else if (slot === 'acct') { const r = BK.slotVal('acct', card, q); out = [r, r === 'checking' ? 'savings' : 'checking', 'book']; }
    else {
      const right = BK.slotVal(slot, card, q), keys = shuffle(slotIds(slot).filter(k => k !== right));
      out = (right ? [right] : []).concat(keys.slice(0, right ? 2 : 3));
    }
    return shuffle(out.filter((x, i, a) => x != null && a.indexOf(x) === i));
  };
  // 주소 조각 칩 (자리마다 맞는 조각 + 헷갈리기 쉬운 조각) — 차례대로 고르면 한 줄이 돼요
  BK.lineChips = function (c, rnd = Math.random) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const A = BK.addrOf(c), st = BK.HALLS[A.hall].st, other = BK.HALL_IDS.filter(h => h !== A.hall)[Math.floor(rnd() * 2) % 2];
    return [
      { c: 'room', ids: shuffle(['r' + A.room, 'r' + BK.roomTrap(A.room)]) },
      { c: 'hall', ids: shuffle([A.hall, other]) },
      { c: 'st', ids: shuffle(['s' + st, 'k' + st]) },
      { c: 'city', ids: shuffle(['z' + BK.ZIP, 'z' + BK.zipTrap(BK.ZIP)]) },
    ];
  };
  BK.cardRows = c => [
    ['환전', `${BK.wonKo(c.won)} → 미국 달러 · ${BK.BILLS[c.bills].ko}`],
    ['휴대폰', `유심(SIM 카드) · ${BK.PLANS[c.plan].ko} · ${BK.DATA[c.data].ko} · ${BK.MONTHS_STAY[c.stay].ko} 머묾 · ${c.paym === 'card' ? '카드로' : '현금으로'} 내요 · 잠금 해제된 휴대폰 · 자동 충전 ${c.auto ? '해요' : '안 해요(직접 충전)'}`],
    ['은행', `계좌 열기 · ${BK.SLOT.acct.vals[c.acct].ko} · ${BK.UNI} 교환학생`],
    ['서류', `여권 · 학생증 · ${c.proof ? '기숙사 계약서(주소가 적혀 있어요)' : '주소 증명 서류 없음 — 학교 확인서(재학 확인 편지)는 있어요'}`],
    ['주소 (한국식으로 적어 둠)', BK.addrKo(BK.addrOf(c))],
    ['새 전화번호', '휴대폰 가게에서 알려 줘요 — 들은 번호를 은행 서류에 써요'],
    ['카드', `직불 카드 ${c.debit ? '필요해요' : '필요 없어요'} · 비밀번호(${c.pin})는 숫자판에 누르기만 · ${c.ask ? '가장 가까운 ATM 위치를 물어요' : '더 물어볼 것 없음'}`],
  ];
  // 상대의 반응 (단계별)
  const BAD_REACT = {
    nd_open: ['Open your phone…? Oh — you need a SIM card?', '개통 → I\'d like to get a SIM card for my phone, please.'], nd_usim: ['A SIM card? Sure — what would you like to do?', '유심 → a SIM card · 용건은 부탁 틀로'],
    nd_book: ['A bankbook…? Oh, you\'d like to open an account?', '통장 만들기 → open a bank account'], nd_half: ['Welcome! And… what can I do for you?', '용건을 부탁 틀로 → I\'d like to open a bank account, please.'],
    mc_man: ['Sorry — how many won?', '만 = ten thousand → 30만 = three hundred thousand won'], bl_paper: ['Paper…? Oh — small bills?', '지폐 → bills'],
    id_have: ['Great — may I see it?', '건네면서 → Sure. Here\'s my passport.'], sc_have: ['You have…?', 'Do you …? → Yes, I do. Here\'s my student ID.'], sc_am: ['Sorry — do you have one?', 'Do you …? → Yes, I do.'],
    pf_dorm: ['Your dormitory paper…? Is your address on it?', '주소가 적힌 계약서 → my housing contract'], pf_no: ['I see. Hmm, we need proof of address for a new account.', '없으면 사실 + 부탁 → Would a letter from my university work?'],
    su_do: ['You do…? So, you\'re a student?', 'Are you …? → Yes, I am.'], st_dur: ['During…? Oh — for how long?', '숫자로 센 기간 → For six months.'],
    co_lit: ['Sorry — is the card okay?', '카드로 → Can I pay by card?'], ul_am: ['You are…? So, the phone is unlocked?', 'Is it …? → Yes, it is.'],
    nb_big: ['Five hundred…? Oh — five-five-five?', '번호는 한 자리씩 → five-five-five, oh-one-four-seven'], ph_big: ['Five hundred…? Oh — five-five-five?', '번호는 한 자리씩 → five-five-five, oh-one-four-seven'],
    gt_ok: ['Sure. Would you like to check the amount?', '큰 숫자는 되짚어요 → So, that\'s $240?'], nb_ok: ['Sure. Did you get that number?', '번호는 되짚어요 → So, it\'s 555-0147?'],
    tu_charge: ['Charge it…? Oh — you\'ll top it up yourself?', '요금 충전 → top up'], sg_lit: ['Your sign…? Oh — your signature. Right here, please.', '서명 → signature · Sure. Right here?'],
    db_check: ['A check card…? Oh — a debit card?', '체크카드 → a debit card'], pn_say: ['Oh — please don\'t say it out loud! Just type it on the keypad.', '비밀번호는 말하지 않고 눌러요'],
    ad_dorm: ['Okay — and what\'s the full address?', '작은 곳에서 큰 곳으로 주소 한 줄'],
  };
  BK.BAD_REACT = BAD_REACT;
  BK.REACT = {
    ok: ['Okay.', 'Great.', 'Alright.', 'Perfect.', 'Thank you.'],
    1: q => ({ en: `Sorry — ${q.short && /\?$/.test(q.short) ? q.short : (String(q.en).match(/[^.!?]*\?/g) || [String(q.en)]).pop().trim()}`, ko: q.shape === 'or' || q.shape === 'wh' ? `${BK.SHAPE[q.shape].ko} → ${BK.SHAPE[q.shape].ans}` : `‘${q.key.join(' … ')}’를 말했어요.` }),
    2: (q, j, a, C) => {
      const F = a && BK.FRAME[a.f], b = F && BAD_REACT[F.id];
      if (b) return { en: b[0], ko: b[1] };
      if (F && F.line) { const fx = BK.fixLine(a.line, C || {}); return { en: fx.en, ko: fx.ko }; }
      if (j.tag === 'fact') {
        if (q.intent === 'get') return { en: `No — it comes to ${BK.money(C.usd)}.`, ko: '들은 숫자와 달라요.' };
        if (q.intent === 'cost') return { en: `No — it's ${BK.money(C.amount)}.`, ko: '들은 숫자와 달라요.' };
        if (q.intent === 'number') return { en: `No — it's ${C.phone}.`, ko: '들은 번호와 달라요.' };
        if (q.intent === 'phone') return { en: 'Hmm, is that the number from the phone shop?', ko: '휴대폰 가게에서 받은 번호를 떠올려요.' };
        if (q.intent === 'much' || (q.intent === 'need' && C.task === 'fx')) return { en: 'Sorry — how much was that, in won?', ko: '만은 ten thousand예요. 세 자리씩 끊어요.' };
        return { en: 'Hmm, are you sure?', ko: '내 카드(또는 상대가 한 말)를 다시 보세요.' };
      }
      if (j.tag === 'safe') return { en: 'Oh — please don\'t say it out loud!', ko: '비밀번호는 말하지 않고 눌러요.' };
      if (j.tag === 'need') return q.intent === 'else' ? { en: 'Sure — what is it?', ko: '물어볼 것을 바로 물어요.' } : q.intent === 'need' ? { en: 'Okay… and what can I do for you?', ko: '용건을 부탁 틀로 말해요.' } : { en: 'Sure — do you want to check that?', ko: '들은 것을 되짚어 확인해요.' };
      if (j.tag === 'wrong') return { en: 'Sorry?', ko: '질문의 첫 낱말과 짝이 맞는 대답을 해요.' };
      return { en: 'Sorry?', ko: '알아듣기 어려운 말이에요.' };
    },
    3: () => ({ en: '... Okay.', ko: '뜻은 통했지만 말투가 거칠어요.' }),
  };
  // 대답 뒤 상대가 덧붙이는 말 (다음 질문 앞)
  BK.reply = function (q, a, C) {
    switch (q.intent) {
      case 'need': return C.task === 'fx' ? 'Of course.' : C.task === 'sim' ? 'Sure! Let me ask you a few questions.' : 'Great. I can help you with that.';
      case 'much': return 'No problem.';
      case 'bills': return C.bills === 'large' ? 'Large bills. Sure.' : 'Small bills. Sure.';
      case 'get': return 'That\'s right. Here you go.';
      case 'id': case 'second': return 'Thank you.';
      case 'plan': return 'Great choice.';
      case 'data': return 'Okay.';
      case 'stay': return 'Got it.';
      case 'cost': return C.paym === 'card' ? 'Sure. Just tap your card here.' : 'Thank you. Here\'s your receipt.';
      case 'unlock': return 'Great.';
      case 'number': return 'That\'s right.';
      case 'topup': return 'No problem.';
      case 'type': return 'Sure.';
      case 'student': return 'Great.';
      case 'proof': return C.proof ? 'Perfect.' : 'Yes, a letter from your university works.';
      case 'addr': return 'Got it, thank you.';
      case 'phone': return 'Thanks.';
      case 'sign': return 'Thank you.';
      case 'debit': return C.debit ? 'Great. It\'ll come in the mail in about a week.' : 'No problem.';
      case 'pin': return 'All done.';
      case 'else': return C.ask ? 'Sure. It\'s right outside, on your left.' : 'You\'re welcome. Have a great day!';
      default: return null;
    }
  };

  /* =========================================================
     듣고 대답 고르기 16문제 (모두 새로 만든 대화). card = 그 상황의 사실
     ========================================================= */
  const o = (f, v) => { const a = { f }; if (v != null) a.v = String(v); return a; };
  const L = words => ({ f: 'line', line: { words } });
  BK.o = o; BK.L = L;
  // 기본 주소 (412호 · 메이플 홀 · College Avenue 200번지)
  const A0 = { room: 412, hall: 'maple' };
  BK.LINE = { words: BK.lineWords(A0) };
  BK.LINE_KO = { words: ['its', 'z40213', 's200', 'maple', 'r412'] };
  BK.LINE_K = { words: ['its', 'r412', 'maple', 'k200', 'z40213'] };
  BK.LINE_ROOM = { words: ['its', 'r421', 'maple', 's200', 'z40213'] };
  BK.LINE_ZIP = { words: ['its', 'r412', 'maple', 's200', 'z40231'] };
  BK.LINE_MISS = { words: ['its', 'r412', 'maple', 'z40213'] };
  BK.LINE_BAD = { words: ['its', 'maple', 'r412', 's200', 'z40213'] };
  BK.LINE_CHIPS = BK.lineChips({ addr: A0 }, (() => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; })());
  BK.DRILL = [
    { q: 'fx_help', sit: '70만 원을 미국 달러로 바꾸고 싶어요.', card: { won: 700000 }, a: 2, opts: [o('nd_fxgive'), o('nd_fx', 70000), o('nd_fx', 700000), o('g_yesp')] },
    { q: 'fx_much', sit: '20만 원을 바꾸고 싶어요.', card: { won: 200000 }, a: 0, opts: [o('mc_won', 200000), o('mc_man', 200000), o('g_yes'), o('mc_won', 2000000)] },
    { q: 'fx_get', sit: '직원이 바꿔 줄 달러를 말했어요. 들은 금액이 맞는지 확인하고 싶어요.', card: {}, a: 1, opts: [o('gt_ok'), o('gt_so', 24000), o('gt_so', 21400), o('g_yes')] },
    { q: 'sh_help', sit: '휴대폰에 넣을 유심(SIM 카드)을 사러 가게에 왔어요.', card: {}, a: 3, opts: [o('nd_open'), o('nd_usim'), o('g_yes'), o('nd_sim')] },
    { q: 'sh_data', sit: '데이터를 마음껏(무제한) 쓰고 싶어요.', card: { data: 'unl' }, a: 1, opts: [o('dt_pl', 'free'), o('dt_pl', 'unl'), o('g_yesp'), o('dt_pl', 'd50')] },
    { q: 'sm_unlock', sit: '휴대폰은 잠금 해제돼 있어요.', card: { unlocked: true }, a: 2, opts: [o('ul_am'), o('g_no'), o('ul_yes'), o('ul_no')] },
    { q: 'sm_num', sit: '직원이 새 전화번호를 알려 줬어요. 은행 서류에도 써야 해요.', card: {}, a: 0, opts: [o('nb_so', '555-0147'), o('nb_ok'), o('nb_so', '555-0174'), o('nb_big', '555-0147')] },
    { q: 'sm_fast', sit: '직원이 아주 빠르게 말했어요. ‘… new number …’만 들렸어요.', card: {}, a: 3, opts: [o('g_yes'), o('rp_data'), o('nb_ok'), o('rp_num')] },
    { q: 'tl_help', sit: '은행에 계좌를 열러 왔어요.', card: {}, a: 2, opts: [o('nd_book'), o('nd_half'), o('nd_acct'), o('nd_make')] },
    { q: 'tl_type', sit: '월세를 내고 생활비를 넣고 뺄 통장(입출금 통장)이 필요해요.', card: { acct: 'checking' }, a: 0, opts: [o('ty_pl', 'checking'), o('g_yesp'), o('ty_pl', 'book'), o('ty_pl', 'savings')] },
    { q: 'id_proof', sit: '주소가 적힌 서류는 없어요. 학교 확인서(재학 확인 편지)는 있어요.', card: { proof: false }, a: 3, opts: [o('pf_no'), o('pf_yes', 'lease'), o('g_yes'), o('pf_ask')] },
    { q: 'id_second', sit: '다른 신분증으로 학생증이 있어요.', card: {}, a: 1, opts: [o('sc_have'), o('sc_yes', 'sid'), o('sc_am'), o('g_no')] },
    { q: 'fm_addr', sit: '주소 메모(한국식 차례): Kellport 40213, College Avenue 200, Maple Hall 412호', card: { addr: A0 }, a: 2, opts: [L(BK.LINE_KO.words), L(BK.LINE_K.words), L(BK.LINE.words), L(BK.LINE_ROOM.words)] },
    { q: 'fm_fast', sit: '직원이 아주 빠르게 말했어요. ‘… address …’만 들렸어요.', card: {}, a: 0, opts: [o('rp_addr'), o('rp_num'), L(BK.LINE.words), o('g_yes')] },
    { q: 'cd_pin', sit: '직원이 숫자판에 비밀번호를 눌러 달라고 했어요.', card: {}, a: 1, opts: [o('pn_say', '2580'), o('pn_ok'), o('g_no'), o('el_no')] },
    { q: 'cd_else', sit: '가장 가까운 ATM이 어디 있는지 묻고 싶어요.', card: { ask: 'atm' }, a: 3, opts: [o('g_yes'), o('el_where'), o('el_no'), o('el_atm')] },
  ];
  BK.DRILL.forEach((it, i) => { it.n = i; it.Q = BK.Q[it.q]; it.place = it.Q.place; });
  // 직접 해 보기의 짧은 문제 (00장 · 02장 · 07장) — 연습 문제와 다른 상황
  BK.MINI = {
    intro: { q: 'fx_help', sit: '60만 원을 미국 달러로 바꾸고 싶어요.', card: { won: 600000 }, a: 1, opts: [o('nd_fx', 60000), o('nd_fx', 600000), o('g_yesp'), o('nd_fxgive')] },
    won: { q: 'fx_much', sit: '70만 원을 바꾸고 싶어요.', card: { won: 700000 }, a: 2, opts: [o('mc_man', 700000), o('mc_won', 7000000), o('mc_won', 700000), o('g_yes')] },
    phone: { q: 'fm_phone', sit: '휴대폰 가게에서 받은 새 번호는 555-0138이에요.', card: { phone: '555-0138' }, a: 0, opts: [o('ph_is', '555-0138'), o('ph_big', '555-0138'), o('ph_is', '555-0183'), o('g_yes')] },
  };
  Object.values(BK.MINI).forEach(it => { it.Q = BK.Q[it.q]; it.place = it.Q.place; });

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 내 카드 (연습 문제와 겹치지 않게 골랐어요)
     ========================================================= */
  // 02장 환전: 30만 원 → 240달러 · 작은 지폐
  // 03–04장 휴대폰: 유심 · 선불 · 15GB · 6개월 · 30달러 카드로 · 잠금 해제됨 · 새 번호 555-0147 · 자동 충전 안 함
  // 05–08장 은행: 계좌 열기 · 입출금 통장 · 학생 · 여권 · 학생증 · 기숙사 계약서 · 412호 메이플 홀 · 직불 카드 · ATM 묻기
  BK.DEMO = { won: 300000, bills: 'small', plan: 'prepaid', data: 'd15', stay: 'm6', paym: 'card', unlocked: true, auto: false, phone: '555-0147',
    acct: 'checking', student: true, proof: true, addr: A0, debit: true, pin: '7391', ask: 'atm' };
  BK.DEMO.usd = BK.fx(BK.DEMO.won);
  BK.DEMO.amount = BK.planCost(BK.DEMO.plan, BK.DEMO.data);
  // 00장: 숫자는 끊어서(만 → thousand) · 서류는 내밀면서 · 들은 번호는 되짚기
  BK.INTRO = { q: 'fx_much', bad: o('mc_man', 300000), ok: o('mc_won', 300000), card: { won: 300000 },
    dq: 'fx_pass', dbad: o('id_have'), dok: o('id_here', 'passport'), rq: 'sm_num', skip: o('nb_ok'), check: o('nb_so', '555-0147') };
  BK.SCENE = {
    // 02장 환전 창구: 용건 · 금액(만 → thousand) · 지폐 · 받을 금액 되짚기
    need: ['fx_help', o('nd_fxgive'), o('nd_fxs'), o('nd_fx', 300000)],
    won: ['fx_much', o('mc_man', 300000), o('mc_won', 30000), o('mc_won', 3000000), o('mc_won', 300000)],
    bills: ['fx_bills', o('g_yesp'), o('bl_paper', 'small'), o('bl_pl', 'small')],
    get: ['fx_get', o('gt_ok'), o('gt_so', 21400), o('gt_so', 24000), o('gt_say', 24000)],
    // 03장 휴대폰 가게: 용건 · 요금제 · 데이터 · 기간 · 값
    sim: ['sh_help', o('nd_open'), o('nd_usim'), o('nd_sim')],
    plan: ['sh_plan', o('g_yesp'), o('pl_pl', 'prepaid')],
    data: ['sh_data', o('dt_pl', 'free'), o('dt_pl', 'd50'), o('dt_pl', 'd15')],
    stay: ['sh_stay', o('st_dur', 'm6'), o('st_for', 'm6')],
    dfast: ['sh_fast', o('dt_pl', 'd15'), o('rp_data')],
    cost: ['sh_cost', o('co_say', 1300), o('co_say', 3000), o('co_lit'), o('co_card')],
    // 04장 유심 · 새 번호 되짚기 · 자동 충전
    unlock: ['sm_unlock', o('ul_am'), o('ul_yes')],
    num: ['sm_num', o('nb_ok'), o('nb_big', '555-0147'), o('nb_so', '555-0174'), o('nb_so', '555-0147')],
    nfast: ['sm_fast', o('nb_so', '555-0147'), o('rp_num')],
    top: ['sm_top', o('tu_charge'), o('rp_wtop'), o('tu_no')],
    // 05장 은행 창구: 용건 · 통장 · 학생
    acct: ['tl_help', o('nd_book'), o('nd_make'), o('nd_half'), o('nd_acct')],
    type: ['tl_type', o('ty_pl', 'book'), o('g_yesp'), o('ty_pl', 'checking')],
    student: ['tl_student', o('su_do'), o('g_yes'), o('su_yes')],
    // 06장 서류: 여권 · 두 번째 신분증 · 주소 증명(있을 때 · 없을 때)
    pass: ['id_pass', o('id_have'), o('id_here', 'passport')],
    second: ['id_second', o('sc_have'), o('sc_am'), o('sc_yes', 'sid')],
    proof: ['id_proof', o('pf_dorm'), o('pf_yes', 'lease')],
    noproof: ['id_proof', o('pf_no'), o('pf_ask')],
    ifast: ['id_fast', o('id_here', 'passport'), o('rp_id')],
    // 07장 주소 한 줄 · 전화번호 · 서명
    lines: [['ko', L(BK.LINE_KO.words)], ['k', L(BK.LINE_K.words)], ['room', L(BK.LINE_ROOM.words)], ['miss', L(BK.LINE_MISS.words)], ['ok', L(BK.LINE.words)]],
    dorm: ['fm_addr', o('ad_dorm')],
    phone: ['fm_phone', o('ph_big', '555-0147'), o('ph_is', '555-0174'), o('ph_is', '555-0147')],
    sign: ['fm_sign', o('sg_lit'), o('sg_ok')],
    afast: ['fm_fast', L(BK.LINE.words), o('rp_addr')],
    // 08장 직불 카드 · 비밀번호 · ATM
    debit: ['cd_debit', o('db_check'), o('g_yesp')],
    pin: ['cd_pin', o('pn_say', '7391'), o('pn_ok')],
    else: ['cd_else', o('g_yes'), o('el_where'), o('el_atm')],
  };
  // 09장: 곳마다 한 줄 (3단계 적용)
  BK.METHOD = [
    ['fx_get', o('gt_so', 24000), {}],
    ['sh_plan', o('pl_pl', 'prepaid'), { plan: 'prepaid' }],
    ['sm_num', o('nb_so', '555-0147'), {}],
    ['tl_help', o('nd_acct'), {}],
    ['id_proof', o('pf_ask'), { proof: false }],
    ['fm_addr', L(BK.LINE.words), { addr: A0 }],
    ['cd_pin', o('pn_ok'), {}],
  ];
  // 10장 실전: 내 카드 하나로 넷 (보기 셋, 단계마다 지워짐)
  BK.PCARD = { won: 600000, bills: 'large', plan: 'monthly', data: 'd50', stay: 'm10', paym: 'cash', unlocked: true, auto: true, phone: '555-0162',
    acct: 'savings', student: true, proof: false, addr: { room: 315, hall: 'cedar' }, debit: false, pin: '1606', ask: null };
  BK.PCARD.usd = BK.fx(BK.PCARD.won);
  BK.PCARD.amount = BK.planCost(BK.PCARD.plan, BK.PCARD.data);
  BK.PRACTICE = [
    { q: 'fx_much', opts: [o('g_yes'), o('mc_won', 60000), o('mc_won', 600000)], a: 2,
      lines: ['How much → 정보 질문 · (A) Yes. → 묻는 정보가 없어 탈락', '(B) sixty thousand won → 카드(60만 원)와 달라 탈락 · 60만 = six hundred thousand', '남은 보기는 공손해요 · 정답 (C) Six hundred thousand won, please.'] },
    { q: 'sm_num', opts: [o('nb_ok'), o('nb_so', '555-0126'), o('nb_so', '555-0162')], a: 2,
      lines: ['new number → 새 번호를 알려 주는 안내 · 셋 모두 번호 안내에 맞는 말이에요', '(A) Okay. Thanks. → 되짚지 않아 탈락 · (B) 555-0126 → 들은 번호와 끝 두 자리가 달라 탈락', '남은 보기는 번호를 묶음으로 되짚어요 · 정답 (C) So, it\'s 555-0162?'] },
    { q: 'id_proof', opts: [o('pf_no'), o('pf_ask'), o('pf_yes', 'lease')], a: 1,
      lines: ['proof of address → Yes/No 질문 · 셋 모두 Do you …?의 짝(I do · I don\'t)으로 답해요', '(A) 없다는 사실만 말하고 부탁이 빠져 탈락 · (C) housing contract → 카드(주소 증명 서류 없음)와 달라 탈락', '남은 보기는 사실 + 부탁 질문이에요 · 정답 (B) No, I don\'t. Would a letter from my university work?'] },
    { q: 'fm_addr', opts: [L(['its', 'z40213', 's300', 'cedar', 'r315']), L(['its', 'r315', 'cedar', 'k300', 'z40213']), L(['its', 'r315', 'cedar', 's300', 'z40213'])], a: 2,
      lines: ['address → 정보 질문 · 셋 모두 주소 한 줄이에요', '(A) 한국식 차례(큰 곳 → 작은 곳)라 탈락 · (B) College Avenue 300 → 번지가 길 이름 뒤에 와 탈락', '남은 보기는 작은 곳에서 큰 곳으로 가요 · 정답 (C) It\'s Room 315, Cedar Hall, 300 College Avenue, Kellport, 40213.'] },
  ];
  BK.practiceQ = p => BK.simQ(p.q, BK.PCARD);

  /* ---------- 이어서 들리는 말 (02 · 03장). 대문자 = 세게 ---------- */
  BK.LINKED = [
    { q: 'fx_bills', en: 'Large bills or small bills?', say: 'Large bills or small bills?', words: ['Large', 'bills', 'or', 'small', 'bills?'], sound: [['LARGE', 1], ['bil', 0], ['zor', 0], ['SMALL', 1], ['bills', 0]], link: [[1, 2]], ko: 'bills or → bil-zor처럼 이어져요 · 고를 것(LARGE · SMALL)을 세게' },
    { q: 'sh_plan', en: 'Prepaid or monthly?', say: 'Prepaid or monthly?', words: ['Prepaid', 'or', 'monthly?'], sound: [['pre', 0], ['PAI', 1], ['dor', 0], ['MONTH', 1], ['ly', 0]], link: [[0, 1]], ko: 'prepaid or → pre-PAI-dor처럼 이어져요 · 고를 것(prePAID · MONTHly)을 세게' },
  ];
  // 헷갈리는 숫자 짝 (02장): 앞이 세면 -ty, 뒤가 세면 -teen
  BK.PAIRS = [['16', 'sixTEEN', '60', 'SIXty'], ['14', 'fourTEEN', '40', 'FORty'], ['15', 'fifTEEN', '50', 'FIFty']];

  /* ---------- 직접 해 보기 자료 ---------- */
  BK.SHAPE_QS = ['fx_help', 'fx_much', 'fx_bills', 'fx_get', 'sh_help', 'sh_plan', 'sh_data', 'sh_cost', 'sm_unlock', 'sm_num', 'sm_top', 'tl_help', 'tl_type', 'tl_student', 'id_second', 'id_proof', 'fm_addr', 'fm_sign', 'cd_debit', 'cd_pin', 'cd_else'];

  /* =========================================================
     따라 말하기 28문장 (곳마다 상대 · 나의 말 넷)
     ========================================================= */
  const SW = (place, who, en, ko, sp) => ({ place, who, en, ko, sp: who === 'me' ? 'me' : sp || BK.PLACE[place].sp });
  BK.SHADOW = [
    SW('fx', 'staff', 'Hello! How can I help you today?', '(영국) 안녕하세요! 무엇을 도와드릴까요?'),
    SW('fx', 'me', 'I\'d like to change 300,000 won into US dollars, please.', '30만 원을 미국 달러로 바꾸고 싶어요.'),
    SW('fx', 'staff', 'At today\'s rate, that comes to $240.', '오늘 환율로 240달러예요.'),
    SW('fx', 'me', 'So, that\'s $240?', '그러니까 240달러죠?'),
    SW('shop', 'staff', 'Hi there! What can I do for you today?', '(호주) 안녕하세요! 오늘 무엇을 도와드릴까요?'),
    SW('shop', 'me', 'I\'d like to get a SIM card for my phone, please.', '제 휴대폰에 넣을 유심을 사고 싶어요.'),
    SW('shop', 'staff', 'Would you like a prepaid plan or a monthly plan?', '선불 요금제로 하시겠어요, 월 요금제로 하시겠어요?'),
    SW('shop', 'me', 'Prepaid, please. I\'m here for six months.', '선불로 할게요. 여섯 달 동안 있어요.'),
    SW('sim', 'staff', 'Is your phone unlocked?', '휴대폰이 잠금 해제돼 있어요?'),
    SW('sim', 'me', 'Yes, it is.', '네, 해제돼 있어요.'),
    SW('sim', 'staff', 'Alright, you\'re all set. Your new number is 555-0147.', '다 됐어요. 새 번호는 555-0147이에요.'),
    SW('sim', 'me', 'So, it\'s 555-0147?', '그러니까 555-0147이죠?'),
    SW('teller', 'staff', 'Good morning. What can I do for you today?', '(미국) 안녕하세요. 오늘 무엇을 도와드릴까요?'),
    SW('teller', 'me', 'I\'d like to open a bank account, please.', '은행 계좌를 열고 싶어요.'),
    SW('teller', 'staff', 'Would you like a checking account or a savings account?', '입출금 통장으로 하시겠어요, 저축 통장으로 하시겠어요?'),
    SW('teller', 'me', 'A checking account, please.', '입출금 통장으로 할게요.'),
    SW('id', 'staff', 'Can I see your passport, please?', '여권을 보여 주시겠어요?'),
    SW('id', 'me', 'Sure. Here\'s my passport.', '네. 여기 여권이요.'),
    SW('id', 'staff', 'Do you have proof of address?', '주소를 증명할 서류가 있으세요?'),
    SW('id', 'me', 'No, I don\'t. Would a letter from my university work?', '아니요, 없어요. 학교 확인서도 될까요?'),
    SW('form', 'staff', 'Okay. What\'s your address here?', '(캐나다) 네. 여기 주소가 어떻게 되세요?'),
    SW('form', 'me', 'It\'s Room 412, Maple Hall, 200 College Avenue, Kellport, 40213.', '412호, 메이플 홀, College Avenue 200번지, 켈포트, 40213이에요.'),
    SW('form', 'staff', 'And what\'s a good phone number for you?', '그리고 연락받을 전화번호는요?'),
    SW('form', 'me', 'It\'s 555-0147.', '555-0147이에요.'),
    SW('card', 'staff', 'Would you like a debit card with your account?', '계좌에 직불 카드도 만들어 드릴까요?'),
    SW('card', 'me', 'Yes, please.', '네, 그렇게 해 주세요.'),
    SW('card', 'staff', 'Is there anything else I can help you with?', '더 도와드릴 일이 있을까요?'),
    SW('card', 'me', 'Yes. Could you tell me where the nearest ATM is?', '네. 가장 가까운 ATM이 어디 있는지 알려 주시겠어요?'),
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: key 열쇠 낱말 · frame 대답 틀 · slot 내 정보 · pol 공손한 말 · trap 함정 · ok 정답
     ========================================================= */
  const LL = k => `(${L4[k]})`;
  BK.judgeItem = (it, k) => BK.judge(it.Q, it.opts[k], it.card, '상황');
  const CARD_SKIP = { usd: 1, amount: 1, task: 1 };
  const cardSay = c => Object.keys(c || {}).filter(k => !CARD_SKIP[k] && c[k] !== undefined).map(k => BK.factKo(k, c[k])).join(' · ');
  const segMarks = (a, k, roleOf) => BK.segs(a).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).map(s => ({ t: s.t.trim().replace(/^[,.?!]+|[,.?!]+$/g, ''), role: roleOf(s), at: k })).filter(m => m.t);
  const tagKo = j => j.tag === 'fact' ? '상황 · 들은 말과 다른 정보' : j.tag === 'need' ? '꼭 말할 조각이 빠지거나 되짚지 않음' : j.tag === 'order' ? '순서가 뒤섞임' : j.tag === 'wrong' ? '틀린 문장 · 짝이 맞지 않는 대답' : j.tag === 'safe' ? '비밀번호를 소리 내어 말함' : '한국어 그대로 옮긴 말 · 콩글리시';
  BK.steps = function (it) {
    const q = it.Q, J = it.opts.map((_, k) => BK.judgeItem(it, k)), at = s => it.opts.map((_, k) => k).filter(k => J[k].stage === s);
    const best = it.opts[it.a], SHp = BK.SHAPE[q.shape], C = Object.assign({}, it.card || {}, q.fact || {});
    // ①
    let t1;
    if (q.fast) t1 = '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 말했는지 모르면 짐작해서 답하지 말고 다시 물어요. 들린 낱말이 있으면 그 부분만 되물어요.';
    else t1 = `열쇠 낱말 ${q.key.join(' … ')} → ${SHp.ko}(${SHp.mark}). ${BK.sayOf(q.intent)}. ${BK.INTENT[q.intent].want}`;
    if (at(1).length) t1 += ' ' + at(1).map(k => LL(k)).join(' · ') + (q.fast ? ' → 짐작한 대답이거나 다른 말을 되물어 탈락.' : J[at(1)[0]].tag === 'shape' ? ' → 모양이 맞지 않거나 다른 질문의 대답이라 탈락.' : ' → 다른 질문에 맞는 대답이라 탈락.');
    const m1 = q.fast ? [] : q.key.map(t => ({ t, role: 'key', at: 'q' }));
    at(1).forEach(k => m1.push({ t: BK.text(it.opts[k]).replace(/[.?!]$/, ''), role: 'trap', at: k }));
    // ②
    const sit = cardSay(it.card);
    const Fb = BK.FRAME[best.f], ft = Fb.line ? 'It\'s + 방 번호 → 건물 → 번지 + 길 → 도시 + 우편번호' : Fb.t ? Fb.t.replace(/[{}]/g, '').replace('___', '…') : BK.text(best);
    let t2 = (q.fast ? '상황 → 처음 듣고 다 알아듣지 못했어요. ' : sit ? `상황 → ${sit}. ` : '') + `맞는 틀 → ${ft}`;
    if (at(2).length) t2 += ' · ' + at(2).map(k => `${LL(k)} ${tagKo(J[k])}`).join(' · ') + ' → 탈락.';
    else t2 += ' · 틀과 정보가 모두 맞는 보기만 남았어요.';
    const m2 = [];
    it.opts.forEach((a, k) => {
      if (J[k].stage === 1) return;
      const F = BK.FRAME[a.f];
      if (F.line) {
        const lo = BK.checkLine(a.line, C), wrong = lo.err ? lo.err.word.t : null, badW = (a.line.words || []).map(w => BK.OW[w]).find(x => x && x.bad);
        BK.lineSegs(a.line).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).forEach(s => { const t = s.t.trim(); m2.push({ t, role: J[k].stage === 2 && (t === wrong || (badW && t === badW.t) || (lo.tag === 'order' && s.part && s.part !== 'open')) ? 'trap' : s.r === 'frame' ? 'frame' : 'slot', at: k }); });
        return;
      }
      const trapOf = s => J[k].stage !== 2 ? false : J[k].tag === 'fact' ? (F.slot ? s.r === 'slot' : s.r === 'frame') : s.r === 'frame' || s.r === 'slot';
      segMarks(a, k, s => s.r === 'pol' ? '' : trapOf(s) ? 'trap' : s.r).forEach(m => { if (m.role) m2.push(m); });
    });
    // ③
    let t3 = at(3).length ? at(3).map(k => `${LL(k)} ${BK.text(it.opts[k])} → ${J[k].tag === 'plain' ? '고맙다는 말 없이 끊김' : '명령 · 따지는 말 · 퉁명스러운 말'}`).join(' · ') + ' → 탈락. ' : '무례하게 들리는 보기는 없어요. ';
    t3 += `정답 ${LL(it.a)} → ${J[it.a].why}`;
    const m3 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 3) segMarks(a, k, () => 'trap').forEach(m => m3.push(m)); else if (J[k].stage === 0) segMarks(a, k, s => s.r === 'pol' ? 'pol' : '').forEach(m => { if (m.role) m3.push(m); }); });
    m3.push({ t: BK.text(it.opts[it.a]), role: 'ok', at: it.a, whole: true });
    return [
      { head: '① 열쇠 낱말 + 질문의 모양 잡기', text: t1, marks: m1 },
      { head: '② 틀에 내 정보 넣기', text: t2, marks: m2 },
      { head: '③ 공손하게 끝내기', text: t3, marks: m3 },
    ];
  };
  BK.notes = it => it.opts.map((_, k) => { const j = BK.judgeItem(it, k); return (j.ok ? '' : `× ${['', '①', '②', '③'][j.stage]} `) + j.why; });

  /* =========================================================
     데이터 점검 — 문제 데이터와 엔진이 어긋나면 콘솔 경고
     ========================================================= */
  BK.check = function () {
    const bad = [];
    const hasT = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase());
    Object.values(BK.Q).forEach(q => {
      if (!BK.PLACE[q.place]) bad.push(`말 ${q.id}: 곳 ${q.place}가 없어요`);
      if (!BK.INTENT[q.intent]) bad.push(`말 ${q.id}: 뜻 ${q.intent}가 없어요`);
      q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`말 ${q.id}: 열쇠 낱말 ‘${k}’가 말에 없어요`); });
      if (BK.shapeGuess(q.en) !== q.shape) bad.push(`말 ${q.id}: 적어 둔 모양 ${q.shape} · 글의 모양 ${BK.shapeGuess(q.en)}`);
      if (q.shape === 'or') { if (!q.choices || q.choices.length < 2) bad.push(`말 ${q.id}: 고르는 질문에 choices가 없어요`); else { const In = BK.INTENT[q.intent], S = Object.values(BK.SLOT).find(s => s.key === In.key); q.choices.forEach(c => { if (!S || !S.vals[c]) bad.push(`말 ${q.id}: 고를 것 ${c}가 칸에 없어요`); }); } }
      if (q.shape === 'yn' && !q.fast && !q.aux && !BK.INTENT[q.intent].offer) bad.push(`말 ${q.id}: Yes/No 질문에 짝(aux)이 없어요`);
      if (q.aux) { const first = String(q.en).match(/[^.!?]*\?/g).pop().trim().split(/\s+/)[0].toLowerCase(); const want = { do: 'do', be: 'are', is: 'is' }[q.aux]; if (!q.fast && first !== want) bad.push(`말 ${q.id}: 짝 ${q.aux} · 첫 낱말 ${first}`); }
      if (q.intent === 'need' && !(q.fact && q.fact.task)) bad.push(`말 ${q.id}: 용건 질문에 곳(task)이 없어요`);
    });
    Object.values(BK.FRAME).forEach(F => {
      [].concat(F.intent).forEach(i => { if (i !== 'yn' && i !== 'repair' && !BK.INTENT[i]) bad.push(`틀 ${F.id}: 뜻 ${i}가 없어요`); });
      if (F.slot && !BK.SLOT[F.slot]) bad.push(`틀 ${F.id}: 칸 ${F.slot}이 없어요`);
      if (F.slot && !/___/.test(F.t)) bad.push(`틀 ${F.id}: 칸이 있는데 ___가 없어요`);
      if ((F.tag !== 'ok' || F.half || F.skip) && !F.why) bad.push(`틀 ${F.id}: 함정 틀에 까닭(why)이 없어요`);
      if (F.aux && !BK.AUX[F.aux]) bad.push(`틀 ${F.id}: 짝 ${F.aux}가 없어요`);
    });
    Object.entries(BK.INTENT).forEach(([k, In]) => { if (In.best && typeof In.best === 'string' && !BK.FRAME[In.best]) bad.push(`뜻 ${k}의 모범 틀 ${In.best}가 없어요`); });
    Object.values(BK.OW).forEach(w => { if (!BK.OCAT[w.c]) bad.push(`주소 조각 ${w.t}: 갈래 ${w.c}가 없어요`); if (w.bad && !w.why) bad.push(`주소 조각 ${w.t}: 까닭이 없어요`); });
    // 숫자 읽기: 원 · 만 · 달러 · 환전 · 번호 · 방 번호
    [[300000, 'three hundred thousand won'], [200000, 'two hundred thousand won'], [30000, 'thirty thousand won'], [3000000, 'three million won'], [700000, 'seven hundred thousand won']].forEach(([w, t]) => { if (BK.wonWords(w) !== t) bad.push(`원 읽기 ${w}: ${BK.wonWords(w)}`); });
    [[300000, '30만 원'], [3000000, '300만 원'], [30000, '3만 원'], [600000, '60만 원']].forEach(([w, t]) => { if (BK.manKo(w) !== t) bad.push(`만 단위 ${w}: ${BK.manKo(w)}`); });
    [[24000, 'two hundred forty dollars'], [16000, 'one hundred sixty dollars'], [3000, 'thirty dollars'], [4550, 'forty-five dollars and fifty cents'], [100, 'one dollar']].forEach(([c, t]) => { if (BK.priceWords(c) !== t) bad.push(`달러 읽기 ${c}: ${BK.priceWords(c)}`); });
    if (JSON.stringify(BK.WONS.map(BK.fx)) !== '[16000,24000,48000,56000]') bad.push(`환전 계산: ${BK.WONS.map(BK.fx)}`);
    [[240, 214], [160, 116], [480, 418], [560, 516]].forEach(([n, t]) => { if (BK.tailSwap(n) !== t) bad.push(`teen · ty 함정 ${n}: ${BK.tailSwap(n)}`); });
    BK.WONS.forEach(w => { const u = BK.fx(w); if (usdTrap(u) === u || String(usdTrap(u)).length !== String(u).length) bad.push(`받을 금액 함정 ${u}: ${usdTrap(u)}`); });
    if (BK.digits('555-0147') !== 'five-five-five, oh-one-four-seven') bad.push(`번호 읽기: ${BK.digits('555-0147')}`);
    if (BK.bigRead('555-0147') !== 'five hundred fifty-five, one hundred forty-seven') bad.push(`번호 큰 수 읽기: ${BK.bigRead('555-0147')}`);
    if (BK.roomWords(412) !== 'four-twelve' || BK.roomWords(405) !== 'four-oh-five') bad.push(`방 번호 읽기: ${BK.roomWords(412)} · ${BK.roomWords(405)}`);
    if (BK.phoneTrap('555-0147') !== '555-0174' || BK.roomTrap(412) !== 421 || BK.zipTrap('40213') !== '40231') bad.push('함정 숫자 만들기가 달라요');
    BK.PHONES.forEach(p => { if (BK.phoneTrap(p) === p || BK.PHONES.includes(BK.phoneTrap(p))) bad.push(`번호 함정 ${p}: ${BK.phoneTrap(p)}`); });
    BK.ROOMS.forEach(r => { if (BK.roomTrap(r) === r || BK.ROOMS.includes(BK.roomTrap(r))) bad.push(`방 번호 함정 ${r}: ${BK.roomTrap(r)}`); });
    [['three hundred thousand won', '300000'], ['300,000 won', '300000'], ['two hundred forty dollars', '240'], ['$240', '240'], ['five five five oh one four seven', '5550147'], ['555-0147', '5550147'], ['four twelve', '412'], ['four oh two one three', '40213'], ['fifteen', '15'], ['sixty', '60'], ['three million', '3000000'], ['a hundred and sixty', '160'], ['two hundred', '200']].forEach(([s, r]) => { if (!BK.canon(s).includes(r)) bad.push(`숫자 맞추기 ${s}: ${BK.canon(s).join(' ')}`); });
    [['I\'d like to change 300,000 won into US dollars, please.', 'I\'d like to change three hundred thousand won into US dollars, please.'], ['So, that\'s $240?', 'So, that\'s two hundred forty dollars?'], ['It\'s 555-0147.', 'It\'s five-five-five, oh-one-four-seven.'],
      ['It\'s Room 412, Maple Hall, 200 College Avenue, Kellport, 40213.', 'It\'s Room four-twelve, Maple Hall, two hundred College Avenue, Kellport, four-oh-two-one-three.'], ['15 GB, please.', 'fifteen gigabytes, please.'], ['For 6 months.', 'For six months.']].forEach(([s, w]) => { if (BK.spoken(s) !== w) bad.push(`읽을 글: ${BK.spoken(s)}`); });
    if (BK.fx(BK.DEMO.won) !== BK.Q.fx_get.fact.usd) bad.push('fx_get 금액이 환전 계산과 달라요');
    if (BK.planCost(BK.DEMO.plan, BK.DEMO.data) !== BK.Q.sh_cost.fact.amount) bad.push('sh_cost 값이 요금표와 달라요');
    if (BK.DEMO.phone !== BK.Q.sm_num.fact.phone || BK.Q.sm_fast.fact.phone !== BK.DEMO.phone) bad.push('sm_num 번호가 DEMO와 달라요');
    // 주소 한 줄: 모든 방 · 건물로 모범 줄 · 말로 한 줄 · 함정 조각
    BK.ROOMS.forEach(room => BK.HALL_IDS.forEach(hall => {
      const A = { room, hall }, ml = BK.modelLine(A), C = { addr: A }, jl = BK.checkLine(ml.line, C);
      if (!jl.ok) bad.push(`주소 ${room} ${hall}: 모범 줄이 탈락 (${BK.lineText(ml.line)})`);
      const pl = BK.parseLine(BK.spoken(BK.lineText(ml.line)));
      if (JSON.stringify(pl) !== JSON.stringify(ml.line.words)) bad.push(`주소 ${room} ${hall}: 말로 한 줄을 다르게 읽어요 (${pl.join(' ')})`);
      const pr = BK.parseLine(BK.lineText(ml.line));
      if (JSON.stringify(pr) !== JSON.stringify(ml.line.words)) bad.push(`주소 ${room} ${hall}: 숫자로 쓴 줄을 다르게 읽어요 (${pr.join(' ')})`);
    }));
    const DC = { addr: A0 }, lc = (w, Lw, c, f) => { const r = BK.checkLine(Lw, c); if (!f(r)) bad.push(`주소 한 줄 ${w}: ${JSON.stringify({ ok: r.ok, stage: r.stage, tag: r.tag, ko: r.ko, err: r.err && r.err.type, missing: r.missing })}`); return r; };
    lc('맞는 줄', BK.LINE, DC, r => r.ok);
    lc('It\'s 없이', { words: BK.LINE.words.slice(1) }, DC, r => r.ok);
    lc('한국식 차례', BK.LINE_KO, DC, r => !r.ok && r.tag === 'order' && r.ko);
    lc('College Avenue 200', BK.LINE_K, DC, r => !r.ok && r.tag === 'literal');
    lc('방 번호', BK.LINE_ROOM, DC, r => !r.ok && r.tag === 'fact' && r.err.type === 'room' && /four-twelve/.test(r.why));
    lc('우편번호', BK.LINE_ZIP, DC, r => !r.ok && r.tag === 'fact' && r.err.type === 'city');
    lc('건물', { words: ['its', 'r412', 'cedar', 's200', 'z40213'] }, DC, r => !r.ok && r.tag === 'fact' && r.err.type === 'hall');
    lc('번지', { words: ['its', 'r412', 'maple', 's300', 'z40213'] }, DC, r => !r.ok && r.tag === 'fact' && r.err.type === 'st');
    lc('빠진 조각', BK.LINE_MISS, DC, r => !r.ok && r.tag === 'need' && r.missing.join() === 'st');
    lc('순서', BK.LINE_BAD, DC, r => !r.ok && r.tag === 'order' && !r.ko);
    lc('두 번', { words: ['its', 'r412', 'r412', 'maple', 's200', 'z40213'] }, DC, r => !r.ok && r.tag === 'order');
    if (!/Room 421/.test(BK.fixLine(BK.LINE_ROOM, DC).en)) bad.push(`고쳐 주는 말 (방 번호): ${BK.fixLine(BK.LINE_ROOM, DC).en}`);
    if (!/street address/.test(BK.fixLine(BK.LINE_MISS, DC).en)) bad.push(`고쳐 주는 말 (빠진 조각): ${BK.fixLine(BK.LINE_MISS, DC).en}`);
    if (!/200 College Avenue/.test(BK.fixLine(BK.LINE_K, DC).en)) bad.push(`고쳐 주는 말 (번지): ${BK.fixLine(BK.LINE_K, DC).en}`);
    if (BK.fixLine(BK.LINE, DC).en !== 'Great, thank you.') bad.push(`고쳐 주는 말 (맞음): ${BK.fixLine(BK.LINE, DC).en}`);
    // 연습 문제
    const pos = [0, 0, 0, 0];
    BK.DRILL.forEach((it, i) => {
      const w = `듣고 대답 고르기 ${i + 1}`;
      if (!it.Q) { bad.push(`${w}: 말 ${it.q}가 없어요`); return; }
      const good = it.opts.map((_, k) => k).filter(k => BK.judgeItem(it, k).ok);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]} (${it.opts.map((_, k) => BK.judgeItem(it, k).why).join(' | ')})`);
      const texts = it.opts.map(BK.text);
      if (new Set(texts).size !== texts.length) bad.push(`${w}: 같은 보기가 있어요`);
      if (!it.sit) bad.push(`${w}: 상황 글이 없어요`);
      const st = BK.steps(it); if (st.length !== 3 || st.some(s => !s.text)) bad.push(`${w}: 풀이 단계가 비었어요`);
      pos[it.a]++;
    });
    if (BK.DRILL.length !== 16) bad.push(`듣고 대답 고르기 ${BK.DRILL.length}문제`);
    if (Math.max(...pos) - Math.min(...pos) > 0) bad.push(`듣고 대답 고르기 정답 위치가 몰려 있어요: ${pos.join(',')}`);
    const places = new Set(BK.DRILL.map(it => it.place));
    BK.PLACES.forEach(p => { if (!places.has(p.id)) bad.push(`듣고 대답 고르기: ${p.ko} 문제가 없어요`); });
    if (BK.DRILL.filter(it => it.Q.fast).length < 2) bad.push('듣고 대답 고르기: 빠른 말(다시 묻기) 문제가 둘보다 적어요');
    const yesTrap = BK.DRILL.filter(it => (it.Q.shape === 'or' || it.Q.shape === 'wh') && it.opts.some(a => BK.FRAME[a.f].bare)).length;
    if (yesTrap < 4) bad.push(`듣고 대답 고르기: 고르는 · 정보 질문에 Yes 함정이 있는 문제가 ${yesTrap}개뿐이에요`);
    if (!BK.DRILL.some(it => !it.Q.fast && it.opts.some(a => a.f === 'line'))) bad.push('듣고 대답 고르기: 주소 한 줄 문제가 없어요');
    if (!BK.DRILL.some(it => it.opts.some((a, k) => { const j = BK.judgeItem(it, k); return j.stage === 2 && j.tag === 'wrong' && BK.FRAME[a.f].aux; }))) bad.push('듣고 대답 고르기: 짝이 다른 짧은 대답 문제가 없어요');
    Object.entries(BK.MINI).forEach(([k, it]) => { const good = it.opts.map((_, i) => i).filter(i => BK.judgeItem(it, i).ok); if (good.length !== 1 || good[0] !== it.a) bad.push(`직접 해 보기 ${k}: 맞는 보기 ${good}`); });
    // 영상 · 직접 해 보기의 대화가 판정과 맞나
    const want = (w, q, a, c, ok) => { const j = BK.judge(q, a, c); if (j.ok !== ok) bad.push(`${w}: ${BK.text(a)} → 판정 ${j.ok ? '✓' : '×'} (${j.why})`); return j; };
    const D = BK.DEMO, SC = BK.SCENE, I0 = BK.INTRO, seq = (w, row, oks, c = D) => oks.forEach((ok, k) => want(`${w} ${k + 1}`, row[0], row[k + 1], c, ok));
    want('00장 만', I0.q, I0.bad, I0.card, false); want('00장 thousand', I0.q, I0.ok, I0.card, true);
    want('00장 I have passport', I0.dq, I0.dbad, D, false); want('00장 Here\'s my passport', I0.dq, I0.dok, D, true);
    want('00장 되짚지 않음', I0.rq, I0.skip, D, false); want('00장 번호 되짚기', I0.rq, I0.check, D, true);
    seq('02장 용건', SC.need, [false, true, true]); seq('02장 금액', SC.won, [false, false, false, true]); seq('02장 지폐', SC.bills, [false, false, true]); seq('02장 받을 금액', SC.get, [false, false, true, true]);
    seq('03장 용건', SC.sim, [false, false, true]); seq('03장 요금제', SC.plan, [false, true]); seq('03장 데이터', SC.data, [false, false, true]); seq('03장 기간', SC.stay, [false, true]);
    seq('03장 빠른 말', SC.dfast, [false, true]); seq('03장 값', SC.cost, [false, true, false, true]);
    seq('04장 잠금', SC.unlock, [false, true]); seq('04장 새 번호', SC.num, [false, false, false, true]); seq('04장 빠른 번호', SC.nfast, [false, true]); seq('04장 자동 충전', SC.top, [false, true, true]);
    seq('05장 용건', SC.acct, [false, false, false, true]); seq('05장 통장', SC.type, [false, false, true]); seq('05장 학생', SC.student, [false, true, true]);
    seq('06장 여권', SC.pass, [false, true]); seq('06장 두 번째 신분증', SC.second, [false, false, true]); seq('06장 주소 증명', SC.proof, [false, true]); seq('06장 주소 증명 없음', SC.noproof, [false, true], Object.assign({}, D, { proof: false })); seq('06장 빠른 말', SC.ifast, [false, true]);
    SC.lines.forEach(([k, a]) => want(`07장 주소 ${k}`, 'fm_addr', a, D, k === 'ok'));
    seq('07장 기숙사', SC.dorm, [false]); seq('07장 전화번호', SC.phone, [false, false, true]); seq('07장 서명', SC.sign, [false, true]); seq('07장 빠른 말', SC.afast, [false, true]);
    seq('08장 직불 카드', SC.debit, [false, true]); seq('08장 비밀번호', SC.pin, [false, true]); seq('08장 ATM', SC.else, [false, false, true]);
    { const j = BK.judge('cd_pin', SC.pin[1], D); if (j.tag !== 'safe') bad.push(`08장 비밀번호: 판정 까닭 ${j.tag}`); }
    { const j = BK.judge('sm_unlock', SC.unlock[1], D); if (j.stage !== 2 || j.tag !== 'wrong') bad.push(`04장 짝: ${j.stage}단계 ${j.tag}`); }
    [['fx_get', BK.Q.fx_get.en], ['sh_cost', BK.Q.sh_cost.en], ['sm_num', BK.Q.sm_num.en]].forEach(([id, en]) => { if (BK.simQ(id, D).en !== en) bad.push(`DEMO와 말이 달라요 ${id}: ${BK.simQ(id, D).en}`); });
    BK.METHOD.forEach(([q, a, c], i) => want(`09장 ${i + 1}`, q, a, Object.assign({}, D, c), true));
    if (BK.METHOD.length !== BK.PLACES.length || BK.METHOD.some(([q], i) => BK.Q[q].place !== BK.PLACES[i].id)) bad.push('09장: 곳마다 한 줄이 아니에요');
    // 실전: 지워지는 단계가 줄 글과 맞나
    BK.PRACTICE.forEach((p, i) => {
      const w = `실전 ${i + 1}`, q = BK.practiceQ(p);
      const J = p.opts.map(a => BK.judge(q, a, BK.PCARD));
      const good = J.map((j, k) => j.ok ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== p.a) bad.push(`${w}: 맞는 보기 ${good}`);
      [1, 2, 3].forEach(st => {
        const gone = J.map((j, k) => j.stage === st ? LL(k) : null).filter(Boolean).sort().join();
        const said = (p.lines[st - 1].match(/\([A-D]\)/g) || []).filter(x => st < 3 || x !== LL(p.a)).sort().join();
        if (gone !== said) bad.push(`${w} ${st}단계: 엔진 ${gone || '-'} · 화면 ${said || '-'}`);
      });
      if (!p.lines[2].includes(`정답 ${LL(p.a)}`)) bad.push(`${w}: 정답 표시가 달라요`);
      if (!p.lines[2].includes(BK.text(p.opts[p.a]).replace(/\.$/, ''))) bad.push(`${w}: 정답 글이 달라요 (${BK.text(p.opts[p.a])})`);
    });
    // 시뮬레이터: 카드 여럿 — 모범 대답은 통과, 틀 칩 가운데 맞는 것이 하나뿐인지, 모범 대답을 말로 해도 통과하는지
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 60; n++) {
      const c = BK.newCard(rnd);
      if (BK.cardRows(c).some(r => r[1].includes(c.phone))) bad.push('시뮬레이터: 새 번호가 카드에 보여요');
      BK.simQs(c).forEach(id => {
        const q = BK.simQ(id, c), C = Object.assign({}, c, q.fact || {}), m = BK.model(q, C), j = BK.judge(q, m, C);
        if (!j.ok) bad.push(`시뮬레이터 ${id}: 모범 대답이 탈락 (${BK.text(m)} · ${j.why})`);
        const ms = BK.matchSpoken(BK.spoken(BK.text(m)), q, C);
        if (!ms.ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 말로 해도 통과하지 못해요 (${BK.text(m)} · ${ms.why})`);
        const ms2 = BK.matchSpoken(BK.text(m), q, C);
        if (!ms2.ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 숫자 그대로 받아 적어도 통과하지 못해요 (${BK.text(m)} · ${ms2.why})`);
        if (BK.shapeGuess(q.en) !== q.shape) bad.push(`시뮬레이터 ${id}: 모양 ${q.shape} · 글 ${BK.shapeGuess(q.en)} (${q.en})`);
        q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`시뮬레이터 ${id}: 열쇠 낱말 ‘${k}’가 말에 없어요 (${q.en})`); });
        const fr = BK.simFrames(q.intent, C);
        if (!fr) { bad.push(`시뮬레이터 ${id}: 틀 칩이 없어요`); return; }
        if (q.intent === 'addr') {
          const chips = BK.lineChips(C, rnd), mw = m.line.words.filter(w => w !== 'its');
          if (chips.length !== mw.length) bad.push(`시뮬레이터 주소: 조각 자리 ${chips.length} · 모범 조각 ${mw.length}`);
          chips.forEach((g, k) => {
            if (!g.ids.includes(mw[k])) bad.push(`시뮬레이터 주소: ${k + 1}번째 자리에 맞는 조각(${mw[k]})이 없어요 (${g.ids})`);
            g.ids.filter(x => x !== mw[k]).forEach(x => { const w2 = ['its'].concat(mw.map((y, i) => i === k ? x : y)); if (!BK.OW[x]) bad.push(`시뮬레이터 주소: 조각 ${x}가 없어요`); else if (BK.judge(q, L(w2), C).ok) bad.push(`시뮬레이터 주소: 함정 조각 ${x}가 통과해요`); });
          });
          if (BK.judge(q, o('ad_dorm'), C).ok) bad.push('시뮬레이터 주소: I live in a dormitory.가 통과해요');
          return;
        }
        const okN = fr.filter(f => { const F = BK.FRAME[f]; if (!F.slot) return BK.judge(q, { f }, C).ok; return BK.slotChoices(F.slot, C, rnd, q).some(v => BK.judge(q, { f, v }, C).ok); }).length;
        if (okN !== 1) bad.push(`시뮬레이터 ${id}: 맞는 틀이 ${okN}개예요 (${fr.join(',')})`);
        fr.forEach(f => { const F = BK.FRAME[f]; if (F.slot && !BK.slotChoices(F.slot, C, rnd, q).length) bad.push(`시뮬레이터 ${id}: ${f}의 칸 칩이 없어요`); });
        if (!fr.includes(m.f)) bad.push(`시뮬레이터 ${id}: 틀 칩에 모범 틀(${m.f})이 없어요`);
        const F = BK.FRAME[m.f];
        if (F.slot) { const ch = BK.slotChoices(F.slot, C, rnd, q), okv = ch.filter(v => BK.judge(q, { f: m.f, v }, C).ok); if (okv.length !== 1) bad.push(`시뮬레이터 ${id}: ${m.f}의 칸 칩 가운데 맞는 값이 ${okv.length}개예요 (${ch})`); if (ch.length < 2) bad.push(`시뮬레이터 ${id}: ${m.f}의 칸 칩이 ${ch.length}개뿐이에요`); }
      });
    }
    // 말로 대답하기: 모양 · 다른 값 · 콩글리시 · 짐작은 통과하지 않아야
    const rep = (w, raw, q, c, k) => { const r = BK.matchSpoken(raw, q, c); if (r.ok || r.repair !== k) bad.push(`말로 대답하기 ${w}: ‘${raw}’ → ${r.ok ? '통과' : r.repair || '탈락'} (${r.why})`); return r; }, nope = (w, raw, q, c) => { const r = BK.matchSpoken(raw, q, c); if (r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과해요`); return r; }, yep = (w, raw, q, c) => { const r = BK.matchSpoken(raw, q, c); if (!r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과하지 않아요 (${r.why})`); return r; };
    Object.values(BK.Q).filter(q => (q.shape === 'or' || q.shape === 'wh') && !q.fast).forEach(q => { ['yes', 'yes please', 'yeah sure'].forEach(y => nope(`${q.id} ${y}`, y, q, D)); });
    yep('환전 용건', 'I\'d like to change three hundred thousand won into US dollars, please.', 'fx_help', D); yep('환전 용건 숫자', 'I\'d like to change 300,000 won into US dollars, please.', 'fx_help', D);
    yep('환전 용건만', 'I\'d like to change some money, please.', 'fx_help', D); nope('만', 'I\'d like to change thirty man won.', 'fx_help', D); nope('환전 3만', 'I\'d like to change thirty thousand won, please.', 'fx_help', D);
    yep('금액', 'Three hundred thousand won, please.', 'fx_much', D); yep('금액 숫자', '300,000 won, please.', 'fx_much', D); nope('3만', 'Thirty thousand won, please.', 'fx_much', D); nope('300만', 'Three million won, please.', 'fx_much', D); nope('만 그대로', 'Thirty man won, please.', 'fx_much', D);
    yep('지폐', 'Small bills, please.', 'fx_bills', D); nope('paper', 'Small paper, please.', 'fx_bills', D); nope('큰 지폐', 'Large bills, please.', 'fx_bills', D);
    yep('받을 금액 되짚기', 'So, that\'s two hundred forty dollars?', 'fx_get', D); yep('받을 금액 되묻기', 'Sorry, did you say two hundred forty?', 'fx_get', D); nope('fourteen', 'So, that\'s two hundred fourteen dollars?', 'fx_get', D); nope('받을 금액 되짚지 않음', 'Okay, thanks.', 'fx_get', D);
    yep('여권', 'Sure. Here\'s my passport.', 'fx_pass', D);
    yep('유심', 'I\'d like to get a SIM card for my phone, please.', 'sh_help', D); nope('개통', 'I want to open my phone.', 'sh_help', D); nope('USIM', 'USIM card, please.', 'sh_help', D);
    yep('선불', 'Prepaid, please.', 'sh_plan', D); nope('월 요금제', 'A monthly plan, please.', 'sh_plan', D);
    yep('데이터', 'Fifteen gigabytes, please.', 'sh_data', D); yep('데이터 GB', '15 GB, please.', 'sh_data', D); nope('fifty', 'Fifty gigabytes, please.', 'sh_data', D); nope('data free', 'Data free, please.', 'sh_data', { data: 'unl' }); yep('무제한', 'Unlimited data, please.', 'sh_data', { data: 'unl' });
    yep('기간', 'For six months.', 'sh_stay', D); nope('during', 'During six months.', 'sh_stay', D); nope('다른 기간', 'For four months.', 'sh_stay', D);
    yep('카드로', 'Can I pay by card?', 'sh_cost', D); nope('Card is okay', 'Card is okay?', 'sh_cost', D); rep('값 되묻기', 'Sorry, did you say thirty dollars?', 'sh_cost', D, 'check'); nope('값 되묻기 thirteen', 'Sorry, did you say thirteen dollars?', 'sh_cost', D);
    yep('잠금 해제', 'Yes, it is.', 'sm_unlock', D); nope('잠금 안 됨', 'No, it isn\'t.', 'sm_unlock', D);
    yep('새 번호', 'So, it\'s five five five, oh one four seven?', 'sm_num', D); yep('새 번호 숫자', 'So, it\'s 555-0147?', 'sm_num', D); nope('큰 수로 읽기', 'So, it\'s five hundred fifty-five, one hundred forty-seven?', 'sm_num', D);
    nope('끝 바꿈', 'So, it\'s five five five, oh one seven four?', 'sm_num', D); nope('번호 되짚지 않음', 'Okay, thanks.', 'sm_num', D);
    rep('빠른 번호 되묻기', 'Sorry, could you say the number again, slowly?', 'sm_fast', D, 'again'); nope('빠른 번호 짐작', 'So, it\'s 555-0147?', 'sm_fast', D);
    rep('top-up 묻기', 'Sorry, what does top-up mean?', 'sm_top', D, 'what'); yep('직접 충전', 'No, thanks. I\'ll top it up myself.', 'sm_top', D); nope('charge', 'No. I\'ll charge it myself.', 'sm_top', D); nope('자동 충전 Yes', 'Yes, please.', 'sm_top', D);
    yep('계좌', 'I\'d like to open a bank account, please.', 'tl_help', D); nope('bankbook', 'I want to make a bankbook.', 'tl_help', D); nope('사실만', 'I\'m an exchange student.', 'tl_help', D);
    yep('입출금', 'A checking account, please.', 'tl_type', D); nope('저축', 'A savings account, please.', 'tl_type', D);
    yep('학생', 'Yes, I am. I\'m an exchange student.', 'tl_student', D); nope('학생 아님', 'No, I\'m not.', 'tl_student', D);
    yep('두 번째 신분증', 'Yes, I do. Here\'s my student ID.', 'id_second', D);
    yep('주소 증명', 'Yes, I do. Here\'s my housing contract.', 'id_proof', D); yep('주소 증명 없음', 'No, I don\'t. Would a letter from my university work?', 'id_proof', { proof: false });
    nope('없다고만', 'No, I don\'t.', 'id_proof', { proof: false }); nope('계약서 없는데', 'Yes, here\'s my housing contract.', 'id_proof', { proof: false }); nope('dormitory paper', 'Yes. Here\'s my dormitory paper.', 'id_proof', D);
    rep('빠른 신분증 되묻기', 'Sorry, did you ask for my ID?', 'id_fast', D, 'again'); nope('빠른 신분증 짐작', 'Here\'s my passport.', 'id_fast', D);
    yep('주소', BK.spoken(BK.lineText(BK.LINE)), 'fm_addr', D); yep('주소 숫자', BK.lineText(BK.LINE), 'fm_addr', D);
    nope('한국식 주소', 'It\'s Kellport, 40213, 200 College Avenue, Maple Hall, Room 412.', 'fm_addr', D); nope('College Avenue 200', 'It\'s Room 412, Maple Hall, College Avenue 200, Kellport, 40213.', 'fm_addr', D);
    nope('방 번호 421', 'It\'s Room 421, Maple Hall, 200 College Avenue, Kellport, 40213.', 'fm_addr', D); nope('기숙사만', 'I live in a dormitory.', 'fm_addr', D);
    rep('빠른 주소 되묻기', 'Sorry, did you ask for my address?', 'fm_fast', D, 'again');
    yep('전화번호', 'It\'s five five five, oh one four seven.', 'fm_phone', D); nope('다른 번호', 'It\'s five five five, oh one seven four.', 'fm_phone', D); nope('번호 큰 수', 'It\'s five hundred fifty-five, one hundred forty-seven.', 'fm_phone', D);
    yep('서명', 'Sure. Right here?', 'fm_sign', D); nope('my sign', 'Okay. I\'ll do my sign.', 'fm_sign', D);
    yep('직불 카드', 'Yes, please.', 'cd_debit', D); nope('check card', 'Yes, a check card, please.', 'cd_debit', D); nope('직불 카드 No', 'No, thanks.', 'cd_debit', D);
    yep('비밀번호', 'Okay. Thank you.', 'cd_pin', D); nope('비밀번호 말하기', 'It\'s seven three nine one.', 'cd_pin', D);
    yep('ATM', 'Yes. Could you tell me where the nearest ATM is?', 'cd_else', D); nope('Yes만', 'Yes.', 'cd_else', D); nope('물어볼 것 없음', 'No, that\'s everything. Thank you!', 'cd_else', D); yep('다 됐어요', 'No, that\'s everything. Thank you!', 'cd_else', { ask: null });
    // 따라 말하기: 같은 말은 모두 맞아야 · 숫자 낱말로 말해도 맞아야
    BK.SHADOW.forEach((s, i) => { const r = BK.compareWords(s.en, s.en), r2 = BK.compareWords(s.en, BK.spoken(s.en)); if (r.hit !== r.total || r2.hit !== r2.total) bad.push(`따라 말하기 ${i + 1}: 같은 글이 다 맞지 않아요`); if (!BK.PLACE[s.place]) bad.push(`따라 말하기 ${i + 1}: 곳이 없어요`); });
    if (BK.SHADOW.length !== 28) bad.push(`따라 말하기 문장 수: ${BK.SHADOW.length}`);
    BK.PLACES.forEach(p => { if (BK.SHADOW.filter(s => s.place === p.id).length !== 4) bad.push(`따라 말하기: ${p.ko} 문장이 넷이 아니에요`); });
    bad.forEach(b => console.warn('[은행 · 환전 · 휴대폰] ' + b));
    return bad;
  };

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  BK.allText = function () {
    const out = [];
    Object.values(BK.Q).forEach(q => out.push(q.en, q.ko, q.short || ''));
    Object.values(BK.FRAME).forEach(F => out.push(F.t || '', F.ko || '', F.why || '', F.note || ''));
    Object.values(BK.SLOT).forEach(S => Object.values(S.vals || {}).forEach(v => out.push(Object.values(v).filter(x => typeof x === 'string').join(' '))));
    Object.values(BK.SHAPE).forEach(a => out.push(a.ko, a.mark, a.ans, a.say, a.offer || '')); Object.values(BK.INTENT).forEach(a => out.push(a.ans || '', a.want || '', a.say || '', a.turn || ''));
    Object.values(BK.AUX).forEach(a => out.push(a.q, a.a));
    BK.PLACES.forEach(p => out.push(p.ko, p.en, p.en.toUpperCase()));
    [BK.BILLS, BK.PLANS, BK.DATA, BK.MONTHS_STAY, BK.DOCS, BK.HALLS].forEach(T => Object.values(T).forEach(x => out.push(x.t, x.ko, String(x.t).toUpperCase())));
    BK.WONS.concat(BK.WONS.map(w => w / 10), BK.WONS.map(w => w * 10)).forEach(w => out.push(BK.wonText(w), BK.wonWords(w), BK.wonKo(w)));
    BK.WONS.forEach(w => { const u = BK.fx(w); [u, usdTrap(u), u + 1000].forEach(c => out.push(BK.money(c), BK.priceWords(c), BK.priceKo(c))); });
    Object.values(BK.COST).forEach(r => Object.values(r).forEach(c => [c, moneyTrap(c)].forEach(x => out.push(BK.money(x), BK.priceWords(x), BK.priceKo(x)))));
    BK.PHONES.forEach(p => out.push(p, BK.digits(p), BK.bigRead(p), BK.phoneTrap(p)));
    BK.ROOMS.forEach(r => { out.push(BK.roomWords(r), BK.roomWords(BK.roomTrap(r))); BK.HALL_IDS.forEach(h => out.push(BK.addrEn({ room: r, hall: h }), BK.addrKo({ room: r, hall: h }))); });
    BK.PRACTICE.forEach(p => out.push(p.lines.join(''))); BK.SHADOW.forEach(s => out.push(s.en, s.ko));
    BK.LINKED.forEach(l => out.push(l.en, l.ko, l.sound.map(s => s[0]).join(''))); BK.PAIRS.forEach(p => out.push(p.join('')));
    Object.values(BK.OCAT).forEach(c => out.push((c && c.ko) || '')); Object.values(BK.OW).forEach(w => out.push(w.t, w.ko || '', w.why || '')); Object.values(BK.ERR_KO || {}).forEach(x => out.push(String(x)));
    out.push(BK.CITY, BK.BANK, BK.SHOP, BK.UNI, BK.BANK.toUpperCase(), BK.SHOP.toUpperCase(), BK.UNI.toUpperCase(), BK.STREET, BK.ZIP, String(BK.RATE), BK.PINS.join(' '),
      '$0123456789.,:·+×–%→#-₩',
      'CURRENCY EXCHANGE WE BUY WE SELL USD KRW RATE TODAY 1 USD = 1,250 KRW NO COMMISSION BANK TELLER OPEN AN ACCOUNT CHECKING SAVINGS DEBIT CARD ENTER PIN CANCEL CLEAR OK ATM ' +
      'PREPAID MONTHLY PLAN DATA UNLIMITED GB SIM CARD NEW NUMBER TOP UP AUTO UNLOCKED MOBILE SHOP NEW ACCOUNT FORM NAME ADDRESS PHONE SIGNATURE PASSPORT STUDENT ID ' +
      'HOUSING CONTRACT PROOF OF ADDRESS LETTER UNIVERSITY ROOM HALL AVENUE ZIP CODE CITY DATE WON DOLLARS BILLS LARGE SMALL RECEIPT TOTAL FIRST MONTH NEXT PLEASE');
    return out.join('');
  };
})();
