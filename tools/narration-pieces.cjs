#!/usr/bin/env node
/* 음성 해설의 읽기 조각 목록 만들기 — 미리 만든 음성 파일(예: VoiceStudio)로 해설을 읽게 할 때 쓰는 첫 단계
 *
 *   node tools/narration-pieces.cjs <폴더>      → <폴더>/audio/narration/pieces.json
 *
 * 튜토리얼 페이지를 열어 공통 부품(shared/narration.js)이 실제로 읽는 조각을 그대로 받아 적어요.
 * 자막 → 읽기 바꾸기(read) → 한국어 · 영어 나누기 → 조각마다 id(EN.narration.pieceId).
 * 이 목록으로 음성 파일을 만들면(tools/voicestudio-narration.py) 같은 id의 파일을 페이지가 찾아 읽어요.
 * 자막을 고친 뒤에는 이 목록을 다시 만들고, 바뀐 조각만 음성 파일을 새로 만들면 돼요.
 * (파일이 없는 조각은 브라우저 음성으로 읽으니, 다시 만들기 전에도 해설은 끊기지 않아요.)
 * 발음 듣기(EN.say: 영상 속 영어 칩 · 페이지의 스피커 단추)의 글도 영어 조각(from: 'say')으로 더해요 — tools/say-sweep.js가
 * 영상과 직접 해 보기를 훑어 글이 정해진 것만 모아요. EN.say가 같은 목록(EN_CLIPS)에서 파일을 찾아 음성 해설의 영어와 같은
 * 목소리로 읽어요. 대화 목소리를 따로 만드는 회화 튜토리얼(window.__dialogueLines가 있는 페이지)은 발음 칩도 대화 목록에
 * 들어 있어서(말하는 사람 tc) 훑지 않아요.
 *
 * 필요: Node 18+, playwright(Chromium) — tools/render-video.cjs와 같아요.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* 아래에서 전역 설치를 찾아봄 */ }
  try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); } catch (e) { /* 없음 */ }
  console.error('playwright가 필요해요: npm install --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const slug = (process.argv[2] || '').replace(/\/+$/, '');
if (!slug || !fs.existsSync(path.join(ROOT, slug, 'index.html'))) {
  console.error('쓰는 법: node tools/narration-pieces.cjs <폴더>');
  process.exit(1);
}

(async () => {
  const { chromium } = loadPlaywright();
  const exe = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage();
  await page.goto('file://' + path.join(ROOT, slug, 'index.html'));
  await page.waitForFunction(() => window.EN && EN.narration && EN.narration.last, null, { timeout: 15000 });
  await page.addScriptTag({ path: path.join(__dirname, 'say-sweep.js') });
  const res = await page.evaluate(() => {
    const n = EN.narration.last, C = window.EN_CLIPS && window.EN_CLIPS.clips || {};
    const pieces = n.pieces(), seen = new Set(pieces.map((p) => p.id));   // 해설 조각을 먼저 받아 두고(훑기는 페이지 상태를 바꿔요)
    const say = window.__dialogueLines ? [] : window.__collectSayLines();
    let nSay = 0;
    say.forEach((t0) => {
      const t = EN.say.text ? EN.say.text(t0) : String(t0).trim(), id = EN.narration.pieceId('en', t);
      if (!t || !/[A-Za-z]/.test(t) || seen.has(id)) return;
      seen.add(id); nSay++;
      pieces.push({ id, lang: 'en', text: t, from: 'say' });
    });
    return { pieces, have: pieces.filter((p) => C[p.id]).length, say: nSay };
  });
  await browser.close();
  const dir = path.join(ROOT, slug, 'audio', 'narration');
  fs.mkdirSync(dir, { recursive: true });
  const ko = res.pieces.filter((p) => p.lang === 'ko'), en = res.pieces.filter((p) => p.lang === 'en');
  const out = {
    slug,
    note: '음성 해설의 읽기 조각 (tools/narration-pieces.cjs가 만듦 — 손으로 고치지 마세요). id = EN.narration.pieceId(lang, text)',
    count: { ko: ko.length, en: en.length, say: res.say, koChars: ko.reduce((s, p) => s + p.text.length, 0), enChars: en.reduce((s, p) => s + p.text.length, 0) },
    pieces: res.pieces,
  };
  fs.writeFileSync(path.join(dir, 'pieces.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`저장: ${slug}/audio/narration/pieces.json — 한국어 조각 ${ko.length}개(${out.count.koChars}자) · 영어 조각 ${en.length}개(${out.count.enChars}자 — 그중 발음 듣기 ${res.say}개), 이미 음성 파일이 있는 조각 ${res.have}개`);
})().catch((e) => { console.error(e); process.exit(1); });
