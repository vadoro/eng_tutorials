/* 입을 얼마나 벌리나 — æ · ɛ · ʌ · ɑ: 규칙 엔진 (OV)
 * 낱말마다 넓은 IPA(음절은 . · 센 음절 ˈ)와 철자(음절은 . · 센 음절의 목표 모음 글자는 [ ]), 한국어식 표기(센 음절의 한글은 [ ])를 손으로 적었어요.
 * 엔진은 이 세 가지에서 센 음절의 모음(æ · ɛ · ʌ · ɑ)과 그 짝 · 짝 낱말이 정말 그 모음 하나만 다른지 · 한국어식으로 읽으면
 * 두 낱말의 소리가 같아지는지(ㅐ · ㅔ는 한 소리) · 외래어 표기의 한글 모음이 영어 모음과 어긋나는지(함정) · 셋이 갈리는 줄 ·
 * 철자와 문장 속 칠하기 · 음성 인식이 들은 말을 계산해요. 손으로 적은 IPA는 misaki 미국 발음 사전과 따로 맞춰 봤어요(README).
 * 소리를 듣지 않아요 — 모음 지도의 점(F1 · F2)은 미리 만든 음성 파일을 따로 재서(audio/dialogue/measure.js) 그려요.
 */
(function () {
  'use strict';
  const OV = (window.OV = {});

  /* ---------- 소리 단위 ---------- */
  const VOW = ['aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'i', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ə', 'ɚ', 'ɝ', 'ɑ', 'ɔ', 'ʊ', 'u'];
  const CON = ['tʃ', 'dʒ', 'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j'];
  const UNITS = VOW.concat(CON).sort((a, b) => b.length - a.length);
  const isV = p => VOW.indexOf(p) >= 0;
  OV.isV = isV;
  function phones(s) {
    s = String(s).replace(/[ˈˌ.]/g, '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const u = UNITS.find(x => s.startsWith(x, i));
      if (!u) throw new Error(`[OV] 모르는 소리 ${s[i]} (${s})`);
      out.push(u); i += u.length;
    }
    return out;
  }
  OV.phones = phones;
  const NASAL = ['m', 'n', 'ŋ'];

  /* ---------- 네 모음 ----------
     open: 크게 벌린 모음(노랑 a) · 덜 벌린 모음(하늘 b) · front: 앞(애 · 에) · back: 뒤(아 · 어) */
  OV.V = {
    'æ': { v: 'æ', ko: '크게 벌린 애', short: '크게', kr: '애', open: true, front: true, role: 'a', mate: 'ɛ',
      tip: '턱을 크게 내리고 입꼬리를 옆으로 당겨요 — 한국어 애보다 훨씬 크게' },
    'ɛ': { v: 'ɛ', ko: '덜 벌린 에', short: '덜', kr: '에', open: false, front: true, role: 'b', mate: 'æ',
      tip: '턱을 조금만 내려요 — 한국어 에와 비슷해요' },
    'ɑ': { v: 'ɑ', ko: '크게 벌린 아', short: '크게', kr: '아', open: true, front: false, role: 'a', mate: 'ʌ',
      tip: '턱을 크게 내리고 혀를 낮게 뒤로 — 목 안을 보여 주듯 아' },
    'ʌ': { v: 'ʌ', ko: '덜 벌린 어', short: '덜', kr: '어', open: false, front: false, role: 'b', mate: 'ɑ',
      tip: '턱을 조금만 내리고 힘을 빼요 — 입술을 둥글리지 않고 짧게' },
  };
  OV.ORDER = ['æ', 'ɛ', 'ɑ', 'ʌ'];
  OV.isTarget = p => !!OV.V[p];
  OV.vName = v => (OV.V[v] || { ko: v }).ko;
  OV.vLabel = v => `${v} (${OV.vName(v)})`;

  /* ---------- 발음 사전 ----------
     낱말|철자(음절 . · 센 음절의 목표 모음 글자 [ ])|IPA(음절 . · 센 음절 ˈ)|한국어식(센 음절의 한글 [ ])|뜻|묶음(쉼표로 여럿)
     묶음: pf 애 · 에 짝 · pb 아 · 어 짝 · hvd 모음 지도 낱말(b_t) · tri 셋이 갈리는 줄 · loan 외래어 · sw 문장 속 낱말
     한국어식: 외래어는 흔히 쓰는 표기, 외래어가 아닌 낱말은 한국어식으로 읽은 소리 */
  const DICT_SRC = `bad|b[a]d|bæd|[배]드|나쁜|pf
bed|b[e]d|bɛd|[베]드|침대|pf
sad|s[a]d|sæd|[새]드|슬픈|pf
said|s[ai]d|sɛd|[세]드|말했다|pf
had|h[a]d|hæd|[해]드|가졌다 · 먹었다|pf,sw
head|h[ea]d|hɛd|[헤]드|머리|pf
bat|b[a]t|bæt|[뱃]|방망이 · 박쥐|pf,hvd,tri
bet|b[e]t|bɛt|[벳]|내기하다|pf,hvd,sw
dad|d[a]d|dæd|[대]드|아빠|pf,sw
dead|d[ea]d|dɛd|[데]드|죽은|pf
pat|p[a]t|pæt|[팻]|토닥이다|pf
pet|p[e]t|pɛt|[펫]|애완동물|pf,sw
gas|g[a]s|gæs|[개]스|기름 · 가스|pf,sw
guess|gu[e]ss|gɛs|[게]스|짐작하다|pf,sw
sat|s[a]t|sæt|[샛]|앉았다|pf
set|s[e]t|sɛt|[셋]|놓다|pf,sw
pack|p[a]ck|pæk|[팩]|싸다 · 꾸리다|pf,sw
peck|p[e]ck|pɛk|[펙]|쪼다|pf
cop|c[o]p|kɑp|[캅]|경찰|pb,tri
cup|c[u]p|kʌp|[컵]|컵 · 잔|pb,tri,sw
hot|h[o]t|hɑt|[핫]|뜨거운 · 더운|pb,tri,sw
hut|h[u]t|hʌt|[헛]|오두막|pb,tri
lock|l[o]ck|lɑk|[락]|자물쇠 · 잠그다|pb,tri,sw
luck|l[u]ck|lʌk|[럭]|운|pb,tri,sw
not|n[o]t|nɑt|[낫]|아니다|pb,sw
nut|n[u]t|nʌt|[넛]|견과|pb
cot|c[o]t|kɑt|[캇]|간이침대|pb,tri
cut|c[u]t|kʌt|[컷]|자르다|pb,tri,sw
dock|d[o]ck|dɑk|[닥]|부두|pb,sw
duck|d[u]ck|dʌk|[덕]|오리|pb,sw
shot|sh[o]t|ʃɑt|[샷]|쏘았다 · 한 잔|pb
shut|sh[u]t|ʃʌt|[셧]|닫다|pb,sw
collar|c[o]l.lar|ˈkɑ.lɚ|[칼]라|옷깃 · 목줄|pb,sw
color|c[o]l.or|ˈkʌ.lɚ|[컬]러|색|pb,sw
rob|r[o]b|rɑb|[랍]|훔치다|pb
rub|r[u]b|rʌb|[럽]|문지르다|pb
bot|b[o]t|bɑt|[밧]|봇 · 로봇 프로그램|pb,hvd,tri
but|b[u]t|bʌt|[벗]|그러나|pb,hvd,tri,sw
cat|c[a]t|kæt|[캣]|고양이|tri,sw
cap|c[a]p|kæp|[캡]|모자|tri
hat|h[a]t|hæt|[햇]|모자|tri,sw
lack|l[a]ck|læk|[랙]|모자라다|tri
apple|[a]p.ple|ˈæ.pəl|[애]플|사과|loan,sw
taxi|t[a]x.i|ˈtæk.si|[택]시|택시|loan,sw
camera|c[a].me.ra|ˈkæ.mə.rə|[카]메라|사진기|loan,sw
banana|ba.n[a].na|bə.ˈnæ.nə|바[나]나|바나나|loan,sw
menu|m[e]n.u|ˈmɛn.ju|[메]뉴|차림표|loan,sw
dress|dr[e]ss|drɛs|드[레]스|원피스 · 옷|loan,sw
lemon|l[e].mon|ˈlɛ.mən|[레]몬|레몬|loan,sw
ketchup|k[e]tch.up|ˈkɛtʃ.əp|[케]첩|케첩|loan
doctor|d[o]c.tor|ˈdɑk.tɚ|[닥]터|의사|loan,sw
box|b[o]x|bɑks|[박]스|상자|loan,sw
shopping|sh[o]p.ping|ˈʃɑ.pɪŋ|[쇼]핑|쇼핑 · 장보기|loan,sw
chocolate|ch[o]c.olate|ˈtʃɑk.lət|[초]콜릿|초콜릿|loan,sw
bus|b[u]s|bʌs|[버]스|버스|loan,sw
money|m[o].ney|ˈmʌ.ni|[머]니|돈|loan,sw
mother|m[o].ther|ˈmʌ.ðɚ|[마]더|어머니|loan,sw
oven|[o].ven|ˈʌ.vən|[오]븐|오븐|loan
headache|h[ea]d.ache|ˈhɛd.eɪk||두통|sw
can't|c[a]n't|kænt||~할 수 없다|sw
bag|b[a]g|bæg||가방|sw
get|g[e]t|gɛt||~하게 되다 · 얻다|sw
ready|r[ea].dy|ˈrɛ.di||준비된|sw
tank|t[a]nk|tæŋk||통 · 탱크|sw
empty|[e]mp.ty|ˈɛmp.ti||빈|sw
on|[o]n|ɑn||~ 위에|sw
what|wh[a]t|wʌt||무엇|sw
come|c[o]me|kʌm||오다|sw
fun|f[u]n|fʌn||재미|sw
check|ch[e]ck|tʃɛk||확인하다|sw
went|w[e]nt|wɛnt||갔다|sw
has|h[a]s|hæz||가지고 있다|sw
bread|br[ea]d|brɛd||빵|sw
that|th[a]t|ðæt||저 · 그|sw
fat|f[a]t|fæt||뚱뚱한|sw
shop|sh[o]p|ʃɑp||가게|sw
stop|st[o]p|stɑp||멈추다|sw
map|m[a]p|mæp||지도|sw
sun|s[u]n|sʌn||해|sw
red|r[e]d|rɛd||빨간|sw
son|s[o]n|sʌn||아들|sw
got|g[o]t|gɑt||얻었다|sw
black|bl[a]ck|blæk||검은|sw
Mom|M[o]m|mɑm||엄마|sw
sent|s[e]nt|sɛnt||보냈다|sw
lot|l[o]t|lɑt||많음|sw
love|l[o]ve|lʌv||사랑|sw`;

  const DICT = {}, LOWER = {};
  DICT_SRC.split('\n').forEach(line => {
    const [key, spell, ipa, ko, gloss, grp] = line.trim().split('|');
    const sp = spell.split('.'), ip = ipa.split('.');
    const ph = phones(ipa);
    const syl = ip.map((s, i) => ({ sp: (sp[i] || '').replace(/[[\]]/g, ''), raw: sp[i] || '', ipa: s.replace(/[ˈˌ]/g, ''), st: s[0] === 'ˈ' ? 1 : s[0] === 'ˌ' ? 2 : 0 }));
    if (syl.length === 1) syl[0].st = 1;
    DICT[key] = { key, w: key, raw: spell.replace(/\./g, ''), spell: sp.map(s => s.replace(/[[\]]/g, '')), ipa, ph,
      koRaw: ko || '', ko: (ko || '').replace(/[[\]]/g, ''), gloss, grp: grp.split(','), syl };
    LOWER[key.toLowerCase()] = key;
  });
  OV.DICT = DICT;
  const entry = k => DICT[k] || DICT[LOWER[String(k).toLowerCase().replace('’', "'")]] || null;
  OV.entry = entry;
  OV.word = k => (entry(k) || { w: k }).w;
  OV.ipa = k => { const e = entry(k); return e ? '/' + e.ipa.replace(/\./g, '') + '/' : ''; };
  OV.inGrp = (k, g) => { const e = entry(k); return !!e && e.grp.indexOf(g) >= 0; };
  OV.byGrp = g => Object.values(DICT).filter(e => e.grp.indexOf(g) >= 0).map(e => e.key);

  /* ---------- 센 음절의 모음 · 그 뒤 ---------- */
  OV.nSyl = k => { const e = entry(k); return e ? e.ph.filter(isV).length : 0; };
  OV.syls = k => (entry(k) || { syl: [] }).syl;
  OV.stressAt = k => Math.max(0, OV.syls(k).findIndex(s => s.st === 1));
  OV.vIndex = k => {
    const e = entry(k); if (!e) return -1;
    let n = -1;
    const at = OV.stressAt(k);
    for (let i = 0; i < e.ph.length; i++) if (isV(e.ph[i]) && ++n === at) return i;
    return -1;
  };
  OV.vowel = k => { const e = entry(k), i = OV.vIndex(k); return e && i >= 0 ? e.ph[i] : ''; };
  OV.side = k => { const v = OV.V[OV.vowel(k)]; return v ? (v.front ? 'front' : 'back') : ''; };
  OV.isOpen = k => { const v = OV.V[OV.vowel(k)]; return !!(v && v.open); };
  OV.after = k => { const e = entry(k), i = OV.vIndex(k); return e && i >= 0 ? (e.ph[i + 1] || '') : ''; };
  // 콧소리(m · n · ŋ) 앞의 애는 미국 영어에서 높아지기 쉬워요(man · can't) — 짝 · 지도 낱말에는 쓰지 않아요
  OV.beforeNasal = k => NASAL.indexOf(OV.after(k)) >= 0;

  /* ---------- 짝: a = 크게 벌린(æ · ɑ) · b = 덜 벌린(ɛ · ʌ) ---------- */
  const PAIR_SRC = [
    ['bad', 'bed'], ['sad', 'said'], ['had', 'head'], ['bat', 'bet'], ['dad', 'dead'], ['pat', 'pet'],
    ['gas', 'guess'], ['sat', 'set'], ['pack', 'peck'],
    ['cop', 'cup'], ['hot', 'hut'], ['lock', 'luck'], ['not', 'nut'], ['cot', 'cut'], ['dock', 'duck'],
    ['shot', 'shut'], ['collar', 'color'], ['rob', 'rub'], ['bot', 'but'],
  ];
  OV.PAIRS = PAIR_SRC.map(([a, b]) => ({ id: (a + '-' + b).toLowerCase(), a, b, side: OV.side(a) }));
  OV.pairOf = k => { const e = entry(k); return e ? OV.PAIRS.find(p => p.a === e.key || p.b === e.key) || null : null; };
  OV.partner = k => { const p = OV.pairOf(k), e = entry(k); return p ? (p.a === e.key ? p.b : p.a) : null; };
  OV.pairsOf = side => OV.PAIRS.filter(p => p.side === side);
  // 두 낱말의 소리가 센 음절의 모음 하나(æ ↔ ɛ 또는 ɑ ↔ ʌ)만 다른가
  OV.pairDiff = (a, b) => {
    const A = entry(a), B = entry(b);
    if (!A || !B || A.ph.length !== B.ph.length) return null;
    const d = A.ph.map((p, i) => p === B.ph[i] ? -1 : i).filter(i => i >= 0);
    if (d.length !== 1) return null;
    const x = A.ph[d[0]], y = B.ph[d[0]];
    return OV.V[x] && OV.V[x].mate === y ? { at: d[0], a: x, b: y } : null;
  };

  /* ---------- 셋이 갈리는 줄: 크게 벌린 애 · 덜 벌린 어 · 크게 벌린 아 ---------- */
  OV.TRI = [['cat', 'cut', 'cot'], ['hat', 'hut', 'hot'], ['cap', 'cup', 'cop'], ['lack', 'luck', 'lock'], ['bat', 'but', 'bot']];
  OV.TRI_V = ['æ', 'ʌ', 'ɑ'];

  /* ---------- 한국어식 표기: 센 음절의 한글 모음 ----------
     한글 모음 번호: ㅏ 0 · ㅐ 1 · ㅓ 4 · ㅔ 5 · ㅗ 8 · ㅘ 9 · ㅛ 12 · ㅝ 14 */
  function hangul(ko) {
    return [...String(ko)].filter(c => /[가-힣]/.test(c)).map(ch => {
      const c = ch.charCodeAt(0) - 0xAC00;
      return { ch, on: Math.floor(c / 588), v: Math.floor((c % 588) / 28), coda: c % 28 };
    });
  }
  OV.hangul = hangul;
  const JAMO = { 0: 'ㅏ', 1: 'ㅐ', 4: 'ㅓ', 5: 'ㅔ', 8: 'ㅗ', 9: 'ㅘ', 12: 'ㅛ', 14: 'ㅝ' };
  // 갈래: 애(ㅐ) · 에(ㅔ) · 아(ㅏ · ㅘ) · 어(ㅓ · ㅝ) · 오(ㅗ · ㅛ)
  const KO_FAM = { 1: '애', 3: '애', 5: '에', 7: '에', 0: '아', 2: '아', 9: '아', 4: '어', 6: '어', 14: '어', 8: '오', 12: '오' };   // 중성 번호: ㅏ0 ㅐ1 ㅑ2 ㅒ3 ㅓ4 ㅔ5 ㅕ6 ㅖ7 ㅗ8 ㅘ9 ㅛ12 ㅝ14
  const KO_EXPECT = { 'æ': '애', 'ɛ': '에', 'ɑ': '아', 'ʌ': '어' };
  OV.koSyl = k => { const e = entry(k); if (!e || !e.koRaw) return null; const m = e.koRaw.match(/\[([가-힣])\]/); return m ? hangul(m[1])[0] : null; };
  OV.koJamo = k => { const h = OV.koSyl(k); return h ? (JAMO[h.v] || '') : ''; };
  OV.koFam = k => { const h = OV.koSyl(k); return h ? (KO_FAM[h.v] || '') : ''; };
  // 외래어 표기의 함정: '' = 영어 모음과 맞는 한글 · 'a' = 아로 적음 · 'o' = 오로 적음 · 'eo' = 어로 적음 …
  OV.koTrap = k => { const f = OV.koFam(k), x = KO_EXPECT[OV.vowel(k)]; return !f || f === x ? '' : f; };
  // 한국어식으로 읽으면 두 낱말의 소리가 같아지나 — ㅐ · ㅔ는 요즘 한국어에서 한 소리
  const merge = s => [...String(s)].map(ch => {
    const h = hangul(ch)[0]; if (!h || h.v !== 1) return ch;
    return String.fromCharCode(0xAC00 + h.on * 588 + 5 * 28 + h.coda);
  }).join('');
  OV.koSameSound = (a, b) => { const A = entry(a), B = entry(b); return !!(A && B && A.ko && merge(A.ko) === merge(B.ko)); };
  OV.koSameSpell = (a, b) => { const A = entry(a), B = entry(b); return !!(A && B && A.ko && A.ko === B.ko); };

  /* ---------- 철자 칠하기: [ ] 안의 글자 = 센 음절의 목표 모음 ----------
     spellSegs(k) → [{ t, role: 'a'(크게) | 'b'(덜) | null, i: 음절 }] */
  OV.spellSegs = k => {
    const e = entry(k), out = [];
    if (!e) return [{ t: String(k), role: null }];
    const role = (OV.V[OV.vowel(k)] || {}).role || null;
    e.syl.forEach((s, i) => {
      String(s.raw).split(/(\[[^\]]*\])/).forEach(t => {
        if (!t) return;
        if (t[0] === '[') out.push({ t: t.slice(1, -1), role, i });
        else out.push({ t, role: null, i });
      });
    });
    return out;
  };
  // 한국어식 표기 칠하기: [ ] 안의 한글 = 센 음절, trap이면 함정
  OV.koSegs = k => {
    const e = entry(k); if (!e || !e.koRaw) return [];
    const trap = !!OV.koTrap(k);
    return e.koRaw.split(/(\[[^\]]*\])/).filter(Boolean).map(t => t[0] === '[' ? { t: t.slice(1, -1), on: true, trap } : { t, on: false, trap: false });
  };

  /* ---------- 모음 지도의 그림 자리(잰 값이 없을 때 · 한국어 모음은 늘 그림) ----------
     x: 0 = 앞(F2 높음) → 1 = 뒤 · y: 0 = 혀가 높음(F1 낮음) → 1 = 낮음(입을 크게 벌림). 단순하게 그린 자리예요(잰 값이 아님). */
  OV.SCHEM = { 'ɛ': { x: 0.2, y: 0.42 }, 'æ': { x: 0.3, y: 0.82 }, 'ʌ': { x: 0.56, y: 0.56 }, 'ɑ': { x: 0.78, y: 0.86 } };
  OV.KO_SCHEM = { '에': { x: 0.2, y: 0.36 }, '아': { x: 0.52, y: 0.8 }, '어': { x: 0.76, y: 0.46 } };

  /* ---------- 목소리 넷 (듣고 가르기 · 연습 문제) ---------- */
  OV.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '미국 여성' },
    { sp: 'tf', ko: '차분한 선생님', who: '미국 여성' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];

  /* ---------- 외래어 카드 열여섯: 한글 표기의 모음은 영어 모음을 따르지 않을 때가 많아요 ---------- */
  const LOAN_ROWS = [
    ['æ', '크게 벌린 æ', ['apple', 'taxi', 'camera', 'banana']],
    ['ɛ', '덜 벌린 ɛ', ['menu', 'dress', 'lemon', 'ketchup']],
    ['ɑ', '크게 벌린 ɑ', ['doctor', 'box', 'shopping', 'chocolate']],
    ['ʌ', '덜 벌린 ʌ', ['bus', 'money', 'mother', 'oven']],
  ];
  OV.LROWS = LOAN_ROWS.map(([v, ko, words]) => ({ id: v, v, ko, words }));
  OV.LOAN = [];
  OV.LROWS.forEach(r => r.words.forEach(w => OV.LOAN.push({ w, row: r.v })));
  OV.TRAP_KO = { '아': '아로 적어요', '오': '오로 적어요', '어': '어로 적어요', '애': '애로 적어요', '에': '에로 적어요' };

  /* ---------- 문장 속에서: 사전에 있는 낱말의 [ ] 글자 ----------
     segs(text) → [{ t, role: 'a' | 'b' | null, w, v }] */
  OV.segs = function (text) {
    const out = [];
    String(text).split(/([A-Za-z]+(?:['’][A-Za-z]+)?)/).forEach(tok => {
      if (!tok) return;
      if (!/[A-Za-z]/.test(tok)) { out.push({ t: tok, role: null }); return; }
      const e = entry(tok);
      if (!e || e.raw.replace(/[[\]]/g, '').toLowerCase() !== tok.toLowerCase().replace('’', "'")) { out.push({ t: tok, role: null }); return; }
      let at = 0;
      const v = OV.vowel(e.key);
      OV.spellSegs(e.key).forEach(p => {
        const t = tok.slice(at, at + p.t.length); at += p.t.length;
        out.push({ t, role: p.role, w: e.key, v: p.role ? v : '' });
      });
    });
    return out;
  };
  OV.wordsIn = text => { const seen = []; OV.segs(text).forEach(s => { if (s.w && seen.indexOf(s.w) < 0) seen.push(s.w); }); return seen; };
  OV.countIn = text => { const n = { 'æ': 0, 'ɛ': 0, 'ɑ': 0, 'ʌ': 0 }; OV.segs(text).forEach(s => { if (s.role) n[s.v]++; }); return n; };

  /* ---------- 따라 말하기 28문장 (묶음마다 일곱) ---------- */
  OV.SGRP = {
    front: { ko: 'æ · ɛ', long: 'æ · ɛ — 크게 벌린 애는 턱을 내리고, 덜 벌린 에는 조금만' },
    back: { ko: 'ɑ · ʌ', long: 'ɑ · ʌ — 크게 벌린 아는 목 안까지, 덜 벌린 어는 힘을 빼고 짧게' },
    loan: { ko: '외래어', long: '외래어 — 한글의 애 · 아 · 오 · 어는 영어 모음과 어긋날 때가 많아요' },
    mix: { ko: '섞어서', long: '섞어서 — 한 문장 속 네 모음' },
  };
  OV.SGRP_ORDER = ['front', 'back', 'loan', 'mix'];
  OV.SENT = [
    { grp: 'front', en: 'I had a bad headache.', ko: '머리가 많이 아팠어요.' },
    { grp: 'front', en: 'Dad said he was sad.', ko: '아빠가 슬프다고 했어요.' },
    { grp: 'front', en: 'Is your pet a cat?', ko: '네 애완동물은 고양이야?' },
    { grp: 'front', en: "I bet you can't guess.", ko: '못 맞힐걸.' },
    { grp: 'front', en: 'Set the bag on the bed.', ko: '가방을 침대 위에 놓아요.' },
    { grp: 'front', en: 'Pack your bag and get ready.', ko: '가방 싸고 준비해요.' },
    { grp: 'front', en: 'The gas tank is empty.', ko: '기름통이 비었어요.' },
    { grp: 'back', en: 'The cup is hot.', ko: '컵이 뜨거워요.' },
    { grp: 'back', en: 'Good luck with the lock.', ko: '그 자물쇠, 잘 열리길 바라요.' },
    { grp: 'back', en: 'Shut the box.', ko: '상자를 닫아요.' },
    { grp: 'back', en: 'The duck is on the dock.', ko: '오리가 부두에 있어요.' },
    { grp: 'back', en: 'My mother is a doctor.', ko: '우리 어머니는 의사예요.' },
    { grp: 'back', en: 'What color is the collar?', ko: '그 목줄은 무슨 색이에요?' },
    { grp: 'back', en: "Come on, it's not fun.", ko: '에이, 재미없어.' },
    { grp: 'loan', en: "I'd like an apple and a banana.", ko: '사과 하나랑 바나나 하나 주세요.' },
    { grp: 'loan', en: 'Take a taxi to the doctor.', ko: '택시를 타고 병원에 가요.' },
    { grp: 'loan', en: 'My camera is on the bus.', ko: '내 사진기가 버스에 있어요.' },
    { grp: 'loan', en: 'Check the menu for chocolate.', ko: '차림표에 초콜릿이 있나 봐요.' },
    { grp: 'loan', en: 'The doctor gave me a lemon.', ko: '의사가 레몬을 하나 줬어요.' },
    { grp: 'loan', en: 'We went shopping for a dress.', ko: '원피스를 사러 쇼핑을 갔어요.' },
    { grp: 'loan', en: 'My mother has money for the bus.', ko: '어머니께 버스비가 있어요.' },
    { grp: 'mix', en: 'Dad cut the hot bread.', ko: '아빠가 따뜻한 빵을 잘랐어요.' },
    { grp: 'mix', en: 'That fat cat is not much fun.', ko: '저 뚱뚱한 고양이는 별로 재미없어요.' },
    { grp: 'mix', en: 'Get the cup from the shop.', ko: '가게에서 컵을 가져와요.' },
    { grp: 'mix', en: 'Stop and check the map.', ko: '멈춰서 지도를 확인해요.' },
    { grp: 'mix', en: 'The sun is hot and red.', ko: '해가 뜨겁고 빨개요.' },
    { grp: 'mix', en: 'My son got a black hat.', ko: '아들이 검은 모자를 받았어요.' },
    { grp: 'mix', en: 'Mom sent a lot of love.', ko: '엄마가 사랑을 듬뿍 보냈어요.' },
  ];

  /* ---------- 음성 인식: 들은 말이 목표 낱말인가, 짝 낱말인가 ---------- */
  const SAME = { bot: ['bot', 'bought'], cot: ['cot', 'caught'], collar: ['collar', 'caller'] };
  const words = s => String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const has = (text, w) => {
    const ws = words(text), t = OV.word(w).toLowerCase(), j = ws.join(' ');
    return ws.indexOf(t) >= 0 || (SAME[t] || []).some(x => x.indexOf(' ') > 0 ? (' ' + j + ' ').indexOf(' ' + x + ' ') >= 0 : ws.indexOf(x) >= 0);
  };
  OV.heard = function (target, alts) {
    const partner = OV.partner(target);
    alts = (alts || []).filter(Boolean);
    if (!alts.length) return { verdict: 'none', heard: '' };
    const top = alts[0];
    if (has(top, target)) return { verdict: 'target', heard: top, partner };
    if (partner && has(top, partner)) return { verdict: 'partner', heard: top, partner };
    const k = alts.findIndex(a => has(a, target));
    if (k > 0) return { verdict: 'maybe', heard: top, rank: k + 1, partner };
    return { verdict: 'other', heard: top, partner };
  };
  OV.HEARD_KO = {
    target: '목표 낱말로 들었어요',
    partner: '짝 낱말로 들었어요',
    maybe: '첫째 후보는 아니지만 후보에 있었어요',
    other: '다른 낱말로 들었어요',
    none: '아무 말도 듣지 못했어요',
  };
  // 내 발음 확인에 쓰는 짝(흔한 낱말 — 음성 인식은 흔한 낱말 쪽으로 기울어요)
  OV.MP_PAIRS = ['bad-bed', 'sad-said', 'had-head', 'pat-pet', 'sat-set', 'cop-cup', 'hot-hut', 'lock-luck', 'not-nut', 'shot-shut', 'collar-color']
    .map(id => OV.PAIRS.find(p => p.id === id));

  /* ---------- 따라 말하기: 낱말 맞추기 ---------- */
  const norm = w => w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '');
  OV.compareWords = function (target, heard) {
    const T = String(target).split(/\s+/).filter(Boolean).map(w => ({ w, n: norm(w) }));
    const Hs = words(heard).map(norm);
    const used = Hs.map(() => false);
    let hit = 0;
    const marks = T.map(t => {
      if (!t.n) return { w: t.w, ok: true };
      const k = Hs.findIndex((h, i) => !used[i] && h === t.n);
      if (k >= 0) { used[k] = true; hit++; return { w: t.w, ok: true }; }
      return { w: t.w, ok: false };
    });
    const total = T.filter(t => t.n).length;
    return { marks, hit, total, ratio: total ? hit / total : 0 };
  };

  /* ---------- 연습 문제: 듣고 고르기 16 ----------
     kind: word(어느 낱말?) · sent(문장 속 어느 낱말?) · same(두 낱말이 같았나?) · vowel(외래어 센 음절의 모음은?)
     a: 정답 보기 번호(0부터) — 엔진이 다시 계산해 맞춰 봐요 */
  OV.DRILL = [
    { kind: 'word', sp: 'um', say: 'bed', opts: ['bad', 'bed'], a: 1 },
    { kind: 'word', sp: 'uf', say: 'cop', opts: ['cop', 'cup'], a: 0 },
    { kind: 'sent', sp: 'tf', say: 'Is that your pet?', frame: 'Is that your ___?', opts: ['pat', 'pet'], a: 1, ko: '그거 네 애완동물이야?' },
    { kind: 'same', sp: 'tc', say: ['hot', 'hut'], opts: ['같아요', '달라요'], a: 1 },
    { kind: 'word', sp: 'tf', say: 'luck', opts: ['lock', 'luck'], a: 1 },
    { kind: 'vowel', sp: 'tc', say: 'camera', a: 0 },
    { kind: 'word', sp: 'um', say: 'sad', opts: ['sad', 'said'], a: 0 },
    { kind: 'sent', sp: 'uf', say: 'I saw a duck.', frame: 'I saw a ___.', opts: ['dock', 'duck'], a: 1, ko: '오리를 봤어요.' },
    { kind: 'word', sp: 'um', say: 'dad', opts: ['dad', 'dead'], a: 0 },
    { kind: 'same', sp: 'uf', say: ['bet', 'bet'], opts: ['같아요', '달라요'], a: 0 },
    { kind: 'word', sp: 'tf', say: 'shut', opts: ['shot', 'shut'], a: 1 },
    { kind: 'sent', sp: 'um', say: 'I had a bad day.', frame: 'I had a ___ day.', opts: ['bad', 'bed'], a: 0, ko: '힘든 하루였어요.' },
    { kind: 'word', sp: 'tc', say: 'collar', opts: ['collar', 'color'], a: 0 },
    { kind: 'vowel', sp: 'tf', say: 'oven', a: 1 },
    { kind: 'word', sp: 'uf', say: 'guess', opts: ['gas', 'guess'], a: 1 },
    { kind: 'sent', sp: 'tc', say: 'It was hot.', frame: 'It was ___.', opts: ['hot', 'hut'], a: 0, ko: '더웠어요.' },
  ];
  OV.vOpts = k => OV.side(k) === 'back' ? ['ɑ', 'ʌ'] : ['æ', 'ɛ'];
  OV.DRILL.forEach(q => { if (q.kind === 'vowel') { q.vopts = OV.vOpts(q.say); q.opts = q.vopts.map(OV.vLabel); } });
  OV.drillWord = q => q.kind === 'same' ? q.say[0] : q.kind === 'sent' ? q.opts[q.a] : q.say;
  OV.drillWords = q => q.kind === 'same' ? q.say.slice() : q.kind === 'vowel' ? [q.say] : q.opts.slice();
  // 힌트 = 3단계 발음법
  OV.hints = function (q) {
    if (q.kind === 'vowel') {
      const e = entry(q.say), side = OV.side(q.say), [A, B] = OV.vOpts(q.say).map(v => OV.V[v]);
      return [
        { head: '① 듣고 가르기', text: `센 음절(${OV.syls(q.say)[OV.stressAt(q.say)].sp})의 모음을 들어요. 턱이 크게 내려간 소리인가요, 조금만 벌린 소리인가요?` },
        { head: '② 입 모양 만들기', text: `${A.ko}: ${A.tip} · ${B.ko}: ${B.tip}.` },
        { head: '③ 낱말 속에서', text: `한글 표기(${e.ko})의 ${OV.koFam(q.say) || (side === 'front' ? '애' : '어')}는 영어 모음을 따르지 않을 때가 많아요. 사전의 IPA를 확인해요 → ${OV.ipa(q.say)}.` },
      ];
    }
    const [x] = q.kind === 'same' ? [q.say[0]] : q.opts;
    const pa = OV.pairOf(x), side = OV.side(x);
    const A = OV.V[side === 'front' ? 'æ' : 'ɑ'], B = OV.V[side === 'front' ? 'ɛ' : 'ʌ'];
    const [aw, bw] = pa ? [pa.a, pa.b] : q.opts;
    const ko3 = side === 'front'
      ? `한국어식으로는 ${entry(aw).ko} · ${entry(bw).ko} → 요즘 한국어의 애 · 에는 한 소리라 귀로는 갈리지 않아요.`
      : `한국어식으로는 ${entry(aw).ko} · ${entry(bw).ko} → 아 · 어로 가를 수 있지만, 영어의 덜 벌린 어는 한국어 어보다 입을 조금 더 벌리고 힘을 빼요.`;
    return [
      { head: '① 듣고 가르기', text: q.kind === 'same' ? '두 낱말의 모음만 견줘요. 둘 다 턱이 같은 만큼 내려갔나요?' : `턱이 얼마나 내려갔는지 들어요 — 크게 벌려 낮고 넓으면 ${A.v}, 조금만 벌리면 ${B.v}.` },
      { head: '② 입 모양 만들기', text: `${aw} → ${A.tip} · ${bw} → ${B.tip}.` },
      { head: '③ 낱말 속에서', text: (q.kind === 'sent' ? '문장 속에서도 모음 하나로 뜻이 갈려요. ' : '') + ko3 },
    ];
  };

  /* ---------- 캔버스 글자 모음 (글꼴 미리 받기) ---------- */
  OV.allText = () => Object.values(DICT).map(e => e.w + e.raw + e.ipa + e.ko + e.gloss).join('') +
    OV.SENT.map(s => s.en + s.ko).join('') + Object.values(OV.SGRP).map(g => g.ko + g.long).join('') +
    OV.LROWS.map(r => r.ko).join('') + Object.values(OV.V).map(v => v.ko + v.tip + v.kr).join('') +
    OV.VOICES.map(v => v.ko + v.who).join('') + OV.DRILL.map(q => (q.frame || '') + (q.ko || '')).join('') +
    Object.values(OV.TRAP_KO).join('') + '애에아어오ㅐㅔㅏㅓㅗㅛㅘㅝ';

  /* ---------- 데이터 점검 ---------- */
  OV.check = function () {
    const warn = [];
    const w = m => warn.push(m);
    Object.values(DICT).forEach(e => {
      if (e.spell.length !== e.syl.length) w(`${e.key}: 철자 음절 ${e.spell.length}개 ≠ IPA 음절 ${e.syl.length}개`);
      if (e.spell.join('').toLowerCase() !== e.w.toLowerCase()) w(`${e.key}: 철자를 이으면 ${e.spell.join('')}`);
      if (e.syl.filter(s => s.st === 1).length !== 1) w(`${e.key}: 센 음절이 하나가 아님`);
      e.syl.forEach((s, i) => { const n = phones(s.ipa).filter(isV).length; if (n !== 1) w(`${e.key}: ${i + 1}째 음절의 모음이 ${n}개`); });
      const v = OV.vowel(e.key);
      if (!OV.isTarget(v)) w(`${e.key}: 센 음절의 모음 ${v}가 æ · ɛ · ʌ · ɑ가 아님`);
      const marks = e.syl.map(s => (s.raw.match(/\[[^\]]*\]/g) || []).length);
      if (marks.reduce((a, b) => a + b, 0) !== 1 || marks[OV.stressAt(e.key)] !== 1) w(`${e.key}: [ ]가 센 음절에 하나가 아님`);
      OV.spellSegs(e.key).filter(s => s.role).forEach(s => { if (!/^[aeiouy]+$/i.test(s.t)) w(`${e.key}: [${s.t}] 안에 모음 글자가 아닌 것`); });
      if (e.grp.indexOf('sw') < 0 || e.grp.length > 1) {
        if (!e.koRaw) w(`${e.key}: 한국어식 표기 없음`);
        else if ((e.koRaw.match(/\[[가-힣]\]/g) || []).length !== 1) w(`${e.key}: 한국어식의 [ ]가 한 글자에 하나가 아님`);
        else if (!OV.koFam(e.key)) w(`${e.key}: 한국어식 [${OV.koSyl(e.key).ch}]의 모음이 애 · 에 · 아 · 어 · 오가 아님`);
      }
      // 외래어가 아닌 낱말의 한국어식은 함정 없이(애 · 에 · 아 · 어 그대로)
      if (e.koRaw && e.grp.indexOf('loan') < 0 && OV.koTrap(e.key)) w(`${e.key}: 한국어식 ${e.ko}의 모음이 ${OV.vowel(e.key)}와 맞지 않음`);
    });
    // 짝: 센 음절의 모음 하나만 다르고(a 크게 · b 덜), 콧소리 앞이 아니고, 앞 짝은 한국어식으로 소리가 같아짐
    const seen = {};
    OV.PAIRS.forEach(p => {
      if (!entry(p.a) || !entry(p.b)) { w(`짝 ${p.id}: 사전에 없음`); return; }
      const d = OV.pairDiff(p.a, p.b);
      if (!d) w(`짝 ${p.id}: 모음 하나(æ ↔ ɛ · ɑ ↔ ʌ)만 다른 짝이 아님`);
      else if (!OV.V[d.a].open || d.at !== OV.vIndex(p.a)) w(`짝 ${p.id}: a가 크게 벌린 모음이 아니거나 센 음절이 아님`);
      if (OV.beforeNasal(p.a)) w(`짝 ${p.id}: 콧소리 앞의 모음(재기 어려움)`);
      if (p.side === 'front' && !OV.koSameSound(p.a, p.b)) w(`짝 ${p.id}: 한국어식 소리가 같아지지 않음`);
      if (p.side === 'back' && OV.koSameSpell(p.a, p.b)) w(`짝 ${p.id}: 한국어식 표기가 같음(아 · 어로 갈려야 함)`);
      if (!OV.inGrp(p.a, p.side === 'front' ? 'pf' : 'pb') || !OV.inGrp(p.b, p.side === 'front' ? 'pf' : 'pb')) w(`짝 ${p.id}: 묶음 pf · pb`);
      [p.a, p.b].forEach(k => { if (seen[k]) w(`${k}: 짝 둘에 들어 있음`); seen[k] = 1; });
    });
    ['pf', 'pb'].forEach(g => OV.byGrp(g).forEach(k => { if (!OV.pairOf(k)) w(`${k}: 묶음 ${g}인데 짝이 없음`); }));
    const hvd = OV.byGrp('hvd');
    if (hvd.map(OV.vowel).sort().join('') !== OV.ORDER.slice().sort().join('')) w('모음 지도 낱말: 네 모음이 하나씩이 아님');
    hvd.forEach(k => { const e = entry(k); if (e.ph[0] !== 'b' || e.ph[e.ph.length - 1] !== 't' || e.ph.length !== 3) w(`${k}: b + 모음 + t가 아님`); });
    // 셋이 갈리는 줄: 첫 · 끝 자음이 같고 모음이 æ · ʌ · ɑ
    OV.TRI.forEach(t => {
      if (t.some(k => !entry(k))) { w(`줄 ${t.join(' · ')}: 사전에 없음`); return; }
      if (t.map(OV.vowel).join() !== OV.TRI_V.join()) w(`줄 ${t.join(' · ')}: 모음이 æ · ʌ · ɑ가 아님`);
      const sk = k => entry(k).ph.filter(p => !isV(p)).join('');
      if (new Set(t.map(sk)).size !== 1) w(`줄 ${t.join(' · ')}: 자음이 같지 않음`);
      t.forEach(k => { if (!OV.inGrp(k, 'tri')) w(`${k}: 묶음 tri가 아님`); });
    });
    // 외래어 줄: 줄의 모음 = 엔진이 계산한 센 음절의 모음, 줄마다 함정이 하나 이상(애 · 에 줄은 에 줄만 빼고)
    OV.LOAN.forEach(o => {
      if (!entry(o.w)) { w(`외래어 ${o.w}: 사전에 없음`); return; }
      if (OV.vowel(o.w) !== o.row) w(`외래어 ${o.w}: 줄 ${o.row} ≠ 엔진 ${OV.vowel(o.w)}`);
      if (!OV.inGrp(o.w, 'loan')) w(`외래어 ${o.w}: 묶음 loan이 아님`);
    });
    OV.LROWS.forEach(r => { const n = r.words.filter(k => OV.koTrap(k)).length; if (r.v !== 'ɛ' && !n) w(`외래어 줄 ${r.v}: 함정(표기와 다른 모음)이 없음`); });
    // 문장: 칠할 낱말이 둘 이상, 묶음마다 일곱, 짝 묶음 문장에는 두 모음이 함께
    OV.SENT.forEach((s, i) => {
      const n = OV.countIn(s.en);
      if (OV.wordsIn(s.en).length < 2) w(`문장 ${i + 1}: 칠할 낱말이 둘보다 적음`);
      if (s.grp === 'front' && !(n['æ'] && n['ɛ'])) w(`문장 ${i + 1}: æ · ɛ가 함께 있지 않음`);
      if (s.grp === 'back' && !(n['ɑ'] && n['ʌ'])) w(`문장 ${i + 1}: ɑ · ʌ가 함께 있지 않음`);
      if (s.grp === 'loan' && !OV.wordsIn(s.en).some(k => OV.inGrp(k, 'loan'))) w(`문장 ${i + 1}: 외래어가 없음`);
      if (s.grp === 'mix' && Object.values(n).filter(Boolean).length < 3) w(`문장 ${i + 1}: 모음이 셋 넘게 섞이지 않음`);
    });
    const grp = {}; OV.SENT.forEach(s => { grp[s.grp] = (grp[s.grp] || 0) + 1; });
    OV.SGRP_ORDER.forEach(g => { if (grp[g] !== 7) w(`문장 묶음 ${g}: ${grp[g] || 0}개`); });
    // 연습 문제: 엔진의 정답과 같은지, 정답 위치, 목소리
    const pos = [0, 0], vc = {};
    OV.DRILL.forEach((q, k) => {
      pos[q.a]++; vc[q.sp] = (vc[q.sp] || 0) + 1;
      if (q.kind === 'word' || q.kind === 'sent') {
        if (OV.partner(q.opts[0]) !== q.opts[1]) w(`연습 ${k + 1}: 보기가 짝이 아님`);
        const p = OV.pairOf(q.opts[0]);
        if (p && (q.opts[0] !== p.a)) w(`연습 ${k + 1}: 보기 차례(크게 → 덜)`);
      }
      if (q.kind === 'word' && q.opts[q.a] !== q.say) w(`연습 ${k + 1}: 정답 ≠ 들려주는 낱말`);
      if (q.kind === 'sent') {
        if (q.frame.replace('___', q.opts[q.a]) !== q.say) w(`연습 ${k + 1}: 문장과 정답이 맞지 않음`);
        if (!OV.wordsIn(q.say).length) w(`연습 ${k + 1}: 칠할 낱말이 없음`);
      }
      if (q.kind === 'same') {
        const same = q.say[0] === q.say[1];
        if (!same && OV.partner(q.say[0]) !== q.say[1]) w(`연습 ${k + 1}: 두 낱말이 짝이 아님`);
        if ((same ? 0 : 1) !== q.a) w(`연습 ${k + 1}: 같아요 · 달라요 정답`);
      }
      if (q.kind === 'vowel') {
        if (!entry(q.say)) w(`연습 ${k + 1}: ${q.say} 사전에 없음`);
        else if (q.vopts[q.a] !== OV.vowel(q.say)) w(`연습 ${k + 1}: 모음 ${q.vopts[q.a]} ≠ 엔진 ${OV.vowel(q.say)}`);
        if (!OV.koTrap(q.say)) w(`연습 ${k + 1}: 한글 표기가 함정이 아닌 외래어`);
      }
      if (['tc', 'tf', 'uf', 'um'].indexOf(q.sp) < 0) w(`연습 ${k + 1}: 목소리 ${q.sp}`);
    });
    if (Math.abs(pos[0] - pos[1]) > 1) w(`정답 위치가 한쪽으로 몰림: ${pos.join(' / ')}`);
    if (Object.values(vc).some(n => n !== 4)) w(`연습 문제의 목소리가 고르지 않음: ${JSON.stringify(vc)}`);
    OV.MP_PAIRS.forEach((p, i) => { if (!p) w(`내 발음 확인 짝 ${i + 1}: 짝 목록에 없음`); });
    // 입 그림: 네 모음 모두 혀가 닿지 않고, 크게 벌린 쪽이 턱이 더 내려가고 혀가 더 낮아요, 넷 다 입술을 둥글리지 않아요
    if (window.EN && EN.mouth && EN.mouth.POSES.eh && EN.mouth.POSES.wedge) {
      const P = EN.mouth.POSES, C = EN.mouth.contact;
      ['ae', 'eh', 'a', 'wedge'].forEach(k => { if (C(k).touch) w(`입 그림 ${k}: 혀가 입천장에 닿음`); });
      const hi = (p, keys) => Math.min(...keys.map(k => P[p][k][1]));
      if (!(hi('eh', ['F', 'D']) < hi('ae', ['F', 'D']))) w('입 그림: ɛ의 혀 앞이 æ보다 높지 않음');
      if (!(hi('wedge', ['D', 'K']) < hi('a', ['D', 'K']))) w('입 그림: ʌ의 혀 뒤가 ɑ보다 높지 않음');
      if (!(P.ae.jaw > P.eh.jaw && P.a.jaw > P.wedge.jaw)) w('입 그림: 크게 벌린 모음의 턱이 더 내려가지 않음');
      if (['ae', 'eh', 'a', 'wedge'].some(k => (P[k].round || 0) > 0.1)) w('입 그림: 입술을 둥글린 자세가 있음');
      // 앞 모음은 혀의 가장 높은 곳이 앞쪽, 뒤 모음은 뒤쪽
      const peak = p => (P[p].F[1] < P[p].K[1] ? 'front' : 'back');
      if (peak('eh') !== 'front' || peak('wedge') !== 'back') w('입 그림: ɛ는 혀 앞 · ʌ는 혀 뒤가 높아야 함');
    } else w('입 그림: 덜 벌린 모음 자세(eh · wedge)가 없음');
    warn.forEach(m => console.warn('[OV.check] ' + m));
    return warn.length;
  };
})();
