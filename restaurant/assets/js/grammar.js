/* 식당 회화 — 규칙 엔진과 대화 자료 (상황별 영어 회화)
 *
 * 식당에서는 서버가 짧은 질문을 아주 많이 해요. 물, 음료, 주문, 굽기, 곁들임, 알레르기, 디저트, 계산까지.
 * 그래서 식당의 핵심은 ‘질문의 모양이 대답의 모양을 정한다’예요. 모양은 셋이에요.
 *   Yes/No 질문 (Are you ready to order? · Would you like some dessert?) → Yes · No + 한 마디.
 *               권하는 말이면 원하는 것을 바로 말해도 돼요 (Can I get you something to drink? → Just water, please.)
 *   고르는 질문 (Inside or outside? · Still or sparkling? · Soup or salad?) → 고른 것 + please. Yes.로는 답이 안 돼요
 *   정보 질문   (How many? · How would you like your steak? · Which dressing?) → 정보 + please. Yes.로는 답이 안 돼요
 * 질문이 아닌 안내(Here's your steak. · Enjoy your meal!)는 고맙다고 하거나, 내가 먼저 말을 꺼낼 차례예요.
 *
 * 규칙 엔진은 소리를 듣지 않고, 말마다 적어 둔 ‘뜻(intent) · 모양(shape)’과 ‘대답 틀(frame) + 내 정보(slot)’,
 * 그리고 식사 카드(또는 상황)의 사실을 맞춰 봐요.
 *
 * 3단계 말하기 법 — RS.judge(서버의 말, 대답, 카드)
 *   ① 열쇠 낱말 + 질문의 모양 잡기 — 고르는 질문 · 정보 질문에 Yes · No만 하면 탈락, 고르는 질문이면 서버가 말한 것 가운데 골랐나,
 *                      대답이 그 말(intent)에 맞나. 빠르게 말해 못 알아들은 말(fast)이면 짐작한 대답은 탈락 → 다시 묻기
 *   ② 틀에 내 정보 넣기 — 틀이 자연스러운가(한국어 그대로 · 콩글리시 · 틀린 문장이면 탈락), 칸의 정보가 카드와 맞는가,
 *                      Yes/No 질문의 Yes · No가 카드와 맞는가, 한 줄 주문(RS.orderLine)의 순서, 되물은 숫자가 들은 숫자와 같은가
 *   ③ 공손하게 끝내기 — 명령 · 조르는 말 · 따지는 말 · 큰 소리로 부르는 말(blunt)이나 그냥 No.로 끊긴 말(plain)이면 탈락
 * judge → { ok, stage: 0 | 1 | 2 | 3, why, tag }
 *
 * 질문의 모양: RS.shapeOf(말) → 'yn' · 'or' · 'wh' · 'note'(안내). 말마다 적어 두고(고르는 질문은 choices도), RS.check()가 글의 모양과 맞춰 봐요.
 * 한 줄 주문: RS.orderLine(낱말) — (I'll have the) 음식 → 굽기 · 맵기 → with 곁들임 → 드레싱 → without ___ → please (단순하게 줄인 규칙)
 *             RS.covered(대답, 말) — 그 대답이 이미 답한 서버의 질문 → 시뮬레이터의 서버가 건너뜀
 * 메뉴와 계산: RS.MENU(지어낸 메뉴 · 값) · RS.bill(카드) · RS.split(계산서, 사람 수) · RS.safe(음식, 알레르기)
 *       영상 · 메뉴판 · 계산서 · 서버의 말이 모두 이 계산을 써요. 목소리는 RS.spoken으로 읽어요($14.50 → fourteen fifty).
 *
 * 영상의 ✓·×, 직접 해 보기, 식당 시뮬레이터, 듣고 대답 고르기, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 RS.check()가 콘솔에 경고를 내요.
 */
