/* 시제 튜토리얼 — 규칙 엔진과 예문
 *
 * 시제 문제의 보기 네 개는 같은 동사의 다른 모양이에요(worked · has worked · works · will work).
 * 답은 해석이 아니라 문장 속 '시간 단서'가 정합니다. 단서가 시간선의 어디를 가리키는지 정하고(time),
 * 빈칸이 어떤 절에 있는지(clause) 보면, 들어갈 동사 모양(form)이 하나로 정해져요.
 * 영상의 ✓·×, 직접 해 보기, 놀이터(시간선 시제 기계), 연습 문제, 퀴즈가 모두 judge()·judgeAdv()로 정답을 정하고,
 * 문제 데이터에 적은 정답이 규칙 엔진과 다르면 콘솔에 경고를 냅니다.
 *
 * 시간선 위의 자리(time):  P 과거의 한 점 · PN 과거 → 지금 구간 · N 지금·늘 · F 미래의 한 점
 *                          FB 미래 기준점보다 먼저 · PB 과거 기준점보다 먼저
 * 절(clause):              main 주절 · adv 시간·조건 부사절(when, if, as soon as, until, by the time) · that 요구·제안 that절
 * 동사 모양(form):         past 과거 · presperf 현재완료 · pres 현재 · prog 현재진행 · fut 미래 · futperf 미래완료
 *                          pastperf 과거완료 · base 동사원형 · ing -ing 혼자
 * judge(form, { time, clause }) → { s: 'ok' | 'no', why }
 * judgeAdv(부사, { form, neg, end }) → { s, why }   (시제와 짝인 부사: recently · shortly · currently · already · yet …)
 */
