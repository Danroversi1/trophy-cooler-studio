// Trophy Cooler — parametric module library (units: inches, +Y up, +Z = front)
// Shared by the web studio and the GLB/STL exporter.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const IN_TO_M = 0.0254;
export const FRIDGE = { w: 23.62, d: 24.57, h: 31.97, weight: 130.07 }; // Meling DW-XL90 (gross wt)
export const DECK_Y = 3;            // top of every sled
export const ENC_H = 36;            // every enclosure is 36" tall
export const CUP_Y = DECK_Y + ENC_H; // cup mounting plane (39")
export const BEER = { count: 12, lbEach: 1.2 }; // 12 oz long-neck, full

// ---------- helpers ----------
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const rbox = (w, h, d, r, mat, x, y, z) => mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, Math.min(w, h, d) / 2 - 0.01)), mat, x, y, z);
const cyl = (rt, rb, h, seg, mat, x, y, z, open = false, ts = 0, tl = Math.PI * 2) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl), mat, x, y, z);
function lathe(pts, seg, mat, faceted = false) {
  let g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  if (faceted) { g = g.toNonIndexed(); g.computeVertexNormals(); }
  return mesh(g, mat);
}
function torus(R, r, mat, y = 0, tubSeg = 96, arc = Math.PI * 2) { const m = mesh(new THREE.TorusGeometry(R, r, 16, tubSeg, arc), mat, 0, y, 0); m.rotation.x = Math.PI / 2; return m; }
function strut(a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A);
  const m = mesh(new THREE.CylinderGeometry(r, r, dir.length(), 16), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}
const add = (g, ...ms) => { for (const m of ms) if (m) g.add(m); return g; };
const named = (g, name) => { g.name = name; return g; };

