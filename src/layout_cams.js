// Câmeras, pontos de cena e geometria do galpão — dono: CENÁRIO.
// Mundo: metros, y para cima. Trabalhadora em (0,0,0) olhando +x; o lado direito dela (+z) é o que aparece na foto.
// Galpão se estende para −z (fundo) e −x. Cada vista pode ter `focus` (ponto [x,y,z] do foco do DOF) e `dof`
// (abertura relativa: 0 = sem desfoque, 1 = apresentação de produto). stage.setFocus() sobrepõe o foco da vista.
export const CAMS = {
  // Enquadramento da foto 2 (1264×843, 3:2): de frente-direita dela, perto da altura dos olhos, painel na borda direita,
  // prensa grande atrás à esquerda, galpão profundo ao centro, claraboias no alto à direita.
  ref: { pos: [0.34, 1.34, 1.6], target: [0.2, 1.37, -0.03], fov: 32, focus: [0.08, 1.6, 0.06], dof: 0.42 },
  overview: { pos: [8.2, 5.6, 5.8], target: [-3.5, 1.0, -7.5], fov: 52, dof: 0 },
  station: { pos: [2.1, 1.65, 2.6], target: [-0.1, 1.15, -0.2], fov: 40, focus: [0.1, 1.3, 0.0], dof: 0.15 },
  // close-up do ombro ESQUERDO (lado da prensa = lado mais exposto) para mostrar o dosímetro instalado
  // (enquadra aparelho + orelha/capacete; foco entre microfone e orelha, fundo desfocado)
  shoulder: { pos: [0.48, 1.5, -0.8], target: [0.02, 1.39, -0.1], fov: 32, focus: [0.04, 1.4, -0.11], dof: 0.5 },
};
// Bancada/carrinho do técnico com a maleta do kit (dosímetro + calibrador). Tampo a TABLE.h do piso.
export const TABLE = { pos: [2.35, 0, 1.75], rotY: -0.5, h: 0.9 };
// Pose de apresentação: o aparelho flutua à frente da câmera (vitrine de produto), fundo desfocado.
export const PRESENT = {
  cam: { pos: [2.35, 1.45, 2.65], target: [2.35, 1.30, 1.95], fov: 30, focus: [2.35, 1.30, 2.05], dof: 1 },
  device: { pos: [2.35, 1.30, 2.05], rotY: 0 },   // tela voltada para a câmera (+z)
  calibrator: { pos: [2.62, 1.22, 2.0], rotY: -0.25 },
};

// Geometria do galpão (CENÁRIO). Dois vãos com tesouras, pilares a cada BAY m ao longo de z.
// Vão A (esquerdo) x∈[-26,-12], vão B (posto) x∈[-12,10]. Cumeeira de cada vão no centro com lanternim.
export const HALL = {
  x0: -26, x1: 10, z0: -35, z1: 7,
  eave: 8.4,           // altura do banzo inferior / beiral
  rise: 1.7,           // subida até a cumeeira
  bay: 6, frames: [7, 1, -5, -11, -17, -23, -29, -35],
  spans: [{ a: -26, b: -12 }, { a: -12, b: 10 }],
  // faixas de telha translúcida (eixo x central, meia-largura) — correm ao longo de z
  skylights: [
    { x: 3.2, hw: 0.55 }, { x: 7.0, hw: 0.55 }, { x: -5.2, hw: 0.55 }, { x: -1.0, hw: 0.8, lantern: true },
    { x: -15.4, hw: 0.5 }, { x: -22.6, hw: 0.5 }, { x: -19.0, hw: 0.7, lantern: true },
  ],
  // direção para o "céu" (luz que entra pelas claraboias), normalizada no uso
  sun: [0.42, 1.0, 0.18],
};
