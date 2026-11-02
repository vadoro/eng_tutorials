/* 어휘 · 짝 표현 튜토리얼 — 규칙 엔진(짝 사전)과 예문
 *
 * 어휘 문제는 보기 네 개가 대개 품사도 모양도 같아서 문법으로는 가려지지 않아요. 답을 정하는 것은 빈칸의 '짝'이에요.
 * 이 파일의 규칙 엔진은 손으로 고른 '짝 사전'이에요. 영상의 ✓·×, 직접 해 보기, 놀이터(짝 카드 · 짝 사전 · 짝 판정기),
 * 연습 문제의 힌트와 보기별 해설, 퀴즈가 모두 judge()로 정답을 정하고, 데이터에 적은 정답과 judge()가 다르면 콘솔에 경고를 냅니다.
 *
 * 짝(콜로케이션)은 문법처럼 딱 잘라 맞고 틀리는 규칙이 아니라 '얼마나 자주, 자연스럽게 함께 쓰느냐'의 문제예요.
 * 그래서 엔진은 조심스럽게 판정해요.
 *   ✓  사전의 friends에 적힌 짝 (토익 비즈니스 영어에서 분명히 자연스러운 짝)
 *   ×  KEY[짝].no에 적은 낱말 (그 짝과 함께 쓰지 않는다고 하나하나 확인한 것), 또는 아래의 분명한 규칙에 걸린 것
 *        품사가 다름(pos) · 뜻의 무리가 다름(mean) · 뒤의 구조가 다름(pat: 목적어 · 사람 · that) · 빌리는 방향이 다름(dir)
 *   ?  사전에 없는 짝 — 판정하지 않음 (쓰일 수도 있어요)
 *
 * judge(낱말, 빈칸 틀) → { s: 'ok' | 'no' | '?', why, kind, step }
 *   빈칸 틀 fr = { key: 짝 열쇠, need: 빈칸의 품사, pat: 뒤의 구조, mean: 필요한 뜻, dir: 빌리는 방향 }
 *   step: 그 보기가 3단계 풀이의 몇 단계에서 지워지는지 (2 짝 맞추기 · 3 함정 확인)
 */
