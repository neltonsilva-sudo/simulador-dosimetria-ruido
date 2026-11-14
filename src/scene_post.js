// Pós-processamento do palco (CENÁRIO): cena HDR + profundidade → GTAO (meia resolução) → neblina de altura analítica +
// feixes volumétricos das claraboias (raymarch em meia resolução, oclusão pela profundidade) → bokeh DOF (meia resolução,
// "scatter-as-gather") → bloom em pirâmide (só fontes muito claras) → AgX + gradação fotográfica + vinheta + aberração
// cromática → SMAA → grão fino. Tudo dentro de um EffectComposer.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { HALL } from './layout_cams.js';

const VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const LAYER_MASK = 5;

const COMMON = /* glsl */`
uniform mat4 projInv; uniform mat4 camWorld; uniform vec3 camPos; uniform float cNear; uniform float cFar;
vec3 viewPosAt(vec2 uv, float d){ vec4 c = vec4(uv*2.0-1.0, d*2.0-1.0, 1.0); vec4 v = projInv*c; return v.xyz/v.w; }
float ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

function mat(frag, uniforms, defines = {}) {
  return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, defines, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
}

// ───────────────────────── shaders ─────────────────────────
const SKY = HALL.skylights;
const BEAMS_FRAG = /* glsl */`
${COMMON}
uniform sampler2D tDepth; uniform vec2 res; uniform float time; uniform vec3 sunDir; uniform float beamDens; uniform vec3 beamCol;
uniform vec4 strips[${SKY.length}];
varying vec2 vUv;
float h3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float roofY(float x){ // altura do telhado (vãos com cumeeira no centro)
  float xc = x < -12.0 ? -19.0 : -1.0; float hw = x < -12.0 ? 7.0 : 11.0;
  return ${HALL.eave.toFixed(2)} + ${HALL.rise.toFixed(2)} * (1.0 - clamp(abs(x - xc)/hw, 0.0, 1.0)); }
