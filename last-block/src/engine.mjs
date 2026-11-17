/* ---------------------------------------------------------------- engine
   Tiny software 3D: pinhole projection, flat-shaded quads, painter sort,
   distance fog, emissive glows. No dependencies but the canvas.
----------------------------------------------------------------------- */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

export const PAL = {
  skyTop:   '#0c1122',
  skyMid:   '#1d2740',
  skyLow:   '#4a5473',
  glowSky:  '#c98a5c',
  ridgeA:   '#252c40',
  ridgeB:   '#171d2c',
  mist:     '#46516a',
  rock:     '#4b4f59',
  rockD:    '#3a3e47',
  rockL:    '#5c616c',
  moss:     '#4e6b45',
  mossD:    '#3d5738',
  mossL:    '#5f7f52',
  wood:     '#7a5535',
  woodD:    '#4e3520',
  woodL:    '#8f6742',
  woodHl:   '#c79a63',
  iron:     '#363b45',
  ironL:    '#4a505b',
  brass:    '#b0873f',
  amber:    '#ffb457',
  amberHot: '#ffe0a8',
  coat:     '#2f6f6a',
  coatL:    '#3d8d84',
  skin:     '#c98e64',
  helmet:   '#e0b23f',
  rope:     '#8a7a5c',
  cart:     '#5b4430',
  cartD:    '#3f2f21',
};

