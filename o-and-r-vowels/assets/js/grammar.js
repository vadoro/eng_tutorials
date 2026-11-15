/* 미끄러지는 오, r을 품은 어 — oʊ · ɝ · ɚ: 규칙 엔진 (RV)
 * 낱말마다 넓은 IPA(음절은 . · 센 음절 ˈ)와 철자(음절은 . · 목표 모음 글자는 [ ]), 한국어식 표기(목표 모음의 한글은 [ ])를 손으로 적었어요.
 * 엔진은 이 세 가지에서 목표 모음(oʊ · ɑ · ɔ · ɝ · ʌ · ɚ · ɑr)과 그 짝 · 짝 낱말이 정말 그 모음 하나만 다른지 · 한국어식으로 읽으면
 * 두 낱말이 같은 표기가 되는지 · 외래어 표기의 한글 모음이 무엇을 감추는지(오 하나 · 어 하나) · 셋이 갈리는 줄 ·
 * 철자와 문장 속 칠하기 · 음성 인식이 들은 말을 계산해요. 손으로 적은 IPA는 misaki 미국 발음 사전과 따로 맞춰 봤어요(README).
 * 소리를 듣지 않아요 — 모음 지도의 화살표(oʊ의 처음 · 끝 F1 · F2)와 r 울림 막대(F3)는 미리 만든 음성 파일을 따로 재서(audio/dialogue/measure.js) 그려요.
 */
