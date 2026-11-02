/* 명사·관사·수량 표현 튜토리얼 — 규칙 엔진과 예문
 *
 * 한국어는 ‘어제 책 샀어’로 충분하지만, 영어 명사는 문장에 들어갈 때마다 세 가지를 밝혀야 해요.
 * 이 튜토리얼은 그것을 ‘명사 검문소’의 세 문으로 그립니다.
 *   ① 셀 수 있나?          명사 사전(NOUNS)이 정해요: 셀 수 있는 명사 / 셀 수 없는 명사
 *   ② 하나인가 여럿인가?   명사의 모양: 단수 / 복수(-s) / 셀 수 없음(늘 -s 없이). 숫자-하이픈 꾸밈말은 단수
 *   ③ 짝이 맞나?           앞의 한정사·수량 표현(DETS)이 그 명사와 짝인지
 * 영상의 ✓·×, 직접 해 보기, 놀이터(명사 검문소), 연습 문제, 퀴즈가 모두 judgePhrase()로 정답을 정하고,
 * 문제 데이터에 적은 정답이 규칙 엔진과 다르면 콘솔에 경고를 냅니다.
 *
 * 명사구(phrase): { det, of, hyw, hy, noun, num }
 *   det  한정사·수량 표현 id ('zero' = 짝 없음)      of  'the' · 'our' (each of the …, most of our …) | 'bare' (most of …, the 없음)
 *   hyw  숫자-하이픈 꾸밈말 [숫자, 단위 명사] (a two-week course)   hy  그 꾸밈말의 모양 'sg' | 'pl'
 *   noun 명사 id   num 'sg' | 'pl'
 * 갈래(cat): C1 셀 수 있는 단수 · C2 셀 수 있는 복수 · U 셀 수 없는 명사
 * judgePhrase(phrase, ctx) → { s: 'ok' | 'no', gates: [①, ②, ③], fail, why, fix }
 *   ctx.need: 'sg' | 'pl' 문장의 다른 단서(Mr. Lee is …)가 정하는 수, ctx.why: 그 까닭
 */
