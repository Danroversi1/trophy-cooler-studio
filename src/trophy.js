// Michelob ULTRA Trophy Cooler — parametric model of the reference render.
// Units: inches · +Y up · +Z = front. Shared by the web studio and the GLB/STL exporter.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const IN_TO_M = 0.0254;
export const FRIDGE = { w: 23.62, d: 24.57, h: 31.97, weight: 130.07 }; // Meling DW-XL90 (listed gross weight)
export const WALL = 0.75, LID = 2, FLOOR = 1, PANEL = 1.0, VENT = 5.5;

// Bowl ≈ box width and pedestal ≈ bowl height, as in the reference render; the box is
// sized to the freezer and the bowl to 12 bottles + ice.
export const DEFAULTS = {
  W: 32, D: 30, H: 36.5,            // enclosure: snug around the freezer (≈2.5" clear each side)
  bowlD: 32, bowlH: 10.7, pedH: 12,  // cup: as wide as the box (as in the render), sized for 12 bottles
  flutes: 26, twist: 0.6, fluteDepth: 2.8,
  bottles: 12, heap: 1.6, lean: 0.1,
  base: 'sled', metal: 'chrome', color: '#14217f', glass: 'amber',
};
// minimum box that still houses the freezer with service clearances
export const MIN = { W: FRIDGE.w + 2 * WALL + 2 * 1.5, D: FRIDGE.d + WALL + PANEL + 1.5 + 1, H: FRIDGE.h + LID + FLOOR + 1.2 };
export const SLED_H = 3; // ice sled: UHMW skid plate + runners under a low plinth
export const casterH = () => SLED_H;
export function clearances(P) {
  const side = (P.W - 2 * WALL - FRIDGE.w) / 2, top = P.H - LID - FLOOR - FRIDGE.h;
  const front = 1.5, back = P.D - WALL - PANEL - front - FRIDGE.d;
  return { side, back, front, top, fits: side >= 1 && back >= 0.9 && top >= 1 };
}

