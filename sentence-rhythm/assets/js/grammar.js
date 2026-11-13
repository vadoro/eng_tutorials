/* 센 낱말, 약한 낱말 — 문장 리듬: 규칙 엔진 (SR)
 * 낱말마다 넓은 IPA를 음절로 나눠(.) 손으로 적고(내용어는 센 음절 앞에 ˈ, 기능어는 강한 형태 · 약한 형태 둘), 철자도 같은 수의 조각으로 나눠 적었어요.
 * 엔진은 이것으로 문장의 낱말 갈래(내용어 · 기능어) · 강한 형태로 돌아오는 자리(문장 끝 전치사 · 혼자 대답 · 강조 · 인용)와 그 까닭 ·
 * 음절마다 세기(1 센 낱말의 센 음절 · 2 센 낱말의 다른 음절 · 3 약한 낱말) · 음절 공의 기본 모양 · 한국어식 공 · 센 낱말 수 ·
 * 센 음절 사이의 약한 음절 수 · 대문자 띠(i WANT tə GO tə thə STORE) · 칠하기 조각 · can과 can't 받아 적기 가르기 · 따라 말하기 맞추기를 계산해요.
 * 내용어의 소리는 misaki 미국 발음 사전과 맞춰 봤고, 기능어의 강한 형태는 misaki의 인용 형태를 따랐어요.
 * 약한 형태는 사전에 없어서 교재의 표준 약한 형태를 손으로 적었어요(README).
 * 소리를 듣지 않아요 — 음절 공의 크기 · 높이와 문장 길이는 미리 만든 음성 파일을 따로 재서(audio/dialogue/measure.js) 그려요.
 */
