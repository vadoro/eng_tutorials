/* 교환학생 생활 회화 — 규칙 엔진과 대화 자료 (상황별 영어 회화)
 *
 * 교환학생의 하루는 내가 먼저 말을 꺼내는 곳이 많아요 — 호텔 튜토리얼과 가까워요.
 *   부탁은 질문으로 → Could you put me on the waitlist, please? · Would it be possible to get a two-day extension on my essay?
 *   문제는 사실부터 → The heater in my room isn't working. Could you send someone to look at it?
 *   교수님은 이름으로 → Professor Hale (Teacher ×)
 * 상대가 알려 주는 시간 · 번호(면담 시간 · 대기 번호 · 새 마감 · 수리 시간)는 되짚어 확인해요(So, I'm number thirteen?).
 * 짧은 질문은 모양(Yes/No · 고르는 질문 · 정보 질문)이 대답을 정하고, Yes/No 질문은 첫 낱말이 짧은 대답의 짝을 정해요(Have you …? → Yes, I have.).
 *
 * 규칙 엔진은 소리를 듣지 않고, 말마다 적어 둔 ‘뜻(intent) · 모양(shape)’과 ‘대답 틀(frame) + 내 정보(slot)’,
 * 그리고 내 카드(또는 상황)의 사실을 맞춰 봐요. 새 마감은 원래 마감(금요일)에 미룬 날수를 더해 계산해요(CM.dueOf).
 *
 * 3단계 말하기 법 — CM.judge(상대의 말, 대답, 카드)
 *   ① 열쇠 낱말 + 질문의 모양 잡기 — 고르는 질문 · 정보 질문에 Yes · No만 하면 탈락, 고르는 질문이면 상대가 말한 것 가운데 골랐나,
 *                      대답이 그 말(intent)에 맞나. 빠르게 말해 못 알아들은 말(fast)이면 짐작한 대답은 탈락 → 다시 묻기
 *   ② 틀에 내 정보 넣기 — 틀이 자연스러운가(한국어 그대로 · 틀린 문장 · Yes/No 짝이 다른 대답이면 탈락), 과목 · 까닭 · 방 번호가 카드와 맞나,
 *                      사실만 말하고 부탁이 빠졌나, 들은 시간 · 번호를 되짚었나, 부탁 한 줄의 조각이 맞나
 *   ③ 공손하게 끝내기 — 명령 · 조르는 말(blunt)이나 고맙다는 말 없이 끊긴 말(plain)이면 탈락
 * judge → { ok, stage: 0 | 1 | 2 | 3, why, tag }
 *
 * 부탁 한 줄: CM.checkLine(낱말, 카드) — (Professor Hale,) 까닭(사실) → 부탁 틀(Would it be possible to get · Could I get) → 바라는 것(an extension on my essay)
 *            CM.fixLine(낱말, 카드) — 교수의 대답(빠진 조각을 묻거나, 호칭 · 낱말을 고쳐 주거나, 들어주거나)
 * 숫자: CM.roomWords(318 → three-eighteen) · CM.numWord(13 → thirteen) · CM.spoken(화면 글 → 소리)
 *
 * 영상의 ✓·×, 직접 해 보기, 교환학생 시뮬레이터, 듣고 대답 고르기, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 CM.check()가 콘솔에 경고를 내요.
 * 대학 · 교수 · 기숙사 이름, 과목 번호, 면담 시간, 방 번호는 영어 연습을 위해 지어낸 예시예요. 실제 절차는 학교마다 달라요.
 */
