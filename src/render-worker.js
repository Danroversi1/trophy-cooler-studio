// Background render worker: builds its own copy of the model (same trophy.js code, its own geometry cache) and renders
// on an OffscreenCanvas, so neither the turntable cache nor the final still ever blocks the interactive viewer.
// Messages in:  {type:'turntable', id, key, state, tex, cam:{radius, phi, target:[x,y,z], fov}, size:{w,h}, n}
//               {type:'detail', id, state, tex, cam:{position:[...], target:[...], fov}, size:{w,h}, ss}
//               {type:'cancel'} · {type:'ping'}
// Messages out: {type:'frame', id, key, i, n, bitmap, blob} · {type:'detail-done', id, blob, bitmap, w, h}
//               {type:'pong'} · {type:'error', id, message}
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import * as T from './trophy.js';
import * as S from './stage.js';

const canvas = new OffscreenCanvas(4, 4);
let texDefault = true, renderer = null, scene, lights, ground, mirror, env = {}, model = null, modelKey = '', texKey = '', tex = {}, job = 0;
const tick = () => new Promise((r) => setTimeout(r, 0)); // yield so 'cancel' and new jobs get through

function setup() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap; renderer.shadowMap.autoUpdate = false;
  scene = new THREE.Scene(); lights = S.addLights(scene); ground = S.makeGround(scene);
  mirror = new Reflector(new THREE.CircleGeometry(260, 96), { textureWidth: 1024, textureHeight: 1024, color: 0x1c1e23 }); // detail renders only
  mirror.rotation.x = -Math.PI / 2; mirror.position.y = -0.02; mirror.visible = false; scene.add(mirror);
}
function texture(d) {
  if (!d) return null;
  const t = new THREE.Texture(d.bitmap); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = d.wrapS; t.repeat.set(d.repeat[0], d.repeat[1]); t.offset.set(d.offset[0], d.offset[1]); t.needsUpdate = true; return t;
}
// (re)build the scene only when the object or view state changed; geometry comes from this worker's cache
function sync(st, texMsg, { merged, fast }) {
  if (texMsg) { Object.values(tex).forEach((t) => t && t.dispose()); tex = { logo: texture(texMsg.logo), bottleLabel: texture(texMsg.bottleLabel), neckLabel: texture(texMsg.neckLabel), coolerLogo: texture(texMsg.coolerLogo) }; texDefault = texMsg.coolerLogoIsDefault; texKey = texMsg.key; }
  const k = JSON.stringify([st.P, st.V, merged, fast, texKey]);
  if (k !== modelKey) {
    if (model) { scene.remove(model.root); model.root.traverse((o) => { if (o.geometry && !o.geometry.userData.cached) o.geometry.dispose(); }); }
    const M = T.makeMaterials(st.P, { ...tex, coolerLogoIsDefault: texDefault }, { fast, detail: true });
    model = S.buildModel(st.P, M, { lod: 'high', merged }); scene.add(model.root); modelKey = k;
  }
  const a = S.arrange(model.parts, st.P, st.V);
  ground.contact.scale.set(a.contact[0], a.contact[1], 1); ground.contact.visible = a.grounded;
  ground.rink.visible = st.V.env === 'rink';
  if (!env[st.V.env]) env[st.V.env] = S.pmremEnv(renderer, st.V.env);
  scene.environment = env[st.V.env]; scene.background = new THREE.Color(S.BG[st.V.env]); scene.environmentIntensity = 1;
  mirror.visible = false;
  renderer.shadowMap.needsUpdate = true;
}

async function turntable(m) {
  const id = ++job; setup();
  sync(m.state, m.tex, { merged: false, fast: m.state.mode === 'fast' });
  renderer.setPixelRatio(1); renderer.setSize(m.size.w, m.size.h, false);
  const cam = new THREE.PerspectiveCamera(m.cam.fov, m.size.w / m.size.h, 1, 20000), tgt = new THREE.Vector3(...m.cam.target), off = new THREE.Vector3();
  for (let i = 0; i < m.n; i++) {
    await tick(); if (id !== job) return;
    off.setFromSphericalCoords(m.cam.radius, m.cam.phi, (i / m.n) * Math.PI * 2); // theta measured like OrbitControls: atan2(x, z)
    cam.position.copy(tgt).add(off); cam.lookAt(tgt);
    renderer.render(scene, cam);
    const bitmap = await createImageBitmap(canvas), blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.9 });
    if (id !== job) { bitmap.close(); return; }
    postMessage({ type: 'frame', id: m.id, key: m.key, i, n: m.n, bitmap, blob }, [bitmap]);
  }
}

// one high-quality frame from the real-time engine: full materials, mirror floor, key-light shadow, supersampled
async function detail(m) {
  const id = ++job; setup();
  sync(m.state, m.tex, { merged: false, fast: !!m.fast });
  const W = m.size.w, H = m.size.h, ss = m.ss || 2, iw = Math.round(W * ss), ih = Math.round(H * ss);
  renderer.setPixelRatio(1); renderer.setSize(iw, ih, false);
  mirror.visible = m.state.V.env === 'studio';
  const cam = new THREE.PerspectiveCamera(m.cam.fov, W / H, 1, 20000);
  cam.position.set(...m.cam.position); cam.lookAt(new THREE.Vector3(...m.cam.target)); cam.updateMatrixWorld();
  await tick(); if (id !== job) return;
  renderer.render(scene, cam);
  mirror.visible = false;
  const out = new OffscreenCanvas(W, H), x = out.getContext('2d'); // downsample = antialiasing
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(canvas, 0, 0, W, H);
  const blob = await out.convertToBlob({ type: 'image/png' }), bitmap = await createImageBitmap(out);
  if (id !== job) { bitmap.close(); return; }
  postMessage({ type: 'detail-done', id: m.id, blob, bitmap, w: W, h: H }, [bitmap]);
}

onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === 'ping') postMessage({ type: 'pong' });
    else if (m.type === 'cancel') job++;
    else if (m.type === 'turntable') turntable(m).catch((err) => postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) }));
    else if (m.type === 'detail') detail(m).catch((err) => postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) }));
  } catch (err) { postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) }); }
};
