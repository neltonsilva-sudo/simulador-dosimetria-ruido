// Texturas procedurais e geometrias auxiliares do item ROSTO (worker_head.js).
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
let s0 = 99; const rnd = () => ((s0 = (s0 * 16807) % 2147483647) / 2147483647);

// cabelo cacheado: base castanho-escura + centenas de arcos (cachos) com fios claros/escuros
export function mkHairTex(THREE) {
  const [c, g] = cv(512); g.fillStyle = '#1c110b'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 4 + rnd() * 9, a = rnd() * 6.28, l = rnd();
    g.strokeStyle = `rgba(${40 + l * 90 | 0},${22 + l * 50 | 0},${12 + l * 22 | 0},${0.35 + rnd() * 0.5})`; g.lineWidth = 1 + rnd() * 1.6;
    g.beginPath(); g.arc(x, y, r, a, a + 2 + rnd() * 3); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

// plástico branco do capacete: sujeira acumulada na aba/base, arranhões finos, manchas de mão; roughness e bump
export function mkHelmetTex(THREE) {
  const S = 512, [c, g] = cv(S), [cr, gr] = cv(S), [cb, gb] = cv(S);
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, S, S); gr.fillStyle = 'rgb(92,92,92)'; gr.fillRect(0, 0, S, S); gb.fillStyle = '#808080'; gb.fillRect(0, 0, S, S);
  // uv.y = 0 na base (aba) → canvas y = S (flipY)
  const grad = g.createLinearGradient(0, S, 0, S * 0.55); grad.addColorStop(0, 'rgba(120,110,95,0.28)'); grad.addColorStop(1, 'rgba(120,110,95,0)');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) { // manchas/grime
    const x = rnd() * S, y = S * (0.35 + rnd() * 0.65), r = 3 + rnd() * 22;
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(110,100,85,${0.05 + rnd() * 0.12})`); rg.addColorStop(1, 'rgba(110,100,85,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    gr.fillStyle = `rgba(170,170,170,${0.15 + rnd() * 0.2})`; gr.beginPath(); gr.arc(x, y, r * 0.7, 0, 6.28); gr.fill();
  }
  for (let i = 0; i < 420; i++) { // arranhões
    const x = rnd() * S, y = rnd() * S, a = rnd() * 6.28, l = 3 + rnd() * 26;
    g.strokeStyle = `rgba(90,85,80,${0.06 + rnd() * 0.14})`; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    gr.strokeStyle = 'rgba(200,200,200,0.5)'; gr.lineWidth = 0.8; gr.beginPath(); gr.moveTo(x, y); gr.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); gr.stroke();
    gb.strokeStyle = 'rgba(40,40,40,0.6)'; gb.lineWidth = 0.7; gb.beginPath(); gb.moveTo(x, y); gb.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); gb.stroke();
  }
  const id = gb.getImageData(0, 0, S, S), p = id.data; // micro-textura (casca de laranja do injetado)
  for (let i = 0; i < p.length; i += 4) { const n = (rnd() - 0.5) * 14; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
  gb.putImageData(id, 0, 0);
  const mk = (cc, srgb) => { const t = new THREE.CanvasTexture(cc); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: mk(c, true), rough: mk(cr), bump: mk(cb) };
}

// espuma PU do plug: poros escuros finos
export function mkFoamTex(THREE) {
  const S = 128, [c, g] = cv(S), [cb, gb] = cv(S);
  g.fillStyle = '#ffd2a8'; g.fillRect(0, 0, S, S); gb.fillStyle = '#c0c0c0'; gb.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { const x = rnd() * S, y = rnd() * S, r = 0.4 + rnd() * 1.3;
    g.fillStyle = `rgba(150,60,10,${0.15 + rnd() * 0.3})`; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill();
    gb.fillStyle = `rgba(0,0,0,${0.4 + rnd() * 0.5})`; gb.beginPath(); gb.arc(x, y, r, 0, 6.28); gb.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  const b = new THREE.CanvasTexture(cb); b.wrapS = b.wrapT = THREE.RepeatWrapping; b.repeat.set(2, 1);
  return { map: t, bump: b };
}

// globo ocular: textura em função do ângulo polar (topo do canvas = polo = centro da pupila)
export function mkIrisTex(THREE) {
  const W = 256, H = 512, [c, g] = cv(W, H);
  const yPup = H * 0.06, yIris = H * 0.19, yLimb = H * 0.215;
  g.fillStyle = '#050302'; g.fillRect(0, 0, W, yPup);
  for (let y = yPup; y < yIris; y++) for (let x = 0; x < W; x += 2) { // fibras radiais da íris castanho-escura
    const k = (y - yPup) / (yIris - yPup), n = 0.5 + 0.5 * Math.sin(x * 0.35 + Math.sin(x * 0.07) * 4) * (0.6 + rnd() * 0.4);
    const l = 0.6 + 0.6 * n * (1 - Math.abs(k - 0.45));
    g.fillStyle = `rgb(${46 * l | 0},${26 * l | 0},${14 * l | 0})`; g.fillRect(x, y, 2, 1);
  }
  g.fillStyle = '#120a06'; g.fillRect(0, yIris, W, yLimb - yIris);  // anel límbico
  const gr = g.createLinearGradient(0, yLimb, 0, H * 0.6); gr.addColorStop(0, '#d9cfc4'); gr.addColorStop(0.5, '#e6ddd2'); gr.addColorStop(1, '#c9a49a');
  g.fillStyle = gr; g.fillRect(0, yLimb, W, H - yLimb);
  for (let i = 0; i < 40; i++) { const x = rnd() * W; g.strokeStyle = 'rgba(170,60,50,0.18)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, H * 0.55); g.quadraticCurveTo(x + (rnd() - 0.5) * 30, H * 0.4, x + (rnd() - 0.5) * 20, H * 0.27); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// cacho (mola helicoidal que afina na ponta, descendo em −y); uv.x ao longo do fio → anisotropia na direção do fio
export function curlGeo(THREE, len, coil, turns, r, radial = 5, ppt = 14) {
  const pts = [], n = Math.round(turns * ppt);
  for (let i = 0; i <= n; i++) { const u = i / n, a = u * turns * Math.PI * 2, cr = coil * (1 - 0.35 * u) * (0.6 + 0.4 * Math.min(1, u * 4));
    pts.push(new THREE.Vector3(Math.cos(a) * cr, -u * len, Math.sin(a) * cr)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, Math.round(n * 1.3), r, radial, false);
  // afina a ponta
  const P = g.attributes.position, uv = g.attributes.uv, tmp = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { const u = uv.getX(i), c = curve.getPointAt(Math.min(1, u)); tmp.fromBufferAttribute(P, i).sub(c).multiplyScalar(1 - 0.6 * Math.pow(u, 3)).add(c); P.setXYZ(i, tmp.x, tmp.y, tmp.z); }
  g.computeVertexNormals(); return g;
}

// ambiente local do galpão (equiretangular) p/ reflexos nítidos no capacete e nos óculos: teto escuro com fileiras de
// luminárias tubulares e claraboias, parede/máquinas no horizonte, piso de concreto
export function mkCeilingEnv(THREE, renderer) {
  const W = 1024, H = 512, [c, g] = cv(W, H);
  const sky = g.createLinearGradient(0, 0, 0, H / 2); sky.addColorStop(0, '#5d5f62'); sky.addColorStop(1, '#8b8c88');
  g.fillStyle = sky; g.fillRect(0, 0, W, H / 2);
  for (let r = 0; r < 7; r++) { const el = 0.12 + r * 0.055, y = H * el, h = 6 + (7 - r) * 1.5; // fileiras de tubulares
    for (let x = 0; x < W; x += 128) { g.fillStyle = '#ffffff'; g.fillRect(x + 20 + r * 9, y, 70 - r * 4, h); } }
  g.fillStyle = 'rgba(255,255,250,0.9)'; g.fillRect(W * 0.3, 8, W * 0.2, 30); g.fillRect(W * 0.72, 14, W * 0.16, 22); // claraboias
  g.strokeStyle = 'rgba(30,30,32,0.8)'; g.lineWidth = 3; for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 30, H * 0.45); g.stroke(); } // treliças
  const hor = g.createLinearGradient(0, H * 0.42, 0, H * 0.58); hor.addColorStop(0, '#9a9c8e'); hor.addColorStop(0.5, '#7d8a76'); hor.addColorStop(1, '#5c5850');
  g.fillStyle = hor; g.fillRect(0, H * 0.42, W, H * 0.16);
  for (let i = 0; i < 40; i++) { g.fillStyle = ['#8e9a84', '#b8b2a0', '#5e6460', '#a39c86'][i % 4]; g.fillRect(rnd() * W, H * (0.4 + rnd() * 0.1), 20 + rnd() * 80, 20 + rnd() * 40); }
  const fl = g.createLinearGradient(0, H * 0.55, 0, H); fl.addColorStop(0, '#6a665e'); fl.addColorStop(1, '#3e3b36'); g.fillStyle = fl; g.fillRect(0, H * 0.56, W, H * 0.44);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  if (!renderer) return t;
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromEquirectangular(t); pm.dispose(); t.dispose(); return rt.texture;
}
