/* 올리고 내리기 — 억양과 초점: 규칙 엔진 (IN)
 * 낱말마다 음절로 나눈 철자 · 센 음절 · 갈래(내용어 c · 기능어 f · 의문사 q) · 뜻을 손으로 적었어요.
 * 엔진은 문장 부호 · 첫 낱말 · or로 문장의 모양(Yes/No 질문 ↗ · 정보 질문 ↘ · 고르는 질문 ↗↘ · 평서문 ↘ · 되묻는 말 ↗)을 정하고,
 * 말 토막(쉼표 · or · 문장 끝)마다 높낮이가 꺾이는 곳(마지막 내용어의 센 음절, 초점이 있으면 그 낱말)과 그 뒤의 움직임(내림 · 올림)을 계산해요.
 * 높낮이 선의 기본 모양(그림, IN.schematic) · 대문자 표기(IN.caps) · 연습 문제의 정답 · 따라 말하기 맞추기도 여기서 계산해요.
 * 규칙은 미국 표준 발음 교재의 설명을 단순하게 줄인 것이에요(README). 말하는 사람 · 상황 · 기분에 따라 달라지고,
 * 정보 질문도 부드럽게 끝을 올리기도 해요. 소리를 듣지 않아요 — 높낮이 선은 미리 만든 음성 파일을 따로 재서(audio/dialogue/measure.js) 그려요.
 */
