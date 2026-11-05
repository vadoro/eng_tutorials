/* 길 묻기 회화 — 규칙 엔진과 대화 자료 (상황별 영어 회화)
 *
 * 길을 물을 때 묻는 말은 쉬워요. 어려운 것은 빠르고 긴 대답이에요.
 * 그래서 이 튜토리얼의 핵심은 ‘들은 길은 되짚어 확인한다’예요.
 *   ① 공손하게 말을 걸고 곳 이름을 말해요 (Excuse me, could you tell me how to get to the train station?)
 *   ② 긴 대답을 조각으로 들어요 — 동작(go straight · turn left · take the second left · cross) + 기준점(at the bank · at the lights)
 *      + 도착 위치(it's on your right · across from the park · next to the bank)
 *   ③ 들은 조각을 한 줄로 되짚어요 (So, I go straight for two blocks, turn left at the bank, and it's on my right?)
 *      → 맞으면 That's right!, 틀린 조각이 있으면 그 조각만 고쳐 줘요 (Not quite — turn right at the bank.)
 *
 * 규칙 엔진은 소리를 듣지 않아요. 지어낸 동네 지도(DR.TOWN · DR.SPOT)에서 길을 계산하고, 말마다 적어 둔
 * ‘뜻(intent) · 모양(shape)’과 ‘대답 틀(frame) + 내 정보(slot)’, 되짚는 조각(chunk)을 길 카드(또는 상황)의 사실과 맞춰 봐요.
 *
 * 3단계 말하기 법 — DR.judge(상대의 말, 대답, 카드)
 *   ① 열쇠 낱말 잡기 — 물을 때는 곳 이름과 질문의 모양, 들을 때는 동작 · 기준점 · 위치 낱말.
 *                      고르는 질문 · 정보 질문에 Yes · No만 하면 탈락, 빠른 말(fast)을 짐작해서 답하면 탈락 → 다시 묻기
 *   ② 틀에 내 정보 넣기 — 묻는 틀 + 곳 이름(콩글리시면 탈락), 되짚는 틀 So, ___? + 조각(DR.checkBack: 빠진 조각 · 다른 방향 ·
 *                      다른 기준점 · 다른 숫자 · 순서 · turn left와 on your left · the second left와 turn left twice)
 *   ③ 공손하게 끝내기 — Excuse me 없이 퉁명스럽게 묻기 · 명령 · Okay. Bye.로 끊기(plain)면 탈락
 * judge → { ok, stage: 0 | 1 | 2 | 3, why, tag, cb }
 *
 * 지도와 길: DR.route(출발, 가려는 곳) — 걷는 사람이 바라보는 쪽을 기준으로 돌 방향(left · right)과 도착 쪽을 계산 (꺾기는 두 번까지)
 *            DR.say(길, 말투) — 길 안내 영어 (blocks · nth · until 세 가지 말투) · DR.chunks(길, 말투) — 되짚는 조각
 *            DR.checkBack(길, 조각) — 되짚은 줄 판정과 상대가 고쳐 주는 말 · DR.where(가, 나) — 맞은편 · 바로 옆 · 뒤 · 사이 · 모퉁이 · 앞
 * 숫자: DR.spoken(15 → fifteen) · DR.canon(fifteen → 15, third → 3rd)
 *
 * 영상의 ✓·×, 직접 해 보기, 길 찾기 시뮬레이터, 듣고 대답 고르기, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 DR.check()가 콘솔에 경고를 내요.
 */
