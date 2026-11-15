// Decibelímetro (medidor de nível de pressão sonora) portátil sobre tripé — dono: UI/DEMO (aula da Dose).
// Modelo genérico (sem marca): corpo branco-gelo afunilado, pescoço grafite, espuma preta esférica no microfone,
// visor LCD reflexivo com dígitos de 7 segmentos (CanvasTexture viva), tecla azul de liga/desliga e teclas F/S, A/C,
// MAX/MIN e LEVEL. Escala real (≈ 23 cm com a espuma). Origem do grupo = centro do tripé no piso.
export function buildSLM(THREE) {
  const g = new THREE.Group(); g.name = 'decibelimetro'; g.visible = false;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const metal = std({ color: 0x24272b, metalness: 0.75, roughness: 0.36 });
  const rubber = std({ color: 0x0d0e10, roughness: 0.85 });
  const shell = std({ color: 0xe8e5dd, roughness: 0.42, metalness: 0 });
  const neckM = std({ color: 0x34373c, roughness: 0.5 });

  // ── tripé ──
  const HUB = 0.98, HEAD = 1.36;
  const cyl = (r0, r1, a, b, mat) => { // cilindro entre os pontos a e b
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 14), mat);
    m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; g.add(m); return m;
  };
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3 + 0.3, fx = Math.cos(a) * 0.38, fz = Math.sin(a) * 0.38;
    cyl(0.009, 0.012, [fx, 0.02, fz], [Math.cos(a) * 0.03, HUB, Math.sin(a) * 0.03], metal);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), rubber); foot.position.set(fx, 0.014, fz); g.add(foot);
    cyl(0.005, 0.005, [fx * 0.45, HUB - 0.3, fz * 0.45], [0, HUB - 0.22, 0], metal);               // escora central
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.07, 18), rubber); hub.position.y = HUB; g.add(hub);
  cyl(0.013, 0.013, [0, HUB - 0.24, 0], [0, HEAD - 0.03, 0], metal);                               // coluna central
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12), rubber); knob.rotation.z = Math.PI / 2; knob.position.set(0.04, HUB, 0); g.add(knob);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), metal); ball.position.y = HEAD - 0.01; g.add(ball);

  // ── medidor (frame local: +y para o microfone, +z para a frente/visor; base em y = 0) ──
  const meter = new THREE.Group(); meter.position.y = HEAD + 0.004; meter.rotation.x = -0.62; g.add(meter); // microfone inclinado para a fonte
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 16), metal); plate.position.y = -0.002; meter.add(plate);
  const hw = (y) => { // meia-largura do corpo (vista frontal)
    const k = [[0, 0.024], [0.012, 0.0275], [0.06, 0.029], [0.11, 0.0285], [0.14, 0.026], [0.158, 0.021], [0.168, 0.0175]];
    for (let i = 1; i < k.length; i++) if (y <= k[i][0]) { const t = (y - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * (t * t * (3 - 2 * t)); }
    return 0.0175;
  };
  const sh = new THREE.Shape(); const N = 28;
  sh.moveTo(0, 0.0);
  for (let i = 0; i <= N; i++) { const y = 0.168 * i / N; const w = hw(y) - (i === 0 ? 0.006 : 0); sh.lineTo(w, y + (i === 0 ? 0.0012 : 0)); }
  for (let i = N; i >= 0; i--) { const y = 0.168 * i / N; const w = hw(y) - (i === 0 ? 0.006 : 0); sh.lineTo(-w, y + (i === 0 ? 0.0012 : 0)); }
  const D0 = 0.024, BV = 0.0045;
  const bodyG = new THREE.ExtrudeGeometry(sh, { depth: D0, bevelEnabled: true, bevelThickness: BV, bevelSize: 0.0035, bevelSegments: 5, curveSegments: 4 });
  bodyG.translate(0, 0, -D0 / 2); bodyG.computeVertexNormals();
  const body = new THREE.Mesh(bodyG, shell); body.castShadow = true; meter.add(body);
  const ZF = D0 / 2 + BV; // face frontal
  // pescoço grafite + espuma preta
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0235, 0.04, 28), neckM); neck.scale.z = 0.82; neck.position.y = 0.181; meter.add(neck);
  const capR = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0125, 0.012, 20), neckM); capR.position.y = 0.205; meter.add(capR);
  const fc = document.createElement('canvas'); fc.width = fc.height = 128; const fx = fc.getContext('2d');
  for (let i = 0; i < 2600; i++) { const v = 90 + Math.random() * 120; fx.fillStyle = `rgb(${v},${v},${v})`; fx.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  const bump = new THREE.CanvasTexture(fc); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(3, 2);
  const foam = new THREE.Mesh(new THREE.SphereGeometry(0.03, 40, 28), std({ color: 0x121314, roughness: 1, bumpMap: bump, bumpScale: 0.0025 }));
  foam.position.y = 0.232; foam.castShadow = true; meter.add(foam);
  const mic = new THREE.Object3D(); mic.position.y = 0.232; meter.add(mic);

  // ── frente: moldura do visor, LCD vivo e teclas (decalque) ──
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.05, 0.0016), std({ color: 0x8d9196, roughness: 0.35, metalness: 0.3 }));
  bezel.position.set(0, 0.112, ZF + 0.0006); meter.add(bezel);
  const LW = 320, LH = 300; const lc = document.createElement('canvas'); lc.width = LW; lc.height = LH; const lx = lc.getContext('2d');
  const lcdTex = new THREE.CanvasTexture(lc); lcdTex.colorSpace = THREE.SRGBColorSpace; lcdTex.anisotropy = 8;
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.0356), std({ map: lcdTex, emissiveMap: lcdTex, emissive: 0xffffff, emissiveIntensity: 0.32, roughness: 0.18, metalness: 0 }));
  lcd.position.set(0, 0.113, ZF + 0.0016); lcd.userData.noBloom = true; meter.add(lcd);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.038), std({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0.2 }));
  glass.position.set(0, 0.113, ZF + 0.0019); meter.add(glass);

  const kc = document.createElement('canvas'); kc.width = 300; kc.height = 420; const kx = kc.getContext('2d');
  (function drawKeys() {
    kx.clearRect(0, 0, 300, 420);
    kx.fillStyle = '#5b6068'; kx.font = '600 22px "Roboto Condensed", Arial, sans-serif'; kx.textAlign = 'center';
    kx.fillText('DECIBELÍMETRO', 150, 30); kx.font = '500 15px "Roboto Condensed", Arial, sans-serif'; kx.fillText('Medidor de nível de pressão sonora', 150, 52);
    // tecla azul
    const gr = kx.createRadialGradient(140, 112, 6, 150, 122, 46); gr.addColorStop(0, '#5b8df0'); gr.addColorStop(1, '#1d4fb8');
    kx.fillStyle = '#1a2a48'; kx.beginPath(); kx.arc(150, 124, 46, 0, 7); kx.fill();
    kx.fillStyle = gr; kx.beginPath(); kx.arc(150, 122, 42, 0, 7); kx.fill();
    kx.strokeStyle = '#fff'; kx.lineWidth = 5; kx.lineCap = 'round'; kx.beginPath(); kx.arc(150, 124, 17, -Math.PI * 0.33, Math.PI * 1.33); kx.stroke();
    kx.beginPath(); kx.moveTo(150, 99); kx.lineTo(150, 122); kx.stroke();
    const key = (x, y, w, t) => { kx.fillStyle = '#0d0e10'; kx.beginPath(); kx.roundRect(x - w / 2, y, w, 52, 20); kx.fill();
      const hg = kx.createLinearGradient(0, y, 0, y + 52); hg.addColorStop(0, 'rgba(255,255,255,.22)'); hg.addColorStop(0.5, 'rgba(255,255,255,0)'); kx.fillStyle = hg; kx.fill();
      kx.fillStyle = '#f2f2f2'; kx.font = '700 22px "Roboto Condensed", Arial, sans-serif'; kx.fillText(t, x, y + 34); };
    key(92, 190, 104, 'F/S'); key(208, 190, 104, 'A/C'); key(150, 262, 150, 'MAX/MIN'); key(150, 334, 120, 'LEVEL');
  })();
  const keysTex = new THREE.CanvasTexture(kc); keysTex.colorSpace = THREE.SRGBColorSpace; keysTex.anisotropy = 8;
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.043, 0.06), std({ map: keysTex, transparent: true, roughness: 0.4 }));
  keys.position.set(0, 0.052, ZF + 0.0003); meter.add(keys);
  const pbtn = new THREE.Mesh(new THREE.CylinderGeometry(0.0057, 0.006, 0.0022, 24), std({ color: 0x2a62d6, roughness: 0.3 }));
  pbtn.rotation.x = Math.PI / 2; pbtn.position.set(0, 0.052 + 0.03 - 0.0174, ZF + 0.0011); meter.add(pbtn);

  // ── LCD: 7 segmentos ──
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
  function digit(x, y, w, h, ch, on, off) {
    const t = w * 0.24, hh = h / 2, p = (pts) => { lx.beginPath(); pts.forEach(([a, b], i) => (i ? lx.lineTo(x + a, y + b) : lx.moveTo(x + a, y + b))); lx.closePath(); lx.fill(); };
    const H = (yy) => [[t * 0.6, yy], [t, yy - t / 2], [w - t, yy - t / 2], [w - t * 0.6, yy], [w - t, yy + t / 2], [t, yy + t / 2]];
    const Vv = (xx, y0, y1) => [[xx, y0 + t * 0.6], [xx + t / 2, y0 + t], [xx + t / 2, y1 - t], [xx, y1 - t * 0.6], [xx - t / 2, y1 - t], [xx - t / 2, y0 + t]];
    const S = { a: H(t / 2), g: H(hh), d: H(h - t / 2), f: Vv(t / 2, 0, hh), b: Vv(w - t / 2, 0, hh), e: Vv(t / 2, hh, h), c: Vv(w - t / 2, hh, h) };
    const lit = SEG[ch] || '';
    for (const k of 'abcdefg') { lx.fillStyle = lit.includes(k) ? on : off; p(S[k]); }
  }
  let reading = 0, target = 0, shown = '', redrawT = 0;
  function drawLCD(val) {
    const bg = lx.createLinearGradient(0, 0, 0, LH); bg.addColorStop(0, '#bcc6b2'); bg.addColorStop(1, '#a7b39f');
    lx.fillStyle = bg; lx.fillRect(0, 0, LW, LH);
    const on = '#15181a', off = 'rgba(40,50,40,0.07)';
    lx.fillStyle = on; lx.font = '700 26px "Roboto Condensed", Arial, sans-serif'; lx.textAlign = 'left';
    lx.fillText('SLOW', 18, 40); lx.fillStyle = off; lx.fillText('FAST', 88, 40); lx.fillText('MAX', 160, 40);
    lx.fillStyle = on; lx.fillText('A', 262, 40); lx.fillStyle = off; lx.fillText('C', 286, 40);
    lx.save(); lx.transform(1, 0, -0.1, 1, 14, 0);
    const ds = val.toFixed(1).replace('.', ''); // "90.0" → "900" (3 ou 4 dígitos, ponto antes do último)
    const n = ds.length, W = n > 3 ? 46 : 58, Hh = 126, Y0 = 70, GAP = 10, DP = 16;
    const X0 = 246 - (n * W + (n - 1) * GAP + DP);
    for (let i = 0; i < n; i++) digit(X0 + i * (W + GAP) + (i === n - 1 ? DP : 0), Y0, W, Hh, ds[i], on, off);
    lx.fillStyle = on; lx.beginPath(); lx.arc(X0 + (n - 1) * (W + GAP) + 4, Y0 + Hh - 5, 8, 0, 7); lx.fill();
    lx.restore();
    lx.fillStyle = on; lx.font = '700 30px "Roboto Condensed", Arial, sans-serif'; lx.fillText('dB', 258, 160); lx.font = '700 22px "Roboto Condensed", Arial, sans-serif'; lx.fillText('A', 270, 188);
    // barra analógica 30–130 dB
    const bx = 22, by = 236, bw = 276; lx.fillStyle = off; lx.fillRect(bx, by, bw, 16);
    lx.fillStyle = on; const nb = Math.round(Math.max(0, Math.min(1, (val - 30) / 100)) * 46);
    for (let i = 0; i < nb; i++) lx.fillRect(bx + i * 6, by, 4, 16);
    lx.font = '600 16px "Roboto Condensed", Arial, sans-serif'; lx.textAlign = 'center';
    [30, 50, 70, 90, 110, 130].forEach((v, i) => lx.fillText(String(v), bx + i * (bw / 5), by + 38));
    lcdTex.needsUpdate = true;
  }
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
      reading += (target + 0.07 * Math.sin(t * 2.3) * Math.sin(t * 0.9 + 1) - reading) * (1 - Math.exp(-dt / 0.9)); // resposta lenta (S ≈ 1 s)
      redrawT -= dt; const s = reading.toFixed(1);
      if (redrawT <= 0 && s !== shown) { shown = s; redrawT = 0.25; drawLCD(reading); }
    },
  };
}
