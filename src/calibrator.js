// CALIBRADOR ACÚSTICO CalPro — fiel à foto de frente (refs/ref_calpro_frente.png). Dono: DOSÍMETRO 3D (calibrador).
// Corpo de TPE azul fosco (micro-granulado + sheen) que afina para baixo, ombros arredondados, bolsão frontal em U com janela
// preta brilhante (OLED "114dB", "1kHz", "IEC60942 – Classe 1", "CalPro"), botão ⏻ de borracha num recesso, relevo genérico
// embaixo; acoplador ½" de borracha preta no TOPO (cavity na boca, +y para fora). Costas: tampa de pilhas com parafusos e
// etiqueta de série/calibração; laterais com frisos de pega. Escala real ~64 × 100 × 38 mm (cabe no recorte da maleta).
// O tom de 1 kHz é do ÁUDIO. Clique no botão ⏻ liga/desliga; Shift+clique alterna 94/114 dB.
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { TABLE } from './layout_cams.js';
import { BODY, bodyGeometry, rrect, windowShape, extrudePlanar, POCKET } from './cal_geo.js';
import { rubberMaps, panelTextures, powerIconTex, labelTex, screwTex, reliefDecal, canvas, tex, CFONT, WIN } from './cal_tex.js';

const MM = 0.001;
const BLUE = 0x1877cc;
let KIT_CAL = [-15, 66.5, 0]; // posição na maleta (mm, espaço da maleta) — sincronizada com dosimeter.js quando disponível

function kitHome(stage) {
  const o = new THREE.Object3D(); o.name = 'calibratorHome';
  const place = () => {
    const base = new THREE.Vector3(TABLE.pos[0], TABLE.h, TABLE.pos[2]);
    o.position.copy(new THREE.Vector3(...KIT_CAL).multiplyScalar(MM).applyAxisAngle(new THREE.Vector3(0, 1, 0), TABLE.rotY || 0).add(base));
    o.rotation.set(-Math.PI / 2, TABLE.rotY || 0, 0, 'YXZ');
  };
  place(); stage.scene.add(o); o.userData.place = place; return o;
}