(function () {
  'use strict';
  const SR = (window.SR = {});

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
      if (!u) throw new Error(`[SR] 모르는 소리 ${s[i]} (${s})`);
      out.push(u); i += u.length;
    }
    return out;
  }
  SR.phones = phones;
  const SCHWA = ['ə', 'ɚ'];
  SR.SCHWA = SCHWA;

  /* ---------- 낱말 갈래 ----------
     내용어(센 낱말): 뜻을 나름. 기능어(약한 낱말): 문법을 이음 */
  const POS = {
    n: { ko: '명사', cls: 'content' }, v: { ko: '본동사', cls: 'content' }, adj: { ko: '형용사', cls: 'content' }, adv: { ko: '부사', cls: 'content' },
    wh: { ko: '의문사', cls: 'content' }, neg: { ko: '부정 조동사', cls: 'content' }, intj: { ko: '대답말', cls: 'content' },
    art: { ko: '관사', cls: 'function' }, prep: { ko: '전치사', cls: 'function' }, conj: { ko: '접속사', cls: 'function' }, aux: { ko: '조동사', cls: 'function' },
    be: { ko: 'be 동사', cls: 'function' }, pron: { ko: '대명사', cls: 'function' }, det: { ko: '한정어', cls: 'function' }, there: { ko: '존재의 there', cls: 'function' },
  };
  SR.POS = POS;
  SR.CLS = { content: { ko: '센 낱말', long: '센 낱말 · 내용어' }, function: { ko: '약한 낱말', long: '약한 낱말 · 기능어' } };

  /* ---------- 발음 사전 ----------
     낱말(열쇠)|철자 조각|강한 형태 IPA(음절로 나눔, 내용어는 센 음절 앞에 ˈ)|품사|약한 형태 IPA(기능어만)|뜻|뿌리(같은 낱말로 셀 때)
     기능어의 강한 형태 = misaki 사전의 인용 형태. 약한 형태 = 교재의 표준 약한 형태(손으로 적음). 약한 형태가 강한 형태와 같으면 모음이 줄지 않는 낱말 */
  const DICT_SRC = `a|a|eɪ|art|ə|하나의
an|an|æn|art|ən|하나의 (모음 앞)
the|the|ði|art|ðə|그
to|to|tu|prep|tə|~에 · ~하러
for|for|fɔr|prep|fɚ|~을 위해 · ~에
of|of|ʌv|prep|əv|~의
at|at|æt|prep|ət|~에서 · ~을
from|from|frʌm|prep|frəm|~에서 · ~부터
and|and|ænd|conj|ən|그리고 · ~와
or|or|ɔr|conj|ɚ|또는
but|but|bʌt|conj|bət|하지만
can|can|kæn|aux|kən|~할 수 있다
will|will|wɪl|aux|wəl|~할 것이다
have|have|hæv|aux|həv|(완료) ~했다
do|do|du|aux|də|(질문을 여는 말)
been|been|bɪn|be|bən|(be의 완료형)
am|am|æm|be|əm|~이다
is|is|ɪz|be|ɪz|~이다
are|are|ɑr|be|ɚ|~이다
was|was|wʌz|be|wəz|~이었다
were|were|wɝ|be|wɚ|~이었다
I|I|aɪ|pron|aɪ|나
you|you|ju|pron|jə|너 · 당신
he|he|hi|pron|hi|그
she|she|ʃi|pron|ʃi|그녀
we|we|wi|pron|wi|우리
they|they|ðeɪ|pron|ðeɪ|그들
it|it|ɪt|pron|ɪt|그것
me|me|mi|pron|mi|나를
them|them|ðɛm|pron|ðəm|그들을
my|my|maɪ|pron|maɪ|나의
your|your|jʊr|pron|jɚ|너의
some|some|sʌm|det|səm|조금의
there|there|ðɛr|there|ðɚ|(~이 있다)
can't|can't|ˈkænt|neg||~할 수 없다
want|want|ˈwɑnt|v||원하다
wants|wants|ˈwɑnts|v||원하다|want
go|go|ˈgoʊ|v||가다
store|store|ˈstɔr|n||가게
swim|swim|ˈswɪm|v||수영하다
drive|drive|ˈdraɪv|v||운전하다
park|park|ˈpɑrk|v||주차하다
here|here|ˈhɪr|adv||여기
come|come|ˈkʌm|v||오다
tomorrow|to.mor.row|tə.ˈmɑ.roʊ|adv||내일
today|to.day|tə.ˈdeɪ|adv||오늘
cook|cook|ˈkʊk|v||요리하다
kids|kids|ˈkɪdz|n||아이들|kid
waiting|wait.ing|ˈweɪ.tɪŋ|v||기다리는|wait
bus|bus|ˈbʌs|n||버스
book|book|ˈbʊk|n||책
bed|bed|ˈbɛd|n||침대
time|time|ˈtaɪm|n||때 · 시간
lunch|lunch|ˈlʌntʃ|n||점심
lots|lots|ˈlɑts|n||많음|lot
fun|fun|ˈfʌn|n||재미
black|black|ˈblæk|adj||검은
white|white|ˈwaɪt|adj||흰
home|home|ˈhoʊm|n||집
Seoul|Seoul|ˈsoʊl|n||서울
left|left|ˈlɛft|v||떠났다|leave
tea|tea|ˈti|n||차
coffee|cof.fee|ˈkɔ.fi|n||커피
small|small|ˈsmɔl|adj||작은
fast|fast|ˈfæst|adj||빠른
late|late|ˈleɪt|adj||늦은
water|wa.ter|ˈwɔ.tɚ|n||물
wash|wash|ˈwɔʃ|v||씻다
hands|hands|ˈhændz|n||손|hand
call|call|ˈkɔl|v||전화하다 · 부르다
see|see|ˈsi|v||보다
cup|cup|ˈkʌp|n||잔
bread|bread|ˈbrɛd|n||빵
butter|but.ter|ˈbʌ.tɚ|n||버터
rock|rock|ˈrɑk|n||록 (음악)
roll|roll|ˈroʊl|n||롤
salt|salt|ˈsɔlt|n||소금
pepper|pep.per|ˈpɛ.pɚ|n||후추
lot|lot|ˈlɑt|n||많음
people|peo.ple|ˈpi.pəl|n||사람들
cat|cat|ˈkæt|n||고양이
cats|cats|ˈkæts|n||고양이들|cat
chase|chase|ˈtʃeɪs|v||쫓다
chased|chased|ˈtʃeɪst|v||쫓았다|chase
chasing|chas.ing|ˈtʃeɪ.sɪŋ|v||쫓는|chase
mice|mice|ˈmaɪs|n||쥐들|mouse
where|where|ˈwɛr|wh||어디
what|what|ˈwʌt|wh||무엇
who|who|ˈhu|wh||누구
looking|look.ing|ˈlʊ.kɪŋ|v||보는|look
yes|yes|ˈjɛs|intj||네
circle|cir.cle|ˈsɝ.kəl|v||동그라미 하다
word|word|ˈwɝd|n||낱말
sister|sis.ter|ˈsɪs.tɚ|n||언니 · 누나 · 여동생
new|new|ˈnu|adj||새
bike|bike|ˈbaɪk|n||자전거
students|stu.dents|ˈstu.dənts|n||학생들|student
teacher|teach.er|ˈti.tʃɚ|n||선생님
tell|tell|ˈtɛl|v||말해 주다
way|way|ˈweɪ|n||길
station|sta.tion|ˈsteɪ.ʃən|n||역
class|class|ˈklæs|n||수업
work|work|ˈwɝk|n||일 · 일터
dive|dive|ˈdaɪv|v||다이빙하다
please|please|ˈpliz|adv||부탁해요
pass|pass|ˈpæs|v||건네다
love|love|ˈlʌv|v||아주 좋아하다
ate|ate|ˈeɪt|v||먹었다|eat`;

  const DICT = {};
  const mkSyl = (s, sp) => {
    const st = s[0] === 'ˈ' ? 1 : s[0] === 'ˌ' ? 2 : 0;
    const ph = phones(s), v = ph.filter(isV);
    return { sp, ipa: s.replace(/[ˈˌ]/g, ''), st, v: v[0] || '', nv: v.length, schwa: SCHWA.indexOf(v[0]) >= 0 };
  };
  DICT_SRC.split('\n').forEach(line => {
    const [key, spell, ipa, pos, weak, gloss, lemma] = line.trim().split('|');
    const sp = spell.split('.'), ip = ipa.split('.');
    const cls = (POS[pos] || {}).cls || 'content';
    const syl = ip.map((s, i) => mkSyl(s, sp[i] || ''));
    const e = { key, w: key, spell: sp, ipa, pos, cls, gloss, lemma: lemma || key.toLowerCase(), syl };
    if (cls === 'function') { e.weak = weak || ''; e.wsyl = weak ? [mkSyl(weak, sp[0])] : syl; e.reduced = !!weak && weak !== ipa; }
    DICT[key.toLowerCase()] = e;
  });
  SR.DICT = DICT;
  const norm1 = s => String(s).toLowerCase().replace(/’/g, "'");
  const entry = k => DICT[norm1(k)] || null;
  SR.entry = entry;
  // 사전의 소리 (form = 'weak'면 기능어의 약한 형태). 한 음절 낱말은 ˈ를 빼고 적어요
  SR.ipa = (k, form) => {
    const e = entry(k); if (!e) return '';
    const s = form === 'weak' && e.cls === 'function' ? e.weak : e.ipa;
    return '/' + (e.syl.length === 1 ? s.replace('ˈ', '') : s.replace(/\./g, '')) + '/';
  };
  SR.ipaDots = k => { const e = entry(k); return e ? '/' + (e.syl.length === 1 ? e.ipa.replace('ˈ', '') : e.ipa) + '/' : ''; };
  SR.isFunction = k => { const e = entry(k); return !!e && e.cls === 'function'; };
  SR.posKo = k => { const e = entry(k); return e ? POS[e.pos].ko : ''; };

  // 대문자 띠에서 약한 형태를 읽기 쉽게 적은 것 (줄지 않는 낱말은 소문자 그대로)
  const RESPELL = { a: 'ə', an: 'ən', the: 'thə', to: 'tə', for: 'fər', of: 'əv', at: 'ət', from: 'frəm', and: 'ən', or: 'ər', but: 'bət',
    can: 'kən', will: 'wəl', have: 'həv', do: 'də', been: 'bən', am: 'əm', are: 'ər', was: 'wəz', were: 'wər', you: 'yə', them: 'thəm', your: 'yər', some: 'səm', there: 'thər' };
  SR.RESPELL = RESPELL;

  /* ---------- 문장 나누기와 강한 형태 · 약한 형태 ----------
     tokens(text) → [{ t: 쓴 글자, k: 사전 열쇠, e, i: 낱말 번호, first, end: 뒤가 . ? ! , 또는 끝, quote: 따옴표 안 }]
     formOf: 내용어 → 강(content) · 강조로 적은 낱말 → 강(focus) · 따옴표 속 낱말 자체 → 강(quote) ·
             뒤에 동사가 없는 조동사 · be 동사(혼자 대답) → 강(alone) · 문장 · 마디 끝의 전치사 → 강(end) · 나머지 기능어 → 약(weak)
             대명사는 문장 끝에서도 약해요(Call them.) · 질문을 여는 조동사도 약해요(Can you …? · Do you …?) */
  const WORD_RE = /([A-Za-z]+(?:['’][A-Za-z]+)?)/;
  SR.tokens = function (text) {
    const parts = String(text).split(WORD_RE), out = [];
    for (let j = 1; j < parts.length; j += 2) {
      const prev = parts[j - 1] || '', next = parts[j + 1] || '';
      const after = next.replace(/^[”"’]+/, '').trim(), last = j + 2 >= parts.length;
      out.push({ t: parts[j], k: norm1(parts[j]), e: entry(parts[j]), i: out.length, first: out.length === 0,
        quote: /[“"‘]\s*$/.test(prev) && /^[”"’]/.test(next), end: last || /^[.?!,;]/.test(after) });
    }
    return out;
  };
  const WHY = {
    content: { ko: '내용어', long: '뜻을 나르는 낱말이라 세요' },
    focus: { ko: '강조', long: '힘주어 대조하는 낱말이라 강한 형태예요' },
    quote: { ko: '인용', long: '낱말 자체를 말해서 강한 형태예요' },
    alone: { ko: '혼자 대답', long: '뒤에 동사가 없어 강한 형태로 돌아와요' },
    end: { ko: '문장 끝', long: '문장 끝의 전치사라 강한 형태로 돌아와요' },
    weak: { ko: '약한 형태', long: '문법을 잇는 낱말이라 짧고 약해요' },
    unknown: { ko: '사전에 없음', long: '사전에 없는 낱말' },
  };
  SR.WHY = WHY;
  const cache = new Map();
  SR.analyze = function (text, o = {}) {
    const focus = o.focus || SR.focusOf(text);
    const ck = text + '|' + focus.join(',');
    if (cache.has(ck)) return cache.get(ck);
    const ws = SR.tokens(text);
    ws.forEach(w => {
      const e = w.e;
      let why;
      if (!e) why = 'unknown';
      else if (e.cls === 'content') why = 'content';
      else if (focus.indexOf(w.i) >= 0) why = 'focus';
      else if (w.quote) why = 'quote';
      else if (w.end && (e.pos === 'aux' || e.pos === 'be')) why = 'alone';
      else if (w.end && e.pos === 'prep') why = 'end';
      else why = 'weak';
      w.why = why;
      w.form = why === 'weak' ? 'weak' : 'strong';
      w.ret = !!e && e.cls === 'function' && w.form === 'strong';   // 강한 형태로 돌아온 기능어
    });
    cache.set(ck, ws);
    return ws;
  };
  // 강조(대조)로 읽는 낱말은 문장 데이터에 적어요
  const FOCUS = {};
  SR.focusOf = text => FOCUS[text] || [];
  SR.formOf = (text, i) => { const w = SR.analyze(text)[i]; return w ? { form: w.form, why: w.why } : null; };
  SR.wordAt = (text, k) => SR.analyze(text).find(w => w.k === norm1(k)) || null;
  SR.strongWords = text => SR.analyze(text).filter(w => w.form === 'strong');
  SR.strongCount = text => SR.strongWords(text).length;
  SR.returned = text => SR.analyze(text).filter(w => w.ret).map(w => w.k);

  /* ---------- 음절과 세기 ----------
     lv 1 = 센 낱말의 센 음절 · 2 = 센 낱말의 다른 음절 · 3 = 약한 낱말 */
  SR.sylls = function (text) {
    const out = [];
    SR.analyze(text).forEach(w => {
      const e = w.e;
      if (!e) { out.push({ sp: w.t, ipa: '', lv: 1, w: w.i, k: w.k, wi: 0 }); return; }
      const syl = w.form === 'weak' ? e.wsyl : e.syl;
      let at = 0;
      syl.forEach((s, wi) => {
        const t = w.t.slice(at, at + s.sp.length); at += s.sp.length;
        const lv = w.form === 'weak' ? 3 : (e.cls === 'function' || s.st === 1) ? 1 : 2;
        out.push({ sp: t || s.sp, ipa: s.ipa, lv, w: w.i, k: w.k, wi, schwa: s.schwa, ret: w.ret });
      });
    });
    return out;
  };
  SR.levels = text => SR.sylls(text).map(s => s.lv);
  SR.nSyl = text => SR.sylls(text).length;
  SR.weakIdx = text => SR.levels(text).map((l, i) => l === 3 ? i : -1).filter(i => i >= 0);
  // 구 전체의 가장 센 음절(핵 강세): 강조 · 인용한 낱말이 있으면 그 낱말. 아니면 마지막 억양 마디(마지막 쉼표 뒤)의 마지막 내용어의 센 음절.
  // 강한 형태로 돌아온 기능어(문장 끝 전치사 · 혼자 대답)는 셈(세기 1)이지만 핵 강세는 가져가지 않아요 — 마디에 내용어가 없을 때만(Yes, I can.)
  // 의문사 말고는 내용어가 없는 물음(Where are you from? · Who is it for?)은 끝으로 돌아온 전치사가 핵 강세예요
  SR.nuclear = text => {
    const sy = SR.sylls(text), ws = SR.analyze(text);
    const fw = ws.find(w => w.why === 'focus' || w.why === 'quote');
    if (fw) { const k = sy.findIndex(s => s.w === fw.i && s.lv === 1); if (k >= 0) return k; }
    let start = 0;
    ws.forEach((w, i) => { if (w.end && i < ws.length - 1) start = i + 1; });
    const retAfter = i => ws.some(w => w.i > i && w.i >= start && w.ret);
    const isContent = s => { const e = ws[s.w].e; return !!e && e.cls === 'content' && !(e.pos === 'wh' && retAfter(s.w)); };
    for (let i = sy.length - 1; i >= 0; i--) if (sy[i].lv === 1 && sy[i].w >= start && isContent(sy[i])) return i;
    for (let i = sy.length - 1; i >= 0; i--) if (sy[i].lv === 1 && sy[i].w >= start) return i;
    for (let i = sy.length - 1; i >= 0; i--) if (sy[i].lv === 1) return i;
    return 0;
  };
  SR.nuclearWord = text => { const s = SR.sylls(text)[SR.nuclear(text)]; return s ? s.k : ''; };
  // 센 음절 사이에 낀 다른 음절 수
  SR.gaps = text => { const L = SR.levels(text), at = L.map((l, i) => l === 1 ? i : -1).filter(i => i >= 0); return at.slice(1).map((x, k) => x - at[k] - 1); };
  // 음절 공의 기본 모양 (잰 값이 없을 때): L 길이 · A 크기 · H 높이(반음)
  SR.schematic = text => { const L = SR.levels(text), nu = SR.nuclear(text); return L.map((l, i) => l === 1 ? { L: 1, A: 1, H: i === nu ? 5 : 3.5 } : l === 2 ? { L: 0.62, A: 0.66, H: 1.5 } : { L: 0.4, A: 0.46, H: 0 }); };
  SR.koSchematic = n => Array.from({ length: n }, () => ({ L: 0.92, A: 0.9, H: 1 }));
  // 한국어식 표기의 음절(한글 글자)
  SR.koSyl = ko => [...String(ko)].filter(c => /[가-힣]/.test(c));
  SR.koN = ko => SR.koSyl(ko).length;

  // 대문자 띠: 센 낱말의 센 음절은 대문자, 강한 형태로 돌아온 기능어는 대문자, 약한 형태는 읽기 쉽게 적은 약한 소리
  SR.capsWord = w => {
    const e = w.e;
    if (!e) return w.t;
    if (w.form === 'weak') return e.reduced && RESPELL[w.k] ? RESPELL[w.k] : w.t.toLowerCase();
    if (e.cls === 'function') return w.t.toUpperCase();
    let at = 0;
    return e.syl.map(s => { const t = w.t.slice(at, at + s.sp.length); at += s.sp.length; return s.st === 1 ? t.toUpperCase() : t.toLowerCase(); }).join('');
  };
  SR.caps = text => SR.analyze(text).map(SR.capsWord).join(' ');

  // 칠하기 조각: role = str(센 낱말의 센 음절) · str2(센 낱말의 다른 음절) · ret(강한 형태로 돌아온 기능어) · weak(약한 낱말) · null(띄어쓰기 · 문장 부호)
  SR.segs = function (text) {
    const parts = String(text).split(WORD_RE), ws = SR.analyze(text), out = [];
    let wi = 0;
    parts.forEach((p, j) => {
      if (!p) return;
      if (j % 2 === 0) { out.push({ t: p, role: null }); return; }
      const w = ws[wi++], e = w.e;
      if (!e) { out.push({ t: p, role: null, w: w.i }); return; }
      if (w.form === 'weak') { out.push({ t: p, role: 'weak', w: w.i }); return; }
      if (e.cls === 'function') { out.push({ t: p, role: 'ret', w: w.i }); return; }
      let at = 0;
      e.syl.forEach(s => { const t = p.slice(at, at + s.sp.length); at += s.sp.length; out.push({ t, role: s.st === 1 ? 'str' : 'str2', w: w.i }); });
    });
    return out;
  };

  /* ---------- 목소리 넷 (듣고 가르기 · 연습 문제) ---------- */
  SR.VOICES = [
    { sp: 'tc', ko: '밝은 선생님', who: '미국 여성' },
    { sp: 'tf', ko: '차분한 선생님', who: '미국 여성' },
    { sp: 'uf', ko: '미국 여성', who: '미국 여성' },
    { sp: 'um', ko: '미국 남성', who: '미국 남성' },
  ];

  /* ---------- 들어가며: 한국어식 · 영어 ----------
     한국어식 소리(ko)는 들어가며 · 센 낱말 사이 간격 · 연습 문제 ‘한국어식은 어느 쪽’에서만 써요 */
  SR.INTRO = { en: 'I want to go to the store.', ko: '아이 원트 투 고 투 더 스토어', mean: '가게에 가고 싶어요.' };

  /* ---------- can · can't 짝 (그 낱말만 달라요) ---------- */
  SR.CAN = [
    { id: 'go', can: 'I can go.', cant: "I can't go.", ko: ['갈 수 있어요.', '갈 수 없어요.'] },
    { id: 'swim', can: 'I can swim.', cant: "I can't swim.", ko: ['수영할 수 있어요.', '수영 못 해요.'] },
    { id: 'drive', can: 'She can drive.', cant: "She can't drive.", ko: ['그녀는 운전할 수 있어요.', '그녀는 운전 못 해요.'] },
    { id: 'park', can: 'You can park here.', cant: "You can't park here.", ko: ['여기 주차해도 돼요.', '여기 주차하면 안 돼요.'] },
    { id: 'come', can: 'We can come today.', cant: "We can't come today.", ko: ['우리는 오늘 올 수 있어요.', '우리는 오늘 못 와요.'] },
    { id: 'cook', can: 'He can cook.', cant: "He can't cook.", ko: ['그는 요리할 수 있어요.', '그는 요리 못 해요.'] },
  ];
  SR.canPair = id => SR.CAN.find(p => p.id === id) || null;
  // 받아 적은 글이 can인지 can't인지 (cannot · can not · cant도 can't)
  SR.canForm = s => {
    const t = ' ' + String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z' ]+/g, ' ') + ' ';
    if (/\s(can't|cannot|cant)\s/.test(t) || /\scan not\s/.test(t)) return 'cant';
    if (/\scan\s/.test(t)) return 'can';
    return null;
  };

  /* ---------- 약한 형태 카드 열여덟 (영상에는 앞의 열 장) ---------- */
  SR.WEAK = [
    { k: 'to', ex: 'go to bed', ko: '자러 가다' },
    { k: 'for', ex: 'time for lunch', ko: '점심 먹을 시간' },
    { k: 'of', ex: 'lots of fun', ko: '아주 재미있음' },
    { k: 'and', ex: 'black and white', ko: '흑백' },
    { k: 'can', ex: 'I can go.', ko: '갈 수 있어요.' },
    { k: 'a', ex: 'a book', ko: '책 한 권' },
    { k: 'the', ex: 'the bus', ko: '그 버스' },
    { k: 'at', ex: 'at home', ko: '집에서' },
    { k: 'from', ex: 'from Seoul', ko: '서울에서' },
    { k: 'have', ex: 'They have left.', ko: '그들은 떠났어요.' },
    { k: 'or', ex: 'tea or coffee', ko: '차 아니면 커피' },
    { k: 'but', ex: 'small but fast', ko: '작지만 빨라요' },
    { k: 'was', ex: 'It was fun.', ko: '재미있었어요.' },
    { k: 'are', ex: 'We are late.', ko: '우리 늦었어요.' },
    { k: 'some', ex: 'some water', ko: '물 조금' },
    { k: 'your', ex: 'Wash your hands.', ko: '손 씻으세요.' },
    { k: 'them', ex: 'Call them.', ko: '그들에게 전화하세요.' },
    { k: 'you', ex: 'See you!', ko: '또 봐요!' },
  ];
  SR.WEAK_SHOWN = 10;
  SR.weakCard = k => SR.WEAK.find(c => c.k === k) || null;

  /* ---------- 붙여서 한 덩어리 ---------- */
  SR.CHUNKS = [
    { en: 'a cup of tea', ko: '차 한 잔' },
    { en: 'bread and butter', ko: '버터 바른 빵' },
    { en: 'rock and roll', ko: '로큰롤' },
    { en: 'salt and pepper', ko: '소금과 후추' },
    { en: 'a lot of people', ko: '많은 사람' },
    { en: 'I want to go.', ko: '가고 싶어요.' },
  ];

  /* ---------- 센 낱말 사이 간격: 늘어나는 문장 ---------- */
  SR.STRETCH = [
    { en: 'Cats chase mice.', ko: '고양이는 쥐를 쫓아요.' },
    { en: 'The cats have chased the mice.', ko: '고양이들이 쥐들을 쫓았어요.' },
    { en: 'The cats will have been chasing the mice.', ko: '고양이들이 쥐들을 쫓고 있었을 거예요.' },
  ];
  SR.STRETCH_KO = { ko: '더 캣츠 윌 해브 빈 체이싱 더 마이스', of: 2 };   // 셋째 문장을 한국어식으로
  SR.isStretch = text => SR.STRETCH.some(s => s.en === text) || text === SR.STRETCH_KO.ko;
  // 한국어식 줄: [한글, 원래 영어 문장, 음절 수]
  SR.KO_LINES = [[SR.INTRO.ko, SR.INTRO.en, 11], [SR.STRETCH_KO.ko, SR.STRETCH[SR.STRETCH_KO.of].en, 14], ['어 컵 오브 티', 'a cup of tea', 5]];

  /* ---------- 강한 형태로 돌아오는 자리 ----------
     ret: 강한 형태로 돌아오는 기능어 · why: 그 까닭 · focus: 강조로 읽는 낱말 번호(데이터에 적음) */
  SR.STRONG = [
    { en: 'Where are you from?', ko: '어디에서 왔어요?', ret: ['from'], why: 'end' },
    { en: 'What are you looking at?', ko: '무엇을 보고 있어요?', ret: ['at'], why: 'end' },
    { en: 'Who is it for?', ko: '누구에게 줄 거예요?', ret: ['for'], why: 'end' },
    { en: 'Yes, I can.', ko: '네, 할 수 있어요.', ret: ['can'], why: 'alone' },
    { en: 'Yes, I am.', ko: '네, 맞아요.', ret: ['am'], why: 'alone' },
    { en: 'I can swim!', ko: '나 수영할 수 있다니까요!', ret: ['can'], why: 'focus', focus: [1] },
    { en: 'Circle the word “to”.', ko: '낱말 to에 동그라미 하세요.', ret: ['to'], why: 'quote' },
  ];
  SR.STRONG.forEach(s => { if (s.focus) FOCUS[s.en] = s.focus; });
  // 끝에 와도 약한 채로: 대명사
  SR.STAY_WEAK = ['Call them.', 'See you!'];

  /* ---------- 문장 속에서: 긴 문장 셋 ---------- */
  SR.LONG = [
    { en: 'My sister wants a new bike.', ko: '언니는 새 자전거를 갖고 싶어 해요.' },
    { en: 'The students are waiting for the teacher.', ko: '학생들이 선생님을 기다리고 있어요.' },
    { en: 'Can you tell me the way to the station?', ko: '역에 가는 길을 알려 줄 수 있어요?' },
  ];

  /* ---------- 따라 말하기 28문장 (묶음마다 일곱) ---------- */
  SR.SGRP = {
    weak: { ko: '약한 형태', long: '약한 형태 — 짧게, 흐린 어로' },
    can: { ko: 'can과 can\'t', long: 'can과 can\'t — 모음과 세기로' },
    chunk: { ko: '덩어리', long: '덩어리 — 약한 낱말을 붙여서' },
    strong: { ko: '강한 형태', long: '강한 형태로 돌아옴 — 끝 · 대답 · 강조' },
  };
  SR.SGRP_ORDER = ['weak', 'can', 'chunk', 'strong'];
  SR.SENT = [
    { grp: 'weak', en: 'I want to go to the store.', ko: '가게에 가고 싶어요.' },
    { grp: 'weak', en: 'The kids are waiting for the bus.', ko: '아이들이 버스를 기다리고 있어요.' },
    { grp: 'weak', en: 'We are late for class.', ko: '우리 수업에 늦었어요.' },
    { grp: 'weak', en: 'It was fun.', ko: '재미있었어요.' },
    { grp: 'weak', en: 'Wash your hands.', ko: '손 씻으세요.' },
    { grp: 'weak', en: 'Do you want some water?', ko: '물 좀 마실래요?' },
    { grp: 'weak', en: 'They have left for work.', ko: '그들은 일하러 나갔어요.' },
    { grp: 'can', en: 'I can go.', ko: '갈 수 있어요.' },
    { grp: 'can', en: "I can't go.", ko: '갈 수 없어요.' },
    { grp: 'can', en: 'She can drive.', ko: '그녀는 운전할 수 있어요.' },
    { grp: 'can', en: "She can't drive.", ko: '그녀는 운전 못 해요.' },
    { grp: 'can', en: 'You can park here.', ko: '여기 주차해도 돼요.' },
    { grp: 'can', en: "You can't park here.", ko: '여기 주차하면 안 돼요.' },
    { grp: 'can', en: "I can swim, but I can't dive.", ko: '수영은 할 수 있지만 다이빙은 못 해요.' },
    { grp: 'chunk', en: 'A cup of tea, please.', ko: '차 한 잔 주세요.' },
    { grp: 'chunk', en: 'Pass the salt and pepper.', ko: '소금과 후추 좀 건네주세요.' },
    { grp: 'chunk', en: 'I love rock and roll.', ko: '저는 로큰롤을 아주 좋아해요.' },
    { grp: 'chunk', en: 'We ate bread and butter.', ko: '우리는 버터 바른 빵을 먹었어요.' },
    { grp: 'chunk', en: 'There were a lot of people.', ko: '사람이 많았어요.' },
    { grp: 'chunk', en: 'I want to go home.', ko: '집에 가고 싶어요.' },
    { grp: 'chunk', en: 'The cat is black and white.', ko: '그 고양이는 검은색과 흰색이에요.' },
  ].concat(SR.STRONG.map(s => ({ grp: 'strong', en: s.en, ko: s.ko })));
  // 센 낱말 찾기(놀이터)에 쓰는 문장: 따라 말하기 28 + 긴 문장 셋
  SR.FIND_POOL = SR.SENT.map(s => s.en).concat(SR.LONG.map(s => s.en));
  SR.meaning = text => {
    const all = SR.SENT.concat(SR.LONG, SR.STRETCH, SR.CHUNKS, SR.STRONG, [SR.INTRO]);
    const s = all.find(x => x.en === text);
    if (s) return s.mean || s.ko;
    const c = SR.CAN.find(p => p.can === text || p.cant === text);
    if (c) return c.ko[c.can === text ? 0 : 1];
    const wk = SR.WEAK.find(x => x.ex === text);
    return wk ? wk.ko : '';
  };

  /* ---------- 짧은 구: 음절을 재는 줄 (2~6음절, 늘이기 문장은 문장 길이만) ---------- */
  SR.PHRASES = (() => {
    const set = [];
    const add = t => { if (set.indexOf(t) < 0) set.push(t); };
    SR.CAN.forEach(p => { add(p.can); add(p.cant); });
    SR.WEAK.forEach(c => add(c.ex));
    SR.CHUNKS.forEach(c => add(c.en));
    SR.STRONG.forEach(s => add(s.en));
    return set;
  })();
  SR.isPhrase = text => SR.PHRASES.indexOf(text) >= 0 && SR.nSyl(text) >= 2 && SR.nSyl(text) <= 6;

  /* ---------- 음성 인식: 받아 적은 글이 목표 쪽인가 (can · can't) ---------- */
  SR.heard = function (target, alts) {
    const want = SR.canForm(target), other = want === 'can' ? 'cant' : 'can';
    alts = (alts || []).filter(Boolean);
    if (!alts.length) return { verdict: 'none', heard: '', want };
    const top = alts[0], f = SR.canForm(top);
    if (f === want) return { verdict: 'target', heard: top, want, got: f };
    if (f === other) return { verdict: 'partner', heard: top, want, got: f };
    const k = alts.findIndex(a => SR.canForm(a) === want);
    if (k > 0) return { verdict: 'maybe', heard: top, rank: k + 1, want };
    return { verdict: 'other', heard: top, want };
  };
  SR.HEARD_KO = {
    target: '말하려던 쪽으로 받아 적었어요',
    partner: '반대쪽으로 받아 적었어요',
    maybe: '첫째 후보는 아니지만 후보에 있었어요',
    other: 'can도 can\'t도 찾지 못했어요',
    none: '아무 말도 듣지 못했어요',
  };
  SR.FORM_KO = { can: 'can (할 수 있다)', cant: 'can\'t (할 수 없다)' };

  /* ---------- 따라 말하기: 낱말 맞추기 ----------
     인식기는 for를 four로, to를 two · too로, can't를 cannot으로 적기도 해요 — 같은 낱말로 쳐요 */
  const NUMW = { 2: 'two', 4: 'four' };
  const SAME = { for: ['four', 'fore'], to: ['two', 'too'], "can't": ['cannot', 'cant'], you: ['ya'], and: ['n'], of: ['a'] };
  const words = s => String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\bcan not\b/g, "can't")
    .replace(/\b(\d+)\b/g, (m, d) => NUMW[d] || d).replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const norm = w => w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  SR.compareWords = function (target, heard) {
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
     kind: can(can인가 can't인가) · count(센 낱말이 몇 개?) · which(어느 낱말이 세게?) · ko(한국어식은 어느 쪽?) · end(그 전치사는 강한가 약한가)
     a: 정답 보기 번호(0부터) — 엔진이 다시 계산해 맞춰 봐요 */
  const COUNT_OPTS = ['두 개', '세 개', '네 개'];
  const FORM_OPTS = ['강한 형태', '약한 형태'];
  SR.COUNT_OPTS = COUNT_OPTS; SR.FORM_OPTS = FORM_OPTS;
  SR.DRILL = [
    { kind: 'can', sp: 'tc', say: "I can't go.", a: 1 },
    { kind: 'count', sp: 'uf', say: 'a cup of tea', a: 0 },
    { kind: 'which', sp: 'uf', say: 'Where are you from?', opts: ['from', 'are', 'you'], a: 0 },
    { kind: 'ko', seq: [{ text: '어 컵 오브 티', sp: 'ko' }, { text: 'a cup of tea', sp: 'tc' }], en: 'a cup of tea', a: 0 },
    { kind: 'can', sp: 'uf', say: 'She can drive.', a: 0 },
    { kind: 'end', sp: 'tf', say: 'What are you looking at?', w: 'at', a: 0 },
    { kind: 'count', sp: 'tc', say: 'The kids are waiting for the bus.', a: 1 },
    { kind: 'can', sp: 'um', say: "You can't park here.", a: 1 },
    { kind: 'which', sp: 'tf', say: 'a lot of people', opts: ['a', 'lot', 'of'], a: 1 },
    { kind: 'end', sp: 'uf', say: 'We are late for class.', w: 'for', a: 1 },
    { kind: 'can', sp: 'tf', say: 'We can come today.', a: 0 },
    { kind: 'ko', seq: [{ text: 'I want to go to the store.', sp: 'tc' }, { text: '아이 원트 투 고 투 더 스토어', sp: 'ko' }], en: 'I want to go to the store.', a: 1 },
    { kind: 'count', sp: 'um', say: 'My sister wants a new bike.', a: 2 },
    { kind: 'which', sp: 'tc', say: 'Pass the salt and pepper.', opts: ['the', 'and', 'salt'], a: 2 },
    { kind: 'end', sp: 'um', say: 'Who is it for?', w: 'for', a: 0 },
    { kind: 'can', sp: 'uf', say: "He can't cook.", a: 1 },
  ];
  SR.DRILL.forEach(q => {
    if (q.kind === 'can') q.opts = ['can', "can't"];
    if (q.kind === 'count') q.opts = COUNT_OPTS.slice();
    if (q.kind === 'ko') { q.opts = ['첫째 소리', '둘째 소리']; q.sp = q.seq[q.a === 0 ? 1 : 0].sp; }
    if (q.kind === 'end') q.opts = FORM_OPTS.slice();
  });
  SR.drillText = q => q.kind === 'ko' ? q.en : q.say;
  // 엔진이 계산한 정답
  SR.drillAnswer = q => {
    if (q.kind === 'can') return SR.canForm(q.say) === 'cant' ? 1 : 0;
    if (q.kind === 'count') return SR.strongCount(q.say) - 2;
    if (q.kind === 'which') { const st = q.opts.map(w => { const x = SR.wordAt(q.say, w); return !!x && x.form === 'strong'; }); return st.filter(Boolean).length === 1 ? st.indexOf(true) : -1; }
    if (q.kind === 'ko') return q.seq.findIndex(it => it.sp === 'ko');
    if (q.kind === 'end') { const x = SR.wordAt(q.say, q.w); return x ? (x.form === 'strong' ? 0 : 1) : -1; }
    return -1;
  };
  // 짝 문장 (can · can't 문제의 견줘 듣기)
  SR.partnerOf = text => { const p = SR.CAN.find(x => x.can === text || x.cant === text); return p ? (p.can === text ? p.cant : p.can) : null; };
  // 힌트 = 3단계 발음법
  SR.hints = function (q) {
    if (q.kind === 'can') {
      const p = SR.CAN.find(x => x.can === q.say || x.cant === q.say);
      return [
        { head: '① 듣고 가르기', text: '가운데 낱말을 들어요. 짧고 흐리게 지나가나요, 길고 또렷하게 끌리나요?' },
        { head: '② 소리 만들기', text: 'can → 짧은 약한 형태(kən, 흐린 어). can\'t → 길고 센 낱말(æ, 또렷한 애). 끝의 t 소리는 거의 들리지 않을 때가 많아요.' },
        { head: '③ 문장 속에서', text: `센 낱말의 수가 달라요 → ${p.can} 센 낱말 ${SR.strongCount(p.can)}개 · ${p.cant} 센 낱말 ${SR.strongCount(p.cant)}개.` },
      ];
    }
    if (q.kind === 'count') {
      return [
        { head: '① 듣고 가르기', text: '문장을 들으며 길고 크게 들린 낱말에서 손뼉을 쳐요. 짧게 지나간 낱말은 세지 않아요.' },
        { head: '② 소리 만들기', text: '뜻을 나르는 낱말(명사 · 본동사 · 형용사 · 부사)은 세게, 관사 · 전치사 · 조동사 · 대명사는 약하게 나와요.' },
        { head: '③ 문장 속에서', text: `이 문장의 낱말은 모두 ${SR.tokens(q.say).length}개예요. 약한 낱말을 빼고 세어 봐요.` },
      ];
    }
    if (q.kind === 'which') {
      return [
        { head: '① 듣고 가르기', text: '보기 셋 가운데 길고 크게 들린 낱말 하나를 찾아요.' },
        { head: '② 소리 만들기', text: '보기의 갈래 → ' + q.opts.map(w => `${w} = ${SR.posKo(w)}`).join(' · ') + '.' },
        { head: '③ 문장 속에서', text: SR.returned(q.say).length ? '문장 끝의 전치사는 강한 형태로 돌아와요. 끝인지 먼저 봐요.' : '관사 · 접속사 · 전치사는 문장 가운데에서 보통 약해요.' },
      ];
    }
    if (q.kind === 'ko') {
      const ko = q.seq.find(it => it.sp === 'ko').text;
      return [
        { head: '① 듣고 가르기', text: '두 소리를 차례로 들어요. 낱말마다 같은 세기로 또박또박 나오는 쪽이 있어요.' },
        { head: '② 소리 만들기', text: '영어 리듬은 센 낱말만 길고 크게, 약한 낱말은 짧게 붙여요.' },
        { head: '③ 문장 속에서', text: `한국어식은 약한 낱말의 모음도 그대로 살려요 → ${ko}` },
      ];
    }
    const x = SR.wordAt(q.say, q.w);
    return [
      { head: '① 듣고 가르기', text: `${q.w} 소리를 들어요. 또렷한 모음인가요, 흐린 어인가요?` },
      { head: '② 소리 만들기', text: `강한 형태 ${SR.ipa(q.w)} · 약한 형태 ${SR.ipa(q.w, 'weak')}.` },
      { head: '③ 문장 속에서', text: x && x.why === 'end' ? `${q.w} 뒤에 낱말이 없나요? 문장 끝의 전치사는 강한 형태로 돌아와요.` : `${q.w} 뒤에 낱말이 이어지나요? 문장 가운데의 전치사는 보통 약한 형태예요.` },
    ];
  };

  /* ---------- 캔버스 글자 모음 (글꼴 미리 받기) ---------- */
  SR.allText = () => {
    const texts = SR.SENT.concat(SR.LONG, SR.STRETCH, SR.CHUNKS, [SR.INTRO]).map(s => s.en + (s.ko || '') + SR.caps(s.en)).join('') +
      SR.CAN.map(p => p.can + p.cant + p.ko.join('') + SR.caps(p.can) + SR.caps(p.cant)).join('') +
      SR.WEAK.map(c => c.ex + c.ko + SR.caps(c.ex)).join('');
    return Object.values(DICT).map(e => e.w + e.w.toUpperCase() + e.spell.join('·') + e.ipa + (e.weak || '') + e.gloss).join('') + texts +
      Object.values(SR.SGRP).map(g => g.ko + g.long).join('') + Object.values(POS).map(p => p.ko).join('') + Object.values(WHY).map(w => w.ko + w.long).join('') +
      Object.values(SR.CLS).map(c => c.ko + c.long).join('') + SR.VOICES.map(v => v.ko + v.who).join('') + Object.values(RESPELL).join('') +
      SR.INTRO.ko + SR.STRETCH_KO.ko + '어 컵 오브 티' + COUNT_OPTS.join('') + FORM_OPTS.join('');
  };

  /* ---------- 데이터 점검 ---------- */
  SR.check = function () {
    const warn = [];
    const w = m => warn.push(m);
    // 사전: 철자 조각 = 음절, 내용어는 센 음절 하나, 기능어는 한 음절에 약한 형태
    Object.values(DICT).forEach(e => {
      if (e.spell.length !== e.syl.length) w(`${e.key}: 철자 조각 ${e.spell.length}개 ≠ 음절 ${e.syl.length}개`);
      if (e.spell.join('').toLowerCase() !== e.w.toLowerCase()) w(`${e.key}: 철자 조각을 이으면 ${e.spell.join('')}`);
      e.syl.forEach((s, i) => { if (s.nv !== 1) w(`${e.key}: ${i + 1}째 음절의 모음이 ${s.nv}개`); });
      if (!POS[e.pos]) w(`${e.key}: 모르는 품사 ${e.pos}`);
      if (e.cls === 'content' && e.syl.filter(s => s.st === 1).length !== 1) w(`${e.key}: 내용어인데 센 음절이 하나가 아님`);
      if (e.cls === 'function') {
        if (e.syl.length !== 1 || e.syl[0].st) w(`${e.key}: 기능어는 강세 표시 없는 한 음절로 적어요`);
        if (!e.weak) w(`${e.key}: 기능어인데 약한 형태가 없음`);
        else {
          try { phones(e.weak); } catch (err) { w(`${e.key}: 약한 형태 ${err.message}`); }
          if (e.wsyl[0].nv !== 1) w(`${e.key}: 약한 형태의 모음이 하나가 아님`);
          if (e.reduced && !RESPELL[e.key.toLowerCase()]) w(`${e.key}: 대문자 띠의 약한 소리 표기가 없음`);
          if (e.reduced && !e.wsyl[0].schwa && e.weak.length >= e.ipa.length) w(`${e.key}: 약한 형태가 줄지 않음 ${e.ipa} → ${e.weak}`);
        }
      } else if (e.weak) w(`${e.key}: 내용어에 약한 형태`);
    });
    Object.keys(RESPELL).forEach(k => { if (!DICT[k] || !DICT[k].reduced) w(`대문자 띠 ${k}: 줄어드는 기능어가 아님`); });
    // 모든 문장의 낱말이 사전에 있음
    const texts = [SR.INTRO.en].concat(SR.CAN.map(p => p.can), SR.CAN.map(p => p.cant), SR.WEAK.map(c => c.ex), SR.CHUNKS.map(c => c.en),
      SR.STRETCH.map(s => s.en), SR.STRONG.map(s => s.en), SR.STAY_WEAK, SR.LONG.map(s => s.en), SR.SENT.map(s => s.en), SR.DRILL.map(SR.drillText));
    texts.forEach(t => SR.tokens(t).forEach(x => { if (!x.e) w(`"${t}": 사전에 없는 낱말 ${x.t}`); }));
    // 강한 형태로 돌아오는 자리: 데이터에 적은 것과 엔진이 같은지 (적지 않은 문장은 돌아오는 낱말이 없어야 해요)
    const marked = {};
    SR.STRONG.forEach(s => { marked[s.en] = s; });
    texts.forEach(t => {
      const got = SR.returned(t), s = marked[t], want = s ? s.ret : [];
      if (got.join() !== want.join()) w(`"${t}": 강한 형태로 돌아오는 낱말 ${got.join() || '없음'} ≠ 데이터 ${want.join() || '없음'}`);
      if (s) s.ret.forEach(k => { const x = SR.wordAt(t, k); if (!x || x.why !== s.why) w(`"${t}": ${k}의 까닭 ${x ? x.why : '없음'} ≠ 데이터 ${s.why}`); });
    });
    SR.STAY_WEAK.forEach(t => { const ws = SR.analyze(t), last = ws[ws.length - 1]; if (!(last.e && last.e.pos === 'pron' && last.form === 'weak')) w(`"${t}": 끝의 대명사가 약하지 않음`); });
    // can · can't 짝: 그 낱말만 다르고, can은 약하고 can't는 셈
    SR.CAN.forEach(p => {
      const A = SR.tokens(p.can).map(x => x.k), B = SR.tokens(p.cant).map(x => x.k);
      const diff = A.map((k, i) => k !== B[i] ? i : -1).filter(i => i >= 0);
      if (A.length !== B.length || diff.length !== 1 || A[diff[0]] !== 'can' || B[diff[0]] !== "can't") w(`can 짝 ${p.id}: can · can't만 달라야 해요`);
      if (p.can.replace('can', "can't") !== p.cant) w(`can 짝 ${p.id}: 글이 can → can't 바꿈과 다름`);
      const a = SR.wordAt(p.can, 'can'), b = SR.wordAt(p.cant, "can't");
      if (!a || a.form !== 'weak') w(`can 짝 ${p.id}: can이 약하지 않음`);
      if (!b || b.form !== 'strong') w(`can 짝 ${p.id}: can't가 세지 않음`);
      if (SR.strongCount(p.cant) !== SR.strongCount(p.can) + 1) w(`can 짝 ${p.id}: 센 낱말 수가 하나 차이가 아님`);
      if (SR.canForm(p.can) !== 'can' || SR.canForm(p.cant) !== 'cant') w(`can 짝 ${p.id}: 받아 적기 가르기(canForm)`);
    });
    if (SR.canForm('I cannot go') !== 'cant' || SR.canForm('I can not go') !== 'cant' || SR.canForm('I can go') !== 'can' || SR.canForm('I go') !== null) w('canForm: cannot · can not · can 가르기');
    // 약한 형태 카드: 그 낱말이 보기 구에서 약한 형태
    SR.WEAK.forEach(c => {
      const e = entry(c.k), x = SR.wordAt(c.ex, c.k);
      if (!e || e.cls !== 'function') w(`약한 형태 카드 ${c.k}: 기능어가 아님`);
      if (!x) w(`약한 형태 카드 ${c.k}: 보기 구 "${c.ex}"에 없음`);
      else if (x.form !== 'weak') w(`약한 형태 카드 ${c.k}: "${c.ex}"에서 약하지 않음`);
    });
    SR.WEAK.slice(0, SR.WEAK_SHOWN).forEach(c => { if (!entry(c.k).reduced) w(`영상 카드 ${c.k}: 모음이 줄지 않는 낱말`); });
    // 덩어리: 센 낱말 둘 이상 + 약한 음절 하나 이상
    SR.CHUNKS.forEach(c => { if (SR.strongCount(c.en) < 2 || !SR.weakIdx(c.en).length) w(`덩어리 "${c.en}": 센 낱말 둘 · 약한 음절이 필요`); });
    // 늘이기: 센 낱말은 뿌리가 같은 셋(cat · chase · mouse), 약한 낱말만 다르고, 음절은 늘어남
    const lem = t => SR.strongWords(t).map(x => x.e.lemma).join(' ');
    SR.STRETCH.forEach(s => { if (lem(s.en) !== 'cat chase mouse') w(`늘이기 "${s.en}": 센 낱말 ${lem(s.en)}`); });
    const ns = SR.STRETCH.map(s => SR.nSyl(s.en));
    if (!(ns[0] < ns[1] && ns[1] < ns[2])) w(`늘이기: 음절 수가 늘지 않음 ${ns.join()}`);
    if (ns.join() !== '3,6,9') w(`늘이기: 음절 수 ${ns.join()} (화면과 자막은 셋 · 여섯 · 아홉)`);
    SR.STRETCH.forEach(s => SR.analyze(s.en).forEach(x => { if (x.e && x.e.cls === 'function' && x.form !== 'weak') w(`늘이기 "${s.en}": ${x.t}가 약하지 않음`); }));
    // 한국어식: 낱말 수는 영어와 같고(기능어도 한 낱말씩 또박또박), 음절은 영어보다 많음
    SR.KO_LINES.forEach(([ko, en, n]) => {
      if (ko.split(/\s+/).length !== SR.tokens(en).length) w(`한국어식 "${ko}": 낱말 수가 영어와 다름`);
      if (SR.koN(ko) !== n) w(`한국어식 "${ko}": 음절 ${SR.koN(ko)} ≠ ${n}`);
      if (!(SR.koN(ko) > SR.nSyl(en))) w(`한국어식 "${ko}": 영어보다 음절이 많지 않음`);
    });
    // 강조로 적은 낱말 번호가 기능어를 가리킴
    SR.STRONG.filter(s => s.focus).forEach(s => s.focus.forEach(i => { const x = SR.tokens(s.en)[i]; if (!x || !x.e || x.e.cls !== 'function') w(`"${s.en}": 강조 번호 ${i}가 기능어가 아님`); }));
    // 핵 강세: 돌아온 기능어는 강조 · 인용이 아니면 핵을 가져가지 않음(마디에 내용어가 있을 때)
    [['What are you looking at?', 'looking'], ['Where are you from?', 'from'], ['Who is it for?', 'for'], ['Yes, I can.', 'can'], ['I can swim!', 'can'], ['Circle the word “to”.', 'to'], ['I want to go to the store.', 'store']].forEach(([t, k]) => { if (SR.nuclearWord(t) !== k) w(`"${t}": 핵 강세 ${SR.nuclearWord(t)} ≠ ${k}`); });
    // 대문자 띠: 들어가며의 띠는 설계와 같음
    if (SR.caps(SR.INTRO.en) !== 'i WANT tə GO tə thə STORE') w(`대문자 띠: ${SR.caps(SR.INTRO.en)}`);
    // 따라 말하기 묶음: 7 × 4
    const grp = {}; SR.SENT.forEach(s => { grp[s.grp] = (grp[s.grp] || 0) + 1; });
    SR.SGRP_ORDER.forEach(g => { if (grp[g] !== 7) w(`문장 묶음 ${g}: ${grp[g] || 0}개`); });
    if (SR.SENT.length !== 28) w(`따라 말하기 ${SR.SENT.length}문장`);
    if (new Set(SR.SENT.map(s => s.en)).size !== SR.SENT.length) w('따라 말하기 문장이 겹침');
    // 짧은 구: 2~6음절 + 약한 음절 · 센 음절 모두 있음
    SR.PHRASES.forEach(t => {
      const n = SR.nSyl(t), wk = SR.weakIdx(t);
      if (n < 2 || n > 6) w(`짧은 구 "${t}": ${n}음절 (2~6음절이어야 음절을 재요)`);
      if (!wk.length && !SR.isStretch(t)) w(`짧은 구 "${t}": 약한 음절이 없음`);
      if (wk.length === n) w(`짧은 구 "${t}": 센 음절이 없음`);
    });
    // 연습 문제: 엔진의 정답과 같은지, 정답 위치
    const pos = {};
    SR.DRILL.forEach((q, k) => {
      const n = q.opts.length;
      pos[n] = pos[n] || Array(n).fill(0); pos[n][q.a]++;
      const a = SR.drillAnswer(q);
      if (a !== q.a) w(`연습 ${k + 1}: 정답 ${q.a} ≠ 엔진 ${a}`);
      if (q.kind === 'can' && !SR.partnerOf(q.say)) w(`연습 ${k + 1}: can 짝 문장이 아님`);
      if (q.kind === 'which') q.opts.forEach(o => { if (!SR.wordAt(q.say, o)) w(`연습 ${k + 1}: 보기 ${o}가 문장에 없음`); });
      if (q.kind === 'end') { const x = SR.wordAt(q.say, q.w); if (!x || x.e.pos !== 'prep') w(`연습 ${k + 1}: ${q.w}가 전치사가 아님`); }
      if (q.kind === 'ko') {
        const ko = q.seq.find(it => it.sp === 'ko'), en = q.seq.find(it => it.sp !== 'ko');
        if (!ko || !en || en.text !== q.en) w(`연습 ${k + 1}: 한국어식 · 영어 짝`);
        else if (ko.text.split(/\s+/).length !== SR.tokens(en.text).length) w(`연습 ${k + 1}: 한국어식 낱말 수`);
      }
      const sps = q.kind === 'ko' ? q.seq.filter(it => it.sp !== 'ko').map(it => it.sp) : [q.sp];
      sps.forEach(sp => { if (['tc', 'tf', 'uf', 'um'].indexOf(sp) < 0) w(`연습 ${k + 1}: 목소리 ${sp}`); });
    });
    Object.keys(pos).forEach(n => { const p = pos[n]; if (Math.max(...p) - Math.min(...p) > 1) w(`보기 ${n}개 문제의 정답 위치가 한쪽으로 몰림: ${p.join(' / ')}`); });
    // 따라 말하기 맞추기: 원래 문장을 그대로 받아 적으면 모두 맞음
    SR.SENT.forEach(s => { const r = SR.compareWords(s.en, s.en.replace(/[“”]/g, '')); if (r.hit !== r.total) w(`맞추기 "${s.en}": 그대로 적어도 ${r.hit}/${r.total}`); });
    warn.forEach(m => console.warn('[SR.check] ' + m));
    return warn.length;
  };
})();
