// Leiaute das máquinas e fontes de ruído — dono: MÁQUINAS (pode mover/acrescentar; manter os campos).
// Mundo: metros, y para cima. Trabalhadora em (0,0,0) olhando para +x; painel CNC à frente dela (x≈0,6).
// Lado direito dela = +z (lado visto na foto). O galpão se estende para −z (fundo) e −x.
// Lw = potência sonora ponderada A (dB(A)); spectrum = forma relativa por oitava 63…8k (dB, Z); Q = diretividade (2 = sobre o piso).
export const MACHINES = [
  { id: 'prensa1', kind: 'press', name: 'Prensa excêntrica 80 t (posto)', pos: [-1.3, 0, -1.95], rotY: 0.5, Lw: 102, Q: 2, spm: 40,
    spectrum: [-6, -3, -1, 0, -2, -4, -7, -12], running: true },
  { id: 'painel1', kind: 'panel', name: 'Painel CNC da prensa', pos: [0.51, 0, 0.05], rotY: -Math.PI / 2 + 0.14, Lw: 72, Q: 2,
    spectrum: [-2, -4, -8, -10, -12, -14, -18, -24], running: true },
  { id: 'prensa2', kind: 'press', name: 'Prensa excêntrica 60 t', pos: [-2.4, 0, -5.2], rotY: Math.PI / 2, Lw: 98, Q: 2, spm: 35,
    spectrum: [-6, -3, -1, 0, -2, -4, -7, -12], running: true },
  { id: 'prensa3', kind: 'press', name: 'Prensa excêntrica 60 t', pos: [-2.4, 0, -9.6], rotY: Math.PI / 2, Lw: 98, Q: 2, spm: 30,
    spectrum: [-6, -3, -1, 0, -2, -4, -7, -12], running: true },
  { id: 'prensa4', kind: 'press', name: 'Prensa hidráulica 150 t', pos: [-6.8, 0, -4.0], rotY: 0, Lw: 94, Q: 2, spm: 12,
    spectrum: [-2, -2, -3, -4, -6, -8, -11, -16], running: true },
  { id: 'esmeril1', kind: 'grinder', name: 'Esmerilhamento (faíscas)', pos: [-0.22, 0, -10.1], rotY: Math.PI / 2, Lw: 102, Q: 2,
    spectrum: [-18, -14, -10, -6, -3, 0, -1, -4], running: true },
  { id: 'compressor', kind: 'compressor', name: 'Compressor / ar comprimido', pos: [-9.5, 0, -16], rotY: 0, Lw: 96, Q: 2,
    spectrum: [-4, -3, -4, -5, -5, -4, -3, -6], running: true },
  { id: 'exaustor', kind: 'fan', name: 'Exaustor de telhado', pos: [-4, 8.6, -8], rotY: 0, Lw: 88, Q: 1,
    spectrum: [-3, -2, -3, -5, -8, -11, -15, -20], running: true },
];
// Constante acústica do galpão (≈ 40 × 36 × 9 m, α médio 0,12): R = S·α/(1−α)
export const ROOM_ACOUSTICS = { S: 4250, alpha: 0.12 };
