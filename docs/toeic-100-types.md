# 토익에서 자주 틀리는 100개 유형과 핵심 카테고리

토익 문법 영역의 튜토리얼을 만들기 위한 설계도입니다. 자주 틀리는 유형 100개를 **21개 카테고리**로 묶고, 카테고리를 다시 **튜토리얼 17개**로 나눴어요.
튜토리얼을 하나 만들 때마다 이 문서의 ‘튜토리얼 계획’ 표에 완료 표시를 하고, `assets/catalog.js`의 그 튜토리얼 항목 `types`에 다룬 유형 번호를 적어 주세요.

## 이 목록을 만든 방법 (먼저 읽어 주세요)

**한국 수험생이 어떤 유형을 몇 % 틀리는지 공개한 통계는 찾지 못했어요.** ETS는 파트별 점수만 공개하고, 학원·강의 자료의 ‘오답률 높은 유형’은 강사 경험에서 나온 의견이에요. 그래서 아래 세 가지 근거를 겹쳐서 골랐고, 유형마다 근거를 표시했어요.

| 표시 | 근거 | 내용 |
| --- | --- | --- |
| **형식** | 시험 구조 | 200문항(듣기 100, 읽기 100). 파트별 문항 수는 Part 1–4가 6·25·39·30, Part 5–7이 30·16·54. 2016년 개편 뒤 생긴 문항 형식(화자 의도, 시각 정보, 세 사람 대화, 문장 삽입, 채팅 지문, 삼중 지문)은 수험생이 낯설어하기 쉬워요. |
| **빈출** | 국내 수험 자료 | 품사, 시제, 수 일치, 접속사, 전치사가 자주 나오고, 품사 문제가 Part 5 출제 비중 1위로 꼽혀요. 상위권의 Part 5 오답은 단순 문법보다 어휘의 뉘앙스·짝(콜로케이션)에서 많이 나온다는 분석도 있어요. |
| **오류** | 한국인 학습자 오류 연구 | 동사 형태, 관사·한정사, 전치사, 수 일치, 품사(낱말 형태) 오류가 연구마다 반복해서 상위권에 올라요. 한국어에 관사와 필수 복수 표시가 없는 것이 주된 원인으로 꼽혀요. |

- 번호는 **틀리는 순위가 아니라** 카테고리 순서예요.
- 듣기(Part 1–4)와 독해(Part 7)도 넣었어요. 시험의 절반이 듣기이고, Part 7이 54문항으로 가장 커서 문법만으로는 점수가 오르지 않기 때문이에요. 다만 문법(Part 5·6)은 유형으로 나누기가 쉬워 66개로 가장 많아요.
- 예문은 모두 토익 형식을 본떠 새로 만들었어요. 굵은 글씨가 정답이에요.
- 파트별 문항 수는 이번 조사에서 여러 자료로 확인했어요. 2016년 개편으로 생긴 문항 형식의 이름은 ETS 공식 안내서로 다시 확인하지 못했으니, 튜토리얼을 만들 때 공식 예제 문항과 대조해 주세요.
- **우리 학생에게 맞는 순위는 실제 데이터로 정해야 해요.** 맨 아래 ‘다음 단계’를 보세요.

## 한눈에 보기: 21개 카테고리