(function () {
  'use strict';
  const IN = (window.IN = {});

  /* ---------- 낱말 사전 ----------
     키|음절로 나눈 철자(.)|센 음절(0부터)|갈래 c 내용어 · f 기능어 · q 의문사|뜻 */
  const DICT_SRC = `a|a|0|f|하나의
are|are|0|f|~이다
at|at|0|f|~에
bag|bag|0|c|가방
been|been|0|f|~였다
black|black|0|c|검은
blue|blue|0|c|파란
brown|brown|0|c|갈색의
call|call|0|c|전화하다
can|can|0|f|~할 수 있다
canada|Ca.na.da|0|c|캐나다
closed|closed|0|c|닫힌
coffee|cof.fee|0|c|커피
did|did|0|f|(과거)
do|do|0|f|(묻기)
does|does|0|f|(묻기)
drive|drive|0|c|차로 가다
dollars|dol.lars|0|c|달러
eight|eight|0|c|여덟
far|far|0|c|먼
from|from|0|f|~에서
going|go.ing|0|c|가는
have|have|0|f|(완료)
he|he|0|f|그
help|help|0|c|돕다
here|here|0|f|여기
home|home|0|c|집
how|how|0|q|어떻게
i|I|0|f|나
is|is|0|f|~이다
it|it|0|f|그것
it's|it's|0|f|그것은 ~이다
late|late|0|c|늦은
leaving|leav.ing|0|c|떠나는
like|like|0|c|좋아하다
likes|likes|0|c|좋아하다
live|live|0|c|살다
me|me|0|f|나를
meet|meet|0|c|만나다
monday|Mon.day|0|c|월요일
not|not|0|f|아니다
or|or|0|f|또는
ordered|or.dered|0|c|주문했다
raining|rain.ing|0|c|비가 오는
ready|rea.dy|0|c|준비된
red|red|0|c|빨간
said|said|0|c|말했다
seat|seat|0|c|자리
seven|sev.en|0|c|일곱
she's|she's|0|f|그녀는 ~이다
should|should|0|f|~할까
start|start|0|c|시작하다
store|store|0|c|가게
student|stu.dent|0|c|학생
taken|ta.ken|0|c|주인이 있는
tea|tea|0|c|차
ten|ten|0|c|열
text|text|0|c|문자하다
the|the|0|f|그
this|this|0|f|이
time|time|0|c|시간
to|to|0|f|~에
today|to.day|1|c|오늘
tomorrow|to.mor.row|1|c|내일
tuesday|Tues.day|0|c|화요일
twenty|twen.ty|0|c|스물
walk|walk|0|c|걷다
want|want|0|c|원하다
was|was|0|f|~였다
we|we|0|f|우리
weekend|week.end|0|c|주말
what|what|0|q|무엇
when|when|0|q|언제
where|where|0|q|어디
who|who|0|q|누구
why|why|0|q|왜
would|would|0|f|~할까
you|you|0|f|너
you're|you're|0|f|너는 ~이다
your|your|0|f|너의`;
  const DICT = {};
  DICT_SRC.split('\n').forEach(line => {
    const [key, spell, st, kind, gloss] = line.trim().split('|');
    const parts = spell.split('.');
    DICT[key.toLowerCase()] = { key, w: parts.join(''), spell: parts, st: +st, kind, gloss };
  });
  IN.DICT = DICT;
  const norm1 = s => String(s).toLowerCase().replace(/’/g, "'");
  const entry = k => DICT[norm1(k)] || null;
  IN.entry = entry;
  // 대문자로 센 음절 (REAdy · toMORrow) — 한 음절 낱말은 낱말 전체
  IN.capsW = (k, t) => { const e = entry(k); if (!e) return (t || k).toUpperCase(); const w = t || e.w; let at = 0; return e.spell.map((s, i) => { const x = w.slice(at, at + s.length); at += s.length; return i === e.st ? x.toUpperCase() : x.toLowerCase(); }).join(''); };

  /* ---------- 문장 나누기 ---------- */
  const WORD_RE = /([A-Za-z]+(?:['’][A-Za-z]+)?)/;
  IN.tokens = function (text) {
    const parts = String(text).split(WORD_RE), out = [];
    for (let j = 1; j < parts.length; j += 2) out.push({ t: parts[j], k: norm1(parts[j]), e: entry(parts[j]), i: out.length, after: parts[j + 1] || '' });
    return out;
  };
  const AUX = ['are', 'is', 'am', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should', 'have', 'has', 'may', 'shall'];

  /* ---------- 모양 ----------
     끝이 ?면: or가 있으면 고르는 질문(alt) · 의문사로 시작하면 정보 질문(wh) · 조동사로 시작하면 Yes/No 질문(yn) · 그 밖은 되묻는 말(decl)
     끝이 . · !면 평서문(stmt). 여러 문장이면 마지막 문장으로 봐요 */
  const SHAPES = {
    yn: { ko: 'Yes/No 질문', arrow: '↗', end: 'up', long: '예 · 아니오로 답하는 질문 — 끝을 올려요', ex: 'Are you ready?' },
    wh: { ko: '정보 질문', arrow: '↘', end: 'down', long: 'what · where · how로 묻는 질문 — 끝을 내려요', ex: 'Where are you going?' },
    alt: { ko: '고르는 질문', arrow: '↗↘', end: 'down', long: 'A or B? — 앞은 올리고 마지막은 내려요', ex: 'Coffee or tea?' },
    stmt: { ko: '평서문', arrow: '↘', end: 'down', long: '말하는 문장 — 끝을 내려요', ex: "It's raining." },
    decl: { ko: '되묻는 말', arrow: '↗', end: 'up', long: '평서문 꼴 그대로 끝만 올려 묻기 — 놀람 · 확인', ex: "It's raining?" },
  };
  IN.SHAPES = SHAPES;
  IN.SHAPE_ORDER = ['yn', 'wh', 'alt', 'stmt', 'decl'];
  const lastSentence = text => { const s = String(text).trim().match(/[^.?!]+[.?!]*$/); return s ? s[0].trim() : String(text).trim(); };
  IN.shapeOf = function (text) {
    const s = lastSentence(text), end = s.slice(-1);
    if (end !== '?') return 'stmt';
    const toks = IN.tokens(s);
    if (!toks.length) return 'stmt';
    if (toks.some(x => x.k === 'or')) return 'alt';
    if (entry(toks[0].k) && entry(toks[0].k).kind === 'q') return 'wh';
    if (AUX.indexOf(toks[0].k) >= 0) return 'yn';
    return 'decl';
  };
  IN.endOf = text => SHAPES[IN.shapeOf(text)].end;
  IN.arrowOf = text => SHAPES[IN.shapeOf(text)].arrow;

  /* ---------- 말 토막과 꺾이는 곳 ----------
     토막 = 쉼표 · 문장 끝 · 고르는 질문의 or 앞에서 나눠요. 토막마다 꺾이는 곳(핵)은 마지막 내용어(c)의 센 음절이고,
     초점 낱말(o.focus)이 있는 토막은 그 낱말이에요. 내용어가 없으면 마지막 낱말.
     tone: fall ↘ · rise ↗(Yes/No) · high ↗(되묻는 말, 더 크게) · alt1 ↗(고르는 질문의 앞 선택지) · post(초점 뒤 — 낮게 눌러 내림)
     o.shape로 모양을 바꿔 볼 수 있어요(고르는 질문을 Yes/No로 읽으면 or에서 나누지 않고 끝을 올림) */
  IN.phrases = function (text, o = {}) {
    const toks = IN.tokens(text), out = [];
    const shape = o.shape || IN.shapeOf(text), focus = o.focus ? norm1(o.focus) : null;
    let a = 0;
    toks.forEach((x, i) => {
      const orNext = shape === 'alt' && toks[i + 1] && toks[i + 1].k === 'or';
      const brk = /[,.?!;]/.test(x.after) || i === toks.length - 1 || orNext;
      if (brk) { out.push({ a, b: i, end: (x.after.match(/[,.?!;]/) || [''])[0] || (orNext ? 'or' : '') }); a = i + 1; }
    });
    let seenFocus = -1;
    out.forEach((p, pi) => {
      const ws = toks.slice(p.a, p.b + 1);
      let nw = -1;
      if (focus) { const f = ws.find(x => x.k === focus); if (f) { nw = f.i; seenFocus = pi; } }
      if (nw < 0) { const c = ws.filter(x => x.e && x.e.kind === 'c'); nw = c.length ? c[c.length - 1].i : p.b; }
      p.w = nw;
      p.s = toks[nw].e ? toks[nw].e.st : 0;
      const last = pi === out.length - 1;
      if (seenFocus >= 0 && pi > seenFocus) p.tone = 'post';
      else if (shape === 'alt' && !last && p.end === 'or') p.tone = 'alt1';
      else if (!last) p.tone = 'fall';
      else p.tone = shape === 'yn' ? 'rise' : shape === 'decl' ? 'high' : 'fall';
    });
    return out;
  };
  // 꺾이는 낱말들 (토막마다 하나)
  IN.nuclei = (text, o) => IN.phrases(text, o).map(p => p.w);
  IN.focusOf = text => { const s = IN.SENT_ALL.find(x => x.en === text); return s && s.focus ? s.focus : null; };
  // 대문자 표기: 꺾이는 낱말의 센 음절만 대문자 (Are you REAdy? · Would you like COFfee or TEA?)
  IN.caps = (text, o = {}) => {
    const focus = o.focus === undefined ? IN.focusOf(text) : o.focus;
    const nuc = IN.nuclei(text, { focus, shape: o.shape }), toks = IN.tokens(text);
    const parts = String(text).split(WORD_RE);
    let k = 0;
    return parts.map((p, j) => { if (j % 2 === 0) return p; const t = toks[k++]; return nuc.indexOf(t.i) >= 0 ? IN.capsW(t.k, t.t) : p; }).join('');
  };

  /* ---------- 높낮이 선의 기본 모양 (그림 — 잰 값이 아니에요) ----------
     음절마다 자리를 나눠(센 음절은 넓게, 꺾이는 음절은 더 넓게) 반음 높이를 찍어요. 기준 0 = 그 말의 가운데쯤.
     앞쪽은 조금씩 내려가고(센 음절에서 살짝 솟음), 꺾이는 음절에서 tone대로: fall = 높이 솟았다 뚝 · rise = 낮게 시작해 끝까지 올림 ·
     high = 더 크게 올림 · alt1 = 토막 끝까지 올림 · post = 낮게 눌러 내림 · ko = 꺾이는 낱말을 높게 솟게 한 뒤 끝을 조금 올림(한국어식 그림).
     o.tune으로 마지막 토막의 tone을, o.focus · o.shape로 꺾이는 곳 · 모양을 바꿔 그릴 수 있어요(한국어식 실수 · 다른 뜻 그림) */
  IN.schematic = function (text, o = {}) {
    const toks = IN.tokens(text), focus = o.focus === undefined ? IN.focusOf(text) : o.focus;
    const ph = IN.phrases(text, { focus, shape: o.shape });
    if (o.tune) ph[ph.length - 1].tone = o.tune;
    if (o.firstTune) ph[0].tone = o.firstTune;
    const syl = [];
    toks.forEach(t => {
      const e = t.e, n = e ? e.spell.length : 1, pi = ph.findIndex(q => t.i >= q.a && t.i <= q.b);
      for (let s = 0; s < n; s++) {
        const nuc = ph[pi].w === t.i && (e ? e.st : 0) === s;
        const str = !!e && e.kind !== 'f' && e.st === s;
        const lab = e ? ((s === e.st && (n > 1 || nuc)) ? e.spell[s].toUpperCase() : e.spell[s].toLowerCase()) : t.t;
        syl.push({ w: t.i, s, nuc, str, p: pi, lab: n === 1 && !nuc ? t.t : lab, wd: nuc ? 1.7 : str ? 1.25 : 0.8 });
      }
    });
    const tot = syl.reduce((a, s) => a + s.wd, 0);
    let x = 0;
    syl.forEach(s => { s.a = x / tot; x += s.wd; s.b = x / tot; });
    const pts = [];
    let base = 1.5;
    ph.forEach((P, pi) => {
      const ss = syl.filter(s => s.p === pi), ni = ss.findIndex(s => s.nuc);
      const pre = ss.slice(0, ni), nuc = ss[ni], post = ss.slice(ni + 1), isLast = pi === ph.length - 1;
      pre.forEach(s => { pts.push([(s.a + s.b) / 2, base + (s.str ? 2.5 : 0)]); base -= 0.35; });
      const end = post.length ? post[post.length - 1].b : nuc.b, m = (nuc.a + nuc.b) / 2, T = P.tone;
      if (T === 'fall' || T === 'post') {
        const pk = T === 'post' ? base + 1 : base + 5, lo = base - (isLast ? 4.5 : 2.5) - (T === 'post' ? 1 : 0);
        pts.push([nuc.a, pk - 2.5], [m, pk]);
        if (post.length) { pts.push([nuc.b, lo + 1]); post.forEach(s => pts.push([(s.a + s.b) / 2, lo])); pts.push([end, lo - 0.3]); }
        else pts.push([nuc.b, lo]);
      } else if (T === 'ko') {
        pts.push([nuc.a, base + 2], [m, base + 6]);
        post.forEach(s => pts.push([(s.a + s.b) / 2, base + 1.5]));
        pts.push([end, base + 3.5]);
      } else {
        const top = T === 'high' ? 9 : T === 'alt1' ? 5 : 6.5, low = T === 'high' ? -2.5 : T === 'alt1' ? 0 : -1.5;
        pts.push([nuc.a, base - 0.5], [m, base + low]);
        const span = Math.max(1e-6, end - m);
        post.forEach(s => { const c = (s.a + s.b) / 2; pts.push([c, base + low + (top - low) * Math.pow((c - m) / span, 1.4)]); });
        pts.push([end, base + top]);
      }
      if (!isLast) base += T === 'alt1' ? 0.5 : 1.0;
    });
    const words = toks.map(t => { const ss = syl.filter(s => s.w === t.i); return { t: t.t, a: ss[0].a, b: ss[ss.length - 1].b }; });
    return { pts, syl, phrases: ph, words };
  };

  /* ---------- 데이터 ---------- */
  IN.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '밝은 미국 여성' },
    { sp: 'tf', ko: '차분한 선생님', who: '차분한 미국 여성' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];
  // 문장 — 영어|한국어 뜻|모양|초점 낱말(있으면). 모양은 엔진(IN.shapeOf)이 다시 계산해 맞춰 봐요
  const SENT_SRC = `It's raining.|비가 와요.|stmt
It's raining?|비가 온다고요?|decl
You're a student.|학생이군요.|stmt
You're a student?|학생이라고요?|decl
She's at home.|그녀는 집에 있어요.|stmt
She's at home?|그녀가 집에 있다고요?|decl
He likes coffee.|그는 커피를 좋아해요.|stmt
He likes coffee?|그가 커피를 좋아한다고요?|decl
The store is closed.|가게가 닫혔어요.|stmt
The store is closed?|가게가 닫혔다고요?|decl
You're leaving.|가시는군요.|stmt
You're leaving?|벌써 가신다고요?|decl
Are you ready?|준비됐어요?|yn
Do you like coffee?|커피 좋아해요?|yn
Is it far from here?|여기서 멀어요?|yn
Can you help me?|좀 도와줄 수 있어요?|yn
Is this seat taken?|이 자리 주인 있어요?|yn
Have you been to Canada?|캐나다에 가 봤어요?|yn
Did you call me?|나한테 전화했어요?|yn
Are you going?|갈 거예요?|yn
Is it far?|멀어요?|yn
Do you like it?|마음에 들어요?|yn
Did you call?|전화했어요?|yn
Would you like coffee?|커피 드릴까요?|yn
Is it red?|빨간색이에요?|yn
Is it today?|오늘이에요?|yn
Do you want to walk?|걸어갈래요?|yn
Where are you going?|어디 가요?|wh
What time is it?|몇 시예요?|wh
How was your weekend?|주말 어땠어요?|wh
Where do you live?|어디 살아요?|wh
Why are you late?|왜 늦었어요?|wh
When does it start?|언제 시작해요?|wh
How far is it?|얼마나 멀어요?|wh
What do you like?|뭘 좋아해요?|wh
Who did you call?|누구한테 전화했어요?|wh
Would you like coffee or tea?|커피 드릴까요, 차 드릴까요?|alt
Coffee or tea?|커피요, 차요?|alt
Is it red or blue?|빨간색이에요, 파란색이에요?|alt
Is it today or tomorrow?|오늘이에요, 내일이에요?|alt
Do you want to walk or drive?|걸어갈래요, 차로 갈래요?|alt
Should I call you or text you?|전화할까요, 문자할까요?|alt
Is your bag black or brown?|가방이 검은색이에요, 갈색이에요?|alt
I said Tuesday, not Monday.|월요일이 아니라 화요일이라고 했어요.|stmt|Tuesday
It's ten dollars, not twenty.|20달러가 아니라 10달러예요.|stmt|ten
I ordered tea, not coffee.|커피가 아니라 차를 시켰어요.|stmt|tea
We meet at seven, not eight.|8시가 아니라 7시에 만나요.|stmt|seven
It's black, not brown.|갈색이 아니라 검은색이에요.|stmt|black`;
  IN.SENT_ALL = SENT_SRC.split('\n').map(l => { const [en, ko, shape, focus] = l.trim().split('|'); return { en, ko, shape, focus: focus || null }; });
  IN.meaning = text => { const s = IN.SENT_ALL.find(x => x.en === text); if (s) return s.ko; const e = entry(text); return e ? e.gloss : ''; };

  // 00장: 같은 낱말, 끝만 다름
  IN.INTRO = ["It's raining.", "It's raining?"];
  // 01장 · 실험실: 평서문 ↔ 되묻는 말 (같은 낱말)
  IN.DECL = [["It's raining.", "It's raining?"], ["You're a student.", "You're a student?"], ["She's at home.", "She's at home?"],
    ['He likes coffee.', 'He likes coffee?'], ['The store is closed.', 'The store is closed?'], ["You're leaving.", "You're leaving?"]];
  IN.LISTEN_SHOWN = 3;
  // 02장 지도: 모양마다 보기 셋
  IN.MAP = [
    { shape: 'yn', ex: ['Are you ready?', 'Do you like coffee?', 'Can you help me?'] },
    { shape: 'wh', ex: ['Where are you going?', 'What time is it?', 'How was your weekend?'] },
    { shape: 'alt', ex: ['Is it red or blue?', 'Coffee or tea?', 'Is it today or tomorrow?'] },
    { shape: 'stmt', ex: ["It's raining.", "You're a student.", 'The store is closed.'] },
    { shape: 'decl', ex: ["It's raining?", "You're a student?", "You're leaving?"] },
  ];
  // 03장 꺾이는 곳: 마지막 내용어의 센 음절 — 뒤에 기능어가 붙어도(from here) 꺾이는 곳은 그대로
  IN.NUC = ['Are you ready?', 'Do you like coffee?', 'Is it far from here?', 'How was your weekend?'];
  IN.YN = ['Are you ready?', 'Do you like coffee?', 'Can you help me?', 'Is this seat taken?', 'Have you been to Canada?', 'Did you call me?'];
  IN.WH = ['Where are you going?', 'What time is it?', 'How was your weekend?', 'Where do you live?', 'Why are you late?', 'When does it start?'];
  IN.ALT = ['Would you like coffee or tea?', 'Coffee or tea?', 'Is it red or blue?', 'Is it today or tomorrow?', 'Do you want to walk or drive?', 'Should I call you or text you?'];
  IN.FOCUS = ['I said Tuesday, not Monday.', "It's ten dollars, not twenty.", 'We meet at seven, not eight.', 'I ordered tea, not coffee.', "It's black, not brown."];

  // 실험실: 하나만 바꾼 짝 (A → B)
  IN.SWITCH = [
    { id: 'end', ko: '끝만 바꾸기 (. → ?)', note: '낱말은 그대로, 끝만 올리면 되묻는 말이 돼요 — 놀람 · 확인. 꺾이는 곳(마지막 센 음절)에서부터 올려요.', pairs: IN.DECL },
    { id: 'wh', ko: '의문사 붙이기', note: '의문사로 시작하면 정보를 묻는 질문 — 끝을 올리지 않고 꺾이는 곳에서 내려요. 예 · 아니오가 아니라 정보로 답하니까요.', pairs: [['Are you going?', 'Where are you going?'], ['Is it far?', 'How far is it?'], ['Do you like it?', 'What do you like?'], ['Did you call?', 'Who did you call?']] },
    { id: 'alt', ko: '하나 → 둘 중 하나', note: '선택지가 둘이 되면 앞은 올리고 마지막은 내려요 — 이 둘 가운데 고르라는 뜻이에요.', pairs: [['Would you like coffee?', 'Would you like coffee or tea?'], ['Is it red?', 'Is it red or blue?'], ['Is it today?', 'Is it today or tomorrow?'], ['Do you want to walk?', 'Do you want to walk or drive?']] },
  ];
  IN.switchSet = id => IN.SWITCH.find(s => s.id === id) || IN.SWITCH[0];

  // 놀이터 ① 듣기 훈련: 끝이 올라가나 내려가나 (같은 낱말 짝 + Yes/No · 정보 질문)
  IN.HV = [].concat(...IN.DECL, ['Are you ready?', 'Do you like coffee?', 'Can you help me?', 'Is this seat taken?', 'Where are you going?', 'What time is it?', 'How was your weekend?', 'Why are you late?']);

  // 따라 말하기 28 = 묶음 넷 × 일곱
  IN.SGRP = {
    yn: { ko: 'Yes/No 질문 ↗', long: 'Yes/No 질문 — 꺾이는 곳에서부터 끝까지 올려요' },
    wh: { ko: '정보 질문 ↘', long: '정보 질문 — 의문사로 묻고 꺾이는 곳에서 내려요' },
    alt: { ko: '고르는 질문 ↗↘', long: '고르는 질문 — 앞 선택지는 올리고 마지막은 내려요' },
    focus: { ko: '되묻기 · 초점', long: '되묻기 · 초점 — 끝만 올려 되묻고, 고쳐 말하는 낱말을 높게' },
  };
  IN.SGRP_ORDER = ['yn', 'wh', 'alt', 'focus'];
  IN.SENT = [].concat(
    ['Are you ready?', 'Do you like coffee?', 'Is it far from here?', 'Can you help me?', 'Is this seat taken?', 'Have you been to Canada?', 'Did you call me?'].map(en => ({ en, grp: 'yn' })),
    ['Where are you going?', 'What time is it?', 'How was your weekend?', 'Where do you live?', 'Why are you late?', 'When does it start?', 'How far is it?'].map(en => ({ en, grp: 'wh' })),
    ['Would you like coffee or tea?', 'Coffee or tea?', 'Is it red or blue?', 'Is it today or tomorrow?', 'Do you want to walk or drive?', 'Should I call you or text you?', 'Is your bag black or brown?'].map(en => ({ en, grp: 'alt' })),
    ["It's raining?", "You're a student?", "You're leaving?", 'I said Tuesday, not Monday.', "It's ten dollars, not twenty.", 'I ordered tea, not coffee.', 'We meet at seven, not eight.'].map(en => ({ en, grp: 'focus' })),
  );
  IN.SENT.forEach(s => { s.ko = IN.meaning(s.en); });

  /* ---------- 따라 말하기: 낱말 맞추기 ----------
     인식기는 숫자를 숫자로 적기도 해요(10 · 7) — 같은 낱말로 쳐요. 높낮이는 맞춰 보지 않아요 */
  const NUMW = { 7: 'seven', 8: 'eight', 10: 'ten', 20: 'twenty' };
  const SAME = { a: ['uh'], you: ['ya'], dollars: ['dollar', '$'] };
  const words = s => String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\$(\d+)/g, '$1 dollars')
    .replace(/\b(\d+)\b/g, (m, d) => NUMW[d] || d).replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const norm = w => w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  IN.compareWords = function (target, heard) {
    const T = String(target).split(/\s+/).filter(Boolean).map(w => ({ w, n: norm(w) }));
    const Hs = words(heard).map(norm);
    const used = Hs.map(() => false);
    let hit = 0;
    const marks = T.map(t => {
      if (!t.n) return { w: t.w, ok: true };
      const k = Hs.findIndex((h, i) => !used[i] && (h === t.n || (SAME[t.n] || []).indexOf(h) >= 0));
      if (k >= 0) { used[k] = true; hit++; return { w: t.w, ok: true }; }
      return { w: t.w, ok: false };
    });
    const total = T.filter(t => t.n).length;
    return { marks, hit, total, ratio: total ? hit / total : 0 };
  };

  /* ---------- 연습 문제: 듣고 고르기 16 ----------
     kind: end(끝을 올렸나 내렸나) · pair(같은 낱말 둘 중 묻는 쪽은?) · shape(어떤 질문인가 — ↗ · ↘ · ↗↘)
     a: 정답 보기 번호(0부터) — 엔진이 다시 계산해 맞춰 봐요 */
  const END_OPTS = ['끝을 올렸어요 ↗', '끝을 내렸어요 ↘'];
  const SHAPE_OPTS = ['↗ Yes/No 질문', '↘ 정보 질문', '↗↘ 고르는 질문'];
  IN.END_OPTS = END_OPTS; IN.SHAPE_OPTS = SHAPE_OPTS;
  IN.DRILL = [
    { kind: 'end', sp: 'tc', say: "It's raining?", a: 0 },
    { kind: 'shape', sp: 'um', say: 'Where do you live?', a: 1 },
    { kind: 'pair', sp: 'uf', seq: ["You're a student?", "You're a student."], a: 0 },
    { kind: 'end', sp: 'um', say: "She's at home.", a: 1 },
    { kind: 'shape', sp: 'tf', say: 'Is it red or blue?', a: 2 },
    { kind: 'end', sp: 'uf', say: 'The store is closed?', a: 0 },
    { kind: 'pair', sp: 'tc', seq: ['He likes coffee.', 'He likes coffee?'], a: 1 },
    { kind: 'shape', sp: 'tc', say: 'Is this seat taken?', a: 0 },
    { kind: 'end', sp: 'uf', say: "You're leaving.", a: 1 },
    { kind: 'pair', sp: 'um', seq: ["It's raining?", "It's raining."], a: 0 },
    { kind: 'end', sp: 'tf', say: "You're a student?", a: 0 },
    { kind: 'shape', sp: 'tc', say: 'Do you want to walk or drive?', a: 2 },
    { kind: 'pair', sp: 'um', seq: ["She's at home.", "She's at home?"], a: 1 },
    { kind: 'end', sp: 'uf', say: 'He likes coffee.', a: 1 },
    { kind: 'shape', sp: 'um', say: 'How was your weekend?', a: 1 },
    { kind: 'pair', sp: 'tc', seq: ['The store is closed.', 'The store is closed?'], a: 1 },
  ];
  IN.DRILL.forEach(q => {
    if (q.kind === 'end') q.opts = END_OPTS.slice();
    if (q.kind === 'pair') q.opts = ['첫째 소리', '둘째 소리'];
    if (q.kind === 'shape') q.opts = SHAPE_OPTS.slice();
  });
  IN.drillText = q => q.kind === 'pair' ? q.seq.join(' · ') : q.say;
  IN.drillSeq = q => q.kind === 'pair' ? q.seq.map((w, i) => ({ text: w, sp: q.sp, gap: i ? 1.0 : undefined })) : [{ text: q.say, sp: q.sp }];
  // 엔진이 계산한 정답
  IN.drillAnswer = q => {
    if (q.kind === 'end') return IN.endOf(q.say) === 'up' ? 0 : 1;
    if (q.kind === 'pair') { const up = q.seq.map(t => IN.endOf(t) === 'up'); return up.filter(Boolean).length === 1 ? up.indexOf(true) : -1; }
    if (q.kind === 'shape') return ['yn', 'wh', 'alt'].indexOf(IN.shapeOf(q.say));
    return -1;
  };
  // 힌트 = 3단계 발음법
  IN.hints = function (q) {
    if (q.kind === 'end') {
      const sh = IN.shapeOf(q.say);
      return [
        { head: '① 듣고 가르기', text: '마지막 낱말에 귀를 모아요. 소리가 위로 들리며 끝나나요, 아래로 가라앉으며 끝나나요?' },
        { head: '② 높낮이 만들기', text: `꺾이는 곳은 마지막 센 음절이에요 → ${IN.caps(q.say)} 거기서부터 올리거나 내려요.` },
        { head: '③ 문장 속에서', text: sh === 'decl' || sh === 'stmt' ? '낱말은 평서문 그대로예요. 끝만 올리면 되묻는 말(놀람 · 확인), 내리면 그냥 말하는 문장이에요.' : sh === 'yn' ? '조동사로 시작하는 Yes/No 질문이에요 — 보통 끝을 올려요.' : '의문사로 시작하는 정보 질문이에요 — 보통 끝을 내려요.' },
      ];
    }
    if (q.kind === 'pair') {
      return [
        { head: '① 듣고 가르기', text: '두 소리의 낱말은 똑같아요. 마지막 낱말에서 높낮이가 어디로 가는지만 견줘요.' },
        { head: '② 높낮이 만들기', text: `꺾이는 곳 → ${IN.caps(q.seq[0])} 묻는 쪽은 거기서부터 위로 올려 끝나요.` },
        { head: '③ 문장 속에서', text: '평서문 꼴로 끝만 올리면 되묻는 말이에요 — 놀랐거나, 들은 것을 확인할 때 써요.' },
      ];
    }
    const sh = IN.shapeOf(q.say);
    return [
      { head: '① 듣고 가르기', text: '첫 낱말과 or를 들어요. 의문사(what · where · how …)로 시작하나요, 조동사(do · is · can …)로 시작하나요, 가운데에 or가 있나요?' },
      { head: '② 높낮이 만들기', text: '끝의 움직임도 들어요 — Yes/No 질문은 올리고, 정보 질문은 내리고, 고르는 질문은 앞을 올렸다가 마지막에서 내려요.' },
      { head: '③ 문장 속에서', text: `꺾이는 곳 → ${IN.caps(q.say)}${sh === 'alt' ? ' 선택지마다 한 번씩 꺾여요.' : ''}` },
    ];
  };

  /* ---------- 캔버스 글자 모음 (글꼴 미리 받기) ---------- */
  IN.allText = () => IN.SENT_ALL.map(s => s.en + IN.caps(s.en) + s.ko).join('') +
    Object.values(DICT).map(e => e.w + e.w.toUpperCase() + IN.capsW(e.key) + e.spell.map(x => x.toUpperCase() + x.toLowerCase()).join('') + e.gloss).join('') +
    Object.values(SHAPES).map(s => s.ko + s.arrow + s.long + s.ex).join('') + Object.values(IN.SGRP).map(g => g.ko + g.long).join('') +
    IN.SWITCH.map(s => s.ko + s.note).join('') + IN.VOICES.map(v => v.ko + v.who).join('') + END_OPTS.join('') + SHAPE_OPTS.join('') + '반음 올림 내림 꺾이는 곳 잰 값 어림';

  /* ---------- 데이터 점검 ---------- */
  IN.check = function () {
    const warn = [];
    const w = m => warn.push(m);
    Object.values(DICT).forEach(e => {
      if (e.w.toLowerCase() !== e.key.toLowerCase()) w(`${e.key}: 철자 ${e.w}`);
      if (e.st < 0 || e.st >= e.spell.length) w(`${e.key}: 센 음절 ${e.st}`);
      if (['c', 'f', 'q'].indexOf(e.kind) < 0) w(`${e.key}: 갈래 ${e.kind}`);
    });
    // 모든 문장의 낱말이 사전에 있고, 적은 모양 = 엔진의 모양, 초점 낱말이 문장에 있음(첫 낱말이 아님)
    const all = IN.SENT_ALL.map(s => s.en);
    IN.SENT_ALL.forEach(s => {
      IN.tokens(s.en).forEach(x => { if (!x.e) w(`"${s.en}": 사전에 없는 낱말 ${x.t}`); });
      if (IN.shapeOf(s.en) !== s.shape) w(`"${s.en}": 적은 모양 ${s.shape} ≠ 엔진 ${IN.shapeOf(s.en)}`);
      if (s.focus) {
        const k = IN.tokens(s.en).findIndex(x => x.k === norm1(s.focus));
        if (k < 0) w(`"${s.en}": 초점 낱말 ${s.focus}가 없음`);
        if (k === 0) w(`"${s.en}": 초점이 첫 낱말`);
        if (IN.nuclei(s.en, { focus: s.focus })[0] !== k) w(`"${s.en}": 첫 토막의 꺾이는 곳이 초점이 아님`);
      }
    });
    if (new Set(all).size !== all.length) w('문장 표에 겹친 문장');
    const known = t => { if (all.indexOf(t) < 0) w(`문장 표에 없는 문장: ${t}`); };
    [].concat(IN.INTRO, ...IN.DECL, ...IN.MAP.map(m => m.ex), IN.NUC, IN.YN, IN.WH, IN.ALT, IN.FOCUS, ...IN.SWITCH.map(s => [].concat(...s.pairs)), IN.HV, IN.SENT.map(s => s.en),
      ...IN.DRILL.map(q => q.kind === 'pair' ? q.seq : [q.say])).forEach(known);
    // 짝: 낱말이 같고(. ↔ ?) 모양이 평서문 → 되묻는 말
    IN.DECL.forEach(([a, b]) => { if (a.slice(0, -1) !== b.slice(0, -1) || IN.shapeOf(a) !== 'stmt' || IN.shapeOf(b) !== 'decl') w(`짝 ${a} · ${b}`); });
    IN.MAP.forEach(m => m.ex.forEach(t => { if (IN.shapeOf(t) !== m.shape) w(`지도 ${m.shape}: "${t}"`); }));
    IN.YN.forEach(t => { if (IN.shapeOf(t) !== 'yn') w(`Yes/No "${t}"`); });
    IN.WH.forEach(t => { if (IN.shapeOf(t) !== 'wh') w(`정보 질문 "${t}"`); });
    IN.ALT.forEach(t => { if (IN.shapeOf(t) !== 'alt' || IN.phrases(t).length !== 2) w(`고르는 질문 "${t}": 토막 둘이 아님`); });
    IN.FOCUS.forEach(t => { if (!IN.focusOf(t)) w(`초점 "${t}": 초점 낱말이 없음`); });
    IN.SWITCH.forEach(s => s.pairs.forEach(([a, b]) => {
      const A = IN.shapeOf(a), B = IN.shapeOf(b);
      const want = { end: ['stmt', 'decl'], wh: ['yn', 'wh'], alt: ['yn', 'alt'] }[s.id];
      if (A !== want[0] || B !== want[1]) w(`실험실 ${s.id} ${a} → ${b}: ${A} → ${B}`);
    }));
    // 훈련: 끝 올림 · 내림 둘 다, 고르는 질문 · 초점 문장은 넣지 않음
    const ends = IN.HV.map(t => IN.endOf(t));
    if (ends.indexOf('up') < 0 || ends.indexOf('down') < 0) w('훈련: 올림 · 내림이 모두 있어야 해요');
    if (IN.HV.some(t => IN.shapeOf(t) === 'alt' || IN.focusOf(t))) w('훈련: 고르는 질문 · 초점 문장은 넣지 않아요');
    // 따라 말하기: 7 × 4, 겹치지 않음, 묶음의 모양
    const grp = {}; IN.SENT.forEach(s => { grp[s.grp] = (grp[s.grp] || 0) + 1; });
    IN.SGRP_ORDER.forEach(g => { if (grp[g] !== 7) w(`문장 묶음 ${g}: ${grp[g] || 0}개`); });
    if (IN.SENT.length !== 28) w(`따라 말하기 ${IN.SENT.length}문장`);
    if (new Set(IN.SENT.map(s => s.en)).size !== IN.SENT.length) w('따라 말하기 문장이 겹침');
    IN.SENT.forEach(s => { const sh = IN.shapeOf(s.en); if (s.grp === 'focus' ? !(sh === 'decl' || IN.focusOf(s.en)) : sh !== s.grp) w(`따라 말하기 "${s.en}": 묶음 ${s.grp} · 모양 ${sh}`); });
    IN.SENT.forEach(s => { const r = IN.compareWords(s.en, s.en); if (r.hit !== r.total) w(`맞추기 "${s.en}": 그대로 적어도 ${r.hit}/${r.total}`); });
    // 연습 문제: 엔진의 정답, 정답 위치
    const pos = {};
    IN.DRILL.forEach((q, k) => {
      const n = q.opts.length;
      pos[n] = pos[n] || Array(n).fill(0); pos[n][q.a]++;
      const a = IN.drillAnswer(q);
      if (a !== q.a) w(`연습 ${k + 1}: 정답 ${q.a} ≠ 엔진 ${a}`);
      if (q.kind === 'pair' && q.seq[0].slice(0, -1) !== q.seq[1].slice(0, -1)) w(`연습 ${k + 1}: 짝의 낱말이 다름`);
      if (['tc', 'tf', 'uf', 'um'].indexOf(q.sp) < 0) w(`연습 ${k + 1}: 목소리 ${q.sp}`);
    });
    Object.keys(pos).forEach(n => { const p = pos[n]; if (Math.max(...p) - Math.min(...p) > 1) w(`보기 ${n}개 문제의 정답 위치가 한쪽으로 몰림: ${p.join(' / ')}`); });
    // 엔진 규칙 몇 가지
    [['Are you ready?', 'Are you REAdy?'], ['Is it far from here?', 'Is it FAR from here?'], ['Would you like coffee or tea?', 'Would you like COFfee or TEA?'],
      ['How was your weekend?', 'How was your WEEKend?'], ["It's black, not brown.", "It's BLACK, not BROWN."], ['Is it today or tomorrow?', 'Is it toDAY or toMORrow?']]
      .forEach(([t, want]) => { if (IN.caps(t) !== want) w(`규칙 "${t}": ${IN.caps(t)} ≠ ${want}`); });
    [['Are you ready?', 'rise'], ['Where are you going?', 'fall'], ["It's raining?", 'high'], ['Coffee or tea?', 'alt1,fall'], ['I said Tuesday, not Monday.', 'fall,post']]
      .forEach(([t, want]) => { const got = IN.phrases(t, { focus: IN.focusOf(t) }).map(p => p.tone).join(); if (got !== want) w(`규칙 "${t}": ${got} ≠ ${want}`); });
    warn.forEach(m => console.warn('[IN.check] ' + m));
    return warn.length;
  };
})();