(function () {
  'use strict';
  const VC = (window.VC = {});

  const POS = { v: '동사', n: '명사', adj: '형용사', adv: '부사', prep: '전치사', det: '한정사' };
  VC.POS = POS;
  VC.TYPES = {
    59: { name: '동사 + 목적어', short: '동사의 짝', where: '빈칸 뒤의 목적어' },
    60: { name: '덩어리 표현', short: '덩어리', where: '빈칸 앞뒤의 덩어리' },
    61: { name: '모양이 비슷한 형용사', short: '닮은꼴 형용사', where: '꾸밈 받는 명사 · 뒤의 전치사' },
    62: { name: '부사의 짝', short: '부사', where: '숫자 · 형용사 · 동사' },
    63: { name: '헷갈리는 동사', short: '헷갈리는 동사', where: '뒤의 구조 (목적어 · 사람 · 방향)' },
  };
  // 뒤의 구조 (헷갈리는 동사를 가름)
  const PAT = {
    obj: { en: '___ + 목적어', ko: '뒤에 목적어가 있어요' },
    intr: { en: '주어 + ___ (목적어 없음)', ko: '뒤에 목적어가 없어요' },
    that: { en: '___ that …', ko: '뒤에 바로 that절이 와요' },
    thing: { en: '___ + 내용 · 물건', ko: '뒤에 내용 · 물건이 바로 와요' },
    'person+that': { en: '___ + 사람 + that …', ko: '뒤에 사람이 먼저 오고 that절이 와요' },
    'person+thing': { en: '___ + 사람 + 내용', ko: '뒤에 사람이 먼저 오고 내용이 와요' },
    language: { en: '___ + 언어', ko: '뒤에 언어가 와요' },
    'to+person': { en: '___ to + 사람', ko: '뒤에 to + 사람이 와요' },
    about: { en: '___ about + 주제', ko: '뒤에 about이 와요' },
    'person+to': { en: '___ + 사람 + to부정사', ko: '뒤에 사람이 먼저 오고 to + 동사가 와요' },
    'person+of': { en: '___ + 사람 + of …', ko: '뒤에 사람이 먼저 오고 of가 와요' },
    to: { en: '___ to + 동사', ko: '뒤에 바로 to + 동사가 와요' },
  };
  VC.PAT = PAT;
  const MEAN = { up: '오르다 · 올리다', happen: '생기다', place: '놓이다 · 놓다', say: '말하다', memory: '기억', loan: '빌리다', influence: '영향을 주다' };
  const DIR = { out: '주어가 남에게 빌려주는 쪽 (주어 → 남)', in: '주어가 남에게서 빌려 오는 쪽 (남 → 주어)' };
  VC.MEAN = MEAN; VC.DIR = DIR;

  /* ---------- 짝 사전 ----------
   * W(낱말, 품사, 유형, 뜻, friends: { 짝 열쇠: 그 짝의 우리말 }, 더: { look 닮은꼴, mean 뜻의 무리, pats 구조, dir 방향, rule 구조 설명 })
   * 짝 열쇠는 짝의 모양 그대로예요. ___ 자리에 낱말을 넣으면 짝 표현이 돼요. 괄호는 뜻을 가르는 이름표 (화면에는 안 보임).
   */
  const LEX = {};
  function W(w, pos, type, ko, friends, x) {
    LEX[w] = Object.assign({ w, pos, type, ko, friends: Object.assign({}, friends || {}) }, x || {});
    if (x && x.pats) Object.entries(x.pats).forEach(([p, g]) => { LEX[w].friends[PAT[p].en] = g; });
  }
  // 59 동사 + 목적어
  W('conduct', 'v', 59, '실시하다 · 하다', { '___ a survey': '설문 조사를 실시하다', '___ an inspection': '점검을 하다', '___ a study': '연구를 하다', '___ an interview': '면접을 보다' });
  W('implement', 'v', 59, '실행하다 · 시행하다', { '___ a plan': '계획을 실행하다', '___ a policy': '정책을 시행하다', '___ changes': '변화를 실행에 옮기다' });
  W('meet', 'v', 59, '맞추다 · 충족하다 (만나다)', { '___ a deadline': '마감을 지키다', '___ the demand': '수요를 맞추다', '___ requirements': '요건을 갖추다', '___ a goal': '목표를 달성하다', '___ expectations': '기대에 부응하다' });
  W('address', 'v', 59, '다루다 · 해결하다 (주소)', { '___ an issue': '문제를 다루다', '___ a problem': '문제를 해결하다', '___ concerns': '걱정을 덜어 주다' });
  W('submit', 'v', 59, '제출하다', { '___ a proposal': '제안서를 내다', '___ an application': '지원서를 내다', '___ a report': '보고서를 내다' });
  W('attend', 'v', 59, '참석하다', { '___ a meeting': '회의에 참석하다', '___ a conference': '학회에 참석하다', '___ a workshop': '워크숍에 참석하다' });
  W('reserve', 'v', 59, '예약하다', { '___ a room': '방을 예약하다', '___ a table': '식당 자리를 예약하다', '___ a seat': '좌석을 잡다' });
  W('earn', 'v', 59, '벌다 · 얻다', { '___ money': '돈을 벌다', '___ a reputation': '평판을 얻다', '___ a degree': '학위를 따다' });
  W('hold', 'v', 59, '열다 · 개최하다', { '___ a meeting': '회의를 열다', '___ a conference': '학회를 열다', '___ a sale': '할인 행사를 하다' });
  W('make', 'v', 59, '하다 · 만들다', { '___ a decision': '결정을 내리다', '___ a mistake': '실수를 하다', '___ a payment': '돈을 내다', '___ a reservation': '예약을 하다' });
  W('do', 'v', 59, '하다', { '___ business': '거래를 하다', '___ research': '조사를 하다' });
  W('give', 'v', 59, '주다 · 하다', { '___ a presentation': '발표를 하다', '___ a speech': '연설을 하다', '___ a discount': '할인해 주다' });
  W('reach', 'v', 59, '이르다 · 도달하다', { '___ an agreement': '합의에 이르다', '___ a decision': '결정을 내리다', '___ a goal': '목표에 이르다' });
  W('launch', 'v', 59, '출시하다 · 시작하다', { '___ a product': '제품을 출시하다', '___ a campaign': '캠페인을 시작하다' });
  W('renew', 'v', 59, '갱신하다', { '___ a subscription': '구독을 갱신하다', '___ a contract': '계약을 갱신하다', '___ a membership': '회원 자격을 갱신하다' });
  W('extend', 'v', 59, '연장하다 · 늘리다', { '___ a deadline': '마감을 늦추다', '___ a contract': '계약을 연장하다', '___ an invitation': '초대하다' });
  W('attract', 'v', 59, '끌어들이다', { '___ customers': '손님을 끌다', '___ visitors': '방문객을 끌다', '___ investors': '투자자를 끌다' });
  W('exceed', 'v', 59, '넘다 · 초과하다', { '___ expectations': '기대를 넘다', '___ the budget': '예산을 넘다', '___ the limit': '한도를 넘다' });
  W('obtain', 'v', 59, '얻다 · 받다', { '___ a permit': '허가증을 받다', '___ approval': '승인을 받다', '___ permission': '허락을 받다' });
  W('fill', 'v', 59, '채우다', { '___ a position': '빈자리에 사람을 뽑다', '___ out a form': '양식을 작성하다' });
  W('file', 'v', 59, '(정식으로) 내다', { '___ a complaint': '불만을 정식으로 제기하다', '___ a claim': '보상을 청구하다' });
  W('achieve', 'v', 59, '이루다 · 달성하다', { '___ a goal': '목표를 이루다', '___ success': '성공을 거두다' });
  W('issue', 'v', 59, '발급하다 · 내주다', { '___ a refund': '환불해 주다', '___ a permit': '허가증을 발급하다', '___ an invoice': '청구서를 발행하다' });
  W('inform', 'v', 59, '알리다 · 통지하다', { '___ the staff': '직원들에게 알리다', '___ customers of': '손님에게 ~을 알리다' });
  W('have', 'v', 60, '가지다 · 하다', { '___ a meeting': '회의를 하다', '___ an effect on': '~에 영향을 주다' });
  // 60 덩어리 표현
  W('place', 'v', 60, '놓다 · (주문을) 하다', { '___ an order': '주문을 하다', '___ an ad': '광고를 내다' });
  W('pay', 'v', 60, '내다 · 기울이다', { '___ attention to': '~에 주의를 기울이다', '___ a fee': '수수료를 내다', '___ the bill': '요금을 내다' });
  W('take', 'v', 60, '하다 · 취하다', { '___ effect': '효력이 생기다 (시행되다)', '___ place': '(행사가) 열리다', '___ action': '조치를 취하다', '___ a break': '잠깐 쉬다', '___ advantage of': '~을 이용하다' });
  W('notice', 'n', 60, '알림 · 통지', { 'until further ___': '추후 공지가 있을 때까지', 'on short ___': '급하게, 촉박하게' });
  W('note', 'n', 60, '메모 · 쪽지', { 'take ___ of': '~에 주목하다', 'a thank-you ___': '감사 쪽지' });
  W('attention', 'n', 60, '주의', { 'pay ___ to': '~에 주의를 기울이다' });
  W('caution', 'n', 60, '조심', { 'with ___': '조심해서', 'use ___': '조심하다' });
  W('stock', 'n', 60, '재고', { 'out of ___ (재고)': '재고가 없는', 'in ___': '재고가 있는' });
  W('order', 'n', 60, '주문 · 순서', { 'place an ___': '주문을 하다', 'out of ___ (고장)': '고장 난' });
  W('charge', 'n', 60, '요금 · 책임', { 'in ___ of (맡음)': '~을 맡은', 'free of ___': '무료로' });
  W('place/n', 'n', 60, '장소 · 자리', { 'take ___': '(행사가) 열리다', 'out of ___ (어색)': '어울리지 않는', 'in ___ of (대신)': '~ 대신에' });
  W('duty', 'n', 60, '근무 · 의무', { 'on ___': '근무 중인', 'off ___': '근무가 끝난' });
  W('response', 'n', 60, '대답 · 반응', { 'in ___ to (답)': '~에 답하여' });
  W('addition', 'n', 60, '더함', { 'in ___ to (더함)': '~에 더하여' });
  W('as', 'prep', 60, '~부로 · ~로서', { '___ of + 날짜': '~부터 (~ 기준으로)' });
  W('due', 'adj', 60, '~ 때문인 · 예정인', { '___ to (이유)': '~ 때문에' });
  W('prior', 'adj', 60, '이전의', { '___ to (전)': '~ 전에' });
  W('according', 'prep', 60, '~에 따라', { '___ to (출처)': '~에 따르면' });
  W('time', 'n', 60, '시간', { 'on ___': '제시간에', 'in ___': '늦지 않게' });
  W('period', 'n', 60, '기간', { 'a trial ___': '시험 기간', 'for a ___ of': '~ 동안' });
  W('price', 'n', 60, '가격', { 'a reasonable ___': '적당한 가격' });
  W('fare', 'n', 60, '(교통) 요금', { 'a bus ___': '버스 요금' });
  W('bill', 'n', 60, '청구서 · 계산서', { 'pay the ___': '요금을 내다' });
  W('advance', 'n', 60, '진전 · 미리', { 'in ___': '미리' });
  W('ahead', 'adv', 60, '앞에 · 미리', { '___ of time': '미리', '___ of schedule': '예정보다 일찍' });
  W('before', 'prep', 60, '~ 전에', { '___ + 시점': '~ 전에' });
  W('early', 'adv', 60, '일찍', { 'arrive ___': '일찍 오다' });
  W('behalf', 'n', 60, '대신 · 대표', { 'on ___ of (대표)': '~을 대표해서' });
  W('account', 'n', 60, '계좌 · 까닭', { 'on ___ of (이유)': '~ 때문에' });
  W('instead', 'adv', 60, '대신에', { '___ of': '~ 대신에' });
  W('manner', 'n', 60, '방식', { 'in a timely ___': '제때, 신속하게' });
  W('method', 'n', 60, '방법', { 'a payment ___': '결제 방법' });
  W('style', 'n', 60, '양식 · 스타일', { 'a writing ___': '글 쓰는 방식' });
  W('habit', 'n', 60, '버릇', { 'a bad ___': '나쁜 버릇' });
  W('construction', 'n', 60, '공사 · 건설', { 'under ___ (공사)': '공사 중인' });
  W('build', 'v', 60, '짓다', { '___ a factory': '공장을 짓다' });
  W('structure', 'n', 60, '구조', { 'the ___ of': '~의 구조' });
  W('creation', 'n', 60, '만들어 냄 · 창출', { 'job ___': '일자리 창출' });
  W('leave', 'n', 60, '휴가', { 'on ___ (휴가)': '휴가 중인', 'sick ___': '병가' });
  W('absence', 'n', 60, '결근 · 없음', { 'a leave of ___': '휴직', 'in the ___ of': '~이 없을 때' });
  W('rest', 'n', 60, '휴식 · 나머지', { 'get some ___': '좀 쉬다', 'the ___ of': '~의 나머지' });
  W('retirement', 'n', 60, '은퇴', { 'a ___ party': '은퇴 기념 파티' });
  // 61 모양이 비슷한 형용사 (look = 꼬리만 다른 닮은꼴)
  W('considerable', 'adj', 61, '상당한 (양 · 정도)', { 'a ___ amount': '상당한 양', 'a ___ increase': '상당한 증가' }, { look: 'considerate' });
  W('considerate', 'adj', 61, '배려하는 (사람의 마음씨)', { 'be ___ of (사람)': '~을 배려하다' }, { look: 'considerable' });
  W('considerably', 'adv', 61, '상당히', { '___ higher': '훨씬 더 높은' });
  W('consideration', 'n', 61, '고려', { 'take … into ___': '~을 고려하다' });
  W('considering', 'prep', 61, '~을 고려하면');
  W('reliable', 'adj', 61, '믿을 수 있는', { 'a ___ supplier': '믿을 만한 공급업체', 'a ___ service': '믿을 만한 서비스' }, { look: 'reliant' });
  W('reliant', 'adj', 61, '의존하는', { 'be ___ on': '~에 의존하다' }, { look: 'reliable' });
  W('reliance', 'n', 61, '의존', { '___ on': '~에 대한 의존' });
  W('reliably', 'adv', 61, '믿을 수 있게');
  W('reliability', 'n', 61, '믿음직함 · 신뢰도');
  W('economic', 'adj', 61, '경제의', { '___ growth': '경제 성장', '___ conditions': '경제 상황' }, { look: 'economical' });
  W('economical', 'adj', 61, '돈 · 연료가 덜 드는', { 'more ___ (절약)': '더 경제적인 (덜 드는)', 'an ___ option': '돈이 덜 드는 방법' }, { look: 'economic' });
  W('economically', 'adv', 61, '경제적으로');
  W('economy', 'n', 61, '경제', { 'the local ___': '지역 경제' });
  W('successful', 'adj', 61, '성공적인 · 합격한', { 'the ___ candidate': '합격자', 'a ___ launch': '성공적인 출시' }, { look: 'successive' });
  W('successive', 'adj', 61, '연속하는', { 'for two ___ years': '2년 연속' }, { look: 'successful' });
  W('success', 'n', 61, '성공');
  W('successfully', 'adv', 61, '성공적으로');
  W('succeed', 'v', 61, '성공하다 · 뒤를 잇다');
  W('comprehensive', 'adj', 61, '빠짐없는 · 종합적인', { '___ coverage': '빠짐없이 다룸', 'a ___ review': '종합 검토' }, { look: 'comprehensible' });
  W('comprehensible', 'adj', 61, '이해할 수 있는', { 'easily ___': '쉽게 이해되는' }, { look: 'comprehensive' });
  W('comprehension', 'n', 61, '이해 · 이해력');
  W('comprehensively', 'adv', 61, '빠짐없이');
  W('respective', 'adj', 61, '각각의 · 각자의', { 'their ___ + 명사': '각자의 ~' }, { look: 'respectful' });
  W('respectful', 'adj', 61, '존중하는 · 공손한', { 'be ___ of (사람)': '~을 존중하다' }, { look: 'respective' });
  W('respectively', 'adv', 61, '각각');
  W('respect', 'n', 61, '존중');
  W('confident', 'adj', 61, '자신 있는 · 확신하는', { 'be ___ that': '~라고 확신하다' }, { look: 'confidential' });
  W('confidential', 'adj', 61, '기밀의', { 'keep … ___': '기밀로 하다', '___ information': '기밀 정보' }, { look: 'confident' });
  W('confidence', 'n', 61, '자신감 · 믿음');
  W('confidently', 'adv', 61, '자신 있게');
  W('confidentially', 'adv', 61, '은밀히');
  W('informative', 'adj', 61, '유익한 (배울 게 많은)', { 'very ___ (유익)': '아주 유익한' }, { look: 'informed' });
  W('informed', 'adj', 61, '잘 아는 · 정보에 근거한', { 'make ___ decisions': '잘 알고 결정하다' }, { look: 'informative' });
  W('information', 'n', 61, '정보');
  W('sensitive', 'adj', 61, '민감한', { '___ data': '민감한 정보' }, { look: 'sensible' });
  W('sensible', 'adj', 61, '분별 있는 · 현명한', { 'it is ___ to': '~하는 게 현명하다' }, { look: 'sensitive' });
  W('sense', 'n', 61, '감각 · 뜻');
  W('sensibly', 'adv', 61, '현명하게');
  // 62 부사의 짝
  W('approximately', 'adv', 62, '약 · 대략', { '___ + 숫자': '약 ~' });
  W('nearly', 'adv', 62, '거의', { '___ + 숫자': '거의 ~', '___ all': '거의 모두' });
  W('almost', 'adv', 62, '거의', { '___ all': '거의 모두', '___ every': '거의 모든' });
  W('highly', 'adv', 62, '매우 · 높이', { '___ qualified': '자격이 충분한', '___ recommended': '적극 추천되는', '___ regarded': '높이 평가받는' });
  W('promptly', 'adv', 62, '신속하게 · 정각에', { 'respond ___': '신속하게 답하다', 'reply ___': '신속하게 답하다', '___ at + 시각': '~시 정각에' });
  W('shortly', 'adv', 62, '곧 · 직후에', { '___ after': '~ 직후에', '___ before': '~ 직전에' });
  W('closely', 'adv', 62, '긴밀하게 · 자세히', { 'work ___ with': '~와 긴밀히 협력하다', 'monitor ___': '면밀히 지켜보다' });
  W('widely', 'adv', 62, '널리', { '___ used': '널리 쓰이는', '___ known': '널리 알려진' });
  W('heavily', 'adv', 62, '크게 · 심하게', { 'rely ___ on': '~에 크게 의존하다', '___ discounted': '크게 할인된' });
  W('temporarily', 'adv', 62, '임시로', { '___ closed': '임시로 문을 닫은' });
  W('conveniently', 'adv', 62, '편리하게', { '___ located': '편리한 곳에 있는' });
  W('hard', 'adv', 62, '열심히 · 세게', { 'work ___': '열심히 일하다', 'try ___': '열심히 애쓰다' }, { look: 'hardly' });
  W('hardly', 'adv', 62, '거의 ~않다', { 'can · could ___': '거의 ~할 수 없다', '___ any': '거의 없는' }, { look: 'hard' });
  W('most', 'det', 62, '대부분의 · 가장', { '___ + 복수 명사': '대부분의 ~' }, { look: 'mostly' });
  W('mostly', 'adv', 62, '주로 · 대부분', { 'be ___ (주로)': '주로 ~이다' }, { look: 'most' });
  // 63 헷갈리는 동사 (mean 뜻의 무리, pats 뒤의 구조, dir 빌리는 방향, rule 구조 설명)
  W('rise', 'v', 63, '오르다 (스스로)', { 'prices ___': '가격이 오르다', 'sales ___': '판매가 늘다' }, { mean: 'up', pats: { intr: '스스로 오르다' }, rule: '스스로 오르는 자동사예요 (목적어 ×)', ex: 'Prices rise every year.' });
  W('raise', 'v', 63, '올리다 · 모으다', { '___ prices': '가격을 올리다', '___ funds': '기금을 모으다', '___ awareness': '인식을 높이다' }, { mean: 'up', pats: { obj: '무엇을 올리다' }, rule: '무엇을 올리는 타동사예요 (+ 목적어)', ex: 'The company raises prices every year.' });
  W('arise', 'v', 63, '(문제 · 기회가) 생기다', { 'problems ___': '문제가 생기다', 'questions ___': '질문이 생기다' }, { mean: 'happen', pats: { intr: '생기다' }, rule: '스스로 생기는 자동사예요 (목적어 ×)', ex: 'If any problems arise, please call us.' });
  W('lie', 'v', 63, '놓여 있다 · 있다 · 눕다', { '___ near the airport': '공항 가까이에 있다', '___ on the desk': '책상 위에 놓여 있다' }, { mean: 'place', pats: { intr: '놓여 있다' }, rule: '스스로 놓여 있는 자동사예요 (목적어 ×)', ex: 'The file lies on the desk.' });
  W('lay', 'v', 63, '놓다 · 내려놓다', { '___ the papers on the desk': '서류를 책상 위에 놓다' }, { mean: 'place', pats: { obj: '무엇을 놓다' }, rule: '무엇을 놓는 타동사예요 (+ 목적어)', ex: 'Please lay the file on the desk.' });
  W('say', 'v', 63, '말하다 (내용)', {}, { mean: 'say', pats: { that: '~라고 말하다', thing: '~을 말하다 (say hello)' }, rule: '말한 내용이 바로 뒤에 와요 (say that …)', ex: 'She said that the meeting was canceled.' });
  W('tell', 'v', 63, '말해 주다 · 알려 주다', {}, { mean: 'say', pats: { 'person+that': '~에게 …라고 말하다', 'person+thing': '~에게 …을 알려 주다' }, rule: '뒤에 사람이 먼저 와요 (tell + 사람 + 내용)', ex: 'She told us that the meeting was canceled.' });
  W('speak', 'v', 63, '말하다 · (언어를) 하다', {}, { mean: 'say', pats: { language: '~어를 하다', 'to+person': '~와 이야기하다' }, rule: '뒤에 언어나 to + 사람이 와요 (speak English, speak to …)', ex: 'Ms. Oh can speak three languages.' });
  W('talk', 'v', 63, '이야기하다', {}, { mean: 'say', pats: { 'to+person': '~와 이야기하다', about: '~에 대해 이야기하다' }, rule: '뒤에 to나 about이 와요 (talk to …, talk about …)', ex: 'I would like to talk to the manager.' });
  W('remind', 'v', 63, '다시 알려 주다 · 상기시키다', {}, { mean: 'memory', pats: { 'person+to': '~에게 …하라고 다시 알려 주다', 'person+of': '~에게 …을 상기시키다' }, rule: '뒤에 사람이 먼저 와요 (remind + 사람 + to · of)', ex: 'Please remind me to call the client.' });
  W('remember', 'v', 63, '기억하다 · 잊지 않다', {}, { mean: 'memory', pats: { to: '잊지 않고 ~하다', thing: '~을 기억하다' }, rule: '스스로 기억해요 (remember to + 동사, remember + 대상)', ex: 'Please remember to lock the door.' });
  W('recall', 'v', 63, '떠올리다', {}, { mean: 'memory', pats: { thing: '~을 떠올리다' }, rule: '떠올리는 대상이 바로 뒤에 와요 (recall the name)', ex: 'I can\'t recall his name.' });
  W('memorize', 'v', 63, '외우다', {}, { mean: 'memory', pats: { thing: '~을 외우다' }, rule: '외우는 대상이 바로 뒤에 와요 (memorize the list)', ex: 'Please memorize the safety rules.' });
  W('lend', 'v', 63, '빌려주다 (주어 → 남)', { '___ + 사람 + 물건': '~에게 …을 빌려주다' }, { mean: 'loan', dir: 'out', ex: 'Could you lend me your laptop?' });
  W('borrow', 'v', 63, '빌리다 (남 → 주어)', { '___ + 물건 (+ from)': '~을 빌려 오다' }, { mean: 'loan', dir: 'in', ex: 'May I borrow your pen?' });
  W('affect', 'v', 63, '영향을 주다 (동사)', { '___ + 대상 (영향)': '~에 영향을 주다' }, { mean: 'influence', pats: { obj: '~에 영향을 주다' }, rule: '영향을 주는 동사예요 (+ 목적어)', ex: 'The rain may affect the game.' });
  W('effect', 'n', 63, '효과 · 영향 (명사)', { 'have an ___ on': '~에 영향을 주다', 'take ___': '효력이 생기다' }, { ex: 'The policy had a positive effect on sales.' });
  W('affection', 'n', 63, '애정', { '___ for': '~에 대한 애정' });
  W('effective', 'adj', 63, '효과적인', { '___ immediately': '즉시 시행되는' });
  VC.LEX = LEX;

  // 바뀐 모양 → 사전 낱말
  const LEMMA = { told: 'tell', said: 'say', spoke: 'speak', talked: 'talk', lies: 'lie', lays: 'lay', raises: 'raise', arises: 'arise', rises: 'rise',
    lent: 'lend', borrowed: 'borrow', reminded: 'remind', raised: 'raise', remembered: 'remember' };
  VC.lemma = w => { const s = String(w).toLowerCase(); return LEMMA[s] || s; };
  VC.show = w => String(w).split('/')[0];
  VC.entry = w => LEX[VC.lemma(w)];
  // 짝 열쇠 + 낱말 → 짝 표현 (괄호 이름표는 뺌)
  VC.phrase = (w, key) => key.replace(/\s*\([^)]*\)$/, '').replace('___', VC.show(w));

  /* ---------- 함께 쓰지 않는다고 확인한 낱말 (짝 열쇠마다) ----------
   * 여기 적은 것만 '짝 사전의 ×'가 돼요. 적지 않은 조합은 판정하지 않아요(?).
   */
  const KEY = {};
  const NO = (key, list) => { (KEY[key] = KEY[key] || { no: [] }).no.push(...list); };
  NO('___ a survey', ['attend', 'reserve', 'earn']);
  NO('___ a plan', ['attend', 'reserve', 'inform']);
  NO('___ a deadline', ['attend', 'earn', 'reserve', 'attract']);
  NO('___ an issue', ['reserve', 'attract', 'exceed']);
  NO('___ an application', ['attend', 'attract', 'achieve']);
  NO('___ a table', ['conduct', 'implement', 'submit']);
  NO('___ a conference', ['implement', 'submit', 'exceed']);
  NO('___ an agreement', ['attend', 'reserve', 'conduct']);
  NO('___ a product', ['attend', 'address', 'meet']);
  NO('___ a subscription', ['attend', 'conduct', 'address']);
  NO('___ visitors', ['conduct', 'submit', 'renew']);
  NO('___ expectations', ['attend', 'reserve', 'submit']);
  NO('___ a permit', ['attend', 'attract', 'meet']);
  NO('___ a position', ['attend', 'conduct', 'exceed']);
  NO('___ a complaint', ['attend', 'reserve', 'attract']);
  NO('___ a presentation', ['reserve', 'earn', 'renew']);
  NO('___ a decision', ['attend', 'reserve', 'attract', 'do', 'hold', 'place']);
  NO('___ a goal', ['attend', 'reserve', 'conduct']);
  NO('___ a refund', ['attend', 'conduct', 'attract']);
  NO('___ a meeting', ['reserve', 'earn', 'submit']);
  NO('___ a problem', ['attract', 'reserve', 'earn']);
  NO('___ a proposal', ['attend', 'attract', 'earn']);
  NO('___ the demand', ['reserve', 'submit', 'attend']);
  NO('___ a policy', ['attract', 'remind', 'exceed']);
  NO('___ a mistake', ['do']);
  NO('___ business', ['make']);
  NO('___ effect', ['make', 'hold', 'do']);
  NO('until further ___', ['note', 'attention', 'caution']);
  NO('out of ___ (재고)', ['order', 'charge', 'place/n']);
  NO('in ___ of (맡음)', ['duty', 'response', 'addition']);
  NO('___ of + 날짜', ['due', 'prior', 'according']);
  NO('on short ___', ['note', 'time', 'period']);
  NO('___ an order', ['attend', 'reserve', 'inform']);
  NO('___ attention to', ['make', 'take', 'do']);
  NO('free of ___', ['price', 'fare', 'bill']);
  NO('___ place', ['make', 'hold', 'have']);
  NO('___ action', ['make', 'hold', 'earn']);
  NO('___ advantage of', ['make', 'hold', 'give']);
  NO('on ___ of (대표)', ['account', 'place/n']);
  NO('in a timely ___', ['method', 'style', 'habit']);
  NO('under ___ (공사)', ['structure', 'creation']);
  NO('___ a break', ['make', 'hold', 'give']);
  NO('on ___ (휴가)', ['absence', 'rest', 'retirement']);
  NO('a ___ amount', ['considerate']);
  NO('be ___ of (사람)', ['considerable', 'respective']);
  NO('a ___ supplier', ['reliant']);
  NO('a ___ service', ['reliant']);
  NO('be ___ on', ['reliable']);
  NO('___ growth', ['economical']);
  NO('more ___ (절약)', ['economic']);
  NO('for two ___ years', ['successful']);
  NO('the ___ candidate', ['successive']);
  NO('___ coverage', ['comprehensible']);
  NO('easily ___', ['comprehensive']);
  NO('their ___ + 명사', ['respectful']);
  NO('keep … ___', ['confident']);
  NO('be ___ that', ['confidential']);
  NO('very ___ (유익)', ['informed']);
  NO('make ___ decisions', ['informative']);
  NO('___ data', ['sensible']);
  NO('it is ___ to', ['sensitive']);
  NO('___ + 숫자', ['highly', 'shortly', 'promptly', 'closely']);
  NO('___ qualified', ['heavily', 'shortly', 'closely', 'approximately']);
  NO('respond ___', ['approximately', 'highly', 'nearly']);
  NO('reply ___', ['approximately', 'highly', 'mostly']);
  NO('___ after', ['highly', 'heavily', 'mostly']);
  NO('___ all', ['highly', 'shortly', 'closely']);
  NO('be ___ (주로)', ['almost', 'highly']);
  NO('work ___', ['hardly', 'highly', 'nearly']);
  NO('can · could ___', ['hard', 'highly', 'shortly']);
  NO('work ___ with', ['highly', 'approximately', 'shortly']);
  NO('___ used', ['shortly', 'approximately', 'closely']);
  NO('rely ___ on', ['shortly', 'approximately', 'promptly']);
  NO('___ closed', ['approximately', 'highly', 'nearly']);
  NO('___ at + 시각', ['highly', 'mostly', 'hardly']);
  NO('___ located', ['approximately', 'highly', 'hardly']);
  NO('___ regarded', ['approximately', 'shortly', 'promptly']);
  NO('have an ___ on', ['affection']);
  VC.KEY = KEY;

  const ok = (why, x) => Object.assign({ s: 'ok', why }, x || {}), no = (why, kind, step) => ({ s: 'no', why, kind, step }), unk = why => ({ s: '?', why });
  // 그 낱말의 진짜 짝 두 개 (보여 주기용). 빈칸 틀과 모양이 같은 짝(out of order처럼)은 뜻을 붙여 맨 앞에
  const skel = k => k.replace(/\s*\([^)]*\)$/, '');
  const friendsOf = (L, n = 2, key) => {
    const ks = Object.keys(L.friends), same = key ? ks.filter(k => k !== key && skel(k) === skel(key)) : [];
    return same.concat(ks.filter(k => !same.includes(k))).slice(0, n).map(k => VC.phrase(L.w, k) + (same.includes(k) ? ` (${L.friends[k]})` : ''));
  };
  VC.friendsOf = (w, n) => { const L = VC.entry(w); return L ? friendsOf(L, n) : []; };

  // 낱말 + 짝 열쇠 → 사전 판정 (구조 규칙 없이 사전만)
  VC.judgePair = function (w, key) {
    const L = VC.entry(w);
    if (!L) return unk('사전에 없는 낱말이에요.');
    if (L.friends[key]) return ok(`${VC.phrase(w, key)} = ${L.friends[key]}.`);
    if (KEY[key] && KEY[key].no.includes(L.w)) {
      const fr = friendsOf(L, 2, key), look = L.look && LEX[L.look] && LEX[L.look].friends[key];   // 닮은꼴이 바로 이 짝의 답일 때만 '닮은꼴 함정'
      return no(`${VC.show(w)} → ${L.ko}.${fr.length ? ' 짝: ' + fr.join(' · ') + '.' : ''}`, look ? 'look' : 'pair', look ? 3 : 2);
    }
    return unk('이 짝은 사전에 없어서 판정하지 않아요. 쓰이는 짝일 수도 있어요.');
  };

  // 낱말 + 빈칸 틀 → 판정. 분명한 규칙(품사 · 뜻 · 구조 · 방향)을 먼저 보고, 그다음 짝 사전을 봐요
  VC.judge = function (w, fr) {
    const L = VC.entry(w), s = VC.show(w);
    if (!L) return unk('사전에 없는 낱말이에요.');
    if (fr.need && L.pos !== fr.need) return no(`${s} → ${POS[L.pos]} (${L.ko}). 빈칸은 ${POS[fr.need]} 자리예요.`, 'pos', 3);
    if (fr.mean && L.mean && L.mean !== fr.mean) return no(`${s} → ${L.ko}. 이 빈칸은 ‘${MEAN[fr.mean]}’ 뜻이 필요해요.`, 'mean', 2);
    if (fr.pat && L.pats && !L.pats[fr.pat]) return no(`${s} → ${L.rule}. 이 빈칸은 ${PAT[fr.pat].ko}.`, 'pat', 3);
    if (fr.dir && L.dir && L.dir !== fr.dir) return no(`${s} → ${L.ko}. 이 빈칸은 ${DIR[fr.dir]}이에요.`, 'dir', 3);
    const j = VC.judgePair(w, fr.key);
    if (j.s === 'no' && j.kind === 'look') j.why = `${s} → ${L.ko}. 꼬리만 다른 닮은꼴이에요.` + (Object.keys(L.friends).length ? ` 짝: ${friendsOf(L, 2, fr.key).join(' · ')}.` : '');
    return j;
  };

  /* ---------- 짝 카드 (놀이터) ----------
   * C(유형, 문장, 짝만 보기, 짝(문장 속 글자), 짝 열쇠, 보기 — 첫째가 정답, 해석, 더)
   * 보기는 화면에 섞어서 내요. 유형마다 빈칸의 품사(need)는 기본값이 있어요.
   */
  const NEED = { 59: 'v', 61: 'adj', 62: 'adv' };
  const CARDS = [];
  const C = (type, q, short, cue, key, opts, ko, x) => CARDS.push(Object.assign({ id: `c${type}-${CARDS.filter(c => c.type === type).length + 1}`, type, q, short, cue: [].concat(cue), key, opts, ko, need: NEED[type] }, x || {}));
  // 59 동사 + 목적어
  C(59, 'The marketing team will ___ a survey of 500 customers next month.', '___ a survey', 'survey', '___ a survey', ['conduct', 'attend', 'reserve', 'earn'], '마케팅 팀은 다음 달에 고객 500명을 대상으로 설문 조사를 실시할 거예요.');
  C(59, 'The city will ___ its new recycling plan in March.', '___ a plan', 'plan', '___ a plan', ['implement', 'attend', 'reserve', 'inform'], '시는 3월에 새 재활용 계획을 시행할 거예요.');
  C(59, 'We worked late every night to ___ the deadline.', '___ a deadline', 'deadline', '___ a deadline', ['meet', 'attend', 'earn', 'reserve'], '마감을 지키려고 매일 밤 늦게까지 일했어요.');
  C(59, 'The manager called a meeting to ___ the issue of rising costs.', '___ an issue', 'issue', '___ an issue', ['address', 'reserve', 'attract', 'exceed'], '매니저는 비용이 오르는 문제를 다루려고 회의를 소집했어요.');
  C(59, 'All applicants must ___ their application forms by Friday.', '___ an application', 'application forms', '___ an application', ['submit', 'attend', 'attract', 'achieve'], '모든 지원자는 금요일까지 지원서를 내야 해요.');
  C(59, 'Please ___ a table for six at the Italian restaurant.', '___ a table', 'table', '___ a table', ['reserve', 'conduct', 'implement', 'submit'], '이탈리아 식당에 여섯 명 자리를 예약해 주세요.');
  C(59, 'More than 300 people are expected to ___ the annual conference.', '___ a conference', 'conference', '___ a conference', ['attend', 'implement', 'submit', 'exceed'], '300명이 넘는 사람이 연례 학회에 참석할 것으로 보여요.');
  C(59, 'After months of talks, the two companies hope to ___ an agreement soon.', '___ an agreement', 'agreement', '___ an agreement', ['reach', 'attend', 'reserve', 'conduct'], '몇 달 동안 협상한 끝에, 두 회사는 곧 합의에 이르기를 바라고 있어요.');
  C(59, 'The company will ___ its new smartphone in September.', '___ a product', 'smartphone', '___ a product', ['launch', 'attend', 'address', 'meet'], '그 회사는 9월에 새 스마트폰을 출시할 거예요.');
  C(59, "Don't forget to ___ your subscription before it expires.", '___ a subscription', 'subscription', '___ a subscription', ['renew', 'attend', 'conduct', 'address'], '구독이 끝나기 전에 갱신하는 것을 잊지 마세요.');
  C(59, 'Because of the storm, the organizers decided to ___ the registration deadline by one week.', '___ a deadline (by one week)', 'deadline', '___ a deadline', ['extend', 'attend', 'earn', 'attract'], '폭풍 때문에 주최 측은 등록 마감을 일주일 늦추기로 했어요.');
  C(59, 'The new shopping mall is expected to ___ many visitors from nearby cities.', '___ visitors', 'visitors', '___ visitors', ['attract', 'conduct', 'submit', 'renew'], '새 쇼핑몰은 근처 도시에서 많은 방문객을 끌어들일 것으로 보여요.');
  C(59, "We hope this quarter's sales will ___ our expectations.", '___ expectations', 'expectations', '___ expectations', ['exceed', 'attend', 'reserve', 'submit'], '이번 분기 매출이 우리 기대를 넘기를 바라요.');
  C(59, 'You must ___ a permit before starting construction.', '___ a permit', 'permit', '___ a permit', ['obtain', 'attend', 'attract', 'meet'], '공사를 시작하기 전에 허가증을 받아야 해요.');
  C(59, 'We hope to ___ the sales manager position by next month.', '___ a position', 'position', '___ a position', ['fill', 'attend', 'conduct', 'exceed'], '다음 달까지 영업 관리자 자리에 사람을 뽑고 싶어요.');
  C(59, 'If you are not satisfied, you may ___ a complaint with our customer service department.', '___ a complaint', 'complaint', '___ a complaint', ['file', 'attend', 'reserve', 'attract'], '만족스럽지 않으면 고객 서비스 부서에 불만을 정식으로 제기할 수 있어요.');
  C(59, 'Ms. Lin will ___ a presentation on the new product line.', '___ a presentation', 'presentation', '___ a presentation', ['give', 'reserve', 'earn', 'renew'], '린 씨가 새 제품군에 대해 발표할 거예요.');
  C(59, 'The board will ___ a final decision next Monday.', '___ a decision', 'decision', '___ a decision', ['make', 'attend', 'reserve', 'attract'], '이사회는 다음 주 월요일에 최종 결정을 내릴 거예요.');
  C(59, 'Our team was able to ___ all of its sales goals this year.', '___ a goal', 'goals', '___ a goal', ['achieve', 'attend', 'reserve', 'conduct'], '우리 팀은 올해 판매 목표를 모두 이뤘어요.');
  C(59, 'The store will ___ a full refund if the item arrives damaged.', '___ a refund', 'refund', '___ a refund', ['issue', 'attend', 'conduct', 'attract'], '물건이 망가져 도착하면 가게에서 전액 환불해 줄 거예요.');
  C(59, 'The city will ___ a public meeting to discuss the new park.', '___ a meeting', 'meeting', '___ a meeting', ['hold', 'reserve', 'earn', 'submit'], '시는 새 공원을 논의하려고 공청회를 열 거예요.');
  // 60 덩어리 표현
  C(60, 'The new dress code will ___ effect next Monday.', '___ effect', 'effect', '___ effect', ['take', 'make', 'hold', 'do'], '새 복장 규정은 다음 주 월요일부터 시행돼요.', { need: 'v' });
  C(60, 'The cafeteria will be closed until further ___.', 'until further ___', 'until further', 'until further ___', ['notice', 'note', 'attention', 'caution'], '구내식당은 추후 공지가 있을 때까지 문을 닫아요.', { need: 'n' });
  C(60, 'The item you ordered is currently out of ___, but we expect more next week.', 'out of ___ (재고)', 'out of', 'out of ___ (재고)', ['stock', 'order', 'charge', 'place/n'], '주문하신 물건은 지금 재고가 없지만, 다음 주에 더 들어올 거예요.', { need: 'n' });
  C(60, 'Ms. Cho is in ___ of the hiring process.', 'in ___ of', ['in', 'of the hiring'], 'in ___ of (맡음)', ['charge', 'duty', 'response', 'addition'], '조 씨가 채용 과정을 맡고 있어요.', { need: 'n' });
  C(60, '___ of July 1, all employees must wear ID badges.', '___ of + 날짜', 'of July 1', '___ of + 날짜', ['As', 'Due', 'Prior', 'According'], '7월 1일부터 모든 직원은 사원증을 달아야 해요.');
  C(60, 'Thank you for coming to the meeting on such short ___.', 'on short ___', 'on such short', 'on short ___', ['notice', 'note', 'time', 'period'], '이렇게 급하게 회의에 와 주셔서 고마워요.', { need: 'n' });
  C(60, 'To ___ an order, please visit our website or call our sales team.', '___ an order', 'an order', '___ an order', ['place', 'attend', 'reserve', 'inform'], '주문하시려면 웹사이트를 방문하거나 영업팀에 전화하세요.', { need: 'v' });
  C(60, "The foundation hopes to ___ funds for a new children's library.", '___ funds', 'funds', '___ funds', ['raise', 'rise', 'arise', 'lie'], '그 재단은 새 어린이 도서관을 지을 기금을 모으고 싶어 해요.', { need: 'v', pat: 'obj', mean: 'up' });
  C(60, 'Please ___ attention to the safety instructions.', '___ attention to', 'attention', '___ attention to', ['pay', 'make', 'take', 'do'], '안전 수칙에 주의를 기울여 주세요.', { need: 'v' });
  C(60, 'Delivery is free of ___ for orders over $50.', 'free of ___', 'free of', 'free of ___', ['charge', 'price', 'fare', 'bill'], '50달러가 넘는 주문은 배송비가 무료예요.', { need: 'n' });
  C(60, 'The awards ceremony will ___ place in the main hall.', '___ place', 'place', '___ place', ['take', 'make', 'hold', 'have'], '시상식은 본관 홀에서 열려요.', { need: 'v' });
  C(60, 'We will ___ action to prevent further delays.', '___ action', 'action', '___ action', ['take', 'make', 'hold', 'earn'], '더 늦어지지 않도록 조치를 취할게요.', { need: 'v' });
  C(60, 'The company decided to ___ advantage of the low interest rates.', '___ advantage of', 'advantage of', '___ advantage of', ['take', 'make', 'hold', 'give'], '회사는 낮은 금리를 이용하기로 했어요.', { need: 'v' });
  C(60, 'Concert tickets must be purchased in ___.', 'in ___ (미리)', 'in', 'in ___', ['advance', 'ahead', 'before', 'early'], '콘서트 표는 미리 사야 해요.', { need: 'n' });
  C(60, 'I am writing on ___ of the entire design team.', 'on ___ of (대표)', ['on', 'of the entire'], 'on ___ of (대표)', ['behalf', 'account', 'place/n', 'instead'], '디자인 팀 전체를 대표해서 글을 써요.', { need: 'n' });
  C(60, 'Please respond to all inquiries in a timely ___.', 'in a timely ___', 'in a timely', 'in a timely ___', ['manner', 'method', 'style', 'habit'], '모든 문의에 제때 답해 주세요.', { need: 'n' });
  C(60, 'The new library building is still under ___.', 'under ___ (공사)', 'under', 'under ___ (공사)', ['construction', 'build', 'structure', 'creation'], '새 도서관 건물은 아직 공사 중이에요.', { need: 'n' });
  C(60, "Let's ___ a short break before the next session.", '___ a break', 'break', '___ a break', ['take', 'make', 'hold', 'give'], '다음 시간 전에 잠깐 쉬어요.', { need: 'v' });
  C(60, 'Mr. Ahn will be on ___ next week, so please contact Ms. Ito.', 'on ___ (휴가)', 'on', 'on ___ (휴가)', ['leave', 'absence', 'rest', 'retirement'], '안 씨는 다음 주에 휴가라서 이토 씨에게 연락해 주세요.', { need: 'n' });
  // 61 모양이 비슷한 형용사
  C(61, 'The renovation project required a ___ amount of time.', 'a ___ amount of time', 'amount', 'a ___ amount', ['considerable', 'considerate', 'considerably', 'consideration'], '보수 공사에는 상당한 시간이 들었어요.');
  C(61, "Ms. Park is always ___ of her coworkers' busy schedules.", 'be ___ of others', "of her coworkers'", 'be ___ of (사람)', ['considerate', 'considerable', 'considering', 'consideration'], '박 씨는 늘 동료들의 바쁜 일정을 배려해요.');
  C(61, 'We are looking for a ___ supplier that always delivers on time.', 'a ___ supplier', 'supplier', 'a ___ supplier', ['reliable', 'reliant', 'reliance', 'reliably'], '늘 제때 배달하는 믿을 만한 공급업체를 찾고 있어요.');
  C(61, 'The local economy is heavily ___ on tourism.', 'be ___ on', 'on tourism', 'be ___ on', ['reliant', 'reliable', 'reliability', 'reliably'], '그 지역 경제는 관광에 크게 의존해요.');
  C(61, '___ growth slowed in the third quarter.', '___ growth', 'growth', '___ growth', ['Economic', 'Economical', 'Economically', 'Economy'], '3분기에 경제 성장이 느려졌어요.');
  C(61, 'This car is more ___ than the old model because it uses less fuel.', 'more ___ (연료가 덜 듦)', 'uses less fuel', 'more ___ (절약)', ['economical', 'economic', 'economically', 'economy'], '이 차는 연료가 덜 들어서 예전 모델보다 경제적이에요.');
  C(61, 'The company has lost money for two ___ years.', 'for two ___ years', 'years', 'for two ___ years', ['successive', 'successful', 'success', 'successfully'], '그 회사는 2년 연속 손해를 봤어요.');
  C(61, 'The ___ candidate will start work on June 1.', 'the ___ candidate', 'candidate', 'the ___ candidate', ['successful', 'successive', 'success', 'succeed'], '합격자는 6월 1일부터 일을 시작해요.');
  C(61, 'The training manual provides ___ coverage of all safety procedures.', '___ coverage', 'coverage', '___ coverage', ['comprehensive', 'comprehensible', 'comprehension', 'comprehensively'], '교육 매뉴얼은 모든 안전 절차를 빠짐없이 다뤄요.');
  C(61, 'The instructions are written in simple language so that they are easily ___ to beginners.', 'easily ___ to beginners', 'easily', 'easily ___', ['comprehensible', 'comprehensive', 'comprehension', 'comprehensively'], '설명서는 쉬운 말로 쓰여 있어서 처음 하는 사람도 쉽게 이해할 수 있어요.');
  C(61, 'After the merger, the two directors kept their ___ roles.', 'their ___ roles', 'roles', 'their ___ + 명사', ['respective', 'respectful', 'respectively', 'respect'], '합병 뒤에도 두 이사는 각자의 역할을 그대로 맡았어요.');
  C(61, 'Please be ___ of other guests and keep noise to a minimum.', 'be ___ of other guests', 'of other guests', 'be ___ of (사람)', ['respectful', 'respective', 'respectively', 'respect'], '다른 손님을 존중해서 소음을 줄여 주세요.');
  C(61, 'Please keep this salary information strictly ___.', 'keep … strictly ___', 'keep this salary information', 'keep … ___', ['confidential', 'confident', 'confidence', 'confidently'], '이 급여 정보는 엄격히 비밀로 해 주세요.');
  C(61, 'We are ___ that the new product will sell well.', 'be ___ that …', 'that the new', 'be ___ that', ['confident', 'confidential', 'confidence', 'confidentially'], '새 제품이 잘 팔릴 거라고 확신해요.');
  C(61, 'The workshop was very ___, and everyone learned a lot.', 'very ___ (배울 게 많은)', 'learned a lot', 'very ___ (유익)', ['informative', 'informed', 'information', 'inform'], '워크숍은 아주 유익해서 모두 많이 배웠어요.');
  C(61, 'Comparing prices helps customers make ___ decisions.', 'make ___ decisions', 'decisions', 'make ___ decisions', ['informed', 'informative', 'information', 'inform'], '가격을 비교하면 손님이 잘 알고 결정하는 데 도움이 돼요.');
  C(61, 'Please handle ___ customer data with extra care.', '___ data', 'customer data', '___ data', ['sensitive', 'sensible', 'sense', 'sensibly'], '민감한 고객 정보는 특히 조심해서 다뤄 주세요.');
  C(61, 'It would be ___ to book your flight early during the holiday season.', 'It would be ___ to …', 'to book', 'it is ___ to', ['sensible', 'sensitive', 'sense', 'sensibly'], '연휴철에는 비행기 표를 일찍 예매하는 게 현명해요.');
  // 62 부사의 짝
  C(62, '___ 200 people attended the opening ceremony.', '___ 200 people', '200 people', '___ + 숫자', ['Approximately', 'Highly', 'Shortly', 'Promptly'], '약 200명이 개회식에 참석했어요.');
  C(62, 'The new manager is ___ qualified for the position.', '___ qualified', 'qualified', '___ qualified', ['highly', 'heavily', 'shortly', 'closely'], '새 매니저는 그 자리에 충분한 자격을 갖췄어요.');
  C(62, 'Please respond ___ to all customer inquiries.', 'respond ___', 'respond', 'respond ___', ['promptly', 'approximately', 'highly', 'nearly'], '고객 문의에는 모두 신속하게 답해 주세요.');
  C(62, 'Mr. Grant left the office ___ after the meeting ended.', '___ after', 'after the meeting', '___ after', ['shortly', 'highly', 'heavily', 'mostly'], '그랜트 씨는 회의가 끝난 직후에 사무실을 나섰어요.');
  C(62, '___ all of the seats were filled before the show began.', '___ all', 'all of the seats', '___ all', ['Nearly', 'Highly', 'Shortly', 'Closely'], '공연이 시작되기 전에 거의 모든 좌석이 찼어요.');
  C(62, 'The participants were ___ from overseas.', 'were ___ from overseas', 'from overseas', 'be ___ (주로)', ['mostly', 'most', 'almost', 'highly'], '참가자는 주로 해외에서 왔어요.');
  C(62, 'Mr. Diaz worked ___ to finish the report on time.', 'worked ___', 'worked', 'work ___', ['hard', 'hardly', 'highly', 'nearly'], '디아즈 씨는 보고서를 제때 끝내려고 열심히 일했어요.');
  C(62, 'The room was so noisy that we could ___ hear the speaker.', 'could ___ hear', 'could', 'can · could ___', ['hardly', 'hard', 'highly', 'shortly'], '방이 너무 시끄러워서 발표자 말이 거의 들리지 않았어요.');
  C(62, 'Our designers work ___ with the engineering team.', 'work ___ with', ['work', 'with the engineering'], 'work ___ with', ['closely', 'highly', 'approximately', 'shortly'], '디자이너들은 엔지니어 팀과 긴밀히 협력해요.');
  C(62, 'This software is ___ used in the banking industry.', '___ used', 'used', '___ used', ['widely', 'shortly', 'approximately', 'closely'], '이 소프트웨어는 은행 업계에서 널리 쓰여요.');
  C(62, 'The company relies ___ on overseas suppliers.', 'rely ___ on', ['relies', 'on overseas'], 'rely ___ on', ['heavily', 'shortly', 'approximately', 'promptly'], '그 회사는 해외 공급업체에 크게 의존해요.');
  C(62, 'The fitness center will be ___ closed for renovations.', '___ closed', 'closed', '___ closed', ['temporarily', 'approximately', 'highly', 'nearly'], '피트니스 센터는 보수 공사로 임시 휴관해요.');
  C(62, 'The seminar will start ___ at 9 a.m., so please arrive early.', '___ at 9 a.m.', 'at 9 a.m.', '___ at + 시각', ['promptly', 'highly', 'mostly', 'hardly'], '세미나는 오전 9시 정각에 시작하니 일찍 와 주세요.');
  C(62, 'The hotel is ___ located near the airport.', '___ located', 'located', '___ located', ['conveniently', 'approximately', 'highly', 'hardly'], '그 호텔은 공항 가까이 편리한 곳에 있어요.');
  // 63 헷갈리는 동사
  C(63, 'Several airlines have decided to ___ their fares this summer.', '___ their fares', 'their fares', '___ prices', ['raise', 'rise', 'arise', 'lie'], '여러 항공사가 이번 여름에 요금을 올리기로 했어요.', { need: 'v', pat: 'obj', mean: 'up' });
  C(63, 'Prices are expected to ___ by 5 percent next year.', 'Prices ___ .', 'Prices', 'prices ___', ['rise', 'raise', 'arise', 'lay'], '내년에 가격이 5퍼센트 오를 것으로 보여요.', { need: 'v', pat: 'intr', mean: 'up' });
  C(63, 'If any problems ___, please contact the help desk.', 'problems ___', 'problems', 'problems ___', ['arise', 'rise', 'raise', 'lay'], '문제가 생기면 지원 센터에 연락하세요.', { need: 'v', pat: 'intr', mean: 'happen' });
  C(63, 'Please ___ the documents on my desk.', '___ the documents on …', 'the documents', '___ the papers on the desk', ['lay', 'lie', 'rise', 'arise'], '서류를 제 책상 위에 놓아 주세요.', { need: 'v', pat: 'obj', mean: 'place' });
  C(63, 'The hotel ___ just two kilometers from the airport.', '___ two kilometers from …', 'two kilometers from', '___ near the airport', ['lies', 'lays', 'raises', 'arises'], '그 호텔은 공항에서 2킬로미터밖에 떨어져 있지 않아요.', { need: 'v', pat: 'intr', mean: 'place' });
  C(63, 'Ms. Kim ___ us that the meeting had been postponed.', '___ us that …', 'us that', PAT['person+that'].en, ['told', 'said', 'spoke', 'talked'], '김 씨가 회의가 미뤄졌다고 알려 줬어요.', { need: 'v', pat: 'person+that', mean: 'say' });
  C(63, 'The manager ___ that the budget would be approved soon.', '___ that …', 'that the budget', PAT.that.en, ['said', 'told', 'spoke', 'talked'], '매니저는 예산이 곧 승인될 거라고 말했어요.', { need: 'v', pat: 'that', mean: 'say' });
  C(63, 'Ms. Oh can ___ three languages fluently.', '___ three languages', 'three languages', PAT.language.en, ['speak', 'say', 'tell', 'talk'], '오 씨는 세 언어를 유창하게 해요.', { need: 'v', pat: 'language', mean: 'say' });
  C(63, 'Could you ___ me the way to the conference room?', '___ me the way', 'me the way', PAT['person+thing'].en, ['tell', 'say', 'speak', 'talk'], '회의실 가는 길을 알려 주시겠어요?', { need: 'v', pat: 'person+thing', mean: 'say' });
  C(63, 'I would like to ___ to the manager about my order.', '___ to the manager', 'to the manager', PAT['to+person'].en, ['speak', 'say', 'tell', 'remind'], '제 주문에 대해 매니저와 이야기하고 싶어요.', { need: 'v', pat: 'to+person', mean: 'say' });
  C(63, 'Please ___ me to send the invoice tomorrow.', '___ me to send …', 'me to send', PAT['person+to'].en, ['remind', 'remember', 'recall', 'memorize'], '내일 청구서를 보내라고 저에게 다시 알려 주세요.', { need: 'v', pat: 'person+to', mean: 'memory' });
  C(63, 'Please ___ to turn off the lights when you leave.', '___ to turn off …', 'to turn off', PAT.to.en, ['remember', 'remind', 'recall', 'memorize'], '나갈 때 불 끄는 것을 잊지 마세요.', { need: 'v', pat: 'to', mean: 'memory' });
  C(63, "This e-mail is to ___ you of tomorrow's meeting.", '___ you of …', 'you of', PAT['person+of'].en, ['remind', 'remember', 'recall', 'memorize'], '내일 회의를 다시 알려 드리려고 이메일을 보내요.', { need: 'v', pat: 'person+of', mean: 'memory' });
  C(63, 'Could you ___ me your laptop for the presentation?', '___ me your laptop', 'me your laptop', '___ + 사람 + 물건', ['lend', 'borrow', 'remind', 'raise'], '발표 때 노트북을 빌려주실 수 있나요?', { need: 'v', dir: 'out', mean: 'loan' });
  C(63, 'May I ___ your pen for a moment?', '___ your pen', 'your pen', '___ + 물건 (+ from)', ['borrow', 'lend', 'remind', 'raise'], '펜 좀 잠깐 빌려도 될까요?', { need: 'v', dir: 'in', mean: 'loan' });
  C(63, 'The road construction may ___ traffic in the downtown area.', '___ traffic', 'traffic', '___ + 대상 (영향)', ['affect', 'effect', 'affection', 'effective'], '도로 공사가 시내 교통에 영향을 줄 수 있어요.', { need: 'v', pat: 'obj', mean: 'influence' });
  C(63, 'The new policy had a positive ___ on employee morale.', 'have an ___ on', ['had a positive', 'on employee morale'], 'have an ___ on', ['effect', 'affect', 'affection', 'effective'], '새 정책은 직원 사기에 좋은 영향을 줬어요.', { need: 'n' });
  VC.CARDS = CARDS;
  VC.card = id => CARDS.find(c => c.id === id);
  VC.judgeCard = (c, w) => VC.judge(w, c);

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * opts: 보기(보이는 순서), a: 정답 번호, key: 짝 열쇠, cue: 짝(문장 속 글자), role: 짝의 종류(① 단계 문장), scue: 구조 단서(③ 단계에 색)
   */
  const D = (q, opts, a, key, cue, role, ko, tag, x) => Object.assign({ q, opts, a, key, cue: [].concat(cue), role, ko, tag, need: 'v' }, x || {});
  VC.DRILL = [
    D("The IT team is working to ___ the problem with the company's e-mail server.", ['attract', 'address', 'reserve', 'earn'], 1, '___ a problem', 'problem', '뒤의 목적어', 'IT 팀은 회사 이메일 서버의 문제를 해결하려고 애쓰고 있어요.', '59 동사 + 목적어'),
    D('All department heads are asked to ___ their budget proposals by March 15.', ['attend', 'attract', 'submit', 'earn'], 2, '___ a proposal', 'budget proposals', '뒤의 목적어', '모든 부서장은 3월 15일까지 예산안을 제출해야 해요.', '59 동사 + 목적어'),
    D('To ___ the growing demand, the factory has added a night shift.', ['reserve', 'submit', 'attend', 'meet'], 3, '___ the demand', 'demand', '뒤의 목적어', '늘어나는 수요를 맞추려고 공장은 야간 근무조를 더했어요.', '59 동사 + 목적어 · meet'),
    D('The company will ___ a new flexible work policy starting next month.', ['implement', 'attract', 'remind', 'exceed'], 0, '___ a policy', 'policy', '뒤의 목적어', '회사는 다음 달부터 새 유연 근무 정책을 시행해요.', '59 동사 + 목적어'),
    D('The revised parking rules will ___ effect on April 1.', ['make', 'take', 'hold', 'do'], 1, '___ effect', 'effect', '뒤의 명사 (덩어리)', '바뀐 주차 규칙은 4월 1일부터 시행돼요.', '60 덩어리 · take effect'),
    D('The north entrance will remain closed until further ___.', ['note', 'attention', 'notice', 'caution'], 2, 'until further ___', 'until further', '앞의 덩어리', '북쪽 출입구는 추후 공지가 있을 때까지 계속 닫혀 있어요.', '60 덩어리 · until further notice', { need: 'n' }),
    D('Mr. Tan is in ___ of training all new sales staff.', ['duty', 'response', 'addition', 'charge'], 3, 'in ___ of (맡음)', ['in', 'of training'], '앞뒤의 덩어리', '탄 씨는 새 영업 사원 교육을 모두 맡고 있어요.', '60 덩어리 · in charge of', { need: 'n' }),
    D('The new inventory system has saved the company a ___ amount of money.', ['considerable', 'considerate', 'considering', 'consideration'], 0, 'a ___ amount', 'amount', '꾸밈 받는 명사', '새 재고 관리 시스템 덕분에 회사는 상당한 돈을 아꼈어요.', '61 닮은꼴 형용사', { need: 'adj' }),
    D('Customers choose our delivery service because it is fast and ___.', ['reliance', 'reliable', 'reliant', 'reliably'], 1, 'a ___ service', 'delivery service', '설명 받는 주어', '배달이 빠르고 믿을 만해서 손님들이 우리 배달 서비스를 골라요.', '61 닮은꼴 형용사', { need: 'adj' }),
    D('The heads of the two divisions will present their ___ budgets at the meeting.', ['respectful', 'respectively', 'respective', 'respect'], 2, 'their ___ + 명사', ['their', 'budgets'], '앞뒤의 소유격 + 명사', '두 사업부 책임자가 회의에서 각자의 예산을 발표해요.', '61 닮은꼴 형용사', { need: 'adj' }),
    D('___ 300 guests are expected at the awards dinner.', ['Highly', 'Shortly', 'Closely', 'Approximately'], 3, '___ + 숫자', '300 guests', '뒤의 숫자', '시상식 만찬에 약 300명의 손님이 올 것으로 보여요.', '62 부사 · 숫자 앞', { need: 'adv' }),
    D('Ms. Rivera is ___ regarded as an expert in international law.', ['highly', 'approximately', 'shortly', 'promptly'], 0, '___ regarded', 'regarded', '뒤의 분사', '리베라 씨는 국제법 전문가로 높이 평가받아요.', '62 부사 · highly', { need: 'adv' }),
    D('Please reply ___ so that we can hold your seat.', ['approximately', 'promptly', 'highly', 'mostly'], 1, 'reply ___', 'reply', '앞의 동사', '자리를 맡아 둘 수 있게 빨리 답해 주세요.', '62 부사 · promptly', { need: 'adv' }),
    D('The company plans to ___ the price of its premium membership next year.', ['raise', 'rise', 'arise', 'lie'], 0, '___ prices', 'the price', '뒤의 목적어', '회사는 내년에 프리미엄 회원권 가격을 올릴 계획이에요.', '63 헷갈리는 동사 · rise / raise', { pat: 'obj', mean: 'up', scue: ['the price'] }),
    D('Ms. Lee ___ the staff that the office would close early on Friday.', ['said', 'spoke', 'told', 'talked'], 2, PAT['person+that'].en, 'the staff that', '뒤의 사람 + that', '이 씨는 직원들에게 금요일에 사무실이 일찍 문을 닫는다고 알렸어요.', '63 헷갈리는 동사 · say / tell', { pat: 'person+that', mean: 'say', scue: ['the staff'] }),
    D('Could you ___ me to call the supplier before noon?', ['remember', 'recall', 'memorize', 'remind'], 3, PAT['person+to'].en, 'me to call', '뒤의 사람 + to', '정오 전에 공급업체에 전화하라고 저에게 다시 알려 주시겠어요?', '63 헷갈리는 동사 · remind / remember', { pat: 'person+to', mean: 'memory', scue: ['me'] }),
  ];
  VC.judgeOpt = (it, k) => VC.judge(it.opts[k], it);
  // 보기 이름을 앞에 따로 보여 줄 때: 까닭의 맨 앞 ‘낱말 →’는 빼고
  VC.noteText = (w, why) => why.startsWith(VC.show(w) + ' → ') ? why.slice(VC.show(w).length + 3) : why;

  // 3단계 풀이 (연습 문제 힌트 · 영상 실전 문제). ① 짝 찾기 ② 짝 맞추기 ③ 함정 확인
  VC.steps = function (it) {
    const ans = it.opts[it.a], L = VC.entry(ans), J = it.opts.map(o => VC.judge(o, it));
    const of = (kind, step) => it.opts.filter((o, k) => k !== it.a && J[k].s === 'no' && (kind ? J[k].kind === kind : J[k].step === step)).map(VC.show);
    const pair = of('pair'), mean = of('mean'), pos = of('pos'), pat = of('pat'), dir = of('dir'), look = of('look');
    const gloss = L.friends[it.key];
    const t2 = [pair.length ? `짝이 맞지 않는 보기: ${pair.join(' · ')}.` : '', mean.length ? `뜻이 다른 보기: ${mean.join(' · ')}.` : ''].filter(Boolean).join(' ');
    const t3 = [
      look.map(w => `${w} → ${VC.entry(w).ko}, 꼬리만 다른 닮은꼴.`).join(' '),
      pos.length ? `${pos.join(' · ')} → 품사가 달라요 (${pos.map(w => POS[VC.entry(w).pos]).join(' · ')}).` : '',
      pat.length ? `구조: ${PAT[it.pat].ko}. ${pat.join(' · ')} → ${it.pat === 'obj' ? '목적어를 못 가지는 자동사예요' : it.pat === 'intr' ? '목적어가 꼭 필요한 타동사예요' : '이 구조로 쓰지 않아요'}.` : '',
      dir.length ? `${dir.join(' · ')} → 빌리는 방향이 반대예요.` : '',
    ].filter(Boolean).join(' ');
    return [
      { head: '① 짝 찾기.', text: `빈칸 = ${POS[it.need]} 자리 → 짝은 ${it.role} ‘${it.cue.join(' … ')}’.`, marks: it.cue.map(t => ({ t, role: 'ante' })) },
      { head: '② 짝 맞추기.', text: `${VC.phrase(ans, it.key)} = ${gloss}.` + (t2 ? ' ' + t2 : ' 남은 보기는 ③에서 확인해요.'), marks: [] },
      { head: '③ 함정 확인.', text: (t3 || '모양이 비슷한 함정은 없어요.') + ` 정답 → ${VC.show(ans)}.`, marks: (it.scue || []).map(t => ({ t, role: 'cue' })) },
    ];
  };
  VC.drillItems = () => VC.DRILL.map(it => ({
    q: it.q, opts: it.opts.map(VC.show), a: it.a, ko: it.ko, tag: it.tag, steps: VC.steps(it),
    notes: it.opts.map(o => { const j = VC.judge(o, it); return (j.s === 'ok' ? '' : '× ') + VC.noteText(o, j.why); }),
  }));

  /* ---------- 영상과 직접 해 보기에서 쓰는 예 ---------- */
  VC.INTRO = Object.assign({ a: 0, role: '뒤의 목적어', ko: CARDS[0].ko }, CARDS[0], { opts: CARDS[0].opts.slice() });
  // 01장: 한국어 ‘하다’ 하나 ↔ 영어의 여러 짝 동사
  VC.KO = [
    { ko: ['회의를', '하다'], v: 'hold', n: 'a meeting', key: '___ a meeting' },
    { ko: ['조사를', '하다'], v: 'conduct', n: 'a survey', key: '___ a survey' },
    { ko: ['결정을', '하다'], v: 'make', n: 'a decision', key: '___ a decision' },
    { ko: ['발표를', '하다'], v: 'give', n: 'a presentation', key: '___ a presentation' },
    { ko: ['주문을', '하다'], v: 'place', n: 'an order', key: '___ an order' },
  ];
  // 둘 가운데 고르기 (직접 해 보기). 보기의 첫째가 정답, 화면에는 섞어서 보여 줌
  const S2 = (q, opts, key, x) => Object.assign({ q, opts, key }, x || {});
  VC.SORT = {
    korean: [
      S2('결정을 하다 → ___ a decision', ['make', 'do'], '___ a decision', { need: 'v' }),
      S2('실수를 하다 → ___ a mistake', ['make', 'do'], '___ a mistake', { need: 'v' }),
      S2('거래를 하다 → ___ business', ['do', 'make'], '___ business', { need: 'v' }),
    ],
    verbs: [
      S2('We must ___ the deadline.', ['meet', 'attend'], '___ a deadline', { need: 'v' }),
      S2('The new rule will ___ effect today.', ['take', 'make'], '___ effect', { need: 'v' }),
      S2('The shop is closed until further ___.', ['notice', 'note'], 'until further ___', { need: 'n' }),
      S2('Sorry, this size is out of ___.', ['stock', 'order'], 'out of ___ (재고)', { need: 'n' }),
      S2('Who is in ___ of the project?', ['charge', 'duty'], 'in ___ of (맡음)', { need: 'n' }),
      S2('You can ___ an order online.', ['place', 'attend'], '___ an order', { need: 'v' }),
    ],
    advs: [
      S2('She works very ___.', ['hard', 'hardly'], 'work ___', { need: 'adv' }),
      S2('I can ___ hear you.', ['hardly', 'hard'], 'can · could ___', { need: 'adv' }),
      S2('___ 50 people came to the event.', ['Approximately', 'Highly'], '___ + 숫자', { need: 'adv' }),
      S2('She is ___ qualified for the job.', ['highly', 'approximately'], '___ qualified', { need: 'adv' }),
      S2('He left ___ after lunch.', ['shortly', 'highly'], '___ after', { need: 'adv' }),
      S2('The guests were ___ students.', ['mostly', 'most'], 'be ___ (주로)', { need: 'adv' }),
    ],
    confv: [
      S2('Prices ___ every year.', ['rise', 'raise'], 'prices ___', { need: 'v', pat: 'intr', mean: 'up' }),
      S2('They ___ prices every year.', ['raise', 'rise'], '___ prices', { need: 'v', pat: 'obj', mean: 'up' }),
      S2('She ___ me the news.', ['told', 'said'], PAT['person+thing'].en, { need: 'v', pat: 'person+thing', mean: 'say' }),
      S2('Please ___ me to call him.', ['remind', 'remember'], PAT['person+to'].en, { need: 'v', pat: 'person+to', mean: 'memory' }),
      S2('Can I ___ your umbrella?', ['borrow', 'lend'], '___ + 물건 (+ from)', { need: 'v', dir: 'in', mean: 'loan' }),
      S2('The rain may ___ the game.', ['affect', 'effect'], '___ + 대상 (영향)', { need: 'v', pat: 'obj', mean: 'influence' }),
    ],
  };
  // 04장: 닮은꼴 형용사 여섯 쌍. 쌍마다 두 짝 (a의 짝, b의 짝)
  VC.ADJ_PAIRS = [
    { a: 'considerable', b: 'considerate', pa: ['amount'], pb: ['of', 'others'], ta: 'able', tb: 'ate', fa: { q: 'a ___ amount of time', key: 'a ___ amount', need: 'adj' }, fb: { q: 'be ___ of others', key: 'be ___ of (사람)', need: 'adj' } },
    { a: 'reliable', b: 'reliant', pa: ['supplier'], pb: ['on'], ta: 'able', tb: 'ant', fa: { q: 'a ___ supplier', key: 'a ___ supplier', need: 'adj' }, fb: { q: 'be ___ on tourism', key: 'be ___ on', need: 'adj' } },
    { a: 'economic', b: 'economical', pa: ['growth'], pb: ['car'], ta: 'ic', tb: 'ical', fa: { q: '___ growth', key: '___ growth', need: 'adj' }, fb: { q: 'a more ___ car (less fuel)', key: 'more ___ (절약)', need: 'adj' } },
    { a: 'successful', b: 'successive', pa: ['candidate'], pb: ['years'], ta: 'ful', tb: 'ive', fa: { q: 'the ___ candidate', key: 'the ___ candidate', need: 'adj' }, fb: { q: 'lost money for two ___ years', key: 'for two ___ years', need: 'adj' } },
    { a: 'comprehensive', b: 'comprehensible', pa: ['coverage'], pb: ['easily'], ta: 'ive', tb: 'ible', fa: { q: '___ coverage of all procedures', key: '___ coverage', need: 'adj' }, fb: { q: 'easily ___ to beginners', key: 'easily ___', need: 'adj' } },
    { a: 'respective', b: 'respectful', pa: ['their', 'offices'], pb: ['of', 'guests'], ta: 'ive', tb: 'ful', fa: { q: 'their ___ offices', key: 'their ___ + 명사', need: 'adj' }, fb: { q: 'be ___ of other guests', key: 'be ___ of (사람)', need: 'adj' } },
  ];
  // 짝 판정기 (07장 직접 해 보기): 59 동사 열 개 × 목적어 열 개
  VC.PROBE = {
    verbs: ['conduct', 'implement', 'meet', 'address', 'submit', 'attend', 'reserve', 'earn', 'make', 'attract'],
    keys: ['___ a survey', '___ a plan', '___ a deadline', '___ an issue', '___ a proposal', '___ a meeting', '___ a table', '___ money', '___ a decision', '___ customers'],
  };

  // 데이터 점검: 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, 판정 못 하는 보기(?)가 없는지, 짝 글자가 문장에 있는지, 정답 위치가 고르게 섞였는지
  VC.check = function () {
    const bad = [];
    const one = (label, fr, opts, a) => {
      const J = opts.map(o => VC.judge(o, fr));
      J.forEach((j, k) => { if (j.s === '?') bad.push(`${label}: 보기 ${VC.show(opts[k])}를 판정할 수 없어요 (${j.why})`); });
      const good = J.map((j, k) => j.s === 'ok' ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== a) bad.push(`${label}: 정답 ${a}, 규칙 엔진 ${JSON.stringify(good)}`);
    };
    CARDS.forEach(c => {
      one(`짝 카드 ${c.id}`, c, c.opts, 0);
      c.cue.forEach(t => { if (!c.q.includes(t)) bad.push(`짝 카드 ${c.id}: 짝 ‘${t}’가 문장에 없어요`); });
      if (!c.short.includes('___') || !c.q.includes('___')) bad.push(`짝 카드 ${c.id}: 빈칸이 없어요`);
      if (!VC.TYPES[c.type]) bad.push(`짝 카드 ${c.id}: 유형 번호가 이상해요`);
    });
    if (new Set(CARDS.map(c => c.q)).size !== CARDS.length) bad.push('짝 카드에 같은 문장이 있어요');
    VC.DRILL.forEach((it, i) => {
      one(`연습 문제 ${i + 1}`, it, it.opts, it.a);
      it.cue.concat(it.scue || []).forEach(t => { if (!it.q.includes(t)) bad.push(`연습 문제 ${i + 1}: 단서 ‘${t}’가 문장에 없어요`); });
      if (CARDS.some(c => c.q === it.q)) bad.push(`연습 문제 ${i + 1}: 짝 카드와 문장이 같아요`);
    });
    const pos = [0, 0, 0, 0]; VC.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 1) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    Object.entries(VC.SORT).forEach(([k, list]) => list.forEach((it, i) => one(`직접 해 보기 ${k} ${i + 1}`, it, it.opts, 0)));
    VC.ADJ_PAIRS.forEach((p, i) => { one(`형용사 쌍 ${i + 1}a`, p.fa, [p.a, p.b], 0); one(`형용사 쌍 ${i + 1}b`, p.fb, [p.b, p.a], 0); });
    VC.KO.forEach((r, i) => { if (VC.judgePair(r.v, r.key).s !== 'ok') bad.push(`01장 ${i + 1}: ${r.v}의 짝이 사전에 없어요`); });
    // 사전 자체: 같은 짝에 ✓와 ×가 함께 있으면 안 됨, 짝 열쇠에는 ___가 있어야 함
    Object.entries(KEY).forEach(([key, K]) => K.no.forEach(w => {
      if (!LEX[w]) bad.push(`짝 ‘${key}’: × 목록의 ${w}가 사전에 없어요`);
      else if (LEX[w].friends[key]) bad.push(`짝 ‘${key}’: ${w}가 ✓이면서 ×예요`);
    }));
    Object.values(LEX).forEach(L => Object.keys(L.friends).forEach(k => { if (!k.includes('___')) bad.push(`${L.w}: 짝 열쇠 ‘${k}’에 ___가 없어요`); }));
    if (CARDS.length < 80) bad.push(`짝 카드가 ${CARDS.length}장뿐이에요 (80장 이상)`);
    bad.forEach(b => console.warn('[어휘 · 짝] ' + b));
    return bad;
  };
})();