| # | 카테고리 | 유형 | 파트 | 튜토리얼 |
| --- | --- | --- | --- | --- |
| 1 | 품사 자리 | 1–8 | 5·6 | **T02 완료** |
| 2 | 동사 ① 수 일치 | 9–12 | 5·6 | **T03 완료** (12번은 T01에서 다룸) |
| 3 | 동사 ② 능동·수동 | 13–15 | 5·6 | **T03 완료** |
| 4 | 동사 ③ 시제 | 16–20 | 5·6 | **T04 완료** |
| 5 | 문장 구조와 동사 자리 | 21–23 | 5·6 | **T07 완료** |
| 6 | to부정사·동명사 | 24–27 | 5·6 | **T07 완료** |
| 7 | 분사 | 28–30 | 5·6 | **T08 완료** |
| 8 | 연결어: 접속사·전치사·접속부사 | 31–35 | 5·6 | **T05 완료** |
| 9 | 관계사 | 36–40 | 5·6 | **T01 완료**(36–39) · **T09 완료**(39 관계부사 · 40) |
| 10 | 명사절 | 41–42 | 5·6 | **T09 완료** |
| 11 | 대명사 | 43–46 | 5·6 | **T10 완료** |
| 12 | 명사·관사·수량 표현 | 47–51 | 5·6 | **T06 완료** |
| 13 | 비교 | 52–53 | 5 | **T12 완료** |
| 14 | 가정법·도치 | 54–55 | 5 | **T12 완료** |
| 15 | 전치사 | 56–58 | 5·6 | **T11 완료** |
| 16 | 어휘·짝 표현 | 59–63 | 5·6 | **T13 완료** |
| 17 | Part 6 글 단위 문제 | 64–66 | 6 | **T14 완료** |
| 18 | Part 1 사진 묘사 | 67–69 | 1 | T15 |
| 19 | Part 2 질의응답 | 70–77 | 2 | T15 |
| 20 | Part 3·4 대화·담화 | 78–88 | 3·4 | T16 |
| 21 | Part 7 독해 | 89–100 | 7 | T17 |

## 100개 유형

### 1. 품사 자리 (Part 5·6)

빈칸 앞뒤만 보고 명사·형용사·부사·동사 중 무엇이 들어갈지 정하는 문제. 다른 모든 유형의 기초예요.

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 1 | 관사·소유격·형용사 뒤 → 명사 | the ___ of the contract → **renewal** (renew ✗) | 빈출·오류 · **T02** |
| 2 | 명사 앞 → 형용사 | a ___ increase in sales → **significant** (significantly ✗) | 빈출·오류 · **T02** |
| 3 | 동사·형용사·문장을 꾸미는 자리 → 부사 (완전한 문장 앞뒤의 빈칸 포함) | Sales have ___ improved. → **steadily** | 빈출 · **T02** |
| 4 | be·remain·become 뒤 보어 → 형용사 | Prices will remain ___. → **competitive** (competitively ✗) | 빈출 · **T02** |
| 5 | 목적격 보어 → 형용사 | Please keep the files ___. → **secure** (securely ✗) | 빈출 · **T02** |
| 6 | 사람 명사 vs 행위·추상 명사 | an experienced ___ → **consultant** (consultation ✗) | 빈출 · **T02** |
| 7 | 명사 + 명사 (복합명사) | a customer ___ survey → **satisfaction** (satisfied ✗) | 빈출 · **T02** |
| 8 | 뒤에 목적어가 있으면 동명사, 없으면 명사 | by ___ the budget → **reviewing** (review ✗) | 빈출 · **T02** |

### 2. 동사 ① 수 일치 (Part 5·6)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 9 | 주어와 동사 사이의 수식어 건너뛰기 | The results of the survey ___ ready. → **are** | 빈출·오류 · **T03** |
| 10 | 수량 표현 주어 (a number of + 복수 / the number of + 단수 / each·every + 단수) | The number of applicants ___ increased. → **has** | 빈출·오류 · **T03** |
| 11 | 동명사·명사절·불가산 명사 주어는 단수 | Reviewing the reports ___ time. → **takes** | 빈출 · **T03** |
| 12 | 주격 관계대명사 뒤 동사의 수 = 선행사의 수 | Employees who ___ the workshop … → **attend** | 빈출 · T01 |

### 3. 동사 ② 능동·수동 (Part 5·6)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 13 | 목적어가 없으면 수동태 | The winners will be ___ next week. → **announced** | 빈출 · **T03** |
| 14 | 4·5형식 수동태 뒤에 남는 말 | She was given **a bonus**. / The plan is considered **essential**. | 빈출 · **T03** |
| 15 | 자동사는 수동태가 없음 (occur, arise, rise, take place) | A delay ___ yesterday. → **occurred** (was occurred ✗) | 빈출·오류 · **T03** |

