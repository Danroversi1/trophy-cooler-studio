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
    : new THREE.MeshPhysicalMaterial({ name: 'mirror-chrome', color: 0xeef1f5, metalness: 1, roughness: 0.09 });
  const M = {
    metal,
    gunmetal: new THREE.MeshPhysicalMaterial({ name: 'gunmetal', color: 0x23262c, metalness: 1, roughness: 0.32 }),
    primary: new THREE.MeshPhysicalMaterial({ name: 'lacquer-primary', color: o.primary, metalness: 0.05, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.25, sheenColor: 0x6f8cff }),
    white: new THREE.MeshPhysicalMaterial({ name: 'gloss-white', color: 0xeef1f5, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
    uhmw: new THREE.MeshPhysicalMaterial({ name: 'UHMW-PE', color: 0xe9e9e3, roughness: 0.62, sheen: 0.3, sheenColor: 0xffffff }),
    rubber: new THREE.MeshStandardMaterial({ name: 'vulcanized-rubber', color: 0x131417, roughness: 0.82 }),
    grille: new THREE.MeshStandardMaterial({ name: 'vent-grille', color: 0x0b0c0f, roughness: 0.55, metalness: 0.5 }),
    led: new THREE.MeshStandardMaterial({ name: 'LED', color: o.accent, emissive: o.accent, emissiveIntensity: 2.4 }),
    acrylic: new THREE.MeshPhysicalMaterial({ name: 'frosted-acrylic', color: o.accent, roughness: 0.5, transmission: 0.55, thickness: 0.5, ior: 1.49, iridescence: 0.55, iridescenceIOR: 1.3, side: THREE.DoubleSide }),
    iridescent: new THREE.MeshPhysicalMaterial({ name: 'iridescent-shell', color: 0xffffff, roughness: 0.04, transmission: 0.8, thickness: 0.8, ior: 1.5, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 900], side: THREE.DoubleSide }),
    ice: new THREE.MeshPhysicalMaterial({ name: 'ice', color: 0xf7fbff, roughness: 0.32, transmission: 0.45, thickness: 1.4, ior: 1.31, attenuationColor: 0xe4f1ff, attenuationDistance: 8, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: 0xffffff, sheenRoughness: 0.5 }),
    bottle: new THREE.MeshPhysicalMaterial({ name: 'bottle-glass', color: 0xffffff, roughness: 0.03, transmission: 0.98, thickness: 0.18, ior: 1.52, attenuationColor: 0xd8f0e4, attenuationDistance: 3, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02 }),
    labelWhite: new THREE.MeshStandardMaterial({ name: 'bottle-label', color: 0xffffff, roughness: 0.35 }),
    labelBlue: new THREE.MeshPhysicalMaterial({ name: 'bottle-neck-foil', color: 0x0b2d82, metalness: 0.6, roughness: 0.28, clearcoat: 1 }),
    foil: new THREE.MeshPhysicalMaterial({ name: 'neck-foil', color: 0xcfd6de, metalness: 1, roughness: 0.2 }),
  };
  // stained-glass palette around the accent hue
  const hsl = {}; new THREE.Color(o.accent).getHSL(hsl);
  const shifts = [[0, 0, 0], [0.02, 0.05, 0.16], [-0.03, -0.15, 0.3], [0.01, -0.85, 0.42], [0, -0.6, 0.22], [-0.02, 0.1, -0.14]]; // Michelob blues, whites, silver
  M.glass = shifts.map(([dh, ds, dl], i) => {
    const c = new THREE.Color().setHSL((hsl.h + dh + 1) % 1, clamp(hsl.s + ds), clamp(hsl.l + dl, 0.12, 0.92));
    return new THREE.MeshPhysicalMaterial({ name: 'stained-glass-' + i, color: c, roughness: 0.1, transmission: 0.35, thickness: 0.3, ior: 1.52, iridescence: 0.4, emissive: c, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  });
  if (o.palette && o.palette.length) M.glass = o.palette.slice(0, 6).map((hex, i) => {
    const c = new THREE.Color(hex);
    return new THREE.MeshPhysicalMaterial({ name: 'stained-glass-' + i, color: c, roughness: 0.1, transmission: 0.35, thickness: 0.3, ior: 1.52, iridescence: 0.4, emissive: c, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  });
  // "skin" = surface graphic from a design reference or the brand logo pattern
  const skinMat = (tex, name, metal = 0.05) => tex ? new THREE.MeshPhysicalMaterial({ name, map: tex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, metalness: metal, side: THREE.DoubleSide }) : null;
  const fin = (f) => ({
    chrome: () => new THREE.MeshPhysicalMaterial({ name: 'finish-chrome', color: 0xf3f5f8, metalness: 1, roughness: 0.05 }),
    gold: () => new THREE.MeshPhysicalMaterial({ name: 'finish-gold', color: 0xd9b45b, metalness: 1, roughness: 0.14 }),
    lacquer: () => M.primary,
    white: () => M.white,
    iridescent: () => M.iridescent,
    satin: () => new THREE.MeshPhysicalMaterial({ name: 'finish-satin-metal', color: 0xc9ced6, metalness: 1, roughness: 0.38 }),
  }[f] || (() => null))();
  M.skin = skinMat(o.skinTexture, 'skin-enclosure') || fin(o.encFinish);
  M.skinCup = skinMat(o.skinTextureCup, 'skin-cup', 0.35) || fin(o.cupFinish);
  M.skinBase = skinMat(o.skinTextureBase, 'skin-base') || fin(o.baseFinish);
  M.alu = new THREE.MeshPhysicalMaterial({ name: 'aluminum', color: 0xdfe6ee, metalness: 1, roughness: 0.22 });
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
function mosaic(M, w, h, seed, glow = true, tileK = 1) {
  const g = new THREE.Group(), r = rng(seed), buckets = M.glass.map(() => []);
  let y = -h / 2;
  while (y < h / 2 - 0.01) {
    let rh = (2.2 + r() * 3.2) * tileK; if (h / 2 - (y + rh) < 1.8) rh = h / 2 - y;
    let x = -w / 2;
    while (x < w / 2 - 0.01) {
      let cw = (2 + r() * 4.5) * tileK; if (w / 2 - (x + cw) < 1.6) cw = w / 2 - x;
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
  if (style === 'mosaic') { const mo = mosaic(M, 13, 15, 77); mo.position.set(0, 1, 0.4); mo.rotation.z = Math.PI / 4; mo.scale.setScalar(0.85); p.add(mo); }
  if (style === 'stripes') { for (const [yy, hh, mt] of [[-H / 2 + 8.4, 0.6, M.metal], [-H / 2 + 9.85, 2.4, M.white], [-H / 2 + 11.3, 0.6, M.metal]]) p.add(box(W - 0.2, hh, 0.2, mt, 0, yy, 0.45)); }
  if (style === 'mirror') p.add(rbox(W - 3, H - 15, 0.2, 0.08, M.metal, 0, -1.5, 0.45));
  const lbl = labelPlane(o, W - 4, 4.8, { fg: '#ffffff' }); if (lbl) { lbl.position.set(0, H / 2 - 3.6, 0.48); p.add(lbl); }
  pivot.userData.setDoor = (t) => { pivot.rotation.y = t * 1.7; };
  return pivot;
}

// ======================================================================
// 1) SLIDING BASES (all deck tops at y = 3")
// ======================================================================
function baseRink(M) {
  const g = named(new THREE.Group(), 'base-rink-sled');
  g.add(rbox(34, 1.25, 34, 0.55, M.skinBase || M.metal, 0, DECK_Y - 0.625, 0));
  for (const x of [-14, -5, 5, 14]) g.add(rbox(1.8, 1.75, 33, 0.8, M.uhmw, x, 0.875, 0)); // UHMW runners, radiused ends
  for (const s of [-1, 1]) g.add(box(8, 0.6, 0.4, M.grille, 0, DECK_Y - 0.65, s * 17.05)); // recessed hand pockets
  return g;
}
function basePuck(M) {
  const g = named(new THREE.Group(), 'base-puck');
  g.add(cyl(20, 19.2, 0.75, 96, M.uhmw, 0, 0.375, 0));          // beveled UHMW skid disc
  g.add(cyl(21, 21, 2.25, 96, M.skinBase || M.rubber, 0, 0.75 + 1.125, 0));    // puck body (composite core, rubber skin)
  g.add(torus(21, 0.3, M.metal, DECK_Y - 0.05));
  g.add(torus(21.05, 0.12, M.led, 1.0));
  return g;
}
function baseOcta(M) {
  const g = named(new THREE.Group(), 'base-octa-skid');
  const r8 = (m) => { m.rotation.y = Math.PI / 8; return m; };
  g.add(r8(cyl(21.5, 20.8, 1, 8, M.uhmw, 0, 0.5, 0)));
  g.add(r8(cyl(22, 22, 2, 8, M.skinBase || M.primary, 0, 2, 0)));
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
  g.add(rbox(32, 1.25, 32, 0.5, M.skinBase || M.primary, 0, DECK_Y - 0.625, 0));
  return g;
}
function baseFloat(M) {
  const g = named(new THREE.Group(), 'base-floating-plinth');
  g.add(rbox(30, 1, 30, 0.45, M.uhmw, 0, 0.5, 0));                // recessed UHMW pad
  g.add(rbox(31, 0.25, 31, 0.1, M.led, 0, 0.98, 0));              // underglow
  g.add(rbox(36, 2, 36, 0.9, M.skinBase || M.primary, 0, 2, 0));
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
  const ph = 26.6, pyc = y0 + 2 + ph / 2;
  const sides = [[-Math.PI / 2, -W / 2 + 0.35, zc, D - 3.2], [Math.PI / 2, W / 2 - 0.35, zc, D - 3.2], [Math.PI, 0, zb + 0.35, W - 3.2]];
  sides.forEach(([ry, x, z, w], i) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
    if (M.skin) { s.add(mesh(new THREE.PlaneGeometry(w, ph), M.skin, 0, pyc, 0.2)); s.add(box(w, ph, 0.12, M.gunmetal, 0, pyc, -0.02)); }
    else { const mo = mosaic(M, w, ph, 11 + i * 7, true, (o.encP && o.encP.tile) || 1); mo.position.y = pyc; s.add(mo); }
    s.add(box(w, 2, 0.6, M.metal, 0, y0 + 1, 0));
    s.add(box(w, 5.6, 0.5, M.primary, 0, y0 + 31.4, 0));
    const l = labelPlane(o, w - 1.2, 4.6, { fg: '#ffffff' }); if (l) { l.position.set(0, y0 + 31.4, 0.27); s.add(l); }
  });
  const door = hingedDoor(M, o, { W: W - 3.4, H: 33.6, x: W / 2 - 1.6, y: y0 + 0.4 + 16.8, z: zf - 0.4, skin: M.primary, style: 'mosaic' });
  g.add(door); g.userData.setDoor = door.userData.setDoor;
  return g;
}
function encHalo(M, o) {
  const g = named(new THREE.Group(), 'enclosure-halo'); const R = 19, y0 = DECK_Y, H = ENC_H, a = 0.78;
  g.add(cyl(R, R, H, 96, M.skin || M.primary, 0, y0 + H / 2, 0, true, a, Math.PI * 2 - 2 * a));
  g.add(cyl(R - 0.6, R - 0.6, H, 96, M.primary, 0, y0 + H / 2, 0, true, a, Math.PI * 2 - 2 * a));
  g.add(cyl(R + 0.6, R + 0.6, 1.2, 96, M.metal, 0, y0 + H - 0.6, 0));
  g.add(torus(R + 0.05, 0.55, M.metal, y0 + 0.6));
  g.add(torus(R + 0.05, 0.35, M.metal, y0 + 28.7)); g.add(torus(R + 0.05, 0.35, M.metal, y0 + 21.3));
  g.add(labelBand(o, R + 0.06, 7, y0 + 25, a + 0.05, Math.PI * 2 - 2 * a - 0.1, { bg: '#f3f5f8', fg: '#' + M.primary.color.getHexString(), repeat: 2 })
     || cyl(R + 0.06, R + 0.06, 7, 96, M.white, 0, y0 + 25, 0, true, a, Math.PI * 2 - 2 * a));
  // curved door, hinged at the right (+X) edge of the opening
  const hx = R * Math.sin(a), hz = R * Math.cos(a);
  const pivot = named(new THREE.Group(), 'enclosure-door'); pivot.position.set(hx, 0, hz); g.add(pivot);
  const d = new THREE.Group(); d.position.set(-hx, 0, -hz); pivot.add(d);
  d.add(cyl(R, R, H - 1.4, 96, M.primary, 0, y0 + (H - 1.4) / 2 + 0.1, 0, true, -a, 2 * a));
  for (let i = 0; i < 6; i++) d.add(cyl(R + 0.12, R + 0.12, 0.32, 48, M.grille, 0, y0 + 1.4 + i * 0.75, 0, true, -a + 0.1, 2 * a - 0.2));
  add(d, labelBand(o, R + 0.1, 5, y0 + 25, -a + 0.1, 2 * a - 0.2, { fg: '#ffffff' }));
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
      const l = labelPlane(o, 15.5, 4.4, { fg: '#ffffff' }); if (l) { l.position.set(ri * Math.sin(phi), y0 + 25, ri * Math.cos(phi)); l.rotation.y = phi; g.add(l); }
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
  for (const s of [-1, 1]) { const l = labelPlane(o, 26, 7.2, { fg: '#ffffff' }); if (l) { l.position.set(s * (W / 2 + 0.12), y0 + 23.5, zc); l.rotation.y = s * Math.PI / 2; g.add(l); } }
  const door = hingedDoor(M, o, { W: W - 5.2, H: 33.2, x: W / 2 - 2.5, y: y0 + 0.3 + 16.6, z: zf - 0.45, skin: M.primary, style: 'stripes' });
  g.add(door); g.userData.setDoor = door.userData.setDoor;
  return g;
}
function encMonolith(M, o) {
  const g = named(new THREE.Group(), 'enclosure-monolith'); const W = 28, D = 29, zc = 0.6, y0 = DECK_Y, H = ENC_H;
  const zf = zc + D / 2, zb = zc - D / 2;
  for (const s of [-1, 1]) g.add(box(0.75, H, D, M.primary, s * (W / 2 - 0.375), y0 + H / 2, zc));
  g.add(box(W, H, 0.75, M.primary, 0, y0 + H / 2, zb + 0.375));
  g.add(box(W + 0.4, 1.5, D + 0.4, M.metal, 0, y0 + H - 0.75, zc));
  for (const s of [-1, 1]) {
    g.add(box(0.5, H - 1.5, 0.5, M.metal, s * (W / 2 + 0.25), y0 + (H - 1.5) / 2, zf - 0.25));
    g.add(box(0.5, H - 1.5, 0.5, M.metal, s * (W / 2 + 0.25), y0 + (H - 1.5) / 2, zb + 0.25));
    const panel = box(0.2, 26, D - 6, M.skin || M.white, s * (W / 2 + 0.1), y0 + 16, zc); g.add(panel);
    const l = labelPlane(o, D - 8, 8, { fg: '#' + M.primary.color.getHexString() }); if (l) { l.position.set(s * (W / 2 + 0.22), y0 + 16, zc); l.rotation.y = s * Math.PI / 2; l.rotation.z = 0; g.add(l); }
  }
  g.add(box(W - 2, 0.3, 0.3, M.led, 0, y0 + 0.3, zf - 0.1));
  const door = hingedDoor(M, o, { W: W - 1.6, H: 34, x: W / 2 - 0.8, y: y0 + 0.5 + 17, z: zf - 0.38, skin: M.primary, style: 'mirror' });
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
  const mat = (M.skinCup || M.metal).clone(); mat.flatShading = true;
  g.add(lathe([[0, 0], [7, 0], [7, 0.8], [4.5, 1.5], [3, 3], [2.6, 7], [3.5, 8], [9, 8.6], [12.5, 11], [14, 15], [14.6, 17.5], [14.6, 18], [13.8, 18], [13.2, 15.5], [11.6, 12], [9, 9.8], [0, 9.8]], 10, mat, true));
  const band = M.glass[0].clone(); band.side = THREE.DoubleSide;
  g.add(lathe([[13.05, 12.2], [13.75, 14.4]], 10, band, true));
  g.add(torus(2.85, 0.28, M.led, 5));
  g.userData.bowl = { floor: 9.8, rim: 18, rAt: interp([[9, 9.8], [11.6, 12], [13.2, 15.5], [13.8, 18]]), ringR: 6.4, tilt: 0.2, ice: 5.8, iceLb: 22 };
  return g;
}
function cupChampion(M, o) {
  const g = named(new THREE.Group(), 'cup-champion-bowl');
  g.add(lathe([[0, 0], [8, 0], [8, 1.2], [6.5, 1.6], [6.5, 3], [5, 3.4], [5, 5], [3.2, 5.6], [2.8, 8], [4, 9], [10, 9.6], [13.5, 12], [15, 16], [15.4, 18.5], [14.6, 18.5], [14.2, 16.2], [12.8, 12.6], [9.5, 10.6], [0, 10.6]], 96, M.skinCup || M.metal));
  for (const y of [1.4, 3.2]) g.add(torus(y < 2 ? 7.9 : 6.4, 0.25, M.primary, y));
  for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(4, 0.7, 16, 40, Math.PI), M.metal, s * 14.6, 14, 0); h.rotation.z = -s * Math.PI / 2; g.add(h); }
  add(g, labelBand(o, 6.58, 1.5, 2.3, 0, Math.PI * 2, { fg: '#ffffff', bg: '#' + M.primary.color.getHexString(), repeat: 2 }));
  g.userData.bowl = { floor: 10.6, rim: 18.5, rAt: interp([[9.5, 10.6], [12.8, 12.6], [14.2, 16.2], [14.6, 18.5]]), ringR: 6.4, tilt: 0.2, ice: 5.6, iceLb: 22 };
  return g;
}
function cupHex(M, o) {
  const g = named(new THREE.Group(), 'cup-hex-prism');
  g.add(cyl(8.5, 9, 1, 6, M.metal, 0, 0.5, 0));
  g.add(cyl(3, 4.2, 8, 6, M.metal, 0, 5, 0));
  g.add(cyl(3.05, 3.05, 0.4, 6, M.led, 0, 8.4, 0));
  g.add(cyl(17, 11, 9.8, 6, M.skinCup || M.iridescent, 0, 9 + 4.9, 0, true));
  g.add(lathe([[0, 9], [9.4, 9], [14.6, 18.6], [14.2, 18.6], [9, 9.9], [0, 9.9]], 64, M.metal)); // stainless liner (holds ice + melt)
  const rim = mesh(new THREE.TorusGeometry(17, 0.35, 12, 6), M.metal, 0, 18.75, 0); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 6; g.add(rim);
  g.userData.bowl = { floor: 9.9, rim: 18.6, rAt: interp([[9, 9.9], [14.2, 18.4]]), ringR: 6.4, tilt: 0.22, ice: 5.8, iceLb: 20 };
  return g;
}
function cupPuckStack(M, o) {
  const g = named(new THREE.Group(), 'cup-puck-stack');
  g.add(cyl(9, 9.5, 1, 64, M.metal, 0, 0.5, 0));
  for (let i = 0; i < 3; i++) { g.add(cyl(4, 4, 1.8, 64, M.rubber, 0, 1 + i * 2 + 0.9, 0)); g.add(cyl(3.2, 3.2, 0.2, 48, M.metal, 0, 1 + i * 2 + 1.9, 0)); }
  g.add(lathe([[0, 7], [6, 7], [15, 7.6], [16.2, 9], [16.4, 16.4], [16.8, 17], [15.4, 17], [15.2, 16], [15, 9.8], [0, 9.8]], 96, M.skinCup || M.primary));
  g.add(torus(16.1, 0.45, M.metal, 17));
  g.add(torus(16.25, 0.2, M.metal, 9.2));
  add(g, labelBand(o, 16.45, 4.8, 12.8, 0, Math.PI * 2, { fg: '#ffffff', repeat: 3 }));
  g.userData.bowl = { floor: 9.8, rim: 17, rAt: interp([[15, 9.8], [15.2, 16]]), ringR: 6.6, tilt: 0.12, ice: 5.4, iceLb: 26 };
  return g;
}
function cupTorch(M, o) {
  const g = named(new THREE.Group(), 'cup-ultra-torch');
  g.add(lathe([[0, 0], [6, 0], [6, 0.8], [2.2, 1.6], [1.8, 10], [3, 11], [8, 11.5], [15.5, 19], [16, 20], [15.2, 20], [14.8, 19.2], [7.6, 12.4], [0, 12.4]], 96, M.skinCup || M.primary));
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
  let mat = M.skinCup || M.metal; if (faceted) { mat = mat.clone(); mat.flatShading = true; }
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
// Bottles sit high in a heaped ice bed so their branded labels clear the rim.
export const BEERS = [
  { id: 'longneck', name: 'Michelob ULTRA 12 oz bottle', lbEach: 1.2, glass: true, label: [1.6, 4.6], neck: [6.55, 7.75], blurb: 'Clear long-neck with the white ULTRA wrap label and blue neck band.',
    profile: [[0, 0], [1.16, 0], [1.2, 0.12], [1.2, 5.1], [1.12, 5.75], [0.74, 6.6], [0.56, 7.7], [0.52, 8.55], [0.56, 8.68], [0.56, 9.05], [0, 9.1]], cap: [0.575, 8.62, 0.48] },
  { id: 'alubottle', name: 'Michelob ULTRA 16 oz aluminum bottle', lbEach: 1.15, glass: false, label: [0.5, 4.2], blurb: 'Brushed aluminum bottle with a full-body printed wrap.',
    profile: [[0, 0], [1.3, 0], [1.32, 0.15], [1.32, 4.3], [1.1, 5.3], [0.62, 6.4], [0.55, 7.0], [0.6, 7.1], [0, 7.25]], cap: [0.6, 6.98, 0.3] },
  { id: 'can', name: 'Michelob ULTRA 12 oz can', lbEach: 0.85, glass: false, label: [0.45, 4.4], blurb: 'Standard 12 oz can; the whole body is the brand wrap.',
    profile: [[0, 0], [1.05, 0], [1.3, 0.35], [1.3, 4.45], [1.08, 4.75], [1.1, 4.83], [0, 4.83]], cap: null },
  { id: 'custom', name: '★ From reference', lbEach: 1.2, glass: true, label: null, blurb: 'Lathed from a bottle silhouette in your references (default long-neck until you pick one).', profile: null, cap: null },
];
export function buildContents(M, bowl, { instanced = true, seed = 5, beer = {}, o = {}, arrangement = 'ring', tilt: tiltIn = 0.2, heap = 1.0 } = {}) {
  const g = named(new THREE.Group(), 'contents-12-beers-ice');
  const T = BEERS.find((b) => b.id === beer.type) || BEERS[0];
  const prof = T.id === 'custom' ? (beer.profile && beer.profile.length > 3 ? beer.profile : BEERS[0].profile) : T.profile;
  const H = prof[prof.length - 1][1], rP = interp(prof), [l0, l1] = T.label || [H * 0.3, H * 0.56];
  let lr = 0; for (let y = l0; y <= l1; y += (l1 - l0) / 8) lr = Math.max(lr, rP(y)); lr += 0.025;
  const parts = [[new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32), T.glass ? M.bottle : M.alu]];
  const labelGeo = new THREE.CylinderGeometry(lr, lr, l1 - l0, 40, 1, true); labelGeo.translate(0, (l0 + l1) / 2, 0);
  let lmat = M.labelWhite;
  if (beer.labelTexture) { // reference art: front + back panels
    const t = beer.labelTexture; t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); t.offset.set(0, 0);
    lmat = new THREE.MeshStandardMaterial({ name: 'bottle-label-ref', map: t, roughness: 0.35, metalness: T.glass ? 0 : 0.3 });
  } else {
    const m = labelMat(o, (2 * Math.PI * lr) / (l1 - l0), { bg: '#ffffff', fg: '#0b2a6b' });
    if (m) { m.map.wrapS = THREE.RepeatWrapping; m.map.offset.x = 0.25; m.metalness = T.glass ? 0 : 0.3; m.name = 'bottle-label-brand'; lmat = m; } // label faces outward
  }
  parts.push([labelGeo, lmat]);
  if (T.cap) { const [cr, cy, ch] = T.cap, cg = new THREE.CylinderGeometry(cr, cr, ch, 24); cg.translate(0, cy + ch / 2, 0); parts.push([cg, M.foil]); }
  if (T.neck) { const [n0, n1] = T.neck, ng = new THREE.CylinderGeometry(rP(n1) + 0.02, rP(n0) + 0.02, n1 - n0, 32, 1, true); ng.translate(0, (n0 + n1) / 2, 0); parts.push([ng, M.labelBlue]); }
  // placement: label bottom ~ at the rim, ring as close to the wall as the bowl allows
  const tilt = tiltIn, baseY = Math.max(bowl.floor + 0.05, bowl.rim - (l0 + (l1 - l0) * 0.25));
  // ring radius: as close to the wall as the bowl allows at every height the bottle is inside it
  let ringR = 9;
  for (let h = 0; baseY + h <= bowl.rim && h <= H; h += 0.25) ringR = Math.min(ringR, bowl.rAt(baseY + h) - 0.35 - rP(h) - h * Math.tan(tilt));
  ringR = Math.max(5.3, ringR); const rimR = bowl.rAt(bowl.rim);
  // arrangement of the 12: one ring, 8 + 4 double ring (inner raised), or a staggered bouquet
  const slots = [];
  if (arrangement === 'double' && ringR > 6.2) {
    for (let i = 0; i < 8; i++) slots.push([ringR, (i / 8) * Math.PI * 2, 0, tilt]);
    for (let i = 0; i < 4; i++) slots.push([Math.max(1.6, ringR - 3.4), (i / 4) * Math.PI * 2 + Math.PI / 4, 1.6, tilt * 0.4]);
  } else for (let i = 0; i < BEER.count; i++) {
    const bq = arrangement === 'bouquet', odd = i % 2;
    slots.push([ringR - (bq && odd ? 0.4 : 0), (i / BEER.count) * Math.PI * 2, bq ? (odd ? 1.4 : -0.3) : 0, bq ? (odd ? tilt * 0.6 : tilt * 1.35) : tilt]);
  }
  const mats = [], axes = [];
  for (const [rr0, a, dy, t] of slots) {
    const o3 = new THREE.Object3D(); o3.position.set(rr0 * Math.cos(a), baseY + dy, rr0 * Math.sin(a));
    o3.rotation.set(0, -a, 0); o3.rotateZ(-t); o3.updateMatrix(); mats.push(o3.matrix.clone()); axes.push([rr0, a, baseY + dy, t]);
  }
  for (const [geo, mat] of parts) {
    if (instanced) { const im = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; g.add(im); }
    else mats.forEach((m) => { const me = mesh(geo, mat); me.applyMatrix4(m); g.add(me); });
  }
  // heaped ice: fills the bowl to the rim and mounds above it
  const r = rng(seed), yTop = bowl.rim + heap, cubes = [], cell = new Map(), key = (x, y, z) => `${Math.floor(x / 1.1)},${Math.floor(y / 1.1)},${Math.floor(z / 1.1)}`;
  const near = (v) => { const [cx, cy, cz] = key(v.x, v.y, v.z).split(',').map(Number); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) for (const c of cell.get(`${cx + i},${cy + j},${cz + k}`) || []) if (c.distanceTo(v) < 1.02) return true; return false; };
  for (let t = 0; t < 34000 && cubes.length < 520 + heap * 260; t++) {
    const y = bowl.floor + 0.6 + r() * (yTop - bowl.floor - 0.6);
    const rmax = y <= bowl.rim ? bowl.rAt(y) - 0.7 : (rimR - 0.9) * (1 - (y - bowl.rim) / (heap * 1.6 + 0.01));
    if (rmax <= 0.3) continue;
    const rr = Math.sqrt(r()) * rmax, a = r() * Math.PI * 2, v = new THREE.Vector3(rr * Math.cos(a), y, rr * Math.sin(a));
    { let hit = false;
      for (const [rr0, b, by, t] of axes) { const h = y - by; if (h < 0 || hit) continue; const axR = rr0 + h * Math.tan(t); if (Math.hypot(v.x - axR * Math.cos(b), v.z - axR * Math.sin(b)) < rP(Math.min(H, h)) + 0.55) hit = true; }
      if (hit) continue; }
    if (near(v)) continue;
    cubes.push(v); const k2 = key(v.x, v.y, v.z); (cell.get(k2) || cell.set(k2, []).get(k2)).push(v);
  }
  const cubeGeo = instanced ? new RoundedBoxGeometry(1.15, 1.15, 1.15, 2, 0.18) : new THREE.BoxGeometry(1.1, 1.1, 1.1);
  const dummy = new THREE.Object3D(), cm = [];
  for (const c of cubes) { dummy.position.copy(c); dummy.rotation.set(r() * 3, r() * 3, r() * 3); dummy.scale.setScalar(0.85 + r() * 0.4); dummy.updateMatrix(); cm.push(dummy.matrix.clone()); }
  if (instanced) { const im = new THREE.InstancedMesh(cubeGeo, M.ice, cm.length); cm.forEach((m, i) => im.setMatrixAt(i, m)); im.receiveShadow = true; g.add(im); }
  else { const geos = cm.map((m) => cubeGeo.clone().applyMatrix4(m)); g.add(mesh(mergeGeometries(geos), M.ice)); }
  g.userData.top = Math.max(...axes.map(([, , by, t]) => by + H * Math.cos(t))); g.userData.lbEach = T.lbEach; g.userData.ringR = ringR; g.userData.baseY = baseY;
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
// Section parameters — each section is edited without touching the others.
// The cup mounts at CUP_Y, the enclosure is always 36" tall and the sled deck is always 3",
// so a change to one section never moves the rest of the assembly.
export const SECTION_PARAMS = {
  cup: { width: [0.8, 1.3, 1], height: [0.8, 1.35, 1], flare: [-0.15, 0.35, 0], neck: [0.6, 1.6, 1], tilt: [0.05, 0.35, 0.2], heap: [0, 2.5, 1] },
  enc: { width: [1, 1.25, 1], depth: [1, 1.25, 1], tile: [0.6, 1.8, 1] },
  base: { footprint: [1, 1.4, 1] },
};
export const FINISHES = ['concept', 'chrome', 'gold', 'satin', 'lacquer', 'white', 'iridescent'];
export const ARRANGEMENTS = ['ring', 'double', 'bouquet'];
// Deform a built cup (group-local space): neck stretch, width, height, rim flare. Updates the bowl data too.
export function shapeCup(g, P = {}) {
  const w = P.width ?? 1, h = P.height ?? 1, flare = P.flare ?? 0, neck = P.neck ?? 1, b = g.userData.bowl;
  if (w === 1 && h === 1 && !flare && neck === 1) return g;
  const yb = b.floor - 1.0, top = b.rim;
  const mapY = (y) => (y < yb ? y * neck : yb * neck + (y - yb)) * h;
  const fy = (y) => { const t = Math.min(1, Math.max(0, (y - b.floor) / (top - b.floor))); return 1 + flare * t * t; };
  g.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), v = new THREE.Vector3();
  g.traverse((m) => {
    if (!m.isMesh) return; const toG = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), back = toG.clone().invert();
    m.geometry = m.geometry.clone(); const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(toG); const k = w * fy(v.y); v.set(v.x * k, mapY(v.y), v.z * k).applyMatrix4(back); pos.setXYZ(i, v.x, v.y, v.z); }
    pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
  });
  const rAt0 = b.rAt, floor = mapY(b.floor), rim = mapY(b.rim), inv1 = (y) => { const y0 = y / h; return y0 < yb * neck ? y0 / neck : y0 - yb * neck + yb; };
  g.userData.bowl = { ...b, floor, rim, rAt: (y) => rAt0(inv1(y)) * w * fy(inv1(y)), ringR: b.ringR * w };
  return g;
}
export function setLeds(g, on) { g.traverse((m) => { if (m.isMesh && m.material && m.material.name === 'LED') m.visible = on; }); }
// Capacity / fit check for the cup: 12 bottles plus ice must fit inside the bowl.
export function checkCup(bowl, contents) {
  const out = []; const innerAtBase = bowl.rAt(contents.userData.baseY);
  if (innerAtBase < contents.userData.ringR + 1.3) out.push('Bowl is tight for 12 bottles at this width — widen the bowl or reduce flare inward.');
  if (bowl.rAt(bowl.rim) * 2 > 40) out.push('Rim is over 40″ across — wider than any base; check stability.');
  return out;
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
  { id: 'cathedral', outer: [29.2, 30.2], name: 'Cathedral', build: encCathedral, lb: 44, clear: { side: 1.8, back: 1.0, front: 1.9, top: 2.4 }, blurb: 'Backlit faux stained-glass side walls (resin on acrylic) in a chrome frame.' },
  { id: 'halo', outer: [39.2, 39.2], name: 'Halo', build: encHalo, lb: 30, clear: { side: 6.6, back: 6.1, front: 5.4, top: 2.4 }, blurb: 'Round gloss column with chrome rings, a wrap-around brand band and a curved door.' },
  { id: 'prism', outer: [43.4, 43.4], name: 'Prism', build: encPrism, lb: 36, clear: { side: 6.4, back: 5.9, front: 5.9, top: 2.4 }, blurb: 'Tapered octagon of frosted iridescent acrylic; faceted front shell lifts off.' },
  { id: 'pucktower', outer: [29, 30], name: 'Hat-Trick Tower', build: encPuckTower, lb: 34, clear: { side: 0.9, back: 1.0, front: 1.8, top: 1.5 }, blurb: 'Soft-cornered sleeve with jersey stripes and big side brand panels.' },
  { id: 'monolith', outer: [28.4, 29.4], name: 'Monolith', build: encMonolith, lb: 30, clear: { side: 1.4, back: 1.0, front: 2.0, top: 2.5 }, blurb: 'Crisp ACM box, chrome fins, mirror door, full-height brand panels.' },
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
  { id: 'cathedral', name: '01 · Cathedral', base: 'rink', enc: 'cathedral', cup: 'chalice', metal: 'chrome', primary: '#0b2d82', accent: '#3b7cff' },
  { id: 'halo', name: '02 · Halo', base: 'puck', enc: 'halo', cup: 'champion', metal: 'chrome', primary: '#0b2d82', accent: '#3b7cff' },
  { id: 'prism', name: '03 · Prism', base: 'octa', enc: 'prism', cup: 'hex', metal: 'chrome', primary: '#0b2d82', accent: '#3b7cff' },
  { id: 'hattrick', name: '04 · Hat Trick', base: 'ski', enc: 'pucktower', cup: 'puckstack', metal: 'chrome', primary: '#0b2d82', accent: '#3b7cff' },
  { id: 'monolith', name: '05 · Monolith', base: 'float', enc: 'monolith', cup: 'torch', metal: 'chrome', primary: '#0b2d82', accent: '#3b7cff' },
];
export const byId = (list, id) => list.find((x) => x.id === id) || list[0];