// ---------- materials ----------
export function makeMaterials(o) {
  const metal = o.metal === 'gold'
    ? new THREE.MeshPhysicalMaterial({ name: 'polished-gold', color: 0xd9b45b, metalness: 1, roughness: 0.14 })
    : new THREE.MeshPhysicalMaterial({ name: 'mirror-chrome', color: 0xf3f5f8, metalness: 1, roughness: 0.05 });
  const M = {
    metal,
    gunmetal: new THREE.MeshPhysicalMaterial({ name: 'gunmetal', color: 0x23262c, metalness: 1, roughness: 0.32 }),
    primary: new THREE.MeshPhysicalMaterial({ name: 'lacquer-primary', color: o.primary, metalness: 0.15, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.06 }),
    white: new THREE.MeshPhysicalMaterial({ name: 'gloss-white', color: 0xf3f5f8, roughness: 0.28, clearcoat: 0.9 }),
    uhmw: new THREE.MeshStandardMaterial({ name: 'UHMW-PE', color: 0xecece6, roughness: 0.78 }),
    rubber: new THREE.MeshStandardMaterial({ name: 'vulcanized-rubber', color: 0x131417, roughness: 0.82 }),
    grille: new THREE.MeshStandardMaterial({ name: 'vent-grille', color: 0x0b0c0f, roughness: 0.55, metalness: 0.5 }),
    led: new THREE.MeshStandardMaterial({ name: 'LED', color: o.accent, emissive: o.accent, emissiveIntensity: 2.4 }),
    acrylic: new THREE.MeshPhysicalMaterial({ name: 'frosted-acrylic', color: o.accent, roughness: 0.5, transmission: 0.55, thickness: 0.5, ior: 1.49, iridescence: 0.55, iridescenceIOR: 1.3, side: THREE.DoubleSide }),
    iridescent: new THREE.MeshPhysicalMaterial({ name: 'iridescent-shell', color: 0xffffff, roughness: 0.04, transmission: 0.8, thickness: 0.8, ior: 1.5, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 900], side: THREE.DoubleSide }),
    ice: new THREE.MeshPhysicalMaterial({ name: 'ice', color: 0xeaf5ff, roughness: 0.12, transmission: 0.92, thickness: 1.0, ior: 1.31 }),
    bottle: new THREE.MeshPhysicalMaterial({ name: 'bottle-glass', color: 0xe6f2ee, roughness: 0.04, transmission: 0.92, thickness: 0.25, ior: 1.5 }),
    labelWhite: new THREE.MeshStandardMaterial({ name: 'bottle-label', color: 0xffffff, roughness: 0.35 }),
    labelBlue: new THREE.MeshStandardMaterial({ name: 'bottle-label-blue', color: 0x0b2a6b, roughness: 0.35 }),
    foil: new THREE.MeshPhysicalMaterial({ name: 'neck-foil', color: 0xcfd6de, metalness: 1, roughness: 0.2 }),
  };
  // stained-glass palette around the accent hue
  const hsl = {}; new THREE.Color(o.accent).getHSL(hsl);
  const shifts = [[0, 0, 0], [0.03, 0.05, 0.14], [-0.04, -0.1, 0.24], [0.48, -0.3, 0.32], [0, -0.7, 0.4], [0.07, 0.1, -0.12]];
  M.glass = shifts.map(([dh, ds, dl], i) => {
    const c = new THREE.Color().setHSL((hsl.h + dh + 1) % 1, clamp(hsl.s + ds), clamp(hsl.l + dl, 0.12, 0.92));
    return new THREE.MeshPhysicalMaterial({ name: 'stained-glass-' + i, color: c, roughness: 0.1, transmission: 0.35, thickness: 0.3, ior: 1.52, iridescence: 0.4, emissive: c, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  });
  if (o.palette && o.palette.length) M.glass = o.palette.slice(0, 6).map((hex, i) => {
    const c = new THREE.Color(hex);
    return new THREE.MeshPhysicalMaterial({ name: 'stained-glass-' + i, color: c, roughness: 0.1, transmission: 0.35, thickness: 0.3, ior: 1.52, iridescence: 0.4, emissive: c, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  });
  // "skin" = surface graphic from a design reference or the brand logo pattern
  M.skin = o.skinTexture ? new THREE.MeshPhysicalMaterial({ name: 'skin-graphic', map: o.skinTexture, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.05, side: THREE.DoubleSide }) : null;
  return M;
}

// Brand label (only when a canvas text renderer is supplied — browser studio)
function labelMat(o, aspect, opt = {}) {
  if (!o.makeLabel) return null;
  const tex = o.makeLabel(o.brand || 'MICHELOB ULTRA', { aspect, ...opt });
  return new THREE.MeshStandardMaterial({ name: 'brand-label', map: tex, transparent: !opt.bg, roughness: 0.3, metalness: 0.05, side: THREE.DoubleSide });
}
function labelPlane(o, w, h, opt) { const m = labelMat(o, w / h, opt); return m ? mesh(new THREE.PlaneGeometry(w, h), m) : null; }
function labelBand(o, R, h, y, ts, tl, opt) {
  const m = labelMat(o, (R * tl) / h, opt); if (!m) return null;
  return cyl(R, R, h, 96, m, 0, y, 0, true, ts, tl);
}

// Stained-glass mosaic panel in the XY plane facing +Z (tiles merged per material)
function mosaic(M, w, h, seed, glow = true) {
  const g = new THREE.Group(), r = rng(seed), buckets = M.glass.map(() => []);
  let y = -h / 2;
  while (y < h / 2 - 0.01) {
    let rh = 2.2 + r() * 3.2; if (h / 2 - (y + rh) < 1.8) rh = h / 2 - y;
    let x = -w / 2;
    while (x < w / 2 - 0.01) {
      let cw = 2 + r() * 4.5; if (w / 2 - (x + cw) < 1.6) cw = w / 2 - x;
      const tile = new THREE.BoxGeometry(cw - 0.32, rh - 0.32, 0.22);
      tile.translate(x + cw / 2, y + rh / 2, 0.12);
      buckets[Math.floor(r() * M.glass.length)].push(tile);
      x += cw;
    }
    y += rh;
  }
  buckets.forEach((b, i) => { if (b.length) g.add(mesh(mergeGeometries(b), M.glass[i])); });
  g.add(box(w, h, 0.12, M.gunmetal, 0, 0, -0.02)); // leading
  if (glow) g.add(box(w - 0.2, h - 0.2, 0.05, new THREE.MeshStandardMaterial({ name: 'backlight', color: 0xffffff, emissive: 0xdfe8ff, emissiveIntensity: 0.25 }), 0, 0, -0.12));
  return g;
}

function grilleSlots(g, w, n, y0, z, M, pitch = 0.75) {
  for (let i = 0; i < n; i++) g.add(box(w, 0.32, 0.25, M.grille, 0, y0 + i * pitch, z));
}

// Hinged door: pivot at right edge (+X) like the DW-XL90's door. Local panel spans -X.
function hingedDoor(M, o, { W, H, x, y, z, skin, style }) {
  const pivot = named(new THREE.Group(), 'enclosure-door');
  pivot.position.set(x, y, z);
  const p = new THREE.Group(); p.position.x = -W / 2; pivot.add(p);
  p.add(rbox(W, H, 0.75, 0.3, skin, 0, 0, 0));
  grilleSlots(p, W - 4, 6, -H / 2 + 1.0, 0.42, M); // aligned with fridge's bottom-front vent
  p.add(strut([-W / 2 + 1.4, -6, 0.9], [-W / 2 + 1.4, 6, 0.9], 0.38, M.metal));
  if (style === 'mosaic') { const mo = mosaic(M, 13, 15, 77); mo.position.set(0, 3, 0.4); mo.rotation.z = Math.PI / 4; mo.scale.setScalar(0.85); p.add(mo); }
  if (style === 'stripes') { for (const [yy, hh, mt] of [[-H / 2 + 8.4, 0.6, M.metal], [-H / 2 + 9.85, 2.4, M.white], [-H / 2 + 11.3, 0.6, M.metal]]) p.add(box(W - 0.2, hh, 0.2, mt, 0, yy, 0.45)); }
  if (style === 'mirror') p.add(rbox(W - 3, H - 13, 0.2, 0.08, M.metal, 0, -0.5, 0.45));
  const lbl = labelPlane(o, W - 6, 3.2, { fg: '#ffffff' }); if (lbl) { lbl.position.set(0, H / 2 - 3, 0.42); p.add(lbl); }
  pivot.userData.setDoor = (t) => { pivot.rotation.y = t * 1.7; };
  return pivot;
}

// ======================================================================
// 1) SLIDING BASES (all deck tops at y = 3")
// ======================================================================
function baseRink(M) {
  const g = named(new THREE.Group(), 'base-rink-sled');
  g.add(rbox(34, 1.25, 34, 0.55, M.metal, 0, DECK_Y - 0.625, 0));
  for (const x of [-14, -5, 5, 14]) g.add(rbox(1.8, 1.75, 33, 0.8, M.uhmw, x, 0.875, 0)); // UHMW runners, radiused ends
  for (const s of [-1, 1]) g.add(box(8, 0.6, 0.4, M.grille, 0, DECK_Y - 0.65, s * 17.05)); // recessed hand pockets
  return g;
}
function basePuck(M) {
  const g = named(new THREE.Group(), 'base-puck');
  g.add(cyl(20, 19.2, 0.75, 96, M.uhmw, 0, 0.375, 0));          // beveled UHMW skid disc
  g.add(cyl(21, 21, 2.25, 96, M.rubber, 0, 0.75 + 1.125, 0));    // puck body (composite core, rubber skin)
  g.add(torus(21, 0.3, M.metal, DECK_Y - 0.05));
  g.add(torus(21.05, 0.12, M.led, 1.0));
  return g;
}
function baseOcta(M) {
  const g = named(new THREE.Group(), 'base-octa-skid');
  const r8 = (m) => { m.rotation.y = Math.PI / 8; return m; };
  g.add(r8(cyl(21.5, 20.8, 1, 8, M.uhmw, 0, 0.5, 0)));
  g.add(r8(cyl(22, 22, 2, 8, M.primary, 0, 2, 0)));
  g.add(r8(cyl(22.4, 22.4, 0.3, 8, M.metal, 0, DECK_Y - 0.15, 0)));
  return g;
}
function baseSki(M) {
  const g = named(new THREE.Group(), 'base-ski-sled');
  for (const x of [-13, 13]) {
    g.add(rbox(3, 1.25, 40, 0.6, M.uhmw, x, 0.625, -1));
    const tip = rbox(3, 1.25, 7, 0.6, M.uhmw, x, 1.6, 21); tip.rotation.x = -0.45; g.add(tip); // upturned tips glide over ruts
    for (const z of [-14, 0, 14]) g.add(cyl(0.6, 0.6, 0.6, 16, M.metal, x, 1.55, z));
    g.add(strut([x, 2.5, -19], [x, 2.5, 19], 0.55, M.metal));
  }
  g.add(rbox(32, 1.25, 32, 0.5, M.primary, 0, DECK_Y - 0.625, 0));
  return g;
}
function baseFloat(M) {
  const g = named(new THREE.Group(), 'base-floating-plinth');
  g.add(rbox(30, 1, 30, 0.45, M.uhmw, 0, 0.5, 0));                // recessed UHMW pad
  g.add(rbox(31, 0.25, 31, 0.1, M.led, 0, 0.98, 0));              // underglow
  g.add(rbox(36, 2, 36, 0.9, M.primary, 0, 2, 0));
  g.add(rbox(36.3, 0.35, 36.3, 0.15, M.metal, 0, 2.85, 0));
  return g;
}

// ======================================================================
// 2) FRIDGE ENCLOSURES (sleeves that drop over the freezer; y 3" → 39")
// ======================================================================
function encCathedral(M, o) {
  const g = named(new THREE.Group(), 'enclosure-cathedral'); const W = 28, D = 29, zc = 0.6, y0 = DECK_Y, H = ENC_H;
  const zf = zc + D / 2, zb = zc - D / 2;
  for (const sx of [-1, 1]) for (const zz of [zf - 0.8, zb + 0.8]) g.add(box(1.6, H, 1.6, M.metal, sx * (W / 2 - 0.8), y0 + H / 2, zz));
  g.add(rbox(W + 1.2, 1.6, D + 1.2, 0.5, M.metal, 0, y0 + H - 0.8, zc));
  const ph = 28.9, pyc = y0 + 2 + ph / 2;
  const sides = [[-Math.PI / 2, -W / 2 + 0.35, zc, D - 3.2], [Math.PI / 2, W / 2 - 0.35, zc, D - 3.2], [Math.PI, 0, zb + 0.35, W - 3.2]];
  sides.forEach(([ry, x, z, w], i) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
    if (M.skin) { s.add(mesh(new THREE.PlaneGeometry(w, ph), M.skin, 0, pyc, 0.2)); s.add(box(w, ph, 0.12, M.gunmetal, 0, pyc, -0.02)); }
    else { const mo = mosaic(M, w, ph, 11 + i * 7); mo.position.y = pyc; s.add(mo); }
    s.add(box(w, 2, 0.6, M.metal, 0, y0 + 1, 0));
    s.add(box(w, 3.5, 0.5, M.primary, 0, y0 + 30.9 + 1.75, 0));
    const l = labelPlane(o, w - 2, 2.8, { fg: '#ffffff' }); if (l) { l.position.set(0, y0 + 32.65, 0.27); s.add(l); }
  });
  const door = hingedDoor(M, o, { W: W - 3.4, H: 33.6, x: W / 2 - 1.6, y: y0 + 0.4 + 16.8, z: zf - 0.4, skin: M.primary, style: 'mosaic' });
  g.add(door); g.userData.setDoor = door.userData.setDoor;
  return g;
}
function encHalo(M, o) {
  const g = named(new THREE.Group(), 'enclosure-halo'); const R = 19, y0 = DECK_Y, H = ENC_H, a = 0.78;
  g.add(cyl(R, R, H, 96, M.skin || M.white, 0, y0 + H / 2, 0, true, a, Math.PI * 2 - 2 * a));
  g.add(cyl(R - 0.6, R - 0.6, H, 96, M.white, 0, y0 + H / 2, 0, true, a, Math.PI * 2 - 2 * a));
  g.add(cyl(R + 0.6, R + 0.6, 1.2, 96, M.metal, 0, y0 + H - 0.6, 0));
  g.add(torus(R + 0.05, 0.55, M.metal, y0 + 0.6));
  g.add(torus(R + 0.05, 0.35, M.metal, y0 + 30));
  g.add(labelBand(o, R + 0.06, 4, y0 + 32.6, a + 0.05, Math.PI * 2 - 2 * a - 0.1, { bg: '#' + M.primary.color.getHexString(), fg: '#ffffff', repeat: 3 })
     || cyl(R + 0.06, R + 0.06, 4, 96, M.primary, 0, y0 + 32.6, 0, true, a, Math.PI * 2 - 2 * a));
  // curved door, hinged at the right (+X) edge of the opening
  const hx = R * Math.sin(a), hz = R * Math.cos(a);
  const pivot = named(new THREE.Group(), 'enclosure-door'); pivot.position.set(hx, 0, hz); g.add(pivot);
  const d = new THREE.Group(); d.position.set(-hx, 0, -hz); pivot.add(d);
  d.add(cyl(R, R, H - 1.4, 96, M.primary, 0, y0 + (H - 1.4) / 2 + 0.1, 0, true, -a, 2 * a));
  for (let i = 0; i < 6; i++) d.add(cyl(R + 0.12, R + 0.12, 0.32, 48, M.grille, 0, y0 + 1.4 + i * 0.75, 0, true, -a + 0.1, 2 * a - 0.2));
  add(d, labelBand(o, R + 0.1, 3, y0 + 28, -a + 0.1, 2 * a - 0.2, { fg: '#ffffff' }));
  d.add(strut([-(R + 0.9) * Math.sin(a - 0.08), y0 + 12, (R + 0.9) * Math.cos(a - 0.08)], [-(R + 0.9) * Math.sin(a - 0.08), y0 + 24, (R + 0.9) * Math.cos(a - 0.08)], 0.38, M.metal));
  pivot.userData.setDoor = (t) => { pivot.rotation.y = t * 1.6; };
  g.userData.setDoor = pivot.userData.setDoor;
  return g;
}
function encPrism(M, o) {
  const g = named(new THREE.Group(), 'enclosure-prism'); const Rb = 21, Rt = 19.6, y0 = DECK_Y, H = ENC_H, yTop = y0 + H - 1.2;
  const vert = (k, R, y) => { const p = k * Math.PI / 4 + Math.PI / 8; return [R * Math.sin(p), y, R * Math.cos(p)]; };
  const door = named(new THREE.Group(), 'enclosure-door'); g.add(door);
  for (let k = 0; k < 8; k++) {
    const a = vert(k - 1, Rb, y0 + 0.8), b = vert(k, Rb, y0 + 0.8), c = vert(k, Rt, yTop), d = vert(k - 1, Rt, yTop);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2)); geo.computeVertexNormals();
    const isDoor = k === 0 || k === 1 || k === 7, parent = isDoor ? door : g;
    parent.add(mesh(geo, M.skin || M.acrylic));
    parent.add(strut(a, d, 0.45, M.metal));
    if (isDoor) { // vent slots on lower door faces
      const phi = k * Math.PI / 4, ri = Rb * Math.cos(Math.PI / 8) + 0.15, s = new THREE.Group();
      s.position.set(ri * Math.sin(phi), 0, ri * Math.cos(phi)); s.rotation.y = phi; parent.add(s);
      grilleSlots(s, 11, 5, y0 + 1.8, 0, M);
    }
    if (k === 2 || k === 6) { // brand on side faces
      const phi = k * Math.PI / 4, ri = (Rb + Rt) / 2 * Math.cos(Math.PI / 8) + 0.2;
      const l = labelPlane(o, 13, 2.6, { fg: '#ffffff' }); if (l) { l.position.set(ri * Math.sin(phi), y0 + 26, ri * Math.cos(phi)); l.rotation.y = phi; g.add(l); }
    }
  }
  // inner light-tight liner keeps the freezer hidden
  const liner = cyl(Rt - 0.8, Rb - 0.8, H - 2, 8, M.gunmetal, 0, y0 + H / 2, 0, true); liner.rotation.y = Math.PI / 8; g.add(liner);
  const cap = cyl(Rt + 0.6, Rt + 0.6, 1.2, 8, M.metal, 0, y0 + H - 0.6, 0); cap.rotation.y = Math.PI / 8; g.add(cap);
  const foot = cyl(Rb + 0.5, Rb + 0.5, 0.8, 8, M.metal, 0, y0 + 0.4, 0); foot.rotation.y = Math.PI / 8; g.add(foot);
  const ring = cyl(Rb + 0.2, Rb + 0.25, 0.3, 8, M.led, 0, y0 + 0.95, 0, true); ring.rotation.y = Math.PI / 8; g.add(ring);
  door.userData.setDoor = (t) => { door.position.z = t * 18; door.position.y = t * 0.8; }; // lift-off faceted front shell
  g.userData.setDoor = door.userData.setDoor;
  return g;
}
function encPuckTower(M, o) {
  const g = named(new THREE.Group(), 'enclosure-puck-tower'); const W = 29, D = 30, zc = 0.5, y0 = DECK_Y, H = ENC_H;
  const zf = zc + D / 2, zb = zc - D / 2;
  for (const s of [-1, 1]) g.add(rbox(2.5, H, D, 1.1, M.skin || M.primary, s * (W / 2 - 1.25), y0 + H / 2, zc));
  g.add(rbox(W, H, 2.5, 1.1, M.skin || M.primary, 0, y0 + H / 2, zb + 1.25));
  g.add(rbox(W, 2.5, D, 1.1, M.primary, 0, y0 + H - 1.25, zc));
  const stripes = [[8.4, 0.6, M.metal], [9.85, 2.4, M.white], [11.3, 0.6, M.metal]];
  for (const [yy, hh, mt] of stripes) {
    for (const s of [-1, 1]) g.add(box(0.2, hh, D - 2, mt, s * (W / 2 + 0.05), y0 + yy, zc));
    g.add(box(W - 2, hh, 0.2, mt, 0, y0 + yy, zb - 0.05));
  }
  for (const s of [-1, 1]) { const l = labelPlane(o, 24, 4.4, { fg: '#ffffff' }); if (l) { l.position.set(s * (W / 2 + 0.12), y0 + 24, zc); l.rotation.y = s * Math.PI / 2; g.add(l); } }
  const door = hingedDoor(M, o, { W: W - 5.2, H: 33.2, x: W / 2 - 2.5, y: y0 + 0.3 + 16.6, z: zf - 0.45, skin: M.primary, style: 'stripes' });
  g.add(door); g.userData.setDoor = door.userData.setDoor;
  return g;
}
function encMonolith(M, o) {
  const g = named(new THREE.Group(), 'enclosure-monolith'); const W = 28, D = 29, zc = 0.6, y0 = DECK_Y, H = ENC_H;
  const zf = zc + D / 2, zb = zc - D / 2;
  for (const s of [-1, 1]) g.add(box(0.75, H, D, M.white, s * (W / 2 - 0.375), y0 + H / 2, zc));
  g.add(box(W, H, 0.75, M.white, 0, y0 + H / 2, zb + 0.375));
  g.add(box(W + 0.4, 1.5, D + 0.4, M.metal, 0, y0 + H - 0.75, zc));
  for (const s of [-1, 1]) {
    g.add(box(0.5, H - 1.5, 0.5, M.metal, s * (W / 2 + 0.25), y0 + (H - 1.5) / 2, zf - 0.25));
    g.add(box(0.5, H - 1.5, 0.5, M.metal, s * (W / 2 + 0.25), y0 + (H - 1.5) / 2, zb + 0.25));
    const panel = box(0.2, 26, D - 6, M.skin || M.primary, s * (W / 2 + 0.1), y0 + 16, zc); g.add(panel);
    const l = labelPlane(o, D - 9, 3.6, { fg: '#ffffff' }); if (l) { l.position.set(s * (W / 2 + 0.22), y0 + 16, zc); l.rotation.y = s * Math.PI / 2; l.rotation.z = 0; g.add(l); }
  }
  g.add(box(W - 2, 0.3, 0.3, M.led, 0, y0 + 0.3, zf - 0.1));
  const door = hingedDoor(M, o, { W: W - 1.6, H: 34, x: W / 2 - 0.8, y: y0 + 0.5 + 17, z: zf - 0.38, skin: M.white, style: 'mirror' });
  g.add(door); g.userData.setDoor = door.userData.setDoor;
  return g;
}