### 4. 동사 ③ 시제 (Part 5·6)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 16 | 시간 표현 단서 (last·ago → 과거, since·so far → 현재완료, next·soon → 미래) | She ___ here since 2020. → **has worked** | 빈출·오류 · **T04** |
| 17 | 시간·조건 부사절은 현재 시제로 미래를 나타냄 | When the shipment ___, we will call you. → **arrives** (will arrive ✗) | 빈출·오류 · **T04** |
| 18 | 미래완료·과거완료 (by + 미래 시점, before + 과거) | By next March, she ___ the course. → **will have completed** | 빈출 · **T04** |
| 19 | 요구·제안·주장 동사 뒤 that절의 동사원형 | We recommend that he ___ early. → **arrive** | 빈출 · **T04** |
| 20 | 시제와 짝인 부사 (already·yet·still, recently, shortly) | The lobby has ___ been renovated. → **recently** | 빈출 · **T04** |

### 5. 문장 구조와 동사 자리 (Part 5·6)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 21 | 동사가 비어 있으면 진짜 동사 (-ing·to부정사 ✗), 조동사·please 뒤 동사원형 | Please ___ the attached form. → **complete** | 빈출 · **T07** |
| 22 | 접속사 없이 동사 두 개 ✗ → 준동사 | Staff ___ the seminar will receive a manual. → **attending** (attend ✗) | 빈출 · **T07** |
| 23 | 타동사 vs 자동사 + 전치사 (discuss about ✗) | We will ___ the issue tomorrow. → **discuss** / respond **to**, comply **with** | 빈출·오류 · **T07** |

### 6. to부정사·동명사 (Part 5·6)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 24 | 동사가 고르는 목적어 (decide to / consider -ing) | We are considering ___ a new branch. → **opening** | 빈출·오류 · **T07** |
| 25 | to 다음 -ing가 오는 표현 | We look forward to ___ you. → **meeting** / be committed to **improving** | 빈출·오류 · **T07** |
| 26 | 형용사·명사 + to부정사 | Full-time staff are eligible ___ for the program. → **to apply** | 빈출 · **T07** |
| 27 | 목적어 + to부정사 / 원형 (encourage A to, have A do) | We encourage employees ___ the session. → **to attend** | 빈출 · **T07** |

### 7. 분사 (Part 5·6)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 28 | 명사를 꾸미는 -ing(능동) vs -ed(수동), 명사 뒤 분사구 | the ___ file → **attached** / applications ___ after Friday → **submitted** | 빈출 · **T08** |
| 29 | 감정 분사 (-ing: 감정을 일으킴, -ed: 감정을 느낌) | an **exciting** offer / **excited** customers | 빈출·오류 · **T08** |
| 30 | 분사구문 (주절 주어와의 관계) | When ___ the form, use black ink. → **completing** | 빈출 · **T08** |

### 8. 연결어: 접속사·전치사·접속부사 (Part 5·6)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 31 | 전치사 vs 접속사: 뒤에 명사냐, 주어 + 동사냐 | ___ the rain, the event continued. → **Despite** (Although ✗) | 빈출 · **T05** |
| 32 | 부사절 접속사의 뜻 (unless, once, as long as, whereas, so that) | ___ you register by Friday, the discount will not apply. → **Unless** | 빈출 · **T05** |
| 33 | 짝을 이루는 접속사 (either A or B, both A and B, not only A but also B) | You can apply **either** online ___ by phone. → **or** | 빈출 · **T05** |
| 34 | 접속부사는 두 절을 잇지 못함 (however, therefore, moreover) | Sales rose. ___, profits fell. → **However** (Although ✗) | 빈출 · **T05** |
| 35 | 여러 단어 전치사·분사형 전치사 (prior to, due to, on behalf of, following, including) | ___ the meeting, please read the agenda. → **Prior to** | 빈출 · **T05** |

### 9. 관계사 (Part 5·6)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 36 | 선행사(사람/사물)와 격(주격·목적격·소유격) | the candidate ___ we interviewed → **whom** | 빈출 · **T01** |
| 37 | what vs which·that (선행사가 있느냐) | ___ the client requested was an estimate. → **What** | 빈출 · **T01** |
| 38 | 콤마·전치사 뒤 that ✗ | the agency with ___ we signed the contract → **which** | 빈출 · **T01** |
| 39 | 관계대명사 vs 관계부사 (빈자리가 있느냐, 완전한 문장이냐) | The museum ___ we visited … → **which** (where ✗) | 빈출 · **T01**(일부) · **T09** |
| 40 | 복합관계사 (whoever, whatever, however + 형용사) | ___ arrives first should unlock the office. → **Whoever** | 빈출 · **T09** |

