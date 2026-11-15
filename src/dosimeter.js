// DOSÍMETRO 3D — DoseMax (corpo TPE azul, moldura preta, visor 1,8" 128×160, 4 teclas, LED, microfone ½" com espuma,
// clipe de lapela, alça inferior, mini USB) + maleta do kit. Dono: DOSÍMETRO 3D. Geometria em mm dentro de um grupo ×0,001.
// Interação no canvas principal: clique/segure nas teclas → fw.press(key, heldMs); segurar ≥ 3 s dispara a pressão longa na
// hora (sem esperar soltar). ⏻+☰ juntos: segure as duas (multi-touch) OU Shift+clique em ⏻ ou ☰ → fw.press('power+menu').
import * as THREE from 'three';
import { TABLE } from './layout_cams.js';
import { extrudeSmooth, roundRectArc, mirroredShape, samplePath, iconShapes, sweepYZ, roundedSection, paintVerts, offsetHalf } from './dosi_geo.js';
import { rubberMaps, foamMaps, grilleTex, canvasTex, FONT, getEnvFallback, h2 } from './dosi_tex.js';
import { buildKitImpl } from './dosi_kit.js';

const MM = 0.001;
export const BLUE = 0x1e86e0;
export const LED_COL = { red: 0xff2a1a, yellow: 0xffc21a, blue: 0x2a7bff, green: 0x30ff60 };

/** material TPE azul emborrachado (compartilhado com o calibrador) */
export function rubberMat(color = BLUE, rough = 0.62, uvRep = 1 / 9) {
  const m = rubberMaps();
  const n = m.normal.clone(); n.repeat.set(uvRep, uvRep); n.needsUpdate = true;
  const r = m.rough.clone(); r.repeat.set(uvRep / 6, uvRep / 6); r.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({ color, roughness: rough, roughnessMap: r, normalMap: n, normalScale: new THREE.Vector2(0.35, 0.35),
    sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color(0x9cc8ff), clearcoat: 0.08, clearcoatRoughness: 0.5 });
}
/** TPE do DoseMax: borracha fosca com micro-grão de molde, sheen aveludado, rugosidade variável (poeira/oleosidade da mão) */
function tpeMat(color = BLUE, rough = 0.6) {
  const m = rubberMaps();
  const n = m.normal.clone(); n.repeat.set(1 / 5, 1 / 5); n.needsUpdate = true;
  const r = m.rough.clone(); r.repeat.set(1 / 40, 1 / 40); r.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({ color, roughness: rough, roughnessMap: r, normalMap: n, normalScale: new THREE.Vector2(0.55, 0.55),
    sheen: 0.7, sheenRoughness: 0.42, sheenColor: new THREE.Color(0x8cc4ff), specularIntensity: 0.55, clearcoat: 0, vertexColors: true });
}
/** quadro da maleta → âncora de mundo (pos em mm no espaço da maleta, deitado com +y do aparelho para o fundo) */
export function kitHome(stage, local, name) {
  const o = new THREE.Object3D(); o.name = name;
  const base = new THREE.Vector3(TABLE.pos[0], TABLE.h, TABLE.pos[2]);
  o.position.copy(new THREE.Vector3(...local).multiplyScalar(MM).applyAxisAngle(new THREE.Vector3(0, 1, 0), TABLE.rotY || 0).add(base));
  o.rotation.set(-Math.PI / 2, TABLE.rotY || 0, 0, 'YXZ'); stage.scene.add(o); return o;
}
export const KIT_LOCAL = { dosimeter: [-115, 64.5, 5], calibrator: [-15, 66.5, 0] };

/** ambiente de reflexo de reserva enquanto a cena não tiver environment */
export function envGuard(stage, mats) {
  let fb = null, applied = false;
  if (!stage.scene.environment && stage.renderer) getEnvFallback(stage.renderer).then((t) => (fb = t)).catch(() => {});
  return () => {
    const has = !!stage.scene.environment;
    if (!has && fb && !applied) { mats.forEach((m) => { m.envMap = fb; m.envMapIntensity = 0.8; m.needsUpdate = true; }); applied = true; }
    if (has && applied) { mats.forEach((m) => { m.envMap = null; m.needsUpdate = true; }); applied = false; }
  };
}
/** contorno pulsante (casca invertida) para highlight */
function outlineOf(mesh, color = 0xffd54a, grow = 1.0) {
  const g = mesh.geometry; g.computeBoundingBox(); const bb = g.boundingBox, s = new THREE.Vector3(); bb.getSize(s);
  const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
  o.scale.set((s.x + 2 * grow) / s.x, (s.y + 2 * grow) / s.y, (s.z + grow) / s.z); o.visible = false; o.renderOrder = 2; o.userData.noAO = true;
  mesh.add(o); return o;
}

