/* 혀끝을 이 사이로 — th 소리 둘(θ · ð) — 규칙 엔진 (TH)
 *
 * 맞고 틀림과 그림의 바탕은 모두 여기서 계산해요. 영상 · 직접 해 보기 · 놀이터 · 연습 문제 · 퀴즈가 같은 결과를 써요.
 *   발음 사전(미국 표준 발음 General American의 IPA, 넓게 적음 · 음절은 . · 센 음절 앞에 ˈ)
 *   → 낱말 속 th 소리 둘(바람 th θ · 울림 th ð)의 자리(처음 · 묶음 · 가운데 · 끝, 음절에서 계산)
 *   → 외래어 표기의 한글이 그 소리를 표기법대로 적었나(θ → ㅅ · 스, ð → ㄷ · 드) · 짝 낱말이 같은 표기가 되나
 *   최소 대립쌍(짝 낱말)이 정말 소리 하나(th ↔ s · f · t, th ↔ d · z)만 다른가 · 음성 인식이 들은 낱말이 목표 낱말인가 짝 낱말인가
 *
 * 화면 · 자막에서 쓰는 소리 이름(발음 기호 대신): 바람 th /θ/(think) · 울림 th /ð/(this) · 짝 소리 s · f · t · d · z
 * 사전 한 줄: 낱말 | 철자(th 소리를 적은 글자를 [ ]로, 짝 낱말의 짝 소리 글자를 { }로) | IPA |
 *            한국어식(외래어 표기법을 따른 한글, 그 소리를 적은 음절을 [ ]로, 없으면 빈칸) | 뜻 | 묶음
 *
 * 단순하게 줄인 것(README · 화면 각주에 적음)
 *   - IPA는 넓게 적어요(모음 사이 t의 짧은 ㄹ 소리 · 약한 모음의 변이 등은 적지 않음).
 *   - 자리는 음절로 나눠 정해요: 첫 음절의 홀로 선 첫소리 = 처음 · 다른 자음과 붙은 첫소리 = 묶음 · 둘째 음절부터의 홀로 선 첫소리 = 가운데 · 음절 끝 = 끝.
 *   - 외래어 표기는 국립국어원 외래어 표기법(제2장 표 1 · 제3장 제1절 제3항 마찰음)을 따라요: θ는 모음 앞 ㅅ, 자음 앞 · 어말 ‘스’ · ð는 모음 앞 ㄷ, 자음 앞 · 어말 ‘드’.
 *     엔진은 [ ]로 표시한 음절의 첫소리(ㅅ · ㄷ · ㅍ · ㅌ · ㅈ)와 모음(으)만 맞춰 봐요.
 */