### 10. 명사절 (Part 5·6)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 41 | 명사절 that vs what (뒤 문장이 완전하냐) | It is clear ___ we need more staff. → **that** / ___ we need is time. → **What** | 빈출 · **T09** |
| 42 | whether vs if, 의문사 명사절의 어순 | I don't know when the train **leaves**. (does the train leave ✗) | 빈출·오류 · **T09** |

### 11. 대명사 (Part 5·6)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 43 | 인칭대명사의 격 (they·them·their·theirs) | Please send ___ your feedback. → **us** | 빈출·오류 · **T10** |
| 44 | 재귀대명사 (주어 = 목적어, by oneself) | She prepared the report **by herself**. | 빈출 · **T10** |
| 45 | 부정대명사 (one, another, the other, others) | One printer works, but **the other** does not. | 빈출 · **T10** |
| 46 | 대명사의 수와 that·those (회사 → its, 비교 대상 those of) | This year's sales are higher than ___ of last year. → **those** | 빈출·오류 · **T10** |

### 12. 명사·관사·수량 표현 (Part 5·6)

한국어에는 관사도, 반드시 붙여야 하는 복수 표시도 없어서 한국인 학습자가 특히 많이 틀리는 영역이에요.

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 47 | 셀 수 있는 단수 명사에는 관사·한정사가 필요 | Please submit **an** application. (submit application ✗) | 오류 · **T06** |
| 48 | 셀 수 없는 명사 (information, equipment, advice, feedback, luggage) | ___ information → **much** (informations ✗, many ✗) | 빈출·오류 · **T06** |
| 49 | 수량 표현 + 명사의 수 (each·every + 단수, several·a few + 복수, much·little + 셀 수 없는 명사) | **several** candidates / **each** candidate | 빈출·오류 · **T06** |
| 50 | almost vs most vs most of | **almost all** employees / **most** employees / **most of the** employees | 빈출·오류 · **T06** |
| 51 | 숫자-하이픈 명사는 단수, another + 단수 / other + 복수 | a **three-day** workshop (three-days ✗) / **another** day | 빈출·오류 · **T06** |

### 13. 비교 (Part 5)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 52 | 원급·비교급 (as ~ as, 비교급 강조 much·even·far — very ✗) | The new system is ___ faster than the old one. → **much** | 빈출 · **T12** |
| 53 | 최상급, one of the + 최상급 + 복수 명사, the 비교급 ~ the 비교급 | one of the **largest** suppliers | 빈출 · **T12** |

### 14. 가정법·도치 (Part 5)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 54 | 가정법과 if를 생략한 도치 | ___ you have any questions, call us. → **Should** | 빈출 · **T12** |
| 55 | 부정어·only로 시작하는 도치 | Only after the review **will we** announce the results. | 빈출 · **T12** |

### 15. 전치사 (Part 5·6)

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 56 | 시간 전치사 (by vs until, for vs during, within, since) | Submit the report ___ Friday. → **by** (until ✗) | 빈출·오류 · **T11** |
| 57 | 장소·위치와 뜻을 더하는 전치사 (between·among, throughout, as 자격, by 차이) | Sales increased ___ 10 percent. → **by** | 빈출·오류 · **T11** |
| 58 | 동사·형용사·명사와 짝인 전치사 | responsible **for**, access **to**, an increase **in** | 빈출·오류 · **T11** |

### 16. 어휘·짝 표현 (Part 5·6)

상위권 수험생의 Part 5 오답이 가장 많이 남는 곳이에요.

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 59 | 동사 + 목적어 짝 | **implement** a plan, **conduct** a survey, **meet** a deadline | 빈출 · **T13** |
| 60 | 명사 표현·업무 관용구 | **place** an order, **take** effect, until further **notice**, out of **stock** | 빈출 · **T13** |
| 61 | 모양이 비슷한 형용사 | considerable / considerate, reliable / reliant, economic / economical | 빈출 · **T13** |
| 62 | 부사 어휘 (approximately + 숫자, highly + 형용사, promptly) | ___ 200 people attended. → **Approximately** | 빈출 · **T13** |
| 63 | 헷갈리는 동사 (rise/raise, say/tell, remind/remember, lend/borrow) | The company will ___ prices. → **raise** (rise ✗) | 빈출·오류 · **T13** |

