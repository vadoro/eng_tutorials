/* 전화 회화 (예약 · 문의) — 규칙 엔진과 대화 자료 (상황별 영어 회화)
 *
 * 전화는 얼굴도 몸짓도 없이 소리만 들려요 — 호텔 튜토리얼의 ‘전화 부탁’을 넓혔어요.
 *   첫마디에 용건을 → Hi, I'd like to make a reservation for Friday, please. · Hi, I'm calling to ask about your swimming lessons.
 *   이름은 철자로, 헷갈리는 글자는 as in으로 → H-A-N, N as in Nancy (N과 M, P와 B, S와 F는 전화에서 비슷하게 들려요)
 *   들은 숫자는 되짚고, 상대가 잘못 되짚으면 바로잡기 → So, 8:15? · No, it isn't. It's 555-0139.
 *   메시지는 누구 → 무슨 일 → 부탁(+ 번호) → This is Jiwoo Han. I'm calling about … Could you ask him to call me back at 555-0139?
 *   소리가 끊기면 → Sorry, you're breaking up. Could you say that again?
 * 짧은 질문은 모양(Yes/No · 고르는 질문 · 정보 질문)이 대답을 정하고, Yes/No 질문은 첫 낱말이 짧은 대답의 짝을 정해요(Was that …? → No, it wasn't.).
 *
 * 규칙 엔진은 소리를 듣지 않고, 말마다 적어 둔 ‘뜻(intent) · 모양(shape)’과 ‘대답 틀(frame) + 내 정보(slot)’,
 * 그리고 내 카드(또는 상황)의 사실을 맞춰 봐요. 상대가 되짚은 철자 · 번호가 맞는지(hok · pok)는 상대의 말에 적어 둬요.
 *
 * 3단계 말하기 법 — PN.judge(상대의 말, 대답, 카드)
 *   ① 열쇠 낱말 + 질문의 모양 잡기 — 고르는 질문 · 정보 질문에 Yes · No만 하면 탈락, 고르는 질문이면 상대가 말한 것 가운데 골랐나,
 *                      대답이 그 말(intent)에 맞나. 빠르거나 끊겨서 못 알아들은 말(fast)이면 짐작한 대답은 탈락 → 다시 묻기
 *   ② 틀에 내 정보 넣기 — 틀이 자연스러운가(한국어 그대로 · 틀린 문장 · Yes/No 짝이 다른 대답이면 탈락), 날짜 · 사람 수 · 이름 · 번호가 카드와 맞나,
 *                      상대가 잘못 되짚은 것을 바로잡았나, 들은 시간 · 값 · 준비물을 되짚었나, 메시지 한 줄의 조각이 맞나
 *   ③ 공손하게 끝내기 — 명령 · 퉁명스러운 말(blunt)이나 고맙다는 말 없이 끊는 말(plain)이면 탈락
 * judge → { ok, stage: 0 | 1 | 2 | 3, why, tag }
 *
 * 메시지 한 줄: PN.checkLine(낱말, 카드) — 누구(This is …) → 무슨 일(I'm calling about …) → 부탁(Could you ask him to call me back) → 번호(at 555-0139)
 *              PN.fixLine(낱말, 카드) — 받는 사람의 대답(빠진 조각을 묻거나, 낱말을 고쳐 주거나, 받아 적거나)
 * 숫자: PN.timeWords(8:15 → eight-fifteen) · PN.phoneWords(555-0139 → five-five-five, oh-one-three-nine) · PN.spoken(화면 글 → 소리)
 *
 * 영상의 ✓·×, 직접 해 보기, 전화 시뮬레이터, 듣고 대답 고르기, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 PN.check()가 콘솔에 경고를 내요.
 * 사람 이름, 식당 · 스포츠 센터 이름, 전화번호, 시간, 값은 영어 연습을 위해 지어낸 예시예요(555-01XX는 영화 · 책에서 쓰는 지어낸 번호예요).
 */
