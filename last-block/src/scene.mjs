/* ---------------------------------------------------------------- scene
   The Last Block — 12 s. Every value here is a pure function of t.
----------------------------------------------------------------------- */
import { PAL, ss, bell, lerp, clamp, shadeHex } from './engine.mjs';

export const DUR = 12;
const GAP_X0 = -0.7, GAP_X1 = 0.7, GAP_W = GAP_X1 - GAP_X0;
const DECK_Z = 1.0;

const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/* ------------------------------------------------------------- camera */
const SEG = [
  { t0: 0.0, t1: 2.96, a: { az: 0.46, el: 0.300, dist: 15.5, target: [-1.60, -1.00, 0] }, b: { az: 0.37, el: 0.250, dist: 8.2, target: [-0.30, -0.26, 0] }, ease: 0.55 },
  { t0: 2.96, t1: 5.55, a: { az: -0.40, el: 0.345, dist: 4.3, target: [0.62, 0.12, 0.28] }, b: { az: -0.34, el: 0.310, dist: 3.9, target: [0.50, 0.18, 0.26] }, ease: 0.4 },
  { t0: 5.55, t1: 7.05, a: { az: -0.36, el: 0.215, dist: 4.7, target: [0.10, 0.30, 0.10] }, b: { az: -0.33, el: 0.195, dist: 4.4, target: [0.62, 0.26, 0.10] }, ease: 0.35 },
  { t0: 7.05, t1: 12.0, a: { az: 0.10, el: 0.400, dist: 8.5, target: [0.85, -0.55, 0.10] }, b: { az: 0.34, el: 0.500, dist: 19.0, target: [2.30, -1.90, 0] }, ease: 0.70 },
];
export function camAt(t) {
  if (process.env.LB_CAM) {
    const v = process.env.LB_CAM.split(',').map(Number);
    return { az: v[0], el: v[1], dist: v[2], target: [v[3], v[4], v[5]], fov: 42 };
  }
  for (const s of SEG) {
    if (t <= s.t1 || s === SEG[SEG.length - 1]) {
      const u = clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
      const e = u * u * (3 - 2 * u) * s.ease + u * (1 - s.ease);
      return { az: lerp(s.a.az, s.b.az, e), el: lerp(s.a.el, s.b.el, e), dist: lerp(s.a.dist, s.b.dist, e), target: [lerp(s.a.target[0], s.b.target[0], e), lerp(s.a.target[1], s.b.target[1], e), lerp(s.a.target[2], s.b.target[2], e)], fov: 42 };
    }
  }
}

/* ------------------------------------------------------------- timing */
export const BEAT = {
  runStart: 2.66, runEnd: 3.42,
  kneel: 3.42, reach: 4.02, seat: 4.86, tap1: 5.06, tap2: 5.18,
  cartGo: 5.34, wheelBlock: 5.62, chime: 6.30,
  stand: 7.30, wipe: 9.05,
};
const STOP_X = -1.36, GO_X = 6.1;
export function cartX(t) {
  const tStop = 2.58;
  if (t < tStop) {                       // rolls up and brakes to a stop at the hole
    const u = clamp(t / tStop, 0, 1);
    const e = 1 - (1 - u) * (1 - u) * (1 - u);   // ease out
    return lerp(-8.6, STOP_X, e);
  }
  if (t < BEAT.cartGo) {                 // waiting, impatient little shuffles
    const k = ss(t, tStop, tStop + 0.45);
    return STOP_X - 0.015 * k * (1 - Math.cos((t - tStop) * 7.5)) * 0.5;
  }
  const u = clamp((t - BEAT.cartGo) / (DUR - BEAT.cartGo), 0, 1);
  const e = u * u * (3 - 2 * u) * 0.25 + u * 0.75;      // quick ramp then cruise
  return lerp(STOP_X, GO_X, e);
}