### 17. Part 6 글 단위 문제

문장 하나만 보면 보기가 다 맞아 보이고, 글 전체를 봐야 답이 정해지는 문제예요.

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 64 | 글 전체로 정하는 시제 | 공지문의 날짜·일정을 보고 앞으로 있을 일인지, 이미 끝난 일인지 판단 | 빈출·형식 · **T14** |
| 65 | 접속부사 고르기 | 앞뒤 문장이 대조(However)인지, 추가(In addition)인지, 결과(As a result)인지 | 빈출·형식 · **T14** |
| 66 | 문장 삽입과 지시어 | 빈칸 앞뒤의 this·these·they·also가 가리키는 대상으로 알맞은 문장 고르기 | 형식 · **T14** |

### 18. Part 1 사진 묘사

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 67 | 입는 동작(is putting on) vs 입고 있는 상태(is wearing) | 사진에 없는 ‘동작’을 말하는 보기가 오답 | 빈출 |
| 68 | being p.p.(지금 누가 하는 중) vs has been p.p.·is p.p.(사물의 상태), 위치 표현 | 사람이 없는 사진: Chairs **have been stacked**. (are being stacked ✗) | 빈출 |
| 69 | 사진에 없는 물건·비슷한 발음 함정 | 사진 속 물건 이름과 소리가 비슷한 단어가 들어간 보기 | 빈출 |

### 19. Part 2 질의응답

