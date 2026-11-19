// Writes both designs (trophy + cooler) as GLB (meters, with materials) and STL (inches), whole and per section.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import * as T from '../src/trophy.js';
import * as C from '../src/cooler.js';
import * as S from '../src/stage.js';

globalThis.FileReader = class { readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend && this.onloadend(); }); }
  readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(r).toString('base64'); this.onloadend && this.onloadend(); }); } };
const OUT = process.argv[2] || 'models';
for (const d of ['glb', 'stl']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const gltf = new GLTFExporter(), stl = new STLExporter();
async function save(obj, name) {
  const root = new THREE.Group(); root.add(obj); root.updateMatrixWorld(true);
  fs.writeFileSync(path.join(OUT, 'stl', name + '.stl'), Buffer.from(stl.parse(root, { binary: true }).buffer));
  const m = new THREE.Group(); m.name = name; m.scale.setScalar(T.IN_TO_M); m.add(obj); m.updateMatrixWorld(true);
  fs.writeFileSync(path.join(OUT, 'glb', name + '.glb'), Buffer.from(await gltf.parseAsync(m, { binary: true })));
  console.log('ok', name);
}
const P = { ...T.DEFAULTS }, M = T.makeMaterials(P), top = T.casterH(P) + P.H;
const make = () => { const cup = T.buildCup(P, M), c = T.buildContents(P, M, cup.userData.bowl, { instanced: false }); return { cup, c }; };
{ const { cup, c } = make(); await save(cup, '2-cup-bowl-and-pedestal'); await save(c, '3-bottles-and-ice'); }
await save(T.buildEnclosure(P, M), '1-enclosure'); await save(T.buildFridge(P), 'REF-meling-DW-XL90'); await save(T.buildBase(P, M), '0-base-ice-sled');
{ const { cup, c } = make(); cup.position.y = top; c.position.y = top; const asm = new THREE.Group(); asm.add(T.buildBase(P, M), T.buildEnclosure(P, M), T.buildFridge(P), cup, c); await save(asm, 'ASSEMBLY'); }

// ---------- cooler design (lid open, door closed) ----------
{
  const PC = { ...T.DEFAULTS, ...C.DEFAULTS, design: 'cooler' }, MC = T.makeMaterials(PC);
  const V = { isolate: false, sel: 'enc', vis: { cup: true, contents: true, enc: true, fridge: true, base: true }, panel: 0, explode: 0 };
  const mk = () => { const m = S.buildModel(PC, MC, { lod: 'high', merged: true }); S.arrange(m.parts, PC, V); m.root.updateMatrixWorld(true); return m; };
  await save(mk().root, 'COOLER-ASSEMBLY');
  for (const [k, name] of [['enc', 'cooler-1-body-and-door'], ['cup', 'cooler-2-lid'], ['contents', 'cooler-3-bottles-and-ice'], ['base', 'cooler-0-base-ice-runners'], ['fridge', 'cooler-REF-meling-DW-XL90']]) await save(mk().parts[k], name);
}
