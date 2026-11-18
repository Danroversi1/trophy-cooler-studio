// Bundles src/ (three.js included) into one self-contained dist/index.html
import { build } from 'esbuild';
import fs from 'node:fs';
const html = fs.readFileSync('src/index.html', 'utf8');
const entry = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('src/.entry.js', entry);
const out = await build({ entryPoints: ['src/.entry.js'], bundle: true, format: 'esm', minify: !process.env.DEBUG, target: 'es2022', write: false, loader: { '.png': 'dataurl', '.jpg': 'dataurl' } });
fs.rmSync('src/.entry.js');
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const page = html.replace(/<script type="importmap">[\s\S]*?<\/script>\n/, '').replace(/<script type="module">[\s\S]*?<\/script>/, () => `<script type="module">${js}</script>`);
fs.writeFileSync('dist/index.html', page);
console.log('dist/index.html', (page.length / 1024).toFixed(0) + ' KB');
