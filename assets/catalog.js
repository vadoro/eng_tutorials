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
  ],
};
