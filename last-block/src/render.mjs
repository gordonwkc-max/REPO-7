import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { makeRenderer } from './engine.mjs';
import { build, camAt, overlay, DUR } from './scene.mjs';
import fs from 'fs';

const FONT = process.env.LB_FONT || new URL('../assets/OpenSans-Bold.ttf', import.meta.url).pathname;
if (fs.existsSync(FONT)) GlobalFonts.registerFromPath(FONT, 'OpenSansBold');
else console.warn('title font not found at', FONT, '- falling back to sans-serif');

const W = 1280, H = 720, FPS = 30;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
const R = makeRenderer(W, H);

function drawAt(t) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const st = { cam: camAt(t), build: (r) => build(t, r), overlay: overlay(t) };
  R.draw(ctx, st);
  ctx.restore();
}

const mode = process.argv[2] || '--still';
if (mode === '--still') {
  const t = parseFloat(process.argv[3] || '0');
  const out = process.argv[4] || 'still.png';
  drawAt(t);
  fs.writeFileSync(out, await canvas.encode('png'));
  console.log('still', t, out);
} else if (mode === '--sheet') {
  const times = process.argv.slice(3).map(Number);
  for (const t of times) {
    drawAt(t);
    fs.mkdirSync('build', { recursive: true });
    fs.writeFileSync('build/still_' + t.toFixed(2) + '.png', await canvas.encode('png'));
  }
  console.log('sheet', times.join(','));
} else if (mode === '--frames') {
  const outDir = process.argv[3] || 'build/frames';
  fs.mkdirSync(outDir, { recursive: true });
  const fps = 30, n = Math.round(DUR * fps);
  for (let i = 0; i < n; i++) {
    drawAt(i / fps);
    fs.writeFileSync(outDir + '/f_' + String(i).padStart(4, '0') + '.png', await canvas.encode('png'));
    if (i % 60 === 0) console.log('frame', i, '/', n);
  }
  console.log('done', n, 'frames,', (n / fps).toFixed(2), 's @', fps, 'fps');
} else {
  console.log('modes: --still <t> <out.png> | --sheet <t...> | --frames <dir>');
}
