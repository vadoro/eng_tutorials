/* Part 7 독해 튜토리얼 — 규칙 엔진과 지문
 *
 * 지문 세트(R7.SETS)는 글(R7.DOCS) 하나 · 둘 · 셋과 문제로 이루어집니다.
 *   글의 단위(unit): 문장(이메일 · 공지 · 광고 …), 메시지(문자 · 채팅), 줄(양식 · 표). 머리말은 단위 -1.
 *   [1]~[4]는 문장 삽입 자리 표시예요(단위 하나를 차지함).
 * 문제마다 데이터에 적어 두는 것
 *   type(문제 유형) · key(질문의 키워드) · ev(근거: 몇 번째 글의 몇 번째 단위, 근거 글자)
 *   보기마다 rel(근거와의 관계) · src(그 보기의 말이 나온 곳) · pairs(바꿔 말한 짝) · why · ko
 *     match 바꿔 말함(정답) · same 그대로 반복(같은 낱말, 다른 뜻) · none 지문에 없음 · contra 반대
 *     off 질문과 다른 내용 · who 다른 사람 · 대상 · when 다른 때 · doc 다른 글(옛 정보) · cell 다른 줄 · 칸
 *     literal 말 그대로의 뜻(의도 파악) · dict 사전 첫 뜻 · sense 다른 문맥의 뜻(동의어) · stated 지문에 있음(NOT 문제)
 *     문장 삽입은 보기 [1]~[4]를 엔진이 만들고, 넣을 문장의 가리키는 말이 앞 문장에서 짝을 찾는지로 fit · nopair를 정해요.
 *
 * R7.judge(문제, 보기)는 3단계 풀이법을 그대로 따라 맞고 틀림, 지워지는 단계, 까닭을 정합니다.
 *   ① 질문 먼저: 문제 유형과 키워드 → 어디를 볼지
 *   ② 근거 찾기: 근거 문장을 찾으면, 근거가 아닌 곳(다른 사람 · 다른 때 · 다른 글 · 다른 칸 · 질문과 다른 내용)에서 온 보기가 지워져요
 *   ③ 바꿔 말한 보기: 근거와 견줘 그대로 반복 · 지문에 없음 · 반대 · 말 그대로 · 사전 첫 뜻을 지우고, 같은 뜻을 다른 말로 한 보기를 골라요
 * 그대로 반복한 낱말(R7.echo)은 엔진이 보기와 지문의 낱말을 견줘 계산해요.
 * 영상의 ✓ · ×, 직접 해 보기, 놀이터 '근거 사냥', 연습 문제의 힌트와 보기별 해설, 퀴즈 일부가 모두 이 함수의 결과를 씁니다.
 * R7.check()는 데이터가 엔진과 어긋나면 콘솔에 경고합니다.
 */