function builderPose(t) {
  const p = { x: 3.45, y: 0, z: 0.02, yaw: -Math.PI / 2, lean: 0, head: 0, hipH: 0.60, legL: 0, legR: 0, armL: 0.10, armR: 0.10, kneeL: 0, kneeR: 0, mallet: 0 };
  if (t < BEAT.runStart) {           // standing with the plank on his shoulder
    p.x = 3.45; p.yaw = -Math.PI / 2 + 0.16; p.lean = -0.03;
    p.head = 0.08 * Math.sin(t * 1.7);
    p.armL = -0.55; p.armR = -0.15;
    return p;
  }
  if (t < BEAT.runEnd) {             // the run
    const u = ss(t, BEAT.runStart, BEAT.runEnd);
    p.x = lerp(3.45, 0.92, u);
    const ph = (t - BEAT.runStart) * 7.4;
    p.y = Math.abs(Math.sin(ph)) * 0.055;
    p.legL = Math.sin(ph) * 0.85; p.legR = -Math.sin(ph) * 0.85;
    p.kneeL = Math.max(0, Math.sin(ph + 1.2)) * 0.7; p.kneeR = Math.max(0, -Math.sin(ph + 1.2)) * 0.7;
    p.armL = -Math.sin(ph) * 0.55; p.armR = Math.sin(ph) * 0.35;
    p.lean = 0.12; p.hipH = 0.60 - Math.abs(Math.sin(ph)) * 0.03;
    p.z = lerp(0.02, 0.90, ss(t, 2.55, 3.30));
    p.yaw = -Math.PI / 2 + 0.10 * ss(t, 2.55, 3.30);
    return p;
  }
  const kneel = ss(t, 3.30, 3.72);
  if (kneel > 0) p.yaw = lerp(-Math.PI / 2 + 0.10, -1.22, kneel);
  p.z = 0.90;
  p.x = lerp(0.92, 0.80, kneel);
  p.hipH = lerp(0.60, 0.42, kneel);
  p.yaw = -Math.PI / 2;
  p.legR = lerp(0.1, -0.50, kneel);       // shin folded back on the deck
  p.kneeR = lerp(0, 1.05, kneel);
  p.legL = lerp(0.1, 1.15, kneel); p.kneeL = lerp(0, 1.0, kneel);
  p.lean = lerp(0.05, 0.42, kneel);
  p.armL = lerp(0.1, 0.95, kneel); p.armR = lerp(0.1, 0.95, kneel);
  // hands on the plank while it goes down
  const drop = ss(t, BEAT.reach, BEAT.seat);
  p.armL = lerp(p.armL, 1.45, drop); p.armR = lerp(p.armR, 1.40, drop);
  p.lean = lerp(p.lean, 0.95, drop);
  // two mallet taps
  const t1 = bell(t, 4.92, 5.02), t2 = bell(t, 5.05, 5.15);
  p.mallet = Math.max(t1, t2);
  p.armR = lerp(p.armR, -0.7, p.mallet * 0.9);
  // scramble back as the cart arrives
  const back = ss(t, 5.16, 5.48);
  p.x = lerp(p.x, 1.55, back);
  p.hipH = lerp(p.hipH, 0.40, back);
  p.lean = lerp(p.lean, 0.10, back);
  p.armL = lerp(p.armL, -0.5, back); p.armR = lerp(p.armR, -0.35, back);
  p.yaw = lerp(-1.22, -1.05, back);
  // brace, then relief
  const stand = ss(t, BEAT.stand, BEAT.stand + 0.85);
  p.hipH = lerp(p.hipH, 0.60, stand);
  p.lean = lerp(p.lean, -0.02, stand);
  p.legL = lerp(p.legL, 0.05, stand); p.legR = lerp(p.legR, -0.05, stand);
  p.kneeL = lerp(p.kneeL, 0, stand); p.kneeR = lerp(p.kneeR, 0, stand);
  const wipe = bell(t, BEAT.wipe, BEAT.wipe + 1.15);
  p.armR = lerp(p.armR, -2.5, wipe * 0.85); p.head = 0.12 * wipe;
  if (t > 6.0) p.head += 0.16 * Math.sin((t - 6.0) * 0.7);
  return p;
}

