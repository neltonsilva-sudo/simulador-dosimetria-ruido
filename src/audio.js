// Áudio procedural espacializado (WebAudio + PannerNode HRTF) — dono: ÁUDIO.
// Sem arquivos: ruídos sintetizados. Golpe da prensa em machines.onStroke; tom de 1 kHz do calibrador; bipes do dosímetro.
import { MACHINES } from './layout_machines.js';

export function createAudio(stage, app) {
  let ctx = null, master = null, muffle = null, started = false, muted = false;
  const voices = {}; let toneOsc = null, toneGain = null;

  function noiseBuffer(sec = 2, color = 'white') {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  function loop(buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
  function panner(pos) {
    const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 0.9; p.maxDistance = 80;
    p.positionX.value = pos[0]; p.positionY.value = pos[1] > 0.5 ? pos[1] : 1.2; p.positionZ.value = pos[2]; return p;
  }
  const db = (L) => Math.pow(10, (L - 100) / 20); // ganho relativo (Lw 100 → 1)

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.55;
    muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 18000;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(muffle).connect(comp).connect(ctx.destination);
    const white = noiseBuffer(2, 'white'), brown = noiseBuffer(3, 'brown');
    // ambiente reverberante do galpão (ruído marrom baixo)
    const amb = loop(brown), ag = ctx.createGain(); ag.gain.value = 0.10; const alp = ctx.createBiquadFilter(); alp.type = 'lowpass'; alp.frequency.value = 400;
    amb.connect(alp).connect(ag).connect(master);
    for (const m of MACHINES) {
      const out = ctx.createGain(); out.gain.value = 0; const pn = panner(m.pos); out.connect(pn).connect(master);
      const v = { m, out, level: db(m.Lw) };
      if (m.kind === 'press') { // volante/motor: ronco + harmônico
        const s = loop(brown), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; const g = ctx.createGain(); g.gain.value = 0.5;
        s.connect(f).connect(g).connect(out);
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 29 + Math.random() * 4; const og = ctx.createGain(); og.gain.value = 0.05; const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 160;
        o.connect(of).connect(og).connect(out); o.start();
        v.hit = () => { // golpe: transiente metálico + baque grave
          const t = ctx.currentTime, s2 = ctx.createBufferSource(); s2.buffer = white; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 900; bp.Q.value = 1.4;
          const g2 = ctx.createGain(); g2.gain.setValueAtTime(1.6, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          s2.connect(bp).connect(g2).connect(out); s2.start(t, Math.random()); s2.stop(t + 0.4);
          const th = ctx.createOscillator(); th.frequency.setValueAtTime(90, t); th.frequency.exponentialRampToValueAtTime(38, t + 0.25);
          const tg = ctx.createGain(); tg.gain.setValueAtTime(1.4, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.3); th.connect(tg).connect(out); th.start(t); th.stop(t + 0.32);
        };
        v.period = 60 / (m.spm || 30); v.next = Math.random() * v.period;
      } else if (m.kind === 'grinder') {
        const s = loop(white), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.8; const g = ctx.createGain(); g.gain.value = 0.7;
        s.connect(f).connect(g).connect(out);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35; const lg = ctx.createGain(); lg.gain.value = 0.35; lfo.connect(lg).connect(g.gain); lfo.start();
      } else if (m.kind === 'compressor') {
        const s = loop(white), f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = ctx.createGain(); g.gain.value = 0.35; s.connect(f).connect(g).connect(out);
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 24; const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 120; const og = ctx.createGain(); og.gain.value = 0.15; o.connect(of).connect(og).connect(out); o.start();
      } else if (m.kind === 'fan') {
        const s = loop(brown), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 180; f.Q.value = 0.7; s.connect(f).connect(out);
      } else { // painel: zumbido elétrico 120 Hz
        const o = ctx.createOscillator(); o.frequency.value = 120; const og = ctx.createGain(); og.gain.value = 0.25; o.connect(og).connect(out); o.start();
      }
      voices[m.id] = v;
    }
    app.machines?.onStroke?.((id) => { const v = voices[id]; if (v?.hit && v.on) { v.hit(); v.external = true; } });
    setRunning(app.running?.() || {});
  }

  function setRunning(map) {
    if (!ctx) return;
    for (const id in voices) { const v = voices[id]; v.on = map[id] ?? true; v.out.gain.setTargetAtTime(v.on ? v.level : 0, ctx.currentTime, 0.6); }
  }
  const api = {
    start() { if (!ctx) build(); ctx.resume?.(); started = true; },
    get started() { return started; },
    setMuted(b) { muted = b; if (master) master.gain.setTargetAtTime(b ? 0 : 0.55, ctx.currentTime, 0.05); },
    get muted() { return muted; },
    setRunning,
    setEarplugs(b) { if (muffle) muffle.frequency.setTargetAtTime(b ? 900 : 18000, ctx.currentTime, 0.1); },
    tone(on, level = 114) {
      if (!ctx) return;
      if (on && !toneOsc) { toneOsc = ctx.createOscillator(); toneOsc.frequency.value = 1000; toneGain = ctx.createGain(); toneGain.gain.value = 0;
        toneOsc.connect(toneGain).connect(master); toneOsc.start(); }
      if (toneGain) toneGain.gain.setTargetAtTime(on ? (level >= 110 ? 0.08 : 0.016) : 0, ctx.currentTime, 0.05);
    },
    beep(kind = 'key') {
      if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = kind === 'ok' ? 2400 : kind === 'err' ? 600 : 3100;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'key' ? 0.05 : 0.18));
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.2);
    },
    update(dt) {
      if (!ctx || !started) return;
      const c = stage.camera, L = ctx.listener, p = c.position; const f = c.getWorldDirection(new stage.THREE.Vector3());
      if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
      else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
      for (const id in voices) { const v = voices[id]; if (!v.hit || v.external || !v.on) continue; v.next -= dt; if (v.next <= 0) { v.next += v.period; v.hit(); } }
    },
  };
  // primeiro gesto do usuário libera o áudio
  const unlock = () => { api.start(); removeEventListener('pointerdown', unlock); };
  addEventListener('pointerdown', unlock);
  app.fw?.on?.('beep', (k) => api.beep(k));
  return api;
}