(function () {
  'use strict';
  const NA = (window.NA = {});

  /* ---------- 명사 사전 ----------
   * c: 셀 수 있나, pl: 복수 모양(셀 수 없는 명사는 틀린 모양 informations를 보여 줄 때만 씀), an: 첫소리가 모음
   * unit: 숫자-하이픈 꾸밈말을 만드는 단위 명사(day, hour, page …)
   */
  const N = {};
  const addN = (c, list) => list.forEach(([id, pl, ko, x]) => { N[id] = Object.assign({ id, sg: id, pl, c, ko }, x || {}); });
  addN(true, [
    ['application', 'applications', '지원서', { an: 1 }], ['candidate', 'candidates', '지원자·후보'], ['employee', 'employees', '직원', { an: 1 }],
    ['supplier', 'suppliers', '공급업체'], ['participant', 'participants', '참가자'], ['attendee', 'attendees', '참석자', { an: 1 }],
    ['customer', 'customers', '고객'], ['seat', 'seats', '좌석'], ['date', 'dates', '날짜'], ['book', 'books', '책'], ['student', 'students', '학생'],
    ['training course', 'training courses', '교육 과정'], ['workshop', 'workshops', '워크숍'], ['report', 'reports', '보고서'], ['meeting', 'meetings', '회의'],
    ['contract', 'contracts', '계약'], ['proposal', 'proposals', '제안서'], ['projector', 'projectors', '프로젝터'], ['inquiry', 'inquiries', '문의', { an: 1 }],
    ['suggestion', 'suggestions', '제안'], ['comment', 'comments', '의견'], ['chair', 'chairs', '의자'], ['table', 'tables', '탁자'], ['desk', 'desks', '책상'],
    ['bag', 'bags', '가방'], ['suitcase', 'suitcases', '여행 가방'], ['machine', 'machines', '기계'], ['monitor', 'monitors', '모니터'], ['printer', 'printers', '프린터'],
    ['day', 'days', '날', { unit: 1 }], ['week', 'weeks', '주', { unit: 1 }], ['hour', 'hours', '시간', { unit: 1, an: 1 }], ['page', 'pages', '쪽', { unit: 1 }],
    ['year', 'years', '해', { unit: 1 }], ['minute', 'minutes', '분', { unit: 1 }],
    ['piece of information', 'pieces of information', '정보 한 가지'], ['piece of luggage', 'pieces of luggage', '짐 한 개'],
    ['piece of furniture', 'pieces of furniture', '가구 한 점'], ['piece of advice', 'pieces of advice', '조언 한 마디'], ['piece of equipment', 'pieces of equipment', '장비 한 대'],
  ]);
  addN(false, [
    ['information', 'informations', '정보', { an: 1 }], ['equipment', 'equipments', '장비', { an: 1 }], ['advice', 'advices', '조언', { an: 1 }],
    ['feedback', 'feedbacks', '의견·반응'], ['luggage', 'luggages', '짐'], ['furniture', 'furnitures', '가구'], ['machinery', 'machineries', '기계류'],
  ]);
  NA.NOUNS = N;
  NA.noun = id => N[id];
  // 셀 수 없는 명사를 하나, 둘 셀 때 쓰는 말 (a piece of …)
  NA.pieceOf = id => N['piece of ' + id] ? 'piece of ' + id : null;

  /* ---------- a냐 an이냐: 뒤 낱말의 첫 소리 ---------- */
  const SOUND = { hour: 'an', honest: 'an', honor: 'an', university: 'a', uniform: 'a', useful: 'a', user: 'a', european: 'a', one: 'a', experienced: 'an', important: 'an', updated: 'an' };
  NA.aan = function (word) {
    const w = String(word).toLowerCase().split(/[\s-]/)[0];
    if (SOUND[w]) return SOUND[w];
    if (N[w]) return N[w].an ? 'an' : 'a';
    return /^[aeiou]/.test(w) ? 'an' : 'a';
  };

  /* ---------- 한정사·수량 표현 ----------
   * grp: one 하나와 짝 · many 여럿과 짝 · mass 셀 수 없는 명사와 짝 · both 둘 다 · det 한정사(the·소유격·this·these·없음) · trap 함정
   * takes: 바로 뒤에 올 수 있는 갈래, ofTakes: of the 뒤에 올 수 있는 갈래 (null = of를 붙이지 않는 말, [] = of와 함께 못 씀)
   * alt: 다른 갈래의 같은 뜻 짝 (many ↔ much)
   */
  const D = {};
  const addD = (grp, list) => list.forEach(([id, t, takes, ofTakes, ko, x]) => { D[id] = Object.assign({ id, t, grp, takes, ofTakes, ko }, x || {}); });
  addD('one', [
    ['a', 'a / an', ['C1'], null, '하나', { alt: 'piece' }],
    ['each', 'each', ['C1'], ['C2'], '각각', { alt: 'all' }],
    ['every', 'every', ['C1'], [], '모든 (하나하나)', { alt: 'all' }],
    ['another', 'another', ['C1'], null, '또 하나의 · 다른'],
    ['one', 'one', ['C1'], ['C2'], '하나의'],
  ]);
  addD('many', [
    ['several', 'several', ['C2'], ['C2'], '몇몇', { alt: 'some' }],
    ['afew', 'a few', ['C2'], ['C2'], '몇 개의', { alt: 'alittle' }],
    ['few', 'few', ['C2'], ['C2'], '거의 없는', { alt: 'little' }],
    ['many', 'many', ['C2'], ['C2'], '많은', { alt: 'much' }],
    ['anumberof', 'a number of', ['C2'], null, '많은', { alt: 'agreatdealof' }],
    ['both', 'both', ['C2'], ['C2'], '둘 다'],
    ['two', 'two', ['C2'], ['C2'], '둘', { alt: 'piece' }],
    ['three', 'three', ['C2'], ['C2'], '셋', { alt: 'piece' }],
  ]);
  addD('mass', [
    ['much', 'much', ['U'], ['U'], '많은', { alt: 'many' }],
    ['alittle', 'a little', ['U'], ['U'], '조금', { alt: 'afew' }],
    ['little', 'little', ['U'], ['U'], '거의 없는', { alt: 'few' }],
    ['agreatdealof', 'a great deal of', ['U'], null, '많은', { alt: 'anumberof' }],
  ]);
  addD('both', [
    ['all', 'all', ['C2', 'U'], ['C2', 'U'], '모든'],
    ['most', 'most', ['C2', 'U'], ['C2', 'U'], '대부분의'],
    ['some', 'some', ['C2', 'U'], ['C2', 'U'], '약간의'],
    ['alotof', 'a lot of', ['C2', 'U'], null, '많은'],
    ['plentyof', 'plenty of', ['C2', 'U'], null, '많은'],
    ['other', 'other', ['C2', 'U'], null, '다른'],
    ['almostall', 'almost all', ['C2', 'U'], null, '거의 모든'],
  ]);
  addD('det', [
    ['the', 'the', ['C1', 'C2', 'U'], null, '그'],
    ['our', 'our', ['C1', 'C2', 'U'], null, '우리의', { poss: 1 }],
    ['your', 'your', ['C1', 'C2', 'U'], null, '당신의', { poss: 1 }],
    ['this', 'this', ['C1', 'U'], null, '이'],
    ['these', 'these', ['C2'], null, '이 (여럿)'],
    ['zero', '(짝 없음)', ['C2', 'U'], null, '짝 없이'],
  ]);
  addD('trap', [
    ['almost', 'almost', [], [], '거의 (부사)', { adv: 1 }],
    ['almostevery', 'almost every', ['C1'], null, '거의 모든'],
    ['others', 'others', [], null, '다른 것들 (대명사)', { pron: 1 }],
    ['theothers', 'the others', [], null, '나머지 (대명사)', { pron: 1 }],
  ]);
  NA.DETS = D;
  NA.det = id => D[id];
  NA.GRP = { one: '하나와 짝', many: '여럿과 짝', mass: '셀 수 없는 명사와 짝', both: '복수 · 셀 수 없는 명사와 짝', det: '한정사', trap: '함정' };
  NA.CAT = { C1: '셀 수 있는 단수', C2: '셀 수 있는 복수', U: '셀 수 없는 명사' };

  /* ---------- 명사구 → 글자 ---------- */
  const lcp = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  // 복수 모양을 [앞, 꼬리, 뒤]로 (꼬리 = -s · -es · -ies). 화면에서 꼬리에 색을 칠함
  NA.plParts = function (id) {
    const n = N[id], a = n.sg, b = n.pl, i = lcp(a, b);
    let j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
    return [b.slice(0, i), b.slice(i, b.length - j), b.slice(b.length - j)];
  };
  NA.form = (id, num) => num === 'pl' ? N[id].pl : N[id].sg;
  const hyText = (hyw, hy) => `${hyw[0]}-${hy === 'pl' ? N[hyw[1]].pl : N[hyw[1]].sg}`;
  NA.hyText = hyText;
  // 명사구의 낱말들: [{ t, r }] (r: det 짝 · of · hy 꾸밈말 · n 명사 · 그리고 꼬리 tail)
  NA.parts = function (p) {
    const out = [], d = D[p.det || 'zero'];
    const nounText = NA.form(p.noun, p.num), next = p.of ? 'of' : p.adj ? p.adj : p.hyw ? p.hyw[0] : nounText;
    if (d.id !== 'zero') out.push({ t: d.id === 'a' ? NA.aan(next) : d.t, r: 'det' });
    if (p.of) out.push({ t: p.of === 'bare' ? 'of' : 'of ' + p.of, r: 'of' });
    if (p.adj) out.push({ t: p.adj, r: 'adj' });
    if (p.hyw) out.push({ t: hyText(p.hyw, p.hy), r: 'hy', tail: p.hy === 'pl' ? 's' : '' });
    const pp = p.num === 'pl' ? NA.plParts(p.noun) : null;
    out.push({ t: nounText, r: N[p.noun].c ? 'n' : 'u', tail: pp ? pp[1] : '', tailAt: pp ? pp[0].length : 0 });
    return out;
  };
  NA.text = p => NA.parts(p).map(x => x.t).join(' ');

  /* ---------- 규칙 엔진 ---------- */
  NA.catOf = p => !N[p.noun].c ? 'U' : p.num === 'pl' ? 'C2' : 'C1';
  const yes = (label, why) => ({ ok: true, label, why }), stop = (label, why) => ({ ok: false, label, why });
  const catKo = cat => ({ C1: '셀 수 있는 단수', C2: '셀 수 있는 복수', U: '셀 수 없는 명사' }[cat]);

  const OFKO = { each: '각각', one: '하나', several: '몇몇', afew: '몇', few: '거의 없음', many: '여럿', both: '둘 다', two: '둘', three: '셋', much: '많은 부분', alittle: '조금', little: '거의 없음', all: '모두', most: '대부분', some: '일부' };
  // ③ 짝: 한정사·수량 표현 d와 명사 갈래 cat
  function pair(d, of, cat, n) {
    const T = d.t, sg = n.sg, pl = n.pl, aan = NA.aan(sg);
    if (d.adv) return stop('almost = 부사', 'almost → ‘거의’라는 부사예요. 명사 앞에 바로 오지 못해요 → almost all + 복수, almost every + 단수.');
    if (d.pron) return stop(`${T} = 대명사`, `${T} → 대명사라서 뒤에 명사가 오지 못해요 → 하나면 another + 단수, 여럿이면 other + 복수.`);
    if (of) {
      if (d.ofTakes == null) return stop(`${T} + of ×`, `${T} + of → 쓰지 않는 모양이에요.`);
      if (!d.ofTakes.length) return stop(`${T} of ×`, `${T} + of → 쓰지 않는 모양이에요. ${T} + 단수, 또는 each of the + 복수.`);
      if (of === 'bare') return stop('of 뒤 the 없음', `${T} of 뒤에는 정해진 무리가 와요. the · our 같은 말로 어느 무리인지 밝혀야 해요 → ${T} of the ${cat === 'U' ? sg : pl}.`);
      if (d.ofTakes.includes(cat)) return yes(`짝 ${T} of the`, `${T} of the → ‘그 무리 가운데 ${OFKO[d.id] || d.ko}’. of the 뒤에 ${cat === 'U' ? '셀 수 없는 명사' : '복수'}가 와서 짝이 맞아요.`);
      if (cat === 'C1') return stop('of the + 단수', `${T} of the 뒤에는 무리를 뜻하는 복수가 와요 → ${T} of the ${pl}.`);
      return stop(`${T} ≠ ${cat === 'U' ? '셀 수 없음' : '복수'}`, cat === 'U' ? `${T} → 셀 수 있는 명사와 짝. 셀 수 없는 명사와는 못 써요.` : `${T} → 셀 수 없는 명사와 짝. 셀 수 있는 복수에는 ${D[d.alt] ? D[d.alt].t : 'many'}.`);
    }
    if (d.takes.includes(cat)) {
      if (d.id === 'zero') return yes('짝 없이 OK', cat === 'U' ? '셀 수 없는 명사는 짝 없이 혼자 다닐 수 있어요.' : '셀 수 있는 복수는 짝 없이 혼자 다닐 수 있어요.');
      if (d.id === 'a') return yes(`짝 ${aan}`, 'a/an → ‘하나’. 셀 수 있는 단수의 짝이에요. 뒤 낱말의 첫 소리가 모음이면 an.');
      if (d.id === 'another') return yes('짝 another', 'another → an + other. 하나를 더 말하니 셀 수 있는 단수와 짝이에요.');
      if (d.id === 'almostevery') return yes('짝 almost every', 'almost every → ‘거의 모든’. every + 단수와 같아요.');
      if (d.id === 'almostall') return yes('짝 almost all', 'almost all → ‘거의 모든’. 복수 · 셀 수 없는 명사와 짝이에요.');
      if (d.id === 'other') return yes('짝 other', 'other → 복수(또는 셀 수 없는 명사)와 짝이에요. 하나일 때는 another.');
      if (d.grp === 'det') return yes(`짝 ${T}`, d.id === 'the' || d.poss ? `${T} → ${d.poss ? '소유격. ' : ''}어떤 명사와도 짝이 되는 한정사예요.` : `${T} → ${d.id === 'this' ? '하나(또는 셀 수 없는 명사)' : '여럿'}를 가리키는 한정사예요.`);
      if (d.grp === 'one') return yes(`짝 ${T}`, `${T} → 하나하나를 가리켜요. 셀 수 있는 단수와 짝이에요.`);
      if (d.grp === 'many') return yes(`짝 ${T}`, `${T} → 여럿을 가리켜요. 셀 수 있는 복수와 짝이에요.`);
      if (d.grp === 'mass') return yes(`짝 ${T}`, `${T} → 셀 수 없는 명사와 짝이에요.`);
      return yes(`짝 ${T}`, `${T} → 셀 수 있는 복수와도, 셀 수 없는 명사와도 짝이에요.`);
    }
    // 짝이 안 맞음
    if (d.id === 'zero') return stop('짝이 없음', `셀 수 있는 단수 명사는 혼자 못 다녀요 → a/an · the · 소유격 같은 짝이 필요해요 (${aan} ${sg}).`);
    if (d.id === 'this') return stop('this = 하나', `this → 하나를 가리켜요. 복수에는 these → these ${pl}.`);
    if (d.id === 'these') return stop('these = 여럿', `these → 여럿을 가리켜요. ${cat === 'U' ? '셀 수 없는 명사' : '단수'}에는 this → this ${sg}.`);
    if (d.id === 'a') return cat === 'U' ? stop('a/an = 하나', `a/an → ‘하나’. 셀 수 없는 명사에는 못 붙여요${NA.pieceOf(n.id) ? ` → a ${NA.pieceOf(n.id)}` : ''}.`)
      : stop('a/an = 하나', `a/an → ‘하나’라서 복수와 짝이 안 맞아요 → ${aan} ${sg}, 또는 짝 없이 ${pl}.`);
    if (d.id === 'other') return stop('other + 단수', 'other + 단수 → 짝이 안 맞아요. 하나면 another + 단수, 여럿이면 other + 복수.');
    if (d.id === 'almostevery') return stop('every = 하나하나', `almost every → every + 단수와 같아요 → almost every ${sg}.`);
    if (d.grp === 'one') return cat === 'C2' ? stop(`${T} = 하나하나`, `${T} → 하나하나를 가리켜서 단수와 짝 → ${T} ${sg}.${d.id === 'each' ? ' 복수를 쓰려면 each of the + 복수.' : ''}`)
      : stop(`${T} ≠ 셀 수 없음`, `${T} → 셀 수 있는 단수와 짝. 셀 수 없는 명사와는 못 써요.`);
    if (d.grp === 'many') {
      if (cat === 'C1') return stop(`${T} = 여럿`, `${T} → 여럿을 가리켜서 복수와 짝 → ${T} ${pl}.`);
      const alt = D[d.alt], mass = [...new Set([alt && alt.grp === 'mass' ? alt.t : 'much', 'much', 'a great deal of'])].join(' · ');
      return stop(`${T} ≠ 셀 수 없음`, `${T} → 셀 수 있는 복수와 짝. 셀 수 없는 명사에는 ${mass}.${NA.pieceOf(n.id) && (d.id === 'two' || d.id === 'three') ? ` 세려면 ${T} pieces of ${sg}.` : ''}`);
    }
    if (d.grp === 'mass') { const alt = D[d.alt]; return stop(`${T} = 셀 수 없는 짝`, `${T} → 셀 수 없는 명사와 짝. 셀 수 있는 명사에는 ${alt ? alt.t : 'many'} + 복수.`); }
    return stop(`${T} + 단수 ×`, `${T} → 셀 수 있는 단수와는 쓰지 않아요 → ${T} ${pl}.`);
  }

  NA.judgePhrase = (p, ctx) => judge(p, ctx || {}, true);
  function judge(p, ctx, withFix) {
    const n = N[p.noun], d = D[p.det || 'zero'], cat = NA.catOf(p);
    const n1 = p.hyw ? N[p.hyw[1]] : n;   // ① 문에서 살펴볼 명사 (숫자-하이픈이면 그 단위 명사)
    const g1 = yes(n1.c ? '셀 수 있음' : '셀 수 없음', n1.c ? `${n1.sg} → 셀 수 있는 명사(${n1.ko}). 하나, 둘 셀 수 있어요.` : `${n1.sg} → 셀 수 없는 명사(${n1.ko}). a/an, -s → 붙지 않아요.`);
    let g2 = null;
    if (!n.c && p.num === 'pl') g2 = stop('셀 수 없는데 -s', `${n.sg} → 셀 수 없는 명사라서 -s 없이 써요 (${n.pl} ×).`);
    else if (p.hyw) {
      if (!n1.c) g2 = stop('숫자와 못 묶음', `${n1.sg} → 셀 수 없는 명사라서 숫자와 묶을 수 없어요. 예: a three-day workshop.`);
      else if (!n1.unit) g2 = stop('단위 명사가 아님', `숫자-하이픈 꾸밈말은 기간 · 분량을 뜻하는 단위 명사(day · hour · page · year)로 만들어요.`);
      else if (p.hy === 'pl') g2 = stop('꾸밈말에 -s', `숫자-하이픈 꾸밈말은 명사 앞에서 형용사처럼 쓰여서 -s 없이 단수로 써요 → ${hyText(p.hyw, 'sg')} (${hyText(p.hyw, 'pl')} ×).`);
    } else if (ctx.need && n.c && ctx.need !== p.num) g2 = stop(ctx.need === 'sg' ? '하나인데 복수' : '여럿인데 단수', ctx.why || (ctx.need === 'sg' ? '하나를 가리켜요. 단수가 와야 해요.' : '여럿을 가리켜요. 복수가 와야 해요.'));
    if (!g2) g2 = yes(p.hyw ? '꾸밈말은 단수' : !n.c ? '-s 없이 한 덩어리' : p.num === 'pl' ? '복수 · 여럿' : '단수 · 하나',
      p.hyw ? `${hyText(p.hyw, 'sg')} → 명사 앞 꾸밈말이라 -s 없이 단수. ${n.sg} → 단수.` : !n.c ? `${n.sg} → 셀 수 없으니 -s 없이 한 덩어리로 써요.` : p.num === 'pl' ? `${n.pl} → -s가 붙은 복수(여럿)예요.` : `${n.sg} → -s가 없는 단수(하나)예요.`);
    const g3 = pair(d, p.of, cat, n);
    const gates = [g1, g2, g3], fail = gates.findIndex(g => !g.ok);
    const res = { s: fail < 0 ? 'ok' : 'no', gates, fail, cat, c1: n1.c, why: fail < 0 ? g3.why : gates[fail].why, fix: null };
    if (fail >= 0 && withFix) res.fix = NA.fix(p, ctx);
    return res;
  }
  NA.GATE = ['① 셀 수 있나?', '② 하나인가 여럿인가?', '③ 짝이 맞나?'];

  // 고친 말: 가장 가까운 맞는 명사구 하나 (없으면 null)
  function candidates(p, ctx) {
    const n = N[p.noun], d = D[p.det || 'zero'], cat = NA.catOf(p), C = [];
    const v = o => Object.assign({}, p, o);
    if (!n.c && p.num === 'pl') C.push(v({ num: 'sg' }));
    if (p.hyw && p.hy === 'pl') C.push(v({ hy: 'sg' }));
    if (ctx && ctx.need && n.c && ctx.need !== p.num) C.push(v({ num: ctx.need }));
    if (d.adv) C.push(v({ det: cat === 'C1' ? 'almostevery' : 'almostall', of: undefined }));
    if (d.pron) C.push(v({ det: cat === 'C1' ? 'another' : 'other', of: undefined }));
    if (p.of === 'bare') C.push(v({ of: 'the' }));
    if (p.of && d.ofTakes && !d.ofTakes.length) C.push(v({ det: 'each', of: 'the', num: 'pl' }));
    if (p.of && p.of !== 'bare' && cat === 'C1') C.push(v({ num: 'pl' }));
    if (d.id === 'zero' && cat === 'C1') C.push(v({ det: 'a' }));
    if (d.id === 'other' && cat === 'C1') C.push(v({ det: 'another' }));
    if (n.c) C.push(v({ num: p.num === 'pl' ? 'sg' : 'pl' }));
    if (!n.c && d.alt === 'piece' && NA.pieceOf(n.id)) C.push(v({ noun: NA.pieceOf(n.id), num: d.id === 'a' ? 'sg' : 'pl' }));
    if (d.alt && D[d.alt]) C.push(v({ det: d.alt }), v({ det: d.alt, num: p.num === 'pl' ? 'sg' : 'pl' }));
    if (!n.c && d.grp !== 'mass') C.push(v({ det: 'much' }));
    return C;
  }
  NA.fix = function (p, ctx) {
    const ok = c => judge(c, ctx || {}, false).s === 'ok', C = candidates(p, ctx);
    let c = C.find(ok);
    if (!c) for (const c1 of C) { c = candidates(c1, ctx).find(ok); if (c) break; }   // 두 군데를 고쳐야 하면 한 번 더
    return c ? { p: c, text: NA.text(c) } : null;
  };

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * base: 문장에 이미 있는 부분, opts: [보기 글, 보기가 채우는 부분], ctx: 문장의 다른 단서가 정하는 수
   * s1·s2: 3단계 풀이 ①·②의 문장(①은 비우면 명사 사전으로 만듦), m1·m2·m3: 문장 속 표시 (ante 명사 · cue 단서 · verb 동사 · trap 함정)
   */
  NA.DRILL = [
    { q: 'The hotel provides ___ information about local tours.', type: 48, a: 2,
      base: { noun: 'information', num: 'sg' }, opts: [['many', { det: 'many' }], ['several', { det: 'several' }], ['a great deal of', { det: 'agreatdealof' }], ['a number of', { det: 'anumberof' }]],
      m1: [{ t: 'information', role: 'ante' }], s2: 'information → 셀 수 없으니 -s 없이 한 덩어리로 써요. 하나, 둘 세지 않아요.',
      tag: '셀 수 없는 명사 · a great deal of', ko: '그 호텔은 지역 관광에 관한 정보를 많이 제공해요.' },
    { q: 'Please submit ___ application to the personnel office by Friday.', type: 47, a: 3,
      base: { noun: 'application', num: 'sg' }, opts: [['much', { det: 'much' }], ['several', { det: 'several' }], ['other', { det: 'other' }], ['an', { det: 'a' }]],
      m1: [{ t: 'application', role: 'ante' }], s2: 'application → -s가 없는 단수(하나)예요.',
      tag: '셀 수 있는 단수 + 한정사', ko: '금요일까지 인사과에 지원서를 내 주세요.' },
    { q: 'Mr. Lee is ___ for the sales manager position.', type: 47, a: 2,
      base: {}, ctx: { need: 'sg', why: 'Mr. Lee is → 한 사람이에요. 단수가 와야 해요.' },
      opts: [['candidate', { det: 'zero', noun: 'candidate', num: 'sg' }], ['candidates', { det: 'zero', noun: 'candidate', num: 'pl' }], ['a candidate', { det: 'a', noun: 'candidate', num: 'sg' }], ['the candidates', { det: 'the', noun: 'candidate', num: 'pl' }]],
      m1: [], s2: 'Mr. Lee is → 한 사람. 단수가 와야 해요.', m2: [{ t: 'Mr. Lee is', role: 'cue' }],
      tag: '단수 명사의 짝 · a', ko: '이 씨는 영업 관리자 자리의 후보예요.' },
    { q: '___ equipment must be returned to the storage room after the event.', type: 48, a: 0,
      base: { noun: 'equipment', num: 'sg' }, opts: [['All', { det: 'all' }], ['Every', { det: 'every' }], ['Many', { det: 'many' }], ['Several', { det: 'several' }]],
      m1: [{ t: 'equipment', role: 'ante' }], s2: 'equipment → 셀 수 없으니 -s 없이 한 덩어리로 써요.',
      tag: '셀 수 없는 명사 · all', ko: '행사가 끝나면 모든 장비를 창고에 돌려놓아야 해요.' },
    { q: 'Ms. Ortiz gave us ___ useful advice on the new tax forms.', type: 48, a: 2,
      base: { adj: 'useful', noun: 'advice', num: 'sg' }, opts: [['a', { det: 'a' }], ['many', { det: 'many' }], ['some', { det: 'some' }], ['several', { det: 'several' }]],
      m1: [{ t: 'advice', role: 'ante' }], s2: 'advice → 셀 수 없으니 -s 없이 써요. 사이의 형용사 useful → 상관없어요.', m2: [{ t: 'useful', role: 'trap' }],
      tag: '셀 수 없는 명사 · a useful advice 함정', ko: '오르티스 씨가 새 세금 서식에 관해 유용한 조언을 해 줬어요.' },
    { q: 'Passengers may bring two ___ on board.', type: 48, a: 3,
      base: { det: 'two' }, n1: 'luggage',
      opts: [['luggages', { noun: 'luggage', num: 'pl' }], ['luggage', { noun: 'luggage', num: 'sg' }], ['piece of luggage', { noun: 'piece of luggage', num: 'sg' }], ['pieces of luggage', { noun: 'piece of luggage', num: 'pl' }]],
      s1: 'luggage → 셀 수 없는 명사(짐). two luggage, luggages → 둘 다 안 돼요. 세는 말 piece(개)로 세요.',
      m1: [], s2: 'two → 여럿. 세는 말 piece → 복수 pieces.', m2: [{ t: 'two', role: 'cue' }],
      tag: '셀 수 없는 명사 세기 · pieces of', ko: '승객은 짐을 두 개까지 기내에 가지고 탈 수 있어요.' },
    { q: 'Each ___ must bring a photo ID to the interview.', type: 49, a: 0,
      base: { det: 'each' },
      opts: [['candidate', { noun: 'candidate', num: 'sg' }], ['candidates', { noun: 'candidate', num: 'pl' }], ['of candidates', { of: 'bare', noun: 'candidate', num: 'pl' }], ['of the candidate', { of: 'the', noun: 'candidate', num: 'sg' }]],
      m1: [], s2: 'Each → ‘하나하나’. 바로 뒤에는 단수가 와요. each of the 뒤라면 복수예요.', m2: [{ t: 'Each', role: 'cue' }],
      tag: 'each + 단수', ko: '지원자는 각자 사진이 있는 신분증을 면접에 가져와야 해요.' },
    { q: '___ suppliers have offered to lower their prices.', type: 49, a: 0,
      base: { noun: 'supplier', num: 'pl' }, opts: [['Several', { det: 'several' }], ['Much', { det: 'much' }], ['Every', { det: 'every' }], ['Each', { det: 'each' }]],
      m1: [{ t: 'suppliers', role: 'ante' }], s2: 'suppliers → -s가 붙은 복수(여럿)예요. 동사 have → 복수.', m2: [{ t: 'have', role: 'verb' }],
      tag: '복수와 짝 · several', ko: '공급업체 몇 곳이 가격을 내리겠다고 제안했어요.' },
    { q: 'Only ___ seats are still available for the concert.', type: 49, a: 1,
      base: { noun: 'seat', num: 'pl' }, opts: [['a little', { det: 'alittle' }], ['a few', { det: 'afew' }], ['much', { det: 'much' }], ['every', { det: 'every' }]],
      m1: [{ t: 'seats', role: 'ante' }], s2: 'seats → -s가 붙은 복수예요. 동사 are → 복수.', m2: [{ t: 'are', role: 'verb' }],
      tag: 'a few vs a little', ko: '그 콘서트는 좌석이 몇 개밖에 남지 않았어요.' },
    { q: '___ of the participants will receive a certificate of completion.', type: 49, a: 0,
      base: { of: 'the', noun: 'participant', num: 'pl' }, opts: [['Each', { det: 'each' }], ['Every', { det: 'every' }], ['Much', { det: 'much' }], ['Almost', { det: 'almost' }]],
      m1: [{ t: 'participants', role: 'ante' }], s2: 'participants → 복수. 빈칸 바로 뒤 → of the(그 무리 가운데).', m2: [{ t: 'of the', role: 'trap' }],
      tag: 'each of the + 복수', ko: '참가자는 저마다 수료증을 받을 거예요.' },
    { q: '___ employees at Dalton Corp. work from home on Fridays.', type: 50, a: 1,
      base: { noun: 'employee', num: 'pl' }, opts: [['Almost', { det: 'almost' }], ['Most', { det: 'most' }], ['Most of', { det: 'most', of: 'bare' }], ['Every', { det: 'every' }]],
      m1: [{ t: 'employees', role: 'ante' }], s2: 'employees → 복수예요. 빈칸 바로 뒤가 명사이고 the가 없어요.',
      tag: 'most + 복수', ko: '돌턴 사의 직원 대부분은 금요일마다 재택근무를 해요.' },
    { q: '___ of the attendees found the lecture useful.', type: 50, a: 2,
      base: { of: 'the', noun: 'attendee', num: 'pl' }, opts: [['Almost', { det: 'almost' }], ['Every', { det: 'every' }], ['Most', { det: 'most' }], ['Much', { det: 'much' }]],
      m1: [{ t: 'attendees', role: 'ante' }], s2: 'attendees → 복수. 빈칸 바로 뒤 → of the(그 무리 가운데).', m2: [{ t: 'of the', role: 'trap' }],
      tag: 'most of the + 복수', ko: '참석자 대부분이 그 강연이 유익했다고 생각했어요.' },
    { q: 'The survey shows that ___ customers prefer online payment.', type: 50, a: 1,
      base: { noun: 'customer', num: 'pl' }, opts: [['almost', { det: 'almost' }], ['almost all', { det: 'almostall' }], ['most of', { det: 'most', of: 'bare' }], ['much', { det: 'much' }]],
      m1: [{ t: 'customers', role: 'ante' }], s2: 'customers → 복수. 빈칸 뒤에 the가 없어요.',
      tag: 'almost all + 복수', ko: '설문 조사를 보면 거의 모든 고객이 온라인 결제를 더 좋아해요.' },
    { q: 'All new employees must complete ___ training course.', type: 51, a: 3,
      base: { noun: 'training course', num: 'sg', hyw: ['two', 'week'] },
      opts: [['two-weeks', { det: 'zero', hy: 'pl' }], ['a two-weeks', { det: 'a', hy: 'pl' }], ['two-week', { det: 'zero', hy: 'sg' }], ['a two-week', { det: 'a', hy: 'sg' }]],
      n1: 'training course', m1: [{ t: 'training course', role: 'ante' }],
      s2: 'course → -s 없는 단수. 앞의 two-week → 명사 앞 꾸밈말이라 -s 없이 써요.',
      tag: '숫자-하이픈 + 한정사', ko: '신입 직원은 모두 2주짜리 교육 과정을 마쳐야 해요.' },
    { q: 'If you are not available on Monday, please choose ___ date.', type: 51, a: 3,
      base: { noun: 'date', num: 'sg' }, opts: [['other', { det: 'other' }], ['others', { det: 'others' }], ['the others', { det: 'theothers' }], ['another', { det: 'another' }]],
      m1: [{ t: 'date', role: 'ante' }], s2: 'date → -s가 없는 단수(하나)예요.',
      tag: 'another + 단수', ko: '월요일이 안 되면 다른 날짜를 골라 주세요.' },
    { q: 'Unlike ___ suppliers, Hanbit Paper offers free delivery.', type: 51, a: 1,
      base: { noun: 'supplier', num: 'pl' }, opts: [['another', { det: 'another' }], ['other', { det: 'other' }], ['each', { det: 'each' }], ['much', { det: 'much' }]],
      m1: [{ t: 'suppliers', role: 'ante' }], s2: 'suppliers → -s가 붙은 복수(여럿)예요.',
      tag: 'other + 복수', ko: '다른 공급업체와 달리 한빛 제지는 무료 배송을 해 줘요.' },
  ];
  NA.phraseOf = (it, k) => Object.assign({}, it.base, it.opts[k][1]);
  NA.judgeOpt = (it, k) => NA.judgePhrase(NA.phraseOf(it, k), it.ctx);

  // 3단계 풀이 (연습 문제 힌트). ① 셀 수 있나 ② 하나인가 여럿인가 ③ 짝이 맞나
  NA.steps = function (it) {
    const P = NA.phraseOf(it, it.a), n = N[it.n1 || P.noun], r = NA.judgePhrase(P, it.ctx);
    return [
      { head: '① 셀 수 있나?', text: it.s1 || `${n.sg} → ${n.c ? `셀 수 있는 명사(${n.ko}). 하나, 둘 셀 수 있어요.` : `셀 수 없는 명사(${n.ko}). a/an, -s → 붙지 않아요.`}`, marks: it.m1 || [] },
      { head: '② 하나인가 여럿인가?', text: it.s2, marks: it.m2 || [] },
      { head: '③ 짝이 맞나?', text: `${r.gates[2].why} → ${it.opts[it.a][0]}.`, marks: it.m3 || [] },
    ];
  };
  NA.note = r => r.s === 'ok' ? `통과. ${r.why}` : `× ${NA.GATE[r.fail]} — ${r.why}`;
  NA.drillItems = () => NA.DRILL.map(it => ({
    q: it.q, opts: it.opts.map(o => o[0]), a: it.a, ko: it.ko, tag: it.tag, steps: NA.steps(it),
    notes: it.opts.map((o, k) => NA.note(NA.judgeOpt(it, k))),
  }));

  /* ---------- 명사 검문소 (놀이터) ----------
   * 짝(한정사·수량 표현) 한 줄과 명사 하나, 모양(단수·복수)을 골라 명사구를 만듦
   */
  NA.PG = {
    a: { det: 'a', label: 'a / an' }, each: { det: 'each' }, every: { det: 'every' }, another: { det: 'another' },
    several: { det: 'several' }, afew: { det: 'afew' }, many: { det: 'many' }, anumberof: { det: 'anumberof' }, three: { det: 'three' },
    much: { det: 'much' }, alittle: { det: 'alittle' }, agreatdealof: { det: 'agreatdealof' },
    all: { det: 'all' }, most: { det: 'most' }, some: { det: 'some' }, alotof: { det: 'alotof' }, other: { det: 'other' },
    the: { det: 'the' }, our: { det: 'our' }, zero: { det: 'zero', label: '짝 없음' },
    almost: { det: 'almost' }, almostall: { det: 'almostall' }, mostof: { det: 'most', of: 'bare', label: 'most of' },
    mostofthe: { det: 'most', of: 'the', label: 'most of the' }, eachofthe: { det: 'each', of: 'the', label: 'each of the' },
    hy: { det: 'a', hy: 1, label: 'a three-___ workshop' },
  };
  Object.keys(NA.PG).forEach(k => { const e = NA.PG[k]; e.id = k; if (!e.label) e.label = D[e.det].t; });
  NA.PG_ROWS = [
    ['하나와 짝', ['a', 'each', 'every', 'another']],
    ['여럿과 짝', ['several', 'afew', 'many', 'anumberof', 'three']],
    ['셀 수 없는 명사와 짝', ['much', 'alittle', 'agreatdealof']],
    ['둘 다와 짝', ['all', 'most', 'some', 'alotof', 'other']],
    ['한정사', ['the', 'our', 'zero']],
    ['함정', ['almost', 'almostall', 'mostof', 'mostofthe', 'eachofthe', 'hy']],
  ];
  NA.PG_ORDER = NA.PG_ROWS.flatMap(r => r[1]);
  NA.PG_NOUNS = ['application', 'candidate', 'supplier', 'employee', 'day', 'hour', 'page', 'information', 'equipment', 'advice', 'feedback', 'luggage', 'furniture'];
  // 놀이터 상태 → 명사구
  NA.pgPhrase = function (eid, noun, num) {
    const e = NA.PG[eid];
    if (e.hy) return { det: 'a', hyw: ['three', noun], hy: num, noun: 'workshop', num: 'sg' };
    return { det: e.det, of: e.of, noun, num };
  };

  // 데이터 점검: 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, 보기 글과 명사구가 맞는지, 표시할 글이 문장에 있는지, 정답 위치가 고르게 섞였는지
  NA.check = function () {
    const bad = [];
    NA.DRILL.forEach((it, i) => {
      const good = it.opts.map((o, k) => NA.judgeOpt(it, k).s === 'ok' ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`연습 문제 ${i + 1}: 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      if ((it.q.match(/___/g) || []).length !== 1) bad.push(`연습 문제 ${i + 1}: 빈칸이 하나가 아니에요`);
      it.opts.forEach((o, k) => {
        const full = it.q.replace('___', o[0]).toLowerCase(), ph = NA.text(NA.phraseOf(it, k)).toLowerCase();
        if (!full.includes(ph)) bad.push(`연습 문제 ${i + 1}: 보기 ‘${o[0]}’의 명사구 ‘${ph}’가 완성 문장에 없어요`);
      });
      [].concat(it.m1 || [], it.m2 || [], it.m3 || []).forEach(m => { if (!it.q.includes(m.t)) bad.push(`연습 문제 ${i + 1}: 표시할 글 ‘${m.t}’가 문장에 없어요`); });
      if (!it.s2) bad.push(`연습 문제 ${i + 1}: ② 단계 문장이 없어요`);
    });
    const pos = [0, 0, 0, 0]; NA.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 2) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    NA.PG_ORDER.forEach(k => { if (!NA.PG[k] || !D[NA.PG[k].det]) bad.push(`놀이터 짝 ‘${k}’이 사전에 없어요`); });
    NA.PG_NOUNS.forEach(k => { if (!N[k]) bad.push(`놀이터 명사 ‘${k}’가 사전에 없어요`); });
    bad.forEach(b => console.warn('[명사·관사] ' + b));
    return bad;
  };
})();