(function () {
  'use strict';
  const VT = (window.VT = {});

  // 받침이 있으면 앞의 조사, 없으면 뒤의 조사 (은/는, 과/와, 이/가)
  const jo = (w, a, b) => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b; };
  VT.jo = jo;

  const TIME = {
    P:  { name: '과거의 한 점', desc: '이미 끝난 때', cue: 'ago · yesterday · last', form: 'past' },
    PN: { name: '과거 → 지금 구간', desc: '과거에 시작해 지금까지 이어진 때', cue: 'since · so far · for the past', form: 'presperf' },
    N:  { name: '지금 · 늘', desc: '지금, 그리고 늘 되풀이되는 일', cue: 'every · currently', form: 'pres' },
    F:  { name: '미래의 한 점', desc: '아직 오지 않은 때', cue: 'next · tomorrow · soon', form: 'fut' },
    FB: { name: '미래 기준점보다 먼저', desc: '미래의 어느 때까지 끝나 있을 일', cue: 'by + 미래 시점', form: 'futperf' },
    PB: { name: '과거 기준점보다 먼저', desc: '과거의 어느 때보다 더 먼저 끝난 일', cue: 'by the time + 과거', form: 'pastperf' },
  };
  VT.TIME = TIME;
  const FORM = {
    past:     { name: '과거', shape: 'V-ed', time: 'P' },
    presperf: { name: '현재완료', shape: 'have·has + p.p.', time: 'PN' },
    pres:     { name: '현재', shape: 'V · V-s', time: 'N' },
    prog:     { name: '현재진행', shape: 'be + V-ing', time: 'N' },
    fut:      { name: '미래', shape: 'will + 동사원형', time: 'F' },
    futperf:  { name: '미래완료', shape: 'will have + p.p.', time: 'FB' },
    pastperf: { name: '과거완료', shape: 'had + p.p.', time: 'PB' },
    base:     { name: '동사원형', shape: 'V', time: null },
    ing:      { name: '-ing 혼자', shape: 'V-ing', time: null },
  };
  VT.FORM = FORM;
  VT.CLAUSE = { main: '주절', adv: '시간·조건 부사절', that: '요구·제안 that절' };

  const ok = why => ({ s: 'ok', why }), no = why => ({ s: 'no', why });
  const OKMSG = {
    P: '과거의 한 점을 가리키는 단서 → 과거 시제.',
    PN: '과거에서 지금까지 이어진 구간 → 현재완료(have·has + p.p.).',
    N: '지금, 또는 늘 되풀이되는 일 → 현재 시제.',
    F: '아직 오지 않은 미래의 한 점 → will + 동사원형.',
    FB: '미래의 기준점까지 끝나 있을 일 → 미래완료(will have + p.p.).',
    PB: '과거의 기준점보다 먼저 끝난 일 → 과거완료(had + p.p.).',
  };
  // 모양과 단서가 어긋날 때의 까닭 (form>time). 없는 짝은 아래 기본 문장
  const MISS = {
    'past>PN': '과거 시제는 이미 끝난 한 점이에요. 단서는 지금까지 이어진 구간이라 현재완료가 필요해요.',
    'pres>PN': '현재 시제는 지금·늘 하는 일이에요. 과거부터 지금까지 이어진 구간은 현재완료예요.',
    'prog>PN': '진행형은 지금 하는 중인 일만 말해요. 과거부터 이어진 구간은 현재완료예요.',
    'fut>PN': 'will 자리는 미래뿐이에요. 지금까지 이어진 일은 현재완료예요.',
    'presperf>P': '현재완료는 지금까지 이어진 일이에요. ago · yesterday · last 같은 과거의 한 점과는 함께 못 써요.',
    'pres>P': '이미 끝난 과거의 일이에요. 현재 시제가 아니에요.',
    'fut>P': '이미 지난 일이에요. will 자리는 미래뿐이에요.',
    'presperf>F': '현재완료는 지금까지의 일이에요. 미래 단서와 맞지 않아요.',
    'past>F': '아직 오지 않은 미래의 일이에요. 과거 시제가 아니에요.',
    'pres>F': '정해진 일정은 현재로도 말하지만, 토익 Part 5에서 미래 단서와 짝인 기본 답은 will + 동사원형이에요.',
    'presperf>FB': '기준점이 미래예요. 지금까지가 아니라 그때까지 끝나 있을 일 → will have + 과거분사.',
    'past>FB': '미래의 기준점까지 끝나 있을 일이에요. 과거 시제가 아니에요.',
    'pres>FB': '미래의 기준점까지 끝나 있을 일이에요. 현재 시제가 아니라 will have + 과거분사.',
    'fut>FB': 'by + 미래 기준점까지 ‘끝나 있을’ 일 → will have + 과거분사.',
    'pastperf>FB': '기준점이 미래예요. 과거완료(had + 과거분사)는 과거 기준점보다 먼저 끝난 일에 써요.',
    'presperf>PB': '기준점이 과거예요. 그보다 먼저 끝난 일 → have 대신 had + 과거분사.',
    'futperf>PB': '기준점이 과거예요. will have 대신 had + 과거분사.',
    'past>PB': '과거의 기준점보다 더 먼저 끝난 일이에요. by the time 뒤의 과거 시점이 기준이면 had + 과거분사.',
  };
  const missWhy = (form, time) => {
    if (MISS[form + '>' + time]) return MISS[form + '>' + time];
    if (form === 'pastperf') return '과거완료(had + 과거분사)는 과거의 기준점보다 더 먼저 일어난 일에만 써요. 문장에 그런 기준점이 없어요.';
    if (form === 'futperf') return '미래완료(will have + 과거분사)는 미래의 기준점(by + 미래 시점)이 있을 때만 써요.';
    const F = FORM[form];
    return `${F.name}${jo(F.name, '은', '는')} 시간선의 ‘${TIME[F.time].name}’이에요. 단서는 ‘${TIME[time].name}’을 가리켜요.`;
  };

  VT.judge = function (form, fr) {
    const F = FORM[form], clause = fr.clause || 'main';
    if (form === 'ing') return no('-ing 혼자서는 문장의 동사가 될 수 없어요. 앞에 be·have 같은 조동사가 있어야 해요.');
    if (clause === 'that') {
      if (form === 'base') return ok('요구·제안·필요를 말하는 말 뒤 that절 → 동사원형. 주어가 3인칭 단수여도, 앞 동사가 과거여도 원형이에요.');
      return no(form === 'pres' ? '주어가 단수여도 -s 없이 써요. that절은 (should) + 동사원형 자리예요.'
        : form === 'past' ? '앞 동사가 과거여도 that절의 동사를 과거로 바꾸지 않아요. 동사원형이에요.'
        : form === 'fut' ? 'will 없이 써요. (should) + 동사원형 자리라서 원형만 남아요.'
        : `${F.name}${jo(F.name, '이', '가')} 아니라 동사원형을 써요. 시제를 따지지 않는 자리예요.`);
    }
    if (form === 'base') return no('동사원형은 요구·제안 that절이나 조동사 뒤에 와요. 이 자리는 시제와 주어에 맞춘 동사가 필요해요.');
    if (clause === 'adv' && fr.time === 'F') {
      if (form === 'pres') return ok('시간·조건 부사절(when · if · as soon as · until · by the time)에서는 현재 시제가 미래를 나타내요.');
      if (form === 'fut' || form === 'futperf') return no('시간·조건 부사절에는 will 없이 써요. 미래의 일이어도 현재 시제예요.');
      if (form === 'past' || form === 'pastperf') return no('미래의 일이에요. 주절의 will 덕분에 알 수 있어요. 부사절에서는 현재 시제로 나타내요.');
      return no('미래의 일을 말하는 부사절에서는 단순 현재가 기본 답이에요.');
    }
    const want = [].concat(fr.time);
    if (want.includes(F.time)) return ok(OKMSG[F.time]);
    return no(missWhy(form, want[0]));
  };
  // 이 자리에 맞는 모양 (보기 일곱 가지 가운데)
  VT.FORMS7 = ['past', 'pres', 'presperf', 'fut', 'futperf', 'pastperf', 'base'];
  VT.rightForms = fr => VT.FORMS7.filter(f => VT.judge(f, fr).s === 'ok');

  /* ---------- 시제와 짝인 부사 (영상 08장) ---------- */
  const ADV = {
    recently:   { ko: '최근에', ok: ['presperf', 'past'] },
    lately:     { ko: '요즘', ok: ['presperf'] },
    already:    { ko: '벌써 · 이미', ok: ['presperf', 'pastperf', 'futperf'] },
    yet:        { ko: '아직', ok: ['presperf', 'pastperf'] },
    still:      { ko: '여전히', ok: ['pres', 'prog'] },
    shortly:    { ko: '곧', ok: ['fut'] },
    soon:       { ko: '곧', ok: ['fut'] },
    currently:  { ko: '지금 · 현재', ok: ['pres', 'prog'] },
    previously: { ko: '이전에', ok: ['past', 'pastperf', 'presperf'] },
    ago:        { ko: '~ 전에', ok: [] },
  };
  VT.ADV = ADV;
  const names = list => list.map(f => FORM[f].name).join(' · ');
  VT.judgeAdv = function (adv, fr) {
    const A = ADV[adv], F = FORM[fr.form], pair = names(A.ok), is = `이 문장의 동사는 ${F.name}(${F.shape})예요.`;
    if (adv === 'ago') return no('ago(~ 전에) → 혼자 못 써요. two years ago처럼 기간 뒤에 붙고, 과거 시제와 짝이에요.');
    if (adv === 'yet') return fr.neg && A.ok.includes(fr.form) ? ok('yet(아직) → 부정문의 완료형과 짝. has not arrived yet = 아직 도착하지 않았다.')
      : no('yet(아직) → 부정문·의문문에 써요. 긍정문의 ‘벌써’ → already.');
    if (adv === 'already' && fr.neg) return no('already(벌써) → 긍정문에 써요. 부정문의 ‘아직’ → yet.');
    if (adv === 'still' && fr.neg && fr.end) return no('still(여전히) → 부정문에서는 조동사 앞(still has not)에 와요. 문장 끝의 ‘아직’ → yet.');
    if (A.ok.includes(fr.form)) return ok(`${adv}(${A.ko}) → ${pair}${jo(pair, '과', '와')} 짝. ${is}`);
    return no(`${adv}(${A.ko}) → ${pair}${jo(pair, '과', '와')} 짝이에요. ${is}`);
  };

  /* ---------- 시간 단서 사전 (영상 03·04장, 직접 해 보기, 퀴즈) ---------- */
  VT.CLUES = {
    'yesterday': 'P', 'last week': 'P', 'last month': 'P', 'two years ago': 'P', 'in 2019': 'P',
    'since 2020': 'PN', 'since January': 'PN', 'for the past five years': 'PN', 'so far': 'PN', 'so far this year': 'PN', 'over the past year': 'PN', 'over the past month': 'PN',
    'every month': 'N', 'currently': 'N',
    'tomorrow': 'F', 'next week': 'F', 'next month': 'F', 'next year': 'F', 'soon': 'F', 'in two weeks': 'F',
    'by next March': 'FB', 'by the end of this year': 'FB',
    'by the time the CEO arrived': 'PB', 'by the end of last year': 'PB',
  };
  VT.clueTime = c => VT.CLUES[c];

  /* ---------- 연습 문제 (토익 Part 5 형식, 직접 만든 문제) ----------
   * 동사 문제: opts [글, 모양], frame { time, clause }
   * 부사 문제: kind 'adv', opts [부사, 부사], frame { form, neg, end }
   * c1: 3단계 풀이 ①의 문장, marks: 문장 속 단서 (cue 단서 · verb 다른 절의 동사 · ante 기준점 · trap 함정)
   */
  VT.DRILL = [
    { q: 'Ms. Rivera ___ at the Seoul branch since 2020.', type: 16, a: 1,
      opts: [['worked', 'past'], ['has worked', 'presperf'], ['works', 'pres'], ['will work', 'fut']], frame: { time: 'PN' },
      c1: 'since 2020 → 2020년에 시작해서 이어진 기간.', marks: [{ t: 'since 2020', role: 'cue' }],
      tag: '현재완료 · since', ko: '리베라 씨는 2020년부터 서울 지점에서 일해 왔어요.' },
    { q: 'The company ___ its new headquarters two years ago.', type: 16, a: 0,
      opts: [['opened', 'past'], ['has opened', 'presperf'], ['opens', 'pres'], ['will open', 'fut']], frame: { time: 'P' },
      c1: 'two years ago → 지금부터 2년 전.', marks: [{ t: 'two years ago', role: 'cue' }],
      tag: '과거 · ago', ko: '그 회사는 2년 전에 새 본사를 열었어요.' },
    { q: 'The finance team ___ the annual budget at next Monday\'s meeting.', type: 16, a: 2,
      opts: [['presented', 'past'], ['has presented', 'presperf'], ['will present', 'fut'], ['had presented', 'pastperf']], frame: { time: 'F' },
      c1: 'next Monday → 다음 주 월요일.', marks: [{ t: 'next Monday', role: 'cue' }],
      tag: '미래 · next', ko: '재무팀은 다음 주 월요일 회의에서 연간 예산안을 발표할 거예요.' },
    { q: 'Sales ___ steadily since the company launched its new website.', type: 16, a: 3,
      opts: [['increased', 'past'], ['increase', 'pres'], ['will increase', 'fut'], ['have increased', 'presperf']], frame: { time: 'PN' },
      c1: 'since → 웹사이트를 연 때부터. since 뒤의 launched → 시작점이라 과거(함정).', marks: [{ t: 'since', role: 'cue' }, { t: 'launched', role: 'trap' }],
      tag: '현재완료 · since + 과거 절', ko: '회사가 새 웹사이트를 연 뒤로 매출이 꾸준히 늘었어요.' },
    { q: 'When the shipment ___, we will call you immediately.', type: 17, a: 0,
      opts: [['arrives', 'pres'], ['will arrive', 'fut'], ['arrived', 'past'], ['had arrived', 'pastperf']], frame: { time: 'F', clause: 'adv' },
      c1: 'When 부사절 + 주절의 will call → 앞으로 일어날 일.', marks: [{ t: 'When', role: 'cue' }, { t: 'will call', role: 'verb' }],
      tag: '시간 부사절 · when', ko: '물건이 도착하면 바로 전화드릴게요.' },
    { q: 'As soon as the contract ___ signed, construction will begin.', type: 17, a: 3,
      opts: [['will be', 'fut'], ['was', 'past'], ['being', 'ing'], ['is', 'pres']], frame: { time: 'F', clause: 'adv' },
      c1: 'As soon as 부사절 + 주절의 will begin → 앞으로 일어날 일.', marks: [{ t: 'As soon as', role: 'cue' }, { t: 'will begin', role: 'verb' }],
      tag: '시간 부사절 · as soon as', ko: '계약서에 서명하자마자 공사가 시작될 거예요.' },
    { q: 'Please remain in your seats until the plane ___ to a complete stop.', type: 17, a: 1,
      opts: [['will come', 'fut'], ['comes', 'pres'], ['came', 'past'], ['coming', 'ing']], frame: { time: 'F', clause: 'adv' },
      c1: 'until 부사절 + 앞으로 할 일을 부탁하는 Please remain → 미래의 일.', marks: [{ t: 'until', role: 'cue' }, { t: 'Please remain', role: 'verb' }],
      tag: '시간 부사절 · until', ko: '비행기가 완전히 멈출 때까지 자리에 앉아 계세요.' },
    { q: 'By next March, Ms. Choi ___ the leadership training program.', type: 18, a: 2,
      opts: [['has completed', 'presperf'], ['had completed', 'pastperf'], ['will have completed', 'futperf'], ['completes', 'pres']], frame: { time: 'FB' },
      c1: 'By next March → 내년 3월이라는 미래의 기준점.', marks: [{ t: 'By next March', role: 'ante' }],
      tag: '미래완료 · by + 미래', ko: '내년 3월이면 최 씨는 리더십 교육 과정을 마쳤을 거예요.' },
    { q: 'By the time the CEO arrived, the meeting ___ already started.', type: 18, a: 2,
      opts: [['has', 'presperf'], ['will have', 'futperf'], ['had', 'pastperf'], ['having', 'ing']], frame: { time: 'PB' }, show: 'had already started',
      c1: 'By the time the CEO arrived → 과거의 기준점(CEO 도착).', marks: [{ t: 'By the time', role: 'cue' }, { t: 'arrived', role: 'ante' }],
      tag: '과거완료 · by the time + 과거', ko: '최고 경영자(CEO)가 도착했을 때는 회의가 이미 시작된 뒤였어요.' },
    { q: 'By the time the new manager ___, the team will have finished the report.', type: 17, a: 1,
      opts: [['will arrive', 'fut'], ['arrives', 'pres'], ['arrived', 'past'], ['arriving', 'ing']], frame: { time: 'F', clause: 'adv' },
      c1: 'By the time 부사절 + 주절의 will have finished → 미래의 기준점.', marks: [{ t: 'By the time', role: 'cue' }, { t: 'will have finished', role: 'verb' }],
      tag: '부사절 + 미래완료', ko: '새 매니저가 올 때쯤이면 팀은 보고서를 끝냈을 거예요.' },
    { q: 'The manager recommended that every employee ___ the safety training.', type: 19, a: 0,
      opts: [['attend', 'base'], ['attends', 'pres'], ['attended', 'past'], ['will attend', 'fut']], frame: { clause: 'that' },
      c1: 'recommended that → 요구·제안 동사 뒤의 that절. 함정: 단수 주어 every employee, 과거 recommended.', marks: [{ t: 'recommended that', role: 'cue' }, { t: 'every employee', role: 'trap' }],
      tag: '요구·제안 that절', ko: '매니저는 모든 직원이 안전 교육에 참석해야 한다고 권했어요.' },
    { q: 'The board has requested that the report ___ submitted by Friday.', type: 19, a: 3,
      opts: [['is', 'pres'], ['was', 'past'], ['will be', 'fut'], ['be', 'base']], frame: { clause: 'that' },
      c1: 'requested that → 요구·제안 동사 뒤의 that절. 함정: by Friday → 시제 단서가 아니에요.', marks: [{ t: 'requested that', role: 'cue' }, { t: 'by Friday', role: 'trap' }],
      tag: '요구·제안 that절 · 수동', ko: '이사회는 보고서를 금요일까지 제출해 달라고 요청했어요.' },
    { q: 'It is essential that each visitor ___ an ID badge at all times.', type: 19, a: 3,
      opts: [['wears', 'pres'], ['wore', 'past'], ['wearing', 'ing'], ['wear', 'base']], frame: { clause: 'that' },
      c1: 'It is essential that → ‘꼭 해야 한다’를 말하는 that절. each visitor(단수)는 함정.', marks: [{ t: 'It is essential that', role: 'cue' }, { t: 'each visitor', role: 'trap' }],
      tag: '필요를 말하는 that절', ko: '방문객은 누구나 늘 출입증을 달고 있어야 해요.' },
    { q: 'The lobby has ___ been renovated, so it looks brand new.', type: 20, a: 2, kind: 'adv',
      opts: [['shortly', 'shortly'], ['currently', 'currently'], ['recently', 'recently'], ['ago', 'ago']], frame: { form: 'presperf' },
      c1: '동사 has been renovated → 현재완료.', marks: [{ t: 'has', role: 'verb' }, { t: 'been renovated', role: 'verb' }],
      tag: '짝 부사 · recently', ko: '로비는 최근에 새로 단장해서 새것처럼 보여요.' },
    { q: 'The new branch will open ___ after the renovation work is finished.', type: 20, a: 0, kind: 'adv',
      opts: [['shortly', 'shortly'], ['recently', 'recently'], ['already', 'already'], ['previously', 'previously']], frame: { form: 'fut' },
      c1: '동사 will open → 미래.', marks: [{ t: 'will open', role: 'verb' }],
      tag: '짝 부사 · shortly', ko: '새 지점은 보수 공사가 끝나면 곧 문을 열 거예요.' },
    { q: 'The shipment from Busan has not arrived ___.', type: 20, a: 1, kind: 'adv',
      opts: [['already', 'already'], ['yet', 'yet'], ['still', 'still'], ['soon', 'soon']], frame: { form: 'presperf', neg: true, end: true },
      c1: '동사 has not arrived → 현재완료, 그리고 부정문(not).', marks: [{ t: 'has not arrived', role: 'verb' }],
      tag: '짝 부사 · yet', ko: '부산에서 오는 물건이 아직 도착하지 않았어요.' },
  ];
  VT.judgeOpt = (it, k) => it.kind === 'adv' ? VT.judgeAdv(it.opts[k][1], it.frame) : VT.judge(it.opts[k][1], it.frame);
  VT.optName = (it, k) => it.kind === 'adv' ? `${it.opts[k][0]}(${ADV[it.opts[k][1]].ko})` : FORM[it.opts[k][1]].name;

  // 3단계 풀이 (연습 문제 힌트). ① 단서 ② 시간선 ③ 모양
  VT.steps = function (it) {
    const ans = it.opts[it.a][0];
    if (it.kind === 'adv') {
      const F = FORM[it.frame.form], T = TIME[F.time];
      const others = it.opts.filter((o, k) => k !== it.a && o[1] !== 'ago').map(o => `${o[0]}(${ADV[o[1]].ko})`).join(', ');
      return [
        { head: '① 단서를 찾아요.', text: it.c1, marks: it.marks },
        { head: '② 시간선에 놓아요.', text: `${F.name} = 시간선의 ‘${T.name}’${it.frame.neg ? '. 부정문이라 아직 일어나지 않은 일' : ''}.`, marks: [] },
        { head: '③ 모양을 골라요.', text: `이 시제와 짝인 부사 → ${ans}. ${others}${jo(others, '은', '는')} 짝이 맞지 않아요.`, marks: [] },
      ];
    }
    const fr = it.frame, form = it.opts[it.a][1], F = FORM[form];
    const s2 = fr.clause === 'that' ? '시간선 위의 한 점이 아니라 ‘해야 할 일’이에요. 시제를 따지지 않아요.'
      : fr.clause === 'adv' ? `${TIME[fr.time].name}에 일어날 일이에요. 그런데 빈칸은 시간·조건 부사절 안이에요.`
      : `${TIME[fr.time].name}: ${TIME[fr.time].desc}.`;
    const s3 = fr.clause === 'that' ? `동사원형 → ${ans}. -s · 과거 · will → 모두 ×.`
      : fr.clause === 'adv' ? `부사절은 현재 시제로 미래를 나타내요 → ${ans}. will 붙은 보기 → ×.`
      : `${F.name}(${F.shape}) → ${it.show || ans}.`;
    return [
      { head: '① 단서를 찾아요.', text: it.c1, marks: it.marks },
      { head: '② 시간선에 놓아요.', text: s2, marks: [] },
      { head: '③ 모양을 골라요.', text: s3, marks: [] },
    ];
  };
  VT.drillItems = () => VT.DRILL.map(it => ({
    q: it.q, opts: it.opts.map(o => o[0]), a: it.a, ko: it.ko, tag: it.tag, steps: VT.steps(it),
    notes: it.opts.map((o, k) => { const j = VT.judgeOpt(it, k); return `${VT.optName(it, k)}. ` + (j.s === 'ok' ? '' : '× ') + j.why; }),
  }));

  /* ---------- 시간선 시제 기계 (놀이터) ----------
   * 문장 넷 × 단서 열네 개. 주어는 모두 3인칭 단수라서 현재(-s)와 동사원형의 모양이 늘 달라요.
   * v: [원형, 3인칭 단수, 과거, 과거분사]
   */
  VT.VPS = [
    { id: 'store', S: 'Our company', s: 'our company', v: ['open', 'opens', 'opened', 'opened'], o: 'three new stores', ko: '새 매장 세 곳을 열다' },
    { id: 'hire', S: 'The hotel', s: 'the hotel', v: ['hire', 'hires', 'hired', 'hired'], o: '20 new employees', ko: '새 직원 20명을 뽑다' },
    { id: 'sell', S: 'The theater', s: 'the theater', v: ['sell', 'sells', 'sold', 'sold'], o: '500 tickets', ko: '표 500장을 팔다' },
    { id: 'visit', S: 'Ms. Kim', s: 'Ms. Kim', v: ['visit', 'visits', 'visited', 'visited'], o: 'four branches', ko: '지점 네 곳을 방문하다' },
  ];
  // tpl: {S} 문장 첫머리 주어, {s} 문장 가운데 주어, {V} 동사, {O} 목적어
  VT.MCLUES = [
    { id: 'yesterday', label: 'yesterday', mark: 'yesterday', frame: { time: 'P' }, tpl: '{S} {V} {O} yesterday.' },
    { id: 'ago', label: 'two years ago', mark: 'two years ago', frame: { time: 'P' }, tpl: '{S} {V} {O} two years ago.' },
    { id: 'since', label: 'since January', mark: 'since January', frame: { time: 'PN' }, tpl: '{S} {V} {O} since January.' },
    { id: 'sofar', label: 'so far this year', mark: 'So far this year', frame: { time: 'PN' }, tpl: 'So far this year, {s} {V} {O}.' },
    { id: 'past', label: 'over the past month', mark: 'Over the past month', frame: { time: 'PN' }, tpl: 'Over the past month, {s} {V} {O}.' },
    { id: 'every', label: 'every month', mark: 'every month', frame: { time: 'N' }, tpl: '{S} {V} {O} every month.' },
    { id: 'next', label: 'next month', mark: 'next month', frame: { time: 'F' }, tpl: '{S} {V} {O} next month.' },
    { id: 'tomorrow', label: 'tomorrow', mark: 'tomorrow', frame: { time: 'F' }, tpl: '{S} {V} {O} tomorrow.' },
    { id: 'byF', label: 'by the end of this year', mark: 'By the end of this year', frame: { time: 'FB' }, tpl: 'By the end of this year, {s} {V} {O}.', ref: 'end of this year' },
    { id: 'byP', label: 'by the end of last year', mark: 'By the end of last year', frame: { time: 'PB' }, tpl: 'By the end of last year, {s} {V} {O}.', ref: 'end of last year' },
    { id: 'when', label: 'When …, we will celebrate.', mark: 'When', mark2: 'will celebrate', frame: { time: 'F', clause: 'adv' }, tpl: 'When {s} {V} {O}, we will celebrate.', main: 'will celebrate' },
    { id: 'if', label: 'If … next month, …', mark: 'If', mark2: 'will be pleased', frame: { time: 'F', clause: 'adv' }, tpl: 'If {s} {V} {O} next month, the CEO will be pleased.', main: 'will be pleased' },
    { id: 'that', label: 'The board requested that …', mark: 'requested that', frame: { clause: 'that' }, tpl: 'The board requested that {s} {V} {O}.' },
    { id: 'essential', label: 'It is essential that …', mark: 'It is essential that', frame: { clause: 'that' }, tpl: 'It is essential that {s} {V} {O}.' },
  ];
  VT.conj = function (vp, form) {
    const [b, s, p, pp] = vp.v;
    return { past: p, pres: s, presperf: 'has ' + pp, fut: 'will ' + b, futperf: 'will have ' + pp, pastperf: 'had ' + pp, base: b, prog: 'is ' + b + 'ing' }[form];
  };
  // 문장 만들기. form이 없으면 빈칸(___). 돌려주는 값: { text, parts: [앞, 동사, 뒤] }
  VT.build = function (vp, clue, form) {
    const verb = form ? VT.conj(vp, form) : '___';
    const full = clue.tpl.replace('{S}', vp.S).replace('{s}', vp.s).replace('{O}', vp.o);
    const i = full.indexOf('{V}');
    return { text: full.replace('{V}', verb), parts: [full.slice(0, i), verb, full.slice(i + 3)] };
  };

  // 데이터 점검: 정답이 규칙 엔진과 같은지, 정답이 하나뿐인지, 단서가 문장에 있는지, 정답 위치가 고르게 섞였는지
  VT.check = function () {
    const bad = [];
    VT.DRILL.forEach((it, i) => {
      const good = it.opts.map((o, k) => VT.judgeOpt(it, k).s === 'ok' ? k : -1).filter(k => k >= 0);
      if (good.length !== 1 || good[0] !== it.a) bad.push(`연습 문제 ${i + 1}: 정답 ${it.a}, 규칙 엔진 ${JSON.stringify(good)}`);
      it.marks.forEach(m => { if (!it.q.includes(m.t)) bad.push(`연습 문제 ${i + 1}: 단서 ‘${m.t}’가 문장에 없어요`); });
      if ((it.q.match(/___/g) || []).length !== 1) bad.push(`연습 문제 ${i + 1}: 빈칸이 하나가 아니에요`);
    });
    const pos = [0, 0, 0, 0]; VT.DRILL.forEach(it => pos[it.a]++);
    if (Math.max(...pos) - Math.min(...pos) > 2) bad.push('연습 문제 정답 위치가 한쪽에 몰려 있어요: ' + pos.join(','));
    VT.MCLUES.forEach(c => {
      const r = VT.rightForms(c.frame);
      if (r.length !== 1) bad.push(`시제 기계 단서 ‘${c.label}’: 맞는 모양이 ${r.length}개예요`);
      if (c.frame.time && VT.CLUES[c.label] && VT.CLUES[c.label] !== c.frame.time) bad.push(`시제 기계 단서 ‘${c.label}’: 단서 사전과 시간이 달라요`);
      VT.VPS.forEach(vp => { const t = VT.build(vp, c, 'past').text; [c.mark, c.mark2].forEach(m => { if (m && !t.includes(m)) bad.push(`시제 기계 단서 ‘${c.label}’: 표시할 글 ‘${m}’이 문장에 없어요`); }); });
    });
    bad.forEach(b => console.warn('[시제] ' + b));
    return bad;
  };
})();