(function () {
  'use strict';
  const RS = (window.RS = {});
  const L4 = 'ABCD';

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; if (/[0-9]/.test(s[i])) return '0136781'.includes(s[i]) ? 0xAC01 : 0xAC00; if (/[A-Za-z]/.test(s[i])) return /[lmnr]/i.test(s[i]) ? 0xAC01 : 0xAC00; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const rieul = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 === 8 : false; };
  const wa = s => s + (has(s) ? '과' : '와'), eul = s => s + (has(s) ? '을' : '를'), ig = s => s + (has(s) ? '이' : '가');
  const ro = s => s + (has(s) && !rieul(s) ? '으로' : '로'), ieyo = s => s + (has(s) ? '이에요' : '예요'), eun = s => s + (has(s) ? '은' : '는');
  RS.josa = { wa, eul, ig, ro, ieyo, eun };

  /* =========================================================
     식당 일곱 곳 (식사하는 차례). sp: 그곳 직원의 목소리 (voices.js)
     ========================================================= */
  RS.PLACES = [
    { id: 'door', ko: '입구 · 자리 안내', en: 'Host stand · Seating', sp: 'au' },
    { id: 'drinks', ko: '자리 · 음료', en: 'Table · Drinks', sp: 'us' },
    { id: 'order', ko: '주문', en: 'Ordering', sp: 'us' },
    { id: 'allergy', ko: '알레르기 · 요청', en: 'Allergies · Requests', sp: 'us' },
    { id: 'meal', ko: '식사 중', en: 'During the meal', sp: 'us' },
    { id: 'dessert', ko: '디저트 · 포장', en: 'Dessert · To-go box', sp: 'us' },
    { id: 'check', ko: '계산', en: 'The check', sp: 'us' },
  ];
  RS.PLACE = {}; RS.PLACES.forEach((p, i) => { p.i = i; RS.PLACE[p.id] = p; });
  RS.ME = 'me';
  RS.REST = 'Juniper Table';   // 지어낸 식당 이름
  RS.SERVER = 'Sam';           // 지어낸 서버 이름
  // 내가 먼저 말을 꺼내는 곳 (알레르기 묻기 · 서버 부르기 · 계산 부탁)
  RS.ME_FIRST = { allergy: 1, meal: 1, check: 1 };

  /* =========================================================
     질문의 모양 세 가지 (+ 안내). mark: 그림 이름 (scenes.js의 shape_yn · shape_or · shape_wh · shape_note)
     ========================================================= */
  RS.SHAPE = {
    yn: { ko: 'Yes/No 질문', mark: '스위치', ans: 'Yes · No + 한 마디', say: 'Yes/No 질문이에요. Yes · No에 한 마디를 더해요', offer: '권하는 말이면 원하는 것을 바로 말해도 돼요(Yes는 빼도 돼요)' },
    or: { ko: '고르는 질문', mark: '갈림길', ans: '고른 것 + please', say: '고르는 질문(A or B?)이에요. 서버가 말한 것 가운데 하나를 골라 말해요' },
    wh: { ko: '정보 질문', mark: '빈 상자', ans: '정보 + please', say: '정보 질문이에요. 묻는 정보를 채워 말해요' },
    note: { ko: '안내', mark: '말풍선', ans: '고맙다는 말 · 내가 먼저 말할 차례', say: '질문이 아니라 알려 주는 말이에요' },
  };
  // 말의 모양 (적어 둔 것)
  RS.shapeOf = q => (typeof q === 'string' ? RS.Q[q] : q).shape;
  // 글만 보고 짐작한 모양 (점검용): 물음표 문장 가운데 마지막 것 → or가 있으면 고르기, 의문사로 시작하면 정보, 아니면 Yes/No
  RS.shapeGuess = function (en) {
    const qs = String(en).match(/[^.!?]*\?/g);
    if (!qs) return 'note';
    let s = qs[qs.length - 1].trim().toLowerCase().replace(/^(and|so|great|okay|sure|perfect|thanks|now)[,!]?\s+/, '');
    if (/\bor\b/.test(s)) return 'or';
    if (/^(how|what|which|where|when|who|why|under what)\b/.test(s)) return 'wh';
    return 'yn';
  };

  /* =========================================================
     숫자 읽기 — 사람 수 · 기다리는 분 · 시각 · 값 (화면 글 → 소리)
     ========================================================= */
  const NUMW = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };
  const numWord = n => n < 20 || (n < 100 && n % 10 === 0) ? NUMW[n] : n < 100 ? `${NUMW[n - n % 10]}-${NUMW[n % 10]}` : n < 1000 ? `${NUMW[Math.floor(n / 100)]} hundred${n % 100 ? ' ' + numWord(n % 100) : ''}` : String(n);
  RS.numWord = numWord;
  const join2 = (a, b) => (b.includes('-') && !b.startsWith('oh-') ? `${a} ${b}` : `${a}-${b}`);
  // 시각: 7:30 → seven-thirty · 8:15 → eight-fifteen · 7:00 → seven
  RS.timeWords = t => { const [h, m] = String(t).split(':').map(Number); return !m ? numWord(h) : join2(numWord(h), m < 10 ? 'oh-' + numWord(m) : numWord(m)); };
  RS.timeKo = t => { const [h, m] = String(t).split(':').map(Number); return `${h}시${m ? ` ${m}분` : ''}`; };
  // 값 (센트): 식당에서 말하는 꼴 — $14.50 → fourteen fifty · $26.00 → twenty-six dollars · $23.40 → twenty-three forty · $3.05 → three oh five
  RS.money = c => '$' + (c / 100).toFixed(2);
  RS.priceWords = c => { const d = Math.floor(c / 100), k = c % 100; return !k ? `${numWord(d)} dollar${d === 1 ? '' : 's'}` : `${numWord(d)} ${k < 10 ? 'oh ' + numWord(k) : numWord(k)}`; };
  RS.priceKo = c => { const d = Math.floor(c / 100), k = c % 100; return k ? `${d}달러 ${k}센트` : `${d}달러`; };
  // 소리 내어 읽을 글: 값 → 시각
  RS.spoken = s => String(s)
    .replace(/\$(\d+)\.(\d{2})/g, (m, d, c) => RS.priceWords(+d * 100 + +c))
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (m, h, mm) => RS.timeWords(`${h}:${mm}`));

  /* =========================================================
     메뉴 (지어낸 식당 · 지어낸 값, 단위: 센트)
     has: 들어 있는 알레르기 성분 { 성분: { part: 그 재료, fixed: 뺄 수 없음 } }
     needs: 주문하면 서버가 더 묻는 것 (cook 굽기 · starter 수프나 샐러드 · spice 맵기)
     ========================================================= */
  RS.MENU = {
    steak: { en: 'Ribeye steak', ko: '립아이 스테이크', p: 2600, kind: 'main', needs: ['cook', 'starter'], has: {} },
    salmon: { en: 'Grilled salmon', ko: '구운 연어', p: 2250, kind: 'main', needs: ['starter'], has: {} },
    noodles: { en: 'Peanut noodles', ko: '땅콩 소스 국수', p: 1750, kind: 'main', needs: ['spice'], has: { peanuts: { part: 'the peanut sauce', ko: '땅콩 소스', fixed: true }, shrimp: { part: 'the shrimp', ko: '새우', fixed: false } } },
    pasta: { en: 'Shrimp pasta', ko: '새우 크림 파스타', p: 1950, kind: 'main', needs: ['starter'], has: { shrimp: { part: 'the shrimp', ko: '새우', fixed: true }, milk: { part: 'the cream sauce', ko: '크림 소스', fixed: true } } },
    burger: { en: 'Veggie burger', ko: '채소 버거', p: 1600, kind: 'main', needs: [], side: 'fries', has: { milk: { part: 'the cheese', ko: '치즈', fixed: false } } },
    risotto: { en: 'Mushroom risotto', ko: '버섯 리소토', p: 2100, kind: 'main', needs: [], special: true, has: { milk: { part: 'the parmesan', ko: '파르메산 치즈', fixed: true } } },
    soup: { en: 'Tomato soup', ko: '토마토 수프', p: 0, kind: 'starter', has: { milk: { part: 'the cream', ko: '크림', fixed: true } } },
    salad: { en: 'House salad', ko: '하우스 샐러드', p: 0, kind: 'starter', has: { nuts: { part: 'the walnuts', ko: '호두', fixed: false } } },
    ranch: { en: 'Ranch dressing', ko: '랜치 드레싱', p: 0, kind: 'dressing', has: { milk: { part: 'the ranch dressing', ko: '랜치 드레싱', fixed: false } } },
    italian: { en: 'Italian dressing', ko: '이탈리안 드레싱', p: 0, kind: 'dressing', has: {} },
    balsamic: { en: 'Balsamic dressing', ko: '발사믹 드레싱', p: 0, kind: 'dressing', has: {} },
    sparkling: { en: 'Sparkling water', ko: '탄산수 (병)', p: 500, kind: 'water', has: {} },
    lemonade: { en: 'Lemonade', ko: '레모네이드', p: 400, kind: 'drink', has: {} },
    soda: { en: 'Lemon-lime soda', ko: '레몬 라임 탄산음료 (사이다)', p: 350, kind: 'drink', has: {} },
    icedtea: { en: 'Iced tea', ko: '아이스티', p: 350, kind: 'drink', has: {} },
    cake: { en: 'Chocolate cake', ko: '초콜릿 케이크', p: 800, kind: 'dessert', has: { milk: { part: 'the cream', ko: '크림', fixed: true } } },
    sorbet: { en: 'Fruit sorbet', ko: '과일 셔벗', p: 650, kind: 'dessert', has: {} },
  };
  RS.MAINS = ['steak', 'salmon', 'noodles', 'pasta', 'burger'];     // 메뉴판에 적힌 주 요리 (리소토는 오늘의 스페셜)
  RS.SPECIAL = 'risotto';
  RS.ALLERGENS = { peanuts: { en: 'peanuts', adj: 'peanut', ko: '땅콩', badge: 'P' }, shrimp: { en: 'shrimp', adj: 'shrimp', ko: '새우', badge: 'S' }, milk: { en: 'milk', adj: 'milk', ko: '우유(유제품)', badge: 'M' }, nuts: { en: 'nuts', adj: 'nut', ko: '견과류', badge: 'N' } };
  RS.TIP_NOTE = '팁(tip)은 나라 · 식당마다 달라요. 꼭 내는 곳도, 거의 안 내는 곳도 있어요.';
  // 주 요리에 딸린 수프나 샐러드 (스테이크 · 연어 · 파스타)
  RS.hasStarter = dish => !!(RS.MENU[dish] && RS.MENU[dish].needs.includes('starter'));

  /* ---------- 알레르기 확인 — RS.safe(음식, 알레르기) ---------- */
  // items: 음식 id 하나 또는 [주 요리, 수프나 샐러드, 드레싱] → { contains, removable, item, part, ko }
  RS.safe = function (items, allergy) {
    if (!allergy || allergy === 'none') return { contains: false, removable: false };
    const list = [].concat(items).filter(Boolean);
    for (const id of list) {
      const m = RS.MENU[id], h = m && m.has[allergy];
      if (h) return { contains: true, removable: !h.fixed, item: id, part: h.part, ko: h.ko };
    }
    return { contains: false, removable: false, item: list[0] };
  };
  // 카드의 음식 묶음 (주 요리 + 수프나 샐러드 + 드레싱)
  RS.plate = c => [c.dish, RS.hasStarter(c.dish) ? c.starter : null, c.starter === 'salad' && RS.hasStarter(c.dish) ? c.dressing : null].filter(Boolean);
  // 서버가 계산한 대답
  RS.safeReply = function (items, allergy) {
    const s = RS.safe(items, allergy), A = RS.ALLERGENS[allergy], first = [].concat(items)[0], nm = id => RS.MENU[id].en.replace(/ dressing$/i, ' dressing');
    // 이름이 복수인 음식(Peanut noodles) → come · don't · make them
    const pl = id => /s$/i.test(RS.MENU[id].en);
    if (!A) return { en: '', ko: '', s };
    if (!s.contains) return { en: `Thanks for letting me know. Good news — the ${nm(first).toLowerCase()} ${pl(first) ? 'don\'t' : 'doesn\'t'} have any ${A.en}.`, ko: `알려 주셔서 고마워요. 다행히 ${RS.MENU[first].ko}에는 ${A.ko}${has(A.ko) ? '이' : '가'} 없어요.`, s };
    const it = RS.MENU[s.item];
    // 드레싱에 들어 있으면 → 다른 드레싱을 권해요
    if (s.removable && /dressing$/i.test(it.en)) return { en: `Thanks for letting me know. The ${it.en.toLowerCase()} has ${A.en} in it. Would you like a different dressing?`, ko: `알려 주셔서 고마워요. ${it.ko}에는 ${A.ko}${has(A.ko) ? '이' : '가'} 들어 있어요. 다른 드레싱으로 드릴까요?`, s };
    if (s.removable) return { en: `Thanks for letting me know. The ${it.en.toLowerCase()} ${pl(s.item) ? 'come' : 'comes'} with ${s.part.replace(/^the /, '')}, but we can make ${pl(s.item) ? `them without ${s.part}` : `it without ${s.part === 'the cheese' || s.part === 'the ranch dressing' ? 'it' : 'them'}`}. Is that okay?`, ko: `알려 주셔서 고마워요. ${it.ko}에 ${eul(s.ko)} 넣지만, 빼고 만들 수 있어요. 괜찮으세요?`, s };
    return { en: `I'm afraid ${s.part} can't be left out. Would you like to choose something else?`, ko: `죄송하지만 ${eul(s.ko)} 뺄 수 없어요. 다른 음식을 고르시겠어요?`, s };
  };

  /* ---------- 계산서 — RS.bill(카드) · RS.split(계산서, 사람 수) ---------- */
  // 세금 · 봉사료는 나라마다 달라서 빼고 계산해요(지어낸 값). 함께 온 사람의 주 요리는 card.others
  RS.bill = function (c) {
    const items = [], add = (id, who, wrong) => { const m = RS.MENU[id]; if (m && m.p) items.push({ id, en: m.en, ko: m.ko, c: m.p, who, wrong }); };
    add(c.dish, 'me');
    (c.others || []).forEach((d, i) => add(d, 'p' + (i + 2)));
    if (c.water === 'sparkling') add('sparkling', 'table');
    if (c.drink && c.drink !== 'none') add(c.drink, 'me');
    if (c.dessert && c.dessert !== 'none') add(c.dessert, 'me');
    if (c.billErr && RS.MENU[c.billErr]) add(c.billErr, 'err', true);
    const total = items.reduce((s, x) => s + x.c, 0);
    return { items, total };
  };
  RS.split = function (bill, n) {
    const total = typeof bill === 'number' ? bill : bill.total;
    n = Math.max(1, n || 1);
    return { n, total, each: Math.floor(total / n), even: total % n === 0 };
  };
  RS.payAmount = c => { const B = RS.bill(c); return c.party > 1 && c.pay === 'separate' ? RS.split(B, c.party).each : B.total; };

  /* =========================================================
     말의 뜻(intent) — 질문의 모양과 기대하는 대답
     yn: Yes/No 질문에 그냥 Yes · No로만 답할 때 → { yes: 카드 → 카드가 바라는 Yes(true) · No(false) · 모름(null), need: 통과하지만 덧붙일 말, strict: 탈락 까닭 }
     key: 고르는 질문에서 고른 것을 담는 사실 이름
     ========================================================= */
  const I = (shape, ans, want, best, o = {}) => Object.assign({ shape, ans, want, best }, o);
  RS.INTENT = {
    resv: I('yn', '예약이 있는지 묻는 질문', '있으면 Yes, under + 이름. 없으면 No, we don\'t.', c => c.resv === false ? 'rs_no' : 'rs_under', { turn: '예약', yn: { yes: c => c.resv == null ? null : !!c.resv, need: '이름까지 말하면 서버가 다시 묻지 않아요 → Yes, under Park.' } }),
    name: I('wh', '예약한 이름을 묻는 질문', '이름 → It\'s Park. · Park.', 'nm_its', { turn: '이름' }),
    party: I('wh', '몇 명인지 묻는 질문', '수 + please → Two, please. · A table for two, please.', 'ps_n', { turn: '사람 수' }),
    wait: I('yn', '기다려도 괜찮은지 묻는 질문', '괜찮으면 That\'s fine. We\'ll wait. 헷갈리면 → Sorry, did you say fifteen minutes?', 'wt_ok', { turn: '기다리기', yn: { yes: () => true } }),
    seat: I('or', '안쪽 자리와 바깥 자리 가운데 고르라는 질문', '고른 것 + please → Outside, please.', 'st_pl', { turn: '자리', key: 'seat' }),
    water: I('or', '탄산 없는 물과 탄산수 가운데 고르라는 질문', '고른 것 + please → Still, please. · Sparkling, please.', 'wa_pl', { turn: '물', key: 'water' }),
    drink: I('yn', '더 마실 것을 권하는 질문', '원하는 것을 바로 → Could I get a lemonade, please? 없으면 No, just water is fine.', c => c.drink === 'none' ? 'dk_none' : 'dk_could', { turn: '음료', offer: true, yn: { yes: c => c.drink == null ? null : c.drink !== 'none', need: '무엇을 마실지까지 말하면 서버가 다시 묻지 않아요 → Could I get a lemonade, please?' } }),
    ready: I('yn', '주문할 준비가 됐는지 묻는 질문', '됐으면 Yes. I\'ll have the + 음식, please. 아직이면 Could we have a few more minutes?', c => c.ready === false ? 'rd_min' : 'line', { turn: '주문', yn: { yes: c => c.ready == null ? null : c.ready !== false, need: '무엇을 먹을지까지 말하면 한 번에 끝나요 → Yes. I\'ll have the + 음식, please.' } }),
    order: I('wh', '무엇을 먹을지 묻는 질문', 'I\'ll have the + 음식, please.', 'or_have0', { turn: '주문' }),
    cook: I('wh', '스테이크를 어떻게 구울지 묻는 질문', '굽기 + please → Medium, please.', 'cook_pl', { turn: '굽기' }),
    starter: I('or', '수프와 샐러드 가운데 고르라는 질문', '고른 것 + please → Salad, please.', 'sd_pl', { turn: '수프나 샐러드', key: 'starter' }),
    dressing: I('wh', '어떤 드레싱인지 묻는 질문', '드레싱 이름 + please → Italian, please.', 'dr_pl', { turn: '드레싱' }),
    spice: I('or', '순한 맛과 매운맛 가운데 고르라는 질문', '고른 것 + please → Mild, please. · Not too spicy, please.', 'spc_pl', { turn: '맵기', key: 'spice' }),
    allergy: I('yn', '음식 알레르기가 있는지 묻는 질문', '있으면 Yes, I\'m allergic to + 성분. 없으면 No, I don\'t.', c => c.allergy && c.allergy !== 'none' ? 'al_yes' : 'al_no', { turn: '알레르기', yn: { yes: c => c.allergy == null ? null : c.allergy !== 'none', strict: '무엇에 알레르기가 있는지 꼭 말해요. 안전과 관계있는 말이라 Yes.만으로는 모자라요 → Yes, I\'m allergic to peanuts.' } }),
    anyq: I('yn', '메뉴에 대해 물어볼 것이 있는지 묻는 질문', '있으면 Yes. Does the + 음식 + have + 성분 + in it?', c => c.ask ? 'aq_does' : 'aq_no', { turn: '물어볼 것', yn: { yes: c => c.ask == null ? null : !!c.ask, need: '무엇이 궁금한지 바로 물어요 → Does the house salad have nuts in it?' } }),
    safe: I('yn', '알레르기 성분을 빼고 만들어도 되는지 묻는 질문', '괜찮으면 Yes, please. Thank you.', 'sf_ok', { turn: '빼고 만들기', yn: { yes: () => true } }),
    dishcome: I('note', '음식을 가져다주며 하는 안내', '내가 시킨 것이면 Thank you. 아니면 Excuse me, this isn\'t what I ordered. I ordered the + 음식.', c => c.dishOk === false ? 'dc_not' : 'dc_ty', { turn: '음식 받기', say: '음식을 가져다주며 하는 안내예요. 내가 시킨 음식인지 확인해요' }),
    how: I('wh', '음식이 어떤지 묻는 질문', 'Great, thank you. · Everything is great, thanks.', 'hw_great', { turn: '맛 묻기' }),
    call: I('note', '다른 테이블에 하는 인사', 'Excuse me. + 부탁 → Excuse me. Could I get some more water, please?', 'cl_ex', { turn: '서버 부르기', say: '서버가 옆 테이블에 하는 인사예요. 서버가 가까이 있으니 이제 내가 먼저 부를 차례예요' }),
    need: I('wh', '무엇이 필요한지 묻는 질문', 'Could I get + 필요한 것, please?', 'rq_could', { turn: '필요한 것' }),
    more: I('yn', '더 필요한 것이 있는지 묻는 질문', '있으면 Could I get + 필요한 것? 없으면 No, that\'s all. Thank you.', c => c.need2 ? 'rq_could' : 'mr_no', { turn: '더 필요한 것', yn: { yes: c => c.need2 === undefined ? null : !!c.need2, need: '무엇이 필요한지까지 말해요 → Could I get an extra plate, please?' } }),
    done: I('yn', '아직 먹고 있는지 묻는 질문', '다 먹었으면 No, I\'m done. 남은 음식을 싸 가려면 Could I get a box for this?', c => c.box ? 'dn_box' : 'dn_fin', { turn: '다 먹었나', say: 'Are you still working on that? → 아직 드시는 중인지 묻는 Yes/No 질문이에요', yn: { yes: () => false } }),
    dessert: I('yn', '디저트를 권하는 질문', '원하면 Could I get the + 디저트? 아니면 No, thanks. Just the check, please.', c => c.dessert && c.dessert !== 'none' ? 'ds_could' : 'ds_no', { turn: '디저트', offer: true, yn: { yes: c => c.dessert == null ? null : c.dessert !== 'none', need: '무엇을 먹을지까지 말하면 서버가 다시 묻지 않아요 → Could I get the chocolate cake, please?' } }),
    checkreq: I('yn', '더 필요한 것이 있는지 묻는 질문(계산할 때)', 'Just the check, please. · Could we get the check, please?', 'cr_could', { turn: '계산 부탁', yn: { yes: () => null, need: '계산서를 바란다고 분명하게 말해요 → Just the check, please.' } }),
    split: I('or', '함께 낼지 나눠 낼지 고르라는 질문', '고른 것 + please → Separate, please. · Together, please. 똑같이 나누려면 → Could you split it evenly, please?', 'sp_pl', { turn: '나눠 내기', key: 'pay' }),
    even: I('yn', '똑같이 나눠 드릴지 묻는 질문', '똑같이 나누려면 Yes, please. 각자 먹은 것만 내려면 No, separate checks, please.', 'g_yesp', { turn: '똑같이 나누기', yn: { yes: c => c.pay == null ? null : c.pay === 'separate' } }),
    pay: I('or', '카드와 현금 가운데 고르라는 질문', '고른 것 + please → Card, please.', 'pm_pl', { turn: '내는 방법', key: 'paym' }),
    repair: I(null, '다시 묻는 말', '', 'rp_again'),
  };
  RS.sayOf = intent => { const it = RS.INTENT[intent]; return it.say || RS.SHAPE[it.shape].say; };
  RS.INTENT_KO = {}; Object.entries(RS.INTENT).forEach(([k, v]) => { RS.INTENT_KO[k] = v.turn || ''; });
  // 한 번만 나오는 뜻 — 다른 곳에서 미리 답했어도 시뮬레이터의 서버가 건너뜀 (한 줄 주문의 알레르기 · 디저트를 거절하며 한 계산 부탁)
  RS.CROSS = { allergy: 1, safe: 1, checkreq: 1 };

  /* =========================================================
     서버의 말. key: 열쇠 낱말(말 안에 꼭 있어야 함) · shape: 질문의 모양 · choices: 고르는 질문에서 고를 것
     fast: 너무 빨라 못 알아들은 말 · short: 지도에 쓰는 짧은 꼴 · fact: 그 말이 알려 준 사실(기다리는 분 · 값) · allow: 대답 대신 해도 되는 다시 묻기
     ========================================================= */
  RS.Q = {};
  const Q = (id, place, intent, en, ko, key, o = {}) => (RS.Q[id] = Object.assign({ id, place, intent, en, ko, key, shape: RS.INTENT[intent].shape, sp: RS.PLACE[place].sp }, o));
  // 입구 · 자리 안내 (호스트)
  Q('d_resv', 'door', 'resv', 'Hi, welcome to Juniper Table! Do you have a reservation?', '안녕하세요, 주니퍼 테이블입니다! 예약하셨어요?', ['reservation'], { short: 'Do you have a reservation?' });
  Q('d_name', 'door', 'name', 'Great. Under what name?', '네. 어느 분 이름으로 하셨어요?', ['what name'], { short: 'Under what name?' });
  Q('d_many', 'door', 'party', 'No problem. How many are in your party?', '괜찮아요. 몇 분이세요?', ['How many'], { short: 'How many?' });
  Q('d_wait', 'door', 'wait', 'It\'ll be about a fifteen-minute wait. Is that okay?', '15분쯤 기다리셔야 해요. 괜찮으세요?', ['minute wait'], { fact: { wait: 15 }, short: 'About a fifteen-minute wait' });
  Q('d_fast', 'door', 'wait', 'It\'s gonna be about a fifteen-minute wait, that okay with you guys?', '15분쯤 기다리셔야 하는데, 괜찮으세요?', ['minute wait'], { fact: { wait: 15 }, fast: true });
  Q('d_seat', 'door', 'seat', 'Would you like to sit inside or outside?', '안쪽에 앉으시겠어요, 바깥에 앉으시겠어요?', ['inside or outside'], { choices: ['inside', 'outside'], short: 'Inside or outside?' });
  // 자리 · 음료 (서버)
  Q('dk_water', 'drinks', 'water', 'Hi, I\'m Sam. I\'ll be your server tonight. Still or sparkling water?', '안녕하세요, 오늘 담당 서버 샘이에요. 그냥 물 드릴까요, 탄산수 드릴까요?', ['Still or sparkling'], { choices: ['still', 'sparkling'], allow: ['what'], short: 'Still or sparkling?' });
  Q('dk_gb', 'drinks', 'water', 'Would you like still or sparkling water?', '그냥 물 드릴까요, 탄산수 드릴까요?', ['still or sparkling'], { choices: ['still', 'sparkling'], sp: 'gb', allow: ['what'] });
  Q('dk_more', 'drinks', 'drink', 'Great. And can I get you something else to drink?', '네. 그리고 다른 마실 것도 드릴까요?', ['something else to drink'], { short: 'Something else to drink?' });
  Q('dk_offer', 'drinks', 'drink', 'Can I get you something to drink?', '마실 것 드릴까요?', ['something to drink']);
  // 주문
  Q('or_ready', 'order', 'ready', 'Are you ready to order?', '주문하시겠어요?', ['ready to order'], { short: 'Are you ready to order?' });
  Q('or_what', 'order', 'order', 'What can I get for you tonight?', '오늘 무엇으로 드릴까요?', ['What can I get']);
  Q('or_cook', 'order', 'cook', 'How would you like your steak cooked?', '스테이크는 어떻게 구워 드릴까요?', ['How would you like'], { short: 'How would you like your steak?' });
  Q('or_side', 'order', 'starter', 'And would you like soup or salad with that?', '그리고 수프나 샐러드 가운데 무엇으로 드릴까요?', ['soup or salad'], { choices: ['soup', 'salad'], short: 'Soup or salad?' });
  Q('or_dress', 'order', 'dressing', 'Which dressing would you like?', '드레싱은 어떤 걸로 드릴까요?', ['Which dressing'], { short: 'Which dressing?' });
  Q('or_spice', 'order', 'spice', 'Would you like it mild or spicy?', '순한 맛으로 드릴까요, 매운맛으로 드릴까요?', ['mild or spicy'], { choices: ['mild', 'spicy'], short: 'Mild or spicy?' });
  // 알레르기 · 요청
  Q('al_any', 'allergy', 'allergy', 'Do you have any food allergies?', '음식 알레르기가 있으세요?', ['allergies'], { short: 'Any food allergies?' });
  Q('al_qs', 'allergy', 'anyq', 'Do you have any questions about the menu?', '메뉴에 대해 궁금한 것 있으세요?', ['questions about the menu']);
  Q('al_safe', 'allergy', 'safe', 'Thanks for letting me know. The house salad comes with walnuts, but we can make it without them. Is that okay?', '알려 주셔서 고마워요. 하우스 샐러드에 호두를 넣지만, 빼고 만들 수 있어요. 괜찮으세요?', ['without them'], { short: 'We can make it without them.' });
  // 식사 중
  Q('ml_dish', 'meal', 'dishcome', 'Here\'s your grilled salmon. Enjoy!', '구운 연어 나왔습니다. 맛있게 드세요!', ['Here\'s your'], { sp: 'ca', fact: { served: 'salmon' } });
  Q('ml_how', 'meal', 'how', 'How is everything?', '음식은 괜찮으세요?', ['How is everything'], { short: 'How is everything?' });
  Q('ml_pass', 'meal', 'call', 'Enjoy your meal!', '맛있게 드세요!', ['Enjoy your meal'], { short: '(옆 테이블에) Enjoy your meal!' });
  Q('ml_what', 'meal', 'need', 'Yes? How can I help?', '네? 무엇을 도와드릴까요?', ['How can I help']);
  Q('ml_more', 'meal', 'more', 'Sure. Anything else?', '네. 더 필요한 것 있으세요?', ['Anything else']);
  // 디저트 · 포장
  Q('ds_done', 'dessert', 'done', 'Are you still working on that?', '아직 드시는 중이세요?', ['still working on'], { short: 'Are you still working on that?' });
  Q('ds_fast', 'dessert', 'done', 'You still working on that one?', '아직 드시는 중이세요?', ['still working on'], { fast: true });
  Q('ds_offer', 'dessert', 'dessert', 'Can I interest you in some dessert?', '디저트 좀 드시겠어요?', ['dessert'], { short: 'Some dessert?' });
  // 계산
  Q('ck_else', 'check', 'checkreq', 'Can I get you anything else?', '더 필요한 것 있으세요?', ['anything else'], { short: 'Anything else?' });
  Q('ck_split', 'check', 'split', 'Will this be together or separate?', '함께 계산하실까요, 따로 계산하실까요?', ['together or separate'], { choices: ['together', 'separate'], short: 'Together or separate?' });
  Q('ck_even', 'check', 'even', 'Would you like me to split it evenly?', '똑같이 나눠 드릴까요?', ['split it evenly'], { short: 'Split it evenly?' });
  Q('ck_pay', 'check', 'pay', 'Here\'s your check. That\'s $28.50 each. Card or cash?', '계산서 여기 있어요. 한 분에 28달러 50센트예요. 카드로 하시겠어요, 현금으로 하시겠어요?', ['Card or cash'], { choices: ['card', 'cash'], fact: { amount: 2850 }, short: 'Card or cash?' });
  // 곳마다 대표 말 (영상 01장 지도 · 직접 해 보기)
  RS.ROUTE = {
    door: ['d_resv', 'd_seat'], drinks: ['dk_water', 'dk_more'], order: ['or_ready', 'or_cook'], allergy: ['al_any', 'al_qs'],
    meal: ['ml_how', 'ml_pass'], dessert: ['ds_done', 'ds_offer'], check: ['ck_split', 'ck_pay'],
  };

  /* =========================================================
     칸에 넣는 내 정보 (slot). 틀(frame)이 form으로 어느 꼴을 쓸지 정해요.
     fact: 이 값이 말하는 사실 · bad · why: 콩글리시 값(② 탈락) · note: 통하지만 덧붙일 말 · dyn: 값이 정해져 있지 않은 칸(분 · 값)
     ========================================================= */
  RS.NAMES = { Park: '박', Kim: '김', Lee: '이', Choi: '최', Han: '한', Yoon: '윤' };
  RS.FIRST = { Haneul: '하늘', Minseo: '민서', Jiwoo: '지우', Seojun: '서준', Yuna: '유나', Doha: '도하' };
  const nameVals = {}; Object.entries(RS.NAMES).forEach(([k, v]) => { nameVals[k] = { t: k, ko: `${v}(${k})` }; });
  const PARTY_W = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' };
  const partyVals = {};
  [1, 2, 3, 4, 5].forEach(n => { const w = PARTY_W[n]; partyVals['p' + n] = { t: n === 1 ? 'Just one' : w[0].toUpperCase() + w.slice(1), low: w, person: `${w[0].toUpperCase() + w.slice(1)} person`, ko: `${n}명`, fact: { party: n } }; });
  const dishVal = id => ({ t: RS.MENU[id].en.toLowerCase(), short: 'The ' + RS.MENU[id].en.toLowerCase(), ko: RS.MENU[id].ko, fact: { dish: id } });
  RS.SLOT = {
    name: { key: 'name', vals: nameVals },
    party: { key: 'party', vals: partyVals },
    mins: { key: 'wait', dyn: 'mins' },
    money: { key: 'amount', dyn: 'money' },
    seat: { key: 'seat', vals: { inside: { t: 'Inside', ko: '안쪽 자리' }, outside: { t: 'Outside', ko: '바깥 자리' } } },
    water: { key: 'water', vals: {
      still: { t: 'Still', ko: '그냥 물(탄산 없음)' }, sparkling: { t: 'Sparkling', ko: '탄산수' },
      tap: { t: 'Just tap water', ko: '수돗물', fact: { water: 'still' }, note: 'tap water = 수돗물. 탄산이 없으니 still 쪽이에요. 무료인 곳이 많지만 나라 · 식당마다 달라요.' },
    } },
    drink: { key: 'drink', vals: {
      lemonade: { t: 'a lemonade', short: 'A lemonade', bare: 'lemonade', ko: '레모네이드' },
      soda: { t: 'a lemon-lime soda', short: 'A lemon-lime soda', bare: 'soda', ko: '레몬 라임 탄산음료(사이다)' },
      icedtea: { t: 'an iced tea', short: 'An iced tea', bare: 'iced tea', ko: '아이스티' },
      cider: { t: 'a cider', short: 'A cider', bare: 'cider', ko: '사이다', fact: { drink: 'soda' }, bad: 'literal', why: '영어로 cider는 사과로 만든 음료예요. 영국에서는 보통 술이에요. 한국의 사이다 → a lemon-lime soda (브랜드 이름으로 말하는 사람도 많아요).' },
    } },
    dish: { key: 'dish', vals: Object.fromEntries(['steak', 'salmon', 'noodles', 'pasta', 'burger', 'risotto'].map(id => [id, dishVal(id)])) },
    cook: { key: 'cook', vals: {
      rare: { t: 'Rare', low: 'rare', ko: '레어' }, mediumrare: { t: 'Medium-rare', low: 'medium-rare', ko: '미디엄 레어' }, medium: { t: 'Medium', low: 'medium', ko: '미디엄' },
      mediumwell: { t: 'Medium-well', low: 'medium-well', ko: '미디엄 웰' }, welldone: { t: 'Well-done', low: 'well-done', ko: '웰던' },
      middle: { t: 'Middle', low: 'middle', ko: '중간', fact: { cook: 'medium' }, bad: 'literal', why: '‘중간으로 구워 주세요’를 낱말 그대로 옮기면 middle이 돼요. 굽기를 말하는 낱말이 아니라 알아듣기 어려워요 → Medium, please.' },
    } },
    starter: { key: 'starter', vals: { soup: { t: 'Soup', low: 'the soup', ko: '수프' }, salad: { t: 'Salad', low: 'a salad', ko: '샐러드' }, fries: { t: 'Fries', low: 'fries', ko: '감자튀김' } } },
    dressing: { key: 'dressing', vals: { ranch: { t: 'Ranch', ko: '랜치' }, italian: { t: 'Italian', ko: '이탈리안' }, balsamic: { t: 'Balsamic', ko: '발사믹' } } },
    spice: { key: 'spice', vals: { mild: { t: 'Mild', ko: '순한 맛' }, spicy: { t: 'Spicy', ko: '매운맛' } } },
    allergen: { key: 'allergy', vals: Object.fromEntries(Object.entries(RS.ALLERGENS).map(([k, a]) => [k, { t: a.en, adj: a.adj, bare: a.adj === 'nut' ? 'nut' : a.adj, ko: a.ko }])) },
    ask: { key: 'ask', vals: {
      'salad:nuts': { t: 'house salad have nuts', ko: '하우스 샐러드에 견과류', fact: { ask: 'salad:nuts' } },
      'burger:milk': { t: 'veggie burger have cheese', ko: '채소 버거에 치즈', fact: { ask: 'burger:milk' } },
      'soup:milk': { t: 'tomato soup have cream', ko: '토마토 수프에 크림', fact: { ask: 'soup:milk' } },
      'salmon:nuts': { t: 'grilled salmon have nuts', ko: '구운 연어에 견과류', fact: { ask: 'salmon:nuts' } },
    } },
    need: { key: 'need', vals: {
      water: { t: 'some more water', bare: 'water', ko: '물 더' }, plate: { t: 'an extra plate', bare: 'plate', ko: '앞접시 하나 더' },
      napkins: { t: 'some more napkins', bare: 'napkin', ko: '냅킨 더' }, fork: { t: 'a new fork', bare: 'fork', ko: '새 포크' },
    } },
    dessert: { key: 'dessert', vals: { cake: { t: 'the chocolate cake', short: 'The chocolate cake', bare: 'chocolate cake', ko: '초콜릿 케이크' }, sorbet: { t: 'the fruit sorbet', short: 'The fruit sorbet', bare: 'fruit sorbet', ko: '과일 셔벗' } } },
    pay: { key: 'pay', vals: { together: { t: 'Together', ko: '함께 계산' }, separate: { t: 'Separate', ko: '따로 계산' } } },
    paym: { key: 'paym', vals: { card: { t: 'Card', ko: '카드' }, cash: { t: 'Cash', ko: '현금' } } },
  };
  // 칸 값 하나 (값이 정해져 있지 않은 칸도)
  RS.sv = function (slot, v) {
    const S = RS.SLOT[slot]; if (!S || v == null) return null;
    if (S.dyn === 'mins') return /^\d{1,3}$/.test(String(v)) ? { t: numWord(+v), ko: `${v}분`, fact: { wait: +v } } : null;
    if (S.dyn === 'money') return /^\d+$/.test(String(v)) ? { t: RS.money(+v), ko: RS.priceKo(+v), fact: { amount: +v } } : null;
    return S.vals[v] || null;
  };
  const valFact = (slot, v) => { const x = RS.sv(slot, v); if (!x) return {}; return x.fact ? Object.assign({}, x.fact) : { [RS.SLOT[slot].key]: v }; };
  RS.valFact = valFact;
  // 카드와 맞는 칸 값 (콩글리시 · 알림이 붙는 값은 빼고)
  const slotIds = slot => { const S = RS.SLOT[slot]; return S.dyn ? [] : Object.keys(S.vals).filter(id => { const x = S.vals[id]; return !x.bad && !x.note; }); };
  RS.slotIds = slotIds;
  RS.slotVal = function (slot, C) {
    const S = RS.SLOT[slot];
    if (S.dyn) { const v = C[S.key]; return v != null && RS.sv(slot, v) ? String(v) : null; }
    if (slot === 'need') return C.need || null;
    return slotIds(slot).find(id => { const f = valFact(slot, id); return Object.keys(f).length && Object.keys(f).every(k => C[k] === f[k]); }) || null;
  };

  /* =========================================================
     한 줄 주문 — 조각과 순서: (I'll have the) 음식 → 굽기 · 맵기 → with 곁들임 → 드레싱 → without ___ → please
     알레르기 문장(I'm allergic to ___.)은 맨 앞이나 맨 끝. (자주 쓰는 순서를 단순하게 줄인 규칙)
     줄 = { words: [조각 id, …] }
     ========================================================= */
  RS.OW = {
    have: { c: 'open', t: 'I\'ll have the' }, could: { c: 'open', t: 'Could I get the' }, want: { c: 'open', t: 'I want the', blunt: true }, give: { c: 'open', t: 'Give me the', blunt: true },
    please: { c: 'please', t: 'please' },
  };
  ['steak', 'salmon', 'noodles', 'pasta', 'burger', 'risotto'].forEach(id => { RS.OW[id] = { c: 'dish', t: RS.MENU[id].en.toLowerCase(), fact: { dish: id } }; });
  RS.OW.special = { c: 'dish', t: 'special', fact: { dish: 'risotto' }, special: true };
  ['rare', 'mediumrare', 'medium', 'mediumwell', 'welldone'].forEach(id => { RS.OW[id] = { c: 'how', t: RS.SLOT.cook.vals[id].low, fact: { cook: id }, for: 'steak' }; });
  RS.OW.mild = { c: 'how', t: 'mild', fact: { spice: 'mild' }, for: 'noodles' }; RS.OW.spicy = { c: 'how', t: 'spicy', fact: { spice: 'spicy' }, for: 'noodles' };
  RS.OW.soup = { c: 'with', t: 'the soup', fact: { starter: 'soup' } }; RS.OW.salad = { c: 'with', t: 'a salad', fact: { starter: 'salad' } };
  ['ranch', 'italian', 'balsamic'].forEach(id => { RS.OW[id] = { c: 'dress', t: RS.MENU[id].en.replace('Ranch', 'ranch'), fact: { dressing: id } }; });
  RS.OW.nowalnuts = { c: 'without', t: 'the walnuts', fact: { without: 'nuts' }, from: 'salad' };
  RS.OW.nocheese = { c: 'without', t: 'the cheese', fact: { without: 'milk' }, from: 'burger' };
  RS.OW.noshrimp = { c: 'without', t: 'the shrimp', fact: { without: 'shrimp' }, from: 'noodles' };
  Object.keys(RS.ALLERGENS).forEach(k => { RS.OW['a_' + k] = { c: 'allergy', t: `I'm allergic to ${RS.ALLERGENS[k].en}`, fact: { allergy: k } }; });
  RS.OCAT = { open: { ko: '주문 틀', n: 1 }, dish: { ko: '음식', n: 2 }, how: { ko: '굽기 · 맵기', n: 3 }, with: { ko: 'with 곁들임', n: 4 }, dress: { ko: '드레싱', n: 5 }, without: { ko: 'without', n: 6 }, please: { ko: 'please', n: 7 }, allergy: { ko: '알레르기', n: 8 } };
  RS.orderLine = function (L) {
    const ws = L.words || L, W = ws.map(w => RS.OW[w]);
    if (W.some(x => !x)) return { ok: false, stage: 2, why: '사전에 없는 조각이 있어요.' };
    const at = c => W.map((x, i) => (x.c === c ? i : -1)).filter(i => i >= 0), n = c => at(c).length;
    for (const c of Object.keys(RS.OCAT)) if (n(c) > 1) return { ok: false, stage: 2, why: `${eun(RS.OCAT[c].ko)} 한 번만 말해요.` };
    if (!n('dish')) return { ok: false, stage: 1, why: n('open') ? '주문 틀만 있고 무엇을 먹을지(음식)가 빠졌어요.' : '음식 이름이 빠졌어요. 무엇을 먹을지부터 말해요.' };
    const dish = W[at('dish')[0]].fact.dish, how = n('how') ? W[at('how')[0]] : null, wo = n('without') ? W[at('without')[0]] : null;
    if (how && how.for !== dish) return { ok: false, stage: 2, why: how.for === 'steak' ? '굽기(rare · medium …)는 스테이크에만 말해요.' : '맵기(mild · spicy)는 땅콩 소스 국수에만 물어요.' };
    if (n('with') && !RS.hasStarter(dish)) return { ok: false, stage: 2, why: `${RS.MENU[dish].en}에는 수프나 샐러드가 딸려 나오지 않아요(메뉴판 참고).` };
    if (n('dress') && !(n('with') && W[at('with')[0]].fact.starter === 'salad')) return { ok: false, stage: 2, why: '드레싱은 샐러드에 붙여요. with a salad 뒤에 말해요.' };
    if (wo && !(wo.from === dish || (wo.from === 'salad' && n('with') && W[at('with')[0]].fact.starter === 'salad'))) return { ok: false, stage: 2, why: `주문한 음식에는 ${wo.t}${wo.t.endsWith('s') ? '가' : '이'} 들어 있지 않아요.` };
    const want = ws.slice().sort((a, b) => RS.OCAT[RS.OW[a].c].n - RS.OCAT[RS.OW[b].c].n);
    const core = W.map((x, i) => [x, i]).filter(([x]) => x.c !== 'allergy');
    if (n('allergy')) { const p = at('allergy')[0]; if (p !== 0 && p !== ws.length - 1) return { ok: false, stage: 2, why: `순서가 어색해요. 알레르기 문장 → 주문의 맨 앞이나 맨 끝에 따로 말해요. 자연스러운 순서 → ${RS.lineText({ words: want })}`, want }; }
    for (let k = 1; k < core.length; k++) {
      const p = core[k - 1][0], q = core[k][0];
      if (RS.OCAT[q.c].n < RS.OCAT[p.c].n) {
        const why = p.c === 'please' ? 'please → 주문의 끝에 와요.' : q.c === 'open' ? '주문 틀(I\'ll have the) → 맨 앞에 와요.' : q.c === 'dish' ? '음식 이름 → 주문 틀 바로 뒤에 와요.' : `${RS.OCAT[q.c].ko}(${q.t}) → ${RS.OCAT[p.c].ko}(${p.t})보다 앞이에요.`;
        return { ok: false, stage: 2, why: `순서가 뒤섞여 알아듣기 어려워요. ${why} 자연스러운 순서 → ${RS.lineText({ words: want })}`, want };
      }
    }
    const parts = W.map(x => RS.OCAT[x.c].ko).filter((k, i, a) => a.indexOf(k) === i).join(' → ');
    return { ok: true, why: `순서 → ${parts}. 자연스러워요.`, want };
  };
  RS.lineFacts = L => { const f = {}; (L.words || L).forEach(w => { const x = RS.OW[w]; if (x && x.fact) Object.assign(f, x.fact); }); if (f.dish) f.ready = true; return f; };
  function lineSegs(L) {
    const ws = L.words || L, out = [];
    let start = true, inOrder = false, lastC = null, q = false;
    const capF = t => (start ? t[0].toUpperCase() + t.slice(1) : t);
    const push = (t, r, part) => { out.push({ t: capF(t), r, part }); start = false; };
    const end = () => { if (inOrder) { out.push({ t: q ? '?' : '.', r: 'frame' }); inOrder = false; start = true; q = false; } };
    ws.forEach(w => {
      const x = RS.OW[w]; if (!x) return;
      if (x.c === 'allergy') { end(); if (out.length) out.push({ t: ' ', r: 'frame' }); push(x.t.replace(/^I'm allergic to /, 'I\'m allergic to '), 'frame', 'allergy'); const a = out[out.length - 1]; const m = a.t.match(/^(I'm allergic to )(.*)$/); if (m) { a.t = m[1]; out.push({ t: m[2], r: 'slot', part: 'allergy' }); } out.push({ t: '.', r: 'frame' }); start = true; lastC = 'allergy'; return; }
      if (!inOrder && out.length) out.push({ t: ' ', r: 'frame' });
      inOrder = true;
      if (x.c === 'open') {
        if (lastC && lastC !== 'allergy') out.push({ t: ' ', r: 'frame' });
        if (w === 'have') { push('I\'ll have', 'frame', 'open'); out.push({ t: ' the ', r: 'frame', part: 'open' }); }
        else if (w === 'could') { push('Could I', 'pol', 'open'); out.push({ t: ' get the ', r: 'frame', part: 'open' }); q = true; }
        else { push(x.t.replace(/ the$/, ''), 'frame', 'open'); out.push({ t: ' the ', r: 'frame', part: 'open' }); }
      } else if (x.c === 'dish') { if (lastC && lastC !== 'open' && lastC !== 'allergy') out.push({ t: ', ', r: 'frame' }); push(lastC === 'open' ? x.t : (start ? 'the ' : '') + x.t, 'slot', 'dish'); }
      else if (x.c === 'how') { out.push({ t: lastC ? ', ' : '', r: 'frame' }); push(x.t, 'slot', 'how'); }
      else if (x.c === 'with') { out.push({ t: lastC === 'how' ? ', with ' : lastC ? ' with ' : 'with ', r: 'frame' }); start = false; push(x.t, 'slot', 'with'); }
      else if (x.c === 'dress') { out.push({ t: lastC === 'with' ? ' and ' : lastC ? ', ' : '', r: 'frame' }); push(x.t, 'slot', 'dress'); }
      else if (x.c === 'without') { out.push({ t: lastC ? ', without ' : 'without ', r: 'frame' }); start = false; push(x.t, 'slot', 'without'); }
      else if (x.c === 'please') { if (lastC && lastC !== 'allergy') { out.push({ t: ', ', r: 'frame' }); out.push({ t: 'please', r: 'pol', part: 'please' }); start = false; } else push('please', 'pol', 'please'); }
      lastC = x.c;
    });
    end();
    return out.filter(s => s.t !== '');
  }
  RS.lineText = L => lineSegs(L).map(s => s.t).join('');
  RS.lineHasBlunt = L => (L.words || L).some(w => RS.OW[w] && RS.OW[w].blunt);

  /* =========================================================
     대답 틀 (frame). t: 틀 글 — ___ = 내 정보 칸, {…} = 공손한 말
     tag: ok · literal(한국어 그대로 · 콩글리시) · wrong(틀린 문장) · blunt(명령 · 조르기 · 따지기 · 큰 소리로 부르기) · plain(그냥 No.로 끊김)
     bare: Yes · No만 하는 대답(yes: true · false) · check: 들은 숫자를 되물어 확인하는 말 · reqOk: 뒤에 부탁을 붙일 수 있음 · note: 통하지만 덧붙일 말
     ========================================================= */
  RS.FRAME = {};
  const FR = (id, intent, t, ko, o = {}) => (RS.FRAME[id] = Object.assign({ id, intent, t, ko, tag: 'ok' }, o));
  // Yes · No만 하는 대답 (고르는 질문 · 정보 질문에는 ① 탈락)
  FR('g_yes', 'yn', 'Yes.', '네.', { bare: true, yes: true });
  FR('g_yesp', 'yn', 'Yes, {please}.', '네, 주세요.', { bare: true, yes: true });
  FR('g_no', 'yn', 'No, {thanks}.', '아니요, 괜찮아요.', { bare: true, yes: false });
  // 입구
  FR('rs_under', 'resv', 'Yes, under ___.', '네, ___(으)로 했어요.', { slot: 'name', fact: { resv: true } });
  FR('rs_have', 'resv', 'Yes, we have a reservation under ___.', '네, ___(으)로 예약했어요.', { slot: 'name', fact: { resv: true } });
  FR('rs_no', 'resv', 'No, we don\'t.', '아니요, 안 했어요.', { fact: { resv: false } });
  FR('nm_its', 'name', 'It\'s ___.', '___(이)에요.', { slot: 'name' });
  FR('ps_n', 'party', '___, {please}.', '___이요.', { slot: 'party' });
  FR('ps_table', 'party', 'A table for ___, {please}.', '___ 자리 주세요.', { slot: 'party', form: 'low' });
  FR('ps_we', 'party', 'We are ___.', '우리는 ___이에요.', { slot: 'party', form: 'low', note: '‘우리는 둘이에요’를 낱말 그대로 옮긴 말이에요. 알아듣지만 보통은 → Two, please. · A table for two, please.' });
  FR('ps_person', 'party', '___.', '___이요.', { slot: 'party', form: 'person', note: '둘 이상이면 person → people(two people)이에요. 알아듣지만 짧게 → Two, please.' });
  FR('wt_ok', 'wait', 'That\'s fine. We\'ll wait.', '괜찮아요. 기다릴게요.', { fact: { waitOk: true } });
  FR('wt_check', 'wait', '{Sorry}, did you say ___ minutes?', '죄송한데, ___분이라고 하셨어요?', { slot: 'mins', check: true });
  FR('wt_long', 'wait', 'Too long. Hurry up.', '(명령) 너무 길어요. 서둘러요.', { fact: { waitOk: false }, tag: 'blunt', why: '‘너무 오래 걸려요, 빨리 해 주세요’를 그대로 옮기면 재촉하는 명령처럼 들려요. 괜찮으면 → That\'s fine. We\'ll wait. 기다리기 어려우면 → That\'s a bit long for us. Thank you anyway.' });
  FR('st_pl', 'seat', '___, {please}.', '___(으)로 주세요.', { slot: 'seat' });
  // 음료
  FR('wa_pl', 'water', '___, {please}.', '___(으)로 주세요.', { slot: 'water' });
  FR('wa_yes', 'water', 'Yes, ___, {please}.', '네, ___(으)로 주세요.', { slot: 'water', note: '고르는 질문에는 Yes 없이 고른 것만 말해도 돼요 → Sparkling, please.' });
  FR('dk_could', 'drink', '{Could I} get ___, {please}?', '___ 주시겠어요?', { slot: 'drink' });
  FR('dk_short', 'drink', '___, {please}.', '___ 주세요.', { slot: 'drink', form: 'short' });
  FR('dk_yes', 'drink', 'Yes, ___, {please}.', '네, ___ 주세요.', { slot: 'drink' });
  FR('dk_just', 'drink', 'Just water, {please}.', '물이면 돼요.', { fact: { drink: 'none' } });
  FR('dk_none', 'drink', 'No, just water is fine. {Thanks}.', '아니요, 물이면 돼요. 고마워요.', { fact: { drink: 'none' } });
  FR('dk_plain', 'drink', 'No.', '아니요.', { fact: { drink: 'none' }, tag: 'plain', why: '그냥 No.라고 끊으면 무뚝뚝하게 들릴 수 있어요. 권하는 말을 거절할 때는 → No, just water is fine. Thanks.' });
  FR('dk_give', 'drink', 'Give me ___.', '(명령) ___ 줘요.', { slot: 'drink', form: 'bare', tag: 'blunt', why: '‘사이다 주세요’를 낱말 그대로 옮긴 Give me는 명령처럼 들려요. 물건 앞의 a도 빠지기 쉬워요. → Could I get a lemon-lime soda, please?' });
  // 주문
  FR('or_have', ['ready', 'order'], 'Yes. I\'ll have the ___, {please}.', '네. ___(으)로 할게요.', { slot: 'dish', fact: { ready: true } });
  FR('or_have0', ['ready', 'order'], 'I\'ll have the ___, {please}.', '___(으)로 할게요.', { slot: 'dish', fact: { ready: true } });
  FR('or_could', ['ready', 'order'], '{Could I} get the ___, {please}?', '___ 주시겠어요?', { slot: 'dish', fact: { ready: true } });
  FR('or_give', ['ready', 'order'], 'Give me the ___.', '(명령) ___ 줘요.', { slot: 'dish', fact: { ready: true }, tag: 'blunt', why: 'Give me로 시작하면 명령처럼 들려요. 주문은 → I\'ll have the …, please. · Could I get the …, please?' });
  FR('or_want', ['ready', 'order'], 'I want ___.', '(조르는 말) ___ 원해요.', { slot: 'dish', fact: { ready: true }, tag: 'blunt', why: 'I want는 원한다는 사실만 말해서 조르는 말처럼 들려요. 메뉴 이름 앞의 the도 빠졌어요 → I\'ll have the steak, please.' });
  FR('rd_min', 'ready', '{Could we} have a few more minutes, {please}?', '조금만 더 시간을 주시겠어요?', { fact: { ready: false } });
  FR('rd_wait', 'ready', 'Wait.', '(명령) 기다려요.', { fact: { ready: false }, tag: 'blunt', why: '‘잠깐만요’를 Wait. 한 낱말로 하면 명령처럼 들려요. → Could we have a few more minutes, please?' });
  FR('mn_could', 'ready', '{Could I} see the menu, {please}?', '메뉴판 좀 볼 수 있을까요?', { fact: { ready: false } });
  FR('mn_give', 'ready', 'Give me the menu.', '(명령) 메뉴판 줘요.', { fact: { ready: false }, tag: 'blunt', why: '‘메뉴판 주세요’를 그대로 옮긴 Give me는 명령처럼 들려요. → Could I see the menu, please?' });
  FR('line', ['ready', 'order'], '', '', { line: true });   // 한 줄 주문 (RS.orderLine)
  FR('cook_pl', 'cook', '___, {please}.', '___(으)로 해 주세요.', { slot: 'cook' });
  FR('sd_pl', 'starter', '___, {please}.', '___(으)로 주세요.', { slot: 'starter' });
  FR('dr_pl', 'dressing', '___, {please}.', '___(으)로 주세요.', { slot: 'dressing' });
  FR('dr_side', 'dressing', '___ on the side, {please}.', '___, 따로 주세요.', { slot: 'dressing', note: 'on the side → 드레싱을 뿌리지 않고 작은 그릇에 따로 달라는 말이에요.' });
  FR('spc_pl', 'spice', '___, {please}.', '___(으)로 주세요.', { slot: 'spice' });
  FR('spc_not', 'spice', 'Not too spicy, {please}.', '너무 맵지 않게 해 주세요.', { fact: { spice: 'mild' }, note: 'Not too spicy → 너무 맵지 않게. 고르는 질문에는 고른 것만 말해도 돼요 → Mild, please.' });
  // 알레르기 · 요청
  FR('al_yes', 'allergy', 'Yes, I\'m allergic to ___.', '네, ___ 알레르기가 있어요.', { slot: 'allergen' });
  FR('al_have', 'allergy', 'Yes, I have a ___ allergy.', '네, ___ 알레르기가 있어요.', { slot: 'allergen', form: 'adj' });
  FR('al_lit', 'allergy', 'I have ___.', '(어색한 말) ___ 있어요.', { slot: 'allergen', form: 'bare', tag: 'literal', why: '‘땅콩 (알레르기) 있어요’를 그대로 옮기면 I have peanut. → 땅콩을 갖고 있다는 뜻이 돼요. 알레르기는 → I\'m allergic to peanuts. · I have a peanut allergy.' });
  FR('al_no', 'allergy', 'No, I don\'t.', '아니요, 없어요.', { fact: { allergy: 'none' } });
  FR('aq_does', 'anyq', 'Yes. Does the ___ in it?', '네. ___ 들어 있나요?', { slot: 'ask' });
  FR('aq_lit', 'anyq', 'Yes. Is the ___ in it?', '(틀린 말) 네. ___ 들어 있어요?', { slot: 'ask', tag: 'wrong', why: 'Is와 have를 함께 쓰면 틀린 문장이 돼요. have가 들어간 질문은 Does로 → Does the house salad have nuts in it?' });
  FR('aq_no', 'anyq', 'No, I\'m good. {Thanks}.', '아니요, 괜찮아요. 고마워요.', { fact: { ask: null } });
  FR('sf_ok', 'safe', 'Yes, {please}. {Thank you}.', '네, 그렇게 해 주세요. 고마워요.', { fact: { safeOk: true } });
  FR('sf_wo', 'safe', 'Yes, without ___, {please}.', '네, ___ 빼고 주세요.', { slot: 'part', fact: { safeOk: true } });
  // 식사 중
  FR('dc_ty', 'dishcome', '{Thank you}.', '고마워요.', { fact: { dishOk: true } });
  FR('dc_looks', 'dishcome', 'This looks great. {Thank you}.', '맛있어 보여요. 고마워요.', { fact: { dishOk: true } });
  FR('dc_not', 'dishcome', '{Excuse me}, this isn\'t what I ordered. I ordered the ___.', '저기요, 이건 제가 시킨 게 아니에요. 저는 ___(을)를 시켰어요.', { slot: 'dish', fact: { dishOk: false } });
  FR('dc_wrong', 'dishcome', 'This is wrong!', '(따지는 말) 이거 틀렸어요!', { fact: { dishOk: false }, tag: 'blunt', why: '‘잘못 나왔어요’를 그대로 옮기면 따지는 말처럼 들려요. 사실 + 내가 시킨 것 → Excuse me, this isn\'t what I ordered. I ordered the steak.' });
  FR('dc_take', 'dishcome', 'I didn\'t order this. Take it back.', '(명령) 이거 안 시켰어요. 가져가요.', { fact: { dishOk: false }, tag: 'blunt', why: 'Take it back.은 명령처럼 들려요. 무엇을 시켰는지 말하면 서버가 바로 바꿔 줘요 → I ordered the steak.' });
  FR('hw_great', 'how', 'Great, {thank you}.', '아주 좋아요, 고마워요.', { reqOk: true });
  FR('hw_all', 'how', 'Everything is great, {thanks}.', '모두 좋아요, 고마워요.', { reqOk: true });
  FR('hw_yesit', 'how', 'Yes, it is.', '네, 그래요.', { tag: 'wrong', why: 'How is …? → 어떤지 묻는 정보 질문이에요. Yes, it is.는 Is it …?(Yes/No 질문)의 대답이라 어떤지가 빠졌어요 → Great, thank you.', wrongShape: true });
  FR('cl_ex', 'call', '{Excuse me}.', '저기요.', { reqOk: true });
  FR('cl_hey', 'call', 'Hey!', '(큰 소리) 이봐요!', { reqOk: true, tag: 'blunt', why: 'Hey!는 친구를 부르는 말이라 서버를 부를 때는 무례하게 들려요. 눈을 맞추거나 손을 살짝 들고 → Excuse me.' });
  FR('cl_waiter', 'call', 'Waiter!', '(큰 소리) 웨이터!', { reqOk: true, tag: 'blunt', why: 'Waiter!라고 크게 부르면 무례하게 들려요. 많은 곳에서 서버가 먼저 와요. 부를 때는 → Excuse me.' });
  FR('cl_here', 'call', 'Here!', '(큰 소리) 여기요!', { reqOk: true, tag: 'blunt', why: '‘여기요!’를 그대로 옮긴 Here!는 영어로는 사람을 부르는 말이 아니라서 엉뚱하고 무례하게 들려요. 부를 때는 → Excuse me.' });
  FR('rq_could', ['need', 'more'], '{Could I} get ___, {please}?', '___ 주시겠어요?', { slot: 'need', req: true });
  FR('rq_we', ['need', 'more'], '{Could we} get ___, {please}?', '___ 주시겠어요?', { slot: 'need', req: true });
  FR('rq_give', ['need', 'more'], 'Give me ___.', '(명령) ___ 줘요.', { slot: 'need', form: 'bare', req: true, tag: 'blunt', why: '‘물 주세요’를 낱말 그대로 옮긴 Give me는 명령처럼 들려요. 부탁은 질문으로 → Could I get some more water, please?' });
  FR('mr_no', 'more', 'No, that\'s all. {Thank you}.', '아니요, 그게 다예요. 고마워요.', { fact: { need2: null } });
  // 디저트 · 포장
  FR('dn_box', 'done', 'No, I\'m done. {Could I} get a box for this, {please}?', '아니요, 다 먹었어요. 남은 것 싸 갈 그릇 좀 주시겠어요?', { fact: { box: true } });
  FR('dn_fin', 'done', 'No, I\'m finished. {Thank you}.', '아니요, 다 먹었어요. 고마워요.', { fact: { box: false } });
  FR('dn_takeout', 'done', 'No. Take out, {please}.', '아니요. 포장해 주세요.', { fact: { box: true }, note: 'take out은 보통 처음부터 가져갈 음식을 주문할 때 써요. 알아듣지만, 남은 음식이면 → Could I get a box for this?' });
  FR('dn_pack', 'done', 'No. Packing, {please}.', '(콩글리시) 아니요. 포장이요.', { fact: { box: true }, tag: 'literal', why: '‘포장’을 packing으로 옮기면 짐 싸기로 들려 알아듣기 어려워요. 남은 음식을 싸 가려면 → Could I get a box for this?' });
  FR('ds_could', 'dessert', 'Yes, {could I} get ___, {please}?', '네, ___ 주시겠어요?', { slot: 'dessert' });
  FR('ds_short', 'dessert', '___, {please}.', '___ 주세요.', { slot: 'dessert', form: 'short' });
  FR('ds_no', 'dessert', 'No, {thanks}. Just the check, {please}.', '아니요, 괜찮아요. 계산서만 주세요.', { fact: { dessert: 'none', checkreq: true } });
  FR('ds_no0', 'dessert', 'No, {thanks}. I\'m full.', '아니요, 괜찮아요. 배불러요.', { fact: { dessert: 'none' } });
  FR('ds_calc', 'dessert', 'No, {thanks}. Calculate, {please}.', '(어색한 말) 아니요. 계산해 주세요.', { fact: { dessert: 'none', checkreq: true }, tag: 'literal', why: '‘계산해 주세요’를 그대로 옮긴 Calculate는 셈을 한다는 뜻이라 알아듣기 어려워요. → Just the check, please. (영국은 the bill)' });
  FR('ds_give', 'dessert', 'Give me ___.', '(명령) ___ 줘요.', { slot: 'dessert', form: 'bare', tag: 'blunt', why: 'Give me로 시작하면 명령처럼 들려요. → Could I get the chocolate cake, please?' });
  // 계산
  FR('cr_just', 'checkreq', 'Just the check, {please}.', '계산서만 주세요.', { fact: { checkreq: true } });
  FR('cr_could', 'checkreq', '{Could we} get the check, {please}?', '계산서 좀 주시겠어요?', { fact: { checkreq: true } });
  FR('cr_bill', 'checkreq', '{Could we} get the bill, {please}?', '계산서 좀 주시겠어요?', { fact: { checkreq: true }, note: 'bill도 통해요. 미국은 보통 check, 영국은 bill이라고 해요.' });
  FR('cr_calc', 'checkreq', 'Can I calculate?', '(어색한 말) 계산해도 돼요?', { fact: { checkreq: true }, tag: 'literal', why: '‘계산할게요’를 그대로 옮긴 calculate는 셈을 한다는 뜻이라 알아듣기 어려워요. 많은 곳에서 테이블에서 계산해요 → Could we get the check, please?' });
  FR('sp_pl', 'split', '___, {please}.', '___(으)로 해 주세요.', { slot: 'pay' });
  // Separate, please. → 따로 계산(보통 각자 먹은 것). 똑같이 나누려면 이렇게 말하거나, 서버가 Would you like me to split it evenly?로 물어요
  FR('sp_split', 'split', '{Could you} split it evenly, {please}?', '똑같이 나눠 주시겠어요?', { fact: { pay: 'separate', even: true } });
  FR('sp_sep', 'split', '{Could we} pay separately?', '따로 계산해도 될까요?', { fact: { pay: 'separate' } });
  FR('sp_dutch', 'split', 'Dutch pay, {please}.', '(콩글리시) 더치페이요.', { fact: { pay: 'separate' }, tag: 'literal', why: '‘더치페이’는 한국에서 만든 말이라 영어로는 통하지 않아요. → Separate, please. · Could you split it evenly?' });
  FR('pm_pl', 'pay', '___, {please}.', '___(으)로 할게요.', { slot: 'paym' });
  FR('pm_calc', 'pay', '___ calculate, {please}.', '(어색한 말) ___ 계산이요.', { slot: 'paym', tag: 'literal', why: '‘카드 계산이요’의 ‘계산’을 calculate로 옮기면 셈을 한다는 뜻이라 어색해요. → Card, please.' });
  FR('pm_conf', 'pay', '{Sorry}, was that ___ each?', '죄송한데, 한 사람에 ___였나요?', { slot: 'money', check: true });
  // 다시 묻기. echo: 들린 만큼 되묻는 말 — 실제로 들은 말이어야 통과 · kind what: 대답 대신 해도 되는 말(allow)
  FR('rp_again', 'repair', '{Sorry? Could you} say that again, {please}?', '죄송한데, 다시 한 번 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_sorry', 'repair', '{Sorry}?', '네? (다시 말해 달라는 뜻)', { kind: 'again' });
  FR('rp_slow', 'repair', '{Could you} speak a little more slowly, {please}?', '조금 더 천천히 말씀해 주시겠어요?', { kind: 'slow' });
  FR('rp_wait', 'repair', '{Sorry}, how long is the wait?', '죄송한데, 얼마나 기다려야 하나요?', { kind: 'echo', echo: 'wait' });
  FR('rp_water', 'repair', '{Sorry}, still or sparkling?', '죄송한데, 그냥 물이요, 탄산수요?', { kind: 'echo', echo: 'water' });
  FR('rp_what', 'repair', '{Sorry}, what\'s sparkling water?', '죄송한데, sparkling water가 뭐예요?', { kind: 'what' });
  FR('rp_rude', 'repair', 'What?', '(퉁명스러운 말) 뭐라고요?', { kind: 'again', tag: 'blunt', why: 'What? 한 낱말은 퉁명스럽게 들릴 수 있어요. 못 알아들었으면 → Sorry? Could you say that again, please?' });
  // 함께 쓰는 칸: 알레르기 성분을 뺄 재료 (sf_wo)
  RS.SLOT.part = { key: 'part', vals: { walnuts: { t: 'the walnuts', ko: '호두', fact: { part: 'the walnuts' } }, cheese: { t: 'the cheese', ko: '치즈', fact: { part: 'the cheese' } }, shrimp: { t: 'the shrimp', ko: '새우', fact: { part: 'the shrimp' } } } };

  /* ---------- 대답 글 만들기: 조각(segs) = [{ t, r: 'frame' | 'slot' | 'pol', req }] ---------- */
  const slotText = (F, v) => { const x = RS.sv(F.slot, v); return x ? (x[F.form || 't'] != null ? x[F.form || 't'] : x.t) : '___'; };
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
  RS.segs = function (a) {
    const F = RS.FRAME[a.f];
    if (F.line) return lineSegs(a.line);
    const out = frameSegs(F, a.v);
    if (a.req && RS.FRAME[a.req.f]) { out.push({ t: ' ', r: 'frame' }); frameSegs(RS.FRAME[a.req.f], a.req.v).forEach(s => out.push(Object.assign(s, { req: true }))); }
    return out;
  };
  RS.text = a => RS.segs(a).map(s => s.t).join('');
  // 해석
  const koOf = (F, v) => {
    if (!F.slot) return F.ko;
    const x = RS.sv(F.slot, v), k = x ? x.ko : '___';
    return F.ko.replace('___(으)로', ro(k)).replace('___(이)에요', ieyo(k)).replace('___(이)가', ig(k)).replace('___(을)를', eul(k)).replace('___', k);
  };
  RS.ko = function (a) {
    const F = RS.FRAME[a.f];
    if (F.line) {
      const f = RS.lineFacts(a.line), m = f.dish ? RS.MENU[f.dish].ko : '', parts = [];
      if (f.cook) parts.push(RS.SLOT.cook.vals[f.cook].ko); if (f.spice) parts.push(RS.SLOT.spice.vals[f.spice].ko);
      if (f.starter) parts.push(`${RS.SLOT.starter.vals[f.starter].ko}${f.dressing ? `(${RS.SLOT.dressing.vals[f.dressing].ko} 드레싱)` : ''}와 함께`);
      if (f.without) parts.push(`${({ nuts: '호두', milk: '치즈', shrimp: '새우' })[f.without]} 빼고`);
      const give = RS.lineHasBlunt(a.line);
      return `${m}${parts.length ? `, ${parts.join(', ')}` : ''} ${give ? '줘요. (무례한 말)' : '주세요.'}${f.allergy ? ` ${RS.ALLERGENS[f.allergy].ko} 알레르기가 있어요.` : ''}`;
    }
    return koOf(F, a.v) + (a.req && RS.FRAME[a.req.f] ? ' ' + koOf(RS.FRAME[a.req.f], a.req.v) : '');
  };
  // 대답이 말하는 사실 (q를 주면 Yes · No만 하는 대답의 사실도)
  RS.factOf = function (a, q) {
    const F = RS.FRAME[a.f], f = Object.assign({}, F.fact || {});
    if (F.slot && RS.sv(F.slot, a.v)) Object.assign(f, valFact(F.slot, a.v));
    if (F.line) Object.assign(f, RS.lineFacts(a.line));
    if (a.req && RS.FRAME[a.req.f]) { const R = RS.FRAME[a.req.f]; if (R.slot && RS.sv(R.slot, a.req.v)) Object.assign(f, valFact(R.slot, a.req.v)); }
    return f;
  };
  // 사실을 한국어로
  RS.factKo = function (k, v) {
    if (k === 'name') return RS.NAMES[v] ? `${RS.NAMES[v]}(${v})` : String(v);
    if (k === 'party') return `${v}명`;
    if (k === 'wait') return `${v}분 (${numWord(+v)})`;
    if (k === 'amount') return `${RS.money(v)} (${RS.priceWords(v)})`;
    if (k === 'dish' || k === 'served') return RS.MENU[v] ? `${RS.MENU[v].ko}(${RS.MENU[v].en})` : String(v);
    if (k === 'drink') return v === 'none' ? '물만' : RS.MENU[v] ? RS.MENU[v].ko : String(v);
    if (k === 'dessert') return v === 'none' ? '디저트 안 먹음' : RS.MENU[v] ? RS.MENU[v].ko : String(v);
    if (k === 'allergy') return v === 'none' ? '알레르기 없음' : `${(RS.ALLERGENS[v] || {}).ko || v} 알레르기`;
    if (k === 'need' || k === 'need2') return v ? (RS.SLOT.need.vals[v] || {}).ko || String(v) : '더 필요한 것 없음';
    if (k === 'resv') return v ? '예약 있음' : '예약 없음';
    if (k === 'ready') return v ? '주문할 준비 됨' : '아직 고르는 중';
    if (k === 'dishOk') return v ? '내가 시킨 음식이 나옴' : '다른 음식이 나옴';
    if (k === 'box') return v ? '남은 음식을 싸 감' : '남은 음식 없음 · 싸 가지 않음';
    if (k === 'ask') return v ? (RS.SLOT.ask.vals[v] || {}).ko + ' 들었는지 묻기' : '물어볼 것 없음';
    if (k === 'waitOk') return v ? '기다려도 괜찮음' : '기다리기 어려움';
    if (k === 'safeOk') return v ? '빼고 만들어도 괜찮음' : '빼고 만드는 것을 거절함';
    if (k === 'without') return `${({ nuts: '호두', milk: '치즈', shrimp: '새우' })[v] || v} 빼기`;
    if (k === 'part') return String(v).replace(/^the /, '');
    const S = Object.values(RS.SLOT).find(s => s.key === k && s.vals && s.vals[v]);
    return S ? S.vals[v].ko : String(v);
  };

  /* ---------- 이미 답한 질문 (시뮬레이터의 서버가 건너뜀) ---------- */
  const KEY2INTENT = { name: ['name'], party: ['party'], dish: ['ready', 'order'], cook: ['cook'], spice: ['spice'], starter: ['starter'], dressing: ['dressing'], allergy: ['allergy'], without: ['safe'], need: ['need'], need2: ['more'], checkreq: ['checkreq'], even: ['even'] };
  RS.coveredBy = (facts, intent) => { const out = new Set(intent ? [intent] : []); Object.keys(facts).forEach(k => (KEY2INTENT[k] || []).forEach(i => out.add(i))); return [...out]; };
  RS.covered = (a, q) => { if (typeof q === 'string') q = RS.Q[q]; return RS.coveredBy(RS.factOf(a, q), q.intent); };
  RS.coveredKo = cov => cov.filter(i => !['ready', 'order', 'call', 'need', 'dessert', 'resv'].includes(i)).map(i => RS.INTENT_KO[i]).filter((x, i, a) => x && a.indexOf(x) === i);

  /* =========================================================
     판정 — RS.judge(서버의 말, 대답, 카드, 출처)
     q: RS.Q의 말(또는 id) · a: { f: 틀 id, v: 칸 값, req: { f, v }, line } · card: 사실 · src: '카드' | '상황'
     ========================================================= */
  const res = (ok, stage, why, tag) => ({ ok, stage, why, tag: tag || (ok ? 'ok' : '') });
  const shapeHead = q => `${q.key.join(' … ')} → ${RS.SHAPE[q.shape].ko}`;
  RS.judge = function (q, a, card, src = '카드') {
    if (typeof q === 'string') q = RS.Q[q];
    const F = RS.FRAME[a.f], C = Object.assign({}, card || {}, q.fact || {});
    const fi = [].concat(F.intent), key = q.key.join(' … '), In = RS.INTENT[q.intent], SH = RS.SHAPE[q.shape];
    let allowed = false;
    const notes = [];
    // ① 열쇠 낱말 + 질문의 모양 잡기
    if (q.fast) {
      if (F.intent !== 'repair') return res(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 묻는지 모르는데 짐작해서 답하면 엉뚱한 대답이 될 수 있어요. 먼저 다시 물어요.', 'guess');
      if (F.kind === 'echo' && F.echo !== q.intent) return res(false, 1, `되물은 말이 달라요. 들린 낱말(${key})로 보면 서버는 ${In.turn}에 대해 물었어요.`, 'intent');
    } else if (F.bare) {
      if (q.shape === 'or') return res(false, 1, `${shapeHead(q)}. 둘 가운데 하나를 고르라는 말이라 ${F.yes ? 'Yes' : 'No'}만으로는 무엇을 골랐는지 알 수 없어요 → ${In.want}`, 'shape');
      if (q.shape === 'wh') return res(false, 1, `${shapeHead(q)}. 정보를 묻는 말이라 ${F.yes ? 'Yes' : 'No'}로는 답이 안 돼요 → ${In.want}`, 'shape');
      if (q.shape === 'note') return res(false, 1, `열쇠 낱말 ${key} → ${RS.sayOf(q.intent)}. 묻는 말이 아니라서 ${F.yes ? 'Yes' : 'No'}로 답할 일이 아니에요 → ${In.want}`, 'shape');
    } else if (!fi.includes(q.intent)) {
      if (F.intent === 'repair' && q.allow && q.allow.includes(F.kind)) allowed = true;
      else if (F.intent === 'repair') return res(false, 1, '대답이 아니라 다시 묻는 말이에요. 알아들었다면 바로 답해요.', 'intent');
      else {
        const other = RS.INTENT[fi[0]];
        return res(false, 1, `${shapeHead(q)}${q.shape === 'note' ? '' : `(${SH.ans})`}. 이 대답은 ${other.ans}에 맞는 말이에요.`, 'intent');
      }
    }
    if (F.wrongShape && (q.shape === 'wh' || q.shape === 'or')) return res(false, 1, `${shapeHead(q)}. ${F.why}`, 'shape');
    // 고르는 질문: 서버가 말한 것 가운데 골랐나
    const fact = RS.factOf(a, q);
    if (q.shape === 'or' && q.choices && !F.bare && F.intent !== 'repair' && In.key) {
      const v = fact[In.key];
      if (v != null && !q.choices.includes(v)) return res(false, 1, `${shapeHead(q)}. 서버가 말한 것(${q.choices.map(c => RS.factKo(In.key, c)).join(' · ')}) 가운데 하나를 골라요. ${RS.factKo(In.key, v)}${has(RS.factKo(In.key, v)) ? '은' : '는'} 묻지 않았어요.`, 'choice');
    }
    if (F.line) { const o = RS.orderLine(a.line); if (!o.ok && o.stage === 1) return res(false, 1, o.why, 'intent'); }
    // ② 틀에 내 정보 넣기
    if (F.tag === 'literal' || F.tag === 'wrong') return res(false, 2, F.why, F.tag);
    const sv = F.slot ? RS.sv(F.slot, a.v) : null;
    if (F.slot && !sv && !F.line) return res(false, 2, '칸이 비었어요.', 'fact');
    if (sv && sv.bad) return res(false, 2, sv.why, sv.bad);
    if (F.bare) {
      const Y = In.yn, want = Y && Y.yes ? Y.yes(C) : null;
      if (want != null && want !== F.yes) return res(false, 2, `${wa(src)} 달라요. ${src}: ${F.yes ? 'No' : 'Yes'} 쪽이에요(${Y.ko ? Y.ko(C) : In.turn}). 이 대답: ${F.yes ? 'Yes' : 'No'}.${q.intent === 'done' && C.box ? ' 그냥 No.라고 하면 서버가 접시를 치울 수도 있어요 → No, I\'m done. Could I get a box for this?' : ''}`, 'fact');
      if (F.yes && Y && Y.strict) return res(false, 2, Y.strict, 'need');
      if (F.yes && Y && Y.need) notes.push(Y.need);
      if (q.intent === 'done' && !F.yes && C.box) return res(false, 2, `${src}: 남은 음식을 싸 가요. 그냥 No.라고 하면 서버가 접시를 치울 수도 있어요 → No, I'm done. Could I get a box for this?`, 'fact');
    }
    if (F.line) { const o = RS.orderLine(a.line); if (!o.ok) return res(false, 2, o.why, 'order'); }
    if (F.check) {
      const k = RS.SLOT[F.slot].key;
      if (C[k] != null && fact[k] !== C[k]) return res(false, 2, `서버가 말한 숫자와 달라요. 서버: ${RS.factKo(k, C[k])} · 이 대답: ${RS.factKo(k, fact[k])}.`, 'fact');
    } else {
      if (q.intent === 'dishcome' && fact.dishOk === false && C.served && fact.dish === C.served && C.dish !== C.served) return res(false, 2, `지금 나온 음식(${RS.factKo('dish', C.served)})을 말했어요. 내가 시킨 음식 → ${RS.factKo('dish', C.dish)}.`, 'fact');
      for (const k of Object.keys(fact)) {
        if (C[k] === undefined || C[k] === fact[k]) continue;
        if (k === 'need' && C.need2 && fact[k] === C.need2) continue;   // 식사 중 부탁 두 가지는 어느 쪽을 먼저 말해도 돼요
        if (k === 'need2' && fact[k] === null && C.need2 == null) continue;
        if (k === 'checkreq') continue;
        if (k === 'part') continue;
        return res(false, 2, `${wa(src)} 달라요. ${src}: ${RS.factKo(k, C[k])} · 이 대답: ${RS.factKo(k, fact[k])}.`, 'fact');
      }
      if (q.intent === 'dishcome' && fact.dishOk === false && C.dish && fact.dish == null && F.slot) return res(false, 2, '내가 시킨 음식 이름을 말해요.', 'fact');
      if (q.intent === 'dishcome' && fact.dishOk === false && C.served && fact.dish === C.served) return res(false, 2, `지금 나온 음식(${RS.factKo('dish', C.served)})을 말했어요. 내가 시킨 음식 → ${RS.factKo('dish', C.dish)}.`, 'fact');
      if (F.slot === 'part' && C.part && fact.part !== C.part) return res(false, 2, `서버가 말한 재료와 달라요. 서버: ${C.part.replace(/^the /, '')} · 이 대답: ${String(fact.part).replace(/^the /, '')}.`, 'fact');
    }
    const R = a.req ? RS.FRAME[a.req.f] : null;
    if (a.req && !F.reqOk) return res(false, 2, '이 대답에는 부탁을 붙이지 않아요.', 'fix');
    if (R && R.slot && !RS.sv(R.slot, a.req.v)) return res(false, 2, '부탁의 칸이 비었어요.', 'fix');
    // ③ 공손하게 끝내기
    if (F.tag === 'blunt' || F.tag === 'plain') return res(false, 3, F.why, F.tag);
    if (R && R.tag === 'blunt') return res(false, 3, R.why, 'blunt');
    if (F.line && RS.lineHasBlunt(a.line)) return res(false, 3, (a.line.words || a.line).includes('give') ? 'Give me로 시작하면 명령처럼 들려요. 주문은 → I\'ll have the …, please.' : 'I want는 조르는 말처럼 들려요. 주문은 → I\'ll have the …, please.', 'blunt');
    // 통과
    const segs = RS.segs(a), pol = segs.filter(s => s.r === 'pol').map(s => s.t).filter((x, i, arr) => arr.indexOf(x) === i);
    let why;
    if (q.fast) why = F.kind === 'echo' ? '들린 만큼 되물어 확인했어요. 무엇에 대해 물었는지 알면 그 부분만 다시 물을 수 있어요.' : F.kind === 'slow' ? '천천히 말해 달라고 공손하게 부탁했어요.' : '못 알아들었을 때는 짐작하지 말고 공손하게 다시 물어요.';
    else if (allowed) why = '모르는 낱말은 짐작하지 말고 물어요. 서버가 쉬운 말로 다시 알려 줄 거예요(sparkling water = 탄산수).';
    else if (F.line) {
      const o = RS.orderLine(a.line), cov = RS.coveredKo(RS.covered(a, q));
      why = `${o.why} ${cov.length ? `한 줄에 ${cov.join(' · ')}까지 말해서 서버가 그 질문을 건너뛰어요.` : '음식만 말했으니 서버가 나머지를 차례로 물어요.'}`;
    } else if (F.check) why = `서버가 말한 숫자(${RS.factKo(RS.SLOT[F.slot].key, C[RS.SLOT[F.slot].key])})와 같아요. 숫자가 헷갈리면 이렇게 되물어 확인해요.`;
    else if (F.bare) why = `${shapeHead(q)} → ${SH.ans}. Yes/No 질문이라 ${F.yes ? 'Yes' : 'No'}로 답할 수 있어요.`;
    else {
      const sl = segs.filter(s => s.r === 'slot').map(s => s.t);
      why = `${shapeHead(q)} → ${SH.ans}. ` + (sl.length ? `틀 + 내 정보(${sl.join(' ')}) → ${src}의 사실과 맞아요.` : Object.keys(fact).filter(k => fact[k] != null && k !== 'checkreq').length ? `${src}의 사실(${Object.keys(fact).filter(k => fact[k] != null && k !== 'checkreq').map(k => RS.factKo(k, fact[k])).join(' · ')})과 맞아요.` : '짧은 대답이면 충분해요.');
      if (q.shape === 'yn' && In.offer && !/^(Yes|No)\b/.test(RS.text(a))) why += ` ${SH.offer}.`;
      if (q.intent === 'dishcome' && fact.dishOk === false) why += ' 사실(내가 시킨 것이 아님) + 내가 시킨 것 → 서버가 바로 바꿔 줘요.';
      const cov = RS.coveredKo(RS.covered(a, q).filter(i => i !== q.intent));
      if (cov.length) why += ` ${cov.join(' · ')}까지 말해서 서버가 그 질문을 건너뛰어요.`;
    }
    if (pol.length) why += ` 공손한 말 → ${pol.join(' · ')}.`;
    notes.forEach(n => { why += ` ${n}`; });
    if (F.note) why += ` ${F.note}`;
    if (sv && sv.note) why += ` ${sv.note}`;
    return res(true, 0, why);
  };
  // 모범 대답 (카드에 맞춰)
  RS.model = function (q, card) {
    if (typeof q === 'string') q = RS.Q[q];
    const C = Object.assign({}, card || {}, q.fact || {});
    if (q.fast) return { f: q.intent === 'wait' ? 'rp_wait' : q.intent === 'water' ? 'rp_water' : 'rp_again' };
    if (q.intent === 'ready' && C.ready !== false) return RS.modelLine(C);
    if (q.intent === 'order') return RS.modelLine(C);
    if (q.intent === 'call') return C.need ? { f: 'cl_ex', req: { f: 'rq_could', v: C.need } } : { f: 'cl_ex' };
    if (q.intent === 'more') return C.need2 ? { f: 'rq_could', v: C.need2 } : { f: 'mr_no' };
    const id = typeof In(q).best === 'function' ? In(q).best(C) : In(q).best, F = RS.FRAME[id];
    if (!F.slot) return { f: id };
    const v = RS.slotVal(F.slot, C);
    return { f: id, v: v != null ? String(v) : (RS.SLOT[F.slot].dyn ? undefined : slotIds(F.slot)[0]) };
  };
  const In = q => RS.INTENT[q.intent];
  // 한 줄 주문의 모범 (카드의 음식 · 굽기 · 곁들임 · 드레싱 · 맵기, 알레르기가 있으면 맨 끝에)
  RS.modelLine = c => {
    const w = ['have', c.dish || 'salmon'];
    if (c.dish === 'steak' && c.cook) w.push(c.cook);
    if (c.dish === 'noodles' && c.spice) w.push(c.spice);
    if (RS.hasStarter(c.dish) && c.starter) { w.push(c.starter); if (c.starter === 'salad' && c.dressing) w.push(c.dressing); }
    w.push('please');
    return { f: 'line', line: { words: w } };
  };

  /* =========================================================
     소리로 한 대답 맞춰 보기 — RS.matchSpoken(들린 글, 말, 카드)
     음성 인식이 글로 바꾼 말에 그 말의 표시 낱말과 카드의 사실이 들어 있으면 받아들여요.
     질문의 모양 규칙은 같아요: 고르는 질문 · 정보 질문에 yes · no만 들리면 ①. 숫자는 낱말(fifteen · twenty-three forty)이든 숫자든 같게 맞춰요.
     공손함 · 발음은 판정하지 않아요(알림만 붙여요).
     ========================================================= */
  const CONTR = [[/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\bwhat's\b/g, 'what is'], [/\bdon't\b/g, 'do not'], [/\bdidn't\b/g, 'did not'], [/\bi've\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\bcan't\b/g, 'cannot'], [/\bi'd\b/g, 'i would'], [/\byou're\b/g, 'you are'], [/\bthat's\b/g, 'that is'], [/\bthere's\b/g, 'there is'], [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bdoesn't\b/g, 'does not'], [/\bwe'll\b/g, 'we will'], [/\bhere's\b/g, 'here is'], [/\bwe're\b/g, 'we are'], [/\blet's\b/g, 'let us']];
  RS.norm = function (s) {
    let t = String(s || '').toLowerCase().replace(/[’‘]/g, '\'');
    CONTR.forEach(([r, w]) => { t = t.replace(r, w); });
    t = t.replace(/(\d):(\d)/g, '$1 $2').replace(/\$/g, ' ').replace(/(\d)\.(\d)/g, '$1 $2').replace(/[^a-z0-9' -]+/g, ' ').replace(/-/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '');
    return t.split(/\s+/).filter(Boolean);
  };
  const W2N = {}; Object.entries(NUMW).forEach(([n, w]) => { W2N[w] = +n; });
  // 낱말 → 숫자 줄로 모음: fifteen → 15 · twenty three forty → 2340 · 23.40 → 2340 · seven thirty → 730
  RS.canon = function (s) {
    const w = RS.norm(s), out = [];
    let run = null;
    const flush = () => { if (run != null) { out.push(run); run = null; } };
    for (let i = 0; i < w.length; i++) {
      const x = w[i];
      let d = null;
      if (/^\d+$/.test(x)) d = x;
      else if ((x === 'oh' || x === 'o') && run != null) d = '0';
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
  const BARE_RE = /^(yes|yeah|yep|no|nope|please|sure|thanks|thank|you|okay|ok|of|course|it|is|i|do|am|not|that|would|like|great|uh|um|well)$/;
  const REPAIR_RE = /\b(say that again|pardon|repeat|more slowly|slow down|sorry what|come again)\b|^ ?sorry ?$/;
  const SPK = {
    seat: [['outside', /\b(outside|outdoors?|patio|terrace)\b/], ['inside', /\b(inside|indoors?|in here)\b/]],
    water: [['sparkling', /\b(sparkling|sparkly|fizzy|soda water|carbonated)\b/], ['still', /\b(still|tap|regular water|plain water|flat)\b/]],
    drink: [['soda', /\b(lemon lime|lemonlime|sprite|7 up|seven up|7up)\b/], ['lemonade', /\blemonade\b/], ['icedtea', /\biced? tea\b/], ['cider', /\bcider\b/]],
    dish: [['steak', /\b(ribeye|rib eye|steak)\b/], ['salmon', /\bsalmon\b/], ['noodles', /\bnoodles?\b/], ['pasta', /\bpasta\b/], ['burger', /\bburger\b/], ['risotto', /\b(risotto|special)\b/]],
    cook: [['mediumrare', /\bmedium rare\b/], ['mediumwell', /\bmedium well\b/], ['welldone', /\bwell done\b/], ['rare', /\brare\b/], ['medium', /\bmedium\b/], ['middle', /\bmiddle\b/]],
    starter: [['soup', /\bsoup\b/], ['salad', /\bsalad\b/], ['fries', /\b(fries|chips|french fries)\b/]],
    dressing: [['ranch', /\branch\b/], ['italian', /\bitalian\b/], ['balsamic', /\bbalsamic\b/]],
    spice: [['mild', /\b(mild|not too spicy|not spicy|not very spicy|less spicy)\b/], ['spicy', /\b(spicy|hot)\b/]],
    allergen: [['peanuts', /\bpeanuts?\b/], ['shrimp', /\b(shrimp|shellfish|prawns?)\b/], ['milk', /\b(milk|dairy|lactose|cheese)\b/], ['nuts', /\b(nuts?|walnuts?|tree nuts?)\b/]],
    need: [['water', /\bwater\b/], ['plate', /\bplates?\b/], ['napkins', /\bnapkins?\b/], ['fork', /\bforks?\b/]],
    dessert: [['cake', /\b(chocolate cake|cake)\b/], ['sorbet', /\bsorbet\b/]],
    pay: [['separate', /\b(separate|separately|split|each|dutch)\b/], ['together', /\btogether\b/]],
    paym: [['card', /\b(card|credit|debit)\b/], ['cash', /\bcash\b/]],
  };
  const find = (k, s) => (SPK[k].find(([, r]) => r.test(s)) || [])[0];
  RS.needOf = raw => { const s = ' ' + RS.canon(raw).join(' ') + ' '; return SPK.need.filter(([, r]) => r.test(s)).map(([k]) => k); };
  // 들린 말에서 주문 조각 찾기 (한 줄 주문을 말로 했을 때)
  RS.parseOrder = function (raw, C = {}) {
    const s = ' ' + RS.canon(raw).join(' ') + ' ', f = {};
    let d = find('dish', s);
    if (d === 'noodles' && /\bpasta\b/.test(s)) d = 'pasta';
    if (/\bpeanut noodles?\b/.test(s)) d = 'noodles';
    if (/\bshrimp pasta\b/.test(s)) d = 'pasta';
    if (d) f.dish = d;
    const ck = find('cook', s); if (ck) f.cook = ck;
    const sp = /\b(mild|not too spicy|not spicy|spicy)\b/.test(s) ? find('spice', s) : null; if (sp) f.spice = sp;
    const st = /\bwith (the |a )?(soup|salad|side salad|house salad)\b/.test(s) || /\b(soup|salad)\b/.test(s) ? find('starter', s) : null; if (st && st !== 'fries') f.starter = st;
    const dr = find('dressing', s); if (dr) f.dressing = dr;
    const al = /\b(allergic|allergy)\b/.test(s) ? find('allergen', s.replace(/\bpeanut noodles?\b/, ' ').replace(/\bshrimp pasta\b/, ' ')) : null; if (al) f.allergy = al;
    if (/\bwithout (the )?walnuts?\b/.test(s)) f.without = 'nuts'; else if (/\bwithout (the )?cheese\b/.test(s)) f.without = 'milk'; else if (/\bwithout (the )?shrimp\b/.test(s)) f.without = 'shrimp';
    if (f.cook === 'medium' && f.spice) delete f.cook;
    return f;
  };
  const others = (list, me) => list.filter(n => n.toLowerCase() !== String(me || '').toLowerCase());
  RS.matchSpoken = function (raw, q, card) {
    if (typeof q === 'string') q = RS.Q[q];
    const toks = RS.canon(raw), s = ' ' + toks.join(' ') + ' ', heard = RS.norm(raw).join(' ');
    if (!toks.length) return { ok: false, stage: 0, why: '들린 말이 없어요. 다시 말해 보세요.', heard: '' };
    const C = Object.assign({}, card || {}, q.fact || {}), SH = RS.SHAPE[q.shape], It = RS.INTENT[q.intent];
    const R = (ok, stage, why, o = {}) => Object.assign({ ok, stage, why, heard }, o);
    const notes = [];
    const pass = (why, cov) => R(true, 0, why + (notes.length ? ' 알림: ' + notes.join(' ') : ''), { note: notes.join(' '), covered: cov || [q.intent] });
    const keyMiss = () => R(false, 1, `${shapeHead(q)}(${SH.ans}). 들린 말에 그 대답이 없어요.`);
    const nums = runs(toks);
    // 빠른 말: 다시 묻는 말만 (들린 만큼 되묻는 말은 실제 질문과 같아야)
    const echoWait = /\b(how long|wait)\b/.test(s), echoWater = /\bstill or sparkling\b/.test(s);
    if (q.fast) {
      if (echoWater) return q.intent === 'water' ? R(false, 1, '들린 만큼 되물었어요. 서버가 다시 말해 줄 거예요.', { repair: 'again' }) : R(false, 1, `되물은 말이 달라요. 들린 낱말(${q.key.join(' … ')})로 보면 서버는 ${It.turn}에 대해 물었어요.`);
      if (echoWait && /\b(sorry|how long)\b/.test(s)) return q.intent === 'wait' ? R(false, 1, '들린 만큼 되물었어요. 서버가 다시 말해 줄 거예요.', { repair: 'again' }) : R(false, 1, `되물은 말이 달라요. 서버는 ${It.turn}에 대해 물었어요.`);
      if (REPAIR_RE.test(s) || /\b(sorry|again|slowly)\b/.test(s)) return R(false, 1, '다시 묻는 말로 들었어요. 서버가 한 번 더 말해 줄 거예요.', { repair: 'again' });
      return R(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 짐작해서 답하지 말고 먼저 다시 물어요 → Sorry? Could you say that again, please?');
    }
    // 들은 숫자를 되묻는 말 (Sorry, did you say fifteen? · Sorry, was that thirty-two fifty each?)
    if (/\b(did you say|was that|is that)\b/.test(s) && nums.length && (q.intent === 'wait' || q.intent === 'pay')) {
      if (q.intent === 'wait') { const n = +nums[0]; if (C.wait != null && n !== C.wait) return R(false, 2, `서버가 말한 시간과 달라요. 서버: ${RS.factKo('wait', C.wait)} · 들린 말: ${RS.factKo('wait', n)}.`, { tag: 'fact' }); return R(false, 1, '들은 숫자를 되물어 확인했어요. 서버가 맞다고 할 거예요.', { repair: 'check' }); }
      const amt = +nums.join(''); const want = C.amount; if (want != null && amt !== want) return R(false, 2, `서버가 말한 값과 달라요. 서버: ${RS.factKo('amount', want)} · 들린 말: ${RS.factKo('amount', amt)}.`, { tag: 'fact' });
      return R(false, 1, '들은 값을 되물어 확인했어요. 서버가 맞다고 할 거예요.', { repair: 'check' });
    }
    // 들린 만큼 되묻는 말 (빠르지 않은 말에도): 실제 질문과 같으면 다시 묻기, 다르면 ①
    if (/\bsorry\b/.test(s) && (echoWater || (echoWait && /\bhow long\b/.test(s))) && toks.length <= 8) {
      const ok = echoWater ? q.intent === 'water' : q.intent === 'wait';
      return ok ? R(false, 1, '들린 만큼 되물었어요. 서버가 다시 말해 줄 거예요.', { repair: 'again' }) : R(false, 1, `되물은 말이 달라요. 들린 낱말(${q.key.join(' … ')})로 보면 서버는 ${It.turn}에 대해 물었어요.`);
    }
    if ((REPAIR_RE.test(s) || /\b(could you say|say again)\b/.test(s)) && toks.length <= 9) {
      if (q.allow && q.allow.includes('what') && /\bwhat is sparkling\b/.test(s)) return R(false, 1, '모르는 낱말을 물었어요. 서버가 쉬운 말로 알려 줄 거예요.', { repair: 'what' });
      if (echoWater && q.intent !== 'water') return R(false, 1, `되물은 말이 달라요. 서버는 ${It.turn}에 대해 물었어요.`);
      return R(false, 1, '다시 묻는 말로 들었어요. 서버가 한 번 더 말해 줄 거예요.', { repair: 'again' });
    }
    if (/\b(give me|i want)\b/.test(s)) notes.push('Give me · I want는 명령하거나 조르는 말처럼 들려요(말로 한 대답은 말투를 판정하지 않아요) → Could I get …, please? · I\'ll have the …, please.');
    // 질문의 모양: yes · no만 (그리고 please · thanks 같은 말만) 들렸나
    const bare = toks.every(t => BARE_RE.test(t)) && /\b(yes|yeah|yep|no|nope|sure|okay|ok)\b/.test(s);
    const yesHeard = /\b(yes|yeah|yep|sure|okay|ok)\b/.test(s), noHeard = /\b(no|nope)\b/.test(s);
    if (bare && (q.shape === 'or' || q.shape === 'wh')) return R(false, 1, `${shapeHead(q)}. ${q.shape === 'or' ? '둘 가운데 하나를 고르라는 말이라 yes · no만으로는 무엇을 골랐는지 알 수 없어요' : '정보를 묻는 말이라 yes · no로는 답이 안 돼요'} → ${It.want}`, { tag: 'shape' });
    if (bare && q.shape === 'note') return R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${RS.sayOf(q.intent)} → ${It.want}`, { tag: 'shape' });
    if (q.shape === 'or' && yesHeard && !bare) notes.push('고르는 질문에는 Yes 없이 고른 것만 말해도 돼요.');
    // 고르는 질문 · 정보 질문: 다른 질문의 대답만 들리면 ①
    const otherAns = (keys) => { for (const k of keys) { const v = find(k, s); if (v) return [k, v]; } return null; };
    const EVEN_RE = /\b(evenly|equally|in half|down the middle|fifty fifty)\b/;
    const pickOr = (k, label) => {
      const v = find(k, s);
      if (!v) { const o = otherAns(Object.keys(SPK).filter(x => x !== k)); return o ? R(false, 1, `${shapeHead(q)}. 들린 말(${RS.factKo(RS.SLOT[o[0]] ? RS.SLOT[o[0]].key : o[0], o[1])})은 다른 질문의 대답처럼 들려요 → ${It.want}`) : keyMiss(); }
      if (q.choices && !q.choices.includes(v)) return R(false, 1, `${shapeHead(q)}. 서버가 말한 것(${q.choices.map(c => RS.factKo(RS.SLOT[k].key, c)).join(' · ')}) 가운데 하나를 골라요.`, { tag: 'choice' });
      const fk = RS.SLOT[k].key;
      if (C[fk] != null && v !== C[fk]) return R(false, 2, `카드와 달라요. 카드: ${RS.factKo(fk, C[fk])} · 들린 말: ${RS.factKo(fk, v)}.`, { tag: 'fact' });
      return pass(`${label || '고른 것'}이 들렸고 카드와 맞아요.`);
    };
    switch (q.intent) {
      case 'resv': case 'name': {
        const nm = String(C.name || ''), names = Object.keys(RS.NAMES);
        const other = others(names, nm).find(n => s.includes(' ' + n.toLowerCase() + ' '));
        if (other) return R(false, 2, `카드와 달라요. 카드의 이름: ${nm} · 들린 말: ${other}.`, { tag: 'fact' });
        const got = nm && s.includes(' ' + nm.toLowerCase() + ' ');
        if (q.intent === 'resv') {
          const said = noHeard && !yesHeard ? false : yesHeard || got || /\b(reservation|booked|under)\b/.test(s) ? true : null;
          if (said == null) return keyMiss();
          if (C.resv != null && said !== !!C.resv) return R(false, 2, `카드와 달라요. 카드: ${RS.factKo('resv', !!C.resv)} · 들린 말: ${RS.factKo('resv', said)}.`, { tag: 'fact' });
          if (/\b(two|three|four|table for)\b/.test(s) && C.resv === false) notes.push('사람 수까지 말했어요. 호스트가 다시 물으면 한 번 더 말해요.');
          return pass(said ? (got ? '예약이 있다고 말하고 이름까지 들렸어요.' : '예약이 있다고 말했어요.') : '예약이 없다고 말했어요.', said && got ? ['resv', 'name'] : ['resv']);
        }
        return pass(got ? '이름이 들렸어요.' : `음성 인식이 이름을 ‘${heard.replace(/^(it is|its|under|my name is|name is)\s+/, '')}’로 적었어요. 이름은 직원도 잘못 듣기 쉬워요. 철자를 불러 주면 좋아요 → ${String(nm).toUpperCase().split('').join('-')}.`);
      }
      case 'party': {
        if (/\bjust (me|one)\b|\bonly one\b|\bjust myself\b/.test(s) && C.party != null && C.party !== 1) return R(false, 2, `카드와 달라요. 카드: ${C.party}명 · 들린 말: 1명.`, { tag: 'fact' });
        let n = /\bjust (me|one)\b|\bonly one\b|\bjust myself\b/.test(s) ? 1 : nums.map(Number).find(x => x > 0 && x < 13);
        if (n == null) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (/\b(minutes?|inside|outside|nights?|days?|dollars?|o clock|oclock)\b/.test(s)) return R(false, 1, `${shapeHead(q)}. 들린 말은 다른 질문의 대답(기다리는 시간 · 자리 · 값)처럼 들려요 → Two, please.`);
        if (C.party != null && n !== C.party) return R(false, 2, `카드와 달라요. 카드: ${C.party}명 · 들린 말: ${n}명.`, { tag: 'fact' });
        if (/\bwe are\b/.test(s)) notes.push('We are two.는 알아듣지만 보통 → Two, please. · A table for two, please.');
        if (/\bperson\b/.test(s) && n > 1) notes.push('둘 이상이면 people → two people. 짧게 → Two, please.');
        return pass('사람 수가 들렸고 카드와 맞아요.');
      }
      case 'wait': {
        if (/\b(hurry|too long)\b/.test(s)) notes.push('재촉하는 말처럼 들릴 수 있어요(말로 한 대답은 말투를 판정하지 않아요).');
        if (nums.length && !/\b(fine|okay|ok|sure|wait|yes|good|great|no problem)\b/.test(s)) { const n = +nums[0]; if (C.wait != null && n !== C.wait) return R(false, 2, `서버가 말한 시간과 달라요. 서버: ${RS.factKo('wait', C.wait)} · 들린 말: ${RS.factKo('wait', n)}.`, { tag: 'fact' }); }
        if (nums.length) { const n = +nums.find(x => +x > 4); if (n && C.wait != null && n !== C.wait) return R(false, 2, `서버가 말한 시간과 달라요. 서버: ${RS.factKo('wait', C.wait)} · 들린 말: ${RS.factKo('wait', n)}.`, { tag: 'fact' }); }
        if (!/\b(fine|okay|ok|sure|wait|yes|yeah|good|great|no problem|alright|all right)\b/.test(s)) return keyMiss();
        return pass('기다려도 괜찮다는 말이 들렸어요.');
      }
      case 'seat': return pickOr('seat', '고른 자리');
      case 'water': {
        if (/\bcider\b/.test(s)) return R(false, 2, RS.SLOT.drink.vals.cider.why, { tag: 'literal' });
        if (/\btap\b/.test(s)) notes.push(RS.SLOT.water.vals.tap.note);
        return pickOr('water', '고른 물');
      }
      case 'drink': {
        const d = find('drink', s);
        if (d === 'cider') return R(false, 2, RS.SLOT.drink.vals.cider.why, { tag: 'literal' });
        if (!d) {
          if (/\b(just water|water is fine|no|nothing|i am good|i am fine)\b/.test(s)) { if (C.drink != null && C.drink !== 'none') return R(false, 2, `카드와 달라요. 카드: ${RS.factKo('drink', C.drink)} · 들린 말: 물만.`, { tag: 'fact' }); return pass('물이면 된다는 말이 들렸어요.'); }
          if (find('water', s)) return R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → 물 말고 다른 마실 것을 권하는 말이에요. 들린 말은 물(still · sparkling)을 고르는 대답처럼 들려요.`);
          if (yesHeard) { if (C.drink === 'none') return R(false, 2, '카드와 달라요. 카드: 물만 · 들린 말: Yes.', { tag: 'fact' }); notes.push(RS.INTENT.drink.yn.need); return pass('마시겠다는 말이 들렸어요.'); }
          return keyMiss();
        }
        if (C.drink != null && d !== C.drink) return R(false, 2, `카드와 달라요. 카드: ${RS.factKo('drink', C.drink)} · 들린 말: ${RS.factKo('drink', d)}.`, { tag: 'fact' });
        if (d === 'soda' && /\b(sprite|7 up|seven up|7up)\b/.test(s)) notes.push('브랜드 이름도 통하는 곳이 많아요. 가게마다 파는 것이 다르니 일반 이름으로 → a lemon-lime soda.');
        if (!yesHeard) notes.push('권하는 말이라 Yes 없이 원하는 것만 말해도 돼요.');
        return pass('마실 것이 들렸고 카드와 맞아요.');
      }
      case 'ready': case 'order': {
        if (q.intent === 'ready' && /\b(few more minutes|more time|not yet|minute|moment|second)\b/.test(s)) { if (C.ready !== false && C.ready != null) return R(false, 2, '카드와 달라요. 카드: 주문할 준비 됨 · 들린 말: 아직 고르는 중.', { tag: 'fact' }); return pass('조금 더 시간을 달라는 말이 들렸어요.'); }
        if (/\bwait\b/.test(s) && q.intent === 'ready' && !find('dish', s)) { notes.push('Wait.만 하면 명령처럼 들릴 수 있어요 → Could we have a few more minutes, please?'); if (C.ready !== false && C.ready != null) return R(false, 2, '카드와 달라요. 카드: 주문할 준비 됨.', { tag: 'fact' }); return pass('기다려 달라는 말이 들렸어요.'); }
        const f = RS.parseOrder(raw, C);
        if (f.dish === 'risotto' && /\bspecial\b/.test(s) && !C.special) return R(false, 2, '오늘의 스페셜은 서버가 말하지 않았어요. 메뉴판의 음식을 골라요.', { tag: 'fact' });
        if (!f.dish) {
          if (q.intent === 'ready' && yesHeard) { notes.push(RS.INTENT.ready.yn.need); if (C.ready === false) return R(false, 2, '카드와 달라요. 카드: 아직 고르는 중.', { tag: 'fact' }); return pass('준비됐다는 말이 들렸어요.'); }
          if (q.intent === 'order' && bare) return R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' });
          return R(false, 1, `${shapeHead(q)}. 들린 말에 음식 이름이 없어요.`);
        }
        for (const k of Object.keys(f)) if (C[k] !== undefined && C[k] !== f[k] && !(k === 'allergy' && C.allergy === 'none')) return R(false, 2, `카드와 달라요. 카드: ${RS.factKo(k, C[k])} · 들린 말: ${RS.factKo(k, f[k])}.`, { tag: 'fact' });
        if (f.allergy && C.allergy === 'none') return R(false, 2, `카드와 달라요. 카드: 알레르기 없음 · 들린 말: ${RS.factKo('allergy', f.allergy)}.`, { tag: 'fact' });
        if (f.cook === 'middle') return R(false, 2, RS.SLOT.cook.vals.middle.why, { tag: 'literal' });
        if (f.dish === 'risotto' && /\bspecial\b/.test(s)) notes.push('the special이라고 해도 돼요.');
        const cov = RS.coveredBy(f, q.intent).filter(i => !(i === 'cook' && f.dish !== 'steak') && !(i === 'spice' && f.dish !== 'noodles'));
        const ck = RS.coveredKo(cov);
        return pass('음식 이름이 들렸고 카드와 맞아요.' + (ck.length ? ` 한 줄에 ${ck.join(' · ')}까지 말했어요.` : ''), cov);
      }
      case 'cook': {
        const v = find('cook', s);
        if (v === 'middle') return R(false, 2, RS.SLOT.cook.vals.middle.why, { tag: 'literal' });
        if (!v) return keyMiss();
        if (C.cook != null && v !== C.cook) return R(false, 2, `카드와 달라요. 카드: ${RS.factKo('cook', C.cook)} · 들린 말: ${RS.factKo('cook', v)}.`, { tag: 'fact' });
        return pass('굽기가 들렸고 카드와 맞아요.');
      }
      case 'starter': return pickOr('starter', '고른 것');
      case 'dressing': {
        const v = find('dressing', s);
        if (!v) { if (find('starter', s)) return R(false, 1, `${shapeHead(q)}. 들린 말은 수프 · 샐러드를 고르는 대답처럼 들려요 → Italian, please.`); return keyMiss(); }
        if (C.dressing != null && v !== C.dressing) return R(false, 2, `카드와 달라요. 카드: ${RS.factKo('dressing', C.dressing)} · 들린 말: ${RS.factKo('dressing', v)}.`, { tag: 'fact' });
        if (/\bon the side\b/.test(s)) notes.push('on the side → 드레싱을 따로 달라는 말이에요.');
        return pass('드레싱이 들렸고 카드와 맞아요.');
      }
      case 'spice': return pickOr('spice', '고른 맵기');
      case 'allergy': {
        const a = find('allergen', s);
        if (a && !/\b(allergic|allergy|allergies)\b/.test(s) && /\bi have\b/.test(s)) return R(false, 2, RS.FRAME.al_lit.why, { tag: 'literal' });
        if (!a) {
          if (noHeard || /\b(none|nothing|no allergies)\b/.test(s)) { if (C.allergy != null && C.allergy !== 'none') return R(false, 2, `카드와 달라요. 카드: ${RS.factKo('allergy', C.allergy)} · 들린 말: 알레르기 없음.`, { tag: 'fact' }); return pass('알레르기가 없다는 말이 들렸어요.'); }
          if (yesHeard) return R(false, 2, RS.INTENT.allergy.yn.strict, { tag: 'need' });
          return keyMiss();
        }
        if (C.allergy != null && a !== C.allergy) return R(false, 2, `카드와 달라요. 카드: ${RS.factKo('allergy', C.allergy)} · 들린 말: ${RS.factKo('allergy', a)}.`, { tag: 'fact' });
        return pass('알레르기 성분이 들렸고 카드와 맞아요.');
      }
      case 'anyq': {
        const a = find('allergen', s), d = find('dish', s) || find('starter', s);
        if (/\b(does|is there|are there|have)\b/.test(s) && (a || d)) return pass('메뉴에 대해 묻는 말이 들렸어요. 서버가 메뉴를 보고 알려 줄 거예요.');
        if (noHeard && !C.ask) return pass('물어볼 것이 없다는 말이 들렸어요.');
        return keyMiss();
      }
      case 'safe': {
        if (noHeard && !yesHeard) return R(false, 2, '카드와 달라요. 빼고 만들면 먹을 수 있어요. 이 대답은 거절하는 말로 들려요.', { tag: 'fact' });
        if (!/\b(yes|yeah|please|great|perfect|okay|ok|thank|fine|sure|sounds good|that would be)\b/.test(s)) return keyMiss();
        return pass('빼고 만들어도 괜찮다는 말이 들렸어요.');
      }
      case 'dishcome': {
        const notMine = /\b(not what i ordered|did not order|ordered the|i ordered|wrong|not mine|is not mine|mistake)\b/.test(s);
        if (!notMine) {
          if (!/\b(thank|thanks|great|looks good|looks great|perfect|wonderful)\b/.test(s)) return bare ? R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${RS.sayOf(q.intent)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
          if (C.dishOk === false) return R(false, 2, `카드와 달라요. 나온 음식: ${RS.factKo('dish', C.served)} · 내가 시킨 것: ${RS.factKo('dish', C.dish)}. 그냥 받으면 다른 사람 음식을 먹게 돼요.`, { tag: 'fact' });
          return pass('고맙다는 말이 들렸어요.');
        }
        if (C.dishOk === true) return R(false, 2, `카드와 달라요. 나온 음식(${RS.factKo('dish', C.served || C.dish)})이 내가 시킨 것이에요.`, { tag: 'fact' });
        const f = RS.parseOrder(raw.replace(/this is (not )?the [a-z ]+/i, ''), C);
        if (f.dish && f.dish !== C.dish) return R(false, 2, f.dish === C.served ? `지금 나온 음식(${RS.factKo('dish', C.served)})을 말했어요. 내가 시킨 음식 → ${RS.factKo('dish', C.dish)}.` : `카드와 달라요. 카드: ${RS.factKo('dish', C.dish)} · 들린 말: ${RS.factKo('dish', f.dish)}.`, { tag: 'fact' });
        if (/\b(this is wrong|take it back)\b/.test(s) && !/\bexcuse me\b/.test(s)) notes.push('This is wrong! · Take it back.은 따지는 말처럼 들릴 수 있어요(말로 한 대답은 말투를 판정하지 않아요).');
        if (!f.dish) notes.push('무엇을 시켰는지까지 말하면 바로 바꿔 줘요 → I ordered the ' + RS.MENU[C.dish].en.toLowerCase() + '.');
        return pass('내가 시킨 음식이 아니라는 말이 들렸어요.' + (f.dish ? ' 시킨 음식 이름도 맞아요.' : ''));
      }
      case 'how': {
        if (!/\b(great|good|delicious|fine|wonderful|amazing|excellent|perfect|lovely|tasty|nice)\b/.test(s)) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        const n = RS.needOf(raw);
        return pass('어떤지 말하는 대답이 들렸어요.' + (n.length ? ' 부탁도 들렸어요.' : ''));
      }
      case 'call': case 'need': case 'more': {
        if (q.intent === 'call') {
          const rude = /\b(hey|waiter|waitress)\b/.test(s) || /^ ?here ?$/.test(s) || /\bhere here\b/.test(s);
          if (rude) notes.push('Hey! · Waiter! · Here!는 무례하게 들려요(말로 한 대답은 말투를 판정하지 않아요). 부를 때는 → Excuse me.');
          if (!/\b(excuse me|hey|waiter|waitress|here|hello|hi|sorry)\b/.test(s) && !RS.needOf(raw).length) return keyMiss();
        }
        const n = RS.needOf(raw), want = [C.need, C.need2].filter(Boolean);
        if (q.intent === 'more' && !n.length) {
          if (/\b(no|nothing|that is all|that is it|i am good)\b/.test(s)) { if (C.need2) return R(false, 2, `카드와 달라요. 카드: ${RS.factKo('need', C.need2)}도 필요해요.`, { tag: 'fact' }); return pass('더 필요한 것이 없다는 말이 들렸어요.'); }
          return keyMiss();
        }
        if (!n.length) { if (q.intent === 'call') return pass('서버를 부르는 말이 들렸어요. 서버가 와서 무엇이 필요한지 물을 거예요.', ['call']); return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss(); }
        const bad = n.find(x => want.length && !want.includes(x));
        if (bad) return R(false, 2, `카드와 달라요. 카드: ${want.map(x => RS.factKo('need', x)).join(' · ')} · 들린 말: ${RS.factKo('need', bad)}.`, { tag: 'fact' });
        const cov = q.intent === 'call' ? ['call', 'need'] : [q.intent];
        if (q.intent !== 'more' && want.length > 1 && want.every(x => n.includes(x))) cov.push('more');
        return pass(`필요한 것이 들렸고 카드와 맞아요.${cov.includes('more') ? ' 두 가지를 한 번에 말했어요.' : ''}`, cov);
      }
      case 'done': {
        const box = /\b(box|to go|take out|takeout|take this home|take it home|wrap|doggy bag|container)\b/.test(s);
        if (/\bpacking\b/.test(s) && !box) return R(false, 2, RS.FRAME.dn_pack.why, { tag: 'literal' });
        if (/\b(still eating|still working|not done|not finished|not yet)\b/.test(s)) return R(false, 2, '카드와 달라요. 카드: 다 먹었어요.', { tag: 'fact' });
        if (box) { if (C.box === false) return R(false, 2, '카드와 달라요. 카드: 남은 음식 없음 · 들린 말: 싸 가기.', { tag: 'fact' }); if (/\btake ?out\b/.test(s)) notes.push(RS.FRAME.dn_takeout.note); return pass('다 먹었고 남은 음식을 싸 간다는 말이 들렸어요.'); }
        if (/\b(no|done|finished|all done)\b/.test(s)) { if (C.box) return R(false, 2, '카드와 달라요. 카드: 남은 음식을 싸 가요. 그냥 다 먹었다고만 하면 서버가 접시를 치울 수도 있어요 → Could I get a box for this?', { tag: 'fact' }); return pass('다 먹었다는 말이 들렸어요.'); }
        return keyMiss();
      }
      case 'dessert': {
        const d = find('dessert', s), chk = /\b(check|bill)\b/.test(s);
        if (/\bcalculate\b/.test(s)) return R(false, 2, RS.FRAME.ds_calc.why, { tag: 'literal' });
        if (d) { if (C.dessert != null && d !== C.dessert) return R(false, 2, `카드와 달라요. 카드: ${RS.factKo('dessert', C.dessert)} · 들린 말: ${RS.factKo('dessert', d)}.`, { tag: 'fact' }); return pass('디저트가 들렸고 카드와 맞아요.'); }
        if (noHeard || chk || /\b(full|i am good)\b/.test(s)) { if (C.dessert != null && C.dessert !== 'none') return R(false, 2, `카드와 달라요. 카드: ${RS.factKo('dessert', C.dessert)} · 들린 말: 디저트 안 먹음.`, { tag: 'fact' }); return pass('디저트는 괜찮다는 말이 들렸어요.' + (chk ? ' 계산서도 부탁했어요.' : ''), chk ? ['dessert', 'checkreq'] : ['dessert']); }
        if (yesHeard) { if (C.dessert === 'none') return R(false, 2, '카드와 달라요. 카드: 디저트 안 먹음.', { tag: 'fact' }); notes.push(RS.INTENT.dessert.yn.need); return pass('먹겠다는 말이 들렸어요.'); }
        return keyMiss();
      }
      case 'checkreq': {
        if (/\bcalculate\b/.test(s)) return R(false, 2, RS.FRAME.cr_calc.why, { tag: 'literal' });
        if (/\b(check|bill)\b/.test(s)) { if (/\bbill\b/.test(s)) notes.push(RS.FRAME.cr_bill.note); return pass('계산서를 부탁하는 말이 들렸어요.'); }
        if (find('paym', s) || find('pay', s)) return R(false, 1, `${shapeHead(q)}. 들린 말은 내는 방법 · 나눠 내기를 고르는 대답처럼 들려요. 먼저 계산서를 부탁해요 → Just the check, please.`);
        if (noHeard) { notes.push(RS.INTENT.checkreq.yn.need); return pass('더 필요한 것이 없다는 말이 들렸어요.'); }
        return keyMiss();
      }
      case 'split': {
        if (/\bdutch\b/.test(s)) return R(false, 2, RS.FRAME.sp_dutch.why, { tag: 'literal' });
        const r = pickOr('pay', '고른 것');
        if (r.ok && EVEN_RE.test(s)) r.covered = ['split', 'even'];
        return r;
      }
      case 'even': {
        const ev = EVEN_RE.test(s), no = (noHeard && !yesHeard) || /\b(separate checks?|by item|separately)\b/.test(s);
        if (!yesHeard && !ev && !no && find('paym', s)) return R(false, 1, `${shapeHead(q)}. 들린 말은 다른 질문의 대답처럼 들려요 → ${It.want}`);
        if (no && !ev) return C.pay === 'separate' ? R(false, 2, '카드와 달라요. 카드: 똑같이 나눠 내기 · 들린 말: 똑같이 나누지 않음.', { tag: 'fact' }) : pass('똑같이 나누지 않는다는 말이 들렸어요.');
        if (!(yesHeard || ev || /\b(please|great|perfect|thank|thanks|fine|sounds good)\b/.test(s))) return keyMiss();
        return pass('똑같이 나눠 달라는 말이 들렸어요.');
      }
      case 'pay': {
        if (/\bcalculate\b/.test(s)) notes.push(RS.FRAME.pm_calc.why);
        if (/\bcalculate\b/.test(s) && find('paym', s)) return R(false, 2, RS.FRAME.pm_calc.why, { tag: 'literal' });
        return pickOr('paym', '내는 방법');
      }
      default: return R(false, 0, '이 말은 말로 대답하기를 지원하지 않아요.');
    }
  };

  /* ---------- 따라 말하기: 낱말 맞춰 보기 (가장 긴 공통 부분열, 숫자는 같은 숫자로) ---------- */
  RS.compareWords = function (target, heard) {
    const tw = String(target).split(/\s+/).filter(Boolean), tt = [];
    tw.forEach((x, i) => RS.canon(x).forEach(p => tt.push({ p, i })));
    const A = tt.map(x => x.p), B = RS.canon(heard), D = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) D[i][j] = A[i] === B[j] ? D[i + 1][j + 1] + 1 : Math.max(D[i + 1][j], D[i][j + 1]);
    const got = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { got.add(i); i++; j++; } else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++; }
    const okW = tw.map((_, k) => { const parts = tt.map((x, n) => [x, n]).filter(([x]) => x.i === k); return parts.length ? parts.every(([, n]) => got.has(n)) : true; });
    return { words: tw.map((t, k) => ({ t, ok: okW[k] })), hit: okW.filter(Boolean).length, total: tw.length };
  };

  /* =========================================================
     식사 카드 (식당 시뮬레이터)
     ========================================================= */
  RS.WAITS = { 15: [50, 5], 30: [13, 3], 40: [14, 4] };   // 기다리는 분 → 헷갈리기 쉬운 이웃 값 (fifteen · fifty …)
  RS.RESV_TIMES = ['6:30', '7:00', '7:30', '8:15'];
  RS.SIM_NEEDS = ['water', 'plate', 'napkins', 'fork'];
  RS.newCard = function (rnd = Math.random) {
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const resv = rnd() < 0.5, party = 1 + Math.floor(rnd() * 4), special = rnd() < 0.55;
    const allergy = rnd() < 0.35 ? 'none' : pick(Object.keys(RS.ALLERGENS));
    // 카드의 음식은 알레르기에 안전하거나(들어 있지 않음) 뺄 수 있는 것만
    const okDish = d => { const st = RS.hasStarter(d); return [st ? ['soup', 'salad'] : [null]].flat().some(s => { const s0 = RS.safe([d, s].filter(Boolean), allergy); return !s0.contains || s0.removable; }); };
    const pool = RS.MAINS.concat(special ? ['risotto'] : []).filter(okDish);
    const dish = pick(pool);
    const c = { name: pick(Object.keys(RS.NAMES)), first: pick(Object.keys(RS.FIRST)), resv, party, time: resv ? pick(RS.RESV_TIMES) : null, special,
      seat: pick(['inside', 'outside']), water: pick(['still', 'sparkling']), drink: rnd() < 0.4 ? 'none' : pick(['lemonade', 'soda', 'icedtea']), dish, allergy,
      ready: true, waitOk: true, box: rnd() < 0.5, dessert: rnd() < 0.5 ? 'none' : pick(['cake', 'sorbet']), paym: pick(['card', 'cash']) };
    if (dish === 'steak') c.cook = pick(['rare', 'mediumrare', 'medium', 'mediumwell', 'welldone']);
    if (dish === 'noodles') c.spice = pick(['mild', 'spicy']);
    if (RS.hasStarter(dish)) {
      const st = ['soup', 'salad'].filter(s => { const s0 = RS.safe([dish, s], allergy); return !s0.contains || s0.removable; });
      c.starter = pick(st);
      if (c.starter === 'salad') c.dressing = pick(['ranch', 'italian', 'balsamic'].filter(d => !RS.safe([d], allergy).contains));
    }
    if (c.dessert === 'cake' && RS.safe('cake', allergy).contains) c.dessert = 'sorbet';
    const needs = RS.SIM_NEEDS.slice(); const n1 = pick(needs); c.need = n1;
    if (rnd() < 0.5) c.need2 = pick(needs.filter(x => x !== n1)); else c.need2 = null;
    c.pay = party > 1 ? pick(['together', 'separate']) : 'together';
    // 함께 온 사람의 주 요리 (나눠 내면 한 사람 몫이 센트까지 똑같이 나뉘게)
    for (let k = 0; k < 60; k++) {
      c.others = Array.from({ length: party - 1 }, () => pick(RS.MAINS));
      if (RS.bill(c).total % party === 0) break;
    }
    if (RS.bill(c).total % party !== 0) { c.others = Array.from({ length: party - 1 }, () => c.dish === 'risotto' ? 'salmon' : c.dish); }
    if (RS.bill(c).total % party !== 0) { c.drink = 'none'; }
    if (RS.bill(c).total % party !== 0) { c.party = 2; c.others = [c.others[0] || 'salmon']; }
    c.wait = resv ? null : pick(Object.keys(RS.WAITS).map(Number));
    c.dishOk = rnd() < 0.5;
    c.served = c.dishOk ? c.dish : pick(RS.MAINS.filter(d => d !== c.dish));
    return c;
  };
  // 서버가 묻는 차례 (이미 답한 질문은 건너뜀)
  RS.simQs = function (c) {
    const qs = ['d_resv'];
    if (c.resv) qs.push('d_name'); else qs.push('d_many', 'd_wait');
    qs.push('d_seat', 'dk_water', 'dk_more', 'or_ready');
    if (c.dish === 'steak') qs.push('or_cook');
    if (RS.hasStarter(c.dish)) { qs.push('or_side'); if (c.starter === 'salad') qs.push('or_dress'); }
    if (c.dish === 'noodles') qs.push('or_spice');
    qs.push('al_any');
    if (c.allergy !== 'none' && RS.safe(RS.plate(c), c.allergy).contains) qs.push('al_safe');
    qs.push('ml_dish', 'ml_how', 'ml_pass', 'ml_what');
    if (c.need2) qs.push('ml_more');
    qs.push('ds_done', 'ds_offer', 'ck_else');
    if (c.party > 1) { qs.push('ck_split'); if (c.pay === 'separate') qs.push('ck_even'); }
    qs.push('ck_pay');
    return qs;
  };
  // 카드에 따라 바뀌는 말 (기다리는 시간 · 스페셜 · 알레르기 대답 · 나온 음식 · 값)
  RS.simQ = function (id, c) {
    const q = RS.Q[id];
    if (id === 'd_wait') return Object.assign({}, q, { en: `It'll be about a ${numWord(c.wait)}-minute wait. Is that okay?`, ko: `${c.wait}분쯤 기다리셔야 해요. 괜찮으세요?`, fact: { wait: c.wait } });
    if (id === 'or_ready' && c.special) return Object.assign({}, q, { en: 'Tonight\'s special is the mushroom risotto. Are you ready to order?', ko: '오늘의 스페셜은 버섯 리소토예요. 주문하시겠어요?' });
    if (id === 'or_cook' || id === 'or_side' || id === 'or_dress' || id === 'or_spice') return q;
    if (id === 'al_safe') { const r = RS.safeReply(RS.plate(c), c.allergy); return Object.assign({}, q, { en: r.en, ko: r.ko, key: ['without'], fact: { part: r.s.part } }); }
    if (id === 'ml_dish') { const m = RS.MENU[c.served]; return Object.assign({}, q, { en: `Here's your ${m.en.toLowerCase()}. Enjoy!`, ko: `${m.ko} 나왔습니다. 맛있게 드세요!`, fact: { served: c.served, dishOk: c.served === c.dish } }); }
    if (id === 'ml_pass' || id === 'ml_what') return Object.assign({}, q, { fact: { need: c.needFirst || c.need } });
    if (id === 'ml_more') return Object.assign({}, q, { fact: { need: c.needFirst === c.need2 ? c.need : c.need2, need2: c.needFirst === c.need2 ? c.need : c.need2 } });
    if (id === 'ck_pay') {
      const B = RS.bill(c), each = c.party > 1 && c.pay === 'separate', amt = each ? RS.split(B, c.party).each : B.total;
      return Object.assign({}, q, { en: each ? `Here's your check. That's ${RS.money(amt)} each. Card or cash?` : `Here's your check. Your total is ${RS.money(amt)}. Card or cash?`, ko: each ? `계산서 여기 있어요. 한 분에 ${RS.priceKo(amt)}예요. 카드로 하시겠어요, 현금으로 하시겠어요?` : `계산서 여기 있어요. 합계는 ${RS.priceKo(amt)}예요. 카드로 하시겠어요, 현금으로 하시겠어요?`, fact: { amount: amt }, total: B.total, each });
    }
    return q;
  };
  RS.PLACE_OF = id => RS.Q[id].place;
  // 질문마다 틀 칩: 맞는 틀 · 한국어 그대로(콩글리시 · 무례한 말 · Yes만) 틀 · 다른 질문의 틀
  RS.SIM_FRAMES = {
    resv: c => c.resv ? ['rs_under', 'rs_no', 'ps_n'] : ['rs_no', 'rs_under', 'st_pl'],
    name: ['nm_its', 'g_yes', 'ps_n'],
    party: ['ps_n', 'g_yes', 'st_pl'],
    wait: ['wt_ok', 'wt_long', 'ps_n'],
    seat: ['st_pl', 'g_yesp', 'ps_n'],
    water: ['wa_pl', 'g_yesp', 'st_pl'],
    drink: c => c.drink === 'none' ? ['dk_none', 'dk_plain', 'wa_pl'] : ['dk_could', 'dk_give', 'wa_pl'],
    ready: ['or_have', 'or_give', 'cook_pl'],
    cook: ['cook_pl', 'g_yesp', 'wa_pl'],
    starter: ['sd_pl', 'g_yesp', 'cook_pl'],
    dressing: ['dr_pl', 'g_yesp', 'sd_pl'],
    spice: ['spc_pl', 'g_yes', 'cook_pl'],
    allergy: c => c.allergy === 'none' ? ['al_no', 'al_lit', 'or_have'] : ['al_yes', 'al_lit', 'or_have'],
    safe: ['sf_ok', 'g_no', 'cook_pl'],
    dishcome: c => c.dishOk ? ['dc_ty', 'dc_wrong', 'g_yes'] : ['dc_not', 'dc_wrong', 'dc_ty'],
    how: ['hw_great', 'g_yes', 'cr_just'],
    call: ['cl_ex', 'cl_hey', 'cl_here'],
    need: ['rq_could', 'rq_give', 'g_yes'],
    more: ['rq_could', 'rq_give', 'mr_no'],
    done: c => c.box ? ['dn_box', 'dn_pack', 'dk_none'] : ['dn_fin', 'dn_pack', 'wa_pl'],
    dessert: c => c.dessert === 'none' ? ['ds_no', 'ds_calc', 'st_pl'] : ['ds_could', 'ds_give', 'ds_no'],
    checkreq: ['cr_could', 'cr_calc', 'pm_pl'],
    split: ['sp_pl', 'sp_dutch', 'pm_pl'],
    even: ['g_yesp', 'g_no', 'pm_pl'],
    pay: ['pm_pl', 'pm_calc', 'sp_pl'],
  };
  RS.simFrames = (intent, c) => { const x = RS.SIM_FRAMES[intent]; return typeof x === 'function' ? x(c) : x ? x.slice() : null; };
  // 서버를 부를 때 붙이는 부탁 칩: 맞는 부탁(카드의 부탁 칸) · 명령 · 부탁 없이
  RS.callReqs = () => [{ f: 'rq_could' }, { f: 'rq_give' }, null];
  // 칸 칩: 카드의 값 + 다른 값 둘 (기다리는 분 · 값은 헷갈리기 쉬운 이웃 값)
  RS.slotChoices = function (slot, card, rnd = Math.random) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let out;
    if (slot === 'mins') out = [card.wait].concat(RS.WAITS[card.wait] || []).map(String);
    else if (slot === 'money') { const a = card.amount; out = [a, a + 900, Math.round(a / 10) * 10 === a ? a - 1000 : a + 10].filter(x => x > 0).map(String); }
    else if (slot === 'party') out = ['p' + card.party, 'p' + (card.party === 4 ? 3 : card.party + 1), 'p' + (card.party === 1 ? 3 : card.party - 1)];
    else if (slot === 'name') out = [card.name].concat(shuffle(Object.keys(RS.NAMES).filter(n => n !== card.name)).slice(0, 2));
    else if (slot === 'dish') { const right = card.dish; out = [right].concat(card.served && card.served !== right ? [card.served] : []).concat(shuffle(RS.MAINS.concat(card.special ? ['risotto'] : []).filter(d => d !== right && d !== card.served))).slice(0, 3); }
    else if (slot === 'drink') { const r = card.drink && card.drink !== 'none' ? card.drink : 'lemonade'; out = [r].concat(r === 'soda' ? ['cider'] : []).concat(shuffle(['lemonade', 'soda', 'icedtea'].filter(x => x !== r))).slice(0, 3); }
    else if (slot === 'cook') { const r = card.cook || 'medium', o = ['rare', 'mediumrare', 'medium', 'mediumwell', 'welldone'], i = o.indexOf(r); out = [r, o[i === 4 ? 3 : i + 1], o[i <= 1 ? 4 : 0]]; }
    else if (slot === 'starter') out = ['soup', 'salad', 'fries'];
    else if (slot === 'need') { const want = [card.need, card.need2].filter((x, i, a) => x && a.indexOf(x) === i); out = want.concat(shuffle(RS.SIM_NEEDS.filter(x => !want.includes(x)))).slice(0, 3); }
    else if (slot === 'part') out = ['walnuts', 'cheese', 'shrimp'];
    else {
      const right = RS.slotVal(slot, card), keys = shuffle(slotIds(slot).filter(k => k !== right));
      out = (right ? [right] : []).concat(keys.slice(0, right ? 2 : 3));
    }
    return shuffle(out.filter((x, i, a) => x != null && a.indexOf(x) === i));
  };
  RS.dishKo = c => {
    const m = RS.MENU[c.dish], parts = [];
    if (c.cook) parts.push(RS.SLOT.cook.vals[c.cook].ko);
    if (c.spice) parts.push(RS.SLOT.spice.vals[c.spice].ko);
    if (c.starter) parts.push(c.starter === 'salad' ? `샐러드(${RS.SLOT.dressing.vals[c.dressing].ko} 드레싱)` : '수프');
    return `${c.dish === 'risotto' ? '오늘의 스페셜 (서버가 이름을 말해 줘요)' : m.ko}${parts.length ? ' · ' + parts.join(' · ') : ''}`;
  };
  RS.cardRows = c => [
    ['예약', c.resv ? `있음 · ${RS.NAMES[c.name]}${RS.FIRST[c.first] || ''} (${c.name}) · ${RS.timeKo(c.time)}` : `없음 · ${RS.NAMES[c.name]}${RS.FIRST[c.first] || ''} (${c.first} ${c.name})`],
    ['인원 · 자리', `${c.party}명 · ${c.seat === 'inside' ? '안쪽' : '바깥'} 자리`],
    ['물 · 음료', `${c.water === 'still' ? '그냥 물(still)' : '탄산수(sparkling)'} · ${c.drink === 'none' ? '다른 음료 없음' : RS.MENU[c.drink].ko}`],
    ['주문', RS.dishKo(c)],
    ['알레르기', c.allergy === 'none' ? '없음' : `${RS.ALLERGENS[c.allergy].ko}`],
    ['식사 중 부탁', [c.need, c.need2].filter(Boolean).map(x => RS.SLOT.need.vals[x].ko).join(' · ')],
    ['남은 음식', c.box ? '싸 가기' : '없음'],
    ['디저트', c.dessert === 'none' ? '안 먹음 · 바로 계산' : RS.MENU[c.dessert].ko],
    ['계산', `${c.party > 1 ? (c.pay === 'separate' ? `${c.party}명이 똑같이 나눠 내기 · ` : '함께 내기 · ') : ''}${c.paym === 'card' ? '카드' : '현금'}`],
  ];
  // 서버의 반응 (단계별)
  const BAD_REACT = { cider: 'Cider? Just so you know, our cider is an apple drink with alcohol in it.', middle: 'Sorry — rare, medium, or well-done?', packing: 'Sorry, packing?', calculate: 'Sorry? Calculate…?', dutch: 'Sorry, Dutch…?', allergy: 'Sorry — you have peanuts with you?', wrong: 'Sorry?' };
  RS.REACT = {
    ok: ['Sure.', 'Of course.', 'Great.', 'Perfect.', 'You got it.'],
    1: q => ({ en: `Sorry — ${q.short && /\?$/.test(q.short) ? q.short : (String(q.en).match(/[^.!?]*\?/g) || [q.en]).pop().trim()}`, ko: q.shape === 'or' || q.shape === 'wh' ? `${RS.SHAPE[q.shape].ko} → ${RS.SHAPE[q.shape].ans}` : `‘${q.key.join(' … ')}’를 말했어요.` }),
    2: (q, j, a) => {
      const F = a && RS.FRAME[a.f], sv = F && F.slot ? RS.sv(F.slot, a.v) : null;
      if (sv && sv.bad && a.v === 'cider') return { en: BAD_REACT.cider, ko: '사이다 → a lemon-lime soda.' };
      if (sv && sv.bad && a.v === 'middle') return { en: BAD_REACT.middle, ko: '굽기 → medium.' };
      if (F && F.id === 'dn_pack') return { en: BAD_REACT.packing, ko: '남은 음식 → Could I get a box for this?' };
      if (F && /calc/.test(F.id)) return { en: BAD_REACT.calculate, ko: '계산서 → the check.' };
      if (F && F.id === 'sp_dutch') return { en: BAD_REACT.dutch, ko: '나눠 내기 → Separate, please.' };
      if (F && F.id === 'al_lit') return { en: BAD_REACT.allergy, ko: '알레르기 → I\'m allergic to ….' };
      if (j.tag === 'fact') return { en: 'Hmm, are you sure?', ko: '식사 카드(또는 서버가 한 말)를 다시 보세요.' };
      if (j.tag === 'need') return { en: 'What are you allergic to?', ko: '무엇에 알레르기가 있는지 말해요.' };
      if (j.tag === 'order') return { en: 'Sorry, could you say that again?', ko: '순서가 어색해 알아듣기 어려워요.' };
      return { en: 'Sorry?', ko: '알아듣기 어려운 말이에요.' };
    },
    3: (q, j, a) => ({ en: q.intent === 'call' ? '(The server looks surprised.) ... Yes?' : '... Okay.', ko: q.intent === 'call' ? '불렀지만 무례하게 들렸어요.' : '뜻은 통했지만 말투가 거칠어요.' }),
  };
  // 대답 뒤 서버가 덧붙이는 말 (다음 질문 앞)
  RS.reply = function (q, a, C) {
    const f = a ? RS.factOf(a, q) : {};
    switch (q.intent) {
      case 'resv': return C.resv ? 'Great.' : 'No problem.';
      case 'name': return `Right, ${C.name}, a table for ${PARTY_W[C.party] || 'two'}${C.time ? ` at ${RS.timeWords(C.time)}` : ''}.`;
      case 'wait': return 'Thank you for waiting. Your table is ready.';
      case 'seat': return 'Right this way, please.';
      case 'water': return 'Great.';
      case 'drink': return C.drink === 'none' ? 'Sure, I\'ll be right back with your water.' : 'Sure, I\'ll bring that right out.';
      case 'ready': case 'order': return 'Great choice.';
      case 'cook': return 'Perfect.';
      case 'dressing': case 'starter': case 'spice': return 'Got it.';
      case 'allergy': {
        if (C.allergy === 'none') return 'Great.';
        const r = RS.safeReply(RS.plate(C), C.allergy);
        return r.s.contains ? null : r.en;
      }
      case 'safe': return 'No problem. I\'ll let the kitchen know.';
      case 'dishcome': return C.dishOk === false ? `Oh, I'm so sorry! I'll bring your ${RS.MENU[C.dish].en.toLowerCase()} right away.` : 'Enjoy your meal!';
      case 'how': return 'Glad to hear it.';
      case 'call': return f.need ? 'Sure, I\'ll bring that right away.' : null;
      case 'need': case 'more': return f.need || f.need2 ? 'Sure, I\'ll bring that right away.' : 'Sure.';
      case 'done': return C.box ? 'Of course. I\'ll bring a box.' : 'I\'ll take that for you.';
      case 'dessert': return C.dessert === 'none' ? 'Sure.' : 'Great choice. I\'ll bring it right out.';
      case 'checkreq': return 'Sure, I\'ll be right back with your check.';
      case 'split': return f.even ? 'No problem. I\'ll split it evenly.' : C.pay === 'separate' ? null : 'Sure.';
      case 'even': return 'No problem. I\'ll split it evenly.';
      default: return null;
    }
  };

  /* =========================================================
     듣고 대답 고르기 16문제 (모두 새로 만든 대화). card = 그 상황의 사실
     ========================================================= */
  const o = (f, v, req) => { const a = { f }; if (v != null) a.v = String(v); if (req) a.req = req; return a; };
  const L = words => ({ f: 'line', line: { words } });
  RS.o = o; RS.L = L;
  RS.DRILL = [
    { q: 'd_resv', sit: '박(Park)이라는 이름으로 예약해 두었어요.', card: { resv: true, name: 'Park' }, a: 2, opts: [o('rs_under', 'Lee'), o('st_pl', 'inside'), o('rs_under', 'Park'), o('rs_no')] },
    { q: 'd_many', sit: '예약 없이 친구와 둘이 왔어요.', card: { party: 2 }, a: 1, opts: [o('g_yesp'), o('ps_n', 'p2'), o('ps_n', 'p3'), o('st_pl', 'outside')] },
    { q: 'd_fast', sit: '호스트가 아주 빠르게 말했어요. ‘… minute wait …’만 들렸어요.', card: {}, a: 0, opts: [o('rp_wait'), o('wt_ok'), o('rp_water'), o('ps_n', 'p2')] },
    { q: 'dk_water', sit: '탄산이 없는 그냥 물을 마시고 싶어요.', card: { water: 'still' }, a: 3, opts: [o('g_yesp'), o('wa_pl', 'sparkling'), o('st_pl', 'inside'), o('wa_pl', 'still')] },
    { q: 'dk_more', sit: '사이다(레몬 라임 탄산음료)를 마시고 싶어요.', card: { drink: 'soda' }, a: 1, opts: [o('dk_short', 'cider'), o('dk_could', 'soda'), o('dk_give', 'soda'), o('wa_pl', 'still')] },
    { q: 'or_ready', sit: '메뉴를 아직 다 못 골랐어요.', card: { ready: false }, a: 2, opts: [o('or_have', 'steak'), o('rd_wait'), o('rd_min'), o('cook_pl', 'medium')] },
    { q: 'or_cook', sit: '스테이크를 미디엄으로 먹고 싶어요.', card: { cook: 'medium' }, a: 3, opts: [o('g_yesp'), o('cook_pl', 'mediumwell'), o('cook_pl', 'middle'), o('cook_pl', 'medium')] },
    { q: 'or_side', sit: '주 요리에 딸린 것으로 수프를 먹고 싶어요.', card: { starter: 'soup' }, a: 0, opts: [o('sd_pl', 'soup'), o('g_yesp'), o('sd_pl', 'salad'), o('sd_pl', 'fries')] },
    { q: 'al_any', sit: '땅콩 알레르기가 있어요.', card: { allergy: 'peanuts' }, a: 2, opts: [o('al_lit', 'peanuts'), o('al_no'), o('al_yes', 'peanuts'), o('or_have', 'noodles')] },
    { q: 'ml_pass', sit: '물이 더 필요해요. 서버가 옆 테이블에 인사하며 지나가요.', card: { need: 'water' }, a: 1, opts: [o('cl_hey', null, o('rq_could', 'water')), o('cl_ex', null, o('rq_could', 'water')), o('cl_here', null, o('rq_could', 'water')), o('cl_ex', null, o('rq_could', 'plate'))] },
    { q: 'ml_how', sit: '음식이 아주 맛있어요.', card: {}, a: 3, opts: [o('g_yes'), o('hw_yesit'), o('cr_just'), o('hw_great')] },
    { q: 'ml_dish', sit: '구운 연어를 시켰는데, 음식을 나르는 직원이 다른 음식을 가져왔어요.', card: { dish: 'salmon', dishOk: false, served: 'noodles' }, served: 'noodles', a: 0, opts: [o('dc_not', 'salmon'), o('dc_ty'), o('dc_wrong'), o('dc_not', 'noodles')] },
    { q: 'ds_fast', sit: '서버가 아주 빠르게 말했어요. ‘… still …’만 들렸어요.', card: {}, a: 3, opts: [o('dn_box'), o('rp_water'), o('wa_pl', 'still'), o('rp_again')] },
    { q: 'ds_offer', sit: '디저트는 먹지 않고 이제 계산하고 싶어요.', card: { dessert: 'none' }, a: 0, opts: [o('ds_no'), o('ds_calc'), o('g_yesp'), o('ds_short', 'cake')] },
    { q: 'ck_else', sit: '디저트까지 다 먹었어요. 이제 계산서를 받고 싶어요.', card: {}, a: 1, opts: [o('cr_calc'), o('cr_could'), o('pm_pl', 'card'), o('rp_rude')] },
    { q: 'ck_split', sit: '친구와 따로 계산하고 싶어요.', card: { pay: 'separate' }, a: 2, opts: [o('sp_dutch'), o('g_yes'), o('sp_pl', 'separate'), o('sp_pl', 'together')] },
  ];
  RS.DRILL.forEach((it, i) => { it.n = i; it.Q = it.served ? RS.simQ('ml_dish', Object.assign({ dish: it.card.dish, served: it.served })) : RS.Q[it.q]; it.place = it.Q.place; });
  // 직접 해 보기의 짧은 문제 (00장 · 03장) — 연습 문제와 다른 상황
  RS.MINI = {
    intro: { q: 'dk_gb', sit: '영국의 식당이에요. 탄산수를 마시고 싶어요.', card: { water: 'sparkling' }, a: 2, opts: [o('g_yesp'), o('wa_pl', 'still'), o('wa_pl', 'sparkling'), o('dk_could', 'lemonade')] },
    wait: { q: 'd_wait', sit: '호스트가 기다리는 시간을 말했어요. 몇 분인지 확인하고 싶어요.', card: {}, a: 1, opts: [o('wt_check', '50'), o('wt_check', '15'), o('wt_long'), o('ps_n', 'p2')] },
  };
  Object.values(RS.MINI).forEach(it => { it.Q = RS.Q[it.q]; it.place = it.Q.place; });

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 대화 (연습 문제와 겹치지 않게 골랐어요)
     ========================================================= */
  // 03–07장의 식사: 박하늘 · 둘(예약 없음, 15분) · 바깥 자리 · 탄산수 · 레몬 라임 탄산음료 · 스테이크 미디엄 레어 + 샐러드(이탈리안) · 견과류 알레르기
  //                 · 물 더 + 앞접시 · 남은 음식 싸 가기 · 디저트 안 먹음 · 둘이 나눠 내기 · 카드 / 함께 온 사람: 구운 연어
  RS.DEMO = { name: 'Park', first: 'Haneul', resv: false, party: 2, wait: 15, seat: 'outside', water: 'sparkling', drink: 'soda', dish: 'steak', cook: 'mediumrare', starter: 'salad', dressing: 'italian', allergy: 'nuts', ready: true, waitOk: true,
    need: 'water', need2: 'plate', box: true, dessert: 'none', pay: 'separate', paym: 'card', others: ['salmon'], dishOk: false, served: 'salmon', special: false };
  // 00장: 고르는 질문에 Yes → 고른 것 + please
  RS.INTRO = { q: 'dk_water', lit: o('g_yes'), ok: o('wa_pl', 'sparkling'), card: { water: 'sparkling' } };
  RS.SCENE = {
    // 02장 질문의 모양
    shapes: [['or_ready', 'yn'], ['d_resv', 'yn'], ['d_seat', 'or'], ['or_side', 'or'], ['d_many', 'wh'], ['or_cook', 'wh']],
    offer: ['dk_offer', o('dk_just'), o('wa_pl', 'still')],
    orYes: ['or_side', o('g_yesp'), o('sd_pl', 'salad')],
    whYes: ['or_cook', o('g_yesp'), o('cook_pl', 'medium')],
    // 03장 입구와 자리
    resv: ['d_resv', o('rs_under', 'Park'), o('rs_no')],
    many: ['d_many', o('ps_n', 'p2'), o('ps_we', 'p2'), o('ps_table', 'p2')],
    wait: ['d_wait', o('wt_check', '15'), o('wt_ok')],
    seat: ['d_seat', o('g_yesp'), o('st_pl', 'outside')],
    // 04장 음료와 주문
    drink: ['dk_offer', o('dk_just')],
    water: ['dk_water', o('wa_pl', 'sparkling')],
    cider: [o('dk_short', 'cider'), o('dk_could', 'soda')],
    ready: ['or_ready', o('or_have', 'steak'), o('rd_min')],
    cook: ['or_cook', o('cook_pl', 'mediumrare')],
    blunt: [[o('mn_give'), o('mn_could')], [o('or_want', 'steak'), o('or_have0', 'steak')]],
    // 05장 알레르기와 요청
    allergy: ['al_any', o('al_yes', 'peanuts'), o('al_have', 'peanuts'), o('al_lit', 'peanuts')],
    ask2: o('sf_wo', 'walnuts'),
    ask: ['al_qs', o('aq_does', 'salad:nuts'), o('aq_lit', 'salad:nuts')],
    spicy: ['or_spice', o('spc_not')],
    side: ['or_dress', o('dr_side', 'italian')],
    // 06장 식사 중
    call: [o('cl_ex', null, o('rq_could', 'water')), o('cl_hey'), o('cl_waiter'), o('cl_here')],
    how: ['ml_how', o('g_yes'), o('hw_great')],
    reqs: [o('rq_could', 'water'), o('rq_we', 'plate')],
    dish: [o('dc_wrong'), o('dc_not', 'steak')],
    // 07장 디저트와 계산
    done: ['ds_done', o('dn_box'), o('dn_takeout')],
    dessert: ['ds_offer', o('ds_calc'), o('ds_no')],
    check: ['ck_else', o('cr_calc'), o('cr_could'), o('cr_bill')],
    split: ['ck_split', o('sp_dutch'), o('sp_pl', 'separate'), o('sp_split')],
    pay: o('pm_pl', 'card'),
  };
  // 08장: 한 줄 주문
  RS.LINE = { words: ['have', 'steak', 'mediumrare', 'salad', 'italian', 'please'] };
  RS.LINE_ALLERGY = { words: ['have', 'steak', 'mediumrare', 'salad', 'italian', 'nowalnuts', 'please', 'a_nuts'] };
  RS.LINE_BAD = { words: ['mediumrare', 'salad', 'have', 'steak', 'please'] };
  RS.SHORT = [['or_what', o('or_have0', 'steak')], ['or_cook', o('cook_pl', 'mediumrare')], ['or_side', o('sd_pl', 'salad')], ['or_dress', o('dr_pl', 'italian')]];
  // 08장 직접 해 보기 칩
  RS.LINE_CHIPS = { open: ['have', 'could', 'want'], dish: ['steak', 'salmon', 'noodles', 'burger'], how: ['rare', 'mediumrare', 'medium', 'welldone', 'mild', 'spicy'], with: ['soup', 'salad'], dress: ['ranch', 'italian', 'balsamic'], without: ['nowalnuts', 'nocheese', 'noshrimp'], please: ['please'], allergy: ['a_nuts', 'a_milk', 'a_peanuts'] };
  // 09장: 곳마다 한 줄 (3단계 적용)
  RS.METHOD = [
    ['d_many', o('ps_n', 'p2'), { party: 2 }],
    ['dk_water', o('wa_pl', 'sparkling'), { water: 'sparkling' }],
    ['or_cook', o('cook_pl', 'mediumrare'), { cook: 'mediumrare' }],
    ['al_any', o('al_yes', 'nuts'), { allergy: 'nuts' }],
    ['ml_pass', o('cl_ex', null, o('rq_could', 'water')), { need: 'water' }],
    ['ds_offer', o('ds_no'), { dessert: 'none' }],
    ['ck_split', o('sp_pl', 'separate'), { pay: 'separate' }],
  ];
  // 10장 실전: 식사 카드 하나로 넷 (보기 셋, 단계마다 지워짐)
  RS.PCARD = { name: 'Choi', first: 'Haneul', resv: true, time: '7:30', party: 2, seat: 'outside', water: 'still', drink: 'none', dish: 'steak', cook: 'mediumrare', starter: 'soup', allergy: 'none', ready: true, waitOk: true,
    need: 'napkins', need2: null, box: false, dessert: 'sorbet', pay: 'separate', paym: 'card', others: ['pasta'], dishOk: false, served: 'salmon', special: false };
  RS.PRACTICE = [
    { q: 'd_seat', opts: [o('g_yesp'), o('st_pl', 'inside'), o('st_pl', 'outside')], a: 2,
      lines: ['inside or outside → 고르는 질문 · (A) Yes, please → 고른 것이 없어 탈락', '(B) Inside → 카드는 바깥 자리라 탈락', '셋 모두 공손해요 · 정답 (C) Outside, please.'] },
    { q: 'or_cook', opts: [o('cook_pl', 'mediumrare'), o('g_yesp'), o('cook_pl', 'welldone')], a: 0,
      lines: ['How would you like → 정보 질문 · (B) Yes, please → 정보가 없어 탈락', '(C) Well-done → 카드는 미디엄 레어라 탈락', '굽기 + please → 정답 (A) Medium-rare, please.'] },
    { q: 'ml_dish', opts: [o('dc_ty'), o('dc_not', 'steak'), o('dc_wrong')], a: 1,
      lines: ['Here\'s your → 음식을 가져다주는 안내 · 셋 모두 음식에 대한 말이에요', '(A) Thank you → 다른 음식을 그냥 받는 말이라 탈락', '(C) This is wrong! → 따지는 말이라 탈락 · 정답 (B)'] },
    { q: 'ck_split', opts: [o('sp_dutch'), o('g_yes'), o('sp_pl', 'separate')], a: 2,
      lines: ['together or separate → 고르는 질문 · (B) Yes → 고른 것이 없어 탈락', '(A) Dutch pay → 통하지 않는 콩글리시라 탈락', '고른 것 + please → 정답 (C) Separate, please.'] },
  ];
  RS.practiceQ = p => p.q === 'ml_dish' ? RS.simQ('ml_dish', RS.PCARD) : RS.Q[p.q];

  /* ---------- 끝이 내려가는 고르는 질문 · 이어서 들리는 말 (02 · 03장). 대문자 = 세게 ---------- */
  RS.LINKED = [
    { q: 'd_wait', en: 'a fifteen-minute wait', say: 'about a fifteen-minute wait', words: ['a', 'fifteen-minute', 'wait'], sound: [['uh', 0], ['fif', 0], ['TEEN', 1], ['min', 0], ['it', 0], ['WAIT', 1]], link: [[1, 2]], ko: 'fifteen → 뒤(TEEN)를 세게 · fifty → 앞(FIF)을 세게' },
    { q: 'dk_water', en: 'Still or sparkling?', say: 'Still or sparkling?', words: ['Still', 'or', 'sparkling?'], sound: [['STILL', 1], ['er', 0], ['SPAR', 1], ['kling', 0]], link: [[0, 1]], ko: 'or → er: 약하게 · still or → stiller처럼 이어져요' },
  ];
  // 헷갈리는 숫자 짝 (03장): 앞이 세면 -ty, 뒤가 세면 -teen
  RS.PAIRS = [['15', 'fifTEEN', '50', 'FIFty'], ['13', 'thirTEEN', '30', 'THIRty'], ['14', 'fourTEEN', '40', 'FORty']];

  /* ---------- 직접 해 보기 자료 ---------- */
  RS.SHAPE_QS = ['or_ready', 'd_seat', 'd_many', 'or_side', 'or_cook', 'dk_offer', 'ck_split', 'ml_how', 'al_any', 'or_dress', 'ml_dish'];
  RS.SHAPE_ANS = ['g_yes', 'g_yesp', 'pick'];
  RS.CALL_FRAMES = ['cl_ex', 'cl_hey', 'cl_waiter', 'cl_here'];
  RS.CHECK_FRAMES = ['cr_could', 'cr_just', 'cr_bill', 'cr_calc'];
  RS.SPLIT_FRAMES = ['sp_pl', 'sp_split', 'sp_dutch', 'g_yes'];

  /* =========================================================
     따라 말하기 28문장 (곳마다 서버 · 나의 말 넷)
     ========================================================= */
  const SH = (place, who, en, ko, sp) => ({ place, who, en, ko, sp: who === 'me' ? 'me' : sp || RS.PLACE[place].sp });
  RS.SHADOW = [
    SH('door', 'staff', 'Do you have a reservation?', '예약하셨어요?'),
    SH('door', 'me', 'Yes, under Park.', '네, 박으로 했어요.'),
    SH('door', 'me', 'A table for two, please.', '두 명 자리 주세요.'),
    SH('door', 'me', 'Outside, please.', '바깥 자리로 주세요.'),
    SH('drinks', 'staff', 'Still or sparkling water?', '그냥 물 드릴까요, 탄산수 드릴까요?'),
    SH('drinks', 'me', 'Sparkling, please.', '탄산수로 주세요.'),
    SH('drinks', 'me', 'Just water, please.', '물이면 돼요.'),
    SH('drinks', 'me', 'Could I get a lemon-lime soda, please?', '레몬 라임 탄산음료(사이다) 주시겠어요?'),
    SH('order', 'staff', 'Are you ready to order?', '주문하시겠어요?'),
    SH('order', 'me', 'Could we have a few more minutes, please?', '조금만 더 시간을 주시겠어요?'),
    SH('order', 'staff', 'How would you like your steak cooked?', '스테이크는 어떻게 구워 드릴까요?'),
    SH('order', 'me', 'I\'ll have the ribeye steak, medium-rare, with a salad, please.', '립아이 스테이크로 할게요, 미디엄 레어로, 샐러드와 함께요.'),
    SH('allergy', 'staff', 'Do you have any food allergies?', '음식 알레르기가 있으세요?'),
    SH('allergy', 'me', 'Yes, I\'m allergic to peanuts.', '네, 땅콩 알레르기가 있어요.'),
    SH('allergy', 'me', 'Does the house salad have nuts in it?', '하우스 샐러드에 견과류가 들어 있나요?'),
    SH('allergy', 'me', 'Not too spicy, please.', '너무 맵지 않게 해 주세요.'),
    SH('meal', 'me', 'Excuse me. Could I get some more water, please?', '저기요. 물 좀 더 주시겠어요?'),
    SH('meal', 'staff', 'How is everything?', '음식은 괜찮으세요?'),
    SH('meal', 'me', 'Great, thank you.', '아주 좋아요, 고마워요.'),
    SH('meal', 'me', 'Excuse me, this isn\'t what I ordered. I ordered the grilled salmon.', '저기요, 이건 제가 시킨 게 아니에요. 저는 구운 연어를 시켰어요.'),
    SH('dessert', 'staff', 'Are you still working on that?', '아직 드시는 중이세요?'),
    SH('dessert', 'me', 'No, I\'m done. Could I get a box for this, please?', '아니요, 다 먹었어요. 남은 것 싸 갈 그릇 좀 주시겠어요?'),
    SH('dessert', 'staff', 'Can I interest you in some dessert?', '디저트 좀 드시겠어요?'),
    SH('dessert', 'me', 'No, thanks. Just the check, please.', '아니요, 괜찮아요. 계산서만 주세요.'),
    SH('check', 'staff', 'Will this be together or separate?', '함께 계산하실까요, 따로 계산하실까요?'),
    SH('check', 'me', 'Separate, please.', '따로 해 주세요.'),
    SH('check', 'me', 'Could you split it evenly, please?', '똑같이 나눠 주시겠어요?'),
    SH('check', 'me', 'Card, please.', '카드로 할게요.'),
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: key 열쇠 낱말 · frame 대답 틀 · slot 내 정보 · pol 공손한 말 · trap 함정 · ok 정답
     ========================================================= */
  const LL = k => `(${L4[k]})`;
  RS.judgeItem = (it, k) => RS.judge(it.Q, it.opts[k], it.card, '상황');
  const cardSay = c => Object.keys(c || {}).filter(k => !['ready', 'waitOk', 'served', 'dishOk'].includes(k)).map(k => RS.factKo(k, c[k])).join(' · ');
  const segMarks = (a, k, roleOf) => RS.segs(a).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).map(s => ({ t: s.t.trim().replace(/^[,.?!]+|[,.?!]+$/g, ''), role: roleOf(s), at: k })).filter(m => m.t);
  const tagKo = j => j.tag === 'fact' ? '상황과 다른 정보' : j.tag === 'need' ? '꼭 말할 정보가 빠짐' : j.tag === 'order' ? '순서가 어색함' : j.tag === 'wrong' ? '틀린 문장' : '한국어 그대로 옮긴 말 · 콩글리시';
  RS.steps = function (it) {
    const q = it.Q, J = it.opts.map((_, k) => RS.judgeItem(it, k)), at = s => it.opts.map((_, k) => k).filter(k => J[k].stage === s);
    const best = it.opts[it.a], SHp = RS.SHAPE[q.shape];
    // ①
    let t1;
    if (q.fast) t1 = '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 묻는지 모르면 짐작해서 답하지 말고 다시 물어요. 들린 낱말이 있으면 그 부분만 되물어요.';
    else t1 = `열쇠 낱말 ${q.key.join(' … ')} → ${SHp.ko}(${SHp.mark}). ${RS.sayOf(q.intent)}. ${RS.INTENT[q.intent].want}`;
    if (at(1).length) t1 += ' ' + at(1).map(k => LL(k)).join(' · ') + (q.fast ? ' → 짐작한 대답이거나 다른 말을 되물어 탈락.' : J[at(1)[0]].tag === 'shape' ? ' → 모양이 맞지 않거나 다른 질문의 대답이라 탈락.' : ' → 다른 질문에 맞는 대답이라 탈락.');
    const m1 = q.fast ? [] : q.key.map(t => ({ t, role: 'key', at: 'q' }));
    at(1).forEach(k => m1.push({ t: RS.text(it.opts[k]).replace(/[.?!]$/, ''), role: 'trap', at: k }));
    // ②
    const sit = cardSay(it.card);
    const Fb = RS.FRAME[best.f], ft = Fb.t && !best.req ? Fb.t.replace(/[{}]/g, '').replace('___', '…') : RS.text(best);
    let t2 = (q.fast ? '상황 → 처음 듣고 다 알아듣지 못했어요. ' : sit ? `상황 → ${sit}. ` : '') + `맞는 틀 → ${ft}`;
    if (at(2).length) t2 += ' · ' + at(2).map(k => `${LL(k)} ${tagKo(J[k])}`).join(' · ') + ' → 탈락.';
    else t2 += ' · 틀과 정보가 모두 맞는 보기만 남았어요.';
    const m2 = [];
    it.opts.forEach((a, k) => {
      if (J[k].stage === 1) return;
      const F = RS.FRAME[a.f], x = F.slot && RS.sv(F.slot, a.v), sb = x && x.bad;
      const trapOf = s => J[k].stage !== 2 ? false : (J[k].tag === 'fact' || sb) ? (F.slot ? s.r === 'slot' && !s.req : s.r === 'frame') : !s.req && s.r === 'frame';
      segMarks(a, k, s => s.r === 'pol' ? '' : trapOf(s) ? 'trap' : s.r).forEach(m => { if (m.role) m2.push(m); });
    });
    // ③
    let t3 = at(3).length ? at(3).map(k => `${LL(k)} ${RS.text(it.opts[k])} → ${J[k].tag === 'plain' ? '그냥 No.로 끊김' : '명령 · 따지는 말 · 큰 소리로 부르는 말'}`).join(' · ') + ' → 탈락. ' : '무례하게 들리는 보기는 없어요. ';
    t3 += `정답 ${LL(it.a)} → ${J[it.a].why}`;
    const m3 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 3) segMarks(a, k, () => 'trap').forEach(m => m3.push(m)); else if (J[k].stage === 0) segMarks(a, k, s => s.r === 'pol' ? 'pol' : '').forEach(m => { if (m.role) m3.push(m); }); });
    m3.push({ t: RS.text(it.opts[it.a]), role: 'ok', at: it.a, whole: true });
    return [
      { head: '① 열쇠 낱말 + 질문의 모양 잡기', text: t1, marks: m1 },
      { head: '② 틀에 내 정보 넣기', text: t2, marks: m2 },
      { head: '③ 공손하게 끝내기', text: t3, marks: m3 },
    ];
  };
  RS.notes = it => it.opts.map((_, k) => { const j = RS.judgeItem(it, k); return (j.ok ? '' : `× ${['', '①', '②', '③'][j.stage]} `) + j.why; });

  /* =========================================================
     데이터 점검 — 열쇠 낱말이 말에 없거나, 모양이 글과 다르거나, 맞는 보기가 하나가 아니거나, 정답 위치가 몰리면 경고
     ========================================================= */
  RS.check = function () {
    const bad = [];
    const hasT = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase());
    Object.values(RS.Q).forEach(q => {
      if (!RS.PLACE[q.place]) bad.push(`말 ${q.id}: 곳 ${q.place}가 없어요`);
      if (!RS.INTENT[q.intent]) bad.push(`말 ${q.id}: 뜻 ${q.intent}가 없어요`);
      q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`말 ${q.id}: 열쇠 낱말 ‘${k}’가 말에 없어요`); });
      if (RS.shapeGuess(q.en) !== q.shape) bad.push(`말 ${q.id}: 적어 둔 모양 ${q.shape} · 글의 모양 ${RS.shapeGuess(q.en)}`);
      if (q.shape === 'or') { if (!q.choices || q.choices.length < 2) bad.push(`말 ${q.id}: 고르는 질문에 choices가 없어요`); else { const In = RS.INTENT[q.intent], S = Object.values(RS.SLOT).find(s => s.key === In.key); q.choices.forEach(c => { if (!S || !S.vals[c]) bad.push(`말 ${q.id}: 고를 것 ${c}가 칸에 없어요`); }); } }
    });
    Object.values(RS.FRAME).forEach(F => {
      [].concat(F.intent).forEach(i => { if (i !== 'yn' && !RS.INTENT[i]) bad.push(`틀 ${F.id}: 뜻 ${i}가 없어요`); });
      if (F.slot && !RS.SLOT[F.slot]) bad.push(`틀 ${F.id}: 칸 ${F.slot}이 없어요`);
      if (F.slot && !/___/.test(F.t)) bad.push(`틀 ${F.id}: 칸이 있는데 ___가 없어요`);
      if (F.tag !== 'ok' && !F.why) bad.push(`틀 ${F.id}: 함정 틀에 까닭(why)이 없어요`);
      if (F.slot && RS.SLOT[F.slot] && !RS.SLOT[F.slot].dyn) Object.values(RS.SLOT[F.slot].vals).forEach(v => { if (F.form && v[F.form] == null) bad.push(`틀 ${F.id}: 칸 값에 ${F.form} 꼴이 없어요`); });
    });
    Object.entries(RS.INTENT).forEach(([k, In]) => { if (In.best && typeof In.best === 'string' && !RS.FRAME[In.best]) bad.push(`뜻 ${k}의 모범 틀 ${In.best}가 없어요`); });
    // 숫자 읽기
    [[1450, 'fourteen fifty'], [2600, 'twenty-six dollars'], [2340, 'twenty-three forty'], [3250, 'thirty-two fifty'], [305, 'three oh five'], [100, 'one dollar']].forEach(([c, w]) => { if (RS.priceWords(c) !== w) bad.push(`값 읽기 ${c}: ${RS.priceWords(c)}`); });
    [['7:30', 'seven-thirty'], ['8:15', 'eight-fifteen'], ['7:00', 'seven']].forEach(([t, w]) => { if (RS.timeWords(t) !== w) bad.push(`시각 읽기 ${t}: ${RS.timeWords(t)}`); });
    [['fifteen', '15'], ['fifty', '50'], ['twenty-three forty', '2340'], ['twenty three forty', '2340'], ['$23.40', '2340'], ['23.40', '2340'], ['seven thirty', '730'], ['thirty-two fifty', '3250']].forEach(([s, r]) => { if (!RS.canon(s).includes(r)) bad.push(`숫자 맞추기 ${s}: ${RS.canon(s).join(' ')}`); });
    if (RS.spoken('That\'s $14.50.') !== 'That\'s fourteen fifty.') bad.push(`읽을 글: ${RS.spoken('That\'s $14.50.')}`);
    // 알레르기 확인
    [[['salad'], 'nuts', true, true], [['noodles'], 'peanuts', true, false], [['noodles'], 'shrimp', true, true], [['steak'], 'peanuts', false, false], [['burger'], 'milk', true, true], [['pasta'], 'milk', true, false]].forEach(([it, al, c, r]) => { const s = RS.safe(it, al); if (s.contains !== c || (c && s.removable !== r)) bad.push(`알레르기 ${it} · ${al}: ${JSON.stringify(s)}`); });
    // 연습 문제
    const pos = [0, 0, 0, 0];
    RS.DRILL.forEach((it, i) => {
      const w = `듣고 대답 고르기 ${i + 1}`;
      if (!it.Q) { bad.push(`${w}: 말 ${it.q}가 없어요`); return; }
      const good = it.opts.map((_, k) => k).filter(k => RS.judgeItem(it, k).ok);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]}`);
      const texts = it.opts.map(RS.text);
      if (new Set(texts).size !== texts.length) bad.push(`${w}: 같은 보기가 있어요`);
      if (!it.sit) bad.push(`${w}: 상황 글이 없어요`);
      pos[it.a]++;
    });
    if (Math.max(...pos) - Math.min(...pos) > 0) bad.push(`듣고 대답 고르기 정답 위치가 몰려 있어요: ${pos.join(',')}`);
    const places = new Set(RS.DRILL.map(it => it.place));
    RS.PLACES.forEach(p => { if (!places.has(p.id)) bad.push(`듣고 대답 고르기: ${p.ko} 문제가 없어요`); });
    if (RS.DRILL.filter(it => it.Q.fast).length < 2) bad.push('듣고 대답 고르기: 빠른 말(다시 묻기) 문제가 둘보다 적어요');
    const yesTrap = RS.DRILL.filter(it => (it.Q.shape === 'or' || it.Q.shape === 'wh') && it.opts.some(a => RS.FRAME[a.f].bare)).length;
    if (yesTrap < 4) bad.push(`듣고 대답 고르기: 고르는 · 정보 질문에 Yes 함정이 있는 문제가 ${yesTrap}개뿐이에요`);
    Object.entries(RS.MINI).forEach(([k, it]) => { const good = it.opts.map((_, i) => i).filter(i => RS.judgeItem(it, i).ok); if (good.length !== 1 || good[0] !== it.a) bad.push(`직접 해 보기 ${k}: 맞는 보기 ${good}`); });
    // 영상 · 직접 해 보기의 대화가 판정과 맞나
    const want = (w, q, a, c, ok) => { const j = RS.judge(q, a, c); if (j.ok !== ok) bad.push(`${w}: ${RS.text(a)} → 판정 ${j.ok ? '✓' : '×'} (${j.why})`); return j; };
    const D = RS.DEMO, SC = RS.SCENE;
    want('00장 Yes', RS.INTRO.q, RS.INTRO.lit, RS.INTRO.card, false); want('00장 고른 것', RS.INTRO.q, RS.INTRO.ok, RS.INTRO.card, true);
    SC.shapes.forEach(([q, sh]) => { if (RS.Q[q].shape !== sh) bad.push(`02장 모양 ${q}: ${RS.Q[q].shape} ≠ ${sh}`); });
    want('02장 권하기', SC.offer[0], SC.offer[1], { drink: 'none' }, true); want('02장 권하기에 물', SC.offer[0], SC.offer[2], {}, false);
    want('02장 고르기 Yes', SC.orYes[0], SC.orYes[1], { starter: 'salad' }, false); want('02장 고르기', SC.orYes[0], SC.orYes[2], { starter: 'salad' }, true);
    want('02장 정보 Yes', SC.whYes[0], SC.whYes[1], { cook: 'medium' }, false); want('02장 정보', SC.whYes[0], SC.whYes[2], { cook: 'medium' }, true);
    want('03장 예약', SC.resv[0], SC.resv[1], { resv: true, name: 'Park' }, true); want('03장 예약 없음', SC.resv[0], SC.resv[2], { resv: false }, true);
    SC.many.slice(1).forEach((a, i) => want(`03장 사람 수 ${i + 1}`, SC.many[0], a, D, true));
    want('03장 되묻기', SC.wait[0], SC.wait[1], D, true); want('03장 기다리기', SC.wait[0], SC.wait[2], D, true);
    want('03장 되묻기 50', SC.wait[0], o('wt_check', '50'), D, false);
    want('03장 자리 Yes', SC.seat[0], SC.seat[1], D, false); want('03장 자리', SC.seat[0], SC.seat[2], D, true);
    want('04장 물만', SC.drink[0], SC.drink[1], { drink: 'none' }, true); want('04장 물', SC.water[0], SC.water[1], D, true);
    want('04장 cider', 'dk_more', SC.cider[0], D, false); want('04장 soda', 'dk_more', SC.cider[1], D, true);
    want('04장 주문', SC.ready[0], SC.ready[1], D, true); want('04장 아직', SC.ready[0], SC.ready[2], { ready: false }, true);
    want('04장 굽기', SC.cook[0], SC.cook[1], D, true);
    SC.blunt.forEach(([b, g], i) => { want(`04장 명령 ${i + 1}`, i ? 'or_what' : 'or_ready', b, i ? D : { ready: false }, false); want(`04장 공손 ${i + 1}`, i ? 'or_what' : 'or_ready', g, i ? D : { ready: false }, true); });
    const PA = { allergy: 'peanuts' };
    want('05장 알레르기', SC.allergy[0], SC.allergy[1], PA, true); want('05장 알레르기 2', SC.allergy[0], SC.allergy[2], PA, true); want('05장 I have peanut', SC.allergy[0], SC.allergy[3], PA, false);
    want('05장 빼고', RS.simQ('al_safe', D), SC.ask2, D, true); want('05장 빼고 다른 재료', RS.simQ('al_safe', D), o('sf_wo', 'cheese'), D, false);
    want('05장 묻기', SC.ask[0], SC.ask[1], { ask: 'salad:nuts' }, true); want('05장 Is … have', SC.ask[0], SC.ask[2], { ask: 'salad:nuts' }, false);
    want('05장 맵기', SC.spicy[0], SC.spicy[1], { spice: 'mild' }, true); want('05장 따로', SC.side[0], SC.side[1], D, true);
    want('06장 부르기', 'ml_pass', SC.call[0], D, true); SC.call.slice(1).forEach((a, i) => want(`06장 큰 소리 ${i + 1}`, 'ml_pass', a, D, false));
    want('06장 How Yes', SC.how[0], SC.how[1], D, false); want('06장 How', SC.how[0], SC.how[2], D, true);
    want('06장 부탁 1', 'ml_what', SC.reqs[0], D, true); want('06장 부탁 2', 'ml_what', SC.reqs[1], D, true);
    const qd = RS.simQ('ml_dish', D);
    want('06장 This is wrong', qd, SC.dish[0], D, false); want('06장 시킨 것', qd, SC.dish[1], D, true);
    want('07장 박스', SC.done[0], SC.done[1], D, true); want('07장 take out', SC.done[0], SC.done[2], D, true);
    want('07장 Calculate', SC.dessert[0], SC.dessert[1], D, false); want('07장 계산서', SC.dessert[0], SC.dessert[2], D, true);
    want('07장 calculate', SC.check[0], SC.check[1], D, false); want('07장 check', SC.check[0], SC.check[2], D, true); want('07장 bill', SC.check[0], SC.check[3], D, true);
    want('07장 Dutch', SC.split[0], SC.split[1], D, false); want('07장 Separate', SC.split[0], SC.split[2], D, true); want('07장 split', SC.split[0], SC.split[3], D, true);
    const qp = RS.simQ('ck_pay', D);
    want('07장 카드', qp, SC.pay, D, true);
    if (RS.Q.ck_pay.en !== qp.en) bad.push(`07장 계산: ${RS.Q.ck_pay.en} ≠ ${qp.en}`);
    if (RS.bill(D).total !== 5700 || RS.split(RS.bill(D), 2).each !== 2850) bad.push(`07장 합계: ${RS.money(RS.bill(D).total)} · 한 사람 ${RS.money(RS.split(RS.bill(D), 2).each)} (≠ $57.00 · $28.50)`);
    if (RS.Q.al_safe.en !== RS.safeReply(RS.plate(D), 'nuts').en) bad.push(`05장 알레르기 대답: ${RS.Q.al_safe.en} ≠ ${RS.safeReply(RS.plate(D), 'nuts').en}`);
    // 한 줄 주문
    want('08장 한 줄', 'or_ready', { f: 'line', line: RS.LINE }, D, true);
    want('08장 알레르기까지', 'or_ready', { f: 'line', line: RS.LINE_ALLERGY }, D, true);
    want('08장 순서 어색', 'or_ready', { f: 'line', line: RS.LINE_BAD }, D, false);
    const cov = RS.covered({ f: 'line', line: RS.LINE }, 'or_ready').sort().join();
    if (cov !== ['ready', 'order', 'cook', 'starter', 'dressing'].sort().join()) bad.push(`08장 한 줄이 답한 질문: ${cov}`);
    const cov2 = RS.covered({ f: 'line', line: RS.LINE_ALLERGY }, 'or_ready');
    if (!cov2.includes('allergy') || !cov2.includes('safe')) bad.push(`08장 알레르기까지 한 줄: ${cov2}`);
    RS.SHORT.forEach(([q, a], i) => want(`08장 짧게 ${i + 1}`, q, a, D, true));
    RS.METHOD.forEach(([q, a, c], i) => want(`09장 ${i + 1}`, q, a, c, true));
    // 실전: 지워지는 단계가 줄 글과 맞나
    RS.PRACTICE.forEach((p, i) => {
      const w = `실전 ${i + 1}`, q = RS.practiceQ(p);
      const J = p.opts.map(a => RS.judge(q, a, RS.PCARD));
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
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 50; n++) {
      const c = RS.newCard(rnd);
      if (RS.bill(c).total % c.party) bad.push(`시뮬레이터 카드 ${n}: 나눠 내는 값이 센트로 나뉘지 않아요`);
      const pl = RS.safe(RS.plate(c), c.allergy); if (pl.contains && !pl.removable) bad.push(`시뮬레이터 카드 ${n}: 알레르기에 안전하지 않은 음식 ${RS.plate(c)}`);
      RS.simQs(c).forEach(id => {
        const q = RS.simQ(id, c), C = Object.assign({}, c, q.fact || {}), m = RS.model(q, C), j = RS.judge(q, m, C);
        if (!j.ok) bad.push(`시뮬레이터 ${id}: 모범 대답이 탈락 (${RS.text(m)} · ${j.why})`);
        const ms = RS.matchSpoken(RS.spoken(RS.text(m)), q, C);
        if (!ms.ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 말로 해도 통과하지 못해요 (${RS.text(m)} · ${ms.why})`);
        if (RS.shapeGuess(q.en) !== q.shape) bad.push(`시뮬레이터 ${id}: 모양 ${q.shape} · 글 ${RS.shapeGuess(q.en)} (${q.en})`);
        q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`시뮬레이터 ${id}: 열쇠 낱말 ‘${k}’가 말에 없어요`); });
        const fr = RS.simFrames(q.intent, C);
        if (!fr) { bad.push(`시뮬레이터 ${id}: 틀 칩이 없어요`); return; }
        const reqs = q.intent === 'call' ? RS.callReqs() : [undefined];
        const okN = fr.filter(f => { const F = RS.FRAME[f]; return reqs.some(r => { const base = r === undefined ? {} : r ? { req: Object.assign({}, r, RS.FRAME[r.f].slot ? { v: C.need } : {}) } : {}; if (!F.slot) return RS.judge(q, Object.assign({ f }, base), C).ok; return RS.slotChoices(F.slot, C, rnd).some(v => RS.judge(q, Object.assign({ f, v }, base), C).ok); }); }).length;
        if (okN !== 1) bad.push(`시뮬레이터 ${id}: 맞는 틀이 ${okN}개예요 (${fr.join(',')})`);
        fr.forEach(f => { const F = RS.FRAME[f]; if (F.slot && !RS.slotChoices(F.slot, C, rnd).length) bad.push(`시뮬레이터 ${id}: ${f}의 칸 칩이 없어요`); });
        if (F0ok(q, C, fr, rnd) === false) bad.push(`시뮬레이터 ${id}: 맞는 틀의 칸 칩에 카드 값이 없어요`);
        if (q.intent === 'ready') { const L0 = RS.modelLine(C); const ml = RS.matchSpoken(RS.spoken(RS.text(L0)), q, C); if (!ml.ok || RS.covered(L0, q).filter(i => !ml.covered.includes(i)).length) bad.push(`시뮬레이터 한 줄 주문을 말로: ${RS.text(L0)} · ${ml.why} · ${ml.covered}`); }
      });
    }
    // 말로 대답하기: 모양 · 다른 질문의 대답 · 다른 이름 · 다른 숫자 · 콩글리시는 통과하지 않아야
    const D2 = RS.DEMO, nope = (w, raw, q, c) => { const r = RS.matchSpoken(raw, q, c); if (r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과해요`); return r; }, yep = (w, raw, q, c) => { const r = RS.matchSpoken(raw, q, c); if (!r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과하지 않아요 (${r.why})`); return r; };
    Object.values(RS.Q).filter(q => (q.shape === 'or' || q.shape === 'wh') && !q.fast).forEach(q => { ['yes', 'yes please', 'yeah sure'].forEach(y => nope(`${q.id} ${y}`, y, q, D2)); });
    yep('yes sparkling', 'yes, sparkling', 'dk_water', D2);
    nope('다른 이름', 'Yes, under Lee.', 'd_resv', Object.assign({}, D2, { resv: true })); nope('다른 질문의 대답(자리)', 'Inside, please.', 'dk_water', D2);
    nope('fifty', 'Sorry, did you say fifty minutes?', 'd_wait', D2); nope('다른 질문의 사실(사람 수)', 'two nights', 'd_many', D2); nope('fifty 숫자', 'did you say 50?', 'd_wait', D2);
    nope('cider', 'A cider, please.', 'dk_more', D2); nope('dutch pay', 'Dutch pay, please.', 'ck_split', D2); nope('calculate', 'Calculate, please.', 'ck_else', D2); nope('calculate 디저트', 'No thanks, calculate please', 'ds_offer', D2);
    nope('I have peanut', 'I have peanut.', 'al_any', Object.assign({}, D2, { allergy: 'peanuts' })); nope('middle', 'Middle, please.', 'or_cook', D2);
    nope('다른 값', 'Sorry, was that twenty-three forty each?', RS.simQ('ck_pay', D2), D2);
    { const r = RS.matchSpoken('Sorry, was that twenty-eight fifty each?', RS.simQ('ck_pay', D2), D2); if (r.repair !== 'check') bad.push(`말로 대답하기 같은 값 되묻기: ${r.why}`); }
    nope('다른 음식', 'Excuse me, this is not what I ordered. I ordered the peanut noodles.', RS.simQ('ml_dish', D2), D2);
    nope('나온 음식 그대로', 'Thank you.', RS.simQ('ml_dish', D2), D2);
    nope('카드에 없는 부탁', 'Excuse me, could I get a new fork?', 'ml_pass', D2);
    yep('브랜드', 'Can I get a Sprite, please?', 'dk_more', D2); yep('레몬 라임', 'Could I get a lemon-lime soda?', 'dk_more', D2);
    yep('두 가지를 거꾸로', 'Excuse me, could we get an extra plate and some more water?', 'ml_pass', D2);
    // 따라 말하기: 같은 말은 모두 맞아야 · 숫자 낱말로 말해도 맞아야
    RS.SHADOW.forEach((s, i) => { const r = RS.compareWords(s.en, s.en), r2 = RS.compareWords(s.en, RS.spoken(s.en)); if (r.hit !== r.total || r2.hit !== r2.total) bad.push(`따라 말하기 ${i + 1}: 같은 글이 다 맞지 않아요`); if (!RS.PLACE[s.place]) bad.push(`따라 말하기 ${i + 1}: 곳이 없어요`); });
    if (RS.SHADOW.length !== 28) bad.push(`따라 말하기 문장 수: ${RS.SHADOW.length}`);
    bad.forEach(b => console.warn('[식당] ' + b));
    return bad;
  };
  // 맞는 틀의 칸 칩에 카드의 값이 들어 있나 (dyn 칸 · 부탁 칸은 건너뜀)
  function F0ok(q, C, fr, rnd) {
    const right = fr.find(f => [].concat(RS.FRAME[f].intent).includes(q.intent) && RS.FRAME[f].slot && RS.FRAME[f].tag === 'ok');
    if (!right) return null;
    const F = RS.FRAME[right], v = RS.slotVal(F.slot, C);
    if (v == null) return null;
    return RS.slotChoices(F.slot, C, rnd).includes(String(v));
  }

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  RS.allText = function () {
    const out = [];
    Object.values(RS.Q).forEach(q => out.push(q.en, q.ko, q.short || ''));
    Object.values(RS.FRAME).forEach(F => out.push(F.t, F.ko, F.why || '', F.note || ''));
    Object.values(RS.SLOT).forEach(S => Object.values(S.vals || {}).forEach(v => out.push(Object.values(v).filter(x => typeof x === 'string').join(' '))));
    Object.values(RS.SHAPE).forEach(a => out.push(a.ko, a.mark, a.ans, a.say, a.offer || '')); Object.values(RS.INTENT).forEach(a => out.push(a.ans, a.want || '', a.say || '', a.turn || ''));
    RS.PLACES.forEach(p => out.push(p.ko, p.en)); Object.values(RS.MENU).forEach(m => out.push(m.en, m.ko, m.en.toUpperCase())); Object.values(RS.ALLERGENS).forEach(a => out.push(a.en, a.ko, a.badge));
    RS.PRACTICE.forEach(p => out.push(p.lines.join(''))); RS.SHADOW.forEach(s => out.push(s.en, s.ko));
    RS.LINKED.forEach(l => out.push(l.en, l.ko, l.sound.map(s => s[0]).join(''))); RS.PAIRS.forEach(p => out.push(p.join('')));
    Object.values(RS.OCAT).forEach(c => out.push(c.ko)); Object.values(RS.OW).forEach(w => out.push(w.t));
    out.push(RS.REST, RS.REST.toUpperCase(), RS.TIP_NOTE, '$0123456789.·+×–', 'MENU MAINS STARTERS DRESSINGS DRINKS DESSERTS TONIGHT\'S SPECIAL ASK YOUR SERVER TOTAL EACH SPLIT WAYS CHECK GUEST TABLE THANK YOU HOST STAND KITCHEN PATIO OUTSIDE INSIDE ENTRANCE CASHIER COMES WITH SOUP OR SALAD FREE STILL TAP RARE MEDIUM WELL-DONE');
    return out.join('');
  };
})();