// ---------- helpers ----------
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
// ---------- geometry cache ----------
// Every BufferGeometry is built once per shape key and reused: camera moves never touch geometry, and changing a
// material/colour reuses the cached meshes. Keys hold only the numbers that change the shape. LRU, evicted entries are
// disposed (three re-uploads them if a live mesh still uses one). Geometries carry userData.cached so callers never dispose them.
const GEO = new Map(), GEO_MAX = 600;
const kf = (v) => (typeof v === 'number' ? +v.toFixed(4) : v);
export function cachedGeometry(key, make) {
  let g = GEO.get(key);
  if (g) { GEO.delete(key); GEO.set(key, g); return g; }
  g = make(); g.userData.cached = true; GEO.set(key, g);
  if (GEO.size > GEO_MAX) { const old = GEO.keys().next().value; GEO.get(old).dispose(); GEO.delete(old); }
  return g;
}
export const geometryCacheSize = () => GEO.size;
export function clearGeometryCache() { GEO.forEach((g) => g.dispose()); GEO.clear(); }
const K = (...a) => a.map(kf).join('|');
const box = (w, h, d, mat, x, y, z) => mesh(cachedGeometry(K('box', w, h, d), () => new THREE.BoxGeometry(w, h, d)), mat, x, y, z);
const rbox = (w, h, d, r, mat, x, y, z) => mesh(cachedGeometry(K('rbox', w, h, d, r), () => new RoundedBoxGeometry(w, h, d, 5, Math.min(r, Math.min(w, h, d) / 2 - 0.01))), mat, x, y, z);
const cyl = (rt, rb, h, seg, mat, x, y, z, open = false) => mesh(cachedGeometry(K('cyl', rt, rb, h, seg, open), () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)), mat, x, y, z);
// baked ambient occlusion for lathe profiles: coves (concave turns of the profile) get darker vertex colours
function profileAO(pts, strength = 0.55) {
  const n = pts.length, ao = new Array(n).fill(1);
  for (let j = 1; j < n - 1; j++) {
    const ax = pts[j][0] - pts[j - 1][0], ay = pts[j][1] - pts[j - 1][1], bx = pts[j + 1][0] - pts[j][0], by = pts[j + 1][1] - pts[j][1];
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by); if (la < 1e-6 || lb < 1e-6) continue;
    const turn = (ax * by - ay * bx) / (la * lb); // < 0: concave (cove), > 0: convex (bullnose)
    ao[j] = 1 - strength * Math.max(0, -turn);
  }
  return ao.map((v, j) => (ao[Math.max(0, j - 1)] + 2 * v + ao[Math.min(n - 1, j + 1)]) / 4); // soften
}
function latheGeo(pts, seg, aoStrength = 0) {
  return cachedGeometry(K('lathe', seg, aoStrength, pts.flat().map(kf).join(',')), () => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    const ao = aoStrength ? profileAO(pts, aoStrength) : null, n = pts.length, col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i <= seg; i++) for (let j = 0; j < n; j++) { const v = ao ? ao[j] : 1, o = (i * n + j) * 3; col[o] = col[o + 1] = col[o + 2] = v; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  });
}
const lathe = (pts, seg, mat, aoStrength = 0) => mesh(latheGeo(pts, seg, aoStrength), mat);
// static micro-detail maps (built once): faint roughness variation keeps paint and chrome from looking like plastic
let DROPS = null;
function dropletMap() { // condensation beads on cold glass (bump map, built once)
  if (DROPS) return DROPS;
  const N = 256, r = rng(21), h = new Float32Array(N * N);
  for (let k = 0; k < 320; k++) { const cx = r() * N, cy = r() * N, rad = 2.5 + r() * r() * 8;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) { const d = Math.hypot(x - cx, (y - cy) * 0.8) / rad; if (d < 1) { const i = ((y + N) % N) * N + ((x + N) % N); h[i] = Math.max(h[i], Math.sqrt(1 - d * d)); } } }
  const b = new Uint8Array(N * N * 4); for (let i = 0; i < h.length; i++) { const v = Math.round(255 * h[i]); b[i * 4] = b[i * 4 + 1] = b[i * 4 + 2] = v; b[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(b, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.5); t.needsUpdate = true;
  return (DROPS = t);
}
let DETAIL = null;
function detailMaps() {
  if (DETAIL) return DETAIL;
  const N = 256, r = rng(3), a = new Float32Array(N * N), b = new Uint8Array(N * N * 4);
  for (let i = 0; i < a.length; i++) a[i] = r();
  for (let pass = 0; pass < 2; pass++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (let k = -1; k <= 1; k++) s += a[y * N + ((x + k + N) % N)] + a[((y + k + N) % N) * N + x]; a[y * N + x] = s / 6; }
  for (let i = 0; i < a.length; i++) { const v = Math.round(255 * (0.82 + 0.36 * a[i])); b[i * 4] = b[i * 4 + 1] = b[i * 4 + 2] = Math.min(255, v); b[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(b, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.needsUpdate = true;
  return (DETAIL = { rough: t });
}
const named = (g, n) => { g.name = n; return g; };

// ---------- materials ----------
export function makeMaterials(P, o = {}, { fast = false, detail = false } = {}) {
  const D = detail ? detailMaps() : null;
  const metal = {
    chrome: { color: 0xf1f3f6, roughness: 0.07 }, satin: { color: 0xd3d8df, roughness: 0.3 }, gold: { color: 0xdcb763, roughness: 0.12 },
  }[P.metal] || { color: 0xf1f3f6, roughness: 0.07 };
  const blue = new THREE.Color(P.color);
  const M = {
    metal: new THREE.MeshPhysicalMaterial({ name: 'polished-metal', metalness: 1, ...metal, roughnessMap: D ? D.rough : null }),
    liner: new THREE.MeshPhysicalMaterial({ name: 'bowl-liner', metalness: 1, color: 0xd9dde3, roughness: 0.18 }),
    paint: new THREE.MeshPhysicalMaterial({ name: 'enclosure-paint', color: blue, metalness: 0.05, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.08, roughnessMap: D ? D.rough : null }),
    paintDark: new THREE.MeshPhysicalMaterial({ name: 'enclosure-paint-dark', color: blue.clone().multiplyScalar(0.62), metalness: 0.08, roughness: 0.45, clearcoat: 0.8 }),
    grille: new THREE.MeshStandardMaterial({ name: 'vent-grille', color: 0x05070d, roughness: 0.6, metalness: 0.4 }),
    rubber: new THREE.MeshStandardMaterial({ name: 'caster-rubber', color: 0x16171a, roughness: 0.75 }),
    uhmw: new THREE.MeshPhysicalMaterial({ name: 'UHMW-PE', color: 0xe9e9e3, roughness: 0.6, sheen: 0.3 }),
    ice: new THREE.MeshPhysicalMaterial({ name: 'ice', color: 0xffffff, roughness: 0.07, transmission: 0.92, thickness: 0.9, ior: 1.31, attenuationColor: 0xd6e8ff, attenuationDistance: 5, clearcoat: 1, clearcoatRoughness: 0.04 }),
    iceBed: new THREE.MeshPhysicalMaterial({ name: 'ice-bed', color: 0xcfdbe8, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.5, sheenColor: 0xffffff }),
    glass: P.glass === 'clear'
      ? new THREE.MeshPhysicalMaterial({ name: 'bottle-glass-clear', color: 0xffffff, roughness: 0.03, transmission: 0.97, thickness: 0.18, ior: 1.52, attenuationColor: 0xd8f0e4, attenuationDistance: 3, clearcoat: 1 })
      : new THREE.MeshPhysicalMaterial({ name: 'bottle-glass-amber', color: 0x8a430e, roughness: 0.04, transmission: 0.5, thickness: 0.2, ior: 1.52, attenuationColor: 0x5a2604, attenuationDistance: 0.55, clearcoat: 1, clearcoatRoughness: 0.03 }),
    beer: new THREE.MeshStandardMaterial({ name: 'beer', color: 0x5a2e08, roughness: 0.3 }),
    label: o.bottleLabel ? new THREE.MeshPhysicalMaterial({ name: 'bottle-label', map: o.bottleLabel, alphaTest: 0.5, roughness: 0.38, clearcoat: 0.5 }) : new THREE.MeshStandardMaterial({ name: 'bottle-label', color: 0xffffff, roughness: 0.4 }),
    neck: o.neckLabel ? new THREE.MeshPhysicalMaterial({ name: 'bottle-neck-label', map: o.neckLabel, roughness: 0.3, clearcoat: 0.6 }) : new THREE.MeshStandardMaterial({ name: 'bottle-neck-label', color: 0xffffff }),
    cap: new THREE.MeshPhysicalMaterial({ name: 'bottle-cap', color: 0xdfe3ea, metalness: 1, roughness: 0.2 }),
    logo: o.logo ? new THREE.MeshStandardMaterial({ name: 'front-logo', map: o.logo, transparent: true, roughness: 0.35 }) : null,
  };
  M._fast = fast; M.coolerLogoMap = o.coolerLogo || null; M.coolerLogoIsDefault = o.coolerLogoIsDefault !== false;
  if (D) { M.glass.bumpMap = dropletMap(); M.glass.bumpScale = 0.7; }
  // same chrome, with the baked AO vertex colours (bowl grooves, pedestal coves)
  M.metalAO = M.metal.clone(); M.metalAO.name = 'polished-metal-ao'; M.metalAO.vertexColors = true;
  if (fast) { // no transmission: avoids a full extra scene render per frame; reflections come from the precomputed environment map
    M.ice = new THREE.MeshPhysicalMaterial({ name: 'ice', color: 0xe8f2ff, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.8, envMapIntensity: 1.5 });
    M.iceBed = new THREE.MeshPhysicalMaterial({ name: 'ice-bed', color: 0xd4e0ec, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
    M.glass = P.glass === 'clear'
      ? new THREE.MeshPhysicalMaterial({ name: 'bottle-glass-clear', color: 0xcfe3d8, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.4, envMapIntensity: 1.5 })
      : new THREE.MeshPhysicalMaterial({ name: 'bottle-glass-amber', color: 0x5e2a07, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
    M.uhmw = new THREE.MeshStandardMaterial({ name: 'UHMW-PE', color: 0xe9e9e3, roughness: 0.6 });
    if (D) { M.glass.bumpMap = dropletMap(); M.glass.bumpScale = 0.7; }
  }
  return M;
}

// ======================================================================
// Enclosure: wide blue box with a lift-off front panel, two side handles,
// a bottom vent band aligned with the freezer's front vent, and a lid.
// ======================================================================
export function buildEnclosure(P, M) {
  const g = named(new THREE.Group(), 'enclosure'), { W, D, H } = P, y0 = casterH(P), zf = D / 2;
  g.add(rbox(W, H - LID, D, 1.1, M.paint, 0, y0 + (H - LID) / 2, 0));                 // body shell
  g.add(rbox(W + 0.9, LID, D + 0.9, 0.85, M.paint, 0, y0 + H - LID / 2, 0));           // lid with overhang
  // vent band (darker) + horizontal grille slots centered, like the render
  g.add(box(W - 2.4, VENT - 1, 0.25, M.paintDark, 0, y0 + 0.4 + (VENT - 1) / 2, zf + 0.05));
  const gw = W * 0.62; for (let i = 0; i < 6; i++) g.add(box(gw, 0.28, 0.2, M.grille, 0, y0 + 1.25 + i * 0.62, zf + 0.2));
  // lift-off front panel (pivot group so the studio can lift it away)
  const panel = named(new THREE.Group(), 'front-panel'), ph = H - LID - VENT - 1.6, pw = W - 3.4, pyc = y0 + VENT + 0.6 + ph / 2;
  panel.add(rbox(pw, ph, PANEL * 0.7, 0.6, M.paint, 0, pyc, zf + 0.25));
  // recessed border line around the panel (render shows a fine inset frame)
  for (const [w, h, x, y] of [[pw - 0.6, 0.12, 0, pyc + ph / 2 - 0.55], [pw - 0.6, 0.12, 0, pyc - ph / 2 + 0.55], [0.12, ph - 1.1, -pw / 2 + 0.55, pyc], [0.12, ph - 1.1, pw / 2 - 0.55, pyc]])
    panel.add(box(w, h, 0.05, M.paintDark, x, y, zf + 0.62));
  for (const s of [-1, 1]) { // handles near both side edges
    const hx = s * (pw / 2 - 3.6);
    panel.add(rbox(1.5, 6.6, 0.5, 0.35, M.metal, hx, pyc + 0.6, zf + 0.85));
    panel.add(rbox(0.8, 5.4, 0.3, 0.25, M.grille, hx, pyc + 0.6, zf + 1.05));
  }
  if (M.logo) { const lw = Math.min(pw * 0.56, ph * 0.9), lh = lw * 0.875, l = mesh(new THREE.PlaneGeometry(lw, lh), M.logo, 0, pyc - ph * 0.02, zf + 0.64); l.castShadow = false; panel.add(l); }
  g.add(panel); g.userData.panel = panel;
  g.userData.setPanel = (t) => { panel.position.set(0, t * 6, t * 26); };
  return g;
}

// ---------- base: ice sled — slides on the rink, nothing metal touches the ice ----------
// plinth (blue) with a polished kick band, over a UHMW-PE skid plate with beveled leading edges and four runners.
export function buildBase(P, M) {
  const g = named(new THREE.Group(), 'base-ice-sled'), { W, D } = P, o = 1.2; // sled overhangs the enclosure slightly
  g.add(rbox(W - 3, 0.7, D - 3, 0.34, M.uhmw, 0, 0.35, 0));                                   // runners carry the load
  for (const x of [-(W / 2 - 3.2), -(W / 6), W / 6, W / 2 - 3.2]) g.add(rbox(2.2, 0.75, D - 1.2, 0.36, M.uhmw, x, 0.375, 0));
  const plate = rbox(W + o, 0.9, D + o, 0.44, M.uhmw, 0, 1.15, 0); g.add(plate);              // skid plate, rounded edges
  g.add(rbox(W + o - 0.2, 0.55, D + o - 0.2, 0.25, M.metal, 0, 1.85, 0));                     // polished kick band
  g.add(rbox(W + o - 0.6, 0.75, D + o - 0.6, 0.3, M.paintDark, 0, 2.55, 0));                  // plinth top under the box
  return g;
}

// ======================================================================
// Cup: stepped chrome pedestal + spiral-fluted bowl with rim band.
// ======================================================================
// pedestal profile measured off the reference (inches, for a 32" bowl on a 12" pedestal; y = 0 sits on the lid):
// a base flange, three rounded bullnose tiers, a pinched neck and a flared collar under the bowl
function tierPts(y0, y1, rOut, rTop, n = 10) {
  const out = [];
  for (let k = 0; k <= n; k++) { const u = k / n, y = y0 + u * (y1 - y0);
    const r = u < 0.3 ? rOut - 0.35 * Math.pow(1 - u / 0.3, 2) : rTop + (rOut - rTop) * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.3) / 0.7, 2)));
    out.push([r, y]); }
  return out;
}
const PED = [[0, 0], [12.35, 0], [12.5, 0.25], ...tierPts(0.3, 1.2, 12.5, 11.7, 6), [11.45, 1.32],
  ...tierPts(1.35, 4.1, 11.3, 10.1), [9.95, 4.15], ...tierPts(4.2, 7.0, 9.9, 7.5), [7.3, 7.05], ...tierPts(7.1, 9.2, 7.0, 5.6, 8),
  [5.25, 9.4], [5.0, 10.0], [5.1, 10.6], [5.5, 11.0], [5.9, 11.15], [6.25, 11.5], [6.3, 11.8], [6.1, 12.0], [0, 12.0]];
export function bowlShape(P) { // outer radius as a function of t (0 = bowl base, 1 = rim)
  const s = P.bowlD / 61, R = P.bowlD / 2, rb = 6.1 * (P.bowlD / 32);
  return { s, R, rb, r: (t) => rb + (R - rb) * Math.pow(Math.sin((t * Math.PI) / 2), 0.62) }; // full, rounded belly
}
// inverse-CDF sampling: more rows where the density (curvature, flute activity) is high, fewer on smooth spans
function adaptiveRows(rows, dens) {
  const F = 600, c = [0];
  for (let k = 1; k <= F; k++) c.push(c[k - 1] + dens((k - 0.5) / F));
  const out = []; let k = 0;
  for (let j = 0; j <= rows; j++) { const target = (j / rows) * c[F]; while (k < F - 1 && c[k + 1] < target) k++; out.push(Math.min(1, (k + (target - c[k]) / Math.max(1e-9, c[k + 1] - c[k])) / F)); }
  out[0] = 0; out[rows] = 1; return out;
}
// LOD budgets. 'high' for close views and stills, 'low' for slider drags and when the cup is small on screen.
export const CUP_LOD = { high: { perFlute: 16, rows: 110, lathe: 160 }, low: { perFlute: 6, rows: 38, lathe: 56 } };
function bowlGeometry(P, lod) {
  const { s, R, r } = bowlShape(P), yb = P.pedH, H = P.bowlH, N = Math.round(P.flutes), tw = P.twist, amp = P.fluteDepth * s, L = CUP_LOD[lod];
  return cachedGeometry(K('bowl', lod, P.bowlD, P.bowlH, P.pedH, N, tw, P.fluteDepth), () => {
    const wAt = (t) => ss(0.0, 0.1, t) * (1 - ss(0.7, 0.78, t)), cutAt = (t) => 0.9 * ss(0.6, 0.76, t) + 0.6 * (1 - ss(0.0, 0.16, t));
    const curv = (t) => Math.abs(r(Math.min(1, t + 0.004)) - 2 * r(t) + r(Math.max(0, t - 0.004))) / 1.6e-5 / R;
    const ts = adaptiveRows(L.rows, (t) => 0.25 + 0.6 * Math.min(2, curv(t)) + 1.2 * wAt(t) + 6 * Math.abs(cutAt(t + 0.005) - cutAt(t - 0.005)));
    const RS = Math.max(N * L.perFlute, lod === 'high' ? 240 : 96), HS = ts.length - 1, pos = [], idx = [], uv = [], col = [];
    for (let j = 0; j <= HS; j++) {
      const t = ts[j], base = r(t), w = wAt(t), cut = cutAt(t);
      for (let i = 0; i <= RS; i++) {
        const th = (i / RS) * Math.PI * 2, ph = th - tw * 1.5 * Math.pow(t, 1.35), lobe = Math.abs(Math.cos((N * ph) / 2));
        const ridge = Math.sqrt(Math.max(0, (lobe - cut) / (1 - cut)));
        const rr = base + amp * w * (ridge - 0.25);
        pos.push(rr * Math.sin(th), yb + t * H, rr * Math.cos(th)); uv.push(i / RS, t);
        const ao = (1 - 0.5 * w * Math.pow(1 - ridge, 1.5)) * (0.72 + 0.28 * ss(0, 0.18, t)); col.push(ao, ao, ao); // grooves + the stem junction
      }
    }
    for (let j = 0; j < HS; j++) for (let i = 0; i < RS; i++) { const a = j * (RS + 1) + i, b = a + RS + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); bg.setIndex(idx); bg.computeVertexNormals(); return bg;
  });
}
export function buildCup(P, M, { lod = 'high' } = {}) {
  const g = named(new THREE.Group(), 'cup'), { s, R, r } = bowlShape(P), kx = P.bowlD / 32, ky = P.pedH / 12, mAO = M.metalAO || M.metal;
  const yb = P.pedH, H = P.bowlH, rim = yb + H, wall = 1.3 * s;
  const levels = lod === 'both' ? ['high', 'low'] : [lod];
  for (const lv of levels) { // the shape parts that carry the detail come in LOD pairs; only one is visible at a time
    const L = CUP_LOD[lv], tag = (o) => { if (lod === 'both') { o.userData.lod = lv; o.visible = lv === 'high'; } return o; };
    g.add(tag(named(lathe(PED.map(([rr, y]) => [rr * kx, y * ky]), L.lathe, mAO, 0.6), 'pedestal')));
    g.add(tag(named(mesh(bowlGeometry(P, lv), mAO), 'bowl-fluted')));
    g.add(tag(named(lathe([[R - 0.05, rim - 1.9 * s], [R + 0.35 * s, rim - 1.5 * s], [R + 0.45 * s, rim - 0.2], [R + 0.2 * s, rim + 0.25], [R - wall, rim + 0.25], [R - wall, rim - 0.4]], L.lathe, mAO, 0.4), 'rim-band')));
  }
  const depth = Math.min(H * 0.7, 14.5), floor = rim - depth, inner = (y) => r(Math.min(1, Math.max(0, (y - yb) / H))) - wall;
  const lp = []; for (let k = 0; k <= 24; k++) { const y = floor + (k / 24) * (rim - floor); lp.push([inner(y), y]); }
  g.add(named(lathe([[0, floor], ...lp], 96, M.liner), 'bowl-liner'));
  g.userData.bowl = { floor, rim, rAt: inner };
  return g;
}

// ---------- bottles (Michelob ULTRA long-necks) on a heaped ice bed ----------
// 12 oz longneck: straight body, long gentle shoulder, tapered neck, crown lip
const BOTTLE = [[0, 0], [1.14, 0], [1.2, 0.15], [1.2, 4.9], [1.16, 5.5], [1.0, 6.2], [0.74, 6.9], [0.61, 7.4], [0.55, 8.5], [0.6, 8.62], [0.6, 8.92], [0, 8.97]];
const rBottle = (y) => { for (let i = 1; i < BOTTLE.length; i++) if (y <= BOTTLE[i][1]) { const [r0, y0] = BOTTLE[i - 1], [r1, y1] = BOTTLE[i]; return r0 + (r1 - r0) * (y - y0) / Math.max(1e-6, y1 - y0); } return 0.5; };
// ---------- shared pieces (used by the cooler design too) ----------
export const U = { rng, ss, mesh, box, rbox, cyl, named, K };
export function bottleGeometries(hi = true) {
  const bs = hi ? 40 : 16;
  return [
    [cachedGeometry(K('bottle', bs), () => new THREE.LatheGeometry(BOTTLE.map(([q, y]) => new THREE.Vector2(q, y)), bs)), 'glass'],
    [cachedGeometry(K('beer', bs), () => new THREE.LatheGeometry(BOTTLE.filter(([, y]) => y < 7.2).map(([q, y]) => new THREE.Vector2(Math.max(0, q - 0.12), y + 0.05)), Math.max(12, bs - 16))), 'beer'],
    [cachedGeometry(K('label', bs), () => new THREE.CylinderGeometry(1.222, 1.222, 3.9, hi ? 64 : 24, 1, true).translate(0, 2.65, 0)), 'label'],
    [cachedGeometry(K('neck', bs), () => new THREE.CylinderGeometry(rBottle(8.5) + 0.02, rBottle(7.0) + 0.02, 1.5, bs, 1, true).translate(0, 7.75, 0)), 'neck'],
    [cachedGeometry(K('cap', bs), () => new THREE.CylinderGeometry(0.6, 0.64, 0.36, hi ? 24 : 12).translate(0, 8.86, 0)), 'cap'],
  ];
}
// add bottles at the given matrices (instanced for the live view, plain meshes for export)
export function addBottles(g, M, matrices, { instanced = true, hi = true } = {}) {
  for (const [geo, key] of bottleGeometries(hi)) {
    if (instanced) { const im = new THREE.InstancedMesh(geo, M[key], matrices.length); matrices.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; g.add(im); }
    else matrices.forEach((m) => { const me = mesh(geo, M[key]); me.applyMatrix4(m); g.add(me); });
  }
}
// the freezer stand-in, front face at z = zf, standing on y0
export function fridgeAt(y0, zf, x = 0) {
  const g = named(new THREE.Group(), 'meling-DW-XL90'), { w, d, h } = FRIDGE;
  const body = new THREE.MeshStandardMaterial({ name: 'fridge-body', color: 0xf5f5f3, roughness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.6 });
  g.add(box(w, h, d, body, x, y0 + h / 2, zf - d / 2));
  g.add(box(w - 5, h - 10, 0.15, new THREE.MeshPhysicalMaterial({ color: 0x9fb6c8, roughness: 0.1, transparent: true, opacity: 0.6 }), x, y0 + h / 2 + 1, zf + 0.05));
  g.add(box(w - 2, 2.2, 0.2, dark, x, y0 + 1.6, zf + 0.06));
  return g;
}

export function buildContents(P, M, bowl, { instanced = true, seed = 7, lod = 'high' } = {}) {
  const g = named(new THREE.Group(), 'bottles-and-ice'), r = rng(seed), Ri = bowl.rAt(bowl.rim) - 0.4, heap = P.heap;
  const surf = (x, z) => { const q = Math.min(1, Math.hypot(x, z) / Ri); return bowl.rim - 0.9 + heap * (1 - q * q) + 0.35 * Math.sin(x * 0.7) * Math.cos(z * 0.6); };
  // ice bed: one displaced surface that reads as packed ice
  const bed = cachedGeometry(K('bed', Ri, bowl.rim, heap), () => { const b = new THREE.CircleGeometry(Ri, 96, 0, Math.PI * 2); b.rotateX(-Math.PI / 2);
    const bp = b.attributes.position; for (let i = 0; i < bp.count; i++) bp.setY(i, surf(bp.getX(i), bp.getZ(i)) - 0.6); b.computeVertexNormals(); return b; });
  g.add(named(mesh(bed, M.iceBed), 'ice-bed'));
  // bottles: pushed into the ice at different depths, each tilted and turned a little differently, labels mostly facing out
  const n = Math.round(P.bottles), nIn = n >= 10 ? Math.round(n / 4) : 0, nOut = n - nIn, slots = [], jit = (k) => (r() * 2 - 1) * k;
  const ringR = Math.max(5.6, Math.min(Ri - 2.6, Ri * 0.72 + (n - 12) * 0.3)), innerR = ringR * 0.38;
  for (let i = 0; i < n; i++) {
    const inner = i >= nOut, k = inner ? i - nOut : i, m = inner ? nIn : nOut;
    const a = (k / m) * Math.PI * 2 + (inner ? 0.6 : 0.13) + jit(0.12), rr = (inner ? innerR : ringR) + jit(0.8), x = rr * Math.cos(a), z = rr * Math.sin(a);
    const bury = inner ? 0.2 + r() * 0.6 : 0.5 + r() * 0.8;                      // how deep it sits in the ice
    const yaw = Math.PI / 2 - a + jit(inner ? 1.2 : 0.55);                        // label roughly outward, never in lockstep
    const lean = inner ? 0.04 + r() * (P.lean + 0.08) : 0.1 + r() * (P.lean * 2 + 0.12), side = jit(0.16);
    slots.push([a, x, z, surf(x, z) - bury, yaw, lean, side]);
  }
  const hi = lod !== 'low', bs = hi ? 40 : 16; // bottle part geometries are shared by every bottle and every rebuild
  const lathe32 = cachedGeometry(K('bottle', bs), () => new THREE.LatheGeometry(BOTTLE.map(([q, y]) => new THREE.Vector2(q, y)), bs));
  const beer = cachedGeometry(K('beer', bs), () => new THREE.LatheGeometry(BOTTLE.filter(([, y]) => y < 7.2).map(([q, y]) => new THREE.Vector2(Math.max(0, q - 0.12), y + 0.05)), Math.max(12, bs - 16)));
  const lab = cachedGeometry(K('label', bs), () => new THREE.CylinderGeometry(1.222, 1.222, 3.9, hi ? 64 : 24, 1, true).translate(0, 2.65, 0));
  const nk = cachedGeometry(K('neck', bs), () => new THREE.CylinderGeometry(rBottle(8.5) + 0.02, rBottle(7.0) + 0.02, 1.5, bs, 1, true).translate(0, 7.75, 0));
  const cp = cachedGeometry(K('cap', bs), () => new THREE.CylinderGeometry(0.6, 0.64, 0.36, hi ? 24 : 12).translate(0, 8.86, 0));
  const parts = [[lathe32, M.glass], [beer, M.beer], [lab, M.label], [nk, M.neck], [cp, M.cap]], mats = [];
  for (const [a, x, z, y, yaw, lean, side] of slots) { const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.set(0, yaw, 0); o.rotateX(lean); o.rotateZ(side); o.updateMatrix(); mats.push(o.matrix.clone()); }
  for (const [geo, mat] of parts) {
    if (instanced) { const im = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; g.add(im); }
    else mats.forEach((m) => { const me = mesh(geo, mat); me.applyMatrix4(m); g.add(me); });
  }
  // loose cubes on top of the bed, kept clear of the bottles
  const cubes = [], cell = new Map(), key = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  for (let t = 0; t < 16000 && cubes.length < Math.round(Ri * Ri * 1.15); t++) {
    const rr = Math.sqrt(r()) * (Ri - 0.5), a = r() * Math.PI * 2, x = rr * Math.cos(a), z = rr * Math.sin(a);
    if (slots.some(([, bx, bz]) => Math.hypot(x - bx, z - bz) < 1.55)) continue;
    const k = key(x, z), near = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => cell.get(`${Math.floor(x / 2) + i},${Math.floor(z / 2) + j}`) || [])).flat();
    if (near.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 1.0)) continue;
    cubes.push([x, z]); (cell.get(k) || cell.set(k, []).get(k)).push([x, z]);
  }
  const chunkDetail = instanced && hi ? 1 : 0, d = new THREE.Object3D(), cm = []; // crushed ice: irregular faceted chunks
  const cg = cachedGeometry(K('ice-chunk', chunkDetail), () => { const c = new THREE.IcosahedronGeometry(0.62, chunkDetail); if (chunkDetail) { const p = c.attributes.position, rq = rng(11); for (let i = 0; i < p.count; i++) { const f = 0.82 + rq() * 0.3; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f); } c.computeVertexNormals(); } return c; });
  for (const [x, z] of cubes) { d.position.set(x, surf(x, z) - 0.15 + r() * 0.8, z); d.rotation.set(r() * 3, r() * 3, r() * 3); d.scale.set(0.8 + r() * 0.7, 0.6 + r() * 0.5, 0.8 + r() * 0.7); d.updateMatrix(); cm.push(d.matrix.clone()); }
  if (instanced) { const im = new THREE.InstancedMesh(cg, M.ice, cm.length); cm.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; g.add(im); }
  else g.add(mesh(cachedGeometry(K('ice-merged', Ri, bowl.rim, heap, P.bottles, P.lean, seed), () => mergeGeometries(cm.map((m) => cg.clone().applyMatrix4(m)))), M.ice));
  g.userData.top = Math.max(...slots.map(([, , , y, l]) => y + 9.1 * Math.cos(l)));
  return g;
}

