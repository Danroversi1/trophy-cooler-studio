// Michelob ULTRA cooler — second design. A brushed-stainless chest cooler (blue faceted trim, open lid, latch,
// side handles with blue grips, drain plug) that houses the Meling DW-XL90 freezer upright behind a front door,
// with an ice well in the top holding a grid of bottles that grows with the cooler.
// Units: inches · +Y up · +Z = front. Part keys match the trophy (cup = lid) so the studio, worker and export share code.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './trophy.js';

const { rng, mesh, named, K } = T.U;
const geo = T.cachedGeometry;
// Uniform, world-scaled UVs with the brush running horizontally on every face. Anisotropic (brushed) shading takes its
// direction from the UVs, so stretched per-face UVs would make tall and wide panels shade differently.
function brushedUV(g, k = 1 / 12) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * k; uv[i * 2 + 1] = v * k;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
const box = (w, h, d, mat, x, y, z) => mesh(geo(K('cbox', w, h, d), () => brushedUV(new THREE.BoxGeometry(w, h, d))), mat, x, y, z);
const rbox = (w, h, d, r, mat, x, y, z) => mesh(geo(K('crbox', w, h, d, r), () => brushedUV(new RoundedBoxGeometry(w, h, d, 5, Math.min(r, Math.min(w, h, d) / 2 - 0.01)))), mat, x, y, z);

export const DEFAULTS = { cL: 64, cD: 32, cH: 43, cWell: 8, cLid: 105, cTrim: '#1638c8',
  // oversized cooler (no freezer): its own size settings; the ice sits on a raised false floor oWell below the rim
  oL: 44, oD: 24, oH: 22, oWell: 11, oLid: 105, oTrim: '#1638c8', oGlow: '#36c8ff' };
const isOver = (P) => P.design === 'oversized';
// the oversized cooler reuses this file with its own numbers mapped onto the cooler's
const eff = (P) => (isOver(P) ? { ...P, cL: P.oL, cD: P.oD, cH: P.oH, cWell: P.oWell, cLid: P.oLid, cTrim: P.oTrim } : P);
export const SLED = 1.8, WALL = 1.5, FLOOR = 1.5, LIDT = 3.5, TRAY = 0.75, R = 2.4;

// everything dimensional, from the parameters (used by the model, the fit check and the specs)
export function info(P0) {
  const P = eff(P0), over = isOver(P0);
  const L = P.cL, D = P.cD, H = P.cH, well = P.cWell, y0 = SLED, rim = y0 + H;
  const wellBottom = rim - well, fridgeY = y0 + FLOOR, fridgeTop = fridgeY + T.FRIDGE.h;
  const zf = D / 2 - WALL - 1.0; // freezer front face: 1" behind the door
  const side = (L - 2 * WALL - T.FRIDGE.w) / 2, above = wellBottom - TRAY - fridgeTop, back = zf - T.FRIDGE.d - (-D / 2 + WALL);
  const dw = Math.min(L - 2 * R - 8, Math.max(T.FRIDGE.w + 4, L * 0.5)), yd0 = y0 + 2.2, yd1 = Math.min(wellBottom - 0.4, fridgeTop + 0.8);
  const iL = L - 2 * WALL - 1, iD = D - 2 * WALL - 1, cols = Math.max(2, Math.floor(iL / 6.2)), rows = Math.max(1, Math.floor(iD / 6.6));
  const lid = THREE.MathUtils.degToRad(P.cLid), ring = over ? ringSlots(iL, iD) : null;
  return { over, L, D, H, well, y0, rim, wellBottom, fridgeY, fridgeTop, zf, side, above, back, dw, yd0, yd1, iL, iD, cols, rows, ring, n: over ? ring.length : cols * rows,
    fits: over || (side >= 1 && above >= 0.5 && back >= 0.75 && yd1 - yd0 >= T.FRIDGE.h * 0.9),
    closedH: rim + LIDT, openH: rim + Math.max(LIDT, Math.sin(lid) * D + Math.cos(lid) * LIDT), footprint: [L + 6.2, D] };
}