/* --------------------------------------------------------------- draw */
export function build(t, R) {
  const cartXv = cartX(t);
  const pose = builderPose(t);
  const plankSeated = ss(t, BEAT.reach, BEAT.seat);
  const flash = Math.max(bell(t, 4.84, 5.16) * 0.95,
    bell(t, 5.62, 5.98) * 0.75,
    ss(t, 5.25, 5.62) * (1 - ss(t, 6.6, 7.8)) * 0.35);

  const only = process.env.LB_ONLY;
  if (only !== 'builder') { ground(R, t); ravine(R, t); bridge(R, t, flash); }
  if (only !== 'builder' && cartXv > -13.5 && cartXv < 13.5) cart(R, t, cartXv);
  builder(R, t, pose, plankSeated);
  plank(R, t, pose, plankSeated, flash);
  dust(R, t);
  return;
}

/* ---------------------------------------------------------------- world */
function ground(R, t) {
  const rockCols = ['#3b414b', '#434a55', '#4b525d', '#39404a', '#525a66', '#454c57'];
  for (const s of [-1, 1]) {
    const outer = s * 16, inner = s * 5.5;
    const x0 = Math.min(outer, inner), x1 = Math.max(outer, inner);
    // solid mass
    R.box([x0 - (s < 0 ? 0.4 : 0), -10.6, -4.6], [x1 + (s > 0 ? 0.4 : 0), -7.0, 4.6], '#1c2027', {});
    R.box([x0 - (s < 0 ? 0.4 : 0), -7.0, -4.6], [x1 + (s > 0 ? 0.4 : 0), -3.8, 4.6], '#272c34', {});
    R.box([x0 - (s < 0 ? 0.4 : 0), -3.8, -4.6], [x1 + (s > 0 ? 0.4 : 0), -0.42, 4.6], '#343a44', {});
    // rough rock face: staggered blocks pushed toward the chasm
    const rows = 8, cols = 9;
    for (let r = 0; r < rows; r++) {
      const y0 = -10.4 + r * 1.24, y1 = y0 + 1.20;
      for (let c = 0; c < cols; c++) {
        const z0 = -4.05 + c * 0.98 + (r % 2 ? 0.34 : 0), z1 = z0 + 0.94;
        const h = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
        const k = h - Math.floor(h);
        const prot = 0.02 + k * 0.34;
        const col = shadeHex(rockCols[Math.floor(k * rockCols.length) % rockCols.length], 0.30 + r * 0.098);
        const bx0 = s < 0 ? inner - prot : inner - 0.06;
        const bx1 = s < 0 ? inner + 0.06 : inner + prot;
        R.box([bx0, y0, z0], [bx1, y1, z1], col, {});
        // occasional moss on the upper ones
        if (r >= 6 && k > 0.72) R.box([bx0, y1 - 0.10, z0], [bx1, y1, z1], '#35462f', {});
      }
    }
    // soil cap + grass shelf
    R.box([x0, -0.42, -4.4], [x1, 0.0, 4.4], '#463a2c', { sortBias: 0.5 });
    R.box([x0, -0.10, -4.4], [x1, 0.02, 4.4], PAL.mossD, { sortBias: 0.3 });
    R.box([s < 0 ? x0 : inner - 0.30, 0.02, -4.4], [s < 0 ? inner + 0.30 : x1, 0.085, 4.4], PAL.moss, { sortBias: 0.2 });
    // road
    const rx0 = s < 0 ? x0 : inner + 0.1, rx1 = s < 0 ? inner - 0.1 : x1;
    R.box([rx0, 0.085, -1.25], [rx1, 0.10, 1.25], '#6a5942', { sortBias: 0.1 });
    R.box([s < 0 ? inner - 0.02 : inner - 0.14, 0.085, -1.3], [s < 0 ? inner + 0.14 : inner + 0.02, 0.115, 1.3], '#7d6a4f', {});
    // grass tufts
    for (let i = 0; i < 16; i++) {
      const bx = inner + s * (0.9 + ((i * 37) % 72) / 10), bz = ((i * 53) % 82) / 10 - 4.1;
      if (Math.abs(bz) < 1.45) continue;
      R.box([bx - 0.07, 0.085, bz - 0.07], [bx + 0.07, 0.22 + (i % 3) * 0.07, bz + 0.07], i % 3 ? PAL.mossL : PAL.mossD, {});
    }
    // boulders
    for (let i = 0; i < 5; i++) {
      const bx = inner + s * (1.4 + i * 1.9), bz = (i % 2 ? 2.2 : -2.5) + Math.sin(i * 2.1) * 0.7;
      R.boxC(bx, 0.22, bz, 0.46 + (i % 3) * 0.18, 0.42, 0.42 + (i % 2) * 0.2, i % 2 ? PAL.rock : PAL.rockL, {});
    }
    if (s > 0) {
      const tx = 9.4, tz = -2.9;
      R.box([tx, 0, tz], [tx + 0.22, 2.3, tz + 0.22], '#3a2c22', {});
      R.box([tx - 0.75, 1.75, tz], [tx + 0.1, 1.9, tz + 0.19], '#3a2c22', {});
      R.box([tx + 0.1, 2.05, tz], [tx + 0.8, 2.2, tz + 0.19], '#3a2c22', {});
      R.box([tx - 0.05, 2.3, tz], [tx + 0.27, 2.75, tz + 0.16], '#33271e', {});
    } else {
      R.box([-8.9, 0.0, -3.6], [-6.8, 1.95, -1.9], '#4a3a2a', {});
      R.box([-9.2, 1.95, -3.9], [-6.5, 2.2, -1.6], '#5a4632', {});
      R.box([-8.2, 0.75, -1.95], [-7.6, 1.4, -1.86], '#2c2119', {});
      R.box([-8.14, 0.9, -1.88], [-7.66, 1.3, -1.85], '#ffb45c', { emit: 0.85 });
      R.glow([-7.9, 1.1, -1.7], 1.7, '#ffab4a', 0.45);
    }
  }
}

