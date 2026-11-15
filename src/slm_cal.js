// Calibrador acústico cilíndrico do decibelímetro (aula da Dose) — a partir da foto do usuário, SEM marca/modelo.
// Corpo de ABS cinza-claro com seção "quadrado arredondado" (superelipse), pegas laterais de borracha cinza-escuro em
// forma de lente (estreitam a frente cinza no meio), faixas pretas no topo e na base, painel frontal preto brilhante com
// três teclas de membrana (114 dB, 94 dB, liga ⏻), serigrafia "Calibrador Acústico · F 1000 Hz · IEC 942 Classe 1" e,
// embaixo, LCD de retroiluminação azul num rebaixo cinza. Topo: bossa de borracha preta com a cavidade ½" (acoplador).
// Escala real ~54 × 50 × 133 mm. Origem no centro da base; boca do acoplador em +y (`cavity`).
// API: buildSlmCal(THREE) → { group, cavity, isOn(), level(), setOn(b), setLevel(94|114), press(key), update(dt) }
const MM = 0.001;
const A = 24, B = 23, N = 2.5;           // semi-eixos (mm) e expoente da superelipse
const H = 128, R_END = 3.4;              // altura do corpo e raio das arestas do topo/base
const BOSS_R = 14.6, BOSS_H = 5, HOLE_R = 6.85, HOLE_D = 22;
const FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';
const GREY = '#d9d7d2', GRIP = '#45484d', BLACK = '#19191b'; // pegas laterais em borracha cinza-escuro

const se = (t) => { const c = Math.cos(t), s = Math.sin(t), e = 2 / N; return [A * Math.sign(c) * Math.abs(c) ** e, B * Math.sign(s) * Math.abs(s) ** e]; };
const endInset = (y) => { const d = Math.min(y, H - y); if (d >= R_END) return 0; const k = R_END - d; return R_END - Math.sqrt(Math.max(0, R_END * R_END - k * k)); };

