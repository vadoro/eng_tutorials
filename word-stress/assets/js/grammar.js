/* 센 음절은 하나 — 낱말 강세와 슈와: 규칙 엔진 (WS)
 * 낱말마다 넓은 IPA를 음절로 나눠(.) 손으로 적고(센 음절 ˈ · 버금 강세 ˌ), 철자도 같은 수의 조각으로 나눠 적었어요.
 * 엔진은 이 두 가지에서 음절 수 · 센 음절의 자리 · 약한 모음(슈와 ə · ɚ) · 강세 모양(oOo) · 대문자 표기(baNAna) ·
 * 한국어 표기의 음절 수 · 강세로 갈리는 짝 · 낱말 가족에서 옮겨 가는 센 음절과 바뀌는 모음 · 문장 속 칠하기를 계산해요.
 * 손으로 적은 강세 자리는 misaki 미국 발음 사전과 따로 맞춰 봤어요(README).
 * 소리를 듣지 않아요 — 음절 공의 크기 · 높이는 미리 만든 음성 파일을 따로 재서(audio/dialogue/measure.js) 그려요.
 */
(function () {
  'use strict';
  const WS = (window.WS = {});

  /* ---------- 소리 단위 ---------- */
  const VOW = ['aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'i', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ə', 'ɚ', 'ɝ', 'ɑ', 'ɔ', 'ʊ', 'u'];
  const CON = ['tʃ', 'dʒ', 'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j'];
  const UNITS = VOW.concat(CON).sort((a, b) => b.length - a.length);
  const isV = p => VOW.indexOf(p) >= 0;
  function phones(s) {
    s = String(s).replace(/[ˈˌ.]/g, '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const u = UNITS.find(x => s.startsWith(x, i));
      if (!u) throw new Error(`[WS] 모르는 소리 ${s[i]} (${s})`);
      out.push(u); i += u.length;
    }
    return out;
  }
  WS.phones = phones;
  const SCHWA = ['ə', 'ɚ'];
  WS.SCHWA = SCHWA;

  /* ---------- 발음 사전 ----------
     낱말(열쇠)|철자 조각|IPA 음절|한국어 표기|뜻|묶음
     열쇠에 :n · :v가 붙으면 같은 철자의 명사 · 동사(그 낱말만으로는 소리를 정할 수 없어 문장으로 들려줘요)
     묶음: loan 외래어 · pair 강세로 갈리는 짝 · schwa 약한 모음 · fam 낱말 가족 · num 숫자 */
  const DICT_SRC = `banana|ba.na.na|bə.ˈnæ.nə|바나나|바나나|loan
tomato|to.ma.to|tə.ˈmeɪ.toʊ|토마토|토마토|loan
computer|com.pu.ter|kəm.ˈpju.tɚ|컴퓨터|컴퓨터|loan
idea|i.de.a|aɪ.ˈdi.ə|아이디어|생각|loan
vitamin|vi.ta.min|ˈvaɪ.tə.mɪn|비타민|비타민|loan
internet|in.ter.net|ˈɪn.tɚ.ˌnɛt|인터넷|인터넷|loan
energy|en.er.gy|ˈɛ.nɚ.dʒi|에너지|에너지|loan
marketing|mar.ke.ting|ˈmɑr.kə.tɪŋ|마케팅|마케팅|loan
hotel|ho.tel|hoʊ.ˈtɛl|호텔|호텔|loan
guitar|gui.tar|gə.ˈtɑr|기타|기타|loan
design|de.sign|dɪ.ˈzaɪn|디자인|디자인|loan
violin|vi.o.lin|ˌvaɪ.ə.ˈlɪn|바이올린|바이올린|loan
chocolate|choc.olate|ˈtʃɑk.lət|초콜릿|초콜릿|loan
business|busi.ness|ˈbɪz.nəs|비즈니스|일 · 사업|loan
family|fam.ily|ˈfæm.li|패밀리|가족|loan
orange|or.ange|ˈɔr.ɪndʒ|오렌지|오렌지|loan
America|A.mer.i.ca|ə.ˈmɛ.rə.kə|아메리카|아메리카|loan
Korea|Ko.re.a|kə.ˈri.ə|코리아|한국|loan
technology|tech.nol.o.gy|tɛk.ˈnɑ.lə.dʒi|테크놀로지|기술|loan
elevator|el.e.va.tor|ˈɛ.lə.ˌveɪ.tɚ|엘리베이터|엘리베이터|loan
piano|pi.an.o|pi.ˈæ.noʊ|피아노|피아노|loan
percent|per.cent|pɚ.ˈsɛnt|퍼센트|퍼센트|loan
event|e.vent|ɪ.ˈvɛnt|이벤트|행사|loan
calendar|cal.en.dar|ˈkæ.lən.dɚ|캘린더|달력|loan
coffee|cof.fee|ˈkɔ.fi|커피|커피|loan
image|im.age|ˈɪ.mɪdʒ|이미지|이미지 · 그림|loan
station|sta.tion|ˈsteɪ.ʃən|스테이션|역|loan
about|a.bout|ə.ˈbaʊt||~에 대해 · 약|schwa
today|to.day|tə.ˈdeɪ||오늘|schwa
tomorrow|to.mor.row|tə.ˈmɑ.roʊ||내일|schwa
pencil|pen.cil|ˈpɛn.səl||연필|schwa
support|sup.port|sə.ˈpɔrt||지지 · 지원|schwa
sofa|so.fa|ˈsoʊ.fə||소파|schwa
problem|prob.lem|ˈprɑb.ləm||문제|schwa
Canada|Ca.na.da|ˈkæ.nə.də|캐나다|캐나다|fam
Canadian|Ca.na.di.an|kə.ˈneɪ.di.ən|캐나디언|캐나다 사람|fam
photograph|pho.to.graph|ˈfoʊ.tə.ˌgræf|포토그래프|사진|fam
photographer|pho.tog.ra.pher|fə.ˈtɑ.grə.fɚ|포토그래퍼|사진가|fam
photographic|pho.to.graph.ic|ˌfoʊ.tə.ˈgræ.fɪk|포토그래픽|사진의|fam
economy|e.con.o.my|ɪ.ˈkɑ.nə.mi|이코노미|경제|fam
economic|e.co.nom.ic|ˌɛ.kə.ˈnɑ.mɪk|이코노믹|경제의|fam
Japan|Ja.pan|dʒə.ˈpæn|재팬|일본|fam
Japanese|Ja.pa.nese|ˌdʒæ.pə.ˈniz|재패니즈|일본어 · 일본 사람|fam
desert|des.ert|ˈdɛ.zɚt||사막|pair
dessert|des.sert|dɪ.ˈzɝt|디저트|후식|pair
human|hu.man|ˈhju.mən|휴먼|사람|pair
humane|hu.mane|hju.ˈmeɪn||인정 있는|pair
personal|per.son.al|ˈpɝ.sə.nəl|퍼스널|개인의|pair
personnel|per.son.nel|ˌpɝ.sə.ˈnɛl||직원들 · 인사과|pair
insight|in.sight|ˈɪn.ˌsaɪt|인사이트|통찰|pair
incite|in.cite|ɪn.ˈsaɪt||부추기다|pair
thirteen|thir.teen|ˌθɝ.ˈtin||13 · 열셋|num
thirty|thir.ty|ˈθɝ.ti||30 · 서른|num
fourteen|four.teen|ˌfɔr.ˈtin||14 · 열넷|num
forty|for.ty|ˈfɔr.ti||40 · 마흔|num
fifteen|fif.teen|ˌfɪf.ˈtin||15 · 열다섯|num
fifty|fif.ty|ˈfɪf.ti||50 · 쉰|num
sixteen|six.teen|ˌsɪk.ˈstin||16 · 열여섯|num
sixty|six.ty|ˈsɪk.sti||60 · 예순|num
seventeen|sev.en.teen|ˌsɛ.vən.ˈtin||17 · 열일곱|num
seventy|sev.en.ty|ˈsɛ.vən.ti||70 · 일흔|num
eighteen|eigh.teen|ˌeɪ.ˈtin||18 · 열여덟|num
eighty|eigh.ty|ˈeɪ.ti||80 · 여든|num
nineteen|nine.teen|ˌnaɪn.ˈtin||19 · 열아홉|num
ninety|nine.ty|ˈnaɪn.ti||90 · 아흔|num
record:n|rec.ord|ˈrɛ.kɚd|레코드|기록 · 음반 (명사)|pair
record:v|re.cord|rɪ.ˈkɔrd||기록하다 · 녹음하다 (동사)|pair
present:n|pres.ent|ˈprɛ.zənt||선물 (명사)|pair
present:v|pre.sent|prɪ.ˈzɛnt||주다 · 발표하다 (동사)|pair
object:n|ob.ject|ˈɑb.dʒɪkt|오브젝트|물건 (명사)|pair
object:v|ob.ject|əb.ˈdʒɛkt||반대하다 (동사)|pair
increase:n|in.crease|ˈɪn.ˌkris||증가 (명사)|pair
increase:v|in.crease|ɪn.ˈkris||늘다 · 늘리다 (동사)|pair`;

  const DICT = {}, LOWER = {};
  DICT_SRC.split('\n').forEach(line => {
    const [key, spell, ipa, ko, gloss, grp] = line.trim().split('|');
    const w = key.split(':')[0];
    const sp = spell.split('.'), ip = ipa.split('.');
    const syl = ip.map((s, i) => {
      const st = s[0] === 'ˈ' ? 1 : s[0] === 'ˌ' ? 2 : 0;
      const ph = phones(s), v = ph.filter(isV);
      return { sp: sp[i] || '', ipa: s.replace(/[ˈˌ]/g, ''), st, v: v[0] || '', nv: v.length, schwa: st === 0 && SCHWA.indexOf(v[0]) >= 0 };
    });
    DICT[key] = { key, w, spell: sp, ipa, ko: ko || '', gloss, grp, syl, homo: key.indexOf(':') > 0 };
    if (!DICT[key].homo) LOWER[w.toLowerCase()] = key;
  });
  WS.DICT = DICT;
  const entry = k => DICT[k] || DICT[LOWER[String(k).toLowerCase()]] || null;
  WS.entry = entry;
  WS.word = k => (entry(k) || { w: k }).w;
  WS.ipa = k => { const e = entry(k); return e ? '/' + e.ipa.replace(/\./g, '') + '/' : ''; };
  WS.ipaDots = k => { const e = entry(k); return e ? '/' + e.ipa + '/' : ''; };
  WS.syls = k => (entry(k) || { syl: [] }).syl;
  WS.nSyl = k => WS.syls(k).length;
  WS.stressAt = k => WS.syls(k).findIndex(s => s.st === 1);
  WS.pattern = k => WS.syls(k).map(s => s.st === 1 ? 'O' : 'o').join('');
  WS.weakIdx = k => WS.syls(k).map((s, i) => s.schwa ? i : -1).filter(i => i >= 0);
  // 대문자 표기: 고른 음절만 대문자 (o.dots면 음절 사이에 ·)
  WS.caps = (k, at, o = {}) => {
    const e = entry(k); if (!e) return String(k);
    if (at == null) at = WS.stressAt(k);
    return e.spell.map((s, i) => i === at ? s.toUpperCase() : s.toLowerCase()).join(o.dots ? '·' : '');
  };
  WS.dotted = k => { const e = entry(k); return e ? e.spell.join('·') : String(k); };
  // 한국어 표기의 음절 수 (한글 글자 수)
  WS.koSyl = k => { const e = entry(k); return e && e.ko ? [...e.ko].filter(c => /[가-힣]/.test(c)).length : 0; };
  // 한 철자 조각 안의 모음 글자 자리 (슈와를 적은 글자 칠하기)
  WS.vowelLetters = s => { const out = []; [...s].forEach((c, i) => { if (/[aeiouy]/i.test(c)) out.push(i); }); return out; };
  // 센 음절의 자리 (놀이터 기록 · 힌트)
  const SPOS = { first: { ko: '첫음절', long: '첫음절이 세요' }, second: { ko: '둘째 음절', long: '둘째 음절이 세요' }, third: { ko: '셋째 음절 뒤', long: '셋째 음절이나 그 뒤가 세요' } };
  WS.SPOS = SPOS;
  WS.SPOS_ORDER = ['first', 'second', 'third'];
  WS.sposOf = k => { const i = WS.stressAt(k); return i <= 0 ? 'first' : i === 1 ? 'second' : 'third'; };
  const ORD = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
  WS.ord = i => ORD[i] || `${i + 1}째`;
  WS.ordSyl = (i, n) => i === 0 ? '첫음절' : n >= 3 && i === n - 1 ? '마지막 음절' : `${ORD[i]} 음절`;
  const NUMKO = ['', '한', '두', '세', '네', '다섯', '여섯'];
  WS.nKo = n => NUMKO[n] || String(n);

  // 음절 공의 그림용 기본값 (잰 값이 없을 때): L 길이 · A 크기 · H 높이(반음)
  WS.schematic = k => WS.syls(k).map((s, i, a) => s.st === 1 ? { L: 1, A: 1, H: 5 } : s.st === 2 ? { L: 0.75, A: 0.8, H: 2 } : i === a.length - 1 ? { L: 0.62, A: 0.5, H: -1 } : { L: 0.5, A: 0.58, H: 0.5 });
  WS.koSchematic = n => Array.from({ length: n }, () => ({ L: 0.92, A: 0.9, H: 1 }));

  /* ---------- 목소리 넷 (듣고 가르기 훈련 · 연습 문제) ---------- */
  WS.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '미국 여성' },
    { sp: 'tf', ko: '차분한 선생님', who: '미국 여성' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];

  /* ---------- 강세로 갈리는 짝 ----------
     a = 앞이 센 쪽(노랑) · b = 뒤가 센 쪽(하늘). kind: word 다른 낱말 · num 숫자 · pos 같은 철자의 명사 · 동사 */
  const PAIR_SRC = [
    ['desert', 'dessert', 'word'], ['thirty', 'thirteen', 'num'], ['forty', 'fourteen', 'num'], ['fifty', 'fifteen', 'num'],
    ['sixty', 'sixteen', 'num'], ['seventy', 'seventeen', 'num'], ['eighty', 'eighteen', 'num'], ['ninety', 'nineteen', 'num'],
    ['human', 'humane', 'word'], ['personal', 'personnel', 'word'], ['insight', 'incite', 'word'],
    ['record:n', 'record:v', 'pos'], ['present:n', 'present:v', 'pos'], ['object:n', 'object:v', 'pos'], ['increase:n', 'increase:v', 'pos'],
  ];
  WS.PAIRS = PAIR_SRC.map(([a, b, kind]) => ({ id: WS.word(a).toLowerCase() + '-' + WS.word(b).toLowerCase() + (kind === 'pos' ? '' : ''), a, b, kind }));
  WS.PAIRS.forEach(p => { if (p.kind === 'pos') p.id = WS.word(p.a).toLowerCase(); });
  WS.PAIR_KIND = { word: '다른 낱말', num: '숫자', pos: '명사 · 동사' };
  WS.pairOf = k => WS.PAIRS.find(p => p.a === k || p.b === k) || null;
  WS.partner = k => { const p = WS.pairOf(k); return p ? (p.a === k ? p.b : p.a) : null; };
  // 같은 철자의 명사 · 동사는 문장으로 들려줘요
  WS.HOMO_SENT = {
    'record:n': ['She broke the world record.', '그녀가 세계 기록을 깼어요.'],
    'record:v': ['Can I record your answer?', '대답을 녹음해도 될까요?'],
    'present:n': ['This is a present for you.', '이건 당신에게 주는 선물이에요.'],
    'present:v': ['We will present our project.', '우리 프로젝트를 발표할 거예요.'],
    'object:n': ['What is that strange object?', '저 이상한 물건은 뭐예요?'],
    'object:v': ['Does anyone object?', '반대하는 사람 있나요?'],
    'increase:n': ['There was a big increase in sales.', '판매가 크게 늘었어요.'],
    'increase:v': ['Prices will increase next year.', '내년에 값이 오를 거예요.'],
  };
  // 들려줄 글: 같은 철자의 명사 · 동사는 예문, 나머지는 낱말
  WS.sayText = k => { const e = entry(k); return e && e.homo ? WS.HOMO_SENT[e.key][0] : WS.word(k); };

  /* ---------- 낱말 가족: 끝이 붙으면 센 음절이 옮겨 가요 ---------- */
  WS.FAMS = [
    { id: 'canada', words: ['Canada', 'Canadian'] },
    { id: 'photo', words: ['photograph', 'photographer', 'photographic'] },
    { id: 'econ', words: ['economy', 'economic'] },
    { id: 'japan', words: ['Japan', 'Japanese'] },
  ];
  // 두 낱말에서 같은 철자 조각인데 모음이 다른 곳 (강세가 옮겨 가며 바뀐 모음)
  WS.vowelShift = (a, b) => {
    const A = WS.syls(a), B = WS.syls(b), out = [];
    for (let i = 0; i < Math.min(A.length, B.length); i++) {
      if (A[i].sp.toLowerCase() !== B[i].sp.toLowerCase()) continue;
      if (A[i].v !== B[i].v) out.push({ i, sp: A[i].sp, va: A[i].v, vb: B[i].v, sa: A[i].st, sb: B[i].st });
    }
    return out;
  };

  /* ---------- 외래어 카드 열여섯 ---------- */
  const LOAN_ROWS = [
    ['second', '둘째 음절이 세요', ['banana', 'tomato', 'computer', 'idea']],
    ['first', '첫음절이 세요', ['vitamin', 'internet', 'energy', 'marketing']],
    ['last', '마지막 음절이 세요', ['hotel', 'guitar', 'design', 'violin']],
    ['drop', '약한 음절이 줄어요', ['chocolate', 'business', 'family', 'orange']],
  ];
  WS.LROWS = LOAN_ROWS.map(([id, ko, words]) => ({ id, ko, words }));
  WS.LOAN = [];
  WS.LROWS.forEach(r => r.words.forEach(w => WS.LOAN.push({ w, row: r.id })));
  WS.loanNote = k => {
    const n = WS.nSyl(k), m = WS.koSyl(k), at = WS.stressAt(k);
    return `한국어식 ${m}음절 → 영어 ${n}음절 · ${WS.ordSyl(at, n)}이 세요`;
  };

  /* ---------- 약한 모음(슈와) 예: 철자는 달라도 같은 흐린 어 ---------- */
  WS.SCHWA_EX = ['about', 'today', 'pencil', 'support', 'sofa', 'problem', 'Canada', 'banana'];
  // 낱말 속 슈와를 적은 글자: [{ i: 음절, at: [글자 자리] }]
  WS.schwaLetters = k => WS.syls(k).map((s, i) => s.schwa ? { i, at: WS.vowelLetters(s.sp).slice(0, 1) } : null).filter(Boolean);

  /* ---------- 문장 속에서: 사전에 있는 낱말의 음절을 칠해요 ----------
     segs(text, keys) → [{ t, role: 'str' | 'weak' | null, w: 낱말 열쇠, i: 음절 }]
     keys: 같은 철자의 명사 · 동사를 가르는 표 { record: 'record:v' } */
  WS.segs = function (text, keys) {
    const out = [];
    String(text).split(/([A-Za-z]+(?:['’][A-Za-z]+)?)/).forEach(tok => {
      if (!tok) return;
      const low = tok.toLowerCase(), k = (keys && keys[low]) || LOWER[low];
      const e = k ? DICT[k] : null;
      if (!e || e.spell.join('').toLowerCase() !== low) { out.push({ t: tok, role: null }); return; }
      let at = 0;
      e.syl.forEach((s, i) => {
        const t = tok.slice(at, at + s.sp.length); at += s.sp.length;
        out.push({ t, role: s.st === 1 ? 'str' : s.schwa ? 'weak' : null, w: e.key, i });
      });
    });
    return out;
  };
  WS.wordsIn = (text, keys) => { const seen = []; WS.segs(text, keys).forEach(s => { if (s.w && seen.indexOf(s.w) < 0) seen.push(s.w); }); return seen; };

  /* ---------- 따라 말하기 28문장 (묶음마다 일곱) ---------- */
  WS.SGRP = {
    loan: { ko: '외래어', long: '외래어 — 한국어처럼 고르게 읽지 않기' },
    pair: { ko: '강세로 갈리는 짝', long: '강세로 갈리는 짝 — 숫자 · 사막과 후식' },
    schwa: { ko: '약한 모음', long: '약한 모음 — 짧고 흐린 어' },
    shift: { ko: '옮겨 가는 강세', long: '옮겨 가는 강세 — 낱말 가족 · 명사와 동사' },
  };
  WS.SGRP_ORDER = ['loan', 'pair', 'schwa', 'shift'];
  WS.SENT = [
    { grp: 'loan', en: "I'd like a banana, please.", ko: '바나나 하나 주세요.' },
    { grp: 'loan', en: 'The hotel is next to the station.', ko: '호텔은 역 바로 옆에 있어요.' },
    { grp: 'loan', en: 'I take a vitamin every morning.', ko: '아침마다 비타민을 먹어요.' },
    { grp: 'loan', en: 'My computer is too slow.', ko: '제 컴퓨터는 너무 느려요.' },
    { grp: 'loan', en: "That's a great idea!", ko: '좋은 생각이에요!' },
    { grp: 'loan', en: 'She plays the guitar and the violin.', ko: '그녀는 기타와 바이올린을 연주해요.' },
    { grp: 'loan', en: 'Can I have some chocolate?', ko: '초콜릿 좀 먹어도 될까요?' },
    { grp: 'pair', en: "It's fifteen dollars, not fifty.", ko: '15달러예요, 50달러가 아니에요.' },
    { grp: 'pair', en: 'The bus leaves in thirteen minutes.', ko: '버스는 13분 뒤에 떠나요.' },
    { grp: 'pair', en: 'My grandmother is ninety years old.', ko: '할머니는 아흔 살이에요.' },
    { grp: 'pair', en: 'We had ice cream for dessert.', ko: '후식으로 아이스크림을 먹었어요.' },
    { grp: 'pair', en: 'The camel walked across the desert.', ko: '낙타가 사막을 가로질러 걸었어요.' },
    { grp: 'pair', en: 'Please turn to page sixteen.', ko: '16쪽을 펴 주세요.' },
    { grp: 'pair', en: 'There are eighteen students in my class.', ko: '우리 반에는 학생이 열여덟 명 있어요.' },
    { grp: 'schwa', en: 'What are you talking about?', ko: '무슨 얘기를 하는 거예요?' },
    { grp: 'schwa', en: 'Can I borrow a pencil?', ko: '연필 하나 빌려도 될까요?' },
    { grp: 'schwa', en: 'Thank you for your support.', ko: '도와주셔서 고마워요.' },
    { grp: 'schwa', en: 'Is there a problem?', ko: '무슨 문제 있어요?' },
    { grp: 'schwa', en: 'I visited Canada last summer.', ko: '지난여름에 캐나다에 갔어요.' },
    { grp: 'schwa', en: "Let's sit on the sofa.", ko: '소파에 앉아요.' },
    { grp: 'schwa', en: 'See you tomorrow!', ko: '내일 봐요!' },
    { grp: 'shift', en: 'Can I record your answer?', ko: '대답을 녹음해도 될까요?', keys: { record: 'record:v' } },
    { grp: 'shift', en: 'She broke the world record.', ko: '그녀가 세계 기록을 깼어요.', keys: { record: 'record:n' } },
    { grp: 'shift', en: 'He took a photograph of the lake.', ko: '그는 호수 사진을 찍었어요.' },
    { grp: 'shift', en: 'My sister is a photographer.', ko: '언니는 사진가예요.' },
    { grp: 'shift', en: "I'm studying Japanese.", ko: '일본어를 공부하고 있어요.' },
    { grp: 'shift', en: 'The economy is growing.', ko: '경제가 커지고 있어요.' },
    { grp: 'shift', en: 'This is a present for you.', ko: '이건 당신에게 주는 선물이에요.', keys: { present: 'present:n' } },
  ];

  /* ---------- 음성 인식: 들은 말이 목표 낱말인가, 짝 낱말인가 ----------
     인식기는 숫자를 숫자로 적기도 해요(13) — 낱말로 바꿔 견줘요 */
  const NUMW = { 13: 'thirteen', 30: 'thirty', 14: 'fourteen', 40: 'forty', 15: 'fifteen', 50: 'fifty', 16: 'sixteen', 60: 'sixty', 17: 'seventeen', 70: 'seventy', 18: 'eighteen', 80: 'eighty', 19: 'nineteen', 90: 'ninety' };
  const SAME = { insight: ['in sight'], incite: ['in site', 'in sight'] };
  const words = s => String(s || '').toLowerCase().replace(/\b(\d+)\b/g, (m, d) => NUMW[d] || d).replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const has = (text, w) => { const ws = words(text), t = WS.word(w).toLowerCase(); return ws.indexOf(t) >= 0 && !(t === 'personal' && ws.indexOf('personnel') >= 0); };
  WS.heard = function (target, alts) {
    const partner = WS.partner(target);
    alts = (alts || []).filter(Boolean);
    if (!alts.length) return { verdict: 'none', heard: '' };
    const top = alts[0];
    if (has(top, target)) return { verdict: 'target', heard: top, partner };
    if (partner && has(top, partner)) return { verdict: 'partner', heard: top, partner };
    const k = alts.findIndex(a => has(a, target));
    if (k > 0) return { verdict: 'maybe', heard: top, rank: k + 1, partner };
    return { verdict: 'other', heard: top, partner };
  };
  WS.HEARD_KO = {
    target: '목표 낱말로 들었어요',
    partner: '짝 낱말로 들었어요',
    maybe: '첫째 후보는 아니지만 후보에 있었어요',
    other: '다른 낱말로 들었어요',
    none: '아무 말도 듣지 못했어요',
  };
  // 내 발음 확인에 쓰는 짝: 철자가 다른 짝만(같은 철자의 명사 · 동사는 인식기가 같은 글로 적어서)
  WS.MP_PAIRS = WS.PAIRS.filter(p => p.kind !== 'pos');

  /* ---------- 따라 말하기: 낱말 맞추기 ---------- */
  const norm = w => w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '');
  WS.compareWords = function (target, heard) {
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
     kind: stress(센 음절은 어디?) · pair(어느 낱말?) · count(몇 음절?) · sent(문장 속 어느 숫자?)
     a: 정답 보기 번호(0부터) — 엔진이 다시 계산해 맞춰 봐요 */
  const COUNT_OPTS = ['두 음절', '세 음절', '네 음절'];
  WS.COUNT_OPTS = COUNT_OPTS;
  WS.DRILL = [
    { kind: 'stress', sp: 'tc', w: 'banana', a: 1 },
    { kind: 'pair', sp: 'uf', say: 'dessert', opts: ['desert', 'dessert'], a: 1 },
    { kind: 'count', sp: 'um', say: 'hotel', a: 0 },
    { kind: 'stress', sp: 'tf', w: 'vitamin', a: 0 },
    { kind: 'sent', sp: 'tc', say: 'The bus leaves in thirty minutes.', frame: 'The bus leaves in ___ minutes.', opts: ['thirty', 'thirteen'], a: 0, ko: '버스는 30분 뒤에 떠나요.' },
    { kind: 'stress', sp: 'tf', w: 'personnel', a: 2 },
    { kind: 'pair', sp: 'tc', say: 'human', opts: ['human', 'humane'], a: 0 },
    { kind: 'count', sp: 'uf', say: 'America', a: 2 },
    { kind: 'stress', sp: 'um', w: 'computer', a: 1 },
    { kind: 'sent', sp: 'tf', say: "It's fifteen dollars.", frame: "It's ___ dollars.", opts: ['fifty', 'fifteen'], a: 1, ko: '15달러예요.' },
    { kind: 'stress', sp: 'uf', w: 'internet', a: 0 },
    { kind: 'count', sp: 'tc', say: 'idea', a: 1 },
    { kind: 'pair', sp: 'tf', say: 'eighteen', opts: ['eighty', 'eighteen'], a: 1 },
    { kind: 'stress', sp: 'tc', w: 'guitar', a: 1 },
    { kind: 'sent', sp: 'um', say: 'Please turn to page sixty.', frame: 'Please turn to page ___.', opts: ['sixty', 'sixteen'], a: 0, ko: '60쪽을 펴 주세요.' },
    { kind: 'count', sp: 'tf', say: 'technology', a: 2 },
  ];
  WS.DRILL.forEach(q => {
    if (q.kind === 'stress') { q.say = q.w; q.opts = WS.syls(q.w).map((_, i) => WS.caps(q.w, i, { dots: true })); }
    if (q.kind === 'count') q.opts = COUNT_OPTS.slice();
  });
  WS.drillWord = q => q.kind === 'stress' ? q.w : q.kind === 'count' ? q.say : q.opts[q.a];
  WS.drillWords = q => q.kind === 'pair' || q.kind === 'sent' ? q.opts.slice() : [WS.drillWord(q)];
  // 힌트 = 3단계 발음법
  WS.hints = function (q) {
    if (q.kind === 'stress') {
      const n = WS.nSyl(q.w), at = WS.stressAt(q.w), same = Object.values(DICT).filter(e => !e.homo && e.key !== q.w && e.syl.length === n && WS.stressAt(e.key) === at).slice(0, 3).map(e => e.w);
      return [
        { head: '① 듣고 가르기', text: `${n}음절이에요. 가장 길고 높게 끌리는 음절 하나를 찾아요. 나머지는 짧고 흐리게 지나가요.` },
        { head: '② 소리 내 보기', text: `보기를 하나씩 소리 내어 그 음절만 길고 높게 말해 보고, 들은 소리와 같은 쪽을 골라요.` },
        { head: '③ 낱말 속에서', text: `한국어식(${WS.entry(q.w).ko || '철자대로'})으로 고르게 읽던 습관은 잊어요.${same.length ? ` 센 음절의 자리가 같은 낱말 → ${same.join(' · ')}.` : ''}` },
      ];
    }
    if (q.kind === 'count') {
      const e = entry(q.say), n = WS.nSyl(q.say), m = WS.koSyl(q.say);
      return [
        { head: '① 듣고 가르기', text: '손뼉을 치며 음절마다 한 번씩 세어 봐요. 센 음절 하나는 크게, 나머지는 작게 쳐요.' },
        { head: '② 소리 내 보기', text: '약한 음절은 아주 짧아도 음절 하나예요. 흐린 어 소리 하나하나를 빠뜨리지 말고 세요.' },
        { head: '③ 낱말 속에서', text: m ? `한국어 표기(${e.ko})는 ${m}음절이에요. 영어 음절 수와 다를 수 있어요.` : `철자의 모음 글자 수와 음절 수는 다를 수 있어요.` },
      ];
    }
    const [x, y] = q.opts, ax = WS.stressAt(x), ay = WS.stressAt(y);
    const num = WS.pairOf(x) && WS.pairOf(x).kind === 'num';
    return [
      { head: '① 듣고 가르기', text: num ? '숫자의 끝을 들어요. 끝이 길고 높게 끌리나요, 짧게 내려가나요?' : `어느 음절이 길고 높게 들렸나요? ${x} → ${WS.ordSyl(ax)}, ${y} → ${WS.ordSyl(ay)}.` },
      { head: '② 소리 내 보기', text: num ? 'teen 쪽은 끝 음절을 길고 높게 끌고 n으로 닫아요. 앞이 센 쪽은 끝을 짧게 내려요.' : `센 음절이 바뀌면 모음도 바뀌어요 → ${WS.ipa(x)} · ${WS.ipa(y)}.` },
      { head: '③ 낱말 속에서', text: `앞이 센 쪽 → ${WS.word(WS.pairOf(x).a)} · 뒤가 센 쪽 → ${WS.word(WS.pairOf(x).b)}.` },
    ];
  };

  /* ---------- 캔버스 글자 모음 (글꼴 미리 받기) ---------- */
  WS.allText = () => Object.values(DICT).map(e => e.w + e.spell.join('·').toUpperCase() + e.spell.join('·') + e.ipa + e.ko + e.gloss).join('') +
    WS.SENT.map(s => s.en + s.ko).join('') + Object.values(WS.SGRP).map(g => g.ko + g.long).join('') +
    WS.LROWS.map(r => r.ko).join('') + Object.values(SPOS).map(p => p.ko + p.long).join('') + WS.VOICES.map(v => v.ko + v.who).join('') +
    Object.values(WS.HOMO_SENT).map(s => s.join('')).join('') + COUNT_OPTS.join('') + ORD.join('');

  /* ---------- 데이터 점검 ---------- */
  WS.check = function () {
    const warn = [];
    const w = m => warn.push(m);
    Object.values(DICT).forEach(e => {
      if (e.spell.length !== e.syl.length) w(`${e.key}: 철자 조각 ${e.spell.length}개 ≠ 음절 ${e.syl.length}개`);
      if (e.spell.join('').toLowerCase() !== e.w.toLowerCase()) w(`${e.key}: 철자 조각을 이으면 ${e.spell.join('')}`);
      if (e.syl.filter(s => s.st === 1).length !== 1) w(`${e.key}: 센 음절이 하나가 아님`);
      e.syl.forEach((s, i) => { if (s.nv !== 1) w(`${e.key}: ${i + 1}째 음절의 모음이 ${s.nv}개`); });
    });
    // 짝: 음절 수가 같고, 앞이 센 쪽이 정말 앞
    WS.PAIRS.forEach(p => {
      if (!entry(p.a) || !entry(p.b)) { w(`짝 ${p.id}: 사전에 없음`); return; }
      if (WS.nSyl(p.a) !== WS.nSyl(p.b)) w(`짝 ${p.id}: 음절 수가 다름`);
      if (!(WS.stressAt(p.a) < WS.stressAt(p.b))) w(`짝 ${p.id}: 센 음절 자리가 앞 → 뒤가 아님`);
      if (p.kind === 'pos' && WS.word(p.a) !== WS.word(p.b)) w(`짝 ${p.id}: 명사 · 동사의 철자가 다름`);
      if (p.kind === 'pos') [p.a, p.b].forEach(k => { const s = WS.HOMO_SENT[k]; if (!s || WS.wordsIn(s[0], { [WS.word(k)]: k }).indexOf(k) < 0) w(`짝 ${p.id}: ${k}의 예문`); });
    });
    // 낱말 가족: 센 음절이 옮겨 감
    WS.FAMS.forEach(f => { const at = f.words.map(WS.stressAt); if (new Set(at).size !== at.length) w(`낱말 가족 ${f.id}: 센 음절 자리가 겹침 ${at.join()}`); });
    if (!WS.vowelShift('Canada', 'Canadian').some(x => x.va === 'æ' && x.vb === 'ə')) w('Canada → Canadian: 첫 a의 모음 바뀜을 찾지 못함');
    // 외래어 줄
    WS.LOAN.forEach(o => {
      const n = WS.nSyl(o.w), at = WS.stressAt(o.w);
      if (o.row === 'first' && at !== 0) w(`외래어 ${o.w}: 첫음절이 아님`);
      if (o.row === 'second' && at !== 1) w(`외래어 ${o.w}: 둘째 음절이 아님`);
      if (o.row === 'last' && at !== n - 1) w(`외래어 ${o.w}: 마지막 음절이 아님`);
      if (o.row === 'drop' && !(WS.koSyl(o.w) > n)) w(`외래어 ${o.w}: 한국어식 음절이 더 많지 않음`);
      if (!entry(o.w).ko) w(`외래어 ${o.w}: 한국어 표기 없음`);
    });
    // 슈와 예: 적어도 하나
    WS.SCHWA_EX.forEach(k => { if (!WS.schwaLetters(k).length) w(`슈와 예 ${k}: 슈와 음절이 없음`); });
    // 문장: 칠할 낱말이 하나 이상, 같은 철자의 명사 · 동사는 keys로
    WS.SENT.forEach((s, i) => {
      if (!WS.wordsIn(s.en, s.keys).length) w(`문장 ${i + 1}: 사전에 있는 낱말이 없음`);
      ['record', 'present', 'object', 'increase'].forEach(h => { if (new RegExp('\\b' + h + '\\b', 'i').test(s.en) && !(s.keys && s.keys[h])) w(`문장 ${i + 1}: ${h}의 품사(keys)`); });
    });
    const grp = {}; WS.SENT.forEach(s => { grp[s.grp] = (grp[s.grp] || 0) + 1; });
    WS.SGRP_ORDER.forEach(g => { if (grp[g] !== 7) w(`문장 묶음 ${g}: ${grp[g] || 0}개`); });
    // 연습 문제: 엔진의 정답과 같은지, 정답 위치
    const pos = {};
    WS.DRILL.forEach((q, k) => {
      const n = q.opts.length;
      pos[n] = pos[n] || Array(n).fill(0); pos[n][q.a]++;
      if (q.kind === 'stress' && q.a !== WS.stressAt(q.w)) w(`연습 ${k + 1}: 센 음절 ${q.a} ≠ 엔진 ${WS.stressAt(q.w)}`);
      if (q.kind === 'count' && q.a !== WS.nSyl(q.say) - 2) w(`연습 ${k + 1}: 음절 수 ${q.a + 2} ≠ 엔진 ${WS.nSyl(q.say)}`);
      if (q.kind === 'pair') { if (q.opts[q.a] !== q.say) w(`연습 ${k + 1}: 정답 ≠ 들려주는 낱말`); if (WS.partner(q.opts[0]) !== q.opts[1]) w(`연습 ${k + 1}: 보기가 짝이 아님`); }
      if (q.kind === 'sent') { if (q.frame.replace('___', q.opts[q.a]) !== q.say) w(`연습 ${k + 1}: 문장과 정답이 맞지 않음`); if (WS.partner(q.opts[0]) !== q.opts[1]) w(`연습 ${k + 1}: 보기가 짝이 아님`); }
      if (['tc', 'tf', 'uf', 'um'].indexOf(q.sp) < 0) w(`연습 ${k + 1}: 목소리 ${q.sp}`);
    });
    Object.keys(pos).forEach(n => { const p = pos[n]; if (Math.max(...p) - Math.min(...p) > 1) w(`보기 ${n}개 문제의 정답 위치가 한쪽으로 몰림: ${p.join(' / ')}`); });
    // 입 그림: 슈와는 혀와 턱이 가운데
    if (window.EN && EN.mouth) {
      const P = EN.mouth.pose;
      if (!(P('schwa').jaw > P('i').jaw && P('schwa').jaw < P('a').jaw)) w('입 그림 schwa: 턱이 i와 a 사이가 아님');
    }
    warn.forEach(m => console.warn('[WS.check] ' + m));
    return warn.length;
  };
})();