// bottles around the edge of the ice (oversized cooler): walk a rectangle inset from the walls, leave the front middle
// open so the puck reads from the front
function ringSlots(iL, iD) {
  const ix = iL / 2 - 3.2, iz = iD / 2 - 3.0, per = 4 * (ix + iz), n = Math.max(6, Math.round(per / 7)), out = [];
  for (let i = 0; i < n; i++) {
    let d = (i / n) * per + 2.2, x, z;
    if (d < 2 * ix) { x = -ix + d; z = -iz; } else if ((d -= 2 * ix) < 2 * iz) { x = ix; z = -iz + d; } else if ((d -= 2 * iz) < 2 * ix) { x = ix - d; z = iz; } else { d -= 2 * ix; x = -ix; z = iz - d; }
    if (z > 0 && Math.abs(x) < iL * 0.2) continue;
    out.push([x, z]);
  }
  return out;
}
// soft glow under the puck (built once; DataTexture so it works in the worker and in Node too)
let HALO = null;
function haloMap() {
  if (HALO) return HALO;
  const N = 128, b = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2), v = Math.round(255 * Math.pow(Math.max(0, 1 - d), 2.2)), i = (y * N + x) * 4; b[i] = b[i + 1] = b[i + 2] = 255; b[i + 3] = v; }
  const t = new THREE.DataTexture(b, N, N, THREE.RGBAFormat); t.needsUpdate = true; return (HALO = t);
}

