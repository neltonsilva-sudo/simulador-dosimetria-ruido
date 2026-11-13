// Visor do DoseMax (128×160, desenhado em 512×640 = 4×) — dono: FIRMWARE. Layout medido nas fotos do manual (p11/p12/p14/p19–p21).
import { MENUS, PAGES, SCREENS, hms, pad2, hhmm } from './fw_core.js';

const W = 512, H = 640, K = 4;
const MONO = 'Menlo, "DejaVu Sans Mono", Consolas, monospace';
const C = { bg: '#07080b', hdr: '#bdeefa', white: '#e8f0f2', cyan: '#a8e4f4', lime: '#c8e070', axis: '#d0f0ff', dot: '#b8c8d0',
  trace: '#b8d84a', spec: '#8cc4ff', bar: '#26c2d6', barTop: '#6ae8f2', barSel: '#d0e050', blue: '#1d3aa6', blueB: '#3a5ad0',
  navy: '#0c2a78', box: '#78c0e8', sel: '#1c3fb0', red: '#e03028' };

export function createLCD() {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = (px, bold = true) => `${bold ? 'bold ' : ''}${px * K}px ${MONO}`;
  function text(str, x, y, col, px = 7, { align = 'left', bold = false, sy = 1 } = {}) {
    ctx.save(); ctx.font = font(px, bold); ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.translate(x * K, y * K); ctx.scale(1, sy); ctx.fillText(str, 0, 0); ctx.restore();
  }
  function grad(x0, x1, a, b) { const g = ctx.createLinearGradient(x0 * K, 0, x1 * K, 0); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function rrect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x * K, y * K, w * K, h * K, r * K);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = 4; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function streaky(x, y, w, h, base, hi) { // fundo azul-claro com faixas verticais (títulos, abertura, Sobre)
    ctx.save(); ctx.beginPath(); ctx.roundRect(x * K, y * K, w * K, h * K, 3 * K); ctx.clip();
    ctx.fillStyle = base; ctx.fillRect(x * K, y * K, w * K, h * K);
    for (let i = 0; i < w * K; i += 3) { const n = Math.sin(i * 12.9898) * 43758.5453; const f = n - Math.floor(n); ctx.globalAlpha = 0.15 + 0.35 * f; ctx.fillStyle = hi; ctx.fillRect(x * K + i, y * K, 1.5, h * K); }
    const g = ctx.createLinearGradient(0, y * K, 0, (y + h) * K); g.addColorStop(0, 'rgba(40,120,170,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(40,120,170,.35)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x * K, y * K, w * K, h * K); ctx.restore();
    rrect(x, y, w, h, 3, null, '#e6fbff');
  }
  function dotted(x0, x1, y, col) { ctx.fillStyle = col; for (let x = x0; x < x1; x += 2) ctx.fillRect(x * K, y * K, K * 0.75, K * 0.75); }

  function header(s, core) {
    const t = core.clockShown();
    text(`${pad2(s.date.d)}/${pad2(s.date.m)} ${hhmm(t)}`, 4, 11, C.hdr, 7.6);
    text(`${Math.round(s.battery)}%`, 111, 11, C.white, 7.6, { align: 'right' });
    ctx.fillStyle = '#2fd050'; ctx.fillRect(114 * K, 4 * K, 6 * K, 8 * K); ctx.fillRect(115.5 * K, 3 * K, 3 * K, 1 * K);
    if (s.settings.agenda) { ctx.strokeStyle = C.white; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(30 * K, 24.5 * K, 3 * K, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(30 * K, 24.5 * K); ctx.lineTo(30 * K, 22.5 * K); ctx.moveTo(30 * K, 24.5 * K); ctx.lineTo(31.5 * K, 24.5 * K); ctx.stroke(); }
    if (s.locked) { ctx.fillStyle = C.white; ctx.fillRect(39 * K, 23 * K, 7 * K, 5 * K); ctx.strokeStyle = C.white; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(42.5 * K, 23 * K, 2.2 * K, Math.PI, 0); ctx.stroke(); ctx.fillStyle = C.bg; ctx.fillRect(42 * K, 24.5 * K, 1 * K, 2 * K); }
    if (s.over) { ctx.fillStyle = s.over > 0 ? C.red : '#30d050'; ctx.beginPath(); const y0 = s.over > 0 ? 28 : 21, y1 = s.over > 0 ? 21 : 28; ctx.moveTo(77 * K, y0 * K); ctx.lineTo(83 * K, y0 * K); ctx.lineTo(80 * K, y1 * K); ctx.fill(); }
    if (s.warn) { ctx.strokeStyle = C.red; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(91 * K, 25.5 * K, 3.2 * K, Math.PI, 0); ctx.stroke(); ctx.fillStyle = C.red; ctx.fillRect(87.3 * K, 25 * K, 2 * K, 3.5 * K); ctx.fillRect(92.7 * K, 25 * K, 2 * K, 3.5 * K); }
    text(s.settings.user.weighting, 104, 28, C.white, 7.4, { align: 'center' });
    text(s.settings.user.response, 116, 28, C.white, 7.4, { align: 'center' });
    // SPL
    text('SPL:', 9, 45.5, grad(9, 46, '#9cf0dc', '#d6f2ff'), 15, { bold: true, sy: 1.3 });
    text(`${s.splShown.toFixed(1)}dB`, 119, 45.5, grad(62, 119, '#9ee05a', '#e4e46a'), 14.6, { align: 'right', bold: true, sy: 1.3 });
  }
  function status(s, core) {
    const blinkOn = (s.blinkT % 1) < 0.65, fast = (s.blinkT * 2.5) % 1 < 0.5;
    const paused = s.mode === 'pause' || (s.mode === 'run' && s.progPause);
    if (paused) { ctx.fillStyle = '#e4d838'; ctx.fillRect(26 * K, 53 * K, 6 * K, 20 * K); ctx.fillRect(36 * K, 53 * K, 6 * K, 20 * K); }
    else if (s.mode === 'run' || s.mode === 'countdown') {
      if (s.mode === 'run' ? blinkOn : fast) { const g = ctx.createRadialGradient(31 * K, 60 * K, K, 33.5 * K, 63 * K, 10 * K); g.addColorStop(0, '#ff6a50'); g.addColorStop(0.7, '#d81e18'); g.addColorStop(1, '#a0100c'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(33.5 * K, 63 * K, 10 * K, 0, 7); ctx.fill(); }
    } else { ctx.fillStyle = C.blue; ctx.fillRect(23 * K, 52 * K, 22 * K, 22 * K); ctx.strokeStyle = C.blueB; ctx.lineWidth = 3; ctx.strokeRect(23.4 * K, 52.4 * K, 21.2 * K, 21.2 * K); }
    text(hms(Math.floor(core.measuredTime())), 55, 61.5, C.cyan, 7.6);
    text(`${pad2(s.records.length)}/99 ${core.memPercent()}%`, 55, 71.5, C.cyan, 7.6);
  }
  const yL = (L) => 142 - (Math.max(40, Math.min(135, L)) - 50) * (46 / 80);
  function axes(ys) { ['130', '110', '90', '70', '50'].forEach((l, i) => { text(l, 21, ys[i] + 3, C.axis, 7.4, { align: 'right' }); dotted(23, 125, ys[i], C.dot); }); }
  function graphLevel(s, title) {
    text(title, 64, 89, C.lime, 7.6, { align: 'center' });
    axes([96, 107.5, 119, 130.5, 142]);
    const h = s.history; if (h.length < 2) return;
    ctx.strokeStyle = C.trace; ctx.lineWidth = 3; ctx.beginPath();
    const n = h.length, x0 = 24, x1 = 124;
    h.forEach((v, i) => { const x = x1 - (n - 1 - i) * (x1 - x0) / 99; i ? ctx.lineTo(x * K, yL(v) * K) : ctx.moveTo(x * K, yL(v) * K); });
    ctx.stroke();
  }
  function graphSpectrum(s, title) {
    text(title, 64, 89, C.lime, 7.6, { align: 'center' });
    axes([96, 107.5, 119, 130.5, 142]);
    const sp = s.spectrumShown; ctx.strokeStyle = C.spec; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = 24; x <= 124; x++) {
      const f = (x - 24) / 100 * 7; const i = Math.min(6, Math.floor(f)), fr = f - i;
      let L = sp ? sp[i] * (1 - fr) + sp[i + 1] * fr - 21 : 45; // nível por linha estreita (FFT) ≈ oitava − 10·log(nº de linhas)
      L += 2.5 * Math.sin(x * 2.3 + s.blinkT * 7) * Math.sin(x * 0.7);
      const y = yL(Math.max(42, L)); x === 24 ? ctx.moveTo(x * K, y * K) : ctx.lineTo(x * K, y * K);
    }
    ctx.stroke();
  }
  function graphOct(s, core, title) {
    text(title, 64, 89, C.lime, 7.6, { align: 'center' });
    const ys = [96, 105, 114, 123, 132]; axes(ys);
    if (!s.settings.octaves) { text(core.tr('Filtro desligado'), 64, 152, C.cyan, 7, { align: 'center' }); return; }
    const sp = s.spectrumShown || [30, 30, 30, 30, 30, 30, 30, 30];
    const y = (L) => 132 - (Math.max(41, Math.min(132, L)) - 50) * (36 / 80);
    sp.forEach((L, i) => {
      const x = 25 + i * 12.2, top = y(L);
      ctx.fillStyle = i === 4 ? C.barSel : C.bar; ctx.fillRect(x * K, top * K, 10 * K, (136 - top) * K);
      ctx.fillStyle = i === 4 ? '#eef080' : C.barTop; ctx.fillRect(x * K, top * K, 10 * K, 1 * K);
    });
    text('1000Hz', 20, 153, C.cyan, 7.6); text(`${(sp[4] ?? 0).toFixed(1)}dB`, 118, 153, C.cyan, 7.6, { align: 'right' });
  }
  function norm(s, core, id) {
    const sn = core.live()[id];
    ctx.save(); ctx.translate(19 * K, 112 * K); ctx.rotate(-Math.PI / 2); ctx.font = font(12.5, true); ctx.fillStyle = '#5cc8ec'; ctx.textAlign = 'center'; ctx.fillText(id, 0, 0); ctx.restore();
    const f = (v) => (isFinite(v) ? v.toFixed(1) : '--.-');
    const rows = [['Dose:', `${(sn?.dose ?? 0).toFixed(1)}% `], [id === 'NHO01' ? 'LAEq:' : 'LAvg:', `${f(sn?.lavg)}dB`], ['Lmax', `${f(sn?.lmax)}dB`]];
    rows.forEach(([l, v], i) => { text(l, 26, 102 + i * 9.5, C.cyan, 7.6); text(v, 111, 102 + i * 9.5, C.cyan, 7.6, { align: 'right' }); });
  }
  function popup(s, core) {
    const p = s.popup; rrect(20, 53, 92, 62, 3, '#05060a', '#a8d8f0');
    text(core.tr(p.type === 'precal' ? 'Pre Calibrar' : 'Pos Calibrar'), 65, 63, C.white, 7.4, { align: 'center' });
    const c = s.cal;
    if (c) {
      text(c.status === 'stab' ? core.tr('Calibrando') + '.'.repeat(1 + Math.floor(c.t * 2) % 3) : core.tr(c.msg), 66, 76, c.status === 'fail' ? '#ff6050' : C.cyan, 7, { align: 'center' });
      text(`${c.level}dB`, 66, 89, C.white, 8, { align: 'center' });
      text(`SPL ${(c.reading ?? s.splShown).toFixed(1)}`, 66, 102, C.lime, 8, { align: 'center' });
      if (c.status === 'stab') { ctx.fillStyle = '#20406a'; ctx.fillRect(28 * K, 107 * K, 76 * K, 3 * K); ctx.fillStyle = '#3a8aff'; ctx.fillRect(28 * K, 107 * K, 76 * K * Math.min(1, c.t / 4), 3 * K); }
      return;
    }
    ['Nao', '94dB', '114dB'].forEach((o, i) => {
      const y = 79 + i * 14.4;
      if (i === p.sel) rrect(33, y - 8.5, 25, 11, 3, C.sel);
      text(i === 0 ? core.tr('Nao') : o, 55.5, y, C.white, 8, { align: 'right' });
    });
  }
  function menuList(title, items, sel, big) {
    streaky(6, 4, 116, 22, '#9ad6ee', '#f2ffff');
    text(title, 64, 20.5, C.navy, big ? 12.5 : 12, { align: 'center', bold: !big });
    const n = items.length, top = big ? 33 : 31, step = big ? 24 : n > 4 ? 18 : 24, hh = big ? 20 : n > 4 ? 14 : 18;
    items.forEach((it, i) => {
      const y = top + i * step;
      rrect(8, y, 112, hh, 3, i === sel ? C.sel : '#05060a', i === sel ? '#9ad0ff' : C.box);
      text(it, 64, y + hh / 2 + (big ? 5 : 3), '#dcf6ff', big ? 12 : 7.6, { align: 'center', bold: big });
    });
  }
  function page(s, core) {
    const key = s.menuPath[s.menuPath.length - 1], P = PAGES[key], pg = s.page, tr = core.tr, st = s.settings;
    if (P.type === 'info') return about();
    streaky(6, 4, 116, 22, '#9ad6ee', '#f2ffff');
    text(tr(P.title), 64, 20.5, C.navy, 11.5, { align: 'center', bold: true });
    if (P.type === 'options') {
      if (P.confirm) {
        ctx.save(); streaky(8, 34, 112, 46, '#e23a34', '#ff9080'); ctx.restore();
        text(tr('Apagar todos'), 64, 55, '#fff', 7.4, { align: 'center' }); text(tr('os registros?'), 64, 64, '#fff', 7.4, { align: 'center' });
        P.options.forEach((o, i) => { rrect(8, 96 + i * 20, 112, 14, 3, i === pg.sel ? C.sel : '#05060a', C.box); text(tr(o), 64, 106 + i * 20, '#dcf6ff', 7.6, { align: 'center' }); });
        return;
      }
      if (P.sub) text(tr(P.sub), 64, 40, C.cyan, 7, { align: 'center' });
      P.options.forEach((o, i) => { const y = 48 + i * 20; rrect(14, y, 100, 15, 3, i === pg.sel ? C.sel : '#05060a', C.box); text(tr(o), 64, y + 11, '#dcf6ff', 8, { align: 'center' }); });
      return;
    }
    if (P.type === 'number') {
      rrect(10, 40, 108, 60, 4, null, C.box);
      text(tr(P.label), 64, 54, C.white, 7.4, { align: 'center' });
      rrect(40, 62, 48, 24, 3, C.sel);
      text(String(P.values[pg.sel]), 64, 81, '#fff', 15, { align: 'center', bold: true });
      text('▼ -   + ▲', 64, 116, C.cyan, 7, { align: 'center' });
      return;
    }
    if (P.type === 'fields') {
      const v = pg.values; const hl = (k, x, y, str, px, wch) => { if (P.fields[pg.field][0] === k) rrect(x - wch / 2 - 1, y - px - 1, wch + 2, px + 4, 2, C.sel); text(str, x, y, '#fff', px, { align: 'center', bold: true }); };
      if (key === 'duracao') {
        rrect(8, 31, 112, 44, 5, null, C.box); text(tr('Tempo (h/min)'), 64, 42, C.white, 7.4, { align: 'center', bold: true });
        hl('durH', 52, 64, pad2(v.durH), 13, 16); text(':', 64, 63, '#fff', 13, { align: 'center', bold: true }); hl('durM', 76, 64, pad2(v.durM), 13, 16);
        rrect(8, 80, 112, 46, 5, null, C.box); text(tr('Horario Pausa'), 64, 91, C.white, 7.4, { align: 'center', bold: true });
        text(tr('Inicio'), 16, 104, C.white, 7.4, { bold: true }); hl('piH', 75, 104, pad2(v.piH), 7.4, 10); hl('piM', 93, 104, pad2(v.piM), 7.4, 10);
        text(tr('Fim'), 16, 117, C.white, 7.4, { bold: true }); hl('pfH', 75, 117, pad2(v.pfH), 7.4, 10); hl('pfM', 93, 117, pad2(v.pfM), 7.4, 10);
      } else if (key === 'datahora') {
        rrect(8, 36, 112, 80, 5, null, C.box);
        hl('d', 40, 62, pad2(v.d), 12, 15); text('/', 52, 62, '#fff', 12, { align: 'center' }); hl('m', 64, 62, pad2(v.m), 12, 15);
        hl('h', 40, 96, pad2(v.h), 12, 15); text(':', 52, 96, '#fff', 12, { align: 'center' }); hl('mi', 64, 96, pad2(v.mi), 12, 15);
      } else {
        rrect(8, 36, 112, 80, 5, null, C.box);
        text(tr('Brilho'), 64, 50, C.white, 7.4, { align: 'center' }); hl('bri', 64, 68, String(v.bri), 12, 18);
        text(tr('Desligar (min)'), 64, 88, C.white, 7.4, { align: 'center' }); hl('off', 64, 106, String(v.off), 12, 18);
      }
      return;
    }
    if (P.type === 'records') {
      const recs = s.records.slice().reverse(); const n = recs.length + 1;
      if (!recs.length) text(tr('Sem registros'), 64, 70, C.cyan, 7.4, { align: 'center' });
      const first = Math.max(0, Math.min(pg.sel - 4, recs.length - 10));
      for (let i = 0; i < 10 && first + i < recs.length; i++) {
        const r = recs[first + i], sel = first + i === pg.sel;
        text(`${String(r.n).padStart(3, '0')} ${r.date} ${r.time}`, 64, 38 + i * 11.4, sel ? '#4a86ff' : C.cyan, 7.6, { align: 'center' });
      }
      text(tr('Voltar'), 118, 155, pg.sel === n - 1 ? '#4a86ff' : C.white, 7.4, { align: 'right' });
      if (s.popup) popup(s, core);
      return;
    }
    if (P.type === 'calibrar') {
      const c = s.cal?.kind === 'menu' ? s.cal : null;
      ctx.fillStyle = '#2040b8'; ctx.fillRect(17 * K, 46 * K, 2 * K, 92 * K); ctx.fillRect(14 * K, 46 * K, 8 * K, K); ctx.fillRect(14 * K, 137 * K, 8 * K, K);
      ctx.fillStyle = C.white; ctx.beginPath(); ctx.moveTo(20 * K, 86 * K); ctx.lineTo(24 * K, 84 * K); ctx.lineTo(24 * K, 88 * K); ctx.fill();
      text(pg.level.toFixed(1), 28, 89, C.white, 7.2);
      const rd = c?.reading ?? s.splShown; const dy = Math.max(-38, Math.min(38, (rd - pg.level) * 4));
      ctx.fillStyle = '#9ee05a'; ctx.fillRect(14 * K, (86 - dy) * K, 8 * K, 1.5 * K);
      text('SPL:', 92, 74, C.white, 13, { align: 'center', bold: true, sy: 1.2 });
      text(rd.toFixed(1), 92, 93, C.white, 13, { align: 'center', bold: true, sy: 1.2 });
      if (c) text(c.status === 'stab' ? tr('Calibrando') + '...' : tr(c.msg), 92, 106, c.status === 'fail' ? '#ff6050' : '#9ee05a', 6.6, { align: 'center' });
      rrect(58, 113, 62, 12, 2, C.sel, '#bfe6ff'); text(tr('Calibrar'), 89, 122, '#fff', 7.4, { align: 'center' });
    }
  }
  function about() {
    streaky(1, 1, 126, 158, '#c8e8f6', '#ffffff');
    text('DoseMax', 64, 30, '#1838a0', 21, { align: 'center', bold: true });
    ['Version:', 'DoseMax 1.0.2', 'Nov 12 2026', '', 'Serial:', '200101003018', '', 'IEC 60651:1979', 'ANSI S1.25-1991', 'IEC 61252:2002', 'IEC 61260:2014']
      .forEach((l, i) => l && text(l, 10, 50 + i * 8.6, '#2c4cc0', 7.2));
  }
  function bootScreen() {
    streaky(1, 1, 126, 158, '#c4e6f6', '#ffffff');
    text('DoseMax', 64, 88, '#1a3a9a', 22, { align: 'center', bold: true });
  }

  function draw(s, core) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (s.power === 'off' || s.displayOff) return;
    if (s.power === 'boot') { bootScreen(); return finish(s); }
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
    if (s.msg) { rrect(10, 66, 108, 22, 3, '#0a1430', '#9ad0ff'); text(s.msg.text, 64, 80, '#fff', 7.2, { align: 'center' }); }
    finish(s);
  }
  function finish(s) {
    const b = s.settings.brightness; if (b < 10) { ctx.fillStyle = `rgba(0,0,0,${(10 - b) * 0.065})`; ctx.fillRect(0, 0, W, H); }
  }
  return { canvas, draw };
}