function ravine(R, t) {
  // rock spires rising out of the dark
  const spires = [[-2.4, -6.4, 0.35], [1.6, -5.4, 0.5], [3.9, -7.0, 0.3], [-4.6, -5.0, 0.45], [6.6, -6.0, 0.4]];
  for (const [x, y, w] of spires) {
    R.box([x - w, y - 8, -w], [x + w, y, w], '#1f2733', { fog: 0.5 });
    R.box([x - w * 0.6, y, -w * 0.6], [x + w * 0.6, y + 0.35, w * 0.6], '#2c3644', { fog: 0.5 });
  }
  R.box([-7.5, -34, -6.6], [7.5, -0.04, -4.9], '#0d1420', { noFog: true });
  R.glow([0.6, -7.5, -2.0], 6.0, '#3f5f80', 0.06);
}

function bridge(R, t, flash) {
  const y0 = -0.22, y1 = 0;
  // stringers
  R.box([-5.5, -0.46, 0.52], [5.5, -0.22, 0.74], PAL.woodD, {});
  R.box([-5.5, -0.46, -0.74], [5.5, -0.22, -0.52], PAL.woodD, {});
  R.box([-5.5, -0.40, -0.10], [5.5, -0.24, 0.10], PAL.woodD, {});
  // deck planks
  for (let i = -5; i <= 5; i++) {
    if (i === 0) continue;
    const x = i, tone = (i % 2 === 0) ? PAL.wood : PAL.woodL;
    const xa = (i === 1) ? GAP_X1 : x - 0.5, xb = (i === -1) ? GAP_X0 : x + 0.5;
    R.box([xa, y0, -DECK_Z], [xb, y1, DECK_Z], tone, {});
    // plank seam
    R.box([xa, y1 - 0.01, -DECK_Z], [xa + 0.04, y1 + 0.004, DECK_Z], PAL.woodD, {});
  }
  // posts + rope rails (far side full, near side just a top rope)
  for (let i = -5; i <= 5; i++) {
    const x = i;
    for (const s of [-1, 1]) {
      if (s > 0 && Math.abs(x) < 1.6) continue;
      R.box([x - 0.07, y1, s * 0.95 - 0.07], [x + 0.07, y1 + 0.92, s * 0.95 + 0.07], PAL.woodD, {});
      R.box([x - 0.09, y1 + 0.92, s * 0.95 - 0.09], [x + 0.09, y1 + 0.98, s * 0.95 + 0.09], PAL.woodHl, {});
    }
  }
  for (const s of [-1, 1]) {
    R.box([-5.4, y1 + 0.86, s * 0.95 - 0.035], [5.4, y1 + 0.93, s * 0.95 + 0.035], PAL.rope, {});
    if (s < 0) R.box([-5.4, y1 + 0.46, s * 0.95 - 0.028], [5.4, y1 + 0.52, s * 0.95 + 0.028], PAL.rope, {});
  }
  // the hole: a dark lip so the gap reads even at grazing angles
  R.box([GAP_X0 - 0.04, -0.30, -0.94], [GAP_X0, 0.005, 0.94], PAL.woodD, {});
  R.box([GAP_X1, -0.30, -0.94], [GAP_X1 + 0.04, 0.005, 0.94], PAL.woodD, {});
}