// ======================================================================
// 3) CUPS (mount at y = 39"; local y = 0 at mount). userData.bowl drives beer + ice
// ======================================================================
const interp = (pts) => (y) => { // pts [[r,y]...] ascending y
  if (y <= pts[0][1]) return pts[0][0];
  for (let i = 1; i < pts.length; i++) if (y <= pts[i][1]) { const [r0, y0] = pts[i - 1], [r1, y1] = pts[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); }
  return pts[pts.length - 1][0];
};
function cupChalice(M, o) {
  const g = named(new THREE.Group(), 'cup-faceted-chalice');
  const mat = M.metal.clone(); mat.flatShading = true;
  g.add(lathe([[0, 0], [7, 0], [7, 0.8], [4.5, 1.5], [3, 3], [2.6, 7], [3.5, 8], [9, 8.6], [12.5, 11], [14, 15], [14.6, 17.5], [14.6, 18], [13.8, 18], [13.2, 15.5], [11.6, 12], [9, 9.8], [0, 9.8]], 10, mat, true));
  const band = M.glass[0].clone(); band.side = THREE.DoubleSide;
  g.add(lathe([[13.05, 12.2], [13.75, 14.4]], 10, band, true));
  g.add(torus(2.85, 0.28, M.led, 5));
  g.userData.bowl = { floor: 9.8, rim: 18, rAt: interp([[9, 9.8], [11.6, 12], [13.2, 15.5], [13.8, 18]]), ringR: 6.4, tilt: 0.2, ice: 5.8, iceLb: 22 };
  return g;
}
function cupChampion(M, o) {
  const g = named(new THREE.Group(), 'cup-champion-bowl');
  g.add(lathe([[0, 0], [8, 0], [8, 1.2], [6.5, 1.6], [6.5, 3], [5, 3.4], [5, 5], [3.2, 5.6], [2.8, 8], [4, 9], [10, 9.6], [13.5, 12], [15, 16], [15.4, 18.5], [14.6, 18.5], [14.2, 16.2], [12.8, 12.6], [9.5, 10.6], [0, 10.6]], 96, M.metal));
  for (const y of [1.4, 3.2]) g.add(torus(y < 2 ? 7.9 : 6.4, 0.25, M.primary, y));
  for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(4, 0.7, 16, 40, Math.PI), M.metal, s * 14.6, 14, 0); h.rotation.z = -s * Math.PI / 2; g.add(h); }
  add(g, labelBand(o, 6.58, 1.2, 2.3, 0, Math.PI * 2, { fg: '#ffffff', bg: '#' + M.primary.color.getHexString(), repeat: 2 }));
  g.userData.bowl = { floor: 10.6, rim: 18.5, rAt: interp([[9.5, 10.6], [12.8, 12.6], [14.2, 16.2], [14.6, 18.5]]), ringR: 6.4, tilt: 0.2, ice: 5.6, iceLb: 22 };
  return g;
}
function cupHex(M, o) {
  const g = named(new THREE.Group(), 'cup-hex-prism');
  g.add(cyl(8.5, 9, 1, 6, M.metal, 0, 0.5, 0));
  g.add(cyl(3, 4.2, 8, 6, M.metal, 0, 5, 0));
  g.add(cyl(3.05, 3.05, 0.4, 6, M.led, 0, 8.4, 0));
  g.add(cyl(17, 11, 9.8, 6, M.iridescent, 0, 9 + 4.9, 0, true));
  g.add(lathe([[0, 9], [9.4, 9], [14.6, 18.6], [14.2, 18.6], [9, 9.9], [0, 9.9]], 64, M.metal)); // stainless liner (holds ice + melt)
  const rim = mesh(new THREE.TorusGeometry(17, 0.35, 12, 6), M.metal, 0, 18.75, 0); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 6; g.add(rim);
  g.userData.bowl = { floor: 9.9, rim: 18.6, rAt: interp([[9, 9.9], [14.2, 18.4]]), ringR: 6.4, tilt: 0.22, ice: 5.8, iceLb: 20 };
  return g;
}
function cupPuckStack(M, o) {
  const g = named(new THREE.Group(), 'cup-puck-stack');
  g.add(cyl(9, 9.5, 1, 64, M.metal, 0, 0.5, 0));
  for (let i = 0; i < 3; i++) { g.add(cyl(4, 4, 1.8, 64, M.rubber, 0, 1 + i * 2 + 0.9, 0)); g.add(cyl(3.2, 3.2, 0.2, 48, M.metal, 0, 1 + i * 2 + 1.9, 0)); }
  g.add(lathe([[0, 7], [6, 7], [15, 7.6], [16.2, 9], [16.4, 16.4], [16.8, 17], [15.4, 17], [15.2, 16], [15, 9.8], [0, 9.8]], 96, M.primary));
  g.add(torus(16.1, 0.45, M.metal, 17));
  g.add(torus(16.25, 0.2, M.metal, 9.2));
  add(g, labelBand(o, 16.45, 3.2, 12.8, 0, Math.PI * 2, { fg: '#ffffff', repeat: 3 }));
  g.userData.bowl = { floor: 9.8, rim: 17, rAt: interp([[15, 9.8], [15.2, 16]]), ringR: 6.6, tilt: 0.12, ice: 5.4, iceLb: 26 };
  return g;
}
function cupTorch(M, o) {
  const g = named(new THREE.Group(), 'cup-ultra-torch');
  g.add(lathe([[0, 0], [6, 0], [6, 0.8], [2.2, 1.6], [1.8, 10], [3, 11], [8, 11.5], [15.5, 19], [16, 20], [15.2, 20], [14.8, 19.2], [7.6, 12.4], [0, 12.4]], 96, M.primary));
  g.add(cyl(2.3, 2.3, 4, 48, M.metal, 0, 6, 0));
  g.add(torus(15.6, 0.4, M.metal, 20));
  g.add(torus(3.05, 0.25, M.led, 11));
  g.userData.bowl = { floor: 12.4, rim: 20, rAt: interp([[7.6, 12.4], [14.8, 19.2]]), ringR: 5.8, tilt: 0.26, ice: 5.8, iceLb: 18 };
  return g;
}

