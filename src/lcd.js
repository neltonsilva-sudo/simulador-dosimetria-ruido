// Visor TFT do DoseMax — dono: FIRMWARE. Rasterização nativa 128×160 (buffer de pixels próprio, fontes bitmap de
// lcd_font.js) → ampliada 4× (512×640) com aspecto de LCD real: grade de pixels/subpixels RGB, halo da retroiluminação,
// nível de preto do TFT e vinheta. Layout medido nas fotos do manual (p11/p12/p14/p19–p21, shots/fwref/).
import { MENUS, PAGES, SCREENS, hms, pad2, hhmm } from './fw_core.js';
import { FONTS } from './lcd_font.js';

const NW = 128, NH = 160, K = 4, W = NW * K, H = NH * K;
const rgb = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const P = (c) => (typeof c === 'number' || typeof c === 'function' ? c : rgb(c[0] | 0, c[1] | 0, c[2] | 0));
const vgrad = (y0, y1, a, b) => (x, y) => { const t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0))); const c = mix(a, b, t); return rgb(c[0] | 0, c[1] | 0, c[2] | 0); };
const hash = (n) => { const s = Math.sin(n * 12.9898 + 4.1) * 43758.5453; return s - Math.floor(s); };

// paleta medida nas fotos (TFT, gama já "queimada")
const C = {
  bg: rgb(4, 6, 10), hdr: [214, 240, 252], white: [236, 244, 248], cyan: [168, 226, 246], txt: [196, 236, 252],
  axis: [228, 238, 244], dot: [188, 200, 210], lime: [204, 228, 96], trace: [214, 224, 80], spec: [178, 206, 255],
  bar: [22, 186, 208], barTop: [120, 236, 246], barSel: [188, 220, 70], barSelTop: [236, 246, 140],
  sq: [34, 58, 176], navy: [18, 36, 128], box: [112, 188, 236], sel0: [46, 82, 214], sel1: [24, 48, 168], selB: [168, 208, 255],
  red: [232, 44, 36], green: [44, 214, 92], norm: [128, 180, 255], about: [34, 58, 176],
};