/** anel de destaque nítido em volta de uma tecla 8,6×8,4 mm (plano, espessura uniforme, brilho com bloom) */
function keyRing(key) {
  const g = new THREE.Group(); g.visible = false; g.renderOrder = 4;
  const mk = (ow, oh, or, iw, ih, ir, col, op) => {
    const sh = roundRectArc(ow, oh, or); sh.holes.push(roundRectArc(iw, ih, ir, 0, 0, THREE.Path));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: op, depthWrite: false, toneMapped: false }));
    m.userData.noAO = true; m.userData.baseOpacity = op; g.add(m); return m;
  };
  mk(10.3, 10.1, 2.9, 9.1, 8.9, 2.4, 0xffd54a, 1.0).material.color.multiplyScalar(2.2); // traço nítido
  mk(11.6, 11.4, 3.5, 10.3, 10.1, 2.9, 0xffc21a, 0.35);                                  // halo suave por fora
  g.position.set(key.position.x, key.position.y, key.position.z - 0.55);                 // na moldura, em volta da tecla (não afunda com ela)
  key.parent.add(g); return g;
}
export function buildDosimeter(stage, fw, app) {
  const group = new THREE.Group(); group.name = 'DoseMax';
  const B = new THREE.Group(); B.scale.setScalar(MM); group.add(B);
  const add = (geo, mat, parent = B, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };

  // ── corpo TPE azul — 60 × 115 × 23 mm (150 mm com microfone/espuma e alça; ombros que abraçam a espuma; afina embaixo) ──
  // Silhueta medida na foto (refs/ref_dosemax_calpro.png) e no desenho do manual (p.10): ombros com raio grande, encaixe em U
  // para o colar do microfone, laterais levemente abauladas, base mais estreita com cantos arredondados.
  const half = samplePath([
    [[0, -57.5], [17, -57.5]], [[17, -57.5], [24.5, -57.5], [27.6, -53.5], [27.9, -46]], [[27.9, -46], [28.6, -26], [30, -8], [30, 12]],
    [[30, 12], [30, 41]], [[30, 41], [30, 53.6], [27.4, 55.5], [20.5, 55.5]], [[20.5, 55.5], [17.6, 55.5]],
    [[17.6, 55.5], [13.6, 55.5], [13.4, 46.5], [0, 46.5]]], 18);
  const bodyMat = tpeMat(BLUE);
  const bodyGeo = extrudeSmooth(mirroredShape(half), 23, { bt: 5.2, bs: 4.6, seg: 9, curve: 32 });
  paintVerts(bodyGeo, (x, y, z, nx, ny, nz) => {
    const az = Math.abs(nz), rim = az > 0.25 && az < 0.92 ? Math.sin(((az - 0.25) / 0.67) * Math.PI) : 0; // aresta do bisel
    const wear = rim * (Math.abs(z) > 6 ? 1 : 0) * (0.55 + 0.45 * h2(Math.round(x * 2), Math.round(y * 2), 7));
    const notch = y > 44 && Math.abs(x) < 19 ? 1 : 0, low = y < -53 ? 1 : 0, side = az < 0.2 ? 0.35 : 0;
    const dust = Math.min(1, 0.7 * notch + 0.6 * low + side * (0.5 + 0.5 * h2(Math.round(y), Math.round(z * 3), 3)));
    const k = 1 + 0.13 * wear - 0.16 * dust, g = 0.05 * wear + 0.07 * dust; // desgaste clareia/dessatura, poeira escurece/acinzenta
    return [k + g * 1.4, k + g * 0.6, k - g * 0.4];
  });
  const body = add(bodyGeo, bodyMat); body.name = 'corpo';
  // linha de partição do molde (filete escuro no meio da lateral)
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x0b3f74, roughness: 0.75 });
  const seamShape = mirroredShape(offsetHalf(half, 0.18)); seamShape.holes.push(mirroredShape(offsetHalf(half, -0.6), THREE.Path));
  add(new THREE.ExtrudeGeometry(seamShape, { depth: 0.35, bevelEnabled: false, curveSegments: 24 }), seamMat, B, false).position.z = -0.17;

  // ── moldura preta frontal (cantos de raio pequeno em cima, base acompanhando o afinamento do corpo) ──
  const bez = samplePath([[[0, -45.5], [17, -45.5]], [[17, -45.5], [21.8, -45.5], [24.2, -43], [24.4, -38.5]], [[24.4, -38.5], [24.9, 34.5]],
    [[24.9, 34.5], [24.9, 38.0], [23.4, 39.2], [20.2, 39.2]], [[20.2, 39.2], [0, 39.2]]], 12);
  const BX = 24.9, BY0 = -45.5, BY1 = 39.2, PX = 10; // canvas 10 px/mm
  const bezTex = canvasTex(Math.round(2 * BX * PX), Math.round((BY1 - BY0) * PX), (g, w, h) => {
    const X = (x) => (x + BX) * PX, Y = (y) => (BY1 - y) * PX;
    g.fillStyle = '#141619'; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w * 0.3, h); grd.addColorStop(0, 'rgba(255,255,255,0.035)'); grd.addColorStop(1, 'rgba(0,0,0,0.04)'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const a = h2(i, 1, 9), b = h2(i, 2, 9), s = h2(i, 3, 9); g.fillStyle = `rgba(200,200,190,${0.05 + 0.08 * s})`; g.fillRect(a * w, b * h, 1 + s * 1.5, 1 + s); } // poeira fina
    // rebaixo da janela do visor (filete fosco)
    g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 6; g.strokeRect(X(-17.6), Y(25.7), 35.2 * PX, 43.4 * PX);
    g.textBaseline = 'middle'; g.font = `700 46px ${FONT}`;
    const t1 = 'Dose', t2 = 'Max', w1 = g.measureText(t1).width, w2 = g.measureText(t2).width, x0 = w / 2 - (w1 + w2) / 2;
    g.fillStyle = '#f2f4f6'; g.fillText(t1, x0, Y(32.2)); g.fillStyle = '#2f9bff'; g.fillText(t2, x0 + w1, Y(32.2));
    g.font = `700 30px ${FONT}`; g.fillStyle = '#eceff2'; g.textAlign = 'center'; g.fillText('Dosímetro de Ruído', w / 2, Y(-35.6));
    g.font = `600 17px ${FONT}`; g.fillStyle = 'rgba(220,226,232,0.55)'; g.fillText('Classe 2 · IEC 61252', w / 2, Y(-40.6));
    // poços das teclas (sombra de contato)
    for (let i = 0; i < 4; i++) { const cx = X(-15.75 + i * 10.5), cy = Y(-25.2); const rg = g.createRadialGradient(cx, cy, 30, cx, cy, 64);
      rg.addColorStop(0, 'rgba(0,0,0,0.75)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(cx - 70, cy - 70, 140, 140); }
  });
  const bezMat = new THREE.MeshPhysicalMaterial({ map: bezTex, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.28, specularIntensity: 0.7 });
  const bezel = add(extrudeSmooth(mirroredShape(bez), 1.6, { bt: 0.5, bs: 0.55, seg: 3, uv: 'planar' }), bezMat); bezel.position.z = 12.0; bezel.name = 'moldura';
  const FRONT = 12.8;

  // ── lente do visor: vidro preto com borda chanfrada + tela emissiva (fw.canvas) + reflexo do ambiente ──
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x030405, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
    specularIntensity: 1, envMapIntensity: 1.6 });
  const LW = 34.2, LH = 42.6, LY = 4.0, LT = 1.0;
  const lens = add(extrudeSmooth(roundRectArc(LW, LH, 1.4), LT, { bt: 0.45, bs: 0.7, seg: 1 }), lensMat, B, false);
  lens.position.set(0, LY, FRONT + LT / 2 - 0.1); const LENS_TOP = FRONT + LT - 0.1;
  // tela em ALTA RESOLUÇÃO: o mesmo desenho vetorial do painel "Visor do dosímetro" (fontes reais), 768×960 com mipmaps.
  // ?lcdbmp=1 volta ao bitmap 128×160 ampliado com grade de pixels.
  const HS = 6, useHi = !!fw?.drawHi && new URLSearchParams(location.search).get('lcdbmp') !== '1';
  const hiCv = document.createElement('canvas'); hiCv.width = 128 * HS; hiCv.height = 160 * HS; const hiCtx = hiCv.getContext('2d');
  const tex = fw?.canvas ? new THREE.CanvasTexture(useHi ? hiCv : fw.canvas) : null;
  if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; if (useHi) { tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; } }
  if (useHi) { fw.drawHi(hiCtx, HS); try { document.fonts?.ready?.then(() => { fw.dirty = true; }); } catch {} }
  const scrMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.18, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.0,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  if (!useHi) scrMat.onBeforeCompile = (sh) => { // grade de subpixels só no modo bitmap
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `
      #ifdef USE_EMISSIVEMAP
        vec4 emC = texture2D( emissiveMap, vEmissiveMapUv );
        vec2 pp = vEmissiveMapUv * vec2(128.0, 160.0);
        vec2 fwp = fwidth(pp); float k = clamp(1.0 - (max(fwp.x, fwp.y) - 0.12) / 0.3, 0.0, 1.0);
        float sx = fract(pp.x) * 3.0; vec3 mask = vec3(1.0 - smoothstep(0.85, 1.05, sx), smoothstep(0.95, 1.1, sx) * (1.0 - smoothstep(1.9, 2.1, sx)), smoothstep(1.95, 2.15, sx));
        float gap = smoothstep(0.0, 0.12, fract(pp.y)) * smoothstep(1.0, 0.88, fract(pp.y));
        emC.rgb = mix(emC.rgb, emC.rgb * mask * 2.6 * gap, k * 0.3); // o canvas do visor já traz a grade de pixels (lcd.js): aqui só um reforço leve de perto
        totalEmissiveRadiance *= emC.rgb;
      #endif`);
  };
  const screen = add(new THREE.PlaneGeometry(28.6, 35.7), scrMat, B, false); screen.position.set(0, LY + 0.6, LENS_TOP + 0.03); screen.name = 'tela';
  // reflexo de estúdio no vidro (faixa diagonal suave + brilho na borda chanfrada) — aditivo, independe do environment
  const glintTex = canvasTex(256, 320, (g, w, h) => {
    g.clearRect(0, 0, w, h); const lg = g.createLinearGradient(0, 0, w, h * 0.8);
    lg.addColorStop(0.0, 'rgba(255,255,255,0.0)'); lg.addColorStop(0.18, 'rgba(255,255,255,0.55)'); lg.addColorStop(0.34, 'rgba(255,255,255,0.10)');
    lg.addColorStop(0.55, 'rgba(255,255,255,0.0)'); lg.addColorStop(0.8, 'rgba(255,255,255,0.06)'); lg.addColorStop(1, 'rgba(255,255,255,0.0)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    const vg = g.createLinearGradient(0, 0, 0, h); vg.addColorStop(0, 'rgba(255,255,255,0.22)'); vg.addColorStop(0.05, 'rgba(255,255,255,0)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  }, { srgb: false });
  const glintMat = new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  const glint = add(new THREE.PlaneGeometry(LW - 1.2, LH - 1.2), glintMat, B, false); glint.position.set(0, LY, LENS_TOP + 0.08); glint.userData.noBloom = true; glint.renderOrder = 3;

  // ── teclas de silicone com ícones serigrafados (tinta branca fina) ──
  const keyMat = tpeMat(0x2a90ea, 0.48); keyMat.sheen = 0.55; keyMat.vertexColors = false;
  const icoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.28, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); // tinta branca viva (como as teclas do painel)
  const keyGeo = extrudeSmooth(roundRectArc(8.6, 8.4, 1.8), 2.4, { bt: 0.55, bs: 0.6, seg: 6 }); // tampo plano e borda definida
  const keys = {}, keyOutline = {}, keyRest = {}, holdRing = {}; // holdRing: anel de progresso da pressão longa (como o painel)
  ['power', 'play', 'stop', 'menu'].forEach((k, i) => {
    const m = add(keyGeo, keyMat); m.position.set(-15.75 + i * 10.5, -25.2, FRONT + 0.85); m.name = 'tecla_' + k; m.userData.key = k;
    const ig = new THREE.ExtrudeGeometry(iconShapes(k, 1.0), { depth: 0.04, bevelEnabled: false, curveSegments: 16 });
    const ic = new THREE.Mesh(ig, icoMat); ic.position.z = 1.2; ic.userData.key = k; m.add(ic);
    keys[k] = m; keyRest[k] = m.position.z; keyOutline[k] = keyRing(m); holdRing[k] = keyRing(m); holdRing[k].userData.p = 0;
  });
  // ── LED (canto superior direito da moldura, item 6 do manual) ──
  const ledMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1210, roughness: 0.08, clearcoat: 1, emissive: 0x000000, emissiveIntensity: 3, toneMapped: false });
  const led = add(new THREE.SphereGeometry(1.15, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), ledMat, B, false);
  led.rotation.x = Math.PI / 2; led.scale.set(1, 0.45, 1); led.position.set(20.6, 34.6, FRONT); led.name = 'led';
  const ledRing = add(new THREE.TorusGeometry(1.45, 0.28, 8, 28), new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.5 }), B, false); ledRing.position.copy(led.position);

  // ── microfone ½" (colar preto de borracha + cápsula niquelada) — encaixado entre os ombros ──
  const colMat = new THREE.MeshPhysicalMaterial({ color: 0x15161a, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color(0x555555), clearcoat: 0.1 });
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0xc4c8cc, metalness: 1, roughness: 0.26 });
  const prof = [[0, 40], [10.4, 40], [10.4, 50.5], [9.9, 52.5], [8.2, 53.6], [7.6, 55], [7.6, 58]].map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(prof, 48), colMat);
  const cap = add(new THREE.LatheGeometry([[0, 58], [6.35, 58], [6.35, 65.6], [6.1, 66.3], [5.6, 66.5]].map(([r, y]) => new THREE.Vector2(r, y)), 40), capMat);
  const grill = add(new THREE.CircleGeometry(5.6, 40), new THREE.MeshStandardMaterial({ map: grilleTex(), metalness: 0.8, roughness: 0.35 }), B, false);
  grill.rotation.x = -Math.PI / 2; grill.position.y = 66.5;
  const mic = new THREE.Object3D(); mic.name = 'mic'; mic.position.set(0, 0.0666, 0); group.add(mic);

  // ── espuma (windscreen) com poros + oclusão na base ──
  const fm = foamMaps();
  const fN = fm.normal.clone(); fN.repeat.set(2, 1); fN.needsUpdate = true; const fC = fm.color.clone(); fC.repeat.set(2, 1); fC.needsUpdate = true;
  const foamMat = new THREE.MeshPhysicalMaterial({ color: 0x9a9a9a, map: fC, normalMap: fN, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 1,
    sheen: 0.5, sheenRoughness: 0.85, sheenColor: new THREE.Color(0x4a4a4a), vertexColors: true });
  const FR = 14.8, FY = 63.2;
  const fg = new THREE.SphereGeometry(FR, 112, 72); { // silhueta orgânica (micro deslocamento) + AO na base
    const p = fg.attributes.position, v = new THREE.Vector3(), col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize();
      const d = 0.26 * (h2(Math.round(n.x * 46), Math.round(n.y * 46), Math.round(n.z * 46)) - 0.5); v.addScaledVector(n, d); p.setXYZ(i, v.x, v.y, v.z);
      const ao = 0.45 + 0.55 * THREE.MathUtils.smoothstep(n.y, -0.95, 0.1); const a = ao * (0.9 + 0.1 * h2(i, 5, 1)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = a; }
    fg.setAttribute('color', new THREE.BufferAttribute(col, 3)); fg.computeVertexNormals(); }
  const foamPivot = new THREE.Group(); foamPivot.position.y = FY; B.add(foamPivot);
  const foam = add(fg, foamMat, foamPivot); foam.scale.set(1, 1.06, 1); foam.name = 'espuma';

  // ── alça inferior (argola preta, item 3/4 do desenho) ──
  const loop = roundRectArc(31, 15.5, [3.6, 3.6, 2, 2]); loop.holes.push(roundRectArc(23.5, 6.2, 1.8, 0, -2.2, THREE.Path));
  const blackPl = new THREE.MeshPhysicalMaterial({ color: 0x121315, roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.5 });
  const strap = add(extrudeSmooth(loop, 4, { bt: 1, bs: 1, seg: 3 }), blackPl); strap.position.set(0, -63, -2.5);
  const strapRoot = add(extrudeSmooth(roundRectArc(26, 5, 1.5), 7, { bt: 1.2, bs: 1.2, seg: 3 }), blackPl); strapRoot.position.set(0, -56.5, -2.5);

  // ── clipe de lapela metálico (traseiro, item 9) + bloco da mola ──
  const clipMat = new THREE.MeshPhysicalMaterial({ color: 0xc9ccd0, metalness: 1, roughness: 0.32, anisotropy: 0.7 });
  const BACK = -11.5, cpath = [];
  for (let i = 0; i <= 48; i++) { const t = i / 48; const y = 40 - t * 76; const z = BACK - 4.6 + 3.9 * t * t - (t > 0.93 ? (t - 0.93) * 30 : 0); cpath.push([y, z]); }
  add(sweepYZ(cpath, roundedSection(20, 1.0, 0.45, 3)), clipMat);
  const hinge = add(extrudeSmooth(roundRectArc(22, 10, 2.6), 5.5, { bt: 1.3, bs: 1.3, seg: 3 }), blackPl); hinge.position.set(0, 38, BACK - 1.6);
  const pin = add(new THREE.CylinderGeometry(1.15, 1.15, 24, 16), clipMat); pin.rotation.z = Math.PI / 2; pin.position.set(0, 41.4, BACK - 4);
  // etiqueta traseira (poliéster prata fosco, sob o clipe) + tampa da bateria (sulco)
  const lblTex = canvasTex(440, 360, (g, w, h) => {
    g.fillStyle = '#b8bcc0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2a2d31'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#1d2024'; g.textAlign = 'center'; g.font = `700 34px ${FONT}`; g.fillText('DoseMax', w / 2, 58);
    g.font = `500 21px ${FONT}`; ['Dosímetro de ruído pessoal', 'IEC 61252 · ANSI S1.25', 'Microfone ½" pré-polarizado', 'Bateria Li-ion 3,7 V · USB 5 V', 'S/N 24-0' + Math.floor(1000 + h2(3, 4, 5) * 8999)]
      .forEach((t, i) => g.fillText(t, w / 2, 104 + i * 34));
    g.fillRect(70, 284, 300, 44); g.fillStyle = '#b8bcc0'; for (let i = 0; i < 60; i++) g.fillRect(74 + i * 5, 284, 1 + (h2(i, 9, 2) * 3 | 0), 44); // código de barras
  });
  const lbl = add(new THREE.PlaneGeometry(40, 32.7), new THREE.MeshPhysicalMaterial({ map: lblTex, roughness: 0.55, metalness: 0.15, clearcoat: 0.2, polygonOffset: true, polygonOffsetFactor: -2 }), B, false);
  lbl.rotation.y = Math.PI; lbl.position.set(0, -14, BACK - 0.02);
  const door = roundRectArc(46, 66, 5); door.holes.push(roundRectArc(45.2, 65.2, 4.6, 0, 0, THREE.Path));
  const doorLine = add(new THREE.ShapeGeometry(door, 24), new THREE.MeshBasicMaterial({ color: 0x062a52, polygonOffset: true, polygonOffsetFactor: -2 }), B, false);
  doorLine.rotation.y = Math.PI; doorLine.position.set(0, -14, BACK - 0.03);
  const clipAnchor = new THREE.Object3D(); clipAnchor.name = 'clipAnchor'; clipAnchor.position.set(0, 0.04, -0.016); group.add(clipAnchor);

  // ── porta mini USB (lateral direita, alto — item 7) com tampa de borracha ──
  const usbHole = add(new THREE.BoxGeometry(1.4, 7.8, 3.6), new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9 }), B, false); usbHole.position.set(29.6, 30, 0);
  const usbT = add(new THREE.BoxGeometry(1.0, 5.4, 0.7), capMat, B, false); usbT.position.set(29.7, 30, 0.3);
  const usbRim = add(new THREE.TorusGeometry(3.3, 0.5, 6, 24), seamMat, B, false);
  usbRim.rotation.y = Math.PI / 2; usbRim.scale.set(1, 1.35, 0.6); usbRim.position.set(29.95, 30, 0);

  // ── âncora "home" no berço da maleta ──
  const home = kitHome(stage, KIT_LOCAL.dosimeter, 'dosimeterHome'); home.add(group);

  // ─────────── estado / animações ───────────
  const press = { power: 0, play: 0, stop: 0, menu: 0 }; // 0..1 afundamento
  const held = new Map(); // pointerId → {key, t0, fired}
  let hl = null, hlT = 0, wsTarget = 1, ws = 1, ledPhase = 0;
  const pulses = {};
  function pressAnim(key) { (key === 'power+menu' ? ['power', 'menu'] : [key]).forEach((k) => { if (k in press) pulses[k] = 0.22; }); }
  const extraOutline = { screen: outlineOf(lens, 0xffd54a, 0.9), led: outlineOf(led, 0xffd54a, 0.8), mic: outlineOf(cap, 0xffd54a, 0.9), usb: outlineOf(usbHole, 0xffd54a, 1.2) };
  function highlight(key) {
    hl = key; Object.values(keyOutline).concat(Object.values(extraOutline)).forEach((o) => (o.visible = false));
    const list = key === 'power+menu' ? ['power', 'menu'] : key === 'all' ? Object.keys(keys) : key ? [key] : [];
    list.forEach((k) => { const o = keyOutline[k] || extraOutline[k]; if (o) o.visible = true; });
  }
  function setWindscreen(on) { wsTarget = on ? 1 : 0; }

  // ── interação por raycast ──
  const cv = stage.canvas, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const keyMeshes = Object.values(keys);
  function pick(e) {
    if (!stage.camera || !group.visible) return null; const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, stage.camera);
    const hit = ray.intersectObjects(keyMeshes, true).find((h) => h.object.userData.key); return hit ? hit.object.userData.key : null;
  }
  const holding = (k) => [...held.values()].some((h) => h.key === k && !h.fired);
  function fire(key, ms) { pressAnim(key); try { fw?.press?.(key, ms); } catch (err) { console.error('[dosimeter] fw.press', err); } app?.emit?.('change'); }
  if (cv) {
    cv.addEventListener('pointerdown', (e) => {
      const k = pick(e); if (!k) return;
      e.stopImmediatePropagation(); e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {}
      if (stage.controls) stage.controls.enabled = false;
      let key = k; if (e.shiftKey && (k === 'power' || k === 'menu')) key = 'power+menu';
      // multi-touch: a outra tecla do par já está segurada → combina
      const other = k === 'power' ? 'menu' : k === 'menu' ? 'power' : null;
      if (other && holding(other)) { for (const h of held.values()) if (h.key === other) h.key = 'power+menu'; key = 'power+menu'; }
      held.set(e.pointerId, { key, t0: performance.now(), fired: false });
    }, { capture: true });
    const up = (e) => {
      const h = held.get(e.pointerId); if (!h) return; held.delete(e.pointerId);
      if (!h.fired) { const ms = performance.now() - h.t0; if (h.key === 'power+menu' && holding('power+menu')) { /* espera a outra */ } else fire(h.key, ms); }
      for (const o of held.values()) if (o.key === 'power+menu' && h.key === 'power+menu') o.fired = true;
      if (!held.size && stage.controls) stage.controls.enabled = true;
    };
    cv.addEventListener('pointerup', up, { capture: true }); cv.addEventListener('pointercancel', up, { capture: true });
    let lastMove = 0;
    cv.addEventListener('pointermove', (e) => { const n = performance.now(); if (n - lastMove < 60 || held.size) return; lastMove = n;
      const k = pick(e); if (k) { cv.style.cursor = 'pointer'; cv.__dosiHover = true; } else if (cv.__dosiHover) { cv.style.cursor = ''; cv.__dosiHover = false; } });
  }

  const envTick = envGuard(stage, [bodyMat, bezMat, lensMat, scrMat, keyMat, capMat, clipMat, blackPl, colMat]);
  function update(dt = 0.016, t = performance.now() / 1000) {
    envTick();
    if (tex && fw?.dirty) { if (useHi) fw.drawHi(hiCtx, HS); tex.needsUpdate = true; fw.dirty = false; }
    // pressão longa ao vivo (3 s)
    const now = performance.now();
    for (const h of held.values()) if (!h.fired && now - h.t0 >= 3000) {
      h.fired = true; if (h.key === 'power+menu') for (const o of held.values()) if (o.key === 'power+menu') o.fired = true; fire(h.key, 3000); }
    // anel de progresso ao segurar a tecla 3D (enche em 3 s; verde quando dispara) — mesmo retorno visual das teclas do painel
    for (const k in holdRing) {
      let p = -1, fired = false;
      for (const h of held.values()) if (h.key === k || (h.key === 'power+menu' && (k === 'power' || k === 'menu'))) { p = Math.max(p, Math.min(1, (now - h.t0) / 3000)); fired = fired || h.fired; }
      const R = holdRing[k], [tr, halo] = R.children;
      if (p >= 0) { R.userData.p = p; R.userData.fade = 1; R.visible = true; }
      else if (R.visible) { R.userData.fade -= dt * 4; if (R.userData.fade <= 0) R.visible = false; }
      if (R.visible) {
        const q = R.userData.p, f = Math.max(0, R.userData.fade);
        tr.material.color.setHex(fired || q >= 1 ? 0x3fd08a : 0x5aa4ff).lerp(new THREE.Color(fired || q >= 1 ? 0x3fd08a : 0xffd54a), fired ? 0 : q).multiplyScalar(2.2);
        tr.material.opacity = (0.35 + 0.65 * q) * f; halo.material.opacity = 0.45 * q * f;
        const sc = 1 + 0.06 * q; R.scale.set(sc, sc, 1);
      }
    }
    for (const k in press) {
      if (pulses[k] > 0) pulses[k] -= dt;
      const down = holding(k) || holding('power+menu') && (k === 'power' || k === 'menu') || pulses[k] > 0;
      press[k] += ((down ? 1 : 0) - press[k]) * Math.min(1, dt * 28);
      keys[k].position.z = keyRest[k] - press[k] * 0.95 + (keys[k].userData.hlLift || 0);
    }
    // LED (cor do firmware; pisca se o firmware indicar)
    const st = fw?.state || {}; const c = LED_COL[st.led];
    ledPhase += dt; const blink = st.ledBlink || st.blink ? Math.sin(ledPhase * Math.PI * 2) > 0 : true;
    if (c && blink) ledMat.emissive.setHex(c); else ledMat.emissive.setHex(0x000000);
    // highlight pulsante
    if (hl) { hlT += dt; const a = 0.45 + 0.45 * Math.sin(hlT * 6), p = 0.8 + 0.2 * Math.sin(hlT * 5);
      Object.values(extraOutline).forEach((o) => { if (o.visible) o.material.opacity = a; });
      for (const k in keyOutline) { const o = keyOutline[k]; if (!o.visible) continue; o.children.forEach((c) => (c.material.opacity = c.userData.baseOpacity * p)); } }
    for (const k in keys) { const up = keyOutline[k].visible ? 0.45 : 0; keys[k].userData.hlLift = (keys[k].userData.hlLift || 0) + (up - (keys[k].userData.hlLift || 0)) * Math.min(1, dt * 10); }
    // espuma sai/volta
    ws += (wsTarget - ws) * Math.min(1, dt * 5); if (Math.abs(ws - wsTarget) < 0.002) ws = wsTarget;
    foamPivot.visible = ws > 0.02; foamPivot.position.y = 63.2 + (1 - ws) * 34; foamPivot.rotation.z = (1 - ws) * 0.5;
    foamPivot.scale.setScalar(0.35 + 0.65 * ws);
  }
  update(0, 0);
  return { group, mic, keys, screen, home, clipAnchor, update, setWindscreen, pressAnim, highlight, led, foam };
}

export function buildKit(stage, app) { return buildKitImpl(stage, app); }
