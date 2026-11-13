/* 워러가 되는 t — 미국식 t와 이어 말하기: 규칙 엔진 (AT)
 * 낱말마다 넓은 IPA를 음절로 나눠(.) 손으로 적고(센 음절 앞에 ˈ), 철자에는 t · d 소리를 내는 글자를 { }로 묶어 적었어요.
 * 엔진은 문장의 소리 목록에서 t · d 소리마다 자리(낱말 처음 · 센 음절의 처음 · s 뒤 · 모음 사이 · n 뒤 · 약한 ‘은’ 앞 · 낱말 끝 · 다음 낱말의 처음)를 보고
 * 모양(숨이 터지는 t · s 뒤의 t · 짧은 ㄹ 같은 t · 목에서 막는 t · 사라지는 t · 끝의 t · you와 이어지는 t)과 그 까닭을 계산하고,
 * 낱말 사이의 이어 말하기(자음 + 모음 · t · d + you) · 칠하기 조각 · 재는 자리(음절 경계) · 연습 문제의 정답 · 따라 말하기 맞추기를 계산해요.
 * 규칙은 미국 표준 발음 교재의 설명을 단순하게 줄인 것이에요(README). 빠르기 · 말투 · 사람에 따라 달라지고, 사라지는 t와 you와 이어지는 t는 경향이에요.
 * 소리를 듣지 않아요 — 목 울림 띠는 미리 만든 음성 파일을 따로 재서(audio/dialogue/measure.js) 그려요.
 */