// ---------- materials ----------
function materials(P, M) {
  if (M._cooler) return M._cooler;
  const over = isOver(P);
  const fast = !!M._fast, rough = M.metal.roughnessMap;
  const steel = new THREE.MeshPhysicalMaterial({ name: 'brushed-stainless', color: 0xc4c9d0, metalness: 1, roughness: 0.42, anisotropy: 0.85, roughnessMap: rough });
  const steelIn = new THREE.MeshPhysicalMaterial({ name: 'stainless-liner', color: 0xb5bbc3, metalness: 1, roughness: 0.48, anisotropy: 0.6, roughnessMap: rough });
  const gem = (color, name) => new THREE.MeshPhysicalMaterial({ name, color, metalness: 0.25, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, flatShading: true, envMapIntensity: 1.6 });
  const crystal = fast
    ? new THREE.MeshPhysicalMaterial({ name: 'crystal', color: 0xf2f7ff, metalness: 0, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.8, flatShading: true, envMapIntensity: 1.8 })
    : new THREE.MeshPhysicalMaterial({ name: 'crystal', color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 0.95, thickness: 1, ior: 1.6, flatShading: true });
  const C = { steel, steelIn, crystal, gemBlue: gem(new THREE.Color(P.cTrim), 'faceted-blue-trim'), gemRed: gem(0xd0142c, 'faceted-red-ribbon'),
    dark: new THREE.MeshStandardMaterial({ name: 'shadow-gap', color: 0x06070a, roughness: 0.8 }),
    print: M.coolerLogoMap ? new THREE.MeshStandardMaterial({ name: 'logo-print', map: M.coolerLogoMap, transparent: true, roughness: 0.32, metalness: 0.1 }) : null,
    // big clear cubes: glossy and bright (see-through ice over a black studio reads grey, and costs an extra render pass)
    rubber: new THREE.MeshPhysicalMaterial({ name: 'puck-rubber', color: 0x0d0e10, roughness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.5 }),
    glow: new THREE.MeshBasicMaterial({ name: 'puck-light', color: new THREE.Color(P.oGlow || '#36c8ff').multiplyScalar(2.2), toneMapped: false }),
    halo: new THREE.MeshBasicMaterial({ name: 'puck-halo', color: new THREE.Color(P.oGlow || '#36c8ff').multiplyScalar(1.4), map: haloMap(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    ice: new THREE.MeshPhysicalMaterial({ name: 'ice-cubes', color: 0xdbe8ff, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.01, transparent: true, opacity: 0.6, envMapIntensity: 2.8, specularIntensity: 1, flatShading: true }), // faceted, clear-looking chunks that sparkle
    iceBed: new THREE.MeshPhysicalMaterial({ name: 'ice-bed', color: 0xc9d9ee, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 }), uhmw: M.uhmw };
  if (over && rough) { const drops = T.dropletMap(); steel.bumpMap = drops; steel.bumpScale = 0.55; } // condensation on the cold body
  return (M._cooler = C);
}

// ---------- geometry helpers ----------
// faceted "gem" band around a rounded rectangle (half sizes hx, hz, corner radius rc), two rows of pyramids
function facetBand(hx, hz, rc, y0, y1, depth, cell = 1.5) {
  return geo(K('facet', hx, hz, rc, y0, y1, depth, cell), () => {
    const pts = [];
    const seg = (ax, az, bx, bz, nx, nz) => { const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / cell)); for (let i = 0; i < n; i++) { const t = i / n; pts.push([ax + (bx - ax) * t, az + (bz - az) * t, nx, nz]); } };
    const arc = (cx, cz, a0) => { const n = Math.max(2, Math.round((Math.PI / 2) * rc / cell)); for (let i = 0; i < n; i++) { const a = a0 - (i / n) * (Math.PI / 2); pts.push([cx + Math.cos(a) * rc, cz + Math.sin(a) * rc, Math.cos(a), Math.sin(a)]); } };
    seg(-hx + rc, hz, hx - rc, hz, 0, 1); arc(hx - rc, hz - rc, Math.PI / 2);
    seg(hx, hz - rc, hx, -hz + rc, 1, 0); arc(hx - rc, -hz + rc, 0);
    seg(hx - rc, -hz, -hx + rc, -hz, 0, -1); arc(-hx + rc, -hz + rc, -Math.PI / 2);
    seg(-hx, -hz + rc, -hx, hz - rc, -1, 0); arc(-hx + rc, hz - rc, Math.PI);
    const pos = [], ym = (y0 + y1) / 2;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], nx = (a[2] + b[2]) / 2, nz = (a[3] + b[3]) / 2;
      for (const [ya, yb] of [[y0, ym], [ym, y1]]) {
        const A = [a[0], ya, a[1]], B = [b[0], ya, b[1]], Cc = [b[0], yb, b[1]], Dd = [a[0], yb, a[1]];
        const E = [(a[0] + b[0]) / 2 + nx * depth, (ya + yb) / 2, (a[1] + b[1]) / 2 + nz * depth];
        pos.push(...A, ...B, ...E, ...B, ...Cc, ...E, ...Cc, ...Dd, ...E, ...Dd, ...A, ...E);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  });
}
// rolled lip around a rounded rectangle at height y
function lip(hx, hz, rc, y, r, mat) {
  const g = new THREE.Group();
  const bar = (len, x, z, alongX) => { const m = mesh(geo(K('lipbar', len, r), () => new THREE.CylinderGeometry(r, r, len, 12, 1, true)), mat, x, y, z); if (alongX) m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2; g.add(m); };
  bar(2 * (hx - rc), 0, hz, true); bar(2 * (hx - rc), 0, -hz, true); bar(2 * (hz - rc), hx, 0, false); bar(2 * (hz - rc), -hx, 0, false);
  const tor = geo(K('liptorus', rc, r), () => new THREE.TorusGeometry(rc, r, 10, 12, Math.PI / 2).rotateX(Math.PI / 2));
  [[hx - rc, hz - rc, 0], [hx - rc, -hz + rc, Math.PI / 2], [-hx + rc, -hz + rc, Math.PI], [-hx + rc, hz - rc, -Math.PI / 2]].forEach(([x, z, ry]) => { const m = mesh(tor, mat, x, y, z); m.rotation.y = ry; g.add(m); });
  return g;
}
const along = (m, axis) => { if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2; return m; };
// faceted ribbon (the red mark under ULTRA), as a beveled extrusion so flat shading reads as cut facets
function ribbonGeo(w, h, notch) {
  return geo(K('ribbon', w, h, notch), () => {
    const s = new THREE.Shape(); s.moveTo(-w / 2, h / 2); s.lineTo(w / 2, h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(0, -h / 2 + notch); s.lineTo(-w / 2, -h / 2); s.closePath();
    const b = Math.min(w * 0.32, 0.9);
    return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: b * 0.55, bevelSize: b, bevelSegments: 1, curveSegments: 1 });
  });
}

