#!/usr/bin/env node
/* 대화 목소리를 미리 만들 줄 목록 만들기 — 대화를 VoiceStudio 같은 미리 만든 음성 파일로 읽게 할 때 쓰는 첫 단계 (회화 · 듣기 튜토리얼)
 *
 *   node tools/dialogue-lines.cjs <폴더>      → <폴더>/audio/dialogue/lines.json
 *
 * 튜토리얼 페이지를 열어 window.__dialogueLines()(app.js)가 모은 줄을 그대로 받아 적어요.
 * 글이 정해진 말만: 영상의 말풍선 · 발음 칩, 직접 해 보기의 대표 말과 상대의 대답, 듣고 대답 고르기, 따라 말하기, 질문 목록.
 * 줄마다 { id: 목소리 부품(voices.js)의 lineId(말하는 사람, 글), sp: 말하는 사람, text: 읽을 글, from: 나오는 곳 }.
 * 다음 단계: VoiceStudio가 있는 맥에서 python3 tools/voicestudio-dialogue.py <폴더>
 * (파일이 없는 줄은 브라우저 음성으로 읽으니, 글을 고친 뒤 다시 만들기 전에도 대화는 끊기지 않아요.)
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
  console.error('쓰는 법: node tools/dialogue-lines.cjs <폴더>');
  process.exit(1);
}

(async () => {
  const { chromium } = loadPlaywright();
  const exe = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage();
  await page.goto('file://' + path.join(ROOT, slug, 'index.html'));
  await page.waitForFunction(() => typeof window.__dialogueLines === 'function', null, { timeout: 15000 }).catch(() => {
    console.error(`${slug}에는 window.__dialogueLines()가 없어요(대화 목소리 파일을 쓰는 튜토리얼만 돼요).`);
    process.exit(1);
  });
  const res = await page.evaluate(() => {
    const lines = window.__dialogueLines(), C = (window.DIALOGUE_CLIPS && window.DIALOGUE_CLIPS.clips) || {};
    return { lines, have: lines.filter((l) => C[l.id]).length };
  });
  await browser.close();
  const dir = path.join(ROOT, slug, 'audio', 'dialogue');
  fs.mkdirSync(dir, { recursive: true });
  const count = {};
  res.lines.forEach((l) => { count[l.sp] = (count[l.sp] || 0) + 1; });
  const out = {
    slug,
    note: '미리 만들 대화 줄 (tools/dialogue-lines.cjs가 페이지의 window.__dialogueLines()로 만듦 — 손으로 고치지 마세요). id = voices.js의 lineId(sp, text), text = 읽을 글(spoken), from = 나오는 곳',
    count: Object.fromEntries(Object.entries(count).sort()),
    lines: res.lines,
  };
  fs.writeFileSync(path.join(dir, 'lines.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`저장: ${slug}/audio/dialogue/lines.json — 줄 ${res.lines.length}개 (${Object.entries(out.count).map(([k, v]) => `${k} ${v}`).join(' · ')}), 이미 음성 파일이 있는 줄 ${res.have}개`);
})().catch((e) => { console.error(e); process.exit(1); });
