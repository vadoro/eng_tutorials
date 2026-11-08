/* 대중교통 회화 — 규칙 엔진과 대화 자료 (상황별 영어 회화)
 *
 * 기차표를 살 때는 매표소 직원이 차례대로 물어요. ‘어디까지요? 편도요, 왕복이요? 몇 분이세요?’
 * 그 질문의 모양(Yes/No · 고르는 질문 · 정보 질문)이 대답을 정해요 — 식당 튜토리얼과 같은 규칙이에요.
 * 지하철에서 갈아타는 길을 물으면 대답이 길고 빨라요. 그래서 들은 조각을 한 줄로 되짚어 확인해요 — 길 묻기 튜토리얼과 같은 규칙이에요.
 *   표는 묻는 대로   → Single or return? → Return, please.  (고르는 질문에 Yes만 하면 탈락)
 *   숫자는 되짚기     → It leaves at 10:15 from platform 4. → So, platform 4 at 10:15?
 *   갈아타기는 되짚기 → So, I take the Green Line towards East Pier, change at Central to the Blue Line, and get off at Museum?
 *
 * 규칙 엔진은 소리를 듣지 않고, 말마다 적어 둔 ‘뜻(intent) · 모양(shape)’과 ‘대답 틀(frame) + 내 정보(slot)’,
 * 그리고 여행 카드(또는 상황)의 사실을 맞춰 봐요. 지하철 길은 지어낸 노선도에서 계산해요(TR.route).
 *
 * 3단계 말하기 법 — TR.judge(상대의 말, 대답, 카드)
 *   ① 열쇠 낱말 + 질문의 모양 잡기 — 고르는 질문 · 정보 질문에 Yes · No만 하면 탈락, 고르는 질문이면 직원이 말한 것 가운데 골랐나,
 *                      대답이 그 말(intent)에 맞나. 빠르게 말해 못 알아들은 말(fast)이면 짐작한 대답은 탈락 → 다시 묻기
 *                      (안내방송은 다시 말해 주지 않으니 옆 사람에게 물어요)
 *   ② 틀에 내 정보 넣기 — 틀이 자연스러운가(한국어 그대로 · 콩글리시 · 틀린 문장이면 탈락), 역 · 표 · 사람 수가 카드와 맞나,
 *                      되짚은 숫자(승강장 · 시각 · 값)가 들은 것과 같나, 되짚은 길이 들은 길과 같고 빠진 조각 · 뒤섞인 순서가 없나
 *   ③ 공손하게 끝내기 — 명령 · 따지는 말(blunt)이나 고맙다는 말 없이 끊긴 말(plain)이면 탈락
 * judge → { ok, stage: 0 | 1 | 2 | 3, why, tag }
 *
 * 되짚는 한 줄: TR.checkLine(낱말, 카드) — So, I → take + 노선 → towards + 방향(종점) → change at + 역 → to + 노선 → get off at + 역
 *             TR.fixLine(낱말, 카드) — 틀린 첫 조각을 고쳐 주는 상대의 말(Not quite — change at Central.)
 * 노선도와 길: TR.LINES · TR.STN(지어낸 노선 셋 · 역 열다섯) · TR.route(출발, 도착) — 갈아타기가 적은 길 → 정거장이 적은 길
 * 값과 시각: TR.fare(카드) · TR.spoken($14.50 → fourteen fifty · 10:15 → ten fifteen)
 *
 * 영상의 ✓·×, 직접 해 보기, 여행 시뮬레이터, 듣고 대답 고르기, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 TR.check()가 콘솔에 경고를 내요.
 */
