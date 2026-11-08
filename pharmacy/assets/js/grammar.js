/* 약국 · 병원 회화 — 규칙 엔진과 대화 자료 (상황별 영어 회화)
 *
 * 약국에서는 내가 먼저 말을 꺼내요. 증상은 사실로, 바라는 것은 질문으로 — 호텔 튜토리얼의 ‘사실 + 부탁’과 같은 규칙이에요.
 *   I have a sore throat. + Could you recommend something for it?
 * 약사 · 의사의 복용법 설명은 길고 숫자가 많아요. 그래서 들은 조각을 한 줄로 되짚어 확인해요 — 길 묻기 튜토리얼과 같은 규칙이에요.
 *   Take two tablets three times a day after meals, for five days.
 *   → So, I take two tablets, three times a day, after meals, for five days?
 * 병원 접수와 진찰의 짧은 질문은 모양(Yes/No · 고르는 질문 · 정보 질문)이 대답을 정하고,
 * Yes/No 질문은 첫 낱말이 짧은 대답의 짝을 정해요(Do you …? → I do · Are you …? → I am · Does it …? → it does).
 *
 * 규칙 엔진은 소리를 듣지 않고, 말마다 적어 둔 ‘뜻(intent) · 모양(shape)’과 ‘대답 틀(frame) + 내 정보(slot)’,
 * 그리고 환자 카드(또는 상황)의 사실을 맞춰 봐요. 복용법은 지어낸 약 목록에서 계산해요(PH.doseOf).
 *
 * 3단계 말하기 법 — PH.judge(상대의 말, 대답, 카드)
 *   ① 열쇠 낱말 + 질문의 모양 잡기 — 고르는 질문 · 정보 질문에 Yes · No만 하면 탈락, 고르는 질문이면 상대가 말한 것 가운데 골랐나,
 *                      대답이 그 말(intent)에 맞나. 빠르게 말해 못 알아들은 말(fast)이면 짐작한 대답은 탈락 → 다시 묻기
 *   ② 틀에 내 정보 넣기 — 틀이 자연스러운가(한국어 그대로 · 틀린 문장 · Yes/No 짝이 다른 대답이면 탈락), 증상 · 이름 · 생일이 카드와 맞나,
 *                      사실만 말하고 부탁이 빠졌나, 되짚은 복용법이 들은 것과 같고 빠진 조각 · 뒤섞인 순서가 없나
 *   ③ 공손하게 끝내기 — 명령 · 따지는 말(blunt)이나 고맙다는 말 없이 끊긴 말(plain)이면 탈락
 * judge → { ok, stage: 0 | 1 | 2 | 3, why, tag }
 *
 * 되짚는 한 줄: PH.checkLine(낱말, 카드) — So, I take → 한 번에 먹는 양 → 하루 몇 번 → 언제(식전 · 식후) → 며칠 동안
 *             PH.fixLine(낱말, 카드) — 틀린 첫 조각을 고쳐 주는 상대의 말(Not quite — three times a day, not twice a day.)
 * 복용법: PH.MEDS(약국 약) · PH.RX(병원 처방) · PH.doseOf(카드) · PH.say(복용법) · PH.schedule(복용법 → 하루 시간표)
 * 숫자: PH.spoken($13.50 → thirteen fifty · 15 ml → fifteen milliliters · March 4th, 2005 → March fourth, two thousand five · K-I-M → K, I, M)
 *
 * 영상의 ✓·×, 직접 해 보기, 진료 시뮬레이터, 듣고 대답 고르기, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 PH.check()가 콘솔에 경고를 내요.
 * 약 이름 · 복용법 · 값은 영어 연습을 위해 지어낸 예시예요. 실제로 약을 먹을 때는 약사 · 의사의 안내와 설명서를 따라요.
 */
