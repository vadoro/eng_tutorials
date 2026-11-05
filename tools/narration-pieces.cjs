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
  const res = await page.evaluate(() => {
    const n = EN.narration.last, C = window.EN_CLIPS && window.EN_CLIPS.clips || {};
    return { pieces: n.pieces(), have: n.pieces().filter((p) => C[p.id]).length };
  });
  await browser.close();
  const dir = path.join(ROOT, slug, 'audio', 'narration');
  fs.mkdirSync(dir, { recursive: true });
  const ko = res.pieces.filter((p) => p.lang === 'ko'), en = res.pieces.filter((p) => p.lang === 'en');
  const out = {
    slug,
    note: '음성 해설의 읽기 조각 (tools/narration-pieces.cjs가 만듦 — 손으로 고치지 마세요). id = EN.narration.pieceId(lang, text)',
    count: { ko: ko.length, en: en.length, koChars: ko.reduce((s, p) => s + p.text.length, 0), enChars: en.reduce((s, p) => s + p.text.length, 0) },
    pieces: res.pieces,
  };
  fs.writeFileSync(path.join(dir, 'pieces.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`저장: ${slug}/audio/narration/pieces.json — 한국어 조각 ${ko.length}개(${out.count.koChars}자) · 영어 조각 ${en.length}개(${out.count.enChars}자), 이미 음성 파일이 있는 조각 ${res.have}개`);
})().catch((e) => { console.error(e); process.exit(1); });
