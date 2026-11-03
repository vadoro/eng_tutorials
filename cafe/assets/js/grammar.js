/* 카페 회화 — 규칙 엔진과 대화 자료 (상황별 영어 회화)
 *
 * 카페 주문대에서 바리스타가 묻는 말은 거의 같고, 순서도 거의 정해져 있어요.
 * 음료 → 크기 → 온도 → 옵션 → 이름 → 포장 → 더 살 것 → 계산 → 받기.
 * 규칙 엔진은 소리를 듣지 않고, 문제마다 적어 둔 ‘질문의 뜻(intent)’과 ‘대답 틀(frame) + 내 정보(slot)’,
 * 그리고 주문 카드(또는 상황)의 사실을 맞춰 봐요.
 *
 * 3단계 말하기 법 — CF.judge(질문, 대답, 카드)
 *   ① 열쇠 낱말 잡기 — 대답이 그 질문(intent)에 맞는 대답인가? (무엇 · 고르기 · 확인 · 권하기 · 정보 · 안내 · 부탁)
 *                      빠르게 말해 못 알아들은 질문(fast)이면 짐작한 대답은 모두 ①에서 탈락 → 다시 묻기
 *                      (들린 만큼 되묻는 말은 주문 순서로 본 그 차례의 질문일 때만 통과)
 *   ② 틀에 내 정보 넣기 — 대답 틀이 자연스러운가(한국어를 낱말 그대로 옮긴 틀 · 콩글리시 · 틀린 문장이면 탈락),
 *                      칸에 넣은 정보가 카드 · 상황의 사실과 맞는가, 한 문장 주문의 순서(CF.orderLine)가 맞는가
 *   ③ 공손하게 끝내기 — 명령 · 조르는 말 · 따지는 말(blunt)이나 그냥 No.로 끊긴 말(plain)이면 탈락
 * judge → { ok, stage: 0 | 1 | 2 | 3, why, tag }
 *
 * 한 문장 주문: CF.orderLine(낱말) — (Can I get) a + 크기 + 온도 + 음료 + with 옵션 + 포장 의 순서(단순하게 줄인 규칙)
 *               CF.covered(대답, 질문) — 그 대답이 이미 답한 질문의 뜻들 → 시뮬레이터의 바리스타가 건너뜀
 * 값: CF.price(주문) — 메뉴판(지어낸 값)으로 합계를 계산. 영상 · 영수증 · 바리스타의 말이 모두 이 값을 써요.
 *
 * 영상의 ✓·×, 직접 해 보기, 카페 주문 시뮬레이터, 듣고 대답 고르기, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 CF.check()가 콘솔에 경고를 내요.
 */
