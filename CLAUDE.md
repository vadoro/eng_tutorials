# 영어 튜토리얼 — 작업 규칙

한림대학교 영어영문학과 학생을 위한 영어 학습 사이트입니다. 문법·회화를 **인터랙티브 모션그래픽 영상**과 연습 문제로 설명합니다.
튜토리얼 하나 = 폴더 하나이고, 사이트 첫 화면(`index.html`)이 영역(tracks)별로 목록을 보여 줍니다. 이 문서는 새 튜토리얼을 추가하거나 고칠 때 지킬 규칙입니다.
형식은 `vadoro/dh_tutorials`(DH 튜토리얼)에서 가져왔고, 영어 교육에 맞게 한·영 음성, 발음 듣기, 규칙 엔진, 단계별 힌트 연습 문제를 더했습니다.

## 구조

```
index.html              사이트 첫 화면 (영역별 카드, assets/catalog.js를 읽어 그림)
assets/catalog.js       영역(tracks)과 튜토리얼(tutorials) 목록 — 첫 화면과 상단 바가 함께 씀 (단일 출처)
assets/site-bar.js      각 튜토리얼 위에 붙는 공통 상단 바 (섀도 DOM, 추출 화면에서는 안 붙음)
assets/site.css         첫 화면 디자인 토큰(밝은/어두운 테마)
assets/favicon.svg      파비콘 — 청록 둥근 사각형에 흰 EN(글자는 도형으로 그려 글꼴과 무관)
shared/narration.js     공통 부품: 음성 해설 EN.narration, 발음 듣기 EN.say, 한·영 나누기 EN.splitLang
shared/drill.js         공통 부품: 토익 Part 5 연습 문제 EN.drill (한 문제씩, 단계별 힌트)
shared/quiz.js          공통 부품: 퀴즈 EN.quiz
shared/components.css   공통 부품 모양: 발음 단추(.en-say), 퀴즈(.enq), 연습 문제(.edr), 핵심 정리(.en-gloss)
tools/render-video.cjs  공통 렌더러: EN_EXPORT 약속을 지킨 튜토리얼을 MP4·SRT·미리보기 그림으로
<slug>/index.html       튜토리얼 본체. 폴더 안에서 완결됨
<slug>/assets/js/       grammar.js(규칙 엔진·예문·문제) · scenes.js(장면·자막) · app.js(플레이어·실습·놀이터·퀴즈·추출)
<slug>/docs/poster.jpg  카드 미리보기 그림 1280×720
<slug>/video/*.srt      자막 원고. MP4는 커밋하지 않음 (아래 '영상')
docs/toeic-100-types.md 토익 문법 영역의 설계도: 자주 틀리는 100개 유형 → 21개 카테고리 → 튜토리얼 17개(T01–T17)와 제작 순서
.nojekyll               GitHub Pages가 _로 시작하는 폴더도 그대로 내보내도록
```

지금 있는 튜토리얼
- `relative-pronouns/` 관계대명사, 빈자리를 찾아라 (영역: `toeic`, T01) — 첫 시범 튜토리얼. 놀이터는 ‘문장 합치기 실험실’.
- `parts-of-speech/` 빈칸의 자리가 품사를 정한다 (영역: `toeic`, T02) — 놀이터는 ‘3초 품사 감각 훈련’과 ‘낱말 가족 사전’. 품사 색(명사 하늘 · 형용사 민트 · 부사 라임 · 동사 보라)을 씀.
- 새 튜토리얼은 주제가 가까운 쪽을 복사해 시작합니다. 장면의 낱말 조각 그리기(lay · morph · drawTok)는 두 튜토리얼이 같은 방식이에요.

영역(`catalog.js`의 `tracks`)
- `toeic` 토익 문법 — 공개 중
- `talk` 상황별 영어 회화 — 준비 중 (튜토리얼이 없으면 첫 화면에 ‘준비 중’ 칸으로 보임)

## 지킬 원칙

