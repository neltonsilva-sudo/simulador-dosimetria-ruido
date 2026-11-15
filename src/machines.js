// MÁQUINAS — prensas excêntricas (biela-manivela real), prensa hidráulica, painel CNC, esmeril com faíscas,
// compressor, exaustor de telhado, névoa de óleo. API: buildMachines(stage, app) (docs/CONTRACT.md).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MACHINES } from './layout_machines.js';
import { mat, idPlate, safetySign, labelMat, MODERN } from './mach_tex.js';

// ── geometria utilitária: UV por projeção em caixa (densidade constante) + atributo de borda (desgaste) ──
function prep(geo, edge = true, scale = 1 / 1.1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2), e = new Float32Array(p.count);
  const off = [Math.random() * 7, Math.random() * 7];
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v; if (nx >= ny && nx >= nz) { u = p.getZ(i); v = p.getY(i); } else if (ny >= nz) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * scale + off[0]; uv[i * 2 + 1] = v * scale + off[1];
    e[i] = edge ? Math.min(1, (1 - Math.max(nx, ny, nz)) / 0.25) : 0;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aEdge', new THREE.BufferAttribute(e, 1));
  return g;
}
function M(parent, geo, key, x, y, z, { rx = 0, ry = 0, rz = 0, edge = true, shadow = true } = {}) {
  const m = new THREE.Mesh(prep(geo, edge), typeof key === 'string' ? mat(key) : key);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
const rb = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.1, h / 2.1, d / 2.1));
const cyl = (r1, r2, h, s = 24, hs = 1, open = false, t0 = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(r1, r2, h, s, hs, open, t0, tl);
const boltGeo = (() => { const h = new THREE.CylinderGeometry(0.012, 0.012, 0.012, 6); h.translate(0, 0.006, 0); const w = new THREE.CylinderGeometry(0.017, 0.017, 0.003, 12); w.translate(0, 0.0015, 0);
  const a = h.toNonIndexed(), b = w.toNonIndexed(); const pos = new Float32Array([...a.attributes.position.array, ...b.attributes.position.array]); const nor = new Float32Array([...a.attributes.normal.array, ...b.attributes.normal.array]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return prep(g, false); })();

// ── parafusos instanciados (todas as máquinas) ──
const boltList = [];
function bolt(parent, x, y, z, nx = 0, ny = 0, nz = 1, s = 1) {
  const o = new THREE.Object3D(); o.position.set(x, y, z); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, ny, nz).normalize()); o.scale.setScalar(s); parent.add(o); boltList.push(o);
}