export function buildSlmCal(THREE) {
  const group = new THREE.Group(); group.name = 'calibradorSLM';
  const Bm = new THREE.Group(); Bm.scale.setScalar(MM); group.add(Bm);

  // ── contorno: amostras por ângulo, parâmetro de arco (u) começando nas costas (z = −B) ──
  const NU = 192, prof = [];
  for (let i = 0; i <= NU; i++) { const t = -Math.PI / 2 - (i / NU) * Math.PI * 2; prof.push(se(t)); } // costas → x=−A → frente: u cresce para +x na frente
  const arc = [0]; for (let i = 1; i <= NU; i++) arc.push(arc[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
  const S = arc[NU];                                   // perímetro (mm); frente (z = +B) em s = S/2
  const sSide = (sign) => { // arco do centro da lateral (x = ±A)
    let best = 0, bd = 1e9; for (let i = 0; i <= NU; i++) { const d = Math.abs(prof[i][0] - sign * A) + Math.abs(prof[i][1]); if (d < bd) { bd = d; best = i; } } return arc[best];
  };
  const sL = sSide(-1), sR = sSide(1);
  // pega lateral: meia-largura (arco) em função da altura — lente com máximo no meio
  const GY0 = 13.5, GY1 = 111.5, GMAX = 17.5;
  const gripHalf = (y) => { const k = (y - (GY0 + GY1) / 2) / ((GY1 - GY0) / 2); return Math.abs(k) >= 1 ? 0 : GMAX * Math.pow(1 - k * k, 0.5); };
  const gripAmt = (s, y) => { const hw = gripHalf(y); if (hw <= 0) return 0; const d = Math.min(Math.abs(s - sL), Math.abs(s - sR)); return Math.max(0, Math.min(1, (hw - d) / 1.2 + 0.5)); };

  // ── malha do costado (grade u × y) com relevo das pegas (+0,7 mm) e arestas arredondadas ──
  const ys = []; for (let y = 0; y <= R_END; y += 0.32) ys.push(y); for (let y = R_END + 1; y < H - R_END; y += 1) ys.push(y); for (let y = H - R_END; y <= H + 1e-6; y += 0.32) ys.push(y);
  if (ys[ys.length - 1] < H) ys.push(H);
  const NV = ys.length, pos = new Float32Array((NU + 1) * NV * 3), uv = new Float32Array((NU + 1) * NV * 2), idx = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i <= NU; i++) {
    const y = ys[j], [x, z] = prof[i], r = Math.hypot(x, z) || 1, s = arc[i];
    const out = 0.7 * gripAmt(s, y) - endInset(y), k = (r + out) / r, o = (j * (NU + 1) + i);
    pos[o * 3] = x * k; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z * k; uv[o * 2] = s / S; uv[o * 2 + 1] = y / H;
  }
  for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.BufferAttribute(pos, 3)); shell.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); shell.setIndex(idx);
  shell.computeVertexNormals();
  { const n = shell.attributes.normal; for (let j = 0; j < NV; j++) { const a = j * (NU + 1), b = a + NU; const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize(); n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z); } }

  // ── texturas do costado: cor (serigrafia, painel, faixas) e rugosidade ──
  const W = 2048, HP = 2048, ku = W / S, kv = HP / H;
  const X = (s) => s * ku, Y = (y) => (H - y) * kv, FX = (dx) => X(S / 2 + dx); // dx = mm a partir do centro da frente
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = HP; return [c, c.getContext('2d')]; };
  const [cc, g] = mk(), [rc, rg] = mk();
  // base cinza com leve granulado
  g.fillStyle = GREY; g.fillRect(0, 0, W, HP); rg.fillStyle = 'rgb(0,140,0)'; rg.fillRect(0, 0, W, HP);
  { const im = g.getImageData(0, 0, W, HP), d = im.data; let sd = 11; for (let p = 0; p < d.length; p += 4) { sd = (sd * 16807) % 2147483647; const v = ((sd / 2147483647) - 0.5) * 7; d[p] += v; d[p + 1] += v; d[p + 2] += v; } g.putImageData(im, 0, 0); }
  // pegas laterais (lente) — borda suave
  for (let py = 0; py < HP; py++) {
    const y = H - (py + 0.5) / kv, hw = gripHalf(y); if (hw <= 0) continue;
    for (const sc of [sL, sR]) {
      const gr = g.createLinearGradient(X(sc - hw - 0.6), 0, X(sc + hw + 0.6), 0);
      const e = 0.6 / (2 * hw + 1.2); gr.addColorStop(0, 'rgba(69,72,77,0)'); gr.addColorStop(e, GRIP); gr.addColorStop(1 - e, GRIP); gr.addColorStop(1, 'rgba(69,72,77,0)');
      g.fillStyle = gr; g.fillRect(X(sc - hw - 0.6), py, X(2 * hw + 1.2), 1);
      rg.fillStyle = 'rgb(0,185,0)'; rg.fillRect(X(sc - hw), py, X(2 * hw), 1);
    }
  }
  // sombreado de volume nas pegas (borda escurecida), costura fina entre cinza e vermelho
  g.globalCompositeOperation = 'multiply';
  for (let py = 0; py < HP; py += 1) {
    const y = H - (py + 0.5) / kv, hw = gripHalf(y); if (hw <= 0) continue;
    for (const sc of [sL, sR]) for (const sgn of [-1, 1]) { const x0 = X(sc + sgn * hw); g.fillStyle = 'rgba(60,60,62,0.6)'; g.fillRect(x0 - (sgn > 0 ? 3 : 0), py, 3, 1); }
  }
  g.globalCompositeOperation = 'source-over';
  // faixas pretas (base 0–9 mm, topo 117–128 mm) com sulco de junção
  const band = (y0, y1) => { g.fillStyle = BLACK; g.fillRect(0, Y(y1), W, Y(y0) - Y(y1)); rg.fillStyle = 'rgb(0,175,0)'; rg.fillRect(0, Y(y1), W, Y(y0) - Y(y1)); };
  band(0, 8); band(118, H);
  for (const [yy, a] of [[8, 0.55], [118, 0.55]]) { g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, Y(yy) - 2, W, 4); }
  // painel frontal preto brilhante (rebaixo raso, borda arredondada)
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const PW = 22.5, PY0 = 36.5, PY1 = 92.5;
  rr(g, FX(-PW / 2) - 3, Y(PY1) - 3, X(PW) + 6, Y(PY0) - Y(PY1) + 6, 4.6 * kv); g.fillStyle = 'rgba(70,70,70,0.35)'; g.fill();
  rr(g, FX(-PW / 2), Y(PY1), X(PW), Y(PY0) - Y(PY1), 4 * kv); g.fillStyle = '#121214'; g.fill();
  { const gr = g.createLinearGradient(0, Y(PY1), 0, Y(PY0)); gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(0.4, 'rgba(255,255,255,0)'); g.fillStyle = gr; rr(g, FX(-PW / 2), Y(PY1), X(PW), Y(PY0) - Y(PY1), 4 * kv); g.fill(); }
  rr(rg, FX(-PW / 2), Y(PY1), X(PW), Y(PY0) - Y(PY1), 4 * kv); rg.fillStyle = 'rgb(0,48,0)'; rg.fill();
  // moldura branca fina das teclas (serigrafia) e textos
  const KEYS = [{ id: '114', y: 83 }, { id: '94', y: 71.4 }, { id: 'power', y: 59.6 }], KW = 13.4, KH = 9.8;
  for (const k of KEYS) { rr(g, FX(-KW / 2 - 0.9), Y(k.y + KH / 2 + 0.9), X(KW + 1.8), (KH + 1.8) * kv, 1.6 * kv); g.strokeStyle = 'rgba(235,235,235,0.55)'; g.lineWidth = 0.25 * kv; g.stroke(); }
  const txt = (s, dx, y, size, weight = 500, color = '#c9c9c9', align = 'center') => {
    g.save(); g.translate(FX(dx), Y(y)); g.scale(ku / kv, 1); g.font = `${weight} ${size * kv}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, 0, 0); g.restore();
  };
  txt('Calibrador Acústico', -KW / 2, 50.9, 1.55, 500, '#bdbdbd', 'left');
  txt('F 1000 Hz', -KW / 2, 48.7, 1.55, 500, '#bdbdbd', 'left');
  txt('IEC 942 CLASSE 1', -KW / 2, 46.5, 1.55, 500, '#bdbdbd', 'left');
  txt('94 / 114 dB', 0, 40.2, 3.0, 700, '#e8e8e8');
  // rebaixo do LCD (cinza mais escuro com sombra interna)
  const LW = 21.5, LY0 = 17.5, LY1 = 33.5;
  rr(g, FX(-LW / 2), Y(LY1), X(LW), Y(LY0) - Y(LY1), 3 * kv); g.fillStyle = '#b9b7b2'; g.fill();
  { g.save(); rr(g, FX(-LW / 2), Y(LY1), X(LW), Y(LY0) - Y(LY1), 3 * kv); g.clip(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 1.4 * kv; g.shadowOffsetY = 0.7 * kv;
    g.lineWidth = 2 * kv; g.strokeStyle = 'rgba(0,0,0,0.6)'; rr(g, FX(-LW / 2) - kv, Y(LY1) - kv, X(LW) + 2 * kv, Y(LY0) - Y(LY1) + 2 * kv, 3.5 * kv); g.stroke(); g.restore(); }
  rr(g, FX(-9.2), Y(30.6), X(18.4), Y(20.4) - Y(30.6), 0.8 * kv); g.fillStyle = '#2a2d33'; g.fill(); // moldura escura do vidro
  // etiqueta de série pequena na lateral esquerda, perto da base (como na foto)
  g.save(); g.translate(X(sL + 0), Y(12.5)); g.scale(ku / kv, 1); g.fillStyle = '#f1f0ec'; g.fillRect(-2.6 * kv, -5 * kv, 5.2 * kv, 6 * kv); g.fillStyle = '#7a7a7a'; g.fillRect(-2.0 * kv, -4.2 * kv, 3.4 * kv, 0.35 * kv); g.fillRect(-2.0 * kv, -3.2 * kv, 2.6 * kv, 0.35 * kv); g.fillRect(-2.0 * kv, -2.2 * kv, 3.8 * kv, 0.35 * kv); g.restore();
  const cTex = new THREE.CanvasTexture(cc); cTex.colorSpace = THREE.SRGBColorSpace; cTex.anisotropy = 8;
  const rTex = new THREE.CanvasTexture(rc); rTex.anisotropy = 8;
  const shellMat = new THREE.MeshPhysicalMaterial({ map: cTex, roughnessMap: rTex, roughness: 1, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.5 });
  const add = (geo, mat, p = Bm) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
  add(shell, shellMat);

  // ── tampas (base e topo) e bossa do acoplador ──
  const capShape = (inset) => { const sh = new THREE.Shape(); for (let i = 0; i < NU; i++) { const t = (i / NU) * Math.PI * 2, [x, z] = se(t), r = Math.hypot(x, z), k = (r - inset) / r; i ? sh.lineTo(x * k, -z * k) : sh.moveTo(x * k, -z * k); } sh.closePath(); return sh; };
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0x18181a, roughness: 0.78, metalness: 0, sheen: 0.3, sheenRoughness: 0.7, sheenColor: new THREE.Color(0x555555) });
  const top = capShape(R_END); const hole = new THREE.Path(); hole.absarc(0, 0, BOSS_R - 0.2, 0, Math.PI * 2, true); top.holes.push(hole);
  const topM = add(new THREE.ShapeGeometry(top, 4), rubber); topM.rotation.x = -Math.PI / 2; topM.position.y = H;
  const botM = add(new THREE.ShapeGeometry(capShape(R_END), 4), rubber); botM.rotation.x = Math.PI / 2; botM.position.y = 0;
  // bossa: degrau externo chanfrado + furo ½" com anel interno
  const bp = [[BOSS_R + 0.4, H - 0.05], [BOSS_R, H + 0.3], [BOSS_R, H + BOSS_H - 0.8], [BOSS_R - 0.8, H + BOSS_H], [HOLE_R + 0.9, H + BOSS_H], [HOLE_R, H + BOSS_H - 0.9],
    [HOLE_R, H + BOSS_H - 3.2], [HOLE_R - 0.35, H + BOSS_H - 3.6], [HOLE_R - 0.35, H + BOSS_H - 4.6], [HOLE_R, H + BOSS_H - 5.0], [HOLE_R, H + BOSS_H - HOLE_D], [0.01, H + BOSS_H - HOLE_D]];
  add(new THREE.LatheGeometry(bp.map(([r, y]) => new THREE.Vector2(r, y)), 64), rubber).material.side = THREE.DoubleSide;
  const cavity = new THREE.Object3D(); cavity.name = 'cavity'; cavity.position.set(0, (H + BOSS_H + 0.2) * MM, 0); group.add(cavity);

  // ── teclas de membrana (branco-gelo, legenda impressa) ──
  const keyTex = (id) => {
    const c = document.createElement('canvas'); c.width = 248; c.height = 192; const k = c.getContext('2d');
    k.fillStyle = '#f3f2ee'; k.fillRect(0, 0, 248, 192);
    const gr = k.createRadialGradient(124, 70, 10, 124, 96, 170); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)'); k.fillStyle = gr; k.fillRect(0, 0, 248, 192);
    if (id === 'power') {
      k.save(); k.translate(124, 98); k.beginPath(); k.arc(0, 0, 58, 0, Math.PI * 2); k.fillStyle = '#ffffff'; k.fill();
      k.beginPath(); k.arc(0, 0, 58, Math.PI, 0); k.lineTo(58, 2); k.lineTo(-58, 2); k.closePath(); k.fillStyle = '#d6301f'; k.fill();
      k.beginPath(); k.arc(0, 0, 58, 0, Math.PI * 2); k.lineWidth = 6; k.strokeStyle = '#1a1a1a'; k.stroke(); k.restore();
    } else { k.fillStyle = '#121212'; k.font = `700 70px Arial, ${FONT}`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(id + 'dB', 124, 100); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  const keyGeo = (() => { const sh = new THREE.Shape(); const w = KW, h = KH, r = 1.3; sh.roundRect?.(-w / 2, -h / 2, w, h, r);
    if (!sh.curves.length) { sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); }
    const g2 = new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.45, bevelSegments: 4, curveSegments: 8 });
    // UV planar na face frontal (0..1)
    const p = g2.attributes.position, u = g2.attributes.uv; for (let i = 0; i < p.count; i++) u.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h); return g2; })();
  const keys = {};
  for (const k of KEYS) {
    const m = add(keyGeo, new THREE.MeshPhysicalMaterial({ map: keyTex(k.id), roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.35 }));
    m.position.set(0, k.y, B - 0.35); keys[k.id] = { m, rest: m.position.z, t: 0 };
  }

  // ── LCD de retroiluminação azul (7 segmentos) sob vidro ──
  const lc = document.createElement('canvas'); lc.width = 384; lc.height = 196; const lg = lc.getContext('2d');
  const lTex = new THREE.CanvasTexture(lc); lTex.colorSpace = THREE.SRGBColorSpace; lTex.anisotropy = 8;
  const SEG = { a: [[0.12, 0], [0.88, 0], [0.76, 0.1], [0.24, 0.1]], b: [[0.9, 0.03], [0.9, 0.48], [0.8, 0.43], [0.8, 0.13]], c: [[0.9, 0.52], [0.9, 0.97], [0.8, 0.87], [0.8, 0.57]],
    d: [[0.12, 1], [0.88, 1], [0.76, 0.9], [0.24, 0.9]], e: [[0.1, 0.52], [0.1, 0.97], [0.2, 0.87], [0.2, 0.57]], f: [[0.1, 0.03], [0.1, 0.48], [0.2, 0.43], [0.2, 0.13]],
    g: [[0.14, 0.5], [0.24, 0.45], [0.76, 0.45], [0.86, 0.5], [0.76, 0.55], [0.24, 0.55]] };
  const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  let on = false, lv = 114, bright = 0, drawnKey = '';
  function drawLCD() {
    const w = lc.width, h = lc.height;
    const bg = lg.createLinearGradient(0, 0, w, h);
    if (bright > 0.02) { bg.addColorStop(0, `rgb(${70 + 40 * bright},${120 + 50 * bright},${190 + 55 * bright})`); bg.addColorStop(1, `rgb(${52 + 30 * bright},${96 + 40 * bright},${170 + 60 * bright})`); }
    else { bg.addColorStop(0, '#59636c'); bg.addColorStop(1, '#4b545c'); }
    lg.fillStyle = bg; lg.fillRect(0, 0, w, h);
    const v = lg.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.62); v.addColorStop(0, 'rgba(255,255,255,0.06)'); v.addColorStop(1, 'rgba(0,0,20,0.28)'); lg.fillStyle = v; lg.fillRect(0, 0, w, h);
    const str = String(lv), DW = 74, DH = 132, GAP = 20, x1 = w - 40;
    for (let i = 0; i < 3; i++) {
      const ch = str[str.length - 3 + i], x = x1 - (3 - i) * (DW + GAP) + GAP, y = (h - DH) / 2, lit = on && ch !== undefined ? DIG[ch] || '' : '';
      for (const [k, pts] of Object.entries(SEG)) {
        const isOn = lit.includes(k); lg.beginPath();
        pts.forEach(([px, py], n) => { const X2 = x + px * DW - (py - 0.5) * 10, Y2 = y + py * DH; n ? lg.lineTo(X2, Y2) : lg.moveTo(X2, Y2); }); lg.closePath();
        if (isOn) { lg.fillStyle = 'rgba(8,16,48,0.9)'; lg.shadowColor = 'rgba(0,0,30,0.35)'; lg.shadowOffsetX = 3; lg.shadowOffsetY = 4; lg.shadowBlur = 2; lg.fill(); lg.shadowColor = 'transparent'; }
        else { lg.fillStyle = 'rgba(10,20,50,0.05)'; lg.fill(); }
      }
    }
    lTex.needsUpdate = true;
  }
  const lcdMat = new THREE.MeshStandardMaterial({ map: lTex, emissiveMap: lTex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 });
  const lcd = add(new THREE.PlaneGeometry(17.4, 9.0), lcdMat); lcd.position.set(0, 25.5, B + 0.16); lcd.castShadow = false;
  const glass = add(new THREE.PlaneGeometry(18.4, 10.2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1, depthWrite: false }));
  glass.position.set(0, 25.5, B + 0.44); glass.castShadow = false;
  drawLCD();

  const api = {
    group, cavity,
    isOn: () => on, level: () => lv,
    setOn(b) { on = !!b; },
    setLevel(l) { lv = +l === 94 ? 94 : 114; },
    press(id) { const k = keys[id]; if (k) k.t = 0.28; },
    update(dt = 0.016) {
      dt = Math.min(dt, 0.1);
      bright += ((on ? 1 : 0) - bright) * Math.min(1, dt * 8);
      lcdMat.emissiveIntensity = bright * 0.85;
      const key = `${on}|${lv}|${Math.round(bright * 20)}`; if (key !== drawnKey) { drawnKey = key; drawLCD(); }
      for (const k of Object.values(keys)) { if (k.t > 0) k.t -= dt; k.m.position.z = k.rest - (k.t > 0 ? 0.45 : 0); }
    },
  };
  return api;
}
