#!/usr/bin/env node
/* 영어 튜토리얼 공통 영상 렌더러 — 어느 튜토리얼이든 MP4로 내보내기
 *
 *   node tools/render-video.cjs <폴더>                      → <폴더>/video/<폴더>.mp4 (+ .srt 자막 원고, 장 표시)
 *   node tools/render-video.cjs <폴더> --from 20 --to 34    원하는 구간만
 *   node tools/render-video.cjs <폴더> --frames 6.2,100     몇 장면만 JPEG로 (frames/<폴더>/, 미리보기용)
 *   node tools/render-video.cjs <폴더> --poster 26          카드 미리보기 그림 <폴더>/docs/poster.jpg (1280×720)
 *   node tools/render-video.cjs <폴더> --srt                자막 원고만 <폴더>/video/<폴더>.srt (영상은 만들지 않음)
 *
 * 옵션: --fps 30  --out 경로.mp4  --crf 20
 * 필요: Node 18+, playwright(Chromium), ffmpeg
 *   처음 한 번: npm install --no-save playwright && npx playwright install chromium
 *   ffmpeg 경로를 따로 쓰려면 FFMPEG=/경로/ffmpeg, Chromium은 CHROMIUM_PATH=/경로
 *
 * 약속(EN_EXPORT): 튜토리얼 페이지를 <폴더>/index.html#export 로 열면 아래 객체가 있어야 합니다.
 *   window.EN_EXPORT = {
 *     title: '영상 제목',                          // MP4 메타데이터 (없으면 페이지 <title>)
 *     duration: 초,
 *     chapters: [{ title, start }],               // MP4 장 표시
 *     captions: [{ start, end, text }],           // .srt 자막 원고 (**굵게** 표시는 지움)
 *     ready: () => Promise,                       // 글꼴 등 준비가 끝나면 풀림
 *     frame: (t, fps, quality) => 'data:image/jpeg;base64,…',   // t초 장면, 1920×1080
 *   };
 *   같은 t면 언제나 같은 그림을 돌려줘야 합니다(난수 시드 고정).
 *
 * 프록시 환경에서 헤드리스 브라우저가 Google Fonts 인증서를 믿지 못하면, 글꼴 요청만 Node fetch가 대신 받아 넘깁니다.
 * 이때 NODE_USE_ENV_PROXY=1 과 함께 실행하세요. TLS 검증은 끄지 않습니다.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* 아래에서 전역 설치를 찾아봄 */ }
  try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); } catch (e) { /* 없음 */ }
  console.error('playwright가 필요해요: npm install --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const slug = args[0] && !args[0].startsWith('--') ? args[0].replace(/\/+$/, '') : null;
if (!slug || !fs.existsSync(path.join(ROOT, slug, 'index.html'))) {
  const list = fs.readdirSync(ROOT).filter((d) => fs.existsSync(path.join(ROOT, d, 'index.html')));
  console.error(`쓰는 법: node tools/render-video.cjs <폴더> [옵션]\n있는 폴더: ${list.join(', ')}`);
  process.exit(1);
}
const FPS = +opt('fps', 30);
const CRF = String(opt('crf', 20));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const pad = (n, w = 2) => String(n).padStart(w, '0');
const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};
const metaEsc = (s) => String(s).replace(/([=;#\\\n])/g, '\\$1');

(async () => {
  const { chromium } = loadPlaywright();
  const launch = {};
  if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('페이지 오류:', e.message));

  const cache = new Map();
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
    const url = route.request().url();
    try {
      if (!cache.has(url)) {
        const res = await fetch(url, { headers: { 'user-agent': route.request().headers()['user-agent'] || '' } });
        cache.set(url, { status: res.status, type: res.headers.get('content-type'), body: Buffer.from(await res.arrayBuffer()) });
      }
      const c = cache.get(url);
      await route.fulfill({ status: c.status, headers: { 'content-type': c.type || 'application/octet-stream', 'access-control-allow-origin': '*' }, body: c.body });
    } catch (e) {
      console.warn('글꼴을 받지 못해 기본 글꼴로 그립니다:', url);
      await route.abort();
    }
  });

  await page.goto('file://' + path.join(ROOT, slug, 'index.html') + '#export');
  try { await page.waitForFunction(() => window.EN_EXPORT, null, { timeout: 20000 }); }
  catch (e) { console.error(`${slug}/index.html#export 에 window.EN_EXPORT가 없어요. 위 주석의 약속을 확인하세요.`); await browser.close(); process.exit(1); }
  await page.evaluate(() => window.EN_EXPORT.ready());
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const d = window.EN_EXPORT;
    return { title: d.title || document.title, duration: d.duration, chapters: d.chapters || [], captions: d.captions || [] };
  });
  const grab = (t, q) => page.evaluate(([t, fps, q]) => window.EN_EXPORT.frame(t, fps, q), [t, FPS, q]);

  const srtOf = (from, to) => info.captions
    .filter((c) => c.end > from && c.start < to)
    .map((c, i) => `${i + 1}\n${srtTime(Math.max(0, c.start - from))} --> ${srtTime(Math.min(to, c.end) - from)}\n${c.text.replace(/\*\*/g, '')}\n`)
    .join('\n');

  // 자막 원고만
  if (args.includes('--srt')) {
    const out = path.join(ROOT, slug, 'video', slug + '.srt');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, srtOf(0, info.duration));
    console.log('저장:', path.relative(ROOT, out));
    await browser.close();
    return;
  }

  // 몇 장면만 그림으로
  if (opt('frames')) {
    const dir = path.resolve(ROOT, opt('dir', path.join('frames', slug)));
    fs.mkdirSync(dir, { recursive: true });
    for (const t of opt('frames').split(',').map(Number)) {
      const data = await grab(t, 0.9);
      fs.writeFileSync(path.join(dir, `f_${t.toFixed(1).padStart(6, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
    }
    console.log('저장:', path.relative(ROOT, dir));
    await browser.close();
    return;
  }

  // 카드 미리보기 그림 (1280×720)
  if (opt('poster')) {
    const t = +opt('poster');
    const data = await page.evaluate(async ([t, fps]) => {
      const img = new Image();
      img.src = window.EN_EXPORT.frame(t, fps, 0.95);
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, 1280, 720);
      return c.toDataURL('image/jpeg', 0.86);
    }, [t, FPS]);
    const out = path.join(ROOT, slug, 'docs', 'poster.jpg');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
    console.log('저장:', path.relative(ROOT, out));
    await browser.close();
    return;
  }

  // MP4
  const OUT = path.resolve(ROOT, opt('out', path.join(slug, 'video', slug + '.mp4')));
  const from = Math.max(0, +opt('from', 0));
  const to = Math.min(+opt('to', info.duration), info.duration);
  const frames = Math.round((to - from) * FPS);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  console.log(`${info.title}: 길이 ${info.duration}초, ${from}~${to}초 구간을 ${FPS}fps로 ${frames}프레임 렌더링합니다.`);

  // 장(chapter) 정보를 MP4 메타데이터로
  const meta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'en-render-')), 'chapters.txt');
  let txt = `;FFMETADATA1\ntitle=${metaEsc(info.title)}\nlanguage=kor\n`;
  info.chapters.forEach((c, i) => {
    const end = i + 1 < info.chapters.length ? info.chapters[i + 1].start : info.duration;
    const s = Math.max(c.start, from) - from, e = Math.min(end, to) - from;
    if (e > s) txt += `\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(s * 1000)}\nEND=${Math.round(e * 1000)}\ntitle=${metaEsc(c.title)}\n`;
  });
  fs.writeFileSync(meta, txt);

  const ff = spawn(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', meta, '-map_metadata', '1', '-map_chapters', '1',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-tune', 'animation',
    '-movflags', '+faststart', OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => {
    ff.on('error', (e) => rej(new Error('ffmpeg를 실행하지 못했어요: ' + e.message)));
    ff.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg 종료 코드 ' + code))));
  });

  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const T = from + f / FPS;
    const buf = Buffer.from((await grab(T, 0.95)).split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % (FPS * 10) === 0) {
      const el = (Date.now() - t0) / 1000, eta = f ? (el / f) * (frames - f) : 0;
      console.log(`  ${pad(Math.floor(T / 60))}:${pad(Math.floor(T % 60))}  ${((f / frames) * 100).toFixed(1)}%  남은 시간 약 ${Math.round(eta)}초`);
    }
  }
  ff.stdin.end();
  await ffDone;
  fs.rmSync(path.dirname(meta), { recursive: true, force: true });

  // 자막 원고(.srt) — 유튜브 등에 올릴 때 자막 파일로
  fs.writeFileSync(OUT.replace(/\.mp4$/, '.srt'), srtOf(from, to));

  await browser.close();
  const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
  console.log(`완료: ${path.relative(ROOT, OUT)} (${mb} MB, ${Math.round((Date.now() - t0) / 1000)}초 걸림)`);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