// ── prensa excêntrica C ──
// ── acessórios de máquina moderna (NR-12): cortina de luz, proteções laterais em policarbonato, torre de sinalização, IHM touch ──
let hmiTexture = null;
function hmiTex() {
  if (hmiTexture) return hmiTexture;
  const c = document.createElement('canvas'); c.width = 512; c.height = 384; const x = c.getContext('2d');
  x.fillStyle = '#0f151c'; x.fillRect(0, 0, 512, 384); x.fillStyle = '#2364ad'; x.fillRect(0, 0, 512, 40);
  x.fillStyle = '#fff'; x.font = '600 20px Arial'; x.fillText('PRENSA SERVO · AUTO', 14, 27); x.fillStyle = '#22e36a'; x.beginPath(); x.arc(486, 20, 8, 0, 7); x.fill();
  const tile = (tx, ty, w, h, label, val, col) => { x.fillStyle = '#1a232d'; x.beginPath(); x.roundRect(tx, ty, w, h, 10); x.fill(); x.fillStyle = '#8fa3b5'; x.font = '15px Arial'; x.fillText(label, tx + 12, ty + 24); x.fillStyle = col; x.font = 'bold 34px Arial'; x.fillText(val, tx + 12, ty + 66); };
  tile(14, 54, 154, 86, 'CADÊNCIA', '40 gpm', '#fff'); tile(180, 54, 154, 86, 'OEE', '87 %', '#22e36a'); tile(346, 54, 152, 86, 'FORÇA', '62 t', '#ffd34a');
  x.fillStyle = '#1a232d'; x.beginPath(); x.roundRect(14, 152, 484, 160, 10); x.fill(); x.strokeStyle = '#3fa0ff'; x.lineWidth = 3; x.beginPath();
  for (let i = 0; i <= 120; i++) { const t = i / 120, X = 30 + t * 450, Y = 290 - Math.max(0, Math.sin(t * Math.PI * 3) ** 8) * 110 - 8; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke();
  x.fillStyle = '#8fa3b5'; x.font = '14px Arial'; x.fillText('Curva força × curso', 26, 174);
  ['INÍCIO', 'RECEITA', 'ALARMES', 'MANUT.'].forEach((t, i) => { x.fillStyle = i ? '#1f2a36' : '#2364ad'; x.beginPath(); x.roundRect(14 + i * 123, 324, 115, 46, 8); x.fill(); x.fillStyle = '#fff'; x.font = '600 16px Arial'; x.fillText(t, 30 + i * 123, 353); });
  hmiTexture = new THREE.CanvasTexture(c); hmiTexture.colorSpace = THREE.SRGBColorSpace; hmiTexture.anisotropy = 4; return hmiTexture;
}
function hmi(parent, x, y, z, ry = 0, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); parent.add(g);
  M(g, rb(0.36, 0.27, 0.05, 0.015), 'graphite', 0, 0, 0);
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.24), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: hmiTex(), emissiveIntensity: 0.55, roughness: 0.12 }));
  sc.position.z = 0.0255; sc.userData.noAO = true; g.add(sc);
  return g;
}
function signalTower(parent, x, y, z) {
  M(parent, cyl(0.03, 0.035, 0.03), 'graphite', x, y + 0.015, z, { edge: false });
  M(parent, cyl(0.012, 0.012, 0.16), 'chrome', x, y + 0.11, z, { edge: false });
  ['ledR', 'ledA', 'ledG'].forEach((k, i) => M(parent, cyl(0.035, 0.035, 0.07, 20), k, x, y + 0.42 - i * 0.075, z, { edge: false, shadow: false }));
  M(parent, cyl(0.035, 0.032, 0.03, 20), 'graphite', x, y + 0.21, z, { edge: false });
  M(parent, cyl(0.03, 0.035, 0.02, 20), 'graphite', x, y + 0.465, z, { edge: false });
}
function lightCurtain(parent, x0, x1, y0, y1, z) {
  for (const x of [x0, x1]) {
    M(parent, rb(0.045, y1 - y0, 0.04, 0.008), 'yellow', x, (y0 + y1) / 2, z);
    M(parent, new THREE.BoxGeometry(0.012, y1 - y0 - 0.06, 0.004), 'curtain', x + (x < 0 ? 0.023 : -0.023), (y0 + y1) / 2, z, { edge: false, shadow: false });
    M(parent, rb(0.07, 0.03, 0.06, 0.006), 'graphite', x, y0 - 0.015, z);
  }
}
function polyGuard(parent, x, y0, y1, z0, z1) {
  const h = y1 - y0, d = z1 - z0, y = (y0 + y1) / 2, z = (z0 + z1) / 2;
  M(parent, new THREE.BoxGeometry(0.006, h - 0.04, d - 0.04), 'poly', x, y, z, { edge: false, shadow: false });
  for (const [yy, hh, dd, zz] of [[y0, 0.03, d, z], [y1, 0.03, d, z]]) M(parent, rb(0.03, hh, dd, 0.006), 'yellow', x, yy, zz);
  for (const zz of [z0, z1]) M(parent, rb(0.03, h, 0.03, 0.006), 'yellow', x, y, zz);
}
function buildPress(def, scheme, s = 1) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(s);
  // perfil C do corpo fundido (z,y)
  const sh = new THREE.Shape();
  sh.moveTo(-0.72, 0.1); sh.lineTo(0.42, 0.1); sh.lineTo(0.42, 0.8); sh.lineTo(-0.05, 0.8);
  sh.quadraticCurveTo(-0.2, 0.8, -0.2, 0.98); sh.lineTo(-0.2, 1.75); sh.quadraticCurveTo(-0.2, 1.9, -0.05, 1.92);
  sh.lineTo(0.46, 1.92); sh.lineTo(0.5, 2.45); sh.quadraticCurveTo(0.5, 2.58, 0.36, 2.58); sh.lineTo(-0.6, 2.58); sh.quadraticCurveTo(-0.72, 2.58, -0.72, 2.45); sh.lineTo(-0.72, 0.1);
  const cg = new THREE.ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: true, bevelSize: 0.055, bevelThickness: 0.055, bevelSegments: 4, curveSegments: 16 });
  cg.rotateY(-Math.PI / 2); cg.translate(0.35, 0, 0); cg.computeVertexNormals();
  M(body, cg, scheme, 0, 0, 0);
  // nervuras laterais (flanges fundidas)
  for (const sx of [-1, 1]) { M(body, rb(0.05, 1.7, 0.12, 0.02), scheme, sx * 0.4, 0.95, -0.62); M(body, rb(0.05, 0.12, 1.1, 0.02), scheme, sx * 0.4, 2.5, -0.1); M(body, rb(0.05, 0.6, 0.1, 0.02), scheme, sx * 0.4, 0.45, 0.32, { rx: 0 }); }
  // filetes de fundição: arestas frontais arredondadas (colunas cilíndricas), bossa redonda no cabeçote com parafusos grandes
  for (const sx of [-1, 1]) {
    M(body, cyl(0.075, 0.075, 0.66, 20), scheme, sx * 0.355, 0.45, 0.385, { edge: false });
    M(body, cyl(0.08, 0.08, 0.5, 20), scheme, sx * 0.355, 2.2, 0.44, { rx: -0.07, edge: false });
    M(body, new THREE.TorusGeometry(0.11, 0.05, 10, 20, Math.PI / 2), scheme, sx * 0.355, 0.82, 0.32, { ry: Math.PI / 2, rz: Math.PI, edge: false });
  }
  M(body, rb(0.64, 0.5, 0.08, 0.06), scheme, 0, 2.2, 0.49, { rx: -0.07 });
  M(body, cyl(0.14, 0.155, 0.07, 32), scheme, 0, 2.24, 0.55, { rx: Math.PI / 2, edge: false });
  M(body, new THREE.TorusGeometry(0.15, 0.022, 8, 32), scheme, 0, 2.24, 0.555, { edge: false });
  M(body, cyl(0.06, 0.06, 0.05, 6), 'blacksteel', 0, 2.24, 0.595, { rx: Math.PI / 2, edge: false });
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; bolt(body, Math.cos(a) * 0.11, 2.24 + Math.sin(a) * 0.11, 0.588, 0, 0, 1, 1.25); }
  for (const [x, y] of [[-0.25, 2.04], [0.25, 2.04], [-0.25, 2.38], [0.25, 2.38]]) bolt(body, x, y, 0.535, 0, 0.07, 1, 2.0);
  // base, pés antivibração, mesa e bolster
  M(body, rb(1.0, 0.1, 1.5, 0.02), 'dksteel', 0, 0.05, -0.15);
  for (const [x, z] of [[-0.42, -0.8], [0.42, -0.8], [-0.42, 0.5], [0.42, 0.5]]) M(body, cyl(0.06, 0.07, 0.05), 'rubber', x, 0.02, z, { edge: false });
  M(body, rb(1.0, 0.09, 0.66, 0.012), 'dksteel', 0, 0.835, 0.15);
  M(body, cyl(0.06, 0.06, 0.78, 20), scheme, 0, 0.77, 0.43, { rz: Math.PI / 2, edge: false });        // lábio boleado da base
  M(body, rb(0.5, 0.42, 0.03, 0.03), scheme, 0, 0.42, 0.47);                                         // tampa de inspeção fundida
  for (const x of [-0.25, 0, 0.25]) M(body, new THREE.BoxGeometry(0.03, 0.012, 0.64), 'blacksteel', x, 0.877, 0.15, { edge: false, shadow: false });
  // estampo (base inferior + colunas-guia + matriz) e chapa
  M(body, rb(0.6, 0.07, 0.42, 0.01), 'blacksteel', 0, 0.915, 0.12);
  M(body, rb(0.34, 0.11, 0.26, 0.01), 'dksteel', 0, 1.005, 0.12);
  for (const x of [-0.24, 0.24]) M(body, cyl(0.022, 0.022, 0.36, 16), 'chrome', x, 1.13, 0.12, { edge: false });
  M(body, new THREE.BoxGeometry(1.1, 0.003, 0.14), 'sheet', -0.05, 1.062, 0.12, { edge: false, shadow: false });
  for (let i = 0; i < 6; i++) M(body, new THREE.BoxGeometry(0.08 + Math.random() * 0.06, 0.002, 0.04 + Math.random() * 0.04), 'sheet', (Math.random() - 0.5) * 0.8, 0.882, 0.3 + Math.random() * 0.08, { ry: Math.random() * 3, edge: false, shadow: false });
  // guias (gibs) com parafusos
  for (const sx of [-1, 1]) { M(body, rb(0.08, 0.62, 0.36, 0.01), 'dksteel', sx * 0.31, 1.61, 0.12); for (let k = 0; k < 4; k++) bolt(body, sx * 0.31, 1.37 + k * 0.16, 0.302, 0, 0, 1, 1.7); }
  // mancais do virabrequim + tampas com círculo de parafusos
  for (const sx of [-1, 1]) {
    M(body, cyl(0.17, 0.17, 0.08, 32), scheme, sx * 0.43, 2.18, 0.12, { rz: Math.PI / 2, edge: false });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; bolt(body, sx * 0.47, 2.18 + Math.sin(a) * 0.12, 0.12 + Math.cos(a) * 0.12, sx, 0, 0); }
  }
  // embreagem/freio (lado +x) + mangueira de ar
  M(body, cyl(0.2, 0.2, 0.16, 32), 'grey', 0.56, 2.18, 0.12, { rz: Math.PI / 2, edge: false });
  M(body, cyl(0.05, 0.05, 0.08), 'brass', 0.68, 2.18, 0.12, { rz: Math.PI / 2, edge: false });
  const hp = new THREE.CatmullRomCurve3([new THREE.Vector3(0.72, 2.18, 0.12), new THREE.Vector3(0.82, 2.0, 0.0), new THREE.Vector3(0.6, 1.5, -0.4), new THREE.Vector3(0.45, 1.3, -0.5)]);
  M(body, new THREE.TubeGeometry(hp, 24, 0.012, 8), 'hose', 0, 0, 0, { edge: false });
  // volante (lado −x, gira) + proteção amarela com tela
  const fly = new THREE.Group(); fly.position.set(-0.56, 2.18, 0.12); body.add(fly);
  M(fly, new THREE.TorusGeometry(0.46, 0.05, 10, 48), 'dksteel', 0, 0, 0, { ry: Math.PI / 2, edge: false });
  M(fly, cyl(0.47, 0.47, 0.13, 48, true), 'dksteel', 0, 0, 0, { rz: Math.PI / 2, edge: false });
  M(fly, cyl(0.09, 0.09, 0.18), 'blacksteel', 0, 0, 0, { rz: Math.PI / 2, edge: false });
  for (let k = 0; k < 6; k++) M(fly, rb(0.05, 0.4, 0.07, 0.02), scheme, 0, 0, 0, { rx: (k / 6) * Math.PI * 2 }).geometry.translate(0, 0.25, 0);
  // proteção fechada do volante em chapa/fundido pintado (sem grade), com friso amarelo e parafusos na tampa
  const guardK = MODERN ? 'accent' : scheme;
  M(body, cyl(0.56, 0.56, 0.17, 56), guardK, -0.62, 2.18, 0.12, { rz: Math.PI / 2, edge: false });
  M(body, cyl(0.5, 0.52, 0.03, 56), guardK, -0.715, 2.18, 0.12, { rz: Math.PI / 2, edge: false });
  M(body, cyl(0.13, 0.15, 0.05, 32), guardK, -0.75, 2.18, 0.12, { rz: Math.PI / 2, edge: false });
  M(body, new THREE.TorusGeometry(0.555, 0.012, 6, 64), 'yellow', -0.705, 2.18, 0.12, { ry: Math.PI / 2, edge: false, shadow: false });
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; bolt(body, -0.73, 2.18 + Math.sin(a) * 0.47, 0.12 + Math.cos(a) * 0.47, -1, 0, 0); }
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; bolt(body, -0.775, 2.18 + Math.sin(a) * 0.1, 0.12 + Math.cos(a) * 0.1, -1, 0, 0, 0.8); }
  // motor no topo traseiro
  M(body, cyl(0.15, 0.15, 0.42, 24), 'dkgreen', -0.15, 2.78, -0.48, { rz: Math.PI / 2, edge: false });
  for (let k = 0; k < 10; k++) M(body, cyl(0.165, 0.165, 0.008, 24), 'dkgreen', -0.33 + k * 0.04, 2.78, -0.48, { rz: Math.PI / 2, edge: false, shadow: false });
  M(body, rb(0.14, 0.1, 0.12), 'dkgreen', -0.1, 2.95, -0.48);
  // conduíte elétrico
  const cp = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.1, 3.0, -0.45), new THREE.Vector3(-0.1, 2.9, -0.8), new THREE.Vector3(-0.2, 1.5, -0.82), new THREE.Vector3(-0.3, 0.05, -0.95)]);
  M(body, new THREE.TubeGeometry(cp, 30, 0.018, 8), 'conduit', 0, 0, 0, { edge: false });
  // lubrificação centralizada (reservatório âmbar) + linhas de cobre
  M(body, rb(0.12, 0.2, 0.1), 'grey', 0.42, 1.25, -0.4); M(body, cyl(0.035, 0.035, 0.12), 'oilglass', 0.42, 1.42, -0.4, { edge: false });
  for (const [y, z] of [[1.8, 0.2], [2.1, 0.12], [1.5, 0.25]]) { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0.45, 1.3, -0.38), new THREE.Vector3(0.46, y - 0.1, -0.1), new THREE.Vector3(0.38, y, z)]); M(body, new THREE.TubeGeometry(c, 16, 0.004, 6), 'copper', 0, 0, 0, { edge: false, shadow: false }); }
  // mangueira de óleo laranja até o bico sobre a matriz
  const oh = new THREE.CatmullRomCurve3([new THREE.Vector3(0.44, 1.2, -0.36), new THREE.Vector3(0.52, 1.35, 0.05), new THREE.Vector3(0.4, 1.38, 0.42), new THREE.Vector3(0.22, 1.2, 0.46), new THREE.Vector3(0.18, 1.12, 0.36)]);
  M(body, new THREE.TubeGeometry(oh, 40, 0.011, 8), 'hoseOrange', 0, 0, 0, { edge: false });
  M(body, cyl(0.008, 0.005, 0.07, 8), 'brass', 0.18, 1.09, 0.36, { edge: false, shadow: false });
  // painel elétrico lateral
  M(body, rb(0.1, 0.5, 0.36), 'grey', 0.46, 1.35, -0.25);
  if (MODERN) {
    lightCurtain(body, -0.43, 0.43, 0.92, 1.62, 0.52);                     // cortina de luz na zona de prensagem
    for (const sx of [-1, 1]) polyGuard(body, sx * 0.47, 0.9, 1.78, -0.18, 0.46); // proteções laterais fixas em policarbonato
    signalTower(body, 0.3, 2.63, 0.28);                                     // torre de sinalização (verde = produzindo)
    M(body, cyl(0.016, 0.016, 0.42), 'graphite', 0.62, 1.86, 0.32, { rz: 0.9, edge: false });  // braço da IHM
    hmi(body, 0.82, 1.62, 0.5, -0.5);
    M(body, rb(0.22, 0.6, 0.5, 0.02), 'grey', 0.6, 1.05, -0.45);            // quadro de comando/servo
    M(body, new THREE.BoxGeometry(0.004, 0.5, 0.012), 'accent', 0.711, 1.05, -0.24, { edge: false, shadow: false });
  }
  // plaquetas
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), idPlate([def.name.toUpperCase(), 'Nº SÉRIE 0' + (127 + def.pos[2] * -3 | 0) + '  ANO ' + (MODERN ? '2024' : '1979'), 'CURSO 100 mm  •  ' + (def.spm || 40) + ' gpm', 'MOTOR 7,5 cv  380 V  60 Hz']));
  pl.position.set(0.1, 2.3, 0.535); body.add(pl);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.13), safetySign('perigo', ['Risco de', 'esmagamento'])); sg.position.set(-0.32, 0.55, 0.453); body.add(sg);
  const sg2 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.13), safetySign('obrig', ['Protetor', 'auricular'])); sg2.position.set(-0.4 - 0.036, 1.4, -0.4); sg2.rotation.y = -Math.PI / 2; body.add(sg2);
  // martelo (ram) + biela
  const ram = new THREE.Group(); body.add(ram);
  M(ram, rb(0.5, 0.28, 0.34, 0.015), scheme, 0, -0.14, 0.12);
  M(ram, cyl(0.085, 0.095, 0.05, 28), scheme, 0, -0.11, 0.31, { rx: Math.PI / 2, edge: false });
  M(ram, cyl(0.035, 0.035, 0.05, 6), 'blacksteel', 0, -0.11, 0.345, { rx: Math.PI / 2, edge: false });
  M(ram, rb(0.6, 0.085, 0.4, 0.015), 'yellow', 0, -0.32, 0.12);               // porta-matriz amarelo
  M(ram, rb(0.36, 0.09, 0.27, 0.01), 'dksteel', 0, -0.405, 0.12);            // bloco da matriz superior
  M(ram, cyl(0.03, 0.03, 0.12, 16), 'steel', 0, -0.48, 0.12, { edge: false });
  for (const x of [-0.18, 0.18]) for (const z of [0.02, 0.22]) bolt(ram, x, -0.35, z, 0, -1, 0);
  const rod = new THREE.Group(); body.add(rod);
  M(rod, rb(0.11, 0.4, 0.09, 0.03), 'dksteel', 0, -0.2, 0); M(rod, cyl(0.045, 0.045, 0.2, 16), 'steel', 0, -0.47, 0, { edge: false });
  M(rod, cyl(0.07, 0.07, 0.05, 6), 'blacksteel', 0, -0.4, 0, { edge: false });
  // pedal e comando bimanual
  M(body, rb(0.25, 0.1, 0.32), 'yellow', -0.2, 0.05, 0.85);
  const bim = new THREE.Group(); bim.position.set(-0.62, 0, 0.72); bim.scale.setScalar(0.66); body.add(bim);
  M(bim, cyl(0.03, 0.03, 0.95), 'grey', 0, 0.47, 0, { edge: false }); M(bim, cyl(0.15, 0.15, 0.02), 'grey', 0, 0.01, 0, { edge: false });
  M(bim, rb(0.5, 0.13, 0.2), 'grey', 0, 1.0, 0, { rx: -0.35 });
  for (const x of [-0.17, 0.17]) { M(bim, cyl(0.035, 0.035, 0.035), 'green', x, 1.07, 0.02, { rx: -0.35, edge: false }); M(bim, cyl(0.05, 0.05, 0.03, 16, 1, true), 'yellow', x, 1.06, 0.02, { rx: -0.35, edge: false }); }
  M(bim, cyl(0.03, 0.03, 0.04), 'red', 0, 1.08, 0.03, { rx: -0.35, edge: false }); M(bim, cyl(0.016, 0.016, 0.03), 'orange', 0.08, 1.05, 0.06, { rx: -0.35, edge: false });
  // poça de óleo / sombra de contato
  const pud = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false }));
  pud.rotation.x = -Math.PI / 2; pud.scale.set(1.6, 1.2, 1); pud.position.set(0, 0.004, 0.25); pud.renderOrder = 1; pud.userData.noAO = true; if (!MODERN) body.add(pud);
  return { root, body, fly, ram, rod, kind: 'press' };
}