export function createLCD() {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const nc = document.createElement('canvas'); nc.width = NW; nc.height = NH; const nctx = nc.getContext('2d');
  const img = nctx.createImageData(NW, NH); const buf = new Uint32Array(img.data.buffer);
  const sm = document.createElement('canvas'); sm.width = 32; sm.height = 40; const smx = sm.getContext('2d');
  // grade de pixels 4×4: 3 subpixels R/G/B + 1 coluna e 1 linha de máscara preta (multiplicada)
  const pat = document.createElement('canvas'); pat.width = pat.height = K; const px4 = pat.getContext('2d');
  for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) {
    let c = x === 3 || y === 3 ? [178, 180, 188] : x === 0 ? [255, 226, 222] : x === 1 ? [226, 255, 228] : [224, 230, 255];
    if (x === 3 && y === 3) c = [150, 152, 160];
    px4.fillStyle = `rgb(${c})`; px4.fillRect(x, y, 1, 1);
  }
  const gridPat = ctx.createPattern(pat, 'repeat');
  const vign = ctx.createRadialGradient(W / 2, H * 0.46, W * 0.25, W / 2, H / 2, W * 0.86);
  vign.addColorStop(0, '#ffffff'); vign.addColorStop(0.7, '#f2f4f6'); vign.addColorStop(1, '#b8bcc4');
  const bleed = ctx.createLinearGradient(0, H, 0, H - 70); bleed.addColorStop(0, 'rgba(70,90,120,0.16)'); bleed.addColorStop(1, 'rgba(70,90,120,0)');

  // ── primitivas no buffer nativo ──
  function put(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= NW || y >= NH) return; buf[y * NW + x] = typeof c === 'function' ? c(x, y) : c; }
  function rect(x, y, w, h, c) { c = P(c); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, c); }
  function rbox(x, y, w, h, fill, border, r = h >= 14 && w >= 14 ? 2 : 1) { // retângulo com cantos arredondados de 1–2 px
    fill = fill && P(fill); border = border && P(border);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dx = Math.min(i, w - 1 - i), dy = Math.min(j, h - 1 - j);
      if (dx + dy < r) continue;                                   // fora do canto
      const edge = dx === 0 || dy === 0 || dx + dy === r;
      if (border && edge) put(x + i, y + j, border); else if (fill) put(x + i, y + j, fill);
    }
  }
  function line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); c = P(c);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { put(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function dots(x0, x1, y, c) { c = P(c); for (let x = x0; x <= x1; x += 2) put(x, y, c); }
  function disc(cx, cy, r, f) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x + 0.5 - 0.5, y); if (d <= r - 0.3) put(cx + x, cy + y, f(x, y, d / r)); } }
  function measure(str, f = 'S', pitch) { const F = FONTS[f]; let w = 0, last = 0; for (const ch of str) { const g = F[ch] || F[' '] || F['0']; w += pitch ?? g.a; last = (pitch ?? g.a) - g.w; } return w - last; }
  /** texto bitmap; (x,y) = canto superior esquerdo da célula (ou centro/direita com align); rot=-90 → vertical (de baixo p/ cima a partir de y). */
  function text(str, x, y, f, col, { align = 'left', pitch, rot = 0 } = {}) {
    str = String(str); const F = FONTS[f]; const c = P(col); const w = measure(str, f, pitch);
    let pen = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x;
    if (rot) pen = 0;
    for (const ch of str) {
      const g = F[ch] || F[ch.toUpperCase()] || F['?'] || F[' '];
      for (let gy = 0; gy < g.h; gy++) for (let gx = 0; gx < g.w; gx++) if (g.bits[gy * g.w + gx]) {
        if (rot) put(x + gy, y - pen - gx, c); else put(pen + gx, y + gy, c);
      }
      pen += pitch ?? g.a;
    }
    return w;
  }
  function streaky(x, y, w, h, base = [150, 214, 238], hi = [246, 255, 255], border = [232, 250, 255], dark = [70, 140, 196]) { // fundo azul-claro com estrias verticais
    for (let i = 0; i < w; i++) {
      const s = hash(i * 1.7 + 3) * 0.55 + hash(i * 0.31) * 0.35;
      for (let j = 0; j < h; j++) {
        const v = j / (h - 1), edge = Math.min(v, 1 - v); const shade = Math.min(1, edge * h / 3.2);
        let c = mix(base, hi, s * 0.9); c = mix(dark, c, 0.55 + 0.45 * shade);
        put(x + i, y + j, rgb(c[0] | 0, c[1] | 0, c[2] | 0));
      }
    }
    if (border) rbox(x, y, w, h, null, border);
    put(x, y, C.bg); put(x + w - 1, y, C.bg); put(x, y + h - 1, C.bg); put(x + w - 1, y + h - 1, C.bg);
  }
  const selFill = (y, h) => vgrad(y, y + h, C.sel0, C.sel1);

  // ── ícones ──
  function battery(pct) {
    const g = vgrad(4, 12, [96, 240, 128], [24, 180, 70]);
    rect(116, 3, 3, 1, C.green); rbox(114, 4, 7, 9, null, C.green);
    const fh = Math.max(1, Math.round(7 * pct / 100)); rect(115, 12 - fh, 5, fh, g);
  }
  function lock(x, y) { // cadeado 7×8
    const c = P(C.white); rect(x + 1, y, 5, 1, c); rect(x, y + 1, 1, 3, c); rect(x + 6, y + 1, 1, 3, c);
    rect(x, y + 3, 7, 5, c); put(x + 3, y + 5, C.bg); put(x + 3, y + 6, C.bg);
  }
  function headphone(x, y) { const c = P(C.red); rect(x + 2, y, 5, 1, c); put(x + 1, y + 1, c); put(x + 7, y + 1, c); rect(x, y + 2, 1, 3, c); rect(x + 8, y + 2, 1, 3, c); rect(x, y + 4, 3, 4, c); rect(x + 6, y + 4, 3, 4, c); }
  function arrow(x, y, up, col) { const c = P(col); for (let j = 0; j < 5; j++) { const yy = up ? y + j : y + 4 - j; rect(x + 4 - j, yy, 2 * j + 1, 1, c); } }
  function clockIcon(x, y) { const c = P(C.white); rect(x + 2, y, 3, 1, c); rect(x + 2, y + 6, 3, 1, c); rect(x, y + 2, 1, 3, c); rect(x + 6, y + 2, 1, 3, c); put(x + 1, y + 1, c); put(x + 5, y + 1, c); put(x + 1, y + 5, c); put(x + 5, y + 5, c); rect(x + 3, y + 1, 1, 3, c); put(x + 4, y + 3, c); }
  function triangle(x, y, up, col) { arrow(x, y, up, col); }

  // ── telas ──
  function header(s, core) {
    const t = core.clockShown();
    text(`${pad2(s.date.d)}/${pad2(s.date.m)} ${hhmm(t)}`, 5, 4, 'S', C.hdr);
    text(`${Math.round(s.battery)}%`, 111, 4, 'S', C.white, { align: 'right' });
    battery(s.battery);
    if (s.settings.agenda) clockIcon(27, 20);
    if (s.locked) lock(39, 19);
    if (s.over) arrow(76, 20, s.over > 0, s.over > 0 ? C.red : C.green);
    if (s.warn) headphone(88, 19);
    text(s.settings.user.weighting, 102, 21, 'S', C.white);
    text(s.settings.user.response, 114, 21, 'S', C.white);
    text('SPL', 9, 34, 'B', vgrad(34, 45, [240, 252, 255], [150, 232, 222]), { pitch: 9 });
    text(':', 39, 34, 'B', vgrad(34, 45, [240, 252, 255], [150, 232, 222]));
    text(`${s.splShown.toFixed(1)}dB`, 119, 34, 'B', vgrad(34, 45, [232, 238, 120], [168, 222, 72]), { align: 'right' });
  }
  function status(s, core) {
    const blinkOn = (s.blinkT % 1) < 0.65, fast = (s.blinkT * 2.5) % 1 < 0.5;
    const paused = s.mode === 'pause' || (s.mode === 'run' && s.progPause);
    if (paused) { const g = vgrad(52, 72, [244, 236, 80], [214, 196, 30]); rect(26, 52, 6, 21, g); rect(36, 52, 6, 21, g); }
    else if (s.mode === 'run' || s.mode === 'countdown') {
      if (s.mode === 'run' ? blinkOn : fast) disc(33, 61, 10, (x, y, d) => { const l = Math.max(0, 1 - Math.hypot(x + 3, y + 3) / 9); const c = mix(mix([150, 12, 10], [226, 30, 24], Math.min(1, 1.3 - d)), [255, 120, 96], l * l); return rgb(c[0] | 0, c[1] | 0, c[2] | 0); });
    } else { rect(23, 51, 21, 21, vgrad(51, 72, [44, 72, 196], [26, 46, 160])); rect(23, 51, 21, 1, [70, 100, 214]); }
    text(hms(Math.floor(core.measuredTime())), 55, 56, 'S', C.cyan);
    text(`${pad2(s.records.length)}/99 ${core.memPercent()}%`, 55, 66, 'S', C.cyan);
  }
  const LY = [96, 109, 121, 134, 146];
  const yL = (L) => 146 - (Math.max(42, Math.min(134, L)) - 50) * (50 / 80);
  function axes(ys) { ['130', '110', '90', '70', '50'].forEach((l, i) => { text(l, 22, ys[i] - 3, 'S', C.axis, { align: 'right' }); dots(24, 122, ys[i], C.dot); }); }
  function gTitle(t) { text(t, 66, 83, 'S', C.lime, { align: 'center', pitch: 7 }); }
  function graphLevel(s, title) {
    gTitle(title); axes(LY);
    const h = s.history; if (h.length < 2) return; const n = h.length;
    let px = null, py = null;
    h.forEach((v, i) => { const x = 122 - (n - 1 - i) * 98 / 99, y = yL(v); if (px !== null) line(px, py, x, y, C.trace); px = x; py = y; });
  }
  function graphSpectrum(s, title) {
    gTitle(title); axes(LY);
    const sp = s.spectrumShown; let px = null, py = null;
    for (let x = 24; x <= 122; x++) {
      const f = (x - 24) / 98 * 7; const i = Math.min(6, Math.floor(f)), fr = f - i;
      let L = sp ? sp[i] * (1 - fr) + sp[i + 1] * fr - 21 : 45; // nível por linha estreita (FFT) ≈ oitava − 10·log(nº de linhas)
      L += 2.5 * Math.sin(x * 2.3 + s.blinkT * 7) * Math.sin(x * 0.7);
      const y = yL(Math.max(44, L)); if (px !== null) line(px, py, x, y, C.spec); px = x; py = y;
    }
  }
  function graphOct(s, core, title) {
    gTitle(title);
    const ys = [96, 105, 114, 123, 132]; axes(ys);
    if (!s.settings.octaves) { text(core.tr('Filtro desligado'), 64, 146, 'S', C.cyan, { align: 'center' }); return; }
    const sp = s.spectrumShown || [30, 30, 30, 30, 30, 30, 30, 30];
    const y = (L) => Math.round(132 - (Math.max(42, Math.min(130, L)) - 50) * (36 / 80));
    sp.forEach((L, i) => {
      const x = 25 + i * 12, top = y(L), sel = i === 4;
      rect(x, top, 10, 137 - top, vgrad(top, 137, sel ? C.barSel : [40, 206, 226], sel ? [150, 190, 50] : [16, 150, 182]));
      rect(x, top, 10, 1, sel ? C.barSelTop : C.barTop);
    });
    text('1000Hz', 20, 149, 'S', C.txt); text(`${(sp[4] ?? 0).toFixed(1)}dB`, 118, 149, 'S', C.txt, { align: 'right' });
  }
  function norm(s, core, id) {
    const sn = core.live()[id];
    text(id, 8, 140, 'B', vgrad(0, 160, C.norm, C.norm), { rot: -90, pitch: id === 'USER' ? 10 : 10 });
    const f = (v) => (isFinite(v) ? v.toFixed(1) : '--.-');
    const rows = [['Dose:', `${(sn?.dose ?? 0).toFixed(1)}% `], [id === 'NHO01' ? 'LAEq:' : 'LAvg:', `${f(sn?.lavg)}dB`], ['Lmax', `${f(sn?.lmax)}dB`]];
    rows.forEach(([l, v], i) => { text(l, 26, 95 + i * 10.5 | 0, 'S', C.cyan); text(v, 112, 95 + i * 10.5 | 0, 'S', C.cyan, { align: 'right' }); });
  }
  function popup(s, core) {
    const p = s.popup; rbox(9, 55, 101, 59, C.bg, [222, 236, 246]);
    text(core.tr(p.type === 'precal' ? 'Pre Calibrar' : 'Pos Calibrar'), 59, 59, 'S', C.white, { align: 'center' });
    const c = s.cal;
    if (c) {
      const msg = c.status === 'stab' ? core.tr('Calibrando') + '.'.repeat(1 + Math.floor(c.t * 2) % 3) : core.tr(c.msg);
      text(msg, 59, 73, 'S', c.status === 'fail' ? [255, 96, 80] : C.cyan, { align: 'center', pitch: measure(msg) > 96 ? 5 : undefined });
      text(`${c.level}dB`, 59, 84, 'S', C.white, { align: 'center' });
      text(`SPL ${(c.reading ?? s.splShown).toFixed(1)}`, 59, 95, 'S', C.lime, { align: 'center' });
      if (c.status === 'stab') { rect(19, 106, 80, 3, [26, 50, 96]); rect(19, 106, Math.round(80 * Math.min(1, c.t / 4)), 3, vgrad(106, 109, [110, 170, 255], [50, 110, 240])); }
      return;
    }
    ['Nao', '94dB', '114dB'].forEach((o, i) => {
      const y = 72 + i * 13, t = i === 0 ? core.tr('Nao') : o, w = measure(t);
      if (i === p.sel) rbox(29, y - 2, Math.max(w + 6, 24), 11, selFill(y - 2, 11));
      text(t, i === p.sel ? 29 + Math.round((Math.max(w + 6, 24) - w) / 2) : 31, y, 'S', i === p.sel ? C.white : C.txt);
    });
  }
  function titleBox(t) { streaky(6, 5, 116, 23); const f = measure(t, 'M', 10) > 110 ? 'S' : 'M'; text(t, 64, f === 'M' ? 9 : 13, f, C.navy, { align: 'center', pitch: f === 'M' ? 10 : 7 }); }
  function menuList(title, items, sel, big) {
    titleBox(title);
    const n = items.length, top = big ? 35 : n > 4 ? 33 : 36, step = big ? 23 : n > 4 ? 18 : 24, hh = big ? 20 : n > 4 ? 15 : 18;
    items.forEach((it, i) => {
      const y = top + i * step, on = i === sel;
      rbox(8, y, 112, hh, on ? selFill(y, hh) : C.bg, on ? C.selB : C.box);
      if (big) text(it, 64, y + 3, 'MB', on ? [214, 240, 255] : [176, 232, 246], { align: 'center', pitch: 10 });
      else text(it, 64, y + Math.floor((hh - 7) / 2), 'S', on ? C.white : C.txt, { align: 'center' });
    });
  }
  function page(s, core) {
    const key = s.menuPath[s.menuPath.length - 1], Pg = PAGES[key], pg = s.page, tr = core.tr;
    if (Pg.type === 'info') return about();
    titleBox(tr(Pg.title));
    if (Pg.type === 'options') {
      if (Pg.confirm) {
        streaky(7, 43, 113, 46, [214, 36, 36], [246, 104, 96], [255, 196, 188], [170, 20, 22]);
        text(tr('Apagar todos'), 64, 56, 'S', C.white, { align: 'center' }); text(tr('os registros?'), 64, 66, 'S', C.white, { align: 'center' });
        Pg.options.forEach((o, i) => { const y = 99 + i * 20, on = i === pg.sel; rbox(8, y, 112, 15, on ? selFill(y, 15) : C.bg, on ? C.selB : C.box); text(tr(o), 64, y + 4, 'S', on ? C.white : C.txt, { align: 'center' }); });
        return;
      }
      if (Pg.sub) text(tr(Pg.sub), 64, 36, 'S', C.cyan, { align: 'center', pitch: measure(tr(Pg.sub)) > 120 ? 5 : undefined });
      Pg.options.forEach((o, i) => { const y = 48 + i * 20, on = i === pg.sel; rbox(14, y, 100, 15, on ? selFill(y, 15) : C.bg, on ? C.selB : C.box); text(tr(o), 64, y + 4, 'S', on ? C.white : C.txt, { align: 'center' }); });
      return;
    }
    if (Pg.type === 'number') {
      rbox(10, 40, 108, 62, null, C.box);
      text(tr(Pg.label), 64, 47, 'S', C.white, { align: 'center' });
      rbox(36, 62, 56, 22, selFill(62, 22), C.selB);
      text(String(Pg.values[pg.sel]), 64, 67, 'B', C.white, { align: 'center' });
      triangle(30, 112, false, C.cyan); text('-', 42, 112, 'S', C.cyan); text('+', 81, 112, 'S', C.cyan); triangle(90, 112, true, C.cyan);
      return;
    }
    if (Pg.type === 'fields') {
      const v = pg.values, cur = Pg.fields[pg.field][0];
      const hl = (k, x, y, str, f) => { const w = measure(str, f), h = f === 'B' ? 12 : 7; if (cur === k) rbox(x - (w >> 1) - 2, y - 2, w + 4, h + 4, selFill(y - 2, h + 4)); text(str, x, y, f, C.white, { align: 'center' }); };
      if (key === 'duracao') {
        rbox(8, 44, 112, 43, null, C.box); text(tr('Tempo (h/min)'), 64, 49, 'SB', C.white, { align: 'center', pitch: measure(tr('Tempo (h/min)'), 'SB') > 104 ? 6 : 7 });
        hl('durH', 52, 63, pad2(v.durH), 'B'); text(':', 63, 63, 'B', C.white); hl('durM', 77, 63, pad2(v.durM), 'B');
        rbox(8, 91, 112, 46, null, C.box); text(tr('Horario Pausa'), 64, 96, 'SB', C.white, { align: 'center' });
        text(tr('Inicio'), 20, 109, 'SB', C.white); hl('piH', 76, 109, pad2(v.piH), 'SB'); hl('piM', 95, 109, pad2(v.piM), 'SB');
        text(tr('Fim'), 20, 123, 'SB', C.white); hl('pfH', 76, 123, pad2(v.pfH), 'SB'); hl('pfM', 95, 123, pad2(v.pfM), 'SB');
      } else if (key === 'datahora') {
        rbox(8, 36, 112, 80, null, C.box);
        hl('d', 44, 52, pad2(v.d), 'B'); text('/', 64, 55, 'S', C.white, { align: 'center' }); hl('m', 84, 52, pad2(v.m), 'B');
        hl('h', 44, 88, pad2(v.h), 'B'); text(':', 62, 88, 'B', C.white); hl('mi', 84, 88, pad2(v.mi), 'B');
      } else {
        rbox(8, 36, 112, 80, null, C.box);
        text(tr('Brilho'), 64, 44, 'S', C.white, { align: 'center' }); hl('bri', 64, 56, String(v.bri), 'B');
        text(tr('Desligar (min)'), 64, 80, 'S', C.white, { align: 'center' }); hl('off', 64, 92, String(v.off), 'B');
      }
      return;
    }
    if (Pg.type === 'records') {
      const recs = s.records.slice().reverse(); const n = recs.length + 1;
      if (!recs.length) text(tr('Sem registros'), 64, 66, 'S', C.cyan, { align: 'center' });
      const first = Math.max(0, Math.min(pg.sel - 4, recs.length - 10));
      for (let i = 0; i < 10 && first + i < recs.length; i++) {
        const r = recs[first + i], on = first + i === pg.sel, y = 34 + i * 11;
        [[String(r.n).padStart(3, '0'), 12], [r.date, 43], [r.time, 85]].forEach(([t, x]) => {
          if (on) rect(x - 1, y - 2, measure(t) + 2, 11, [22, 40, 150]);
          text(t, x, y, 'S', on ? [150, 196, 255] : [176, 222, 246]);
        });
      }
      const vb = pg.sel === n - 1;
      text(tr('Voltar'), 120, 150, 'S', vb ? [70, 130, 255] : C.txt, { align: 'right', pitch: 7 });
      if (s.popup) popup(s, core);
      return;
    }
    if (Pg.type === 'calibrar') {
      const c = s.cal?.kind === 'menu' ? s.cal : null;
      const bar = P([40, 72, 200]); rect(17, 48, 2, 88, bar); rect(14, 48, 8, 1, bar); rect(14, 135, 8, 1, bar);
      for (let j = 0; j < 4; j++) rect(21 + j, 83 - j, 1, 2 * j + 1, C.white); // ◄ (aponta para a escala)
      text(pg.level.toFixed(1), 28, 80, 'S', C.white);
      const rd = c?.reading ?? s.splShown; const dy = Math.max(-40, Math.min(40, Math.round((rd - pg.level) * 4)));
      rect(13, 83 - dy, 10, 2, vgrad(0, 160, [176, 236, 96], [176, 236, 96]));
      text('SPL:', 89, 59, 'B', C.white, { align: 'center' });
      text(rd.toFixed(1), 89, 76, 'B', C.white, { align: 'center' });
      if (c) { const m = c.status === 'stab' ? tr('Calibrando') + '...' : tr(c.msg); text(m, 89, 95, 'S', c.status === 'fail' ? [255, 96, 80] : C.lime, { align: 'center', pitch: measure(m) > 70 ? 5 : undefined }); }
      rbox(58, 113, 63, 13, selFill(113, 13), C.selB); text(tr('Calibrar'), 89, 116, 'S', C.white, { align: 'center' });
    }
  }
  function logo(y) { text('DoseMax', 64, y, 'L', vgrad(y, y + 24, [30, 56, 180], [16, 34, 132]), { align: 'center' }); }
  function about() {
    streaky(0, 0, 128, 160, [140, 192, 232], [206, 230, 248], [190, 222, 246], [110, 160, 214]);
    logo(9);
    let y = 45;
    for (const l of ['Version:', 'DoseMax 1.0.2', 'Nov 12 2026', '', 'Serial:', '200101003018', '', 'IEC 60651:1979', 'ANSI S1.25-1991', 'IEC 61252:2002', 'IEC 61260:2014']) {
      if (!l) { y += 4; continue; } text(l, 10, y, 'S', C.about, { pitch: l.length > 14 ? 6 : 7 }); y += 9;
    }
  }
  function bootScreen() { streaky(0, 0, 128, 160, [140, 192, 232], [206, 230, 248], [190, 222, 246], [110, 160, 214]); logo(68); }
  function msgBox(t) {
    const words = t.split(' '); const lines = []; let cur = '';
    for (const w of words) { const nx = cur ? cur + ' ' + w : w; if (measure(nx) > 104 && cur) { lines.push(cur); cur = w; } else cur = nx; }
    lines.push(cur); const h = 8 + lines.length * 10;
    rbox(8, 77 - (h >> 1), 112, h, [10, 20, 52], C.selB);
    lines.forEach((l, i) => text(l, 64, 77 - (h >> 1) + 5 + i * 10, 'S', C.white, { align: 'center' }));
  }

  // ── composição 512×640 com aspecto de TFT ──
  let lastBl = 0;
  function compose(bl) {
    lastBl = bl;
    nctx.putImageData(img, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#030405'; ctx.fillRect(0, 0, W, H);
    if (bl <= 0.001) return;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(nc, 0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gridPat; ctx.fillRect(0, 0, W, H);
    // halo (luz espalhada no vidro/difusor) e nível de preto da retroiluminação
    ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true;
    smx.clearRect(0, 0, 32, 40); smx.imageSmoothingEnabled = true; smx.drawImage(nc, 0, 0, 32, 40);
    ctx.globalAlpha = 0.2; ctx.drawImage(sm, 0, 0, W, H);
    ctx.globalAlpha = 0.16; ctx.drawImage(nc, 0, 0, W, H);
    ctx.globalAlpha = 1; ctx.fillStyle = 'rgb(9,11,16)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = bleed; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = vign; ctx.fillRect(0, 0, W, H);
    if (bl < 0.999) { const v = Math.round(255 * Math.max(0, bl)); ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false;
  }

  /** fx: {boot: s (tempo desde que ligou), off: 0..1 (transição de desligar)} */
  function draw(s, core, fx = {}) {
    buf.fill(C.bg);
    if (fx.off != null) { bootScreen(); return compose(fx.off < 0.45 ? 1 : Math.max(0, 1 - (fx.off - 0.45) / 0.55)); }
    if (s.power === 'off' || s.displayOff) return compose(0);
    if (s.power === 'boot') {
      const t = s.bootT;
      if (t < 0.18) { buf.fill(rgb(236, 242, 248)); return compose(t / 0.18 * 0.6); } // inicialização do controlador TFT (tela branca)
      bootScreen(); return compose(Math.min(1, 0.6 + (t - 0.18) * 1.6));
    }
    if (s.menuPath.length) {
      const top = s.menuPath[s.menuPath.length - 1];
      if (MENUS[top]) menuList(core.tr(MENUS[top].title), MENUS[top].items.map((i) => core.tr(i[0])), s.menuSel[top] || 0, top === 'main');
      else page(s, core);
    } else {
      header(s, core); status(s, core);
      const scr = SCREENS[s.screen];
      if (s.screen === 0) graphLevel(s, core.tr('Nivel'));
      else if (s.screen === 1) graphSpectrum(s, core.tr('Espectro'));
      else if (s.screen === 2) graphOct(s, core, core.tr('Oitavas'));
      else norm(s, core, scr);
      if (s.popup) popup(s, core);
    }
    if (s.msg) msgBox(s.msg.text);
    const b = s.settings.brightness;
    compose(b >= 10 ? 1 : 0.35 + 0.065 * b);
  }
  return { canvas, draw, native: nc, get backlight() { return lastBl; } };
}