// Cup lathed from a reference silhouette. o.cupProfile = [[r, y], ...] outer profile, y ascending from 0.
export const DEFAULT_PROFILE = [[8, 0], [8, 1], [3, 2], [2.6, 8], [4, 9], [10, 9.6], [13.5, 12], [15, 16], [15.4, 18.5]];
function cupCustom(M, o) {
  const g = named(new THREE.Group(), 'cup-from-reference');
  const prof = (o.cupProfile && o.cupProfile.length > 3 ? o.cupProfile : DEFAULT_PROFILE).map(([r, y]) => [Math.max(0.6, r), y]);
  const fac = o.facets | 0, faceted = fac >= 3, wall = 0.8;
  const top = prof[prof.length - 1][1], rAt = interp(prof);
  let floor = top - 8;
  while (floor < top - 5.5 && rAt(floor) - wall < 7.4) floor += 0.25; // raise floor until 12 bottles fit
  const innerFloor = Math.max(0.4, rAt(floor) - wall);
  const inner = prof.filter(([, y]) => y > floor).map(([r, y]) => [Math.max(0.4, r - wall), y]).reverse();
  const pts = [[0, prof[0][1]], ...prof, ...inner, [innerFloor, floor], [0, floor]];
  let mat = M.metal; if (faceted) { mat = M.metal.clone(); mat.flatShading = true; }
  g.add(lathe(pts, faceted ? fac : 96, mat, faceted));
  g.add(cyl(6, 6.4, 0.6, 48, M.metal, 0, 0.3, 0));                 // mount plate (twist-lock)
  const rimT = mesh(new THREE.TorusGeometry(prof[prof.length - 1][0] - wall / 2, 0.42, 12, faceted ? fac : 96), M.metal, 0, top, 0);
  rimT.rotation.x = Math.PI / 2; if (faceted) rimT.rotation.z = Math.PI / 2 - Math.PI / fac; g.add(rimT);
  const ringR = Math.max(5.1, Math.min(6.4, innerFloor - 1.5));
  g.userData.bowl = { floor, rim: top, rAt: (y) => rAt(y) - wall, ringR, tilt: 0.18, ice: Math.min(6, top - floor - 0.8), iceLb: 20 };
  g.userData.warn = innerFloor < ringR + 1.3 ? 'Bowl is narrow for 12 bottles — widen the top of the silhouette or crop the reference.' : null;
  return g;
}