function cart(R, t, x) {
  const bob = Math.sin(t * 8.6) * 0.012;
  const wheelRot = -x / 0.32;
  const cz = 0;
  // wheels
  for (const ax of [-0.5, 0.52]) {
    for (const s of [-1, 1]) {
      const z = s * 0.52;
      R.disc(x + ax, 0.32, z - 0.075, 0.32, 0.15, PAL.woodD, { rot: wheelRot, rim: PAL.wood });
      R.disc(x + ax, 0.32, z + 0.075, 0.30, 0.02, PAL.iron, { rot: wheelRot, rim: PAL.ironL, seg: 10 });
      // spokes: two crossed bars in the wheel plane
      for (let k = 0; k < 2; k++) {
        const a = wheelRot + k * Math.PI / 2;
        R.obox([x + ax, 0.32, z + 0.088], [0.46, 0.055, 0.02], [Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0, 0, 1], PAL.iron, {});
      }
      R.obox([x + ax, 0.32, z + 0.095], [0.10, 0.10, 0.03], [1, 0, 0], [0, 1, 0], [0, 0, 1], PAL.brass, {});
    }
  }
  // axle
  R.box([x - 0.56, 0.28, -0.56], [x + 0.58, 0.36, 0.56], PAL.iron, {});
  // bed
  R.box([x - 0.78, 0.60 + bob, -0.62], [x + 0.78, 0.72 + bob, 0.62], PAL.cart, {});
  R.box([x - 0.78, 0.72 + bob, -0.62], [x - 0.66, 1.02 + bob, 0.62], PAL.cartD, {});
  R.box([x + 0.66, 0.72 + bob, -0.62], [x + 0.78, 1.02 + bob, 0.62], PAL.cart, {});
  R.box([x - 0.78, 0.72 + bob, 0.50], [x + 0.78, 1.06 + bob, 0.62], PAL.cart, {});
  R.box([x - 0.78, 0.72 + bob, -0.62], [x + 0.78, 1.06 + bob, -0.50], PAL.cartD, {});
  R.box([x - 0.72, 0.70 + bob, -0.56], [x + 0.72, 0.74 + bob, 0.56], '#2d2318', { skip: ['0,1,0'] });
  // cargo
  R.box([x - 0.55, 0.74 + bob, -0.35], [x - 0.05, 1.12 + bob, 0.15], PAL.woodL, {});
  R.box([x + 0.02, 0.74 + bob, -0.30], [x + 0.45, 1.02 + bob, 0.12], PAL.wood, {});
  R.box([x - 0.30, 1.12 + bob, -0.20], [x + 0.05, 1.30 + bob, 0.12], PAL.woodD, {});
  // lantern pole
  R.box([x + 0.62, 0.72 + bob, -0.05], [x + 0.72, 2.12 + bob, 0.05], PAL.iron, {});
  R.box([x + 0.52, 2.06 + bob, -0.045], [x + 0.86, 2.14 + bob, 0.045], PAL.iron, {});
  // swinging lantern
  const sw = Math.sin(t * 2.2) * 0.10 + Math.sin(t * 5.1) * 0.02;
  const lx = x + 0.46 + sw * 0.5, ly = 1.86 + bob - Math.abs(sw) * 0.12;
  R.box([lx - 0.02, ly + 0.12, -0.02], [lx + 0.02, 2.06 + bob, 0.02], PAL.iron, {});
  R.box([lx - 0.11, ly - 0.14, -0.11], [lx + 0.11, ly + 0.13, 0.11], PAL.amber, { emit: 0.85 });
  R.box([lx - 0.13, ly + 0.13, -0.13], [lx + 0.13, ly + 0.18, 0.13], PAL.iron, {});
  R.box([lx - 0.13, ly - 0.19, -0.13], [lx + 0.13, ly - 0.14, 0.13], PAL.iron, {});
  R.glow([lx, ly, 0], 1.55, '#ffb457', 0.95);
  R.glow([lx, ly, 0], 0.55, '#ffe9c0', 0.75);
  // light spill on the deck
  R.glow([lx, 0.02, 0.2], 1.1, '#ff9c3c', 0.28);
  // handle
  R.box([x - 0.92, 0.62 + bob, -0.06], [x - 0.78, 0.70 + bob, 0.06], PAL.wood, {});
}