// ── prensa hidráulica 4 colunas ──
function buildHyd() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  M(body, rb(1.4, 0.9, 1.1, 0.04), 'hyd', 0, 0.45, 0); M(body, rb(1.3, 0.08, 1.0, 0.01), 'steel', 0, 0.94, 0);
  for (const x of [-0.55, 0.55]) for (const z of [-0.4, 0.4]) M(body, cyl(0.065, 0.065, 2.0), 'chrome', x, 1.95, z, { edge: false });
  M(body, rb(1.45, 0.5, 1.15, 0.04), 'hyd', 0, 3.1, 0); M(body, cyl(0.25, 0.25, 0.7, 32), 'hyd', 0, 3.6, 0, { edge: false });
  const ram = new THREE.Group(); body.add(ram); M(ram, rb(1.3, 0.25, 1.0, 0.03), 'hyd', 0, 0, 0); M(ram, cyl(0.16, 0.16, 0.9), 'chrome', 0, 0.55, 0, { edge: false });
  M(body, rb(0.5, 0.6, 0.6), 'hyd', 1.05, 0.3, 0.1); M(body, cyl(0.12, 0.12, 0.35), 'dkgreen', 1.05, 0.75, 0.1, { rz: Math.PI / 2, edge: false });
  for (let i = 0; i < 3; i++) { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(1.0, 0.6, 0.2 - i * 0.1), new THREE.Vector3(1.3, 1.8, 0.1 - i * 0.1), new THREE.Vector3(0.6, 3.3, -0.2 - i * 0.05)]); M(body, new THREE.TubeGeometry(c, 30, 0.016, 8), 'hose', 0, 0, 0, { edge: false }); }
  if (MODERN) {
    lightCurtain(body, -0.72, 0.72, 1.0, 2.2, 0.62);
    for (const sx of [-1, 1]) polyGuard(body, sx * 0.72, 1.0, 2.6, -0.5, 0.5);
    signalTower(body, 0.55, 3.35, 0.45); hmi(body, 1.15, 1.45, 0.55, -0.6, 1.1);
  }
  return { root, body, ram, kind: 'hyd' };
}

