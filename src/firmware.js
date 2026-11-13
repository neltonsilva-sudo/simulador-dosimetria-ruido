// Firmware do DoseMax — dono: FIRMWARE. API (docs/CONTRACT.md): createFirmware({app, getInput}) →
// {canvas (512×640), dirty, state, press(key, holdMs), update(dtReal), feed(L|null, dtSim, clock), setClock(sec), quickStart(), results(), on(ev, fn)}.
// Lógica pura em fw_core.js (testes: node tools/fw_test.mjs); visor em lcd.js.
import { createCore } from './fw_core.js';
import { createLCD } from './lcd.js';

export function createFirmware({ app, getInput } = {}) {
  const core = createCore({ getInput });
  const lcd = createLCD();
  let drawnRev = -1, sinceDraw = 1;
  const fw = {
    canvas: lcd.canvas, dirty: true, state: core.state, core,
    press: (key, holdMs = 0) => { core.press(key, holdMs); redraw(true); },
    update(dt) {
      core.update(dt); sinceDraw += dt || 0;
      if (core.state.rev !== drawnRev && sinceDraw >= 1 / 15) redraw();
    },
    feed: (L, dt, clock) => core.feed(L, dt, clock),
    setClock: (sec) => core.setClock(sec),
    quickStart() { core.quickStart(); redraw(true); },
    results: () => core.results(),
    on: (ev, fn) => core.on(ev, fn),
  };
  function redraw() { lcd.draw(core.state, core); drawnRev = core.state.rev; sinceDraw = 0; fw.dirty = true; }
  core.on('beep', (k) => app?.audio?.beep?.(k));
  core.on('change', () => app?.emit?.('change'));
  redraw();
  return fw;
}