function limb(R, base, dir, len, w, th, color, right, opts) {
  const d = nrm(dir);
  let ax = right;
  if (Math.abs(d[0] * ax[0] + d[2] * ax[2]) > 0.999) ax = [1, 0, 0];
  const az = nrm(crs(ax, d));
  const axn = nrm(crs(d, az));
  const c = [base[0] + d[0] * len / 2, base[1] + d[1] * len / 2, base[2] + d[2] * len / 2];
  R.obox(c, [w, len, th], axn, d, az, color, opts || {});
  return [base[0] + d[0] * len, base[1] + d[1] * len, base[2] + d[2] * len];
}

function builder(R, t, p, seated) {
  const f0 = R.faces.length;
  const yaw = p.yaw;
  const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = [0, 1, 0];
  const hipY = p.y + p.hipH;
  const torsoLen = 0.40, headR = 0.15;
  const lean = p.lean;
  // torso axis leans forward
  const tdir = nrm([fwd[0] * Math.sin(lean) + up[0] * Math.cos(lean), fwd[1] * Math.sin(lean) + Math.cos(lean), fwd[2] * Math.sin(lean) + Math.cos(lean) * 0 + up[2] * 0]);
  const tn = nrm([fwd[0] * Math.sin(lean), Math.cos(lean), fwd[2] * Math.sin(lean)]);
  const hip = [p.x, hipY, p.z];
  const neck = [hip[0] + tn[0] * torsoLen, hip[1] + tn[1] * torsoLen, hip[2] + tn[2] * torsoLen];
  // legs
  const legDir = (swing, knee) => {
    const a = sw - 0.04;
    const b = a + knee;
    return { a, b };
  };
  for (const side of [-1, 1]) {
    const swing = side < 0 ? p.legL : p.legR;
    const knee = side < 0 ? p.kneeL : p.kneeR;
    const hipJ = [hip[0] + right[0] * side * 0.10, hip[1], hip[2] + right[2] * side * 0.10];
    const a = swing;
    const thighLen = 0.30, shinLen = 0.30;
    const d1 = nrm([fwd[0] * Math.sin(a), -Math.cos(a), fwd[2] * Math.sin(a)]);
    const kneeJ = limb(R, hipJ, d1, thighLen, 0.13, 0.14, PAL.coat, right);
    const a2 = a - knee;
    const d2 = nrm([fwd[0] * Math.sin(a2), -Math.cos(a2), fwd[2] * Math.sin(a2)]);
    const footJ = limb(R, kneeJ, d2, shinLen, 0.12, 0.13, PAL.coat, right);
    R.obox([footJ[0] + fwd[0] * 0.03, footJ[1] + 0.03, footJ[2] + fwd[2] * 0.03], [0.15, 0.09, 0.22], right, up, fwd, '#3a2b22', {});
  }
  // torso
  limb(R, hip, tn, torsoLen, 0.30, 0.20, PAL.coat, right);
  R.obox([hip[0] + tn[0] * 0.14, hip[1] + tn[1] * 0.14, hip[2] + tn[2] * 0.14], [0.32, 0.10, 0.22], right, up, fwd, '#2b2118', {});
  // satchel
  R.box([hip[0] + tn[0] * 0.2 - 0.11, hip[1] + tn[1] * 0.2 - 0.06, hip[2] - 0.13], [hip[0] + tn[0] * 0.2 + 0.05, hip[1] + tn[1] * 0.2 + 0.12, hip[2] - 0.03], PAL.woodD, {});
  // head (drawn in the body frame so the face always looks where he looks)
  const hx = neck[0] + tn[0] * 0.16, hy = neck[1] + tn[1] * 0.16, hz = neck[2] + tn[2] * 0.16;
  const headAx = nrm([fwd[0], 0, fwd[2]]);
  R.obox([hx, hy, hz], [0.25, 0.24, 0.23], right, up, headAx, PAL.skin, {});
  // helmet
  R.obox([hx, hy + 0.145, hz], [0.28, 0.10, 0.27], right, up, headAx, PAL.helmet, {});
  R.obox([hx + headAx[0] * 0.10, hy + 0.115, hz + headAx[2] * 0.10], [0.30, 0.045, 0.16], right, up, headAx, PAL.helmet, {});
  R.obox([hx, hy + 0.175, hz], [0.16, 0.06, 0.16], right, up, headAx, '#c99a2e', {});
  // eyes + brow on the facing side
  for (const sd of [-1, 1]) {
    R.obox([hx + headAx[0] * 0.118 + right[0] * sd * 0.055, hy + 0.018, hz + headAx[2] * 0.118 + right[2] * sd * 0.055],
      [0.062, 0.052, 0.02], right, up, headAx, '#241c14', {});
  }
  R.obox([hx + headAx[0] * 0.118, hy + 0.075, hz + headAx[2] * 0.118], [0.20, 0.022, 0.02], right, up, headAx, '#3a2a1c', {});
  // nose + stubble
  R.obox([hx + headAx[0] * 0.135, hy - 0.03, hz + headAx[2] * 0.135], [0.05, 0.06, 0.05], right, up, headAx, '#c07e55', {});
  R.obox([hx + headAx[0] * 0.118, hy - 0.085, hz + headAx[2] * 0.118], [0.20, 0.07, 0.02], right, up, headAx, '#8d6448', {});
  // arms
  const shoulder = [neck[0] - tn[0] * 0.05, neck[1] - tn[1] * 0.05, neck[2] - tn[2] * 0.05];
  for (const side of [-1, 1]) {
    const sw = side < 0 ? p.armL : p.armR;
    const bend = 0.42 - 0.28 * Math.max(0, sw);
    const sj = [shoulder[0] + right[0] * side * 0.155, shoulder[1], shoulder[2] + right[2] * side * 0.155];
    const d1 = nrm([fwd[0] * Math.sin(sw), -Math.cos(sw), fwd[2] * Math.sin(sw)]);
    const el = limb(R, sj, d1, 0.23, 0.105, 0.115, PAL.coatL, right);
    const a2 = sw + bend;
    const d2 = nrm([fwd[0] * Math.sin(a2), -Math.cos(a2), fwd[2] * Math.sin(a2)]);
    const hand = limb(R, el, d2, 0.21, 0.095, 0.10, PAL.coatL, right);
    R.obox([hand[0], hand[1], hand[2]], [0.09, 0.10, 0.09], right, up, fwd, PAL.skin, {});
    if (side > 0 && p.mallet > 0.02) {
      const m = p.mallet;
      R.obox([hand[0] + fwd[0] * 0.09, hand[1] + 0.08, hand[2] + fwd[2] * 0.09], [0.035, 0.24, 0.035], right, fwd, up, PAL.wood, {});
      R.obox([hand[0] + fwd[0] * 0.10, hand[1] + 0.20, hand[2] + fwd[2] * 0.10], [0.11, 0.095, 0.11], right, fwd, up, PAL.woodD, {});
      if (m > 0.55) R.glow([hand[0] + fwd[0] * 0.1, hand[1] + 0.2, hand[2] + fwd[2] * 0.1], 0.35, '#ffd8a0', 0.45 * (m - 0.55));
    }
  }
  if (process.env.LB_DBG) console.log('builder faces', R.faces.length - f0, 'pose', JSON.stringify(p));
}

