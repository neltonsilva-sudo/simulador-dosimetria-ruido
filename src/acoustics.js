// Modelo acústico do galpão — dono: ORQUESTRADOR. Puro (aceita {x,y,z} ou arrays).
// Campo direto + reverberante (Sabine): Lp = Lw + 10·log10( Q/(4π r²) + 4/R ).
import { MACHINES, ROOM_ACOUSTICS } from './layout_machines.js';
import { OCTAVES, A_WEIGHT, sumDb } from './dosimetry.js';

const R = (ROOM_ACOUSTICS.S * ROOM_ACOUSTICS.alpha) / (1 - ROOM_ACOUSTICS.alpha);
const P = (p) => (Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : p);

/** Nível de cada fonte no ponto (dB(A)). running: map id→bool opcional (padrão: campo running). */
export function sourceLevels(point, running = {}) {
  const p = P(point);
  return MACHINES.map((m) => {
    const on = running[m.id] ?? m.running; if (!on) return { id: m.id, L: -Infinity };
    // centro acústico ~1,2 m acima do piso (cabeçote/acionamento), exceto fontes elevadas
    const s = P(m.pos), sy = s.y > 0.5 ? s.y : 1.2;
    const r2 = Math.max(0.25, (p.x - s.x) ** 2 + (p.y - sy) ** 2 + (p.z - s.z) ** 2);
    return { id: m.id, L: m.Lw + 10 * Math.log10((m.Q || 2) / (4 * Math.PI * r2) + 4 / R) };
  });
}
/** Nível total dB(A) no ponto. */
export function levelAt(point, running) { return sumDb(sourceLevels(point, running).map((s) => s.L)); }
/** Espectro em oitavas (dB Z por banda, 63…8k) no ponto — para as telas "Espectro"/"Oitavas" do DoseMax. */
export function spectrumAt(point, running) {
  const per = sourceLevels(point, running);
  return OCTAVES.map((_, b) => sumDb(per.map((s, i) => {
    const m = MACHINES[i]; if (!isFinite(s.L)) return -Infinity;
    // distribui o nível A da fonte pela forma espectral e remove a ponderação A (→ Z)
    const shape = m.spectrum, shapeA = sumDb(shape.map((v, k) => v + A_WEIGHT[k]));
    return s.L + shape[b] - shapeA;
  })));
}
export const ROOM_CONSTANT = R;