// ── painel CNC ──
function screenCanvas() { const c = document.createElement('canvas'); c.width = 512; c.height = 384; return c; }
function drawScreen(c, strokes, t) {
  if (MODERN) { // IHM touch moderna (tema escuro)
    const x = c.getContext('2d'); x.fillStyle = '#0f151c'; x.fillRect(0, 0, 512, 384); x.fillStyle = '#2364ad'; x.fillRect(0, 0, 512, 40);
    x.fillStyle = '#fff'; x.font = '600 20px Arial'; x.fillText('LINHA 1 · PRENSA 80 t · AUTO', 14, 27); x.fillStyle = '#22e36a'; x.beginPath(); x.arc(488, 20, 8, 0, 7); x.fill();
    const tile = (tx, ty, w, h, label, val, col) => { x.fillStyle = '#1a232d'; x.beginPath(); x.roundRect(tx, ty, w, h, 10); x.fill(); x.fillStyle = '#8fa3b5'; x.font = '15px Arial'; x.fillText(label, tx + 12, ty + 24); x.fillStyle = col; x.font = 'bold 32px Arial'; x.fillText(val, tx + 12, ty + 64); };
    tile(14, 52, 236, 84, 'GOLPES', String(strokes).padStart(6, '0'), '#ffd34a'); tile(262, 52, 236, 84, 'CADÊNCIA', '40 gpm', '#fff');
    tile(14, 146, 236, 84, 'OEE', (86 + Math.sin(t * 0.2) * 1.5).toFixed(1) + ' %', '#22e36a'); tile(262, 146, 236, 84, 'TEMP. ÓLEO', '41 °C', '#3fa0ff');
    x.fillStyle = '#1a232d'; x.beginPath(); x.roundRect(14, 240, 484, 74, 10); x.fill();
    for (let i = 0; i < 12; i++) { const hh = 14 + ((i * 37 + Math.floor(t)) % 7) * 6; x.fillStyle = i === 11 ? '#3fa0ff' : '#2b5f95'; x.fillRect(30 + i * 38, 302 - hh, 26, hh); }
    x.fillStyle = '#8fa3b5'; x.font = '13px Arial'; x.fillText('Produção por hora', 26, 258);
    ['INÍCIO', 'RECEITA', 'ALARMES', 'MANUT.'].forEach((s, i) => { x.fillStyle = i ? '#1f2a36' : '#2364ad'; x.beginPath(); x.roundRect(14 + i * 123, 326, 115, 46, 8); x.fill(); x.fillStyle = '#fff'; x.font = '600 16px Arial'; x.fillText(s, 30 + i * 123, 355); });
    return;
  }
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, '#0d3a8c'); g.addColorStop(1, '#06205a');
  x.fillStyle = g; x.fillRect(0, 0, 512, 384); x.fillStyle = '#2d6fd6'; x.fillRect(0, 0, 512, 34);
  x.fillStyle = '#fff'; x.font = 'bold 20px monospace'; x.fillText('PROGRAMA O0127   N0040', 10, 24); x.fillText('AUTO', 440, 24);
  x.font = '22px monospace'; x.fillStyle = '#cfe2ff';
  [['X', 412.035], ['Y', -18.400], ['Z', 125.000]].forEach(([a, v], i) => { x.fillText(`${a}`, 20, 76 + i * 34); x.fillStyle = '#fff'; x.fillText((v + Math.sin(t + i) * 0.01).toFixed(3).padStart(10), 60, 76 + i * 34); x.fillStyle = '#cfe2ff'; });
  x.fillStyle = '#ffd34a'; x.fillText('GOLPES ' + String(strokes).padStart(7, '0'), 20, 196); x.fillStyle = '#9fe39f'; x.fillText('F 100%   S 40 gpm', 20, 230);
  x.fillStyle = '#7fb0ff'; x.font = '16px monospace'; x.fillText('LUBRIF. OK   AR 6,2 bar   TEMP 41°C', 20, 266);
  for (let i = 0; i < 6; i++) { x.fillStyle = '#1b4fae'; x.fillRect(8 + i * 84, 340, 78, 36); x.fillStyle = '#fff'; x.font = '15px monospace'; x.fillText(['POS', 'PROG', 'OFS', 'SYS', 'MSG', 'GRAF'][i], 22 + i * 84, 364); }
}
function buildPanel() {
  // local: face de comando voltada para +z (para a trabalhadora), +x = lado da câmera da foto
  const root = new THREE.Group();
  M(root, rb(1.05, 0.98, 0.86, 0.13), 'olive', 0.12, 0.49, -0.2);         // base volumosa arredondada
  M(root, cyl(0.12, 0.12, 0.9, 24), 'olive', 0.08, 0.86, 0.1, { rz: Math.PI / 2, edge: false });   // borda frontal boleada
  M(root, rb(0.62, 1.12, 0.95, 0.14), 'olive', 0.86, 0.56, -0.3);         // carcaça lateral (lado da câmera)
  M(root, rb(0.8, 1.12, 0.44, 0.07), 'sage', 0.04, 1.5, -0.3);           // gabinete superior
  M(root, rb(0.58, 1.45, 0.82, 0.09), 'sage', 0.72, 1.62, -0.42);        // lateral alta da máquina
  M(root, rb(0.68, 0.62, 0.06, 0.035), 'pendant', 0.0, 1.24, -0.065);    // placa dos botões
  M(root, cyl(0.014, 0.014, 0.42), 'chrome', 0.06, 0.94, 0.25, { rz: Math.PI / 2, edge: false });   // puxador
  for (const x of [-0.15, 0.27]) M(root, cyl(0.018, 0.018, 0.08, 10), 'chrome', x, 0.94, 0.2, { rx: Math.PI / 2, edge: false });
  // console inclinado no alto: tela pequena + teclado de membrana (~1,65–1,90 m)
  const con = new THREE.Group(); con.position.set(0, 1.51, -0.06); con.rotation.x = 0.16; root.add(con);
  M(con, rb(0.5, 0.36, 0.09, 0.03), 'pendant', 0.0, 0.17, 0.0);
  M(con, rb(0.5, 0.025, 0.012, 0.004), 'yellow', 0.0, 0.335, 0.046, { edge: false });
  M(con, rb(0.21, 0.18, 0.02, 0.008), 'blackplastic', -0.1, 0.18, 0.046);
  M(con, rb(0.13, 0.29, 0.008, 0.006), 'greyplastic', 0.12, 0.165, 0.047, { edge: false });
  const sc = screenCanvas(); drawScreen(sc, 12345, 0); const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.175, 0.132), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.4, roughness: 0.15 }));
  scr.position.set(-0.1, 0.185, 0.0575); scr.userData.noAO = true; con.add(scr);
  const keyG = new RoundedBoxGeometry(0.03, 0.021, 0.006, 2, 0.003);
  const keys = new THREE.InstancedMesh(keyG, new THREE.MeshStandardMaterial({ roughness: 0.55 }), 64); let k = 0; const o = new THREE.Object3D(), cc = new THREE.Color();
  for (let r = 0; r < 10; r++) for (let c = 0; c < 3; c++) { o.position.set(0.085 + c * 0.036, 0.295 - r * 0.026, 0.053); o.updateMatrix(); keys.setMatrixAt(k, o.matrix); keys.setColorAt(k++, cc.set(r < 2 ? 0x3d6fb0 : r > 7 ? 0x2f8a8a : (r + c) % 4 === 0 ? 0x3d6fb0 : 0xd6d4c8)); }
  for (let c = 0; c < 6; c++) { o.position.set(-0.19 + c * 0.034, 0.072, 0.053); o.updateMatrix(); keys.setMatrixAt(k, o.matrix); keys.setColorAt(k++, cc.set(0x4a4c4e)); }
  keys.count = k; con.add(keys);
  const panelButton = new THREE.Object3D(); panelButton.position.set(0.085, 0.139, 0.058); con.add(panelButton);
  // botões e seletores redondos no meio (~1,15–1,45 m)
  const fz = -0.033;
  M(root, cyl(0.05, 0.055, 0.035, 32), 'chrome', -0.23, 1.41, fz + 0.02, { rx: Math.PI / 2, edge: false });
  M(root, cyl(0.03, 0.03, 0.03, 20), 'blackplastic', -0.23, 1.41, fz + 0.05, { rx: Math.PI / 2, edge: false });
  for (const [x, y] of [[-0.08, 1.42], [0.04, 1.42], [0.16, 1.42], [-0.08, 1.31], [0.04, 1.31]]) {
    M(root, cyl(0.026, 0.03, 0.03, 20), 'blackplastic', x, y, fz + 0.015, { rx: Math.PI / 2, edge: false });
    M(root, new THREE.BoxGeometry(0.008, 0.034, 0.014), 'greyplastic', x, y, fz + 0.035, { rz: (x * 13) % 1.2, edge: false });
  }
  for (const [x, y, col] of [[-0.24, 1.3, 'green'], [-0.16, 1.3, 'red'], [0.16, 1.33, 'yellow'], [-0.24, 1.2, 'yellow'], [-0.16, 1.2, 'green']]) {
    M(root, cyl(0.024, 0.024, 0.012, 20), 'greyplastic', x, y, fz + 0.008, { rx: Math.PI / 2, edge: false });
    M(root, cyl(0.017, 0.017, 0.02, 20), col, x, y, fz + 0.018, { rx: Math.PI / 2, edge: false });
  }
  M(root, cyl(0.045, 0.045, 0.015), 'yellow', 0.17, 1.12, fz + 0.01, { rx: Math.PI / 2, edge: false });
  M(root, new THREE.SphereGeometry(0.033, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'red', 0.17, 1.12, fz + 0.02, { rx: Math.PI / 2, edge: false });
  M(root, cyl(0.014, 0.014, 0.02), 'brass', 0.04, 1.12, fz + 0.012, { rx: Math.PI / 2, edge: false });
  const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.035), labelMat((x, w, h) => { x.fillStyle = '#e6e2d4'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.font = 'bold 34px Arial'; x.fillText('EMERGÊNCIA', 12, 40); }, 256, 56));
  lb.position.set(0.15, 1.055, fz + 0.002); root.add(lb);
  return { root, panelButton, screen: scr, sc, st, kind: 'panel' };
}

