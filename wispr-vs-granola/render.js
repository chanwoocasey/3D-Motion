#!/usr/bin/env node
// Renders index.html to MP4 (or PNG stills) by stepping the timeline frame by frame in
// headless Chromium. Every frame is a pure function of time, so renders are reproducible.
//
//   node render.js                     -> out/wispr-vs-granola.mp4 (1920x1080, 30fps)
//   node render.js --stills 2,6,12     -> PNG stills in out/stills/
//   node render.js --fps 60 --workers 4

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { serve } = require('./server');

const args = {};
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args[a.slice(2)] = all[i + 1]; });
const fps = Number(args.fps || 30);
const workers = Number(args.workers || Math.max(1, Math.min(4, os.cpus().length)));
const out = path.resolve(args.out || path.join(__dirname, 'out', 'wispr-vs-granola.mp4'));
const stills = args.stills ? args.stills.split(',').map(Number) : null;

(async () => {
  const server = await serve(__dirname);
  const url = `http://127.0.0.1:${server.address().port}/?render=1`;
  const browser = await chromium.launch();

  const openPage = async () => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => console.error('page error:', e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.ready);
    await page.evaluate(() => window.ready);
    return page;
  };
  const frameAt = async (page, t, type = 'jpeg') => {
    await page.evaluate(t => new Promise(r => { window.renderAt(t); requestAnimationFrame(() => r()); }), t);
    return page.screenshot(type === 'png' ? { type } : { type, quality: 95 });
  };
  const done = async () => { await browser.close(); server.close(); };

  if (stills) {
    const page = await openPage();
    const dir = path.join(path.dirname(out), 'stills');
    fs.mkdirSync(dir, { recursive: true });
    for (const t of stills) {
      const file = path.join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`);
      fs.writeFileSync(file, await frameAt(page, t, 'png'));
      console.log(file);
    }
    return done();
  }

  const pages = await Promise.all(Array.from({ length: workers }, openPage));
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
    const n = Math.min(total, i + workers);
    process.stdout.write(`\rframe ${n}/${total}  (~${((Date.now() - started) / n * (total - n) / 1000).toFixed(0)}s left)   `);
  }
  ff.stdin.end();
  const code = await new Promise(r => ff.on('close', r));
  await done();
  if (code !== 0) { console.error(`\nffmpeg exited with code ${code}`); process.exit(code); }
  console.log(`\nwrote ${out}`);
})().catch(e => { console.error(e); process.exit(1); });