(function () {
  'use strict';
  const TH = (window.TH = {});

  /* ---------- 소리(음소) ---------- */
  const VOW = ['aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'i', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ə', 'ɚ', 'ɝ', 'ɑ', 'ɔ', 'ʊ', 'u'];
  const CON = ['tʃ', 'dʒ', 'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j'];
  const UNITS = VOW.concat(CON).sort((a, b) => b.length - a.length);
  const isV = p => VOW.indexOf(p) >= 0;
  TH.isV = isV;
  // 이 편이 다루는 소리: th 소리 둘(노랑 mk-a) · 짝 소리 s · f · t · d · z(하늘 mk-b, 짝 낱말에서만 칠해요)
  const TARGET = ['θ', 'ð'], PARTNER = ['s', 'f', 't', 'd', 'z'];
  TH.TARGET = TARGET; TH.PARTNER = PARTNER;
  TH.role = ph => TARGET.indexOf(ph) >= 0 ? 'a' : PARTNER.indexOf(ph) >= 0 ? 'b' : null;
  // 화면 · 자막의 소리 이름 (발음 기호 대신)
  const NAME = { 'θ': 'th', 'ð': 'th', s: 's', f: 'f', t: 't', d: 'd', z: 'z' };
  TH.NAME = NAME;
  TH.LONG = { 'θ': '바람 th 소리', 'ð': '울림 th 소리', s: 's 소리', f: 'f 소리', t: 't 소리', d: 'd 소리', z: 'z 소리' };
  TH.IPA_OF = { 'θ': '/θ/', 'ð': '/ð/', s: '/s/', f: '/f/', t: '/t/', d: '/d/', z: '/z/' };
  // IPA 한 음절 → 음소 목록 (강세 표시 ˈ ˌ는 빼요)
  function phonesOf(s) {
    s = String(s).replace(/[ˈˌ]/g, '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const u = UNITS.find(x => s.startsWith(x, i));
      if (!u) throw new Error('TH: 모르는 소리 ' + s[i] + ' in ' + s);
      out.push(u); i += u.length;
    }
    return out;
  }
  const phones = ipa => phonesOf(String(ipa).replace(/\./g, ''));
  TH.phones = phones;

  /* ---------- 발음 사전 ----------
     묶음: pair(짝 낱말) · loan(외래어 카드) · place(자리 보기) · sent(문장) · drill(연습 문제) · extra */
  const DICT_SRC = `
think|[th]ink|θɪŋk|[싱]크|생각하다|pair,sent,drill
sink|{s}ink|sɪŋk|[싱]크|가라앉다 · 개수대|pair,drill
thick|[th]ick|θɪk|[식]|두꺼운|pair,drill
sick|{s}ick|sɪk|[식]|아픈|pair,drill
thing|[th]ing|θɪŋ|[싱]|것 · 물건|pair,drill
sing|{s}ing|sɪŋ|[싱]|노래하다|pair
thumb|[th]umb|θʌm|[섬]|엄지손가락|pair,drill
sum|{s}um|sʌm|[섬]|합계|pair,drill
mouth|mou[th]|maʊθ|마우[스]|입|pair,sent,drill
mouse|mou{s}e|maʊs|마우[스]|쥐 · 마우스|pair,drill
path|pa[th]|pæθ|패[스]|오솔길 · 길|pair,drill
pass|pa{ss}|pæs|패[스]|지나가다 · 고갯길|pair,drill
faith|fai[th]|feɪθ|페이[스]|믿음|pair,drill
face|fa{c}e|feɪs|페이[스]|얼굴 · 체면|pair,drill
three|[th]ree|θri|[스]리|셋|pair,place,sent,drill
free|{f}ree|fri|[프]리|자유로운 · 공짜인|pair,drill
tree|{t}ree|tri|[트]리|나무|pair
thin|[th]in|θɪn|[신]|얇은 · 마른|pair
fin|{f}in|fɪn|[핀]|지느러미|pair
thought|[th]ought|θɔt|[소]트|생각 · 생각했다|pair,sent
fought|{f}ought|fɔt|[포]트|싸웠다|pair
death|dea[th]|dɛθ|데[스]|죽음|pair
deaf|dea{f}|dɛf|데[프]|귀가 들리지 않는|pair
thank|[th]ank|θæŋk|[생]크|고마워하다|pair,place,sent
tank|{t}ank|tæŋk|[탱]크|(물 · 기름) 통 · 탱크|pair
both|bo[th]|boʊθ|보[스]|둘 다|pair,sent,drill
boat|boa{t}|boʊt|보[트]|배 · 보트|pair,drill
they|[th]ey|ðeɪ|[데]이|그들|pair,sent,drill
day|{d}ay|deɪ|[데]이|하루 · 날|pair,drill
then|[th]en|ðɛn|[덴]|그때 · 그러고 나서|pair,drill
den|{d}en|dɛn|[덴]|(짐승의) 굴 · 서재|pair,drill
though|[th]ough|ðoʊ|[도]|그렇지만|pair
dough|{d}ough|doʊ|[도]|반죽|pair
breathe|brea[th]e|brið|브리[드]|숨 쉬다|pair,place,drill
breed|bree{d}|brid|브리[드]|품종 · 기르다|pair
breeze|bree{z}e|briz|브리[즈]|산들바람|pair,drill
clothing|clo[th]ing|ˈkloʊ.ðɪŋ|클로[딩]|옷 · 의류|pair
closing|clo{s}ing|ˈkloʊ.zɪŋ|클로[징]|닫는 · 마감|pair
thriller|[th]riller|ˈθrɪ.lɚ|[스]릴러|스릴러(영화 · 소설)|loan,place
theater|[th]eater|ˈθi.ə.tɚ|[시]어터|극장|loan
thumbnail|[th]umbnail|ˈθʌm.neɪl|[섬]네일|엄지손톱 · 작은 미리보기 그림|loan
third|[th]ird|θɝd|[서]드|셋째|loan,sent
health|heal[th]|hɛlθ|헬[스]|건강|loan
Bluetooth|Bluetoo[th]|ˈblu.tuθ|블루투[스]|블루투스|loan
method|me[th]od|ˈmɛ.θəd|메[서]드|방법|loan,place
birthday|bir[th]day|ˈbɝθ.deɪ|버[스]데이|생일|loan,sent
rhythm|rhy[th]m|ˈrɪ.ðəm|리[듬]|리듬 · 박자|loan
smoothie|smoo[th]ie|ˈsmu.ði|스무[디]|스무디|loan
weather|wea[th]er|ˈwɛ.ðɚ|웨[더]|날씨|loan,sent
leather|lea[th]er|ˈlɛ.ðɚ|레[더]|가죽|loan
Thomas|Thomas|ˈtɑ.məs|토머스|토머스(이름)|loan
Thailand|Thailand|ˈtaɪ.lænd|타일랜드|타이 · 태국|loan
thyme|thyme|taɪm|타임|백리향(허브)|loan
Thames|Thames|tɛmz|템스|템스강|loan
this|[th]is|ðɪs|[디]스|이 · 이것|place,sent
that|[th]at|ðæt|[댓]|저 · 저것|sent
the|[th]e|ðə|[더]|그(정관사)|sent
throat|[th]roat|θroʊt|[스]로트|목구멍|place,sent
nothing|no[th]ing|ˈnʌ.θɪŋ|너[싱]|아무것도 (아니다)|place,sent
mother|mo[th]er|ˈmʌ.ðɚ|머[더]|어머니|place,sent,drill
brother|bro[th]er|ˈbrʌ.ðɚ|브러[더]|형 · 오빠 · 남동생|sent
together|toge[th]er|tə.ˈgɛ.ðɚ|투게[더]|함께|sent
bath|ba[th]|bæθ|배[스]|목욕|place
teeth|tee[th]|tiθ|티[스]|이(이빨)들|place,sent
with|wi[th]|wɪð|위[드]|~와 함께|place,sent
there|[th]ere|ðɛr||거기 · 저기|sent
these|[th]ese|ðiz||이것들 · 이|sent
than|[th]an|ðæn||~보다|sent
father|fa[th]er|ˈfɑ.ðɚ||아버지|sent
Thursday|[Th]ursday|ˈθɝz.deɪ||목요일|sent
thirty|[th]irty|ˈθɝ.ti||서른|sent
breath|brea[th]|brɛθ||숨|sent
worth|wor[th]|wɝθ||~의 가치가 있는|sent
things|[th]ings|θɪŋz||것들|sent
thanks|[th]anks|θæŋks||고마워요|sent
math|ma[th]|mæθ||수학|sent
bathroom|ba[th]room|ˈbæθ.rum||화장실 · 욕실|sent
some|some|sʌm||조금 · 약간의|drill
`;
  const DICT = {};
  const PLAUS = { 'θ': ['th'], 'ð': ['th'], s: ['s', 'ss', 'c'], f: ['f'], t: ['t'], d: ['d'], z: ['z', 's'] };
  const DICT_WARN = [];
  // [ ] · { } 표시 풀기: 'a[bc]d{e}' → { plain: 'abcde', marks: [[1, 3]], pmarks: [[4, 5]] }
  function unmark(src) {
    const marks = [], pmarks = [];
    let plain = '';
    String(src).replace(/\[([^\]]+)\]|\{([^}]+)\}|([^[\]{}]+)/g, (m, inb, inc, out) => {
      if (inb) { marks.push([plain.length, plain.length + inb.length]); plain += inb; }
      else if (inc) { pmarks.push([plain.length, plain.length + inc.length]); plain += inc; }
      else plain += out;
      return m;
    });
    return { plain, marks, pmarks };
  }
  DICT_SRC.trim().split('\n').forEach(line => {
    const [key, spell, ipa, koSrc, gloss, grp] = line.split('|');
    const k = key.toLowerCase();
    if (DICT[k]) { DICT_WARN.push(`사전에 두 번: ${k}`); return; }
    const { plain, marks, pmarks } = unmark(spell);
    const K = unmark(koSrc || '');
    const syl = ipa.split('.').map(s => ({ st: /ˈ/.test(s), ph: phonesOf(s) }));
    if (syl.length === 1) syl[0].st = true;
    const ph = [].concat(...syl.map(s => s.ph));
    DICT[k] = { key: k, w: key, spell, plain, marks, pmarks, ipa, ko: K.plain || null, koAt: K.marks.map(m => m[0]), koSpan: K.marks, gloss, groups: (grp || '').split(',').filter(Boolean), syl, ph };
  });
  TH.DICT = DICT;
  const entry = w => DICT[String(w).toLowerCase().replace(/[.,!?]+$/, '').replace(/’/g, "'")] || null;
  TH.entry = entry;
  // 화면에 보일 IPA: 음절 점은 센 음절 표시(ˈ) 앞에서는 빼요 (tə.ˈgɛ.ðɚ → təˈgɛ.ðɚ)
  TH.ipa = w => { const e = entry(w); return e ? '/' + e.ipa.replace(/\.(?=[ˈˌ])/g, '') + '/' : ''; };
  TH.nSyl = w => { const e = entry(w); return e ? e.syl.length : 0; };
  TH.stressAt = w => { const e = entry(w); return e ? Math.max(0, e.syl.findIndex(s => s.st)) : 0; };

  /* ---------- 자리: 음절에서 계산 ---------- */
  const POS = {
    start: { ko: '처음', long: '낱말 처음',
      say: '낱말 처음 — 한국어식으로는 바람 th 소리가 ㅅ(think → 싱크), 울림 th 소리가 ㄷ(they → 데이)이 되기 쉬워요. 혀끝을 윗니 끝에 먼저 대고 소리를 시작해요.' },
    cluster: { ko: '묶음', long: '자음과 붙은 자리(묶음)',
      say: '자음과 붙은 자리 — three · throat처럼 th 소리 뒤에 r 소리가 바로 와요. 한국어식으로는 으를 넣어요(스리). 혀끝을 이에서 떼면서 곧바로 r 모양으로 가요.' },
    mid: { ko: '가운데', long: '낱말 가운데',
      say: '낱말 가운데 — nothing · mother처럼 모음 사이의 th 소리는 짧게 지나가요. 혀끝이 윗니 끝을 가볍게 스쳐요. 막지 않아요.' },
    end: { ko: '끝', long: '낱말 끝 · 자음 앞',
      say: '낱말 끝 — 한국어식으로는 끝에 으를 붙여요(mouth → 마우스, breathe → 브리드). 영어는 혀끝을 윗니 끝에 댄 채 약한 바람이나 떨림으로 끝내요.' },
  };
  TH.POS = POS;
  TH.POS_ORDER = ['start', 'cluster', 'mid', 'end'];
  // 전체 음소 번호 gi의 소리 정보 { i, ph, pos, prev, next, syl, role }
  function soundAt(e, gi) {
    let i = 0, out = null;
    e.syl.forEach((s, si) => {
      const v = s.ph.findIndex(isV), k = gi - i;
      if (k >= 0 && k < s.ph.length) {
        const pos = k < v ? (v > 1 ? 'cluster' : si === 0 ? 'start' : 'mid') : 'end';
        out = { i: gi, ph: s.ph[k], pos, prev: e.ph[gi - 1], next: e.ph[gi + 1], syl: si, role: TH.role(s.ph[k]) };
      }
      i += s.ph.length;
    });
    return out;
  }
  // 낱말 속 th 소리(θ · ð)마다 { i(전체 음소 번호), ph, pos, prev, next, syl(음절 번호), role }
  function sounds(w) {
    const e = typeof w === 'object' ? w : entry(w);
    if (!e) return [];
    const out = [];
    e.ph.forEach((ph, gi) => { if (TARGET.indexOf(ph) >= 0) out.push(soundAt(e, gi)); });
    return out;
  }
  TH.sounds = sounds;
  TH.targets = sounds;
  TH.posOf = (w, ph) => { const L = sounds(w).filter(x => !ph || x.ph === ph); return L.length ? L[0].pos : null; };

  /* ---------- 최소 대립쌍: 소리 하나만 th ↔ s · f · t(바람 th) · th ↔ d · z(울림 th)로 다른가 ---------- */
  const KINDS = { ths: ['θ', 's'], thf: ['θ', 'f'], tht: ['θ', 't'], dhd: ['ð', 'd'], dhz: ['ð', 'z'] };
  TH.KINDS = KINDS;
  TH.KIND_KO = { ths: 'th · s', thf: 'th · f', tht: 'th · t', dhd: 'th · d', dhz: 'th · z' };
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
    const L = soundAt(A, i), L2 = soundAt(B, i);
    return { ok: true, i, kind: kind || rev, a: kind ? a : b, b: kind ? b : a, pos: L.pos, samePos: L.pos === L2.pos, x: kind ? x : y, y: kind ? y : x };
  }
  TH.pairDiff = pairDiff;
  /* 짝 낱말 20 (듣고 가르기 · 영상 · 연습 문제) — a = th 소리 쪽, b = 짝 소리 쪽 */
  const PAIR_SRC = [
    ['think', 'sink'], ['thick', 'sick'], ['thing', 'sing'], ['thumb', 'sum'], ['mouth', 'mouse'], ['path', 'pass'], ['faith', 'face'],
    ['three', 'free'], ['thin', 'fin'], ['thought', 'fought'], ['death', 'deaf'],
    ['three', 'tree'], ['thank', 'tank'], ['both', 'boat'],
    ['they', 'day'], ['then', 'den'], ['though', 'dough'], ['breathe', 'breed'],
    ['breathe', 'breeze'], ['clothing', 'closing'],
  ];
  // 짝 낱말(b 쪽)의 짝 소리 — { } 글자가 적은 소리. 짝에서 계산해요
  function partnerOf(e) {
    if (!e || !e.pmarks.length) return null;
    for (const [a, b] of PAIR_SRC) {
      if (b !== e.key) continue;
      const d = pairDiff(a, b);
      if (d.ok) return soundAt(e, d.i);
    }
    return null;
  }
  TH.partnerOf = w => partnerOf(typeof w === 'object' ? w : entry(w));
  // 낱말에서 칠할 소리: th 소리(role a) + 짝 낱말의 짝 소리(role b), 소리 차례대로
  function keys(e) {
    const p = partnerOf(e), L = sounds(e);
    return (p ? L.concat([p]) : L).sort((x, y) => x.i - y.i);
  }

  /* ---------- 한국어식 표기 (국립국어원 외래어 표기법 제2장 표 1 · 제3장 제1절) ----------
     제3항 마찰음: 어말 · 자음 앞의 [s] · [z] · [f] · [θ] · [ð]는 ‘으’를 붙여(스 · 즈 · 프 · 스 · 드) 적어요. 모음 앞에서는 θ → ㅅ, ð → ㄷ
     제1항 파열음: 긴 모음 · 이중 모음 뒤의 어말 [t] · [d]는 ‘으’를 붙여요(boat 보트 · breed 브리드)
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
  TH.hangul = hangul;
  const ON = { 'θ': 9, 'ð': 3, s: 9, f: 17, t: 16, d: 3, z: 12 }, ON_KO = { 'θ': 'ㅅ', 'ð': 'ㄷ', s: 'ㅅ', f: 'ㅍ', t: 'ㅌ', d: 'ㄷ', z: 'ㅈ' }, VO_EU = 18;
  // 한 소리 L과 그 소리를 적은 한글 음절 h가 표기법대로인가 → { ok, kind, why }
  function koRule(L, h) {
    const fin = !L.next || !isV(L.next);       // 어말 · 자음 앞
    if (ON[L.ph] == null) return { ok: false, why: '모르는 소리' };
    if (h.on !== ON[L.ph]) return { ok: false, why: `첫소리가 ${ON_KO[L.ph]}이 아님` };
    if (fin && h.vo !== VO_EU) return { ok: false, why: '끝 · 자음 앞인데 으가 아님' };
    return { ok: true, kind: L.ph };
  }
  // 낱말의 한국어식 표기: [{ ch, ph, kind, L, ok, why }] — [ ]로 표시한 음절이 소리 차례대로
  function koParts(w) {
    const e = typeof w === 'object' ? w : entry(w);
    if (!e || !e.ko) return [];
    const H = hangul(e.ko), L = keys(e);
    if (L.length !== e.koAt.length) return [];
    return e.koAt.map((at, k) => Object.assign({ at, ch: H[at].ch, ph: L[k].ph, L: L[k] }, koRule(L[k], H[at])));
  }
  TH.koParts = koParts;
  TH.KO_KIND = { 'θ': 'ㅅ (바람 th 소리)', 'ð': 'ㄷ (울림 th 소리)', s: 'ㅅ (s 소리)', f: 'ㅍ (f 소리)', t: 'ㅌ (t 소리)', d: 'ㄷ (d 소리)', z: 'ㅈ (z 소리)' };
  // 한글 음절마다 역할: 'θ' · 'ð' · 's' · 'f' · 't' · 'd' · 'z' · null (그 한글이 영어의 어느 소리를 적었나)
  TH.koMarks = function (w) {
    const e = entry(w);
    if (!e || !e.ko) return [];
    const marks = [...e.ko].map(() => null);
    koParts(e).forEach(p => { if (p.ok) marks[p.at] = p.kind; });
    return marks;
  };
  // 짝이 같은 한국어식 표기가 되나 (think · sink = 싱크 · 싱크, three · free = 스리 · 프리)
  TH.koSame = (a, b) => { const A = entry(a), B = entry(b); return !!(A && B && A.ko && A.ko === B.ko); };

  /* ---------- 철자 속 소리 글자 (영상 · 페이지에서 그 글자만 칠하기) ---------- */
  // [{ s, e, ph, pos, role }] — th 글자(role a)와 짝 낱말의 짝 소리 글자(role b)
  function spans(word) {
    const e = entry(word);
    if (!e) return [];
    const L = sounds(e);
    if (L.length !== e.marks.length) return [{ bad: true }];
    const out = e.marks.map((m, k) => ({ s: m[0], e: m[1], ph: L[k].ph, pos: L[k].pos, role: 'a' }));
    const p = partnerOf(e);
    if (e.pmarks.length) {
      if (!p || e.pmarks.length !== 1) return [{ bad: true }];
      out.push({ s: e.pmarks[0][0], e: e.pmarks[0][1], ph: p.ph, pos: p.pos, role: 'b' });
    }
    return out.sort((x, y) => x.s - y.s);
  }
  TH.spans = spans;
  // 문장 → [{ t, ph, role, pos, w }] 조각 (문장에서는 th 소리만 칠해요)
  TH.segs = function (text) {
    const out = [];
    String(text).split(/(\s+)/).forEach(tok => {
      if (!tok) return;
      const m = tok.match(/^([^A-Za-z'’]*)([A-Za-z'’][A-Za-z'’-]*?)([^A-Za-z]*)$/);
      if (!m) { out.push({ t: tok, ph: null }); return; }
      if (m[1]) out.push({ t: m[1], ph: null });
      const w = m[2], e = entry(w), sp = e ? spans(w).filter(x => !x.bad && x.role === 'a') : [];
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
  // 문장 속 소리 수 { θ, ð }
  TH.countIn = text => TH.segs(text).reduce((o, s) => { if (s.ph) o[s.ph]++; return o; }, { 'θ': 0, 'ð': 0 });

  /* ---------- 짝 낱말 20 ---------- */
  TH.PAIRS = PAIR_SRC.map(([a, b]) => { const d = pairDiff(a, b); return { a, b, kind: d.kind, pos: d.pos, id: a + '-' + b, same: TH.koSame(a, b) }; });
  TH.pairById = id => TH.PAIRS.find(p => p.id === id) || null;
  TH.pairsOf = w => TH.PAIRS.filter(p => p.a === w || p.b === w);
  // 짝을 가르는 소리(그 낱말 쪽)
  TH.pairPhone = (p, w) => { const d = pairDiff(p.a, p.b); return entry(w).ph[d.i]; };

  /* ---------- 목소리 (듣고 가르기: 미국식 목소리 넷) ---------- */
  TH.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '미국 여성 ①' },
    { sp: 'tf', ko: '차분한 선생님', who: '미국 여성 ②' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성 ③' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];

  /* ---------- 입 그림 (EN.mouth) — 소리마다 자세 · 목 울림 ---------- */
  TH.MOUTH = {
    'θ': { pose: 'th', voice: false, ko: '혀끝을 윗니 끝에 가볍게 대고 그 틈으로 약한 바람 · 목은 울리지 않음' },
    'ð': { pose: 'th', voice: true, ko: '바람 th 소리와 같은 혀 · 목을 울림 · 막지 않음' },
    s: { pose: 's', voice: false, ko: '혀끝을 윗잇몸 가까이(이에 닿지 않게) · 가운데 좁은 길로 센 바람' },
    z: { pose: 's', voice: true, ko: 's 소리와 같은 혀 · 목을 울림' },
    f: { pose: 'f', voice: false, ko: '윗니 끝을 아랫입술에 가볍게 · 혀는 쉼' },
    t: { pose: 't', voice: false, ko: '혀끝을 윗잇몸에 붙여 막았다가 터뜨림' },
    d: { pose: 't', voice: true, ko: 't 소리와 같은 혀 · 목을 울림 · 막았다가 뗌' },
  };

  /* ---------- 낱말 묶음 (영상 · 직접 해 보기) ---------- */
  TH.SETS = {
    thW: ['think', 'thank', 'three', 'thing'],
    thsPairs: [['think', 'sink'], ['thick', 'sick'], ['mouth', 'mouse']],
    thfPairs: [['three', 'free'], ['thin', 'fin'], ['death', 'deaf']],
    thtPairs: [['three', 'tree'], ['thank', 'tank'], ['both', 'boat']],
    dhW: ['the', 'this', 'that', 'they'],
    dhMid: ['mother', 'brother', 'weather', 'together'],
    dhdPairs: [['they', 'day'], ['then', 'den'], ['breathe', 'breed']],
    dhzPairs: [['breathe', 'breeze'], ['clothing', 'closing']],
    place: { start: ['think', 'thank', 'this'], cluster: ['three', 'throat', 'thriller'], mid: ['nothing', 'method', 'mother'], end: ['bath', 'teeth', 'with', 'breathe'] },
  };
  // 외래어 함정 16: 줄마다 넷 — th → ㅅ(처음) · th → ㅅ · 스(가운데 · 끝) · th → ㄷ · 철자는 th인데 t 소리
  TH.LOAN = [
    { w: 'thriller', trap: 'th1' }, { w: 'theater', trap: 'th1' }, { w: 'thumbnail', trap: 'th1' }, { w: 'third', trap: 'th1' },
    { w: 'health', trap: 'th2' }, { w: 'Bluetooth', trap: 'th2' }, { w: 'method', trap: 'th2' }, { w: 'birthday', trap: 'th2' },
    { w: 'rhythm', trap: 'dh' }, { w: 'smoothie', trap: 'dh' }, { w: 'weather', trap: 'dh' }, { w: 'leather', trap: 'dh' },
    { w: 'Thomas', trap: 'tt' }, { w: 'Thailand', trap: 'tt' }, { w: 'thyme', trap: 'tt' }, { w: 'Thames', trap: 'tt' },
  ];
  TH.TRAP = {
    th1: { ko: 'th → ㅅ', why: '혀끝을 윗니 끝에 대요 — ㅅ처럼 혀끝을 잇몸 쪽에 두면 s 소리가 돼요' },
    th2: { ko: 'th → ㅅ · 스', why: '가운데 · 끝에서도 혀끝을 윗니 끝에 대고 약한 바람을 내요. 끝에 으를 붙이지 않아요' },
    dh: { ko: 'th → ㄷ', why: 'ㄷ처럼 혀끝으로 막지 않아요. 혀끝을 윗니 끝에 가볍게 댄 채 목을 울려요' },
    tt: { ko: '철자 th · 소리 t', why: '철자는 th지만 t 소리로 읽는 낱말이에요. 이런 낱말은 혀끝을 윗잇몸에 붙여요' },
  };
  // 영상 · 페이지가 ‘같은 표기’ · ‘다른 표기’라고 말하는 짝 (check가 엔진으로 확인)
  TH.CLAIMS = {
    same: [['think', 'sink'], ['thick', 'sick'], ['thing', 'sing'], ['mouth', 'mouse'], ['path', 'pass'], ['faith', 'face'], ['they', 'day'], ['then', 'den'], ['though', 'dough'], ['breathe', 'breed']],
    diff: [['three', 'free'], ['three', 'tree'], ['thin', 'fin'], ['death', 'deaf'], ['thank', 'tank'], ['both', 'boat'], ['breathe', 'breeze'], ['clothing', 'closing']],
  };

  /* ---------- 음절 수: 영어(모음 수) · 한국어식(한글 음절 수) ---------- */
  TH.syl = w => { const e = entry(w); return e ? e.ph.filter(isV).length : 0; };
  TH.koSyl = w => { const e = entry(w); return e && e.ko ? [...e.ko].length : 0; };
  // 한국어식 표기에서 넣은 모음 음절 — 영어에 없는 모음. 음절이 늘어난 만큼만, 뒤에서부터. 후보: 모음 ㅡ 음절
  TH.koInserted = function (w) {
    const e = entry(w);
    if (!e || !e.ko) return [];
    const extra = TH.koSyl(w) - TH.syl(w);
    if (extra <= 0) return [];
    const u = [];
    hangul(e.ko).forEach((s, k) => { if (s.vo === VO_EU) u.push(k); });
    return u.length <= extra ? u : u.slice(u.length - extra);
  };

  /* ---------- 문장 (영상 09장 · 따라 말하기 28) — 묶음마다 일곱: 바람 th / 울림 th / 가운데 · 끝 / 섞어서 ---------- */
  TH.GROUPS = { th: '바람 th 소리', dh: '울림 th 소리', end: '가운데 · 끝의 th 소리', mix: '두 th 소리 섞어서' };
  TH.GROUP_ORDER = ['th', 'dh', 'end', 'mix'];
  TH.SENT = [
    { grp: 'th', en: 'Thank you so much.', ko: '정말 고맙습니다.' },
    { grp: 'th', en: 'I think so.', ko: '그런 것 같아요.' },
    { grp: 'th', en: 'Three tickets, please.', ko: '표 세 장 주세요.' },
    { grp: 'th', en: 'See you on Thursday.', ko: '목요일에 만나요.' },
    { grp: 'th', en: 'I have a sore throat.', ko: '목이 아파요.' },
    { grp: 'th', en: 'Let me think about it.', ko: '생각 좀 해 볼게요.' },
    { grp: 'th', en: 'It costs thirty dollars.', ko: '30달러예요.' },
    { grp: 'dh', en: 'This is my brother.', ko: '이쪽은 제 남동생이에요.' },
    { grp: 'dh', en: "What's that?", ko: '저게 뭐예요?' },
    { grp: 'dh', en: 'They live over there.', ko: '그들은 저쪽에 살아요.' },
    { grp: 'dh', en: 'Is this the right bus?', ko: '이 버스가 맞나요?' },
    { grp: 'dh', en: "How's the weather today?", ko: '오늘 날씨 어때요?' },
    { grp: 'dh', en: "I'll take these, please.", ko: '이걸로 할게요.' },
    { grp: 'dh', en: 'My mother and father are teachers.', ko: '저희 부모님은 선생님이세요.' },
    { grp: 'end', en: 'Take a deep breath.', ko: '숨을 깊이 들이쉬세요.' },
    { grp: 'end', en: 'Brush your teeth.', ko: '이를 닦으세요.' },
    { grp: 'end', en: 'Open your mouth, please.', ko: '입을 벌려 주세요.' },
    { grp: 'end', en: 'Come with me.', ko: '저와 같이 가요.' },
    { grp: 'end', en: "It's worth it.", ko: '그럴 만한 가치가 있어요.' },
    { grp: 'end', en: 'Both are fine.', ko: '둘 다 괜찮아요.' },
    { grp: 'end', en: 'Happy birthday!', ko: '생일 축하해요!' },
    { grp: 'mix', en: 'I thought they were together.', ko: '그들이 함께 있는 줄 알았어요.' },
    { grp: 'mix', en: 'There are three things.', ko: '세 가지가 있어요.' },
    { grp: 'mix', en: 'Thanks for the birthday gift.', ko: '생일 선물 고마워요.' },
    { grp: 'mix', en: 'My brother is thirty years old.', ko: '제 형은 서른 살이에요.' },
    { grp: 'mix', en: 'The math test is on the third.', ko: '수학 시험은 3일이에요.' },
    { grp: 'mix', en: 'Is there a bathroom on this floor?', ko: '이 층에 화장실이 있나요?' },
    { grp: 'mix', en: 'Nothing is better than this.', ko: '이보다 좋은 건 없어요.' },
  ];
  // 문장이 그 묶음에 맞나: th = 바람 th가 있음 · dh = 울림 th가 있음 · end = 가운데 · 끝의 th가 있음 · mix = 둘 다 있음
  TH.groupOk = function (s) {
    const c = TH.countIn(s.en);
    if (s.grp === 'th') return c['θ'] > 0;
    if (s.grp === 'dh') return c['ð'] > 0;
    if (s.grp === 'end') return TH.segs(s.en).some(x => x.ph && (x.pos === 'mid' || x.pos === 'end'));
    return c['θ'] > 0 && c['ð'] > 0;
  };

  /* ---------- 음성 인식: 들은 말이 목표 낱말인가, 짝 낱말인가 ----------
     인식기는 낱말을 철자로 돌려줘요. 소리가 같은 다른 낱말(sum = some)도 그 소리로 쳐요 */
  const SAME = {
    sum: ['some'], some: ['sum'], sink: ['sync'], dough: ['doe'], fin: ['finn'], sick: ['sic'], deaf: ['def'], though: ['tho'],
    there: ['their', "they're"], thyme: ['time'],
  };
  TH.SAME = SAME;
  const words = s => String(s || '').toLowerCase().replace(/’/g, "'").replace(/[^a-z' -]+/g, ' ').split(/\s+/).filter(Boolean);
  const has = (list, w) => list.indexOf(w) >= 0 || (SAME[w] || []).some(x => list.indexOf(x) >= 0);
  // alts: 인식 후보 글 목록(첫째가 가장 그럴듯함) → { verdict: 'target' | 'partner' | 'maybe' | 'other' | 'none', heard }
  TH.heard = function (target, alts, partner) {
    alts = (alts || []).filter(Boolean);
    if (!alts.length) return { verdict: 'none', heard: '', partner };
    const top = words(alts[0]);
    if (has(top, target)) return { verdict: 'target', heard: alts[0], partner };
    if (partner && has(top, partner)) return { verdict: 'partner', heard: alts[0], partner };
    const k = alts.findIndex(a => has(words(a), target));
    if (k > 0) return { verdict: 'maybe', heard: alts[0], rank: k + 1, partner };
    return { verdict: 'other', heard: alts[0], partner };
  };
  TH.HEARD_KO = {
    target: '목표 낱말로 들었어요',
    partner: '짝 낱말로 들었어요',
    maybe: '첫째 후보는 아니지만 후보에 있었어요',
    other: '다른 낱말로 들었어요',
    none: '아무 말도 듣지 못했어요',
  };

  /* ---------- 따라 말하기: 낱말 맞추기 (들린 낱말 초록 · 빠진 낱말 주황) ---------- */
  const norm = w => w.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9'-]/g, '');
  TH.compareWords = function (target, heard) {
    const T = String(target).split(/\s+/).filter(Boolean).map(w => ({ w, n: norm(w) }));
    const Hs = words(heard).map(norm);
    const used = Hs.map(() => false);
    let hit = 0;
    const NUM = { three: '3', thirty: '30', third: '3rd' };
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
  TH.DRILL = [
    { kind: 'word', sp: 'um', say: 'think', opts: ['think', 'sink'], a: 0 },
    { kind: 'word', sp: 'uf', say: 'free', opts: ['three', 'free'], a: 1 },
    { kind: 'sent', sp: 'tf', say: 'Look at the mouse.', frame: 'Look at the ___.', opts: ['mouth', 'mouse'], a: 1, ko: '저 쥐 좀 봐요.' },
    { kind: 'same', sp: 'tc', say: ['they', 'day'], opts: ['같아요', '달라요'], a: 1 },
    { kind: 'word', sp: 'tf', say: 'thick', opts: ['thick', 'sick'], a: 0 },
    { kind: 'ko', sp: 'uf', say: ['싱크', 'think'], opts: ['첫째 소리', '둘째 소리'], a: 0 },
    { kind: 'word', sp: 'tc', say: 'boat', opts: ['both', 'boat'], a: 1 },
    { kind: 'sent', sp: 'um', say: 'Take the path.', frame: 'Take the ___.', opts: ['path', 'pass'], a: 0, ko: '그 오솔길로 가세요.' },
    { kind: 'same', sp: 'uf', say: ['thing', 'thing'], opts: ['같아요', '달라요'], a: 0 },
    { kind: 'word', sp: 'um', say: 'den', opts: ['then', 'den'], a: 1 },
    { kind: 'sent', sp: 'tc', say: 'I lost faith.', frame: 'I lost ___.', opts: ['faith', 'face'], a: 0, ko: '믿음을 잃었어요.' },
    { kind: 'same', sp: 'tf', say: ['breathe', 'breeze'], opts: ['같아요', '달라요'], a: 1 },
    { kind: 'word', sp: 'um', say: 'sum', opts: ['thumb', 'sum'], a: 1 },
    { kind: 'ko', sp: 'tc', say: ['mother', '머더'], opts: ['첫째 소리', '둘째 소리'], a: 1 },
    { kind: 'sent', sp: 'uf', say: 'They are three.', frame: 'They are ___.', opts: ['three', 'free'], a: 0, ko: '그들은 세 명이에요.' },
    { kind: 'same', sp: 'tf', say: ['sum', 'some'], opts: ['같아요', '달라요'], a: 0 },
  ];
  const isKo = s => /[가-힣]/.test(s);
  TH.isKo = isKo;
  // 문제의 목표 낱말(정답 낱말 · 같은가 문제는 첫 낱말 · 한국어식 문제는 영어 낱말)
  TH.drillWord = q => q.kind === 'same' ? q.say[0] : q.kind === 'ko' ? q.say.find(s => !isKo(s)) : q.kind === 'sent' ? q.opts[q.a] : q.say;
  TH.drillWords = q => q.kind === 'same' ? q.say.slice() : q.kind === 'ko' ? q.say.filter(s => !isKo(s)) : q.opts.slice();
  // 소리가 같은 두 낱말인가
  TH.homophone = (a, b) => { const A = entry(a), B = entry(b); return !!(A && B && A.ph.join(' ') === B.ph.join(' ')); };
  // 힌트 세 단계(엔진이 짝의 종류 · 자리에서 만들어요)
  const LISTEN_HINT = {
    ths: 's 소리는 세고 높은 쉿 소리예요. th 소리는 훨씬 약하고 부드러운 바람 소리예요.',
    thf: 'th 소리와 f 소리는 둘 다 약한 바람 소리라 귀로는 가장 헷갈려요. 여러 번 견줘 들어요.',
    tht: 't 소리는 막혔다가 톡 터지며 시작해요. th 소리는 터지는 소리 없이 약한 바람이 이어져요.',
    dhd: 'd 소리는 막혔다가 톡 떨어지며 시작해요. 울림 th 소리는 떨림이 부드럽게 이어져요.',
    dhz: 'z 소리는 지잉 하고 또렷하게 떨려요. 울림 th 소리는 더 약하고 부드럽게 떨려요.',
  };
  const MOUTH_HINT = {
    ths: 's 소리는 혀끝을 윗잇몸 가까이 두고 이에 닿지 않아요. th 소리는 혀끝을 윗니 끝에 가볍게 대요.',
    thf: 'f 소리는 윗니 끝을 아랫입술에 얹어요. th 소리는 입술이 아니라 혀끝을 윗니 끝에 대요.',
    tht: 't 소리는 혀끝을 윗잇몸에 붙여 막아요. th 소리는 막지 않고, 혀끝을 윗니 끝에 댄 채 바람을 흘려요.',
    dhd: 'd 소리는 혀끝을 윗잇몸에 붙여 막아요. 울림 th 소리는 막지 않고, 혀끝을 윗니 끝에 댄 채 목을 울려요.',
    dhz: 'z 소리는 혀끝을 윗잇몸 가까이 둬요(이에 닿지 않아요). 울림 th 소리는 혀끝을 윗니 끝에 대요.',
  };
  TH.LISTEN_HINT = LISTEN_HINT; TH.MOUTH_HINT = MOUTH_HINT;
  const kindOfPh = ph => ph === 'ð' || ph === 'd' || ph === 'z' ? (ph === 'z' ? 'dhz' : 'dhd') : ph === 'f' ? 'thf' : ph === 't' ? 'tht' : 'ths';
  TH.kindOfPh = kindOfPh;
  TH.hints = function (q) {
    if (q.kind === 'ko') {
      const en = TH.drillWord(q), e = entry(en), L = sounds(en)[0];
      return [
        { head: '① 듣고 가르기', text: '한국어식으로 읽으면 바람 th 소리가 ㅅ, 울림 th 소리가 ㄷ이 되고, 끝에는 으가 붙어요.' },
        { head: '② 혀끝의 자리', text: L ? MOUTH_HINT[kindOfPh(L.ph)] : '' },
        { head: '③ 낱말 · 문장 속에서', text: `${en} → 한국어식 ${e.ko}. ${L ? POS[L.pos].say : ''}` },
      ];
    }
    const ws = TH.drillWords(q).filter(w => entry(w));
    let d = ws.length > 1 ? pairDiff(ws[0], ws[1]) : { ok: false };
    if (!d.ok) { const p = TH.pairsOf(ws[0])[0]; d = p ? pairDiff(p.a, p.b) : { ok: false }; }
    const L0 = sounds(ws[0])[0];
    const kind = d.ok ? d.kind : L0 ? kindOfPh(L0.ph) : 'ths', pos = d.ok ? d.pos : L0 ? L0.pos : 'start';
    const step1 = q.kind === 'same' && TH.homophone(q.say[0], q.say[1])
      ? '철자는 달라도 소리가 같은 낱말이 있어요. 두 낱말의 시작과 끝을 하나씩 견줘 들어요.'
      : (pos === 'end' ? '끝을 들어요. ' : pos === 'mid' ? '가운데를 들어요. ' : '시작을 들어요. ') + LISTEN_HINT[kind];
    const step3 = `${POS[pos].long} 자리예요. ${POS[pos].say}` + (q.kind === 'sent' ? ' 문장 속에서는 두 낱말이 모두 말이 되니 소리만이 뜻을 정해요.' : '');
    return [
      { head: '① 듣고 가르기', text: step1 },
      { head: '② 혀끝의 자리', text: MOUTH_HINT[kind] },
      { head: '③ 낱말 · 문장 속에서', text: step3 },
    ];
  };

  /* ---------- 모든 글 (글꼴 미리 받기용) ---------- */
  TH.allText = () => Object.values(DICT).map(e => e.w + e.ipa + (e.ko || '') + e.gloss).join('') +
    TH.SENT.map(s => s.en + s.ko).join('') + Object.values(POS).map(p => p.ko + p.long + p.say).join('') +
    Object.values(TH.TRAP).map(t => t.ko + t.why).join('') + TH.VOICES.map(v => v.ko + v.who).join('') +
    Object.values(TH.MOUTH).map(m => m.ko).join('') + Object.values(TH.KO_KIND).join('') + Object.values(TH.GROUPS).join('') +
    Object.values(TH.LONG).join('') + Object.values(LISTEN_HINT).join('') + Object.values(MOUTH_HINT).join('') + Object.values(TH.KIND_KO).join('');

  /* ---------- 데이터 점검 ---------- */
  TH.check = function () {
    const warn = DICT_WARN.slice();
    const w = m => warn.push(m);
    const pairB = new Set(PAIR_SRC.map(p => p[1]));
    // 사전: 철자 · 칠할 글자 수 · 글자가 그 소리를 적을 만한가 · 한국어식 표기
    Object.values(DICT).forEach(e => {
      if (e.plain.toLowerCase() !== e.key) w(`${e.key}: 철자 ${e.plain}이 낱말과 다름`);
      const L = sounds(e);
      if (L.length !== e.marks.length) { w(`${e.key}: [ ] 글자 ${e.marks.length}개, th 소리 ${L.length}개`); return; }
      e.marks.forEach((m, k) => {
        const s = e.plain.slice(m[0], m[1]).toLowerCase();
        if (PLAUS[L[k].ph].indexOf(s) < 0) w(`${e.key}: ${L[k].ph} 소리를 ‘${s}’로 적음`);
      });
      if (e.pmarks.length) {
        const p = partnerOf(e);
        if (e.pmarks.length !== 1 || !p) w(`${e.key}: { } 글자가 짝의 짝 소리와 맞지 않음`);
        else { const s = e.plain.slice(e.pmarks[0][0], e.pmarks[0][1]).toLowerCase(); if (PLAUS[p.ph].indexOf(s) < 0) w(`${e.key}: ${p.ph} 소리를 ‘${s}’로 적음`); }
        if (!pairB.has(e.key)) w(`${e.key}: { } 글자가 있지만 짝 낱말이 아님`);
      } else if (pairB.has(e.key)) w(`${e.key}: 짝 낱말인데 { } 글자가 없음`);
      e.syl.forEach((s, i) => { if (s.ph.filter(isV).length !== 1) w(`${e.key}: ${i + 1}번째 음절의 모음 수 ${s.ph.filter(isV).length}`); });
      if (e.syl.length > 1 && e.syl.filter(s => s.st).length !== 1) w(`${e.key}: 센 음절 표시(ˈ)가 하나가 아님`);
      if (e.ko) {
        const K = keys(e);
        if (e.koSpan.some(m => m[1] - m[0] !== 1)) w(`${e.key}(${e.ko}): [ ] 안에 한글 한 글자만`);
        if (e.koAt.length !== K.length) { w(`${e.key}(${e.ko}): 한글 [ ] ${e.koAt.length}개, 소리 ${K.length}개`); return; }
        koParts(e).forEach((p, k) => { if (!p.ok) w(`${e.key}(${e.ko}): ${k + 1}번째 ${p.ph} 소리 → ‘${p.ch}’ — ${p.why}`); });
      }
    });
    // 짝: 소리 하나만, a 쪽이 th 소리
    TH.PAIRS.forEach(p => {
      const d = pairDiff(p.a, p.b);
      if (!d.ok) { w(`짝 ${p.a} · ${p.b}: ${d.why}`); return; }
      if (d.a !== p.a) w(`짝 ${p.a} · ${p.b}: th 소리 쪽이 바뀜`);
      if (!d.samePos) w(`짝 ${p.a} · ${p.b}: 두 낱말의 자리가 다름`);
    });
    if (TH.PAIRS.length < 18 || TH.PAIRS.length > 22) w(`짝 ${TH.PAIRS.length}개 (18~22개)`);
    if (new Set(TH.PAIRS.map(p => p.id)).size !== TH.PAIRS.length) w('짝이 겹침');
    Object.keys(KINDS).forEach(k => { if (!TH.PAIRS.some(p => p.kind === k)) w(`짝 갈래 ${k}가 없음`); });
    // 짝 · 외래어 · 묶음의 낱말이 사전에 있고 한국어식 표기가 있나
    TH.PAIRS.forEach(p => [p.a, p.b].forEach(x => { if (!entry(x) || !entry(x).ko) w(`짝 낱말에 한국어식 표기가 없음: ${x}`); }));
    const S = TH.SETS;
    const need = [].concat(S.thW, [].concat(...S.thsPairs), [].concat(...S.thfPairs), [].concat(...S.thtPairs), S.dhW, S.dhMid, [].concat(...S.dhdPairs), [].concat(...S.dhzPairs), ...Object.values(S.place), TH.LOAN.map(x => x.w));
    need.forEach(x => { if (!entry(x)) w(`사전에 없음: ${x}`); else if (!entry(x).ko) w(`한국어식 표기가 없음: ${x}`); });
    // 영상 · 페이지가 말하는 ‘같은 표기’ · ‘다른 표기’
    TH.CLAIMS.same.forEach(([a, b]) => { if (!TH.koSame(a, b)) w(`같은 표기라고 했지만 다름: ${a} · ${b}`); });
    TH.CLAIMS.diff.forEach(([a, b]) => { if (TH.koSame(a, b)) w(`다른 표기라고 했지만 같음: ${a} · ${b}`); });
    // 묶음의 낱말: 말하는 소리 · 자리 · 짝의 갈래가 맞나
    S.thW.forEach(x => { if (!sounds(x).some(L => L.ph === 'θ')) w(`바람 th 묶음: ${x}에 그 소리가 없음`); });
    S.dhW.forEach(x => { if (TH.posOf(x, 'ð') !== 'start') w(`울림 th 처음 묶음: ${x}`); });
    S.dhMid.forEach(x => { if (TH.posOf(x, 'ð') !== 'mid') w(`울림 th 가운데 묶음: ${x}`); });
    [['thsPairs', 'ths'], ['thfPairs', 'thf'], ['thtPairs', 'tht'], ['dhdPairs', 'dhd'], ['dhzPairs', 'dhz']].forEach(([k, kind]) => S[k].forEach(([a, b]) => {
      const p = TH.PAIRS.find(q => q.a === a && q.b === b);
      if (!p || p.kind !== kind) w(`묶음 ${k}: ${a} · ${b}가 ${kind} 짝이 아님`);
    }));
    Object.keys(S.place).forEach(pos => S.place[pos].forEach(x => { if (!sounds(x).some(L => L.pos === pos)) w(`자리 ${POS[pos].ko}: ${x}에 그 자리의 th 소리가 없음`); }));
    // 외래어 16: 줄마다 넷, 함정의 종류가 엔진과 맞나
    if (TH.LOAN.length !== 16) w(`외래어 카드 ${TH.LOAN.length}개 (16개여야 함)`);
    ['th1', 'th2', 'dh', 'tt'].forEach(t => { const n = TH.LOAN.filter(x => x.trap === t).length; if (n !== 4) w(`외래어 ${t} 카드 ${n}개 (4개여야 함)`); });
    TH.LOAN.forEach(o => {
      const e = entry(o.w), T = sounds(o.w);
      const ok = o.trap === 'th1' ? T.length === 1 && T[0].ph === 'θ' && (T[0].pos === 'start' || T[0].pos === 'cluster')
        : o.trap === 'th2' ? T.length === 1 && T[0].ph === 'θ' && (T[0].pos === 'mid' || T[0].pos === 'end')
          : o.trap === 'dh' ? T.length === 1 && T[0].ph === 'ð'
            : !!e && T.length === 0 && /^th/i.test(e.plain) && e.ph[0] === 't';
      if (!ok) w(`외래어 ${o.w}: 함정 ${o.trap}이 소리와 맞지 않음`);
    });
    // 문장: 28개, 묶음마다 일곱, 그 소리가 문장에 있나, th 낱말이 사전에 있나
    if (TH.SENT.length !== 28) w(`따라 말하기 문장 ${TH.SENT.length}개(28개여야 함)`);
    TH.GROUP_ORDER.forEach(gp => { const n = TH.SENT.filter(s => s.grp === gp).length; if (n !== 7) w(`문장 묶음 ${gp}: ${n}개(7개여야 함)`); });
    TH.SENT.forEach(s => { if (!TH.groupOk(s)) w(`문장 "${s.en}": ${TH.GROUPS[s.grp]} 묶음과 맞지 않음`); });
    const sentWords = [];
    TH.SENT.concat(TH.DRILL.filter(q => q.kind === 'sent').map(q => ({ en: q.say }))).forEach(s => s.en.replace(/[A-Za-z'’][A-Za-z'’-]*/g, m => { sentWords.push(m); return m; }));
    sentWords.forEach(x => {
      if (/th/i.test(x) && !entry(x)) w(`문장 낱말이 사전에 없음: ${x}`);
      if (entry(x) && spans(x).some(s => s.bad)) w(`글자 칠하기 실패: ${x}`);
    });
    // 연습 문제: 정답 위치 · 소리 · 보기 · 목소리
    if (TH.DRILL.length !== 16) w(`연습 문제 ${TH.DRILL.length}개 (16개여야 함)`);
    const pos2 = [0, 0], perSp = {};
    TH.DRILL.forEach((q, k) => {
      const n = `연습 ${k + 1}`;
      if (q.opts.length !== 2) w(`${n}: 보기는 둘`);
      pos2[q.a]++; perSp[q.sp] = (perSp[q.sp] || 0) + 1;
      if (q.kind === 'word') {
        if (q.opts[q.a] !== q.say) w(`${n}: 정답 ${q.opts[q.a]} ≠ 들려주는 ${q.say}`);
        if (!pairDiff(q.opts[0], q.opts[1]).ok) w(`${n}: 보기가 짝이 아님`);
      }
      if (q.kind === 'sent') {
        if (q.frame.replace('___', q.opts[q.a]) !== q.say) w(`${n}: 문장과 정답이 맞지 않음`);
        if (!pairDiff(q.opts[0], q.opts[1]).ok) w(`${n}: 보기가 짝이 아님`);
      }
      if (q.kind === 'same') {
        const same = q.say[0] === q.say[1] || TH.homophone(q.say[0], q.say[1]);
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
    if (Object.values(perSp).some(n => n !== 4)) w(`연습 문제 목소리가 고르지 않음: ${JSON.stringify(perSp)}`);
    // 입 그림: th는 혀끝이 윗니에 닿고 입천장에는 닿지 않음 · s는 윗잇몸 가까이(이 · 입천장에 닿지 않음) · t는 윗잇몸에 닿음 · f는 아랫입술이 윗니에 닿고 혀는 이에 닿지 않음
    if (window.EN && EN.mouth && EN.mouth.contact && EN.mouth.tongueTeeth) {
      const Mm = EN.mouth;
      try {
        const th = Mm.tongueTeeth('th'), s = Mm.tongueTeeth('s'), t = Mm.tongueTeeth('t'), f = Mm.tongueTeeth('f');
        if (!th.touch) w(`입 그림 th: 혀끝이 윗니에 닿지 않음 (틈 ${th.gap})`);
        if (Mm.contact('th').touch) w('입 그림 th: 혀가 입천장에 닿음');
        if (s.touch) w('입 그림 s: 혀가 윗니에 닿음');
        if (Mm.contact('s').touch || Mm.contact('s').where !== '윗잇몸') w('입 그림 s: 윗잇몸 가까이(닿지 않음)가 아님');
        if (t.touch) w('입 그림 t: 혀가 윗니에 닿음');
        if (!Mm.contact('t').touch) w('입 그림 t: 혀가 윗잇몸에 닿지 않음');
        if (f.touch) w('입 그림 f: 혀가 윗니에 닿음');
        if (!Mm.lipTeeth('f').touch || Mm.lipTeeth('th').touch) w('입 그림: f는 아랫입술이 윗니에 닿고 th는 닿지 않아야');
      } catch (e) { w('입 그림 자세가 없음: ' + e.message); }
      Object.keys(TH.MOUTH).forEach(ph => { try { Mm.pose(TH.MOUTH[ph].pose); } catch (e) { w(`입 그림 자세 없음: ${TH.MOUTH[ph].pose}`); } });
    } else w('입 그림(EN.mouth.tongueTeeth)이 없음');
    warn.forEach(m => console.warn('[TH.check] ' + m));
    return warn.length;
  };
})();