(function () {
  'use strict';
  const R7 = (window.R7 = {});
  const L4 = 'ABCD';

  /* ---------- 문제 유형 (docs/toeic-100-types.md의 89–100) ---------- */
  R7.TYPE = {
    purpose: { name: '주제 · 목적', no: 89, where: '목적은 대개 첫 문단에 있어요(I am writing to … · I would like to …).', look: '첫 문단' },
    detail: { name: '세부 정보', no: 90, where: '질문의 키워드(날짜 · 숫자 · 이름 · 조건)를 지문에서 훑어 찾아요. 키워드도 바꿔 말해져 있을 수 있어요.', look: '키워드' },
    true: { name: '사실 확인', no: 91, where: '질문이 묻는 대상이 나오는 문장을 찾아 보기와 맞춰 봐요.', look: '대상이 나오는 문장' },
    not: { name: 'NOT', no: 91, where: '보기 넷을 하나씩 지문과 맞춰 봐요. 지문에서 찾을 수 없는 하나가 답이에요.', look: '보기마다' },
    infer: { name: '추론', no: 92, where: '답이 그대로 쓰여 있지 않아요. 단서가 되는 문장을 찾아 짐작해요.', look: '단서' },
    synonym: { name: '동의어', no: 93, where: '그 낱말이 있는 문장을 읽고, 사전 뜻이 아니라 문장 속 뜻을 골라요.', look: '그 낱말이 있는 문장' },
    request: { name: '요청 · 지시', no: 95, where: 'please · Could you · I would like you to 뒤를 봐요.', look: 'please 문장' },
    insert: { name: '문장 삽입', no: 96, where: '넣을 문장의 가리키는 말(this · that · these)을 찾고, [1]~[4] 앞 문장에서 짝을 찾아요.', look: '[1]~[4] 앞 문장' },
    intent: { name: '의도 파악', no: 97, where: '인용한 말의 바로 앞 메시지를 봐요. 그 말은 앞 메시지에 대한 대답이에요.', look: '바로 앞 메시지' },
    form: { name: '양식 · 표', no: 98, where: '표 전체를 읽지 말고 질문에 맞는 줄과 칸만 찾아요.', look: '줄 × 칸' },
    double: { name: '이중 지문 연계', no: 99, where: '두 글에서 단서를 하나씩 찾아 이어요.', look: '두 글' },
    triple: { name: '삼중 지문 연계', no: 100, where: '세 글 가운데 어느 글에 무엇이 있는지 찾아 이어요.', look: '세 글' },
  };
  R7.STEP = ['① 질문 먼저', '② 근거 찾기', '③ 바꿔 말한 보기'];
  // 보기와 근거의 관계. step: 몇 단계에서 지워지나
  R7.REL = {
    match: { name: '바꿔 말함', step: 3 },
    fit: { name: '짝이 맞음', step: 3 },
    stated: { name: '지문에 있음', step: 2 },
    same: { name: '그대로 반복', step: 3 },
    none: { name: '지문에 없음', step: 3 },
    contra: { name: '반대', step: 3 },
    literal: { name: '말 그대로', step: 3 },
    dict: { name: '사전 첫 뜻', step: 3 },
    sense: { name: '다른 문맥의 뜻', step: 3 },
    off: { name: '질문과 다른 내용', step: 2 },
    who: { name: '다른 사람 · 대상', step: 2 },
    when: { name: '다른 때', step: 2 },
    doc: { name: '다른 글 · 옛 정보', step: 2 },
    cell: { name: '다른 줄 · 칸', step: 2 },
    nopair: { name: '짝 없음', step: 2 },
  };
  // 문장 삽입: 가리키는 말이 찾는 것
  R7.NEED = { panel: '제어판', technician: '기술자', elevator: '엘리베이터', stairs: '계단', time: '끝나는 시각', delivery: '배송', photos: '사진', issue: '잡지의 호', editors: '편집자', payment: '원고료', files: '파일', cafe: '카페', menu: '메뉴', offer: '할인 · 무료 혜택', ideas: '의견' };

  /* ---------- 글 ----------
   * kind: email · notice · ad · web · chat · form.  en: 지시문에 쓰는 영어 이름.  head: 머리말 줄
   * 문장 글: sents · par(문단 번호) · ko.  채팅: msgs [{ who, time, t }] · ko.  양식: cols(없으면 머리줄 없음) · rows · foot · ko(줄 → 아래 글 순서)
   */
  const D = (R7.DOCS = {});
  const doc = (id, o) => { D[id] = Object.assign({ id, head: [] }, o); };

  /* 영상 · 놀이터 */
  doc('hotel', { kind: 'email', en: 'e-mail', label: '이메일',
    head: ['From: Mia Torres, Harborview Inn', 'To: Daniel Cho', 'Date: March 3', 'Subject: Your reservation request'],
    sents: [
      'Thank you for your interest in the Harborview Inn.',
      'Unfortunately, all of our rooms are fully booked on March 14 because of the city marathon.',
      'However, our sister hotel, the Bayside Lodge, still has a few rooms left that night.',
      'It is a ten-minute walk from the marathon’s starting line.',
      'I would be happy to reserve a room there for you at the same rate.',
      'Please reply by March 6 so that we can hold the room.',
    ], par: [0, 0, 1, 1, 1, 2],
    ko: ['하버뷰 인에 관심을 가져 주셔서 고마워요.', '아쉽게도 시 마라톤 때문에 3월 14일에는 방이 모두 예약됐어요.', '하지만 자매 호텔인 베이사이드 로지에는 그날 밤 방이 아직 몇 개 남아 있어요.',
      '그 호텔은 마라톤 출발선에서 걸어서 10분 거리예요.', '원하시면 같은 요금으로 그곳에 방을 예약해 드릴게요.', '방을 잡아 둘 수 있게 3월 6일까지 답장해 주세요.'] });
  doc('elevator', { kind: 'email', en: 'e-mail', label: '이메일',
    head: ['From: Grace Lim, Facilities Office', 'To: All staff', 'Date: May 2', 'Subject: Elevator maintenance'],
    sents: [
      'I am writing to let you know that the east elevator will be out of service on Thursday, May 8.',
      'A technician will replace its control panel that day.',
      '[1]',
      'During the work, please use the west elevator or the stairs.',
      '[2]',
      'The work should be finished by 5 P.M.',
      '[3]',
      'If you are expecting a large delivery on Thursday, please contact me by Tuesday.',
      '[4]',
      'I will ask the delivery company to come on another day.',
    ], par: [0, 0, 0, 1, 1, 1, 1, 2, 2, 2],
    ko: ['5월 8일 목요일에 동쪽 엘리베이터를 쓸 수 없다는 것을 알려 드리려고 이 이메일을 써요.', '그날 기술자가 엘리베이터의 제어판을 바꿀 거예요.', '',
      '작업하는 동안 서쪽 엘리베이터나 계단을 이용해 주세요.', '', '작업은 오후 5시까지 끝날 거예요.', '',
      '목요일에 큰 배송을 받을 예정이면 화요일까지 저에게 연락해 주세요.', '', '배송 회사에 다른 날 오라고 부탁할게요.'] });
  doc('library', { kind: 'notice', en: 'notice', label: '공지',
    head: ['RIDGEWAY PUBLIC LIBRARY', 'Notice · Posted: July 1'],
    sents: [
      'The Ridgeway Public Library will hold its annual book sale from July 18 to July 20.',
      'More than 5,000 used books will be available, most for under $2.',
      'Library members may enter one hour early, at 9 A.M., on the first day.',
      'All other visitors are welcome from 10 A.M.',
      'Payment can be made in cash or by credit card.',
      'All money raised will go toward new computers for the children’s room.',
    ], par: [0, 0, 1, 1, 2, 2],
    ko: ['리지웨이 공공 도서관이 7월 18일부터 20일까지 해마다 여는 책 판매 행사를 열어요.', '중고 책이 5,000권 넘게 나오고, 대부분 2달러가 안 돼요.', '도서관 회원은 첫날 한 시간 일찍, 오전 9시에 들어올 수 있어요.',
      '다른 방문객은 모두 오전 10시부터 환영해요.', '돈은 현금이나 신용카드로 낼 수 있어요.', '모은 돈은 모두 어린이 열람실의 새 컴퓨터에 써요.'] });
  doc('invoice', { kind: 'form', en: 'invoice', label: '청구서',
    head: ['FRESH PRINT CO. · INVOICE', 'Customer: Lakeview Dental Clinic · Date: April 2'],
    cols: ['Item', 'Quantity', 'Price'],
    rows: [['Business cards', '500', '$40'], ['Appointment cards', '1,000', '$65'], ['Window posters', '2', '$30']],
    foot: ['Total: $135', 'Payment due: April 30', 'Pay by April 15 and save 5%.'],
    ko: ['명함 · 500장 · 40달러', '예약 카드 · 1,000장 · 65달러', '창문 포스터 · 2장 · 30달러', '합계: 135달러', '낼 날: 4월 30일까지', '4월 15일까지 내면 5%를 아껴요.'] });
  doc('chat', { kind: 'chat', en: 'text-message chain', label: '문자 메시지',
    msgs: [
      { who: 'Jisoo Park', time: '10:12 A.M.', t: 'The projector in Room 3 won’t turn on, and my client arrives at 11.' },
      { who: 'Ben Carter', time: '10:13 A.M.', t: 'Is the cable plugged in? It came loose last week.' },
      { who: 'Jisoo Park', time: '10:14 A.M.', t: 'I checked. That’s not it.' },
      { who: 'Ben Carter', time: '10:15 A.M.', t: 'OK. I have a spare projector in my office. I’ll bring it over now.' },
      { who: 'Jisoo Park', time: '10:16 A.M.', t: 'You’re a lifesaver!' },
    ],
    ko: ['3번 회의실 프로젝터가 안 켜져요. 손님이 11시에 와요.', '케이블은 꽂혀 있어요? 지난주에 헐거워졌거든요.', '확인했어요. 그게 문제가 아니에요.', '알겠어요. 제 사무실에 여분 프로젝터가 있어요. 지금 가져갈게요.', '덕분에 살았어요!'] });
  doc('caterAd', { kind: 'ad', en: 'advertisement', label: '광고',
    head: ['GREENLEAF CATERING', 'Office Lunch Packages'],
    sents: [
      'Let Greenleaf Catering take care of your next office lunch!',
      'Our Basic package includes sandwiches and a salad for $12 per person.',
      'Our Deluxe package adds a hot dish and dessert for $18 per person.',
      'Delivery is free for orders of 30 people or more.',
    ], par: [0, 1, 1, 2],
    ko: ['다음 사무실 점심은 그린리프 케이터링에 맡기세요!', '베이식 상품은 샌드위치와 샐러드, 한 사람에 12달러예요.', '디럭스 상품은 따뜻한 요리와 디저트를 더해 한 사람에 18달러예요.', '30명 이상 주문하면 배달은 무료예요.'] });
  doc('caterMail', { kind: 'email', en: 'e-mail', label: '이메일',
    head: ['From: Owen Reyes', 'To: Greenleaf Catering', 'Date: June 2', 'Subject: Lunch order'],
    sents: [
      'I would like to order your Deluxe package for our staff meeting on June 9.',
      'There will be 25 of us.',
      'Could you deliver the food to our office by 11:30 A.M.?',
    ], par: [0, 0, 1],
    ko: ['6월 9일 직원 회의에 디럭스 상품을 주문하고 싶어요.', '우리는 25명이에요.', '오전 11시 30분까지 사무실로 음식을 배달해 줄 수 있나요?'] });
  doc('wsSched', { kind: 'form', en: 'schedule', label: '일정표',
    head: ['HANLEY BUSINESS CENTER', 'Workshop Schedule · Saturday, October 11'],
    cols: ['Time', 'Workshop', 'Room'],
    rows: [['9:00 A.M.', 'Writing Clear E-mails', 'Room B'], ['11:00 A.M.', 'Leading Short Meetings', 'Room A'], ['2:00 P.M.', 'Presenting with Data', 'Room C']],
    foot: [],
    ko: ['오전 9시 · 알기 쉬운 이메일 쓰기 · B실', '오전 11시 · 짧은 회의 이끌기 · A실', '오후 2시 · 자료로 발표하기 · C실'] });
  doc('wsMail', { kind: 'email', en: 'e-mail', label: '이메일',
    head: ['From: Hanley Business Center', 'To: Workshop participants', 'Date: October 8', 'Subject: Room change'],
    sents: [
      'Room B will be painted on October 11.',
      'The workshop planned for that room will be held in Room D instead.',
      'All other workshops will take place as scheduled.',
    ], par: [0, 0, 1],
    ko: ['10월 11일에 B실을 칠할 거예요.', '그 방에서 열려던 워크숍은 대신 D실에서 열려요.', '다른 워크숍은 모두 일정대로 열려요.'] });
  doc('wsForm', { kind: 'form', en: 'form', label: '신청서',
    head: ['REGISTRATION FORM'],
    cols: null,
    rows: [['Name', 'Nora Bell'], ['Company', 'Pinecrest Logistics'], ['Workshop', 'Writing Clear E-mails'], ['Payment', 'By credit card']],
    foot: [],
    ko: ['이름 · 노라 벨', '회사 · 파인크레스트 물류', '워크숍 · 알기 쉬운 이메일 쓰기', '낸 방법 · 신용카드'] });
  doc('bikeAd', { kind: 'ad', en: 'advertisement', label: '광고',
    head: ['BRIGHTWAY BIKE RENTALS', 'Lakeside Park · Open every day'],
    sents: [
      'Explore Lakeside Park on two wheels!',
      'Regular bikes cost $10 per hour, and electric bikes cost $18 per hour.',
      'Groups of five or more receive 20 percent off.',
      'Helmets are provided at no extra charge.',
    ], par: [0, 1, 1, 2],
    ko: ['두 바퀴로 레이크사이드 공원을 둘러보세요!', '일반 자전거는 한 시간에 10달러, 전기 자전거는 한 시간에 18달러예요.', '다섯 명 이상 단체는 20퍼센트 할인을 받아요.', '헬멧은 추가 요금 없이 드려요.'] });
  doc('bikeMail', { kind: 'email', en: 'e-mail', label: '이메일',
    head: ['From: Hyejin Song', 'To: Brightway Bike Rentals', 'Date: September 15', 'Subject: Group rental'],
    sents: [
      'I am planning a team outing for my department on Saturday, September 20.',
      'Six of us would like to rent electric bikes for two hours, starting at 10 A.M.',
      'Could you tell me whether we need to bring our own helmets?',
    ], par: [0, 0, 1],
    ko: ['9월 20일 토요일에 우리 부서의 팀 나들이를 계획하고 있어요.', '우리 여섯 명이 오전 10시부터 두 시간 동안 전기 자전거를 빌리고 싶어요.', '헬멧을 따로 가져가야 하는지 알려 주실 수 있나요?'] });

  /* 연습 문제 */
  doc('mag', { kind: 'email', en: 'e-mail', label: '이메일',
    head: ['From: Rachel Moon, Coastline Travel Magazine', 'To: Victor Hale', 'Date: February 10', 'Subject: Your photographs'],
    sents: [
      'Thank you for sending us your photographs of the Jeju coast.',
      '[1]',
      'Our editors were very impressed, and we would like to feature three of them in our April issue.',
      '[2]',
      'We will pay $150 for each photo, as stated in our standard agreement.',
      '[3]',
      'Before we can print them, however, we need the original files in high resolution.',
      'Please upload them to our shared folder by February 20.',
      '[4]',
      'I have also attached a short form that asks how your name should appear.',
    ], par: [0, 0, 0, 0, 1, 1, 1, 2, 2, 2],
    ko: ['제주 해안 사진을 보내 주셔서 고마워요.', '', '편집자들이 아주 감동했고, 그 가운데 세 장을 4월호에 싣고 싶어요.', '', '기본 계약서에 적힌 대로 사진 한 장에 150달러를 드릴게요.', '',
      '하지만 인쇄하기 전에 해상도가 높은 원본 파일이 필요해요.', '2월 20일까지 공유 폴더에 올려 주세요.', '', '이름을 어떻게 적을지 묻는 짧은 양식도 첨부했어요.'] });
  doc('store', { kind: 'chat', en: 'text-message chain', label: '문자 메시지',
    msgs: [
      { who: 'Minho Kang', time: '2:05 P.M.', t: 'Elena, are you still at the warehouse?' },
      { who: 'Elena Diaz', time: '2:06 P.M.', t: 'Yes, I’m loading the boxes for the Oak Street store now.' },
      { who: 'Minho Kang', time: '2:07 P.M.', t: 'Great. Could you add ten more cases of bottled water? We sold out this morning.' },
      { who: 'Elena Diaz', time: '2:09 P.M.', t: 'I’ll see what I can do. The truck is almost full.' },
      { who: 'Minho Kang', time: '2:10 P.M.', t: 'Thanks. If there’s no room, bring them tomorrow.' },
      { who: 'Elena Diaz', time: '2:12 P.M.', t: 'Done! I made space next to the paper towels.' },
    ],
    ko: ['엘레나, 아직 창고에 있어요?', '네, 지금 오크 스트리트 매장으로 갈 상자를 싣고 있어요.', '좋아요. 생수 열 상자를 더 실어 줄 수 있어요? 오늘 아침에 다 팔렸어요.', '어떻게든 해 볼게요. 트럭이 거의 꽉 찼어요.', '고마워요. 자리가 없으면 내일 가져와요.', '됐어요! 종이 타월 옆에 자리를 만들었어요.'] });
  doc('classes', { kind: 'form', en: 'schedule', label: '강좌 안내',
    head: ['MAPLE HILL COMMUNITY CENTER', 'Fall Classes'],
    cols: ['Class', 'Day', 'Time', 'Fee'],
    rows: [['Beginner Yoga', 'Monday', '7:00 P.M.', '$60'], ['Watercolor Painting', 'Wednesday', '6:30 P.M.', '$85'], ['Basic Spanish', 'Thursday', '7:30 P.M.', '$70'], ['Home Cooking', 'Saturday', '10:00 A.M.', '$95']],
    foot: ['All classes run for eight weeks, starting September 8.', 'Center members receive 10% off any class fee.', 'Materials for the painting and cooking classes are included in the fee.'],
    ko: ['초급 요가 · 월요일 · 오후 7시 · 60달러', '수채화 · 수요일 · 오후 6시 30분 · 85달러', '기초 스페인어 · 목요일 · 오후 7시 30분 · 70달러', '집밥 요리 · 토요일 · 오전 10시 · 95달러',
      '모든 강좌는 9월 8일부터 8주 동안 열려요.', '센터 회원은 어느 강좌든 수강료를 10% 할인받아요.', '그림 · 요리 강좌의 재료비는 수강료에 들어 있어요.'] });
  doc('confWeb', { kind: 'web', en: 'Web page', label: '웹 페이지',
    head: ['www.northfielddesign.org/register', 'Northfield Design Conference'],
    sents: [
      'The Northfield Design Conference will take place at Riverside Hall on November 14 and 15.',
      'Early registration costs $120 and is available until October 31.',
      'After that date, the price will rise to $160.',
      'Students with a valid ID may attend both days for $60.',
    ], par: [0, 1, 1, 2],
    ko: ['노스필드 디자인 콘퍼런스는 11월 14일과 15일에 리버사이드 홀에서 열려요.', '조기 등록은 120달러이고 10월 31일까지 할 수 있어요.', '그날이 지나면 값이 160달러로 올라요.', '유효한 학생증이 있는 학생은 이틀 모두 60달러에 참가할 수 있어요.'] });
  doc('confMail', { kind: 'email', en: 'e-mail', label: '이메일',
    head: ['From: Paula Grant', 'To: Northfield Design Conference', 'Date: November 3', 'Subject: Registration question'],
    sents: [
      'I am a graphic designer at Bloom Studio, and I would like to attend your conference.',
      'Unfortunately, I missed the early registration deadline because I was traveling for work.',
      'Would it still be possible to pay the lower rate?',
      'If not, I will register at the regular price this week.',
    ], par: [0, 0, 1, 1],
    ko: ['저는 블룸 스튜디오의 그래픽 디자이너이고, 콘퍼런스에 참가하고 싶어요.', '아쉽게도 출장 중이라 조기 등록 마감을 놓쳤어요.', '그래도 낮은 값으로 낼 수 있을까요?', '안 된다면 이번 주에 정상 가격으로 등록할게요.'] });
  doc('deskWeb', { kind: 'form', en: 'Web page', label: '웹 페이지',
    head: ['STANTON FURNITURE · Delivery Options'],
    cols: ['Option', 'Arrives in', 'Fee'],
    rows: [['Standard', '5–7 business days', 'Free'], ['Express', '2 business days', '$40'], ['Same Day', 'Same day (order by noon)', '$75']],
    foot: ['If an Express or Same Day order arrives late, we will refund the delivery fee.'],
    ko: ['보통 · 영업일 5~7일 · 무료', '빠른 배송 · 영업일 2일 · 40달러', '당일 배송 · 당일(정오까지 주문) · 75달러', '빠른 배송이나 당일 배송 주문이 늦게 도착하면 배송비를 돌려드려요.'] });
  doc('deskMail', { kind: 'email', en: 'e-mail', label: '이메일',
    head: ['From: Kevin Shaw', 'To: Stanton Furniture Customer Service', 'Date: March 12', 'Subject: Order #2215'],
    sents: [
      'I am writing about the office desk I ordered on March 9.',
      'I paid extra for Express delivery, and your Web site said the desk would arrive by March 11.',
      'I need it for my new office, which opens on March 13.',
      'However, it still has not arrived, and no one has contacted me.',
      'Please let me know when I can expect it.',
    ], par: [0, 0, 0, 1, 1],
    ko: ['3월 9일에 주문한 사무용 책상 때문에 이메일을 써요.', '빠른 배송비를 더 냈고, 웹사이트에는 책상이 3월 11일까지 온다고 나와 있었어요.', '3월 13일에 여는 새 사무실에 필요해요.', '그런데 아직 오지 않았고, 아무도 연락하지 않았어요.', '언제 받을 수 있는지 알려 주세요.'] });
  doc('deskRec', { kind: 'form', en: 'delivery record', label: '배송 기록',
    head: ['DELIVERY RECORD · Order #2215'],
    cols: null,
    rows: [['Customer', 'Kevin Shaw'], ['Item', 'Oak office desk'], ['Option', 'Express'], ['Delivered', 'March 14']],
    foot: [],
    ko: ['손님 · 케빈 쇼', '물건 · 참나무 사무용 책상', '배송 방법 · 빠른 배송', '배달한 날 · 3월 14일'] });

  /* 퀴즈 · 직접 해 보기용 작은 글 */
  doc('qAdm', { kind: 'notice', en: 'notice', label: '공지', sents: ['Admission is free for children under 12.'], par: [0], ko: ['12세 미만 어린이는 입장료가 무료예요.'] });
  doc('qPurp', { kind: 'email', en: 'e-mail', label: '이메일',
    sents: ['I hope you enjoyed our spring seminar.', 'I am writing to ask if you would speak at our next event in June.', 'It will be held at the Garden Hotel.', 'Please let me know by Friday.'], par: [0, 0, 0, 1],
    ko: ['봄 세미나가 즐거우셨기를 바라요.', '6월에 열 다음 행사에서 강연해 주실 수 있는지 여쭤보려고 이메일을 써요.', '행사는 가든 호텔에서 열려요.', '금요일까지 알려 주세요.'] });
  doc('qReq', { kind: 'email', en: 'e-mail', label: '이메일',
    sents: ['Thank you for agreeing to join our team.', 'Your first day will be Monday, June 2.', 'Before then, please return the signed contract to the HR office.'], par: [0, 0, 1],
    ko: ['우리 팀에 오기로 해 주셔서 고마워요.', '첫 출근은 6월 2일 월요일이에요.', '그 전에 서명한 계약서를 인사과에 돌려주세요.'] });
  doc('qCell', { kind: 'form', en: 'Web page', label: '웹 페이지', head: ['Shipping Options'],
    cols: ['Option', 'Arrives in', 'Fee'], rows: [['Standard', '5 days', 'Free'], ['Express', '2 days', '$25'], ['Overnight', '1 day', '$45']], foot: [],
    ko: ['보통 · 5일 · 무료', '빠른 배송 · 2일 · 25달러', '익일 배송 · 1일 · 45달러'] });
  doc('qSyn', { kind: 'email', en: 'e-mail', label: '이메일', sents: ['We need to address the problem quickly.'], par: [0], ko: ['그 문제를 빨리 해결해야 해요.'] });
  doc('qChat', { kind: 'chat', en: 'text-message chain', label: '문자 메시지',
    msgs: [{ who: 'David Lee', time: '9:02 A.M.', t: 'Can you cover my shift on Friday? I have a dentist appointment.' }, { who: 'Ana Ruiz', time: '9:03 A.M.', t: 'No problem.' }],
    ko: ['금요일에 제 근무를 대신해 줄 수 있어요? 치과 예약이 있어서요.', '그럼요.'] });
  doc('qIns', { kind: 'notice', en: 'notice', label: '공지',
    sents: ['Brightline will open a new café on the first floor next month.', '[1]', 'It will serve sandwiches, salads, and coffee.', '[2]', 'To celebrate, we will offer free coffee for one week.', '[3]', 'Please send your menu ideas to the café team.', '[4]'],
    par: [0, 0, 0, 0, 0, 0, 0, 0], ko: ['브라이트라인이 다음 달 1층에 새 카페를 열어요.', '', '샌드위치, 샐러드, 커피를 팔 거예요.', '', '개업을 축하하며 일주일 동안 커피를 무료로 드려요.', '', '메뉴 의견을 카페 팀에 보내 주세요.', ''] });
  doc('qLinkAd', { kind: 'ad', en: 'advertisement', label: '광고', sents: ['Free delivery on all orders over $50.'], par: [0], ko: ['50달러가 넘는 주문은 모두 무료 배달이에요.'] });
  doc('qLinkMail', { kind: 'email', en: 'e-mail', label: '이메일', sents: ['My order comes to $45.'], par: [0], ko: ['제 주문은 45달러예요.'] });

  /* ---------- 지문 세트와 문제 ---------- */
  const SETS = (R7.SETS = {});
  const set = (id, o) => { SETS[id] = Object.assign({ id }, o); };
  const o = (t, rel, x = {}) => Object.assign({ t, rel }, x);   // 보기 하나

  set('hotel', { label: '이메일', title: '호텔 예약', docs: ['hotel'], qs: [
    { id: 'hotel1', type: 'true', q: 'What is indicated about the Harborview Inn?', ko: '하버뷰 인에 대해 알 수 있는 것은?', key: ['the Harborview Inn'],
      ev: [{ s: 1, t: 'all of our rooms are fully booked on March 14' }], a: 1, opts: [
        o('It is hosting a city marathon.', 'same', { src: { s: 1, t: 'because of the city marathon' }, why: '마라톤은 방이 다 찬 까닭이에요. 호텔이 마라톤을 연다는 말은 없어요.', ko: '시 마라톤을 열고 있다.' }),
        o('It has no vacancies on March 14.', 'match', { pairs: [['fully booked', 'no vacancies']], why: '빈방(vacancy)이 없다 = 방이 다 찼다.', ko: '3월 14일에 빈방이 없다.' }),
        o('It is a ten-minute walk from the starting line.', 'who', { src: { s: 3, t: 'It is a ten-minute walk' }, why: '여기서 It → 앞 문장의 자매 호텔 베이사이드 로지를 가리켜요. 하버뷰 인 이야기가 아니에요.', ko: '출발선에서 걸어서 10분 거리다.' }),
        o('It is offering a discount to runners.', 'none', { why: '할인 이야기는 없어요. 오히려 같은 요금(the same rate)이라고 했어요.', ko: '달리기 참가자에게 할인을 해 준다.' }),
      ] },
    { id: 'hotel2', type: 'request', q: 'What is Mr. Cho asked to do?', ko: '조 씨가 요청받은 일은?', key: ['Mr. Cho', 'asked to do'],
      ev: [{ s: 5, t: 'Please reply by March 6' }], a: 3, opts: [
        o('Book a room at the Harborview Inn', 'contra', { src: { s: 1, t: 'all of our rooms are fully booked' }, why: '하버뷰 인은 방이 다 찼어요.', ko: '하버뷰 인에 방 예약하기' }),
        o('Run in the city marathon', 'same', { src: { s: 1, t: 'the city marathon' }, why: '마라톤에 나가 달라는 말은 없어요.', ko: '시 마라톤에 나가기' }),
        o('Pay for his room by March 14', 'none', { why: '돈을 내라는 말은 없어요. 3월 14일은 묵으려던 날이에요.', ko: '3월 14일까지 방값 내기' }),
        o('Respond to Ms. Torres by March 6', 'match', { pairs: [['reply', 'Respond']], why: 'Please 뒤가 요청이에요. 이메일을 쓴 사람 = 토레스 씨.', ko: '3월 6일까지 토레스 씨에게 답하기' }),
      ] },
    { id: 'hotel3', type: 'synonym', q: 'The word “hold” in paragraph 3 is closest in meaning to', ko: '셋째 문단의 hold와 뜻이 가장 가까운 말은?', key: ['“hold”', 'paragraph 3'],
      word: 'hold', par: 3, ev: [{ s: 5, t: 'hold the room' }], a: 2, opts: [
        o('grasp', 'dict', { why: 'hold → 단어장의 첫 뜻 ‘(손에) 쥐다’. 방을 손으로 쥘 수는 없어요.', ko: '(손에) 꽉 쥐다' }),
        o('host', 'sense', { why: '‘(행사를) 열다’ → hold a sale 같은 문장의 뜻이에요.', ko: '(행사를) 열다' }),
        o('keep', 'match', { pairs: [['hold the room', 'keep']], why: '방을 다른 사람에게 주지 않고 ‘잡아 두다’ → keep the room.', ko: '(남에게 주지 않고) 두다' }),
        o('contain', 'sense', { why: '‘담다’ → The box holds ten files 같은 문장의 뜻이에요.', ko: '담다, 들어 있다' }),
      ] },
  ] });

  set('elevator', { label: '이메일', title: '엘리베이터 점검', docs: ['elevator'], qs: [
    { id: 'elev1', type: 'purpose', q: 'Why was the e-mail sent?', ko: '이메일을 보낸 까닭은?', key: ['Why', 'sent'],
      ev: [{ s: 0, t: 'let you know that the east elevator will be out of service' }], a: 1, opts: [
        o('To report a problem with the stairs', 'same', { src: { s: 3, t: 'the stairs' }, why: '계단은 대신 쓰라고 한 곳일 뿐, 문제가 있다는 말은 없어요.', ko: '계단의 문제를 알리려고' }),
        o('To announce that an elevator cannot be used for a day', 'match', { pairs: [['let you know', 'announce'], ['out of service', 'cannot be used']], why: '첫 문장 I am writing to … 뒤가 목적이에요.', ko: '엘리베이터를 하루 쓸 수 없다고 알리려고' }),
        o('To ask staff to replace a control panel', 'who', { src: { s: 1, t: 'A technician will replace its control panel' }, why: '제어판은 기술자가 바꿔요. 직원에게 부탁하는 일이 아니에요.', ko: '직원에게 제어판을 바꿔 달라고 부탁하려고' }),
        o('To introduce a new delivery company', 'same', { src: { s: 9, t: 'the delivery company' }, why: '배송 회사는 마지막 문장에 나오지만, 새 회사를 소개하는 글이 아니에요.', ko: '새 배송 회사를 소개하려고' }),
      ] },
    { id: 'elev2', type: 'request', q: 'What are employees expecting a large delivery asked to do?', ko: '큰 배송을 기다리는 직원이 요청받은 일은?', key: ['a large delivery', 'asked to do'],
      ev: [{ s: 7, t: 'please contact me by Tuesday' }], a: 2, opts: [
        o('Use the east elevator on Thursday', 'contra', { src: { s: 0, t: 'the east elevator will be out of service' }, why: '동쪽 엘리베이터는 목요일에 쓸 수 없어요.', ko: '목요일에 동쪽 엘리베이터 쓰기' }),
        o('Finish their work by 5 P.M.', 'same', { src: { s: 5, t: 'The work should be finished by 5 P.M.' }, why: '5시까지 끝나는 것은 엘리베이터 작업이에요.', ko: '오후 5시까지 일 끝내기' }),
        o('Get in touch with Ms. Lim by Tuesday', 'match', { pairs: [['contact me', 'Get in touch with Ms. Lim']], why: '이메일을 쓴 사람(me) = 림 씨.', ko: '화요일까지 림 씨에게 연락하기' }),
        o('Help the technician on Thursday', 'none', { why: '기술자를 도우라는 말은 없어요.', ko: '목요일에 기술자 돕기' }),
      ] },
    { id: 'elev3', type: 'insert', q: 'In which of the positions marked [1], [2], [3], and [4] does the following sentence best belong?', ko: '[1]~[4] 가운데 다음 문장이 들어가기에 가장 알맞은 자리는?', key: ['[1], [2], [3], and [4]'],
      sent: 'This panel has broken down three times this year.', sentKo: '이 제어판은 올해 세 번 고장 났어요.', ptr: { t: 'This panel', need: 'panel' },
      pos: { 1: ['panel', 'technician'], 2: ['elevator', 'stairs'], 3: ['time'], 4: ['delivery'] }, ev: [{ s: 1, t: 'its control panel' }], a: 0,
      flow: '제어판을 바꾼다 → 이 제어판은 올해 세 번 고장 났다. 바꾸는 까닭이 이어져요.' },
  ] });

  set('library', { label: '공지', title: '도서관 책 판매', docs: ['library'], qs: [
    { id: 'lib1', type: 'detail', q: 'When can library members start shopping on July 18?', ko: '도서관 회원은 7월 18일에 언제부터 책을 살 수 있나요?', key: ['library members', 'July 18'],
      kp: [['July 18', 'on the first day']], ev: [{ s: 2, t: 'at 9 A.M., on the first day' }], a: 1, opts: [
        o('At 8 A.M.', 'none', { why: '8시는 지문에 없어요.', ko: '오전 8시' }),
        o('At 9 A.M.', 'match', { why: '대신 질문의 July 18 → 지문의 on the first day로 바뀌었어요.', ko: '오전 9시' }),
        o('At 10 A.M.', 'who', { src: { s: 3, t: 'All other visitors are welcome from 10 A.M.' }, why: '10시는 회원이 아닌 다른 방문객의 시각이에요.', ko: '오전 10시' }),
        o('At 2 P.M.', 'none', { why: '2시는 지문에 없어요.', ko: '오후 2시' }),
      ] },
    { id: 'lib2', type: 'not', not: true, q: 'What is NOT mentioned about the book sale?', ko: '책 판매 행사에 대해 언급되지 않은 것은?', key: ['NOT', 'the book sale'], a: 3, opts: [
        o('It will last for three days.', 'stated', { src: { s: 0, t: 'from July 18 to July 20' }, pairs: [['from July 18 to July 20', 'three days']], ko: '사흘 동안 열린다.' }),
        o('Most of the books will cost less than $2.', 'stated', { src: { s: 1, t: 'most for under $2' }, pairs: [['under', 'less than']], ko: '책 대부분이 2달러보다 싸다.' }),
        o('Shoppers can pay with a credit card.', 'stated', { src: { s: 4, t: 'by credit card' }, ko: '신용카드로 낼 수 있다.' }),
        o('Volunteers will help carry heavy books.', 'none', { why: '자원봉사자 이야기는 어디에도 없어요.', ko: '자원봉사자가 무거운 책 나르기를 돕는다.' }),
      ] },
    { id: 'lib3', type: 'infer', q: 'What is suggested about the Ridgeway Public Library?', ko: '리지웨이 공공 도서관에 대해 짐작할 수 있는 것은?', key: ['suggested', 'the Ridgeway Public Library'],
      ev: [{ s: 0, t: 'annual book sale' }], a: 0, opts: [
        o('It has held book sales in the past.', 'match', { pairs: [['annual', 'in the past']], why: 'annual = 해마다. 해마다 여는 행사라면 전에도 열었어요. 쓰여 있지는 않지만 단서로 알 수 있어요.', ko: '전에도 책 판매 행사를 열었다.' }),
        o('It is closing its children’s room.', 'same', { src: { s: 5, t: 'the children’s room' }, why: '어린이 열람실에는 새 컴퓨터가 생겨요. 닫는다는 말은 없어요.', ko: '어린이 열람실을 닫는다.' }),
        o('It sells only new books.', 'contra', { src: { s: 1, t: 'used books' }, why: '파는 책은 중고 책(used books)이에요.', ko: '새 책만 판다.' }),
        o('It opens at 9 A.M. every day.', 'same', { src: { s: 2, t: 'at 9 A.M., on the first day' }, why: '9시는 첫날, 회원만이에요. 날마다 9시에 연다는 말은 없어요.', ko: '날마다 오전 9시에 문을 연다.' }),
      ] },
  ] });

  set('invoice', { label: '청구서', title: '인쇄소 청구서', docs: ['invoice'], qs: [
    { id: 'inv1', type: 'form', q: 'How many appointment cards did the clinic order?', ko: '치과는 예약 카드를 몇 장 주문했나요?', key: ['How many', 'appointment cards'],
      ev: [{ s: 1, t: '1,000' }], col: 1, a: 3, opts: [
        o('2', 'cell', { src: { s: 2, t: '2' }, why: '창문 포스터(Window posters) 줄의 수량이에요.', ko: '2장' }),
        o('500', 'cell', { src: { s: 0, t: '500' }, why: '명함(Business cards) 줄의 수량이에요.', ko: '500장' }),
        o('65', 'cell', { src: { s: 1, t: '$65' }, why: '같은 줄이지만 Price(가격) 칸이에요.', ko: '65장' }),
        o('1,000', 'match', { why: 'Appointment cards 줄 × Quantity 칸.', ko: '1,000장' }),
      ] },
    { id: 'inv2', type: 'detail', q: 'How can the clinic receive a discount?', ko: '치과는 어떻게 할인을 받을 수 있나요?', key: ['receive a discount'],
      kp: [['a discount', 'save 5%']], ev: [{ s: 5, t: 'Pay by April 15 and save 5%' }], a: 0, opts: [
        o('By paying by April 15', 'match', { why: '조건은 4월 15일까지 내기. 날짜는 그대로 나왔어요.', ko: '4월 15일까지 내서' }),
        o('By paying by April 30', 'when', { src: { s: 4, t: 'April 30' }, why: '4월 30일은 내야 하는 마지막 날이에요. 할인 날짜가 아니에요.', ko: '4월 30일까지 내서' }),
        o('By ordering 1,000 more cards', 'same', { src: { s: 1, t: '1,000' }, why: '1,000은 이미 주문한 예약 카드의 수예요.', ko: '카드를 1,000장 더 주문해서' }),
        o('By picking up the posters in person', 'none', { why: '직접 가져가라는 말은 없어요.', ko: '포스터를 직접 가져가서' }),
      ] },
  ] });

  set('chat', { label: '문자 메시지', title: '프로젝터 문자', docs: ['chat'], qs: [
    { id: 'chat1', type: 'intent', q: 'At 10:14 A.M., what does Ms. Park mean when she writes, “That’s not it”?', ko: '오전 10시 14분에 박 씨가 “That’s not it”이라고 쓴 뜻은?', key: ['10:14 A.M.', '“That’s not it”'],
      time: '10:14 A.M.', quote: 'That’s not it', ev: [{ s: 1, t: 'Is the cable plugged in?' }, { s: 2, t: 'That’s not it' }], a: 0, opts: [
        o('The cable is not causing the problem.', 'match', { pairs: [['Is the cable plugged in?', 'The cable'], ['That’s not it', 'not causing the problem']], why: '바로 앞 메시지가 케이블을 물었어요 → 그게 문제가 아니다 = 케이블 탓이 아니다.', ko: '케이블이 문제의 원인이 아니다.' }),
        o('She cannot find Room 3.', 'same', { src: { s: 0, t: 'Room 3' }, why: '이미 3번 회의실에 있어요. 못 찾는다는 말은 없어요.', ko: '3번 회의실을 못 찾는다.' }),
        o('Her client has already arrived.', 'contra', { src: { s: 0, t: 'my client arrives at 11' }, why: '손님은 11시에 와요. 아직 안 왔어요.', ko: '손님이 벌써 왔다.' }),
        o('She has bought a new cable.', 'none', { why: '새 케이블을 샀다는 말은 없어요.', ko: '새 케이블을 샀다.' }),
      ] },
    { id: 'chat2', type: 'intent', q: 'At 10:16 A.M., what does Ms. Park most likely mean when she writes, “You’re a lifesaver”?', ko: '오전 10시 16분에 박 씨가 “You’re a lifesaver”라고 쓴 뜻은?', key: ['10:16 A.M.', '“You’re a lifesaver”'],
      time: '10:16 A.M.', quote: 'You’re a lifesaver', ev: [{ s: 3, t: 'I’ll bring it over now' }, { s: 4, t: 'You’re a lifesaver' }], a: 2, opts: [
        o('Mr. Carter works as a lifeguard.', 'literal', { why: 'lifesaver → 말 그대로는 ‘목숨을 구한 사람’. 채팅에서는 큰 도움에 고마워하는 말이에요.', ko: '카터 씨는 인명 구조원이다.' }),
        o('She will cancel the meeting.', 'none', { why: '회의를 취소한다는 말은 없어요.', ko: '회의를 취소할 것이다.' }),
        o('She is grateful for Mr. Carter’s help.', 'match', { pairs: [['I’ll bring it over now', 'help'], ['You’re a lifesaver', 'grateful']], why: '바로 앞 메시지: 프로젝터를 가져다주겠다 → 그 도움이 고맙다는 뜻.', ko: '카터 씨의 도움이 고맙다.' }),
        o('She wants Mr. Carter to meet her client.', 'none', { why: '손님을 만나 달라는 말은 없어요.', ko: '카터 씨가 손님을 만나 주기를 바란다.' }),
      ] },
    { id: 'chat3', type: 'infer', q: 'What will Mr. Carter most likely do next?', ko: '카터 씨가 다음에 할 일은?', key: ['Mr. Carter', 'do next'],
      ev: [{ s: 3, t: 'I’ll bring it over now' }], a: 1, opts: [
        o('Call a repair technician', 'none', { why: '기술자를 부른다는 말은 없어요.', ko: '수리 기술자 부르기' }),
        o('Take a projector to Room 3', 'match', { pairs: [['bring it over', 'Take a projector to Room 3']], why: 'it = 여분 프로젝터, over = 박 씨가 있는 3번 회의실로.', ko: '3번 회의실로 프로젝터 가져가기' }),
        o('Check the cable again', 'when', { src: { s: 1, t: 'Is the cable plugged in?' }, why: '케이블은 이미 확인했어요(10시 14분). 지난 이야기예요.', ko: '케이블 다시 확인하기' }),
        o('Meet a client at 11', 'who', { src: { s: 0, t: 'my client arrives at 11' }, why: '11시에 손님을 만나는 사람은 박 씨예요.', ko: '11시에 손님 만나기' }),
      ] },
  ] });

  set('catering', { label: '광고 + 이메일', title: '점심 주문', docs: ['caterAd', 'caterMail'], qs: [
    { id: 'cater1', type: 'double', q: 'How much will Mr. Reyes most likely pay per person?', ko: '레예스 씨는 한 사람에 얼마를 낼까요?', key: ['Mr. Reyes', 'per person'],
      ev: [{ d: 1, s: 0, t: 'Deluxe package' }, { d: 0, s: 2, t: '$18 per person' }], a: 1, opts: [
        o('$12', 'off', { src: { d: 0, s: 1, t: '$12 per person' }, why: '12달러는 베이식 상품의 값이에요. 이메일은 디럭스를 주문했어요.', ko: '12달러' }),
        o('$18', 'match', { why: '이메일의 Deluxe package + 광고의 Deluxe … $18 per person. 두 글을 이어야 나와요.', ko: '18달러' }),
        o('$25', 'same', { src: { d: 1, s: 1, t: '25 of us' }, why: '25는 사람 수예요.', ko: '25달러' }),
        o('$30', 'same', { src: { d: 0, s: 3, t: '30 people or more' }, why: '30은 무료 배달의 사람 수 조건이에요.', ko: '30달러' }),
      ] },
    { id: 'cater2', type: 'double', q: 'What is suggested about Mr. Reyes’s order?', ko: '레예스 씨의 주문에 대해 짐작할 수 있는 것은?', key: ['suggested', 'Mr. Reyes’s order'],
      ev: [{ d: 1, s: 1, t: '25 of us' }, { d: 0, s: 3, t: 'free for orders of 30 people or more' }], a: 2, opts: [
        o('It will be delivered at no cost.', 'contra', { src: { d: 0, s: 3, t: 'Delivery is free for orders of 30 people or more' }, why: '무료 배달은 30명 이상. 25명이라 해당하지 않아요.', ko: '무료로 배달된다.' }),
        o('It will include sandwiches only.', 'contra', { src: { d: 0, s: 2, t: 'adds a hot dish and dessert' }, why: '디럭스는 따뜻한 요리와 디저트가 더해져요.', ko: '샌드위치만 들어 있다.' }),
        o('It does not qualify for free delivery.', 'match', { pairs: [['free for orders of 30 people or more', 'not qualify for free delivery']], why: '25명(이메일) < 30명(광고) → 무료 배달 조건에 모자라요. 두 글을 이어야 알 수 있어요.', ko: '무료 배달 조건에 맞지 않는다.' }),
        o('It was placed after the meeting.', 'when', { src: { d: 1, s: -1, t: 'Date: June 2' }, why: '이메일은 6월 2일, 회의는 6월 9일. 회의 전에 주문했어요.', ko: '회의가 끝난 뒤에 주문했다.' }),
      ] },
  ] });

  set('workshop', { label: '일정표 + 이메일 + 신청서', title: '워크숍 강의실', docs: ['wsSched', 'wsMail', 'wsForm'], qs: [
    { id: 'ws1', type: 'triple', q: 'Where will Ms. Bell’s workshop most likely be held?', ko: '벨 씨의 워크숍은 어디에서 열릴까요?', key: ['Where', 'Ms. Bell’s workshop'],
      ev: [{ d: 2, s: 2, t: 'Writing Clear E-mails' }, { d: 0, s: 0, t: 'Room B' }, { d: 1, s: 1, t: 'will be held in Room D instead' }], a: 3, opts: [
        o('In Room A', 'cell', { src: { d: 0, s: 1, t: 'Room A' }, why: '다른 워크숍(짧은 회의 이끌기)의 방이에요.', ko: 'A실에서' }),
        o('In Room B', 'doc', { src: { d: 0, s: 0, t: 'Room B' }, why: '일정표만 보면 B실이지만, 이메일에서 D실로 바뀌었어요. 옛 정보예요.', ko: 'B실에서' }),
        o('In Room C', 'cell', { src: { d: 0, s: 2, t: 'Room C' }, why: '다른 워크숍(자료로 발표하기)의 방이에요.', ko: 'C실에서' }),
        o('In Room D', 'match', { why: '신청서 → 강의 이름, 일정표 → 그 강의는 B실, 이메일 → B실 강의는 D실로. 세 글을 이어요.', ko: 'D실에서' }),
      ] },
    { id: 'ws2', type: 'triple', q: 'What time does Ms. Bell’s workshop begin?', ko: '벨 씨의 워크숍은 몇 시에 시작하나요?', key: ['What time', 'Ms. Bell’s workshop'],
      ev: [{ d: 2, s: 2, t: 'Writing Clear E-mails' }, { d: 0, s: 0, t: '9:00 A.M.' }], a: 0, opts: [
        o('At 9:00 A.M.', 'match', { why: '신청서의 강의 이름 → 일정표의 같은 줄 시각. 이메일은 방만 바꿨고 시각은 그대로예요.', ko: '오전 9시에' }),
        o('At 11:00 A.M.', 'cell', { src: { d: 0, s: 1, t: '11:00 A.M.' }, why: '짧은 회의 이끌기의 시각이에요.', ko: '오전 11시에' }),
        o('At 2:00 P.M.', 'cell', { src: { d: 0, s: 2, t: '2:00 P.M.' }, why: '자료로 발표하기의 시각이에요.', ko: '오후 2시에' }),
        o('On October 8', 'when', { src: { d: 1, s: -1, t: 'Date: October 8' }, why: '10월 8일은 이메일을 보낸 날이에요.', ko: '10월 8일에' }),
      ] },
  ] });

  set('bikes', { label: '광고 + 이메일', title: '자전거 대여', docs: ['bikeAd', 'bikeMail'], qs: [
    { id: 'bike1', type: 'purpose', q: 'Why did Ms. Song write the e-mail?', ko: '송 씨가 이메일을 쓴 까닭은?', key: ['Why', 'the e-mail'],
      ev: [{ d: 1, s: 0, t: 'planning a team outing' }, { d: 1, s: 1, t: 'would like to rent electric bikes' }], a: 0, opts: [
        o('To book bikes for a team event', 'match', { pairs: [['team outing', 'team event'], ['rent', 'book']], why: '첫 문단이 목적: 팀 나들이 + 자전거를 빌리고 싶다.', ko: '팀 행사에 쓸 자전거를 예약하려고' }),
        o('To ask about the opening hours of a park', 'same', { src: { d: 0, s: 0, t: 'Lakeside Park' }, why: '공원은 광고에 나오는 말이에요. 송 씨는 여는 시간을 묻지 않았어요.', ko: '공원이 여는 시간을 물으려고' }),
        o('To complain about a broken helmet', 'same', { src: { d: 1, s: 2, t: 'our own helmets' }, why: '헬멧은 가져가야 하는지 물은 것뿐이에요. 고장 이야기는 없어요.', ko: '고장 난 헬멧에 대해 불평하려고' }),
        o('To offer a discount to a group', 'who', { src: { d: 0, s: 2, t: 'Groups of five or more receive 20 percent off' }, why: '할인을 주는 쪽은 자전거 가게예요. 송 씨가 아니에요.', ko: '단체에 할인을 해 주려고' }),
      ] },
    { id: 'bike2', type: 'detail', q: 'What does Ms. Song ask about?', ko: '송 씨가 묻는 것은?', key: ['ask about'],
      ev: [{ d: 1, s: 2, t: 'whether we need to bring our own helmets' }], a: 2, opts: [
        o('Parking near the park', 'none', { why: '주차 이야기는 없어요.', ko: '공원 근처 주차' }),
        o('The price of regular bikes', 'off', { src: { d: 0, s: 1, t: 'Regular bikes cost $10 per hour' }, why: '일반 자전거 값은 광고에 있지만, 송 씨는 전기 자전거를 빌리고 값을 묻지 않았어요.', ko: '일반 자전거의 값' }),
        o('Whether safety gear is supplied', 'match', { pairs: [['helmets', 'safety gear'], ['need to bring our own', 'supplied']], why: 'Could you tell me whether … 뒤가 묻는 말이에요.', ko: '안전 장비를 주는지' }),
        o('Where to leave bags during the ride', 'none', { why: '가방 이야기는 없어요.', ko: '타는 동안 가방을 둘 곳' }),
      ] },
    { id: 'bike3', type: 'double', q: 'What is indicated about Ms. Song’s group?', ko: '송 씨의 팀에 대해 알 수 있는 것은?', key: ['Ms. Song’s group'],
      ev: [{ d: 1, s: 1, t: 'Six of us' }, { d: 0, s: 2, t: 'Groups of five or more receive 20 percent off' }], a: 3, opts: [
        o('It will rent regular bikes.', 'contra', { src: { d: 1, s: 1, t: 'rent electric bikes' }, why: '빌리는 것은 전기 자전거예요.', ko: '일반 자전거를 빌린다.' }),
        o('It must return the bikes by 10 A.M.', 'same', { src: { d: 1, s: 1, t: 'starting at 10 A.M.' }, why: '10시는 빌리기 시작하는 시각이에요.', ko: '오전 10시까지 자전거를 돌려줘야 한다.' }),
        o('It has to bring its own helmets.', 'contra', { src: { d: 0, s: 3, t: 'Helmets are provided at no extra charge' }, why: '헬멧은 추가 요금 없이 줘요.', ko: '헬멧을 직접 가져와야 한다.' }),
        o('It is eligible for a lower price.', 'match', { pairs: [['20 percent off', 'a lower price']], why: '여섯 명(이메일) → 다섯 명 이상(광고) → 20퍼센트 할인.', ko: '더 싼 값을 받을 수 있다.' }),
      ] },
  ] });

  /* 연습 문제 세트 다섯 */
  set('mag', { label: '이메일', title: '잡지 사진', docs: ['mag'], qs: [
    { id: 'mag1', type: 'purpose', q: 'What is the purpose of the e-mail?', ko: '이메일의 목적은?', key: ['purpose'],
      ev: [{ s: 2, t: 'we would like to feature three of them in our April issue' }], a: 0, opts: [
        o('To accept some of Mr. Hale’s photos for publication', 'match', { pairs: [['feature three of them', 'accept some of Mr. Hale’s photos'], ['April issue', 'publication']], why: '첫 문단: 사진 세 장을 4월호에 싣고 싶다 → 작품을 싣겠다는 연락이에요.', ko: '헤일 씨의 사진 몇 장을 잡지에 싣겠다고 알리려고' }),
        o('To ask Mr. Hale to take pictures of the Jeju coast', 'when', { src: { s: 0, t: 'Thank you for sending us your photographs of the Jeju coast' }, why: '사진은 이미 보냈어요. 새로 찍어 달라는 부탁이 아니에요.', ko: '제주 해안을 찍어 달라고 부탁하려고' }),
        o('To offer Mr. Hale a job as an editor', 'same', { src: { s: 2, t: 'Our editors' }, why: 'editors는 잡지의 편집자들이에요. 일자리 이야기는 없어요.', ko: '편집자 자리를 제안하려고' }),
        o('To explain a change in payment rates', 'contra', { src: { s: 4, t: 'as stated in our standard agreement' }, why: '돈은 기본 계약서대로예요. 바뀐 것이 없어요.', ko: '바뀐 원고료를 설명하려고' }),
      ] },
    { id: 'mag2', type: 'synonym', q: 'The word “issue” in paragraph 1 is closest in meaning to', ko: '첫째 문단의 issue와 뜻이 가장 가까운 말은?', key: ['“issue”', 'paragraph 1'],
      word: 'issue', par: 1, ev: [{ s: 2, t: 'our April issue' }], a: 3, opts: [
        o('problem', 'dict', { why: 'issue → 단어장의 첫 뜻 ‘문제’. 4월의 문제가 아니라 잡지 4월호예요.', ko: '문제' }),
        o('topic', 'sense', { why: '‘주제, 쟁점’ → discuss an issue 같은 문장의 뜻이에요.', ko: '주제' }),
        o('payment', 'none', { why: 'issue에 ‘돈’이라는 뜻은 없어요. 원고료는 둘째 문단 이야기예요.', ko: '지불' }),
        o('edition', 'match', { pairs: [['our April issue', 'edition']], why: '잡지의 ‘호’ → edition. 바꿔 넣어 읽어 보세요: our April edition.', ko: '(잡지의) 호, 판' }),
      ] },
    { id: 'mag3', type: 'insert', q: 'In which of the positions marked [1], [2], [3], and [4] does the following sentence best belong?', ko: '[1]~[4] 가운데 다음 문장이 들어가기에 가장 알맞은 자리는?', key: ['[1], [2], [3], and [4]'],
      sent: 'That issue will focus on travel in Korea.', sentKo: '그 호는 한국 여행을 다룰 거예요.', ptr: { t: 'That issue', need: 'issue' },
      pos: { 1: ['photos'], 2: ['issue', 'editors'], 3: ['payment'], 4: ['files'] }, ev: [{ s: 2, t: 'our April issue' }], a: 1,
      flow: '4월호에 싣고 싶다 → 그 호는 한국 여행을 다룬다. 왜 제주 사진을 고르는지도 이어져요.' },
  ] });
  set('store', { label: '문자 메시지', title: '생수 배송', docs: ['store'], qs: [
    { id: 'store1', type: 'intent', q: 'At 2:09 P.M., what does Ms. Diaz mean when she writes, “I’ll see what I can do”?', ko: '오후 2시 9분에 디아스 씨가 “I’ll see what I can do”라고 쓴 뜻은?', key: ['2:09 P.M.', '“I’ll see what I can do”'],
      time: '2:09 P.M.', quote: 'I’ll see what I can do', ev: [{ s: 2, t: 'Could you add ten more cases of bottled water?' }, { s: 3, t: 'I’ll see what I can do' }], a: 0, opts: [
        o('She will try to fit the extra cases in the truck.', 'match', { pairs: [['add ten more cases', 'fit the extra cases'], ['I’ll see what I can do', 'try']], why: '앞 메시지의 부탁(물 열 상자 더) + 트럭이 거의 꽉 참 → 어떻게든 실어 보겠다는 뜻.', ko: '남는 상자를 트럭에 실어 보겠다.' }),
        o('She will look at the store’s sales report.', 'literal', { why: 'see → 말 그대로 ‘보다’가 아니라 ‘알아보다, 해 보다’예요.', ko: '매장의 판매 보고서를 보겠다.' }),
        o('She has already finished loading the truck.', 'contra', { src: { s: 1, t: 'I’m loading the boxes' }, why: '아직 싣는 중이에요.', ko: '트럭에 싣기를 벌써 끝냈다.' }),
        o('She wants Mr. Kang to call the warehouse.', 'none', { why: '창고에 전화하라는 말은 없어요.', ko: '강 씨가 창고에 전화하기를 바란다.' }),
      ] },
    { id: 'store2', type: 'request', q: 'What does Mr. Kang ask Ms. Diaz to do?', ko: '강 씨가 디아스 씨에게 부탁한 일은?', key: ['ask', 'to do'],
      ev: [{ s: 2, t: 'Could you add ten more cases of bottled water?' }], a: 2, opts: [
        o('Count the boxes at the warehouse', 'same', { src: { s: 1, t: 'loading the boxes' }, why: '상자를 세라는 말은 없어요.', ko: '창고에서 상자 세기' }),
        o('Unload the truck at the Oak Street store', 'same', { src: { s: 1, t: 'the Oak Street store' }, why: '오크 스트리트 매장은 짐이 갈 곳이에요. 내려 달라는 부탁은 없어요.', ko: '오크 스트리트 매장에서 트럭 짐 내리기' }),
        o('Include more drinks in a delivery', 'match', { pairs: [['add ten more cases of bottled water', 'Include more drinks']], why: 'Could you … 뒤가 부탁이에요. bottled water → drinks.', ko: '배송에 음료를 더 넣기' }),
        o('Order more paper towels', 'same', { src: { s: 5, t: 'the paper towels' }, why: '종이 타월은 물을 놓은 자리일 뿐이에요.', ko: '종이 타월 더 주문하기' }),
      ] },
    { id: 'store3', type: 'infer', q: 'What is most likely true about the bottled water?', ko: '생수에 대해 가장 알맞은 것은?', key: ['most likely', 'the bottled water'],
      ev: [{ s: 5, t: 'Done! I made space' }], a: 0, opts: [
        o('It will be delivered today.', 'match', { pairs: [['I made space', 'delivered today']], why: '자리를 만들었다 → 오늘 트럭에 실어 가요. 쓰여 있지 않지만 짐작할 수 있어요.', ko: '오늘 배달된다.' }),
        o('It will arrive at the store tomorrow.', 'when', { src: { s: 4, t: 'bring them tomorrow' }, why: '내일은 자리가 없을 때의 이야기예요. 자리를 만들었으니 해당하지 않아요.', ko: '내일 매장에 도착한다.' }),
        o('It is sold only at the warehouse.', 'none', { why: '창고에서만 판다는 말은 없어요.', ko: '창고에서만 판다.' }),
        o('It costs more than it did last week.', 'none', { why: '값 이야기는 없어요.', ko: '지난주보다 비싸다.' }),
      ] },
  ] });
  set('classes', { label: '강좌 안내', title: '주민 센터 강좌', docs: ['classes'], qs: [
    { id: 'cls1', type: 'form', q: 'What time does the Spanish class begin?', ko: '스페인어 강좌는 몇 시에 시작하나요?', key: ['What time', 'the Spanish class'],
      ev: [{ s: 2, t: '7:30 P.M.' }], col: 2, a: 2, opts: [
        o('At 6:30 P.M.', 'cell', { src: { s: 1, t: '6:30 P.M.' }, why: '수채화 줄의 시각이에요.', ko: '오후 6시 30분' }),
        o('At 7:00 P.M.', 'cell', { src: { s: 0, t: '7:00 P.M.' }, why: '요가 줄의 시각이에요.', ko: '오후 7시' }),
        o('At 7:30 P.M.', 'match', { why: 'Basic Spanish 줄 × Time 칸.', ko: '오후 7시 30분' }),
        o('At 10:00 A.M.', 'cell', { src: { s: 3, t: '10:00 A.M.' }, why: '요리 줄의 시각이에요.', ko: '오전 10시' }),
      ] },
    { id: 'cls2', type: 'not', not: true, q: 'What is NOT indicated about the classes?', ko: '강좌에 대해 나와 있지 않은 것은?', key: ['NOT', 'the classes'], a: 3, opts: [
        o('They last about two months.', 'stated', { src: { s: 4, t: 'run for eight weeks' }, pairs: [['eight weeks', 'about two months']], ko: '두 달쯤 열린다.' }),
        o('Some of them include supplies at no extra cost.', 'stated', { src: { s: 6, t: 'Materials for the painting and cooking classes are included in the fee' }, pairs: [['Materials', 'supplies'], ['included in the fee', 'at no extra cost']], ko: '몇 강좌는 추가 비용 없이 재료를 준다.' }),
        o('Members can take them at a reduced price.', 'stated', { src: { s: 5, t: 'Center members receive 10% off' }, pairs: [['10% off', 'a reduced price']], ko: '회원은 더 싼 값에 들을 수 있다.' }),
        o('They are taught by professional artists.', 'none', { why: '누가 가르치는지는 어디에도 없어요.', ko: '전문 예술가가 가르친다.' }),
      ] },
    { id: 'cls3', type: 'true', q: 'What is indicated about the Watercolor Painting class?', ko: '수채화 강좌에 대해 알 수 있는 것은?', key: ['the Watercolor Painting class'],
      ev: [{ s: 1, t: 'Watercolor Painting' }, { s: 6, t: 'Materials for the painting and cooking classes are included in the fee' }], a: 1, opts: [
        o('It meets on Mondays.', 'cell', { src: { s: 0, t: 'Monday' }, why: '월요일은 요가 줄이에요. 수채화는 수요일.', ko: '월요일에 모인다.' }),
        o('Its fee covers the cost of materials.', 'match', { pairs: [['included in the fee', 'fee covers the cost of materials']], why: '표 아래 셋째 줄: 그림 강좌의 재료비는 수강료에 들어 있어요.', ko: '수강료에 재료비가 들어 있다.' }),
        o('It is the most expensive class.', 'contra', { src: { s: 3, t: '$95' }, why: '가장 비싼 강좌는 95달러인 요리예요. 수채화는 85달러.', ko: '가장 비싼 강좌다.' }),
        o('It is held on weekends.', 'contra', { src: { s: 1, t: 'Wednesday' }, why: '수채화는 수요일, 주중이에요.', ko: '주말에 열린다.' }),
      ] },
  ] });
  set('conf', { label: '웹 페이지 + 이메일', title: '디자인 콘퍼런스', docs: ['confWeb', 'confMail'], qs: [
    { id: 'conf1', type: 'true', q: 'What is indicated about the conference?', ko: '콘퍼런스에 대해 알 수 있는 것은?', key: ['the conference'],
      ev: [{ d: 0, s: 0, t: 'on November 14 and 15' }], a: 2, opts: [
        o('It is held every year in November.', 'none', { why: '해마다 연다는 말은 없어요.', ko: '해마다 11월에 열린다.' }),
        o('It is open only to students.', 'contra', { src: { d: 0, s: 3, t: 'Students with a valid ID may attend both days for $60' }, why: '학생은 할인을 받을 뿐, 누구나 참가할 수 있어요(조기 120달러 · 정상 160달러).', ko: '학생만 참가할 수 있다.' }),
        o('It will last for two days.', 'match', { pairs: [['November 14 and 15', 'two days']], ko: '이틀 동안 열린다.' }),
        o('It will take place at Bloom Studio.', 'doc', { src: { d: 1, s: 0, t: 'Bloom Studio' }, why: '블룸 스튜디오는 이메일을 쓴 사람의 회사예요. 장소는 리버사이드 홀.', ko: '블룸 스튜디오에서 열린다.' }),
      ] },
    { id: 'conf2', type: 'double', q: 'If Ms. Grant cannot pay the lower rate, how much will she most likely pay?', ko: '낮은 값으로 낼 수 없다면 그랜트 씨는 얼마를 낼까요?', key: ['cannot pay the lower rate', 'how much'],
      ev: [{ d: 1, s: 3, t: 'I will register at the regular price' }, { d: 0, s: 2, t: 'the price will rise to $160' }], a: 3, opts: [
        o('$60', 'who', { src: { d: 0, s: 3, t: '$60' }, why: '60달러는 학생 값이에요. 그랜트 씨는 디자이너예요.', ko: '60달러' }),
        o('$120', 'when', { src: { d: 0, s: 1, t: '$120' }, why: '120달러는 10월 31일까지의 조기 등록 값이에요. 이메일은 11월 3일에 썼어요.', ko: '120달러' }),
        o('$150', 'none', { why: '150달러는 지문에 없어요.', ko: '150달러' }),
        o('$160', 'match', { why: '이메일의 regular price + 웹 페이지의 After that date … $160. 이메일 날짜(11월 3일)도 10월 31일 뒤예요.', ko: '160달러' }),
      ] },
    { id: 'conf3', type: 'detail', q: 'Why did Ms. Grant miss the deadline?', ko: '그랜트 씨가 마감을 놓친 까닭은?', key: ['Why', 'miss the deadline'],
      ev: [{ d: 1, s: 1, t: 'because I was traveling for work' }], a: 0, opts: [
        o('She was on a business trip.', 'match', { pairs: [['traveling for work', 'on a business trip']], why: 'because 뒤가 까닭이에요.', ko: '출장 중이었다.' }),
        o('She did not have a student ID.', 'same', { src: { d: 0, s: 3, t: 'a valid ID' }, why: '학생증은 학생 할인 조건이에요. 마감과 관계없어요.', ko: '학생증이 없었다.' }),
        o('She was busy with a design project.', 'same', { src: { d: 1, s: 0, t: 'a graphic designer' }, why: '디자이너는 직업일 뿐, 바빴던 까닭이 아니에요.', ko: '디자인 일로 바빴다.' }),
        o('The registration Web site was not working.', 'none', { why: '웹사이트가 안 됐다는 말은 없어요.', ko: '등록 웹사이트가 안 됐다.' }),
      ] },
  ] });
  set('desk', { label: '웹 페이지 + 이메일 + 배송 기록', title: '책상 배송', docs: ['deskWeb', 'deskMail', 'deskRec'], qs: [
    { id: 'desk1', type: 'purpose', q: 'Why did Mr. Shaw write the e-mail?', ko: '쇼 씨가 이메일을 쓴 까닭은?', key: ['Why', 'the e-mail'],
      ev: [{ d: 1, s: 0, t: 'I am writing about the office desk' }, { d: 1, s: 3, t: 'it still has not arrived' }], a: 1, opts: [
        o('To order a different desk', 'same', { src: { d: 1, s: 0, t: 'the office desk I ordered on March 9' }, why: '책상은 이미 3월 9일에 주문했어요. 새로 주문하는 이메일이 아니에요.', ko: '다른 책상을 주문하려고' }),
        o('To ask about a late delivery', 'match', { pairs: [['still has not arrived', 'a late delivery']], why: '첫 문단(책상 이야기) + 둘째 문단(아직 안 옴, 알려 달라) → 늦은 배송을 묻는 이메일.', ko: '늦어진 배송에 대해 물으려고' }),
        o('To change a delivery option', 'none', { why: '배송 방법을 바꾸겠다는 말은 없어요.', ko: '배송 방법을 바꾸려고' }),
        o('To invite staff to an office opening', 'same', { src: { d: 1, s: 2, t: 'my new office, which opens on March 13' }, why: '새 사무실이 연다는 것은 책상이 필요한 까닭이에요.', ko: '사무실 개업식에 직원을 초대하려고' }),
      ] },
    { id: 'desk2', type: 'triple', q: 'How much money will Mr. Shaw most likely get back?', ko: '쇼 씨는 얼마를 돌려받을까요?', key: ['How much', 'get back'],
      ev: [{ d: 1, s: 1, t: 'would arrive by March 11' }, { d: 2, s: 3, t: 'March 14' }, { d: 0, s: 1, t: '$40' }, { d: 0, s: 3, t: 'we will refund the delivery fee' }], a: 1, opts: [
        o('$0', 'contra', { src: { d: 0, s: 3, t: 'we will refund the delivery fee' }, why: '늦게 왔으니 배송비를 돌려받아요.', ko: '0달러' }),
        o('$40', 'match', { why: '빠른 배송(이메일 · 기록) → 40달러(웹 페이지). 3월 11일까지 온다고 했는데 3월 14일에 옴(기록) → 늦음 → 배송비 환불(웹 페이지 아래).', ko: '40달러' }),
        o('$75', 'cell', { src: { d: 0, s: 2, t: '$75' }, why: '당일 배송(Same Day) 줄의 값이에요.', ko: '75달러' }),
        o('The full price of the desk', 'none', { why: '책상값을 돌려준다는 말은 없어요. 돌려주는 것은 배송비예요.', ko: '책상값 전부' }),
      ] },
    { id: 'desk3', type: 'synonym', q: 'In the e-mail, the word “expect” in paragraph 2 is closest in meaning to', ko: '이메일 둘째 문단의 expect와 뜻이 가장 가까운 말은?', key: ['“expect”', 'paragraph 2'],
      word: 'expect', par: 2, ev: [{ d: 1, s: 4, t: 'when I can expect it' }], a: 3, opts: [
        o('hope', 'dict', { why: 'expect → 단어장의 첫 뜻 ‘기대하다’. 바라는 마음이 아니라 받을 때를 묻는 말이에요.', ko: '바라다' }),
        o('demand', 'sense', { why: '‘요구하다’ → We expect staff to arrive on time 같은 문장의 뜻이에요.', ko: '요구하다' }),
        o('suppose', 'sense', { why: '‘생각하다’ → I expect so 같은 문장의 뜻이에요.', ko: '생각하다' }),
        o('receive', 'match', { pairs: [['expect it', 'receive']], why: '언제 받을 수 있는지 → when I can receive it. 바꿔 넣어 읽어 보세요.', ko: '받다' }),
      ] },
    { id: 'desk4', type: 'double', q: 'What is suggested about Mr. Shaw’s desk?', ko: '쇼 씨의 책상에 대해 짐작할 수 있는 것은?', key: ['suggested', 'Mr. Shaw’s desk'],
      ev: [{ d: 1, s: 2, t: 'which opens on March 13' }, { d: 2, s: 3, t: 'March 14' }], a: 2, opts: [
        o('It was sent by Same Day delivery.', 'contra', { src: { d: 2, s: 2, t: 'Express' }, why: '배송 방법은 빠른 배송(Express)이에요.', ko: '당일 배송으로 보냈다.' }),
        o('It arrived before March 11.', 'contra', { src: { d: 2, s: 3, t: 'March 14' }, why: '책상은 3월 14일에 왔어요.', ko: '3월 11일 전에 도착했다.' }),
        o('It arrived after his office opened.', 'match', { pairs: [['opens on March 13', 'after his office opened']], why: '사무실은 3월 13일에 열고(이메일), 책상은 3월 14일에 왔어요(기록).', ko: '사무실을 연 뒤에 도착했다.' }),
        o('It is made of metal.', 'contra', { src: { d: 2, s: 1, t: 'Oak office desk' }, why: '참나무(Oak) 책상이에요.', ko: '쇠로 만들었다.' }),
      ] },
  ] });

  /* 퀴즈 · 직접 해 보기용 작은 세트 */
  set('qAdm', { docs: ['qAdm'], qs: [{ id: 'qAdm', type: 'true', q: 'Which option has the same meaning as the sentence?', key: [], ev: [{ s: 0, t: 'Admission is free for children under 12' }], a: 1, opts: [
    o('Children under 12 must pay to enter.', 'contra', { src: { s: 0, t: 'Admission is free' }, why: '무료라고 했어요.', ko: '12세 미만 어린이는 입장료를 내야 한다.' }),
    o('Young children can enter at no cost.', 'match', { pairs: [['free', 'at no cost'], ['children under 12', 'Young children']], ko: '어린아이는 돈을 내지 않고 들어갈 수 있다.' }),
    o('Admission opens at 12.', 'same', { src: { s: 0, t: 'under 12' }, why: '12는 나이예요. 시각이 아니에요.', ko: '12시에 입장을 시작한다.' }),
    o('Children’s tickets are sold online.', 'none', { why: '표를 어디서 파는지는 없어요.', ko: '어린이 표는 온라인으로 판다.' }),
  ] }] });
  set('qPurp', { docs: ['qPurp'], qs: [{ id: 'qPurp', type: 'purpose', q: 'Why was the e-mail written?', key: ['Why'], ev: [{ s: 1, t: 'I am writing to ask if you would speak at our next event' }], a: 1, opts: [
    o('To thank someone for a seminar', 'same', { src: { s: 0, t: 'our spring seminar' }, why: '첫 문장은 인사예요.', ko: '세미나에 고마워하려고' }),
    o('To invite someone to give a talk', 'match', { pairs: [['speak at our next event', 'give a talk']], ko: '강연을 부탁하려고' }),
    o('To announce a change of hotel', 'none', { ko: '호텔이 바뀐 것을 알리려고' }),
    o('To request a payment by Friday', 'same', { src: { s: 3, t: 'by Friday' }, why: '금요일까지 알려 달라는 것뿐이에요.', ko: '금요일까지 돈을 내라고 하려고' }),
  ] }] });
  set('qReq', { docs: ['qReq'], qs: [{ id: 'qReq', type: 'request', q: 'What is Ms. Ito asked to do?', key: ['asked to do'], ev: [{ s: 2, t: 'please return the signed contract' }], a: 3, opts: [
    o('Join a different team', 'none', { ko: '다른 팀에 들어가기' }),
    o('Start work on a Friday', 'contra', { src: { s: 1, t: 'Monday, June 2' }, why: '첫 출근은 월요일이에요.', ko: '금요일에 일 시작하기' }),
    o('Visit the HR office on June 2', 'same', { src: { s: 2, t: 'the HR office' }, why: '인사과는 계약서를 보낼 곳이고, 6월 2일은 첫 출근 날이에요.', ko: '6월 2일에 인사과 가기' }),
    o('Send back a document', 'match', { pairs: [['return the signed contract', 'Send back a document']], ko: '서류 돌려보내기' }),
  ] }] });
  set('qCell', { docs: ['qCell'], qs: [{ id: 'qCell', type: 'form', q: 'How much does Express delivery cost?', key: ['How much', 'Express'], ev: [{ s: 1, t: '$25' }], col: 2, a: 1, opts: [
    o('Free', 'cell', { src: { s: 0, t: 'Free' }, why: '보통 배송(Standard) 줄이에요.', ko: '무료' }),
    o('$25', 'match', { ko: '25달러' }),
    o('$45', 'cell', { src: { s: 2, t: '$45' }, why: '익일 배송(Overnight) 줄이에요.', ko: '45달러' }),
    o('2 days', 'cell', { src: { s: 1, t: '2 days' }, why: '같은 줄의 다른 칸(걸리는 날)이에요.', ko: '이틀' }),
  ] }] });
  set('qSyn', { docs: ['qSyn'], qs: [{ id: 'qSyn', type: 'synonym', q: 'The word “address” is closest in meaning to', key: ['“address”'], word: 'address', par: 1, ev: [{ s: 0, t: 'address the problem' }], a: 2, opts: [
    o('location', 'dict', { why: 'address → 단어장의 첫 뜻 ‘주소’.', ko: '장소, 위치' }),
    o('speak to', 'sense', { why: '‘연설하다’ → address the audience 같은 문장의 뜻이에요.', ko: '~에게 연설하다' }),
    o('deal with', 'match', { pairs: [['address the problem', 'deal with']], ko: '다루다, 처리하다' }),
    o('direct', 'sense', { why: '‘(말 · 편지를) ~에게 보내다’ → address a letter to 같은 문장의 뜻이에요.', ko: '(~에게) 보내다' }),
  ] }] });
  set('qChat', { docs: ['qChat'], qs: [{ id: 'qChat', type: 'intent', q: 'At 9:03 A.M., what does Ms. Ruiz mean when she writes, “No problem”?', key: ['9:03 A.M.', '“No problem”'], time: '9:03 A.M.', quote: 'No problem',
    ev: [{ s: 0, t: 'Can you cover my shift on Friday?' }, { s: 1, t: 'No problem' }], a: 0, opts: [
      o('She will work on Friday for Mr. Lee.', 'match', { pairs: [['cover my shift on Friday', 'work on Friday for Mr. Lee']], ko: '이 씨 대신 금요일에 일하겠다.' }),
      o('Her dentist appointment is not serious.', 'same', { src: { s: 0, t: 'I have a dentist appointment' }, why: '치과 예약은 이 씨의 일이에요. 루이스 씨의 대답과 관계없어요.', ko: '그녀의 치과 예약은 심각하지 않다.' }),
      o('Nothing is wrong with the schedule.', 'literal', { why: 'No problem → 말 그대로 ‘문제가 없다’가 아니라 부탁을 들어주겠다는 대답이에요.', ko: '일정에 아무 문제가 없다.' }),
      o('She cannot work on Friday.', 'contra', { src: { s: 1, t: 'No problem' }, why: '부탁을 들어주는 대답이에요.', ko: '금요일에 일할 수 없다.' }),
    ] }] });
  set('qIns', { docs: ['qIns'], qs: [{ id: 'qIns', type: 'insert', q: 'In which of the positions marked [1], [2], [3], and [4] does the following sentence best belong?', key: [],
    sent: 'This offer is available to all employees.', sentKo: '이 혜택은 모든 직원이 받을 수 있어요.', ptr: { t: 'This offer', need: 'offer' },
    pos: { 1: ['cafe'], 2: ['menu'], 3: ['offer'], 4: ['ideas'] }, ev: [{ s: 4, t: 'we will offer free coffee for one week' }], a: 2, flow: '무료 커피 → 이 혜택은 모든 직원에게.' }] });
  set('qLink', { docs: ['qLinkAd', 'qLinkMail'], qs: [{ id: 'qLink', type: 'double', q: 'What is suggested about the customer’s order?', key: ['suggested'], ev: [{ d: 1, s: 0, t: '$45' }, { d: 0, s: 0, t: 'over $50' }], a: 3, opts: [
    o('It will be delivered for free.', 'contra', { src: { d: 0, s: 0, t: 'Free delivery on all orders over $50' }, why: '45달러는 50달러를 넘지 않아요.', ko: '무료로 배달된다.' }),
    o('It will cost $50.', 'same', { src: { d: 0, s: 0, t: 'over $50' }, why: '50달러는 무료 배달의 조건이에요. 주문은 45달러.', ko: '50달러가 든다.' }),
    o('It was placed by phone.', 'none', { ko: '전화로 주문했다.' }),
    o('It does not qualify for free delivery.', 'match', { pairs: [['over $50', 'not qualify for free delivery']], why: '45달러(이메일) → 50달러 넘게(광고)에 모자라요.', ko: '무료 배달 조건에 맞지 않는다.' }),
  ] }] });

  /* ---------- 도우미 ---------- */
  R7.MINI = ['qAdm', 'qPurp', 'qReq', 'qCell', 'qSyn', 'qChat', 'qIns', 'qLink'];
  R7.Q = {};
  Object.values(SETS).forEach(S => {
    S.D = S.docs.map(id => D[id]);
    S.en = S.D.length === 1 ? S.D[0].en : S.D.length === 2 ? `${S.D[0].en} and ${S.D[1].en}` : `${S.D.slice(0, -1).map(x => x.en).join(', ')}, and ${S.D[S.D.length - 1].en}`;
    S.qs.forEach(q => { q.set = S.id; q.S = S; q.ev = q.ev || []; q.ev.forEach(e => { e.d = e.d || 0; }); q.opts && q.opts.forEach(x => { if (x.src) x.src.d = x.src.d || 0; }); R7.Q[q.id] = q; });
  });
  // 글의 단위 목록: { text, type: 'sent' | 'mark' | 'msg' | 'row' | 'foot', par, n(자리 번호), who, time, cells }
  R7.units = function (d) {
    if (d.U) return d.U;
    if (d.kind === 'chat') d.U = d.msgs.map(m => ({ text: m.t, type: 'msg', who: m.who, time: m.time }));
    else if (d.kind === 'form') d.U = d.rows.map(r => ({ text: r.join(' | '), type: 'row', cells: r })).concat((d.foot || []).map(t => ({ text: t, type: 'foot' })));
    else d.U = d.sents.map((t, i) => { const m = t.match(/^\[(\d)\]$/); return m ? { text: t, type: 'mark', n: +m[1], par: d.par[i] } : { text: t, type: 'sent', par: d.par[i] }; });
    return d.U;
  };
  Object.values(D).forEach(d => R7.units(d));
  R7.unitText = (S, d, s) => s === -1 ? S.D[d].head.join(' · ') : (R7.units(S.D[d])[s] || {}).text || '';
  R7.has = (S, r) => !!r && R7.unitText(S, r.d || 0, r.s).includes(r.t);
  R7.sameUnit = (a, b) => (a.d || 0) === (b.d || 0) && a.s === b.s;
  R7.inEv = (q, r) => !!r && q.ev.some(e => R7.sameUnit(e, r));
  R7.evDocs = q => [...new Set(q.ev.map(e => e.d))];
  // 문장 삽입: 보기 [1]~[4]를 만들고 자리마다 짝을 계산
  Object.values(R7.Q).filter(q => q.type === 'insert').forEach(q => {
    const U = R7.units(q.S.D[0]);
    q.opts = [1, 2, 3, 4].map(n => {
      const at = U.findIndex(u => u.type === 'mark' && u.n === n);
      let prev = at - 1; while (prev >= 0 && U[prev].type === 'mark') prev--;
      const fits = (q.pos[n] || []).includes(q.ptr.need);
      return { t: `[${n}]`, n, at, prev, rel: fits ? 'fit' : 'nopair', src: { d: 0, s: prev, t: '' }, ko: `${n}번 자리` };
    });
  });

  /* ---------- 낱말 견주기 (그대로 반복 찾기) ---------- */
  const STOP = new Set(('a an the and or but of to in on at for by with from as is are was were be been being will would can could should may might must do does did have has had ' +
    'this that these those it its they them their there here our your you we us i my me he she his her him not no all any some more most other such than then so if about into ' +
    'over after before during per each every also very just only up out what which who when where why how please mr ms let get got one two three').split(' '));
  const stem = w => w.length > 4 ? w.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '') : w;
  R7.words = s => (String(s).toLowerCase().replace(/[’']s\b/g, '').match(/[a-z]+|\d[\d,.:]*\d|\d/g) || []).filter(w => !STOP.has(w) && (w.length > 1 || /\d/.test(w)));
  const setWords = S => { if (!S.W) { S.W = new Set(); S.D.forEach((d, di) => { R7.units(d).forEach(u => R7.words(u.text).forEach(w => S.W.add(stem(w)))); (d.head || []).forEach(h => R7.words(h).forEach(w => S.W.add(stem(w)))); }); } return S.W; };
  // 보기에서 지문의 낱말을 그대로 쓴 것 (보기에 쓰인 모양으로)
  R7.echo = function (q, k) {
    const W = setWords(q.S), seen = new Set();
    // 사람 이름(Mr. Hale)은 지문과 같아도 함정이 아니므로 빼고 견줌
    return R7.words(q.opts[k].t.replace(/\b(Mr|Ms|Mrs|Dr)\.\s+[A-Z][a-z]+/g, '')).filter(w => { const s = stem(w); if (!W.has(s) || seen.has(s)) return false; seen.add(s); return true; });
  };

  /* ---------- 위치 이름 ---------- */
  const ORD = ['첫', '둘째', '셋째', '넷째', '다섯째', '여섯째'];
  R7.loc = function (q, r) {
    const S = q.S, d = S.D[r.d || 0], U = R7.units(d), pre = S.D.length > 1 ? `글 ${(r.d || 0) + 1}(${d.label}) ` : '';
    if (r.s === -1) return pre + '머리말';
    const u = U[r.s];
    if (!u) return pre + '?';
    if (u.type === 'msg') return pre + `${u.time} 메시지`;
    if (u.type === 'row') return pre + `표의 ‘${u.cells[0]}’ 줄`;
    if (u.type === 'foot') return pre + '표 아래';
    const sents = U.map((x, i) => [x, i]).filter(([x]) => x.type === 'sent');
    if (sents[0][1] === r.s) return pre + '첫 문장';
    if (sents[sents.length - 1][1] === r.s) return pre + '마지막 문장';
    return pre + `${ORD[u.par] || u.par + 1} 문단`;
  };
  const quote = s => `‘${s}’`;
  const at = (q, r) => r ? `${R7.loc(q, r)}${r.t ? ' ' + quote(r.t) : ''}` : '';
  const pairText = ps => ps.map(([a, b]) => `${quote(a)} → ${quote(b)}`).join(', ');

  /* ---------- 규칙 엔진 ---------- */
  function why(q, k) {
    const x = q.opts[k], extra = x.why ? ' ' + x.why : '';
    switch (x.rel) {
      case 'match':
        if (x.pairs && x.pairs.length) return `${pairText(x.pairs)}. 같은 뜻을 다른 말로 바꿨어요.${extra}`;
        if (R7.evDocs(q).length > 1) return `글 ${R7.evDocs(q).length}개의 근거를 이어서 얻은 답이에요.${extra}`;
        return `근거 ${at(q, q.ev[q.ev.length - 1])} → 보기와 같은 말이에요. 숫자 · 시각 · 이름은 그대로 나오기도 해요.${extra}`;
      case 'fit': return `${quote(q.ptr.t)} = [${x.n}] 앞 문장의 ${quote(q.ev[0].t)}. 가리키는 말의 짝이 맞아요. ${q.flow || ''}`.trim();
      case 'nopair': {
        const has = (q.pos[x.n] || []).map(h => R7.NEED[h] || h).join(' · ');
        return `[${x.n}] 앞 문장은 ${has} 이야기예요. ${quote(q.ptr.t)} → 가리킬 짝(${R7.NEED[q.ptr.need]})이 없어요.`;
      }
      case 'stated': return `${at(q, x.src)} → 지문에 있어요${x.pairs ? `(${pairText(x.pairs)})` : ''}. NOT 문제라서 답이 아니에요.`;
      case 'none': return q.not ? `지문 어디에도 없어요 → NOT 문제의 답이에요.${extra}` : `지문에 없는 내용이에요.${extra}`;
      case 'same': { const e = R7.echo(q, k); return `${e.length ? e.map(quote).join(' · ') + ' → ' : ''}지문의 낱말을 그대로 썼지만 뜻이 달라요.${extra}`; }
      case 'contra': return `${at(q, x.src)} → 지문과 반대예요.${extra}`;
      case 'literal': return `말 그대로의 뜻이에요. 채팅의 말은 앞 메시지에 대한 대답으로 읽어요.${extra}`;
      case 'dict': return `${x.why || '단어장의 첫 뜻이에요.'} 이 문장 속 뜻이 아니에요.`;
      case 'sense': return x.why || '다른 문장에서 쓰는 뜻이에요.';
      case 'off': return `${at(q, x.src)} → 지문에 있는 말이지만 질문이 묻는 것이 아니에요.${extra}`;
      case 'who': return `${at(q, x.src)} → 다른 사람 · 대상의 이야기예요.${extra}`;
      case 'when': return `${at(q, x.src)} → 다른 때의 일이에요.${extra}`;
      case 'doc': return `${at(q, x.src)} → 이 글만 보면 그럴듯하지만 다른 글이 답을 정해요.${extra}`;
      case 'cell': return `${at(q, x.src)} → 옆 줄 · 옆 칸의 값이에요.${extra}`;
    }
    return '';
  }
  // 판정: { s: 'ok' | 'no', step, rel, why, src }
  R7.judge = function (q, k) {
    const x = q.opts[k], ok = q.not ? x.rel === 'none' : x.rel === 'match' || x.rel === 'fit';
    const step = ok ? 3 : R7.REL[x.rel].step;
    const name = ok && q.not ? '지문에 없음 → 정답' : x.rel === 'match' && !(x.pairs && x.pairs.length) ? (R7.evDocs(q).length > 1 ? '근거를 이음' : '근거와 같음') : R7.REL[x.rel].name;
    return { s: ok ? 'ok' : 'no', step, rel: x.rel, name, why: why(q, k), src: x.src };
  };
  R7.isOk = (q, k) => R7.judge(q, k).s === 'ok';
  R7.answer = q => q.opts.map((_, k) => k).filter(k => R7.isOk(q, k));
  // NOT 문제의 근거 = 지문에 있는 보기 셋이 나온 곳
  R7.evOf = q => q.not ? q.opts.filter(x => x.rel === 'stated').map(x => x.src) : q.ev;
  // 놀이터: 누른 단위가 근거인가. { ev: 몇 번째 근거(-1이면 아님), why }
  R7.tap = function (q, d, s) {
    const evs = R7.evOf(q), i = evs.findIndex(e => (e.d || 0) === d && e.s === s);
    if (i >= 0) {
      const e = evs[i];
      if (q.not) { const k = q.opts.findIndex(x => x.src === e); return { ev: i, why: `근거예요. 보기 (${L4[k]})의 내용이 여기 있어요 → ${quote(e.t)}.` }; }
      return { ev: i, why: `근거예요 → ${quote(e.t)}.` + (evs.length > 1 ? ` 근거 ${evs.length}개 가운데 하나예요.` : '') };
    }
    const k = q.opts.findIndex(x => x.src && (x.src.d || 0) === d && x.src.s === s && !R7.isOk(q, q.opts.indexOf(x)));
    if (k >= 0) return { ev: -1, trap: k, why: `근거가 아니에요. 보기 (${L4[k]})의 말이 나온 곳이에요 → ${R7.judge(q, k).name}.` };
    return { ev: -1, why: `이 문장에는 질문의 답이 없어요. ${R7.TYPE[q.type].name} 문제 → ${R7.TYPE[q.type].look}${q.type === 'detail' || q.type === 'true' ? `(${q.key.join(' · ')})` : ''}을 찾아 보세요.` };
  };

  /* ---------- 3단계 풀이 (연습 문제 힌트 · 영상 · 놀이터) ----------
   * marks: { d, s, t(없으면 단위 전체), role } — role: ev 근거 단위 · cue 근거 글자 · key 키워드 · para 바꿔 말한 말 · trap 함정
   * qmarks: 질문 속 키워드, omarks: { 보기 번호: [{ t, role }] }, links: [[근거, 근거]] (다른 글 사이)
   */
  R7.steps = function (q) {
    const T = R7.TYPE[q.type], S = [], a = q.a, ans = q.opts[a], js = q.opts.map((_, k) => R7.judge(q, k));
    const gone = st => js.map((j, k) => [j, k]).filter(([j]) => j.s === 'no' && j.step === st).map(([j, k]) => `(${L4[k]}) ${j.name}`).join(', ');
    // ①
    let t1 = `${T.name} 문제예요. ${T.where}`;
    if (q.key.length) t1 += ` 키워드: ${q.key.map(quote).join(' · ')}.`;
    if (q.type === 'insert') t1 += ` 넣을 문장의 가리키는 말 → ${quote(q.ptr.t)}.`;
    if (q.type === 'synonym') t1 += ` 낱말 ${quote(q.word)}이 있는 문장을 찾아요.`;
    if (q.type === 'intent') t1 += ` 인용한 말 → ${q.time} ${quote(q.quote)}.`;
    const m1 = [];
    if (q.type === 'synonym') m1.push({ d: q.ev[0].d, s: q.ev[0].s, t: q.word, role: 'key' });
    if (q.type === 'intent') { const e = q.ev[q.ev.length - 1]; m1.push({ d: e.d, s: e.s, role: 'key' }, { d: e.d, s: e.s, t: q.quote, role: 'key' }); }
    if (q.kp) q.kp.forEach(([qa]) => q.S.D.forEach((dd, di) => R7.units(dd).forEach((u, s) => { if (u.text.includes(qa)) m1.push({ d: di, s, t: qa, role: 'key' }); })));
    S.push({ head: '① 질문 먼저 읽어요.', text: t1, marks: m1, qmarks: q.key.map(t => ({ t, role: 'key' })), omarks: q.type === 'insert' ? {} : {}, sentMarks: q.type === 'insert' ? [{ t: q.ptr.t, role: 'key' }] : [] });
    // ②
    const evs = R7.evOf(q);
    let t2;
    if (q.not) t2 = q.opts.map((x, k) => x.rel === 'stated' ? `(${L4[k]}) → ${at(q, x.src)}` : null).filter(Boolean).join(', ') + `. 나머지 (${L4[a]}) → 지문에서 찾을 수 없어요.`;
    else if (q.type === 'insert') t2 = `${quote(q.ptr.t)}의 짝 → [${ans.n}] 앞 문장의 ${quote(q.ev[0].t)}. 다른 자리의 앞 문장에는 짝이 없어요.`;
    else if (q.type === 'intent') t2 = `바로 앞 메시지 → ${at(q, q.ev[0])}. 인용한 말은 이 말에 대한 대답이에요.`;
    else t2 = `근거 → ${evs.map(e => at(q, e)).join(' + ')}.` + (q.kp ? ` 질문의 ${q.kp.map(([x, y]) => `${quote(x)} = 지문의 ${quote(y)}`).join(', ')}.` : '');
    const g2 = gone(2);
    if (g2 && !q.not) t2 += ` 지울 보기: ${g2}.`;
    const links = [];
    for (let i = 1; i < evs.length; i++) if ((evs[i].d || 0) !== (evs[i - 1].d || 0)) links.push([evs[i - 1], evs[i]]);
    S.push({ head: '② 근거를 찾아요.', text: t2, marks: evs.map(e => ({ d: e.d || 0, s: e.s, role: 'ev' })).concat(evs.filter(e => e.t).map(e => ({ d: e.d || 0, s: e.s, t: e.t, role: 'cue' }))), links });
    // ③
    let t3;
    if (q.type === 'insert') t3 = `정답 [${ans.n}]. 넣어서 읽어 봐요: ${q.flow || ''}`;
    else if (q.not) t3 = `셋은 지문에 있어요. 바꿔 말한 것도 ‘있는 것’이에요(${q.opts.filter(x => x.pairs).map(x => pairText(x.pairs)).join(', ')}). 정답 (${L4[a]}).`;
    else {
      t3 = `정답 (${L4[a]}) → ` + (ans.pairs && ans.pairs.length ? `${pairText(ans.pairs)}. 같은 뜻, 다른 말이에요.` : R7.evDocs(q).length > 1 ? `${ans.why || '근거를 이어서 얻은 답이에요.'}` : '근거와 같은 말이에요. 숫자 · 시각 · 이름은 그대로 나오기도 해요.');
      const g3 = gone(3); if (g3) t3 += ` 지울 보기: ${g3}.`;
    }
    const m3 = [], om = {};
    if (!q.not && ans.pairs) ans.pairs.forEach(([x, y]) => { evs.forEach(e => { if (R7.unitText(q.S, e.d || 0, e.s).includes(x)) m3.push({ d: e.d || 0, s: e.s, t: x, role: 'para' }); }); (om[a] = om[a] || []).push({ t: y, role: 'para' }); });
    if (q.not) q.opts.forEach((x, k) => { if (x.pairs) x.pairs.forEach(([p, y]) => { m3.push({ d: x.src.d || 0, s: x.src.s, t: p, role: 'para' }); (om[k] = om[k] || []).push({ t: y, role: 'para' }); }); });
    q.opts.forEach((x, k) => { if (x.rel === 'same') { R7.echo(q, k).forEach(w => (om[k] = om[k] || []).push({ t: w, role: 'trap', word: true })); if (x.src) m3.push({ d: x.src.d || 0, s: x.src.s, t: x.src.t, role: 'trap' }); } });
    S.push({ head: '③ 바꿔 말한 보기를 골라요.', text: t3, marks: m3, omarks: om, ins: q.type === 'insert' ? ans.n : null });
    return S;
  };
  // 보기별 해설
  R7.notes = q => q.opts.map((_, k) => { const j = R7.judge(q, k); return j.s === 'ok' ? `정답 · ${j.name}. ${j.why}` : `× ${R7.STEP[j.step - 1]} · ${j.name}. ${j.why}`; });
  R7.tag = q => `${R7.TYPE[q.type].name} (${R7.TYPE[q.type].no})`;

  /* ---------- 바꿔 말하기 짝 (영상 02장 · 직접 해 보기) ---------- */
  R7.PARA = [
    { text: 'fully booked', same: 'no vacancies', ko: '방이 다 참 = 빈방 없음', traps: ['booked online', 'fully paid'] },
    { text: 'at no charge', same: 'free', ko: '돈을 받지 않음 = 무료', traps: ['charged in full', 'no change'] },
    { text: 'postpone', same: 'move to a later date', ko: '미루다 = 나중 날짜로 옮기다', traps: ['post online', 'cancel'] },
    { text: 'a ten-minute walk', same: 'nearby', ko: '걸어서 10분 = 가까운 곳', traps: ['ten minutes late', 'a long walk'] },
    { text: 'annual', same: 'every year', ko: '해마다 하는 = 매년', traps: ['once', 'announced'] },
    { text: 'reply', same: 'respond', ko: '답장하다 = 응답하다', traps: ['repeat', 'replace'] },
  ];

  /* ---------- 연습 문제: 세트 다섯 · 문제 열여섯 ---------- */
  R7.DRILL = ['mag', 'store', 'classes', 'conf', 'desk'];
  R7.drillItems = () => R7.DRILL.map(id => SETS[id].qs).flat().map(q => ({ q, sid: q.set, opts: q.opts.map(x => x.t), a: q.a, steps: R7.steps(q), notes: R7.notes(q), tag: R7.tag(q) }));
  // 놀이터 '근거 사냥'의 세트
  R7.HUNT = ['hotel', 'elevator', 'library', 'invoice', 'chat', 'catering', 'workshop', 'bikes'];

  /* ---------- 데이터 점검 ---------- */
  R7.check = function () {
    const bad = [];
    Object.values(D).forEach(d => {
      const U = R7.units(d);
      if (!d.ko || d.ko.length !== U.length) bad.push(`${d.id}: 해석 수(${d.ko && d.ko.length})가 단위 수(${U.length})와 달라요`);
      if (d.par && d.par.length !== d.sents.length) bad.push(`${d.id}: 문단 번호 수가 문장 수와 달라요`);
    });
    Object.values(SETS).forEach(S => S.qs.forEach(q => {
      const id = q.id, T = R7.TYPE[q.type];
      if (!T) { bad.push(`${id}: 모르는 문제 유형 ${q.type}`); return; }
      if (q.opts.length !== 4) bad.push(`${id}: 보기가 넷이 아니에요`);
      const good = R7.answer(q);
      if (good.length !== 1 || good[0] !== q.a) bad.push(`${id}: 정답 ${q.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      q.key.forEach(k => { if (!q.q.includes(k)) bad.push(`${id}: 키워드 ‘${k}’가 질문에 없어요`); });
      if (!q.not && !q.ev.length) bad.push(`${id}: 근거가 없어요`);
      q.ev.forEach(e => { if (!R7.has(S, e)) bad.push(`${id}: 근거 ‘${e.t}’가 글 ${e.d} 단위 ${e.s}에 없어요`); });
      (q.kp || []).forEach(([x, y]) => { if (!q.q.includes(x)) bad.push(`${id}: 질문 키워드 ‘${x}’가 질문에 없어요`); if (!q.ev.some(e => R7.unitText(S, e.d, e.s).includes(y))) bad.push(`${id}: 바뀐 키워드 ‘${y}’가 근거에 없어요`); });
      q.opts.forEach((x, k) => {
        const tag = `${id} (${L4[k]})`;
        if (!R7.REL[x.rel]) bad.push(`${tag}: 모르는 관계 ${x.rel}`);
        if (!x.ko) bad.push(`${tag}: 보기 해석이 없어요`);
        if (x.src && x.src.t && !R7.has(S, x.src)) bad.push(`${tag}: 보기의 출처 ‘${x.src.t}’가 지문에 없어요`);
        if (['stated', 'contra', 'off', 'who', 'when', 'doc', 'cell'].includes(x.rel) && !x.src) bad.push(`${tag}: ${x.rel} 보기에 출처(src)가 없어요`);
        if (['off', 'who', 'when', 'cell'].includes(x.rel) && R7.inEv(q, x.src) && !(x.rel === 'cell' && q.ev.every(e => e.t !== x.src.t))) bad.push(`${tag}: ${R7.REL[x.rel].name} 보기의 출처가 근거 문장이에요 → ②단계에서 지울 수 없어요`);
        if (x.rel === 'same' && !R7.echo(q, k).length) bad.push(`${tag}: 그대로 반복 함정인데 지문과 같은 낱말이 없어요`);
        (x.pairs || []).forEach(([p, y]) => {
          const from = x.rel === 'stated' ? [x.src] : q.ev;
          if (!from.some(e => R7.unitText(S, e.d || 0, e.s).includes(p))) bad.push(`${tag}: 바꿔 말한 짝 ‘${p}’가 근거에 없어요`);
          if (!x.t.includes(y)) bad.push(`${tag}: 바꿔 말한 짝 ‘${y}’가 보기에 없어요`);
        });
        if (x.rel === 'match' && !['insert', 'detail', 'form'].includes(q.type) && !q.not && R7.echo(q, k).length >= 3 && !(x.pairs && x.pairs.length)) bad.push(`${tag}: 정답이 지문을 그대로 옮겼어요`);
      });
      if (q.not && q.opts.filter(x => x.rel === 'stated').length !== 3) bad.push(`${id}: NOT 문제는 지문에 있는 보기가 셋이어야 해요`);
      if (q.type === 'double' && R7.evDocs(q).length < 2) bad.push(`${id}: 이중 지문 문제인데 근거가 한 글에만 있어요`);
      if (q.type === 'triple' && (S.D.length !== 3 || R7.evDocs(q).length < 2)) bad.push(`${id}: 삼중 지문 문제는 글 셋, 근거는 두 글 이상이어야 해요`);
      if (q.type === 'synonym') {
        const e = q.ev[0], u = R7.units(S.D[e.d])[e.s], words = R7.units(S.D[e.d]).filter(v => v.par === q.par - 1).map(v => v.text).join(' ');
        if (!u || !new RegExp(`\\b${q.word}\\b`).test(u.text)) bad.push(`${id}: 낱말 ‘${q.word}’가 근거 문장에 없어요`);
        if (u && u.par !== q.par - 1) bad.push(`${id}: 낱말이 ${q.par}문단에 있지 않아요`);
        if ((words.match(new RegExp(`\\b${q.word}\\b`, 'g')) || []).length !== 1) bad.push(`${id}: ${q.par}문단에 ‘${q.word}’가 한 번만 나와야 해요`);
        q.opts.forEach((x, k) => { if (/\s/.test(x.t) && x.t.split(' ').length > 2) bad.push(`${id} (${L4[k]}): 동의어 보기가 너무 길어요`); });
      }
      if (q.type === 'intent') {
        const e = q.ev[q.ev.length - 1], u = R7.units(S.D[e.d])[e.s];
        if (!u || u.type !== 'msg' || !u.text.includes(q.quote) || u.time !== q.time) bad.push(`${id}: 인용한 말 · 시각이 메시지와 맞지 않아요`);
        if (q.ev.length < 2 || q.ev[0].s !== e.s - 1) bad.push(`${id}: 의도 파악의 근거는 바로 앞 메시지여야 해요`);
        if (!q.q.includes(q.time) || !q.q.includes(q.quote)) bad.push(`${id}: 질문에 시각 · 인용한 말이 없어요`);
      }
      if (q.type === 'insert') {
        const fits = q.opts.filter(x => x.rel === 'fit');
        if (fits.length !== 1) bad.push(`${id}: 들어갈 자리가 하나가 아니에요`);
        if (!q.sent.includes(q.ptr.t)) bad.push(`${id}: 가리키는 말이 넣을 문장에 없어요`);
        if (q.opts.some(x => x.at < 0)) bad.push(`${id}: 지문에 [1]~[4] 표시가 다 있지 않아요`);
        if (fits[0] && q.ev[0].s !== fits[0].prev) bad.push(`${id}: 근거가 정답 자리의 앞 문장이 아니에요`);
        Object.values(q.pos).flat().forEach(h => { if (!R7.NEED[h]) bad.push(`${id}: 모르는 짝 ‘${h}’`); });
      }
      if (q.type === 'form') {
        const e = q.ev[0], u = R7.units(S.D[e.d])[e.s];
        if (!u || u.type !== 'row') bad.push(`${id}: 양식 문제의 근거는 표의 줄이어야 해요`);
        else if (q.col != null && u.cells[q.col] !== e.t) bad.push(`${id}: 근거 칸(${q.col})의 값이 ‘${e.t}’가 아니에요`);
      }
    }));
    // 연습 문제
    const items = R7.drillItems();
    if (items.length !== 16) bad.push(`연습 문제가 ${items.length}개예요 (16개여야 해요)`);
    const pos = [0, 0, 0, 0]; items.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 0) bad.push('연습 문제 정답 위치가 고르지 않아요: ' + pos.join(','));
    const nos = new Set(items.map(it => R7.TYPE[it.q.type].no)); nos.add(94);
    for (let n = 89; n <= 100; n++) if (!nos.has(n)) bad.push(`연습 문제에 유형 ${n}이 없어요`);
    const kinds = R7.DRILL.map(id => SETS[id].D.length + (SETS[id].D[0].kind === 'chat' ? 'c' : SETS[id].D[0].kind === 'form' && SETS[id].D.length === 1 ? 'f' : ''));
    ['1', '1c', '1f', '2', '3'].forEach(k => { if (!kinds.includes(k)) bad.push(`연습 문제 세트 종류에 ${k}이 없어요`); });
    R7.HUNT.forEach(id => { if (!SETS[id]) bad.push(`놀이터 세트 ${id}가 없어요`); });
    if (!R7.HUNT.some(id => SETS[id].D.length > 1)) bad.push('놀이터에 연계 지문이 없어요');
    R7.PARA.forEach(p => { if (p.traps.length !== 2) bad.push(`바꿔 말하기 짝 ${p.text}: 함정이 둘이 아니에요`); });
    bad.forEach(m => console.warn('[Part 7] ' + m));
    return bad;
  };
})();