(function () {
  'use strict';
  const PN = (window.PN = {});
  const L4 = 'ABCD';

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s).replace(/\s*\([^()]*\)\s*$/, ''); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; if (/[0-9]/.test(s[i])) return '0136781'.includes(s[i]) ? 0xAC01 : 0xAC00; if (/[A-Za-z]/.test(s[i])) return /[lmnr]/i.test(s[i]) ? 0xAC01 : 0xAC00; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const rieul = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 === 8 : false; };
  const wa = s => s + (has(s) ? '과' : '와'), eul = s => s + (has(s) ? '을' : '를'), ig = s => s + (has(s) ? '이' : '가');
  const ro = s => s + (has(s) && !rieul(s) ? '으로' : '로'), ieyo = s => s + (has(s) ? '이에요' : '예요'), eun = s => s + (has(s) ? '은' : '는');
  PN.josa = { wa, eul, ig, ro, ieyo, eun };

  /* =========================================================
     일곱 곳 (전화 세 통: 식당 예약 → 스포츠 센터 문의 · 메시지 → 코치의 전화). sp: 그곳 상대의 목소리 (voices.js)
     ========================================================= */
  PN.PLACES = [
    { id: 'book', ko: '예약 전화 걸기', en: 'Making a reservation', sp: 'us', call: 1 },
    { id: 'time', ko: '시간 맞추기 · 되짚기', en: 'Finding a time', sp: 'us', call: 1 },
    { id: 'name', ko: '이름 철자 부르기', en: 'Spelling your name', sp: 'us', call: 1 },
    { id: 'ask', ko: '문의 전화 걸기', en: 'Asking for information', sp: 'ca', call: 2 },
    { id: 'msg', ko: '메시지 남기기', en: 'Leaving a message', sp: 'gb', call: 2 },
    { id: 'number', ko: '전화번호 불러 주기', en: 'Giving your number', sp: 'gb', call: 2 },
    { id: 'call', ko: '걸려 온 전화 받기', en: 'Taking a call', sp: 'au', call: 3 },
  ];
  PN.PLACE = {}; PN.PLACES.forEach((p, i) => { p.i = i; PN.PLACE[p.id] = p; });
  PN.ME = 'me';
  // 전화 세 통 (지어낸 곳 · 사람)
  PN.CALLS = {
    1: { ko: '식당 예약', en: 'Lantern Bistro', who: 'Ben', wko: '벤(식당 직원)', sp: 'us' },
    2: { ko: '수영 강습 문의', en: 'Kellport Sports Center', who: 'Grace · Olivia', wko: '그레이스(안내 데스크) · 올리비아(수영 사무실)', sp: 'ca' },
    3: { ko: '코치의 전화', en: 'Coach Diaz', who: 'Matt Diaz', wko: '맷 디아스 코치', sp: 'au' },
  };
  PN.BISTRO = 'Lantern Bistro';               // 지어낸 식당
  PN.CENTER = 'Kellport Sports Center';       // 지어낸 스포츠 센터
  PN.COACH = 'Coach Diaz';                    // 지어낸 코치 (호주 사람)
  // 내가 먼저 말을 꺼내는 곳 (전화를 걸어 용건을 말함)
  PN.ME_FIRST = { book: 1, ask: 1 };

  /* =========================================================
     질문의 모양 세 가지 (+ 안내). mark: 그림 이름 (scenes.js의 shape_yn · shape_or · shape_wh · shape_note)
     ========================================================= */
  PN.SHAPE = {
    yn: { ko: 'Yes/No 질문', mark: '스위치', ans: 'Yes · No + 짝 맞는 짧은 대답', say: 'Yes/No 질문이에요. 질문의 첫 낱말로 짧은 대답을 만들어요', offer: '권하거나 부탁하는 말이면 Yes · No 대신 바로 답하거나 해 주면 돼요' },
    or: { ko: '고르는 질문', mark: '갈림길', ans: '고른 것 + please', say: '고르는 질문(A or B?)이에요. 상대가 말한 것 가운데 하나를 골라 말해요' },
    wh: { ko: '정보 질문', mark: '빈 상자', ans: '정보 + please', say: '정보 질문이에요. 묻는 정보를 채워 말해요' },
    note: { ko: '안내', mark: '말풍선', ans: '되짚기 · 짧게 답하기', say: '질문이 아니라 알려 주는 말이에요' },
  };
  PN.shapeOf = q => (typeof q === 'string' ? PN.Q[q] : q).shape;
  // 글만 보고 짐작한 모양 (점검용): 물음표 문장 가운데 마지막 것 → or가 있으면 고르기, 의문사로 시작하면 정보, 아니면 Yes/No
  PN.shapeGuess = function (en) {
    const qs = String(en).match(/[^.!?]*\?/g);
    if (!qs) return 'note';
    let s = qs[qs.length - 1].trim().toLowerCase().replace(/^(and|so|great|okay|sure|perfect|thanks|now|no problem|hi|hey|hello|right|alright|lovely|yes|oh|kay)[,!]?\s+/, '');
    if (/\bor\b/.test(s)) return 'or';
    if (/^(how|what|what's|which|where|when|who|why|whatcha)\b/.test(s)) return 'wh';
    return 'yn';
  };
  // Yes/No 질문의 짝 (질문의 첫 낱말 → 짧은 대답)
  PN.AUX = {
    is: { q: 'Is this · Is that …?', a: 'Yes, it is. · No, it isn\'t.' },
    was: { q: 'Was that …?', a: 'Yes, it was. · No, it wasn\'t.' },
    do: { q: 'Do you …?', a: 'Yes, I do. · No, I don\'t.' },
  };
  PN.AUX_FIRST = { is: 'is', was: 'was', do: 'do' };

  /* =========================================================
     숫자 읽기 — 시각 · 전화번호 · 값 · 철자 (화면 글 → 소리)
     ========================================================= */
  const NUMW = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };
  PN.NUMW = NUMW;
  const numWord = n => n < 20 || (n < 100 && n % 10 === 0) ? NUMW[n] : n < 100 ? `${NUMW[n - n % 10]}-${NUMW[n % 10]}` : n < 1000 ? `${NUMW[Math.floor(n / 100)]} hundred${n % 100 ? ' ' + numWord(n % 100) : ''}` : String(n);
  PN.numWord = numWord;
  // 시각: 8:15 → eight-fifteen · 11:30 → eleven-thirty · 7 → seven
  PN.timeWords = t => { const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(t)); if (!m) return String(t); const h = +m[1], mm = m[2] == null ? 0 : +m[2]; return mm ? `${NUMW[h]}-${mm < 10 ? 'oh-' + NUMW[mm] : numWord(mm)}` : NUMW[h]; };
  // 전화번호: 숫자를 하나씩, 0은 oh, 세 자리 · 네 자리 묶음 사이에 쉼 → five-five-five, oh-one-three-nine
  const digitWords = d => String(d).split('').map(x => x === '0' ? 'oh' : NUMW[+x]).join('-');
  PN.phoneWords = p => { const m = /^(\d{3})-(\d{4})$/.exec(String(p)); return m ? `${digitWords(m[1])}, ${digitWords(m[2])}` : String(p); };
  PN.priceWords = n => `${numWord(+n)} dollars`;
  // 철자: H-A-N → H, A, N
  PN.letterWords = s => String(s).split('-').join(', ');
  // 소리 내어 읽을 글
  PN.spoken = s => String(s)
    .replace(/\b(\d{3}-\d{4})\b/g, (m, p) => PN.phoneWords(p))
    .replace(/\b(\d{1,2}):(\d{2})\b/g, m => PN.timeWords(m))
    .replace(/\$(\d+)\b/g, (m, d) => PN.priceWords(d))
    .replace(/\b([A-Z](?:-[A-Z])+)\b/g, m => PN.letterWords(m))
    .replace(/\b(\d{1,2})\b/g, (m, d) => numWord(+d));
  // 헷갈리는 숫자 짝: 13~19 ↔ 30~90 (fifTEEN ↔ FIFty)
  PN.teenSwap = n => n >= 13 && n <= 19 ? (n - 10) * 10 : n >= 30 && n <= 90 && n % 10 === 0 ? n / 10 + 10 : null;
  // 시각의 분 teen ↔ ty: 8:15 → 8:50 · 8:30 → 8:13
  PN.timeTrap = t => { const [h, m] = String(t).split(':').map(Number), s = PN.teenSwap(m); return s == null ? null : `${h}:${String(s).padStart(2, '0')}`; };
  // 끝 두 자리를 바꾼 번호 (함정): 0139 → 0193
  PN.phoneSwap = p => p.slice(0, 2) + p[3] + p[2];
  PN.phoneText = p => `555-${p}`;

  /* =========================================================
     첫 번째 전화 — 식당 예약 (지어낸 식당 Lantern Bistro)
     ========================================================= */
  PN.DAYS = { fri: { t: 'Friday', ko: '금요일' }, sat: { t: 'Saturday', ko: '토요일' } };
  PN.MEALS = { lunch: { t: 'lunch', ko: '점심' }, dinner: { t: 'dinner', ko: '저녁' } };
  PN.WANT = { lunch: 12, dinner: 7 };          // 가고 싶은 시각 (다 찼음)
  PN.PPL = { 2: { t: 'two', ko: '두 명' }, 3: { t: 'three', ko: '세 명' }, 4: { t: 'four', ko: '네 명' }, 5: { t: 'five', ko: '다섯 명' } };
  PN.ALTS = { later: { t: 'later', ko: '더 늦은 시간' }, earlier: { t: 'earlier', ko: '더 이른 시간' } };
  // 직원이 알려 주는 빈 시간 (카드에 없음 — 듣고 되짚어요). 분은 teen ↔ ty로 헷갈리기 쉬워요(8:15 ↔ 8:50)
  PN.OFFERS = { lunch: { later: ['1:15', '1:30'], earlier: ['11:15', '11:30'] }, dinner: { later: ['8:15', '8:30'], earlier: ['5:15', '5:30'] } };
  PN.offerOf = c => PN.OFFERS[c.meal][c.alt][c.offer || 0];

  /* =========================================================
     이름 — 성마다 전화에서 헷갈리기 쉬운 글자 하나 (as in + 흔한 이름)
     ========================================================= */
  PN.AS = { N: 'Nancy', M: 'Mary', P: 'Peter', B: 'Bob', S: 'Sam', F: 'Frank' };
  PN.NAMES = {
    han: { t: 'Han', ko: '한', spell: 'H-A-N', L: 'N', alt: 'M' },
    park: { t: 'Park', ko: '박', spell: 'P-A-R-K', L: 'P', alt: 'B' },
    kim: { t: 'Kim', ko: '김', spell: 'K-I-M', L: 'M', alt: 'N' },
    seo: { t: 'Seo', ko: '서', spell: 'S-E-O', L: 'S', alt: 'F' },
  };
  PN.SUR_IDS = Object.keys(PN.NAMES);
  PN.GIVEN = ['Jiwoo', 'Minji', 'Hana', 'Yuna'];
  PN.GIVEN_KO = { Jiwoo: '지우', Minji: '민지', Hana: '하나', Yuna: '유나' };
  PN.asIn = L => `${L} as in ${PN.AS[L]}`;
  // 잘못 들은 철자 (헷갈리는 글자를 바꿈): H-A-N → H-A-M
  PN.wrongSpell = id => { const n = PN.NAMES[id]; return n.spell.replace(n.L, n.alt); };
  PN.fullName = c => `${c.given || 'Jiwoo'} ${PN.NAMES[c.sur || 'han'].t}`;
  PN.fullKo = c => `${PN.NAMES[c.sur || 'han'].ko}${PN.GIVEN_KO[c.given || 'Jiwoo']}`;

  /* =========================================================
     두 번째 전화 — 스포츠 센터 문의 (지어낸 강습 · 값) · 메시지 · 전화번호
     ========================================================= */
  PN.TOPICS = { swim: { t: 'swimming lessons', ko: '수영 강습' }, yoga: { t: 'yoga classes', ko: '요가 수업' } };
  PN.LEVELS = {
    beg: { t: 'beginner', ko: '초급', days: 'Tuesdays and Thursdays', dko: '화요일 · 목요일', from: 6, to: 7, price: 40, first: 'tue' },
    int: { t: 'intermediate', ko: '중급', days: 'Mondays and Wednesdays', dko: '월요일 · 수요일', from: 7, to: 8, price: 50, first: 'mon' },
  };
  PN.LVL_IDS = Object.keys(PN.LEVELS);
  PN.otherLvl = l => l === 'beg' ? 'int' : 'beg';
  PN.infoLine = l => { const v = PN.LEVELS[l]; return `The ${v.t} class is on ${v.days} from ${v.from} to ${v.to}, and it's $${v.price} a month.`; };
  PN.PHONES = ['0139', '0147', '0162', '0185'];  // 555-01XX (지어낸 번호)

  /* =========================================================
     세 번째 전화 — 코치가 알려 주는 준비물 · 첫 수업 요일
     ========================================================= */
  PN.WDAYS = { mon: { t: 'Monday', ko: '월요일' }, tue: { t: 'Tuesday', ko: '화요일' }, wed: { t: 'Wednesday', ko: '수요일' }, thu: { t: 'Thursday', ko: '목요일' } };
  // 첫 수업 요일과 헷갈리는 요일 = 같은 반의 다른 요일
  PN.dayTrap = d => ({ tue: 'thu', thu: 'tue', mon: 'wed', wed: 'mon' })[d];
  PN.BRINGS = { gog: { t: 'a swimsuit and goggles', ko: '수영복과 물안경' }, cap: { t: 'a swimsuit and a swim cap', ko: '수영복과 수영모' } };
  PN.BRING_IDS = Object.keys(PN.BRINGS);
  PN.bringLine = v => { const b = PN.bringParse(v); return `You'll need to bring ${PN.BRINGS[b.item].t} on ${PN.WDAYS[b.day].t}.`; };

  /* =========================================================
     말의 뜻(intent) — 질문의 모양과 기대하는 대답
     yn: Yes/No 질문에 그냥 Yes · No로만 답할 때 → { yes: 카드 → 카드가 바라는 Yes(true) · No(false) · 모름(null), need: 통과하지만 덧붙일 말, strict · noStrict: 탈락 까닭 }
     key: 고르는 질문에서 고른 것을 담는 사실 이름 · best(카드, 말): 모범 틀
     ========================================================= */
  const I = (shape, ans, want, best, o = {}) => Object.assign({ shape, ans, want, best }, o);
  PN.INTENT = {
    need: I('wh', '무엇을 도와줄지 묻는 질문', '첫마디에 용건을 → Hi, I\'d like to make a reservation for Friday, please. · Hi, I\'m calling to ask about your swimming lessons.',
      (c, q) => q && q.place === 'ask' ? 'nd_ask' : 'nd_book', { turn: '용건 말하기' }),
    meal: I('or', '점심과 저녁 가운데 고르라는 질문', '고른 것 + please → Dinner, please.', 'ml_pl', { turn: '점심 · 저녁', key: 'meal' }),
    ppl: I('wh', '몇 사람인지 묻는 질문', 'For + 사람 수 → For four, please.', 'pp_for', { turn: '사람 수' }),
    when: I('wh', '몇 시가 좋은지 묻는 질문', 'At + 시각 → At 7, please.', 'wn_at', { turn: '시각' }),
    full: I('note', '그 시각은 자리가 다 찼다는 안내', '다른 시간을 질문으로 → Oh, I see. Do you have anything later?', 'fl_alt',
      { turn: '자리가 다 참', say: '그 시각은 다 찼다는 안내예요. 알겠다고만 하지 말고 다른 시간이 있는지 질문으로 물어요' }),
    offer: I('note', '빈 시각을 알려 주는 말', '들은 시각을 되짚어 → So, 8:15? (fifTEEN — 뒤를 세게)', 'of_so', { turn: '시각 되짚기', say: '빈 시각을 알려 주는 말이에요. 숫자는 되짚어 확인해요' }),
    name: I('wh', '예약자 이름을 묻는 질문', 'It\'s + 성 → It\'s Han.', 'nm_is', { turn: '예약자 이름' }),
    spell: I('yn', '철자를 불러 달라는 부탁', '바로 철자를 → Sure. It\'s H-A-N, N as in Nancy. (헷갈리는 글자에 as in)', 'sp_it',
      { turn: '철자 부르기', offer: true, yn: { yes: () => true, strict: '철자를 불러 달라는 부탁에 Yes만 하면 상대가 기다려요. 바로 철자를 불러요 → Sure. It\'s H-A-N, N as in Nancy.' } }),
    check: I('yn', '들은 철자가 맞는지 확인하는 질문', '맞으면 → Yes, that\'s right. · 틀리면 바로잡기 → No, N as in Nancy.', c => c.hok === true ? 'ck_yes' : 'ck_no',
      { turn: '철자 확인', yn: { yes: c => c.hok == null ? null : !!c.hok, noStrict: 'No만 하면 상대가 맞는 글자를 몰라요. 맞는 글자를 as in과 함께 다시 불러요 → No, N as in Nancy.' } }),
    need2: null,
    level: I('or', '초급 반과 중급 반 가운데 고르라는 질문', '고른 것 + please → The beginner class, please.', 'lv_pl', { turn: '반 고르기', key: 'lvl' }),
    info: I('note', '수업 요일 · 시간 · 값을 알려 주는 말', '들은 요일 · 시간 · 값을 되짚어 → So, Tuesdays and Thursdays from 6 to 7, $40 a month?', 'in_so',
      { turn: '수업 안내 되짚기', say: '수업 요일 · 시간 · 값을 알려 주는 말이에요. 숫자(특히 forty ↔ fourteen)는 되짚어 확인해요' }),
    msg: I('yn', '메시지를 남기겠느냐고 권하는 말', '남기려면 → Yes, please. · 바로 메시지를 → This is Jiwoo Han. I\'m calling about … Could you ask him to call me back?', c => c.msg === false ? 'ms_no' : 'g_yesp',
      { turn: '메시지 남기기', offer: true, yn: { yes: c => c.msg == null ? null : !!c.msg } }),
    go: I('note', '메시지를 말하라는 말', '누구 → 무슨 일 → 부탁(+ 번호) → This is Jiwoo Han. I\'m calling about the beginner swimming class. Could you ask him to call me back at 555-0139?', 'line',
      { turn: '메시지 한 줄', say: '메시지를 말하라는 말이에요. 누구인지 · 무슨 일인지 · 무엇을 바라는지 차례로 말해요' }),
    nb: I('wh', '연락받을 전화번호를 묻는 질문', 'It\'s + 번호(숫자 하나씩, 0은 oh) → It\'s 555-0139.', 'nb_is', { turn: '전화번호' }),
    pcheck: I('yn', '받아 적은 번호가 맞는지 확인하는 질문', '맞으면 → Yes, that\'s right. · 틀리면 바로잡기 → No, it isn\'t. It\'s 555-0139.', c => c.pok === true ? 'nc_yes' : 'nc_no',
      { turn: '번호 확인', yn: { yes: c => c.pok == null ? null : !!c.pok, noStrict: 'No만 하면 상대가 맞는 번호를 몰라요. 맞는 번호를 다시 불러요 → No, it isn\'t. It\'s 555-0139.' } }),
    answer: I('yn', '나를 찾는 전화인지 묻는 질문', '내가 맞으면 → Yes, speaking. (전화를 받은 사람이 바로 나예요)', 'cb_sp',
      { turn: '전화 받기', yn: { yes: () => true, need: '전화에서는 Yes, speaking.이 가장 흔해요(바로 저예요).' } }),
    bring: I('note', '가져올 것과 첫 수업 요일을 알려 주는 말', '들은 준비물과 요일을 되짚어 → So, a swimsuit and goggles on Tuesday?', 'br_so',
      { turn: '준비물 되짚기', say: '가져올 것과 요일을 알려 주는 말이에요. 되짚어 확인해요' }),
    end: I('yn', '더 도울 일이 있는지 묻는 말', '없으면 고맙다는 말과 끝인사 → No, that\'s all. Thanks for calling back. Bye!', 'en_no',
      { turn: '전화 끝내기', offer: true, yn: { yes: () => false, noStrict: 'No만 하고 끊으면 퉁명스럽게 들려요. 고맙다는 말과 끝인사를 → No, that\'s all. Thanks for calling back. Bye!' } }),
    repair: I(null, '다시 묻는 말', '', 'rp_again'),
  };
  delete PN.INTENT.need2;
  PN.sayOf = intent => { const it = PN.INTENT[intent]; return it.say || PN.SHAPE[it.shape].say; };
  PN.INTENT_KO = {}; Object.entries(PN.INTENT).forEach(([k, v]) => { PN.INTENT_KO[k] = v.turn || ''; });
  // 대화 전체에서 한 번만 나오는 질문 — 다른 곳에서 미리 답했으면 건너뜀 (메시지 한 줄에 번호를 말하면 ‘가장 좋은 번호’ 질문은 건너뜀)
  PN.CROSS = { nb: 1 };

  /* =========================================================
     상대의 말. key: 열쇠 낱말(말 안에 꼭 있어야 함) · shape: 질문의 모양 · choices: 고르는 질문에서 고를 것(사실 값)
     fast: 너무 빠르거나 끊겨서 못 알아들은 말 · short: 지도에 쓰는 짧은 꼴 · fact: 그 말이 알려 준 사실 · allow: 대답 대신 해도 되는 다시 묻기(틀 id)
     aux: Yes/No 질문의 첫 낱말 짝(is · was · do)
     ========================================================= */
  PN.Q = {};
  const Q = (id, place, intent, en, ko, key, o = {}) => (PN.Q[id] = Object.assign({ id, place, intent, en, ko, key, shape: PN.INTENT[intent].shape, sp: PN.PLACE[place].sp }, o));
  // 첫 번째 전화 — 식당 예약 (내가 먼저)
  Q('bk_help', 'book', 'need', 'Lantern Bistro, this is Ben. How can I help you?', '랜턴 비스트로, 벤입니다. 무엇을 도와드릴까요?', ['How can I help'], { fact: { task: 'book' }, short: 'How can I help you?' });
  Q('bk_fast', 'book', 'need', 'Lantern Bistro, Ben speakin\'. How c\'n I help?', '랜턴 비스트로, 벤인데요, 뭘 도와드릴까요?', ['Lantern Bistro'], { fact: { task: 'book' }, fast: true });
  Q('bk_meal', 'book', 'meal', 'Sure. Is that for lunch or dinner?', '네. 점심인가요, 저녁인가요?', ['lunch or dinner'], { choices: ['lunch', 'dinner'], short: 'Lunch or dinner?' });
  Q('bk_ppl', 'book', 'ppl', 'And how many people will there be?', '몇 분이 오시나요?', ['How many people'], { short: 'How many people?' });
  // 시간 맞추기
  Q('tm_when', 'time', 'when', 'What time would you like?', '몇 시가 좋으세요?', ['What time'], { short: 'What time?' });
  Q('tm_full', 'time', 'full', 'I\'m sorry, we\'re fully booked at 7.', '죄송하지만 7시는 자리가 다 찼어요.', ['fully booked'], { fact: { want: 7 }, short: 'We\'re fully booked at 7.' });
  Q('tm_offer', 'time', 'offer', 'We have a table at 8:15.', '8시 15분에 자리가 있어요.', ['8:15'], { fact: { time: '8:15' }, short: 'We have a table at 8:15.' });
  Q('tm_fast', 'time', 'offer', 'Kay, got a table at eight-fifteen.', '자, 8시 15분 자리 있어요.', ['eight-fifteen'], { fact: { time: '8:15' }, fast: true });
  // 이름 철자
  Q('nm_name', 'name', 'name', 'Great. And what name is the reservation under?', '좋아요. 예약은 어느 분 이름으로 할까요?', ['what name'], { short: 'What name is it under?' });
  Q('nm_spell', 'name', 'spell', 'Could you spell that for me?', '철자를 불러 주시겠어요?', ['spell'], { short: 'Could you spell that?' });
  Q('nm_check', 'name', 'check', 'Was that M as in Mary?', 'Mary의 M이었나요?', ['M as in Mary'], { aux: 'was', fact: { hl: 'M', hok: false }, short: 'Was that M as in Mary?' });
  // 두 번째 전화 — 스포츠 센터 문의 (내가 먼저)
  Q('as_help', 'ask', 'need', 'Kellport Sports Center, Grace speaking. How can I help you?', '켈포트 스포츠 센터, 그레이스입니다. 무엇을 도와드릴까요?', ['How can I help'], { fact: { task: 'ask' }, short: 'How can I help you?' });
  Q('as_level', 'ask', 'level', 'Sure. Is that for the beginner class or the intermediate class?', '네. 초급 반인가요, 중급 반인가요?', ['beginner class or the intermediate class'], { choices: ['beg', 'int'], allow: ['rp_wint'], short: 'Beginner or intermediate?' });
  Q('as_info', 'ask', 'info', 'The beginner class is on Tuesdays and Thursdays from 6 to 7, and it\'s $40 a month.', '초급 반은 화요일과 목요일 6시에서 7시이고, 한 달에 40달러예요.', ['Tuesdays and Thursdays'], { fact: { info: 'beg' }, short: 'Tue · Thu 6–7, $40 a month.' });
  Q('as_fast', 'ask', 'info', 'Beginners\'re Tuesdays \'n Thursdays, six to seven, forty a month.', '초급은 화, 목, 6시에서 7시, 한 달 40.', ['forty a month'], { fact: { info: 'beg' }, fast: true });
  // 메시지 남기기 (수영 사무실로 돌려 줌)
  Q('ms_out', 'msg', 'msg', 'Swim office, Olivia speaking. I\'m afraid Coach Diaz isn\'t in right now. Would you like to leave a message?', '수영 사무실, 올리비아입니다. 죄송하지만 디아스 코치가 지금 자리에 없어요. 메시지를 남기시겠어요?', ['leave a message'], { short: 'Would you like to leave a message?' });
  Q('ms_fast', 'msg', 'msg', 'He\'s out, I\'m \'fraid. D\'you wanna leave a message?', '지금 없어요. 메시지 남길래요?', ['message'], { fast: true });
  Q('ms_go', 'msg', 'go', 'Of course. Go ahead.', '그럼요. 말씀하세요.', ['Go ahead'], { short: 'Go ahead.' });
  // 전화번호 불러 주기
  Q('nb_ask', 'number', 'nb', 'And what\'s the best number to reach you?', '연락드릴 번호는 어떻게 되세요?', ['best number'], { short: 'What\'s the best number?' });
  Q('nb_fast', 'number', 'nb', 'What\'s th\' best number t\' reach ya?', '연락할 번호가 뭐예요?', ['number'], { fast: true });
  Q('nb_check', 'number', 'pcheck', 'Let me read that back. 555-0193. Is that right?', '다시 불러 볼게요. 555-0193. 맞나요?', ['read that back'], { aux: 'is', fact: { heard: '0193', pok: false }, short: '555-0193. Is that right?' });
  // 세 번째 전화 — 코치가 다시 걸어 옴
  Q('cb_hi', 'call', 'answer', 'Hi, this is Matt Diaz from Kellport Sports Center. Is this Jiwoo?', '안녕하세요, 켈포트 스포츠 센터의 맷 디아스예요. 지우 씨인가요?', ['Is this Jiwoo'], { aux: 'is', short: 'Is this Jiwoo?' });
  Q('cb_cut', 'call', 'bring', 'Great! So for the— … you\'ll need— … on Tues—', '좋아요! 그러니까 첫— … 가져와야— … 화요—', ['you\'ll need'], { fact: { bring: 'gog.tue' }, fast: true, cut: true });
  Q('cb_bring', 'call', 'bring', 'You\'ll need to bring a swimsuit and goggles on Tuesday.', '화요일에 수영복과 물안경을 가져오셔야 해요.', ['bring'], { fact: { bring: 'gog.tue' }, short: 'Bring a swimsuit and goggles on Tuesday.' });
  Q('cb_end', 'call', 'end', 'Is there anything else I can help you with?', '더 도와드릴 일이 있을까요?', ['anything else'], { short: 'Anything else?' });
  // 곳마다 대표 말 (영상 01장 지도 · 직접 해 보기)
  PN.PLACEQ = {
    book: ['bk_help', 'bk_meal'], time: ['tm_full', 'tm_offer'], name: ['nm_name', 'nm_check'], ask: ['as_help', 'as_info'],
    msg: ['ms_out', 'ms_go'], number: ['nb_ask', 'nb_check'], call: ['cb_hi', 'cb_bring'],
  };

  /* =========================================================
     칸에 넣는 내 정보 (slot). 틀(frame)이 form으로 어느 꼴을 쓸지 정해요.
     fact: 이 값이 말하는 사실 · bad · why: 콩글리시 값(② 탈락) · note: 통하지만 덧붙일 말 · dyn: 값이 정해져 있지 않은 칸
     ========================================================= */
  const vals = (T, key, f) => Object.fromEntries(Object.entries(T).map(([k, v]) => [k, Object.assign({ t: v.t, ko: v.ko, fact: { [key]: isNaN(+k) ? k : +k } }, f ? f(k, v) : {})]));
  PN.SLOT = {
    day: { key: 'day', vals: vals(PN.DAYS, 'day') },
    meal: { key: 'meal', vals: vals(PN.MEALS, 'meal') },
    ppl: { key: 'ppl', vals: vals(PN.PPL, 'ppl') },
    want: { key: 'want', vals: { 7: { t: '7', ko: '7시', fact: { want: 7 } }, 12: { t: '12', ko: '12시', fact: { want: 12 } } } },
    alt: { key: 'alt', vals: vals(PN.ALTS, 'alt') },
    time: { key: 'time', dyn: 'time' },
    sur: { key: 'sur', vals: vals(PN.NAMES, 'sur', (k, v) => ({ ko: `${v.t}(${v.ko})` })) },
    spell: { key: 'sur', dyn: 'spell' },
    letter: { key: 'letter', dyn: 'letter' },
    topic: { key: 'topic', vals: vals(PN.TOPICS, 'topic') },
    lvl: { key: 'lvl', vals: vals(PN.LEVELS, 'lvl', (k, v) => ({ ko: `${v.ko} 반` })) },
    info: { key: 'info', dyn: 'info' },
    phone: { key: 'phone', dyn: 'phone' },
    bring: { key: 'bring', dyn: 'bring' },
  };
  // 시각 칸: '8:15'
  const timeOk = v => /^\d{1,2}:\d{2}$/.test(String(v));
  // 철자 칸: 'han' (as in까지) · 'han~b' (글자만) · 'han~w' (헷갈리는 글자를 잘못)
  const spellParse = v => { const m = /^(han|park|kim|seo)(~b|~w)?$/.exec(String(v)); if (!m) return null; const n = PN.NAMES[m[1]]; return { id: m[1], trap: m[2] || '', text: m[2] === '~w' ? `${PN.wrongSpell(m[1])}, ${PN.asIn(n.alt)}` : m[2] === '~b' ? n.spell : `${n.spell}, ${PN.asIn(n.L)}` }; };
  PN.spellParse = spellParse;
  // 수업 안내 칸: 'beg' · 'beg~p'(값 teen ↔ ty) · 'beg~d'(다른 반의 요일)
  const infoParse = v => { const m = /^(beg|int)(~p|~d)?$/.exec(String(v)); if (!m) return null; const L = PN.LEVELS[m[1]], D = m[2] === '~d' ? PN.LEVELS[PN.otherLvl(m[1])] : L; return { id: m[1], trap: m[2] || '', days: D.days, dko: D.dko, from: L.from, to: L.to, price: m[2] === '~p' ? PN.teenSwap(L.price) : L.price }; };
  PN.infoParse = infoParse;
  PN.infoText = v => { const o = infoParse(v); return `${o.days} from ${o.from} to ${o.to}, $${o.price} a month`; };
  PN.infoKo = v => { const o = infoParse(v); return `${o.dko} ${o.from}–${o.to}시 · 한 달 ${o.price}달러`; };
  // 준비물 칸: 'gog.tue' (물건.요일)
  const bringParse = v => { const m = /^(gog|cap)\.(mon|tue|wed|thu)$/.exec(String(v)); return m ? { item: m[1], day: m[2] } : null; };
  PN.bringParse = bringParse;
  PN.bringText = v => { const b = bringParse(v); return `${PN.BRINGS[b.item].t} on ${PN.WDAYS[b.day].t}`; };
  PN.bringKo = v => { const b = bringParse(v); return `${PN.WDAYS[b.day].ko}에 ${PN.BRINGS[b.item].ko}`; };
  // 칸 값 하나 (값이 정해져 있지 않은 칸도)
  PN.sv = function (slot, v) {
    const S = PN.SLOT[slot]; if (!S || v == null) return null;
    if (S.dyn === 'time') return timeOk(v) ? { t: String(v), ko: String(v), fact: { time: String(v) } } : null;
    if (S.dyn === 'spell') { const o = spellParse(v); if (!o) return null; const n = PN.NAMES[o.id]; return { t: o.text, ko: o.text, fact: { sur: o.trap === '~w' ? `${o.id}~w` : o.id }, note: o.trap === '~b' ? `헷갈리기 쉬운 글자(${n.L})에 as in을 붙이면 더 확실해요 → ${n.spell}, ${PN.asIn(n.L)}.` : null }; }
    if (S.dyn === 'letter') return PN.AS[v] ? { t: PN.asIn(v), ko: `${PN.AS[v]}의 ${v}`, fact: { letter: String(v) } } : null;
    if (S.dyn === 'info') return infoParse(v) ? { t: PN.infoText(v), ko: PN.infoKo(v), fact: { info: String(v) } } : null;
    if (S.dyn === 'phone') return /^0\d{3}$/.test(String(v)) ? { t: PN.phoneText(v), ko: PN.phoneText(v), fact: { phone: String(v) } } : null;
    if (S.dyn === 'bring') return bringParse(v) ? { t: PN.bringText(v), ko: PN.bringKo(v), fact: { bring: String(v) } } : null;
    return S.vals[v] || null;
  };
  const valFact = (slot, v) => { const x = PN.sv(slot, v); if (!x) return {}; return x.fact ? Object.assign({}, x.fact) : { [PN.SLOT[slot].key]: v }; };
  PN.valFact = valFact;
  // 카드와 맞는 칸 값 (콩글리시 · 알림이 붙는 값은 빼고)
  const slotIds = slot => { const S = PN.SLOT[slot]; return S.dyn ? [] : Object.keys(S.vals).filter(id => { const x = S.vals[id]; return !x.bad && !x.note; }); };
  PN.slotIds = slotIds;
  PN.slotVal = function (slot, C, q) {
    const S = PN.SLOT[slot];
    if (S.dyn === 'spell') return C.sur ? C.sur : null;
    if (S.dyn === 'letter') return C.sur ? PN.NAMES[C.sur].L : null;
    if (S.dyn) { const v = C[S.key]; return v != null ? String(v) : null; }
    const ids = slotIds(slot);
    const fit = id => { const f = valFact(slot, id); return Object.keys(f).length && Object.keys(f).every(k => C[k] === f[k]); };
    return ids.find(fit) || null;
  };

  /* =========================================================
     메시지 한 줄 — 조각: 누구(This is …) · 무슨 일(I'm calling about …) · 부탁(Could you ask him to call me back) · 번호(at 555-0139)
     받는 사람은 메시지를 받아 적어요. 누구인지 먼저 밝히고, 부탁은 질문으로, 번호는 부탁 바로 뒤에 와요. (자주 쓰는 꼴을 단순하게 줄인 규칙)
     누구 · 무슨 일 · 부탁이 빠지면 ② · 번호가 빠지면 통과(받는 사람이 번호를 따로 물어요) · 명령(Tell him …)이면 ③.
     줄 = { words: [조각 id, …], name: '내 이름' }
     ========================================================= */
  PN.OW = {
    this: { c: 'who', t: 'this is', ko: '저는 ___예요(전화에서 나를 밝힘)', who: true },
    here: { c: 'who', t: 'here is', ko: '(어색한 말) 여기는 ___예요', who: true, bad: 'literal', why: '‘여기는 ○○예요’를 Here is로 옮겼어요. Here is는 물건을 건넬 때 쓰는 말이에요(Here is my card.). 전화에서 나를 밝힐 때는 → This is Jiwoo Han.' },
    abeg: { c: 'about', t: 'I\'m calling about the beginner swimming class', v: 'beg', ko: '초급 수영 반 때문에 전화했어요' },
    aint: { c: 'about', t: 'I\'m calling about the intermediate swimming class', v: 'int', ko: '중급 수영 반 때문에 전화했어요' },
    cab: { c: 'ask', t: 'could you ask him to call me back', ko: '다시 전화해 달라고 전해 주시겠어요', q: true },
    tell: { c: 'ask', t: 'tell him to call me back', ko: '(명령) 다시 전화하라고 해요', bad: 'blunt', why: 'Tell him …은 명령처럼 들려요. 다른 사람에게 전해 달라는 부탁도 질문으로 → Could you ask him to call me back?' },
  };
  PN.PHONES.forEach(p => [p, PN.phoneSwap(p)].forEach(x => { PN.OW['p' + x] = { c: 'num', t: `at ${PN.phoneText(x)}`, v: x, ko: `${PN.phoneText(x)}로` }; }));
  Object.entries(PN.OW).forEach(([id, w]) => { w.id = id; });
  PN.OCAT = { who: { ko: '누구', n: 0 }, about: { ko: '무슨 일', n: 1 }, ask: { ko: '부탁', n: 2 }, num: { ko: '번호', n: 3 } };
  // 카드 → 모범 한 줄 (번호까지 말하면 ‘가장 좋은 번호’ 질문은 건너뜀)
  PN.lineWords = C => ['this', 'a' + ((C && C.lvl) || 'beg'), 'cab', 'p' + ((C && C.phone) || '0139')];
  PN.lineFacts = Lw => {
    const W = (Lw.words || Lw).map(w => PN.OW[w]).filter(Boolean), f = { msg: true };
    const wa = W.find(x => x.c === 'about'), wn = W.find(x => x.c === 'num');
    if (wa) f.lvl = wa.v;
    if (wn) f.phone = wn.v;
    return f;
  };
  PN.checkLine = function (Lw, C = {}) {
    const ws = Lw.words || Lw, W = ws.map(w => PN.OW[w]);
    if (!ws.length) return { ok: false, stage: 1, why: '아직 아무것도 고르지 않았어요.' };
    if (W.some(x => !x)) return { ok: false, stage: 2, why: '사전에 없는 조각이 있어요.' };
    const want = PN.lineWords(C), wt = PN.lineText({ words: want, name: Lw.name || PN.fullName(C) });
    const n = c => W.filter(x => x.c === c).length;
    const pt = PN.phoneText(C.phone || '0139');
    for (const c of Object.keys(PN.OCAT)) if (n(c) > 1) return { ok: false, stage: 2, why: `${eun(PN.OCAT[c].ko)} 한 번만 말해요.`, want, tag: 'order' };
    const iw = W.findIndex(x => x.c === 'who'), ib = W.findIndex(x => x.c === 'about'), ia = W.findIndex(x => x.c === 'ask'), inum = W.findIndex(x => x.c === 'num');
    if (ia < 0 && ib < 0 && iw >= 0) return { ok: false, stage: 2, why: `누구인지만 말했어요. 무슨 일로 전화했는지와 바라는 것을 덧붙여요 → ${wt}`, want, tag: 'need', missing: ['about', 'ask'] };
    if (inum >= 0 && ia < 0) return { ok: false, stage: 2, why: `번호만 툭 말하면 무엇을 해 달라는지 알 수 없어요. 부탁 바로 뒤에 번호를 → Could you ask him to call me back at ${pt}?`, want, tag: 'order', missing: ['ask'] };
    if (inum >= 0 && inum !== ia + 1) return { ok: false, stage: 2, why: `번호는 부탁 바로 뒤에 와요 → Could you ask him to call me back at ${pt}?`, want, tag: 'order' };
    const lit = W.find(x => x.bad === 'literal');
    if (lit) return { ok: false, stage: 2, why: lit.why, want, tag: 'literal', badW: lit };
    if (iw < 0) return { ok: false, stage: 2, why: `누구인지가 빠졌어요. 메시지를 받은 사람이 누구에게 전화해야 할지 몰라요. 먼저 나를 밝혀요 → ${wt}`, want, tag: 'need', missing: ['who'] };
    if (ib < 0) return { ok: false, stage: 2, why: `무슨 일로 전화했는지가 빠졌어요. 코치가 무엇 때문인지 알 수 있게 → I'm calling about the ${PN.LEVELS[C.lvl || 'beg'].t} swimming class.`, want, tag: 'need', missing: ['about'] };
    if (ia < 0) return { ok: false, stage: 2, why: '무엇을 바라는지가 빠졌어요. 다시 전화해 달라는 부탁을 질문으로 → Could you ask him to call me back?', want, tag: 'need', missing: ['ask'] };
    const wb = W[ib];
    if (C.lvl && wb.v !== C.lvl) return { ok: false, stage: 2, why: `카드와 달라요(반). 카드: ${PN.LEVELS[C.lvl].ko} 반 · 이 대답: ${PN.LEVELS[wb.v].ko} 반.`, want, tag: 'fact', err: { type: 'lvl', word: wb, right: 'a' + C.lvl } };
    if (inum >= 0 && C.phone && W[inum].v !== C.phone) return { ok: false, stage: 2, why: `카드와 달라요(전화번호). 카드: ${PN.phoneText(C.phone)} · 이 대답: ${PN.phoneText(W[inum].v)}. 끝 두 자리를 바꿔 읽기 쉬워요.`, want, tag: 'fact', err: { type: 'phone', word: W[inum], right: 'p' + C.phone } };
    const blunt = W.find(x => x.bad === 'blunt');
    if (blunt) return { ok: false, stage: 3, why: blunt.why, want, tag: 'blunt', badW: blunt };
    const late = iw > 0, nonum = inum < 0;
    return { ok: true, why: `${W.map(x => PN.OCAT[x.c].ko).join(' → ')}. 나를 밝히고, 무슨 일인지 말하고, 부탁은 질문으로 했어요.` + (late ? ' 전화에서는 누구인지를 맨 먼저 밝히면 더 알아듣기 쉬워요.' : '') + (nonum ? ' 번호를 함께 말하면 받는 사람이 따로 묻지 않아도 돼요.' : ''), want, note: late ? 'late' : nonum ? 'nonum' : '' };
  };
  // 받는 사람의 대답 (틀린 첫 조각만 묻거나 고쳐 줌) · 맞으면 받아 적음
  PN.fixLine = function (Lw, C) {
    C = C || {};
    const o = PN.checkLine(Lw, C), f = PN.lineFacts(Lw);
    if (o.ok) return f.phone ? { en: 'Got it. I\'ll make sure he gets the message.', ko: '알겠어요. 꼭 전해 드릴게요.' } : { en: 'Got it. I\'ll pass that on.', ko: '알겠어요. 전해 드릴게요.' };
    if (o.tag === 'literal' && o.badW && o.badW.id === 'here') return { en: 'Sorry — who\'s calling, please?', ko: '전화에서 나를 밝힐 때는 This is …' };
    if (o.tag === 'need' && o.missing && o.missing.includes('who')) return { en: 'Sure. And may I ask who\'s calling?', ko: '누구인지 먼저 밝혀요.' };
    if (o.tag === 'need' && o.missing && o.missing.includes('about')) return { en: 'Okay… and what is it regarding?', ko: '무슨 일로 전화했는지 말해요.' };
    if (o.tag === 'need') return { en: 'Okay… and what would you like me to tell him?', ko: '무엇을 바라는지 질문으로 말해요.' };
    if (o.tag === 'fact') return { en: 'Hmm, is that right?', ko: o.err && o.err.type === 'phone' ? '카드의 전화번호를 다시 보세요.' : '카드의 반을 다시 보세요.' };
    if (o.tag === 'blunt') return { en: '… Right. I\'ll let him know.', ko: '뜻은 통했지만 명령처럼 들려요.' };
    return { en: 'Sorry, could you say that again?', ko: '차례가 뒤섞여 알아듣기 어려워요.' };
  };
  // 조각 → 문장: 누구는 한 문장(This is + 이름), 무슨 일은 한 문장, 부탁 + 번호는 한 문장(질문이면 ?)
  function lineSegs(Lw) {
    const W = (Lw.words || Lw).map(w => PN.OW[w]).filter(Boolean), name = Lw.name || 'Jiwoo Han', SS = [];
    W.forEach(x => {
      const last = SS[SS.length - 1];
      if (x.c === 'num' && last && last.body.length && last.body[last.body.length - 1].c === 'ask') last.body.push(x);
      else SS.push({ body: [x] });
    });
    const out = [];
    SS.forEach((s, k) => {
      if (k) out.push({ t: ' ', r: 'frame' });
      const seg = [];
      s.body.forEach((x, j) => {
        if (j) seg.push({ t: ' ', r: 'frame' });
        if (x.who) { seg.push({ t: x.t, r: x.bad ? 'trap' : 'frame', part: 'who', id: x.id }); seg.push({ t: ' ' + name, r: 'slot', part: 'who', id: x.id }); }
        else seg.push({ t: x.t, r: x.bad ? 'trap' : x.c === 'ask' ? 'pol' : 'slot', part: x.c, id: x.id });
      });
      seg.push({ t: s.body.some(x => x.q) ? '?' : '.', r: 'frame' });
      const f = seg[0]; if (f) f.t = f.t[0].toUpperCase() + f.t.slice(1);
      out.push(...seg);
    });
    return out;
  }
  PN.lineSegs = lineSegs;
  PN.lineText = Lw => lineSegs(Lw).map(s => s.t).join('');
  // 해석: 같은 차례로
  PN.lineKo = function (Lw) {
    const W = (Lw.words || Lw).map(w => PN.OW[w]).filter(Boolean), out = [], nm = Lw.name || 'Jiwoo Han';
    let i = 0;
    while (i < W.length) {
      const x = W[i];
      if (x.who) { out.push(x.ko.replace('___예요', ieyo(nm)).replace('(전화에서 나를 밝힘)', '') + '.'); i++; continue; }
      if (x.c === 'ask' && W[i + 1] && W[i + 1].c === 'num') { out.push(`${W[i + 1].ko} ${x.ko}${x.q ? '?' : '.'}`); i += 2; continue; }
      out.push(x.ko + (x.q ? '?' : '.')); i++;
    }
    return out.join(' ');
  };
  /* =========================================================
     대답 틀 (frame). t: 틀 글 — ___ = 내 정보 칸, {…} = 공손한 말
     tag: ok · literal(한국어 그대로 · 콩글리시) · wrong(틀린 문장) · blunt(명령 · 퉁명스러운 말) · plain(고맙다는 말 없이 끊김)
     bare: Yes · No만 하는 대답(yes: true · false) · aux: 짧은 대답의 짝(is · was · do)
     half: 사실만 말하고 용건 · 정보가 빠진 말 · check: 들은 값을 되짚어 확인하는 말 · skip: 되짚지 않고 넘어가는 말
     ========================================================= */
  PN.FRAME = {};
  const FR = (id, intent, t, ko, o = {}) => (PN.FRAME[id] = Object.assign({ id, intent, t, ko, tag: 'ok' }, o));
  // Yes · No만 하는 대답 (고르는 질문 · 정보 질문 · 안내에는 ① 탈락)
  FR('g_yes', 'yn', 'Yes.', '네.', { bare: true, yes: true });
  FR('g_yesp', 'yn', 'Yes, {please}.', '네, 그렇게 해 주세요.', { bare: true, yes: true });
  FR('g_no', 'yn', 'No.', '아니요.', { bare: true, yes: false });
  // 첫 번째 전화 — 식당 예약 (내가 먼저): 부탁 틀 + 날짜
  FR('nd_book', 'need', 'Hi, I\'d like to make a reservation for ___, {please}.', '안녕하세요, ___ 예약을 하고 싶어요.', { slot: 'day', fact: { task: 'book' } });
  FR('nd_rsv', 'need', 'Hi, I want to reserve ___.', '(어색한 말) 안녕하세요, ___을 예약하고 싶어요.', { slot: 'day', fact: { task: 'book' }, tag: 'literal', why: '‘금요일을 예약하다’를 reserve Friday로 옮겼어요. reserve 뒤에는 잡아 둘 것(a table)이 와요. 날짜만 놓으면 그날을 통째로 빌리는 말처럼 들려요 → Hi, I\'d like to make a reservation for Friday, please.' });
  FR('nd_bhalf', 'need', 'Hi, I\'m calling about ___.', '안녕하세요, ___ 일로 전화했어요.', { slot: 'day', fact: { task: 'book' }, half: true, why: '그날 무엇을 하고 싶은지(용건)가 빠졌어요. 얼굴이 안 보이는 전화에서는 첫마디에 용건을 말해요 → Hi, I\'d like to make a reservation for Friday, please.' });
  FR('nd_bblunt', 'need', 'Give me a table for ___.', '(명령) ___에 자리 하나 줘요.', { slot: 'day', fact: { task: 'book' }, tag: 'blunt', why: '명령처럼 들려요. 전화 첫마디의 용건은 부탁 틀로 → Hi, I\'d like to make a reservation for Friday, please.' });
  FR('ml_pl', 'meal', '___, {please}.', '___으로 할게요.', { slot: 'meal' });
  FR('pp_for', 'ppl', 'For ___, {please}.', '___이요.', { slot: 'ppl' });
  FR('pp_lit', 'ppl', 'We are ___.', '(어색한 말) 우리는 ___이에요.', { slot: 'ppl', tag: 'literal', why: '‘우리는 ○명이에요’를 We are …로 옮겼어요. 영어로는 사람 수를 이렇게 말하지 않아요 → For + 사람 수, please. (For four, please. · There will be four of us.)' });
  // 시간 맞추기: 시각 · 다른 시간 묻기 · 들은 시각 되짚기
  FR('wn_at', 'when', 'At ___, {please}.', '___으로 해 주세요.', { slot: 'want' });
  FR('fl_alt', 'full', 'Oh, I see. {Do you have} anything ___?', '아, 그렇군요. ___ 있나요?', { slot: 'alt' });
  FR('tm_ok', 'full', 'Oh, okay.', '아, 알겠어요.', { skip: true, why: '알겠다고만 하면 예약을 못 하고 전화가 끝나요. 다른 시간이 있는지 질문으로 물어요 → Oh, I see. Do you have anything later?' });
  FR('tm_lit', 'full', 'Then what time is possible?', '(어색한 말) 그럼 몇 시가 가능해요?', { tag: 'literal', why: '‘가능한 시간’을 possible로 옮겼어요. 자리가 비었는지는 available이나 Do you have …?로 물어요 → Oh, I see. Do you have anything later?' });
  FR('of_so', 'offer', 'So, ___?', '그러니까 ___이죠?', { slot: 'time', check: true });
  FR('of_ok', 'offer', 'Okay. {Thanks}.', '알겠어요. 고마워요.', { skip: true, why: '고맙다고만 하면 시각을 제대로 들었는지 확인하지 못해요. fifTEEN과 FIFty는 전화에서 특히 헷갈려요. 시각은 되짚어요 → So, 8:15?' });
  // 이름 철자: 이름 · 철자(as in) · 상대가 되짚은 철자 바로잡기
  FR('nm_is', 'name', 'It\'s ___.', '___이에요.', { slot: 'sur' });
  FR('nm_lit', 'name', 'Name is ___.', '(어색한 말) 이름은 ___이에요.', { slot: 'sur', tag: 'literal', why: '‘이름은 ○○예요’를 Name is로 옮겼어요. 영어 문장은 이름씨 앞에 짝(the · my)이 필요하고, 전화 예약에서는 더 짧게 말해요 → It\'s Han.' });
  FR('sp_it', 'spell', 'Sure. It\'s ___.', '네. ___이에요.', { slot: 'spell' });
  FR('sp_name', 'spell', 'It\'s ___.', '___이에요.', { slot: 'sur', half: true, why: '이름을 한 번 더 말했을 뿐 철자를 부르지 않았어요. 글자를 하나씩, 헷갈리는 글자에는 as in을 붙여요 → Sure. It\'s H-A-N, N as in Nancy.' });
  FR('ck_yes', 'check', 'Yes, that\'s right.', '네, 맞아요.', { fact: { hok: true } });
  FR('ck_no', 'check', 'No, ___.', '아니요, ___이에요.', { slot: 'letter', fact: { hok: false } });
  FR('ck_wasnt', 'check', 'No, it wasn\'t. ___.', '아니요. ___이에요.', { slot: 'letter', aux: 'was', fact: { hok: false } });
  FR('ck_isnt', 'check', 'No, it isn\'t. ___.', '아니요. ___이에요.', { slot: 'letter', aux: 'is', fact: { hok: false } });
  // 두 번째 전화 — 스포츠 센터 문의 (내가 먼저)
  FR('nd_ask', 'need', 'Hi, I\'m calling to ask about your ___.', '안녕하세요, ___에 대해 물어보려고 전화했어요.', { slot: 'topic', fact: { task: 'ask' } });
  FR('nd_qhalf', 'need', 'Hi, I have a question.', '안녕하세요, 물어볼 게 있어요.', { fact: { task: 'ask' }, half: true, why: '물어볼 것이 있다는 말만 했어요. 무엇을 묻는지(용건)를 첫마디에 → Hi, I\'m calling to ask about your swimming lessons.' });
  FR('nd_tell', 'need', 'Tell me about your ___.', '(명령) ___에 대해 말해 줘요.', { slot: 'topic', fact: { task: 'ask' }, tag: 'blunt', why: '명령처럼 들려요. 묻는 용건은 → Hi, I\'m calling to ask about your swimming lessons.' });
  FR('nd_inq', 'need', 'I want to inquiry ___.', '(어색한 말) ___을 문의하고 싶어요.', { slot: 'topic', fact: { task: 'ask' }, tag: 'literal', why: '‘문의하다’를 inquiry로 옮겼어요. inquiry는 이름씨(명사)라 want to 뒤에 올 수 없어요. 전화로 묻는 용건은 → Hi, I\'m calling to ask about your swimming lessons.' });
  FR('lv_pl', 'level', 'The ___ class, {please}.', '___으로 할게요.', { slot: 'lvl' });
  FR('in_so', 'info', 'So, ___?', '그러니까 ___이죠?', { slot: 'info', check: true });
  FR('in_ok', 'info', 'Okay. {Thanks}.', '알겠어요. 고마워요.', { skip: true, why: '고맙다고만 하면 요일 · 시간 · 값을 제대로 들었는지 확인하지 못해요. forty와 fourteen은 헷갈리기 쉬워요 → So, Tuesdays and Thursdays from 6 to 7, $40 a month?' });
  // 메시지 남기기: 남기겠다는 대답 · 메시지 한 줄
  FR('line', ['msg', 'go'], '', '', { line: true });   // 메시지 한 줄 (PN.checkLine)
  FR('ms_no', 'msg', 'No, {thanks}. I\'ll call back later.', '아니요, 괜찮아요. 나중에 다시 걸게요.', { fact: { msg: false } });
  FR('ms_lit', 'msg', 'Yes. Please leave a message.', '(어색한 말) 네. 메시지를 남겨 주세요.', { fact: { msg: true }, tag: 'literal', why: '‘메시지 남길게요’를 Please leave a message로 옮기면 상대에게 메시지를 남기라는 말이 돼요(자동 응답기가 하는 말). 내가 남기겠다는 대답은 → Yes, please. (바로 메시지를 말해도 돼요.)' });
  // 전화번호: 번호 · 상대가 되짚은 번호 바로잡기
  FR('nb_is', 'nb', 'It\'s ___.', '___이에요.', { slot: 'phone' });
  FR('nb_hp', 'nb', 'My handphone number is ___.', '(콩글리시) 제 핸드폰 번호는 ___이에요.', { slot: 'phone', tag: 'literal', why: '‘핸드폰’은 한국에서 만든 말이에요. 영어로는 cell phone(미국) · mobile(영국)이고, 번호만 짧게 말해도 돼요 → It\'s + 번호. (It\'s 555-0139.)' });
  FR('nc_yes', 'pcheck', 'Yes, that\'s right.', '네, 맞아요.', { fact: { pok: true } });
  FR('nc_no', 'pcheck', 'No, it isn\'t. It\'s ___.', '아니요. ___이에요.', { slot: 'phone', aux: 'is', fact: { pok: false } });
  FR('nc_wasnt', 'pcheck', 'No, it wasn\'t. It\'s ___.', '아니요. ___이에요.', { slot: 'phone', aux: 'was', fact: { pok: false } });
  // 세 번째 전화 — 걸려 온 전화 받기 · 준비물 되짚기 · 끝인사
  FR('cb_sp', 'answer', 'Yes, speaking.', '네, 전데요.', {});
  FR('cb_is', 'answer', 'Yes, it is.', '네, 맞아요.', { aux: 'is' });
  FR('cb_who', 'answer', 'Who are you?', '(퉁명스러운 말) 누구세요?', { tag: 'blunt', why: '누군지 다짜고짜 물으면 퉁명스럽게 들려요. 상대가 이미 이름을 밝혔고, 나를 찾는 전화가 맞으면 → Yes, speaking. (누군지 모를 때는 May I ask who\'s calling?)' });
  FR('br_so', 'bring', 'So, ___?', '그러니까 ___이죠?', { slot: 'bring', check: true });
  FR('br_ok', 'bring', 'Okay. {Thanks}.', '알겠어요. 고마워요.', { skip: true, why: '고맙다고만 하면 준비물과 요일을 제대로 들었는지 확인하지 못해요. 첫 수업 요일은 되짚어요 → So, a swimsuit and goggles on Tuesday?' });
  FR('en_no', 'end', 'No, that\'s all. {Thanks} for calling back. {Bye}!', '아니요, 그게 다예요. 다시 전화 주셔서 고마워요. 안녕히 계세요!', {});
  FR('en_plain', 'end', 'Okay. Bye.', '네. 끊을게요.', { tag: 'plain', why: '고맙다는 말 없이 끊으면 퉁명스럽게 들려요. 다시 전화해 준 사람에게는 → No, that\'s all. Thanks for calling back. Bye!' });
  // 다시 묻기. echo: 들린 만큼 되묻는 말 — 실제로 들은 말이어야 통과 · what: 모르는 낱말 묻기(allow)
  FR('rp_again', 'repair', '{Sorry? Could you} say that again, {please}?', '죄송한데, 다시 한 번 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_sorry', 'repair', '{Sorry}?', '네? (다시 말해 달라는 뜻)', { kind: 'again' });
  FR('rp_slow', 'repair', '{Could you} say that more slowly, {please}?', '조금 더 천천히 말씀해 주시겠어요?', { kind: 'slow' });
  FR('rp_break', 'repair', '{Sorry}, you\'re breaking up. {Could you} say that again?', '죄송한데, 소리가 끊겨요. 다시 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_place', 'repair', '{Sorry}, is this Lantern Bistro?', '죄송한데, 랜턴 비스트로인가요?', { kind: 'echo', echo: 'need' });
  FR('rp_time', 'repair', '{Sorry}, what time was that?', '죄송한데, 몇 시라고 하셨어요?', { kind: 'echo', echo: 'offer' });
  FR('rp_info', 'repair', '{Sorry}, when is the class, and how much is it?', '죄송한데, 수업이 언제이고 얼마예요?', { kind: 'echo', echo: 'info' });
  FR('rp_msg', 'repair', '{Sorry}, did you ask if I\'d like to leave a message?', '죄송한데, 메시지를 남기겠느냐고 물으셨어요?', { kind: 'echo', echo: 'msg' });
  FR('rp_nb', 'repair', '{Sorry}, did you ask for my phone number?', '죄송한데, 제 전화번호를 물으셨어요?', { kind: 'echo', echo: 'nb' });
  FR('rp_bring', 'repair', '{Sorry}, what do I need to bring?', '죄송한데, 무엇을 가져가야 해요?', { kind: 'echo', echo: 'bring' });
  FR('rp_wint', 'repair', '{Sorry}, what does intermediate mean?', '죄송한데, intermediate가 무슨 뜻이에요?', { kind: 'what' });
  FR('rp_rude', 'repair', 'What?', '(퉁명스러운 말) 뭐라고요?', { kind: 'again', tag: 'blunt', why: 'What? 한 낱말은 퉁명스럽게 들릴 수 있어요. 못 알아들었으면 → Sorry? Could you say that again, please?' });

  /* ---------- 대답 글 만들기: 조각(segs) = [{ t, r: 'frame' | 'slot' | 'pol' }] ---------- */
  const slotText = (F, v) => { const x = PN.sv(F.slot, v); if (!x) return '___'; return x[F.form || 't'] != null ? x[F.form || 't'] : x.t; };
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
  PN.segs = function (a) {
    const F = PN.FRAME[a.f];
    if (F.line) return lineSegs(a.line);
    return frameSegs(F, a.v);
  };
  PN.text = a => PN.segs(a).map(s => s.t).join('');
  // 해석
  const koOf = (F, v) => {
    if (!F.slot) return F.ko;
    const x = PN.sv(F.slot, v), k = x ? x.ko : '___';
    return F.ko.replace('___으로', ro(k)).replace('___이에요', ieyo(k)).replace('___이요', /요$/.test(k) ? k : k + (has(k) ? '이요' : '요')).replace('___이죠', k + (has(k) ? '이죠' : '죠')).replace('___을', eul(k)).replace('___이 ', ig(k) + ' ').replace('___', k);
  };
  PN.ko = function (a) {
    const F = PN.FRAME[a.f];
    if (F.line) return PN.lineKo(a.line);
    return koOf(F, a.v);
  };
  // 대답이 말하는 사실
  PN.factOf = function (a) {
    const F = PN.FRAME[a.f];
    if (F.line) return PN.lineFacts(a.line);
    const f = Object.assign({}, F.fact || {});
    if (F.slot && PN.sv(F.slot, a.v)) Object.assign(f, valFact(F.slot, a.v));
    return f;
  };
  // 사실을 한국어로
  const TASK = { book: '식당 예약', ask: '수영 강습 문의' };
  PN.factKo = function (k, v) {
    if (k === 'task') return TASK[v] || String(v);
    if (k === 'day') return PN.DAYS[v] ? PN.DAYS[v].ko : String(v);
    if (k === 'meal') return PN.MEALS[v] ? PN.MEALS[v].ko : String(v);
    if (k === 'ppl') return PN.PPL[v] ? PN.PPL[v].ko : `${v}명`;
    if (k === 'want') return `${v}시`;
    if (k === 'alt') return PN.ALTS[v] ? PN.ALTS[v].ko : String(v);
    if (k === 'time') return `${v} (${PN.timeWords(v)})`;
    if (k === 'sur') { const m = /^(\w+)(~w)?$/.exec(String(v)); return m && PN.NAMES[m[1]] ? (m[2] ? `${PN.wrongSpell(m[1])} (${PN.asIn(PN.NAMES[m[1]].alt)})` : `${PN.NAMES[m[1]].t} (${PN.NAMES[m[1]].spell})`) : String(v); }
    if (k === 'letter') return PN.AS[v] ? PN.asIn(v) : String(v);
    if (k === 'hok') return v ? '상대가 철자를 맞게 되짚음' : '상대가 철자를 잘못 되짚음';
    if (k === 'topic') return PN.TOPICS[v] ? PN.TOPICS[v].ko : String(v);
    if (k === 'lvl') return PN.LEVELS[v] ? `${PN.LEVELS[v].ko} 반` : String(v);
    if (k === 'info') return PN.infoParse(v) ? PN.infoKo(v) : String(v);
    if (k === 'msg') return v ? '메시지를 남김' : '메시지를 안 남김';
    if (k === 'phone') return PN.phoneText(v);
    if (k === 'pok') return v ? '상대가 번호를 맞게 되짚음' : '상대가 번호를 잘못 되짚음';
    if (k === 'bring') return PN.bringParse(v) ? PN.bringKo(v) : String(v);
    const S = Object.values(PN.SLOT).find(s => s.key === k && s.vals && s.vals[v]);
    return S ? S.vals[v].ko : String(v);
  };

  /* ---------- 이미 답한 질문 (시뮬레이터의 상대가 건너뜀)
     이름에 철자까지 말하면 ‘철자’ 질문 · 메시지 한 줄을 바로 말하면 ‘말씀하세요’ · 번호까지 말하면 ‘가장 좋은 번호’ 질문 ---------- */
  PN.coveredBy = (facts, intent) => {
    const out = intent ? [intent] : [];
    if (intent === 'name' && facts.spelled) out.push('spell');
    if (intent === 'msg' && facts.lvl) out.push('go');
    if ((intent === 'msg' || intent === 'go') && facts.phone) out.push('nb');
    return out;
  };
  PN.covered = (a, q) => { if (typeof q === 'string') q = PN.Q[q]; return PN.coveredBy(PN.factOf(a), q.intent); };
  PN.coveredKo = cov => cov.map(x => ({ spell: '철자', go: '메시지 말하기', nb: '전화번호' })[x]).filter(Boolean);

  /* =========================================================
     판정 — PN.judge(상대의 말, 대답, 카드, 출처)
     q: PN.Q의 말(또는 id) · a: { f: 틀 id, v: 칸 값, line } · card: 사실 · src: '카드' | '상황'
     ========================================================= */
  const res = (ok, stage, why, tag) => ({ ok, stage, why, tag: tag || (ok ? 'ok' : '') });
  const shapeHead = q => `${q.key.join(' … ')} → ${PN.SHAPE[q.shape].ko}`;
  // 상황(카드 + 상대의 말)에서 바로 알 수 있는 사실을 채워요: 내 이름의 헷갈리는 글자
  const fill = C => { if (C.sur && C.letter == null && PN.NAMES[C.sur]) C.letter = PN.NAMES[C.sur].L; return C; };
  PN.ctx = (card, q) => fill(Object.assign({}, card || {}, (q && q.fact) || {}));
  // 되짚은 값이 다를 때 덧붙이는 말
  const checkHint = (k, v, w) => {
    if (k === 'time') return ' 분의 -teen과 -ty는 헷갈리기 쉬워요. 뒤가 세면 fifTEEN, 앞이 세면 FIFty.';
    if (k === 'info') { const a = PN.infoParse(v), b = PN.infoParse(w); if (a && b && a.price !== b.price) return ' 값의 -teen과 -ty는 헷갈리기 쉬워요(fourTEEN ↔ FORty).'; return ' 요일은 묶음으로 들어요(Tuesdays and Thursdays = 화 · 목).'; }
    if (k === 'bring') { const a = PN.bringParse(v), b = PN.bringParse(w); if (a && b && a.day !== b.day) return ' 첫 수업 요일을 되짚어요(같은 반의 다른 요일과 헷갈리기 쉬워요).'; return ' 준비물은 하나하나 되짚어요.'; }
    return '';
  };
  // 상대가 잘못 되짚었는데 Yes라고 하거나, 맞게 되짚었는데 아니라고 할 때
  const heardWhy = (k, C) => {
    if (k === 'hok') { const n = PN.NAMES[C.sur] || PN.NAMES.han; return C.hok ? `상대가 맞게 되짚었어요(${PN.asIn(n.L)}). 맞으면 → Yes, that's right.` : `상대가 잘못 들었어요(${PN.asIn(C.hl || n.alt)}). 내 이름의 글자는 ${PN.asIn(n.L)}예요. Yes라고 하면 틀린 철자로 적혀요 → No, ${PN.asIn(n.L)}.`; }
    if (k === 'pok') return C.pok ? `상대가 맞게 되짚었어요(${PN.phoneText(C.phone)}). 맞으면 → Yes, that's right.` : `상대가 잘못 들었어요(${PN.phoneText(C.heard || PN.phoneSwap(C.phone))}). 내 번호는 ${PN.phoneText(C.phone)}예요. Yes라고 하면 코치가 다른 번호로 전화해요 → No, it isn't. It's ${PN.phoneText(C.phone)}.`;
    return '';
  };
  PN.judge = function (q, a, card, src = '카드') {
    if (typeof q === 'string') q = PN.Q[q];
    const F = PN.FRAME[a.f], C = PN.ctx(card, q);
    const fi = [].concat(F.intent), key = q.key.join(' … '), In = PN.INTENT[q.intent], SHp = PN.SHAPE[q.shape];
    let allowed = false;
    const notes = [];
    // ① 열쇠 낱말 + 질문의 모양 잡기
    if (q.fast) {
      const lost = q.cut ? '소리가 끊겨서' : '너무 빨라서';
      if (F.intent !== 'repair') return res(false, 1, `${lost} 열쇠 낱말을 못 잡았어요. 무엇을 말했는지 모르는데 짐작해서 답하면 엉뚱한 대답이 될 수 있어요. 먼저 다시 물어요.`, 'guess');
      if (F.kind === 'echo' && F.echo !== q.intent) return res(false, 1, `되물은 말이 달라요. 들린 낱말(${key})로 보면 상대는 ${In.turn}에 대해 말했어요.`, 'intent');
      if (F.kind === 'what') return res(false, 1, '모르는 낱말을 묻는 말이에요. 무엇을 말했는지 못 알아들었으면 다시 말해 달라고 해요.', 'intent');
    } else if (F.bare) {
      if (q.shape === 'or') return res(false, 1, `${shapeHead(q)}. 둘 가운데 하나를 고르라는 말이라 ${F.yes ? 'Yes' : 'No'}만으로는 무엇을 골랐는지 알 수 없어요 → ${In.want}`, 'shape');
      if (q.shape === 'wh') return res(false, 1, `${shapeHead(q)}. 정보를 묻는 말이라 ${F.yes ? 'Yes' : 'No'}로는 답이 안 돼요 → ${In.want}`, 'shape');
      if (q.shape === 'note') return res(false, 1, `열쇠 낱말 ${key} → ${PN.sayOf(q.intent)}. 묻는 말이 아니라서 ${F.yes ? 'Yes' : 'No'}로 답할 일이 아니에요 → ${In.want}`, 'shape');
    } else if (!fi.includes(q.intent)) {
      if (F.intent === 'repair' && q.allow && q.allow.includes(F.id)) allowed = true;
      else if (F.intent === 'repair') return res(false, 1, '대답이 아니라 다시 묻는 말이에요. 알아들었다면 바로 답해요.', 'intent');
      else {
        const other = PN.INTENT[fi[0]];
        return res(false, 1, `${shapeHead(q)}${q.shape === 'note' ? '' : `(${SHp.ans})`}. 이 대답은 ${other.ans}에 맞는 말이에요.`, 'intent');
      }
    }
    // 고르는 질문: 상대가 말한 것 가운데 골랐나
    const fact = PN.factOf(a);
    if (q.shape === 'or' && q.choices && !F.bare && F.intent !== 'repair' && In.key) {
      const v = fact[In.key];
      if (v != null && !q.choices.includes(v)) return res(false, 1, `${shapeHead(q)}. 상대가 말한 것(${q.choices.map(c => PN.factKo(In.key, c)).join(' · ')}) 가운데 하나를 골라요. ${eun(PN.factKo(In.key, v))} 묻지 않았어요.`, 'choice');
    }
    if (F.line) { const o = PN.checkLine(a.line, C); if (!o.ok && o.stage === 1) return res(false, 1, o.why, 'intent'); }
    // ② 틀에 내 정보 넣기
    if (F.tag === 'literal' || F.tag === 'wrong') return res(false, 2, F.why, F.tag);
    if (F.aux && q.aux && F.aux !== q.aux) return res(false, 2, `${PN.AUX[q.aux].q} 질문에는 첫 낱말의 짝으로 답해요 → ${PN.AUX[q.aux].a} 이 대답(${PN.text(a)})은 ${PN.AUX[F.aux].q} 질문의 짝이에요.`, 'wrong');
    const sv = F.slot ? PN.sv(F.slot, a.v) : null;
    if (F.slot && !sv) return res(false, 2, '칸이 비었어요.', 'fact');
    if (sv && sv.bad) return res(false, 2, sv.why, sv.bad);
    if (F.bare) {
      const Y = In.yn, want = Y && Y.yes ? Y.yes(C) : null;
      if (want != null && want !== F.yes) {
        if (q.intent === 'check') return res(false, 2, heardWhy('hok', C), 'fact');
        if (q.intent === 'pcheck') return res(false, 2, heardWhy('pok', C), 'fact');
        if (q.intent === 'answer') return res(false, 2, `상대가 찾는 사람이 바로 나예요(${src}). → Yes, speaking.`, 'fact');
        if (q.intent === 'end') return res(false, 2, `더 물어볼 것은 없어요(${src}). 고맙다는 말과 끝인사로 → No, that's all. Thanks for calling back. Bye!`, 'fact');
        return res(false, 2, `${wa(src)} 달라요. ${src}: ${F.yes ? 'No' : 'Yes'} 쪽이에요(${In.turn}). 이 대답: ${F.yes ? 'Yes' : 'No'}.`, 'fact');
      }
      if (F.yes && Y && Y.strict) return res(false, 2, Y.strict, 'need');
      if (!F.yes && Y && Y.noStrict) return res(false, 2, Y.noStrict, 'need');
      if (Y && Y.need && F.yes === !!(Y.yes && Y.yes(C))) notes.push(Y.need);
      if (q.aux) notes.push(`짝 맞는 짧은 대답도 좋아요 → ${PN.AUX[q.aux].a}`);
    }
    if (F.line) { const o = PN.checkLine(a.line, C); if (!o.ok && o.stage !== 3) return res(false, 2, o.why, o.tag || 'order'); }
    if (F.check) {
      for (const k of Object.keys(fact)) if (C[k] != null && fact[k] !== C[k]) return res(false, 2, `들은 값과 달라요. 상대: ${PN.factKo(k, C[k])} · 이 대답: ${PN.factKo(k, fact[k])}.` + checkHint(k, C[k], fact[k]), 'fact');
    } else {
      for (const k of Object.keys(fact)) {
        if (C[k] === undefined || C[k] === fact[k]) continue;
        if (k === 'hok' || k === 'pok') return res(false, 2, heardWhy(k, C), 'fact');
        if (k === 'letter') return res(false, 2, `내 이름의 글자가 아니에요. 내 이름: ${PN.factKo('sur', C.sur)} → ${PN.asIn(C[k])} · 이 대답: ${PN.asIn(fact[k])}.`, 'fact');
        if (k === 'sur' && /~w$/.test(fact[k])) return res(false, 2, `헷갈리는 글자를 바꿔 불렀어요. 내 이름: ${PN.factKo('sur', C.sur)}, ${PN.asIn(PN.NAMES[C.sur].L)} · 이 대답: ${PN.factKo('sur', fact[k])}.`, 'fact');
        if (k === 'phone') return res(false, 2, `${wa(src)} 달라요. ${src}: ${PN.phoneText(C[k])} · 이 대답: ${PN.phoneText(fact[k])}. 전화번호는 숫자를 하나씩, 0은 oh로 읽어요 → ${PN.phoneWords(PN.phoneText(C[k]))}.`, 'fact');
        if (k === 'alt') return res(false, 2, `${wa(src)} 달라요. ${src}: ${PN.factKo(k, C[k])}도 괜찮아요 · 이 대답: ${PN.factKo(k, fact[k])}.`, 'fact');
        return res(false, 2, `${wa(src)} 달라요. ${src}: ${PN.factKo(k, C[k])} · 이 대답: ${PN.factKo(k, fact[k])}.`, 'fact');
      }
    }
    if (F.skip || F.half) return res(false, 2, F.why, 'need');
    // ③ 공손하게 끝내기
    if (F.tag === 'blunt' || F.tag === 'plain') return res(false, 3, F.why, F.tag);
    if (F.line) { const o = PN.checkLine(a.line, C); if (!o.ok) return res(false, 3, o.why, o.tag || 'blunt'); }
    // 통과
    const segs = PN.segs(a), pol = segs.filter(s => s.r === 'pol').map(s => s.t).filter((x, i, arr) => arr.indexOf(x) === i);
    let why;
    if (q.fast) why = F.kind === 'echo' ? '들린 만큼 되물어 확인했어요. 무엇에 대해 말했는지 알면 그 부분만 다시 물을 수 있어요.' : F.kind === 'slow' ? '천천히 말해 달라고 공손하게 부탁했어요.' : q.cut ? '소리가 끊기면 짐작하지 말고 끊겼다고 알리고 다시 물어요.' : '못 알아들었을 때는 짐작하지 말고 공손하게 다시 물어요.';
    else if (allowed) why = '모르는 낱말은 짐작하지 말고 물어요. 상대가 쉬운 말로 다시 알려 줄 거예요.';
    else if (F.line) why = PN.checkLine(a.line, C).why;
    else if (F.check) why = `들은 값(${Object.keys(fact).map(k => PN.factKo(k, fact[k])).join(' · ')})과 같아요. 시각 · 값 · 요일은 이렇게 되짚어 확인해요.`;
    else if (F.bare) why = `${shapeHead(q)} → ${SHp.ans}. ${In.offer ? '권하거나 부탁하는 말이라' : 'Yes/No 질문이라'} ${F.yes ? 'Yes' : 'No'}로 답할 수 있어요.`;
    else {
      const sl = segs.filter(s => s.r === 'slot').map(s => s.t), fk = Object.keys(fact).filter(k => fact[k] != null && k !== 'task' && k !== 'spelled');
      why = `${shapeHead(q)} → ${SHp.ans}. ` + (F.aux && q.aux ? `${PN.AUX[q.aux].q} → 짝 맞는 대답(${PN.AUX[q.aux].a}). ` : '') + (sl.length ? `틀 + 내 정보(${sl.join(' ')}) → ${src}의 사실과 맞아요.` : fk.length ? `${src}의 사실(${fk.map(k => PN.factKo(k, fact[k])).join(' · ')})과 맞아요.` : '짧은 대답이면 충분해요.');
      if (q.intent === 'need') why += ' 첫마디에 용건(I\'d like to … · I\'m calling to …) → 얼굴이 안 보여도 상대가 바로 알아들어요.';
      if (q.intent === 'full') why += ' 다른 시간이 있는지 질문으로 물었어요.';
      if (q.intent === 'check' && fact.hok === false) why += ' 잘못 들은 글자를 바로 바로잡고, 맞는 글자를 as in으로 다시 불렀어요.';
      if (q.intent === 'pcheck' && fact.pok === false) why += ' 잘못 받아 적은 번호를 바로잡고, 맞는 번호를 다시 불렀어요.';
      if (q.intent === 'answer') why += ' 나를 찾는 전화를 받으면 → Yes, speaking.';
      if (q.shape === 'yn' && In.offer && !/^(Yes|No)\b/.test(PN.text(a))) why += ` ${SHp.offer}.`;
      if (F.fact && F.fact.spelled) why += ' 이름과 철자를 한 번에 말해서 상대가 철자를 묻지 않아도 돼요.';
    }
    if (pol.length) why += ` 공손한 말 → ${pol.join(' · ')}.`;
    notes.forEach(n => { why += ` ${n}`; });
    if (F.note) why += ` ${F.note}`;
    if (sv && sv.note) why += ` ${sv.note}`;
    return res(true, 0, why);
  };
  // 모범 대답 (카드에 맞춰)
  const ECHO_OF = { need: 'rp_place', offer: 'rp_time', info: 'rp_info', msg: 'rp_msg', nb: 'rp_nb', bring: 'rp_bring' };
  PN.ECHO_OF = ECHO_OF;
  PN.model = function (q, card) {
    if (typeof q === 'string') q = PN.Q[q];
    const C = PN.ctx(card, q);
    if (q.fast) return { f: q.cut ? 'rp_break' : (ECHO_OF[q.intent] || 'rp_again') };
    if (q.intent === 'go') return PN.modelLine(C);
    const In = PN.INTENT[q.intent], id = typeof In.best === 'function' ? In.best(C, q) : In.best, F = PN.FRAME[id];
    if (!F.slot) return { f: id };
    const v = PN.slotVal(F.slot, C, q);
    return { f: id, v: v != null ? String(v) : (PN.SLOT[F.slot].dyn ? undefined : slotIds(F.slot)[0]) };
  };
  // 메시지 한 줄의 모범
  PN.modelLine = C => ({ f: 'line', line: { words: PN.lineWords(C), name: PN.fullName(C) } });
  /* =========================================================
     소리로 한 대답 맞춰 보기 — PN.matchSpoken(들린 글, 말, 카드)
     음성 인식이 글로 바꾼 말에 그 말의 표시 낱말과 카드의 사실이 들어 있으면 받아들여요.
     질문의 모양 규칙은 같아요: 고르는 질문 · 정보 질문에 yes · no만 들리면 ①. 숫자는 낱말(eight-fifteen · five-five-five, oh-one-three-nine)이든 숫자든 같게 맞춰요.
     철자는 as in + 이름(N as in Nancy)이나 글자를 하나씩(H, A, N) 들어요. 메시지 한 줄은 들린 조각을 차례대로 모아 PN.checkLine으로 맞춰 봐요.
     문법 · 공손함 · 발음은 판정하지 않아요(알림만 붙여요).
     ========================================================= */
  const CONTR = [[/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\bwhat's\b/g, 'what is'], [/\bdon't\b/g, 'do not'], [/\bdidn't\b/g, 'did not'], [/\bi've\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\bcan't\b/g, 'cannot'], [/\bi'd\b/g, 'i would'], [/\byou're\b/g, 'you are'], [/\bthat's\b/g, 'that is'], [/\bthere's\b/g, 'there is'], [/\bisn't\b/g, 'is not'], [/\bwasn't\b/g, 'was not'], [/\baren't\b/g, 'are not'], [/\bdoesn't\b/g, 'does not'], [/\bhaven't\b/g, 'have not'], [/\bwon't\b/g, 'will not'], [/\bhere's\b/g, 'here is'], [/\blet's\b/g, 'let us'], [/\bwouldn't\b/g, 'would not'], [/\bwe're\b/g, 'we are'], [/\bhe's\b/g, 'he is'], [/\byou'll\b/g, 'you will'], [/\bwho's\b/g, 'who is']];
  const BRK = 'qqbrk';   // 쉼표 · 쌍반점 · $ 자리 (숫자 덩어리를 끊어요: from 6 to 7, $40 → 7 · 40)
  PN.norm = function (s) {
    let t = String(s || '').toLowerCase().replace(/[’‘]/g, '\'');
    CONTR.forEach(([r, w]) => { t = t.replace(r, w); });
    t = t.replace(/[,;$]/g, ` ${BRK} `).replace(/(\d)\.(\d)/g, '$1 $2').replace(/[^a-z0-9' -]+/g, ' ').replace(/-/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '')
      .replace(/\bhand phone\b/g, 'handphone').replace(/\bcell phone\b/g, 'cellphone');
    return t.split(/\s+/).filter(Boolean);
  };
  const W2N = {}; Object.entries(NUMW).forEach(([n, w]) => { W2N[w] = +n; });
  const MULT = { hundred: 100, thousand: 1000 };
  const numTok = x => x && (/^\d+$/.test(x) || W2N[x] != null);
  // 숫자 덩어리 하나 → 숫자 글: 곱하는 말이 있으면 더해서, 없으면 이어 붙여서(eight fifteen → 815 · five five five oh one three nine → 5550139)
  const phraseNum = P => {
    if (P.some(x => MULT[x])) {
      let total = 0, cur = 0;
      P.forEach(x => {
        if (x === 'hundred') cur = (cur || 1) * 100;
        else if (x === 'thousand') { total += (cur || 1) * 1000; cur = 0; }
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
  // 전화번호: 555와 0으로 시작하는 네 자리가 쉼표로 나뉘어도 한 덩어리(5550139)로 합쳐요
  const canonCore = R => {
    const out = [];
    let P = null, I = null;
    const isNum = (x, k) => numTok(x) || MULT[x] || ((x === 'oh' || x === 'o') && (P || (R[k + 1] && numTok(R[k + 1].x)))) || (x === 'a' && R[k + 1] && MULT[R[k + 1].x]) || (x === 'and' && P && P.some(y => MULT[y]) && R[k + 1] && numTok(R[k + 1].x));
    const flush = () => { if (P) { out.push({ p: phraseNum(P), ws: I }); P = null; I = null; } };
    R.forEach((r, k) => {
      if (r.x === BRK) { flush(); return; }
      if (isNum(r.x, k)) { if (r.x === 'and') return; (P = P || []).push(r.x === 'a' ? 'one' : r.x); (I = I || []).push(r.i); }
      else { flush(); out.push({ p: r.x, ws: [r.i] }); }
    });
    flush();
    for (let k = 0; k < out.length - 1; k++) if (out[k].p === '555' && /^0\d{3}$/.test(out[k + 1].p)) { out[k] = { p: out[k].p + out[k + 1].p, ws: out[k].ws.concat(out[k + 1].ws) }; out.splice(k + 1, 1); }
    return out;
  };
  PN.canon = s => canonCore(PN.norm(s).map(x => ({ x, i: 0 }))).map(o => o.p);
  const runs = toks => toks.filter(t => /^\d+$/.test(t)).map(Number);
  // 들린 전화번호(끝 네 자리): 5550139 · 0139
  const phoneOf = toks => { for (const t of toks) { let m = /^5550(\d{3})$/.exec(t); if (m) return '0' + m[1]; m = /^0\d{3}$/.exec(t); if (m) return t; } return null; };
  // 들린 시각: 815 → 8:15 · 1130 → 11:30
  const timesOf = toks => toks.filter(t => /^\d{3,4}$/.test(t) && +t.slice(-2) < 60).map(t => `${+t.slice(0, -2)}:${t.slice(-2)}`);
  // 들린 값: dollars · a month 앞의 숫자 (덩어리가 길면 끝 두 자리 — six to seven forty dollars → 740 → 40)
  const priceOf = toks => { for (let k = 0; k < toks.length; k++) { if (!/^\d+$/.test(toks[k])) continue; const nx = toks.slice(k + 1, k + 3).join(' '); if (/^(dollars?|bucks|a month|per month)/.test(nx)) return +toks[k].slice(-2); } const p = runs(toks).find(n => [14, 15, 40, 50].includes(n)); return p != null ? p : null; };
  // 들린 요일 묶음 → 반: 화 · 목 = 초급 · 월 · 수 = 중급
  const heardDays = s => { const d = k => new RegExp('\\b' + k + 's?\\b').test(s); return d('tuesday') && d('thursday') ? 'beg' : d('monday') && d('wednesday') ? 'int' : null; };
  // 들린 철자: as in + 이름 · L for + 이름 → 글자 / 글자를 하나씩 → 성
  const AS_OF = {}; Object.entries(PN.AS).forEach(([L, w]) => { AS_OF[w.toLowerCase()] = L; });
  const asInOf = s => { const m = /\b(?:as in|for) (nancy|mary|peter|bob|sam|frank)\b/.exec(s); return m ? AS_OF[m[1]] : null; };
  const lsOf = toks => toks.filter(t => /^[a-z]$/.test(t)).join('');
  const lettersOf = toks => { const ls = lsOf(toks); return PN.SUR_IDS.find(id => ls.includes(PN.NAMES[id].spell.replace(/-/g, '').toLowerCase())) || null; };
  // 헷갈리는 글자를 바꿔 부른 철자 (H-A-M)
  const wrongOf = toks => { const ls = lsOf(toks); return PN.SUR_IDS.find(id => ls.includes(PN.wrongSpell(id).replace(/-/g, '').toLowerCase())) || null; };
  const SUR_RE = { han: /\b(han|hahn)\b/, park: /\bpark\b/, kim: /\bkim\b/, seo: /\b(seo|suh)\b/ };
  const surOf = s => PN.SUR_IDS.find(id => SUR_RE[id].test(s)) || null;
  const BARE_RE = /^(yes|yeah|yep|no|nope|please|sure|thanks|thank|you|okay|ok|of|course|it|is|was|i|do|did|am|not|that|great|fine|alright|right|uh|um|well|oh)$/;
  const REPAIR_RE = /\b(say that again|pardon|repeat|more slowly|slow down|sorry what|come again|breaking up|cutting out)\b|^ ?sorry ?$/;
  // 되짚지 않고 넘어가는 대답 (안내에 Okay만 하면 ②)
  const SKIP_OF = { full: 'tm_ok', offer: 'of_ok', info: 'in_ok', bring: 'br_ok' };
  // 메시지 한 줄에서 조각 모으기 → 줄 낱말 (들린 차례대로). 사전에 없는 번호는 'p?' + 번호
  PN.parseLine = function (raw) {
    const toks = PN.canon(raw), s = ' ' + toks.join(' ') + ' ', hits = [];
    const scan = (re, w) => { re.lastIndex = 0; let m; while ((m = re.exec(s))) hits.push([m.index, w]); };
    scan(/\bthis is\b/g, 'this');
    scan(/\bhere is\b/g, 'here');
    scan(/\bbeginners?\b/g, 'abeg');
    scan(/\bintermediate\b/g, 'aint');
    const cab = /\b(could|can|would) you (please )?((ask|tell|get) him to|have him) (call|ring) me back\b|\b(could|can) he (call|ring) me back\b|\bplease (ask|have) him (to )?(call|ring) me back\b/g;
    scan(cab, 'cab');
    if (!hits.some(h => h[1] === 'cab')) scan(/\b(tell|ask) him to (call|ring) me back\b/g, 'tell');
    const ph = phoneOf(toks);
    if (ph) { const at = s.search(new RegExp('\\b(5550)?' + ph.slice(1) + '\\b|\\b' + ph + '\\b')); hits.push([at < 0 ? s.length : at, PN.OW['p' + ph] ? 'p' + ph : 'p?' + ph]); }
    hits.sort((a, b) => a[0] - b[0]);
    return hits.map(h => h[1]).filter((w, i, a) => a.indexOf(w) === i);
  };
  PN.matchSpoken = function (raw, q, card) {
    if (typeof q === 'string') q = PN.Q[q];
    const toks = PN.canon(raw), s = ' ' + toks.join(' ') + ' ', heard = PN.norm(raw).filter(x => x !== BRK).join(' ');
    if (!toks.length) return { ok: false, stage: 0, why: '들린 말이 없어요. 다시 말해 보세요.', heard: '' };
    const C = PN.ctx(card, q), SHp = PN.SHAPE[q.shape], It = PN.INTENT[q.intent];
    const R = (ok, stage, why, o = {}) => Object.assign({ ok, stage, why, heard }, o);
    const notes = [];
    const pass = (why, cov) => R(true, 0, why + (notes.length ? ' 알림: ' + notes.join(' ') : ''), { note: notes.join(' '), covered: cov || [q.intent] });
    const keyMiss = () => R(false, 1, `${shapeHead(q)}${q.shape === 'note' ? '' : `(${SHp.ans})`}. 들린 말에 그 대답이 없어요.`);
    const differ = (k, v, who) => R(false, 2, `${who || '카드'}와 달라요. ${who || '카드'}: ${PN.factKo(k, C[k])} · 들린 말: ${PN.factKo(k, v)}.`, { tag: 'fact' });
    const lit = id => R(false, 2, PN.FRAME[id].why, { tag: 'literal' });
    const need = id => R(false, 2, PN.FRAME[id].why, { tag: 'need' });
    const yesHeard = /\b(yes|yeah|yep|sure|okay|ok|speaking)\b/.test(s), noHeard = /\b(no|nope)\b/.test(s);
    const thanksOnly = () => /\b(thank|thanks|okay|ok|great|i see|got it|alright)\b/.test(s);
    // 빠르거나 끊긴 말: 다시 묻는 말만 (들린 만큼 되묻는 말은 실제 말과 같아야)
    if (q.fast) {
      const echo = /\bbring\b/.test(s) ? 'bring' : /\b(how much|when is the class)\b/.test(s) ? 'info' : /\bwhat time\b/.test(s) ? 'offer' : /\bmessage\b/.test(s) ? 'msg' : /\bnumber\b/.test(s) ? 'nb' : /\b(bistro|is this)\b/.test(s) ? 'need' : null;
      const lost = q.cut ? '소리가 끊겨서' : '너무 빨라서';
      if (echo) return echo === q.intent ? R(false, 1, '들린 만큼 되물었어요. 상대가 다시 말해 줄 거예요.', { repair: 'again' }) : R(false, 1, `되물은 말이 달라요. 들린 낱말(${q.key.join(' … ')})로 보면 상대는 ${It.turn}에 대해 말했어요.`);
      if (REPAIR_RE.test(s) || /\b(sorry|again|slowly)\b/.test(s)) return R(false, 1, q.cut && !/\b(breaking up|cutting out)\b/.test(s) ? '다시 묻는 말로 들었어요. 소리가 끊겼다고 알리면 더 좋아요 → Sorry, you\'re breaking up. Could you say that again?' : '다시 묻는 말로 들었어요. 상대가 한 번 더 말해 줄 거예요.', { repair: 'again' });
      return R(false, 1, `${lost} 열쇠 낱말을 못 잡았어요. 짐작해서 답하지 말고 먼저 다시 물어요 → ${q.cut ? 'Sorry, you\'re breaking up. Could you say that again?' : 'Sorry? Could you say that again, please?'}`);
    }
    // 모르는 낱말 묻기 (intermediate)
    if (q.allow && /\bwhat (does|is) intermediate\b|\bintermediate mean\b/.test(s)) return R(false, 1, '모르는 낱말을 물었어요. 상대가 쉬운 말로 알려 줄 거예요.', { repair: 'what' });
    if ((REPAIR_RE.test(s) || /\b(could you say|say again)\b/.test(s)) && toks.length <= 10) return R(false, 1, '다시 묻는 말로 들었어요. 상대가 한 번 더 말해 줄 거예요.', { repair: 'again' });
    if (/\b(give me|tell me about|tell him to)\b/.test(s)) notes.push('명령처럼 들릴 수 있어요(말로 한 대답은 말투를 판정하지 않아요) → 부탁은 질문으로(Could you …?) · 용건은 I\'d like to … · I\'m calling to ….');
    const bare = toks.every(t => BARE_RE.test(t)) && /\b(yes|yeah|yep|no|nope|sure|okay|ok)\b/.test(s);
    if (bare && (q.shape === 'or' || q.shape === 'wh')) return R(false, 1, `${shapeHead(q)}. ${q.shape === 'or' ? '둘 가운데 하나를 고르라는 말이라 yes · no만으로는 무엇을 골랐는지 알 수 없어요' : '정보를 묻는 말이라 yes · no로는 답이 안 돼요'} → ${It.want}`, { tag: 'shape' });
    if (bare && q.shape === 'note' && q.intent !== 'go') return SKIP_OF[q.intent] ? need(SKIP_OF[q.intent]) : R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${PN.sayOf(q.intent)} → ${It.want}`, { tag: 'shape' });
    if (q.shape === 'or' && /\b(yes|yeah)\b/.test(s) && !bare) notes.push('고르는 질문에는 Yes 없이 고른 것만 말해도 돼요.');
    const auxNote = () => { if (!q.aux) return; const said = /\b(i|it) (do|did|am|is|was|have)( not)?\b/.exec(s); if (said && said[2] !== q.aux && !(q.aux === 'is' && said[2] === 'is')) notes.push(`${PN.AUX[q.aux].q} 질문의 짧은 대답은 → ${PN.AUX[q.aux].a}(말로 한 대답은 문법을 판정하지 않아요)`); };
    // 메시지 한 줄 (메시지를 남기겠느냐는 말 · 말씀하세요에 바로)
    const lineCase = (intent) => {
      const ws = PN.parseLine(raw);
      const bad = ws.find(w => /^p\?/.test(w));
      if (bad) return R(false, 2, `카드와 달라요(전화번호). 카드: ${PN.phoneText(C.phone)} · 들린 말: ${PN.phoneText(bad.slice(2))}. 숫자는 하나씩, 0은 oh로 → ${PN.phoneWords(PN.phoneText(C.phone))}.`, { tag: 'fact' });
      const o = PN.checkLine({ words: ws, name: PN.fullName(C) }, C);
      if (!o.ok && o.stage !== 3) return R(false, o.stage || 2, o.why, { tag: o.tag || 'fact', line: ws, fix: PN.fixLine({ words: ws }, C) });
      if (!o.ok) notes.push(o.why);
      return pass('누구 · 무슨 일 · 부탁이 들렸어요.' + (o.ok && o.note === 'late' ? ' 누구인지를 맨 먼저 밝히면 더 좋아요.' : ''), PN.coveredBy(PN.lineFacts(ws), intent));
    };
    switch (q.intent) {
      case 'need': {
        const task = C.task;
        if (task === 'book') {
          if (/\breserve (friday|saturday)\b/.test(s)) return lit('nd_rsv');
          const d = /\bfriday\b/.test(s) ? 'fri' : /\bsaturday\b/.test(s) ? 'sat' : null, want = /\b(reservation|reserve|book|table)\b/.test(s);
          if (!want && !d) return /\b(swimming|yoga|lessons?|class)\b/.test(s) ? R(false, 2, '상황과 달라요. 여기는 식당이에요(예약 전화).', { tag: 'fact' }) : keyMiss();
          if (d && C.day != null && d !== C.day) return differ('day', d);
          if (!want) return need('nd_bhalf');
          if (!d) notes.push('날짜까지 말하면 더 빨라요 → Hi, I\'d like to make a reservation for Friday, please.');
          return pass('예약하려는 용건이 들렸어요.');
        }
        if (/\binquiry\b/.test(s)) return lit('nd_inq');
        const v = /\bswim(ming)?\b/.test(s) ? 'swim' : /\byoga\b/.test(s) ? 'yoga' : null;
        if (!v) return /\b(reservation|table)\b/.test(s) ? R(false, 2, '상황과 달라요. 여기는 스포츠 센터예요(문의 전화).', { tag: 'fact' }) : /\bquestion\b/.test(s) ? need('nd_qhalf') : keyMiss();
        if (C.topic != null && v !== C.topic) return differ('topic', v);
        return pass('묻고 싶은 것(용건)이 들렸어요.');
      }
      case 'meal': {
        const v = /\blunch\b/.test(s) ? 'lunch' : /\bdinner\b/.test(s) ? 'dinner' : null;
        if (!v) return keyMiss();
        if (C.meal != null && v !== C.meal) return differ('meal', v);
        return pass('고른 것이 들렸고 카드와 맞아요.');
      }
      case 'ppl': {
        if (/\bwe are \d\b/.test(s)) return lit('pp_lit');
        const n = runs(toks).find(x => x >= 1 && x <= 12);
        if (n == null) return keyMiss();
        if (C.ppl != null && n !== C.ppl) return differ('ppl', n);
        return pass('사람 수가 들렸고 카드와 맞아요.');
      }
      case 'when': {
        const n = runs(toks).find(x => x >= 1 && x <= 12);
        if (n == null) return keyMiss();
        if (C.want != null && n !== C.want) return differ('want', n);
        return pass('가고 싶은 시각이 들렸고 카드와 맞아요.');
      }
      case 'full': {
        if (/\bpossible\b/.test(s)) return lit('tm_lit');
        const v = /\blater\b/.test(s) ? 'later' : /\bearlier\b/.test(s) ? 'earlier' : null;
        if (!v) return thanksOnly() ? need('tm_ok') : keyMiss();
        if (C.alt != null && v !== C.alt) return R(false, 2, `카드와 달라요. 카드: ${PN.factKo('alt', C.alt)}도 괜찮아요 · 들린 말: ${PN.factKo('alt', v)}.`, { tag: 'fact' });
        return pass('다른 시간이 있는지 묻는 말이 들렸어요.');
      }
      case 'offer': {
        const ts = timesOf(toks);
        if (!ts.length) return thanksOnly() ? need('of_ok') : keyMiss();
        if (C.time != null && !ts.includes(C.time)) return R(false, 2, `들은 시각과 달라요. 상대: ${PN.factKo('time', C.time)} · 들린 말: ${ts[0]}. 분의 -teen과 -ty는 헷갈리기 쉬워요. 뒤가 세면 fifTEEN, 앞이 세면 FIFty.`, { tag: 'fact' });
        return pass('들은 시각을 되짚었어요. 시각이 맞아요.');
      }
      case 'name': {
        if (/\bname is\b/.test(s) && !/\b(my|the) name is\b/.test(s)) return lit('nm_lit');
        const v = surOf(s), L = asInOf(s), sp = lettersOf(toks), wr = !sp && wrongOf(toks);
        if (wr && wr === C.sur) return R(false, 2, `헷갈리는 글자를 바꿔 불렀어요. 내 이름: ${PN.factKo('sur', C.sur)} · 들린 철자: ${PN.wrongSpell(wr)}.`, { tag: 'fact' });
        if (!v && !sp) return /\b(jiwoo|minji|hana|yuna)\b/.test(s) ? pass('이름이 들렸어요.') : keyMiss();
        if (v && C.sur != null && v !== C.sur) return differ('sur', v);
        if (sp && C.sur != null && sp !== C.sur) return R(false, 2, `카드와 달라요(철자). 카드: ${PN.factKo('sur', C.sur)} · 들린 철자: ${PN.NAMES[sp].spell}.`, { tag: 'fact' });
        if (L && C.letter && L !== C.letter) return R(false, 2, `헷갈리는 글자를 바꿔 불렀어요. 내 이름: ${PN.factKo('sur', C.sur)}, ${PN.asIn(C.letter)} · 들린 말: ${PN.asIn(L)}.`, { tag: 'fact' });
        return pass(L || sp ? '이름과 철자가 들렸어요. 상대가 철자를 묻지 않아도 돼요.' : '예약자 이름이 들렸고 카드와 맞아요.', L || sp ? ['name', 'spell'] : ['name']);
      }
      case 'spell': {
        const L = asInOf(s), sp = lettersOf(toks), v = surOf(s), wr = !sp && wrongOf(toks);
        if (wr && wr === C.sur) return R(false, 2, `헷갈리는 글자를 바꿔 불렀어요. 내 이름: ${PN.factKo('sur', C.sur)} · 들린 철자: ${PN.wrongSpell(wr)}.`, { tag: 'fact' });
        if (L && C.letter && L !== C.letter) return R(false, 2, `헷갈리는 글자를 바꿔 불렀어요. 내 이름: ${PN.factKo('sur', C.sur)}, ${PN.asIn(C.letter)} · 들린 말: ${PN.asIn(L)}.`, { tag: 'fact' });
        if (sp && C.sur != null && sp !== C.sur) return R(false, 2, `카드와 달라요(철자). 카드: ${PN.factKo('sur', C.sur)} · 들린 철자: ${PN.NAMES[sp].spell}.`, { tag: 'fact' });
        if (L) return pass('철자와 헷갈리는 글자의 as in이 들렸어요.');
        if (sp) { notes.push(`헷갈리기 쉬운 글자(${C.letter})에 as in을 붙이면 더 확실해요 → ${PN.NAMES[C.sur].spell}, ${PN.asIn(C.letter)}.`); return pass('글자를 하나씩 부른 철자가 들렸어요.'); }
        if (v) return need('sp_name');
        if (yesHeard) return R(false, 2, It.yn.strict, { tag: 'need' });
        return keyMiss();
      }
      case 'check': {
        const L = asInOf(s);
        if (!yesHeard && !noHeard && !L) return /\b(right|correct)\b/.test(s) ? (C.hok === false ? R(false, 2, `상대가 잘못 들었어요(${PN.asIn(C.hl)}). 내 이름의 글자는 ${PN.asIn(C.letter)}예요 → No, ${PN.asIn(C.letter)}.`, { tag: 'fact' }) : pass('맞다는 말이 들렸어요.')) : keyMiss();
        const no = noHeard || (L && L === C.letter && C.hok === false);
        if (!no) { if (C.hok === false) return R(false, 2, `상대가 잘못 들었어요(${PN.asIn(C.hl)}). 내 이름의 글자는 ${PN.asIn(C.letter)}예요. Yes라고 하면 틀린 철자로 적혀요 → No, ${PN.asIn(C.letter)}.`, { tag: 'fact' }); auxNote(); return pass('맞다는 말이 들렸어요.'); }
        if (C.hok === true) return R(false, 2, `상대가 맞게 되짚었어요(${PN.asIn(C.letter)}). 맞으면 → Yes, that's right.`, { tag: 'fact' });
        if (!L) return R(false, 2, It.yn.noStrict, { tag: 'need' });
        if (L !== C.letter) return R(false, 2, `내 이름의 글자가 아니에요. 내 이름: ${PN.factKo('sur', C.sur)} → ${PN.asIn(C.letter)} · 들린 말: ${PN.asIn(L)}.`, { tag: 'fact' });
        auxNote();
        return pass('아니라는 말과 맞는 글자(as in)가 들렸어요.');
      }
      case 'level': {
        const v = /\bbeginners?\b/.test(s) ? 'beg' : /\bintermediate\b/.test(s) ? 'int' : null;
        if (!v) return keyMiss();
        if (C.lvl != null && v !== C.lvl) return differ('lvl', v);
        return pass('고른 반이 들렸고 카드와 맞아요.');
      }
      case 'info': {
        const o = PN.infoParse(C.info), d = heardDays(s), p = priceOf(toks);
        if (!d && p == null) return thanksOnly() ? need('in_ok') : keyMiss();
        if (d && o && d !== o.id) return R(false, 2, `상대가 말한 요일과 달라요. 상대: ${o.dko} · 들린 말: ${PN.LEVELS[d].dko}. 요일은 묶음으로 들어요.`, { tag: 'fact' });
        if (p != null && o && p !== o.price) return R(false, 2, `상대가 말한 값과 달라요. 상대: 한 달 ${o.price}달러 (${PN.numWord(o.price)}) · 들린 말: ${p}달러. 값의 -teen과 -ty는 헷갈리기 쉬워요(fourTEEN ↔ FORty).`, { tag: 'fact' });
        if (!d || p == null) notes.push(`요일과 값을 함께 되짚으면 더 좋아요 → So, ${PN.infoText(C.info)}?`);
        return pass('수업 안내를 되짚었어요. 들은 것과 맞아요.');
      }
      case 'msg': {
        if (/\bplease leave a message\b/.test(s)) return lit('ms_lit');
        if (PN.parseLine(raw).length) return lineCase('msg');
        if (noHeard && !yesHeard) { if (C.msg) return R(false, 2, `메시지를 남기려던 참이에요(카드) → Yes, please.`, { tag: 'fact' }); return pass('나중에 다시 걸겠다는 말이 들렸어요.'); }
        if (yesHeard) { if (C.msg === false) return differ('msg', true); return pass('메시지를 남기겠다는 말이 들렸어요.'); }
        return keyMiss();
      }
      case 'go': {
        const ws = PN.parseLine(raw);
        if (!ws.length) return keyMiss();
        return lineCase('go');
      }
      case 'nb': {
        if (/\bhandphone\b/.test(s)) return lit('nb_hp');
        const ph = phoneOf(toks);
        if (!ph) return keyMiss();
        if (C.phone != null && ph !== C.phone) return R(false, 2, `카드와 달라요. 카드: ${PN.phoneText(C.phone)} · 들린 말: ${PN.phoneText(ph)}. 숫자는 하나씩, 0은 oh로 → ${PN.phoneWords(PN.phoneText(C.phone))}.`, { tag: 'fact' });
        return pass('전화번호가 들렸고 카드와 맞아요.');
      }
      case 'pcheck': {
        const ph = phoneOf(toks);
        if (!yesHeard && !noHeard && !ph) return /\b(right|correct)\b/.test(s) && C.pok !== false ? pass('맞다는 말이 들렸어요.') : keyMiss();
        const no = noHeard || (ph && ph === C.phone && C.pok === false && !yesHeard);
        if (!no) { if (C.pok === false) return R(false, 2, `상대가 잘못 들었어요(${PN.phoneText(C.heard)}). 내 번호는 ${PN.phoneText(C.phone)}예요. Yes라고 하면 코치가 다른 번호로 전화해요 → No, it isn't. It's ${PN.phoneText(C.phone)}.`, { tag: 'fact' }); auxNote(); return pass('맞다는 말이 들렸어요.'); }
        if (C.pok === true) return R(false, 2, `상대가 맞게 되짚었어요(${PN.phoneText(C.phone)}). 맞으면 → Yes, that's right.`, { tag: 'fact' });
        if (!ph) return R(false, 2, It.yn.noStrict, { tag: 'need' });
        if (ph !== C.phone) return R(false, 2, `카드와 달라요. 카드: ${PN.phoneText(C.phone)} · 들린 말: ${PN.phoneText(ph)}.`, { tag: 'fact' });
        auxNote();
        return pass('아니라는 말과 맞는 번호가 들렸어요.');
      }
      case 'answer': {
        const blunt = /\bwho are you\b/.test(s);
        if (/\bspeaking\b|\bthis is (she|he|me)\b/.test(s) || (yesHeard && !noHeard)) { if (blunt) notes.push(PN.FRAME.cb_who.why); auxNote(); return pass('내가 맞다는 말이 들렸어요.'); }
        if (blunt) return R(false, 3, PN.FRAME.cb_who.why, { tag: 'blunt' });
        if (noHeard) return R(false, 2, '상대가 찾는 사람이 바로 나예요(카드) → Yes, speaking.', { tag: 'fact' });
        return keyMiss();
      }
      case 'bring': {
        const b = PN.bringParse(C.bring), item = /\bgoggles?\b/.test(s) ? 'gog' : /\b(swim )?cap\b/.test(s) ? 'cap' : null;
        const day = Object.keys(PN.WDAYS).find(d => new RegExp('\\b' + PN.WDAYS[d].t.toLowerCase() + 's?\\b').test(s)) || null;
        if (!item && !day) return thanksOnly() ? need('br_ok') : keyMiss();
        if (item && b && item !== b.item) return R(false, 2, `상대가 말한 준비물과 달라요. 상대: ${PN.BRINGS[b.item].ko} · 들린 말: ${PN.BRINGS[item].ko}.`, { tag: 'fact' });
        if (day && b && day !== b.day) return R(false, 2, `상대가 말한 요일과 달라요. 상대: ${PN.WDAYS[b.day].ko} · 들린 말: ${PN.WDAYS[day].ko}. 첫 수업 요일은 같은 반의 다른 요일과 헷갈리기 쉬워요.`, { tag: 'fact' });
        if (!item || !day) notes.push(`준비물과 요일을 함께 되짚으면 더 좋아요 → So, ${PN.bringText(C.bring)}?`);
        return pass('준비물과 요일을 되짚었어요. 들은 것과 맞아요.');
      }
      case 'end': {
        const thanks = /\b(thank|thanks)\b/.test(s), done = noHeard || /\b(that is all|that is it|i am good|nothing else)\b/.test(s);
        if (/\bbye\b/.test(s) && !thanks) return R(false, 3, PN.FRAME.en_plain.why, { tag: 'plain' });
        if (yesHeard && !done && !thanks) return R(false, 2, '더 물어볼 것은 없어요(카드). 고맙다는 말과 끝인사로 → No, that\'s all. Thanks for calling back. Bye!', { tag: 'fact' });
        if (!done && !thanks) return keyMiss();
        if (!thanks) return R(false, 2, It.yn.noStrict, { tag: 'need' });
        return pass('다 됐다는 말과 고맙다는 말이 들렸어요.');
      }
      default: return R(false, 0, '이 말은 말로 대답하기를 지원하지 않아요.');
    }
  };

  /* ---------- 따라 말하기: 낱말 맞춰 보기 (가장 긴 공통 부분열, 숫자는 같은 숫자로 — 숫자 덩어리가 낱말 여럿에 걸치면 함께 칠해요) ---------- */
  PN.compareWords = function (target, heard) {
    const tw = String(target).split(/\s+/).filter(Boolean), raw = [];
    tw.forEach((w, i) => PN.norm(w).forEach(x => raw.push({ x, i })));
    const T = canonCore(raw), A = T.map(o => o.p), B = PN.canon(heard), D = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) D[i][j] = A[i] === B[j] ? D[i + 1][j + 1] + 1 : Math.max(D[i + 1][j], D[i][j + 1]);
    const got = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { got.add(i); i++; j++; } else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++; }
    const okW = tw.map(() => true);
    T.forEach((o, n) => { if (!got.has(n)) o.ws.forEach(w => { okW[w] = false; }); });
    return { words: tw.map((t, k) => ({ t, ok: okW[k] })), hit: okW.filter(Boolean).length, total: tw.length };
  };
  /* =========================================================
     내 카드 (전화 시뮬레이터): 식당 예약 → 스포츠 센터 문의 · 메시지 → 코치의 전화
     빈 시각 · 수업 요일과 값 · 준비물과 첫 수업 요일은 카드에 없어요 — 상대가 말한 것을 듣고 되짚어야 해요.
     상대가 철자 · 번호를 맞게 되짚을지(hok · pok)도 카드가 정해요(맞으면 Yes, 틀리면 바로잡기).
     ========================================================= */
  PN.newCard = function (rnd = Math.random) {
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const meal = pick(['lunch', 'dinner']);
    return { day: pick(['fri', 'sat']), meal, ppl: pick([2, 3, 4, 5]), want: PN.WANT[meal], alt: pick(['later', 'earlier']), offer: pick([0, 1]),
      sur: pick(PN.SUR_IDS), given: pick(PN.GIVEN), hok: rnd() < 0.5, topic: 'swim', lvl: pick(PN.LVL_IDS), msg: true, phone: pick(PN.PHONES), pok: rnd() < 0.5, item: pick(PN.BRING_IDS) };
  };
  // 상대가 말하는 차례 (메시지 한 줄에 번호까지 말하면 ‘가장 좋은 번호’는 건너뜀 — 시뮬레이터가 covered로)
  PN.simQs = () => ['bk_help', 'bk_meal', 'bk_ppl', 'tm_when', 'tm_full', 'tm_offer', 'nm_name', 'nm_spell', 'nm_check', 'as_help', 'as_level', 'as_info', 'ms_out', 'ms_go', 'nb_ask', 'nb_check', 'cb_hi', 'cb_bring', 'cb_end'];
  // 카드에 따라 바뀌는 말 (다 찬 시각 · 빈 시각 · 되짚은 철자 · 수업 안내 · 되짚은 번호 · 내 이름 · 준비물)
  PN.simQ = function (id, c) {
    const q = PN.Q[id];
    if (id === 'tm_full') return Object.assign({}, q, { en: `I'm sorry, we're fully booked at ${c.want}.`, ko: `죄송하지만 ${c.want}시는 자리가 다 찼어요.`, fact: { want: c.want }, short: `We're fully booked at ${c.want}.` });
    if (id === 'tm_offer') { const t = PN.offerOf(c), [h, m] = t.split(':'); return Object.assign({}, q, { en: `We have a table at ${t}.`, ko: `${h}시 ${+m}분에 자리가 있어요.`, key: [t], fact: { time: t }, short: `We have a table at ${t}.` }); }
    if (id === 'nm_check') { const n = PN.NAMES[c.sur], hl = c.hok ? n.L : n.alt; return Object.assign({}, q, { en: `Was that ${PN.asIn(hl)}?`, ko: `${PN.AS[hl]}의 ${hl}${has(hl) ? '이었나요' : '였나요'}?`, key: [PN.asIn(hl)], fact: { hl, hok: !!c.hok }, short: `Was that ${PN.asIn(hl)}?` }); }
    if (id === 'as_info') { const L = PN.LEVELS[c.lvl]; return Object.assign({}, q, { en: PN.infoLine(c.lvl), ko: `${L.ko} 반은 ${L.dko.replace(' · ', '과 ')} ${L.from}시에서 ${L.to}시이고, 한 달에 ${L.price}달러예요.`, key: [L.days], fact: { info: c.lvl }, short: `${L.days.replace(/s and /, ' · ').replace(/s$/, '')} ${L.from}–${L.to}, $${L.price} a month.` }); }
    if (id === 'nb_check') { const heard = c.pok ? c.phone : PN.phoneSwap(c.phone); return Object.assign({}, q, { en: `Let me read that back. ${PN.phoneText(heard)}. Is that right?`, ko: `다시 불러 볼게요. ${PN.phoneText(heard)}. 맞나요?`, fact: { heard, pok: !!c.pok }, short: `${PN.phoneText(heard)}. Is that right?` }); }
    if (id === 'cb_hi') return Object.assign({}, q, { en: `Hi, this is Matt Diaz from Kellport Sports Center. Is this ${c.given}?`, ko: `안녕하세요, 켈포트 스포츠 센터의 맷 디아스예요. ${PN.GIVEN_KO[c.given]} 씨인가요?`, key: [`Is this ${c.given}`], short: `Is this ${c.given}?` });
    if (id === 'cb_bring') { const b = `${c.item}.${PN.LEVELS[c.lvl].first}`, B = PN.bringParse(b); return Object.assign({}, q, { en: PN.bringLine(b), ko: `${PN.WDAYS[B.day].ko}에 ${eul(PN.BRINGS[B.item].ko)} 가져오셔야 해요.`, fact: { bring: b }, short: `Bring ${PN.bringText(b)}.` }); }
    return q;
  };
  PN.PLACE_OF = id => PN.Q[id].place;
  // 질문마다 틀 칩: 맞는 틀 · 한국어 그대로(콩글리시 · 짝이 다른 대답) · 되짚지 않는 말 · Yes만 하는 대답. 메시지 한 줄은 조각 칩(PN.lineChips)으로 말해요
  PN.SIM_FRAMES = {
    need: c => c.task === 'ask' ? ['nd_ask', 'nd_inq', 'nd_qhalf'] : ['nd_book', 'nd_rsv', 'nd_bhalf'],
    meal: ['ml_pl', 'g_yesp', 'pp_for'],
    ppl: ['pp_for', 'pp_lit', 'g_yes'],
    when: ['wn_at', 'g_yes', 'pp_for'],
    full: ['fl_alt', 'tm_ok', 'tm_lit'],
    offer: ['of_so', 'of_ok', 'g_yes'],
    name: ['nm_is', 'nm_lit', 'g_yes'],
    spell: ['sp_it', 'sp_name', 'g_yesp'],
    check: c => c.hok ? ['ck_yes', 'ck_no', 'g_no'] : ['ck_no', 'ck_isnt', 'ck_yes'],
    level: ['lv_pl', 'g_yesp', 'in_ok'],
    info: ['in_so', 'in_ok', 'g_yes'],
    msg: ['g_yesp', 'ms_lit', 'ms_no'],
    go: ['line', 'ms_no', 'g_yes'],
    nb: ['nb_is', 'nb_hp', 'g_yes'],
    pcheck: c => c.pok ? ['nc_yes', 'nc_no', 'g_no'] : ['nc_no', 'nc_wasnt', 'nc_yes'],
    answer: ['cb_sp', 'cb_who', 'g_no'],
    bring: ['br_so', 'br_ok', 'g_yes'],
    end: ['en_no', 'en_plain', 'g_yes'],
  };
  PN.simFrames = (intent, c) => { const x = PN.SIM_FRAMES[intent]; return typeof x === 'function' ? x(c) : x ? x.slice() : null; };
  // 칸 칩: 카드(또는 들은 말)의 값 + 헷갈리기 쉬운 값 (시각 teen ↔ ty · 철자의 헷갈리는 글자 · 값 teen ↔ ty · 끝 두 자리를 바꾼 번호 · 같은 반의 다른 요일)
  PN.slotChoices = function (slot, card, rnd = Math.random, q) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let out;
    if (slot === 'time') { const t = card.time || '8:15', all = [].concat(...Object.values(PN.OFFERS).map(m => [].concat(...Object.values(m)))); out = [t, PN.timeTrap(t), shuffle(all.filter(x => x !== t && x !== PN.timeTrap(t)))[0]]; }
    else if (slot === 'spell') { const s = card.sur || 'han'; out = [s, s + '~w', shuffle(PN.SUR_IDS.filter(x => x !== s))[0]]; }
    else if (slot === 'letter') { const n = PN.NAMES[card.sur || 'han']; out = [n.L, n.alt, shuffle(Object.keys(PN.AS).filter(x => x !== n.L && x !== n.alt))[0]]; }
    else if (slot === 'info') { const v = card.info || card.lvl || 'beg'; out = [v, v + '~p', v + '~d']; }
    else if (slot === 'phone') { const p = card.phone || '0139'; out = [p, PN.phoneSwap(p), shuffle(PN.PHONES.filter(x => x !== p))[0]]; }
    else if (slot === 'bring') { const b = PN.bringParse(card.bring || 'gog.tue'); out = [`${b.item}.${b.day}`, `${b.item}.${PN.dayTrap(b.day)}`, `${PN.BRING_IDS.find(x => x !== b.item)}.${b.day}`]; }
    else if (slot === 'want') out = ['7', '12'];
    else {
      const right = PN.slotVal(slot, card, q), keys = shuffle(slotIds(slot).filter(k => String(k) !== String(right)));
      out = (right ? [String(right)] : []).concat(keys.slice(0, right ? 2 : 3));
    }
    return shuffle(out.filter((x, i, a) => x != null && a.indexOf(x) === i));
  };
  // 메시지 한 줄의 조각 칩 (갈래마다 맞는 조각 + 헷갈리기 쉬운 조각) — 차례대로 고르면 한 줄이 돼요
  PN.lineChips = function (c, rnd = Math.random) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const l = c.lvl || 'beg', p = c.phone || '0139';
    return [
      { c: 'who', ids: shuffle(['this', 'here']) },
      { c: 'about', ids: shuffle(['a' + l, 'a' + PN.otherLvl(l)]) },
      { c: 'ask', ids: shuffle(['cab', 'tell']) },
      { c: 'num', ids: shuffle(['p' + p, 'p' + PN.phoneSwap(p)]) },
    ];
  };
  PN.cardRows = c => {
    const n = PN.NAMES[c.sur], L = PN.LEVELS[c.lvl];
    return [
      ['식당 예약', `${PN.BISTRO} · ${PN.DAYS[c.day].ko} ${PN.MEALS[c.meal].ko} · ${PN.PPL[c.ppl].ko} · ${c.want}시가 좋아요 — 다 찼으면 ${PN.ALTS[c.alt].ko}도 괜찮아요(빈 시각은 직원이 알려 줘요)`],
      ['예약자 이름', `${PN.fullKo(c)} (${PN.fullName(c)}) · 성의 철자 ${n.spell} — 전화에서 헷갈리기 쉬운 글자: ${PN.asIn(n.L)}`],
      ['수영 강습 문의', `${PN.CENTER} · ${L.ko} 반(${L.t}) — 요일 · 시간 · 값은 직원이 알려 줘요`],
      ['메시지', `${PN.COACH}가 없으면 메시지를 남겨요(다시 전화해 달라고) · 내 번호 ${PN.phoneText(c.phone)}`],
      ['코치의 전화', '준비물과 첫 수업 요일은 코치가 알려 줘요 · 더 물어볼 것은 없어요'],
    ];
  };
  // 상대의 반응 (단계별)
  const BAD_REACT = {
    nd_rsv: ['Reserve…? Oh — you\'d like to book a table?', 'reserve 뒤에는 잡을 것 → make a reservation for Friday'], nd_bhalf: ['Sure… and what can I do for you?', '용건을 부탁 틀로 → I\'d like to make a reservation for Friday, please.'],
    pp_lit: ['Sorry — how many people?', '사람 수 → For four, please.'], tm_ok: ['Okay… would you like to try another time?', '다른 시간을 질문으로 → Do you have anything later?'],
    tm_lit: ['Possible…? Oh — you mean what\'s available?', 'possible → Do you have anything later?'], of_ok: ['Great. Did you get the time?', '시각은 되짚어요 → So, 8:15?'],
    nm_lit: ['Sorry — what was the name?', '짧게 → It\'s Han.'], sp_name: ['Right… and how do you spell that?', '글자를 하나씩 + as in → H-A-N, N as in Nancy.'],
    ck_isnt: ['Sorry — so it wasn\'t that letter?', 'Was that …? → No, it wasn\'t. · No, N as in Nancy.'],
    nd_qhalf: ['Of course. What would you like to know?', '무엇을 묻는지 첫마디에 → I\'m calling to ask about your swimming lessons.'], nd_inq: ['Oh — you\'d like to ask about our lessons?', 'inquiry는 이름씨 → I\'m calling to ask about …'],
    in_ok: ['Sure. Did you get all that?', '요일 · 값은 되짚어요 → So, … $40 a month?'], ms_lit: ['Sorry — you\'d like to leave a message?', '내가 남길 때 → Yes, please.'],
    nb_hp: ['Your… cell phone? Sorry, what\'s the number?', 'handphone → cell phone · 번호만 → It\'s 555-0139.'], nc_wasnt: ['Sorry — so that\'s not right?', 'Is that …? → No, it isn\'t.'],
    br_ok: ['No problem. Did you get the day?', '준비물 · 요일은 되짚어요 → So, … on Tuesday?'],
  };
  PN.BAD_REACT = BAD_REACT;
  PN.REACT = {
    ok: ['Okay.', 'Great.', 'Alright.', 'Sure.', 'Got it.'],
    1: q => ({ en: `Sorry — ${q.short && /\?$/.test(q.short) ? q.short : (String(q.en).match(/[^.!?]*\?/g) || [String(q.en)]).pop().trim()}`, ko: q.shape === 'or' || q.shape === 'wh' ? `${PN.SHAPE[q.shape].ko} → ${PN.SHAPE[q.shape].ans}` : `‘${q.key.join(' … ')}’를 말했어요.` }),
    2: (q, j, a, C) => {
      C = Object.assign({}, C || {}, (q && q.fact) || {});   // 들은 값(시각 · 수업 안내 · 준비물 · 되짚은 철자 · 번호)은 상대의 말에 있어요
      const F = a && PN.FRAME[a.f], b = F && BAD_REACT[F.id];
      if (b) return { en: b[0], ko: b[1] };
      if (F && F.line) { const fx = PN.fixLine(a.line, C || {}); return { en: fx.en, ko: fx.ko }; }
      if (j.tag === 'fact') {
        if (q.intent === 'offer') return { en: `No — ${C.time}.`, ko: '들은 시각과 달라요.' };
        if (q.intent === 'info') return { en: `No — ${PN.infoText(C.info)}.`, ko: '들은 요일 · 값과 달라요.' };
        if (q.intent === 'bring') return { en: `No — ${PN.bringText(C.bring)}.`, ko: '들은 준비물 · 요일과 달라요.' };
        if (q.intent === 'check') return C.hok ? { en: 'Oh — so how do you spell it?', ko: '상대가 맞게 되짚었어요.' } : { en: `Great, so that's ${PN.wrongSpell(C.sur)}.`, ko: '잘못 들은 철자가 그대로 적혀요.' };
        if (q.intent === 'pcheck') return C.pok ? { en: 'Oh — what\'s the right number, then?', ko: '상대가 맞게 되짚었어요.' } : { en: `Great, so that's ${PN.phoneText(C.heard)}.`, ko: '잘못 받아 적은 번호가 그대로 적혀요.' };
        if (q.intent === 'answer') return { en: 'Oh, sorry — I must have the wrong number.', ko: '상대가 찾는 사람이 바로 나예요.' };
        if (q.intent === 'end') return { en: 'Sure — what is it?', ko: '더 물어볼 것은 없어요.' };
        if (q.intent === 'name' || q.intent === 'spell') return { en: 'Sorry — could you say your name again?', ko: '카드의 이름 · 철자를 다시 보세요.' };
        if (q.intent === 'nb') return { en: 'Hmm, is that right?', ko: '카드의 전화번호를 다시 보세요.' };
        return { en: 'Hmm, are you sure?', ko: '내 카드(또는 상대가 한 말)를 다시 보세요.' };
      }
      if (j.tag === 'need') return q.intent === 'spell' ? { en: 'Great — go ahead.', ko: '바로 철자를 불러요.' } : q.intent === 'check' ? { en: 'Oh — so what\'s the right letter?', ko: '맞는 글자를 as in과 함께 다시 불러요.' }
        : q.intent === 'pcheck' ? { en: 'Oh — what\'s the right number?', ko: '맞는 번호를 다시 불러요.' } : q.intent === 'end' ? { en: 'Okay…?', ko: '고맙다는 말과 끝인사를 덧붙여요.' }
        : q.intent === 'need' ? { en: 'Sure… and how can I help?', ko: '용건을 첫마디에 말해요.' } : { en: 'Sure — do you want to check that?', ko: '들은 것을 되짚어 확인해요.' };
      if (j.tag === 'wrong') return { en: 'Sorry?', ko: '질문의 첫 낱말과 짝이 맞는 대답을 해요.' };
      return { en: 'Sorry?', ko: '알아듣기 어려운 말이에요.' };
    },
    3: (q) => q && q.intent === 'answer' ? { en: 'Oh — this is Matt Diaz, the swim coach.', ko: '뜻은 통했지만 퉁명스럽게 들려요.' } : { en: '... Okay.', ko: '뜻은 통했지만 말투가 거칠어요.' },
  };
  // 대답 뒤 상대가 덧붙이는 말 (다음 질문 앞)
  PN.reply = function (q, a, C) {
    C = Object.assign({}, C || {}, (q && q.fact) || {});
    const time = C.time || (C.meal && C.alt ? PN.offerOf(C) : '8:15');
    switch (q.intent) {
      case 'need': return (C.task || (q.fact && q.fact.task)) === 'ask' ? 'Sure!' : 'Sure, I can help you with that.';
      case 'meal': return 'Great.';
      case 'ppl': return 'Okay.';
      case 'when': return 'Let me check…';
      case 'full': return 'Let me see…';
      case 'offer': return 'That\'s right.';
      case 'name': return 'Thank you.';
      case 'spell': return 'Okay, let me write that down.';
      case 'check': return `${C.hok ? 'Perfect.' : 'Sorry about that.'} You're all set for ${PN.DAYS[C.day || 'fri'].t} at ${time}. See you then!`;
      case 'level': return 'Okay, let me check.';
      case 'info': return 'That\'s right. Let me put you through to the swim office. Please hold.';
      case 'msg': return a && a.f === 'line' ? PN.fixLine(a.line, C).en : 'Sure.';
      case 'go': return a && a.f === 'line' ? PN.fixLine(a.line, C).en : 'Okay.';
      case 'nb': return 'Thank you.';
      case 'pcheck': return `${C.pok ? 'Great.' : 'Sorry about that.'} He'll call you back this afternoon.`;
      case 'answer': return 'Hi! I got your message.';
      case 'bring': { const b = PN.bringParse(C.bring || 'gog.tue'); return `That's right. See you on ${PN.WDAYS[b.day].t}!`; }
      case 'end': return 'You\'re welcome. Bye!';
      default: return null;
    }
  };

  /* =========================================================
     듣고 대답 고르기 16문제 (모두 새로 만든 대화). card = 그 상황의 사실
     ========================================================= */
  const o = (f, v) => { const a = { f }; if (v != null) a.v = String(v); return a; };
  const L = (words, name) => ({ f: 'line', line: name ? { words, name } : { words } });
  PN.o = o; PN.L = L;
  PN.DRILL = [
    { q: 'bk_help', sit: '식당에 전화했어요. 금요일에 예약하고 싶어요.', card: { day: 'fri' }, a: 2, opts: [o('nd_rsv', 'fri'), o('nd_book', 'sat'), o('nd_book', 'fri'), o('g_yes')] },
    { q: 'bk_meal', sit: '점심을 먹으려고 해요.', card: { meal: 'lunch' }, a: 0, opts: [o('ml_pl', 'lunch'), o('g_yesp'), o('ml_pl', 'dinner'), o('pp_for', 4)] },
    { q: 'bk_ppl', sit: '친구 둘과 함께 가요(모두 세 명).', card: { ppl: 3 }, a: 3, opts: [o('pp_lit', 3), o('g_yes'), o('pp_for', 4), o('pp_for', 3)] },
    { q: 'tm_full', sit: '7시는 다 찼대요. 더 늦은 시간도 괜찮아요.', card: { alt: 'later' }, a: 1, opts: [o('tm_ok'), o('fl_alt', 'later'), o('tm_lit'), o('fl_alt', 'earlier')] },
    { q: 'tm_fast', sit: '직원이 아주 빠르게 말했어요. 빈 시간을 알려 준 것 같은데 시각을 못 알아들었어요.', card: {}, a: 2, opts: [o('of_so', '8:15'), o('of_ok'), o('rp_time'), o('rp_nb')] },
    { q: 'tm_offer', sit: '직원이 빈 시각을 알려 줬어요. 제대로 들었는지 확인하고 싶어요.', card: {}, a: 3, opts: [o('of_so', '8:50'), o('of_ok'), o('g_yes'), o('of_so', '8:15')] },
    { q: 'nm_name', sit: '예약자 이름은 한지우(Jiwoo Han)예요.', card: { sur: 'han' }, a: 0, opts: [o('nm_is', 'han'), o('nm_lit', 'han'), o('g_yes'), o('nm_is', 'kim')] },
    { q: 'nm_spell', sit: '성은 Han(H-A-N)이에요. N은 전화에서 M과 헷갈리기 쉬워요.', card: { sur: 'han' }, a: 1, opts: [o('g_yesp'), o('sp_it', 'han'), o('sp_it', 'han~w'), o('sp_name', 'han')] },
    { q: 'nm_check', sit: '성은 Han(H-A-N)이에요. 직원이 철자를 되짚었어요.', card: { sur: 'han' }, a: 2, opts: [o('ck_yes'), o('ck_isnt', 'N'), o('ck_no', 'N'), o('g_no')] },
    { q: 'as_help', sit: '스포츠 센터에 전화했어요. 수영 강습에 대해 묻고 싶어요.', card: { topic: 'swim' }, a: 3, opts: [o('nd_inq', 'swim'), o('nd_tell', 'swim'), o('nd_qhalf'), o('nd_ask', 'swim')] },
    { q: 'as_level', sit: '중급 반에 관심이 있어요.', card: { lvl: 'int' }, a: 0, opts: [o('lv_pl', 'int'), o('g_yes'), o('lv_pl', 'beg'), o('rp_again')] },
    { q: 'as_fast', sit: '직원이 아주 빠르게 말했어요. 수업 요일과 값을 알려 준 것 같은데 잘 못 들었어요.', card: {}, a: 1, opts: [o('in_so', 'beg~p'), o('rp_info'), o('in_ok'), o('rp_bring')] },
    { q: 'ms_out', sit: '코치가 자리에 없대요. 초급 반 일로 다시 전화해 달라는 메시지를 남기고 싶어요. 내 번호는 555-0139예요.', card: { lvl: 'beg', phone: '0139', msg: true }, a: 2, opts: [o('ms_lit'), o('ms_no'), L(['this', 'abeg', 'cab', 'p0139']), L(['abeg', 'cab', 'p0139'])] },
    { q: 'nb_ask', sit: '내 휴대폰 번호는 555-0162예요.', card: { phone: '0162' }, a: 3, opts: [o('nb_hp', '0162'), o('g_yes'), o('nb_is', '0126'), o('nb_is', '0162')] },
    { q: 'cb_hi', sit: '모르는 번호로 전화가 왔어요. 내가 지우(Jiwoo)예요.', card: { given: 'Jiwoo' }, a: 0, opts: [o('cb_sp'), o('cb_who'), o('g_no'), o('rp_place')] },
    { q: 'cb_cut', sit: '코치의 목소리가 중간중간 끊겨서 무엇을 가져오라는지 못 들었어요.', card: {}, a: 1, opts: [o('br_so', 'gog.tue'), o('rp_break'), o('br_ok'), o('rp_nb')] },
  ];
  PN.DRILL.forEach((it, i) => { it.n = i; it.Q = PN.Q[it.q]; it.place = it.Q.place; });
  // 직접 해 보기의 짧은 문제 (00장 · 05장 · 07장) — 연습 문제와 다른 상황
  PN.MINI = {
    intro: { q: 'bk_help', sit: '식당에 전화했어요. 토요일에 예약하고 싶어요.', card: { day: 'sat' }, a: 1, opts: [o('nd_book', 'fri'), o('nd_book', 'sat'), o('nd_rsv', 'sat'), o('g_yesp')] },
    level: { q: 'as_level', sit: '수영을 처음 배워요(초급 반).', card: { lvl: 'beg' }, a: 0, opts: [o('lv_pl', 'beg'), o('lv_pl', 'int'), o('g_yesp'), o('rp_again')] },
    number: { q: 'nb_ask', sit: '내 휴대폰 번호는 555-0185예요.', card: { phone: '0185' }, a: 2, opts: [o('nb_is', '0158'), o('nb_hp', '0185'), o('nb_is', '0185'), o('g_yes')] },
  };
  Object.values(PN.MINI).forEach(it => { it.Q = PN.Q[it.q]; it.place = it.Q.place; });

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 내 카드
     ========================================================= */
  // 02–04장 식당: 금요일 저녁 · 네 명 · 7시(다 참) → 더 늦은 시간(8:15) · 한지우(Han, N as in Nancy) — 직원이 M으로 잘못 되짚음
  // 05–07장 스포츠 센터: 수영 강습 · 초급 반(화 · 목 6–7시, 한 달 40달러) · 코치가 없음 → 메시지 · 555-0139 — 사무실이 0193으로 잘못 되짚음
  // 08장 코치의 전화: 수영복과 물안경 · 첫 수업 화요일
  PN.DEMO = { day: 'fri', meal: 'dinner', ppl: 4, want: 7, alt: 'later', offer: 0, sur: 'han', given: 'Jiwoo', hok: false, topic: 'swim', lvl: 'beg', msg: true, phone: '0139', pok: false, item: 'gog' };
  PN.LINE = { words: PN.lineWords(PN.DEMO), name: PN.fullName(PN.DEMO) };
  // 00장: 첫마디에 용건을 · 잘못 되짚은 철자는 바로잡기 · 들은 시각은 되짚기
  PN.INTRO = { q: 'bk_help', bad: o('nd_rsv', 'fri'), ok: o('nd_book', 'fri'), card: { day: 'fri' },
    dq: 'nm_check', dbad: o('ck_yes'), dok: o('ck_no', 'N'), rq: 'tm_offer', skip: o('of_ok'), check: o('of_so', '8:15') };
  PN.SCENE = {
    // 02장 예약 전화 걸기: 첫마디 용건 · 점심/저녁 · 사람 수 · 빠른 첫마디
    need: ['bk_help', o('nd_rsv', 'fri'), o('nd_bhalf', 'fri'), o('nd_bblunt', 'fri'), o('nd_book', 'fri')],
    meal: ['bk_meal', o('g_yesp'), o('ml_pl', 'lunch'), o('ml_pl', 'dinner')],
    ppl: ['bk_ppl', o('pp_lit', 4), o('g_yes'), o('pp_for', 4)],
    bfast: ['bk_fast', o('nd_book', 'fri'), o('rp_place')],
    // 03장 시간 맞추기: 시각 · 다 참 → 다른 시간 · 빈 시각 되짚기
    when: ['tm_when', o('g_yes'), o('wn_at', 7)],
    full: ['tm_full', o('g_yes'), o('tm_ok'), o('tm_lit'), o('fl_alt', 'later')],
    offer: ['tm_offer', o('of_ok'), o('of_so', '8:50'), o('of_so', '8:15')],
    ofast: ['tm_fast', o('of_so', '8:15'), o('rp_time')],
    // 04장 이름 철자: 이름 · 철자(as in) · 잘못 되짚은 글자 바로잡기
    name: ['nm_name', o('nm_lit', 'han'), o('g_yes'), o('nm_is', 'han')],
    spell: ['nm_spell', o('g_yesp'), o('sp_name', 'han'), o('sp_it', 'han~b'), o('sp_it', 'han')],
    check: ['nm_check', o('ck_yes'), o('ck_isnt', 'N'), o('g_no'), o('ck_no', 'N')],
    // 05장 문의 전화 걸기: 용건 · 반 고르기(모르는 낱말 묻기) · 수업 안내 되짚기
    help: ['as_help', o('nd_inq', 'swim'), o('nd_qhalf'), o('nd_tell', 'swim'), o('nd_ask', 'swim')],
    level: ['as_level', o('g_yesp'), o('rp_wint'), o('lv_pl', 'beg')],
    info: ['as_info', o('in_ok'), o('in_so', 'beg~p'), o('in_so', 'beg~d'), o('in_so', 'beg')],
    ifast: ['as_fast', o('in_so', 'beg'), o('rp_info')],
    // 06장 메시지 남기기: 남기겠다는 대답 · 메시지 한 줄
    out: ['ms_out', o('ms_lit'), o('g_yesp')],
    lines: [['here', L(['here', 'abeg', 'cab', 'p0139'])], ['tell', L(['this', 'abeg', 'tell', 'p0139'])], ['nowho', L(['abeg', 'cab', 'p0139'])], ['noabout', L(['this', 'cab', 'p0139'])], ['order', L(['this', 'abeg', 'p0139', 'cab'])], ['nonum', L(['this', 'abeg', 'cab'])], ['late', L(['abeg', 'this', 'cab', 'p0139'])], ['ok', L(PN.LINE.words)]],
    go: ['ms_go', o('g_yes'), o('ms_no'), L(PN.LINE.words)],
    mfast: ['ms_fast', o('g_yesp'), o('rp_msg')],
    // 07장 전화번호: 번호(0은 oh) · 빠른 질문 · 잘못 되짚은 번호 바로잡기
    nb: ['nb_ask', o('nb_hp', '0139'), o('g_yes'), o('nb_is', '0193'), o('nb_is', '0139')],
    nbfast: ['nb_fast', o('nb_is', '0139'), o('rp_nb')],
    pcheck: ['nb_check', o('nc_yes'), o('g_no'), o('nc_wasnt', '0139'), o('nc_no', '0139')],
    // 08장 걸려 온 전화: 받기 · 끊긴 말 · 준비물 되짚기 · 끝인사
    hi: ['cb_hi', o('cb_who'), o('g_no'), o('cb_is'), o('cb_sp')],
    cut: ['cb_cut', o('br_so', 'gog.tue'), o('rp_break')],
    bring: ['cb_bring', o('br_ok'), o('br_so', 'gog.thu'), o('br_so', 'gog.tue')],
    end: ['cb_end', o('g_yes'), o('en_plain'), o('en_no')],
  };
  // 09장: 곳마다 한 줄 (3단계 적용)
  PN.METHOD = [
    ['bk_help', o('nd_book', 'fri'), {}],
    ['tm_offer', o('of_so', '8:15'), {}],
    ['nm_check', o('ck_no', 'N'), {}],
    ['as_help', o('nd_ask', 'swim'), {}],
    ['ms_go', L(PN.LINE.words, PN.LINE.name), {}],
    ['nb_check', o('nc_no', '0139'), {}],
    ['cb_hi', o('cb_sp'), {}],
  ];
  // 10장 실전: 내 카드 하나로 넷 (보기 셋, 단계마다 지워짐)
  PN.PCARD = { day: 'sat', meal: 'lunch', ppl: 2, want: 12, alt: 'earlier', offer: 1, sur: 'park', given: 'Minji', hok: true, topic: 'swim', lvl: 'int', msg: true, phone: '0147', pok: true, item: 'cap' };
  PN.PRACTICE = [
    { q: 'bk_meal', opts: [o('g_yesp'), o('ml_pl', 'dinner'), o('ml_pl', 'lunch')], a: 2,
      lines: ['lunch … or … dinner → 고르는 질문 · (A) Yes, please. → 무엇을 골랐는지 알 수 없어 탈락', '(B) dinner → 카드(점심)와 달라 탈락', '남은 보기는 공손해요 · 정답 (C) Lunch, please.'] },
    { q: 'tm_offer', opts: [o('g_yes'), o('of_so', '11:13'), o('of_so', '11:30')], a: 2,
      lines: ['11:30 → 빈 시각을 알려 주는 안내 · (A) Yes. → 묻는 말이 아니라 탈락', '(B) 11:13 → 들은 시각(11:30)과 달라 탈락 · eleven-THIRty와 eleven-thirTEEN', '남은 보기는 들은 시각을 되짚어요 · 정답 (C) So, 11:30?'] },
    { q: 'ms_go', opts: [L(['this', 'aint', 'tell', 'p0147'], 'Minji Park'), L(['this', 'abeg', 'cab', 'p0147'], 'Minji Park'), L(['this', 'aint', 'cab', 'p0147'], 'Minji Park')], a: 2,
      lines: ['Go ahead → 메시지를 말하라는 말 · 셋 모두 누구 → 무슨 일 → 부탁 → 번호 차례예요', '(B) beginner → 카드(중급 반)와 달라 탈락', '(A) Tell him … → 명령처럼 들려 탈락 · 정답 (C) This is Minji Park. I\'m calling about the intermediate swimming class. Could you ask him to call me back at 555-0147?'] },
    { q: 'nb_check', opts: [o('rp_again'), o('nc_no', '0174'), o('nc_yes')], a: 2,
      lines: ['read that back … Is that right? → Yes/No 질문 · (A) 다시 묻기 → 알아들었는데 다시 물어 탈락', '(B) No → 상대가 맞게 되짚었는데(555-0147) 아니라고 해서 탈락', '남은 보기는 짧고 분명해요 · 정답 (C) Yes, that\'s right.'] },
  ];
  PN.practiceQ = p => PN.simQ(p.q, PN.PCARD);

  /* ---------- 이어서 들리는 말 (02 · 05장). 대문자 = 세게 ---------- */
  PN.LINKED = [
    { q: 'bk_meal', en: 'Lunch or dinner?', say: 'Lunch or dinner?', words: ['Lunch', 'or', 'dinner?'], sound: [['LUN', 1], ['chor', 0], ['DIN', 1], ['ner', 0]], link: [[0, 1]], ko: 'lunch or → lun-chor처럼 이어져요 · 고를 것(LUNCH · DINner)을 세게' },
    { q: 'as_level', en: 'Beginner or intermediate?', say: 'Beginner or intermediate?', words: ['Beginner', 'or', 'intermediate?'], sound: [['be', 0], ['GIN', 1], ['ne', 0], ['ror', 0], ['in', 0], ['ter', 0], ['ME', 1], ['di', 0], ['ate', 0]], link: [[0, 1]], ko: 'beginner or → be-gin-ne-ror처럼 이어져요 · 고를 것(beGINner · interMEdiate)을 세게' },
  ];
  // 헷갈리는 숫자 짝 (03 · 05장): 앞이 세면 -ty, 뒤가 세면 -teen
  PN.PAIRS = [['8:15', 'eight-fifTEEN', '8:50', 'eight-FIFty'], ['$14', 'fourTEEN', '$40', 'FORty'], ['$15', 'fifTEEN', '$50', 'FIFty']];
  // 전화에서 헷갈리는 글자 짝 (04장): as in + 흔한 이름
  PN.ALPHA = [['M', 'Mary', 'N', 'Nancy'], ['B', 'Bob', 'P', 'Peter'], ['F', 'Frank', 'S', 'Sam']];

  /* ---------- 직접 해 보기 자료 ---------- */
  PN.SHAPE_QS = PN.simQs();

  /* =========================================================
     따라 말하기 28문장 (곳마다 상대 · 나의 말 넷)
     ========================================================= */
  const SW = (place, who, en, ko, sp) => ({ place, who, en, ko, sp: who === 'me' ? 'me' : sp || PN.PLACE[place].sp });
  PN.SHADOW = [
    SW('book', 'staff', 'Lantern Bistro, this is Ben. How can I help you?', '(미국) 랜턴 비스트로, 벤입니다. 무엇을 도와드릴까요?'),
    SW('book', 'me', 'Hi, I\'d like to make a reservation for Friday, please.', '안녕하세요, 금요일 예약을 하고 싶어요.'),
    SW('book', 'staff', 'Sure. Is that for lunch or dinner?', '네. 점심인가요, 저녁인가요?'),
    SW('book', 'me', 'Dinner, please.', '저녁으로 할게요.'),
    SW('time', 'staff', 'I\'m sorry, we\'re fully booked at 7.', '죄송하지만 7시는 자리가 다 찼어요.'),
    SW('time', 'me', 'Oh, I see. Do you have anything later?', '아, 그렇군요. 더 늦은 시간 있나요?'),
    SW('time', 'staff', 'We have a table at 8:15.', '8시 15분에 자리가 있어요.'),
    SW('time', 'me', 'So, 8:15?', '그러니까 8시 15분이죠?'),
    SW('name', 'staff', 'Great. And what name is the reservation under?', '좋아요. 예약은 어느 분 이름으로 할까요?'),
    SW('name', 'me', 'It\'s Han.', '한이에요.'),
    SW('name', 'staff', 'Was that M as in Mary?', 'Mary의 M이었나요?'),
    SW('name', 'me', 'No, N as in Nancy.', '아니요, Nancy의 N이에요.'),
    SW('ask', 'staff', 'Kellport Sports Center, Grace speaking. How can I help you?', '(캐나다) 켈포트 스포츠 센터, 그레이스입니다. 무엇을 도와드릴까요?'),
    SW('ask', 'me', 'Hi, I\'m calling to ask about your swimming lessons.', '안녕하세요, 수영 강습에 대해 물어보려고 전화했어요.'),
    SW('ask', 'staff', 'The beginner class is on Tuesdays and Thursdays from 6 to 7, and it\'s $40 a month.', '초급 반은 화요일과 목요일 6시에서 7시이고, 한 달에 40달러예요.'),
    SW('ask', 'me', 'So, Tuesdays and Thursdays from 6 to 7, $40 a month?', '그러니까 화요일과 목요일 6시에서 7시, 한 달에 40달러죠?'),
    SW('msg', 'staff', 'I\'m afraid Coach Diaz isn\'t in right now. Would you like to leave a message?', '(영국) 죄송하지만 디아스 코치가 지금 자리에 없어요. 메시지를 남기시겠어요?'),
    SW('msg', 'me', 'Yes, please.', '네, 남길게요.'),
    SW('msg', 'staff', 'Of course. Go ahead.', '그럼요. 말씀하세요.'),
    SW('msg', 'me', PN.lineText(PN.LINE), PN.lineKo(PN.LINE)),
    SW('number', 'staff', 'And what\'s the best number to reach you?', '연락드릴 번호는 어떻게 되세요?'),
    SW('number', 'me', 'It\'s 555-0139.', '555-0139예요.'),
    SW('number', 'staff', 'Let me read that back. 555-0193. Is that right?', '다시 불러 볼게요. 555-0193. 맞나요?'),
    SW('number', 'me', 'No, it isn\'t. It\'s 555-0139.', '아니요. 555-0139예요.'),
    SW('call', 'staff', 'Hi, this is Matt Diaz from Kellport Sports Center. Is this Jiwoo?', '(호주) 안녕하세요, 켈포트 스포츠 센터의 맷 디아스예요. 지우 씨인가요?'),
    SW('call', 'me', 'Yes, speaking.', '네, 전데요.'),
    SW('call', 'me', 'Sorry, you\'re breaking up. Could you say that again?', '죄송한데, 소리가 끊겨요. 다시 말씀해 주시겠어요?'),
    SW('call', 'me', 'No, that\'s all. Thanks for calling back. Bye!', '아니요, 그게 다예요. 다시 전화 주셔서 고마워요. 안녕히 계세요!'),
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: key 열쇠 낱말 · frame 대답 틀 · slot 내 정보 · pol 공손한 말 · trap 함정 · ok 정답
     ========================================================= */
  const LL = k => `(${L4[k]})`;
  PN.judgeItem = (it, k) => PN.judge(it.Q, it.opts[k], it.card, '상황');
  const CARD_SKIP = { task: 1, letter: 1, msg: 1 };
  const cardSay = c => Object.keys(c || {}).filter(k => !CARD_SKIP[k] && c[k] !== undefined).map(k => PN.factKo(k, c[k])).join(' · ');
  const segMarks = (a, k, roleOf) => PN.segs(a).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).map(s => ({ t: s.t.trim().replace(/^[,.?!]+|[,.?!]+$/g, ''), role: roleOf(s), at: k })).filter(m => m.t);
  const tagKo = j => j.tag === 'fact' ? '상황 · 들은 말과 다른 정보' : j.tag === 'need' ? '용건 · 정보가 빠지거나 되짚지 않음' : j.tag === 'order' ? '순서가 뒤섞임' : j.tag === 'wrong' ? '틀린 문장 · 짝이 맞지 않는 대답' : '한국어 그대로 옮긴 말 · 콩글리시';
  PN.steps = function (it) {
    const q = it.Q, J = it.opts.map((_, k) => PN.judgeItem(it, k)), at = s => it.opts.map((_, k) => k).filter(k => J[k].stage === s);
    const best = it.opts[it.a], SHp = PN.SHAPE[q.shape], C = PN.ctx(it.card, q);
    // ①
    let t1;
    if (q.fast) t1 = `${q.cut ? '소리가 끊겨서' : '너무 빨라서'} 열쇠 낱말을 못 잡았어요. 무엇을 말했는지 모르면 짐작해서 답하지 말고 다시 물어요. 들린 낱말이 있으면 그 부분만 되물어요.`;
    else t1 = `열쇠 낱말 ${q.key.join(' … ')} → ${SHp.ko}(${SHp.mark}). ${PN.sayOf(q.intent)}. ${PN.INTENT[q.intent].want}`;
    if (at(1).length) t1 += ' ' + at(1).map(k => LL(k)).join(' · ') + (q.fast ? ' → 짐작한 대답이거나 다른 말을 되물어 탈락.' : J[at(1)[0]].tag === 'shape' ? ' → 모양이 맞지 않거나 다른 질문의 대답이라 탈락.' : ' → 다른 질문에 맞는 대답이라 탈락.');
    const m1 = q.fast ? [] : q.key.map(t => ({ t, role: 'key', at: 'q' }));
    at(1).forEach(k => m1.push({ t: PN.text(it.opts[k]).replace(/[.?!]$/, ''), role: 'trap', at: k }));
    // ②
    const sit = cardSay(it.card);
    const Fb = PN.FRAME[best.f], ft = Fb.line ? '누구(This is + 이름). 무슨 일(I\'m calling about …). 부탁(Could you ask him to call me back) + 번호(at …)?' : Fb.t ? Fb.t.replace(/[{}]/g, '').replace('___', '…') : PN.text(best);
    let t2 = (q.fast ? '상황 → 처음 듣고 다 알아듣지 못했어요. ' : sit ? `상황 → ${sit}. ` : '') + `맞는 틀 → ${ft}`;
    if (at(2).length) t2 += ' · ' + at(2).map(k => `${LL(k)} ${tagKo(J[k])}`).join(' · ') + ' → 탈락.';
    else t2 += ' · 틀과 정보가 모두 맞는 보기만 남았어요.';
    const m2 = [];
    it.opts.forEach((a, k) => {
      if (J[k].stage === 1) return;
      const F = PN.FRAME[a.f];
      if (F.line) {
        const lo = PN.checkLine(a.line, C), wrong = lo.err ? lo.err.word.t : null, badW = (a.line.words || []).map(w => PN.OW[w]).find(x => x && x.bad);
        PN.lineSegs(a.line).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).forEach(s => { const t = s.t.trim(); m2.push({ t, role: J[k].stage === 2 && (t === wrong || (badW && badW.bad === 'literal' && t === badW.t) || (lo.tag === 'order' && s.part)) ? 'trap' : s.r === 'frame' ? 'frame' : s.r === 'pol' ? 'frame' : 'slot', at: k }); });
        return;
      }
      const trapOf = s => J[k].stage !== 2 ? false : J[k].tag === 'fact' ? (F.slot ? s.r === 'slot' : s.r === 'frame') : s.r === 'frame' || s.r === 'slot';
      segMarks(a, k, s => s.r === 'pol' ? '' : trapOf(s) ? 'trap' : s.r).forEach(m => { if (m.role) m2.push(m); });
    });
    // ③
    let t3 = at(3).length ? at(3).map(k => `${LL(k)} ${PN.text(it.opts[k])} → ${J[k].tag === 'plain' ? '고맙다는 말 없이 끊김' : '명령 · 퉁명스러운 말'}`).join(' · ') + ' → 탈락. ' : '무례하게 들리는 보기는 없어요. ';
    t3 += `정답 ${LL(it.a)} → ${J[it.a].why}`;
    const m3 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 3) segMarks(a, k, () => 'trap').forEach(m => m3.push(m)); else if (J[k].stage === 0) segMarks(a, k, s => s.r === 'pol' ? 'pol' : '').forEach(m => { if (m.role) m3.push(m); }); });
    m3.push({ t: PN.text(it.opts[it.a]), role: 'ok', at: it.a, whole: true });
    return [
      { head: '① 열쇠 낱말 + 질문의 모양 잡기', text: t1, marks: m1 },
      { head: '② 틀에 내 정보 넣기', text: t2, marks: m2 },
      { head: '③ 공손하게 끝내기', text: t3, marks: m3 },
    ];
  };
  PN.notes = it => it.opts.map((_, k) => { const j = PN.judgeItem(it, k); return (j.ok ? '' : `× ${['', '①', '②', '③'][j.stage]} `) + j.why; });

  /* =========================================================
     데이터 점검 — 문제 데이터와 엔진이 어긋나면 콘솔 경고
     ========================================================= */
  PN.check = function () {
    const bad = [];
    const hasT = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase());
    Object.values(PN.Q).forEach(q => {
      if (!PN.PLACE[q.place]) bad.push(`말 ${q.id}: 곳 ${q.place}가 없어요`);
      if (!PN.INTENT[q.intent]) bad.push(`말 ${q.id}: 뜻 ${q.intent}가 없어요`);
      q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`말 ${q.id}: 열쇠 낱말 ‘${k}’가 말에 없어요`); });
      if (PN.shapeGuess(q.en) !== q.shape) bad.push(`말 ${q.id}: 적어 둔 모양 ${q.shape} · 글의 모양 ${PN.shapeGuess(q.en)}`);
      if (q.shape === 'or') { if (!q.choices || q.choices.length < 2) bad.push(`말 ${q.id}: 고르는 질문에 choices가 없어요`); else { const In = PN.INTENT[q.intent], S = Object.values(PN.SLOT).find(s => s.key === In.key); q.choices.forEach(c => { if (!S || !S.vals[c]) bad.push(`말 ${q.id}: 고를 것 ${c}가 칸에 없어요`); }); } }
      if (q.shape === 'yn' && !q.fast && !q.aux && !PN.INTENT[q.intent].offer) bad.push(`말 ${q.id}: Yes/No 질문에 짝(aux)이 없어요`);
      if (q.aux) { const first = String(q.en).match(/[^.!?]*\?/g).pop().trim().split(/\s+/)[0].toLowerCase(); if (!q.fast && first !== PN.AUX_FIRST[q.aux]) bad.push(`말 ${q.id}: 짝 ${q.aux} · 첫 낱말 ${first}`); }
      if (q.intent === 'need' && !(q.fact && q.fact.task)) bad.push(`말 ${q.id}: 용건 질문에 곳(task)이 없어요`);
      if (q.fast && !PN.FRAME[ECHO_OF[q.intent]]) bad.push(`말 ${q.id}: 빠른 말을 되묻는 틀이 없어요`);
    });
    Object.values(PN.FRAME).forEach(F => {
      [].concat(F.intent).forEach(i => { if (i !== 'yn' && i !== 'repair' && !PN.INTENT[i]) bad.push(`틀 ${F.id}: 뜻 ${i}가 없어요`); });
      if (F.slot && !PN.SLOT[F.slot]) bad.push(`틀 ${F.id}: 칸 ${F.slot}이 없어요`);
      if (F.slot && !/___/.test(F.t)) bad.push(`틀 ${F.id}: 칸이 있는데 ___가 없어요`);
      if ((F.tag !== 'ok' || F.half || F.skip) && !F.why) bad.push(`틀 ${F.id}: 함정 틀에 까닭(why)이 없어요`);
      if (F.aux && !PN.AUX[F.aux]) bad.push(`틀 ${F.id}: 짝 ${F.aux}가 없어요`);
      if (F.slot && /___/.test(F.ko)) { const v = PN.SLOT[F.slot].dyn ? { time: '8:15', spell: 'han', letter: 'N', info: 'beg', phone: '0139', bring: 'gog.tue' }[PN.SLOT[F.slot].dyn] : slotIds(F.slot)[0]; const k = PN.ko({ f: F.id, v }); if (/___|\s\./.test(k)) bad.push(`틀 ${F.id}: 해석이 어색해요 (${k})`); }
    });
    Object.entries(PN.INTENT).forEach(([k, In]) => { if (In.best && typeof In.best === 'string' && !PN.FRAME[In.best]) bad.push(`뜻 ${k}의 모범 틀 ${In.best}가 없어요`); });
    Object.values(PN.OW).forEach(w => { if (!PN.OCAT[w.c]) bad.push(`메시지 조각 ${w.t}: 갈래 ${w.c}가 없어요`); if (w.bad && !w.why) bad.push(`메시지 조각 ${w.t}: 까닭이 없어요`); });
    // 숫자 읽기 · 함정 숫자
    [['8:15', 'eight-fifteen'], ['11:30', 'eleven-thirty'], ['1:15', 'one-fifteen'], ['5:30', 'five-thirty'], ['7', 'seven'], ['12', 'twelve']].forEach(([t, w]) => { if (PN.timeWords(t) !== w) bad.push(`시각 읽기 ${t}: ${PN.timeWords(t)}`); });
    if (PN.phoneWords('555-0139') !== 'five-five-five, oh-one-three-nine') bad.push(`번호 읽기: ${PN.phoneWords('555-0139')}`);
    [['8:15', '8:50'], ['8:30', '8:13'], ['11:30', '11:13'], ['5:15', '5:50']].forEach(([t, w]) => { if (PN.timeTrap(t) !== w) bad.push(`시각 함정 ${t}: ${PN.timeTrap(t)}`); });
    Object.values(PN.OFFERS).forEach(m => Object.values(m).forEach(ts => ts.forEach(t => { if (!PN.timeTrap(t) || ts.includes(PN.timeTrap(t))) bad.push(`빈 시각 함정 ${t}: ${PN.timeTrap(t)}`); })));
    PN.PHONES.forEach(p => { const s = PN.phoneSwap(p); if (s === p || PN.PHONES.includes(s)) bad.push(`번호 함정 ${p}: ${s}`); });
    PN.LVL_IDS.forEach(l => { const P = PN.LEVELS[l].price, s = PN.teenSwap(P); if (!s || PN.LVL_IDS.some(x => PN.LEVELS[x].price === s)) bad.push(`값 함정 ${l}: ${s}`); if (PN.dayTrap(PN.LEVELS[l].first) === PN.LEVELS[l].first) bad.push(`요일 함정 ${l}`); });
    PN.SUR_IDS.forEach(id => { const n = PN.NAMES[id]; if (!n.spell.includes(n.L) || n.spell.includes(n.alt) || !PN.AS[n.L] || !PN.AS[n.alt]) bad.push(`철자 함정 ${id}`); });
    [['eight fifteen', '815'], ['five five five oh one three nine', '5550139'], ['555-0139', '5550139'], ['five-five-five, oh-one-three-nine', '5550139'], ['forty dollars', '40'], ['eleven thirty', '1130'], ['fourteen', '14'], ['$40', '40']].forEach(([s, r]) => { if (!PN.canon(s).includes(r)) bad.push(`숫자 맞추기 ${s}: ${PN.canon(s).join(' ')}`); });
    [['We have a table at 8:15.', 'We have a table at eight-fifteen.'], ['It\'s 555-0139.', 'It\'s five-five-five, oh-one-three-nine.'],
      ['The beginner class is on Tuesdays and Thursdays from 6 to 7, and it\'s $40 a month.', 'The beginner class is on Tuesdays and Thursdays from six to seven, and it\'s forty dollars a month.'],
      ['Sure. It\'s H-A-N, N as in Nancy.', 'Sure. It\'s H, A, N, N as in Nancy.'], ['I\'m sorry, we\'re fully booked at 7.', 'I\'m sorry, we\'re fully booked at seven.']].forEach(([s, w]) => { if (PN.spoken(s) !== w) bad.push(`읽을 글: ${PN.spoken(s)}`); });
    // 메시지 한 줄: 반 · 번호마다 모범 줄 · 말로 한 줄 · 함정 조각
    PN.LVL_IDS.forEach(lvl => PN.PHONES.forEach(phone => {
      const C = { lvl, phone, given: 'Minji', sur: 'kim' }, ml = PN.modelLine(C), jl = PN.checkLine(ml.line, C);
      if (!jl.ok || jl.note) bad.push(`메시지 한 줄 ${lvl} ${phone}: 모범 줄이 탈락 (${PN.lineText(ml.line)})`);
      [PN.spoken(PN.lineText(ml.line)), PN.lineText(ml.line)].forEach(t => { const pl = PN.parseLine(t); if (JSON.stringify(pl) !== JSON.stringify(ml.line.words)) bad.push(`메시지 한 줄 ${lvl} ${phone}: 말로 한 줄을 다르게 읽어요 (${pl.join(' ')})`); });
      if (PN.coveredBy(PN.lineFacts(ml.line), 'go').join() !== 'go,nb') bad.push(`메시지 한 줄 ${lvl} ${phone}: 번호를 말했는데 ‘가장 좋은 번호’를 건너뛰지 않아요`);
      if (PN.coveredBy(PN.lineFacts(ml.line), 'msg').join() !== 'msg,go,nb') bad.push(`메시지 한 줄 ${lvl} ${phone}: 바로 말한 메시지가 ‘말씀하세요’를 건너뛰지 않아요`);
    }));
    const DC = { lvl: 'beg', phone: '0139' }, lc = (w, words, f) => { const r = PN.checkLine({ words }, DC); if (!f(r)) bad.push(`메시지 한 줄 ${w}: ${JSON.stringify({ ok: r.ok, stage: r.stage, tag: r.tag, note: r.note, err: r.err && r.err.type, missing: r.missing })}`); return r; };
    lc('맞는 줄', PN.LINE.words, r => r.ok && !r.note);
    lc('번호 없이', ['this', 'abeg', 'cab'], r => r.ok && r.note === 'nonum');
    lc('누구가 뒤에', ['abeg', 'this', 'cab', 'p0139'], r => r.ok && r.note === 'late');
    lc('Here is', ['here', 'abeg', 'cab', 'p0139'], r => !r.ok && r.stage === 2 && r.tag === 'literal');
    lc('누구 빠짐', ['abeg', 'cab', 'p0139'], r => !r.ok && r.tag === 'need' && r.missing.join() === 'who');
    lc('무슨 일 빠짐', ['this', 'cab', 'p0139'], r => !r.ok && r.tag === 'need' && r.missing.join() === 'about');
    lc('부탁 빠짐', ['this', 'abeg'], r => !r.ok && r.tag === 'need' && r.missing.join() === 'ask');
    lc('누구만', ['this'], r => !r.ok && r.tag === 'need' && r.missing.join() === 'about,ask');
    lc('번호만 툭', ['this', 'abeg', 'p0139'], r => !r.ok && r.tag === 'order');
    lc('차례', ['this', 'abeg', 'p0139', 'cab'], r => !r.ok && r.tag === 'order');
    lc('두 번', ['this', 'this', 'abeg', 'cab'], r => !r.ok && r.tag === 'order');
    lc('다른 반', ['this', 'aint', 'cab', 'p0139'], r => !r.ok && r.tag === 'fact' && r.err.type === 'lvl');
    lc('다른 번호', ['this', 'abeg', 'cab', 'p0193'], r => !r.ok && r.tag === 'fact' && r.err.type === 'phone');
    lc('Tell him', ['this', 'abeg', 'tell', 'p0139'], r => !r.ok && r.stage === 3 && r.tag === 'blunt');
    if (PN.lineText(PN.LINE) !== 'This is Jiwoo Han. I\'m calling about the beginner swimming class. Could you ask him to call me back at 555-0139?') bad.push(`메시지 한 줄 글: ${PN.lineText(PN.LINE)}`);
    if (PN.lineText({ words: ['this', 'abeg', 'tell', 'p0139'] }) !== 'This is Jiwoo Han. I\'m calling about the beginner swimming class. Tell him to call me back at 555-0139.') bad.push(`메시지 한 줄 글 (Tell him): ${PN.lineText({ words: ['this', 'abeg', 'tell', 'p0139'] })}`);
    if (!/who's calling/.test(PN.fixLine({ words: ['here', 'abeg', 'cab', 'p0139'] }, DC).en)) bad.push('고쳐 주는 말 (Here is)');
    if (!/who's calling/.test(PN.fixLine({ words: ['abeg', 'cab', 'p0139'] }, DC).en)) bad.push('고쳐 주는 말 (누구)');
    if (!/regarding/.test(PN.fixLine({ words: ['this', 'cab', 'p0139'] }, DC).en)) bad.push('고쳐 주는 말 (무슨 일)');
    if (!/message/.test(PN.fixLine(PN.LINE, DC).en)) bad.push('고쳐 주는 말 (맞음)');
    // 연습 문제
    const pos = [0, 0, 0, 0];
    PN.DRILL.forEach((it, i) => {
      const w = `듣고 대답 고르기 ${i + 1}`;
      if (!it.Q) { bad.push(`${w}: 말 ${it.q}가 없어요`); return; }
      const good = it.opts.map((_, k) => k).filter(k => PN.judgeItem(it, k).ok);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]} (${it.opts.map((_, k) => PN.judgeItem(it, k).why).join(' | ')})`);
      const texts = it.opts.map(PN.text);
      if (new Set(texts).size !== texts.length) bad.push(`${w}: 같은 보기가 있어요`);
      if (texts.some(t => /___/.test(t))) bad.push(`${w}: 빈 칸이 있는 보기가 있어요`);
      if (!it.sit) bad.push(`${w}: 상황 글이 없어요`);
      const st = PN.steps(it); if (st.length !== 3 || st.some(s => !s.text)) bad.push(`${w}: 풀이 단계가 비었어요`);
      pos[it.a]++;
    });
    if (PN.DRILL.length !== 16) bad.push(`듣고 대답 고르기 ${PN.DRILL.length}문제`);
    if (Math.max(...pos) - Math.min(...pos) > 0) bad.push(`듣고 대답 고르기 정답 위치가 몰려 있어요: ${pos.join(',')}`);
    const places = new Set(PN.DRILL.map(it => it.place));
    PN.PLACES.forEach(p => { if (!places.has(p.id)) bad.push(`듣고 대답 고르기: ${p.ko} 문제가 없어요`); });
    if (PN.DRILL.filter(it => it.Q.fast).length < 2) bad.push('듣고 대답 고르기: 빠른 말(다시 묻기) 문제가 둘보다 적어요');
    const yesTrap = PN.DRILL.filter(it => (it.Q.shape === 'or' || it.Q.shape === 'wh') && it.opts.some(a => PN.FRAME[a.f].bare)).length;
    if (yesTrap < 4) bad.push(`듣고 대답 고르기: 고르는 · 정보 질문에 Yes 함정이 있는 문제가 ${yesTrap}개뿐이에요`);
    if (!PN.DRILL.some(it => !it.Q.fast && it.opts.some(a => a.f === 'line'))) bad.push('듣고 대답 고르기: 메시지 한 줄 문제가 없어요');
    if (!PN.DRILL.some(it => it.opts.some((a, k) => { const j = PN.judgeItem(it, k); return j.stage === 2 && j.tag === 'wrong' && PN.FRAME[a.f].aux; }))) bad.push('듣고 대답 고르기: 짝이 다른 짧은 대답 문제가 없어요');
    Object.entries(PN.MINI).forEach(([k, it]) => { const good = it.opts.map((_, i) => i).filter(i => PN.judgeItem(it, i).ok); if (good.length !== 1 || good[0] !== it.a) bad.push(`직접 해 보기 ${k}: 맞는 보기 ${good}`); });
    // 영상 · 직접 해 보기의 대화가 판정과 맞나
    const want = (w, q, a, c, ok) => { const j = PN.judge(q, a, c); if (j.ok !== ok) bad.push(`${w}: ${PN.text(a)} → 판정 ${j.ok ? '✓' : '×'} (${j.why})`); return j; };
    const D = PN.DEMO, SC = PN.SCENE, I0 = PN.INTRO, seq = (w, row, oks, c = D) => oks.forEach((ok, k) => want(`${w} ${k + 1}`, row[0], row[k + 1], c, ok));
    want('00장 reserve', I0.q, I0.bad, I0.card, false); want('00장 make a reservation', I0.q, I0.ok, I0.card, true);
    want('00장 잘못 되짚은 철자에 Yes', I0.dq, I0.dbad, D, false); want('00장 바로잡기', I0.dq, I0.dok, D, true);
    want('00장 되짚지 않음', I0.rq, I0.skip, D, false); want('00장 시각 되짚기', I0.rq, I0.check, D, true);
    seq('02장 용건', SC.need, [false, false, false, true]); seq('02장 점심 · 저녁', SC.meal, [false, false, true]); seq('02장 사람 수', SC.ppl, [false, false, true]); seq('02장 빠른 말', SC.bfast, [false, true]);
    seq('03장 시각', SC.when, [false, true]); seq('03장 다 참', SC.full, [false, false, false, true]); seq('03장 빈 시각', SC.offer, [false, false, true]); seq('03장 빠른 말', SC.ofast, [false, true]);
    seq('04장 이름', SC.name, [false, false, true]); seq('04장 철자', SC.spell, [false, false, true, true]); seq('04장 되짚은 철자', SC.check, [false, false, false, true]);
    seq('05장 용건', SC.help, [false, false, false, true]); seq('05장 반', SC.level, [false, true, true]); seq('05장 수업 안내', SC.info, [false, false, false, true]); seq('05장 빠른 말', SC.ifast, [false, true]);
    seq('06장 메시지', SC.out, [false, true]); SC.lines.forEach(([k, a]) => want(`06장 메시지 한 줄 ${k}`, 'ms_go', a, D, k === 'ok' || k === 'nonum' || k === 'late'));
    seq('06장 말씀하세요', SC.go, [false, false, true]); seq('06장 빠른 말', SC.mfast, [false, true]);
    seq('07장 번호', SC.nb, [false, false, false, true]); seq('07장 빠른 말', SC.nbfast, [false, true]); seq('07장 되짚은 번호', SC.pcheck, [false, false, false, true]);
    seq('08장 전화 받기', SC.hi, [false, false, true, true]); seq('08장 끊긴 말', SC.cut, [false, true]); seq('08장 준비물', SC.bring, [false, false, true]); seq('08장 끝인사', SC.end, [false, false, true]);
    { const j = PN.judge('nm_check', SC.check[2], D); if (j.stage !== 2 || j.tag !== 'wrong') bad.push(`04장 짝: ${j.stage}단계 ${j.tag}`); }
    { const j = PN.judge('nb_check', SC.pcheck[3], D); if (j.stage !== 2 || j.tag !== 'wrong') bad.push(`07장 짝: ${j.stage}단계 ${j.tag}`); }
    { const j = PN.judge('bk_help', SC.need[1], D); if (j.stage !== 2 || j.tag !== 'literal') bad.push(`02장 reserve: ${j.stage}단계 ${j.tag}`); }
    { const j = PN.judge('cb_end', SC.end[2], D); if (j.stage !== 3 || j.tag !== 'plain') bad.push(`08장 끝인사: ${j.stage}단계 ${j.tag}`); }
    { const j = PN.judge('nm_spell', SC.spell[3], D); if (!j.ok || !/as in/.test(j.why)) bad.push('04장 글자만 부른 철자에 알림이 없어요'); }
    ['tm_full', 'tm_offer', 'nm_check', 'as_info', 'nb_check', 'cb_hi', 'cb_bring'].forEach(id => { if (PN.simQ(id, D).en !== PN.Q[id].en) bad.push(`DEMO와 말이 달라요 ${id}: ${PN.simQ(id, D).en}`); const f = PN.simQ(id, D).fact || {}, g = PN.Q[id].fact || {}; if (JSON.stringify(f) !== JSON.stringify(g)) bad.push(`DEMO와 사실이 달라요 ${id}: ${JSON.stringify(f)} · ${JSON.stringify(g)}`); });
    PN.METHOD.forEach(([q, a, c], i) => want(`09장 ${i + 1}`, q, a, Object.assign({}, D, c), true));
    if (PN.METHOD.length !== PN.PLACES.length || PN.METHOD.some(([q], i) => PN.Q[q].place !== PN.PLACES[i].id)) bad.push('09장: 곳마다 한 줄이 아니에요');
    // 실전: 지워지는 단계가 줄 글과 맞나
    PN.PRACTICE.forEach((p, i) => {
      const w = `실전 ${i + 1}`, q = PN.practiceQ(p);
      const J = p.opts.map(a => PN.judge(q, a, PN.PCARD));
      const good = J.map((j, k) => j.ok ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== p.a) bad.push(`${w}: 맞는 보기 ${good} (${J.map(j => j.why).join(' | ')})`);
      [1, 2, 3].forEach(st => {
        const gone = J.map((j, k) => j.stage === st ? LL(k) : null).filter(Boolean).sort().join();
        const said = (p.lines[st - 1].match(/\([A-D]\)/g) || []).filter(x => st < 3 || x !== LL(p.a)).sort().join();
        if (gone !== said) bad.push(`${w} ${st}단계: 엔진 ${gone || '-'} · 화면 ${said || '-'}`);
      });
      if (!p.lines[2].includes(`정답 ${LL(p.a)}`)) bad.push(`${w}: 정답 표시가 달라요`);
      if (!p.lines[2].includes(PN.text(p.opts[p.a]).replace(/\.$/, ''))) bad.push(`${w}: 정답 글이 달라요 (${PN.text(p.opts[p.a])})`);
    });
    // 시뮬레이터: 카드 여럿 — 모범 대답은 통과, 틀 칩 가운데 맞는 것이 하나뿐인지, 모범 대답을 말로 해도 통과하는지
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 60; n++) {
      const c = PN.newCard(rnd), rowText = PN.cardRows(c).map(r => r.join(' ')).join(' '), Lv = PN.LEVELS[c.lvl];
      [PN.offerOf(c), `${Lv.price}달러`, `$${Lv.price}`, PN.BRINGS[c.item].ko, PN.WDAYS[Lv.first].ko, Lv.dko].forEach(x => { if (rowText.includes(x)) bad.push(`시뮬레이터: 들어야 할 것(${x})이 카드에 보여요`); });
      PN.simQs(c).forEach(id => {
        const q = PN.simQ(id, c), C = PN.ctx(c, q), m = PN.model(q, C), j = PN.judge(q, m, C);
        if (!j.ok) bad.push(`시뮬레이터 ${id}: 모범 대답이 탈락 (${PN.text(m)} · ${j.why})`);
        const ms = PN.matchSpoken(PN.spoken(PN.text(m)), q, C);
        if (!ms.ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 말로 해도 통과하지 못해요 (${PN.spoken(PN.text(m))} · ${ms.why})`);
        const ms2 = PN.matchSpoken(PN.text(m), q, C);
        if (!ms2.ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 숫자 그대로 받아 적어도 통과하지 못해요 (${PN.text(m)} · ${ms2.why})`);
        if (PN.shapeGuess(q.en) !== q.shape) bad.push(`시뮬레이터 ${id}: 모양 ${q.shape} · 글 ${PN.shapeGuess(q.en)} (${q.en})`);
        q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`시뮬레이터 ${id}: 열쇠 낱말 ‘${k}’가 말에 없어요 (${q.en})`); });
        if (/___/.test(PN.text(m))) bad.push(`시뮬레이터 ${id}: 모범 대답에 빈 칸 (${PN.text(m)})`);
        const fr = PN.simFrames(q.intent, C);
        if (!fr) { bad.push(`시뮬레이터 ${id}: 틀 칩이 없어요`); return; }
        if (q.intent === 'go') {
          const chips = PN.lineChips(C, rnd), mw = m.line.words;
          if (chips.length !== mw.length) bad.push(`시뮬레이터 메시지 한 줄: 조각 자리 ${chips.length} · 모범 조각 ${mw.length}`);
          chips.forEach((g, k) => {
            if (!g.ids.includes(mw[k])) bad.push(`시뮬레이터 메시지 한 줄: ${k + 1}번째 자리에 맞는 조각(${mw[k]})이 없어요 (${g.ids})`);
            g.ids.filter(x => x !== mw[k]).forEach(x => { const w2 = mw.map((y, i) => i === k ? x : y); if (!PN.OW[x]) bad.push(`시뮬레이터 메시지 한 줄: 조각 ${x}가 없어요`); else if (PN.judge(q, L(w2, m.line.name), C).ok) bad.push(`시뮬레이터 메시지 한 줄: 함정 조각 ${x}가 통과해요`); });
          });
          fr.filter(f => f !== 'line').forEach(f => { if (PN.judge(q, o(f), C).ok) bad.push(`시뮬레이터 메시지 한 줄: ${f}가 통과해요`); });
          return;
        }
        const okN = fr.filter(f => { const F = PN.FRAME[f]; if (!F.slot) return PN.judge(q, { f }, C).ok; return PN.slotChoices(F.slot, C, rnd, q).some(v => PN.judge(q, { f, v }, C).ok); }).length;
        if (okN !== 1) bad.push(`시뮬레이터 ${id}: 맞는 틀이 ${okN}개예요 (${fr.join(',')})`);
        fr.forEach(f => { const F = PN.FRAME[f]; if (F.slot && !PN.slotChoices(F.slot, C, rnd, q).length) bad.push(`시뮬레이터 ${id}: ${f}의 칸 칩이 없어요`); });
        if (!fr.includes(m.f)) bad.push(`시뮬레이터 ${id}: 틀 칩에 모범 틀(${m.f})이 없어요`);
        const F = PN.FRAME[m.f];
        if (F.slot) { const ch = PN.slotChoices(F.slot, C, rnd, q), okv = ch.filter(v => PN.judge(q, { f: m.f, v }, C).ok); if (okv.length !== 1) bad.push(`시뮬레이터 ${id}: ${m.f}의 칸 칩 가운데 맞는 값이 ${okv.length}개예요 (${ch})`); if (ch.length < 2) bad.push(`시뮬레이터 ${id}: ${m.f}의 칸 칩이 ${ch.length}개뿐이에요`); }
      });
    }
    // 말로 대답하기: 모양 · 다른 값 · 콩글리시 · 짐작은 통과하지 않아야
    const rep = (w, raw, q, c, k) => { const r = PN.matchSpoken(raw, q, c); if (r.ok || r.repair !== k) bad.push(`말로 대답하기 ${w}: ‘${raw}’ → ${r.ok ? '통과' : r.repair || '탈락'} (${r.why})`); return r; }, nope = (w, raw, q, c) => { const r = PN.matchSpoken(raw, q, c); if (r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과해요`); return r; }, yep = (w, raw, q, c) => { const r = PN.matchSpoken(raw, q, c); if (!r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과하지 않아요 (${r.why})`); return r; };
    Object.values(PN.Q).filter(q => (q.shape === 'or' || q.shape === 'wh') && !q.fast).forEach(q => { ['yes', 'yes please', 'yeah sure'].forEach(y => nope(`${q.id} ${y}`, y, q, D)); });
    Object.values(PN.Q).filter(q => q.shape === 'note' && !q.fast).forEach(q => nope(`${q.id} okay`, 'Okay, thanks.', q, D));
    yep('예약', 'Hi, I\'d like to make a reservation for Friday, please.', 'bk_help', D); yep('예약 table', 'Hi, could I book a table for Friday?', 'bk_help', D);
    nope('reserve', 'Hi, I want to reserve Friday.', 'bk_help', D); nope('토요일', 'Hi, I\'d like to make a reservation for Saturday, please.', 'bk_help', D); nope('용건 없이', 'Hi, I\'m calling about Friday.', 'bk_help', D);
    yep('저녁', 'Dinner, please.', 'bk_meal', D); nope('점심', 'Lunch, please.', 'bk_meal', D);
    yep('네 명', 'For four, please.', 'bk_ppl', D); nope('we are', 'We are four.', 'bk_ppl', D); nope('세 명', 'For three, please.', 'bk_ppl', D);
    yep('7시', 'At seven, please.', 'tm_when', D); nope('8시', 'At eight, please.', 'tm_when', D);
    yep('더 늦은 시간', 'Oh, I see. Do you have anything later?', 'tm_full', D); nope('possible', 'Then what time is possible?', 'tm_full', D); nope('earlier', 'Do you have anything earlier?', 'tm_full', D); nope('알겠어요만', 'Oh, okay.', 'tm_full', D);
    yep('시각 되짚기', 'So, eight fifteen?', 'tm_offer', D); yep('시각 숫자', 'So, 8:15?', 'tm_offer', D); nope('8:50', 'So, eight fifty?', 'tm_offer', D);
    rep('빠른 시각 되묻기', 'Sorry, what time was that?', 'tm_fast', D, 'again'); nope('빠른 시각 짐작', 'So, eight fifteen?', 'tm_fast', D); rep('빠른 첫마디 되묻기', 'Sorry, is this Lantern Bistro?', 'bk_fast', D, 'again');
    yep('이름', 'It\'s Han.', 'nm_name', D); yep('이름 + 철자', 'It\'s Han. H-A-N, N as in Nancy.', 'nm_name', D); nope('Name is', 'Name is Han.', 'nm_name', D); nope('Kim', 'It\'s Kim.', 'nm_name', D);
    { const r = PN.matchSpoken('It\'s Han, H-A-N, N as in Nancy.', 'nm_name', D); if (!r.ok || !r.covered.includes('spell')) bad.push('말로 대답하기: 이름 + 철자가 ‘철자’를 건너뛰지 않아요'); }
    yep('철자', 'Sure. It\'s H-A-N, N as in Nancy.', 'nm_spell', D); yep('철자 말로', PN.spoken('Sure. It\'s H-A-N, N as in Nancy.'), 'nm_spell', D); yep('철자 글자만', 'H A N', 'nm_spell', D);
    nope('잘못된 글자', 'It\'s H-A-M, M as in Mary.', 'nm_spell', D); nope('이름만', 'It\'s Han.', 'nm_spell', D); nope('Sure만', 'Sure.', 'nm_spell', D);
    yep('바로잡기', 'No, N as in Nancy.', 'nm_check', D); yep('바로잡기 wasn\'t', 'No, it wasn\'t. N as in Nancy.', 'nm_check', D); nope('잘못 되짚었는데 Yes', 'Yes, that\'s right.', 'nm_check', D); nope('No만', 'No.', 'nm_check', D); nope('다른 글자', 'No, M as in Mary.', 'nm_check', D);
    { const D2 = Object.assign({}, D, { hok: true }), q2 = PN.simQ('nm_check', D2); yep('맞게 되짚음', 'Yes, that\'s right.', q2, D2); nope('맞게 되짚었는데 No', 'No, N as in Nancy.', q2, D2); }
    yep('문의', 'Hi, I\'m calling to ask about your swimming lessons.', 'as_help', D); nope('inquiry', 'I want to inquiry swimming lessons.', 'as_help', D); nope('질문만', 'Hi, I have a question.', 'as_help', D); nope('요가', 'Hi, I\'m calling to ask about your yoga classes.', 'as_help', D);
    yep('초급', 'The beginner class, please.', 'as_level', D); nope('중급', 'The intermediate class, please.', 'as_level', D); rep('intermediate 묻기', 'Sorry, what does intermediate mean?', 'as_level', D, 'what');
    yep('수업 되짚기', 'So, Tuesdays and Thursdays from six to seven, forty dollars a month?', 'as_info', D); yep('인식이 붙인 숫자', 'So Tuesdays and Thursdays from six to seven forty dollars a month', 'as_info', D);
    nope('14달러', 'So, Tuesdays and Thursdays, fourteen dollars a month?', 'as_info', D); nope('다른 요일', 'So, Mondays and Wednesdays, forty dollars a month?', 'as_info', D);
    rep('빠른 수업 되묻기', 'Sorry, when is the class, and how much is it?', 'as_fast', D, 'again'); nope('빠른 수업 다른 말', 'Sorry, what do I need to bring?', 'as_fast', D);
    yep('메시지 남김', 'Yes, please.', 'ms_out', D); nope('please leave', 'Yes. Please leave a message.', 'ms_out', D); nope('메시지 안 남김', 'No, thanks. I\'ll call back later.', 'ms_out', D);
    { const r = yep('바로 메시지', PN.lineText(PN.LINE), 'ms_out', D); if (r.ok && r.covered.join() !== 'msg,go,nb') bad.push(`말로 대답하기: 바로 말한 메시지의 건너뛰기 ${r.covered}`); }
    yep('메시지 한 줄', PN.lineText(PN.LINE), 'ms_go', D); yep('메시지 한 줄 말로', PN.spoken(PN.lineText(PN.LINE)), 'ms_go', D); yep('메시지 have him', 'This is Jiwoo Han. I\'m calling about the beginner swimming class. Could you have him call me back at 555-0139?', 'ms_go', D);
    nope('Here is', 'Here is Jiwoo Han. I\'m calling about the beginner swimming class. Could you ask him to call me back at 555-0139?', 'ms_go', D); nope('누구 없이', 'I\'m calling about the beginner swimming class. Could you ask him to call me back?', 'ms_go', D);
    nope('다른 번호', 'This is Jiwoo Han. I\'m calling about the beginner swimming class. Could you ask him to call me back at 555-0193?', 'ms_go', D); nope('다른 반', 'This is Jiwoo Han. I\'m calling about the intermediate swimming class. Could you ask him to call me back?', 'ms_go', D);
    { const r = yep('Tell him 알림', 'This is Jiwoo Han. I\'m calling about the beginner swimming class. Tell him to call me back.', 'ms_go', D); if (r.ok && !r.note) bad.push('말로 대답하기: Tell him에 알림이 없어요'); }
    yep('번호', 'It\'s five five five oh one three nine.', 'nb_ask', D); yep('번호 숫자', 'It\'s 555-0139.', 'nb_ask', D); yep('번호 붙여서', 'It\'s 5550139.', 'nb_ask', D); nope('handphone', 'My handphone number is 555-0139.', 'nb_ask', D); nope('끝 두 자리', 'It\'s 555-0193.', 'nb_ask', D);
    yep('번호 바로잡기', 'No, it isn\'t. It\'s 555-0139.', 'nb_check', D); yep('번호 바로잡기 말로', 'No, it isn\'t. It\'s five-five-five, oh-one-three-nine.', 'nb_check', D); nope('잘못 되짚었는데 Yes', 'Yes, that\'s right.', 'nb_check', D); nope('번호 No만', 'No.', 'nb_check', D);
    rep('번호 빠른 말', 'Sorry, did you ask for my phone number?', 'nb_fast', D, 'again'); rep('메시지 빠른 말', 'Sorry, did you ask if I\'d like to leave a message?', 'ms_fast', D, 'again');
    yep('전화 받기', 'Yes, speaking.', 'cb_hi', D); yep('전화 받기 it is', 'Yes, it is.', 'cb_hi', D); nope('Who are you', 'Who are you?', 'cb_hi', D); nope('No', 'No.', 'cb_hi', D);
    rep('끊김', 'Sorry, you\'re breaking up. Could you say that again?', 'cb_cut', D, 'again'); nope('끊김 짐작', 'So, goggles on Tuesday?', 'cb_cut', D); rep('끊김 되묻기', 'Sorry, what do I need to bring?', 'cb_cut', D, 'again');
    yep('준비물 되짚기', 'So, a swimsuit and goggles on Tuesday?', 'cb_bring', D); nope('목요일', 'So, a swimsuit and goggles on Thursday?', 'cb_bring', D); nope('수영모', 'So, a swimsuit and a swim cap on Tuesday?', 'cb_bring', D);
    yep('끝인사', 'No, that\'s all. Thanks for calling back. Bye!', 'cb_end', D); nope('Okay bye', 'Okay. Bye.', 'cb_end', D); nope('끝인사 No만', 'No.', 'cb_end', D);
    // 따라 말하기: 같은 말은 모두 맞아야 · 숫자 낱말로 말해도 맞아야
    PN.SHADOW.forEach((s, i) => { const r = PN.compareWords(s.en, s.en), r2 = PN.compareWords(s.en, PN.spoken(s.en)); if (r.hit !== r.total || r2.hit !== r2.total) bad.push(`따라 말하기 ${i + 1}: 같은 글이 다 맞지 않아요 (${r.hit}/${r.total} · ${r2.hit}/${r2.total})`); if (!PN.PLACE[s.place]) bad.push(`따라 말하기 ${i + 1}: 곳이 없어요`); });
    { const r = PN.compareWords('So, 8:15?', 'So, eight fifty?'); if (r.hit === r.total) bad.push('따라 말하기: 8:15와 8:50을 같게 봐요'); }
    if (PN.SHADOW.length !== 28) bad.push(`따라 말하기 문장 수: ${PN.SHADOW.length}`);
    PN.PLACES.forEach(p => { if (PN.SHADOW.filter(s => s.place === p.id).length !== 4) bad.push(`따라 말하기: ${p.ko} 문장이 넷이 아니에요`); });
    bad.forEach(b => console.warn('[전화] ' + b));
    return bad;
  };

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  PN.allText = function () {
    const out = [];
    Object.values(PN.Q).forEach(q => out.push(q.en, q.ko, q.short || ''));
    Object.values(PN.FRAME).forEach(F => out.push(F.t || '', F.ko || '', F.why || '', F.note || ''));
    Object.values(PN.SLOT).forEach(S => Object.values(S.vals || {}).forEach(v => out.push(Object.values(v).filter(x => typeof x === 'string').join(' '))));
    Object.values(PN.SHAPE).forEach(a => out.push(a.ko, a.mark, a.ans, a.say, a.offer || '')); Object.values(PN.INTENT).forEach(a => out.push(a.ans || '', a.want || '', a.say || '', a.turn || ''));
    Object.values(PN.AUX).forEach(a => out.push(a.q, a.a));
    PN.PLACES.forEach(p => out.push(p.ko, p.en, p.en.toUpperCase()));
    Object.values(PN.CALLS).forEach(c => out.push(c.ko, c.en, c.who, c.wko, c.en.toUpperCase()));
    [PN.DAYS, PN.MEALS, PN.PPL, PN.ALTS, PN.NAMES, PN.TOPICS, PN.LEVELS, PN.WDAYS, PN.BRINGS].forEach(T => Object.values(T).forEach(x => out.push(Object.values(x).filter(v => typeof v === 'string').join(' '), String(x.t || '').toUpperCase())));
    Object.values(PN.OFFERS).forEach(m => Object.values(m).forEach(ts => ts.forEach(t => out.push(t, PN.timeWords(t), PN.timeTrap(t), PN.timeWords(PN.timeTrap(t))))));
    PN.PHONES.forEach(p => out.push(PN.phoneText(p), PN.phoneText(PN.phoneSwap(p)), PN.phoneWords(PN.phoneText(p)), PN.phoneWords(PN.phoneText(PN.phoneSwap(p)))));
    PN.SUR_IDS.forEach(id => { const n = PN.NAMES[id]; out.push(n.spell, PN.wrongSpell(id), PN.asIn(n.L), PN.asIn(n.alt), PN.letterWords(n.spell)); });
    PN.GIVEN.forEach(g => out.push(g, PN.GIVEN_KO[g])); Object.entries(PN.AS).forEach(([k, v]) => out.push(k, v, v.toUpperCase()));
    PN.LVL_IDS.forEach(l => ['', '~p', '~d'].forEach(t => out.push(PN.infoText(l + t), PN.infoKo(l + t), PN.infoLine(l))));
    PN.BRING_IDS.forEach(b => Object.keys(PN.WDAYS).forEach(d => out.push(PN.bringText(`${b}.${d}`), PN.bringKo(`${b}.${d}`), PN.bringLine(`${b}.${d}`))));
    PN.PRACTICE.forEach(p => out.push(p.lines.join(''))); PN.SHADOW.forEach(s => out.push(s.en, s.ko));
    PN.LINKED.forEach(l => out.push(l.en, l.ko, l.sound.map(s => s[0]).join(''))); PN.PAIRS.forEach(p => out.push(p.join(''))); PN.ALPHA.forEach(p => out.push(p.join('')));
    Object.values(PN.OCAT).forEach(c => out.push((c && c.ko) || '')); Object.values(PN.OW).forEach(w => out.push(w.t, w.ko || '', w.why || ''));
    out.push(PN.BISTRO, PN.CENTER, PN.COACH, PN.BISTRO.toUpperCase(), PN.CENTER.toUpperCase(), PN.COACH.toUpperCase(), 'Matt Diaz', 'MATT DIAZ', 'Ben', 'Grace', 'Olivia',
      '0123456789.,:·+×–%→#-$', 'CALLING INCOMING CALL MISSED CALL ON HOLD VOICEMAIL MESSAGE RESERVATION TABLE FULLY BOOKED LUNCH DINNER FRI SAT MON TUE WED THU ' +
      'SWIM OFFICE BEGINNER INTERMEDIATE CLASS SCHEDULE PRICE A MONTH BRING SWIMSUIT GOGGLES SWIM CAP SPELLING AS IN NOTE PHONE NUMBER CALL BACK MUTE SPEAKER END KEYPAD');
    return out.join('');
  };
})();
