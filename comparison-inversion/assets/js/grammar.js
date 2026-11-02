/* 비교·가정법·도치 튜토리얼 — 규칙 엔진과 예문
 *
 * 이 튜토리얼의 문제는 모두 신호어(signal word) 하나가 짝(pair)을 부르는 문제예요.
 *   비교: as … as → 원급 · than → 비교급 · the … in · of · ever → 최상급 · one of the + 최상급 → 복수 명사
 *         The 비교급 …, the → 비교급 · superior · prior · senior → to · 비교급 앞 강조어 → much · even · far
 *   가정법: If + 과거 → would + 원형 · If + had p.p. → would have p.p. · 맨 앞 Should · Had · Were → 숨은 if
 *   도치: 맨 앞 Only · Never · Not only … → 조동사 + 주어 · so · neither → 조동사 + 주어
 * 3단계 풀이법: ① 신호어 찾기 → ② 짝 맞추기 → ③ 함정 확인.
 * 영상의 ✓·×, 직접 해 보기, 놀이터(신호어 스위치), 연습 문제, 퀴즈가 모두 CI.judge()로 맞고 틀림을 정하고,
 * 문제 데이터에 적은 정답이 judge()와 다르면 콘솔에 경고를 냅니다.
 *
 * 문장의 틀(frame)은 문제마다 데이터에 적어 둡니다. 규칙 엔진은 문장을 스스로 읽어 틀을 알아내지 않아요.
 *   f = 'deg'   빈칸 = 형용사·부사의 모양.   sk(신호어 종류): as · than · much · less · sup · ever · thethe, p: 빈칸의 품사(a 형용사 · r 부사)
 *       'int'   빈칸 = 비교급 앞 강조어.      보기 = 낱말 (much · very · most · many …)
 *       'part'  빈칸 = 비교의 짝 낱말.        sk: latin(superior …) · cmp(-er · more) · as
 *       'noun'  빈칸 = one of the + 최상급 뒤 명사
 *       'cond'  빈칸 = if절이나 주절의 동사.   side: main 주절 · sub if절, mood: real 직설법 · now 가정법 과거 · past 가정법 과거완료
 *       'front' 빈칸 = if 자리의 맨 앞 낱말.  after: 빈칸 뒤 주어 다음에 오는 말 (base 동사원형 · pp 과거분사 · comp 보어)
 *       'neg'   빈칸 = 맨 앞 부정어 뒤의 (조동사 + 주어 + 동사) 덩어리.  front: neg 부정어 있음 · none 없음
 *       'aux'   빈칸 = 맨 앞 부정어 뒤의 조동사 하나.  vf: 뒤 동사의 모양, num · tense: 주어의 수와 시제
 *       'so'    빈칸 = so · neither 뒤의 조동사.  fam · tense · modal: 앞 절 동사가 부르는 조동사
 * judge(code, ctx) → { s: 'ok' | 'no', step: 0 | 1 | 2 | 3, why }   step = 3단계 풀이법의 몇 단계에서 지워지는지
 */
