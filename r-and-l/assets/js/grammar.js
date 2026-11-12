/* r · l, 혀끝이 닿느냐 마느냐 — 규칙 엔진 (RL)
 *
 * 맞고 틀림과 그림의 바탕은 모두 여기서 계산해요. 영상 · 직접 해 보기 · 놀이터 · 연습 문제 · 퀴즈가 같은 결과를 써요.
 *   발음 사전(미국 표준 발음 General American의 IPA, 넓게 적음) → 낱말 속 r · l 소리의 자리(처음 · 묶음 · 가운데 · 끝 · r 모음 뒤)
 *   → 한국어식으로 읽으면 무엇으로 바뀌나 · 외래어 표기의 ㄹ(ㄹ 하나 · ㄹㄹ · 받침 ㄹ)이 r · l 소리와 맞나
 *   최소 대립쌍(짝 낱말)이 정말 소리 하나(r ↔ l)만 다른가 · 음성 인식이 들은 낱말이 목표 낱말인가 짝 낱말인가
 *
 * 단순하게 줄인 것(README · 화면 각주에 적음)
 *   - 끝의 r(car · fire)은 IPA에서 자음 r로 적지만 r 모음이라 P08에서 다뤄요. 이 편에서는 fire · file 짝에만 써요.
 *   - 미국 영어의 l은 자리와 상관없이 조금 어둡지만, 여기서는 처음 · 가운데 · 묶음 = 밝은 l, 끝 = 어두운 l로 나눠요.
 *   - IPA는 넓게 적어요(r = ɹ, 모음 사이 t의 짧은 ㄹ 소리 등은 적지 않음). tools/에 없는 점검은 misaki 미국 발음 사전으로 따로 맞춰 봤어요(README).
 */
