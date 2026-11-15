// Decibelímetro (medidor de nível de pressão sonora) portátil sobre tripé — dono: UI/DEMO (aula da Dose).
// Modelo genérico (sem marca): casca branco-gelo acetinada em "raquete" arredondada (varredura de seções com laterais
// de raio grande, frente/verso abaulados e linha de partição), colar grafite moldado que segura a espuma preta de células
// abertas, visor LCD reflexivo rebaixado sob janela de acrílico, teclas de borracha em relevo (azul de liga/desliga em
// cúpula, F/S, A/C, MAX/MIN, LEVEL) e tripé fotográfico compacto com cabeça de esfera e placa de engate rápido.
// Escala real (≈ 26 cm com a espuma). Origem do grupo = centro do tripé no piso; microfone ≈ 1,59 m (zona auditiva).
// Geometria da casca em ui_slm_geo.js; texturas procedurais e LCD em ui_slm_tex.js.
//
// API extra (aulas de configuração/calibração): setMode({power, weight, resp, max, cal}), press(key), highlight(key|null),
// setWindscreen(bool), micTip (Object3D na ponta da cápsula ½", +y para fora) e CAPSULE_D (diâmetro da cápsula, m).
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bodyGeometry, collarGeometry, frontZ, HD, CROWN } from './ui_slm_geo.js';
import { microTexture, shellMaps, foamTextures, facePrint, keyAtlas, backPrint, makeLCD, screwTex, grilleTex } from './ui_slm_tex.js';

/** diâmetro externo da cápsula de ½" com a grade (m) */
export const CAPSULE_D = 0.0132;

