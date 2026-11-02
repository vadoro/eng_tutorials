/* 듣기 ① 사진과 질의응답 (Part 1 · 2) — 규칙 엔진과 문제
 *
 * 녹음이 없으니 영어는 모두 브라우저 음성으로 들려줘요(voices.js). 규칙 엔진은 소리를 듣지 않고,
 * 문제마다 적어 둔 ‘사진의 사실’과 ‘문장 · 대답의 짜임’을 맞춰 봐요.
 *
 * Part 1 (사진 묘사) — LP.judge1(문장, 사진)
 *   ① 사진의 주인공 — 문장의 주어(st.who)가 사진에 있나 (사람 · 사물)
 *   ② 동작인가 상태인가 — is ~ing(지금 하는 동작) · is wearing/holding/sitting(사람의 상태)
 *                        · is being p.p.(누가 지금 그 일을 하는 중) · has been p.p./is p.p.(이미 그렇게 된 상태)
 *   ③ 사진에 없는 말 — 문장 속 물건(st.obj)이 사진에 있나. 비슷한 소리(st.sound)는 까닭에 덧붙임
 *   사진의 사실: people(사람) · things(물건) · acts([누가, 동작] 지금 하는 일) · states([누가/무엇이, 상태])
 *
 * Part 2 (질의응답) — LP.judge2(문제, 보기 번호)
 *   ① 첫 단어 — 질문의 종류(pt: wh · yn · neg · tag · sugg · req · choice · stmt)가 기대하는 답의 종류를 정함
 *   ② 함정 지우기 — 엉뚱한 종류(kind가 기대와 다름) · 같은 단어(same) · 비슷한 소리(sound)
 *   ③ 말이 되나 — Yes/No와 뒷말(yn · fact)이 맞나, 앞뒤가 맞나(off). 돌려 말한 답(간접 응답)도 정답
 *   모른다 · 넘기기 · 되묻기 · 확인하기 · 상황 알리기는 어떤 질문에도 올 수 있는 간접 응답이에요(LP.INDIRECT).
 *
 * judge → { s: 'ok' | 'no', step: 0 | 1 | 2 | 3, why, tags }
 *   tags(Part 2): direct 바로 답 · indirect 간접 응답 · type 엉뚱한 종류 · same 같은 단어 · sound 비슷한 소리 · logic 앞뒤 안 맞음
 * 영상의 ✓·×, 직접 해 보기, 놀이터(함정 감별사 · 동작·상태 고르기), 연습 문제, 퀴즈가 모두 이 판정을 써요.
 * 문제 데이터에 적은 정답과 판정이 어긋나면 LP.check()가 콘솔에 경고를 내요.
 */