(function () {
  'use strict';
  const DR = (window.DR = {});
  const L4 = 'ABCD';

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; if (/[0-9]/.test(s[i])) return '0136781'.includes(s[i]) ? 0xAC01 : 0xAC00; if (/[A-Za-z]/.test(s[i])) return /[lmnr]/i.test(s[i]) ? 0xAC01 : 0xAC00; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const rieul = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 === 8 : false; };
  const wa = s => s + (has(s) ? '과' : '와'), eul = s => s + (has(s) ? '을' : '를'), ig = s => s + (has(s) ? '이' : '가');
  const ro = s => s + (has(s) && !rieul(s) ? '으로' : '로'), ieyo = s => s + (has(s) ? '이에요' : '예요'), eun = s => s + (has(s) ? '은' : '는');
  DR.josa = { wa, eul, ig, ro, ieyo, eun };
  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

  /* =========================================================
     길 묻기의 일곱 단계 (대화 차례). me: 내가 먼저 말하는 단계
     ========================================================= */
  DR.PLACES = [
    { id: 'greet', ko: '말 걸기', en: 'Getting attention', sp: 'us' },
    { id: 'ask', ko: '묻기', en: 'Asking the way', sp: 'us' },
    { id: 'move', ko: '동작 듣기', en: 'Action words', sp: 'us' },
    { id: 'mark', ko: '기준점 · 위치 듣기', en: 'Landmarks · Position', sp: 'us' },
    { id: 'far', ko: '거리 · 교통', en: 'Distance · Transport', sp: 'us' },
    { id: 'check', ko: '되짚기', en: 'Checking back', sp: 'us' },
    { id: 'thanks', ko: '고맙다고 끝내기', en: 'Thanking', sp: 'us' },
  ];
  DR.PLACE = {}; DR.PLACES.forEach((p, i) => { p.i = i; DR.PLACE[p.id] = p; });
  DR.ME_FIRST = { greet: 1, ask: 1, check: 1 };
  DR.TOWN_NAME = 'Fernwood';   // 지어낸 동네 이름

  /* =========================================================
     질문의 모양 (식당 튜토리얼과 같음) — Yes/No · 고르기 · 정보 · 안내
     ========================================================= */
  DR.SHAPE = {
    yn: { ko: 'Yes/No 질문', mark: '스위치', ans: 'Yes · No + 한 마디', say: 'Yes/No 질문이에요. Yes · No에 한 마디를 더해요', offer: '도와주겠다는 말에는 가려는 곳을 바로 말해도 돼요' },
    or: { ko: '고르는 질문', mark: '갈림길', ans: '고른 것 + please', say: '고르는 질문(A or B?)이에요. 상대가 말한 것 가운데 하나를 골라요' },
    wh: { ko: '정보 질문', mark: '빈 상자', ans: '정보 + please', say: '정보 질문이에요. 묻는 정보를 채워 말해요' },
    note: { ko: '안내', mark: '말풍선', ans: '되짚기 · 고맙다는 말 · 내가 먼저 말할 차례', say: '질문이 아니라 알려 주는 말이에요' },
  };
  DR.shapeGuess = function (en) {
    const qs = String(en).match(/[^.!?]*\?/g);
    if (!qs) return 'note';
    const s = qs[qs.length - 1].trim().toLowerCase().replace(/^(and|so|sure|okay|yes|oh|great|sorry)[,!]?\s+/, '');
    if (/\bor\b/.test(s)) return 'or';
    if (/^(how|what|which|where|when|who|why)\b/.test(s)) return 'wh';
    return 'yn';
  };

  /* =========================================================
     숫자 — 블록 · 분 · 버스 번호 · 정류장 · 출구 (화면 글 → 소리)
     ========================================================= */
  const NUMW = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };
  const numWord = n => n < 20 || (n < 100 && n % 10 === 0) ? NUMW[n] : n < 100 ? `${NUMW[n - n % 10]}-${NUMW[n % 10]}` : String(n);
  DR.numWord = numWord;
  const ORDW = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
  const ORDKO = ['', '첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째', '여섯 번째'];
  const ordW = n => ORDW[n] || `${n}th`;
  DR.ordW = ordW; DR.ordKo = n => ORDKO[n] || `${n}번째`;
  const NUMKO = ['', '한', '두', '세', '네', '다섯'];
  // 소리 내어 읽을 글: 15 → fifteen · Exit 3 → Exit three
  DR.spoken = s => String(s).replace(/\b(\d{1,2})\b/g, (m, d) => numWord(+d));
  // 버스 번호를 한 자리씩 (one-five)
  DR.digitWords = n => String(n).split('').map(d => NUMW[+d]).join('-');

  /* =========================================================
     지어낸 동네 지도 — 남북 길 넷(x 0~3) × 동서 길 셋(y 0~2), 블록 3 × 2
     교차점 (c, r), 길 조각: H r:c = 동서 길 r의 c → c+1 구간, V c:r = 남북 길 c의 r → r+1 구간
     ========================================================= */
  const T = (DR.TOWN = {
    C: 4, R: 3,
    V: ['Fern Street', 'Hill Street', 'Bell Street', 'Lark Street'],   // 서 → 동
    H: ['Mill Road', 'Main Street', 'River Road'],                     // 북 → 남
    lights: { '1,1': 1, '2,1': 1, '2,2': 1 },                          // 신호등이 있는 교차점 (횡단보도도)
    park: [1, 0],                                                       // 블록 하나가 공원
  });
  // 건물(곳). kind: mark = 지도에 이름이 보이는 기준점 · dest = 가려는 곳(시뮬레이터 지도에서는 이름 없이)
  // gen: 여러 곳에 있을 수 있는 곳(a pharmacy) — 묻는 틀에서 a를 써요. lot: 블록 안의 자리 (nw n ne w e sw s se, 공원은 all)
  DR.SPOT = {};
  const SP = (id, kind, block, lot, en, ko, o = {}) => (DR.SPOT[id] = Object.assign({ id, kind, block, lot, en, ko, icon: id }, o));
  SP('school', 'mark', [0, 0], 'n', 'school', '학교');
  SP('library', 'mark', [0, 0], 'e', 'library', '도서관');
  SP('cafe', 'mark', [0, 0], 'sw', 'café', '카페');
  SP('pharmacy', 'dest', [0, 0], 's', 'pharmacy', '약국', { gen: true });
  SP('postoffice', 'mark', [0, 0], 'se', 'post office', '우체국');
  SP('park', 'mark', [1, 0], 'all', 'park', '공원');
  SP('trainstation', 'dest', [2, 0], 'w', 'train station', '기차역');
  SP('hospital', 'dest', [2, 0], 'e', 'hospital', '병원');
  SP('bank', 'mark', [2, 0], 'sw', 'bank', '은행');
  SP('flowershop', 'mark', [2, 0], 'se', 'flower shop', '꽃집');
  SP('bakery', 'mark', [0, 1], 'nw', 'bakery', '빵집');
  SP('convenience', 'dest', [0, 1], 'n', 'convenience store', '편의점', { gen: true });
  SP('gasstation', 'dest', [0, 1], 'se', 'gas station', '주유소', { gen: true });
  SP('supermarket', 'dest', [1, 1], 'n', 'supermarket', '마트', { gen: true });
  SP('hotel', 'mark', [1, 1], 'ne', 'hotel', '호텔');
  SP('subway', 'dest', [1, 1], 'w', 'subway station', '지하철역');
  SP('museum', 'dest', [1, 1], 'e', 'museum', '박물관');
  SP('church', 'mark', [1, 1], 'sw', 'church', '교회');
  SP('police', 'mark', [2, 1], 'nw', 'police station', '경찰서');
  DR.MARKS = Object.values(DR.SPOT).filter(s => s.kind === 'mark').map(s => s.id);
  DR.DESTS = Object.values(DR.SPOT).filter(s => s.kind === 'dest').map(s => s.id);
  // 버스 정류장 (Main Street, Hill Street ~ Bell Street 구간): 북쪽 = 공원 앞(50번, 서쪽으로) · 남쪽 = 마트 앞(15번, 동쪽으로)
  DR.STOPS = {
    stopN: { key: 'H1:1', side: 'N', t: 0.5, line: 50, front: 'park', ko: '공원 앞 정류장' },
    stopS: { key: 'H1:1', side: 'S', t: 0.5, line: 15, front: 'supermarket', ko: '마트 앞 정류장' },
  };
  // 지도 밖의 곳 (버스로 가는 곳). stops: 몇 번째 정류장에서 내리나
  DR.FAR = {
    market: { en: 'Riverside Market', the: 'Riverside Market', a: 'Riverside Market', ko: '리버사이드 시장', line: 15, stops: 3 },
    zoo: { en: 'zoo', the: 'the zoo', a: 'a zoo', ko: '동물원', line: 15, stops: 4 },
    stadium: { en: 'stadium', the: 'the stadium', a: 'a stadium', ko: '경기장', line: 50, stops: 2 },
    beach: { en: 'beach', the: 'the beach', a: 'a beach', ko: '바닷가', line: 50, stops: 4 },
  };
  DR.LINES = {
    15: { toward: 'east', stops: ['Lark Street', 'Bridge Road', 'Riverside Market', 'Fernwood Zoo', 'Hilltop'] },
    50: { toward: 'west', stops: ['Fern Street', 'Fernwood Stadium', 'Old Town', 'Fernwood Beach', 'Bayview'] },
  };

  /* ---------- 길과 방향 ---------- */
  const LEFT = { N: 'W', W: 'S', S: 'E', E: 'N' }, RIGHT = { N: 'E', E: 'S', S: 'W', W: 'N' };
  DR.LEFT = LEFT; DR.RIGHT = RIGHT;
  DR.DIRV = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  DR.HEAD_KO = { N: '북쪽', E: '동쪽', S: '남쪽', W: '서쪽' };
  const segOf = key => { const m = /^([HV])(\d+):(\d+)$/.exec(key); return m[1] === 'H' ? { o: 'H', r: +m[2], c: +m[3], key } : { o: 'V', c: +m[2], r: +m[3], key }; };
  DR.segOf = segOf;
  // 교차점 (c, r)에서 h쪽으로 나가는 길 조각 (지도 밖이면 null)
  function segFrom(c, r, h) {
    if (h === 'E') return c + 1 < T.C ? segOf(`H${r}:${c}`) : null;
    if (h === 'W') return c - 1 >= 0 ? segOf(`H${r}:${c - 1}`) : null;
    if (h === 'S') return r + 1 < T.R ? segOf(`V${c}:${r}`) : null;
    if (h === 'N') return r - 1 >= 0 ? segOf(`V${c}:${r - 1}`) : null;
    return null;
  }
  DR.segFrom = segFrom;
  // 길 조각을 h쪽으로 걸을 때 끝 교차점
  const segEnd = (seg, h) => seg.o === 'H' ? (h === 'E' ? [seg.c + 1, seg.r] : [seg.c, seg.r]) : (h === 'S' ? [seg.c, seg.r + 1] : [seg.c, seg.r]);
  DR.segEnd = segEnd;
  const along = (seg, h, t) => (h === 'E' || h === 'S') ? t : 1 - t;   // 걷는 쪽으로 잰 자리
  const sideOf = (h, side) => LEFT[h] === side ? 'left' : RIGHT[h] === side ? 'right' : null;
  DR.sideOf = sideOf;
  const streetOf = seg => seg.o === 'H' ? T.H[seg.r] : T.V[seg.c];
  DR.streetOf = k => streetOf(typeof k === 'string' ? segOf(k) : k);
  // 교차점에서 가로지르는 길 (h쪽으로 걷다가 건너는 길)
  const crossStreetAt = (I, h) => (h === 'E' || h === 'W') ? T.V[I[0]] : T.H[I[1]];
  const lit = I => !!T.lights[I.join(',')];
  DR.lit = lit;
  // 점 (격자 단위): 길 조각 위 t 자리
  DR.segPoint = (key, t) => { const s = segOf(key); return s.o === 'H' ? [s.c + t, s.r] : [s.c, s.r + t]; };

  /* ---------- 블록의 자리(lot)와 길 ---------- */
  const LOT = {
    nw: [['H', 0, 0.2], ['V', 0, 0.2]], n: [['H', 0, 0.5]], ne: [['H', 0, 0.8], ['V', 1, 0.2]],
    w: [['V', 0, 0.5]], e: [['V', 1, 0.5]],
    sw: [['H', 1, 0.2], ['V', 0, 0.8]], s: [['H', 1, 0.5]], se: [['H', 1, 0.8], ['V', 1, 0.8]],
  };
  DR.LOT_G = { nw: [0.22, 0.22], n: [0.5, 0.22], ne: [0.78, 0.22], w: [0.22, 0.5], e: [0.78, 0.5], sw: [0.22, 0.78], s: [0.5, 0.78], se: [0.78, 0.78] };
  DR.LOT_NAMES = Object.keys(LOT);
  // 모든 자리: 'b{bx}{by}{lot}' → { block, lot, spot }
  DR.LOTS = {};
  for (let by = 0; by < T.R - 1; by++) for (let bx = 0; bx < T.C - 1; bx++) {
    if (bx === T.park[0] && by === T.park[1]) continue;
    DR.LOT_NAMES.forEach(lot => { DR.LOTS[`b${bx}${by}${lot}`] = { id: `b${bx}${by}${lot}`, block: [bx, by], lot, spot: null }; });
  }
  Object.values(DR.SPOT).forEach(s => { if (s.lot !== 'all') { const L = DR.LOTS[`b${s.block[0]}${s.block[1]}${s.lot}`]; L.spot = s.id; s.lotId = L.id; } });
  DR.lotOfSpot = id => DR.SPOT[id] && DR.SPOT[id].lotId;
  function facesOfLot(block, lot) {
    const [bx, by] = block;
    if (lot === 'all') return [
      { key: `H${by}:${bx}`, side: 'S', t: 0.5, span: true }, { key: `H${by + 1}:${bx}`, side: 'N', t: 0.5, span: true },
      { key: `V${bx}:${by}`, side: 'E', t: 0.5, span: true }, { key: `V${bx + 1}:${by}`, side: 'W', t: 0.5, span: true }];
    return LOT[lot].map(([o, d, t]) => o === 'H' ? { key: `H${by + d}:${bx}`, side: d ? 'N' : 'S', t } : { key: `V${bx + d}:${by}`, side: d ? 'W' : 'E', t });
  }
  const facesOf = id => { const P = DR.SPOT[id] || DR.LOTS[id]; return facesOfLot(P.block, P.lot); };
  DR.facesOf = facesOf;
  // 자리의 가운데 (격자 단위)
  DR.lotPoint = id => { const P = DR.SPOT[id] || DR.LOTS[id]; if (P.lot === 'all') return [P.block[0] + 0.5, P.block[1] + 0.5]; const g = DR.LOT_G[P.lot]; return [P.block[0] + g[0], P.block[1] + g[1]]; };
  // 블록의 자리에 있는 곳 (공원 블록이면 'park')
  function spotAt(bx, by, lot) {
    if (bx < 0 || by < 0 || bx >= T.C - 1 || by >= T.R - 1) return null;
    if (bx === T.park[0] && by === T.park[1]) return 'park';
    const L = DR.LOTS[`b${bx}${by}${lot}`]; return L ? L.spot : null;
  }
  // 교차점의 네 모퉁이
  DR.corners = (c, r) => ({ NW: spotAt(c - 1, r - 1, 'se'), NE: spotAt(c, r - 1, 'sw'), SW: spotAt(c - 1, r, 'ne'), SE: spotAt(c, r, 'nw') });
  // h쪽으로 걸어와서 본 모퉁이: 가까운 왼쪽 · 가까운 오른쪽 · 건너편 왼쪽 · 건너편 오른쪽
  const NEAR = { E: ['NW', 'SW', 'NE', 'SE'], W: ['SE', 'NE', 'SW', 'NW'], N: ['SW', 'SE', 'NW', 'NE'], S: ['NE', 'NW', 'SE', 'SW'] };
  // 돌 때 쓰는 기준점: 도는 쪽 모퉁이 먼저, 공원은 마지막. 이름이 보이는 곳(mark)만
  // 공원은 한 블록 전체라서, 그 구간에서 공원을 처음 만나는 교차점에서만 기준점이 돼요(parkOk). 공원을 따라 걸은 뒤의 at the park는 헷갈려요
  function turnMark(I, h, dir, parkOk) {
    const K = DR.corners(I[0], I[1]), [nl, nr, fl, fr] = NEAR[h].map(k => K[k]);
    const order = dir === 'left' ? [nl, fl, nr, fr] : [nr, fr, nl, fl];
    const ok = id => id && DR.SPOT[id] && DR.SPOT[id].kind === 'mark';
    return order.find(id => ok(id) && id !== 'park') || (parkOk && order.find(id => id === 'park')) || null;
  }
  DR.turnMark = turnMark;
  const parkAt = I => Object.values(DR.corners(I[0], I[1])).includes('park');
  const parkSide = key => facesOfLot(T.park, 'all').some(f => f.key === key);   // 공원을 따라 걷는 길 조각
  // 그 교차점의 기준점들 (공원은 parkOk일 때만)
  DR.marksAt = (I, parkOk) => Object.values(DR.corners(I[0], I[1])).filter(id => id && DR.SPOT[id] && DR.SPOT[id].kind === 'mark' && (id !== 'park' || parkOk));
  const nameOf = id => (DR.SPOT[id] ? DR.SPOT[id].en : id);
  const koOf = id => (DR.SPOT[id] ? DR.SPOT[id].ko : id);
  DR.nameOf = nameOf; DR.koOf = koOf;

  /* ---------- 지도의 관계 — DR.where(가, 나) ---------- */
  // across: 같은 길 조각의 맞은편, 같은 자리 · next: 같은 쪽 바로 옆 자리 · behind: 같은 블록의 반대쪽 면, 같은 자리
  DR.where = function (a, b) {
    if (a === b) return null;
    const A = facesOf(a), B = facesOf(b);
    for (const f of A) for (const g of B) {
      if (f.key !== g.key) continue;
      if (f.side !== g.side && (Math.abs(f.t - g.t) < 0.01 || f.span || g.span)) return 'across';
      if (f.side === g.side && !f.span && !g.span && Math.abs(Math.abs(f.t - g.t) - 0.3) < 0.01) return 'next';
    }
    const P = DR.SPOT[a] || DR.LOTS[a], Q = DR.SPOT[b] || DR.LOTS[b];
    if (P.lot !== 'all' && Q.lot !== 'all' && P.block[0] === Q.block[0] && P.block[1] === Q.block[1]) {
      const opp = { n: 's', s: 'n', e: 'w', w: 'e' };
      if (opp[P.lot] === Q.lot) return 'behind';
    }
    return null;
  };
  // 모퉁이 자리면 두 길 이름
  DR.cornerOf = id => {
    const P = DR.SPOT[id] || DR.LOTS[id]; if (!P || P.lot.length !== 2) return null;
    const [bx, by] = P.block, v = T.V[bx + (P.lot[1] === 'e' ? 1 : 0)], hh = T.H[by + (P.lot[0] === 's' ? 1 : 0)];
    return [v, hh];
  };
  // 가운데 자리면 같은 면 양쪽 모퉁이의 두 곳 (서 → 동, 북 → 남)
  DR.between = id => {
    const P = DR.SPOT[id] || DR.LOTS[id]; if (!P || P.lot.length !== 1) return null;
    const pair = { n: ['nw', 'ne'], s: ['sw', 'se'], w: ['nw', 'sw'], e: ['ne', 'se'] }[P.lot];
    const x = spotAt(P.block[0], P.block[1], pair[0]), y = spotAt(P.block[0], P.block[1], pair[1]);
    return x && y ? [x, y] : null;
  };
  // 정류장 앞의 곳
  DR.REL = {
    across: { en: o => `across from the ${nameOf(o)}`, ko: o => `${koOf(o)} 맞은편`, short: 'across from' },
    next: { en: o => `next to the ${nameOf(o)}`, ko: o => `${koOf(o)} 바로 옆`, short: 'next to' },
    behind: { en: o => `behind the ${nameOf(o)}`, ko: o => `${koOf(o)} 뒤`, short: 'behind' },
    between: { en: o => `between the ${nameOf(o[0])} and the ${nameOf(o[1])}`, ko: o => `${wa(koOf(o[0]))} ${koOf(o[1])} 사이`, short: 'between' },
    corner: { en: o => `on the corner of ${o[0]} and ${o[1]}`, ko: o => `두 길(${o[0]} · ${o[1]})이 만나는 모퉁이`, short: 'on the corner of' },
    front: { en: o => `in front of the ${nameOf(o)}`, ko: o => `${koOf(o)} 앞`, short: 'in front of' },
  };
  DR.relText = (r, lang = 'en') => r ? DR.REL[r.rel][lang](r.of) : '';
  // 한 곳의 관계 모두 (이름이 보이는 곳만 기준으로)
  DR.relationsOf = function (id) {
    const out = [], isMark = x => DR.SPOT[x] && DR.SPOT[x].kind === 'mark';
    DR.MARKS.forEach(m => { const r = DR.where(id, m); if (r) out.push({ rel: r, of: m }); });
    const bt = DR.between(id); if (bt && bt.every(isMark)) out.push({ rel: 'between', of: bt });
    const cn = DR.cornerOf(id); if (cn) out.push({ rel: 'corner', of: cn });
    return out;
  };
  // 길 안내에 붙이는 관계 하나: 맞은편 → 사이 → 바로 옆 → 모퉁이 → 뒤
  DR.bestRel = function (id) {
    const R = DR.relationsOf(id), pick = k => R.find(r => r.rel === k);
    return pick('across') || pick('between') || pick('next') || pick('corner') || pick('behind') || null;
  };

  /* =========================================================
     길 계산 — DR.route(출발, 가려는 곳)
     출발 = { key: 길 조각, t: 자리(0~1, 북 · 서 끝이 0), h: 바라보는 쪽 N · E · S · W }
     꺾기는 두 번까지. 도착은 마지막으로 돈 뒤 첫 구간, 또는 교차점 하나를 건넌 다음 구간(cross)
     legs[i] = { I: 교차점, dir: left · right, h: 돌기 전 방향, h2: 돈 뒤 방향, n: 돌기 전까지 닿은 교차점 수,
                 lights: 돌기 전까지 만난 신호등 수(그 교차점에 신호등이 있을 때만), nth: 그쪽으로 난 길 가운데 몇 번째, street: 들어서는 길,
                 end: 길이 끝나는 곳, lm: 기준점 }
     ========================================================= */
  DR.route = function (start, dest) {
    if (DR.FAR[dest]) return DR.busRoute(start, dest);
    const s0 = segOf(start.key), h0 = start.h, F = facesOf(dest), out = [];
    const onSeg = seg => F.filter(f => f.key === seg.key);
    const arrive = (seg, h, legs, cross, crossStreet, from) => onSeg(seg).forEach(f => {
      if (from != null && along(seg, h, f.t) <= from + 0.05) return;
      out.push({ legs, cross, crossStreet, arrive: { key: seg.key, t: f.t, side: sideOf(h, f.side), h } });
    });
    // 출발한 구간 앞쪽
    arrive(s0, h0, [], 0, null, along(s0, h0, start.t));
    if (onSeg(s0).some(f => along(s0, h0, f.t) <= along(s0, h0, start.t) + 0.05)) { /* 뒤쪽이면 돌아가야 해서 다른 길로만 */ }
    function visit(I, h, legs, n, nl, cnt, parkSeen) {
      const has2 = d => !!segFrom(I[0], I[1], d === 'left' ? LEFT[h] : RIGHT[h]);
      const C2 = { left: cnt.left + (has2('left') ? 1 : 0), right: cnt.right + (has2('right') ? 1 : 0) };
      const nlHere = nl + (lit(I) ? 1 : 0), parkOk = parkAt(I) && !parkSeen;
      if (legs.length < 2) ['left', 'right'].forEach(dir => {
        const h2 = dir === 'left' ? LEFT[h] : RIGHT[h], seg = segFrom(I[0], I[1], h2);
        if (!seg) return;
        const leg = { I: I.slice(), dir, h, h2, n, lights: lit(I) ? nlHere : 0, nth: C2[dir], street: streetOf(seg), end: !segFrom(I[0], I[1], h), lm: turnMark(I, h, dir, parkOk), parkOk };
        const legs2 = legs.concat([leg]);
        arrive(seg, h2, legs2, 0, null);
        if (onSeg(seg).length) return;
        const I2 = segEnd(seg, h2);
        visit(I2, h2, legs2, 1, 0, { left: 0, right: 0 }, parkAt(I) || parkSide(seg.key));
      });
      const seg = segFrom(I[0], I[1], h);
      if (!seg) return;
      if (n === 1) arrive(seg, h, legs, 1, crossStreetAt(I, h));
      if (onSeg(seg).length || n >= 3) return;
      visit(segEnd(seg, h), h, legs, n + 1, nlHere, C2, parkSeen || parkAt(I) || parkSide(seg.key));
    }
    // 출발 구간에 가려는 곳이 있으면(뒤쪽) 그 구간을 지나지 않으니 바로 교차점부터
    visit(segEnd(s0, h0), h0, [], 1, 0, { left: 0, right: 0 }, parkSide(s0.key));
    if (!out.length) return null;
    const blocksOf = r => r.legs.reduce((s, L) => s + L.n, 0) + r.cross + 1;
    out.forEach(r => { r.turns = r.legs.length; r.blocks = blocksOf(r); });
    out.sort((a, b) => a.turns - b.turns || a.blocks - b.blocks || a.cross - b.cross || (b.legs.every(L => L.lm || L.lights) ? 1 : 0) - (a.legs.every(L => L.lm || L.lights) ? 1 : 0));
    const R = out[0];
    R.mode = 'walk'; R.start = Object.assign({}, start); R.dest = dest; R.rel = DR.bestRel(dest);
    R.path = DR.pathOf(R); R.len = pathLen(R.path); R.minutes = R.len <= 1.8 ? 2 : R.len <= 3.6 ? 5 : 10;
    return R;
  };
  const pathLen = P => P.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - P[i][0], p[1] - P[i][1]), 0);
  // 걷는 길 (격자 단위 점들): 출발 → 도는 교차점들 → 도착
  DR.pathOf = R => {
    if (R.mode === 'bus') return R.path;
    const pts = [DR.segPoint(R.start.key, R.start.t)];
    R.legs.forEach(L => pts.push(L.I.slice()));
    pts.push(DR.segPoint(R.arrive.key, R.arrive.t));
    return pts;
  };
  // 출발을 글로 (카드 · 영상)
  DR.startText = st => {
    const s = segOf(st.key), street = streetOf(s), a = s.o === 'H' ? [T.V[s.c], T.V[s.c + 1]] : [T.H[s.r], T.H[s.r + 1]];
    const toward = s.o === 'H' ? (st.h === 'E' ? a[1] : a[0]) : (st.h === 'S' ? a[1] : a[0]);
    return { street, from: a, toward, ko: `${street} (${a[0]} – ${a[1]} 사이) · ${toward} 쪽을 보고 서 있어요` };
  };

  /* ---------- 버스로 가는 길 ---------- */
  // 출발은 Main Street(Hill – Bell)의 북쪽(공원 앞) 또는 남쪽(마트 앞) 보도, 정류장보다 조금 서쪽. side: 서 있는 보도
  DR.busRoute = function (start, dest) {
    const D = DR.FAR[dest]; if (!D) return null;
    const stop = Object.keys(DR.STOPS).find(k => DR.STOPS[k].line === D.line), S = DR.STOPS[stop];
    const where = start.side === S.side ? 'here' : 'across';
    const p0 = DR.segPoint(start.key, start.t), p1 = DR.segPoint(S.key, S.t);
    const off = S.side === 'N' ? -0.12 : 0.12, s0 = start.side === 'N' ? -0.12 : 0.12;
    return { mode: 'bus', start: Object.assign({}, start), dest, line: D.line, stop, where, nth: D.stops, legs: [], turns: 0,
      // 정류장 표지판 바로 앞(서쪽)까지. 건너편이면 먼저 길을 건너요
      path: [[p0[0], p0[1] + s0]].concat(where === 'across' ? [[p0[0] + 0.06, p1[1] + off]] : [], [[p1[0] - 0.14, p1[1] + off]]), len: 0.3, minutes: 0, destName: D.en };
  };

  /* =========================================================
     되짚는 조각 — DR.chunks(길, 말투)
     조각 = { k, ... }  k: go(n · end) · turn(dir, lm · lights · street · nth) · twice(dir) · cross(street) · side(dir) · rel(rel, of)
                            · bus(num) · stop(where) · off(nth)
     DR.coreOf(길): 판정에 쓰는 길의 뼈대 (돌기 · 건너기 · 도착 쪽은 꼭, 블록 수 · 관계는 덧붙이는 조각)
     ========================================================= */
  // 말투: blocks(블록 수 + 기준점) · nth(몇 번째 길 + 길 이름) · until(기준점이 나올 때까지)
  DR.STYLES = ['blocks', 'nth', 'until'];
  const turnId = (L, style, i) => {
    if (style === 'nth') return { nth: L.nth };
    if (L.lm) return { lm: L.lm };
    if (L.lights) return { lights: L.lights };
    return { street: L.street };
  };
  // 상대가 말한 그대로의 조각 (DR.say와 같은 차례 · 같은 이름표)
  const atId = L => L.lm ? { lm: L.lm } : L.lights ? { lights: L.lights } : { street: L.street };
  DR.chunks = function (R, style = 'blocks') {
    if (R.mode === 'bus') return style === 'cross' && R.where === 'across'
      ? [{ k: 'cross', street: null }, { k: 'bus', num: R.line }, { k: 'off', nth: R.nth }]
      : [{ k: 'bus', num: R.line }, { k: 'stop', where: R.where }, { k: 'off', nth: R.nth }];
    const out = [], L0 = R.legs[0], L1 = R.legs[1], T0 = (L, id) => out.push(Object.assign({ k: 'turn', dir: L.dir }, id || {}));
    if (L0) {
      if (style === 'nth') { T0(L0, { nth: L0.nth }); if (L1) T0(L1, { nth: L1.nth }); }
      else if (style === 'until') {
        if (L0.end && !L0.lm && !L0.lights) { out.push({ k: 'go', n: null, end: true }); T0(L0); }
        else T0(L0, atId(L0));
        if (L1) { if (L1.lm) T0(L1, { lm: L1.lm }); else if (L1.n === 1) T0(L1, { nth: 1 }); else { out.push({ k: 'go', n: L1.n }); T0(L1); } }
      } else {
        if (L0.end) { out.push({ k: 'go', n: null, end: true }); T0(L0, L0.lm ? { lm: L0.lm } : null); }
        else { out.push({ k: 'go', n: L0.n }); T0(L0, atId(L0)); }
        if (L1) {
          if (L1.end) { out.push({ k: 'go', n: null, end: true }); T0(L1); }
          else if (L1.n === 1) T0(L1, L1.lm ? { lm: L1.lm } : { nth: 1 });
          else { out.push({ k: 'go', n: L1.n }); T0(L1, atId(L1)); }
        }
      }
    }
    if (R.cross) out.push({ k: 'cross', street: R.crossStreet });
    out.push({ k: 'side', dir: R.arrive.side });
    if (R.rel) out.push({ k: 'rel', rel: R.rel.rel, of: R.rel.of });
    return out;
  };
  // 판정용 뼈대 (말투와 상관없이): 돌기마다 알아볼 수 있는 모든 이름표
  DR.coreOf = function (R) {
    if (R.mode === 'bus') return [{ k: 'stop', where: R.where, core: true }, { k: 'bus', num: R.line, core: true }, { k: 'off', nth: R.nth, core: true }];
    const out = [];
    R.legs.forEach((L, i) => {
      out.push({ k: 'go', n: L.n, end: L.end, core: false, leg: i });
      out.push({ k: 'turn', dir: L.dir, lms: DR.marksAt(L.I, L.parkOk), lights: L.lights, street: L.street, nth: L.nth, n: L.n, core: true, leg: i, L });
    });
    if (R.cross) out.push({ k: 'cross', street: R.crossStreet, core: true });
    out.push({ k: 'side', dir: R.arrive.side, core: true });
    DR.relationsOf(R.dest).forEach((r, j) => { if (!j) out.push({ k: 'rel', rels: DR.relationsOf(R.dest), core: false }); });
    return out;
  };

  /* ---------- 조각 → 글 (who: me = 되짚는 나 · you = 길을 알려 주는 사람) ---------- */
  const idText = c => c.lm ? ` at the ${nameOf(c.lm)}` : c.lights ? (c.lights === 1 ? ' at the lights' : ` at the ${ordW(c.lights)} set of lights`) : c.street ? ` onto ${c.street}` : '';
  DR.chunkText = function (c, who = 'me') {
    const my = who === 'me' ? 'my' : 'your';
    switch (c.k) {
      case 'go': return c.end ? 'go to the end of the street' : c.n == null ? 'go straight' : c.n === 1 ? 'go to the end of this block' : `go straight for ${numWord(c.n)} blocks`;
      case 'turn': return c.nth ? `take the ${ordW(c.nth)} ${c.dir}` : `turn ${c.dir}${idText(c)}`;
      case 'twice': return `turn ${c.dir} twice`;
      case 'cross': return c.street ? `cross ${c.street}` : 'cross the street';
      case 'side': return `it's on ${my} ${c.dir}`;
      case 'rel': return `it's ${DR.REL[c.rel].en(c.of)}`;
      case 'bus': return `take the number ${c.num} bus`;
      case 'stop': return c.where === 'across' ? 'from the stop across the street' : 'from this stop';
      case 'off': return `get off at the ${ordW(c.nth)} stop`;
      default: return '';
    }
  };
  // 조각의 한국어
  DR.chunkKo = function (c) {
    const dk = d => d === 'left' ? '왼쪽' : '오른쪽';
    switch (c.k) {
      case 'go': return c.end ? '길 끝까지 가기' : c.n == null ? '앞으로 쭉 가기' : c.n === 1 ? '이 블록 끝까지 가기' : `${NUMKO[c.n] || c.n} 블록 쭉 가기`;
      case 'turn': return c.nth ? `${DR.ordKo(c.nth)} ${dk(c.dir)} 길로 돌기` : `${c.lm ? `${koOf(c.lm)}에서 ` : c.lights ? (c.lights === 1 ? '신호등에서 ' : `${DR.ordKo(c.lights)} 신호등에서 `) : c.street ? `(${c.street}) ` : ''}${dk(c.dir)}으로 돌기`;
      case 'twice': return `${dk(c.dir)}으로 두 번 돌기`;
      case 'cross': return c.street ? `길(${c.street}) 건너기` : '길 건너기';
      case 'side': return `${dk(c.dir)}에 있음`;
      case 'rel': return DR.REL[c.rel].ko(c.of);
      case 'bus': return `${c.num}번 버스 타기`;
      case 'stop': return c.where === 'across' ? '길 건너편 정류장에서' : '이 정류장에서';
      case 'off': return `${DR.ordKo(c.nth)} 정류장에서 내리기`;
      default: return '';
    }
  };
  // 조각의 종류 (동작 · 기준점 · 위치 · 교통)
  DR.KIND = { go: '동작', turn: '동작', twice: '동작', cross: '동작', side: '위치', rel: '위치', bus: '교통', stop: '교통', off: '교통' };
  // 되짚는 한 줄의 조각(segs): So, I + 조각, 조각, and 조각?
  DR.lineSegs = function (chunks, o = {}) {
    const cs = chunks.filter(Boolean), out = [];
    if (!cs.length) return [{ t: o.short ? '___?' : 'So, ___?', r: 'frame' }];
    // 관계는 앞의 도착 쪽에 붙여요 (it's on my right, across from the park)
    const items = [];
    cs.forEach(c => {
      const t = DR.chunkText(c, 'me'), prev = items[items.length - 1];
      if (c.k === 'rel' && prev && prev.c.k === 'side') { prev.t += ', ' + t.replace(/^it's /, ''); prev.parts.push(c); return; }
      if (c.k === 'stop' && prev && prev.c.k === 'bus') { prev.t += ' ' + t; prev.parts.push(c); return; }
      items.push({ c, t, parts: [c] });
    });
    const first = items[0].t, starts = /^it's /.test(first);
    out.push({ t: starts ? 'So, ' : 'So, I ', r: 'frame' });
    items.forEach((it, i) => {
      if (i) out.push({ t: i === items.length - 1 ? (items.length > 2 || /^it's /.test(it.t) || it.c.k === 'off' ? ', and ' : ' and ') : ', ', r: 'frame' });
      out.push({ t: it.t, r: 'slot', chunk: it.parts });
    });
    out.push({ t: '?', r: 'frame' });
    return out;
  };
  DR.lineText = chunks => DR.lineSegs(chunks).map(s => s.t).join('');

  /* =========================================================
     길 안내 영어 — DR.say(길, 말투) · DR.sayKo
     ========================================================= */
  const atP = L => L.lm ? `at the ${nameOf(L.lm)}` : L.lights ? (L.lights === 1 ? 'at the lights' : `at the ${ordW(L.lights)} set of lights`) : `onto ${L.street}`;
  const relP = R => R.rel ? `, ${DR.relText(R.rel)}` : '';
  const distP = R => R.minutes <= 2 ? 'It\'s just a couple of minutes from here.' : `It's about a ${numWord(R.minutes)}-minute walk.`;
  DR.say = function (R, style = 'blocks', o = {}) {
    if (!R) return '';
    if (R.mode === 'bus') {
      const num = R.line, nth = ordW(R.nth);
      if (style === 'cross' && R.where === 'across') return `Cross the street and take the number ${num} bus. Get off at the ${nth} stop.`;
      return `Take the number ${num} bus ${R.where === 'across' ? 'from the stop across the street' : 'from this stop, right here'}, and get off at the ${nth} stop.`;
    }
    const S = [], L0 = R.legs[0], L1 = R.legs[1], side = R.arrive.side;
    const open = o.open != null ? o.open : 'Sure.';
    if (open) S.push(open);
    if (!L0) {
      if (R.cross) S.push(`Go straight and cross ${R.crossStreet}.`, `It's on your ${side}${relP(R)}.`);
      else S.push(`It's just up ahead, on your ${side}${relP(R)}.`);
      if (o.dist !== false) S.push(distP(R));
      return S.join(' ');
    }
    if (style === 'nth') {
      S.push(L0.nth === 1 ? `Take the first ${L0.dir}.` : `Go down this street and take the ${ordW(L0.nth)} ${L0.dir}.`);
      S.push(`That's ${L0.street}.`);
      if (L1) S.push(`Then take the ${ordW(L1.nth)} ${L1.dir}.`);
    } else if (style === 'until') {
      S.push(L0.end && !L0.lm && !L0.lights ? `Keep going to the end of the street, then turn ${L0.dir}.`
        : L0.lm ? `Keep going until you get to the ${nameOf(L0.lm)}, then turn ${L0.dir}.`
          : L0.lights ? `Keep going until you get to the ${L0.lights === 1 ? '' : ordW(L0.lights) + ' set of '}lights, then turn ${L0.dir}.`
            : `Keep going until you get to ${crossStreetAt(L0.I, L0.h)}, then turn ${L0.dir}.`);
      if (L1) S.push(L1.lm ? `Turn ${L1.dir} at the ${nameOf(L1.lm)}.` : L1.n === 1 ? `Then take the next ${L1.dir}.` : `Then go ${numWord(L1.n)} blocks and turn ${L1.dir}.`);
    } else {
      S.push(L0.end ? `Go to the end of the street and turn ${L0.dir}${L0.lm ? ` at the ${nameOf(L0.lm)}` : ''}.`
        : L0.n === 1 ? `Go to the end of this block and turn ${L0.dir} ${atP(L0)}.`
          : `Go straight for ${numWord(L0.n)} blocks and turn ${L0.dir} ${atP(L0)}.`);
      if (L1) S.push(L1.end ? `Then go to the end of the street and turn ${L1.dir}.` : L1.n === 1 ? (L1.lm ? `Then turn ${L1.dir} at the ${nameOf(L1.lm)}.` : `Then take the first ${L1.dir}.`) : `Then go ${numWord(L1.n)} blocks and turn ${L1.dir} ${atP(L1)}.`);
    }
    if (R.cross) S.push(style === 'until' ? `Cross ${R.crossStreet}, and you'll see it on your ${side}${relP(R)}.` : `Cross ${R.crossStreet}, and it's on your ${side}${relP(R)}.`);
    else S.push(style === 'until' ? `You'll see it on your ${side}${relP(R)}.` : `It's on your ${side}${relP(R)}.`);
    if (o.dist !== false && style !== 'nth') S.push(distP(R));
    return S.join(' ');
  };
  // 한국어 해석 (DR.say와 같은 갈래)
  DR.sayKo = function (R, style = 'blocks') {
    if (!R) return '';
    if (R.mode === 'bus') return style === 'cross' && R.where === 'across' ? `길을 건너서 ${R.line}번 버스를 타세요. ${DR.ordKo(R.nth)} 정류장에서 내리세요.` : `${R.where === 'across' ? '길 건너편 정류장에서' : '바로 여기 이 정류장에서'} ${R.line}번 버스를 타고, ${DR.ordKo(R.nth)} 정류장에서 내리세요.`;
    const dk = d => d === 'left' ? '왼쪽' : '오른쪽', S = [], L0 = R.legs[0], L1 = R.legs[1];
    const turnK = L => L.lm ? `${koOf(L.lm)}에서 ${dk(L.dir)}으로 도세요` : L.lights ? `${L.lights === 1 ? '신호등' : DR.ordKo(L.lights) + ' 신호등'}에서 ${dk(L.dir)}으로 도세요` : `${dk(L.dir)} 길(${L.street})로 도세요`;
    const comeK = L => L.lm ? `${ig(koOf(L.lm))} 나올 때까지` : L.lights ? `${L.lights === 1 ? '신호등' : DR.ordKo(L.lights) + ' 신호등'}이 나올 때까지` : `길(${L.street})이 나올 때까지`;
    if (!L0) S.push(R.cross ? `쭉 가서 길(${R.crossStreet})을 건너세요.` : '바로 앞이에요.');
    else if (style === 'nth') {
      S.push(`${L0.nth === 1 ? '' : '이 길로 가다가 '}${DR.ordKo(L0.nth)} ${dk(L0.dir)} 길로 도세요. 그 길이 ${L0.street}예요.`);
      if (L1) S.push(`그다음 ${DR.ordKo(L1.nth)} ${dk(L1.dir)} 길로 도세요.`);
    } else if (style === 'until') {
      S.push(L0.end && !L0.lm && !L0.lights ? `길 끝까지 쭉 가서 ${dk(L0.dir)}으로 도세요.` : `${comeK(L0)} 쭉 가서 ${dk(L0.dir)}으로 도세요.`);
      if (L1) S.push(L1.lm ? `${koOf(L1.lm)}에서 ${dk(L1.dir)}으로 도세요.` : L1.n === 1 ? `그다음 바로 다음 ${dk(L1.dir)} 길로 도세요.` : `그다음 ${NUMKO[L1.n]} 블록 가서 ${dk(L1.dir)}으로 도세요.`);
    } else {
      S.push(L0.end ? `길 끝까지 가서 ${L0.lm ? `${koOf(L0.lm)}에서 ` : ''}${dk(L0.dir)}으로 도세요.` : `${L0.n === 1 ? '이 블록 끝까지' : `쭉 ${NUMKO[L0.n]} 블록`} 가서 ${turnK(L0)}.`);
      if (L1) S.push(L1.end ? `그다음 길 끝까지 가서 ${dk(L1.dir)}으로 도세요.` : L1.n === 1 ? (L1.lm ? `그다음 ${koOf(L1.lm)}에서 ${dk(L1.dir)}으로 도세요.` : `그다음 첫 번째 ${dk(L1.dir)} 길로 도세요.`) : `그다음 ${NUMKO[L1.n]} 블록 가서 ${turnK(L1)}.`);
    }
    if (R.cross && L0) S.push(`길(${R.crossStreet})을 건너면`);
    S.push(`${dk(R.arrive.side)}에 있어요${R.rel ? ` — ${DR.relText(R.rel, 'ko')}` : ''}.`);
    if (style !== 'nth') S.push(R.minutes <= 2 ? '여기서 2분쯤이에요.' : `걸어서 ${R.minutes}분쯤이에요.`);
    return S.join(' ');
  };
  // 상대의 길 안내에서 열쇠 낱말 (말 안에 꼭 있음): 동작 · 기준점 · 위치
  DR.sayKeys = function (R, style = 'blocks') {
    const en = DR.say(R, style), keys = [];
    const add = t => { if (t && en.includes(t) && !keys.includes(t)) keys.push(t); };
    if (R.mode === 'bus') { add(`number ${R.line} bus`); add(R.where === 'across' ? 'across the street' : 'right here'); add('Cross the street'); add(`${ordW(R.nth)} stop`); return keys; }
    R.legs.forEach(L => { add(`take the ${ordW(L.nth)} ${L.dir}`); add(`Take the first ${L.dir}`); add(`next ${L.dir}`); add(`turn ${L.dir}`); add(`for ${numWord(L.n)} blocks`); add(atP(L)); if (L.lm) add(`the ${nameOf(L.lm)}`); });
    if (R.cross) add(`Cross ${R.crossStreet}`);
    add(`on your ${R.arrive.side}`);
    if (R.rel) add(DR.relText(R.rel));
    // 말에 나온 차례대로, 다른 열쇠 낱말 안에만 나오는 것(at the bank 안의 the bank)은 빼요
    const cnt = k => en.split(k).length - 1;
    return keys.filter(k => !keys.some(k2 => k2 !== k && k2.includes(k) && cnt(k2) === cnt(k))).sort((a, b) => en.indexOf(a) - en.indexOf(b));
  };

  /* =========================================================
     되짚기 판정 — DR.checkBack(길, 조각, { at: 고쳐 준 조각 })
     → { ok, full, partial, why, err: { type, i, said }, fix: { en, ko }, covered: [뼈대 번호], reply: { en, ko } }
     ========================================================= */
  const sameTurnAt = (s, c) => {   // 학생의 돌기 조각이 길의 돌기(c)를 가리키나
    if (s.lm) return c.lms.includes(s.lm);
    if (s.lights) return c.lights === s.lights;
    if (s.street) return c.street === s.street;
    if (s.nth) return c.nth === s.nth;
    return null;   // 알아볼 이름표가 없으면 방향만 봐요
  };
  const idOk = (s, c) => { const x = sameTurnAt(s, c); return x == null ? true : x; };
  // 고쳐 주는 말에 쓰는 이름표 (학생이 쓴 꼴을 따라가되, 틀린 이름표면 길의 이름표)
  const fixId = (s, c) => {
    if (s && s.nth) return { nth: c.nth };
    if (s && s.lm && c.lms.includes(s.lm)) return { lm: s.lm };
    if (s && s.lights && c.lights === s.lights) return { lights: c.lights };
    if (s && s.street && c.street === s.street) return { street: c.street };
    return c.L.lm ? { lm: c.L.lm } : c.lights ? { lights: c.lights } : { street: c.street };
  };
  const youTurn = (c, s) => DR.chunkText(Object.assign({ k: 'turn', dir: c.dir }, fixId(s, c)), 'you');
  DR.checkBack = function (R, chunks, o = {}) {
    const core = DR.coreOf(R), S = (chunks || []).filter(Boolean);
    const res = (ok, extra) => Object.assign({ ok, full: false, partial: false, covered: [], err: null, fix: null, why: '' }, extra);
    if (!S.length) return res(false, { err: { type: 'empty' }, why: '되짚을 조각이 없어요.' });
    // 버스: 정류장 · 번호 · 내릴 곳 (정류장과 번호는 어느 순서로 말해도 돼요)
    if (R.mode === 'bus') {
      const cov = [];
      for (const s of S) {
        if (s.k === 'cross') { if (R.where !== 'across') return bad('where', 0, s); cov.push(0); continue; }
        const i = core.findIndex(c => c.k === s.k);
        if (i < 0) return bad('extra', -1, s);
        const c = core[i];
        if (s.k === 'bus' && s.num !== c.num) return bad('num', i, s);
        if (s.k === 'stop' && s.where !== c.where) return bad('where', i, s);
        if (s.k === 'off' && s.nth !== c.nth) return bad('nth', i, s);
        cov.push(i);
      }
      const offAt = S.findIndex(s => s.k === 'off'), busAt = S.findIndex(s => s.k === 'bus');
      if (offAt >= 0 && busAt > offAt) return bad('order', 1, S[offAt], { a: core[1], b: core[2] });
      return done(cov);
    }
    function bad(type, i, s, x) {
      const c = core[i], said = s ? DR.chunkText(s, 'me') : '';
      let en = '', ko = '', why = '';
      const dk = d => d === 'left' ? '왼쪽' : '오른쪽';
      switch (type) {
        case 'dir': en = `Not quite — ${youTurn(c, s)}.`; ko = `아니에요 — ${DR.chunkKo(Object.assign({ k: 'turn', dir: c.dir }, fixId(s, c)))}.`; why = `방향이 달라요. 들은 길: ${DR.chunkKo(Object.assign({ k: 'turn', dir: c.dir }, fixId(s, c)))} · 되짚은 말: ${DR.chunkKo(s)}.`; break;
        case 'lm': en = `Not quite — ${youTurn(c, null)}${s.lm ? `, not the ${nameOf(s.lm)}` : ''}.`; ko = `아니에요 — ${DR.chunkKo(Object.assign({ k: 'turn', dir: c.dir }, fixId(null, c)))}.`; { const f = fixId(null, c), kn = id => `${koOf(id)}(${nameOf(id)})`; why = `기준점이 달라요. 도는 곳 → ${f.lm ? `${kn(f.lm)}${has(koOf(f.lm)) ? '이' : '가'} 있는 교차점` : f.lights ? `${f.lights === 1 ? '신호등' : DR.ordKo(f.lights) + ' 신호등'}(the lights)` : `길(${f.street})로 들어서는 교차점`}.${s.lm ? ` ${kn(s.lm)}${has(koOf(s.lm)) ? '은' : '는'} 다른 교차점에 있어요.` : s.lights ? ' 신호등 수가 달라요.' : ''}`; } break;
        case 'nth': en = R.mode === 'bus' ? `Not quite — get off at the ${ordW(c.nth)} stop.` : `Not quite — take the ${ordW(c.nth)} ${c.dir}.`; ko = R.mode === 'bus' ? `아니에요 — ${DR.ordKo(c.nth)} 정류장에서 내리세요.` : `아니에요 — ${DR.ordKo(c.nth)} ${dk(c.dir)} 길이에요.`; why = R.mode === 'bus' ? `내리는 정류장이 달라요. 들은 길: ${DR.ordKo(c.nth)} (${ordW(c.nth)}) · 되짚은 말: ${DR.ordKo(s.nth)} (${ordW(s.nth)}).` : `몇 번째 길인지 달라요. 들은 길: ${DR.ordKo(c.nth)} · 되짚은 말: ${DR.ordKo(s.nth)}.`; break;
        case 'go': {
          const want = c.n === 1 ? '이 블록 끝' : `${NUMKO[c.n]} 블록 (${numWord(c.n)} blocks)`;
          if (s.end) { en = `Not quite — not to the end of the street. ${c.n === 1 ? 'Turn at the end of this block' : `Go ${numWord(c.n)} blocks`}.`; ko = `아니에요 — 길 끝까지가 아니에요. ${c.n === 1 ? '이 블록 끝에서 돌아요' : `${NUMKO[c.n]} 블록이에요`}.`; why = `얼마나 가는지 달라요. 들은 길: ${want} · 되짚은 말: 길 끝까지(to the end of the street).`; break; }
          en = `Not quite — ${c.end ? 'go to the end of the street' : c.n === 1 ? 'turn at the end of this block' : `go ${numWord(c.n)} blocks, not ${numWord(s.n)}`}.`; ko = `아니에요 — ${c.end ? '길 끝까지 가요' : c.n === 1 ? '이 블록 끝에서 돌아요' : `${NUMKO[c.n]} 블록이에요`}.`; why = `블록 수가 달라요. 들은 길: ${c.end ? '길 끝까지 (to the end of the street)' : want} · 되짚은 말: ${NUMKO[s.n] || s.n} 블록.`; break;
        }
        case 'side': en = `Almost — it's on your ${c.dir}, not your ${s.dir}.`; ko = `거의 맞아요 — ${dk(c.dir)}에 있어요.`; why = `도착 쪽이 달라요. 들은 길: on your ${c.dir} (${dk(c.dir)}) · 되짚은 말: ${s.dir} (${dk(s.dir)}).`; break;
        case 'turnVsOn': en = `Almost — you don't turn there. It's just on your ${c.dir}.`; ko = `거의 맞아요 — 거기서는 돌지 않아요. ${dk(c.dir)}에 있어요.`; why = `on your ${c.dir} → ${dk(c.dir)}에 있다(위치). turn ${s.dir} → ${dk(s.dir)}으로 돈다(동작). 마지막에는 돌지 않고, 그곳이 ${dk(c.dir)}에 있어요.`; break;
        case 'onVsTurn': en = `Not quite — you turn ${c.dir} there.`; ko = `아니에요 — 거기서 ${dk(c.dir)}으로 돌아요.`; why = `turn ${c.dir} → 돈다(동작)를 on my ${s.dir} → 있다(위치)로 되짚었어요.`; break;
        case 'twice': en = `Not quite — you only turn once. Take the ${ordW(c.nth)} ${c.dir}.`; ko = `아니에요 — 한 번만 돌아요. ${DR.ordKo(c.nth)} ${dk(c.dir)} 길로요.`; why = `take the ${ordW(c.nth)} ${c.dir} → ${DR.ordKo(c.nth)}로 나오는 ${dk(c.dir)} 길로 한 번 돌아요. turn ${s.dir} twice → ${dk(s.dir)}으로 두 번 돌기라서 다른 곳에 가요.`; break;
        case 'twice2': { const ka = DR.chunkKo(Object.assign({ k: 'turn', dir: x.a.dir }, fixId(null, x.a))), kb = DR.chunkKo(Object.assign({ k: 'turn', dir: x.b.dir }, fixId(null, x.b)));
          en = `Not quite — ${youTurn(x.a, null)} first. Then ${youTurn(x.b, null)}.`; ko = `아니에요 — 두 번 돌지만 같은 쪽이 아니에요.`; why = `두 번 도는 길이지만 방향이 달라요. 들은 길: ${ka} → ${kb} · 되짚은 말: turn ${s.dir} twice (${dk(s.dir)}으로 두 번 돌기).`; break; }
        case 'cross': en = `Not quite — cross ${c.street}.`; ko = `아니에요 — 길(${c.street})을 건너요.`; why = `건너는 길이 달라요. 들은 길: ${c.street} · 되짚은 말: ${s.street || 'the street'}.`; break;
        case 'rel': { const r = c.rels[0]; en = `Not quite — it's ${DR.REL[r.rel].en(r.of)}.`; ko = `아니에요 — ${DR.REL[r.rel].ko(r.of)}에 있어요.`; why = `위치 관계가 달라요. 지도: ${c.rels.map(x => DR.REL[x.rel].en(x.of)).join(' · ')} · 되짚은 말: ${DR.REL[s.rel] ? DR.REL[s.rel].en(s.of) : said}.`; break; }
        case 'num': en = `Not quite — the number ${c.num} bus. ${cap(DR.digitWords(c.num))}.`; ko = `아니에요 — ${c.num}번 버스예요.`; why = `버스 번호가 달라요. 들은 길: ${c.num} (${numWord(c.num)}) · 되짚은 말: ${s.num} (${numWord(s.num)}). ${c.num === 15 || s.num === 15 ? 'fifteen → 뒤(TEEN)를 세게, fifty → 앞(FIF)을 세게.' : ''}`.trim(); break;
        case 'where': en = `Not quite — ${R.where === 'across' ? 'the stop across the street' : 'this stop, right here'}.`; ko = `아니에요 — ${R.where === 'across' ? '길 건너편 정류장이에요' : '바로 여기 이 정류장이에요'}.`; why = `정류장이 달라요. 들은 길: ${R.where === 'across' ? 'across the street (길 건너편)' : 'this stop (이 정류장)'} · 되짚은 말: ${said}.`; break;
        case 'missing': {
          // 빠진 조각을 알려 주는 말: 동작이면 don't forget to …, 도착 쪽 · 정류장은 문장으로
          const mc = c.k === 'turn' ? Object.assign({ k: 'turn', dir: c.dir }, fixId(null, c)) : c;
          en = c.k === 'side' ? `Almost — and it's on your ${c.dir}.` : c.k === 'stop' ? `Almost — you take it from ${R.where === 'across' ? 'the stop across the street' : 'this stop, right here'}.` : `Almost — don't forget to ${DR.chunkText(mc, 'you')}.`;
          ko = `거의 맞아요 — 빠진 조각이 있어요: ${DR.chunkKo(mc)}.`;
        } why = `조각이 빠졌어요: ${DR.chunkText(c.k === 'turn' ? Object.assign({ k: 'turn', dir: c.dir }, fixId(null, c)) : c, 'me')} (${DR.chunkKo(c.k === 'turn' ? Object.assign({ k: 'turn', dir: c.dir }, fixId(null, c)) : c)}).`; break;
        case 'order': {
          const a = x.a, b = x.b, ta = a.k === 'turn' ? youTurn(a, null) : DR.chunkText(a, 'you'), tb = b ? (b.k === 'turn' ? youTurn(b, null) : DR.chunkText(b, 'you')) : '';
          const two = tb && tb !== ta;   // 두 조각의 글이 같으면 앞 조각만 말해요
          en = two ? `Not quite — ${ta} first. Then ${tb}.` : `Not quite — first, ${ta}.`; ko = '아니에요 — 순서가 달라요.'; why = two ? `순서가 달라요. 들은 길: ${ta} → ${tb}.` : `순서가 달라요. 들은 길에서는 먼저 → ${ta}.`; break;
        }
        default: en = 'Hmm, I don\'t think so. Let me say it again.'; ko = '음, 그게 아니에요. 다시 말해 줄게요.'; why = `들은 길에 없는 조각이에요: ${said}. 다른 곳으로 가는 길처럼 들려요.`;
      }
      return res(false, { err: { type, i, said }, fix: { en, ko }, why, covered: o.covered || [] });
    }
    function done(cov) {
      const need = core.map((c, i) => c.core ? i : -1).filter(i => i >= 0);
      const all = new Set([].concat(o.covered || [], cov));
      const full = need.every(i => all.has(i));
      const first = core[cov[0]];
      const reply = full ? { en: 'That\'s right!', ko: '맞아요!' } : first && first.k === 'turn' ? { en: `Yes, ${youTurn(first, S.find(s => s.k === 'turn'))}.`, ko: '네, 맞아요.' } : { en: 'Yes, that\'s right.', ko: '네, 맞아요.' };
      return res(true, { full, partial: !full, covered: [...all].sort((a, b) => a - b), mine: cov, reply, why: full ? '들은 길의 조각을 모두 맞게 되짚었어요.' : `들은 조각까지 맞게 되짚었어요(${cov.map(i => DR.chunkKo(core[i].k === 'turn' ? Object.assign({ k: 'turn', dir: core[i].dir }, fixId(S.find(s => s.k === 'turn'), core[i])) : core[i].k === 'rel' ? core[i].rels[0] && Object.assign({ k: 'rel' }, core[i].rels[0]) : core[i])).join(' · ')}).` });
    }
    // 걷는 길: 학생의 조각을 뼈대에 차례로 맞춰요
    const used = [];
    let ptr = 0;
    for (let si = 0; si < S.length; si++) {
      const s = S[si];
      if (s.k === 'twice') {
        // 남은 돌기 둘이 모두 그쪽이면 맞는 말(turn left twice = 왼쪽, 또 왼쪽). 아니면 → 몇 번 · 어느 쪽으로 도는지 고쳐 줘요
        const ts = core.map((c, j) => [c, j]).filter(([c, j]) => j >= ptr && c.k === 'turn');
        if (ts.length >= 2 && ts[0][0].dir === s.dir && ts[1][0].dir === s.dir) { used.push(ts[0][1], ts[1][1]); ptr = ts[1][1] + 1; continue; }
        if (ts.length >= 2) return bad('twice2', ts[0][1], s, { a: ts[0][0], b: ts[1][0] });
        return bad('twice', ts.length ? ts[0][1] : core.findIndex(c => c.k === 'turn'), s);
      }
      if (s.k === 'go') {
        // 블록 수(또는 길 끝까지)가 맞는 구간을 먼저 (뒤 구간만 확인해도 돼요)
        const fits = c => s.end ? !!c.end : (s.n == null || c.n === s.n);
        let i = core.findIndex((c, j) => j >= ptr && c.k === 'go' && fits(c));
        if (i < 0) {
          // 앞 구간의 말을 뒤에서 했으면 → 순서
          const back = core.findIndex((c, j) => j < ptr && !used.includes(j) && c.k === 'go' && fits(c));
          if (back >= 0) return bad('order', back, s, { a: core[back], b: used.length ? core[used[used.length - 1]] : null });
          i = core.findIndex((c, j) => j >= ptr && c.k === 'go');
          if (i < 0) {
            // 앞 구간의 블록 수와도 맞지 않으면 → 들은 길에 없는 조각 (블록 수가 맞는 앞 구간이면 위에서 순서로 봐요)
            if (core.some((c, j) => j < ptr && c.k === 'go')) return bad('extra', -1, s);
            continue;
          }
          return bad('go', i, s);
        }
        used.push(i); ptr = i + 1; continue;
      }
      if (s.k === 'turn') {
        const cand = core.map((c, j) => [c, j]).filter(([c, j]) => j >= ptr && c.k === 'turn');
        if (!cand.length) {
          const side = core.find(c => c.k === 'side'), sideI = core.indexOf(side);
          // 이름표가 없거나, 방금 돈 곳의 이름표면(turn left at the bank → turn right at the bank) → 돌기와 위치를 헷갈림
          const atUsed = used.some(u => core[u].k === 'turn' && sameTurnAt(s, core[u]) === true);
          if (side && sideI >= ptr && s.dir === side.dir && (!s.lm && !s.nth || atUsed) && !S.slice(si + 1).some(x => x.k === 'side')) return bad('turnVsOn', sideI, s);
          // 이미 맞게 되짚은 돌기는 순서 탓에서 빼요
          const back = core.map((c, j) => [c, j]).filter(([c, j]) => j < ptr && !used.includes(j) && c.k === 'turn' && sameTurnAt(s, c));
          if (back.length) return bad('order', back[0][1], s, { a: back[0][0], b: core[used[used.length - 1]] });
          return bad('extra', -1, s);
        }
        let hit = cand.find(([c]) => sameTurnAt(s, c) === true && c.dir === s.dir) || cand.find(([c]) => sameTurnAt(s, c) === true) || cand.find(([c]) => sameTurnAt(s, c) == null && c.dir === s.dir);
        if (!hit) {
          // 이름표가 뒤쪽 돌기를 가리키면 → 순서(또는 빠진 조각)
          const later = core.map((c, j) => [c, j]).filter(([c, j]) => j < ptr && !used.includes(j) && c.k === 'turn' && sameTurnAt(s, c) === true);
          if (later.length) return bad('order', later[0][1], s, { a: later[0][0], b: core[used[used.length - 1]] });
          hit = cand[0];
          if (sameTurnAt(s, hit[0]) === false) return bad(s.nth ? 'nth' : 'lm', hit[1], s);
        }
        // 앞의 돌기를 건너뛰고 뒤 돌기의 이름표를 썼는데, 뒤에서 그 돌기를 또 말하면 → 앞 돌기의 기준점을 잘못 말한 것
        if (hit !== cand[0] && S.slice(si + 1).some(x => x.k === 'turn' && sameTurnAt(x, hit[0]) === true)) return bad(s.nth ? 'nth' : 'lm', cand[0][1], s);
        const [c, i] = hit;
        if (s.dir !== c.dir) return bad('dir', i, s);
        used.push(i); ptr = i + 1; continue;
      }
      if (s.k === 'cross') {
        const i = core.findIndex((c, j) => j >= ptr && c.k === 'cross');
        if (i < 0) return bad('extra', -1, s);
        if (s.street && s.street !== core[i].street) return bad('cross', i, s);
        used.push(i); ptr = i + 1; continue;
      }
      if (s.k === 'side') {
        const i = core.findIndex((c, j) => j >= ptr && c.k === 'side');
        if (i < 0) return bad('extra', -1, s);
        if (s.dir !== core[i].dir) return bad('side', i, s);
        used.push(i); ptr = i + 1; continue;
      }
      if (s.k === 'rel') {
        const i = core.findIndex(c => c.k === 'rel');
        if (i < 0) return bad('extra', -1, s);
        const ok = core[i].rels.some(r => r.rel === s.rel && JSON.stringify(r.of) === JSON.stringify(s.of));
        if (!ok) return bad('rel', i, s);
        used.push(i); ptr = Math.max(ptr, i + 1); continue;
      }
      return bad('extra', -1, s);
    }
    // 사이가 빈 조각 (처음 되짚은 조각 ~ 마지막 되짚은 조각 사이의 꼭 필요한 조각)
    if (used.length) {
      const lo = Math.min(...used), hi = Math.max(...used);
      for (let i = lo; i <= hi; i++) if (core[i].core && !used.includes(i) && !(o.covered || []).includes(i)) return bad('missing', i, null);
    }
    return done(used);
  };
  // 고쳐 준 뒤 다시 되짚을 조각 (모범)
  DR.fixChunk = (R, err) => {
    const core = DR.coreOf(R), c = core[err.i];
    if (!c) return null;
    if (c.k === 'turn') return Object.assign({ k: 'turn', dir: c.dir }, fixId(null, c));
    if (c.k === 'rel') return Object.assign({ k: 'rel' }, c.rels[0]);
    return Object.assign({}, c);
  };

  /* =========================================================
     상대의 말. key: 열쇠 낱말(말 안에 꼭 있어야 함) · shape: 질문의 모양 · choices: 고르는 질문에서 고를 것
     fast: 너무 빨라 못 알아들은 말 · cue: 말이 아니라 상황(지나가는 사람) · echo: 들린 만큼 되물어도 되는 것
     ========================================================= */
  DR.INTENT = {
    open: { shape: 'note', turn: '말 걸기', ans: 'Excuse me. + 묻는 틀 + 곳', want: 'Excuse me. Could you tell me how to get to + 곳?', say: '지나가는 사람이에요. 내가 먼저 공손하게 말을 걸어요' },
    offer: { shape: 'yn', turn: '도와줄까요', ans: 'Yes, please. + 가려는 곳', want: 'Yes, please. I\'m looking for + 곳.', offer: true },
    need: { shape: 'wh', turn: '가려는 곳', ans: '묻는 틀 + 곳', want: 'Could you tell me how to get to + 곳? · Is there + a 곳 + near here?' },
    which: { shape: 'or', turn: '어느 곳', ans: '고른 곳 + please', want: 'The + 곳, please.', key: 'place' },
    far: { shape: 'note', turn: '너무 멀어요', ans: '어떤 버스인지 묻기', want: 'Which bus should I take?', say: '걸어가기에 멀다는 안내예요. 이제 어떤 버스를 탈지 내가 물어요' },
    dir: { shape: 'note', turn: '길 안내', ans: '들은 조각을 되짚기', want: 'So, ___, ___, and it\'s on my ___?', say: '길을 알려 주는 말이에요. 동작 · 기준점 · 도착 위치를 조각으로 듣고 되짚어요' },
    fix: { shape: 'note', turn: '고쳐 준 말', ans: '고쳐 준 조각을 다시 되짚기', want: 'So, I + 고쳐 준 조각?', say: '틀린 조각을 고쳐 주는 말이에요. 그 조각만 다시 되짚어요' },
    confirm: { shape: 'note', turn: '맞아요', ans: '고맙다는 말', want: 'Great, thank you so much!', say: '맞다고 확인해 주는 말이에요. 고맙다고 끝내요' },
    local: { shape: 'note', turn: '이 동네를 몰라요', ans: '괜찮다는 말 + Thanks anyway', want: 'That\'s okay. Thanks anyway.', say: '이 동네 사람이 아니라 모른다는 말이에요. 괜찮다고 하고 고마움을 전해요' },
    repair: { shape: null, turn: '다시 묻기', ans: '', want: '' },
  };
  DR.sayOf = intent => { const it = DR.INTENT[intent]; return it.say || DR.SHAPE[it.shape].say; };
  DR.INTENT_KO = {}; Object.entries(DR.INTENT).forEach(([k, v]) => { DR.INTENT_KO[k] = v.turn || ''; });
  DR.Q = {};
  const Q = (id, place, intent, en, ko, key, o = {}) => (DR.Q[id] = Object.assign({ id, place, intent, en, ko, key, shape: DR.INTENT[intent].shape, sp: DR.PLACE[place].sp }, o));
  Q('gr_cue', 'greet', 'open', '', '(지나가는 사람이 있어요. 내가 먼저 말을 걸어요.)', [], { cue: true, short: '(지나가는 사람)' });
  Q('gr_help', 'greet', 'offer', 'Hi there. You look a little lost. Can I help you?', '안녕하세요. 길을 잃으신 것 같은데, 도와드릴까요?', ['Can I help you'], { sp: 'ca', short: 'Can I help you?' });
  Q('ak_yes', 'ask', 'need', 'Yes? How can I help?', '네? 무엇을 도와드릴까요?', ['How can I help'], { short: 'How can I help?' });
  Q('ak_uk', 'ask', 'need', 'Sorry, where are you trying to get to?', '네, 어디로 가시려고요?', ['where are you trying to get to'], { sp: 'gb', short: 'Where are you trying to get to?' });
  Q('ak_which', 'ask', 'which', 'The train station or the subway station?', '기차역이요, 지하철역이요?', ['train station or the subway station'], { choices: ['trainstation', 'subway'], short: 'The train station or the subway station?' });
  Q('fr_far', 'far', 'far', 'Oh, that\'s too far to walk from here. You should take the bus.', '아, 여기서 걸어가기엔 너무 멀어요. 버스를 타세요.', ['too far to walk'], { short: 'It\'s too far to walk.' });
  Q('dr_fast', 'move', 'dir', 'Yeah, just go down here, hang a left at the bank, and it\'s right there on your right.', '네, 이리로 쭉 가다가 은행에서 왼쪽으로 꺾으면 바로 오른쪽에 있어요.', ['left', 'bank', 'right'], { fast: true, echo: ['lr'], sp: 'ca' });
  Q('bus_fast', 'far', 'dir', 'Yeah, you want the fifteen from across the street, then get off at the third stop.', '네, 길 건너에서 15번을 타고 세 번째 정류장에서 내리세요.', ['fifteen', 'third stop'], { fast: true, echo: ['bus'], sp: 'au' });
  Q('cb_ok', 'thanks', 'confirm', 'That\'s right. You can\'t miss it.', '맞아요. 바로 보일 거예요.', ['That\'s right'], { short: 'That\'s right!' });
  Q('th_local', 'thanks', 'local', 'Sorry, I\'m not from around here.', '죄송해요, 저도 이 동네 사람이 아니에요.', ['not from around here'], { sp: 'au', short: 'Sorry, I\'m not from around here.' });
  // 길 안내 (길마다 계산): DR.dirQ(길, 말투)
  DR.dirQ = function (R, style = 'blocks', o = {}) {
    const en = DR.say(R, style, o);
    return { id: 'dir', place: o.place || (R.mode === 'bus' ? 'far' : 'check'), intent: 'dir', en, ko: DR.sayKo(R, style), key: DR.sayKeys(R, style), shape: 'note', sp: o.sp || 'us', fact: { route: R, style }, route: R, style };
  };
  // 고쳐 주는 말 (판정 결과로)
  DR.fixQ = function (R, cb, o = {}) {
    return { id: 'fix', place: 'check', intent: 'fix', en: cb.fix.en, ko: cb.fix.ko, key: [cb.fix.en.replace(/^(Not quite|Almost) — /, '').replace(/\.$/, '').split(/[.,] /)[0]], shape: 'note', sp: o.sp || 'us', fact: { route: R, fixAt: cb.err.i }, route: R };
  };

  /* =========================================================
     칸에 넣는 내 정보 (slot) — 곳 이름. form: the · a · bare · det(여러 곳이면 a, 하나뿐이면 the)
     bad · why: 콩글리시(② 탈락) · note: 통하지만 덧붙일 말(영국 영어 등)
     ========================================================= */
  const PV = (id, the, a, bare, ko, o = {}) => Object.assign({ the, a, bare, ko, fact: { place: o.place || id } }, o);
  DR.SLOT = {
    place: { key: 'place', vals: {
      trainstation: PV('trainstation', 'the train station', 'a train station', 'train station', '기차역'),
      subway: PV('subway', 'the subway station', 'a subway station', 'subway station', '지하철역'),
      underground: PV('underground', 'the underground station', 'an underground station', 'underground station', '지하철역 (영국 영어)', { place: 'subway', note: '영국 영어 → the underground(런던은 the tube)도 좋아요. 미국은 subway station. 영국에서 subway는 길 밑으로 건너는 지하도라는 뜻이에요.' }),
      pharmacy: PV('pharmacy', 'the pharmacy', 'a pharmacy', 'pharmacy', '약국', { gen: true }),
      supermarket: PV('supermarket', 'the supermarket', 'a supermarket', 'supermarket', '마트(슈퍼마켓)', { gen: true }),
      grocery: PV('grocery', 'the grocery store', 'a grocery store', 'grocery store', '마트(식료품 가게)', { place: 'supermarket', gen: true }),
      mart: PV('mart', 'the mart', 'a mart', 'mart', '(콩글리시) 마트', { place: 'supermarket', gen: true, bad: 'literal', why: '‘마트’는 한국에서 쓰는 말이에요. 영어의 mart는 가게 이름(○○ Mart)에 붙는 말이라, 혼자 쓰면 어떤 가게인지 헷갈려요 → a supermarket · a grocery store.' }),
      convenience: PV('convenience', 'the convenience store', 'a convenience store', 'convenience store', '편의점', { gen: true }),
      conv: PV('conv', 'the convenience', 'a convenience', 'convenience', '(줄인 말) 편의점', { place: 'convenience', gen: true, bad: 'literal', why: 'convenience는 ‘편리함’이라는 뜻이라 가게로 알아듣기 어려워요. store까지 말해요 → a convenience store.' }),
      gasstation: PV('gasstation', 'the gas station', 'a gas station', 'gas station', '주유소', { gen: true }),
      petrol: PV('petrol', 'the petrol station', 'a petrol station', 'petrol station', '주유소 (영국 영어)', { place: 'gasstation', gen: true, note: '영국 영어 → petrol station도 좋아요. 미국은 gas station.' }),
      hospital: PV('hospital', 'the hospital', 'a hospital', 'hospital', '병원'),
      museum: PV('museum', 'the museum', 'a museum', 'museum', '박물관'),
      restroom: PV('restroom', 'the restroom', 'a restroom', 'restroom', '화장실', { gen: true }),
      toilet: PV('toilet', 'the toilet', 'a toilet', 'toilet', '화장실 (toilet)', { place: 'restroom', gen: true, note: '영국에서는 toilets가 보통이에요. 미국에서도 알아듣지만 restroom · bathroom이 더 부드러워요.' }),
      postoffice: PV('postoffice', 'the post office', 'a post office', 'post office', '우체국'),
      bank: PV('bank', 'the bank', 'a bank', 'bank', '은행', { gen: true }),
      busstop: PV('busstop', 'the bus stop', 'a bus stop', 'bus stop', '버스 정류장', { gen: true }),
      market: PV('market', 'Riverside Market', 'Riverside Market', 'Riverside Market', '리버사이드 시장'),
      zoo: PV('zoo', 'the zoo', 'a zoo', 'zoo', '동물원'),
      stadium: PV('stadium', 'the stadium', 'a stadium', 'stadium', '경기장'),
      beach: PV('beach', 'the beach', 'a beach', 'beach', '바닷가'),
    } },
  };
  Object.values(DR.SLOT.place.vals).forEach(v => { v.det = v.gen ? v.a : v.the; v.t = v.the; v.cap = cap(v.the); v.capBare = cap(v.bare); });
  DR.sv = (slot, v) => { const S = DR.SLOT[slot]; return S && v != null ? S.vals[v] || null : null; };
  // 카드의 곳에 맞는 칸 값 (콩글리시 · 알림이 붙는 값은 빼고)
  DR.placeVal = id => DR.SLOT.place.vals[id] ? id : null;

  /* =========================================================
     대답 틀 (frame). t: 틀 글 — ___ = 내 정보 칸, {…} = 공손한 말
     tag: ok · literal(한국어 그대로 · 콩글리시) · blunt(명령 · 퉁명스러운 말) · plain(그냥 Okay. Bye.로 끊김)
     greet: 말 거는 말(뒤에 묻는 말을 붙일 수 있음, reqOk) · abrupt: Excuse me 없이 바로 쓰면 퉁명스러운 묻는 틀
     line: 되짚는 줄(조각) · kind: 다시 묻기의 종류(again · slow · map · echo)
     ========================================================= */
  DR.FRAME = {};
  const FR = (id, intent, t, ko, o = {}) => (DR.FRAME[id] = Object.assign({ id, intent, t, ko, tag: 'ok' }, o));
  FR('g_yes', 'yn', 'Yes.', '네.', { bare: true, yes: true });
  FR('g_yesp', 'yn', 'Yes, {please}.', '네, 부탁해요.', { bare: true, yes: true });
  FR('g_no', 'yn', 'No, {thanks}.', '아니요, 괜찮아요.', { bare: true, yes: false });
  // 말 걸기
  FR('gr_ex', 'open', '{Excuse me}.', '실례합니다.', { greet: true, reqOk: true });
  FR('gr_sorry', 'open', '{Sorry to bother you}.', '귀찮게 해서 죄송한데요.', { greet: true, reqOk: true });
  FR('gr_hey', 'open', 'Hey!', '(큰 소리) 이봐요!', { greet: true, reqOk: true, tag: 'blunt', why: 'Hey!는 친구를 부르는 말처럼 들려서 모르는 사람에게는 무례할 수 있어요. 말을 걸 때는 → Excuse me.' });
  FR('gr_none', 'open', '', '(말 거는 말 없이)', { greet: true, reqOk: true, none: true });
  // 묻는 틀 (말 거는 말 뒤에 붙이거나, How can I help?에 대답)
  const ASK = ['open', 'need', 'offer'];
  FR('ak_how', ASK, '{Could you} tell me how to get to ___, {please}?', '___에 어떻게 가는지 알려 주시겠어요?', { slot: 'place', form: 'the', ask: true });
  FR('ak_near', ASK, 'Is there ___ near here?', '이 근처에 ___ 있나요?', { slot: 'place', form: 'a', ask: true });
  FR('ak_nearest', ASK, 'Where\'s the nearest ___?', '가장 가까운 ___ 어디예요?', { slot: 'place', form: 'bare', ask: true, abrupt: true });
  FR('ak_where', ASK, 'Where is ___?', '___ 어디예요?', { slot: 'place', form: 'the', ask: true, abrupt: true });
  FR('ak_bare', ASK, 'Where is ___?', '___ 어디예요? (the 없이)', { slot: 'place', form: 'bare', ask: true, abrupt: true, note: '곳 이름 앞의 the가 빠졌어요. 알아듣지만 → Where is the train station?' });
  FR('ak_teach', ASK, '{Could you} teach me the way to ___?', '___ 가는 길 좀 가르쳐 주시겠어요?', { slot: 'place', form: 'the', ask: true, note: 'teach는 수업처럼 가르친다는 말이라 조금 어색해요. 알아듣지만 보통 → Could you tell me how to get to …? · Could you show me the way to …?' });
  FR('ak_rude', ASK, '___ where?', '(퉁명스러운 말) ___ 어디?', { slot: 'place', form: 'capBare', ask: true, tag: 'blunt', why: '‘역 어디예요?’를 낱말 그대로 옮기면 따지듯 퉁명스럽게 들려요. 묻는 틀로 → Excuse me, where is the + 곳?' });
  FR('ak_tell', ASK, 'Tell me the way to ___.', '(명령) ___ 가는 길 알려 줘요.', { slot: 'place', form: 'the', ask: true, tag: 'blunt', why: 'Tell me …로 시작하면 명령처럼 들려요. 부탁은 질문으로 → Could you tell me how to get to …?' });
  FR('lk_for', ASK, 'I\'m looking for ___.', '___ 찾고 있어요.', { slot: 'place', form: 'det', ask: true, abrupt: true });
  FR('of_yes', 'offer', 'Yes, {please}. I\'m looking for ___.', '네, 부탁해요. ___ 찾고 있어요.', { slot: 'place', form: 'det' });
  FR('wh_pl', 'which', '___, {please}.', '___(으)로요.', { slot: 'place', form: 'cap' });
  FR('fine', ['need', 'offer', 'which'], 'I\'m fine, {thank you}.', '저는 괜찮아요, 고마워요.', { fact: { help: false } });
  // 거리 · 교통
  FR('fr_which', 'far', '{Could you} tell me which bus to take?', '어떤 버스를 타야 하는지 알려 주시겠어요?', {});
  FR('fr_which2', 'far', 'Which bus should I take?', '어떤 버스를 타야 해요?', {});
  FR('fr_walk', 'far', 'That\'s okay. I\'ll walk.', '괜찮아요. 걸어갈게요.', { fact: { mode: 'walk' } });
  FR('fr_num', 'far', 'Bus number?', '(퉁명스러운 말) 버스 번호는?', { tag: 'blunt', why: '‘버스 번호요?’를 두 낱말로 툭 던지면 뜻은 통해도 퉁명스럽게 들려요. 묻는 틀로 → Which bus should I take?' });
  // 되짚기 (줄)
  FR('cb_so', ['dir', 'fix'], 'So, ___?', '그러니까 ___ 맞죠?', { line: true });
  FR('cb_ty', ['dir'], '{Thank you}!', '고마워요!', { need: true });
  // 고맙다고 끝내기
  FR('th_ty', ['confirm'], 'Great, {thank you so much}!', '좋아요, 정말 고마워요!', {});
  FR('th_anyway', ['local'], 'That\'s okay. {Thanks anyway}.', '괜찮아요. 아무튼 고마워요.', {});
  FR('th_bye', ['confirm', 'local'], 'Okay. Bye.', '(무뚝뚝하게) 네. 안녕.', { tag: 'plain', why: '그냥 Okay. Bye.로 끝내면 무뚝뚝하게 들려요. 시간을 내 준 사람에게 → Thank you so much! · 모른다고 했으면 → Thanks anyway.' });
  FR('th_why', ['local'], 'Why not?', '(따지는 말) 왜 몰라요?', { tag: 'blunt', why: 'Why not?은 따지는 말처럼 들려요. 모른다고 하면 → That\'s okay. Thanks anyway.' });
  FR('th_welcome', 'welcome', 'You\'re welcome.', '천만에요.', {});
  // 다시 묻기. echo: 들린 만큼 되묻는 말 — 실제로 그 말에 나온 것이어야 통과
  FR('rp_again', 'repair', '{Sorry, could you} say that again more slowly, {please}?', '죄송한데, 조금 더 천천히 다시 말씀해 주시겠어요?', { kind: 'again' });
  FR('rp_map', 'repair', '{Could you} show me on the map, {please}?', '지도에서 보여 주시겠어요?', { kind: 'map' });
  FR('rp_lr', 'repair', '{Sorry}, left or right?', '죄송한데, 왼쪽이에요, 오른쪽이에요?', { kind: 'echo', echo: 'lr' });
  FR('rp_bus', 'repair', '{Sorry}, which bus?', '죄송한데, 몇 번 버스요?', { kind: 'echo', echo: 'bus' });
  FR('rp_what', 'repair', 'What?', '(퉁명스러운 말) 뭐라고요?', { kind: 'again', tag: 'blunt', why: 'What? 한 낱말은 퉁명스럽게 들릴 수 있어요. 못 알아들었으면 → Sorry, could you say that again more slowly, please?' });

  /* ---------- 대답 글 만들기: 조각(segs) = [{ t, r: 'frame' | 'slot' | 'pol', req }] ---------- */
  const slotText = (F, v) => { const x = DR.sv(F.slot, v); return x ? (x[F.form || 't'] != null ? x[F.form || 't'] : x.t) : '___'; };
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
  DR.segs = function (a) {
    const F = DR.FRAME[a.f];
    if (F.line) return DR.lineSegs(a.line || []);
    const out = frameSegs(F, a.v);
    if (a.req && DR.FRAME[a.req.f]) { if (out.length) out.push({ t: ' ', r: 'frame' }); frameSegs(DR.FRAME[a.req.f], a.req.v).forEach(s => out.push(Object.assign(s, { req: true }))); }
    return out;
  };
  DR.text = a => DR.segs(a).map(s => s.t).join('');
  const koOfF = (F, v) => {
    if (!F.slot) return F.ko;
    const x = DR.sv(F.slot, v), k = x ? x.ko : '___';
    return F.ko.replace('___(으)로', ro(k)).replace('___에', `${k}에`).replace('___ 찾고', `${eul(k)} 찾고`).replace('___', k);
  };
  DR.ko = function (a) {
    const F = DR.FRAME[a.f];
    if (F.line) return `그러니까 ${(a.line || []).map(DR.chunkKo).join(', ')} 맞죠?`;
    const parts = [];
    if (!F.none) parts.push(koOfF(F, a.v));
    if (a.req && DR.FRAME[a.req.f]) parts.push(koOfF(DR.FRAME[a.req.f], a.req.v));
    return parts.join(' ');
  };
  // 대답이 말하는 사실
  DR.factOf = function (a) {
    const F = DR.FRAME[a.f], f = Object.assign({}, F.fact || {});
    const add = (G, v) => { const x = G.slot && DR.sv(G.slot, v); if (x) Object.assign(f, x.fact); };
    add(F, a.v);
    if (a.req && DR.FRAME[a.req.f]) add(DR.FRAME[a.req.f], a.req.v);
    return f;
  };
  DR.factKo = (k, v) => k === 'place' ? (DR.SPOT[v] ? DR.SPOT[v].ko : DR.FAR[v] ? DR.FAR[v].ko : (DR.SLOT.place.vals[v] || {}).ko || String(v)) : k === 'mode' ? (v === 'bus' ? '버스' : '걸어서') : String(v);

  /* ---------- 이미 답한 질문 (시뮬레이터가 건너뜀) ---------- */
  DR.covered = (a, q) => { if (typeof q === 'string') q = DR.Q[q]; const out = [q.intent]; if (q.intent === 'open' && a && a.req) out.push('need'); return out; };

  /* =========================================================
     판정 — DR.judge(상대의 말, 대답, 카드, 출처)
     카드 = { place, mode, route, ... } · 길 안내(dir)와 고쳐 준 말(fix)은 카드의 route로 되짚기를 판정해요
     ========================================================= */
  const res = (ok, stage, why, tag, x) => Object.assign({ ok, stage, why, tag: tag || (ok ? 'ok' : '') }, x || {});
  const shapeHead = q => q.cue ? '지나가는 사람 → 내가 먼저' : `${q.key.join(' … ')} → ${DR.SHAPE[q.shape].ko}`;
  DR.judge = function (q, a, card, src = '카드') {
    if (typeof q === 'string') q = DR.Q[q];
    const F = DR.FRAME[a.f], C = Object.assign({}, card || {}, q.fact || {});
    const fi = [].concat(F.intent), In = DR.INTENT[q.intent], R = a.req ? DR.FRAME[a.req.f] : null;
    const notes = [];
    // ① 열쇠 낱말 잡기 (모양 · 뜻)
    if (q.fast) {
      if (F.intent !== 'repair') return res(false, 1, a.line ? '너무 빨라서 열쇠 낱말을 다 못 잡았어요. 짐작해서 되짚으면 엉뚱한 곳으로 갈 수 있어요. 먼저 다시 물어요.' : '너무 빨라서 열쇠 낱말을 다 못 잡았어요. 알아듣지 못한 채 대화를 끝내지 말고 먼저 다시 물어요 → Sorry, could you say that again more slowly, please?', 'guess');
      if (F.kind === 'echo' && !(q.echo || []).includes(F.echo)) return res(false, 1, `되물은 말이 달라요. 들린 낱말(${q.key.join(' … ')})로 보면 ${F.echo === 'bus' ? '버스 이야기는 없었어요' : '돌라는 말은 없었어요'}.`, 'intent');
    } else if (F.bare) {
      if (q.shape === 'or') return res(false, 1, `${shapeHead(q)}. 둘 가운데 하나를 고르라는 말이라 ${F.yes ? 'Yes' : 'No'}만으로는 무엇을 골랐는지 알 수 없어요 → ${In.want}`, 'shape');
      if (q.shape === 'wh') return res(false, 1, `${shapeHead(q)}. 정보를 묻는 말이라 ${F.yes ? 'Yes' : 'No'}로는 답이 안 돼요 → ${In.want}`, 'shape');
      if (q.shape === 'note') return res(false, 1, `${q.cue ? '지나가는 사람에게 처음 하는 말' : `열쇠 낱말 ${q.key.join(' … ')} → ${DR.sayOf(q.intent)}`}. 묻는 말이 아니라서 ${F.yes ? 'Yes' : 'No'}로 답할 일이 아니에요 → ${In.want}`, 'shape');
      if (q.intent === 'offer' && !F.yes && C.place) return res(false, 2, `${src}: 길을 찾고 있어요. 도와주겠다는 말을 거절하면 길을 알 수 없어요 → Yes, please. I'm looking for …`, 'fact');
    } else if (!fi.includes(q.intent)) {
      if (F.intent === 'repair' && q.intent === 'dir') {
        if (F.kind === 'echo' && !DR.echoOk(q, F.echo)) return res(false, 1, `되물은 말이 달라요. ${F.echo === 'bus' ? '버스 이야기는 없었어요' : '돌라는 말은 없었어요'}.`, 'intent');
        if (F.tag === 'blunt') return res(false, 3, F.why, 'blunt');
        return res(false, 1, '다 알아들었다면 다시 묻기보다 들은 조각을 되짚어 확인해요 → So, ___?', 'intent');
      }
      if (F.intent === 'repair') return res(false, 1, '대답이 아니라 다시 묻는 말이에요. 알아들었다면 바로 답해요.', 'intent');
      if (F.id === 'th_welcome') return res(false, 1, 'You\'re welcome. → 고맙다는 말을 들었을 때 하는 대답이에요. 도움을 받은 쪽은 내가 고맙다고 해요 → Thank you so much!', 'intent');
      if (q.intent === 'local' && fi.some(i => ASK.includes(i))) return res(false, 1, '열쇠 낱말 not from around here → 이 사람은 이 동네를 몰라요. 다시 물어도 알려 줄 수 없어요 → That\'s okay. Thanks anyway.', 'intent');
      // 길 안내에 고맙다는 말만: 영어로 틀린 말은 아니지만 되짚기를 건너뜀 → ② (이 튜토리얼의 연습, 말로 한 대답과 같은 판정)
      if ((q.intent === 'dir' || q.intent === 'fix') && fi.includes('confirm')) return res(false, 2, '영어로 틀린 말은 아니에요. 다만 들은 조각을 되짚지 않았어요 → So, ___? 확인한 다음에 고맙다고 해요. (이 튜토리얼의 연습)', 'need');
      if (q.intent === 'dir' || q.intent === 'fix') return res(false, 1, `${q.intent === 'fix' ? '고쳐 준 조각을 들었어요' : '길 안내를 들었어요'}. 지금은 들은 조각을 되짚을 차례예요 → So, ___?`, 'intent');
      if (q.intent === 'local' && fi.includes('confirm')) return res(false, 1, '열쇠 낱말 not from around here → 이 사람은 길을 알려 주지 못했어요. Great, thank you so much!는 길을 알려 준 사람에게 하는 말이라 비꼬는 말처럼 들릴 수 있어요 → That\'s okay. Thanks anyway.', 'intent');
      const other = DR.INTENT[fi[0]];
      return res(false, 1, `${shapeHead(q)}${q.shape === 'note' ? '' : `(${DR.SHAPE[q.shape].ans})`}. 이 대답은 ${other ? `‘${other.turn}’ 차례에 하는 말` : '다른 차례의 말'}이에요.`, 'intent');
    }
    const fact = DR.factOf(a);
    // 고르는 질문: 상대가 말한 것 가운데 골랐나
    if (q.shape === 'or' && q.choices && F.slot && fact.place && !q.choices.includes(fact.place)) return res(false, 1, `${shapeHead(q)}. 상대가 말한 것(${q.choices.map(c => DR.factKo('place', c)).join(' · ')}) 가운데 하나를 골라요.`, 'choice');
    // 말 걸기: 아무 말도 없거나, 말을 건 뒤에 가려는 곳을 묻지 않음
    if (q.intent === 'open' && F.none && !R) return res(false, 1, '아무 말도 하지 않았어요. 먼저 말을 걸어요 → Excuse me.', 'intent');
    if (R && !R.ask) return res(false, 1, `말을 건 뒤에는 가려는 곳을 물어요. 열쇠 낱말 → 곳 이름 → ${In.want}`, 'intent');
    // ② 틀에 내 정보 넣기
    if (F.tag === 'literal') return res(false, 2, F.why, 'literal');
    const sv = F.slot ? DR.sv(F.slot, a.v) : null, rv = R && R.slot ? DR.sv(R.slot, a.req.v) : null;
    if (F.slot && !sv && !F.line) return res(false, 2, '칸이 비었어요.', 'fact');
    if (R && R.slot && !rv) return res(false, 2, '곳 이름 칸이 비었어요.', 'fact');
    for (const x of [sv, rv]) if (x && x.bad) return res(false, 2, x.why, x.bad);
    if (F.need && q.intent === 'dir') return res(false, 2, '영어로 틀린 말은 아니에요. 다만 긴 길 안내는 한 번 듣고 다 기억하기 어려워요. 들은 조각을 되짚어 확인해요 → So, ___? (이 튜토리얼의 연습)', 'need');
    let cb = null;
    if (F.line) {
      if (!C.route) return res(false, 2, '길 카드에 길이 없어요.', 'fact');
      cb = DR.checkBack(C.route, a.line, { covered: C.covered || [] });
      if (!cb.ok) return res(false, 2, cb.why, cb.err && cb.err.type === 'empty' ? 'need' : 'check', { cb });
      if (q.intent === 'fix' && C.fixAt != null && !cb.mine.includes(C.fixAt)) return res(false, 2, '고쳐 준 조각을 다시 되짚어요. 그래야 이번에는 맞게 들었는지 알 수 있어요.', 'need', { cb });
    }
    if (C.place && fact.place && fact.place !== C.place) return res(false, 2, `${wa(src)} 달라요. ${src}: ${DR.factKo('place', C.place)} · 이 대답: ${DR.factKo('place', fact.place)}.`, 'fact');
    if (C.mode && fact.mode && fact.mode !== C.mode) return res(false, 2, `${wa(src)} 달라요. ${src}: ${DR.factKo('mode', C.mode)} · 이 대답: ${DR.factKo('mode', fact.mode)}.`, 'fact');
    if (fact.help === false && C.place) return res(false, 2, `${src}: 길을 찾고 있어요. 도와주겠다는 말을 거절하면 길을 알 수 없어요 → Yes, please. I'm looking for …`, 'fact');
    if (a.req && !F.reqOk) return res(false, 2, '이 대답에는 묻는 말을 붙이지 않아요.', 'fix');
    // ③ 공손하게 끝내기
    if (F.tag === 'blunt' || F.tag === 'plain') return res(false, 3, F.why, F.tag);
    if (R && R.tag === 'blunt') return res(false, 3, R.why, 'blunt');
    if (q.intent === 'open' && F.none && R && R.abrupt) return res(false, 3, `Excuse me 없이 ${DR.text({ f: a.req.f, v: a.req.v })}로 바로 시작하면 퉁명스럽게 들려요. 모르는 사람에게는 먼저 → Excuse me.`, 'blunt');
    if (q.intent === 'open' && F.none && R) notes.push('모르는 사람에게는 Excuse me부터 하면 더 자연스러워요.');
    // 통과
    const segs = DR.segs(a), pol = segs.filter(s => s.r === 'pol').map(s => s.t).filter((x, i, arr) => arr.indexOf(x) === i);
    let why;
    if (q.fast) why = F.kind === 'echo' ? '들린 만큼 되물어 확인했어요. 무엇이 안 들렸는지 알면 그 부분만 다시 물을 수 있어요.' : F.kind === 'map' ? '지도에서 보여 달라고 공손하게 부탁했어요.' : '못 알아들었을 때는 짐작하지 말고 천천히 다시 말해 달라고 해요.';
    else if (cb) why = `${cb.full ? '되짚은 줄 → 들은 길의 조각(동작 · 기준점 · 도착 위치)과 모두 맞아요.' : `${cb.why} 한 조각만 확인해도 돼요.`}`;
    else if (F.greet && !R) why = '말을 걸었어요. 상대가 돌아보면 가려는 곳을 물어요.';
    else {
      const sl = segs.filter(s => s.r === 'slot').map(s => s.t);
      why = `${shapeHead(q)} → ${q.cue || q.shape === 'note' ? In.ans : DR.SHAPE[q.shape].ans}. ` + (sl.length ? `틀 + 내 정보(${sl.join(' ')}) → ${src}의 사실과 맞아요.` : '짧은 대답이면 충분해요.');
      if (q.shape === 'yn' && In.offer && !/^(Yes|No)\b/.test(DR.text(a))) why += ` ${DR.SHAPE.yn.offer}.`;
    }
    if (pol.length) why += ` 공손한 말 → ${pol.join(' · ')}.`;
    if (F.bare && F.yes && In.offer) why += ' 어디에 가는지까지 말하면 바로 알려 줘요 → Yes, please. I\'m looking for …';
    notes.forEach(n => { why += ` ${n}`; });
    [F, R].forEach(G => { if (G && G.note) why += ` ${G.note}`; });
    [sv, rv].forEach(x => { if (x && x.note) why += ` ${x.note}`; });
    return res(true, 0, why, 'ok', { cb });
  };
  // 들린 만큼 되묻는 말이 맞나 (말에 그 조각이 있었나)
  DR.echoOk = (q, echo) => {
    if (q.echo) return q.echo.includes(echo);
    const R = q.route || (q.fact && q.fact.route);
    if (!R) return false;
    if (echo === 'bus') return R.mode === 'bus';
    if (echo === 'lr') return R.mode !== 'bus';
    return false;
  };
  // 모범 대답 (카드에 맞춰)
  DR.model = function (q, card) {
    if (typeof q === 'string') q = DR.Q[q];
    const C = Object.assign({}, card || {}, q.fact || {}), p = C.place, gen = DR.SLOT.place.vals[p] && DR.SLOT.place.vals[p].gen;
    if (q.fast) return { f: 'rp_again' };
    switch (q.intent) {
      case 'open': return { f: 'gr_ex', req: { f: gen ? 'ak_near' : 'ak_how', v: p } };
      case 'offer': return { f: 'of_yes', v: p };
      case 'need': return { f: gen ? 'ak_near' : 'ak_how', v: p };
      case 'which': return { f: 'wh_pl', v: p };
      case 'far': return { f: 'fr_which2' };
      case 'dir': return { f: 'cb_so', line: DR.modelLine(C.route, C.style) };
      case 'fix': return { f: 'cb_so', line: [DR.fixChunk(C.route, { i: C.fixAt })] };
      case 'confirm': return { f: 'th_ty' };
      case 'local': return { f: 'th_anyway' };
      default: return { f: 'rp_again' };
    }
  };
  // 되짚는 줄의 모범: 상대가 말한 조각 가운데 동작 · 기준점 · 도착 쪽 (관계는 빼요)
  DR.modelLine = (R, style) => DR.chunks(R, style || 'blocks').filter(c => c.k !== 'rel' && !(c.k === 'go' && c.n == null && !c.end));

  /* =========================================================
     말로 한 대답 — DR.norm · DR.canon · DR.parseCheck · DR.matchSpoken
     ========================================================= */
  const CONTR = [[/\bi'm\b/g, 'i am'], [/\bit's\b/g, 'it is'], [/\bwhat's\b/g, 'what is'], [/\bwhere's\b/g, 'where is'], [/\bdon't\b/g, 'do not'], [/\bi'll\b/g, 'i will'], [/\bcan't\b/g, 'cannot'], [/\byou're\b/g, 'you are'], [/\bthat's\b/g, 'that is'], [/\bthere's\b/g, 'there is'], [/\bisn't\b/g, 'is not'], [/\byou'll\b/g, 'you will'], [/\blet's\b/g, 'let us'], [/\bi'd\b/g, 'i would']];
  DR.norm = function (s) {
    let t = String(s || '').toLowerCase().replace(/[’‘]/g, '\'').replace(/café/g, 'cafe');
    CONTR.forEach(([r, w]) => { t = t.replace(r, w); });
    t = t.replace(/[^a-z0-9' -]+/g, ' ').replace(/-/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '');
    return t.split(/\s+/).filter(Boolean);
  };
  const W2N = {}; Object.entries(NUMW).forEach(([n, w]) => { W2N[w] = +n; });
  const ORD2 = { first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th', '1st': '1st', '2nd': '2nd', '3rd': '3rd', '4th': '4th', '5th': '5th' };
  // 낱말 → 숫자로 모음: fifteen → 15 · one five → 15 · third → 3rd
  DR.canon = function (s) {
    const w = DR.norm(s), out = [];
    let run = null;
    const flush = () => { if (run != null) { out.push(run); run = null; } };
    for (let i = 0; i < w.length; i++) {
      const x = w[i];
      let d = null;
      if (ORD2[x]) { flush(); out.push(ORD2[x]); continue; }
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
  // 곳 이름 알아보기 (말로)
  const SPK_PLACE = [
    ['conv', /\bconvenience\b(?! store)/], ['convenience', /\bconvenience store\b/], ['mart', /\bmart\b/], ['grocery', /\bgrocery( store)?\b/], ['supermarket', /\bsuper ?market\b/],
    ['underground', /\b(underground|tube)( station)?\b/], ['subway', /\b(subway|metro)( station)?\b/], ['petrol', /\bpetrol station\b/], ['gasstation', /\bgas station\b/],
    ['trainstation', /\b(train station|railway station)\b/],
    ['pharmacy', /\b(pharmacy|drugstore|drug store|chemist)\b/], ['hospital', /\bhospital\b/], ['museum', /\bmuseum\b/],
    ['toilet', /\btoilets?\b/], ['restroom', /\b(restroom|bathroom|washroom)s?\b/], ['postoffice', /\bpost office\b/], ['busstop', /\bbus stop\b/],
    ['market', /\briverside market\b|\bmarket\b/], ['zoo', /\bzoo\b/], ['stadium', /\bstadium\b/], ['beach', /\bbeach\b/],
    ['station', /\b(the|a) station\b/],
  ];
  DR.placeOf = raw => { const s = ' ' + DR.canon(raw).join(' ') + ' '; const hit = SPK_PLACE.find(([, r]) => r.test(s)); return hit ? hit[0] : null; };
  // 기준점 이름 (말로)
  const SPK_MARK = [['postoffice', /\bpost office\b/], ['flowershop', /\bflower (shop|store)\b|\bflorist\b/], ['police', /\bpolice( station)?\b/], ['bank', /\bbank\b/], ['cafe', /\b(cafe|coffee shop)\b/], ['library', /\blibrary\b/], ['hotel', /\bhotel\b/], ['school', /\bschool\b/], ['church', /\bchurch\b/], ['bakery', /\bbakery\b/], ['park', /\bpark\b/],
    ['trainstation', /\btrain station\b/], ['pharmacy', /\bpharmacy\b/], ['museum', /\bmuseum\b/], ['supermarket', /\bsupermarket\b/], ['subway', /\bsubway( station)?\b/], ['hospital', /\bhospital\b/], ['convenience', /\bconvenience store\b/], ['gasstation', /\bgas station\b/]];
  const markIn = s => { const hit = SPK_MARK.find(([, r]) => r.test(s)); return hit ? hit[0] : null; };
  const streetIn = s => { const all = T.V.concat(T.H); return all.find(n => s.includes(n.toLowerCase().replace(/-/g, ' '))) || null; };
  const ordN = t => t ? +String(t).replace(/\D/g, '') : null;
  // 말로 한 되짚기 → 조각
  DR.parseCheck = function (raw) {
    const s = ' ' + DR.canon(raw).join(' ') + ' ', out = [];
    const add = (i, c) => out.push(Object.assign({ at: i }, c));
    let m;
    const re = (r, f) => { r.lastIndex = 0; while ((m = r.exec(s))) f(m); };
    re(/\b(?:turn|go|hang a|make a) (left|right) twice\b/g, m => add(m.index, { k: 'twice', dir: m[1] }));
    re(/\btake (?:the )?(1st|2nd|3rd|4th|5th|next) (left|right)\b/g, m => add(m.index, { k: 'turn', dir: m[2], nth: m[1] === 'next' ? 1 : ordN(m[1]) }));
    // 돌기: turn left (at the bank · at the lights · onto Bell Street) · left at the bank
    const DELIM = '(?= (?:and|then|so|it|i|you|turn|take|cross|go|keep|hang|make|walk|get|left|right|that)\\b| ?$)';
    // until you get to the bank, then turn left → 은행에서 왼쪽으로
    const spans = [];
    re(new RegExp('\\buntil you (?:get|come) to (?:the )?([a-z0-9 ]+?) (?:and )?then (?:turn|go|hang a|make a) (left|right)\\b', 'g'), m => {
      spans.push([m.index, m.index + m[0].length]);
      const tail = ' ' + m[1] + ' ', c = { k: 'turn', dir: m[2] }, lm = markIn(tail), st = streetIn(tail);
      if (/\blights?\b/.test(tail)) { const k = /\b(2nd|3rd)\b/.exec(tail); c.lights = k ? ordN(k[1]) : 1; } else if (lm) c.lm = lm; else if (st) c.street = st;
      add(m.index + m[0].length - m[2].length - 1, c);
    });
    re(new RegExp('\\b(?:(?:turn|hang a|make a|go) (left|right)|(left|right)(?= (?:at|onto|on to) ))(?! twice)((?: (?:at|onto|on to) [a-z0-9 ]+?)?)' + DELIM, 'g'), m => {
      if (spans.some(([a, b]) => m.index >= a && m.index < b)) return;
      const dir = m[1] || m[2], tail = m[3] || '';
      const c = { k: 'turn', dir };
      const lm = markIn(tail), st = streetIn(tail), lt = /\blights?\b/.test(tail);
      if (lt) { const k = /\b(2nd|3rd)\b/.exec(tail); c.lights = k ? ordN(k[1]) : 1; }
      else if (lm) c.lm = lm; else if (st) c.street = st;
      add(m.index, c);
    });
    re(/\bon (?:my|your|the) (left|right)(?: side)?\b/g, m => add(m.index, { k: 'side', dir: m[1] }));
    re(/\b(?:go|walk|keep going|keep walking|head)? ?(?:straight )?(?:for )?(\d+) blocks?\b/g, m => add(m.index, { k: 'go', n: +m[1] }));
    re(/\bend of (?:this|the) block\b/g, m => add(m.index, { k: 'go', n: 1 }));
    re(/\bend of the street\b/g, m => add(m.index, { k: 'go', n: null, end: true }));
    re(/\bcross (?:over )?(?:the )?([a-z]+ (?:street|road)|street|road)\b/g, m => { const st = streetIn(m[1]); add(m.index, { k: 'cross', street: st }); });
    re(new RegExp('\\b(across from|opposite|next to|beside|behind|in front of) (?:the )?([a-z ]+?)' + DELIM, 'g'), m => { const of = markIn(' ' + m[2] + ' '); if (of) add(m.index, { k: 'rel', rel: { 'across from': 'across', opposite: 'across', 'next to': 'next', beside: 'next', behind: 'behind', 'in front of': 'front' }[m[1]], of }); });
    re(new RegExp('\\bbetween (?:the )?([a-z ]+?) and (?:the )?([a-z ]+?)' + DELIM, 'g'), m => { const a = markIn(' ' + m[1] + ' '), b = markIn(' ' + m[2] + ' '); if (a && b) add(m.index, { k: 'rel', rel: 'between', of: [a, b] }); });
    re(new RegExp('\\bon the corner of ([a-z ]+?) and ([a-z ]+?)' + DELIM, 'g'), m => { const a = streetIn(' ' + m[1] + ' '), b = streetIn(' ' + m[2] + ' '); if (a && b) add(m.index, { k: 'rel', rel: 'corner', of: [a, b] }); });
    re(/\b(?:number (\d+)(?: bus)?|(\d+) bus|bus (?:number )?(\d+)|(?:take|catch|get on|want) the (\d+))\b/g, m => add(m.index, { k: 'bus', num: +(m[1] || m[2] || m[3] || m[4]) }));
    re(/\b(?:get off )?at (?:the )?(1st|2nd|3rd|4th|5th) stop\b/g, m => add(m.index, { k: 'off', nth: ordN(m[1]) }));
    if (out.some(c => c.k === 'bus' || c.k === 'off')) {
      re(/\b(?:from )?(?:the (?:bus )?stop )?across the street\b/g, m => add(m.index, { k: 'stop', where: 'across' }));
      re(/\b(?:from )?(?:this|the same) (?:bus )?(?:stop|side)\b|\bright here\b/g, m => add(m.index, { k: 'stop', where: 'here' }));
      // 버스 이야기 안의 cross the street → 길 건너편 정류장
      out.forEach(c => { if (c.k === 'cross' && !c.street) { c.k = 'stop'; c.where = 'across'; } });
    }
    out.sort((a, b) => a.at - b.at);
    // 겹친 조각 빼기 (같은 자리의 돌기 둘 · 버스 안의 숫자)
    const keep = [];
    out.forEach(c => { const prev = keep[keep.length - 1]; if (prev && prev.at === c.at && prev.k === c.k) return; if (c.k === 'stop' && keep.some(x => x.k === 'stop')) return; keep.push(c); });
    return keep.map(c => { const o = Object.assign({}, c); delete o.at; return o; });
  };
  const others = (list, me) => list.filter(n => n !== me);
  DR.matchSpoken = function (raw, q, card) {
    if (typeof q === 'string') q = DR.Q[q];
    const toks = DR.canon(raw), s = ' ' + toks.join(' ') + ' ', heard = DR.norm(raw).join(' ');
    if (!toks.length) return { ok: false, stage: 0, why: '들린 말이 없어요. 다시 말해 보세요.', heard: '' };
    const C = Object.assign({}, card || {}, q.fact || {}), It = DR.INTENT[q.intent];
    const R = (ok, stage, why, o = {}) => Object.assign({ ok, stage, why, heard }, o);
    const notes = [];
    const pass = (why, cov, x) => R(true, 0, why + (notes.length ? ' 알림: ' + notes.join(' ') : ''), Object.assign({ note: notes.join(' '), covered: cov || [q.intent] }, x || {}));
    const keyMiss = () => R(false, 1, `${shapeHead(q)}(${q.cue ? It.ans : DR.SHAPE[q.shape].ans}). 들린 말에 그 대답이 없어요.`);
    const yesHeard = /\b(yes|yeah|yep|sure|okay|ok)\b/.test(s), noHeard = /\b(no|nope)\b/.test(s);
    const bare = toks.every(t => /^(yes|yeah|yep|no|nope|please|sure|thanks|thank|you|okay|ok|of|course|uh|um|well)$/.test(t)) && /\b(yes|yeah|yep|no|nope|sure|okay|ok)\b/.test(s);
    // 다시 묻기
    const again = /\b(say that again|again|repeat|more slowly|slow down|pardon|come again)\b/.test(s), map = /\b(show me on the map|on the map|on my phone)\b/.test(s);
    const echoLR = /\bleft or right\b|\bright or left\b/.test(s), echoBus = /\b(which bus|what bus|which number|bus number)\b/.test(s) && /\bsorry\b/.test(s);
    if (q.fast) {
      if (echoLR) return (q.echo || []).includes('lr') ? R(false, 1, '들린 만큼 되물었어요. 상대가 그 부분을 다시 말해 줄 거예요.', { repair: 'echo' }) : R(false, 1, '되물은 말이 달라요. 돌라는 말은 없었어요.');
      if (echoBus) return (q.echo || []).includes('bus') ? R(false, 1, '들린 만큼 되물었어요. 상대가 버스 번호를 다시 말해 줄 거예요.', { repair: 'echo' }) : R(false, 1, '되물은 말이 달라요. 버스 이야기는 없었어요.');
      if (again || map || /\bsorry\b/.test(s)) return R(false, 1, '다시 묻는 말로 들었어요. 상대가 천천히 한 번 더 말해 줄 거예요.', { repair: map ? 'map' : 'again' });
      return R(false, 1, '너무 빨라서 열쇠 낱말을 다 못 잡았어요. 짐작하지 말고 먼저 다시 물어요 → Sorry, could you say that again more slowly, please?');
    }
    if ((again || map || echoLR || echoBus) && toks.length <= 11 && q.intent === 'dir') {
      if (echoBus && !DR.echoOk(q, 'bus')) return R(false, 1, '되물은 말이 달라요. 버스 이야기는 없었어요.');
      if (echoLR && !DR.echoOk(q, 'lr')) return R(false, 1, '되물은 말이 달라요. 돌라는 말은 없었어요.');
      return R(false, 1, '다시 묻는 말로 들었어요. 상대가 천천히 한 번 더 말해 줄 거예요.', { repair: map ? 'map' : echoLR || echoBus ? 'echo' : 'again' });
    }
    if (bare && (q.shape === 'or' || q.shape === 'wh')) return R(false, 1, `${shapeHead(q)}. ${q.shape === 'or' ? '둘 가운데 하나를 고르라는 말이라 yes · no만으로는 무엇을 골랐는지 알 수 없어요' : '정보를 묻는 말이라 yes · no로는 답이 안 돼요'} → ${It.want}`, { tag: 'shape' });
    // 곳 이름
    const placeOf = () => DR.placeOf(raw);
    const checkPlace = (p, label) => {
      if (p === 'station') { if (C.place === 'trainstation' || C.place === 'subway') { notes.push('station만 말하면 기차역인지 지하철역인지 헷갈릴 수 있어요 → the train station · the subway station.'); return null; } return R(false, 2, `카드와 달라요. 카드: ${DR.factKo('place', C.place)} · 들린 말: station(역).`, { tag: 'fact' }); }
      const v = DR.SLOT.place.vals[p];
      if (v && v.bad) return R(false, 2, v.why, { tag: 'literal' });
      const f = v ? v.fact.place : p;
      if (C.place && f !== C.place) return R(false, 2, `카드와 달라요. 카드: ${DR.factKo('place', C.place)} · 들린 말: ${DR.factKo('place', f)}.`, { tag: 'fact' });
      if (v && v.note) notes.push(v.note);
      return null;
    };
    switch (q.intent) {
      case 'open': case 'need': case 'offer': case 'which': {
        const greet = /\b(excuse me|sorry to bother you|hi|hello|hey)\b/.test(s), p = placeOf();
        if (q.intent === 'offer' && noHeard && !yesHeard && !p) return R(false, 2, '카드: 길을 찾고 있어요. 거절하면 길을 알 수 없어요 → Yes, please. I\'m looking for …', { tag: 'fact' });
        if (!p) {
          if (q.intent === 'open' && greet) return pass('말을 거는 말이 들렸어요. 상대가 돌아보면 가려는 곳을 물어요.', ['open'], { greetOnly: true });
          if (q.intent === 'offer' && yesHeard) { notes.push('어디에 가는지까지 말하면 바로 알려 줘요 → Yes, please. I\'m looking for …'); return pass('도와 달라는 말이 들렸어요.', ['offer'], { greetOnly: true }); }
          return keyMiss();
        }
        if (q.intent === 'which' && q.choices && (p === 'station' || !q.choices.includes((DR.SLOT.place.vals[p] || {}).fact ? DR.SLOT.place.vals[p].fact.place : p))) return R(false, 1, `${shapeHead(q)}. 상대가 말한 것 가운데 하나를 골라요.`, { tag: 'choice' });
        const bad = checkPlace(p); if (bad) return bad;
        if (/\bteach\b/.test(s)) notes.push(DR.FRAME.ak_teach.note);
        if (q.intent === 'open' && !greet) notes.push('모르는 사람에게는 Excuse me부터 하면 더 자연스러워요(말로 한 대답은 말투를 판정하지 않아요).');
        if (/\bhey\b/.test(s) || /\btell me the way\b/.test(s)) notes.push('Hey! · Tell me the way …는 무례하게 들릴 수 있어요(말로 한 대답은 말투를 판정하지 않아요).');
        return pass('가려는 곳이 들렸고 카드와 맞아요.', q.intent === 'open' ? ['open', 'need'] : [q.intent]);
      }
      case 'far': {
        if (/\b(which|what) bus\b|\bwhich number\b|\bbus number\b|\bwhich one\b/.test(s)) {
          if (!/\b(which|what)\b/.test(s)) notes.push('Bus number?만 툭 던지면 퉁명스럽게 들려요(말로 한 대답은 말투를 판정하지 않아요) → Which bus should I take?');
          return pass('어떤 버스인지 묻는 말이 들렸어요.');
        }
        if (/\bwalk\b/.test(s)) return C.mode === 'bus' ? R(false, 2, '카드와 달라요. 카드: 버스를 타요 · 들린 말: 걸어가기.', { tag: 'fact' }) : pass('걸어간다는 말이 들렸어요.');
        if (bare) return R(false, 1, `${shapeHead(q)} → ${It.want}`, { tag: 'shape' });
        return keyMiss();
      }
      case 'dir': case 'fix': {
        const ch = DR.parseCheck(raw);
        if (!ch.length) {
          if (/\b(thank|thanks)\b/.test(s)) return R(false, 2, '영어로 틀린 말은 아니에요. 다만 들은 조각을 되짚지 않았어요 → So, ___? (이 튜토리얼의 연습)', { tag: 'need' });
          if (bare) return R(false, 1, `${shapeHead(q)} → 들은 조각을 되짚어요 → So, ___?`, { tag: 'shape' });
          if (placeOf()) return R(false, 1, '길 안내를 들었어요. 지금은 곳을 다시 묻기보다 들은 조각을 되짚을 차례예요 → So, ___?');
          return keyMiss();
        }
        if (ch.some(c => c.k === 'side') && /\bon your (left|right)\b/.test(s)) notes.push('되짚을 때는 your → my로 바꿔요 → it\'s on my right.');
        const cb = DR.checkBack(C.route, ch, { covered: C.covered || [] });
        if (!cb.ok) return R(false, 2, cb.why, { tag: 'check', cb, chunks: ch });
        if (q.intent === 'fix' && C.fixAt != null && !cb.mine.includes(C.fixAt)) return R(false, 2, '고쳐 준 조각을 다시 되짚어요.', { tag: 'need', cb, chunks: ch });
        return pass(cb.full ? '되짚은 조각이 들은 길과 모두 맞아요.' : `${cb.why}`, [q.intent], { cb, chunks: ch });
      }
      case 'confirm': {
        if (/\byou are welcome\b/.test(s)) return R(false, 1, DR.judge(q, { f: 'th_welcome' }, C).why);
        if (/\b(thank|thanks|appreciate|great|perfect)\b/.test(s)) return pass('고맙다는 말이 들렸어요.');
        if (/\b(bye|okay|ok)\b/.test(s)) { notes.push('Okay. Bye.만 하면 무뚝뚝하게 들려요(말로 한 대답은 말투를 판정하지 않아요) → Thank you so much!'); return pass('끝내는 말이 들렸어요.'); }
        return keyMiss();
      }
      case 'local': {
        if (placeOf() && /\b(how|where|is there|looking for)\b/.test(s)) return R(false, 1, '이 사람은 이 동네를 몰라요(not from around here). 다시 물어도 알려 줄 수 없어요 → That\'s okay. Thanks anyway.');
        if (/\b(thank|thanks|that is okay|that is ok|no problem|no worries)\b/.test(s)) { if (!/\banyway\b/.test(s)) notes.push('모른다고 한 사람에게는 → Thanks anyway.'); return pass('괜찮다는 말 · 고맙다는 말이 들렸어요.'); }
        if (/\b(bye|okay|ok)\b/.test(s)) { notes.push('Okay. Bye.만 하면 무뚝뚝하게 들려요(말로 한 대답은 말투를 판정하지 않아요) → That\'s okay. Thanks anyway.'); return pass('끝내는 말이 들렸어요.'); }
        return keyMiss();
      }
      default: return R(false, 0, '이 말은 말로 대답하기를 지원하지 않아요.');
    }
  };

  /* ---------- 따라 말하기: 낱말 맞춰 보기 (가장 긴 공통 부분열, 숫자는 같은 숫자로) ---------- */
  DR.compareWords = function (target, heard) {
    const tw = String(target).split(/\s+/).filter(Boolean), tt = [];
    tw.forEach((x, i) => DR.canon(x).forEach(p => tt.push({ p, i })));
    const A = tt.map(x => x.p), B = DR.canon(heard), D = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) D[i][j] = A[i] === B[j] ? D[i + 1][j + 1] + 1 : Math.max(D[i + 1][j], D[i][j + 1]);
    const got = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { got.add(i); i++; j++; } else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++; }
    const okW = tw.map((_, k) => { const parts = tt.map((x, n) => [x, n]).filter(([x]) => x.i === k); return parts.length ? parts.every(([, n]) => got.has(n)) : true; });
    return { words: tw.map((t, k) => ({ t, ok: okW[k] })), hit: okW.filter(Boolean).length, total: tw.length };
  };

  /* =========================================================
     길 카드 (길 찾기 시뮬레이터)
     ========================================================= */
  // 출발할 수 있는 곳: 모든 길 조각의 가운데, 두 방향
  DR.STARTS = [];
  for (let r = 0; r < T.R; r++) for (let c = 0; c < T.C - 1; c++) ['E', 'W'].forEach(h => DR.STARTS.push({ key: `H${r}:${c}`, t: 0.5, h }));
  for (let c = 0; c < T.C; c++) for (let r = 0; r < T.R - 1; r++) ['N', 'S'].forEach(h => DR.STARTS.push({ key: `V${c}:${r}`, t: 0.5, h }));
  // 카드에 쓸 만한 길: 한두 번 돌고, 도는 곳마다 이름표가 있고, 너무 길지 않음
  DR.goodRoute = R => !!R && R.mode === 'walk' && R.turns >= 1 && R.turns <= 2 && R.legs.every(L => L.n <= 3) && R.blocks <= 6;
  DR.newCard = function (rnd = Math.random) {
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const bus = rnd() < 0.25, notLocal = rnd() < 0.4;
    const sp = pick(['us', 'ca', 'gb']);
    if (bus) {
      const dest = pick(Object.keys(DR.FAR)), side = pick(['N', 'S']);
      const start = { key: 'H1:1', t: 0.2, h: pick(['E', 'W']), side };
      const R = DR.route(start, dest);
      return { mode: 'bus', place: dest, start, route: R, style: pick(['stop', 'cross']), notLocal, sp };
    }
    for (let k = 0; k < 200; k++) {
      const dest = pick(DR.DESTS), start = pick(DR.STARTS), R = DR.route(start, dest);
      if (!DR.goodRoute(R)) continue;
      return { mode: 'walk', place: dest, start, route: R, style: pick(DR.STYLES), notLocal, sp };
    }
    const start = { key: 'H1:0', t: 0.5, h: 'E' };
    return { mode: 'walk', place: 'trainstation', start, route: DR.route(start, 'trainstation'), style: 'blocks', notLocal, sp };
  };
  DR.cardRows = c => {
    const st = DR.startText(c.start);
    return [
      ['지금 있는 곳', c.mode === 'bus' ? `${st.street} · ${c.start.side === 'N' ? '공원 쪽 보도' : '마트 쪽 보도'}` : st.street],
      ['바라보는 쪽', `${st.toward} 쪽 (지도의 화살표)`],
      ['가려는 곳', c.mode === 'bus' ? `${DR.FAR[c.place].ko} (${DR.FAR[c.place].the}) — 지도 밖` : DR.SPOT[c.place].ko],
      ['가는 방법', c.mode === 'bus' ? '버스 (걸어가기엔 멀어요)' : '걸어서'],
    ];
  };
  // 시뮬레이터의 차례: [첫 사람(모름) →] 말 걸기 → (묻기) → (멀어요) → 길 안내 · 되짚기 → 지도에서 찾기 → 고맙다고 끝내기
  DR.simSteps = c => [].concat(c.notLocal ? ['open1', 'local'] : [], ['open', 'need'], c.mode === 'bus' ? ['far'] : [], ['dir', 'map', 'confirm']);
  // 단계의 말
  DR.simQ = function (step, c) {
    if (step === 'open' || step === 'open1') return Object.assign({}, DR.Q.gr_cue, { sp: step === 'open1' ? 'au' : c.sp });
    if (step === 'local') return DR.Q.th_local;
    if (step === 'need') return Object.assign({}, DR.Q.ak_yes, { sp: c.sp });
    if (step === 'far') return Object.assign({}, DR.Q.fr_far, { sp: c.sp });
    if (step === 'dir') return DR.dirQ(c.route, c.style, { sp: c.sp });
    if (step === 'confirm') return Object.assign({}, DR.Q.cb_ok, { sp: c.sp });
    return null;
  };
  // 단계마다 틀 칩: 맞는 틀 · 함정(한국어 그대로 · 무례한 말) · 다른 차례의 틀
  DR.SIM_FRAMES = {
    open: c => [DR.SLOT.place.vals[c.place] && DR.SLOT.place.vals[c.place].gen ? 'ak_near' : 'ak_how', 'ak_rude', 'fr_which2'],
    need: c => [DR.SLOT.place.vals[c.place] && DR.SLOT.place.vals[c.place].gen ? 'ak_near' : 'ak_how', 'ak_tell', 'g_yesp'],
    far: () => ['fr_which2', 'fr_num', 'th_anyway'],
    confirm: () => ['th_ty', 'th_bye', 'th_welcome'],
    local: () => ['th_anyway', 'th_bye', 'fr_which2'],
  };
  DR.simFrames = (step, c) => { const k = step === 'open1' ? 'open' : step; const x = DR.SIM_FRAMES[k]; return x ? x(c) : null; };
  DR.GREETS = ['gr_ex', 'gr_sorry', 'gr_hey', 'gr_none'];
  // 곳 칩: 카드의 곳 + 헷갈리기 쉬운 값(콩글리시 · 다른 곳)
  const NEAR_PLACE = { supermarket: ['mart', 'convenience'], convenience: ['conv', 'supermarket'], subway: ['trainstation', 'museum'], trainstation: ['subway', 'busstop'], pharmacy: ['hospital', 'postoffice'], hospital: ['pharmacy', 'museum'], museum: ['hospital', 'subway'], gasstation: ['busstop', 'supermarket'],
    market: ['supermarket', 'museum'], zoo: ['museum', 'stadium'], stadium: ['museum', 'zoo'], beach: ['busstop', 'zoo'] };
  DR.placeChoices = function (c, rnd = Math.random) {
    const out = [c.place].concat(NEAR_PLACE[c.place] || ['museum', 'hospital']);
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  };
  // 되짚는 조각 칩: 상대가 말한 조각 + 하나씩 틀린 조각 (방향 · 기준점 · 블록 · 도착 쪽 · 두 번 돌기 · 돌기와 있기 · 번호 · 정류장)
  DR.chunkChips = function (c, rnd = Math.random) {
    const R = c.route, told = DR.modelLine(R, c.style), wrong = [];
    const flip = d => d === 'left' ? 'right' : 'left';
    const W = (i, x) => wrong.push(Object.assign(x, { forIdx: i }));
    told.forEach((x, i) => {
      if (x.k === 'turn') {
        W(i, Object.assign({}, x, { dir: flip(x.dir) }));
        if (x.nth && !(R.legs.length === 2 && R.legs[0].dir === R.legs[1].dir)) W(i, { k: 'twice', dir: x.dir });   // 같은 쪽으로 두 번 도는 길이면 turn ___ twice가 맞는 말이라 함정이 아니에요
        else if (x.lm) { const other = DR.MARKS.find(m => m !== x.lm && m !== 'park' && !R.legs.some(L => DR.marksAt(L.I, true).includes(m)) && (rnd() < 0.5 || m === 'postoffice')); if (other) W(i, Object.assign({}, x, { lm: other })); }
      }
      if (x.k === 'go' && x.n) W(i, { k: 'go', n: x.n === 3 ? 2 : x.n + 1 });
      if (x.k === 'side') { W(i, { k: 'side', dir: flip(x.dir) }); W(i, { k: 'turn', dir: x.dir }); }
      if (x.k === 'bus') W(i, { k: 'bus', num: x.num === 15 ? 50 : 15 });
      if (x.k === 'off') W(i, { k: 'off', nth: x.nth === 1 ? 2 : x.nth - 1 });
      if (x.k === 'stop') W(i, { k: 'stop', where: x.where === 'across' ? 'here' : 'across' });
    });
    // 상대가 말한 조각은 모두 + 함정은 셋 이상 (모두 아홉 개까지, 키보드 1~9)
    const seen = new Set(), keep = [], traps = [];
    told.forEach(x => { const t = DR.chunkText(x); if (!seen.has(t)) { seen.add(t); keep.push(x); } });
    for (let i = wrong.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [wrong[i], wrong[j]] = [wrong[j], wrong[i]]; }
    wrong.forEach(x => { const t = DR.chunkText(x); if (!seen.has(t)) { seen.add(t); traps.push(x); } });
    const all = keep.concat(traps.slice(0, Math.max(3, 9 - keep.length)));
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    return all.slice(0, 9);
  };
  // 반응 (단계별)
  DR.REACT = {
    ok: ['Sure.', 'Of course.', 'No problem.'],
    1: q => q.cue ? { en: '(The person keeps walking.)', ko: '아무 말도 하지 않았어요. 먼저 Excuse me.' } : { en: `Sorry? ${q.short && /\?$/.test(q.short) ? q.short : ''}`.trim(), ko: q.shape === 'or' || q.shape === 'wh' ? `${DR.SHAPE[q.shape].ko} → ${DR.SHAPE[q.shape].ans}` : `‘${q.key.join(' … ')}’를 말했어요.` },
    2: (q, j, a) => {
      const F = a && DR.FRAME[a.f], vals = a ? [a.v, a.req && a.req.v] : [];
      if (vals.includes('mart')) return { en: 'Sorry, a… mart? Do you mean a supermarket?', ko: '마트 → a supermarket · a grocery store.' };
      if (vals.includes('conv')) return { en: 'A convenience…? Oh, a convenience store?', ko: '편의점 → a convenience store.' };
      if (j.cb && j.cb.fix) return { en: j.cb.fix.en, ko: j.cb.fix.ko };
      if (j.tag === 'need') return { en: 'Okay! Did you get all that?', ko: '되짚지 않으면 잘못 들은 곳을 모른 채 걸어가요.' };
      if (j.tag === 'fact') return { en: 'Hmm, are you sure?', ko: '길 카드(또는 상대가 한 말)를 다시 보세요.' };
      return { en: 'Sorry?', ko: '알아듣기 어려운 말이에요.' };
    },
    3: (q, j) => ({ en: q.cue ? '(The person looks surprised.) …Um, yes?' : '…Okay.', ko: q.cue ? '말을 걸었지만 무례하게 들렸어요.' : '뜻은 통했지만 말투가 거칠어요.' }),
  };

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 길 (모두 지도에서 계산)
     ========================================================= */
  const o = (f, v, req) => { const a = { f }; if (v != null) a.v = String(v); if (req) a.req = req; return a; };
  const Lr = chunks => ({ f: 'cb_so', line: chunks });
  DR.o = o; DR.Lr = Lr;
  // 00 · 06장의 길: Main Street(Fern – Hill)에서 동쪽을 보고 → 기차역
  DR.DEMO_START = { key: 'H1:0', t: 0.5, h: 'E' };
  DR.DEMO = DR.route(DR.DEMO_START, 'trainstation');
  DR.DEMO_CARD = { place: 'trainstation', mode: 'walk', route: DR.DEMO, style: 'blocks', start: DR.DEMO_START };
  // 08장: 두 번 도는 길 — River Road(Fern – Hill)에서 동쪽을 보고 → 박물관 대신 병원
  DR.DEMO2_START = { key: 'V0:1', t: 0.5, h: 'N' };
  // 05장 버스: Main Street 북쪽 보도(공원 앞) → 리버사이드 시장
  DR.BUS_START = { key: 'H1:1', t: 0.2, h: 'E', side: 'N' };
  DR.BUS_DEMO = DR.route(DR.BUS_START, 'market');
  DR.BUS_CARD = { place: 'market', mode: 'bus', route: DR.BUS_DEMO, style: 'stop', start: DR.BUS_START };
  // 03장: 같은 교차점, 바라보는 쪽에 따라 다른 turn left
  DR.turnFrom = (I, h, dir) => { const h2 = dir === 'left' ? LEFT[h] : RIGHT[h]; return { h2, seg: segFrom(I[0], I[1], h2) }; };
  // 03장: 움직임 적용 (직접 해 보기 · 퀴즈 그림): 출발 + 동작들 → 지나간 점들
  DR.applyMoves = function (start, moves) {
    let seg = segOf(start.key), h = start.h, I = segEnd(seg, h);
    const pts = [DR.segPoint(start.key, start.t), I.slice()];
    for (const mv of moves) {
      if (mv.k === 'straight') { const s2 = segFrom(I[0], I[1], h); if (!s2) return { pts, ok: false, h }; I = segEnd(s2, h); pts.push(I.slice()); continue; }
      if (mv.k === 'turn') {
        // nth번째 그쪽 길까지 곧장
        let cnt = 0;
        for (let g = 0; g < 6; g++) {
          const h2 = mv.dir === 'left' ? LEFT[h] : RIGHT[h];
          if (segFrom(I[0], I[1], h2)) cnt++;
          if (cnt >= (mv.nth || 1)) { h = h2; const s2 = segFrom(I[0], I[1], h); I = segEnd(s2, h); pts.push(I.slice()); break; }
          const s2 = segFrom(I[0], I[1], h); if (!s2) return { pts, ok: false, h }; I = segEnd(s2, h); pts.push(I.slice());
        }
      }
    }
    return { pts, ok: true, h, I };
  };

  /* =========================================================
     듣고 대답 고르기 16문제 (모두 새로 만든 대화). card = 그 상황의 사실
     ========================================================= */
  const RT = (key, t, h, dest) => DR.route({ key, t, h }, dest);
  const dq = (R, style, place, o2 = {}) => DR.dirQ(R, style, Object.assign({ place }, o2));
  const ch = (R, style) => DR.chunks(R, style);
  DR.DRILL_ROUTES = {
    a: RT('H1:0', 0.5, 'E', 'trainstation'),       // 두 블록 → 은행에서 왼쪽 → 오른쪽
    b: RT('H2:2', 0.5, 'W', 'subway'),             // 다른 방향
    c: RT('V3:1', 0.5, 'N', 'museum'),
    d: RT('H0:0', 0.5, 'E', 'pharmacy'),
    e: RT('V0:0', 0.5, 'S', 'museum'),
  };
  const DRT = DR.DRILL_ROUTES;
  const busB = DR.route({ key: 'H1:1', t: 0.2, h: 'W', side: 'N' }, 'market');
  const cardOf = (R, style, place) => ({ place: place || R.dest, mode: R.mode, route: R, style });
  DR.DRILL = [];
  DR.buildDrill = function () {
    const flip = d => d === 'left' ? 'right' : 'left';
    const A = DRT.a, aT = A.legs[0];
    const items = [];
    // 1 말 걸기 (지나가는 사람)
    items.push({ q: 'gr_cue', sit: '기차역을 찾고 있어요. 앞에서 한 사람이 걸어와요. 첫마디는?', card: { place: 'trainstation' }, a: 1,
      opts: [o('gr_hey', null, o('ak_where', 'trainstation')), o('gr_ex', null, o('ak_how', 'trainstation')), o('gr_none', null, o('ak_rude', 'trainstation')), o('gr_ex', null, o('ak_how', 'museum'))] });
    // 2 말 걸기 (도와줄까요?)
    items.push({ q: 'gr_help', sit: '약국을 찾고 있어요. 지도를 보며 서 있는데 누가 말을 걸어요.', card: { place: 'pharmacy' }, a: 3,
      opts: [o('fine'), o('g_no'), o('ak_tell', 'pharmacy'), o('of_yes', 'pharmacy')] });
    // 3 묻기 (편의점)
    items.push({ q: 'ak_yes', sit: 'Excuse me.라고 말을 걸었어요. 편의점을 찾아요.', card: { place: 'convenience' }, a: 2,
      opts: [o('ak_near', 'conv'), o('g_yesp'), o('ak_near', 'convenience'), o('ak_tell', 'convenience')] });
    // 4 묻기 (고르는 질문)
    items.push({ q: 'ak_which', sit: 'Is there a station near here?라고 물었어요. 지하철을 타려고 해요.', card: { place: 'subway' }, a: 0,
      opts: [o('wh_pl', 'subway'), o('g_yesp'), o('wh_pl', 'trainstation'), o('wh_pl', 'busstop')] });
    // 5 동작 (두 번째 왼쪽 길)
    { const R = DRT.a, q = dq(R, 'nth', 'move', { sp: 'ca' }), t = ch(R, 'nth')[0];
      items.push({ q, sit: '들은 동작을 한 조각만 되짚어 확인해요.', card: cardOf(R, 'nth'), a: 3,
        opts: [Lr([{ k: 'twice', dir: t.dir }]), Lr([Object.assign({}, t, { dir: flip(t.dir) })]), Lr([Object.assign({}, t, { nth: t.nth + 1 })]), Lr([t])] }); }
    // 6 동작 (turn left와 on your left)
    { const R = DRT.b, q = dq(R, 'until', 'move', { sp: 'us' }), c = ch(R, 'until'), tn = c.filter(x => x.k === 'turn'), sd = c.find(x => x.k === 'side');
      items.push({ q, sit: '들은 길을 되짚어요.', card: cardOf(R, 'until'), a: 0,
        opts: [Lr(tn.concat([sd])), Lr(tn.concat([{ k: 'turn', dir: sd.dir }])), Lr(tn.map(x => Object.assign({}, x, { dir: flip(x.dir) })).concat([sd])), o('cb_ty')] }); }
    // 7 기준점 · 위치 (맞은편과 바로 옆)
    { const R = DRT.a, q = dq(R, 'blocks', 'mark', { sp: 'gb' }), rel = DR.relationsOf(R.dest), acr = rel.find(r => r.rel === 'across'), nx = rel.find(r => r.rel === 'next');
      items.push({ q, sit: '도착 위치만 되짚어 확인해요.', card: cardOf(R, 'blocks'), a: 1,
        opts: [Lr([{ k: 'side', dir: R.arrive.side }, { k: 'rel', rel: 'next', of: acr.of }]), Lr([{ k: 'side', dir: R.arrive.side }, { k: 'rel', rel: 'across', of: acr.of }]), Lr([{ k: 'side', dir: flip(R.arrive.side) }, { k: 'rel', rel: 'across', of: acr.of }]), Lr([{ k: 'side', dir: R.arrive.side }, { k: 'rel', rel: 'behind', of: nx ? nx.of : 'bank' }])] }); }
    // 8 기준점 (은행 · 우체국)
    { const R = DRT.d, q = dq(R, 'until', 'mark', { sp: 'ca' }), c = ch(R, 'until'), t = c.find(x => x.k === 'turn');
      const otherLm = t.lm === 'bank' ? 'postoffice' : 'bank';
      items.push({ q, sit: '어디에서 도는지 한 조각만 되짚어요.', card: cardOf(R, 'until'), a: 2,
        opts: [Lr([Object.assign({}, t, { lm: otherLm })]), Lr([Object.assign({}, t, { dir: flip(t.dir) })]), Lr([t]), o('rp_map')] }); }
    // 9 거리 · 교통 (멀어요)
    items.push({ q: 'fr_far', sit: '리버사이드 시장(Riverside Market)에 가려고 해요. 버스를 탈 생각이에요.', card: { place: 'market', mode: 'bus' }, a: 1,
      opts: [o('fr_walk'), o('fr_which2'), o('fr_num'), o('g_yes')] });
    // 10 거리 · 교통 (15와 50)
    { const R = busB, q = dq(R, 'stop', 'far', { sp: 'us' }), c = ch(R, 'stop');
      items.push({ q, sit: '들은 버스 안내를 되짚어요.', card: cardOf(R, 'stop'), a: 3,
        opts: [Lr(c.map(x => x.k === 'bus' ? Object.assign({}, x, { num: 50 }) : x)), Lr(c.map(x => x.k === 'off' ? Object.assign({}, x, { nth: 1 }) : x)), Lr(c.map(x => x.k === 'stop' ? Object.assign({}, x, { where: x.where === 'here' ? 'across' : 'here' }) : x)), Lr(c)] }); }
    // 11 되짚기 (한 줄, 두 번 돌기)
    { const R = DRT.e, q = dq(R, 'blocks', 'check', { sp: 'us' }), c = DR.modelLine(R, 'blocks'), ti = c.findIndex(x => x.k === 'turn'), t2 = c.map((x, i) => [x, i]).filter(([x]) => x.k === 'turn').pop()[1];
      items.push({ q, sit: '들은 길을 한 줄로 되짚어요.', card: cardOf(R, 'blocks'), a: 0,
        opts: [Lr(c), Lr(c.map((x, i) => i === t2 ? Object.assign({}, x, { dir: flip(x.dir) }) : x)), Lr(c.filter((x, i) => i !== ti)), Lr(c.map(x => x.k === 'side' ? { k: 'side', dir: flip(x.dir) } : x))] }); }
    // 12 되짚기 (블록 수)
    { const R = DRT.c, q = dq(R, 'blocks', 'check', { sp: 'ca' }), c = DR.modelLine(R, 'blocks');
      const gi = c.findIndex(x => x.k === 'go'), tTurn = c.find(x => x.k === 'turn');
      const wrongGo = gi >= 0 ? c.map((x, i) => i === gi ? { k: 'go', n: (x.n || 1) + 1 } : x) : [{ k: 'go', n: 3 }].concat(c);
      const offLm = DR.MARKS.find(m => m !== 'park' && !R.legs.some(L => DR.marksAt(L.I, true).includes(m)));
      items.push({ q, sit: '들은 길을 한 줄로 되짚어요.', card: cardOf(R, 'blocks'), a: 2,
        opts: [Lr(wrongGo), Lr(c.map(x => x.k === 'turn' && x === tTurn ? Object.assign({}, x, { lm: offLm }) : x)), Lr(c), o('th_welcome')] }); }
    // 13 되짚기 (고쳐 준 말)
    { const R = DRT.a, wrongLine = [{ k: 'go', n: aT.n }, { k: 'turn', dir: flip(aT.dir), lm: aT.lm }], cb = DR.checkBack(R, wrongLine), q = DR.fixQ(R, cb, { sp: 'us' });
      const fx = DR.fixChunk(R, cb.err);
      items.push({ q, sit: '되짚었더니 상대가 한 조각을 고쳐 줬어요.', card: Object.assign(cardOf(R, 'blocks'), { fixAt: cb.err.i }), a: 1,
        opts: [Lr([Object.assign({}, fx, { dir: flip(fx.dir) })]), Lr([fx]), o('th_welcome'), o('th_bye')] }); }
    // 14 고맙다고 끝내기 (모른대요)
    items.push({ q: 'th_local', sit: '병원 가는 길을 물었어요.', card: { place: 'hospital' }, a: 2,
      opts: [o('th_bye'), o('ak_how', 'hospital'), o('th_anyway'), o('th_why')] });
    // 15 고맙다고 끝내기 (맞아요)
    items.push({ q: 'cb_ok', sit: '되짚었더니 맞다고 해요.', card: {}, a: 3,
      opts: [o('th_welcome'), o('th_bye'), o('g_yes'), o('th_ty')] });
    // 16 다시 묻기 (빠른 말)
    items.push({ q: 'dr_fast', sit: '아주 빠르게 말해서 ‘… left … bank …’만 들렸어요.', card: {}, a: 0,
      opts: [o('rp_again'), Lr([{ k: 'turn', dir: 'left', lm: 'bank' }, { k: 'side', dir: 'left' }]), o('rp_what'), o('rp_bus')] });
    items.forEach((it, i) => { it.n = i; it.Q = typeof it.q === 'string' ? DR.Q[it.q] : it.q; it.place = it.Q.place; });
    return items;
  };
  DR.DRILL = DR.buildDrill();
  // 직접 해 보기의 짧은 문제 (00장 · 07장) — 연습 문제와 다른 상황
  DR.MINI = {
    intro: { q: 'ak_uk', sit: '영국에서 지하철역을 찾고 있어요. Excuse me.라고 말을 걸었어요.', card: { place: 'subway' }, a: 2, opts: [o('g_yes'), o('lk_for', 'mart'), o('lk_for', 'underground'), o('ak_tell', 'subway')] },
    repair: { q: 'bus_fast', sit: '아주 빠르게 말해서 버스 번호가 잘 안 들렸어요.', card: {}, a: 1, opts: [Lr([{ k: 'bus', num: 50 }]), o('rp_bus'), o('rp_lr'), o('th_bye')] },
  };
  Object.values(DR.MINI).forEach(it => { it.Q = DR.Q[it.q]; it.place = it.Q.place; });

  /* =========================================================
     영상 대화
     ========================================================= */
  DR.INTRO = { lit: o('gr_none', null, o('ak_bare', 'trainstation')), ok: o('gr_ex', null, o('ak_how', 'trainstation')), card: { place: 'trainstation' } };
  DR.SCENE = {
    greet: [o('gr_ex'), o('gr_sorry'), o('gr_hey')],
    asks: [o('ak_how', 'trainstation'), o('ak_near', 'pharmacy'), o('ak_nearest', 'supermarket')],
    teach: [o('ak_teach', 'trainstation'), o('ak_how', 'trainstation')],
    words: [['마트', 'supermarket', 'mart'], ['편의점', 'convenience', 'conv'], ['지하철역', 'subway', 'underground'], ['화장실', 'restroom', 'toilet'], ['주유소', 'gasstation', 'petrol']],
  };
  // 10장 실전: 길 카드 하나로 넷
  DR.PSTART = { key: 'H2:2', t: 0.5, h: 'W' };
  DR.PROUTE = DR.route(DR.PSTART, 'subway');
  DR.PCARD = { place: 'subway', mode: 'walk', route: DR.PROUTE, style: 'nth', start: DR.PSTART };
  DR.buildPractice = function () {
    const R = DR.PROUTE, c = DR.modelLine(R, 'nth'), t = c.find(x => x.k === 'turn');
    return [
      { q: 'gr_cue', opts: [o('gr_none', null, o('ak_rude', 'subway')), o('gr_ex', null, o('ak_how', 'subway')), o('gr_ex', null, o('ak_how', 'trainstation'))], a: 1,
        lines: ['지나가는 사람 → 내가 먼저 · 셋 모두 가려는 곳을 물어요', '(C) train station → 카드는 지하철역이라 탈락', '(A) Subway station where? → 퉁명스러워 탈락 · 정답 (B)'] },
      { q: 'th_local', opts: [o('th_bye'), o('ak_how', 'subway'), o('th_anyway')], a: 2,
        lines: ['not from around here → 이 사람은 몰라요 · (B) 다시 묻기 → 탈락', '② 남은 둘에 틀린 정보는 없어요', '(A) Okay. Bye. → 무뚝뚝해서 탈락 · 정답 (C)'] },
      { q: 'dir', opts: [o('th_welcome'), Lr([{ k: 'twice', dir: t.dir }].concat(c.filter(x => x.k !== 'turn'))), Lr(c)], a: 2,
        lines: [`${ordW(t.nth)} ${t.dir} · on your ${R.arrive.side} → 길 안내 · (A) You're welcome → 탈락`, `(B) turn ${t.dir} twice → 두 번 돌면 다른 곳이라 탈락`, '조각이 모두 맞아요 · 정답 (C)'] },
      { q: 'cb_ok', opts: [o('th_welcome'), o('th_bye'), o('th_ty')], a: 2,
        lines: ['That\'s right → 맞다는 안내 · (A) You\'re welcome → 고맙다는 말의 대답이라 탈락', '② 남은 둘에 틀린 정보는 없어요', '(B) Okay. Bye. → 무뚝뚝해서 탈락 · 정답 (C)'] },
    ];
  };
  DR.PRACTICE = DR.buildPractice();
  DR.practiceQ = p => p.q === 'dir' ? DR.dirQ(DR.PROUTE, 'nth', { sp: 'ca' }) : DR.Q[p.q];

  // 09장: 단계마다 한 줄 (3단계 적용)
  DR.METHOD = [
    ['gr_cue', o('gr_ex', null, o('ak_how', 'trainstation')), { place: 'trainstation' }],
    ['ak_yes', o('ak_near', 'pharmacy'), { place: 'pharmacy' }],
    ['dir', Lr([DR.chunks(DR.DEMO, 'nth')[0]]), DR.DEMO_CARD, 'nth'],
    ['dir', Lr([{ k: 'side', dir: DR.DEMO.arrive.side }, { k: 'rel', rel: 'across', of: 'park' }]), DR.DEMO_CARD, 'blocks'],
    ['fr_far', o('fr_which2'), { place: 'market', mode: 'bus' }],
    ['dir', Lr(DR.modelLine(DR.DEMO, 'blocks')), DR.DEMO_CARD, 'blocks'],
    ['th_local', o('th_anyway'), {}],
  ];
  // 01장: 단계마다 한 줄 설명과 대표 말 (who: me 나 · you 상대)
  DR.STAGE_DESC = { greet: '공손하게 말 걸기', ask: '묻는 틀 + 곳 이름', move: '동작 낱말 듣기', mark: '어디서 · 어느 쪽', far: '몇 분 · 몇 번 버스', check: '들은 조각 되짚기', thanks: '고맙다고 끝내기' };
  DR.STAGE_LINES = {
    greet: [['me', 'Excuse me.'], ['me', 'Sorry to bother you.'], ['you', 'Hi there. Can I help you?']],
    ask: [['me', 'Could you tell me how to get to the train station?'], ['me', 'Is there a pharmacy near here?'], ['you', 'The train station or the subway station?']],
    move: [['you', 'Go straight for two blocks.'], ['you', 'Take the second left.'], ['you', 'Keep going until you get to the bank.']],
    mark: [['you', 'Turn left at the bank.'], ['you', 'It\'s on your right, across from the park.'], ['you', 'It\'s next to the bank.']],
    far: [['you', 'It\'s about a five-minute walk.'], ['me', 'Which bus should I take?'], ['you', 'Take the number 15 bus. Get off at the third stop.']],
    check: [['me', 'So, I take the second left?'], ['me', 'So, I go straight for two blocks, turn left at the bank, and it\'s on my right?'], ['you', 'That\'s right!']],
    thanks: [['me', 'Great, thank you so much!'], ['you', 'Sorry, I\'m not from around here.'], ['me', 'That\'s okay. Thanks anyway.']],
  };
  // 08장: 조각마다 따로 되짚기 (나 · 상대)
  DR.PIECES = [['Straight for two blocks?', 'Yes.'], ['Then left at the bank?', 'Yes, left at the bank.'], ['And it\'s on my right?', 'That\'s right.']];
  // 헷갈리는 숫자 짝 (05장): 앞이 세면 -ty, 뒤가 세면 -teen
  DR.PAIRS = [['15', 'fifTEEN', '50', 'FIFty'], ['13', 'thirTEEN', '30', 'THIRty'], ['14', 'fourTEEN', '40', 'FORty']];

  /* =========================================================
     따라 말하기 28문장 (단계마다 상대 · 나의 말 넷)
     ========================================================= */
  const SH = (place, who, en, ko, sp) => ({ place, who, en, ko, sp: who === 'me' ? 'me' : sp || DR.PLACE[place].sp });
  DR.SHADOW = [
    SH('greet', 'me', 'Excuse me.', '실례합니다.'),
    SH('greet', 'me', 'Sorry to bother you.', '귀찮게 해서 죄송한데요.'),
    SH('greet', 'staff', 'Hi there. Can I help you?', '안녕하세요. 도와드릴까요?', 'ca'),
    SH('greet', 'me', 'Yes, please. I\'m looking for the train station.', '네, 부탁해요. 기차역을 찾고 있어요.'),
    SH('ask', 'me', 'Could you tell me how to get to the museum?', '박물관에 어떻게 가는지 알려 주시겠어요?'),
    SH('ask', 'me', 'Is there a pharmacy near here?', '이 근처에 약국이 있나요?'),
    SH('ask', 'me', 'Where\'s the nearest supermarket?', '가장 가까운 마트가 어디예요?'),
    SH('ask', 'staff', 'The train station or the subway station?', '기차역이요, 지하철역이요?'),
    SH('move', 'staff', 'Go straight for two blocks.', '두 블록 쭉 가세요.'),
    SH('move', 'staff', 'Take the second left.', '두 번째 왼쪽 길로 도세요.', 'ca'),
    SH('move', 'staff', 'Cross the street at the lights.', '신호등에서 길을 건너세요.'),
    SH('move', 'staff', 'Keep going until you get to the bank.', '은행이 나올 때까지 쭉 가세요.', 'gb'),
    SH('mark', 'staff', 'Turn left at the bank.', '은행에서 왼쪽으로 도세요.'),
    SH('mark', 'staff', 'It\'s on your right.', '오른쪽에 있어요.'),
    SH('mark', 'staff', 'It\'s across from the park.', '공원 맞은편에 있어요.', 'ca'),
    SH('mark', 'staff', 'It\'s next to the bank.', '은행 바로 옆에 있어요.'),
    SH('far', 'staff', 'It\'s about a five-minute walk.', '걸어서 5분쯤이에요.'),
    SH('far', 'me', 'Which bus should I take?', '어떤 버스를 타야 해요?'),
    SH('far', 'staff', 'Take the number 15 bus.', '15번 버스를 타세요.', 'au'),
    SH('far', 'staff', 'Get off at the third stop.', '세 번째 정류장에서 내리세요.', 'au'),
    SH('check', 'me', 'So, I go straight for two blocks, turn left at the bank, and it\'s on my right?', '그러니까 두 블록 쭉 가서 은행에서 왼쪽으로 돌면, 오른쪽에 있는 거죠?'),
    SH('check', 'me', 'So, I take the second left?', '그러니까 두 번째 왼쪽 길로 도는 거죠?'),
    SH('check', 'me', 'Sorry, left or right?', '죄송한데, 왼쪽이에요, 오른쪽이에요?'),
    SH('check', 'me', 'Sorry, could you say that again more slowly, please?', '죄송한데, 조금 더 천천히 다시 말씀해 주시겠어요?'),
    SH('thanks', 'staff', 'That\'s right. You can\'t miss it.', '맞아요. 바로 보일 거예요.'),
    SH('thanks', 'me', 'Great, thank you so much!', '좋아요, 정말 고마워요!'),
    SH('thanks', 'staff', 'Sorry, I\'m not from around here.', '죄송해요, 저도 이 동네 사람이 아니에요.', 'au'),
    SH('thanks', 'me', 'That\'s okay. Thanks anyway.', '괜찮아요. 아무튼 고마워요.'),
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: key 열쇠 낱말 · frame 대답 틀 · slot 내 정보 · pol 공손한 말 · trap 함정 · ok 정답
     ========================================================= */
  const LL = k => `(${L4[k]})`;
  DR.judgeItem = (it, k) => DR.judge(it.Q, it.opts[k], it.card, '상황');
  const cardSay = c => { const out = []; if (c.place) out.push(`가려는 곳 ${DR.factKo('place', c.place)}`); if (c.mode === 'bus') out.push('버스'); if (c.route && c.route.mode === 'walk') out.push(`들은 길 → ${DR.modelLine(c.route, c.style).map(DR.chunkKo).join(' → ')}`); if (c.route && c.route.mode === 'bus') out.push(`들은 길 → ${DR.chunks(c.route, c.style).map(DR.chunkKo).join(' → ')}`); return out.join(' · '); };
  const segMarks = (a, k, roleOf) => DR.segs(a).filter(s => s.t.trim() && /[A-Za-z0-9]/.test(s.t)).map(s => ({ t: s.t.trim().replace(/^[,.?!]+|[,.?!]+$/g, ''), role: roleOf(s), at: k })).filter(m => m.t);
  const tagKo = j => j.tag === 'fact' ? '상황과 다른 정보' : j.tag === 'need' ? '되짚지 않음' : j.tag === 'check' ? '되짚은 조각이 들은 길과 다름' : '한국어 그대로 옮긴 말 · 콩글리시';
  DR.steps = function (it) {
    const q = it.Q, J = it.opts.map((_, k) => DR.judgeItem(it, k)), at = s => it.opts.map((_, k) => k).filter(k => J[k].stage === s);
    const best = it.opts[it.a];
    // ①
    let t1;
    if (q.fast) t1 = '너무 빨라서 열쇠 낱말을 다 못 잡았어요. 짐작해서 되짚지 말고 다시 물어요. 들린 낱말이 있으면 그 부분만 되물어요.';
    else if (q.cue) t1 = '지나가는 사람에게 내가 먼저 말을 걸어요. 열쇠 낱말 → 가려는 곳 이름.';
    else t1 = `열쇠 낱말 ${q.key.join(' … ')} → ${DR.SHAPE[q.shape].ko}(${DR.SHAPE[q.shape].mark}). ${DR.sayOf(q.intent)}. ${DR.INTENT[q.intent].want}`;
    if (at(1).length) t1 += ' ' + at(1).map(k => LL(k)).join(' · ') + (q.fast ? ' → 짐작한 대답이거나 다른 말을 되물어 탈락.' : J[at(1)[0]].tag === 'shape' ? ' → 모양이 맞지 않아 탈락.' : ' → 지금 차례에 맞지 않는 말이라 탈락.');
    const m1 = q.fast || q.cue ? [] : q.key.map(t => ({ t, role: 'key', at: 'q' }));
    at(1).forEach(k => m1.push({ t: DR.text(it.opts[k]).replace(/[.?!]$/, ''), role: 'trap', at: k }));
    // ②
    const sit = cardSay(it.card);
    const Fb = DR.FRAME[best.f], ft = Fb.line ? 'So, ___?' : Fb.t && !best.req ? Fb.t.replace(/[{}]/g, '').replace('___', '…') : DR.text(best);
    let t2 = (q.fast ? '상황 → 처음 듣고 다 알아듣지 못했어요. ' : sit ? `상황 → ${sit}. ` : '') + `맞는 틀 → ${ft}`;
    if (at(2).length) t2 += ' · ' + at(2).map(k => `${LL(k)} ${tagKo(J[k])}`).join(' · ') + ' → 탈락.';
    else t2 += ' · 틀과 정보가 모두 맞는 보기만 남았어요.';
    const m2 = [];
    it.opts.forEach((a, k) => {
      if (J[k].stage === 1) return;
      const bad2 = J[k].stage === 2, F = DR.FRAME[a.f];
      if (F.line) {
        const segs = DR.segs(a), err = J[k].cb && J[k].cb.err;
        segs.forEach(s => { if (!s.t.trim() || !/[A-Za-z]/.test(s.t)) return; const wrongPiece = bad2 && s.chunk && err && (err.said ? s.t.includes(err.said) || s.chunk.some(c => DR.chunkText(c) === err.said) : false); m2.push({ t: s.t.trim().replace(/[,.?!]+$/, ''), role: s.r === 'pol' ? '' : wrongPiece ? 'trap' : s.r, at: k }); });
        return;
      }
      const sb = [a.v, a.req && a.req.v].some(v => v && DR.sv('place', v) && DR.sv('place', v).bad);
      segMarks(a, k, s => s.r === 'pol' ? '' : bad2 && (J[k].tag === 'fact' || sb) && s.r === 'slot' ? 'trap' : bad2 && J[k].tag === 'literal' && !sb && s.r === 'frame' ? 'trap' : s.r).forEach(m => { if (m.role) m2.push(m); });
    });
    // ③
    let t3 = at(3).length ? at(3).map(k => `${LL(k)} ${DR.text(it.opts[k])} → ${J[k].tag === 'plain' ? '무뚝뚝하게 끊김' : '명령 · 퉁명스러운 말'}`).join(' · ') + ' → 탈락. ' : '무례하게 들리는 보기는 없어요. ';
    t3 += `정답 ${LL(it.a)} → ${J[it.a].why}`;
    const m3 = [];
    it.opts.forEach((a, k) => { if (J[k].stage === 3) segMarks(a, k, () => 'trap').forEach(m => m3.push(m)); else if (J[k].stage === 0) segMarks(a, k, s => s.r === 'pol' ? 'pol' : '').forEach(m => { if (m.role) m3.push(m); }); });
    m3.push({ t: DR.text(it.opts[it.a]), role: 'ok', at: it.a, whole: true });
    return [
      { head: '① 열쇠 낱말 잡기', text: t1, marks: m1 },
      { head: '② 틀에 내 정보 넣기', text: t2, marks: m2 },
      { head: '③ 공손하게 끝내기', text: t3, marks: m3 },
    ];
  };
  DR.notes = it => it.opts.map((_, k) => { const j = DR.judgeItem(it, k); return (j.ok ? '' : `× ${['', '①', '②', '③'][j.stage]} `) + j.why; });

  /* =========================================================
     길 검산 — 지도에서 걸어 보며 방향 · 도착 쪽을 따로 계산 (DR.route와 다른 방법: 벡터의 외적)
     ========================================================= */
  const crossZ = (a, b) => a[0] * b[1] - a[1] * b[0];   // 화면 좌표(아래가 +y): 왼쪽으로 돌면 음수
  DR.verifyRoute = function (R) {
    const errs = [];
    if (!R || R.mode !== 'walk') return errs;
    const P = R.path;
    // 돌기: 들어온 방향과 나가는 방향의 외적
    R.legs.forEach((L, i) => {
      const a = P[i], b = P[i + 1], c = P[i + 2];
      const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]], z = crossZ(v1, v2);
      const dir = z < 0 ? 'left' : z > 0 ? 'right' : 'straight';
      if (dir !== L.dir) errs.push(`돌기 ${i + 1}: 엔진 ${L.dir} · 검산 ${dir}`);
      if (Math.abs(b[0] - L.I[0]) > 1e-9 || Math.abs(b[1] - L.I[1]) > 1e-9) errs.push(`돌기 ${i + 1}: 교차점이 길과 달라요`);
      const sx = Math.sign(v1[0]), sy = Math.sign(v1[1]), hv = DR.DIRV[L.h];
      if (sx !== hv[0] || sy !== hv[1]) errs.push(`돌기 ${i + 1}: 들어온 방향 ${L.h}가 길과 달라요`);
    });
    // 도착 쪽: 마지막 걷는 방향과 건물 가운데의 외적
    const a = P[P.length - 2], b = P[P.length - 1], v = [b[0] - a[0], b[1] - a[1]], lp = DR.lotPoint(R.dest), w = [lp[0] - b[0], lp[1] - b[1]], z = crossZ(v, w);
    const side = z < 0 ? 'left' : 'right';
    if (side !== R.arrive.side) errs.push(`도착 쪽: 엔진 ${R.arrive.side} · 검산 ${side}`);
    // 길은 지도 안의 길 위로만 (가로 · 세로)
    P.slice(1).forEach((p, i) => { const q = P[i]; if (Math.abs(p[0] - q[0]) > 1e-9 && Math.abs(p[1] - q[1]) > 1e-9) errs.push('대각선으로 걸어요'); if (p[0] < -1e-9 || p[1] < -1e-9 || p[0] > T.C - 1 + 1e-9 || p[1] > T.R - 1 + 1e-9) errs.push('지도 밖으로 나가요'); });
    // 첫 구간은 바라보는 쪽으로
    const v0 = [P[1][0] - P[0][0], P[1][1] - P[0][1]], h0 = DR.DIRV[R.start.h];
    if (Math.sign(v0[0]) !== h0[0] || Math.sign(v0[1]) !== h0[1]) errs.push('첫 걸음이 바라보는 쪽이 아니에요');
    // 몇 번째 길 · 몇 번째 교차점: 출발부터 다시 걸으며 그쪽으로 난 길을 세어 봐요
    let I = segEnd(segOf(R.start.key), R.start.h);
    R.legs.forEach((L, i) => {
      let cnt = 0, k = 0;
      for (let g = 0; g < 8; g++) {
        k++;
        const h2 = L.dir === 'left' ? LEFT[L.h] : RIGHT[L.h];
        if (segFrom(I[0], I[1], h2)) cnt++;
        if (I[0] === L.I[0] && I[1] === L.I[1]) break;
        const s2 = segFrom(I[0], I[1], L.h); if (!s2) { errs.push(`돌기 ${i + 1}: 교차점에 닿지 못해요`); break; } I = segEnd(s2, L.h);
      }
      if (cnt !== L.nth) errs.push(`돌기 ${i + 1}: ${L.dir} 길 세기 엔진 ${L.nth} · 검산 ${cnt}`);
      if (k !== L.n) errs.push(`돌기 ${i + 1}: 교차점 세기 엔진 ${L.n} · 검산 ${k}`);
      const s3 = segFrom(L.I[0], L.I[1], L.h2); if (!s3) { errs.push(`돌기 ${i + 1}: 돈 쪽에 길이 없어요`); return; }
      I = segEnd(s3, L.h2);
    });
    return errs;
  };

  /* =========================================================
     데이터 점검 — 열쇠 낱말이 말에 없거나, 모양이 글과 다르거나, 맞는 보기가 하나가 아니거나, 정답 위치가 몰리면 경고
     ========================================================= */
  DR.check = function () {
    const bad = [];
    const hasT = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase());
    Object.values(DR.Q).forEach(q => {
      if (!DR.PLACE[q.place]) bad.push(`말 ${q.id}: 단계 ${q.place}가 없어요`);
      q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`말 ${q.id}: 열쇠 낱말 ‘${k}’가 말에 없어요`); });
      if (!q.cue && DR.shapeGuess(q.en) !== q.shape) bad.push(`말 ${q.id}: 적어 둔 모양 ${q.shape} · 글의 모양 ${DR.shapeGuess(q.en)}`);
    });
    Object.values(DR.FRAME).forEach(F => {
      if (F.slot && !DR.SLOT[F.slot]) bad.push(`틀 ${F.id}: 칸 ${F.slot}이 없어요`);
      if (F.slot && !/___/.test(F.t)) bad.push(`틀 ${F.id}: 칸이 있는데 ___가 없어요`);
      if (F.tag !== 'ok' && !F.why) bad.push(`틀 ${F.id}: 함정 틀에 까닭(why)이 없어요`);
    });
    // 숫자 읽기 · 맞추기
    [['fifteen', '15'], ['fifty', '50'], ['one five', '15'], ['third', '3rd'], ['3rd', '3rd'], ['twenty-five', '25']].forEach(([s, r]) => { if (!DR.canon(s).includes(r)) bad.push(`숫자 맞추기 ${s}: ${DR.canon(s).join(' ')}`); });
    if (DR.spoken('Take the number 15 bus.') !== 'Take the number fifteen bus.') bad.push(`읽을 글: ${DR.spoken('Take the number 15 bus.')}`);
    // 길: 모든 출발 × 모든 곳 — 엔진의 방향 · 도착 쪽을 검산과 맞춰 보고, 길 안내를 다시 읽어 되짚으면 통과하는지
    let nR = 0;
    DR.STARTS.forEach(st => DR.DESTS.forEach(d => {
      const R = DR.route(st, d); if (!R) return; nR++;
      DR.verifyRoute(R).forEach(e => bad.push(`길 ${st.key}/${st.h} → ${d}: ${e}`));
      DR.STYLES.forEach(sty => {
        const en = DR.say(R, sty), line = DR.modelLine(R, sty);
        const cb = DR.checkBack(R, line); if (!cb.ok || !cb.full) bad.push(`되짚기 ${st.key}/${st.h} → ${d} (${sty}): ${DR.lineText(line)} · ${cb.why}`);
        const back = DR.parseCheck(en.replace(/\byour\b/g, 'my')), cb2 = DR.checkBack(R, back.filter(c => c.k !== 'rel' || true));
        if (!cb2.ok || !cb2.full) bad.push(`길 안내를 다시 읽기 ${st.key}/${st.h} → ${d} (${sty}): ${en} · ${cb2.why}`);
        const ms = DR.matchSpoken(DR.spoken(DR.lineText(line)), DR.dirQ(R, sty), { route: R });
        if (!ms.ok) bad.push(`말로 되짚기 ${st.key}/${st.h} → ${d} (${sty}): ${DR.lineText(line)} · ${ms.why}`);
        DR.sayKeys(R, sty).forEach(k => { if (!en.includes(k)) bad.push(`열쇠 낱말 ${k} 없음: ${en}`); });
      });
    }));
    if (nR < 120) bad.push(`계산된 길이 적어요: ${nR}`);
    // 관계는 대칭
    Object.keys(DR.SPOT).forEach(a => Object.keys(DR.SPOT).forEach(b => { const x = DR.where(a, b), y = DR.where(b, a); if ((x === 'across' || x === 'next') && x !== y) bad.push(`관계 ${a}–${b}: ${x} · ${y}`); }));
    // 연습 문제
    const pos = [0, 0, 0, 0];
    DR.DRILL.forEach((it, i) => {
      const w = `듣고 대답 고르기 ${i + 1}`;
      const good = it.opts.map((_, k) => k).filter(k => DR.judgeItem(it, k).ok);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 보기 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]} — ${it.opts.map(a => DR.text(a) + ' / ' + DR.judgeItem(it, it.opts.indexOf(a)).why).join(' || ')}`);
      const texts = it.opts.map(DR.text);
      if (new Set(texts).size !== texts.length) bad.push(`${w}: 같은 보기가 있어요 ${texts.join(' | ')}`);
      pos[it.a]++;
    });
    if (Math.max(...pos) - Math.min(...pos) > 0) bad.push(`듣고 대답 고르기 정답 위치가 몰려 있어요: ${pos.join(',')}`);
    const places = new Set(DR.DRILL.map(it => it.place));
    DR.PLACES.forEach(p => { if (!places.has(p.id)) bad.push(`듣고 대답 고르기: ${p.ko} 문제가 없어요`); });
    if (DR.DRILL.filter(it => it.Q.fast).length < 1) bad.push('듣고 대답 고르기: 빠른 말 문제가 없어요');
    Object.entries(DR.MINI).forEach(([k, it]) => { const good = it.opts.map((_, i) => i).filter(i => DR.judgeItem(it, i).ok); if (good.length !== 1 || good[0] !== it.a) bad.push(`직접 해 보기 ${k}: 맞는 보기 ${good}`); });
    // 영상 대화
    const want = (w, q, a, c, ok) => { const j = DR.judge(q, a, c); if (j.ok !== ok) bad.push(`${w}: ${DR.text(a)} → 판정 ${j.ok ? '✓' : '×'} (${j.why})`); return j; };
    want('00장 Where is station', 'gr_cue', DR.INTRO.lit, DR.INTRO.card, false); want('00장 Excuse me', 'gr_cue', DR.INTRO.ok, DR.INTRO.card, true);
    const D = DR.DEMO;
    if (!D || D.legs.length !== 1 || D.legs[0].n !== 2 || D.legs[0].dir !== 'left' || D.legs[0].lm !== 'bank' || D.arrive.side !== 'right' || !D.rel || D.rel.rel !== 'across' || D.rel.of !== 'park') bad.push(`데모 길: ${DR.say(D)}`);
    if (DR.say(D, 'blocks', { open: '' , dist: false }) !== 'Go straight for two blocks and turn left at the bank. It\'s on your right, across from the park.') bad.push(`데모 길 글: ${DR.say(D, 'blocks', { open: '', dist: false })}`);
    if (DR.lineText(DR.modelLine(D, 'blocks')) !== 'So, I go straight for two blocks, turn left at the bank, and it\'s on my right?') bad.push(`데모 되짚기: ${DR.lineText(DR.modelLine(D, 'blocks'))}`);
    if (DR.chunks(D, 'nth')[0].nth !== 2) bad.push('데모 두 번째 왼쪽 길');
    if (DR.BUS_DEMO.where !== 'across' || DR.BUS_DEMO.line !== 15 || DR.BUS_DEMO.nth !== 3) bad.push('버스 데모');
    DR.SCENE.greet.forEach((a, i) => want(`02장 말 걸기 ${i + 1}`, 'gr_cue', Object.assign({}, a, { req: o('ak_how', 'trainstation') }), { place: 'trainstation' }, i < 2));
    DR.SCENE.asks.forEach((a, i) => want(`02장 묻기 ${i + 1}`, 'ak_yes', a, {}, true));
    want('02장 teach', 'ak_yes', DR.SCENE.teach[0], {}, true);
    DR.SCENE.words.forEach(([ko, okv, badv]) => { want(`02장 ${ko}`, 'ak_yes', o('ak_near', okv), {}, true); want(`02장 ${ko} 함정`, 'ak_yes', o('ak_near', badv), {}, !DR.SLOT.place.vals[badv].bad); });
    DR.METHOD.forEach(([qid, a, c, sty], i) => want(`09장 ${i + 1}`, qid === 'dir' ? DR.dirQ(c.route, sty) : qid, a, c, true));
    // 실전
    DR.PRACTICE.forEach((p, i) => {
      const w = `실전 ${i + 1}`, q = DR.practiceQ(p);
      const J = p.opts.map(a => DR.judge(q, a, DR.PCARD));
      const good = J.map((j, k) => j.ok ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== p.a) bad.push(`${w}: 맞는 보기 ${good} — ${J.map(j => j.why).join(' || ')}`);
      [1, 2, 3].forEach(st => {
        const gone = J.map((j, k) => j.stage === st ? LL(k) : null).filter(Boolean).sort().join();
        const said = (p.lines[st - 1].match(/\([A-D]\)/g) || []).filter(x => st < 3 || x !== LL(p.a)).sort().join();
        if (gone !== said) bad.push(`${w} ${st}단계: 엔진 ${gone || '-'} · 화면 ${said || '-'}`);
      });
    });
    // 시뮬레이터: 카드 여럿 — 모범 대답은 통과, 틀 칩 가운데 맞는 것이 하나뿐인지, 모범 대답을 말로 해도 통과하는지, 조각 칩의 함정은 정말 틀리는지
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 60; n++) {
      const c = DR.newCard(rnd);
      if (!c.route) { bad.push(`시뮬레이터 카드 ${n}: 길이 없어요`); continue; }
      DR.simSteps(c).forEach(step => {
        if (step === 'map') return;
        const q = DR.simQ(step, c), C = Object.assign({}, c, q.fact || {}), m = DR.model(q, C), j = DR.judge(q, m, C);
        if (!j.ok) bad.push(`시뮬레이터 ${step}: 모범 대답이 탈락 (${DR.text(m)} · ${j.why})`);
        const ms = DR.matchSpoken(DR.spoken(DR.text(m)), q, C);
        if (!ms.ok) bad.push(`시뮬레이터 ${step}: 모범 대답을 말로 해도 통과하지 못해요 (${DR.text(m)} · ${ms.why})`);
        if (!q.cue) q.key.forEach(k => { if (!hasT(k, q.en)) bad.push(`시뮬레이터 ${step}: 열쇠 낱말 ‘${k}’가 말에 없어요 (${q.en})`); });
        const fr = DR.simFrames(step, C);
        if (fr) {
          const greets = step === 'open' || step === 'open1' ? DR.GREETS : [null];
          const okN = fr.filter(f => greets.some(g => { const F = DR.FRAME[f]; const mk = v => g ? { f: g, req: Object.assign({ f }, v != null ? { v } : {}) } : Object.assign({ f }, v != null ? { v } : {}); return F.slot ? DR.placeChoices(C, rnd).some(v => DR.judge(q, mk(v), C).ok) : DR.judge(q, mk(), C).ok; })).length;
          if (okN !== 1) bad.push(`시뮬레이터 ${step}: 맞는 틀이 ${okN}개예요 (${fr.join(',')})`);
        }
        if (step === 'dir') {
          const ml = DR.modelLine(c.route, c.style);
          DR.chunkChips(c, rnd).forEach(x => {
            const inModel = x.forIdx == null;
            // 맞는 조각은 혼자 되짚어도 통과, 함정은 모범 줄의 그 자리에 넣으면 탈락
            const cb = inModel ? DR.checkBack(c.route, [x]) : DR.checkBack(c.route, ml.map((y, i) => i === x.forIdx ? x : y));
            if (inModel && !cb.ok) bad.push(`시뮬레이터 조각 칩 ${DR.chunkText(x)}: 맞는 조각인데 탈락 (${cb.why})`);
            if (!inModel && cb.ok) bad.push(`시뮬레이터 조각 칩 ${DR.chunkText(x)}: 함정인데 통과 (${DR.say(c.route, c.style)})`);
          });
        }
      });
    }
    // 말로 대답하기: 다른 곳 · 콩글리시 · Yes만 · 다른 길 · 15와 50 · turn left와 on your left는 통과하지 않아야
    const nope = (w, raw, q, c) => { const r = DR.matchSpoken(raw, q, c); if (r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과해요`); return r; }, yep = (w, raw, q, c) => { const r = DR.matchSpoken(raw, q, c); if (!r.ok) bad.push(`말로 대답하기 ${w}: ‘${raw}’가 통과하지 않아요 (${r.why})`); return r; };
    const DC = DR.DEMO_CARD, dQ = DR.dirQ(DR.DEMO, 'blocks');
    yep('여는 말', 'Excuse me, could you tell me how to get to the train station?', 'gr_cue', DC);
    nope('다른 곳', 'Excuse me, how do I get to the museum?', 'gr_cue', DC);
    nope('mart', 'Is there a mart near here?', 'ak_yes', { place: 'supermarket' });
    nope('a convenience', 'Is there a convenience near here?', 'ak_yes', { place: 'convenience' });
    yep('underground', 'I am looking for the underground station', 'ak_uk', { place: 'subway' });
    nope('yes만 (고르기)', 'yes please', 'ak_which', { place: 'subway' });
    yep('한 줄 되짚기', 'So I go straight for two blocks, turn left at the bank, and it is on my right?', dQ, DC);
    yep('숫자로', 'so I go straight for 2 blocks turn left at the bank and it is on my right', dQ, DC);
    nope('방향', 'So I go straight for two blocks, turn right at the bank, and it is on my right?', dQ, DC);
    nope('기준점', 'So I go straight for two blocks, turn left at the post office, and it is on my right?', dQ, DC);
    nope('도착 쪽', 'So I turn left at the bank and it is on my left?', dQ, DC);
    nope('turn과 on', 'So I turn left at the bank and turn right?', dQ, DC);
    nope('두 번 돌기', 'So I turn left twice?', DR.dirQ(DR.DEMO, 'nth'), DC);
    yep('두 번째 왼쪽', 'So I take the second left?', DR.dirQ(DR.DEMO, 'nth'), DC);
    nope('블록 수', 'So I go straight for three blocks and turn left at the bank?', dQ, DC);
    nope('빠진 조각', 'So I go straight for two blocks and it is on my right?', dQ, DC);
    nope('다른 곳의 길', 'So I turn right at the hotel and it is on my left?', dQ, DC);
    nope('yes만', 'yes', dQ, DC);
    yep('부분 되짚기', 'Left at the bank?', dQ, DC);
    const bQ = DR.dirQ(DR.BUS_DEMO, 'stop');
    yep('버스 숫자', 'So I take the number 15 bus from across the street and get off at the third stop?', bQ, DR.BUS_CARD);
    yep('버스 낱말', 'so I take the number fifteen bus from across the street and get off at the third stop', bQ, DR.BUS_CARD);
    yep('버스 한 자리씩', 'so the number one five bus from across the street and I get off at the 3rd stop', bQ, DR.BUS_CARD);
    nope('fifty', 'So I take the number fifty bus from across the street and get off at the third stop?', bQ, DR.BUS_CARD);
    nope('정류장 수', 'So I take the number fifteen bus and get off at the first stop?', bQ, DR.BUS_CARD);
    nope('thank you만', 'Thank you!', dQ, DC);
    nope('local 다시 묻기', 'Could you tell me how to get to the hospital?', 'th_local', { place: 'hospital' });
    yep('thanks anyway', 'That\'s okay, thanks anyway.', 'th_local', {});
    nope('you are welcome', 'You\'re welcome.', 'cb_ok', {});
    // 08장의 조각마다 되짚기는 하나씩 통과하고 모두 모으면 길 전체
    { let cov = []; DR.PIECES.forEach(([me], i) => { const r = DR.matchSpoken(me, dQ, Object.assign({}, DC, { covered: cov })); if (!r.ok) bad.push(`08장 조각 ${i + 1}: ${me} · ${r.why}`); else cov = r.cb.covered; }); if (!DR.checkBack(D, [], { covered: cov }).ok && cov.length < 3) bad.push(`08장 조각을 모아도 길 전체가 아니에요: ${cov}`); }
    // 01장 단계의 대표 말 (내 말은 판정)
    want('01장 묻기', 'ak_yes', o('ak_how', 'trainstation'), {}, true); want('01장 되짚기', DR.dirQ(D, 'nth'), Lr([DR.chunks(D, 'nth')[0]]), DC, true);
    // 되짚기 판정의 종류
    const T1 = (w, line, type) => { const cb = DR.checkBack(DR.DEMO, line); if (cb.ok || !cb.err || cb.err.type !== type) bad.push(`되짚기 판정 ${w}: ${cb.ok ? '통과' : cb.err.type} (기대 ${type})`); };
    T1('방향', [{ k: 'turn', dir: 'right', lm: 'bank' }], 'dir');
    T1('기준점', [{ k: 'turn', dir: 'left', lm: 'postoffice' }], 'lm');
    T1('도착 쪽', [{ k: 'side', dir: 'left' }], 'side');
    T1('turn과 on', [{ k: 'turn', dir: 'left', lm: 'bank' }, { k: 'turn', dir: 'right' }], 'turnVsOn');
    T1('두 번', [{ k: 'twice', dir: 'left' }], 'twice');
    T1('블록', [{ k: 'go', n: 3 }], 'go');
    T1('빠짐', [{ k: 'go', n: 2 }, { k: 'side', dir: 'right' }], 'missing');
    // 따라 말하기: 같은 말은 모두 맞아야 · 숫자 낱말로 말해도 맞아야
    DR.SHADOW.forEach((s, i) => { const r = DR.compareWords(s.en, s.en), r2 = DR.compareWords(s.en, DR.spoken(s.en)); if (r.hit !== r.total || r2.hit !== r2.total) bad.push(`따라 말하기 ${i + 1}: 같은 글이 다 맞지 않아요`); });
    if (DR.SHADOW.length !== 28) bad.push(`따라 말하기 문장 수: ${DR.SHADOW.length}`);
    bad.forEach(b => console.warn('[길 묻기] ' + b));
    return bad;
  };

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  DR.allText = function () {
    const out = [];
    Object.values(DR.Q).forEach(q => out.push(q.en, q.ko, q.short || ''));
    Object.values(DR.FRAME).forEach(F => out.push(F.t, F.ko, F.why || '', F.note || ''));
    Object.values(DR.SLOT.place.vals).forEach(v => out.push(v.the, v.a, v.bare, v.ko, v.why || '', v.note || '', v.cap));
    Object.values(DR.SHAPE).forEach(a => out.push(a.ko, a.mark, a.ans, a.say)); Object.values(DR.INTENT).forEach(a => out.push(a.ans, a.want || '', a.say || '', a.turn || ''));
    DR.PLACES.forEach(p => out.push(p.ko, p.en)); Object.values(DR.SPOT).forEach(s => out.push(s.en, s.ko, s.en.toUpperCase()));
    T.V.concat(T.H).forEach(s => out.push(s, s.toUpperCase())); Object.values(DR.FAR).forEach(f => out.push(f.en, f.ko)); Object.values(DR.LINES).forEach(l => out.push(l.stops.join('')));
    DR.SHADOW.forEach(s => out.push(s.en, s.ko)); DR.PAIRS.forEach(p => out.push(p.join(''))); DR.PRACTICE.forEach(p => out.push(p.lines.join('')));
    out.push(DR.TOWN_NAME, 'BUS STOP 15 50 EXIT N 0123456789 ABCD', '동작 기준점 위치 교통');
    return out.join('');
  };
})();
