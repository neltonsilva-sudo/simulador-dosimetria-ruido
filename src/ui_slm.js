// Decibelímetro (medidor de nível de pressão sonora) portátil sobre tripé — dono: UI/DEMO (aula da Dose).
// Modelo genérico (sem marca): casca branco-gelo acetinada em "raquete" arredondada (varredura de seções com laterais
// de raio grande, frente/verso abaulados e linha de partição), colar grafite moldado que segura a espuma preta de células
// abertas, visor LCD reflexivo rebaixado sob janela de acrílico, teclas de borracha em relevo (azul de liga/desliga em
// cúpula, F/S, A/C, MAX/MIN, LEVEL) e tripé fotográfico compacto com cabeça de esfera e placa de engate rápido.
// Escala real (≈ 26 cm com a espuma). Origem do grupo = centro do tripé no piso; microfone ≈ 1,59 m (zona auditiva).
// Geometria da casca em ui_slm_geo.js; texturas procedurais e LCD em ui_slm_tex.js.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bodyGeometry, collarGeometry, frontZ, HD, CROWN } from './ui_slm_geo.js';
import { microTexture, foamTextures, facePrint, keyAtlas, backPrint, makeLCD } from './ui_slm_tex.js';

export function buildSLM(THREE) {
  const g = new THREE.Group(); g.name = 'decibelimetro'; g.visible = false;
  const std = (o) => new THREE.MeshStandardMaterial(o), phy = (o) => new THREE.MeshPhysicalMaterial(o);
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const micro = microTexture(THREE);

  // ── materiais ──
  const alu = phy({ color: 0x2a2d31, metalness: 0.8, roughness: 0.34, clearcoat: 0.2, clearcoatRoughness: 0.4 });   // alumínio anodizado
  const aluLight = std({ color: 0x8a8f95, metalness: 0.9, roughness: 0.3 });
  const plastic = std({ color: 0x16171a, roughness: 0.55, roughnessMap: micro });                                       // plástico preto das travas
  const rubber = std({ color: 0x101112, roughness: 0.88 });
  const chrome = std({ color: 0xb8bcc2, metalness: 1, roughness: 0.16 });
  const shellM = phy({ color: 0xe6e0d0, roughness: 0.44, roughnessMap: micro, bumpMap: micro, bumpScale: 0.35, clearcoat: 0.3, clearcoatRoughness: 0.3, vertexColors: true });
  const collarM = phy({ color: 0x2b2e33, roughness: 0.42, roughnessMap: micro, bumpMap: micro, bumpScale: 0.3, clearcoat: 0.38, clearcoatRoughness: 0.26, vertexColors: true });
  const bezelM = phy({ color: 0xb3b7ba, roughness: 0.5, roughnessMap: micro, clearcoat: 0.25, clearcoatRoughness: 0.3 });
  const keyM = phy({ color: 0x18191c, roughness: 0.6, roughnessMap: micro, sheen: 0.4, sheenRoughness: 0.6, sheenColor: 0x50545a });
  const powerM = phy({ color: 0x1d5bd0, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.2 });

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

  // espuma preta de células abertas + penugem na silhueta (cascas com teste alfa)
  const { bump: foamBump, fuzz } = foamTextures(THREE);
  const MIC_Y = 0.232;
  const foamG = new THREE.SphereGeometry(0.030, 56, 36); foamG.rotateZ(Math.PI / 2);
  add(meter, foamG, std({ color: 0x151617, roughness: 1, bumpMap: foamBump, bumpScale: 2.2 }), 0, MIC_Y);
  [[0.0304, 0.42, 0], [0.0309, 0.6, 1.1], [0.0314, 0.76, 2.3]].forEach(([r, at, rot]) => {
    const sg = new THREE.SphereGeometry(r, 40, 26); sg.rotateZ(Math.PI / 2); sg.rotateY(rot);
    const m = add(meter, sg, std({ color: 0x18191a, roughness: 1, alphaMap: fuzz, alphaTest: at, bumpMap: foamBump, bumpScale: 1.5 }), 0, MIC_Y); m.castShadow = false;
  });
  const mic = new THREE.Object3D(); mic.position.y = MIC_Y; meter.add(mic);

  // ── visor: moldura cinza com janela rebaixada, LCD vivo e cobertura de acrílico ──
  const YL = 0.112;
  const rrect = (p, w, h, r, cx = 0, cy = 0) => { const x0 = cx - w / 2, y0 = cy - h / 2; p.moveTo(x0 + r, y0); p.lineTo(x0 + w - r, y0); p.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); p.lineTo(x0 + w, y0 + h - r); p.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); p.lineTo(x0 + r, y0 + h); p.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); p.lineTo(x0, y0 + r); p.quadraticCurveTo(x0, y0, x0 + r, y0); return p; };
  const bzS = rrect(new THREE.Shape(), 0.0465, 0.0505, 0.0042); bzS.holes.push(rrect(new THREE.Path(), 0.0396, 0.0372, 0.0016));
  const bezel = add(meter, new THREE.ExtrudeGeometry(bzS, { depth: 0.0024, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.00045, bevelSegments: 3, curveSegments: 8 }), bezelM, 0, YL, ZC - 0.0013);
  bezel.castShadow = false;
  const LCD = makeLCD(THREE);
  const lcd = add(meter, new THREE.PlaneGeometry(0.0388, 0.0364), std({ map: LCD.tex, emissiveMap: LCD.tex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.55, metalness: 0 }), 0, YL, ZC + 0.00012);
  lcd.userData.noBloom = true; lcd.castShadow = false;
  const glass = add(meter, new THREE.PlaneGeometry(0.0394, 0.037), phy({ color: 0x000000, roughness: 0.05, metalness: 0, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 2.2, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 0, YL, ZC + 0.0011);
  glass.castShadow = false; glass.userData.noBloom = true; glass.renderOrder = 2;
  { // reflexo difuso fixo e bem sutil na cobertura (faixa diagonal), para o acrílico "existir" mesmo sob luz fraca
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#000'); gr.addColorStop(0.3, '#2a2a2a'); gr.addColorStop(0.42, '#0b0b0b'); gr.addColorStop(0.62, '#000'); gr.addColorStop(0.78, '#141414'); gr.addColorStop(1, '#000');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const st = new THREE.CanvasTexture(c); st.colorSpace = THREE.SRGBColorSpace;
    const sheen = add(meter, new THREE.PlaneGeometry(0.0386, 0.0362), new THREE.MeshBasicMaterial({ map: st, color: 0x8a8a8a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 0, YL, ZC + 0.00115);
    sheen.castShadow = false; sheen.userData.noBloom = true; sheen.renderOrder = 3;
  }

  // ── teclado de borracha ──
  const conform = (geo, zf) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, zf(p.getX(i), p.getY(i))); geo.computeVertexNormals(); return geo; };
  const atlas = keyAtlas(THREE);
  const labelM = std({ map: atlas.tex, transparent: true, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const cellUV = (geo, c) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, c.u0 + uv.getX(i) * (c.u1 - c.u0), c.v0 + uv.getY(i) * (c.v1 - c.v0)); return geo; };
  const KEYS = [{ t: 'F/S', x: -0.0088, y: 0.0505, w: 0.0146, h: 0.0072 }, { t: 'A/C', x: 0.0088, y: 0.0505, w: 0.0146, h: 0.0072 },
    { t: 'MAX/MIN', x: 0, y: 0.0402, w: 0.0216, h: 0.0068 }, { t: 'LEVEL', x: 0, y: 0.0302, w: 0.0176, h: 0.0068 }];
  const POWER = { x: 0, y: 0.0648, r: 0.006 };
  for (const q of KEYS) {
    const sh = rrect(new THREE.Shape(), q.w, q.h, q.h * 0.46);
    const fz = frontZ(q.x, q.y), kg = new THREE.ExtrudeGeometry(sh, { depth: 0.0011, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0005, bevelSegments: 3, curveSegments: 8 });
    add(meter, kg, keyM, q.x, q.y, fz - 0.0003 + 0.0006).castShadow = false;
    const c = atlas.cells[q.t], lw = Math.min(q.w * 0.86, q.h * 0.78 * c.aspect);
    add(meter, cellUV(new THREE.PlaneGeometry(lw, lw / c.aspect), c), labelM, q.x, q.y, fz + 0.0020 + 0.00004).castShadow = false;
  }
  // tecla azul em cúpula com o ícone impresso
  const PR = POWER.r, PH = 0.0024, domeZ = (r) => PH * (0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - (r / PR) ** 2)));
  const pp = [new THREE.Vector2(PR, -0.0004), new THREE.Vector2(PR, domeZ(PR) - 0.0002)];
  for (let i = 0; i <= 12; i++) { const r = PR * (1 - i / 12) * 0.985; pp.push(new THREE.Vector2(Math.max(r, 1e-5), domeZ(r))); }
  const pg = new THREE.LatheGeometry(pp, 40); pg.rotateX(Math.PI / 2);
  const pz = frontZ(POWER.x, POWER.y) - 0.0002;
  add(meter, pg, powerM, POWER.x, POWER.y, pz).castShadow = false;
  const ig = cellUV(new THREE.CircleGeometry(0.0034, 32), atlas.cells.power);
  conform(ig, (x, y) => domeZ(Math.hypot(x, y)) + 0.00005);
  add(meter, ig, labelM, POWER.x, POWER.y, pz).castShadow = false;

  // impressão da frente e do verso (decalques que acompanham o abaulamento)
  const decal = (map, x0, x1, y0, y1, back) => {
    const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 16, 8); geo.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    if (back) geo.rotateY(Math.PI);
    conform(geo, (x, y) => (back ? -1 : 1) * (frontZ(x, y) + 0.00006));
    const m = add(meter, geo, std({ map, transparent: true, roughness: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.castShadow = false; return m;
  };
  decal(facePrint(THREE, { x0: -0.02, x1: 0.02, y0: 0.022, y1: 0.0875, keys: KEYS, power: POWER }), -0.02, 0.02, 0.022, 0.0875);
  decal(backPrint(THREE, { x0: -0.022, x1: 0.022, y0: 0.018, y1: 0.112 }), -0.022, 0.022, 0.018, 0.112, true);
  // inserto de rosca do tripé no verso
  const ins = add(meter, cylY(0.0042, 0.0042, 0.0008, 20), chrome, 0, 0.0135, -frontZ(0, 0.0135) - 0.0002); ins.rotation.x = Math.PI / 2; ins.castShadow = false;
  const hole = add(meter, new THREE.CircleGeometry(0.0022, 16), rubber, 0, 0.0135, -frontZ(0, 0.0135) - 0.00065); hole.rotation.y = Math.PI; hole.castShadow = false;

  // ── LCD: leitura ──
  let reading = 0, target = 0, shown = '', redrawT = 0;
  const drawLCD = (v) => LCD.draw(v);
  drawLCD(0);

  return {
    group: g, meter, mic,
    /** posiciona o tripé no piso (x,z) com o microfone voltado para a fonte (x,z) */
    placeAt(pos, src) { g.position.set(pos[0], 0, pos[1]); g.rotation.y = Math.atan2(-(src[0] - pos[0]), -(src[1] - pos[1])); g.updateMatrixWorld(true); },
    setTarget(L) { target = L; if (!reading) reading = 35; },
    /** centro do visor no mundo */
    lcdWorld(v = new THREE.Vector3()) { return lcd.getWorldPosition(v); },
    get reading() { return reading; },
    update(dt, t) {
      if (!g.visible || !target) return;
      reading += (target + 0.035 * Math.sin(t * 2.3) * Math.sin(t * 0.9 + 1) - reading) * (1 - Math.exp(-dt / 0.9)); // resposta lenta (S ≈ 1 s)
      redrawT -= dt; const s = reading.toFixed(1);
      if (redrawT <= 0 && s !== shown) { shown = s; redrawT = 0.25; drawLCD(reading); }
    },
  };
}