(function () {
  'use strict';
  const PH = (window.PH = {});
  const L4 = 'ABCD';

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s).replace(/\s*\([^()]*\)\s*$/, ''); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; if (/[0-9]/.test(s[i])) return '0136781'.includes(s[i]) ? 0xAC01 : 0xAC00; if (/[A-Za-z]/.test(s[i])) return /[lmnr]/i.test(s[i]) ? 0xAC01 : 0xAC00; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const rieul = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 === 8 : false; };
  const wa = s => s + (has(s) ? '과' : '와'), eul = s => s + (has(s) ? '을' : '를'), ig = s => s + (has(s) ? '이' : '가');
  const ro = s => s + (has(s) && !rieul(s) ? '으로' : '로'), ieyo = s => s + (has(s) ? '이에요' : '예요'), eun = s => s + (has(s) ? '은' : '는');
  PH.josa = { wa, eul, ig, ro, ieyo, eun };

  /* =========================================================
     약국과 병원의 일곱 곳 (가는 차례). sp: 그곳 상대의 목소리 (voices.js)
     ========================================================= */
  PH.PLACES = [
    { id: 'counter', ko: '약국 카운터 · 증상 알리기', en: 'Pharmacy counter · Symptoms', sp: 'us' },
    { id: 'ask', ko: '약사의 질문', en: 'The pharmacist\'s questions', sp: 'us' },
    { id: 'dose', ko: '복용법 듣고 되짚기', en: 'Dosage · Check back', sp: 'us' },
    { id: 'front', ko: '병원 접수', en: 'Clinic reception', sp: 'gb' },
    { id: 'doctor', ko: '진료실 · 증상 설명', en: 'The doctor · Symptoms', sp: 'ca' },
    { id: 'exam', ko: '진찰 · 아픈 곳', en: 'Examination · Where it hurts', sp: 'ca' },
    { id: 'plan', ko: '처방 · 다음 진료', en: 'Prescription · Follow-up', sp: 'ca' },
  ];
  PH.PLACE = {}; PH.PLACES.forEach((p, i) => { p.i = i; PH.PLACE[p.id] = p; });
  PH.ME = 'me';
  PH.CITY = 'Kellport';                   // 지어낸 도시 이름
  PH.PHARMACY = 'Elm Street Pharmacy';    // 지어낸 약국
  PH.CLINIC = 'Kellport Walk-in Clinic';  // 지어낸 병원
  PH.DOCTOR = 'Dr. Hall';                 // 지어낸 의사
  // 내가 먼저 말을 꺼내는 곳 (약국에서 증상 알리기 · 진료 끝에 진단서 부탁하기)
  PH.ME_FIRST = { counter: 1, plan: 1 };

  /* =========================================================
     질문의 모양 세 가지 (+ 안내). mark: 그림 이름 (scenes.js의 shape_yn · shape_or · shape_wh · shape_note)
     ========================================================= */
  PH.SHAPE = {
    yn: { ko: 'Yes/No 질문', mark: '스위치', ans: 'Yes · No + 짝 맞는 짧은 대답', say: 'Yes/No 질문이에요. 질문의 첫 낱말로 짧은 대답을 만들어요', offer: '권하는 말이면 원하는 것을 바로 말해도 돼요(Yes · No는 빼도 돼요)' },
    or: { ko: '고르는 질문', mark: '갈림길', ans: '고른 것 + please', say: '고르는 질문(A or B?)이에요. 상대가 말한 것 가운데 하나를 골라 말해요' },
    wh: { ko: '정보 질문', mark: '빈 상자', ans: '정보 + please', say: '정보 질문이에요. 묻는 정보를 채워 말해요' },
    note: { ko: '안내', mark: '말풍선', ans: '되짚기 · 내가 먼저 말할 차례', say: '질문이 아니라 알려 주는 말이에요' },
  };
  PH.shapeOf = q => (typeof q === 'string' ? PH.Q[q] : q).shape;
  // 글만 보고 짐작한 모양 (점검용): 물음표 문장 가운데 마지막 것 → or가 있으면 고르기, 의문사로 시작하면 정보, 아니면 Yes/No
  PH.shapeGuess = function (en) {
    const qs = String(en).match(/[^.!?]*\?/g);
    if (!qs) return 'note';
    let s = qs[qs.length - 1].trim().toLowerCase().replace(/^(and|so|great|okay|sure|perfect|thanks|now|no problem|hi|hey|hello|hiya|morning|right|alright)[,!]?\s+/, '');
    if (/\bor\b/.test(s)) return 'or';
    if (/^(how|what|which|where|when|who|why)\b/.test(s)) return 'wh';
    return 'yn';
  };
  // Yes/No 질문의 짝 (질문의 첫 낱말 → 짧은 대답)
  PH.AUX = {
    do: { q: 'Do you …?', a: 'Yes, I do. · No, I don\'t.' },
    be: { q: 'Are you …?', a: 'Yes, I am. · No, I\'m not.' },
    is: { q: 'Is this …?', a: 'Yes, it is. · No, it isn\'t.' },
    does: { q: 'Does it …?', a: 'Yes, it does. · No, it doesn\'t.' },
    have: { q: 'Have you …?', a: 'Yes, I have. · No, I haven\'t.' },
  };

  /* =========================================================
     숫자 읽기 — 값 · 양(ml) · 날짜 · 철자 (화면 글 → 소리)
     ========================================================= */
  const NUMW = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };
  const numWord = n => n < 20 || (n < 100 && n % 10 === 0) ? NUMW[n] : n < 100 ? `${NUMW[n - n % 10]}-${NUMW[n % 10]}` : n < 1000 ? `${NUMW[Math.floor(n / 100)]} hundred${n % 100 ? ' ' + numWord(n % 100) : ''}` : String(n);
  PH.numWord = numWord;
  const ORDW = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth', 15: 'fifteenth', 16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth', 19: 'nineteenth', 20: 'twentieth', 30: 'thirtieth' };
  const ordWord = n => ORDW[n] || `${NUMW[n - n % 10]}-${ORDW[n % 10]}`;
  const ordSuf = n => n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  PH.ordWord = ordWord;
  // 값 (센트): 약국에서 말하는 꼴 — $13.50 → thirteen fifty · $20.00 → twenty dollars
  PH.money = c => '$' + (c / 100).toFixed(2);
  PH.priceWords = c => { const d = Math.floor(c / 100), k = c % 100; return !k ? `${numWord(d)} dollar${d === 1 ? '' : 's'}` : `${numWord(d)} ${k < 10 ? 'oh ' + numWord(k) : numWord(k)}`; };
  PH.priceKo = c => { const d = Math.floor(c / 100), k = c % 100; return k ? `${d}달러 ${k}센트` : `${d}달러`; };
  // 날짜: '2005-03-04' → March 4th, 2005 (미국식: 달 · 날 · 해) · 읽기 March fourth, two thousand five
  PH.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const ymd = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v)); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  PH.ymd = ymd;
  const yearWords = y => y >= 2000 && y < 2010 ? `two thousand${y % 10 ? ' ' + NUMW[y % 10] : ''}` : y >= 2010 && y < 2100 ? `twenty ${numWord(y % 100)}` : `${numWord(Math.floor(y / 100))} ${y % 100 < 10 ? 'oh ' + NUMW[y % 100] : numWord(y % 100)}`;
  PH.yearWords = yearWords;
  PH.dateText = v => { const D = ymd(v); return D ? `${PH.MONTHS[D.m - 1]} ${D.d}${ordSuf(D.d)}, ${D.y}` : String(v); };
  PH.dateWords = v => { const D = ymd(v); return D ? `${PH.MONTHS[D.m - 1]} ${ordWord(D.d)}, ${yearWords(D.y)}` : String(v); };
  PH.dateKo = v => { const D = ymd(v); return D ? `${D.y}년 ${D.m}월 ${D.d}일` : String(v); };
  PH.dateNums = v => { const D = ymd(v); return D ? `${D.y}, ${D.m}, ${D.d}` : String(v); };
  PH.isoOf = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // 철자: K-I-M → 읽을 때는 K, I, M
  PH.letters = s => String(s).toUpperCase().split('').join('-');
  // 소리 내어 읽을 글: 값 → 낱말 · 15 ml → fifteen milliliters · 날짜 → 낱말 · 철자 → 한 글자씩 · 작은 숫자 → 낱말
  PH.spoken = s => String(s)
    .replace(/\$(\d+)\.(\d{2})/g, (m, d, c) => PH.priceWords(+d * 100 + +c))
    .replace(/\b(\d+) ml\b/g, (m, d) => `${numWord(+d)} milliliters`)
    .replace(new RegExp(`\\b(${PH.MONTHS.join('|')}) (\\d{1,2})(st|nd|rd|th), (\\d{4})\\b`, 'g'), (m, mo, d, s2, y) => `${mo} ${ordWord(+d)}, ${yearWords(+y)}`)
    .replace(/\b([A-Z](?:-[A-Z]){1,9})\b/g, m => m.split('-').join(', '))
    .replace(/\b(\d{1,2})\b/g, (m, d) => numWord(+d));
  // 헷갈리는 숫자 짝: 13~19 ↔ 30~90 (thirTEEN ↔ THIRty)
  PH.teenSwap = n => n >= 13 && n <= 19 ? (n - 10) * 10 : n >= 30 && n <= 90 && n % 10 === 0 ? n / 10 + 10 : null;

  /* =========================================================
     증상 · 아픈 곳 (카드의 사실)
     ========================================================= */
  PH.SYM = {
    sorethroat: { en: 'a sore throat', ko: '목이 아파요(인후통)', short: '목 아픔', part: 'throat', med: 'cold' },
    cough: { en: 'a cough', ko: '기침이 나요', short: '기침', part: 'chest', med: 'cough' },
    stomach: { en: 'a stomachache', ko: '배가 아파요(복통)', short: '배 아픔', part: 'stomach', med: 'stomach' },
    earache: { en: 'an earache', ko: '귀가 아파요', short: '귀 아픔', part: 'ear', med: 'pain' },
  };
  PH.SYM_IDS = Object.keys(PH.SYM);
  PH.PART = {
    throat: { t: 'in my throat', n: 'throat', ko: '목' }, chest: { t: 'in my chest', n: 'chest', ko: '가슴' },
    stomach: { t: 'in my stomach', n: 'stomach', ko: '배' }, ear: { t: 'in my ear', n: 'ear', ko: '귀' },
  };
  PH.PART_IDS = Object.keys(PH.PART);
  PH.NAMES = {
    kim: { t: 'Kim', ko: '김(Kim)' }, park: { t: 'Park', ko: '박(Park)' }, lee: { t: 'Lee', ko: '이(Lee)' },
    choi: { t: 'Choi', ko: '최(Choi)' }, han: { t: 'Han', ko: '한(Han)' }, jung: { t: 'Jung', ko: '정(Jung)' },
  };
  PH.NAME_IDS = Object.keys(PH.NAMES);
  Object.values(PH.NAMES).forEach(n => { n.letters = PH.letters(n.t); n.sp = `${n.t}, ${n.letters}`; });
  // 철자를 잘못 받아 적기 쉬운 짝 (시뮬레이터 칸 칩)
  PH.SPELL_TRAP = { kim: ['K-I-N', 'G-I-M'], park: ['P-A-K', 'B-A-R-K'], lee: ['L-I', 'R-E-E'], choi: ['C-H-O-E', 'C-O-I'], han: ['H-A-M', 'H-A-N-N'], jung: ['J-O-N-G', 'Y-U-N-G'] };

  /* =========================================================
     복용법 조각 — 양 · 하루 몇 번 · 언제 · 며칠 (되짚는 한 줄의 조각과 같아요)
     n: 하루에 먹는 횟수 · ml: 물약 양 · at: 식사 기준 시각 바꾸기(시간)
     ========================================================= */
  PH.AMT = {
    t1: { t: 'one tablet', ko: '한 알씩', n: 1, unit: 'tablet' }, t2: { t: 'two tablets', ko: '두 알씩', n: 2, unit: 'tablet' },
    c1: { t: 'one capsule', ko: '캡슐 하나씩', n: 1, unit: 'capsule' },
    m10: { t: '10 ml', ko: '10ml씩', n: 10, unit: 'ml' }, m15: { t: '15 ml', ko: '15ml씩', n: 15, unit: 'ml' }, m50: { t: '50 ml', ko: '50ml씩', n: 50, unit: 'ml' },
  };
  PH.FREQ = {
    f1: { t: 'once a day', ko: '하루 한 번', every: null, per: 1 }, f2: { t: 'twice a day', ko: '하루 두 번', every: null, per: 2 },
    f3: { t: 'three times a day', ko: '하루 세 번', every: null, per: 3 },
    e4: { t: 'every four hours', ko: '네 시간마다', every: 4 }, e6: { t: 'every six hours', ko: '여섯 시간마다', every: 6 },
  };
  PH.WHEN = {
    after: { t: 'after meals', ko: '밥 먹은 뒤(식후)', at: 0.5 }, before: { t: 'before meals', ko: '밥 먹기 전(식전)', at: -0.5 },
    food: { t: 'with food', ko: '밥과 함께', at: 0 }, bed: { t: 'at bedtime', ko: '자기 전', bed: true },
  };
  PH.LEN = {
    d3: { t: 'for three days', ko: '3일 동안', days: 3 }, d5: { t: 'for five days', ko: '5일 동안', days: 5 },
    d7: { t: 'for seven days', ko: '7일 동안', days: 7 }, d10: { t: 'for ten days', ko: '10일 동안', days: 10 },
  };
  // 하루 시간표 (깨어 있는 동안): 식사 8시 · 13시 · 19시, 잠 22시
  PH.MEALS = [8, 13, 19];
  PH.BED = 22;
  PH.AWAKE = [8, 20];
  PH.schedule = function (D) {
    const F = PH.FREQ[D.freq], W = D.time ? PH.WHEN[D.time] : null;
    if (W && W.bed) return F.per === 1 ? [PH.BED] : PH.MEALS.slice(0, F.per - 1).concat([PH.BED]);
    if (F.every) { const out = []; for (let h = PH.AWAKE[0]; h <= PH.AWAKE[1]; h += F.every) out.push(h); return out; }
    const meals = F.per === 1 ? [PH.MEALS[0]] : F.per === 2 ? [PH.MEALS[0], PH.MEALS[2]] : PH.MEALS.slice();
    return meals.map(h => h + (W ? W.at : 0));
  };
  PH.perDay = D => PH.schedule(D).length;
  PH.total = D => PH.AMT[D.amt].n * PH.perDay(D) * PH.LEN[D.len].days;

  /* =========================================================
     약국의 약 (지어낸 예시 — 증상마다 하나, 알약 · 물약) · 병원 처방
     ========================================================= */
  PH.MEDS = {
    cold: { en: 'cold medicine', ko: '감기약', tab: 't2', liq: 'm15', freq: 'f3', time: 'after', len: 'd5', drowsy: true, price: { tablets: 1350, liquid: 1440 }, max: { tablets: 6, liquid: 45 } },
    cough: { en: 'cough medicine', ko: '기침약', tab: 't1', liq: 'm10', freq: 'e6', time: null, len: 'd5', drowsy: true, price: { tablets: 1160, liquid: 1250 }, max: { tablets: 4, liquid: 40 } },
    stomach: { en: 'stomach medicine', ko: '소화제 · 위장약', tab: 't2', liq: 'm10', freq: 'f3', time: 'before', len: 'd3', price: { tablets: 940, liquid: 1030 }, max: { tablets: 6, liquid: 30 } },
    pain: { en: 'pain relievers', ko: '진통제', tab: 't1', liq: 'm15', freq: 'f2', time: 'food', len: 'd3', price: { tablets: 1480, liquid: 1570 }, max: { tablets: 3, liquid: 45 } },
  };
  PH.MED_IDS = Object.keys(PH.MEDS);
  PH.otc = (sym, form) => { const M = PH.MEDS[PH.SYM[sym].med]; return { amt: form === 'liquid' ? M.liq : M.tab, freq: M.freq, time: M.time, len: M.len, med: PH.SYM[sym].med }; };
  PH.price = (sym, form) => PH.MEDS[PH.SYM[sym].med].price[form === 'liquid' ? 'liquid' : 'tablets'];
  // 병원 처방: has = 들어 있는 성분(알레르기) · alt = 그 알레르기가 있을 때 대신 주는 약 · back = 낫지 않으면 다시 올 날
  PH.RX = {
    sorethroat: { en: 'some antibiotics', ko: '항생제', amt: 'c1', freq: 'f2', time: 'food', len: 'd7', has: 'penicillin', back: 'd3' },
    earache: { en: 'some antibiotics', ko: '항생제', amt: 'c1', freq: 'f3', time: 'food', len: 'd7', has: 'penicillin', back: 'd5' },
    cough: { en: 'a stronger cough syrup', ko: '더 센 기침 물약', amt: 'm10', freq: 'f3', time: 'after', len: 'd7', back: 'w1' },
    stomach: { en: 'some stomach tablets', ko: '위장약(알약)', amt: 't1', freq: 'f2', time: 'before', len: 'd5', back: 'd2' },
  };
  PH.ALT = { en: 'a different antibiotic', ko: '다른 항생제', amt: 't1', freq: 'f1', time: 'food', len: 'd5' };
  PH.safeRx = (sym, allergy) => { const R = PH.RX[sym]; return R.has && R.has === allergy ? Object.assign({}, PH.ALT, { back: R.back, alt: true, avoid: R.has }) : R; };
  PH.rx = (sym, allergy) => { const R = PH.safeRx(sym, allergy); return { amt: R.amt, freq: R.freq, time: R.time, len: R.len, rx: true, alt: !!R.alt }; };
  // 지금 되짚을 복용법 (dk: 'ph' 약국 · 'rx' 처방)
  PH.doseOf = C => { const sym = C.sym || 'sorethroat'; return C.dk === 'rx' ? PH.rx(sym, C.allergy || null) : PH.otc(sym, C.form || 'tablets'); };
  // 상대가 알려 주는 복용법 (영어 · 한국어)
  PH.say = D => `Take ${PH.AMT[D.amt].t} ${PH.FREQ[D.freq].t}${D.time ? ' ' + PH.WHEN[D.time].t : ''}, ${PH.LEN[D.len].t}.`;
  PH.sayKo = D => `${PH.AMT[D.amt].ko} ${PH.FREQ[D.freq].ko}${D.time ? ', ' + PH.WHEN[D.time].ko : ''}, ${PH.LEN[D.len].ko} 드세요.`;
  // 빠르게 말할 때 (조각만 이어서)
  PH.sayFast = D => `${PH.AMT[D.amt].t[0].toUpperCase() + PH.AMT[D.amt].t.slice(1)}, ${PH.FREQ[D.freq].t}${D.time ? ' ' + PH.WHEN[D.time].t : ''}, ${PH.LEN[D.len].t.replace(/^for /, '')}.`;
  PH.rxSay = (sym, allergy) => { const R = PH.safeRx(sym, allergy), D = PH.rx(sym, allergy); return (R.alt ? `Since you're allergic to ${R.avoid}, I'll give you ${R.en}. ` : `I'm going to give you ${R.en}. `) + PH.say(D); };
  PH.rxSayKo = (sym, allergy) => { const R = PH.safeRx(sym, allergy), D = PH.rx(sym, allergy); return (R.alt ? `${R.avoid}에 알레르기가 있으니 ${R.ko}를 드릴게요. ` : `${R.ko}를 드릴게요. `) + PH.sayKo(D); };
  PH.BACK = { d2: { t: 'two days', ko: '이틀', days: 2 }, d3: { t: 'three days', ko: '사흘(3일)', days: 3 }, d5: { t: 'five days', ko: '5일', days: 5 }, w1: { t: 'a week', ko: '일주일', days: 7 } };
  PH.backSay = b => `If you're not feeling better in ${PH.BACK[b].t}, please come back and see me.`;
  PH.backSayKo = b => `${PH.BACK[b].ko} 뒤에도 낫지 않으면 다시 오세요.`;

  /* =========================================================
     말의 뜻(intent) — 질문의 모양과 기대하는 대답
     yn: Yes/No 질문에 그냥 Yes · No로만 답할 때 → { yes: 카드 → 카드가 바라는 Yes(true) · No(false) · 모름(null), need: 통과하지만 덧붙일 말, strict: 탈락 까닭 }
     key: 고르는 질문에서 고른 것을 담는 사실 이름 · best(카드, 말): 모범 틀
     ========================================================= */
  const I = (shape, ans, want, best, o = {}) => Object.assign({ shape, ans, want, best }, o);
  const SINCE_P = { yday: 1, lastnight: 1, mon: 1 };
  PH.INTENT = {
    need: I('wh', '무엇이 필요한지 묻는 질문', 'I have + 증상. + 부탁 질문 → I have a sore throat. Could you recommend something for it?', 'cs_rec', { turn: '증상 알리기' }),
    since: I('wh', '아픈 지 얼마나 됐는지 묻는 질문', 'For + 기간 · Since + 시작한 때 → For two days. · Since yesterday.', c => SINCE_P[c.since] ? 'sn_since' : 'sn_for', { turn: '얼마나 됐나' }),
    fever: I('yn', '열이 나는지 묻는 질문', 'Do you …? → Yes, I do. · No, I don\'t.', c => c.fever ? 'fv_yes' : 'fv_no', { turn: '열', yn: { yes: c => c.fever == null ? null : !!c.fever } }),
    allergy: I('yn', '약 알레르기가 있는지 묻는 질문', '있으면 무엇에 → Yes, I\'m allergic to penicillin. 없으면 질문의 짝으로 → No, I\'m not. · No, I don\'t.', (c, q) => c.allergy ? 'al_yes' : q && q.aux === 'do' ? 'al_dont' : 'al_not', { turn: '알레르기', yn: { yes: c => c.allergy === undefined ? null : !!c.allergy, strict: '알레르기가 있으면 무엇에 있는지 꼭 말해요. 안전과 관련된 말이에요 → Yes, I\'m allergic to penicillin.' } }),
    other: I('yn', '다른 약을 먹고 있는지 묻는 질문', 'Are you …? → No, I\'m not. · Yes, I\'m taking allergy pills.', c => c.other ? 'ot_yes' : 'ot_no', { turn: '다른 약', yn: { yes: c => c.other === undefined ? null : !!c.other, strict: '먹고 있는 약이 있으면 무엇인지도 말해요. 같이 먹으면 안 되는 약이 있을 수 있어요 → Yes, I\'m taking allergy pills.' } }),
    form: I('or', '알약과 물약 가운데 고르라는 질문', '고른 것 + please → Tablets, please. · Liquid, please.', 'fm_pl', { turn: '알약 · 물약', key: 'form' }),
    dose: I('note', '먹는 법(복용법)을 알려 주는 말', 'So, I take + 들은 조각을 차례대로? → So, I take two tablets, three times a day, after meals, for five days?', 'line', { turn: '복용법 되짚기', say: '먹는 법을 알려 주는 말이에요. 들은 조각을 한 줄로 되짚어 확인해요' }),
    cost: I('note', '값을 알려 주는 말', '카드로 내려면 Can I pay by card? 현금이면 Here you go. 숫자가 헷갈리면 → Sorry, did you say thirteen fifty?', c => c.paym === 'cash' ? 'co_here' : 'co_card', { turn: '값 듣기', say: '값을 알려 주는 말이에요. 숫자를 잘 들었는지 확인하고 내는 방법을 말해요' }),
    warn: I('note', '조심할 점을 알려 주는 말', '알아들었다고 하고 고맙다고 → Okay, I won\'t drive. Thanks. 모르는 낱말이면 → Sorry, what does drowsy mean?', 'wn_ok', { turn: '조심할 점', say: '조심할 점을 알려 주는 말이에요. 알아들었으면 짧게 답하고, 모르는 낱말이면 물어요' }),
    appt: I('yn', '예약했는지 묻는 질문', 'Do you …? → No, I don\'t. I\'d like to see a doctor, please.', c => c.appt ? 'ap_yes' : 'ap_no', { turn: '예약', yn: { yes: c => c.appt == null ? null : !!c.appt, need: '예약 없이 왔으면 바라는 것까지 → No, I don\'t. I\'d like to see a doctor, please.' } }),
    first: I('yn', '이 병원에 처음 왔는지 묻는 질문', 'Is this …? → Yes, it is. · No, it isn\'t.', c => c.first ? 'fs_yes' : 'fs_no', { turn: '처음 왔나', yn: { yes: c => c.first == null ? null : !!c.first } }),
    name: I('wh', '성(last name)을 묻는 질문', 'It\'s + 성 + 철자 → It\'s Kim, K-I-M.', 'nm_sp', { turn: '이름' }),
    spell: I('yn', '철자를 불러 달라는 부탁', 'Sure. + 한 글자씩 → Sure. K-I-M.', 'sp_ok', { turn: '철자', offer: true, yn: { yes: () => true, strict: '철자를 불러 달라는 부탁이에요. Yes만 하지 말고 한 글자씩 불러요 → Sure. K-I-M.' } }),
    dob: I('wh', '생년월일을 묻는 질문', 'It\'s + 달 · 날 · 해 → It\'s March 4th, 2005.', 'db_is', { turn: '생년월일' }),
    ins: I('yn', '건강 보험이 있는지 묻는 질문', 'Do you …? → Yes, I do. I have travel insurance.', 'is_yes', { turn: '보험', yn: { yes: c => c.ins == null ? null : !!c.ins, need: '어떤 보험인지 말하고 보험 카드를 보여 줘요 → Yes, I do. I have travel insurance.' } }),
    fill: I('note', '서류를 쓰고 앉아 기다리라는 안내', '알겠다고 짧게 + 고맙다고 → Sure. Thank you.', 'fl_ok', { turn: '서류 쓰기', say: '서류를 쓰고 앉아 기다리라는 안내예요. 알겠다고 짧게 답해요' }),
    prob: I('wh', '어디가 아픈지 묻는 질문', 'I have + 증상 → I have a sore throat. · My throat hurts.', 'pb_have', { turn: '증상 설명' }),
    took: I('yn', '먹은 약이 있는지 묻는 질문', 'Have you …? → Yes, I took some cold medicine. · No, I haven\'t.', c => c.took ? 'tk_yes' : 'tk_no', { turn: '먹은 약', yn: { yes: c => c.took === undefined ? null : !!c.took, need: '무슨 약을 먹었는지도 말해요 → Yes, I took some cold medicine.' } }),
    where: I('wh', '어디가 아픈지(자리) 묻는 질문', 'It hurts + 자리 → It hurts in my throat.', 'wh_in', { turn: '아픈 자리' }),
    press: I('yn', '눌렀을 때 아픈지 묻는 질문', 'Does it …? → Yes, it does. · No, it doesn\'t.', c => c.press ? 'pr_yes' : 'pr_no', { turn: '누르면 아픈가', yn: { yes: c => c.press == null ? null : !!c.press } }),
    scale: I('wh', '얼마나 아픈지 숫자로 묻는 질문', 'About a + 숫자 → About a six.', 'sc_about', { turn: '아픈 정도' }),
    back: I('note', '낫지 않으면 다시 오라는 말', 'So, + 들은 기간? → So, I should come back in three days if I\'m not better?', 'bk_so', { turn: '다시 올 날', say: '다시 올 날을 알려 주는 말이에요. 숫자는 되짚어 확인해요' }),
    q: I('yn', '더 물어볼 것이 있는지 묻는 질문', '진단서가 필요하면 → Yes. Could I get a doctor\'s note for my class? 없으면 → No, that\'s all. Thank you so much!', c => c.note ? 'q_note' : 'q_no', { turn: '진단서 · 마무리', yn: { yes: c => c.note == null ? null : !!c.note, strict: '물어볼 것이 있으면 Yes만 하지 말고 바로 물어요 → Yes. Could I get a doctor\'s note for my class?' } }),
    repair: I(null, '다시 묻는 말', '', 'rp_again'),
  };
  PH.sayOf = intent => { const it = PH.INTENT[intent]; return it.say || PH.SHAPE[it.shape].say; };
  PH.INTENT_KO = {}; Object.entries(PH.INTENT).forEach(([k, v]) => { PH.INTENT_KO[k] = v.turn || ''; });
  PH.CROSS = {};

  /* =========================================================
     상대의 말. key: 열쇠 낱말(말 안에 꼭 있어야 함) · shape: 질문의 모양 · choices: 고르는 질문에서 고를 것(사실 값)
     fast: 너무 빨라 못 알아들은 말 · short: 지도에 쓰는 짧은 꼴 · fact: 그 말이 알려 준 사실 · allow: 대답 대신 해도 되는 다시 묻기(틀 id)
     aux: Yes/No 질문의 첫 낱말 짝(do · be · is · does · have)
     ========================================================= */
  PH.Q = {};
  const Q = (id, place, intent, en, ko, key, o = {}) => (PH.Q[id] = Object.assign({ id, place, intent, en, ko, key, shape: PH.INTENT[intent].shape, sp: PH.PLACE[place].sp }, o));
  // 영상 · 직접 해 보기의 환자 (목이 아파요 · 알약 · 알레르기 없음)
  const D0 = PH.otc('sorethroat', 'tablets'), R0 = PH.rx('sorethroat', null);
  // 약국 카운터 (내가 먼저)
  Q('cn_what', 'counter', 'need', 'Hi there. What can I get for you today?', '안녕하세요. 오늘 무엇을 드릴까요?', ['What can I get'], { short: 'What can I get for you?' });
  Q('cn_au', 'counter', 'need', 'Morning! What can I do for you?', '(호주) 안녕하세요! 무엇을 도와드릴까요?', ['What can I do'], { sp: 'au', short: 'What can I do for you? (호주)' });
  Q('cn_fast', 'counter', 'need', 'Hi, what can I getcha?', '안녕하세요, 뭘 드릴까요?', ['getcha'], { fast: true });
  // 약사의 질문
  Q('ak_long', 'ask', 'since', 'Okay. How long have you had it?', '네. 아픈 지 얼마나 되셨어요?', ['How long'], { short: 'How long have you had it?' });
  Q('ak_fever', 'ask', 'fever', 'Do you have a fever?', '열이 있으세요?', ['fever'], { aux: 'do', short: 'Do you have a fever?' });
  Q('ak_allergy', 'ask', 'allergy', 'Are you allergic to any medicine?', '약에 알레르기가 있으세요?', ['allergic'], { aux: 'be', short: 'Are you allergic to any medicine?' });
  Q('ak_other', 'ask', 'other', 'Are you taking any other medication?', '다른 약을 드시고 계세요?', ['other medication'], { aux: 'be', short: 'Any other medication?' });
  Q('ak_form', 'ask', 'form', 'Would you prefer tablets or liquid?', '알약이 좋으세요, 물약이 좋으세요?', ['tablets or liquid'], { choices: ['tablets', 'liquid'], short: 'Tablets or liquid?' });
  Q('ak_fast', 'ask', 'allergy', 'You allergic to anything?', '뭐 알레르기 있어요?', ['allergic'], { fast: true, aux: 'be' });
  // 복용법 · 값
  Q('ds_say', 'dose', 'dose', PH.say(D0), PH.sayKo(D0), ['three times a day'], { fact: { dk: 'ph' }, short: 'Take two tablets three times a day …' });
  Q('ds_fast', 'dose', 'dose', PH.sayFast(D0), PH.sayKo(D0), ['times a day'], { fact: { dk: 'ph' }, fast: true });
  Q('ds_cost', 'dose', 'cost', 'Okay, that\'s $13.50, please.', '네, 13달러 50센트예요.', ['$13.50'], { fact: { amount: 1350 }, short: 'That\'s $13.50.' });
  Q('ds_warn', 'dose', 'warn', 'This one may make you a little drowsy, so don\'t drive after you take it.', '이 약은 조금 졸릴 수 있으니, 드신 뒤에는 운전하지 마세요.', ['drowsy'], { allow: ['rp_wdrowsy'], short: 'It may make you drowsy.' });
  // 병원 접수
  Q('fr_appt', 'front', 'appt', 'Hi there. Do you have an appointment?', '안녕하세요. 예약하셨어요?', ['appointment'], { aux: 'do', short: 'Do you have an appointment?' });
  Q('fr_first', 'front', 'first', 'Is this your first visit here?', '여기 처음 오셨어요?', ['first visit'], { aux: 'is', short: 'Is this your first visit?' });
  Q('fr_name', 'front', 'name', 'Okay. What\'s your last name?', '네. 성이 어떻게 되세요?', ['last name'], { short: 'What\'s your last name?' });
  Q('fr_spell', 'front', 'spell', 'Could you spell that for me, please?', '철자를 불러 주시겠어요?', ['spell'], { short: 'Could you spell that?' });
  Q('fr_dob', 'front', 'dob', 'And what\'s your date of birth?', '그리고 생년월일이 어떻게 되세요?', ['date of birth'], { short: 'What\'s your date of birth?' });
  Q('fr_ins', 'front', 'ins', 'Do you have any health insurance?', '건강 보험이 있으세요?', ['insurance'], { aux: 'do', short: 'Do you have any health insurance?' });
  Q('fr_form', 'front', 'fill', 'Great. Please fill out this form and take a seat.', '좋아요. 이 서류를 쓰시고 앉아서 기다려 주세요.', ['fill out'], { short: 'Please fill out this form.' });
  Q('fr_fast', 'front', 'dob', 'And what\'s the date of birth?', '그리고 생년월일은요?', ['date of birth'], { fast: true });
  // 진료실 · 증상 설명
  Q('dc_prob', 'doctor', 'prob', 'Hi, I\'m Dr. Hall. So, what seems to be the problem?', '안녕하세요, 의사 홀이에요. 그래서, 어디가 불편하세요?', ['problem'], { short: 'What seems to be the problem?' });
  Q('dc_took', 'doctor', 'took', 'Have you taken anything for it?', '그것 때문에 드신 약이 있어요?', ['taken anything'], { aux: 'have', short: 'Have you taken anything for it?' });
  Q('dc_fast', 'doctor', 'prob', 'So what brings you in today?', '그래서 오늘은 어떻게 오셨어요?', ['brings you in'], { fast: true });
  // 진찰 · 아픈 곳
  Q('ex_where', 'exam', 'where', 'Okay. Where does it hurt?', '네. 어디가 아프세요?', ['Where'], { short: 'Where does it hurt?' });
  Q('ex_press', 'exam', 'press', 'Does it hurt when I press here?', '여기를 누르면 아파요?', ['press here'], { aux: 'does', short: 'Does it hurt when I press here?' });
  Q('ex_scale', 'exam', 'scale', 'How bad is the pain, on a scale of one to ten?', '1부터 10까지로 치면 얼마나 아파요?', ['scale of one to ten'], { short: 'How bad is the pain, 1 to 10?' });
  Q('ex_allergy', 'exam', 'allergy', 'Do you have any allergies to medication?', '약 알레르기가 있으세요?', ['allergies'], { aux: 'do', short: 'Any allergies to medication?' });
  // 처방 · 다음 진료 (마지막에 내가 먼저 부탁)
  Q('pl_rx', 'plan', 'dose', PH.rxSay('sorethroat', null), PH.rxSayKo('sorethroat', null), ['twice a day'], { fact: { dk: 'rx' }, short: 'Take one capsule twice a day …' });
  Q('pl_fast', 'plan', 'dose', 'Antibiotics. ' + PH.sayFast(R0), PH.rxSayKo('sorethroat', null), ['twice a day'], { fact: { dk: 'rx' }, fast: true });
  Q('pl_back', 'plan', 'back', PH.backSay('d3'), PH.backSayKo('d3'), ['come back'], { fact: { back: 'd3' }, short: 'Come back in three days if …' });
  Q('pl_q', 'plan', 'q', 'Do you have any other questions?', '더 물어보실 것 있어요?', ['other questions'], { aux: 'do', short: 'Any other questions?' });
  // 곳마다 대표 말 (영상 01장 지도 · 직접 해 보기)
  PH.PLACEQ = {
    counter: ['cn_what', 'cn_au'], ask: ['ak_long', 'ak_form'], dose: ['ds_say', 'ds_cost'], front: ['fr_appt', 'fr_dob'],
    doctor: ['dc_prob', 'dc_took'], exam: ['ex_where', 'ex_press'], plan: ['pl_rx', 'pl_q'],
  };

  /* =========================================================
     칸에 넣는 내 정보 (slot). 틀(frame)이 form으로 어느 꼴을 쓸지 정해요.
     fact: 이 값이 말하는 사실 · bad · why: 콩글리시 값(② 탈락) · note: 통하지만 덧붙일 말 · dyn: 값이 정해져 있지 않은 칸
     ========================================================= */
  PH.SLOT = {
    sym: { key: 'sym', vals: Object.fromEntries(PH.SYM_IDS.map(id => [id, { t: PH.SYM[id].en, ko: PH.SYM[id].ko }])) },
    part: { key: 'part', vals: Object.fromEntries(PH.PART_IDS.map(id => [id, Object.assign({}, PH.PART[id])])) },
    sinceP: { key: 'since', vals: { yday: { t: 'yesterday', ko: '어제부터' }, lastnight: { t: 'last night', ko: '어젯밤부터' }, mon: { t: 'Monday', ko: '월요일부터' } } },
    durP: { key: 'since', vals: { '2d': { t: 'two days', ko: '이틀 동안' }, '3d': { t: 'three days', ko: '사흘 동안' }, '1w': { t: 'a week', ko: '일주일 동안' } } },
    form: { key: 'form', vals: { tablets: { t: 'tablets', ko: '알약' }, liquid: { t: 'liquid', ko: '물약' } } },
    allergen: { key: 'allergy', vals: { penicillin: { t: 'penicillin', ko: '페니실린' }, aspirin: { t: 'aspirin', ko: '아스피린' } } },
    omed: { key: 'other', vals: { allergy: { t: 'allergy pills', ko: '알레르기약' }, vitamin: { t: 'vitamins', ko: '비타민' } } },
    medname: { key: 'took', vals: Object.fromEntries(PH.MED_IDS.map(id => [id, { t: PH.MEDS[id].en, ko: PH.MEDS[id].ko }])) },
    name: { key: 'name', vals: Object.fromEntries(PH.NAME_IDS.map(id => [id, Object.assign({}, PH.NAMES[id])])) },
    spell: { key: 'spell', dyn: 'letters' },
    dob: { key: 'dob', dyn: 'dob' },
    ins: { key: 'ins', vals: { travel: { t: 'travel insurance', ko: '여행자 보험' }, student: { t: 'student health insurance', ko: '학생 건강 보험' } } },
    num: { key: 'scale', dyn: 'num' },
    days: { key: 'back', vals: Object.fromEntries(Object.keys(PH.BACK).map(id => [id, { t: PH.BACK[id].t, ko: PH.BACK[id].ko }])) },
    money: { key: 'amount', dyn: 'money' },
  };
  // 칸 값 하나 (값이 정해져 있지 않은 칸도)
  PH.sv = function (slot, v) {
    const S = PH.SLOT[slot]; if (!S || v == null) return null;
    if (S.dyn === 'money') return /^\d+$/.test(String(v)) ? { t: PH.money(+v), ko: PH.priceKo(+v), fact: { [S.key]: +v } } : null;
    if (S.dyn === 'letters') return /^[A-Z](-[A-Z])+$/.test(String(v)) ? { t: String(v), ko: `${String(v)} (한 글자씩)`, fact: { spell: String(v) } } : null;
    if (S.dyn === 'dob') return ymd(v) ? { t: PH.dateText(v), nums: PH.dateNums(v), ko: PH.dateKo(v), fact: { dob: String(v) } } : null;
    if (S.dyn === 'num') return /^\d+$/.test(String(v)) && +v >= 0 && +v <= 10 ? { t: (+v === 8 || +v === 11 ? 'an ' : 'a ') + numWord(+v), ko: `${v}점`, fact: { scale: +v } } : null;
    return S.vals[v] || null;
  };
  const valFact = (slot, v) => { const x = PH.sv(slot, v); if (!x) return {}; return x.fact ? Object.assign({}, x.fact) : { [PH.SLOT[slot].key]: v }; };
  PH.valFact = valFact;
  // 카드와 맞는 칸 값 (콩글리시 · 알림이 붙는 값은 빼고)
  const slotIds = slot => { const S = PH.SLOT[slot]; return S.dyn ? [] : Object.keys(S.vals).filter(id => { const x = S.vals[id]; return !x.bad && !x.note; }); };
  PH.slotIds = slotIds;
  PH.slotVal = function (slot, C, q) {
    const S = PH.SLOT[slot];
    if (S.dyn === 'money') { const v = C[S.key]; return v != null ? String(v) : null; }
    if (S.dyn === 'letters') return C.spell || (C.name && PH.NAMES[C.name] ? PH.NAMES[C.name].letters : null);
    if (S.dyn === 'dob') return C.dob || null;
    if (S.dyn === 'num') return C.scale != null ? String(C.scale) : null;
    const ids = slotIds(slot);
    const fit = id => { const f = valFact(slot, id); return Object.keys(f).length && Object.keys(f).every(k => C[k] === f[k]); };
    return ids.find(fit) || null;
  };

  /* =========================================================
     되짚는 한 줄 — 조각과 순서: So, I take → 양 → 하루 몇 번 → 언제 → 며칠 동안
     들은 차례대로, 들은 조각을 모두 넣어요. (자주 쓰는 꼴을 단순하게 줄인 규칙)
     줄 = { words: [조각 id, …] }
     ========================================================= */
  PH.OW = {
    so: { c: 'open', t: 'So, I take' },
    eat: { c: 'open', t: 'So, I eat', bad: 'literal', why: '‘약을 먹다’를 eat으로 옮기면 약을 음식처럼 씹어 먹는다는 말로 들려요. 약은 → take (So, I take …?).' },
  };
  Object.entries(PH.AMT).forEach(([id, x]) => { PH.OW[id] = { c: 'amt', t: x.t, v: id, ko: x.ko }; });
  Object.entries(PH.FREQ).forEach(([id, x]) => { PH.OW[id] = { c: 'freq', t: x.t, v: id, ko: x.ko }; });
  PH.OW.x3 = { c: 'freq', t: 'three times one day', v: 'f3', ko: '(어색한 말) 하루 세 번', bad: 'literal', why: '‘하루 세 번’을 낱말 그대로 옮긴 three times one day는 영어로 쓰지 않는 말이에요. 하루에 몇 번 → three times a day (a = ‘~마다’).' };
  Object.entries(PH.WHEN).forEach(([id, x]) => { PH.OW[id] = { c: 'time', t: x.t, v: id, ko: x.ko }; });
  Object.entries(PH.LEN).forEach(([id, x]) => { PH.OW[id] = { c: 'len', t: x.t, v: id, ko: x.ko }; });
  Object.entries(PH.OW).forEach(([id, w]) => { w.id = id; });
  PH.OCAT = { open: { ko: '되짚는 틀(So, I take)', n: 0 }, amt: { ko: '한 번에 먹는 양', n: 1 }, freq: { ko: '하루 몇 번', n: 2 }, time: { ko: '언제(식전 · 식후)', n: 3 }, len: { ko: '며칠 동안', n: 4 } };
  // 들은 복용법의 모범 한 줄
  PH.lineWords = D => ['so', D.amt, D.freq].concat(D.time ? [D.time] : [], [D.len]);
  // 틀린 조각 찾기 → { type, word, right } (첫 번째 것)
  function lineErr(W, D) {
    for (const x of W) {
      if (x.c === 'amt' && x.v !== D.amt) return { type: 'amt', word: x, right: D.amt };
      if (x.c === 'freq' && x.v !== D.freq) return { type: 'freq', word: x, right: D.freq };
      if (x.c === 'time' && !D.time) return { type: 'notime', word: x, right: null };
      if (x.c === 'time' && x.v !== D.time) return { type: 'time', word: x, right: D.time };
      if (x.c === 'len' && x.v !== D.len) return { type: 'len', word: x, right: D.len };
    }
    return null;
  }
  const ERR_KO = { amt: '한 번에 먹는 양', freq: '하루 몇 번', notime: '언제(이 약은 시간 간격만 지켜요)', time: '언제(식전 · 식후)', len: '며칠 동안' };
  PH.ERR_KO = ERR_KO;
  PH.checkLine = function (Lw, C = {}) {
    const ws = Lw.words || Lw, W = ws.map(w => PH.OW[w]);
    if (!ws.length) return { ok: false, stage: 1, why: '아직 아무것도 고르지 않았어요.' };
    if (W.some(x => !x)) return { ok: false, stage: 2, why: '사전에 없는 조각이 있어요.' };
    const D = PH.doseOf(C), want = PH.lineWords(D);
    const n = c => W.filter(x => x.c === c).length;
    for (const c of Object.keys(PH.OCAT)) if (n(c) > 1) return { ok: false, stage: 2, why: `${eun(PH.OCAT[c].ko)} 한 번만 말해요.`, want, tag: 'order' };
    if (!n('open')) return { ok: false, stage: 2, why: '되짚는 틀(So, I take …?)이 빠졌어요. 조각만 늘어놓으면 확인하는 말인지 알기 어려워요.', want, tag: 'order' };
    for (let k = 1; k < W.length; k++) if (PH.OCAT[W[k].c].n <= PH.OCAT[W[k - 1].c].n) return { ok: false, stage: 2, why: `순서가 뒤섞여 알아듣기 어려워요. 들은 차례대로 되짚어요 → ${PH.lineText({ words: want })}`, want, tag: 'order' };
    const bad = W.find(x => x.bad);
    if (bad) return { ok: false, stage: 2, why: bad.why, want, tag: bad.bad, badW: bad };
    const e = lineErr(W, D);
    if (e) {
      const why = e.type === 'notime' ? `이 약은 식사와 상관없이 시간 간격만 지켜요(${PH.FREQ[D.freq].t}). 들은 복용법: ${PH.lineText({ words: want })}`
        : `들은 복용법과 달라요(${ERR_KO[e.type]}). 안내: ${PH.OW[e.right].t} · 이 되짚기: ${e.word.t}.` + (e.type === 'amt' && PH.AMT[e.right].unit === 'ml' ? ' 15와 50처럼 -teen과 -ty는 헷갈리기 쉬워요. 뒤가 세면 fifTEEN, 앞이 세면 FIFty.' : '');
      return { ok: false, stage: 2, why, want, tag: 'fact', err: e };
    }
    const need = ['amt', 'freq'].concat(D.time ? ['time'] : [], ['len']).filter(c => !W.some(x => x.c === c));
    if (need.length) return { ok: false, stage: 2, why: `빠진 조각이 있어요: ${need.map(c => PH.OCAT[c].ko).join(' · ')}. 들은 조각을 모두 되짚어야 먹는 법이 맞는지 알 수 있어요 → ${PH.lineText({ words: want })}`, want, tag: 'need', missing: need };
    return { ok: true, why: `${W.slice(1).map(x => PH.OCAT[x.c].ko).join(' → ')}. 들은 차례대로 빠짐없이 되짚었어요.`, want };
  };
  // 상대가 고쳐 주는 말 (틀린 첫 조각만) · 맞으면 That's right!
  PH.fixLine = function (Lw, C) {
    const o = PH.checkLine(Lw, C), D = PH.doseOf(C || {});
    if (o.ok) return { en: 'That\'s right!', ko: '맞아요!' };
    if (o.tag === 'fact' && o.err) {
      if (o.err.type === 'notime') return { en: `No — just ${PH.FREQ[D.freq].t}. It doesn't matter when you eat.`, ko: '아니요 — 시간 간격만 지키면 돼요. 식사와는 상관없어요.' };
      return { en: `Not quite — ${PH.OW[o.err.right].t}, not ${o.err.word.t}.`, ko: `조금 달라요 — ${PH.OW[o.err.right].t}예요.` };
    }
    if (o.tag === 'need') return { en: `Yes — and ${o.missing.map(c => PH.OW[o.want.find(id => PH.OW[id].c === c)].t).join(', ')}.`, ko: `네 — 그리고 빠진 조각: ${o.missing.map(c => PH.OCAT[c].ko).join(' · ')}.` };
    if (o.tag === 'literal') return o.badW && o.badW.id === 'eat' ? { en: 'Sorry — eat them? Oh, you mean take them. Yes.', ko: '약은 eat이 아니라 take예요.' } : { en: 'Three times a day — yes.', ko: '하루 세 번 → three times a day.' };
    return { en: 'Sorry, could you say that again?', ko: '순서가 뒤섞여 알아듣기 어려워요.' };
  };
  PH.lineFacts = () => ({});
  function lineSegs(Lw) {
    const ws = Lw.words || Lw, W = ws.map(w => PH.OW[w]).filter(Boolean), out = [];
    W.forEach((x, i) => {
      if (i) out.push({ t: i === 1 && W[0].c === 'open' ? ' ' : ', ', r: 'frame' });
      if (x.c === 'open') out.push({ t: x.t, r: x.bad ? 'trap' : 'frame', part: 'open' });
      else out.push({ t: x.t, r: x.bad ? 'trap' : 'slot', part: x.c });
    });
    if (out.length) { out[0].t = out[0].t[0].toUpperCase() + out[0].t.slice(1); out.push({ t: W.some(x => x.c === 'open') ? '?' : '.', r: 'frame' }); }
    return out;
  }
  PH.lineSegs = lineSegs;
  PH.lineText = Lw => lineSegs(Lw).map(s => s.t).join('');
  PH.lineKo = function (Lw) {
    const W = (Lw.words || Lw).map(w => PH.OW[w]).filter(Boolean), eat = W.some(x => x.id === 'eat');
    return `그러니까 제가 ${W.filter(x => x.c !== 'open').map(x => x.ko).join(', ')} ${eat ? '(음식처럼) 먹는' : '먹는'} 거죠?`;
  };

  /* =========================================================
     대답 틀 (frame). t: 틀 글 — ___ = 내 정보 칸, {…} = 공손한 말
     tag: ok · literal(한국어 그대로 · 콩글리시) · wrong(틀린 문장) · blunt(명령 · 따지기) · plain(고맙다는 말 없이 끊김)
     bare: Yes · No만 하는 대답(yes: true · false) · aux: 짧은 대답의 짝(do · be · is · does · have)
     half: 사실만 말하고 부탁이 빠진 말 · check: 들은 값을 되짚어 확인하는 말 · skip: 되짚지 않고 넘어가는 말
     ========================================================= */
  PH.FRAME = {};
  const FR = (id, intent, t, ko, o = {}) => (PH.FRAME[id] = Object.assign({ id, intent, t, ko, tag: 'ok' }, o));
  // Yes · No만 하는 대답 (고르는 질문 · 정보 질문에는 ① 탈락)
  FR('g_yes', 'yn', 'Yes.', '네.', { bare: true, yes: true });
  FR('g_yesp', 'yn', 'Yes, {please}.', '네, 주세요.', { bare: true, yes: true });
  FR('g_no', 'yn', 'No, {thanks}.', '아니요, 괜찮아요.', { bare: true, yes: false });
  // 약국 카운터 · 증상 알리기 (사실 + 부탁)
  FR('cs_rec', 'need', 'I have ___. {Could you recommend something for it?}', '___. 먹을 만한 약을 추천해 주시겠어요?', { slot: 'sym' });
  FR('cs_any', 'need', 'I have ___. {Do you have anything for it?}', '___. 먹을 만한 약이 있을까요?', { slot: 'sym' });
  FR('cs_fact', 'need', 'I have ___.', '___.', { slot: 'sym', half: true, why: '증상(사실)만 말하고 끝났어요. 무엇을 바라는지 부탁도 질문으로 덧붙여요 → I have a sore throat. Could you recommend something for it?' });
  FR('cs_sick', ['need', 'prob', 'where'], 'My ___ is sick.', '(어색한 말) 제 ___ 쪽이 병났어요.', { slot: 'part', form: 'n', tag: 'literal', why: '‘목이 아파요’를 낱말 그대로 옮긴 My throat is sick.은 ‘내 목이 병들었다’처럼 어색하게 들려요. 아픈 곳은 → I have a sore throat. · My throat hurts.' });
  FR('cs_give', 'need', 'Give me medicine for ___.', '(명령) ___ 약 줘요.', { slot: 'sym', tag: 'blunt', why: '‘약 주세요’를 그대로 옮긴 Give me는 명령처럼 들려요. 증상을 말하고 부탁은 질문으로 → I have a sore throat. Could you recommend something for it?' });
  // 얼마나 됐나
  FR('sn_for', 'since', 'For ___.', '___이요.', { slot: 'durP' });
  FR('sn_since', 'since', 'Since ___.', '___이요.', { slot: 'sinceP' });
  FR('sn_dur', 'since', 'During ___.', '(어색한 말) ___이요.', { slot: 'durP', tag: 'literal', why: '‘이틀 동안’의 ‘동안’을 during으로 옮겼어요. during 뒤에는 그때의 이름(the night · my trip)이 와요. 숫자로 센 기간은 → For two days.' });
  FR('sn_from', 'since', 'From ___.', '(어색한 말) ___이요.', { slot: 'sinceP', tag: 'literal', why: '‘어제부터’의 ‘부터’를 from으로 옮겼어요. 지금까지 이어지는 일이 시작된 때는 → Since yesterday.' });
  // 열 · 알레르기 · 다른 약
  FR('fv_yes', 'fever', 'Yes, I do.', '네, 있어요.', { aux: 'do', fact: { fever: true } });
  FR('fv_no', 'fever', 'No, I don\'t.', '아니요, 없어요.', { aux: 'do', fact: { fever: false } });
  FR('fv_am', 'fever', 'Yes, I am.', '네, 그래요.', { aux: 'be', fact: { fever: true } });
  FR('fv_have', 'fever', 'No, I don\'t have.', '(틀린 말) 아니요, 없어요.', { fact: { fever: false }, tag: 'wrong', why: 'have 뒤에 무엇이 없는지가 빠져 문장이 끝나지 않아요. Do you have …? 질문에는 → No, I don\'t.' });
  FR('al_yes', 'allergy', 'Yes, I\'m allergic to ___.', '네, ___에 알레르기가 있어요.', { slot: 'allergen' });
  FR('al_not', 'allergy', 'No, I\'m not.', '아니요, 없어요.', { aux: 'be', fact: { allergy: null } });
  FR('al_dont', 'allergy', 'No, I don\'t.', '아니요, 없어요.', { aux: 'do', fact: { allergy: null } });
  FR('al_allergy', 'allergy', 'Yes, I\'m allergy to ___.', '(틀린 말) 네, ___ 알레르기예요.', { slot: 'allergen', tag: 'wrong', why: 'allergy는 명사(알레르기)예요. ‘~에 알레르기가 있어요’는 → I\'m allergic to penicillin.' });
  FR('ot_no', 'other', 'No, I\'m not.', '아니요, 안 먹어요.', { aux: 'be', fact: { other: null } });
  FR('ot_yes', 'other', 'Yes, I\'m taking ___.', '네, ___을 먹고 있어요.', { slot: 'omed' });
  FR('ot_eat', 'other', 'Yes, I\'m eating ___.', '(어색한 말) 네, ___을 (음식처럼) 먹고 있어요.', { slot: 'omed', tag: 'literal', why: '‘약을 먹다’를 eat으로 옮기면 약을 음식처럼 먹는다는 말로 들려요. 약은 → take (I\'m taking allergy pills).' });
  FR('fm_pl', 'form', '___, {please}.', '___(으)로 주세요.', { slot: 'form' });
  // 복용법 · 값 · 조심할 점
  FR('line', 'dose', '', '', { line: true });   // 되짚는 한 줄 (PH.checkLine)
  FR('ds_ok', 'dose', 'Okay. {Thanks}.', '알겠어요. 고마워요.', { skip: true, why: '고맙다고만 하면 들은 복용법이 맞는지 확인하지 못해요. 숫자가 많은 설명은 들은 조각을 한 줄로 되짚어 확인해요 → So, I take …?' });
  FR('co_card', 'cost', 'Can I pay by card?', '카드로 내도 돼요?', { fact: { paym: 'card' } });
  FR('co_here', 'cost', 'Here you go.', '여기요.', { fact: { paym: 'cash' } });
  FR('co_say', 'cost', '{Sorry}, did you say ___?', '죄송한데, ___라고 하셨어요?', { slot: 'money', check: true });
  FR('co_lit', 'cost', 'Card is okay?', '(어색한 말) 카드 돼요?', { fact: { paym: 'card' }, tag: 'literal', why: '‘카드 돼요?’를 낱말 그대로 옮긴 말이라 무엇이 괜찮은지 알기 어려워요. 카드로 내도 되는지 물을 때는 → Can I pay by card?' });
  FR('co_exp', 'cost', 'So expensive. Cheaper, {please}.', '(조르는 말) 너무 비싸요. 깎아 주세요.', { tag: 'blunt', why: '약값은 정해져 있어서 깎지 않아요. 조르는 말처럼 들려요. 값이 걱정되면 더 싼 약이 있는지 물어요 → Is there a cheaper one?' });
  FR('wn_ok', 'warn', 'Okay, I won\'t drive. {Thanks}.', '알겠어요, 운전하지 않을게요. 고마워요.', { fact: { drive: false } });
  FR('wn_drive', 'warn', 'Okay. I\'ll drive carefully.', '알겠어요. 조심해서 운전할게요.', { fact: { drive: true } });
  // 병원 접수
  FR('ap_no', 'appt', 'No, I don\'t. I\'d like to see a doctor, {please}.', '아니요, 안 했어요. 의사 선생님께 진료를 받고 싶어요.', { aux: 'do', fact: { appt: false } });
  FR('ap_want', 'appt', 'No. I want doctor.', '(어색한 말) 아니요. 의사 원해요.', { fact: { appt: false }, tag: 'literal', why: '‘의사 원해요’를 낱말 그대로 옮긴 말이라 퉁명스럽게 들리고 a도 빠졌어요. 진료를 받고 싶다는 말은 → I\'d like to see a doctor, please.' });
  FR('fs_yes', 'first', 'Yes, it is.', '네, 처음이에요.', { aux: 'is', fact: { first: true } });
  FR('fs_no', 'first', 'No, it isn\'t.', '아니요, 와 본 적 있어요.', { aux: 'is', fact: { first: false } });
  FR('fs_lit', 'first', 'Yes, I am first.', '(어색한 말) 네, 제가 처음이에요.', { fact: { first: true }, tag: 'literal', why: '‘저 처음이에요’를 낱말 그대로 옮긴 I am first는 ‘제가 (줄의) 1등이에요’로 들려요. 처음 왔다는 말은 → Yes, it is. (It\'s my first visit.)' });
  FR('nm_sp', 'name', 'It\'s ___.', '___(이)에요. (철자도 불러요)', { slot: 'name', form: 'sp' });
  FR('sp_ok', 'spell', '{Sure.} ___.', '네. ___.', { slot: 'spell' });
  FR('db_is', 'dob', 'It\'s ___.', '___(이)에요.', { slot: 'dob' });
  FR('db_ko', 'dob', '___.', '(숫자만) ___.', { slot: 'dob', form: 'nums', tag: 'literal', why: '숫자만 한국식 순서(해 · 달 · 날)로 말하면 3월 4일인지 4월 3일인지 헷갈려요. 달은 이름으로 → It\'s March 4th, 2005.' });
  FR('is_yes', 'ins', 'Yes, I do. I have ___. {Here\'s my card.}', '네, ___이 있어요. 여기 카드요.', { slot: 'ins', aux: 'do' });
  FR('is_have', 'ins', 'Yes, I have.', '(틀린 말) 네, 있어요.', { tag: 'wrong', why: 'have 뒤에 무엇이 있는지가 빠져 문장이 끝나지 않아요. Do you have …? 질문에는 → Yes, I do. I have travel insurance.' });
  FR('fl_ok', 'fill', 'Sure. {Thank you}.', '네. 고마워요.', {});
  // 진료실 · 증상 설명
  FR('pb_have', 'prob', 'I have ___.', '___.', { slot: 'sym' });
  FR('pb_hurt', 'prob', 'My ___ hurts.', '제 ___ 쪽이 아파요.', { slot: 'part', form: 'n' });
  FR('tk_yes', 'took', 'Yes, I took some ___.', '네, ___을 먹었어요.', { slot: 'medname' });
  FR('tk_no', 'took', 'No, I haven\'t.', '아니요, 안 먹었어요.', { aux: 'have', fact: { took: null } });
  FR('tk_ate', 'took', 'Yes, I ate some ___.', '(어색한 말) 네, ___을 (음식처럼) 먹었어요.', { slot: 'medname', tag: 'literal', why: '‘약을 먹었어요’를 eat으로 옮기면 약을 음식처럼 먹었다는 말로 들려요. 약은 → take (I took some cold medicine).' });
  // 진찰 · 아픈 곳
  FR('wh_in', 'where', 'It hurts ___.', '___ 쪽이 아파요.', { slot: 'part' });
  FR('wh_pain', 'where', 'Here is pain.', '(어색한 말) 여기가 통증이에요.', { tag: 'literal', why: '‘여기가 통증이에요’를 낱말 그대로 옮긴 말이라 틀린 문장이에요. 아픈 자리는 → It hurts here, in my throat.' });
  FR('pr_yes', 'press', 'Yes, it does.', '네, 아파요.', { aux: 'does', fact: { press: true } });
  FR('pr_no', 'press', 'No, it doesn\'t.', '아니요, 안 아파요.', { aux: 'does', fact: { press: false } });
  FR('pr_is', 'press', 'Yes, it is.', '네, 그래요.', { aux: 'is', fact: { press: true } });
  FR('pr_isnt', 'press', 'No, it isn\'t.', '아니요, 안 그래요.', { aux: 'is', fact: { press: false } });
  FR('sc_about', 'scale', 'About ___.', '___쯤이에요.', { slot: 'num' });
  FR('sc_lit', 'scale', 'Very pain.', '(틀린 말) 많이 아파요.', { tag: 'literal', why: '‘많이 아파요’를 낱말 그대로 옮긴 Very pain.은 틀린 문장이고, 몇 점인지 묻는 말에 숫자가 없어요 → About a six.' });
  // 처방 · 다음 진료
  FR('bk_so', 'back', 'So, I should come back in ___ if I\'m not better?', '그러니까, ___ 뒤에도 안 나으면 다시 오면 되죠?', { slot: 'days', check: true });
  FR('bk_say', 'back', '{Sorry}, did you say ___?', '죄송한데, ___라고 하셨어요?', { slot: 'days', check: true });
  FR('bk_ok', 'back', 'Okay. {Thanks}.', '알겠어요. 고마워요.', { skip: true, why: '고맙다고만 하면 들은 기간이 맞는지 확인하지 못해요. 숫자는 되짚어 확인해요 → So, I should come back in three days if I\'m not better?' });
  FR('q_note', 'q', 'Yes. {Could I} get a doctor\'s note for my class?', '네. 수업에 낼 진단서(확인서)를 받을 수 있을까요?', { fact: { note: true } });
  FR('q_no', 'q', 'No, that\'s all. {Thank you so much}!', '아니요, 그거면 돼요. 정말 고맙습니다!', { fact: { note: false } });
  FR('q_diag', 'q', 'Yes. Please write me a diagnosis.', '(어색한 말) 네. 진단서 써 주세요.', { fact: { note: true }, tag: 'literal', why: '‘진단서’를 diagnosis로 옮기면 병의 이름(진단) 자체를 뜻해요. 학교 · 회사에 낼 확인서는 → a doctor\'s note (영국에서는 a sick note).' });
  FR('q_give', 'q', 'Give me a doctor\'s note.', '(명령) 진단서 줘요.', { fact: { note: true }, tag: 'blunt', why: '명령처럼 들려요. 부탁은 질문으로 → Could I get a doctor\'s note for my class?' });
  FR('q_plain', 'q', 'No.', '아니요.', { fact: { note: false }, tag: 'plain', why: '그냥 No.라고 끊으면 무뚝뚝하게 들려요. 진료해 준 의사에게는 → No, that\'s all. Thank you so much!' });
  // 다시 묻기. echo: 들린 만큼 되묻는 말 — 실제로 들은 말이어야 통과 · what: 모르는 낱말 묻기(allow)
  FR('rp_again', 'repair', '{Sorry? Could you} say that again, {please}?', '죄송한데, 다시 한 번 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_sorry', 'repair', '{Sorry}?', '네? (다시 말해 달라는 뜻)', { kind: 'again' });
  FR('rp_slow', 'repair', '{Could you} say that more slowly, {please}?', '조금 더 천천히 말씀해 주시겠어요?', { kind: 'slow' });
  FR('rp_write', 'repair', '{Could you} write that down for me, {please}?', '그걸 적어 주실 수 있을까요?', { kind: 'echo', echo: 'dose' });
  FR('rp_many', 'repair', '{Sorry}, how many tablets?', '죄송한데, 몇 알이요?', { kind: 'echo', echo: 'dose' });
  FR('rp_times', 'repair', '{Sorry}, how many times a day?', '죄송한데, 하루 몇 번이요?', { kind: 'echo', echo: 'dose' });
  FR('rp_need', 'repair', '{Sorry}, did you ask what I need?', '죄송한데, 무엇이 필요한지 물으셨어요?', { kind: 'echo', echo: 'need' });
  FR('rp_allergy', 'repair', '{Sorry}, did you ask about allergies?', '죄송한데, 알레르기를 물으셨어요?', { kind: 'echo', echo: 'allergy' });
  FR('rp_dob', 'repair', '{Sorry}, did you ask for my date of birth?', '죄송한데, 생년월일을 물으셨어요?', { kind: 'echo', echo: 'dob' });
  FR('rp_prob', 'repair', '{Sorry}, did you ask what\'s wrong?', '죄송한데, 어디가 아픈지 물으셨어요?', { kind: 'echo', echo: 'prob' });
  FR('rp_wdrowsy', 'repair', '{Sorry}, what does drowsy mean?', '죄송한데, drowsy가 무슨 뜻이에요?', { kind: 'what' });
  FR('rp_rude', 'repair', 'What?', '(퉁명스러운 말) 뭐라고요?', { kind: 'again', tag: 'blunt', why: 'What? 한 낱말은 퉁명스럽게 들릴 수 있어요. 못 알아들었으면 → Sorry? Could you say that again, please?' });

  /* ---------- 대답 글 만들기: 조각(segs) = [{ t, r: 'frame' | 'slot' | 'pol' }] ---------- */
  const slotText = (F, v) => { const x = PH.sv(F.slot, v); return x ? (x[F.form || 't'] != null ? x[F.form || 't'] : x.t) : '___'; };
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
  PH.segs = function (a) {
    const F = PH.FRAME[a.f];
    if (F.line) return lineSegs(a.line);
    return frameSegs(F, a.v);
  };
  PH.text = a => PH.segs(a).map(s => s.t).join('');
  // 해석
  const koOf = (F, v) => {
    if (!F.slot) return F.ko;
    const x = PH.sv(F.slot, v), k = x ? x.ko : '___';
    return F.ko.replace('___(으)로', ro(k)).replace('___(이)에요', ieyo(k)).replace('___이요', /요$/.test(k) ? k : k + (has(k) ? '이요' : '요')).replace('___을', eul(k)).replace('___이 ', ig(k) + ' ').replace('___', k);
  };
  PH.ko = function (a) {
    const F = PH.FRAME[a.f];
    if (F.line) return PH.lineKo(a.line);
    return koOf(F, a.v);
  };
  // 대답이 말하는 사실
  PH.factOf = function (a) {
    const F = PH.FRAME[a.f], f = Object.assign({}, F.fact || {});
    if (F.slot && PH.sv(F.slot, a.v)) Object.assign(f, valFact(F.slot, a.v));
    return f;
  };
  // 사실을 한국어로
  PH.factKo = function (k, v) {
    if (k === 'sym') return PH.SYM[v] ? PH.SYM[v].ko : String(v);
    if (k === 'part') return PH.PART[v] ? `${PH.PART[v].ko}(${PH.PART[v].n})` : String(v);
    if (k === 'since') { const S = PH.SLOT.sinceP.vals[v] || PH.SLOT.durP.vals[v]; return S ? S.ko : String(v); }
    if (k === 'fever') return v ? '열 있음' : '열 없음';
    if (k === 'allergy') return v ? `${PH.SLOT.allergen.vals[v] ? PH.SLOT.allergen.vals[v].ko : v} 알레르기` : '알레르기 없음';
    if (k === 'other') return v ? `${PH.SLOT.omed.vals[v] ? PH.SLOT.omed.vals[v].ko : v}을 먹고 있음` : '다른 약 없음';
    if (k === 'form') return v === 'liquid' ? '물약' : '알약';
    if (k === 'took') return v ? `${PH.MEDS[v] ? PH.MEDS[v].ko : v}을 먹었음` : '먹은 약 없음';
    if (k === 'paym') return v === 'card' ? '카드로 내기' : '현금으로 내기';
    if (k === 'amount') return `${PH.money(v)} (${PH.priceWords(v)})`;
    if (k === 'appt') return v ? '예약함' : '예약 안 함';
    if (k === 'first') return v ? '처음 옴' : '와 본 적 있음';
    if (k === 'name') return PH.NAMES[v] ? `${PH.NAMES[v].ko} · ${PH.NAMES[v].letters}` : String(v);
    if (k === 'spell') return `${v}`;
    if (k === 'dob') return `${PH.dateKo(v)} (${PH.dateText(v)})`;
    if (k === 'ins') return v ? (PH.SLOT.ins.vals[v] ? PH.SLOT.ins.vals[v].ko : '보험 있음') : '보험 없음';
    if (k === 'press') return v ? '누르면 아픔' : '눌러도 안 아픔';
    if (k === 'scale') return `${v}점`;
    if (k === 'back') return PH.BACK[v] ? `${PH.BACK[v].ko} 뒤 (${PH.BACK[v].t})` : String(v);
    if (k === 'note') return v ? '진단서 필요' : '진단서 필요 없음';
    if (k === 'drive') return v ? '운전함' : '운전하지 않음';
    const S = Object.values(PH.SLOT).find(s => s.key === k && s.vals && s.vals[v]);
    return S ? S.vals[v].ko : String(v);
  };

  /* ---------- 이미 답한 질문 (시뮬레이터의 상대가 건너뜀) ---------- */
  PH.coveredBy = (facts, intent) => (intent ? [intent] : []);
  PH.covered = (a, q) => { if (typeof q === 'string') q = PH.Q[q]; return PH.coveredBy(PH.factOf(a), q.intent); };
  PH.coveredKo = () => [];

  /* =========================================================
     판정 — PH.judge(상대의 말, 대답, 카드, 출처)
     q: PH.Q의 말(또는 id) · a: { f: 틀 id, v: 칸 값, line } · card: 사실 · src: '카드' | '상황'
     ========================================================= */
  const res = (ok, stage, why, tag) => ({ ok, stage, why, tag: tag || (ok ? 'ok' : '') });
  const shapeHead = q => `${q.key.join(' … ')} → ${PH.SHAPE[q.shape].ko}`;
  PH.judge = function (q, a, card, src = '카드') {
    if (typeof q === 'string') q = PH.Q[q];
    const F = PH.FRAME[a.f], C = Object.assign({}, card || {}, q.fact || {});
    const fi = [].concat(F.intent), key = q.key.join(' … '), In = PH.INTENT[q.intent], SHp = PH.SHAPE[q.shape];
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
      if (q.shape === 'note') return res(false, 1, `열쇠 낱말 ${key} → ${PH.sayOf(q.intent)}. 묻는 말이 아니라서 ${F.yes ? 'Yes' : 'No'}로 답할 일이 아니에요 → ${In.want}`, 'shape');
    } else if (!fi.includes(q.intent)) {
      if (F.intent === 'repair' && q.allow && q.allow.includes(F.id)) allowed = true;
      else if (F.intent === 'repair') return res(false, 1, '대답이 아니라 다시 묻는 말이에요. 알아들었다면 바로 답해요.', 'intent');
      else {
        const other = PH.INTENT[fi[0]];
        return res(false, 1, `${shapeHead(q)}${q.shape === 'note' ? '' : `(${SHp.ans})`}. 이 대답은 ${other.ans}에 맞는 말이에요.`, 'intent');
      }
    }
    // 고르는 질문: 상대가 말한 것 가운데 골랐나
    const fact = PH.factOf(a);
    if (q.shape === 'or' && q.choices && !F.bare && F.intent !== 'repair' && In.key) {
      const v = fact[In.key];
      if (v != null && !q.choices.includes(v)) return res(false, 1, `${shapeHead(q)}. 상대가 말한 것(${q.choices.map(c => PH.factKo(In.key, c)).join(' · ')}) 가운데 하나를 골라요. ${eun(PH.factKo(In.key, v))} 묻지 않았어요.`, 'choice');
    }
    if (F.line) { const o = PH.checkLine(a.line, C); if (!o.ok && o.stage === 1) return res(false, 1, o.why, 'intent'); }
    // ② 틀에 내 정보 넣기
    if (F.tag === 'literal' || F.tag === 'wrong') return res(false, 2, F.why, F.tag);
    if (F.aux && q.aux && F.aux !== q.aux) return res(false, 2, `${PH.AUX[q.aux].q} 질문에는 첫 낱말의 짝으로 답해요 → ${PH.AUX[q.aux].a} 이 대답(${PH.text(a)})은 ${PH.AUX[F.aux].q} 질문의 짝이에요.`, 'wrong');
    if (F.skip || F.half) return res(false, 2, F.why, 'need');
    const sv = F.slot ? PH.sv(F.slot, a.v) : null;
    if (F.slot && !sv) return res(false, 2, '칸이 비었어요.', 'fact');
    if (sv && sv.bad) return res(false, 2, sv.why, sv.bad);
    if (F.bare) {
      const Y = In.yn, want = Y && Y.yes ? Y.yes(C) : null;
      if (want != null && want !== F.yes) return res(false, 2, `${wa(src)} 달라요. ${src}: ${F.yes ? 'No' : 'Yes'} 쪽이에요(${In.turn}). 이 대답: ${F.yes ? 'Yes' : 'No'}.`, 'fact');
      if (F.yes && Y && Y.strict) return res(false, 2, Y.strict, 'need');
      if (Y && Y.need && F.yes === !!(Y.yes && Y.yes(C))) notes.push(Y.need);
      if (q.aux) notes.push(`짝 맞는 짧은 대답도 좋아요 → ${PH.AUX[q.aux].a}`);
    }
    if (F.line) { const o = PH.checkLine(a.line, C); if (!o.ok) return res(false, 2, o.why, o.tag || 'order'); }
    if (F.check) {
      for (const k of Object.keys(fact)) if (C[k] != null && fact[k] !== C[k]) return res(false, 2, `들은 값과 달라요. 상대: ${PH.factKo(k, C[k])} · 이 대답: ${PH.factKo(k, fact[k])}.`, 'fact');
    } else {
      for (const k of Object.keys(fact)) {
        if (C[k] === undefined || C[k] === fact[k]) continue;
        return res(false, 2, `${wa(src)} 달라요. ${src}: ${PH.factKo(k, C[k])} · 이 대답: ${PH.factKo(k, fact[k])}.`, 'fact');
      }
    }
    // ③ 공손하게 끝내기
    if (F.tag === 'blunt' || F.tag === 'plain') return res(false, 3, F.why, F.tag);
    // 통과
    const segs = PH.segs(a), pol = segs.filter(s => s.r === 'pol').map(s => s.t).filter((x, i, arr) => arr.indexOf(x) === i);
    let why;
    if (q.fast) why = F.kind === 'echo' ? '들린 만큼 되물어 확인했어요. 무엇에 대해 말했는지 알면 그 부분만 다시 물을 수 있어요.' : F.kind === 'slow' ? '천천히 말해 달라고 공손하게 부탁했어요.' : '못 알아들었을 때는 짐작하지 말고 공손하게 다시 물어요.';
    else if (allowed) why = '모르는 낱말은 짐작하지 말고 물어요. 상대가 쉬운 말로 다시 알려 줄 거예요.';
    else if (F.line) why = `${PH.checkLine(a.line, C).why} 상대가 That's right!라고 확인해 줄 거예요.`;
    else if (F.check) why = `들은 값(${Object.keys(fact).map(k => PH.factKo(k, fact[k])).join(' · ')})과 같아요. 숫자는 이렇게 되짚어 확인해요.`;
    else if (F.bare) why = `${shapeHead(q)} → ${SHp.ans}. Yes/No 질문이라 ${F.yes ? 'Yes' : 'No'}로 답할 수 있어요.`;
    else {
      const sl = segs.filter(s => s.r === 'slot').map(s => s.t), fk = Object.keys(fact).filter(k => fact[k] != null);
      why = `${shapeHead(q)} → ${SHp.ans}. ` + (F.aux && q.aux ? `${PH.AUX[q.aux].q} → 짝 맞는 대답(${PH.AUX[q.aux].a}). ` : '') + (sl.length ? `틀 + 내 정보(${sl.join(' ')}) → ${src}의 사실과 맞아요.` : fk.length ? `${src}의 사실(${fk.map(k => PH.factKo(k, fact[k])).join(' · ')})과 맞아요.` : '짧은 대답이면 충분해요.');
      if (q.intent === 'need') why += ' 사실(증상) + 부탁(질문) → 무엇이 필요한지 바로 알 수 있어요.';
      if (q.shape === 'yn' && In.offer && !/^(Yes|No)\b/.test(PH.text(a))) why += ` ${SHp.offer}.`;
    }
    if (pol.length) why += ` 공손한 말 → ${pol.join(' · ')}.`;
    notes.forEach(n => { why += ` ${n}`; });
    if (F.note) why += ` ${F.note}`;
    if (sv && sv.note) why += ` ${sv.note}`;
    return res(true, 0, why);
  };
  // 모범 대답 (카드에 맞춰)
  const ECHO_OF = { need: 'rp_need', allergy: 'rp_allergy', dose: 'rp_times', dob: 'rp_dob', prob: 'rp_prob' };
  PH.model = function (q, card) {
    if (typeof q === 'string') q = PH.Q[q];
    const C = Object.assign({}, card || {}, q.fact || {});
    if (q.fast) return { f: ECHO_OF[q.intent] || 'rp_again' };
    if (q.intent === 'dose') return PH.modelLine(PH.doseOf(C));
    const In = PH.INTENT[q.intent], id = typeof In.best === 'function' ? In.best(C, q) : In.best, F = PH.FRAME[id];
    if (!F.slot) return { f: id };
    const v = PH.slotVal(F.slot, C, q);
    return { f: id, v: v != null ? String(v) : (PH.SLOT[F.slot].dyn ? undefined : slotIds(F.slot)[0]) };
  };
  // 되짚는 한 줄의 모범 (들은 복용법 그대로)
  PH.modelLine = D => ({ f: 'line', line: { words: PH.lineWords(D) } });

  /* =========================================================
     소리로 한 대답 맞춰 보기 — PH.matchSpoken(들린 글, 말, 카드)
     음성 인식이 글로 바꾼 말에 그 말의 표시 낱말과 카드의 사실이 들어 있으면 받아들여요.
     질문의 모양 규칙은 같아요: 고르는 질문 · 정보 질문에 yes · no만 들리면 ①. 숫자는 낱말(thirteen fifty · fifteen)이든 숫자든 같게 맞춰요.
     되짚기는 들린 양 · 횟수 · 때 · 기간을 차례대로 모아 PH.checkLine으로 맞춰 봐요. 문법 · 공손함 · 발음은 판정하지 않아요(알림만 붙여요).
     ========================================================= */
  const CONTR = [[/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\bwhat's\b/g, 'what is'], [/\bdon't\b/g, 'do not'], [/\bdidn't\b/g, 'did not'], [/\bi've\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\bcan't\b/g, 'cannot'], [/\bi'd\b/g, 'i would'], [/\byou're\b/g, 'you are'], [/\bthat's\b/g, 'that is'], [/\bthere's\b/g, 'there is'], [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bdoesn't\b/g, 'does not'], [/\bhaven't\b/g, 'have not'], [/\bwon't\b/g, 'will not'], [/\bhere's\b/g, 'here is'], [/\bdoctor's\b/g, 'doctors'], [/\blet's\b/g, 'let us']];
  PH.norm = function (s) {
    let t = String(s || '').toLowerCase().replace(/[’‘]/g, '\'');
    CONTR.forEach(([r, w]) => { t = t.replace(r, w); });
    t = t.replace(/\$/g, ' ').replace(/(\d)\.(\d)/g, '$1 $2').replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/%/g, ' percent ').replace(/[^a-z0-9' -]+/g, ' ').replace(/-/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '')
      .replace(/\b(milliliters?|millilitres?|mls)\b/g, 'ml');
    return t.split(/\s+/).filter(Boolean);
  };
  const W2N = {}; Object.entries(NUMW).forEach(([n, w]) => { W2N[w] = +n; });
  const O2N = {}; for (let n = 1; n <= 31; n++) O2N[ordWord(n).split('-').pop()] = n % 10 && n > 20 ? n % 10 : n;
  Object.entries(ORDW).forEach(([n, w]) => { O2N[w] = +n; });
  // 낱말 → 숫자 줄로 모음: thirteen fifty → 1350 · fifteen ml → 15 ml · two thousand five → 2005 · fourth → 4 (서수는 줄을 끊어요)
  PH.canon = function (s) {
    const w = PH.norm(s), out = [];
    let run = null;
    const flush = () => { if (run != null) { out.push(run); run = null; } };
    for (let i = 0; i < w.length; i++) {
      const x = w[i];
      let d = null, ord = false;
      if (/^\d+$/.test(x)) d = x;
      else if ((x === 'oh' || x === 'o') && run != null) d = '0';
      else if (W2N[x] != null && W2N[x] > 0 && W2N[x] < 10 && w[i + 1] === 'thousand') {
        let n = W2N[x] * 1000; i++;
        if (w[i + 1] === 'and') i++;
        if (W2N[w[i + 1]] != null && W2N[w[i + 1]] < 100) { n += W2N[w[i + 1]]; i++; }
        d = String(n);
      } else if (W2N[x] != null) {
        const n = W2N[x];
        if (n >= 20 && n % 10 === 0 && O2N[w[i + 1]] != null && O2N[w[i + 1]] < 10) { d = String(n + O2N[w[i + 1]]); ord = true; i++; }
        else if (n >= 20 && n % 10 === 0 && W2N[w[i + 1]] != null && W2N[w[i + 1]] > 0 && W2N[w[i + 1]] < 10) { d = String(n + W2N[w[i + 1]]); i++; }
        else d = String(n);
      } else if (O2N[x] != null) { d = String(O2N[x]); ord = true; }
      if (d != null) { if (ord || d.length >= 3) { flush(); out.push(d); } else run = (run || '') + d; }
      else { flush(); out.push(x); }
    }
    flush();
    return out;
  };
  const runs = toks => toks.filter(t => /^\d+$/.test(t));
  // 들린 값 (센트): thirteen fifty → 1350 · twenty dollars → 2000
  const heardMoney = toks => { const i = toks.findIndex(t => /^\d+$/.test(t)); if (i < 0) return null; const r = toks[i]; return r.length <= 2 || /^dollars?$/.test(toks[i + 1] || '') ? +r * 100 : +r; };
  // 들린 날짜: March fourth, two thousand five → '2005-03-04' · 숫자만이면 { nums: true }
  const heardDob = raw => {
    const toks = PH.canon(raw), mi = toks.findIndex(t => PH.MONTHS.some(M => M.toLowerCase() === t));
    if (mi < 0) return runs(toks).length >= 2 ? { nums: true } : null;
    const m = PH.MONTHS.findIndex(M => M.toLowerCase() === toks[mi]) + 1;
    const after = toks.slice(mi + 1).filter(t => /^\d+$/.test(t)), before = toks.slice(0, mi).filter(t => /^\d+$/.test(t) && +t <= 31);
    let d = null, y = null;
    after.forEach(t => { if (+t >= 1900 && y == null) y = +t; else if (+t <= 31 && d == null) d = +t; });
    if (d == null && before.length) d = +before[before.length - 1];
    return d && y ? { iso: PH.isoOf(y, m, d) } : { part: true };
  };
  PH.heardDob = heardDob;
  // 들린 철자: k i m → K-I-M
  const heardLetters = raw => {
    let best = [], cur = [];
    PH.norm(raw).forEach(t => { if (/^[a-z]$/.test(t)) cur.push(t); else { if (cur.length >= best.length) best = cur; cur = []; } });
    if (cur.length >= best.length) best = cur;
    return best.length >= 2 ? best.map(t => t.toUpperCase()).join('-') : null;
  };
  PH.heardLetters = heardLetters;
  const BARE_RE = /^(yes|yeah|yep|no|nope|please|sure|thanks|thank|you|okay|ok|of|course|it|is|i|do|am|not|that|would|like|great|uh|um|well)$/;
  const REPAIR_RE = /\b(say that again|pardon|repeat|more slowly|slow down|sorry what|come again)\b|^ ?sorry ?$/;
  const symHeard = s => /\bsore throat\b|\bthroat (hurts|is sore|is killing)\b/.test(s) ? 'sorethroat' : /\bcough(ing)?\b/.test(s) ? 'cough' : /\b(stomach ?ache|stomach (hurts|is upset)|upset stomach|tummy)\b/.test(s) ? 'stomach' : /\b(ear ?ache|ear (hurts|is sore))\b/.test(s) ? 'earache' : null;
  const partHeard = s => /\bthroat\b/.test(s) ? 'throat' : /\bchest\b/.test(s) ? 'chest' : /\b(stomach|tummy|belly)\b/.test(s) ? 'stomach' : /\bear\b/.test(s) ? 'ear' : null;
  const medHeard = s => /\bcold\b/.test(s) ? 'cold' : /\bcough\b/.test(s) ? 'cough' : /\bstomach\b/.test(s) ? 'stomach' : /\b(pain|painkillers?|pain relievers?)\b/.test(s) ? 'pain' : null;
  // 되짚는 말에서 조각 모으기 → 줄 낱말 (들린 차례대로)
  PH.parseLine = function (raw) {
    const s = ' ' + PH.canon(raw).join(' ') + ' ', hits = [];
    const scan = (re, fn) => { re.lastIndex = 0; let m; while ((m = re.exec(s))) { const w = fn(m); if (w) hits.push([m.index, w]); } };
    scan(/\b(1|a|one) tablets?\b/g, () => 't1'); scan(/\b2 tablets\b/g, () => 't2'); scan(/\b(1|a|one) capsules?\b/g, () => 'c1');
    scan(/\b(10|15|50) ml\b/g, m => 'm' + m[1]);
    scan(/\b(once|1 time) a day\b/g, () => 'f1'); scan(/\b(twice|2 times) a day\b/g, () => 'f2'); scan(/\b3 times a day\b/g, () => 'f3'); scan(/\b3 times (1|one) day\b/g, () => 'x3');
    scan(/\bevery (4|6) hours\b/g, m => 'e' + m[1]);
    scan(/\bafter (meals?|eating|food)\b/g, () => 'after'); scan(/\bbefore (meals?|eating|food)\b/g, () => 'before'); scan(/\bwith (food|meals?|a meal)\b/g, () => 'food'); scan(/\b(at bedtime|before bed)\b/g, () => 'bed');
    scan(/\b(?:for )?(3|5|7|10) days\b/g, m => 'd' + m[1]); scan(/\bfor (a|1) week\b/g, () => 'd7');
    hits.sort((a, b) => a[0] - b[0]);
    const open = /\b(i|we) eat\b|\beat (them|it|the|2|1)\b/.test(s) ? 'eat' : 'so';
    return [open].concat(hits.map(h => h[1]));
  };
  PH.matchSpoken = function (raw, q, card) {
    if (typeof q === 'string') q = PH.Q[q];
    const toks = PH.canon(raw), s = ' ' + toks.join(' ') + ' ', heard = PH.norm(raw).join(' ');
    if (!toks.length) return { ok: false, stage: 0, why: '들린 말이 없어요. 다시 말해 보세요.', heard: '' };
    const C = Object.assign({}, card || {}, q.fact || {}), SHp = PH.SHAPE[q.shape], It = PH.INTENT[q.intent];
    const R = (ok, stage, why, o = {}) => Object.assign({ ok, stage, why, heard }, o);
    const notes = [];
    const pass = (why, cov) => R(true, 0, why + (notes.length ? ' 알림: ' + notes.join(' ') : ''), { note: notes.join(' '), covered: cov || [q.intent] });
    const keyMiss = () => R(false, 1, `${shapeHead(q)}(${SHp.ans}). 들린 말에 그 대답이 없어요.`);
    const differ = (k, v) => R(false, 2, `카드와 달라요. 카드: ${PH.factKo(k, C[k])} · 들린 말: ${PH.factKo(k, v)}.`, { tag: 'fact' });
    const nums = runs(toks);
    const lit = id => R(false, 2, PH.FRAME[id].why, { tag: 'literal' });
    // 빠른 말: 다시 묻는 말만 (들린 만큼 되묻는 말은 실제 말과 같아야)
    if (q.fast) {
      const echo = /\b(how many (tablets|times)|write (that|it) down)\b/.test(s) ? 'dose' : /\b(what i need|what do i need)\b/.test(s) ? 'need' : /\ballerg/.test(s) ? 'allergy' : /\b(date of birth|birthday)\b/.test(s) ? 'dob' : /\b(what is wrong|the problem|what brings)\b/.test(s) ? 'prob' : null;
      if (echo) return echo === q.intent ? R(false, 1, '들린 만큼 되물었어요. 상대가 다시 말해 줄 거예요.', { repair: 'again' }) : R(false, 1, `되물은 말이 달라요. 들린 낱말(${q.key.join(' … ')})로 보면 상대는 ${It.turn}에 대해 말했어요.`);
      if (REPAIR_RE.test(s) || /\b(sorry|again|slowly)\b/.test(s)) return R(false, 1, '다시 묻는 말로 들었어요. 상대가 한 번 더 말해 줄 거예요.', { repair: 'again' });
      return R(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 짐작해서 답하지 말고 먼저 다시 물어요 → Sorry? Could you say that again, please?');
    }
    // 모르는 낱말 묻기 (drowsy)
    if (q.allow && /\bwhat (does|is) drowsy\b|\bdrowsy mean\b/.test(s)) return R(false, 1, '모르는 낱말을 물었어요. 상대가 쉬운 말로 알려 줄 거예요.', { repair: 'what' });
    // 들은 값을 되묻는 말 (Sorry, did you say thirteen fifty?)
    if (/\b(did you say|was that|is that)\b/.test(s) && nums.length && q.intent === 'cost') {
      const amt = heardMoney(toks), want = C.amount;
      if (want != null && amt !== want) return R(false, 2, `상대가 말한 값과 달라요. 상대: ${PH.factKo('amount', want)} · 들린 말: ${PH.factKo('amount', amt)}.`, { tag: 'fact' });
      return R(false, 1, '들은 값을 되물어 확인했어요. 상대가 맞다고 할 거예요.', { repair: 'check' });
    }
    if ((REPAIR_RE.test(s) || /\b(could you say|say again)\b/.test(s)) && toks.length <= 9) return R(false, 1, '다시 묻는 말로 들었어요. 상대가 한 번 더 말해 줄 거예요.', { repair: 'again' });
    if (/\b(give me|i want)\b/.test(s)) notes.push('Give me · I want는 명령하거나 조르는 말처럼 들려요(말로 한 대답은 말투를 판정하지 않아요) → Could you recommend something for it?');
    const bare = toks.every(t => BARE_RE.test(t)) && /\b(yes|yeah|yep|no|nope|sure|okay|ok)\b/.test(s);
    const yesHeard = /\b(yes|yeah|yep|sure|okay|ok)\b/.test(s), noHeard = /\b(no|nope)\b/.test(s) && !/\bno ?\d|\bnot better\b/.test(s);
    if (bare && (q.shape === 'or' || q.shape === 'wh')) return R(false, 1, `${shapeHead(q)}. ${q.shape === 'or' ? '둘 가운데 하나를 고르라는 말이라 yes · no만으로는 무엇을 골랐는지 알 수 없어요' : '정보를 묻는 말이라 yes · no로는 답이 안 돼요'} → ${It.want}`, { tag: 'shape' });
    if (bare && q.shape === 'note') return R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${PH.sayOf(q.intent)} → ${It.want}`, { tag: 'shape' });
    if (q.shape === 'or' && yesHeard && !bare) notes.push('고르는 질문에는 Yes 없이 고른 것만 말해도 돼요.');
    const auxNote = () => { if (!q.aux) return; const said = /\b(i|it) (do|does|am|is|have)( not)?\b/.exec(s); const map = { do: 'do', does: 'does', am: 'be', is: 'is', have: 'have' }; if (said && map[said[2]] !== q.aux) notes.push(`${PH.AUX[q.aux].q} 질문의 짧은 대답은 → ${PH.AUX[q.aux].a}(말로 한 대답은 문법을 판정하지 않아요)`); };
    const yn = (k, v, okWhy) => { if (C[k] != null && v !== !!C[k]) return differ(k, v); auxNote(); return pass(okWhy); };
    switch (q.intent) {
      case 'need': case 'prob': {
        if (/\b(throat|head|stomach|ear|chest) is sick\b/.test(s)) return lit('cs_sick');
        const v = symHeard(s);
        if (!v) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.sym && v !== C.sym) return differ('sym', v);
        if (q.intent === 'need' && !/\b(recommend|anything for|something for|could you|can you|do you have|what should i|what can i take)\b/.test(s)) return R(false, 2, PH.FRAME.cs_fact.why, { tag: 'need' });
        return pass(q.intent === 'need' ? '증상과 부탁(질문)이 들렸고 카드와 맞아요.' : '증상이 들렸고 카드와 맞아요.');
      }
      case 'since': {
        if (/\bduring\b/.test(s)) return lit('sn_dur');
        if (/\bfrom (yesterday|last night|monday)\b/.test(s)) return lit('sn_from');
        const v = /\b(2|two) days\b/.test(s) ? '2d' : /\b3 days\b/.test(s) ? '3d' : /\b(a|1) week\b/.test(s) ? '1w' : /\bsince yesterday\b/.test(s) ? 'yday' : /\bsince last night\b/.test(s) ? 'lastnight' : /\bsince monday\b/.test(s) ? 'mon' : null;
        if (!v) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.since && v !== C.since) return differ('since', v);
        return pass('얼마나 됐는지 들렸고 카드와 맞아요.');
      }
      case 'fever': case 'press': case 'first': {
        if (q.intent === 'first' && /\bi am (first|1)\b/.test(s)) return lit('fs_lit');
        if (/\bi do not have ?$/.test(s)) notes.push('No, I don\'t have.는 have 뒤가 비어서 문장이 끝나지 않아요 → No, I don\'t.');
        if (!yesHeard && !noHeard) return keyMiss();
        return yn(q.intent, !noHeard, noHeard ? '아니라는 말이 들렸고 카드와 맞아요.' : '그렇다는 말이 들렸고 카드와 맞아요.');
      }
      case 'allergy': {
        if (/\ballergy to\b/.test(s)) notes.push('allergy는 명사예요. ~에 알레르기가 있다 → I\'m allergic to …(말로 한 대답은 문법을 판정하지 않아요)');
        const v = /\bpenicillin\b/.test(s) ? 'penicillin' : /\baspirin\b/.test(s) ? 'aspirin' : null;
        if (v) { if (C.allergy !== undefined && v !== C.allergy) return differ('allergy', v); return pass('무엇에 알레르기가 있는지 들렸고 카드와 맞아요.'); }
        if (noHeard || /\b(am not|do not have)\b/.test(s)) { if (C.allergy) return differ('allergy', null); auxNote(); return pass('알레르기가 없다는 말이 들렸어요.'); }
        if (yesHeard) return C.allergy === null ? R(false, 2, '카드와 달라요. 카드: 알레르기 없음 · 들린 말: 있다고 했어요.', { tag: 'fact' }) : R(false, 2, It.yn.strict, { tag: 'need' });
        return keyMiss();
      }
      case 'other': {
        if (/\beating\b/.test(s)) return lit('ot_eat');
        const v = /\ballergy (pills?|medicine|tablets?)\b/.test(s) ? 'allergy' : /\bvitamins?\b/.test(s) ? 'vitamin' : null;
        if (v) { if (C.other !== undefined && v !== C.other) return differ('other', v); return pass('먹고 있는 약이 들렸고 카드와 맞아요.'); }
        if (noHeard) { if (C.other) return differ('other', null); auxNote(); return pass('다른 약이 없다는 말이 들렸어요.'); }
        if (yesHeard) return R(false, 2, It.yn.strict, { tag: 'need' });
        return keyMiss();
      }
      case 'form': {
        const v = /\b(tablets?|pills?)\b/.test(s) ? 'tablets' : /\b(liquid|syrup)\b/.test(s) ? 'liquid' : null;
        if (!v) return keyMiss();
        if (C.form != null && v !== C.form) return differ('form', v);
        return pass('고른 것이 들렸고 카드와 맞아요.');
      }
      case 'dose': {
        const ws = PH.parseLine(raw);
        if (ws.length <= 1) return /\b(thank|thanks|okay|ok|got it|great)\b/.test(s) ? R(false, 2, PH.FRAME.ds_ok.why, { tag: 'need' }) : keyMiss();
        if (!/^ ?(so|okay so|ok so|alright so)\b/.test(s)) notes.push('되짚을 때는 So, I take …?로 시작하면 확인하는 말인 것이 잘 드러나요.');
        const o = PH.checkLine({ words: ws }, C);
        if (!o.ok) return R(false, o.stage || 2, o.why, { tag: o.tag || 'fact', line: ws, fix: PH.fixLine({ words: ws }, C) });
        return pass('들은 조각을 차례대로 빠짐없이 되짚었어요.', ['dose']);
      }
      case 'cost': {
        if (/\bcard is (okay|ok|possible|fine)\b/.test(s)) return lit('co_lit');
        if (/\b(expensive|cheaper)\b/.test(s)) notes.push('약값은 깎지 않아요(말로 한 대답은 말투를 판정하지 않아요).');
        const v = /\bcard\b/.test(s) ? 'card' : /\b(cash|here you go|here you are|here it is)\b/.test(s) ? 'cash' : null;
        if (!v) return bare ? R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${PH.sayOf(q.intent)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.paym != null && v !== C.paym) return differ('paym', v);
        return pass(v === 'card' ? '카드로 내겠다는 말이 들렸어요.' : '현금을 건네는 말이 들렸어요.');
      }
      case 'warn': {
        if (/\b(drive carefully|i will drive)\b/.test(s)) return R(false, 2, '상대는 약을 먹은 뒤 운전하지 말라고 했어요.', { tag: 'fact' });
        if (!/\b(not drive|no driving|will not|okay|ok|thank|thanks|got it|sure)\b/.test(s)) return keyMiss();
        return pass('알아들었다는 말이 들렸어요.');
      }
      case 'appt': {
        if (/\bi want doctor\b/.test(s)) return lit('ap_want');
        if (yesHeard && !noHeard) return differ('appt', true);
        if (!noHeard) return keyMiss();
        if (!/\b(see a doctor|see the doctor|see someone)\b/.test(s)) notes.push(It.yn.need);
        auxNote();
        return pass('예약하지 않았다는 말이 들렸어요.');
      }
      case 'name': {
        const v = PH.NAME_IDS.find(id => new RegExp('\\b' + id + '\\b').test(s));
        if (!v) return keyMiss();
        if (C.name && v !== C.name) return differ('name', v);
        if (!heardLetters(raw)) notes.push('한국 이름은 철자를 함께 불러 주면 받아 적기 쉬워요 → It\'s Kim, K-I-M.');
        return pass('성이 들렸고 카드와 맞아요.');
      }
      case 'spell': {
        const v = heardLetters(raw);
        if (!v) return bare ? R(false, 2, It.yn.strict, { tag: 'need' }) : keyMiss();
        const want = C.spell || (C.name && PH.NAMES[C.name] && PH.NAMES[C.name].letters);
        if (want && v !== want) return R(false, 2, `카드와 달라요. 카드: ${want} · 들린 말: ${v}.`, { tag: 'fact' });
        return pass('한 글자씩 부른 철자가 들렸고 카드와 맞아요.');
      }
      case 'dob': {
        const h = heardDob(raw);
        if (!h) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (h.nums) return lit('db_ko');
        if (h.part) return R(false, 2, `날과 해까지 말해요 → It's ${PH.dateText(C.dob || '2005-03-04')}.`, { tag: 'need' });
        if (C.dob && h.iso !== C.dob) return differ('dob', h.iso);
        return pass('생년월일이 들렸고 카드와 맞아요.');
      }
      case 'ins': {
        if (/\bi have ?$/.test(s)) notes.push('Yes, I have.는 have 뒤가 비어서 문장이 끝나지 않아요 → Yes, I do. I have travel insurance.');
        const v = /\btravel\b/.test(s) ? 'travel' : /\bstudent\b/.test(s) ? 'student' : null;
        if (noHeard && !v) return C.ins ? differ('ins', null) : pass('보험이 없다는 말이 들렸어요.');
        if (!v && !yesHeard) return keyMiss();
        if (v && C.ins && v !== C.ins) return differ('ins', v);
        if (!v) notes.push(It.yn.need);
        auxNote();
        return pass('보험이 있다는 말이 들렸어요.');
      }
      case 'fill': {
        if (!/\b(sure|okay|ok|thank|thanks|alright|all right)\b/.test(s)) return keyMiss();
        return pass('알겠다는 말이 들렸어요.');
      }
      case 'took': {
        if (/\bate\b/.test(s)) return lit('tk_ate');
        const v = medHeard(s);
        if (v) { if (C.took !== undefined && v !== C.took) return differ('took', v); return pass('먹은 약이 들렸고 카드와 맞아요.'); }
        if (noHeard) { if (C.took) return differ('took', null); auxNote(); return pass('먹은 약이 없다는 말이 들렸어요.'); }
        if (yesHeard) { notes.push(It.yn.need); return pass('먹은 약이 있다는 말이 들렸어요.'); }
        return keyMiss();
      }
      case 'where': {
        if (/\bis sick\b/.test(s)) return lit('cs_sick');
        if (/\bhere is pain\b/.test(s)) return lit('wh_pain');
        const v = partHeard(s);
        if (!v) return keyMiss();
        if (C.part && v !== C.part) return differ('part', v);
        return pass('아픈 자리가 들렸고 카드와 맞아요.');
      }
      case 'scale': {
        if (/\bvery pain\b/.test(s)) return lit('sc_lit');
        const n = nums.map(Number).find(x => x <= 10);
        if (n == null) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.scale != null && n !== C.scale) return differ('scale', n);
        return pass('아픈 정도의 숫자가 들렸고 카드와 맞아요.');
      }
      case 'back': {
        const v = /\b2 days\b/.test(s) ? 'd2' : /\b3 days\b/.test(s) ? 'd3' : /\b5 days\b/.test(s) ? 'd5' : /\b(a|1) week\b/.test(s) ? 'w1' : null;
        if (!v) return /\b(thank|thanks|okay|ok|great|bye)\b/.test(s) ? R(false, 2, PH.FRAME.bk_ok.why, { tag: 'need' }) : keyMiss();
        if (C.back && v !== C.back) return R(false, 2, `들은 값과 달라요. 상대: ${PH.factKo('back', C.back)} · 들린 말: ${PH.factKo('back', v)}.`, { tag: 'fact' });
        return pass('들은 기간을 되짚었어요. 숫자가 맞아요.');
      }
      case 'q': {
        if (/\bdiagnosis\b/.test(s)) return lit('q_diag');
        const note = /\b(doctors note|sick note|medical (note|certificate)|note for (my )?(class|school|work))\b/.test(s);
        if (note) { if (C.note === false) return differ('note', true); return pass('진단서(확인서)를 부탁하는 말이 들렸어요.'); }
        if (noHeard || /\b(that is all|that is it|i am good)\b/.test(s)) { if (C.note) return differ('note', false); if (!/\b(thank|thanks)\b/.test(s)) notes.push('No만 하면 무뚝뚝하게 들릴 수 있어요 → No, that\'s all. Thank you so much!'); return pass('그거면 된다는 말이 들렸어요.'); }
        if (yesHeard) return R(false, 2, It.yn.strict, { tag: 'need' });
        return keyMiss();
      }
      default: return R(false, 0, '이 말은 말로 대답하기를 지원하지 않아요.');
    }
  };

  /* ---------- 따라 말하기: 낱말 맞춰 보기 (가장 긴 공통 부분열, 숫자는 같은 숫자로) ---------- */
  PH.compareWords = function (target, heard) {
    const tw = String(target).split(/\s+/).filter(Boolean), tt = [];
    tw.forEach((x, i) => PH.canon(x).forEach(p => tt.push({ p, i })));
    const A = tt.map(x => x.p), B = PH.canon(heard), D = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) D[i][j] = A[i] === B[j] ? D[i + 1][j + 1] + 1 : Math.max(D[i + 1][j], D[i][j + 1]);
    const got = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { got.add(i); i++; j++; } else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++; }
    const okW = tw.map((_, k) => { const parts = tt.map((x, n) => [x, n]).filter(([x]) => x.i === k); return parts.length ? parts.every(([, n]) => got.has(n)) : true; });
    return { words: tw.map((t, k) => ({ t, ok: okW[k] })), hit: okW.filter(Boolean).length, total: tw.length };
  };

  /* =========================================================
     환자 카드 (진료 시뮬레이터): 약국에서 약 사기 → 며칠 뒤 병원 진료
     ========================================================= */
  const DOBS = [];
  for (let y = 2003; y <= 2007; y++) [1, 3, 4, 6, 8, 11, 12].forEach((m, i) => DOBS.push(PH.isoOf(y, m, [4, 12, 21, 3, 15, 9, 23][(i + y) % 7])));
  PH.DOBS = DOBS;
  PH.newCard = function (rnd = Math.random) {
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const sym = pick(PH.SYM_IDS), allergy = rnd() < 0.35 ? pick(['penicillin', 'aspirin']) : null, name = pick(PH.NAME_IDS);
    const c = { sym, since: pick(['yday', 'lastnight', 'mon', '2d', '3d', '1w']), fever: rnd() < 0.4, other: rnd() < 0.3 ? pick(['allergy', 'vitamin']) : null,
      form: pick(['tablets', 'liquid']), paym: pick(['card', 'cash']), au: rnd() < 0.4, appt: false, name, spell: PH.NAMES[name].letters, dob: pick(DOBS),
      ins: pick(['travel', 'student']), took: rnd() < 0.6 ? PH.SYM[sym].med : null, part: PH.SYM[sym].part, press: rnd() < 0.5, scale: 3 + Math.floor(rnd() * 6),
      allergy, note: rnd() < 0.5, v1: pick(['fever', 'other']), v2: pick(['where', 'press', 'scale']) };
    c.amount = PH.price(sym, c.form);
    c.back = PH.safeRx(sym, allergy).back;
    return c;
  };
  // 상대가 말하는 차례
  PH.simQs = c => [c.au ? 'cn_au' : 'cn_what', 'ak_long', c.v1 === 'other' ? 'ak_other' : 'ak_fever', 'ak_form', 'ds_say', 'ds_cost', 'fr_appt', 'fr_name', 'fr_dob', 'fr_ins',
    'dc_prob', 'dc_took', c.v2 === 'press' ? 'ex_press' : c.v2 === 'scale' ? 'ex_scale' : 'ex_where', 'ex_allergy', 'pl_rx', 'pl_back', 'pl_q'];
  // 카드에 따라 바뀌는 말 (복용법 · 값 · 처방 · 다시 올 날)
  PH.simQ = function (id, c) {
    const q = PH.Q[id];
    if (id === 'ds_say') { const D = PH.otc(c.sym, c.form); return Object.assign({}, q, { en: PH.say(D), ko: PH.sayKo(D), key: [PH.FREQ[D.freq].t], fact: { dk: 'ph' }, short: PH.say(D) }); }
    if (id === 'ds_cost') return Object.assign({}, q, { en: `Okay, that's ${PH.money(c.amount)}, please.`, ko: `네, ${ieyo(PH.priceKo(c.amount))}.`, key: [PH.money(c.amount)], fact: { amount: c.amount }, short: `That's ${PH.money(c.amount)}.` });
    if (id === 'pl_rx') { const D = PH.rx(c.sym, c.allergy || null); return Object.assign({}, q, { en: PH.rxSay(c.sym, c.allergy || null), ko: PH.rxSayKo(c.sym, c.allergy || null), key: [PH.FREQ[D.freq].t], fact: { dk: 'rx' }, short: PH.say(D) }); }
    if (id === 'pl_back') return Object.assign({}, q, { en: PH.backSay(c.back), ko: PH.backSayKo(c.back), fact: { back: c.back } });
    return q;
  };
  PH.PLACE_OF = id => PH.Q[id].place;
  // 질문마다 틀 칩: 맞는 틀 · 한국어 그대로(콩글리시 · 틀린 문장 · 짝이 다른 대답) 틀 · Yes만 하는 대답. dose는 되짚기 조각 칩(PH.lineChips)으로 말해요
  PH.SIM_FRAMES = {
    need: ['cs_rec', 'cs_fact', 'cs_sick'],
    since: c => SINCE_P[c.since] ? ['sn_since', 'sn_from', 'g_yes'] : ['sn_for', 'sn_dur', 'g_yes'],
    fever: c => c.fever ? ['fv_yes', 'fv_am', 'fv_no'] : ['fv_no', 'fv_have', 'fv_yes'],
    other: c => c.other ? ['ot_yes', 'ot_eat', 'ot_no'] : ['ot_no', 'ot_eat', 'ot_yes'],
    form: ['fm_pl', 'g_yesp', 'co_card'],
    dose: ['line', 'ds_ok'],
    cost: c => c.paym === 'card' ? ['co_card', 'co_lit', 'co_here'] : ['co_here', 'co_exp', 'co_card'],
    appt: ['ap_no', 'ap_want', 'g_yes'],
    name: ['nm_sp', 'g_yes', 'db_is'],
    dob: ['db_is', 'db_ko', 'g_yes'],
    ins: ['is_yes', 'is_have', 'g_no'],
    prob: ['pb_have', 'cs_sick', 'g_yes'],
    took: c => c.took ? ['tk_yes', 'tk_ate', 'tk_no'] : ['tk_no', 'tk_ate', 'tk_yes'],
    where: ['wh_in', 'wh_pain', 'g_yes'],
    press: c => c.press ? ['pr_yes', 'pr_is', 'pr_no'] : ['pr_no', 'pr_isnt', 'pr_yes'],
    scale: ['sc_about', 'sc_lit', 'g_yes'],
    allergy: c => c.allergy ? ['al_yes', 'al_allergy', 'al_dont'] : ['al_dont', 'al_not', 'al_yes'],
    back: ['bk_so', 'bk_ok', 'g_yes'],
    q: c => c.note ? ['q_note', 'q_diag', 'g_yes'] : ['q_no', 'q_plain', 'g_yesp'],
  };
  PH.simFrames = (intent, c) => { const x = PH.SIM_FRAMES[intent]; return typeof x === 'function' ? x(c) : x ? x.slice() : null; };
  // 칸 칩: 카드의 값 + 헷갈리기 쉬운 값 둘 (값은 thirteen · thirty 같은 이웃 값, 생일은 달과 날을 바꾼 값)
  const moneyTrap = a => { const d = Math.floor(a / 100), k = a % 100, t = PH.teenSwap(d); return t != null ? t * 100 + k : a + 1000; };
  PH.moneyTrap = moneyTrap;
  const dobTrap = v => { const D = ymd(v); return D.d <= 12 && D.d !== D.m ? PH.isoOf(D.y, D.d, D.m) : PH.isoOf(D.y, D.m, D.d === 28 ? 27 : D.d + 1); };
  PH.dobTrap = dobTrap;
  PH.slotChoices = function (slot, card, rnd = Math.random, q) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let out;
    if (slot === 'money') { const a = card.amount; out = [a, moneyTrap(a), a >= 200 ? a - 100 : a + 100].map(String); }
    else if (slot === 'dob') { const v = card.dob, D = ymd(v); out = [v, dobTrap(v), PH.isoOf(D.y === 2007 ? 2006 : D.y + 1, D.m, D.d)]; }
    else if (slot === 'spell') { const n = card.name || 'kim'; out = [PH.NAMES[n].letters].concat(PH.SPELL_TRAP[n]); }
    else if (slot === 'num') { const s = card.scale != null ? card.scale : 6; out = [s, s - 2, s + 2, s - 3].filter(x => x >= 1 && x <= 10).slice(0, 3).map(String); }
    else {
      const right = PH.slotVal(slot, card, q), keys = shuffle(slotIds(slot).filter(k => k !== right));
      out = (right ? [right] : []).concat(keys.slice(0, right ? 2 : 3));
    }
    return shuffle(out.filter((x, i, a) => x != null && a.indexOf(x) === i));
  };
  // 되짚기 조각 칩 (자리마다 맞는 조각 + 헷갈리기 쉬운 조각) — 차례대로 고르면 한 줄이 돼요
  const AMT_TRAP = { t1: 't2', t2: 't1', c1: 't1', m10: 'm15', m15: 'm50', m50: 'm15' };
  const FREQ_TRAP = { f1: 'f2', f2: 'f3', f3: 'f2', e4: 'e6', e6: 'e4' };
  const TIME_TRAP = { after: 'before', before: 'after', food: 'after', bed: 'after' };
  const LEN_TRAP = { d3: 'd5', d5: 'd3', d7: 'd10', d10: 'd7' };
  PH.lineChips = function (c, rnd = Math.random) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const D = PH.doseOf(c), out = [{ c: 'amt', ids: shuffle([D.amt, AMT_TRAP[D.amt]]) }, { c: 'freq', ids: shuffle([D.freq, FREQ_TRAP[D.freq]].concat(D.freq === 'f3' ? ['x3'] : [])) }];
    if (D.time) out.push({ c: 'time', ids: shuffle([D.time, TIME_TRAP[D.time]]) });
    out.push({ c: 'len', ids: shuffle([D.len, LEN_TRAP[D.len]]) });
    return out;
  };
  PH.cardRows = c => {
    const S = PH.SYM[c.sym], since = (PH.SLOT.sinceP.vals[c.since] || PH.SLOT.durP.vals[c.since] || {}).ko || '';
    return [
      ['증상', `${S.ko} · ${since}${c.fever ? ' · 열이 있어요' : ' · 열은 없어요'}`],
      ['약국', `${c.form === 'liquid' ? '물약' : '알약'}이 좋아요 · ${c.paym === 'card' ? '카드' : '현금'}로 내요 · 다른 약 ${c.other ? PH.SLOT.omed.vals[c.other].ko : '없음'}`],
      ['병원 접수', `예약 없음 · 성 ${PH.NAMES[c.name].ko} · ${PH.dateKo(c.dob)} · ${PH.SLOT.ins.vals[c.ins].ko}`],
      ['진료', `${c.took ? PH.MEDS[c.took].ko + '을 먹었어요' : '먹은 약 없음'} · 아픈 곳 ${PH.PART[c.part].ko} · 누르면 ${c.press ? '아파요' : '안 아파요'} · 아픈 정도 ${c.scale}점`],
      ['알레르기', c.allergy ? `${PH.SLOT.allergen.vals[c.allergy].ko}에 알레르기가 있어요` : '없어요'],
      ['진단서', c.note ? '수업에 낼 진단서(확인서)가 필요해요' : '필요 없어요'],
    ];
  };
  // 상대의 반응 (단계별)
  const BAD_REACT = {
    cs_sick: ['Sick…? Oh — does it hurt?', '아픈 곳 → I have a sore throat. · My throat hurts.'], cs_fact: ['Oh, I\'m sorry. And… what can I do for you?', '부탁도 질문으로 → Could you recommend something for it?'],
    sn_dur: ['Sorry — during what?', '숫자로 센 기간 → For two days.'], sn_from: ['From…? Oh — since yesterday?', '시작한 때 → Since yesterday.'],
    fv_have: ['You don\'t have…? A fever?', 'Do you …? → No, I don\'t.'], fv_am: ['You are…? So, you have a fever?', 'Do you …? → Yes, I do.'],
    al_allergy: ['Oh — you\'re allergic to it?', '알레르기가 있다 → I\'m allergic to …'], al_not: ['You\'re not…? No allergies, then?', 'Do you …? → No, I don\'t.'], al_dont: ['You don\'t…? You\'re not allergic?', 'Are you …? → No, I\'m not.'],
    ot_eat: ['Eating…? Oh, you\'re taking them?', '약은 take → I\'m taking allergy pills.'], co_lit: ['Sorry — is the card okay?', '카드로 → Can I pay by card?'],
    ap_want: ['Okay… you\'d like to see a doctor?', '부탁 → I\'d like to see a doctor, please.'], fs_lit: ['First…? Oh, your first visit?', 'Is this …? → Yes, it is.'],
    db_ko: ['Sorry — which is the month?', '달은 이름으로 → It\'s March 4th, 2005.'], is_have: ['You have…?', 'Do you …? → Yes, I do. I have travel insurance.'],
    tk_ate: ['You ate…? Oh, you took some?', '약은 take → I took some cold medicine.'], wh_pain: ['Sorry — where does it hurt?', '아픈 자리 → It hurts in my throat.'],
    sc_lit: ['Okay… but what number?', '숫자로 → About a six.'], q_diag: ['A diagnosis…? Oh, a doctor\'s note?', '확인서 → a doctor\'s note'],
    pr_is: ['It is…? Does it hurt?', 'Does it …? → Yes, it does.'], pr_isnt: ['It isn\'t…? So, it doesn\'t hurt?', 'Does it …? → No, it doesn\'t.'],
  };
  PH.BAD_REACT = BAD_REACT;
  PH.REACT = {
    ok: ['Okay.', 'Great.', 'Alright.', 'I see.', 'Thank you.'],
    1: q => ({ en: `Sorry — ${q.short && /\?$/.test(q.short) ? q.short : (String(q.en).match(/[^.!?]*\?/g) || [String(q.en)]).pop().trim()}`, ko: q.shape === 'or' || q.shape === 'wh' ? `${PH.SHAPE[q.shape].ko} → ${PH.SHAPE[q.shape].ans}` : `‘${q.key.join(' … ')}’를 말했어요.` }),
    2: (q, j, a, C) => {
      const F = a && PH.FRAME[a.f], b = F && BAD_REACT[F.id];
      if (b) return { en: b[0], ko: b[1] };
      if (F && F.line) { const fx = PH.fixLine(a.line, C || {}); return { en: fx.en, ko: fx.ko }; }
      if (j.tag === 'fact') {
        if (q.intent === 'cost') return { en: `No — I said ${PH.money(C.amount)}.`, ko: '들은 숫자와 달라요.' };
        if (q.intent === 'back') return { en: `No — I said ${PH.BACK[C.back].t}.`, ko: '들은 숫자와 달라요.' };
        return { en: 'Hmm, are you sure?', ko: '환자 카드(또는 상대가 한 말)를 다시 보세요.' };
      }
      if (j.tag === 'need') return q.intent === 'spell' ? { en: 'Great — so how do you spell it?', ko: '한 글자씩 불러요.' } : q.intent === 'q' ? { en: 'Sure — what is it?', ko: '물어볼 것을 바로 물어요.' } : { en: 'Sure — do you want to check the details?', ko: '들은 것을 되짚어 확인해요.' };
      if (j.tag === 'wrong') return { en: 'Sorry?', ko: '질문의 첫 낱말과 짝이 맞는 대답을 해요.' };
      return { en: 'Sorry?', ko: '알아듣기 어려운 말이에요.' };
    },
    3: () => ({ en: '... Okay.', ko: '뜻은 통했지만 말투가 거칠어요.' }),
  };
  // 대답 뒤 상대가 덧붙이는 말 (다음 질문 앞)
  PH.reply = function (q, a, C) {
    switch (q.intent) {
      case 'need': return 'Oh, I\'m sorry to hear that. Let me ask you a few questions.';
      case 'since': return 'Okay.';
      case 'fever': return C.fever ? 'Okay, a fever.' : 'Good.';
      case 'other': return 'Got it.';
      case 'form': return C.form === 'liquid' ? 'Liquid. Okay.' : 'Tablets. Okay.';
      case 'dose': return 'That\'s right!';
      case 'cost': return C.paym === 'card' ? 'Sure. Just tap your card here.' : 'Thank you. Here\'s your change.';
      case 'warn': return 'You\'re welcome. Feel better soon!';
      case 'appt': return 'No problem. We can fit you in today.';
      case 'first': return C.first === false ? 'Okay.' : 'Welcome!';
      case 'name': case 'dob': return 'Thank you.';
      case 'spell': return 'Got it, thanks.';
      case 'ins': return 'Great, thank you.';
      case 'prob': return 'I see. Let\'s take a look.';
      case 'took': return 'Okay.';
      case 'where': return 'Okay, let me check.';
      case 'press': case 'scale': return 'Alright.';
      case 'allergy': return C.allergy ? 'Thanks for telling me. That\'s important.' : 'Good.';
      case 'back': return 'That\'s right.';
      case 'q': return C.note ? 'Sure, I can write one for you. Feel better soon!' : 'You\'re welcome. Feel better soon!';
      default: return null;
    }
  };

  /* =========================================================
     듣고 대답 고르기 16문제 (모두 새로 만든 대화). card = 그 상황의 사실
     ========================================================= */
  const o = (f, v) => { const a = { f }; if (v != null) a.v = String(v); return a; };
  const L = words => ({ f: 'line', line: { words } });
  PH.o = o; PH.L = L;
  // 기본 되짚기 (목감기약 알약: 두 알 · 하루 세 번 · 식후 · 5일)
  PH.LINE = { words: PH.lineWords(D0) };
  PH.LINE_FREQ = { words: ['so', 't2', 'f2', 'after', 'd5'] };
  PH.LINE_BEFORE = { words: ['so', 't2', 'f3', 'before', 'd5'] };
  PH.LINE_EAT = { words: ['eat', 't2', 'f3', 'after', 'd5'] };
  PH.LINE_X3 = { words: ['so', 't2', 'x3', 'after', 'd5'] };
  PH.LINE_MISS = { words: ['so', 't2', 'f3', 'd5'] };
  PH.LINE_BAD = { words: ['so', 'f3', 't2', 'after', 'd5'] };
  // 처방 되짚기 (항생제: 캡슐 하나 · 하루 두 번 · 밥과 함께 · 7일)
  PH.LINE_RX = { words: PH.lineWords(R0) };
  PH.LINE_RXF = { words: ['so', 'c1', 'f3', 'food', 'd7'] };
  PH.LINE_CHIPS = PH.lineChips({ sym: 'sorethroat', form: 'tablets', dk: 'ph' }, (() => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; })());
  PH.DRILL = [
    { q: 'cn_what', sit: '배가 아파서 약국에 왔어요. 먹을 만한 약을 사고 싶어요.', card: { sym: 'stomach' }, a: 1, opts: [o('cs_fact', 'stomach'), o('cs_rec', 'stomach'), o('cs_give', 'stomach'), o('cs_rec', 'cough')] },
    { q: 'cn_fast', sit: '약사가 아주 빠르게 말했어요. ‘… getcha …’만 들렸어요.', card: {}, a: 2, opts: [o('cs_rec', 'sorethroat'), o('g_yesp'), o('rp_again'), o('rp_allergy')] },
    { q: 'ak_long', sit: '어제부터 목이 아팠어요.', card: { since: 'yday' }, a: 3, opts: [o('g_yes'), o('sn_from', 'yday'), o('sn_for', '2d'), o('sn_since', 'yday')] },
    { q: 'ak_form', sit: '알약은 삼키기 힘들어서 물약이 좋아요.', card: { form: 'liquid' }, a: 0, opts: [o('fm_pl', 'liquid'), o('g_yesp'), o('fm_pl', 'tablets'), o('ot_no')] },
    { q: 'ak_allergy', sit: '약 알레르기는 없어요.', card: { allergy: null }, a: 1, opts: [o('al_dont'), o('al_not'), o('al_yes', 'penicillin'), o('g_yesp')] },
    { q: 'ds_say', sit: '약사가 목감기약 먹는 법을 알려 줬어요. 들은 대로 되짚어 확인하고 싶어요.', card: {}, a: 3, opts: [o('ds_ok'), L(PH.LINE_FREQ.words), L(PH.LINE_EAT.words), L(PH.LINE.words)] },
    { q: 'ds_cost', sit: '카드로 내고 싶어요.', card: { paym: 'card' }, a: 2, opts: [o('co_lit'), o('g_yes'), o('co_card'), o('co_exp')] },
    { q: 'fr_appt', sit: '예약 없이 병원에 왔어요.', card: { appt: false }, a: 1, opts: [o('ap_want'), o('ap_no'), o('g_yes'), o('fs_yes')] },
    { q: 'fr_dob', sit: '생년월일은 2005년 3월 4일이에요.', card: { dob: '2005-03-04' }, a: 0, opts: [o('db_is', '2005-03-04'), o('db_ko', '2005-03-04'), o('db_is', '2005-04-03'), o('g_yes')] },
    { q: 'fr_fast', sit: '접수 직원이 아주 빠르게 말했어요. ‘… date of birth …’만 들렸어요.', card: {}, a: 2, opts: [o('nm_sp', 'kim'), o('rp_need'), o('rp_dob'), o('g_yes')] },
    { q: 'dc_prob', sit: '귀가 아파서 병원에 왔어요.', card: { sym: 'earache', part: 'ear' }, a: 2, opts: [o('cs_sick', 'ear'), o('g_yes'), o('pb_have', 'earache'), o('pb_have', 'stomach')] },
    { q: 'dc_took', sit: '어제 진통제를 먹었어요.', card: { took: 'pain' }, a: 3, opts: [o('tk_no'), o('tk_ate', 'pain'), o('tk_yes', 'cold'), o('tk_yes', 'pain')] },
    { q: 'ex_scale', sit: '1부터 10까지로 치면 6쯤 아파요.', card: { scale: 6 }, a: 0, opts: [o('sc_about', '6'), o('g_yes'), o('sc_lit'), o('sc_about', '9')] },
    { q: 'ex_press', sit: '의사가 목을 누르니 아파요.', card: { press: true }, a: 1, opts: [o('pr_is'), o('pr_yes'), o('pr_no'), o('g_no')] },
    { q: 'pl_q', sit: '수업을 빠져서 학교에 낼 진단서(확인서)가 필요해요.', card: { note: true }, a: 3, opts: [o('q_diag'), o('g_yes'), o('q_give'), o('q_note')] },
    { q: 'pl_back', sit: '의사가 언제 다시 오라고 했어요. 들은 숫자가 맞는지 확인하고 싶어요.', card: {}, a: 0, opts: [o('bk_so', 'd3'), o('bk_ok'), o('bk_so', 'w1'), o('g_yes')] },
  ];
  PH.DRILL.forEach((it, i) => { it.n = i; it.Q = PH.Q[it.q]; it.place = it.Q.place; });
  // 직접 해 보기의 짧은 문제 (00장 · 04장 · 05장) — 연습 문제와 다른 상황
  PH.MINI = {
    intro: { q: 'cn_au', sit: '호주의 약국이에요. 기침이 나요.', card: { sym: 'cough' }, a: 2, opts: [o('g_yes'), o('cs_sick', 'chest'), o('cs_any', 'cough'), o('cs_fact', 'cough')] },
    cost: { q: 'ds_cost', sit: '약사가 값을 말했어요. 13.50달러인지 30.50달러인지 확인하고 싶어요.', card: {}, a: 1, opts: [o('co_say', '3050'), o('co_say', '1350'), o('co_exp'), o('fm_pl', 'tablets')] },
    dob: { q: 'fr_dob', sit: '생년월일은 2004년 11월 12일이에요.', card: { dob: '2004-11-12' }, a: 2, opts: [o('db_ko', '2004-11-12'), o('db_is', '2004-12-11'), o('db_is', '2004-11-12'), o('g_yes')] },
  };
  Object.values(PH.MINI).forEach(it => { it.Q = PH.Q[it.q]; it.place = it.Q.place; });

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 환자 (연습 문제와 겹치지 않게 골랐어요)
     ========================================================= */
  // 02–04장 약국: 목이 아파요 · 이틀 · 열 없음 · 다른 약 없음 · 알레르기 없음 · 알약 · 13.50달러 카드로 · 운전하지 않음
  // 05–08장 병원(사흘 뒤): 예약 없음 · 처음 · Kim · 2005년 3월 4일 · 여행자 보험 · 감기약을 먹었음 · 목 · 누르면 아픔 · 6점 · 진단서 필요
  PH.DEMO = { sym: 'sorethroat', since: '2d', fever: false, other: null, allergy: null, form: 'tablets', paym: 'card', drive: false,
    appt: false, first: true, name: 'kim', spell: 'K-I-M', dob: '2005-03-04', ins: 'travel', took: 'cold', part: 'throat', press: true, scale: 6, note: true, back: 'd3' };
  PH.DEMO.amount = PH.price(PH.DEMO.sym, PH.DEMO.form);
  PH.DEMO_DOSE = D0; PH.DEMO_RX = R0;
  PH.LONG = PH.say(D0);
  // 00장: 사실만 → 사실 + 부탁 · 복용법 → 되짚기
  PH.INTRO = { q: 'cn_what', half: o('cs_fact', 'sorethroat'), ok: o('cs_rec', 'sorethroat'), card: { sym: 'sorethroat' }, rq: 'ds_say', skip: o('ds_ok'), line: L(PH.LINE.words) };
  PH.SCENE = {
    // 02장 약국 카운터: 사실 + 부탁
    need: ['cn_what', o('cs_sick', 'throat'), o('cs_give', 'sorethroat'), o('cs_fact', 'sorethroat'), o('cs_rec', 'sorethroat'), o('cs_any', 'sorethroat')],
    since: ['ak_long', o('sn_dur', '2d'), o('sn_for', '2d'), o('sn_from', 'yday'), o('sn_since', 'yday')],
    // 03장 약사의 질문: 모양 · 짝 맞는 짧은 대답
    shapes: [['ak_fever', o('g_no'), o('fv_no')], ['ak_allergy', o('g_no'), o('al_not')], ['ak_form', o('g_yesp'), o('fm_pl', 'tablets')], ['ak_long', o('g_yes'), o('sn_for', '2d')]],
    aux: [['ak_fever', o('fv_have'), o('fv_no')], ['ak_allergy', o('al_dont'), o('al_not')], ['ak_fever', o('fv_am'), o('fv_no')]],
    other: ['ak_other', o('ot_eat', 'vitamin'), o('ot_no'), o('ot_yes', 'vitamin')],
    fast: ['ak_fast', o('al_not'), o('rp_allergy')],
    // 04장 복용법 되짚기 · 값 · 조심할 점
    lines: [['skip', o('ds_ok')], ['eat', L(PH.LINE_EAT.words)], ['x3', L(PH.LINE_X3.words)], ['freq', L(PH.LINE_FREQ.words)], ['miss', L(PH.LINE_MISS.words)], ['ok', L(PH.LINE.words)]],
    dfast: ['ds_fast', L(PH.LINE.words), o('rp_times')],
    cost: ['ds_cost', o('co_say', '3050'), o('co_say', '1350'), o('co_lit'), o('co_card')],
    warn: ['ds_warn', o('rp_wdrowsy'), o('wn_ok')],
    // 05장 병원 접수: 이름 · 철자 · 생일 · 보험
    appt: ['fr_appt', o('ap_want'), o('ap_no')],
    first: ['fr_first', o('fs_lit'), o('fs_yes')],
    name: ['fr_name', o('nm_sp', 'kim')],
    spell: ['fr_spell', o('g_yes'), o('sp_ok', 'K-I-M')],
    dob: ['fr_dob', o('db_ko', '2005-03-04'), o('db_is', '2005-03-04')],
    ins: ['fr_ins', o('is_have'), o('is_yes', 'travel')],
    fill: ['fr_form', o('fl_ok')],
    // 06장 진료실: 증상 설명 · 먹은 약
    prob: ['dc_prob', o('cs_sick', 'throat'), o('pb_have', 'sorethroat'), o('pb_hurt', 'throat')],
    took: ['dc_took', o('tk_ate', 'cold'), o('tk_yes', 'cold')],
    pfast: ['dc_fast', o('pb_have', 'sorethroat'), o('rp_prob')],
    // 07장 진찰: 아픈 자리 · 누르면 · 몇 점 · 알레르기
    where: ['ex_where', o('wh_pain'), o('wh_in', 'throat')],
    press: ['ex_press', o('pr_is'), o('pr_yes')],
    scale: ['ex_scale', o('sc_lit'), o('sc_about', '6')],
    allergy: ['ex_allergy', o('al_not'), o('al_dont')],
    // 08장 처방 되짚기 · 다시 올 날 · 진단서
    rx: [['skip', o('ds_ok')], ['freq', L(PH.LINE_RXF.words)], ['ok', L(PH.LINE_RX.words)]],
    back: ['pl_back', o('bk_ok'), o('bk_so', 'w1'), o('bk_so', 'd3')],
    q: ['pl_q', o('q_diag'), o('g_yes'), o('q_note')],
  };
  // 09장: 곳마다 한 줄 (3단계 적용)
  PH.METHOD = [
    ['cn_what', o('cs_rec', 'sorethroat'), { sym: 'sorethroat' }],
    ['ak_allergy', o('al_not'), { allergy: null }],
    ['ds_say', L(PH.LINE.words), {}],
    ['fr_dob', o('db_is', '2005-03-04'), { dob: '2005-03-04' }],
    ['dc_prob', o('pb_have', 'sorethroat'), { sym: 'sorethroat' }],
    ['ex_press', o('pr_yes'), { press: true }],
    ['pl_back', o('bk_so', 'd3'), {}],
  ];
  // 10장 실전: 환자 카드 하나로 넷 (보기 셋, 단계마다 지워짐)
  PH.PCARD = { sym: 'cough', since: '3d', fever: false, other: null, allergy: null, form: 'liquid', paym: 'cash', name: 'lee', dob: '2004-11-12', ins: 'student', note: false };
  PH.PCARD.amount = PH.price(PH.PCARD.sym, PH.PCARD.form);
  PH.PRACTICE = [
    { q: 'ak_form', opts: [o('g_yesp'), o('fm_pl', 'tablets'), o('fm_pl', 'liquid')], a: 2,
      lines: ['tablets or liquid → 고르는 질문 · (A) Yes, please → 고른 것이 없어 탈락', '(B) Tablets, please → 카드(물약)와 달라 탈락', '남은 보기는 공손해요 · 정답 (C) Liquid, please.'] },
    { q: 'ds_say', opts: [o('ds_ok'), L(['so', 'm10', 'e6', 'after', 'd5']), L(['so', 'm10', 'e6', 'd5'])], a: 2,
      lines: ['Take … every six hours → 안내 · 셋 모두 먹는 법에 대한 말이에요', '(A) Okay. Thanks. → 되짚지 않아 탈락 · (B) after meals → 들은 말에 없는 조각이라 탈락', '남은 보기는 공손해요 · 정답 (C) So, I take 10 ml, every six hours, for five days?'] },
    { q: 'fr_dob', opts: [o('db_is', '2004-11-12'), o('g_yes'), o('db_ko', '2004-11-12')], a: 0,
      lines: ['date of birth → 정보 질문 · (B) Yes. → 묻는 정보가 없어 탈락', '(C) 2004, 11, 12. → 숫자만 한국식 순서로 말해 탈락', '남은 보기는 공손해요 · 정답 (A) It\'s November 12th, 2004.'] },
    { q: 'pl_q', opts: [o('g_yesp'), o('q_plain'), o('q_no')], a: 2,
      lines: ['other questions → Yes/No 질문 · 셋 모두 Yes · No로 답할 수 있어요', '(A) Yes, please → 물어볼 것이 없는데 Yes라서 탈락', '(B) No. → 고맙다는 말 없이 끊겨 탈락 · 정답 (C) No, that\'s all. Thank you so much!'] },
  ];
  PH.practiceQ = p => PH.simQ(p.q, PH.PCARD);

  /* ---------- 이어서 들리는 말 (03 · 04장). 대문자 = 세게 ---------- */
  PH.LINKED = [
    { q: 'ak_form', en: 'Tablets or liquid?', say: 'Tablets or liquid?', words: ['Tablets', 'or', 'liquid?'], sound: [['TAB', 1], ['let', 0], ['ser', 0], ['LI', 1], ['quid', 0]], link: [[0, 1]], ko: 'tablets or → TAB-let-ser처럼 이어져요 · 고를 것(TABlets · LIquid)을 세게' },
    { q: 'ds_say', en: 'Three times a day.', say: 'Three times a day.', words: ['Three', 'times', 'a', 'day.'], sound: [['THREE', 1], ['tai', 0], ['mza', 0], ['DAY', 1]], link: [[1, 2]], ko: 'times a → tai-mza처럼 이어져요 · 숫자(THREE)와 DAY를 세게' },
  ];
  // 헷갈리는 숫자 짝 (04장): 앞이 세면 -ty, 뒤가 세면 -teen
  PH.PAIRS = [['13', 'thirTEEN', '30', 'THIRty'], ['15', 'fifTEEN', '50', 'FIFty'], ['14', 'fourTEEN', '40', 'FORty']];

  /* ---------- 직접 해 보기 자료 ---------- */
  PH.SHAPE_QS = ['cn_what', 'ak_long', 'ak_fever', 'ak_allergy', 'ak_form', 'ds_say', 'ds_cost', 'fr_appt', 'fr_first', 'fr_name', 'fr_dob', 'fr_ins', 'dc_prob', 'dc_took', 'ex_where', 'ex_press', 'ex_scale', 'pl_back', 'pl_q'];

  /* =========================================================
     따라 말하기 28문장 (곳마다 상대 · 나의 말 넷)
     ========================================================= */
  const SW = (place, who, en, ko, sp) => ({ place, who, en, ko, sp: who === 'me' ? 'me' : sp || PH.PLACE[place].sp });
  PH.SHADOW = [
    SW('counter', 'staff', 'Hi there. What can I get for you today?', '안녕하세요. 오늘 무엇을 드릴까요?'),
    SW('counter', 'me', 'I have a sore throat. Could you recommend something for it?', '목이 아파요. 먹을 만한 약을 추천해 주시겠어요?'),
    SW('counter', 'staff', 'Morning! What can I do for you?', '(호주) 안녕하세요! 무엇을 도와드릴까요?', 'au'),
    SW('counter', 'me', 'I have a cough. Do you have anything for it?', '기침이 나요. 먹을 만한 약이 있을까요?'),
    SW('ask', 'staff', 'How long have you had it?', '아픈 지 얼마나 되셨어요?'),
    SW('ask', 'me', 'For two days.', '이틀이요.'),
    SW('ask', 'staff', 'Are you allergic to any medicine?', '약에 알레르기가 있으세요?'),
    SW('ask', 'me', 'No, I\'m not.', '아니요, 없어요.'),
    SW('dose', 'staff', 'Take two tablets three times a day after meals, for five days.', '두 알씩 하루 세 번, 밥 먹은 뒤, 5일 동안 드세요.'),
    SW('dose', 'me', 'So, I take two tablets, three times a day, after meals, for five days?', '그러니까 제가 두 알씩, 하루 세 번, 식후에, 5일 동안 먹는 거죠?'),
    SW('dose', 'me', 'Sorry, did you say $13.50?', '죄송한데, 13달러 50센트라고 하셨어요?'),
    SW('dose', 'me', 'Sorry, what does drowsy mean?', '죄송한데, drowsy가 무슨 뜻이에요?'),
    SW('front', 'staff', 'Do you have an appointment?', '(영국) 예약하셨어요?'),
    SW('front', 'me', 'No, I don\'t. I\'d like to see a doctor, please.', '아니요. 의사 선생님께 진료를 받고 싶어요.'),
    SW('front', 'me', 'It\'s Kim, K-I-M.', '김이에요. K, I, M.'),
    SW('front', 'me', 'It\'s March 4th, 2005.', '2005년 3월 4일이에요.'),
    SW('doctor', 'staff', 'So, what seems to be the problem?', '그래서, 어디가 불편하세요?'),
    SW('doctor', 'me', 'I have a sore throat. It started two days ago.', '목이 아파요. 이틀 전에 시작됐어요.'),
    SW('doctor', 'staff', 'Have you taken anything for it?', '그것 때문에 드신 약이 있어요?'),
    SW('doctor', 'me', 'Yes, I took some cold medicine.', '네, 감기약을 먹었어요.'),
    SW('exam', 'staff', 'Does it hurt when I press here?', '여기를 누르면 아파요?'),
    SW('exam', 'me', 'Yes, it does.', '네, 아파요.'),
    SW('exam', 'staff', 'How bad is the pain, on a scale of one to ten?', '1부터 10까지로 치면 얼마나 아파요?'),
    SW('exam', 'me', 'About a six.', '6쯤이에요.'),
    SW('plan', 'staff', 'Take one capsule twice a day with food, for seven days.', '캡슐 하나씩 하루 두 번, 밥과 함께, 7일 동안 드세요.'),
    SW('plan', 'me', 'So, I should come back in three days if I\'m not better?', '그러니까, 사흘 뒤에도 안 나으면 다시 오면 되죠?'),
    SW('plan', 'me', 'Could I get a doctor\'s note for my class?', '수업에 낼 진단서(확인서)를 받을 수 있을까요?'),
    SW('plan', 'me', 'No, that\'s all. Thank you so much!', '아니요, 그거면 돼요. 정말 고맙습니다!'),
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: key 열쇠 낱말 · frame 대답 틀 · slot 내 정보 · pol 공손한 말 · trap 함정 · ok 정답
     ========================================================= */
  const LL = k => `(${L4[k]})`;
  PH.judgeItem = (it, k) => PH.judge(it.Q, it.opts[k], it.card, '상황');
  const CARD_SKIP = { amount: 1, dk: 1 };
  const cardSay = c => Object.keys(c || {}).filter(k => !CARD_SKIP[k] && c[k] !== undefined).map(k => PH.factKo(k, c[k])).join(' · ');
  const segMarks = (a, k, roleOf) => PH.segs(a).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).map(s => ({ t: s.t.trim().replace(/^[,.?!]+|[,.?!]+$/g, ''), role: roleOf(s), at: k })).filter(m => m.t);
  const tagKo = j => j.tag === 'fact' ? '상황 · 들은 말과 다른 정보' : j.tag === 'need' ? '꼭 말할 조각이 빠지거나 되짚지 않음' : j.tag === 'order' ? '순서가 뒤섞임' : j.tag === 'wrong' ? '틀린 문장 · 짝이 맞지 않는 대답' : '한국어 그대로 옮긴 말 · 콩글리시';
  PH.steps = function (it) {
    const q = it.Q, J = it.opts.map((_, k) => PH.judgeItem(it, k)), at = s => it.opts.map((_, k) => k).filter(k => J[k].stage === s);
    const best = it.opts[it.a], SHp = PH.SHAPE[q.shape], C = Object.assign({}, it.card || {}, q.fact || {});
    // ①
    let t1;
    if (q.fast) t1 = '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 말했는지 모르면 짐작해서 답하지 말고 다시 물어요. 들린 낱말이 있으면 그 부분만 되물어요.';
    else t1 = `열쇠 낱말 ${q.key.join(' … ')} → ${SHp.ko}(${SHp.mark}). ${PH.sayOf(q.intent)}. ${PH.INTENT[q.intent].want}`;
    if (at(1).length) t1 += ' ' + at(1).map(k => LL(k)).join(' · ') + (q.fast ? ' → 짐작한 대답이거나 다른 말을 되물어 탈락.' : J[at(1)[0]].tag === 'shape' ? ' → 모양이 맞지 않거나 다른 질문의 대답이라 탈락.' : ' → 다른 질문에 맞는 대답이라 탈락.');
    const m1 = q.fast ? [] : q.key.map(t => ({ t, role: 'key', at: 'q' }));
    at(1).forEach(k => m1.push({ t: PH.text(it.opts[k]).replace(/[.?!]$/, ''), role: 'trap', at: k }));
    // ②
    const sit = cardSay(it.card);
    const Fb = PH.FRAME[best.f], ft = Fb.line ? 'So, I take + 들은 조각을 차례대로?' : Fb.t ? Fb.t.replace(/[{}]/g, '').replace('___', '…') : PH.text(best);
    let t2 = (q.fast ? '상황 → 처음 듣고 다 알아듣지 못했어요. ' : sit ? `상황 → ${sit}. ` : '') + `맞는 틀 → ${ft}`;
    if (at(2).length) t2 += ' · ' + at(2).map(k => `${LL(k)} ${tagKo(J[k])}`).join(' · ') + ' → 탈락.';
    else t2 += ' · 틀과 정보가 모두 맞는 보기만 남았어요.';
    const m2 = [];
    it.opts.forEach((a, k) => {
      if (J[k].stage === 1) return;
      const F = PH.FRAME[a.f];
      if (F.line) {
        const lo = PH.checkLine(a.line, C), wrong = lo.err ? lo.err.word.t : null, badW = (a.line.words || []).map(w => PH.OW[w]).find(x => x && x.bad);
        PH.lineSegs(a.line).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).forEach(s => { const t = s.t.trim(); m2.push({ t, role: J[k].stage === 2 && (t === wrong || (badW && t === badW.t)) ? 'trap' : s.r === 'frame' ? 'frame' : 'slot', at: k }); });
        return;
      }
      const trapOf = s => J[k].stage !== 2 ? false : J[k].tag === 'fact' ? (F.slot ? s.r === 'slot' : s.r === 'frame') : s.r === 'frame' || s.r === 'slot';
      segMarks(a, k, s => s.r === 'pol' ? '' : trapOf(s) ? 'trap' : s.r).forEach(m => { if (m.role) m2.push(m); });
    });
    // ③
    let t3 = at(3).length ? at(3).map(k => `${LL(k)} ${PH.text(it.opts[k])} → ${J[k].tag === 'plain' ? '고맙다는 말 없이 끊김' : '명령 · 조르는 말 · 퉁명스러운 말'}`).join(' · ') + ' → 탈락. ' : '무례하게 들리는 보기는 없어요. ';
    t3 += `정답 ${LL(it.a)} → ${J[it.a].why}`;
    const m3 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 3) segMarks(a, k, () => 'trap').forEach(m => m3.push(m)); else if (J[k].stage === 0) segMarks(a, k, s => s.r === 'pol' ? 'pol' : '').forEach(m => { if (m.role) m3.push(m); }); });
    m3.push({ t: PH.text(it.opts[it.a]), role: 'ok', at: it.a, whole: true });
    return [
      { head: '① 열쇠 낱말 + 질문의 모양 잡기', text: t1, marks: m1 },
      { head: '② 틀에 내 정보 넣기', text: t2, marks: m2 },
      { head: '③ 공손하게 끝내기', text: t3, marks: m3 },
    ];
  };
  PH.notes = it => it.opts.map((_, k) => { const j = PH.judgeItem(it, k); return (j.ok ? '' : `× ${['', '①', '②', '③'][j.stage]} `) + j.why; });

  /* =========================================================
     데이터 점검 — 문제 데이터와 엔진이 어긋나면 콘솔 경고
     ========================================================= */
  // 하루 시간표를 다른 방법으로 한 번 더: 몇 번 먹는지 · 식사와 어떻게 놓이는지
  PH.verifyDose = function (D) {
    const out = [], S = PH.schedule(D), F = PH.FREQ[D.freq], W = D.time ? PH.WHEN[D.time] : null;
    const n = F.every ? Math.floor((PH.AWAKE[1] - PH.AWAKE[0]) / F.every) + 1 : F.per;
    if (S.length !== n) out.push(`하루 ${n}번이어야 하는데 시간표는 ${S.length}번이에요`);
    for (let i = 1; i < S.length; i++) if (S[i] <= S[i - 1]) out.push('시간표가 차례대로가 아니에요');
    if (F.every) for (let i = 1; i < S.length; i++) if (S[i] - S[i - 1] !== F.every) out.push(`${F.every}시간 간격이 아니에요`);
    if (W && !W.bed) S.forEach(h => { const m = PH.MEALS.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a); if ((W.at > 0 && !(h > m)) || (W.at < 0 && !(h < m)) || (W.at === 0 && h !== m)) out.push(`${W.t}: ${h}시가 식사(${m}시)와 맞지 않아요`); });
    if (W && W.bed && S[S.length - 1] !== PH.BED) out.push('자기 전이 마지막이 아니에요');
    if (S.some(h => h < PH.AWAKE[0] - 1 || h > PH.BED)) out.push('깨어 있는 시간 밖에 먹어요');
    let sum = 0; for (let d = 0; d < PH.LEN[D.len].days; d++) sum += S.length * PH.AMT[D.amt].n;
    if (sum !== PH.total(D)) out.push(`모두 ${sum}인데 PH.total은 ${PH.total(D)}이에요`);
    return out;
  };
  PH.check = function () {
    const bad = [];
    const hasT = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase());
    Object.values(PH.Q).forEach(q => {
      if (!PH.PLACE[q.place]) bad.push(`말 ${q.id}: 곳 ${q.place}가 없어요`);
      if (!PH.INTENT[q.intent]) bad.push(`말 ${q.id}: 뜻 ${q.intent}가 없어요`);
      q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`말 ${q.id}: 열쇠 낱말 ‘${k}’가 말에 없어요`); });
      if (PH.shapeGuess(q.en) !== q.shape) bad.push(`말 ${q.id}: 적어 둔 모양 ${q.shape} · 글의 모양 ${PH.shapeGuess(q.en)}`);
      if (q.shape === 'or') { if (!q.choices || q.choices.length < 2) bad.push(`말 ${q.id}: 고르는 질문에 choices가 없어요`); else { const In = PH.INTENT[q.intent], S = Object.values(PH.SLOT).find(s => s.key === In.key); q.choices.forEach(c => { if (!S || !S.vals[c]) bad.push(`말 ${q.id}: 고를 것 ${c}가 칸에 없어요`); }); } }
      if (q.shape === 'yn' && !q.fast && !q.aux && !PH.INTENT[q.intent].offer) bad.push(`말 ${q.id}: Yes/No 질문에 짝(aux)이 없어요`);
      if (q.aux) { const first = String(q.en).match(/[^.!?]*\?/g).pop().trim().split(/\s+/)[0].toLowerCase(); const want = { do: 'do', be: 'are', is: 'is', does: 'does', have: 'have' }[q.aux]; if (!q.fast && first !== want && !(q.aux === 'spell')) bad.push(`말 ${q.id}: 짝 ${q.aux} · 첫 낱말 ${first}`); }
    });
    Object.values(PH.FRAME).forEach(F => {
      [].concat(F.intent).forEach(i => { if (i !== 'yn' && i !== 'repair' && !PH.INTENT[i]) bad.push(`틀 ${F.id}: 뜻 ${i}가 없어요`); });
      if (F.slot && !PH.SLOT[F.slot]) bad.push(`틀 ${F.id}: 칸 ${F.slot}이 없어요`);
      if (F.slot && !/___/.test(F.t)) bad.push(`틀 ${F.id}: 칸이 있는데 ___가 없어요`);
      if ((F.tag !== 'ok' || F.half || F.skip) && !F.why) bad.push(`틀 ${F.id}: 함정 틀에 까닭(why)이 없어요`);
      if (F.aux && !PH.AUX[F.aux]) bad.push(`틀 ${F.id}: 짝 ${F.aux}가 없어요`);
    });
    Object.entries(PH.INTENT).forEach(([k, In]) => { if (In.best && typeof In.best === 'string' && !PH.FRAME[In.best]) bad.push(`뜻 ${k}의 모범 틀 ${In.best}가 없어요`); });
    Object.values(PH.OW).forEach(w => { if (!PH.OCAT[w.c]) bad.push(`되짚기 조각 ${w.t}: 갈래 ${w.c}가 없어요`); if (w.bad && !w.why) bad.push(`되짚기 조각 ${w.t}: 까닭이 없어요`); });
    // 숫자 읽기 · 값 · 날짜 · 철자
    [[1350, 'thirteen fifty'], [2000, 'twenty dollars'], [940, 'nine forty'], [1030, 'ten thirty'], [1440, 'fourteen forty'], [605, 'six oh five'], [100, 'one dollar']].forEach(([c, w]) => { if (PH.priceWords(c) !== w) bad.push(`값 읽기 ${c}: ${PH.priceWords(c)}`); });
    [['2005-03-04', 'March 4th, 2005', 'March fourth, two thousand five'], ['2004-11-12', 'November 12th, 2004', 'November twelfth, two thousand four'], ['2003-07-21', 'July 21st, 2003', 'July twenty-first, two thousand three'], ['2007-02-02', 'February 2nd, 2007', 'February second, two thousand seven'], ['2006-08-23', 'August 23rd, 2006', 'August twenty-third, two thousand six'], ['1998-06-11', 'June 11th, 1998', 'June eleventh, nineteen ninety-eight']].forEach(([v, t, w]) => {
      if (PH.dateText(v) !== t) bad.push(`날짜 쓰기 ${v}: ${PH.dateText(v)}`);
      if (PH.dateWords(v) !== w) bad.push(`날짜 읽기 ${v}: ${PH.dateWords(v)}`);
      [t, w, 'It\'s ' + w + '.', PH.spoken('It\'s ' + t + '.')].forEach(s => { const h = PH.heardDob(s); if (!h || h.iso !== v) bad.push(`생일 듣기 ${s}: ${JSON.stringify(h)}`); });
    });
    [['the fourth of March, 2005', '2005-03-04'], ['4th March 2005', '2005-03-04']].forEach(([s, v]) => { const h = PH.heardDob(s); if (!h || h.iso !== v) bad.push(`생일 듣기 ${s}: ${JSON.stringify(h)}`); });
    [['2005, 3, 4', 'nums'], ['March fourth', 'part']].forEach(([s, k]) => { const h = PH.heardDob(s); if (!h || !h[k]) bad.push(`생일 듣기 ${s}: ${JSON.stringify(h)}`); });
    [['thirteen fifty', '1350'], ['$13.50', '1350'], ['13.50', '1350'], ['fifteen', '15'], ['fifty', '50'], ['two thousand five', '2005'], ['twenty-first', '21']].forEach(([s, r]) => { if (!PH.canon(s).includes(r)) bad.push(`숫자 맞추기 ${s}: ${PH.canon(s).join(' ')}`); });
    [['It\'s Kim, K, I, M.', 'K-I-M'], ['Sure. P-A-R-K.', 'P-A-R-K'], ['Sure, I can. C, H, O, I.', 'C-H-O-I'], ['It\'s Lee.', null]].forEach(([s, w]) => { if (PH.heardLetters(s) !== w) bad.push(`철자 듣기 ${s}: ${PH.heardLetters(s)}`); });
    [['Take 15 ml three times a day after meals, for five days.', 'Take fifteen milliliters three times a day after meals, for five days.'], ['It\'s March 4th, 2005.', 'It\'s March fourth, two thousand five.'], ['It\'s Kim, K-I-M.', 'It\'s Kim, K, I, M.'], ['Okay, that\'s $13.50, please.', 'Okay, that\'s thirteen fifty, please.'], ['About a 6.', 'About a six.']].forEach(([s, w]) => { if (PH.spoken(s) !== w) bad.push(`읽을 글: ${PH.spoken(s)}`); });
    // 약 · 복용법: 시간표 · 모두 몇 알 · 하루 최대 · 되짚기
    const doses = [];
    PH.SYM_IDS.forEach(s => ['tablets', 'liquid'].forEach(f => doses.push([`약국 ${s} ${f}`, PH.otc(s, f), { sym: s, form: f, dk: 'ph' }])));
    PH.SYM_IDS.forEach(s => [null, 'penicillin', 'aspirin'].forEach(al => doses.push([`처방 ${s} ${al}`, PH.rx(s, al), { sym: s, allergy: al, dk: 'rx' }])));
    doses.forEach(([w, D, C]) => {
      PH.verifyDose(D).forEach(e => bad.push(`복용법 ${w}: ${e}`));
      const said = PH.say(D);
      [PH.AMT[D.amt].t, PH.FREQ[D.freq].t, PH.LEN[D.len].t].concat(D.time ? [PH.WHEN[D.time].t] : []).forEach(x => { if (!said.includes(x)) bad.push(`복용법 안내 ${w}: ‘${x}’가 없어요`); });
      const ml = PH.modelLine(PH.doseOf(C)), jl = PH.checkLine(ml.line, C);
      if (!jl.ok) bad.push(`되짚기 ${w}: 모범 되짚기가 탈락 (${PH.lineText(ml.line)})`);
      const pl = PH.parseLine(PH.spoken(PH.lineText(ml.line)));
      if (JSON.stringify(pl) !== JSON.stringify(ml.line.words)) bad.push(`되짚기 ${w}: 말로 한 되짚기를 다르게 읽어요 (${pl.join(' ')})`);
      const fast = PH.parseLine(PH.spoken(PH.sayFast(D)));
      if (JSON.stringify(fast.slice(1)) !== JSON.stringify(ml.line.words.slice(1))) bad.push(`빠른 안내 ${w}: 조각을 다르게 읽어요 (${fast.join(' ')})`);
    });
    Object.entries(PH.MEDS).forEach(([k, M]) => ['tablets', 'liquid'].forEach(f => { const D = { amt: f === 'liquid' ? M.liq : M.tab, freq: M.freq, time: M.time, len: M.len }, day = PH.AMT[D.amt].n * PH.perDay(D); if (day > M.max[f]) bad.push(`약 ${k} ${f}: 하루 ${day} > 최대 ${M.max[f]}`); }));
    // 처방 안전: 알레르기가 있는 성분은 주지 않아요
    PH.SYM_IDS.forEach(s => ['penicillin', 'aspirin'].forEach(al => { const R = PH.safeRx(s, al); if (R.has && R.has === al) bad.push(`처방 ${s}: ${al} 알레르기인데 ${al}이 든 약을 줘요`); if (PH.RX[s].has === al && !/allergic/.test(PH.rxSay(s, al))) bad.push(`처방 ${s}: 알레르기 때문에 바꾼 까닭을 말하지 않아요`); }));
    if (PH.total(D0) !== 30) bad.push(`기본 복용법 모두 ${PH.total(D0)}알`);
    if (PH.say(D0) !== PH.LONG || PH.Q.ds_say.en !== PH.LONG) bad.push('ds_say 글이 기본 복용법과 달라요');
    if (PH.price('sorethroat', 'tablets') !== PH.Q.ds_cost.fact.amount) bad.push('ds_cost 값이 약값과 달라요');
    // 되짚기 판정: 맞는 줄 · 횟수 · 식전 · eat · three times one day · 빠진 조각 · 순서 · 식사와 상관없는 약
    const DC = { sym: 'sorethroat', form: 'tablets', dk: 'ph' }, lc = (w, Lw, c, f) => { const r = PH.checkLine(Lw, c); if (!f(r)) bad.push(`되짚기 ${w}: ${JSON.stringify({ ok: r.ok, stage: r.stage, tag: r.tag, err: r.err && r.err.type, missing: r.missing })}`); return r; };
    lc('맞는 줄', PH.LINE, DC, r => r.ok);
    lc('횟수', PH.LINE_FREQ, DC, r => !r.ok && r.tag === 'fact' && r.err.type === 'freq');
    lc('식전', PH.LINE_BEFORE, DC, r => !r.ok && r.tag === 'fact' && r.err.type === 'time');
    lc('eat', PH.LINE_EAT, DC, r => !r.ok && r.tag === 'literal');
    lc('three times one day', PH.LINE_X3, DC, r => !r.ok && r.tag === 'literal');
    lc('빠진 조각', PH.LINE_MISS, DC, r => !r.ok && r.tag === 'need');
    lc('순서', PH.LINE_BAD, DC, r => !r.ok && r.tag === 'order');
    lc('15 · 50 ml', { words: ['so', 'm50', 'f3', 'after', 'd5'] }, { sym: 'sorethroat', form: 'liquid', dk: 'ph' }, r => !r.ok && r.err && r.err.type === 'amt' && /fifTEEN/.test(r.why));
    lc('식사와 상관없는 약', { words: ['so', 't1', 'e6', 'after', 'd5'] }, { sym: 'cough', form: 'tablets', dk: 'ph' }, r => !r.ok && r.err && r.err.type === 'notime');
    lc('식사와 상관없는 약 맞음', { words: ['so', 't1', 'e6', 'd5'] }, { sym: 'cough', form: 'tablets', dk: 'ph' }, r => r.ok);
    lc('처방 맞음', PH.LINE_RX, { dk: 'rx' }, r => r.ok);
    lc('처방 횟수', PH.LINE_RXF, { dk: 'rx' }, r => !r.ok && r.err && r.err.type === 'freq');
    lc('알레르기 처방', { words: PH.lineWords(PH.rx('sorethroat', 'penicillin')) }, { dk: 'rx', allergy: 'penicillin' }, r => r.ok);
    lc('알레르기 처방에 원래 약', PH.LINE_RX, { dk: 'rx', allergy: 'penicillin' }, r => !r.ok && r.tag === 'fact');
    if (!/three times a day/.test(PH.fixLine(PH.LINE_FREQ, DC).en)) bad.push(`고쳐 주는 말 (횟수): ${PH.fixLine(PH.LINE_FREQ, DC).en}`);
    if (!/after meals/.test(PH.fixLine(PH.LINE_MISS, DC).en)) bad.push(`고쳐 주는 말 (빠진 조각): ${PH.fixLine(PH.LINE_MISS, DC).en}`);
    if (PH.fixLine(PH.LINE, DC).en !== 'That\'s right!') bad.push(`고쳐 주는 말 (맞음): ${PH.fixLine(PH.LINE, DC).en}`);
    // 연습 문제
    const pos = [0, 0, 0, 0];
    PH.DRILL.forEach((it, i) => {
      const w = `듣고 대답 고르기 ${i + 1}`;
      if (!it.Q) { bad.push(`${w}: 말 ${it.q}가 없어요`); return; }
      const good = it.opts.map((_, k) => k).filter(k => PH.judgeItem(it, k).ok);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]} (${it.opts.map((_, k) => PH.judgeItem(it, k).why).join(' | ')})`);
      const texts = it.opts.map(PH.text);
      if (new Set(texts).size !== texts.length) bad.push(`${w}: 같은 보기가 있어요`);
      if (!it.sit) bad.push(`${w}: 상황 글이 없어요`);
      const st = PH.steps(it); if (st.length !== 3 || st.some(s => !s.text)) bad.push(`${w}: 풀이 단계가 비었어요`);
      pos[it.a]++;
    });
    if (PH.DRILL.length !== 16) bad.push(`듣고 대답 고르기 ${PH.DRILL.length}문제`);
    if (Math.max(...pos) - Math.min(...pos) > 0) bad.push(`듣고 대답 고르기 정답 위치가 몰려 있어요: ${pos.join(',')}`);
    const places = new Set(PH.DRILL.map(it => it.place));
    PH.PLACES.forEach(p => { if (!places.has(p.id)) bad.push(`듣고 대답 고르기: ${p.ko} 문제가 없어요`); });
    if (PH.DRILL.filter(it => it.Q.fast).length < 2) bad.push('듣고 대답 고르기: 빠른 말(다시 묻기) 문제가 둘보다 적어요');
    const yesTrap = PH.DRILL.filter(it => (it.Q.shape === 'or' || it.Q.shape === 'wh') && it.opts.some(a => PH.FRAME[a.f].bare)).length;
    if (yesTrap < 4) bad.push(`듣고 대답 고르기: 고르는 · 정보 질문에 Yes 함정이 있는 문제가 ${yesTrap}개뿐이에요`);
    if (!PH.DRILL.some(it => it.opts.some(a => a.f === 'line'))) bad.push('듣고 대답 고르기: 되짚기 문제가 없어요');
    if (!PH.DRILL.some(it => it.opts.some(a => PH.judgeItem(it, it.opts.indexOf(a)).stage === 2 && PH.judgeItem(it, it.opts.indexOf(a)).tag === 'wrong' && PH.FRAME[a.f].aux))) bad.push('듣고 대답 고르기: 짝이 다른 짧은 대답 문제가 없어요');
    Object.entries(PH.MINI).forEach(([k, it]) => { const good = it.opts.map((_, i) => i).filter(i => PH.judgeItem(it, i).ok); if (good.length !== 1 || good[0] !== it.a) bad.push(`직접 해 보기 ${k}: 맞는 보기 ${good}`); });
    // 영상 · 직접 해 보기의 대화가 판정과 맞나
    const want = (w, q, a, c, ok) => { const j = PH.judge(q, a, c); if (j.ok !== ok) bad.push(`${w}: ${PH.text(a)} → 판정 ${j.ok ? '✓' : '×'} (${j.why})`); return j; };
    const D = PH.DEMO, SC = PH.SCENE, I0 = PH.INTRO;
    want('00장 사실만', I0.q, I0.half, I0.card, false); want('00장 사실 + 부탁', I0.q, I0.ok, I0.card, true);
    want('00장 되짚지 않음', I0.rq, I0.skip, D, false); want('00장 되짚기', I0.rq, I0.line, D, true);
    [false, false, false, true, true].forEach((ok, k) => want(`02장 증상 ${k + 1}`, SC.need[0], SC.need[k + 1], D, ok));
    want('02장 During', SC.since[0], SC.since[1], { since: '2d' }, false); want('02장 For', SC.since[0], SC.since[2], { since: '2d' }, true);
    want('02장 From', SC.since[0], SC.since[3], { since: 'yday' }, false); want('02장 Since', SC.since[0], SC.since[4], { since: 'yday' }, true);
    SC.shapes.forEach(([q, a, b]) => { const yn = PH.Q[q].shape === 'yn'; want(`03장 모양 ${q} 앞`, q, a, D, yn); want(`03장 모양 ${q} 뒤`, q, b, D, true); });
    SC.aux.forEach(([q, a, b]) => { const j = want(`03장 짝 ${q} 앞`, q, a, D, false); if (j.stage !== 2) bad.push(`03장 짝 ${q}: ${j.stage}단계에서 탈락`); want(`03장 짝 ${q} 뒤`, q, b, D, true); });
    want('03장 eating', SC.other[0], SC.other[1], { other: 'vitamin' }, false); want('03장 다른 약 없음', SC.other[0], SC.other[2], D, true); want('03장 비타민', SC.other[0], SC.other[3], { other: 'vitamin' }, true);
    want('03장 빠른 말 짐작', SC.fast[0], SC.fast[1], D, false); want('03장 빠른 말 되묻기', SC.fast[0], SC.fast[2], D, true);
    SC.lines.forEach(([k, a]) => want(`04장 되짚기 ${k}`, 'ds_say', a, D, k === 'ok'));
    want('04장 빠른 복용법 짐작', SC.dfast[0], SC.dfast[1], D, false); want('04장 빠른 복용법 되묻기', SC.dfast[0], SC.dfast[2], D, true);
    want('04장 되묻기 30.50', SC.cost[0], SC.cost[1], D, false); want('04장 되묻기 13.50', SC.cost[0], SC.cost[2], D, true); want('04장 Card is okay', SC.cost[0], SC.cost[3], D, false); want('04장 카드로', SC.cost[0], SC.cost[4], D, true);
    want('04장 drowsy 묻기', SC.warn[0], SC.warn[1], D, true); want('04장 운전 안 함', SC.warn[0], SC.warn[2], D, true);
    want('05장 I want doctor', SC.appt[0], SC.appt[1], D, false); want('05장 예약 없음', SC.appt[0], SC.appt[2], D, true);
    want('05장 I am first', SC.first[0], SC.first[1], D, false); want('05장 처음', SC.first[0], SC.first[2], D, true);
    want('05장 이름', SC.name[0], SC.name[1], D, true);
    want('05장 철자 Yes', SC.spell[0], SC.spell[1], D, false); want('05장 철자', SC.spell[0], SC.spell[2], D, true);
    want('05장 숫자만', SC.dob[0], SC.dob[1], D, false); want('05장 생일', SC.dob[0], SC.dob[2], D, true);
    want('05장 Yes, I have', SC.ins[0], SC.ins[1], D, false); want('05장 보험', SC.ins[0], SC.ins[2], D, true); want('05장 서류', SC.fill[0], SC.fill[1], D, true);
    want('06장 is sick', SC.prob[0], SC.prob[1], D, false); want('06장 I have', SC.prob[0], SC.prob[2], D, true); want('06장 hurts', SC.prob[0], SC.prob[3], D, true);
    want('06장 ate', SC.took[0], SC.took[1], D, false); want('06장 took', SC.took[0], SC.took[2], D, true);
    want('06장 빠른 말 짐작', SC.pfast[0], SC.pfast[1], D, false); want('06장 빠른 말 되묻기', SC.pfast[0], SC.pfast[2], D, true);
    want('07장 Here is pain', SC.where[0], SC.where[1], D, false); want('07장 It hurts in', SC.where[0], SC.where[2], D, true);
    want('07장 Yes, it is', SC.press[0], SC.press[1], D, false); want('07장 Yes, it does', SC.press[0], SC.press[2], D, true);
    want('07장 Very pain', SC.scale[0], SC.scale[1], D, false); want('07장 About a six', SC.scale[0], SC.scale[2], D, true);
    want('07장 No, I\'m not', SC.allergy[0], SC.allergy[1], D, false); want('07장 No, I don\'t', SC.allergy[0], SC.allergy[2], D, true);
    SC.rx.forEach(([k, a]) => want(`08장 처방 되짚기 ${k}`, 'pl_rx', a, D, k === 'ok'));
    want('08장 되짚지 않음', SC.back[0], SC.back[1], D, false); want('08장 일주일', SC.back[0], SC.back[2], D, false); want('08장 사흘', SC.back[0], SC.back[3], D, true);
    want('08장 diagnosis', SC.q[0], SC.q[1], D, false); want('08장 Yes만', SC.q[0], SC.q[2], D, false); want('08장 doctor\'s note', SC.q[0], SC.q[3], D, true);
    [['ds_say', PH.Q.ds_say.en], ['ds_cost', PH.Q.ds_cost.en], ['pl_rx', PH.Q.pl_rx.en], ['pl_back', PH.Q.pl_back.en]].forEach(([id, en]) => { if (PH.simQ(id, D).en !== en) bad.push(`DEMO와 말이 달라요 ${id}: ${PH.simQ(id, D).en}`); });
    if (PH.DEMO.back !== PH.Q.pl_back.fact.back) bad.push('DEMO의 다시 올 날이 pl_back과 달라요');
    PH.METHOD.forEach(([q, a, c], i) => want(`09장 ${i + 1}`, q, a, Object.assign({}, D, c), true));
    if (PH.METHOD.length !== PH.PLACES.length || PH.METHOD.some(([q], i) => PH.Q[q].place !== PH.PLACES[i].id)) bad.push('09장: 곳마다 한 줄이 아니에요');
    // 실전: 지워지는 단계가 줄 글과 맞나
    PH.PRACTICE.forEach((p, i) => {
      const w = `실전 ${i + 1}`, q = PH.practiceQ(p);
      const J = p.opts.map(a => PH.judge(q, a, PH.PCARD));
      const good = J.map((j, k) => j.ok ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== p.a) bad.push(`${w}: 맞는 보기 ${good}`);
      [1, 2, 3].forEach(st => {
        const gone = J.map((j, k) => j.stage === st ? LL(k) : null).filter(Boolean).sort().join();
        const said = (p.lines[st - 1].match(/\([A-D]\)/g) || []).filter(x => st < 3 || x !== LL(p.a)).sort().join();
        if (gone !== said) bad.push(`${w} ${st}단계: 엔진 ${gone || '-'} · 화면 ${said || '-'}`);
      });
      if (!p.lines[2].includes(`정답 ${LL(p.a)}`)) bad.push(`${w}: 정답 표시가 달라요`);
      if (!p.lines[2].includes(PH.text(p.opts[p.a]).replace(/\.$/, ''))) bad.push(`${w}: 정답 글이 달라요 (${PH.text(p.opts[p.a])})`);
    });
    // 시뮬레이터: 카드 여럿 — 모범 대답은 통과, 틀 칩 가운데 맞는 것이 하나뿐인지, 모범 대답을 말로 해도 통과하는지
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 60; n++) {
      const c = PH.newCard(rnd);
      PH.simQs(c).forEach(id => {
        const q = PH.simQ(id, c), C = Object.assign({}, c, q.fact || {}), m = PH.model(q, C), j = PH.judge(q, m, C);
        if (!j.ok) bad.push(`시뮬레이터 ${id}: 모범 대답이 탈락 (${PH.text(m)} · ${j.why})`);
        const ms = PH.matchSpoken(PH.spoken(PH.text(m)), q, C);
        if (!ms.ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 말로 해도 통과하지 못해요 (${PH.text(m)} · ${ms.why})`);
        if (PH.shapeGuess(q.en) !== q.shape) bad.push(`시뮬레이터 ${id}: 모양 ${q.shape} · 글 ${PH.shapeGuess(q.en)} (${q.en})`);
        q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`시뮬레이터 ${id}: 열쇠 낱말 ‘${k}’가 말에 없어요 (${q.en})`); });
        const fr = PH.simFrames(q.intent, C);
        if (!fr) { bad.push(`시뮬레이터 ${id}: 틀 칩이 없어요`); return; }
        if (q.intent === 'dose') {
          const chips = PH.lineChips(C, rnd), mw = m.line.words.filter(w => w !== 'so');
          if (chips.length !== mw.length) bad.push(`시뮬레이터 되짚기: 조각 자리 ${chips.length} · 모범 조각 ${mw.length}`);
          chips.forEach((g, k) => {
            if (!g.ids.includes(mw[k])) bad.push(`시뮬레이터 되짚기: ${k + 1}번째 자리에 맞는 조각(${mw[k]})이 없어요 (${g.ids})`);
            g.ids.filter(x => x !== mw[k]).forEach(x => { const w2 = ['so'].concat(mw.map((y, i) => i === k ? x : y)); if (!PH.OW[x]) bad.push(`시뮬레이터 되짚기: 조각 ${x}가 없어요`); else if (PH.judge(q, L(w2), C).ok) bad.push(`시뮬레이터 되짚기: 함정 조각 ${x}가 통과해요 (${c.sym})`); });
          });
          if (PH.judge(q, o('ds_ok'), C).ok) bad.push('시뮬레이터 되짚기: Okay. Thanks.가 통과해요');
          return;
        }
        const okN = fr.filter(f => { const F = PH.FRAME[f]; if (!F.slot) return PH.judge(q, { f }, C).ok; return PH.slotChoices(F.slot, C, rnd, q).some(v => PH.judge(q, { f, v }, C).ok); }).length;
        if (okN !== 1) bad.push(`시뮬레이터 ${id}: 맞는 틀이 ${okN}개예요 (${fr.join(',')})`);
        fr.forEach(f => { const F = PH.FRAME[f]; if (F.slot && !PH.slotChoices(F.slot, C, rnd, q).length) bad.push(`시뮬레이터 ${id}: ${f}의 칸 칩이 없어요`); });
        if (!fr.includes(m.f)) bad.push(`시뮬레이터 ${id}: 틀 칩에 모범 틀(${m.f})이 없어요`);
        const F = PH.FRAME[m.f];
        if (F.slot) { const ch = PH.slotChoices(F.slot, C, rnd, q), okv = ch.filter(v => PH.judge(q, { f: m.f, v }, C).ok); if (okv.length !== 1) bad.push(`시뮬레이터 ${id}: ${m.f}의 칸 칩 가운데 맞는 값이 ${okv.length}개예요 (${ch})`); }
      });
    }
    // 말로 대답하기: 모양 · 다른 값 · 콩글리시 · 짐작은 통과하지 않아야
    const rep = (w, raw, q, c, k) => { const r = PH.matchSpoken(raw, q, c); if (r.ok || r.repair !== k) bad.push(`말로 대답하기 ${w}: ‘${raw}’ → ${r.ok ? '통과' : r.repair || '탈락'} (${r.why})`); return r; }, nope = (w, raw, q, c) => { const r = PH.matchSpoken(raw, q, c); if (r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과해요`); return r; }, yep = (w, raw, q, c) => { const r = PH.matchSpoken(raw, q, c); if (!r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과하지 않아요 (${r.why})`); return r; };
    Object.values(PH.Q).filter(q => (q.shape === 'or' || q.shape === 'wh') && !q.fast).forEach(q => { ['yes', 'yes please', 'yeah sure'].forEach(y => nope(`${q.id} ${y}`, y, q, D)); });
    yep('증상 + 부탁', 'I have a sore throat. Could you recommend something for it?', 'cn_what', D); nope('증상만', 'I have a sore throat.', 'cn_what', D); nope('다른 증상', 'I have a cough. Do you have anything for it?', 'cn_what', D); nope('is sick', 'My throat is sick.', 'cn_what', D);
    yep('기간', 'For two days.', 'ak_long', D); nope('during', 'During two days.', 'ak_long', D); nope('다른 기간', 'For a week.', 'ak_long', D);
    yep('열 없음', 'No, I don\'t.', 'ak_fever', D); nope('열 있음', 'Yes, I do.', 'ak_fever', D);
    yep('알레르기 없음', 'No, I\'m not.', 'ak_allergy', D); nope('알레르기 Yes만', 'Yes.', 'ak_allergy', { allergy: 'penicillin' }); yep('알레르기 있음', 'Yes, I\'m allergic to penicillin.', 'ak_allergy', { allergy: 'penicillin' }); nope('다른 알레르기', 'Yes, I\'m allergic to aspirin.', 'ak_allergy', { allergy: 'penicillin' });
    yep('알약', 'Tablets, please.', 'ak_form', D); nope('물약', 'Liquid, please.', 'ak_form', D);
    yep('되짚기', PH.spoken(PH.lineText(PH.LINE)), 'ds_say', D); nope('되짚기 횟수', PH.lineText(PH.LINE_FREQ), 'ds_say', D); nope('되짚기 eat', PH.lineText(PH.LINE_EAT), 'ds_say', D);
    nope('되짚지 않음', 'Okay, thanks.', 'ds_say', D); nope('three times one day', PH.lineText(PH.LINE_X3), 'ds_say', D); nope('빠진 조각', PH.lineText(PH.LINE_MISS), 'ds_say', D);
    rep('빠른 복용법 되묻기', 'Sorry, how many times a day?', 'ds_fast', D, 'again'); nope('빠른 복용법 짐작', PH.lineText(PH.LINE), 'ds_fast', D);
    nope('값 되묻기 thirty', 'Sorry, did you say thirty fifty?', 'ds_cost', D); rep('같은 값 되묻기', 'Sorry, did you say thirteen fifty?', 'ds_cost', D, 'check'); yep('카드로', 'Can I pay by card?', 'ds_cost', D);
    rep('drowsy 묻기', 'Sorry, what does drowsy mean?', 'ds_warn', D, 'what'); yep('운전 안 함', 'Okay, I won\'t drive. Thanks.', 'ds_warn', D);
    yep('예약 없음', 'No, I don\'t. I\'d like to see a doctor, please.', 'fr_appt', D); nope('I want doctor', 'No. I want doctor.', 'fr_appt', D);
    yep('처음', 'Yes, it is.', 'fr_first', D); nope('I am first', 'Yes, I am first.', 'fr_first', D);
    yep('이름', PH.spoken('It\'s Kim, K-I-M.'), 'fr_name', D); nope('다른 이름', 'It\'s Park.', 'fr_name', D);
    yep('철자', 'Sure. K, I, M.', 'fr_spell', D); nope('다른 철자', 'Sure. K, I, N.', 'fr_spell', D); nope('철자 Yes만', 'Yes.', 'fr_spell', D);
    yep('생일', 'It\'s March fourth, two thousand five.', 'fr_dob', D); yep('생일 숫자', 'March 4th, 2005.', 'fr_dob', D); nope('숫자만', '2005, 3, 4.', 'fr_dob', D); nope('다른 생일', 'It\'s April third, two thousand five.', 'fr_dob', D);
    rep('빠른 생일 되묻기', 'Sorry, did you ask for my date of birth?', 'fr_fast', D, 'again'); nope('빠른 말 짐작', 'It\'s Kim.', 'fr_fast', D);
    yep('보험', 'Yes, I do. I have travel insurance.', 'fr_ins', D); nope('보험 없음', 'No, I don\'t.', 'fr_ins', D);
    yep('증상', 'I have a sore throat.', 'dc_prob', D); nope('is sick', 'My throat is sick.', 'dc_prob', D);
    yep('먹은 약', 'Yes, I took some cold medicine.', 'dc_took', D); nope('ate', 'Yes, I ate some cold medicine.', 'dc_took', D); nope('안 먹음', 'No, I haven\'t.', 'dc_took', D);
    rep('빠른 증상 되묻기', 'Sorry, did you ask what\'s wrong?', 'dc_fast', D, 'again');
    yep('아픈 자리', 'It hurts in my throat.', 'ex_where', D); nope('다른 자리', 'It hurts in my ear.', 'ex_where', D);
    yep('누르면 아픔', 'Yes, it does.', 'ex_press', D); nope('안 아픔', 'No, it doesn\'t.', 'ex_press', D);
    yep('몇 점', 'About a six.', 'ex_scale', D); nope('다른 점수', 'About a nine.', 'ex_scale', D); nope('Very pain', 'Very pain.', 'ex_scale', D);
    yep('처방 되짚기', PH.spoken(PH.lineText(PH.LINE_RX)), 'pl_rx', D); nope('처방 횟수', PH.lineText(PH.LINE_RXF), 'pl_rx', D);
    yep('다시 올 날', 'So, I should come back in three days if I\'m not better?', 'pl_back', D); nope('다른 날', 'So, I should come back in a week?', 'pl_back', D); nope('되짚지 않음', 'Okay, thanks.', 'pl_back', D);
    yep('진단서', 'Yes. Could I get a doctor\'s note for my class?', 'pl_q', D); nope('diagnosis', 'Yes. Please write me a diagnosis.', 'pl_q', D); nope('진단서 Yes만', 'Yes.', 'pl_q', D);
    // 따라 말하기: 같은 말은 모두 맞아야 · 숫자 낱말로 말해도 맞아야
    PH.SHADOW.forEach((s, i) => { const r = PH.compareWords(s.en, s.en), r2 = PH.compareWords(s.en, PH.spoken(s.en)); if (r.hit !== r.total || r2.hit !== r2.total) bad.push(`따라 말하기 ${i + 1}: 같은 글이 다 맞지 않아요`); if (!PH.PLACE[s.place]) bad.push(`따라 말하기 ${i + 1}: 곳이 없어요`); });
    if (PH.SHADOW.length !== 28) bad.push(`따라 말하기 문장 수: ${PH.SHADOW.length}`);
    PH.PLACES.forEach(p => { if (PH.SHADOW.filter(s => s.place === p.id).length !== 4) bad.push(`따라 말하기: ${p.ko} 문장이 넷이 아니에요`); });
    bad.forEach(b => console.warn('[약국 · 병원] ' + b));
    return bad;
  };

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  PH.allText = function () {
    const out = [];
    Object.values(PH.Q).forEach(q => out.push(q.en, q.ko, q.short || ''));
    Object.values(PH.FRAME).forEach(F => out.push(F.t || '', F.ko || '', F.why || '', F.note || ''));
    Object.values(PH.SLOT).forEach(S => Object.values(S.vals || {}).forEach(v => out.push(Object.values(v).filter(x => typeof x === 'string').join(' '))));
    Object.values(PH.SHAPE).forEach(a => out.push(a.ko, a.mark, a.ans, a.say, a.offer || '')); Object.values(PH.INTENT).forEach(a => out.push(a.ans || '', a.want || '', a.say || '', a.turn || ''));
    Object.values(PH.AUX).forEach(a => out.push(a.q, a.a));
    PH.PLACES.forEach(p => out.push(p.ko, p.en)); Object.values(PH.SYM).forEach(s => out.push(s.en, s.ko, s.short)); Object.values(PH.PART).forEach(p => out.push(p.t, p.n, p.ko));
    Object.values(PH.MEDS).forEach(m => out.push(m.en, m.ko, m.en.toUpperCase())); Object.values(PH.RX).forEach(r => out.push(r.en, r.ko)); out.push(PH.ALT.en, PH.ALT.ko);
    [PH.AMT, PH.FREQ, PH.WHEN, PH.LEN, PH.BACK].forEach(T => Object.values(T).forEach(x => out.push(x.t, x.ko)));
    Object.values(PH.NAMES).forEach(n => out.push(n.t, n.ko, n.sp)); PH.MONTHS.forEach(m => out.push(m, m.toUpperCase()));
    PH.PRACTICE.forEach(p => out.push(p.lines.join(''))); PH.SHADOW.forEach(s => out.push(s.en, s.ko));
    PH.LINKED.forEach(l => out.push(l.en, l.ko, l.sound.map(s => s[0]).join(''))); PH.PAIRS.forEach(p => out.push(p.join('')));
    Object.values(PH.OCAT).forEach(c => out.push((c && c.ko) || '')); Object.values(PH.OW).forEach(w => out.push(w.t, w.ko || '', w.why || '')); Object.values(PH.ERR_KO || {}).forEach(x => out.push(String(x)));
    DOBS.forEach(v => out.push(PH.dateText(v), PH.dateKo(v)));
    out.push(PH.CITY, PH.PHARMACY, PH.CLINIC, PH.DOCTOR, PH.PHARMACY.toUpperCase(), PH.CLINIC.toUpperCase(), PH.LONG, PH.sayKo(D0), PH.lineKo(PH.LINE), PH.rxSay('sorethroat', 'penicillin'), PH.rxSayKo('sorethroat', 'penicillin'),
      '$0123456789.:·+×–%→',
      'PHARMACY CLINIC RX PRESCRIPTION DIRECTIONS TAKE TABLETS CAPSULES LIQUID ML MORNING NOON EVENING BEDTIME BREAKFAST LUNCH DINNER DAYS DAY PATIENT FORM LAST NAME FIRST NAME DATE OF BIRTH INSURANCE PHONE SIGNATURE NO PAIN WORST PAIN MAY CAUSE DROWSINESS DO NOT DRIVE WAITING ROOM RECEPTION DOCTOR\'S NOTE');
    return out.join('');
  };
})();