(function () {
  'use strict';
  const CI = (window.CI = {});
  // 문장 끝 마침표: p.p.처럼 이미 마침표로 끝나면 한 번 더 찍지 않음
  const fix = s => s.replace(/\.\.(?=\s|$)/g, '.');
  const ok = why => ({ s: 'ok', step: 0, why: fix(why) }), no = (step, why) => ({ s: 'no', step, why: fix(why) });
  CI.fixDots = fix;
  const L = 'ABCD';

  /* ---------- 형용사·부사 사전: [원급, 비교급, 최상급], 원급 부사, 뜻, 한국어 [~요, ~수록, ~다] ---------- */
  const A = {};
  [
    ['light', 'lighter', 'lightest', 'lightly', '가벼운', ['가벼워요', '가벼울수록', '가볍다']],
    ['reliable', 'more reliable', 'most reliable', 'reliably', '믿을 만한', ['믿을 만해요', '믿을 만할수록', '믿을 만하다']],
    ['good', 'better', 'best', null, '좋은', ['좋아요', '좋을수록', '좋다']],
    ['expensive', 'more expensive', 'most expensive', 'expensively', '비싼', ['비싸요', '비쌀수록', '비싸다']],
    ['large', 'larger', 'largest', 'largely', '큰', ['커요', '클수록', '크다']],
    ['easy', 'easier', 'easiest', 'easily', '쉬운', ['쉬워요', '쉬울수록', '쉽다']],
    ['fast', 'faster', 'fastest', null, '빠른', ['빨라요', '빠를수록', '빠르다']],
    ['early', 'earlier', 'earliest', null, '이른', ['일러요', '이를수록', '이르다']],
    ['efficient', 'more efficient', 'most efficient', 'efficiently', '효율적인', ['효율적이에요', '효율적일수록', '효율적이다']],
  ].forEach(([w, c, s, adv, ko, kf]) => { A[w] = { w, f: [w, c, s], adv, ko, kf }; });
  CI.ADJ = A;
  CI.adj = w => A[w];
  // 짧은 낱말·모양이 바뀌는 낱말의 ‘비교 표시 두 번’ (more lighter · more better). 긴 낱말은 없음
  CI.dbl = w => A[w] && !A[w].f[1].startsWith('more ') ? 'more ' + A[w].f[1] : null;

  /* ---------- 신호어 종류와 짝 ---------- */
  CI.DEG = { pos: '원급', cmp: '비교급', sup: '최상급', dbl: '비교 표시 두 번' };
  CI.POS = { a: '형용사', r: '부사', n: '명사', v: '동사' };
  CI.SK = {
    as: { need: 'pos', sig: 'as … as', text: 'as … as 사이 → 원급' },
    than: { need: 'cmp', sig: 'than', text: '빈칸 + than → 비교급' },
    much: { need: 'cmp', sig: 'much … than', text: 'much + 빈칸 + than → 비교급' },
    less: { need: 'pos', sig: 'less … than', text: 'less + 빈칸 + than → 원급 (less가 이미 비교 표시)' },
    sup: { need: 'sup', sig: 'the … of', text: 'the + 빈칸 + 범위(of · in) → 최상급' },
    ever: { need: 'sup', sig: 'the … ever', text: 'the + 빈칸 + ever(지금까지) → 최상급' },
    thethe: { need: 'cmp', sig: 'The …, the', text: 'The + 빈칸 …, the + 비교급 → 비교급' },
  };

  /* ---------- 판정 ① 비교 ---------- */
  // code: '품사.모양' (a.pos · a.cmp · a.sup · a.dbl · r.pos · r.cmp · n …)
  function judgeDeg(code, c) {
    const [p, d] = code.split('.'), K = CI.SK[c.sk], need = K.need;
    if (p !== c.p) return no(1, p === 'n' ? `명사는 이 자리에 올 수 없어요. ${c.slot} → ${CI.POS[c.p]} 자리예요.`
      : `${c.slot} → ${CI.POS[c.p]} 자리예요. ${CI.POS[p]}는 올 수 없어요.`);
    if (d === 'dbl') return no(3, `비교 표시를 두 번 했어요. ${c.base && A[c.base] ? A[c.base].f[1] : '이 낱말'} = 이미 비교급이라 앞에 more를 또 붙이지 않아요.`);
    if (c.sk === 'less' && d === 'cmp') return no(3, 'less가 이미 ‘덜 ~한’이라는 비교 표시예요. 뒤에는 원급이 와요. 비교급을 붙이면 비교 표시가 두 번이에요.');
    if (d === need) return ok(`${K.text}. ${CI.POS[c.p]} ${CI.DEG[need]} → 맞아요.`);
    const tail = c.sk === 'as' && d === 'cmp' ? ' as … as 사이에 비교급을 넣으면 짝이 어긋나요.'
      : need === 'cmp' && d === 'pos' ? ' 원급의 짝은 as … as예요.'
      : need === 'cmp' && d === 'sup' ? ' 최상급의 짝은 the + 범위(of · in · ever)예요.'
      : need === 'sup' && d === 'cmp' ? ' 비교급의 짝은 than이에요. 여기에는 than이 없어요.'
      : need === 'sup' && d === 'pos' ? ' 범위 안에서 ‘가장’을 말하니 최상급이 와야 해요.'
      : need === 'pos' && d === 'sup' ? ' 최상급의 짝은 the + 범위예요.' : '';
    return no(2, `${K.text}. ${CI.DEG[d]}은 짝이 아니에요.${tail}`);
  }
  // 비교급 앞 강조어: cmp 비교급을 꾸밈 · pos 원급만 꾸밈 · dbl 비교급 표시 · sup 최상급 표시 · n 명사 앞 수량
  CI.INT = { much: 'cmp', even: 'cmp', far: 'cmp', still: 'cmp', 'a lot': 'cmp', very: 'pos', so: 'pos', too: 'pos', quite: 'pos', more: 'dbl', most: 'sup', many: 'n' };
  const INTN = { cmp: '비교급 강조어', pos: '원급 강조어', dbl: '비교급 표시', sup: '최상급 표시', n: '수량 (명사 앞)' };
  function judgeInt(w, c) {
    const k = CI.INT[w.toLowerCase()], cw = c.cw || '비교급';
    if (!k) return no(1, `${w} → 비교급을 꾸미는 말이 아니에요.`);
    if (k === 'n') return no(1, `${w} = 셀 수 있는 복수 명사 앞에 오는 말이에요(many customers). 형용사 ${cw}를 꾸미지 못해요.`);
    if (k === 'sup') return no(2, `${w} = 최상급을 만드는 말이에요. 비교급 ${cw}와 짝이 아니에요.`);
    if (k === 'dbl') return no(3, `${cw} = 이미 비교급이에요. more를 또 붙이면 비교 표시가 두 번 → more ${cw} ×.`);
    if (k === 'pos') return no(3, `${w} = ‘매우’ · ‘너무’. 원급만 꾸며요(${w} large ✓). 비교급 앞에는 못 와요 → ${w} ${cw} ×.`);
    return ok(`비교급 ${cw}를 세게 하는 말 = much · even · far · still · a lot (‘훨씬’).`);
  }
  // 비교의 짝 낱말
  const PARTNER = ['than', 'to', 'as'];
  const PNEED = { latin: 'to', cmp: 'than', as: 'as' };
  const PARTN = { than: '비교급의 짝', to: '라틴어 비교급의 짝', as: 'as … as의 짝' };
  function judgePart(w, c) {
    const need = PNEED[c.sk], x = w.toLowerCase();
    if (x === need) return ok(c.sk === 'latin' ? `${c.sig} = -or로 끝나는 라틴어 비교급 → 짝은 to.` : c.sk === 'cmp' ? '비교급의 짝 → than.' : 'as + 원급의 짝 → as.');
    if (!PARTNER.includes(x)) return no(1, `${w} → 비교의 짝이 되는 말이 아니에요.`);
    if (c.sk === 'latin' && x === 'than') return no(3, `비교의 뜻이라 than이 끌리지만, ${c.sig} = 라틴어 비교급이라 than을 쓰지 않아요 → ${c.sig} to.`);
    return no(2, `${w} → ${PARTN[x]}이에요. ${c.sk === 'latin' ? `${c.sig}의 짝은 to.` : c.sk === 'cmp' ? '비교급의 짝은 than.' : 'as + 원급의 짝은 as.'}`);
  }
  // one of the + 최상급 + ___ : n.pl 복수 명사 · n.sg 단수 명사 · a · v (다른 품사)
  const NOUNN = { 'n.pl': '복수 명사', 'n.sg': '단수 명사', a: '형용사', v: '동사' };
  function judgeNoun(code, c) {
    if (code !== 'n.pl' && code !== 'n.sg') return no(1, `${c.sig} 뒤 → 명사 자리예요. ${NOUNN[code]}는 올 수 없어요.`);
    if (code === 'n.sg') return no(2, `${c.sig} = ‘여럿 가운데 하나’라서 명사는 복수예요. 단수 명사는 짝이 아니에요.`);
    return ok(`${c.sig} + 복수 명사 → 맞아요.`);
  }

  /* ---------- 판정 ② 가정법 ---------- */
  // 모양 → [법·때, 절]   real 직설법 · now 지금의 반대(가정법 과거) · past 지난 일의 반대(가정법 과거완료)
  const COND = { pres: ['real', 'sub'], will: ['real', 'main'], past: ['now', 'sub'], would: ['now', 'main'], had: ['past', 'sub'], wouldhave: ['past', 'main'] };
  CI.CONDN = { pres: '현재형', will: 'will + 원형', past: '과거형', would: 'would + 원형', had: 'had + p.p.', wouldhave: 'would have + p.p.' };
  CI.MOOD = { real: '실제로 일어날 수 있는 일 (직설법)', now: '지금 사실의 반대 (가정법 과거)', past: '지난 일의 반대 (가정법 과거완료)' };
  const NEEDC = { real: { main: 'will', sub: 'pres' }, now: { main: 'would', sub: 'past' }, past: { main: 'wouldhave', sub: 'had' } };
  function judgeCond(code, c) {
    const [m, side] = COND[code], need = NEEDC[c.mood][c.side], nm = CI.CONDN[code];
    const real = x => x === 'real';
    if (real(m) !== real(c.mood)) return no(1, real(c.mood) ? `${c.sig} → 실제로 일어날 수 있는 일(직설법)이에요. 가정법 모양(${nm})은 짝이 아니에요.`
      : `${c.sig} → 사실과 반대로 상상하는 가정법이에요. 직설법 모양(${nm})은 쓰지 않아요.`);
    if (m !== c.mood) return no(2, `${c.sig} → ${CI.MOOD[c.mood]}예요. ${nm} → ${CI.MOOD[m].split(' (')[0]}에 쓰는 모양이라 짝이 아니에요.`);
    if (side !== c.side) return no(3, c.side === 'main' ? `${nm} → if절의 모양이에요. 주절에는 ${CI.CONDN[need]}.` : `if절 안에는 would를 쓰지 않아요. if절에는 ${CI.CONDN[need]}.`);
    const pair = { real: 'if절 현재형 ↔ 주절 will + 원형', now: 'if절 과거형 ↔ 주절 would + 원형', past: 'if절 had + p.p. ↔ 주절 would have + p.p.' }[c.mood];
    return ok(`${CI.MOOD[c.mood]} → ${pair}.` + (c.side === 'sub' && c.mood === 'now' && c.be ? ' be동사는 were.' : ''));
  }
  // if를 빼고 앞으로 나온 조동사 (Should · Had · Were)와 빈칸 뒤 말의 짝
  CI.FRONT = { Should: 'base', Had: 'pp', Were: 'comp' };
  CI.AFTERN = { base: '동사원형', pp: 'p.p.', comp: '보어' };
  const FRONTN = { Should: '+ 주어 + 동사원형', Had: '+ 주어 + p.p.', Were: '+ 주어 + 보어', If: '접속사 (if절 어순)' };
  function judgeFront(w, c) {
    const pair = CI.FRONT[w];
    if (w === 'If') {
      if (c.after === 'base') return ok('If + 주어 + 현재형 → 보통의 조건문이에요.');
      return no(3, `뜻은 맞지만 if절로 쓰려면 → If ${c.subj} ${c.after === 'pp' ? 'had' : 'were'} ${c.rest}. 이 문장에는 그 자리가 비어 있어요.`);
    }
    if (!pair) return no(1, `${w} → if를 대신하지 못해요. if를 빼고 맨 앞으로 나오는 말은 Should · Had · Were 셋뿐이에요.`);
    if (pair !== c.after) return no(2, `${w} 뒤 → 주어 + ${CI.AFTERN[pair]}, 빈칸 뒤 = 주어 + ${CI.AFTERN[c.after]}(${c.subj} ${c.rest}) → 짝이 아니에요.`);
    const full = `If ${c.subj} ${w.toLowerCase()} ${c.rest}`;
    return ok(`빈칸 뒤 = 주어 + ${CI.AFTERN[pair]} → ${w}. ${full} …에서 if가 빠지고 ${w.toLowerCase()} → 주어 앞으로 나왔어요.`);
  }

  /* ---------- 판정 ③ 도치 ---------- */
  // 덩어리: inv 조동사 + 주어 + 원형 · plain 주어 + 조동사 (보통 어순) · invBad 조동사 + 주어 + 과거형 · nf 동사 없음
  const NEGN = { inv: '조동사 + 주어 + 동사', plain: '주어 + 동사 (보통 어순)', invBad: '조동사 + 주어 + 과거형', nf: '동사 없음' };
  function judgeNeg(code, c) {
    if (code === 'nf') return no(1, '시제가 있는 동사가 없어요. 문장에는 진짜 동사가 하나 있어야 해요.');
    if (code === 'invBad') return no(3, `${c.aux} 뒤 → 동사원형(${c.vb}). ${c.vbad} → 시제를 두 번 나타낸 모양이에요.`);
    if (c.front === 'none') return code === 'plain' ? ok('맨 앞에 부정어가 없어요 → 보통 어순(주어 + 조동사 + 동사).')
      : no(2, '맨 앞에 부정어가 없으면 보통 어순이에요. 조동사가 주어 앞에 오면 질문 어순이 돼요.');
    if (code === 'plain') return no(2, `맨 앞에 ${c.sig} → 뒤는 조동사 + 주어 어순(도치)이에요. 주어가 먼저 오면 보통 어순이라 틀려요.`);
    return ok(`맨 앞에 ${c.sig} → 조동사 + 주어 + 동사 (도치).${c.vb ? ` ${c.aux} 뒤 → 동사원형(${c.vb}).` : ''}`);
  }
  // 조동사: [갈래, 시제, 수]   갈래 do · have · be · modal(will · can · should …)
  CI.AUX = { do: ['do', 'pres', 'pl'], does: ['do', 'pres', 'sg'], did: ['do', 'past', null], have: ['have', 'pres', 'pl'], has: ['have', 'pres', 'sg'], had: ['have', 'past', null],
    is: ['be', 'pres', 'sg'], are: ['be', 'pres', 'pl'], was: ['be', 'past', 'sg'], were: ['be', 'past', 'pl'], will: ['modal'], can: ['modal'], should: ['modal'], would: ['modal'], could: ['modal'] };
  const FAMN = { do: 'do 쪽', have: 'have 쪽', be: 'be동사 쪽', modal: '조동사 쪽' };
  const VFN = { base: '동사원형', pp: 'p.p.', ing: '-ing' };
  const VFPAIR = { base: ['do', 'modal'], pp: ['have'], ing: ['be'] };
  const NUMN = { sg: '단수', pl: '복수' }, TENSEN = { pres: '현재', past: '과거' };
  const auxName = w => { const X = CI.AUX[w]; return !X ? '조동사 아님' : X[0] === 'modal' ? '조동사' : `${FAMN[X[0]]} · ${X[2] ? NUMN[X[2]] + ' ' : ''}${TENSEN[X[1]]}`; };
  function judgeAux(w, c) {
    const X = CI.AUX[w.toLowerCase()];
    if (!X) return no(1, `${w} → 조동사가 아니에요. 도치에서는 조동사가 주어 앞으로 나와요.`);
    if (!VFPAIR[c.vf].includes(X[0])) return no(2, `뒤의 ${c.v} = ${VFN[c.vf]} → 짝은 ${c.vf === 'base' ? 'do · does · did 또는 will · should 같은 조동사' : c.vf === 'pp' ? 'have · has · had' : 'be동사'}. ${w} → ${FAMN[X[0]]}이라 짝이 아니에요.`);
    if (X[0] !== 'modal' && ((X[2] && X[2] !== c.num) || X[1] !== c.tense)) return no(3, `주어 ${c.subj} → ${NUMN[c.num]}, 때는 ${TENSEN[c.tense]}. ${w} → ${X[2] ? NUMN[X[2]] + ' ' : ''}${TENSEN[X[1]]}라 맞지 않아요.`);
    return ok(`맨 앞에 ${c.sig} → ${w} + 주어 + ${VFN[c.vf]} (도치).${X[0] === 'modal' ? ' will · should 같은 조동사는 주어의 수와 상관없어요.' : ''}`);
  }
  // so · neither + 조동사 + 주어: 앞 절의 동사가 부르는 조동사
  function judgeSo(w, c) {
    const X = CI.AUX[w.toLowerCase()], need = { do: '일반동사 → do · does · did', be: 'be동사 → be동사', have: 'have + p.p. → have · has · had', modal: `조동사 → ${c.modal}` }[c.fam];
    if (!X) return no(1, `${c.sig} + 빈칸 + 주어 → 빈칸은 조동사 자리예요. ${w} → 조동사가 아니에요.`);
    if (X[0] !== c.fam || (c.fam === 'modal' && w.toLowerCase() !== c.modal)) return no(2, `앞 절의 동사 ${c.prev} → ${need}. ${w} → ${X[0] === 'modal' ? '다른 조동사' : FAMN[X[0]]}. 짝이 아니에요.`);
    if (X[0] !== 'modal' && ((X[2] && X[2] !== c.num) || X[1] !== c.tense)) return no(3, `앞 절의 ${c.prev} → ${TENSEN[c.tense]}. ${w} → ${TENSEN[X[1]]}라 맞지 않아요.`);
    return ok(`앞 절의 동사 ${c.prev} → ${need}. ${c.sig} + ${w} + 주어 → ‘~도 그래요’.`);
  }

  CI.judge = function (code, c) {
    switch (c.f) {
      case 'deg': return judgeDeg(code, c);
      case 'int': return judgeInt(code, c);
      case 'part': return judgePart(code, c);
      case 'noun': return judgeNoun(code, c);
      case 'cond': return judgeCond(code, c);
      case 'front': return judgeFront(code, c);
      case 'neg': return judgeNeg(code, c);
      case 'aux': return judgeAux(code, c);
      case 'so': return judgeSo(code, c);
    }
    return no(1, '알 수 없는 틀');
  };
  // 보기의 종류 이름 (보기 아래 작은 글씨 · 연습 문제 해설 앞머리)
  CI.kindName = function (code, c) {
    switch (c.f) {
      case 'deg': { const [p, d] = code.split('.'); return d ? `${CI.POS[p]} ${CI.DEG[d]}` : CI.POS[p]; }
      case 'int': return INTN[CI.INT[code.toLowerCase()]] || '강조어 아님';
      case 'part': return PARTN[code.toLowerCase()] || '전치사 (비교의 짝 아님)';
      case 'noun': return NOUNN[code];
      case 'cond': return CI.CONDN[code];
      case 'front': return FRONTN[code] || '도치로 if를 대신하지 못함';
      case 'neg': return NEGN[code];
      case 'aux': case 'so': return auxName(code.toLowerCase());
    }
    return '';
  };

  /* ---------- 놀이터 · 영상이 함께 쓰는 문장 틀: 신호어 스위치 ----------
   * 갈래(family)마다 틀(frame) 여럿. 틀 = 토큰 [글자, 역할, id] (___ = 빈칸), 판정 문맥 c, 이름, 한국어
   * 역할: sig 신호어 · subj 주어 · aux 앞으로 나오는 조동사 · p 짝(답) · rng 범위 · if절 · '' 보통
   * 같은 id의 토큰은 틀을 바꿀 때 미끄러져 움직여요(영상·놀이터의 morph).
   */
  const X = ['___', 'blank', 'X'];
  CI.SW = [
    { k: 'cmp', name: '비교', words: ['light', 'reliable', 'good', 'expensive'],
      note: '형용사의 모양(원급 · 비교급 · 최상급)을 신호어가 정해요.',
      frames: [
        { k: 'as', name: 'as … as', pair: 'as1', toks: [['The new laptop', 'subj', 'S'], ['is', '', 'is'], ['as', 'sig', 'as1'], X, ['as', 'sig', 'as2'], ['the old one', '', 'O'], ['.', '', 'dot']],
          c: { f: 'deg', sk: 'as', p: 'a' }, ko: w => `새 노트북은 예전 것만큼 ${A[w].kf[0]}.` },
        { k: 'than', name: 'than', pair: 'than', toks: [['The new laptop', 'subj', 'S'], ['is', '', 'is'], X, ['than', 'sig', 'than'], ['the old one', '', 'O'], ['.', '', 'dot']],
          c: { f: 'deg', sk: 'than', p: 'a' }, ko: w => `새 노트북은 예전 것보다 ${A[w].kf[0]}.` },
        { k: 'much', name: 'much … than', pair: 'much', toks: [['The new laptop', 'subj', 'S'], ['is', '', 'is'], ['much', 'sig', 'much'], X, ['than', 'sig', 'than'], ['the old one', '', 'O'], ['.', '', 'dot']],
          c: { f: 'deg', sk: 'much', p: 'a' }, ko: w => `새 노트북은 예전 것보다 훨씬 ${A[w].kf[0]}.` },
        { k: 'less', name: 'less … than', pair: 'less', only: ['reliable', 'expensive'], toks: [['The new laptop', 'subj', 'S'], ['is', '', 'is'], ['less', 'sig', 'less'], X, ['than', 'sig', 'than'], ['the old one', '', 'O'], ['.', '', 'dot']],
          c: { f: 'deg', sk: 'less', p: 'a' }, ko: w => `새 노트북은 예전 것보다 덜 ${A[w].kf[0]}.` },
        { k: 'sup', name: 'the … of', pair: 'the', toks: [['The new laptop', 'subj', 'S'], ['is', '', 'is'], ['the', 'sig', 'the'], X, ['of the three models', 'rng', 'rng'], ['.', '', 'dot']],
          c: { f: 'deg', sk: 'sup', p: 'a' }, ko: w => `새 노트북은 세 모델 가운데 가장 ${A[w].kf[0]}.` },
        { k: 'ever', name: 'the … ever', pair: 'the', toks: [['The new laptop', 'subj', 'S'], ['is', '', 'is'], ['the', 'sig', 'the'], X, ['model', '', 'N'], ['we have ever made', 'rng', 'ever'], ['.', '', 'dot']],
          c: { f: 'deg', sk: 'ever', p: 'a' }, ko: w => `새 노트북은 지금까지 만든 모델 가운데 가장 ${A[w].ko} 모델이에요.` },
        { k: 'thethe', name: 'The …, the', pair: 'the', only: ['light', 'reliable', 'good'], toks: [['The', 'sig', 'the'], X, ['the laptop is', 'subj', 'S'], [',', '', 'cm'], ['the more', 'sig', 'the2'], ['customers like it', '', 'O'], ['.', '', 'dot']],
          c: { f: 'deg', sk: 'thethe', p: 'a' }, ko: w => `노트북이 ${A[w].kf[1]} 더 많은 고객이 좋아해요.` },
      ] },
    { k: 'cond', name: '가정법', note: 'if절의 시제가 주절 동사의 짝을 정해요. if를 빼면 조동사가 주어 앞으로 나와요.',
      frames: [
        { k: 'real', name: 'If + 현재', pair: 'v', toks: [['If', 'sig', 'if'], ['we', 'subj', 'S'], ['hire', 'sig', 'v'], ['more staff', '', 'o'], [',', '', 'cm'], ['we', 'subj', 'S2'], X, ['the project on time', '', 'P'], ['.', '', 'dot']],
          c: { f: 'cond', side: 'main', mood: 'real', sig: 'If + 현재형(hire)' }, ko: () => '직원을 더 뽑으면, 프로젝트를 제때 끝낼 거예요. (실제로 뽑을 수도 있어요)' },
        { k: 'now', name: 'If + 과거', pair: 'v', toks: [['If', 'sig', 'if'], ['we', 'subj', 'S'], ['hired', 'sig', 'v'], ['more staff', '', 'o'], [',', '', 'cm'], ['we', 'subj', 'S2'], X, ['the project on time', '', 'P'], ['.', '', 'dot']],
          c: { f: 'cond', side: 'main', mood: 'now', sig: 'If + 과거형(hired)' }, ko: () => '직원을 더 뽑는다면, 프로젝트를 제때 끝낼 텐데요. (지금은 못 뽑아요)' },
        { k: 'past', name: 'If + had p.p.', pair: 'v', toks: [['If', 'sig', 'if'], ['we', 'subj', 'S'], ['had', 'aux', 'aux'], ['hired', 'sig', 'v'], ['more staff', '', 'o'], [',', '', 'cm'], ['we', 'subj', 'S2'], X, ['the project on time', '', 'P'], ['.', '', 'dot']],
          c: { f: 'cond', side: 'main', mood: 'past', sig: 'If + had p.p.(had hired)' }, ko: () => '직원을 더 뽑았더라면, 프로젝트를 제때 끝냈을 거예요. (그때 못 뽑았어요)' },
        { k: 'had', name: 'Had + 주어 (if 생략)', pair: 'aux', toks: [['Had', 'aux', 'aux'], ['we', 'subj', 'S'], ['hired', 'sig', 'v'], ['more staff', '', 'o'], [',', '', 'cm'], ['we', 'subj', 'S2'], X, ['the project on time', '', 'P'], ['.', '', 'dot']],
          c: { f: 'cond', side: 'main', mood: 'past', sig: 'Had we hired (= If we had hired)' }, ko: () => '직원을 더 뽑았더라면, 프로젝트를 제때 끝냈을 거예요. (= If we had hired more staff)' },
      ] },
    { k: 'inv', name: '도치', note: '맨 앞에 부정어 · only가 오면 뒤는 조동사 + 주어 어순이에요.',
      frames: [
        { k: 'plain', name: '보통 어순', pair: 'front', toks: [X, ['the results', '', 'o'], ['only after the review', 'rng', 'front'], ['.', '', 'dot']],
          c: { f: 'neg', front: 'none', sig: '부정어 없음', aux: 'will', vb: 'announce', vbad: 'announced' }, ko: () => '검토가 끝난 뒤에야 결과를 발표할 거예요.' },
        { k: 'only', name: 'Only after …', pair: 'front', toks: [['Only after the review', 'sig', 'front'], X, ['the results', '', 'o'], ['.', '', 'dot']],
          c: { f: 'neg', front: 'neg', sig: 'Only after the review', aux: 'will', vb: 'announce', vbad: 'announced' }, ko: () => '검토가 끝난 뒤에야 결과를 발표할 거예요.' },
        { k: 'until', name: 'Not until …', pair: 'front', toks: [['Not until the review is complete', 'sig', 'front'], X, ['the results', '', 'o'], ['.', '', 'dot']],
          c: { f: 'neg', front: 'neg', sig: 'Not until the review is complete', aux: 'will', vb: 'announce', vbad: 'announced' }, ko: () => '검토가 다 끝나고 나서야 결과를 발표할 거예요.' },
        { k: 'never', name: 'Never', pair: 'front', toks: [['Never', 'sig', 'front'], X, ['the results', '', 'o'], ['before the review', 'rng', 'bf'], ['.', '', 'dot']],
          c: { f: 'neg', front: 'neg', sig: 'Never', aux: 'will', vb: 'announce', vbad: 'announced' }, ko: () => '검토 전에는 결코 결과를 발표하지 않을 거예요.' },
        { k: 'noway', name: 'Under no circumstances', pair: 'front', toks: [['Under no circumstances', 'sig', 'front'], X, ['the results', '', 'o'], ['before the review', 'rng', 'bf'], ['.', '', 'dot']],
          c: { f: 'neg', front: 'neg', sig: 'Under no circumstances', aux: 'will', vb: 'announce', vbad: 'announced' }, ko: () => '어떤 경우에도 검토 전에는 결과를 발표하지 않을 거예요.' },
      ] },
  ];
  CI.fam = k => CI.SW.find(F => F.k === k);
  CI.frameOf = (fk, k) => CI.fam(fk).frames.find(f => f.k === k);
  // 틀이 받는 낱말 (비교 갈래)
  CI.wordsFor = (F, fr) => F.words ? (fr.only || F.words) : [null];
  // 후보: { w, code, toks?, j }  (판정은 규칙 엔진)
  const COND_C = [['will finish', 'will'], ['would finish', 'would'], ['would have finished', 'wouldhave'], ['had finished', 'had']];
  const INV_C = [
    ['will we announce', 'inv', [['will', 'aux', 'aux'], ['we', 'subj', 'S'], ['announce', '', 'v']]],
    ['we will announce', 'plain', [['we', 'subj', 'S'], ['will', 'aux', 'aux'], ['announce', '', 'v']]],
    ['will we announced', 'invBad', [['will', 'aux', 'aux'], ['we', 'subj', 'S'], ['announced', '', 'v']]],
    ['announcing', 'nf', [['announcing', '', 'v']]],
  ];
  CI.ctxSW = (F, fr, w) => Object.assign({}, fr.c, F.k === 'cmp' ? { base: w, slot: fr.k === 'thethe' ? '앞으로 나온 보어 자리' : 'be동사 is 뒤 보어' } : {});
  CI.cands = function (F, fr, w) {
    let list;
    if (F.k === 'cmp') {
      const D = A[w];
      list = [[D.f[0], 'a.pos'], [D.f[1], 'a.cmp'], [D.f[2], 'a.sup']];
      if (CI.dbl(w)) list.push([CI.dbl(w), 'a.dbl']);
      if (D.adv) list.push([D.adv, 'r.pos']);
    } else list = F.k === 'cond' ? COND_C : INV_C;
    const c = CI.ctxSW(F, fr, w);
    return list.map(([t, code, toks]) => ({ w: t, code, toks, j: CI.judge(code, c), kind: CI.kindName(code, c) }));
  };
  // 틀 → 토큰 목록. fill: null 빈칸 · 'ans' 정답 · 후보 번호
  CI.build = function (F, fr, w, fill) {
    const C = CI.cands(F, fr, w), ci = fill === 'ans' ? C.findIndex(x => x.j.s === 'ok') : fill;
    const out = [];
    fr.toks.forEach(([t, r, id]) => {
      if (t !== '___') { out.push({ id, t, r }); return; }
      if (ci == null || ci < 0) { out.push({ id: 'X', t: '', r: 'blank' }); return; }
      const K = C[ci], bad = K.j.s !== 'ok';
      (K.toks || [[K.w, 'p', 'X']]).forEach(([tt, rr, ii]) => out.push({ id: ii, t: tt, r: bad ? 'bad' : rr, fill: true }));
    });
    if (out[0] && out[0].t) out[0] = Object.assign({}, out[0], { t: out[0].t.charAt(0).toUpperCase() + out[0].t.slice(1) });
    return out;
  };
  CI.sentence = (F, fr, w, fill) => CI.build(F, fr, w, fill == null ? 'ans' : fill).map(t => t.t).join(' ').replace(/ ([.,])/g, '$1');
  // 신호어 스위치의 3단계 풀이
  CI.swSteps = function (F, fr, w) {
    const C = CI.cands(F, fr, w), right = C.find(x => x.j.s === 'ok'), drop = s => C.filter(x => x.j.step === s).map(x => x.w);
    const d = s => drop(s).length ? ` 탈락: ${drop(s).join(' · ')}.` : '';
    if (F.k === 'cmp') {
      const K = CI.SK[fr.c.sk];
      return [`① 신호어 → ${K.sig}. 빈칸 = ${CI.ctxSW(F, fr, w).slot} → 형용사 자리예요.${d(1)}`, `② 짝 → ${K.text}.${d(2)}`,
        `③ 함정 → 비교 표시는 한 번만${fr.k === 'less' ? ' (less + 비교급 ×)' : ''}.${d(3)} 정답 → ${right.w}.`];
    }
    if (F.k === 'cond') return [`① 신호어 → ${fr.c.sig} → ${CI.MOOD[fr.c.mood]}.${d(1)}`,
      `② 짝 → ${{ real: 'if절 현재형 ↔ 주절 will + 원형', now: 'if절 과거형 ↔ 주절 would + 원형', past: 'if절 had + p.p. ↔ 주절 would have + p.p.' }[fr.c.mood]}.${d(2)}`,
      `③ 함정 → had + p.p.는 if절의 모양이에요(주절 ×).${fr.k === 'had' ? ' if가 빠져도 짝은 그대로예요.' : ''}${d(3)} 정답 → ${right.w}.`].map(fix);
    return [`① 신호어 → ${fr.c.front === 'neg' ? '맨 앞의 ' + fr.c.sig + ' → 뒤는 도치' : '맨 앞에 부정어 없음 → 보통 어순'}.${d(1)}`,
      `② 짝 → ${fr.c.front === 'neg' ? '조동사 + 주어 + 동사' : '주어 + 조동사 + 동사'}.${d(2)}`, `③ 함정 → 조동사 will 뒤에는 동사원형.${d(3)} 정답 → ${right.w}.`];
  };

  /* ---------- 영상 01장 · 직접 해 보기: 세 모양, 비교 표시 한 번만 ---------- */
  CI.FORMS01 = ['light', 'large', 'easy', 'fast', 'good'];
  CI.SORT_DBL = [['more lighter', 'dbl', 'light'], ['lighter', 'cmp', 'light'], ['most best', 'dbl', 'good'], ['more reliable', 'cmp', 'reliable'], ['best', 'sup', 'good'], ['more better', 'dbl', 'good']];
  // 비교 표시가 한 번인지 (규칙 엔진의 deg 판정을 그대로 씀: dbl이면 ③ 함정)
  CI.once = (code, base) => code === 'dbl' ? no(3, `비교 표시를 두 번 했어요 → ${A[base].f.join(' → ')}. 한 번만 붙여요.`) : ok(`${CI.DEG[code]} → 비교 표시 한 번. ${A[base].f.join(' → ')}`);
  /* 영상 03장 직접 해 보기: 비교급 larger 앞에 올 수 있을까? */
  CI.SORT_INT = ['much', 'very', 'even', 'far', 'so', 'still', 'more', 'a lot'];
  /* 영상 06장: if가 빠지는 세 문장 (a: if절 그대로 · b: 도치) */
  CI.INV3 = [
    { k: 'Had', after: 'pp', a: [['If', 'sig', 'if'], ['we', 'subj', 'S'], ['had', 'aux', 'aux'], ['known about the delay', '', 'v'], [',', '', 'cm'], ['we would have called you', '', 'm'], ['.', '', 'd']],
      b: [['Had', 'aux', 'aux'], ['we', 'subj', 'S'], ['known about the delay', '', 'v'], [',', '', 'cm'], ['we would have called you', '', 'm'], ['.', '', 'd']], pair: 'Had + 주어 + p.p.', ko: '지연을 알았더라면 전화했을 거예요.' },
    { k: 'Should', after: 'base', a: [['If', 'sig', 'if'], ['you', 'subj', 'S'], ['should', 'aux', 'aux'], ['have any questions', '', 'v'], [',', '', 'cm'], ['please call us', '', 'm'], ['.', '', 'd']],
      b: [['Should', 'aux', 'aux'], ['you', 'subj', 'S'], ['have any questions', '', 'v'], [',', '', 'cm'], ['please call us', '', 'm'], ['.', '', 'd']], pair: 'Should + 주어 + 동사원형', ko: '혹시 질문이 있으시면 전화 주세요.' },
    { k: 'Were', after: 'comp', a: [['If', 'sig', 'if'], ['I', 'subj', 'S'], ['were', 'aux', 'aux'], ['in your position', '', 'v'], [',', '', 'cm'], ['I would accept the offer', '', 'm'], ['.', '', 'd']],
      b: [['Were', 'aux', 'aux'], ['I', 'subj', 'S'], ['in your position', '', 'v'], [',', '', 'cm'], ['I would accept the offer', '', 'm'], ['.', '', 'd']], pair: 'Were + 주어 + 보어', ko: '제가 당신 입장이라면 그 제안을 받아들일 거예요.' },
  ];
  CI.text = T => T.map(t => t[0]).join(' ').replace(/ ([.,])/g, '$1');

  /* ---------- 영상 08장 · 직접 해 보기: 신호어 → 짝 → 함정 (흐름도의 줄 번호 box) ---------- */
  CI.SIGNALS = [
    { k: 'as', box: 0, sig: 'as + 빈칸 + as', pair: '원급', ex: 'as light as', trap: 'as more light as ×', c: { f: 'deg', sk: 'as', p: 'a', base: 'light', slot: '보어' }, good: 'a.pos', bad: 'a.cmp' },
    { k: 'than', box: 0, sig: '빈칸 + than', pair: '비교급 (-er · more)', ex: 'lighter than', trap: 'more lighter than ×', c: { f: 'deg', sk: 'than', p: 'a', base: 'light', slot: '보어' }, good: 'a.cmp', bad: 'a.dbl' },
    { k: 'int', box: 0, sig: '빈칸 + 비교급 + than', pair: 'much · even · far · still', ex: 'much larger than', trap: 'very larger than ×', c: { f: 'int', cw: 'larger' }, good: 'much', bad: 'very' },
    { k: 'less', box: 0, sig: 'less + 빈칸 + than', pair: '원급', ex: 'less expensive than', trap: 'less more expensive ×', c: { f: 'deg', sk: 'less', p: 'a', base: 'expensive', slot: '보어' }, good: 'a.pos', bad: 'a.cmp' },
    { k: 'sup', box: 1, sig: 'the + 빈칸 + of · in · ever', pair: '최상급', ex: 'the lightest of the three', trap: 'the lighter of the three models ×', c: { f: 'deg', sk: 'sup', p: 'a', base: 'light', slot: '보어' }, good: 'a.sup', bad: 'a.cmp' },
    { k: 'oneof', box: 1, sig: 'one of the + 최상급 + 빈칸', pair: '복수 명사', ex: 'one of the largest suppliers', trap: 'one of the largest supplier ×', c: { f: 'noun', sig: 'one of the largest' }, good: 'n.pl', bad: 'n.sg' },
    { k: 'thethe', box: 1, sig: 'The 비교급 …, the + 빈칸', pair: 'the + 비교급', ex: 'The sooner you register, the more you save.', trap: 'the most you save ×', c: { f: 'deg', sk: 'thethe', p: 'a', base: 'good', slot: '보어' }, good: 'a.cmp', bad: 'a.sup' },
    { k: 'latin', box: 1, sig: 'superior · inferior · prior · senior + 빈칸', pair: 'to', ex: 'superior to', trap: 'superior than ×', c: { f: 'part', sk: 'latin', sig: 'superior' }, good: 'to', bad: 'than' },
    { k: 'now', box: 2, sig: 'If + 과거, 빈칸', pair: 'would + 원형', ex: 'If we hired more staff, we would finish on time.', trap: 'we will finish ×', c: { f: 'cond', side: 'main', mood: 'now', sig: 'If + 과거' }, good: 'would', bad: 'will' },
    { k: 'past', box: 2, sig: 'If + had p.p., 빈칸', pair: 'would have p.p.', ex: 'If we had known, we would have called.', trap: 'we had called ×', c: { f: 'cond', side: 'main', mood: 'past', sig: 'If + had p.p.' }, good: 'wouldhave', bad: 'had' },
    { k: 'front', box: 2, sig: '빈칸 + 주어 + p.p. …, 주절', pair: 'Had (Should + 원형 · Were + 보어)', ex: 'Had we known, we would have called.', trap: 'If we known ×', c: { f: 'front', after: 'pp', subj: 'we', rest: 'known' }, good: 'Had', bad: 'If' },
    { k: 'neg', box: 3, sig: 'Only · Never · Not only … 빈칸', pair: '조동사 + 주어 + 원형', ex: 'Only after the review will we announce …', trap: 'Only after the review we will ×', c: { f: 'neg', front: 'neg', sig: 'Only after', aux: 'will', vb: 'announce', vbad: 'announced' }, good: 'inv', bad: 'plain' },
    { k: 'so', box: 3, sig: 'and so · neither + 빈칸 + 주어', pair: '앞 동사에 맞는 조동사', ex: 'The sales team met its target, and so did the marketing team.', trap: 'and so was the marketing team ×', c: { f: 'so', sig: 'and so', prev: 'met', fam: 'do', tense: 'past', num: 'sg' }, good: 'did', bad: 'was' },
  ];

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * opts: [보기, code] · f와 틀 문맥(sk · p · slot · base · cw · side · mood · after …) · sig: 신호어(문장 속 글자)
   * mk: 단계별 표시 [[글자, 역할, 몇 번째]] (1: 신호어 · 2: 짝 · 3: 함정) · t3: ③ 함정 단계의 설명
   */
  CI.DRILL = [
    { q: 'Customers say our new website is ___ to use than the old one.', opts: [['easy', 'a.pos'], ['easily', 'r.pos'], ['more easier', 'a.dbl'], ['easier', 'a.cmp']], a: 3,
      f: 'deg', sk: 'than', p: 'a', base: 'easy', slot: 'be동사 is 뒤 보어', sig: 'than', mk: [['than', 'cue', 1], ['is', 'verb', 1]],
      t3: 'easier = 이미 비교급이에요. more를 또 붙이지 않아요.', tag: '비교급 + than', type: 52, ko: '고객들은 새 웹사이트가 예전 것보다 쓰기 쉽다고 말해요.' },
    { q: 'The renovated conference room is ___ larger than the old one.', opts: [['many', 'many'], ['very', 'very'], ['much', 'much'], ['most', 'most']], a: 2,
      f: 'int', cw: 'larger', sig: 'larger than', mk: [['larger than', 'cue', 1]],
      t3: 'very = 가장 흔한 강조어지만 원급만 꾸며요 → very large ✓, very larger ×.', tag: '비교급 강조 much · even · far', type: 52, ko: '새로 고친 회의실은 예전 회의실보다 훨씬 넓어요.' },
    { q: 'The upgraded copier runs as ___ as the newest models on the market.', opts: [['efficiently', 'r.pos'], ['efficient', 'a.pos'], ['more efficient', 'a.cmp'], ['more efficiently', 'r.cmp']], a: 0,
      f: 'deg', sk: 'as', p: 'r', base: 'efficient', slot: '동사 runs를 꾸미는 자리', sig: 'as', mk: [['as', 'cue', 1], ['runs', 'verb', 1], ['as', 'cue', 2, 1]],
      t3: '해석이 ‘더 효율적으로’ 같아도, as … as 사이에 비교급은 오지 않아요.', tag: 'as + 원급 + as · 부사 자리', type: 52, ko: '업그레이드한 복사기는 시장에 나온 최신 모델만큼 효율적으로 돌아가요.' },
    { q: 'The new model is less ___ than the previous one.', opts: [['expensively', 'r.pos'], ['expensive', 'a.pos'], ['most expensive', 'a.sup'], ['more expensive', 'a.cmp']], a: 1,
      f: 'deg', sk: 'less', p: 'a', base: 'expensive', slot: 'be동사 is 뒤 보어', sig: 'less', mk: [['less', 'cue', 1], ['than', 'cue', 2], ['is', 'verb', 1]],
      t3: 'less + 비교급 → 비교 표시가 두 번이에요. less 하나로 ‘덜 ~한’.', tag: 'less + 원급 + than', type: 52, ko: '새 모델은 예전 모델보다 덜 비싸요.' },
    { q: 'This is the ___ order that our company has ever received from a single client.', opts: [['large', 'a.pos'], ['largely', 'r.pos'], ['larger', 'a.cmp'], ['largest', 'a.sup']], a: 3,
      f: 'deg', sk: 'ever', p: 'a', base: 'large', slot: '명사 order 앞', sig: 'the', mk: [['the', 'cue', 1], ['ever', 'cue', 2]],
      t3: '비교급의 짝 than이 없어요. 범위 신호 ever → 최상급.', tag: 'the + 최상급 + ever', type: 53, ko: '이번 주문은 우리 회사가 한 고객에게서 받은 주문 가운데 가장 커요.' },
    { q: 'Ms. Kwon is one of the most experienced ___ at our firm.', opts: [['accountants', 'n.pl'], ['accountant', 'n.sg'], ['accountable', 'a'], ['accounted', 'v']], a: 0,
      f: 'noun', sig: 'one of the most experienced', mk: [['one of the most experienced', 'cue', 1]],
      t3: '한국어 ‘가장 경험 많은 회계사 중 한 명’에는 복수 표시가 없어요. 그래도 영어는 복수 -s.', tag: 'one of the + 최상급 + 복수 명사', type: 53, ko: '권 씨는 우리 회사에서 가장 경험이 많은 회계사 가운데 한 명이에요.' },
    { q: 'The ___ you register for the conference, the more you will save on fees.', opts: [['earliest', 'r.sup'], ['early', 'r.pos'], ['earlier', 'r.cmp'], ['earliness', 'n']], a: 2,
      f: 'deg', sk: 'thethe', p: 'r', base: 'early', slot: '동사 register를 꾸미는 자리', sig: 'The', mk: [['the more', 'cue', 1], ['register', 'verb', 1]],
      t3: '뒤에 the more가 보이면 앞도 The + 비교급이에요. ‘~할수록 더 ~하다’.', tag: 'The 비교급, the 비교급', type: 53, ko: '학회에 일찍 등록할수록 참가비를 더 많이 아낄 수 있어요.' },
    { q: 'The new model’s battery life is far superior ___ that of its competitors.', opts: [['than', 'than'], ['to', 'to'], ['as', 'as'], ['from', 'from']], a: 1,
      f: 'part', sk: 'latin', sig: 'superior', mk: [['superior', 'cue', 1], ['far', 'cue', 2]],
      t3: '비교라서 than이 끌리지만 superior · inferior · prior · senior는 to와 짝이에요.', tag: '라틴어 비교급 + to', type: 53, ko: '새 모델의 배터리 수명은 경쟁 제품보다 훨씬 뛰어나요.' },
    { q: '___ you have any questions about your order, please contact our customer service team.', opts: [['Would', 'Would'], ['Had', 'Had'], ['Were', 'Were'], ['Should', 'Should']], a: 3,
      f: 'front', after: 'base', subj: 'you', rest: 'have any questions', sig: 'please contact', mk: [['please contact', 'cue', 1], ['you have', 'ante', 2]],
      t3: '‘혹시 ~하면’이라는 뜻의 If you should have …에서 if가 빠진 모양이에요. 토익 안내문에 자주 나와요.', tag: 'Should 도치 (if 생략)', type: 54, ko: '주문에 관해 질문이 있으시면 고객 서비스팀에 연락해 주세요.' },
    { q: '___ we known about the road closure, we would have taken a different route.', opts: [['Had', 'Had'], ['If', 'If'], ['Should', 'Should'], ['Have', 'Have']], a: 0,
      f: 'front', after: 'pp', subj: 'we', rest: 'known', sig: 'would have taken', mk: [['would have taken', 'cue', 1], ['we known', 'ante', 2]],
      t3: '뜻은 If가 맞아 보여도 If we known에는 had가 없어요. if가 빠졌으니 Had가 앞으로.', tag: 'Had 도치 (if 생략)', type: 54, ko: '도로가 막힌 걸 알았더라면 다른 길로 갔을 거예요.' },
    { q: 'If we had received the invoice earlier, we ___ it before last week’s deadline.', opts: [['will pay', 'will'], ['would pay', 'would'], ['would have paid', 'wouldhave'], ['had paid', 'had']], a: 2,
      f: 'cond', side: 'main', mood: 'past', sig: 'If we had received', mk: [['If we had received', 'cue', 1], ['last week’s deadline', 'cue', 2]],
      t3: 'had paid = if절의 모양이에요. 주절에는 would have + p.p.', tag: '가정법 과거완료 · 주절', type: 54, ko: '청구서를 더 일찍 받았다면 지난주 마감 전에 냈을 거예요.' },
    { q: 'If our budget ___ larger, we would open a second office this year.', opts: [['is', 'pres'], ['were', 'past'], ['had been', 'had'], ['would be', 'would']], a: 1,
      f: 'cond', side: 'sub', mood: 'now', be: true, sig: 'would open', mk: [['would open', 'cue', 1], ['this year', 'cue', 2]],
      t3: 'if절 안에는 would를 쓰지 않아요. be동사의 가정법 과거는 주어와 상관없이 were가 기본이에요.', tag: '가정법 과거 · if절', type: 54, ko: '예산이 더 넉넉하다면 올해 두 번째 사무실을 열 텐데요.' },
    { q: 'Not only ___ online sales, but it also attracted many new customers.', opts: [['the campaign increased', 'plain'], ['did the campaign increased', 'invBad'], ['to increase', 'nf'], ['did the campaign increase', 'inv']], a: 3,
      f: 'neg', front: 'neg', sig: 'Not only', aux: 'did', vb: 'increase', vbad: 'increased', mk: [['Not only', 'cue', 1], ['but it also', 'cue', 2]],
      t3: 'did가 이미 과거를 나타내요. 뒤의 동사는 원형 → increase.', tag: 'Not only + did 도치', type: 55, ko: '그 캠페인은 온라인 매출을 늘렸을 뿐 아니라 새 고객도 많이 끌어들였어요.' },
    { q: 'Under no circumstances ___ visitors enter the laboratory without a safety badge.', opts: [['does', 'does'], ['have', 'have'], ['should', 'should'], ['are', 'are']], a: 2,
      f: 'aux', vf: 'base', num: 'pl', tense: 'pres', subj: 'visitors', v: 'enter', sig: 'Under no circumstances', mk: [['Under no circumstances', 'cue', 1], ['visitors', 'ante', 2], ['enter', 'verb', 2]],
      t3: '주어 visitors → 복수라서 does는 맞지 않아요. 조동사 should는 수와 상관없어요.', tag: 'Under no circumstances + 조동사', type: 55, ko: '어떤 경우에도 방문객은 안전 출입증 없이 실험실에 들어가면 안 돼요.' },
    { q: 'The sales department exceeded its target this quarter, and so ___ the marketing department.', opts: [['did', 'did'], ['was', 'was'], ['has', 'has'], ['does', 'does']], a: 0,
      f: 'so', sig: 'and so', prev: 'exceeded', fam: 'do', tense: 'past', num: 'sg', mk: [['and so', 'cue', 1], ['exceeded', 'verb', 2]],
      t3: 'exceeded → 과거라서 does가 아니라 did. ‘마케팅부도 그랬어요’.', tag: 'so + 조동사 + 주어', type: 55, ko: '영업부가 이번 분기 목표를 넘었고, 마케팅부도 그랬어요.' },
    { q: 'Never before ___ so many applications for a single position.', opts: [['we have received', 'plain'], ['have we received', 'inv'], ['we received', 'plain'], ['receiving', 'nf']], a: 1,
      f: 'neg', front: 'neg', sig: 'Never before', mk: [['Never before', 'cue', 1]],
      t3: '해석은 ‘우리는 받은 적이 없다’라서 we have received가 끌려요. 하지만 맨 앞에 Never가 오면 조동사가 먼저.', tag: 'Never before + have 도치', type: 55, ko: '한 자리에 이렇게 많은 지원서를 받은 적은 지금까지 없었어요.' },
  ];
  const CTX_KEYS = ['f', 'sk', 'p', 'base', 'slot', 'cw', 'sig', 'side', 'mood', 'be', 'after', 'subj', 'rest', 'front', 'aux', 'vb', 'vbad', 'vf', 'num', 'tense', 'v', 'prev', 'fam', 'modal'];
  CI.ctxOf = it => { const c = {}; CTX_KEYS.forEach(k => { if (it[k] != null) c[k] = it[k]; }); return c; };
  CI.judgeOpt = (it, k) => CI.judge(it.opts[k][1], CI.ctxOf(it));

  // 3단계 풀이 (연습 문제 힌트). ① 신호어 ② 짝 ③ 함정
  CI.steps = function (it) {
    const c = CI.ctxOf(it);
    const out = step => it.opts.map((o, k) => [k, CI.judgeOpt(it, k)]).filter(([, j]) => j.step === step).map(([k]) => `(${L[k]}) ${it.opts[k][0]}`);
    const drop = o => o.length ? ` 탈락: ${o.join(' · ')}.` : '';
    let t1, t2;
    switch (it.f) {
      case 'deg': t1 = `신호어 → ${CI.SK[it.sk].sig}. 빈칸 = ${it.slot} → ${CI.POS[it.p]} 자리예요.`; t2 = `${CI.SK[it.sk].text}.`; break;
      case 'int': t1 = `신호어 → ${it.cw} than. 빈칸은 비교급 ${it.cw}를 꾸미는 강조어 자리예요.`; t2 = '비교급을 세게 하는 짝 = much · even · far · still · a lot.'; break;
      case 'part': t1 = `신호어 → ${it.sig}. -or로 끝나는 라틴어 비교급이에요.`; t2 = 'superior · inferior · prior · senior의 짝 = to.'; break;
      case 'noun': t1 = `신호어 → ${it.sig}. 빈칸은 명사 자리예요.`; t2 = 'one of the + 최상급 → 여럿 가운데 하나 → 복수 명사.'; break;
      case 'cond': t1 = `신호어 → ${it.sig} → ${CI.MOOD[it.mood]}.`; t2 = { now: 'if절 과거형(be동사는 were) ↔ 주절 would + 원형.', past: 'if절 had + p.p. ↔ 주절 would have + p.p.', real: 'if절 현재형 ↔ 주절 will + 원형.' }[it.mood]; break;
      case 'front': t1 = `신호어 → 맨 앞 빈칸 + 콤마 + ${it.sig}. 숨은 if예요. if를 빼고 앞으로 나오는 말 = Should · Had · Were.`; t2 = `빈칸 뒤 = 주어 + ${CI.AFTERN[it.after]}(${it.subj} ${it.rest}) → ${Object.keys(CI.FRONT).find(k => CI.FRONT[k] === it.after)}. (Should + 원형 · Had + p.p. · Were + 보어)`; break;
      case 'neg': t1 = `신호어 → 맨 앞의 ${it.sig}. 뒤는 도치예요.`; t2 = '도치 = 조동사 + 주어 + 동사 (질문과 같은 어순).'; break;
      case 'aux': t1 = `신호어 → 맨 앞의 ${it.sig}. 빈칸 뒤에 주어 ${it.subj} → 빈칸은 주어 앞으로 나온 조동사 자리예요.`; t2 = `뒤의 ${it.v} = 동사원형 → do 쪽이나 will · should 같은 조동사.`; break;
      case 'so': t1 = `신호어 → ${it.sig} + 빈칸 + 주어 → ‘~도 그래요’. 빈칸은 조동사 자리예요.`; t2 = `앞 절의 동사 ${it.prev} → 일반동사 → do 쪽 조동사.`; break;
    }
    const t3 = fix(`${it.t3}${drop(out(3))} 정답 (${L[it.a]}) ${it.opts[it.a][0]}.`);
    const marks = s => (it.mk || []).filter(m => m[2] === s).map(([t, role, , nth]) => ({ t, role, nth: nth || 0 }));
    return [
      { head: '① 신호어를 찾아요.', text: fix(t1 + drop(out(1))), marks: marks(1) },
      { head: '② 짝을 맞춰요.', text: fix(t2 + drop(out(2))), marks: marks(2) },
      { head: '③ 함정을 확인해요.', text: t3, marks: marks(3) },
    ];
  };
  CI.drillItems = () => CI.DRILL.map(it => ({
    q: it.q, opts: it.opts.map(o => o[0]), a: it.a, ko: it.ko, tag: it.tag, steps: CI.steps(it),
    notes: it.opts.map(([, code], k) => { const j = CI.judgeOpt(it, k); return fix(`${CI.kindName(code, CI.ctxOf(it))}. `) + (j.s === 'ok' ? '' : `× (${['', '①', '②', '③'][j.step]}에서 탈락) `) + j.why; }),
  }));

  // 캔버스에 쓸 수 있는 글자 모두 (글꼴 미리 받기용 — 직접 해 보기·놀이터로만 나오는 글자 포함)
  CI.allText = function () {
    const out = [];
    Object.values(A).forEach(D => out.push(D.f.join(' '), D.adv || '', D.ko, D.kf.join(''), CI.dbl(D.w) || ''));
    CI.SW.forEach(F => F.frames.forEach(fr => CI.wordsFor(F, fr).forEach(w => {
      out.push(fr.name, CI.cands(F, fr, w).map(x => x.w + x.kind).join(''), CI.sentence(F, fr, w), fr.ko(w));
    })));
    CI.SIGNALS.forEach(s => out.push(s.sig, s.pair, s.ex, s.trap));
    CI.INV3.forEach(r => out.push(CI.text(r.a), CI.text(r.b), r.pair, r.ko));
    out.push(Object.values(CI.DEG).join(''), Object.values(CI.CONDN).join(''), Object.values(CI.MOOD).join(''), '신호어짝함정원급비교급최상급빈칸탈락정답');
    return out.join('');
  };

  // 데이터 점검: 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, 표시 글자가 문장에 있는지, 보기 글자가 사전과 같은지, 정답 위치가 고르게 섞였는지
  CI.check = function () {
    const bad = [];
    const nthIndex = (q, t, n) => { let i = -1, from = 0; for (let k = 0; k <= n; k++) { i = q.indexOf(t, from); if (i < 0) return -1; from = i + t.length; } return i; };
    CI.DRILL.forEach((it, i) => {
      const w = `연습 문제 ${i + 1}`;
      const good = it.opts.map((o, k) => CI.judgeOpt(it, k).s === 'ok' ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`${w}: 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      if ((it.q.match(/___/g) || []).length !== 1) bad.push(`${w}: 빈칸이 하나가 아니에요`);
      (it.mk || []).forEach(([t, , , n]) => { if (nthIndex(it.q, t, n || 0) < 0) bad.push(`${w}: 표시 ‘${t}’가 문장에 없어요`); });
      if (it.sig && it.f !== 'front' && !it.q.includes(it.sig)) bad.push(`${w}: 신호어 ‘${it.sig}’가 문장에 없어요`);
      if (it.f === 'front' && !it.q.includes(it.sig)) bad.push(`${w}: 주절 ‘${it.sig}’가 문장에 없어요`);
      if (it.f === 'front' && !it.q.includes(`___ ${it.subj} ${it.rest}`)) bad.push(`${w}: 빈칸 뒤 ‘${it.subj} ${it.rest}’가 문장과 달라요`);
      if (it.f === 'deg' && A[it.base]) it.opts.forEach(([o, code]) => {
        const [p, d] = code.split('.'), D = A[it.base];
        const want = p === 'a' ? (d === 'dbl' ? CI.dbl(it.base) : D.f[['pos', 'cmp', 'sup'].indexOf(d)]) : p === 'r' && D.adv ? (d === 'pos' ? D.adv : d === 'cmp' ? 'more ' + D.adv : 'most ' + D.adv) : p === 'r' && !D.adv ? D.f[['pos', 'cmp', 'sup'].indexOf(d)] : null;
        if (want && o !== want) bad.push(`${w}: 보기 ${o}가 ${code} 모양(${want})과 달라요`);
      });
      if (it.steps === undefined && CI.steps(it).some(s => !s.text)) bad.push(`${w}: 풀이 단계가 비어 있어요`);
      if (it.ko && /[A-Za-z]/.test(it.ko)) bad.push(`${w}: 해석에 영어가 섞여 있어요`);
    });
    const pos = [0, 0, 0, 0]; CI.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 1) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    // 놀이터: 틀마다(낱말마다) 후보 가운데 꼭 하나만 맞아야 해요
    CI.SW.forEach(F => F.frames.forEach(fr => CI.wordsFor(F, fr).forEach(w => {
      const C = CI.cands(F, fr, w), oks = C.filter(x => x.j.s === 'ok');
      if (oks.length !== 1) bad.push(`놀이터 ${F.k}·${fr.k}${w ? '·' + w : ''}: 맞는 후보가 ${oks.length}개예요`);
      if (fr.toks.filter(t => t[0] === '___').length !== 1) bad.push(`놀이터 ${F.k}·${fr.k}: 빈칸이 하나가 아니에요`);
      if (!fr.toks.some(t => t[2] === fr.pair)) bad.push(`놀이터 ${F.k}·${fr.k}: 짝 화살표의 출발 토큰이 없어요`);
    })));
    CI.SIGNALS.forEach(s => {
      if (CI.judge(s.good, s.c).s !== 'ok' || CI.judge(s.bad, s.c).s !== 'no') bad.push(`08장 신호어 ${s.k}: 예와 함정이 규칙 엔진과 달라요`);
    });
    CI.SORT_DBL.forEach(([t, code, base]) => { const D = A[base]; const want = code === 'dbl' ? (base === 'good' && t === 'most best' ? t : CI.dbl(base)) : D.f[['pos', 'cmp', 'sup'].indexOf(code)]; if (want !== t) bad.push(`01장 고르기 ${t}: 사전과 달라요`); });
    CI.SORT_INT.forEach(wd => { if (!CI.INT[wd]) bad.push(`03장 고르기 ${wd}: 강조어 표에 없어요`); });
    CI.INV3.forEach(r => {
      if (CI.judge(r.k, { f: 'front', after: r.after, subj: r.a[1][0], rest: r.a[3][0] }).s !== 'ok') bad.push(`06장 ${r.k}: 규칙 엔진과 달라요`);
      const ids = r.b.map(t => t[2]); if (ids.some(id => !r.a.some(t => t[2] === id))) bad.push(`06장 ${r.k}: 도치 문장의 토큰이 원래 문장에 없어요`);
    });
    bad.forEach(b => console.warn('[비교·도치] ' + b));
    return bad;
  };
})();