- **빌드 없는 정적 파일.** 번들러·프레임워크·npm 의존성 없이 HTML/CSS/JS만. `index.html`을 더블클릭해도 동작해야 합니다.
  - 그래서 `type="module"`, `fetch()`로 같은 저장소의 JSON 읽기는 쓰지 않습니다(file://에서 막힘). 데이터는 `<script>`로 읽는 JS 파일에 둡니다.
  - 경로는 모두 상대 경로. 튜토리얼 안에서 사이트 공통 파일은 `../assets/…`, 공통 부품은 `../shared/…`.
  - 링크는 폴더가 아니라 `…/index.html`까지 적습니다(로컬 파일로 열 때 폴더 목록이 뜨지 않도록).
- **사이트에 GitHub 링크를 두지 않습니다.** 방문자가 사이트 안에서 튜토리얼을 보게 하려는 것입니다. 외부 자료의 출처 링크는 괜찮습니다.
- **외부 자원은 Google Fonts 글꼴만.** 스크립트·그림은 저장소 안에 둡니다. 글꼴이 없어도 깨지지 않게 대체 글꼴을 꼭 적습니다.
- **누구나 이해할 수 있는 쉬운 한국어.** 문장은 짧게, 문법 용어는 처음 나올 때 풀어서, 영어 이름은 괄호로 함께. 말투는 "~예요/~해요".
  - 영어 낱말 바로 뒤에 조사를 붙이는 문장은 소리 내어 읽을 때 어색하므로(예: ‘The hotel’는) 되도록 피하고 `→`, `=`로 잇습니다.
- **규칙 엔진과 단순화를 구분해 밝히기.** 맞고 틀림은 튜토리얼의 규칙 엔진(`grammar.js`)이 정하고, 영상·놀이터·연습 문제·퀴즈가 모두 그 결과를 씁니다. 문제 데이터에 적은 정답과 규칙 엔진이 어긋나면 콘솔 경고를 냅니다. 시험 기준으로 단순하게 줄인 부분(예: 목적어 자리의 who)은 README와 화면 각주에 적습니다.
- **예문과 문제는 직접 만듭니다.** 실제 토익 기출 문제를 옮겨 오지 않습니다. 토익 형식(Part 5 빈칸 채우기, 보기 넷)만 본뜹니다.
- **원래 화면을 유지.** 공통 상단 바나 사이트 쪽 변경이 영상 추출 결과를 바꾸면 안 됩니다. `site-bar.js`는 `#export`일 때 아무것도 하지 않습니다.

## 새 튜토리얼 추가 절차

토익 문법 튜토리얼이면 먼저 `docs/toeic-100-types.md`의 ‘튜토리얼 계획’에서 다룰 유형 번호를 확인합니다. 다 만들면 그 표의 상태를 ‘완료’로 바꾸고, `catalog.js` 항목의 `types`에 유형 번호를 적습니다.

1. 가장 가까운 튜토리얼을 복사합니다: `cp -r relative-pronouns <slug>`. slug는 영어 소문자와 `-` (예: `subject-verb-agreement`, `airport`).
2. `index.html`에서 바꿀 곳
   - `<script src="../assets/site-bar.js" data-slug="<slug>">`의 `data-slug`
   - `<title>`, 머리말, 문장 색 범례, 놀이터·연습 문제·퀴즈 머리말, 핵심 정리(표와 `.en-gloss`), 각주
3. `assets/js/grammar.js` — 이 주제의 규칙 엔진(`judge`), 3단계 풀이 문장, 예문, 연습 문제(16문제 안팎), 데이터 점검(`check`)
4. `assets/js/scenes.js` — `CHAPTERS`(장마다 `caps`에 그 장 기준 자막), `SCENES`, `POSTER`
5. `assets/js/app.js` — `LABS`(장면별 직접 해 보기), 놀이터, 퀴즈(10문제), `EN_EXPORT.title`, 음성 해설의 읽기 바꾸기(`read`)
6. `assets/catalog.js`의 `tutorials`에 항목을 추가합니다(`track` 필수). 새 영역이면 `tracks`에도 추가.
7. 미리보기 그림: `node tools/render-video.cjs <slug> --poster <대표 장면 초>` → `<slug>/docs/poster.jpg`
8. 자막 원고: `node tools/render-video.cjs <slug> --srt` → `<slug>/video/<slug>.srt`
9. `<slug>/README.md`에 장면 구성, 조작법, 규칙 엔진/단순화 구분, 영상 다시 만드는 법을 적습니다. 루트 `README.md` 표에 한 줄 추가.
10. 아래 '확인'을 모두 통과시킨 뒤 커밋합니다.

## 튜토리얼 페이지가 갖출 것

- **영상 플레이어**: 캔버스 무대(16:9, 논리 좌표 1280×720), 재생/일시정지, 진행 막대와 장 눈금, 장 목록, 속도, 자막 켜기/끄기, 전체 화면, 단축키(스페이스, ← →, Shift+← →, C, F, V).
  - 그림은 **시간 t와 사용자 상태만의 함수**로 그립니다. 같은 t면 언제나 같은 그림. 그래야 되감기와 MP4 추출이 정확합니다.
  - **재생 중 매 프레임 DOM을 다시 만들지 마세요.** 특히 단추 안의 아이콘을 매 프레임 바꾸면 클릭이 사라집니다. 상태가 바뀔 때만 갱신하세요.
  - 영어 문장은 낱말 조각(토큰, `{ id, t, r }`)으로 그리고, 배치(`lay`) 사이를 `morph`로 움직입니다. 같은 id면 미끄러지고, 글자가 바뀌면 겹쳐 바뀝니다(She → who).
  - 문법 역할 색은 사이트 전체에서 같게: 선행사 하늘색 · 관계대명사 노란색 · 빈자리 분홍 점선 · 관계사절 민트 · 동사·단서 보라 · 함정 주황. 새 문법 주제도 비슷한 역할(꾸밈받는 말, 핵심 낱말, 단서, 함정)에 같은 색을 씁니다.
  - 화면 속 영어 문장은 `HITS`에 `{ x, y, w, h, say }`로 등록해 누르면 발음을 들려줍니다.
  - 내용은 y 580 위에 둡니다. 추출 영상의 자막 띠(두 줄이면 y 590 아래)와 겹치지 않게.
- **자막**: 장마다 `[시작, 끝, '문장']`(그 장 기준 초). 한 자막은 4~7초 분량. `**굵게**`는 강조색, 영어는 자동으로 연한 하늘색.
- **음성 해설(V)**: 공통 부품 `EN.narration`. 자막의 영어 부분은 영어 음성, 나머지는 한국어 음성으로 차례로 읽고, 다 읽을 때까지 그 자막 끝에서 영상이 기다립니다.
- **발음 듣기**: `EN.say.button(문장)`으로 단추를 만들고 `EN.say.wire(document, { before() { 일시정지 } })`로 한 번만 연결합니다. 같은 단추를 곧바로 다시 누르면 천천히 읽습니다.
- **장면별 '직접 해 보기'**: 지금 장면에 맞춰 바뀌는 패널. 사용자가 조작하면 영상은 멈추고, 재생하면 영상 흐름으로 돌아갑니다. 빈칸 문제를 넣을 때도 채점은 규칙 엔진으로.
- **놀이터**: 핵심 규칙을 사용자가 직접 바꿔 보는 곳. 결과와 함께 ‘왜 그런지’(규칙 엔진의 까닭, 풀이 단계)를 보여 줍니다.
- **연습 문제**: 공통 부품 `EN.drill`. 토익 형식, 한 문제씩, 힌트 = 풀이 단계(문장 속 단서에 색), 답하면 보기별 까닭·해석·발음. 정답 위치가 한쪽에 몰리지 않게.
- **퀴즈 10문제**: 공통 부품 `EN.quiz`. 영상 순서대로. 답하면 바로 해설. 그림 문제는 `figure: { width, height, label, draw(g, st), pick(x, y) }`.
- **핵심 정리**: 한눈에 보는 표 + `<div class="en-gloss">` 용어(단계별로 묶음). 영어는 `<i lang="en">`.
- **영상 추출(`#export`)**: `window.EN_EXPORT`를 만듭니다(아래 '영상').

## 공통 부품 (`shared/`)

고치면 모든 튜토리얼에 함께 반영되니, 바꾼 뒤에는 모든 튜토리얼을 확인하세요.

불러오기 (튜토리얼 스크립트보다 먼저)
```html
<link rel="stylesheet" href="../shared/components.css">   <!-- 튜토리얼 CSS보다 앞에 -->
<script src="../shared/narration.js"></script>
<script src="../shared/quiz.js"></script>
<script src="../shared/drill.js"></script>
```

- **`EN.narration({ captions, read, rate, holdBefore })`** — `captions`는 `[{ start, end, text }]`(영상 전체 기준 초).
  - 재생 중 매 프레임: `T = narr.hold(T, T + dt * speed)` 다음 `narr.sync(T, playing)` / 일시정지·이동·재생 시작: `narr.reset()`
  - 단추: `EN.narration.bind(narr, 단추, 안내문, { onEnable() { if (!started) play(); } })` — 지원하지 않는 브라우저면 단추를 숨김
  - `**`, ①~⑤, →, …, ·, ___(빈칸), (A)~(D) 같은 기호 읽기는 부품이 처리합니다. `read`에는 그 튜토리얼의 약어만(예: `[/TOEIC/g, '토익']`).
  - 화면용 `×`는 ‘곱하기’로 읽히므로 자막에는 쓰지 않습니다(캔버스·해설 글에는 써도 됨).
- **`EN.say(text, { slow, onend })`**, `EN.say.button(text, label)`, `EN.say.wire(root, { before })`, `EN.say.stop()` — 영어 음성으로 읽기. 음성을 쓸 수 없는 브라우저면 `<html class="no-say">`가 붙어 단추가 숨겨집니다.
- **`EN.drill({ root, items, before, done })`** — 문제는 `{ q, opts, a, ko, tag, steps: [{ head, text, marks: [{ t, role }] }], notes }`. `q`의 빈칸은 `___`. `marks`의 role: `ante` · `cue` · `trap` · `verb`.
- **`EN.quiz({ list, score, reset, done, questions })`** — 문제는 `{ q, opts, a, why }`, 그림 문제는 `figure`를 더합니다.
- **색과 글꼴**: 공통 CSS는 아래 변수만 씁니다. 튜토리얼 `:root`에서 자기 토큰에 연결하면 밝은/어두운 테마를 따라갑니다.
  ```css
  --en-text --en-muted --en-surface --en-surface-2 --en-line --en-accent --en-ok --en-no --en-display --en-mono --en-ante --en-cue --en-trap
  ```
- 부품 함수는 클래식 스크립트 전역 `window.EN`에 붙습니다(`type="module"`을 쓰지 않는 원칙 때문).

## 디자인

- 페이지 바탕은 밝은/어두운 테마 토큰을 모두 정의하고(`:root`, `@media (prefers-color-scheme: dark)` + `:root:not([data-theme="light"])`, `:root[data-theme="dark"]`), 영상 무대는 항상 어둡게 둡니다.
- 사이트 강조색은 짙은 청록(`#1B6B5F`, 어두운 테마 `#6FD3C1`), 영상 강조색은 노란색(`#FFC15E`). 글꼴은 Hahmlet(제목) + IBM Plex Sans KR(본문·영어) + IBM Plex Mono.
- 휴대폰 너비 390px에서 가로 스크롤이 생기면 안 됩니다. 캔버스 속 작은 글씨는 캔버스 밖(자막, 직접 해 보기)에서도 읽을 수 있게 합니다.
- 이모지 대신 직접 그린 아이콘(SVG/캔버스)을 씁니다. `✗`(U+2717)는 일부 글꼴에서 모양이 이상하게 나와 `×`를 씁니다.

## 영상

- 공통 렌더러 `tools/render-video.cjs`가 페이지를 `<slug>/index.html#export`로 열고 프레임마다 그려 ffmpeg로 넘깁니다. 1920×1080, 30fps, 자막은 그림에 들어가고, 장 표시(MP4 메타데이터)와 `.srt` 자막 원고도 만듭니다.
  ```bash
  node tools/render-video.cjs <slug>                     # → <slug>/video/<slug>.mp4 + .srt
  node tools/render-video.cjs <slug> --from 20 --to 34   # 구간만 (--out 경로.mp4, --fps, --crf)
  node tools/render-video.cjs <slug> --frames 6.2,100    # 몇 장면만 JPEG로 → frames/<slug>/ (git에 안 들어감)
  node tools/render-video.cjs <slug> --poster 26         # 카드 미리보기 → <slug>/docs/poster.jpg
  node tools/render-video.cjs <slug> --srt               # 자막 원고만
  ```
- **`EN_EXPORT` 약속**: `#export`로 열렸을 때 페이지가 만듭니다.
  ```js
  window.EN_EXPORT = {
    title: '영상 제목', duration: 초,
    chapters: [{ title, start }], captions: [{ start, end, text }],
    ready: () => Promise,                 // 캔버스에 쓰는 글자를 모두 document.fonts.load로 받은 뒤 풀림
    frame: (t, fps, quality) => 'data:image/jpeg;base64,…',   // t초 장면, 1920×1080, 자막 포함
  };
  ```
  추출 모드에서는 상단 바·플레이어 단추·놀이터를 만들지 않고, 같은 t에 언제나 같은 그림(사용자 상태는 기본값)을 돌려줘야 합니다.
- 프록시 환경에서 헤드리스 브라우저가 Google Fonts 인증서를 믿지 못하면, 렌더러가 글꼴 요청을 Node `fetch`로 대신 받아 넘깁니다(`NODE_USE_ENV_PROXY=1`과 함께 실행). TLS 검증을 끄지 마세요.
- **MP4는 커밋하지 않습니다**(`.gitignore`에 `*/video/*.mp4`). Git LFS도 쓰지 않습니다. 렌더링한 MP4는 장면 확인용입니다.

## 확인 (커밋 전에)

헤드리스 Chromium(Playwright, `/opt/pw-browsers`)으로:
- 콘솔 오류·경고 0개(`RP.check()` 같은 데이터 점검 경고 포함). 재생, 장 이동, 직접 해 보기, 놀이터, 연습 문제(힌트·답·다음·키보드), 퀴즈(그림 문제 포함)를 실제로 눌러 봄.
- 단추는 **사람 속도로** 눌러 확인: 단추 한가운데에서 `mouse.down()` → 0.15초 → `mouse.up()`. 재생 중 일시정지, 다시 재생 둘 다.
- 음성 해설: `speechSynthesis`를 가짜로 바꿔(`page.addInitScript`) 느리게 읽힐 때 영상이 자막 끝에서 기다리는지, 영어 조각이 `en-US`로, 한국어 조각이 `ko-KR`로 나뉘는지 확인.
- 추출 프레임(`--frames`)을 장면마다 뽑아 겹침·잘림 확인(특히 오른쪽 끝과 자막 띠 근처).
- 데스크톱 1280px·휴대폰 390px, 밝은·어두운 테마 화면을 찍어 겹침·잘림 확인. 390px에서 `scrollWidth === innerWidth`.
- 첫 화면(`index.html`)에서 새 카드가 보이고, 상단 바의 '다른 튜토리얼' 메뉴로 오갈 수 있는지.

## 배포

- `main` 브랜치의 루트를 GitHub Pages로 내보냅니다(Settings → Pages → Deploy from a branch → `main` / `(root)`). 주소: `https://vadoro.github.io/eng_tutorials/`
- **작업은 `main`에 바로 커밋하고 올립니다.** 별도의 브랜치는 주인이 필요하다고 할 때만 만듭니다.
- 커밋 메시지는 한국어로, 무엇을 왜 바꿨는지 적습니다.