// ── esmeril de pedestal, compressor, exaustor ──
function buildGrinder() {
  const root = new THREE.Group();
  M(root, cyl(0.09, 0.16, 0.9), 'dkgreen', 0, 0.45, 0, { edge: false }); M(root, cyl(0.25, 0.25, 0.04), 'dkgreen', 0, 0.02, 0, { edge: false });
  M(root, cyl(0.1, 0.1, 0.36), 'dkgreen', 0, 1.0, 0, { rz: Math.PI / 2, edge: false });
  const wheels = [];
  for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(sx * 0.27, 1.0, 0); root.add(w); M(w, cyl(0.1, 0.1, 0.04, 32), 'wheel', 0, 0, 0, { rz: Math.PI / 2, edge: false }); wheels.push(w);
    M(root, cyl(0.12, 0.12, 0.06, 24, 1, true, Math.PI * 0.6, Math.PI * 1.3), 'dkgreen', sx * 0.27, 1.0, 0, { rz: Math.PI / 2, edge: false }); }
  M(root, rb(1.4, 0.06, 0.6), 'dksteel', 0, 0.9, -0.8); for (const x of [-0.6, 0.6]) M(root, rb(0.06, 0.88, 0.5), 'dksteel', x, 0.44, -0.8);
  M(root, rb(0.2, 0.15, 0.15), 'blue', -0.4, 1.0, -0.8);
  if (MODERN) for (const sx of [-1, 1]) M(root, rb(0.13, 0.09, 0.004, 0.002), 'poly', sx * 0.27, 1.17, 0.1, { rx: -0.6, edge: false, shadow: false });
  return { root, wheels, spark: new THREE.Vector3(0.27, 0.92, 0.1), kind: 'grinder' };
}
function buildCompressor() {
  const root = new THREE.Group();
  if (MODERN) { // compressor de parafuso enclausurado (gabinete acústico)
    M(root, rb(1.6, 0.08, 1.0, 0.01), 'dksteel', 0, 0.04, 0);
    M(root, rb(1.5, 1.4, 0.95, 0.04), 'sage', 0, 0.78, 0);
    M(root, rb(1.52, 0.16, 0.97, 0.03), 'accent', 0, 1.42, 0);
    for (let i = 0; i < 9; i++) M(root, rb(0.55, 0.02, 0.012, 0.004), 'graphite', -0.38, 0.35 + i * 0.07, 0.478, { shadow: false });
    M(root, rb(0.22, 0.16, 0.02, 0.01), 'graphite', 0.42, 1.08, 0.478);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: hmiTex(), emissiveIntensity: 0.5 })); sc.position.set(0.42, 1.08, 0.49); root.add(sc);
    M(root, cyl(0.028, 0.028, 0.02, 20), 'red', 0.42, 0.88, 0.49, { rx: Math.PI / 2, edge: false });
    const rot = new THREE.Group(); rot.position.set(0.25, 1.51, 0); root.add(rot);
    for (let i = 0; i < 5; i++) { const b = M(rot, rb(0.24, 0.008, 0.07, 0.003), 'graphite', 0, 0, 0, { ry: (i / 5) * Math.PI * 2, rx: 0.35, edge: false }); b.geometry.translate(0.13, 0, 0); }
    for (let r = 0.08; r < 0.3; r += 0.07) M(root, new THREE.TorusGeometry(r, 0.004, 4, 32), 'graphite', 0.25, 1.53, 0, { rx: Math.PI / 2, edge: false, shadow: false });
    return { root, rotor: rot, axis: 'y', kind: 'compressor' };
  }
  M(root, new THREE.CapsuleGeometry(0.32, 1.2, 8, 24), 'blue', 0, 0.55, 0, { rz: Math.PI / 2, edge: false });
  for (const x of [-0.5, 0.5]) M(root, rb(0.1, 0.25, 0.5), 'dksteel', x, 0.12, 0);
  M(root, rb(0.35, 0.35, 0.3), 'grey', -0.15, 1.05, 0); for (let i = 0; i < 6; i++) M(root, rb(0.4, 0.012, 0.34), 'grey', -0.15, 1.24 + i * 0.03, 0, { shadow: false });
  M(root, cyl(0.13, 0.13, 0.35), 'dkgreen', 0.35, 1.02, 0, { rz: Math.PI / 2, edge: false });
  const pul = new THREE.Group(); pul.position.set(-0.15, 1.05, 0.22); root.add(pul); M(pul, cyl(0.2, 0.2, 0.04, 32), 'dksteel', 0, 0, 0, { rx: Math.PI / 2, edge: false }); M(pul, rb(0.36, 0.04, 0.045), 'blacksteel', 0, 0, 0.0);
  M(root, cyl(0.05, 0.05, 0.03), 'chrome', 0.55, 0.95, 0.15, { rx: Math.PI / 2, edge: false });
  return { root, rotor: pul, axis: 'z', kind: 'compressor' };
}
function buildFan() {
  const root = new THREE.Group();
  M(root, cyl(0.75, 0.75, 0.5, 40, 1, true), 'grey', 0, 0, 0, { edge: false });
  const rot = new THREE.Group(); root.add(rot); M(rot, cyl(0.12, 0.12, 0.2), 'dksteel', 0, 0, 0, { edge: false });
  for (let i = 0; i < 6; i++) { const b = M(rot, rb(0.6, 0.01, 0.18, 0.004), 'grey', 0, 0, 0, { ry: (i / 6) * Math.PI * 2, rx: 0.3 }); b.geometry.translate(0.36, 0, 0); }
  for (let r = 0.2; r < 0.75; r += 0.14) M(root, new THREE.TorusGeometry(r, 0.005, 4, 40), 'dksteel', 0, -0.26, 0, { rx: Math.PI / 2, edge: false, shadow: false });
  return { root, rotor: rot, axis: 'y', kind: 'fan' };
}