짧은 질문에 알맞은 대답을 고르는 문제. 회화 영역과 바로 이어져요.

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 70 | 첫 단어(의문사) 놓치기 | Where …? 에 시간으로 답한 보기를 고름 | 빈출 |
| 71 | 비슷한 발음·같은 단어를 되풀이하는 함정 | copy / coffee, contract / contact가 들리는 보기 | 빈출 |
| 72 | 직접 답하지 않는 정답 (간접 응답) | When is the meeting? → Didn't you get the e-mail? | 빈출 |
| 73 | 모른다·되묻기·다른 사람에게 넘기기 | I'm not sure. Ask Ms. Lee. | 빈출 |
| 74 | 평서문에 대한 응답 | The printer is jammed again. → I'll call the technician. | 빈출 |
| 75 | 제안·요청 의문문 (Why don't we…?, Would you mind…?) | Why don't we …? 를 이유를 묻는 말로 착각 | 빈출 |
| 76 | 선택 의문문 (A or B?) | Either is fine. / 둘 다 아닌 제3안 | 빈출 |
| 77 | 부정·부가 의문문과 Yes/No | Didn't you send it? → **Yes**, this morning. (= 보냈어요. 한국어식 ‘네/아니요’와 반대) | 빈출·오류 |

### 20. Part 3·4 대화·담화

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 78 | 같은 뜻 다른 표현(패러프레이즈) | 대화의 fully booked → 보기의 no vacancies | 빈출 |
| 79 | 문제 미리 읽기와 순서 | 세 문제의 순서 = 대화에서 답이 나오는 순서 | 빈출 |
| 80 | 주제·목적 | 대화의 처음 부분에서 답이 나옴 | 빈출 |
| 81 | 화자의 직업·장소 추론 (most likely) | 여러 단서 낱말을 모아 판단 | 빈출 |
| 82 | 문제점·걱정 | but, unfortunately, I'm afraid 뒤 | 빈출 |
| 83 | 요청·제안 | Could you …?, Why don't you …? 뒤 | 빈출 |
| 84 | 다음에 할 일 | 대화 끝부분의 I'll …, Let me … | 빈출 |
| 85 | 화자 의도 파악 | What does the man mean when he says "…"? | 형식 |
| 86 | 시각 정보 연계 (표·지도·일정표) | 들은 내용과 그림을 합쳐야 답이 나옴 | 형식 |
| 87 | 세 사람 대화의 화자 구분 | 누가 한 말인지 놓침 | 형식 |
| 88 | Part 4 담화 유형별 흐름 | 공지·광고·회의 발췌·음성 메시지의 정해진 순서 | 빈출 |

### 21. Part 7 독해

| # | 유형 | 예 · 함정 | 근거 |
| --- | --- | --- | --- |
| 89 | 주제·목적 | Why was the e-mail written? — 첫 문단 | 빈출 |
| 90 | 세부 정보 | 날짜·숫자·조건을 빨리 찾기 | 빈출 |
| 91 | NOT / True 문제 | 보기 네 개를 하나씩 지문과 대조 | 빈출 |
| 92 | 추론 | most likely, suggested — 지문에 그대로 쓰여 있지 않음 | 빈출 |
| 93 | 동의어 | is closest in meaning to — 사전 뜻이 아닌 문맥 속 뜻 | 빈출 |
| 94 | 같은 뜻 다른 표현(패러프레이즈) | 지문과 보기의 표현이 다름 | 빈출 |
| 95 | 요청·지시 사항 | What is Mr. Kim asked to do? | 빈출 |
| 96 | 문장 삽입 | In which of the positions marked [1]–[4] does the following sentence best belong? | 형식 |
| 97 | 채팅·문자의 의도 파악 | At 10:15 A.M., what does Ms. Park mean when she writes "…"? | 형식 |
| 98 | 양식·표·광고처럼 문장이 아닌 지문 | 청구서·일정표·신청서에서 필요한 칸만 읽기 | 빈출 |
| 99 | 이중 지문 연계 | 두 글의 정보를 합쳐야 답이 나옴 | 빈출 |
| 100 | 삼중 지문 연계 | 세 글 가운데 어느 글에 단서가 있는지 찾기 | 형식 |

## 튜토리얼 계획: 17개

제작 순서 제안이에요. 먼저 Part 5의 뼈대(품사 → 동사 → 연결어)를 세우고, 한국인이 특히 약한 명사·관사·수량 표현을 일찍 다뤄요. 그 뒤 준동사와 관계사로 넓히고, 듣기와 독해로 넘어가요.

| 순서 | 튜토리얼 (가칭) | 다루는 유형 | 상태 |
| --- | --- | --- | --- |
| T01 | 관계대명사, 빈자리를 찾아라 | 12, 36–39 | **완료** |
| T02 | 빈칸의 자리가 품사를 정한다 | 1–8 | **완료** |
| T03 | 주어가 수를, 목적어가 태를 정한다 | 9–11, 13–15 | **완료** |
| T04 | 시간선 위에 동사를 놓아라 | 16–20 | **완료** |
| T05 | 접속사냐 전치사냐, 빈칸 뒤가 답한다 | 31–35 | **완료** |
| T06 | 명사 검문소를 통과하라 | 47–51 | **완료** |
| T07 | 진짜 동사는 하나, 나머지는 to와 -ing | 21–27 | **완료** |
| T08 | -ing냐 -ed냐, 주인에게 물어라 | 28–30 | **완료** |
| T09 | 빈자리가 있느냐 없느냐, 그것이 문제로다 | 39(관계부사), 40–42 | **완료** |
| T10 | 가리키는 말이 줄을, 자리가 칸을 정한다 | 43–46 | **완료** |
| T11 | 전치사, 그림으로 보고 짝으로 외워라 | 56–58 | **완료** |
| T12 | 신호어가 짝을 부른다 | 52–55 | **완료** |
| T13 | 낱말에도 단짝이 있다 | 59–63 | **완료** |
| T14 | 한 문장으론 모른다, 앞뒤 문장이 답한다 | 64–66 | **완료** |
| T15 | 듣기 ① 사진과 질의응답 (Part 1·2) | 67–77 | |
| T16 | 듣기 ② 대화와 담화 (Part 3·4) | 78–88 | |
| T17 | 독해 전략 (Part 7) | 89–100 | |

만들 때 고려할 점
- **T13 어휘**는 규칙보다 양이 중요해서, 영상보다 카드 넘기기·반복 연습 위주로 형식을 바꾸는 편이 좋아요.
- **T15·T16 듣기**는 지금의 브라우저 영어 음성(speechSynthesis)으로 만들 수 있지만, 기기마다 목소리가 다르고 실제 시험의 억양(미국·영국·호주·캐나다)과 속도를 흉내 내기 어려워요. 녹음한 음성 파일을 쓸지 먼저 정해야 해요.
- **T17 독해**는 화면에 긴 지문을 띄워야 해서, 영상 무대보다 페이지 위의 지문에 표시를 칠해 가는 방식이 어울려요.

## 다음 단계: 우리 학생의 실제 오답 순위로 바꾸기

이 목록은 일반적인 근거로 고른 출발점이에요. 한림대 영어영문학과 학생에게 맞는 순서를 정하려면 실제 데이터가 필요해요.

1. **진단 평가**: 유형 번호를 붙인 짧은 진단 문제(예: Part 5 30문항 + Part 2 10문항)를 학기 초에 풀게 하고, 유형별 오답률로 튜토리얼 순서를 다시 정해요.
2. **사이트에서 오답 모으기**: 연습 문제마다 이 문서의 유형 번호를 붙이면, 어떤 유형을 많이 틀리는지 모을 수 있어요. 지금 사이트는 서버가 없는 정적 사이트라서, 모으려면 별도의 저장 공간(예: 설문 도구나 외부 데이터베이스)이 필요해요. 이름·학번 없이 유형별 숫자만 모으면 돼요.

## 근거 자료

시험 구조
- ETS Global, [Format and questions of the TOEIC Listening and Reading test](https://www.etsglobal.org/cm/en/help-center/test-content/format-questions-toeic-listening-reading)
- 990prep, [TOEIC Test Format 2026: 7 Parts, Questions & Timing](https://990prep.com/en/guides/toeic-test-format-breakdown)
- PREP, [Latest TOEIC Test Format: Full Breakdown and Key Updates](https://prepedu.com/en/blog/toeic-test-format)

국내 수험 자료 (빈출 유형, 의견)
- 나무위키, [TOEIC/시험 유형](https://namu.wiki/w/TOEIC/%EC%8B%9C%ED%97%98%20%EC%9C%A0%ED%98%95)
- 영어과외TV, [토익 파트5 점수 잘 받는 공부법](https://englishtutortv.com/%ED%86%A0%EC%9D%B5-%ED%8C%8C%ED%8A%B85-%EC%A0%90%EC%88%98-%EC%9E%98-%EB%B0%9B%EB%8A%94-%EA%B3%B5%EB%B6%80%EB%B2%95-%EA%BF%80%ED%8C%81-%EC%B4%9D%EC%A0%95%EB%A6%AC/)
- 토익 문제 유형 완벽 정리, [파트별 출제 방식과 준비 방법](https://nice-info.com/%ED%86%A0%EC%9D%B5-%EB%AC%B8%EC%A0%9C-%EC%9C%A0%ED%98%95-%EC%99%84%EB%B2%BD-%EC%A0%95%EB%A6%AC-%ED%8C%8C%ED%8A%B8%EB%B3%84-%EC%B6%9C%EC%A0%9C-%EB%B0%A9%EC%8B%9D%EA%B3%BC-%EC%A4%80%EB%B9%84-%EB%B0%A9/)
- 해커스영어, [파트5-6 오답 갯수별 공부 방법](https://www.hackers.co.kr/?c=s_toeic%2Ftoeic_board%2FB_TOEIC_secret&uid=209023)

한국인 학습자 오류 연구
- [Interlanguage Errors in the Written Work of Korean High School EFL Students](https://scholarworks.sookmyung.ac.kr/item/47eb31f1-c700-4070-9555-897c88141e1b) — 동사 형태, 낱말 형태, 관사·한정사, 전치사 순
- [The Primary Causes of Article Errors Made by Korean Advanced Learners of English](https://scholar.kyobobook.co.kr/article/detail/4010022319134) — 관사 오류의 원인: 지시성 판단, 가산성
- [Effects of Language Proficiency on Error Patterns of Korean EFL University Students' Writing](https://scholar.kyobobook.co.kr/article/detail/4010024911871) — 수준별 오류 유형
- [A Corpus Analysis of the Preposition *of* in Korean College Matriculants' Writing](https://scholar.kyobobook.co.kr/article/detail/4010024635498) — 전치사 오류