float lit(vec3 p){
  if (p.y > 9.9) return 0.0;
  float tt = (${(HALL.eave + HALL.rise * 0.6).toFixed(2)} - p.y) / sunDir.y; vec3 q = p + sunDir * tt;
  float s = 0.0;
  for (int i = 0; i < ${SKY.length}; i++) { vec4 st = strips[i]; s += smoothstep(st.y + 0.12, st.y - 0.12, abs(q.x - st.x)) * st.z; }
  // tesouras e terças cortam o feixe em fatias; fora do galpão nada
  float fz = fract((q.z - 1.0) / 6.0); s *= smoothstep(0.02, 0.07, fz) * smoothstep(0.98, 0.93, fz);
  float pz = fract((q.z - 1.0) / 1.5); s *= 0.72 + 0.28 * smoothstep(0.04, 0.12, pz) * smoothstep(0.96, 0.88, pz);
  s *= step(${HALL.z0.toFixed(1)}, q.z) * step(q.z, ${HALL.z1.toFixed(1)});
  return s;
}
void main(){
  float d = texture2D(tDepth, vUv).x;
  vec3 vp = viewPosAt(vUv, d); vec3 wp = (camWorld * vec4(vp, 1.0)).xyz;
  vec3 rd = wp - camPos; float L = length(rd); rd /= max(L, 1e-4); L = min(L, 46.0);
  const int N = 22; float st = L / float(N); float j = ign(gl_FragCoord.xy + fract(time*7.31)*37.0);
  vec3 acc = vec3(0.0); float trans = 1.0;
  for (int i = 0; i < N; i++) {
    float t = (float(i) + j) * st; vec3 p = camPos + rd * t;
    float b = lit(p);
    if (b > 0.0) {
      float n = vn(p * vec3(0.55, 0.32, 0.55) + vec3(0.0, -time*0.05, time*0.03)) * 0.75 + vn(p*1.9 + time*0.08) * 0.35;
      float dens = beamDens * b * (0.35 + n) * (0.55 + 0.45 * smoothstep(0.0, 6.0, p.y));
      acc += dens * st * trans; trans *= exp(-dens * st * 0.02);
    }
  }
  float ph = 0.55 + 1.1 * pow(max(dot(rd, sunDir) * -1.0 + 1.0, 0.0) * 0.5, 2.0); // leve espalhamento frontal
  gl_FragColor = vec4(acc * beamCol * ph, 1.0);
}`;

const COMPOSE_A = /* glsl */`
${COMMON}
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tAO; uniform sampler2D tBeams; uniform sampler2D tMask;
uniform vec2 res; uniform vec2 halfTexel; uniform float aoAmt; uniform float useAO; uniform float useMask; uniform float useBeams;
uniform float fogDens; uniform float fogK; uniform vec3 fogCool; uniform vec3 fogWarm; uniform vec3 sunDir; uniform vec3 backDir;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(tColor, vUv); float d = texture2D(tDepth, vUv).x;
  vec3 vp = viewPosAt(vUv, d); float dist = d >= 1.0 ? 80.0 : length(vp);
  vec3 col = c.rgb;
  if (useAO > 0.5) {
    float ao = texture2D(tAO, vUv).r; ao = mix(1.0, pow(ao, 1.6), aoAmt);
    if (useMask > 0.5) { float m = texture2D(tMask, vUv).r; if (m > 0.0 && abs(m - dist) < 0.05 * dist + 0.02) ao = 1.0; }
    col *= ao;
  }
  // neblina de altura analítica (mais densa junto ao telhado: fumaça/óleo em suspensão)
  vec3 wp = (camWorld * vec4(vp, 1.0)).xyz; vec3 rd = normalize(wp - camPos); float L = min(dist, 80.0);
  float ry = rd.y * fogK; float base = fogDens * exp(fogK * (camPos.y - 1.5));
  float optical = abs(ry) > 1e-4 ? base * (exp(ry * L) - 1.0) / ry : base * L;
  float T = exp(-optical);
  float mu = dot(rd, normalize(backDir)); float warmW = 0.35 + 0.65 * smoothstep(-0.2, 0.9, mu) + 0.5 * smoothstep(0.3, 0.95, dot(rd, sunDir));
  vec3 inscat = mix(fogCool, fogWarm, clamp(warmW * 0.6, 0.0, 1.0)) * (0.75 + 0.5 * warmW);
  col = col * T + inscat * (1.0 - T);
  if (useBeams > 0.5) {
    vec3 b = texture2D(tBeams, vUv).rgb * 0.4;
    b += texture2D(tBeams, vUv + vec2( halfTexel.x,  halfTexel.y)).rgb * 0.15;
    b += texture2D(tBeams, vUv + vec2(-halfTexel.x,  halfTexel.y)).rgb * 0.15;
    b += texture2D(tBeams, vUv + vec2( halfTexel.x, -halfTexel.y)).rgb * 0.15;
    b += texture2D(tBeams, vUv + vec2(-halfTexel.x, -halfTexel.y)).rgb * 0.15;
    col += b;
  }
  gl_FragColor = vec4(col, dist);
}`;

const DOF_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; uniform float focus; uniform float amount; uniform float maxR; uniform float nearK;
varying vec2 vUv;
const float GOLDEN = 2.39996323;
float cs(float d){ return clamp(amount * abs(d - focus) / max(d, 0.05) * (d < focus ? nearK : 1.0), 0.0, maxR); }
void main(){
  vec4 c = texture2D(tSrc, vUv); float cd = c.a; float csz = cs(cd);
  vec3 acc = c.rgb; float tot = 1.0; float r = 0.6; float ang = fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;
  for (int i = 0; i < 170; i++) {
    if (r >= maxR) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * r;
    vec4 s = texture2D(tSrc, tc); float ssz = cs(s.a);
    if (s.a > cd) ssz = clamp(ssz, 0.0, csz * 2.0);
    float m = smoothstep(r - 0.5, r + 0.5, ssz);
    acc += mix(acc / tot, min(s.rgb, vec3(40.0)), m); tot += 1.0;
    r += 0.62 / r; ang += GOLDEN;
  }
  gl_FragColor = vec4(acc / tot, csz);
}`;

