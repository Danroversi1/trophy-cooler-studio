// Scene pieces shared by the interactive viewer (main thread) and the background render worker
// (turntable cache + final render). Everything here works with either an HTMLCanvasElement or an OffscreenCanvas.
import * as THREE from 'three';
import * as T from './trophy.js';
import * as C from './cooler.js';

export const mkCanvas = (w, h) => {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
};

export const BG = { studio: 0x020203, rink: 0x15181c };

// Reflection environment: a black room with large softboxes (studio) or arena lights (rink).
// Rendered once into a PMREM cube by the caller and reused every frame (no per-frame reflection work).
export function envScene(kind) {
  const s = new THREE.Scene(), geo = new THREE.SphereGeometry(100, 64, 32), pos = geo.attributes.position, col = [], c = new THREE.Color();
  const [top, hor, lo] = kind === 'studio' ? [0x15171b, 0x50545c, 0x16171a] : [0x0b0f18, 0x5d6b82, 0xe9eff6];
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 100; c.lerpColors(new THREE.Color(hor), new THREE.Color(y >= 0 ? top : lo), Math.pow(Math.abs(y), 0.5)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, k, x, y, z, tint = [1, 1, 1]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k * tint[0], k * tint[1], k * tint[2]), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 20, 0); s.add(m); };
  if (kind === 'studio') {
    panel(110, 70, 6, 0, 88, 0);
    panel(34, 110, 5.5, -70, 30, 25); panel(34, 110, 5.5, 70, 30, 25);
    panel(26, 90, 3, -45, 30, -60); panel(26, 90, 3, 45, 30, -60);
    panel(90, 50, 2.6, 0, 30, 85);
    panel(90, 10, 0.9, 0, 4, -80, [0.4, 0.6, 1.4]);
  } else {
    const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 9, 9.4) });
    for (let row = -2; row <= 2; row++) for (let k = -3; k <= 3; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 2.2), hot); m.position.set(k * 13, 70, row * 16); m.rotation.x = Math.PI / 2; s.add(m); }
    panel(46, 26, 5, 45, 40, 60); panel(60, 20, 1.4, -70, 20, 40);
    const boards = new THREE.Mesh(new THREE.CylinderGeometry(88, 88, 7, 64, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.55, 2.4), side: THREE.BackSide })); boards.position.y = 4; s.add(boards);
  }
  return s;
}
export function pmremEnv(renderer, kind) { const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(envScene(kind), 0.015).texture; pm.dispose(); return t; }

// Lights. The key light casts the only shadow; its map is static (computed once per model change, not per frame).
export function addLights(scene) {
  const L = {
    hemi: new THREE.HemisphereLight(0xdfe9ff, 0x20242c, 0.25),
    key: new THREE.DirectionalLight(0xfff5ea, 2.4),
    rimL: new THREE.DirectionalLight(0xbcd2ff, 1.3), rimR: new THREE.DirectionalLight(0xffffff, 0.9), front: new THREE.DirectionalLight(0xffffff, 0.55),
  };
  L.key.position.set(30, 220, 80); L.key.castShadow = true;
  Object.assign(L.key.shadow.camera, { left: -70, right: 70, top: 110, bottom: -40, near: 40, far: 500 });
  L.key.shadow.mapSize.set(2048, 2048); L.key.shadow.bias = -0.0006; L.key.shadow.normalBias = 0.25; L.key.shadow.radius = 10; L.key.shadow.blurSamples = 20;
  L.rimL.position.set(-160, 90, -60); L.rimR.position.set(160, 70, -40); L.front.position.set(0, 50, 200);
  Object.values(L).forEach((l) => scene.add(l));
  return L;
}

export function radial(stops) {
  const c = mkCanvas(1024, 1024), x = c.getContext('2d'), g = x.createRadialGradient(512, 512, 0, 512, 512, 512);
  stops.forEach(([o, s]) => g.addColorStop(o, s)); x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function iceTexture() {
  const N = 2048, R = 170, c = mkCanvas(N, N), x = c.getContext('2d'), k = N / (2 * R);
  x.fillStyle = '#8f9cab'; x.fillRect(0, 0, N, N);
  const line = (z, col, w) => { x.fillStyle = col; x.fillRect(0, N / 2 + z * k - w * k / 2, N, w * k); }; line(-75, '#c8102e', 8); line(130, '#1a49b8', 8);
  x.strokeStyle = '#c8102e'; x.lineWidth = 2 * k; x.beginPath(); x.arc(N / 2, N / 2, 110 * k, 0, 6.283); x.stroke();
  x.globalCompositeOperation = 'destination-in'; const g = x.createRadialGradient(N / 2, N / 2, N * 0.18, N / 2, N / 2, N / 2); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// rink disc + the cached contact-shadow decal under the object (a static texture, no shadow pass)
export function makeGround(scene) {
  const rink = new THREE.Mesh(new THREE.PlaneGeometry(340, 340), new THREE.MeshPhysicalMaterial({ map: iceTexture(), transparent: true, depthWrite: false, roughness: 0.55, clearcoat: 0.55 }));
  rink.rotation.x = -Math.PI / 2; rink.position.y = 0.01; rink.receiveShadow = true; scene.add(rink);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(0,0,0,.7)'], [0.5, 'rgba(0,0,0,.4)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false, toneMapped: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.05; contact.renderOrder = 2; scene.add(contact);
  return { rink, contact };
}
// The model, from cached geometry. lod: 'both' (interactive: high + low, toggled by screen size), 'high', or 'low'.
// merged: non-instanced bottles/ice (used by the GLB export path).
export function buildModel(P, M, { lod = 'both', merged = false } = {}) {
  if (P.design === 'cooler') return C.buildModel(P, M, { lod, merged });
  const root = new THREE.Group(), parts = {};
  parts.base = T.buildBase(P, M); parts.enc = T.buildEnclosure(P, M); parts.fridge = T.buildFridge(P);
  parts.cupGroup = new THREE.Group(); parts.cup = T.buildCup(P, M, { lod });
  parts.contents = T.buildContents(P, M, parts.cup.userData.bowl, { instanced: !merged, lod: lod === 'low' ? 'low' : 'high' });
  parts.cupGroup.add(parts.cup, parts.contents); root.add(parts.base, parts.enc, parts.fridge, parts.cupGroup);
  return { root, parts };
}
// visibility / exploded view / lifted panel (transforms only; geometry is never rebuilt for these)
export function arrange(parts, P, V) {
  if (P.design === 'cooler') return C.arrange(parts, P, V);
  const top = T.casterH(P) + P.H, only = V.isolate ? V.sel : null, vis = V.vis;
  parts.cup.visible = only ? only === 'cup' : vis.cup;
  parts.cvis = only ? only === 'cup' || only === 'contents' : vis.contents; parts.contents.visible = parts.cvis;
  parts.enc.visible = only ? only === 'enc' : vis.enc;
  parts.fridge.visible = only ? only === 'enc' || only === 'fridge' : vis.fridge;
  parts.base.visible = only ? only === 'base' : vis.base;
  parts.enc.userData.setPanel(V.panel);
  const ex = only ? 0 : V.explode;
  parts.base.position.y = -ex * 6; parts.enc.position.y = 0; parts.cupGroup.position.y = top + ex * 40;
  return { top, grounded: parts.base.visible || parts.enc.visible, contact: [P.W * 1.5, P.D * 2.6] };
}
