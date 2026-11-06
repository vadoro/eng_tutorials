# 영어 튜토리얼 — 작업 규칙

한림대학교 영어영문학과 학생을 위한 영어 학습 사이트입니다. 문법·회화를 **인터랙티브 모션그래픽 영상**과 연습 문제로 설명합니다.
튜토리얼 하나 = 폴더 하나이고, 사이트 첫 화면(`index.html`)이 영역(tracks)별로 목록을 보여 줍니다. 이 문서는 새 튜토리얼을 추가하거나 고칠 때 지킬 규칙입니다.
형식은 `vadoro/dh_tutorials`(DH 튜토리얼)에서 가져왔고, 영어 교육에 맞게 한·영 음성, 발음 듣기, 규칙 엔진, 단계별 힌트 연습 문제를 더했습니다.

## 구조

```
index.html              사이트 첫 화면 (영역별 카드, assets/catalog.js를 읽어 그림)
assets/catalog.js       영역(tracks)과 튜토리얼(tutorials) 목록 — 첫 화면과 상단 바가 함께 씀 (단일 출처)
assets/site-bar.js      각 튜토리얼 위에 붙는 공통 상단 바 (섀도 DOM, 추출 화면에서는 안 붙음)
assets/to-top.js        모든 페이지 오른쪽 아래의 ‘맨 위로’ 단추 (첫 화면 · 튜토리얼마다 site-bar.js 다음 줄에서 불러옴, 섀도 DOM, 추출 화면에서는 안 붙음)
assets/site.css         첫 화면 디자인 토큰(밝은/어두운 테마)
assets/favicon.svg      파비콘 — 청록 둥근 사각형에 흰 EN(글자는 도형으로 그려 글꼴과 무관)
shared/narration.js     공통 부품: 음성 해설 EN.narration, 발음 듣기 EN.say, 한·영 나누기 EN.splitLang
shared/drill.js         공통 부품: 토익 Part 5 연습 문제 EN.drill (한 문제씩, 단계별 힌트)
shared/quiz.js          공통 부품: 퀴즈 EN.quiz
shared/components.css   공통 부품 모양: 발음 단추(.en-say), 퀴즈(.enq), 연습 문제(.edr), 핵심 정리(.en-gloss)
tools/render-video.cjs  공통 렌더러: EN_EXPORT 약속을 지킨 튜토리얼을 MP4·SRT·미리보기 그림으로
tools/narration-pieces.cjs    음성 해설의 읽기 조각 + 발음 듣기 글 목록 → <slug>/audio/narration/pieces.json (미리 만든 음성 파일을 쓸 때)
tools/say-sweep.js           발음 듣기 글 모으기(영상 칩 · 처음부터 있는 스피커 단추 · 직접 해 보기의 예문) — narration-pieces.cjs가 페이지 안에서 실행
tools/voicestudio-narration.py  VoiceStudio(주인의 맥, localhost:3900)로 조각마다 음성 파일을 만들고 clips.js를 씀 — 맥에서 실행
tools/dialogue-lines.cjs      대화 목소리를 미리 만들 줄 목록 → <slug>/audio/dialogue/lines.json (페이지의 window.__dialogueLines(), 지금은 directions · restaurant · hotel · cafe · airport)
tools/voicestudio-dialogue.py  VoiceStudio로 대화 줄마다 말하는 사람의 목소리 파일을 만들고 clips.js(window.DIALOGUE_CLIPS)를 씀 — 맥에서 실행
tools/voicestudio_common.py   위 두 VoiceStudio 도구가 함께 쓰는 부분(만들기 · 무음 다듬기 · 이상한 소리면 seed 바꿔 다시 · MP3/m4a로 줄이기)
<slug>/index.html       튜토리얼 본체. 폴더 안에서 완결됨
<slug>/assets/js/       grammar.js(규칙 엔진·예문·문제) · scenes.js(장면·자막) · app.js(플레이어·실습·놀이터·퀴즈·추출)
<slug>/docs/poster.jpg  카드 미리보기 그림 1280×720
<slug>/video/*.srt      자막 원고. MP4는 커밋하지 않음 (아래 '영상')
<slug>/audio/narration/ 미리 만든 음성 해설(선택): pieces.json(조각 목록) · clips.js(window.EN_CLIPS) · 조각 id.mp3|m4a — 지금은 directions · restaurant · hotel · cafe · airport · relative-pronouns · parts-of-speech · verb-agreement-voice · verb-tense · connectors · nouns-articles · infinitives-gerunds
<slug>/audio/dialogue/  미리 만든 대화 목소리(선택): lines.json(줄 목록) · voices.json(말하는 사람 → 프로필) · clips.js(window.DIALOGUE_CLIPS) · 말하는사람-id.mp3|m4a — 지금은 directions · restaurant · hotel · cafe · airport
docs/toeic-100-types.md 토익 영역의 설계도: 자주 틀리는 100개 유형 → 21개 카테고리 → 튜토리얼 17개(T01–T17)와 제작 순서
.nojekyll               GitHub Pages가 _로 시작하는 폴더도 그대로 내보내도록
```

