// Builds every module + preset assembly and writes GLB (meters) and STL (inches).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import * as D from '../src/designs.js';

// minimal FileReader polyfill for GLTFExporter in Node
globalThis.FileReader = class { readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend && this.onloadend(); }); }
  readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(r).toString('base64'); this.onloadend && this.onloadend(); }); } };

const OUT = process.argv[2];
fs.mkdirSync(path.join(OUT, 'glb'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'stl'), { recursive: true });
const gltf = new GLTFExporter(), stl = new STLExporter();

async function save(obj, name) {
  const root = new THREE.Group(); root.add(obj); root.updateMatrixWorld(true);
  fs.writeFileSync(path.join(OUT, 'stl', name + '.stl'), Buffer.from(stl.parse(root, { binary: true }).buffer));
  const m = new THREE.Group(); m.name = name; m.scale.setScalar(D.IN_TO_M); m.add(obj); m.updateMatrixWorld(true);
  const buf = await gltf.parseAsync(m, { binary: true });
  fs.writeFileSync(path.join(OUT, 'glb', name + '.glb'), Buffer.from(buf));
}

for (const p of D.PRESETS) {
  const o = { ...p, brand: 'MICHELOB ULTRA' };
  const M = D.makeMaterials(o);
  const n = p.name.replace(/[^0-9A-Za-z]+/g, '-').replace(/^-|-$/g, '');
  const base = D.byId(D.BASES, p.base).build(M, o);
  const enc = D.byId(D.ENCLOSURES, p.enc).build(M, o);
  const cup = D.byId(D.CUPS, p.cup).build(M, o);
  const contents = D.buildContents(M, cup.userData.bowl, { instanced: false });
  await save(base.clone(), `${n}_1-base-${p.base}`);
  await save(enc.clone(), `${n}_2-enclosure-${p.enc}`);
  const cupFull = new THREE.Group(); cupFull.add(cup.clone(), contents.clone());
  await save(cupFull, `${n}_3-cup-${p.cup}`);
  const asm = new THREE.Group(); asm.name = n + '-assembly';
  cup.position.y = D.CUP_Y; contents.position.y = D.CUP_Y;
  asm.add(base, enc, D.buildFridge(M), cup, contents);
  await save(asm, `${n}_0-ASSEMBLY`);
  console.log('ok', n);
}
const M = D.makeMaterials({ metal: 'chrome', primary: '#0b1d3a', accent: '#3d7bd9' });
await save(D.buildFridge(M), 'REF_meling-DW-XL90-volume');