(function () {
  'use strict';
  const TR = (window.TR = {});
  const L4 = 'ABCD';

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s).replace(/\s*\([^()]*\)\s*$/, ''); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; if (/[0-9]/.test(s[i])) return '0136781'.includes(s[i]) ? 0xAC01 : 0xAC00; if (/[A-Za-z]/.test(s[i])) return /[lmnr]/i.test(s[i]) ? 0xAC01 : 0xAC00; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const rieul = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 === 8 : false; };
  const wa = s => s + (has(s) ? '과' : '와'), eul = s => s + (has(s) ? '을' : '를'), ig = s => s + (has(s) ? '이' : '가');
  const ro = s => s + (has(s) && !rieul(s) ? '으로' : '로'), ieyo = s => s + (has(s) ? '이에요' : '예요'), eun = s => s + (has(s) ? '은' : '는');
  TR.josa = { wa, eul, ig, ro, ieyo, eun };

  /* =========================================================
     역과 열차의 일곱 곳 (가는 차례). sp: 그곳 상대의 목소리 (voices.js)
     ========================================================= */
  TR.PLACES = [
    { id: 'counter', ko: '매표소 · 어디까지', en: 'Ticket office · Where to?', sp: 'us' },
    { id: 'ticket', ko: '표 종류 · 몇 명', en: 'Ticket type · How many', sp: 'gb' },
    { id: 'fare', ko: '할인 · 값', en: 'Discounts · The fare', sp: 'us' },
    { id: 'plat', ko: '승강장 · 출발 시각', en: 'Platform · Departure', sp: 'gb' },
    { id: 'info', ko: '지하철 안내 데스크', en: 'Metro information desk', sp: 'ca' },
    { id: 'route', ko: '갈아타기 안내', en: 'Transfer directions', sp: 'ca' },
    { id: 'train', ko: '승강장 · 열차 안', en: 'On the platform · On board', sp: 'au' },
  ];
  TR.PLACE = {}; TR.PLACES.forEach((p, i) => { p.i = i; TR.PLACE[p.id] = p; });
  TR.ME = 'me';
  TR.CITY = 'Kellport';                 // 지어낸 도시 이름
  TR.STATION = 'Kellport Central';      // 지어낸 기차역
  TR.METRO = 'Kellport Metro';          // 지어낸 지하철
  // 내가 먼저 말을 꺼내는 곳 (안내 데스크에서 길 묻기 · 승강장에서 열차 확인하기)
  TR.ME_FIRST = { info: 1, train: 1 };

  /* =========================================================
     질문의 모양 세 가지 (+ 안내). mark: 그림 이름 (scenes.js의 shape_yn · shape_or · shape_wh · shape_note)
     ========================================================= */
  TR.SHAPE = {
    yn: { ko: 'Yes/No 질문', mark: '스위치', ans: 'Yes · No + 한 마디', say: 'Yes/No 질문이에요. Yes · No에 한 마디를 더해요', offer: '권하는 말이면 원하는 것을 바로 말해도 돼요(Yes · No는 빼도 돼요)' },
    or: { ko: '고르는 질문', mark: '갈림길', ans: '고른 것 + please', say: '고르는 질문(A or B?)이에요. 상대가 말한 것 가운데 하나를 골라 말해요' },
    wh: { ko: '정보 질문', mark: '빈 상자', ans: '정보 + please', say: '정보 질문이에요. 묻는 정보를 채워 말해요' },
    note: { ko: '안내', mark: '말풍선', ans: '되짚기 · 내가 먼저 말할 차례', say: '질문이 아니라 알려 주는 말이에요' },
  };
  TR.shapeOf = q => (typeof q === 'string' ? TR.Q[q] : q).shape;
  // 글만 보고 짐작한 모양 (점검용): 물음표 문장 가운데 마지막 것 → or가 있으면 고르기, 의문사로 시작하면 정보, 아니면 Yes/No
  TR.shapeGuess = function (en) {
    const qs = String(en).match(/[^.!?]*\?/g);
    if (!qs) return 'note';
    let s = qs[qs.length - 1].trim().toLowerCase().replace(/^(and|so|great|okay|sure|perfect|thanks|now|no problem|hi|hey|hello|hiya|morning|right)[,!]?\s+/, '');
    if (/\bor\b/.test(s)) return 'or';
    if (/^(how|what|which|where|when|who|why)\b/.test(s)) return 'wh';
    return 'yn';
  };

  /* =========================================================
     숫자 읽기 — 값 · 시각 · 승강장 (화면 글 → 소리)
     ========================================================= */
  const NUMW = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };
  const numWord = n => n < 20 || (n < 100 && n % 10 === 0) ? NUMW[n] : n < 100 ? `${NUMW[n - n % 10]}-${NUMW[n % 10]}` : n < 1000 ? `${NUMW[Math.floor(n / 100)]} hundred${n % 100 ? ' ' + numWord(n % 100) : ''}` : String(n);
  TR.numWord = numWord;
  // 값 (센트): 매표소에서 말하는 꼴 — $14.50 → fourteen fifty · $20.00 → twenty dollars · $6.05 → six oh five
  TR.money = c => '$' + (c / 100).toFixed(2);
  TR.priceWords = c => { const d = Math.floor(c / 100), k = c % 100; return !k ? `${numWord(d)} dollar${d === 1 ? '' : 's'}` : `${numWord(d)} ${k < 10 ? 'oh ' + numWord(k) : numWord(k)}`; };
  TR.priceKo = c => { const d = Math.floor(c / 100), k = c % 100; return k ? `${d}달러 ${k}센트` : `${d}달러`; };
  // 시각: 10:15 → ten fifteen · 9:05 → nine oh five · 11:00 → eleven o'clock
  TR.timeWords = t => { const [h, m] = String(t).split(':').map(Number); return !m ? `${numWord(h)} o'clock` : m < 10 ? `${numWord(h)} oh ${numWord(m)}` : `${numWord(h)} ${numWord(m)}`; };
  TR.timeKo = t => { const [h, m] = String(t).split(':').map(Number); return m ? `${h}시 ${m}분` : `${h}시`; };
  // 소리 내어 읽을 글: 값 → 낱말 · 시각 → 낱말 · 승강장 같은 작은 숫자 → 낱말
  TR.spoken = s => String(s)
    .replace(/\$(\d+)\.(\d{2})/g, (m, d, c) => TR.priceWords(+d * 100 + +c))
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (m, h, mm) => TR.timeWords(`${h}:${mm}`))
    .replace(/\b(\d{1,2})\b/g, (m, d) => numWord(+d));
  // 헷갈리는 숫자 짝: 13~19 ↔ 30~90 (fourTEEN ↔ FORty)
  TR.teenSwap = n => n >= 13 && n <= 19 ? (n - 10) * 10 : n >= 30 && n <= 90 && n % 10 === 0 ? n / 10 + 10 : null;

  /* =========================================================
     기차 — 지어낸 행선지 셋 (값 단위: 센트, 어른 한 명). ret: 왕복 · 어린이는 반값 · 학생 카드는 20% 할인
     ========================================================= */
  TR.TOWNS = {
    oakbridge: { en: 'Oakbridge', ko: '오크브리지(Oakbridge)', single: 1450, ret: 2600 },
    millbrook: { en: 'Millbrook', ko: '밀브룩(Millbrook)', single: 1630, ret: 2900 },
    ashby: { en: 'Ashby', ko: '애슈비(Ashby)', single: 1800, ret: 3200 },
  };
  TR.TOWN_IDS = Object.keys(TR.TOWNS);
  // 사람 수: a = 어른 · c = 어린이
  TR.PARTY = {
    a1: { a: 1, c: 0, ko: '어른 한 명' }, a2: { a: 2, c: 0, ko: '어른 두 명' }, a3: { a: 3, c: 0, ko: '어른 세 명' },
    a1c1: { a: 1, c: 1, ko: '어른 한 명 · 어린이 한 명' }, a2c1: { a: 2, c: 1, ko: '어른 두 명 · 어린이 한 명' }, a2c2: { a: 2, c: 2, ko: '어른 두 명 · 어린이 두 명' },
  };
  TR.DISC_OFF = 20;
  TR.fare = function (c) {
    const T = TR.TOWNS[c.dest] || TR.TOWNS.oakbridge, P = TR.PARTY[c.party] || TR.PARTY.a1;
    const one = c.type === 'return' ? T.ret : T.single;
    let sum = one * P.a + Math.round(one / 2) * P.c;
    if (c.disc) sum = Math.round(sum * (100 - TR.DISC_OFF) / 1000) * 10;
    return sum;
  };
  TR.fareRows = function (c) {
    const T = TR.TOWNS[c.dest] || TR.TOWNS.oakbridge, P = TR.PARTY[c.party] || TR.PARTY.a1, one = c.type === 'return' ? T.ret : T.single, rows = [];
    rows.push({ k: 'adult', n: P.a, c: one * P.a, ko: `어른 ${P.a}명 × ${TR.money(one)}` });
    if (P.c) rows.push({ k: 'child', n: P.c, c: Math.round(one / 2) * P.c, ko: `어린이 ${P.c}명 × ${TR.money(Math.round(one / 2))} (반값)` });
    if (c.disc) rows.push({ k: 'disc', c: TR.fare(c) - rows.reduce((s, r) => s + r.c, 0), ko: `학생 카드 ${TR.DISC_OFF}% 할인` });
    return { rows, total: TR.fare(c) };
  };

  /* =========================================================
     지하철 — 지어낸 노선 셋 · 역 열다섯. at: 노선도의 칸(가로, 세로)
     갈아타는 역: Central(초록 · 파랑) · City Hall(초록 · 빨강) · University(파랑 · 빨강)
     ========================================================= */
  TR.LINES = {
    green: { name: 'Green Line', en: 'the Green Line', ko: '초록 노선(Green Line)', short: 'Green', hex: '#3FB06B', st: ['westfield', 'parkroad', 'central', 'cityhall', 'harbor', 'eastpier'] },
    blue: { name: 'Blue Line', en: 'the Blue Line', ko: '파랑 노선(Blue Line)', short: 'Blue', hex: '#3F8CE0', st: ['northgate', 'university', 'central', 'market', 'museum', 'southbay'] },
    red: { name: 'Red Line', en: 'the Red Line', ko: '빨강 노선(Red Line)', short: 'Red', hex: '#E0574B', st: ['lakeside', 'university', 'oldtown', 'cityhall', 'riverside', 'airport'] },
  };
  TR.LINE_IDS = Object.keys(TR.LINES);
  const STN = (id, en, at) => ({ id, en, ko: `${en} 역`, at });
  TR.STN = {};
  [STN('westfield', 'Westfield', [0, 3]), STN('parkroad', 'Park Road', [1, 3]), STN('central', 'Central', [2, 3]), STN('cityhall', 'City Hall', [4, 3]), STN('harbor', 'Harbor', [5, 3]), STN('eastpier', 'East Pier', [6, 3]),
    STN('northgate', 'North Gate', [2, 0]), STN('university', 'University', [2, 1]), STN('market', 'Market', [2, 4]), STN('museum', 'Museum', [2, 5]), STN('southbay', 'South Bay', [2, 6]),
    STN('lakeside', 'Lakeside', [0, 1]), STN('oldtown', 'Old Town', [3, 2]), STN('riverside', 'Riverside', [5, 4]), STN('airport', 'Airport', [6, 5])].forEach(s => { TR.STN[s.id] = s; });
  TR.STN_IDS = Object.keys(TR.STN);
  TR.linesAt = id => TR.LINE_IDS.filter(l => TR.LINES[l].st.includes(id));
  TR.HUBS = TR.STN_IDS.filter(id => TR.linesAt(id).length > 1);
  TR.TERMINALS = [].concat(...TR.LINE_IDS.map(l => { const s = TR.LINES[l].st; return [s[0], s[s.length - 1]]; }));
  // 한 노선에서 a → b로 갈 때의 방향(그 쪽 종점 이름)
  TR.towards = (line, a, b) => { const s = TR.LINES[line].st; return s.indexOf(b) > s.indexOf(a) ? s[s.length - 1] : s[0]; };
  TR.otherEnd = (line, t) => { const s = TR.LINES[line].st; return t === s[0] ? s[s.length - 1] : s[0]; };
  // 길 찾기 — 갈아타기 한 번 = 정거장 100개로 쳐서, 갈아타기가 적은 길 → 정거장이 적은 길
  TR.route = function (from, to) {
    if (!TR.STN[from] || !TR.STN[to] || from === to) return null;
    const key = (s, l) => s + '|' + l, dist = {}, prev = {}, open = [];
    TR.linesAt(from).forEach(l => { dist[key(from, l)] = 0; open.push([from, l]); });
    while (open.length) {
      open.sort((x, y) => dist[key(x[0], x[1])] - dist[key(y[0], y[1])]);
      const [s, l] = open.shift(), d = dist[key(s, l)];
      const nb = [];
      const st = TR.LINES[l].st, i = st.indexOf(s);
      if (i > 0) nb.push([st[i - 1], l, 1]); if (i < st.length - 1) nb.push([st[i + 1], l, 1]);
      TR.linesAt(s).filter(x => x !== l).forEach(x => nb.push([s, x, 100]));
      nb.forEach(([s2, l2, w]) => { const k = key(s2, l2); if (dist[k] == null || d + w < dist[k]) { dist[k] = d + w; prev[k] = [s, l]; open.push([s2, l2]); } });
    }
    const ends = TR.linesAt(to).map(l => [to, l]).filter(([s, l]) => dist[key(s, l)] != null).sort((x, y) => dist[key(x[0], x[1])] - dist[key(y[0], y[1])]);
    if (!ends.length) return null;
    const path = []; let cur = ends[0];
    while (cur) { path.unshift(cur); cur = prev[key(cur[0], cur[1])]; }
    const legs = [];
    path.forEach(([s, l], k) => {
      const L = legs[legs.length - 1];
      if (!L || L.line !== l) { if (L && L.to !== s) L.to = s; legs.push({ line: l, from: s, to: s, stops: 0, via: [s] }); }
      else { L.to = s; L.stops++; L.via.push(s); }
    });
    const real = legs.filter(L => L.stops > 0);
    real.forEach(L => { L.towards = TR.towards(L.line, L.from, L.to); });
    return { from, to, legs: real, transfers: real.length - 1, stops: real.reduce((n, L) => n + L.stops, 0) };
  };
  // 상대가 알려 주는 길 (영어 · 한국어)
  TR.say = function (R) {
    const [a, b] = R.legs, La = TR.LINES[a.line], to = TR.STN[R.to].en;
    if (!b) return `Take ${La.en} towards ${TR.STN[a.towards].en} and get off at ${to}. It's ${a.stops === 1 ? 'just one stop' : numWord(a.stops) + ' stops'}.`;
    const Lb = TR.LINES[b.line];
    return `Take ${La.en} towards ${TR.STN[a.towards].en} and change at ${TR.STN[b.from].en}. Then take ${Lb.en} towards ${TR.STN[b.towards].en} and get off at ${to}.`;
  };
  TR.sayKo = function (R) {
    const [a, b] = R.legs, La = TR.LINES[a.line], to = TR.STN[R.to].ko;
    if (!b) return `${La.ko}을 ${TR.STN[a.towards].en} 방향으로 타고 ${to}에서 내리세요. ${a.stops === 1 ? '한 정거장' : a.stops + '정거장'}이에요.`;
    const Lb = TR.LINES[b.line];
    return `${La.ko}을 ${TR.STN[a.towards].en} 방향으로 타고 ${TR.STN[b.from].ko}에서 갈아타세요. 그다음 ${Lb.ko}을 ${TR.STN[b.towards].en} 방향으로 타고 ${to}에서 내리세요.`;
  };
  // 빠르게 말할 때 (사이를 줄여 이어서)
  TR.sayFast = R => TR.say(R).replace(/\. Then /, ', then ').replace(/ and get off/, ', get off');

  /* =========================================================
     말의 뜻(intent) — 질문의 모양과 기대하는 대답
     yn: Yes/No 질문에 그냥 Yes · No로만 답할 때 → { yes: 카드 → 카드가 바라는 Yes(true) · No(false) · 모름(null), need: 통과하지만 덧붙일 말, strict: 탈락 까닭 }
     key: 고르는 질문에서 고른 것을 담는 사실 이름
     ========================================================= */
  const I = (shape, ans, want, best, o = {}) => Object.assign({ shape, ans, want, best }, o);
  TR.INTENT = {
    dest: I('wh', '어디까지 가는지 묻는 질문', 'To + 역 이름 + please → To Oakbridge, please. · A ticket to Oakbridge, please.', 'ds_to', { turn: '행선지' }),
    type: I('or', '편도와 왕복 가운데 고르라는 질문', '고른 것 + please → A return, please. · Round trip, please.', 'tt_pl', { turn: '편도 · 왕복', key: 'type' }),
    count: I('wh', '몇 명이 가는지 묻는 질문', '사람 수 + please → Two adults, please. · Just me, please.', 'pc_pl', { turn: '사람 수' }),
    peak: I('or', '덜 붐비는 시간 표(off-peak)와 아무 때나 표(anytime) 가운데 고르라는 질문', '고른 것 + please → Off-peak, please.', 'pk_pl', { turn: '시간대', key: 'peak' }),
    seat: I('or', '창가 자리와 통로 자리 가운데 고르라는 질문', '고른 것 + please → A window seat, please.', 'se_pl', { turn: '자리', key: 'seat' }),
    disc: I('yn', '할인 카드(학생 카드 · 레일카드)가 있는지 묻는 질문', '있으면 Yes, I do. Here it is. 없으면 No, I don\'t.', c => c.disc ? 'dc_yes' : 'dc_no', { turn: '할인 카드', yn: { yes: c => c.disc == null ? null : !!c.disc, need: '카드를 보여 주며 → Yes, I do. Here it is.' } }),
    cost: I('note', '값을 알려 주는 말', '카드로 내려면 Can I pay by card? 현금이면 Here you go. 숫자가 헷갈리면 → Sorry, did you say fourteen fifty?', c => c.paym === 'cash' ? 'co_here' : 'co_card', { turn: '값 듣기', say: '값을 알려 주는 말이에요. 숫자를 잘 들었는지 확인하고 내는 방법을 말해요' }),
    plat: I('note', '승강장과 출발 시각을 알려 주는 말', 'So, + 들은 승강장 · 시각? → So, platform 4 at 10:15?', 'pt_so', { turn: '승강장 · 시각', say: '승강장과 시각을 알려 주는 말이에요. 숫자는 되짚어 확인해요' }),
    askway: I('note', '안내 데스크 직원이 다음 사람을 부르는 말', 'How do I get to + 역 이름? → Hi. How do I get to Museum, please?', 'aw_how', { turn: '길 묻기', say: '다음 사람을 부르는 말이에요. 이제 내가 먼저 물을 차례예요' }),
    mcard: I('yn', '새 교통 카드가 필요한지 묻는 질문', '새 카드가 필요하면 Yes, please. 가진 카드에 돈을 넣으려면 No, thanks. I\'d like to top up my card.', c => c.topup ? 'mc_top' : 'g_yesp', { turn: '교통 카드', offer: true, yn: { yes: c => c.topup == null ? null : !c.topup, need: '가진 카드에 돈을 넣고 싶다는 것까지 말해요 → No, thanks. I\'d like to top up my card.' } }),
    topamt: I('wh', '카드에 얼마를 넣을지 묻는 질문', '돈 + please → Twenty dollars, please.', 'ta_pl', { turn: '넣을 돈' }),
    route: I('note', '갈아타는 길을 알려 주는 말', 'So, I + 들은 조각을 차례대로? → So, I take the Green Line towards East Pier, change at Central to the Blue Line, and get off at Museum?', 'line', { turn: '갈아타기 되짚기', say: '갈아타는 길을 알려 주는 말이에요. 들은 조각을 한 줄로 되짚어 확인해요' }),
    more: I('yn', '더 도와줄 것이 있는지 묻는 질문', 'No, that\'s all. Thank you so much!', 'mr_no', { turn: '마무리', yn: { yes: () => false } }),
    board: I('note', '승강장 직원의 안내', 'Excuse me, does this train go to + 역 이름? · Is this the right platform for + 역 이름?', 'bd_does', { turn: '열차 확인', say: '승강장 직원이 모두에게 하는 안내예요. 이 열차가 맞는지 이제 내가 먼저 물어요' }),
    wrongway: I('note', '반대쪽 열차를 타야 한다고 알려 주는 말', '들은 것을 짧게 되짚고 고맙다고 → Oh, the other side. Thank you!', 'ww_thx', { turn: '반대쪽', say: '이 열차가 아니라고 알려 주는 말이에요. 들은 것을 짧게 되짚고 고맙다고 해요' }),
    seatq: I('yn', '옆자리에 누가 앉아 있는지 묻는 질문', '비어 있으면 No, go ahead. 누가 있으면 Sorry, someone\'s sitting here.', c => c.seatFree === false ? 'sq_taken' : 'sq_go', { turn: '빈자리', yn: { yes: c => c.seatFree == null ? null : !c.seatFree } }),
    announce: I('note', '열차 안 안내방송', '안내방송은 다시 말해 주지 않아요. 옆 사람에게 → Excuse me, what did the announcement say?', 'rp_ann', { turn: '안내방송', say: '열차 안 안내방송이에요' }),
    repair: I(null, '다시 묻는 말', '', 'rp_again'),
  };
  TR.sayOf = intent => { const it = TR.INTENT[intent]; return it.say || TR.SHAPE[it.shape].say; };
  TR.INTENT_KO = {}; Object.entries(TR.INTENT).forEach(([k, v]) => { TR.INTENT_KO[k] = v.turn || ''; });
  // 한 번만 나오는 뜻 — 다른 곳에서 미리 답했어도 시뮬레이터의 상대가 건너뜀
  TR.CROSS = { type: 1 };

  /* =========================================================
     상대의 말. key: 열쇠 낱말(말 안에 꼭 있어야 함) · shape: 질문의 모양 · choices: 고르는 질문에서 고를 것(사실 값)
     fast: 너무 빨라 못 알아들은 말 · short: 지도에 쓰는 짧은 꼴 · fact: 그 말이 알려 준 사실 · allow: 대답 대신 해도 되는 다시 묻기(틀 id)
     variety: 영국(gb) · 미국(us) 표현 · ann: 안내방송
     ========================================================= */
  TR.Q = {};
  const Q = (id, place, intent, en, ko, key, o = {}) => (TR.Q[id] = Object.assign({ id, place, intent, en, ko, key, shape: TR.INTENT[intent].shape, sp: TR.PLACE[place].sp }, o));
  // 기본 길 (영상 · 직접 해 보기): Park Road → Museum (초록 → Central에서 파랑)
  TR.DEMO_TRIP = { from: 'parkroad', to: 'museum' };
  const DR0 = TR.route('parkroad', 'museum');
  // 매표소 · 어디까지
  Q('ct_where', 'counter', 'dest', 'Hi there. Where are you traveling to today?', '안녕하세요. 오늘 어디까지 가세요?', ['Where'], { short: 'Where are you traveling to?' });
  Q('ct_gb', 'counter', 'dest', 'Morning! Where to?', '(영국) 안녕하세요! 어디까지요?', ['Where to'], { sp: 'gb', short: 'Where to? (영국)' });
  Q('ct_fast', 'counter', 'dest', 'Hi, where you headed today?', '안녕하세요, 오늘 어디 가세요?', ['headed'], { fast: true });
  // 표 종류 · 몇 명
  Q('tk_type', 'ticket', 'type', 'Single or return?', '(영국) 편도요, 왕복이요?', ['Single or return'], { choices: ['single', 'return'], variety: 'gb', short: 'Single or return?' });
  Q('tk_us', 'ticket', 'type', 'One-way or round trip?', '(미국) 편도요, 왕복이요?', ['One-way or round trip'], { choices: ['single', 'return'], variety: 'us', sp: 'us', short: 'One-way or round trip?' });
  Q('tk_many', 'ticket', 'count', 'And how many people are traveling?', '몇 분이 가세요?', ['how many people'], { short: 'How many people?' });
  Q('tk_peak', 'ticket', 'peak', 'Off-peak or anytime?', '덜 붐비는 시간 표로 드릴까요, 아무 때나 표로 드릴까요?', ['Off-peak or anytime'], { choices: ['offpeak', 'anytime'], allow: ['rp_wpeak'], short: 'Off-peak or anytime?' });
  Q('tk_seat', 'ticket', 'seat', 'Would you like a window or an aisle seat?', '창가 자리로 드릴까요, 통로 자리로 드릴까요?', ['window or an aisle'], { choices: ['window', 'aisle'], short: 'Window or aisle?' });
  // 할인 · 값
  Q('fr_disc', 'fare', 'disc', 'Do you have a student card?', '학생 카드 있으세요?', ['student card'], { short: 'Do you have a student card?' });
  Q('fr_gb', 'fare', 'disc', 'Have you got a railcard?', '(영국) 레일카드 있으세요?', ['railcard'], { sp: 'gb', allow: ['rp_wrail'], short: 'Have you got a railcard? (영국)' });
  Q('fr_cost', 'fare', 'cost', 'Okay, that\'s $14.50, please.', '네, 14달러 50센트예요.', ['$14.50'], { fact: { amount: 1450 }, short: 'That\'s $14.50.' });
  Q('fr_fast', 'fare', 'disc', 'You got any discount cards today?', '오늘 할인 카드 있으세요?', ['discount'], { fast: true });
  // 승강장 · 출발 시각
  Q('pl_info', 'plat', 'plat', 'It leaves at 10:15 from platform 4.', '10시 15분에 4번 승강장에서 떠나요.', ['platform'], { fact: { plat: 4, time: '10:15' }, sp: 'us', short: 'It leaves at 10:15 from platform 4.' });
  Q('pl_gb', 'plat', 'plat', 'Right, the next one\'s the 10:50 from platform 2.', '(영국) 자, 다음 열차는 2번 승강장에서 10시 50분에 떠나요.', ['platform'], { fact: { plat: 2, time: '10:50' }, short: 'The 10:50 from platform 2. (영국)' });
  Q('pl_fast', 'plat', 'plat', 'Sorry folks, platform change! The 10:15 to Oakbridge now leaves from platform 6.', '여러분, 승강장이 바뀌었어요! 10시 15분 오크브리지행은 이제 6번 승강장에서 떠나요.', ['platform'], { fact: { plat: 6, time: '10:15' }, fast: true });
  // 지하철 안내 데스크 (내가 먼저)
  Q('in_next', 'info', 'askway', 'Next, please!', '다음 분이요!', ['Next'], { short: 'Next, please!' });
  Q('in_card', 'info', 'mcard', 'Hi! Would you like a new metro card?', '안녕하세요! 새 지하철 카드 필요하세요?', ['new metro card'], { short: 'Would you like a new metro card?' });
  Q('in_amt', 'info', 'topamt', 'Sure. How much would you like to put on it?', '네. 얼마를 넣어 드릴까요?', ['How much'], { short: 'How much would you like to put on it?' });
  // 갈아타기 안내
  Q('ro_say', 'route', 'route', TR.say(DR0), TR.sayKo(DR0), ['change at'], { fact: Object.assign({}, TR.DEMO_TRIP), short: 'Take the Green Line … change at Central.' });
  Q('ro_fast', 'route', 'route', TR.sayFast(DR0), TR.sayKo(DR0), ['change'], { fact: Object.assign({}, TR.DEMO_TRIP), fast: true });
  Q('ro_more', 'route', 'more', 'Is there anything else I can help you with?', '더 도와드릴 것이 있나요?', ['anything else'], { short: 'Anything else?' });
  // 승강장 · 열차 안 (내가 먼저)
  Q('tb_note', 'train', 'board', 'Please stand behind the yellow line.', '노란 선 뒤로 물러서 주세요.', ['yellow line'], { sp: 'gb', short: 'Please stand behind the yellow line.' });
  Q('tb_no', 'train', 'wrongway', 'No, this one goes to North Gate. You need the train on the other side.', '아니요, 이건 노스게이트(North Gate)로 가요. 반대쪽 열차를 타셔야 해요.', ['other side'], { fact: { side: 'other' }, short: 'You need the other side.' });
  Q('tb_seat', 'train', 'seatq', 'Excuse me, is anyone sitting here?', '실례지만, 여기 누가 앉아 있나요?', ['anyone sitting'], { short: 'Is anyone sitting here?' });
  Q('tb_fast', 'train', 'announce', 'The next station is Central. Change here for the Blue Line. Doors open on the left.', '다음 역은 Central이에요. Blue Line으로 갈아타실 분은 여기서 내리세요. 문은 왼쪽으로 열려요.', ['next station'], { fast: true, ann: true, sp: 'gb' });
  // 곳마다 대표 말 (영상 01장 지도 · 직접 해 보기)
  TR.ROUTE = {
    counter: ['ct_where', 'ct_gb'], ticket: ['tk_type', 'tk_many'], fare: ['fr_disc', 'fr_cost'], plat: ['pl_info', 'pl_gb'],
    info: ['in_next', 'in_card'], route: ['ro_say', 'ro_more'], train: ['tb_note', 'tb_seat'],
  };

  /* =========================================================
     칸에 넣는 내 정보 (slot). 틀(frame)이 form으로 어느 꼴을 쓸지 정해요.
     fact: 이 값이 말하는 사실 · bad · why: 콩글리시 값(② 탈락) · note: 통하지만 덧붙일 말 · var: 영국 · 미국 표현 · dyn: 값이 정해져 있지 않은 칸
     ========================================================= */
  TR.SLOT = {
    town: { key: 'dest', vals: Object.fromEntries(TR.TOWN_IDS.map(id => [id, { t: TR.TOWNS[id].en, ko: TR.TOWNS[id].ko }])) },
    st: { key: 'to', vals: Object.fromEntries(TR.STN_IDS.map(id => [id, { t: TR.STN[id].en, ko: TR.STN[id].ko }])) },
    ttype: { key: 'type', vals: {
      single: { t: 'a single', ko: '편도(single)', fact: { type: 'single' }, var: 'gb' },
      return: { t: 'a return', ko: '왕복(return)', fact: { type: 'return' }, var: 'gb' },
      oneway: { t: 'one-way', ko: '편도(one-way)', fact: { type: 'single' }, var: 'us' },
      round: { t: 'round trip', ko: '왕복(round trip)', fact: { type: 'return' }, var: 'us' },
      goback: { t: 'a go-and-back ticket', ko: '(한국식 말) 왕복표', fact: { type: 'return' }, bad: 'literal', why: '‘왕복표’를 낱말 그대로 옮긴 go-and-back ticket은 영어로 쓰지 않는 말이라 알아듣기 어려워요. 왕복 → a return (영국) · round trip (미국).' },
    } },
    party: { key: 'party', vals: {
      me1: { t: 'just me', ko: '저 혼자(어른 한 명)', fact: { party: 'a1' } },
      a1: { t: 'one adult', ko: '어른 한 명', fact: { party: 'a1' } },
      a2: { t: 'two adults', ko: '어른 두 명', fact: { party: 'a2' } },
      a3: { t: 'three adults', ko: '어른 세 명', fact: { party: 'a3' } },
      a1c1: { t: 'one adult and one child', ko: '어른 한 명 · 어린이 한 명', fact: { party: 'a1c1' } },
      a2c1: { t: 'two adults and one child', ko: '어른 두 명 · 어린이 한 명', fact: { party: 'a2c1' } },
      a2c2: { t: 'two adults and two children', ko: '어른 두 명 · 어린이 두 명', fact: { party: 'a2c2' } },
      p2: { t: 'two persons', ko: '두 사람(two persons)', fact: { party: 'a2' }, note: 'two persons도 알아듣지만 서류 말처럼 딱딱하게 들려요. 표를 살 때는 어른 · 어린이로 나눠 말해요 → Two adults, please.' },
      alone: { t: 'me alone', ko: '(어색한 말) 나 혼자', fact: { party: 'a1' }, bad: 'literal', why: '‘혼자요’를 me alone으로 옮기면 ‘나 혼자 남았어’처럼 쓸쓸한 말로 들려 어색해요. 한 사람이면 → Just me, please. · One adult, please.' },
    } },
    peak: { key: 'peak', vals: { offpeak: { t: 'off-peak', ko: '덜 붐비는 시간 표(off-peak)' }, anytime: { t: 'anytime', ko: '아무 때나 표(anytime)' } } },
    seat: { key: 'seat', vals: { window: { t: 'a window seat', ko: '창가 자리' }, aisle: { t: 'an aisle seat', ko: '통로 자리' } } },
    money: { key: 'amount', dyn: 'money' },
    topm: { key: 'topAmt', dyn: 'money' },
    pt: { key: 'pt', dyn: 'pt' },
  };
  // 승강장 · 시각 값: '4@10:15' → platform 4 at 10:15
  const ptParse = v => { const m = /^(\d{1,2})@(\d{1,2}:\d{2})$/.exec(String(v)); return m ? { plat: +m[1], time: m[2] } : null; };
  TR.ptVal = (plat, time) => `${plat}@${time}`;
  // 칸 값 하나 (값이 정해져 있지 않은 칸도)
  TR.sv = function (slot, v) {
    const S = TR.SLOT[slot]; if (!S || v == null) return null;
    if (S.dyn === 'money') return /^\d+$/.test(String(v)) ? { t: TR.money(+v), ko: TR.priceKo(+v), fact: { [S.key]: +v } } : null;
    if (S.dyn === 'pt') { const p = ptParse(v); return p ? { t: `platform ${p.plat} at ${p.time}`, ko: `${p.plat}번 승강장 · ${TR.timeKo(p.time)}`, fact: p } : null; }
    return S.vals[v] || null;
  };
  const valFact = (slot, v) => { const x = TR.sv(slot, v); if (!x) return {}; return x.fact ? Object.assign({}, x.fact) : { [TR.SLOT[slot].key]: v }; };
  TR.valFact = valFact;
  // 카드와 맞는 칸 값 (콩글리시 · 알림이 붙는 값은 빼고)
  const slotIds = slot => { const S = TR.SLOT[slot]; return S.dyn ? [] : Object.keys(S.vals).filter(id => { const x = S.vals[id]; return !x.bad && !x.note; }); };
  TR.slotIds = slotIds;
  TR.slotVal = function (slot, C, q) {
    const S = TR.SLOT[slot];
    if (S.dyn === 'money') { const v = C[S.key]; return v != null ? String(v) : null; }
    if (S.dyn === 'pt') return C.plat != null && C.time ? TR.ptVal(C.plat, C.time) : null;
    const ids = slotIds(slot), vr = q && q.variety;
    const fit = id => { const f = valFact(slot, id); return Object.keys(f).length && Object.keys(f).every(k => C[k] === f[k]); };
    return ids.find(id => fit(id) && (!vr || !S.vals[id].var || S.vals[id].var === vr)) || ids.find(fit) || null;
  };

  /* =========================================================
     되짚는 한 줄 — 조각과 순서: So, I → take + 노선 → towards + 방향 → change at + 역 → to + 노선 → (towards + 방향) → get off at + 역
     들은 차례대로, 들은 조각을 모두 넣어요. (자주 쓰는 꼴을 단순하게 줄인 규칙)
     줄 = { words: [조각 id, …] }
     ========================================================= */
  TR.OW = { so: { c: 'open', t: 'So, I' } };
  TR.LINE_IDS.forEach(l => { const L = TR.LINES[l]; TR.OW['tk_' + l] = { c: 'take', t: 'take ' + L.en, line: l }; TR.OW['to_' + l] = { c: 'take2', t: 'to ' + L.en, line: l }; });
  TR.STN_IDS.forEach(id => {
    const n = TR.STN[id].en;
    TR.OW['tw_' + id] = { c: 'dir', t: 'towards ' + n, st: id };
    TR.OW['ch_' + id] = { c: 'change', t: 'change at ' + n, st: id };
    TR.OW['of_' + id] = { c: 'off', t: 'get off at ' + n, st: id };
    TR.OW['gd_' + id] = { c: 'off', t: 'get down at ' + n, st: id, bad: 'literal', why: '‘내리다’를 get down으로 옮기면 ‘몸을 숙이다 · (높은 데서) 내려오다’로 들려요. 열차 · 버스에서 내리는 것은 → get off at ' + n + '.' };
  });
  Object.entries(TR.OW).forEach(([id, w]) => { w.id = id; });
  TR.OCAT = { open: { ko: '되짚는 틀(So, I)', n: 0 }, take: { ko: '탈 노선', n: 1 }, dir: { ko: '방향(towards)', n: 2 }, change: { ko: '갈아타는 역', n: 3 }, take2: { ko: '갈아탈 노선', n: 4 }, dir2: { ko: '갈아탄 뒤 방향', n: 5 }, off: { ko: '내릴 역', n: 6 } };
  // 낱말마다 자리(차례 번호): towards는 바로 앞이 갈아탈 노선이면 갈아탄 뒤 방향
  const ranks = W => { let afterTake2 = false; return W.map(x => { if (x.c === 'take2') afterTake2 = true; if (x.c === 'change' || x.c === 'off') afterTake2 = afterTake2 && x.c !== 'change'; return x.c === 'dir' ? (afterTake2 ? 5 : 2) : TR.OCAT[x.c].n; }); };
  // 들은 길의 모범 한 줄
  TR.lineWords = function (R) {
    const [a, b] = R.legs, out = ['so', 'tk_' + a.line, 'tw_' + a.towards];
    if (b) out.push('ch_' + b.from, 'to_' + b.line);
    out.push('of_' + R.to);
    return out;
  };
  const tripOf = C => C && C.from && C.to ? TR.route(C.from, C.to) : null;
  TR.tripOf = tripOf;
  // 틀린 조각 찾기 → { type, word, right } (첫 번째 것)
  function lineErr(W, rk, R) {
    const [a, b] = R.legs;
    for (let i = 0; i < W.length; i++) {
      const x = W[i], r = rk[i];
      if (x.c === 'take' && x.line !== a.line) return { type: 'line', word: x, right: 'tk_' + a.line };
      if (x.c === 'dir' && r === 2 && x.st !== a.towards) return { type: x.st === TR.otherEnd(a.line, a.towards) ? 'dir' : 'dirname', word: x, right: 'tw_' + a.towards };
      if ((x.c === 'change' || x.c === 'take2' || r === 5) && !b) return { type: 'nochange', word: x, right: null };
      if (x.c === 'change' && x.st !== b.from) return { type: 'change', word: x, right: 'ch_' + b.from };
      if (x.c === 'take2' && x.line !== b.line) return { type: 'line2', word: x, right: 'to_' + b.line };
      if (x.c === 'dir' && r === 5 && x.st !== b.towards) return { type: 'dir2', word: x, right: 'tw_' + b.towards };
      if (x.c === 'off' && x.st !== R.to) return { type: 'off', word: x, right: 'of_' + R.to };
    }
    return null;
  }
  const ERR_KO = { line: '탈 노선', dir: '방향(반대쪽 종점)', dirname: '방향(종점 이름)', nochange: '갈아타기(이 길은 갈아타지 않아요)', change: '갈아타는 역', line2: '갈아탈 노선', dir2: '갈아탄 뒤 방향', off: '내릴 역' };
  TR.ERR_KO = ERR_KO;
  TR.checkLine = function (Lw, C = {}) {
    const ws = Lw.words || Lw, W = ws.map(w => TR.OW[w]);
    if (!ws.length) return { ok: false, stage: 1, why: '아직 아무것도 고르지 않았어요.' };
    if (W.some(x => !x)) return { ok: false, stage: 2, why: '사전에 없는 조각이 있어요.' };
    const R = tripOf(C), want = R ? TR.lineWords(R) : null;
    const n = c => W.filter(x => x.c === c).length;
    for (const c of ['open', 'take', 'change', 'take2', 'off']) if (n(c) > 1) return { ok: false, stage: 2, why: `${eun(TR.OCAT[c].ko)} 한 번만 말해요.`, want, tag: 'order' };
    if (n('dir') > 2) return { ok: false, stage: 2, why: '방향(towards)은 탈 노선마다 한 번만 말해요.', want, tag: 'order' };
    if (!n('open')) return { ok: false, stage: 2, why: '되짚는 틀(So, I …?)이 빠졌어요. 조각만 늘어놓으면 확인하는 말인지 알기 어려워요.', want, tag: 'order' };
    const rk = ranks(W);
    for (let k = 1; k < W.length; k++) if (rk[k] <= rk[k - 1]) return { ok: false, stage: 2, why: `순서가 뒤섞여 알아듣기 어려워요. 들은 차례대로 되짚어요${want ? ' → ' + TR.lineText({ words: want }) : ''}`, want, tag: 'order' };
    const bad = W.find(x => x.bad);
    if (bad) return { ok: false, stage: 2, why: bad.why, want, tag: bad.bad };
    if (!R) return { ok: true, why: '순서가 자연스러워요.', want };
    const e = lineErr(W, rk, R);
    if (e) {
      const ko = ERR_KO[e.type];
      const why = e.type === 'nochange' ? '이 길은 갈아타지 않아요. 들은 길: ' + TR.lineText({ words: want })
        : `들은 길과 달라요(${ko}). 안내: ${TR.OW[e.right].t} · 이 되짚기: ${e.word.t}.` + (e.type === 'dir' ? ' 방향은 그 노선의 끝 역(종점) 이름으로 말해요. 반대쪽 끝이면 거꾸로 가는 열차예요.' : '');
      return { ok: false, stage: 2, why, want, tag: 'fact', err: e };
    }
    const need = ['take', 'dir', 'off'].concat(R.legs[1] ? ['change', 'take2'] : []).filter(c => !W.some((x, i) => x.c === c && (c !== 'dir' || rk[i] === 2)));
    if (need.length) return { ok: false, stage: 2, why: `빠진 조각이 있어요: ${need.map(c => TR.OCAT[c].ko).join(' · ')}. 들은 조각을 모두 되짚어야 길이 맞는지 알 수 있어요 → ${TR.lineText({ words: want })}`, want, tag: 'need', missing: need };
    const parts = W.slice(1).map((x, i) => rk[i + 1] === 5 ? TR.OCAT.dir2.ko : TR.OCAT[x.c].ko).join(' → ');
    return { ok: true, why: `${parts}. 들은 차례대로 빠짐없이 되짚었어요.`, want };
  };
  // 상대가 고쳐 주는 말 (틀린 첫 조각만) · 맞으면 That's right!
  TR.fixLine = function (Lw, C) {
    const o = TR.checkLine(Lw, C), R = tripOf(C);
    if (o.ok) return { en: 'That\'s right!', ko: '맞아요!' };
    if (o.tag === 'fact' && o.err) {
      if (o.err.type === 'nochange') return { en: `No, you don't need to change. Just stay on ${TR.LINES[R.legs[0].line].en}.`, ko: '아니요, 갈아타지 않아도 돼요. 그 노선을 그대로 타세요.' };
      const r = TR.OW[o.err.right];
      return { en: `Not quite — ${r.t}, not ${o.err.word.t.replace(/^(take|to|towards|change at|get off at) /, '')}.`, ko: `조금 달라요 — ${r.t}예요.` };
    }
    if (o.tag === 'need') return { en: `Yes — and ${o.missing.map(c => { const w = o.want.find(id => TR.OW[id].c === c); return TR.OW[w].t; }).join(', then ')}.`, ko: `네 — 그리고 빠진 조각: ${o.missing.map(c => TR.OCAT[c].ko).join(' · ')}.` };
    if (o.tag === 'literal') return { en: 'Sorry — get down? Oh, you mean get off.', ko: '열차에서 내리는 것은 get off예요.' };
    return { en: 'Sorry, could you say that again?', ko: '순서가 뒤섞여 알아듣기 어려워요.' };
  };
  TR.lineFacts = Lw => { const f = {}; (Lw.words || Lw).forEach(w => { const x = TR.OW[w]; if (x && x.c === 'off') f.to = x.st; }); return f; };
  function lineSegs(Lw) {
    const ws = Lw.words || Lw, W = ws.map(w => TR.OW[w]).filter(Boolean), out = [], rk = ranks(W);
    const hasChange = W.some(x => x.c === 'change');
    W.forEach((x, i) => {
      if (i) {
        const sep = x.c === 'change' ? ', ' : x.c === 'off' && i > 1 ? (hasChange ? ', and ' : ' and ') : ' ';
        out.push({ t: sep, r: 'frame' });
      }
      if (x.c === 'open') out.push({ t: x.t, r: 'frame', part: 'open' });
      else out.push({ t: x.t, r: x.bad ? 'trap' : 'slot', part: rk[i] === 5 ? 'dir2' : x.c });
    });
    if (out.length) { out[0].t = out[0].t[0].toUpperCase() + out[0].t.slice(1); out.push({ t: W.some(x => x.c === 'open') ? '?' : '.', r: 'frame' }); }
    return out;
  }
  TR.lineSegs = lineSegs;
  TR.lineText = Lw => lineSegs(Lw).map(s => s.t).join('');
  TR.lineKo = function (Lw) {
    const W = (Lw.words || Lw).map(w => TR.OW[w]).filter(Boolean).filter(x => x.c !== 'open'), p = [];
    W.forEach(x => {
      if (x.c === 'take') p.push(`${TR.LINES[x.line].ko}을 타고`);
      else if (x.c === 'dir') p.push(`${TR.STN[x.st].en} 방향으로 가서`);
      else if (x.c === 'change') p.push(`${TR.STN[x.st].ko}에서`);
      else if (x.c === 'take2') p.push(`${ro(TR.LINES[x.line].ko)} 갈아타고`);
      else if (x.c === 'off') p.push(`${TR.STN[x.st].ko}에서 ${x.bad ? '(몸을 숙여) 내려오는' : '내리는'}`);
    });
    const last = W[W.length - 1];
    let s = p.join(' ');
    if (!last || last.c !== 'off') s = s.replace(/(타고|가서)$/, '가는');
    return `그러니까 제가 ${s} 거죠?`;
  };

  /* =========================================================
     대답 틀 (frame). t: 틀 글 — ___ = 내 정보 칸, {…} = 공손한 말
     tag: ok · literal(한국어 그대로 · 콩글리시) · wrong(틀린 문장) · blunt(명령 · 따지기) · plain(고맙다는 말 없이 끊김)
     bare: Yes · No만 하는 대답(yes: true · false) · check: 들은 값을 되짚어 확인하는 말 · skip: 되짚지 않고 넘어가는 말
     ========================================================= */
  TR.FRAME = {};
  const FR = (id, intent, t, ko, o = {}) => (TR.FRAME[id] = Object.assign({ id, intent, t, ko, tag: 'ok' }, o));
  // Yes · No만 하는 대답 (고르는 질문 · 정보 질문에는 ① 탈락)
  FR('g_yes', 'yn', 'Yes.', '네.', { bare: true, yes: true });
  FR('g_yesp', 'yn', 'Yes, {please}.', '네, 주세요.', { bare: true, yes: true });
  FR('g_no', 'yn', 'No, {thanks}.', '아니요, 괜찮아요.', { bare: true, yes: false });
  // 매표소 · 어디까지
  FR('ds_to', 'dest', 'To ___, {please}.', '___까지요.', { slot: 'town' });
  FR('ds_tk', 'dest', 'A ticket to ___, {please}.', '___ 가는 표 한 장 주세요.', { slot: 'town' });
  FR('ds_ret', 'dest', 'A return to ___, {please}.', '___ 왕복표 주세요.', { slot: 'town', fact: { type: 'return' } });
  FR('ds_sgl', 'dest', 'A single to ___, {please}.', '___ 편도표 주세요.', { slot: 'town', fact: { type: 'single' } });
  FR('ds_give', 'dest', 'Give me a ticket to ___.', '(명령) ___ 가는 표 줘요.', { slot: 'town', tag: 'blunt', why: '‘표 주세요’를 그대로 옮긴 Give me는 명령처럼 들려요. 어디까지인지만 말하고 please를 붙여요 → To Oakbridge, please.' });
  FR('ds_go', 'dest', 'I go to ___.', '(어색한 말) 저는 ___에 가요.', { slot: 'town', tag: 'literal', why: 'I go to …는 ‘(평소에) …에 다녀요’라는 버릇 이야기처럼 들려요. 어디까지 가는 표인지 말할 때는 → To Oakbridge, please.' });
  // 표 종류 · 몇 명 · 시간대 · 자리
  FR('tt_pl', 'type', '___, {please}.', '___(으)로 주세요.', { slot: 'ttype' });
  FR('pc_pl', 'count', '___, {please}.', '___이요.', { slot: 'party' });
  FR('pk_pl', 'peak', '___, {please}.', '___(으)로 주세요.', { slot: 'peak' });
  FR('se_pl', 'seat', '___, {please}.', '___(으)로 주세요.', { slot: 'seat' });
  // 할인 · 값
  FR('dc_yes', 'disc', 'Yes, I do. Here it is.', '네, 있어요. 여기요.', { fact: { disc: true } });
  FR('dc_no', 'disc', 'No, I don\'t.', '아니요, 없어요.', { fact: { disc: false } });
  FR('dc_have', 'disc', 'No, I don\'t have.', '(틀린 말) 아니요, 없어요.', { fact: { disc: false }, tag: 'wrong', why: 'have 뒤에 무엇이 없는지가 빠져 문장이 끝나지 않아요. Do you have …? 질문에는 → No, I don\'t.' });
  FR('co_card', 'cost', 'Can I pay by card?', '카드로 내도 돼요?', { fact: { paym: 'card' } });
  FR('co_here', 'cost', 'Here you go.', '여기요.', { fact: { paym: 'cash' } });
  FR('co_say', 'cost', '{Sorry}, did you say ___?', '죄송한데, ___라고 하셨어요?', { slot: 'money', check: true });
  FR('co_lit', 'cost', 'Card is okay?', '(어색한 말) 카드 돼요?', { fact: { paym: 'card' }, tag: 'literal', why: '‘카드 돼요?’를 낱말 그대로 옮긴 말이라 무엇이 괜찮은지 알기 어려워요. 카드로 내도 되는지 물을 때는 → Can I pay by card?' });
  FR('co_exp', 'cost', 'So expensive. Cheaper, {please}.', '(조르는 말) 너무 비싸요. 깎아 주세요.', { tag: 'blunt', why: '기차표 값은 정해져 있어서 깎지 않아요. 조르는 말처럼 들려요. 할인을 받고 싶으면 할인 카드가 있는지 말해요 → I have a student card.' });
  // 승강장 · 출발 시각
  FR('pt_so', 'plat', 'So, ___?', '그러니까, ___이죠?', { slot: 'pt', check: true });
  FR('pt_say', 'plat', '{Sorry}, did you say ___?', '죄송한데, ___라고 하셨어요?', { slot: 'pt', check: true });
  FR('pt_where', 'plat', 'Platform where?', '(어색한 말) 승강장 어디요?', { tag: 'literal', why: '‘승강장 어디요?’를 낱말 그대로 옮긴 말이라 퉁명스럽게 들리고, 직원은 방금 승강장을 말했어요. 들은 숫자를 되짚어 확인해요 → So, platform 4 at 10:15?' });
  // 지하철 안내 데스크
  FR('aw_how', 'askway', 'Hi. How do I get to ___, {please}?', '안녕하세요. ___에 어떻게 가요?', { slot: 'st' });
  FR('aw_which', 'askway', 'Hi. Which line goes to ___?', '안녕하세요. ___에 가는 노선이 어느 거예요?', { slot: 'st' });
  FR('aw_teach', 'askway', 'Teach me the way to ___.', '(어색한 말) ___ 가는 길 가르쳐 줘요.', { slot: 'st', tag: 'literal', why: '‘길 좀 가르쳐 주세요’를 옮긴 teach는 수업에서 가르친다는 말이라 어색하고, 명령처럼 들려요. 길을 물을 때는 → How do I get to Museum, please?' });
  FR('aw_lit', 'askway', '___, how?', '(어색한 말) ___, 어떻게요?', { slot: 'st', tag: 'literal', why: '‘Museum 어떻게요?’를 낱말 그대로 옮긴 말이라 무엇을 묻는지 알기 어려워요. 묻는 틀에 역 이름을 넣어요 → How do I get to Museum, please?' });
  FR('mc_top', 'mcard', 'No, {thanks}. I\'d like to top up my card.', '아니요, 괜찮아요. 제 카드에 돈을 넣고(충전하고) 싶어요.', { fact: { topup: true } });
  FR('mc_add', 'mcard', 'No, {thanks}. Could I add money to my card?', '아니요, 괜찮아요. 제 카드에 돈을 넣을 수 있을까요?', { fact: { topup: true } });
  FR('mc_charge', 'mcard', 'No. I\'d like to charge my card.', '(콩글리시) 아니요. 제 카드를 충전하고 싶어요.', { fact: { topup: true }, tag: 'literal', why: '‘충전’을 charge로 옮기면 카드로 값을 내겠다(결제)는 말이나 배터리 충전으로 들려요. 교통 카드에 돈을 넣는 것은 → top up (미국에서는 reload · add money).' });
  FR('ta_pl', 'topamt', '___, {please}.', '___ 넣어 주세요.', { slot: 'topm' });
  // 갈아타기 안내
  FR('line', 'route', '', '', { line: true });   // 되짚는 한 줄 (TR.checkLine)
  FR('ro_ok', 'route', 'Okay. {Thanks}.', '알겠어요. 고마워요.', { skip: true, why: '고맙다고만 하면 들은 길이 맞는지 확인하지 못해요. 길고 빠른 길 안내는 들은 조각을 한 줄로 되짚어 확인해요 → So, I take …?' });
  FR('mr_no', 'more', 'No, that\'s all. {Thank you so much}!', '아니요, 그거면 돼요. 정말 고마워요!', {});
  FR('mr_plain', 'more', 'No.', '아니요.', { tag: 'plain', why: '그냥 No.라고 끊으면 무뚝뚝하게 들려요. 길을 알려 준 사람에게는 → No, that\'s all. Thank you so much!' });
  // 승강장 · 열차 안
  FR('bd_does', 'board', '{Excuse me}, does this train go to ___?', '실례지만, 이 열차 ___에 가요?', { slot: 'st' });
  FR('bd_is', 'board', '{Excuse me}, is this the right platform for ___?', '실례지만, ___ 가는 승강장이 여기 맞아요?', { slot: 'st' });
  FR('bd_wrong', 'board', '{Excuse me}, is this train go to ___?', '(틀린 말) 실례지만, 이 열차 ___에 가요?', { slot: 'st', tag: 'wrong', why: 'is와 go를 함께 써서 문장이 틀렸어요. 열차가 가는지 물을 때는 does → Does this train go to Museum?' });
  FR('bd_lit', 'board', 'This train, ___?', '(어색한 말) 이 열차, ___?', { slot: 'st', tag: 'literal', why: '‘이 열차 ___?’를 낱말 그대로 옮긴 말이라 무엇을 묻는지 알기 어렵고 퉁명스럽게 들려요 → Excuse me, does this train go to Museum?' });
  FR('ww_thx', 'wrongway', 'Oh, the other side. {Thank you}!', '아, 반대쪽이요. 고마워요!', { fact: { side: 'other' } });
  FR('ww_this', 'wrongway', 'Oh, this side. {Thanks}!', '아, 이쪽이요. 고마워요!', { fact: { side: 'this' } });
  FR('ww_bye', 'wrongway', 'Okay. Bye.', '네. 안녕.', { fact: { side: 'other' }, tag: 'plain', why: '고맙다는 말 없이 끊으면 무뚝뚝하게 들려요. 들은 것을 짧게 되짚고 고맙다고 해요 → Oh, the other side. Thank you!' });
  FR('sq_go', 'seatq', 'No, go ahead.', '아니요, 앉으세요.', { fact: { seatFree: true } });
  FR('sq_taken', 'seatq', '{Sorry}, someone\'s sitting here.', '죄송해요, 여기 사람 있어요.', { fact: { seatFree: false } });
  FR('sq_yes', 'seatq', 'Yes, sit down.', '(어색한 말) 네, 앉으세요.', { fact: { seatFree: true }, tag: 'literal', why: '‘네, 앉으세요’를 그대로 옮긴 말이에요. Is anyone sitting here?에 Yes라고 하면 ‘네, 누가 앉아 있어요’라는 뜻이 돼서, 앉으라는 말과 엇갈려요. 빈자리면 → No, go ahead.' });
  // 다시 묻기. echo: 들린 만큼 되묻는 말 — 실제로 들은 말이어야 통과 · ann: 안내방송을 옆 사람에게 묻는 말 · what: 모르는 낱말 묻기(allow)
  FR('rp_again', 'repair', '{Sorry? Could you} say that again, {please}?', '죄송한데, 다시 한 번 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_sorry', 'repair', '{Sorry}?', '네? (다시 말해 달라는 뜻)', { kind: 'again' });
  FR('rp_slow', 'repair', '{Could you} say that more slowly, {please}?', '조금 더 천천히 말씀해 주시겠어요?', { kind: 'slow' });
  FR('rp_plat', 'repair', '{Sorry}, which platform?', '죄송한데, 몇 번 승강장이요?', { kind: 'echo', echo: 'plat' });
  FR('rp_where', 'repair', '{Sorry}, where do I change?', '죄송한데, 어디서 갈아타요?', { kind: 'echo', echo: 'route' });
  FR('rp_dest', 'repair', '{Sorry}, did you ask where I\'m going?', '죄송한데, 어디 가는지 물으셨어요?', { kind: 'echo', echo: 'dest' });
  FR('rp_disc', 'repair', '{Sorry}, did you ask about discount cards?', '죄송한데, 할인 카드를 물으셨어요?', { kind: 'echo', echo: 'disc' });
  FR('rp_ann', 'repair', '{Excuse me}, what did the announcement say?', '실례지만, 방금 안내방송에서 뭐라고 했어요?', { kind: 'ann' });
  FR('rp_wpeak', 'repair', '{Sorry}, what\'s an off-peak ticket?', '죄송한데, off-peak 표가 뭐예요?', { kind: 'what' });
  FR('rp_wrail', 'repair', '{Sorry}, what\'s a railcard?', '죄송한데, 레일카드가 뭐예요?', { kind: 'what' });
  FR('rp_rude', 'repair', 'What?', '(퉁명스러운 말) 뭐라고요?', { kind: 'again', tag: 'blunt', why: 'What? 한 낱말은 퉁명스럽게 들릴 수 있어요. 못 알아들었으면 → Sorry? Could you say that again, please?' });

  /* ---------- 대답 글 만들기: 조각(segs) = [{ t, r: 'frame' | 'slot' | 'pol' }] ---------- */
  const slotText = (F, v) => { const x = TR.sv(F.slot, v); return x ? (x[F.form || 't'] != null ? x[F.form || 't'] : x.t) : '___'; };
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
  TR.segs = function (a) {
    const F = TR.FRAME[a.f];
    if (F.line) return lineSegs(a.line);
    return frameSegs(F, a.v);
  };
  TR.text = a => TR.segs(a).map(s => s.t).join('');
  // 해석
  const koOf = (F, v) => {
    if (!F.slot) return F.ko;
    const x = TR.sv(F.slot, v), k = x ? x.ko : '___';
    return F.ko.replace('___(으)로', ro(k)).replace('___(이)에요', ieyo(k)).replace('___이요', k.match(/[명]$/) ? k + '이요' : k + (has(k) ? '이요' : '요')).replace('___이죠', k + (has(k) ? '이죠' : '죠')).replace('___', k);
  };
  TR.ko = function (a) {
    const F = TR.FRAME[a.f];
    if (F.line) return TR.lineKo(a.line);
    return koOf(F, a.v);
  };
  // 대답이 말하는 사실
  TR.factOf = function (a) {
    const F = TR.FRAME[a.f], f = Object.assign({}, F.fact || {});
    if (F.slot && TR.sv(F.slot, a.v)) Object.assign(f, valFact(F.slot, a.v));
    if (F.line) Object.assign(f, TR.lineFacts(a.line));
    return f;
  };
  // 사실을 한국어로
  TR.factKo = function (k, v) {
    if (k === 'dest') return TR.TOWNS[v] ? TR.TOWNS[v].ko : String(v);
    if (k === 'to' || k === 'from') return TR.STN[v] ? TR.STN[v].ko : String(v);
    if (k === 'type') return v === 'return' ? '왕복(return · round trip)' : '편도(single · one-way)';
    if (k === 'party') return TR.PARTY[v] ? TR.PARTY[v].ko : String(v);
    if (k === 'disc') return v ? '할인 카드 있음' : '할인 카드 없음';
    if (k === 'paym') return v === 'card' ? '카드로 내기' : '현금으로 내기';
    if (k === 'amount' || k === 'topAmt') return `${TR.money(v)} (${TR.priceWords(v)})`;
    if (k === 'plat') return `${v}번 승강장`;
    if (k === 'time') return `${TR.timeKo(v)} (${TR.timeWords(v)})`;
    if (k === 'topup') return v ? '가진 카드에 돈 넣기' : '새 카드 사기';
    if (k === 'side') return v === 'other' ? '반대쪽 승강장' : '이쪽 승강장';
    if (k === 'seatFree') return v ? '빈자리' : '누가 앉아 있는 자리';
    const S = Object.values(TR.SLOT).find(s => s.key === k && s.vals && s.vals[v]);
    return S ? S.vals[v].ko : String(v);
  };

  /* ---------- 이미 답한 질문 (시뮬레이터의 상대가 건너뜀) ---------- */
  const KEY2INTENT = { dest: ['dest'], type: ['type'], party: ['count'] };
  TR.coveredBy = (facts, intent) => { const out = new Set(intent ? [intent] : []); Object.keys(facts).forEach(k => (KEY2INTENT[k] || []).forEach(i => out.add(i))); return [...out]; };
  TR.covered = (a, q) => { if (typeof q === 'string') q = TR.Q[q]; return TR.coveredBy(TR.factOf(a), q.intent); };
  TR.coveredKo = cov => cov.filter(i => !['dest'].includes(i)).map(i => TR.INTENT_KO[i]).filter((x, i, a) => x && a.indexOf(x) === i);

  /* =========================================================
     판정 — TR.judge(상대의 말, 대답, 카드, 출처)
     q: TR.Q의 말(또는 id) · a: { f: 틀 id, v: 칸 값, line } · card: 사실 · src: '카드' | '상황'
     ========================================================= */
  const res = (ok, stage, why, tag) => ({ ok, stage, why, tag: tag || (ok ? 'ok' : '') });
  const shapeHead = q => `${q.key.join(' … ')} → ${TR.SHAPE[q.shape].ko}`;
  const VAR_NOTE = { gb: '영국에서는 보통 single · return이라고 해요. one-way · round trip도 알아들어요.', us: '미국에서는 보통 one-way · round trip이라고 해요. single · return도 알아들어요.' };
  TR.judge = function (q, a, card, src = '카드') {
    if (typeof q === 'string') q = TR.Q[q];
    const F = TR.FRAME[a.f], C = Object.assign({}, card || {}, q.fact || {});
    const fi = [].concat(F.intent), key = q.key.join(' … '), In = TR.INTENT[q.intent], SHp = TR.SHAPE[q.shape];
    let allowed = false;
    const notes = [];
    // ① 열쇠 낱말 + 질문의 모양 잡기
    if (q.fast) {
      if (F.intent !== 'repair') return res(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 말했는지 모르는데 짐작해서 답하면 엉뚱한 대답이 될 수 있어요. 먼저 다시 물어요.', 'guess');
      if (q.ann && F.kind !== 'ann') return res(false, 1, '안내방송은 다시 말해 주지 않아요. 옆 사람이나 직원에게 무엇이라고 했는지 물어요 → Excuse me, what did the announcement say?', 'ann');
      if (!q.ann && F.kind === 'ann') return res(false, 1, '안내방송이 아니라 사람이 한 말이에요. 그 사람에게 다시 물어요 → Sorry? Could you say that again, please?', 'intent');
      if (F.kind === 'echo' && F.echo !== q.intent) return res(false, 1, `되물은 말이 달라요. 들린 낱말(${key})로 보면 상대는 ${In.turn}에 대해 말했어요.`, 'intent');
      if (F.kind === 'what') return res(false, 1, '모르는 낱말을 묻는 말이에요. 무엇을 말했는지 못 알아들었으면 다시 말해 달라고 해요.', 'intent');
    } else if (F.bare) {
      if (q.shape === 'or') return res(false, 1, `${shapeHead(q)}. 둘 가운데 하나를 고르라는 말이라 ${F.yes ? 'Yes' : 'No'}만으로는 무엇을 골랐는지 알 수 없어요 → ${In.want}`, 'shape');
      if (q.shape === 'wh') return res(false, 1, `${shapeHead(q)}. 정보를 묻는 말이라 ${F.yes ? 'Yes' : 'No'}로는 답이 안 돼요 → ${In.want}`, 'shape');
      if (q.shape === 'note') return res(false, 1, `열쇠 낱말 ${key} → ${TR.sayOf(q.intent)}. 묻는 말이 아니라서 ${F.yes ? 'Yes' : 'No'}로 답할 일이 아니에요 → ${In.want}`, 'shape');
    } else if (!fi.includes(q.intent)) {
      if (F.intent === 'repair' && q.allow && q.allow.includes(F.id)) allowed = true;
      else if (F.intent === 'repair') return res(false, 1, '대답이 아니라 다시 묻는 말이에요. 알아들었다면 바로 답해요.', 'intent');
      else {
        const other = TR.INTENT[fi[0]];
        return res(false, 1, `${shapeHead(q)}${q.shape === 'note' ? '' : `(${SHp.ans})`}. 이 대답은 ${other.ans}에 맞는 말이에요.`, 'intent');
      }
    }
    // 고르는 질문: 상대가 말한 것 가운데 골랐나
    const fact = TR.factOf(a);
    if (q.shape === 'or' && q.choices && !F.bare && F.intent !== 'repair' && In.key) {
      const v = fact[In.key];
      if (v != null && !q.choices.includes(v)) return res(false, 1, `${shapeHead(q)}. 상대가 말한 것(${q.choices.map(c => TR.factKo(In.key, c)).join(' · ')}) 가운데 하나를 골라요. ${eun(TR.factKo(In.key, v))} 묻지 않았어요.`, 'choice');
    }
    if (F.line) { const o = TR.checkLine(a.line, C); if (!o.ok && o.stage === 1) return res(false, 1, o.why, 'intent'); }
    // ② 틀에 내 정보 넣기
    if (F.tag === 'literal' || F.tag === 'wrong') return res(false, 2, F.why, F.tag);
    if (F.skip) return res(false, 2, F.why, 'need');
    const sv = F.slot ? TR.sv(F.slot, a.v) : null;
    if (F.slot && !sv) return res(false, 2, '칸이 비었어요.', 'fact');
    if (sv && sv.bad) return res(false, 2, sv.why, sv.bad);
    if (F.bare) {
      const Y = In.yn, want = Y && Y.yes ? Y.yes(C) : null;
      if (want != null && want !== F.yes) return res(false, 2, `${wa(src)} 달라요. ${src}: ${F.yes ? 'No' : 'Yes'} 쪽이에요(${In.turn}). 이 대답: ${F.yes ? 'Yes' : 'No'}.`, 'fact');
      if (F.yes && Y && Y.strict) return res(false, 2, Y.strict, 'need');
      if (Y && Y.need && ((q.intent === 'mcard' && C.topup) || (q.intent === 'disc' && F.yes))) notes.push(Y.need);
    }
    if (F.line) { const o = TR.checkLine(a.line, C); if (!o.ok) return res(false, 2, o.why, o.tag || 'order'); }
    if (F.check) {
      for (const k of Object.keys(fact)) if (C[k] != null && fact[k] !== C[k]) return res(false, 2, `들은 값과 달라요. 상대: ${TR.factKo(k, C[k])} · 이 대답: ${TR.factKo(k, fact[k])}.`, 'fact');
    } else {
      for (const k of Object.keys(fact)) {
        if (C[k] === undefined || C[k] === fact[k]) continue;
        return res(false, 2, `${wa(src)} 달라요. ${src}: ${TR.factKo(k, C[k])} · 이 대답: ${TR.factKo(k, fact[k])}.`, 'fact');
      }
    }
    // ③ 공손하게 끝내기
    if (F.tag === 'blunt' || F.tag === 'plain') return res(false, 3, F.why, F.tag);
    // 통과
    const segs = TR.segs(a), pol = segs.filter(s => s.r === 'pol').map(s => s.t).filter((x, i, arr) => arr.indexOf(x) === i);
    let why;
    if (q.fast) why = q.ann ? '안내방송은 다시 말해 주지 않으니, 옆 사람에게 무엇이라고 했는지 물었어요.' : F.kind === 'echo' ? '들린 만큼 되물어 확인했어요. 무엇에 대해 말했는지 알면 그 부분만 다시 물을 수 있어요.' : F.kind === 'slow' ? '천천히 말해 달라고 공손하게 부탁했어요.' : '못 알아들었을 때는 짐작하지 말고 공손하게 다시 물어요.';
    else if (allowed) why = '모르는 낱말은 짐작하지 말고 물어요. 직원이 쉬운 말로 다시 알려 줄 거예요.';
    else if (F.line) why = `${TR.checkLine(a.line, C).why} 상대가 That's right!라고 확인해 줄 거예요.`;
    else if (F.check) why = `들은 값(${Object.keys(fact).map(k => TR.factKo(k, fact[k])).join(' · ')})과 같아요. 숫자는 이렇게 되짚어 확인해요.`;
    else if (F.bare) why = `${shapeHead(q)} → ${SHp.ans}. Yes/No 질문이라 ${F.yes ? 'Yes' : 'No'}로 답할 수 있어요.`;
    else {
      const sl = segs.filter(s => s.r === 'slot').map(s => s.t), fk = Object.keys(fact).filter(k => fact[k] != null);
      why = `${shapeHead(q)} → ${SHp.ans}. ` + (sl.length ? `틀 + 내 정보(${sl.join(' ')}) → ${src}의 사실과 맞아요.` : fk.length ? `${src}의 사실(${fk.map(k => TR.factKo(k, fact[k])).join(' · ')})과 맞아요.` : '짧은 대답이면 충분해요.');
      if (q.shape === 'yn' && In.offer && !/^(Yes|No)\b/.test(TR.text(a))) why += ` ${SHp.offer}.`;
      const cov = TR.coveredKo(TR.covered(a, q).filter(i => i !== q.intent));
      if (cov.length) why += ` ${cov.join(' · ')}까지 말해서 직원이 그 질문을 건너뛰어요.`;
    }
    if (pol.length) why += ` 공손한 말 → ${pol.join(' · ')}.`;
    if (sv && sv.var && q.variety && sv.var !== q.variety) why += ` 알림: ${VAR_NOTE[q.variety]}`;
    notes.forEach(n => { why += ` ${n}`; });
    if (F.note) why += ` ${F.note}`;
    if (sv && sv.note) why += ` ${sv.note}`;
    return res(true, 0, why);
  };
  // 모범 대답 (카드에 맞춰)
  const ECHO_OF = { dest: 'rp_dest', plat: 'rp_plat', route: 'rp_where', disc: 'rp_disc' };
  TR.model = function (q, card) {
    if (typeof q === 'string') q = TR.Q[q];
    const C = Object.assign({}, card || {}, q.fact || {});
    if (q.fast) return { f: q.ann ? 'rp_ann' : ECHO_OF[q.intent] || 'rp_again' };
    if (q.intent === 'route') { const R = tripOf(C); return R ? TR.modelLine(R) : { f: 'ro_ok' }; }
    const In = TR.INTENT[q.intent], id = typeof In.best === 'function' ? In.best(C) : In.best, F = TR.FRAME[id];
    if (!F.slot) return { f: id };
    const v = TR.slotVal(F.slot, C, q);
    return { f: id, v: v != null ? String(v) : (TR.SLOT[F.slot].dyn ? undefined : slotIds(F.slot)[0]) };
  };
  // 되짚는 한 줄의 모범 (들은 길 그대로)
  TR.modelLine = R => ({ f: 'line', line: { words: TR.lineWords(R) } });

  /* =========================================================
     소리로 한 대답 맞춰 보기 — TR.matchSpoken(들린 글, 말, 카드)
     음성 인식이 글로 바꾼 말에 그 말의 표시 낱말과 카드의 사실이 들어 있으면 받아들여요.
     질문의 모양 규칙은 같아요: 고르는 질문 · 정보 질문에 yes · no만 들리면 ①. 숫자는 낱말(fourteen fifty · ten fifteen)이든 숫자든 같게 맞춰요.
     되짚기는 들린 노선 · 방향 · 역 이름을 차례대로 모아 TR.checkLine으로 맞춰 봐요. 문법 · 공손함 · 발음은 판정하지 않아요(알림만 붙여요).
     ========================================================= */
  const CONTR = [[/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\bwhat's\b/g, 'what is'], [/\bdon't\b/g, 'do not'], [/\bdidn't\b/g, 'did not'], [/\bi've\b/g, 'i have'], [/\bi'll\b/g, 'i will'], [/\bcan't\b/g, 'cannot'], [/\bi'd\b/g, 'i would'], [/\byou're\b/g, 'you are'], [/\bthat's\b/g, 'that is'], [/\bthere's\b/g, 'there is'], [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bdoesn't\b/g, 'does not'], [/\bsomeone's\b/g, 'someone is'], [/\bhere's\b/g, 'here is'], [/\bwhere's\b/g, 'where is'], [/\blet's\b/g, 'let us'], [/\bo'clock\b/g, 'oclock']];
  TR.norm = function (s) {
    let t = String(s || '').toLowerCase().replace(/[’‘]/g, '\'');
    CONTR.forEach(([r, w]) => { t = t.replace(r, w); });
    t = t.replace(/\$/g, ' ').replace(/(\d)\.(\d)/g, '$1 $2').replace(/(\d):(\d)/g, '$1 $2').replace(/%/g, ' percent ').replace(/[^a-z0-9' -]+/g, ' ').replace(/-/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '');
    return t.split(/\s+/).filter(Boolean);
  };
  const W2N = {}; Object.entries(NUMW).forEach(([n, w]) => { W2N[w] = +n; });
  // 낱말 → 숫자 줄로 모음: fourteen fifty → 1450 · ten fifteen → 1015 · 14.50 → 1450 · platform four → platform 4
  TR.canon = function (s) {
    const w = TR.norm(s), out = [];
    let run = null;
    const flush = () => { if (run != null) { out.push(run); run = null; } };
    for (let i = 0; i < w.length; i++) {
      const x = w[i];
      let d = null;
      if (/^\d+$/.test(x)) d = x;
      else if ((x === 'oh' || x === 'o') && run != null) d = '0';
      else if (x === 'oclock' && run != null) d = '00';
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
  // 들린 값 (센트): fourteen fifty → 1450 · twenty dollars → 2000 · 14 50 → 1450
  const heardMoney = toks => { const i = toks.findIndex(t => /^\d+$/.test(t)); if (i < 0) return null; const r = toks[i]; return r.length <= 2 || /^dollars?$/.test(toks[i + 1] || '') ? +r * 100 : +r; };
  // 들린 승강장 · 시각: platform 4 at 1015 → { plat: 4, time: '10:15' }
  const heardPT = toks => {
    const out = {};
    const pi = toks.indexOf('platform');
    if (pi >= 0 && /^\d+$/.test(toks[pi + 1] || '')) { const r = toks[pi + 1]; out.plat = +(r.length > 2 ? r.slice(0, r.length - 4 > 0 ? r.length - 4 : 1) : r); if (r.length > 2) { const tt = r.slice(String(out.plat).length); if (tt.length >= 3) out.time = tt.slice(0, tt.length - 2) + ':' + tt.slice(-2); } }
    const tr = toks.find((t, i) => /^\d{3,4}$/.test(t) && toks[i - 1] !== 'platform');
    if (tr && !out.time) out.time = String(+tr.slice(0, tr.length - 2)) + ':' + tr.slice(-2);
    return out;
  };
  TR.heardPT = heardPT;
  const BARE_RE = /^(yes|yeah|yep|no|nope|please|sure|thanks|thank|you|okay|ok|of|course|it|is|i|do|am|not|that|would|like|great|uh|um|well)$/;
  const REPAIR_RE = /\b(say that again|pardon|repeat|more slowly|slow down|sorry what|come again)\b|^ ?sorry ?$/;
  const STN_RE = TR.STN_IDS.map(id => [id, new RegExp('\\b' + TR.STN[id].en.toLowerCase().replace(/ /g, ' ?').replace('harbor', 'harbou?r') + '\\b', 'g')]);
  const stnHeard = s => { const hit = STN_RE.map(([id, r]) => { r.lastIndex = 0; const m = r.exec(s); return m ? [id, m.index] : null; }).filter(Boolean).sort((a, b) => a[1] - b[1]); return hit.length ? hit[0][0] : null; };
  const townHeard = s => TR.TOWN_IDS.find(id => new RegExp('\\b' + id + '\\b').test(s)) || null;
  // 되짚는 말에서 조각 모으기 → 줄 낱말 (들린 차례대로)
  TR.parseLine = function (raw) {
    const s = ' ' + TR.norm(raw).join(' ') + ' ', hits = [];
    const stn = '(' + TR.STN_IDS.map(id => TR.STN[id].en.toLowerCase().replace(/ /g, ' ?').replace('harbor', 'harbou?r')).join('|') + ')';
    const idOf = name => TR.STN_IDS.find(id => new RegExp('^' + TR.STN[id].en.toLowerCase().replace(/ /g, ' ?').replace('harbor', 'harbou?r') + '$').test(name));
    const scan = (re, fn) => { re.lastIndex = 0; let m; while ((m = re.exec(s))) { const w = fn(m); if (w) hits.push([m.index, w]); } };
    scan(/\b(green|blue|red)( line)?\b/g, m => { const before = s.slice(Math.max(0, m.index - 14), m.index); return (/\b(to|onto|for)( the)? $/.test(before) ? 'to_' : 'tk_') + m[1]; });
    scan(new RegExp('\\b(towards?|toward|direction of|heading to|going to) (the )?' + stn + '\\b', 'g'), m => { const id = idOf(m[3]); return id ? 'tw_' + id : null; });
    scan(new RegExp('\\b(change|transfer|switch)( trains| lines)? (at|in) ' + stn + '\\b', 'g'), m => { const id = idOf(m[4]); return id ? 'ch_' + id : null; });
    scan(new RegExp('\\b(get off|get out|off) at ' + stn + '\\b', 'g'), m => { const id = idOf(m[2]); return id ? 'of_' + id : null; });
    scan(new RegExp('\\bget down at ' + stn + '\\b', 'g'), m => { const id = idOf(m[1]); return id ? 'gd_' + id : null; });
    hits.sort((a, b) => a[0] - b[0]);
    return ['so'].concat(hits.map(h => h[1]));
  };
  TR.matchSpoken = function (raw, q, card) {
    if (typeof q === 'string') q = TR.Q[q];
    const toks = TR.canon(raw), s = ' ' + toks.join(' ') + ' ', heard = TR.norm(raw).join(' ');
    if (!toks.length) return { ok: false, stage: 0, why: '들린 말이 없어요. 다시 말해 보세요.', heard: '' };
    const C = Object.assign({}, card || {}, q.fact || {}), SHp = TR.SHAPE[q.shape], It = TR.INTENT[q.intent];
    const R = (ok, stage, why, o = {}) => Object.assign({ ok, stage, why, heard }, o);
    const notes = [];
    const pass = (why, cov) => R(true, 0, why + (notes.length ? ' 알림: ' + notes.join(' ') : ''), { note: notes.join(' '), covered: cov || [q.intent] });
    const keyMiss = () => R(false, 1, `${shapeHead(q)}(${SHp.ans}). 들린 말에 그 대답이 없어요.`);
    const differ = (k, v) => R(false, 2, `카드와 달라요. 카드: ${TR.factKo(k, C[k])} · 들린 말: ${TR.factKo(k, v)}.`, { tag: 'fact' });
    const nums = runs(toks);
    const lit = id => R(false, 2, TR.FRAME[id].why, { tag: 'literal' });
    // 빠른 말 · 안내방송: 다시 묻는 말만 (들린 만큼 되묻는 말은 실제 말과 같아야)
    if (q.fast) {
      if (q.ann) return /\b(announcement|what did (it|they|that|he|she) say)\b/.test(s) ? R(false, 1, '옆 사람에게 안내방송을 물었어요. 무엇이라고 했는지 알려 줄 거예요.', { repair: 'again' }) : R(false, 1, '안내방송은 다시 말해 주지 않아요. 옆 사람에게 물어요 → Excuse me, what did the announcement say?');
      const echo = /\bwhich platform\b|\bplatform (number|what)\b/.test(s) ? 'plat' : /\b(where|which station)( do| should)? (i|we) (change|transfer)\b|\bchange where\b/.test(s) ? 'route' : /\b(where i am going|where am i going|my destination|where i am headed)\b/.test(s) ? 'dest' : /\bdiscount\b/.test(s) ? 'disc' : null;
      if (echo) return echo === q.intent ? R(false, 1, '들린 만큼 되물었어요. 상대가 다시 말해 줄 거예요.', { repair: 'again' }) : R(false, 1, `되물은 말이 달라요. 들린 낱말(${q.key.join(' … ')})로 보면 상대는 ${It.turn}에 대해 말했어요.`);
      if (/\bannouncement\b/.test(s)) return R(false, 1, '안내방송이 아니라 사람이 한 말이에요. 그 사람에게 다시 물어요 → Sorry? Could you say that again, please?');
      if (REPAIR_RE.test(s) || /\b(sorry|again|slowly)\b/.test(s)) return R(false, 1, '다시 묻는 말로 들었어요. 상대가 한 번 더 말해 줄 거예요.', { repair: 'again' });
      return R(false, 1, '너무 빨라서 열쇠 낱말을 못 잡았어요. 짐작해서 답하지 말고 먼저 다시 물어요 → Sorry? Could you say that again, please?');
    }
    // 모르는 낱말 묻기 (off-peak · railcard)
    if (q.allow && /\bwhat is (an? )?(off peak|railcard|rail card)\b/.test(s)) return R(false, 1, '모르는 낱말을 물었어요. 직원이 쉬운 말로 알려 줄 거예요.', { repair: 'what' });
    // 들은 값을 되묻는 말 (Sorry, did you say fourteen fifty?)
    if (/\b(did you say|was that|is that)\b/.test(s) && nums.length && q.intent === 'cost') {
      const amt = heardMoney(toks), want = C.amount;
      if (want != null && amt !== want) return R(false, 2, `직원이 말한 값과 달라요. 직원: ${TR.factKo('amount', want)} · 들린 말: ${TR.factKo('amount', amt)}.`, { tag: 'fact' });
      return R(false, 1, '들은 값을 되물어 확인했어요. 직원이 맞다고 할 거예요.', { repair: 'check' });
    }
    if ((REPAIR_RE.test(s) || /\b(could you say|say again)\b/.test(s)) && toks.length <= 9) return R(false, 1, '다시 묻는 말로 들었어요. 상대가 한 번 더 말해 줄 거예요.', { repair: 'again' });
    if (/\b(give me|i want)\b/.test(s)) notes.push('Give me · I want는 명령하거나 조르는 말처럼 들려요(말로 한 대답은 말투를 판정하지 않아요) → To Oakbridge, please. · Can I pay by card?');
    const bare = toks.every(t => BARE_RE.test(t)) && /\b(yes|yeah|yep|no|nope|sure|okay|ok)\b/.test(s);
    const yesHeard = /\b(yes|yeah|yep|sure|okay|ok)\b/.test(s), noHeard = /\b(no|nope)\b/.test(s);
    if (bare && (q.shape === 'or' || q.shape === 'wh')) return R(false, 1, `${shapeHead(q)}. ${q.shape === 'or' ? '둘 가운데 하나를 고르라는 말이라 yes · no만으로는 무엇을 골랐는지 알 수 없어요' : '정보를 묻는 말이라 yes · no로는 답이 안 돼요'} → ${It.want}`, { tag: 'shape' });
    if (bare && q.shape === 'note') return R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${TR.sayOf(q.intent)} → ${It.want}`, { tag: 'shape' });
    if (q.shape === 'or' && yesHeard && !bare) notes.push('고르는 질문에는 Yes 없이 고른 것만 말해도 돼요.');
    const typeOf = () => /\b(go and (come )?back|go back ticket)\b/.test(s) ? 'goback' : /\b(round trip|return)\b/.test(s) ? (/\bround trip\b/.test(s) ? 'round' : 'return') : /\b(single|(?:one|1) way)\b/.test(s) ? (/\b(?:one|1) way\b/.test(s) ? 'oneway' : 'single') : null;
    const typeCheck = (v, cov) => {
      const x = TR.SLOT.ttype.vals[v];
      if (x.bad) return R(false, 2, x.why, { tag: 'literal' });
      if (C.type != null && x.fact.type !== C.type) return differ('type', x.fact.type);
      if (q.variety && x.var !== q.variety) notes.push(VAR_NOTE[q.variety]);
      cov.push('type');
      return null;
    };
    switch (q.intent) {
      case 'dest': {
        if (/\bi go to\b/.test(s)) return lit('ds_go');
        const t = townHeard(s);
        if (!t) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.dest && t !== C.dest) return differ('dest', t);
        const cov = ['dest'], tv = typeOf();
        if (tv) { const e = typeCheck(tv, cov); if (e) return e; }
        return pass('어디까지 가는지 들렸고 카드와 맞아요.', cov);
      }
      case 'type': {
        const v = typeOf();
        if (!v) return keyMiss();
        const cov = [], e = typeCheck(v, cov); if (e) return e;
        return pass('고른 표가 들렸고 카드와 맞아요.', cov);
      }
      case 'count': {
        if (/\bme alone\b|\balone\b/.test(s)) return R(false, 2, TR.SLOT.party.vals.alone.why, { tag: 'literal' });
        let a = null, c = 0;
        if (/\b(just me|only me|just myself|just (?:one|1)|only (?:one|1)|(?:one|1) person|myself)\b/.test(s)) a = 1;
        const ma = /\b(\d+) (adults?|people|persons)\b/.exec(s), mc = /\b(\d+) (child|children|kids?)\b/.exec(s);
        if (ma) a = +ma[1]; if (/\ban adult\b|\bone adult\b/.test(s)) a = 1; if (mc) c = +mc[1]; if (/\ba (child|kid)\b/.test(s)) c = 1;
        if (/\bpersons\b/.test(s)) notes.push(TR.SLOT.party.vals.p2.note);
        if (a == null) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        const id = c ? `a${a}c${c}` : `a${a}`;
        if (C.party != null && id !== C.party) return differ('party', TR.PARTY[id] ? id : `어른 ${a}명${c ? ` · 어린이 ${c}명` : ''}`);
        return pass('몇 명인지 들렸고 카드와 맞아요.');
      }
      case 'peak': case 'seat': {
        const v = q.intent === 'peak' ? (/\boff peak\b/.test(s) ? 'offpeak' : /\b(anytime|any time)\b/.test(s) ? 'anytime' : null) : (/\bwindow\b/.test(s) ? 'window' : /\baisle\b/.test(s) ? 'aisle' : null);
        if (!v) return keyMiss();
        if (q.choices && !q.choices.includes(v)) return R(false, 1, `${shapeHead(q)}. 상대가 말한 것 가운데 하나를 골라요.`, { tag: 'choice' });
        if (C[q.intent] != null && v !== C[q.intent]) return differ(q.intent, v);
        return pass('고른 것이 들렸고 카드와 맞아요.');
      }
      case 'disc': {
        const y = yesHeard || /\b(i do|here it is|here you go|here you are|i have (?:one|1))\b/.test(s), n = noHeard || /\b(i do not|i have not)\b/.test(s);
        if (!y && !n) return keyMiss();
        const v = !n;
        if (C.disc != null && v !== C.disc) return differ('disc', v);
        if (/\bi do not have ?$/.test(s)) notes.push('No, I don\'t have.는 have 뒤가 비어서 문장이 끝나지 않아요(말로 한 대답은 문법을 판정하지 않아요) → No, I don\'t.');
        return pass(v ? '있다는 말이 들렸고 카드와 맞아요.' : '없다는 말이 들렸고 카드와 맞아요.');
      }
      case 'cost': {
        if (/\bcard is (okay|ok|possible|fine)\b/.test(s)) return lit('co_lit');
        if (/\b(expensive|cheaper)\b/.test(s)) notes.push('기차표 값은 깎지 않아요(말로 한 대답은 말투를 판정하지 않아요).');
        const v = /\bcard\b/.test(s) ? 'card' : /\b(cash|here you go|here you are|here it is)\b/.test(s) ? 'cash' : null;
        if (!v) return bare ? R(false, 1, `열쇠 낱말 ${q.key.join(' … ')} → ${TR.sayOf(q.intent)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.paym != null && v !== C.paym) return differ('paym', v);
        return pass(v === 'card' ? '카드로 내겠다는 말이 들렸어요.' : '현금을 건네는 말이 들렸어요.');
      }
      case 'plat': {
        if (/\bplatform where\b/.test(s)) return lit('pt_where');
        const h = heardPT(toks);
        if (h.plat == null && !h.time) return /\b(thank|thanks|okay|ok|great)\b/.test(s) ? R(false, 2, '고맙다고만 하면 들은 숫자가 맞는지 확인하지 못해요. 승강장과 시각은 되짚어 확인해요 → ' + TR.text(TR.model(q, C)), { tag: 'need' }) : keyMiss();
        if (h.plat != null && C.plat != null && h.plat !== C.plat) return R(false, 2, `들은 값과 달라요. 상대: ${C.plat}번 승강장 · 들린 말: ${h.plat}번 승강장.`, { tag: 'fact' });
        if (h.time && C.time && h.time !== C.time) return R(false, 2, `들은 값과 달라요. 상대: ${TR.factKo('time', C.time)} · 들린 말: ${TR.factKo('time', h.time)}.`, { tag: 'fact' });
        if (h.plat == null || !h.time) return R(false, 2, `${h.plat == null ? '승강장' : '시각'}도 되짚어요 → ${TR.text(TR.model(q, C))}`, { tag: 'need' });
        return pass('들은 승강장과 시각을 되짚었어요. 숫자가 맞아요.');
      }
      case 'askway': {
        if (/\bteach\b/.test(s)) return lit('aw_teach');
        const st = stnHeard(s);
        if (!st) return keyMiss();
        if (!/\b(how|which line|which train|way to|get to|go to)\b/.test(s)) return lit('aw_lit');
        if (/^ ?\S+( \S+)? how ?$/.test(s)) return lit('aw_lit');
        if (C.to && st !== C.to) return differ('to', st);
        return pass('가려는 역과 묻는 말이 들렸어요.');
      }
      case 'mcard': {
        if (/\bcharge\b/.test(s)) return lit('mc_charge');
        const top = /\b(top up|top it up|reload|add money|put money|add some money|put some money)\b/.test(s), nw = /\b(new card|a new (?:one|1)|yes|yeah|please|sure)\b/.test(s) && !top;
        if (!top && !nw) return noHeard && C.topup ? (notes.push(It.yn.need), pass('새 카드는 필요 없다는 말이 들렸어요.')) : keyMiss();
        const v = top;
        if (C.topup != null && v !== C.topup) return differ('topup', v);
        return pass(v ? '가진 카드에 돈을 넣고 싶다는 말이 들렸어요.' : '새 카드가 필요하다는 말이 들렸어요.');
      }
      case 'topamt': {
        const amt = heardMoney(toks);
        if (amt == null) return bare ? R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' }) : keyMiss();
        if (C.topAmt != null && amt !== C.topAmt) return differ('topAmt', amt);
        return pass('넣을 돈이 들렸고 카드와 맞아요.');
      }
      case 'route': {
        const ws = TR.parseLine(raw);
        if (ws.length <= 1) return /\b(thank|thanks|okay|ok|got it|great)\b/.test(s) ? R(false, 2, TR.FRAME.ro_ok.why, { tag: 'need' }) : keyMiss();
        if (!/^ ?(so|okay so|ok so|alright so)\b/.test(s)) notes.push('되짚을 때는 So, I …?로 시작하면 확인하는 말인 것이 잘 드러나요.');
        const o = TR.checkLine({ words: ws }, C);
        if (!o.ok) return R(false, o.stage || 2, o.why, { tag: o.tag || 'fact', line: ws, fix: TR.fixLine({ words: ws }, C) });
        return pass('들은 조각을 차례대로 빠짐없이 되짚었어요.', ['route']);
      }
      case 'more': {
        if (yesHeard && !noHeard) return R(false, 2, '카드와 달라요. 카드: 더 도와줄 것은 없어요.', { tag: 'fact' });
        if (!(noHeard || /\b(that is all|that is it|i am good|i am fine|all good|thank|thanks)\b/.test(s))) return keyMiss();
        if (!/\b(thank|thanks)\b/.test(s)) notes.push('No만 하면 무뚝뚝하게 들릴 수 있어요 → No, that\'s all. Thank you so much!');
        return pass('그거면 된다는 말이 들렸어요.');
      }
      case 'board': {
        const st = stnHeard(s);
        if (!st) return keyMiss();
        if (!/\b(go|goes|going|platform|stop|stops)\b/.test(s)) return lit('bd_lit');
        if (/\bis this train go\b/.test(s)) notes.push('is와 go를 함께 쓰면 문장이 틀려요(말로 한 대답은 문법을 판정하지 않아요) → Does this train go to …?');
        if (C.to && st !== C.to) return differ('to', st);
        return pass('이 열차가 가려는 역에 가는지 묻는 말이 들렸어요.');
      }
      case 'wrongway': {
        const side = /\bother side\b|\bother platform\b|\bacross\b/.test(s) ? 'other' : /\bthis side\b/.test(s) ? 'this' : null;
        if (side === 'this') return R(false, 2, '상대는 반대쪽(the other side)이라고 했어요.', { tag: 'fact' });
        if (!side && !/\b(thank|thanks)\b/.test(s)) return keyMiss();
        if (!/\b(thank|thanks)\b/.test(s)) notes.push('고맙다는 말도 붙여요 → Oh, the other side. Thank you!');
        return pass('들은 것을 되짚었어요.');
      }
      case 'seatq': {
        if (yesHeard && /\b(sit down|go ahead|please sit|have a seat)\b/.test(s) && !noHeard) return lit('sq_yes');
        const free = /\b(no|nope|go ahead|not at all|it is free|it is empty|nobody)\b/.test(s), taken = /\b(someone|somebody|taken|saving)\b/.test(s) || (yesHeard && !noHeard);
        if (!free && !taken) return keyMiss();
        const v = free && !/\b(someone is|somebody is|taken|saving)\b/.test(s);
        if (C.seatFree != null && v !== C.seatFree) return differ('seatFree', v);
        return pass(v ? '빈자리라는 말이 들렸어요.' : '누가 앉아 있다는 말이 들렸어요.');
      }
      default: return R(false, 0, '이 말은 말로 대답하기를 지원하지 않아요.');
    }
  };

  /* ---------- 따라 말하기: 낱말 맞춰 보기 (가장 긴 공통 부분열, 숫자는 같은 숫자로) ---------- */
  TR.compareWords = function (target, heard) {
    const tw = String(target).split(/\s+/).filter(Boolean), tt = [];
    tw.forEach((x, i) => TR.canon(x).forEach(p => tt.push({ p, i })));
    const A = tt.map(x => x.p), B = TR.canon(heard), D = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) D[i][j] = A[i] === B[j] ? D[i + 1][j + 1] + 1 : Math.max(D[i + 1][j], D[i][j + 1]);
    const got = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { got.add(i); i++; j++; } else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++; }
    const okW = tw.map((_, k) => { const parts = tt.map((x, n) => [x, n]).filter(([x]) => x.i === k); return parts.length ? parts.every(([, n]) => got.has(n)) : true; });
    return { words: tw.map((t, k) => ({ t, ok: okW[k] })), hit: okW.filter(Boolean).length, total: tw.length };
  };

  /* =========================================================
     여행 카드 (여행 시뮬레이터): 기차표 사기 + 지하철 갈아타기
     ========================================================= */
  TR.TIMES = ['9:13', '9:30', '9:14', '9:40', '10:15', '10:50', '11:13', '11:30', '2:14', '2:40', '3:15', '3:50'];
  TR.goodRoute = R => !!R && R.transfers <= 1 && R.legs.every(L => L.stops <= 4) && R.stops >= 2;
  TR.TRIPS = [];
  TR.STN_IDS.forEach(a => TR.STN_IDS.forEach(b => { if (a === b) return; const R = TR.route(a, b); if (TR.goodRoute(R) && (R.transfers === 1 || (a + b).length % 3 === 0)) TR.TRIPS.push([a, b]); }));
  TR.newCard = function (rnd = Math.random) {
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const [from, to] = pick(TR.TRIPS);
    const c = { dest: pick(TR.TOWN_IDS), type: pick(['single', 'return']), party: pick(['a1', 'a2', 'a1c1', 'a2c1']), peak: pick(['offpeak', 'anytime']), seat: pick(['window', 'aisle']),
      disc: rnd() < 0.4, paym: pick(['card', 'cash']), plat: 1 + Math.floor(rnd() * 9), time: pick(TR.TIMES), us: rnd() < 0.5,
      topup: rnd() < 0.6, topAmt: pick([1000, 1500, 2000, 3000, 5000]), from, to, seatFree: rnd() < 0.7 };
    c.amount = TR.fare(c);
    return c;
  };
  // 상대가 말하는 차례 (이미 답한 질문은 건너뜀)
  TR.simQs = c => ['ct_where', c.us ? 'tk_us' : 'tk_type', 'tk_many', 'tk_peak', 'tk_seat', 'fr_disc', 'fr_cost', 'pl_info', 'in_next', 'in_card'].concat(c.topup ? ['in_amt'] : [], ['ro_say', 'ro_more', 'tb_note', 'tb_seat']);
  // 카드에 따라 바뀌는 말 (값 · 승강장과 시각 · 갈아타는 길)
  TR.simQ = function (id, c) {
    const q = TR.Q[id];
    if (id === 'fr_cost') return Object.assign({}, q, { en: `Okay, that's ${TR.money(c.amount)}, please.`, ko: `네, ${ieyo(TR.priceKo(c.amount))}.`, key: [TR.money(c.amount)], fact: { amount: c.amount }, short: `That's ${TR.money(c.amount)}.` });
    if (id === 'pl_info') return Object.assign({}, q, { en: `It leaves at ${c.time} from platform ${c.plat}.`, ko: `${TR.timeKo(c.time)}에 ${c.plat}번 승강장에서 떠나요.`, fact: { plat: c.plat, time: c.time }, short: `It leaves at ${c.time} from platform ${c.plat}.` });
    if (id === 'ro_say') { const R = TR.route(c.from, c.to); return Object.assign({}, q, { en: TR.say(R), ko: TR.sayKo(R), key: R.transfers ? ['change at'] : ['get off at'], fact: { from: c.from, to: c.to } }); }
    return q;
  };
  TR.PLACE_OF = id => TR.Q[id].place;
  // 질문마다 틀 칩: 맞는 틀 · 한국어 그대로(콩글리시 · 무례한 말 · Yes만) 틀 · 다른 질문의 틀. route는 되짚기 조각 칩(TR.lineChips)으로 말해요
  TR.SIM_FRAMES = {
    dest: ['ds_to', 'ds_give', 'g_yes'],
    type: ['tt_pl', 'g_yesp', 'pc_pl'],
    count: ['pc_pl', 'g_yes', 'tt_pl'],
    peak: ['pk_pl', 'g_yesp', 'se_pl'],
    seat: ['se_pl', 'g_yesp', 'pk_pl'],
    disc: c => c.disc ? ['dc_yes', 'dc_have', 'dc_no'] : ['dc_no', 'dc_have', 'dc_yes'],
    cost: c => c.paym === 'card' ? ['co_card', 'co_lit', 'co_here'] : ['co_here', 'co_exp', 'co_card'],
    plat: ['pt_so', 'pt_where', 'g_yes'],
    askway: ['aw_how', 'aw_teach', 'g_yes'],
    mcard: c => c.topup ? ['mc_top', 'mc_charge', 'g_yesp'] : ['g_yesp', 'mc_charge', 'mc_top'],
    topamt: ['ta_pl', 'g_yes', 'pc_pl'],
    route: ['line', 'ro_ok'],
    more: ['mr_no', 'mr_plain', 'g_yesp'],
    board: ['bd_does', 'bd_wrong', 'bd_lit'],
    seatq: c => c.seatFree === false ? ['sq_taken', 'sq_yes', 'sq_go'] : ['sq_go', 'sq_yes', 'sq_taken'],
    wrongway: ['ww_thx', 'ww_bye', 'ww_this'],
  };
  TR.simFrames = (intent, c) => { const x = TR.SIM_FRAMES[intent]; return typeof x === 'function' ? x(c) : x ? x.slice() : null; };
  // 칸 칩: 카드의 값 + 헷갈리기 쉬운 값 둘 (값 · 시각은 fourteen · forty 같은 이웃 값)
  const neighStn = id => { const out = []; TR.linesAt(id).forEach(l => { const s = TR.LINES[l].st, i = s.indexOf(id); [s[i - 1], s[i + 1]].forEach(x => { if (x && !out.includes(x)) out.push(x); }); }); return out; };
  TR.neighStn = neighStn;
  const moneyTrap = a => { const d = Math.floor(a / 100), k = a % 100, t = TR.teenSwap(d); return t != null ? t * 100 + k : a + 1000; };
  TR.moneyTrap = moneyTrap;
  const timeTrap = t => { const [h, m] = t.split(':').map(Number), s = TR.teenSwap(m); return s != null && s < 60 ? `${h}:${String(s).padStart(2, '0')}` : `${h}:${String((m + 5) % 60).padStart(2, '0')}`; };
  TR.timeTrap = timeTrap;
  TR.slotChoices = function (slot, card, rnd = Math.random, q) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let out;
    if (slot === 'money' || slot === 'topm') {
      const a = slot === 'money' ? card.amount : card.topAmt;
      out = [a, moneyTrap(a), a >= 200 ? a - 100 : a + 100].map(String);
    } else if (slot === 'pt') {
      out = [TR.ptVal(card.plat, card.time), TR.ptVal(card.plat, timeTrap(card.time)), TR.ptVal(card.plat === 9 ? 8 : card.plat + 1, card.time)];
    } else if (slot === 'st') {
      const r = card.to; out = [r].concat(shuffle(neighStn(r)).slice(0, 2));
    } else if (slot === 'ttype') {
      const vr = (q && q.variety) || 'gb', ids = vr === 'us' ? ['oneway', 'round'] : ['single', 'return'];
      const right = ids.find(id => TR.SLOT.ttype.vals[id].fact.type === card.type);
      out = [right, ids.find(id => id !== right), 'goback'];
    } else if (slot === 'party') {
      const r = card.party || 'a1', near = { a1: ['alone', 'a2'], a2: ['a1', 'a2c1'], a3: ['a2', 'a2c1'], a1c1: ['a2', 'a2c1'], a2c1: ['a1c1', 'a2c2'], a2c2: ['a2c1', 'a2'] }[r];
      out = [r === 'a1' ? 'me1' : r].concat(near);
    } else {
      const right = TR.slotVal(slot, card, q), keys = shuffle(slotIds(slot).filter(k => k !== right));
      out = (right ? [right] : []).concat(keys.slice(0, right ? 2 : 3));
    }
    return shuffle(out.filter((x, i, a) => x != null && a.indexOf(x) === i));
  };
  // 되짚기 조각 칩 (자리마다 맞는 조각 + 헷갈리기 쉬운 조각) — 차례대로 고르면 한 줄이 돼요
  TR.lineChips = function (c, rnd = Math.random) {
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const R = TR.route(c.from, c.to), [a, b] = R.legs, other = l => TR.LINE_IDS.filter(x => x !== l)[Math.floor(rnd() * 2)];
    const out = [{ c: 'take', ids: shuffle(['tk_' + a.line, 'tk_' + other(a.line)]) }, { c: 'dir', ids: shuffle(['tw_' + a.towards, 'tw_' + TR.otherEnd(a.line, a.towards)]) }];
    if (b) {
      const hub2 = TR.HUBS.filter(h => h !== b.from && TR.linesAt(h).includes(a.line))[0] || TR.HUBS.find(h => h !== b.from);
      out.push({ c: 'change', ids: shuffle(['ch_' + b.from, 'ch_' + hub2]) }, { c: 'take2', ids: shuffle(['to_' + b.line, 'to_' + TR.LINE_IDS.find(x => x !== b.line && x !== a.line)]) });
    }
    const nb = neighStn(R.to).filter(x => x !== R.from)[0];
    out.push({ c: 'off', ids: shuffle(['of_' + R.to, 'of_' + nb, 'gd_' + R.to]) });
    return out;
  };
  TR.cardRows = c => {
    const P = TR.PARTY[c.party], R = TR.route(c.from, c.to);
    return [
      ['기차표', `${TR.TOWNS[c.dest].ko} · ${c.type === 'return' ? '왕복' : '편도'} · ${P.ko}`],
      ['시간대 · 자리', `${c.peak === 'offpeak' ? '덜 붐비는 시간(off-peak)' : '아무 때나(anytime)'} · ${c.seat === 'window' ? '창가' : '통로'}`],
      ['할인 · 내기', `학생 카드 ${c.disc ? '있음' : '없음'} · ${c.paym === 'card' ? '카드' : '현금'}`],
      ['지하철 카드', c.topup ? `가진 카드에 ${TR.money(c.topAmt)} 넣기` : '새 카드 사기'],
      ['지하철', `${TR.STN[c.from].ko} → ${TR.STN[c.to].ko}${R.transfers ? ' (갈아타기 한 번)' : ''}`],
      ['열차 안', c.seatFree ? '옆자리가 비어 있음' : '옆자리에 친구 가방(친구 자리)'],
    ];
  };
  // 상대의 반응 (단계별)
  const BAD_REACT = {
    goback: ['Sorry — a go-and…? Oh, a return?', '왕복 → a return · round trip.'], alone: ['Oh… just one adult, then?', '혼자 → Just me, please.'],
    ds_go: ['Sorry — you go there often?', '행선지 → To Oakbridge, please.'], co_lit: ['Sorry — is the card okay?', '카드로 → Can I pay by card?'],
    pt_where: ['Platform 4 — like I said.', '들은 숫자를 되짚어요 → So, platform 4 at 10:15?'], aw_teach: ['Teach you…? Oh, you need directions?', '길 묻기 → How do I get to …?'],
    aw_lit: ['Sorry?', '묻는 틀 → How do I get to …?'], mc_charge: ['Charge… pay by card? Or add money?', '충전 → top up (add money).'],
    bd_lit: ['Sorry — this train what?', '열차 확인 → Does this train go to …?'], bd_wrong: ['Oh — does it go there? Yes.', 'does this train go to …?'],
    sq_yes: ['Oh — someone\'s sitting here?', '빈자리면 → No, go ahead.'], dc_have: ['Sorry — you don\'t have…?', 'Do you have …? → No, I don\'t.'],
  };
  TR.BAD_REACT = BAD_REACT;
  TR.REACT = {
    ok: ['Sure.', 'Great.', 'Perfect.', 'No problem.', 'You got it.'],
    1: q => ({ en: `Sorry — ${q.short && /\?$/.test(q.short) ? q.short : (String(q.en).match(/[^.!?]*\?/g) || [String(q.en)]).pop().trim()}`, ko: q.shape === 'or' || q.shape === 'wh' ? `${TR.SHAPE[q.shape].ko} → ${TR.SHAPE[q.shape].ans}` : `‘${q.key.join(' … ')}’를 말했어요.` }),
    2: (q, j, a, C) => {
      const F = a && TR.FRAME[a.f], sv = F && F.slot ? TR.sv(F.slot, a.v) : null, b = (sv && sv.bad && BAD_REACT[a.v]) || (F && BAD_REACT[F.id]);
      if (b) return { en: b[0], ko: b[1] };
      if (F && F.line) { const fx = TR.fixLine(a.line, C || {}); return { en: fx.en, ko: fx.ko }; }
      if (j.tag === 'fact') return q.intent === 'plat' || q.intent === 'cost' ? { en: 'No — I said ' + (q.intent === 'plat' ? `platform ${C.plat} at ${C.time}` : TR.money(C.amount)) + '.', ko: '들은 숫자와 달라요.' } : { en: 'Hmm, are you sure?', ko: '여행 카드(또는 상대가 한 말)를 다시 보세요.' };
      if (j.tag === 'need') return { en: 'Sure — do you want to check the details?', ko: '들은 것을 되짚어 확인해요.' };
      return { en: 'Sorry?', ko: '알아듣기 어려운 말이에요.' };
    },
    3: () => ({ en: '... Okay.', ko: '뜻은 통했지만 말투가 거칠어요.' }),
  };
  // 대답 뒤 상대가 덧붙이는 말 (다음 질문 앞)
  TR.reply = function (q, a, C) {
    switch (q.intent) {
      case 'dest': return `${TR.TOWNS[C.dest] ? TR.TOWNS[C.dest].en : 'Oakbridge'}. Okay.`;
      case 'type': return 'Sure.';
      case 'count': return 'Got it.';
      case 'peak': return C.peak === 'offpeak' ? 'Off-peak it is.' : 'Okay, anytime.';
      case 'seat': return 'Okay, I\'ve booked that for you.';
      case 'disc': return C.disc ? 'Thank you. That\'s twenty percent off.' : 'No problem.';
      case 'cost': return C.paym === 'card' ? 'Sure. Just tap your card here.' : 'Thank you. Here\'s your change and your ticket.';
      case 'plat': return 'That\'s right. Have a good trip!';
      case 'mcard': return C.topup ? 'Sure, I can do that.' : 'Here you go. That\'s five dollars for the card.';
      case 'topamt': return `Done! You've got ${TR.priceWords(C.topAmt || 2000)} on it.`;
      case 'route': return 'That\'s right!';
      case 'more': return 'You\'re welcome. Have a great day!';
      case 'board': return 'Yes, it does!';
      case 'seatq': return C.seatFree === false ? 'Oh, no problem.' : 'Thanks!';
      case 'wrongway': return 'No worries!';
      default: return null;
    }
  };

  /* =========================================================
     듣고 대답 고르기 16문제 (모두 새로 만든 대화). card = 그 상황의 사실
     ========================================================= */
  const o = (f, v) => { const a = { f }; if (v != null) a.v = String(v); return a; };
  const L = words => ({ f: 'line', line: { words } });
  TR.o = o; TR.L = L;
  // 기본 되짚기 (Park Road → Museum)
  TR.LINE = { words: TR.lineWords(DR0) };
  TR.LINE_DIR = { words: ['so', 'tk_green', 'tw_westfield', 'ch_central', 'to_blue', 'of_museum'] };
  TR.LINE_CHG = { words: ['so', 'tk_green', 'tw_eastpier', 'ch_cityhall', 'to_blue', 'of_museum'] };
  TR.LINE_MISS = { words: ['so', 'tk_green', 'tw_eastpier', 'of_museum'] };
  TR.LINE_DOWN = { words: ['so', 'tk_green', 'tw_eastpier', 'ch_central', 'to_blue', 'gd_museum'] };
  TR.LINE_BAD = { words: ['so', 'ch_central', 'tk_green', 'tw_eastpier', 'to_blue', 'of_museum'] };
  TR.LINE_CHIPS = TR.lineChips(Object.assign({}, TR.DEMO_TRIP), (() => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; })());
  TR.DRILL = [
    { q: 'ct_where', sit: '오크브리지까지 가는 표를 사려고 해요.', card: { dest: 'oakbridge' }, a: 2, opts: [o('ds_give', 'oakbridge'), o('g_yes'), o('ds_to', 'oakbridge'), o('ds_to', 'ashby')] },
    { q: 'ct_fast', sit: '직원이 아주 빠르게 말했어요. ‘… headed …’만 들렸어요.', card: {}, a: 0, opts: [o('rp_dest'), o('ds_to', 'millbrook'), o('rp_plat'), o('g_yesp')] },
    { q: 'tk_type', sit: '오늘 오크브리지에 갔다가 저녁에 돌아올 거예요.', card: { type: 'return' }, a: 1, opts: [o('g_yesp'), o('tt_pl', 'return'), o('tt_pl', 'single'), o('tt_pl', 'goback')] },
    { q: 'tk_many', sit: '어른 둘과 아이 하나가 함께 가요.', card: { party: 'a2c1' }, a: 3, opts: [o('g_yes'), o('pc_pl', 'a2'), o('pc_pl', 'a1c1'), o('pc_pl', 'a2c1')] },
    { q: 'tk_seat', sit: '창가 자리에 앉고 싶어요.', card: { seat: 'window' }, a: 0, opts: [o('se_pl', 'window'), o('g_yesp'), o('se_pl', 'aisle'), o('pc_pl', 'a1')] },
    { q: 'fr_disc', sit: '학생 카드가 없어요.', card: { disc: false }, a: 3, opts: [o('dc_have'), o('dc_yes'), o('g_yesp'), o('dc_no')] },
    { q: 'fr_cost', sit: '카드로 내고 싶어요.', card: { paym: 'card' }, a: 2, opts: [o('co_lit'), o('co_here'), o('co_card'), o('g_yes')] },
    { q: 'pl_info', sit: '직원이 승강장과 시각을 알려 줬어요. 들은 숫자가 맞는지 확인하고 싶어요.', card: {}, a: 1, opts: [o('pt_so', '4@10:50'), o('pt_so', '4@10:15'), o('pt_where'), o('g_yes')] },
    { q: 'pl_fast', sit: '역무원이 아주 빠르게 외쳤어요. ‘… platform …’만 들렸어요.', card: {}, a: 2, opts: [o('rp_ann'), o('pt_so', '6@10:15'), o('rp_plat'), o('rp_disc')] },
    { q: 'in_next', sit: 'Museum 역에 가는 길을 묻고 싶어요.', card: { to: 'museum' }, a: 0, opts: [o('aw_how', 'museum'), o('aw_teach', 'museum'), o('aw_how', 'market'), o('g_yes')] },
    { q: 'in_card', sit: '이미 가진 지하철 카드에 돈을 넣고 싶어요.', card: { topup: true }, a: 3, opts: [o('g_yesp'), o('mc_charge'), o('ta_pl', '2000'), o('mc_top')] },
    { q: 'ro_say', sit: 'Park Road 역에서 Museum 역에 가는 길을 들었어요.', card: {}, a: 2, opts: [L(TR.LINE_DIR.words), L(TR.LINE_CHG.words), L(TR.LINE.words), o('ro_ok')] },
    { q: 'ro_fast', sit: '직원이 아주 빠르게 말했어요. ‘… change …’만 들렸어요.', card: {}, a: 1, opts: [L(TR.LINE.words), o('rp_where'), o('rp_ann'), o('mr_no')] },
    { q: 'tb_note', sit: 'Museum 역에 가는 열차인지 확인하고 싶어요.', card: { to: 'museum' }, a: 1, opts: [o('bd_wrong', 'museum'), o('bd_does', 'museum'), o('bd_lit', 'museum'), o('bd_does', 'market')] },
    { q: 'tb_fast', sit: '열차 안 안내방송이 아주 빠르게 나왔어요. 하나도 못 알아들었어요.', card: {}, a: 3, opts: [o('rp_again'), o('g_yes'), o('rp_plat'), o('rp_ann')] },
    { q: 'tb_seat', sit: '옆자리가 비어 있어요.', card: { seatFree: true }, a: 0, opts: [o('sq_go'), o('sq_yes'), o('sq_taken'), o('g_yesp')] },
  ];
  TR.DRILL.forEach((it, i) => { it.n = i; it.Q = TR.Q[it.q]; it.place = it.Q.place; });
  // 직접 해 보기의 짧은 문제 (00장 · 04장) — 연습 문제와 다른 상황
  TR.MINI = {
    intro: { q: 'ct_gb', sit: '영국 기차역 매표소예요. 밀브룩까지 가요.', card: { dest: 'millbrook' }, a: 2, opts: [o('g_yes'), o('ds_go', 'millbrook'), o('ds_to', 'millbrook'), o('ds_to', 'oakbridge')] },
    cost: { q: 'fr_cost', sit: '직원이 값을 말했어요. 14.50달러인지 40.50달러인지 확인하고 싶어요.', card: {}, a: 1, opts: [o('co_say', '4050'), o('co_say', '1450'), o('co_exp'), o('pc_pl', 'a1')] },
  };
  Object.values(TR.MINI).forEach(it => { it.Q = TR.Q[it.q]; it.place = it.Q.place; });

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 여행 (연습 문제와 겹치지 않게 골랐어요)
     ========================================================= */
  // 02–08장: 오크브리지 편도 · 어른 한 명 · 덜 붐비는 시간 · 창가 · 할인 카드 없음 · 14.50달러 카드로 · 10:15 4번 승강장
  //          · 지하철 카드에 20달러 넣기 · Park Road → Museum (Central에서 갈아타기) · 옆자리 빔
  TR.DEMO = { dest: 'oakbridge', type: 'single', party: 'a1', peak: 'offpeak', seat: 'window', disc: false, paym: 'card', plat: 4, time: '10:15',
    topup: true, topAmt: 2000, from: 'parkroad', to: 'museum', seatFree: true };
  TR.DEMO.amount = TR.fare(TR.DEMO);
  TR.DEMO_ROUTE = DR0;
  // 00장: 고르는 질문에 Yes → 고른 것 · 갈아타기 안내 → 되짚기
  TR.INTRO = { q: 'tk_type', lit: o('g_yesp'), ok: o('tt_pl', 'return'), card: { type: 'return' }, rq: 'ro_say', skip: o('ro_ok'), line: L(TR.LINE.words) };
  TR.LONG = 'Take the Green Line towards East Pier and change at Central. Then take the Blue Line towards South Bay and get off at Museum.';
  TR.SCENE = {
    // 02장 매표소 질문의 모양
    shapes: [['ct_where', o('g_yes'), o('ds_to', 'oakbridge')], ['tk_type', o('g_yesp'), o('tt_pl', 'single')], ['fr_disc', o('dc_no'), o('g_no')], ['pl_info', o('g_yes'), o('pt_so', '4@10:15')]],
    dest: ['ct_where', o('ds_go', 'oakbridge'), o('ds_give', 'oakbridge'), o('ds_to', 'oakbridge'), o('ds_sgl', 'oakbridge')],
    // 03장 표 종류 · 몇 명 · 시간대 · 자리
    type: ['tk_type', o('tt_pl', 'goback'), o('tt_pl', 'single'), o('tt_pl', 'oneway')],
    us: ['tk_us', o('tt_pl', 'oneway'), o('tt_pl', 'round')],
    many: ['tk_many', o('pc_pl', 'alone'), o('pc_pl', 'me1'), o('pc_pl', 'p2'), o('pc_pl', 'a2c1')],
    peak: ['tk_peak', o('rp_wpeak'), o('pk_pl', 'offpeak')],
    seat: ['tk_seat', o('g_yesp'), o('se_pl', 'window')],
    // 04장 할인 · 값 · 숫자
    disc: ['fr_disc', o('dc_have'), o('dc_no')],
    rail: ['fr_gb', o('rp_wrail')],
    cost: ['fr_cost', o('co_say', '4050'), o('co_say', '1450'), o('co_lit'), o('co_card'), o('co_exp')],
    // 05장 승강장 · 시각
    plat: ['pl_info', o('pt_so', '4@10:50'), o('pt_so', '4@10:15'), o('pt_where')],
    platgb: ['pl_gb', o('pt_say', '2@10:50')],
    platfast: ['pl_fast', o('pt_so', '6@10:15'), o('rp_plat')],
    // 07장 안내 데스크 · 갈아타기 되짚기
    ask: ['in_next', o('aw_teach', 'museum'), o('aw_how', 'museum')],
    card: ['in_card', o('mc_charge'), o('mc_top')],
    amt: ['in_amt', o('ta_pl', '2000')],
    lines: [['skip', o('ro_ok')], ['dir', L(TR.LINE_DIR.words)], ['chg', L(TR.LINE_CHG.words)], ['miss', L(TR.LINE_MISS.words)], ['down', L(TR.LINE_DOWN.words)], ['ok', L(TR.LINE.words)]],
    more: ['ro_more', o('mr_plain'), o('mr_no')],
    // 08장 열차 확인 · 반대쪽 · 빈자리 · 안내방송
    board: ['tb_note', o('bd_wrong', 'museum'), o('bd_does', 'museum'), o('bd_is', 'museum')],
    other: ['tb_no', o('ww_bye'), o('ww_thx')],
    seatq: ['tb_seat', o('sq_yes'), o('sq_go')],
    ann: ['tb_fast', o('rp_again'), o('rp_ann')],
    fast: ['ro_fast', o('rp_where')],
  };
  // 09장: 곳마다 한 줄 (3단계 적용)
  TR.METHOD = [
    ['ct_where', o('ds_to', 'oakbridge'), { dest: 'oakbridge' }],
    ['tk_type', o('tt_pl', 'return'), { type: 'return' }],
    ['fr_disc', o('dc_no'), { disc: false }],
    ['pl_info', o('pt_so', '4@10:15'), {}],
    ['in_next', o('aw_how', 'museum'), { to: 'museum' }],
    ['ro_say', L(TR.LINE.words), {}],
    ['tb_note', o('bd_does', 'museum'), { to: 'museum' }],
  ];
  // 10장 실전: 여행 카드 하나로 넷 (보기 셋, 단계마다 지워짐)
  TR.PCARD = { dest: 'ashby', type: 'return', party: 'a2', disc: false, paym: 'card', from: 'parkroad', to: 'museum' };
  TR.PCARD.amount = TR.fare(TR.PCARD);
  TR.PRACTICE = [
    { q: 'tk_type', opts: [o('tt_pl', 'return'), o('g_yesp'), o('tt_pl', 'goback')], a: 0,
      lines: ['Single or return → 고르는 질문 · (B) Yes, please → 고른 것이 없어 탈락', '(C) go-and-back ticket → 한국식 말이라 알아듣기 어려워 탈락', '남은 보기는 공손해요 · 정답 (A) A return, please.'] },
    { q: 'pl_info', opts: [o('pt_so', '4@10:50'), o('pt_where'), o('pt_so', '4@10:15')], a: 2,
      lines: ['leaves … platform → 안내 · 셋 모두 승강장과 시각에 대한 말이에요', '(A) 10:50 → 들은 시각(10:15)과 달라 탈락 · (B) Platform where? → 낱말만 옮긴 말이라 탈락', '남은 보기는 공손해요 · 정답 (C) So, platform 4 at 10:15?'] },
    { q: 'ro_say', opts: [o('ro_ok'), L(TR.LINE_CHG.words), L(TR.LINE.words)], a: 2,
      lines: ['Take … change at → 안내 · 셋 모두 갈아타는 길에 대한 말이에요', '(A) Okay. Thanks. → 되짚지 않아 탈락 · (B) change at City Hall → 들은 역(Central)과 달라 탈락', '남은 보기는 공손해요 · 정답 (C) So, I take … and get off at Museum?'] },
    { q: 'ro_more', opts: [o('g_yesp'), o('mr_plain'), o('mr_no')], a: 2,
      lines: ['anything else → Yes/No 질문 · 셋 모두 Yes · No로 답할 수 있어요', '(A) Yes, please → 더 도와줄 것이 없는데 Yes라서 탈락', '(B) No. → 고맙다는 말 없이 끊겨 탈락 · 정답 (C) No, that\'s all. Thank you so much!'] },
  ];
  TR.practiceQ = p => TR.Q[p.q];

  /* ---------- 이어서 들리는 말 (03 · 07장). 대문자 = 세게 ---------- */
  TR.LINKED = [
    { q: 'tk_type', en: 'Single or return?', say: 'Single or return?', words: ['Single', 'or', 'return?'], sound: [['SIN', 1], ['gle', 0], ['er', 0], ['re', 0], ['TURN', 1]], link: [[0, 1]], ko: 'or는 약하게 er처럼 · 고를 것(SINgle · reTURN)을 세게' },
    { q: 'ro_say', en: 'Change at Central.', say: 'Change at Central.', words: ['Change', 'at', 'Central.'], sound: [['CHAIN', 1], ['jat', 0], ['SEN', 1], ['tral', 0]], link: [[0, 1]], ko: 'change at → chain-jat처럼 이어져요 · 역 이름(CENtral)을 세게' },
  ];
  // 헷갈리는 숫자 짝 (04 · 05장): 앞이 세면 -ty, 뒤가 세면 -teen
  TR.PAIRS = [['14', 'fourTEEN', '40', 'FORty'], ['15', 'fifTEEN', '50', 'FIFty'], ['13', 'thirTEEN', '30', 'THIRty']];

  /* ---------- 직접 해 보기 자료 ---------- */
  TR.SHAPE_QS = ['ct_where', 'tk_type', 'tk_many', 'tk_seat', 'fr_disc', 'fr_cost', 'pl_info', 'in_card', 'in_amt', 'ro_more', 'tb_seat'];

  /* =========================================================
     따라 말하기 28문장 (곳마다 상대 · 나의 말 넷)
     ========================================================= */
  const SW = (place, who, en, ko, sp) => ({ place, who, en, ko, sp: who === 'me' ? 'me' : sp || TR.PLACE[place].sp });
  TR.SHADOW = [
    SW('counter', 'staff', 'Where are you traveling to today?', '오늘 어디까지 가세요?'),
    SW('counter', 'me', 'To Oakbridge, please.', '오크브리지까지요.'),
    SW('counter', 'me', 'A return to Millbrook, please.', '밀브룩 왕복표 주세요.'),
    SW('counter', 'staff', 'Morning! Where to?', '(영국) 안녕하세요! 어디까지요?', 'gb'),
    SW('ticket', 'staff', 'Single or return?', '(영국) 편도요, 왕복이요?'),
    SW('ticket', 'me', 'A return, please.', '왕복으로 주세요.'),
    SW('ticket', 'staff', 'One-way or round trip?', '(미국) 편도요, 왕복이요?', 'us'),
    SW('ticket', 'me', 'Two adults and one child, please.', '어른 두 명, 어린이 한 명이요.'),
    SW('fare', 'staff', 'Do you have a student card?', '학생 카드 있으세요?'),
    SW('fare', 'me', 'No, I don\'t.', '아니요, 없어요.'),
    SW('fare', 'me', 'Can I pay by card?', '카드로 내도 돼요?'),
    SW('fare', 'me', 'Sorry, did you say $14.50?', '죄송한데, 14달러 50센트라고 하셨어요?'),
    SW('plat', 'staff', 'It leaves at 10:15 from platform 4.', '10시 15분에 4번 승강장에서 떠나요.', 'us'),
    SW('plat', 'me', 'So, platform 4 at 10:15?', '그러니까, 4번 승강장 10시 15분이죠?'),
    SW('plat', 'staff', 'The next one\'s the 10:50 from platform 2.', '(영국) 다음 열차는 2번 승강장에서 10시 50분이에요.'),
    SW('plat', 'me', 'Sorry, which platform?', '죄송한데, 몇 번 승강장이요?'),
    SW('info', 'me', 'Hi. How do I get to Museum, please?', '안녕하세요. Museum 역에 어떻게 가요?'),
    SW('info', 'staff', 'Would you like a new metro card?', '새 지하철 카드 필요하세요?'),
    SW('info', 'me', 'No, thanks. I\'d like to top up my card.', '아니요, 괜찮아요. 제 카드에 돈을 넣고 싶어요.'),
    SW('info', 'me', 'Twenty dollars, please.', '20달러 넣어 주세요.'),
    SW('route', 'staff', 'Take the Green Line towards East Pier.', 'East Pier 방향 초록 노선을 타세요.'),
    SW('route', 'staff', 'Change at Central.', 'Central 역에서 갈아타세요.'),
    SW('route', 'me', 'So, I take the Green Line towards East Pier, change at Central to the Blue Line, and get off at Museum?', '그러니까 제가 East Pier 방향 초록 노선을 타고, Central 역에서 파랑 노선으로 갈아타고, Museum 역에서 내리는 거죠?'),
    SW('route', 'me', 'No, that\'s all. Thank you so much!', '아니요, 그거면 돼요. 정말 고마워요!'),
    SW('train', 'me', 'Excuse me, does this train go to Museum?', '실례지만, 이 열차 Museum 역에 가요?'),
    SW('train', 'staff', 'You need the train on the other side.', '반대쪽 열차를 타셔야 해요.'),
    SW('train', 'me', 'Oh, the other side. Thank you!', '아, 반대쪽이요. 고마워요!'),
    SW('train', 'me', 'Excuse me, what did the announcement say?', '실례지만, 방금 안내방송에서 뭐라고 했어요?'),
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: key 열쇠 낱말 · frame 대답 틀 · slot 내 정보 · pol 공손한 말 · trap 함정 · ok 정답
     ========================================================= */
  const LL = k => `(${L4[k]})`;
  TR.judgeItem = (it, k) => TR.judge(it.Q, it.opts[k], it.card, '상황');
  const CARD_SKIP = { amount: 1, from: 1 };
  const cardSay = c => Object.keys(c || {}).filter(k => !CARD_SKIP[k] && c[k] != null).map(k => (k === 'to' ? '가려는 역 ' : '') + TR.factKo(k, c[k])).join(' · ');
  const segMarks = (a, k, roleOf) => TR.segs(a).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).map(s => ({ t: s.t.trim().replace(/^[,.?!]+|[,.?!]+$/g, ''), role: roleOf(s), at: k })).filter(m => m.t);
  const tagKo = j => j.tag === 'fact' ? '상황 · 들은 말과 다른 정보' : j.tag === 'need' ? '꼭 말할 조각이 빠지거나 되짚지 않음' : j.tag === 'order' ? '순서가 뒤섞임' : j.tag === 'wrong' ? '틀린 문장' : '한국어 그대로 옮긴 말 · 콩글리시';
  TR.steps = function (it) {
    const q = it.Q, J = it.opts.map((_, k) => TR.judgeItem(it, k)), at = s => it.opts.map((_, k) => k).filter(k => J[k].stage === s);
    const best = it.opts[it.a], SHp = TR.SHAPE[q.shape], C = Object.assign({}, it.card || {}, q.fact || {});
    // ①
    let t1;
    if (q.fast) t1 = q.ann ? '안내방송이 너무 빨라 하나도 못 알아들었어요. 안내방송은 다시 말해 주지 않으니 옆 사람에게 물어요.' : '너무 빨라서 열쇠 낱말을 못 잡았어요. 무엇을 말했는지 모르면 짐작해서 답하지 말고 다시 물어요. 들린 낱말이 있으면 그 부분만 되물어요.';
    else t1 = `열쇠 낱말 ${q.key.join(' … ')} → ${SHp.ko}(${SHp.mark}). ${TR.sayOf(q.intent)}. ${TR.INTENT[q.intent].want}`;
    if (at(1).length) t1 += ' ' + at(1).map(k => LL(k)).join(' · ') + (q.fast ? ' → 짐작한 대답이거나 다른 말을 되물어 탈락.' : J[at(1)[0]].tag === 'shape' ? ' → 모양이 맞지 않거나 다른 질문의 대답이라 탈락.' : ' → 다른 질문에 맞는 대답이라 탈락.');
    const m1 = q.fast ? [] : q.key.map(t => ({ t, role: 'key', at: 'q' }));
    at(1).forEach(k => m1.push({ t: TR.text(it.opts[k]).replace(/[.?!]$/, ''), role: 'trap', at: k }));
    // ②
    const sit = cardSay(it.card);
    const Fb = TR.FRAME[best.f], ft = Fb.line ? 'So, I + 들은 조각을 차례대로?' : Fb.t ? Fb.t.replace(/[{}]/g, '').replace('___', '…') : TR.text(best);
    let t2 = (q.fast ? '상황 → 처음 듣고 다 알아듣지 못했어요. ' : sit ? `상황 → ${sit}. ` : '') + `맞는 틀 → ${ft}`;
    if (at(2).length) t2 += ' · ' + at(2).map(k => `${LL(k)} ${tagKo(J[k])}`).join(' · ') + ' → 탈락.';
    else t2 += ' · 틀과 정보가 모두 맞는 보기만 남았어요.';
    const m2 = [];
    it.opts.forEach((a, k) => {
      if (J[k].stage === 1) return;
      const F = TR.FRAME[a.f];
      if (F.line) {
        const lo = TR.checkLine(a.line, C), wrong = lo.err ? lo.err.word.t : null, badW = (a.line.words || []).map(w => TR.OW[w]).find(x => x && x.bad);
        TR.lineSegs(a.line).filter(s => s.t.trim() && /[A-Za-z]/.test(s.t)).forEach(s => { const t = s.t.trim(); m2.push({ t, role: J[k].stage === 2 && (t === wrong || (badW && t === badW.t)) ? 'trap' : s.r === 'frame' ? 'frame' : 'slot', at: k }); });
        return;
      }
      const x = F.slot && TR.sv(F.slot, a.v), sb = x && x.bad;
      const trapOf = s => J[k].stage !== 2 ? false : (J[k].tag === 'fact' || sb) ? (F.slot ? s.r === 'slot' : s.r === 'frame') : s.r === 'frame';
      segMarks(a, k, s => s.r === 'pol' ? '' : trapOf(s) ? 'trap' : s.r).forEach(m => { if (m.role) m2.push(m); });
    });
    // ③
    let t3 = at(3).length ? at(3).map(k => `${LL(k)} ${TR.text(it.opts[k])} → ${J[k].tag === 'plain' ? '고맙다는 말 없이 끊김' : '명령 · 조르는 말 · 퉁명스러운 말'}`).join(' · ') + ' → 탈락. ' : '무례하게 들리는 보기는 없어요. ';
    t3 += `정답 ${LL(it.a)} → ${J[it.a].why}`;
    const m3 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 3) segMarks(a, k, () => 'trap').forEach(m => m3.push(m)); else if (J[k].stage === 0) segMarks(a, k, s => s.r === 'pol' ? 'pol' : '').forEach(m => { if (m.role) m3.push(m); }); });
    m3.push({ t: TR.text(it.opts[it.a]), role: 'ok', at: it.a, whole: true });
    return [
      { head: '① 열쇠 낱말 + 질문의 모양 잡기', text: t1, marks: m1 },
      { head: '② 틀에 내 정보 넣기', text: t2, marks: m2 },
      { head: '③ 공손하게 끝내기', text: t3, marks: m3 },
    ];
  };
  TR.notes = it => it.opts.map((_, k) => { const j = TR.judgeItem(it, k); return (j.ok ? '' : `× ${['', '①', '②', '③'][j.stage]} `) + j.why; });

  /* =========================================================
     데이터 점검 — 문제 데이터와 엔진이 어긋나면 콘솔 경고
     ========================================================= */
  // 길 찾기를 다른 방법으로 한 번 더: 같은 노선이면 바로, 아니면 두 노선이 만나는 역 하나로
  TR.verifyRoute = function (a, b) {
    let best = null;
    const idx = (l, s) => TR.LINES[l].st.indexOf(s);
    TR.linesAt(a).forEach(l => { if (TR.LINES[l].st.includes(b)) { const n = Math.abs(idx(l, a) - idx(l, b)); if (!best || best.transfers > 0 || n < best.stops) best = { transfers: 0, stops: n }; } });
    if (best) return best;
    TR.linesAt(a).forEach(l1 => TR.linesAt(b).forEach(l2 => {
      if (l1 === l2) return;
      TR.LINES[l1].st.filter(h => TR.LINES[l2].st.includes(h)).forEach(h => { const n = Math.abs(idx(l1, a) - idx(l1, h)) + Math.abs(idx(l2, h) - idx(l2, b)); if (!best || n < best.stops) best = { transfers: 1, stops: n, hub: h }; });
    }));
    return best;
  };
  TR.check = function () {
    const bad = [];
    const hasT = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase());
    Object.values(TR.Q).forEach(q => {
      if (!TR.PLACE[q.place]) bad.push(`말 ${q.id}: 곳 ${q.place}가 없어요`);
      if (!TR.INTENT[q.intent]) bad.push(`말 ${q.id}: 뜻 ${q.intent}가 없어요`);
      q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`말 ${q.id}: 열쇠 낱말 ‘${k}’가 말에 없어요`); });
      if (TR.shapeGuess(q.en) !== q.shape) bad.push(`말 ${q.id}: 적어 둔 모양 ${q.shape} · 글의 모양 ${TR.shapeGuess(q.en)}`);
      if (q.shape === 'or') { if (!q.choices || q.choices.length < 2) bad.push(`말 ${q.id}: 고르는 질문에 choices가 없어요`); else { const In = TR.INTENT[q.intent], S = Object.values(TR.SLOT).find(s => s.key === In.key); q.choices.forEach(c => { if (!S || !S.vals[c]) bad.push(`말 ${q.id}: 고를 것 ${c}가 칸에 없어요`); }); } }
    });
    Object.values(TR.FRAME).forEach(F => {
      [].concat(F.intent).forEach(i => { if (i !== 'yn' && i !== 'repair' && !TR.INTENT[i]) bad.push(`틀 ${F.id}: 뜻 ${i}가 없어요`); });
      if (F.slot && !TR.SLOT[F.slot]) bad.push(`틀 ${F.id}: 칸 ${F.slot}이 없어요`);
      if (F.slot && !/___/.test(F.t)) bad.push(`틀 ${F.id}: 칸이 있는데 ___가 없어요`);
      if (F.tag !== 'ok' && !F.why) bad.push(`틀 ${F.id}: 함정 틀에 까닭(why)이 없어요`);
    });
    Object.entries(TR.INTENT).forEach(([k, In]) => { if (In.best && typeof In.best === 'string' && !TR.FRAME[In.best]) bad.push(`뜻 ${k}의 모범 틀 ${In.best}가 없어요`); });
    Object.values(TR.OW).forEach(w => { if (!TR.OCAT[w.c]) bad.push(`되짚기 조각 ${w.t}: 갈래 ${w.c}가 없어요`); if (w.bad && !w.why) bad.push(`되짚기 조각 ${w.t}: 까닭이 없어요`); });
    // 숫자 읽기 · 값 · 시각
    [[1450, 'fourteen fifty'], [2000, 'twenty dollars'], [1500, 'fifteen dollars'], [605, 'six oh five'], [100, 'one dollar'], [6500, 'sixty-five dollars']].forEach(([c, w]) => { if (TR.priceWords(c) !== w) bad.push(`값 읽기 ${c}: ${TR.priceWords(c)}`); });
    [['10:15', 'ten fifteen'], ['9:05', 'nine oh five'], ['3:00', 'three o\'clock'], ['10:50', 'ten fifty'], ['11:13', 'eleven thirteen']].forEach(([t, w]) => { if (TR.timeWords(t) !== w) bad.push(`시각 읽기 ${t}: ${TR.timeWords(t)}`); });
    [['fourteen fifty', '1450'], ['$14.50', '1450'], ['14.50', '1450'], ['fifteen', '15'], ['fifty', '50'], ['platform four', '4']].forEach(([s, r]) => { if (!TR.canon(s).includes(r)) bad.push(`숫자 맞추기 ${s}: ${TR.canon(s).join(' ')}`); });
    [['So, platform four at ten fifteen?', 4, '10:15'], ['platform 4 at 10:15', 4, '10:15'], ['platform six at nine oh five', 6, '9:05'], ['platform two at ten fifty', 2, '10:50'], ['platform 9 at three o\'clock', 9, '3:00']].forEach(([s, p, t]) => { const h = TR.heardPT(TR.canon(s)); if (!h || h.plat !== p || h.time !== t) bad.push(`승강장 · 시각 듣기 ${s}: ${JSON.stringify(h)}`); });
    if (TR.spoken('It leaves at 10:15 from platform 4.') !== 'It leaves at ten fifteen from platform four.') bad.push(`읽을 글: ${TR.spoken('It leaves at 10:15 from platform 4.')}`);
    if (TR.spoken('Okay, that\'s $14.50, please.') !== 'Okay, that\'s fourteen fifty, please.') bad.push(`읽을 글: ${TR.spoken('Okay, that\'s $14.50, please.')}`);
    // 기차 값 (어린이 반값 · 학생 카드 20% · 10센트 단위)
    [[{ dest: 'oakbridge', type: 'single', party: 'a1' }, 1450], [{ dest: 'oakbridge', type: 'return', party: 'a2c1' }, 6500], [{ dest: 'oakbridge', type: 'single', party: 'a1', disc: true }, 1160],
      [{ dest: 'ashby', type: 'return', party: 'a2', disc: true }, 5120], [{ dest: 'millbrook', type: 'single', party: 'a1c1' }, 2445], [{ dest: 'millbrook', type: 'single', party: 'a1c1', disc: true }, 1960]].forEach(([c, w]) => { if (TR.fare(c) !== w) bad.push(`기차 값 ${JSON.stringify(c)}: ${TR.money(TR.fare(c))}`); });
    TR.TOWN_IDS.forEach(t => ['a1', 'a2c1'].forEach(p => ['single', 'return'].forEach(ty => { const c = { dest: t, type: ty, party: p }, R = TR.fareRows(c); if (R.rows.reduce((s, r) => s + r.c, 0) !== R.total) bad.push(`값 줄 ${t} ${p} ${ty}: 합이 맞지 않아요`); })));
    // 노선도: 길 찾기를 두 방법으로
    let nPair = 0;
    TR.STN_IDS.forEach(a => TR.STN_IDS.forEach(b => {
      if (a === b) return; nPair++;
      const R = TR.route(a, b), V = TR.verifyRoute(a, b);
      if (!R) { bad.push(`길 ${a} → ${b}: 길이 없어요`); return; }
      if (!V || V.transfers !== R.transfers || V.stops !== R.stops) bad.push(`길 ${a} → ${b}: 엔진 ${R.transfers}번 갈아타기 ${R.stops}정거장 · 다시 계산 ${V && V.transfers}번 ${V && V.stops}정거장`);
      if (R.legs[0].from !== a || R.legs[R.legs.length - 1].to !== b) bad.push(`길 ${a} → ${b}: 처음 · 끝 역이 달라요`);
      R.legs.forEach((L, k) => {
        const st = TR.LINES[L.line].st, i = st.indexOf(L.from), j = st.indexOf(L.to);
        if (i < 0 || j < 0 || Math.abs(i - j) !== L.stops) bad.push(`길 ${a} → ${b}: ${k + 1}번째 구간 정거장 수가 달라요`);
        if (L.towards !== (j > i ? st[st.length - 1] : st[0])) bad.push(`길 ${a} → ${b}: ${k + 1}번째 구간 방향이 달라요`);
        if (k && R.legs[k - 1].to !== L.from) bad.push(`길 ${a} → ${b}: 갈아타는 역이 이어지지 않아요`);
      });
      const said = TR.say(R);
      [TR.LINES[R.legs[0].line].en, 'towards ' + TR.STN[R.legs[0].towards].en, 'get off at ' + TR.STN[b].en].concat(R.transfers ? ['change at ' + TR.STN[R.legs[1].from].en, TR.LINES[R.legs[1].line].en] : []).forEach(x => { if (!said.includes(x)) bad.push(`길 안내 ${a} → ${b}: ‘${x}’가 없어요`); });
      const ml = TR.modelLine(R), jl = TR.checkLine(ml.line, { from: a, to: b });
      if (!jl.ok) bad.push(`되짚기 ${a} → ${b}: 모범 되짚기가 탈락 (${TR.lineText(ml.line)})`);
      const pl = TR.parseLine(TR.spoken(TR.lineText(ml.line)));
      if (JSON.stringify(pl) !== JSON.stringify(ml.line.words)) bad.push(`되짚기 ${a} → ${b}: 말로 한 되짚기를 다르게 읽어요 (${pl.join(' ')})`);
    }));
    if (nPair !== 15 * 14) bad.push(`역 쌍이 ${nPair}개예요`);
    if (TR.TRIPS.length < 20) bad.push(`시뮬레이터 여행이 ${TR.TRIPS.length}개뿐이에요`);
    if (TR.say(DR0) !== TR.LONG) bad.push(`기본 길 안내: ${TR.say(DR0)}`);
    if (TR.Q.ro_say.en !== TR.LONG) bad.push('ro_say 글이 기본 길 안내와 달라요');
    // 되짚기 판정: 맞는 줄 · 방향 · 갈아타는 역 · 빠진 조각 · get down · 순서 · 갈아타지 않는 길
    const DT = TR.DEMO_TRIP, lc = (w, Lw, c, f) => { const r = TR.checkLine(Lw, c); if (!f(r)) bad.push(`되짚기 ${w}: ${JSON.stringify({ ok: r.ok, stage: r.stage, tag: r.tag, err: r.err && r.err.type, missing: r.missing })}`); return r; };
    lc('맞는 줄', TR.LINE, DT, r => r.ok);
    lc('방향', TR.LINE_DIR, DT, r => !r.ok && r.tag === 'fact' && r.err.type === 'dir');
    lc('갈아타는 역', TR.LINE_CHG, DT, r => !r.ok && r.tag === 'fact' && r.err.type === 'change');
    lc('빠진 조각', TR.LINE_MISS, DT, r => !r.ok && r.tag === 'need');
    lc('get down', TR.LINE_DOWN, DT, r => !r.ok && r.tag === 'literal');
    lc('순서', TR.LINE_BAD, DT, r => !r.ok && r.tag === 'order');
    lc('다른 노선', { words: ['so', 'tk_red', 'tw_eastpier', 'ch_central', 'to_blue', 'of_museum'] }, DT, r => !r.ok && r.err && r.err.type === 'line');
    lc('갈아타지 않는 길', { words: ['so', 'tk_blue', 'tw_southbay', 'ch_market', 'to_green', 'of_museum'] }, { from: 'central', to: 'museum' }, r => !r.ok && r.err && r.err.type === 'nochange');
    lc('갈아타지 않는 길 맞음', { words: ['so', 'tk_blue', 'tw_southbay', 'of_museum'] }, { from: 'central', to: 'museum' }, r => r.ok);
    if (!/Central/.test(TR.fixLine(TR.LINE_CHG, DT).en)) bad.push(`고쳐 주는 말 (갈아타는 역): ${TR.fixLine(TR.LINE_CHG, DT)}`);
    if (!/East Pier/.test(TR.fixLine(TR.LINE_DIR, DT).en)) bad.push(`고쳐 주는 말 (방향): ${TR.fixLine(TR.LINE_DIR, DT)}`);
    if (TR.fixLine(TR.LINE, DT).en !== 'That\'s right!') bad.push(`고쳐 주는 말 (맞음): ${TR.fixLine(TR.LINE, DT)}`);
    // 연습 문제
    const pos = [0, 0, 0, 0];
    TR.DRILL.forEach((it, i) => {
      const w = `듣고 대답 고르기 ${i + 1}`;
      if (!it.Q) { bad.push(`${w}: 말 ${it.q}가 없어요`); return; }
      const good = it.opts.map((_, k) => k).filter(k => TR.judgeItem(it, k).ok);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]} (${it.opts.map((_, k) => TR.judgeItem(it, k).why).join(' | ')})`);
      const texts = it.opts.map(TR.text);
      if (new Set(texts).size !== texts.length) bad.push(`${w}: 같은 보기가 있어요`);
      if (!it.sit) bad.push(`${w}: 상황 글이 없어요`);
      const st = TR.steps(it); if (st.length !== 3 || st.some(s => !s.text)) bad.push(`${w}: 풀이 단계가 비었어요`);
      pos[it.a]++;
    });
    if (Math.max(...pos) - Math.min(...pos) > 0) bad.push(`듣고 대답 고르기 정답 위치가 몰려 있어요: ${pos.join(',')}`);
    const places = new Set(TR.DRILL.map(it => it.place));
    TR.PLACES.forEach(p => { if (!places.has(p.id)) bad.push(`듣고 대답 고르기: ${p.ko} 문제가 없어요`); });
    if (TR.DRILL.filter(it => it.Q.fast).length < 2) bad.push('듣고 대답 고르기: 빠른 말(다시 묻기) 문제가 둘보다 적어요');
    const yesTrap = TR.DRILL.filter(it => (it.Q.shape === 'or' || it.Q.shape === 'wh') && it.opts.some(a => TR.FRAME[a.f].bare)).length;
    if (yesTrap < 4) bad.push(`듣고 대답 고르기: 고르는 · 정보 질문에 Yes 함정이 있는 문제가 ${yesTrap}개뿐이에요`);
    if (!TR.DRILL.some(it => it.opts.some(a => a.f === 'line'))) bad.push('듣고 대답 고르기: 되짚기 문제가 없어요');
    Object.entries(TR.MINI).forEach(([k, it]) => { const good = it.opts.map((_, i) => i).filter(i => TR.judgeItem(it, i).ok); if (good.length !== 1 || good[0] !== it.a) bad.push(`직접 해 보기 ${k}: 맞는 보기 ${good}`); });
    // 영상 · 직접 해 보기의 대화가 판정과 맞나
    const want = (w, q, a, c, ok) => { const j = TR.judge(q, a, c); if (j.ok !== ok) bad.push(`${w}: ${TR.text(a)} → 판정 ${j.ok ? '✓' : '×'} (${j.why})`); return j; };
    const D = TR.DEMO, SC = TR.SCENE, I0 = TR.INTRO;
    want('00장 Yes, please', I0.q, I0.lit, I0.card, false); want('00장 고른 것', I0.q, I0.ok, I0.card, true);
    want('00장 되짚지 않음', I0.rq, I0.skip, DT, false); want('00장 되짚기', I0.rq, I0.line, DT, true);
    SC.shapes.forEach(([q, a, b]) => { const yn = TR.Q[q].shape === 'yn'; want(`02장 모양 ${q} 앞`, q, a, D, yn); want(`02장 모양 ${q} 뒤`, q, b, D, true); });
    want('02장 I go to', SC.dest[0], SC.dest[1], D, false); want('02장 Give me', SC.dest[0], SC.dest[2], D, false); want('02장 To ___', SC.dest[0], SC.dest[3], D, true); want('02장 A single to', SC.dest[0], SC.dest[4], D, true);
    want('03장 go-and-back', SC.type[0], SC.type[1], D, false); want('03장 single', SC.type[0], SC.type[2], D, true); want('03장 영국에서 one-way', SC.type[0], SC.type[3], D, true);
    want('03장 미국 one-way', SC.us[0], SC.us[1], D, true); want('03장 미국 round trip', SC.us[0], SC.us[2], D, false);
    want('03장 me alone', SC.many[0], SC.many[1], D, false); want('03장 just me', SC.many[0], SC.many[2], D, true);
    want('03장 two persons', SC.many[0], SC.many[3], { party: 'a2' }, true); want('03장 어른 둘 아이 하나', SC.many[0], SC.many[4], { party: 'a2c1' }, true);
    want('03장 off-peak 묻기', SC.peak[0], SC.peak[1], D, true); want('03장 off-peak', SC.peak[0], SC.peak[2], D, true);
    want('03장 자리 Yes', SC.seat[0], SC.seat[1], D, false); want('03장 창가', SC.seat[0], SC.seat[2], D, true);
    want('04장 I have not', SC.disc[0], SC.disc[1], D, false); want('04장 No, I don\'t', SC.disc[0], SC.disc[2], D, true);
    want('04장 railcard 묻기', SC.rail[0], SC.rail[1], D, true);
    want('04장 되묻기 40.50', SC.cost[0], SC.cost[1], D, false); want('04장 되묻기 14.50', SC.cost[0], SC.cost[2], D, true); want('04장 Card is okay', SC.cost[0], SC.cost[3], D, false);
    want('04장 카드로', SC.cost[0], SC.cost[4], D, true); want('04장 비싸다', SC.cost[0], SC.cost[5], D, false);
    if (TR.fare(D) !== TR.Q.fr_cost.fact.amount) bad.push(`04장 값: ${TR.money(TR.fare(D))} ≠ ${TR.money(TR.Q.fr_cost.fact.amount)}`);
    want('05장 10:50', SC.plat[0], SC.plat[1], D, false); want('05장 10:15', SC.plat[0], SC.plat[2], D, true); want('05장 Platform where', SC.plat[0], SC.plat[3], D, false);
    want('05장 영국 되묻기', SC.platgb[0], SC.platgb[1], D, true);
    want('05장 빠른 말 짐작', SC.platfast[0], SC.platfast[1], D, false); want('05장 빠른 말 되묻기', SC.platfast[0], SC.platfast[2], D, true);
    want('07장 Teach me', SC.ask[0], SC.ask[1], D, false); want('07장 How do I get to', SC.ask[0], SC.ask[2], D, true);
    want('07장 charge', SC.card[0], SC.card[1], D, false); want('07장 top up', SC.card[0], SC.card[2], D, true); want('07장 20달러', SC.amt[0], SC.amt[1], D, true);
    SC.lines.forEach(([k, a]) => want(`07장 되짚기 ${k}`, 'ro_say', a, D, k === 'ok'));
    want('07장 No.', SC.more[0], SC.more[1], D, false); want('07장 No, that\'s all', SC.more[0], SC.more[2], D, true);
    want('08장 is this train go', SC.board[0], SC.board[1], D, false); want('08장 does this train go', SC.board[0], SC.board[2], D, true); want('08장 Is this the train', SC.board[0], SC.board[3], D, true);
    want('08장 Okay. Bye.', SC.other[0], SC.other[1], D, false); want('08장 반대쪽', SC.other[0], SC.other[2], D, true);
    want('08장 Yes, sit down', SC.seatq[0], SC.seatq[1], D, false); want('08장 go ahead', SC.seatq[0], SC.seatq[2], D, true);
    want('08장 안내방송 다시', SC.ann[0], SC.ann[1], D, false); want('08장 안내방송 묻기', SC.ann[0], SC.ann[2], D, true);
    want('07장 빠른 길 되묻기', SC.fast[0], SC.fast[1], D, true);
    [['fr_cost', TR.Q.fr_cost.en], ['pl_info', TR.Q.pl_info.en], ['ro_say', TR.Q.ro_say.en]].forEach(([id, en]) => { if (TR.simQ(id, D).en !== en) bad.push(`DEMO와 말이 달라요 ${id}: ${TR.simQ(id, D).en}`); });
    TR.METHOD.forEach(([q, a, c], i) => want(`09장 ${i + 1}`, q, a, Object.assign({}, D, c), true));
    if (TR.METHOD.length !== TR.PLACES.length) bad.push('09장: 곳마다 한 줄이 아니에요');
    // 실전: 지워지는 단계가 줄 글과 맞나
    TR.PRACTICE.forEach((p, i) => {
      const w = `실전 ${i + 1}`, q = TR.practiceQ(p);
      const J = p.opts.map(a => TR.judge(q, a, TR.PCARD));
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
      const c = TR.newCard(rnd);
      if (!TR.goodRoute(TR.route(c.from, c.to))) bad.push(`시뮬레이터 카드 ${n}: 길이 너무 길어요`);
      TR.simQs(c).forEach(id => {
        const q = TR.simQ(id, c), C = Object.assign({}, c, q.fact || {}), m = TR.model(q, C), j = TR.judge(q, m, C);
        if (!j.ok) bad.push(`시뮬레이터 ${id}: 모범 대답이 탈락 (${TR.text(m)} · ${j.why})`);
        const ms = TR.matchSpoken(TR.spoken(TR.text(m)), q, C);
        if (!ms.ok) bad.push(`시뮬레이터 ${id}: 모범 대답을 말로 해도 통과하지 못해요 (${TR.text(m)} · ${ms.why})`);
        if (TR.shapeGuess(q.en) !== q.shape) bad.push(`시뮬레이터 ${id}: 모양 ${q.shape} · 글 ${TR.shapeGuess(q.en)} (${q.en})`);
        q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`시뮬레이터 ${id}: 열쇠 낱말 ‘${k}’가 말에 없어요 (${q.en})`); });
        const fr = TR.simFrames(q.intent, C);
        if (!fr) { bad.push(`시뮬레이터 ${id}: 틀 칩이 없어요`); return; }
        if (q.intent === 'route') {
          const chips = TR.lineChips(C, rnd), mw = m.line.words.filter(w => w !== 'so');
          if (chips.length !== mw.length) bad.push(`시뮬레이터 되짚기: 조각 자리 ${chips.length} · 모범 조각 ${mw.length}`);
          chips.forEach((g, k) => {
            if (!g.ids.includes(mw[k])) bad.push(`시뮬레이터 되짚기: ${k + 1}번째 자리에 맞는 조각(${mw[k]})이 없어요 (${g.ids})`);
            g.ids.filter(x => x !== mw[k]).forEach(x => { const w2 = ['so'].concat(mw.map((y, i) => i === k ? x : y)); if (!TR.OW[x]) bad.push(`시뮬레이터 되짚기: 조각 ${x}가 없어요`); else if (TR.judge(q, L(w2), C).ok) bad.push(`시뮬레이터 되짚기: 함정 조각 ${x}가 통과해요 (${c.from} → ${c.to})`); });
          });
          if (TR.judge(q, o('ro_ok'), C).ok) bad.push('시뮬레이터 되짚기: Okay. Thanks.가 통과해요');
          return;
        }
        const okN = fr.filter(f => { const F = TR.FRAME[f]; if (!F.slot) return TR.judge(q, { f }, C).ok; return TR.slotChoices(F.slot, C, rnd, q).some(v => TR.judge(q, { f, v }, C).ok); }).length;
        if (okN !== 1) bad.push(`시뮬레이터 ${id}: 맞는 틀이 ${okN}개예요 (${fr.join(',')})`);
        fr.forEach(f => { const F = TR.FRAME[f]; if (F.slot && !TR.slotChoices(F.slot, C, rnd, q).length) bad.push(`시뮬레이터 ${id}: ${f}의 칸 칩이 없어요`); });
        const right = fr.find(f => TR.FRAME[f].slot && TR.FRAME[f].tag === 'ok' && [].concat(TR.FRAME[f].intent).includes(q.intent));
        if (right) { const F = TR.FRAME[right], ch = TR.slotChoices(F.slot, C, rnd, q), okv = ch.filter(v => TR.judge(q, { f: right, v }, C).ok); if (okv.length !== 1) bad.push(`시뮬레이터 ${id}: ${right}의 칸 칩 가운데 맞는 값이 ${okv.length}개예요 (${ch})`); }
      });
    }
    // 말로 대답하기: 모양 · 다른 값 · 콩글리시 · 짐작은 통과하지 않아야
    const rep = (w, raw, q, c, k) => { const r = TR.matchSpoken(raw, q, c); if (r.ok || r.repair !== k) bad.push(`말로 대답하기 ${w}: ‘${raw}’ → ${r.ok ? '통과' : r.repair || '탈락'} (${r.why})`); return r; }, nope = (w, raw, q, c) => { const r = TR.matchSpoken(raw, q, c); if (r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과해요`); return r; }, yep = (w, raw, q, c) => { const r = TR.matchSpoken(raw, q, c); if (!r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과하지 않아요 (${r.why})`); return r; };
    Object.values(TR.Q).filter(q => (q.shape === 'or' || q.shape === 'wh') && !q.fast).forEach(q => { ['yes', 'yes please', 'yeah sure'].forEach(y => nope(`${q.id} ${y}`, y, q, D)); });
    yep('행선지', 'To Oakbridge, please.', 'ct_where', D); nope('다른 행선지', 'To Ashby, please.', 'ct_where', D);
    yep('왕복', 'A return, please.', 'tk_type', { type: 'return' }); nope('편도', 'Single, please.', 'tk_type', { type: 'return' }); yep('미국 왕복', 'Round trip, please.', 'tk_us', { type: 'return' });
    yep('사람 수', 'Two adults and one child, please.', 'tk_many', { party: 'a2c1' }); nope('어린이 빠짐', 'Two adults, please.', 'tk_many', { party: 'a2c1' });
    yep('학생 카드 없음', 'No, I don\'t.', 'fr_disc', { disc: false }); nope('학생 카드 있음', 'Yes, I do.', 'fr_disc', { disc: false });
    nope('값 되묻기 forty', 'Sorry, did you say forty fifty?', 'fr_cost', D); rep('같은 값 되묻기', 'Sorry, did you say fourteen fifty?', 'fr_cost', D, 'check'); rep('off-peak 묻기', 'Sorry, what is off-peak?', 'tk_peak', D, 'what');
    yep('카드로', 'Can I pay by card?', 'fr_cost', D);
    yep('승강장 되짚기', 'So, platform four at ten fifteen?', 'pl_info', D); nope('다른 시각', 'So, platform four at ten fifty?', 'pl_info', D); nope('다른 승강장', 'So, platform five at ten fifteen?', 'pl_info', D);
    nope('빠른 말 짐작', 'So, platform six at ten fifteen?', 'pl_fast', D); rep('빠른 말 되묻기', 'Sorry, which platform?', 'pl_fast', D, 'again');
    yep('길 묻기', 'Hi. How do I get to Museum, please?', 'in_next', D); nope('다른 역', 'How do I get to Market, please?', 'in_next', D);
    yep('카드 충전', 'No, thanks. I\'d like to top up my card.', 'in_card', D); nope('새 카드', 'Yes, please.', 'in_card', D);
    yep('되짚기', TR.spoken(TR.lineText(TR.LINE)), 'ro_say', D); nope('되짚기 방향', TR.lineText(TR.LINE_DIR), 'ro_say', D); nope('되짚기 역', TR.lineText(TR.LINE_CHG), 'ro_say', D);
    nope('되짚지 않음', 'Okay, thanks.', 'ro_say', D); nope('get down', TR.lineText(TR.LINE_DOWN), 'ro_say', D);
    rep('빠른 길 되묻기', 'Sorry, where do I change?', 'ro_fast', D, 'again'); nope('빠른 길 짐작', TR.lineText(TR.LINE), 'ro_fast', D);
    yep('이 열차', 'Excuse me, does this train go to Museum?', 'tb_note', D); nope('다른 역 열차', 'Excuse me, does this train go to Market?', 'tb_note', D);
    yep('앉으세요', 'No, go ahead.', 'tb_seat', D); nope('자리 있음', 'Sorry, it\'s taken.', 'tb_seat', D);
    nope('안내방송 다시', 'Sorry, could you say that again?', 'tb_fast', D); rep('안내방송 묻기', 'Excuse me, what did the announcement say?', 'tb_fast', D, 'again');
    // 따라 말하기: 같은 말은 모두 맞아야 · 숫자 낱말로 말해도 맞아야
    TR.SHADOW.forEach((s, i) => { const r = TR.compareWords(s.en, s.en), r2 = TR.compareWords(s.en, TR.spoken(s.en)); if (r.hit !== r.total || r2.hit !== r2.total) bad.push(`따라 말하기 ${i + 1}: 같은 글이 다 맞지 않아요`); if (!TR.PLACE[s.place]) bad.push(`따라 말하기 ${i + 1}: 곳이 없어요`); });
    if (TR.SHADOW.length !== 28) bad.push(`따라 말하기 문장 수: ${TR.SHADOW.length}`);
    TR.PLACES.forEach(p => { if (TR.SHADOW.filter(s => s.place === p.id).length !== 4) bad.push(`따라 말하기: ${p.ko} 문장이 넷이 아니에요`); });
    bad.forEach(b => console.warn('[대중교통] ' + b));
    return bad;
  };

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  TR.allText = function () {
    const out = [];
    Object.values(TR.Q).forEach(q => out.push(q.en, q.ko, q.short || ''));
    Object.values(TR.FRAME).forEach(F => out.push(F.t || '', F.ko || '', F.why || '', F.note || ''));
    Object.values(TR.SLOT).forEach(S => Object.values(S.vals || {}).forEach(v => out.push(Object.values(v).filter(x => typeof x === 'string').join(' '))));
    Object.values(TR.SHAPE).forEach(a => out.push(a.ko, a.mark, a.ans, a.say, a.offer || '')); Object.values(TR.INTENT).forEach(a => out.push(a.ans || '', a.want || '', a.say || '', a.turn || ''));
    TR.PLACES.forEach(p => out.push(p.ko, p.en)); Object.values(TR.LINES).forEach(l => out.push(l.name, l.en, l.ko, l.short, l.name.toUpperCase()));
    Object.values(TR.STN).forEach(s => out.push(s.en, s.ko, s.en.toUpperCase())); Object.values(TR.TOWNS).forEach(t => out.push(t.en, t.ko, t.en.toUpperCase())); Object.values(TR.PARTY).forEach(p => out.push(p.ko));
    TR.PRACTICE.forEach(p => out.push(p.lines.join(''))); TR.SHADOW.forEach(s => out.push(s.en, s.ko));
    TR.LINKED.forEach(l => out.push(l.en, l.ko, l.sound.map(s => s[0]).join(''))); TR.PAIRS.forEach(p => out.push(p.join('')));
    Object.values(TR.OCAT).forEach(c => out.push((c && c.ko) || '')); Object.values(TR.OW).forEach(w => out.push(w.t, w.why || '')); Object.values(TR.ERR_KO || {}).forEach(x => out.push(String(x)));
    out.push(TR.CITY, TR.STATION, TR.METRO, TR.STATION.toUpperCase(), TR.METRO.toUpperCase(), TR.LONG, TR.sayKo(DR0), TR.lineKo(TR.LINE), '$0123456789.:·+×–%→',
      'TICKETS DEPARTURES PLATFORM PLATFORMS TIME DESTINATION SINGLE RETURN ONE-WAY ROUND TRIP ADULT CHILD OFF-PEAK ANYTIME WINDOW AISLE STUDENT RAILCARD TOTAL INFORMATION METRO CARD TOP UP CHANGE HERE EXIT NEXT STATION DOORS OPEN LEFT RIGHT MIND THE GAP');
    return out.join('');
  };
})();