/* how much of the cart's weight is sitting on the block right now */
export function loadState(t) {
  const x = cartX(t);
  const bump = (wx) => clamp(1 - Math.abs(wx) / 0.80, 0, 1);
  const rear = bump(x - 0.50), front = bump(x + 0.52);
  return { rear, front, any: Math.max(rear, front) };
}

function plank(R, t, p, seated, flash) {
  // in his hands while he runs, set down on the deck lip, then shoved across the slot
  const L = loadState(t);
  const lay = ss(t, 3.42, 4.06);
  const slide = ss(t, 4.06, BEAT.seat);
  const xc = lerp(p.x + 0.15, 0, slide);
  const upY = p.y + p.hipH + 0.34;
  const yTop = lerp(lerp(upY, 0.135, lay), 0.0, slide);
  const glow = flash;
  // it visibly takes the cart's weight: the span bends, the ends stay put
  const col = glow > 0.25 ? PAL.woodHl : PAL.woodL;
  R.box([xc - GAP_W / 2, yTop - 0.135, -DECK_Z], [xc + GAP_W / 2, yTop, DECK_Z], col, { emit: glow * 0.5 });
  for (let i = -1; i <= 1; i++) R.box([xc + i * 0.42 - 0.016, yTop, -0.92], [xc + i * 0.42 + 0.016, yTop + 0.008, 0.92], '#8a6540', { emit: glow * 0.4 });
  if (glow > 0.02) R.glow([xc, yTop + 0.2, 0], 0.95, '#ffd9a0', 0.38 * glow);
  // ---- the reason the crossing works: the weight runs out through both ends
  if (L.any > 0.03 && slide > 0.96) {
    const x = cartX(t);
    for (const wx of [x - 0.50, x + 0.52]) {
      const w = clamp(1 - Math.abs(wx) / 0.80, 0, 1);
      if (w <= 0.03) continue;
      const a0 = Math.min(xc - GAP_W / 2, Math.max(GAP_X0, wx)), a1 = Math.max(xc + GAP_W / 2, Math.min(GAP_X1, wx));
      if (a1 - a0 > 0.02) R.box([a0, yTop + 0.004, -0.075], [a1, yTop + 0.014, 0.075], '#ffcf8a', { emit: 0.45 * w });
    }
    for (const ex of [GAP_X0, GAP_X1]) R.glow([ex, yTop + 0.03, 0], 0.55, '#ffc978', 0.7 * L.any);
  }
}

