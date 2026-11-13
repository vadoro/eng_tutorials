/* 없는 ‘으’를 넣지 마세요 — 끝소리와 자음 묶음: 규칙 엔진 (FC)
 * 낱말마다 넓은 IPA(음절은 . · 센 음절 ˈ)와 철자(음절은 . · 모음 없이 이어지는 자음 글자는 [ ])를 손으로 적었어요.
 * 엔진은 이 두 가지에서 음절 수(= 모음 소리 수) · 끝 자음과 자음 묶음 · 소리의 모양(CCCVC) · 한국어식 표기에 넣은 ‘으’와
 * 음절 수 · -ed · -s의 끝소리(t · d · ɪd, s · z · ɪz) · 끝 유성 · 무성 짝 · ‘으’를 넣으면 다른 낱말이 되는 짝 ·
 * 문장 속 칠하기와 이어 말하기 자리를 계산해요. 손으로 적은 IPA는 misaki 미국 발음 사전과 따로 맞춰 봤어요(README).
 * 소리를 듣지 않아요 — 소리 덩어리 · 모음 길이는 미리 만든 음성 파일을 따로 재서(audio/dialogue/measure.js) 그려요.
 */
(function () {
  'use strict';
  const FC = (window.FC = {});

  /* ---------- 소리 단위 ---------- */
  const VOW = ['aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'i', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ə', 'ɚ', 'ɝ', 'ɑ', 'ɔ', 'ʊ', 'u'];
  const CON = ['tʃ', 'dʒ', 'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j'];
  const UNITS = VOW.concat(CON).sort((a, b) => b.length - a.length);
  const isV = p => VOW.indexOf(p) >= 0;
  FC.isV = isV;
  function phones(s) {
    s = String(s).replace(/[ˈˌ.]/g, '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const u = UNITS.find(x => s.startsWith(x, i));
      if (!u) throw new Error(`[FC] 모르는 소리 ${s[i]} (${s})`);
      out.push(u); i += u.length;
    }
    return out;
  }
  FC.phones = phones;
  // 끝 유성 · 무성 짝 (목이 울리는 쪽 → 울리지 않는 쪽)
  const VOICED = { b: 'p', d: 't', g: 'k', v: 'f', z: 's', ʒ: 'ʃ', dʒ: 'tʃ', ð: 'θ' };
  const VOICELESS = {};
  Object.keys(VOICED).forEach(k => { VOICELESS[VOICED[k]] = k; });
  FC.VOICED = VOICED;
  FC.isVoicedObs = p => !!VOICED[p];
  FC.isVoicelessObs = p => !!VOICELESS[p];
  // 한국어식 표기에서 음절 하나가 더 생기는 이중모음(아이 · 에이 · 오이 · 아우). oʊ는 ‘오’ 하나로 적어요
  const DIPH2 = ['aɪ', 'eɪ', 'ɔɪ', 'aʊ'];
  const SIB = ['s', 'z', 'ʃ', 'ʒ', 'tʃ', 'dʒ'];

  /* ---------- 발음 사전 ----------
     낱말|철자(음절 . · 모음 없이 이어지는 자음 글자 [ ])|IPA(음절 . · 센 음절 ˈ)|한국어식 표기|뜻|묶음(쉼표로 여럿)
     묶음: loan 외래어 · end1 끝 자음 하나 · endcl 끝 자음 묶음 · oncl 앞 자음 묶음 · both 앞뒤 · 가운데에도 묶음
           ed · s 끝이 붙은 꼴 · base 끝이 붙기 전 · vpair 끝 유성 · 무성 짝 · epair ‘으’를 넣으면 다른 낱말이 되는 짝
     한국어식 표기: 외래어는 흔히 쓰는 표기, 외래어가 아닌 낱말은 한국어식으로 읽은 소리(예: asked → 애스크드) */
  const DICT_SRC = `bus|bu[s]|bʌs|버스|버스|loan,end1
bed|be[d]|bɛd|베드|침대|loan,end1,vpair
cake|ca[k]e|keɪk|케이크|케이크|loan,end1
note|no[t]e|noʊt|노트|공책 · 메모|loan,end1
milk|mi[lk]|mɪlk|밀크|우유|loan,endcl
desk|de[sk]|dɛsk|데스크|책상|loan,endcl
test|te[st]|tɛst|테스트|시험|loan,endcl
mask|ma[sk]|mæsk|마스크|마스크|loan,endcl
club|[cl]u[b]|klʌb|클럽|동아리 · 클럽|loan,oncl
glass|[gl]a[ss]|glæs|글라스|유리잔|loan,oncl
stress|[str]e[ss]|strɛs|스트레스|스트레스|loan,oncl
strike|[str]i[k]e|straɪk|스트라이크|스트라이크 · 파업|loan,oncl
sports|[sp]or[ts]|spɔrts|스포츠|운동 경기|loan,both
brand|[br]a[nd]|brænd|브랜드|상표|loan,both
Christmas|[Chr]i[st].ma[s]|ˈkrɪs.məs|크리스마스|크리스마스|loan,both
McDonald's|Mc.Do.na[ld's]|mək.ˈdɑ.nəldz|맥도날드|맥도날드|loan,both
worked|wor[ked]|wɝkt|워크드|일했다|ed
wanted|wan.te[d]|ˈwɑn.tɪd|원티드|원했다|ed
played|[pl]aye[d]|pleɪd|플레이드|놀았다 · 했다|ed
needed|nee.de[d]|ˈni.dɪd|니디드|필요했다|ed
asked|a[sked]|æskt|애스크드|물었다|ed
stopped|[st]o[pped]|stɑpt|스톱드|멈췄다|ed
watched|wa[tched]|wɑtʃt|워치드|보았다|ed
loved|lo[ved]|lʌvd|러브드|사랑했다|ed
started|[st]ar.te[d]|ˈstɑr.tɪd|스타티드|시작했다|ed
helped|he[lped]|hɛlpt|헬프드|도왔다|ed
liked|li[ked]|laɪkt|라이크드|좋아했다|ed
decided|de.ci.de[d]|də.ˈsaɪ.dɪd|디사이디드|정했다|ed
cats|ca[ts]|kæts|캣츠|고양이들|s
dogs|do[gs]|dɔgz|도그즈|개들|s
books|boo[ks]|bʊks|북스|책들|s
months|mo[nths]|mʌnθs|먼스|달 · 개월(여럿)|s
texts|te[xts]|tɛksts||문자를 보내요|s
desks|de[sks]|dɛsks||책상들|s
buses|bu.se[s]|ˈbʌ.sɪz||버스들|s
watches|wa.tche[s]|ˈwɑ.tʃɪz||시계들 · 봐요|s
work|wor[k]|wɝk||일하다|base
want|wa[nt]|wɑnt||원하다|base
play|[pl]ay|pleɪ||놀다 · 하다|base
need|nee[d]|nid||필요하다|base
ask|a[sk]|æsk||묻다|base
stop|[st]o[p]|stɑp||멈추다|base
watch|wa[tch]|wɑtʃ||보다|base
love|lo[v]e|lʌv||사랑하다|base
start|[st]ar[t]|stɑrt||시작하다|base
help|he[lp]|hɛlp||돕다|base
like|li[k]e|laɪk||좋아하다|base
decide|de.ci[d]e|də.ˈsaɪd||정하다|base
cat|ca[t]|kæt||고양이|base
dog|do[g]|dɔg||개|base
book|boo[k]|bʊk||책|base
month|mo[nth]|mʌnθ||달 · 개월|base
text|te[xt]|tɛkst||문자 · 글|base
bag|ba[g]|bæg||가방|vpair
back|ba[ck]|bæk||뒤 · 등|vpair
cab|ca[b]|kæb||택시|vpair
cap|ca[p]|kæp||모자|vpair
bet|be[t]|bɛt||내기|vpair
seed|see[d]|sid||씨앗|vpair
seat|sea[t]|sit||자리|vpair
pig|pi[g]|pɪg||돼지|vpair
pick|pi[ck]|pɪk||고르다|vpair
prize|[pr]i[z]e|praɪz||상|vpair
price|[pr]i[c]e|praɪs||값|vpair
eyes|eye[s]|aɪz||눈(둘)|vpair
ice|i[c]e|aɪs||얼음|vpair
leave|lea[v]e|liv||떠나다 · 두고 가다|vpair
leaf|lea[f]|lif||나뭇잎|vpair
sport|[sp]or[t]|spɔrt||운동 경기|epair
support|sup.por[t]|sə.ˈpɔrt||지지 · 도움|epair
blow|[bl]ow|bloʊ||불다|epair
below|be.low|bə.ˈloʊ||아래에|epair
prayed|[pr]aye[d]|preɪd||기도했다|epair
parade|pa.ra[d]e|pə.ˈreɪd||행진|epair
plight|[pl]igh[t]|plaɪt||곤경|epair
polite|po.li[t]e|pə.ˈlaɪt||공손한|epair
claps|[cl]a[ps]|klæps||손뼉을 쳐요|epair
collapse|col.la[ps]e|kə.ˈlæps||무너지다|epair
street|[str]ee[t]|strit|스트리트|거리|other
check|che[ck]|tʃɛk|체크|확인하다|other
break|[br]ea[k]|breɪk|브레이크|쉬는 시간|other
cream|[cr]ea[m]|krim|크림|크림|other`;

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
  FC.DICT = DICT;
  const entry = k => DICT[k] || DICT[LOWER[String(k).toLowerCase()]] || null;
  FC.entry = entry;
  FC.word = k => (entry(k) || { w: k }).w;
  FC.ipa = k => { const e = entry(k); return e ? '/' + e.ipa.replace(/\./g, '') + '/' : ''; };
  FC.inGrp = (k, g) => { const e = entry(k); return !!e && e.grp.indexOf(g) >= 0; };
  FC.byGrp = g => Object.values(DICT).filter(e => e.grp.indexOf(g) >= 0).map(e => e.key);

  /* ---------- 음절 · 끝 자음 · 자음 묶음 ---------- */
  FC.nSyl = k => { const e = entry(k); return e ? e.ph.filter(isV).length : 0; };
  FC.syls = k => (entry(k) || { syl: [] }).syl;
  FC.stressAt = k => Math.max(0, FC.syls(k).findIndex(s => s.st === 1));
  // 끝 자음: 마지막 모음 뒤의 자음(모음 바로 뒤의 r은 r 모음이라 빼요 — card · sports)
  FC.coda = k => {
    const e = entry(k); if (!e) return [];
    let i = e.ph.length - 1;
    while (i >= 0 && !isV(e.ph[i])) i--;
    const c = e.ph.slice(i + 1);
    return c[0] === 'r' ? c.slice(1) : c;
  };
  FC.onset = k => { const e = entry(k); if (!e) return []; const i = e.ph.findIndex(isV); return e.ph.slice(0, i); };
  // 모음 사이의 자음 묶음(Christmas의 s.m) — 가운데 자리
  FC.medial = k => {
    const e = entry(k), out = [];
    if (!e) return out;
    let run = [];
    let seenV = false;
    e.ph.forEach(p => {
      if (isV(p)) { if (seenV && run.length >= 2 && !(run.length === 2 && run[0] === 'r')) out.push(run.slice()); run = []; seenV = true; }
      else if (seenV) run.push(p);
    });
    return out;
  };
  FC.final = k => { const c = FC.coda(k); return c[c.length - 1] || ''; };
  // 소리의 모양: 자음 C · 모음 V (strike → CCCVC)
  FC.shape = k => { const e = entry(k); return e ? e.ph.map(p => isV(p) ? 'V' : 'C').join('') : ''; };
  // 낱말의 묶음(놀이터 기록 · 힌트): 끝 자음 하나 · 끝 묶음 · 앞 묶음 · -ed · -s
  const KIND = { end1: '끝 자음 하나', endcl: '끝 자음 묶음', oncl: '앞 자음 묶음', both: '앞뒤로 묶음', ed: '-ed 꼴', s: '-s 꼴' };
  FC.KIND = KIND;
  FC.kindOf = k => {
    const e = entry(k); if (!e) return 'end1';
    if (e.grp.indexOf('ed') >= 0) return 'ed';
    if (e.grp.indexOf('s') >= 0) return 's';
    const on = FC.onset(k).length, cd = FC.coda(k).length;
    if (on >= 2 && (cd >= 2 || FC.medial(k).length || FC.nSyl(k) > 1)) return 'both';
    if (on >= 2) return 'oncl';
    return cd >= 2 ? 'endcl' : 'end1';
  };
  const ORD = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
  FC.ord = i => ORD[i] || `${i + 1}째`;
  const NUMKO = ['', '한', '두', '세', '네', '다섯', '여섯'];
  FC.nKo = n => NUMKO[n] || String(n);
  FC.beats = n => `${FC.nKo(n)} 박자`;

  /* ---------- 철자 칠하기: [ ] 안의 글자 = 모음 없이 이어지는 자음 ----------
     spellSegs(k) → [{ t, bare: true | false, i: 음절 }] */
  FC.spellSegs = k => {
    const e = entry(k), out = [];
    if (!e) return [{ t: String(k), bare: false }];
    e.syl.forEach((s, i) => {
      String(s.raw).split(/(\[[^\]]*\])/).forEach(t => {
        if (!t) return;
        if (t[0] === '[') out.push({ t: t.slice(1, -1), bare: true, i });
        else out.push({ t, bare: false, i });
      });
    });
    return out;
  };

  /* ---------- 한국어식 표기: 넣은 ‘으’ · 이중모음이 나뉜 음절 ---------- */
  function hangul(ko) {
    return [...String(ko)].filter(c => /[가-힣]/.test(c)).map(ch => {
      const c = ch.charCodeAt(0) - 0xAC00;
      return { ch, on: Math.floor(c / 588), v: Math.floor((c % 588) / 28), coda: c % 28 };
    });
  }
  FC.hangul = hangul;
  FC.koSyl = k => { const e = entry(k); return e && e.ko ? hangul(e.ko).length : 0; };
  FC.diphCount = k => { const e = entry(k); return e ? e.ph.filter(p => DIPH2.indexOf(p) >= 0).length : 0; };
  // 한국어식 음절마다 역할: 'ins' 넣은 모음(ㅡ, 또는 sh · ch · j 뒤의 ㅣ) · 'diph' 이중모음의 뒤 조각(이 · 우) · null
  FC.koParts = k => {
    const e = entry(k);
    if (!e || !e.ko) return [];
    const H = hangul(e.ko), role = H.map(() => null);
    H.forEach((h, i) => { if (h.v === 18) role[i] = 'ins'; });
    // sh · ch · j(ʃ · tʃ · dʒ) 뒤에 모음이 없으면 한국어식은 ‘시 · 치 · 지’로 적어요 — 뒤에서부터 그 수만큼
    let m = 0;
    e.ph.forEach((p, i) => { if (['ʃ', 'tʃ', 'dʒ'].indexOf(p) >= 0 && !isV(e.ph[i + 1] || '')) m++; });
    for (let i = H.length - 1; i >= 0 && m > 0; i--) if (!role[i] && [9, 12, 14].indexOf(H[i].on) >= 0 && H[i].v === 20) { role[i] = 'ins'; m--; }
    // 이중모음의 뒤 조각: 받침 없는 음절 다음의 ‘이 · 우’(ㅇ 첫소리)
    let d = FC.diphCount(k);
    for (let i = 1; i < H.length && d > 0; i++) if (!role[i] && H[i].on === 11 && (H[i].v === 20 || H[i].v === 13) && H[i - 1].coda === 0) { role[i] = 'diph'; d--; }
    return H.map((h, i) => ({ ch: h.ch, role: role[i] }));
  };
  FC.koInserted = k => FC.koParts(k).map((p, i) => p.role === 'ins' ? i : -1).filter(i => i >= 0);
  FC.koNote = k => {
    const n = FC.nSyl(k), m = FC.koSyl(k), ins = FC.koInserted(k).length;
    return `한국어식 ${m}박자(넣은 으 ${ins}) → 영어 ${n}박자`;
  };

  /* ---------- -ed · -s의 끝소리: 앞 소리에 따라 셋 ----------
     -ed: t · d 뒤 → ɪd(한 박자 더) · 목이 울리지 않는 소리 뒤 → t · 그 밖(모음 · 울리는 소리) → d
     -s : s · z · sh · ch · j 뒤 → ɪz(한 박자 더) · 울리지 않는 소리 뒤 → s · 그 밖 → z */
  FC.ending = (base, kind) => {
    const e = entry(base); if (!e) return null;
    const last = e.ph[e.ph.length - 1];
    if (kind === 'ed') {
      if (last === 't' || last === 'd') return { snd: 'ɪd', extra: 1, why: 'td' };
      return VOICELESS[last] ? { snd: 't', extra: 0, why: 'voiceless' } : { snd: 'd', extra: 0, why: 'voiced' };
    }
    if (SIB.indexOf(last) >= 0) return { snd: 'ɪz', extra: 1, why: 'sib' };
    return VOICELESS[last] ? { snd: 's', extra: 0, why: 'voiceless' } : { snd: 'z', extra: 0, why: 'voiced' };
  };
  FC.END_WHY = {
    td: '앞 소리 = t · d → [ɪd], 한 박자 더',
    sib: '앞 소리 = s · z · sh · ch · j → [ɪz], 한 박자 더',
    voiceless: '앞 소리 = 목이 울리지 않는 소리(p · k · f · s · sh · ch …)',
    voiced: '앞 소리 = 모음이나 목이 울리는 소리',
  };
  // 끝이 붙은 꼴과 그 바탕 낱말
  FC.INFL = [
    ['worked', 'work', 'ed'], ['wanted', 'want', 'ed'], ['played', 'play', 'ed'], ['needed', 'need', 'ed'],
    ['asked', 'ask', 'ed'], ['stopped', 'stop', 'ed'], ['watched', 'watch', 'ed'], ['loved', 'love', 'ed'],
    ['started', 'start', 'ed'], ['helped', 'help', 'ed'], ['liked', 'like', 'ed'], ['decided', 'decide', 'ed'],
    ['cats', 'cat', 's'], ['dogs', 'dog', 's'], ['books', 'book', 's'], ['months', 'month', 's'],
    ['texts', 'text', 's'], ['desks', 'desk', 's'], ['buses', 'bus', 's'], ['watches', 'watch', 's'],
  ].map(([form, base, kind]) => ({ form, base, kind }));
  FC.inflOf = k => FC.INFL.find(x => x.form === k) || null;
  FC.endingOf = k => { const x = FC.inflOf(k); return x ? FC.ending(x.base, x.kind) : null; };
  FC.ENDOPTS = { ed: ['t', 'd', 'ɪd'], s: ['s', 'z', 'ɪz'] };

  /* ---------- 끝 유성 · 무성 짝: 목이 울리는 끝 자음 앞의 모음이 더 길어요 ----------
     a = 목이 울리는 끝(긴 모음, 보라) · b = 울리지 않는 끝(짧은 모음, 하늘) */
  FC.VPAIRS = [['bag', 'back'], ['cab', 'cap'], ['bed', 'bet'], ['seed', 'seat'], ['pig', 'pick'], ['prize', 'price'], ['eyes', 'ice'], ['leave', 'leaf']]
    .map(([a, b]) => ({ id: a + '-' + b, a, b, kind: 'voice' }));
  // ‘으’를 넣으면 다른 낱말: a = 묶음(짧은 쪽) · b = 모음이 하나 더 있는 쪽
  FC.EPAIRS = [['sport', 'support'], ['blow', 'below'], ['prayed', 'parade'], ['plight', 'polite'], ['claps', 'collapse']]
    .map(([a, b]) => ({ id: a + '-' + b, a, b, kind: 'ins' }));
  FC.PAIRS = FC.VPAIRS.concat(FC.EPAIRS);
  FC.pairOf = k => FC.PAIRS.find(p => p.a === k || p.b === k) || null;
  FC.partner = k => { const p = FC.pairOf(k); return p ? (p.a === k ? p.b : p.a) : null; };
  // 두 낱말의 소리가 끝 자음 하나의 유성 · 무성만 다른가
  FC.voiceDiff = (a, b) => {
    const A = entry(a).ph, B = entry(b).ph;
    if (A.length !== B.length) return null;
    const d = A.map((p, i) => p === B[i] ? -1 : i).filter(i => i >= 0);
    if (d.length !== 1 || d[0] !== A.length - 1) return null;
    return VOICED[A[d[0]]] === B[d[0]] ? { at: d[0], voiced: A[d[0]], voiceless: B[d[0]] } : null;
  };
  // b의 소리가 a의 첫 자음 뒤에 모음(ə · ɪ) 하나를 넣은 것인가
  FC.insDiff = (a, b) => {
    const A = entry(a).ph, B = entry(b).ph;
    if (B.length !== A.length + 1) return null;
    for (let i = 1; i < B.length; i++) {
      if ((B[i] === 'ə' || B[i] === 'ɪ') && B.slice(0, i).concat(B.slice(i + 1)).join(' ') === A.join(' ')) return { at: i, v: B[i] };
    }
    return null;
  };

  // 음절 공의 그림용 기본값(잰 값이 없을 때): L 길이 · A 크기 · ins 넣은 모음 · diph 이중모음의 뒤 조각
  FC.schematic = k => FC.syls(k).map(s => s.st === 1 ? { L: 1, A: 1 } : { L: 0.55, A: 0.6 });
  FC.koSchematic = k => FC.koParts(k).map(p => p.role === 'ins' ? { L: 0.62, A: 0.62, ins: true } : p.role === 'diph' ? { L: 0.7, A: 0.72, diph: true } : { L: 0.9, A: 0.9 });

  /* ---------- 목소리 넷 (박자 세기 · 연습 문제) ---------- */
  FC.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '미국 여성' },
    { sp: 'tf', ko: '차분한 선생님', who: '미국 여성' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];

  /* ---------- 외래어 카드 열여섯 ---------- */
  const LOAN_ROWS = [
    ['end1', '끝 자음 하나', ['bus', 'bed', 'cake', 'note']],
    ['endcl', '끝 자음 묶음', ['milk', 'desk', 'test', 'mask']],
    ['oncl', '앞 자음 묶음', ['club', 'glass', 'stress', 'strike']],
    ['both', '앞뒤 · 가운데에도', ['sports', 'brand', 'Christmas', "McDonald's"]],
  ];
  FC.LROWS = LOAN_ROWS.map(([id, ko, words]) => ({ id, ko, words }));
  FC.LOAN = [];
  FC.LROWS.forEach(r => r.words.forEach(w => FC.LOAN.push({ w, row: r.id })));

  /* ---------- 문장 속에서: 사전에 있는 낱말의 [ ] 글자와 이어 말하기 자리 ----------
     segs(text) → [{ t, role: 'bare' | 'end' | null, w, link: true(다음 낱말의 모음으로 이어짐) }]
     이어 말하기: 자음으로 끝나는 낱말 + 모음 글자로 시작하는 다음 낱말(hour · honest처럼 h가 소리 나지 않는 낱말도) */
  const VSTART = /^(?:[aeiou]|hour|honest)/i;
  const NOT_VSTART = /^(?:u[nst]i|use|usu|one|once|eu)/i;
  const startsVowel = w => VSTART.test(w) && !NOT_VSTART.test(w);
  FC.startsVowel = startsVowel;
  FC.segs = function (text) {
    const out = [];
    const toks = String(text).split(/([A-Za-z]+(?:['’][A-Za-z]+)?)/);
    toks.forEach((tok, ti) => {
      if (!tok) return;
      const k = LOWER[tok.toLowerCase().replace('’', "'")];
      const e = k ? DICT[k] : null;
      if (!/[A-Za-z]/.test(tok)) { out.push({ t: tok, role: null }); return; }
      let link = false;
      if (e && FC.coda(k).length) {
        const sep = toks[ti + 1] || '', nx = toks[ti + 2] || '';
        link = /^ +$/.test(sep) && startsVowel(nx);
      }
      if (!e || e.raw.replace(/[[\]]/g, '').toLowerCase() !== tok.toLowerCase()) { out.push({ t: tok, role: null }); return; }
      let at = 0;
      const parts = FC.spellSegs(k);
      parts.forEach((p, i) => {
        const t = tok.slice(at, at + p.t.length); at += p.t.length;
        out.push({ t, role: p.bare ? 'bare' : null, w: e.key, link: link && i === parts.length - 1 });
      });
    });
    return out;
  };
  FC.wordsIn = text => { const seen = []; FC.segs(text).forEach(s => { if (s.w && seen.indexOf(s.w) < 0) seen.push(s.w); }); return seen; };
  FC.links = text => FC.segs(text).filter(s => s.link).map(s => s.w);

  /* ---------- 따라 말하기 28문장 (묶음마다 일곱) ---------- */
  FC.SGRP = {
    end: { ko: '끝 자음', long: '끝 자음 — 닫고 멈추기 · 다음 모음에 이어 말하기' },
    cluster: { ko: '자음 묶음', long: '자음 묶음 — 자음과 자음 사이에 ‘으’ 없이' },
    infl: { ko: '-ed · -s', long: '-ed · -s — 한 박자가 느는 곳은 t · d 뒤 [ɪd], s · ch 뒤 [ɪz]' },
    voice: { ko: '끝 유성 · 무성', long: '끝 유성 · 무성 — 목이 울리는 끝 앞에서는 모음을 길게' },
  };
  FC.SGRP_ORDER = ['end', 'cluster', 'infl', 'voice'];
  FC.SENT = [
    { grp: 'end', en: 'Can I have some milk?', ko: '우유 좀 주실래요?' },
    { grp: 'end', en: 'I left my bag on the bus.', ko: '버스에 가방을 두고 내렸어요.' },
    { grp: 'end', en: 'Put it on the desk.', ko: '책상 위에 놓아 주세요.' },
    { grp: 'end', en: 'Let me check it again.', ko: '다시 확인해 볼게요.' },
    { grp: 'end', en: 'We had a test in English.', ko: '영어 시험을 봤어요.' },
    { grp: 'end', en: 'I wrote a note on it.', ko: '그 위에 메모를 적었어요.' },
    { grp: 'end', en: "Let's take a break.", ko: '잠깐 쉬어요.' },
    { grp: 'cluster', en: 'The street is very busy.', ko: '거리가 아주 붐벼요.' },
    { grp: 'cluster', en: "I'm under a lot of stress.", ko: '스트레스를 많이 받고 있어요.' },
    { grp: 'cluster', en: 'Can I have a glass of water?', ko: '물 한 잔 주실래요?' },
    { grp: 'cluster', en: 'She plays sports every weekend.', ko: '그녀는 주말마다 운동해요.' },
    { grp: 'cluster', en: 'Merry Christmas!', ko: '메리 크리스마스!' },
    { grp: 'cluster', en: 'I joined a book club.', ko: '독서 동아리에 들었어요.' },
    { grp: 'cluster', en: 'Do you want some ice cream?', ko: '아이스크림 먹을래요?' },
    { grp: 'infl', en: 'I worked late last night.', ko: '어젯밤 늦게까지 일했어요.' },
    { grp: 'infl', en: 'She wanted to go home.', ko: '그녀는 집에 가고 싶어 했어요.' },
    { grp: 'infl', en: 'We played tennis yesterday.', ko: '어제 테니스를 쳤어요.' },
    { grp: 'infl', en: 'He asked a question.', ko: '그가 질문을 했어요.' },
    { grp: 'infl', en: 'The buses are late today.', ko: '오늘은 버스들이 늦어요.' },
    { grp: 'infl', en: 'My cats are afraid of dogs.', ko: '우리 고양이들은 개를 무서워해요.' },
    { grp: 'infl', en: 'It took three months.', ko: '석 달이 걸렸어요.' },
    { grp: 'voice', en: 'Put it in the bag.', ko: '가방에 넣어요.' },
    { grp: 'voice', en: "I'll be right back.", ko: '금방 돌아올게요.' },
    { grp: 'voice', en: 'Is this seat taken?', ko: '이 자리 주인 있어요?' },
    { grp: 'voice', en: 'She won first prize.', ko: '그녀가 1등 상을 탔어요.' },
    { grp: 'voice', en: "What's the price?", ko: '얼마예요?' },
    { grp: 'voice', en: 'Please leave it here.', ko: '여기 두고 가세요.' },
    { grp: 'voice', en: 'I need some ice.', ko: '얼음이 좀 필요해요.' },
  ];

  /* ---------- 음성 인식: 들은 말이 목표 낱말인가, 짝 낱말인가 ---------- */
  const SAME = { "mcdonald's": ['mcdonalds'], eyes: ["i's"] };
  const words = s => String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const has = (text, w) => { const ws = words(text), t = FC.word(w).toLowerCase(); return ws.indexOf(t) >= 0 || (SAME[t] || []).some(x => ws.indexOf(x) >= 0); };
  FC.heard = function (target, alts) {
    const partner = FC.partner(target);
    alts = (alts || []).filter(Boolean);
    if (!alts.length) return { verdict: 'none', heard: '' };
    const top = alts[0];
    if (has(top, target)) return { verdict: 'target', heard: top, partner };
    if (partner && has(top, partner)) return { verdict: 'partner', heard: top, partner };
    const k = alts.findIndex(a => has(a, target));
    if (k > 0) return { verdict: 'maybe', heard: top, rank: k + 1, partner };
    return { verdict: 'other', heard: top, partner };
  };
  FC.HEARD_KO = {
    target: '목표 낱말로 들었어요',
    partner: '짝 낱말로 들었어요',
    maybe: '첫째 후보는 아니지만 후보에 있었어요',
    other: '다른 낱말로 들었어요',
    none: '아무 말도 듣지 못했어요',
  };
  FC.MP_PAIRS = FC.EPAIRS.concat(FC.VPAIRS);

  /* ---------- 따라 말하기: 낱말 맞추기 ---------- */
  const norm = w => w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '');
  FC.compareWords = function (target, heard) {
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
     kind: count(몇 박자?) · ed(-ed의 끝소리는?) · vpair(어느 낱말? 끝 유성 · 무성) · epair(어느 낱말? 묶음 · 모음 하나 더)
     a: 정답 보기 번호(0부터) — 엔진이 다시 계산해 맞춰 봐요 */
  const COUNT_OPTS = ['한 박자', '두 박자', '세 박자'];
  FC.COUNT_OPTS = COUNT_OPTS;
  FC.DRILL = [
    { kind: 'count', sp: 'tc', say: 'desk', a: 0 },
    { kind: 'vpair', sp: 'uf', say: 'back', opts: ['bag', 'back'], a: 1 },
    { kind: 'ed', sp: 'um', say: 'worked', a: 0 },
    { kind: 'count', sp: 'tf', say: 'Christmas', a: 1 },
    { kind: 'epair', sp: 'tc', say: 'support', opts: ['sport', 'support'], a: 1 },
    { kind: 'ed', sp: 'uf', say: 'wanted', a: 2 },
    { kind: 'count', sp: 'um', say: "McDonald's", a: 2 },
    { kind: 'vpair', sp: 'tf', say: 'prize', opts: ['prize', 'price'], a: 0 },
    { kind: 'count', sp: 'uf', say: 'strike', a: 0 },
    { kind: 'ed', sp: 'tc', say: 'played', a: 1 },
    { kind: 'vpair', sp: 'um', say: 'ice', opts: ['eyes', 'ice'], a: 1 },
    { kind: 'count', sp: 'tc', say: 'needed', a: 1 },
    { kind: 'epair', sp: 'um', say: 'blow', opts: ['blow', 'below'], a: 0 },
    { kind: 'ed', sp: 'tf', say: 'asked', a: 0 },
    { kind: 'vpair', sp: 'tc', say: 'leave', opts: ['leave', 'leaf'], a: 0 },
    { kind: 'count', sp: 'tf', say: 'decided', a: 2 },
  ];
  FC.DRILL.forEach(q => {
    if (q.kind === 'count') q.opts = COUNT_OPTS.slice();
    if (q.kind === 'ed') q.opts = FC.ENDOPTS.ed.map(s => `[${s}]`);
  });
  FC.drillWords = q => q.kind === 'vpair' || q.kind === 'epair' ? q.opts.slice() : [q.say];
  // 힌트 = 3단계 발음법
  FC.hints = function (q) {
    if (q.kind === 'count') {
      const n = FC.nSyl(q.say), m = FC.koSyl(q.say), e = entry(q.say);
      return [
        { head: '① 듣고 가르기', text: '모음 소리마다 손뼉을 한 번씩 쳐요. 자음은 아무리 많아도 박자를 만들지 않아요.' },
        { head: '② 소리 내 보기', text: '끝 자음에서는 입을 닫거나 혀를 댄 채 멈춰요. ‘으’를 붙여 터뜨리면 박자가 하나 늘어요.' },
        { head: '③ 낱말 속에서', text: m ? `한국어식(${e.ko})은 ${m}박자예요. 넣은 ‘으’를 빼고 모음 소리만 세어요.` : `철자의 모음 글자 수가 아니라 모음 소리 수를 세요.` },
      ];
    }
    if (q.kind === 'ed') {
      const x = FC.inflOf(q.say), end = FC.ending(x.base, 'ed');
      return [
        { head: '① 듣고 가르기', text: `끝을 들어요. 바탕 낱말(${x.base})보다 박자가 하나 늘었나요, 그대로인가요?` },
        { head: '② 소리 내 보기', text: `바탕 낱말 ${x.base} ${FC.ipa(x.base)} → 마지막 소리에 바로 이어 붙여 봐요. 그 소리에서 목이 울리나요?` },
        { head: '③ 낱말 속에서', text: '끝의 -ed → t · d 뒤에서만 [ɪd], 한 박자 늘어요. 울리지 않는 소리 뒤 [t], 그 밖 [d].' + (end.snd === 'ɪd' ? '' : ' 애스크드처럼 ‘드’를 붙이지 않아요.') },
      ];
    }
    const [x, y] = q.opts;
    if (q.kind === 'vpair') {
      return [
        { head: '① 듣고 가르기', text: '끝 자음보다 그 앞의 모음 길이를 들어요. 모음이 길게 끌렸나요, 짧게 끊겼나요?' },
        { head: '② 소리 내 보기', text: `${x} → 모음을 길게 끌고 목을 울린 채 닫기 · ${y} → 모음을 짧게 끊고 닫기.` },
        { head: '③ 낱말 속에서', text: '끝의 b · d · g · v · z 앞에서는 모음이 길어요. ‘으’를 붙여 터뜨리지 않아도 길이로 갈려요.' },
      ];
    }
    return [
      { head: '① 듣고 가르기', text: '박자를 세어 봐요. 한 박자인가요, 두 박자인가요?' },
      { head: '② 소리 내 보기', text: `${x} → 첫 자음에서 다음 자음으로 바로 · ${y} → 두 자음 사이에 짧은 어(ə)가 있어요.` },
      { head: '③ 낱말 속에서', text: `자음 묶음에 ‘으’를 넣으면 다른 낱말로 들릴 수 있어요(${x} → ${y}).` },
    ];
  };

  /* ---------- 캔버스 글자 모음 (글꼴 미리 받기) ---------- */
  FC.allText = () => Object.values(DICT).map(e => e.w + e.raw + e.ipa + e.ko + e.gloss).join('') +
    FC.SENT.map(s => s.en + s.ko).join('') + Object.values(FC.SGRP).map(g => g.ko + g.long).join('') +
    FC.LROWS.map(r => r.ko).join('') + Object.values(KIND).join('') + FC.VOICES.map(v => v.ko + v.who).join('') +
    COUNT_OPTS.join('') + ORD.join('') + Object.values(FC.END_WHY).join('') + '박자으ㅡ';

  /* ---------- 데이터 점검 ---------- */
  FC.check = function () {
    const warn = [];
    const w = m => warn.push(m);
    Object.values(DICT).forEach(e => {
      if (e.spell.length !== e.syl.length) w(`${e.key}: 철자 음절 ${e.spell.length}개 ≠ IPA 음절 ${e.syl.length}개`);
      if (e.spell.join('').toLowerCase() !== e.w.toLowerCase()) w(`${e.key}: 철자를 이으면 ${e.spell.join('')}`);
      if (e.syl.filter(s => s.st === 1).length !== 1) w(`${e.key}: 센 음절이 하나가 아님`);
      e.syl.forEach((s, i) => { const n = phones(s.ipa).filter(isV).length; if (n !== 1) w(`${e.key}: ${i + 1}째 음절의 모음이 ${n}개`); });
      // [ ]: 끝 자음이 있으면 마지막 [ ]가 낱말 끝(소리 나지 않는 e는 뒤에 와도 돼요), 앞 묶음이면 첫 [ ]가 낱말 처음
      const segs = FC.spellSegs(e.key), bare = segs.filter(s => s.bare);
      bare.forEach(s => { if (/[aiouy]/i.test(s.t)) w(`${e.key}: [${s.t}] 안에 모음 글자`); });
      const tail = segs[segs.length - 1];
      if (FC.coda(e.key).length && !(tail.bare || (segs.length >= 2 && segs[segs.length - 2].bare && /^e$/i.test(tail.t)))) w(`${e.key}: 끝 자음 글자에 [ ]가 없음`);
      if (!FC.coda(e.key).length && tail.bare) w(`${e.key}: 모음으로 끝나는데 끝에 [ ]`);
      if (FC.onset(e.key).length >= 2 && !(segs[0].bare)) w(`${e.key}: 앞 자음 묶음에 [ ]가 없음`);
      if (FC.onset(e.key).length < 2 && segs[0].bare) w(`${e.key}: 앞 자음이 하나뿐인데 [ ]`);
      // 한국어식 음절 수 = 영어 음절 + 넣은 모음 + 이중모음이 나뉜 음절
      if (e.ko) {
        const parts = FC.koParts(e.key), ins = parts.filter(p => p.role === 'ins').length, dp = parts.filter(p => p.role === 'diph').length;
        if (parts.length !== FC.nSyl(e.key) + ins + dp) w(`${e.key}: 한국어식 ${e.ko} ${parts.length}음절 ≠ 영어 ${FC.nSyl(e.key)} + 넣은 모음 ${ins} + 이중모음 ${dp}`);
        if (dp !== FC.diphCount(e.key)) w(`${e.key}: 이중모음 조각 ${dp} ≠ ${FC.diphCount(e.key)}`);
      }
    });
    // 끝이 붙은 꼴 = 바탕 + 엔진이 고른 끝소리
    FC.INFL.forEach(x => {
      if (!entry(x.form) || !entry(x.base)) { w(`끝이 붙은 꼴 ${x.form}: 사전에 없음`); return; }
      const end = FC.ending(x.base, x.kind);
      const want = entry(x.base).ph.concat(phones(end.snd)).join(' ');
      if (entry(x.form).ph.join(' ') !== want) w(`끝이 붙은 꼴 ${x.form}: ${entry(x.form).ph.join('')} ≠ ${x.base} + ${end.snd}`);
      if (FC.nSyl(x.form) !== FC.nSyl(x.base) + end.extra) w(`끝이 붙은 꼴 ${x.form}: 음절 수`);
      if (entry(x.form).grp.indexOf(x.kind) < 0) w(`끝이 붙은 꼴 ${x.form}: 묶음 ${x.kind}가 아님`);
    });
    FC.byGrp('ed').concat(FC.byGrp('s')).forEach(k => { if (!FC.inflOf(k)) w(`${k}: 바탕 낱말이 없음(INFL)`); });
    // 짝
    FC.VPAIRS.forEach(p => { if (!entry(p.a) || !entry(p.b)) w(`짝 ${p.id}: 사전에 없음`); else if (!FC.voiceDiff(p.a, p.b)) w(`짝 ${p.id}: 끝 자음의 유성 · 무성만 다른 짝이 아님`); });
    FC.EPAIRS.forEach(p => { if (!entry(p.a) || !entry(p.b)) w(`짝 ${p.id}: 사전에 없음`); else if (!FC.insDiff(p.a, p.b)) w(`짝 ${p.id}: 첫 자음 뒤에 모음 하나를 넣은 짝이 아님`); else if (FC.nSyl(p.b) !== FC.nSyl(p.a) + 1) w(`짝 ${p.id}: 음절 수`); });
    // 외래어 줄
    FC.LOAN.forEach(o => {
      if (!entry(o.w)) { w(`외래어 ${o.w}: 사전에 없음`); return; }
      if (!entry(o.w).ko) w(`외래어 ${o.w}: 한국어 표기 없음`);
      if (o.row !== 'both' && FC.kindOf(o.w) !== o.row) w(`외래어 ${o.w}: 줄 ${o.row} ≠ 엔진 ${FC.kindOf(o.w)}`);
      if (o.row === 'both' && !(FC.onset(o.w).length >= 2 && (FC.coda(o.w).length >= 2 || FC.medial(o.w).length)) && !(FC.nSyl(o.w) >= 3)) w(`외래어 ${o.w}: 앞뒤 · 가운데 묶음이 아님`);
      if (!(FC.koSyl(o.w) > FC.nSyl(o.w))) w(`외래어 ${o.w}: 한국어식 음절이 더 많지 않음`);
    });
    // 문장: 칠할 낱말이 하나 이상, 묶음마다 일곱
    FC.SENT.forEach((s, i) => { if (!FC.wordsIn(s.en).length) w(`문장 ${i + 1}: 사전에 있는 낱말이 없음`); });
    const grp = {}; FC.SENT.forEach(s => { grp[s.grp] = (grp[s.grp] || 0) + 1; });
    FC.SGRP_ORDER.forEach(g => { if (grp[g] !== 7) w(`문장 묶음 ${g}: ${grp[g] || 0}개`); });
    // 연습 문제: 엔진의 정답과 같은지, 정답 위치
    const pos = {};
    FC.DRILL.forEach((q, k) => {
      const n = q.opts.length;
      pos[n] = pos[n] || Array(n).fill(0); pos[n][q.a]++;
      if (!entry(q.say)) { w(`연습 ${k + 1}: ${q.say} 사전에 없음`); return; }
      if (q.kind === 'count' && q.a !== FC.nSyl(q.say) - 1) w(`연습 ${k + 1}: 박자 ${q.a + 1} ≠ 엔진 ${FC.nSyl(q.say)}`);
      if (q.kind === 'ed') { const x = FC.inflOf(q.say); if (!x || x.kind !== 'ed') w(`연습 ${k + 1}: -ed 꼴이 아님`); else if (FC.ENDOPTS.ed[q.a] !== FC.ending(x.base, 'ed').snd) w(`연습 ${k + 1}: 끝소리 ≠ 엔진 ${FC.ending(x.base, 'ed').snd}`); }
      if (q.kind === 'vpair' || q.kind === 'epair') {
        if (q.opts[q.a] !== q.say) w(`연습 ${k + 1}: 정답 ≠ 들려주는 낱말`);
        const p = FC.pairOf(q.opts[0]);
        if (!p || FC.partner(q.opts[0]) !== q.opts[1] || (q.kind === 'vpair') !== (p.kind === 'voice')) w(`연습 ${k + 1}: 보기가 짝이 아님`);
      }
      if (['tc', 'tf', 'uf', 'um'].indexOf(q.sp) < 0) w(`연습 ${k + 1}: 목소리 ${q.sp}`);
    });
    Object.keys(pos).forEach(n => { const p = pos[n]; if (Math.max(...p) - Math.min(...p) > 1) w(`보기 ${n}개 문제의 정답 위치가 한쪽으로 몰림: ${p.join(' / ')}`); });
    // 입 그림: 끝 자음 자세는 닿고(k = 여린입천장, t = 윗잇몸), s · 으는 닿지 않아요
    if (window.EN && EN.mouth && EN.mouth.POSES.k) {
      const C = EN.mouth.contact;
      if (!(C('k').touch && C('k').where === '여린입천장')) w('입 그림 k: 혀 뒤가 여린입천장에 닿지 않음');
      if (!(C('t').touch && C('t').where === '윗잇몸')) w('입 그림 t: 혀끝이 윗잇몸에 닿지 않음');
      if (C('s').touch) w('입 그림 s: 혀가 닿음(좁은 틈이어야)');
      if (C('eu').touch) w('입 그림 eu(으): 혀가 닿음');
      if (!EN.mouth.lipsClosed('p')) w('입 그림 p: 입술이 닫히지 않음');
    } else w('입 그림: 끝 자음 자세(k · t · p · s · eu)가 없음');
    warn.forEach(m => console.warn('[FC.check] ' + m));
    return warn.length;
  };
})();
