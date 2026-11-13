// Texturas procedurais dos DETALHES (canvas): pintura gasta com ferrugem/óleo/poeira, plástico, placas NR-26, decalques de piso.
import * as THREE from 'three';

export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true, rep = false) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t;
}
const memo = new Map();
const once = (k, f) => (memo.has(k) ? memo.get(k) : (memo.set(k, f()), memo.get(k)));

/** pintura industrial gasta: base + manchas de sujeira + ferrugem nas bordas + arranhões + escorridos de óleo */
export function paintTex(hex, { rust = 1, oil = 1, seed = 1, S = 512 } = {}) {
  return once(`paint${hex}_${rust}_${oil}_${seed}`, () => {
    const [c, x] = cv(S, S), R = rng(seed * 977 + hex);
    const col = new THREE.Color(hex);
    x.fillStyle = '#' + col.getHexString(); x.fillRect(0, 0, S, S);
    // variação de tom (repintura, desbotamento)
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '255,255,240' : '20,18,12'},${0.02 + R() * 0.05})`; x.beginPath(); x.ellipse(R() * S, R() * S, 20 + R() * 90, 10 + R() * 60, R() * 3, 0, 7); x.fill(); }
    // encardido: mais escuro embaixo
    const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(30,26,18,0.05)'); g.addColorStop(0.7, 'rgba(30,26,18,0.18)'); g.addColorStop(1, 'rgba(25,20,12,0.55)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    // ferrugem (bolhas e manchas nas bordas)
    for (let i = 0; i < 160 * rust; i++) {
      const edge = R() < 0.6; const px = edge ? (R() < 0.5 ? R() * 30 : S - R() * 30) : R() * S, py = edge ? R() * S : (R() < 0.6 ? S - R() * 60 : R() * S);
      x.fillStyle = `rgba(${110 + R() * 50},${55 + R() * 25},${25 + R() * 15},${0.15 + R() * 0.45})`; x.beginPath(); x.arc(px, py, 1 + R() * 7, 0, 7); x.fill();
    }
    // escorridos de óleo
    for (let i = 0; i < 10 * oil; i++) { const px = R() * S, py = R() * S * 0.7, len = 40 + R() * 160; const gg = x.createLinearGradient(0, py, 0, py + len); gg.addColorStop(0, 'rgba(15,12,6,0.45)'); gg.addColorStop(1, 'rgba(15,12,6,0)'); x.fillStyle = gg; x.fillRect(px, py, 2 + R() * 6, len); }
    // arranhões (metal aparente)
    for (let i = 0; i < 220; i++) { x.strokeStyle = `rgba(${R() < 0.5 ? '190,190,185' : '60,56,50'},${0.15 + R() * 0.4})`; x.lineWidth = 0.5 + R() * 1.2; const px = R() * S, py = R() * S, a = R() * 6.28, l = 4 + R() * 30; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    // poeira fina
    const id = x.getImageData(0, 0, S, S), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(id, 0, 0);
    return tex(c, true, true);
  });
}
/** rugosidade genérica: base média + manchas lisas (óleo) e ásperas (poeira) */
export const roughTex = () => once('rough', () => {
  const S = 256, [c, x] = cv(S, S), R = rng(5);
  x.fillStyle = 'rgb(170,170,170)'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) { const v = R() < 0.5 ? 70 + R() * 50 : 210 + R() * 45; x.fillStyle = `rgba(${v},${v},${v},${0.2 + R() * 0.4})`; x.beginPath(); x.arc(R() * S, R() * S, 3 + R() * 26, 0, 7); x.fill(); }
  const id = x.getImageData(0, 0, S, S), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 40; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(id, 0, 0);
  return tex(c, false, true);
});
/** plástico injetado de caixa KLT: nervuras verticais, riscos, sujeira na base */
export function crateTex(hex, seed = 2) {
  return once('crate' + hex, () => {
    const S = 256, [c, x] = cv(S, S), R = rng(seed + hex);
    x.fillStyle = '#' + new THREE.Color(hex).getHexString(); x.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) { const px = 12 + i * 32; x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(px, 30, 4, S - 50); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(px - 3, 30, 3, S - 50); }
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 22, S, 5); x.fillRect(0, S - 22, S, 4);
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(S * 0.32, 44, S * 0.36, 34); x.fillStyle = '#222'; x.font = 'bold 15px Arial'; x.fillText('PÇ ' + (1000 + Math.floor(R() * 8999)), S * 0.35, 66);
    const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0.55, 'rgba(25,22,15,0)'); g.addColorStop(1, 'rgba(25,22,15,0.55)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 120; i++) { x.strokeStyle = `rgba(255,255,255,${0.05 + R() * 0.15})`; x.lineWidth = 0.6; const px = R() * S, py = R() * S; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 30, py + (R() - 0.5) * 8); x.stroke(); }
    return tex(c);
  });
}
/** gaveteiro do carrinho / armário: linhas de gaveta + puxadores + adesivos */
export function drawerTex(hex, rows, seed = 3) {
  return once(`drw${hex}_${rows}`, () => {
    const S = 512, [c, x] = cv(S, S); x.drawImage(paintTex(hex, { rust: 0.6, seed }).image, 0, 0, S, S);
    for (let i = 0; i < rows; i++) {
      const y0 = (i / rows) * S; x.fillStyle = 'rgba(10,8,6,0.75)'; x.fillRect(0, y0, S, 5);
      x.fillStyle = 'rgba(210,210,205,0.9)'; x.fillRect(S * 0.3, y0 + 14, S * 0.4, 9); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(S * 0.3, y0 + 23, S * 0.4, 3);
    }
    x.strokeStyle = 'rgba(10,8,6,0.8)'; x.lineWidth = 8; x.strokeRect(0, 0, S, S);
    return tex(c);
  });
}
/** placas NR-26 com texto legível */
export function signTex(kind) {
  return once('sign' + kind, () => {
    const W = 512, H = 720, [c, x] = cv(W, H), R = rng(kind.length * 13);
    x.fillStyle = '#f4f2ea'; x.fillRect(0, 0, W, H);
    const txt = (lines, y0, size, col = '#111') => { x.fillStyle = col; x.textAlign = 'center'; x.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`; lines.forEach((l, i) => x.fillText(l, W / 2, y0 + i * size * 1.12)); };
    if (kind === 'auricular' || kind === 'oculos' || kind === 'luvas') {
      x.fillStyle = '#1d5ba6'; x.fillRect(0, 0, W, 130); txt(['USO', 'OBRIGATÓRIO'], 58, 54, '#fff');
      x.fillStyle = '#1d5ba6'; x.beginPath(); x.arc(W / 2, 330, 165, 0, 7); x.fill();
      x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round';
      if (kind === 'auricular') {
        // cabeça + abafador tipo concha
        x.beginPath(); x.ellipse(W / 2, 330, 72, 92, 0, 0, 7); x.fill(); x.fillStyle = '#1d5ba6'; x.beginPath(); x.ellipse(W / 2, 330, 56, 76, 0, 0, 7); x.fill();
        x.lineWidth = 18; x.beginPath(); x.arc(W / 2, 330, 105, Math.PI * 1.08, Math.PI * 1.92); x.stroke();
        x.fillStyle = '#fff'; x.beginPath(); x.roundRect(W / 2 - 128, 288, 48, 92, 16); x.fill(); x.beginPath(); x.roundRect(W / 2 + 80, 288, 48, 92, 16); x.fill();
        txt(['PROTETOR', 'AURICULAR'], 560, 66);
      } else if (kind === 'oculos') {
        x.lineWidth = 16; x.beginPath(); x.ellipse(W / 2 - 62, 330, 52, 40, 0, 0, 7); x.stroke(); x.beginPath(); x.ellipse(W / 2 + 62, 330, 52, 40, 0, 0, 7); x.stroke();
        x.beginPath(); x.moveTo(W / 2 - 12, 322); x.quadraticCurveTo(W / 2, 308, W / 2 + 12, 322); x.stroke();
        x.beginPath(); x.moveTo(W / 2 - 114, 320); x.lineTo(W / 2 - 150, 300); x.moveTo(W / 2 + 114, 320); x.lineTo(W / 2 + 150, 300); x.stroke();
        txt(['ÓCULOS DE', 'SEGURANÇA'], 560, 66);
      } else {
        x.beginPath(); x.roundRect(W / 2 - 60, 300, 120, 120, 24); x.fill();
        for (let k = 0; k < 4; k++) { x.beginPath(); x.roundRect(W / 2 - 58 + k * 30, 210 + (k === 0 || k === 3 ? 22 : 0), 24, 100, 12); x.fill(); }
        x.beginPath(); x.ellipse(W / 2 - 80, 330, 18, 52, -0.7, 0, 7); x.fill();
        txt(['LUVAS DE', 'PROTEÇÃO'], 560, 66);
      }
    } else if (kind === 'prensa') {
      x.fillStyle = '#f1c100'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#111'; x.fillRect(0, 0, W, 140); txt(['CUIDADO'], 104, 88, '#f1c100');
      x.fillStyle = '#111'; x.beginPath(); x.moveTo(W / 2, 175); x.lineTo(W / 2 + 165, 455); x.lineTo(W / 2 - 165, 455); x.closePath(); x.fill();
      x.fillStyle = '#f1c100'; x.beginPath(); x.moveTo(W / 2, 215); x.lineTo(W / 2 + 128, 432); x.lineTo(W / 2 - 128, 432); x.closePath(); x.fill();
      // pictograma: martelo da prensa descendo sobre a mão
      x.fillStyle = '#111'; x.fillRect(W / 2 - 50, 280, 100, 46); x.fillRect(W / 2 - 12, 245, 24, 40);
      x.beginPath(); x.moveTo(W / 2 - 22, 345); x.lineTo(W / 2 - 22, 330); x.moveTo(W / 2, 342); x.stroke();
      x.fillRect(W / 2 - 70, 380, 140, 14); x.beginPath(); x.ellipse(W / 2 + 20, 362, 46, 14, 0, 0, 7); x.fill();
      txt(['PRENSA EM', 'OPERAÇÃO', 'MANTENHA AS MÃOS', 'FORA DA ÁREA'], 520, 50);
    } else if (kind === 'ruido') {
      x.fillStyle = '#f1c100'; x.fillRect(0, 0, W, H); x.fillStyle = '#111'; x.fillRect(0, 0, W, 140); txt(['ATENÇÃO'], 104, 88, '#f1c100');
      txt(['ÁREA COM', 'RUÍDO ACIMA', 'DE 85 dB(A)'], 250, 72);
      txt(['USE PROTETOR', 'AURICULAR'], 560, 56);
    }
    // envelhecimento: poeira, mosca, bordas sujas, fita adesiva
    const g = x.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, H * 0.75); g.addColorStop(0, 'rgba(60,50,30,0)'); g.addColorStop(1, 'rgba(60,50,30,0.45)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 50; i++) { x.fillStyle = `rgba(50,40,25,${0.03 + R() * 0.08})`; x.beginPath(); x.arc(R() * W, R() * H, 4 + R() * 40, 0, 7); x.fill(); }
    for (let i = 0; i < 80; i++) { x.strokeStyle = `rgba(255,255,255,${0.08 + R() * 0.2})`; x.lineWidth = 0.8; const px = R() * W, py = R() * H; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 70, py + (R() - 0.5) * 12); x.stroke(); }
    x.fillStyle = '#9a9a96'; for (const [px, py] of [[22, 22], [W - 22, 22], [22, H - 22], [W - 22, H - 22]]) { x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill(); }
    return tex(c);
  });
}
/** poça de óleo (alfa irregular) */
export const oilTex = () => once('oil', () => {
  const S = 256, [c, x] = cv(S, S), R = rng(11);
  for (let i = 0; i < 26; i++) { const r = 18 + R() * 50, px = S / 2 + (R() - 0.5) * 120, py = S / 2 + (R() - 0.5) * 120; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.75, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
  return tex(c, false);
});
/** serragem absorvente sobre óleo: grânulos bege/laranja com alfa */
export const sawdustTex = () => once('saw', () => {
  const S = 512, [c, x] = cv(S, S), R = rng(12);
  for (let i = 0; i < 14000; i++) {
    const a = R() * 6.28, rr = Math.pow(R(), 0.7) * S * 0.42 * (0.8 + 0.25 * Math.sin(a * 3 + 1)); const px = S / 2 + Math.cos(a) * rr, py = S / 2 + Math.sin(a) * rr;
    const v = R(); x.fillStyle = `rgba(${150 + v * 70},${105 + v * 55},${55 + v * 35},${0.55 + R() * 0.45})`; x.fillRect(px, py, 1 + R() * 3, 1 + R() * 2);
  }
  for (let i = 0; i < 1400; i++) { const px = S / 2 + (R() - 0.5) * S * 0.6, py = S / 2 + (R() - 0.5) * S * 0.6; x.fillStyle = `rgba(40,28,14,${0.3 + R() * 0.5})`; x.fillRect(px, py, 1 + R() * 2, 1 + R() * 2); }
  return tex(c);
});
/** malha de luva de tricô preta (pigmentada) */
export const knitTex = () => once('knit', () => {
  const S = 128, [c, x] = cv(S, S), R = rng(9); x.fillStyle = '#1b1b1d'; x.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 4) for (let xx = 0; xx < S; xx += 4) { x.fillStyle = `rgba(${R() < 0.5 ? '70,70,72' : '8,8,8'},0.6)`; x.fillRect(xx, y, 3, 2); }
  return tex(c, true, true);
});
/** trapo: algodão manchado de óleo */
export const ragTex = (hex) => once('rag' + hex, () => {
  const S = 256, [c, x] = cv(S, S), R = rng(hex & 255); x.fillStyle = '#' + new THREE.Color(hex).getHexString(); x.fillRect(0, 0, S, S);
  for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(25,20,12,${0.15 + R() * 0.35})`; x.beginPath(); x.ellipse(R() * S, R() * S, 8 + R() * 40, 6 + R() * 25, R() * 3, 0, 7); x.fill(); }
  for (let y = 0; y < S; y += 3) { x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(0, y, S, 1); }
  return tex(c);
});
