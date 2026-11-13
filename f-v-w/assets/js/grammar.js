/* 입술이 하는 일 — f · v · w — 규칙 엔진 (FV)
 *
 * 맞고 틀림과 그림의 바탕은 모두 여기서 계산해요. 영상 · 직접 해 보기 · 놀이터 · 연습 문제 · 퀴즈가 같은 결과를 써요.
 *   발음 사전(미국 표준 발음 General American의 IPA, 넓게 적음 · 음절은 . · 센 음절 앞에 ˈ)
 *   → 낱말 속 f · v · w 소리(이 편의 소리)와 p · b 소리(짝 소리)의 자리(처음 · 묶음 · 가운데 · 끝, 음절에서 계산)
 *   → 한국어식으로 읽으면 무엇이 되나(f → ㅍ · v → ㅂ · ‘우’ 앞의 w → 빠짐 · 다른 모음 앞의 w → 와 · 워 · 웨 · 위 · 왜)
 *   → 외래어 표기의 한글(ㅍ · ㅂ · 받침 ㅂ · 와/워/웨/위/왜 · 우)이 그 소리들과 차례대로 맞나 · 짝 낱말이 같은 표기가 되나
 *   최소 대립쌍(짝 낱말)이 정말 소리 하나(f ↔ p · v ↔ b · w ↔ v)만 다른가 · 음성 인식이 들은 낱말이 목표 낱말인가 짝 낱말인가
 *
 * 사전 한 줄: 낱말 | 철자(f · v · w · p · b 소리를 적은 글자를 [ ]로) | IPA | 한국어식(외래어 표기법을 따른 한글, 없으면 빈칸) | 뜻 | 묶음
 *
 * 단순하게 줄인 것(README · 화면 각주에 적음)
 *   - IPA는 넓게 적어요(모음 사이 t의 짧은 ㄹ 소리 · 약한 모음의 변이 등은 적지 않음). misaki 미국 발음 사전과 따로 맞춰 봤어요(README).
 *   - 자리는 음절로 나눠 정해요: 첫 음절의 홀로 선 첫소리 = 처음 · 다른 자음과 붙은 첫소리 = 묶음 · 둘째 음절부터의 홀로 선 첫소리 = 가운데 · 음절 끝 = 끝.
 *   - 외래어 표기는 국립국어원 외래어 표기법을 따르되, 굳어진 표기(커피 · 비타민)는 그대로 써요. 엔진은 f · v · w · p · b 자리의 한글만 맞춰 봐요(모음은 보지 않음).
 */
