// Bundles src/ (three.js included) into one self-contained dist/index.html.
// The background render worker (src/render-worker.js) is bundled separately and embedded as an inert
// <script type="text/plain"> block; the page starts it from a Blob URL.
import { build } from 'esbuild';
import fs from 'node:fs';
const minify = !process.env.DEBUG, loader = { '.png': 'dataurl', '.jpg': 'dataurl' };
const html = fs.readFileSync('src/index.html', 'utf8');
const entry = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('src/.entry.js', entry);
const out = await build({ entryPoints: ['src/.entry.js'], bundle: true, format: 'esm', minify, target: 'es2022', write: false, loader });
fs.rmSync('src/.entry.js');
const worker = await build({ entryPoints: ['src/render-worker.js'], bundle: true, format: 'iife', minify, target: 'es2022', write: false, loader });
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');
const js = esc(out.outputFiles[0].text), wjs = esc(worker.outputFiles[0].text);
// Reference images: only from src/refs/ (git-ignored, never committed or deployed). Builds without that folder simply
// have no built-in references; the viewer then lets people add one, stored only in their own browser.
const refs = {};
for (const d of ['trophy', 'cooler']) for (const ext of ['jpg', 'png', 'webp']) { const f = `src/refs/${d}.${ext}`; if (!refs[d] && fs.existsSync(f)) refs[d] = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,` + fs.readFileSync(f).toString('base64'); }
const refTag = `<script type="application/json" id="ref-images">${JSON.stringify(refs)}</script>\n`;
const page = html.replace(/<script type="importmap">[\s\S]*?<\/script>\n/, '')
  .replace(/<script type="module">[\s\S]*?<\/script>/, () => `${refTag}<script type="text/plain" id="render-worker-src">${wjs}</script>\n<script type="module">${js}</script>`);
fs.writeFileSync('dist/index.html', page);
console.log('dist/index.html', (page.length / 1024).toFixed(0) + ' KB', '(worker', (wjs.length / 1024).toFixed(0) + ' KB) · built-in references:', Object.keys(refs).join(', ') || 'none');