// ---------- 12 beers + ice ----------
export function buildContents(M, bowl, { instanced = true, seed = 5 } = {}) {
  const g = named(new THREE.Group(), 'contents-12-beers-ice');
  const bottleGeo = new THREE.LatheGeometry([[0, 0], [1.2, 0], [1.22, 0.2], [1.22, 5.2], [1.1, 5.9], [0.6, 7], [0.5, 8.3], [0.55, 8.5], [0.55, 8.9], [0, 9]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  const labelGeo = new THREE.CylinderGeometry(1.24, 1.24, 2.4, 32, 1, true); labelGeo.translate(0, 3.6, 0);
  const stripeGeo = new THREE.CylinderGeometry(1.245, 1.245, 0.5, 32, 1, true); stripeGeo.translate(0, 3.2, 0);
  const foilGeo = new THREE.CylinderGeometry(0.57, 0.57, 1.2, 24); foilGeo.translate(0, 8.4, 0);
  const parts = [[bottleGeo, M.bottle], [labelGeo, M.labelWhite], [stripeGeo, M.labelBlue], [foilGeo, M.foil]];
  const mats = [];
  for (let i = 0; i < BEER.count; i++) {
    const a = (i / BEER.count) * Math.PI * 2, o3 = new THREE.Object3D();
    o3.position.set(bowl.ringR * Math.cos(a), bowl.floor + 0.05, bowl.ringR * Math.sin(a));
    o3.rotation.set(0, -a, 0); o3.rotateZ(-bowl.tilt); o3.updateMatrix(); mats.push(o3.matrix.clone());
  }
  for (const [geo, mat] of parts) {
    if (instanced) { const im = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; g.add(im); }
    else mats.forEach((m) => { const me = mesh(geo, mat); me.applyMatrix4(m); g.add(me); });
  }
  // ice cubes, avoiding bottles
  const r = rng(seed), top = bowl.floor + bowl.ice, cubes = [];
  for (let t = 0; t < 6000 && cubes.length < 340; t++) {
    const y = bowl.floor + 0.6 + r() * (top - bowl.floor - 0.6), rmax = bowl.rAt(y) - 0.75;
    const rr = Math.sqrt(r()) * rmax, a = r() * Math.PI * 2, x = rr * Math.cos(a), z = rr * Math.sin(a);
    const axR = bowl.ringR + (y - bowl.floor) * Math.tan(bowl.tilt);
    let ok = true;
    for (let i = 0; i < BEER.count && ok; i++) { const b = (i / BEER.count) * Math.PI * 2; if (Math.hypot(x - axR * Math.cos(b), z - axR * Math.sin(b)) < 1.85) ok = false; }
    for (const c of cubes) if (ok && c.distanceTo(new THREE.Vector3(x, y, z)) < 1.05) ok = false;
    if (ok) cubes.push(new THREE.Vector3(x, y, z));
  }
  const cubeGeo = instanced ? new RoundedBoxGeometry(1.15, 1.15, 1.15, 2, 0.18) : new THREE.BoxGeometry(1.1, 1.1, 1.1);
  const dummy = new THREE.Object3D(), cm = [];
  for (const c of cubes) { dummy.position.copy(c); dummy.rotation.set(r() * 3, r() * 3, r() * 3); dummy.scale.setScalar(0.85 + r() * 0.4); dummy.updateMatrix(); cm.push(dummy.matrix.clone()); }
  if (instanced) { const im = new THREE.InstancedMesh(cubeGeo, M.ice, cm.length); cm.forEach((m, i) => im.setMatrixAt(i, m)); g.add(im); }
  else { const geos = cm.map((m) => cubeGeo.clone().applyMatrix4(m)); g.add(mesh(mergeGeometries(geos), M.ice)); }
  return g;
}

// ---------- the freezer itself (reference volume) ----------
export function buildFridge(M) {
  const g = named(new THREE.Group(), 'meling-DW-XL90-reference'); const { w, d, h } = FRIDGE, y0 = DECK_Y;
  const body = new THREE.MeshStandardMaterial({ name: 'fridge-body', color: 0xf7f7f5, roughness: 0.5 });
  const glass = new THREE.MeshPhysicalMaterial({ name: 'fridge-door-glass', color: 0x9fb6c8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.6 });
  g.add(box(w, h - 0.8, d - 1.1, body, 0, y0 + 0.8 + (h - 0.8) / 2, -0.55));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.6, 0.6, 0.8, 16, M.gunmetal, sx * (w / 2 - 1.5), y0 + 0.4, sz * (d / 2 - 2)));
  g.add(box(w - 0.3, h - 5.2, 1.0, body, 0, y0 + 3.4 + (h - 5.2) / 2, d / 2 - 0.55));
  g.add(box(w - 5, h - 10, 0.2, glass, 0, y0 + 3.4 + (h - 5.2) / 2, d / 2 - 0.02));
  g.add(box(6, 1.6, 0.3, new THREE.MeshStandardMaterial({ name: 'fridge-display', color: 0x1a3d7a, emissive: 0x2a6fd6, emissiveIntensity: 0.6 }), 4, y0 + h - 1.1, d / 2 - 0.9));
  g.add(box(w - 2, 2.2, 0.3, M.grille, 0, y0 + 2, d / 2 - 0.9));
  return g;
}