지금 있는 튜토리얼
- `relative-pronouns/` 관계대명사, 빈자리를 찾아라 (영역: `toeic`, T01) — 첫 시범 튜토리얼. 놀이터는 ‘문장 합치기 실험실’.
- `parts-of-speech/` 빈칸의 자리가 품사를 정한다 (영역: `toeic`, T02) — 놀이터는 ‘3초 품사 감각 훈련’과 ‘낱말 가족 사전’. 품사 색(명사 하늘 · 형용사 민트 · 부사 라임 · 동사 보라)을 씀.
- `verb-agreement-voice/` 주어가 수를, 목적어가 태를 정한다 (영역: `toeic`, T03) — 놀이터는 ‘능동·수동 변환기’와 ‘진짜 주어 누르기’. 역할 색(진짜 주어 하늘 · 동사 노랑 · 목적어·보어 보라 · 지울 수식어 민트 · 빈 목적어 자리 분홍 점선)을 쓰고, 능동·수동 문장은 규칙 엔진의 `VA.build`가 만들어 영상·실습·놀이터가 함께 씀.
- `verb-tense/` 시간선 위에 동사를 놓아라 (영역: `toeic`, T04) — 놀이터는 ‘시간선 시제 기계’. 시간선(과거 — 지금 — 미래) 그리기(`axis` · `scenario`)가 있고, 역할 색은 시간 단서 보라 · 동사(답) 노랑 · 기준점 하늘 · 시간·조건 부사절 민트.
- `connectors/` 접속사냐 전치사냐, 빈칸 뒤가 답한다 (영역: `toeic`, T05) — 놀이터는 ‘연결어 조립대’(두 생각 × 세 틀 × 연결어 조각, 3단계 검사)와 ‘연결어 사전’. 갈래 색(접속사·절 민트 · 전치사·명사구 하늘 · 접속부사 라임 · 동사 보라), 절·명사구는 옅은 칠 + 아래 꺾쇠로 묶음.
- `nouns-articles/` 명사 검문소를 통과하라 (영역: `toeic`, T06) — 놀이터는 ‘명사 검문소’(짝 × 명사 × 단수·복수를 골라 세 문을 지나 보기, 먼저 맞히기). 검문소 그림(`NS.gates`: 길 · 문 셋 · 차)은 영상·놀이터·퀴즈 그림이 함께 쓰고, 역할 색은 셀 수 있는 명사 하늘 · 셀 수 없는 명사 라임 · 짝(한정사·수량 표현) 보라 · 복수 -s 노랑. 판정은 명사 사전·짝 사전을 쓰는 `NA.judgePhrase`.
- `infinitives-gerunds/` 진짜 동사는 하나, 나머지는 to와 -ing (영역: `toeic`, T07) — 놀이터는 ‘동사 옷 입히기’(문장 속 원형 동사에 진짜 동사·원형·to부정사·-ing 꼴을 입히고 전치사를 넣고 빼며 3단계 검사, `IG.chain`·`IG.solve`)와 ‘동사 짝 사전’. 모양 색(진짜 동사 보라 + 시계 표시 · to부정사 민트 · -ing 꼴 하늘 · 동사원형 라임 · 전치사 모래), 진짜 동사 세기(`counter`).
- `participles/` -ing냐 -ed냐, 주인에게 물어라 (영역: `toeic`, T08) — 놀이터는 ‘주인 바꾸기 실험실’(동사 × 주인 → 관계 그림, -ing · -ed 문장 맞혀 보기). 관계 그림(`relDiagram`: 하는 쪽 보라 → 동사 → 당하는 쪽 분홍 점선, 주인에 하늘색 고리)이 있고, 역할 색은 주인 하늘 · 분사(답) 노랑 · 분사구·분사구문·접속사 민트 · 목적어·by 단서 보라. 음성 해설은 -ing · -ed를 ‘잉’ · ‘이디’로 읽음.
- `relative-adverbs-noun-clauses/` 빈자리가 있느냐 없느냐, 그것이 문제로다 (영역: `toeic`, T09) — T01의 속편. 놀이터는 ‘빈자리 탐지기’(빈칸 뒤 절의 낱말 사이 자리를 눌러 빈자리 찾기 → 빈칸 앞의 자리 고르기 → 후보 16개를 `WH.judge`가 단계별로 판정). 역할 색은 T01과 같고(선행사 하늘 · 관계사 노랑 · 빈자리 분홍 점선 · 완전한 절 민트 · 동사 보라 · 전치사 주황, 부사 there 라임), 빈자리가 있는지(`back`)·자리(`front`)·뜻(`sense`)은 문제마다 데이터에 적음. 어순 문제는 `WH.formOf`가 보기의 모양(평서문·의문문 어순)을 가름.
- `pronouns/` 가리키는 말이 줄을, 자리가 칸을 정한다 (영역: `toeic`, T10) — 놀이터는 ‘대명사 표 놀이터’(가리키는 말 × 문장 → 7줄 × 5칸 대명사 표에서 칸 고르기, 줄·칸을 따로 채점, `PN.pgJudge`). 대명사 표 그리기(`grid`: 줄 하늘 · 칸 보라 · 답 노랑)와 가리키는 화살표(`point`: 대명사 → 가리키는 말)가 있고, 역할 색은 가리키는 말 하늘 · 대명사(답) 노랑 · 자리 단서 보라 · 짝 표현(-self의 같은 사람, one, of …, who …) 민트. 음성 해설은 it’s를 ‘it is’, -self를 ‘셀프’로 읽음.
- `prepositions/` 전치사, 그림으로 보고 짝으로 외워라 (영역: `toeic`, T11) — 놀이터는 ‘까지 갈림길’(문장 × 전치사 일곱 → 시간선 그림, 점 끌기, `PRS.road`)과 ‘짝 카드’(짝 표현 열다섯, 틀리면 다시 나옴). 시간선 그림(`axis` · `flag` 깃발 = 시점 · `dot` 점 = 한 번에 끝나는 일 · `bar` 막대 = 이어지는 일 · `ruler` 자 = 숫자 길이 · `eventBlock` 칸 = 사건 · `boxSpan` 점선 상자 = 그 안에)과 장소 그림(`placeIcon`)이 있고, 역할 색은 앞 낱말(짝) 하늘 · 전치사(답) 노랑 · 뒤의 명사·깃발 보라 · 동작·그림 민트 · 한국어 조사·함정 주황. 판정은 전치사 사전(뜻마다 무엇 · 명사 종류 · 그림)과 짝 카드 사전을 쓰는 `PR.judge`.
- `comparison-inversion/` 신호어가 짝을 부른다 (영역: `toeic`, T12) — 놀이터는 ‘신호어 스위치’(비교 · 가정법 · 도치 세 갈래, 같은 문장에서 신호어만 바꾸면 토큰이 미끄러지며 다시 짜이고 후보를 3단계로 판정, `CI.SW` · `CI.build` · `CIS.stage`). 신호어 틀(`CI.SW`)은 영상 02 · 05 · 07장과 놀이터가 함께 쓰고, 왼쪽으로 멀리 가는 토큰은 위로 뛰어넘는 `morph`(도치에서 조동사·부정어 덩어리가 앞으로)를 씀. 역할 색은 신호어 보라 · 짝(답) · 앞으로 나온 조동사 노랑 · 주어 하늘 · 범위 · if절 민트 · 함정 주황. 판정은 틀(deg · int · part · noun · cond · front · neg · aux · so)마다 갈라 보는 `CI.judge`. 음성 해설은 -er · -or · -est를 글자 이름으로, p.p.를 ‘과거분사’로 읽음.
- `vocabulary/` 낱말에도 단짝이 있다 (영역: `toeic`, T13) — 어휘 · 짝 표현(유형 59–63). 형식이 달라요: 영상은 5분 · 10장으로 짧게 ‘푸는 법과 외우는 법’을 보여 주고, 놀이터가 중심이에요. ‘짝 카드’(카드 89장, 라이트너 상자 다섯 개 — 맞히면 위 상자로 늦게, 틀리면 상자 1로 3장 뒤에. 기록은 `localStorage` `en-vocab-cards-v1`)와 ‘짝 사전’(찾기 · 유형별 · 발음). 규칙 엔진은 손으로 고른 짝 사전(`VC.LEX` · `VC.KEY`)이고 `VC.judge`가 품사 · 뜻 · 뒤의 구조 · 빌리는 방향 · 짝 사전 순으로 판정하며, 사전에 없는 조합은 ?로 남겨요. 역할 색은 짝 하늘 · 빈칸에 들어갈 말 노랑 · 덩어리 표현 민트 · 구조 단서(목적어 · 사람) 보라 · 함정(닮은꼴 · 헷갈리는 동사) 주황.
- `part6-text/` 한 문장으론 모른다, 앞뒤 문장이 답한다 (영역: `toeic`, T14) — Part 6 글 단위 문제(유형 64–66). 무대에 짧은 글(공지 · 이메일)을 낱말 조각으로 배치하고(`layP`), 가려진 문장은 회색 막대로 그려요. 단서는 오른쪽 여백의 꺾쇠 화살표(`bracket`)로 이어 글자를 가로지르지 않게 해요. 놀이터는 ‘문맥 손전등’(빈칸 문장만 보이는 상태에서 앞 · 뒤 문장과 머리말을 하나씩 켜면 `PT.judge(빈칸, 보기, 보이는 문장)`이 남은 보기를 다시 판정, `PT.minReveal`과 견준 기록). 연습 문제는 지문이 화면에 있어야 해서 공통 `EN.drill` 대신 폴더 안의 `passageDrill`(같은 `.edr` 모양 · 키보드)로 지문 넷 × 빈칸 넷을 풀고, 데이터 점검은 빈칸 문장만으로 답이 정해지면(Part 5 문제) 경고해요. 역할 색은 빈칸 문장 하늘 · 빈칸 분홍 점선 · 답 노랑 · 단서 보라 · 두 문장의 관계 민트 · 함정 주황.
- `listening-part1-2/` 첫 단어를 잡고, 들린 단어를 의심하라 (영역: `toeic`, T15) — 첫 듣기 튜토리얼(Part 1 · 2). 녹음 대신 브라우저 음성을 쓰는 튜토리얼 전용 목소리 부품 `voices.js`(`LPV.play`: 말하는 사람마다 en-US · en-GB · en-AU · en-CA 목소리를 고르고, 없으면 높낮이로 구별, 읽기 전에 발음 듣기 · 음성 해설을 멈춤)와 전용 듣기 연습 문제(`LDrill`: 소리 먼저 · 글은 답한 뒤, R 다시 듣기 · S 천천히)가 있어요. 사진 그림(`LPS.photo`: 사람 · 가구를 도형으로, 사진에 없는 물건은 분홍 점선)과 들리는 말 한 줄(`voiceLine`: 말하는 사람 · 소리 물결 · 낱말이 하나씩 나타나는 받아쓰기). 놀이터는 ‘함정 감별사’(대답에 이름표 붙이기)와 ‘동작 · 상태 고르기’(같은 장면의 두 순간). 역할 색은 주인공 하늘 · 첫 단어와 동작 노랑 · 상태와 정답 민트 · 답의 종류와 물건 보라 · 사진에 없는 것 분홍 점선 · 함정 주황.
- `listening-part3-4/` 먼저 읽고, 바꿔 말한 답을 잡아라 (영역: `toeic`, T16) — 듣기 Part 3·4(유형 78–88). 녹음 없이 브라우저 음성으로 읽고, 폴더 안의 `voices.js`(`LTV.play`)가 화자마다 다른 목소리(미국 · 영국 · 호주 → 없으면 높낮이)를 고르며, 읽기 전에 영상 일시정지 · `NARR.reset()` · `EN.say.stop()`을 불러 소리가 겹치지 않게 해요(공통 부품은 그대로). 영상은 대본을 말풍선 줄(화자 표시 + 소리 물결)로 그리고 오른쪽 문제 칸에 키워드를 칠해요. 규칙 엔진 `LT.judge`는 보기마다 적은 대본과의 관계(para · speaker · time · none · contra · repeat · graphic)를 ① 미리 읽기 · ② 신호 듣기 · ③ 바꿔 말하기 단계로 바꾸고 근거 줄을 함께 보여 줘요. 지도(`LT.where`: 맞은편 · 바로 옆)와 표(`LT.lookup`)에서 그림 문제의 답을 다시 계산하고, `LT.names`가 이름을 부르는 말로 세 사람의 이름을 알아내요. 놀이터는 ‘근거 줄 찾기’(`LT.lineRole`)와 ‘의도 파악 실험’(같은 문장 · 같은 보기, 대화 셋), 연습 문제는 세트형 `listeningDrill`(대본 가림, 힌트 ②에서 근거 줄 드러남, 키보드 A~D · H · R 다시 듣기 · S 천천히 · T 대본 · Enter). 역할 색은 문제 키워드 하늘 · 신호어 보라 · 근거 줄 민트 · 바꿔 말한 답 노랑 · 그대로 들린 낱말 주황.
- `reading-part7/` 답은 지문에 있다, 다른 말로 (영역: `toeic`, T17) — 독해 Part 7(유형 89–100). 지문 세트(`R7.SETS`)는 글 하나 · 둘 · 셋(이메일 · 공지 · 광고 · 웹 페이지 · 문자 · 양식)이고, 글마다 단위(문장 · 메시지 · 표의 줄, 머리말 -1)로 근거를 적어요. 무대는 글 종류별 배치(`layDoc`: 문장 · 말풍선 · 표, [1]~[4] 자리 표시)를 쓰고, 글이 둘 · 셋이면 작은 글자 대신 카메라(`withCam` · `camAt` · `focus`)로 다가가 읽은 뒤 카드 사이 틈에서 근거를 잇는 선(`gapLink`)과 그 아래 연결 줄을 그려요. 규칙 엔진 `R7.judge`는 보기마다 적은 근거와의 관계(match · same · none · contra · off · who · when · doc · cell · literal · dict · sense · stated)를 ② 근거 찾기 · ③ 바꿔 말한 보기 단계로 바꾸고, 그대로 반복한 낱말(`R7.echo`)과 문장 삽입 자리의 짝은 엔진이 계산해요. 놀이터는 ‘근거 사냥’(보기 전에 근거 문장을 눌러 찾기, `R7.tap`), 연습 문제는 폴더 안의 `passageDrill`(T14와 같은 `.edr` 모양 · 키보드, 지문 세트 다섯 · 16문제, 힌트에서 글 사이 연결 선을 왼쪽 여백에 그림 `drawLinks`). 역할 색은 질문 키워드 하늘 · 근거 보라 · 바꿔 말한 답 노랑 · 글 사이 연결 민트 · 함정 주황 · 넣을 자리 분홍 점선.
- `airport/` 공항, 질문은 정해져 있다 (영역: `talk`, 시범) — 상황별 영어 회화의 첫 튜토리얼이자 회화 형식의 본보기(아래 ‘회화 튜토리얼이 갖출 것’). 공항 일곱 곳(`AP.PLACES`: 체크인 · 보안 검색 · 탑승구 · 기내 · 입국 심사 · 수하물 · 세관)의 질문(`AP.Q`: 뜻 `intent` · 열쇠 낱말 `key` · 빠른 말 `fast`)과 대답 틀(`AP.FRAME`: `___` = 내 정보 칸, `{…}` = 공손한 말, tag ok · literal · wrong · blunt · plain) + 칸 값(`AP.SLOT`)을 규칙 엔진 `AP.judge(질문, 대답, 카드)`가 ① 뜻 → ② 틀 · 사실 · 가방 묘사 순서(`AP.bagOrder`) → ③ 공손함으로 판정. 영상은 공항 길 지도(01장 크게 · 02–08장 위쪽 띠 `strip`), 말풍선(직원 왼쪽 `talk` · 여행자 오른쪽 `answer`, 낱말 조각 `lay` · `morph`), 탑승권(`boardingPass`) · 여행 카드(`travelCard`) · 가방(`suitcase`) 그림. 놀이터는 ‘입국 심사 시뮬레이터’(무작위 여행 카드, 여권 + 질문 넷, 틀 칩 · 칸 칩, 심사관 반응 `AP.REACT`, 말로 대답 `AP.matchSpoken`, 입국 도장), ‘공항 표현 따라 말하기’ 28문장(`AP.compareWords`), 연습 문제는 폴더 안의 `ADrill`(듣고 대답 고르기 16). 목소리는 폴더 안의 `voices.js`(`APV`: 직원 en-US · en-GB · en-AU · en-CA, 여행자 `me`는 다른 목소리, 발음 듣기 `tc`, 빠른 말 `rate`, Flight 207 → two-oh-seven). 글이 정해진 말은 directions와 같은 방식으로 VoiceStudio로 미리 만든 목소리(`audio/dialogue/`, 프로필도 directions와 같음 — 보안 검색 · 입국 심사 미국 남성 · 체크인 · 기내 영국 여성 · 탑승구 · 세관 호주 남성 · 수하물 캐나다 여성 · 나 미국 여성 · 선생님 미국 여성), 시뮬레이터는 `clips: false`. 줄 목록 `window.__dialogueLines()`는 영상을 훑고(01장은 곳을, 09장은 3단계 줄을 하나씩 골라 놓고) 직접 해 보기 · 연습 문제 · 따라 말하기 · `AP.Q`에서 모아요. 역할 색은 열쇠 낱말 하늘 · 대답 틀 노랑 · 내 정보 민트 · 빈칸 분홍 점선 · 공손한 말 보라 · 함정 주황.
- `cafe/` 카페, 주문에는 순서가 있다 (영역: `talk`) — 회화 두 번째 튜토리얼(`airport/`를 복사해 시작). 핵심은 ‘질문의 순서’: 음료 → 크기 → 온도 → 옵션 → 이름 → 포장 → 더 살 것 → 계산 → 받기. 주문 길 일곱 단계(`CF.PLACES`: 문 · 줄 → 메뉴판 · 주문대 → 크기 · 온도 → 옵션 → 이름 · 포장 → 계산대 → 픽업대)는 01장에 가게 평면도로 크게, 02–07장 위쪽 띠(`strip`)로. 이름공간은 `CF`(grammar) · `CFS`(scenes) · `CFV`(voices) · `CDrill`(듣고 대답 고르기 16). 규칙 엔진 `CF.judge`는 공항과 같은 3단계에 콩글리시 칸 값(`bad`: ice americano)과 권하는 말의 Yes · No(`yes` → 질문의 뜻에 사실이 붙음), 들린 만큼 되묻기(`kind: 'echo'` — 순서상 그 차례의 질문일 때만 통과)를 더했어요. 한 문장 주문은 `CF.orderLine`(크기 → 온도 → 음료 → with 옵션 → 포장, 단순하게 줄인 순서 규칙)과 `CF.covered`(그 대답이 이미 답한 질문 → 시뮬레이터의 바리스타가 건너뜀), 값은 지어낸 메뉴판(`CF.MENU` · `CF.EXTRA` · `CF.FOOD`)으로 `CF.price`가 계산하고 `CF.priceWords`가 읽어요($6.50 → six fifty). 그림은 메뉴판(`menuBoard`) · 컵(`cupDraw`, 이름표) · 영수증(`receiptDraw`) · 카드 단말기(`reader`, 팁 화면은 ‘나라마다 다름’만) · 주문 카드(`orderCard`) · 이어서 들리는 말(`linked`: 쓰인 낱말 + 소리 상자, 대문자 = 세게). 놀이터는 ‘카페 주문 시뮬레이터’(무작위 주문 카드, 늘 쓰는 차례 + 작은 변화, 틀 칩 · 칸 칩, 첫 질문에서 ‘한 번에 주문’(L) 낱말 칩으로 한 문장 → 건너뛴 질문 표시, 말로 주문하면 `CF.matchSpoken`이 들린 조각까지 `covered`로, 끝은 이름 적힌 컵 + 계산한 영수증 + 건너뛴 질문 수), ‘카페 표현 따라 말하기’ 28문장. 목소리는 주문대 바리스타 en-US · 픽업대 en-AU · 영국 카페(Eat in or take away?) en-GB · 손님 `me` · 발음 듣기 `tc`. 글이 정해진 말은 directions와 같은 방식으로 VoiceStudio로 미리 만든 목소리(`audio/dialogue/`, 프로필도 directions와 같음 — 주문대 바리스타 미국 남성 · 픽업대 호주 남성 · 영국 카페 영국 여성 · 나 미국 여성 · 선생님 미국 여성), 시뮬레이터는 `clips: false`. 줄 목록 `window.__dialogueLines()`는 영상을 훑고(01장은 단계를, 09장은 3단계 줄을 하나씩 골라 놓고) 직접 해 보기 · 연습 문제 · 따라 말하기 · `CF.Q`에서 모아요. 역할 색은 공항과 같아요(열쇠 낱말 하늘 · 대답 틀 노랑 · 내 정보 민트 · 빈칸 분홍 점선 · 공손한 말 보라 · 함정 주황).
- `hotel/` 호텔, 부탁은 질문으로 한다 (영역: `talk`) — 회화 세 번째 튜토리얼(`cafe/`를 복사해 시작). 핵심은 ‘내가 먼저 말을 꺼내는 곳’: 부탁은 질문으로(Could I get …? · Could you …?), 문제는 사실 + 부탁. 호텔 일곱 곳(`HT.PLACES`: 프런트 · 체크인 → 방 열쇠 · 안내 → 객실 · 전화 부탁 → 객실 · 문제 → 조식 식당 → 컨시어지 · 짐 → 프런트 · 체크아웃)은 01장에 호텔 단면도(12층 객실 · 2층 식당 · 1층 로비와 머무는 길)로 크게, 02–07장 위쪽 띠(`strip`)로, 내가 먼저 말하는 곳(전화 · 문제 · 컨시어지)은 보라 테두리. 이름공간은 `HT`(grammar) · `HTS`(scenes) · `HTV`(voices) · `HDrill`(듣고 대답 고르기 16). 규칙 엔진 `HT.judge`는 같은 3단계에 두 조각 대답(사실 틀 + 부탁 `req`, 문제마다 어울리는 부탁 — 사람 보내기 · 방 바꾸기 · 새 카드 키 · 가져다주기 — 은 `HT.fix`가 ②에서 판정), 박을 날로 센 값(`days` → ②, 카드의 박 수로 까닭), 상대가 알려 준 번호를 되묻는 말(`check`: was that room ___? → 직원이 말한 번호와 맞춤), 대답 대신 해도 되는 다시 묻기(`allow`: spell · what)를 더했어요. 전화 한 줄은 `HT.callLine`(인사 → 방 번호 → 부탁 틀 + 필요한 것 → please → 끝인사, 단순하게 줄인 규칙 — 방 번호가 끝이면 통과 + 알림)과 `HT.covered`(방 번호 · 몇 개 · 이름 · 모닝콜 시각 · 맡길 시각 → 시뮬레이터의 직원이 같은 곳 안에서 건너뜀). 숫자는 `HT.roomWords`(1207 → twelve-oh-seven) · `HT.floorOf` · `HT.timeWords`(6:30 → six-thirty) · `HT.bill`(지어낸 방값 × 밤 + 조식 + 미니바 + 세금, 실수 줄 표시) · `HT.priceWords`, 읽을 글은 `HT.spoken`, 숫자 낱말 맞추기는 `HT.canon`(twelve oh seven = 1207). 그림은 호텔 단면도 · 카드 키 봉투(`keySleeve`) · 청구서(`billDraw`) · 숙박 카드(`stayCard`) · 객실 전화(`phoneDraw`) · 에어컨 · 짐표 · 시계 · 해와 달(`nightsCal`: 2박 3일). 놀이터는 ‘호텔 숙박 시뮬레이터’(무작위 숙박 카드, 방 번호는 카드에 없고 체크인 뒤 카드 키 봉투에 나옴, 틀 칩 · 칸 칩, 문제는 사실 칩 + 부탁 칩, 객실 전화에서 ‘전화 한 줄’(L), 말로 대답하면 `HT.matchSpoken`, 끝은 카드 키 봉투 + 계산한 청구서(고친 합계) + 건너뛴 질문 수), ‘호텔 표현 따라 말하기’ 28문장. 목소리는 프런트 en-US · 전화 en-CA · 조식 식당 en-AU · 컨시어지 en-GB · 손님 `me` · 발음 듣기 `tc`. 글이 정해진 말은 directions와 같은 방식으로 VoiceStudio로 미리 만든 목소리(`audio/dialogue/`, 프로필도 directions와 같음 — 프런트 미국 남성 · 전화 캐나다 여성 · 조식 식당 호주 남성 · 컨시어지 영국 여성 · 나 미국 여성 · 선생님 미국 여성), 시뮬레이터는 `clips: false`. 줄 목록 `window.__dialogueLines()`는 영상을 훑고(01장은 곳을, 09장은 3단계 줄을 하나씩 골라 놓고) 직접 해 보기 · 연습 문제 · 따라 말하기 · `HT.Q`에서 모아요. 역할 색은 공항 · 카페와 같아요.
- `restaurant/` 식당, 질문의 모양이 대답을 정한다 (영역: `talk`) — 회화 네 번째 튜토리얼(`hotel/`을 복사해 시작). 핵심은 ‘질문의 모양’: 서버가 짧은 질문을 많이 하니, 먼저 모양을 잡아요 — Yes/No 질문(Yes · No + 한 마디, 권하는 말이면 원하는 것을 바로: Can I get you something to drink? → Just water, please.) · 고르는 질문(A or B?: Still or sparkling? → Sparkling, please.) · 정보 질문(How many? · How would you like your steak? → 정보 + please). 고르는 · 정보 질문에 Yes · No만 하면 ①. 모양은 말마다 적어 두고(`shape`, 고르는 질문은 `choices`) `RS.shapeOf`로 읽으며, `RS.check()`가 글의 모양(`RS.shapeGuess`: 마지막 물음 문장 → or가 있으면 고르기 · 의문사로 시작하면 정보 · 나머지 Yes/No · 물음표가 없으면 안내 `note`)과 맞춰 봐요. 모양 표시(스위치 · 갈림길 · 빈 상자 · 말풍선)는 `RSS.ICON`의 `shape_yn` · `shape_or` · `shape_wh` · `shape_note`로 캔버스와 HTML(칩 · 힌트 · 퀴즈의 `.shp`)이 같은 길을 써요. 식당 일곱 곳(`RS.PLACES`: 입구 · 자리 안내 → 자리 · 음료 → 주문 → 알레르기 · 요청 → 식사 중 → 디저트 · 포장 → 계산)은 01장에 식당 평면도(입구 · 호스트 자리 · 테이블 12 · 주방 · 바깥 자리 · 점선 계산대)로 크게, 03–07장 위쪽 띠(`strip`)로, 내가 먼저 말하기도 하는 곳(알레르기 · 식사 중 · 계산)은 보라 테두리. 이름공간은 `RS`(grammar) · `RSS`(scenes) · `RSV`(voices) · `RDrill`(듣고 대답 고르기 16). 규칙 엔진 `RS.judge`는 같은 3단계에 모양 단계를 더했어요 — ① Yes · No만 하는 대답(`bare` 틀)은 고르는 · 정보 질문 · 안내에서 탈락, 고르는 질문에서 서버가 말하지 않은 것을 고르면 ①(Soup or salad? → Fries ×), ② Yes/No 질문에 Yes · No만 하면 카드와 맞는지(`yn.yes`) 보고, 알레르기에 Yes.만 하면 안전 때문에 ②(`strict`). 지어낸 메뉴(`RS.MENU`: 값 · 알레르기 성분 `has`(뺄 수 있나 `fixed`) · 더 묻는 것 `needs`)로 `RS.bill`(세금 · 봉사료 없이) · `RS.split`(똑같이 나눔) · `RS.safe(음식, 알레르기)` · `RS.safeReply`(서버의 대답)를 계산해요. 한 줄 주문은 `RS.orderLine`(I'll have the → 음식 → 굽기 · 맵기 → with 곁들임 → 드레싱 → without → please, 알레르기 문장은 맨 앞이나 끝, 굽기는 스테이크 · 맵기는 국수 · 곁들임은 스테이크 · 연어 · 파스타에만)과 `RS.covered`(굽기 · 수프나 샐러드 · 드레싱 · 맵기 · 알레르기 · 빼고 만들기). 한 번만 나오는 질문(알레르기 · 빼고 만들기 · 계산 부탁)은 다른 곳에서 미리 답했어도 건너뛰어요(`RS.CROSS`). 숫자는 `RS.priceWords`($28.50 → twenty-eight fifty) · `RS.timeWords` · `RS.canon`(twenty-three forty = 23.40 = 2340), 들은 숫자 되묻기(`check`: Sorry, did you say fifteen minutes? · was that $28.50 each?). 그림은 식당 평면도 · 메뉴판(`menuDraw`, 알레르기 표시 P · S · M · N) · 계산서(`checkDraw`, 나눠 내면 EACH 줄) · 굽기 띠(`doneStrip`) · 식사 카드(`dineCard`) · 물잔(still · sparkling · soda · cider) · 접시 위 음식(`plateDraw`) · 포장 그릇 · 카드 단말기(팁 화면은 ‘나라마다 달라요’만) · 끝이 내려가는 고르는 질문의 높낮이 화살표(`pitch`). 놀이터는 ‘식당 시뮬레이터’(무작위 식사 카드 + HTML 메뉴판, 늘 쓰는 차례에 작은 변화 — 기다리는 시간 · 오늘의 스페셜 · 맞거나 다른 음식이 나옴, 서버가 말한 스페셜 이름과 나온 음식을 듣고 써야 함, 서버 부르기는 부르는 말 칩 + 부탁 칩, 주문에서 ‘한 줄 주문’(L), 식사 중 부탁 둘은 어느 쪽을 먼저 말해도 되고 서버가 남은 쪽을 물음(`needFirst`), 끝은 계산서 + 한 사람 몫 + 건너뛴 질문 수), ‘식당 표현 따라 말하기’ 28문장. 목소리는 입구 호스트 en-AU · 서버 en-US · 음식 나르는 직원 en-CA · 영국 식당의 서버 en-GB · 손님 `me` · 발음 듣기 `tc`. 글이 정해진 말은 directions와 같은 방식으로 VoiceStudio로 미리 만든 목소리(`audio/dialogue/`, 프로필도 directions와 같음 — 서버 미국 남성 · 호스트 호주 남성 · 직원 캐나다 여성 · 영국 서버 영국 여성 · 나 미국 여성 · 선생님 미국 여성), 시뮬레이터는 `clips: false`. 줄 목록 `window.__dialogueLines()`는 영상을 훑고(01장은 곳을, 09장은 3단계 줄을 하나씩 골라 놓고) 직접 해 보기 · 연습 문제 · 따라 말하기 · `RS.Q`에서 모아요. 역할 색은 공항 · 카페 · 호텔과 같고, 모양 표시는 Yes/No 하늘 · 고르기 노랑 · 정보 민트 · 안내 보라.
- `directions/` 길 묻기, 들은 길은 되짚어 확인한다 (영역: `talk`) — 회화 다섯 번째 튜토리얼(`restaurant/`를 복사해 시작). 핵심은 ‘길고 빠른 대답을 조각으로 듣고 되짚기’: 대답 = 동작(go straight · turn left · take the second left · cross · until you get to) + 기준점(at the bank · at the lights · onto Bell Street) + 도착 위치(on your right · across from · next to · between · on the corner of), 되짚기 = So, ___, ___, and it's on my ___? → That's right! 또는 틀린 조각만 고쳐 주는 말(Not quite — turn left at the bank.). 대화 일곱 단계(`DR.PLACES`: 말 걸기 → 묻기 → 동작 듣기 → 기준점 · 위치 듣기 → 거리 · 교통 → 되짚기 → 고맙다고 끝내기)는 01장에 길로, 내가 먼저 말하는 단계(말 걸기 · 묻기 · 되짚기)는 보라 테두리. 이름공간은 `DR`(grammar) · `DRS`(scenes) · `DRV`(voices) · `DDrill`(듣고 대답 고르기 16). 규칙 엔진은 지어낸 동네 `DR.TOWN`(남북 길 넷 × 동서 길 셋의 바둑판, 블록마다 자리 아홉, 이름이 보이는 기준점 · 가려는 곳 · 신호등 · 버스 정류장 둘 · 지도 밖의 먼 곳)에서 `DR.route(출발 = 길의 구간 + 바라보는 쪽, 가려는 곳)`로 두 번까지 도는 길(바라보는 쪽 기준의 왼쪽 · 오른쪽 `DR.LEFT` · `DR.RIGHT`, 블록 수 · 몇 번째 길 · 신호등 수 · 길 이름 · 기준점 · 길 건너기 · 도착 쪽)을 계산하고, `DR.verifyRoute`(벡터 외적)가 따로 다시 계산해 `check()`에서 맞춰 봐요. `DR.where`(across from · next to · between · on the corner of · behind), `DR.say`(블록 · 몇 번째 길 · 기준점이 나올 때까지 · 버스 말투) · `DR.sayKo` · `DR.sayKeys`, 조각 `DR.chunks` · `DR.modelLine`과 판정 뼈대 `DR.coreOf`(돌기 · 건너기 · 도착 쪽은 꼭, 블록 수 · 관계는 덧붙임), `DR.checkBack`(같은 교차점을 가리키는 다른 이름표 — 은행 · 신호등 · 길 이름 · 몇 번째 — 는 모두 인정, 일부만 확인해도 맞음 `partial`, 실수 종류 missing · dir · lm · nth · go · side · turnVsOn · twice · twice2 · cross · rel · num · where · order · extra와 고쳐 주는 말), 말로 한 되짚기 `DR.parseCheck` · `DR.matchSpoken`, 숫자 `DR.canon`(fifteen · 15 · one five, third · 3rd). 그림은 동네 지도(`town`: 이름표 · 걷는 사람 · 계산된 길 · 돌기 화살표 · 정류장 · 핀) · 버스 노선 띠 · 길 카드. 놀이터는 ‘길 찾기 시뮬레이터’(무작위 길 카드 — 지금 있는 곳 · 바라보는 쪽 · 가려는 곳 · 걸어서나 버스, 가려는 곳은 지도에 표시하지 않음. 모르는 사람(Thanks anyway) → 말 걸기(말 거는 말 칩 + 묻는 틀 칩 + 곳 이름 칩) → 버스면 Which bus should I take? → 길 안내 듣기 → 조각 칩으로 되짚기(같은 조각을 두 번 넣을 수 있음, 틀린 조각만 고쳐 줌, 들은 길에 없는 조각이면 처음부터 다시 말해 줌) → 지도에서 가려는 곳 · 탈 정류장 누르기 → 걷는 사람이 그 길을 따라감 → 고맙다고 끝내기)와 ‘길 묻기 표현 따라 말하기’ 28문장. 목소리는 길에서 만난 사람 en-US · 모자 쓴 사람 en-CA · 관광객(동네를 모름) en-AU · 영국에서 만난 사람 en-GB · 나 `me` · 발음 듣기 `tc`. 글이 정해진 말(영상 · 직접 해 보기 · 연습 문제 · 따라 말하기)은 VoiceStudio로 미리 만든 목소리(`audio/dialogue/`, 미국 남성 · 캐나다 여성 · 호주 남성 · 영국 여성 · 나 미국 여성 · 선생님 미국 여성)로 읽고, 파일이 없는 말은 브라우저 음성 — 한 번에 읽는 줄 안에서 한 사람의 말 중 하나라도 파일이 없으면 그 사람은 모두 브라우저 음성, 시뮬레이터는 `clips: false`로 늘 브라우저 음성(카드마다 말이 바뀌어서). 줄 목록은 `window.__dialogueLines()`가 영상을 훑고(01 · 09장은 단계를 하나씩 골라 놓고) 데이터에서 모아요 — 대화 · 문제를 고치면 `node tools/dialogue-lines.cjs directions` → `python3 tools/voicestudio-dialogue.py directions`. 역할 색은 회화 공통(되짚는 조각은 내 정보 민트), 엄격함은 ‘듣는 사람이 틀리다 · 헷갈린다 · 무례하다고 느낄 말만 거르고, 알아듣지만 더 흔한 말이 있으면 통과 + 알림’(결정 하나하나는 README).
- 새 튜토리얼은 주제가 가까운 쪽을 복사해 시작합니다. 장면의 낱말 조각 그리기(lay · morph · drawTok)는 두 튜토리얼이 같은 방식이에요.

영역(`catalog.js`의 `tracks`)
- `toeic` 토익 — 공개 중. 튜토리얼 17개(T01–T17) 모두 완료: 문법 Part 5·6(T01–T14), 듣기 Part 1–4(T15–T16), 독해 Part 7(T17)
- `talk` 상황별 영어 회화 — 공개 중: `airport`(공항, 시범) · `cafe`(카페) · `hotel`(호텔) · `restaurant`(식당) · `directions`(길 묻기). 같은 형식으로 쇼핑 … 으로 넓혀요(아래 ‘회화 튜토리얼이 갖출 것’)
- 튜토리얼이 없는 영역은 첫 화면에 ‘준비 중’ 칸으로 보여요(`status: 'soon'`).

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

토익 튜토리얼이면 먼저 `docs/toeic-100-types.md`의 ‘튜토리얼 계획’에서 다룰 유형 번호를 확인합니다. 다 만들면 그 표의 상태를 ‘완료’로 바꾸고, `catalog.js` 항목의 `types`에 유형 번호를 적습니다.

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
  - 연습 문제를 그리는 상자는 `<div id="drillRoot"></div>`, 섹션은 `<section id="drill">`. 둘에 같은 id를 쓰면 `getElementById`가 섹션을 돌려줘 머리말이 지워져요.
- **퀴즈 10문제**: 공통 부품 `EN.quiz`. 영상 순서대로. 답하면 바로 해설. 그림 문제는 `figure: { width, height, label, draw(g, st), pick(x, y) }`.
- **핵심 정리**: 한눈에 보는 표 + `<div class="en-gloss">` 용어(단계별로 묶음). 영어는 `<i lang="en">`.
- **영상 추출(`#export`)**: `window.EN_EXPORT`를 만듭니다(아래 '영상').

### 회화 튜토리얼이 갖출 것 (영역 `talk`)

`airport/`(공항, 시범)가 본보기이고 `cafe/`(카페) · `hotel/`(호텔) · `restaurant/`(식당) · `directions/`(길 묻기)가 그 뒤를 이어요. 다음 회화 튜토리얼(쇼핑 …)은 가까운 쪽을 복사해(`cp -r restaurant <slug>` · `cp -r directions <slug>`) 이름공간(`RS` · `RSS` · `RSV` · `RDrill`, `DR` · `DRS` · `DRV` · `DDrill` → 그 튜토리얼의 이름)을 바꾸고 아래를 따릅니다. 상대가 주로 묻는 곳은 공항 · 카페를, 내가 먼저 부탁하고 문제를 알리는 곳은 호텔을, 짧은 질문이 많아 질문의 모양(Yes/No · 고르기 · 정보)이 핵심인 곳은 식당을, 상대의 길고 빠른 설명을 듣고 그대로 따라가야 하는 곳(길 안내 · 순서 설명)은 길 묻기를 보세요. 위의 ‘튜토리얼 페이지가 갖출 것’은 그대로이고, 토익 튜토리얼과 다른 점만 적었어요. `catalog.js` 항목에는 `types`를 쓰지 않아요(토익 전용).

- **3단계 말하기 법** (풀이법 대신): ① **열쇠 낱말 잡기** — 무엇을 묻나(목적 · 기간 · 장소 · 고르기 · 확인 · 지시 …)와 질문의 모양(Yes/No 질문 · 고르는 질문 A or B? · 정보 질문 wh-). 고르는 질문 · 정보 질문에 Yes · No만 하면 ①에서 걸러요. 권하는 Yes/No 질문(Can I get you …?)에는 원하는 것을 바로 말해도 통과해요 ② **틀에 내 정보 넣기** — 짧은 대답 틀 + 사실과 맞는 정보(문장 전체가 아니어도 됨) ③ **공손하게 끝내기** — please · thank you · Could I …?, 못 알아들었으면 Sorry? Could you say that again, please? 영상 · 직접 해 보기 · 놀이터 · 힌트 · 퀴즈가 모두 이 세 단계를 써요. 한국어로 먼저 생각해 낱말 그대로 옮긴 말(My purpose is trip. · During five days. · Give me water.)과 다시 묻기(repair)는 튜토리얼마다 넣어요. 내가 먼저 말을 꺼내는 곳(부탁 · 문제 알리기)에서는 ①이 ‘무엇을 부탁하나 → 열쇠 낱말 하나’가 되고, ②의 틀은 부탁 틀(Could I get ___? · Could you ___?)이나 사실 + 부탁(The ___ isn't working. + Could you send someone to look at it?)이에요. 부탁은 질문으로, 따지거나 명령하는 말(Fix it. · This bill is wrong.)은 ③에서 걸러요. 상대의 대답이 길고 내가 그대로 따라가야 하는 곳(길 안내)에서는 ①이 ‘들을 때의 열쇠 낱말(동작 · 기준점 · 위치)’, ②가 ‘들은 조각을 되짚는 틀’(So, ___, ___, and it's on my ___?)이 돼요. 엔진이 되짚은 조각을 상대의 말과 조각마다 맞춰, 일부만 확인해도 맞게 받아들이고 틀린 조각에는 그 조각만 고쳐 주는 말(Not quite — …)을 계산해요.
- **곳 지도**: 그 상황의 곳(장소 · 단계)을 길 지도로 그려 01장에 크게, 곳을 다루는 장마다 위쪽에 작은 띠(`strip`)로 지금 위치를 보여 줘요. 곳 아이콘(`<이름공간>S.ICON`: 24×24 선 그림)은 캔버스(Path2D)와 HTML(SVG, `iconSVG`)이 같은 길을 써요. 그 상황의 핵심이 ‘차례’라면(카페) 지도는 차례가 보이는 평면도 · 길로 그려요.
- **대화 그림**: 상대(직원) 말풍선은 왼쪽, 내 말풍선은 오른쪽, 얼굴은 도형으로 그려요(`avatar`). 상대의 말은 낱말이 하나씩 나타나고 열쇠 낱말을 하늘색으로 칠해요. 내 대답은 틀 + 칸의 낱말 조각(`answer`, 같은 낱말은 같은 id라 `morph`로 미끄러짐)으로 만들고, 함정은 줄을 긋고 주황 이름표로 까닭을 붙여요. 말풍선을 누르면 그 사람 목소리로 들려줘요(HITS의 `play`).
- **규칙 엔진** (`grammar.js`): 질문 = `{ 곳, 뜻(intent), 영어, 한국어, 열쇠 낱말 key(질문 안에 꼭 있음), 빠른 말 fast }`, 대답 = 틀(`FRAME`: `___` 칸 · `{…}` 공손한 말 · tag ok · literal(한국어 그대로) · wrong(틀린 문장) · blunt(명령 · 조르기 · 따지기) · plain(please 없이 끊김)) + 칸 값(`SLOT`). `judge(질문, 대답, 카드)`는 ① 뜻이 맞나(빠른 말이면 다시 묻기만 통과) → ② 틀이 자연스럽고 칸의 정보가 카드 · 상황의 사실과 맞나 → ③ 공손한가로 판정하고, 걸린 단계와 한국어 까닭을 돌려줘요. 모범 대답은 `model`, 말로 한 대답은 `matchSpoken`(표시 낱말 + 카드의 사실만 봄, 공손함 · 발음은 판정하지 않음, 한국어 이름처럼 인식이 다르게 적기 쉬운 말은 들린 말이 있으면 받아들이고 알림만. 다만 카드와 다른 값이 또렷이 들리면 ②, 권하는 말에 yes · no 없이 다른 질문의 대답만 들리면 ①, 고르는 질문 · 정보 질문에 yes · no만 들리면 ①), 따라 말하기는 `compareWords`(낱말 맞춤). 칸 값 자체가 콩글리시일 수 있으면 값에 `bad` · `why`를 달아 ②에서 걸러요. 다시 묻기에는 Sorry? · Could you say that again, please? 말고도 들린 만큼 되묻는 말(Sorry, for here or to go?)이 있고, 엔진은 되물은 질문이 실제 질문과 같을 때만 통과시켜요. 대답 하나가 질문 여럿을 답할 수 있으면(카페의 한 문장 주문) `covered`로 이미 답한 질문을 돌려주고 시뮬레이터가 건너뛰어요. 값 · 번호처럼 화면 여러 곳에 나오는 수는 엔진이 계산해 영상 · 영수증 · 상대의 말이 어긋나지 않게 해요. 내가 먼저 하는 부탁도 상대의 여는 말(How can I help you?)에 대한 대답으로 적어요(뜻 `need`). 대답이 두 조각(사실 + 부탁)이면 두 번째 조각을 대답에 붙이고(`req`), 두 조각이 서로 맞는지(호텔의 `fix`)는 ②에서 봐요. 방 번호 · 시각처럼 숫자를 듣고 말하는 곳은 숫자를 영어 낱말로 읽는 함수(`spoken`: 1207 → twelve-oh-seven)와 숫자 낱말을 숫자로 모으는 함수(`canon`: twelve oh seven → 1207)를 엔진에 두어, `matchSpoken` · `compareWords`가 숫자로 적힌 말과 낱말로 적힌 말을 같게 봐요. 시뮬레이터의 건너뛰기(`covered`)는 같은 곳 안에서만, 그 질문 자신의 뜻은 빼고 써요(같은 곳에 같은 뜻의 질문이 또 있을 수 있어요). 대화 전체에서 한 번만 나오는 질문(식당의 알레르기 · 계산 부탁)은 다른 곳에서 미리 답했어도 건너뛰어요(`CROSS`). 지도 · 길처럼 공간을 계산하는 곳은 엔진이 길과 위치 관계를 계산하고(영상 · 지도 그림 · 상대의 말 · 퀴즈 그림이 모두 같은 계산), 같은 결과를 다른 방법으로 한 번 더 계산해 `check()`에서 맞춰 봐요. `check()`는 열쇠 낱말 · (모양을 적었으면) 글의 모양 · 맞는 보기 하나 · 정답 위치 · 영상 대화 · 실전 단계 · 시뮬레이터 카드 여러 장을 점검해요.
- **역할 색**: 열쇠 낱말 하늘 · 대답 틀 노랑 · 내 정보(칸에 넣는 말) 민트 · 빈칸 분홍 점선 · 공손한 말 보라 · 함정(한국어 그대로 · 무례한 말 · 다른 질문의 대답) 주황. 페이지에서는 `mark.mk-key · mk-frame · mk-slot · mk-pol · mk-trap`.
- **놀이터 = 상황 시뮬레이터**: 무작위 ‘내 카드’(사실)를 만들고, 상대가 질문 몇 개를 무작위 차례로(차례 자체가 배울 거리면 늘 쓰는 차례에 작은 변화만) 해요. 대답은 틀 칩(맞는 틀 하나 · 한국어 그대로 하나 · 다른 질문의 틀 하나) + 칸 칩(카드의 값 + 다른 값 둘)으로 만들거나, 음성 인식이 있으면 말로 해요. 엔진의 단계에 따라 상대가 자연스럽게 반응하고(① 열쇠 낱말을 힘주어 다시 물음 · ② 카드와 다름 · ③ 말투), 매번 까닭과 모범 대답(듣기 단추)을 보여 줘요. 끝나면 결과(한 번에 통과한 수 · 대화 전체 · 다시 듣기). 키보드로도 돼요. 상대가 알려 준 정보를 내가 나중에 써야 하면(호텔의 방 번호 · 식당의 오늘의 스페셜과 나온 음식) 카드에 적지 말고, 상대가 말한 뒤 화면에 나오게 하거나(카드 키 봉투) 듣고 판단하게 해서 듣고 기억해 쓰는 연습이 되게 해요. 카드에 같은 곳에서 말할 것이 둘 이상이고 어느 쪽을 먼저 말해도 되면(호텔의 모닝콜 · 짐, 식당의 식사 중 부탁 둘), 먼저 말한 쪽으로 차례를 바꾸고 남은 쪽을 상대가 묻게 해요 — 카드와 맞는 대답을 ‘카드와 달라요’로 거르면 안 돼요. 틀 칩의 함정도 카드에 없는 것으로 골라요. 칸 칩은 헷갈리기 쉬운 이웃 값(1207 · 1270, 6:30 · 6:13)을 함께 보여 줘요. 들은 것을 행동으로 확인하는 곳(길 묻기)은 답을 화면에 미리 보이지 말고(가려는 곳을 지도에 표시하지 않음) 대화가 끝나면 사용자가 지도에서 찾게 해요. 조각 칩으로 한 줄을 만들 때는 같은 조각이 두 번 나오는 경우(Take the first right. Then take the first right.)가 있으니 누를 때마다 더하고 ‘하나 지우기’로 빼요(눌러서 켜고 끄는 방식이면 두 번 넣을 수 없어요). 시뮬레이터를 시작하면 첫 차례에 상대의 말이 없어도(지나가는 사람에게 내가 먼저 말을 거는 차례) 영상과 음성 해설을 멈춰요.
- **따라 말하기** (회화 영역의 새 칸): 곳마다 상대의 말과 내 말을 합쳐 28문장 안팎, 문장마다 듣기 · 천천히 · 따라 말하기(직접 그린 마이크 아이콘). 있는 것부터 써요: ① `SpeechRecognition`/`webkitSpeechRecognition`(en-US) → 들린 낱말을 원래 문장과 맞춰 맞은 낱말 초록 · 빠진 낱말 주황 ② 없으면 `MediaRecorder` + `getUserMedia` → 녹음 뒤 ‘내 목소리’와 ‘원래 문장’을 이어서 ③ 둘 다 없으면 마이크를 숨기고 ‘세 번 소리 내어 따라 해 보세요’. 권한 거부 · 소리 없음 · 네트워크 오류는 짧은 한국어로 알려요. 듣기 전에 다른 소리(발음 듣기 · 대화 목소리 · 음성 해설 · 녹음 재생)를 멈춰요. 녹음은 메모리에만 둬요. 화면에 정직하게 적어요: 인식은 낱말만 맞춰 보고 발음의 질은 판정하지 않음 · 크롬 등은 소리를 브라우저 회사 서버로 보내 글로 바꿈 · 이 사이트는 아무것도 저장하지 않음.
- **연습 문제 = 듣고 대답 고르기** (`EN.drill` 대신 폴더 안의 듣기 연습 문제 — 공항 `ADrill` · 카페 `CDrill` · 호텔 `HDrill` · 식당 `RDrill` · 길 묻기 `DDrill`, 같은 `.edr` 모양): 16문제, 문제마다 곳 아이콘 · 한 줄 상황, 상대의 말은 소리 먼저(글은 답한 뒤 또는 T), 내 대답 넷은 글. 힌트 = 3단계(① 열쇠 낱말 · ② 틀과 칸 · ③ 공손한 말에 색), 답하면 보기별 엔진 까닭 · 해석 · 대화 듣기(상대 → 나). 모든 곳과 다시 묻기를 고루, 정답 위치 4/4/4/4. 내가 먼저 말을 거는 문제(지나가는 사람)는 들을 말 없이 상황만 보여 줘요. 되짚기 문제는 보기마다 한 조각만 다르게 만들어요. 키보드 A~D · H · R · S · T · Enter.
- **목소리** (`voices.js`, 폴더 안): 상대마다 다른 영어 목소리(en-US · en-GB · en-AU · en-CA, 없으면 높낮이), 나(`me`)는 상대와 다른 목소리. 빠른 말은 `rate`, 화면 글과 읽을 글이 다르면(Flight 207 → two-oh-seven, $6.50 → six fifty) 엔진의 `spoken`. 음성 해설의 자막에서는 값 · 시각을 `read` 규칙으로 한국어로 읽히고($6.50 → 6달러 50센트), 영어 낱말 바로 뒤에 숫자가 오면 영어 조각에 붙어 읽히니 마침표로 끊어요(자막 글에서 끊거나, `read` 규칙이 값 앞에 마침표를 넣어도 돼요). 영어로 읽어야 할 번호 · 시각(room 1207 · at 6:30)은 `read` 규칙에서 영어 낱말로 바꾸고, 한국어 속 번호(1207호)는 그대로 둬요. 읽기 전에 음성 해설 · 발음 듣기 · 녹음 재생을 멈추고 영상을 일시정지해요.
- **정직하게 밝히기**: 절차와 질문은 나라 · 장소마다 다르다는 것(영상 자막 · 머리말 · 각주), 이름 · 항공편 · 가게 이름 · 메뉴 · 값은 지어낸 것(실제 항공사 코드 · 체인 이름 · 체인 고유의 크기 이름 쓰지 않음), 소리는 합성 음성(브라우저 음성, 미리 만든 경우 VoiceStudio 음성)이라는 것.

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
  - **미리 만든 음성 파일(선택)**: `clips: window.EN_CLIPS`(`<slug>/audio/narration/clips.js`, `index.html`에서 app.js 앞에 불러옴). 자막을 읽기 조각(`narr.parts` → 한국어 · 영어)으로 나눠, 조각 id(`EN.narration.pieceId(lang, text)`)의 파일이 있으면 그 파일을(`<audio>` 하나, V 단추를 누를 때 잠금을 풂 — Safari), 없으면 브라우저 음성으로 읽어요. 파일을 못 읽으면 그 조각만 브라우저 음성으로. 빈 목록이면 예전과 똑같아요. 만드는 법: `node tools/narration-pieces.cjs <slug>`(클라우드에서도 됨) → VoiceStudio가 있는 맥에서 `python3 tools/voicestudio-narration.py <slug>`(기본은 한국어 조각만 — 영어 조각은 학습용 본보기 발음이라 브라우저의 en-US 음성 그대로, `--english`로 영어 조각도 같은 목소리, `--limit 5`로 먼저 들어 보기, 이미 만든 파일은 건너뜀) → `<slug>/audio` 커밋. 자막을 고치면 조각 목록을 다시 만들고 스크립트를 다시 돌리면 바뀐 조각만 새로 만들어요(그 전까지 바뀐 조각은 브라우저 음성). 영어 조각을 다른 목소리로 만들려면 `--en-profile 이름`(clips.js에 `voiceEn`으로 적혀 상태 줄에 보여요 — 회화 튜토리얼은 「영어 선생님 (미국 여성)」, 토익 튜토리얼은 더 밝은 「영어 선생님 (밝은 미국 여성)」). MP4에는 아직 소리를 넣지 않아요.
- **`EN.say(text, { slow, onend })`**, `EN.say.button(text, label)`, `EN.say.wire(root, { before })`, `EN.say.stop()` — 영어 음성으로 읽기. 음성을 쓸 수 없는 브라우저면 `<html class="no-say">`가 붙어 단추가 숨겨집니다. `window.EN_CLIPS`(음성 해설과 같은 목록)에 읽을 글의 조각 id(`EN.narration.pieceId('en', EN.say.text(글))`)가 있으면 그 파일로 읽어요(천천히는 같은 파일을 0.75배로, 못 읽으면 브라우저 음성). `EN.say.hasClip(글)`로 확인. 토익 튜토리얼은 `tools/narration-pieces.cjs`가 `tools/say-sweep.js`로 모은 발음 듣기 글을 영어 조각(`from: 'say'`)으로 더해 「영어 선생님 (밝은 미국 여성)」으로 만들어요. 놀이터에서 조각을 골라 만든 문장처럼 조합이 많은 글은 모으지 않아 브라우저 음성으로 읽어요. 회화 튜토리얼은 발음 칩을 대화 목록(말하는 사람 `tc`)으로 만들어서 훑지 않아요.
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