export function buildCalibrator(stage, app) {
  const group = new THREE.Group(); group.name = 'CalPro';
  const B = new THREE.Group(); B.name = 'CalPro_mm'; B.scale.setScalar(MM); group.add(B);
  const add = (geo, mat, p = B, sh = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = sh; m.receiveShadow = true; p.add(m); return m; };
  const R = rubberMaps();

  // ── corpo TPE ──
  const nrm = R.normal.clone(); nrm.repeat.set(0.11, 0.11); nrm.needsUpdate = true;
  const rgh = R.rough.clone(); rgh.repeat.set(0.018, 0.018); rgh.needsUpdate = true;
  const rubberP = { roughness: 1.08, metalness: 0, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x8cc4ff), clearcoat: 0.06, clearcoatRoughness: 0.55 };
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: BLUE, ...rubberP, roughnessMap: rgh, normalMap: nrm, normalScale: new THREE.Vector2(0.32, 0.32), vertexColors: true });
  const bodyGeo = bodyGeometry();
  const body = new THREE.Mesh(bodyGeo, bodyMat); body.name = 'CalPro_corpo'; body.castShadow = body.receiveShadow = true;
  body.updateMatrixWorld(true); // identidade (mm) — base para os decalques projetados

  const decal = (mat, pos, rot, size, lift = 0) => {
    const g = new DecalGeometry(body, new THREE.Vector3(...pos), new THREE.Euler(...rot), new THREE.Vector3(...size));
    if (lift) { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * lift, p.getY(i) + n.getY(i) * lift, p.getZ(i) + n.getZ(i) * lift); }
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false; return m;
  };
  const decalMat = (rel, extra = {}) => new THREE.MeshPhysicalMaterial({ color: BLUE, ...rubberP, roughness: 0.64, map: rel.ao, normalMap: rel.normal, normalScale: new THREE.Vector2(1, 1),
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, ...extra });

  // relevo genérico (sem marca) na frente, embaixo: ondas sonoras + "CLASSE 1"
  const embl = reliefDecal(24, 10, 22, (g) => {
    g.strokeStyle = g.fillStyle = 'rgb(205,205,205)'; g.lineCap = 'round'; g.lineWidth = 0.75;
    g.beginPath(); g.arc(-7.6, 0, 1.25, 0, Math.PI * 2); g.fill();
    for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(-7.6, 0, 1.25 + i * 1.35, -0.75, 0.75); g.stroke(); }
    g.font = `800 3.0px ${CFONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('CLASSE 1', -2.6, 0.15);
  }, { strength: 0.2, ao: 0.06, micro: 0.35 });
  B.add(decal(decalMat(embl), [0, -25, BODY.hd], [0, 0, 0], [24, 10, 8]));

  // costas: tampa de pilhas (fenda), escareados dos parafusos, texto em relevo
  const backRel = reliefDecal(36, 72, 14, (g) => {
    // canvas: +y para baixo → espelha y para usar mm do aparelho
    g.save(); g.scale(1, -1);
    const cover = (w, h, r, cy) => { const p = new Path2D(); const x0 = -w / 2, y0 = cy - h / 2; p.roundRect(x0, y0, w, h, r); return p; };
    g.fillStyle = 'rgb(140,140,140)'; g.fill(cover(30, 60, 5, 1));                        // tampa levemente saliente
    g.strokeStyle = 'rgb(20,20,20)'; g.lineWidth = 0.55; g.stroke(cover(30, 60, 5, 1));      // fenda
    for (const y of [27.2, -25.2]) { const gr = g.createRadialGradient(0, y, 1.6, 0, y, 3.0); gr.addColorStop(0, 'rgb(40,40,40)'); gr.addColorStop(1, 'rgb(140,140,140)'); g.fillStyle = gr; g.beginPath(); g.arc(0, y, 3.0, 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.fillStyle = 'rgb(190,190,190)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 2.4px ${CFONT}`; g.fillText('2 × AA  1,5 V', 0, -17.8);
    g.font = `700 2.0px ${CFONT}`; g.fillText('▼ ABRIR', 0, 19.4);
    g.font = `700 2.0px ${CFONT}`; g.fillText('½"  •  94 / 114 dB  •  1 kHz', 0, -33.4);
  }, { strength: 0.6, ao: 0.6, micro: 0.35 });
  B.add(decal(decalMat(backRel), [0, 0, -BODY.hd], [0, Math.PI, 0], [36, 72, 8]));
  // etiqueta de série / calibração
  const labMat = new THREE.MeshPhysicalMaterial({ map: labelTex(25, 18), roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.25, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  B.add(decal(labMat, [0, 4.2, -BODY.hd], [0, Math.PI, 0], [25, 18, 8], 0.12));
  // parafusos Phillips (inox escovado) nos escareados
  const scMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: screwTex(), metalness: 1, roughness: 0.32 });
  for (const y of [27.2, -25.2]) { const s = add(new THREE.CylinderGeometry(2.05, 2.15, 0.7, 28), scMat, B, false); s.rotation.x = Math.PI / 2; s.position.set(0, y, -BODY.hd - 0.05); }
  // laterais: frisos de pega (sulcos horizontais)
  const grip = reliefDecal(30, 28, 14, (g) => {
    for (let i = 0; i < 9; i++) { const y = -11.2 + i * 2.8; g.fillStyle = 'rgb(40,40,40)'; g.beginPath(); g.roundRect(-11, y - 0.45, 22, 0.9, 0.45); g.fill(); }
  }, { strength: 0.55, ao: 0.45, micro: 0.35 });
  const gm = decalMat(grip);
  B.add(decal(gm, [30.5, 4, 0], [0, Math.PI / 2, 0], [30, 28, 9]));
  B.add(decal(gm, [-30.5, 4, 0], [0, -Math.PI / 2, 0], [30, 28, 9]));
  B.add(body);

  // ── janela preta brilhante (sobre o fundo do bolsão) ──
  const PT = panelTextures();
  const winMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: PT.map, roughness: 1, roughnessMap: PT.rough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.035, specularIntensity: 0.9 });
  const zFloor = BODY.hd - POCKET.depth;
  const win = add(extrudePlanar(windowShape(WIN), 0.5, 0.3, [WIN.x0, WIN.y0, WIN.x1, WIN.y1]), winMat, B, false); win.position.z = zFloor - 0.45;
  const zWin = zFloor - 0.45 + 0.5 + 0.3;

  // ── OLED ──
  const OW = 20.6, OH = 11.4, OX = 1.3, OY = 24.3;
  const oc = canvas(512, 284), og = oc.getContext('2d'); const oTex = tex(oc); oTex.anisotropy = 8;
  const oledMat = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0xffffff, emissiveMap: oTex, emissiveIntensity: 0 });
  const oled = add(new THREE.PlaneGeometry(OW, OH), oledMat, B, false); oled.position.set(OX, OY, zWin + 0.02);

  // ── botão ⏻ (borracha azul) num recesso escuro ──
  const gasketMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0b0c, roughness: 0.78, sheen: 0.3, sheenColor: new THREE.Color(0x333333) });
  const BX = -0.9, BY = 4.4;
  const gk = add(extrudePlanar(rrect(14.4, 9.6, 3.0), 0.25, 0.25, [-7.2, -4.8, 7.2, 4.8]), gasketMat, B, false); gk.position.set(BX, BY, zWin - 0.2);
  const btnN = R.normal.clone(); btnN.repeat.set(0.4, 0.4); btnN.needsUpdate = true;
  const btnMat = new THREE.MeshPhysicalMaterial({ color: 0x1d86ea, roughness: 0.5, normalMap: btnN, normalScale: new THREE.Vector2(0.2, 0.2), sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xa8d4ff), clearcoat: 0.25, clearcoatRoughness: 0.4 });
  const btn = add(extrudePlanar(rrect(11.6, 7.0, 2.3), 0.9, 0.5, [0, 0, 1, 1]), btnMat, B, true); btn.position.set(BX, BY, zWin - 0.1); btn.userData.cal = 'power';
  const ico = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), new THREE.MeshStandardMaterial({ map: powerIconTex(), transparent: true, roughness: 0.55, depthWrite: false }));
  ico.position.z = 0.9 + 0.5 + 0.03; ico.userData.cal = 'power'; btn.add(ico); const btnRest = btn.position.z;

  // ── acoplador ½" no topo (bocal de borracha preta com anel) ──
  const cn = R.normal.clone(); cn.repeat.set(0.25, 0.25); cn.needsUpdate = true;
  const rubberBlk = new THREE.MeshPhysicalMaterial({ color: 0x131416, roughness: 0.62, normalMap: cn, normalScale: new THREE.Vector2(0.25, 0.25), sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x5a6068), clearcoat: 0.1 });
  const T = BODY.yTop + BODY.crown;
  const prof = [[0.0, T - 11], [6.0, T - 11], [6.35, T - 10.6], [6.35, T - 2.2], [6.0, T - 1.5], [6.35, T - 0.8], [6.5, T - 0.1], [7.5, T + 0.2],
    [9.6, T + 0.2], [10.25, T - 0.1], [10.45, T - 0.5], [10.45, T - 0.5], [10.15, T - 0.75], [10.15, T - 1.2], [10.6, T - 1.45], [12.0, T - 1.9], [12.4, T - 2.6], [12.4, T - 6]];
  const coup = add(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 64), rubberBlk); coup.material.side = THREE.DoubleSide;
  // fundo do acoplador: diafragma/grade do transdutor de referência
  const grid = canvas(128, 128), gg = grid.getContext('2d'); gg.fillStyle = '#3a3d40'; gg.fillRect(0, 0, 128, 128); gg.fillStyle = '#060606';
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) if (i * i + j * j <= 16) { gg.beginPath(); gg.arc(64 + i * 12, 64 + j * 12, 3.2, 0, Math.PI * 2); gg.fill(); }
  const disc = add(new THREE.CircleGeometry(6.0, 40), new THREE.MeshStandardMaterial({ map: tex(grid), metalness: 0.6, roughness: 0.5 }), B, false);
  disc.rotation.x = -Math.PI / 2; disc.position.y = T - 10.9;
  // anel metálico (latão niquelado) na base do bocal
  const ring = add(new THREE.TorusGeometry(10.45, 0.32, 10, 64), new THREE.MeshPhysicalMaterial({ color: 0x9aa1a8, metalness: 1, roughness: 0.3 }), B, false);
  ring.rotation.x = Math.PI / 2; ring.position.y = T - 1.0;
  const cavity = new THREE.Object3D(); cavity.name = 'cavity'; cavity.position.set(0, (T + 0.2) * MM, 0); group.add(cavity);

  const home = kitHome(stage); home.add(group);
  if (!stage.lookdev) import('./dosimeter.js').then((m) => { const k = m?.KIT_LOCAL?.calibrator; if (k && k.length === 3) { KIT_CAL = k.slice(); home.userData.place(); } }).catch(() => {});

  // ── firmware do visor ──
  let on = false, lv = 114, prevLv = 114, tLv = 9, bright = 0, tOn = 9, pulse = 0, lastKey = '';
  const CY = '#22ccff';
  function txtLevel(l, alpha, dy = 0) {
    og.save(); og.globalAlpha = alpha; og.fillStyle = '#5fe0ff'; og.shadowColor = CY; og.shadowBlur = 7; og.textBaseline = 'alphabetic'; og.textAlign = 'left';
    const F1 = `700 168px Arial, "Helvetica Neue", ${CFONT}`, F2 = `700 134px Arial, "Helvetica Neue", ${CFONT}`, SX = 0.86;
    og.font = F1; const a = String(l), wa = og.measureText(a).width; og.font = F2; const wd = og.measureText('d').width, wb = og.measureText('B').width;
    const tw = (wa + wd + wb * 0.82 + 4) * SX; og.translate(256 - tw / 2, 200 + dy); og.scale(SX, 1);
    og.font = F1; og.fillText(a, 0, 0); og.font = F2; og.fillText('d', wa + 4, 0);
    og.save(); og.translate(wa + 4 + wd, 0); og.scale(0.82, 0.8); og.fillText('B', 0, 0); og.restore();
    og.restore();
  }
  function draw() {
    const W = oc.width, H = oc.height;
    og.globalAlpha = 1; og.fillStyle = '#000'; og.fillRect(0, 0, W, H);
    if (!on) return;
    if (tOn < 0.14) { og.fillStyle = `rgba(63,210,255,${0.22 * (1 - tOn / 0.14)})`; og.fillRect(0, 0, W, H); return; } // teste de pixels
    if (tOn < 1.05) { // splash
      const a = Math.min(1, (tOn - 0.14) / 0.25) * Math.min(1, (1.05 - tOn) / 0.15);
      og.globalAlpha = a; og.textAlign = 'center'; og.textBaseline = 'middle'; og.shadowColor = CY; og.shadowBlur = 12;
      og.fillStyle = '#f2fbff'; og.font = `700 104px ${CFONT}`; og.fillText('CalPro', W / 2, H * 0.43);
      og.fillStyle = CY; og.font = `600 34px ${CFONT}`; og.fillText('IEC 60942 · Classe 1', W / 2, H * 0.8); og.shadowBlur = 0; og.globalAlpha = 1; return;
    }
    if (tOn < 2.0) { // estabilizando o tom
      const k = (tOn - 1.05) / 0.95; txtLevel(lv, Math.min(1, (tOn - 1.05) / 0.2) * (0.55 + 0.45 * Math.round((Math.sin(tOn * 26) * 0.5 + 0.5))), -14);
      og.strokeStyle = CY; og.lineWidth = 3; og.strokeRect(96, 236, 320, 18); og.fillStyle = CY; og.fillRect(100, 240, 312 * Math.min(1, k * 1.08), 10); return;
    }
    if (tLv < 0.32) { const k = tLv / 0.32; txtLevel(prevLv, 1 - k, -40 * k); txtLevel(lv, k, 40 * (1 - k)); return; }
    txtLevel(lv, 1);
  }
  draw(); oTex.needsUpdate = true;

  const api = {
    group, cavity, home,
    isOn: () => on, level: () => lv,
    setOn(b) { b = !!b; if (b === on) return; on = b; tOn = 0; pulse = 0.2; lastKey = ''; app?.emit?.('change'); },
    setLevel(l) { const n = +l === 94 ? 94 : 114; if (n === lv) return; prevLv = lv; lv = n; tLv = 0; lastKey = ''; app?.emit?.('change'); },
    update(dt = 0.016) {
      dt = Math.min(dt, 0.1); tOn += dt; tLv += dt;
      const anim = on && (tOn < 2.05 || tLv < 0.34), key = `${on}|${lv}`;
      if (anim || key !== lastKey) { draw(); oTex.needsUpdate = true; lastKey = anim ? '' : key; }
      bright += ((on ? 1 : 0) - bright) * Math.min(1, dt * (on ? 9 : 16));
      oledMat.emissiveIntensity = bright * 2.8;
      if (pulse > 0) pulse -= dt; btn.position.z = btnRest - (pulse > 0 ? 0.55 : 0);
    },
    highlight() {},
    /** pose de estúdio (lookdev): ignora a casa na maleta */
    _parts: { body, win, oled, btn, coup },
  };
  // clique no botão ⏻
  const cv = stage.canvas, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  if (cv) cv.addEventListener('pointerdown', (e) => {
    if (!stage.camera) return; const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, stage.camera);
    if (!ray.intersectObject(btn, true).length) return; e.stopImmediatePropagation();
    if (e.shiftKey) { api.setLevel(lv === 114 ? 94 : 114); pulse = 0.2; } else api.setOn(!on);
  }, { capture: true });
  return api;
}