(function () {
  'use strict';
  const AT = (window.AT = {});

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
      if (!u) throw new Error(`[AT] 모르는 소리 ${s[i]} (${s})`);
      out.push(u); i += u.length;
    }
    return out;
  }
  AT.phones = phones;
  AT.isV = isV;

  /* ---------- 발음 사전 ----------
     낱말(열쇠)|철자(음절은 . · t · d 소리를 내는 글자는 { })|IPA(음절로 나눔, 센 음절 앞에 ˈ)|뜻|한국어식으로 읽은 소리|들리는 쪽에 가깝게 한글로 어림(있을 때만)
     기능어(관사 · 전치사 · 대명사 · 조동사)는 문장 속의 약한 형태로 적었어요. 한 음절 낱말의 ˈ는 t 규칙에 쓰지 않아요 */
  const DICT_SRC = `a|a|ə|하나의
an|an|ən|하나의 (모음 앞)
the|the|ðə|그
of|of|əv|~의
at|a{t}|ət|~에
it|i{t}|ɪt|그것
is|is|ɪz|~이다
are|are|ɚ|~이다
was|was|wəz|~이었다
can|can|kən|~할 수 있다
have|have|həv|가지다
would|woul{d}|wəd|~하겠어요?
you|you|jə|너 · 당신
your|your|jɚ|너의
I|I|aɪ|나
he|he|hi|그
she|she|ʃi|그녀
my|my|maɪ|나의
me|me|mi|나를
this|this|ðɪs|이것
some|some|səm|조금의
in|in|ɪn|~에 · 안으로
water|wa.{t}er|ˈwɔ.tɚ|물|워터|워러
city|ci.{t}y|ˈsɪ.ti|도시|시티|시리
better|be.{tt}er|ˈbɛ.tɚ|더 좋은|베터|베러
party|par.{t}y|ˈpɑr.ti|파티|파티|파리
metal|me.{t}al|ˈmɛ.təl|금속|메탈|메럴
medal|me.{d}al|ˈmɛ.dəl|메달|메달|메럴
writer|wri.{t}er|ˈraɪ.tɚ|작가|라이터|라이러
rider|ri.{d}er|ˈraɪ.dɚ|타는 사람|라이더|라이러
ladder|la.{dd}er|ˈlæ.dɚ|사다리|래더|래러
getting|ge.{tt}ing|ˈgɛ.tɪŋ|되어 가는|게팅|게링
computer|com.pu.{t}er|kəm.ˈpju.tɚ|컴퓨터|컴퓨터|컴퓨러
battery|ba.{tt}e.ry|ˈbæ.tɚ.i|배터리|배터리|배러리
tomato|{t}o.ma.{t}o|tə.ˈmeɪ.toʊ|토마토|토마토|터메이로우
photo|pho.{t}o|ˈfoʊ.toʊ|사진|포토|포로우
photographer|pho.{t}o.gra.pher|fə.ˈtɑ.grə.fɚ|사진가|포토그래퍼
Italy|I.{t}a.ly|ˈɪ.tə.li|이탈리아|이틀리|이럴리
Italian|I.{t}al.ian|ɪ.ˈtæl.jən|이탈리아 사람|이탈리안
atom|a.{t}om|ˈæ.təm|원자|아톰|애럼
atomic|a.{t}o.mic|ə.ˈtɑ.mɪk|원자의|아토믹
thirty|thir.{t}y|ˈθɝ.ti|서른|써티|써리
thirteen|thir.{t}een|θɝ.ˈtin|열셋|써틴
forty|for.{t}y|ˈfɔr.ti|마흔|포티|포리
fourteen|four.{t}een|fɔr.ˈtin|열넷|포틴
eighty|eigh.{t}y|ˈeɪ.ti|여든|에이티|에이리
eighteen|eigh.{t}een|eɪ.ˈtin|열여덟|에이틴
hotel|ho.{t}el|hoʊ.ˈtɛl|호텔|호텔
attack|a.{tt}ack|ə.ˈtæk|공격|어택
top|{t}op|ˈtɑp|꼭대기|탑
ten|{t}en|ˈtɛn|열|텐
take|{t}ake|ˈteɪk|찍다 · 가져가다|테이크
turn|{t}urn|ˈtɝn|돌리다|턴
stop|s{t}op|ˈstɑp|멈추다|스톱
style|s{t}yle|ˈstaɪl|스타일|스타일
stay|s{t}ay|ˈsteɪ|머물다|스테이
star|s{t}ar|ˈstɑr|별|스타
button|bu.{tt}on|ˈbʌ.tən|단추|버튼
mountain|moun.{t}ain|ˈmaʊn.tən|산|마운틴
certain|cer.{t}ain|ˈsɝ.tən|확실한|서튼
written|wri.{tt}en|ˈrɪ.tən|쓰인|리튼
twenty|{t}wen.{t}y|ˈtwɛn.ti|스물|트웬티|트웨니
internet|in.{t}er.ne{t}|ˈɪn.tɚ.nɛt|인터넷|인터넷|이너넷
center|cen.{t}er|ˈsɛn.tɚ|가운데|센터|세너
winter|win.{t}er|ˈwɪn.tɚ|겨울|윈터|위너
interview|in.{t}er.view|ˈɪn.tɚ.vju|면접|인터뷰|이너뷰
cat|ca{t}|ˈkæt|고양이|캣
hot|ho{t}|ˈhɑt|뜨거운|핫
get|ge{t}|ˈgɛt|얻다 · 알아듣다|겟
what|wha{t}|ˈwʌt|무엇|왓
lot|lo{t}|ˈlɑt|많음|랏
not|no{t}|ˈnɑt|아니다|낫
put|pu{t}|ˈpʊt|놓다 · 입다|풋
ate|a{t}e|ˈeɪt|먹었다|에잇
eat|ea{t}|ˈit|먹다|잇
meet|mee{t}|ˈmit|만나다|미트
great|grea{t}|ˈgreɪt|아주 좋은|그레잇
about|a.bou{t}|ə.ˈbaʊt|~에 대해|어바웃
out|ou{t}|ˈaʊt|밖으로|아웃
did|{d}i{d}|ˈdɪd|했다|디드
don't|{d}on'{t}|ˈdoʊnt|~하지 않다|돈트
dollars|{d}ol.lars|ˈdɑ.lɚz|달러|달러스
pick|pick|ˈpɪk|집다|픽
check|check|ˈtʃɛk|확인하다|체크
up|up|ˈʌp|위로|업
off|off|ˈɔf|꺼져 · 떨어져|오프
on|on|ˈɑn|위에 · 켜져|온
all|all|ˈɔl|모두|올
apple|ap.ple|ˈæ.pəl|사과|애플
come|come|ˈkʌm|오다|컴
big|big|ˈbɪg|큰|빅
English|En.glish|ˈɪŋ.glɪʃ|영어|잉글리시
won|won|ˈwʌn|땄다|원
new|new|ˈnu|새|뉴
pass|pass|ˈpæs|건네다|패스
love|love|ˈlʌv|아주 좋아하다|러브
small|small|ˈsmɔl|작은|스몰
energy|en.er.gy|ˈɛ.nɚ.dʒi|에너지|에너지
press|press|ˈprɛs|누르다|프레스
see|see|ˈsi|보다|시
use|use|ˈjuz|쓰다|유즈
like|like|ˈlaɪk|좋아하다|라이크
people|peo.ple|ˈpi.pəl|사람들|피플
know|know|ˈnoʊ|알다|노우
light|ligh{t}|ˈlaɪt|불|라이트`;

  const DICT = {};
  DICT_SRC.split('\n').forEach(line => {
    const [key, spell, ipa, gloss, ko, near] = line.trim().split('|');
    const parts = spell.split('.');
    const marks = [];
    let word = '';
    parts.forEach((p, si) => {
      const re = /\{([^}]*)\}/g;
      let last = 0, m;
      while ((m = re.exec(p))) {
        word += p.slice(last, m.index);
        marks.push({ a: word.length, b: word.length + m[1].length, si, letters: m[1] });
        word += m[1]; last = m.index + m[0].length;
      }
      word += p.slice(last);
    });
    const syl = ipa.split('.').map(s => {
      const st = s[0] === 'ˈ' ? 1 : s[0] === 'ˌ' ? 2 : 0;
      const ph = phones(s), vi = ph.findIndex(isV);
      return { ipa: s.replace(/[ˈˌ]/g, ''), st, ph, vi };
    });
    DICT[key.toLowerCase()] = { key, w: word, spell: parts.map(p => p.replace(/[{}]/g, '')), marks, ipa, syl, gloss, ko: ko || '', near: near || '' };
  });
  AT.DICT = DICT;
  const norm1 = s => String(s).toLowerCase().replace(/’/g, "'");
  const entry = k => DICT[norm1(k)] || null;
  AT.entry = entry;
  AT.nSylW = k => { const e = entry(k); return e ? e.syl.length : 0; };
  // 사전의 소리 /ˈwɔ.tɚ/ (한 음절 낱말은 ˈ를 빼고)
  AT.ipa = k => { const e = entry(k); return e ? '/' + (e.syl.length === 1 ? e.ipa.replace('ˈ', '') : e.ipa.replace(/\./g, '')) + '/' : ''; };
  AT.stressAt = k => { const e = entry(k); return e ? e.syl.findIndex(s => s.st === 1) : -1; };
  // 대문자로 센 음절 (waTER가 아니라 WAter)
  AT.capsW = (k, t) => { const e = entry(k); if (!e) return t || k; const w = t || e.w; let at = 0; return e.spell.map((s, i) => { const x = w.slice(at, at + s.length); at += s.length; return e.syl.length > 1 && e.syl[i].st === 1 ? x.toUpperCase() : x.toLowerCase(); }).join(''); };

  /* ---------- 문장 나누기 ---------- */
  const WORD_RE = /([A-Za-z]+(?:['’][A-Za-z]+)?)/;
  AT.tokens = function (text) {
    const parts = String(text).split(WORD_RE), out = [];
    for (let j = 1; j < parts.length; j += 2) out.push({ t: parts[j], k: norm1(parts[j]), e: entry(parts[j]), i: out.length });
    return out;
  };

  /* ---------- t · d의 모양 ----------
     t · d 소리마다(문장 전체의 소리 목록에서):
       s 뒤(같은 음절 처음) → st · 낱말 처음 → asp · 센 음절의 처음 → asp
       약한 음절의 처음: 뒤가 약한 ‘은’(ən · ɪn)으로 낱말이 끝나고 앞이 모음 · n · r → glot / 앞이 n → drop / 앞이 모음 · r → flap / 그 밖 → plain
       낱말 끝: 다음 낱말이 j(you · your)로 시작 → yu / 모음으로 시작하고 앞이 모음 · r → flap(낱말 사이) / 다음이 자음이거나 문장 끝 → final
     d는 flap · yu만 따로 보고 나머지는 plain(그대로)이에요 */
  const KIND = {
    asp: { ko: '숨이 터지는 t', short: '터지는 t', long: '낱말 처음이거나 센 음절의 처음이라, 막았다가 숨과 함께 터뜨려요' },
    st: { ko: 's 뒤의 t', short: 's 뒤의 t', long: 's 바로 뒤라 숨이 거의 나오지 않아요 — ㄸ에 가깝게 들려요' },
    flap: { ko: '짧은 ㄹ 같은 t', short: '짧은 ㄹ', long: '모음(또는 r) 뒤, 약한 음절 앞이라 혀끝으로 윗잇몸을 한 번 톡 쳐요 — 목 울림이 끊기지 않아요' },
    glot: { ko: '목에서 막는 t', short: '목에서 막음', long: '뒤가 약한 ‘은’이라 혀끝을 대고 목에서 잠깐 막았다가 코로 ‘은’ 해요' },
    drop: { ko: '사라지는 t', short: '사라짐', long: 'n 바로 뒤, 약한 음절 앞이라 t가 빠지기 쉬워요(경향 — 또박또박 말할 때는 살려요)' },
    final: { ko: '끝의 t', short: '끝의 t', long: '뒤에 모음이 없어 터뜨리지 않고 막은 채 끝내요(목에서 막기도 해요)' },
    yu: { ko: 't + you → 츄', short: 'you와 이어짐', long: '뒤의 you와 이어져 ㅊ에 가깝게 바뀌기 쉬워요(경향)' },
    plain: { ko: '그대로', short: '그대로', long: '이 자리에서는 따로 바뀌지 않아요' },
  };
  AT.KIND = KIND;
  AT.KIND_ORDER = ['asp', 'st', 'flap', 'glot', 'drop', 'final', 'yu'];
  // d일 때의 이름 (d는 짧은 ㄹ과 you와 이어짐만)
  AT.kindName = (x, o = {}) => {
    const K = KIND[x.kind] || KIND.plain;
    if (x.ph === 'd') return x.kind === 'flap' ? '짧은 ㄹ 같은 d' : x.kind === 'yu' ? 'd + you → 쥬' : '그대로인 d';
    return o.short ? K.short : K.ko;
  };
  AT.kindWhy = x => {
    if (x.kind === 'flap' && x.across) return `낱말 끝의 ${x.ph}, 다음 낱말이 모음으로 시작해서 이어 말하면 혀끝으로 한 번 톡 쳐요`;
    if (x.ph === 'd' && x.kind === 'yu') return '뒤의 you와 이어져 ㅈ에 가깝게 바뀌기 쉬워요(경향)';
    if (x.ph === 'd' && x.kind === 'flap') return '모음(또는 r) 뒤, 약한 음절 앞이라 d도 t와 같은 짧은 ㄹ이 돼요';
    if (x.ph === 'd') return '이 자리의 d는 따로 바뀌지 않아요';
    return (KIND[x.kind] || KIND.plain).long;
  };

  const cache = new Map();
  // 문장의 소리 목록: [{ ph, w, s(낱말 속 음절), j(문장 속 음절), on(모음 앞), st, last(낱말의 마지막 음절), m(그 낱말의 몇째 t · d) }]
  function flat(text) {
    const ws = AT.tokens(text), P = [];
    let j = 0;
    ws.forEach(w => {
      if (!w.e) return;
      let m = 0;
      w.e.syl.forEach((s, si) => {
        s.ph.forEach((ph, pi) => {
          P.push({ ph, w: w.i, s: si, j, on: pi < s.vi, nuc: pi === s.vi, st: s.st, last: si === w.e.syl.length - 1, m: ph === 't' || ph === 'd' ? m++ : -1 });
        });
        j++;
      });
    });
    return { ws, P, nSyl: j };
  }
  AT.ts = function (text) {
    if (cache.has(text)) return cache.get(text);
    const { ws, P } = flat(text), out = [];
    P.forEach((p, i) => {
      if (p.ph !== 't' && p.ph !== 'd') return;
      const prev = P[i - 1], next = P[i + 1];
      const sameW = q => q && q.w === p.w;
      const vr = q => !!q && (isV(q.ph) || q.ph === 'r');
      let kind = 'plain', k = null, across = false;
      const wordStart = !sameW(prev);
      if (p.on) {
        if (prev && sameW(prev) && prev.s === p.s && prev.ph === 's') kind = 'st';
        else if (wordStart) kind = 'asp';
        else if (p.st) { kind = 'asp'; k = p.j - 1; }
        else {
          // 이 음절의 나머지 소리
          const rest = P.filter(q => q.w === p.w && q.s === p.s && P.indexOf(q) > i).map(q => q.ph);
          const sylN = p.last && rest.length === 2 && (rest[0] === 'ə' || rest[0] === 'ɪ') && rest[1] === 'n';
          if (sylN && (vr(prev) || prev.ph === 'n')) kind = 'glot';
          else if (prev.ph === 'n') kind = 'drop';
          else if (vr(prev)) kind = 'flap';
          else kind = 'plain';
          k = p.j - 1;
        }
      } else if (!sameW(next)) {
        if (next && next.ph === 'j') { kind = 'yu'; across = true; }
        else if (next && isV(next.ph) && vr(prev)) { kind = 'flap'; across = true; k = p.j; }
        else kind = next && isV(next.ph) ? 'plain' : 'final';
      }
      if (p.ph === 'd' && kind !== 'flap' && kind !== 'yu') kind = 'plain';
      if (p.ph === 'd') k = kind === 'flap' ? k : null;
      if (kind !== 'flap' && kind !== 'asp') k = null;
      const w = ws[p.w], mk = w.e.marks[p.m] || null;
      out.push({ ph: p.ph, kind, w: p.w, s: p.s, j: p.j, k, across, a: mk ? mk.a : -1, b: mk ? mk.b : -1, letters: mk ? w.t.slice(mk.a, mk.b) : '' });
    });
    cache.set(text, out);
    return out;
  };
  AT.kinds = text => AT.ts(text).map(x => x.kind);
  // 그 낱말 · 구에서 보여 줄 t 하나(가르기 문제 · 훈련): 짧은 ㄹ이나 터지는 t가 정확히 하나 — 낱말 처음의 터지는 t는 빼요
  AT.mainT = text => { const c = AT.ts(text).filter(x => x.k != null && (x.kind === 'flap' || x.kind === 'asp')); return c.length === 1 ? c[0] : null; };
  AT.nSyl = text => flat(text).nSyl;
  // 재는 자리: 음절 경계 k마다 바라는 것(flap = 목 울림이 이어짐 · gap = 끊김) — 음성 파일을 재는 도구가 씀
  AT.tmarks = text => AT.ts(text).filter(x => x.k != null).map(x => ({ k: x.k, want: x.kind === 'flap' ? 'flap' : 'gap' }));

  /* ---------- 이어 말하기 ----------
     낱말 끝 자음 + 모음으로 시작하는 낱말 → cv(자음이 다음 낱말로 넘어가 이어짐) · t · d + you → yu */
  AT.links = function (text) {
    const ws = AT.tokens(text), out = [];
    for (let i = 0; i + 1 < ws.length; i++) {
      const A = ws[i].e, B = ws[i + 1].e;
      if (!A || !B) continue;
      const la = A.syl[A.syl.length - 1].ph, L = la[la.length - 1], R = B.syl[0].ph[0];
      if (!isV(L) && R === 'j' && (L === 't' || L === 'd')) out.push({ w: i, kind: 'yu', c: L });
      else if (!isV(L) && isV(R)) out.push({ w: i, kind: 'cv', c: L, t: L === 't' || L === 'd' });
    }
    return out;
  };
  AT.linkAt = (text, i) => AT.links(text).find(l => l.w === i) || null;

  // 칠하기 조각: role = t · d의 모양(asp · st · flap · glot · drop · final · yu · plain) · null(나머지 글자) — w = 낱말 번호
  AT.segs = function (text) {
    const parts = String(text).split(WORD_RE), ts = AT.ts(text), out = [];
    let wi = 0;
    parts.forEach((p, j) => {
      if (!p) return;
      if (j % 2 === 0) { out.push({ t: p, role: null, gap: wi }); return; }
      const w = wi++, xs = ts.filter(x => x.w === w && x.a >= 0).sort((a, b) => a.a - b.a);
      let at = 0;
      xs.forEach(x => {
        if (x.a > at) out.push({ t: p.slice(at, x.a), role: null, w });
        out.push({ t: p.slice(x.a, x.b), role: x.kind, ph: x.ph, w, x });
        at = x.b;
      });
      if (at < p.length) out.push({ t: p.slice(at), role: null, w });
    });
    return out;
  };

  /* ---------- 목소리 넷 ---------- */
  AT.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '미국 여성' },
    { sp: 'tf', ko: '차분한 선생님', who: '미국 여성' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];

  /* ---------- 장면 데이터 ---------- */
  AT.INTRO = { en: 'water', ko: '워터', mean: '물' };
  // 01 들어 보기: t와 d가 같은 소리 · t가 다른 두 낱말
  AT.TWIN = [['metal', 'medal'], ['writer', 'rider']];
  AT.CONTRAST = ['water', 'hotel'];
  // 02 t의 지도: 모양마다 낱말
  AT.MAP = [
    { kind: 'asp', words: ['top', 'ten', 'hotel', 'attack'] },
    { kind: 'st', words: ['stop', 'style', 'stay'] },
    { kind: 'flap', words: ['water', 'city', 'party'] },
    { kind: 'glot', words: ['button', 'mountain'] },
    { kind: 'drop', words: ['twenty', 'internet'] },
    { kind: 'final', words: ['cat', 'hot'] },
  ];
  // 03 짧은 ㄹ: 낱말 · d도 같아요
  AT.FLAPS = ['water', 'city', 'better', 'party', 'getting', 'photo'];
  AT.DFLAPS = ['medal', 'ladder', 'rider'];
  // 04 강세가 정해요: 센 음절이 옮겨 가면 t가 바뀌는 짝
  AT.STRESS = [['Italy', 'Italian'], ['atom', 'atomic'], ['photo', 'photographer'], ['thirty', 'thirteen'], ['forty', 'fourteen'], ['eighty', 'eighteen']];
  AT.STRESS_SHOWN = 4;
  // 05 목에서 막는 t · 사라지는 t
  AT.GLOT = ['button', 'mountain', 'certain', 'written'];
  AT.DROP = ['twenty', 'internet', 'center', 'winter', 'interview'];
  // 06 낱말 사이의 t (한국어식은 낱말마다 끊어 읽은 소리, near는 들리는 쪽에 가깝게 한글로 어림)
  AT.ACROSS = [
    { en: 'get it', ko: '겟 잇', near: '게릿', mean: '알아들었어' },
    { en: 'what about', ko: '왓 어바웃', near: '와러바웃', mean: '~는 어때' },
    { en: 'a lot of', ko: '어 로트 오브', near: '어라러브', mean: '많은' },
    { en: 'not at all', ko: '낫 애트 올', near: '나래롤', mean: '전혀' },
    { en: 'put it on', ko: '풋 잇 온', near: '푸리론', mean: '입어 봐' },
  ];
  // 07 이어 말하기: 자음 + 모음 · t · d + you
  AT.LINK = [
    { en: 'pick it up', ko: '픽 잇 업', near: '피키럽', mean: '집어 들다' },
    { en: 'an apple', ko: '언 애플', near: '어내플', mean: '사과 하나' },
    { en: 'turn off', ko: '턴 오프', near: '터노프', mean: '끄다' },
    { en: 'check it out', ko: '체크 잇 아웃', near: '체키라웃', mean: '확인해 봐' },
    { en: 'come on', ko: '컴 온', near: '커만', mean: '어서 · 자' },
  ];
  AT.YU = [
    { en: 'did you', near: '디쥬', mean: '~했어?' },
    { en: 'would you', near: '우쥬', mean: '~해 줄래?' },
    { en: "don't you", near: '돈츄', mean: '~하지 않아?' },
    { en: 'what about you', near: '와러바우츄', mean: '너는 어때?' },
  ];
  // 08 외래어 함정: 한국어식으로 굳은 표기
  AT.LOAN = ['computer', 'internet', 'party', 'tomato', 'battery', 'city'];
  // 한국어식 비교 소리(재는 줄): [한글, 원래 영어]
  AT.KO_LINES = [['워터', 'water'], ['시티', 'city'], ['파티', 'party'], ['컴퓨터', 'computer'], ['픽 잇 업', 'pick it up'], ['겟 잇', 'get it']];
  AT.koOf = en => { const r = AT.KO_LINES.find(x => x[1] === en); return r ? r[0] : ''; };
  // 한국어식 줄의 재는 자리: 영어에서 짧은 ㄹ이 되는 경계에서 한국어식은 끊겨요(gap)
  // 한국어식 줄에서 재는 자리(모두 끊겨야 함): 영어의 짧은 ㄹ 자리 + 다음 낱말이 모음(첫소리 ㅇ)으로 시작하는 낱말 사이 — 영어는 이어지고, 한국어식은 끊어 읽어요
  const koVowelStart = ch => { const c = String(ch).charCodeAt(0) - 0xAC00; return c >= 0 && c < 11172 && Math.floor(c / 588) === 11; };
  AT.koMarks = ko => {
    const out = [], r = AT.KO_LINES.find(x => x[0] === ko);
    if (r) AT.tmarks(r[1]).filter(m => m.want === 'flap').forEach(m => out.push({ k: m.k, want: 'gap' }));
    const ws = String(ko).split(' '); let n = 0;
    ws.forEach((w, i) => { n += AT.koN(w); const nx = ws[i + 1]; if (nx && koVowelStart(nx[0]) && !out.some(m => m.k === n - 1)) out.push({ k: n - 1, want: 'gap' }); });
    return out.sort((a, b) => a.k - b.k);
  };
  AT.koN = ko => [...String(ko)].filter(c => /[가-힣]/.test(c)).length;

  /* ---------- t 바꾸기 실험실: 하나만 바꾼 짝 ---------- */
  AT.SWITCH = [
    { id: 'stress', ko: '센 음절을 옮기면', note: '센 음절이 t 바로 뒤로 오면 짧은 ㄹ이 숨이 터지는 t로 바뀌어요', pairs: AT.STRESS },
    { id: 'vowel', ko: '뒤에 모음으로 시작하는 낱말을 붙이면', note: '낱말 끝의 t 뒤에 모음이 이어지면 짧은 ㄹ이 돼요', pairs: [['get', 'get it'], ['what', 'what about'], ['lot', 'a lot of'], ['put', 'put it on'], ['not', 'not at all']] },
    { id: 'td', ko: 't를 d로 바꾸면', note: '모음 사이의 t와 d는 둘 다 짧은 ㄹ이라 거의 같게 들려요', pairs: [['metal', 'medal'], ['writer', 'rider']] },
    { id: 'n', ko: '앞에 n을 넣으면', note: 'n 바로 뒤의 t는 짧은 ㄹ이 되지 않고, 빠지기 쉬워요(경향)', pairs: [['writer', 'winter'], ['better', 'center'], ['city', 'twenty']] },
  ];
  AT.switchSet = id => AT.SWITCH.find(s => s.id === id) || AT.SWITCH[0];

  /* ---------- 듣고 가르기 훈련: t가 하나인 낱말 (짧은 ㄹ · 터지는 t) ---------- */
  AT.HV = ['water', 'city', 'better', 'party', 'metal', 'medal', 'getting', 'photo', 'Italy', 'atom', 'thirty', 'forty', 'eighty', 'computer', 'battery',
    'hotel', 'attack', 'Italian', 'atomic', 'photographer', 'thirteen', 'fourteen', 'eighteen'];

  /* ---------- 따라 말하기 28문장 (묶음마다 일곱) ---------- */
  AT.SGRP = {
    flap: { ko: '짧은 ㄹ', long: '짧은 ㄹ 같은 t — 모음 사이에서 한 번 톡' },
    stress: { ko: '강세와 t', long: '강세가 정하는 t — 센 음절 앞에서는 터뜨리기' },
    glot: { ko: '막고 · 빠지는 t', long: '목에서 막는 t · 사라지는 t' },
    link: { ko: '이어 말하기', long: '낱말 사이 — 자음은 다음 모음에 붙여서' },
  };
  AT.SGRP_ORDER = ['flap', 'stress', 'glot', 'link'];
  AT.SENT = [
    { grp: 'flap', en: 'Can I have some water?', ko: '물 좀 주실래요?' },
    { grp: 'flap', en: 'This is a big city.', ko: '여기는 큰 도시예요.' },
    { grp: 'flap', en: 'Your English is getting better.', ko: '영어 실력이 늘고 있어요.' },
    { grp: 'flap', en: 'The party was great.', ko: '파티는 아주 좋았어요.' },
    { grp: 'flap', en: 'I won a medal.', ko: '메달을 땄어요.' },
    { grp: 'flap', en: 'My computer is new.', ko: '내 컴퓨터는 새것이에요.' },
    { grp: 'flap', en: 'Pass me a tomato.', ko: '토마토 하나 건네주세요.' },
    { grp: 'stress', en: 'I love Italy.', ko: '저는 이탈리아를 아주 좋아해요.' },
    { grp: 'stress', en: 'She is Italian.', ko: '그녀는 이탈리아 사람이에요.' },
    { grp: 'stress', en: 'Take a photo.', ko: '사진 찍어요.' },
    { grp: 'stress', en: 'He is a photographer.', ko: '그는 사진가예요.' },
    { grp: 'stress', en: 'The hotel is new.', ko: '그 호텔은 새것이에요.' },
    { grp: 'stress', en: 'She is thirteen.', ko: '그녀는 열세 살이에요.' },
    { grp: 'stress', en: 'He is thirty.', ko: '그는 서른 살이에요.' },
    { grp: 'glot', en: 'Press the button.', ko: '단추를 누르세요.' },
    { grp: 'glot', en: 'I see a mountain.', ko: '산이 보여요.' },
    { grp: 'glot', en: 'Are you certain?', ko: '확실해요?' },
    { grp: 'glot', en: 'I have twenty dollars.', ko: '20달러 있어요.' },
    { grp: 'glot', en: 'I use the internet.', ko: '인터넷을 써요.' },
    { grp: 'glot', en: 'Meet me in the center.', ko: '가운데에서 만나요.' },
    { grp: 'glot', en: 'I like winter.', ko: '겨울을 좋아해요.' },
    { grp: 'link', en: 'Pick it up.', ko: '집어 들어요.' },
    { grp: 'link', en: 'Check it out.', ko: '확인해 봐요.' },
    { grp: 'link', en: 'Not at all.', ko: '전혀 아니에요.' },
    { grp: 'link', en: 'A lot of people.', ko: '사람이 많아요.' },
    { grp: 'link', en: 'I ate an apple.', ko: '사과 하나를 먹었어요.' },
    { grp: 'link', en: 'Come on in.', ko: '어서 들어와요.' },
    { grp: 'link', en: 'Did you eat?', ko: '밥 먹었어요?' },
  ];
  // 08 문장 속에서: 세 문장
  AT.LONG = [
    { en: 'What about a party at the hotel?', ko: '호텔에서 파티하는 건 어때요?' },
    { en: 'Put it on the computer.', ko: '그거 컴퓨터 위에 놓아요.' },
    { en: 'Would you like some water?', ko: '물 좀 드릴까요?' },
  ];
  AT.meaning = text => {
    const all = AT.SENT.concat(AT.LONG, AT.ACROSS, AT.LINK, AT.YU);
    const s = all.find(x => x.en === text || x.en === text.replace(/[.?!]$/, ''));
    if (s) return s.mean || s.ko;
    const e = entry(text);
    return e ? e.gloss : '';
  };

  /* ---------- 따라 말하기: 낱말 맞추기 ----------
     인식기는 숫자를 숫자로 적기도 해요(13 · thirty → 30) — 같은 낱말로 쳐요 */
  const NUMW = { 13: 'thirteen', 14: 'fourteen', 18: 'eighteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 80: 'eighty', 10: 'ten' };
  const SAME = { a: ['uh'], you: ['ya'], of: ['a'], dollars: ['dollar', '$'] };
  const words = s => String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\$(\d+)/g, '$1 dollars')
    .replace(/\b(\d+)\b/g, (m, d) => NUMW[d] || d).replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const norm = w => w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  AT.compareWords = function (target, heard) {
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
     kind: kind(짧은 ㄹ인가 터지는 t인가) · pair(두 낱말 중 짧은 ㄹ은 어느 쪽?) · ko(한국어식은 어느 쪽?) · count(이어 들린 말은 몇 낱말?)
     a: 정답 보기 번호(0부터) — 엔진이 다시 계산해 맞춰 봐요 */
  const KIND_OPTS = ['짧은 ㄹ 같은 t', '숨이 터지는 t'];
  const COUNT_OPTS = ['두 낱말', '세 낱말', '네 낱말'];
  AT.KIND_OPTS = KIND_OPTS; AT.COUNT_OPTS = COUNT_OPTS;
  AT.DRILL = [
    { kind: 'kind', sp: 'tc', say: 'city', a: 0 },
    { kind: 'pair', sp: 'tc', seq: ['Italy', 'Italian'], a: 0 },
    { kind: 'count', sp: 'um', say: 'Pick it up.', a: 1 },
    { kind: 'kind', sp: 'um', say: 'hotel', a: 1 },
    { kind: 'ko', seq: [{ text: '워터', sp: 'ko' }, { text: 'water', sp: 'tc' }], en: 'water', a: 0 },
    { kind: 'kind', sp: 'uf', say: 'party', a: 0 },
    { kind: 'pair', sp: 'tf', seq: ['atomic', 'atom'], a: 1 },
    { kind: 'count', sp: 'tf', say: 'Come on.', a: 0 },
    { kind: 'kind', sp: 'tf', say: 'attack', a: 1 },
    { kind: 'pair', sp: 'um', seq: ['thirteen', 'thirty'], a: 1 },
    { kind: 'kind', sp: 'um', say: 'better', a: 0 },
    { kind: 'ko', seq: [{ text: 'pick it up', sp: 'tc' }, { text: '픽 잇 업', sp: 'ko' }], en: 'pick it up', a: 1 },
    { kind: 'count', sp: 'tc', say: 'A lot of people.', a: 2 },
    { kind: 'kind', sp: 'uf', say: 'Italian', a: 1 },
    { kind: 'pair', sp: 'uf', seq: ['eighty', 'eighteen'], a: 0 },
    { kind: 'count', sp: 'uf', say: 'Check it out.', a: 1 },
  ];
  AT.DRILL.forEach(q => {
    if (q.kind === 'kind') q.opts = KIND_OPTS.slice();
    if (q.kind === 'pair') q.opts = ['첫째 낱말', '둘째 낱말'];
    if (q.kind === 'ko') { q.opts = ['첫째 소리', '둘째 소리']; q.sp = q.seq[q.a === 0 ? 1 : 0].sp; }
    if (q.kind === 'count') q.opts = COUNT_OPTS.slice();
  });
  AT.drillText = q => q.kind === 'ko' ? q.en : q.kind === 'pair' ? q.seq.join(' · ') : q.say;
  AT.drillSeq = q => q.kind === 'ko' ? q.seq : q.kind === 'pair' ? q.seq.map((w, i) => ({ text: w, sp: q.sp, gap: i ? 0.9 : undefined })) : [{ text: q.say, sp: q.sp }];
  // 엔진이 계산한 정답
  AT.drillAnswer = q => {
    if (q.kind === 'kind') { const x = AT.mainT(q.say); return x ? (x.kind === 'flap' ? 0 : 1) : -1; }
    if (q.kind === 'pair') { const f = q.seq.map(w => { const x = AT.mainT(w); return !!x && x.kind === 'flap'; }); return f.filter(Boolean).length === 1 ? f.indexOf(true) : -1; }
    if (q.kind === 'ko') return q.seq.findIndex(it => it.sp === 'ko');
    if (q.kind === 'count') return AT.tokens(q.say).length - 2;
    return -1;
  };
  // 힌트 = 3단계 발음법
  AT.hints = function (q) {
    if (q.kind === 'kind') {
      const x = AT.mainT(q.say), e = entry(q.say);
      return [
        { head: '① 듣고 가르기', text: 't 자리에서 소리가 한 번 끊기고 숨이 터지나요, 아니면 모음이 끊기지 않고 혀끝만 한 번 톡 스치나요?' },
        { head: '② 소리 만들기', text: '짧은 ㄹ 같은 t = 한국어 ‘나라’의 ㄹ처럼 한 번 톡. 숨이 터지는 t = 혀끝으로 막았다가 숨과 함께 터뜨림.' },
        { head: '③ 낱말 속에서', text: `센 음절을 봐요 → ${AT.capsW(q.say)}. t 바로 뒤가 ${e.syl[x.s].st === 1 ? '센 음절이에요.' : '약한 음절이에요.'}` },
      ];
    }
    if (q.kind === 'pair') {
      return [
        { head: '① 듣고 가르기', text: '두 낱말의 t 자리를 견줘 들어요. 한쪽은 목 울림이 이어지고, 다른 쪽은 끊겼다가 터져요.' },
        { head: '② 소리 만들기', text: 't 바로 뒤가 센 음절이면 터뜨리고, 약한 음절이면 짧은 ㄹ처럼 톡 쳐요.' },
        { head: '③ 낱말 속에서', text: `센 음절이 옮겨 가요 → ${q.seq.map(w => AT.capsW(w)).join(' · ')}.` },
      ];
    }
    if (q.kind === 'ko') {
      const ko = q.seq.find(it => it.sp === 'ko').text;
      return [
        { head: '① 듣고 가르기', text: '두 소리를 차례로 들어요. t 자리에서 소리가 끊기고 숨이 세게 터지는 쪽이 있어요.' },
        { head: '② 소리 만들기', text: '미국식은 모음 사이 t를 짧은 ㄹ처럼 톡 치고 끊지 않아요.' },
        { head: '③ 낱말 속에서', text: `한국어식은 글자대로 또박또박 읽어요 → ${ko}` },
      ];
    }
    const n = AT.tokens(q.say).length;
    return [
      { head: '① 듣고 가르기', text: '한 낱말처럼 이어 들려도, 그 안에 낱말 여럿이 붙어 있을 수 있어요.' },
      { head: '② 소리 만들기', text: '낱말 끝 자음은 다음 낱말의 모음에 붙어요 → ' + (AT.links(q.say).length ? '이 말에는 이어지는 곳이 ' + AT.links(q.say).length + '곳 있어요.' : '자음 + 모음이 이어지는 곳을 찾아요.') },
      { head: '③ 문장 속에서', text: `작은 낱말(it · of · a · an · on)이 숨어 있지 않나, 이어진 곳마다 끊어 들어 봐요. 이 말은 ${n}개 낱말 중 ${AT.links(q.say).length}곳이 이어져요 — 보기를 고르기 전에 세어 봐요.` },
    ];
  };

  /* ---------- 캔버스 글자 모음 (글꼴 미리 받기) ---------- */
  AT.allText = () => {
    const texts = AT.SENT.concat(AT.LONG, AT.ACROSS, AT.LINK, AT.YU).map(s => s.en + (s.ko || '') + (s.near || '') + (s.mean || '')).join('');
    return Object.values(DICT).map(e => e.w + e.w.toUpperCase() + AT.capsW(e.key) + e.ipa + e.gloss + e.ko + e.near).join('') + texts +
      Object.values(AT.SGRP).map(g => g.ko + g.long).join('') + Object.values(KIND).map(k => k.ko + k.short + k.long).join('') +
      AT.SWITCH.map(s => s.ko + s.note).join('') + AT.VOICES.map(v => v.ko + v.who).join('') + AT.KO_LINES.map(x => x[0]).join('') +
      KIND_OPTS.join('') + COUNT_OPTS.join('') + '짧은 ㄹ 같은 d · d + you → 쥬 · 그대로인 d';
  };

  /* ---------- 데이터 점검 ---------- */
  AT.check = function () {
    const warn = [];
    const w = m => warn.push(m);
    // 사전: 철자 조각 = 음절, 음절마다 모음 하나, 여러 음절이면 센 음절 하나, { } 수 = t · d 소리 수(같은 음절)
    Object.values(DICT).forEach(e => {
      if (e.spell.length !== e.syl.length) w(`${e.key}: 철자 조각 ${e.spell.length}개 ≠ 음절 ${e.syl.length}개`);
      if (e.spell.join('') !== e.w) w(`${e.key}: 철자 조각을 이으면 ${e.spell.join('')}`);
      if (e.w.toLowerCase() !== e.key.toLowerCase()) w(`${e.key}: 철자 ${e.w}`);
      e.syl.forEach((s, i) => { if (s.ph.filter(isV).length !== 1) w(`${e.key}: ${i + 1}째 음절의 모음이 ${s.ph.filter(isV).length}개`); });
      if (e.syl.length > 1 && e.syl.filter(s => s.st === 1).length !== 1) w(`${e.key}: 센 음절이 하나가 아님`);
      const td = [];
      e.syl.forEach((s, si) => s.ph.forEach(p => { if (p === 't' || p === 'd') td.push({ p, si }); }));
      if (td.length !== e.marks.length) w(`${e.key}: t · d 소리 ${td.length}개 ≠ 철자의 { } ${e.marks.length}개`);
      else td.forEach((x, i) => {
        const mk = e.marks[i];
        if (mk.si !== x.si) w(`${e.key}: ${i + 1}째 ${x.p}의 음절 ${x.si + 1} ≠ 철자 ${mk.si + 1}`);
        if (!new RegExp('^' + x.p + '+$|^ed$', 'i').test(mk.letters)) w(`${e.key}: ${x.p} 소리의 글자가 ${mk.letters}`);
      });
      if (e.near && !e.ko) w(`${e.key}: 들리는 쪽 어림만 있고 한국어식이 없음`);
    });
    // 모든 문장 · 구의 낱말이 사전에 있음
    const words1 = [].concat(...AT.MAP.map(m => m.words), AT.FLAPS, AT.DFLAPS, ...AT.STRESS, AT.GLOT, AT.DROP, AT.LOAN, AT.HV, ...AT.TWIN, AT.CONTRAST, [AT.INTRO.en]);
    const texts = words1.concat(AT.ACROSS.map(x => x.en), AT.LINK.map(x => x.en), AT.YU.map(x => x.en), AT.SENT.map(s => s.en), AT.LONG.map(s => s.en),
      ...AT.SWITCH.map(s => [].concat(...s.pairs)), AT.KO_LINES.map(x => x[1]), AT.DRILL.map(q => q.kind === 'pair' ? q.seq.join(' ') : AT.drillText(q)));
    texts.forEach(t => AT.tokens(t).forEach(x => { if (!x.e) w(`"${t}": 사전에 없는 낱말 ${x.t}`); }));
    const only = (t, kind, msg) => { const k = AT.ts(t).filter(x => x.ph === 't' || x.kind === 'flap').map(x => x.kind); if (k.indexOf(kind) < 0) w(`${msg} "${t}": ${kind}가 없음 (${k.join(',') || '없음'})`); };
    // 지도: 낱말마다 그 모양의 t가 있음
    AT.MAP.forEach(m => m.words.forEach(t => only(t, m.kind, `지도 ${m.kind}`)));
    AT.FLAPS.forEach(t => { if (!AT.mainT(t) || AT.mainT(t).kind !== 'flap') w(`짧은 ㄹ "${t}": t 하나가 짧은 ㄹ이 아님`); });
    AT.DFLAPS.forEach(t => { const x = AT.mainT(t); if (!x || x.kind !== 'flap' || x.ph !== 'd') w(`d의 짧은 ㄹ "${t}"`); });
    AT.GLOT.forEach(t => only(t, 'glot', '목에서 막는 t'));
    AT.DROP.forEach(t => only(t, 'drop', '사라지는 t'));
    // 강세 짝: 앞은 짧은 ㄹ, 뒤는 터지는 t, 센 음절이 다름
    AT.STRESS.forEach(([a, b]) => {
      const A = AT.mainT(a), B = AT.mainT(b);
      if (!A || A.kind !== 'flap') w(`강세 짝 ${a}: 짧은 ㄹ이 아님`);
      if (!B || B.kind !== 'asp') w(`강세 짝 ${b}: 터지는 t가 아님`);
      if (AT.stressAt(a) === AT.stressAt(b) && AT.nSylW(a) === AT.nSylW(b)) w(`강세 짝 ${a} · ${b}: 센 음절이 같음`);
    });
    // 둘 다 짧은 ㄹ인 짝 (t · d)
    AT.TWIN.forEach(([a, b]) => { const A = AT.mainT(a), B = AT.mainT(b); if (!A || !B || A.kind !== 'flap' || B.kind !== 'flap' || A.ph !== 't' || B.ph !== 'd') w(`t · d 짝 ${a} · ${b}`); });
    if (AT.mainT(AT.CONTRAST[0]).kind !== 'flap' || AT.mainT(AT.CONTRAST[1]).kind !== 'asp') w('01장 견주기: water는 짧은 ㄹ · hotel은 터지는 t');
    // 낱말 사이: 낱말 끝 t가 짧은 ㄹ(가로질러)
    AT.ACROSS.forEach(x => { if (!AT.ts(x.en).some(y => y.kind === 'flap' && y.across)) w(`낱말 사이 "${x.en}": 가로지르는 짧은 ㄹ이 없음`); if (x.ko.split(' ').length !== AT.tokens(x.en).length) w(`낱말 사이 "${x.en}": 한국어식 낱말 수`); });
    AT.LINK.forEach(x => { if (!AT.links(x.en).length) w(`이어 말하기 "${x.en}": 이어지는 곳이 없음`); if (x.ko.split(' ').length !== AT.tokens(x.en).length) w(`이어 말하기 "${x.en}": 한국어식 낱말 수`); });
    AT.YU.forEach(x => { if (!AT.ts(x.en).some(y => y.kind === 'yu')) w(`you와 이어짐 "${x.en}": yu가 없음`); });
    // 외래어: 한국어식 표기와 어림이 있음, 짧은 ㄹ이나 사라지는 t가 있음
    AT.LOAN.forEach(k => { const e = entry(k); if (!e || !e.ko || !e.near) w(`외래어 ${k}: 표기 · 어림`); if (!AT.ts(k).some(x => x.kind === 'flap' || x.kind === 'drop')) w(`외래어 ${k}: 바뀌는 t가 없음`); });
    // 한국어식 줄: 재는 자리가 있고, 낱말 수가 같음
    AT.KO_LINES.forEach(([ko, en]) => { if (!AT.koMarks(ko).length) w(`한국어식 "${ko}": 재는 자리가 없음`); if (ko.split(' ').length !== AT.tokens(en).length) w(`한국어식 "${ko}": 낱말 수`); });
    // 실험실: 짝의 두 쪽에서 t의 모양이 달라지거나(stress · vowel · n), 둘 다 짧은 ㄹ(td)
    AT.SWITCH.forEach(s => s.pairs.forEach(([a, b]) => {
      const ka = AT.ts(a).filter(x => x.ph === 't' || x.kind === 'flap').map(x => x.kind), kb = AT.ts(b).filter(x => x.ph === 't' || x.kind === 'flap').map(x => x.kind);
      if (s.id === 'td') { if (ka.indexOf('flap') < 0 || kb.indexOf('flap') < 0) w(`실험실 ${s.id} ${a} · ${b}: 둘 다 짧은 ㄹ이 아님`); }
      else if (s.id === 'vowel') { if (ka.indexOf('final') < 0 || !AT.ts(b).some(x => x.across && x.kind === 'flap')) w(`실험실 ${s.id} ${a} · ${b}`); }
      else if (s.id === 'n') { if (ka.indexOf('flap') < 0 || kb.indexOf('drop') < 0) w(`실험실 ${s.id} ${a} · ${b}`); }
    }));
    // 훈련 낱말: t 하나(짧은 ㄹ · 터지는 t), 둘 다 있음
    const hvk = AT.HV.map(t => { const x = AT.mainT(t); if (!x) w(`훈련 "${t}": 가를 t가 하나가 아님`); return x && x.kind; });
    if (hvk.indexOf('flap') < 0 || hvk.indexOf('asp') < 0) w('훈련: 두 갈래가 모두 있어야 해요');
    // 따라 말하기 묶음: 7 × 4
    const grp = {}; AT.SENT.forEach(s => { grp[s.grp] = (grp[s.grp] || 0) + 1; });
    AT.SGRP_ORDER.forEach(g => { if (grp[g] !== 7) w(`문장 묶음 ${g}: ${grp[g] || 0}개`); });
    if (AT.SENT.length !== 28) w(`따라 말하기 ${AT.SENT.length}문장`);
    if (new Set(AT.SENT.map(s => s.en)).size !== AT.SENT.length) w('따라 말하기 문장이 겹침');
    const has = (s, kinds) => AT.ts(s.en).some(x => kinds.indexOf(x.kind) >= 0) || (kinds.indexOf('link') >= 0 && AT.links(s.en).length);
    const WANT = { flap: ['flap'], stress: ['flap', 'asp'], glot: ['glot', 'drop'], link: ['link', 'yu'] };
    AT.SENT.forEach(s => { if (!has(s, WANT[s.grp])) w(`따라 말하기 "${s.en}": 묶음(${s.grp})의 소리가 없음`); });
    // 연습 문제: 엔진의 정답과 같은지, 정답 위치
    const pos = {};
    AT.DRILL.forEach((q, k) => {
      const n = q.opts.length;
      pos[n] = pos[n] || Array(n).fill(0); pos[n][q.a]++;
      const a = AT.drillAnswer(q);
      if (a !== q.a) w(`연습 ${k + 1}: 정답 ${q.a} ≠ 엔진 ${a}`);
      if (q.kind === 'ko') { const ko = q.seq.find(it => it.sp === 'ko'), en = q.seq.find(it => it.sp !== 'ko'); if (!ko || !en || en.text !== q.en || AT.koOf(q.en) !== ko.text) w(`연습 ${k + 1}: 한국어식 · 영어 짝`); }
      if (q.kind === 'count' && !AT.links(q.say).length) w(`연습 ${k + 1}: 이어지는 곳이 없는 말`);
      const sps = q.kind === 'ko' ? q.seq.filter(it => it.sp !== 'ko').map(it => it.sp) : [q.sp];
      sps.forEach(sp => { if (['tc', 'tf', 'uf', 'um'].indexOf(sp) < 0) w(`연습 ${k + 1}: 목소리 ${sp}`); });
    });
    Object.keys(pos).forEach(n => { const p = pos[n]; if (Math.max(...p) - Math.min(...p) > 1) w(`보기 ${n}개 문제의 정답 위치가 한쪽으로 몰림: ${p.join(' / ')}`); });
    // 따라 말하기 맞추기: 원래 문장을 그대로 받아 적으면 모두 맞음
    AT.SENT.forEach(s => { const r = AT.compareWords(s.en, s.en); if (r.hit !== r.total) w(`맞추기 "${s.en}": 그대로 적어도 ${r.hit}/${r.total}`); });
    // 엔진 규칙 몇 가지
    [['water', 'flap'], ['hotel', 'asp'], ['stop', 'st'], ['button', 'glot'], ['twenty', 'asp,drop'], ['cat', 'final'], ['internet', 'drop,final'], ['tomato', 'asp,flap'], ['did you', 'plain,yu'], ['get it', 'flap,final']]
      .forEach(([t, want]) => { if (AT.kinds(t).join() !== want) w(`규칙 "${t}": ${AT.kinds(t).join()} ≠ ${want}`); });
    warn.forEach(m => console.warn('[AT.check] ' + m));
    return warn.length;
  };
})();