// ── partículas: névoa de óleo (sprites macios iluminados) e faíscas (física + cauda) ──
function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  for (let i = 0; i < 26; i++) { const px = 64 + (Math.random() - 0.5) * 50, py = 64 + (Math.random() - 0.5) * 50, r = 18 + Math.random() * 30;
    const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  return new THREE.CanvasTexture(c);
}
function createMist(scene, n = 70) {
  const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1)); geo.instanceCount = n;
  const off = new Float32Array(n * 4); geo.setAttribute('aP', new THREE.InstancedBufferAttribute(off, 4));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { map: { value: softTex() } },
    vertexShader: `attribute vec4 aP; varying vec2 vUv; varying float vA; void main(){ vUv=uv; float life=fract(aP.w);
      vA = smoothstep(0.0,0.08,life)*(1.0-smoothstep(0.35,1.0,life)); float s = 0.03+pow(life,0.7)*0.26;
      vec4 mv = viewMatrix*vec4(aP.xyz,1.0); mv.xy += position.xy*s; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vA; void main(){ float a=texture2D(map,vUv).a*vA*0.2; gl_FragColor=vec4(vec3(0.86,0.88,0.89),a); }` });
  const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.userData.noAO = true; mesh.userData.noBloom = true; scene.add(mesh);
  const ps = []; for (let i = 0; i < n; i++) ps.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: Math.random(), dur: 1.0 + Math.random() * 1.4 });
  return { mesh, ps, emitters: [], update(dt) {
    let i = 0; for (const q of ps) { q.life += dt / q.dur;
      if (q.life >= 1 && this.emitters.length) { const e = this.emitters[(Math.random() * this.emitters.length) | 0]; if (e.active()) { q.life = 0; e.obj.updateWorldMatrix(true, false); q.p.setFromMatrixPosition(e.obj.matrixWorld).add(new THREE.Vector3((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.06)); q.v.copy(e.dir).multiplyScalar(0.35 + Math.random() * 0.35).add(new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.03 + Math.random() * 0.08, (Math.random() - 0.5) * 0.08)); } else q.life = 0.999; }
      q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 1.1); q.v.y += dt * 0.12;
      off[i * 4] = q.p.x; off[i * 4 + 1] = q.p.y; off[i * 4 + 2] = q.p.z; off[i * 4 + 3] = Math.min(q.life, 0.999); i++; }
    geo.attributes.aP.needsUpdate = true; } };
}
function createSparks(scene, n = 360) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 6), col = new Float32Array(n * 6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  lines.frustumCulled = false; lines.userData.noAO = true; scene.add(lines);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffa040, map: softTex(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); glow.scale.setScalar(0.7); glow.userData.noAO = true; scene.add(glow);
  const ps = []; for (let i = 0; i < n; i++) ps.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 1, dur: 1 });
  let burst = 0, on = true;
  return { lines, src: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), side: new THREE.Vector3(0, 0, 1), enabled: true, update(dt, t) {
    burst -= dt; if (burst < 0) { on = !on; burst = on ? 3 + Math.random() * 4 : 0.3 + Math.random() * 0.6; }
    const active = this.enabled && on; glow.position.copy(this.src); glow.material.opacity = active ? 0.6 + Math.random() * 0.4 : 0;
    let spawn = active ? Math.floor(dt * 600) : 0, i = 0;
    for (const q of ps) {
      if (q.age >= q.dur && spawn > 0) { spawn--; q.age = 0; q.dur = 0.4 + Math.random() * 0.9; q.p.copy(this.src);
        q.v.copy(this.dir).multiplyScalar(3 + Math.random() * 5).addScaledVector(this.side, (Math.random() - 0.5) * 4).add(new THREE.Vector3(0, (Math.random() - 0.3) * 3, 0)); }
      const alive = q.age < q.dur; q.age += dt;
      if (alive) { q.v.y -= 9.81 * dt; q.v.multiplyScalar(1 - 0.8 * dt); q.p.addScaledVector(q.v, dt);
        if (q.p.y < 0.01 && q.v.y < 0) { q.p.y = 0.01; q.v.y *= -0.3; q.v.x *= 0.6; q.v.z *= 0.6; } }
      const k = alive ? 1 - q.age / q.dur : 0, tl = 0.035;
      pos[i * 6] = q.p.x; pos[i * 6 + 1] = q.p.y; pos[i * 6 + 2] = q.p.z; pos[i * 6 + 3] = q.p.x - q.v.x * tl; pos[i * 6 + 4] = q.p.y - q.v.y * tl; pos[i * 6 + 5] = q.p.z - q.v.z * tl;
      const r = 3 * k, g = 1.6 * k * k, b = 0.5 * k * k * k; col[i * 6] = r; col[i * 6 + 1] = g; col[i * 6 + 2] = b; col[i * 6 + 3] = r * 0.3; col[i * 6 + 4] = g * 0.15; col[i * 6 + 5] = 0; i++;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; } };
}

