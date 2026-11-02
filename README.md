# 영어 튜토리얼

한림대학교 영어영문학과 학생들이 영어 실력을 **빠르고 확실하게** 다질 수 있도록 만든 인터랙티브 튜토리얼 모음입니다.
문법은 감으로 고르지 않고 **원리로** 풀 수 있게, 짧은 모션그래픽 영상과 직접 해 보기, 단계별 힌트가 있는 연습 문제로 익힙니다.

![관계대명사 튜토리얼의 한 장면](relative-pronouns/docs/poster.jpg)

## 튜토리얼

| 영역 | 튜토리얼 | 길이 | 내용 |
| --- | --- | --- | --- |
| 토익 문법 | [관계대명사, 빈자리를 찾아라](relative-pronouns/) | 6:36 · 12장면 | 꾸미는 말의 자리, 두 문장 합치기, 빈자리 찾기, 주격·목적격·소유격, what, that을 못 쓰는 자리, 3단계 풀이법, 실전 문제 |
| 토익 문법 | [빈칸의 자리가 품사를 정한다](parts-of-speech/) | 6:22 · 12장면 | 낱말 가족, 꼬리표(접미사)와 꼬리가 속이는 말, 문장의 뼈대, 명사·형용사·보어·부사 자리, 복합명사와 사람 명사, 3단계 풀이법, 3초 품사 감각 훈련 |
| 상황별 영어 회화 | 준비 중 | | 공항, 카페, 호텔 같은 장소의 대화 연습 |

모든 튜토리얼에 자막과 음성 해설(한국어는 한국어 음성, 영어는 영어 음성), 발음 듣기, 장면별 ‘직접 해 보기’, 놀이터, 연습 문제, 퀴즈, 핵심 정리가 있습니다.

## 보는 방법

- **내 컴퓨터에서**: 저장소를 내려받아 맨 위의 `index.html`을 더블클릭하세요. 설치할 것이 없고, 인터넷이 없으면 글꼴만 기본 글꼴로 바뀝니다.
- **웹 주소**: 저장소 **Settings → Pages**에서 *Deploy from a branch* → 기본 브랜치 / `(root)`를 고르면 `https://vadoro.github.io/eng_tutorials/` 에서 열립니다.

## 앞으로의 계획

단계별로 하나씩 만들어 갑니다.

1. **토익 문법** — 자주 틀리는 유형 100개를 21개 카테고리, 튜토리얼 17개로 정리했어요: [docs/toeic-100-types.md](docs/toeic-100-types.md). 관계대명사(T01)와 품사 자리(T02)를 만들었고, 다음은 동사 ① 수 일치와 능동·수동(T03)이에요.
2. **상황별 영어 회화** — 공항, 카페처럼 특정 장소에서 오가는 대화를 듣고 따라 말하며 연습합니다.
3. **새 영역** — 필요할 때마다 `assets/catalog.js`의 `tracks`에 영역을 더해 넓혀 갑니다.

## 구조

```
index.html              사이트 첫 화면 (영역별 튜토리얼 카드)
assets/catalog.js       영역(tracks)과 튜토리얼 목록 — 새 튜토리얼은 여기에 한 항목 추가
assets/site-bar.js      각 튜토리얼 위에 붙는 공통 상단 바
assets/site.css         첫 화면 디자인
assets/favicon.svg      파비콘
shared/narration.js     공통 부품: 음성 해설(한·영 나눠 읽기) + 발음 듣기 (EN.narration, EN.say)
shared/drill.js         공통 부품: 토익 Part 5 연습 문제, 단계별 힌트 (EN.drill)
shared/quiz.js          공통 부품: 퀴즈 (EN.quiz)
shared/components.css   공통 부품 모양
tools/render-video.cjs  어느 튜토리얼이든 MP4 · 자막 원고 · 미리보기 그림으로 내보내기
relative-pronouns/      관계대명사, 빈자리를 찾아라 (토익 문법 T01)
parts-of-speech/        빈칸의 자리가 품사를 정한다 (토익 문법 T02)
docs/toeic-100-types.md 토익에서 자주 틀리는 100개 유형, 21개 카테고리, 튜토리얼 17개 계획
CLAUDE.md               새 튜토리얼을 만들 때 지킬 규칙과 확인 목록
```

튜토리얼마다 폴더 안에서 완결되고, 사이트 공통 파일(`assets/`, `shared/`)만 `../`로 불러옵니다. 각 폴더의 README에 장면 구성, 조작법, 영상 다시 만드는 법이 있어요.

## 튜토리얼 추가하기

1. 가장 가까운 튜토리얼 폴더를 복사해 시작합니다: `cp -r relative-pronouns <새-폴더>`.
2. `grammar.js`(규칙 엔진과 예문), `scenes.js`(장면·자막), `app.js`(직접 해 보기·놀이터·퀴즈), `index.html`(제목·핵심 정리)을 내용에 맞게 바꿉니다.
3. 미리보기 그림과 자막 원고를 만듭니다(Node.js, ffmpeg, Playwright 필요).
   ```bash
   node tools/render-video.cjs <새-폴더> --poster 30   # → <새-폴더>/docs/poster.jpg
   node tools/render-video.cjs <새-폴더> --srt         # → <새-폴더>/video/<새-폴더>.srt
   ```
4. `assets/catalog.js`에 항목을 추가하면 첫 화면에 카드가 생깁니다. 이 README의 표에도 한 줄을 추가합니다.

자세한 규칙(장면 형식, 음성 해설, 공통 부품, 영상 렌더링, 확인 목록)은 [CLAUDE.md](CLAUDE.md)에 있습니다.

## 만든 방식

[DH 튜토리얼](https://vadoro.github.io/dh_tutorials/)의 인터랙티브 모션그래픽 형식(시간 t만으로 그리는 캔버스 영상, 장면별 실습, 놀이터, 퀴즈, MP4 추출)을 바탕으로, 영어 교육에 맞게 한·영 음성 해설, 발음 듣기, 문법 역할 색, 규칙 엔진, 단계별 힌트 연습 문제를 더했습니다.
