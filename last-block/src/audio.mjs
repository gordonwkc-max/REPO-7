/* The Last Block — procedural soundtrack, 12 s, mono 44.1 kHz.
   Everything is synthesised from noise and sine partials; no samples. */
import fs from 'fs';
import { cartX, DUR } from './scene.mjs';

const SR = 44100, N = Math.round(DUR * SR);
const buf = new Float64Array(N);

let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };

const env = (t, a, d, s = 1) => {          // attack / decay envelope
  if (t < a) return t / a;
  if (t < a + d) return 1 - (t - a) / d * (1 - s);
  return s;
};
const add = (i, v) => { if (i >= 0 && i < N) buf[i] += v; };

/* ---- wind bed: two lowpassed noise streams, slowly breathing */
for (const [cut, amp, rate] of [[0.0009, 0.055, 0.11], [0.004, 0.030, 0.061]]) {
  let y = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    y += cut * (rnd() - y);
    const lfo = 0.65 + 0.35 * Math.sin(t * rate * 6.283 + cut * 900);
    add(i, y * amp * lfo * 3.2);
  }
}

/* ---- low drone */
for (const [f, amp] of [[55, 0.030], [55.6, 0.016], [82.5, 0.012], [110, 0.007]]) {
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    add(i, Math.sin(6.283 * f * t + Math.sin(t * 0.7) * 0.6) * amp * (0.7 + 0.3 * Math.sin(t * 1.1)));
  }
}

/* ---- the cart: rumble that follows its real speed */
{
  const dt = 0.004;
  let y = 0, y2 = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const v = Math.abs(cartX(t + dt) - cartX(t - dt)) / (2 * dt);   // units / s
    const sp = Math.min(1, v / 1.6);
    y += 0.02 * (rnd() - y);          // low rumble
    y2 += 0.14 * (rnd() - y2);        // gravel
    const wob = 0.75 + 0.25 * Math.sin(t * 6.283 * 5.5 * (0.7 + sp));
    add(i, (y * 1.5 + y2 * 0.16) * sp * wob * 0.9);
  }
}

/* ---- plank drop: heavy wooden thunk at 4.86 */
function thunk(t0, f0, amp, dec, noise) {
  const i0 = Math.round(t0 * SR);
  let lp = 0;
  for (let k = 0; k < SR * 1.2; k++) {
    const t = k / SR;
    const e = Math.exp(-t / dec);
    const body = Math.sin(6.283 * f0 * t * (1 - 0.25 * t)) * e * amp;
    lp += 0.28 * (rnd() - lp);
    const click = lp * Math.exp(-t / (dec * 0.22)) * noise;
    add(i0 + k, body + click);
  }
}
thunk(4.86, 96, 0.55, 0.16, 0.5);     // the block seating
thunk(5.06, 250, 0.30, 0.055, 0.6);   // tap one
thunk(5.18, 235, 0.26, 0.050, 0.6);   // tap two

/* ---- the block takes the weight: a low groan as each wheel rolls on */
function groan(t0, dur, f0, f1, amp) {
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let k = 0; k < SR * dur; k++) {
    const u = k / (SR * dur);
    const f = f0 + (f1 - f0) * u;
    ph += 6.283 * f / SR;
    const e = Math.sin(Math.PI * u) ** 1.6;
    add(i0 + k, (Math.sin(ph) * 0.6 + Math.sin(ph * 2.01) * 0.25 + Math.sin(ph * 3.03) * 0.1) * amp * e);
  }
}
groan(5.55, 1.5, 88, 104, 0.20);
groan(6.95, 1.3, 92, 76, 0.15);

/* ---- a warm bell when the cart is safely across (6.3) */
function bell(t0, f, amp) {
  const i0 = Math.round(t0 * SR);
  for (let k = 0; k < SR * 2.6; k++) {
    const t = k / SR;
    const e = Math.exp(-t / 0.85);
    add(i0 + k, (Math.sin(6.283 * f * t) * 0.6 + Math.sin(6.283 * f * 2.76 * t) * 0.18 + Math.sin(6.283 * f * 5.4 * t) * 0.07) * amp * e);
  }
}
bell(6.28, 523.25, 0.085);

/* ---- master: gentle low shelf, fades, soft clip */
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.6) * Math.min(1, Math.max(0, (DUR - 0.15 - t) / 0.75));
  buf[i] = Math.tanh(buf[i] * 1.15) * fade;
  peak = Math.max(peak, Math.abs(buf[i]));
}
const g = 0.86 / (peak || 1);

const out = Buffer.alloc(44 + N * 2);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 2, 4); out.write('WAVE', 8);
out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
out.write('data', 36); out.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(buf[i] * g * 32767))), 44 + i * 2);
fs.mkdirSync('build', { recursive: true });
const dst = process.argv[2] || 'build/audio.wav';
fs.writeFileSync(dst, out);
console.log('wrote', dst, (out.length / 1024 / 1024).toFixed(2), 'MB, peak', peak.toFixed(3));
