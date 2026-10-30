#!/usr/bin/env node
// Renders index.html to MP4 by stepping its timeline frame by frame in headless Chromium
// and piping each screenshot into ffmpeg. Every frame is a pure function of time, so the
// output is identical on every run regardless of machine speed.
//
//   node render.js                      -> out/fn-key-war.mp4 (1920x1080, 60fps)
//   node render.js --fps 30             -> 30fps version
//   node render.js --stills 1,4.5,9.5   -> PNG stills in out/stills/ (quick look at key moments)
//   node render.js --out my.mp4 --workers 4

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const args = {};
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args[a.slice(2)] = all[i + 1]; });
const fps = Number(args.fps || 60);
const workers = Number(args.workers || Math.max(1, Math.min(4, os.cpus().length)));
const out = path.resolve(args.out || path.join(__dirname, 'out', 'fn-key-war.mp4'));
const stills = args.stills ? args.stills.split(',').map(Number) : null;
const url = 'file://' + path.join(__dirname, 'index.html') + '?render=1';

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.evaluate(() => window.ready);
  return page;
}

// JPEG at high quality is ~3x faster to capture than PNG and indistinguishable after H.264.
async function frameAt(page, t, type = 'jpeg') {
  await page.evaluate(t => new Promise(r => { window.renderAt(t); requestAnimationFrame(() => r()); }), t);
  return page.screenshot(type === 'png' ? { type } : { type, quality: 95 });
}

(async () => {
  const browser = await chromium.launch();

  if (stills) {
    const page = await openPage(browser);
    const dir = path.join(path.dirname(out), 'stills');
    fs.mkdirSync(dir, { recursive: true });
    for (const t of stills) {
      const file = path.join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`);
      fs.writeFileSync(file, await frameAt(page, t, 'png'));
      console.log(file);
    }
    await browser.close();
    return;
  }

  const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser)));
  const duration = await pages[0].evaluate(() => window.DURATION);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const total = Math.round(duration * fps);
  const started = Date.now();
  for (let i = 0; i < total; i += workers) {
    const batch = pages.map((page, w) => i + w < total ? frameAt(page, (i + w) / fps) : null).filter(Boolean);
    for (const buf of await Promise.all(batch)) {
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    const done = Math.min(total, i + workers);
    const eta = ((Date.now() - started) / done * (total - done) / 1000).toFixed(0);
    process.stdout.write(`\rframe ${done}/${total}  (~${eta}s left)   `);
  }
  ff.stdin.end();
  const code = await new Promise(r => ff.on('close', r));
  await browser.close();
  if (code !== 0) { console.error(`\nffmpeg exited with code ${code}`); process.exit(code); }
  console.log(`\nwrote ${out}`);
})().catch(e => { console.error(e); process.exit(1); });
