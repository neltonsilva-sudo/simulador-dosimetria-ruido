// Pós-processo do atlas Tripo (dono: MATERIAIS TRIPO). Corrige o contorno escuro/serrilhado das ilhas UV:
// o fundo do atlas entre as ilhas é cinza-azulado escuro e "sangra" no filtro bilinear/mipmaps → borda preta em volta
// da camisa e do colete. Aqui: máscara exata das ilhas (rasterização dos triângulos UV) + dilatação das cores das ilhas
// para fora (frente de onda, média dos vizinhos válidos). O mesmo motor faz inpainting das lascas brancas nas cascas-lente.

// rasteriza triângulos UV (lista de índices) numa máscara W×H; inner=true → só pixels totalmente cobertos
export function uvMask(UV, tris, W, H, inner = true) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.beginPath();
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], d = tris[t + 2];
    x.moveTo(UV.getX(a) * W, UV.getY(a) * H); x.lineTo(UV.getX(b) * W, UV.getY(b) * H); x.lineTo(UV.getX(d) * W, UV.getY(d) * H); x.closePath();
  }
  x.fill();
  const A = x.getImageData(0, 0, W, H).data, M = new Uint8Array(W * H), th = inner ? 250 : 8;
  for (let i = 0; i < M.length; i++) M[i] = A[i * 4 + 3] >= th ? 1 : 0;
  return M;
}

// dilata cores válidas (M=1) para pixels permitidos (allow(i) true, default: todos os inválidos), até iter passos
export function dilate(D, W, H, M, iter = 24, allow = null) {
  const V = M.slice(); let front = [];
  const ok = (i) => !V[i] && (!allow || allow[i]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!ok(i)) continue;
    if ((x > 0 && V[i - 1]) || (x < W - 1 && V[i + 1]) || (y > 0 && V[i - W]) || (y < H - 1 && V[i + W])) front.push(i); }
  const queued = new Uint8Array(W * H);
  for (let it = 0; it < iter && front.length; it++) {
    const cols = new Float32Array(front.length * 3);
    for (let f = 0; f < front.length; f++) { const i = front[f], x = i % W, y = (i / W) | 0; let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx;
        if (V[j]) { const w = dx && dy ? 0.7 : 1; r += D[j * 4] * w; g += D[j * 4 + 1] * w; b += D[j * 4 + 2] * w; n += w; } }
      cols[f * 3] = r / n; cols[f * 3 + 1] = g / n; cols[f * 3 + 2] = b / n; }
    const next = [];
    for (let f = 0; f < front.length; f++) { const i = front[f]; D[i * 4] = cols[f * 3]; D[i * 4 + 1] = cols[f * 3 + 1]; D[i * 4 + 2] = cols[f * 3 + 2]; V[i] = 1; }
    for (let f = 0; f < front.length; f++) { const i = front[f], x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && ok(j) && !queued[j]) { queued[j] = 1; next.push(j); } }
    front = next;
  }
  return V;
}

// imagem → canvas + ImageData
export function toCanvas(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0); return { c, x, id: x.getImageData(0, 0, c.width, c.height) };
}