// ---------- parts ----------
function buildBase(P, C, over) { // UHMW ice runners: slides on the rink, nothing metal touches the ice
  const g = named(new THREE.Group(), 'base-ice-runners'), { cL: L, cD: D } = P;
  g.add(rbox(L - 2, 0.9, D - 2, 0.4, C.uhmw, 0, SLED - 0.45, 0));
  for (const z of [-(D / 2 - 3.5), 0, D / 2 - 3.5]) g.add(rbox(L - 1, SLED - 0.8, 2.4, 0.38, C.uhmw, 0, (SLED - 0.8) / 2, z));
  return g;
}
function buildBody(P, C, I) {
  const g = named(new THREE.Group(), 'cooler-body'), { L, D, H, y0, rim, wellBottom, dw, yd0, yd1, iL, iD } = I, s = C.steel, gap = 0.14, zw = D / 2 - WALL / 2;
  g.add(rbox(L - 0.2, FLOOR, D - 0.2, 0.7, s, 0, y0 + FLOOR / 2, 0));
  for (const [x, z] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) g.add(mesh(geo(K('corner', R, H), () => brushedUV(new THREE.CylinderGeometry(R, R, H, 32))), s, x * (L / 2 - R), y0 + H / 2, z * (D / 2 - R)));
  g.add(box(L - 2 * R, H, WALL, s, 0, y0 + H / 2, -zw));
  for (const x of [-1, 1]) g.add(box(WALL, H, D - 2 * R, s, x * (L / 2 - WALL / 2), y0 + H / 2, 0));
  if (I.over) { // no freezer: solid front with the printed logo + faceted ribbon
    g.add(box(L - 2 * R, H, WALL, s, 0, y0 + H / 2, zw));
    g.add(box(iL + 1, TRAY, iD + 1, C.steelIn, 0, wellBottom - TRAY / 2, 0)); // raised false floor under the ice
    if (C.print) {
      const lw = L * 0.5, lh = lw * (1231 / 1600), ly = y0 + H * 0.47;
      const lg = mesh(geo(K('logoplane', lw, lh), () => new THREE.PlaneGeometry(lw, lh)), C.print, 0, ly, D / 2 + 0.02); lg.castShadow = false; g.add(lg);
      if (C.printIsDefault !== false) g.add(named(mesh(ribbonGeo(lw * 0.107, lh * 0.37, lh * 0.046), C.gemRed, (0.473 - 0.5) * lw, ly + lh / 2 - lh * 0.805, D / 2 + 0.05), 'ribbon-gem'));
    }
  }
  // front wall around the door opening (the thin gaps read as the door seam)
  const wl = L / 2 - R - dw / 2 - gap;
  if (!I.over) {
    for (const x of [-1, 1]) g.add(box(wl, H, WALL, s, x * (dw / 2 + gap + wl / 2), y0 + H / 2, zw));
    g.add(box(dw + 2 * gap, rim - (yd1 + gap), WALL, s, 0, (rim + yd1 + gap) / 2, zw));
    g.add(box(dw + 2 * gap, yd0 - gap - y0, WALL, s, 0, (yd0 - gap + y0) / 2, zw));
  }
    // bottom bead and the rolled lip
  for (const z of [-1, 1]) g.add(rbox(L - 2 * R, 0.5, 0.4, 0.2, s, 0, y0 + 2.6, z * (D / 2 + 0.05)));
  for (const x of [-1, 1]) g.add(rbox(0.4, 0.5, D - 2 * R, 0.2, s, x * (L / 2 + 0.05), y0 + 2.6, 0));
  g.add(lip(L / 2 - WALL / 2, D / 2 - WALL / 2, R - WALL / 2, rim, 0.6, s));
  // blue faceted trim just under the rim
  g.add(named(mesh(facetBand(L / 2, D / 2, R, rim - 2.3, rim - 0.5, 0.17, 2.4), C.gemBlue), 'trim-blue'));
  // ice well liner: tray floor + walls
  if (!I.over) g.add(box(iL + 1, TRAY, iD + 1, C.steelIn, 0, wellBottom - TRAY / 2, 0));
  for (const z of [-1, 1]) g.add(box(iL + 1, rim - wellBottom, 0.3, C.steelIn, 0, (rim + wellBottom) / 2, z * (iD / 2 + 0.35)));
  for (const x of [-1, 1]) g.add(box(0.3, rim - wellBottom, iD + 1, C.steelIn, x * (iL / 2 + 0.35), (rim + wellBottom) / 2, 0));
  // side handles: brackets, arms, bar with a blue faceted grip
  const yh = y0 + H * 0.78, zh = D * 0.24;
  for (const sx of [-1, 1]) {
    for (const z of [-zh, zh]) {
      g.add(rbox(0.7, 2.6, 2.6, 0.3, s, sx * (L / 2 + 0.35), yh, z));
      g.add(along(mesh(geo(K('arm'), () => new THREE.CylinderGeometry(0.42, 0.42, 2.4, 14)), s, sx * (L / 2 + 1.5), yh, z), 'x'));
    }
    g.add(along(mesh(geo(K('hbar', zh), () => new THREE.CylinderGeometry(0.45, 0.45, 2 * zh + 0.9, 14)), s, sx * (L / 2 + 2.7), yh, 0), 'z'));
    g.add(along(mesh(geo(K('grip', zh), () => new THREE.CylinderGeometry(0.95, 0.95, 2 * zh * 0.78, 8)), C.gemBlue, sx * (L / 2 + 2.7), yh, 0), 'z'));
  }
  // latch on the front, over the trim
  g.add(rbox(4.6, 3.0, 0.4, 0.2, s, 0, rim - 1.6, D / 2 + 0.2));
  g.add(rbox(1.5, 1.1, 0.7, 0.25, s, 0, rim - 2.3, D / 2 + 0.55));
  for (const x of [-1.7, 1.7]) for (const y of [rim - 0.6, rim - 2.6]) g.add(along(mesh(geo(K('rivet'), () => new THREE.CylinderGeometry(0.22, 0.22, 0.2, 10)), s, x, y, D / 2 + 0.45), 'z'));
  // drain plug with a short chain
  const dx = L / 2 - 6.5, dy = y0 + 4.2;
  g.add(along(mesh(geo(K('boss'), () => new THREE.CylinderGeometry(1.35, 1.35, 0.5, 6)), s, dx, dy, D / 2 + 0.25), 'z'));
  g.add(along(mesh(geo(K('cap'), () => new THREE.CylinderGeometry(0.9, 0.95, 1.1, 18)), s, dx, dy, D / 2 + 0.95), 'z'));
  const link = geo(K('link'), () => new THREE.TorusGeometry(0.32, 0.08, 6, 12));
  for (let i = 0; i < 6; i++) { const m = mesh(link, s, dx - 0.4 - i * 0.18, dy - 0.9 - i * 0.5, D / 2 + 0.6); m.rotation.set(0, i % 2 ? Math.PI / 2 : 0, 0.3); g.add(m); }
  if (I.over) { g.userData.setPanel = () => {}; return g; }
  // front door (freezer access), hinged on the left
  const door = named(new THREE.Group(), 'front-door'), dh = yd1 - yd0, dyc = (yd0 + yd1) / 2;
  door.position.set(-dw / 2, 0, D / 2);
  door.add(box(dw, dh, WALL, s, dw / 2, dyc, -WALL / 2)); // plain panel: brushed the same way as the body
  for (let i = 0; i < 6; i++) door.add(rbox(dw * 0.46, 0.34, 0.12, 0.1, C.dark, dw / 2, yd0 + 1.3 + i * 0.75, 0.03)); // vent slots for the freezer's front vent
  door.add(rbox(0.9, 7.5, 0.16, 0.3, C.dark, dw - 2.4, dyc, 0.04)); door.add(rbox(0.5, 6.4, 0.7, 0.24, s, dw - 2.4, dyc, 0.38)); // flush pull
  for (const y of [yd0 + 3, dyc, yd1 - 3]) door.add(mesh(geo(K('hinge'), () => new THREE.CylinderGeometry(0.4, 0.4, 3, 12)), s, 0.05, y, 0.1));
  if (C.print) {
    const lw = dw * 0.9, lh = lw * (1231 / 1600), ly = dyc + dh * 0.08;
    const lg = mesh(geo(K('logoplane', lw, lh), () => new THREE.PlaneGeometry(lw, lh)), C.print, dw / 2, ly, 0.02); lg.castShadow = false; door.add(lg);
    if (C.printIsDefault !== false) { // faceted red ribbon over the printed one (position measured off the supplied logo)
      const rw = lw * 0.107, rh = lh * 0.37, rx = dw / 2 + (0.473 - 0.5) * lw, ry = ly + lh / 2 - lh * 0.805;
      door.add(named(mesh(ribbonGeo(rw, rh, lh * 0.046), C.gemRed, rx, ry, 0.03), 'ribbon-gem'));
    }
  }
  g.add(door); g.userData.door = door;
  g.userData.setPanel = (t) => { door.rotation.y = -t * 1.75; };
  return g;
}
function buildLid(P, C, I) {
  const { L, D, rim } = I, g = named(new THREE.Group(), 'cooler-lid'), s = C.steel;
  g.position.set(0, rim, -D / 2 + 0.3);
  const zc = D / 2 - 0.3;
  g.add(rbox(L, LIDT, D, 1.7, s, 0, LIDT / 2, zc));
  g.add(rbox(L - 5, 0.35, D - 5, 0.15, C.steelIn, 0, -0.12, zc)); // underside panel
  g.add(named(mesh(facetBand(L / 2 + 0.02, D / 2 + 0.02, 1.7, 0.55, LIDT - 0.45, 0.17, 2.4), C.gemBlue, 0, 0, zc), 'lid-trim-blue'));
  const gemGeo = geo(K('corner-gem'), () => new THREE.IcosahedronGeometry(1.35, 0).scale(1, 0.75, 1));
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(mesh(gemGeo, C.crystal, x * (L / 2 - 1.5), LIDT + 0.2, zc + z * (D / 2 - 1.5)));
  for (const x of [-0.3, 0.3]) g.add(along(mesh(geo(K('lidhinge'), () => new THREE.CylinderGeometry(0.65, 0.65, 5, 14)), s, x * L, 0.2, -0.4), 'x'));
  g.add(rbox(3.2, 1.4, 0.5, 0.2, s, 0, LIDT * 0.45, zc + D / 2 + 0.25)); // latch tab
  return g;
}
function buildContents(P, M, C, I, { instanced = true, seed = 11, lod = 'high' } = {}) {
  const g = named(new THREE.Group(), 'bottles-and-ice'), r = rng(seed), { iL, iD, rim, wellBottom, cols, rows } = I, heap = P.heap, jit = (k) => (r() * 2 - 1) * k;
  const surf = (x, z) => rim - 0.4 + heap * (1 - Math.pow(Math.abs(x) / (iL / 2), 4)) * (1 - Math.pow(Math.abs(z) / (iD / 2), 4)) + 0.3 * Math.sin(x * 0.8) * Math.cos(z * 0.7);
  const bed = geo(K('cbed', iL, iD, rim, heap), () => { const p = new THREE.PlaneGeometry(iL, iD, 40, 20).rotateX(-Math.PI / 2), a = p.attributes.position; for (let i = 0; i < a.count; i++) a.setY(i, Math.max(wellBottom + 0.5, surf(a.getX(i), a.getZ(i)) - 1.0)); p.computeVertexNormals(); return p; });
  g.add(named(mesh(bed, C.iceBed), 'ice-bed'));
  // bottles in staggered rows, labels to the front, each sunk and tilted a little differently
  const slots = [], mats = [], o = new THREE.Object3D();
  if (I.over) for (const [bx, bz] of I.ring) { // around the edge, leaning out toward the walls, labels to the front
    const x = bx + jit(0.5), z = bz + jit(0.4), ln = Math.hypot(x, z) || 1, lean = 0.16 + r() * (P.lean + 0.18), bury = 3.0 + r() * 0.9;
    o.position.set(x, surf(x, z) - bury, z); o.rotation.set(0, jit(0.35) + (x / (iL / 2)) * 0.35, 0); o.rotateX(lean * (z / ln)); o.rotateZ(-lean * (x / ln)); o.updateMatrix();
    mats.push(o.matrix.clone()); slots.push([x, z]);
  }
  if (!I.over) for (let row = 0; row < rows; row++) for (let c = 0; c < cols; c++) {
    const x = -iL / 2 + ((c + 0.5 + (row % 2 ? 0.25 : -0.1)) * iL) / cols + jit(0.5), z = -iD / 2 + ((row + 0.5) * iD) / rows + jit(0.4);
    const xx = Math.max(-iL / 2 + 1.4, Math.min(iL / 2 - 1.4, x)), bury = 2.4 + r() * 1.2 - (rows - 1 - row) * 0.25;
    o.position.set(xx, surf(xx, z) - bury, z); o.rotation.set(0, jit(0.45), 0); o.rotateX(0.04 + r() * (P.lean * 1.5 + 0.18)); o.rotateZ(jit(0.28)); o.updateMatrix();
    mats.push(o.matrix.clone()); slots.push([xx, z]);
  }
  T.addBottles(g, M, mats, { instanced, hi: lod !== 'low' });
  // big clear cubes, kept clear of the bottles
  const cubes = [];
  for (let x = -iL / 2 + 1.1; x < iL / 2 - 0.9; x += 2.05) for (let z = -iD / 2 + 1.1; z < iD / 2 - 0.9; z += 2.05) {
    const px = x + jit(0.45), pz = z + jit(0.45);
    if (slots.some(([bx, bz]) => Math.hypot(px - bx, pz - bz) < 1.75) || (I.over && Math.hypot(px, pz) < 4.1)) continue;
    o.position.set(px, surf(px, pz) - 0.35 + r() * 0.55, pz); o.rotation.set(r() * 3, r() * 3, r() * 3); o.scale.setScalar(0.8 + r() * 0.35); o.updateMatrix(); cubes.push(o.matrix.clone());
  }
  o.scale.setScalar(1);
  const cube = geo(K('cchunk'), () => new THREE.IcosahedronGeometry(1.25, 0).scale(1, 0.85, 1.1));
  if (instanced) { const im = new THREE.InstancedMesh(cube, C.ice, cubes.length); cubes.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; g.add(im); }
  else g.add(mesh(geo(K('ccubes', iL, iD, rim, heap, P.lean, seed), () => mergeGeometries(cubes.map((m) => cube.clone().applyMatrix4(m)))), C.ice));
  if (I.over) { // the puck in the centre, on a steel collar, with a blue light underneath
    const yb = surf(0, 0) - 0.2, pk = named(new THREE.Group(), 'puck-light');
    pk.add(mesh(geo(K('collar'), () => new THREE.LatheGeometry([[2.0, 0], [3.25, 0], [3.4, 0.45], [3.1, 0.95], [2.15, 0.95], [2.0, 0.5]].map(([a, b]) => new THREE.Vector2(a, b)), 64)), C.steel || M.metal, 0, yb, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, m = mesh(geo(K('clip'), () => new RoundedBoxGeometry(0.9, 0.7, 0.6, 2, 0.15)), C.steel, Math.sin(a) * 3.35, yb + 0.45, Math.cos(a) * 3.35); m.rotation.y = a; pk.add(m); }
    pk.add(along2(mesh(geo(K('glowring'), () => new THREE.RingGeometry(1.2, 2.25, 64)), C.glow, 0, yb + 0.92, 0)));
    pk.add(mesh(geo(K('glowband'), () => new THREE.CylinderGeometry(1.42, 1.75, 0.5, 48, 1, true)), C.glow, 0, yb + 1.2, 0)); // the light seen under the puck from the side
    pk.add(along2(mesh(geo(K('halo2'), () => new THREE.PlaneGeometry(22, 22)), C.halo, 0, yb + 1.0, 0)));
    pk.add(mesh(geo(K('puck'), () => new THREE.CylinderGeometry(1.5, 1.5, 1.0, 48)), C.rubber, 0, yb + 1.95, 0)); // regulation puck: 3" × 1", lifted on the light
    const light = new THREE.PointLight(new THREE.Color(P.oGlow || '#36c8ff'), 220, 30, 2); light.position.set(0, yb + 1.1, 0); pk.add(light);
    g.add(pk);
  }
  g.userData.top = rim + heap + 9;
  return g;
}
const along2 = (m) => { m.rotation.x = -Math.PI / 2; return m; }; // lay a plane / ring flat, facing up

export function buildModel(P0, M, { lod = 'both', merged = false } = {}) {
  const P = eff(P0), I = info(P0), C = materials(P, M); C.printIsDefault = M.coolerLogoIsDefault;
  const root = new THREE.Group(), parts = {};
  parts.base = buildBase(P, C, I.over); parts.enc = buildBody(P, C, I); parts.fridge = I.over ? new THREE.Group() : T.fridgeAt(I.fridgeY, I.zf);
  parts.cupGroup = new THREE.Group(); parts.cup = buildLid(P, C, I);
  parts.contents = buildContents(P, M, C, I, { instanced: !merged, lod: lod === 'low' ? 'low' : 'high' });
  parts.cupGroup.add(parts.cup, parts.contents); root.add(parts.base, parts.enc, parts.fridge, parts.cupGroup);
  parts.info = I;
  return { root, parts };
}
export function arrange(parts, P0, V) {
  const P = eff(P0);
  const only = V.isolate ? V.sel : null, vis = V.vis;
  parts.cup.visible = only ? only === 'cup' : vis.cup;
  parts.cvis = only ? only === 'contents' : vis.contents; parts.contents.visible = parts.cvis;
  parts.enc.visible = only ? only === 'enc' : vis.enc;
  parts.fridge.visible = !parts.info.over && (only ? only === 'enc' || only === 'fridge' : vis.fridge);
  parts.base.visible = only ? only === 'base' : vis.base;
  parts.enc.userData.setPanel(V.panel);
  const ex = only ? 0 : V.explode;
  parts.cup.rotation.x = -THREE.MathUtils.degToRad(P.cLid);
  parts.base.position.y = -ex * 6; parts.cupGroup.position.y = 0; parts.cup.position.y = parts.info.rim + ex * 22; parts.contents.position.y = ex * 12;
  return { top: parts.info.rim, grounded: parts.base.visible || parts.enc.visible, contact: [P.cL * 1.25, P.cD * 1.9] };
}
export function weights(P0) {
  const P = eff(P0), I = info(P0), skin = (2 * (I.L * I.H + I.D * I.H) + 2 * I.L * I.D) / 144; // ft² of stainless + foam panels
  return { body: Math.round(skin * 1.45), lid: Math.round((I.L * I.D) / 144 * 2.2), base: Math.round((I.L * I.D) / 144 * 1.6),
    bottles: Math.round(I.n * 1.2), ice: Math.round(I.iL * I.iD * (I.over ? I.well : Math.max(2, P.heap + 4)) * 0.55 * 0.033), fridge: I.over ? 0 : T.FRIDGE.weight };
}
