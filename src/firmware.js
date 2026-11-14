// Firmware do DoseMax — dono: FIRMWARE. API (docs/CONTRACT.md): createFirmware({app, getInput}) →
// {canvas (512×640), dirty, state, press(key, holdMs), update(dtReal), feed(L|null, dtSim, clock), setClock(sec), quickStart(), results(), on(ev, fn)}.
// Lógica pura em fw_core.js (testes: node tools/fw_test.mjs); visor em lcd.js.
import { createCore } from './fw_core.js';
import { createLCD } from './lcd.js';

export function createFirmware({ app, getInput } = {}) {
  const core = createCore({ getInput });
  const lcd = createLCD();
  let drawnRev = -1, sinceDraw = 1, prevPower = core.state.power, offT = null; // offT: transição de desligar (s)
  const OFF_S = 0.9;
  const fw = {
    canvas: lcd.canvas, nativeCanvas: lcd.native, backlight: () => lcd.backlight, dirty: true, state: core.state, core,
    press: (key, holdMs = 0) => { const was = core.state.power; core.press(key, holdMs); if (was !== 'off' && core.state.power === 'off') { offT = 0; prevPower = 'off'; } redraw(true); },
    update(dt) {
      core.update(dt); sinceDraw += dt || 0;
      const pw = core.state.power;
      if (pw !== prevPower) { offT = pw === 'off' && prevPower !== 'off' ? 0 : null; prevPower = pw; }
      if (offT !== null) { offT += dt || 0; if (offT >= OFF_S) offT = null; if (sinceDraw >= 1 / 30 || offT === null) redraw(); return; }
      if (pw === 'boot') { if (sinceDraw >= 1 / 30) redraw(); return; }               // abertura animada
      if (core.state.rev !== drawnRev && sinceDraw >= 1 / 15) redraw();
    },
    feed: (L, dt, clock) => core.feed(L, dt, clock),
    setClock: (sec) => core.setClock(sec),
    quickStart() { core.quickStart(); redraw(true); },
    results: () => core.results(),
    on: (ev, fn) => core.on(ev, fn),
  };
  function redraw() { lcd.draw(core.state, core, offT !== null ? { off: offT / OFF_S } : {}); drawnRev = core.state.rev; sinceDraw = 0; fw.dirty = true; }
  core.on('beep', (k) => app?.audio?.beep?.(k));
  core.on('change', () => app?.emit?.('change'));
  redraw();
  return fw;
}