(function () {
  'use strict';
  const RV = (window.RV = {});

  /* ---------- 소리 단위 (ɑr · ɔr은 한 덩어리) ---------- */
  const VOW = ['ɑr', 'ɔr', 'aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'i', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ə', 'ɚ', 'ɝ', 'ɑ', 'ɔ', 'ʊ', 'u'];
  const CON = ['tʃ', 'dʒ', 'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j'];
  const UNITS = VOW.concat(CON).sort((a, b) => b.length - a.length);
  const isV = p => VOW.indexOf(p) >= 0;
  RV.isV = isV;
  function phones1(s) {
    s = String(s).replace(/[ˈˌ]/g, '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const u = UNITS.find(x => s.startsWith(x, i));
      if (!u) throw new Error(`[RV] 모르는 소리 ${s[i]} (${s})`);
      out.push(u); i += u.length;
    }
    return out;
  }
  // 음절마다 따로 나눠요(ˈsɑ.ri의 ɑ · r이 한 덩어리가 되지 않게)
  const phones = s => String(s).split('.').reduce((a, x) => a.concat(phones1(x)), []);
  RV.phones = phones;

  /* ---------- 목표 모음 ----------
     side: o(미끄러지는 오 쪽) · r(r 모음 쪽) · role: a(목표 소리, 노랑) · b(짝 소리, 하늘) · c(아 + r, 분홍) */
  RV.V = {
    'oʊ': { v: 'oʊ', ko: '미끄러지는 오', short: '오 → 우', kr: '오', side: 'o', role: 'a',
      tip: '입술을 둥글게 모아 오로 시작해, 우 쪽으로 미끄러지며 입술을 더 모아요' },
    'ɑ': { v: 'ɑ', ko: '크게 벌린 아', short: '아', kr: '아', side: 'o', role: 'b',
      tip: '턱을 크게 내리고 혀를 낮게 — 미끄러지지 않아요' },
    'ɔ': { v: 'ɔ', ko: '크게 벌린 아(ɔ)', short: '아', kr: '오', side: 'o', role: 'b',
      tip: '턱을 크게 내려요 — 많은 미국 사람이 ɑ와 같게 말하고, 입술을 조금 둥글리는 사람도 있어요. 미끄러지지 않아요' },
    'ɝ': { v: 'ɝ', ko: 'r을 품은 어', short: 'r 어', kr: '어', side: 'r', role: 'a',
      tip: '혀를 r 모양으로 — 혀 몸통을 뭉쳐 올리거나 혀끝을 살짝 젖히고(혀끝은 입천장에 닿지 않게), 입술을 조금 모아요. 모음 내내' },
    'ʌ': { v: 'ʌ', ko: 'r 없는 어', short: '어', kr: '어', side: 'r', role: 'b',
      tip: '혀를 쉬게 두고 짧게 — r이 없어요' },
    'ɚ': { v: 'ɚ', ko: '약한 r 모음', short: '약한 r', kr: '어', side: 'r', role: 'a', weak: true,
      tip: '약하고 짧게, 그래도 혀는 r 모양으로' },
    'ɑr': { v: 'ɑr', ko: '아 + r', short: '아 + r', kr: '아', side: 'r', role: 'c',
      tip: '크게 벌린 아로 시작해 혀를 r 모양으로 옮겨요' },
  };
  RV.ORDER = ['oʊ', 'ɑ', 'ɔ', 'ɝ', 'ʌ', 'ɚ', 'ɑr'];
  RV.isTarget = p => !!RV.V[p];
  RV.vName = v => (RV.V[v] || { ko: v }).ko;
  RV.vLabel = v => `${v} (${RV.vName(v)})`;
  // 짝이 될 수 있는 모음: oʊ ↔ ɑ · ɔ(미끄러짐) · ɝ ↔ ʌ · ɔ(r)
  const MATE = { 'oʊ': ['ɑ', 'ɔ'], 'ɝ': ['ʌ', 'ɔ'] };
  RV.MATE = MATE;

  /* ---------- 발음 사전 ----------
     낱말|철자(음절 . · 목표 모음 글자 [ ])|IPA(음절 . · 센 음절 ˈ)|한국어식(목표 모음의 한글 [ ])|뜻|묶음(쉼표로 여럿)
     묶음: po 미끄러짐 짝 · pr r 모음 짝 · tri 셋이 갈리는 줄 · map 모음 지도 낱말(k_t) · loan 외래어 · weak 목표가 약한 r 모음(ɚ) ·
           est 굳어진 외래어 표기(톤) · sw 문장 속 낱말
     한국어식: 외래어는 흔히 쓰는 표기, 외래어가 아닌 낱말은 외래어 표기법대로(oʊ · ɔ → 오, ɑ → 아, ɝ · ʌ · ɚ → 어, w + oʊ · ɔ · ɝ → 워, w + ɑ → 와) */
  const DICT_SRC = `coat|c[oa]t|koʊt|[코]트|외투|po,map
caught|c[au]ght|kɔt|[코]트|잡았다|po,map
boat|b[oa]t|boʊt|[보]트|배|po,sw
bought|b[ou]ght|bɔt|[보]트|샀다|po,sw
low|l[ow]|loʊ|[로]|낮은|po,sw
law|l[aw]|lɔ|[로]|법|po
so|s[o]|soʊ|[소]|그래서 · 아주|po,sw
saw|s[aw]|sɔ|[소]|보았다 · 톱|po,sw
coast|c[oa]st|koʊst|[코]스트|해안|po
cost|c[o]st|kɔst|[코]스트|비용|po,sw
cope|c[o]pe|koʊp|[코]프|잘 대처하다|po
cop|c[o]p|kɑp|[캅]|경찰관|po
want|w[a]nt|wɑnt|[완]트|원하다|sw
pose|p[o]se|poʊz|[포]즈|자세를 잡다|po
pause|p[au]se|pɔz|[포]즈|잠깐 멈추다|po
note|n[o]te|noʊt|[노]트|쪽지|po
not|n[o]t|nɑt|[낫]|아니다|po,sw
hope|h[o]pe|hoʊp|[호]프|바라다|po,sw
hop|h[o]p|hɑp|[합]|깡충 뛰다|po
goat|g[oa]t|goʊt|[고]트|염소|po,sw
got|g[o]t|gɑt|[갓]|얻었다|po
bird|b[ir]d|bɝd|[버]드|새|pr,sw
bud|b[u]d|bʌd|[버]드|꽃봉오리|pr
burn|b[ur]n|bɝn|[번]|화상 · 타다|pr,tri
bun|b[u]n|bʌn|[번]|둥근 빵|pr,tri
curb|c[ur]b|kɝb|[커]브|연석(길가 턱)|pr,tri
cub|c[u]b|kʌb|[커]브|새끼(곰 · 사자)|pr,tri
girl|g[ir]l|gɝl|[걸]|소녀|pr,sw
gull|g[u]ll|gʌl|[걸]|갈매기|pr
fern|f[er]n|fɝn|[펀]|고사리|pr
fun|f[u]n|fʌn|[펀]|재미|pr,sw
work|w[or]k|wɝk|[워]크|일 · 일하다|pr,sw
walk|w[a]lk|wɔk|[워]크|걷다 · 산책|pr,sw
hurt|h[ur]t|hɝt|[허]트|다치게 하다 · 아프다|pr,tri
hut|h[u]t|hʌt|[헛]|오두막|pr,tri
shirt|sh[ir]t|ʃɝt|[셔]츠|셔츠|pr
shut|sh[u]t|ʃʌt|[셧]|닫다|pr,sw
turn|t[ur]n|tɝn|[턴]|돌다 · 차례|pr,sw
ton|t[o]n|tʌn|[톤]|톤(무게)|pr,est
lurk|l[ur]k|lɝk|[러]크|숨어 있다|pr
luck|l[u]ck|lʌk|[럭]|운|pr
heart|h[ear]t|hɑrt|[하]트|마음 · 심장|tri
barn|b[ar]n|bɑrn|[반]|헛간|tri
carb|c[ar]b|kɑrb|[카]브|탄수화물|tri
cut|c[u]t|kʌt|[컷]|자르다|tri,map,sw
curt|c[ur]t|kɝt|[커]트|퉁명스러운|tri,map
cart|c[ar]t|kɑrt|[카]트|수레|tri
home|h[o]me|hoʊm|[홈]|집|loan,sw
phone|ph[o]ne|foʊn|[폰]|전화기|loan,sw
show|sh[ow]|ʃoʊ|[쇼]|공연|loan,sw
toast|t[oa]st|toʊst|[토]스트|토스트|loan,sw
ball|b[a]ll|bɔl|[볼]|공|loan
talk|t[a]lk|tɔk|[토]크|말하다|loan
sauce|s[au]ce|sɔs|[소]스|소스|loan
shopping|sh[o]p.ping|ˈʃɑ.pɪŋ|[쇼]핑|쇼핑|loan
nurse|n[ur]se|nɝs|[너]스|간호사|loan,sw
first|f[ir]st|fɝst|[퍼]스트|첫째 · 먼저|loan,sw
world|w[or]ld|wɝld|[월]드|세계|loan
burger|b[ur].ger|ˈbɝ.gɚ|[버]거|햄버거|loan,sw
water|wa.t[er]|ˈwɔ.tɚ|워[터]|물|loan,weak,sw
doctor|doc.t[or]|ˈdɑk.tɚ|닥[터]|의사|loan,weak,sw
center|cen.t[er]|ˈsɛn.tɚ|센[터]|중심 · 센터|loan,weak,sw
computer|com.pu.t[er]|kəm.ˈpju.tɚ|컴퓨[터]|컴퓨터|loan,weak,sw
teacher|tea.ch[er]|ˈti.tʃɚ|티[처]|선생님|weak,sw
sister|sis.t[er]|ˈsɪs.tɚ|시스[터]|언니 · 누나 · 여동생|weak,sw
paper|pa.p[er]|ˈpeɪ.pɚ|페이[퍼]|종이|weak,sw
don't|d[o]n't|doʊnt||~하지 마|sw
road|r[oa]d|roʊd||길|sw
going|g[o].ing|ˈgoʊ.ɪŋ||가는 중|sw
go|g[o]|goʊ||가다|sw
cold|c[o]ld|koʊld||추운 · 차가운|sw
stove|st[o]ve|stoʊv||난로|sw
call|c[a]ll|kɔl||전화하다|sw
called|c[a]lled|kɔld||전화했다|sw
hot|h[o]t|hɑt||뜨거운|sw
sun|s[u]n|sʌn||해|sw
son|s[o]n|sʌn||아들|sw
Sunday|S[u]n.day|ˈsʌn.deɪ||일요일|sw
mother|m[o].ther|ˈmʌ.ðɚ||어머니|sw
bus|b[u]s|bʌs||버스|sw
something|s[o]me.thing|ˈsʌm.θɪŋ||무언가|sw
touch|t[ou]ch|tʌtʃ||만지다|sw
cup|c[u]p|kʌp||컵|sw
lunch|l[u]nch|lʌntʃ||점심|sw
her|h[er]|hɝ||그녀의|sw
learn|l[ear]n|lɝn||배우다|sw
hurry|h[ur].ry|ˈhɝ.i||서두름|sw`;

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
  RV.DICT = DICT;
  const entry = k => DICT[k] || DICT[LOWER[String(k).toLowerCase().replace('’', "'")]] || null;
  RV.entry = entry;
  RV.word = k => (entry(k) || { w: k }).w;
  RV.ipa = k => { const e = entry(k); return e ? '/' + e.ipa.replace(/\./g, '') + '/' : ''; };
  RV.inGrp = (k, g) => { const e = entry(k); return !!e && e.grp.indexOf(g) >= 0; };
  RV.byGrp = g => Object.values(DICT).filter(e => e.grp.indexOf(g) >= 0).map(e => e.key);

  /* ---------- 목표 음절 · 목표 모음 ----------
     목표 음절 = 철자에 [ ]가 있는 음절(보통 센 음절, 약한 r 모음 낱말은 ɚ가 있는 약한 음절) */
  RV.nSyl = k => { const e = entry(k); return e ? e.ph.filter(isV).length : 0; };
  RV.syls = k => (entry(k) || { syl: [] }).syl;
  RV.stressAt = k => Math.max(0, RV.syls(k).findIndex(s => s.st === 1));
  RV.targetAt = k => { const i = RV.syls(k).findIndex(s => /\[/.test(s.raw)); return i < 0 ? RV.stressAt(k) : i; };
  RV.vIndex = k => {
    const e = entry(k); if (!e) return -1;
    let n = -1;
    const at = RV.targetAt(k);
    for (let i = 0; i < e.ph.length; i++) if (isV(e.ph[i]) && ++n === at) return i;
    return -1;
  };
  RV.vowel = k => { const e = entry(k), i = RV.vIndex(k); return e && i >= 0 ? e.ph[i] : ''; };
  RV.side = k => (RV.V[RV.vowel(k)] || {}).side || '';
  RV.role = k => (RV.V[RV.vowel(k)] || {}).role || null;
  RV.before = k => { const e = entry(k), i = RV.vIndex(k); return e && i > 0 ? e.ph[i - 1] : ''; };
  RV.isWeak = k => RV.vowel(k) === 'ɚ';

  /* ---------- 짝: a = 목표 소리(oʊ · ɝ) · b = 짝 소리(ɑ · ɔ · ʌ) ---------- */
  const PAIR_SRC = [
    ['coat', 'caught'], ['boat', 'bought'], ['low', 'law'], ['so', 'saw'], ['coast', 'cost'],
    ['pose', 'pause'], ['cope', 'cop'], ['note', 'not'], ['hope', 'hop'], ['goat', 'got'],
    ['bird', 'bud'], ['burn', 'bun'], ['curb', 'cub'], ['girl', 'gull'], ['fern', 'fun'],
    ['work', 'walk'], ['hurt', 'hut'], ['shirt', 'shut'], ['turn', 'ton'], ['lurk', 'luck'],
  ];
  RV.PAIRS = PAIR_SRC.map(([a, b]) => ({ id: (a + '-' + b).toLowerCase().replace("'", ''), a, b, side: RV.side(a) }));
  RV.pairOf = k => { const e = entry(k); return e ? RV.PAIRS.find(p => p.a === e.key || p.b === e.key) || null : null; };
  RV.partner = k => { const p = RV.pairOf(k), e = entry(k); return p ? (p.a === e.key ? p.b : p.a) : null; };
  RV.pairsOf = side => RV.PAIRS.filter(p => p.side === side);
  // 두 낱말의 소리가 목표 모음 하나(oʊ ↔ ɑ · ɔ 또는 ɝ ↔ ʌ · ɔ)만 다른가
  RV.pairDiff = (a, b) => {
    const A = entry(a), B = entry(b);
    if (!A || !B || A.ph.length !== B.ph.length) return null;
    const d = A.ph.map((p, i) => p === B.ph[i] ? -1 : i).filter(i => i >= 0);
    if (d.length !== 1) return null;
    const x = A.ph[d[0]], y = B.ph[d[0]];
    return (MATE[x] || []).indexOf(y) >= 0 ? { at: d[0], a: x, b: y } : null;
  };

  /* ---------- 셋이 갈리는 줄: r 없는 어 · r을 품은 어 · 아 + r ---------- */
  RV.TRI = [['hut', 'hurt', 'heart'], ['bun', 'burn', 'barn'], ['cub', 'curb', 'carb'], ['cut', 'curt', 'cart']];
  RV.TRI_V = ['ʌ', 'ɝ', 'ɑr'];
  // 모음 지도 낱말(k + 모음 + t): 미끄러지는 오 · 크게 벌린 아(ɔ) · r 없는 어 · r을 품은 어
  RV.MAP = ['coat', 'caught', 'cut', 'curt'];

  /* ---------- 한국어식 표기: 목표 모음의 한글 ----------
     한글 모음 번호: ㅏ 0 · ㅓ 4 · ㅕ 6 · ㅗ 8 · ㅘ 9 · ㅛ 12 · ㅝ 14 */
  function hangul(ko) {
    return [...String(ko)].filter(c => /[가-힣]/.test(c)).map(ch => {
      const c = ch.charCodeAt(0) - 0xAC00;
      return { ch, on: Math.floor(c / 588), v: Math.floor((c % 588) / 28), coda: c % 28 };
    });
  }
  RV.hangul = hangul;
  const JAMO = { 0: 'ㅏ', 4: 'ㅓ', 6: 'ㅕ', 8: 'ㅗ', 9: 'ㅘ', 12: 'ㅛ', 14: 'ㅝ' };
  // 갈래: 오(ㅗ · ㅛ) · 아(ㅏ · ㅘ) · 어(ㅓ · ㅕ) · 워(ㅝ = w + 오 · 어, 외래어 표기법 제9항)
  const KO_FAM = { 8: '오', 12: '오', 0: '아', 9: '아', 4: '어', 6: '어', 14: '워' };
  const KO_OK = { 'oʊ': ['오', '워'], 'ɔ': ['오', '워'], 'ɑ': ['아'], 'ɝ': ['어', '워'], 'ʌ': ['어'], 'ɚ': ['어'], 'ɑr': ['아'] };
  RV.koSyl = k => { const e = entry(k); if (!e || !e.koRaw) return null; const m = e.koRaw.match(/\[([가-힣])\]/); return m ? hangul(m[1])[0] : null; };
  RV.koJamo = k => { const h = RV.koSyl(k); return h ? (JAMO[h.v] || '') : ''; };
  RV.koFam = k => { const h = RV.koSyl(k); return h ? (KO_FAM[h.v] || '') : ''; };
  // 표기법에서 어긋나는 한글(굳어진 표기 · 영국식에서 온 표기): '' = 맞음 · 아니면 그 갈래(쇼핑의 오 · 톤의 오)
  RV.koTrap = k => {
    const f = RV.koFam(k), v = RV.vowel(k);
    if (!f) return '';
    if (f === '워' && RV.before(k) !== 'w') return f;
    return (KO_OK[v] || []).indexOf(f) >= 0 ? '' : f;
  };
  // 한글이 감추는 것: 미끄러짐(oʊ) · r(ɝ · ɚ · ɑr) · 없음
  RV.koHides = k => { const v = RV.vowel(k); return v === 'oʊ' ? 'glide' : (v === 'ɝ' || v === 'ɚ' || v === 'ɑr') ? 'r' : ''; };
  RV.HIDE_KO = { glide: '오 하나로 적어요 — 우로 미끄러지는 것이 보이지 않아요', r: '어 · 아로 적어요 — r이 보이지 않아요' };
  RV.koSame = (a, b) => { const A = entry(a), B = entry(b); return !!(A && B && A.ko && A.ko === B.ko); };
  // 영상 · 페이지가 '같은 표기 · 다른 표기'라고 말하는 짝 — check()가 엔진으로 확인
  RV.CLAIMS = { same: ['coat-caught', 'boat-bought', 'work-walk', 'bird-bud', 'burn-bun'], diff: ['note-not', 'hurt-hut', 'cope-cop'] };

  /* ---------- 철자 칠하기: [ ] 안의 글자 = 목표 모음 ----------
     spellSegs(k) → [{ t, role: 'a' | 'b' | 'c' | null, i: 음절 }] */
  RV.spellSegs = k => {
    const e = entry(k), out = [];
    if (!e) return [{ t: String(k), role: null }];
    const role = RV.role(k);
    e.syl.forEach((s, i) => {
      String(s.raw).split(/(\[[^\]]*\])/).forEach(t => {
        if (!t) return;
        if (t[0] === '[') out.push({ t: t.slice(1, -1), role, i });
        else out.push({ t, role: null, i });
      });
    });
    return out;
  };
  // 한국어식 표기 칠하기: [ ] 안의 한글 = 목표 모음
  RV.koSegs = k => {
    const e = entry(k); if (!e || !e.koRaw) return [];
    return e.koRaw.split(/(\[[^\]]*\])/).filter(Boolean).map(t => t[0] === '[' ? { t: t.slice(1, -1), on: true } : { t, on: false });
  };

  /* ---------- 모음 지도의 그림 자리(잰 값이 없을 때 · 한국어 모음은 늘 그림) ----------
     x: 0 = 앞(F2 높음) → 1 = 뒤 · y: 0 = 혀가 높음(F1 낮음) → 1 = 낮음. 단순하게 그린 자리예요(잰 값이 아님).
     oʊ는 처음 → 끝 화살표 */
  RV.SCHEM = {
    'oʊ': { x: 0.7, y: 0.46, x2: 0.82, y2: 0.22 }, 'ɔ': { x: 0.82, y: 0.84 }, 'ɑ': { x: 0.78, y: 0.88 },
    'ʌ': { x: 0.6, y: 0.62 }, 'ɝ': { x: 0.48, y: 0.44 },
  };
  RV.KO_SCHEM = { '오': { x: 0.86, y: 0.38 }, '어': { x: 0.74, y: 0.52 }, '아': { x: 0.52, y: 0.84 } };

  /* ---------- 목소리 넷 (듣고 가르기 · 연습 문제) ---------- */
  RV.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '미국 여성' },
    { sp: 'tf', ko: '차분한 선생님', who: '미국 여성' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];

  /* ---------- 외래어 카드 열여섯: 한글이 감추는 것 ---------- */
  const LOAN_ROWS = [
    ['oʊ', '미끄러지는 오 oʊ', ['oʊ'], ['home', 'phone', 'show', 'toast']],
    ['ɔ', '크게 벌린 아 ɔ · ɑ', ['ɔ', 'ɑ'], ['ball', 'talk', 'sauce', 'shopping']],
    ['ɝ', 'r을 품은 어 ɝ', ['ɝ'], ['nurse', 'first', 'world', 'burger']],
    ['ɚ', '약한 r 모음 ɚ', ['ɚ'], ['water', 'doctor', 'center', 'computer']],
  ];
  RV.LROWS = LOAN_ROWS.map(([id, ko, vs, words]) => ({ id, ko, vs, words }));
  RV.LOAN = [];
  RV.LROWS.forEach(r => r.words.forEach(w => RV.LOAN.push({ w, row: r.id })));
  RV.LROW_TIP = {
    'oʊ': '오 하나 → 우까지 미끄러지게',
    'ɔ': '오 · 아 → 턱을 크게, 미끄러지지 않게',
    'ɝ': '어 → 혀를 r 모양으로',
    'ɚ': '끝의 어 → 약하게, 그래도 r',
  };

  /* ---------- 문장 속에서: 사전에 있는 낱말의 [ ] 글자 ----------
     segs(text) → [{ t, role, w, v }] */
  RV.segs = function (text) {
    const out = [];
    String(text).split(/([A-Za-z]+(?:['’][A-Za-z]+)?)/).forEach(tok => {
      if (!tok) return;
      if (!/[A-Za-z]/.test(tok)) { out.push({ t: tok, role: null }); return; }
      const e = entry(tok);
      if (!e || e.raw.replace(/[[\]]/g, '').toLowerCase() !== tok.toLowerCase().replace('’', "'")) { out.push({ t: tok, role: null }); return; }
      let at = 0;
      const v = RV.vowel(e.key);
      RV.spellSegs(e.key).forEach(p => {
        const t = tok.slice(at, at + p.t.length); at += p.t.length;
        out.push({ t, role: p.role, w: e.key, v: p.role ? v : '' });
      });
    });
    return out;
  };
  RV.wordsIn = text => { const seen = []; RV.segs(text).forEach(s => { if (s.w && seen.indexOf(s.w) < 0) seen.push(s.w); }); return seen; };
  RV.countIn = text => { const n = {}; RV.ORDER.forEach(v => { n[v] = 0; }); RV.segs(text).forEach(s => { if (s.role) n[s.v]++; }); return n; };

  /* ---------- 따라 말하기 28문장 (묶음마다 일곱) ---------- */
  RV.SGRP = {
    o: { ko: 'oʊ · ɑ ɔ', long: 'oʊ · ɑ ɔ — 미끄러지는 오는 우까지, 크게 벌린 아는 미끄러지지 않게' },
    r: { ko: 'ɝ · ʌ', long: 'ɝ · ʌ — r을 품은 어는 혀를 r 모양으로, r 없는 어는 혀를 쉬게' },
    loan: { ko: '외래어', long: '외래어 — 한글의 오 · 어는 미끄러짐과 r을 감춰요' },
    mix: { ko: '섞어서', long: '섞어서 — 한 문장 속 여러 모음' },
  };
  RV.SGRP_ORDER = ['o', 'r', 'loan', 'mix'];
  RV.SENT = [
    { grp: 'o', en: 'I bought a boat.', ko: '배를 샀어요.' },
    { grp: 'o', en: "Don't walk on the road.", ko: '찻길로 걷지 마세요.' },
    { grp: 'o', en: 'I saw a goat.', ko: '염소를 봤어요.' },
    { grp: 'o', en: 'I want a coat.', ko: '외투가 필요해요.' },
    { grp: 'o', en: "We're not going home.", ko: '우리는 집에 안 가요.' },
    { grp: 'o', en: 'Hope the cost is low.', ko: '비용이 적으면 좋겠어요.' },
    { grp: 'o', en: "It's cold, so call home.", ko: '추우니까 집에 전화해요.' },
    { grp: 'r', en: 'The bird is in the sun.', ko: '새가 햇볕 아래 있어요.' },
    { grp: 'r', en: 'Her son had fun.', ko: '그녀의 아들은 즐거웠어요.' },
    { grp: 'r', en: 'Shut the door and turn left.', ko: '문을 닫고 왼쪽으로 돌아요.' },
    { grp: 'r', en: 'I work on Sunday.', ko: '저는 일요일에 일해요.' },
    { grp: 'r', en: 'Learn from your mother.', ko: '어머니께 배워요.' },
    { grp: 'r', en: 'First, cut the bread.', ko: '먼저 빵을 잘라요.' },
    { grp: 'r', en: 'The nurse had lunch in a hurry.', ko: '간호사가 서둘러 점심을 먹었어요.' },
    { grp: 'loan', en: 'Turn on the computer.', ko: '컴퓨터를 켜요.' },
    { grp: 'loan', en: 'The nurse called the doctor.', ko: '간호사가 의사에게 전화했어요.' },
    { grp: 'loan', en: 'Put the phone on the paper.', ko: '휴대폰을 종이 위에 놓아요.' },
    { grp: 'loan', en: 'Water and toast, please.', ko: '물하고 토스트 주세요.' },
    { grp: 'loan', en: "Let's go to the show.", ko: '공연 보러 가요.' },
    { grp: 'loan', en: 'My sister is a teacher.', ko: '언니는 선생님이에요.' },
    { grp: 'loan', en: 'I had a burger at the center.', ko: '센터에서 버거를 먹었어요.' },
    { grp: 'mix', en: "I don't walk to work.", ko: '저는 걸어서 출근하지 않아요.' },
    { grp: 'mix', en: 'Her coat is on the bus.', ko: '그녀의 외투가 버스에 있어요.' },
    { grp: 'mix', en: 'Go home and learn something new.', ko: '집에 가서 새로운 걸 배워요.' },
    { grp: 'mix', en: 'I saw the first show.', ko: '첫 공연을 봤어요.' },
    { grp: 'mix', en: 'The water in the cup was cold.', ko: '컵의 물이 차가웠어요.' },
    { grp: 'mix', en: "Don't touch the hot stove.", ko: '뜨거운 난로를 만지지 마세요.' },
    { grp: 'mix', en: 'The girl bought a cup.', ko: '소녀가 컵을 샀어요.' },
  ];

  /* ---------- 음성 인식: 들은 말이 목표 낱말인가, 짝 낱말인가 ----------
     SAME: 소리가 같은 철자(cot · caught를 같게 말하는 사람이 많아요) */
  const SAME = { caught: ['caught', 'cot'], bought: ['bought', 'bot'], so: ['so', 'sew', 'sow'], not: ['not', 'knot'],
    pause: ['pause', 'paws'], low: ['low', 'lo'], turn: ['turn', 'tern'], ton: ['ton', 'tonne', 'tun'], curb: ['curb', 'kerb'], walk: ['walk', 'wok'] };
  const words = s => String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const has = (text, w) => {
    const ws = words(text), t = RV.word(w).toLowerCase();
    return ws.indexOf(t) >= 0 || (SAME[t] || []).some(x => ws.indexOf(x) >= 0);
  };
  RV.heard = function (target, alts) {
    const partner = RV.partner(target);
    alts = (alts || []).filter(Boolean);
    if (!alts.length) return { verdict: 'none', heard: '' };
    const top = alts[0];
    if (has(top, target)) return { verdict: 'target', heard: top, partner };
    if (partner && has(top, partner)) return { verdict: 'partner', heard: top, partner };
    const k = alts.findIndex(a => has(a, target));
    if (k > 0) return { verdict: 'maybe', heard: top, rank: k + 1, partner };
    return { verdict: 'other', heard: top, partner };
  };
  RV.HEARD_KO = {
    target: '목표 낱말로 들었어요',
    partner: '짝 낱말로 들었어요',
    maybe: '첫째 후보는 아니지만 후보에 있었어요',
    other: '다른 낱말로 들었어요',
    none: '아무 말도 듣지 못했어요',
  };
  // 내 발음 확인에 쓰는 짝(흔한 낱말 — 음성 인식은 흔한 낱말 쪽으로 기울어요)
  RV.MP_PAIRS = ['coat-caught', 'boat-bought', 'low-law', 'so-saw', 'cope-cop', 'note-not', 'hope-hop',
    'work-walk', 'bird-bud', 'hurt-hut', 'shirt-shut', 'burn-bun']
    .map(id => RV.PAIRS.find(p => p.id === id));

  /* ---------- 따라 말하기: 낱말 맞추기 ---------- */
  const norm = w => w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '');
  RV.compareWords = function (target, heard) {
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
     kind: word(어느 낱말?) · sent(문장 속 어느 낱말?) · same(두 낱말이 같았나?) · vowel(외래어의 목표 모음은?)
     a: 정답 보기 번호(0부터) — 엔진이 다시 계산해 맞춰 봐요 */
  RV.DRILL = [
    { kind: 'word', sp: 'um', say: 'caught', opts: ['coat', 'caught'], a: 1 },
    { kind: 'word', sp: 'uf', say: 'bird', opts: ['bird', 'bud'], a: 0 },
    { kind: 'sent', sp: 'tf', say: 'Pause the video.', frame: '___ the video.', opts: ['pose', 'pause'], a: 1, ko: '영상을 잠깐 멈춰요.' },
    { kind: 'same', sp: 'tc', say: ['low', 'law'], opts: ['같아요', '달라요'], a: 1 },
    { kind: 'word', sp: 'tf', say: 'work', opts: ['work', 'walk'], a: 0 },
    { kind: 'vowel', sp: 'tc', say: 'toast', a: 0 },
    { kind: 'word', sp: 'um', say: 'hut', opts: ['hurt', 'hut'], a: 1 },
    { kind: 'sent', sp: 'uf', say: 'That was a bad burn.', frame: 'That was a bad ___.', opts: ['burn', 'bun'], a: 0, ko: '심한 화상이었어요.' },
    { kind: 'word', sp: 'um', say: 'boat', opts: ['boat', 'bought'], a: 0 },
    { kind: 'same', sp: 'uf', say: ['shirt', 'shirt'], opts: ['같아요', '달라요'], a: 0 },
    { kind: 'word', sp: 'tf', say: 'not', opts: ['note', 'not'], a: 1 },
    { kind: 'sent', sp: 'um', say: 'I hope so.', frame: 'I ___ so.', opts: ['hope', 'hop'], a: 0, ko: '그러면 좋겠어요.' },
    { kind: 'word', sp: 'tc', say: 'turn', opts: ['turn', 'ton'], a: 0 },
    { kind: 'vowel', sp: 'tf', say: 'talk', a: 1 },
    { kind: 'word', sp: 'uf', say: 'cop', opts: ['cope', 'cop'], a: 1 },
    { kind: 'sent', sp: 'tc', say: 'The walk was long.', frame: 'The ___ was long.', opts: ['work', 'walk'], a: 1, ko: '산책이 길었어요.' },
  ];
  RV.vOpts = k => RV.side(k) === 'r' ? ['ɝ', 'ʌ'] : ['oʊ', RV.vowel(k) === 'ɑ' ? 'ɑ' : 'ɔ'];
  RV.DRILL.forEach(q => { if (q.kind === 'vowel') { q.vopts = RV.vOpts(q.say); q.opts = q.vopts.map(RV.vLabel); } });
  RV.drillWord = q => q.kind === 'same' ? q.say[0] : q.kind === 'sent' ? q.opts[q.a] : q.say;
  RV.drillWords = q => q.kind === 'same' ? q.say.slice() : q.kind === 'vowel' ? [q.say] : q.opts.slice();
  // 힌트 = 3단계 발음법
  RV.hints = function (q) {
    if (q.kind === 'vowel') {
      const e = entry(q.say), [A, B] = RV.vOpts(q.say).map(v => RV.V[v]);
      const r = RV.side(q.say) === 'r';
      return [
        { head: '① 듣고 가르기', text: r ? `센 음절(${RV.syls(q.say)[RV.stressAt(q.say)].sp})의 모음을 들어요. 모음 내내 r 울림이 이어지나요?` : `센 음절(${RV.syls(q.say)[RV.stressAt(q.say)].sp})의 모음을 들어요. 끝에서 우 쪽으로 미끄러지나요, 크게 벌린 채 끝나나요?` },
        { head: '② 입 모양 만들기', text: `${A.ko}: ${A.tip} · ${B.ko}: ${B.tip}.` },
        { head: '③ 낱말 속에서', text: `한글 표기(${e.ko})는 ${r ? '어로 적어 r이 보이지 않아요' : '오 하나로 적어 미끄러짐이 보이지 않아요'}. 사전의 IPA를 확인해요 → ${RV.ipa(q.say)}.` },
      ];
    }
    const [x] = q.kind === 'same' ? [q.say[0]] : q.opts;
    const pa = RV.pairOf(x);
    const [aw, bw] = pa ? [pa.a, pa.b] : q.opts;
    const A = RV.V[RV.vowel(aw)], B = RV.V[RV.vowel(bw)];
    const r = pa && pa.side === 'r';
    const same = RV.koSame(aw, bw);
    const ko3 = `한국어식으로는 ${entry(aw).ko} · ${entry(bw).ko}` + (same ? ' → 같은 표기라 글자로는 갈리지 않아요.' : ' → 표기는 달라도, 영어에서는 ' + (r ? 'r 울림' : '미끄러짐') + '이 두 낱말을 갈라요.');
    return [
      { head: '① 듣고 가르기', text: q.kind === 'same' ? (r ? '두 낱말의 모음만 견줘요. 둘 다 r 울림이 있나요?' : '두 낱말의 모음만 견줘요. 둘 다 우 쪽으로 미끄러지나요?') :
        r ? `모음 내내 r 울림이 이어지면 ${A.v}, 혀를 쉬게 둔 짧은 어면 ${B.v}.` : `오에서 우 쪽으로 미끄러지면 ${A.v}, 턱을 크게 내린 채 끝나면 ${B.v}.` },
      { head: '② 입 모양 만들기', text: `${aw} → ${A.tip} · ${bw} → ${B.tip}.` },
      { head: '③ 낱말 속에서', text: (q.kind === 'sent' ? '문장 속에서도 모음 하나로 뜻이 갈려요. ' : '') + ko3 },
    ];
  };

  /* ---------- 캔버스 글자 모음 (글꼴 미리 받기) ---------- */
  RV.allText = () => Object.values(DICT).map(e => e.w + e.raw + e.ipa + e.ko + e.gloss).join('') +
    RV.SENT.map(s => s.en + s.ko).join('') + Object.values(RV.SGRP).map(g => g.ko + g.long).join('') +
    RV.LROWS.map(r => r.ko).join('') + Object.values(RV.LROW_TIP).join('') + Object.values(RV.V).map(v => v.ko + v.tip + v.kr + v.short).join('') +
    RV.VOICES.map(v => v.ko + v.who).join('') + RV.DRILL.map(q => (q.frame || '') + (q.ko || '')).join('') +
    Object.values(RV.HIDE_KO).join('') + '오어아워우ㅗㅓㅏㅝㅜ';

  /* ---------- 데이터 점검 ---------- */
  RV.check = function () {
    const warn = [];
    const w = m => warn.push(m);
    Object.values(DICT).forEach(e => {
      if (e.spell.length !== e.syl.length) w(`${e.key}: 철자 음절 ${e.spell.length}개 ≠ IPA 음절 ${e.syl.length}개`);
      if (e.spell.join('').toLowerCase() !== e.w.toLowerCase()) w(`${e.key}: 철자를 이으면 ${e.spell.join('')}`);
      if (e.syl.filter(s => s.st === 1).length !== 1) w(`${e.key}: 센 음절이 하나가 아님`);
      e.syl.forEach((s, i) => { const n = phones(s.ipa).filter(isV).length; if (n !== 1) w(`${e.key}: ${i + 1}째 음절의 모음이 ${n}개`); });
      const v = RV.vowel(e.key);
      if (!RV.isTarget(v)) w(`${e.key}: 목표 모음 ${v}가 oʊ · ɑ · ɔ · ɝ · ʌ · ɚ · ɑr가 아님`);
      const marks = e.syl.map(s => (s.raw.match(/\[[^\]]*\]/g) || []).length);
      if (marks.reduce((a, b) => a + b, 0) !== 1) w(`${e.key}: [ ]가 하나가 아님`);
      // 목표 음절: 약한 r 모음 낱말은 ɚ가 있는 약한 음절, 아니면 센 음절
      const weak = e.grp.indexOf('weak') >= 0;
      if (weak !== (v === 'ɚ')) w(`${e.key}: 묶음 weak ↔ 목표 모음 ɚ가 맞지 않음`);
      if (!weak && RV.targetAt(e.key) !== RV.stressAt(e.key)) w(`${e.key}: [ ]가 센 음절에 있지 않음`);
      if (weak && RV.targetAt(e.key) === RV.stressAt(e.key)) w(`${e.key}: ɚ가 센 음절에 있음`);
      RV.spellSegs(e.key).filter(s => s.role).forEach(s => {
        if (!/^[aeiouyw]+r*$/i.test(s.t)) w(`${e.key}: [${s.t}] 안에 모음 글자(+ r)가 아닌 것`);
        const rv = v === 'ɝ' || v === 'ɚ' || v === 'ɑr';
        if (rv !== /r$/i.test(s.t)) w(`${e.key}: [${s.t}] — r 모음이면 r 글자까지, 아니면 r 없이`);
      });
      if (e.grp.indexOf('sw') < 0 || e.grp.length > 1) {
        if (!e.koRaw) w(`${e.key}: 한국어식 표기 없음`);
        else if ((e.koRaw.match(/\[[가-힣]\]/g) || []).length !== 1) w(`${e.key}: 한국어식의 [ ]가 한 글자에 하나가 아님`);
        else if (!RV.koFam(e.key)) w(`${e.key}: 한국어식 [${RV.koSyl(e.key).ch}]의 모음이 오 · 아 · 어 · 워가 아님`);
      }
      // 표기법에서 어긋나는 한글은 외래어(쇼핑) · 굳어진 표기(톤)만
      if (e.koRaw && RV.koTrap(e.key) && e.grp.indexOf('loan') < 0 && e.grp.indexOf('est') < 0) w(`${e.key}: 한국어식 ${e.ko}의 모음이 ${v}와 맞지 않음`);
      if (e.grp.indexOf('est') >= 0 && !RV.koTrap(e.key)) w(`${e.key}: 묶음 est인데 표기법과 같음`);
    });
    // 짝: 목표 모음 하나만 다르고(a = oʊ · ɝ), 센 음절, 묶음 po · pr, 낱말은 짝 하나에만
    const seen = {};
    RV.PAIRS.forEach(p => {
      if (!entry(p.a) || !entry(p.b)) { w(`짝 ${p.id}: 사전에 없음`); return; }
      const d = RV.pairDiff(p.a, p.b);
      if (!d) w(`짝 ${p.id}: 모음 하나(oʊ ↔ ɑ · ɔ · ɝ ↔ ʌ · ɔ)만 다른 짝이 아님`);
      else if (d.at !== RV.vIndex(p.a)) w(`짝 ${p.id}: 다른 자리가 목표 모음이 아님`);
      const g = p.side === 'o' ? 'po' : 'pr';
      if (!RV.inGrp(p.a, g) || !RV.inGrp(p.b, g)) w(`짝 ${p.id}: 묶음 ${g}`);
      [p.a, p.b].forEach(k => { if (seen[k]) w(`${k}: 짝 둘에 들어 있음`); seen[k] = 1; });
    });
    ['po', 'pr'].forEach(g => RV.byGrp(g).forEach(k => { if (!RV.pairOf(k)) w(`${k}: 묶음 ${g}인데 짝이 없음`); }));
    // 같은 표기 · 다른 표기 주장
    RV.CLAIMS.same.forEach(id => { const p = RV.PAIRS.find(q => q.id === id); if (!p) w(`주장 ${id}: 짝 없음`); else if (!RV.koSame(p.a, p.b)) w(`주장 ${id}: 같은 표기가 아님`); });
    RV.CLAIMS.diff.forEach(id => { const p = RV.PAIRS.find(q => q.id === id); if (!p) w(`주장 ${id}: 짝 없음`); else if (RV.koSame(p.a, p.b)) w(`주장 ${id}: 다른 표기가 아님`); });
    // 모음 지도 낱말: k + 모음 + t, 모음 oʊ · ɔ · ʌ · ɝ
    if (RV.MAP.map(RV.vowel).join() !== 'oʊ,ɔ,ʌ,ɝ') w('모음 지도 낱말: oʊ · ɔ · ʌ · ɝ 차례가 아님');
    RV.MAP.forEach(k => { const e = entry(k); if (!e || e.ph[0] !== 'k' || e.ph[e.ph.length - 1] !== 't' || e.ph.length !== 3) w(`${k}: k + 모음 + t가 아님`); else if (!RV.inGrp(k, 'map')) w(`${k}: 묶음 map이 아님`); });
    // 셋이 갈리는 줄: 첫 · 끝 자음이 같고 모음이 ʌ · ɝ · ɑr
    RV.TRI.forEach(t => {
      if (t.some(k => !entry(k))) { w(`줄 ${t.join(' · ')}: 사전에 없음`); return; }
      if (t.map(RV.vowel).join() !== RV.TRI_V.join()) w(`줄 ${t.join(' · ')}: 모음이 ʌ · ɝ · ɑr가 아님`);
      const sk = k => entry(k).ph.filter(p => !isV(p)).join('');
      if (new Set(t.map(sk)).size !== 1) w(`줄 ${t.join(' · ')}: 자음이 같지 않음`);
      t.forEach(k => { if (!RV.inGrp(k, 'tri')) w(`${k}: 묶음 tri가 아님`); });
    });
    // 외래어 줄: 줄의 모음 = 엔진이 계산한 목표 모음
    RV.LOAN.forEach(o => {
      if (!entry(o.w)) { w(`외래어 ${o.w}: 사전에 없음`); return; }
      const r = RV.LROWS.find(x => x.id === o.row);
      if (r.vs.indexOf(RV.vowel(o.w)) < 0) w(`외래어 ${o.w}: 줄 ${o.row} ≠ 엔진 ${RV.vowel(o.w)}`);
      if (!RV.inGrp(o.w, 'loan')) w(`외래어 ${o.w}: 묶음 loan이 아님`);
    });
    if (RV.LOAN.length !== 16) w(`외래어 카드 ${RV.LOAN.length}장`);
    // 문장: 칠할 낱말이 둘 이상, 묶음마다 일곱
    RV.SENT.forEach((s, i) => {
      const n = RV.countIn(s.en);
      if (RV.wordsIn(s.en).length < 2) w(`문장 ${i + 1}: 칠할 낱말이 둘보다 적음`);
      if (s.grp === 'o' && !(n['oʊ'] && (n['ɑ'] || n['ɔ']))) w(`문장 ${i + 1}: oʊ · ɑ ɔ가 함께 있지 않음`);
      if (s.grp === 'r' && !(n['ɝ'] && n['ʌ'])) w(`문장 ${i + 1}: ɝ · ʌ가 함께 있지 않음`);
      if (s.grp === 'loan' && !RV.wordsIn(s.en).some(k => RV.inGrp(k, 'loan') || RV.inGrp(k, 'weak'))) w(`문장 ${i + 1}: 외래어 · 약한 r 모음 낱말이 없음`);
      if (s.grp === 'mix' && Object.values(n).filter(Boolean).length < 3) w(`문장 ${i + 1}: 모음이 셋 넘게 섞이지 않음`);
    });
    const grp = {}; RV.SENT.forEach(s => { grp[s.grp] = (grp[s.grp] || 0) + 1; });
    RV.SGRP_ORDER.forEach(g => { if (grp[g] !== 7) w(`문장 묶음 ${g}: ${grp[g] || 0}개`); });
    // 연습 문제: 엔진의 정답과 같은지, 정답 위치, 목소리
    const pos = [0, 0], vc = {};
    RV.DRILL.forEach((q, k) => {
      pos[q.a]++; vc[q.sp] = (vc[q.sp] || 0) + 1;
      if (q.kind === 'word' || q.kind === 'sent') {
        if (RV.partner(q.opts[0]) !== q.opts[1]) w(`연습 ${k + 1}: 보기가 짝이 아님`);
        const p = RV.pairOf(q.opts[0]);
        if (p && (q.opts[0] !== p.a)) w(`연습 ${k + 1}: 보기 차례(목표 → 짝)`);
      }
      if (q.kind === 'word' && q.opts[q.a] !== q.say) w(`연습 ${k + 1}: 정답 ≠ 들려주는 낱말`);
      if (q.kind === 'sent') {
        if (q.frame.replace('___', q.opts[q.a]).toLowerCase() !== q.say.toLowerCase()) w(`연습 ${k + 1}: 문장과 정답이 맞지 않음`);
      }
      if (q.kind === 'same') {
        const same = q.say[0] === q.say[1];
        if (!same && RV.partner(q.say[0]) !== q.say[1]) w(`연습 ${k + 1}: 두 낱말이 짝이 아님`);
        if ((same ? 0 : 1) !== q.a) w(`연습 ${k + 1}: 같아요 · 달라요 정답`);
      }
      if (q.kind === 'vowel') {
        if (!entry(q.say)) w(`연습 ${k + 1}: ${q.say} 사전에 없음`);
        else if (q.vopts[q.a] !== RV.vowel(q.say)) w(`연습 ${k + 1}: 모음 ${q.vopts[q.a]} ≠ 엔진 ${RV.vowel(q.say)}`);
        if (!RV.inGrp(q.say, 'loan')) w(`연습 ${k + 1}: 외래어가 아님`);
      }
      if (['tc', 'tf', 'uf', 'um'].indexOf(q.sp) < 0) w(`연습 ${k + 1}: 목소리 ${q.sp}`);
    });
    if (Math.abs(pos[0] - pos[1]) > 1) w(`정답 위치가 한쪽으로 몰림: ${pos.join(' / ')}`);
    if (Object.values(vc).some(n => n !== 4)) w(`연습 문제의 목소리가 고르지 않음: ${JSON.stringify(vc)}`);
    RV.MP_PAIRS.forEach((p, i) => { if (!p) w(`내 발음 확인 짝 ${i + 1}: 짝 목록에 없음`); });
    // 입 그림: o는 입술을 둥글게 · 턱은 a보다 덜, 미끄러짐의 끝(u)은 혀 뒤가 o보다 높고 입술을 더 모음,
    // r 자세 둘(rb · r)은 혀가 입천장에 닿지 않고(그림의 접촉 계산 기준) 입술을 조금 모음, ʌ(wedge)는 둥글리지 않음
    if (window.EN && EN.mouth && EN.mouth.POSES.o) {
      const P = EN.mouth.POSES, C = EN.mouth.contact;
      ['o', 'u', 'a', 'wedge', 'rb', 'r'].forEach(k => { if (C(k).touch) w(`입 그림 ${k}: 혀가 입천장에 닿음`); });
      if (!((P.o.round || 0) >= 0.5)) w('입 그림: o의 입술이 둥글지 않음');
      if (!(P.o.jaw < P.a.jaw)) w('입 그림: o의 턱이 a보다 덜 내려가지 않음');
      if (!(P.u.K[1] < P.o.K[1] && P.u.round > P.o.round)) w('입 그림: 미끄러짐의 끝(u)이 o보다 혀 뒤가 높고 입술을 더 모으지 않음');
      if (!((P.rb.round || 0) >= 0.3 && (P.r.round || 0) >= 0.3)) w('입 그림: r 자세의 입술을 모으지 않음');
      if ((P.wedge.round || 0) > 0.1) w('입 그림: ʌ의 입술을 둥글림');
    } else w('입 그림: 미끄러지는 오의 처음 자세(o)가 없음');
    warn.forEach(m => console.warn('[RV.check] ' + m));
    return warn.length;
  };
})();