export function buildSLM(THREE) {
  const g = new THREE.Group(); g.name = 'decibelimetro'; g.visible = false;
  const std = (o) => new THREE.MeshStandardMaterial(o), phy = (o) => new THREE.MeshPhysicalMaterial(o);
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const micro = microTexture(THREE), shell = shellMaps(THREE);

  // ── materiais ──
  const alu = phy({ color: 0x2a2d31, metalness: 0.8, roughness: 0.34, clearcoat: 0.2, clearcoatRoughness: 0.4 });   // alumínio anodizado
  const aluLight = std({ color: 0x8a8f95, metalness: 0.9, roughness: 0.3 });
  const plastic = std({ color: 0x16171a, roughness: 0.55, roughnessMap: micro });                                       // plástico preto das travas
  const rubber = std({ color: 0x101112, roughness: 0.88 });
  const chrome = std({ color: 0xb8bcc2, metalness: 1, roughness: 0.16 });
  // ABS texturizado: rugosidade ≈ 0,55 (mapa com variação e digitais sutis), normal map de granulado fino, sem verniz
  const shellM = phy({ color: 0xe4ded0, roughness: 1, roughnessMap: shell.rough, normalMap: shell.normal, normalScale: new THREE.Vector2(0.18, 0.18), specularIntensity: 0.6, sheen: 0.15, sheenRoughness: 0.8, sheenColor: 0xffffff, vertexColors: true });
  const collarM = phy({ color: 0x2c2f33, roughness: 1, roughnessMap: shell.rough, normalMap: shell.normal, normalScale: new THREE.Vector2(0.3, 0.3), specularIntensity: 0.55, clearcoat: 0.06, clearcoatRoughness: 0.5, vertexColors: true });
  // janela de acrílico com máscara grafite serigrafada por baixo (brilho de verniz)
  const bezelM = phy({ color: 0x1f2124, roughness: 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, specularIntensity: 0.8 });
  // borracha de silicone cinza-escuro fosca (sheen = leve espalhamento na superfície)
  const keyM = phy({ color: 0x3a3d42, roughness: 0.82, normalMap: shell.normal, normalScale: new THREE.Vector2(0.12, 0.12), specularIntensity: 0.35, sheen: 0.6, sheenRoughness: 0.45, sheenColor: 0x7c8088, emissive: 0x5aa4ff, emissiveIntensity: 0 });

  // ── tripé fotográfico compacto ──
  const HUB = 0.98, PAN = 1.336, BALL = 1.377, TILT = -0.62;
  const UP = new THREE.Vector3(0, 1, 0);
  const cylY = (r0, r1, h, seg = 18) => new THREE.CylinderGeometry(r1, r0, h, seg);
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3 + 0.3, ca = Math.cos(a), sa = Math.sin(a);
    const top = new THREE.Vector3(ca * 0.04, HUB - 0.006, sa * 0.04), foot = new THREE.Vector3(ca * 0.40, 0.0, sa * 0.40);
    const dir = top.clone().sub(foot), L = dir.length(); dir.normalize();
    const out = new THREE.Vector3(ca, 0, sa); out.addScaledVector(dir, -out.dot(dir)).normalize();
    const zA = new THREE.Vector3().crossVectors(out, dir);
    const leg = new THREE.Group(); leg.position.copy(foot); leg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(out, dir, zA)); g.add(leg);
    // pé de borracha
    add(leg, cylY(0.0105, 0.0085, 0.03, 16), rubber, 0, 0.017);
    add(leg, new THREE.SphereGeometry(0.0105, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), rubber, 0, 0.0025).scale.y = 0.35;
    // três seções telescópicas com travas de alavanca
    const sec = [[0.026, 0.37, 0.0062], [0.37, 0.69, 0.0083], [0.69, 1.0, 0.0105]];
    sec.forEach(([t0, t1, r], i) => {
      add(leg, cylY(r, r, (t1 - t0) * L, 18), alu, 0, (t0 + t1) / 2 * L);
      if (i < 2) { // trava na ponta inferior da seção mais grossa
        const y = t1 * L, rr = sec[i + 1][2];
        add(leg, cylY(rr + 0.0042, rr + 0.0035, 0.03, 18), plastic, 0, y + 0.006);
        const lever = add(leg, new RoundedBoxGeometry(0.006, 0.036, 0.011, 2, 0.0022), plastic, rr + 0.0062, y + 0.008);
        lever.rotation.z = -0.06;
        add(leg, cylY(0.0018, 0.0018, 0.013, 8), aluLight, rr + 0.0052, y + 0.022).rotation.x = Math.PI / 2;
      }
    });
    // espuma na seção superior de uma das pernas (pega)
    if (k === 0) add(leg, cylY(0.0148, 0.0148, 0.16, 20), rubber, 0, 0.84 * L);
    // escora central (da coluna até a perna)
    const tb = (HUB - 0.31) / top.y, P = foot.clone().lerp(top, tb);
    const C = new THREE.Vector3(ca * 0.018, HUB - 0.215, sa * 0.018), d = P.clone().sub(C);
    const br = add(g, new RoundedBoxGeometry(0.009, d.length(), 0.004, 1, 0.0015), alu); br.position.copy(C).addScaledVector(d, 0.5); br.quaternion.setFromUnitVectors(UP, d.clone().normalize());
    // olhal da perna na aranha
    const lug = add(g, new RoundedBoxGeometry(0.024, 0.032, 0.026, 2, 0.004), rubber, ca * 0.043, HUB - 0.004, sa * 0.043); lug.rotation.y = -a;
    const pin = add(g, cylY(0.0035, 0.0035, 0.03, 10), aluLight, ca * 0.05, HUB + 0.002, sa * 0.05); pin.quaternion.setFromUnitVectors(UP, new THREE.Vector3(-sa, 0, ca));
  }
  // aranha (cubo de borracha), coluna central, trava, gancho e colar das escoras
  add(g, cylY(0.034, 0.03, 0.05, 28), rubber, 0, HUB);
  add(g, cylY(0.026, 0.026, 0.006, 24), alu, 0, HUB + 0.028);
  add(g, cylY(0.0118, 0.0118, PAN - (HUB - 0.27), 20), alu, 0, (PAN + HUB - 0.27) / 2);
  add(g, cylY(0.017, 0.017, 0.018, 20), plastic, 0, HUB - 0.215);
  const hook = add(g, new THREE.TorusGeometry(0.008, 0.0018, 8, 20, Math.PI * 1.4), aluLight, 0, HUB - 0.282); hook.rotation.z = Math.PI * 0.8;
  const knobA = 0.3 + Math.PI / 3; // trava da coluna entre duas pernas
  const kn = add(g, cylY(0.004, 0.004, 0.022, 10), aluLight, Math.cos(knobA) * 0.042, HUB + 0.006, Math.sin(knobA) * 0.042); const kd = new THREE.Vector3(Math.cos(knobA), 0, Math.sin(knobA)); kn.quaternion.setFromUnitVectors(UP, kd);
  const kn2 = add(g, cylY(0.0105, 0.0105, 0.012, 16), plastic, Math.cos(knobA) * 0.058, HUB + 0.006, Math.sin(knobA) * 0.058); kn2.quaternion.setFromUnitVectors(UP, kd);
  // base panorâmica + cabeça de esfera
  add(g, cylY(0.0245, 0.0245, 0.013, 28), alu, 0, PAN + 0.0065);
  add(g, cylY(0.0248, 0.0248, 0.0016, 28), aluLight, 0, PAN + 0.006);
  const hp = [[0.0, 0], [0.0205, 0], [0.021, 0.003], [0.0188, 0.016], [0.0172, 0.0225], [0.0162, 0.025], [0.0, 0.025]].map(([r, y]) => new THREE.Vector2(r, y));
  add(g, new THREE.LatheGeometry(hp, 28), alu, 0, PAN + 0.013);
  add(g, new THREE.SphereGeometry(0.0152, 24, 16), chrome, 0, BALL);
  const bk = add(g, cylY(0.0034, 0.0034, 0.012, 10), aluLight, 0.024, PAN + 0.026); bk.rotation.z = Math.PI / 2;
  const bk2 = add(g, cylY(0.0085, 0.0085, 0.01, 18), plastic, 0.033, PAN + 0.026); bk2.rotation.z = Math.PI / 2;

  // pivô na esfera: haste, pinça do engate rápido e placa (inclinados com o medidor)
  const pivot = new THREE.Group(); pivot.position.y = BALL; pivot.rotation.x = TILT; g.add(pivot);
  add(pivot, cylY(0.0068, 0.0075, 0.014, 18), alu, 0, 0.014);
  add(pivot, new RoundedBoxGeometry(0.042, 0.009, 0.038, 2, 0.002), alu, 0, 0.0245);
  const qk = add(pivot, cylY(0.0055, 0.0055, 0.012, 16), plastic, 0.027, 0.0245); qk.rotation.z = Math.PI / 2;
  add(pivot, new RoundedBoxGeometry(0.036, 0.0045, 0.029, 2, 0.0012), aluLight, 0, 0.0305);
  add(pivot, new THREE.BoxGeometry(0.032, 0.0008, 0.025), rubber, 0, 0.0331);

  // ── medidor (frame local: +y para o microfone, +z para a frente/visor; base em y = 0) ──
  const meter = new THREE.Group(); meter.name = 'slm-meter'; meter.position.y = 0.0335; pivot.add(meter);
  add(meter, bodyGeometry(THREE), shellM);
  add(meter, collarGeometry(THREE), collarM);
  const ZC = HD + CROWN; // z da frente no eixo

  // ── cápsula ½" (pré-amplificador + grade de proteção); a ponta é o micTip (+y para fora) ──
  const MIC_Y = 0.232, CR = CAPSULE_D / 2, TIP_Y = 0.2345;
  const nickel = std({ color: 0xb4b8bc, metalness: 1, roughness: 0.32 });
  const gr = grilleTex(THREE);
  add(meter, cylY(0.0098, 0.0072, 0.0035, 32), collarM, 0, 0.2072);                     // assento moldado no topo do colar
  add(meter, cylY(CR - 0.0003, CR - 0.0003, 0.0185, 40), nickel, 0, 0.2163);           // corpo do pré-amplificador
  add(meter, cylY(CR, CR, 0.0012, 40), std({ color: 0x8e9296, metalness: 1, roughness: 0.45 }), 0, 0.2251); // anel da rosca
  { // grade: lateral com janelas + topo abaulado com furos (lathe: v ao longo do perfil)
    const side = add(meter, new THREE.CylinderGeometry(CR, CR, 0.0074, 48, 1, true), std({ map: gr.side, metalness: 0.9, roughness: 0.38, color: 0xffffff }), 0, 0.2257 + 0.0037);
    side.material.map.repeat.set(1, 1);
    const prof = []; for (let i = 0; i <= 8; i++) { const a = (Math.PI / 2) * (i / 8); prof.push(new THREE.Vector2(CR - 0.0009 + 0.0009 * Math.cos(a), 0.0009 * Math.sin(a))); }
    prof.push(new THREE.Vector2(CR * 0.7, 0.00125), new THREE.Vector2(0.0001, 0.0014));
    const capG = new THREE.LatheGeometry(prof, 48);
    // UV planar no topo para os furos radiais
    const P = capG.attributes.position, UV = capG.attributes.uv; for (let i = 0; i < P.count; i++) UV.setXY(i, 0.5 + P.getX(i) / (2 * CR), 0.5 - P.getZ(i) / (2 * CR));
    add(meter, capG, std({ map: gr.top, metalness: 0.9, roughness: 0.36 }), 0, 0.2331);
  }
  const micTip = new THREE.Object3D(); micTip.name = 'slm-mic-tip'; micTip.position.y = TIP_Y; meter.add(micTip);

  // espuma preta de células abertas: esfera levemente irregular (não é um globo perfeito) + penugem na silhueta
  const { bump: foamBump, fuzz } = foamTextures(THREE);
  const lumpy = (geo, amp) => { // deslocamento radial por ruído suave determinístico
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize();
      const d = Math.sin(n.x * 7.1 + 1.3) * Math.sin(n.y * 6.3 + 0.4) * Math.sin(n.z * 5.7 + 2.1) + 0.5 * Math.sin(n.x * 13 + n.z * 11 + 0.7) * Math.sin(n.y * 12.5 + 1.9);
      v.addScaledVector(n, amp * d); p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals(); return geo; };
  const foam = new THREE.Group(); foam.position.y = MIC_Y; meter.add(foam);
  const foamG = lumpy(new THREE.SphereGeometry(0.030, 64, 40), 0.0006); foamG.rotateZ(Math.PI / 2);
  add(foam, foamG, std({ color: 0x1d1e20, roughness: 1, bumpMap: foamBump, bumpScale: 2.6 }));
  [[0.0303, 0.5, 0], [0.0308, 0.7, 1.1]].forEach(([r, at, rot]) => {
    const sg = lumpy(new THREE.SphereGeometry(r, 48, 30), 0.0006 * r / 0.03); sg.rotateZ(Math.PI / 2); sg.rotateY(rot);
    const m = add(foam, sg, std({ color: 0x202123, roughness: 1, alphaMap: fuzz, alphaTest: at, bumpMap: foamBump, bumpScale: 2 })); m.castShadow = false;
  });
  const mic = new THREE.Object3D(); mic.position.y = MIC_Y; meter.add(mic);

  // ── visor: janela de acrílico (máscara grafite) com LCD rebaixado e cobertura com reflexo ──
  const YL = 0.112;
  const rrect = (p, w, h, r, cx = 0, cy = 0) => { const x0 = cx - w / 2, y0 = cy - h / 2; p.moveTo(x0 + r, y0); p.lineTo(x0 + w - r, y0); p.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); p.lineTo(x0 + w, y0 + h - r); p.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); p.lineTo(x0 + r, y0 + h); p.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); p.lineTo(x0, y0 + r); p.quadraticCurveTo(x0, y0, x0 + r, y0); return p; };
  const bzS = rrect(new THREE.Shape(), 0.0462, 0.0502, 0.0040); bzS.holes.push(rrect(new THREE.Path(), 0.0398, 0.0374, 0.0012));
  const bezel = add(meter, new THREE.ExtrudeGeometry(bzS, { depth: 0.0016, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0005, bevelSegments: 4, curveSegments: 10 }), bezelM, 0, YL, ZC - 0.0006);
  bezel.castShadow = false;
  // rebaixo: paredes internas da janela (cinza escuro fosco) até o LCD
  const wallS = rrect(new THREE.Shape(), 0.0404, 0.0380, 0.0014); wallS.holes.push(rrect(new THREE.Path(), 0.0396, 0.0372, 0.0011));
  add(meter, new THREE.ExtrudeGeometry(wallS, { depth: 0.0016, bevelEnabled: false, curveSegments: 6 }), std({ color: 0x15171a, roughness: 0.7 }), 0, YL, ZC - 0.0002).castShadow = false;
  const LCD = makeLCD(THREE);
  const lcdM = std({ map: LCD.tex, emissiveMap: LCD.tex, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.6, metalness: 0 });
  const lcd = add(meter, new THREE.PlaneGeometry(0.0398, 0.0373), lcdM, 0, YL, ZC + 0.00015);
  lcd.userData.noBloom = true; lcd.castShadow = false;
  // cobertura: reflexo especular aditivo (o acrílico fica no topo da janela, ≈ 1,6 mm acima do LCD → paralaxe real)
  const glass = add(meter, new THREE.PlaneGeometry(0.0398, 0.0374), phy({ color: 0x000000, roughness: 0.05, metalness: 0, specularIntensity: 0.25, clearcoat: 0.35, clearcoatRoughness: 0.04, envMapIntensity: 1.3, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 0, YL, ZC + 0.0015);
  glass.castShadow = false; glass.userData.noBloom = true; glass.renderOrder = 2;
  { // reflexo difuso fixo e bem sutil (faixa diagonal + micro-riscos), para o acrílico "existir" sob luz fraca
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const gd = x.createLinearGradient(0, 0, 256, 256); gd.addColorStop(0, '#000'); gd.addColorStop(0.28, '#262626'); gd.addColorStop(0.4, '#0a0a0a'); gd.addColorStop(0.64, '#000'); gd.addColorStop(0.8, '#121212'); gd.addColorStop(1, '#000');
    x.fillStyle = gd; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(255,255,255,0.10)'; x.lineWidth = 0.6; let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) { const a = r() * 256, b = r() * 256, l = 8 + r() * 40, an = r() * Math.PI; x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(an) * l, b + Math.sin(an) * l); x.stroke(); }
    const st = new THREE.CanvasTexture(c); st.colorSpace = THREE.SRGBColorSpace; st.anisotropy = 8;
    const sheen = add(meter, new THREE.PlaneGeometry(0.0398, 0.0374), new THREE.MeshBasicMaterial({ map: st, color: 0x7a7a7a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 0, YL, ZC + 0.00155);
    sheen.castShadow = false; sheen.userData.noBloom = true; sheen.renderOrder = 3;
  }

  // ── teclado de borracha de silicone (cada tecla num grupo próprio: afunda ao pressionar) ──
  const conform = (geo, zf) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, zf(p.getX(i), p.getY(i))); geo.computeVertexNormals(); return geo; };
  const atlas = keyAtlas(THREE);
  const labelM = std({ map: atlas.tex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const cellUV = (geo, c) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, c.u0 + uv.getX(i) * (c.u1 - c.u0), c.v0 + uv.getY(i) * (c.v1 - c.v0)); return geo; };
  const KEYS = [{ id: 'fs', t: 'F/S', x: -0.0088, y: 0.0505, w: 0.0146, h: 0.0072 }, { id: 'ac', t: 'A/C', x: 0.0088, y: 0.0505, w: 0.0146, h: 0.0072 },
    { id: 'maxmin', t: 'MAX/MIN', x: 0, y: 0.0402, w: 0.0216, h: 0.0068 }, { id: 'level', t: 'LEVEL', x: 0, y: 0.0302, w: 0.0176, h: 0.0068 }];
  const POWER = { x: 0, y: 0.0648, r: 0.0058 };
  const keyObj = {}; // id → { grp, mat, z0, t }
  const BV = 0.0009, KD = 0.0006; // chanfro arredondado e corpo da tecla (altura útil ≈ 1,6 mm acima da casca)
  for (const q of KEYS) {
    const sh = rrect(new THREE.Shape(), q.w - 2 * BV + 0.0008, q.h - 2 * BV + 0.0008, (q.h - 2 * BV + 0.0008) * 0.48);
    const fz = frontZ(q.x, q.y), kg = new THREE.ExtrudeGeometry(sh, { depth: KD, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 6, curveSegments: 12 });
    const grp = new THREE.Group(); grp.position.set(q.x, q.y, fz - 0.0003); meter.add(grp);
    const mat = keyM.clone();
    add(grp, kg, mat).castShadow = false;
    const c = atlas.cells[q.t], lw = Math.min(q.w * 0.8, q.h * 0.66 * c.aspect);
    add(grp, cellUV(new THREE.PlaneGeometry(lw, lw / c.aspect), c), labelM, 0, 0, KD + BV + 0.00004).castShadow = false;
    keyObj[q.id] = { grp, mat, z0: grp.position.z, t: 9 };
  }
  { // tecla de liga/desliga redonda, mesma borracha, com o ícone serigrafado
    const PR = POWER.r, RR = 0.0008, TOP = 0.0014;
    const topZ = (r) => TOP + 0.00022 * Math.max(0, 1 - (r / (PR - RR)) ** 2);
    const pp = [new THREE.Vector2(PR, -0.0006), new THREE.Vector2(PR, TOP - RR)];
    for (let i = 1; i <= 6; i++) { const a = (Math.PI / 2) * (i / 6); pp.push(new THREE.Vector2(PR - RR + RR * Math.cos(a), TOP - RR + RR * Math.sin(a))); }
    for (let i = 1; i <= 8; i++) { const r = (PR - RR) * (1 - i / 8); pp.push(new THREE.Vector2(Math.max(r, 1e-5), topZ(r))); }
    const pg = new THREE.LatheGeometry(pp, 48); pg.rotateX(Math.PI / 2);
    const grp = new THREE.Group(); grp.position.set(POWER.x, POWER.y, frontZ(POWER.x, POWER.y) - 0.0002); meter.add(grp);
    const mat = keyM.clone();
    add(grp, pg, mat).castShadow = false;
    const ig = cellUV(new THREE.CircleGeometry(0.0031, 32), atlas.cells.power);
    conform(ig, (x, y) => topZ(Math.hypot(x, y)) + 0.00004);
    add(grp, ig, labelM).castShadow = false;
    keyObj.power = { grp, mat, z0: grp.position.z, t: 9 };
  }

  // impressão da frente e do verso (decalques que acompanham o abaulamento)
  const decal = (map, x0, x1, y0, y1, back, rough = 0.5) => {
    const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 16, 8); geo.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    if (back) geo.rotateY(Math.PI);
    conform(geo, (x, y) => (back ? -1 : 1) * (frontZ(x, y) + 0.00006));
    const m = add(meter, geo, std({ map, transparent: true, roughness: rough, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.castShadow = false; return m;
  };
  decal(facePrint(THREE, { x0: -0.0215, x1: 0.0215, y0: 0.020, y1: 0.0875, keys: KEYS, power: POWER }), -0.0215, 0.0215, 0.020, 0.0875);
  decal(backPrint(THREE, { x0: -0.022, x1: 0.022, y0: 0.018, y1: 0.112 }), -0.022, 0.022, 0.018, 0.112, true, 0.45);
  // inserto de rosca do tripé no verso
  const ins = add(meter, cylY(0.0042, 0.0042, 0.0008, 20), chrome, 0, 0.0135, -frontZ(0, 0.0135) - 0.0002); ins.rotation.x = Math.PI / 2; ins.castShadow = false;
  const hole = add(meter, new THREE.CircleGeometry(0.0022, 16), rubber, 0, 0.0135, -frontZ(0, 0.0135) - 0.00065); hole.rotation.y = Math.PI; hole.castShadow = false;
  // parafusos da carcaça no verso (cabeça Phillips num furo escareado)
  { const sm = std({ map: screwTex(THREE), metalness: 0.35, roughness: 0.42 }), dark = std({ color: 0x1a1816, roughness: 0.9 });
    for (const [x, y] of [[-0.0152, 0.0165], [0.0152, 0.0165], [-0.0168, 0.1135], [0.0168, 0.1135]]) {
      const z = -frontZ(x, y);
      const h = add(meter, new THREE.CircleGeometry(0.00225, 24), dark, x, y, z - 0.00008); h.rotation.y = Math.PI; h.castShadow = false;
      const sc = add(meter, new THREE.CylinderGeometry(0.00155, 0.0016, 0.0004, 24), sm, x, y, z - 0.00005); sc.rotation.x = -Math.PI / 2; sc.castShadow = false;
    }
  }

  // ── estado do aparelho e LCD ──
  const mode = { power: true, weight: 'A', resp: 'S', max: false, cal: false };
  let reading = 0, target = 0, shown = '', redrawT = 0, bootT = 0, maxHold = 0, dirty = true, hiKey = null, hiT = 0;
  const lcdState = () => ({ val: mode.max ? Math.max(maxHold, reading) : reading, power: mode.power, boot: bootT > 0, weight: mode.weight, resp: mode.resp, max: mode.max, cal: mode.cal });
  const drawLCD = () => { LCD.draw(lcdState()); shown = lcdState().val.toFixed(1); dirty = false; };
  drawLCD();

  return {
    group: g, meter, mic, micTip,
    /** posiciona o tripé no piso (x,z) com o microfone voltado para a fonte (x,z) */
    placeAt(pos, src) { g.position.set(pos[0], 0, pos[1]); g.rotation.y = Math.atan2(-(src[0] - pos[0]), -(src[1] - pos[1])); g.updateMatrixWorld(true); },
    /** nível-alvo (dB) — transição suave; funciona para leituras A/C e para 94/114 dB do calibrador */
    setTarget(L) { target = L; if (!reading) reading = 35; },
    /** centro do visor no mundo */
    lcdWorld(v = new THREE.Vector3()) { return lcd.getWorldPosition(v); },
    get reading() { return reading; },
    get mode() { return { ...mode }; },
    /** muda o estado do aparelho: { power, weight:'A'|'C', resp:'F'|'S', max, cal } — campos opcionais */
    setMode(o = {}) {
      if (o.power !== undefined && !!o.power !== mode.power) { mode.power = !!o.power; if (mode.power) { bootT = 0.6; reading = 0; } }
      if (o.weight === 'A' || o.weight === 'C') mode.weight = o.weight;
      if (o.resp === 'F' || o.resp === 'S') mode.resp = o.resp;
      if (o.max !== undefined) { mode.max = !!o.max; maxHold = mode.max ? reading : 0; }
      if (o.cal !== undefined) mode.cal = !!o.cal;
      dirty = true;
    },
    /** afunda a tecla ≈ 0,6 mm e solta em ≈ 0,25 s: 'power' | 'fs' | 'ac' | 'maxmin' | 'level' */
    press(key) { const k = keyObj[key]; if (k) k.t = 0; },
    /** pulso emissivo suave numa tecla (ensino); null apaga */
    highlight(key) { for (const id in keyObj) keyObj[id].mat.emissiveIntensity = 0; hiKey = keyObj[key] ? key : null; hiT = 0; },
    /** mostra/oculta a espuma (cápsula ½" exposta) */
    setWindscreen(v) { foam.visible = !!v; },
    update(dt, t) {
      if (!g.visible) return;
      for (const id in keyObj) { // animação das teclas
        const k = keyObj[id]; if (k.t > 0.4) continue; k.t += dt;
        const p = k.t < 0.06 ? k.t / 0.06 : Math.max(0, 1 - (k.t - 0.06) / 0.25), e = p * p * (3 - 2 * p);
        k.grp.position.z = k.z0 - 0.0006 * e;
      }
      if (hiKey) { hiT += dt; keyObj[hiKey].mat.emissiveIntensity = 0.06 + 0.22 * (0.5 + 0.5 * Math.sin(hiT * 4.2)); }
      if (bootT > 0) { bootT -= dt; if (bootT <= 0) { reading = target ? Math.max(30, target - 8) : 0; dirty = true; } else if (dirty) drawLCD(); }
      if (mode.power && bootT <= 0 && target) {
        const tau = mode.resp === 'F' ? 0.18 : 0.9; // F ≈ 125 ms, S ≈ 1 s (com folga para a animação)
        reading += (target + 0.035 * Math.sin(t * 2.3) * Math.sin(t * 0.9 + 1) - reading) * (1 - Math.exp(-dt / tau));
        if (mode.max) maxHold = Math.max(maxHold, reading);
      }
      redrawT -= dt; const s = lcdState().val.toFixed(1);
      if (dirty || (redrawT <= 0 && s !== shown && mode.power && bootT <= 0)) { redrawT = mode.resp === 'F' ? 0.12 : 0.25; drawLCD(); }
    },
  };
}