const BLOOM_PRE = /* glsl */`
uniform sampler2D tSrc; uniform sampler2D tMask; uniform vec2 texel; uniform float thr; uniform float knee; uniform float useMask;
varying vec2 vUv;
vec3 pf(vec2 uv){ vec4 s = texture2D(tSrc, uv); vec3 c = min(s.rgb, vec3(80.0));
  if (useMask > 0.5) { float m = texture2D(tMask, uv).g; if (m > 0.0 && abs(m - s.a) < 0.05 * s.a + 0.02) c *= 0.0; }
  float br = max(c.r, max(c.g, c.b)); float soft = clamp(br - thr + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4);
  return c * max(soft, br - thr) / max(br, 1e-4); }
void main(){ vec2 o = texel * 0.5;
  gl_FragColor = vec4((pf(vUv + vec2(-o.x,-o.y)) + pf(vUv + vec2(o.x,-o.y)) + pf(vUv + vec2(-o.x,o.y)) + pf(vUv + vec2(o.x,o.y))) * 0.25, 1.0); }`;
const BLOOM_DOWN = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
void main(){ vec2 o = texel; vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + vec2(-o.x,-o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x,-o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x,o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x,o.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0); }`;
const BLOOM_UP = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; uniform float w; varying vec2 vUv;
void main(){ vec2 o = texel; vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += (texture2D(tSrc, vUv + vec2(-o.x,0)).rgb + texture2D(tSrc, vUv + vec2(o.x,0)).rgb + texture2D(tSrc, vUv + vec2(0,-o.y)).rgb + texture2D(tSrc, vUv + vec2(0,o.y)).rgb) * 2.0;
  c += texture2D(tSrc, vUv + vec2(-o.x,-o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x,-o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x,o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x,o.y)).rgb;
  gl_FragColor = vec4(c / 16.0 * w, 1.0); }`;

