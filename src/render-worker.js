// Background render worker: builds its own copy of the model (same trophy.js code, its own geometry cache) and renders
// on an OffscreenCanvas, so neither the turntable cache nor the final still ever blocks the interactive viewer.
// Messages in:  {type:'hdri', data, width, height}
//               {type:'turntable', id, key, state, tex, cam:{radius, phi, target:[x,y,z], fov}, size:{w,h}, n}
//               {type:'final', id, state, tex, cam:{position:[...], target:[...], fov}, size:{w,h}, samples}
//               {type:'cancel'}
// Messages out: {type:'frame', id, key, i, n, bitmap, blob} · {type:'final-progress', id, samples, total, bitmap?}
//               {type:'final-done', id, blob, samples} · {type:'error', id, message}
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import * as T from './trophy.js';
import * as S from './stage.js';

const canvas = new OffscreenCanvas(4, 4);
let renderer = null, scene, lights, ground, pte, env = {}, hdri = null, model = null, modelKey = '', texKey = '', tex = {}, job = 0;
const tick = () => new Promise((r) => setTimeout(r, 0)); // yield so 'cancel' and new jobs get through

function setup() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap; renderer.shadowMap.autoUpdate = false;
  scene = new THREE.Scene(); lights = S.addLights(scene); ground = S.makeGround(scene); pte = S.makePTExtras(scene);
}
function texture(d) {
  if (!d) return null;
  const t = new THREE.Texture(d.bitmap); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = d.wrapS; t.repeat.set(d.repeat[0], d.repeat[1]); t.offset.set(d.offset[0], d.offset[1]); t.needsUpdate = true; return t;
}
// (re)build the scene only when the object or view state changed; geometry comes from this worker's cache
function sync(st, texMsg, { merged, fast }) {
  if (texMsg) { Object.values(tex).forEach((t) => t && t.dispose()); tex = { logo: texture(texMsg.logo), bottleLabel: texture(texMsg.bottleLabel), neckLabel: texture(texMsg.neckLabel) }; texKey = texMsg.key; }
  const k = JSON.stringify([st.P, st.V, merged, fast, texKey]);
  if (k !== modelKey) {
    if (model) { scene.remove(model.root); model.root.traverse((o) => { if (o.geometry && !o.geometry.userData.cached) o.geometry.dispose(); }); }
    const M = T.makeMaterials(st.P, tex, { fast, detail: true });
    model = S.buildModel(st.P, M, { lod: 'high', merged }); scene.add(model.root); modelKey = k;
  }
  const a = S.arrange(model.parts, st.P, st.V);
  ground.contact.scale.set(st.P.W * 1.5, st.P.D * 2.6, 1); ground.contact.visible = a.grounded;
  ground.rink.visible = st.V.env === 'rink';
  if (!env[st.V.env]) env[st.V.env] = S.pmremEnv(renderer, st.V.env);
  scene.environment = env[st.V.env]; scene.background = new THREE.Color(S.BG[st.V.env]); scene.environmentIntensity = 1;
  pte.floor.visible = false; pte.softboxes.visible = false;
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

async function final(m) {
  const id = ++job; setup();
  if (!hdri) { postMessage({ type: 'error', id: m.id, message: 'Studio lighting is still loading' }); return; }
  sync(m.state, m.tex, { merged: true, fast: false });
  // path-traced studio: black floor, softbox area lights + the studio HDRI (dimmed), black background
  ground.contact.visible = false; ground.rink.visible = false; pte.floor.visible = true; pte.softboxes.visible = true;
  scene.environment = hdri; scene.environmentIntensity = 0.4; scene.background = new THREE.Color(0x000000);
  renderer.setPixelRatio(1); renderer.setSize(m.size.w, m.size.h, false);
  const cam = new THREE.PerspectiveCamera(m.cam.fov, m.size.w / m.size.h, 1, 20000);
  cam.position.set(...m.cam.position); cam.lookAt(new THREE.Vector3(...m.cam.target)); cam.updateMatrixWorld();
  { // instant raster preview of the exact framing while the path tracer warms up
    ground.contact.visible = true; pte.floor.visible = false; pte.softboxes.visible = false; scene.environment = env.studio || (env.studio = S.pmremEnv(renderer, 'studio')); scene.environmentIntensity = 1;
    renderer.render(scene, cam); const bitmap = await createImageBitmap(canvas); postMessage({ type: 'final-progress', id: m.id, samples: 0, total: m.samples, bitmap }, [bitmap]);
    ground.contact.visible = false; pte.floor.visible = true; pte.softboxes.visible = true; scene.environment = hdri; scene.environmentIntensity = 0.4;
    if (id !== job) return;
  }
  const pt = new WebGLPathTracer(renderer);
  Object.assign(pt, { bounces: 8, transmissiveBounces: 10, filterGlossyFactor: 0.5, renderDelay: 0, fadeDuration: 0, minSamples: 0, dynamicLowRes: false, renderScale: 1 });
  pt.tiles.set(3, 3); // smaller chunks of GPU/CPU work per call
  pt.setScene(scene, cam);
  let last = 0;
  try {
    while (pt.samples < m.samples) {
      await tick(); if (id !== job) return;
      pt.renderSample();
      const now = performance.now();
      if (now - last > 2000) { last = now; const bitmap = await createImageBitmap(canvas); postMessage({ type: 'final-progress', id: m.id, samples: pt.samples, total: m.samples, bitmap }, [bitmap]); }
      else postMessage({ type: 'final-progress', id: m.id, samples: pt.samples, total: m.samples });
    }
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    postMessage({ type: 'final-done', id: m.id, blob, samples: Math.floor(pt.samples), w: m.size.w, h: m.size.h });
  } finally { try { pt.dispose(); } catch {} }
}

onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === 'cancel') job++;
    else if (m.type === 'hdri') { hdri = new THREE.DataTexture(m.data, m.width, m.height, THREE.RGBAFormat, THREE.FloatType); hdri.mapping = THREE.EquirectangularReflectionMapping; hdri.needsUpdate = true; }
    else if (m.type === 'turntable') turntable(m).catch((err) => postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) }));
    else if (m.type === 'final') final(m).catch((err) => postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) }));
  } catch (err) { postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) }); }
};