// ======================================================================
// Catalog
// ======================================================================
export const BASES = [
  { id: 'rink', name: 'Rink Sled', build: baseRink, lb: 32, footprint: [34, 34], blurb: 'Polished aluminum deck on four radiused UHMW-PE runners. Recessed hand pockets.' },
  { id: 'puck', name: 'Puck', build: basePuck, lb: 38, footprint: [42, 42], blurb: 'Oversize puck: composite core, rubber skin, full beveled UHMW skid disc + LED edge.' },
  { id: 'octa', name: 'Octa Skid', build: baseOcta, lb: 34, footprint: [44, 44], blurb: 'Octagonal lacquered plinth on a chamfered UHMW skid ring; pairs with the Prism.' },
  { id: 'ski', name: 'Ski Sled', build: baseSki, lb: 28, footprint: [32, 47], blurb: 'Two UHMW skis with upturned tips + chrome rails — lightest, tracks straight.' },
  { id: 'float', name: 'Floating Plinth', build: baseFloat, lb: 34, footprint: [36, 36], blurb: 'Recessed UHMW pad + LED underglow so the trophy appears to hover on the ice.' },
];
export const ENCLOSURES = [
  { id: 'cathedral', name: 'Cathedral', build: encCathedral, lb: 44, clear: { side: 1.8, back: 1.0, front: 1.9, top: 2.4 }, blurb: 'Backlit faux stained-glass side walls (resin on acrylic) in a chrome frame.' },
  { id: 'halo', name: 'Halo', build: encHalo, lb: 30, clear: { side: 6.6, back: 6.1, front: 5.4, top: 2.4 }, blurb: 'Round gloss column with chrome rings, a wrap-around brand band and a curved door.' },
  { id: 'prism', name: 'Prism', build: encPrism, lb: 36, clear: { side: 6.4, back: 5.9, front: 5.9, top: 2.4 }, blurb: 'Tapered octagon of frosted iridescent acrylic; faceted front shell lifts off.' },
  { id: 'pucktower', name: 'Hat-Trick Tower', build: encPuckTower, lb: 34, clear: { side: 0.9, back: 1.0, front: 1.8, top: 1.5 }, blurb: 'Soft-cornered sleeve with jersey stripes and big side brand panels.' },
  { id: 'monolith', name: 'Monolith', build: encMonolith, lb: 30, clear: { side: 1.4, back: 1.0, front: 2.0, top: 2.5 }, blurb: 'Crisp ACM box, chrome fins, mirror door, full-height brand panels.' },
];
export const CUPS = [
  { id: 'chalice', name: 'Faceted Chalice', build: cupChalice, lb: 18, blurb: '10-facet spun-aluminum chalice with a stained-glass band.' },
  { id: 'champion', name: 'Champion Bowl', build: cupChampion, lb: 22, blurb: 'Classic tiered bowl with twin handles and a branded collar.' },
  { id: 'hex', name: 'Hex Prism', build: cupHex, lb: 20, blurb: 'Iridescent hex shell around a stainless ice liner.' },
  { id: 'puckstack', name: 'Puck Stack', build: cupPuckStack, lb: 24, blurb: 'Three stacked pucks support a wide branded ice bowl.' },
  { id: 'torch', name: 'Ultra Torch', build: cupTorch, lb: 16, blurb: 'Tall flared torch with an LED collar — the lightest cup.' },
  { id: 'custom', name: '★ From Reference', build: cupCustom, lb: 20, blurb: 'Lathed from the silhouette of a design reference (default profile until you pick one). Facet count applies here.' },
];
export const PRESETS = [
  { id: 'cathedral', name: '01 · Cathedral', base: 'rink', enc: 'cathedral', cup: 'chalice', metal: 'chrome', primary: '#0b1d3a', accent: '#3d7bd9' },
  { id: 'halo', name: '02 · Halo', base: 'puck', enc: 'halo', cup: 'champion', metal: 'gold', primary: '#0b1d3a', accent: '#c9a64a' },
  { id: 'prism', name: '03 · Prism', base: 'octa', enc: 'prism', cup: 'hex', metal: 'chrome', primary: '#11151d', accent: '#62c8ff' },
  { id: 'hattrick', name: '04 · Hat Trick', base: 'ski', enc: 'pucktower', cup: 'puckstack', metal: 'gold', primary: '#0a2a66', accent: '#d4af37' },
  { id: 'monolith', name: '05 · Monolith', base: 'float', enc: 'monolith', cup: 'torch', metal: 'chrome', primary: '#0b2a6b', accent: '#4aa3ff' },
];
export const byId = (list, id) => list.find((x) => x.id === id) || list[0];