(function () {
  'use strict';
  const CM = (window.CM = {});
  const L4 = 'ABCD';

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s).replace(/\s*\([^()]*\)\s*$/, ''); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; if (/[0-9]/.test(s[i])) return '0136781'.includes(s[i]) ? 0xAC01 : 0xAC00; if (/[A-Za-z]/.test(s[i])) return /[lmnr]/i.test(s[i]) ? 0xAC01 : 0xAC00; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const rieul = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 === 8 : false; };
  const wa = s => s + (has(s) ? '과' : '와'), eul = s => s + (has(s) ? '을' : '를'), ig = s => s + (has(s) ? '이' : '가');
  const ro = s => s + (has(s) && !rieul(s) ? '으로' : '로'), ieyo = s => s + (has(s) ? '이에요' : '예요'), eun = s => s + (has(s) ? '은' : '는');
  CM.josa = { wa, eul, ig, ro, ieyo, eun };

  /* =========================================================
     일곱 곳 (학기 첫 주의 차례: 수업 등록 → 교수 → 기숙사). sp: 그곳 상대의 목소리 (voices.js)
     ========================================================= */
  CM.PLACES = [
    { id: 'reg', ko: '수업 등록', en: 'Registration', sp: 'us' },
    { id: 'full', ko: '정원 · 대기 명단', en: 'Full class · Waitlist', sp: 'us' },
    { id: 'class', ko: '수업 뒤 교수에게', en: 'After class', sp: 'ca' },
    { id: 'hours', ko: '교수 면담', en: 'Office hours', sp: 'ca' },
    { id: 'ext', ko: '마감 연장 부탁', en: 'Asking for an extension', sp: 'ca' },
    { id: 'dorm', ko: '기숙사 고장 알리기', en: 'Housing office · Repairs', sp: 'gb' },
    { id: 'ra', ko: '룸메이트 · RA 상담', en: 'Roommate · RA', sp: 'au' },
  ];
  CM.PLACE = {}; CM.PLACES.forEach((p, i) => { p.i = i; CM.PLACE[p.id] = p; });
  CM.ME = 'me';
  CM.CITY = 'Kellport';                       // 지어낸 도시
  CM.UNI = 'Kellport University';             // 지어낸 대학
  CM.PROF = 'Professor Hale';                 // 지어낸 교수 (캐나다 사람)
  CM.HOUSING = 'Housing Office';
  // 내가 먼저 말을 꺼내는 곳 (등록 창구 · 수업 뒤 · 면담 · 기숙사 사무실 · RA)
  CM.ME_FIRST = { reg: 1, class: 1, hours: 1, dorm: 1, ra: 1 };

  /* =========================================================
     질문의 모양 세 가지 (+ 안내). mark: 그림 이름 (scenes.js의 shape_yn · shape_or · shape_wh · shape_note)
     ========================================================= */
  CM.SHAPE = {
    yn: { ko: 'Yes/No 질문', mark: '스위치', ans: 'Yes · No + 짝 맞는 짧은 대답', say: 'Yes/No 질문이에요. 질문의 첫 낱말로 짧은 대답을 만들어요', offer: '권하거나 물어볼 것을 묻는 말이면 Yes · No 대신 바로 답하거나 부탁해도 돼요' },
    or: { ko: '고르는 질문', mark: '갈림길', ans: '고른 것 + please', say: '고르는 질문(A or B?)이에요. 상대가 말한 것 가운데 하나를 골라 말해요' },
    wh: { ko: '정보 질문', mark: '빈 상자', ans: '정보 + please', say: '정보 질문이에요. 묻는 정보를 채워 말해요' },
    note: { ko: '안내', mark: '말풍선', ans: '되짚기 · 짧게 답하기', say: '질문이 아니라 알려 주는 말이에요' },
  };
  CM.shapeOf = q => (typeof q === 'string' ? CM.Q[q] : q).shape;
  // 글만 보고 짐작한 모양 (점검용): 물음표 문장 가운데 마지막 것 → or가 있으면 고르기, 의문사로 시작하면 정보, 아니면 Yes/No
  CM.shapeGuess = function (en) {
    const qs = String(en).match(/[^.!?]*\?/g);
    if (!qs) return 'note';
    let s = qs[qs.length - 1].trim().toLowerCase().replace(/^(and|so|great|okay|sure|perfect|thanks|now|no problem|hi|hey|hello|hiya|morning|right|alright|lovely|yes|g'day|oh)[,!]?\s+/, '');
    if (/\bor\b/.test(s)) return 'or';
    if (/^(how|what|which|where|when|who|why|whatcha)\b/.test(s)) return 'wh';
    return 'yn';
  };
  // Yes/No 질문의 짝 (질문의 첫 낱말 → 짧은 대답)
  CM.AUX = {
    do: { q: 'Do you …?', a: 'Yes, I do. · No, I don\'t.' },
    did: { q: 'Did you …?', a: 'Yes, I did. · No, I didn\'t.' },
    be: { q: 'Are you …?', a: 'Yes, I am. · No, I\'m not.' },
    is: { q: 'Is it …?', a: 'Yes, it is. · No, it isn\'t.' },
    have: { q: 'Have you …?', a: 'Yes, I have. · No, I haven\'t.' },
  };
  CM.AUX_FIRST = { do: 'do', did: 'did', be: 'are', is: 'is', have: 'have' };

  /* =========================================================
     숫자 읽기 — 과목 번호 · 방 번호 · 대기 번호 · 시각 (화면 글 → 소리)
     ========================================================= */
  const NUMW = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };
  CM.NUMW = NUMW;
  const numWord = n => n < 20 || (n < 100 && n % 10 === 0) ? NUMW[n] : n < 100 ? `${NUMW[n - n % 10]}-${NUMW[n % 10]}` : n < 1000 ? `${NUMW[Math.floor(n / 100)]} hundred${n % 100 ? ' ' + numWord(n % 100) : ''}` : String(n);
  CM.numWord = numWord;
  // 방 번호 · 과목 번호: 318 → three-eighteen · 210 → two-ten · 201 → two-oh-one
  CM.roomWords = n => { const h = Math.floor(n / 100), r = n % 100; return `${NUMW[h]}-${r < 10 ? 'oh-' + NUMW[r] : numWord(r)}`; };
  // 소리 내어 읽을 글
  CM.spoken = s => String(s)
    .replace(/\b(English|Room|room) (\d{3})\b/g, (m, w, d) => `${w} ${CM.roomWords(+d)}`)
    .replace(/\b(\d{1,2})\b/g, (m, d) => numWord(+d));
  // 헷갈리는 숫자 짝: 13~19 ↔ 30~90 (thirTEEN ↔ THIRty)
  CM.teenSwap = n => n >= 13 && n <= 19 ? (n - 10) * 10 : n >= 30 && n <= 90 && n % 10 === 0 ? n / 10 + 10 : null;
  // 끝 두 자리의 teen ↔ ty: 318 → 380 · 214 → 240
  CM.tailSwap = n => { const h = n - n % 100, t = CM.teenSwap(n % 100); return t != null ? h + t : null; };
  // 끝 두 자리를 바꾼 번호 (함정): 210 → 201
  CM.digitSwap = n => n - n % 100 + (n % 10) * 10 + Math.floor(n % 100 / 10);

  /* =========================================================
     수업 (지어낸 과목 · 반) — 영문과 2학년 과목
     ========================================================= */
  CM.COURSES = { 210: { t: 'Academic Writing', ko: '학술 글쓰기' }, 245: { t: 'American Short Stories', ko: '미국 단편소설' }, 260: { t: 'Introduction to Poetry', ko: '시 입문' } };
  CM.COURSE_IDS = Object.keys(CM.COURSES).map(Number);
  CM.SECTIONS = { morning: { t: 'morning', ko: '오전 반', time: 'Mon · Wed · Fri 9:00' }, afternoon: { t: 'afternoon', ko: '오후 반', time: 'Tue · Thu 2:00' } };
  CM.otherSec = s => s === 'morning' ? 'afternoon' : 'morning';
  CM.WLS = [13, 14, 15, 16];                  // 대기 번호 (thirteen ↔ thirty)

  /* =========================================================
     교수 면담 시간 (지어낸 시간표) · 어려운 것 · 마감
     ========================================================= */
  CM.OHS = {
    tt: { days: 'Tuesdays and Thursdays', ko: '화요일 · 목요일', short: 'Tue · Thu', from: 2, to: 4, room: 318 },
    mw: { days: 'Mondays and Wednesdays', ko: '월요일 · 수요일', short: 'Mon · Wed', from: 1, to: 3, room: 416 },
    wf: { days: 'Wednesdays and Fridays', ko: '수요일 · 금요일', short: 'Wed · Fri', from: 10, to: 12, room: 215 },
  };
  CM.OH_IDS = Object.keys(CM.OHS);
  // 다른 요일 (함정) — 차례대로 다음 것
  CM.ohDaysTrap = id => CM.OH_IDS[(CM.OH_IDS.indexOf(id) + 1) % CM.OH_IDS.length];
  CM.ohLine = id => { const o = CM.OHS[id]; return `My office hours are ${o.days} from ${o.from} to ${o.to}, in Room ${o.room}.`; };
  CM.TROUBLE = { read: { t: 'with the readings', n: '읽기 과제', ko: '읽기 과제가 어려움', parts: ['vocab', 'ideas'] }, essay: { t: 'with my essay', n: '에세이', ko: '에세이(과제 글)가 어려움', parts: ['topic', 'struct'] } };
  CM.PARTS = { vocab: { t: 'vocabulary', ko: '낱말(어휘)' }, ideas: { t: 'main ideas', ko: '중심 생각' }, topic: { t: 'topic', ko: '주제 정하기' }, struct: { t: 'structure', ko: '글의 짜임' } };
  // 연장을 부탁하는 까닭 (사실)
  CM.WHYS = { sick: { t: 'I was sick this week', ko: '이번 주에 아팠어요' }, exams: { t: 'I had three exams this week', ko: '이번 주에 시험이 세 개 있었어요' }, family: { t: 'I had a family emergency', ko: '집안에 급한 일이 있었어요' } };
  CM.WHY_IDS = Object.keys(CM.WHYS);
  // 원래 마감은 금요일 자정 → 이틀 미루면 일요일, 사흘 미루면 월요일
  CM.DUES = { sat: { t: 'by Saturday at midnight', ko: '토요일 자정까지', day: 'Saturday' }, sun: { t: 'by Sunday at midnight', ko: '일요일 자정까지', day: 'Sunday' }, mon: { t: 'by Monday at midnight', ko: '월요일 자정까지', day: 'Monday' }, tue: { t: 'by Tuesday at midnight', ko: '화요일 자정까지', day: 'Tuesday' } };
  CM.WEEK = ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday'];
  CM.dueOf = days => ({ 1: 'sat', 2: 'sun', 3: 'mon', 4: 'tue' })[days];
  CM.DAYS = { 2: { t: 'two more days', bare: 'two days', ko: '이틀' }, 3: { t: 'three more days', bare: 'three days', ko: '사흘' } };

  /* =========================================================
     기숙사 (지어낸 이름 · 방 번호) · 고장 · 수리 시간 · 룸메이트
     ========================================================= */
  CM.HALLS = { maple: { t: 'Maple Hall', ko: '메이플 홀' }, cedar: { t: 'Cedar Hall', ko: '시더 홀' }, birch: { t: 'Birch Hall', ko: '버치 홀' } };
  CM.HALL_IDS = Object.keys(CM.HALLS);
  CM.ROOMS = [214, 316, 415, 517];            // 214 ↔ 240 (fourteen ↔ forty)
  CM.THINGS = { heater: { t: 'heater', ko: '난방기(히터)' }, shower: { t: 'shower', ko: '샤워기' }, light: { t: 'light', ko: '방 전등' }, wifi: { t: 'Wi-Fi', ko: '와이파이' } };
  CM.THING_IDS = Object.keys(CM.THINGS);
  CM.VISITS = { a: { from: 9, to: 11, ko: '내일 9시에서 11시 사이' }, b: { from: 1, to: 3, ko: '내일 1시에서 3시 사이' }, c: { from: 2, to: 4, ko: '내일 2시에서 4시 사이' }, d: { from: 10, to: 12, ko: '내일 10시에서 12시 사이' } };
  CM.VISIT_IDS = Object.keys(CM.VISITS);
  CM.visitText = id => `tomorrow between ${CM.VISITS[id].from} and ${CM.VISITS[id].to}`;
  CM.ISSUES = {
    music: { t: 'My roommate plays loud music late at night', ko: '룸메이트가 밤늦게 음악을 크게 틀어요' },
    guests: { t: 'My roommate has friends over late at night', ko: '룸메이트가 밤늦게 친구들을 데려와요' },
    alarm: { t: 'My roommate\'s alarm goes off at 5 a.m.', ko: '룸메이트의 알람이 새벽 5시에 울려요' },
  };
  CM.ISSUE_IDS = Object.keys(CM.ISSUES);

  /* =========================================================
     말의 뜻(intent) — 질문의 모양과 기대하는 대답
     yn: Yes/No 질문에 그냥 Yes · No로만 답할 때 → { yes: 카드 → 카드가 바라는 Yes(true) · No(false) · 모름(null), need: 통과하지만 덧붙일 말, strict · noStrict: 탈락 까닭 }
     key: 고르는 질문에서 고른 것을 담는 사실 이름 · best(카드, 말): 모범 틀
     ========================================================= */
  const I = (shape, ans, want, best, o = {}) => Object.assign({ shape, ans, want, best }, o);
  CM.INTENT = {
    need: I('wh', '무엇을 도와줄지 묻는 질문', '용건은 부탁 틀로, 문제는 사실 + 부탁 질문으로 → I\'d like to register for English 210, please. · The heater in my room isn\'t working. Could you send someone to look at it?',
      (c, q) => q && q.place === 'hours' ? 'nd_help' : q && q.place === 'dorm' ? 'nd_fix' : q && q.place === 'ra' ? 'nd_adv' : 'nd_reg', { turn: '용건 말하기' }),
    sec: I('or', '오전 반과 오후 반 가운데 고르라는 질문', '고른 것 + please → The morning section, please.', 'sc_pl', { turn: '반 고르기', key: 'sec' }),
    taken: I('yn', '대학 영어 수업을 들어 봤는지 묻는 질문', 'Have you …? → Yes, I have. I took a similar class in Korea. · 아니면 사실 + 부탁 → No, I haven\'t. Could I still sign up?', c => c.taken === false ? 'tk_ask' : 'tk_yes',
      { turn: '들어 본 수업', yn: { yes: c => c.taken == null ? null : !!c.taken, need: '어디서 들었는지 덧붙이면 좋아요 → Yes, I have. I took a similar class in Korea.', noStrict: '안 들어 봤다고만 하면 대화가 멈춰요. 그래도 들을 수 있는지 질문으로 물어요 → No, I haven\'t. Could I still sign up?' } }),
    full: I('note', '그 반이 다 찼다는 안내', '할 수 있는 방법을 질문으로 → Could you put me on the waitlist, please? · Is there any space in the afternoon section?', c => c.full === 'other' ? 'fl_other' : 'fl_wait',
      { turn: '정원이 참', say: '반이 다 찼다는 안내예요. 알겠다고만 하지 말고 할 수 있는 방법을 질문으로 물어요' }),
    wl: I('note', '대기 번호를 알려 주는 말', '들은 번호를 되짚어 → So, I\'m number 13? (thirTEEN — 뒤를 세게)', 'wl_so', { turn: '대기 번호 되짚기', say: '대기 번호를 알려 주는 말이에요. 숫자는 되짚어 확인해요' }),
    ask: I('yn', '물어볼 것이 있는지 묻는 말', '물어볼 것을 Yes 뒤에 바로, 질문으로 → Yes. Could you tell me when your office hours are?', 'qs_oh',
      { turn: '교수에게 묻기', offer: true, yn: { yes: () => true, strict: '물어볼 것이 있으면 Yes만 하지 말고 바로 물어요 → Yes. Could you tell me when your office hours are?' } }),
    oh: I('note', '면담 시간 · 연구실을 알려 주는 말', '들은 요일과 방 번호를 되짚어 → So, Tuesdays and Thursdays, in Room 318?', 'oh_so', { turn: '면담 시간 되짚기', say: '면담 시간과 연구실을 알려 주는 말이에요. 요일과 방 번호는 되짚어 확인해요' }),
    part: I('or', '무엇이 어려운지 둘 가운데 고르라는 질문', '고른 것 → Mostly the main ideas.', 'pt_pl', { turn: '어려운 곳', key: 'part' }),
    tried: I('yn', '학습 안내서를 써 봤는지 묻는 질문', 'Have you …? → Yes, I have, but it didn\'t help much. · No, I haven\'t. I\'ll take a look at it.', c => c.tried ? 'tr_yes' : 'tr_no',
      { turn: '해 본 것', yn: { yes: c => c.tried == null ? null : !!c.tried } }),
    else: I('yn', '더 할 말이 있는지 묻는 말', '부탁할 것이 있으면 바로, 사실 + 부탁 질문으로 → Professor Hale, I was sick this week. Would it be possible to get a two-day extension on my essay?', 'line',
      { turn: '연장 부탁', offer: true, yn: { yes: c => c.ask == null ? null : !!c.ask, strict: '부탁할 것이 있으면 Yes만 하지 말고 바로 말해요 → 까닭(사실) + Would it be possible to get an extension on my essay?' } }),
    days: I('wh', '며칠 더 필요한지 묻는 질문', 'Just + 날수 → Just two more days, if possible.', 'dy_pl', { turn: '며칠 더' }),
    due: I('note', '새 마감을 알려 주는 말', '들은 마감을 되짚어 → So, by Sunday at midnight?', 'du_so', { turn: '새 마감 되짚기', say: '새 마감을 알려 주는 말이에요. 요일은 되짚어 확인해요' }),
    room: I('wh', '방 번호를 묻는 질문', 'It\'s + 방 번호 + 건물 → It\'s Room 214, in Maple Hall.', 'rm_is', { turn: '방 번호' }),
    enter: I('yn', '없을 때 들어가도 되는지 묻는 질문', '괜찮으면 → Yes, that\'s fine. · 아니면 바라는 것을 → Actually, I\'d rather be there, if that\'s okay.', c => c.enter === false ? 'en_no' : 'en_ok',
      { turn: '들어가도 되나', yn: { yes: c => c.enter == null ? null : !!c.enter, noStrict: '들어가도 되느냐는 물음에 No만 하면 퉁명스럽게 들려요. 바라는 것을 덧붙여요 → Actually, I\'d rather be there, if that\'s okay.' } }),
    visit: I('note', '수리하러 올 시간을 알려 주는 말', '들은 시간을 되짚어 → So, tomorrow between 9 and 11?', 'vs_so', { turn: '수리 시간 되짚기', say: '수리하러 올 시간을 알려 주는 말이에요. 시간은 되짚어 확인해요' }),
    talk: I('yn', '룸메이트와 이야기해 봤는지 묻는 질문', 'Have you …? → No, I haven\'t. I\'m not sure what to say. · Yes, I have, but nothing changed.', c => c.talked ? 'tl_yes' : 'tl_no',
      { turn: '이야기해 봤나', yn: { yes: c => c.talked == null ? null : !!c.talked } }),
    with: I('yn', '함께 있어 주겠다고 권하는 말', '원하면 → Yes, please. That would really help. · 아니면 → No, thanks. I\'ll try talking to them first.', c => c.with ? 'wi_yes' : 'wi_no',
      { turn: 'RA가 함께', offer: true, yn: { yes: c => c.with == null ? null : !!c.with } }),
    repair: I(null, '다시 묻는 말', '', 'rp_again'),
  };
  CM.sayOf = intent => { const it = CM.INTENT[intent]; return it.say || CM.SHAPE[it.shape].say; };
  CM.INTENT_KO = {}; Object.entries(CM.INTENT).forEach(([k, v]) => { CM.INTENT_KO[k] = v.turn || ''; });
  CM.CROSS = {};

  /* =========================================================
     상대의 말. key: 열쇠 낱말(말 안에 꼭 있어야 함) · shape: 질문의 모양 · choices: 고르는 질문에서 고를 것(사실 값)
     fast: 너무 빨라 못 알아들은 말 · short: 지도에 쓰는 짧은 꼴 · fact: 그 말이 알려 준 사실 · allow: 대답 대신 해도 되는 다시 묻기(틀 id)
     aux: Yes/No 질문의 첫 낱말 짝(do · did · be · is · have)
     ========================================================= */
  CM.Q = {};
  const Q = (id, place, intent, en, ko, key, o = {}) => (CM.Q[id] = Object.assign({ id, place, intent, en, ko, key, shape: CM.INTENT[intent].shape, sp: CM.PLACE[place].sp }, o));
  // 수업 등록 (내가 먼저)
  Q('reg_help', 'reg', 'need', 'Hi there. What can I help you with?', '안녕하세요. 무엇을 도와드릴까요?', ['help you with'], { fact: { task: 'reg' }, short: 'What can I help you with?' });
  Q('reg_fast', 'reg', 'need', 'Hey, whatcha need?', '네, 뭐 필요해요?', ['need'], { fact: { task: 'reg' }, fast: true });
  Q('reg_sec', 'reg', 'sec', 'Would you like the morning section or the afternoon section?', '오전 반으로 하시겠어요, 오후 반으로 하시겠어요?', ['morning section or the afternoon section'], { choices: ['morning', 'afternoon'], short: 'Morning or afternoon?' });
  Q('reg_taken', 'reg', 'taken', 'Have you taken a college English class before?', '대학에서 영어 수업을 들어 본 적 있어요?', ['taken'], { aux: 'have', short: 'Have you taken a college English class?' });
  // 정원 · 대기 명단
  Q('fl_full', 'full', 'full', 'Hmm, it looks like the morning section is full.', '음, 오전 반은 다 찬 것 같아요.', ['full'], { fact: { sec: 'morning', alt: 'afternoon' }, short: 'The morning section is full.' });
  Q('fl_wl', 'full', 'wl', 'Okay. You\'re number 13 on the waitlist.', '네. 대기 명단 13번이에요.', ['number 13'], { fact: { wl: 13 }, short: 'You\'re number 13 on the waitlist.' });
  Q('fl_fast', 'full', 'wl', 'Kay, you\'re thirteen on the list.', '자, 명단 13번이에요.', ['thirteen'], { fact: { wl: 13 }, fast: true });
  // 수업 뒤 교수에게 (내가 먼저)
  Q('cl_q', 'class', 'ask', 'Yes? Did you have a question?', '네? 질문 있어요?', ['question'], { short: 'Did you have a question?' });
  Q('cl_oh', 'class', 'oh', 'My office hours are Tuesdays and Thursdays from 2 to 4, in Room 318.', '제 면담 시간은 화요일과 목요일 2시에서 4시, 318호예요.', ['office hours'], { fact: { oh: 'tt' }, short: 'Tuesdays and Thursdays, Room 318.' });
  Q('cl_fast', 'class', 'oh', 'Office hours, Tuesdays, Thursdays, two to four, three-eighteen.', '면담은 화, 목, 2시에서 4시, 318호.', ['office hours'], { fact: { oh: 'tt' }, fast: true });
  // 교수 면담 (내가 먼저)
  Q('oh_help', 'hours', 'need', 'Come on in! What can I do for you?', '들어와요! 무엇을 도와줄까요?', ['What can I do'], { fact: { task: 'help' }, short: 'What can I do for you?' });
  Q('oh_read', 'hours', 'part', 'I see. Is it the vocabulary or the main ideas?', '그렇군요. 낱말이 어려워요, 중심 생각이 어려워요?', ['vocabulary or the main ideas'], { choices: ['vocab', 'ideas'], fact: { trouble: 'read' }, short: 'Vocabulary or main ideas?' });
  Q('oh_essay', 'hours', 'part', 'I see. Is it the topic or the structure?', '그렇군요. 주제가 어려워요, 짜임이 어려워요?', ['topic or the structure'], { choices: ['topic', 'struct'], fact: { trouble: 'essay' }, short: 'Topic or structure?' });
  Q('oh_tried', 'hours', 'tried', 'Have you tried the study guide on the course website?', '과목 웹사이트에 있는 학습 안내서는 써 봤어요?', ['tried'], { aux: 'have', short: 'Have you tried the study guide?' });
  // 마감 연장 부탁 (면담 끝에)
  Q('ex_else', 'ext', 'else', 'Is there anything else?', '또 할 말 있어요?', ['anything else'], { short: 'Anything else?' });
  Q('ex_days', 'ext', 'days', 'How many more days do you need?', '며칠이 더 필요해요?', ['How many more days'], { short: 'How many more days?' });
  Q('ex_due', 'ext', 'due', 'Okay. Please send it to me by Sunday at midnight.', '좋아요. 일요일 자정까지 보내 주세요.', ['by Sunday'], { fact: { due: 'sun' }, short: 'Send it by Sunday at midnight.' });
  Q('ex_fast', 'ext', 'due', 'Kay, just get it to me by Sunday, midnight.', '그래요, 일요일 자정까지만 줘요.', ['Sunday'], { fact: { due: 'sun' }, fast: true });
  // 기숙사 사무실 (내가 먼저)
  Q('dm_help', 'dorm', 'need', 'Hello, Housing Office. How can I help?', '안녕하세요, 기숙사 사무실이에요. 무엇을 도와드릴까요?', ['How can I help'], { fact: { task: 'fix' }, short: 'How can I help?' });
  Q('dm_room', 'dorm', 'room', 'Right. And what\'s your room number?', '네. 방 번호가 어떻게 되세요?', ['room number'], { short: 'What\'s your room number?' });
  Q('dm_fast', 'dorm', 'room', 'What\'s yer room number, love?', '방 번호가 어떻게 돼요?', ['room number'], { fast: true });
  Q('dm_enter', 'dorm', 'enter', 'Is it alright if maintenance goes in while you\'re out?', '안 계실 때 시설 관리 직원이 들어가도 괜찮을까요?', ['while you\'re out'], { aux: 'is', allow: ['rp_wmain'], short: 'Can we go in while you\'re out?' });
  Q('dm_visit', 'dorm', 'visit', 'Someone will come by tomorrow between 9 and 11.', '내일 9시에서 11시 사이에 누가 갈 거예요.', ['between 9 and 11'], { fact: { visit: 'a' }, short: 'Tomorrow between 9 and 11.' });
  // 룸메이트 · RA (내가 먼저)
  Q('ra_help', 'ra', 'need', 'Hey! What\'s up?', '안녕! 무슨 일이야?', ['What\'s up'], { fact: { task: 'advice' }, short: 'What\'s up?' });
  Q('ra_talk', 'ra', 'talk', 'Have you talked to your roommate about it?', '룸메이트랑 그 얘기 해 봤어?', ['talked to your roommate'], { aux: 'have', short: 'Have you talked to your roommate?' });
  Q('ra_fast', 'ra', 'talk', 'Ya talked to \'em about it yet?', '그 얘기 걔한테 해 봤어?', ['talked'], { fast: true });
  Q('ra_with', 'ra', 'with', 'Would you like me to be there when you talk to them?', '얘기할 때 내가 같이 있어 줄까?', ['Would you like me to be there'], { short: 'Would you like me to be there?' });
  // 곳마다 대표 말 (영상 01장 지도 · 직접 해 보기)
  CM.PLACEQ = {
    reg: ['reg_help', 'reg_sec'], full: ['fl_full', 'fl_wl'], class: ['cl_q', 'cl_oh'], hours: ['oh_help', 'oh_read'],
    ext: ['ex_else', 'ex_due'], dorm: ['dm_help', 'dm_visit'], ra: ['ra_help', 'ra_with'],
  };

  /* =========================================================
     칸에 넣는 내 정보 (slot). 틀(frame)이 form으로 어느 꼴을 쓸지 정해요.
     fact: 이 값이 말하는 사실 · bad · why: 콩글리시 값(② 탈락) · note: 통하지만 덧붙일 말 · dyn: 값이 정해져 있지 않은 칸
     ========================================================= */
  const COURSE_VALS = {};
  CM.COURSE_IDS.forEach(n => {
    COURSE_VALS[n] = { t: `English ${n}`, ko: `English ${n}(${CM.COURSES[n].ko})`, fact: { course: n } };
    const tr = CM.digitSwap(n); COURSE_VALS[tr] = { t: `English ${tr}`, ko: `English ${tr}(다른 과목)`, fact: { course: tr } };
  });
  const secVals = key => Object.fromEntries(Object.entries(CM.SECTIONS).map(([k, v]) => [k, { t: v.t, ko: v.ko, fact: { [key]: k } }]));
  CM.SLOT = {
    course: { key: 'course', vals: COURSE_VALS },
    sec: { key: 'sec', vals: secVals('sec') },
    alt: { key: 'alt', vals: secVals('alt') },
    wl: { key: 'wl', dyn: 'wl' },
    oh: { key: 'oh', dyn: 'oh' },
    room: { key: 'room', dyn: 'room' },
    trouble: { key: 'trouble', vals: Object.fromEntries(Object.entries(CM.TROUBLE).map(([k, v]) => [k, { t: v.t, ko: v.n }])) },
    part: { key: 'part', vals: Object.fromEntries(Object.entries(CM.PARTS).map(([k, v]) => [k, { t: v.t, ko: v.ko }])) },
    days: { key: 'days', vals: Object.fromEntries(Object.entries(CM.DAYS).map(([k, v]) => [k, { t: v.t, bare: v.bare, ko: v.ko, fact: { days: +k } }])) },
    due: { key: 'due', vals: Object.fromEntries(Object.entries(CM.DUES).map(([k, v]) => [k, { t: v.t, ko: v.ko }])) },
    visit: { key: 'visit', vals: Object.fromEntries(CM.VISIT_IDS.map(k => [k, { t: CM.visitText(k), ko: CM.VISITS[k].ko }])) },
    thing: { key: 'thing', vals: Object.assign(Object.fromEntries(Object.entries(CM.THINGS).map(([k, v]) => [k, { t: v.t, ko: v.ko }])),
      { boiler: { t: 'boiler', ko: '(어색한 말) 보일러', fact: { thing: 'heater' }, bad: 'literal', why: '방의 난방기를 ‘보일러’로 옮겼어요. 영어로 boiler는 건물 전체의 물을 데우는 큰 기계예요. 방을 데우는 기계는 → heater (The heater in my room isn\'t working.)' } }) },
    issue: { key: 'issue', vals: Object.fromEntries(Object.entries(CM.ISSUES).map(([k, v]) => [k, { t: v.t, ko: v.ko }])) },
  };
  // 면담 시간 칸: tt · tt~r(방 번호 함정) · tt~d(요일 함정)
  const ohParse = v => { const m = /^(tt|mw|wf)(~r|~d)?$/.exec(String(v)); if (!m) return null; const o = CM.OHS[m[1]]; return { id: m[1], trap: m[2] || '', days: m[2] === '~d' ? CM.OHS[CM.ohDaysTrap(m[1])].days : o.days, dko: m[2] === '~d' ? CM.OHS[CM.ohDaysTrap(m[1])].ko : o.ko, room: m[2] === '~r' ? CM.tailSwap(o.room) : o.room, from: o.from, to: o.to }; };
  CM.ohParse = ohParse;
  CM.ohText = v => { const o = ohParse(v); return `${o.days}, in Room ${o.room}`; };
  CM.ohKo = v => { const o = ohParse(v); return `${o.dko} · ${o.room}호`; };
  // 방 칸: '214-maple'
  const roomParse = v => { const m = /^(\d{3})-(maple|cedar|birch)$/.exec(String(v)); return m ? { n: +m[1], hall: m[2] } : null; };
  CM.roomParse = roomParse;
  CM.roomText = v => { const r = roomParse(v); return `Room ${r.n}, in ${CM.HALLS[r.hall].t}`; };
  CM.roomKo = v => { const r = roomParse(v); return `${CM.HALLS[r.hall].ko}(${CM.HALLS[r.hall].t}) ${r.n}호`; };
  // 칸 값 하나 (값이 정해져 있지 않은 칸도)
  CM.sv = function (slot, v) {
    const S = CM.SLOT[slot]; if (!S || v == null) return null;
    if (S.dyn === 'wl') return /^\d+$/.test(String(v)) ? { t: String(v), ko: `${v}번`, fact: { wl: +v } } : null;
    if (S.dyn === 'oh') return ohParse(v) ? { t: CM.ohText(v), ko: CM.ohKo(v), fact: { oh: String(v) } } : null;
    if (S.dyn === 'room') return roomParse(v) ? { t: CM.roomText(v), ko: CM.roomKo(v), fact: { room: String(v) } } : null;
    return S.vals[v] || null;
  };
  const valFact = (slot, v) => { const x = CM.sv(slot, v); if (!x) return {}; return x.fact ? Object.assign({}, x.fact) : { [CM.SLOT[slot].key]: v }; };
  CM.valFact = valFact;
  // 카드와 맞는 칸 값 (콩글리시 · 알림이 붙는 값은 빼고)
  const slotIds = slot => { const S = CM.SLOT[slot]; return S.dyn ? [] : Object.keys(S.vals).filter(id => { const x = S.vals[id]; return !x.bad && !x.note; }); };
  CM.slotIds = slotIds;
  CM.slotVal = function (slot, C, q) {
    const S = CM.SLOT[slot];
    if (S.dyn) { const v = C[S.key]; return v != null ? String(v) : null; }
    const ids = slotIds(slot);
    const fit = id => { const f = valFact(slot, id); return Object.keys(f).length && Object.keys(f).every(k => C[k] === f[k]); };
    return ids.find(fit) || null;
  };

  /* =========================================================
     부탁 한 줄 — 조각: 부르는 말(Professor Hale) · 까닭(사실) · 부탁 틀(Would it be possible to get · Could I get) · 바라는 것(an extension on my essay)
     사실을 짧게 먼저 말하고, 부탁은 질문으로 해요. 부탁 틀 바로 뒤에 바라는 것이 와요. (자주 쓰는 꼴을 단순하게 줄인 규칙)
     까닭을 부탁 뒤에 말해도 통하지만(알림), 까닭이 빠지면 ② · 조르는 말(I want)이면 ③.
     줄 = { words: [조각 id, …] }
     ========================================================= */
  CM.OW = {
    hale: { c: 'call', t: 'Professor Hale', ko: '헤일 교수님' },
    teacher: { c: 'call', t: 'Teacher', ko: '(한국어 그대로) 선생님', bad: 'literal', why: '‘선생님’을 Teacher로 옮겼어요. 영어권 대학에서 Teacher는 부르는 말로 쓰지 않아요. 교수님은 → Professor + 성(Professor Hale).' },
    wibp: { c: 'ask', t: 'would it be possible to get', ko: '미뤄 주실 수 있을까요', q: true },
    cig: { c: 'ask', t: 'could I get', ko: '미뤄 주실 수 있을까요', q: true },
    iwant: { c: 'ask', t: 'I want', ko: '미뤄 주세요(조르는 말)', bad: 'blunt', why: 'I want …는 조르는 말처럼 들려요. 교수에게 하는 부탁은 질문으로 → Would it be possible to get … ? · Could I get … ?' },
    ext: { c: 'want', t: 'an extension on my essay', v: 0, ko: '에세이 마감을' },
    d2: { c: 'want', t: 'a two-day extension on my essay', v: 2, ko: '에세이 마감을 이틀' },
    d3: { c: 'want', t: 'a three-day extension on my essay', v: 3, ko: '에세이 마감을 사흘' },
    rep: { c: 'want', t: 'more time for my report', v: 0, ko: '(어색한 말) 리포트 시간을 더', bad: 'literal', why: '‘리포트’는 한국에서 쓰는 말이에요. 영어로 report는 조사 보고서예요. 수업에 내는 글은 → essay · paper, 마감을 미루는 것은 → an extension (an extension on my essay).' },
  };
  CM.WHY_IDS.forEach(k => { CM.OW[k] = { c: 'why', t: CM.WHYS[k].t, v: k, ko: CM.WHYS[k].ko }; });
  Object.entries(CM.OW).forEach(([id, w]) => { w.id = id; });
  CM.OCAT = { call: { ko: '부르는 말', n: 0 }, why: { ko: '까닭(사실)', n: 1 }, ask: { ko: '부탁 틀', n: 2 }, want: { ko: '바라는 것', n: 3 } };
  // 카드 → 모범 한 줄 (날수까지 말하면 ‘며칠 더’ 질문은 건너뜀)
  CM.lineWords = C => ['hale', (C && C.why) || 'sick', 'wibp', C && C.days ? 'd' + C.days : 'ext'];
  CM.lineFacts = Lw => {
    const W = (Lw.words || Lw).map(w => CM.OW[w]).filter(Boolean), f = { ask: 'ext' };
    const wy = W.find(x => x.c === 'why'), ww = W.find(x => x.c === 'want');
    if (wy) f.why = wy.v;
    if (ww && ww.v) f.days = ww.v;
    return f;
  };
  CM.checkLine = function (Lw, C = {}) {
    const ws = Lw.words || Lw, W = ws.map(w => CM.OW[w]);
    if (!ws.length) return { ok: false, stage: 1, why: '아직 아무것도 고르지 않았어요.' };
    if (W.some(x => !x)) return { ok: false, stage: 2, why: '사전에 없는 조각이 있어요.' };
    const want = CM.lineWords(C), wt = CM.lineText({ words: want });
    const n = c => W.filter(x => x.c === c).length;
    for (const c of Object.keys(CM.OCAT)) if (n(c) > 1) return { ok: false, stage: 2, why: `${eun(CM.OCAT[c].ko)} 한 번만 말해요.`, want, tag: 'order' };
    const ia = W.findIndex(x => x.c === 'ask'), iw = W.findIndex(x => x.c === 'want'), wy = W.find(x => x.c === 'why');
    if (ia < 0 && iw < 0) return { ok: false, stage: 2, why: `부탁이 빠졌어요. 사실만 말하면 교수가 무엇을 해 주길 바라는지 짐작해야 해요 → ${wt}`, want, tag: 'need', missing: ['ask', 'want'] };
    if (ia < 0) return { ok: false, stage: 2, why: '부탁 틀이 빠졌어요. 바라는 것만 툭 말하면 조르는 말처럼 들려요. 질문으로 → Would it be possible to get an extension on my essay?', want, tag: 'need', missing: ['ask'] };
    if (iw < 0) return { ok: false, stage: 2, why: '무엇을 바라는지가 빠졌어요. 부탁 틀 뒤에 바라는 것을 → … an extension on my essay?', want, tag: 'need', missing: ['want'] };
    if (iw !== ia + 1) return { ok: false, stage: 2, why: '부탁 틀 바로 뒤에 바라는 것이 와요 → Would it be possible to get an extension on my essay?', want, tag: 'order' };
    const lit = W.find(x => x.bad === 'literal');
    if (lit) return { ok: false, stage: 2, why: lit.why, want, tag: 'literal', badW: lit };
    if (!wy) return { ok: false, stage: 2, why: `까닭(사실)이 빠졌어요. 마감을 미뤄 달라는 부탁은 왜 그런지 사실을 먼저 짧게 말해요 → ${wt}`, want, tag: 'need', missing: ['why'] };
    if (C.why && wy.v !== C.why) return { ok: false, stage: 2, why: `카드와 달라요(까닭). 카드: ${CM.WHYS[C.why].ko} · 이 대답: ${wy.ko}.`, want, tag: 'fact', err: { type: 'why', word: wy, right: C.why } };
    const ww = W[iw];
    if (ww.v && C.days && ww.v !== C.days) return { ok: false, stage: 2, why: `카드와 달라요(날수). 카드: ${CM.DAYS[C.days].ko} · 이 대답: ${CM.DAYS[ww.v].ko}.`, want, tag: 'fact', err: { type: 'days', word: ww, right: 'd' + C.days } };
    const blunt = W.find(x => x.bad === 'blunt');
    if (blunt) return { ok: false, stage: 3, why: blunt.why, want, tag: 'blunt', badW: blunt };
    const after = W.indexOf(wy) > ia;
    return { ok: true, why: `${W.map(x => CM.OCAT[x.c].ko).join(' → ')}. 사실을 짧게 말하고, 부탁은 질문으로 했어요.` + (after ? ' 까닭을 부탁보다 먼저 말하면 더 부드럽게 들려요.' : ''), want, note: after ? 'after' : '' };
  };
  // 교수의 대답 (틀린 첫 조각만 묻거나 고쳐 줌) · 맞으면 들어줌
  CM.fixLine = function (Lw, C) {
    C = C || {};
    const o = CM.checkLine(Lw, C), ww = (Lw.words || Lw).map(w => CM.OW[w]).find(x => x && x.c === 'want');
    if (o.ok) {
      const why = CM.lineFacts(Lw).why;
      return why === 'exams' ? { en: 'Three exams? That\'s a busy week. Sure, that\'s fine.', ko: '시험이 셋이라니 바쁜 주였네요. 좋아요.' } : why === 'family' ? { en: 'I\'m sorry to hear that. Of course.', ko: '그랬군요. 물론이에요.' } : { en: 'I\'m sorry to hear that. Sure, that\'s fine.', ko: '그랬군요. 좋아요.' };
    }
    if (o.tag === 'literal' && o.badW && o.badW.id === 'teacher') return { en: 'Oh — you can call me Professor Hale. What is it?', ko: '교수님은 Professor + 성으로 불러요.' };
    if (o.tag === 'literal' && o.badW && o.badW.id === 'rep') return { en: 'Your report…? Oh — you mean your essay?', ko: '리포트 → essay · paper' };
    if (o.tag === 'need' && o.missing && o.missing.includes('why') && o.missing.length === 1) return { en: 'Hmm… can I ask why?', ko: '까닭(사실)을 먼저 짧게 말해요.' };
    if (o.tag === 'need') return { en: 'Okay… and what would you like?', ko: '무엇을 바라는지 질문으로 말해요.' };
    if (o.tag === 'fact') return { en: 'Hmm, is that right?', ko: o.err && o.err.type === 'days' ? '카드의 날수를 다시 보세요.' : '카드의 까닭을 다시 보세요.' };
    if (o.tag === 'blunt') return { en: `… Well, okay. ${ww && ww.v ? `${CM.DAYS[ww.v].t[0].toUpperCase() + CM.DAYS[ww.v].t.slice(1)}.` : 'How many days?'}`, ko: '뜻은 통했지만 조르는 말처럼 들려요.' };
    return { en: 'Sorry, could you say that again?', ko: '차례가 뒤섞여 알아듣기 어려워요.' };
  };
  // 조각 → 문장: 까닭은 한 문장, 부탁 틀 + 바라는 것은 한 문장(질문이면 ?). 부르는 말은 다음 문장 앞에(끝이면 앞 문장 뒤에)
  function lineSegs(Lw) {
    const W = (Lw.words || Lw).map(w => CM.OW[w]).filter(Boolean), SS = [];
    let pend = null;
    W.forEach((x, i) => {
      if (x.c === 'call') { if (i < W.length - 1) pend = x; else if (SS.length) SS[SS.length - 1].post = x; else SS.push({ pre: x, body: [] }); return; }
      const last = SS[SS.length - 1];
      if (x.c === 'want' && !pend && last && last.body.length && last.body[last.body.length - 1].c === 'ask') last.body.push(x);
      else { SS.push({ pre: pend, body: [x] }); pend = null; }
    });
    const out = [];
    SS.forEach((s, k) => {
      if (k) out.push({ t: ' ', r: 'frame' });
      const seg = [];
      if (s.pre) { seg.push({ t: s.pre.t, r: s.pre.bad ? 'trap' : 'pol', part: 'call', id: s.pre.id }); if (s.body.length) seg.push({ t: ', ', r: 'frame' }); }
      s.body.forEach((x, j) => { if (j) seg.push({ t: ' ', r: 'frame' }); seg.push({ t: x.t, r: x.bad ? 'trap' : x.c === 'ask' ? 'pol' : 'slot', part: x.c, id: x.id }); });
      if (s.post) { seg.push({ t: ', ', r: 'frame' }); seg.push({ t: s.post.t, r: s.post.bad ? 'trap' : 'pol', part: 'call', id: s.post.id }); }
      seg.push({ t: s.body.some(x => x.q) ? '?' : '.', r: 'frame' });
      const f = seg[0]; if (f && !s.pre) f.t = f.t[0].toUpperCase() + f.t.slice(1);
      out.push(...seg);
    });
    return out;
  }
  CM.lineSegs = lineSegs;
  CM.lineText = Lw => lineSegs(Lw).map(s => s.t).join('');
  // 해석: 같은 차례로 (까닭은 한 문장, 부탁 틀 + 바라는 것은 한 문장)
  CM.lineKo = function (Lw) {
    const W = (Lw.words || Lw).map(w => CM.OW[w]).filter(Boolean), out = [];
    let pend = '', i = 0;
    while (i < W.length) {
      const x = W[i];
      if (x.c === 'call') { if (i < W.length - 1) pend = x.ko + ', '; else if (out.length) out[out.length - 1] = out[out.length - 1].replace(/([.?])$/, `, ${x.ko}$1`); else out.push(x.ko + '.'); i++; continue; }
      if (x.c === 'ask' && W[i + 1] && W[i + 1].c === 'want') { out.push(pend + `${W[i + 1].ko} ${x.ko}${x.q ? '?' : '.'}`); i += 2; }
      else { out.push(pend + x.ko + (x.c === 'why' ? '.' : x.q ? '?' : '.')); i++; }
      pend = '';
    }
    return out.join(' ');
  };
  /* =========================================================
     대답 틀 (frame). t: 틀 글 — ___ = 내 정보 칸, {…} = 공손한 말
     tag: ok · literal(한국어 그대로 · 콩글리시) · wrong(틀린 문장) · blunt(명령 · 조르기) · plain(고맙다는 말 없이 끊김)
     bare: Yes · No만 하는 대답(yes: true · false) · aux: 짧은 대답의 짝(do · did · be · is · have)
     half: 사실만 말하고 부탁 · 정보가 빠진 말 · check: 들은 값을 되짚어 확인하는 말 · skip: 되짚지 않고 넘어가는 말
     ========================================================= */
  CM.FRAME = {};
  const FR = (id, intent, t, ko, o = {}) => (CM.FRAME[id] = Object.assign({ id, intent, t, ko, tag: 'ok' }, o));
  // Yes · No만 하는 대답 (고르는 질문 · 정보 질문 · 안내에는 ① 탈락)
  FR('g_yes', 'yn', 'Yes.', '네.', { bare: true, yes: true });
  FR('g_yesp', 'yn', 'Yes, {please}.', '네, 그렇게 해 주세요.', { bare: true, yes: true });
  FR('g_no', 'yn', 'No, {thanks}.', '아니요, 괜찮아요.', { bare: true, yes: false });
  // 수업 등록 (내가 먼저): 부탁 틀 + 과목
  FR('nd_reg', 'need', 'I\'d like to register for ___, {please}.', '___을 수강 신청하고 싶어요.', { slot: 'course', fact: { task: 'reg' } });
  FR('nd_apply', 'need', 'I want to apply ___.', '(어색한 말) ___을 신청하고 싶어요.', { slot: 'course', fact: { task: 'reg' }, tag: 'literal', why: '‘수강 신청’의 ‘신청’을 apply로 옮겼어요. apply는 입학 · 일자리에 지원할 때 써요(apply for a job). 수업은 → register for (I\'d like to register for English 210, please.)' });
  FR('nd_regme', 'need', 'Register me for ___.', '(명령) ___에 등록해 줘요.', { slot: 'course', fact: { task: 'reg' }, tag: 'blunt', why: '명령처럼 들려요. 용건은 부탁 틀로 → I\'d like to register for English 210, please.' });
  FR('nd_rhalf', 'need', 'I\'m an exchange student.', '저는 교환학생이에요.', { fact: { task: 'reg' }, half: true, why: '나에 대한 사실만 말하고 끝났어요. 무엇을 하러 왔는지(용건)를 부탁 틀로 덧붙여요 → I\'m an exchange student. I\'d like to register for English 210, please.' });
  // 반 고르기 · 들어 본 수업
  FR('sc_pl', 'sec', 'The ___ section, {please}.', '___으로 할게요.', { slot: 'sec' });
  FR('tk_yes', 'taken', 'Yes, I have. I took a similar class in Korea.', '네, 들어 봤어요. 한국에서 비슷한 수업을 들었어요.', { aux: 'have', fact: { taken: true } });
  FR('tk_ask', 'taken', 'No, I haven\'t. {Could I} still sign up?', '아니요, 안 들어 봤어요. 그래도 신청할 수 있을까요?', { aux: 'have', fact: { taken: false } });
  FR('tk_no', 'taken', 'No, I haven\'t.', '아니요, 안 들어 봤어요.', { aux: 'have', fact: { taken: false }, half: true, why: '안 들어 봤다고만 하면 대화가 멈춰요. 그래도 들을 수 있는지 질문으로 물어요 → No, I haven\'t. Could I still sign up?' });
  FR('tk_did', 'taken', 'Yes, I did.', '네, 그랬어요.', { aux: 'did', fact: { taken: true } });
  // 정원이 참 · 대기 번호
  FR('fl_wait', 'full', '{Could you} put me on the waitlist, {please}?', '대기 명단에 올려 주시겠어요?', { fact: { full: 'wait' } });
  FR('fl_other', 'full', 'Oh, I see. {Could I} join the ___ section instead?', '아, 그렇군요. 대신 ___에 들어갈 수 있을까요?', { slot: 'alt', fact: { full: 'other' } });
  FR('fl_ok', 'full', 'Oh, okay.', '아, 알겠어요.', { skip: true, why: '알겠다고만 하면 수업을 들을 방법이 없어요. 할 수 있는 방법을 질문으로 물어요 → Could you put me on the waitlist, please?' });
  FR('fl_res', 'full', 'Can I make a reservation for the class?', '(어색한 말) 수업을 예약할 수 있어요?', { fact: { full: 'wait' }, tag: 'literal', why: '‘대기 예약’을 reservation으로 옮겼어요. reservation은 식당 · 호텔의 예약이에요. 자리가 나기를 기다리는 명단은 → the waitlist (Could you put me on the waitlist, please?)' });
  FR('fl_just', 'full', 'Just put me in the class.', '(조르는 말) 그냥 넣어 줘요.', { tag: 'blunt', why: '다 찬 반에 그냥 넣어 달라고 조르는 말이에요. 직원이 정할 수 없는 일이에요. 할 수 있는 방법을 질문으로 → Could you put me on the waitlist, please?' });
  FR('wl_so', 'wl', 'So, I\'m number ___?', '그러니까 제가 ___이죠?', { slot: 'wl', check: true });
  FR('wl_ok', 'wl', 'Okay. {Thanks}.', '알겠어요. 고마워요.', { skip: true, why: '고맙다고만 하면 대기 번호를 제대로 들었는지 확인하지 못해요. thirTEEN과 THIRty는 헷갈리기 쉬워요. 숫자는 되짚어요 → So, I\'m number 13?' });
  // 수업 뒤 교수에게 · 면담 시간 되짚기
  FR('qs_oh', 'ask', 'Yes. {Could you} tell me when your office hours are?', '네. 면담 시간이 언제인지 알려 주시겠어요?', {});
  FR('qs_lit', 'ask', 'Teacher, when is your office time?', '(어색한 말) 선생님, 사무실 시간이 언제예요?', { tag: 'literal', why: '‘선생님’을 Teacher로, ‘면담 시간’을 office time으로 옮겼어요. 교수님은 → Professor Hale, 학생을 만나는 시간은 → office hours (Could you tell me when your office hours are?)' });
  FR('qs_tell', 'ask', 'Tell me your office hours.', '(명령) 면담 시간 알려 줘요.', { tag: 'blunt', why: '명령처럼 들려요. 교수에게 묻는 말은 질문 틀로 → Could you tell me when your office hours are?' });
  FR('oh_so', 'oh', 'So, ___?', '그러니까 ___이죠?', { slot: 'oh', check: true });
  FR('oh_ok', 'oh', 'Okay. {Thanks}.', '알겠어요. 고마워요.', { skip: true, why: '고맙다고만 하면 요일 · 방 번호를 제대로 들었는지 확인하지 못해요. 찾아가야 할 시간과 곳이니 되짚어요 → So, Tuesdays and Thursdays, in Room 318?' });
  // 교수 면담 (내가 먼저): 사실(어려운 것) + 부탁(질문)
  FR('nd_help', 'need', 'I\'m having trouble ___. {Could you} give me some advice?', '___이 어려워요. 조언을 좀 해 주시겠어요?', { slot: 'trouble', fact: { task: 'help' } });
  FR('nd_hhalf', 'need', 'I\'m having trouble ___.', '___이 어려워요.', { slot: 'trouble', fact: { task: 'help' }, half: true, why: '어려운 것(사실)만 말했어요. 무엇을 바라는지 부탁을 질문으로 덧붙여요 → Could you give me some advice?' });
  FR('nd_hhelp', 'need', 'Help me ___.', '(명령) ___ 좀 도와줘요.', { slot: 'trouble', fact: { task: 'help' }, tag: 'blunt', why: '명령처럼 들려요. 어려운 것을 사실로 말하고, 부탁은 질문으로 → I\'m having trouble with the readings. Could you give me some advice?' });
  FR('nd_tlit', 'need', 'Teacher, I don\'t understand the class.', '(어색한 말) 선생님, 수업을 이해 못 하겠어요.', { fact: { task: 'help' }, tag: 'literal', why: '‘선생님’을 Teacher로 옮겼고, 무엇이 어려운지도 빠졌어요. 교수님은 → Professor Hale. 어려운 것을 콕 집어 → I\'m having trouble with the readings. Could you give me some advice?' });
  FR('pt_pl', 'part', 'Mostly the ___.', '주로 ___이요.', { slot: 'part' });
  FR('tr_yes', 'tried', 'Yes, I have, but it didn\'t help much.', '네, 써 봤는데 별로 도움이 안 됐어요.', { aux: 'have', fact: { tried: true } });
  FR('tr_no', 'tried', 'No, I haven\'t. I\'ll take a look at it.', '아니요, 안 써 봤어요. 한번 볼게요.', { aux: 'have', fact: { tried: false } });
  FR('tr_do', 'tried', 'Yes, I do.', '네, 그래요.', { aux: 'do', fact: { tried: true } });
  // 마감 연장 부탁 (면담 끝에): 부탁 한 줄 · 며칠 더 · 새 마감 되짚기
  FR('line', 'else', '', '', { line: true });   // 부탁 한 줄 (CM.checkLine)
  FR('el_no', 'else', 'No, that\'s all. {Thank you}!', '아니요, 그게 다예요. 고맙습니다!', { fact: { ask: null } });
  FR('dy_pl', 'days', 'Just ___, {if possible}.', '되도록 ___만 더요.', { slot: 'days' });
  FR('dy_dur', 'days', 'During ___.', '(어색한 말) ___ 동안이요.', { slot: 'days', form: 'bare', tag: 'literal', why: '‘이틀 동안’의 ‘동안’을 during으로 옮겼어요. during 뒤에는 그때의 이름(the break · the semester)이 와요. 더 필요한 날수는 → Just two more days, if possible.' });
  FR('du_so', 'due', 'So, ___?', '그러니까 ___이죠?', { slot: 'due', check: true });
  FR('du_ok', 'due', 'Okay. {Thanks}.', '알겠어요. 고맙습니다.', { skip: true, why: '고맙다고만 하면 새 마감을 제대로 들었는지 확인하지 못해요. 요일은 되짚어요 → So, by Sunday at midnight?' });
  // 기숙사 사무실 (내가 먼저): 사실(고장) + 부탁(질문)
  FR('nd_fix', 'need', 'The ___ in my room isn\'t working. {Could you} send someone to look at it?', '방의 ___이 고장 났어요. 봐 줄 사람을 보내 주시겠어요?', { slot: 'thing', fact: { task: 'fix' } });
  FR('nd_fhalf', 'need', 'The ___ in my room isn\'t working.', '방의 ___이 고장 났어요.', { slot: 'thing', fact: { task: 'fix' }, half: true, why: '사실(고장)만 말했어요. 무엇을 바라는지 부탁을 질문으로 덧붙여요 → Could you send someone to look at it?' });
  FR('nd_fixit', 'need', 'Fix my ___.', '(명령) 내 ___ 고쳐 줘요.', { slot: 'thing', fact: { task: 'fix' }, tag: 'blunt', why: '명령처럼 들려요. 문제는 사실로, 부탁은 질문으로 → The heater in my room isn\'t working. Could you send someone to look at it?' });
  FR('rm_is', 'room', 'It\'s ___.', '___이에요.', { slot: 'room' });
  FR('rm_dorm', 'room', 'I live in a dormitory.', '기숙사에 살아요.', { half: true, why: '사는 곳의 종류만 말했어요. 방 번호와 건물 이름을 → It\'s Room 214, in Maple Hall.' });
  FR('en_ok', 'enter', 'Yes, that\'s fine.', '네, 괜찮아요.', { fact: { enter: true } });
  FR('en_is', 'enter', 'Yes, it is.', '네, 괜찮아요.', { aux: 'is', fact: { enter: true } });
  FR('en_no', 'enter', 'Actually, I\'d rather be there, {if that\'s okay}.', '사실 제가 있을 때 왔으면 해요. 괜찮다면요.', { fact: { enter: false } });
  FR('en_do', 'enter', 'Yes, I do.', '네, 그래요.', { aux: 'do', fact: { enter: true } });
  FR('vs_so', 'visit', 'So, ___?', '그러니까 ___이죠?', { slot: 'visit', check: true });
  FR('vs_ok', 'visit', 'Okay. {Thanks}.', '알겠어요. 고마워요.', { skip: true, why: '고맙다고만 하면 수리하러 올 시간을 제대로 들었는지 확인하지 못해요. 시간은 되짚어요 → So, tomorrow between 9 and 11?' });
  // RA 상담 (내가 먼저): 사실(문제) + 부탁(질문)
  FR('nd_adv', 'need', '___, so I can\'t sleep. {Could I} get some advice?', '___. 그래서 잠을 못 자요. 조언을 좀 얻을 수 있을까요?', { slot: 'issue', fact: { task: 'advice' } });
  FR('nd_ahalf', 'need', '___.', '___.', { slot: 'issue', fact: { task: 'advice' }, half: true, why: '사실(문제)만 말했어요. 그래서 어떤지와 바라는 것을 덧붙여요 → …, so I can\'t sleep. Could I get some advice?' });
  FR('nd_noisy', 'need', 'Here is too noisy.', '(어색한 말) 여기가 너무 시끄러워요.', { fact: { task: 'advice' }, tag: 'literal', why: '‘여기가’를 Here is로 옮겼어요. here는 주어 자리에 오지 않아요 → It\'s too noisy in my room. 무엇 때문인지(사실) + 부탁 → My roommate plays loud music late at night, so I can\'t sleep. Could I get some advice?' });
  FR('nd_change', 'need', 'Change my room.', '(명령) 방 바꿔 줘요.', { fact: { task: 'advice' }, tag: 'blunt', why: '명령처럼 들려요. 문제를 사실로 말하고, 부탁은 질문으로 → My roommate plays loud music late at night, so I can\'t sleep. Could I get some advice?' });
  FR('tl_yes', 'talk', 'Yes, I have, but nothing changed.', '네, 해 봤는데 달라진 게 없어요.', { aux: 'have', fact: { talked: true } });
  FR('tl_no', 'talk', 'No, I haven\'t. I\'m not sure what to say.', '아니요, 안 해 봤어요. 뭐라고 해야 할지 모르겠어요.', { aux: 'have', fact: { talked: false } });
  FR('tl_do', 'talk', 'No, I don\'t.', '아니요, 그렇지 않아요.', { aux: 'do', fact: { talked: false } });
  FR('wi_yes', 'with', 'Yes, {please}. That would really help.', '네, 그래 주세요. 정말 도움이 될 거예요.', { fact: { with: true } });
  FR('wi_no', 'with', 'No, {thanks}. I\'ll try talking to them first.', '아니, 괜찮아요. 먼저 제가 얘기해 볼게요.', { fact: { with: false } });
  FR('wi_want', 'with', 'Yes. You come with me.', '(명령) 응. 너 나랑 같이 가.', { fact: { with: true }, tag: 'blunt', why: '명령처럼 들려요. 도와주겠다는 말을 받을 때는 → Yes, please. That would really help.' });
  // 다시 묻기. echo: 들린 만큼 되묻는 말 — 실제로 들은 말이어야 통과 · what: 모르는 낱말 묻기(allow)
  FR('rp_again', 'repair', '{Sorry? Could you} say that again, {please}?', '죄송한데, 다시 한 번 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_sorry', 'repair', '{Sorry}?', '네? (다시 말해 달라는 뜻)', { kind: 'again' });
  FR('rp_slow', 'repair', '{Could you} say that more slowly, {please}?', '조금 더 천천히 말씀해 주시겠어요?', { kind: 'slow' });
  FR('rp_need', 'repair', '{Sorry}, did you ask what I need?', '죄송한데, 무엇이 필요한지 물으셨어요?', { kind: 'echo', echo: 'need' });
  FR('rp_wl', 'repair', '{Sorry}, what number am I on the waitlist?', '죄송한데, 제가 대기 명단 몇 번이에요?', { kind: 'echo', echo: 'wl' });
  FR('rp_oh', 'repair', '{Sorry}, when are your office hours?', '죄송한데, 면담 시간이 언제예요?', { kind: 'echo', echo: 'oh' });
  FR('rp_due', 'repair', '{Sorry}, when is the new deadline?', '죄송한데, 새 마감이 언제예요?', { kind: 'echo', echo: 'due' });
  FR('rp_room', 'repair', '{Sorry}, did you ask for my room number?', '죄송한데, 방 번호를 물으셨어요?', { kind: 'echo', echo: 'room' });
  FR('rp_talk', 'repair', '{Sorry}, did you ask if I talked to my roommate?', '죄송한데, 룸메이트랑 얘기해 봤냐고 물었어?', { kind: 'echo', echo: 'talk' });
  FR('rp_wmain', 'repair', '{Sorry}, what does maintenance mean?', '죄송한데, maintenance가 무슨 뜻이에요?', { kind: 'what' });
  FR('rp_rude', 'repair', 'What?', '(퉁명스러운 말) 뭐라고요?', { kind: 'again', tag: 'blunt', why: 'What? 한 낱말은 퉁명스럽게 들릴 수 있어요. 못 알아들었으면 → Sorry? Could you say that again, please?' });

  /* ---------- 대답 글 만들기: 조각(segs) = [{ t, r: 'frame' | 'slot' | 'pol' }] ---------- */
  const slotText = (F, v) => { const x = CM.sv(F.slot, v); if (!x) return '___'; return x[F.form || 't'] != null ? x[F.form || 't'] : x.t; };
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
  CM.segs = function (a) {
    const F = CM.FRAME[a.f];
    if (F.line) return lineSegs(a.line);
    return frameSegs(F, a.v);
  };
  CM.text = a => CM.segs(a).map(s => s.t).join('');
  // 해석
  const koOf = (F, v) => {
    if (!F.slot) return F.ko;
    const x = CM.sv(F.slot, v), k = x ? x.ko : '___';
    return F.ko.replace('___으로', ro(k)).replace('___이에요', ieyo(k)).replace('___이요', /요$/.test(k) ? k : k + (has(k) ? '이요' : '요')).replace('___이죠', k + (has(k) ? '이죠' : '죠')).replace('___을', eul(k)).replace('___이 ', ig(k) + ' ').replace('___', k);
  };
  CM.ko = function (a) {
    const F = CM.FRAME[a.f];
    if (F.line) return CM.lineKo(a.line);
    return koOf(F, a.v);
  };
  // 대답이 말하는 사실
  CM.factOf = function (a) {
    const F = CM.FRAME[a.f];
    if (F.line) return CM.lineFacts(a.line);
    const f = Object.assign({}, F.fact || {});
    if (F.slot && CM.sv(F.slot, a.v)) Object.assign(f, valFact(F.slot, a.v));
    return f;
  };
  // 사실을 한국어로
  const TASK = { reg: '수업 등록', help: '공부 조언 구하기', fix: '고장 수리 부탁', advice: '룸메이트 문제 상담' };
  const FULL = { wait: '대기 명단에 이름 올리기', other: '다른 반에 들어가기' };
  CM.factKo = function (k, v) {
    if (k === 'task') return TASK[v] || String(v);
    if (k === 'course') return `English ${v}` + (CM.COURSES[v] ? `(${CM.COURSES[v].ko})` : '(다른 과목)');
    if (k === 'sec' || k === 'alt') return CM.SECTIONS[v] ? CM.SECTIONS[v].ko : String(v);
    if (k === 'taken') return v ? '대학 영어 수업을 들어 봄' : '대학 영어 수업을 안 들어 봄';
    if (k === 'full') return FULL[v] || String(v);
    if (k === 'wl') return `대기 ${v}번 (${CM.numWord(+v)})`;
    if (k === 'oh') return CM.ohParse(v) ? CM.ohKo(v) : String(v);
    if (k === 'trouble') return CM.TROUBLE[v] ? CM.TROUBLE[v].ko : String(v);
    if (k === 'part') return CM.PARTS[v] ? CM.PARTS[v].ko : String(v);
    if (k === 'tried') return v ? '학습 안내서를 써 봄' : '학습 안내서를 안 써 봄';
    if (k === 'ask') return v ? '마감 연장 부탁' : '부탁할 것 없음';
    if (k === 'why') return CM.WHYS[v] ? CM.WHYS[v].ko : String(v);
    if (k === 'days') return CM.DAYS[v] ? `${CM.DAYS[v].ko} 더` : `${v}일 더`;
    if (k === 'due') return CM.DUES[v] ? CM.DUES[v].ko : String(v);
    if (k === 'thing') return CM.THINGS[v] ? CM.THINGS[v].ko : String(v);
    if (k === 'room') return CM.roomParse(v) ? CM.roomKo(v) : String(v);
    if (k === 'enter') return v ? '없을 때 들어와도 됨' : '내가 있을 때 오면 좋음';
    if (k === 'visit') return CM.VISITS[v] ? CM.VISITS[v].ko : String(v);
    if (k === 'issue') return CM.ISSUES[v] ? CM.ISSUES[v].ko : String(v);
    if (k === 'talked') return v ? '룸메이트와 얘기해 봄' : '룸메이트와 아직 얘기 안 함';
    if (k === 'with') return v ? 'RA가 함께 있어 주면 좋음' : '먼저 혼자 얘기해 봄';
    const S = Object.values(CM.SLOT).find(s => s.key === k && s.vals && s.vals[v]);
    return S ? S.vals[v].ko : String(v);
  };

  /* ---------- 이미 답한 질문 (시뮬레이터의 상대가 건너뜀) — 부탁 한 줄에 날수까지 말하면 ‘며칠 더’ 질문은 건너뜀 ---------- */
  CM.coveredBy = (facts, intent) => (intent ? [intent] : []).concat(intent === 'else' && facts.days != null ? ['days'] : []);
  CM.covered = (a, q) => { if (typeof q === 'string') q = CM.Q[q]; return CM.coveredBy(CM.factOf(a), q.intent); };
  CM.coveredKo = cov => cov.filter(x => x === 'days').map(() => '며칠 더');

  /* =========================================================
     판정 — CM.judge(상대의 말, 대답, 카드, 출처)
     q: CM.Q의 말(또는 id) · a: { f: 틀 id, v: 칸 값, line } · card: 사실 · src: '카드' | '상황'
     ========================================================= */
  const res = (ok, stage, why, tag) => ({ ok, stage, why, tag: tag || (ok ? 'ok' : '') });
  const shapeHead = q => `${q.key.join(' … ')} → ${CM.SHAPE[q.shape].ko}`;
  // 되짚은 값이 다를 때 덧붙이는 말
  const checkHint = (k, v, w) => {
    if (k === 'wl') return ' -teen과 -ty는 헷갈리기 쉬워요. 뒤가 세면 thirTEEN, 앞이 세면 THIRty.';
    if (k === 'oh') { const a = CM.ohParse(v), b = CM.ohParse(w); if (a && b && a.room !== b.room) return ' 방 번호의 -teen과 -ty는 헷갈리기 쉬워요(three-eighTEEN ↔ three-EIGHTy).'; return ' 요일은 묶음으로 들어요(Tuesdays and Thursdays = 화 · 목).'; }
    if (k === 'due') return ' 요일은 되짚어 확인해요.';
    if (k === 'visit') return ' 시각 둘(언제부터 · 언제까지)을 함께 되짚어요.';
    return '';
  };
  CM.judge = function (q, a, card, src = '카드') {
    if (typeof q === 'string') q = CM.Q[q];
    const F = CM.FRAME[a.f], C = Object.assign({}, card || {}, q.fact || {});
    const fi = [].concat(F.intent), key = q.key.join(' … '), In = CM.INTENT[q.intent], SHp = CM.SHAPE[q.shape];
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
      if (q.shape === 'note') return res(false, 1, `열쇠 낱말 ${key} → ${CM.sayOf(q.intent)}. 묻는 말이 아니라서 ${F.yes ? 'Yes' : 'No'}로 답할 일이 아니에요 → ${In.want}`, 'shape');
    } else if (!fi.includes(q.intent)) {
      if (F.intent === 'repair' && q.allow && q.allow.includes(F.id)) allowed = true;
      else if (F.intent === 'repair') return res(false, 1, '대답이 아니라 다시 묻는 말이에요. 알아들었다면 바로 답해요.', 'intent');
      else {
        const other = CM.INTENT[fi[0]];
        return res(false, 1, `${shapeHead(q)}${q.shape === 'note' ? '' : `(${SHp.ans})`}. 이 대답은 ${other.ans}에 맞는 말이에요.`, 'intent');
      }
    }
    // 고르는 질문: 상대가 말한 것 가운데 골랐나
    const fact = CM.factOf(a);
    if (q.shape === 'or' && q.choices && !F.bare && F.intent !== 'repair' && In.key) {
      const v = fact[In.key];
      if (v != null && !q.choices.includes(v)) return res(false, 1, `${shapeHead(q)}. 상대가 말한 것(${q.choices.map(c => CM.factKo(In.key, c)).join(' · ')}) 가운데 하나를 골라요. ${eun(CM.factKo(In.key, v))} 묻지 않았어요.`, 'choice');
    }
    if (F.line) { const o = CM.checkLine(a.line, C); if (!o.ok && o.stage === 1) return res(false, 1, o.why, 'intent'); }
    // ② 틀에 내 정보 넣기
    if (F.tag === 'literal' || F.tag === 'wrong') return res(false, 2, F.why, F.tag);
    if (F.aux && q.aux && F.aux !== q.aux) return res(false, 2, `${CM.AUX[q.aux].q} 질문에는 첫 낱말의 짝으로 답해요 → ${CM.AUX[q.aux].a} 이 대답(${CM.text(a)})은 ${CM.AUX[F.aux].q} 질문의 짝이에요.`, 'wrong');
    const sv = F.slot ? CM.sv(F.slot, a.v) : null;
    if (F.slot && !sv) return res(false, 2, '칸이 비었어요.', 'fact');
    if (sv && sv.bad) return res(false, 2, sv.why, sv.bad);
    if (F.bare) {
      const Y = In.yn, want = Y && Y.yes ? Y.yes(C) : null;
      if (want != null && want !== F.yes) return res(false, 2, `${wa(src)} 달라요. ${src}: ${F.yes ? 'No' : 'Yes'} 쪽이에요(${In.turn}). 이 대답: ${F.yes ? 'Yes' : 'No'}.`, 'fact');
      if (F.yes && Y && Y.strict) return res(false, 2, Y.strict, 'need');
      if (!F.yes && Y && Y.noStrict) return res(false, 2, Y.noStrict, 'need');
      if (Y && Y.need && F.yes === !!(Y.yes && Y.yes(C))) notes.push(Y.need);
      if (q.aux) notes.push(`짝 맞는 짧은 대답도 좋아요 → ${CM.AUX[q.aux].a}`);
    }
    if (F.line) { const o = CM.checkLine(a.line, C); if (!o.ok && o.stage !== 3) return res(false, 2, o.why, o.tag || 'order'); }
    if (F.check) {
      for (const k of Object.keys(fact)) if (C[k] != null && fact[k] !== C[k]) return res(false, 2, `들은 값과 달라요. 상대: ${CM.factKo(k, C[k])} · 이 대답: ${CM.factKo(k, fact[k])}.` + checkHint(k, C[k], fact[k]), 'fact');
    } else {
      for (const k of Object.keys(fact)) {
        if (C[k] === undefined || C[k] === fact[k]) continue;
        if (k === 'alt' && fact.alt === C.sec) return res(false, 2, `${CM.factKo('sec', C.sec)}은 다 찼다고 했어요. 다른 반을 물을 때는 → Could I join the ${CM.SECTIONS[C.alt].t} section instead?`, 'fact');
        if (k === 'course') return res(false, 2, `${wa(src)} 달라요. ${src}: ${CM.factKo(k, C[k])} · 이 대답: ${CM.factKo(k, fact[k])}. 과목 번호는 두 묶음으로 읽어요 → ${C[k]} = ${CM.roomWords(C[k])}.`, 'fact');
        if (k === 'room') { const r = CM.roomParse(C[k]), w = CM.roomParse(fact[k]); return res(false, 2, `${wa(src)} 달라요. ${src}: ${CM.factKo(k, C[k])} · 이 대답: ${CM.factKo(k, fact[k])}.` + (r && w && r.n !== w.n ? ` 방 번호는 두 묶음으로 → ${r.n} = ${CM.roomWords(r.n)}.` : ' 건물 이름까지 말해요.'), 'fact');
        }
        return res(false, 2, `${wa(src)} 달라요. ${src}: ${CM.factKo(k, C[k])} · 이 대답: ${CM.factKo(k, fact[k])}.`, 'fact');
      }
    }
    if (F.skip || F.half) return res(false, 2, F.why, 'need');
    // ③ 공손하게 끝내기
    if (F.tag === 'blunt' || F.tag === 'plain') return res(false, 3, F.why, F.tag);
    if (F.line) { const o = CM.checkLine(a.line, C); if (!o.ok) return res(false, 3, o.why, o.tag || 'blunt'); }
    // 통과
    const segs = CM.segs(a), pol = segs.filter(s => s.r === 'pol').map(s => s.t).filter((x, i, arr) => arr.indexOf(x) === i);
    let why;
    if (q.fast) why = F.kind === 'echo' ? '들린 만큼 되물어 확인했어요. 무엇에 대해 말했는지 알면 그 부분만 다시 물을 수 있어요.' : F.kind === 'slow' ? '천천히 말해 달라고 공손하게 부탁했어요.' : '못 알아들었을 때는 짐작하지 말고 공손하게 다시 물어요.';
    else if (allowed) why = '모르는 낱말은 짐작하지 말고 물어요. 상대가 쉬운 말로 다시 알려 줄 거예요.';
    else if (F.line) why = CM.checkLine(a.line, C).why;
    else if (F.check) why = `들은 값(${Object.keys(fact).map(k => CM.factKo(k, fact[k])).join(' · ')})과 같아요. 시간 · 번호는 이렇게 되짚어 확인해요.`;
    else if (F.bare) why = `${shapeHead(q)} → ${SHp.ans}. ${In.offer ? '권하거나 물어볼 것을 묻는 말이라' : 'Yes/No 질문이라'} ${F.yes ? 'Yes' : 'No'}로 답할 수 있어요.`;
    else {
      const sl = segs.filter(s => s.r === 'slot').map(s => s.t), fk = Object.keys(fact).filter(k => fact[k] != null && k !== 'task');
      why = `${shapeHead(q)} → ${SHp.ans}. ` + (F.aux && q.aux ? `${CM.AUX[q.aux].q} → 짝 맞는 대답(${CM.AUX[q.aux].a}). ` : '') + (sl.length ? `틀 + 내 정보(${sl.join(' ')}) → ${src}의 사실과 맞아요.` : fk.length ? `${src}의 사실(${fk.map(k => CM.factKo(k, fact[k])).join(' · ')})과 맞아요.` : '짧은 대답이면 충분해요.');
      if (q.intent === 'need') why += fact.task === 'reg' ? ' 부탁 틀(I\'d like to …) + 용건 → 무엇을 하러 왔는지 바로 알 수 있어요.' : ' 사실(문제) + 부탁(질문) → 무엇이 문제이고 무엇을 바라는지 바로 알 수 있어요.';
      if (q.intent === 'full') why += ' 할 수 있는 방법을 질문으로 물었어요.';
      if (q.intent === 'taken' && fact.taken === false) why += ' 사실(안 들어 봤어요) + 부탁(질문) → 대화를 이어 가요.';
      if (q.shape === 'yn' && In.offer && !/^(Yes|No)\b/.test(CM.text(a))) why += ` ${SHp.offer}.`;
    }
    if (pol.length) why += ` 공손한 말 → ${pol.join(' · ')}.`;
    notes.forEach(n => { why += ` ${n}`; });
    if (F.note) why += ` ${F.note}`;
    if (sv && sv.note) why += ` ${sv.note}`;
    return res(true, 0, why);
  };
  // 모범 대답 (카드에 맞춰)
  const ECHO_OF = { need: 'rp_need', wl: 'rp_wl', oh: 'rp_oh', due: 'rp_due', room: 'rp_room', talk: 'rp_talk' };
  CM.model = function (q, card) {
    if (typeof q === 'string') q = CM.Q[q];
    const C = Object.assign({}, card || {}, q.fact || {});
    if (q.fast) return { f: ECHO_OF[q.intent] || 'rp_again' };
    if (q.intent === 'else') return C.ask === null ? { f: 'el_no' } : CM.modelLine(C);
    const In = CM.INTENT[q.intent], id = typeof In.best === 'function' ? In.best(C, q) : In.best, F = CM.FRAME[id];
    if (!F.slot) return { f: id };
    const v = CM.slotVal(F.slot, C, q);
    return { f: id, v: v != null ? String(v) : (CM.SLOT[F.slot].dyn ? undefined : slotIds(F.slot)[0]) };
  };
  // 부탁 한 줄의 모범
  CM.modelLine = C => ({ f: 'line', line: { words: CM.lineWords(C) } });

  /* =========================================================
     소리로 한 대답 맞춰 보기 — CM.matchSpoken(들린 글, 말, 카드)
     음성 인식이 글로 바꾼 말에 그 말의 표시 낱말과 카드의 사실이 들어 있으면 받아들여요.
     질문의 모양 규칙은 같아요: 고르는 질문 · 정보 질문에 yes · no만 들리면 ①. 숫자는 낱말(three-eighteen · thirteen)이든 숫자든 같게 맞춰요.
     부탁 한 줄은 들린 조각을 차례대로 모아 CM.checkLine으로 맞춰 봐요. 문법 · 공손함 · 발음은 판정하지 않아요(알림만 붙여요).
     ========================================================= */
  const CONTR = [[/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\bwhat's\b/g, 'what is'], [/\bdon't\b/g, 'do not'], [/\bdidn't\b/g, 'did not'], [/\bi've\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\bcan't\b/g, 'cannot'], [/\bi'd\b/g, 'i would'], [/\byou're\b/g, 'you are'], [/\bthat's\b/g, 'that is'], [/\bthere's\b/g, 'there is'], [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bdoesn't\b/g, 'does not'], [/\bhaven't\b/g, 'have not'], [/\bwon't\b/g, 'will not'], [/\bhere's\b/g, 'here is'], [/\blet's\b/g, 'let us'], [/\bwouldn't\b/g, 'would not']];
  CM.norm = function (s) {
    let t = String(s || '').toLowerCase().replace(/[’‘]/g, '\'');
    CONTR.forEach(([r, w]) => { t = t.replace(r, w); });
    t = t.replace(/(\d)\.(\d)/g, '$1 $2').replace(/[^a-z0-9' -]+/g, ' ').replace(/-/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '')
      .replace(/\bwi fi\b/g, 'wifi').replace(/\b(wait list|waiting list)\b/g, 'waitlist');
    return t.split(/\s+/).filter(Boolean);
  };
  const W2N = {}; Object.entries(NUMW).forEach(([n, w]) => { W2N[w] = +n; });
  const MULT = { hundred: 100, thousand: 1000 };
  // 숫자 덩어리 하나 → 숫자 글: 곱하는 말이 있으면 더해서(three hundred eighteen → 318),
  // 없으면 이어 붙여서(three eighteen → 318 · two oh one → 201 · two forty → 240)
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
  CM.canon = s => canonCore(CM.norm(s).map(x => ({ x, i: 0 }))).map(o => o.p);
  const runs = toks => toks.filter(t => /^\d+$/.test(t)).map(Number);
  const BARE_RE = /^(yes|yeah|yep|no|nope|please|sure|thanks|thank|you|okay|ok|of|course|it|is|i|do|did|have|am|not|that|would|like|great|fine|alright|right|uh|um|well|oh)$/;
  const REPAIR_RE = /\b(say that again|pardon|repeat|more slowly|slow down|sorry what|come again)\b|^ ?sorry ?$/;
  // 되짚지 않고 넘어가는 대답 (안내에 Okay만 하면 ②)
  const SKIP_OF = { full: 'fl_ok', wl: 'wl_ok', oh: 'oh_ok', due: 'du_ok', visit: 'vs_ok' };
  // 들린 요일 묶음 → 면담 시간 id
  const heardDays = s => { const d = k => new RegExp('\\b' + k + 's?\\b').test(s); return d('tuesday') && d('thursday') ? 'tt' : d('monday') && d('wednesday') ? 'mw' : d('wednesday') && d('friday') ? 'wf' : null; };
  // 부탁 한 줄에서 조각 모으기 → 줄 낱말 (들린 차례대로)
  CM.parseLine = function (raw) {
    const s = ' ' + CM.canon(raw).join(' ') + ' ', hits = [];
    const scan = (re, w) => { re.lastIndex = 0; let m; while ((m = re.exec(s))) hits.push([m.index, w]); };
    scan(/\bprofessor hale\b/g, 'hale');
    scan(/\bteacher\b/g, 'teacher');
    scan(/\b(sick|ill|not feeling well|had a cold|had the flu)\b/g, 'sick');
    scan(/\b(exams?|tests?|midterms?)\b/g, 'exams');
    scan(/\bfamily\b/g, 'family');
    scan(/\bwould it be possible\b/g, 'wibp');
    scan(/\b(could|can|may) i (get|have|ask for)\b/g, 'cig');
    scan(/\bi want\b/g, 'iwant');
    if (/\breport\b/.test(s)) scan(/\b(more time|extension)\b/g, 'rep');
    else if (/\b2 (day extension|more days|extra days)\b/.test(s)) scan(/\b2 (day extension|more days|extra days)\b/g, 'd2');
    else if (/\b3 (day extension|more days|extra days)\b/.test(s)) scan(/\b3 (day extension|more days|extra days)\b/g, 'd3');
    else scan(/\b(extension|more time)\b/g, 'ext');
    hits.sort((a, b) => a[0] - b[0]);
    return hits.map(h => h[1]).filter((w, i, a) => a.indexOf(w) === i);
  };
  CM.matchSpoken = function (raw, q, card) {
    if (typeof q === 'string') q = CM.Q[q];
    const toks = CM.canon(raw), s = ' ' + toks.join(' ') + ' ', heard = CM.norm(raw).join(' ');
    if (!toks.length) return { ok: false, stage: 0, why: '들린 말이 없어요. 다시 말해 보세요.', heard: '' };
    const C = Object.assign({}, card || {}, q.fact || {}), SHp = CM.SHAPE[q.shape], It = CM.INTENT[q.intent];
    const R = (ok, stage, why, o = {}) => Object.assign({ ok, stage, why, heard }, o);
    const notes = [];
    const pass = (why, cov) => R(true, 0, why + (notes.length ? ' 알림: ' + notes.join(' ') : ''), { note: notes.join(' '), covered: cov || [q.intent] });
    const keyMiss = () => R(false, 1, `${shapeHead(q)}(${SHp.ans}). 들린 말에 그 대답이 없어요.`);
    const differ = (k, v, who) => R(false, 2, `${who || '카드'}와 달라요. ${who || '카드'}: ${CM.factKo(k, C[k])} · 들린 말: ${CM.factKo(k, v)}.`, { tag: 'fact' });
    const lit = id => R(false, 2, CM.FRAME[id].why, { tag: 'literal' });
    const need = id => R(false, 2, CM.FRAME[id].why, { tag: 'need' });
    const ask = /\b(could|can|would|may)\b/.test(s);
    // 빠른 말: 다시 묻는 말만 (들린 만큼 되묻는 말은 실제 말과 같아야)
    if (q.fast) {
      const echo = /\broom\b/.test(s) ? 'room' : /\boffice hours?\b/.test(s) ? 'oh' : /\b(deadline|due|new date)\b/.test(s) ? 'due' : /\b(talk|talked|roommate)\b/.test(s) ? 'talk' : /\b(waitlist|number)\b/.test(s) ? 'wl' : /\b(what i need|what do i need|help)\b/.test(s) ? 'need' : null;
      if (echo) return echo === q.intent ? R(false, 1, '들린 만큼 되물었어요. 상대가 다시 말해 줄 거예요.', { repair: 'again' }) : R(false, 1, `되물은 말이 달라요. 들린 낱말(${q.key.join(' … ')})로 보면 상대는 ${It.turn}에 대해 말했어요.`);
      if (REPAIR_RE.test(s) || /\b(sorry|again|slowly)\b/.test(s)) return R(false, 1, '다시 묻는 말로 들었어요. 상대가 한 번 더 말해 줄 거예요.', { repair: 'again' });
      return R(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 짐작해서 답하지 말고 먼저 다시 물어요 → Sorry? Could you say that again, please?');
    }
    // 모르는 낱말 묻기 (maintenance)
    if (q.allow && /\bwhat (does|is) maintenance\b|\bmaintenance mean\b/.test(s)) return R(false, 1, '모르는 낱말을 물었어요. 상대가 쉬운 말로 알려 줄 거예요.', { repair: 'what' });
    if ((REPAIR_RE.test(s) || /\b(could you say|say again)\b/.test(s)) && toks.length <= 9) return R(false, 1, '다시 묻는 말로 들었어요. 상대가 한 번 더 말해 줄 거예요.', { repair: 'again' });
    if (/\b(give me|i want|help me|fix my|change my room|tell me your|you come with me|just put me)\b/.test(s)) notes.push('명령하거나 조르는 말처럼 들릴 수 있어요(말로 한 대답은 말투를 판정하지 않아요) → 부탁은 질문으로(Could you …? · Could I …?).');
    const bare = toks.every(t => BARE_RE.test(t)) && /\b(yes|yeah|yep|no|nope|sure|okay|ok)\b/.test(s);
    const yesHeard = /\b(yes|yeah|yep|sure|okay|ok)\b/.test(s), noHeard = /\b(no|nope)\b/.test(s);
    if (bare && (q.shape === 'or' || q.shape === 'wh')) return R(false, 1, `${shapeHead(q)}. ${q.shape === 'or' ? '둘 가운데 하나를 고르라는 말이라 yes · no만으로는 무엇을 골랐는지 알 수 없어요' : '정보를 묻는 말이라 yes · no로는 답이 안 돼요'} → ${It.want}`, { tag: 'shape' });
    if (bare && q.shape === 'note') return SKIP_OF[q.intent] ? need(SKIP_OF[q.intent]) : R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${CM.sayOf(q.intent)} → ${It.want}`, { tag: 'shape' });
    if (q.shape === 'or' && yesHeard && !bare) notes.push('고르는 질문에는 Yes 없이 고른 것만 말해도 돼요.');
    const auxNote = () => { if (!q.aux) return; const said = /\b(i|it) (do|did|am|is|have)( not)?\b/.exec(s); const map = { do: 'do', did: 'did', am: 'be', is: 'is', have: 'have' }; if (said && map[said[2]] !== q.aux) notes.push(`${CM.AUX[q.aux].q} 질문의 짧은 대답은 → ${CM.AUX[q.aux].a}(말로 한 대답은 문법을 판정하지 않아요)`); };
    const yn = (k, v, okWhy) => { if (C[k] != null && v !== !!C[k]) return differ(k, v); auxNote(); return pass(okWhy); };
    const thanksOnly = () => /\b(thank|thanks|okay|ok|great|i see|got it)\b/.test(s);
    switch (q.intent) {
      case 'need': {
        const task = q.fact && q.fact.task;
        if (task === 'reg') {
          if (/\bapply\b/.test(s)) return lit('nd_apply');
          const n = runs(toks).find(x => x >= 100 && x < 1000);
          if (!/\b(register|sign up|enroll|take|join|add)\b/.test(s) && n == null) {
            if (/\bexchange student\b/.test(s)) return need('nd_rhalf');
            return /\b(heater|shower|light|wifi|roommate|extension)\b/.test(s) ? R(false, 2, '상황과 달라요. 여기는 수업 등록 창구예요.', { tag: 'fact' }) : keyMiss();
          }
          if (n != null && C.course != null && n !== C.course) return R(false, 2, `카드와 달라요. 카드: ${CM.factKo('course', C.course)} · 들린 말: ${CM.factKo('course', n)}. 과목 번호는 두 묶음으로 → ${C.course} = ${CM.roomWords(C.course)}.`, { tag: 'fact' });
          if (n == null) notes.push('과목 번호까지 말하면 더 빨라요 → I\'d like to register for English 210, please.');
          return pass(n != null ? '수강 신청할 과목이 들렸고 카드와 맞아요.' : '수강 신청하려는 용건이 들렸어요.');
        }
        if (task === 'help') {
          if (/\bteacher\b/.test(s)) return lit('nd_tlit');
          const v = /\breadings?\b/.test(s) ? 'read' : /\b(essay|paper|writing assignment)\b/.test(s) ? 'essay' : null;
          if (!v) return /\b(heater|shower|wifi|roommate|register)\b/.test(s) ? R(false, 2, '상황과 달라요. 여기는 교수 면담이에요.', { tag: 'fact' }) : keyMiss();
          if (C.trouble != null && v !== C.trouble) return differ('trouble', v);
          if (!ask && !/\badvice\b/.test(s)) return need('nd_hhalf');
          return pass('어려운 것(사실)과 부탁(질문)이 들렸어요.');
        }
        if (task === 'fix') {
          if (/\bboiler\b/.test(s)) return R(false, 2, CM.SLOT.thing.vals.boiler.why, { tag: 'literal' });
          const v = /\b(heater|heating|radiator)\b/.test(s) ? 'heater' : /\bshower\b/.test(s) ? 'shower' : /\b(light|lights|lamp)\b/.test(s) ? 'light' : /\b(wifi|internet)\b/.test(s) ? 'wifi' : null;
          if (!v) return /\b(register|class|roommate|essay)\b/.test(s) ? R(false, 2, '상황과 달라요. 여기는 기숙사 사무실이에요.', { tag: 'fact' }) : keyMiss();
          if (C.thing != null && v !== C.thing) return differ('thing', v);
          if (!ask && !/\bsend someone\b/.test(s)) return /\bfix my\b/.test(s) ? pass('고장 난 것이 들렸어요.') : need('nd_fhalf');
          return pass('고장(사실)과 부탁(질문)이 들렸어요.');
        }
        if (/\bhere is (too |so |very )?noisy\b/.test(s)) return lit('nd_noisy');
        const v = /\b(music|loud)\b/.test(s) ? 'music' : /\b(friends|guests|people) over\b|\bfriends\b/.test(s) ? 'guests' : /\balarm\b/.test(s) ? 'alarm' : null;
        if (!v) return /\b(change|move)\b.*\broom\b/.test(s) ? R(false, 2, '무엇이 문제인지(사실)가 빠졌어요. 사실 + 부탁으로 → My roommate plays loud music late at night, so I can\'t sleep. Could I get some advice?', { tag: 'need' }) : keyMiss();
        if (C.issue != null && v !== C.issue) return differ('issue', v);
        if (!ask && !/\b(advice|what should i do)\b/.test(s)) return need('nd_ahalf');
        return pass('문제(사실)와 부탁(질문)이 들렸어요.');
      }
      case 'sec': {
        const v = /\bmorning\b/.test(s) ? 'morning' : /\bafternoon\b/.test(s) ? 'afternoon' : null;
        if (!v) return keyMiss();
        if (C.sec != null && v !== C.sec) return differ('sec', v);
        return pass('고른 반이 들렸고 카드와 맞아요.');
      }
      case 'taken': {
        if (!yesHeard && !noHeard) return /\b(took|korea)\b/.test(s) ? yn('taken', true, '들어 봤다는 말이 들렸어요.') : keyMiss();
        if (noHeard && C.taken === false && !ask && !/\bstill\b/.test(s)) return R(false, 2, It.yn.noStrict, { tag: 'need' });
        if (yesHeard && !noHeard && !/\b(took|korea|class)\b/.test(s)) notes.push(It.yn.need);
        return yn('taken', !noHeard, noHeard ? '안 들어 봤다는 사실과 그래도 들을 수 있는지 묻는 말이 들렸어요.' : '들어 봤다는 말이 들렸어요.');
      }
      case 'full': {
        if (/\breservation\b/.test(s)) return lit('fl_res');
        const wait = /\bwaitlist\b/.test(s), sec = /\bmorning\b/.test(s) ? 'morning' : /\bafternoon\b/.test(s) ? 'afternoon' : null;
        if (!wait && !sec) return /\bjust put me\b/.test(s) ? R(false, 2, CM.FRAME.fl_just.why, { tag: 'need' }) : thanksOnly() ? need('fl_ok') : keyMiss();
        if (!wait && sec === C.sec) return R(false, 2, `${CM.factKo('sec', C.sec)}은 다 찼다고 했어요. 다른 반을 물을 때는 → Could I join the ${CM.SECTIONS[C.alt].t} section instead?`, { tag: 'fact' });
        const v = wait ? 'wait' : 'other';
        if (C.full != null && v !== C.full) return differ('full', v);
        return pass(v === 'wait' ? '대기 명단에 올려 달라는 부탁이 들렸어요.' : '다른 반에 들어갈 수 있는지 묻는 말이 들렸어요.');
      }
      case 'wl': {
        const n = runs(toks).find(x => x > 0 && x < 100);
        if (n == null) return thanksOnly() ? need('wl_ok') : keyMiss();
        if (C.wl != null && n !== C.wl) return R(false, 2, `상대가 말한 번호와 달라요. 상대: ${CM.factKo('wl', C.wl)} · 들린 말: ${CM.factKo('wl', n)}. -teen과 -ty는 헷갈리기 쉬워요. 뒤가 세면 thirTEEN, 앞이 세면 THIRty.`, { tag: 'fact' });
        return pass('대기 번호를 되짚었어요. 번호가 맞아요.');
      }
      case 'ask': {
        if (/\b(teacher|office time)\b/.test(s)) return lit('qs_lit');
        if (/\b(office hours?|when (can|could) i (see|meet|visit) you)\b/.test(s)) return pass('면담 시간을 묻는 말이 들렸어요.');
        if (noHeard && !yesHeard) return R(false, 2, '상황과 달라요. 물어볼 것(면담 시간)이 있어요 → Yes. Could you tell me when your office hours are?', { tag: 'fact' });
        if (yesHeard) return R(false, 2, It.yn.strict, { tag: 'need' });
        return keyMiss();
      }
      case 'oh': {
        const o = CM.ohParse(C.oh), d = heardDays(s), n = runs(toks).find(x => x >= 100 && x < 1000);
        if (!d && n == null) return thanksOnly() ? need('oh_ok') : keyMiss();
        if (d && o && d !== o.id) return R(false, 2, `상대가 말한 요일과 달라요. 상대: ${o.dko} · 들린 말: ${CM.OHS[d].ko}. 요일은 묶음으로 들어요.`, { tag: 'fact' });
        if (n != null && o && n !== o.room) return R(false, 2, `상대가 말한 방 번호와 달라요. 상대: ${o.room}호 (${CM.roomWords(o.room)}) · 들린 말: ${n}호. 방 번호의 -teen과 -ty는 헷갈리기 쉬워요.`, { tag: 'fact' });
        if (!d || n == null) notes.push('요일과 방 번호를 함께 되짚으면 더 좋아요 → So, Tuesdays and Thursdays, in Room 318?');
        return pass('면담 시간을 되짚었어요. 들은 것과 맞아요.');
      }
      case 'part': {
        const v = /\b(vocabulary|vocab|words)\b/.test(s) ? 'vocab' : /\b(main ideas?|ideas)\b/.test(s) ? 'ideas' : /\btopic\b/.test(s) ? 'topic' : /\b(structure|organization)\b/.test(s) ? 'struct' : null;
        if (!v) return keyMiss();
        if (q.choices && !q.choices.includes(v)) return R(false, 1, `${shapeHead(q)}. 상대가 말한 것(${q.choices.map(c => CM.factKo('part', c)).join(' · ')}) 가운데 하나를 골라요.`, { tag: 'choice' });
        if (C.part != null && v !== C.part) return differ('part', v);
        return pass('고른 것이 들렸고 카드와 맞아요.');
      }
      case 'tried': {
        if (!yesHeard && !noHeard) return keyMiss();
        return yn('tried', !noHeard, noHeard ? '안 써 봤다는 말이 들렸어요.' : '써 봤다는 말이 들렸어요.');
      }
      case 'else': {
        const ws = CM.parseLine(raw);
        if (!ws.length || ws.every(w => CM.OW[w].c === 'call')) {
          if (noHeard || /\b(that is all|that is it|i am good)\b/.test(s)) { if (C.ask) return differ('ask', null); return pass('다 됐다는 말이 들렸어요.'); }
          if (yesHeard) return R(false, 2, It.yn.strict, { tag: 'need' });
          return keyMiss();
        }
        const o = CM.checkLine({ words: ws }, C);
        if (!o.ok && o.stage !== 3) return R(false, o.stage || 2, o.why, { tag: o.tag || 'fact', line: ws, fix: CM.fixLine({ words: ws }, C) });
        if (!o.ok) notes.push(o.why);
        return pass('까닭(사실)과 부탁이 들렸어요.', CM.coveredBy(CM.lineFacts(ws), 'else'));
      }
      case 'days': {
        if (/\bduring\b/.test(s)) return lit('dy_dur');
        const n = runs(toks).find(x => x > 0 && x < 10);
        if (n == null || !/\bdays?\b/.test(s)) return keyMiss();
        if (C.days != null && n !== C.days) return differ('days', n);
        return pass('더 필요한 날수가 들렸고 카드와 맞아요.');
      }
      case 'due': {
        const v = /\bsaturday\b/.test(s) ? 'sat' : /\bsunday\b/.test(s) ? 'sun' : /\bmonday\b/.test(s) ? 'mon' : /\btuesday\b/.test(s) ? 'tue' : null;
        if (!v) return thanksOnly() ? need('du_ok') : keyMiss();
        if (C.due != null && v !== C.due) return differ('due', v, '상대');
        return pass('새 마감을 되짚었어요. 요일이 맞아요.');
      }
      case 'room': {
        const r = CM.roomParse(C.room), n = runs(toks).find(x => x >= 100 && x < 1000), h = CM.HALL_IDS.find(x => new RegExp('\\b' + x + '\\b').test(s));
        if (n == null && !h) return /\b(dormitory|dorm)\b/.test(s) ? need('rm_dorm') : keyMiss();
        if (n != null && r && n !== r.n) return R(false, 2, `카드와 달라요. 카드: ${r.n}호 (${CM.roomWords(r.n)}) · 들린 말: ${n}호. 방 번호의 -teen과 -ty는 헷갈리기 쉬워요.`, { tag: 'fact' });
        if (h && r && h !== r.hall) return R(false, 2, `카드와 달라요. 카드: ${CM.HALLS[r.hall].t} · 들린 말: ${CM.HALLS[h].t}.`, { tag: 'fact' });
        if (n == null) return R(false, 2, `방 번호가 빠졌어요 → It's ${CM.roomText(C.room)}.`, { tag: 'need' });
        if (!h) notes.push(`건물 이름도 함께 → It's ${CM.roomText(C.room)}.`);
        return pass('방 번호가 들렸고 카드와 맞아요.');
      }
      case 'enter': {
        const rather = /\b(rather|prefer|be there|when i am (there|home|in))\b/.test(s);
        if (!yesHeard && !noHeard && !rather) return /\bfine\b/.test(s) ? yn('enter', true, '괜찮다는 말이 들렸어요.') : keyMiss();
        if (noHeard && !rather) return R(false, 2, It.yn.noStrict, { tag: 'need' });
        return yn('enter', !(noHeard || rather), rather ? '내가 있을 때 오면 좋겠다는 말이 들렸어요.' : '괜찮다는 말이 들렸어요.');
      }
      case 'visit': {
        const ns = runs(toks).filter(x => x > 0 && x <= 12), v = CM.VISIT_IDS.find(id => CM.VISITS[id].from === ns[0] && CM.VISITS[id].to === ns[1]);
        if (!ns.length) return thanksOnly() ? need('vs_ok') : keyMiss();
        if (C.visit != null && v !== C.visit) return R(false, 2, `상대가 말한 시간과 달라요. 상대: ${CM.factKo('visit', C.visit)} · 들린 말: ${ns.join(' · ')}시. 시각 둘(언제부터 · 언제까지)을 함께 되짚어요.`, { tag: 'fact' });
        return pass('수리하러 올 시간을 되짚었어요. 시간이 맞아요.');
      }
      case 'talk': {
        if (!yesHeard && !noHeard) return keyMiss();
        return yn('talked', !noHeard, noHeard ? '아직 얘기 안 해 봤다는 말이 들렸어요.' : '얘기해 봤다는 말이 들렸어요.');
      }
      case 'with': {
        if (!yesHeard && !noHeard) return /\b(that would (really )?help|please)\b/.test(s) ? yn('with', true, '함께 있어 주면 좋겠다는 말이 들렸어요.') : keyMiss();
        return yn('with', !noHeard, noHeard ? '먼저 혼자 얘기해 보겠다는 말이 들렸어요.' : '함께 있어 주면 좋겠다는 말이 들렸어요.');
      }
      default: return R(false, 0, '이 말은 말로 대답하기를 지원하지 않아요.');
    }
  };

  /* ---------- 따라 말하기: 낱말 맞춰 보기 (가장 긴 공통 부분열, 숫자는 같은 숫자로 — 숫자 덩어리가 낱말 여럿에 걸치면 함께 칠해요) ---------- */
  CM.compareWords = function (target, heard) {
    const tw = String(target).split(/\s+/).filter(Boolean), raw = [];
    tw.forEach((w, i) => CM.norm(w).forEach(x => raw.push({ x, i })));
    const T = canonCore(raw), A = T.map(o => o.p), B = CM.canon(heard), D = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) D[i][j] = A[i] === B[j] ? D[i + 1][j + 1] + 1 : Math.max(D[i + 1][j], D[i][j + 1]);
    const got = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { got.add(i); i++; j++; } else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++; }
    const okW = tw.map(() => true);
    T.forEach((o, n) => { if (!got.has(n)) o.ws.forEach(w => { okW[w] = false; }); });
    return { words: tw.map((t, k) => ({ t, ok: okW[k] })), hit: okW.filter(Boolean).length, total: tw.length };
  };

  /* =========================================================
     내 카드 (교환학생 시뮬레이터): 수업 등록 → 수업 뒤 → 교수 면담 → 기숙사 사무실 → RA
     대기 번호 · 면담 시간 · 새 마감 · 수리 시간은 카드에 없어요 — 상대가 말한 것을 듣고 되짚어야 해요.
     ========================================================= */
  CM.newCard = function (rnd = Math.random) {
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const sec = pick(['morning', 'afternoon']), trouble = pick(['read', 'essay']), days = pick([2, 3]);
    return { course: pick(CM.COURSE_IDS), sec, alt: CM.otherSec(sec), taken: rnd() < 0.5, full: rnd() < 0.5 ? 'wait' : 'other', wl: pick(CM.WLS),
      oh: pick(CM.OH_IDS), trouble, part: pick(CM.TROUBLE[trouble].parts), tried: rnd() < 0.5, ask: 'ext', why: pick(CM.WHY_IDS), days, due: CM.dueOf(days),
      thing: pick(CM.THING_IDS), room: `${pick(CM.ROOMS)}-${pick(CM.HALL_IDS)}`, enter: rnd() < 0.6, visit: pick(CM.VISIT_IDS),
      issue: pick(CM.ISSUE_IDS), talked: rnd() < 0.5, with: rnd() < 0.5 };
  };
  // 상대가 말하는 차례 (부탁 한 줄에 날수까지 말하면 ‘며칠 더’는 건너뜀 — 시뮬레이터가 covered로)
  CM.simQs = c => ['reg_help', 'reg_sec', 'reg_taken', 'fl_full'].concat(c.full === 'wait' ? ['fl_wl'] : [])
    .concat(['cl_q', 'cl_oh', 'oh_help', c.trouble === 'essay' ? 'oh_essay' : 'oh_read', 'oh_tried', 'ex_else', 'ex_days', 'ex_due', 'dm_help', 'dm_room', 'dm_enter', 'dm_visit', 'ra_help', 'ra_talk', 'ra_with']);
  // 카드에 따라 바뀌는 말 (다 찬 반 · 대기 번호 · 면담 시간 · 새 마감 · 수리 시간)
  CM.simQ = function (id, c) {
    const q = CM.Q[id];
    if (id === 'fl_full') return Object.assign({}, q, { en: `Hmm, it looks like the ${c.sec} section is full.`, ko: `음, ${eun(CM.SECTIONS[c.sec].ko)} 다 찬 것 같아요.`, fact: { sec: c.sec, alt: CM.otherSec(c.sec) }, short: `The ${c.sec} section is full.` });
    if (id === 'fl_wl') return Object.assign({}, q, { en: `Okay. You're number ${c.wl} on the waitlist.`, ko: `네. 대기 명단 ${c.wl}번이에요.`, key: [`number ${c.wl}`], fact: { wl: c.wl }, short: `You're number ${c.wl} on the waitlist.` });
    if (id === 'cl_oh') { const o = CM.OHS[c.oh]; return Object.assign({}, q, { en: CM.ohLine(c.oh), ko: `제 면담 시간은 ${o.ko} ${o.from}시에서 ${o.to}시, ${o.room}호예요.`, fact: { oh: c.oh }, short: `${o.days}, Room ${o.room}.` }); }
    if (id === 'ex_due') return Object.assign({}, q, { en: `Okay. Please send it to me ${CM.DUES[c.due].t}.`, ko: `좋아요. ${CM.DUES[c.due].ko} 보내 주세요.`, key: [`by ${CM.DUES[c.due].day}`], fact: { due: c.due }, short: `Send it ${CM.DUES[c.due].t}.` });
    if (id === 'dm_visit') { const v = CM.VISITS[c.visit]; return Object.assign({}, q, { en: `Someone will come by ${CM.visitText(c.visit)}.`, ko: `${v.ko}에 누가 갈 거예요.`, key: [`between ${v.from} and ${v.to}`], fact: { visit: c.visit }, short: `Tomorrow between ${v.from} and ${v.to}.` }); }
    return q;
  };
  CM.PLACE_OF = id => CM.Q[id].place;
  // 질문마다 틀 칩: 맞는 틀 · 한국어 그대로(콩글리시 · 짝이 다른 대답) · 사실만 말한 틀 · Yes만 하는 대답. 연장 부탁은 조각 칩(CM.lineChips)으로 말해요
  CM.SIM_FRAMES = {
    need: c => c.task === 'reg' ? ['nd_reg', 'nd_apply', 'nd_rhalf'] : c.task === 'help' ? ['nd_help', 'nd_hhalf', 'nd_tlit'] : c.task === 'fix' ? ['nd_fix', 'nd_fhalf', 'nd_fixit'] : ['nd_adv', 'nd_noisy', 'nd_ahalf'],
    sec: ['sc_pl', 'g_yesp', 'tk_yes'],
    taken: c => c.taken ? ['tk_yes', 'tk_did', 'tk_no'] : ['tk_ask', 'tk_no', 'tk_yes'],
    full: c => c.full === 'wait' ? ['fl_wait', 'fl_res', 'fl_ok'] : ['fl_other', 'fl_ok', 'fl_wait'],
    wl: ['wl_so', 'wl_ok', 'g_yes'],
    ask: ['qs_oh', 'qs_lit', 'g_yes'],
    oh: ['oh_so', 'oh_ok', 'g_yes'],
    part: ['pt_pl', 'g_yesp', 'tr_yes'],
    tried: c => c.tried ? ['tr_yes', 'tr_do', 'tr_no'] : ['tr_no', 'tr_do', 'tr_yes'],
    else: ['line', 'el_no', 'g_yes'],
    days: ['dy_pl', 'dy_dur', 'g_yes'],
    due: ['du_so', 'du_ok', 'g_yes'],
    room: ['rm_is', 'rm_dorm', 'g_yes'],
    enter: c => c.enter ? ['en_ok', 'en_do', 'en_no'] : ['en_no', 'en_do', 'g_no'],
    visit: ['vs_so', 'vs_ok', 'g_yes'],
    talk: c => c.talked ? ['tl_yes', 'tl_do', 'tl_no'] : ['tl_no', 'tl_do', 'tl_yes'],
    with: c => c.with ? ['wi_yes', 'wi_want', 'wi_no'] : ['wi_no', 'wi_want', 'wi_yes'],
  };
  CM.simFrames = (intent, c) => { const x = CM.SIM_FRAMES[intent]; return typeof x === 'function' ? x(c) : x ? x.slice() : null; };
  // 칸 칩: 카드(또는 들은 말)의 값 + 헷갈리기 쉬운 값 (과목 번호는 끝 두 자리를 바꾼 값 · 대기 번호와 방 번호는 teen ↔ ty · 면담은 방 번호 · 요일 함정)
  const ROOM_TRAP = r => { const t = CM.tailSwap(r); return t != null ? t : r + 1; };
  CM.ROOM_TRAP = ROOM_TRAP;
  CM.slotChoices = function (slot, card, rnd = Math.random, q) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let out;
    if (slot === 'course') { const n = card.course || 210; out = [n, CM.digitSwap(n), shuffle(CM.COURSE_IDS.filter(x => x !== n))[0]].map(String); }
    else if (slot === 'wl') { const n = card.wl || 13; out = [n, CM.teenSwap(n) || n + 20, n + 1].map(String); }
    else if (slot === 'oh') { const v = card.oh || 'tt'; out = [v, v + '~r', v + '~d']; }
    else if (slot === 'room') { const r = CM.roomParse(card.room || '214-maple'); out = [`${r.n}-${r.hall}`, `${ROOM_TRAP(r.n)}-${r.hall}`, `${r.n}-${shuffle(CM.HALL_IDS.filter(h => h !== r.hall))[0]}`]; }
    else if (slot === 'thing') { const r = CM.slotVal('thing', card, q); out = [r, r === 'heater' ? 'boiler' : shuffle(slotIds('thing').filter(k => k !== r))[0], shuffle(slotIds('thing').filter(k => k !== r))[0]]; }
    else if (slot === 'part') { const r = card.part || 'ideas', sib = Object.values(CM.TROUBLE).find(t => t.parts.includes(r)).parts.find(p => p !== r), far = shuffle(Object.keys(CM.PARTS).filter(p => p !== r && p !== sib))[0]; out = [r, sib, far]; }
    else {
      const right = CM.slotVal(slot, card, q), keys = shuffle(slotIds(slot).filter(k => k !== right));
      out = (right ? [right] : []).concat(keys.slice(0, right ? 2 : 3));
    }
    return shuffle(out.filter((x, i, a) => x != null && a.indexOf(x) === i));
  };
  // 부탁 한 줄의 조각 칩 (갈래마다 맞는 조각 + 헷갈리기 쉬운 조각) — 차례대로 고르면 한 줄이 돼요
  CM.lineChips = function (c, rnd = Math.random) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const why = c.why || 'sick', other = shuffle(CM.WHY_IDS.filter(w => w !== why))[0], d = c.days || 2;
    return [
      { c: 'call', ids: shuffle(['hale', 'teacher']) },
      { c: 'why', ids: shuffle([why, other]) },
      { c: 'ask', ids: shuffle(['wibp', 'iwant']) },
      { c: 'want', ids: shuffle(['d' + d, 'd' + (5 - d), 'rep']) },
    ];
  };
  CM.cardRows = c => {
    const r = CM.roomParse(c.room), T = CM.TROUBLE[c.trouble];
    return [
      ['수업 등록', `English ${c.course} (${CM.COURSES[c.course].t} · ${CM.COURSES[c.course].ko}) · ${CM.SECTIONS[c.sec].ko} · 대학 영어 수업을 ${c.taken ? '들어 봤어요(한국에서 비슷한 수업)' : '안 들어 봤어요 — 그래도 듣고 싶어요'}`],
      ['반이 다 찼으면', c.full === 'wait' ? '대기 명단에 이름을 올려 달라고 해요(대기 번호는 직원이 알려 줘요)' : `${CM.SECTIONS[c.alt].ko}도 괜찮아요`],
      ['수업 뒤', `${CM.PROF}에게 면담 시간을 물어요 — 요일 · 방 번호는 교수가 알려 줘요`],
      ['교수 면담', `${T.ko} · 특히 ${CM.PARTS[c.part].ko} · 과목 웹사이트의 학습 안내서를 ${c.tried ? '써 봤어요(별 도움이 안 됐어요)' : '아직 안 써 봤어요'}`],
      ['마감 연장', `${CM.WHYS[c.why].ko} → 에세이 마감(금요일 자정)을 ${CM.DAYS[c.days].ko} 미루고 싶어요 — 새 마감은 교수가 알려 줘요`],
      ['기숙사', `${CM.HALLS[r.hall].ko}(${CM.HALLS[r.hall].t}) ${r.n}호 · ${ig(CM.THINGS[c.thing].ko)} 고장 · 없을 때 들어와도 ${c.enter ? '괜찮아요' : '안 돼요(내가 있을 때 오면 좋겠어요)'}`],
      ['룸메이트', `${CM.ISSUES[c.issue].ko} · 룸메이트와 ${c.talked ? '얘기해 봤어요(달라진 게 없어요)' : '아직 얘기 안 해 봤어요'} · RA가 함께 ${c.with ? '있어 주면 좋겠어요' : '없어도 돼요(먼저 혼자 얘기해 볼래요)'}`],
    ];
  };
  // 상대의 반응 (단계별)
  const BAD_REACT = {
    nd_apply: ['Apply…? Oh — you\'d like to register for a class?', '수강 신청 → register for'], nd_rhalf: ['Welcome! And… what can I help you with?', '용건을 부탁 틀로 → I\'d like to register for English 210, please.'],
    tk_did: ['You did…? So, you\'ve taken one before?', 'Have you …? → Yes, I have.'], tk_no: ['I see. Hmm… so, what would you like to do?', '사실 + 부탁 → Could I still sign up?'],
    fl_res: ['A reservation…? Oh — the waitlist?', '대기 예약 → the waitlist'], fl_ok: ['Okay… Is there anything you\'d like to do?', '방법을 질문으로 → Could you put me on the waitlist, please?'],
    wl_ok: ['Sure. Did you get your number?', '숫자는 되짚어요 → So, I\'m number 13?'], qs_lit: ['Oh — you can call me Professor Hale. My office hours?', 'Teacher → Professor Hale · office time → office hours'],
    oh_ok: ['Sure. Did you get the room number?', '요일 · 방 번호는 되짚어요'], nd_hhalf: ['I see. And how can I help?', '부탁을 질문으로 → Could you give me some advice?'],
    nd_tlit: ['Oh — you can call me Professor Hale. Which part is hard?', 'Teacher → Professor Hale · 어려운 것을 콕 집어'], tr_do: ['You do…? So, have you tried it?', 'Have you …? → Yes, I have. · No, I haven\'t.'],
    dy_dur: ['During…? Oh — how many more days?', '더 필요한 날수 → Just two more days, if possible.'], du_ok: ['Sure. Did you get the new deadline?', '요일은 되짚어요 → So, by Sunday at midnight?'],
    nd_fhalf: ['Oh dear. And… what would you like us to do?', '부탁을 질문으로 → Could you send someone to look at it?'], rm_dorm: ['Right — and which room?', '방 번호 + 건물 → It\'s Room 214, in Maple Hall.'],
    en_do: ['Sorry — is it alright if we go in?', 'Is it …? → Yes, it is. · Yes, that\'s fine.'], vs_ok: ['Lovely. Did you get the time?', '시간은 되짚어요 → So, tomorrow between 9 and 11?'],
    nd_ahalf: ['Oh, that\'s rough. So, what can I do for you?', '그래서 어떤지 + 부탁 → …, so I can\'t sleep. Could I get some advice?'], nd_noisy: ['Here…? Oh — it\'s too noisy in your room? What\'s going on?', 'Here is noisy → It\'s too noisy in my room. 사실 + 부탁'],
    tl_do: ['You don\'t…? So, you haven\'t talked to them yet?', 'Have you …? → No, I haven\'t.'],
  };
  CM.BAD_REACT = BAD_REACT;
  // 용건 질문의 곳 (등록 · 면담 · 고장 · 상담): 말에 적힌 것이 먼저, 없으면 카드
  const taskOf = (q, C) => (q && q.fact && q.fact.task) || (C && C.task) || null;
  CM.taskOf = taskOf;
  CM.REACT = {
    ok: ['Okay.', 'Great.', 'Alright.', 'Sure.', 'Got it.'],
    1: q => ({ en: `Sorry — ${q.short && /\?$/.test(q.short) ? q.short : (String(q.en).match(/[^.!?]*\?/g) || [String(q.en)]).pop().trim()}`, ko: q.shape === 'or' || q.shape === 'wh' ? `${CM.SHAPE[q.shape].ko} → ${CM.SHAPE[q.shape].ans}` : `‘${q.key.join(' … ')}’를 말했어요.` }),
    2: (q, j, a, C) => {
      const F = a && CM.FRAME[a.f], b = F && BAD_REACT[F.id];
      if (b) return { en: b[0], ko: b[1] };
      if (F && F.line) { const fx = CM.fixLine(a.line, C || {}); return { en: fx.en, ko: fx.ko }; }
      if (j.tag === 'fact') {
        if (q.intent === 'wl') return { en: `No — you're number ${C.wl}.`, ko: '들은 번호와 달라요.' };
        if (q.intent === 'oh') { const o = CM.OHS[CM.ohParse(C.oh).id]; return { en: `No — ${o.days}, in Room ${o.room}.`, ko: '들은 요일 · 방 번호와 달라요.' }; }
        if (q.intent === 'due') return { en: `No — ${CM.DUES[C.due].t}.`, ko: '들은 요일과 달라요.' };
        if (q.intent === 'visit') return { en: `No — ${CM.visitText(C.visit)}.`, ko: '들은 시간과 달라요.' };
        if (q.intent === 'room') return { en: 'Hmm, let me check… which room was that again?', ko: '내 카드의 방 번호를 다시 보세요.' };
        if (q.intent === 'need' && taskOf(q, C) === 'reg') return { en: 'Sorry — which course was that?', ko: '과목 번호는 두 묶음으로 읽어요(210 = two-ten).' };
        if (q.intent === 'full' && a && CM.factOf(a).alt === C.sec) return { en: `Sorry — the ${C.sec} section is the full one.`, ko: '다 찬 반이에요.' };
        return { en: 'Hmm, are you sure?', ko: '내 카드(또는 상대가 한 말)를 다시 보세요.' };
      }
      if (j.tag === 'need') return q.intent === 'ask' ? { en: 'Sure — what is it?', ko: '물어볼 것을 바로 물어요.' } : q.intent === 'else' ? { en: 'Sure — what is it?', ko: '부탁할 것을 바로 말해요.' } : q.intent === 'need' ? { en: 'Okay… and what can I do for you?', ko: '무엇을 바라는지 질문으로 말해요.' }
        : q.intent === 'enter' ? { en: 'Oh — would you rather be there?', ko: '바라는 것을 덧붙여요.' } : q.intent === 'taken' ? { en: 'I see. So… what would you like to do?', ko: '사실 + 부탁 → Could I still sign up?' } : q.intent === 'full' ? { en: 'Okay… is there anything you\'d like to do?', ko: '방법을 질문으로 물어요.' } : { en: 'Sure — do you want to check that?', ko: '들은 것을 되짚어 확인해요.' };
      if (j.tag === 'wrong') return { en: 'Sorry?', ko: '질문의 첫 낱말과 짝이 맞는 대답을 해요.' };
      return { en: 'Sorry?', ko: '알아듣기 어려운 말이에요.' };
    },
    3: () => ({ en: '... Okay.', ko: '뜻은 통했지만 말투가 거칠어요.' }),
  };
  // 대답 뒤 상대가 덧붙이는 말 (다음 질문 앞)
  CM.reply = function (q, a, C) {
    switch (q.intent) {
      case 'need': { const t = taskOf(q, C); return t === 'reg' ? 'Sure! Let me pull up the class list.' : t === 'help' ? 'Of course. Let\'s take a look.' : t === 'fix' ? 'Oh dear, sorry about that. I\'ll put in a request.' : 'Oh no, that sounds tough.'; }
      case 'sec': return 'Okay, let me check.';
      case 'taken': return C.taken ? 'Great.' : 'Sure, that\'s fine. There\'s no requirement.';
      case 'full': return C.full === 'wait' ? 'Sure.' : `Yes, there's space in the ${C.alt} section. You're all set!`;
      case 'wl': return 'That\'s right. We\'ll email you if a spot opens up.';
      case 'ask': return 'Of course.';
      case 'oh': return 'That\'s right. See you then!';
      case 'part': return 'Okay, I see.';
      case 'tried': return C.tried ? 'Okay. Let\'s go over a few strategies, then.' : 'It\'s really helpful. Let\'s look at it together.';
      case 'else': return a && a.f === 'line' ? CM.fixLine(a.line, C).en : 'Okay. See you in class!';
      case 'days': return 'Okay, that\'s fine.';
      case 'due': return 'That\'s right. Good luck!';
      case 'room': return 'Thank you.';
      case 'enter': return C.enter ? 'Lovely.' : 'No problem. We\'ll come when you\'re in.';
      case 'visit': return 'That\'s right. Cheers!';
      case 'talk': return C.talked ? 'Okay. Thanks for trying.' : 'That\'s totally normal.';
      case 'with': return C.with ? 'No worries. Let\'s find a time.' : 'Sounds good. Let me know how it goes.';
      default: return null;
    }
  };

  /* =========================================================
     듣고 대답 고르기 16문제 (모두 새로 만든 대화). card = 그 상황의 사실
     ========================================================= */
  const o = (f, v) => { const a = { f }; if (v != null) a.v = String(v); return a; };
  const L = words => ({ f: 'line', line: { words } });
  CM.o = o; CM.L = L;
  CM.DRILL = [
    { q: 'reg_help', sit: '수강 신청하러 왔어요. 듣고 싶은 과목은 English 245(미국 단편소설)예요.', card: { course: 245 }, a: 2, opts: [o('nd_apply', 245), o('nd_reg', 254), o('nd_reg', 245), o('g_yes')] },
    { q: 'reg_sec', sit: '오후 반을 듣고 싶어요.', card: { sec: 'afternoon' }, a: 0, opts: [o('sc_pl', 'afternoon'), o('g_yesp'), o('sc_pl', 'morning'), o('tk_yes')] },
    { q: 'reg_taken', sit: '대학에서 영어 수업을 들어 본 적은 없어요. 그래도 이 수업을 듣고 싶어요.', card: { taken: false }, a: 3, opts: [o('tk_no'), o('g_yes'), o('tk_did'), o('tk_ask')] },
    { q: 'fl_full', sit: '오전 반이 다 찼대요. 대기 명단에 이름을 올리고 싶어요.', card: { full: 'wait' }, a: 1, opts: [o('fl_ok'), o('fl_wait'), o('fl_res'), o('g_yes')] },
    { q: 'fl_wl', sit: '직원이 대기 번호를 알려 줬어요. 제대로 들었는지 확인하고 싶어요.', card: {}, a: 2, opts: [o('wl_so', 30), o('wl_ok'), o('wl_so', 13), o('g_yes')] },
    { q: 'cl_q', sit: '수업이 끝났어요. 교수에게 면담 시간을 묻고 싶어요.', card: {}, a: 3, opts: [o('qs_lit'), o('g_yes'), o('qs_tell'), o('qs_oh')] },
    { q: 'cl_fast', sit: '교수가 아주 빠르게 말했어요. ‘… office hours …’만 들렸어요.', card: {}, a: 0, opts: [o('rp_oh'), o('oh_so', 'tt'), o('rp_due'), o('g_yes')] },
    { q: 'oh_help', sit: '읽기 과제가 어려워서 교수 면담에 왔어요.', card: { trouble: 'read' }, a: 1, opts: [o('nd_hhalf', 'read'), o('nd_help', 'read'), o('nd_tlit'), o('nd_hhelp', 'read')] },
    { q: 'oh_tried', sit: '학습 안내서는 아직 안 써 봤어요.', card: { tried: false }, a: 2, opts: [o('tr_do'), o('tr_yes'), o('tr_no'), o('g_yes')] },
    { q: 'ex_else', sit: '이번 주에 아팠어요. 에세이 마감을 이틀 미루고 싶어요.', card: { ask: 'ext', why: 'sick', days: 2 }, a: 3, opts: [L(['teacher', 'sick', 'wibp', 'd2']), L(['hale', 'sick', 'iwant', 'd2']), L(['hale', 'wibp', 'd2']), L(['hale', 'sick', 'wibp', 'd2'])] },
    { q: 'ex_days', sit: '이틀만 더 있으면 돼요.', card: { days: 2 }, a: 0, opts: [o('dy_pl', 2), o('g_yes'), o('dy_dur', 2), o('dy_pl', 3)] },
    { q: 'ex_fast', sit: '교수가 아주 빠르게 말했어요. ‘… Sunday …’만 들렸어요.', card: {}, a: 1, opts: [o('du_so', 'sun'), o('rp_due'), o('rp_room'), o('du_ok')] },
    { q: 'dm_help', sit: '방의 샤워기가 고장 났어요.', card: { thing: 'shower' }, a: 2, opts: [o('nd_fix', 'boiler'), o('nd_fhalf', 'shower'), o('nd_fix', 'shower'), o('nd_fixit', 'shower')] },
    { q: 'dm_room', sit: '내 방은 버치 홀(Birch Hall) 517호예요.', card: { room: '517-birch' }, a: 1, opts: [o('rm_is', '570-birch'), o('rm_is', '517-birch'), o('rm_dorm'), o('g_yes')] },
    { q: 'dm_enter', sit: '수리할 때 방에 있고 싶어요.', card: { enter: false }, a: 3, opts: [o('en_ok'), o('g_no'), o('en_do'), o('en_no')] },
    { q: 'ra_help', sit: '룸메이트가 밤늦게 친구들을 데려와서 잠을 못 자요.', card: { issue: 'guests' }, a: 0, opts: [o('nd_adv', 'guests'), o('nd_noisy'), o('nd_change'), o('nd_ahalf', 'guests')] },
  ];
  CM.DRILL.forEach((it, i) => { it.n = i; it.Q = CM.Q[it.q]; it.place = it.Q.place; });
  // 직접 해 보기의 짧은 문제 (00장 · 05장 · 07장) — 연습 문제와 다른 상황
  CM.MINI = {
    intro: { q: 'reg_help', sit: '수강 신청하러 왔어요. 듣고 싶은 과목은 English 260(시 입문)이에요.', card: { course: 260 }, a: 1, opts: [o('nd_reg', 206), o('nd_reg', 260), o('nd_apply', 260), o('g_yesp')] },
    part: { q: 'oh_essay', sit: '에세이에서 주제 정하기가 가장 어려워요.', card: { trouble: 'essay', part: 'topic' }, a: 0, opts: [o('pt_pl', 'topic'), o('pt_pl', 'struct'), o('pt_pl', 'vocab'), o('g_yesp')] },
    room: { q: 'dm_room', sit: '내 방은 시더 홀(Cedar Hall) 316호예요.', card: { room: '316-cedar' }, a: 2, opts: [o('rm_is', '360-cedar'), o('rm_is', '316-birch'), o('rm_is', '316-cedar'), o('g_yes')] },
  };
  Object.values(CM.MINI).forEach(it => { it.Q = CM.Q[it.q]; it.place = it.Q.place; });

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 내 카드
     ========================================================= */
  // 02–03장 수업 등록: English 210 · 오전 반 · 들어 봄 · 반이 차면 대기 명단(13번)
  // 04–06장 교수: 면담 시간 화 · 목 2–4시 318호 · 읽기 과제(중심 생각) · 학습 안내서 써 봄 · 아팠어요 → 이틀 연장 → 일요일 자정
  // 07–08장 기숙사: 메이플 홀 214호 · 난방기 고장 · 들어와도 괜찮음 · 내일 9–11시 · 룸메이트 음악 · 얘기 안 해 봄 · RA가 함께
  CM.DEMO = { course: 210, sec: 'morning', alt: 'afternoon', taken: true, full: 'wait', wl: 13, oh: 'tt', trouble: 'read', part: 'ideas', tried: true,
    ask: 'ext', why: 'sick', days: 2, due: 'sun', thing: 'heater', room: '214-maple', enter: true, visit: 'a', issue: 'music', talked: false, with: true };
  CM.LINE = { words: CM.lineWords(CM.DEMO) };
  // 00장: 용건은 부탁 틀로 · 교수님은 Professor + 성 · 들은 번호는 되짚기
  CM.INTRO = { q: 'reg_help', bad: o('nd_apply', 210), ok: o('nd_reg', 210), card: { course: 210 },
    dq: 'cl_q', dbad: o('qs_lit'), dok: o('qs_oh'), rq: 'fl_wl', skip: o('wl_ok'), check: o('wl_so', 13) };
  CM.SCENE = {
    // 02장 수업 등록: 용건 · 과목 번호 · 반 · 들어 본 수업
    need: ['reg_help', o('nd_apply', 210), o('nd_rhalf'), o('nd_regme', 210), o('nd_reg', 210)],
    course: ['reg_help', o('nd_reg', 201), o('nd_reg', 210)],
    sec: ['reg_sec', o('g_yesp'), o('sc_pl', 'afternoon'), o('sc_pl', 'morning')],
    taken: ['reg_taken', o('tk_did'), o('tk_yes')],
    notaken: ['reg_taken', o('tk_no'), o('tk_ask')],
    rfast: ['reg_fast', o('nd_reg', 210), o('rp_need')],
    // 03장 정원 · 대기 명단
    full: ['fl_full', o('g_yes'), o('fl_ok'), o('fl_res'), o('fl_just'), o('fl_wait')],
    other: ['fl_full', o('fl_other', 'morning'), o('fl_other', 'afternoon')],
    wl: ['fl_wl', o('wl_ok'), o('wl_so', 30), o('wl_so', 13)],
    wfast: ['fl_fast', o('wl_so', 13), o('rp_wl')],
    // 04장 수업 뒤 교수에게: 묻기 · 면담 시간 되짚기
    ask: ['cl_q', o('g_yes'), o('qs_lit'), o('qs_tell'), o('qs_oh')],
    oh: ['cl_oh', o('oh_ok'), o('oh_so', 'tt~d'), o('oh_so', 'tt~r'), o('oh_so', 'tt')],
    ofast: ['cl_fast', o('oh_so', 'tt'), o('rp_oh')],
    // 05장 교수 면담: 사실 + 부탁 · 고르기 · 해 본 것
    help: ['oh_help', o('nd_tlit'), o('nd_hhelp', 'read'), o('nd_hhalf', 'read'), o('nd_help', 'read')],
    part: ['oh_read', o('g_yesp'), o('pt_pl', 'topic'), o('pt_pl', 'ideas')],
    tried: ['oh_tried', o('tr_do'), o('g_yes'), o('tr_yes')],
    // 06장 마감 연장 부탁 한 줄 · 며칠 더 · 새 마감 되짚기
    lines: [['teacher', L(['teacher', 'sick', 'wibp', 'd2'])], ['want', L(['hale', 'sick', 'iwant', 'd2'])], ['nowhy', L(['hale', 'wibp', 'd2'])], ['rep', L(['hale', 'sick', 'wibp', 'rep'])], ['order', L(['hale', 'sick', 'd2', 'wibp'])], ['after', L(['hale', 'wibp', 'd2', 'sick'])], ['ok', L(CM.LINE.words)]],
    else: ['ex_else', o('g_yes'), o('el_no'), L(CM.LINE.words)],
    days: ['ex_days', o('dy_dur', 2), o('g_yes'), o('dy_pl', 2)],
    due: ['ex_due', o('du_ok'), o('du_so', 'mon'), o('du_so', 'sun')],
    dfast: ['ex_fast', o('du_so', 'sun'), o('rp_due')],
    // 07장 기숙사 고장 알리기
    fix: ['dm_help', o('nd_fix', 'boiler'), o('nd_fixit', 'heater'), o('nd_fhalf', 'heater'), o('nd_fix', 'heater')],
    room: ['dm_room', o('rm_dorm'), o('rm_is', '240-maple'), o('rm_is', '214-cedar'), o('rm_is', '214-maple')],
    rfast2: ['dm_fast', o('rm_is', '214-maple'), o('rp_room')],
    enter: ['dm_enter', o('en_do'), o('rp_wmain'), o('en_ok')],
    noenter: ['dm_enter', o('g_no'), o('en_no')],
    visit: ['dm_visit', o('vs_ok'), o('vs_so', 'b'), o('vs_so', 'a')],
    // 08장 룸메이트 · RA
    adv: ['ra_help', o('nd_noisy'), o('nd_change'), o('nd_ahalf', 'music'), o('nd_adv', 'music')],
    talk: ['ra_talk', o('tl_do'), o('tl_no')],
    tfast: ['ra_fast', o('tl_no'), o('rp_talk')],
    with: ['ra_with', o('wi_want'), o('g_yesp'), o('wi_yes')],
  };
  // 09장: 곳마다 한 줄 (3단계 적용)
  CM.METHOD = [
    ['reg_help', o('nd_reg', 210), {}],
    ['fl_wl', o('wl_so', 13), {}],
    ['cl_q', o('qs_oh'), {}],
    ['oh_help', o('nd_help', 'read'), {}],
    ['ex_else', L(CM.LINE.words), {}],
    ['dm_help', o('nd_fix', 'heater'), {}],
    ['ra_help', o('nd_adv', 'music'), {}],
  ];
  // 10장 실전: 내 카드 하나로 넷 (보기 셋, 단계마다 지워짐)
  CM.PCARD = { course: 245, sec: 'afternoon', alt: 'morning', taken: false, full: 'other', wl: 15, oh: 'mw', trouble: 'essay', part: 'struct', tried: false,
    ask: 'ext', why: 'exams', days: 3, due: 'mon', thing: 'wifi', room: '316-cedar', enter: false, visit: 'c', issue: 'alarm', talked: true, with: false };
  CM.PRACTICE = [
    { q: 'reg_sec', opts: [o('g_yesp'), o('sc_pl', 'morning'), o('sc_pl', 'afternoon')], a: 2,
      lines: ['morning … or … afternoon → 고르는 질문 · (A) Yes, please. → 무엇을 골랐는지 알 수 없어 탈락', '(B) morning → 카드(오후 반)와 달라 탈락', '남은 보기는 공손해요 · 정답 (C) The afternoon section, please.'] },
    { q: 'fl_full', opts: [o('fl_other', 'afternoon'), o('fl_other', 'morning'), o('fl_wait')], a: 1,
      lines: ['full → 안내 · 셋 모두 할 수 있는 방법을 묻는 말이에요', '(A) afternoon → 다 찬 반이라 탈락 · (C) waitlist → 카드(다른 반도 괜찮아요)와 달라 탈락', '남은 보기는 질문으로 부탁해요 · 정답 (B) Oh, I see. Could I join the morning section instead?'] },
    { q: 'ex_else', opts: [L(['hale', 'exams', 'iwant', 'd3']), L(['hale', 'exams', 'wibp', 'd2']), L(['hale', 'exams', 'wibp', 'd3'])], a: 2,
      lines: ['anything else → 더 할 말을 묻는 말 · 셋 모두 사실 + 부탁 한 줄이에요', '(B) two-day → 카드(사흘)와 달라 탈락', '(A) I want → 조르는 말이라 탈락 · 정답 (C) Professor Hale, I had three exams this week. Would it be possible to get a three-day extension on my essay?'] },
    { q: 'dm_room', opts: [o('rm_is', '360-cedar'), o('g_yes'), o('rm_is', '316-cedar')], a: 2,
      lines: ['room number → 정보 질문 · (B) Yes. → 묻는 정보가 없어 탈락', '(A) 360 → 카드(316호)와 달라 탈락 · three-sixTEEN과 three-SIXty', '남은 보기는 짧고 분명해요 · 정답 (C) It\'s Room 316, in Cedar Hall.'] },
  ];
  CM.practiceQ = p => CM.simQ(p.q, CM.PCARD);

  /* ---------- 이어서 들리는 말 (02 · 05장). 대문자 = 세게 ---------- */
  CM.LINKED = [
    { q: 'reg_sec', en: 'Morning or afternoon?', say: 'Morning or afternoon?', words: ['Morning', 'or', 'afternoon?'], sound: [['MOR', 1], ['nin', 0], ['gor', 0], ['af', 0], ['ter', 0], ['NOON', 1]], link: [[0, 1]], ko: 'morning or → mor-nin-gor처럼 이어져요 · 고를 것(MORning · afterNOON)을 세게' },
    { q: 'oh_essay', en: 'Topic or structure?', say: 'Topic or structure?', words: ['Topic', 'or', 'structure?'], sound: [['TO', 1], ['pi', 0], ['kor', 0], ['STRUC', 1], ['ture', 0]], link: [[0, 1]], ko: 'topic or → to-pi-kor처럼 이어져요 · 고를 것(TOPic · STRUCture)을 세게' },
  ];
  // 헷갈리는 숫자 짝 (03장): 앞이 세면 -ty, 뒤가 세면 -teen
  CM.PAIRS = [['13', 'thirTEEN', '30', 'THIRty'], ['14', 'fourTEEN', '40', 'FORty'], ['18', 'eighTEEN', '80', 'EIGHTy']];

  /* ---------- 직접 해 보기 자료 ---------- */
  CM.SHAPE_QS = ['reg_help', 'reg_sec', 'reg_taken', 'fl_full', 'fl_wl', 'cl_q', 'cl_oh', 'oh_help', 'oh_read', 'oh_tried', 'ex_else', 'ex_days', 'ex_due', 'dm_help', 'dm_room', 'dm_enter', 'dm_visit', 'ra_help', 'ra_talk', 'ra_with'];

  /* =========================================================
     따라 말하기 28문장 (곳마다 상대 · 나의 말 넷)
     ========================================================= */
  const SW = (place, who, en, ko, sp) => ({ place, who, en, ko, sp: who === 'me' ? 'me' : sp || CM.PLACE[place].sp });
  CM.SHADOW = [
    SW('reg', 'staff', 'Hi there. What can I help you with?', '(미국) 안녕하세요. 무엇을 도와드릴까요?'),
    SW('reg', 'me', 'I\'d like to register for English 210, please.', 'English 210을 수강 신청하고 싶어요.'),
    SW('reg', 'staff', 'Would you like the morning section or the afternoon section?', '오전 반으로 하시겠어요, 오후 반으로 하시겠어요?'),
    SW('reg', 'me', 'The morning section, please.', '오전 반으로 할게요.'),
    SW('full', 'staff', 'Hmm, it looks like the morning section is full.', '음, 오전 반은 다 찬 것 같아요.'),
    SW('full', 'me', 'Could you put me on the waitlist, please?', '대기 명단에 올려 주시겠어요?'),
    SW('full', 'staff', 'Okay. You\'re number 13 on the waitlist.', '네. 대기 명단 13번이에요.'),
    SW('full', 'me', 'So, I\'m number 13?', '그러니까 제가 13번이죠?'),
    SW('class', 'staff', 'Yes? Did you have a question?', '(캐나다) 네? 질문 있어요?'),
    SW('class', 'me', 'Yes. Could you tell me when your office hours are?', '네. 면담 시간이 언제인지 알려 주시겠어요?'),
    SW('class', 'staff', 'My office hours are Tuesdays and Thursdays from 2 to 4, in Room 318.', '제 면담 시간은 화요일과 목요일 2시에서 4시, 318호예요.'),
    SW('class', 'me', 'So, Tuesdays and Thursdays, in Room 318?', '그러니까 화요일과 목요일, 318호죠?'),
    SW('hours', 'staff', 'Come on in! What can I do for you?', '들어와요! 무엇을 도와줄까요?'),
    SW('hours', 'me', 'I\'m having trouble with the readings. Could you give me some advice?', '읽기 과제가 어려워요. 조언을 좀 해 주시겠어요?'),
    SW('hours', 'staff', 'Have you tried the study guide on the course website?', '과목 웹사이트에 있는 학습 안내서는 써 봤어요?'),
    SW('hours', 'me', 'Yes, I have, but it didn\'t help much.', '네, 써 봤는데 별로 도움이 안 됐어요.'),
    SW('ext', 'staff', 'Is there anything else?', '또 할 말 있어요?'),
    SW('ext', 'me', 'Professor Hale, I was sick this week. Would it be possible to get a two-day extension on my essay?', '헤일 교수님, 이번 주에 아팠어요. 에세이 마감을 이틀 미뤄 주실 수 있을까요?'),
    SW('ext', 'staff', 'Okay. Please send it to me by Sunday at midnight.', '좋아요. 일요일 자정까지 보내 주세요.'),
    SW('ext', 'me', 'So, by Sunday at midnight?', '그러니까 일요일 자정까지죠?'),
    SW('dorm', 'staff', 'Hello, Housing Office. How can I help?', '(영국) 안녕하세요, 기숙사 사무실이에요. 무엇을 도와드릴까요?'),
    SW('dorm', 'me', 'The heater in my room isn\'t working. Could you send someone to look at it?', '방의 난방기가 고장 났어요. 봐 줄 사람을 보내 주시겠어요?'),
    SW('dorm', 'staff', 'Right. And what\'s your room number?', '네. 방 번호가 어떻게 되세요?'),
    SW('dorm', 'me', 'It\'s Room 214, in Maple Hall.', '메이플 홀 214호예요.'),
    SW('ra', 'staff', 'Hey! What\'s up?', '(호주) 안녕! 무슨 일이야?'),
    SW('ra', 'me', 'My roommate plays loud music late at night, so I can\'t sleep. Could I get some advice?', '룸메이트가 밤늦게 음악을 크게 틀어서 잠을 못 자요. 조언을 좀 얻을 수 있을까요?'),
    SW('ra', 'staff', 'Would you like me to be there when you talk to them?', '얘기할 때 내가 같이 있어 줄까?'),
    SW('ra', 'me', 'Yes, please. That would really help.', '네, 그래 주세요. 정말 도움이 될 거예요.'),
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: key 열쇠 낱말 · frame 대답 틀 · slot 내 정보 · pol 공손한 말 · trap 함정 · ok 정답
     ========================================================= */
  const LL = k => `(${L4[k]})`;
  CM.judgeItem = (it, k) => CM.judge(it.Q, it.opts[k], it.card, '상황');
  const CARD_SKIP = { task: 1, alt: 1, due: 1 };
  const cardSay = c => Object.keys(c || {}).filter(k => !CARD_SKIP[k] && c[k] !== undefined).map(k => CM.factKo(k, c[k])).join(' · ');
  const segMarks = (a, k, roleOf) => CM.segs(a).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).map(s => ({ t: s.t.trim().replace(/^[,.?!]+|[,.?!]+$/g, ''), role: roleOf(s), at: k })).filter(m => m.t);
  const tagKo = j => j.tag === 'fact' ? '상황 · 들은 말과 다른 정보' : j.tag === 'need' ? '사실만 말하고 부탁이 빠지거나 되짚지 않음' : j.tag === 'order' ? '순서가 뒤섞임' : j.tag === 'wrong' ? '틀린 문장 · 짝이 맞지 않는 대답' : '한국어 그대로 옮긴 말 · 콩글리시';
  CM.steps = function (it) {
    const q = it.Q, J = it.opts.map((_, k) => CM.judgeItem(it, k)), at = s => it.opts.map((_, k) => k).filter(k => J[k].stage === s);
    const best = it.opts[it.a], SHp = CM.SHAPE[q.shape], C = Object.assign({}, it.card || {}, q.fact || {});
    // ①
    let t1;
    if (q.fast) t1 = '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 말했는지 모르면 짐작해서 답하지 말고 다시 물어요. 들린 낱말이 있으면 그 부분만 되물어요.';
    else t1 = `열쇠 낱말 ${q.key.join(' … ')} → ${SHp.ko}(${SHp.mark}). ${CM.sayOf(q.intent)}. ${CM.INTENT[q.intent].want}`;
    if (at(1).length) t1 += ' ' + at(1).map(k => LL(k)).join(' · ') + (q.fast ? ' → 짐작한 대답이거나 다른 말을 되물어 탈락.' : J[at(1)[0]].tag === 'shape' ? ' → 모양이 맞지 않거나 다른 질문의 대답이라 탈락.' : ' → 다른 질문에 맞는 대답이라 탈락.');
    const m1 = q.fast ? [] : q.key.map(t => ({ t, role: 'key', at: 'q' }));
    at(1).forEach(k => m1.push({ t: CM.text(it.opts[k]).replace(/[.?!]$/, ''), role: 'trap', at: k }));
    // ②
    const sit = cardSay(it.card);
    const Fb = CM.FRAME[best.f], ft = Fb.line ? '(Professor Hale,) 까닭(사실). + Would it be possible to get + 바라는 것?' : Fb.t ? Fb.t.replace(/[{}]/g, '').replace('___', '…') : CM.text(best);
    let t2 = (q.fast ? '상황 → 처음 듣고 다 알아듣지 못했어요. ' : sit ? `상황 → ${sit}. ` : '') + `맞는 틀 → ${ft}`;
    if (at(2).length) t2 += ' · ' + at(2).map(k => `${LL(k)} ${tagKo(J[k])}`).join(' · ') + ' → 탈락.';
    else t2 += ' · 틀과 정보가 모두 맞는 보기만 남았어요.';
    const m2 = [];
    it.opts.forEach((a, k) => {
      if (J[k].stage === 1) return;
      const F = CM.FRAME[a.f];
      if (F.line) {
        const lo = CM.checkLine(a.line, C), wrong = lo.err ? lo.err.word.t : null, badW = (a.line.words || []).map(w => CM.OW[w]).find(x => x && x.bad);
        CM.lineSegs(a.line).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).forEach(s => { const t = s.t.trim(); m2.push({ t, role: J[k].stage === 2 && (t === wrong || (badW && badW.bad === 'literal' && t === badW.t) || (lo.tag === 'order' && s.part)) ? 'trap' : s.r === 'frame' ? 'frame' : s.r === 'pol' ? 'frame' : 'slot', at: k }); });
        return;
      }
      const trapOf = s => J[k].stage !== 2 ? false : J[k].tag === 'fact' ? (F.slot ? s.r === 'slot' : s.r === 'frame') : s.r === 'frame' || s.r === 'slot';
      segMarks(a, k, s => s.r === 'pol' ? '' : trapOf(s) ? 'trap' : s.r).forEach(m => { if (m.role) m2.push(m); });
    });
    // ③
    let t3 = at(3).length ? at(3).map(k => `${LL(k)} ${CM.text(it.opts[k])} → ${J[k].tag === 'plain' ? '고맙다는 말 없이 끊김' : '명령 · 조르는 말 · 퉁명스러운 말'}`).join(' · ') + ' → 탈락. ' : '무례하게 들리는 보기는 없어요. ';
    t3 += `정답 ${LL(it.a)} → ${J[it.a].why}`;
    const m3 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 3) segMarks(a, k, () => 'trap').forEach(m => m3.push(m)); else if (J[k].stage === 0) segMarks(a, k, s => s.r === 'pol' ? 'pol' : '').forEach(m => { if (m.role) m3.push(m); }); });
    m3.push({ t: CM.text(it.opts[it.a]), role: 'ok', at: it.a, whole: true });
    return [
      { head: '① 열쇠 낱말 + 질문의 모양 잡기', text: t1, marks: m1 },
      { head: '② 틀에 내 정보 넣기', text: t2, marks: m2 },
      { head: '③ 공손하게 끝내기', text: t3, marks: m3 },
    ];
  };
  CM.notes = it => it.opts.map((_, k) => { const j = CM.judgeItem(it, k); return (j.ok ? '' : `× ${['', '①', '②', '③'][j.stage]} `) + j.why; });

  /* =========================================================
     데이터 점검 — 문제 데이터와 엔진이 어긋나면 콘솔 경고
     ========================================================= */
  CM.check = function () {
    const bad = [];
    const hasT = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase());
    Object.values(CM.Q).forEach(q => {
      if (!CM.PLACE[q.place]) bad.push(`말 ${q.id}: 곳 ${q.place}가 없어요`);
      if (!CM.INTENT[q.intent]) bad.push(`말 ${q.id}: 뜻 ${q.intent}가 없어요`);
      q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`말 ${q.id}: 열쇠 낱말 ‘${k}’가 말에 없어요`); });
      if (CM.shapeGuess(q.en) !== q.shape) bad.push(`말 ${q.id}: 적어 둔 모양 ${q.shape} · 글의 모양 ${CM.shapeGuess(q.en)}`);
      if (q.shape === 'or') { if (!q.choices || q.choices.length < 2) bad.push(`말 ${q.id}: 고르는 질문에 choices가 없어요`); else { const In = CM.INTENT[q.intent], S = Object.values(CM.SLOT).find(s => s.key === In.key); q.choices.forEach(c => { if (!S || !S.vals[c]) bad.push(`말 ${q.id}: 고를 것 ${c}가 칸에 없어요`); }); } }
      if (q.shape === 'yn' && !q.fast && !q.aux && !CM.INTENT[q.intent].offer) bad.push(`말 ${q.id}: Yes/No 질문에 짝(aux)이 없어요`);
      if (q.aux) { const first = String(q.en).match(/[^.!?]*\?/g).pop().trim().split(/\s+/)[0].toLowerCase(); if (!q.fast && first !== CM.AUX_FIRST[q.aux]) bad.push(`말 ${q.id}: 짝 ${q.aux} · 첫 낱말 ${first}`); }
      if (q.intent === 'need' && !(q.fact && q.fact.task)) bad.push(`말 ${q.id}: 용건 질문에 곳(task)이 없어요`);
      if (q.fast && !CM.FRAME[{ need: 'rp_need', wl: 'rp_wl', oh: 'rp_oh', due: 'rp_due', room: 'rp_room', talk: 'rp_talk' }[q.intent]]) bad.push(`말 ${q.id}: 빠른 말을 되묻는 틀이 없어요`);
    });
    Object.values(CM.FRAME).forEach(F => {
      [].concat(F.intent).forEach(i => { if (i !== 'yn' && i !== 'repair' && !CM.INTENT[i]) bad.push(`틀 ${F.id}: 뜻 ${i}가 없어요`); });
      if (F.slot && !CM.SLOT[F.slot]) bad.push(`틀 ${F.id}: 칸 ${F.slot}이 없어요`);
      if (F.slot && !/___/.test(F.t)) bad.push(`틀 ${F.id}: 칸이 있는데 ___가 없어요`);
      if ((F.tag !== 'ok' || F.half || F.skip) && !F.why) bad.push(`틀 ${F.id}: 함정 틀에 까닭(why)이 없어요`);
      if (F.aux && !CM.AUX[F.aux]) bad.push(`틀 ${F.id}: 짝 ${F.aux}가 없어요`);
      if (F.slot && /___/.test(F.ko)) { const v = CM.SLOT[F.slot].dyn ? { wl: '13', oh: 'tt', room: '214-maple' }[CM.SLOT[F.slot].dyn] : slotIds(F.slot)[0]; const k = CM.ko({ f: F.id, v }); if (/___|\s\./.test(k)) bad.push(`틀 ${F.id}: 해석이 어색해요 (${k})`); }
    });
    Object.entries(CM.INTENT).forEach(([k, In]) => { if (In.best && typeof In.best === 'string' && !CM.FRAME[In.best]) bad.push(`뜻 ${k}의 모범 틀 ${In.best}가 없어요`); });
    Object.values(CM.OW).forEach(w => { if (!CM.OCAT[w.c]) bad.push(`부탁 조각 ${w.t}: 갈래 ${w.c}가 없어요`); if (w.bad && !w.why) bad.push(`부탁 조각 ${w.t}: 까닭이 없어요`); });
    // 숫자 읽기 · 함정 숫자
    [[318, 'three-eighteen'], [210, 'two-ten'], [201, 'two-oh-one'], [214, 'two-fourteen'], [517, 'five-seventeen'], [245, 'two-forty-five']].forEach(([n, t]) => { if (CM.roomWords(n) !== t) bad.push(`번호 읽기 ${n}: ${CM.roomWords(n)}`); });
    [[13, 30], [14, 40], [16, 60], [30, 13]].forEach(([n, t]) => { if (CM.teenSwap(n) !== t) bad.push(`teen · ty ${n}: ${CM.teenSwap(n)}`); });
    [[318, 380], [214, 240], [517, 570], [416, 460], [215, 250]].forEach(([n, t]) => { if (CM.tailSwap(n) !== t) bad.push(`끝 두 자리 teen · ty ${n}: ${CM.tailSwap(n)}`); });
    [[210, 201], [245, 254], [260, 206]].forEach(([n, t]) => { if (CM.digitSwap(n) !== t) bad.push(`과목 번호 함정 ${n}: ${CM.digitSwap(n)}`); });
    CM.COURSE_IDS.forEach(n => { if (CM.COURSE_IDS.includes(CM.digitSwap(n))) bad.push(`과목 번호 함정 ${n}이 다른 과목과 같아요`); });
    CM.ROOMS.forEach(r => { if (CM.ROOMS.includes(ROOM_TRAP(r)) || ROOM_TRAP(r) === r) bad.push(`방 번호 함정 ${r}: ${ROOM_TRAP(r)}`); });
    CM.OH_IDS.forEach(id => { const a = CM.ohParse(id), r = CM.ohParse(id + '~r'), d = CM.ohParse(id + '~d'); if (a.room === r.room || a.days === d.days || r.days !== a.days || d.room !== a.room) bad.push(`면담 시간 함정 ${id}`); });
    if (CM.dueOf(2) !== 'sun' || CM.dueOf(3) !== 'mon') bad.push('새 마감 계산이 달라요');
    [['three eighteen', '318'], ['two ten', '210'], ['two oh one', '201'], ['thirteen', '13'], ['thirty', '30'], ['two forty', '240'], ['five seventeen', '517'], ['nine', '9'], ['three hundred eighteen', '318']].forEach(([s, r]) => { if (!CM.canon(s).includes(r)) bad.push(`숫자 맞추기 ${s}: ${CM.canon(s).join(' ')}`); });
    [['I\'d like to register for English 210, please.', 'I\'d like to register for English two-ten, please.'], ['So, I\'m number 13?', 'So, I\'m number thirteen?'],
      ['My office hours are Tuesdays and Thursdays from 2 to 4, in Room 318.', 'My office hours are Tuesdays and Thursdays from two to four, in Room three-eighteen.'], ['It\'s Room 214, in Maple Hall.', 'It\'s Room two-fourteen, in Maple Hall.'],
      ['Someone will come by tomorrow between 9 and 11.', 'Someone will come by tomorrow between nine and eleven.']].forEach(([s, w]) => { if (CM.spoken(s) !== w) bad.push(`읽을 글: ${CM.spoken(s)}`); });
    // 부탁 한 줄: 까닭 · 날수마다 모범 줄 · 말로 한 줄 · 함정 조각
    CM.WHY_IDS.forEach(why => [2, 3].forEach(days => {
      const C = { why, days, ask: 'ext' }, ml = CM.modelLine(C), jl = CM.checkLine(ml.line, C);
      if (!jl.ok) bad.push(`부탁 한 줄 ${why} ${days}: 모범 줄이 탈락 (${CM.lineText(ml.line)})`);
      [CM.spoken(CM.lineText(ml.line)), CM.lineText(ml.line)].forEach(t => { const pl = CM.parseLine(t); if (JSON.stringify(pl) !== JSON.stringify(ml.line.words)) bad.push(`부탁 한 줄 ${why} ${days}: 말로 한 줄을 다르게 읽어요 (${pl.join(' ')})`); });
      if (CM.coveredBy(CM.lineFacts(ml.line), 'else').join() !== 'else,days') bad.push(`부탁 한 줄 ${why} ${days}: 날수를 말했는데 ‘며칠 더’를 건너뛰지 않아요`);
    }));
    const DC = { why: 'sick', days: 2, ask: 'ext' }, lc = (w, words, f) => { const r = CM.checkLine({ words }, DC); if (!f(r)) bad.push(`부탁 한 줄 ${w}: ${JSON.stringify({ ok: r.ok, stage: r.stage, tag: r.tag, note: r.note, err: r.err && r.err.type, missing: r.missing })}`); return r; };
    lc('맞는 줄', CM.LINE.words, r => r.ok && !r.note);
    lc('부르는 말 없이', ['sick', 'wibp', 'd2'], r => r.ok);
    lc('Could I get', ['hale', 'sick', 'cig', 'd2'], r => r.ok);
    lc('날수 없이', ['hale', 'sick', 'wibp', 'ext'], r => r.ok);
    lc('까닭이 뒤에', ['hale', 'wibp', 'd2', 'sick'], r => r.ok && r.note === 'after');
    lc('부르는 말이 끝에', ['sick', 'wibp', 'd2', 'hale'], r => r.ok);
    lc('Teacher', ['teacher', 'sick', 'wibp', 'd2'], r => !r.ok && r.stage === 2 && r.tag === 'literal');
    lc('report', ['hale', 'sick', 'wibp', 'rep'], r => !r.ok && r.stage === 2 && r.tag === 'literal');
    lc('까닭 빠짐', ['hale', 'wibp', 'd2'], r => !r.ok && r.tag === 'need' && r.missing.join() === 'why');
    lc('부탁 틀 빠짐', ['hale', 'sick', 'd2'], r => !r.ok && r.tag === 'need' && r.missing.join() === 'ask');
    lc('바라는 것 빠짐', ['hale', 'sick', 'wibp'], r => !r.ok && r.tag === 'need' && r.missing.join() === 'want');
    lc('사실만', ['hale', 'sick'], r => !r.ok && r.tag === 'need');
    lc('차례', ['hale', 'sick', 'd2', 'wibp'], r => !r.ok && r.tag === 'order');
    lc('두 번', ['hale', 'sick', 'sick', 'wibp', 'd2'], r => !r.ok && r.tag === 'order');
    lc('다른 까닭', ['hale', 'exams', 'wibp', 'd2'], r => !r.ok && r.tag === 'fact' && r.err.type === 'why');
    lc('다른 날수', ['hale', 'sick', 'wibp', 'd3'], r => !r.ok && r.tag === 'fact' && r.err.type === 'days');
    lc('I want', ['hale', 'sick', 'iwant', 'd2'], r => !r.ok && r.stage === 3 && r.tag === 'blunt');
    if (CM.lineText(CM.LINE) !== 'Professor Hale, I was sick this week. Would it be possible to get a two-day extension on my essay?') bad.push(`부탁 한 줄 글: ${CM.lineText(CM.LINE)}`);
    if (CM.lineText({ words: ['sick', 'wibp', 'd2', 'hale'] }) !== 'I was sick this week. Would it be possible to get a two-day extension on my essay, Professor Hale?') bad.push(`부탁 한 줄 글 (끝에 부르는 말): ${CM.lineText({ words: ['sick', 'wibp', 'd2', 'hale'] })}`);
    if (!/Professor Hale/.test(CM.fixLine({ words: ['teacher', 'sick', 'wibp', 'd2'] }, DC).en)) bad.push('고쳐 주는 말 (Teacher)');
    if (!/essay/.test(CM.fixLine({ words: ['hale', 'sick', 'wibp', 'rep'] }, DC).en)) bad.push('고쳐 주는 말 (report)');
    if (!/why/.test(CM.fixLine({ words: ['hale', 'wibp', 'd2'] }, DC).en)) bad.push('고쳐 주는 말 (까닭)');
    if (!/fine/.test(CM.fixLine(CM.LINE, DC).en)) bad.push('고쳐 주는 말 (맞음)');
    // 연습 문제
    const pos = [0, 0, 0, 0];
    CM.DRILL.forEach((it, i) => {
      const w = `듣고 대답 고르기 ${i + 1}`;
      if (!it.Q) { bad.push(`${w}: 말 ${it.q}가 없어요`); return; }
      const good = it.opts.map((_, k) => k).filter(k => CM.judgeItem(it, k).ok);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]} (${it.opts.map((_, k) => CM.judgeItem(it, k).why).join(' | ')})`);
      const texts = it.opts.map(CM.text);
      if (new Set(texts).size !== texts.length) bad.push(`${w}: 같은 보기가 있어요`);
      if (!it.sit) bad.push(`${w}: 상황 글이 없어요`);
      const st = CM.steps(it); if (st.length !== 3 || st.some(s => !s.text)) bad.push(`${w}: 풀이 단계가 비었어요`);
      pos[it.a]++;
    });
    if (CM.DRILL.length !== 16) bad.push(`듣고 대답 고르기 ${CM.DRILL.length}문제`);
    if (Math.max(...pos) - Math.min(...pos) > 0) bad.push(`듣고 대답 고르기 정답 위치가 몰려 있어요: ${pos.join(',')}`);
    const places = new Set(CM.DRILL.map(it => it.place));
    CM.PLACES.forEach(p => { if (!places.has(p.id)) bad.push(`듣고 대답 고르기: ${p.ko} 문제가 없어요`); });
    if (CM.DRILL.filter(it => it.Q.fast).length < 2) bad.push('듣고 대답 고르기: 빠른 말(다시 묻기) 문제가 둘보다 적어요');
    const yesTrap = CM.DRILL.filter(it => (it.Q.shape === 'or' || it.Q.shape === 'wh') && it.opts.some(a => CM.FRAME[a.f].bare)).length;
    if (yesTrap < 4) bad.push(`듣고 대답 고르기: 고르는 · 정보 질문에 Yes 함정이 있는 문제가 ${yesTrap}개뿐이에요`);
    if (!CM.DRILL.some(it => !it.Q.fast && it.opts.some(a => a.f === 'line'))) bad.push('듣고 대답 고르기: 부탁 한 줄 문제가 없어요');
    if (!CM.DRILL.some(it => it.opts.some((a, k) => { const j = CM.judgeItem(it, k); return j.stage === 2 && j.tag === 'wrong' && CM.FRAME[a.f].aux; }))) bad.push('듣고 대답 고르기: 짝이 다른 짧은 대답 문제가 없어요');
    Object.entries(CM.MINI).forEach(([k, it]) => { const good = it.opts.map((_, i) => i).filter(i => CM.judgeItem(it, i).ok); if (good.length !== 1 || good[0] !== it.a) bad.push(`직접 해 보기 ${k}: 맞는 보기 ${good}`); });
    // 영상 · 직접 해 보기의 대화가 판정과 맞나
    const want = (w, q, a, c, ok) => { const j = CM.judge(q, a, c); if (j.ok !== ok) bad.push(`${w}: ${CM.text(a)} → 판정 ${j.ok ? '✓' : '×'} (${j.why})`); return j; };
    const D = CM.DEMO, SC = CM.SCENE, I0 = CM.INTRO, seq = (w, row, oks, c = D) => oks.forEach((ok, k) => want(`${w} ${k + 1}`, row[0], row[k + 1], c, ok));
    want('00장 apply', I0.q, I0.bad, I0.card, false); want('00장 register for', I0.q, I0.ok, I0.card, true);
    want('00장 Teacher', I0.dq, I0.dbad, D, false); want('00장 office hours', I0.dq, I0.dok, D, true);
    want('00장 되짚지 않음', I0.rq, I0.skip, D, false); want('00장 번호 되짚기', I0.rq, I0.check, D, true);
    seq('02장 용건', SC.need, [false, false, false, true]); seq('02장 과목 번호', SC.course, [false, true]); seq('02장 반', SC.sec, [false, false, true]);
    seq('02장 들어 본 수업', SC.taken, [false, true]); seq('02장 안 들어 봄', SC.notaken, [false, true], Object.assign({}, D, { taken: false })); seq('02장 빠른 말', SC.rfast, [false, true]);
    seq('03장 정원', SC.full, [false, false, false, false, true]); seq('03장 다른 반', SC.other, [false, true], Object.assign({}, D, { full: 'other' })); seq('03장 대기 번호', SC.wl, [false, false, true]); seq('03장 빠른 말', SC.wfast, [false, true]);
    seq('04장 묻기', SC.ask, [false, false, false, true]); seq('04장 면담 시간', SC.oh, [false, false, false, true]); seq('04장 빠른 말', SC.ofast, [false, true]);
    seq('05장 용건', SC.help, [false, false, false, true]); seq('05장 고르기', SC.part, [false, false, true]); seq('05장 해 본 것', SC.tried, [false, true, true]);
    SC.lines.forEach(([k, a]) => want(`06장 부탁 한 줄 ${k}`, 'ex_else', a, D, k === 'ok' || k === 'after'));
    seq('06장 더 할 말', SC.else, [false, false, true]); seq('06장 며칠 더', SC.days, [false, false, true]); seq('06장 새 마감', SC.due, [false, false, true]); seq('06장 빠른 말', SC.dfast, [false, true]);
    seq('07장 용건', SC.fix, [false, false, false, true]); seq('07장 방 번호', SC.room, [false, false, false, true]); seq('07장 빠른 말', SC.rfast2, [false, true]);
    seq('07장 들어가도 되나', SC.enter, [false, true, true]); seq('07장 내가 있을 때', SC.noenter, [false, true], Object.assign({}, D, { enter: false })); seq('07장 수리 시간', SC.visit, [false, false, true]);
    seq('08장 용건', SC.adv, [false, false, false, true]); seq('08장 이야기해 봤나', SC.talk, [false, true]); seq('08장 빠른 말', SC.tfast, [false, true]); seq('08장 RA가 함께', SC.with, [false, true, true]);
    { const j = CM.judge('reg_taken', SC.taken[1], D); if (j.stage !== 2 || j.tag !== 'wrong') bad.push(`02장 짝: ${j.stage}단계 ${j.tag}`); }
    { const j = CM.judge('oh_read', SC.part[2], D); if (j.stage !== 1 || j.tag !== 'choice') bad.push(`05장 고르기: ${j.stage}단계 ${j.tag}`); }
    { const j = CM.judge('dm_help', SC.fix[1], D); if (j.stage !== 2 || j.tag !== 'literal') bad.push(`07장 boiler: ${j.stage}단계 ${j.tag}`); }
    [['fl_full', CM.Q.fl_full.en], ['fl_wl', CM.Q.fl_wl.en], ['cl_oh', CM.Q.cl_oh.en], ['ex_due', CM.Q.ex_due.en], ['dm_visit', CM.Q.dm_visit.en]].forEach(([id, en]) => { if (CM.simQ(id, D).en !== en) bad.push(`DEMO와 말이 달라요 ${id}: ${CM.simQ(id, D).en}`); });
    CM.METHOD.forEach(([q, a, c], i) => want(`09장 ${i + 1}`, q, a, Object.assign({}, D, c), true));
    if (CM.METHOD.length !== CM.PLACES.length || CM.METHOD.some(([q], i) => CM.Q[q].place !== CM.PLACES[i].id)) bad.push('09장: 곳마다 한 줄이 아니에요');
    // 실전: 지워지는 단계가 줄 글과 맞나
    CM.PRACTICE.forEach((p, i) => {
      const w = `실전 ${i + 1}`, q = CM.practiceQ(p);
      const J = p.opts.map(a => CM.judge(q, a, CM.PCARD));
      const good = J.map((j, k) => j.ok ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== p.a) bad.push(`${w}: 맞는 보기 ${good}`);
      [1, 2, 3].forEach(st => {
        const gone = J.map((j, k) => j.stage === st ? LL(k) : null).filter(Boolean).sort().join();
        const said = (p.lines[st - 1].match(/\([A-D]\)/g) || []).filter(x => st < 3 || x !== LL(p.a)).sort().join();
        if (gone !== said) bad.push(`${w} ${st}단계: 엔진 ${gone || '-'} · 화면 ${said || '-'}`);
      });
      if (!p.lines[2].includes(`정답 ${LL(p.a)}`)) bad.push(`${w}: 정답 표시가 달라요`);
      if (!p.lines[2].includes(CM.text(p.opts[p.a]).replace(/\.$/, ''))) bad.push(`${w}: 정답 글이 달라요 (${CM.text(p.opts[p.a])})`);
    });
    // 시뮬레이터: 카드 여럿 — 모범 대답은 통과, 틀 칩 가운데 맞는 것이 하나뿐인지, 모범 대답을 말로 해도 통과하는지
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 60; n++) {
      const c = CM.newCard(rnd), rowText = CM.cardRows(c).map(r => r.join(' ')).join(' ');
      [CM.OHS[c.oh].ko, CM.DUES[c.due].ko, CM.VISITS[c.visit].ko, `${c.wl}번`].forEach(x => { if (rowText.includes(x)) bad.push(`시뮬레이터: 들어야 할 것(${x})이 카드에 보여요`); });
      CM.simQs(c).forEach(id => {
        const q = CM.simQ(id, c), C = Object.assign({}, c, q.fact || {}), m = CM.model(q, C), j = CM.judge(q, m, C);
        if (!j.ok) bad.push(`시뮬레이터 ${id}: 모범 대답이 탈락 (${CM.text(m)} · ${j.why})`);
        const ms = CM.matchSpoken(CM.spoken(CM.text(m)), q, C);
        if (!ms.ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 말로 해도 통과하지 못해요 (${CM.text(m)} · ${ms.why})`);
        const ms2 = CM.matchSpoken(CM.text(m), q, C);
        if (!ms2.ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 숫자 그대로 받아 적어도 통과하지 못해요 (${CM.text(m)} · ${ms2.why})`);
        if (CM.shapeGuess(q.en) !== q.shape) bad.push(`시뮬레이터 ${id}: 모양 ${q.shape} · 글 ${CM.shapeGuess(q.en)} (${q.en})`);
        q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`시뮬레이터 ${id}: 열쇠 낱말 ‘${k}’가 말에 없어요 (${q.en})`); });
        const fr = CM.simFrames(q.intent, C);
        if (!fr) { bad.push(`시뮬레이터 ${id}: 틀 칩이 없어요`); return; }
        if (q.intent === 'else') {
          const chips = CM.lineChips(C, rnd), mw = m.line.words;
          if (chips.length !== mw.length) bad.push(`시뮬레이터 부탁 한 줄: 조각 자리 ${chips.length} · 모범 조각 ${mw.length}`);
          chips.forEach((g, k) => {
            if (!g.ids.includes(mw[k])) bad.push(`시뮬레이터 부탁 한 줄: ${k + 1}번째 자리에 맞는 조각(${mw[k]})이 없어요 (${g.ids})`);
            g.ids.filter(x => x !== mw[k]).forEach(x => { const w2 = mw.map((y, i) => i === k ? x : y); if (!CM.OW[x]) bad.push(`시뮬레이터 부탁 한 줄: 조각 ${x}가 없어요`); else if (CM.judge(q, L(w2), C).ok) bad.push(`시뮬레이터 부탁 한 줄: 함정 조각 ${x}가 통과해요`); });
          });
          ['el_no', 'g_yes'].forEach(f => { if (CM.judge(q, o(f), C).ok) bad.push(`시뮬레이터 부탁 한 줄: ${f}가 통과해요`); });
          return;
        }
        const okN = fr.filter(f => { const F = CM.FRAME[f]; if (!F.slot) return CM.judge(q, { f }, C).ok; return CM.slotChoices(F.slot, C, rnd, q).some(v => CM.judge(q, { f, v }, C).ok); }).length;
        if (okN !== 1) bad.push(`시뮬레이터 ${id}: 맞는 틀이 ${okN}개예요 (${fr.join(',')})`);
        fr.forEach(f => { const F = CM.FRAME[f]; if (F.slot && !CM.slotChoices(F.slot, C, rnd, q).length) bad.push(`시뮬레이터 ${id}: ${f}의 칸 칩이 없어요`); });
        if (!fr.includes(m.f)) bad.push(`시뮬레이터 ${id}: 틀 칩에 모범 틀(${m.f})이 없어요`);
        const F = CM.FRAME[m.f];
        if (F.slot) { const ch = CM.slotChoices(F.slot, C, rnd, q), okv = ch.filter(v => CM.judge(q, { f: m.f, v }, C).ok); if (okv.length !== 1) bad.push(`시뮬레이터 ${id}: ${m.f}의 칸 칩 가운데 맞는 값이 ${okv.length}개예요 (${ch})`); if (ch.length < 2) bad.push(`시뮬레이터 ${id}: ${m.f}의 칸 칩이 ${ch.length}개뿐이에요`); }
      });
    }
    // 말로 대답하기: 모양 · 다른 값 · 콩글리시 · 짐작은 통과하지 않아야
    const rep = (w, raw, q, c, k) => { const r = CM.matchSpoken(raw, q, c); if (r.ok || r.repair !== k) bad.push(`말로 대답하기 ${w}: ‘${raw}’ → ${r.ok ? '통과' : r.repair || '탈락'} (${r.why})`); return r; }, nope = (w, raw, q, c) => { const r = CM.matchSpoken(raw, q, c); if (r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과해요`); return r; }, yep = (w, raw, q, c) => { const r = CM.matchSpoken(raw, q, c); if (!r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과하지 않아요 (${r.why})`); return r; };
    Object.values(CM.Q).filter(q => (q.shape === 'or' || q.shape === 'wh') && !q.fast).forEach(q => { ['yes', 'yes please', 'yeah sure'].forEach(y => nope(`${q.id} ${y}`, y, q, D)); });
    Object.values(CM.Q).filter(q => q.shape === 'note' && !q.fast).forEach(q => nope(`${q.id} okay`, 'Okay, thanks.', q, D));
    yep('수강 신청', 'I\'d like to register for English two ten, please.', 'reg_help', D); yep('수강 신청 숫자', 'I\'d like to register for English 210, please.', 'reg_help', D);
    nope('apply', 'I want to apply English 210.', 'reg_help', D); nope('201', 'I\'d like to register for English two oh one, please.', 'reg_help', D); nope('교환학생만', 'I\'m an exchange student.', 'reg_help', D);
    yep('오전 반', 'The morning section, please.', 'reg_sec', D); nope('오후 반', 'The afternoon section, please.', 'reg_sec', D);
    yep('들어 봄', 'Yes, I have. I took a similar class in Korea.', 'reg_taken', D); yep('안 들어 봄', 'No, I haven\'t. Could I still sign up?', 'reg_taken', { taken: false }); nope('안 들어 봄만', 'No, I haven\'t.', 'reg_taken', { taken: false });
    yep('대기 명단', 'Could you put me on the waitlist, please?', 'fl_full', D); yep('다른 반', 'Could I join the afternoon section instead?', 'fl_full', { full: 'other' }); nope('다 찬 반', 'Could I join the morning section instead?', 'fl_full', { full: 'other' }); nope('reservation', 'Can I make a reservation for the class?', 'fl_full', D);
    yep('대기 번호', 'So, I\'m number thirteen?', 'fl_wl', D); yep('대기 번호 숫자', 'So, I\'m number 13?', 'fl_wl', D); nope('thirty', 'So, I\'m number thirty?', 'fl_wl', D);
    rep('빠른 대기 번호 되묻기', 'Sorry, what number am I on the waitlist?', 'fl_fast', D, 'again'); nope('빠른 대기 번호 짐작', 'So, I\'m number thirteen?', 'fl_fast', D);
    yep('면담 시간 묻기', 'Yes. Could you tell me when your office hours are?', 'cl_q', D); nope('Teacher', 'Teacher, when is your office time?', 'cl_q', D); nope('Yes만', 'Yes.', 'cl_q', D);
    yep('면담 시간 되짚기', 'So, Tuesdays and Thursdays, in Room three eighteen?', 'cl_oh', D); nope('380', 'So, Tuesdays and Thursdays, in Room three eighty?', 'cl_oh', D); nope('다른 요일', 'So, Mondays and Wednesdays, in Room 318?', 'cl_oh', D);
    rep('빠른 면담 되묻기', 'Sorry, when are your office hours?', 'cl_fast', D, 'again'); rep('다른 말 되묻기', 'Sorry, when is the new deadline?', 'cl_fast', D, undefined);
    yep('면담 용건', 'I\'m having trouble with the readings. Could you give me some advice?', 'oh_help', D); nope('사실만', 'I\'m having trouble with the readings.', 'oh_help', D); nope('에세이', 'I\'m having trouble with my essay. Could you give me some advice?', 'oh_help', D); nope('Teacher 면담', 'Teacher, I don\'t understand the class.', 'oh_help', D);
    yep('중심 생각', 'Mostly the main ideas.', 'oh_read', D); nope('묻지 않은 것', 'Mostly the topic.', 'oh_read', D);
    yep('써 봄', 'Yes, I have, but it didn\'t help much.', 'oh_tried', D); nope('안 써 봄', 'No, I haven\'t. I\'ll take a look at it.', 'oh_tried', D);
    yep('연장 부탁', 'Professor Hale, I was sick this week. Would it be possible to get a two day extension on my essay?', 'ex_else', D); yep('연장 부탁 Could I', 'I was sick this week. Could I get a two-day extension on my essay?', 'ex_else', D);
    nope('연장 부탁 Teacher', 'Teacher, I was sick this week. Would it be possible to get a two day extension on my essay?', 'ex_else', D); nope('연장 부탁 까닭 없음', 'Would it be possible to get a two-day extension on my essay?', 'ex_else', D);
    nope('연장 부탁 사흘', 'I was sick this week. Could I get a three-day extension on my essay?', 'ex_else', D); nope('연장 부탁 report', 'I was sick this week. Could I get more time for my report?', 'ex_else', D); nope('Yes만 연장', 'Yes.', 'ex_else', D);
    { const r = CM.matchSpoken('I was sick this week. Could I get an extension on my essay?', 'ex_else', D); if (!r.ok || r.covered.includes('days')) bad.push('말로 대답하기: 날수 없는 연장 부탁'); }
    yep('며칠 더', 'Just two more days, if possible.', 'ex_days', D); nope('during', 'During two days.', 'ex_days', D); nope('사흘 더', 'Just three more days.', 'ex_days', D);
    yep('새 마감', 'So, by Sunday at midnight?', 'ex_due', D); nope('월요일', 'So, by Monday at midnight?', 'ex_due', D);
    yep('고장', 'The heater in my room isn\'t working. Could you send someone to look at it?', 'dm_help', D); nope('boiler', 'The boiler in my room isn\'t working. Could you send someone?', 'dm_help', D); nope('고장 사실만', 'The heater in my room isn\'t working.', 'dm_help', D); nope('샤워기', 'The shower in my room isn\'t working. Could you send someone to look at it?', 'dm_help', D);
    yep('방 번호', 'It\'s Room two fourteen, in Maple Hall.', 'dm_room', D); nope('240', 'It\'s Room two forty, in Maple Hall.', 'dm_room', D); nope('다른 건물', 'It\'s Room 214, in Cedar Hall.', 'dm_room', D); nope('기숙사만', 'I live in a dormitory.', 'dm_room', D);
    rep('maintenance 묻기', 'Sorry, what does maintenance mean?', 'dm_enter', D, 'what'); yep('들어와도 됨', 'Yes, that\'s fine.', 'dm_enter', D); yep('내가 있을 때', 'Actually, I\'d rather be there, if that\'s okay.', 'dm_enter', { enter: false }); nope('No만', 'No.', 'dm_enter', { enter: false });
    yep('수리 시간', 'So, tomorrow between nine and eleven?', 'dm_visit', D); nope('다른 시간', 'So, tomorrow between one and three?', 'dm_visit', D);
    yep('RA 용건', 'My roommate plays loud music late at night, so I can\'t sleep. Could I get some advice?', 'ra_help', D); nope('Here is noisy', 'Here is too noisy.', 'ra_help', D); nope('문제만', 'My roommate plays loud music late at night.', 'ra_help', D);
    yep('얘기 안 해 봄', 'No, I haven\'t. I\'m not sure what to say.', 'ra_talk', D); nope('얘기해 봄', 'Yes, I have, but nothing changed.', 'ra_talk', D);
    yep('RA가 함께', 'Yes, please. That would really help.', 'ra_with', D); nope('혼자', 'No, thanks. I\'ll try talking to them first.', 'ra_with', D);
    // 따라 말하기: 같은 말은 모두 맞아야 · 숫자 낱말로 말해도 맞아야
    CM.SHADOW.forEach((s, i) => { const r = CM.compareWords(s.en, s.en), r2 = CM.compareWords(s.en, CM.spoken(s.en)); if (r.hit !== r.total || r2.hit !== r2.total) bad.push(`따라 말하기 ${i + 1}: 같은 글이 다 맞지 않아요`); if (!CM.PLACE[s.place]) bad.push(`따라 말하기 ${i + 1}: 곳이 없어요`); });
    if (CM.SHADOW.length !== 28) bad.push(`따라 말하기 문장 수: ${CM.SHADOW.length}`);
    CM.PLACES.forEach(p => { if (CM.SHADOW.filter(s => s.place === p.id).length !== 4) bad.push(`따라 말하기: ${p.ko} 문장이 넷이 아니에요`); });
    bad.forEach(b => console.warn('[교환학생 생활] ' + b));
    return bad;
  };

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  CM.allText = function () {
    const out = [];
    Object.values(CM.Q).forEach(q => out.push(q.en, q.ko, q.short || ''));
    Object.values(CM.FRAME).forEach(F => out.push(F.t || '', F.ko || '', F.why || '', F.note || ''));
    Object.values(CM.SLOT).forEach(S => Object.values(S.vals || {}).forEach(v => out.push(Object.values(v).filter(x => typeof x === 'string').join(' '))));
    Object.values(CM.SHAPE).forEach(a => out.push(a.ko, a.mark, a.ans, a.say, a.offer || '')); Object.values(CM.INTENT).forEach(a => out.push(a.ans || '', a.want || '', a.say || '', a.turn || ''));
    Object.values(CM.AUX).forEach(a => out.push(a.q, a.a));
    CM.PLACES.forEach(p => out.push(p.ko, p.en, p.en.toUpperCase()));
    [CM.COURSES, CM.SECTIONS, CM.OHS, CM.TROUBLE, CM.PARTS, CM.WHYS, CM.DUES, CM.DAYS, CM.HALLS, CM.THINGS, CM.VISITS, CM.ISSUES].forEach(T => Object.values(T).forEach(x => out.push(Object.values(x).filter(v => typeof v === 'string').join(' '), String(x.t || '').toUpperCase())));
    CM.COURSE_IDS.forEach(n => out.push(String(n), String(CM.digitSwap(n)), CM.roomWords(n), CM.roomWords(CM.digitSwap(n))));
    CM.ROOMS.forEach(r => { out.push(CM.roomWords(r), CM.roomWords(ROOM_TRAP(r))); CM.HALL_IDS.forEach(h => out.push(CM.roomText(`${r}-${h}`), CM.roomKo(`${r}-${h}`))); });
    CM.OH_IDS.forEach(id => ['', '~r', '~d'].forEach(t => out.push(CM.ohText(id + t), CM.ohKo(id + t), CM.ohLine(id))));
    CM.WLS.forEach(n => out.push(String(n), String(CM.teenSwap(n)), CM.numWord(n), CM.numWord(CM.teenSwap(n))));
    CM.VISIT_IDS.forEach(v => out.push(CM.visitText(v)));
    CM.PRACTICE.forEach(p => out.push(p.lines.join(''))); CM.SHADOW.forEach(s => out.push(s.en, s.ko));
    CM.LINKED.forEach(l => out.push(l.en, l.ko, l.sound.map(s => s[0]).join(''))); CM.PAIRS.forEach(p => out.push(p.join('')));
    Object.values(CM.OCAT).forEach(c => out.push((c && c.ko) || '')); Object.values(CM.OW).forEach(w => out.push(w.t, w.ko || '', w.why || ''));
    out.push(CM.CITY, CM.UNI, CM.PROF, CM.HOUSING, CM.UNI.toUpperCase(), CM.HOUSING.toUpperCase(), CM.PROF.toUpperCase(),
      '0123456789.,:·+×–%→#-',
      'REGISTRATION OFFICE COURSE SECTION SEATS FULL WAITLIST OPEN CLOSED ENGLISH MON TUE WED THU FRI SAT SUN MORNING AFTERNOON OFFICE HOURS ROOM PROFESSOR SYLLABUS ESSAY DUE MIDNIGHT EXTENSION ' +
      'HOUSING OFFICE MAINTENANCE REQUEST HEATER SHOWER LIGHT WI-FI HALL RA RESIDENT ADVISOR QUIET HOURS ROOMMATE AGREEMENT STUDY GUIDE READINGS VOCABULARY MAIN IDEAS TOPIC STRUCTURE NEW DEADLINE TOMORROW BETWEEN AND');
    return out.join('');
  };
})();
