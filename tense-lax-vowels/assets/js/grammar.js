/* 긴장한 모음, 느슨한 모음 — i · ɪ · u · ʊ: 규칙 엔진 (TL)
 * 낱말마다 넓은 IPA(음절은 . · 센 음절 ˈ)와 철자(음절은 . · 센 음절의 목표 모음 글자는 [ ])를 손으로 적었어요.
 * 엔진은 이 두 가지에서 센 음절의 모음(i · ɪ · u · ʊ)과 그 짝 · 짝 낱말이 정말 그 모음 하나만 다른지 · 모음 뒤의 소리
 * (목이 울리는 끝이면 모음이 길어져요) · 한국어식으로 읽으면 두 낱말이 같아지는지 · 철자와 문장 속 칠하기 ·
 * 음성 인식이 들은 말을 계산해요. 손으로 적은 IPA는 misaki 미국 발음 사전과 따로 맞춰 봤어요(README).
 * 소리를 듣지 않아요 — 모음 지도의 점(F1 · F2)과 모음 길이는 미리 만든 음성 파일을 따로 재서(audio/dialogue/measure.js) 그려요.
 */
(function () {
  'use strict';
  const TL = (window.TL = {});

  /* ---------- 소리 단위 ---------- */
  const VOW = ['aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'i', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ə', 'ɚ', 'ɝ', 'ɑ', 'ɔ', 'ʊ', 'u'];
  const CON = ['tʃ', 'dʒ', 'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j'];
  const UNITS = VOW.concat(CON).sort((a, b) => b.length - a.length);
  const isV = p => VOW.indexOf(p) >= 0;
  TL.isV = isV;
  function phones(s) {
    s = String(s).replace(/[ˈˌ.]/g, '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const u = UNITS.find(x => s.startsWith(x, i));
      if (!u) throw new Error(`[TL] 모르는 소리 ${s[i]} (${s})`);
      out.push(u); i += u.length;
    }
    return out;
  }
  TL.phones = phones;
  // 목이 울리지 않는 자음(이 앞에서는 모음이 짧아져요)
  const VOICELESS = ['p', 't', 'k', 'f', 'θ', 's', 'ʃ', 'tʃ', 'h'];
  TL.isVoiceless = p => VOICELESS.indexOf(p) >= 0;

  /* ---------- 네 모음 ----------
     tense: 긴장한 모음(노랑 a) · lax: 느슨한 모음(하늘 b) · front: 앞(이) · back: 뒤(우) */
  TL.V = {
    i: { v: 'i', ko: '긴장한 이', short: '긴장', kr: '이', tense: true, front: true, role: 'a', mate: 'ɪ',
      tip: '혀를 높이 · 앞으로, 입꼬리를 옆으로 당기고 힘을 줘요' },
    'ɪ': { v: 'ɪ', ko: '느슨한 이', short: '느슨', kr: '이', tense: false, front: true, role: 'b', mate: 'i',
      tip: '혀를 조금 내리고 힘을 빼요 — 이와 에 사이' },
    u: { v: 'u', ko: '긴장한 우', short: '긴장', kr: '우', tense: true, front: false, role: 'a', mate: 'ʊ',
      tip: '입술을 동그랗게 앞으로 내밀고 혀 뒤를 높이 들어요' },
    'ʊ': { v: 'ʊ', ko: '느슨한 우', short: '느슨', kr: '우', tense: false, front: false, role: 'b', mate: 'u',
      tip: '입술을 덜 모으고 혀를 조금 내려 힘을 빼요 — 우와 어 사이' },
  };
  TL.isTarget = p => !!TL.V[p];
  TL.vName = v => (TL.V[v] || { ko: v }).ko;
  TL.vLabel = v => `${v} (${TL.vName(v)})`;

  /* ---------- 발음 사전 ----------
     낱말|철자(음절 . · 센 음절의 목표 모음 글자 [ ])|IPA(음절 . · 센 음절 ˈ)|한국어식|뜻|묶음(쉼표로 여럿)
     묶음: pi 이 짝 · pu 우 짝 · hvd 모음 지도 낱말(h_d) · len 길이 낱말 · loan 외래어 · sw 문장 속 낱말
     한국어식: 외래어는 흔히 쓰는 표기, 외래어가 아닌 낱말은 한국어식으로 읽은 소리 — 짝은 둘이 같아져요(sheep · ship → 십) */
  const DICT_SRC = `sheep|sh[ee]p|ʃip|십|양|pi
ship|sh[i]p|ʃɪp|십|배|pi
leave|l[ea]ve|liv|리브|떠나다 · 두고 가다|pi
live|l[i]ve|lɪv|리브|살다|pi
seat|s[ea]t|sit|싯|자리|pi
sit|s[i]t|sɪt|싯|앉다|pi
heat|h[ea]t|hit|힛|열 · 데우다|pi
hit|h[i]t|hɪt|힛|치다|pi
feet|f[ee]t|fit|핏|발(둘 이상)|pi
fit|f[i]t|fɪt|핏|꼭 맞다|pi
eat|[ea]t|it|잇|먹다|pi
it|[i]t|ɪt|잇|그것|pi,sw
feel|f[ee]l|fil|필|느끼다|pi
fill|f[i]ll|fɪl|필|채우다|pi
peel|p[ee]l|pil|필|껍질을 벗기다|pi
pill|p[i]ll|pɪl|필|알약|pi
heel|h[ee]l|hil|힐|발뒤꿈치 · 굽|pi
hill|h[i]ll|hɪl|힐|언덕|pi
reach|r[ea]ch|ritʃ|리치|닿다|pi
rich|r[i]ch|rɪtʃ|리치|부유한|pi
sleep|sl[ee]p|slip|슬립|자다|pi
slip|sl[i]p|slɪp|슬립|미끄러지다|pi
cheap|ch[ea]p|tʃip|칩|값이 싼|pi
chip|ch[i]p|tʃɪp|칩|조각 · 감자칩|pi
deep|d[ee]p|dip|딥|깊은|pi
dip|d[i]p|dɪp|딥|살짝 담그다|pi
beat|b[ea]t|bit|빗|이기다 · 박자|pi,len
bit|b[i]t|bɪt|빗|조금|pi,len
bead|b[ea]d|bid|비드|구슬|pi,len
bid|b[i]d|bɪd|비드|값을 부르다|pi,len
heed|h[ee]d|hid|히드|귀담아듣다|pi,hvd
hid|h[i]d|hɪd|히드|숨겼다|pi,hvd
pool|p[oo]l|pul|풀|수영장|pu
pull|p[u]ll|pʊl|풀|당기다|pu
fool|f[oo]l|ful|풀|바보|pu
full|f[u]ll|fʊl|풀|가득 찬|pu
Luke|L[u]ke|luk|룩|루크(이름)|pu
look|l[oo]k|lʊk|룩|보다|pu
who'd|wh[o]'d|hud|후드|누가 ~했을까(who would)|pu,hvd
hood|h[oo]d|hʊd|후드|모자(옷의 후드)|pu,hvd
stewed|st[ew]ed|stud|스투드|뭉근히 끓인|pu
stood|st[oo]d|stʊd|스투드|섰다|pu
chicken|ch[i].cken|ˈtʃɪ.kən|치킨|닭고기|loan
building|b[ui]l.ding|ˈbɪl.dɪŋ|빌딩|건물|loan
video|v[i].de.o|ˈvɪ.di.oʊ|비디오|비디오 · 영상|loan,sw
ticket|t[i]ck.et|ˈtɪk.ɪt|티켓|표|loan
pizza|p[i]z.za|ˈpit.sə|피자|피자|loan
meeting|m[ee].ting|ˈmi.tɪŋ|미팅|회의|loan
cream|cr[ea]m|krim|크림|크림|loan
cheese|ch[ee]se|tʃiz|치즈|치즈|loan,sw
cookie|c[oo].kie|ˈkʊ.ki|쿠키|쿠키|loan
book|b[oo]k|bʊk|북|책|loan,sw
good|g[oo]d|gʊd|굿|좋은|loan,sw
pudding|p[u]d.ding|ˈpʊ.dɪŋ|푸딩|푸딩|loan
soup|s[ou]p|sup|수프|수프|loan,sw
juice|j[ui]ce|dʒus|주스|주스|loan
school|sch[oo]l|skul|스쿨|학교|loan,sw
spoon|sp[oo]n|spun|스푼|숟가락|loan,sw
did|d[i]d|dɪd||했다|sw
he|h[e]|hi||그|sw
is|[i]s|ɪz||~이다|sw
this|th[i]s|ðɪs||이것|sw
free|fr[ee]|fri||빈 · 공짜인|sw
please|pl[ea]se|pliz||부디|sw
sick|s[i]ck|sɪk||아픈|sw
we|w[e]|wi||우리|sw
will|w[i]ll|wɪl||~할 것이다|sw
meet|m[ee]t|mit||만나다|sw
gym|g[y]m|dʒɪm||체육관|sw
into|[i]n.to|ˈɪn.tu||~ 안으로|sw
would|w[ou]ld|wʊd||~하겠어요|sw
you|y[ou]|ju||너 · 당신|sw
food|f[oo]d|fud||음식|sw
in|[i]n|ɪn||~ 안에|sw
room|r[oo]m|rum||방|sw
should|sh[ou]ld|ʃʊd||~해야 한다|sw
cook|c[oo]k|kʊk||요리하다|sw
put|p[u]t|pʊt||놓다|sw
do|d[o]|du||하다|sw
need|n[ee]d|nid||필요하다|sw
read|r[ea]d|rid||읽다|sw
she|sh[e]|ʃi||그녀|sw
visit|v[i].sit|ˈvɪ.zɪt||방문하다|sw
city|c[i].ty|ˈsɪ.ti||도시|sw
could|c[ou]ld|kʊd||~할 수 있었다|sw
see|s[ee]|si||보다|sw
fridge|fr[i]dge|frɪdʒ||냉장고|sw
little|l[i]t.tle|ˈlɪ.təl||작은|sw
fish|f[i]sh|fɪʃ||물고기|sw
these|th[e]se|ðiz||이것들|sw`;

  const DICT = {}, LOWER = {};
  DICT_SRC.split('\n').forEach(line => {
    const [key, spell, ipa, ko, gloss, grp] = line.trim().split('|');
    const sp = spell.split('.'), ip = ipa.split('.');
    const ph = phones(ipa);
    const syl = ip.map((s, i) => ({ sp: (sp[i] || '').replace(/[[\]]/g, ''), raw: sp[i] || '', ipa: s.replace(/[ˈˌ]/g, ''), st: s[0] === 'ˈ' ? 1 : s[0] === 'ˌ' ? 2 : 0 }));
    if (syl.length === 1) syl[0].st = 1;
    DICT[key] = { key, w: key, raw: spell.replace(/\./g, ''), spell: sp.map(s => s.replace(/[[\]]/g, '')), ipa, ph, ko: ko || '', gloss, grp: grp.split(','), syl };
    LOWER[key.toLowerCase()] = key;
  });
  TL.DICT = DICT;
  const entry = k => DICT[k] || DICT[LOWER[String(k).toLowerCase().replace('’', "'")]] || null;
  TL.entry = entry;
  TL.word = k => (entry(k) || { w: k }).w;
  TL.ipa = k => { const e = entry(k); return e ? '/' + e.ipa.replace(/\./g, '') + '/' : ''; };
  TL.inGrp = (k, g) => { const e = entry(k); return !!e && e.grp.indexOf(g) >= 0; };
  TL.byGrp = g => Object.values(DICT).filter(e => e.grp.indexOf(g) >= 0).map(e => e.key);

  /* ---------- 센 음절의 모음 · 그 앞뒤 ---------- */
  TL.nSyl = k => { const e = entry(k); return e ? e.ph.filter(isV).length : 0; };
  TL.syls = k => (entry(k) || { syl: [] }).syl;
  TL.stressAt = k => Math.max(0, TL.syls(k).findIndex(s => s.st === 1));
  // 센 음절의 모음이 소리 목록에서 몇째인가
  TL.vIndex = k => {
    const e = entry(k); if (!e) return -1;
    let n = -1;
    const at = TL.stressAt(k);
    for (let i = 0; i < e.ph.length; i++) if (isV(e.ph[i]) && ++n === at) return i;
    return -1;
  };
  TL.vowel = k => { const e = entry(k), i = TL.vIndex(k); return e && i >= 0 ? e.ph[i] : ''; };
  TL.side = k => { const v = TL.V[TL.vowel(k)]; return v ? (v.front ? 'front' : 'back') : ''; };
  TL.isTense = k => { const v = TL.V[TL.vowel(k)]; return !!(v && v.tense); };
  // 모음 바로 뒤의 소리(없으면 '')와 그 소리가 목을 울리나 — 울리면 모음이 길어져요
  TL.after = k => { const e = entry(k), i = TL.vIndex(k); return e && i >= 0 ? (e.ph[i + 1] || '') : ''; };
  TL.afterVoiced = k => { const a = TL.after(k); return !a || !TL.isVoiceless(a); };
  // 길이 어림(그림의 기본값, 잰 값이 없을 때): 긴장 1 · 느슨 0.75 × 울리는 끝 1.35 · 울리지 않는 끝 0.8
  TL.lenGuess = k => (TL.isTense(k) ? 1 : 0.75) * (TL.afterVoiced(k) ? 1.35 : 0.8);

  /* ---------- 짝: a = 긴장(i · u) · b = 느슨(ɪ · ʊ) ---------- */
  const PAIR_SRC = [
    ['sheep', 'ship'], ['leave', 'live'], ['seat', 'sit'], ['heat', 'hit'], ['feet', 'fit'], ['eat', 'it'],
    ['feel', 'fill'], ['peel', 'pill'], ['heel', 'hill'], ['reach', 'rich'], ['sleep', 'slip'], ['cheap', 'chip'],
    ['deep', 'dip'], ['beat', 'bit'], ['bead', 'bid'], ['heed', 'hid'],
    ['pool', 'pull'], ['fool', 'full'], ['Luke', 'look'], ["who'd", 'hood'], ['stewed', 'stood'],
  ];
  TL.PAIRS = PAIR_SRC.map(([a, b]) => ({ id: (a + '-' + b).toLowerCase().replace("'", ''), a, b, side: TL.side(a) }));
  TL.pairOf = k => { const e = entry(k); return e ? TL.PAIRS.find(p => p.a === e.key || p.b === e.key) || null : null; };
  TL.partner = k => { const p = TL.pairOf(k), e = entry(k); return p ? (p.a === e.key ? p.b : p.a) : null; };
  TL.pairsOf = side => TL.PAIRS.filter(p => p.side === side);
  // 두 낱말의 소리가 센 음절의 모음 하나(i ↔ ɪ 또는 u ↔ ʊ)만 다른가
  TL.pairDiff = (a, b) => {
    const A = entry(a), B = entry(b);
    if (!A || !B || A.ph.length !== B.ph.length) return null;
    const d = A.ph.map((p, i) => p === B.ph[i] ? -1 : i).filter(i => i >= 0);
    if (d.length !== 1) return null;
    const x = A.ph[d[0]], y = B.ph[d[0]];
    return TL.V[x] && TL.V[x].mate === y ? { at: d[0], a: x, b: y } : null;
  };
  // 한국어식으로 읽으면 두 낱말이 같아지나(같은 한글)
  TL.koSame = (a, b) => { const A = entry(a), B = entry(b); return !!(A && B && A.ko && A.ko === B.ko); };
  // 같은 모음 짝, 길이 넷(모음 · 끝소리에 따라 길이가 어떻게 바뀌나)
  TL.LEN = ['beat', 'bit', 'bead', 'bid'];

  /* ---------- 한국어식 표기: 목표 모음 자리의 한글 모음(ㅣ · ㅜ) ---------- */
  function hangul(ko) {
    return [...String(ko)].filter(c => /[가-힣]/.test(c)).map(ch => {
      const c = ch.charCodeAt(0) - 0xAC00;
      return { ch, on: Math.floor(c / 588), v: Math.floor((c % 588) / 28), coda: c % 28 };
    });
  }
  TL.hangul = hangul;
  // 한글 모음 번호: ㅜ 13 · ㅠ 17 · ㅣ 20
  TL.koVowelOk = k => {
    const e = entry(k); if (!e || !e.ko) return true;
    const H = hangul(e.ko), front = TL.side(k) === 'front';
    return H.some(h => front ? h.v === 20 : (h.v === 13 || h.v === 17));
  };

  /* ---------- 철자 칠하기: [ ] 안의 글자 = 센 음절의 목표 모음 ----------
     spellSegs(k) → [{ t, role: 'a'(긴장) | 'b'(느슨) | null, i: 음절 }] */
  TL.spellSegs = k => {
    const e = entry(k), out = [];
    if (!e) return [{ t: String(k), role: null }];
    const role = (TL.V[TL.vowel(k)] || {}).role || null;
    e.syl.forEach((s, i) => {
      String(s.raw).split(/(\[[^\]]*\])/).forEach(t => {
        if (!t) return;
        if (t[0] === '[') out.push({ t: t.slice(1, -1), role, i });
        else out.push({ t, role: null, i });
      });
    });
    return out;
  };

  /* ---------- 모음 지도의 그림 자리(잰 값이 없을 때 · 한국어 모음은 늘 그림) ----------
     x: 0 = 앞(F2 높음) → 1 = 뒤 · y: 0 = 혀가 높음(F1 낮음) → 1 = 낮음. 단순하게 그린 자리예요(잰 값이 아님). */
  TL.SCHEM = { i: { x: 0.1, y: 0.1 }, 'ɪ': { x: 0.27, y: 0.34 }, u: { x: 0.74, y: 0.14 }, 'ʊ': { x: 0.62, y: 0.38 } };
  TL.KO_SCHEM = { '이': { x: 0.12, y: 0.14 }, '우': { x: 0.86, y: 0.18 } };

  /* ---------- 목소리 넷 (듣고 가르기 · 연습 문제) ---------- */
  TL.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '미국 여성' },
    { sp: 'tf', ko: '차분한 선생님', who: '미국 여성' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];

  /* ---------- 외래어 카드 열여섯: 한글은 이 · 우 하나, 영어는 둘 ---------- */
  const LOAN_ROWS = [
    ['ɪ', '느슨한 ɪ', ['chicken', 'building', 'video', 'ticket']],
    ['i', '긴장한 i', ['pizza', 'meeting', 'cream', 'cheese']],
    ['ʊ', '느슨한 ʊ', ['cookie', 'book', 'good', 'pudding']],
    ['u', '긴장한 u', ['soup', 'juice', 'school', 'spoon']],
  ];
  TL.LROWS = LOAN_ROWS.map(([v, ko, words]) => ({ id: v, v, ko, words }));
  TL.LOAN = [];
  TL.LROWS.forEach(r => r.words.forEach(w => TL.LOAN.push({ w, row: r.v })));

  /* ---------- 문장 속에서: 사전에 있는 낱말의 [ ] 글자 ----------
     segs(text) → [{ t, role: 'a' | 'b' | null, w, v }] */
  TL.segs = function (text) {
    const out = [];
    String(text).split(/([A-Za-z]+(?:['’][A-Za-z]+)?)/).forEach(tok => {
      if (!tok) return;
      if (!/[A-Za-z]/.test(tok)) { out.push({ t: tok, role: null }); return; }
      const e = entry(tok);
      if (!e || e.raw.replace(/[[\]]/g, '').toLowerCase() !== tok.toLowerCase().replace('’', "'")) { out.push({ t: tok, role: null }); return; }
      let at = 0;
      const v = TL.vowel(e.key);
      TL.spellSegs(e.key).forEach(p => {
        const t = tok.slice(at, at + p.t.length); at += p.t.length;
        out.push({ t, role: p.role, w: e.key, v: p.role ? v : '' });
      });
    });
    return out;
  };
  TL.wordsIn = text => { const seen = []; TL.segs(text).forEach(s => { if (s.w && seen.indexOf(s.w) < 0) seen.push(s.w); }); return seen; };
  TL.countIn = text => { const n = { i: 0, 'ɪ': 0, u: 0, 'ʊ': 0 }; TL.segs(text).forEach(s => { if (s.role) n[s.v]++; }); return n; };

  /* ---------- 따라 말하기 28문장 (묶음마다 일곱) ---------- */
  TL.SGRP = {
    front: { ko: 'i · ɪ', long: 'i · ɪ — 긴장한 이는 입꼬리를 당기고, 느슨한 이는 힘을 빼고 조금 내려요' },
    back: { ko: 'u · ʊ', long: 'u · ʊ — 긴장한 우는 입술을 내밀고, 느슨한 우는 덜 모아요' },
    loan: { ko: '외래어', long: '외래어 — 한글은 이 · 우 하나, 영어는 어느 쪽인지 사전에서 확인' },
    mix: { ko: '섞어서', long: '섞어서 — 한 문장 속 긴장한 모음과 느슨한 모음' },
  };
  TL.SGRP_ORDER = ['front', 'back', 'loan', 'mix'];
  TL.SENT = [
    { grp: 'front', en: 'Did he leave or live?', ko: '그가 떠났어요, 살았어요?' },
    { grp: 'front', en: 'Is this seat free?', ko: '이 자리 비었어요?' },
    { grp: 'front', en: 'Sit down and eat it.', ko: '앉아서 그거 먹어요.' },
    { grp: 'front', en: 'Please fill the cup.', ko: '컵을 채워 주세요.' },
    { grp: 'front', en: 'I feel sick.', ko: '속이 안 좋아요.' },
    { grp: 'front', en: 'This chip is cheap.', ko: '이 칩은 싸요.' },
    { grp: 'front', en: 'We will meet at the gym.', ko: '체육관에서 만나요.' },
    { grp: 'back', en: "Look, it's Luke.", ko: '봐, 루크야.' },
    { grp: 'back', en: "Don't pull me into the pool.", ko: '나를 수영장으로 끌어당기지 마.' },
    { grp: 'back', en: 'The pool is full.', ko: '수영장이 꽉 찼어요.' },
    { grp: 'back', en: 'Would you like some food?', ko: '음식 좀 드실래요?' },
    { grp: 'back', en: 'I stood in the room.', ko: '나는 방에 서 있었어요.' },
    { grp: 'back', en: 'You should cook it.', ko: '그건 요리해서 먹어야 해요.' },
    { grp: 'back', en: 'This book is good.', ko: '이 책 좋아요.' },
    { grp: 'loan', en: "I'd like chicken and pizza.", ko: '치킨이랑 피자 주세요.' },
    { grp: 'loan', en: 'The meeting is in that building.', ko: '회의는 저 건물에서 해요.' },
    { grp: 'loan', en: 'Put some cream on the cookie.', ko: '쿠키에 크림을 좀 올려요.' },
    { grp: 'loan', en: 'Do you have a ticket?', ko: '표 있어요?' },
    { grp: 'loan', en: 'This soup is good.', ko: '이 수프 맛있어요.' },
    { grp: 'loan', en: 'I need a spoon.', ko: '숟가락이 필요해요.' },
    { grp: 'loan', en: 'We watched a video at school.', ko: '학교에서 영상을 봤어요.' },
    { grp: 'mix', en: 'Will you fill the pool?', ko: '수영장에 물 좀 채워 줄래요?' },
    { grp: 'mix', en: 'Sit and eat your food.', ko: '앉아서 밥 먹어요.' },
    { grp: 'mix', en: 'He should read this book.', ko: '그는 이 책을 읽어야 해요.' },
    { grp: 'mix', en: 'She will visit the city.', ko: '그녀는 그 도시에 갈 거예요.' },
    { grp: 'mix', en: 'We could see the ship.', ko: '배가 보였어요.' },
    { grp: 'mix', en: 'Put the cheese in the fridge.', ko: '치즈를 냉장고에 넣어요.' },
    { grp: 'mix', en: 'Look at these little fish.', ko: '이 작은 물고기들 좀 봐요.' },
  ];

  /* ---------- 음성 인식: 들은 말이 목표 낱말인가, 짝 낱말인가 ---------- */
  const SAME = { "who'd": ['whod', 'who would'], luke: ['luke'] };
  const words = s => String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const has = (text, w) => {
    const ws = words(text), t = TL.word(w).toLowerCase(), j = ws.join(' ');
    return ws.indexOf(t) >= 0 || (SAME[t] || []).some(x => x.indexOf(' ') > 0 ? (' ' + j + ' ').indexOf(' ' + x + ' ') >= 0 : ws.indexOf(x) >= 0);
  };
  TL.heard = function (target, alts) {
    const partner = TL.partner(target);
    alts = (alts || []).filter(Boolean);
    if (!alts.length) return { verdict: 'none', heard: '' };
    const top = alts[0];
    if (has(top, target)) return { verdict: 'target', heard: top, partner };
    if (partner && has(top, partner)) return { verdict: 'partner', heard: top, partner };
    const k = alts.findIndex(a => has(a, target));
    if (k > 0) return { verdict: 'maybe', heard: top, rank: k + 1, partner };
    return { verdict: 'other', heard: top, partner };
  };
  TL.HEARD_KO = {
    target: '목표 낱말로 들었어요',
    partner: '짝 낱말로 들었어요',
    maybe: '첫째 후보는 아니지만 후보에 있었어요',
    other: '다른 낱말로 들었어요',
    none: '아무 말도 듣지 못했어요',
  };
  // 내 발음 확인에 쓰는 짝(흔한 낱말 — 음성 인식은 흔한 낱말 쪽으로 기울어요)
  TL.MP_PAIRS = ['sheep-ship', 'leave-live', 'seat-sit', 'feel-fill', 'cheap-chip', 'eat-it', 'heat-hit', 'sleep-slip', 'pool-pull', 'fool-full', 'luke-look']
    .map(id => TL.PAIRS.find(p => p.id === id));

  /* ---------- 따라 말하기: 낱말 맞추기 ---------- */
  const norm = w => w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '');
  TL.compareWords = function (target, heard) {
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
     kind: word(어느 낱말?) · sent(문장 속 어느 낱말?) · same(두 낱말이 같았나?) · vowel(센 음절의 모음은 긴장 · 느슨?)
     a: 정답 보기 번호(0부터) — 엔진이 다시 계산해 맞춰 봐요 */
  TL.DRILL = [
    { kind: 'word', sp: 'um', say: 'chip', opts: ['cheap', 'chip'], a: 1 },
    { kind: 'word', sp: 'uf', say: 'deep', opts: ['deep', 'dip'], a: 0 },
    { kind: 'sent', sp: 'tf', say: 'Can you fill it?', frame: 'Can you ___ it?', opts: ['feel', 'fill'], a: 1, ko: '그거 채워 줄래요?' },
    { kind: 'same', sp: 'tc', say: ['pool', 'pull'], opts: ['같아요', '달라요'], a: 1 },
    { kind: 'word', sp: 'tf', say: 'pull', opts: ['pool', 'pull'], a: 1 },
    { kind: 'vowel', sp: 'um', say: 'chicken', a: 1 },
    { kind: 'word', sp: 'tc', say: 'seat', opts: ['seat', 'sit'], a: 0 },
    { kind: 'sent', sp: 'uf', say: 'Look at that ship!', frame: 'Look at that ___!', opts: ['sheep', 'ship'], a: 1, ko: '저 배 좀 봐요!' },
    { kind: 'word', sp: 'um', say: 'Luke', opts: ['Luke', 'look'], a: 0 },
    { kind: 'same', sp: 'uf', say: ['feet', 'feet'], opts: ['같아요', '달라요'], a: 0 },
    { kind: 'word', sp: 'tf', say: 'rich', opts: ['reach', 'rich'], a: 1 },
    { kind: 'sent', sp: 'um', say: "I didn't want to leave.", frame: "I didn't want to ___.", opts: ['leave', 'live'], a: 0, ko: '떠나고 싶지 않았어요.' },
    { kind: 'word', sp: 'tc', say: 'full', opts: ['fool', 'full'], a: 1 },
    { kind: 'vowel', sp: 'tf', say: 'pizza', a: 0 },
    { kind: 'word', sp: 'uf', say: 'heat', opts: ['heat', 'hit'], a: 0 },
    { kind: 'sent', sp: 'tc', say: "Don't sleep here.", frame: "Don't ___ here.", opts: ['sleep', 'slip'], a: 0, ko: '여기서 자지 마세요.' },
  ];
  TL.vOpts = k => TL.side(k) === 'back' ? ['u', 'ʊ'] : ['i', 'ɪ'];
  TL.DRILL.forEach(q => { if (q.kind === 'vowel') { q.vopts = TL.vOpts(q.say); q.opts = q.vopts.map(TL.vLabel); } });
  // 문제의 목표 낱말(정답 낱말 · 같은가 문제는 첫 낱말)
  TL.drillWord = q => q.kind === 'same' ? q.say[0] : q.kind === 'sent' ? q.opts[q.a] : q.say;
  TL.drillWords = q => q.kind === 'same' ? q.say.slice() : q.kind === 'vowel' ? [q.say] : q.opts.slice();
  // 힌트 = 3단계 발음법
  TL.hints = function (q) {
    if (q.kind === 'vowel') {
      const e = entry(q.say), side = TL.side(q.say);
      return [
        { head: '① 듣고 가르기', text: `센 음절(${TL.syls(q.say)[TL.stressAt(q.say)].sp})의 모음을 들어요. 입꼬리를 당긴 또렷한 ${side === 'front' ? '이' : '우'}인가요, 힘을 뺀 흐린 소리인가요?` },
        { head: '② 입 모양 만들기', text: `${TL.V[side === 'front' ? 'i' : 'u'].ko}: ${TL.V[side === 'front' ? 'i' : 'u'].tip} · ${TL.V[side === 'front' ? 'ɪ' : 'ʊ'].ko}: ${TL.V[side === 'front' ? 'ɪ' : 'ʊ'].tip}.` },
        { head: '③ 낱말 속에서', text: `한글 표기(${e.ko})의 ${side === 'front' ? '이' : '우'}는 두 소리를 가르지 않아요. 사전의 IPA를 확인해요 → ${TL.ipa(q.say)}.` },
      ];
    }
    const [x, y] = q.kind === 'same' ? [q.say[0], TL.partner(q.say[0])] : q.opts;
    const side = TL.side(x), T = TL.V[side === 'front' ? 'i' : 'u'], L = TL.V[side === 'front' ? 'ɪ' : 'ʊ'];
    const pa = TL.pairOf(x);
    const [tw, lw] = pa ? [pa.a, pa.b] : [x, y];
    return [
      { head: '① 듣고 가르기', text: q.kind === 'same' ? '두 낱말의 모음만 견줘요. 둘 다 또렷한가요, 한쪽이 힘이 빠졌나요?' : `모음의 길이보다 소리의 색을 들어요 — 또렷하고 팽팽하면 ${T.v}, 흐리고 힘이 빠지면 ${L.v}.` },
      { head: '② 입 모양 만들기', text: `${tw} → ${T.tip} · ${lw} → ${L.tip}.` },
      { head: '③ 낱말 속에서', text: q.kind === 'sent' ? `문장 속에서도 모음 하나로 뜻이 갈려요. 한국어식으로는 둘 다 ${entry(tw).ko || T.kr}예요.` : `한국어식으로는 둘 다 ${entry(tw).ko || T.kr} — 이 · 우 하나로는 가를 수 없어요.` },
    ];
  };

  /* ---------- 캔버스 글자 모음 (글꼴 미리 받기) ---------- */
  TL.allText = () => Object.values(DICT).map(e => e.w + e.raw + e.ipa + e.ko + e.gloss).join('') +
    TL.SENT.map(s => s.en + s.ko).join('') + Object.values(TL.SGRP).map(g => g.ko + g.long).join('') +
    TL.LROWS.map(r => r.ko).join('') + Object.values(TL.V).map(v => v.ko + v.tip + v.kr).join('') +
    TL.VOICES.map(v => v.ko + v.who).join('') + TL.DRILL.map(q => (q.frame || '') + (q.ko || '')).join('') + '이우에어ㅣㅜ';

  /* ---------- 데이터 점검 ---------- */
  TL.check = function () {
    const warn = [];
    const w = m => warn.push(m);
    Object.values(DICT).forEach(e => {
      if (e.spell.length !== e.syl.length) w(`${e.key}: 철자 음절 ${e.spell.length}개 ≠ IPA 음절 ${e.syl.length}개`);
      if (e.spell.join('').toLowerCase() !== e.w.toLowerCase()) w(`${e.key}: 철자를 이으면 ${e.spell.join('')}`);
      if (e.syl.filter(s => s.st === 1).length !== 1) w(`${e.key}: 센 음절이 하나가 아님`);
      e.syl.forEach((s, i) => { const n = phones(s.ipa).filter(isV).length; if (n !== 1) w(`${e.key}: ${i + 1}째 음절의 모음이 ${n}개`); });
      // [ ]는 센 음절에 하나, 센 음절의 모음은 i · ɪ · u · ʊ, [ ] 안은 모음 글자
      const v = TL.vowel(e.key);
      if (!TL.isTarget(v)) w(`${e.key}: 센 음절의 모음 ${v}가 i · ɪ · u · ʊ가 아님`);
      const marks = e.syl.map(s => (s.raw.match(/\[[^\]]*\]/g) || []).length);
      if (marks.reduce((a, b) => a + b, 0) !== 1 || marks[TL.stressAt(e.key)] !== 1) w(`${e.key}: [ ]가 센 음절에 하나가 아님`);
      TL.spellSegs(e.key).filter(s => s.role).forEach(s => { if (!/^[aeiouyw]+$/i.test(s.t)) w(`${e.key}: [${s.t}] 안에 모음 글자가 아닌 것`); });
      if (e.grp.indexOf('sw') < 0 && !e.ko) w(`${e.key}: 한국어식 표기 없음`);
      if (e.ko && !TL.koVowelOk(e.key)) w(`${e.key}: 한국어식 ${e.ko}에 ${TL.side(e.key) === 'front' ? 'ㅣ' : 'ㅜ · ㅠ'}가 없음`);
    });
    // 짝: 센 음절의 모음 하나만 다르고(a 긴장 · b 느슨), 한국어식으로는 같아짐
    const seen = {};
    TL.PAIRS.forEach(p => {
      if (!entry(p.a) || !entry(p.b)) { w(`짝 ${p.id}: 사전에 없음`); return; }
      const d = TL.pairDiff(p.a, p.b);
      if (!d) w(`짝 ${p.id}: 모음 하나(i ↔ ɪ · u ↔ ʊ)만 다른 짝이 아님`);
      else if (!TL.V[d.a].tense || d.at !== TL.vIndex(p.a)) w(`짝 ${p.id}: a가 긴장한 모음이 아니거나 센 음절이 아님`);
      if (!TL.koSame(p.a, p.b)) w(`짝 ${p.id}: 한국어식 표기가 같지 않음`);
      if (!TL.inGrp(p.a, p.side === 'front' ? 'pi' : 'pu') || !TL.inGrp(p.b, p.side === 'front' ? 'pi' : 'pu')) w(`짝 ${p.id}: 묶음 pi · pu`);
      [p.a, p.b].forEach(k => { if (seen[k]) w(`${k}: 짝 둘에 들어 있음`); seen[k] = 1; });
    });
    ['pi', 'pu'].forEach(g => TL.byGrp(g).forEach(k => { if (!TL.pairOf(k)) w(`${k}: 묶음 ${g}인데 짝이 없음`); }));
    const hvd = TL.byGrp('hvd');
    if (hvd.map(TL.vowel).sort().join('') !== ['i', 'u', 'ɪ', 'ʊ'].sort().join('')) w('모음 지도 낱말(h_d): 네 모음이 하나씩이 아님');
    hvd.forEach(k => { const e = entry(k); if (e.ph[0] !== 'h' || e.ph[e.ph.length - 1] !== 'd' || e.ph.length !== 3) w(`${k}: h + 모음 + d가 아님`); });
    TL.LEN.forEach(k => { if (!TL.inGrp(k, 'len')) w(`길이 낱말 ${k}: 묶음 len이 아님`); });
    if (!(TL.afterVoiced('bead') && !TL.afterVoiced('beat'))) w('길이 낱말: bead · beat의 끝소리');
    // 외래어 줄: 줄의 모음 = 엔진이 계산한 센 음절의 모음
    TL.LOAN.forEach(o => {
      if (!entry(o.w)) { w(`외래어 ${o.w}: 사전에 없음`); return; }
      if (TL.vowel(o.w) !== o.row) w(`외래어 ${o.w}: 줄 ${o.row} ≠ 엔진 ${TL.vowel(o.w)}`);
      if (!TL.inGrp(o.w, 'loan')) w(`외래어 ${o.w}: 묶음 loan이 아님`);
    });
    // 문장: 칠할 낱말이 둘 이상, 묶음마다 일곱, 짝 묶음 문장에는 긴장 · 느슨이 함께
    TL.SENT.forEach((s, i) => {
      const n = TL.countIn(s.en);
      if (TL.wordsIn(s.en).length < 2) w(`문장 ${i + 1}: 칠할 낱말이 둘보다 적음`);
      if (s.grp === 'front' && !(n.i && n['ɪ'])) w(`문장 ${i + 1}: i · ɪ가 함께 있지 않음`);
      if (s.grp === 'back' && !(n.u + n['ʊ'] >= 2 && n['ʊ'])) w(`문장 ${i + 1}: u · ʊ 문장이 아님`);
      if (s.grp === 'loan' && !TL.wordsIn(s.en).some(k => TL.inGrp(k, 'loan'))) w(`문장 ${i + 1}: 외래어가 없음`);
      if (s.grp === 'mix' && !((n.i + n.u) && (n['ɪ'] + n['ʊ']))) w(`문장 ${i + 1}: 긴장 · 느슨이 섞이지 않음`);
    });
    const grp = {}; TL.SENT.forEach(s => { grp[s.grp] = (grp[s.grp] || 0) + 1; });
    TL.SGRP_ORDER.forEach(g => { if (grp[g] !== 7) w(`문장 묶음 ${g}: ${grp[g] || 0}개`); });
    // 연습 문제: 엔진의 정답과 같은지, 정답 위치, 목소리
    const pos = [0, 0], vc = {};
    TL.DRILL.forEach((q, k) => {
      pos[q.a]++; vc[q.sp] = (vc[q.sp] || 0) + 1;
      if (q.kind === 'word' || q.kind === 'sent') {
        if (TL.partner(q.opts[0]) !== q.opts[1]) w(`연습 ${k + 1}: 보기가 짝이 아님`);
        const p = TL.pairOf(q.opts[0]);
        if (p && (q.opts[0] !== p.a)) w(`연습 ${k + 1}: 보기 차례(긴장 → 느슨)`);
      }
      if (q.kind === 'word' && q.opts[q.a] !== q.say) w(`연습 ${k + 1}: 정답 ≠ 들려주는 낱말`);
      if (q.kind === 'sent') {
        if (q.frame.replace('___', q.opts[q.a]) !== q.say) w(`연습 ${k + 1}: 문장과 정답이 맞지 않음`);
        if (!TL.wordsIn(q.say).length) w(`연습 ${k + 1}: 칠할 낱말이 없음`);
      }
      if (q.kind === 'same') {
        const same = q.say[0] === q.say[1];
        if (!same && TL.partner(q.say[0]) !== q.say[1]) w(`연습 ${k + 1}: 두 낱말이 짝이 아님`);
        if ((same ? 0 : 1) !== q.a) w(`연습 ${k + 1}: 같아요 · 달라요 정답`);
      }
      if (q.kind === 'vowel') {
        if (!entry(q.say)) w(`연습 ${k + 1}: ${q.say} 사전에 없음`);
        else if (q.vopts[q.a] !== TL.vowel(q.say)) w(`연습 ${k + 1}: 모음 ${q.vopts[q.a]} ≠ 엔진 ${TL.vowel(q.say)}`);
      }
      if (['tc', 'tf', 'uf', 'um'].indexOf(q.sp) < 0) w(`연습 ${k + 1}: 목소리 ${q.sp}`);
    });
    if (Math.abs(pos[0] - pos[1]) > 1) w(`정답 위치가 한쪽으로 몰림: ${pos.join(' / ')}`);
    if (Object.values(vc).some(n => n !== 4)) w(`연습 문제의 목소리가 고르지 않음: ${JSON.stringify(vc)}`);
    TL.MP_PAIRS.forEach((p, i) => { if (!p) w(`내 발음 확인 짝 ${i + 1}: 짝 목록에 없음`); });
    // 입 그림: 네 모음 모두 혀가 닿지 않고, 긴장한 쪽이 혀가 더 높고, u가 ʊ보다 입술을 더 모아요
    if (window.EN && EN.mouth && EN.mouth.POSES.ih && EN.mouth.POSES.uh) {
      const P = EN.mouth.POSES, C = EN.mouth.contact;
      ['i', 'ih', 'u', 'uh'].forEach(k => { if (C(k).touch) w(`입 그림 ${k}: 혀가 입천장에 닿음`); });
      const hi = (p, keys) => Math.min(...keys.map(k => P[p][k][1]));
      if (!(hi('i', ['F', 'D']) < hi('ih', ['F', 'D']))) w('입 그림: i의 혀 앞이 ɪ보다 높지 않음');
      if (!(hi('u', ['D', 'K']) < hi('uh', ['D', 'K']))) w('입 그림: u의 혀 뒤가 ʊ보다 높지 않음');
      if (!(P.u.round > P.uh.round && P.uh.round > P.ih.round)) w('입 그림: 입술 모으기 u > ʊ > ɪ가 아님');
      if (!(P.ih.jaw > P.i.jaw && P.uh.jaw > P.u.jaw)) w('입 그림: 느슨한 모음의 턱이 더 내려가지 않음');
    } else w('입 그림: 느슨한 모음 자세(ih · uh)가 없음');
    warn.forEach(m => console.warn('[TL.check] ' + m));
    return warn.length;
  };
})();
