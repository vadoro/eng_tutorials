/* 영어 튜토리얼 목록 — 사이트 첫 화면과 각 튜토리얼 위의 상단 바가 이 목록을 함께 씁니다.
 * 새 튜토리얼을 만들면 아래 tutorials 배열에 항목 하나를 추가하세요. 새 영역이 생기면 tracks에 추가하세요. (CLAUDE.md 참고)
 *
 * tracks — 학습 영역 (첫 화면에서 묶음으로 보여 줌, 배열 순서대로)
 *   id        영역 이름표 (tutorials의 track과 맞춤)
 *   title     영역 이름
 *   summary   한두 문장 소개
 *   status    'open' 공개 중 | 'soon' 준비 중 (튜토리얼이 없어도 첫 화면에 '준비 중'으로 보임)
 *
 * tutorials — 튜토리얼 하나 = 폴더 하나
 *   slug      폴더 이름이자 주소. 예: relative-pronouns → relative-pronouns/index.html
 *   track     속한 영역 (tracks의 id)
 *   title     튜토리얼 이름
 *   topic     다루는 문법·상황 (카드 위 작은 글씨)
 *   summary   한두 문장 소개
 *   length    영상 길이 (분:초)
 *   scenes    장면 수
 *   features  카드에 칩으로 보여 줄 기능
 *   types     (토익 문법) 다루는 유형 번호 — docs/toeic-100-types.md의 100개 유형 번호
 *   thumb     16:9 미리보기 그림 (사이트 루트 기준 경로)
 *   added     처음 올린 날짜 (YYYY-MM-DD)
 *
 * fetch() 대신 스크립트로 읽기 때문에 index.html을 더블클릭해 열어도 동작합니다.
 */
window.EN_CATALOG = {
  site: {
    title: '영어 튜토리얼',
    org: '한림대학교 영어영문학과',
  },
  tracks: [
    {
      id: 'toeic',
      title: '토익 문법',
      summary: '토익 Part 5·6에서 자주 틀리는 문법 유형을 원리부터 풀이법까지. 유형마다 모션그래픽 영상, 직접 해 보기, 연습 문제가 함께 있어요.',
      status: 'open',
    },
    {
      id: 'talk',
      title: '상황별 영어 회화',
      summary: '공항, 카페, 호텔처럼 실제 장소에서 오가는 대화를 듣고 따라 말하며 익혀요.',
      status: 'soon',
    },
  ],
  tutorials: [
    {
      slug: 'relative-pronouns',
      track: 'toeic',
      title: '관계대명사, 빈자리를 찾아라',
      topic: '관계대명사 · who · whom · which · that · whose · what',
      summary: '두 문장이 하나로 합쳐지는 원리, 관계사절 속 빈자리 찾기, 그리고 토익 문제를 앞 → 뒤 → 함정 3단계로 푸는 법을 배워요.',
      length: '6:36',
      scenes: 12,
      features: ['음성 해설', '발음 듣기', '장면별 실습', '문장 합치기 놀이터', '연습 문제 16', '퀴즈'],
      types: [12, 36, 37, 38, 39],
      thumb: 'relative-pronouns/docs/poster.jpg',
      added: '2026-11-02',
    },
    {
      slug: 'parts-of-speech',
      track: 'toeic',
      title: '빈칸의 자리가 품사를 정한다',
      topic: '품사 자리 · 명사 · 형용사 · 부사',
      summary: '같은 뿌리의 보기 네 개 중에서 고르는 품사 문제를 해석 없이 푸는 법. 낱말의 꼬리(접미사)와 빈칸의 자리, 보기 → 자리 → 꼬리 3단계 풀이법을 배워요.',
      length: '6:22',
      scenes: 12,
      features: ['음성 해설', '발음 듣기', '장면별 실습', '3초 품사 감각 훈련', '낱말 가족 사전', '연습 문제 16', '퀴즈'],
      types: [1, 2, 3, 4, 5, 6, 7, 8],
      thumb: 'parts-of-speech/docs/poster.jpg',
      added: '2026-11-02',
    },
    {
      slug: 'verb-agreement-voice',
      track: 'toeic',
      title: '주어가 수를, 목적어가 태를 정한다',
      topic: '수 일치 · 능동태 · 수동태 · 자동사',
      summary: '같은 동사의 여러 모양 가운데 하나를 고르는 동사 문제를 원리로 푸는 법. 수식어를 지워 진짜 주어를 찾고, 빈칸 뒤의 목적어로 능동·수동을 가르는 주어 → 수 → 뒤 3단계 풀이법을 배워요.',
      length: '6:29',
      scenes: 12,
      features: ['음성 해설', '발음 듣기', '장면별 실습', '능동·수동 변환기', '진짜 주어 누르기', '연습 문제 16', '퀴즈'],
      types: [9, 10, 11, 13, 14, 15],
      thumb: 'verb-agreement-voice/docs/poster.jpg',
      added: '2026-11-02',
    },
    {
      slug: 'verb-tense',
      track: 'toeic',
      title: '시간선 위에 동사를 놓아라',
      topic: '시제 · 현재완료 · 미래완료 · 부사절 · 동사원형',
      summary: '시제 문제를 해석 대신 시간 단서로 푸는 법. 단서를 시간선에 놓고 과거·현재완료·미래·완료형을 고르고, 부사절의 현재 시제와 요구·제안 that절의 동사원형 함정을 단서 → 시간선 → 모양 3단계로 익혀요.',
      length: '6:26',
      scenes: 12,
      features: ['음성 해설', '발음 듣기', '장면별 실습', '시간선 시제 기계', '연습 문제 16', '퀴즈'],
      types: [16, 17, 18, 19, 20],
      thumb: 'verb-tense/docs/poster.jpg',
      added: '2026-11-02',
    },
    {
      slug: 'connectors',
      track: 'toeic',
      title: '접속사냐 전치사냐, 빈칸 뒤가 답한다',
      topic: '연결어 · 접속사 · 전치사 · 접속부사',
      summary: '뜻이 같은 although와 despite 가운데 하나만 답이 되는 까닭. 빈칸 뒤가 명사구냐 절이냐로 갈래를 정하고, 뒤 → 갈래 → 뜻 3단계로 연결어 문제를 풀어요.',
      length: '5:52',
      scenes: 11,
      features: ['음성 해설', '발음 듣기', '장면별 실습', '연결어 조립대', '연결어 사전', '연습 문제 16', '퀴즈'],
      types: [31, 32, 33, 34, 35],
      thumb: 'connectors/docs/poster.jpg',
      added: '2026-11-02',
    },
    {
      slug: 'nouns-articles',
      track: 'toeic',
      title: '명사 검문소를 통과하라',
      topic: '명사 · 관사 · 수량 표현 · almost · most of',
      summary: '한국어 ‘책 샀어’가 영어에서는 a book · the book · books로 갈라지는 까닭. 셀 수 있나 → 하나인가 여럿인가 → 짝이 맞나, 명사 검문소의 세 문으로 관사와 수량 표현 문제를 풀어요.',
      length: '6:02',
      scenes: 11,
      features: ['음성 해설', '발음 듣기', '장면별 실습', '명사 검문소 놀이터', '연습 문제 16', '퀴즈'],
      types: [47, 48, 49, 50, 51],
      thumb: 'nouns-articles/docs/poster.jpg',
      added: '2026-11-02',
    },
  ],
};