function dust(R, t) {
  const t0 = BEAT.seat;
  const age = t - t0;
  if (age < 0 || age > 0.55) return;
  for (let i = 0; i < 10; i++) {
    const s1 = Math.sin(i * 12.9) * 0.5 + 0.5, s2 = Math.sin(i * 7.3 + 1.7) * 0.5 + 0.5;
    const a = s1 * Math.PI * 2, sp = 0.4 + s2 * 0.9;
    const x = Math.cos(a) * sp * age, z = Math.sin(a) * sp * age * 1.6;
    const y = 0.05 + (0.16 + s2 * 0.22) * age - 2.4 * age * age;
    const sz = (0.025 + s1 * 0.03) * (1 + age * 1.4);
    R.boxC(x, Math.max(0.02, y), z, sz, sz, sz, '#8d7a63', { emit: 0.15, stroke: false });
  }
}

/* ---------------------------------------------------------------- title */
export function overlay(t) {
  return (ctx, R) => {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    // vignette
    const g = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.3, W / 2, H * 0.52, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // fade in / out
    const fin = 1 - ss(t, 0.02, 0.55);
    const fout = ss(t, 11.25, 11.92);
    const black = Math.max(fin, fout);
    if (black > 0.001) { ctx.fillStyle = 'rgba(0,0,0,' + black.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    // title
    const ta = ss(t, 9.55, 10.25) * (1 - ss(t, 11.3, 11.9));
    if (ta > 0.002) {
      ctx.save();
      ctx.globalAlpha = ta;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,238,210,0.96)';
      ctx.font = '600 54px "OpenSansBold"';
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18;
      ctx.fillText('THE LAST BLOCK', W / 2, H * 0.795);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = ta * 0.7;
      ctx.fillStyle = 'rgba(255,225,180,0.9)';
      ctx.font = '500 19px "OpenSansBold"';
      ctx.fillText('one plank, one wheel, one crossing', W / 2, H * 0.845);
      ctx.restore();
    }
  };
}