(function () {
  'use strict';
  const RL = (window.RL = {});

  /* ---------- 소리(음소) ---------- */
  const VOW = ['aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'i', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ə', 'ɚ', 'ɝ', 'ɑ', 'ɔ', 'ʊ', 'u'];
  const CON = ['tʃ', 'dʒ', 'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j'];
  const UNITS = VOW.concat(CON).sort((a, b) => b.length - a.length);
  const isV = p => VOW.indexOf(p) >= 0;
  const isC = p => CON.indexOf(p) >= 0;
  RL.isV = isV;
  // IPA 글 → 음소 목록 (강세 표시 ˈ ˌ는 빼요)
  function phones(ipa) {
    const s = String(ipa).replace(/[ˈˌ.]/g, ''), out = [];
    let i = 0;
    while (i < s.length) {
      const u = UNITS.find(x => s.startsWith(x, i));
      if (!u) throw new Error('RL: 모르는 소리 ' + s[i] + ' in ' + ipa);
      out.push(u); i += u.length;
    }
    return out;
  }
  RL.phones = phones;

  /* ---------- 발음 사전: 낱말 | IPA | 한국어식(외래어 표기법을 따른 한글) | 뜻 ---------- */
  const DICT_SRC = `
right|raɪt|라이트|오른쪽 · 맞는
light|laɪt|라이트|빛 · 가벼운
read|rid|리드|읽다
lead|lid|리드|이끌다
rock|rɑk|록|바위
lock|lɑk|록|자물쇠 · 잠그다
wrong|rɔŋ|롱|틀린
long|lɔŋ|롱|긴
road|roʊd|로드|길
load|loʊd|로드|짐 · 싣다
rice|raɪs|라이스|쌀 · 밥
lice|laɪs|라이스|이(머릿니)들
rate|reɪt|레이트|비율 · 요금
late|leɪt|레이트|늦은
row|roʊ|로|줄
low|loʊ|로|낮은
grass|græs|그래스|풀 · 풀밭
glass|glæs|글라스|유리잔
fry|fraɪ|프라이|튀기다
fly|flaɪ|플라이|날다
pray|preɪ|프레이|기도하다
play|pleɪ|플레이|놀다
crowd|kraʊd|크라우드|사람들 무리
cloud|klaʊd|클라우드|구름
crime|kraɪm|크라임|범죄
climb|klaɪm|클라임|오르다
brew|bru|브루|끓이다 · 빚다
blue|blu|블루|파란
fresh|frɛʃ|프레시|신선한
flesh|flɛʃ|플레시|살
grow|groʊ|그로|자라다
glow|gloʊ|글로|빛나다
correct|kəˈrɛkt|커렉트|바로잡다 · 맞는
collect|kəˈlɛkt|컬렉트|모으다
berry|ˈbɛri|베리|산딸기류 열매
belly|ˈbɛli|벨리|배
arrive|əˈraɪv|어라이브|도착하다
alive|əˈlaɪv|얼라이브|살아 있는
pirate|ˈpaɪrət|파이럿|해적
pilot|ˈpaɪlət|파일럿|조종사
fire|faɪr|파이어|불
file|faɪl|파일|파일 · 서류철
tire|taɪr|타이어|타이어
tile|taɪl|타일|타일
feel|fil|필|느끼다
school|skul|스쿨|학교
ball|bɔl|볼|공
milk|mɪlk|밀크|우유
people|ˈpipəl|피플|사람들
hotel|hoʊˈtɛl|호텔|호텔
film|fɪlm|필름|영화 · 필름
help|hɛlp|헬프|돕다
golf|gɑlf|골프|골프
world|wɝld|월드|세계
girl|gɝl|걸|여자아이
pearl|pɝl|펄|진주
word|wɝd|워드|낱말
radio|ˈreɪdioʊ|라디오|라디오
lemon|ˈlɛmən|레몬|레몬
robot|ˈroʊbɑt|로봇|로봇
restaurant|ˈrɛstərənt|레스토랑|식당
color|ˈkʌlɚ|컬러|색
jelly|ˈdʒɛli|젤리|젤리
hello|həˈloʊ|헬로|안녕
lens|lɛnz|렌즈|렌즈
level|ˈlɛvəl|레벨|수준
room|rum|룸|방
love|lʌv|러브|사랑하다
class|klæs|클래스|수업 · 반
turn|tɝn|턴|돌다
loud|laʊd|라우드|큰 소리로
run|rʌn|런|달리다
let's|lɛts|렛츠|~하자
please|pliz|플리즈|부디
water|ˈwɔtɚ|워터|물
Paris|ˈpɛrɪs|패리스|파리
tomorrow|təˈmɑroʊ|투모로|내일
clear|klɪr|클리어|맑은
bread|brɛd|브레드|빵
old|oʊld|올드|오래된
still|stɪl|스틸|아직
flew|flu|플루|날았다
plane|pleɪn|플레인|비행기
really|ˈrili|리얼리|정말
glad|glæd|글래드|기쁜
great|greɪt|그레이트|아주 좋은
like|laɪk|라이크|좋아하다 · ~하고 싶다
little|ˈlɪtəl|리틀|조금
near|nɪr|니어|가까운
I'll|aɪl|아일|~할게요
call|kɔl|콜|전화하다
later|ˈleɪtɚ|레이터|나중에
small|smɔl|스몰|작은
girlfriend|ˈgɝlfrɛnd|걸프렌드|여자 친구
from|frʌm|프럼|~에서
Seoul|soʊl|서울|서울
will|wɪl|윌|~할 것이다
full|fʊl|풀|가득 찬
could|kʊd||~할 수 있다
for|fɔr|포|~을 위해
every|ˈɛvri|에브리|모든 · 매
morning|ˈmɔrnɪŋ|모닝|아침
`;
  const DICT = {};
  DICT_SRC.trim().split('\n').forEach(line => {
    const [w, ipa, ko, gloss] = line.split('|');
    DICT[w.toLowerCase()] = { w, ipa, ko: ko || null, gloss, ph: phones(ipa) };
  });
  RL.DICT = DICT;
  const entry = w => DICT[String(w).toLowerCase().replace(/[.,!?]+$/, '')] || null;
  RL.entry = entry;
  RL.ipa = w => { const e = entry(w); return e ? '/' + e.ipa + '/' : ''; };

  /* ---------- 자리: 처음 · 묶음(자음 뒤) · 가운데(모음 사이) · 끝(모음 뒤) · r 모음 뒤의 l ---------- */
  const POS = {
    start: { ko: '처음', long: '낱말 처음', kr: 'ㄹ(톡)', risk: 'merge',
      say: '한국어식으로는 r · l 소리가 둘 다 톡 치는 ㄹ이 돼요(라이트). 둘이 하나로 합쳐지는 자리예요.' },
    cluster: { ko: '묶음', long: '자음 뒤(묶음)', kr: '으 + ㄹ', risk: 'ins',
      say: '외래어 표기는 l이면 ㄹㄹ(글라스), r이면 ㄹ 하나(그래스)로 갈라요. 다만 자음 사이에 으를 넣기 쉬워요.' },
    mid: { ko: '가운데', long: '모음 사이', kr: 'ㄹㄹ · ㄹ', risk: 'r',
      say: '외래어 표기는 l이면 ㄹㄹ(벨리), r이면 ㄹ 하나(베리)로 갈라요. l 소리는 ㄹㄹ 느낌 그대로, r 소리는 혀끝을 띄워요.' },
    end: { ko: '끝', long: '낱말 끝 · 자음 앞', kr: '받침 ㄹ', risk: 'dark',
      say: '끝의 l 소리는 혀 뒤를 올린 어두운 l이에요. 한국어식으로는 밝은 받침 ㄹ이 되고, 뒤에 자음이 오면 으가 붙어요(밀크).' },
    rl: { ko: 'r 모음 뒤', long: 'r 모음 뒤의 l', kr: '받침 ㄹ', risk: 'rl',
      say: 'r 모음 바로 뒤의 어두운 l이에요(world · girl). 한국어식으로는 r 소리가 사라지고 받침 ㄹ만 남아요(월드). 가장 어려운 자리예요.' },
  };
  RL.POS = POS;
  RL.POS_ORDER = ['start', 'cluster', 'mid', 'end', 'rl'];
  // 낱말 속 r · l 소리마다 { i, ph, pos, dark, next }
  function liquids(w) {
    const e = typeof w === 'object' ? w : entry(w);
    if (!e) return [];
    const p = e.ph, out = [];
    p.forEach((ph, i) => {
      if (ph !== 'r' && ph !== 'l') return;
      const prev = p[i - 1], next = p[i + 1];
      let pos;
      if (i === 0) pos = 'start';
      else if (isV(prev) && next && isV(next)) pos = 'mid';
      else if (isC(prev) && next && isV(next)) pos = 'cluster';
      else if (ph === 'l' && (prev === 'ɝ' || prev === 'ɚ')) pos = 'rl';
      else pos = 'end';
      out.push({ i, ph, pos, dark: ph === 'l' && (pos === 'end' || pos === 'rl'), prev, next });
    });
    return out;
  }
  RL.liquids = liquids;
  RL.posOf = w => { const L = liquids(w); return L.length ? L[0].pos : null; };

  /* ---------- 외래어 표기의 ㄹ (국립국어원 외래어 표기법 제3장 제1절 제6항 유음 [l]) ----------
     어말 · 자음 앞의 [l] → 받침 ㄹ(호텔) · 어중의 [l]이 모음 앞이나 모음이 따르지 않는 비음 앞 → ㄹㄹ(슬라이드 · 필름)
     비음 뒤의 [l] → ㄹ(헨리) · [r]은 모음 앞에서만 ㄹ(라디오 · 베리), 모음 뒤 끝의 r은 적지 않음(파이어)
     → 한글의 ㄹ 단위(ㄹㄹ · 받침 ㄹ · 첫소리 ㄹ)를 차례로 세어 낱말의 r · l 소리와 맞춰요 */
  function hangul(s) {
    const out = [];
    for (const ch of String(s)) {
      const c = ch.charCodeAt(0) - 0xAC00;
      if (c < 0 || c > 11171) { out.push({ ch, on: -1, coda: -1 }); continue; }
      out.push({ ch, on: Math.floor(c / 588), coda: c % 28 });
    }
    return out;
  }
  // 한글 → ㄹ 단위 [{ kind: 'LL' | 'coda' | 'onset', at: [음절 번호…] }]
  function koUnits(ko) {
    const sy = hangul(ko), out = [];
    sy.forEach((s, k) => {
      const nx = sy[k + 1], pv = sy[k - 1];
      if (s.coda === 8 && nx && nx.on === 5) out.push({ kind: 'LL', at: [k, k + 1] });
      else if (s.coda === 8) out.push({ kind: 'coda', at: [k] });
      if (s.on === 5 && !(pv && pv.coda === 8)) out.push({ kind: 'onset', at: [k] });
    });
    return out.sort((a, b) => a.at[0] - b.at[0]);
  }
  RL.koUnits = koUnits;
  // 낱말의 r · l 소리 → 기대하는 ㄹ 단위(끝의 r은 없음)
  function koExpect(w) {
    const out = [];
    liquids(w).forEach(L => {
      const nasal = n => n === 'm' || n === 'n' || n === 'ŋ';
      let kind = null;
      if (L.ph === 'l') {
        if (L.pos === 'start') kind = 'onset';
        else if (L.pos === 'mid') kind = 'LL';
        else if (L.pos === 'cluster') kind = nasal(L.prev) ? 'onset' : 'LL';
        else kind = nasal(L.next) ? 'LL' : 'coda';
      } else if (L.pos !== 'end') kind = 'onset';
      if (kind) out.push({ kind, L });
    });
    return out;
  }
  RL.koExpect = koExpect;
  // 한글 음절마다 역할: 'r' · 'l' · null (ㄹ이 영어의 어느 소리를 적었나)
  RL.koMarks = function (w) {
    const e = entry(w);
    if (!e || !e.ko) return [];
    const U = koUnits(e.ko), X = koExpect(e), marks = hangul(e.ko).map(() => null);
    if (U.length !== X.length) return marks;
    U.forEach((u, k) => u.at.forEach(i => { marks[i] = X[k].L.ph; }));
    return marks;
  };

  /* ---------- 철자 속 r · l 글자 (영상 · 페이지에서 그 글자만 칠하기) ----------
     소리 나지 않는 l(could · walk)과 r 모음(turn · water)은 칠하지 않아요. 글자 묶음(r · rr · wr · l · ll)과 소리의 수가 맞을 때만 */
  function spans(word) {
    const e = entry(word), out = [];
    if (!e) return out;
    const w = String(word);
    ['r', 'l'].forEach(ph => {
      const want = liquids(e).filter(L => L.ph === ph);
      if (!want.length) return;
      const re = ph === 'r' ? /wr|rr|r/gi : /ll|l/gi;
      let groups = [], m;
      while ((m = re.exec(w))) {
        const s = m.index, en = s + m[0].length, nx = w[en] || '';
        if (ph === 'r') {
          // 모음 앞의 r 글자만 자음 r (turn · water · girl의 r은 r 모음) — 사전에 끝의 r 소리가 있는 낱말(fire · clear · morning)은 그 r도
          const vowelNext = /[aeiouy]/i.test(nx);
          const endR = want.some(L => L.pos === 'end');
          if (!vowelNext && !endR) continue;
        }
        groups.push([m[0].toLowerCase() === 'wr' ? s + 1 : s, en]);
      }
      if (ph === 'r' && groups.length > want.length) {
        // 끝의 r 모음(-er · -or)을 빼고 앞에서부터
        groups = groups.slice(0, want.length);
      }
      if (groups.length !== want.length) { out.push({ bad: true, ph }); return; }
      groups.forEach((gp, k) => out.push({ s: gp[0], e: gp[1], ph, pos: want[k].pos, dark: want[k].dark }));
    });
    return out.sort((a, b) => (a.s || 0) - (b.s || 0));
  }
  RL.spans = spans;
  // 문장 → [{ t, ph }] 조각 (ph = 'r' | 'l' | null)
  RL.segs = function (text) {
    const out = [];
    String(text).split(/(\s+)/).forEach(tok => {
      if (!tok) return;
      const m = tok.match(/^([^A-Za-z']*)([A-Za-z']+)(.*)$/);
      if (!m) { out.push({ t: tok, ph: null }); return; }
      if (m[1]) out.push({ t: m[1], ph: null });
      const w = m[2], sp = spans(w).filter(x => !x.bad);
      let at = 0;
      sp.forEach(x => {
        if (x.s > at) out.push({ t: w.slice(at, x.s), ph: null, w });
        out.push({ t: w.slice(x.s, x.e), ph: x.ph, pos: x.pos, dark: x.dark, w });
        at = x.e;
      });
      if (at < w.length) out.push({ t: w.slice(at), ph: null, w });
      if (m[3]) out.push({ t: m[3], ph: null });
    });
    return out;
  };

  /* ---------- 최소 대립쌍: 소리 하나만 r ↔ l로 다른가 ---------- */
  function pairDiff(a, b) {
    const A = entry(a), B = entry(b);
    if (!A || !B) return { ok: false, why: '사전에 없음' };
    if (A.ph.length !== B.ph.length) return { ok: false, why: '소리 수가 다름', extra: true };
    const d = [];
    A.ph.forEach((p, i) => { if (p !== B.ph[i]) d.push(i); });
    if (d.length !== 1) return { ok: false, why: `다른 소리 ${d.length}개` };
    const i = d[0], x = A.ph[i], y = B.ph[i];
    if (!((x === 'r' && y === 'l') || (x === 'l' && y === 'r'))) return { ok: false, why: `${x} ↔ ${y}` };
    return { ok: true, i, r: x === 'r' ? a : b, l: x === 'l' ? a : b, pos: liquids(A).find(L => L.i === i).pos };
  }
  RL.pairDiff = pairDiff;

  /* ---------- 짝 낱말 (듣고 가르기 · 영상 · 연습 문제) ---------- */
  RL.PAIRS = [
    ['right', 'light'], ['read', 'lead'], ['rock', 'lock'], ['wrong', 'long'], ['road', 'load'], ['rice', 'lice'], ['rate', 'late'], ['row', 'low'],
    ['grass', 'glass'], ['fry', 'fly'], ['pray', 'play'], ['crowd', 'cloud'], ['crime', 'climb'], ['brew', 'blue'], ['fresh', 'flesh'], ['grow', 'glow'],
    ['correct', 'collect'], ['berry', 'belly'], ['arrive', 'alive'], ['pirate', 'pilot'],
    ['fire', 'file'], ['tire', 'tile'],
  ].map(([r, l]) => ({ r, l, pos: pairDiff(r, l).pos, id: r + '-' + l }));
  RL.pairOf = w => RL.PAIRS.find(p => p.r === w || p.l === w) || null;
  RL.partner = w => { const p = RL.pairOf(w); return p ? (p.r === w ? p.l : p.r) : null; };

  /* ---------- 목소리 (듣고 가르기: 미국식 목소리 넷) ---------- */
  RL.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '미국 여성 ①' },
    { sp: 'tf', ko: '차분한 선생님', who: '미국 여성 ②' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성 ③' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];

  /* ---------- 낱말 묶음 (영상 · 직접 해 보기) ---------- */
  RL.SETS = {
    lStart: ['light', 'lead', 'long', 'lock', 'late'],
    rStart: ['right', 'read', 'rock', 'wrong', 'rate'],
    korean: [['나라', 'flap'], ['라디오', 'flap'], ['달라', 'll'], ['빨리', 'll']],
    mid: ['berry', 'belly', 'correct', 'collect', 'arrive', 'alive', 'pirate', 'pilot'],
    cluster: ['grass', 'glass', 'fry', 'fly', 'pray', 'play', 'cloud', 'crowd', 'blue', 'brew'],
    dark: ['feel', 'school', 'ball', 'milk', 'people', 'help'],
    rl: ['world', 'girl', 'pearl'],
  };
  // 외래어 함정: 한국어식 표기가 굳은 말. trap: merge(처음 ㄹ) · ins(으 넣기) · clear(밝은 끝 l) · rl(r이 사라짐) · ll(ㄹㄹ = l)
  RL.LOAN = [
    { w: 'radio', trap: 'merge' }, { w: 'lemon', trap: 'merge' }, { w: 'robot', trap: 'merge' }, { w: 'lens', trap: 'merge' },
    { w: 'hotel', trap: 'clear' }, { w: 'film', trap: 'ins' }, { w: 'golf', trap: 'ins' }, { w: 'milk', trap: 'ins' },
    { w: 'color', trap: 'll' }, { w: 'jelly', trap: 'll' }, { w: 'hello', trap: 'll' }, { w: 'class', trap: 'ins' },
    { w: 'restaurant', trap: 'merge' }, { w: 'level', trap: 'clear' }, { w: 'room', trap: 'merge' }, { w: 'love', trap: 'merge' },
  ];
  RL.TRAP = {
    merge: { ko: '처음 ㄹ', why: '처음의 ㄹ은 톡 치는 소리 — r 소리인지 l 소리인지 먼저 정해요' },
    ins: { ko: '으 넣기', why: '자음 사이 · 끝에 으를 넣으면 음절이 늘어요' },
    clear: { ko: '밝은 l', why: '끝의 l 소리는 혀 뒤를 올려 어둡게' },
    rl: { ko: 'r이 사라짐', why: 'r 모음을 살리고 끝의 l 소리까지' },
    ll: { ko: 'ㄹㄹ = l', why: 'ㄹㄹ로 적힌 곳은 혀끝을 대는 l 소리' },
  };

  /* ---------- 음절 수: 영어(모음 수) · 한국어식(한글 음절 수) ---------- */
  RL.syl = w => { const e = entry(w); return e ? e.ph.filter(isV).length : 0; };
  RL.koSyl = w => { const e = entry(w); return e && e.ko ? [...e.ko].length : 0; };
  // 한국어식 표기에서 넣은 ‘으’ 음절(모음 ㅡ) — 영어에 없는 모음. 음절이 늘어난 만큼만, 뒤에서부터(피플의 플은 영어 ə라 빼요)
  RL.koInserted = function (w) {
    const e = entry(w);
    if (!e || !e.ko) return [];
    const extra = RL.koSyl(w) - RL.syl(w);
    if (extra <= 0) return [];
    const u = [];
    hangul(e.ko).forEach((s, k) => { if (s.on >= 0 && Math.floor(((s.ch.charCodeAt(0) - 0xAC00) % 588) / 28) === 18) u.push(k); });
    return u.length <= extra ? u : u.slice(u.length - extra);
  };

  /* ---------- 문장 (영상 09장 · 따라 말하기 28) — 자리마다 일곱 ---------- */
  RL.SENT = [
    { pos: 'start', en: 'Turn right at the light.', ko: '신호등에서 오른쪽으로 도세요.' },
    { pos: 'start', en: 'Could you read it out loud?', ko: '소리 내어 읽어 줄래요?' },
    { pos: 'start', en: 'She will lead the team.', ko: '그녀가 팀을 이끌 거예요.' },
    { pos: 'start', en: 'The road is long.', ko: '길이 길어요.' },
    { pos: 'start', en: 'Is this the right room?', ko: '이 방이 맞나요?' },
    { pos: 'start', en: "I'm late. Let's run!", ko: '늦었어요. 뛰어요!' },
    { pos: 'start', en: 'Rice, please.', ko: '밥 주세요.' },
    { pos: 'cluster', en: 'Can I have a glass of water, please?', ko: '물 한 잔 주시겠어요?' },
    { pos: 'cluster', en: 'Please keep off the grass.', ko: '잔디에 들어가지 마세요.' },
    { pos: 'cluster', en: 'We fly to Paris tomorrow.', ko: '우리는 내일 파리로 날아가요.' },
    { pos: 'cluster', en: 'Can you fry an egg?', ko: '달걀을 부칠 수 있어요?' },
    { pos: 'cluster', en: "Let's play a game.", ko: '게임을 해요.' },
    { pos: 'cluster', en: 'The sky is clear and blue.', ko: '하늘이 맑고 파래요.' },
    { pos: 'cluster', en: 'I love fresh bread.', ko: '갓 구운 빵을 아주 좋아해요.' },
    { pos: 'mid', en: 'Please correct my mistakes.', ko: '제 실수를 고쳐 주세요.' },
    { pos: 'mid', en: 'I collect old coins.', ko: '저는 옛날 동전을 모아요.' },
    { pos: 'mid', en: 'When did you arrive?', ko: '언제 도착했어요?' },
    { pos: 'mid', en: 'The fish is still alive.', ko: '물고기가 아직 살아 있어요.' },
    { pos: 'mid', en: 'The pilot flew the plane.', ko: '조종사가 비행기를 몰았어요.' },
    { pos: 'mid', en: "Hello! I'm really glad to meet you.", ko: '안녕하세요! 만나서 정말 반가워요.' },
    { pos: 'mid', en: 'My belly is full.', ko: '배가 불러요.' },
    { pos: 'end', en: 'I feel great.', ko: '기분이 아주 좋아요.' },
    { pos: 'end', en: "I'd like a little milk.", ko: '우유를 조금 주세요.' },
    { pos: 'end', en: 'The school is near the hotel.', ko: '학교는 호텔 가까이에 있어요.' },
    { pos: 'end', en: "I'll call you later.", ko: '나중에 전화할게요.' },
    { pos: 'end', en: "It's a small world.", ko: '세상 참 좁네요.' },
    { pos: 'end', en: 'My girlfriend is from Seoul.', ko: '제 여자 친구는 서울 출신이에요.' },
    { pos: 'end', en: 'People love the film.', ko: '사람들이 그 영화를 좋아해요.' },
  ];
  // 문장 속 r · l 소리 수 (영상 · 따라 말하기의 표시)
  RL.countIn = text => RL.segs(text).reduce((o, s) => { if (s.ph) o[s.ph]++; return o; }, { r: 0, l: 0 });

  /* ---------- 음성 인식: 들은 말이 목표 낱말인가, 짝 낱말인가 ----------
     인식기는 낱말을 철자로 돌려줘요. 소리가 같은 다른 낱말(right = write)도 그 소리로 쳐요 */
  const SAME = {
    right: ['write', 'rite', 'wright'], light: ['lite'], read: ['reed'], lead: ['lede'], row: ['roe'], low: ['lo'],
    road: ['rode', 'rowed'], load: ['lode', 'lowed'], pray: ['prey'], blue: ['blew'], climb: ['clime'], berry: ['bury'],
    tire: ['tyre'], fry: ['frye'], lock: ['loch'],
  };
  RL.SAME = SAME;
  const words = s => String(s || '').toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const has = (list, w) => list.indexOf(w) >= 0 || (SAME[w] || []).some(x => list.indexOf(x) >= 0);
  // alts: 인식 후보 글 목록(첫째가 가장 그럴듯함) → { verdict: 'target' | 'partner' | 'maybe' | 'other' | 'none', heard }
  RL.heard = function (target, alts) {
    const partner = RL.partner(target);
    alts = (alts || []).filter(Boolean);
    if (!alts.length) return { verdict: 'none', heard: '' };
    const top = words(alts[0]);
    if (has(top, target)) return { verdict: 'target', heard: alts[0], partner };
    if (partner && has(top, partner)) return { verdict: 'partner', heard: alts[0], partner };
    const k = alts.findIndex(a => has(words(a), target));
    if (k > 0) return { verdict: 'maybe', heard: alts[0], rank: k + 1, partner };
    return { verdict: 'other', heard: alts[0], partner };
  };
  RL.HEARD_KO = {
    target: '목표 낱말로 들었어요',
    partner: '짝 낱말로 들었어요',
    maybe: '첫째 후보는 아니지만 후보에 있었어요',
    other: '다른 낱말로 들었어요',
    none: '아무 말도 듣지 못했어요',
  };

  /* ---------- 따라 말하기: 낱말 맞추기 (들린 낱말 초록 · 빠진 낱말 주황) ---------- */
  const norm = w => w.toLowerCase().replace(/[^a-z0-9']/g, '').replace(/’/g, "'");
  RL.compareWords = function (target, heard) {
    const T = String(target).split(/\s+/).filter(Boolean).map(w => ({ w, n: norm(w) }));
    const Hs = words(heard).map(norm);
    const used = Hs.map(() => false);
    let hit = 0;
    const marks = T.map(t => {
      if (!t.n) return { w: t.w, ok: true };
      let k = Hs.findIndex((h, i) => !used[i] && (h === t.n || (SAME[t.n] || []).indexOf(h) >= 0 || Object.keys(SAME).some(s => (SAME[s] || []).indexOf(t.n) >= 0 && h === s)));
      if (k >= 0) { used[k] = true; hit++; return { w: t.w, ok: true }; }
      return { w: t.w, ok: false };
    });
    const total = T.filter(t => t.n).length;
    return { marks, hit, total, ratio: total ? hit / total : 0 };
  };

  /* ---------- 연습 문제: 듣고 고르기 16 ----------
     kind: word(낱말 하나) · sent(문장 속 낱말) · same(두 낱말이 같았나) · extra(l 소리가 있나: word · world)
     a: 정답 보기 번호(0부터). 소리는 sp의 목소리 */
  RL.DRILL = [
    { kind: 'word', sp: 'um', say: 'light', opts: ['right', 'light'], a: 1 },
    { kind: 'word', sp: 'uf', say: 'grass', opts: ['grass', 'glass'], a: 0 },
    { kind: 'sent', sp: 'tf', say: "Don't step on the glass.", frame: "Don't step on the ___.", opts: ['grass', 'glass'], a: 1, ko: '유리 조각을 밟지 마세요.' },
    { kind: 'same', sp: 'tc', say: ['lead', 'read'], opts: ['같아요', '달라요'], a: 1 },
    { kind: 'word', sp: 'tf', say: 'collect', opts: ['correct', 'collect'], a: 1 },
    { kind: 'sent', sp: 'um', say: 'Can you collect it for me?', frame: 'Can you ___ it for me?', opts: ['collect', 'correct'], a: 0, ko: '그것 좀 모아(가져다) 줄래요?' },
    { kind: 'same', sp: 'uf', say: ['belly', 'belly'], opts: ['같아요', '달라요'], a: 0 },
    { kind: 'word', sp: 'tc', say: 'file', opts: ['file', 'fire'], a: 0 },
    { kind: 'extra', sp: 'um', say: 'world', opts: ['word', 'world'], a: 1 },
    { kind: 'word', sp: 'um', say: 'rock', opts: ['lock', 'rock'], a: 1 },
    { kind: 'sent', sp: 'uf', say: 'I saw the pirate.', frame: 'I saw the ___.', opts: ['pilot', 'pirate'], a: 1, ko: '해적을 봤어요.' },
    { kind: 'same', sp: 'tf', say: ['crowd', 'cloud'], opts: ['같아요', '달라요'], a: 1 },
    { kind: 'word', sp: 'uf', say: 'fly', opts: ['fly', 'fry'], a: 0 },
    { kind: 'sent', sp: 'tc', say: 'They pray every morning.', frame: 'They ___ every morning.', opts: ['pray', 'play'], a: 0, ko: '그들은 아침마다 기도해요.' },
    { kind: 'same', sp: 'um', say: ['long', 'long'], opts: ['같아요', '달라요'], a: 0 },
    { kind: 'extra', sp: 'tf', say: 'word', opts: ['word', 'world'], a: 0 },
  ];
  // 문제의 목표 낱말(정답 낱말 · 같은가 문제는 첫 낱말)
  RL.drillWord = q => q.kind === 'same' ? q.say[0] : q.kind === 'sent' ? q.opts[q.a] : q.say;
  RL.drillWords = q => q.kind === 'same' ? q.say.slice() : q.opts.slice();
  // 힌트 세 단계(엔진이 자리 · 소리에서 만들어요)
  RL.hints = function (q) {
    const ws = RL.drillWords(q).filter(w => entry(w)), pos = ws.map(w => RL.posOf(w)).find(Boolean) || 'start';
    const P = POS[pos];
    const step1 = q.kind === 'extra'
      ? '끝을 들어요. world는 r 모음 뒤에 어두운 l 소리(우 · 어 같은 울림)가 한 번 더 붙어요. word는 r 모음에서 바로 d로 끝나요.'
      : pos === 'end' || pos === 'rl'
        ? '끝을 들어요. l 소리로 끝나면 우 · 어처럼 어둡게 울리고, r 소리로 끝나면 어 · 얼처럼 혀가 말린 소리로 끝나요.'
        : 'r 소리는 어둡고 둥글게, 우가 살짝 붙은 듯이 시작해요. l 소리는 혀가 닿았다 떨어지는 순간이 또렷하고 밝아요.';
    const step2 = 'l 소리는 혀끝이 윗잇몸에 닿고, r 소리는 혀끝이 어디에도 닿지 않아요(입술은 조금 모음).';
    const step3 = `${P.long} 자리예요. ${P.say}` + (q.kind === 'sent' ? ' 문장 속에서는 두 낱말이 모두 말이 되니 소리만이 뜻을 정해요.' : '');
    return [
      { head: '① 듣고 가르기', text: step1 },
      { head: '② 입 모양', text: step2 },
      { head: '③ 낱말 · 문장 속에서', text: step3 },
    ];
  };

  /* ---------- 모든 글 (글꼴 미리 받기용) ---------- */
  RL.allText = () => Object.values(DICT).map(e => e.w + e.ipa + (e.ko || '') + e.gloss).join('') +
    RL.SENT.map(s => s.en + s.ko).join('') + Object.values(POS).map(p => p.ko + p.long + p.kr + p.say).join('') +
    Object.values(RL.TRAP).map(t => t.ko + t.why).join('') + RL.VOICES.map(v => v.ko + v.who).join('') + RL.SETS.korean.map(k => k[0]).join('');

  /* ---------- 데이터 점검 ---------- */
  RL.check = function () {
    const warn = [];
    const w = m => warn.push(m);
    // 짝: 소리 하나만 r ↔ l
    RL.PAIRS.forEach(p => {
      const d = pairDiff(p.r, p.l);
      if (!d.ok) w(`짝 ${p.r} · ${p.l}: ${d.why}`);
      if (d.ok && d.r !== p.r) w(`짝 ${p.r} · ${p.l}: r 쪽이 바뀜`);
    });
    // 외래어 표기의 ㄹ이 r · l 소리와 맞나
    Object.values(DICT).forEach(e => {
      if (!e.ko) return;
      const U = koUnits(e.ko), X = koExpect(e);
      if (U.length !== X.length) { w(`${e.w}(${e.ko}): ㄹ 단위 ${U.length}개, 기대 ${X.length}개`); return; }
      U.forEach((u, k) => { if (u.kind !== X[k].kind) w(`${e.w}(${e.ko}): ${k + 1}번째 ㄹ은 ${u.kind}, 기대 ${X[k].kind}`); });
    });
    // 낱말 묶음 · 외래어 · 문장의 낱말이 사전에 있나, 글자 칠하기가 되나
    const need = [].concat(RL.SETS.lStart, RL.SETS.rStart, RL.SETS.mid, RL.SETS.cluster, RL.SETS.dark, RL.SETS.rl, RL.LOAN.map(x => x.w));
    need.forEach(x => { if (!entry(x)) w(`사전에 없음: ${x}`); });
    const sentWords = [];
    RL.SENT.concat(RL.DRILL.filter(q => q.kind === 'sent').map(q => ({ en: q.say }))).forEach(s => s.en.replace(/[A-Za-z']+/g, m => { sentWords.push(m); return m; }));
    sentWords.forEach(x => {
      if (/[rl]/i.test(x) && !entry(x)) w(`문장 낱말이 사전에 없음: ${x}`);
      if (entry(x) && spans(x).some(s => s.bad)) w(`글자 칠하기 실패: ${x}`);
    });
    Object.values(DICT).forEach(e => { if (spans(e.w).some(s => s.bad)) w(`글자 칠하기 실패: ${e.w}`); });
    // 문장의 자리: 그 자리의 소리가 문장에 있나
    RL.SENT.forEach(s => {
      const pos = [];
      RL.segs(s.en).forEach(g => { if (g.ph) pos.push(g.pos); });
      const ok = s.pos === 'end' ? pos.some(p => p === 'end' || p === 'rl') : pos.indexOf(s.pos) >= 0;
      if (!ok) w(`문장 "${s.en}": ${POS[s.pos].ko} 자리의 r · l 소리가 없음`);
    });
    if (RL.SENT.length !== 28) w(`따라 말하기 문장 ${RL.SENT.length}개(28개여야 함)`);
    // 연습 문제: 정답 위치 · 소리 · 보기
    const pos2 = [0, 0];
    RL.DRILL.forEach((q, k) => {
      if (q.opts.length !== 2) w(`연습 ${k + 1}: 보기는 둘`);
      pos2[q.a]++;
      if (q.kind === 'word' || q.kind === 'extra') {
        if (q.opts[q.a] !== q.say) w(`연습 ${k + 1}: 정답 ${q.opts[q.a]} ≠ 들려주는 ${q.say}`);
        if (q.kind === 'word' && !pairDiff(q.opts[0], q.opts[1]).ok) w(`연습 ${k + 1}: 보기가 짝이 아님`);
      }
      if (q.kind === 'sent') {
        if (q.frame.replace('___', q.opts[q.a]) !== q.say) w(`연습 ${k + 1}: 문장과 정답이 맞지 않음`);
        if (!pairDiff(q.opts[0], q.opts[1]).ok) w(`연습 ${k + 1}: 보기가 짝이 아님`);
      }
      if (q.kind === 'same') {
        const same = q.say[0] === q.say[1];
        if ((q.a === 0) !== same) w(`연습 ${k + 1}: 같은가 정답이 틀림`);
        if (!same && !pairDiff(q.say[0], q.say[1]).ok) w(`연습 ${k + 1}: 두 낱말이 짝이 아님`);
      }
      if (['tc', 'tf', 'uf', 'um'].indexOf(q.sp) < 0) w(`연습 ${k + 1}: 목소리 ${q.sp}`);
    });
    if (pos2[0] !== pos2[1]) w(`연습 문제 정답 위치가 한쪽으로 몰림: ${pos2.join(' / ')}`);
    // 입 그림: l 자세는 닿고 r 자세는 닿지 않아야
    if (window.EN && EN.mouth) {
      ['l', 'dark', 'flap'].forEach(p => { if (!EN.mouth.contact(p).touch) w(`입 그림 ${p}: 혀끝이 닿지 않음`); });
      ['r', 'rb'].forEach(p => { if (EN.mouth.contact(p).touch) w(`입 그림 ${p}: 혀가 입천장에 닿음`); });
    }
    warn.forEach(m => console.warn('[RL.check] ' + m));
    return warn.length;
  };
})();