const COMPOSE_B = /* glsl */`
uniform sampler2D tA; uniform sampler2D tDof; uniform sampler2D tBloom; uniform vec2 res;
uniform float useDof; uniform float focus; uniform float amountFull; uniform float nearK; uniform vec2 dofTexel; uniform float bloomAmt; uniform float exposure;
uniform float ca; uniform float vign; uniform float sat; uniform float contrast; uniform vec3 liftC; uniform vec3 gainC; uniform float tmo;
varying vec2 vUv;
vec3 agxC(vec3 x){ vec3 x2 = x*x; vec3 x4 = x2*x2; return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
vec3 agx(vec3 color){
  const mat3 S2R = mat3(vec3(0.6274,0.0691,0.0164), vec3(0.3293,0.9195,0.0880), vec3(0.0433,0.0113,0.8956));
  const mat3 R2S = mat3(vec3(1.6605,-0.1246,-0.0182), vec3(-0.5876,1.1329,-0.1006), vec3(-0.0728,-0.0083,1.1187));
  const mat3 INS = mat3(vec3(0.856627153315983,0.137318972929847,0.11189821299995), vec3(0.0951212405381588,0.761241990602591,0.0767994186031903), vec3(0.0482516061458583,0.101439036467562,0.811302368396859));
  const mat3 OUTS = mat3(vec3(1.1271005818144368,-0.1413297634984383,-0.14132976349843826), vec3(-0.11060664309660323,1.157823702216272,-0.11060664309660294), vec3(-0.016493938717834573,-0.016493938717834257,1.2519364065950405));
  color = S2R * color; color = INS * color; color = max(color, 1e-10); color = log2(color);
  color = (color + 12.47393) / (4.026069 + 12.47393); color = clamp(color, 0.0, 1.0); color = agxC(color);
  color = OUTS * color; color = pow(max(vec3(0.0), color), vec3(2.2)); color = R2S * color; return clamp(color, 0.0, 1.0); }
vec3 aces(vec3 c){ c *= 0.6; return clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 fetch(vec2 uv){
  vec4 a = texture2D(tA, uv);
  if (useDof > 0.5) {
    float sz = clamp(amountFull * abs(a.a - focus) / max(a.a, 0.05) * (a.a < focus ? nearK : 1.0), 0.0, 60.0);
    // Ampliação da meia resolução SENSÍVEL À PROFUNDIDADE: só pesam as amostras cujo desfoque (a = CoC em meia res.)
    // é parecido com o deste pixel — o fundo borrado não "puxa" a cor do objeto em foco (sem halo), e o objeto em foco
    // não é trocado pela versão borrada na borda (a mistura depende só do próprio CoC).
    vec2 o = dofTexel * clamp(sz * 0.2, 0.5, 2.6);
    vec4 t0 = texture2D(tDof, uv), t1 = texture2D(tDof, uv + vec2(o.x, o.y)), t2 = texture2D(tDof, uv - vec2(o.x, o.y)),
         t3 = texture2D(tDof, uv + vec2(o.x, -o.y)), t4 = texture2D(tDof, uv - vec2(o.x, -o.y));
    float k0 = 0.36 / (0.35 + abs(t0.a * 2.0 - sz)), k1 = 0.16 / (0.35 + abs(t1.a * 2.0 - sz)), k2 = 0.16 / (0.35 + abs(t2.a * 2.0 - sz)),
          k3 = 0.16 / (0.35 + abs(t3.a * 2.0 - sz)), k4 = 0.16 / (0.35 + abs(t4.a * 2.0 - sz));
    vec3 b = (t0.rgb * k0 + t1.rgb * k1 + t2.rgb * k2 + t3.rgb * k3 + t4.rgb * k4) / (k0 + k1 + k2 + k3 + k4);
    float m = smoothstep(0.6, 2.2, sz);
    a.rgb = mix(a.rgb, b, m);
  }
  return a.rgb;
}
void main(){
  vec2 cuv = vUv - 0.5; float r2 = dot(cuv, cuv);
  vec2 off = cuv * r2 * ca * 10.0 / res;
  vec3 col;
  if (ca > 0.0) { col.r = fetch(vUv - off).r; col.g = fetch(vUv).g; col.b = fetch(vUv + off).b; } else col = fetch(vUv);
  col += texture2D(tBloom, vUv).rgb * bloomAmt;
  col *= exposure;
  col = tmo > 0.5 ? aces(col) : agx(col);
  vec3 g = toSRGB(col);
  float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
  // gradação: sombras frias azul-esverdeadas, realces quentes, curva S de fotografia
  g += liftC * (1.0 - smoothstep(0.0, 0.55, l)) + gainC * smoothstep(0.45, 1.0, l);
  g = mix(g, g * g * (3.0 - 2.0 * g), contrast);
  l = dot(g, vec3(0.2126, 0.7152, 0.0722));
  g = mix(vec3(l), g, sat);
  float v = smoothstep(0.85, 0.18, length(cuv * vec2(1.0, 0.82)));
  g *= mix(1.0 - vign, 1.0, v);
  gl_FragColor = vec4(clamp(g, 0.0, 1.0), 1.0);
}`;

const GRAIN = /* glsl */`
uniform sampler2D tDiffuse; uniform float time; uniform float amt; uniform vec2 res; varying vec2 vUv;
float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; vec2 p = vUv * res + fract(time * 13.7) * 311.0;
  float n = (h(p) + h(p + 17.3) - 1.0); float l = dot(c, vec3(0.3, 0.59, 0.11));
  c += n * amt * (0.55 + 0.45 * (1.0 - abs(l * 2.0 - 1.0)));
  c += (h(p * 1.7 + 3.1) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0); }`;

