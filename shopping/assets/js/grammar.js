/* 쇼핑 회화 — 규칙 엔진과 대화 자료 (상황별 영어 회화)
 *
 * 옷 가게에서는 손에 든 물건을 두고 말할 때가 많아요. ‘이거 M 있어요?’ ‘이거 남색도 있어요?’ ‘이거 입어 봐도 돼요?’
 * 그래서 쇼핑의 핵심은 ‘이것에 바꿀 점만 더한다’예요.
 *   이것      → 손에 든 것을 가리키는 this · 둘이 짝인 것(청바지 · 운동화 · 양말)은 these. 대신 받는 말은 it · them
 *   바꿀 점   → in + 크기 · 색. 손에 든 것과 다른 점만 말해요(같은 점은 말하지 않아요)
 *   → Do you have this in a medium?  Do you have these in black?  Could I try this on?
 * 직원의 질문은 모양이 셋이에요(Yes/No 질문 · 고르는 질문 · 정보 질문). 고르는 질문 · 정보 질문에는 Yes.로 답이 안 돼요.
 * 질문이 아닌 안내(Let me know if you need anything!)는 내가 먼저 말을 꺼낼 차례예요.
 *
 * 규칙 엔진은 소리를 듣지 않고, 말마다 적어 둔 ‘뜻(intent) · 모양(shape)’과 ‘대답 틀(frame) + 내 정보(slot)’,
 * 그리고 쇼핑 카드(또는 상황)의 사실을 맞춰 봐요.
 *
 * 3단계 말하기 법 — SH.judge(직원의 말, 대답, 카드)
 *   ① 열쇠 낱말 + 질문의 모양 잡기 — 고르는 질문 · 정보 질문에 Yes · No만 하면 탈락, 고르는 질문이면 직원이 말한 것 가운데 골랐나,
 *                      대답이 그 말(intent)에 맞나. 빠르게 말해 못 알아들은 말(fast)이면 짐작한 대답은 탈락 → 다시 묻기
 *   ② 틀에 내 정보 넣기 — 틀이 자연스러운가(한국어 그대로 · 콩글리시 · 틀린 문장이면 탈락), this · these가 물건과 맞나,
 *                      바꿀 점이 손에 든 것과 정말 다른가(같은 것을 말하면 탈락), 꽉 끼면 한 칸 큰 크기인가, 되물은 값이 들은 값과 같은가
 *   ③ 공손하게 끝내기 — 명령 · 조르는 말 · 따지는 말(blunt)이나 그냥 No.로 끊긴 말(plain)이면 탈락
 * judge → { ok, stage: 0 | 1 | 2 | 3, why, tag }
 *
 * 바꿀 점 한 줄: SH.changeLine(낱말, 카드) — Do you have → this · these → in + 크기 → in + 색 (단순하게 줄인 규칙)
 *             SH.covered(대답, 말) — 그 대답이 이미 답한 직원의 질문 → 시뮬레이터의 직원이 건너뜀
 * 물건과 계산: SH.ITEMS(지어낸 가게 · 지어낸 값) · SH.sizeFor(물건, 지금 크기, 맞음새) · SH.salePrice(값, 할인) · SH.bill(카드) · SH.returnRule(카드)
 *       영상 · 값표 · 영수증 · 직원의 말이 모두 이 계산을 써요. 목소리는 SH.spoken으로 읽어요($29.40 → twenty-nine forty).
 *
 * 영상의 ✓·×, 직접 해 보기, 쇼핑 시뮬레이터, 듣고 대답 고르기, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 SH.check()가 콘솔에 경고를 내요.
 */