(function () {
  'use strict';
  const FV = (window.FV = {});

  /* ---------- 소리(음소) ---------- */
  const VOW = ['aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'i', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ə', 'ɚ', 'ɝ', 'ɑ', 'ɔ', 'ʊ', 'u'];
  const CON = ['tʃ', 'dʒ', 'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j'];
  const UNITS = VOW.concat(CON).sort((a, b) => b.length - a.length);
  const isV = p => VOW.indexOf(p) >= 0;
  const isC = p => CON.indexOf(p) >= 0;
  FV.isV = isV;
  // 이 편이 다루는 소리: f · v · w(이 편의 소리, 노랑 mk-a) · p · b(짝 소리, 하늘 mk-b)
  const TARGET = ['f', 'v', 'w'], PARTNER = ['p', 'b'], LAB = TARGET.concat(PARTNER);
  FV.TARGET = TARGET; FV.PARTNER = PARTNER; FV.LAB = LAB;
  FV.role = ph => TARGET.indexOf(ph) >= 0 ? 'a' : PARTNER.indexOf(ph) >= 0 ? 'b' : null;
  // IPA 한 음절 → 음소 목록 (강세 표시 ˈ ˌ는 빼요)
  function phonesOf(s) {
    s = String(s).replace(/[ˈˌ]/g, '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const u = UNITS.find(x => s.startsWith(x, i));
      if (!u) throw new Error('FV: 모르는 소리 ' + s[i] + ' in ' + s);
      out.push(u); i += u.length;
    }
    return out;
  }
  const phones = ipa => phonesOf(String(ipa).replace(/\./g, ''));
  FV.phones = phones;

  /* ---------- 발음 사전 ----------
     묶음: pair(짝 낱말) · loan(외래어 카드) · wu(‘우’ 앞의 w) · wg(다른 모음 앞의 w) · place(자리 보기) · sent(문장) · drill(연습 문제) · extra */
  const DICT_SRC = `
fan|[f]an|fæn|팬|선풍기 · 부채|pair
pan|[p]an|pæn|팬|냄비 · 프라이팬|pair
fine|[f]ine|faɪn|파인|좋은 · 괜찮은|pair,sent
pine|[p]ine|paɪn|파인|소나무|pair
fast|[f]ast|fæst|패스트|빠른|pair
past|[p]ast|pæst|패스트|지난 · 과거|pair
fork|[f]ork|fɔrk|포크|포크|pair,loan
pork|[p]ork|pɔrk|포크|돼지고기|pair
feel|[f]eel|fil|필|느끼다|pair,sent
peel|[p]eel|pil|필|껍질을 벗기다|pair
fool|[f]ool|ful|풀|바보|pair
pool|[p]ool|pul|풀|수영장|pair
suffer|su[ff]er|ˈsʌ.fɚ|서퍼|괴로워하다|pair
supper|su[pp]er|ˈsʌ.pɚ|서퍼|저녁 식사|pair
fleas|[f]leas|fliz|플리즈|벼룩들|pair
please|[p]lease|pliz|플리즈|부디 · ~해 주세요|pair,sent
leaf|lea[f]|lif|리프|나뭇잎|pair,place
leap|lea[p]|lip|리프|뛰어오르다|pair
wife|[w]i[f]e|waɪf|와이프|아내|pair,sent
wipe|[w]i[p]e|waɪp|와이프|닦다|pair,sent
cuff|cu[ff]|kʌf|커프|소맷부리|pair
cup|cu[p]|kʌp|컵|컵 · 잔|pair,sent
laugh|lau[gh]|læf|래프|웃다|pair,sent
lap|la[p]|læp|랩|(앉은) 무릎 위|pair
very|[v]ery|ˈvɛ.ri|베리|아주 · 정말|pair,sent
berry|[b]erry|ˈbɛ.ri|베리|산딸기류 열매|pair,sent
vote|[v]ote|voʊt|보트|투표하다 · 표|pair,sent
boat|[b]oat|boʊt|보트|배(보트)|pair
vest|[v]est|vɛst|베스트|조끼|pair,sent
best|[b]est|bɛst|베스트|가장 좋은|pair
van|[v]an|væn|밴|승합차|pair,loan
ban|[b]an|bæn|밴|금지(하다)|pair
vet|[v]et|vɛt|벳|수의사|pair
bet|[b]et|bɛt|벳|내기(하다)|pair
curve|cur[v]e|kɝv|커브|곡선 · 굽은 길|pair
curb|cur[b]|kɝb|커브|연석(길가의 턱)|pair
wine|[w]ine|waɪn|와인|포도주|pair,wg
vine|[v]ine|vaɪn|바인|포도나무 덩굴|pair,drill
west|[w]est|wɛst|웨스트|서쪽|pair,wg
wet|[w]et|wɛt|웻|젖은|pair
while|[wh]ile|waɪl|와일|~하는 동안|pair
vile|[v]ile|vaɪl|바일|아주 나쁜|pair
coffee|co[ff]ee|ˈkɔ.fi|커피|커피|loan,place,sent
copy|co[p]y|ˈkɑ.pi|카피|복사(하다)|extra
file|[f]ile|faɪl|파일|파일 · 서류철|loan
golf|gol[f]|gɑlf|골프|골프|loan,place
video|[v]ideo|ˈvɪ.di.oʊ|비디오|영상 · 비디오|loan,sent
service|ser[v]ice|ˈsɝ.vəs|서비스|서비스|loan,sent
love|lo[v]e|lʌv|러브|사랑하다 · 아주 좋아하다|loan,place,sent
wood|[w]ood|wʊd|우드|나무(재목)|loan,wu
woman|[w]oman|ˈwʊ.mən|우먼|여자|loan,wu,sent
wool|[w]ool|wʊl|울|양털|loan,wu,sent
wolf|[w]ol[f]|wʊlf|울프|늑대|loan,wu
five|[f]i[v]e|faɪv|파이브|다섯|loan,place
Wi-Fi|[W]i-[F]i|ˈwaɪ.faɪ|와이파이|와이파이(무선 인터넷)|loan,sent
wave|[w]a[v]e|weɪv|웨이브|물결 · 손을 흔들다|loan
favorite|[f]a[v]orite|ˈfeɪ.və.rət|페이버릿|가장 좋아하는|loan,sent
would|[w]ould|wʊd|우드|~하시겠어요 · ~할 것이다|wu,sent
woods|[w]oods|wʊdz|우즈|숲|wu,sent
win|[w]in|wɪn|윈|이기다|wg
water|[w]ater|ˈwɔ.tɚ|워터|물|wg,sent
away|a[w]ay|ə.ˈweɪ|어웨이|떨어져 · 멀리|place
fly|[f]ly|flaɪ|플라이|날다|place
free|[f]ree|fri|프리|무료의 · 자유로운|place,sent
swim|s[w]im|swɪm|스윔|수영하다|place,sent
twelve|t[w]el[v]e|twɛlv|트웰브|열둘|place
quick|q[u]ick|kwɪk|퀵|빠른|place,sent
seven|se[v]en|ˈsɛ.vən|세븐|일곱|place,sent
food|[f]ood|fud|푸드|음식|sent
fresh|[f]resh|frɛʃ|프레시|신선한|sent
office|o[ff]ice|ˈɔ.fəs|오피스|사무실|sent
fourth|[f]ourth|fɔrθ|포스|네 번째|sent
floor|[f]loor|flɔr|플로어|층 · 바닥|sent
photo|[ph]oto|ˈfoʊ.toʊ|포토|사진|sent
phone|[ph]one|foʊn|폰|전화기|sent
sofa|so[f]a|ˈsoʊ.fə|소파|소파|sent
left|le[f]t|lɛft|레프트|두고 왔다 · 왼쪽|sent
shelf|shel[f]|ʃɛlf|셸프|선반|sent
have|ha[v]e|hæv||가지다 · 있다|sent
never|ne[v]er|ˈnɛ.vɚ|네버|절대 ~않다|sent
give|gi[v]e|gɪv||주다|sent
up|u[p]|ʌp|업|위로|sent
leave|lea[v]e|liv|리브|두다 · 떠나다|sent
stove|sto[v]e|stoʊv|스토브|레인지 · 난로|sent
we|[w]e|wi||우리|sent
walked|[w]alked|wɔkt|워크트|걸었다|sent
waiting|[w]aiting|ˈweɪ.tɪŋ|웨이팅|기다리는 중|sent
sweater|s[w]eater|ˈswɛ.tɚ|스웨터|스웨터|sent
warm|[w]arm|wɔrm|웜|따뜻한|sent
where|[wh]ere|wɛr||어디|sent
were|[w]ere|wɝ||~였다 · 있었다|sent
with|[w]ith|wɪθ||~와 함께|sent
was|[w]as|wʌz||~였다|sent
of|o[f]|ʌv||~의|sent
will|[w]ill|wɪl||~할 것이다|sent
table|ta[b]le|ˈteɪ.bəl|테이블|탁자 · 식탁|sent
sweet|s[w]eet|swit|스위트|달콤한|sent
pass|[p]ass|pæs|패스|건네주다|sent
wear|[w]ear|wɛr|웨어|입다|sent
when|[wh]en|wɛn||~할 때|sent
what's|[wh]at's|wʌts||~은 뭐예요|sent
votes|[v]otes|voʊts|보츠|표들|drill
boats|[b]oats|boʊts|보츠|배들|drill
`;
  const DICT = {};
  const PLAUS = { f: ['f', 'ff', 'ph', 'gh'], v: ['v', 'f'], w: ['w', 'wh', 'u'], p: ['p', 'pp'], b: ['b', 'bb'] };
  const DICT_WARN = [];
  DICT_SRC.trim().split('\n').forEach(line => {
    const [key, spell, ipa, ko, gloss, grp] = line.split('|');
    const k = key.toLowerCase();
    if (DICT[k]) { DICT[k].groups = DICT[k].groups.concat((grp || '').split(',').filter(Boolean)); return; }   // 같은 낱말의 두 번째 줄 = 묶음만 더함
    // 철자: [ ] 안의 글자 = f · v · w · p · b 소리를 적은 글자(차례대로)
    const marks = [];
    let plain = '';
    spell.replace(/\[([^\]]+)\]|([^[\]]+)/g, (m, inb, out) => {
      if (inb) { marks.push([plain.length, plain.length + inb.length]); plain += inb; } else plain += out;
      return m;
    });
    const syl = ipa.split('.').map(s => ({ st: /ˈ/.test(s), ph: phonesOf(s) }));
    if (syl.length === 1) syl[0].st = true;
    const ph = [].concat(...syl.map(s => s.ph));
    DICT[k] = { key: k, w: key, spell, plain, marks, ipa, ko: ko || null, gloss, groups: (grp || '').split(',').filter(Boolean), syl, ph };
  });
  FV.DICT = DICT;
  const entry = w => DICT[String(w).toLowerCase().replace(/[.,!?]+$/, '').replace(/’/g, "'")] || null;
  FV.entry = entry;
  // 화면에 보일 IPA: 음절 점은 센 음절 표시(ˈ) 앞에서는 빼요 (ə.ˈweɪ → əˈweɪ)
  FV.ipa = w => { const e = entry(w); return e ? '/' + e.ipa.replace(/\.(?=[ˈˌ])/g, '') + '/' : ''; };
  FV.nSyl = w => { const e = entry(w); return e ? e.syl.length : 0; };
  FV.stressAt = w => { const e = entry(w); return e ? Math.max(0, e.syl.findIndex(s => s.st)) : 0; };

  /* ---------- 자리: 음절에서 계산 ---------- */
  const POS = {
    start: { ko: '처음', long: '낱말 처음',
      say: '낱말 처음 — 한국어식으로는 f 소리가 ㅍ, v 소리가 ㅂ이 되어 짝 낱말과 같은 표기가 되기 쉬워요(팬 · 베리). 소리를 내기 전에 입 모양부터 만들어요.' },
    cluster: { ko: '묶음', long: '자음과 붙은 자리(묶음)',
      say: '자음과 붙은 자리 — fly · free처럼 뒤에 l · r 소리가 오면 한국어식으로 으를 넣기 쉬워요(플라이). swim · quick의 w 소리는 앞 자음을 낼 때 이미 입술을 모아 둬요.' },
    mid: { ko: '가운데', long: '낱말 가운데',
      say: '낱말 가운데 — 모음 사이에서는 바람과 떨림이 짧게 지나가 놓치기 쉬워요. 윗니가 입술에 닿는 순간을 지켜요(coffee · seven).' },
    end: { ko: '끝', long: '낱말 끝 · 자음 앞',
      say: '낱말 끝 — 한국어식으로는 f · v 소리 뒤에 으를 붙여요(리프 · 러브 · 골프). 영어는 윗니를 입술에 댄 채 바람(f)이나 떨림(v)으로 끝내요.' },
  };
  FV.POS = POS;
  FV.POS_ORDER = ['start', 'cluster', 'mid', 'end'];
  // 낱말 속 f · v · w · p · b 소리마다 { i(전체 음소 번호), ph, pos, prev, next, syl(음절 번호) }
  function labials(w) {
    const e = typeof w === 'object' ? w : entry(w);
    if (!e) return [];
    const out = [];
    let i = 0;
    e.syl.forEach((s, si) => {
      const v = s.ph.findIndex(isV);
      s.ph.forEach((ph, k) => {
        const gi = i + k;
        if (LAB.indexOf(ph) >= 0) {
          let pos;
          if (k < v) { const onset = v; pos = onset > 1 ? 'cluster' : si === 0 ? 'start' : 'mid'; }
          else pos = 'end';
          out.push({ i: gi, ph, pos, prev: e.ph[gi - 1], next: e.ph[gi + 1], syl: si, role: FV.role(ph) });
        }
      });
      i += s.ph.length;
    });
    return out;
  }
  FV.labials = labials;
  FV.targets = w => labials(w).filter(x => x.role === 'a');
  FV.posOf = (w, ph) => { const L = labials(w).filter(x => !ph || x.ph === ph); return L.length ? L[0].pos : null; };

  /* ---------- 한국어식 표기 (국립국어원 외래어 표기법 제3장 제1절) ----------
     [f] → ㅍ · [v] → ㅂ(제5항 마찰음 — 어말 · 자음 앞은 ‘으’를 붙여 프 · 브) · [b] → ㅂ(어말 · 자음 앞은 브)
     [p] → ㅍ, 짧은 모음 뒤의 어말이나 짧은 모음과 (유음 · 비음 아닌) 자음 사이 → 받침 ㅂ(컵 · 랩)
     [w] → 뒤 모음과 합쳐 와 · 왜 · 워 · 웨 · 위, [wu] · [wʊ] → 우(w가 빠짐: 우드 · 우먼) (제9항 반모음)
     → 한글을 차례대로 단위로 나눠 낱말의 f · v · w · p · b 소리와 맞춰요 */
  function hangul(s) {
    const out = [];
    for (const ch of String(s)) {
      const c = ch.charCodeAt(0) - 0xAC00;
      if (c < 0 || c > 11171) { out.push({ ch, on: -1, vo: -1, coda: -1 }); continue; }
      out.push({ ch, on: Math.floor(c / 588), vo: Math.floor((c % 588) / 28), coda: c % 28 });
    }
    return out;
  }
  FV.hangul = hangul;
  const GLIDE = [9, 10, 14, 15, 16];        // ㅘ ㅙ ㅝ ㅞ ㅟ
  // 한글 → 단위 [{ kind: 'P'(첫소리 ㅍ) | 'B'(첫소리 ㅂ) | 'Pc'(받침 ㅂ) | 'W'(와 · 워 · 웨 · 위 · 왜) | 'W0'(ㅇ + ㅜ = w가 빠진 우), at: 음절 번호 }]
  function koUnits(ko) {
    const out = [];
    hangul(ko).forEach((s, k) => {
      if (s.on === 17) out.push({ kind: 'P', at: k });
      if (s.on === 7) out.push({ kind: 'B', at: k });
      if (s.on === 11 && s.vo === 13) out.push({ kind: 'W0', at: k });
      if (GLIDE.indexOf(s.vo) >= 0) out.push({ kind: 'W', at: k });
      if (s.coda === 17) out.push({ kind: 'Pc', at: k });
    });
    return out;
  }
  FV.koUnits = koUnits;
  const SHORT = ['ɪ', 'ɛ', 'æ', 'ʌ', 'ʊ', 'ɑ'];
  // 낱말의 f · v · w · p · b 소리 → 기대하는 단위
  function koExpect(w) {
    return labials(w).map(L => {
      let kind;
      if (L.ph === 'f') kind = 'P';
      else if (L.ph === 'v' || L.ph === 'b') kind = 'B';
      else if (L.ph === 'w') kind = (L.next === 'u' || L.next === 'ʊ') ? 'W0' : 'W';
      else kind = (L.pos === 'end' && SHORT.indexOf(L.prev) >= 0 && (!L.next || (isC(L.next) && ['l', 'r', 'm', 'n'].indexOf(L.next) < 0))) ? 'Pc' : 'P';
      return { kind, L };
    });
  }
  FV.koExpect = koExpect;
  FV.WU_SAY = '우 앞의 w 소리 — 한국어식으로는 w 소리가 빠져요(wood 우드 · woman 우먼). 영어는 우 앞에서도 입술을 먼저 꼭 모았다가 풀며 우로 넘어가요.';
  FV.KO_KIND = { P: '첫소리 ㅍ', B: '첫소리 ㅂ', Pc: '받침 ㅂ', W: '와 · 워 · 웨 · 위 · 왜', W0: '우 (w가 빠짐)' };
  // 한글 음절마다 역할: 'f' · 'v' · 'w' · 'w0'(빠진 w) · 'p' · 'b' · null (그 한글이 영어의 어느 소리를 적었나)
  FV.koMarks = function (w) {
    const e = entry(w);
    if (!e || !e.ko) return [];
    const U = koUnits(e.ko), X = koExpect(e), marks = hangul(e.ko).map(() => null);
    if (U.length !== X.length) return marks;
    U.forEach((u, k) => { marks[u.at] = u.kind === 'W0' ? 'w0' : X[k].L.ph; });
    return marks;
  };
  // 짝이 같은 한국어식 표기가 되나 (팬 = 팬 · 커프 ≠ 컵)
  FV.koSame = (a, b) => { const A = entry(a), B = entry(b); return !!(A && B && A.ko && A.ko === B.ko); };

  /* ---------- 철자 속 f · v · w · p · b 글자 (영상 · 페이지에서 그 글자만 칠하기) ---------- */
  function spans(word) {
    const e = entry(word);
    if (!e) return [];
    const L = labials(e);
    if (L.length !== e.marks.length) return [{ bad: true }];
    return e.marks.map((m, k) => ({ s: m[0], e: m[1], ph: L[k].ph, pos: L[k].pos, role: L[k].role }));
  }
  FV.spans = spans;
  // 문장 → [{ t, ph, role, pos, w }] 조각
  FV.segs = function (text) {
    const out = [];
    String(text).split(/(\s+)/).forEach(tok => {
      if (!tok) return;
      const m = tok.match(/^([^A-Za-z'’]*)([A-Za-z'’][A-Za-z'’-]*?)([^A-Za-z]*)$/);
      if (!m) { out.push({ t: tok, ph: null }); return; }
      if (m[1]) out.push({ t: m[1], ph: null });
      const w = m[2], e = entry(w), sp = e ? spans(w).filter(x => !x.bad) : [];
      let at = 0;
      sp.forEach(x => {
        if (x.s > at) out.push({ t: w.slice(at, x.s), ph: null, w });
        out.push({ t: w.slice(x.s, x.e), ph: x.ph, role: x.role, pos: x.pos, w });
        at = x.e;
      });
      if (at < w.length) out.push({ t: w.slice(at), ph: null, w });
      if (m[3]) out.push({ t: m[3], ph: null });
    });
    return out;
  };
  // 문장 속 소리 수 { f, v, w, p, b }
  FV.countIn = text => FV.segs(text).reduce((o, s) => { if (s.ph) o[s.ph]++; return o; }, { f: 0, v: 0, w: 0, p: 0, b: 0 });

  /* ---------- 최소 대립쌍: 소리 하나만 f ↔ p · v ↔ b · w ↔ v로 다른가 ---------- */
  const KINDS = { fp: ['f', 'p'], vb: ['v', 'b'], wv: ['w', 'v'] };
  FV.KINDS = KINDS;
  FV.KIND_KO = { fp: 'f · p', vb: 'v · b', wv: 'w · v' };
  function pairDiff(a, b) {
    const A = entry(a), B = entry(b);
    if (!A || !B) return { ok: false, why: '사전에 없음' };
    if (A.ph.length !== B.ph.length) return { ok: false, why: '소리 수가 다름' };
    const d = [];
    A.ph.forEach((p, i) => { if (p !== B.ph[i]) d.push(i); });
    if (d.length !== 1) return { ok: false, why: `다른 소리 ${d.length}개` };
    const i = d[0], x = A.ph[i], y = B.ph[i];
    const kind = Object.keys(KINDS).find(k => KINDS[k][0] === x && KINDS[k][1] === y) || null;
    const rev = Object.keys(KINDS).find(k => KINDS[k][0] === y && KINDS[k][1] === x) || null;
    if (!kind && !rev) return { ok: false, why: `${x} ↔ ${y}` };
    const L = labials(A).find(q => q.i === i), L2 = labials(B).find(q => q.i === i);
    return { ok: true, i, kind: kind || rev, a: kind ? a : b, b: kind ? b : a, pos: L.pos, samePos: L.pos === L2.pos, x, y };
  }
  FV.pairDiff = pairDiff;

  /* ---------- 짝 낱말 22 (듣고 가르기 · 영상 · 연습 문제) — a = f · v · w 쪽, b = 짝 ---------- */
  FV.PAIRS = [
    ['fan', 'pan'], ['fine', 'pine'], ['fast', 'past'], ['fork', 'pork'], ['feel', 'peel'], ['fool', 'pool'],
    ['fleas', 'please'], ['suffer', 'supper'], ['leaf', 'leap'], ['wife', 'wipe'], ['cuff', 'cup'], ['laugh', 'lap'],
    ['very', 'berry'], ['vote', 'boat'], ['vest', 'best'], ['van', 'ban'], ['vet', 'bet'], ['curve', 'curb'],
    ['wine', 'vine'], ['west', 'vest'], ['wet', 'vet'], ['while', 'vile'],
  ].map(([a, b]) => { const d = pairDiff(a, b); return { a, b, kind: d.kind, pos: d.pos, id: a + '-' + b, same: FV.koSame(a, b) }; });
  FV.pairById = id => FV.PAIRS.find(p => p.id === id) || null;
  // vest · vet은 짝이 둘이라(best · west, bet · wet) 짝은 늘 정해서 넘겨요
  FV.pairsOf = w => FV.PAIRS.filter(p => p.a === w || p.b === w);

  /* ---------- 목소리 (듣고 가르기: 미국식 목소리 넷) ---------- */
  FV.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '미국 여성 ①' },
    { sp: 'tf', ko: '차분한 선생님', who: '미국 여성 ②' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성 ③' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];

  /* ---------- 입 그림 (EN.mouth) — 소리마다 자세 · 목 울림 ---------- */
  FV.MOUTH = {
    f: { pose: 'f', voice: false, ko: '윗니 끝을 아랫입술에 · 바람은 계속 · 목은 울리지 않음' },
    v: { pose: 'f', voice: true, ko: 'f 소리와 같은 입 · 목을 울림' },
    w: { pose: 'w', voice: true, ko: '입술을 동그랗게 모아 내밀었다가 다음 모음으로' },
    p: { pose: 'p', voice: false, ko: '두 입술을 닫았다가 터뜨림 · 목은 울리지 않음' },
    b: { pose: 'p', voice: true, ko: '두 입술을 닫았다가 터뜨림 · 목을 울림' },
  };

  /* ---------- 낱말 묶음 (영상 · 직접 해 보기) ---------- */
  FV.SETS = {
    fStart: ['fan', 'fine', 'feel', 'fork'],
    fEnd: ['leaf', 'laugh'],
    vbPairs: [['vote', 'boat'], ['vest', 'best'], ['van', 'ban']],
    wGlide: ['wine', 'water', 'west', 'win'],
    wu: ['wood', 'woman', 'would'],
    place: { start: ['fan', 'very', 'wine'], cluster: ['fly', 'free', 'swim', 'twelve', 'quick'], mid: ['coffee', 'seven', 'away'], end: ['leaf', 'five', 'love', 'golf'] },
  };
  // 외래어 함정 16: 줄마다 넷 — f → ㅍ · v → ㅂ · ‘우’ 앞 w 빠짐 · 섞어서
  FV.LOAN = [
    { w: 'coffee', trap: 'f' }, { w: 'file', trap: 'f' }, { w: 'fork', trap: 'f' }, { w: 'golf', trap: 'f' },
    { w: 'video', trap: 'v' }, { w: 'service', trap: 'v' }, { w: 'van', trap: 'v' }, { w: 'love', trap: 'v' },
    { w: 'wood', trap: 'wu' }, { w: 'woman', trap: 'wu' }, { w: 'wool', trap: 'wu' }, { w: 'wolf', trap: 'wu' },
    { w: 'five', trap: 'mix' }, { w: 'Wi-Fi', trap: 'mix' }, { w: 'wave', trap: 'mix' }, { w: 'favorite', trap: 'mix' },
  ];
  FV.TRAP = {
    f: { ko: 'f → ㅍ', why: '윗니를 아랫입술에 대고 바람을 이어요. 두 입술을 닫지 않아요' },
    v: { ko: 'v → ㅂ', why: '윗니를 아랫입술에 대고 목을 울려요. 두 입술을 닫지 않아요' },
    wu: { ko: '우 앞 w 빠짐', why: '우 앞에서도 입술을 먼저 꼭 모았다가 풀며 시작해요' },
    mix: { ko: '섞어서', why: '한 낱말에 f · v · w 소리가 둘 들어 있어요. 소리마다 입술이 할 일을 따로 정해요' },
  };
  // 영상 · 페이지가 ‘같은 표기’ · ‘다른 표기’라고 말하는 짝 (check가 엔진으로 확인)
  FV.CLAIMS = { same: [['fan', 'pan'], ['very', 'berry'], ['van', 'ban'], ['leaf', 'leap']], diff: [['cuff', 'cup'], ['coffee', 'copy'], ['wine', 'vine']] };

  /* ---------- 음절 수: 영어(모음 수) · 한국어식(한글 음절 수) ---------- */
  FV.syl = w => { const e = entry(w); return e ? e.ph.filter(isV).length : 0; };
  FV.koSyl = w => { const e = entry(w); return e && e.ko ? [...e.ko].length : 0; };
  // 한국어식 표기에서 넣은 ‘으’ 음절(모음 ㅡ) — 영어에 없는 모음. 음절이 늘어난 만큼만, 뒤에서부터
  FV.koInserted = function (w) {
    const e = entry(w);
    if (!e || !e.ko) return [];
    const extra = FV.koSyl(w) - FV.syl(w);
    if (extra <= 0) return [];
    const u = [];
    hangul(e.ko).forEach((s, k) => { if (s.vo === 18) u.push(k); });
    return u.length <= extra ? u : u.slice(u.length - extra);
  };

  /* ---------- 문장 (영상 08장 · 따라 말하기 28) — 묶음마다 일곱: f · v · w · 섞어서 ---------- */
  FV.GROUPS = { f: 'f 소리', v: 'v 소리', w: 'w 소리', mix: '섞어서' };
  FV.GROUP_ORDER = ['f', 'v', 'w', 'mix'];
  FV.SENT = [
    { grp: 'f', en: 'I feel fine.', ko: '기분이 좋아요.' },
    { grp: 'f', en: 'This food is fresh.', ko: '이 음식은 신선해요.' },
    { grp: 'f', en: 'My office is on the fourth floor.', ko: '제 사무실은 4층에 있어요.' },
    { grp: 'f', en: 'I need a fork.', ko: '포크가 필요해요.' },
    { grp: 'f', en: "Don't laugh at my photo.", ko: '제 사진을 보고 웃지 마세요.' },
    { grp: 'f', en: 'The phone is on the sofa.', ko: '전화기는 소파 위에 있어요.' },
    { grp: 'f', en: 'I left it on the shelf.', ko: '선반 위에 두고 왔어요.' },
    { grp: 'v', en: 'Thank you very much.', ko: '정말 고마워요.' },
    { grp: 'v', en: 'I love this video.', ko: '이 영상 정말 좋아요.' },
    { grp: 'v', en: 'I have seven classes.', ko: '수업이 일곱 개 있어요.' },
    { grp: 'v', en: 'Never give up.', ko: '절대 포기하지 마세요.' },
    { grp: 'v', en: 'The service is very good.', ko: '서비스가 아주 좋아요.' },
    { grp: 'v', en: 'Leave it on the stove.', ko: '레인지 위에 두세요.' },
    { grp: 'v', en: 'Did you vote?', ko: '투표했어요?' },
    { grp: 'w', en: 'Would you like some water?', ko: '물 좀 드릴까요?' },
    { grp: 'w', en: 'We walked in the woods.', ko: '우리는 숲속을 걸었어요.' },
    { grp: 'w', en: 'The woman is waiting.', ko: '그 여자분이 기다리고 있어요.' },
    { grp: 'w', en: 'This wool sweater is warm.', ko: '이 털 스웨터는 따뜻해요.' },
    { grp: 'w', en: 'Where were you?', ko: '어디 있었어요?' },
    { grp: 'w', en: 'Swim with me.', ko: '나랑 같이 수영해요.' },
    { grp: 'w', en: 'That was quick.', ko: '빨리 끝났네요.' },
    { grp: 'mix', en: 'A cup of coffee, please.', ko: '커피 한 잔 주세요.' },
    { grp: 'mix', en: 'My wife will wipe the table.', ko: '아내가 식탁을 닦을 거예요.' },
    { grp: 'mix', en: 'This berry is very sweet.', ko: '이 베리는 정말 달아요.' },
    { grp: 'mix', en: 'Pass me the fan.', ko: '선풍기 좀 건네줘요.' },
    { grp: 'mix', en: 'Is there free Wi-Fi here?', ko: '여기 무료 와이파이 있어요?' },
    { grp: 'mix', en: "Wear a vest when it's cold.", ko: '추울 때는 조끼를 입어요.' },
    { grp: 'mix', en: "What's your favorite food?", ko: '가장 좋아하는 음식이 뭐예요?' },
  ];

  /* ---------- 음성 인식: 들은 말이 목표 낱말인가, 짝 낱말인가 ----------
     인식기는 낱말을 철자로 돌려줘요. 소리가 같은 다른 낱말(wood = would)도 그 소리로 쳐요 */
  const SAME = {
    past: ['passed'], peel: ['peal'], fleas: ['flees'], please: ['pleas'], berry: ['bury'], curb: ['kerb'],
    wine: ['whine'], wet: ['whet'], while: ['wile'], wood: ['would'], would: ['wood'], vote: [], lap: ['lapp'],
  };
  FV.SAME = SAME;
  const words = s => String(s || '').toLowerCase().replace(/’/g, "'").replace(/[^a-z' -]+/g, ' ').split(/\s+/).filter(Boolean);
  const has = (list, w) => list.indexOf(w) >= 0 || (SAME[w] || []).some(x => list.indexOf(x) >= 0);
  // alts: 인식 후보 글 목록(첫째가 가장 그럴듯함) → { verdict: 'target' | 'partner' | 'maybe' | 'other' | 'none', heard }
  FV.heard = function (target, alts, partner) {
    alts = (alts || []).filter(Boolean);
    if (!alts.length) return { verdict: 'none', heard: '', partner };
    const top = words(alts[0]);
    if (has(top, target)) return { verdict: 'target', heard: alts[0], partner };
    if (partner && has(top, partner)) return { verdict: 'partner', heard: alts[0], partner };
    const k = alts.findIndex(a => has(words(a), target));
    if (k > 0) return { verdict: 'maybe', heard: alts[0], rank: k + 1, partner };
    return { verdict: 'other', heard: alts[0], partner };
  };
  FV.HEARD_KO = {
    target: '목표 낱말로 들었어요',
    partner: '짝 낱말로 들었어요',
    maybe: '첫째 후보는 아니지만 후보에 있었어요',
    other: '다른 낱말로 들었어요',
    none: '아무 말도 듣지 못했어요',
  };

  /* ---------- 따라 말하기: 낱말 맞추기 (들린 낱말 초록 · 빠진 낱말 주황) ---------- */
  const norm = w => w.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9'-]/g, '');
  FV.compareWords = function (target, heard) {
    const T = String(target).split(/\s+/).filter(Boolean).map(w => ({ w, n: norm(w) }));
    const Hs = words(heard).map(norm);
    const used = Hs.map(() => false);
    let hit = 0;
    const alike = (h, n) => h === n || (SAME[n] || []).indexOf(h) >= 0 || h.replace(/-/g, '') === n.replace(/-/g, '');
    const marks = T.map(t => {
      if (!t.n) return { w: t.w, ok: true };
      const k = Hs.findIndex((h, i) => !used[i] && alike(h, t.n));
      if (k >= 0) { used[k] = true; hit++; return { w: t.w, ok: true }; }
      return { w: t.w, ok: false };
    });
    const total = T.filter(t => t.n).length;
    return { marks, hit, total, ratio: total ? hit / total : 0 };
  };

  /* ---------- 연습 문제: 듣고 고르기 16 ----------
     kind: word(어느 낱말) · sent(문장 속 어느 낱말) · same(두 낱말이 같았나 — 소리가 같으면 같음) · ko(한국어식으로 읽은 쪽은)
     a: 정답 보기 번호(0부터). 소리는 sp의 목소리(ko 문제의 한글은 한국어 목소리) */
  FV.DRILL = [
    { kind: 'word', sp: 'um', say: 'fan', opts: ['pan', 'fan'], a: 1 },
    { kind: 'word', sp: 'uf', say: 'berry', opts: ['berry', 'very'], a: 0 },
    { kind: 'sent', sp: 'tf', say: 'Can I use the pan?', frame: 'Can I use the ___?', opts: ['fan', 'pan'], a: 1, ko: '냄비를 써도 돼요?' },
    { kind: 'same', sp: 'tc', say: ['vote', 'boat'], opts: ['같아요', '달라요'], a: 1 },
    { kind: 'word', sp: 'tf', say: 'wine', opts: ['wine', 'vine'], a: 0 },
    { kind: 'ko', sp: 'uf', say: ['wood', '우드'], opts: ['첫째 소리', '둘째 소리'], a: 1 },
    { kind: 'word', sp: 'tc', say: 'leap', opts: ['leaf', 'leap'], a: 1 },
    { kind: 'sent', sp: 'um', say: 'Can you feel it?', frame: 'Can you ___ it?', opts: ['feel', 'peel'], a: 0, ko: '느껴져요?' },
    { kind: 'same', sp: 'uf', say: ['wood', 'would'], opts: ['같아요', '달라요'], a: 0 },
    { kind: 'word', sp: 'um', say: 'vest', opts: ['best', 'vest'], a: 1 },
    { kind: 'sent', sp: 'tc', say: 'Count the votes.', frame: 'Count the ___.', opts: ['votes', 'boats'], a: 0, ko: '표를 세어 봐요.' },
    { kind: 'same', sp: 'tf', say: ['curve', 'curve'], opts: ['같아요', '달라요'], a: 0 },
    { kind: 'word', sp: 'um', say: 'cup', opts: ['cuff', 'cup'], a: 1 },
    { kind: 'ko', sp: 'tc', say: ['베리', 'very'], opts: ['첫째 소리', '둘째 소리'], a: 0 },
    { kind: 'sent', sp: 'uf', say: 'This vine is old.', frame: 'This ___ is old.', opts: ['wine', 'vine'], a: 1, ko: '이 포도나무는 오래됐어요.' },
    { kind: 'word', sp: 'tf', say: 'suffer', opts: ['suffer', 'supper'], a: 0 },
  ];
  const isKo = s => /[가-힣]/.test(s);
  FV.isKo = isKo;
  // 문제의 목표 낱말(정답 낱말 · 같은가 문제는 첫 낱말 · 한국어식 문제는 영어 낱말)
  FV.drillWord = q => q.kind === 'same' ? q.say[0] : q.kind === 'ko' ? q.say.find(s => !isKo(s)) : q.kind === 'sent' ? q.opts[q.a] : q.say;
  FV.drillWords = q => q.kind === 'same' ? q.say.slice() : q.kind === 'ko' ? q.say.filter(s => !isKo(s)) : q.opts.slice();
  // 소리가 같은 두 낱말인가 (wood · would)
  FV.homophone = (a, b) => { const A = entry(a), B = entry(b); return !!(A && B && A.ph.join(' ') === B.ph.join(' ')); };
  // 힌트 세 단계(엔진이 짝의 종류 · 자리에서 만들어요)
  const LISTEN_HINT = {
    fp: 'f 소리는 바람 새는 소리가 이어지고, p 소리는 막혔다가 톡 터지며 바람이 짧게 끝나요.',
    vb: 'v 소리는 지잉 떨리는 소리가 이어지고, b 소리는 막혔다가 터지며 곧바로 모음이 나와요.',
    wv: 'w 소리는 우 하고 모은 입술이 풀리며 미끄러지듯 시작하고, v 소리는 윗니와 입술 사이에서 지잉 떨리며 시작해요.',
  };
  const MOUTH_HINT = {
    fp: 'f 소리는 윗니 끝을 아랫입술에 대고 바람을 이어요. p 소리는 두 입술을 닫았다가 터뜨려요.',
    vb: 'v 소리는 윗니 끝을 아랫입술에 대고 목을 울려요. b 소리는 두 입술을 닫았다가 터뜨려요(목은 울림).',
    wv: 'w 소리는 입술을 동그랗게 모아 내밀고(이에 닿지 않음), v 소리는 윗니 끝을 아랫입술에 대요.',
  };
  FV.hints = function (q) {
    if (q.kind === 'ko') {
      const en = FV.drillWord(q), e = entry(en), L = FV.targets(en)[0];
      return [
        { head: '① 듣고 가르기', text: '한국어식으로 읽으면 f 소리가 ㅍ, v 소리가 ㅂ처럼 입술을 닫았다 터지고, 우 앞의 w 소리는 빠지고, 끝에 으가 붙어요.' },
        { head: '② 입 모양', text: L ? MOUTH_HINT[L.ph === 'w' ? 'wv' : L.ph === 'v' ? 'vb' : 'fp'] : '' },
        { head: '③ 낱말 · 문장 속에서', text: `${en} → 한국어식 ${e.ko}. ${L ? POS[L.pos].say : ''}` },
      ];
    }
    const ws = FV.drillWords(q).filter(w => entry(w));
    let d = ws.length > 1 ? pairDiff(ws[0], ws[1]) : { ok: false };
    if (!d.ok) { const p = FV.pairsOf(ws[0])[0]; d = p ? pairDiff(p.a, p.b) : { ok: false }; }
    // 짝이 없는 낱말(wood · would)은 낱말의 첫 f · v · w 소리로
    const L0 = FV.targets(ws[0])[0];
    const kind = d.ok ? d.kind : L0 ? (L0.ph === 'w' ? 'wv' : L0.ph === 'v' ? 'vb' : 'fp') : 'fp', pos = d.ok ? d.pos : L0 ? L0.pos : 'start';
    const step1 = q.kind === 'same' && FV.homophone(q.say[0], q.say[1])
      ? '철자는 달라도 소리가 같은 낱말이 있어요. 두 낱말의 시작과 끝을 하나씩 견줘 들어요.'
      : (pos === 'end' ? '끝을 들어요. ' : '시작을 들어요. ') + LISTEN_HINT[kind];
    const wu = L0 && L0.ph === 'w' && (L0.next === 'u' || L0.next === 'ʊ');
    const step3 = wu ? FV.WU_SAY : `${POS[pos].long} 자리예요. ${POS[pos].say}` + (q.kind === 'sent' ? ' 문장 속에서는 두 낱말이 모두 말이 되니 소리만이 뜻을 정해요.' : '');
    return [
      { head: '① 듣고 가르기', text: step1 },
      { head: '② 입 모양', text: MOUTH_HINT[kind] },
      { head: '③ 낱말 · 문장 속에서', text: step3 },
    ];
  };

  /* ---------- 모든 글 (글꼴 미리 받기용) ---------- */
  FV.allText = () => Object.values(DICT).map(e => e.w + e.ipa + (e.ko || '') + e.gloss).join('') +
    FV.SENT.map(s => s.en + s.ko).join('') + Object.values(POS).map(p => p.ko + p.long + p.say).join('') +
    Object.values(FV.TRAP).map(t => t.ko + t.why).join('') + FV.VOICES.map(v => v.ko + v.who).join('') +
    Object.values(FV.MOUTH).map(m => m.ko).join('') + Object.values(FV.KO_KIND).join('') + Object.values(FV.GROUPS).join('') + FV.WU_SAY;

  /* ---------- 데이터 점검 ---------- */
  FV.check = function () {
    const warn = DICT_WARN.slice();
    const w = m => warn.push(m);
    // 사전: 철자 · 칠할 글자 수 · 글자가 그 소리를 적을 만한가
    Object.values(DICT).forEach(e => {
      if (e.plain.toLowerCase() !== e.key) w(`${e.key}: 철자 ${e.plain}이 낱말과 다름`);
      const L = labials(e);
      if (L.length !== e.marks.length) { w(`${e.key}: [ ] 글자 ${e.marks.length}개, f · v · w · p · b 소리 ${L.length}개`); return; }
      e.marks.forEach((m, k) => {
        const s = e.plain.slice(m[0], m[1]).toLowerCase();
        if (PLAUS[L[k].ph].indexOf(s) < 0) w(`${e.key}: ${L[k].ph} 소리를 ‘${s}’로 적음`);
        if (L[k].ph === 'v' && s === 'f' && e.key !== 'of') w(`${e.key}: f 글자의 v 소리는 of만`);
      });
      // 음절마다 모음이 하나
      e.syl.forEach((s, i) => { if (s.ph.filter(isV).length !== 1) w(`${e.key}: ${i + 1}번째 음절의 모음 수 ${s.ph.filter(isV).length}`); });
      if (e.syl.length > 1 && e.syl.filter(s => s.st).length !== 1) w(`${e.key}: 센 음절 표시(ˈ)가 하나가 아님`);
    });
    // 짝: 소리 하나만, a 쪽이 f · v · w
    FV.PAIRS.forEach(p => {
      const d = pairDiff(p.a, p.b);
      if (!d.ok) { w(`짝 ${p.a} · ${p.b}: ${d.why}`); return; }
      if (d.a !== p.a) w(`짝 ${p.a} · ${p.b}: 이 편의 소리 쪽이 바뀜`);
      if (!d.samePos) w(`짝 ${p.a} · ${p.b}: 두 낱말의 자리가 다름`);
    });
    if (FV.PAIRS.length < 18 || FV.PAIRS.length > 22) w(`짝 ${FV.PAIRS.length}개 (18~22개)`);
    if (new Set(FV.PAIRS.map(p => p.id)).size !== FV.PAIRS.length) w('짝이 겹침');
    // 외래어 표기의 한글이 f · v · w · p · b 소리와 차례대로 맞나
    Object.values(DICT).forEach(e => {
      if (!e.ko) return;
      const U = koUnits(e.ko), X = koExpect(e);
      if (U.length !== X.length) { w(`${e.key}(${e.ko}): 한글 단위 ${U.map(u => u.kind).join(' ')} · 기대 ${X.map(x => x.kind).join(' ')}`); return; }
      U.forEach((u, k) => { if (u.kind !== X[k].kind) w(`${e.key}(${e.ko}): ${k + 1}번째는 ${FV.KO_KIND[u.kind]}, 기대 ${FV.KO_KIND[X[k].kind]}`); });
      // 끝의 f · v · b 뒤에는 으가 붙어야 (리프 · 러브 · 커브)
      labials(e).forEach(L => {
        if (L.pos === 'end' && L.ph !== 'w' && L.ph !== 'p' && !L.next && !/[프브]$/.test(e.ko)) w(`${e.key}(${e.ko}): 끝의 ${L.ph} 소리 뒤에 으가 없음`);
      });
    });
    // 짝과 외래어 · 묶음의 낱말이 사전에 있고 한국어식 표기가 있나
    FV.PAIRS.forEach(p => [p.a, p.b].forEach(x => { if (!entry(x) || !entry(x).ko) w(`짝 낱말에 한국어식 표기가 없음: ${x}`); }));
    const need = [].concat(FV.SETS.fStart, FV.SETS.fEnd, [].concat(...FV.SETS.vbPairs), FV.SETS.wGlide, FV.SETS.wu, ...Object.values(FV.SETS.place), FV.LOAN.map(x => x.w));
    need.forEach(x => { if (!entry(x)) w(`사전에 없음: ${x}`); else if (!entry(x).ko) w(`한국어식 표기가 없음: ${x}`); });
    // 영상 · 페이지가 말하는 ‘같은 표기’ · ‘다른 표기’
    FV.CLAIMS.same.forEach(([a, b]) => { if (!FV.koSame(a, b)) w(`같은 표기라고 했지만 다름: ${a} · ${b}`); });
    FV.CLAIMS.diff.forEach(([a, b]) => { if (FV.koSame(a, b)) w(`다른 표기라고 했지만 같음: ${a} · ${b}`); });
    // 자리 보기의 낱말: 그 자리에 f · v · w 소리가 있나
    Object.keys(FV.SETS.place).forEach(pos => FV.SETS.place[pos].forEach(x => { if (!FV.targets(x).some(L => L.pos === pos)) w(`자리 ${POS[pos].ko}: ${x}에 그 자리의 f · v · w 소리가 없음`); }));
    FV.SETS.wu.forEach(x => { if (!koUnits(entry(x).ko || '').some(u => u.kind === 'W0')) w(`${x}: ‘우’ 앞 w가 아님`); });
    FV.SETS.wGlide.forEach(x => { if (!koUnits(entry(x).ko || '').some(u => u.kind === 'W')) w(`${x}: 와 · 워 · 웨 · 위가 아님`); });
    // 외래어 16: 줄마다 넷, 함정의 종류가 엔진과 맞나
    if (FV.LOAN.length !== 16) w(`외래어 카드 ${FV.LOAN.length}개 (16개여야 함)`);
    ['f', 'v', 'wu', 'mix'].forEach(t => { const n = FV.LOAN.filter(x => x.trap === t).length; if (n !== 4) w(`외래어 ${t} 카드 ${n}개 (4개여야 함)`); });
    FV.LOAN.forEach(o => {
      const T = FV.targets(o.w), U = koUnits((entry(o.w) || {}).ko || '');
      const ok = o.trap === 'f' ? T.some(L => L.ph === 'f') && !T.some(L => L.ph !== 'f')
        : o.trap === 'v' ? T.some(L => L.ph === 'v') && !T.some(L => L.ph !== 'v')
          : o.trap === 'wu' ? U.some(u => u.kind === 'W0')
            : new Set(T.map(L => L.ph)).size >= 2;
      if (!ok) w(`외래어 ${o.w}: 함정 ${o.trap}이 소리와 맞지 않음`);
    });
    // 문장: 28개, 묶음마다 일곱, 그 소리가 문장에 있나, 낱말이 사전에 있나
    if (FV.SENT.length !== 28) w(`따라 말하기 문장 ${FV.SENT.length}개(28개여야 함)`);
    FV.GROUP_ORDER.forEach(gp => { const n = FV.SENT.filter(s => s.grp === gp).length; if (n !== 7) w(`문장 묶음 ${gp}: ${n}개(7개여야 함)`); });
    FV.SENT.forEach(s => {
      const c = FV.countIn(s.en);
      const ok = s.grp === 'mix' ? ['f', 'v', 'w', 'p', 'b'].filter(k => c[k]).length >= 2 && (c.f + c.v + c.w) > 0 : c[s.grp] > 0;
      if (!ok) w(`문장 "${s.en}": ${FV.GROUPS[s.grp]}이 없음`);
    });
    const sentWords = [];
    FV.SENT.concat(FV.DRILL.filter(q => q.kind === 'sent').map(q => ({ en: q.say }))).forEach(s => s.en.replace(/[A-Za-z'’][A-Za-z'’-]*/g, m => { sentWords.push(m); return m; }));
    sentWords.forEach(x => {
      const lx = x.toLowerCase();
      if (/[fvwpb]/.test(lx) && !entry(x)) w(`문장 낱말이 사전에 없음: ${x}`);
      if (entry(x) && spans(x).some(s => s.bad)) w(`글자 칠하기 실패: ${x}`);
    });
    // 연습 문제: 정답 위치 · 소리 · 보기 · 목소리
    if (FV.DRILL.length !== 16) w(`연습 문제 ${FV.DRILL.length}개 (16개여야 함)`);
    const pos2 = [0, 0];
    FV.DRILL.forEach((q, k) => {
      const n = `연습 ${k + 1}`;
      if (q.opts.length !== 2) w(`${n}: 보기는 둘`);
      pos2[q.a]++;
      if (q.kind === 'word') {
        if (q.opts[q.a] !== q.say) w(`${n}: 정답 ${q.opts[q.a]} ≠ 들려주는 ${q.say}`);
        if (!pairDiff(q.opts[0], q.opts[1]).ok) w(`${n}: 보기가 짝이 아님`);
      }
      if (q.kind === 'sent') {
        if (q.frame.replace('___', q.opts[q.a]) !== q.say) w(`${n}: 문장과 정답이 맞지 않음`);
        if (!pairDiff(q.opts[0], q.opts[1]).ok) w(`${n}: 보기가 짝이 아님`);
      }
      if (q.kind === 'same') {
        const same = q.say[0] === q.say[1] || FV.homophone(q.say[0], q.say[1]);
        if ((q.a === 0) !== same) w(`${n}: 같은가 정답이 엔진과 다름`);
        if (!same && !pairDiff(q.say[0], q.say[1]).ok) w(`${n}: 두 낱말이 짝이 아님`);
      }
      if (q.kind === 'ko') {
        const ki = q.say.findIndex(isKo), en = q.say.find(s => !isKo(s));
        if (ki !== q.a) w(`${n}: 한국어식 정답 위치가 틀림`);
        if (!entry(en) || entry(en).ko !== q.say[ki]) w(`${n}: 한글 ${q.say[ki]}이 ${en}의 한국어식 표기와 다름`);
      }
      if (['tc', 'tf', 'uf', 'um'].indexOf(q.sp) < 0) w(`${n}: 목소리 ${q.sp}`);
    });
    if (pos2[0] !== pos2[1]) w(`연습 문제 정답 위치가 한쪽으로 몰림: ${pos2.join(' / ')}`);
    // 입 그림: f 자세는 아랫입술이 윗니에 닿고, p는 입술이 닫히고, w는 둥글게 모으되 이에 닿지 않아야
    if (window.EN && EN.mouth && EN.mouth.lipTeeth) {
      const Mm = EN.mouth;
      if (!Mm.lipTeeth('f').touch) w('입 그림 f: 아랫입술이 윗니에 닿지 않음');
      if (Mm.lipsClosed('f')) w('입 그림 f: 입술이 닫힘');
      if (Mm.lipTeeth('p').touch || !Mm.lipsClosed('p')) w('입 그림 p: 두 입술이 닫히지 않았거나 윗니에 닿음');
      if (Mm.lipTeeth('w').touch || Mm.lipsClosed('w') || (Mm.pose('w').round || 0) < 0.9) w('입 그림 w: 둥근 입술이 아니거나 이에 닿음');
      ['rest', 'u', 'a'].forEach(p => { if (Mm.lipTeeth(p).touch) w(`입 그림 ${p}: 아랫입술이 윗니에 닿음`); });
      Object.keys(FV.MOUTH).forEach(ph => { try { Mm.pose(FV.MOUTH[ph].pose); } catch (e) { w(`입 그림 자세 없음: ${FV.MOUTH[ph].pose}`); } });
    } else w('입 그림(EN.mouth.lipTeeth)이 없음');
    warn.forEach(m => console.warn('[FV.check] ' + m));
    return warn.length;
  };
})();