// ───────────────────────── passe principal ─────────────────────────
class MainPass extends Pass {
  constructor(stage, P) {
    super(); this.stage = stage; this.P = P; this.needsSwap = true;
    const { renderer, scene, camera } = stage; this.renderer = renderer; this.scene = scene; this.camera = camera;
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.depthTex = new THREE.DepthTexture(4, 4, THREE.FloatType);
    this.sceneRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthTexture: this.depthTex, depthBuffer: true });
    this.aRT = new THREE.WebGLRenderTarget(4, 4, opt);
    this.beamRT = new THREE.WebGLRenderTarget(4, 4, opt);
    this.dofRT = new THREE.WebGLRenderTarget(4, 4, opt);
    this.maskRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.bloomRT = []; for (let i = 0; i < 6; i++) this.bloomRT.push(new THREE.WebGLRenderTarget(4, 4, opt));
    this.quad = new FullScreenQuad(null);
    const cam = () => ({ projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, cNear: { value: 0.05 }, cFar: { value: 200 } });
    this.camU = cam();
    const sun = new THREE.Vector3(...HALL.sun).normalize();
    this.beams = mat(BEAMS_FRAG, Object.assign(this.camU, {
      tDepth: { value: this.depthTex }, res: { value: new THREE.Vector2() }, time: { value: 0 }, sunDir: { value: sun },
      beamDens: { value: P.beamDens }, beamCol: { value: P.beamCol },
      strips: { value: HALL.skylights.map((s) => new THREE.Vector4(s.x, s.hw, s.lantern ? 1.2 : 1.0, 0)) },
    }));
    this.composeA = mat(COMPOSE_A, Object.assign({}, this.camU, {
      tColor: { value: this.sceneRT.texture }, tDepth: { value: this.depthTex }, tAO: { value: null }, tBeams: { value: this.beamRT.texture },
      tMask: { value: this.maskRT.texture }, res: { value: new THREE.Vector2() }, halfTexel: { value: new THREE.Vector2() },
      aoAmt: { value: P.ao }, useAO: { value: 1 }, useMask: { value: 0 }, useBeams: { value: 1 },
      fogDens: { value: P.fogDens }, fogK: { value: P.fogK }, fogCool: { value: P.fogCool }, fogWarm: { value: P.fogWarm },
      sunDir: { value: sun }, backDir: { value: new THREE.Vector3(0.15, 0.25, -1) },
    }));
    this.dof = mat(DOF_FRAG, { tSrc: { value: this.aRT.texture }, texel: { value: new THREE.Vector2() }, focus: { value: 2 }, amount: { value: 0 }, maxR: { value: 14 }, nearK: { value: 0.5 } });
    this.pre = mat(BLOOM_PRE, { tSrc: { value: this.aRT.texture }, tMask: { value: this.maskRT.texture }, texel: { value: new THREE.Vector2() }, thr: { value: P.bloomThr }, knee: { value: 1.5 }, useMask: { value: 0 } });
    this.down = mat(BLOOM_DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
    this.up = mat(BLOOM_UP, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, w: { value: 1 } });
    this.up.blending = THREE.AdditiveBlending; this.up.transparent = true;
    this.composeB = mat(COMPOSE_B, {
      tA: { value: this.aRT.texture }, tDof: { value: this.dofRT.texture }, tBloom: { value: this.bloomRT[0].texture }, res: { value: new THREE.Vector2() },
      useDof: { value: 0 }, focus: { value: 2 }, amountFull: { value: 0 }, nearK: { value: 0.5 }, dofTexel: { value: new THREE.Vector2() }, bloomAmt: { value: P.bloom }, exposure: { value: P.exposure },
      ca: { value: P.ca }, vign: { value: P.vignette }, sat: { value: P.sat }, contrast: { value: P.contrast },
      liftC: { value: P.lift }, gainC: { value: P.gain }, tmo: { value: 0 },
    });
    this.maskMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`#include <common>
#include <skinning_pars_vertex>
varying float vD; void main(){
#include <skinbase_vertex>
#include <begin_vertex>
#include <skinning_vertex>
#include <project_vertex>
vD = length(mvPosition.xyz); }`,
      fragmentShader: /* glsl */`uniform vec2 flags; varying float vD; void main(){ gl_FragColor = vec4(flags * vD, 0.0, 1.0); }`,
      uniforms: { flags: { value: new THREE.Vector2(1, 1) } },
    });
    this.maskCam = new THREE.PerspectiveCamera(); this.maskList = []; this.maskScanT = 0;
    this.gtao = new GTAOPass(scene, camera, 4, 4);
    this.gtao.output = GTAOPass.OUTPUT.Off;
    this.gtao.setGBuffer(this.depthTex);
    this.gtao.updateGtaoMaterial({ radius: P.aoRadius, distanceExponent: 1.6, thickness: 1.4, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.composeA.uniforms.tAO.value = this.gtao.gtaoMap;
    this.w = 4; this.h = 4; this.time = 0;
  }
  setSize(w, h) {
    this.w = w; this.h = h; const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    this.sceneRT.setSize(w, h); this.aRT.setSize(w, h);
    this.beamRT.setSize(hw, hh); this.dofRT.setSize(hw, hh); this.maskRT.setSize(hw, hh);
    this.gtao.setSize(hw, hh);
    let bw = hw, bh = hh; for (const rt of this.bloomRT) { rt.setSize(Math.max(2, bw), Math.max(2, bh)); bw >>= 1; bh >>= 1; }
    this.composeA.uniforms.res.value.set(w, h); this.composeA.uniforms.halfTexel.value.set(1 / hw, 1 / hh);
    this.beams.uniforms.res.value.set(hw, hh);
    this.dof.uniforms.texel.value.set(1 / hw, 1 / hh);
    this.pre.uniforms.texel.value.set(1 / w, 1 / h);
    this.composeB.uniforms.res.value.set(w, h); this.composeB.uniforms.dofTexel.value.set(1 / hw, 1 / hh);
  }
  scanMask() {
    this.maskList.length = 0;
    this.scene.traverse((o) => {
      if (!(o.isMesh || o.isSkinnedMesh)) return;
      let a = false, b = false; for (let p = o; p; p = p.parent) { a ||= !!p.userData?.noAO; b ||= !!p.userData?.noBloom; }
      if (a || b) { o.layers.enable(LAYER_MASK); o.userData._maskFlags = [a ? 1 : 0, b ? 1 : 0]; this.maskList.push(o); }
      else if (o.layers.isEnabled(LAYER_MASK)) o.layers.disable(LAYER_MASK);
    });
  }
  render(renderer, writeBuffer /*, readBuffer */) {
    const P = this.P, cam = this.camera, scene = this.scene;
    this.time += 1 / 60;
    cam.updateMatrixWorld();
    const U = this.camU; U.projInv.value.copy(cam.projectionMatrixInverse); U.camWorld.value.copy(cam.matrixWorld);
    U.camPos.value.setFromMatrixPosition(cam.matrixWorld); U.cNear.value = cam.near; U.cFar.value = cam.far;
    // 1) cena HDR
    renderer.setRenderTarget(this.sceneRT); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, cam);
    // 2) máscara noAO / noBloom (distância à câmera dos objetos marcados)
    if ((this.maskScanT -= 1) <= 0) { this.scanMask(); this.maskScanT = 60; }
    const useMask = this.maskList.length > 0;
    this.composeA.uniforms.useMask.value = useMask ? 1 : 0; this.pre.uniforms.useMask.value = useMask ? 1 : 0;
    if (useMask) {
      const mc = this.maskCam; mc.copy(cam, false); mc.layers.set(LAYER_MASK);
      const ov = scene.overrideMaterial, bg = scene.background; scene.overrideMaterial = this.maskMat; scene.background = null;
      const mm = this.maskMat;
      for (const o of this.maskList) { o.onBeforeRender = function () { mm.uniforms.flags.value.set(...this.userData._maskFlags); mm.uniformsNeedUpdate = true; }; }
      renderer.setRenderTarget(this.maskRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, mc);
      for (const o of this.maskList) o.onBeforeRender = THREE.Object3D.prototype.onBeforeRender;
      scene.overrideMaterial = ov; scene.background = bg;
    }
    // 3) GTAO meia resolução sobre a profundidade da cena
    const useAO = P.ao > 0 && P.quality !== 'low';
    this.composeA.uniforms.useAO.value = useAO ? 1 : 0;
    if (useAO) this.gtao.render(renderer, null, this.sceneRT);
    // 4) feixes volumétricos (meia resolução)
    const useBeams = P.beamDens > 0;
    this.composeA.uniforms.useBeams.value = useBeams ? 1 : 0;
    if (useBeams) { this.beams.uniforms.time.value = this.time; this.beams.uniforms.beamDens.value = P.beamDens; this.run(this.beams, this.beamRT); }
    // 5) composição HDR A (AO + neblina + feixes), alfa = distância
    const A = this.composeA.uniforms; A.fogDens.value = P.fogDens; A.aoAmt.value = P.ao;
    this.run(this.composeA, this.aRT);
    // 6) DOF
    const dof = this.stage._dof; const B = this.composeB.uniforms;
    const useDof = dof.amount > 0.002 && dof.dist > 0;
    B.useDof.value = useDof ? 1 : 0;
    if (useDof) {
      // amount em px (meia res) para "infinito"; escala com a altura da imagem
      const full = dof.amount * P.dofMax * (this.h / 720);
      this.dof.uniforms.focus.value = dof.dist; this.dof.uniforms.amount.value = full * 0.5; this.dof.uniforms.maxR.value = Math.min(18, Math.max(2, full * 0.5));
      B.focus.value = dof.dist; B.amountFull.value = full; B.nearK.value = this.dof.uniforms.nearK.value = P.dofNear ?? 0.5;
      this.run(this.dof, this.dofRT);
    }
    // 7) bloom em pirâmide
    this.pre.uniforms.thr.value = P.bloomThr;
    this.run(this.pre, this.bloomRT[0]);
    for (let i = 1; i < this.bloomRT.length; i++) {
      const s = this.bloomRT[i - 1]; this.down.uniforms.tSrc.value = s.texture; this.down.uniforms.texel.value.set(1 / s.width, 1 / s.height);
      this.run(this.down, this.bloomRT[i]);
    }
    for (let i = this.bloomRT.length - 2; i >= 0; i--) {
      const s = this.bloomRT[i + 1]; this.up.uniforms.tSrc.value = s.texture; this.up.uniforms.texel.value.set(1 / s.width, 1 / s.height);
      this.up.uniforms.w.value = 1.0; this.run(this.up, this.bloomRT[i], false);
    }
    // 8) composição B (DOF + bloom + CA + tonemap + gradação + vinheta) → writeBuffer (LDR, sRGB)
    B.bloomAmt.value = P.bloom; B.exposure.value = P.exposure; B.ca.value = P.ca; B.vign.value = P.vignette;
    B.sat.value = P.sat; B.contrast.value = P.contrast; B.tmo.value = P.tonemap === 'aces' ? 1 : 0;
    this.run(this.composeB, this.renderToScreen ? null : writeBuffer);
  }
  run(material, target, clear = true) {
    this.renderer.setRenderTarget(target); if (clear) { this.renderer.setClearColor(0, 0); this.renderer.clear(); }
    this.quad.material = material; this.quad.render(this.renderer);
  }
}

export function createPost(stage, P) {
  const { renderer } = stage;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
  const main = new MainPass(stage, P);
  composer.addPass(main);
  const smaa = new SMAAPass(4, 4); composer.addPass(smaa);
  const grain = new ShaderPass(new THREE.ShaderMaterial({ vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: GRAIN, uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amt: { value: P.grain }, res: { value: new THREE.Vector2() } } }));
  composer.addPass(grain);
  return {
    composer, main, smaa, grain,
    setSize(w, h, pr) { composer.setPixelRatio(pr); composer.setSize(w, h); grain.uniforms.res.value.set(w * pr, h * pr); },
    render(t) { grain.uniforms.time.value = t; grain.uniforms.amt.value = P.grain; smaa.enabled = P.smaa; composer.render(); },
  };
}