(function () {
  'use strict';
  const SH = (window.SH = {});
  const L4 = 'ABCD';

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; if (/[0-9]/.test(s[i])) return '0136781'.includes(s[i]) ? 0xAC01 : 0xAC00; if (/[A-Za-z]/.test(s[i])) return /[lmnr]/i.test(s[i]) ? 0xAC01 : 0xAC00; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const rieul = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 === 8 : false; };
  const wa = s => s + (has(s) ? '과' : '와'), eul = s => s + (has(s) ? '을' : '를'), ig = s => s + (has(s) ? '이' : '가');
  const ro = s => s + (has(s) && !rieul(s) ? '으로' : '로'), ieyo = s => s + (has(s) ? '이에요' : '예요'), eun = s => s + (has(s) ? '은' : '는');
  SH.josa = { wa, eul, ig, ro, ieyo, eun };

  /* =========================================================
     옷 가게 일곱 곳 (쇼핑하는 차례). sp: 그곳 직원의 목소리 (voices.js)
     ========================================================= */
  SH.PLACES = [
    { id: 'door', ko: '입구 · 둘러보기', en: 'Entrance · Browsing', sp: 'us' },
    { id: 'find', ko: '물건 찾기', en: 'Finding things', sp: 'us' },
    { id: 'rack', ko: '진열대 · 크기와 색', en: 'The rack · Size and color', sp: 'us' },
    { id: 'fit', ko: '탈의실', en: 'Fitting room', sp: 'ca' },
    { id: 'price', ko: '값 · 할인', en: 'Price · Sales', sp: 'us' },
    { id: 'pay', ko: '계산대', en: 'Checkout', sp: 'au' },
    { id: 'ret', ko: '교환 · 환불', en: 'Returns · Exchanges', sp: 'au' },
  ];
  SH.PLACE = {}; SH.PLACES.forEach((p, i) => { p.i = i; SH.PLACE[p.id] = p; });
  SH.ME = 'me';
  SH.STORE = 'Maple & Thread';   // 지어낸 가게 이름
  SH.CLERK = 'Jess';             // 지어낸 직원 이름
  // 내가 먼저 말을 꺼내는 곳 (물건 위치 묻기 · 입어 보기 · 값 묻기 · 교환 · 환불)
  SH.ME_FIRST = { find: 1, fit: 1, price: 1, ret: 1 };

  /* =========================================================
     질문의 모양 세 가지 (+ 안내). mark: 그림 이름 (scenes.js의 shape_yn · shape_or · shape_wh · shape_note)
     ========================================================= */
  SH.SHAPE = {
    yn: { ko: 'Yes/No 질문', mark: '스위치', ans: 'Yes · No + 한 마디', say: 'Yes/No 질문이에요. Yes · No에 한 마디를 더해요', offer: '도와주겠다는 말이면 원하는 것을 바로 말해도 돼요(Yes는 빼도 돼요)' },
    or: { ko: '고르는 질문', mark: '갈림길', ans: '고른 것 + please', say: '고르는 질문(A or B?)이에요. 직원이 말한 것 가운데 하나를 골라 말해요' },
    wh: { ko: '정보 질문', mark: '빈 상자', ans: '정보 + please', say: '정보 질문이에요. 묻는 정보를 채워 말해요' },
    note: { ko: '안내', mark: '말풍선', ans: '고맙다는 말 · 내가 먼저 말할 차례', say: '질문이 아니라 알려 주는 말이에요' },
  };
  SH.shapeOf = q => (typeof q === 'string' ? SH.Q[q] : q).shape;
  // 글만 보고 짐작한 모양 (점검용): 물음표 문장 가운데 마지막 것 → or가 있으면 고르기, 의문사로 시작하면 정보, 아니면 Yes/No
  SH.shapeGuess = function (en) {
    const qs = String(en).match(/[^.!?]*\?/g);
    if (!qs) return 'note';
    let s = qs[qs.length - 1].trim().toLowerCase().replace(/^(and|so|great|okay|sure|perfect|thanks|now|no problem|hi|hey|hello|hiya)[,!]?\s+/, '');
    if (/\bor\b/.test(s)) return 'or';
    if (/^(how|what|which|where|when|who|why)\b/.test(s)) return 'wh';
    return 'yn';
  };

  /* =========================================================
     숫자 읽기 — 값 · 할인 · 크기 (화면 글 → 소리)
     ========================================================= */
  const NUMW = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };
  const numWord = n => n < 20 || (n < 100 && n % 10 === 0) ? NUMW[n] : n < 100 ? `${NUMW[n - n % 10]}-${NUMW[n % 10]}` : n < 1000 ? `${NUMW[Math.floor(n / 100)]} hundred${n % 100 ? ' ' + numWord(n % 100) : ''}` : String(n);
  SH.numWord = numWord;
  // 값 (센트): 가게에서 말하는 꼴 — $29.40 → twenty-nine forty · $15.00 → fifteen dollars · $6.05 → six oh five
  SH.money = c => '$' + (c / 100).toFixed(2);
  SH.priceWords = c => { const d = Math.floor(c / 100), k = c % 100; return !k ? `${numWord(d)} dollar${d === 1 ? '' : 's'}` : `${numWord(d)} ${k < 10 ? 'oh ' + numWord(k) : numWord(k)}`; };
  SH.priceKo = c => { const d = Math.floor(c / 100), k = c % 100; return k ? `${d}달러 ${k}센트` : `${d}달러`; };
  // 소리 내어 읽을 글: 값 → 낱말
  SH.spoken = s => String(s).replace(/\$(\d+)\.(\d{2})/g, (m, d, c) => SH.priceWords(+d * 100 + +c));

  /* =========================================================
     물건 (지어낸 가게 · 지어낸 값, 단위: 센트)
     kind: 크기를 말하는 방법 (top S · M · L / waist 허리 인치 / shoe 미국 신발 크기 / one 크기 없음)
     two: 둘이 짝인 물건 → this 대신 these, it 대신 them
     ========================================================= */
  SH.ITEMS = {
    tee: { en: 'T-shirt', a: 'a T-shirt', pl: 'T-shirts', ko: '티셔츠', p: 1800, kind: 'top', two: false, colors: ['white', 'black', 'navy', 'gray'] },
    shirt: { en: 'shirt', a: 'a shirt', pl: 'shirts', ko: '셔츠', p: 3600, kind: 'top', two: false, colors: ['white', 'navy', 'beige'] },
    hoodie: { en: 'hoodie', a: 'a hoodie', pl: 'hoodies', ko: '후드 티', p: 3000, kind: 'top', two: false, colors: ['black', 'gray', 'navy', 'beige'] },
    jacket: { en: 'puffer jacket', a: 'a puffer jacket', pl: 'puffer jackets', ko: '패딩 점퍼', p: 8800, kind: 'top', two: false, colors: ['black', 'navy', 'beige'] },
    dress: { en: 'dress', a: 'a dress', pl: 'dresses', ko: '원피스', p: 4800, kind: 'top', two: false, colors: ['black', 'navy', 'beige', 'white'] },
    jeans: { en: 'jeans', a: 'jeans', pl: 'jeans', ko: '청바지', p: 5400, kind: 'waist', two: true, colors: ['blue', 'black'] },
    sneakers: { en: 'sneakers', a: 'sneakers', pl: 'sneakers', ko: '운동화', p: 6400, kind: 'shoe', two: true, colors: ['white', 'black', 'gray'] },
    socks: { en: 'socks', a: 'socks', pl: 'socks', ko: '양말', p: 600, kind: 'one', two: true, colors: ['white', 'black', 'gray'] },
  };
  SH.SIM_ITEMS = ['tee', 'hoodie', 'jacket', 'dress', 'jeans', 'sneakers'];
  SH.COLORS = { black: { ko: '검은색', hex: '#2A2D33' }, white: { ko: '흰색', hex: '#ECEBE6' }, navy: { ko: '남색(네이비)', hex: '#2E4772' }, gray: { ko: '회색', hex: '#8E949C' }, beige: { ko: '베이지색', hex: '#D9C7A6' }, blue: { ko: '파란색(청)', hex: '#4E79B5' } };
  // 크기: low = 말 속의 꼴(a medium), tag = 값표의 글자
  SH.SIZE = {
    xs: { low: 'an extra small', bare: 'extra small', tag: 'XS', ko: 'XS (엑스트라 스몰)', kind: 'top' },
    s: { low: 'a small', bare: 'small', tag: 'S', ko: 'S (스몰)', kind: 'top' },
    m: { low: 'a medium', bare: 'medium', tag: 'M', ko: 'M (미디엄)', kind: 'top' },
    l: { low: 'a large', bare: 'large', tag: 'L', ko: 'L (라지)', kind: 'top' },
    xl: { low: 'an extra large', bare: 'extra large', tag: 'XL', ko: 'XL (엑스트라 라지)', kind: 'top' },
    w28: { low: 'a 28', bare: '28', tag: '28', ko: '허리 28', kind: 'waist' },
    w30: { low: 'a 30', bare: '30', tag: '30', ko: '허리 30', kind: 'waist' },
    w32: { low: 'a 32', bare: '32', tag: '32', ko: '허리 32', kind: 'waist' },
    w34: { low: 'a 34', bare: '34', tag: '34', ko: '허리 34', kind: 'waist' },
    u7: { low: 'a size 7', bare: 'size 7', tag: 'US 7', ko: '미국 7', kind: 'shoe' },
    u8: { low: 'a size 8', bare: 'size 8', tag: 'US 8', ko: '미국 8', kind: 'shoe' },
    u9: { low: 'a size 9', bare: 'size 9', tag: 'US 9', ko: '미국 9', kind: 'shoe' },
    u10: { low: 'a size 10', bare: 'size 10', tag: 'US 10', ko: '미국 10', kind: 'shoe' },
  };
  SH.SIZES = { top: ['xs', 's', 'm', 'l', 'xl'], waist: ['w28', 'w30', 'w32', 'w34'], shoe: ['u7', 'u8', 'u9', 'u10'], one: [] };
  SH.KIND_KO = { top: 'S · M · L', waist: '허리 숫자(28 · 30 · 32 …)', shoe: '미국 신발 크기(7 · 8 · 9 …)', one: '크기 없음' };
  // 맞음새: up = 한 칸 큰 것이 필요해요(꽉 끼거나 작거나 짧으면)
  SH.FIT = {
    tight: { t: 'tight', ko: '꽉 껴요', up: 1 }, small: { t: 'small', ko: '작아요', up: 1 }, short: { t: 'short', ko: '짧아요', up: 1 },
    loose: { t: 'loose', ko: '헐렁해요', up: -1 }, big: { t: 'big', ko: '커요', up: -1 }, long: { t: 'long', ko: '길어요', up: -1 },
  };
  // 크기 바꾸기 — SH.sizeFor(물건, 지금 크기, 맞음새) → 한 칸 위 · 아래 (없으면 null)
  SH.sizeFor = function (item, cur, fit) {
    const L = SH.SIZES[(SH.ITEMS[item] || {}).kind] || [], i = L.indexOf(cur), d = (SH.FIT[fit] || {}).up || 0;
    if (i < 0 || !d) return null;
    return L[i + d] || null;
  };
  // 할인: 값(센트) × (100 − %) / 100, 센트까지 반올림
  SH.salePrice = (p, off) => Math.round(p * (100 - (off || 0)) / 100);
  SH.priceOf = c => SH.salePrice(SH.ITEMS[c.item].p, c.off);
  // 손에 든 것과 바라는 것 사이의 바꿀 점 → ['size', 'color']
  SH.changes = c => ['size', 'color'].filter(k => c[k] != null && c['h' + k] != null && c[k] !== c['h' + k]);
  // 계산서: 물건(할인 값) + 양말(하나 사면 하나 더: 두 켤레 값 하나). 세금은 나라 · 주마다 달라서 빼고 계산해요(지어낸 값)
  SH.bill = function (c) {
    const items = [], I = SH.ITEMS[c.item];
    items.push({ id: c.item, en: I.en, ko: I.ko, c: SH.priceOf(c), was: c.off ? I.p : null, off: c.off || 0 });
    if (c.bogo) { items.push({ id: 'socks', en: 'Socks (2 pairs)', ko: '양말 두 켤레', c: SH.ITEMS.socks.p, bogo: true }); }
    return { items, total: items.reduce((s, x) => s + x.c, 0) };
  };
  // 돌려주기 규칙 (지어낸 가게 규칙: 30일 안 · 마지막 할인 물건은 안 됨 · 영수증이 없으면 가게 포인트만)
  SH.RETURN_DAYS = 30;
  SH.returnRule = function (c) {
    if (c.final) return { ok: false, why: 'final', en: 'I\'m sorry, but final sale items can\'t be returned or exchanged.', ko: '죄송하지만 마지막 할인(final sale) 물건은 교환 · 환불이 안 돼요.' };
    if (c.days > SH.RETURN_DAYS) return { ok: false, why: 'late', en: `I'm sorry, but we only take returns within ${numWord(SH.RETURN_DAYS)} days.`, ko: `죄송하지만 ${SH.RETURN_DAYS}일 안에만 교환 · 환불해 드려요.` };
    if (c.ret === 'exchange') return { ok: true, why: 'exchange' };
    return c.receipt ? { ok: true, why: 'choose' } : { ok: true, why: 'credit' };
  };

  /* =========================================================
     말의 뜻(intent) — 질문의 모양과 기대하는 대답
     yn: Yes/No 질문에 그냥 Yes · No로만 답할 때 → { yes: 카드 → 카드가 바라는 Yes(true) · No(false) · 모름(null), need: 통과하지만 덧붙일 말, strict: 탈락 까닭 }
     key: 고르는 질문에서 고른 것을 담는 사실 이름
     ========================================================= */
  const I = (shape, ans, want, best, o = {}) => Object.assign({ shape, ans, want, best }, o);
  SH.INTENT = {
    browse: I('yn', '도와줄 것이 있는지 묻는 질문', '둘러보는 중이면 I\'m just looking, thanks. 찾는 것이 있으면 Yes, I\'m looking for + 물건.', c => c.look === false ? 'br_for' : 'br_look', { turn: '둘러보기', offer: true, yn: { yes: c => c.look == null ? null : !c.look, need: '무엇을 찾는지까지 말하면 직원이 바로 안내해 줘요 → Yes, I\'m looking for a hoodie.' } }),
    ask: I('note', '직원이 지나가며 하는 인사', 'Excuse me, where can I find + 물건(여럿)? → Excuse me, where can I find hoodies?', 'ak_where', { turn: '물건 찾기', say: '직원이 지나가며 하는 인사예요. 찾는 것이 있으면 이제 내가 먼저 물을 차례예요' }),
    lookfor: I('wh', '무엇을 찾는지 묻는 질문', 'I\'m looking for + 물건 → I\'m looking for a hoodie.', 'lf_for', { turn: '찾는 물건' }),
    rack: I('yn', '잘 찾고 있는지 묻는 질문', '바꿀 것이 있으면 이것 + 바꿀 점 → Do you have this in a medium? 없으면 Yes, I am. Thanks.', 'rk_good', { turn: '바꿀 점', offer: true, yn: { yes: () => true, need: '바꿀 점까지 말하면 직원이 바로 찾아 줘요 → Do you have this in a medium?' } }),
    size: I('wh', '어떤 크기를 찾는지 묻는 질문', '크기 + please → A medium, please. · I\'m a medium.', 'sz_pl', { turn: '크기' }),
    color: I('or', '두 색 가운데 고르라는 질문', '고른 색 + please → Navy, please.', 'cl_pl', { turn: '색', key: 'color' }),
    tryon: I('note', '탈의실을 알려 주는 안내', 'Could I try this on? · Could I try these on?', 'to_could', { turn: '입어 보기', say: '탈의실이 어디 있는지 알려 주는 안내예요. 입어 보고 싶으면 이제 내가 먼저 물어요' }),
    items: I('wh', '몇 벌을 가지고 들어가는지 묻는 질문', '수 → Two. · Just one.', 'it_n', { turn: '몇 벌' }),
    fit: I('wh', '입어 보니 어떤지 묻는 질문', '맞지 않으면 It\'s a little tight. · They\'re a little loose. 잘 맞으면 It fits great. I\'ll take it.', c => c.fit === 'good' ? (c.two ? 'fi_goods' : 'fi_good') : c.two ? 'fi_theyre' : 'fi_its', { turn: '맞음새' }),
    sizeup: I('yn', '다른 크기를 입어 볼지 묻는 질문', '바꿀 크기까지 → Yes, could I try a large? (꽉 끼면 한 칸 큰 것)', 'su_try', { turn: '다른 크기', offer: true, yn: { yes: () => true, strict: 'Yes만 하면 직원이 어떤 크기인지 다시 물어야 해요. 바꿀 크기까지 말해요. 꽉 끼면 한 칸 큰 것 → Yes, could I try a large?' } }),
    askprice: I('note', '궁금한 것이 있으면 물어보라는 안내', 'Excuse me, how much is this? · how much are these? · Is this on sale?', c => c.ask === 'sale' ? (c.two ? 'pa_sales' : 'pa_sale') : c.two ? 'pa_are' : 'pa_is', { turn: '값 묻기', say: '궁금한 것이 있으면 물어보라는 안내예요. 이제 내가 먼저 물을 차례예요' }),
    cost: I('note', '값과 할인을 알려 주는 말', '사려면 Great. I\'ll take it. 숫자가 헷갈리면 → Sorry, did you say fifteen dollars?', c => c.take === false ? 'pc_think' : 'pc_take', { turn: '값 듣기', say: '값을 알려 주는 말이에요. 숫자를 잘 들었는지 확인하고 살지 말해요' }),
    bogo: I('yn', '하나 사면 하나 더 주는 행사를 권하는 질문', '원하면 Yes, please. 아니면 No, thanks.', c => c.bogo ? 'g_yesp' : 'bo_no', { turn: '하나 더', offer: true, yn: { yes: c => c.bogo == null ? null : !!c.bogo } }),
    found: I('yn', '찾던 것을 다 찾았는지 묻는 질문', 'Yes, I did. Thanks.', 'fd_did', { turn: '다 찾았나', yn: { yes: () => true } }),
    member: I('yn', '회원 카드가 있는지 묻는 질문', '없으면 No, I don\'t. 있으면 Yes, I do.', c => c.member ? 'mb_yes' : 'mb_no', { turn: '회원 카드', yn: { yes: c => c.member == null ? null : !!c.member } }),
    bag: I('yn', '봉투가 필요한지 묻는 질문', '필요하면 Yes, please. 아니면 No, thanks. I have one.', c => c.bag === false ? 'bg_no' : 'g_yesp', { turn: '봉투', offer: true, yn: { yes: c => c.bag == null ? null : !!c.bag } }),
    paym: I('or', '현금과 카드 가운데 고르라는 질문', '고른 것 + please → Card, please.', 'pm_pl', { turn: '내는 방법', key: 'paym' }),
    receipt: I('yn', '영수증이 필요한지 묻는 질문', '필요하면 Yes, please. 아니면 No, thanks.', c => c.receipt === false ? 'g_no' : 'g_yesp', { turn: '영수증', yn: { yes: c => c.receipt == null ? null : !!c.receipt } }),
    retwhat: I('wh', '무엇을 도와줄지 묻는 질문', 'I\'d like to return this. · I\'d like to exchange these.', c => c.ret === 'exchange' ? 'rt_exch' : 'rt_ret', { turn: '교환 · 환불' }),
    rcpt: I('yn', '영수증을 가져왔는지 묻는 질문', '있으면 Yes, here it is. 없으면 No, I\'m sorry. I don\'t.', c => c.receipt === false ? 'rc_none' : 'rc_here', { turn: '영수증 확인', yn: { yes: c => c.receipt == null ? null : !!c.receipt, need: '영수증을 건네며 → Yes, here it is.' } }),
    reason: I('wh', '돌려주는 까닭을 묻는 질문', 'It\'s too small. · They\'re too big. · I changed my mind.', c => c.fit === 'mind' ? 'rs_mind' : c.two ? 'rs_theyre' : 'rs_its', { turn: '까닭' }),
    way: I('or', '환불과 가게 포인트(store credit) 가운데 고르라는 질문', '고른 것 + please → A refund, please.', 'wy_pl', { turn: '돌려받는 방법', key: 'way' }),
    exsize: I('wh', '어떤 크기로 바꿀지 묻는 질문', '크기 + please → A large, please. (작으면 한 칸 큰 것)', 'sz_pl', { turn: '바꿀 크기' }),
    credit: I('yn', '가게 포인트로만 돌려받아도 괜찮은지 묻는 질문', '괜찮으면 Yes, that\'s fine. 아니면 No, thank you.', c => c.creditOk === false ? 'cr_no' : 'cr_ok', { turn: '가게 포인트', yn: { yes: c => c.creditOk == null ? null : c.creditOk !== false } }),
    final: I('note', '돌려받을 수 없다는 안내', '따지지 말고 → I see. Thank you anyway.', 'fn_ok', { turn: '돌려받을 수 없음', say: '가게 규칙 때문에 돌려받을 수 없다는 안내예요. 따지지 말고 알겠다고 말해요' }),
    repair: I(null, '다시 묻는 말', '', 'rp_again'),
  };
  SH.sayOf = intent => { const it = SH.INTENT[intent]; return it.say || SH.SHAPE[it.shape].say; };
  SH.INTENT_KO = {}; Object.entries(SH.INTENT).forEach(([k, v]) => { SH.INTENT_KO[k] = v.turn || ''; });
  // 한 번만 나오는 뜻 — 다른 곳에서 미리 답했어도 시뮬레이터의 직원이 건너뜀
  // (입구에서 찾는 물건을 말했으면 물건 찾기 곳의 직원도 다시 묻지 않아요)
  SH.CROSS = { lookfor: 1 };

  /* =========================================================
     직원의 말. key: 열쇠 낱말(말 안에 꼭 있어야 함) · shape: 질문의 모양 · choices: 고르는 질문에서 고를 것
     fast: 너무 빨라 못 알아들은 말 · short: 지도에 쓰는 짧은 꼴 · fact: 그 말이 알려 준 사실(값 · 할인) · allow: 대답 대신 해도 되는 다시 묻기
     ========================================================= */
  SH.Q = {};
  const Q = (id, place, intent, en, ko, key, o = {}) => (SH.Q[id] = Object.assign({ id, place, intent, en, ko, key, shape: SH.INTENT[intent].shape, sp: SH.PLACE[place].sp }, o));
  // 입구 · 둘러보기
  Q('dr_help', 'door', 'browse', 'Hi, welcome to Maple & Thread! Can I help you find anything?', '안녕하세요, 메이플 앤 스레드예요! 찾으시는 것 도와드릴까요?', ['help you find'], { short: 'Can I help you find anything?' });
  Q('dr_gb', 'door', 'browse', 'Hiya, are you alright there?', '(영국) 안녕하세요, 괜찮으세요? → 도와드릴까요?', ['alright there'], { sp: 'gb', short: 'Are you alright there? (영국)' });
  Q('dr_fast', 'door', 'browse', 'Hey, you guys need help finding anything today?', '안녕하세요, 오늘 찾으시는 것 도와드릴까요?', ['help finding'], { fast: true });
  // 물건 찾기 (내가 먼저)
  Q('fd_pass', 'find', 'ask', 'Sure. Let me know if you need anything!', '네. 필요한 것 있으면 말씀하세요!', ['need anything'], { short: 'Let me know if you need anything!' });
  Q('fd_what', 'find', 'lookfor', 'Sure! What are you looking for?', '네! 무엇을 찾으세요?', ['What are you looking for'], { short: 'What are you looking for?' });
  // 진열대 · 크기와 색
  Q('rk_ok', 'rack', 'rack', 'Are you finding everything okay?', '잘 찾고 계세요?', ['finding everything okay'], { short: 'Are you finding everything okay?' });
  Q('rk_size', 'rack', 'size', 'What size are you looking for?', '어떤 크기를 찾으세요?', ['What size'], { short: 'What size?' });
  Q('rk_color', 'rack', 'color', 'Would you like it in navy or gray?', '남색으로 드릴까요, 회색으로 드릴까요?', ['navy or gray'], { choices: ['navy', 'gray'], short: 'Navy or gray?' });
  // 탈의실 (내가 먼저)
  Q('ft_pass', 'fit', 'tryon', 'The fitting rooms are right over there.', '탈의실은 바로 저쪽이에요.', ['fitting rooms'], { short: 'The fitting rooms are over there.' });
  Q('ft_items', 'fit', 'items', 'Sure! How many items do you have?', '네! 몇 벌 가지고 들어가세요?', ['How many items'], { short: 'How many items?' });
  Q('ft_how', 'fit', 'fit', 'How did everything fit?', '입어 보니 어떠세요?', ['How did'], { short: 'How did everything fit?' });
  Q('ft_next', 'fit', 'sizeup', 'Would you like to try a different size?', '다른 크기로 입어 보시겠어요?', ['different size'], { short: 'Try a different size?' });
  // 값 · 할인 (내가 먼저)
  Q('pr_pass', 'price', 'askprice', 'Let me know if you have any questions!', '궁금한 것 있으면 말씀하세요!', ['any questions'], { short: 'Let me know if you have any questions!' });
  Q('pr_cost', 'price', 'cost', 'It\'s $15.00 today. That\'s fifty percent off.', '오늘은 15달러예요. 50퍼센트 할인이에요.', ['percent off'], { fact: { amount: 1500, off: 50 }, short: 'It\'s $15.00 today.' });
  Q('pr_bogo', 'price', 'bogo', 'Our socks are buy one, get one free. Would you like to grab a pair?', '양말은 하나 사면 하나 더 드려요. 한 켤레 가져가시겠어요?', ['buy one, get one free'], { short: 'Buy one, get one free.' });
  // 계산대
  Q('py_find', 'pay', 'found', 'Hi there! Did you find everything okay?', '안녕하세요! 찾으시던 것 다 찾으셨어요?', ['find everything'], { short: 'Did you find everything okay?' });
  Q('py_member', 'pay', 'member', 'Do you have a rewards card with us?', '저희 가게 회원 카드 있으세요?', ['rewards card'], { short: 'Do you have a rewards card?' });
  Q('py_bag', 'pay', 'bag', 'Would you like a bag?', '봉투 드릴까요?', ['a bag'], { short: 'Would you like a bag?' });
  Q('py_fast', 'pay', 'bag', 'You want a bag for that?', '봉투에 넣어 드릴까요?', ['bag'], { fast: true });
  Q('py_pay', 'pay', 'paym', 'Your total is $21.00. Cash or card?', '모두 21달러예요. 현금으로 하시겠어요, 카드로 하시겠어요?', ['Cash or card'], { choices: ['cash', 'card'], fact: { amount: 2100 }, short: 'Cash or card?' });
  Q('py_rcpt', 'pay', 'receipt', 'Would you like your receipt?', '영수증 드릴까요?', ['receipt'], { short: 'Would you like your receipt?' });
  // 교환 · 환불 (내가 먼저)
  Q('rt_help', 'ret', 'retwhat', 'Hi, how can I help you?', '안녕하세요, 무엇을 도와드릴까요?', ['how can I help'], { short: 'How can I help you?' });
  Q('rt_rcpt', 'ret', 'rcpt', 'Sure. Do you have your receipt?', '네. 영수증 있으세요?', ['receipt'], { short: 'Do you have your receipt?' });
  Q('rt_gb', 'ret', 'rcpt', 'Have you got your receipt?', '(영국) 영수증 있으세요?', ['got your receipt'], { sp: 'gb' });
  Q('rt_why', 'ret', 'reason', 'Okay. What\'s the reason for the return?', '네. 돌려주시는 까닭이 뭔가요?', ['reason'], { short: 'What\'s the reason?' });
  Q('rt_how', 'ret', 'way', 'Would you like a refund or store credit?', '환불해 드릴까요, 가게 포인트로 드릴까요?', ['refund or store credit'], { choices: ['refund', 'credit'], allow: ['what'], short: 'A refund or store credit?' });
  Q('rt_size', 'ret', 'exsize', 'No problem. What size would you like instead?', '네. 어떤 크기로 바꿔 드릴까요?', ['What size'], { short: 'What size instead?' });
  Q('rt_credit', 'ret', 'credit', 'Without a receipt, we can only give you store credit. Is that okay?', '영수증이 없으면 가게 포인트로만 드릴 수 있어요. 괜찮으세요?', ['store credit'], { short: 'Only store credit. Is that okay?' });
  Q('rt_final', 'ret', 'final', 'I\'m sorry, but we only take returns within thirty days.', '죄송하지만 30일 안에만 교환 · 환불해 드려요.', ['within thirty days'], { short: 'Only within thirty days.' });
  // 곳마다 대표 말 (영상 01장 지도 · 직접 해 보기)
  SH.ROUTE = {
    door: ['dr_help', 'dr_gb'], find: ['fd_pass', 'fd_what'], rack: ['rk_ok', 'rk_size'], fit: ['ft_pass', 'ft_how'],
    price: ['pr_pass', 'pr_cost'], pay: ['py_find', 'py_pay'], ret: ['rt_help', 'rt_how'],
  };

  /* =========================================================
     칸에 넣는 내 정보 (slot). 틀(frame)이 form으로 어느 꼴을 쓸지 정해요.
     fact: 이 값이 말하는 사실 · bad · why: 콩글리시 값(② 탈락) · note: 통하지만 덧붙일 말 · dyn: 값이 정해져 있지 않은 칸(값)
     ========================================================= */
  const itemVal = id => { const it = SH.ITEMS[id]; return { t: it.a, pl: it.pl, bare: it.en, ko: it.ko, fact: { item: id } }; };
  const COUNT_W = { 1: 'Just one', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' };
  SH.SLOT = {
    item: { key: 'item', vals: Object.assign(Object.fromEntries(Object.keys(SH.ITEMS).map(id => [id, itemVal(id)])), {
      yshirt: { t: 'a Y-shirt', pl: 'Y-shirts', bare: 'Y-shirt', ko: '와이셔츠', fact: { item: 'shirt' }, bad: 'literal', why: '‘와이셔츠’는 white shirt가 줄어서 생긴 한국식 말이라 영어로는 통하지 않아요 → a shirt · a dress shirt.' },
      onepiece: { t: 'a one-piece', pl: 'one-pieces', bare: 'one-piece', ko: '원피스', fact: { item: 'dress' }, bad: 'literal', why: '영어로 one-piece는 보통 한 벌로 된 수영복을 떠올려요. 원피스 → a dress.' },
      hoodt: { t: 'a hood T', pl: 'hood Ts', bare: 'hood T', ko: '후드 티', fact: { item: 'hoodie' }, bad: 'literal', why: '‘후드 티’는 한국식 말이라 영어로는 통하지 않아요 → a hoodie.' },
      padding: { t: 'a padding', pl: 'paddings', bare: 'padding', ko: '패딩', fact: { item: 'jacket' }, bad: 'literal', why: '영어로 padding은 옷 속에 넣는 솜 · 충전재예요. 패딩 점퍼 → a puffer jacket · a down jacket.' },
    }) },
    size: { key: 'size', vals: Object.assign(Object.fromEntries(Object.entries(SH.SIZE).map(([id, z]) => [id, { t: z.low, bare: z.bare, ko: z.ko, kind: z.kind }])), {
      msize: { t: 'M size', bare: 'M size', ko: 'M 사이즈', fact: { size: 'm' }, kind: 'top', note: 'M size도 알아듣지만 보통 → a medium. (S → a small · L → a large)' },
      free: { t: 'free size', bare: 'free size', ko: '프리 사이즈', fact: { size: 'one' }, kind: 'top', bad: 'literal', why: '‘프리 사이즈’는 한국식 말이라 공짜(free)로 들릴 수 있어요. 누구에게나 맞는 한 가지 크기 → one size. 크기가 여럿이면 내 크기를 말해요 → A medium, please.' },
    }) },
    color: { key: 'color', vals: Object.fromEntries(Object.entries(SH.COLORS).map(([id, c]) => [id, { t: id, ko: c.ko }])) },
    // 바꿀 점 하나 (in + 크기 · 색)
    chg: { key: 'chg', vals: Object.assign(
      Object.fromEntries(Object.entries(SH.SIZE).map(([id, z]) => ['z_' + id, { t: 'in ' + z.low, ko: z.ko, fact: { size: id }, kind: z.kind }])),
      Object.fromEntries(Object.entries(SH.COLORS).map(([id, c]) => ['k_' + id, { t: 'in ' + id, ko: c.ko, fact: { color: id } }]))) },
    dem: { key: 'two', vals: { this: { t: 'this', ko: '이것', fact: { two: false } }, these: { t: 'these', ko: '이것들(둘이 짝)', fact: { two: true } } } },
    it: { key: 'two', vals: { it: { t: 'it', ko: '그것', fact: { two: false } }, them: { t: 'them', ko: '그것들(둘이 짝)', fact: { two: true } } } },
    count: { key: 'count', vals: Object.fromEntries([1, 2, 3, 4, 5].map(n => ['n' + n, { t: COUNT_W[n], low: COUNT_W[n].toLowerCase(), ko: `${n}벌`, fact: { count: n } }])) },
    fit: { key: 'fit', vals: Object.fromEntries(Object.entries(SH.FIT).map(([id, f]) => [id, { t: f.t, ko: f.ko }])) },
    money: { key: 'amount', dyn: 'money' },
    paym: { key: 'paym', vals: { cash: { t: 'cash', ko: '현금' }, card: { t: 'card', ko: '카드' } } },
    way: { key: 'way', vals: { refund: { t: 'a refund', ko: '환불(돈으로 돌려받기)' }, credit: { t: 'store credit', ko: '가게 포인트(store credit)' } } },
  };
  // 칸 값 하나 (값이 정해져 있지 않은 칸도)
  SH.sv = function (slot, v) {
    const S = SH.SLOT[slot]; if (!S || v == null) return null;
    if (S.dyn === 'money') return /^\d+$/.test(String(v)) ? { t: SH.money(+v), ko: SH.priceKo(+v), fact: { amount: +v } } : null;
    return S.vals[v] || null;
  };
  const valFact = (slot, v) => { const x = SH.sv(slot, v); if (!x) return {}; return x.fact ? Object.assign({}, x.fact) : { [SH.SLOT[slot].key]: v }; };
  SH.valFact = valFact;
  // 카드와 맞는 칸 값 (콩글리시 · 알림이 붙는 값은 빼고)
  const slotIds = slot => { const S = SH.SLOT[slot]; return S.dyn ? [] : Object.keys(S.vals).filter(id => { const x = S.vals[id]; return !x.bad && !x.note; }); };
  SH.slotIds = slotIds;
  SH.slotVal = function (slot, C) {
    const S = SH.SLOT[slot];
    if (S.dyn) { const v = C[S.key]; return v != null && SH.sv(slot, v) ? String(v) : null; }
    if (slot === 'chg') { const ch = SH.changes(C); return ch.length ? (ch[0] === 'size' ? 'z_' + C.size : 'k_' + C.color) : null; }
    return slotIds(slot).find(id => { const f = valFact(slot, id); return Object.keys(f).length && Object.keys(f).every(k => C[k] === f[k]); }) || null;
  };

  /* =========================================================
     바꿀 점 한 줄 — 조각과 순서: Do you have → this · these → in + 크기 · in + 색 (크기와 색은 어느 쪽이 먼저여도 돼요)
     손에 든 것과 다른 점만 말해요. (자주 쓰는 순서를 단순하게 줄인 규칙)
     줄 = { words: [조각 id, …] }
     ========================================================= */
  SH.OW = {
    have: { c: 'open', t: 'Do you have' }, could: { c: 'open', t: 'Could I try' }, give: { c: 'open', t: 'Give me', blunt: true },
    this: { c: 'dem', t: 'this', fact: { two: false } }, these: { c: 'dem', t: 'these', fact: { two: true } },
  };
  Object.entries(SH.SIZE).forEach(([id, z]) => { SH.OW['z_' + id] = { c: 'size', t: 'in ' + z.low, fact: { size: id }, kind: z.kind }; });
  Object.keys(SH.COLORS).forEach(id => { SH.OW['k_' + id] = { c: 'color', t: 'in ' + id, fact: { color: id } }; });
  Object.entries(SH.OW).forEach(([id, w]) => { w.id = id; });
  SH.OCAT = { open: { ko: '묻는 틀', n: 1 }, dem: { ko: '이것(this · these)', n: 2 }, size: { ko: '바꿀 크기', n: 3 }, color: { ko: '바꿀 색', n: 3 } };
  SH.changeLine = function (L, C = {}) {
    const ws = L.words || L, W = ws.map(w => SH.OW[w]);
    if (!ws.length) return { ok: false, stage: 1, why: '아직 아무것도 고르지 않았어요.' };
    if (W.some(x => !x)) return { ok: false, stage: 2, why: '사전에 없는 조각이 있어요.' };
    const at = c => W.map((x, i) => (x.c === c ? i : -1)).filter(i => i >= 0), n = c => at(c).length;
    for (const c of Object.keys(SH.OCAT)) if (n(c) > 1) return { ok: false, stage: 2, why: `${eun(SH.OCAT[c].ko)} 한 번만 말해요.` };
    if (!n('open')) return { ok: false, stage: 1, why: '묻는 틀(Do you have …?)이 빠졌어요. 조각만 늘어놓으면 무엇을 바라는지 알기 어려워요.' };
    const want = ws.slice().sort((a, b) => SH.OCAT[SH.OW[a].c].n - SH.OCAT[SH.OW[b].c].n);
    if (!n('dem')) return { ok: false, stage: 2, why: '무엇을 두고 묻는지(this · these)가 빠졌어요. 손에 든 것을 보여 주며 → this · 둘이 짝이면 these.' };
    if (!n('size') && !n('color')) return { ok: false, stage: 2, why: '바꿀 점이 빠졌어요. 손에 든 것과 무엇이 다른지 in + 크기 · 색으로 말해요.' };
    for (let k = 1; k < W.length; k++) {
      const p = W[k - 1], q = W[k];
      if (SH.OCAT[q.c].n < SH.OCAT[p.c].n) {
        const why = q.c === 'open' ? '묻는 틀(Do you have) → 맨 앞에 와요.' : '이것(this · these) → 묻는 틀 바로 뒤, 바꿀 점보다 앞에 와요.';
        return { ok: false, stage: 2, why: `순서가 뒤섞여 알아듣기 어려워요. ${why} 자연스러운 순서 → ${SH.lineText({ words: want })}`, want };
      }
    }
    const it = C.item && SH.ITEMS[C.item], z = n('size') ? W[at('size')[0]] : null;
    if (z && it && z.kind !== it.kind) return { ok: false, stage: 2, why: `${it.ko}의 크기는 ${SH.KIND_KO[it.kind]}로 말해요.`, want };
    const parts = W.map(x => SH.OCAT[x.c].ko).filter((k, i, a) => a.indexOf(k) === i).join(' → ');
    return { ok: true, why: `순서 → ${parts}. 자연스러워요.`, want };
  };
  SH.lineFacts = L => { const f = {}; (L.words || L).forEach(w => { const x = SH.OW[w]; if (x && x.fact) Object.assign(f, x.fact); }); return f; };
  function lineSegs(L) {
    const ws = L.words || L, W = ws.map(w => SH.OW[w]).filter(Boolean), out = [];
    let first = true;
    const push = (t, r, part) => { if (first && t) { t = t[0].toUpperCase() + t.slice(1); first = false; } out.push({ t, r, part }); };
    W.forEach((x, i) => {
      if (i) out.push({ t: ' ', r: 'frame' });
      if (x.c === 'open') { if (x.id === 'could') { push('Could I', 'pol', 'open'); out.push({ t: ' try', r: 'frame', part: 'open' }); } else push(x.t, 'frame', 'open'); }
      else if (x.c === 'dem') push(x.t, 'frame', 'dem');
      else push(x.t, 'slot', x.c);
    });
    if (out.length) out.push({ t: W.some(x => x.blunt) || !W.some(x => x.c === 'open') ? '.' : '?', r: 'frame' });
    return out;
  }
  SH.lineText = L => lineSegs(L).map(s => s.t).join('');
  SH.lineHasBlunt = L => (L.words || L).some(w => SH.OW[w] && SH.OW[w].blunt);

  /* =========================================================
     대답 틀 (frame). t: 틀 글 — ___ = 내 정보 칸, {…} = 공손한 말
     tag: ok · literal(한국어 그대로 · 콩글리시) · wrong(틀린 문장) · blunt(명령 · 조르기 · 따지기) · plain(그냥 No.로 끊김)
     bare: Yes · No만 하는 대답(yes: true · false) · check: 들은 값을 되물어 확인하는 말 · note: 통하지만 덧붙일 말
     nochange: 바꿀 점 없이 끝내는 대답(카드에 바꿀 점이 있으면 탈락)
     ========================================================= */
  SH.FRAME = {};
  const FR = (id, intent, t, ko, o = {}) => (SH.FRAME[id] = Object.assign({ id, intent, t, ko, tag: 'ok' }, o));
  // Yes · No만 하는 대답 (고르는 질문 · 정보 질문에는 ① 탈락)
  FR('g_yes', 'yn', 'Yes.', '네.', { bare: true, yes: true });
  FR('g_yesp', 'yn', 'Yes, {please}.', '네, 주세요.', { bare: true, yes: true });
  FR('g_no', 'yn', 'No, {thanks}.', '아니요, 괜찮아요.', { bare: true, yes: false });
  // 입구 · 둘러보기
  FR('br_look', 'browse', 'I\'m just looking, {thanks}.', '그냥 둘러보는 중이에요, 고마워요.', { fact: { look: true } });
  FR('br_for', 'browse', 'Yes, I\'m looking for ___.', '네, ___ 찾고 있어요.', { slot: 'item', fact: { look: false } });
  FR('br_eye', 'browse', 'Just eye shopping.', '(콩글리시) 그냥 아이쇼핑이요.', { fact: { look: true }, tag: 'literal', why: '‘아이쇼핑’은 한국에서 만든 말이라 영어로는 통하지 않아요. 가게 안에서 구경할 때는 → I\'m just looking, thanks. (window shopping은 사지 않고 진열창만 구경하는 것)' });
  FR('br_plain', 'browse', 'No.', '아니요.', { fact: { look: true }, tag: 'plain', why: '그냥 No.라고 끊으면 무뚝뚝하게 들려요. 도와주겠다는 말을 거절할 때는 → I\'m just looking, thanks.' });
  // 물건 찾기
  FR('ak_where', 'ask', '{Excuse me}, where can I find ___?', '저기요, ___ 어디 있어요?', { slot: 'item', form: 'pl' });
  FR('ak_is', 'ask', '{Excuse me}, where is ___?', '(틀린 말) 저기요, ___ 어디 있어요?', { slot: 'item', form: 'pl', tag: 'wrong', why: '여럿(hoodies · jeans)에는 is가 아니라 are예요. 틀 하나로 외워 두면 헷갈리지 않아요 → Excuse me, where can I find jeans?' });
  FR('ak_lit', 'ask', '___ where?', '(어색한 말) ___ 어디요?', { slot: 'item', form: 'pl', tag: 'literal', why: '‘청바지 어디요?’를 낱말 그대로 옮긴 말이에요. 묻는 틀이 없어서 알아듣기 어렵고 퉁명스럽게 들려요 → Excuse me, where can I find jeans?' });
  FR('lf_for', 'lookfor', 'I\'m looking for ___.', '___ 찾고 있어요.', { slot: 'item' });
  // 진열대 · 크기와 색
  FR('rk_good', 'rack', 'Yes, I am. {Thanks}.', '네, 잘 찾고 있어요. 고마워요.', { nochange: true });
  FR('ch_this', ['rack', 'sizeup'], 'Do you have this ___?', '이거 ___(으)로 있어요?', { slot: 'chg', fact: { two: false } });
  FR('ch_these', ['rack', 'sizeup'], 'Do you have these ___?', '이거(둘이 짝) ___(으)로 있어요?', { slot: 'chg', fact: { two: true } });
  FR('ch_msize', ['rack', 'sizeup'], 'M size is there?', '(어색한 말) M 사이즈 있어요?', { tag: 'literal', why: '‘M 사이즈 있어요?’를 낱말 순서 그대로 옮긴 말이에요. 묻는 틀이 없어서 알아듣기 어려워요. 이것 + 바꿀 점 → Do you have this in a medium?' });
  FR('ch_give', ['rack', 'sizeup'], 'Give me a bigger one.', '(명령) 더 큰 거 줘요.', { tag: 'blunt', why: '‘더 큰 거 주세요’를 그대로 옮긴 Give me는 명령처럼 들려요. bigger만으로는 얼마나 큰지도 몰라요. 이것 + 바꿀 점 → Do you have this in a large?' });
  FR('line', ['rack', 'sizeup'], '', '', { line: true });   // 바꿀 점 한 줄 (SH.changeLine)
  FR('sz_pl', ['size', 'exsize'], '___, {please}.', '___(으)로 주세요.', { slot: 'size' });
  FR('sz_im', 'size', 'I\'m ___.', '저는 ___예요.', { slot: 'size' });
  FR('cl_pl', 'color', '___, {please}.', '___(으)로 주세요.', { slot: 'color' });
  // 탈의실
  FR('to_could', 'tryon', '{Excuse me}, {could I} try ___ on?', '저기요, ___ 입어 봐도 될까요?', { slot: 'dem' });
  FR('to_fit', 'tryon', 'Can I fitting?', '(콩글리시) 피팅해도 돼요?', { tag: 'literal', why: '‘피팅해도 돼요?’를 옮긴 말이에요. fitting room(탈의실)의 fitting은 이렇게 쓰지 않아요. 입어 보는 것은 try on → Could I try this on?' });
  FR('to_wear', 'tryon', 'Can I wear ___?', '(어색한 말) ___ 입어도 돼요?', { slot: 'dem', tag: 'literal', why: 'wear는 ‘입고 있다 · 입고 다니다’라는 뜻이라 사서 입고 나가겠다는 말처럼 들려요. 입어 보는 것은 try on → Could I try this on?' });
  FR('it_n', 'items', '___.', '___이요.', { slot: 'count' });
  FR('fi_its', 'fit', 'It\'s a little ___.', '조금 ___.', { slot: 'fit', fact: { two: false } });
  FR('fi_theyre', 'fit', 'They\'re a little ___.', '(둘이 짝) 조금 ___.', { slot: 'fit', fact: { two: true } });
  FR('fi_good', 'fit', 'It fits great, {thanks}. I\'ll take it.', '잘 맞아요, 고마워요. 이걸로 할게요.', { fact: { fit: 'good', two: false } });
  FR('fi_goods', 'fit', 'They fit great, {thanks}. I\'ll take them.', '(둘이 짝) 잘 맞아요, 고마워요. 이걸로 할게요.', { fact: { fit: 'good', two: true } });
  FR('fi_yes', 'fit', 'Yes, it did.', '네, 그랬어요.', { tag: 'wrong', wrongShape: true, why: 'How did …? → 어땠는지 묻는 정보 질문이에요. Yes, it did.는 Did it …?(Yes/No 질문)의 대답이라 어땠는지가 빠졌어요 → It\'s a little tight.' });
  FR('su_try', 'sizeup', 'Yes, {could I} try ___?', '네, ___(으)로 입어 볼 수 있을까요?', { slot: 'size' });
  // 값 · 할인
  FR('pa_is', 'askprice', '{Excuse me}, how much is this?', '저기요, 이거 얼마예요?', { fact: { two: false, ask: 'price' } });
  FR('pa_are', 'askprice', '{Excuse me}, how much are these?', '저기요, 이거(둘이 짝) 얼마예요?', { fact: { two: true, ask: 'price' } });
  FR('pa_sale', 'askprice', '{Excuse me}, is this on sale?', '저기요, 이거 할인해요?', { fact: { two: false, ask: 'sale' } });
  FR('pa_sales', 'askprice', '{Excuse me}, are these on sale?', '저기요, 이거(둘이 짝) 할인해요?', { fact: { two: true, ask: 'sale' } });
  FR('pa_money', 'askprice', 'How much money?', '(어색한 말) 돈이 얼마예요?', { fact: { ask: 'price' }, tag: 'literal', why: '‘얼마예요?’를 ‘돈이 얼마’로 옮긴 말이에요. 값을 물을 때는 money를 붙이지 않아요 → Excuse me, how much is this?' });
  FR('pa_dc', 'askprice', 'D.C. is possible?', '(콩글리시) 디시 돼요?', { fact: { ask: 'sale' }, tag: 'literal', why: 'D.C.(디시)는 한국에서 쓰는 줄임말이라 영어로는 통하지 않아요. 할인하는지 물을 때는 → Is this on sale? · Is there a discount?' });
  FR('pc_take', 'cost', 'Great. I\'ll take ___.', '좋아요. 그걸로 할게요.', { slot: 'it', fact: { take: true } });
  FR('pc_check', 'cost', '{Sorry}, did you say ___?', '죄송한데, ___라고 하셨어요?', { slot: 'money', check: true });
  FR('pc_think', 'cost', 'I\'ll think about it. {Thanks}.', '생각해 볼게요. 고마워요.', { fact: { take: false } });
  FR('pc_cheap', 'cost', 'Too expensive. Cheaper, {please}.', '(조르는 말) 너무 비싸요. 깎아 주세요.', { tag: 'blunt', why: '‘너무 비싸요, 깎아 주세요’를 그대로 옮긴 말이에요. 이런 가게에서는 보통 값을 깎지 않고, 조르는 말처럼 들려요. 사지 않으려면 → I\'ll think about it. Thanks.' });
  FR('bo_no', 'bogo', 'No, {thanks}. I\'m good.', '아니요, 괜찮아요.', { fact: { bogo: false } });
  FR('bo_lit', 'bogo', 'Oh, one plus one?', '(콩글리시) 아, 원 플러스 원이요?', { fact: { bogo: true }, tag: 'literal', why: '‘1+1’은 한국에서 쓰는 말이에요. 영어로는 → buy one, get one free (줄여서 BOGO). 원하면 바로 → Yes, please.' });
  // 계산대
  FR('fd_did', 'found', 'Yes, I did. {Thanks}.', '네, 다 찾았어요. 고마워요.');
  FR('fd_found', 'found', 'Yes, I found.', '(틀린 말) 네, 찾았어요.', { tag: 'wrong', why: '‘네, 찾았어요’를 그대로 옮기면 found 뒤에 무엇을 찾았는지가 빠져 문장이 끝나지 않아요. Did you …? 질문에는 → Yes, I did.' });
  FR('mb_no', 'member', 'No, I don\'t.', '아니요, 없어요.', { fact: { member: false } });
  FR('mb_yes', 'member', 'Yes, I do. Here it is.', '네, 있어요. 여기요.', { fact: { member: true } });
  FR('mb_have', 'member', 'No, I don\'t have.', '(틀린 말) 아니요, 없어요.', { fact: { member: false }, tag: 'wrong', why: 'have 뒤에 무엇이 없는지가 빠져 문장이 끝나지 않아요. Do you have …? 질문에는 → No, I don\'t.' });
  FR('bg_no', 'bag', 'No, {thanks}. I have one.', '아니요, 괜찮아요. 가방이 있어요.', { fact: { bag: false } });
  FR('bg_vinyl', 'bag', 'Vinyl bag, {please}.', '(콩글리시) 비닐봉지 주세요.', { fact: { bag: true }, tag: 'literal', why: '‘비닐봉지’를 옮긴 vinyl bag은 비닐 소재로 만든 가방처럼 들려요. 비닐봉지 → a plastic bag. 봉투가 필요하면 → Yes, please.' });
  FR('pm_pl', 'paym', '___, {please}.', '___(으)로 할게요.', { slot: 'paym' });
  FR('pm_conf', 'paym', '{Sorry}, was that ___?', '죄송한데, ___였나요?', { slot: 'money', check: true });
  FR('rc_lit', 'receipt', 'Receipt, no need.', '(어색한 말) 영수증, 필요 없어요.', { fact: { receipt: false }, tag: 'literal', why: '‘영수증 필요 없어요’를 낱말 그대로 옮긴 말이라 어색하고 퉁명스럽게 들려요 → No, thanks.' });
  // 교환 · 환불
  FR('rt_ret', 'retwhat', 'I\'d like to return ___.', '___ 환불하고 싶어요.', { slot: 'dem', fact: { ret: 'return' } });
  FR('rt_exch', 'retwhat', 'I\'d like to exchange ___.', '___ 교환하고 싶어요.', { slot: 'dem', fact: { ret: 'exchange' } });
  FR('rt_refund', 'retwhat', 'Refund me.', '(명령) 환불해 줘요.', { fact: { ret: 'return' }, tag: 'blunt', why: '‘환불해 주세요’를 그대로 옮긴 Refund me.는 명령처럼 들려요. 하고 싶은 것을 말해요 → I\'d like to return this.' });
  FR('rt_change', 'retwhat', 'Change, {please}.', '(어색한 말) 교환이요.', { fact: { ret: 'exchange' }, tag: 'literal', why: '‘교환’을 change로 옮기면 거스름돈(change)을 달라는 말로 들려요. 바꾸고 싶으면 → I\'d like to exchange this.' });
  FR('rc_here', 'rcpt', 'Yes, here it is.', '네, 여기 있어요.', { fact: { receipt: true } });
  FR('rc_none', 'rcpt', 'No, I\'m sorry. I don\'t.', '아니요, 죄송해요. 없어요.', { fact: { receipt: false } });
  FR('rs_its', 'reason', 'It\'s too ___.', '너무 ___.', { slot: 'fit', fact: { two: false } });
  FR('rs_theyre', 'reason', 'They\'re too ___.', '(둘이 짝) 너무 ___.', { slot: 'fit', fact: { two: true } });
  FR('rs_mind', 'reason', 'I changed my mind.', '마음이 바뀌었어요.', { fact: { fit: 'mind' } });
  FR('wy_pl', 'way', '___, {please}.', '___(으)로 해 주세요.', { slot: 'way' });
  FR('cr_ok', 'credit', 'Yes, that\'s fine.', '네, 괜찮아요.', { fact: { creditOk: true } });
  FR('cr_no', 'credit', 'No, {thank you}.', '아니요, 괜찮아요.', { fact: { creditOk: false } });
  FR('fn_ok', 'final', 'I see. {Thank you} anyway.', '알겠어요. 어쨌든 고마워요.');
  FR('fn_bad', 'final', 'That\'s not fair! Give me my money back.', '(따지는 말) 말도 안 돼요! 돈 돌려줘요.', { tag: 'blunt', why: '따지고 명령하는 말이에요. 가게 규칙이라 직원이 바꿀 수 없어요 → I see. Thank you anyway.' });
  // 다시 묻기. echo: 들린 만큼 되묻는 말 — 실제로 들은 말이어야 통과 · kind what: 대답 대신 해도 되는 말(allow)
  FR('rp_again', 'repair', '{Sorry? Could you} say that again, {please}?', '죄송한데, 다시 한 번 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_sorry', 'repair', '{Sorry}?', '네? (다시 말해 달라는 뜻)', { kind: 'again' });
  FR('rp_slow', 'repair', '{Could you} speak a little more slowly, {please}?', '조금 더 천천히 말씀해 주시겠어요?', { kind: 'slow' });
  FR('rp_bag', 'repair', '{Sorry}, did you say a bag?', '죄송한데, 봉투라고 하셨어요?', { kind: 'echo', echo: 'bag' });
  FR('rp_help', 'repair', '{Sorry}, did you ask if I need help?', '죄송한데, 도움이 필요한지 물으셨어요?', { kind: 'echo', echo: 'browse' });
  FR('rp_what', 'repair', '{Sorry}, what\'s store credit?', '죄송한데, store credit이 뭐예요?', { kind: 'what' });
  FR('rp_rude', 'repair', 'What?', '(퉁명스러운 말) 뭐라고요?', { kind: 'again', tag: 'blunt', why: 'What? 한 낱말은 퉁명스럽게 들릴 수 있어요. 못 알아들었으면 → Sorry? Could you say that again, please?' });

  /* ---------- 대답 글 만들기: 조각(segs) = [{ t, r: 'frame' | 'slot' | 'pol', req }] ---------- */
  const slotText = (F, v) => { const x = SH.sv(F.slot, v); return x ? (x[F.form || 't'] != null ? x[F.form || 't'] : x.t) : '___'; };
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
  SH.segs = function (a) {
    const F = SH.FRAME[a.f];
    if (F.line) return lineSegs(a.line);
    return frameSegs(F, a.v);
  };
  SH.text = a => SH.segs(a).map(s => s.t).join('');
  // 해석
  const koOf = (F, v) => {
    if (!F.slot) return F.ko;
    const x = SH.sv(F.slot, v), k = x ? x.ko : '___';
    return F.ko.replace('___(으)로', ro(k)).replace('___(이)에요', ieyo(k)).replace('___(이)가', ig(k)).replace('___(을)를', eul(k)).replace('___예요', ieyo(k)).replace('___', k);
  };
  SH.ko = function (a) {
    const F = SH.FRAME[a.f];
    if (F.line) {
      const f = SH.lineFacts(a.line), parts = [];
      if (f.size) parts.push(SH.SIZE[f.size].ko); if (f.color) parts.push(SH.COLORS[f.color].ko);
      const give = SH.lineHasBlunt(a.line);
      return `${f.two ? '이거(둘이 짝)' : '이거'} ${parts.join(' · ') || '…'}${give ? '(으)로 줘요. (무례한 말)' : '(으)로 있어요?'}`;
    }
    return koOf(F, a.v);
  };
  // 대답이 말하는 사실
  SH.factOf = function (a) {
    const F = SH.FRAME[a.f], f = Object.assign({}, F.fact || {});
    if (F.slot && SH.sv(F.slot, a.v)) Object.assign(f, valFact(F.slot, a.v));
    if (F.line) Object.assign(f, SH.lineFacts(a.line));
    return f;
  };
  // 사실을 한국어로
  SH.factKo = function (k, v) {
    if (k === 'item') return SH.ITEMS[v] ? `${SH.ITEMS[v].ko}(${SH.ITEMS[v].en})` : String(v);
    if (k === 'size' || k === 'hsize') return SH.SIZE[v] ? SH.SIZE[v].ko : v === 'one' ? '한 가지 크기(one size)' : String(v);
    if (k === 'color' || k === 'hcolor') return SH.COLORS[v] ? SH.COLORS[v].ko : String(v);
    if (k === 'two') return v ? '둘이 짝(these · they · them)' : '하나(this · it)';
    if (k === 'look') return v ? '그냥 둘러보는 중' : '찾는 물건이 있음';
    if (k === 'count') return `${v}벌`;
    if (k === 'fit') return v === 'good' ? '잘 맞음' : v === 'mind' ? '마음이 바뀜' : (SH.FIT[v] || {}).ko || String(v);
    if (k === 'ask') return v === 'sale' ? '할인하는지 묻기' : '값 묻기';
    if (k === 'take') return v ? '사기' : '사지 않고 생각해 보기';
    if (k === 'amount') return `${SH.money(v)} (${SH.priceWords(v)})`;
    if (k === 'off') return `${v}% 할인`;
    if (k === 'bogo') return v ? '양말도 받기(하나 사면 하나 더)' : '양말은 사지 않음';
    if (k === 'member') return v ? '회원 카드 있음' : '회원 카드 없음';
    if (k === 'bag') return v ? '봉투 필요' : '봉투 필요 없음';
    if (k === 'receipt') return v ? '영수증 있음(받기)' : '영수증 없음(받지 않기)';
    if (k === 'ret') return v === 'exchange' ? '교환' : '환불';
    if (k === 'creditOk') return v ? '가게 포인트도 괜찮음' : '가게 포인트는 받지 않음';
    const S = Object.values(SH.SLOT).find(s => s.key === k && s.vals && s.vals[v]);
    return S ? S.vals[v].ko : String(v);
  };

  /* ---------- 이미 답한 질문 (시뮬레이터의 직원이 건너뜀) ---------- */
  const KEY2INTENT = { item: ['lookfor'], size: ['size'], color: ['color'] };
  SH.coveredBy = (facts, intent) => { const out = new Set(intent ? [intent] : []); Object.keys(facts).forEach(k => (KEY2INTENT[k] || []).forEach(i => out.add(i))); return [...out]; };
  SH.covered = (a, q) => { if (typeof q === 'string') q = SH.Q[q]; return SH.coveredBy(SH.factOf(a), q.intent); };
  SH.coveredKo = cov => cov.filter(i => !['browse', 'ask', 'rack', 'sizeup', 'exsize'].includes(i)).map(i => SH.INTENT_KO[i]).filter((x, i, a) => x && a.indexOf(x) === i);

  /* =========================================================
     판정 — SH.judge(직원의 말, 대답, 카드, 출처)
     q: SH.Q의 말(또는 id) · a: { f: 틀 id, v: 칸 값, line } · card: 사실 · src: '카드' | '상황'
     ========================================================= */
  const res = (ok, stage, why, tag) => ({ ok, stage, why, tag: tag || (ok ? 'ok' : '') });
  const shapeHead = q => `${q.key.join(' … ')} → ${SH.SHAPE[q.shape].ko}`;
  const twoWhy = (C, two) => { const it = SH.ITEMS[C.item]; return `${it ? eun(it.ko) + ' ' : ''}${C.two ? '둘이 짝이라 these · they · them' : '하나라 this · it'}으로 말해요. 이 대답: ${two ? 'these · they · them' : 'this · it'}.`; };
  const SIZE_INTENTS = { sizeup: 1, exsize: 1 };
  SH.judge = function (q, a, card, src = '카드') {
    if (typeof q === 'string') q = SH.Q[q];
    const F = SH.FRAME[a.f], C = Object.assign({}, card || {}, q.fact || {});
    const fi = [].concat(F.intent), key = q.key.join(' … '), In = SH.INTENT[q.intent], SHp = SH.SHAPE[q.shape];
    let allowed = false;
    const notes = [];
    // ① 열쇠 낱말 + 질문의 모양 잡기
    if (q.fast) {
      if (F.intent !== 'repair') return res(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 묻는지 모르는데 짐작해서 답하면 엉뚱한 대답이 될 수 있어요. 먼저 다시 물어요.', 'guess');
      if (F.kind === 'echo' && F.echo !== q.intent) return res(false, 1, `되물은 말이 달라요. 들린 낱말(${key})로 보면 직원은 ${In.turn}에 대해 물었어요.`, 'intent');
    } else if (F.bare) {
      if (q.shape === 'or') return res(false, 1, `${shapeHead(q)}. 둘 가운데 하나를 고르라는 말이라 ${F.yes ? 'Yes' : 'No'}만으로는 무엇을 골랐는지 알 수 없어요 → ${In.want}`, 'shape');
      if (q.shape === 'wh') return res(false, 1, `${shapeHead(q)}. 정보를 묻는 말이라 ${F.yes ? 'Yes' : 'No'}로는 답이 안 돼요 → ${In.want}`, 'shape');
      if (q.shape === 'note') return res(false, 1, `열쇠 낱말 ${key} → ${SH.sayOf(q.intent)}. 묻는 말이 아니라서 ${F.yes ? 'Yes' : 'No'}로 답할 일이 아니에요 → ${In.want}`, 'shape');
    } else if (!fi.includes(q.intent)) {
      if (F.intent === 'repair' && q.allow && q.allow.includes(F.kind)) allowed = true;
      else if (F.intent === 'repair') return res(false, 1, '대답이 아니라 다시 묻는 말이에요. 알아들었다면 바로 답해요.', 'intent');
      else {
        const other = SH.INTENT[fi[0]];
        return res(false, 1, `${shapeHead(q)}${q.shape === 'note' ? '' : `(${SHp.ans})`}. 이 대답은 ${other.ans}에 맞는 말이에요.`, 'intent');
      }
    }
    if (F.wrongShape && (q.shape === 'wh' || q.shape === 'or')) return res(false, 1, `${shapeHead(q)}. ${F.why}`, 'shape');
    // 고르는 질문: 직원이 말한 것 가운데 골랐나
    const fact = SH.factOf(a);
    if (q.shape === 'or' && q.choices && !F.bare && F.intent !== 'repair' && In.key) {
      const v = fact[In.key];
      if (v != null && !q.choices.includes(v)) return res(false, 1, `${shapeHead(q)}. 직원이 말한 것(${q.choices.map(c => SH.factKo(In.key, c)).join(' · ')}) 가운데 하나를 골라요. ${eun(SH.factKo(In.key, v))} 묻지 않았어요.`, 'choice');
    }
    if (F.line) { const o = SH.changeLine(a.line, C); if (!o.ok && o.stage === 1) return res(false, 1, o.why, 'intent'); }
    // ② 틀에 내 정보 넣기
    if (F.tag === 'literal' || F.tag === 'wrong') return res(false, 2, F.why, F.tag);
    const sv = F.slot ? SH.sv(F.slot, a.v) : null;
    if (F.slot && !sv && !F.line) return res(false, 2, '칸이 비었어요.', 'fact');
    if (sv && sv.bad) return res(false, 2, sv.why, sv.bad);
    if (F.bare) {
      const Y = In.yn, want = Y && Y.yes ? Y.yes(C) : null;
      if (want != null && want !== F.yes) return res(false, 2, `${wa(src)} 달라요. ${src}: ${F.yes ? 'No' : 'Yes'} 쪽이에요(${In.turn}). 이 대답: ${F.yes ? 'Yes' : 'No'}.`, 'fact');
      if (F.yes && Y && Y.strict) return res(false, 2, Y.strict, 'need');
      if (F.yes && Y && Y.need) notes.push(Y.need);
    }
    if (F.line) { const o = SH.changeLine(a.line, C); if (!o.ok) return res(false, 2, o.why, 'order'); }
    if (F.check) {
      const k = SH.SLOT[F.slot].key;
      if (C[k] != null && fact[k] !== C[k]) return res(false, 2, `직원이 말한 값과 달라요. 직원: ${SH.factKo(k, C[k])} · 이 대답: ${SH.factKo(k, fact[k])}.`, 'fact');
    } else {
      if (fact.two != null && C.two != null && fact.two !== C.two) return res(false, 2, twoWhy(C, fact.two), 'fact');
      const it = SH.ITEMS[C.item];
      if (fact.size && SH.SIZE[fact.size] && it && SH.SIZE[fact.size].kind !== it.kind) return res(false, 2, `${it.ko}의 크기는 ${SH.KIND_KO[it.kind]}로 말해요.`, 'fact');
      if (q.intent === 'rack' || q.intent === 'sizeup') {
        if (F.nochange && SH.changes(C).length) return res(false, 2, `${src}: 바꿀 점이 있어요(${SH.changes(C).map(k => SH.factKo(k, C[k])).join(' · ')}). 바꿀 점까지 말하면 직원이 바로 찾아 줘요 → ${SH.text(SH.model(q, C))}`, 'fact');
        for (const k of q.intent === 'rack' ? ['size', 'color'] : ['color']) if (fact[k] != null && C['h' + k] != null && fact[k] === C['h' + k]) return res(false, 2, `손에 든 것도 ${ieyo(SH.factKo(k, fact[k]))}. 같은 점은 말하지 않고 바꿀 점만 말해요.`, 'same');
      }
      if (SIZE_INTENTS[q.intent] && fact.size && C.size && C.hsize && SH.FIT[C.fit] && fact.size !== C.size && it) {
        const Ls = SH.SIZES[it.kind], d = Ls.indexOf(fact.size) - Ls.indexOf(C.hsize), up = SH.FIT[C.fit].up, fk = SH.FIT[C.fit].ko;
        if (d === 0) return res(false, 2, `지금 크기(${SH.SIZE[C.hsize].tag})와 같아요. ${fk} → 한 칸 ${up > 0 ? '큰' : '작은'} 크기 → ${SH.SIZE[C.size].low}.`, 'fact');
        if (Math.sign(d) !== up) return res(false, 2, `거꾸로예요. ${fk} → 한 칸 ${up > 0 ? '큰' : '작은'} 크기 → ${SH.SIZE[C.size].low}.`, 'fact');
      }
      for (const k of Object.keys(fact)) {
        if (C[k] === undefined || C[k] === fact[k]) continue;
        return res(false, 2, `${wa(src)} 달라요. ${src}: ${SH.factKo(k, C[k])} · 이 대답: ${SH.factKo(k, fact[k])}.`, 'fact');
      }
    }
    // ③ 공손하게 끝내기
    if (F.tag === 'blunt' || F.tag === 'plain') return res(false, 3, F.why, F.tag);
    if (F.line && SH.lineHasBlunt(a.line)) return res(false, 3, 'Give me로 시작하면 명령처럼 들려요. 바꿀 점은 묻는 말로 → Do you have this in …?', 'blunt');
    // 통과
    const segs = SH.segs(a), pol = segs.filter(s => s.r === 'pol').map(s => s.t).filter((x, i, arr) => arr.indexOf(x) === i);
    let why;
    if (q.fast) why = F.kind === 'echo' ? '들린 만큼 되물어 확인했어요. 무엇에 대해 물었는지 알면 그 부분만 다시 물을 수 있어요.' : F.kind === 'slow' ? '천천히 말해 달라고 공손하게 부탁했어요.' : '못 알아들었을 때는 짐작하지 말고 공손하게 다시 물어요.';
    else if (allowed) why = '모르는 낱말은 짐작하지 말고 물어요. 직원이 쉬운 말로 다시 알려 줄 거예요(store credit = 그 가게에서만 쓰는 돈).';
    else if (F.line) {
      const o = SH.changeLine(a.line, C), cov = SH.coveredKo(SH.covered(a, q));
      why = `${o.why} 손에 든 것과 다른 점만 말했어요.${cov.length ? ` 한 줄에 ${cov.join(' · ')}까지 말해서 직원이 그 질문을 건너뛰어요.` : ''}`;
    } else if (F.check) why = `직원이 말한 값(${SH.factKo(SH.SLOT[F.slot].key, C[SH.SLOT[F.slot].key])})과 같아요. 숫자가 헷갈리면 이렇게 되물어 확인해요.`;
    else if (F.bare) why = `${shapeHead(q)} → ${SHp.ans}. Yes/No 질문이라 ${F.yes ? 'Yes' : 'No'}로 답할 수 있어요.`;
    else {
      const sl = segs.filter(s => s.r === 'slot').map(s => s.t), fk = Object.keys(fact).filter(k => fact[k] != null);
      why = `${shapeHead(q)} → ${SHp.ans}. ` + (sl.length ? `틀 + 내 정보(${sl.join(' ')}) → ${src}의 사실과 맞아요.` : fk.length ? `${src}의 사실(${fk.map(k => SH.factKo(k, fact[k])).join(' · ')})과 맞아요.` : '짧은 대답이면 충분해요.');
      if (q.shape === 'yn' && In.offer && !/^(Yes|No)\b/.test(SH.text(a))) why += ` ${SHp.offer}.`;
      if ((q.intent === 'rack' || q.intent === 'sizeup') && F.slot === 'chg') why += ' 이것 + 바꿀 점 → 손에 든 것과 다른 점만 말했어요.';
      if (SIZE_INTENTS[q.intent] && SH.FIT[C.fit] && C.hsize) why += ` ${SH.FIT[C.fit].ko} → 한 칸 ${SH.FIT[C.fit].up > 0 ? '큰' : '작은'} 크기예요.`;
      if (fact.two != null && C.item) why += fact.two ? ' 둘이 짝 → these · they · them.' : '';
      const cov = SH.coveredKo(SH.covered(a, q).filter(i => i !== q.intent));
      if (cov.length) why += ` ${cov.join(' · ')}까지 말해서 직원이 그 질문을 건너뛰어요.`;
    }
    if (pol.length) why += ` 공손한 말 → ${pol.join(' · ')}.`;
    notes.forEach(n => { why += ` ${n}`; });
    if (F.note) why += ` ${F.note}`;
    if (sv && sv.note) why += ` ${sv.note}`;
    return res(true, 0, why);
  };
  const In = q => SH.INTENT[q.intent];
  // 모범 대답 (카드에 맞춰)
  SH.model = function (q, card) {
    if (typeof q === 'string') q = SH.Q[q];
    const C = Object.assign({}, card || {}, q.fact || {});
    if (q.fast) return { f: q.intent === 'browse' ? 'rp_help' : 'rp_again' };
    if (q.intent === 'sizeup') return { f: 'su_try', v: C.size };
    if (q.intent === 'rack') {
      const ch = SH.changes(C);
      if (!ch.length) return { f: 'rk_good' };
      if (ch.length === 2) return SH.modelLine(C);
      return { f: C.two ? 'ch_these' : 'ch_this', v: SH.slotVal('chg', C) };
    }
    const id = typeof In(q).best === 'function' ? In(q).best(C) : In(q).best, F = SH.FRAME[id];
    if (!F.slot) return { f: id };
    const v = SH.slotVal(F.slot, C);
    return { f: id, v: v != null ? String(v) : (SH.SLOT[F.slot].dyn ? undefined : slotIds(F.slot)[0]) };
  };
  // 바꿀 점 한 줄의 모범 (손에 든 것과 다른 크기 · 색)
  SH.modelLine = C => ({ f: 'line', line: { words: ['have', C.two ? 'these' : 'this'].concat(SH.changes(C).map(k => k === 'size' ? 'z_' + C.size : 'k_' + C.color)) } });

  /* =========================================================
     소리로 한 대답 맞춰 보기 — SH.matchSpoken(들린 글, 말, 카드)
     음성 인식이 글로 바꾼 말에 그 말의 표시 낱말과 카드의 사실이 들어 있으면 받아들여요.
     질문의 모양 규칙은 같아요: 고르는 질문 · 정보 질문에 yes · no만 들리면 ①. 숫자는 낱말(fifteen · twenty-nine forty)이든 숫자든 같게 맞춰요.
     this · these처럼 사실이 달라지는 말은 맞춰 보고, 문법 · 공손함 · 발음은 판정하지 않아요(알림만 붙여요).
     ========================================================= */
  const CONTR = [[/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\bwhat's\b/g, 'what is'], [/\bdon't\b/g, 'do not'], [/\bdidn't\b/g, 'did not'], [/\bi've\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\bcan't\b/g, 'cannot'], [/\bi'd\b/g, 'i would'], [/\byou're\b/g, 'you are'], [/\bthat's\b/g, 'that is'], [/\bthere's\b/g, 'there is'], [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bdoesn't\b/g, 'does not'], [/\bthey're\b/g, 'they are'], [/\bhere's\b/g, 'here is'], [/\bwe're\b/g, 'we are'], [/\blet's\b/g, 'let us']];
  SH.norm = function (s) {
    let t = String(s || '').toLowerCase().replace(/[’‘]/g, '\'');
    CONTR.forEach(([r, w]) => { t = t.replace(r, w); });
    t = t.replace(/\$/g, ' ').replace(/(\d)\.(\d)/g, '$1 $2').replace(/%/g, ' percent ').replace(/\+/g, ' plus ').replace(/[^a-z0-9' -]+/g, ' ').replace(/-/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '');
    return t.split(/\s+/).filter(Boolean);
  };
  const W2N = {}; Object.entries(NUMW).forEach(([n, w]) => { W2N[w] = +n; });
  // 낱말 → 숫자 줄로 모음: fifteen → 15 · twenty nine forty → 2940 · 29.40 → 2940 · fifty percent → 50 percent
  SH.canon = function (s) {
    const w = SH.norm(s), out = [];
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
  // 들린 값 (센트): fifteen dollars → 1500 · twenty nine forty → 2940 · 15 00 → 1500
  const heardMoney = toks => { const i = toks.findIndex(t => /^\d+$/.test(t)); if (i < 0) return null; const r = toks[i]; return r.length <= 2 || /^dollars?$/.test(toks[i + 1] || '') ? +r * 100 : +r; };
  const BARE_RE = /^(yes|yeah|yep|no|nope|please|sure|thanks|thank|you|okay|ok|of|course|it|is|i|do|am|not|that|would|like|great|uh|um|well)$/;
  const REPAIR_RE = /\b(say that again|pardon|repeat|more slowly|slow down|sorry what|come again)\b|^ ?sorry ?$/;
  const SPK = {
    item: [['yshirt', /\by shirts?\b/], ['onepiece', /\bone pieces?\b/], ['hoodt', /\bhood (t|tee)s?\b/], ['padding', /\bpaddings?\b/], ['tee', /\bt shirts?\b|\btees?\b/], ['shirt', /\bdress shirts?\b/], ['hoodie', /\bhoodies?\b|\bhoody\b/], ['jacket', /\b(puffer|down|padded) (jackets?|coats?)\b|\bpuffers?\b|\bjackets?\b/], ['dress', /\bdress(es)?\b/], ['jeans', /\bjeans\b/], ['sneakers', /\b(sneakers?|trainers?|running shoes)\b/], ['socks', /\bsocks?\b/], ['shirt', /\bshirts?\b/]],
    color: [['navy', /\b(navy|dark blue)\b/], ['black', /\bblack\b/], ['white', /\bwhite\b/], ['gray', /\bgr[ae]y\b/], ['beige', /\b(beige|tan|khaki)\b/], ['blue', /\bblue\b/]],
    fit: [['tight', /\btight\b/], ['loose', /\b(loose|baggy)\b/], ['small', /\bsmall\b/], ['big', /\b(big|large)\b/], ['short', /\bshort\b/], ['long', /\blong\b/]],
    paym: [['card', /\b(card|credit|debit)\b/], ['cash', /\bcash\b/]],
    way: [['credit', /\bcredit\b/], ['refund', /\b(refund|money back)\b/]],
  };
  const find = (k, s) => (SPK[k].find(([, r]) => r.test(s)) || [])[0];
  const itemOf = v => v ? (SH.ITEMS[v] ? v : (SH.SLOT.item.vals[v].fact || {}).item) : null;
  // 들린 크기: 물건의 크기 방법(kind)에 맞춰 찾음 → SH.SIZE id · 'msize' · 'free'
  SH.findSize = function (s, kind) {
    if (/\bfree size\b/.test(s)) return 'free';
    if (/\bm size\b/.test(s)) return 'msize';
    if (!kind || kind === 'top') {
      if (/\b(extra large|x large|xl)\b/.test(s)) return 'xl';
      if (/\b(extra small|x small|xs)\b/.test(s)) return 'xs';
      if (/\bmedium\b/.test(s)) return 'm';
      if (/\blarge\b/.test(s)) return 'l';
      if (/\bsmall\b/.test(s)) return 's';
      if (kind) return null;
    }
    const n = (s.match(/\b(\d{1,2})\b/) || [])[1];
    if (!n) return null;
    if ((!kind || kind === 'waist') && SH.SIZE['w' + n]) return 'w' + n;
    if ((!kind || kind === 'shoe') && SH.SIZE['u' + n]) return 'u' + n;
    return null;
  };
  // this · it → 하나(false) · these · they · them → 둘이 짝(true) · 없으면 null
  const twoOf = s => /\b(these|they|them|those)\b/.test(s) ? true : /\b(this|it|that)\b/.test(s) ? false : null;
  SH.matchSpoken = function (raw, q, card) {
    if (typeof q === 'string') q = SH.Q[q];
    const toks = SH.canon(raw), s = ' ' + toks.join(' ') + ' ', heard = SH.norm(raw).join(' ');
    if (!toks.length) return { ok: false, stage: 0, why: '들린 말이 없어요. 다시 말해 보세요.', heard: '' };
    const C = Object.assign({}, card || {}, q.fact || {}), SHp = SH.SHAPE[q.shape], It = SH.INTENT[q.intent], item = SH.ITEMS[C.item];
    const R = (ok, stage, why, o = {}) => Object.assign({ ok, stage, why, heard }, o);
    const notes = [];
    const pass = (why, cov) => R(true, 0, why + (notes.length ? ' 알림: ' + notes.join(' ') : ''), { note: notes.join(' '), covered: cov || [q.intent] });
    const keyMiss = () => R(false, 1, `${shapeHead(q)}(${SHp.ans}). 들린 말에 그 대답이 없어요.`);
    const differ = (k, v) => R(false, 2, `카드와 달라요. 카드: ${SH.factKo(k, C[k])} · 들린 말: ${SH.factKo(k, v)}.`, { tag: 'fact' });
    const twoCheck = () => { const t = twoOf(s); return t != null && C.two != null && t !== C.two ? R(false, 2, twoWhy(C, t), { tag: 'fact' }) : null; };
    const nums = runs(toks);
    const echoBag = /\bbag\b/.test(s), echoHelp = /\b(need help|help)\b/.test(s);
    // 빠른 말: 다시 묻는 말만 (들린 만큼 되묻는 말은 실제 질문과 같아야)
    if (q.fast) {
      if (/\b(sorry|did you say|did you ask)\b/.test(s) && (echoBag || echoHelp)) {
        const ok = echoBag ? q.intent === 'bag' : q.intent === 'browse';
        return ok ? R(false, 1, '들린 만큼 되물었어요. 직원이 다시 말해 줄 거예요.', { repair: 'again' }) : R(false, 1, `되물은 말이 달라요. 들린 낱말(${q.key.join(' … ')})로 보면 직원은 ${It.turn}에 대해 물었어요.`);
      }
      if (REPAIR_RE.test(s) || /\b(sorry|again|slowly)\b/.test(s)) return R(false, 1, '다시 묻는 말로 들었어요. 직원이 한 번 더 말해 줄 거예요.', { repair: 'again' });
      return R(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 짐작해서 답하지 말고 먼저 다시 물어요 → Sorry? Could you say that again, please?');
    }
    // 들은 값을 되묻는 말 (Sorry, did you say fifteen dollars? · Sorry, was that twenty-one dollars?)
    if (/\b(did you say|was that|is that)\b/.test(s) && nums.length && (q.intent === 'cost' || q.intent === 'paym')) {
      const amt = heardMoney(toks), want = C.amount;
      if (/\bpercent\b/.test(s) && C.off != null) { const p = +nums[0]; return p !== C.off ? R(false, 2, `직원이 말한 할인과 달라요. 직원: ${C.off}% · 들린 말: ${p}%.`, { tag: 'fact' }) : R(false, 1, '들은 할인을 되물어 확인했어요. 직원이 맞다고 할 거예요.', { repair: 'check' }); }
      if (want != null && amt !== want) return R(false, 2, `직원이 말한 값과 달라요. 직원: ${SH.factKo('amount', want)} · 들린 말: ${SH.factKo('amount', amt)}.`, { tag: 'fact' });
      return R(false, 1, '들은 값을 되물어 확인했어요. 직원이 맞다고 할 거예요.', { repair: 'check' });
    }
    if ((REPAIR_RE.test(s) || /\b(could you say|say again)\b/.test(s)) && toks.length <= 9) {
      if (q.allow && q.allow.includes('what') && /\bwhat is (a )?store credit\b/.test(s)) return R(false, 1, '모르는 낱말을 물었어요. 직원이 쉬운 말로 알려 줄 거예요.', { repair: 'what' });
      return R(false, 1, '다시 묻는 말로 들었어요. 직원이 한 번 더 말해 줄 거예요.', { repair: 'again' });
    }
    if (q.allow && q.allow.includes('what') && /\bwhat is (a )?store credit\b/.test(s)) return R(false, 1, '모르는 낱말을 물었어요. 직원이 쉬운 말로 알려 줄 거예요.', { repair: 'what' });
    if (/\b(give me|i want)\b/.test(s)) notes.push('Give me · I want는 명령하거나 조르는 말처럼 들려요(말로 한 대답은 말투를 판정하지 않아요) → Do you have this in …? · Could I …?');
    // 질문의 모양: yes · no만 (그리고 please · thanks 같은 말만) 들렸나
    const bare = toks.every(t => BARE_RE.test(t)) && /\b(yes|yeah|yep|no|nope|sure|okay|ok)\b/.test(s);
    const yesHeard = /\b(yes|yeah|yep|sure|okay|ok)\b/.test(s), noHeard = /\b(no|nope)\b/.test(s);
    if (bare && (q.shape === 'or' || q.shape === 'wh')) return R(false, 1, `${shapeHead(q)}. ${q.shape === 'or' ? '둘 가운데 하나를 고르라는 말이라 yes · no만으로는 무엇을 골랐는지 알 수 없어요' : '정보를 묻는 말이라 yes · no로는 답이 안 돼요'} → ${It.want}`, { tag: 'shape' });
    if (bare && q.shape === 'note') return R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${SH.sayOf(q.intent)} → ${It.want}`, { tag: 'shape' });
    if (q.shape === 'or' && yesHeard && !bare) notes.push('고르는 질문에는 Yes 없이 고른 것만 말해도 돼요.');
    const pickOr = (k, label) => {
      const v = find(k, s), fk = SH.SLOT[k].key;
      if (!v) return keyMiss();
      if (q.choices && !q.choices.includes(v)) return R(false, 1, `${shapeHead(q)}. 직원이 말한 것(${q.choices.map(c => SH.factKo(fk, c)).join(' · ')}) 가운데 하나를 골라요.`, { tag: 'choice' });
      if (C[fk] != null && v !== C[fk]) return differ(fk, v);
      return pass(`${label}이 들렸고 카드와 맞아요.`);
    };
    // 들린 물건 (콩글리시 이름이면 ②)
    const itemHeard = () => { const v = find('item', s); if (!v) return { v: null }; const x = SH.SLOT.item.vals[v]; return x.bad ? { bad: R(false, 2, x.why, { tag: 'literal' }) } : { v }; };
    switch (q.intent) {
      case 'browse': case 'lookfor': {
        if (/\beye shopping\b/.test(s)) return R(false, 2, SH.FRAME.br_eye.why, { tag: 'literal' });
        const h = itemHeard(); if (h.bad) return h.bad;
        const looking = /\b(just looking|just browsing|looking around|browsing|i am good|i am fine|i am okay|i am alright)\b/.test(s);
        if (h.v || /\blooking for\b/.test(s)) {
          if (q.intent === 'browse' && C.look === true) return R(false, 2, '카드와 달라요. 카드: 그냥 둘러보는 중 · 들린 말: 찾는 물건이 있음.', { tag: 'fact' });
          if (!h.v) { if (q.intent === 'lookfor') return keyMiss(); notes.push('찾는 물건 이름이 들리지 않았어요. 직원이 무엇을 찾는지 다시 물을 거예요.'); return pass('찾는 것이 있다는 말이 들렸어요.'); }
          if (C.item && h.v !== C.item) return differ('item', h.v);
          return pass('찾는 물건이 들렸고 카드와 맞아요.', q.intent === 'browse' ? ['browse', 'lookfor'] : ['lookfor']);
        }
        if (q.intent === 'lookfor') return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (looking || noHeard) { if (C.look === false) return R(false, 2, '카드와 달라요. 카드: 찾는 물건이 있어요 · 들린 말: 그냥 둘러보는 중.', { tag: 'fact' }); if (!looking) notes.push('No만 하면 무뚝뚝하게 들릴 수 있어요 → I\'m just looking, thanks.'); return pass('그냥 둘러보는 중이라는 말이 들렸어요.'); }
        if (yesHeard) { if (C.look === true) return R(false, 2, '카드와 달라요. 카드: 그냥 둘러보는 중.', { tag: 'fact' }); notes.push(SH.INTENT.browse.yn.need); return pass('도움이 필요하다는 말이 들렸어요.'); }
        return keyMiss();
      }
      case 'ask': {
        const h = itemHeard(); if (h.bad) return h.bad;
        if (!h.v) return /\b(thank|thanks|okay|ok|will do)\b/.test(s) ? R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${SH.sayOf(q.intent)}. 고맙다고만 하면 직원이 지나가요 → ${It.want}`) : keyMiss();
        if (!/\b(where|find|looking for|do you have|do you sell|have any)\b/.test(s)) return R(false, 2, SH.FRAME.ak_lit.why, { tag: 'literal' });
        if (/^ ?\S+( \S+)? where ?$/.test(s)) return R(false, 2, SH.FRAME.ak_lit.why, { tag: 'literal' });
        if (C.item && h.v !== C.item) return differ('item', h.v);
        if (/\bwhere is\b/.test(s) && /\b(jeans|sneakers|socks|hoodies|dresses|shirts|jackets)\b/.test(s)) notes.push('여럿에는 is가 아니라 are예요(말로 한 대답은 문법을 판정하지 않아요) → Where can I find jeans?');
        return pass('찾는 물건과 묻는 말이 들렸어요.', ['ask', 'lookfor']);
      }
      case 'rack': case 'sizeup': {
        if (/\bsize is there\b/.test(s)) return R(false, 2, SH.FRAME.ch_msize.why, { tag: 'literal' });
        const z = SH.findSize(s, item && item.kind), k = find('color', s);
        if (z === 'free') return R(false, 2, SH.SLOT.size.vals.free.why, { tag: 'literal' });
        const zz = z === 'msize' ? 'm' : z;
        if (z === 'msize') notes.push(SH.SLOT.size.vals.msize.note);
        if (q.intent === 'sizeup' && !zz) {
          if (/\b(bigger|smaller|larger)\b/.test(s)) return R(false, 2, `얼마나 큰지 · 작은지가 빠졌어요. 크기 이름으로 말해요 → Yes, could I try ${SH.SIZE[C.size] ? SH.SIZE[C.size].low : 'a large'}?`, { tag: 'need' });
          if (noHeard && !yesHeard) return R(false, 2, '카드와 달라요. 카드: 다른 크기를 입어 봐야 해요.', { tag: 'fact' });
          return yesHeard ? R(false, 2, It.yn.strict, { tag: 'need' }) : keyMiss();
        }
        if (!zz && !k) {
          if (/\b(bigger|smaller|larger)\b/.test(s)) return R(false, 2, `bigger · smaller만으로는 얼마나 큰지 · 작은지 몰라요. 크기 이름으로 말해요 → ${SH.text(SH.model(q, C))}`, { tag: 'need' });
          if (yesHeard || /\b(fine|good|great|okay)\b/.test(s)) { if (SH.changes(C).length) return R(false, 2, `카드: 바꿀 점이 있어요(${SH.changes(C).map(x => SH.factKo(x, C[x])).join(' · ')}). 바꿀 점까지 말해요 → ${SH.text(SH.model(q, C))}`, { tag: 'fact' }); return pass('잘 찾고 있다는 말이 들렸어요.'); }
          return keyMiss();
        }
        const tw2 = twoCheck(); if (tw2) return tw2;
        if (zz && item && SH.SIZE[zz] && SH.SIZE[zz].kind !== item.kind) return R(false, 2, `${item.ko}의 크기는 ${SH.KIND_KO[item.kind]}로 말해요.`, { tag: 'fact' });
        if (q.intent === 'rack') {
          if (zz && C.hsize && zz === C.hsize) return R(false, 2, `손에 든 것도 ${ieyo(SH.factKo('size', zz))}. 같은 점은 말하지 않고 바꿀 점만 말해요.`, { tag: 'same' });
          if (k && C.hcolor && k === C.hcolor) return R(false, 2, `손에 든 것도 ${ieyo(SH.factKo('color', k))}. 같은 점은 말하지 않고 바꿀 점만 말해요.`, { tag: 'same' });
        } else {
          if (k && C.hcolor && k === C.hcolor) return R(false, 2, `손에 든 것도 ${ieyo(SH.factKo('color', k))}. 바꿀 점만 말해요.`, { tag: 'same' });
          if (zz && C.hsize && SH.FIT[C.fit] && item) { const Ls = SH.SIZES[item.kind], d = Ls.indexOf(zz) - Ls.indexOf(C.hsize), up = SH.FIT[C.fit].up; if (d === 0 || Math.sign(d) !== up) return R(false, 2, `${SH.FIT[C.fit].ko} → 한 칸 ${up > 0 ? '큰' : '작은'} 크기 → ${SH.SIZE[C.size].low}.`, { tag: 'fact' }); }
        }
        if (zz && C.size && zz !== C.size) return differ('size', zz);
        if (k && C.color && k !== C.color) return differ('color', k);
        const cov = SH.coveredBy(Object.assign({}, zz ? { size: zz } : {}, k ? { color: k } : {}), q.intent);
        return pass('바꿀 점이 들렸고 카드와 맞아요.', cov);
      }
      case 'size': case 'exsize': {
        const z = SH.findSize(s, item && item.kind);
        if (z === 'free') return R(false, 2, SH.SLOT.size.vals.free.why, { tag: 'literal' });
        const zz = z === 'msize' ? 'm' : z;
        if (!zz) { if (find('color', s)) return R(false, 1, `${shapeHead(q)}. 들린 말은 색을 고르는 대답처럼 들려요 → ${It.want}`); return keyMiss(); }
        if (z === 'msize') notes.push(SH.SLOT.size.vals.msize.note);
        if (item && SH.SIZE[zz].kind !== item.kind) return R(false, 2, `${item.ko}의 크기는 ${SH.KIND_KO[item.kind]}로 말해요.`, { tag: 'fact' });
        if (q.intent === 'exsize' && C.hsize && SH.FIT[C.fit] && item) { const Ls = SH.SIZES[item.kind], d = Ls.indexOf(zz) - Ls.indexOf(C.hsize), up = SH.FIT[C.fit].up; if (d === 0 || Math.sign(d) !== up) return R(false, 2, `${SH.FIT[C.fit].ko} → 한 칸 ${up > 0 ? '큰' : '작은'} 크기 → ${SH.SIZE[C.size].low}.`, { tag: 'fact' }); }
        if (C.size && zz !== C.size) return differ('size', zz);
        return pass('크기가 들렸고 카드와 맞아요.');
      }
      case 'color': return pickOr('color', '고른 색');
      case 'tryon': {
        if (/\bfitting\b/.test(s) && !/\btry\b/.test(s)) return R(false, 2, SH.FRAME.to_fit.why, { tag: 'literal' });
        if (/\bwear\b/.test(s) && !/\btry\b/.test(s)) return R(false, 2, SH.FRAME.to_wear.why, { tag: 'literal' });
        if (!/\btry\b/.test(s)) return /\b(thank|thanks|okay|ok)\b/.test(s) ? R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${SH.sayOf(q.intent)} → ${It.want}`) : keyMiss();
        const tw2 = twoCheck(); if (tw2) return tw2;
        return pass('입어 봐도 되는지 묻는 말이 들렸어요.');
      }
      case 'items': {
        const n = /\bjust (one|1)\b|\bonly (one|1)\b|\bone item\b/.test(s) ? 1 : nums.map(Number).find(x => x > 0 && x < 10);
        if (n == null) return keyMiss();
        if (C.count != null && n !== C.count) return differ('count', n);
        return pass('몇 벌인지 들렸고 카드와 맞아요.');
      }
      case 'fit': {
        const f = find('fit', s), good = /\b(fits?|fit) (great|well|perfectly|fine|good)\b|\b(perfect|perfectly|fits great|fit great)\b/.test(s);
        if (!f && !good) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : /\b(yes|yeah) it did\b/.test(s) ? R(false, 1, `${shapeHead(q)}. ${SH.FRAME.fi_yes.why}`, { tag: 'shape' }) : keyMiss();
        const v = f || 'good';
        if (C.fit != null && v !== C.fit) return differ('fit', v);
        const tw2 = twoCheck(); if (tw2) return tw2;
        return pass('어떻게 맞는지 들렸고 카드와 맞아요.');
      }
      case 'askprice': {
        if (/\bhow much money\b/.test(s)) return R(false, 2, SH.FRAME.pa_money.why, { tag: 'literal' });
        if (/\b(d c|dc)\b/.test(s)) return R(false, 2, SH.FRAME.pa_dc.why, { tag: 'literal' });
        const sale = /\b(on sale|discount|any deals?|sale)\b/.test(s), price = /\b(how much|price|cost)\b/.test(s);
        if (!sale && !price) return /\b(thank|thanks|okay|ok)\b/.test(s) ? R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${SH.sayOf(q.intent)} → ${It.want}`) : keyMiss();
        const v = sale ? 'sale' : 'price';
        if (C.ask != null && v !== C.ask) return differ('ask', v);
        const tw2 = twoCheck(); if (tw2) return tw2;
        return pass(v === 'sale' ? '할인하는지 묻는 말이 들렸어요.' : '값을 묻는 말이 들렸어요.');
      }
      case 'cost': {
        const take = /\b(take it|take them|i will take|i will get|get it|get them|buy it|buy them|i will buy|sounds good)\b/.test(s), think = /\b(think about it|not today|maybe later|no thanks|no thank you)\b/.test(s);
        if (/\b(cheaper|too expensive)\b/.test(s)) notes.push('이런 가게에서는 보통 값을 깎지 않아요(말로 한 대답은 말투를 판정하지 않아요).');
        if (!take && !think) return bare ? R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${SH.sayOf(q.intent)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        const v = take && !think;
        if (C.take != null && v !== C.take) return differ('take', v);
        if (v) { const tw2 = twoCheck(); if (tw2) return tw2; }
        return pass(v ? '사겠다는 말이 들렸어요.' : '생각해 보겠다는 말이 들렸어요.');
      }
      case 'bogo': {
        if (/\bone plus one\b|\b1 plus 1\b|\b1 1\b/.test(s)) return R(false, 2, SH.FRAME.bo_lit.why, { tag: 'literal' });
        const y = yesHeard || /\b(please|sure|great|i will take|why not)\b/.test(s), n = noHeard || /\b(i am good|not today)\b/.test(s);
        if (!y && !n) return keyMiss();
        const v = y && !n;
        if (C.bogo != null && v !== C.bogo) return differ('bogo', v);
        return pass(v ? '하나 더 받겠다는 말이 들렸어요.' : '괜찮다는 말이 들렸어요.');
      }
      case 'found': {
        if (/\b(no|not really|could not find)\b/.test(s) && !yesHeard) return R(false, 2, '카드와 달라요. 카드: 찾던 것을 다 찾았어요.', { tag: 'fact' });
        if (!(yesHeard || /\b(i did|found everything|everything|thank|thanks)\b/.test(s))) return keyMiss();
        if (/\bi found ?$/.test(s) || /\byes i found\b/.test(s)) notes.push('Yes, I found.는 found 뒤가 비어서 문장이 끝나지 않아요(말로 한 대답은 문법을 판정하지 않아요) → Yes, I did.');
        return pass('다 찾았다는 말이 들렸어요.');
      }
      case 'member': case 'rcpt': case 'credit': case 'receipt': case 'bag': {
        if (q.intent === 'bag' && /\bvinyl\b/.test(s)) return R(false, 2, SH.FRAME.bg_vinyl.why, { tag: 'literal' });
        if (q.intent === 'receipt' && /\bno need\b/.test(s)) return R(false, 2, SH.FRAME.rc_lit.why, { tag: 'literal' });
        const key0 = { member: 'member', rcpt: 'receipt', credit: 'creditOk', receipt: 'receipt', bag: 'bag' }[q.intent];
        const y = yesHeard || /\b(i do|here it is|here you go|here you are|that is fine|that works|please|plastic bag|i have it)\b/.test(s);
        const n = noHeard || /\b(i do not|lost|forgot|i have one|i am good|do not need)\b/.test(s);
        if (!y && !n) return keyMiss();
        // No, thanks. I have one. (봉투) · No, I don't. (회원 카드) · No, I'm sorry. I don't. (영수증)
        const v = !n;
        if (C[key0] != null && v !== C[key0]) return differ(key0, v);
        if (/\bi do not have ?$/.test(s)) notes.push('No, I don\'t have.는 have 뒤가 비어서 문장이 끝나지 않아요(말로 한 대답은 문법을 판정하지 않아요) → No, I don\'t.');
        return pass(v ? '그렇다는 말이 들렸고 카드와 맞아요.' : '아니라는 말이 들렸고 카드와 맞아요.');
      }
      case 'paym': return pickOr('paym', '내는 방법');
      case 'retwhat': {
        const ret = /\b(return|refund|money back)\b/.test(s), ex = /\b(exchange|swap|switch|different size|another size)\b/.test(s);
        if (!ret && !ex) { if (/\bchange\b/.test(s)) return R(false, 2, SH.FRAME.rt_change.why, { tag: 'literal' }); return keyMiss(); }
        const v = ex ? 'exchange' : 'return';
        if (C.ret != null && v !== C.ret) return differ('ret', v);
        const tw2 = twoCheck(); if (tw2) return tw2;
        if (/\brefund me\b/.test(s)) notes.push('Refund me.는 명령처럼 들려요(말로 한 대답은 말투를 판정하지 않아요) → I\'d like to return this.');
        return pass(v === 'exchange' ? '교환하고 싶다는 말이 들렸어요.' : '환불하고 싶다는 말이 들렸어요.');
      }
      case 'reason': {
        const f = /\b(changed my mind|do not like|do not need|not my style)\b/.test(s) ? 'mind' : find('fit', s);
        if (!f) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.fit != null && f !== C.fit) return differ('fit', f);
        if (f !== 'mind') { const tw2 = twoCheck(); if (tw2) return tw2; }
        return pass('까닭이 들렸고 카드와 맞아요.');
      }
      case 'way': return pickOr('way', '돌려받는 방법');
      case 'final': {
        if (/\b(not fair|unfair|give me|ridiculous)\b/.test(s)) notes.push('따지는 말처럼 들릴 수 있어요(말로 한 대답은 말투를 판정하지 않아요). 가게 규칙이라 직원이 바꿀 수 없어요.');
        if (!/\b(i see|okay|ok|understand|thank|thanks|alright|all right|no problem|got it)\b/.test(s)) return keyMiss();
        return pass('알겠다는 말이 들렸어요.');
      }
      default: return R(false, 0, '이 말은 말로 대답하기를 지원하지 않아요.');
    }
  };

  /* ---------- 따라 말하기: 낱말 맞춰 보기 (가장 긴 공통 부분열, 숫자는 같은 숫자로) ---------- */
  SH.compareWords = function (target, heard) {
    const tw = String(target).split(/\s+/).filter(Boolean), tt = [];
    tw.forEach((x, i) => SH.canon(x).forEach(p => tt.push({ p, i })));
    const A = tt.map(x => x.p), B = SH.canon(heard), D = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) D[i][j] = A[i] === B[j] ? D[i + 1][j + 1] + 1 : Math.max(D[i + 1][j], D[i][j + 1]);
    const got = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { got.add(i); i++; j++; } else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++; }
    const okW = tw.map((_, k) => { const parts = tt.map((x, n) => [x, n]).filter(([x]) => x.i === k); return parts.length ? parts.every(([, n]) => got.has(n)) : true; });
    return { words: tw.map((t, k) => ({ t, ok: okW[k] })), hit: okW.filter(Boolean).length, total: tw.length };
  };

  /* =========================================================
     쇼핑 카드 (쇼핑 시뮬레이터)
     ========================================================= */
  SH.newCard = function (rnd = Math.random) {
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const item = pick(SH.SIM_ITEMS), it = SH.ITEMS[item], L = SH.SIZES[it.kind];
    // 바라는 크기는 가운데 크기 (꽉 끼면 위로 · 헐렁하면 아래로 바꿀 수 있게)
    const size = pick(L.slice(1, -1)), color = pick(it.colors), mode = pick(['size', 'color', 'both']);
    const hsize = mode === 'color' ? size : pick(L.filter(z => z !== size)), hcolor = mode === 'size' ? color : pick(it.colors.filter(k => k !== color));
    const fit = pick(['tight', 'loose', 'good']), size2 = fit === 'good' ? size : SH.sizeFor(item, size, fit);
    const ret = pick(['return', 'exchange']);
    let retWhy, size3 = null;
    if (ret === 'exchange') { retWhy = pick(['small', 'big'].filter(f => SH.sizeFor(item, size2, f))); size3 = SH.sizeFor(item, size2, retWhy); }
    else retWhy = pick(['mind', 'small', 'big']);
    const c = { look: rnd() < 0.5, item, two: it.two, hsize, hcolor, size, color, count: 1 + Math.floor(rnd() * 4), fit, size2,
      ask: pick(['price', 'sale']), off: pick([0, 20, 30, 50]), take: true, bogo: rnd() < 0.5, member: rnd() < 0.3, bag: rnd() < 0.6, paym: pick(['cash', 'card']), receipt: rnd() < 0.7,
      ret, retWhy, size3, days: pick([3, 5, 9, 14, 21, 45]), final: false };
    c.way = c.receipt ? pick(['refund', 'credit']) : null;
    c.creditOk = c.receipt ? null : rnd() < 0.7;
    c.amount = SH.bill(c).total;
    return c;
  };
  // 직원이 묻는 차례 (이미 답한 질문은 건너뜀)
  SH.simQs = function (c) {
    const qs = ['dr_help', c.look ? 'fd_pass' : 'fd_what', 'rk_ok'];
    if (c.hsize !== c.size) qs.push('rk_size');
    if (c.hcolor !== c.color) qs.push('rk_color');
    qs.push('ft_pass', 'ft_items', 'ft_how');
    if (c.fit !== 'good') qs.push('ft_next');
    qs.push('pr_pass', 'pr_cost', 'pr_bogo', 'py_find', 'py_member', 'py_bag', 'py_pay', 'py_rcpt', 'rt_help', 'rt_rcpt');
    if (!SH.returnRule(c).ok) qs.push('rt_final');
    else { qs.push('rt_why'); qs.push(c.ret === 'exchange' ? 'rt_size' : c.receipt ? 'rt_how' : 'rt_credit'); }
    return qs;
  };
  // 두 색 고르기의 차례 (늘 같은 카드면 같은 차례)
  const colorPair = c => { const it = SH.ITEMS[c.item], other = it.colors.find(k => k !== c.color && k !== c.hcolor) || it.colors.find(k => k !== c.color); return (c.color + other).length % 2 === 0 ? [c.color, other] : [other, c.color]; };
  // 카드에 따라 바뀌는 말 (두 색 · 값 · 합계 · 바꿀 크기 · 돌려주기 규칙)
  SH.simQ = function (id, c) {
    const q = SH.Q[id], it = SH.ITEMS[c.item], pr = c.two ? 'them' : 'it';
    if (id === 'rk_color') { const [a, b] = colorPair(c); return Object.assign({}, q, { en: `Would you like ${pr} in ${a} or ${b}?`, ko: `${ro(SH.COLORS[a].ko)} 드릴까요, ${ro(SH.COLORS[b].ko)} 드릴까요?`, key: [`${a} or ${b}`], choices: [a, b], short: `${a[0].toUpperCase() + a.slice(1)} or ${b}?` }); }
    if (id === 'ft_next') return Object.assign({}, q, { fact: { hsize: c.size, hcolor: c.color, size: c.size2, color: c.color } });
    if (id === 'pr_cost') {
      const p = SH.priceOf(c), be = c.two ? 'They\'re' : 'It\'s', bk = c.two ? '' : '';
      const en = c.off ? `${c.ask === 'sale' ? 'Yes! ' : ''}${be} ${SH.money(p)} today. That's ${numWord(c.off)} percent off.` : `${c.ask === 'sale' ? 'Sorry, not this week. ' : ''}${be} ${SH.money(p)}.`;
      const ko = c.off ? `${c.ask === 'sale' ? '네! ' : ''}오늘은 ${ieyo(SH.priceKo(p))}. ${c.off}퍼센트 할인이에요.${bk}` : `${c.ask === 'sale' ? '죄송하지만 이번 주에는 할인하지 않아요. ' : ''}${ieyo(SH.priceKo(p))}.`;
      return Object.assign({}, q, { en, ko, key: c.off ? ['percent off'] : [SH.money(p)], fact: { amount: p, off: c.off } });
    }
    if (id === 'py_pay') { const B = SH.bill(c); return Object.assign({}, q, { en: `Your total is ${SH.money(B.total)}. Cash or card?`, ko: `모두 ${ieyo(SH.priceKo(B.total))}. 현금으로 하시겠어요, 카드로 하시겠어요?`, fact: { amount: B.total } }); }
    if (id === 'rt_why') return Object.assign({}, q, c.ret === 'exchange' ? { en: 'Okay. What\'s the reason for the exchange?', ko: '네. 바꾸시는 까닭이 뭔가요?' } : {}, { fact: { fit: c.retWhy } });
    if (id === 'rt_size') return Object.assign({}, q, { fact: { hsize: c.size2, size: c.size3, fit: c.retWhy } });
    if (id === 'rt_final') { const r = SH.returnRule(c); return Object.assign({}, q, { en: r.en, ko: r.ko, key: r.why === 'final' ? ['final sale'] : ['within thirty days'] }); }
    return q;
  };
  SH.PLACE_OF = id => SH.Q[id].place;
  // 질문마다 틀 칩: 맞는 틀 · 한국어 그대로(콩글리시 · 무례한 말 · Yes만) 틀 · 다른 질문의 틀
  SH.SIM_FRAMES = {
    browse: c => c.look ? ['br_look', 'br_eye', 'sz_pl'] : ['br_for', 'br_eye', 'sz_pl'],
    ask: ['ak_where', 'ak_lit', 'g_yes'],
    lookfor: ['lf_for', 'g_yes', 'sz_pl'],
    rack: c => [c.two ? 'ch_these' : 'ch_this', c.two ? 'ch_this' : 'ch_these', 'ch_give'],
    size: ['sz_pl', 'g_yesp', 'cl_pl'],
    color: ['cl_pl', 'g_yesp', 'sz_pl'],
    tryon: ['to_could', 'to_fit', 'to_wear'],
    items: ['it_n', 'g_yes', 'sz_pl'],
    fit: c => { const good = c.two ? 'fi_goods' : 'fi_good', bad = c.two ? 'fi_theyre' : 'fi_its'; return c.fit === 'good' ? [good, 'fi_yes', bad] : [bad, 'fi_yes', good]; },
    sizeup: ['su_try', 'ch_give', 'fi_good'],
    askprice: c => c.ask === 'sale' ? [c.two ? 'pa_sales' : 'pa_sale', 'pa_dc', c.two ? 'pa_are' : 'pa_is'] : [c.two ? 'pa_are' : 'pa_is', 'pa_money', c.two ? 'pa_is' : 'pa_are'],
    cost: ['pc_take', 'pc_cheap', 'g_yes'],
    bogo: c => c.bogo ? ['g_yesp', 'bo_lit', 'bo_no'] : ['bo_no', 'bo_lit', 'g_yesp'],
    found: ['fd_did', 'fd_found', 'pm_pl'],
    member: c => c.member ? ['mb_yes', 'mb_have', 'mb_no'] : ['mb_no', 'mb_have', 'mb_yes'],
    bag: c => c.bag ? ['g_yesp', 'bg_vinyl', 'bg_no'] : ['bg_no', 'bg_vinyl', 'g_yesp'],
    paym: ['pm_pl', 'g_yesp', 'wy_pl'],
    receipt: c => c.receipt ? ['g_yesp', 'rc_lit', 'g_no'] : ['g_no', 'rc_lit', 'g_yesp'],
    retwhat: c => c.ret === 'exchange' ? ['rt_exch', 'rt_change', 'rt_ret'] : ['rt_ret', 'rt_refund', 'rt_exch'],
    rcpt: c => c.receipt ? ['rc_here', 'rc_none', 'pm_pl'] : ['rc_none', 'rc_here', 'pm_pl'],
    reason: c => { const fr = c.two ? 'rs_theyre' : 'rs_its'; return c.fit === 'mind' ? ['rs_mind', 'g_yes', fr] : [fr, 'g_yes', 'rs_mind']; },
    way: ['wy_pl', 'g_yesp', 'pm_pl'],
    exsize: ['sz_pl', 'g_yesp', 'cl_pl'],
    credit: c => c.creditOk === false ? ['cr_no', 'cr_ok', 'wy_pl'] : ['cr_ok', 'cr_no', 'wy_pl'],
    final: ['fn_ok', 'fn_bad', 'g_yes'],
  };
  SH.simFrames = (intent, c) => { const x = SH.SIM_FRAMES[intent]; return typeof x === 'function' ? x(c) : x ? x.slice() : null; };
  // 칸 칩: 카드의 값 + 헷갈리기 쉬운 값 둘 (값은 fifteen · fifty 같은 이웃 값, 바꿀 점은 손에 든 것과 같은 값)
  const KONG = { hoodie: 'hoodt', dress: 'onepiece', jacket: 'padding', shirt: 'yshirt' };
  SH.slotChoices = function (slot, card, rnd = Math.random) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const it = SH.ITEMS[card.item] || SH.ITEMS.tee;
    let out;
    if (slot === 'money') {
      const a = card.amount, d = a / 100;
      const teen = Number.isInteger(d) && d >= 13 && d <= 19 ? (d - 10) * 1000 : Number.isInteger(d) && d >= 30 && d <= 90 && d % 10 === 0 ? (d / 10 + 10) * 100 : null;
      out = [a, teen || a + 1000, a > 1000 ? a - 100 : a + 100].map(String);
    } else if (slot === 'size') {
      const L = SH.SIZES[it.kind], r = card.size, i = L.indexOf(r);
      out = [r, L[i + 1] || L[i - 2], L[i - 1] || L[i + 2]].filter(Boolean);
    } else if (slot === 'chg') {
      const right = SH.slotVal('chg', card);
      out = [right, card.hsize ? 'z_' + card.hsize : null, card.hcolor ? 'k_' + card.hcolor : null].filter(Boolean);
      if (out.length < 3) out.push('z_' + (SH.SIZES[it.kind].find(z => z !== card.size && z !== card.hsize) || 'm'));
    } else if (slot === 'color') {
      const r = card.color, q2 = colorPair(card);
      out = [r].concat(q2.filter(k => k !== r)).concat(shuffle(it.colors.filter(k => k !== r && !q2.includes(k)))).concat(['black', 'white']).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
    } else if (slot === 'item') {
      const r = card.item;
      out = [r].concat(KONG[r] ? [KONG[r]] : []).concat(shuffle(SH.SIM_ITEMS.filter(x => x !== r))).slice(0, 3);
    } else if (slot === 'dem') out = ['this', 'these'];
    else if (slot === 'it') out = ['it', 'them'];
    else if (slot === 'count') { const n = card.count || 1; out = ['n' + n, 'n' + (n >= 4 ? n - 1 : n + 1), 'n' + (n === 1 ? 3 : n === 2 ? 4 : n - 2)]; }
    else if (slot === 'fit') { const r = SH.FIT[card.fit] ? card.fit : 'small', opp = { tight: 'loose', loose: 'tight', small: 'big', big: 'small', short: 'long', long: 'short' }; out = [r, opp[r], r === 'tight' || r === 'loose' ? 'small' : 'tight']; }
    else {
      const right = SH.slotVal(slot, card), keys = shuffle(slotIds(slot).filter(k => k !== right));
      out = (right ? [right] : []).concat(keys.slice(0, right ? 2 : 3));
    }
    return shuffle(out.filter((x, i, a) => x != null && a.indexOf(x) === i));
  };
  SH.itemKo = (c, which = 'want') => { const it = SH.ITEMS[c.item], z = which === 'hand' ? c.hsize : c.size, k = which === 'hand' ? c.hcolor : c.color; return `${it.ko} · ${SH.SIZE[z] ? SH.SIZE[z].tag : ''} · ${SH.COLORS[k] ? SH.COLORS[k].ko : ''}`; };
  SH.cardRows = c => {
    const it = SH.ITEMS[c.item];
    return [
      ['들어갈 때', c.look ? '그냥 둘러보기 (직원이 지나가면 내가 먼저 물어요)' : `${it.ko}(${it.en}) 찾기`],
      ['손에 든 것', SH.itemKo(c, 'hand') + (it.two ? ' (둘이 짝)' : '')],
      ['바라는 것', `${SH.SIZE[c.size].tag} · ${SH.COLORS[c.color].ko}`],
      ['탈의실', `${c.count}벌 · 입어 보니 ${c.fit === 'good' ? '잘 맞음' : `${SH.FIT[c.fit].ko} → ${SH.SIZE[c.size2].tag}`}`],
      ['값', `${c.ask === 'sale' ? '할인하는지 묻기' : '값 묻기'} · 사기 · 양말 ${c.bogo ? '받기' : '안 받기'}`],
      ['계산', `회원 카드 ${c.member ? '있음' : '없음'} · 봉투 ${c.bag ? '필요' : '필요 없음'} · ${c.paym === 'card' ? '카드' : '현금'} · 영수증 ${c.receipt ? '받기' : '안 받기'}`],
      ['며칠 뒤', `${c.days}일 뒤 · ${c.ret === 'exchange' ? `교환 (${SH.FIT[c.retWhy].ko} → ${SH.SIZE[c.size3].tag})` : `환불 (${c.retWhy === 'mind' ? '마음이 바뀜' : SH.FIT[c.retWhy].ko})${c.receipt ? (c.way === 'refund' ? ' · 돈으로' : ' · 가게 포인트로') : ` · 가게 포인트 ${c.creditOk ? '괜찮음' : '싫음'}`}`}`],
    ];
  };
  // 직원의 반응 (단계별)
  const BAD_REACT = {
    yshirt: ['Sorry, a… what kind of shirt?', '와이셔츠 → a shirt · a dress shirt.'], onepiece: ['A swimsuit? Oh — do you mean a dress?', '원피스 → a dress.'], hoodt: ['Sorry, a hood…?', '후드 티 → a hoodie.'], padding: ['Sorry, padding…?', '패딩 점퍼 → a puffer jacket.'],
    free: ['Sorry — which size?', '프리 사이즈 → one size · 내 크기를 말해요.'], br_eye: ['Sorry — eye…?', '아이쇼핑 → I\'m just looking, thanks.'], ch_msize: ['Sorry?', '이것 + 바꿀 점 → Do you have this in a medium?'],
    to_fit: ['Sorry — would you like to try something on?', '입어 보기 → Could I try this on?'], to_wear: ['Oh, you\'d like to wear it out? You\'ll need to pay for it first.', '입어 보기 → try on.'],
    pa_money: ['Sorry — how much is what?', '값 → How much is this?'], pa_dc: ['Sorry, D.C.…?', '할인 → Is this on sale?'], bo_lit: ['Sorry? Oh — buy one, get one free?', '1+1 → buy one, get one free.'],
    bg_vinyl: ['Sorry — a vinyl bag?', '비닐봉지 → a plastic bag · 봉투가 필요하면 Yes, please.'], rt_change: ['Sorry, do you need change?', '교환 → I\'d like to exchange this.'], rc_lit: ['Sorry?', '영수증이 필요 없으면 → No, thanks.'],
    ak_lit: ['Sorry?', '물건 찾기 → Excuse me, where can I find …?'], ak_is: ['Oh — the jeans? They\'re over here.', '여럿에는 are · 틀 하나로 → Where can I find …?'], fd_found: ['Sorry — you found…?', 'Did you …? → Yes, I did.'], mb_have: ['Sorry — you don\'t have…?', 'Do you have …? → No, I don\'t.'],
  };
  SH.REACT = {
    ok: ['Sure.', 'Of course.', 'Great.', 'Perfect.', 'You got it.'],
    1: q => ({ en: `Sorry — ${q.short && /\?$/.test(q.short) ? q.short : (String(q.en).match(/[^.!?]*\?/g) || [String(q.en).replace(/^(Yes!|Sure[.!]|Sorry, not this week\.)\s+/, '')]).pop().trim()}`, ko: q.shape === 'or' || q.shape === 'wh' ? `${SH.SHAPE[q.shape].ko} → ${SH.SHAPE[q.shape].ans}` : `‘${q.key.join(' … ')}’를 말했어요.` }),
    2: (q, j, a) => {
      const F = a && SH.FRAME[a.f], sv = F && F.slot ? SH.sv(F.slot, a.v) : null, b = (sv && sv.bad && BAD_REACT[a.v]) || (F && BAD_REACT[F.id]);
      if (b) return { en: b[0], ko: b[1] };
      if (j.tag === 'same') return { en: 'Hmm, isn\'t that the same as the one you have?', ko: '손에 든 것과 같은 점을 말했어요. 바꿀 점만 말해요.' };
      if (j.tag === 'fact') return { en: 'Hmm, are you sure?', ko: '쇼핑 카드(또는 직원이 한 말)를 다시 보세요.' };
      if (j.tag === 'need') return { en: 'Sure — which size would you like?', ko: '어떤 크기인지까지 말해요.' };
      if (j.tag === 'order') return { en: 'Sorry, could you say that again?', ko: '순서가 어색해 알아듣기 어려워요.' };
      return { en: 'Sorry?', ko: '알아듣기 어려운 말이에요.' };
    },
    3: () => ({ en: '... Okay.', ko: '뜻은 통했지만 말투가 거칠어요.' }),
  };
  // 대답 뒤 직원이 덧붙이는 말 (다음 질문 앞)
  SH.reply = function (q, a, C) {
    const f = a ? SH.factOf(a) : {}, it = SH.ITEMS[C.item];
    switch (q.intent) {
      case 'browse': return f.item ? `Great! Our ${it.pl} are right over here.` : null;
      case 'ask': return `Sure! Our ${it.pl} are on the back wall, right over there.`;
      case 'lookfor': return `Great! Our ${it.pl} are right over here.`;
      case 'rack': { const left = SH.changes(C).filter(k => f[k] == null); return left.length ? 'Sure, let me check.' : 'Sure! Here you go.'; }
      case 'size': return 'Got it.';
      case 'color': return 'Here you go.';
      case 'tryon': return 'Of course.';
      case 'items': return 'Here\'s your number. Room three is open.';
      case 'fit': return C.fit === 'good' ? 'Great!' : null;
      case 'sizeup': return SH.SIZE[C.size] ? `Sure, here's ${SH.SIZE[C.size].low}.` : 'Sure.';
      case 'cost': return 'Great choice.';
      case 'bogo': return C.bogo ? 'Great, here you go.' : 'No problem.';
      case 'found': return 'Great.';
      case 'member': return C.member ? 'Thank you.' : 'No problem.';
      case 'bag': return C.bag ? 'Sure.' : 'Okay.';
      case 'paym': return C.paym === 'card' ? 'Go ahead and tap your card.' : 'Here\'s your change.';
      case 'receipt': return C.receipt ? 'Here you go. Have a great day!' : 'Have a great day!';
      case 'rcpt': return C.receipt ? 'Thank you.' : null;
      case 'reason': return C.ret === 'exchange' ? null : C.fit === 'mind' ? 'No problem.' : 'I\'m sorry to hear that.';
      case 'way': return C.way === 'refund' ? 'Okay. The refund will go back to your card.' : 'Okay. Here\'s your store credit.';
      case 'exsize': return SH.SIZE[C.size] ? `Here you go — ${SH.SIZE[C.size].low}.` : 'Here you go.';
      case 'credit': return C.creditOk === false ? 'I understand.' : 'Okay. Here\'s your store credit.';
      default: return null;
    }
  };

  /* =========================================================
     듣고 대답 고르기 16문제 (모두 새로 만든 대화). card = 그 상황의 사실
     ========================================================= */
  const o = (f, v) => { const a = { f }; if (v != null) a.v = String(v); return a; };
  const L = words => ({ f: 'line', line: { words } });
  SH.o = o; SH.L = L;
  SH.DRILL = [
    { q: 'dr_help', sit: '들어가서 그냥 구경하는 중이에요.', card: { look: true }, a: 2, opts: [o('br_eye'), o('br_plain'), o('br_look'), o('br_for', 'tee')] },
    { q: 'dr_fast', sit: '직원이 아주 빠르게 말했어요. ‘… help finding …’만 들렸어요.', card: {}, a: 0, opts: [o('rp_help'), o('br_look'), o('rp_bag'), o('sz_pl', 'm')] },
    { q: 'fd_what', sit: '원피스를 찾고 있어요.', card: { item: 'dress' }, a: 1, opts: [o('lf_for', 'onepiece'), o('lf_for', 'dress'), o('g_yes'), o('lf_for', 'jacket')] },
    { q: 'fd_pass', sit: '청바지가 어디 있는지 묻고 싶어요.', card: { item: 'jeans' }, a: 3, opts: [o('ak_is', 'jeans'), o('ak_lit', 'jeans'), o('g_yes'), o('ak_where', 'jeans')] },
    { q: 'rk_size', sit: '티셔츠를 미디엄 크기로 찾고 있어요.', card: { item: 'tee', size: 'm' }, a: 0, opts: [o('sz_pl', 'm'), o('g_yesp'), o('sz_pl', 'free'), o('sz_pl', 'l')] },
    { q: 'rk_ok', sit: '검은 운동화(US 8)를 들고 있어요. 같은 운동화를 US 9로 신어 보고 싶어요.', card: { item: 'sneakers', two: true, hsize: 'u8', hcolor: 'black', size: 'u9', color: 'black' }, a: 2, opts: [o('ch_this', 'z_u9'), o('ch_these', 'k_black'), o('ch_these', 'z_u9'), o('ch_give')] },
    { q: 'rk_color', sit: '남색이 마음에 들어요.', card: { color: 'navy' }, a: 1, opts: [o('g_yesp'), o('cl_pl', 'navy'), o('cl_pl', 'gray'), o('cl_pl', 'black')] },
    { q: 'ft_pass', sit: '고른 청바지를 입어 보고 싶어요.', card: { item: 'jeans', two: true }, a: 3, opts: [o('to_fit'), o('to_wear', 'these'), o('to_could', 'this'), o('to_could', 'these')] },
    { q: 'ft_how', sit: '후드 티를 입어 보니 조금 헐렁해요.', card: { item: 'hoodie', two: false, fit: 'loose' }, a: 0, opts: [o('fi_its', 'loose'), o('fi_yes'), o('fi_its', 'tight'), o('g_yes')] },
    { q: 'ft_next', sit: 'M 셔츠를 입어 보니 꽉 껴요.', card: { item: 'shirt', two: false, hsize: 'm', hcolor: 'white', size: 'l', color: 'white', fit: 'tight' }, a: 2, opts: [o('su_try', 's'), o('g_yesp'), o('su_try', 'l'), o('ch_give')] },
    { q: 'pr_pass', sit: '양말 한 켤레의 값을 알고 싶어요.', card: { item: 'socks', two: true, ask: 'price' }, a: 1, opts: [o('pa_money'), o('pa_are'), o('pa_is'), o('pa_dc')] },
    { q: 'pr_cost', sit: '값이 마음에 들어서 후드 티를 살 거예요.', card: { item: 'hoodie', two: false, take: true }, a: 3, opts: [o('pc_cheap'), o('g_yes'), o('pc_take', 'them'), o('pc_take', 'it')] },
    { q: 'py_fast', sit: '계산대 직원이 아주 빠르게 말했어요. 무엇을 물었는지 하나도 못 알아들었어요.', card: {}, a: 0, opts: [o('rp_again'), o('g_yesp'), o('rp_help'), o('pm_pl', 'card')] },
    { q: 'py_pay', sit: '카드로 내고 싶어요.', card: { paym: 'card' }, a: 2, opts: [o('g_yesp'), o('pm_pl', 'cash'), o('pm_pl', 'card'), o('wy_pl', 'refund')] },
    { q: 'py_bag', sit: '산 것을 담을 봉투가 필요해요.', card: { bag: true }, a: 1, opts: [o('bg_vinyl'), o('g_yesp'), o('bg_no'), o('rc_lit')] },
    { q: 'rt_help', sit: '지난주에 산 운동화를 다른 크기로 바꾸고 싶어요.', card: { item: 'sneakers', two: true, ret: 'exchange' }, a: 3, opts: [o('rt_change'), o('rt_refund'), o('rt_exch', 'this'), o('rt_exch', 'these')] },
  ];
  SH.DRILL.forEach((it, i) => { it.n = i; it.Q = SH.Q[it.q]; it.place = it.Q.place; });
  // 직접 해 보기의 짧은 문제 (00장 · 06장) — 연습 문제와 다른 상황
  SH.MINI = {
    intro: { q: 'dr_gb', sit: '영국의 옷 가게예요. 그냥 구경하는 중이에요.', card: { look: true }, a: 2, opts: [o('g_yes'), o('br_eye'), o('br_look'), o('br_for', 'hoodie')] },
    cost: { q: 'pr_cost', sit: '직원이 값을 말했어요. 15달러인지 50달러인지 확인하고 싶어요.', card: {}, a: 1, opts: [o('pc_check', '5000'), o('pc_check', '1500'), o('pc_cheap'), o('sz_pl', 'm')] },
  };
  Object.values(SH.MINI).forEach(it => { it.Q = SH.Q[it.q]; it.place = it.Q.place; });

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 쇼핑 (연습 문제와 겹치지 않게 골랐어요)
     ========================================================= */
  // 03–07장: 후드 티를 찾음 · 검은색 S를 들고 남색 M을 바람 · 두 벌을 입어 봄 → M이 꽉 껴서 L · 값 묻기(15달러, 50% 할인)
  //          · 양말 하나 더 받기 · 회원 카드 없음 · 봉투 필요 · 카드 · 영수증 받기
  SH.DEMO = { look: false, item: 'hoodie', two: false, hsize: 's', hcolor: 'black', size: 'm', color: 'navy', count: 2, fit: 'tight', size2: 'l',
    ask: 'price', off: 50, take: true, bogo: true, member: false, bag: true, paym: 'card', receipt: true };
  // 05장 탈의실: 남색 M을 입어 보니 꽉 낌 → L
  SH.FITCARD = { item: 'hoodie', two: false, hsize: 'm', hcolor: 'navy', size: 'l', color: 'navy', fit: 'tight', count: 2 };
  // 08장 교환: 지난주에 산 청바지(30)가 작음 → 32로 · 환불: 마음이 바뀐 후드 티
  SH.EXCARD = { item: 'jeans', two: true, ret: 'exchange', receipt: true, days: 5, hsize: 'w30', fit: 'small', size: 'w32' };
  SH.REFCARD = { item: 'hoodie', two: false, ret: 'return', receipt: true, days: 5, fit: 'mind', way: 'refund' };
  // 00장: 이거 M 있어요? → 이것 + 바꿀 점
  SH.INTRO = { q: 'rk_ok', lit: o('ch_msize'), ok: o('ch_this', 'z_m'), card: { item: 'hoodie', two: false, hsize: 's', hcolor: 'black', size: 'm', color: 'black' } };
  // 02장 이것 + 바꿀 점
  SH.CHANGE_CARD = { item: 'hoodie', two: false, hsize: 's', hcolor: 'black', size: 'm', color: 'navy' };
  SH.JEANS_CARD = { item: 'jeans', two: true, hsize: 'w30', hcolor: 'blue', size: 'w32', color: 'blue' };
  SH.LINE = { words: ['have', 'this', 'z_m', 'k_navy'] };
  SH.LINE_SAME = { words: ['have', 'this', 'z_m', 'k_black'] };
  SH.LINE_BAD = { words: ['z_m', 'have', 'this'] };
  SH.LINE_CHIPS = { open: ['have', 'could', 'give'], dem: ['this', 'these'], size: ['z_s', 'z_m', 'z_l'], color: ['k_black', 'k_navy', 'k_gray'] };
  SH.LONG = 'Do you have this hoodie in medium size in navy color?';
  SH.SCENE = {
    // 02장
    size1: o('ch_this', 'z_m'), color1: o('ch_this', 'k_navy'), same: o('ch_this', 'k_black'),
    jeans: o('ch_these', 'z_w32'), jeansThis: o('ch_this', 'z_w32'),
    // 03장 입구와 둘러보기
    browse: ['dr_help', o('br_look'), o('br_eye'), o('br_for', 'hoodie'), o('br_plain')],
    ask: ['fd_pass', o('ak_where', 'jeans'), o('ak_is', 'jeans')],
    names: [['hoodt', 'hoodie'], ['onepiece', 'dress'], ['padding', 'jacket'], ['yshirt', 'shirt']],
    // 04장 크기와 색
    size: ['rk_size', o('g_yesp'), o('sz_pl', 'm'), o('sz_im', 'm'), o('sz_pl', 'free'), o('sz_pl', 'msize')],
    color: ['rk_color', o('g_yesp'), o('cl_pl', 'navy')],
    rack: ['rk_ok', o('ch_this', 'z_m'), o('ch_give')],
    // 05장 탈의실
    tryon: ['ft_pass', o('to_could', 'this'), o('to_fit'), o('to_wear', 'this')],
    items: ['ft_items', o('it_n', 'n2')],
    fit: ['ft_how', o('fi_yes'), o('fi_its', 'tight')],
    next: ['ft_next', o('su_try', 's'), o('su_try', 'l')],
    // 06장 값과 할인
    askp: ['pr_pass', o('pa_is'), o('pa_are'), o('pa_money'), o('pa_dc'), o('pa_sale')],
    cost: ['pr_cost', o('pc_check', '1500'), o('pc_check', '5000'), o('pc_take', 'it')],
    bogo: ['pr_bogo', o('bo_lit'), o('g_yesp')],
    // 07장 계산대
    found: ['py_find', o('fd_found'), o('fd_did')],
    member: ['py_member', o('mb_have'), o('mb_no')],
    bag: ['py_bag', o('bg_vinyl'), o('g_yesp')],
    paym: ['py_pay', o('g_yesp'), o('pm_pl', 'card')],
    rcpt: ['py_rcpt', o('g_yesp')],
    // 08장 교환과 환불
    retw: ['rt_help', o('rt_change'), o('rt_refund'), o('rt_exch', 'these'), o('rt_ret', 'this')],
    rcpt2: ['rt_rcpt', o('rc_here')],
    why: ['rt_why', o('rs_theyre', 'small')],
    exsize: ['rt_size', o('sz_pl', 'w32')],
    way: ['rt_how', o('g_yesp'), o('wy_pl', 'refund')],
    final: ['rt_final', o('fn_bad'), o('fn_ok')],
  };
  // 09장: 곳마다 한 줄 (3단계 적용)
  SH.METHOD = [
    ['dr_help', o('br_look'), { look: true }],
    ['fd_pass', o('ak_where', 'jeans'), { item: 'jeans' }],
    ['rk_ok', o('ch_this', 'z_m'), { item: 'hoodie', two: false, hsize: 's', hcolor: 'black', size: 'm', color: 'black' }],
    ['ft_pass', o('to_could', 'these'), { item: 'jeans', two: true }],
    ['pr_pass', o('pa_is'), { item: 'hoodie', two: false, ask: 'price' }],
    ['py_pay', o('pm_pl', 'card'), { paym: 'card' }],
    ['rt_help', o('rt_exch', 'these'), { item: 'jeans', two: true, ret: 'exchange' }],
  ];
  // 10장 실전: 쇼핑 카드 하나로 넷 (보기 셋, 단계마다 지워짐)
  SH.PCARD = { look: false, item: 'jeans', two: true, hsize: 'w30', hcolor: 'blue', size: 'w32', color: 'blue', count: 1, fit: 'good', paym: 'card', bag: false, receipt: true, ret: 'return', retWhy: 'mind', way: 'refund', days: 4 };
  SH.PRACTICE = [
    { q: 'rk_ok', opts: [o('ch_this', 'z_w32'), o('ch_these', 'z_w30'), o('ch_these', 'z_w32')], a: 2,
      lines: ['finding everything okay → Yes/No 질문 · 셋 모두 바꿀 점을 묻는 말이에요', '(A) this → 청바지는 둘이 짝이라 탈락 · (B) 30 → 손에 든 것과 같아 탈락', '셋 모두 공손해요 · 정답 (C) Do you have these in a 32?'] },
    { q: 'ft_how', opts: [o('fi_yes'), o('fi_good'), o('fi_goods')], a: 2,
      lines: ['How did → 정보 질문 · (A) Yes, it did → 어땠는지가 빠져 탈락', '(B) It fits → 청바지는 둘이 짝이라 They로 · 탈락', '셋 모두 공손해요 · 정답 (C) They fit great, thanks.'] },
    { q: 'py_pay', opts: [o('pm_pl', 'card'), o('g_yesp'), o('pm_pl', 'cash')], a: 0,
      lines: ['Cash or card → 고르는 질문 · (B) Yes, please → 고른 것이 없어 탈락', '(C) Cash → 쇼핑 카드는 카드로 내기라 탈락', '고른 것 + please → 정답 (A) Card, please.'] },
    { q: 'rt_help', opts: [o('rt_refund'), o('rt_change'), o('rt_ret', 'these')], a: 2,
      lines: ['how can I help → 정보 질문 · 셋 모두 돌려주는 일에 대한 말이에요', '(B) Change, please → 거스름돈으로 들려 탈락', '(A) Refund me. → 명령처럼 들려 탈락 · 정답 (C)'] },
  ];
  SH.practiceQ = p => SH.Q[p.q];

  /* ---------- 이어서 들리는 말 (02 · 05장). 대문자 = 세게 ---------- */
  SH.LINKED = [
    { q: 'rk_ok', en: 'Do you have this in a medium?', say: 'Do you have this in a medium?', words: ['Do', 'you', 'have', 'this', 'in', 'a', 'medium?'], sound: [['d\'you', 0], ['HAVE', 1], ['thi', 0], ['sin', 0], ['a', 0], ['MEE', 1], ['dium', 0]], link: [[3, 4]], ko: 'this in → thi-sin처럼 이어져요 · 바꿀 점(MEdium)을 세게' },
    { q: 'ft_pass', en: 'Could I try this on?', say: 'Could I try this on?', words: ['Could', 'I', 'try', 'this', 'on?'], sound: [['could', 0], ['I', 0], ['TRY', 1], ['thi', 0], ['SON', 1]], link: [[3, 4]], ko: 'this on → thi-son처럼 이어져요' },
  ];
  // 헷갈리는 숫자 짝 (06장): 앞이 세면 -ty, 뒤가 세면 -teen
  SH.PAIRS = [['15', 'fifTEEN', '50', 'FIFty'], ['13', 'thirTEEN', '30', 'THIRty'], ['14', 'fourTEEN', '40', 'FORty']];

  /* ---------- 직접 해 보기 자료 ---------- */
  SH.SHAPE_QS = ['dr_help', 'fd_what', 'rk_size', 'rk_color', 'ft_how', 'py_pay', 'rt_how', 'py_bag', 'pr_cost', 'ft_pass', 'rt_rcpt'];

  /* =========================================================
     따라 말하기 28문장 (곳마다 직원 · 나의 말 넷)
     ========================================================= */
  const SW = (place, who, en, ko, sp) => ({ place, who, en, ko, sp: who === 'me' ? 'me' : sp || SH.PLACE[place].sp });
  SH.SHADOW = [
    SW('door', 'staff', 'Can I help you find anything?', '찾으시는 것 도와드릴까요?'),
    SW('door', 'me', 'I\'m just looking, thanks.', '그냥 둘러보는 중이에요, 고마워요.'),
    SW('door', 'me', 'Yes, I\'m looking for a hoodie.', '네, 후드 티를 찾고 있어요.'),
    SW('door', 'staff', 'Are you alright there?', '(영국) 도와드릴까요?', 'gb'),
    SW('find', 'staff', 'Let me know if you need anything!', '필요한 것 있으면 말씀하세요!'),
    SW('find', 'me', 'Excuse me, where can I find jeans?', '저기요, 청바지 어디 있어요?'),
    SW('find', 'staff', 'What are you looking for?', '무엇을 찾으세요?'),
    SW('find', 'me', 'I\'m looking for a dress.', '원피스를 찾고 있어요.'),
    SW('rack', 'staff', 'What size are you looking for?', '어떤 크기를 찾으세요?'),
    SW('rack', 'me', 'A medium, please.', '미디엄으로 주세요.'),
    SW('rack', 'me', 'Do you have this in navy?', '이거 남색도 있어요?'),
    SW('rack', 'me', 'Do you have these in a size 9?', '이거(둘이 짝) 미국 9도 있어요?'),
    SW('fit', 'me', 'Could I try this on?', '이거 입어 봐도 될까요?'),
    SW('fit', 'staff', 'How many items do you have?', '몇 벌 가지고 들어가세요?'),
    SW('fit', 'me', 'It\'s a little tight.', '조금 꽉 껴요.'),
    SW('fit', 'me', 'Yes, could I try a large?', '네, 라지로 입어 볼 수 있을까요?'),
    SW('price', 'me', 'Excuse me, how much is this?', '저기요, 이거 얼마예요?'),
    SW('price', 'me', 'Is this on sale?', '이거 할인해요?'),
    SW('price', 'me', 'Sorry, did you say fifteen dollars?', '죄송한데, 15달러라고 하셨어요?'),
    SW('price', 'staff', 'Our socks are buy one, get one free.', '양말은 하나 사면 하나 더 드려요.'),
    SW('pay', 'staff', 'Did you find everything okay?', '찾으시던 것 다 찾으셨어요?'),
    SW('pay', 'me', 'Yes, I did. Thanks.', '네, 다 찾았어요. 고마워요.'),
    SW('pay', 'staff', 'Would you like a bag?', '봉투 드릴까요?'),
    SW('pay', 'me', 'No, thanks. I have one.', '아니요, 괜찮아요. 가방이 있어요.'),
    SW('ret', 'me', 'I\'d like to exchange these.', '이거 교환하고 싶어요.'),
    SW('ret', 'staff', 'Do you have your receipt?', '영수증 있으세요?'),
    SW('ret', 'me', 'Yes, here it is.', '네, 여기 있어요.'),
    SW('ret', 'me', 'They\'re too small.', '너무 작아요.'),
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: key 열쇠 낱말 · frame 대답 틀 · slot 내 정보 · pol 공손한 말 · trap 함정 · ok 정답
     ========================================================= */
  const LL = k => `(${L4[k]})`;
  SH.judgeItem = (it, k) => SH.judge(it.Q, it.opts[k], it.card, '상황');
  const CARD_LABEL = { hsize: '손에 든 크기', hcolor: '손에 든 색', size: '바라는 크기', color: '바라는 색' };
  const cardSay = c => Object.keys(c || {}).filter(k => !['days', 'off', 'amount', 'size2', 'size3', 'retWhy', 'take'].includes(k) && c[k] != null).map(k => (CARD_LABEL[k] ? CARD_LABEL[k] + ' ' : '') + SH.factKo(k, c[k])).join(' · ');
  const segMarks = (a, k, roleOf) => SH.segs(a).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).map(s => ({ t: s.t.trim().replace(/^[,.?!]+|[,.?!]+$/g, ''), role: roleOf(s), at: k })).filter(m => m.t);
  const tagKo = j => j.tag === 'fact' ? '상황과 다른 정보' : j.tag === 'need' ? '꼭 말할 정보가 빠짐' : j.tag === 'order' ? '순서가 어색함' : j.tag === 'same' ? '손에 든 것과 같은 점' : j.tag === 'wrong' ? '틀린 문장' : '한국어 그대로 옮긴 말 · 콩글리시';
  SH.steps = function (it) {
    const q = it.Q, J = it.opts.map((_, k) => SH.judgeItem(it, k)), at = s => it.opts.map((_, k) => k).filter(k => J[k].stage === s);
    const best = it.opts[it.a], SHp = SH.SHAPE[q.shape];
    // ①
    let t1;
    if (q.fast) t1 = '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 묻는지 모르면 짐작해서 답하지 말고 다시 물어요. 들린 낱말이 있으면 그 부분만 되물어요.';
    else t1 = `열쇠 낱말 ${q.key.join(' … ')} → ${SHp.ko}(${SHp.mark}). ${SH.sayOf(q.intent)}. ${SH.INTENT[q.intent].want}`;
    if (at(1).length) t1 += ' ' + at(1).map(k => LL(k)).join(' · ') + (q.fast ? ' → 짐작한 대답이거나 다른 말을 되물어 탈락.' : J[at(1)[0]].tag === 'shape' ? ' → 모양이 맞지 않거나 다른 질문의 대답이라 탈락.' : ' → 다른 질문에 맞는 대답이라 탈락.');
    const m1 = q.fast ? [] : q.key.map(t => ({ t, role: 'key', at: 'q' }));
    at(1).forEach(k => m1.push({ t: SH.text(it.opts[k]).replace(/[.?!]$/, ''), role: 'trap', at: k }));
    // ②
    const sit = cardSay(it.card);
    const Fb = SH.FRAME[best.f], ft = Fb.t ? Fb.t.replace(/[{}]/g, '').replace('___', '…') : SH.text(best);
    let t2 = (q.fast ? '상황 → 처음 듣고 다 알아듣지 못했어요. ' : sit ? `상황 → ${sit}. ` : '') + `맞는 틀 → ${ft}`;
    if (at(2).length) t2 += ' · ' + at(2).map(k => `${LL(k)} ${tagKo(J[k])}`).join(' · ') + ' → 탈락.';
    else t2 += ' · 틀과 정보가 모두 맞는 보기만 남았어요.';
    const m2 = [];
    it.opts.forEach((a, k) => {
      if (J[k].stage === 1) return;
      const F = SH.FRAME[a.f], x = F.slot && SH.sv(F.slot, a.v), sb = x && x.bad;
      const trapOf = s => J[k].stage !== 2 ? false : (J[k].tag === 'fact' || J[k].tag === 'same' || sb) ? (F.slot ? s.r === 'slot' : s.r === 'frame') : s.r === 'frame';
      segMarks(a, k, s => s.r === 'pol' ? '' : trapOf(s) ? 'trap' : s.r).forEach(m => { if (m.role) m2.push(m); });
    });
    // ③
    let t3 = at(3).length ? at(3).map(k => `${LL(k)} ${SH.text(it.opts[k])} → ${J[k].tag === 'plain' ? '그냥 No.로 끊김' : '명령 · 조르는 말 · 따지는 말'}`).join(' · ') + ' → 탈락. ' : '무례하게 들리는 보기는 없어요. ';
    t3 += `정답 ${LL(it.a)} → ${J[it.a].why}`;
    const m3 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 3) segMarks(a, k, () => 'trap').forEach(m => m3.push(m)); else if (J[k].stage === 0) segMarks(a, k, s => s.r === 'pol' ? 'pol' : '').forEach(m => { if (m.role) m3.push(m); }); });
    m3.push({ t: SH.text(it.opts[it.a]), role: 'ok', at: it.a, whole: true });
    return [
      { head: '① 열쇠 낱말 + 질문의 모양 잡기', text: t1, marks: m1 },
      { head: '② 틀에 내 정보 넣기', text: t2, marks: m2 },
      { head: '③ 공손하게 끝내기', text: t3, marks: m3 },
    ];
  };
  SH.notes = it => it.opts.map((_, k) => { const j = SH.judgeItem(it, k); return (j.ok ? '' : `× ${['', '①', '②', '③'][j.stage]} `) + j.why; });

  /* =========================================================
     데이터 점검 — 열쇠 낱말이 말에 없거나, 모양이 글과 다르거나, 맞는 보기가 하나가 아니거나, 정답 위치가 몰리면 경고
     ========================================================= */
  SH.check = function () {
    const bad = [];
    const hasT = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase());
    Object.values(SH.Q).forEach(q => {
      if (!SH.PLACE[q.place]) bad.push(`말 ${q.id}: 곳 ${q.place}가 없어요`);
      if (!SH.INTENT[q.intent]) bad.push(`말 ${q.id}: 뜻 ${q.intent}가 없어요`);
      q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`말 ${q.id}: 열쇠 낱말 ‘${k}’가 말에 없어요`); });
      if (SH.shapeGuess(q.en) !== q.shape) bad.push(`말 ${q.id}: 적어 둔 모양 ${q.shape} · 글의 모양 ${SH.shapeGuess(q.en)}`);
      if (q.shape === 'or') { if (!q.choices || q.choices.length < 2) bad.push(`말 ${q.id}: 고르는 질문에 choices가 없어요`); else { const In = SH.INTENT[q.intent], S = Object.values(SH.SLOT).find(s => s.key === In.key); q.choices.forEach(c => { if (!S || !S.vals[c]) bad.push(`말 ${q.id}: 고를 것 ${c}가 칸에 없어요`); }); } }
    });
    Object.values(SH.FRAME).forEach(F => {
      [].concat(F.intent).forEach(i => { if (i !== 'yn' && !SH.INTENT[i]) bad.push(`틀 ${F.id}: 뜻 ${i}가 없어요`); });
      if (F.slot && !SH.SLOT[F.slot]) bad.push(`틀 ${F.id}: 칸 ${F.slot}이 없어요`);
      if (F.slot && !/___/.test(F.t)) bad.push(`틀 ${F.id}: 칸이 있는데 ___가 없어요`);
      if (F.tag !== 'ok' && !F.why) bad.push(`틀 ${F.id}: 함정 틀에 까닭(why)이 없어요`);
      if (F.slot && SH.SLOT[F.slot] && !SH.SLOT[F.slot].dyn) Object.values(SH.SLOT[F.slot].vals).forEach(v => { if (F.form && v[F.form] == null) bad.push(`틀 ${F.id}: 칸 값에 ${F.form} 꼴이 없어요`); });
    });
    Object.entries(SH.INTENT).forEach(([k, In]) => { if (In.best && typeof In.best === 'string' && !SH.FRAME[In.best]) bad.push(`뜻 ${k}의 모범 틀 ${In.best}가 없어요`); });
    // 숫자 읽기 · 크기 바꾸기 · 할인 · 돌려주기 규칙
    [[2940, 'twenty-nine forty'], [1500, 'fifteen dollars'], [2100, 'twenty-one dollars'], [605, 'six oh five'], [100, 'one dollar'], [8800, 'eighty-eight dollars']].forEach(([c, w]) => { if (SH.priceWords(c) !== w) bad.push(`값 읽기 ${c}: ${SH.priceWords(c)}`); });
    [['fifteen', '15'], ['fifty', '50'], ['twenty-nine forty', '2940'], ['twenty nine forty', '2940'], ['$29.40', '2940'], ['29.40', '2940'], ['fifty percent', '50'], ['size nine', '9']].forEach(([s, r]) => { if (!SH.canon(s).includes(r)) bad.push(`숫자 맞추기 ${s}: ${SH.canon(s).join(' ')}`); });
    if (SH.spoken('It\'s $15.00 today.') !== 'It\'s fifteen dollars today.') bad.push(`읽을 글: ${SH.spoken('It\'s $15.00 today.')}`);
    [['hoodie', 'm', 'tight', 'l'], ['jeans', 'w30', 'small', 'w32'], ['sneakers', 'u10', 'tight', null], ['tee', 's', 'loose', 'xs'], ['sneakers', 'u9', 'big', 'u8']].forEach(([it, z, f, r]) => { if (SH.sizeFor(it, z, f) !== r) bad.push(`크기 바꾸기 ${it} ${z} ${f}: ${SH.sizeFor(it, z, f)}`); });
    if (SH.salePrice(3000, 50) !== 1500 || SH.salePrice(5400, 30) !== 3780) bad.push('할인 계산이 맞지 않아요');
    [[{ days: 45, ret: 'return' }, 'late'], [{ final: true, days: 2 }, 'final'], [{ ret: 'exchange', days: 5 }, 'exchange'], [{ ret: 'return', receipt: false, days: 5 }, 'credit'], [{ ret: 'return', receipt: true, days: 30 }, 'choose']].forEach(([c, w]) => { if (SH.returnRule(c).why !== w) bad.push(`돌려주기 규칙 ${JSON.stringify(c)}: ${SH.returnRule(c).why}`); });
    // 연습 문제
    const pos = [0, 0, 0, 0];
    SH.DRILL.forEach((it, i) => {
      const w = `듣고 대답 고르기 ${i + 1}`;
      if (!it.Q) { bad.push(`${w}: 말 ${it.q}가 없어요`); return; }
      const good = it.opts.map((_, k) => k).filter(k => SH.judgeItem(it, k).ok);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]}`);
      const texts = it.opts.map(SH.text);
      if (new Set(texts).size !== texts.length) bad.push(`${w}: 같은 보기가 있어요`);
      if (!it.sit) bad.push(`${w}: 상황 글이 없어요`);
      pos[it.a]++;
    });
    if (Math.max(...pos) - Math.min(...pos) > 0) bad.push(`듣고 대답 고르기 정답 위치가 몰려 있어요: ${pos.join(',')}`);
    const places = new Set(SH.DRILL.map(it => it.place));
    SH.PLACES.forEach(p => { if (!places.has(p.id)) bad.push(`듣고 대답 고르기: ${p.ko} 문제가 없어요`); });
    if (SH.DRILL.filter(it => it.Q.fast).length < 2) bad.push('듣고 대답 고르기: 빠른 말(다시 묻기) 문제가 둘보다 적어요');
    const yesTrap = SH.DRILL.filter(it => (it.Q.shape === 'or' || it.Q.shape === 'wh') && it.opts.some(a => SH.FRAME[a.f].bare)).length;
    if (yesTrap < 4) bad.push(`듣고 대답 고르기: 고르는 · 정보 질문에 Yes 함정이 있는 문제가 ${yesTrap}개뿐이에요`);
    Object.entries(SH.MINI).forEach(([k, it]) => { const good = it.opts.map((_, i) => i).filter(i => SH.judgeItem(it, i).ok); if (good.length !== 1 || good[0] !== it.a) bad.push(`직접 해 보기 ${k}: 맞는 보기 ${good}`); });
    // 영상 · 직접 해 보기의 대화가 판정과 맞나
    const want = (w, q, a, c, ok) => { const j = SH.judge(q, a, c); if (j.ok !== ok) bad.push(`${w}: ${SH.text(a)} → 판정 ${j.ok ? '✓' : '×'} (${j.why})`); return j; };
    const D = SH.DEMO, SC = SH.SCENE, IC = SH.INTRO.card;
    want('00장 M size is there', SH.INTRO.q, SH.INTRO.lit, IC, false); want('00장 이것 + 바꿀 점', SH.INTRO.q, SH.INTRO.ok, IC, true);
    // 02장 이것 + 바꿀 점
    const CC = SH.CHANGE_CARD, JC = SH.JEANS_CARD;
    want('02장 크기만', 'rk_ok', SC.size1, IC, true); want('02장 색만', 'rk_ok', SC.color1, Object.assign({}, IC, { hsize: 'm', color: 'navy' }), true);
    want('02장 같은 색', 'rk_ok', SC.same, CC, false); want('02장 청바지 these', 'rk_ok', SC.jeans, JC, true); want('02장 청바지 this', 'rk_ok', SC.jeansThis, JC, false);
    want('02장 한 줄', 'rk_ok', L(SH.LINE.words), CC, true); want('02장 한 줄 같은 색', 'rk_ok', L(SH.LINE_SAME.words), CC, false); want('02장 한 줄 순서', 'rk_ok', L(SH.LINE_BAD.words), CC, false);
    want('02장 Give me 한 줄', 'rk_ok', L(['give', 'this', 'z_m', 'k_navy']), CC, false);
    { const cov = SH.covered(L(SH.LINE.words), 'rk_ok'); if (!cov.includes('size') || !cov.includes('color')) bad.push(`02장 한 줄이 답한 질문: ${cov}`); }
    if (SH.text(SH.model('rk_ok', CC)) !== 'Do you have this in a medium in navy?') bad.push(`02장 모범 한 줄: ${SH.text(SH.model('rk_ok', CC))}`);
    // 03장
    want('03장 둘러보기', SC.browse[0], SC.browse[1], { look: true }, true); want('03장 eye shopping', SC.browse[0], SC.browse[2], { look: true }, false);
    want('03장 찾는 물건', SC.browse[0], SC.browse[3], { look: false, item: 'hoodie' }, true); want('03장 No.', SC.browse[0], SC.browse[4], { look: true }, false);
    want('03장 어디 있어요', SC.ask[0], SC.ask[1], { item: 'jeans' }, true); want('03장 where is jeans', SC.ask[0], SC.ask[2], { item: 'jeans' }, false);
    SC.names.forEach(([k, r]) => { const it = SH.SLOT.item.vals[k].fact.item; want(`03장 ${k}`, 'fd_what', o('lf_for', k), { item: it }, false); want(`03장 ${r}`, 'fd_what', o('lf_for', r), { item: it }, true); });
    // 04장
    want('04장 크기 Yes', SC.size[0], SC.size[1], D, false); want('04장 크기', SC.size[0], SC.size[2], D, true); want('04장 I\'m a medium', SC.size[0], SC.size[3], D, true);
    want('04장 free size', SC.size[0], SC.size[4], D, false); want('04장 M size', SC.size[0], SC.size[5], D, true);
    want('04장 색 Yes', SC.color[0], SC.color[1], D, false); want('04장 색', SC.color[0], SC.color[2], D, true);
    want('04장 바꿀 점', SC.rack[0], SC.rack[1], IC, true); want('04장 Give me', SC.rack[0], SC.rack[2], IC, false);
    if (SH.Q.rk_color.en !== SH.simQ('rk_color', D).en) bad.push(`04장 두 색: ${SH.Q.rk_color.en} ≠ ${SH.simQ('rk_color', D).en}`);
    // 05장
    want('05장 입어 보기', SC.tryon[0], SC.tryon[1], D, true); want('05장 Can I fitting', SC.tryon[0], SC.tryon[2], D, false); want('05장 Can I wear', SC.tryon[0], SC.tryon[3], D, false);
    want('05장 몇 벌', SC.items[0], SC.items[1], D, true);
    want('05장 Yes, it did', SC.fit[0], SC.fit[1], D, false); want('05장 꽉 껴요', SC.fit[0], SC.fit[2], D, true);
    const qn = SH.simQ('ft_next', D), FC = Object.assign({}, D, qn.fact);
    want('05장 작은 크기', qn, SC.next[1], FC, false); want('05장 큰 크기', qn, SC.next[2], FC, true);
    if (JSON.stringify(Object.assign({}, SH.FITCARD, { count: 0 })) !== JSON.stringify(Object.assign({}, SH.FITCARD, { hsize: FC.hsize, hcolor: FC.hcolor, size: FC.size, color: FC.color, count: 0 }))) bad.push('05장 탈의실 카드가 DEMO와 달라요');
    // 06장
    want('06장 값', SC.askp[0], SC.askp[1], D, true); want('06장 are these', SC.askp[0], SC.askp[2], D, false); want('06장 how much money', SC.askp[0], SC.askp[3], D, false);
    want('06장 D.C.', SC.askp[0], SC.askp[4], Object.assign({}, D, { ask: 'sale' }), false); want('06장 on sale', SC.askp[0], SC.askp[5], Object.assign({}, D, { ask: 'sale' }), true);
    want('06장 되묻기 15', SC.cost[0], SC.cost[1], D, true); want('06장 되묻기 50', SC.cost[0], SC.cost[2], D, false); want('06장 살게요', SC.cost[0], SC.cost[3], D, true);
    want('06장 one plus one', SC.bogo[0], SC.bogo[1], D, false); want('06장 하나 더', SC.bogo[0], SC.bogo[2], D, true);
    if (SH.Q.pr_cost.en !== SH.simQ('pr_cost', D).en) bad.push(`06장 값: ${SH.Q.pr_cost.en} ≠ ${SH.simQ('pr_cost', D).en}`);
    if (SH.priceOf(D) !== SH.Q.pr_cost.fact.amount) bad.push(`06장 할인 값: ${SH.money(SH.priceOf(D))}`);
    // 07장
    want('07장 Yes, I found', SC.found[0], SC.found[1], D, false); want('07장 Yes, I did', SC.found[0], SC.found[2], D, true);
    want('07장 I don\'t have', SC.member[0], SC.member[1], D, false); want('07장 회원 카드 없음', SC.member[0], SC.member[2], D, true);
    want('07장 vinyl bag', SC.bag[0], SC.bag[1], D, false); want('07장 봉투', SC.bag[0], SC.bag[2], D, true);
    want('07장 고르기 Yes', SC.paym[0], SC.paym[1], D, false); want('07장 카드', SC.paym[0], SC.paym[2], D, true); want('07장 영수증', SC.rcpt[0], SC.rcpt[1], D, true);
    const qp = SH.simQ('py_pay', D);
    if (SH.Q.py_pay.en !== qp.en) bad.push(`07장 계산: ${SH.Q.py_pay.en} ≠ ${qp.en}`);
    if (SH.bill(D).total !== 2100) bad.push(`07장 합계: ${SH.money(SH.bill(D).total)} (≠ $21.00)`);
    // 08장
    const EX = SH.EXCARD, RF = SH.REFCARD;
    want('08장 Change, please', SC.retw[0], SC.retw[1], EX, false); want('08장 Refund me', SC.retw[0], SC.retw[2], RF, false);
    want('08장 교환', SC.retw[0], SC.retw[3], EX, true); want('08장 환불', SC.retw[0], SC.retw[4], RF, true);
    want('08장 영수증', SC.rcpt2[0], SC.rcpt2[1], EX, true); want('08장 까닭', SC.why[0], SC.why[1], EX, true); want('08장 바꿀 크기', SC.exsize[0], SC.exsize[1], EX, true);
    want('08장 바꿀 크기 거꾸로', SC.exsize[0], o('sz_pl', 'w28'), EX, false);
    want('08장 환불 방법 Yes', SC.way[0], SC.way[1], RF, false); want('08장 환불 방법', SC.way[0], SC.way[2], RF, true);
    want('08장 따지기', SC.final[0], SC.final[1], RF, false); want('08장 알겠어요', SC.final[0], SC.final[2], RF, true);
    want('08장 store credit 묻기', 'rt_how', o('rp_what'), RF, true);
    SH.METHOD.forEach(([q, a, c], i) => want(`09장 ${i + 1}`, q, a, c, true));
    // 실전: 지워지는 단계가 줄 글과 맞나
    SH.PRACTICE.forEach((p, i) => {
      const w = `실전 ${i + 1}`, q = SH.practiceQ(p);
      const J = p.opts.map(a => SH.judge(q, a, SH.PCARD));
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
      const c = SH.newCard(rnd);
      if (!SH.changes(c).length) bad.push(`시뮬레이터 카드 ${n}: 바꿀 점이 없어요`);
      if (c.fit !== 'good' && !c.size2) bad.push(`시뮬레이터 카드 ${n}: 바꿀 크기가 없어요`);
      if (c.ret === 'exchange' && !c.size3) bad.push(`시뮬레이터 카드 ${n}: 교환할 크기가 없어요`);
      SH.simQs(c).forEach(id => {
        const q = SH.simQ(id, c), C = Object.assign({}, c, q.fact || {}), m = SH.model(q, C), j = SH.judge(q, m, C);
        if (!j.ok) bad.push(`시뮬레이터 ${id}: 모범 대답이 탈락 (${SH.text(m)} · ${j.why})`);
        const ms = SH.matchSpoken(SH.spoken(SH.text(m)), q, C);
        if (!ms.ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 말로 해도 통과하지 못해요 (${SH.text(m)} · ${ms.why})`);
        if (SH.shapeGuess(q.en) !== q.shape) bad.push(`시뮬레이터 ${id}: 모양 ${q.shape} · 글 ${SH.shapeGuess(q.en)} (${q.en})`);
        q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`시뮬레이터 ${id}: 열쇠 낱말 ‘${k}’가 말에 없어요 (${q.en})`); });
        const fr = SH.simFrames(q.intent, C);
        if (!fr) { bad.push(`시뮬레이터 ${id}: 틀 칩이 없어요`); return; }
        const okN = fr.filter(f => { const F = SH.FRAME[f]; if (!F.slot) return SH.judge(q, { f }, C).ok; return SH.slotChoices(F.slot, C, rnd).some(v => SH.judge(q, { f, v }, C).ok); }).length;
        if (okN !== 1) bad.push(`시뮬레이터 ${id}: 맞는 틀이 ${okN}개예요 (${fr.join(',')})`);
        fr.forEach(f => { const F = SH.FRAME[f]; if (F.slot && !SH.slotChoices(F.slot, C, rnd).length) bad.push(`시뮬레이터 ${id}: ${f}의 칸 칩이 없어요`); });
        if (F0ok(q, C, fr, rnd) === false) bad.push(`시뮬레이터 ${id}: 맞는 틀의 칸 칩에 카드 값이 없어요`);
        if (q.intent === 'rack') { const L0 = SH.modelLine(C), jl = SH.judge(q, L0, C), ml = SH.matchSpoken(SH.text(L0), q, C); if (!jl.ok || !ml.ok || SH.covered(L0, q).filter(i => !ml.covered.includes(i)).length) bad.push(`시뮬레이터 바꿀 점 한 줄: ${SH.text(L0)} · ${jl.why} · ${ml.why}`); }
      });
    }
    // 말로 대답하기: 모양 · 다른 질문의 대답 · 다른 값 · 콩글리시는 통과하지 않아야
    const D2 = SH.DEMO, nope = (w, raw, q, c) => { const r = SH.matchSpoken(raw, q, c); if (r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과해요`); return r; }, yep = (w, raw, q, c) => { const r = SH.matchSpoken(raw, q, c); if (!r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과하지 않아요 (${r.why})`); return r; };
    Object.values(SH.Q).filter(q => (q.shape === 'or' || q.shape === 'wh') && !q.fast).forEach(q => { ['yes', 'yes please', 'yeah sure'].forEach(y => nope(`${q.id} ${y}`, y, q, D2)); });
    yep('yes navy', 'Yes, navy please.', 'rk_color', D2); nope('고르지 않은 색', 'Black, please.', 'rk_color', D2);
    nope('hood T', 'I\'m looking for a hood T.', 'fd_what', { item: 'hoodie' }); nope('one piece', 'I\'m looking for a one piece.', 'fd_what', { item: 'dress' }); nope('padding', 'Do you have a padding?', 'fd_pass', { item: 'jacket' });
    yep('hoodie', 'Yes, I\'m looking for a hoodie.', 'dr_help', { look: false, item: 'hoodie' }); nope('eye shopping', 'Just eye shopping.', 'dr_help', { look: true });
    nope('free size', 'Free size, please.', 'rk_size', D2); yep('I\'m a medium', 'I\'m a medium.', 'rk_size', D2); nope('다른 크기', 'A large, please.', 'rk_size', D2);
    nope('M size is there', 'M size is there?', 'rk_ok', SH.INTRO.card); nope('같은 색', 'Do you have this in black?', 'rk_ok', SH.CHANGE_CARD); nope('these 하나', 'Do you have these in a medium?', 'rk_ok', SH.INTRO.card);
    yep('this in a medium', 'Do you have this in a medium?', 'rk_ok', SH.INTRO.card); nope('bigger', 'Do you have a bigger one?', 'rk_ok', SH.INTRO.card);
    nope('can I fitting', 'Can I fitting?', 'ft_pass', D2); nope('can I wear', 'Can I wear this?', 'ft_pass', D2); yep('could I try', 'Could I try this on?', 'ft_pass', D2);
    nope('작은 크기로', 'Yes, could I try a small?', SH.simQ('ft_next', D2), Object.assign({}, D2, SH.simQ('ft_next', D2).fact)); nope('Yes만', 'Yes.', SH.simQ('ft_next', D2), Object.assign({}, D2, SH.simQ('ft_next', D2).fact));
    nope('how much money', 'How much money?', 'pr_pass', D2); nope('DC', 'DC is possible?', 'pr_pass', Object.assign({}, D2, { ask: 'sale' }));
    nope('fifty', 'Sorry, did you say fifty dollars?', 'pr_cost', D2); { const r = SH.matchSpoken('Sorry, did you say fifteen dollars?', 'pr_cost', D2); if (r.repair !== 'check') bad.push(`말로 대답하기 같은 값 되묻기: ${r.why}`); }
    nope('one plus one', 'Oh, one plus one?', 'pr_bogo', D2); nope('vinyl', 'Vinyl bag, please.', 'py_bag', D2); nope('다른 내는 방법', 'Cash, please.', 'py_pay', D2);
    nope('change', 'Change, please.', 'rt_help', SH.EXCARD); nope('환불 · 교환 반대', 'I\'d like to return these.', 'rt_help', SH.EXCARD); nope('this 짝', 'I\'d like to exchange this.', 'rt_help', SH.EXCARD);
    yep('exchange these', 'I\'d like to exchange these.', 'rt_help', SH.EXCARD); nope('다른 까닭', 'They\'re too big.', 'rt_why', SH.EXCARD);
    nope('거꾸로 크기', 'A 28, please.', 'rt_size', SH.EXCARD); yep('바꿀 크기', 'A 32, please.', 'rt_size', SH.EXCARD);
    // 따라 말하기: 같은 말은 모두 맞아야 · 숫자 낱말로 말해도 맞아야
    SH.SHADOW.forEach((s, i) => { const r = SH.compareWords(s.en, s.en), r2 = SH.compareWords(s.en, SH.spoken(s.en)); if (r.hit !== r.total || r2.hit !== r2.total) bad.push(`따라 말하기 ${i + 1}: 같은 글이 다 맞지 않아요`); if (!SH.PLACE[s.place]) bad.push(`따라 말하기 ${i + 1}: 곳이 없어요`); });
    if (SH.SHADOW.length !== 28) bad.push(`따라 말하기 문장 수: ${SH.SHADOW.length}`);
    SH.PLACES.forEach(p => { if (SH.SHADOW.filter(s => s.place === p.id).length !== 4) bad.push(`따라 말하기: ${p.ko} 문장이 넷이 아니에요`); });
    bad.forEach(b => console.warn('[쇼핑] ' + b));
    return bad;
  };
  // 맞는 틀의 칸 칩에 카드의 값이 들어 있나 (dyn 칸은 건너뜀)
  function F0ok(q, C, fr, rnd) {
    const right = fr.find(f => [].concat(SH.FRAME[f].intent).includes(q.intent) && SH.FRAME[f].slot && SH.FRAME[f].tag === 'ok');
    if (!right) return null;
    const F = SH.FRAME[right], v = SH.slotVal(F.slot, C);
    if (v == null) return null;
    return SH.slotChoices(F.slot, C, rnd).includes(String(v));
  }

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  SH.allText = function () {
    const out = [];
    Object.values(SH.Q).forEach(q => out.push(q.en, q.ko, q.short || ''));
    Object.values(SH.FRAME).forEach(F => out.push(F.t, F.ko, F.why || '', F.note || ''));
    Object.values(SH.SLOT).forEach(S => Object.values(S.vals || {}).forEach(v => out.push(Object.values(v).filter(x => typeof x === 'string').join(' '))));
    Object.values(SH.SHAPE).forEach(a => out.push(a.ko, a.mark, a.ans, a.say, a.offer || '')); Object.values(SH.INTENT).forEach(a => out.push(a.ans, a.want || '', a.say || '', a.turn || ''));
    SH.PLACES.forEach(p => out.push(p.ko, p.en)); Object.values(SH.ITEMS).forEach(m => out.push(m.en, m.ko, m.en.toUpperCase(), m.pl));
    Object.values(SH.COLORS).forEach(c => out.push(c.ko)); Object.values(SH.SIZE).forEach(z => out.push(z.low, z.tag, z.ko)); Object.values(SH.FIT).forEach(f => out.push(f.t, f.ko));
    SH.PRACTICE.forEach(p => out.push(p.lines.join(''))); SH.SHADOW.forEach(s => out.push(s.en, s.ko));
    SH.LINKED.forEach(l => out.push(l.en, l.ko, l.sound.map(s => s[0]).join(''))); SH.PAIRS.forEach(p => out.push(p.join('')));
    Object.values(SH.OCAT).forEach(c => out.push(c.ko)); Object.values(SH.OW).forEach(w => out.push(w.t));
    out.push(SH.STORE, SH.STORE.toUpperCase(), SH.CLERK, SH.LONG, '$0123456789.·+×–%', 'SALE OFF NEW IN FITTING ROOMS CASHIER RETURNS EXCHANGES ENTRANCE TOPS BOTTOMS SHOES SOCKS BOGO BUY ONE GET ONE FREE TOTAL RECEIPT THANK YOU SIZE COLOR PRICE WAS NOW ITEMS ROOM STORE CREDIT REFUND DAYS 30 FINAL SALE');
    return out.join('');
  };
})();
