/* ㅅ · ㅈ 너머 — s · sh · z · zh · y — 규칙 엔진 (SZ)
 *
 * 맞고 틀림과 그림의 바탕은 모두 여기서 계산해요. 영상 · 직접 해 보기 · 놀이터 · 연습 문제 · 퀴즈가 같은 결과를 써요.
 *   발음 사전(미국 표준 발음 General American의 IPA, 넓게 적음 · 음절은 . · 센 음절 앞에 ˈ)
 *   → 낱말 속 s · z · zh · y 소리(이 편의 소리)와 sh · j 소리(짝 소리)의 자리(처음 · 묶음 · 가운데 · 끝, 음절에서 계산)와 ‘이 앞’인지
 *   → 외래어 표기의 한글이 그 소리를 표기법대로 적었나(s · sh → ㅅ, z · zh · j → ㅈ, 이 앞의 y → 빠짐, 끝의 으 · 이) · 짝 낱말이 같은 표기가 되나
 *   최소 대립쌍(짝 낱말)이 정말 소리 하나(s ↔ sh · z ↔ j · zh ↔ j · y ↔ 없음)만 다른가 · 음성 인식이 들은 낱말이 목표 낱말인가 짝 낱말인가
 *
 * 화면 · 자막에서 쓰는 소리 이름(발음 기호 대신 철자): s /s/ · sh /ʃ/ · z /z/ · zh /ʒ/ · j /dʒ/ · y /j/
 * 사전 한 줄: 낱말 | 철자(이 소리들을 적은 글자를 [ ]로) | IPA | 한국어식(외래어 표기법을 따른 한글, 그 소리를 적은 음절을 [ ]로, 없으면 빈칸) | 뜻 | 묶음
 *
 * 단순하게 줄인 것(README · 화면 각주에 적음)
 *   - IPA는 넓게 적어요(모음 사이 t의 짧은 ㄹ 소리 · 약한 모음의 변이 등은 적지 않음).
 *   - 자리는 음절로 나눠 정해요: 첫 음절의 홀로 선 첫소리 = 처음 · 다른 자음과 붙은 첫소리 = 묶음 · 둘째 음절부터의 홀로 선 첫소리 = 가운데 · 음절 끝 = 끝.
 *   - 외래어 표기는 국립국어원 외래어 표기법(제3항 마찰음 · 제4항 파찰음 · 제9항 반모음)을 따르되, 굳어진 표기(제로)는 그대로 써요.
 *     엔진은 [ ]로 표시한 음절의 첫소리(ㅅ · ㅈ · ㅇ)와 모음(이 · 으 · 야 여 요 유 예 얘)만 맞춰 봐요.
 */
