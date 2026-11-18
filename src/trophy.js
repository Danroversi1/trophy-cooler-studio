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
  flutes: 28, twist: 0.9, fluteDepth: 1.5,
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
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const rbox = (w, h, d, r, mat, x, y, z) => mesh(new RoundedBoxGeometry(w, h, d, 5, Math.min(r, Math.min(w, h, d) / 2 - 0.01)), mat, x, y, z);
const cyl = (rt, rb, h, seg, mat, x, y, z, open = false) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat, x, y, z);
const lathe = (pts, seg, mat) => mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);
const named = (g, n) => { g.name = n; return g; };

// ---------- materials ----------
export function makeMaterials(P, o = {}) {
  const metal = {
    chrome: { color: 0xf1f3f6, roughness: 0.07 }, satin: { color: 0xd3d8df, roughness: 0.3 }, gold: { color: 0xdcb763, roughness: 0.12 },
  }[P.metal] || { color: 0xf1f3f6, roughness: 0.07 };
  const blue = new THREE.Color(P.color);
  return {
    metal: new THREE.MeshPhysicalMaterial({ name: 'polished-metal', metalness: 1, ...metal }),
    liner: new THREE.MeshPhysicalMaterial({ name: 'bowl-liner', metalness: 1, color: 0xd9dde3, roughness: 0.18 }),
    paint: new THREE.MeshPhysicalMaterial({ name: 'enclosure-paint', color: blue, metalness: 0.05, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.08 }),
    paintDark: new THREE.MeshPhysicalMaterial({ name: 'enclosure-paint-dark', color: blue.clone().multiplyScalar(0.62), metalness: 0.08, roughness: 0.45, clearcoat: 0.8 }),
    grille: new THREE.MeshStandardMaterial({ name: 'vent-grille', color: 0x05070d, roughness: 0.6, metalness: 0.4 }),
    rubber: new THREE.MeshStandardMaterial({ name: 'caster-rubber', color: 0x16171a, roughness: 0.75 }),
    uhmw: new THREE.MeshPhysicalMaterial({ name: 'UHMW-PE', color: 0xe9e9e3, roughness: 0.6, sheen: 0.3 }),
    ice: new THREE.MeshPhysicalMaterial({ name: 'ice', color: 0xf3f8ff, roughness: 0.16, transmission: 0.68, thickness: 1.6, ior: 1.31, attenuationColor: 0xe2efff, attenuationDistance: 8, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.4, sheenColor: 0xffffff }),
    iceBed: new THREE.MeshPhysicalMaterial({ name: 'ice-bed', color: 0xdfe8f2, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.3, sheen: 0.6, sheenColor: 0xffffff }),
    glass: P.glass === 'clear'
      ? new THREE.MeshPhysicalMaterial({ name: 'bottle-glass-clear', color: 0xffffff, roughness: 0.03, transmission: 0.97, thickness: 0.18, ior: 1.52, attenuationColor: 0xd8f0e4, attenuationDistance: 3, clearcoat: 1 })
      : new THREE.MeshPhysicalMaterial({ name: 'bottle-glass-amber', color: 0x8a430e, roughness: 0.04, transmission: 0.5, thickness: 0.2, ior: 1.52, attenuationColor: 0x5a2604, attenuationDistance: 0.55, clearcoat: 1, clearcoatRoughness: 0.03 }),
    beer: new THREE.MeshStandardMaterial({ name: 'beer', color: 0x5a2e08, roughness: 0.3 }),
    label: o.bottleLabel ? new THREE.MeshPhysicalMaterial({ name: 'bottle-label', map: o.bottleLabel, alphaTest: 0.5, roughness: 0.38, clearcoat: 0.5 }) : new THREE.MeshStandardMaterial({ name: 'bottle-label', color: 0xffffff, roughness: 0.4 }),
    neck: o.neckLabel ? new THREE.MeshPhysicalMaterial({ name: 'bottle-neck-label', map: o.neckLabel, roughness: 0.3, clearcoat: 0.6 }) : new THREE.MeshStandardMaterial({ name: 'bottle-neck-label', color: 0xffffff }),
    cap: new THREE.MeshPhysicalMaterial({ name: 'bottle-cap', color: 0xdfe3ea, metalness: 1, roughness: 0.2 }),
    logo: o.logo ? new THREE.MeshStandardMaterial({ name: 'front-logo', map: o.logo, transparent: true, roughness: 0.35 }) : null,
  };
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
const PED = [ // [radius, height] from the render, for a 61" bowl; y=0 sits on the lid
  [0, 0], [23.3, 0], [23.3, 1.0], [22.6, 2.0], [21.5, 2.2], [21.5, 4.4], [20.1, 5.6], [17.7, 5.8], [17.7, 9.2], [16.4, 10.4],
  [13.9, 10.6], [13.9, 13.4], [12.9, 14.3], [11.4, 14.5], [11.4, 17.2], [9.6, 18.4], [8.2, 19.0], [8.2, 21.2], [10.4, 22.4], [11.6, 22.9], [0, 22.9],
];
export function bowlShape(P) { // outer radius as a function of t (0 = bowl base, 1 = rim)
  const s = P.bowlD / 61, R = P.bowlD / 2, rb = 11.6 * s;
  return { s, R, rb, r: (t) => rb + (R - rb) * Math.pow(Math.sin((t * Math.PI) / 2), 0.8) };
}
export function buildCup(P, M) {
  const g = named(new THREE.Group(), 'cup'), { s, R, r } = bowlShape(P), ky = P.pedH / 22.9;
  const ped = named(lathe(PED.map(([rr, y]) => [rr * s, y * ky]), 128, M.metal), 'pedestal'); g.add(ped);
  const yb = P.pedH, H = P.bowlH, N = Math.round(P.flutes), tw = P.twist, amp = P.fluteDepth * s;
  // fluted outer bowl: lathe-like grid with spiral ridges that fade out toward the smooth rim band
  const RS = Math.max(N * 10, 120), HS = 90, pos = [], idx = [], uv = [];
  for (let j = 0; j <= HS; j++) {
    const t = j / HS, w = ss(0.02, 0.12, t) * (1 - ss(0.7, 0.86, t)), base = r(t);
    for (let i = 0; i <= RS; i++) {
      const th = (i / RS) * Math.PI * 2, ph = th - tw * t * 1.4, ridge = Math.pow(0.5 + 0.5 * Math.cos(N * ph), 0.7);
      const rr = base + amp * w * (ridge - 0.35);
      pos.push(rr * Math.sin(th), yb + t * H, rr * Math.cos(th)); uv.push(i / RS, t);
    }
  }
  for (let j = 0; j < HS; j++) for (let i = 0; i < RS; i++) { const a = j * (RS + 1) + i, b = a + RS + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); bg.setIndex(idx); bg.computeVertexNormals();
  g.add(named(mesh(bg, M.metal), 'bowl-fluted'));
  // rim band (thick polished lip) + inner liner + floor
  const rim = yb + H, wall = 1.3 * s;
  g.add(named(lathe([[R - 0.05, rim - 1.9 * s], [R + 0.35 * s, rim - 1.5 * s], [R + 0.45 * s, rim - 0.2], [R + 0.2 * s, rim + 0.25], [R - wall, rim + 0.25], [R - wall, rim - 0.4]], 160, M.metal), 'rim-band'));
  const depth = Math.min(H * 0.7, 14.5), floor = rim - depth, inner = (y) => r(Math.min(1, Math.max(0, (y - yb) / H))) - wall;
  const lp = []; for (let k = 0; k <= 24; k++) { const y = floor + (k / 24) * (rim - floor); lp.push([inner(y), y]); }
  g.add(named(lathe([[0, floor], ...lp], 160, M.liner), 'bowl-liner'));
  g.userData.bowl = { floor, rim, rAt: inner };
  return g;
}

// ---------- bottles (Michelob ULTRA long-necks) on a heaped ice bed ----------
// 12 oz longneck: straight body, long gentle shoulder, tapered neck, crown lip
const BOTTLE = [[0, 0], [1.14, 0], [1.2, 0.15], [1.2, 4.9], [1.16, 5.5], [1.0, 6.2], [0.74, 6.9], [0.61, 7.4], [0.55, 8.5], [0.6, 8.62], [0.6, 8.92], [0, 8.97]];
const rBottle = (y) => { for (let i = 1; i < BOTTLE.length; i++) if (y <= BOTTLE[i][1]) { const [r0, y0] = BOTTLE[i - 1], [r1, y1] = BOTTLE[i]; return r0 + (r1 - r0) * (y - y0) / Math.max(1e-6, y1 - y0); } return 0.5; };
export function buildContents(P, M, bowl, { instanced = true, seed = 7 } = {}) {
  const g = named(new THREE.Group(), 'bottles-and-ice'), r = rng(seed), Ri = bowl.rAt(bowl.rim) - 0.4, heap = P.heap;
  const surf = (x, z) => { const q = Math.min(1, Math.hypot(x, z) / Ri); return bowl.rim - 0.9 + heap * (1 - q * q) + 0.35 * Math.sin(x * 0.7) * Math.cos(z * 0.6); };
  // ice bed: one displaced surface that reads as packed ice
  const bed = new THREE.CircleGeometry(Ri, 96, 0, Math.PI * 2); bed.rotateX(-Math.PI / 2);
  const bp = bed.attributes.position; for (let i = 0; i < bp.count; i++) bp.setY(i, surf(bp.getX(i), bp.getZ(i)) - 0.6); bed.computeVertexNormals();
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
  const lathe32 = new THREE.LatheGeometry(BOTTLE.map(([q, y]) => new THREE.Vector2(q, y)), 40);
  const beer = new THREE.LatheGeometry(BOTTLE.filter(([, y]) => y < 7.2).map(([q, y]) => new THREE.Vector2(Math.max(0, q - 0.12), y + 0.05)), 24);
  const lab = new THREE.CylinderGeometry(1.222, 1.222, 3.9, 64, 1, true); lab.translate(0, 2.65, 0);
  const nk = new THREE.CylinderGeometry(rBottle(8.5) + 0.02, rBottle(7.0) + 0.02, 1.5, 40, 1, true); nk.translate(0, 7.75, 0);
  const cp = new THREE.CylinderGeometry(0.6, 0.64, 0.36, 24); cp.translate(0, 8.86, 0);
  const parts = [[lathe32, M.glass], [beer, M.beer], [lab, M.label], [nk, M.neck], [cp, M.cap]], mats = [];
  for (const [a, x, z, y, yaw, lean, side] of slots) { const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.set(0, yaw, 0); o.rotateX(lean); o.rotateZ(side); o.updateMatrix(); mats.push(o.matrix.clone()); }
  for (const [geo, mat] of parts) {
    if (instanced) { const im = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; g.add(im); }
    else mats.forEach((m) => { const me = mesh(geo, mat); me.applyMatrix4(m); g.add(me); });
  }
  // loose cubes on top of the bed, kept clear of the bottles
  const cubes = [], cell = new Map(), key = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  for (let t = 0; t < 9000 && cubes.length < Math.round(Ri * Ri * 0.5); t++) {
    const rr = Math.sqrt(r()) * (Ri - 1.2), a = r() * Math.PI * 2, x = rr * Math.cos(a), z = rr * Math.sin(a);
    if (slots.some(([, bx, bz]) => Math.hypot(x - bx, z - bz) < 2.0)) continue;
    const k = key(x, z), near = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => cell.get(`${Math.floor(x / 2) + i},${Math.floor(z / 2) + j}`) || [])).flat();
    if (near.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 1.7)) continue;
    cubes.push([x, z]); (cell.get(k) || cell.set(k, []).get(k)).push([x, z]);
  }
  const cg = instanced ? new RoundedBoxGeometry(1.9, 1.7, 1.9, 2, 0.32) : new THREE.BoxGeometry(1.8, 1.6, 1.8), d = new THREE.Object3D(), cm = [];
  for (const [x, z] of cubes) { d.position.set(x, surf(x, z) - 0.2 + r() * 0.5, z); d.rotation.set(r() * 0.8, r() * 3, r() * 0.8); d.scale.setScalar(0.75 + r() * 0.5); d.updateMatrix(); cm.push(d.matrix.clone()); }
  if (instanced) { const im = new THREE.InstancedMesh(cg, M.ice, cm.length); cm.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; g.add(im); }
  else g.add(mesh(mergeGeometries(cm.map((m) => cg.clone().applyMatrix4(m))), M.ice));
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
