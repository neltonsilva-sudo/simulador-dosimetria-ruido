// Galpão de estamparia (CENÁRIO): pórticos com tesouras, telhado com claraboias e lanternim, luminárias pendentes,
// alvenaria encardida, piso de concreto PBR procedural (óleo, juntas, marcas de empilhadeira, faixas amarelas gastas),
// pilares zebrados, tubulação de ar comprimido, eletrocalha, quadros elétricos, paletes, caçambas, extintor, ponte rolante,
// bancada do técnico em TABLE e poeira em suspensão iluminada.
import * as THREE from 'three';
import { HALL, TABLE } from './layout_cams.js';
import { MACHINES } from './layout_machines.js';
export const CLEAN = (() => { try { return new URLSearchParams(location.search).get('sujo') !== '1'; } catch { return true; } })(); // galpão limpo e organizado (5S); ?sujo=1 volta ao aspecto antigo

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

// ── piso: textura macro cobrindo o galpão inteiro (cor + rugosidade) ──
function floorTextures(W, D) {
  const S = 2048, R = rng(11), [c, g] = canvas(S, S), [rc, rg] = canvas(S, S);
  const px = (x) => ((x - HALL.x0) / W) * S, pz = (z) => ((z - HALL.z0) / D) * S;
  g.fillStyle = CLEAN ? '#8e9295' : '#8b867c'; g.fillRect(0, 0, S, S); rg.fillStyle = CLEAN ? '#a6a6a6' : '#d0d0d0'; rg.fillRect(0, 0, S, S); // limpo: piso epóxi cinza, acetinado
  // variação de concreto em manchas grandes
  for (let i = 0; i < 900; i++) {
    const x = R() * S, y = R() * S, r = 20 + R() * 160, a = (0.03 + R() * 0.07) * (CLEAN ? 0.3 : 1);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); const v = R() < 0.5 ? '60,56,50' : '160,155,145';
    gr.addColorStop(0, `rgba(${v},${a})`); gr.addColorStop(1, `rgba(${v},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // óleo sob/ao redor das máquinas e trilhas
  const oil = (x, y, r, a) => {
    for (const [ctx, col] of [[g, `rgba(28,24,20,${a})`], [rg, `rgba(40,40,40,${a * 1.2})`]]) {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  };
  if (!CLEAN) for (const m of MACHINES) if (m.pos[1] < 1) for (let i = 0; i < 14; i++) oil(px(m.pos[0] + (R() - 0.5) * 3), pz(m.pos[2] + (R() - 0.5) * 3), 8 + R() * 40, 0.25 + R() * 0.35);
  if (!CLEAN) for (let i = 0; i < 420; i++) oil(R() * S, R() * S, 4 + R() * 30, 0.15 + R() * 0.3);
  // marcas de pneu de empilhadeira (corredor principal)
  g.lineCap = 'round';
  for (let i = 0; i < (CLEAN ? 0 : 40); i++) {
    const x = px(2.6 + (R() - 0.5) * 2.2); g.strokeStyle = `rgba(30,28,26,${0.05 + R() * 0.08})`; g.lineWidth = 2 + R() * 4;
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (R() - 0.5) * 60, S * 0.3, x + (R() - 0.5) * 80, S * 0.6, x + (R() - 0.5) * 40, S); g.stroke();
  }
  // faixas amarelas de circulação (gastas)
  const lane = (x0, z0, x1, z1, w = 0.1) => {
    g.save(); g.strokeStyle = CLEAN ? 'rgb(228,182,30)' : 'rgba(214,170,40,0.85)'; g.lineWidth = (w / W) * S; g.beginPath(); g.moveTo(px(x0), pz(z0)); g.lineTo(px(x1), pz(z1)); g.stroke(); g.restore();
  };
  lane(1.55, HALL.z1, 1.55, HALL.z0); lane(4.2, HALL.z1, 4.2, HALL.z0); lane(HALL.x0, -19.5, HALL.x1, -19.5); lane(HALL.x0, -21.3, HALL.x1, -21.3);
  for (const m of MACHINES) if (m.kind === 'press') {
    g.strokeStyle = CLEAN ? 'rgb(228,182,30)' : 'rgba(214,170,40,0.7)'; g.lineWidth = (0.08 / W) * S; g.strokeRect(px(m.pos[0] - 1.6), pz(m.pos[2] - 1.5), (3.2 / W) * S, (3.0 / D) * S);
  }
  // desgaste da tinta: apaga pontos
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < (CLEAN ? 0 : 9000); i++) { g.fillStyle = `rgba(120,115,105,${R() * 0.5})`; const r = R() * 3; g.fillRect(R() * S, R() * S, r, r); }
  g.globalCompositeOperation = 'source-over';
  // juntas de dilatação a cada 6 m e trincas
  g.strokeStyle = CLEAN ? 'rgba(60,62,64,0.35)' : 'rgba(35,33,30,0.55)'; g.lineWidth = 1.5;
  for (let x = Math.ceil(HALL.x0 / 6) * 6; x < HALL.x1; x += 6) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), S); g.stroke(); }
  for (let z = HALL.z1; z > HALL.z0; z -= 6) { g.beginPath(); g.moveTo(0, pz(z)); g.lineTo(S, pz(z)); g.stroke(); }
  g.strokeStyle = 'rgba(30,28,25,0.5)'; g.lineWidth = 1;
  for (let i = 0; i < (CLEAN ? 0 : 70); i++) { let x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 12; k++) { x += (R() - 0.5) * 14; y += (R() - 0.5) * 14; g.lineTo(x, y); } g.stroke(); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const rough = new THREE.CanvasTexture(rc); rough.anisotropy = 8;
  return { map, rough };
}
// textura de detalhe (grão do concreto) — repetida
function grainTexture(seed, base = 128, amp = 40, S = 512) {
  const R = rng(seed), [c, g] = canvas(S, S), id = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const v = base + (R() - 0.5) * amp + (R() < 0.01 ? -40 : 0); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${R() < 0.5 ? 0 : 255},${R() < 0.5 ? 0 : 255},${R() < 0.5 ? 0 : 255},0.04)`; const r = 4 + R() * 30; g.beginPath(); g.arc(R() * S, R() * S, r, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function wallTexture() {
  const S = 1024, R = rng(5), [c, g] = canvas(S, S);
  g.fillStyle = '#a3ab9f'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#5f7f6c'; g.fillRect(0, S * 0.7, S, S * 0.3); g.fillStyle = '#3f5547'; g.fillRect(0, S * 0.695, S, 6); // barra inferior pintada (≈1,3 m)
  g.strokeStyle = 'rgba(70,74,64,0.18)'; g.lineWidth = 2;
  for (let y = 0; y < S; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); for (let x = (y / 32) % 2 ? 0 : 40; x < S; x += 80) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } }
  for (let i = 0; i < (CLEAN ? 25 : 160); i++) { const x = R() * S, w = 3 + R() * 22; const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(50,44,36,0.22)'); gr.addColorStop(1, 'rgba(50,44,36,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, S * (0.3 + R() * 0.7)); }
  const gr = g.createLinearGradient(0, S * 0.6, 0, S); gr.addColorStop(0, 'rgba(30,26,22,0)'); gr.addColorStop(1, `rgba(30,26,22,${CLEAN ? 0.18 : 0.5})`); g.fillStyle = gr; g.fillRect(0, S * 0.6, S, S * 0.4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
function zebraTexture() {
  const [c, g] = canvas(256, 512); g.fillStyle = '#8f9d92'; g.fillRect(0, 0, 256, 512);
  g.save(); g.beginPath(); g.rect(0, 512 - 150, 256, 150); g.clip();
  for (let i = -10; i < 20; i++) { g.fillStyle = i % 2 ? '#d9a91c' : '#1c1c1a'; g.beginPath(); g.moveTo(i * 40, 512); g.lineTo(i * 40 + 40, 512); g.lineTo(i * 40 + 190, 362); g.lineTo(i * 40 + 150, 362); g.fill(); }
  g.restore();
  const R = rng(3); for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${R() < 0.6 ? '40,36,30' : '170,170,160'},${R() * 0.25})`; g.fillRect(R() * 256, R() * 512, 1 + R() * 4, 1 + R() * 6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildHall(stage, app) {
  const g = new THREE.Group(); g.name = 'hall';
  const W = HALL.x1 - HALL.x0, D = HALL.z1 - HALL.z0, cx = (HALL.x0 + HALL.x1) / 2, cz = (HALL.z0 + HALL.z1) / 2;
  const R = rng(42);
  const det = grainTexture(7);

  // ── piso ──
  const ft = floorTextures(W, D);
  const floorMat = new THREE.MeshStandardMaterial({ map: ft.map, color: 0x8c8880, roughnessMap: ft.rough, roughness: 0.95, metalness: 0, envMapIntensity: 0.9 });
  floorMat.onBeforeCompile = (sh) => {
    sh.uniforms.tDet = { value: det };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform sampler2D tDet;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat dd = texture2D(tDet, vWp.xz*0.45).r*0.7 + texture2D(tDet, vWp.xz*0.07).r*0.6; diffuseColor.rgb *= 0.55 + dd*0.75;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (0.85 + texture2D(tDet, vWp.xz*0.9).r*0.3), 0.18, 1.0);');
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); floor.receiveShadow = true; g.add(floor);

  // ── paredes (alvenaria até 4 m + fechamento metálico) ──
  const wt = wallTexture();
  const wallMat = (rep) => { const t = wt.clone(); t.needsUpdate = true; t.repeat.set(rep, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.93, envMapIntensity: 0.6 }); };
  const cladMat = new THREE.MeshStandardMaterial({ color: 0x8a948d, roughness: 0.7, metalness: 0.25, roughnessMap: det, envMapIntensity: 0.5 });
  const wall = (len, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 4), wallMat(len / 6)); m.position.set(x, 2, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(len, HALL.eave - 4 + 0.6), cladMat); c.position.set(x, 4 + (HALL.eave - 3.4) / 2, z); c.rotation.y = ry; g.add(c);
    // faixa de janelas basculantes (claras) entre 5 e 6,6 m
    const win = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.92, 1.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.9, 0.8).multiplyScalar(0.9) }));
    win.position.set(x, 5.8, z); win.rotation.y = ry; win.translateZ(0.02); g.add(win);
  };
  wall(D, HALL.x1, cz, -Math.PI / 2); wall(D, HALL.x0, cz, Math.PI / 2); wall(W, cx, HALL.z0, 0); wall(W, cx, HALL.z1, Math.PI);

  // ── estrutura metálica: pilares (perfil I) zebrados, tesouras, terças ──
  const steel = new THREE.MeshStandardMaterial({ color: 0x3c4143, roughness: 0.6, metalness: 0.5, roughnessMap: det, envMapIntensity: 0.8 });
  const colMat = new THREE.MeshStandardMaterial({ map: zebraTexture(), roughness: 0.6, metalness: 0.35, envMapIntensity: 0.8 });
  const colGeo = new THREE.BoxGeometry(0.32, HALL.eave, 0.32); colGeo.translate(0, HALL.eave / 2, 0);
  const colPos = [];
  for (const z of HALL.frames) for (const x of [HALL.x0 + 0.2, -12, HALL.x1 - 0.2]) colPos.push([x, z]);
  const cols = new THREE.InstancedMesh(colGeo, colMat, colPos.length); const M = new THREE.Matrix4();
  colPos.forEach(([x, z], i) => cols.setMatrixAt(i, M.makeTranslation(x, 0, z)));
  cols.castShadow = cols.receiveShadow = true; g.add(cols);

  const bars = []; // [x0,y0,z0,x1,y1,z1,thick]
  const roofY = (x, s) => HALL.eave + HALL.rise * (1 - Math.abs(x - (s.a + s.b) / 2) / ((s.b - s.a) / 2));
  for (const z of HALL.frames) for (const s of HALL.spans) {
    const n = Math.round((s.b - s.a) / 1.4);
    bars.push([s.a, HALL.eave, z, s.b, HALL.eave, z, 0.14]);
    for (let i = 0; i < n; i++) {
      const xa = s.a + ((s.b - s.a) * i) / n, xb = s.a + ((s.b - s.a) * (i + 1)) / n;
      bars.push([xa, roofY(xa, s), z, xb, roofY(xb, s), z, 0.16]);
      bars.push([xb, HALL.eave, z, xb, roofY(xb, s), z, 0.07]);
      bars.push(i % 2 ? [xa, HALL.eave, z, xb, roofY(xb, s), z, 0.06] : [xa, roofY(xa, s), z, xb, HALL.eave, z, 0.06]);
    }
  }
  // treliças planas baixas de travamento (escuras) a 5,2–5,9 m, uma por pórtico e uma no meio do vão — leem como as
  // treliças escuras do fundo da foto, abaixo do telhado alto
  for (let z = -2; z >= HALL.z0; z -= 3) {
    const yb = 6.1, yt = 6.75, xa0 = -12, xb0 = HALL.x1 - 0.2; bars.push([xa0, yb, z, xb0, yb, z, 0.12], [xa0, yt, z, xb0, yt, z, 0.14]);
    for (let x = xa0, k = 0; x < xb0 - 0.01; x += 1.1, k++) { const x2 = Math.min(xb0, x + 1.1); bars.push(k % 2 ? [x, yb, z, x2, yt, z, 0.045] : [x, yt, z, x2, yb, z, 0.045]); }
    for (let x = xa0; x <= xb0; x += 5.5) bars.push([x, yt, z, x, HALL.eave, z, 0.07]);
  }
  for (const s of HALL.spans) for (let x = s.a + 0.7; x < s.b; x += 1.5) { const y = roofY(x, s) + 0.12; bars.push([x, y, HALL.z0, x, y, HALL.z1, 0.1]); }
  // vigas longitudinais (contraventamento) no banzo inferior
  for (const x of [-12, -6, 0, 5]) bars.push([x, HALL.eave, HALL.z0, x, HALL.eave, HALL.z1, 0.12]);
  const barGeo = new THREE.BoxGeometry(1, 1, 1); const bm = new THREE.InstancedMesh(barGeo, steel, bars.length);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 0, 1), sc = new THREE.Vector3();
  bars.forEach(([x0, y0, z0, x1, y1, z1, t], i) => {
    a.set(x0, y0, z0); b.set(x1, y1, z1); const len = a.distanceTo(b); const dir = b.clone().sub(a).normalize();
    q.setFromUnitVectors(up, dir); sc.set(t, t, len); M.compose(a.add(b).multiplyScalar(0.5), q, sc); bm.setMatrixAt(i, M);
  });
  g.add(bm);
  // ── telhado (telha metálica ondulada vista por baixo) + claraboias emissivas ──
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6a6f6d, roughness: 0.6, metalness: 0.45, side: THREE.DoubleSide, envMapIntensity: 0.5 });
  roofMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp2;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp2 = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp2;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + vec3(cos(vWp2.x*20.0)*0.35,0.0,0.0));');
  };
  const skyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.96, 0.86).multiplyScalar(24), side: THREE.DoubleSide });
  for (const s of HALL.spans) {
    const xc = (s.a + s.b) / 2, hw = (s.b - s.a) / 2, ang = Math.atan2(HALL.rise, hw), len = Math.hypot(hw, HALL.rise);
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, D), roofMat); m.rotation.order = 'YXZ';
      m.rotation.set(-Math.PI / 2, 0, 0); m.rotateY(side * ang);
      m.position.set(xc + side * hw / 2, HALL.eave + HALL.rise / 2 + 0.25, cz); g.add(m);
    }
  }
  for (const k of HALL.skylights) {
    const s = HALL.spans.find((sp) => k.x >= sp.a && k.x <= sp.b);
    for (let z = HALL.z1 - 0.3; z > HALL.z0 + 0.3; z -= 3) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(k.hw * 2, 2.6), skyMat);
      p.rotation.x = Math.PI / 2; p.position.set(k.x, roofY(k.x, s) + 0.2 + (k.lantern ? 0.5 : 0), z - 1.5); g.add(p);
    }
  }

  // ── luminárias tubulares (calhas 2×T8 de 1,25 m) em fileiras transversais, penduradas em correntes ──
  const fixGeo = new THREE.BoxGeometry(1.25, 0.07, 0.24); fixGeo.translate(0, 0.035, 0);
  const fixMat = new THREE.MeshStandardMaterial({ color: 0xcfd2cc, roughness: 0.45, metalness: 0.5, roughnessMap: det });
  const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.97, 0.9).multiplyScalar(7) });
  const tubeGeo = new THREE.CylinderGeometry(0.016, 0.016, 1.18, 8); tubeGeo.rotateZ(Math.PI / 2);
  const lp = [];
  const LY = 5.3;
  for (let z = -3; z > HALL.z0 + 1; z -= 3) {
    for (let x = -10.6; x < 9.2; x += 2.1) lp.push([x + (R() - 0.5) * 0.04, LY + (R() - 0.5) * 0.04, z + 1]);
  }
  for (let z = 2; z > HALL.z0 + 1; z -= 3) for (let x = -24.5; x < -13; x += 2.1) lp.push([x, LY, z]);
  const fixtures = new THREE.InstancedMesh(fixGeo, fixMat, lp.length), tubes = new THREE.InstancedMesh(tubeGeo, tubeMat, lp.length * 2);
  const chains = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.006, 1), steel, lp.length * 2);
  const cl = 6.1 - LY - 0.07;
  lp.forEach(([x, y, z], i) => {
    fixtures.setMatrixAt(i, M.makeTranslation(x, y, z));
    tubes.setMatrixAt(2 * i, M.makeTranslation(x, y - 0.012, z - 0.055)); tubes.setMatrixAt(2 * i + 1, M.makeTranslation(x, y - 0.012, z + 0.055));
    for (const k of [0, 1]) chains.setMatrixAt(2 * i + k, M.makeScale(1, cl, 1).setPosition(x + (k ? 0.5 : -0.5), y + 0.07 + cl / 2, z));
  });
  tubes.userData.noAO = true; g.add(fixtures, tubes, chains);

  // ── utilidades no alto: dutos de exaustão, eletrocalhas transversais, barramento, correntes ──
  const duct = new THREE.MeshStandardMaterial({ color: 0x9a9e9a, roughness: 0.4, metalness: 0.85, roughnessMap: det });
  const ringM = []; const ductRun = (x, y, z0, z1, r) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), 20), duct); c.rotation.x = Math.PI / 2; c.position.set(x, y, (z0 + z1) / 2); g.add(c);
    for (let z = Math.min(z0, z1) + 1.2; z < Math.max(z0, z1); z += 1.2) ringM.push(new THREE.Matrix4().makeScale(r / 0.3, r / 0.3, 1).setPosition(x, y, z)); };
  ductRun(-5.4, 7.2, -30, 4, 0.32); ductRun(3.6, 7.4, -30, 2, 0.25);
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(0.306, 0.012, 6, 20), duct, ringM.length); ringM.forEach((m4, i) => rings.setMatrixAt(i, m4)); g.add(rings);
  const trayM = new THREE.MeshStandardMaterial({ color: 0xa6a9a6, roughness: 0.45, metalness: 0.75 });
  const trays = new THREE.InstancedMesh(new THREE.BoxGeometry(18, 0.06, 0.3), trayM, 5); for (let i = 0; i < 5; i++) trays.setMatrixAt(i, M.makeTranslation(0, 6.95, -1 - i * 6 + 0.4)); g.add(trays);
  // ── tubulação de ar comprimido (azul) e eletrocalha ──
  const blue = new THREE.MeshStandardMaterial({ color: 0x1f4f8a, roughness: 0.45, metalness: 0.3 });
  const pipe = (x0, y0, z0, x1, y1, z1, r, m) => {
    a.set(x0, y0, z0); b.set(x1, y1, z1); const len = a.distanceTo(b);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m); c.position.copy(a).add(b).multiplyScalar(0.5);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); c.castShadow = true; g.add(c);
  };
  pipe(HALL.x1 - 0.45, 4.2, HALL.z1, HALL.x1 - 0.45, 4.2, HALL.z0, 0.05, blue);
  pipe(-11.7, 4.6, HALL.z1, -11.7, 4.6, HALL.z0, 0.05, blue);
  for (const m of MACHINES) if (m.kind === 'press') { pipe(m.pos[0], 4.6, m.pos[2] + 1.2, -11.7, 4.6, m.pos[2] + 1.2, 0.025, blue); pipe(m.pos[0], 4.6, m.pos[2] + 1.2, m.pos[0], 3.2, m.pos[2] + 1.2, 0.025, blue); }
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, D), new THREE.MeshStandardMaterial({ color: 0x9a9d9c, roughness: 0.45, metalness: 0.75 }));
  tray.position.set(-4.2, 6.6, cz); g.add(tray);

  // ── quadros elétricos, extintor, paletes, caçambas, bobinas ──
  const box = (w, h, d, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x9ba3a6, roughness: 0.5, metalness: 0.4 });
  for (let i = 0; i < 4; i++) box(0.8, 1.9, 0.4, panelMat, HALL.x1 - 0.25, 0.95 + 0.15, -3 - i * 0.85);
  const red = new THREE.MeshStandardMaterial({ color: 0xb01010, roughness: 0.35, metalness: 0.1 });
  const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 16), red); ext.position.set(-11.75, 0.75, 1.25); ext.castShadow = true; g.add(ext);
  box(0.02, 0.35, 0.35, new THREE.MeshStandardMaterial({ color: 0xd01818, emissive: 0x200000, roughness: 0.6 }), -11.83, 1.6, 1.25);
  const floorSq = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0xa01a14, roughness: 0.8 }));
  floorSq.rotation.x = -Math.PI / 2; floorSq.position.set(-11.4, 0.004, 1.25); g.add(floorSq);
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a6248, roughness: 0.9, map: det });
  const palletAt = (x, z, n = 1, ry = 0) => { for (let k = 0; k < n; k++) { const y = k * 0.15;
    for (let i = 0; i < 5; i++) box(1.2, 0.022, 0.1, wood, x, y + 0.135, z - 0.45 + i * 0.225, ry);
    for (let i = 0; i < 3; i++) box(1.2, 0.1, 0.1, wood, x, y + 0.06, z - 0.45 + i * 0.45, ry); } };
  palletAt(5.2, -3.2, 6); palletAt(6.6, -3.2, 3); palletAt(5.6, -7.8, 4); palletAt(-10.2, 3.5, 5);
  const bin = new THREE.MeshStandardMaterial({ color: 0x2c4f7a, roughness: 0.55, metalness: 0.5 });
  box(1.5, 0.9, 1.0, bin, 3.6, 0.45, -6.4); box(1.5, 0.9, 1.0, new THREE.MeshStandardMaterial({ color: 0x8a6a1e, roughness: 0.6, metalness: 0.5 }), 3.6, 0.45, -9.6);
  const scrap = new THREE.MeshStandardMaterial({ color: 0x8d8f90, roughness: 0.3, metalness: 0.95 });
  for (let i = 0; i < 26; i++) box(0.15 + R() * 0.4, 0.02, 0.1 + R() * 0.3, scrap, 3.6 + (R() - 0.5) * 1.3, 0.9, -6.4 + (R() - 0.5) * 0.8, R() * 3);
  const coil = new THREE.MeshStandardMaterial({ color: 0x9da2a5, roughness: 0.28, metalness: 0.95 });
  for (const [x, z] of [[7.2, -13], [7.2, -15.2], [5.6, -14.1]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 32), coil); c.rotation.x = Math.PI / 2; c.position.set(x, 0.72, z); c.castShadow = c.receiveShadow = true; g.add(c); }
  // estante porta-paletes ao longo da parede direita
  const rackB = new THREE.MeshStandardMaterial({ color: 0x23508e, roughness: 0.5, metalness: 0.4 }), rackO = new THREE.MeshStandardMaterial({ color: 0xd2661a, roughness: 0.5, metalness: 0.4 });
  const cart = new THREE.MeshStandardMaterial({ color: 0x9c7a52, roughness: 0.85 });
  for (let z = -18; z > -32; z -= 2.8) {
    for (const dx of [0, 1.1]) box(0.08, 5, 0.08, rackB, 8.6 + dx, 2.5, z);
    for (const y of [1.6, 3.2, 4.8]) { box(1.2, 0.1, 0.1, rackO, 9.15, y, z); box(1.0, 0.7, 1.0, cart, 9.15, y + 0.4, z - 1.3); }
  }

  // ── bancada / carrinho do técnico (TABLE) ──
  const bench = new THREE.Group(); bench.position.set(...TABLE.pos); bench.rotation.y = TABLE.rotY; g.add(bench);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.7), new THREE.MeshStandardMaterial({ color: 0x6b5a46, roughness: 0.75, map: det }));
  top.position.y = TABLE.h - 0.02; top.castShadow = top.receiveShadow = true; bench.add(top);
  const frameM = new THREE.MeshStandardMaterial({ color: 0x3b4a5a, roughness: 0.5, metalness: 0.6 });
  for (const [x, z] of [[-0.56, -0.31], [0.56, -0.31], [-0.56, 0.31], [0.56, 0.31]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, TABLE.h - 0.16, 0.04), frameM); l.position.set(x, (TABLE.h - 0.16) / 2 + 0.12, z); l.castShadow = true; bench.add(l);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 16), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 })); w.rotation.z = Math.PI / 2; w.position.set(x, 0.05, z); bench.add(w);
  }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.025, 0.64), frameM); shelf.position.y = 0.3; shelf.castShadow = true; bench.add(shelf);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.01, 0.32), new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.9 })); clip.position.set(0.42, TABLE.h + 0.005, 0.1); clip.rotation.y = 0.2; bench.add(clip);

  // ── poeira em suspensão (pontos iluminados mais fortes dentro dos feixes) ──
  const N = 2600, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = -8 + R() * 16; pos[i * 3 + 1] = 0.3 + R() * 7.5; pos[i * 3 + 2] = -14 + R() * 18; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float time; varying float vA; void main(){ vec3 p = position; p.x += sin(time*0.13 + p.y*1.7)*0.4; p.y += sin(time*0.07 + p.x)*0.3; p.z += cos(time*0.11 + p.y)*0.4;
      vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(14.0 / -mv.z, 1.0, 6.0);
      vA = (0.25 + 0.75 * step(0.5, fract(p.x*0.13 + 0.3))) * smoothstep(0.3, 2.0, -mv.z); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0,0.92,0.8)*1.6, (1.0 - smoothstep(0.1,0.5,d)) * vA * 0.35); }`,
  });
  const dust = new THREE.Points(dg, dustMat); dust.frustumCulled = false; dust.userData.noAO = true; g.add(dust);

  g.traverse((o) => { if (o.isMesh && o !== floor && o.receiveShadow === false) o.receiveShadow = true; });
  stage.scene.add(g);
  return { group: g, update(dt, t) { dustMat.uniforms.time.value = t; } };
}