// ── mescla malhas estáticas por material (menos draw calls; partes móveis ficam fora) ──
function bake(root, keep = []) {
  const ks = new Set(keep.filter(Boolean)); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), rm = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry.attributes.aEdge || o === root) return;
    for (let p = o.parent; p && p !== root; p = p.parent) if (ks.has(p)) return;
    const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'aEdge'].includes(n)) g.deleteAttribute(n);
    g.clearGroups();
    const key = o.material.uuid + (o.castShadow ? 's' : 'n'); if (!groups.has(key)) groups.set(key, { m: o.material, cs: o.castShadow, g: [], o: [] });
    const e = groups.get(key); e.g.push(g); e.o.push(o);
  });
  for (const { m, cs, g, o } of groups.values()) {
    if (g.length < 2) continue; const mg = mergeGeometries(g); if (!mg) continue;
    o.forEach((x) => x.parent.remove(x)); const mesh = new THREE.Mesh(mg, m); mesh.castShadow = cs; mesh.receiveShadow = true; root.add(mesh);
  }
}
// prensas de fundo só visuais (fila; sem fonte acústica própria — o campo reverberante já as cobre)
const DECOR = [
  { id: 'prensa5', kind: 'press', name: 'Prensa excêntrica 45 t', pos: [-2.4, 0, -13.9], rotY: Math.PI / 2, spm: 32, scheme: 'press2', s: 1.0, decor: true },
  { id: 'prensa6', kind: 'press', name: 'Prensa excêntrica 45 t', pos: [-2.4, 0, -18.2], rotY: Math.PI / 2, spm: 28, scheme: 'press3', s: 1.0, decor: true },
  { id: 'prensa7', kind: 'press', name: 'Prensa excêntrica 60 t', pos: [1.6, 0, -11.5], rotY: -Math.PI / 2, spm: 34, scheme: 'press2', s: 1.05, decor: true },
];
// ── construção principal ──
export function buildMachines(stage, app) {
  const group = new THREE.Group(); group.name = 'machines'; stage.scene.add(group);
  const units = {}, strokeFns = [];
  let panelButton = null, panel = null, strokes = 12345;
  const schemes = { prensa1: 'press1', prensa2: 'press2', prensa3: 'press3' };
  for (const def of [...MACHINES, ...DECOR]) {
    let u;
    if (def.kind === 'press') u = def.id === 'prensa4' || /hidr/i.test(def.name) ? buildHyd() : buildPress(def, def.scheme || schemes[def.id] || 'press2', def.s || (def.id === 'prensa1' ? 1.0 : 1.05));
    else if (def.kind === 'panel') { u = buildPanel(); panelButton = u.panelButton; panel = u; }
    else if (def.kind === 'grinder') u = buildGrinder();
    else if (def.kind === 'compressor') u = buildCompressor();
    else if (def.kind === 'fan') u = buildFan();
    else continue;
    u.def = def; u.on = def.running !== false; u.omega = u.on ? 1 : 0; u.crank = Math.random() * 6; u.clutch = u.on; u.vib = 0;
    u.root.position.set(...def.pos); u.root.rotation.y = def.rotY || 0; u.root.name = def.id; group.add(u.root); units[def.id] = u;
    bake(u.body || u.root, [u.fly, u.ram, u.rod, u.rotor, ...(u.wheels || [])]);
  }
  group.updateMatrixWorld(true);
  // parafusos instanciados (estáticos; os do martelo seguem o martelo)
  const statics = boltList.filter((o) => { let p = o.parent; while (p) { if (Object.values(units).some((u) => u.ram === p)) return false; p = p.parent; } return true; });
  const bm = new THREE.InstancedMesh(boltGeo, mat('blacksteel'), statics.length); statics.forEach((o, i) => { o.updateWorldMatrix(true, false); bm.setMatrixAt(i, o.matrixWorld); }); bm.castShadow = false; group.add(bm);
  for (const o of boltList) if (!statics.includes(o)) o.add(new THREE.Mesh(boltGeo, mat('blacksteel')));
  // efeitos
  const mist = createMist(stage.scene, 50), sparks = createSparks(stage.scene);
  // jato de vapor/névoa localizado saindo da matriz da prensa do posto (não é nevoeiro geral)
  for (const [id, lx, ly, lz, n] of [['prensa1', 0.1, 1.02, 0.3, 3]]) {
    const u = units[id]; if (!u) continue; const e = new THREE.Object3D(); e.position.set(lx, ly, lz); u.body.add(e);
    const dir = new THREE.Vector3(0.45, 0.15, 1).normalize().applyQuaternion(u.root.quaternion);
    for (let k = 0; k < n; k++) mist.emitters.push({ obj: e, dir, active: () => u.on || u.omega > 0.2 });
  }
  const gr = units.esmeril1;
  if (gr) { gr.root.updateMatrixWorld(true); sparks.src.copy(gr.spark).applyMatrix4(gr.root.matrixWorld); sparks.dir.set(0, -0.3, 1).applyQuaternion(gr.root.quaternion).normalize(); sparks.side.set(1, 0, 0).applyQuaternion(gr.root.quaternion); }
  const sctx = panel?.sc;
  let screenT = 0;
  function update(dt, t) {
    dt = Math.min(dt, 0.05);
    for (const id in units) {
      const u = units[id], def = u.def;
      // volante: sobe em ~3 s, desacelera por atrito em ~8 s
      u.omega += ((u.on ? 1 : 0) - u.omega) * Math.min(1, dt * (u.on ? 0.8 : 0.3)); if (!u.on && u.omega < 0.01) u.omega = 0;
      if (u.kind === 'press') {
        const w = ((def.spm || 40) / 60) * Math.PI * 2; u.fly.rotation.x -= w * u.omega * dt * 1.0;
        const prev = u.crank;
        if (u.clutch) u.crank += w * u.omega * dt;
        const a0 = ((prev % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), a1 = ((u.crank % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (!u.on && u.clutch && a1 < a0) { u.clutch = false; u.crank = Math.round(u.crank / (2 * Math.PI)) * 2 * Math.PI; }  // freia no PMS
        if (u.on && !u.clutch && u.omega > 0.9) u.clutch = true;
        if (u.clutch && a0 < Math.PI && a1 >= Math.PI && !def.decor) { u.vib = 1; const s = Math.min(1, Math.max(0.3, (def.Lw - 85) / 15)); strokeFns.forEach((f) => { try { f(id, s); } catch (e) { console.error(e); } }); if (id === 'prensa1') strokes++; }
        // biela-manivela: r = 0,05 m, L = 0,55 m, centro do virabrequim y = 2,18, z = 0,12
        const r = 0.05, L = 0.55, th = u.crank, py = 2.18 + r * Math.cos(th), pz = 0.12 + r * Math.sin(th);
        const wy = py - Math.sqrt(L * L - (r * Math.sin(th)) ** 2);
        u.ram.position.set(0, wy, 0); u.rod.position.set(0, py, pz); u.rod.rotation.x = Math.atan2(pz - 0.12, py - wy) * -1;
        u.vib *= Math.exp(-dt * 14); u.body.position.y = Math.sin(t * 90) * 0.0007 * u.vib; u.body.position.x = Math.sin(t * 73) * 0.0005 * u.vib;
      } else if (u.kind === 'hyd') {
        const per = 60 / (def.spm || 12); if (u.omega > 0.5) u.crank += dt; const ph = (u.crank % per) / per;
        const prevPh = u.hph ?? 0; u.hph = ph;
        const y = ph < 0.45 ? 1 - ph / 0.45 : ph < 0.55 ? 0 : (ph - 0.55) / 0.45; u.ram.position.set(0, 1.35 + y * 1.2, 0);
        if (prevPh < 0.45 && ph >= 0.45) strokeFns.forEach((f) => { try { f(id, 0.5); } catch (e) { console.error(e); } });
      } else if (u.kind === 'grinder') { for (const w of u.wheels) w.rotation.x += 300 * u.omega * dt; sparks.enabled = u.on && u.omega > 0.6; }
      else if (u.rotor) u.rotor.rotation[u.axis] += (u.kind === 'fan' ? 14 : 25) * u.omega * dt;
    }
    mist.update(dt); sparks.update(dt, t);
    screenT += dt; if (sctx && screenT > 0.5) { screenT = 0; drawScreen(sctx, strokes, t); panel.st.needsUpdate = true; }
  }
  return {
    group, panelButton, units, update,
    setAll(on) { for (const id in units) units[id].on = on; },
    setRunning(id, on) { if (units[id]) units[id].on = on; },
    isRunning: (id) => units[id]?.on ?? true,
    onStroke(fn) { strokeFns.push(fn); return () => { const i = strokeFns.indexOf(fn); if (i >= 0) strokeFns.splice(i, 1); }; },
  };
}
