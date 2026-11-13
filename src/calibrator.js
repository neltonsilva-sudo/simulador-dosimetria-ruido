// CALIBRADOR ACÚSTICO CalPro (azul, formato "sabonete", janela preta com OLED "114dB"/"94dB", botão ⏻, acoplador ½" no topo
// com anel de borracha). Dono: DOSÍMETRO 3D. O tom de 1 kHz é do ÁUDIO. Clique no botão ⏻ liga/desliga; Shift+clique alterna 94/114 dB.
import * as THREE from 'three';
import { extrudeSmooth, roundRectArc, mirroredShape, samplePath, iconShapes } from './dosi_geo.js';
import { canvasTex, FONT } from './dosi_tex.js';
import { rubberMat, kitHome, KIT_LOCAL, envGuard } from './dosimeter.js';

export function buildCalibrator(stage, app) {
  const group = new THREE.Group(); group.name = 'CalPro';
  const B = new THREE.Group(); B.scale.setScalar(0.001); group.add(B);
  const add = (geo, mat, p = B, sh = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = sh; m.receiveShadow = true; p.add(m); return m; };

  // corpo 62 × 95 × 36 mm
  const half = samplePath([[[0, -47.5], [16, -47.5]], [[16, -47.5], [25, -47.5], [28.5, -42], [28.8, -33]], [[28.8, -33], [30, 0], [31, 25], [31, 34]],
    [[31, 34], [31, 46], [29, 47.5], [19, 47.5]], [[19, 47.5], [0, 47.5]]], 14);
  const bodyMat = rubberMat(0x1e86e0, 0.5, 1 / 10); bodyMat.clearcoat = 0.25; bodyMat.clearcoatRoughness = 0.35;
  add(extrudeSmooth(mirroredShape(half), 36, { bt: 7, bs: 7, seg: 8 }), bodyMat);
  const FRONT = 18;

  // janela preta (topo reto, fundo em U) com serigrafia
  const win = new THREE.Shape(); win.moveTo(-15, 17); win.lineTo(-15, 35); win.absarc(-10, 35, 5, Math.PI, Math.PI / 2, true);
  win.lineTo(10, 40); win.absarc(10, 35, 5, Math.PI / 2, 0, true); win.lineTo(15, 17); win.absarc(0, 17, 15, 0, -Math.PI, true);
  const winTex = canvasTex(300, 380, (g, w, h) => { // 10 px/mm, x −15..15, y 2..40
    g.fillStyle = '#141619'; g.fillRect(0, 0, w, h);
    const Y = (y) => (40 - y) * 10, X = (x) => (x + 15) * 10;
    g.font = `700 50px ${FONT}`; g.textBaseline = 'middle'; const w1 = g.measureText('Cal').width, w2 = g.measureText('Pro').width, x0 = w / 2 - (w1 + w2) / 2;
    g.fillStyle = '#f2f4f6'; g.fillText('Cal', x0, Y(14.6)); g.fillStyle = '#2f9bff'; g.fillText('Pro', x0 + w1, Y(14.6));
    g.save(); g.translate(X(-12.6), Y(27)); g.rotate(-Math.PI / 2); g.font = `600 13px ${FONT}`; g.fillStyle = '#c9ced4'; g.textAlign = 'center'; g.fillText('Sound Calibrator', 0, 0); g.restore();
  });
  const winMat = new THREE.MeshPhysicalMaterial({ map: winTex, roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  const wm = add(extrudeSmooth(win, 1.4, { bt: 0.5, bs: 0.6, seg: 3, uv: 'planar' }), winMat); wm.position.z = FRONT - 0.2;

  // OLED
  const oc = document.createElement('canvas'); oc.width = 460; oc.height = 350; const og = oc.getContext('2d');
  const oTex = new THREE.CanvasTexture(oc); oTex.colorSpace = THREE.SRGBColorSpace; oTex.anisotropy = 8;
  const oledMat = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.4, emissive: 0xffffff, emissiveMap: oTex, emissiveIntensity: 0,
    clearcoat: 1, clearcoatRoughness: 0.03, toneMapped: false });
  const oled = add(extrudeSmooth(roundRectArc(23, 17.5, 1.2), 0.6, { bt: 0.2, bs: 0.25, seg: 2, uv: 'planar' }), oledMat, B, false);
  oled.position.set(1.1, 27, FRONT + 0.75);

  // botão ⏻
  const btnMat = rubberMat(0x1b80e2, 0.45, 1 / 4);
  const btn = add(extrudeSmooth(roundRectArc(10.5, 7.5, 1.8), 2.2, { bt: 0.8, bs: 0.8, seg: 3 }), btnMat); btn.position.set(0.3, 6.8, FRONT + 1.2); btn.userData.cal = 'power';
  const ico = new THREE.Mesh(new THREE.ExtrudeGeometry(iconShapes('power', 0.85), { depth: 0.25, bevelEnabled: false, curveSegments: 14 }), new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.5 }));
  ico.position.z = 1.08; ico.userData.cal = 'power'; btn.add(ico); const btnRest = btn.position.z;

  // acoplador ½" com anel de borracha no topo
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0x111213, roughness: 0.75, sheen: 0.3, sheenColor: new THREE.Color(0x444444) });
  const gp = [[6.5, 48.2], [6.5, 51.6], [7.2, 52.6], [9.5, 52.6], [10.8, 51.6], [11.2, 49], [11.2, 46]].map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(gp, 48), rubber);
  const holeIn = add(new THREE.CylinderGeometry(6.5, 6.5, 0.4, 32), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 })); holeIn.position.y = 48.4;
  const cavity = new THREE.Object3D(); cavity.name = 'cavity'; cavity.position.set(0, 0.0526, 0); group.add(cavity);

  const home = kitHome(stage, KIT_LOCAL.calibrator, 'calibratorHome'); home.add(group);

  let on = false, lv = 114, bright = 0, tOn = 0, pulse = 0, lastDrawn = '';
  function draw(splash) {
    const key = (splash ? 'S' : 'L') + lv; if (key === lastDrawn) return; lastDrawn = key;
    og.fillStyle = '#000'; og.fillRect(0, 0, oc.width, oc.height); og.textAlign = 'center'; og.textBaseline = 'middle';
    og.fillStyle = '#3cc4ff'; og.shadowColor = '#3cc4ff'; og.shadowBlur = 6;
    if (splash) { og.font = `700 70px ${FONT}`; og.fillText('CalPro', 230, 175); }
    else { og.font = `700 112px "Menlo", "Consolas", monospace`; og.fillText(`${lv}dB`, 230, 190); og.font = `600 30px ${FONT}`; og.fillText('1 kHz', 120, 62); }
    og.shadowBlur = 0; og.strokeStyle = '#3cc4ff'; og.lineWidth = 4; og.strokeRect(372, 40, 52, 24); og.fillRect(426, 46, 5, 12); og.fillRect(377, 45, 38, 14);
    oTex.needsUpdate = true;
  }
  draw(false);
  const api = {
    group, cavity, home,
    isOn: () => on, level: () => lv,
    setOn(b) { b = !!b; if (b === on) return; on = b; tOn = 0; pulse = 0.2; lastDrawn = ''; app?.emit?.('change'); },
    setLevel(l) { lv = +l === 94 ? 94 : 114; lastDrawn = ''; app?.emit?.('change'); },
    update(dt = 0.016) {
      envTick(); tOn += dt;
      draw(on && tOn < 0.8);
      bright += ((on ? 1 : 0) - bright) * Math.min(1, dt * (on ? 6 : 14)); oledMat.emissiveIntensity = bright * 1.15;
      if (pulse > 0) pulse -= dt; btn.position.z = btnRest - (pulse > 0 ? 0.8 : 0);
    },
    highlight() {},
  };
  // clique no botão ⏻
  const cv = stage.canvas, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  if (cv) cv.addEventListener('pointerdown', (e) => {
    if (!stage.camera) return; const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, stage.camera);
    if (!ray.intersectObject(btn, true).length) return; e.stopImmediatePropagation();
    if (e.shiftKey) { api.setLevel(lv === 114 ? 94 : 114); pulse = 0.2; } else api.setOn(!on);
  }, { capture: true });
  const envTick = envGuard(stage, [bodyMat, winMat, oledMat, btnMat, rubber]);
  return api;
}