(function () {
  'use strict';
  const SZ = (window.SZ = {});

  /* ---------- 소리(음소) ---------- */
  const VOW = ['aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'i', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ə', 'ɚ', 'ɝ', 'ɑ', 'ɔ', 'ʊ', 'u'];
  const CON = ['tʃ', 'dʒ', 'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j'];
  const UNITS = VOW.concat(CON).sort((a, b) => b.length - a.length);
  const isV = p => VOW.indexOf(p) >= 0;
  const isC = p => CON.indexOf(p) >= 0;
  SZ.isV = isV;
  // 이 편이 다루는 소리: s · z · zh · y(이 편의 소리, 노랑 mk-a) · sh · j(짝 소리, 하늘 mk-b)
  const TARGET = ['s', 'z', 'ʒ', 'j'], PARTNER = ['ʃ', 'dʒ'], LAB = TARGET.concat(PARTNER);
  SZ.TARGET = TARGET; SZ.PARTNER = PARTNER; SZ.LAB = LAB;
  SZ.role = ph => TARGET.indexOf(ph) >= 0 ? 'a' : PARTNER.indexOf(ph) >= 0 ? 'b' : null;
  // 화면 · 자막의 소리 이름 (발음 기호 대신 철자)
  const NAME = { s: 's', z: 'z', 'ʃ': 'sh', 'ʒ': 'zh', 'dʒ': 'j', j: 'y', y0: 'y' };
  SZ.NAME = NAME;
  SZ.IPA_OF = { s: '/s/', z: '/z/', 'ʃ': '/ʃ/', 'ʒ': '/ʒ/', 'dʒ': '/dʒ/', j: '/j/' };
  const HIGH_I = ['i', 'ɪ'];
  // IPA 한 음절 → 음소 목록 (강세 표시 ˈ ˌ는 빼요)
  function phonesOf(s) {
    s = String(s).replace(/[ˈˌ]/g, '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const u = UNITS.find(x => s.startsWith(x, i));
      if (!u) throw new Error('SZ: 모르는 소리 ' + s[i] + ' in ' + s);
      out.push(u); i += u.length;
    }
    return out;
  }
  const phones = ipa => phonesOf(String(ipa).replace(/\./g, ''));
  SZ.phones = phones;

  /* ---------- 발음 사전 ----------
     묶음: pair(짝 낱말) · loan(외래어 카드) · place(자리 보기) · sent(문장) · drill(연습 문제) · extra */
  const DICT_SRC = `
see|[s]ee|si|[시]|보다|pair,sent
she|[sh]e|ʃi|[시]|그녀|pair,sent
seat|[s]eat|sit|[시]트|자리 · 좌석|pair,sent
sheet|[sh]eet|ʃit|[시]트|(종이) 한 장 · 침대 시트|pair
sip|[s]ip|sɪp|[십]|한 모금(마시다)|pair,drill
ship|[sh]ip|ʃɪp|[십]|배|pair,sent,drill
sin|[s]in|sɪn|[신]|죄|pair
shin|[sh]in|ʃɪn|[신]|정강이|pair
sift|[s]ift|sɪft|[시]프트|체로 치다|pair,drill
shift|[sh]ift|ʃɪft|[시]프트|옮기다 · 교대 근무|pair,drill
sell|[s]ell|sɛl|[셀]|팔다|pair,drill
shell|[sh]ell|ʃɛl|[셸]|껍데기 · 껍질을 까다|pair,drill
save|[s]ave|seɪv|[세]이브|구하다 · 아끼다|pair,drill
shave|[sh]ave|ʃeɪv|[셰]이브|면도하다|pair,drill
sort|[s]ort|sɔrt|[소]트|종류 · 분류하다|pair
short|[sh]ort|ʃɔrt|[쇼]트|짧은|pair
lease|lea[s]e|lis|리[스]|임대(하다)|pair
leash|lea[sh]|liʃ|리[시]|(개의) 목줄|pair
mass|ma[ss]|mæs|매[스]|덩어리 · 많은 양|pair
mash|ma[sh]|mæʃ|매[시]|으깨다|pair
zest|[z]e[s]t|zɛst|[제][스]트|열정 · 레몬 껍질|pair
jest|[j]e[s]t|dʒɛst|[제][스]트|농담|pair
zig|[z]ig|zɪg|[지]그|(갈지자로) 꺾다|pair
jig|[j]ig|dʒɪg|[지]그|지그(빠른 춤)|pair
seize|[s]ei[z]e|siz|[시][즈]|붙잡다|pair
siege|[s]ie[g]e|sidʒ|[시][지]|포위 공격|pair
buzz|bu[zz]|bʌz|버[즈]|윙윙거리다|pair
budge|bu[dg]e|bʌdʒ|버[지]|조금 움직이다|pair
raise|rai[s]e|reɪz|레이[즈]|올리다|pair
rage|ra[g]e|reɪdʒ|레이[지]|격노 · 분노|pair
lesion|le[s]ion|ˈli.ʒən|리[전]|병변(몸에서 다친 곳)|pair
legion|le[g]ion|ˈli.dʒən|리[전]|군단 · 무리|pair
year|[y]ear|jɪr|[이]어|해 · 년|pair,sent
ear|ear|ɪr|이어|귀|pair
yeast|[y]ea[s]t|jist|[이][스]트|효모 · 이스트|pair,sent
east|ea[s]t|ist|이[스]트|동쪽|pair
yearn|[y]earn|jɝn|[연]|몹시 바라다|pair
earn|earn|ɝn|언|(돈을) 벌다|pair
yolk|[y]olk|joʊk|[요]크|노른자|pair
oak|oak|oʊk|오크|참나무|pair
city|[c]ity|ˈsɪ.ti|[시]티|도시|loan,sent
single|[s]ingle|ˈsɪŋ.gəl|[싱]글|하나의 · 혼자인|loan
system|[s]y[s]tem|ˈsɪs.təm|[시][스]템|체계 · 시스템|loan
silk|[s]ilk|sɪlk|[실]크|비단 · 실크|loan
zero|[z]ero|ˈzɪ.roʊ|[제]로|영(0)|loan,place,sent
zoom|[z]oom|zum|[줌]|확대하다 · 줌|loan
puzzle|pu[zz]le|ˈpʌ.zəl|퍼[즐]|퍼즐 · 수수께끼|loan
cheese|chee[s]e|tʃiz|치[즈]|치즈|loan,place
vision|vi[s]ion|ˈvɪ.ʒən|비[전]|시력 · 앞을 내다보는 힘|loan,place,sent
casual|ca[s]ual|ˈkæ.ʒu.əl|캐[주]얼|편한 · 평상시의|loan,sent
leisure|lei[s]ure|ˈli.ʒɚ|레[저]|여가 · 레저|loan
beige|bei[g]e|beɪʒ|베이[지]|베이지색|loan,place,sent
season|[s]ea[s]on|ˈsi.zən|[시][즌]|계절|loan
music|m[u][s]ic|ˈmju.zɪk|[뮤][직]|음악|loan,place,sent
jazz|[j]a[zz]|dʒæz|[재][즈]|재즈|loan,sent
massage|ma[ss]a[g]e|mə.ˈsɑʒ|마[사][지]|마사지 · 안마|loan
street|[s]treet|strit|[스]트리트|거리|place
sleep|[s]leep|slip|[슬]립|자다|place
smile|[s]mile|smaɪl|[스]마일|웃다 · 미소|place
basic|ba[s]ic|ˈbeɪ.sɪk|베이[식]|기본적인|place
busy|bu[s]y|ˈbɪ.zi|비[지]|바쁜|place,sent
bus|bu[s]|bʌs|버[스]|버스|place
fish|fi[sh]|fɪʃ|피[시]|물고기 · 생선|place
sit|[s]it|sɪt|[싯]|앉다|sent
zoo|[z]oo|zu|[주]|동물원|sent
zone|[z]one|zoʊn|[존]|구역 · 존|extra
easy|ea[s]y|ˈi.zi|이[지]|쉬운|sent
usually|[u][s]ually|ˈju.ʒu.ə.li|[유][주]얼리|보통 · 대개|sent
measure|mea[s]ure|ˈmɛ.ʒɚ|메[저]|재다|extra
television|televi[s]ion|ˈtɛ.lə.vɪ.ʒən|텔레비[전]|텔레비전|sent
pleasure|plea[s]ure|ˈplɛ.ʒɚ|플레[저]|기쁨|sent
decision|de[c]i[s]ion|dɪ.ˈsɪ.ʒən|디[시][전]|결정|sent
yield|[y]ield|jild|[일]드|양보하다|extra
yes|[y]e[s]|jɛs|[예][스]|네 · 응|sent
you|[y]ou|ju|[유]|너 · 당신|sent
young|[y]oung|jʌŋ|[영]|젊은|sent
yellow|[y]ellow|ˈjɛ.loʊ|[옐]로|노란|sent
yours|[y]our[s]|jɔrz||당신 것|sent
please|plea[s]e|pliz|플리[즈]|부디 · ~해 주세요|sent
here|here|hɪr||여기|sent
soon|[s]oon|sun||곧|sent
this|thi[s]|ðɪs||이 · 이것|sent
is|i[s]|ɪz||~이다|sent
safe|[s]afe|seɪf||안전한|sent
sing|[s]ing|sɪŋ||노래하다|sent
simple|[s]imple|ˈsɪm.pəl||간단한|sent
song|[s]ong|sɔŋ||노래|sent
sells|[s]ell[s]|sɛlz||판다|sent
sea|[s]ea|si||바다|sent
shells|[sh]ell[s]|ʃɛlz||조개껍데기들|sent
closed|clo[s]ed|kloʊzd||닫혀 있는|sent
today|today|tə.ˈdeɪ||오늘|sent
it's|it'[s]|ɪts||~이에요(it is)|sent
score|[s]core|skɔr||점수|sent
close|clo[s]e|kloʊz||닫다|sent
these|the[s]e|ðiz||이것들 · 이|sent
shoes|[sh]oe[s]|ʃuz||신발|sent
school|[s]chool|skul||학교|sent
was|wa[s]|wʌz||~였다|sent
clothes|clothe[s]|kloʊðz||옷|sent
my|my|maɪ||나의|sent
has|ha[s]|hæz||가지고 있다|sent
next|ne[x]t|nɛkst||다음의|sent
happy|happy|ˈhæ.pi||행복한|sent
some|[s]ome|sʌm||조금 · 약간의|sent
ready|ready|ˈrɛ.di||준비된|sent
last|la[s]t|læst||지난|sent
`;
  const DICT = {};
  const PLAUS = { s: ['s', 'ss', 'c', 'x'], z: ['z', 'zz', 's'], 'ʃ': ['sh', 'ti', 'ci', 'ch', 's'], 'ʒ': ['s', 'g', 'z'], 'dʒ': ['j', 'g', 'dg'], j: ['y', 'u'] };
  const DICT_WARN = [];
  // [ ] 표시 풀기: 'a[bc]d' → { plain: 'abcd', marks: [[1, 3]] }
  function unmark(src) {
    const marks = [];
    let plain = '';
    String(src).replace(/\[([^\]]+)\]|([^[\]]+)/g, (m, inb, out) => {
      if (inb) { marks.push([plain.length, plain.length + inb.length]); plain += inb; } else plain += out;
      return m;
    });
    return { plain, marks };
  }
  DICT_SRC.trim().split('\n').forEach(line => {
    const [key, spell, ipa, koSrc, gloss, grp] = line.split('|');
    const k = key.toLowerCase();
    if (DICT[k]) { DICT_WARN.push(`사전에 두 번: ${k}`); return; }
    const { plain, marks } = unmark(spell);
    const K = unmark(koSrc || '');
    const syl = ipa.split('.').map(s => ({ st: /ˈ/.test(s), ph: phonesOf(s) }));
    if (syl.length === 1) syl[0].st = true;
    const ph = [].concat(...syl.map(s => s.ph));
    DICT[k] = { key: k, w: key, spell, plain, marks, ipa, ko: K.plain || null, koAt: K.marks.map(m => m[0]), koSpan: K.marks, gloss, groups: (grp || '').split(',').filter(Boolean), syl, ph };
  });
  SZ.DICT = DICT;
  const entry = w => DICT[String(w).toLowerCase().replace(/[.,!?]+$/, '').replace(/’/g, "'")] || null;
  SZ.entry = entry;
  // 화면에 보일 IPA: 음절 점은 센 음절 표시(ˈ) 앞에서는 빼요 (mə.ˈsɑʒ → məˈsɑʒ)
  SZ.ipa = w => { const e = entry(w); return e ? '/' + e.ipa.replace(/\.(?=[ˈˌ])/g, '') + '/' : ''; };
  SZ.nSyl = w => { const e = entry(w); return e ? e.syl.length : 0; };
  SZ.stressAt = w => { const e = entry(w); return e ? Math.max(0, e.syl.findIndex(s => s.st)) : 0; };

  /* ---------- 자리: 음절에서 계산 ---------- */
  const POS = {
    start: { ko: '처음', long: '낱말 처음',
      say: '낱말 처음 — 이 앞의 s 소리가 한국어식 시처럼 sh 소리 쪽으로 가기 쉽고(see → she), z 소리는 ㅈ처럼 혀가 닿기 쉽고(zero → 제로), 이 앞의 y 소리는 빠지기 쉬워요(year → ear). 혀의 자리부터 만들고 소리를 시작해요.' },
    cluster: { ko: '묶음', long: '자음과 붙은 자리(묶음)',
      say: '자음과 붙은 자리 — street · sleep · smile처럼 s 소리 뒤에 자음이 오면 한국어식으로 으를 넣기 쉬워요(스트리트). music의 y 소리는 앞 자음에 붙어 미끄러져요.' },
    mid: { ko: '가운데', long: '낱말 가운데',
      say: '낱말 가운데 — 모음 사이의 z · zh 소리는 짧게 지나가요. 혀가 입천장에 닿지 않게, 목 울림이 끊기지 않게 이어요(busy · vision). basic처럼 이 앞의 s 소리도 혀끝을 앞에 둬요.' },
    end: { ko: '끝', long: '낱말 끝 · 자음 앞',
      say: '낱말 끝 — 한국어식으로는 s · z 소리 뒤에 으를(버스 · 치즈), sh · zh · j 소리 뒤에 이를 붙여요(피시 · 베이지). 영어는 바람(s · sh)이나 떨림(z · zh)으로 끝내요.' },
  };
  SZ.POS = POS;
  SZ.POS_ORDER = ['start', 'cluster', 'mid', 'end'];
  // 낱말 속 s · z · ʃ · ʒ · dʒ · j 소리마다 { i(전체 음소 번호), ph, pos, prev, next, syl(음절 번호), role, hi(뒤가 이 · ɪ) }
  function sounds(w) {
    const e = typeof w === 'object' ? w : entry(w);
    if (!e) return [];
    const out = [];
    let i = 0;
    e.syl.forEach((s, si) => {
      const v = s.ph.findIndex(isV);
      s.ph.forEach((ph, k) => {
        const gi = i + k;
        if (LAB.indexOf(ph) >= 0) {
          const pos = k < v ? (v > 1 ? 'cluster' : si === 0 ? 'start' : 'mid') : 'end';
          const next = e.ph[gi + 1];
          out.push({ i: gi, ph, pos, prev: e.ph[gi - 1], next, syl: si, role: SZ.role(ph), hi: HIGH_I.indexOf(next) >= 0 });
        }
      });
      i += s.ph.length;
    });
    return out;
  }
  SZ.sounds = sounds;
  SZ.targets = w => sounds(w).filter(x => x.role === 'a');
  SZ.posOf = (w, ph) => { const L = sounds(w).filter(x => !ph || x.ph === ph); return L.length ? L[0].pos : null; };

  /* ---------- 한국어식 표기 (국립국어원 외래어 표기법 제3장 제1절) ----------
     제3항 마찰음: 어말 · 자음 앞의 [s] · [z]는 ‘으’를 붙여(스 · 즈) · 어말의 [ʃ]는 ‘시’, 자음 앞은 ‘슈’, 모음 앞은 샤 · 섀 · 셔 · 셰 · 쇼 · 슈 · 시 ·
       어말 · 자음 앞의 [ʒ]는 ‘지’, 모음 앞은 ㅈ
     제4항 파찰음: 어말 · 자음 앞의 [dʒ]는 ‘지’, 모음 앞은 ㅈ
     제9항 반모음: [j]는 뒤 모음과 합쳐 야 · 얘 · 여 · 예 · 요 · 유 · 이(year 이어 · yearn 연)
     → [ ]로 표시한 음절이 그 규칙대로인지 맞춰 봐요(엔진은 첫소리와 모음만 봐요) */
  function hangul(s) {
    const out = [];
    for (const ch of String(s)) {
      const c = ch.charCodeAt(0) - 0xAC00;
      if (c < 0 || c > 11171) { out.push({ ch, on: -1, vo: -1, coda: -1 }); continue; }
      out.push({ ch, on: Math.floor(c / 588), vo: Math.floor((c % 588) / 28), coda: c % 28 });
    }
    return out;
  }
  SZ.hangul = hangul;
  const ON = { s: 9, j: 12, o: 11 }, VO = { eu: 18, i: 20 };
  const YV = [2, 3, 6, 7, 12, 17];   // ㅑ ㅒ ㅕ ㅖ ㅛ ㅠ
  // 한 소리 L과 그 소리를 적은 한글 음절 h가 표기법대로인가 → { ok, kind, why }
  function koRule(L, h) {
    const fin = !L.next || !isV(L.next);       // 어말 · 자음 앞
    if (L.ph === 's') {
      if (h.on !== ON.s) return { ok: false, why: '첫소리가 ㅅ이 아님' };
      if (fin) return h.vo === VO.eu ? { ok: true, kind: 's' } : { ok: false, why: '끝 · 자음 앞인데 으가 아님' };
      if (L.hi) return h.vo === VO.i ? { ok: true, kind: 's' } : { ok: false, why: '이 앞인데 시가 아님' };
      return YV.indexOf(h.vo) < 0 ? { ok: true, kind: 's' } : { ok: false, why: '야 · 여 · 요 · 유 모음(sh 소리의 표기)' };
    }
    if (L.ph === 'ʃ') {
      if (h.on !== ON.s) return { ok: false, why: '첫소리가 ㅅ이 아님' };
      if (!L.next) return h.vo === VO.i ? { ok: true, kind: 'ʃ' } : { ok: false, why: '어말인데 시가 아님' };
      if (fin) return h.vo === 17 ? { ok: true, kind: 'ʃ' } : { ok: false, why: '자음 앞인데 슈가 아님' };
      if (L.hi) return h.vo === VO.i ? { ok: true, kind: 'ʃ' } : { ok: false, why: '이 앞인데 시가 아님' };
      return YV.indexOf(h.vo) >= 0 ? { ok: true, kind: 'ʃ' } : { ok: false, why: '샤 · 셔 · 셰 · 쇼 · 슈가 아님' };
    }
    if (L.ph === 'z') {
      if (h.on !== ON.j) return { ok: false, why: '첫소리가 ㅈ이 아님' };
      return !fin || h.vo === VO.eu ? { ok: true, kind: 'z' } : { ok: false, why: '끝 · 자음 앞인데 즈가 아님' };
    }
    if (L.ph === 'ʒ' || L.ph === 'dʒ') {
      if (h.on !== ON.j) return { ok: false, why: '첫소리가 ㅈ이 아님' };
      return !fin || h.vo === VO.i ? { ok: true, kind: L.ph } : { ok: false, why: '끝 · 자음 앞인데 지가 아님' };
    }
    if (L.ph === 'j') {
      if (L.hi) return h.on === ON.o && h.vo === VO.i ? { ok: true, kind: 'y0' } : { ok: false, why: '이 앞의 y인데 이가 아님' };
      return YV.indexOf(h.vo) >= 0 ? { ok: true, kind: 'j' } : { ok: false, why: '야 · 여 · 요 · 유 · 예가 아님' };
    }
    return { ok: false, why: '모르는 소리' };
  }
  // 낱말의 한국어식 표기: [{ ch, ph, kind, L, ok, why }] — [ ]로 표시한 음절이 소리 차례대로
  function koParts(w) {
    const e = typeof w === 'object' ? w : entry(w);
    if (!e || !e.ko) return [];
    const H = hangul(e.ko), L = sounds(e);
    if (L.length !== e.koAt.length) return [];
    return e.koAt.map((at, k) => Object.assign({ at, ch: H[at].ch, ph: L[k].ph, L: L[k] }, koRule(L[k], H[at])));
  }
  SZ.koParts = koParts;
  SZ.KO_KIND = { s: 'ㅅ (s 소리)', 'ʃ': 'ㅅ + 이 · 야 · 여 · 요 · 유 (sh 소리)', z: 'ㅈ (z 소리)', 'ʒ': 'ㅈ (zh 소리)', 'dʒ': 'ㅈ (j 소리)', j: '야 · 여 · 요 · 유 · 예 (y 소리)', y0: '이 (y 소리가 빠짐)' };
  // 한글 음절마다 역할: 's' · 'ʃ' · 'z' · 'ʒ' · 'dʒ' · 'j' · 'y0'(빠진 y) · null (그 한글이 영어의 어느 소리를 적었나)
  SZ.koMarks = function (w) {
    const e = entry(w);
    if (!e || !e.ko) return [];
    const marks = [...e.ko].map(() => null);
    koParts(e).forEach(p => { if (p.ok) marks[p.at] = p.kind; });
    return marks;
  };
  // 짝이 같은 한국어식 표기가 되나 (see · she = 시 · 시, sell · shell = 셀 · 셸)
  SZ.koSame = (a, b) => { const A = entry(a), B = entry(b); return !!(A && B && A.ko && A.ko === B.ko); };
  SZ.Y_SAY = '이 앞의 y 소리 — 한국어식으로는 y 소리가 빠져요(year 이어 = ear 이어). 영어는 이 앞에서도 혀 앞을 입천장 가까이 먼저 올렸다가 내리며 모음으로 가요.';
  SZ.SI_SAY = '이 앞의 s 소리 — 한국어 시는 혀가 뒤로 가 sh 소리에 가까워요(see → she처럼). 영어는 이 앞에서도 혀끝을 윗잇몸 가까이 두고, 입술은 옆으로 벌려요.';

  /* ---------- 철자 속 소리 글자 (영상 · 페이지에서 그 글자만 칠하기) ---------- */
  function spans(word) {
    const e = entry(word);
    if (!e) return [];
    const L = sounds(e);
    if (L.length !== e.marks.length) return [{ bad: true }];
    return e.marks.map((m, k) => ({ s: m[0], e: m[1], ph: L[k].ph, pos: L[k].pos, role: L[k].role, hi: L[k].hi }));
  }
  SZ.spans = spans;
  // 문장 → [{ t, ph, role, pos, w }] 조각
  SZ.segs = function (text) {
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
  // 문장 속 소리 수 { s, z, ʃ, ʒ, dʒ, j }
  SZ.countIn = text => SZ.segs(text).reduce((o, s) => { if (s.ph) o[s.ph]++; return o; }, { s: 0, z: 0, 'ʃ': 0, 'ʒ': 0, 'dʒ': 0, j: 0 });

  /* ---------- 최소 대립쌍: 소리 하나만 s ↔ sh · z ↔ j · zh ↔ j로 다르거나, y 소리 하나가 있고 없나 ---------- */
  const KINDS = { ssh: ['s', 'ʃ'], zj: ['z', 'dʒ'], zhj: ['ʒ', 'dʒ'], y0: ['j', null] };
  SZ.KINDS = KINDS;
  SZ.KIND_KO = { ssh: 's · sh', zj: 'z · j', zhj: 'zh · j', y0: 'y · 없음' };
  function pairDiff(a, b) {
    const A = entry(a), B = entry(b);
    if (!A || !B) return { ok: false, why: '사전에 없음' };
    // y 소리 하나가 있고 없음 (year · ear)
    if (Math.abs(A.ph.length - B.ph.length) === 1) {
      const [L, S, la] = A.ph.length > B.ph.length ? [A, B, a] : [B, A, b];
      const i = L.ph.findIndex((p, k) => p !== S.ph[k]);
      const rest = L.ph.slice(0, i).concat(L.ph.slice(i + 1));
      if (L.ph[i] !== 'j' || rest.join(' ') !== S.ph.join(' ')) return { ok: false, why: '소리 하나가 더 있지만 y 소리가 아님' };
      const LL = sounds(L).find(q => q.i === i);
      return { ok: true, i, kind: 'y0', a: la, b: la === a ? b : a, pos: LL.pos, samePos: true, x: 'j', y: null };
    }
    if (A.ph.length !== B.ph.length) return { ok: false, why: '소리 수가 다름' };
    const d = [];
    A.ph.forEach((p, i) => { if (p !== B.ph[i]) d.push(i); });
    if (d.length !== 1) return { ok: false, why: `다른 소리 ${d.length}개` };
    const i = d[0], x = A.ph[i], y = B.ph[i];
    const kind = Object.keys(KINDS).find(k => KINDS[k][0] === x && KINDS[k][1] === y) || null;
    const rev = Object.keys(KINDS).find(k => KINDS[k][0] === y && KINDS[k][1] === x) || null;
    if (!kind && !rev) return { ok: false, why: `${x} ↔ ${y}` };
    const L = sounds(A).find(q => q.i === i), L2 = sounds(B).find(q => q.i === i);
    return { ok: true, i, kind: kind || rev, a: kind ? a : b, b: kind ? b : a, pos: L.pos, samePos: L.pos === L2.pos, x, y };
  }
  SZ.pairDiff = pairDiff;

  /* ---------- 짝 낱말 20 (듣고 가르기 · 영상 · 연습 문제) — a = s · z · zh · y 쪽, b = 짝 ---------- */
  SZ.PAIRS = [
    ['see', 'she'], ['seat', 'sheet'], ['sip', 'ship'], ['sin', 'shin'], ['sift', 'shift'],
    ['sell', 'shell'], ['save', 'shave'], ['sort', 'short'], ['lease', 'leash'], ['mass', 'mash'],
    ['zest', 'jest'], ['zig', 'jig'], ['seize', 'siege'], ['buzz', 'budge'], ['raise', 'rage'],
    ['lesion', 'legion'],
    ['year', 'ear'], ['yeast', 'east'], ['yearn', 'earn'], ['yolk', 'oak'],
  ].map(([a, b]) => { const d = pairDiff(a, b); return { a, b, kind: d.kind, pos: d.pos, id: a + '-' + b, same: SZ.koSame(a, b), hi: !!(sounds(a).find(L => L.i === d.i) || {}).hi }; });
  SZ.pairById = id => SZ.PAIRS.find(p => p.id === id) || null;
  SZ.pairsOf = w => SZ.PAIRS.filter(p => p.a === w || p.b === w);
  // 짝을 가르는 소리(그 낱말 쪽): 'y0'은 y 소리가 없는 쪽
  SZ.pairPhone = (p, w) => { const d = pairDiff(p.a, p.b); if (d.kind === 'y0') return w === d.a ? 'j' : 'y0'; return entry(w).ph[d.i]; };

  /* ---------- 목소리 (듣고 가르기: 미국식 목소리 넷) ---------- */
  SZ.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '미국 여성 ①' },
    { sp: 'tf', ko: '차분한 선생님', who: '미국 여성 ②' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성 ③' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];

  /* ---------- 입 그림 (EN.mouth) — 소리마다 자세 · 목 울림 ---------- */
  SZ.MOUTH = {
    s: { pose: 's', voice: false, ko: '혀끝을 윗잇몸 가까이(닿지 않게) · 가운데 좁은 길로 센 바람 · 목은 울리지 않음' },
    z: { pose: 's', voice: true, ko: 's 소리와 같은 혀 · 목을 울림 · 혀가 닿지 않음' },
    'ʃ': { pose: 'sh', voice: false, ko: '혀를 조금 뒤로(윗잇몸 뒤쪽) · 입술을 동그랗게 조금 내밂 · 목은 울리지 않음' },
    'ʒ': { pose: 'sh', voice: true, ko: 'sh 소리와 같은 혀 · 목을 울림 · 혀가 닿지 않음' },
    'dʒ': { pose: 'dj', voice: true, ko: '혀를 윗잇몸 뒤에 붙였다가 떼며 zh 소리로 · 목을 울림(한국어 ㅈ과 비슷)' },
    j: { pose: 'y', voice: true, ko: '혀 앞을 센입천장 가까이 올렸다가 다음 모음으로' },
    y0: { pose: 'ih', voice: true, ko: 'y 소리 없이 곧바로 모음' },
  };

  /* ---------- 낱말 묶음 (영상 · 직접 해 보기) ---------- */
  SZ.SETS = {
    sI: ['see', 'seat', 'sit', 'city'],
    shW: ['she', 'sheet', 'ship', 'shell'],
    ssPairs: [['see', 'she'], ['sip', 'ship'], ['seat', 'sheet']],
    zStart: ['zero', 'zoo', 'zoom', 'zone'],
    zMid: ['busy', 'easy', 'music', 'puzzle'],
    zjPairs: [['zest', 'jest'], ['zig', 'jig'], ['buzz', 'budge']],
    zh: ['vision', 'usually', 'measure', 'casual'],
    zhEnd: ['beige', 'massage'],
    yI: ['year', 'yeast', 'yield'],
    yGlide: ['yes', 'you', 'young', 'yellow'],
    place: { start: ['see', 'zero', 'year'], cluster: ['street', 'sleep', 'smile', 'music'], mid: ['basic', 'busy', 'vision'], end: ['bus', 'fish', 'cheese', 'beige'] },
  };
  // 외래어 함정 16: 줄마다 넷 — 이 앞의 s(시) · z → ㅈ · zh → ㅈ · 섞어서
  SZ.LOAN = [
    { w: 'city', trap: 'si' }, { w: 'single', trap: 'si' }, { w: 'system', trap: 'si' }, { w: 'silk', trap: 'si' },
    { w: 'zero', trap: 'z' }, { w: 'zoom', trap: 'z' }, { w: 'puzzle', trap: 'z' }, { w: 'cheese', trap: 'z' },
    { w: 'vision', trap: 'zh' }, { w: 'casual', trap: 'zh' }, { w: 'leisure', trap: 'zh' }, { w: 'beige', trap: 'zh' },
    { w: 'season', trap: 'mix' }, { w: 'music', trap: 'mix' }, { w: 'jazz', trap: 'mix' }, { w: 'massage', trap: 'mix' },
  ];
  SZ.TRAP = {
    si: { ko: '이 앞 s → 시', why: '이 앞에서도 혀끝을 윗잇몸 가까이 두고 입술은 옆으로 — 혀를 뒤로 빼면 sh 소리가 돼요' },
    z: { ko: 'z → ㅈ', why: '혀가 입천장에 닿지 않게, s 소리 자리에서 목을 울려요' },
    zh: { ko: 'zh → ㅈ', why: '혀가 닿지 않게, sh 소리 자리에서 목을 울려요' },
    mix: { ko: '섞어서', why: '한 낱말에 소리가 둘 들어 있어요. 소리마다 혀의 자리를 따로 정해요' },
  };
  // 영상 · 페이지가 ‘같은 표기’ · ‘다른 표기’라고 말하는 짝 (check가 엔진으로 확인)
  SZ.CLAIMS = { same: [['see', 'she'], ['seat', 'sheet'], ['sip', 'ship'], ['zest', 'jest'], ['lesion', 'legion'], ['year', 'ear'], ['yeast', 'east']], diff: [['sell', 'shell'], ['sort', 'short'], ['buzz', 'budge'], ['yearn', 'earn']] };

  /* ---------- 음절 수: 영어(모음 수) · 한국어식(한글 음절 수) ---------- */
  SZ.syl = w => { const e = entry(w); return e ? e.ph.filter(isV).length : 0; };
  SZ.koSyl = w => { const e = entry(w); return e && e.ko ? [...e.ko].length : 0; };
  // 한국어식 표기에서 넣은 모음 음절 — 영어에 없는 모음. 음절이 늘어난 만큼만, 뒤에서부터.
  // 후보: 모음 ㅡ 음절 + 끝 · 자음 앞의 sh · zh · j 소리를 적은 ‘이’ 음절(피시 · 베이지)
  SZ.koInserted = function (w) {
    const e = entry(w);
    if (!e || !e.ko) return [];
    const extra = SZ.koSyl(w) - SZ.syl(w);
    if (extra <= 0) return [];
    const H = hangul(e.ko), fin = {};
    koParts(e).forEach(p => { if (p.ok && ['ʃ', 'ʒ', 'dʒ'].indexOf(p.ph) >= 0 && (!p.L.next || !isV(p.L.next)) && H[p.at].vo === VO.i) fin[p.at] = 1; });
    const u = [];
    H.forEach((s, k) => { if (s.vo === VO.eu || fin[k]) u.push(k); });
    return u.length <= extra ? u : u.slice(u.length - extra);
  };

  /* ---------- 문장 (영상 09장 · 따라 말하기 28) — 묶음마다 일곱: s · sh / z / zh / y ---------- */
  SZ.GROUPS = { s: 's · sh 소리', z: 'z 소리', zh: 'zh 소리', y: 'y 소리' };
  SZ.GROUP_ORDER = ['s', 'z', 'zh', 'y'];
  SZ.GROUP_PH = { s: ['s', 'ʃ'], z: ['z'], zh: ['ʒ'], y: ['j'] };
  SZ.SENT = [
    { grp: 's', en: 'Please sit here.', ko: '여기 앉으세요.' },
    { grp: 's', en: 'See you soon.', ko: '곧 만나요.' },
    { grp: 's', en: 'Take a seat, please.', ko: '자리에 앉으세요.' },
    { grp: 's', en: 'This city is safe.', ko: '이 도시는 안전해요.' },
    { grp: 's', en: 'I can see the ship.', ko: '배가 보여요.' },
    { grp: 's', en: 'Sing a simple song.', ko: '쉬운 노래를 불러요.' },
    { grp: 's', en: 'She sells sea shells.', ko: '그녀는 조개껍데기를 팔아요.' },
    { grp: 'z', en: 'The zoo is closed.', ko: '동물원이 문을 닫았어요.' },
    { grp: 'z', en: "I'm busy today.", ko: '오늘은 바빠요.' },
    { grp: 'z', en: "It's easy.", ko: '쉬워요.' },
    { grp: 'z', en: 'I love jazz music.', ko: '재즈 음악을 정말 좋아해요.' },
    { grp: 'z', en: 'The score is zero to zero.', ko: '점수는 0 대 0이에요.' },
    { grp: 'z', en: 'Close the window, please.', ko: '창문 좀 닫아 주세요.' },
    { grp: 'z', en: 'These shoes are too big.', ko: '이 신발은 너무 커요.' },
    { grp: 'zh', en: 'I usually walk to school.', ko: '저는 보통 걸어서 학교에 가요.' },
    { grp: 'zh', en: "It's a pleasure.", ko: '제가 기쁘죠.' },
    { grp: 'zh', en: 'That was a good decision.', ko: '좋은 결정이었어요.' },
    { grp: 'zh', en: 'Turn on the television.', ko: '텔레비전을 켜 주세요.' },
    { grp: 'zh', en: 'I like casual clothes.', ko: '편한 옷이 좋아요.' },
    { grp: 'zh', en: 'My bag is beige.', ko: '제 가방은 베이지색이에요.' },
    { grp: 'zh', en: 'She has good vision.', ko: '그녀는 눈이 좋아요.' },
    { grp: 'y', en: 'See you next year.', ko: '내년에 만나요.' },
    { grp: 'y', en: 'Happy New Year!', ko: '새해 복 많이 받으세요!' },
    { grp: 'y', en: 'Add some yeast.', ko: '이스트를 조금 넣어요.' },
    { grp: 'y', en: "Yes, I'm ready.", ko: '네, 준비됐어요.' },
    { grp: 'y', en: 'I was here last year.', ko: '작년에 여기 왔었어요.' },
    { grp: 'y', en: 'You look young.', ko: '젊어 보여요.' },
    { grp: 'y', en: 'The yellow one is yours.', ko: '노란 것이 당신 거예요.' },
  ];

  /* ---------- 음성 인식: 들은 말이 목표 낱말인가, 짝 낱말인가 ----------
     인식기는 낱말을 철자로 돌려줘요. 소리가 같은 다른 낱말(see = sea)도 그 소리로 쳐요 */
  const SAME = {
    see: ['sea', 'c'], sea: ['see', 'c'], sell: ['cell'], seize: ['sees', 'seas'], raise: ['rays', 'raze'], yolk: ['yoke'], earn: ['urn'],
    zig: ['zigg'], sin: ['syn'], mass: ['mas'], sort: [], short: [],
  };
  SZ.SAME = SAME;
  const words = s => String(s || '').toLowerCase().replace(/’/g, "'").replace(/[^a-z' -]+/g, ' ').split(/\s+/).filter(Boolean);
  const has = (list, w) => list.indexOf(w) >= 0 || (SAME[w] || []).some(x => list.indexOf(x) >= 0);
  // alts: 인식 후보 글 목록(첫째가 가장 그럴듯함) → { verdict: 'target' | 'partner' | 'maybe' | 'other' | 'none', heard }
  SZ.heard = function (target, alts, partner) {
    alts = (alts || []).filter(Boolean);
    if (!alts.length) return { verdict: 'none', heard: '', partner };
    const top = words(alts[0]);
    if (has(top, target)) return { verdict: 'target', heard: alts[0], partner };
    if (partner && has(top, partner)) return { verdict: 'partner', heard: alts[0], partner };
    const k = alts.findIndex(a => has(words(a), target));
    if (k > 0) return { verdict: 'maybe', heard: alts[0], rank: k + 1, partner };
    return { verdict: 'other', heard: alts[0], partner };
  };
  SZ.HEARD_KO = {
    target: '목표 낱말로 들었어요',
    partner: '짝 낱말로 들었어요',
    maybe: '첫째 후보는 아니지만 후보에 있었어요',
    other: '다른 낱말로 들었어요',
    none: '아무 말도 듣지 못했어요',
  };

  /* ---------- 따라 말하기: 낱말 맞추기 (들린 낱말 초록 · 빠진 낱말 주황) ---------- */
  const norm = w => w.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9'-]/g, '');
  SZ.compareWords = function (target, heard) {
    const T = String(target).split(/\s+/).filter(Boolean).map(w => ({ w, n: norm(w) }));
    const Hs = words(heard).map(norm);
    const used = Hs.map(() => false);
    let hit = 0;
    const NUM = { zero: '0' };
    const alike = (h, n) => h === n || (SAME[n] || []).indexOf(h) >= 0 || h.replace(/-/g, '') === n.replace(/-/g, '') || NUM[n] === h;
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
  SZ.DRILL = [
    { kind: 'word', sp: 'um', say: 'she', opts: ['see', 'she'], a: 1 },
    { kind: 'word', sp: 'uf', say: 'zest', opts: ['zest', 'jest'], a: 0 },
    { kind: 'sent', sp: 'tf', say: 'Take a sip.', frame: 'Take a ___.', opts: ['sip', 'ship'], a: 0, ko: '한 모금 마셔 봐요.' },
    { kind: 'same', sp: 'tc', say: ['year', 'ear'], opts: ['같아요', '달라요'], a: 1 },
    { kind: 'word', sp: 'tf', say: 'sheet', opts: ['seat', 'sheet'], a: 1 },
    { kind: 'ko', sp: 'uf', say: ['city', '시티'], opts: ['첫째 소리', '둘째 소리'], a: 1 },
    { kind: 'word', sp: 'tc', say: 'lease', opts: ['lease', 'leash'], a: 0 },
    { kind: 'sent', sp: 'um', say: "Don't sell it.", frame: "Don't ___ it.", opts: ['sell', 'shell'], a: 0, ko: '그거 팔지 마세요.' },
    { kind: 'same', sp: 'uf', say: ['sin', 'sin'], opts: ['같아요', '달라요'], a: 0 },
    { kind: 'word', sp: 'um', say: 'budge', opts: ['buzz', 'budge'], a: 1 },
    { kind: 'sent', sp: 'tc', say: "I can't shave.", frame: "I can't ___.", opts: ['save', 'shave'], a: 1, ko: '면도를 못 하겠어요.' },
    { kind: 'same', sp: 'tf', say: ['zig', 'jig'], opts: ['같아요', '달라요'], a: 1 },
    { kind: 'word', sp: 'um', say: 'yeast', opts: ['yeast', 'east'], a: 0 },
    { kind: 'ko', sp: 'tc', say: ['제로', 'zero'], opts: ['첫째 소리', '둘째 소리'], a: 0 },
    { kind: 'sent', sp: 'uf', say: 'Please sift the flour.', frame: 'Please ___ the flour.', opts: ['sift', 'shift'], a: 0, ko: '밀가루를 체로 쳐 주세요.' },
    { kind: 'same', sp: 'tf', say: ['lesion', 'legion'], opts: ['같아요', '달라요'], a: 1 },
  ];
  const isKo = s => /[가-힣]/.test(s);
  SZ.isKo = isKo;
  // 문제의 목표 낱말(정답 낱말 · 같은가 문제는 첫 낱말 · 한국어식 문제는 영어 낱말)
  SZ.drillWord = q => q.kind === 'same' ? q.say[0] : q.kind === 'ko' ? q.say.find(s => !isKo(s)) : q.kind === 'sent' ? q.opts[q.a] : q.say;
  SZ.drillWords = q => q.kind === 'same' ? q.say.slice() : q.kind === 'ko' ? q.say.filter(s => !isKo(s)) : q.opts.slice();
  // 소리가 같은 두 낱말인가
  SZ.homophone = (a, b) => { const A = entry(a), B = entry(b); return !!(A && B && A.ph.join(' ') === B.ph.join(' ')); };
  // 힌트 세 단계(엔진이 짝의 종류 · 자리에서 만들어요)
  const LISTEN_HINT = {
    ssh: 's 소리는 높고 가는 쉿 소리(스—), sh 소리는 더 낮고 두툼한 쉬 소리(슈—)예요.',
    zj: 'z 소리는 지잉 떨리는 바람 소리가 이어지고, j 소리는 막혔다가 톡 떨어지며 시작해요.',
    zhj: 'zh 소리는 떨리는 바람 소리가 이어지고, j 소리는 혀가 떨어지는 톡 소리가 앞에 붙어요.',
    y0: 'y 소리가 있으면 이 앞에서 혀가 미끄러지는 짧은 소리가 먼저 들리고, 없으면 곧바로 모음으로 시작해요.',
  };
  const MOUTH_HINT = {
    ssh: 's 소리는 혀끝을 윗잇몸 가까이 두고 입술은 옆으로, sh 소리는 혀를 조금 뒤로 빼고 입술을 동그랗게 내밀어요.',
    zj: 'z 소리는 혀가 입천장에 닿지 않아요(s 소리 자리 + 목 울림). j 소리는 혀를 붙였다가 떼요 — 한국어 ㅈ처럼.',
    zhj: 'zh 소리는 혀가 닿지 않아요(sh 소리 자리 + 목 울림). j 소리는 혀를 붙였다가 떼요.',
    y0: 'y 소리는 혀 앞을 센입천장 가까이 올렸다가 내리며 모음으로 가요. 이 앞에서도 혀를 먼저 올려요.',
  };
  SZ.LISTEN_HINT = LISTEN_HINT; SZ.MOUTH_HINT = MOUTH_HINT;
  const kindOfPh = ph => ph === 'ʃ' || ph === 's' ? 'ssh' : ph === 'z' ? 'zj' : ph === 'ʒ' ? 'zhj' : ph === 'dʒ' ? 'zj' : 'y0';
  SZ.kindOfPh = kindOfPh;
  SZ.hints = function (q) {
    if (q.kind === 'ko') {
      const en = SZ.drillWord(q), e = entry(en), L = sounds(en)[0];
      return [
        { head: '① 듣고 가르기', text: '한국어식으로 읽으면 이 앞의 s 소리가 시(sh 소리 쪽)가 되고, z · zh 소리는 ㅈ처럼 혀가 닿고, 이 앞의 y 소리는 빠지고, 끝에 으 · 이가 붙어요.' },
        { head: '② 입 모양', text: L ? MOUTH_HINT[kindOfPh(L.ph)] : '' },
        { head: '③ 낱말 · 문장 속에서', text: `${en} → 한국어식 ${e.ko}. ${L ? (L.ph === 's' && L.hi ? SZ.SI_SAY : POS[L.pos].say) : ''}` },
      ];
    }
    const ws = SZ.drillWords(q).filter(w => entry(w));
    let d = ws.length > 1 ? pairDiff(ws[0], ws[1]) : { ok: false };
    if (!d.ok) { const p = SZ.pairsOf(ws[0])[0]; d = p ? pairDiff(p.a, p.b) : { ok: false }; }
    const L0 = sounds(ws[0])[0];
    const kind = d.ok ? d.kind : L0 ? kindOfPh(L0.ph) : 'ssh', pos = d.ok ? d.pos : L0 ? L0.pos : 'start';
    const step1 = q.kind === 'same' && SZ.homophone(q.say[0], q.say[1])
      ? '철자는 달라도 소리가 같은 낱말이 있어요. 두 낱말의 시작과 끝을 하나씩 견줘 들어요.'
      : (pos === 'end' ? '끝을 들어요. ' : '시작을 들어요. ') + LISTEN_HINT[kind];
    const hiS = d.ok && d.kind === 'ssh' && (sounds(d.a).find(L => L.i === d.i) || {}).hi;
    const step3 = kind === 'y0' ? SZ.Y_SAY : hiS ? SZ.SI_SAY : `${POS[pos].long} 자리예요. ${POS[pos].say}` + (q.kind === 'sent' ? ' 문장 속에서는 두 낱말이 모두 말이 되니 소리만이 뜻을 정해요.' : '');
    return [
      { head: '① 듣고 가르기', text: step1 },
      { head: '② 입 모양', text: MOUTH_HINT[kind] },
      { head: '③ 낱말 · 문장 속에서', text: step3 },
    ];
  };

  /* ---------- 모든 글 (글꼴 미리 받기용) ---------- */
  SZ.allText = () => Object.values(DICT).map(e => e.w + e.ipa + (e.ko || '') + e.gloss).join('') +
    SZ.SENT.map(s => s.en + s.ko).join('') + Object.values(POS).map(p => p.ko + p.long + p.say).join('') +
    Object.values(SZ.TRAP).map(t => t.ko + t.why).join('') + SZ.VOICES.map(v => v.ko + v.who).join('') +
    Object.values(SZ.MOUTH).map(m => m.ko).join('') + Object.values(SZ.KO_KIND).join('') + Object.values(SZ.GROUPS).join('') +
    SZ.Y_SAY + SZ.SI_SAY + Object.values(LISTEN_HINT).join('') + Object.values(MOUTH_HINT).join('') + Object.values(SZ.KIND_KO).join('');

  /* ---------- 데이터 점검 ---------- */
  SZ.check = function () {
    const warn = DICT_WARN.slice();
    const w = m => warn.push(m);
    // 사전: 철자 · 칠할 글자 수 · 글자가 그 소리를 적을 만한가 · 한국어식 표기
    Object.values(DICT).forEach(e => {
      if (e.plain.toLowerCase() !== e.key) w(`${e.key}: 철자 ${e.plain}이 낱말과 다름`);
      const L = sounds(e);
      if (L.length !== e.marks.length) { w(`${e.key}: [ ] 글자 ${e.marks.length}개, 소리 ${L.length}개`); return; }
      e.marks.forEach((m, k) => {
        const s = e.plain.slice(m[0], m[1]).toLowerCase();
        if (PLAUS[L[k].ph].indexOf(s) < 0) w(`${e.key}: ${L[k].ph} 소리를 ‘${s}’로 적음`);
      });
      e.syl.forEach((s, i) => { if (s.ph.filter(isV).length !== 1) w(`${e.key}: ${i + 1}번째 음절의 모음 수 ${s.ph.filter(isV).length}`); });
      if (e.syl.length > 1 && e.syl.filter(s => s.st).length !== 1) w(`${e.key}: 센 음절 표시(ˈ)가 하나가 아님`);
      if (e.ko) {
        if (e.koSpan.some(m => m[1] - m[0] !== 1)) w(`${e.key}(${e.ko}): [ ] 안에 한글 한 글자만`);
        if (e.koAt.length !== L.length) { w(`${e.key}(${e.ko}): 한글 [ ] ${e.koAt.length}개, 소리 ${L.length}개`); return; }
        koParts(e).forEach((p, k) => { if (!p.ok) w(`${e.key}(${e.ko}): ${k + 1}번째 ${p.ph} 소리 → ‘${p.ch}’ — ${p.why}`); });
      }
    });
    // 짝: 소리 하나만, a 쪽이 s · z · zh · y
    SZ.PAIRS.forEach(p => {
      const d = pairDiff(p.a, p.b);
      if (!d.ok) { w(`짝 ${p.a} · ${p.b}: ${d.why}`); return; }
      if (d.a !== p.a) w(`짝 ${p.a} · ${p.b}: 이 편의 소리 쪽이 바뀜`);
      if (!d.samePos) w(`짝 ${p.a} · ${p.b}: 두 낱말의 자리가 다름`);
    });
    if (SZ.PAIRS.length < 18 || SZ.PAIRS.length > 22) w(`짝 ${SZ.PAIRS.length}개 (18~22개)`);
    if (new Set(SZ.PAIRS.map(p => p.id)).size !== SZ.PAIRS.length) w('짝이 겹침');
    Object.keys(KINDS).forEach(k => { if (!SZ.PAIRS.some(p => p.kind === k)) w(`짝 갈래 ${k}가 없음`); });
    // 짝 · 외래어 · 묶음의 낱말이 사전에 있고 한국어식 표기가 있나
    SZ.PAIRS.forEach(p => [p.a, p.b].forEach(x => { if (!entry(x) || !entry(x).ko) w(`짝 낱말에 한국어식 표기가 없음: ${x}`); }));
    const S = SZ.SETS;
    const need = [].concat(S.sI, S.shW, [].concat(...S.ssPairs), S.zStart, S.zMid, [].concat(...S.zjPairs), S.zh, S.zhEnd, S.yI, S.yGlide, ...Object.values(S.place), SZ.LOAN.map(x => x.w));
    need.forEach(x => { if (!entry(x)) w(`사전에 없음: ${x}`); else if (!entry(x).ko) w(`한국어식 표기가 없음: ${x}`); });
    // 영상 · 페이지가 말하는 ‘같은 표기’ · ‘다른 표기’
    SZ.CLAIMS.same.forEach(([a, b]) => { if (!SZ.koSame(a, b)) w(`같은 표기라고 했지만 다름: ${a} · ${b}`); });
    SZ.CLAIMS.diff.forEach(([a, b]) => { if (SZ.koSame(a, b)) w(`다른 표기라고 했지만 같음: ${a} · ${b}`); });
    // 묶음의 낱말: 말하는 소리 · 자리가 있나
    S.sI.forEach(x => { if (!sounds(x).some(L => L.ph === 's' && L.hi)) w(`이 앞의 s 묶음: ${x}에 이 앞의 s 소리가 없음`); });
    S.shW.forEach(x => { if (!sounds(x).some(L => L.ph === 'ʃ')) w(`sh 묶음: ${x}에 sh 소리가 없음`); });
    S.zStart.forEach(x => { if (SZ.posOf(x, 'z') !== 'start') w(`z 처음 묶음: ${x}`); });
    S.zMid.forEach(x => { if (SZ.posOf(x, 'z') !== 'mid') w(`z 가운데 묶음: ${x}`); });
    S.zh.concat(S.zhEnd).forEach(x => { if (!sounds(x).some(L => L.ph === 'ʒ')) w(`zh 묶음: ${x}에 zh 소리가 없음`); });
    S.zhEnd.forEach(x => { if (SZ.posOf(x, 'ʒ') !== 'end') w(`zh 끝 묶음: ${x}`); });
    S.yI.forEach(x => { if (!koParts(x).some(p => p.kind === 'y0')) w(`이 앞의 y 묶음: ${x}에서 y가 빠지지 않음`); });
    S.yGlide.forEach(x => { if (!koParts(x).some(p => p.kind === 'j')) w(`y 묶음: ${x}에 야 · 여 · 요 · 유 · 예가 없음`); });
    Object.keys(S.place).forEach(pos => S.place[pos].forEach(x => { if (!sounds(x).some(L => L.pos === pos)) w(`자리 ${POS[pos].ko}: ${x}에 그 자리의 소리가 없음`); }));
    // 외래어 16: 줄마다 넷, 함정의 종류가 엔진과 맞나
    if (SZ.LOAN.length !== 16) w(`외래어 카드 ${SZ.LOAN.length}개 (16개여야 함)`);
    ['si', 'z', 'zh', 'mix'].forEach(t => { const n = SZ.LOAN.filter(x => x.trap === t).length; if (n !== 4) w(`외래어 ${t} 카드 ${n}개 (4개여야 함)`); });
    SZ.LOAN.forEach(o => {
      const T = sounds(o.w), kinds = new Set(T.map(L => L.ph));
      const ok = o.trap === 'si' ? T.some(L => L.ph === 's' && L.hi) && [...kinds].every(k => k === 's')
        : o.trap === 'z' ? kinds.size === 1 && kinds.has('z')
          : o.trap === 'zh' ? kinds.size === 1 && kinds.has('ʒ')
            : kinds.size >= 2;
      if (!ok) w(`외래어 ${o.w}: 함정 ${o.trap}이 소리와 맞지 않음`);
    });
    // 문장: 28개, 묶음마다 일곱, 그 소리가 문장에 있나, 낱말이 사전에 있나
    if (SZ.SENT.length !== 28) w(`따라 말하기 문장 ${SZ.SENT.length}개(28개여야 함)`);
    SZ.GROUP_ORDER.forEach(gp => { const n = SZ.SENT.filter(s => s.grp === gp).length; if (n !== 7) w(`문장 묶음 ${gp}: ${n}개(7개여야 함)`); });
    SZ.SENT.forEach(s => { const c = SZ.countIn(s.en); if (!SZ.GROUP_PH[s.grp].some(k => c[k] > 0)) w(`문장 "${s.en}": ${SZ.GROUPS[s.grp]}이 없음`); });
    const sentWords = [];
    SZ.SENT.concat(SZ.DRILL.filter(q => q.kind === 'sent').map(q => ({ en: q.say }))).forEach(s => s.en.replace(/[A-Za-z'’][A-Za-z'’-]*/g, m => { sentWords.push(m); return m; }));
    sentWords.forEach(x => {
      const lx = x.toLowerCase();
      if (/[szjyx]|c[eiy]|g[eiy]|ti[oa]/.test(lx) && !entry(x)) w(`문장 낱말이 사전에 없음: ${x}`);
      if (entry(x) && spans(x).some(s => s.bad)) w(`글자 칠하기 실패: ${x}`);
    });
    // 연습 문제: 정답 위치 · 소리 · 보기 · 목소리
    if (SZ.DRILL.length !== 16) w(`연습 문제 ${SZ.DRILL.length}개 (16개여야 함)`);
    const pos2 = [0, 0];
    SZ.DRILL.forEach((q, k) => {
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
        const same = q.say[0] === q.say[1] || SZ.homophone(q.say[0], q.say[1]);
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
    // 입 그림: s는 혀끝이 윗잇몸 가까이(닿지 않음) · sh는 그보다 뒤(닿지 않음) + 입술 모음 · j(dj)는 닿음 · y는 센입천장 가까이(닿지 않음)
    if (window.EN && EN.mouth && EN.mouth.contact) {
      const Mm = EN.mouth;
      try {
        const cs = Mm.contact('s'), csh = Mm.contact('sh'), cj = Mm.contact('dj'), cy = Mm.contact('y');
        if (cs.touch || cs.where !== '윗잇몸') w(`입 그림 s: 윗잇몸 가까이(닿지 않음)가 아님 (${cs.where} · 틈 ${cs.gap})`);
        if (csh.touch) w('입 그림 sh: 혀가 입천장에 닿음');
        if (csh.at[0] < cs.at[0] + 8) w(`입 그림 sh: s보다 뒤가 아님 (${Math.round(csh.at[0])} · ${Math.round(cs.at[0])})`);
        if (!cj.touch) w(`입 그림 j: 혀가 닿지 않음 (틈 ${cj.gap})`);
        if (cy.touch || cy.where !== '센입천장') w(`입 그림 y: 센입천장 가까이(닿지 않음)가 아님 (${cy.where} · 틈 ${cy.gap})`);
        if ((Mm.pose('sh').round || 0) < 0.4 || (Mm.pose('s').round || 0) > 0.1) w('입 그림: sh는 입술을 모으고 s는 모으지 않아야');
      } catch (e) { w('입 그림 자세가 없음: ' + e.message); }
      Object.keys(SZ.MOUTH).forEach(ph => { try { Mm.pose(SZ.MOUTH[ph].pose); } catch (e) { w(`입 그림 자세 없음: ${SZ.MOUTH[ph].pose}`); } });
    } else w('입 그림(EN.mouth.contact)이 없음');
    warn.forEach(m => console.warn('[SZ.check] ' + m));
    return warn.length;
  };
})();
