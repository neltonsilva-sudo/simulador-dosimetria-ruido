// Gera no index.html um import map que acrescenta ?v=<hash do conteúdo> a cada módulo de src/ (e ao ui.css).
// Módulos que não mudaram mantêm a mesma versão (o navegador reaproveita o cache); os alterados são baixados de novo.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const h = (f) => createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8);
const imports = {
  three: 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js',
  'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/',
};
for (const f of readdirSync('src').filter((n) => n.endsWith('.js')).sort()) imports[`./src/${f}`] = `./src/${f}?v=${h('src/' + f)}`;
let html = readFileSync('index.html', 'utf8');
const map = `<script type="importmap">\n${JSON.stringify({ imports }, null, 1)}\n</script>`;
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, map);
html = html.replace(/src\/ui\.css(\?v=[0-9a-f]+)?/, `src/ui.css?v=${h('src/ui.css')}`);
html = html.replace(/<script type="module" src="[^"]*"><\/script>/, `<script type="module">import './src/main.js';</script>`);
writeFileSync('index.html', html);
console.log('index.html carimbado:', Object.keys(imports).length - 2, 'módulos');