const LIGHT = norm([0.42, 0.74, 0.52]);
const SKYFILL = [24, 32, 52];

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, u) => a + (b - a) * u;
export const ss = (t, a, b) => { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
export function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * k), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * k), 0, 255);
  const b = clamp(Math.round((n & 255) * k), 0, 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
export const bell = (t, a, b) => { if (t < a || t > b) return 0; const u = (t - a) / (b - a); return Math.sin(u * Math.PI); };

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
function mix(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }

export function cameraAt(st, W, H) {
  const c = st.cam;
  const dir = [Math.sin(c.az) * Math.cos(c.el), Math.sin(c.el), Math.cos(c.az) * Math.cos(c.el)];
  const tgt = c.target;
  const eye = [tgt[0] + dir[0] * c.dist, tgt[1] + dir[1] * c.dist, tgt[2] + dir[2] * c.dist];
  const f = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const focal = (H / 2) / Math.tan((c.fov || 42) * Math.PI / 360);
  return { eye, f, r, u, focal, W, H, cx: W / 2, cy: H / 2 };
}

export function makeRenderer(W, H) {
  const R = { faces: [], glows: [], W, H, cam: null, st: null };
  R.reset = (st) => { R.faces.length = 0; R.glows.length = 0; R.st = st; R.cam = cameraAt(st, W, H); };
  R.project = (p) => {
    const e = R.cam.eye, dx = p[0] - e[0], dy = p[1] - e[1], dz = p[2] - e[2];
    const z = dx * R.cam.f[0] + dy * R.cam.f[1] + dz * R.cam.f[2];
    if (z < 0.06) return null;
    const xv = dx * R.cam.r[0] + dy * R.cam.r[1] + dz * R.cam.r[2];
    const yv = dx * R.cam.u[0] + dy * R.cam.u[1] + dz * R.cam.u[2];
    const k = R.cam.focal / z;
    return [R.cam.cx + xv * k, R.cam.cy - yv * k, z];
  };
  R.poly = (pts, color, opts) => {
    opts = opts || {};
    let zmax = 0, zsum = 0;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const s = R.project(pts[i]);
      if (!s) return;
      out.push(s[0], s[1]);
      zmax = Math.max(zmax, s[2]); zsum += s[2];
    }
    const zc = zsum / pts.length;
    let n = opts.n;
    if (!n) {
      const a = pts[0], b = pts[1], c = pts[2];
      n = norm(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]));
    }
    if (opts.cull !== false) {
      const cen = [0, 0, 0];
      for (const p of pts) { cen[0] += p[0] / pts.length; cen[1] += p[1] / pts.length; cen[2] += p[2] / pts.length; }
      const vd = [cen[0] - R.cam.eye[0], cen[1] - R.cam.eye[1], cen[2] - R.cam.eye[2]];
      if (dot(n, vd) > 0) return;
    }
    const col = opts.raw ? hex(color) : shade(color, n, zc, opts);
    R.faces.push({ p: out, z: zmax - 0.015 + (opts.sortBias || 0), c: rgb(col), s: opts.stroke === false ? null : src(col), w: opts.strokeW || 1 });
  };
  R.box = (a, b, color, opts) => {
    opts = opts || {};
    const [x0, y0, z0] = a, [x1, y1, z1] = b;
    const P = [
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, 1, 0]],
      [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, -1, 0]],
      [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1]],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
      [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]],
    ];
    for (const f of P) {
      if (opts.skip && opts.skip.includes(f[4].join(','))) continue;
      R.poly([f[0], f[1], f[2], f[3]], color, { n: f[4], ...opts });
    }
  };
  R.boxC = (cx, cy, cz, sx, sy, sz, color, opts) =>
    R.box([cx - sx / 2, cy - sy / 2, cz - sz / 2], [cx + sx / 2, cy + sy / 2, cz + sz / 2], color, opts);
  // oriented box: centre, sizes, and three orthonormal axes
  R.obox = (c, s, ax, ay, az, color, opts) => {
    const P = (sx, sy, sz) => [
      c[0] + ax[0] * sx * s[0] / 2 + ay[0] * sy * s[1] / 2 + az[0] * sz * s[2] / 2,
      c[1] + ax[1] * sx * s[0] / 2 + ay[1] * sy * s[1] / 2 + az[1] * sz * s[2] / 2,
      c[2] + ax[2] * sx * s[0] / 2 + ay[2] * sy * s[1] / 2 + az[2] * sz * s[2] / 2];
    const faces = [
      [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], ay, -1],
      [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1], ay, 1],
      [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1], az, -1],
      [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], az, 1],
      [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1], ax, -1],
      [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1], ax, 1],
    ];
    for (const f of faces) {
      const n = [f[4][0] * f[5], f[4][1] * f[5], f[4][2] * f[5]];
      R.poly([P(f[0][0], f[0][1], f[0][2]), P(f[1][0], f[1][1], f[1][2]), P(f[2][0], f[2][1], f[2][2]), P(f[3][0], f[3][1], f[3][2])], color, { n, ...opts });
    }
  };
  // disc in the XY plane extruded along Z, centred at (cx,cy,cz)
  R.disc = (cx, cy, cz, r, thick, color, opts) => {
    opts = opts || {};
    const n = opts.seg || 12, rot = opts.rot || 0;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rot + i * Math.PI * 2 / n;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    const zc = cz + thick / 2;
    R.poly(pts.map(p => [p[0], p[1], zc]), color, { n: [0, 0, 1], ...opts });
    R.poly(pts.slice().reverse().map(p => [p[0], p[1], cz - thick / 2]), opts.back || color, { n: [0, 0, -1], ...opts });
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const na = norm([(a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy, 0]);
      R.poly([[a[0], a[1], cz - thick / 2], [b[0], b[1], cz - thick / 2], [b[0], b[1], zc], [a[0], a[1], zc]],
        opts.rim || color, { n: na, ...opts });
    }
  };
  R.glow = (p, radius, color, alpha) => {
    const s = R.project(p);
    if (!s) return;
    R.glows.push({ x: s[0], y: s[1], r: Math.max(2, radius * R.cam.focal / s[2]), c: color, a: alpha, z: s[2] });
  };
  R.draw = (ctx, st) => {
    R.reset(st);
    drawSky(ctx, st, W, H);
    st.build(R);
    R.faces.sort((a, b) => b.z - a.z);
    for (const f of R.faces) {
      ctx.beginPath();
      ctx.moveTo(f.p[0], f.p[1]);
      for (let i = 2; i < f.p.length; i += 2) ctx.lineTo(f.p[i], f.p[i + 1]);
      ctx.closePath();
      ctx.fillStyle = f.c; ctx.fill();
      if (f.s) { ctx.strokeStyle = f.s; ctx.lineWidth = f.w; ctx.stroke(); }
    }
    drawGlows(ctx);
    if (st.overlay) st.overlay(ctx, R);
  };
  function drawGlows(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    R.glows.sort((a, b) => b.z - a.z);
    for (const g of R.glows) {
      const grd = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      const cc = hex(g.c).join(',');
      grd.addColorStop(0, 'rgba(' + cc + ',' + g.a + ')');
      grd.addColorStop(0.45, 'rgba(' + cc + ',' + (g.a * 0.34) + ')');
      grd.addColorStop(1, 'rgba(' + cc + ',0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  return R;
}

function src(col) { return 'rgba(0,0,0,0.16)'; }

function shade(color, n, depth, opts) {
  const base = hex(color);
  const key = Math.max(0, dot(n, LIGHT));
  let k = 0.40 + 0.82 * key;
  const c = [base[0] * k + 20 * key, base[1] * k + 13 * key, base[2] * k + 4 * key];
  const sky = Math.max(0, n[1]) * 0.55 + Math.max(0, -n[1]) * 0.0;
  c[0] += SKYFILL[0] * sky * 0.5; c[1] += SKYFILL[1] * sky * 0.5; c[2] += SKYFILL[2] * sky * 0.6;
  const cold = Math.max(0, dot(n, [-0.5, 0.3, -0.8]));
  c[0] += 12 * cold; c[1] += 16 * cold; c[2] += 26 * cold;
  if (opts.emit) { const e = opts.emit; c[0] = lerp(c[0], base[0] * 1.55 + 40, e); c[1] = lerp(c[1], base[1] * 1.55 + 30, e); c[2] = lerp(c[2], base[2] * 1.55 + 10, e); }
  // fog
  const fogC = hex(PAL.mist);
  const f = opts.noFog ? 0 : clamp(1 - Math.exp(-Math.max(0, depth - 12) / 62), 0, 0.55);
  const fg = lerp(f, Math.min(0.92, f * 1.5), (opts.fog || 0));
  return mix(c, fogC, fg);
}

function drawSky(ctx, st, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PAL.skyTop);
  g.addColorStop(0.45, PAL.skyMid);
  g.addColorStop(0.72, PAL.skyLow);
  g.addColorStop(1, '#1a2030');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // warm horizon bloom behind the ravine
  const hg = ctx.createRadialGradient(W * 0.52, H * 0.66, 0, W * 0.52, H * 0.66, W * 0.55);
  hg.addColorStop(0, 'rgba(214,138,88,0.30)');
  hg.addColorStop(0.4, 'rgba(150,96,86,0.13)');
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 90; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W;
    const y = (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1 * H * 0.52;
    const a = 0.10 + 0.28 * ((Math.sin(i * 3.7) + 1) / 2);
    ctx.fillStyle = 'rgba(220,230,255,' + a.toFixed(3) + ')';
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  // moon
  const mx = W * 0.79, my = H * 0.17, mr = H * 0.052;
  const mg = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 7);
  mg.addColorStop(0, 'rgba(214,226,255,0.34)');
  mg.addColorStop(0.25, 'rgba(180,200,255,0.10)');
  mg.addColorStop(1, 'rgba(120,150,220,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr * 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(226,235,255,0.92)';
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(196,208,236,0.55)';
  ctx.beginPath(); ctx.arc(mx - mr * 0.28, my - mr * 0.3, mr * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + mr * 0.3, my + mr * 0.24, mr * 0.15, 0, Math.PI * 2); ctx.fill();
  // distant ridges
  const ridge = (col, yBase, amp, seed, alpha) => {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 18) {
      const y = yBase + Math.sin(x * 0.006 + seed) * amp + Math.sin(x * 0.017 + seed * 2.3) * amp * 0.45;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath();
    ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
  };
  ridge(PAL.ridgeA, H * 0.60, 26, 1.2, 0.95);
  ridge(PAL.ridgeB, H * 0.66, 18, 4.1, 0.95);
}

export function makeCanvasFrames(W, H) { return createCanvas(W, H); }
export { GlobalFonts };