(function () {
  'use strict';
  const LP = (window.LP = {});

  /* ---------- 한국어 조사 (받침이 있으면 앞의 것) ---------- */
  const lastKo = s => { s = String(s); for (let i = s.length - 1; i >= 0; i--) { const c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return c; } return 0; };
  const has = s => { const c = lastKo(s); return c ? (c - 0xAC00) % 28 !== 0 : false; };
  const ig = s => s + (has(s) ? '이' : '가'), eul = s => s + (has(s) ? '을' : '를'), eun = s => s + (has(s) ? '은' : '는');
  const iye = s => s + (has(s) ? '이에요' : '예요');
  // 으로/로: 받침이 없거나 ㄹ 받침이면 ‘로’
  const ro = s => { const c = lastKo(s); return s + (c && (c - 0xAC00) % 28 !== 0 && (c - 0xAC00) % 28 !== 8 ? '으로' : '로'); };
  LP.josa = { ig, eul, eun, iye, ro };
  const L4 = 'ABCD';
  const uniq = a => [...new Set(a)];

  /* =========================================================
     Part 1 — 사진 묘사
     ========================================================= */
  // 주어가 될 수 있는 사람 · 사물
  LP.WHO = {
    woman: '여자', man: '남자', women: '여자들', men: '남자들', people: '여러 사람', worker: '작업자', workers: '작업자들',
    chairs: '의자', boxes: '상자', plants: '화분', tables: '탁자',
  };
  LP.PERSON = ['woman', 'man', 'women', 'men', 'people', 'worker', 'workers'];
  // 문장에 나오는 물건
  LP.OBJ = {
    keyboard: '키보드', glasses: '안경', lamp: '램프', desk: '책상', monitor: '모니터', mug: '머그잔', papers: '서류', chair: '의자',
    jacket: '재킷', bag: '가방', umbrella: '우산', door: '문', hook: '옷걸이', wall: '벽', floor: '바닥', window: '창문',
    chairs: '의자', piano: '피아노', boxes: '상자', shelf: '선반', ladder: '사다리', table: '탁자', binders: '바인더',
    copier: '복사기', copies: '복사한 종이', coffee: '커피', plants: '화분', can: '물뿌리개', broom: '빗자루', trees: '나무',
    machine: '기계', office: '사무실', line: '줄',
  };
  // 동사: act = 사람이 지금 하는 동작 · st = 사람의 상태 · done = 사물이 이미 그렇게 된 상태. pair = 동작 ↔ 상태 짝
  LP.VB = {
    type:    { act: '키보드를 치는' },
    puton:   { act: '입는(쓰는)', pair: 'wear' },
    wear:    { st: '입은(쓴)', pair: 'puton' },
    sit:     { st: '앉아 있는' },
    stand:   { st: '서 있는' },
    hold:    { st: '들고 있는' },
    wait:    { act: '기다리는' },
    open:    { act: '여는', done: '열린' },
    hang:    { act: '거는', done: '걸려 있는' },
    stack:   { act: '쌓는', done: '쌓여 있는' },
    arrange: { act: '정리하는', done: '정리된' },
    move:    { act: '옮기는' },
    reach:   { act: '손을 뻗는' },
    make:    { act: '만드는' },
    walk:    { act: '걸어가는' },
    use:     { act: '쓰는' },
    carry:   { act: '나르는', done: '옮겨진' },
    line:    { act: '줄지어 놓는', done: '줄지어 놓인' },
    place:   { act: '놓는', done: '놓여 있는' },
    water:   { act: '물을 주는' },
    plant:   { act: '심는' },
    look:    { act: '보는' },
  };
  // 문장 꼴: act 사람 + is ~ing · state 사람의 상태 · beingpp is being p.p. · haspp has been p.p. · ispp is p.p. (위치 · 상태)
  LP.FORM = {
    act:     { name: '동작', ko: '지금 하는 동작 (is ~ing)', role: 'act' },
    state:   { name: '상태', ko: '사람의 상태 (is wearing · is holding · is sitting)', role: 'state' },
    beingpp: { name: '동작', ko: '누가 지금 하는 중 (is being p.p.)', role: 'act' },
    haspp:   { name: '상태', ko: '이미 그렇게 된 상태 (has been p.p.)', role: 'state' },
    ispp:    { name: '상태', ko: '놓인 모양 · 위치 (is p.p.)', role: 'state' },
  };

  /* ---------- 사진: 그림은 scenes.js의 LPS.photo가 같은 이름으로 그림 ----------
   * now: 지금 하는 일(한국어) · people · things · acts · states
   */
  LP.PHOTO = {
    desk:        { ko: '책상에 앉아 키보드를 치는 여자', now: '여자가 안경을 쓰고 앉아 키보드를 치고 있어요',
      people: ['woman'], things: ['desk', 'monitor', 'keyboard', 'mug', 'papers', 'window', 'plants', 'glasses', 'chair', 'wall'],
      acts: [['woman', 'type']], states: [['woman', 'sit'], ['woman', 'wear']] },
    jacketOn:    { ko: '재킷을 입는 중인 여자', now: '여자가 재킷 한쪽 팔을 끼우며 입고 있어요',
      people: ['woman'], things: ['jacket', 'door', 'hook', 'wall', 'floor'],
      acts: [['woman', 'puton']], states: [['woman', 'stand']] },
    jacketWear:  { ko: '재킷을 입고 가방을 든 여자', now: '여자가 재킷을 다 입고 가방을 든 채 서 있어요',
      people: ['woman'], things: ['jacket', 'bag', 'door', 'wall', 'floor'],
      acts: [], states: [['woman', 'wear'], ['woman', 'hold'], ['woman', 'stand']] },
    chairsEmpty: { ko: '사람이 없는 방, 벽 쪽에 쌓인 의자', now: '사람은 없고, 의자들이 벽 쪽에 쌓여 있어요',
      people: [], things: ['chairs', 'wall', 'window', 'floor'],
      acts: [], states: [['chairs', 'stack']] },
    chairsMan:   { ko: '의자를 쌓고 있는 남자', now: '남자가 의자를 들어 쌓고 있어요',
      people: ['man'], things: ['chairs', 'wall', 'window', 'floor'],
      acts: [['man', 'stack']], states: [['chairs', 'stack'], ['man', 'stand']] },
    boxesEmpty:  { ko: '벽을 따라 줄지어 놓인 상자', now: '사람은 없고, 상자들이 벽을 따라 바닥에 줄지어 놓여 있어요',
      people: [], things: ['boxes', 'wall', 'floor', 'door'],
      acts: [], states: [['boxes', 'line'], ['boxes', 'place']] },
    boxesMan:    { ko: '상자를 나르는 남자', now: '남자가 상자 하나를 들고 나르고 있어요',
      people: ['man'], things: ['boxes', 'wall', 'floor', 'door'],
      acts: [['man', 'carry']], states: [['boxes', 'line'], ['boxes', 'place'], ['man', 'hold']] },
    shelfReach:  { ko: '선반 맨 위 상자에 손을 뻗는 여자', now: '여자가 선반 맨 위의 상자 쪽으로 손을 뻗고 있어요',
      people: ['woman'], things: ['shelf', 'boxes', 'binders', 'wall', 'floor'],
      acts: [['woman', 'reach']], states: [['woman', 'stand'], ['boxes', 'place']] },
    copier:      { ko: '복사기로 복사하는 남자', now: '남자가 복사기 앞에서 복사를 하고 있어요',
      people: ['man'], things: ['copier', 'copies', 'papers', 'window', 'wall', 'floor', 'machine'],
      acts: [['man', 'make'], ['man', 'use']], states: [['man', 'stand']] },
    plantsMan:   { ko: '화분에 물을 주는 남자', now: '남자가 물뿌리개로 창가의 화분에 물을 주고 있어요',
      people: ['man'], things: ['plants', 'window', 'can', 'wall', 'floor'],
      acts: [['man', 'water']], states: [['man', 'stand'], ['man', 'hold'], ['plants', 'place']] },
    plantsEmpty: { ko: '창가에 놓인 화분', now: '사람은 없고, 화분들이 창가에 놓여 있어요',
      people: [], things: ['plants', 'window', 'wall', 'floor'],
      acts: [], states: [['plants', 'place']] },
  };
  const pairIn = (list, a, b) => list.some(([x, y]) => x === a && y === b);
  const peopleKo = P => P.people.length ? P.people.map(p => LP.WHO[p]).join(', ') + ' 한 명' : '사물 (사람 없음)';
  LP.peopleKo = id => peopleKo(LP.PHOTO[id]);

  const ok = (why, tags) => ({ s: 'ok', step: 0, why, tags: tags || [] });
  const no = (step, why, tags) => ({ s: 'no', step, why, tags: tags || [] });

  // 문장 하나가 사진과 맞나
  LP.judge1 = function (st, id) {
    const P = LP.PHOTO[id], who = st.who, isP = LP.PERSON.includes(who);
    const here = P.people.concat(P.things);
    // ① 주인공
    if (!here.includes(who)) {
      return no(1, P.people.length
        ? `${st.subjT} → ${LP.WHO[who]}. 사진의 주인공은 ${peopleKo(P)}이에요. 주어가 사진에 없어요.`
        : `${st.subjT} → ${LP.WHO[who]}. 사진에 사람이 없어요. 주인공은 사물이에요.`, ['who']);
    }
    // ② 동작인가 상태인가
    const V = LP.VB[st.v], pr = V.pair;
    if (st.form === 'act') {
      if (!pairIn(P.acts, who, st.v)) {
        if (pr && pairIn(P.states, who, pr)) return no(2, `${st.vT} → ${V.act} 동작이에요. 사진 속 ${LP.WHO[who]} → 이미 ${LP.VB[pr].st} 상태예요.`, ['form']);
        return no(2, `${st.vT} → 사진과 다른 동작이에요. 사진: ${P.now}.`, ['form']);
      }
    } else if (st.form === 'state') {
      if (!pairIn(P.states, who, st.v)) {
        if (pr && pairIn(P.acts, who, pr)) return no(2, `${st.vT} → 다 ${V.st} 상태라는 말이에요. 사진 속 ${LP.WHO[who]} → 아직 ${LP.VB[pr].act} 중이에요.`, ['form']);
        return no(2, `${st.vT} → 사진 속 ${LP.WHO[who]} 모습과 달라요. 사진: ${P.now}.`, ['form']);
      }
    } else if (st.form === 'beingpp') {
      if (!P.people.length) return no(2, `${st.vT} → 누가 지금 ${V.act} 중이라는 뜻이에요. 사진에 사람이 없어요.`, ['form']);
      if (!P.people.some(p => pairIn(P.acts, p, st.v))) return no(2, `${st.vT} → 누가 지금 ${V.act} 중이어야 해요. 사진: ${P.now}.`, ['form']);
    } else {   // haspp · ispp
      if (!pairIn(P.states, who, st.v)) {
        if (P.people.some(p => pairIn(P.acts, p, st.v))) return no(2, `${st.vT} → 다 ${V.done} 상태예요. 사진은 아직 ${V.act} 중이에요.`, ['form']);
        return no(2, `${st.vT} → ${ig(LP.WHO[who] || LP.OBJ[who])} ${V.done || V.st} 상태가 아니에요. 사진: ${P.now}.`, ['form']);
      }
    }
    // ③ 사진에 없는 말
    const miss = (st.obj || []).filter(o => !here.includes(o));
    if (miss.length) {
      const k = (st.obj || []).indexOf(miss[0]);
      return no(3, `${st.objT[k]} → 사진에 ${ig(LP.OBJ[miss[0]])} 없어요.` + (st.sound ? ` ${st.sound[0]} ↔ ${st.sound[1]}, 소리가 비슷한 함정이에요.` : ''), ['obj']);
    }
    const kind = LP.FORM[st.form].name;
    return ok(`${st.subjT} + ${st.vT} → ${kind}${st.form === 'beingpp' ? ' (사람이 지금 하는 중)' : ''}. 사진: ${P.now}.`);
  };

  /* =========================================================
     Part 2 — 질의응답
     ========================================================= */
  LP.WH = {
    where:    { w: 'Where', ask: '장소', kinds: ['place'] },
    when:     { w: 'When', ask: '때', kinds: ['time'] },
    who:      { w: 'Who', ask: '사람', kinds: ['person'] },
    why:      { w: 'Why', ask: '까닭', kinds: ['reason'] },
    how:      { w: 'How', ask: '방법', kinds: ['way'] },
    howlong:  { w: 'How long', ask: '걸리는 시간', kinds: ['length'] },
    howmuch:  { w: 'How much', ask: '값', kinds: ['price'] },
    whattime: { w: 'What time', ask: '시각', kinds: ['time'] },
  };
  LP.PT = {
    wh:     { name: '의문사 의문문', short: '의문사', exp: null },
    yn:     { name: 'Yes/No 의문문', short: '조동사', exp: ['yes', 'no'] },
    neg:    { name: '부정 의문문', short: '부정', exp: ['yes', 'no'] },
    tag:    { name: '꼬리 질문(부가 의문문)', short: '꼬리 질문', exp: ['yes', 'no'] },
    sugg:   { name: '제안', short: '제안', exp: ['accept', 'decline', 'yes', 'no'] },
    req:    { name: '요청', short: '요청', exp: ['accept', 'decline', 'yes', 'no'] },
    choice: { name: '선택 의문문(A or B)', short: '선택', exp: ['pick', 'either', 'neither', 'other'] },
    stmt:   { name: '평서문', short: '평서문', exp: ['react', 'yes', 'no'] },
  };
  LP.KIND = {
    place: '장소', time: '때', person: '사람', reason: '까닭', way: '방법', length: '걸리는 시간', price: '값', number: '수',
    thing: '물건 이름', fact: '다른 이야기', yes: 'Yes 대답', no: 'No 대답', accept: '좋다(받아들임)', decline: '싫다(거절)',
    pick: '하나 고르기', either: '둘 다 좋음', neither: '둘 다 아님', other: '다른 것 제안', react: '맞장구 · 해결책',
    unknown: '모른다', refer: '넘기기', ask: '되묻기', check: '확인하기', news: '상황 알리기',
  };
  LP.INDIRECT = ['unknown', 'refer', 'ask', 'check', 'news'];
  LP.TAG = { direct: '바로 답', indirect: '간접 응답', type: '엉뚱한 종류', same: '같은 단어', sound: '비슷한 소리', logic: '앞뒤 안 맞음' };
  LP.TAGS = ['direct', 'indirect', 'type', 'same', 'sound', 'logic'];
  LP.GOOD_TAG = { direct: 1, indirect: 1 };
  // 기대하는 답의 종류 (간접 응답은 언제나 됨)
  LP.expect = it => it.pt === 'wh' ? LP.WH[it.wh].kinds : LP.PT[it.pt].exp;
  LP.expectKo = it => it.pt === 'wh' ? `${LP.WH[it.wh].ask}` : LP.PT[it.pt].exp.map(k => LP.KIND[k]).join(' · ');
  // 첫 단어 설명 (힌트 ① · 영상 · 직접 해 보기)
  LP.firstKo = function (it) {
    if (it.pt === 'wh') return `${it.first} → ${eul(LP.WH[it.wh].ask)} 묻는 의문사 의문문이에요.`;
    if (it.pt === 'yn') return `${it.first} → 조동사로 시작하는 Yes/No 의문문이에요.`;
    if (it.pt === 'neg') return `${it.first} → 부정 의문문이에요.`;
    if (it.pt === 'tag') return `끝의 ${it.first} → 꼬리 질문이에요. 확인하는 Yes/No 질문이에요.`;
    if (it.pt === 'sugg') return `${it.first} → 이유를 묻는 말이 아니라 제안이에요.`;
    if (it.pt === 'req') return `${it.first} → 부탁하는 요청이에요.`;
    if (it.pt === 'choice') return `가운데 ${it.first} → 둘 가운데 고르는 선택 의문문이에요.`;
    return `${it.first} → 물음이 아닌 평서문이에요. 소식이나 문제를 알리는 말이에요.`;
  };
  // 기대하는 답 한 줄
  LP.wantKo = function (it) {
    if (it.pt === 'wh') return `${ro(LP.WH[it.wh].ask)} 답하거나, 돌려 말해요.`;
    if (it.pt === 'sugg' || it.pt === 'req') return '좋다 · 싫다로 답하거나, 돌려 말해요.';
    if (it.pt === 'choice') return '하나를 고르거나, 둘 다 · 둘 다 아님 · 다른 것으로 답해요.';
    if (it.pt === 'stmt') return '맞장구나 해결책으로 답해요.';
    if (it.pt === 'neg' || it.pt === 'tag') return '사실이 그러면 Yes, 아니면 No → 질문의 꼴이 아니라 사실을 따라요. 돌려 말해도 돼요.';
    return 'Yes, No 다음의 말이 질문과 맞아야 해요. 돌려 말해도 돼요.';
  };

  // 함정 · 종류 설명
  function typeWhy(it, o) {
    const k = LP.KIND[o.kind];
    if (it.pt === 'wh') {
      if (o.kind === 'yes' || o.kind === 'no') return `${it.first} → 의문사로 물었어요. Yes, No 대답은 맞지 않아요.`;
      return `${it.first} → ${eul(LP.WH[it.wh].ask)} 물어요. 이 대답은 ${iye(k)}.`;
    }
    if (it.pt === 'sugg' && o.kind === 'reason') return `${it.first} → 이유가 아니라 제안이에요. 까닭을 대는 대답은 엉뚱해요.`;
    if (it.pt === 'sugg' || it.pt === 'req') return `${it.first} → ${LP.PT[it.pt].short}이에요. 좋다 · 싫다로 답해야 해요. 이 대답은 ${iye(k)}.`;
    if (it.pt === 'choice') return (o.kind === 'yes' || o.kind === 'no') ? `A or B → 둘 가운데 고르는 질문이에요. Yes, No 대답은 맞지 않아요.` : `A or B → 고르는 질문인데, 이 대답은 ${iye(k)}.`;
    if (it.pt === 'stmt') return `평서문 → 맞장구나 해결책이 와야 해요. 이 대답은 ${iye(k)}.`;
    return `${it.first} → ${LP.PT[it.pt].short} 질문이에요. Yes, No 대답이 와야 하는데, 이 대답은 ${iye(k)}.`;
  }
  LP.judge2 = function (it, k) {
    const o = it.opts[k], exp = LP.expect(it), tags = [], why = [];
    if (o.same) { tags.push('same'); why.push(`같은 단어 함정: ${o.same[0].toLowerCase() === o.same[1].toLowerCase() ? o.same[1] + ' 되풀이' : o.same[0] + ' → ' + o.same[1]}. 같은 낱말이 들릴 뿐 대답이 아니에요.`); }
    if (o.sound) { tags.push('sound'); why.push(`비슷한 소리 함정: ${o.sound[0]} ↔ ${o.sound[1]}. 소리만 비슷하고 뜻은 엉뚱해요.`); }
    if (!exp.includes(o.kind) && !LP.INDIRECT.includes(o.kind)) { tags.push('type'); why.push(typeWhy(it, o)); }
    if (tags.length) return no(2, why.join(' '), tags);
    // ③ 말이 되나
    if (o.yn && ['yn', 'neg', 'tag', 'stmt'].includes(it.pt) && o.fact != null && (o.yn === 'yes') !== o.fact) {
      const head = o.yn === 'yes' ? 'Yes → ‘그렇다 · 했다’는 뜻이에요.' : 'No → ‘아니다 · 안 했다’는 뜻이에요.';
      return no(3, `${head} 그런데 뒤에서 ‘${o.factKo}’라고 해요. 앞뒤가 안 맞아요.` +
        (it.pt === 'neg' || it.pt === 'tag' ? ` 한국어 ‘${o.yn === 'no' ? '아니요' : '네'}, ${o.factKo}’를 그대로 옮긴 함정이에요.` : ''), ['logic']);
    }
    if (o.off) return no(3, o.off, ['logic']);
    const ind = LP.INDIRECT.includes(o.kind);
    let w;
    if (ind) w = `간접 응답(${LP.KIND[o.kind]}) → ${o.note}`;
    else if (o.yn && o.fact != null) w = `${o.yn === 'yes' ? 'Yes → 그렇다 · 했다' : 'No → 아니다 · 안 했다'}. 뒤의 말(${o.factKo})과 맞아요.` + (o.note ? ' ' + o.note : '');
    else w = o.note ? `바로 답 → ${o.note}` : `${ro(LP.KIND[o.kind])} 바로 답했어요.`;
    return ok(w, [ind ? 'indirect' : 'direct']);
  };
  // 한 보기의 대표 함정 이름(놀이터 · 힌트용): 같은 단어 · 비슷한 소리를 앞에 둠
  LP.mainTag = j => j.tags.find(t => t === 'same' || t === 'sound') || j.tags[0];

  /* =========================================================
     연습 문제 16개 (Part 1 여섯 · Part 2 열). 모두 토익 형식을 본떠 새로 만든 문제
     sp: 말하는 사람(목소리) us 미국 · gb 영국 · au 호주 · ca 캐나다. Part 2는 [질문, 대답]
     ========================================================= */
  // Part 1 문장: [글, who, form, v, obj, subjT, vT, objT, 해석, sound]
  const S1 = (t, who, form, v, obj, subjT, vT, objT, ko, sound) => ({ t, who, form, v, obj, subjT, vT, objT, ko, sound });
  LP.P1 = [
    { photo: 'plantsMan', sp: 'us', a: 1, type: 69, tag: 'Part 1 · 사진에 없는 말',
      opts: [
        S1('He is planting some trees.', 'man', 'act', 'plant', ['trees'], 'He', 'is planting', ['some trees'], '남자가 나무를 심고 있어요.'),
        S1('He is watering some plants.', 'man', 'act', 'water', ['plants'], 'He', 'is watering', ['some plants'], '남자가 화분에 물을 주고 있어요.'),
        S1('Some women are looking out a window.', 'women', 'act', 'look', ['window'], 'Some women', 'are looking', ['a window'], '여자 몇 명이 창밖을 보고 있어요.'),
        S1('He is holding a broom.', 'man', 'state', 'hold', ['broom'], 'He', 'is holding', ['a broom'], '남자가 빗자루를 들고 있어요.'),
      ] },
    { photo: 'jacketWear', sp: 'gb', a: 3, type: 67, tag: 'Part 1 · 동작과 상태',
      opts: [
        S1('She is putting on a jacket.', 'woman', 'act', 'puton', ['jacket'], 'She', 'is putting on', ['a jacket'], '여자가 재킷을 입는 중이에요.'),
        S1('A man is opening a door.', 'man', 'act', 'open', ['door'], 'A man', 'is opening', ['a door'], '남자가 문을 열고 있어요.'),
        S1('She is holding an umbrella.', 'woman', 'state', 'hold', ['umbrella'], 'She', 'is holding', ['an umbrella'], '여자가 우산을 들고 있어요.'),
        S1('She is wearing a jacket.', 'woman', 'state', 'wear', ['jacket'], 'She', 'is wearing', ['a jacket'], '여자가 재킷을 입고 있어요.'),
      ] },
    { photo: 'chairsEmpty', sp: 'au', a: 1, type: 68, tag: 'Part 1 · being p.p.와 has been p.p.',
      opts: [
        S1('Some chairs are being stacked.', 'chairs', 'beingpp', 'stack', [], 'Some chairs', 'are being stacked', [], '(누군가가) 의자를 쌓고 있어요.'),
        S1('Some chairs have been stacked against the wall.', 'chairs', 'haspp', 'stack', ['wall'], 'Some chairs', 'have been stacked', ['the wall'], '의자들이 벽에 붙여 쌓여 있어요.'),
        S1('A man is arranging some chairs.', 'man', 'act', 'arrange', ['chairs'], 'A man', 'is arranging', ['some chairs'], '남자가 의자를 정리하고 있어요.'),
        S1('Some chairs have been stacked near a piano.', 'chairs', 'haspp', 'stack', ['piano'], 'Some chairs', 'have been stacked', ['a piano'], '의자들이 피아노 가까이에 쌓여 있어요.'),
      ] },
    { photo: 'shelfReach', sp: 'ca', a: 0, type: 67, tag: 'Part 1 · 동작과 상태',
      opts: [
        S1('She is reaching for a box.', 'woman', 'act', 'reach', ['boxes'], 'She', 'is reaching', ['a box'], '여자가 상자 쪽으로 손을 뻗고 있어요.'),
        S1('Some boxes are being opened.', 'boxes', 'beingpp', 'open', [], 'Some boxes', 'are being opened', [], '(누군가가) 상자를 열고 있어요.'),
        S1('Some workers are moving a shelf.', 'workers', 'act', 'move', ['shelf'], 'Some workers', 'are moving', ['a shelf'], '작업자 몇 명이 선반을 옮기고 있어요.'),
        S1('She is standing on a ladder.', 'woman', 'state', 'stand', ['ladder'], 'She', 'is standing', ['a ladder'], '여자가 사다리 위에 서 있어요.'),
      ] },
    { photo: 'desk', sp: 'us', a: 2, type: 67, tag: 'Part 1 · 동작과 상태',
      opts: [
        S1('Some people are waiting in line.', 'people', 'act', 'wait', ['line'], 'Some people', 'are waiting', ['in line'], '몇 사람이 줄을 서서 기다리고 있어요.'),
        S1('She is putting on her glasses.', 'woman', 'act', 'puton', ['glasses'], 'She', 'is putting on', ['her glasses'], '여자가 안경을 쓰는 중이에요.'),
        S1('She is typing on a keyboard.', 'woman', 'act', 'type', ['keyboard'], 'She', 'is typing', ['a keyboard'], '여자가 키보드를 치고 있어요.'),
        S1('She is sitting next to a lamp.', 'woman', 'state', 'sit', ['lamp'], 'She', 'is sitting', ['a lamp'], '여자가 램프 옆에 앉아 있어요.'),
      ] },
    { photo: 'boxesEmpty', sp: 'gb', a: 3, type: 68, tag: 'Part 1 · 사물의 상태와 위치',
      opts: [
        S1('Some boxes are being carried.', 'boxes', 'beingpp', 'carry', [], 'Some boxes', 'are being carried', [], '(누군가가) 상자를 나르고 있어요.'),
        S1('A worker is lining up some boxes.', 'worker', 'act', 'line', ['boxes'], 'A worker', 'is lining up', ['some boxes'], '작업자가 상자를 줄지어 놓고 있어요.'),
        S1('Some boxes have been placed on a table.', 'boxes', 'haspp', 'place', ['table'], 'Some boxes', 'have been placed', ['a table'], '상자들이 탁자 위에 놓여 있어요.'),
        S1('Some boxes have been lined up along the wall.', 'boxes', 'haspp', 'line', ['wall'], 'Some boxes', 'have been lined up', ['the wall'], '상자들이 벽을 따라 줄지어 놓여 있어요.'),
      ] },
  ];
  LP.P1.forEach(it => { it.part = 1; });

  // Part 2 대답: { t, kind, ko, cue: 종류가 드러나는 글, same/sound: [질문 쪽, 대답 쪽], yn, fact, factKo, off, note }
  const R = (t, kind, ko, o = {}) => Object.assign({ t, kind, ko }, o);
  LP.P2 = [
    { q: 'Where is the new copy machine?', pt: 'wh', wh: 'where', first: 'Where', sp: ['gb', 'us'], a: 0, type: 70, tag: 'Part 2 · 의문사 · 비슷한 소리', qko: '새 복사기는 어디에 있어요?',
      opts: [
        R('On the third floor, next to the elevators.', 'place', '3층 엘리베이터 옆에 있어요.', { cue: 'On the third floor', note: '장소를 말했어요.' }),
        R('Two coffees, please.', 'thing', '커피 두 잔 주세요.', { sound: ['copy', 'coffees'], cue: 'Two coffees' }),
        R('Since last Monday.', 'time', '지난 월요일부터요.', { cue: 'Since last Monday' }),
      ] },
    { q: 'When will the new printer be delivered?', pt: 'wh', wh: 'when', first: 'When', sp: ['us', 'au'], a: 1, type: 72, tag: 'Part 2 · 간접 응답', qko: '새 프린터는 언제 배달돼요?',
      opts: [
        R('It prints in color.', 'fact', '컬러로 인쇄돼요.', { same: ['printer', 'prints'], cue: 'in color' }),
        R('Didn\'t you read the e-mail from the supplier?', 'ask', '공급 업체에서 온 이메일 못 읽으셨어요?', { cue: 'Didn\'t you read the e-mail', note: '배달 날짜가 이메일에 있다는 뜻이에요. 때를 말하지 않아도 대화가 이어져요.' }),
        R('To the second floor.', 'place', '2층으로요.', { cue: 'To the second floor' }),
      ] },
    { q: 'Who is leading tomorrow\'s training session?', pt: 'wh', wh: 'who', first: 'Who', sp: ['au', 'gb'], a: 0, type: 72, tag: 'Part 2 · 간접 응답', qko: '내일 교육은 누가 맡아요?',
      opts: [
        R('It hasn\'t been decided yet.', 'news', '아직 정해지지 않았어요.', { cue: 'hasn\'t been decided', note: '아직 정해지지 않았다는 상황을 알렸어요. 사람 이름이 없어도 정답이에요.' }),
        R('A two-hour session.', 'length', '두 시간짜리 교육이에요.', { same: ['session', 'session'], cue: 'two-hour' }),
        R('Yes, at nine o\'clock.', 'yes', '네, 9시에요.', { cue: 'Yes' }),
      ] },
    { q: 'How much does it cost to rent the hall?', pt: 'wh', wh: 'howmuch', first: 'How much', sp: ['ca', 'us'], a: 1, type: 73, tag: 'Part 2 · 넘기기', qko: '강당을 빌리는 데 얼마예요?',
      opts: [
        R('About fifty guests.', 'number', '손님 쉰 명쯤이요.', { cue: 'fifty guests' }),
        R('Ms. Lee handles the reservations.', 'refer', '예약은 이 씨가 맡고 있어요.', { cue: 'Ms. Lee handles', note: '값을 아는 사람에게 넘겼어요.' }),
        R('It\'s down the hall.', 'place', '복도 끝에 있어요.', { same: ['hall', 'hall'], cue: 'down the hall' }),
      ] },
    { q: 'The elevator is out of order again.', pt: 'stmt', first: 'The elevator is', sp: ['gb', 'ca'], a: 2, type: 74, tag: 'Part 2 · 평서문', qko: '엘리베이터가 또 고장 났어요.',
      opts: [
        R('In alphabetical order.', 'fact', '알파벳 순서로요.', { same: ['order', 'order'], cue: 'alphabetical' }),
        R('Yes, he did.', 'yes', '네, 그가 했어요.', { cue: 'he did', off: 'he가 가리키는 사람이 없어요. did도 ‘고장 났다’는 소식과 이어지지 않아요. 앞뒤가 안 맞아요.' }),
        R('Let\'s take the stairs, then.', 'react', '그럼 계단으로 가요.', { cue: 'take the stairs', note: '고장 소식에 해결책을 냈어요.' }),
      ] },
    { q: 'Why don\'t we order lunch for the team?', pt: 'sugg', first: 'Why don\'t we', sp: ['us', 'gb'], a: 0, type: 75, tag: 'Part 2 · 제안', qko: '팀 점심을 주문하는 게 어때요?',
      opts: [
        R('That\'s a great idea.', 'accept', '좋은 생각이에요.', { cue: 'great idea', note: '제안을 받아들였어요.' }),
        R('Because I was busy.', 'reason', '바빴거든요.', { cue: 'Because' }),
        R('The launch is on Friday.', 'time', '출시는 금요일이에요.', { sound: ['lunch', 'launch'], cue: 'on Friday' }),
      ] },
    { q: 'Would you mind reviewing my report before noon?', pt: 'req', first: 'Would you mind', sp: ['au', 'us'], a: 2, type: 75, tag: 'Part 2 · 요청', qko: '정오 전에 제 보고서를 검토해 주실 수 있어요?',
      opts: [
        R('A five-page report.', 'thing', '다섯 쪽짜리 보고서예요.', { same: ['report', 'report'], cue: 'five-page' }),
        R('Yes, it was very helpful.', 'yes', '네, 아주 도움이 됐어요.', { cue: 'it was very helpful', off: '아직 검토하기 전인데 was helpful은 이미 읽은 뒤의 말이에요. 또 Would you mind에 Yes는 ‘꺼려요’라는 뜻이라 앞뒤가 안 맞아요.' }),
        R('Not at all. Just send it to me.', 'accept', '그럼요(전혀 안 꺼려요). 저한테 보내 주세요.', { cue: 'Not at all', note: 'mind = 꺼리다. Not at all → 전혀 안 꺼려요 = 해 줄게요.' }),
      ] },
    { q: 'Would you prefer a window seat or an aisle seat?', pt: 'choice', first: 'or', sp: ['ca', 'au'], a: 1, type: 76, tag: 'Part 2 · 선택 의문문', qko: '창가 자리가 좋으세요, 통로 자리가 좋으세요?',
      opts: [
        R('Yes, I would.', 'yes', '네, 그래요.', { cue: 'Yes' }),
        R('Either is fine with me.', 'either', '어느 쪽이든 괜찮아요.', { cue: 'Either', note: '둘 다 좋다고 답했어요.' }),
        R('The window was left open.', 'fact', '창문이 열려 있었어요.', { same: ['window', 'window'], cue: 'left open' }),
      ] },
    { q: 'Didn\'t you send the invoice to Mr. Cho?', pt: 'neg', first: 'Didn\'t you', sp: ['us', 'gb'], a: 1, type: 77, tag: 'Part 2 · 부정 의문문', qko: '조 씨에게 청구서 안 보냈어요?',
      opts: [
        R('No, I sent it this morning.', 'no', '(앞뒤가 안 맞는 말) 아니요, 오늘 아침에 보냈어요.', { yn: 'no', fact: true, factKo: '보냈어요', cue: 'No' }),
        R('Yes, I e-mailed it yesterday.', 'yes', '보냈어요. 어제 이메일로요. (한국어라면 ‘아니요, 보냈어요’)', { yn: 'yes', fact: true, factKo: '어제 이메일로 보냈어요', cue: 'Yes' }),
        R('An invoice number.', 'thing', '청구서 번호요.', { same: ['invoice', 'invoice'], cue: 'number' }),
      ] },
    { q: 'You\'ve met our new director, haven\'t you?', pt: 'tag', first: 'haven\'t you', sp: ['gb', 'au'], a: 2, type: 77, tag: 'Part 2 · 꼬리 질문', qko: '새 이사님 만나 보셨죠?',
      opts: [
        R('A new direction.', 'thing', '새로운 방향이요.', { sound: ['director', 'direction'], cue: 'direction' }),
        R('No, I met her last week.', 'no', '(앞뒤가 안 맞는 말) 아니요, 지난주에 만났어요.', { yn: 'no', fact: true, factKo: '지난주에 만났어요', cue: 'No' }),
        R('Yes, at the conference last month.', 'yes', '네, 지난달 학회에서요.', { yn: 'yes', fact: true, factKo: '지난달 학회에서 만났어요', cue: 'Yes' }),
      ] },
  ];
  LP.P2.forEach(it => { it.part = 2; });
  LP.DRILL = LP.P1.concat(LP.P2);

  /* =========================================================
     영상 · 직접 해 보기에 쓰는 예 (연습 문제와 겹치지 않게)
     ========================================================= */
  LP.EX = {
    // 01장: 주인공 (상자 나르는 남자) · 입는 중 / 입은 상태
    boss: [
      S1('A man is carrying a box.', 'man', 'act', 'carry', ['boxes'], 'A man', 'is carrying', ['a box'], '남자가 상자를 나르고 있어요.'),
      S1('Some women are stacking boxes.', 'women', 'act', 'stack', ['boxes'], 'Some women', 'are stacking', ['boxes'], '여자 몇 명이 상자를 쌓고 있어요.'),
    ],
    jacket: [
      S1('She is putting on a jacket.', 'woman', 'act', 'puton', ['jacket'], 'She', 'is putting on', ['a jacket'], '여자가 재킷을 입는 중이에요.'),
      S1('She is wearing a jacket.', 'woman', 'state', 'wear', ['jacket'], 'She', 'is wearing', ['a jacket'], '여자가 재킷을 입고 있어요.'),
    ],
    // 02장: 쌓여 있다 / 쌓이고 있다
    chairs: [
      S1('Some chairs have been stacked.', 'chairs', 'haspp', 'stack', [], 'Some chairs', 'have been stacked', [], '의자들이 쌓여 있어요.'),
      S1('Some chairs are being stacked.', 'chairs', 'beingpp', 'stack', [], 'Some chairs', 'are being stacked', [], '(누군가가) 의자를 쌓고 있어요.'),
    ],
    // 03장: 복사기 앞 남자
    copier: [
      S1('He is making some copies.', 'man', 'act', 'make', ['copies'], 'He', 'is making', ['some copies'], '남자가 복사를 하고 있어요.'),
      S1('He is making some coffee.', 'man', 'act', 'make', ['coffee'], 'He', 'is making', ['some coffee'], '남자가 커피를 만들고 있어요.', ['copies', 'coffee']),
      S1('He is standing near a lamp.', 'man', 'state', 'stand', ['lamp'], 'He', 'is standing', ['a lamp'], '남자가 램프 가까이에 서 있어요.'),
    ],
    // 04장: 첫 단어
    lounge: { q: 'Where is the staff lounge?', pt: 'wh', wh: 'where', first: 'Where', sp: ['us', 'gb'], qko: '직원 휴게실은 어디예요?', a: 0,
      opts: [R('On the third floor.', 'place', '3층에 있어요.', { cue: 'third floor' }), R('Since last Monday.', 'time', '지난 월요일부터요.', { cue: 'Since' }), R('Yes, it\'s very nice.', 'yes', '네, 아주 좋아요.', { cue: 'Yes' })] },
    // 05장: 같은 단어 · 비슷한 소리
    sales: { q: 'Have you finished the sales report?', pt: 'yn', first: 'Have you', sp: ['gb', 'us'], qko: '매출 보고서 다 쓰셨어요?', a: 1,
      opts: [R('The sales team is on the third floor.', 'fact', '영업팀은 3층에 있어요.', { same: ['sales', 'sales'] }), R('Yes, I sent it this morning.', 'yes', '네, 오늘 아침에 보냈어요.', { yn: 'yes', fact: true, factKo: '오늘 아침에 보냈어요' })] },
    contract: { q: 'Did you sign the contract?', pt: 'yn', first: 'Did you', sp: ['au', 'ca'], qko: '계약서에 서명하셨어요?', a: 1,
      opts: [R('Here\'s my contact information.', 'fact', '제 연락처예요.', { sound: ['contract', 'contact'] }), R('Yes, I signed it this morning.', 'yes', '네, 오늘 아침에 서명했어요.', { yn: 'yes', fact: true, factKo: '오늘 아침에 서명했어요' })] },
    // 06장: 돌려 말하는 정답 (모두 맞는 대답)
    budget: { q: 'When is the budget meeting?', pt: 'wh', wh: 'when', first: 'When', sp: ['ca', 'gb'], qko: '예산 회의는 언제예요?',
      opts: [
        R('At three o\'clock.', 'time', '3시에요.'),
        R('Didn\'t you get the e-mail?', 'ask', '이메일 못 받으셨어요?', { note: '시간이 이메일에 있다는 뜻이에요.' }),
        R('I\'m not sure.', 'unknown', '잘 모르겠어요.', { note: '모른다고 솔직하게 답했어요.' }),
        R('Ask Ms. Lee.', 'refer', '이 씨에게 물어보세요.', { note: '아는 사람에게 넘겼어요.' }),
        R('Which meeting do you mean?', 'ask', '어느 회의 말씀이세요?', { note: '되물었어요.' }),
        R('Let me check.', 'check', '확인해 볼게요.', { note: '확인해 보겠다고 했어요.' }),
        R('It\'s been postponed.', 'news', '미뤄졌어요.', { note: '상황을 알렸어요.' }),
      ] },
    // 07장: 평서문 · 제안 · 선택
    jam: { q: 'The printer is jammed again.', pt: 'stmt', first: 'The printer is', sp: ['us', 'au'], qko: '프린터에 또 종이가 걸렸어요.', a: 0,
      opts: [R('I\'ll call the technician.', 'react', '기술자를 부를게요.', { note: '해결책을 냈어요.' }), R('Print it in color.', 'fact', '컬러로 인쇄하세요.', { same: ['printer', 'Print'] })] },
    brk: { q: 'Why don\'t we take a short break?', pt: 'sugg', first: 'Why don\'t we', sp: ['gb', 'ca'], qko: '잠깐 쉬는 게 어때요?', a: 0,
      opts: [R('That\'s a good idea.', 'accept', '좋은 생각이에요.', { note: '제안을 받아들였어요.' }), R('Because I\'m tired.', 'reason', '피곤하거든요.')] },
    tea: { q: 'Would you like tea or coffee?', pt: 'choice', first: 'or', sp: ['au', 'us'], qko: '차 드릴까요, 커피 드릴까요?', a: 0,
      opts: [R('Either is fine.', 'either', '아무거나 괜찮아요.', { note: '둘 다 좋다고 했어요.' }), R('Just water, please.', 'other', '그냥 물 주세요.', { note: '둘 다 아닌 다른 것을 골랐어요.' }), R('Yes, I would.', 'yes', '네, 그래요.')] },
    // 08장: 부정 · 꼬리 질문
    client: { q: 'Didn\'t you call the client?', pt: 'neg', first: 'Didn\'t you', sp: ['ca', 'gb'], qko: '고객에게 전화 안 했어요?',
      opts: [
        R('Yes, I called her this morning.', 'yes', '전화했어요. 오늘 아침에요.', { yn: 'yes', fact: true, factKo: '오늘 아침에 전화했어요' }),
        R('No, not yet.', 'no', '안 했어요. 아직이요.', { yn: 'no', fact: false, factKo: '아직 안 했어요' }),
        R('No, I called her this morning.', 'no', '(앞뒤가 안 맞는 말)', { yn: 'no', fact: true, factKo: '오늘 아침에 전화했어요' }),
        R('Yes, I haven\'t called her.', 'yes', '(앞뒤가 안 맞는 말)', { yn: 'yes', fact: false, factKo: '전화 안 했어요' }),
      ] },
    dinner: { q: 'You\'re coming to the dinner, aren\'t you?', pt: 'tag', first: 'aren\'t you', sp: ['us', 'au'], qko: '저녁 모임에 오시죠?', a: 0,
      opts: [R('Yes, I\'ll be there at seven.', 'yes', '네, 7시에 갈게요.', { yn: 'yes', fact: true, factKo: '7시에 갈게요' })] },
  };
  // 04장 직접 해 보기: 첫 단어를 바꾸면 맞는 대답이 바뀜 (대답 여섯은 같음)
  LP.WHSET = {
    answers: [
      R('In Room 5.', 'place', '5번 방에서요.'),
      R('At nine o\'clock.', 'time', '9시에요.'),
      R('Ms. Park from Human Resources.', 'person', '인사팀 박 씨요.'),
      R('Because the trainer is sick.', 'reason', '강사가 아파서요.'),
      R('About two hours.', 'length', '두 시간쯤이요.'),
      R('Yes, for all new staff.', 'yes', '네, 신입 직원 모두요.', { yn: 'yes', fact: true, factKo: '신입 직원 모두 받아야 해요' }),
    ],
    qs: [
      { q: 'Where is the training held?', pt: 'wh', wh: 'where', first: 'Where', qko: '교육은 어디서 해요?' },
      { q: 'When does the training start?', pt: 'wh', wh: 'when', first: 'When', qko: '교육은 언제 시작해요?' },
      { q: 'Who is leading the training?', pt: 'wh', wh: 'who', first: 'Who', qko: '교육은 누가 맡아요?' },
      { q: 'Why was the training canceled?', pt: 'wh', wh: 'why', first: 'Why', qko: '교육이 왜 취소됐어요?' },
      { q: 'How long will the training last?', pt: 'wh', wh: 'howlong', first: 'How long', qko: '교육은 얼마나 걸려요?' },
      { q: 'Is the training mandatory?', pt: 'yn', first: 'Is', qko: '교육은 꼭 받아야 해요?' },
    ],
  };
  LP.WHSET.qs.forEach(x => { x.sp = ['gb', 'us']; x.opts = LP.WHSET.answers; });
  // 09장 3단계 판정기: 첫 단어를 고르면 기대하는 답의 종류
  LP.FIRSTS = [
    { id: 'where', label: 'Where …?', it: { pt: 'wh', wh: 'where', first: 'Where' } },
    { id: 'when', label: 'When …?', it: { pt: 'wh', wh: 'when', first: 'When' } },
    { id: 'who', label: 'Who …?', it: { pt: 'wh', wh: 'who', first: 'Who' } },
    { id: 'why', label: 'Why …?', it: { pt: 'wh', wh: 'why', first: 'Why' } },
    { id: 'how', label: 'How …?', it: { pt: 'wh', wh: 'how', first: 'How' } },
    { id: 'yn', label: 'Do you …?', it: { pt: 'yn', first: 'Do you' } },
    { id: 'neg', label: 'Didn\'t you …?', it: { pt: 'neg', first: 'Didn\'t you' } },
    { id: 'sugg', label: 'Why don\'t we …?', it: { pt: 'sugg', first: 'Why don\'t we' } },
    { id: 'req', label: 'Would you mind …?', it: { pt: 'req', first: 'Would you mind' } },
    { id: 'choice', label: 'A or B?', it: { pt: 'choice', first: 'or' } },
    { id: 'stmt', label: '평서문', it: { pt: 'stmt', first: '평서문' } },
  ];

  /* ---------- 직접 해 보기: O/X 목록 (여러 개가 맞을 수 있음) ---------- */
  // Part 1: [사진, 문장]   Part 2: [문제, 대답 번호]
  LP.LAB = {
    jacket: LP.EX.jacket,
    chairs: LP.EX.chairs,
    copier: LP.EX.copier.concat([
      S1('He is using a machine.', 'man', 'act', 'use', ['machine'], 'He', 'is using', ['a machine'], '남자가 기계를 쓰고 있어요.'),
      S1('He is walking out of an office.', 'man', 'act', 'walk', ['office'], 'He', 'is walking', ['an office'], '남자가 사무실 밖으로 걸어 나가고 있어요.'),
    ]),
  };
  // Part 2 O/X 목록 (06 · 08장): 여러 개가 맞을 수 있어요
  LP.LAB.budget = Object.assign({}, LP.EX.budget, { opts: LP.EX.budget.opts.concat([
    R('In the meeting room.', 'place', '회의실에서요.'),
    R('Yes, it is.', 'yes', '네, 그래요.'),
    R('A budget report.', 'thing', '예산 보고서요.', { same: ['budget', 'budget'] }),
  ]) });
  LP.LAB.budgetWant = [true, true, true, true, true, true, true, false, false, false];
  LP.LAB.client = LP.EX.client;
  LP.LAB.clientWant = [true, true, false, false];
  // 비슷한 소리 짝 (03 · 05장 직접 해 보기)
  LP.SOUNDS = [['copy', 'coffee'], ['contract', 'contact'], ['walk', 'work'], ['lunch', 'launch'], ['file', 'pile'], ['director', 'direction']];

  /* ---------- 직접 해 보기의 짧은 듣기 문제 ---------- */
  LP.MINI = {
    first: { q: 'How long is the flight to Singapore?', pt: 'wh', wh: 'howlong', first: 'How long', sp: ['ca', 'us'], a: 2, qko: '싱가포르까지 비행 시간은 얼마나 돼요?',
      opts: [R('Gate 12, I think.', 'place', '12번 게이트 같아요.', { cue: 'Gate 12' }), R('Yes, a window seat.', 'yes', '네, 창가 자리요.', { cue: 'Yes' }), R('About six hours.', 'length', '여섯 시간쯤이요.', { cue: 'six hours', note: '걸리는 시간을 말했어요.' })] },
    trap: { q: 'Have you reviewed the budget proposal?', pt: 'yn', first: 'Have you', sp: ['au', 'gb'], a: 1, qko: '예산안 검토하셨어요?',
      opts: [R('The budget hotel near the station.', 'fact', '역 근처 저렴한 호텔이요.', { same: ['budget', 'budget'], cue: 'hotel' }), R('I\'m still working on it.', 'news', '아직 보고 있어요.', { note: '아직 끝나지 않았다는 상황을 알렸어요.' }), R('A new review policy.', 'thing', '새 검토 규정이요.', { same: ['reviewed', 'review'], cue: 'policy' })] },
    stmt: { q: 'I can\'t find my company ID card.', pt: 'stmt', first: 'I can\'t find', sp: ['gb', 'us'], a: 0, qko: '회사 신분증을 못 찾겠어요.',
      opts: [R('Did you check your desk drawer?', 'react', '책상 서랍은 찾아봤어요?', { note: '찾을 곳을 알려 주는 해결책이에요.' }), R('The car park is full.', 'fact', '주차장이 꽉 찼어요.', { sound: ['card', 'car'] }), R('Yes, I found it.', 'yes', '네, 찾았어요.', { off: '못 찾겠다는 말에 ‘찾았어요’는 앞뒤가 안 맞아요.' })] },
  };

  /* =========================================================
     놀이터 ① 함정 감별사: Part 2 열 세트 (정답은 하나씩)
     ========================================================= */
  LP.GAME = [
    { q: 'When does the job fair start?', pt: 'wh', wh: 'when', first: 'When', sp: ['us', 'gb'], qko: '취업 박람회는 언제 시작해요?',
      opts: [R('At the convention center.', 'place', '컨벤션 센터에서요.'), R('At ten o\'clock tomorrow.', 'time', '내일 10시에요.'), R('It was a fair decision.', 'fact', '공정한 결정이었어요.', { same: ['fair', 'fair'] })] },
    { q: 'Who ordered these office supplies?', pt: 'wh', wh: 'who', first: 'Who', sp: ['gb', 'au'], qko: '이 사무용품 누가 주문했어요?',
      opts: [R('I think Mr. Ryu did.', 'person', '류 씨 같아요.'), R('In the supply closet.', 'place', '비품 창고에요.', { same: ['supplies', 'supply'] }), R('Yes, by Friday.', 'yes', '네, 금요일까지요.')] },
    { q: 'Why is the parking lot closed today?', pt: 'wh', wh: 'why', first: 'Why', sp: ['au', 'us'], qko: '오늘 주차장이 왜 닫혔어요?',
      opts: [R('Close to the main entrance.', 'place', '정문 가까이요.', { sound: ['closed', 'Close'] }), R('It\'s being repaved.', 'reason', '다시 포장하는 중이에요.', { note: 'Because 없이도 까닭을 말할 수 있어요.' }), R('For about two hours.', 'length', '두 시간쯤이요.')] },
    { q: 'Is the new software easy to use?', pt: 'yn', first: 'Is', sp: ['ca', 'gb'], qko: '새 프로그램은 쓰기 쉬워요?',
      opts: [R('No, it\'s very easy.', 'no', '(앞뒤가 안 맞는 말) 아니요, 아주 쉬워요.', { yn: 'no', fact: true, factKo: '아주 쉬워요' }), R('I usually take the bus.', 'fact', '저는 보통 버스를 타요.', { sound: ['use', 'usually'] }), R('Yes, once you get used to it.', 'yes', '네, 익숙해지면요.', { yn: 'yes', fact: true, factKo: '익숙해지면 쉬워요' })] },
    { q: 'Isn\'t the store open on Sundays?', pt: 'neg', first: 'Isn\'t', sp: ['us', 'ca'], qko: '그 가게 일요일에 안 열어요?',
      opts: [R('No, only on weekdays.', 'no', '안 열어요. 평일에만요.', { yn: 'no', fact: false, factKo: '평일에만 열어요' }), R('Yes, it\'s closed on Sundays.', 'yes', '(앞뒤가 안 맞는 말) 네, 일요일엔 닫아요.', { yn: 'yes', fact: false, factKo: '일요일엔 닫아요' }), R('Open the box carefully.', 'fact', '상자를 조심해서 여세요.', { same: ['open', 'Open'] })] },
    { q: 'Why don\'t you take the afternoon off?', pt: 'sugg', first: 'Why don\'t you', sp: ['gb', 'us'], qko: '오후에 쉬는 게 어때요?',
      opts: [R('Because the office is far.', 'reason', '사무실이 멀거든요.'), R('Take it off the shelf.', 'fact', '선반에서 내리세요.', { same: ['take', 'Take'] }), R('Thanks, I think I will.', 'accept', '고마워요, 그럴게요.')] },
    { q: 'Should we meet on Tuesday or Wednesday?', pt: 'choice', first: 'or', sp: ['au', 'gb'], qko: '화요일에 만날까요, 수요일에 만날까요?',
      opts: [R('How about Thursday instead?', 'other', '차라리 목요일은 어때요?', { note: '둘 다 아닌 다른 날을 냈어요.' }), R('Yes, we should.', 'yes', '네, 그래야죠.'), R('We met last week.', 'fact', '지난주에 만났어요.', { same: ['meet', 'met'] })] },
    { q: 'I can\'t find my company ID card.', pt: 'stmt', first: 'I can\'t find', sp: ['ca', 'au'], qko: '회사 신분증을 못 찾겠어요.',
      opts: [R('The car park is full.', 'fact', '주차장이 꽉 찼어요.', { sound: ['card', 'car'] }), R('Yes, I found it.', 'yes', '네, 찾았어요.', { off: '못 찾겠다는 말에 ‘찾았어요’는 앞뒤가 안 맞아요.' }), R('Did you check your desk drawer?', 'react', '책상 서랍은 찾아봤어요?')] },
    { q: 'Where should I put these boxes?', pt: 'wh', wh: 'where', first: 'Where', sp: ['us', 'au'], qko: '이 상자들 어디에 둘까요?',
      opts: [R('By tomorrow morning.', 'time', '내일 아침까지요.'), R('Ask Ms. Ortiz in the mail room.', 'refer', '우편실 오티즈 씨에게 물어보세요.', { note: '아는 사람에게 넘겼어요.' }), R('I\'ll put on my coat.', 'fact', '코트를 입을게요.', { same: ['put', 'put on'] })] },
    { q: 'How did you get to the airport?', pt: 'wh', wh: 'how', first: 'How', sp: ['gb', 'ca'], qko: '공항에 어떻게 가셨어요?',
      opts: [R('It\'s the main airport.', 'fact', '거기가 큰 공항이에요.', { same: ['airport', 'airport'] }), R('Yes, it was crowded.', 'yes', '네, 붐볐어요.'), R('I took a taxi.', 'way', '택시를 탔어요.')] },
  ];
  LP.GAME.forEach(g => { g.a = g.opts.findIndex((_, k) => LP.judge2(g, k).s === 'ok'); });

  /* ---------- 놀이터 ② 사진 속 동작 · 상태 고르기: 장면마다 두 순간 ---------- */
  LP.SCENES = [
    { id: 'jacket', name: '재킷', moments: [['jacketOn', '입는 중'], ['jacketWear', '다 입은 뒤']],
      sts: [LP.EX.jacket[0], LP.EX.jacket[1],
        S1('She is hanging a jacket on a hook.', 'woman', 'act', 'hang', ['jacket', 'hook'], 'She', 'is hanging', ['a jacket', 'a hook'], '여자가 재킷을 옷걸이에 걸고 있어요.'),
        S1('A man is holding a bag.', 'man', 'state', 'hold', ['bag'], 'A man', 'is holding', ['a bag'], '남자가 가방을 들고 있어요.')] },
    { id: 'chairs', name: '의자', moments: [['chairsMan', '쌓는 중'], ['chairsEmpty', '다 쌓은 뒤']],
      sts: [S1('A man is stacking some chairs.', 'man', 'act', 'stack', ['chairs'], 'A man', 'is stacking', ['some chairs'], '남자가 의자를 쌓고 있어요.'),
        LP.EX.chairs[1],
        S1('Some chairs have been stacked.', 'chairs', 'haspp', 'stack', [], 'Some chairs', 'have been stacked', [], '의자들이 쌓여 있어요.'),
        S1('A man is sitting on a chair.', 'man', 'state', 'sit', ['chairs'], 'A man', 'is sitting', ['a chair'], '남자가 의자에 앉아 있어요.')] },
    { id: 'boxes', name: '상자', moments: [['boxesMan', '나르는 중'], ['boxesEmpty', '다 놓은 뒤']],
      sts: [S1('A man is carrying a box.', 'man', 'act', 'carry', ['boxes'], 'A man', 'is carrying', ['a box'], '남자가 상자를 나르고 있어요.'),
        S1('A box is being carried.', 'boxes', 'beingpp', 'carry', [], 'A box', 'is being carried', [], '(누군가가) 상자를 나르고 있어요.'),
        S1('Some boxes have been lined up.', 'boxes', 'haspp', 'line', [], 'Some boxes', 'have been lined up', [], '상자들이 줄지어 놓여 있어요.'),
        S1('A man is opening a box.', 'man', 'act', 'open', ['boxes'], 'A man', 'is opening', ['a box'], '남자가 상자를 열고 있어요.')] },
    { id: 'plants', name: '화분', moments: [['plantsMan', '물 주는 중'], ['plantsEmpty', '사람이 간 뒤']],
      sts: [S1('A man is watering some plants.', 'man', 'act', 'water', ['plants'], 'A man', 'is watering', ['some plants'], '남자가 화분에 물을 주고 있어요.'),
        S1('Some plants are being watered.', 'plants', 'beingpp', 'water', [], 'Some plants', 'are being watered', [], '(누군가가) 화분에 물을 주고 있어요.'),
        S1('Some plants have been placed by a window.', 'plants', 'haspp', 'place', ['window'], 'Some plants', 'have been placed', ['a window'], '화분들이 창가에 놓여 있어요.'),
        S1('A man is planting a tree.', 'man', 'act', 'plant', ['trees'], 'A man', 'is planting', ['a tree'], '남자가 나무를 심고 있어요.')] },
  ];

  /* =========================================================
     3단계 풀이 (연습 문제 힌트) — 판정 결과로 만듦
     marks: { t: 글, role, at: 'q' | 보기 번호 }   role: who 주인공 · act 동작 · state 상태 · obj 물건 · key 첫 단어 · cue 종류 · trap 함정 · ok 정답
     ========================================================= */
  LP.judgeOpt = (it, k) => it.part === 1 ? LP.judge1(it.opts[k], it.photo) : LP.judge2(it, k);
  const nm = (it, k) => `(${L4[k]})`;
  const dropped = (it, step) => it.opts.map((_, k) => k).filter(k => LP.judgeOpt(it, k).step === step);
  LP.steps = function (it) {
    const right = `(${L4[it.a]})`;
    if (it.part === 1) {
      const P = LP.PHOTO[it.photo];
      const d1 = dropped(it, 1), d2 = dropped(it, 2), d3 = dropped(it, 3);
      const t1 = `사진의 주인공 → ${P.people.length ? peopleKo(P) + '(사람)' : '사물 (사람이 없어요)'}.` + (d1.length ? ' ' + d1.map(k => `${nm(it, k)} ${it.opts[k].subjT} → 사진에 없는 주어`).join(' · ') + '. 탈락.' : ' 주어는 모두 사진에 있어요.');
      const t2 = `사진: ${P.now}.` + (d2.length ? ' ' + d2.map(k => `${nm(it, k)} ${it.opts[k].vT} → ${LP.FORM[it.opts[k].form].ko}`).join(' · ') + ' → 사진과 달라 탈락.' : '');
      const t3 = (d3.length ? d3.map(k => { const o = it.opts[k], miss = o.obj.find(x => !P.people.concat(P.things).includes(x)); return `${nm(it, k)} ${o.objT[o.obj.indexOf(miss)]} → 사진에 없어요`; }).join(' · ') + '. 탈락.' : '물건은 모두 사진에 있어요.') + ` 정답 ${right} ${it.opts[it.a].t}`;
      const m1 = it.opts.map((o, k) => ({ t: o.subjT, role: d1.includes(k) ? 'trap' : 'who', at: k }));
      const m2 = it.opts.map((o, k) => ({ t: o.vT, role: d2.includes(k) ? 'trap' : LP.FORM[o.form].role, at: k }));
      const m3 = [];
      it.opts.forEach((o, k) => (o.objT || []).forEach((t, i) => m3.push({ t, role: P.people.concat(P.things).includes(o.obj[i]) ? 'obj' : 'trap', at: k })));
      m3.push({ t: it.opts[it.a].t, role: 'ok', at: it.a, whole: true });
      return [
        { head: '① 사진의 주인공을 봐요.', text: t1, marks: m1 },
        { head: '② 동작인가 상태인가?', text: t2, marks: m2 },
        { head: '③ 사진에 없는 말을 지워요.', text: t3, marks: m3 },
      ];
    }
    const d2 = dropped(it, 2), d3 = dropped(it, 3);
    const t1 = LP.firstKo(it) + ' ' + LP.wantKo(it);
    const t2 = d2.length ? d2.map(k => { const j = LP.judge2(it, k), m = LP.mainTag(j), o = it.opts[k]; return `${nm(it, k)} ${m === 'same' ? (o.same[0].toLowerCase() === o.same[1].toLowerCase() ? o.same[1] + ' 되풀이' : o.same[0] + ' → ' + o.same[1]) + ' → 같은 단어' : m === 'sound' ? o.sound[0] + ' ↔ ' + o.sound[1] + ' 비슷한 소리' : LP.KIND[o.kind] + ' → 엉뚱한 종류'}`; }).join(' · ') + '. 탈락.' : '종류가 다르거나 소리로 끌어들이는 보기는 없어요.';
    const t3 = (d3.length ? d3.map(k => `${nm(it, k)} ${it.opts[k].yn && it.opts[k].fact != null ? 'Yes · No 대답과 뒷말이 안 맞아요' : '앞뒤가 안 맞아요'}`).join(' · ') + '. 탈락. ' : '') + `정답 ${right} → ` + LP.judge2(it, it.a).why;
    const m1 = [{ t: it.first, role: 'key', at: 'q' }];
    const m2 = [];
    d2.forEach(k => { const o = it.opts[k]; if (o.same) { m2.push({ t: o.same[0], role: 'trap', at: 'q' }, { t: o.same[1], role: 'trap', at: k }); } if (o.sound) { m2.push({ t: o.sound[0], role: 'trap', at: 'q' }, { t: o.sound[1], role: 'trap', at: k }); } if (o.cue) m2.push({ t: o.cue, role: 'cue', at: k }); });
    const m3 = d3.map(k => ({ t: it.opts[k].cue || it.opts[k].t, role: 'trap', at: k })).concat([{ t: it.opts[it.a].t, role: 'ok', at: it.a, whole: true }]);
    return [
      { head: '① 첫 단어를 들어요.', text: t1, marks: m1 },
      { head: '② 함정을 지워요.', text: t2, marks: m2 },
      { head: '③ 남은 답이 말이 되나요?', text: t3, marks: m3 },
    ];
  };
  // 보기마다 한 줄 (답한 뒤)
  LP.notes = it => it.opts.map((o, k) => { const j = LP.judgeOpt(it, k); return (j.s === 'ok' ? '' : '× ') + j.why; });

  /* =========================================================
     데이터 점검: 정답이 판정과 다르거나, 맞는 보기가 하나가 아니거나, 표시한 글이 없거나, 정답 위치가 몰리면 경고
     ========================================================= */
  LP.check = function () {
    const bad = [];
    const inT = (t, s) => String(s).toLowerCase().includes(String(t).toLowerCase().replace(' … ', ' '));
    const okSet = (nmTag, it) => it.opts.map((_, k) => k).filter(k => LP.judgeOpt(it, k).s === 'ok');
    const st1 = (w, st, photo) => {
      if (!LP.WHO[st.who]) bad.push(`${w}: 주어 ${st.who}가 사전에 없어요`);
      if (!LP.VB[st.v]) bad.push(`${w}: 동사 ${st.v}가 사전에 없어요`);
      if (!LP.FORM[st.form]) bad.push(`${w}: 꼴 ${st.form}가 사전에 없어요`);
      (st.obj || []).forEach(o => { if (!LP.OBJ[o]) bad.push(`${w}: 물건 ${o}가 사전에 없어요`); });
      [st.subjT, st.vT].concat(st.objT || []).forEach(t => { if (!st.t.includes(t)) bad.push(`${w}: ‘${t}’가 문장에 없어요`); });
      if ((st.obj || []).length !== (st.objT || []).length) bad.push(`${w}: 물건과 물건 글의 수가 달라요`);
      if (photo && !LP.PHOTO[photo]) bad.push(`${w}: 사진 ${photo}가 없어요`);
      if (st.form === 'act' && !LP.VB[st.v].act) bad.push(`${w}: ${st.v}는 동작이 아니에요`);
      if (st.form === 'state' && !LP.VB[st.v].st) bad.push(`${w}: ${st.v}는 사람의 상태가 아니에요`);
      if (/^(haspp|ispp)$/.test(st.form) && !LP.VB[st.v].done) bad.push(`${w}: ${st.v}에 ‘된 상태’ 이름이 없어요`);
    };
    const it2 = (w, it, single = true) => {
      if (!LP.PT[it.pt]) bad.push(`${w}: 질문 종류 ${it.pt}가 없어요`);
      if (it.pt === 'wh' && !LP.WH[it.wh]) bad.push(`${w}: 의문사 ${it.wh}가 없어요`);
      if (it.first && it.pt !== 'stmt' && !inT(it.first, it.q)) bad.push(`${w}: 첫 단어 ‘${it.first}’가 질문에 없어요`);
      if (it.pt === 'wh' && !it.q.startsWith(it.first)) bad.push(`${w}: 질문이 첫 단어로 시작하지 않아요`);
      it.opts.forEach((o, k) => {
        if (!LP.KIND[o.kind]) bad.push(`${w} (${L4[k]}): 종류 ${o.kind}가 없어요`);
        if (o.same && !(inT(o.same[0], it.q) && inT(o.same[1], o.t))) bad.push(`${w} (${L4[k]}): 같은 단어 ${o.same}가 질문 · 대답에 없어요`);
        if (o.sound && !(inT(o.sound[0], it.q) && inT(o.sound[1], o.t))) bad.push(`${w} (${L4[k]}): 비슷한 소리 ${o.sound}가 질문 · 대답에 없어요`);
        if (o.yn && !new RegExp('^' + o.yn, 'i').test(o.t)) bad.push(`${w} (${L4[k]}): yn과 대답의 첫 말이 달라요`);
        if (/^(Yes|No)\b/.test(o.t) && !o.yn && ['yn', 'neg', 'tag'].includes(it.pt) && LP.judge2(it, k).s === 'ok') bad.push(`${w} (${L4[k]}): Yes/No 대답인데 사실(fact)이 없어요`);
        if (o.cue && !o.t.includes(o.cue)) bad.push(`${w} (${L4[k]}): 단서 ‘${o.cue}’가 대답에 없어요`);
        if (LP.INDIRECT.includes(o.kind) && !o.note) bad.push(`${w} (${L4[k]}): 간접 응답의 설명(note)이 없어요`);
      });
      if (single) {
        const good = okSet(w, it);
        if (good.length !== 1 || (it.a != null && good[0] !== it.a)) bad.push(`${w}: 맞는 대답 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${it.a != null ? L4[it.a] : '-'}`);
      }
    };
    LP.P1.forEach((it, i) => {
      const w = `연습 문제 ${i + 1}`;
      it.opts.forEach((st, k) => st1(`${w} (${L4[k]})`, st, it.photo));
      const good = okSet(w, it);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 맞는 문장 ${JSON.stringify(good.map(k => L4[k]))}, 정답 ${L4[it.a]}`);
    });
    LP.P2.forEach((it, i) => it2(`연습 문제 ${LP.P1.length + i + 1}`, it));
    const bal = (list, n, w) => { const pos = new Array(n).fill(0); list.forEach(it => pos[it.a]++); if (Math.max(...pos) - Math.min(...pos) > 1) bad.push(`${w} 정답 위치가 한쪽에 몰려 있어요: ${pos.join(',')}`); };
    bal(LP.P1, 4, 'Part 1'); bal(LP.P2, 3, 'Part 2');
    // 영상 · 직접 해 보기 · 놀이터
    const ex1 = [['boss', 'boxesMan', [true, false]], ['jacket', 'jacketOn', [true, false]], ['jacket', 'jacketWear', [false, true]],
      ['chairs', 'chairsEmpty', [true, false]], ['chairs', 'chairsMan', [true, true]], ['copier', 'copier', [true, false, false]]];
    ex1.forEach(([k, ph, want]) => LP.EX[k].forEach((st, i) => { st1(`영상 ${k} ${i + 1}`, st, ph); if ((LP.judge1(st, ph).s === 'ok') !== want[i]) bad.push(`영상 ${k}/${ph} ${i + 1}: 판정이 장면과 달라요`); }));
    ['lounge', 'sales', 'contract', 'jam', 'brk'].forEach(k => it2(`영상 ${k}`, LP.EX[k]));
    it2('영상 tea', LP.EX.tea, false); if (LP.EX.tea.opts.map((_, k) => LP.judge2(LP.EX.tea, k).s).join() !== 'ok,ok,no') bad.push('영상 tea: 판정이 장면과 달라요');
    it2('영상 budget', LP.EX.budget, false); if (LP.EX.budget.opts.some((_, k) => LP.judge2(LP.EX.budget, k).s !== 'ok')) bad.push('영상 budget: 모두 맞아야 해요');
    it2('영상 client', LP.EX.client, false); if (LP.EX.client.opts.map((_, k) => LP.judge2(LP.EX.client, k).s).join() !== 'ok,ok,no,no') bad.push('영상 client: 판정이 장면과 달라요');
    it2('영상 dinner', LP.EX.dinner, false);
    LP.WHSET.qs.forEach((q, i) => { it2(`04장 첫 단어 ${i + 1}`, q, false); const good = q.opts.map((_, k) => k).filter(k => LP.judge2(q, k).s === 'ok'); if (good.length !== 1 || good[0] !== i) bad.push(`04장 첫 단어 ${i + 1}: 맞는 대답이 ${good}`); });
    Object.entries(LP.MINI).forEach(([k, it]) => it2(`직접 해 보기 ${k}`, it));
    LP.LAB.copier.forEach((st, i) => st1(`03장 직접 해 보기 ${i + 1}`, st, 'copier'));
    it2('06장 직접 해 보기', LP.LAB.budget, false);
    if (LP.LAB.budget.opts.some((_, k) => (LP.judge2(LP.LAB.budget, k).s === 'ok') !== LP.LAB.budgetWant[k])) bad.push('06장 직접 해 보기: 판정이 데이터와 달라요');
    LP.GAME.forEach((g, i) => { it2(`함정 감별사 ${i + 1}`, g); });
    const seenTags = new Set(); LP.GAME.forEach(g => g.opts.forEach((_, k) => LP.judge2(g, k).tags.forEach(t => seenTags.add(t))));
    LP.TAGS.forEach(t => { if (!seenTags.has(t)) bad.push(`함정 감별사: ${LP.TAG[t]} 보기가 하나도 없어요`); });
    bal(LP.GAME, 3, '함정 감별사');
    LP.SCENES.forEach(sc => {
      sc.sts.forEach((st, i) => sc.moments.forEach(([ph]) => st1(`동작 · 상태 ${sc.id} ${i + 1}`, st, ph)));
      // 두 순간에서 판정이 달라지는 문장이 있어야 놀이터가 뜻이 있어요
      if (!sc.sts.some(st => LP.judge1(st, sc.moments[0][0]).s !== LP.judge1(st, sc.moments[1][0]).s)) bad.push(`동작 · 상태 ${sc.id}: 두 순간의 판정이 모두 같아요`);
    });
    bad.forEach(b => console.warn('[듣기 ①] ' + b));
    return bad;
  };

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용)
  LP.allText = function () {
    const out = [];
    const st = s => out.push(s.t, s.ko, s.subjT, s.vT, (s.objT || []).join(''));
    const it = x => { out.push(x.q, x.qko || '', x.first || ''); x.opts.forEach(o => out.push(o.t, o.ko, o.note || '', o.off || '')); };
    [LP.WHO, LP.OBJ, LP.KIND, LP.TAG].forEach(D => out.push(Object.values(D).join('')));
    Object.values(LP.VB).forEach(v => out.push(Object.values(v).join('')));
    Object.values(LP.FORM).forEach(f => out.push(f.name, f.ko));
    Object.values(LP.PHOTO).forEach(p => out.push(p.ko, p.now));
    Object.values(LP.PT).forEach(p => out.push(p.name, p.short));
    Object.values(LP.WH).forEach(p => out.push(p.w, p.ask));
    LP.P1.forEach(x => x.opts.forEach(st)); LP.P2.forEach(it);
    Object.values(LP.EX).forEach(v => Array.isArray(v) ? v.forEach(st) : it(v));
    LP.WHSET.qs.forEach(it); LP.SCENES.forEach(s => { out.push(s.name, s.moments.map(m => m[1]).join('')); s.sts.forEach(st); });
    LP.FIRSTS.forEach(f => out.push(f.label)); LP.SOUNDS.forEach(s => out.push(s.join('')));
    return out.join('');
  };
})();