// ---------- freezer reference volume ----------
export function buildFridge(P) {
  const g = named(new THREE.Group(), 'meling-DW-XL90'), { w, d, h } = FRIDGE, y0 = casterH(P) + FLOOR, zf = P.D / 2 - PANEL - 1.5;
  const body = new THREE.MeshStandardMaterial({ name: 'fridge-body', color: 0xf5f5f3, roughness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.6 });
  g.add(box(w, h, d, body, 0, y0 + h / 2, zf - d / 2));
  g.add(box(w - 5, h - 10, 0.15, new THREE.MeshPhysicalMaterial({ color: 0x9fb6c8, roughness: 0.1, transparent: true, opacity: 0.6 }), 0, y0 + h / 2 + 1, zf + 0.05));
  g.add(box(w - 2, 2.2, 0.2, dark, 0, y0 + 1.6, zf + 0.06));
  return g;
}

// ---------- weights (lb, estimates for spun aluminum cup + ACM/aluminum enclosure) ----------
export function weights(P) {
  const s = P.bowlD / 61, area = (P.W * P.D) / (61 * 30);
  return { enclosure: Math.round(115 * Math.max(0.55, area) * (P.H / 36)), cup: Math.round(78 * s * s * (P.bowlH / 20.4)), pedestal: Math.round(46 * s * s * (P.pedH / 22.9)), base: Math.round(30 * Math.max(0.55, area)),
    bottles: Math.round(P.bottles * 1.2), ice: Math.round(0.9 * Math.PI * Math.pow(P.bowlD / 2 - 1.7, 2) * 0.55 / 28), fridge: FRIDGE.weight };
}