(function () {
  'use strict';
  const CF = (window.CF = {});
  const L4 = 'ABCD';

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; if (/[0-9]/.test(s[i])) return '0136781'.includes(s[i]) ? 0xAC01 : 0xAC00; if (/[A-Za-z]/.test(s[i])) return /[lmnr]/i.test(s[i]) ? 0xAC01 : 0xAC00; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const rieul = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 === 8 : false; };
  const wa = s => s + (has(s) ? '과' : '와'), eul = s => s + (has(s) ? '을' : '를'), ig = s => s + (has(s) ? '이' : '가');
  const ro = s => s + (has(s) && !rieul(s) ? '으로' : '로'), ieyo = s => s + (has(s) ? '이에요' : '예요');
  CF.josa = { wa, eul, ig, ro, ieyo };

  /* =========================================================
     주문 길 일곱 단계 (영상 · 지도 · 아이콘). sp: 그곳 바리스타의 목소리 (voices.js)
     ========================================================= */
  CF.PLACES = [
    { id: 'door', ko: '문 · 줄 서기', en: 'Door · Line', sp: 'us' },
    { id: 'counter', ko: '메뉴판 · 주문대', en: 'Menu · Order', sp: 'us' },
    { id: 'size', ko: '크기 · 온도', en: 'Size · Hot or iced', sp: 'us' },
    { id: 'option', ko: '옵션', en: 'Options', sp: 'us' },
    { id: 'name', ko: '이름 · 포장', en: 'Name · To go', sp: 'us' },
    { id: 'pay', ko: '계산대', en: 'Pay', sp: 'us' },
    { id: 'pickup', ko: '픽업대', en: 'Pickup', sp: 'au' },
  ];
  CF.PLACE = {}; CF.PLACES.forEach((p, i) => { p.i = i; CF.PLACE[p.id] = p; });
  CF.ME = 'me';   // 손님(나)의 목소리
  CF.CAFE = 'Pebble Café';   // 지어낸 가게 이름

  /* =========================================================
     질문의 종류(① 열쇠 낱말이 알려 주는 것)와 질문의 뜻(intent)
     ========================================================= */
  CF.ASK = {
    what: { ko: '무엇', say: '무엇을 주문할지 물어요' },
    choice: { ko: '고르기', say: '둘(셋) 가운데 하나를 고르라는 말이에요' },
    yesno: { ko: '확인', say: '그런지 아닌지 확인하는 질문이에요' },
    offer: { ko: '권하기', say: '무엇을 권하는 말이에요' },
    info: { ko: '정보', say: '정보 하나를 묻는 질문이에요' },
    notice: { ko: '안내', say: '알려 주는 말이에요' },
    need: { ko: '부탁', say: '무엇이 필요한지 묻는 말이에요' },
    repair: { ko: '다시 묻기', say: '다시 묻는 말이에요' },
  };
  // ans: 이 뜻의 질문을 한국어로 (① 탈락 까닭: "이 대답은 ○○에 맞는 말이에요") · turn: 주문 순서에서 부르는 이름
  // want: 기대하는 대답 한 줄 · best: 모범 대답 틀(카드에 따라 바뀌면 함수)
  const I = (ask, ans, want, best, o = {}) => Object.assign({ ask, ans, want, best }, o);
  CF.INTENT = {
    ready: I('yesno', '주문할 준비가 됐는지 묻는 질문', '아직이면 → Not yet. Just a minute, please.', c => c.ready === false ? 'rd_min' : 'rd_yes', { say: '주문할 준비가 됐는지 확인하는 질문이에요', turn: '줄 서기' }),
    order: I('what', '무엇을 주문할지 묻는 질문', 'Can I get + 음료? 또는 I\'d like + 음료, please.', 'or_can', { turn: '음료 고르기' }),
    size: I('choice', '크기를 고르라는 질문(What size)', '고른 크기 + please → Medium, please.', 'sz_pl', { say: '크기를 고르라는 말이에요', turn: '크기' }),
    temp: I('choice', '온도를 고르라는 질문(Hot or iced)', '고른 것 + please → Iced, please.', 'tp_pl', { say: '따뜻한 것과 차가운 것 가운데 고르라는 말이에요', turn: '온도' }),
    milk: I('choice', '우유 종류를 고르라는 질문', '고른 우유 + please → Oat milk, please.', 'mk_pl', { say: '우유 종류를 고르라는 말이에요', turn: '우유' }),
    milkok: I('yesno', '일반 우유로 괜찮은지 묻는 질문', '괜찮으면 Yes, that\'s fine. 바꾸려면 Can I get it with + 우유?', c => c.milk && c.milk !== 'whole' ? 'mk_with' : 'mk_fine', { say: '일반 우유로 괜찮은지 확인하는 질문이에요', turn: '우유' }),
    shot: I('offer', '샷을 더 넣을지 권하는 말', '원하면 Yes, please. 아니면 No, thanks.', c => c.shot ? 'of_yes' : 'of_no', { say: '샷을 하나 더 넣을지 권하는 말이에요', turn: '샷' }),
    room: I('offer', '우유 넣을 자리를 남길지 묻는 말', '원하면 Yes, please. 아니면 No, thanks.', c => c.room ? 'of_yes' : 'of_no', { say: '우유를 넣을 빈자리(room)를 남길지 묻는 말이에요', turn: '우유 자리' }),
    custom: I('need', '음료에서 바꿀 것이 있는지 묻는 말', 'Can I get it with + 옵션? · No + 옵션, please.', c => CF.SLOT.chgw.vals[c.chg] ? 'cu_with' : 'cu_no', { say: '음료에 더하거나 바꿀 것이 있는지 묻는 말이에요', turn: '옵션' }),
    name: I('info', '컵에 적을 이름을 묻는 질문', 'It\'s + 이름 → It\'s Minji.', 'nm_its', { say: '컵에 적을 이름을 물어요', turn: '이름' }),
    togo: I('choice', '여기서 마실지 가져갈지 묻는 질문', 'To go, please. 또는 For here, please.', 'tg_pl', { say: '여기서 마실지, 가져갈지 고르라는 말이에요', turn: '포장(For here or to go)' }),
    more: I('yesno', '더 주문할 것이 있는지 묻는 질문', '없으면 No, that\'s it. Thanks. 있으면 Can I also get + 먹을 것?', c => c.more && c.more !== 'none' ? 'el_also' : 'el_no', { say: '더 주문할 것이 있는지 확인하는 질문이에요', turn: '더 살 것' }),
    pay: I('choice', '계산 방법을 고르라는 질문(Card or cash)', '고른 것 + please → Card, please.', 'py_pl', { say: '카드로 낼지, 현금으로 낼지 고르라는 말이에요', turn: '계산' }),
    receipt: I('offer', '영수증이 필요한지 묻는 말', '필요하면 Yes, please. 아니면 No, thanks.', c => c.receipt ? 'of_yes' : 'of_no', { say: '영수증이 필요한지 묻는 말이에요', turn: '영수증' }),
    call: I('notice', '내 음료가 나왔다는 안내', '받으면서 → That\'s me. Thanks!', 'cl_me', { say: '주문한 음료가 나왔다고 이름을 부르는 말이에요', turn: '받기' }),
    help: I('need', '무엇이 필요한지 묻는 말', '필요한 것 → Could I get ___, please? · 문제 → Excuse me, I ordered …', c => c.need === 'temp' ? 'hp_iced' : 'hp_could', { turn: '부탁' }),
    repair: I('repair', '다시 묻는 말', '', 'rp_again'),
    // 다른 질문에 맞는 대답 (① 함정에만 쓰고 질문으로는 나오지 않음)
    g_yes: I('yesno', 'Yes · No로 묻는 질문', '', null, { generic: true }),
    g_offer: I('offer', '무엇을 권하는 말(…드릴까요?)', '', null, { generic: true }),
    g_permit: I('yesno', '허락을 묻는 질문(Can I …? → 해도 돼요?)', '', null, { generic: true }),
  };
  CF.sayOf = intent => { const it = CF.INTENT[intent]; return it.say || CF.ASK[it.ask].say; };

  /* =========================================================
     질문 (바리스타가 하는 말). key: 열쇠 낱말(질문 안에 꼭 있어야 함) · fast: 너무 빨라 못 알아들은 말 · short: 지도에 쓰는 짧은 꼴
     ========================================================= */
  CF.Q = {};
  const Q = (id, place, intent, en, ko, key, o = {}) => (CF.Q[id] = Object.assign({ id, place, intent, en, ko, key, sp: CF.PLACE[place].sp }, o));
  Q('dr_next', 'door', null, 'Next in line, please!', '다음 분 오세요!', ['Next'], { notice: true, short: 'Next, please!' });
  Q('dr_ready', 'door', 'ready', 'Hi! Are you ready to order?', '안녕하세요! 주문하시겠어요?', ['ready to order'], { short: 'Ready to order?' });
  Q('co_what', 'counter', 'order', 'Hi! What can I get you?', '안녕하세요! 무엇을 드릴까요?', ['What can I get'], { short: 'What can I get you?' });
  Q('co_like', 'counter', 'order', 'What would you like?', '무엇으로 하시겠어요?', ['What would you like']);
  Q('co_fast', 'counter', 'order', 'Hey there, what can I get started for you today?', '안녕하세요, 오늘은 무엇으로 준비해 드릴까요?', ['what can I get'], { fast: true });
  Q('sz_size', 'size', 'size', 'What size?', '어떤 크기로 드릴까요?', ['size']);
  Q('sz_which', 'size', 'size', 'Small, medium, or large?', '스몰, 미디엄, 라지 가운데 어느 것으로요?', ['Small, medium, or large']);
  Q('sz_fast', 'size', 'size', 'And what size would you like for that today?', '그리고 그건 어떤 크기로 드릴까요?', ['size'], { fast: true });
  Q('tp_temp', 'size', 'temp', 'Hot or iced?', '따뜻한 걸로 드릴까요, 차가운 걸로 드릴까요?', ['Hot or iced']);
  Q('op_milk', 'option', 'milk', 'What kind of milk?', '우유는 어떤 걸로 드릴까요?', ['kind of milk']);
  Q('op_milkok', 'option', 'milkok', 'Is whole milk okay?', '일반 우유 괜찮으세요?', ['whole milk okay']);
  Q('op_shot', 'option', 'shot', 'Would you like an extra shot?', '샷을 하나 더 넣어 드릴까요?', ['extra shot'], { short: 'Extra shot?' });
  Q('op_room', 'option', 'room', 'Room for milk?', '우유 넣을 자리를 남겨 드릴까요?', ['Room for milk']);
  Q('op_add', 'option', 'custom', 'Anything you\'d like to add or change?', '더하거나 바꾸고 싶은 것이 있으세요?', ['add or change']);
  Q('nm_name', 'name', 'name', 'Can I get a name for that?', '주문하신 분 이름이 어떻게 되세요?', ['name'], { short: 'Name for that?' });
  Q('nm_togo', 'name', 'togo', 'For here or to go?', '여기서 드세요, 가져가세요?', ['For here or to go']);
  Q('nm_uk', 'name', 'togo', 'Eat in or take away?', '드시고 가세요, 가져가세요? (영국)', ['Eat in or take away'], { sp: 'gb' });
  Q('nm_fast', 'name', 'togo', 'And will that be for here or to go?', '그리고 여기서 드실 건가요, 가져가실 건가요?', ['for here or to go'], { fast: true });
  Q('pa_more', 'pay', 'more', 'Anything else?', '더 필요한 것 있으세요?', ['Anything else']);
  Q('pa_total', 'pay', null, 'That\'ll be $6.50.', '6달러 50센트입니다.', ['$6.50'], { notice: true });
  Q('pa_pay', 'pay', 'pay', 'Card or cash?', '카드로 하시겠어요, 현금으로 하시겠어요?', ['Card or cash']);
  Q('pa_tap', 'pay', null, 'You can tap your card right here.', '여기에 카드를 대시면 돼요.', ['tap'], { notice: true });
  Q('pa_receipt', 'pay', 'receipt', 'Would you like a receipt?', '영수증 드릴까요?', ['receipt'], { short: 'Receipt?' });
  Q('pk_call', 'pickup', 'call', 'Medium iced latte for Minji!', '민지 님, 미디엄 아이스 라테 나왔어요!', ['for Minji'], { short: 'Latte for Minji!' });
  Q('pk_help', 'pickup', 'help', 'Hi, can I help you?', '네, 무엇을 도와드릴까요?', ['help']);
  // 단계마다 대표 질문 (영상 01장 지도 · 직접 해 보기)
  CF.ROUTE = {
    door: ['dr_next', 'dr_ready'], counter: ['co_what', 'co_like'], size: ['sz_size', 'tp_temp'], option: ['op_milk', 'op_shot'],
    name: ['nm_name', 'nm_togo'], pay: ['pa_more', 'pa_pay'], pickup: ['pk_call'],
  };

  /* =========================================================
     칸에 넣는 내 정보 (slot). 틀(frame)이 form으로 어느 꼴을 쓸지 정해요.
     fact: 이 값이 말하는 사실(없으면 { key: 값 }) · bad · why: 콩글리시 값(② 탈락) · base: 시뮬레이터에 쓰는 기본 음료
     ========================================================= */
  CF.SLOT = {
    drink: { key: 'drink', vals: {
      americano: { a: 'an americano', bare: 'americano', one: 'one americano', ko: '아메리카노', base: 1 },
      latte: { a: 'a latte', bare: 'latte', one: 'one latte', ko: '라테', base: 1 },
      cappuccino: { a: 'a cappuccino', bare: 'cappuccino', one: 'one cappuccino', ko: '카푸치노', base: 1 },
      mocha: { a: 'a mocha', bare: 'mocha', one: 'one mocha', ko: '모카', base: 1 },
      chai: { a: 'a chai latte', bare: 'chai latte', one: 'one chai latte', ko: '차이 라테', base: 1 },
      icedam: { a: 'an iced americano', bare: 'iced americano', one: 'one iced americano', ko: '아이스 아메리카노', fact: { drink: 'americano', temp: 'iced' } },
      icedlatte: { a: 'an iced latte', bare: 'iced latte', one: 'one iced latte', ko: '아이스 라테', fact: { drink: 'latte', temp: 'iced' } },
      iceam: { a: 'an ice americano', bare: 'ice americano', one: 'one ice americano', ko: '아이스 아메리카노', fact: { drink: 'americano', temp: 'iced' }, bad: 'literal',
        why: '‘아이스 아메리카노’를 그대로 옮긴 말이에요. 알아듣긴 하지만 ice는 ‘얼음’이라는 낱말이에요. 얼음을 넣어 차갑게 만든 음료는 iced → an iced americano.' },
    } },
    size: { key: 'size', vals: { small: { t: 'Small', low: 'small', ko: '스몰' }, medium: { t: 'Medium', low: 'medium', ko: '미디엄' }, large: { t: 'Large', low: 'large', ko: '라지' } } },
    temp: { key: 'temp', vals: { hot: { t: 'Hot', low: 'hot', ko: '따뜻한 것' }, iced: { t: 'Iced', low: 'iced', ko: '차가운 것' } } },
    milk: { key: 'milk', vals: { whole: { t: 'Whole milk', low: 'whole milk', ko: '일반 우유' }, oat: { t: 'Oat milk', low: 'oat milk', ko: '귀리 우유' }, skim: { t: 'Skim milk', low: 'skim milk', ko: '무지방 우유' } } },
    chgw: { key: 'chg', vals: { oat: { t: 'oat milk', ko: '귀리 우유로' }, shot: { t: 'an extra shot', ko: '샷 하나 더 넣어서' }, lessice: { t: 'less ice', ko: '얼음 적게 넣어서' } } },
    chgn: { key: 'chg', vals: { nosugar: { t: 'sugar', ko: '설탕은' }, noice: { t: 'ice', ko: '얼음은' }, nowhip: { t: 'whipped cream', ko: '휘핑크림은' } } },
    name: { key: 'name', vals: { Minji: { t: 'Minji', ko: '민지' }, Jisoo: { t: 'Jisoo', ko: '지수' }, Seoyeon: { t: 'Seoyeon', ko: '서연' }, Doyun: { t: 'Doyun', ko: '도윤' }, Haneul: { t: 'Haneul', ko: '하늘' }, Junho: { t: 'Junho', ko: '준호' } } },
    togo: { key: 'togo', vals: { go: { t: 'To go', ko: '가져갈게요', fact: { togo: true } }, here: { t: 'For here', ko: '여기서 마실게요', fact: { togo: false } } } },
    togouk: { key: 'togo', vals: { away: { t: 'Take away', ko: '가져갈게요', fact: { togo: true } }, eatin: { t: 'Eat in', ko: '먹고 갈게요', fact: { togo: false } } } },
    food: { key: 'more', vals: { muffin: { t: 'a muffin', ko: '머핀' }, croissant: { t: 'a croissant', ko: '크루아상' }, cookie: { t: 'a cookie', ko: '쿠키' } } },
    pay: { key: 'pay', vals: { card: { t: 'Card', ko: '카드' }, cash: { t: 'Cash', ko: '현금' } } },
    need: { key: 'need', vals: { lid: { t: 'a lid', ko: '뚜껑' }, straw: { t: 'a straw', ko: '빨대' }, napkins: { t: 'some napkins', ko: '냅킨' }, sleeve: { t: 'a sleeve', ko: '컵 홀더' } } },
  };
  const valFact = (S, id) => { const x = S.vals[id]; return x && x.fact ? Object.assign({}, x.fact) : { [S.key]: S.num ? Number(id) : id }; };
  CF.valFact = (slot, id) => valFact(CF.SLOT[slot], id);
  // 카드와 맞는 칸 값 (콩글리시 값은 빼고, 음료는 기본 음료만)
  const slotIds = slot => Object.keys(CF.SLOT[slot].vals).filter(id => { const x = CF.SLOT[slot].vals[id]; return !x.bad && (slot !== 'drink' || x.base); });
  CF.slotVal = (slot, C) => slotIds(slot).find(id => { const f = valFact(CF.SLOT[slot], id); return Object.keys(f).every(k => C[k] === f[k]); });
  const CHG_KO = { oat: '귀리 우유로 바꾸기', shot: '샷 하나 더', lessice: '얼음 적게', nosugar: '설탕 빼기', noice: '얼음 빼기', nowhip: '휘핑크림 빼기' };
  const NEED_KO = { temp: '주문과 다른 온도의 음료가 나옴' };

  /* =========================================================
     메뉴판과 값 (지어낸 가게 · 지어낸 값, 단위: 센트)
     ========================================================= */
  CF.SIZES = ['small', 'medium', 'large'];
  CF.MENU = {
    americano: { en: 'Americano', ko: '아메리카노', p: [325, 375, 425] },
    latte: { en: 'Latte', ko: '라테', p: [450, 500, 550] },
    cappuccino: { en: 'Cappuccino', ko: '카푸치노', p: [450, 500, 550] },
    mocha: { en: 'Mocha', ko: '모카', p: [475, 525, 575] },
    chai: { en: 'Chai latte', ko: '차이 라테', p: [425, 475, 525] },
  };
  CF.EXTRA = { oat: { en: 'Oat milk', ko: '귀리 우유', p: 75 }, shot: { en: 'Extra shot', ko: '샷 추가', p: 75 } };   // 일반 · 무지방 우유는 그대로
  CF.FOOD = { muffin: { en: 'Muffin', ko: '머핀', p: 325 }, croissant: { en: 'Croissant', ko: '크루아상', p: 350 }, cookie: { en: 'Cookie', ko: '쿠키', p: 225 } };
  CF.money = c => '$' + (c / 100).toFixed(2);
  const NUMW = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };
  const numWord = n => NUMW[n] != null ? NUMW[n] : n < 100 ? `${NUMW[n - n % 10]}-${NUMW[n % 10]}` : String(n);
  CF.numWord = numWord;
  // 값 읽기: 점 앞 + 점 뒤 (6.50 → six fifty · 4.25 → four twenty-five · 5.00 → five dollars · 3.05 → three oh five)
  CF.priceWords = c => { const d = Math.floor(c / 100), k = c % 100; return !k ? `${numWord(d)} dollars` : `${numWord(d)} ${k < 10 ? 'oh ' + numWord(k) : numWord(k)}`; };
  CF.priceKo = c => { const d = Math.floor(c / 100), k = c % 100; return k ? `${d}달러 ${k}센트` : `${d}달러`; };
  CF.drinkName = o => `${o.size ? o.size[0].toUpperCase() + o.size.slice(1) + ' ' : ''}${o.temp === 'iced' ? 'iced ' : ''}${CF.MENU[o.drink].en.toLowerCase()}`;
  // 컵에 적힌 음료 이름 그대로 부르기 (Medium iced latte)
  CF.callName = o => { const s = CF.drinkName(o); return s[0].toUpperCase() + s.slice(1); };
  CF.price = function (o) {
    const d = CF.MENU[o.drink], items = [];
    items.push({ en: CF.callName(o), ko: `${CF.SLOT.size.vals[o.size].ko} ${o.temp === 'iced' ? '아이스 ' : ''}${d.ko}`, c: d.p[CF.SIZES.indexOf(o.size)] });
    if (o.milk === 'oat') items.push({ en: '+ Oat milk', ko: '귀리 우유', c: CF.EXTRA.oat.p });
    if (o.shot) items.push({ en: '+ Extra shot', ko: '샷 추가', c: CF.EXTRA.shot.p });
    if (o.more && o.more !== 'none') items.push({ en: CF.FOOD[o.more].en, ko: CF.FOOD[o.more].ko, c: CF.FOOD[o.more].p });
    return { items, total: items.reduce((s, x) => s + x.c, 0) };
  };
  // 컵 옆에 적는 짧은 표시 (M · ICED LATTE · OAT · +SHOT)
  CF.cupLines = o => [`${o.size[0].toUpperCase()} · ${o.temp === 'iced' ? 'ICED ' : ''}${CF.MENU[o.drink].en.toUpperCase()}`, [o.milk === 'oat' ? 'OAT' : o.milk === 'skim' ? 'SKIM' : '', o.shot ? '+SHOT' : ''].filter(Boolean).join(' · ')];

  /* =========================================================
     한 문장 주문 — 낱말 조각과 순서: 크기 → 온도 → 음료 → with 옵션 → 포장 (자주 쓰는 순서를 단순하게 줄인 규칙)
     ========================================================= */
  CF.OW = {
    small: { c: 'size', t: 'small', fact: { size: 'small' } }, medium: { c: 'size', t: 'medium', fact: { size: 'medium' } }, large: { c: 'size', t: 'large', fact: { size: 'large' } },
    hot: { c: 'temp', t: 'hot', fact: { temp: 'hot' } }, iced: { c: 'temp', t: 'iced', fact: { temp: 'iced' } },
    americano: { c: 'drink', t: 'americano', fact: { drink: 'americano' } }, latte: { c: 'drink', t: 'latte', fact: { drink: 'latte' } }, cappuccino: { c: 'drink', t: 'cappuccino', fact: { drink: 'cappuccino' } },
    mocha: { c: 'drink', t: 'mocha', fact: { drink: 'mocha' } }, chai: { c: 'drink', t: 'chai latte', fact: { drink: 'chai' } },
    whole: { c: 'with', t: 'whole milk', fact: { milk: 'whole' }, milk: 1 }, oat: { c: 'with', t: 'oat milk', fact: { milk: 'oat' }, milk: 1 }, skim: { c: 'with', t: 'skim milk', fact: { milk: 'skim' }, milk: 1 },
    shot: { c: 'with', t: 'an extra shot', fact: { shot: true } },
    togo: { c: 'togo', t: 'to go', fact: { togo: true } }, here: { c: 'togo', t: 'for here', fact: { togo: false } },
  };
  CF.OCAT = { size: { ko: '크기', n: 1 }, temp: { ko: '온도', n: 2 }, drink: { ko: '음료', n: 3 }, with: { ko: 'with 옵션', n: 4 }, togo: { ko: '포장', n: 5 } };
  CF.article = first => /^[aeiou]/i.test(String(first || '')) ? 'an' : 'a';
  // words: 낱말 id를 말한 순서대로 → { ok, why, want }
  CF.orderLine = function (words) {
    const W = words.map(w => CF.OW[w]);
    if (W.some(x => !x)) return { ok: false, why: '사전에 없는 낱말이 있어요.' };
    const cnt = c => W.filter(x => x.c === c).length;
    if (cnt('drink') !== 1) return { ok: false, why: cnt('drink') ? '음료 이름은 하나만 말해요.' : '음료 이름(latte · mocha …)이 빠졌어요.' };
    for (const c of ['size', 'temp', 'togo']) if (cnt(c) > 1) return { ok: false, why: `${CF.OCAT[c].ko}${has(CF.OCAT[c].ko) ? '은' : '는'} 하나만 말해요.` };
    if (W.filter(x => x.milk).length > 1) return { ok: false, why: '우유는 하나만 골라요.' };
    const want = words.slice().sort((a, b) => CF.OCAT[CF.OW[a].c].n - CF.OCAT[CF.OW[b].c].n);
    for (let i = 1; i < W.length; i++) {
      const p = W[i - 1], q = W[i];
      if (CF.OCAT[q.c].n < CF.OCAT[p.c].n) {
        const why = p.c === 'togo' ? `포장(${p.t})은 맨 끝에 와요.` : `${CF.OCAT[q.c].ko}(${q.t}) → ${CF.OCAT[p.c].ko}(${p.t})보다 앞이에요.`;
        return { ok: false, why: `순서가 뒤섞여 알아듣기 어려워요. ${why} 순서 → 크기 → 온도 → 음료 → with 옵션 → 포장: ${CF.lineText({ open: 'can', words: want })}`, want };
      }
    }
    return { ok: true, why: `순서 → ${W.map(x => CF.OCAT[x.c].ko).filter((k, i, a) => a.indexOf(k) === i).join(' → ')}. 자연스러워요.`, want };
  };
  CF.lineFacts = words => { const f = {}; words.forEach(w => { const x = CF.OW[w]; if (x) Object.assign(f, x.fact); }); return f; };
  function lineSegs(L) {
    const ws = L.words.map(w => CF.OW[w]).filter(Boolean), out = [], art = CF.article(ws[0] && ws[0].c !== 'with' ? ws[0].t : 'x');
    if (L.open === 'like') out.push({ t: 'I\'d like', r: 'pol' }, { t: ` ${art} `, r: 'frame' });
    else if (L.open === 'give') out.push({ t: `Give me ${art} `, r: 'frame' });
    else out.push({ t: 'Can I', r: 'pol' }, { t: ` get ${art} `, r: 'frame' });
    ws.forEach((w, i) => {
      if (w.c === 'with') out.push({ t: i ? (ws[i - 1].c === 'with' ? ' and ' : ' with ') : 'with ', r: 'frame' });
      else if (i) out.push({ t: ' ', r: 'frame' });
      out.push({ t: w.t, r: 'slot', part: w.c });
    });
    if (L.open === 'like') out.push({ t: ', ', r: 'frame' }, { t: 'please', r: 'pol' }, { t: '.', r: 'frame' });
    else out.push({ t: L.open === 'give' ? '.' : '?', r: 'frame' });
    return out;
  }
  CF.lineText = L => lineSegs(L).map(s => s.t).join('');

  /* =========================================================
     대답 틀 (frame). t: 틀 글 — ___ = 내 정보 칸, {…} = 공손한 말
     tag: ok · literal(한국어 그대로 · 콩글리시) · wrong(틀린 문장) · blunt(명령 · 조르기 · 따지기) · plain(그냥 No.로 끊김)
     yes: 권하는 말에 Yes(true) · No(false) — 사실은 질문의 뜻(shot · room · receipt)에 붙음 · note: 통하지만 덧붙일 말
     ========================================================= */
  CF.FRAME = {};
  const FR = (id, intent, t, ko, o = {}) => (CF.FRAME[id] = Object.assign({ id, intent, t, ko, tag: 'ok' }, o));
  // 문 · 줄 서기
  FR('rd_min', 'ready', 'Not yet. Just a minute, {please}.', '아직이요. 잠깐만요.', { fact: { ready: false } });
  FR('rd_yes', 'ready', 'Yes, I\'m ready.', '네, 주문할게요.', { fact: { ready: true } });
  FR('rd_wait', 'ready', 'Wait.', '(명령) 기다려요.', { fact: { ready: false }, tag: 'blunt', why: '‘잠깐만요’를 Wait. 한 낱말로 하면 명령처럼 들려요. → Not yet. Just a minute, please.' });
  // 메뉴판 · 주문대
  FR('or_can', 'order', '{Can I} get ___?', '___ 주시겠어요?', { slot: 'drink', form: 'a' });
  FR('or_like', 'order', '{I\'d like} ___, {please}.', '___ 주세요.', { slot: 'drink', form: 'a' });
  FR('or_bare', 'order', '{Can I} get ___?', '(틀린 말) ___ 주시겠어요?', { slot: 'drink', form: 'bare', tag: 'wrong', why: '음료 한 잔은 셀 수 있어서 이름 앞에 a(an)가 붙어요. 한국어에는 없는 낱말이라 빠뜨리기 쉬워요. 알아듣긴 해도 → Can I get a latte?' });
  FR('or_give', 'order', 'Give me ___.', '(무례한 말) ___ 줘요.', { slot: 'drink', form: 'one', tag: 'blunt', why: '‘~ 주세요’를 그대로 옮긴 Give me는 명령처럼 들려요. 주문은 질문으로 → Can I get …?' });
  FR('or_want', 'order', 'I want ___.', '(조르는 말) ___ 원해요.', { slot: 'drink', form: 'a', tag: 'blunt', why: 'I want는 원한다는 사실만 말해서 조르는 말처럼 들려요. → I\'d like …, please. 또는 Can I get …?' });
  FR('line', 'order', '', '', { line: true });   // 한 문장 주문 (CF.orderLine)
  // 크기 · 온도
  FR('sz_pl', 'size', '___, {please}.', '___(으)로 주세요.', { slot: 'size' });
  FR('sz_up', 'size', 'Size up, please.', '(콩글리시) 사이즈업이요.', { tag: 'literal', why: '‘사이즈업’은 한국에서 만든 말이에요. 크기를 그대로 말해요 → Large, please. 이미 주문한 음료를 키우려면 → Can I make it a large?' });
  FR('tp_pl', 'temp', '___, {please}.', '___(으)로 주세요.', { slot: 'temp' });
  FR('tp_ice', 'temp', 'Ice, please.', '(콩글리시) 아이스요.', { fact: { temp: 'iced' }, tag: 'literal', why: '‘아이스’를 그대로 옮긴 말이에요. 알아듣긴 하지만 ice는 ‘얼음’이라는 낱말이에요. 얼음을 넣은 차가운 음료는 → Iced, please.' });
  // 옵션
  FR('mk_pl', ['milk', 'milkok'], '___, {please}.', '___(으)로 주세요.', { slot: 'milk' });
  FR('mk_give', 'milk', 'Give me ___.', '(무례한 말) ___ 줘요.', { slot: 'milk', form: 'low', tag: 'blunt', why: '‘귀리 우유 주세요’를 그대로 옮긴 Give me는 명령처럼 들려요. 고른 것 + please → Oat milk, please.' });
  FR('mk_fine', 'milkok', 'Yes, that\'s fine.', '네, 괜찮아요.', { fact: { milk: 'whole' } });
  FR('mk_with', 'milkok', '{Can I} get it with ___?', '___(으)로 바꿔 주시겠어요?', { slot: 'milk', form: 'low' });
  FR('of_yes', ['g_offer', 'shot', 'room', 'receipt'], 'Yes, {please}.', '네, 주세요.', { yes: true });
  FR('of_no', ['g_offer', 'shot', 'room', 'receipt'], 'No, {thanks}.', '아니요, 괜찮아요.', { yes: false });
  FR('of_plain', ['g_offer', 'shot', 'room', 'receipt'], 'No.', '아니요.', { yes: false, tag: 'plain', why: '그냥 No.라고 끊으면 무뚝뚝하게 들릴 수 있어요. 권하는 말을 거절할 때는 → No, thanks.' });
  FR('sh_lit', 'shot', 'Shot add, please.', '(콩글리시) 샷 추가요.', { yes: true, tag: 'literal', why: '‘샷 추가’를 낱말 그대로 옮긴 말이에요. 영어로는 an extra shot. 권하는 말에는 → Yes, please. 내가 먼저 말할 때는 → Can I get an extra shot?' });
  FR('cu_with', 'custom', '{Can I} get it with ___?', '___ 주시겠어요?', { slot: 'chgw' });
  FR('cu_no', 'custom', 'No ___, {please}.', '___ 빼 주세요.', { slot: 'chgn' });
  FR('cu_give', 'custom', 'Give me ___.', '(무례한 말) ___ 줘요.', { slot: 'chgw', tag: 'blunt', why: 'Give me로 시작하면 명령처럼 들려요. 부탁은 질문으로 → Can I get it with less ice?' });
  // 이름 · 포장
  FR('nm_its', 'name', 'It\'s ___.', '___(이)에요.', { slot: 'name' });
  FR('nm_lit', 'name', 'Name is ___.', '(틀린 말) 이름은 ___(이)에요.', { slot: 'name', tag: 'wrong', why: '‘이름은 ~예요’를 그대로 옮기면 my가 빠진 틀린 문장이 돼요. 짧게 이름만 → It\'s Minji. 또는 Minji.' });
  FR('tg_pl', 'togo', '___, {please}.', '___.', { slot: 'togo' });
  FR('tg_uk', 'togo', '___, {please}.', '___.', { slot: 'togouk' });
  FR('tg_take', 'togo', 'Take out, please.', '테이크아웃이요.', { fact: { togo: true }, note: 'Take out도 통해요. 다만 카페에서는 보통 to go(미국) · takeaway(영국)라고 해요.' });
  FR('tg_pack', 'togo', 'Packing, please.', '(어색한 말) 포장이요.', { fact: { togo: true }, tag: 'literal', why: '‘포장해 주세요’의 ‘포장’을 낱말 그대로 옮겼어요. packing은 ‘짐 싸기’라 알아듣기 어려워요. 카페에서는 → To go, please.' });
  // 계산대
  FR('el_no', 'more', 'No, that\'s it. {Thanks}.', '아니요, 그게 다예요. 고마워요.', { fact: { more: 'none' } });
  FR('el_also', 'more', 'Yes, {can I} also get ___?', '네, ___도 주시겠어요?', { slot: 'food' });
  FR('el_plain', 'more', 'No.', '아니요.', { fact: { more: 'none' }, tag: 'plain', why: '그냥 No.라고 끊으면 무뚝뚝하게 들릴 수 있어요. → No, that\'s it. Thanks.' });
  FR('el_service', 'more', 'Service, please.', '(콩글리시) 서비스 주세요.', { tag: 'literal', why: '한국에서 ‘서비스’는 덤으로 공짜로 주는 것이지만, 영어 service는 ‘손님을 돕는 일’이라 뜻이 통하지 않아요. 덤을 달라고 하는 말은 쓰지 않아요.' });
  FR('py_pl', 'pay', '___, {please}.', '___(으)로 할게요.', { slot: 'pay' });
  FR('py_lit', 'pay', 'Card calculate.', '(어색한 말) 카드 계산이요.', { fact: { pay: 'card' }, tag: 'literal', why: '‘카드로 계산이요’를 낱말 그대로 옮겼어요. calculate는 ‘셈하다’라는 뜻이에요. → Card, please.' });
  // 픽업대
  FR('cl_me', 'call', 'That\'s me. {Thanks}!', '제 거예요. 고마워요!');
  FR('cl_lit', 'call', 'It\'s my.', '(틀린 말) 제 거예요.', { tag: 'wrong', why: 'my 뒤에는 물건 이름이 와야 해요(my drink). ‘제 거’는 mine → That\'s mine. 또는 That\'s me. Thanks!' });
  FR('hp_could', 'help', '{Could I} get ___, {please}?', '___ 주시겠어요?', { slot: 'need' });
  FR('hp_give', 'help', 'Give me ___.', '(무례한 말) ___ 줘요.', { slot: 'need', tag: 'blunt', why: '‘빨대 주세요’를 그대로 옮긴 Give me는 명령처럼 들려요. 부탁은 질문으로 → Could I get ___, please?' });
  FR('hp_want', 'help', 'I want ___.', '(조르는 말) ___ 원해요.', { slot: 'need', tag: 'blunt', why: 'I want는 원한다는 사실만 말해서 조르는 말처럼 들려요. 부탁은 질문으로 → Could I get ___, please?' });
  FR('hp_iced', 'help', '{Excuse me}, I ordered it iced, but this one is hot.', '실례지만, 차갑게 주문했는데 이건 따뜻해요.', { fact: { need: 'temp' } });
  FR('hp_wrong', 'help', 'This is wrong.', '(따지는 말) 이거 틀렸어요.', { fact: { need: 'temp' }, tag: 'blunt', why: '‘잘못 나왔어요’를 그대로 옮기면 따지는 말처럼 들려요. 무엇이 다른지 차분히 말해요 → Excuse me, I ordered it iced, but this one is hot.' });
  // 다시 묻기 (못 알아들었을 때). echo: 들린 만큼 되묻는 말 — 그 차례의 질문이어야 통과
  FR('rp_again', 'repair', '{Sorry? Could you} say that again, {please}?', '죄송한데, 다시 한 번 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_sorry', 'repair', '{Sorry}?', '네? (다시 말해 달라는 뜻)', { kind: 'again' });
  FR('rp_slow', 'repair', '{Could you} speak more slowly, {please}?', '조금 더 천천히 말씀해 주시겠어요?', { kind: 'slow' });
  FR('rp_togo', 'repair', '{Sorry}, for here or to go?', '죄송한데, 여기서 마실지 가져갈지 물으신 거죠?', { kind: 'echo', echo: 'togo' });
  FR('rp_size', 'repair', '{Sorry}, what size?', '죄송한데, 크기를 물으신 거죠?', { kind: 'echo', echo: 'size' });
  FR('rp_rude', 'repair', 'Speak slowly!', '(화난 말) 천천히 말해요!', { kind: 'slow', tag: 'blunt', why: '명령문만 쓰면 화난 것처럼 들려요. 부탁은 → Could you speak more slowly, please?' });
  FR('rp_noeng', 'repair', 'I can\'t English.', '(틀린 말) 저 영어 못 해요.', { kind: 'none', tag: 'wrong', why: 'speak가 빠진 틀린 말이에요(I can\'t speak English well). 이럴 때는 다시 물어보는 말이 더 도움이 돼요.' });
  // 다른 질문에 맞는 대답 (① 함정)
  FR('g_permit', 'g_permit', 'Yes, you can.', '네, 그러셔도 돼요.');
  FR('g_yes', 'g_yes', 'Yes.', '네.');
  FR('g_yesiam', 'g_yes', 'Yes, I am.', '네, 그래요.');

  /* ---------- 대답 글 만들기: 조각(segs) = [{ t, r: 'frame' | 'slot' | 'pol' }] ---------- */
  const slotText = (F, v) => { const S = CF.SLOT[F.slot], x = S && S.vals[v]; return x ? x[F.form || 't'] : '___'; };
  CF.segs = function (a) {
    const F = CF.FRAME[a.f];
    if (F.line) return lineSegs(a.line);
    const out = [], re = /\{([^}]*)\}|___/g; let last = 0, m;
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
  CF.text = a => CF.segs(a).map(s => s.t).join('');
  // 해석
  const lineKo = words => {
    const f = CF.lineFacts(words), with_ = words.filter(w => CF.OW[w] && CF.OW[w].c === 'with').map(w => w === 'shot' ? '샷 추가' : CF.SLOT.milk.vals[w].ko);
    return { main: [f.size && CF.SLOT.size.vals[f.size].ko, f.temp && (f.temp === 'iced' ? '아이스' : '따뜻한'), f.drink && CF.MENU[f.drink].ko].filter(Boolean).join(' ') + (with_.length ? `(${with_.join(' · ')})` : ''),
      tail: f.togo != null ? (f.togo ? ' 가져갈게요.' : ' 여기서 마실게요.') : '' };
  };
  CF.ko = function (a) {
    const F = CF.FRAME[a.f];
    if (F.line) { const k = lineKo(a.line.words); return (a.line.open === 'give' ? `(무례한 말) ${k.main} 줘요.` : `${k.main} 주세요.`) + k.tail; }
    if (!F.slot) return F.ko;
    const x = CF.SLOT[F.slot].vals[a.v], k = x ? x.ko : '___';
    return F.ko.replace('___(으)로', ro(k)).replace('___(이)에요', ieyo(k)).replace('___', k);
  };
  // 대답이 말하는 사실 (q: 권하는 말의 Yes · No가 어느 사실인지 정함)
  CF.factOf = function (a, q) {
    if (typeof q === 'string') q = CF.Q[q];
    const F = CF.FRAME[a.f], f = Object.assign({}, F.fact || {});
    if (F.yes != null && q && q.intent && !CF.INTENT[q.intent].generic) f[q.intent] = F.yes;
    if (F.slot && CF.SLOT[F.slot].vals[a.v]) Object.assign(f, valFact(CF.SLOT[F.slot], a.v));
    if (F.line) Object.assign(f, CF.lineFacts(a.line.words));
    return f;
  };
  // 사실을 한국어로
  CF.factKo = function (k, v) {
    if (k === 'drink') return (CF.MENU[v] || {}).ko || String(v);
    if (k === 'size') return (CF.SLOT.size.vals[v] || {}).ko || String(v);
    if (k === 'temp') return v === 'iced' ? '차가운 음료(iced)' : '따뜻한 음료(hot)';
    if (k === 'milk') return v === 'none' ? '우유 없음' : (CF.SLOT.milk.vals[v] || {}).ko || String(v);
    if (k === 'shot') return v ? '샷 하나 더' : '샷 추가 없음';
    if (k === 'room') return v ? '우유 넣을 자리 남기기' : '자리 필요 없음';
    if (k === 'receipt') return v ? '영수증 받기' : '영수증 필요 없음';
    if (k === 'togo') return v ? '가져가기(to go)' : '여기서 마시기(for here)';
    if (k === 'more') return v === 'none' ? '더 살 것 없음' : `${CF.FOOD[v].ko} 하나 더`;
    if (k === 'pay') return v === 'card' ? '카드' : '현금';
    if (k === 'name') return (CF.SLOT.name.vals[v] || {}).ko || String(v);
    if (k === 'need') return NEED_KO[v] || `${(CF.SLOT.need.vals[v] || {}).ko || v} 필요`;
    if (k === 'ready') return v ? '주문할 준비 됨' : '아직 메뉴를 고르는 중';
    if (k === 'chg') return CHG_KO[v] || String(v);
    return String(v);
  };

  /* ---------- 이미 답한 질문 (시뮬레이터의 바리스타가 건너뜀) ---------- */
  const KEY2INTENT = { drink: ['order'], size: ['size'], temp: ['temp'], milk: ['milk', 'milkok', 'room'], shot: ['shot'], room: ['room'], togo: ['togo'], name: ['name'], more: ['more'], pay: ['pay'], receipt: ['receipt'] };
  CF.coveredBy = (facts, intent) => { const out = new Set(intent ? [intent] : []); Object.keys(facts).forEach(k => (KEY2INTENT[k] || []).forEach(i => out.add(i))); return [...out]; };
  CF.covered = (a, q) => { if (typeof q === 'string') q = CF.Q[q]; return CF.coveredBy(CF.factOf(a, q), q.intent); };
  CF.INTENT_KO = { order: '음료', size: '크기', temp: '온도', milk: '우유', milkok: '우유', room: '우유 자리', shot: '샷', togo: '포장', name: '이름', more: '더 살 것', pay: '계산', receipt: '영수증' };
  // 화면에 보일 ‘건너뛴 질문’ 이름 (음료 · 우유 확인은 빼고, 아메리카노면 우유 대신 우유 자리)
  CF.coveredKo = (cov, C) => cov.filter(i => i !== 'order' && i !== 'milkok' && !(i === 'room' && C.drink !== 'americano') && !(i === 'milk' && C.drink === 'americano'))
    .map(i => CF.INTENT_KO[i]).filter((x, i, a) => a.indexOf(x) === i);

  /* =========================================================
     판정 — CF.judge(질문, 대답, 카드, 출처)
     q: CF.Q의 질문(또는 id) · a: { f: 틀 id, v: 칸 값, line } · card: 사실 · src: '카드' | '상황'
     ========================================================= */
  const res = (ok, stage, why, tag) => ({ ok, stage, why, tag: tag || (ok ? 'ok' : '') });
  CF.judge = function (q, a, card, src = '카드') {
    if (typeof q === 'string') q = CF.Q[q];
    const F = CF.FRAME[a.f], C = Object.assign({}, card || {}, q.fact || {});
    const fi = [].concat(F.intent), key = q.key.join(' … ');
    // ① 열쇠 낱말 잡기
    if (q.fast) {
      if (F.intent !== 'repair') return res(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 묻는지 모르는데 짐작해서 답하면 엉뚱한 대답이 될 수 있어요. 먼저 다시 물어요.', 'guess');
      if (F.kind === 'echo' && F.echo !== q.intent) return res(false, 1, `되물은 질문이 달라요. 들린 낱말과 주문 순서로 보면 지금은 ${CF.INTENT[q.intent].turn} 차례예요.`, 'intent');
    } else if (!fi.includes(q.intent)) {
      if (F.intent === 'repair') return res(false, 1, '대답이 아니라 다시 묻는 말이에요. 질문을 알아들었다면 바로 답해요.', 'intent');
      return res(false, 1, `열쇠 낱말 ${key} → ${CF.sayOf(q.intent)}. 이 대답은 ${CF.INTENT[fi[0]].ans}에 맞는 말이에요.`, 'intent');
    }
    // ② 틀에 내 정보 넣기
    if (F.tag === 'literal' || F.tag === 'wrong') return res(false, 2, F.why, F.tag);
    const sv = F.slot ? CF.SLOT[F.slot].vals[a.v] : null;
    if (sv && sv.bad) return res(false, 2, sv.why, sv.bad);
    if (F.line) {
      const o = CF.orderLine(a.line.words);
      if (!o.ok) return res(false, 2, o.why, 'order');
    }
    const fact = CF.factOf(a, q);
    for (const k of Object.keys(fact)) {
      if (C[k] === undefined || C[k] === fact[k]) continue;
      return res(false, 2, `${wa(src)} 달라요. ${src}: ${CF.factKo(k, C[k])} · 이 대답: ${CF.factKo(k, fact[k])}.`, 'fact');
    }
    // ③ 공손하게 끝내기
    if (F.tag === 'blunt' || F.tag === 'plain') return res(false, 3, F.why, F.tag);
    if (F.line && a.line.open === 'give') return res(false, 3, 'Give me로 시작하면 명령처럼 들려요. 주문은 질문으로 → Can I get …?', 'blunt');
    // 통과
    const segs = CF.segs(a), pol = segs.filter(s => s.r === 'pol').map(s => s.t);
    let why;
    if (q.fast) why = F.kind === 'echo' ? '들린 만큼 되물어 확인했어요. 주문 순서를 알면 무엇을 물었을지 짐작하고 확인할 수 있어요.' : F.kind === 'slow' ? '천천히 말해 달라고 공손하게 부탁했어요.' : '못 알아들었을 때는 짐작하지 말고 공손하게 다시 물어요.';
    else if (F.line) {
      const cov = CF.coveredKo(CF.covered(a, q), C);
      why = `${CF.orderLine(a.line.words).why} ${cov.length ? `한 문장에 ${cov.join(' · ')}까지 말해서 바리스타가 그 질문을 건너뛰어요.` : '음료만 말했으니 나머지는 바리스타가 차례로 물어요.'}`;
    } else {
      const In = CF.INTENT[q.intent], sl = segs.filter(s => s.r === 'slot').map(s => s.t);
      why = `열쇠 낱말 ${key} → ${CF.ASK[In.ask].ko}. ` + (sl.length ? `틀 + 내 정보(${sl.join(' ')}) → ${src}의 사실과 맞아요.` : Object.keys(fact).length ? `${src}의 사실(${Object.keys(fact).map(k => CF.factKo(k, fact[k])).join(' · ')})과 맞아요.` : '짧은 대답이면 충분해요.');
    }
    if (pol.length) why += ` 공손한 말 → ${pol.join(' · ')}.`;
    if (F.note) why += ` ${F.note}`;
    return res(true, 0, why);
  };
  // 모범 대답 (카드에 맞춰)
  CF.model = function (q, card) {
    if (typeof q === 'string') q = CF.Q[q];
    const C = Object.assign({}, card || {}, q.fact || {});
    if (q.fast) return { f: q.intent === 'togo' ? 'rp_togo' : q.intent === 'size' ? 'rp_size' : 'rp_again' };
    const In = CF.INTENT[q.intent], id = typeof In.best === 'function' ? In.best(C) : In.best, F = CF.FRAME[id];
    if (!F.slot) return { f: id };
    const v = CF.slotVal(F.slot, C);
    return { f: id, v: v != null ? String(v) : slotIds(F.slot)[0] };
  };
  // 한 문장 주문의 모범 (카드에서 크기 · 온도 · 음료 · 우유 · 샷 · 포장)
  CF.modelLine = c => ({ f: 'line', line: { open: 'can', words: [c.size, c.temp, c.drink].concat(c.milk && c.milk !== 'none' && c.milk !== 'whole' ? [c.milk] : []).concat(c.shot ? ['shot'] : []).concat(c.togo != null ? [c.togo ? 'togo' : 'here'] : []).filter(Boolean) } });

  /* =========================================================
     소리 내어 읽을 글 (화면 글 → 음성용). 값을 카페식으로 읽어요 ($6.50 → six fifty)
     ========================================================= */
  CF.spoken = s => String(s).replace(/\$(\d+)\.(\d{2})/g, (m, d, c) => CF.priceWords(+d * 100 + +c));

  /* =========================================================
     소리로 한 대답 맞춰 보기 — CF.matchSpoken(들린 글, 질문, 카드)
     음성 인식이 글로 바꾼 말에 그 질문의 표시 낱말과 카드의 사실이 들어 있으면 받아들여요.
     공손함 · 발음은 판정하지 않아요. 한국어 그대로 옮긴 꼴이 들리면 알림만 붙여요.
     음료를 말할 때 크기 · 온도 · 우유 · 샷 · 포장을 함께 말하면 그 질문들도 답한 것으로 봐요(covered).
     ========================================================= */
  const CONTR = [[/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\bwhat's\b/g, 'what is'], [/\bdon't\b/g, 'do not'], [/\bdidn't\b/g, 'did not'], [/\bi've\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\bcan't\b/g, 'cannot'], [/\bi'd\b/g, 'i would'], [/\byou're\b/g, 'you are'], [/\bthat's\b/g, 'that is'], [/\bthat'll\b/g, 'that will'], [/\bwon't\b/g, 'will not'], [/\bisn't\b/g, 'is not']];
  // 글 → 낱말 (작은 글자, 줄임말 풀기, 숫자는 낱말로)
  CF.norm = function (s) {
    let t = String(s || '').toLowerCase().replace(/[’‘]/g, '\'');
    CONTR.forEach(([r, w]) => { t = t.replace(r, w); });
    t = t.replace(/(\d+)/g, d => NUMW[+d] || d).replace(/[^a-z0-9' -]+/g, ' ').replace(/-/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '');
    return t.split(/\s+/).filter(Boolean);
  };
  // 들린 말에서 주문 조각 찾기
  const SPK = {
    drink: [['chai', /\bchai\b/], ['americano', /\bamericano\b/], ['cappuccino', /\bcappuccino\b/], ['mocha', /\bmocha\b/], ['latte', /\b(latte|lattes|lati|latté)\b/]],
    size: [['small', /\bsmall\b/], ['medium', /\bmedium\b/], ['large', /\b(large|big)\b/]],
    temp: [['iced', /\b(iced|ice|cold)\b/], ['hot', /\b(hot|warm)\b/]],
    milk: [['oat', /\boat\b/], ['skim', /\b(skim|skimmed|nonfat|non fat)\b/], ['whole', /\b(whole|regular) milk\b/]],
    shot: [[true, /\b(extra shot|double shot|another shot|two shots)\b/]],
    togo: [[true, /\b(to go|take out|takeout|take away|takeaway)\b/], [false, /\b(for here|eat in|stay here)\b/]],
  };
  CF.parseSpoken = function (raw) {
    const s = ' ' + CF.norm(raw).join(' ') + ' ', f = {};
    Object.entries(SPK).forEach(([k, list]) => { const hit = list.find(([, r]) => r.test(s)); if (hit) f[k] = hit[0]; });
    if (f.drink === 'latte' && /\bchai\b/.test(s)) f.drink = 'chai';
    return f;
  };
  const yesNo = k => ({ mark: /\b(yes|yeah|sure|please|no|nope|thanks|thank you)\b/, fact: c => c[k] ? /\b(yes|yeah|sure|please)\b/ : /\b(no|nope)\b/, not: c => c[k] ? /\b(no|nope)\b/ : /\b(yes|yeah|sure)\b/ });
  const SPOKEN = {
    size: { mark: /\b(small|medium|large|big)\b/, fact: c => new RegExp('\\b' + (c.size === 'large' ? '(large|big)' : c.size) + '\\b') },
    temp: { mark: /\b(hot|iced|ice|cold|warm)\b/, fact: c => c.temp === 'iced' ? /\b(iced|ice|cold)\b/ : /\b(hot|warm)\b/, lit: [[/\bice\b/, '들린 말 → ice. 차가운 음료는 iced예요(iced의 끝 d는 거의 들리지 않아서 음성 인식이 ice로 적을 수도 있어요).']] },
    milk: { mark: /\b(milk|oat|skim|whole|regular|soy)\b/, fact: c => c.milk === 'whole' ? /\b(whole|regular)\b/ : new RegExp('\\b' + c.milk + '\\b') },
    shot: yesNo('shot'), room: yesNo('room'), receipt: yesNo('receipt'),
    togo: { mark: /\b(go|here|take|out|away|takeaway|takeout|eat|stay|packing)\b/, fact: c => c.togo ? /\b(to go|take out|takeout|take away|takeaway)\b/ : /\b(for here|eat in|stay|here)\b/, lit: [[/\bpacking\b/, '‘포장’ → packing은 알아듣기 어려워요. → To go, please.'], [/\btake ?out\b/, 'take out도 통해요. 카페에서는 보통 to go라고 해요.']] },
    more: { mark: /\b(no|nothing|that is it|that is all|yes|also|muffin|croissant|cookie)\b/, fact: c => c.more === 'none' ? /\b(no|nothing|that is it|that is all)\b/ : new RegExp('\\b' + c.more + '\\b'), lit: [[/\bservice\b/, '‘서비스(덤)’는 영어로 통하지 않아요.']] },
    pay: { mark: /\b(card|cash|credit|debit)\b/, fact: c => c.pay === 'card' ? /\b(card|credit|debit)\b/ : /\bcash\b/, lit: [[/\bcalculate\b/, '‘카드 계산’ → calculate는 어색해요. → Card, please.']] },
    call: { mark: /\b(me|mine|thanks|thank|that is|yes|here)\b/, fact: () => /\b(me|mine|thanks|thank|that is|here)\b/ },
    ready: { mark: /\b(yes|no|not|ready|minute|second|moment|wait)\b/, fact: c => c.ready ? /\b(yes|ready)\b/ : /\b(not yet|minute|second|moment|wait|no)\b/ },
  };
  CF.SPOKEN = SPOKEN;
  const SPOKEN_KEY = { size: 'size', temp: 'temp', milk: 'milk', shot: 'shot', room: 'room', receipt: 'receipt', togo: 'togo', more: 'more', pay: 'pay', ready: 'ready' };
  const REPAIR_RE = /\b(say that again|pardon|repeat|more slowly|slow down|sorry)\b/;
  const YN_Q = { shot: 1, room: 1, receipt: 1 };
  CF.matchSpoken = function (raw, q, card) {
    if (typeof q === 'string') q = CF.Q[q];
    const w = CF.norm(raw), s = ' ' + w.join(' ') + ' ', heard = w.join(' ');
    if (!w.length) return { ok: false, stage: 0, why: '들린 말이 없어요. 다시 말해 보세요.', heard: '' };
    if (REPAIR_RE.test(s) && w.length <= 9 && !(q.intent === 'help')) return { ok: false, stage: 1, repair: true, why: '다시 묻는 말로 들었어요. 바리스타가 질문을 한 번 더 해 줄 거예요.', heard };
    const C = Object.assign({}, card || {}, q.fact || {});
    const notes = [];
    if (/\b(give me|i want)\b/.test(s)) notes.push('Give me · I want는 명령하거나 조르는 말처럼 들려요(말로 한 대답은 말투를 판정하지 않아요) → Can I get …?');
    // 음료 주문: 한 문장에 여러 조각
    if (q.intent === 'order') {
      const f = CF.parseSpoken(raw);
      if (!f.drink) return { ok: false, stage: 1, why: `열쇠 낱말 ${q.key.join(' … ')} → ${CF.sayOf(q.intent)}. 들린 말에 음료 이름이 없어요.`, heard };
      for (const k of Object.keys(f)) if (C[k] !== undefined && C[k] !== f[k]) return { ok: false, stage: 2, tag: 'fact', why: `카드와 달라요. 카드: ${CF.factKo(k, C[k])} · 들린 말: ${CF.factKo(k, f[k])}.`, heard };
      if (/\bice\b/.test(s) && !/\biced\b/.test(s)) notes.push('들린 말 → ice. 차가운 음료는 iced예요(음성 인식이 d를 빼고 적었을 수도 있어요).');
      if (/\b(size up|upsize)\b/.test(s)) notes.push('‘사이즈업’은 콩글리시예요 → Large, please.');
      const cov = CF.coveredBy(f, 'order');
      const ck = CF.coveredKo(cov, C);
      return { ok: true, stage: 0, why: '음료 이름이 들렸고 카드와 맞아요.' + (ck.length ? ` 한 문장에 ${ck.join(' · ')}까지 말했어요.` : '') + (notes.length ? ' 알림: ' + notes.join(' ') : ''), note: notes.join(' '), heard, covered: cov, facts: f };
    }
    // 이름: 낯선 이름은 음성 인식이 다르게 적기 쉬워요 → 들린 말이 있으면 받아들이고 알림
    //   단, 카드와 다른 이름(시뮬레이터의 다른 이름)이 또렷이 들리면 ② 카드와 다름
    if (q.intent === 'name') {
      const nm = String(C.name || '').toLowerCase();
      const got = nm && s.includes(' ' + nm + ' ');
      const other = !got && CF.NAMES.find(n => n.toLowerCase() !== nm && s.includes(' ' + n.toLowerCase() + ' '));
      if (other) return { ok: false, stage: 2, tag: 'fact', why: `카드와 달라요. 카드의 이름: ${C.name} · 들린 말: ${other}.`, heard };
      const said = heard.replace(/^(it is|its|my name is|name is|i am|this is)\s+/, '') || heard;
      return { ok: true, stage: 0, why: got ? '이름이 들렸어요.' : `음성 인식이 이름을 ‘${said}’로 적었어요. 낯선 이름은 바리스타도 잘못 듣기 쉬워요. 철자를 불러 주면 좋아요 → ${String(C.name || 'Minji').toUpperCase().split('').join('-')}.`, heard };
    }
    const M = SPOKEN[q.intent];
    if (!M) return { ok: false, stage: 0, why: '이 질문은 말로 대답하기를 지원하지 않아요.', heard };
    if (!M.mark.test(s)) return { ok: false, stage: 1, why: `열쇠 낱말 ${q.key.join(' … ')} → ${CF.sayOf(q.intent)}. 들린 말에 그 대답이 없어요.`, heard };
    // 권하는 말(Yes · No 질문)에 yes · no 없이 다른 질문의 대답(Large, please. · To go, please.)만 들리면 ① — please 하나만 보고 ‘네’로 보지 않음
    if (YN_Q[q.intent] && !/\b(yes|yeah|sure|no|nope)\b/.test(s)) {
      const f = CF.parseSpoken(raw); delete f[q.intent];
      if (/\b(card|cash)\b/.test(s)) f.pay = /\bcash\b/.test(s) ? 'cash' : 'card';
      const k = Object.keys(f)[0];
      if (k) return { ok: false, stage: 1, why: `열쇠 낱말 ${q.key.join(' … ')} → ${CF.sayOf(q.intent)}. 들린 말(${CF.factKo(k, f[k])})은 다른 질문의 대답처럼 들려요. → Yes, please. 또는 No, thanks.`, heard };
    }
    const fr = M.fact(C), fk = SPOKEN_KEY[q.intent];
    if (!fr || !fr.test(s) || (M.not && M.not(C).test(s))) return { ok: false, stage: 2, tag: 'fact', why: fk && C[fk] != null ? `카드와 달라요. 카드의 사실(${CF.factKo(fk, C[fk])})이 들리지 않았어요.` : '대답에 필요한 사실이 들리지 않았어요.', heard };
    (M.lit || []).forEach(([r, n]) => { if (r.test(s)) notes.push(n); });
    return { ok: true, stage: 0, why: '열쇠 낱말에 맞는 대답이고 카드의 사실이 들어 있어요.' + (notes.length ? ' 알림: ' + notes.join(' ') : ''), note: notes.join(' '), heard, covered: [q.intent] };
  };

  /* ---------- 따라 말하기: 낱말 맞춰 보기 (가장 긴 공통 부분열) ---------- */
  // 돌려주는 값: { words: [{ t: 화면 낱말, ok }], hit, total }
  CF.compareWords = function (target, heard) {
    const tw = String(target).split(/\s+/).filter(Boolean), tn = tw.map(x => CF.norm(CF.spoken(x)).join(' ')), hn = CF.norm(heard);
    const tt = []; tn.forEach((n, i) => n.split(' ').filter(Boolean).forEach(p => tt.push({ p, i })));
    const A = tt.map(x => x.p), B = hn, D = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) D[i][j] = A[i] === B[j] ? D[i + 1][j + 1] + 1 : Math.max(D[i + 1][j], D[i][j + 1]);
    const got = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { got.add(i); i++; j++; } else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++; }
    const okW = tw.map((_, k) => { const parts = tt.map((x, n) => [x, n]).filter(([x]) => x.i === k); return parts.length ? parts.every(([, n]) => got.has(n)) : true; });
    return { words: tw.map((t, k) => ({ t, ok: okW[k] })), hit: okW.filter(Boolean).length, total: tw.length };
  };

  /* =========================================================
     주문 카드 (카페 주문 시뮬레이터)
     ========================================================= */
  CF.NAMES = ['Minji', 'Jisoo', 'Seoyeon', 'Doyun', 'Haneul', 'Junho'];
  CF.newCard = function (rnd = Math.random) {
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const drink = pick(Object.keys(CF.MENU)), am = drink === 'americano';
    return {
      name: pick(CF.NAMES), drink, size: pick(CF.SIZES), temp: rnd() < 0.5 ? 'iced' : 'hot',
      milk: am ? 'none' : pick(['whole', 'oat', 'skim']), room: am ? rnd() < 0.5 : undefined, shot: rnd() < 0.4,
      togo: rnd() < 0.6, more: rnd() < 0.55 ? 'none' : pick(Object.keys(CF.FOOD)), pay: rnd() < 0.6 ? 'card' : 'cash', receipt: rnd() < 0.4,
    };
  };
  // 바리스타가 묻는 차례 (조금씩 달라짐): 음료 → 크기 · 온도 → 우유(아메리카노는 우유 자리) → 샷 → 이름 · 포장 → 더 살 것 → 계산 → 영수증 → 받기
  CF.simQs = function (card, rnd = Math.random) {
    const qs = [rnd() < 0.5 ? 'co_what' : 'co_like'];
    const st = ['sz_size', 'tp_temp']; if (rnd() < 0.35) st.reverse(); qs.push(...st);
    qs.push(card.drink === 'americano' ? 'op_room' : 'op_milk', 'op_shot');
    const nt = ['nm_name', 'nm_togo']; if (rnd() < 0.4) nt.reverse(); qs.push(...nt);
    qs.push('pa_more', 'pa_pay', 'pa_receipt', 'pk_call');
    return qs;
  };
  // 카드에 따라 바뀌는 말 (값 · 부르는 이름)
  CF.simQ = function (id, card) {
    const q = CF.Q[id];
    if (id === 'pa_pay') { const t = CF.price(card).total; return Object.assign({}, q, { en: `That'll be ${CF.money(t)}. Card or cash?`, ko: `${CF.priceKo(t)}입니다. 카드로 하시겠어요, 현금으로 하시겠어요?`, total: t }); }
    if (id === 'pk_call') return Object.assign({}, q, { en: `${CF.callName(card)} for ${card.name}!`, ko: `${CF.factKo('name', card.name)} 님, 주문하신 음료 나왔어요!`, key: ['for ' + card.name] });
    return q;
  };
  // 질문마다 틀 칩: 맞는 틀 · 한국어 그대로(콩글리시 · 무례한 말) 틀 · 다른 질문의 틀 (+ 사실이 반대인 틀)
  CF.SIM_FRAMES = {
    order: ['or_can', 'or_give', 'sz_pl'],
    size: ['sz_pl', 'sz_up', 'tp_pl'],
    temp: ['tp_pl', 'tp_ice', 'sz_pl'],
    milk: ['mk_pl', 'mk_give', 'of_yes'],
    room: ['of_yes', 'of_no', 'of_plain', 'mk_pl'],
    shot: ['of_yes', 'of_no', 'sh_lit', 'of_plain'],
    name: ['nm_its', 'nm_lit', 'g_permit'],
    togo: ['tg_pl', 'tg_pack', 'sz_pl'],
    more: ['el_no', 'el_also', 'el_plain', 'py_pl'],
    pay: ['py_pl', 'py_lit', 'of_no'],
    receipt: ['of_yes', 'of_no', 'of_plain', 'el_no'],
    call: ['cl_me', 'cl_lit', 'g_yesiam'],
  };
  // 칸 칩: 카드의 값 + 다른 값 둘 (rnd로 고름)
  CF.slotChoices = function (slot, card, rnd = Math.random) {
    const right = CF.slotVal(slot, card) || null;
    const keys = slotIds(slot).filter(k => k !== right);
    for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
    const out = (right ? [right] : []).concat(keys.slice(0, right ? 2 : 3));
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  };
  CF.cardRows = c => [
    ['이름', `${CF.factKo('name', c.name)} (${c.name})`],
    ['음료', `${CF.SLOT.size.vals[c.size].ko} · ${c.temp === 'iced' ? '아이스' : '따뜻한'} ${CF.MENU[c.drink].ko}`],
    c.drink === 'americano' ? ['우유 자리', c.room ? '남겨 주세요 (우유는 내가)' : '필요 없어요'] : ['우유', CF.factKo('milk', c.milk)],
    ['샷 추가', c.shot ? '하나 더' : '없음'],
    ['포장', c.togo ? '가져가기 (to go)' : '여기서 (for here)'],
    ['더 살 것', c.more === 'none' ? '없음' : CF.FOOD[c.more].ko],
    ['계산', `${CF.factKo('pay', c.pay)} · 영수증 ${c.receipt ? '받기' : '필요 없음'}`],
  ];
  // 바리스타의 반응 (단계별)
  CF.REACT = {
    ok: ['Sure.', 'Got it.', 'Okay.', 'Great.', 'Perfect.'],
    1: q => ({ en: `Sorry — ${q.en}`, ko: `‘${q.key.join(' … ')}’를 물었어요.` }),
    2: (q, j) => j.tag === 'fact' ? { en: 'Oh, are you sure?', ko: '주문 카드를 다시 보세요.' } : j.tag === 'order' ? { en: 'Sorry, one more time?', ko: '순서가 뒤섞여 알아듣기 어려워요.' } : { en: 'Sorry?', ko: '알아듣기 어려운 말이에요.' },
    3: () => ({ en: '... Okay.', ko: '뜻은 통했지만 말투가 거칠어요.' }),
  };

  /* =========================================================
     듣고 대답 고르기 16문제 (모두 새로 만든 대화). card = 그 상황의 사실
     ========================================================= */
  const o = (f, v) => (v != null ? { f, v: String(v) } : { f });
  CF.o = o;
  CF.DRILL = [
    { q: 'dr_ready', sit: '줄 맨 앞에 섰는데, 아직 메뉴를 고르는 중이에요.', card: { ready: false }, a: 3, opts: [o('rd_yes'), o('of_yes'), o('rd_wait'), o('rd_min')] },
    { q: 'co_what', sit: '따뜻한 라테 한 잔을 마시고 싶어요.', card: { drink: 'latte' }, a: 0, opts: [o('or_can', 'latte'), o('or_bare', 'latte'), o('or_want', 'latte'), o('tg_pl', 'go')] },
    { q: 'co_like', sit: '차가운 아메리카노를 마시고 싶어요.', card: { drink: 'americano', temp: 'iced' }, a: 2, opts: [o('or_like', 'iceam'), o('or_give', 'icedam'), o('or_like', 'icedam'), o('tp_pl', 'iced')] },
    { q: 'co_fast', sit: '차례가 되었는데 바리스타가 너무 빠르게 말해서 하나도 못 알아들었어요.', card: {}, a: 1, opts: [o('g_yes'), o('rp_again'), o('rp_noeng'), o('or_want', 'latte')] },
    { q: 'sz_size', sit: '가장 큰 컵으로 마시고 싶어요.', card: { size: 'large' }, a: 1, opts: [o('sz_up'), o('sz_pl', 'large'), o('sz_pl', 'small'), o('of_yes')] },
    { q: 'tp_temp', sit: '더운 날이라 얼음을 넣은 차가운 음료를 원해요.', card: { temp: 'iced' }, a: 3, opts: [o('tp_ice'), o('of_yes'), o('tp_pl', 'hot'), o('tp_pl', 'iced')] },
    { q: 'op_milk', sit: '우유를 못 마셔서 귀리 우유로 마시고 싶어요.', card: { milk: 'oat' }, a: 0, opts: [o('mk_pl', 'oat'), o('mk_give', 'oat'), o('mk_pl', 'skim'), o('of_no')] },
    { q: 'op_shot', sit: '커피를 진하게 마시고 싶어요.', card: { shot: true }, a: 2, opts: [o('of_no'), o('sh_lit'), o('of_yes'), o('mk_pl', 'whole')] },
    { q: 'op_add', sit: '얼음을 조금만 넣고 싶어요.', card: { chg: 'lessice' }, a: 1, opts: [o('cu_no', 'noice'), o('cu_with', 'lessice'), o('cu_give', 'lessice'), o('of_yes')] },
    { q: 'nm_name', sit: '내 이름은 서연이에요.', card: { name: 'Seoyeon' }, a: 3, opts: [o('g_permit'), o('nm_lit', 'Seoyeon'), o('nm_its', 'Minji'), o('nm_its', 'Seoyeon')] },
    { q: 'nm_togo', sit: '음료를 들고 바로 수업에 갈 거예요.', card: { togo: true }, a: 0, opts: [o('tg_pl', 'go'), o('tg_pack'), o('tg_pl', 'here'), o('py_pl', 'card')] },
    { q: 'nm_fast', sit: '이름을 말한 뒤 바리스타가 아주 빠르게 물었어요. 끝의 ‘… to go?’만 들렸어요.', card: {}, a: 2, opts: [o('g_yes'), o('rp_size'), o('rp_togo'), o('rp_rude')] },
    { q: 'pa_more', sit: '음료 한 잔이면 충분해요.', card: { more: 'none' }, a: 1, opts: [o('el_plain'), o('el_no'), o('el_service'), o('py_pl', 'card')] },
    { q: 'pa_pay', sit: '현금으로 내고 싶어요.', card: { pay: 'cash' }, a: 3, opts: [o('py_lit'), o('py_pl', 'card'), o('of_yes'), o('py_pl', 'cash')] },
    { q: 'pa_receipt', sit: '영수증은 필요 없어요.', card: { receipt: false }, a: 0, opts: [o('of_no'), o('of_yes'), o('of_plain'), o('el_no')] },
    { q: 'pk_help', sit: '아이스 라테를 주문했는데 따뜻한 라테가 나왔어요.', card: { need: 'temp' }, a: 2, opts: [o('hp_wrong'), o('g_permit'), o('hp_iced'), o('hp_could', 'lid')] },
  ];
  CF.DRILL.forEach((it, i) => { it.n = i; it.Q = CF.Q[it.q]; it.place = it.Q.place; });
  // 직접 해 보기의 짧은 문제 (00장 · 05장) — 연습 문제와 다른 상황
  CF.MINI = {
    intro: { q: 'co_what', sit: '차가운 아메리카노를 한 잔 마시고 싶어요.', card: { drink: 'americano', temp: 'iced' }, a: 1, opts: [o('or_give', 'iceam'), o('or_can', 'icedam'), o('sz_pl', 'medium'), o('or_can', 'iceam')] },
    repair: { q: 'sz_fast', sit: '음료 이름을 말하자 바리스타가 아주 빠르게 물었어요. 가운데 ‘… size …’만 들렸어요.', card: {}, a: 1, opts: [o('sz_pl', 'medium'), o('rp_size'), o('rp_togo'), o('rp_rude')] },
  };
  Object.values(CF.MINI).forEach(it => { it.Q = CF.Q[it.q]; it.place = it.Q.place; });

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 대화 (연습 문제와 겹치지 않게 골랐어요)
     ========================================================= */
  // 02–08장의 주문: 민지 · 미디엄 아이스 라테 · 귀리 우유 · 샷 추가 · 가져가기 · 카드 · 영수증 필요 없음 → $6.50
  CF.DEMO = { name: 'Minji', drink: 'latte', size: 'medium', temp: 'iced', milk: 'oat', shot: true, togo: true, more: 'none', pay: 'card', receipt: false };
  // 00장: 한국어 그대로 → 자연스러운 말
  CF.INTRO = { q: 'co_what', lit: o('or_give', 'iceam'), ok: o('or_can', 'icedam'), card: { drink: 'americano', temp: 'iced' } };
  CF.SCENE = {
    // 02장 인사와 주문
    order: [['dr_ready', o('rd_min'), { ready: false }], ['co_what', o('or_can', 'latte'), { drink: 'latte' }], ['co_like', o('or_like', 'latte'), { drink: 'latte' }]],
    arts: [['a', 'latte'], ['an', 'americano'], ['an', 'iced latte'], ['a', 'medium iced latte']],
    ice: [o('or_can', 'iceam'), o('or_can', 'icedam')],
    blunt: [o('or_give', 'americano'), o('or_want', 'latte'), o('or_can', 'americano')],
    // 03장 크기 · 온도
    size: [['sz_size', o('sz_pl', 'medium')], ['tp_temp', o('tp_pl', 'iced')]],
    tempTrap: [o('tp_ice'), o('of_yes')],
    // 04장 옵션
    option: [['op_milk', o('mk_pl', 'oat')], ['op_shot', o('of_yes')]],
    shotTrap: [o('sh_lit'), o('of_plain'), o('of_no')],
    withs: ['oat', 'shot', 'lessice'], nos: ['nosugar', 'noice', 'nowhip'],
    room: ['op_room', o('of_no'), { room: false }],
    // 05장 이름 · 포장
    name: ['nm_name', o('g_permit'), o('nm_its', 'Minji')],
    togo: ['nm_togo', o('tg_pl', 'go')], take: o('tg_take'), pack: o('tg_pack'),
    repair: ['nm_fast', o('rp_togo'), o('rp_again')],
    // 06장 계산대
    more: ['pa_more', o('el_no')], pay: ['pa_pay', o('py_pl', 'card'), o('py_lit')], receipt: ['pa_receipt', o('of_no')],
    // 07장 픽업대
    call: ['pk_call', o('cl_me')], wrong: [o('hp_wrong'), o('hp_iced')], could: ['lid', 'straw', 'napkins'], needBlunt: [o('hp_give', 'straw'), o('hp_could', 'straw')],
  };
  // 08장: 한 문장 주문
  CF.LINE = { open: 'can', words: ['medium', 'iced', 'latte', 'oat', 'togo'] };
  CF.LINE_BAD = { open: 'can', words: ['iced', 'medium', 'latte', 'togo', 'oat'] };
  // 08장 직접 해 보기 칩
  CF.LINE_CHIPS = { size: ['small', 'medium', 'large'], temp: ['hot', 'iced'], drink: ['americano', 'latte', 'cappuccino', 'mocha', 'chai'], with: ['oat', 'skim', 'whole', 'shot'], togo: ['togo', 'here'] };
  // 09장: 단계마다 한 줄 (3단계 적용)
  CF.METHOD = [
    ['dr_ready', o('rd_min'), { ready: false }],
    ['co_what', o('or_can', 'latte'), { drink: 'latte' }],
    ['sz_size', o('sz_pl', 'medium'), { size: 'medium' }],
    ['op_milk', o('mk_pl', 'oat'), { milk: 'oat' }],
    ['nm_togo', o('tg_pl', 'go'), { togo: true }],
    ['pa_pay', o('py_pl', 'card'), { pay: 'card' }],
    ['pk_help', o('hp_could', 'lid'), { need: 'lid' }],
  ];
  // 10장 실전: 주문 카드 하나로 넷 (보기 셋, 단계마다 지워짐)
  CF.PCARD = { name: 'Jisoo', drink: 'mocha', size: 'large', temp: 'hot', milk: 'skim', shot: false, togo: false, more: 'croissant', pay: 'cash', receipt: true };
  CF.PRACTICE = [
    { q: 'co_what', opts: [o('or_give', 'mocha'), o('sz_pl', 'large'), o('or_can', 'mocha')], a: 2,
      lines: ['What can I get → 무엇을 주문할지 · (B) Large, please → 크기라 탈락', '남은 둘 → 모두 카드의 모카, 틀도 문장이 돼요', '(A) Give me → 명령처럼 들려 탈락 · Can I get + 음료 → 정답 (C)'] },
    { q: 'tp_temp', opts: [o('tp_pl', 'iced'), o('of_yes'), o('tp_pl', 'hot')], a: 2,
      lines: ['Hot or iced → 고르기 · (B) Yes, please → 고르지 않아 탈락', '(A) Iced → 카드는 따뜻한 음료라 탈락', '고른 것 + please → 정답 (C)'] },
    { q: 'nm_togo', opts: [o('tg_pack'), o('tg_pl', 'go'), o('tg_pl', 'here')], a: 2,
      lines: ['For here or to go → 고르기 · 셋 모두 포장에 대한 대답', '(A) Packing → ‘포장’ 그대로 · (B) To go → 카드는 여기서 마셔요 · 탈락', 'For here + please → 정답 (C)'] },
    { q: 'pa_more', opts: [o('el_no'), o('py_pl', 'cash'), o('el_also', 'croissant')], a: 2,
      lines: ['Anything else → 더 살 것 확인 · (B) Cash, please → 계산 방법이라 탈락', '(A) No, that\'s it → 카드에 크루아상이 있어 탈락', 'Can I also get + 먹을 것? → 정답 (C)'] },
  ];

  /* ---------- 빠른 말: 낱말이 이어져 들리는 모양 (05장 · 직접 해 보기). 대문자 = 세게 ---------- */
  CF.LINKED = [
    { q: 'nm_togo', en: 'For here or to go?', words: ['For', 'here', 'or', 'to', 'go?'], sound: [['fer', 0], ['HEE', 1], ['rer', 0], ['tuh', 0], ['GO', 1]], link: [[1, 2]], ko: 'for → fer, to → tuh: 약하게 · here와 or가 붙어 hee-rer' },
    { q: 'co_what', en: 'What can I get you?', words: ['What', 'can', 'I', 'get', 'you?'], sound: [['wha', 0], ['kuh', 0], ['NAI', 1], ['GE', 1], ['chuh', 0]], link: [[1, 2], [3, 4]], ko: 'can + I → kuh-nai · get + you → ge-chuh' },
    { q: 'pa_more', en: 'Anything else?', words: ['Anything', 'else?'], sound: [['eh', 0], ['nee', 0], ['thing', 0], ['GELSE', 1]], link: [[0, 1]], ko: 'anything의 끝 g가 else에 붙어 thing-gelse' },
    { q: 'op_room', en: 'Room for milk?', words: ['Room', 'for', 'milk?'], sound: [['ROOM', 1], ['fer', 0], ['MILK', 1]], link: [], ko: 'for → fer: 아주 약하게 · room은 방이 아니라 빈자리' },
  ];

  /* ---------- 직접 해 보기 자료 ---------- */
  CF.ORD_SIT = { latte: { drink: 'latte' }, icedam: { drink: 'americano', temp: 'iced' }, mocha: { drink: 'mocha' } };
  CF.ORD_SIT_KO = { latte: '라테', icedam: '아이스 아메리카노', mocha: '모카' };
  CF.ORD_FRAMES = ['or_can', 'or_like', 'or_give', 'or_want'];
  CF.ORD_VALS = ['latte', 'icedam', 'iceam', 'mocha'];
  CF.CHG_SIT = ['oat', 'shot', 'lessice', 'nosugar', 'nowhip'];
  CF.CHG_FRAMES = ['cu_with', 'cu_no', 'cu_give'];
  CF.REQ_FRAMES = ['hp_could', 'hp_give', 'hp_want'];
  CF.CUP_ASK = { sz_size: ['sz_pl', 'sz_up', 'of_yes', 'tp_pl'], tp_temp: ['tp_pl', 'tp_ice', 'of_yes', 'sz_pl'] };

  /* =========================================================
     따라 말하기 28문장 (단계마다 바리스타 · 손님 말)
     ========================================================= */
  const SH = (place, who, en, ko) => ({ place, who, en, ko, sp: who === 'me' ? 'me' : CF.PLACE[place].sp });
  CF.SHADOW = [
    SH('door', 'staff', 'Hi! Are you ready to order?', '안녕하세요! 주문하시겠어요?'),
    SH('door', 'me', 'Not yet. Just a minute, please.', '아직이요. 잠깐만요.'),
    SH('counter', 'staff', 'What can I get you?', '무엇을 드릴까요?'),
    SH('counter', 'me', 'Can I get an iced americano?', '아이스 아메리카노 주시겠어요?'),
    SH('counter', 'me', 'Can I get a medium iced latte with oat milk to go?', '미디엄 아이스 라테를 귀리 우유로, 가져갈게요.'),
    SH('size', 'staff', 'What size?', '어떤 크기로 드릴까요?'),
    SH('size', 'me', 'Medium, please.', '미디엄으로 주세요.'),
    SH('size', 'staff', 'Hot or iced?', '따뜻한 걸로요, 차가운 걸로요?'),
    SH('size', 'me', 'Iced, please.', '차가운 걸로 주세요.'),
    SH('size', 'me', 'Can I make it a large?', '라지로 바꿔 주시겠어요?'),
    SH('option', 'staff', 'What kind of milk?', '우유는 어떤 걸로 드릴까요?'),
    SH('option', 'me', 'Oat milk, please.', '귀리 우유로 주세요.'),
    SH('option', 'staff', 'Would you like an extra shot?', '샷을 하나 더 넣어 드릴까요?'),
    SH('option', 'me', 'No, thanks.', '아니요, 괜찮아요.'),
    SH('option', 'me', 'Can I get it with less ice?', '얼음 적게 넣어서 주시겠어요?'),
    SH('name', 'staff', 'Can I get a name for that?', '주문하신 분 이름이 어떻게 되세요?'),
    SH('name', 'me', 'It\'s Minji.', '민지예요.'),
    SH('name', 'staff', 'For here or to go?', '여기서 드세요, 가져가세요?'),
    SH('name', 'me', 'To go, please.', '가져갈게요.'),
    SH('name', 'me', 'Sorry, for here or to go?', '죄송한데, 여기서 마실지 가져갈지 물으신 거죠?'),
    SH('pay', 'staff', 'Anything else?', '더 필요한 것 있으세요?'),
    SH('pay', 'me', 'No, that\'s it. Thanks.', '아니요, 그게 다예요. 고마워요.'),
    SH('pay', 'staff', 'That\'ll be $6.50.', '6달러 50센트입니다.'),
    SH('pay', 'staff', 'Card or cash?', '카드로 하시겠어요, 현금으로 하시겠어요?'),
    SH('pay', 'me', 'Card, please.', '카드로 할게요.'),
    SH('pickup', 'staff', 'Medium iced latte for Minji!', '민지 님, 미디엄 아이스 라테 나왔어요!'),
    SH('pickup', 'me', 'Excuse me, I ordered it iced, but this one is hot.', '실례지만, 차갑게 주문했는데 이건 따뜻해요.'),
    SH('pickup', 'me', 'Could I get a lid, please?', '뚜껑 하나 주시겠어요?'),
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: key 열쇠 낱말 · frame 대답 틀 · slot 내 정보 · pol 공손한 말 · trap 함정 · ok 정답
     ========================================================= */
  const LL = k => `(${L4[k]})`;
  CF.judgeItem = (it, k) => CF.judge(it.Q, it.opts[k], it.card, '상황');
  const cardSay = c => Object.keys(c || {}).map(k => CF.factKo(k, c[k])).join(' · ');
  const segMarks = (a, k, roleOf) => CF.segs(a).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).map(s => ({ t: s.t.trim().replace(/^[,.?!]+|[,.?!]+$/g, ''), role: roleOf(s), at: k })).filter(m => m.t);
  CF.steps = function (it) {
    const q = it.Q, J = it.opts.map((_, k) => CF.judgeItem(it, k)), at = s => it.opts.map((_, k) => k).filter(k => J[k].stage === s);
    const best = it.opts[it.a];
    // ①
    let t1;
    if (q.fast) t1 = '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 묻는지 모르면 짐작해서 답하지 말고 다시 물어요. 들린 낱말이 있으면 주문 순서로 짐작해 되물어요.';
    else t1 = `열쇠 낱말 ${q.key.join(' … ')} → ${CF.sayOf(q.intent)}. ${CF.INTENT[q.intent].want}`;
    if (at(1).length) t1 += ' ' + at(1).map(k => LL(k)).join(' · ') + (q.fast ? ' → 짐작한 대답이거나 다른 질문을 되물어 탈락.' : ' → 다른 질문에 맞는 대답이라 탈락.');
    const m1 = q.fast ? [] : q.key.map(t => ({ t, role: 'key', at: 'q' }));
    at(1).forEach(k => m1.push({ t: CF.text(it.opts[k]).replace(/[.?!]$/, ''), role: 'trap', at: k }));
    // ②
    const sit = cardSay(it.card);
    const ft = CF.FRAME[best.f].t ? CF.FRAME[best.f].t.replace(/[{}]/g, '').replace('___', '…') : CF.text(best);
    let t2 = (q.fast ? '상황 → 처음 듣고 다 알아듣지 못했어요. ' : sit ? `상황 → ${sit}. ` : '') + `맞는 틀 → ${ft}`;
    const tagKo = j => j.tag === 'fact' ? '상황과 다른 정보' : j.tag === 'order' ? '순서가 뒤섞임' : j.tag === 'wrong' ? '틀린 문장' : '한국어 그대로 옮긴 말 · 콩글리시';
    if (at(2).length) t2 += ' · ' + at(2).map(k => `${LL(k)} ${tagKo(J[k])}`).join(' · ') + ' → 탈락.';
    else t2 += ' · 틀과 정보가 모두 맞는 보기만 남았어요.';
    const m2 = [];
    it.opts.forEach((a, k) => {
      if (J[k].stage === 1) return;
      const sb = CF.FRAME[a.f].slot && CF.SLOT[CF.FRAME[a.f].slot].vals[a.v] && CF.SLOT[CF.FRAME[a.f].slot].vals[a.v].bad;
      segMarks(a, k, s => s.r === 'pol' ? '' : (J[k].stage === 2 && ((J[k].tag === 'fact' || sb) ? s.r === 'slot' : s.r === 'frame')) ? 'trap' : s.r).forEach(m => { if (m.role) m2.push(m); });
    });
    // ③
    let t3 = at(3).length ? at(3).map(k => `${LL(k)} ${CF.text(it.opts[k])} → ${J[k].tag === 'plain' ? '그냥 No.로 끊김' : '명령 · 조르기 · 따지는 말투'}`).join(' · ') + ' → 탈락. ' : '명령하거나 조르는 말투의 보기는 없어요. ';
    t3 += `정답 ${LL(it.a)} → ${J[it.a].why}`;
    const m3 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 3) segMarks(a, k, () => 'trap').forEach(m => m3.push(m)); else if (J[k].stage === 0) segMarks(a, k, s => s.r === 'pol' ? 'pol' : '').forEach(m => { if (m.role) m3.push(m); }); });
    m3.push({ t: CF.text(it.opts[it.a]), role: 'ok', at: it.a, whole: true });
    return [
      { head: '① 열쇠 낱말 잡기', text: t1, marks: m1 },
      { head: '② 틀에 내 정보 넣기', text: t2, marks: m2 },
      { head: '③ 공손하게 끝내기', text: t3, marks: m3 },
    ];
  };
  CF.notes = it => it.opts.map((_, k) => { const j = CF.judgeItem(it, k); return (j.ok ? '' : `× ${['', '①', '②', '③'][j.stage]} `) + j.why; });

  /* =========================================================
     데이터 점검 — 열쇠 낱말이 질문에 없거나, 맞는 보기가 하나가 아니거나, 정답 위치가 몰리면 경고
     ========================================================= */
  CF.check = function () {
    const bad = [];
    const hasT = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase());
    Object.values(CF.Q).forEach(q => {
      if (!CF.PLACE[q.place]) bad.push(`질문 ${q.id}: 단계 ${q.place}가 없어요`);
      if (q.intent && !CF.INTENT[q.intent]) bad.push(`질문 ${q.id}: 뜻 ${q.intent}가 없어요`);
      q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`질문 ${q.id}: 열쇠 낱말 ‘${k}’가 질문에 없어요`); });
    });
    Object.values(CF.FRAME).forEach(F => {
      [].concat(F.intent).forEach(i => { if (!CF.INTENT[i]) bad.push(`틀 ${F.id}: 뜻 ${i}가 없어요`); });
      if (F.slot && !CF.SLOT[F.slot]) bad.push(`틀 ${F.id}: 칸 ${F.slot}이 없어요`);
      if (F.slot && !/___/.test(F.t)) bad.push(`틀 ${F.id}: 칸이 있는데 ___가 없어요`);
      if (F.tag !== 'ok' && !F.why) bad.push(`틀 ${F.id}: 함정 틀에 까닭(why)이 없어요`);
      if (F.slot) Object.values(CF.SLOT[F.slot].vals).forEach(v => { if (v[F.form || 't'] == null) bad.push(`틀 ${F.id}: 칸 값에 ${F.form || 't'} 꼴이 없어요`); });
    });
    Object.values(CF.INTENT).forEach(In => { if (!In.generic && In.best && typeof In.best === 'string' && !CF.FRAME[In.best]) bad.push(`뜻의 모범 틀 ${In.best}가 없어요`); });
    // 연습 문제
    const pos = [0, 0, 0, 0];
    CF.DRILL.forEach((it, i) => {
      const w = `듣고 대답 고르기 ${i + 1}`;
      if (!it.Q) { bad.push(`${w}: 질문 ${it.q}가 없어요`); return; }
      const good = it.opts.map((_, k) => k).filter(k => CF.judgeItem(it, k).ok);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]}`);
      const texts = it.opts.map(CF.text);
      if (new Set(texts).size !== texts.length) bad.push(`${w}: 같은 보기가 있어요`);
      if (!it.sit) bad.push(`${w}: 상황 글이 없어요`);
      pos[it.a]++;
    });
    if (Math.max(...pos) - Math.min(...pos) > 1) bad.push(`듣고 대답 고르기 정답 위치가 몰려 있어요: ${pos.join(',')}`);
    const places = new Set(CF.DRILL.map(it => it.place));
    CF.PLACES.forEach(p => { if (!places.has(p.id)) bad.push(`듣고 대답 고르기: ${p.ko} 문제가 없어요`); });
    if (CF.DRILL.filter(it => it.Q.fast).length < 2) bad.push('듣고 대답 고르기: 빠른 말(다시 묻기) 문제가 둘보다 적어요');
    Object.entries(CF.MINI).forEach(([k, it]) => { const good = it.opts.map((_, i) => i).filter(i => CF.judgeItem(it, i).ok); if (good.length !== 1 || good[0] !== it.a) bad.push(`직접 해 보기 ${k}: 맞는 보기 ${good}`); });
    // 영상 · 직접 해 보기의 대화가 판정과 맞나
    const want = (w, q, a, c, ok) => { const j = CF.judge(q, a, c); if (j.ok !== ok) bad.push(`${w}: ${CF.text(a)} → 판정 ${j.ok ? '✓' : '×'} (${j.why})`); return j; };
    want('00장 한국어 그대로', CF.INTRO.q, CF.INTRO.lit, CF.INTRO.card, false); want('00장 자연스러운 말', CF.INTRO.q, CF.INTRO.ok, CF.INTRO.card, true);
    const SC = CF.SCENE;
    SC.order.forEach(([q, a, c], i) => want(`02장 ${i + 1}`, q, a, c, true));
    want('02장 ice', 'co_what', SC.ice[0], { drink: 'americano', temp: 'iced' }, false); want('02장 iced', 'co_what', SC.ice[1], { drink: 'americano', temp: 'iced' }, true);
    SC.blunt.forEach((a, i) => want(`02장 말투 ${i + 1}`, 'co_what', a, {}, i === 2));
    SC.size.forEach(([q, a], i) => want(`03장 ${i + 1}`, q, a, CF.DEMO, true));
    SC.tempTrap.forEach((a, i) => want(`03장 함정 ${i + 1}`, 'tp_temp', a, CF.DEMO, false));
    SC.option.forEach(([q, a], i) => want(`04장 ${i + 1}`, q, a, CF.DEMO, true));
    SC.shotTrap.forEach((a, i) => want(`04장 샷 ${i + 1}`, 'op_shot', a, { shot: i === 0 ? true : false }, i === 2));
    SC.withs.forEach(v => want(`04장 with ${v}`, 'op_add', { f: 'cu_with', v }, { chg: v }, true));
    SC.nos.forEach(v => want(`04장 no ${v}`, 'op_add', { f: 'cu_no', v }, { chg: v }, true));
    want('04장 room', SC.room[0], SC.room[1], SC.room[2], true);
    want('05장 이름 함정', SC.name[0], SC.name[1], CF.DEMO, false); want('05장 이름', SC.name[0], SC.name[2], CF.DEMO, true);
    want('05장 포장', SC.togo[0], SC.togo[1], CF.DEMO, true); want('05장 take out', 'nm_togo', SC.take, CF.DEMO, true); want('05장 packing', 'nm_togo', SC.pack, CF.DEMO, false);
    want('05장 다시 묻기 1', SC.repair[0], SC.repair[1], {}, true); want('05장 다시 묻기 2', SC.repair[0], SC.repair[2], {}, true);
    want('06장 더 살 것', SC.more[0], SC.more[1], CF.DEMO, true); want('06장 계산', SC.pay[0], SC.pay[1], CF.DEMO, true); want('06장 카드 계산', SC.pay[0], SC.pay[2], CF.DEMO, false); want('06장 영수증', SC.receipt[0], SC.receipt[1], CF.DEMO, true);
    want('07장 부름', CF.simQ('pk_call', CF.DEMO), SC.call[1], CF.DEMO, true);
    SC.wrong.forEach((a, i) => want(`07장 ${i + 1}`, 'pk_help', a, { need: 'temp' }, i === 1));
    SC.could.forEach(v => want(`07장 부탁 ${v}`, 'pk_help', { f: 'hp_could', v }, { need: v }, true));
    SC.needBlunt.forEach((a, i) => want(`07장 빨대 ${i + 1}`, 'pk_help', a, { need: 'straw' }, i === 1));
    if (CF.Q.pk_call.en !== CF.simQ('pk_call', CF.DEMO).en) bad.push(`07장 부름: ${CF.Q.pk_call.en} ≠ ${CF.simQ('pk_call', CF.DEMO).en}`);
    // 한 문장 주문 · 값
    want('08장 한 문장', 'co_what', { f: 'line', line: CF.LINE }, CF.DEMO, true);
    want('08장 순서 뒤섞임', 'co_what', { f: 'line', line: CF.LINE_BAD }, CF.DEMO, false);
    const cov = CF.covered({ f: 'line', line: CF.LINE }, 'co_what').sort().join();
    if (cov !== ['order', 'size', 'temp', 'milk', 'milkok', 'room', 'togo'].sort().join()) bad.push(`08장 한 문장이 답한 질문: ${cov}`);
    if (CF.price(CF.DEMO).total !== 650) bad.push(`06장 값: ${CF.money(CF.price(CF.DEMO).total)} (≠ $6.50)`);
    if (CF.Q.pa_total.en !== `That'll be ${CF.money(CF.price(CF.DEMO).total)}.`) bad.push('06장 값 안내가 계산과 달라요');
    [[650, 'six fifty'], [425, 'four twenty-five'], [500, 'five dollars'], [305, 'three oh five'], [925, 'nine twenty-five']].forEach(([c, w]) => { if (CF.priceWords(c) !== w) bad.push(`값 읽기 ${c}: ${CF.priceWords(c)}`); });
    CF.METHOD.forEach(([q, a, c], i) => want(`09장 ${i + 1}`, q, a, c, true));
    // 실전: 지워지는 단계가 줄 글과 맞나
    CF.PRACTICE.forEach((p, i) => {
      const w = `실전 ${i + 1}`;
      const J = p.opts.map(a => CF.judge(p.q, a, CF.PCARD));
      const good = J.map((j, k) => j.ok ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== p.a) bad.push(`${w}: 맞는 보기 ${good}`);
      [1, 2, 3].forEach(st => {
        const gone = J.map((j, k) => j.stage === st ? LL(k) : null).filter(Boolean).sort().join();
        const said = (p.lines[st - 1].match(/\([A-D]\)/g) || []).filter(x => st < 3 || x !== LL(p.a)).sort().join();
        if (gone !== said) bad.push(`${w} ${st}단계: 엔진 ${gone || '-'} · 화면 ${said || '-'}`);
      });
      if (!p.lines[2].includes(`정답 ${LL(p.a)}`)) bad.push(`${w}: 정답 표시가 달라요`);
    });
    // 시뮬레이터: 카드 여럿을 만들어 모범 대답은 통과, 틀 칩 가운데 맞는 것이 하나뿐인지, 한 문장 모범 주문이 통과하는지
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 40; n++) {
      const c = CF.newCard(rnd);
      CF.simQs(c, rnd).forEach(id => {
        const q = CF.simQ(id, c), m = CF.model(q, c), j = CF.judge(q, m, c);
        if (!j.ok) bad.push(`시뮬레이터 ${id}: 모범 대답이 탈락 (${CF.text(m)} · ${j.why})`);
        const fr = CF.SIM_FRAMES[q.intent];
        if (!fr) { bad.push(`시뮬레이터 ${id}: 틀 칩이 없어요`); return; }
        const okN = fr.filter(f => { const F = CF.FRAME[f]; const v = F.slot ? ([].concat(F.intent).includes(q.intent) ? CF.slotVal(F.slot, c) : null) || slotIds(F.slot)[0] : undefined; return CF.judge(q, { f, v }, c).ok; }).length;
        if (okN !== 1) bad.push(`시뮬레이터 ${id}: 맞는 틀이 ${okN}개예요`);
        if (q.intent !== 'name' && (CF.SPOKEN[q.intent] || q.intent === 'order') && !CF.matchSpoken(CF.spoken(CF.text(m)), q, c).ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 말로 해도 통과하지 못해요 (${CF.text(m)} · ${CF.matchSpoken(CF.text(m), q, c).why})`);
      });
      const L = CF.modelLine(c), jl = CF.judge('co_what', L, c);
      if (!jl.ok) bad.push(`시뮬레이터 한 문장: ${CF.text(L)} · ${jl.why}`);
      const ms = CF.matchSpoken(CF.text(L), 'co_what', c);
      if (!ms.ok || CF.covered(L, 'co_what').filter(i => !ms.covered.includes(i)).length) bad.push(`시뮬레이터 한 문장을 말로: ${CF.text(L)} · ${ms.why}`);
    }
    // 따라 말하기: 같은 말은 모두 맞아야 · 음성 해설용 값 읽기
    CF.SHADOW.forEach((s, i) => { const r = CF.compareWords(s.en, CF.spoken(s.en)); if (r.hit !== r.total) bad.push(`따라 말하기 ${i + 1}: 같은 글이 다 맞지 않아요`); if (!CF.PLACE[s.place]) bad.push(`따라 말하기 ${i + 1}: 단계가 없어요`); });
    if (CF.SHADOW.length !== 28) bad.push(`따라 말하기 문장 수: ${CF.SHADOW.length}`);
    bad.forEach(b => console.warn('[카페] ' + b));
    return bad;
  };

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  CF.allText = function () {
    const out = [];
    Object.values(CF.Q).forEach(q => out.push(q.en, q.ko, q.short || ''));
    Object.values(CF.FRAME).forEach(F => out.push(F.t, F.ko, F.why || '', F.note || ''));
    Object.values(CF.SLOT).forEach(S => Object.values(S.vals).forEach(v => out.push(Object.values(v).filter(x => typeof x === 'string').join(' '))));
    Object.values(CF.ASK).forEach(a => out.push(a.ko, a.say)); Object.values(CF.INTENT).forEach(a => out.push(a.ans, a.want || '', a.say || '', a.turn || ''));
    CF.PLACES.forEach(p => out.push(p.ko, p.en)); Object.values(CF.MENU).forEach(m => out.push(m.en, m.ko, m.en.toUpperCase()));
    Object.values(CF.FOOD).forEach(m => out.push(m.en, m.ko, m.en.toUpperCase())); Object.values(CF.EXTRA).forEach(m => out.push(m.en, m.ko));
    CF.PRACTICE.forEach(p => out.push(p.lines.join(''))); CF.SHADOW.forEach(s => out.push(s.en, s.ko));
    CF.LINKED.forEach(l => out.push(l.en, l.ko, l.sound.map(s => s[0]).join(''))); Object.values(CF.OCAT).forEach(c => out.push(c.ko)); Object.values(CF.OW).forEach(w => out.push(w.t));
    out.push(CF.CAFE, CF.CAFE.toUpperCase(), '$0123456789.·+', 'TOTAL CARD CASH SUBTOTAL THANK YOU MENU');
    return out.join('');
  };
})();
