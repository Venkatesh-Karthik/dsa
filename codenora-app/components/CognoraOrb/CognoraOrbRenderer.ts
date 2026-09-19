/**
 * Cognora Voice ORB WebGL 3D Procedural Renderer
 *
 * Tier 1 + Tier 2 + Tier 3 True 3D Liquid Glass Shader:
 * - Real-time Ray-marched Volumetric Glass Sphere
 * - 3D Surface Normal Perturbation & Organic Fluid Deformation
 * - Optical Fresnel Rim Refraction (Schlick's approximation)
 * - Luminous Internal Core & Volumetric Light Falloff
 * - Caustic Light Waves & Multi-layer Specular Highlights
 * - Soft Atmospheric Aura & Viewport Shadow
 * - DevicePixelRatio Retina Scaling
 * - Complete 2D Canvas fallback if WebGL is unavailable
 */

import {
  COGNORA_PALETTE,
  type OrbBaseState,
  type OrbShaderUniforms,
} from "./CognoraOrbState";

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision highp float;

varying vec2 v_uv;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_state; // 0=IDLE, 1=THINKING, 2=SPEAKING, 3=PAUSED, 4=COMPLETED, 5=ERROR, 6=VOICE_OFF
uniform float u_audio_energy;
uniform float u_audio_low;
uniform float u_audio_mid;
uniform float u_audio_high;
uniform float u_teaching_intensity;
uniform vec2 u_squish;
uniform vec2 u_drag_velocity;
uniform float u_reduced_motion;
uniform vec3 u_accent_color;
uniform vec3 u_core_color;
uniform vec3 u_aura_color;
uniform float u_tap_time;
uniform vec2 u_screen_pos;
uniform vec2 u_camera_parallax;

// High quality 3D Simplex noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
  // Normalize screen coordinates [-1.12, 1.12]
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
  uv *= 2.24;
  
  // Physical squish & stretch on drag/motion (volume preserving)
  vec2 squish = max(vec2(0.4), u_squish);
  vec2 p = uv / squish;
  float r = length(p);
  
  float t = u_time * (u_reduced_motion > 0.5 ? 0.25 : 0.85);
  
  // State dynamic factors
  float speedMult = u_state == 1.0 ? 1.8 : (u_state == 2.0 ? 1.4 : 0.75);
  float ampMult   = (u_state == 1.0 ? 1.35 : (u_state == 2.0 ? 1.20 : 1.0)) * (1.0 - u_reduced_motion * 0.7);
  
  // === ORGANIC ASYMMETRIC SILHOUETTE (Sections 4 & 5) ===
  // Multiple incommensurate harmonic periods + subtle natural fluid droplet gravity bias
  float theta = atan(p.y, p.x);
  float h1 = sin(theta * 2.0 + t * speedMult * 0.71) * 0.018;
  float h2 = cos(theta * 3.0 - t * speedMult * 0.49) * 0.012;
  float h3 = sin(theta * 5.0 + t * 0.83) * 0.006;
  float surfaceWave = sin(p.y * 2.4 + t * speedMult * 0.9) * cos(p.x * 2.4 - t * 0.65) * 0.012;
  float noiseDeform = snoise(vec3(p * 1.1, t * 0.32)) * 0.014;
  float audioWave = (u_audio_mid * 0.022 + u_audio_low * 0.016) * sin(theta * 4.0 + t * 2.2);
  float asymBias = sin(theta + 1.2) * 0.008; // Resting fluid droplet bias
  
  float totalDeform = (h1 + h2 + h3 + surfaceWave + noiseDeform + audioWave + asymBias) * ampMult;
  float deformedR = r - totalDeform;

  // Tactile optical tap ripple on click/tap (Section 32)
  if (u_tap_time < 1.2) {
    float tapRipple = sin(deformedR * 20.0 - u_tap_time * 14.0) * exp(-u_tap_time * 4.2) * 0.028 * smoothstep(1.1, 0.0, deformedR);
    deformedR += tapRipple;
  }
  
  // Soft viewport ambient depth shadow underneath (grounding the glass above canvas, Section 17)
  vec2 shadowCoord = (uv - vec2(0.0, -0.54) - u_drag_velocity * 0.05) / vec2(1.22, 0.34);
  float shadowDist = length(shadowCoord);
  float shadow = smoothstep(1.0, 0.15, shadowDist) * 0.10;
  
  // Subtle Atmospheric Aura (Cognora Sapphire, Section 18)
  float auraIntensity = 0.30;
  if (u_state == 1.0) auraIntensity = 0.48;
  if (u_state == 2.0) auraIntensity = 0.40 + u_audio_energy * 0.28;
  if (u_state == 3.0) auraIntensity = 0.18;
  if (u_state == 5.0) auraIntensity = 0.48;
  
  float auraDist = max(0.0, deformedR - 0.95);
  float aura = smoothstep(0.18, 0.0, auraDist) * auraIntensity;
  vec3 auraColor = vec3(0.14, 0.42, 0.96); // Cognora Sapphire
  if (u_state == 1.0) auraColor = vec3(0.26, 0.64, 1.0);
  if (u_state == 5.0) auraColor = vec3(0.95, 0.25, 0.25);
  
  // Outside the liquid glass body: only subtle aura and soft contact shadow (Section 16)
  if (deformedR > 1.0) {
    float a = clamp(aura * 0.55 + shadow * smoothstep(1.35, 1.0, deformedR), 0.0, 1.0);
    vec3 col = auraColor * aura + vec3(0.06, 0.09, 0.16) * shadow;
    gl_FragColor = vec4(col * a, a);
    return;
  }
  
  // === DEPTH REGION 1: FRONT GLASS SURFACE & CURVATURE (Sections 3 & 6) ===
  float z = sqrt(max(0.0, 1.0 - deformedR * deformedR));
  vec3 P_surf = vec3(p, z);
  vec3 N = normalize(P_surf);
  
  // Gentle normal wave perturbation for fluid curvature
  vec3 nWave = vec3(
    snoise(P_surf * 1.5 + vec3(t * 0.35, 0.0, 0.0)),
    snoise(P_surf * 1.5 + vec3(0.0, t * 0.35, 0.0)),
    0.0
  ) * 0.035 * ampMult;
  N = normalize(N + nWave);
  
  // Micro-parallax camera view ray (Sections 22 & 23)
  vec3 eyePos = vec3(u_camera_parallax.x * 2.8 + u_pointer.x * 0.14, u_camera_parallax.y * 2.8 + u_pointer.y * 0.14, 2.6);
  vec3 V = normalize(eyePos - P_surf);
  float NdotV = max(0.0, dot(N, V));
  
  // Dynamic Key Light Vector (moves with pointer + drag inertia)
  vec3 keyLightDir = normalize(vec3(
    -0.45 + u_pointer.x * 0.28 - u_drag_velocity.x * 0.06,
     0.55 + u_pointer.y * 0.28 - u_drag_velocity.y * 0.06,
     0.82
  ));
  
  // === SECTION 7: DIRECTIONAL FRESNEL RIM (NO 360 DEGREE WHITE RING) ===
  // Fresnel is modulated by directional light so it catches light naturally, not as a flat stroke
  float F0 = 0.045;
  float fresnel = F0 + (1.0 - F0) * pow(max(0.0, 1.0 - NdotV), 3.8);
  
  float rimDirFactor = max(0.0, dot(N, keyLightDir)) * 0.70 + 0.20;
  vec3 rimFresnelCol = mix(vec3(0.72, 0.84, 0.98), vec3(1.0), max(0.0, dot(N, keyLightDir)));
  vec3 rimLight = rimFresnelCol * (fresnel * rimDirFactor * 0.92);
  
  // === SECTION 6 & 19: GLASS THICKNESS MENISCUS & TANGENTIAL ABSORPTION ===
  float edgeMeniscus = smoothstep(0.78, 0.93, deformedR) * (1.0 - smoothstep(0.93, 0.985, deformedR));
  vec3 edgeAbsorption = vec3(0.05, 0.09, 0.20) * edgeMeniscus * 0.26;
  
  // === SECTION 14 & 15: SNELL REFRACTION OF COGNORA BACKGROUND DOT FIELD ===
  // Refracted rays with subtle chromatic dispersion
  vec3 refrRay  = refract(-V, N, 1.0 / 1.520);
  vec3 refrRayR = refract(-V, N, 1.0 / 1.505);
  vec3 refrRayB = refract(-V, N, 1.0 / 1.535);
  
  // Screen-space fragment coordinate in CSS pixels
  vec2 fragCssOffset = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) * (110.0 / u_resolution.x);
  vec2 unrefractedScreenPos = u_screen_pos + fragCssOffset;
  
  // Optical displacement through glass volume
  float lensDisp = z * 16.0;
  vec2 posR = unrefractedScreenPos + refrRayR.xy * lensDisp;
  vec2 posG = unrefractedScreenPos + refrRay.xy * lensDisp;
  vec2 posB = unrefractedScreenPos + refrRayB.xy * lensDisp;
  
  // Sample 24px dot grid for refraction
  float dotR = smoothstep(1.35, 0.65, length(mod(posR, 24.0) - 12.0));
  float dotG = smoothstep(1.35, 0.65, length(mod(posG, 24.0) - 12.0));
  float dotB = smoothstep(1.35, 0.65, length(mod(posB, 24.0) - 12.0));
  
  // Optical refraction absorption of dots through the glass volume (no white washout!)
  vec3 refractedDotAbsorption = vec3(0.08, 0.12, 0.22) * dotG * (0.20 + z * 0.35);
  
  // Crystal clear neutral glass transmission base
  vec3 glassBase = vec3(0.92, 0.95, 1.00) * (0.02 + z * 0.04);
  
  // === DEPTH REGION 2: 3D VOLUMETRIC LIVING LIGHT INTERIOR (Sections 9, 10, 11) ===
  // 3D Core Position: drifts organically in conceptual X, Y, and Z
  vec3 corePos = vec3(
    u_pointer.x * 0.25 + sin(t * 0.61) * 0.12 - u_drag_velocity.x * 0.05,
    u_pointer.y * 0.25 + cos(t * 0.47) * 0.10 - u_drag_velocity.y * 0.05,
    -0.22 + sin(t * 0.73) * 0.12
  );
  if (u_state == 1.0) { // Thinking: smooth 3D circulation
    corePos.x += cos(t * 2.4) * 0.18;
    corePos.y += sin(t * 2.4) * 0.18;
    corePos.z += sin(t * 1.8) * 0.12;
  }
  
  // Closest approach along refracted ray
  float tCore = clamp(dot(corePos - P_surf, refrRay), 0.0, 2.0 * z);
  vec3 pNearCore = P_surf + refrRay * tCore;
  float dCore = length(pNearCore - corePos);
  
  // Multi-tier volumetric light (illuminates surrounding glass, NOT a harsh white spot!)
  // 1. Soft crystal luminous nucleus (warm sky luminescence, not clipping white)
  float rNuc = 0.13 + u_audio_low * 0.06 + u_teaching_intensity * 0.05;
  float nucleus = exp(-pow(dCore / rNuc, 2.0) * 3.4);
  
  // 2. Cognora Sky & Sapphire volumetric scattering
  float rScatter = 0.40 + u_audio_energy * 0.16 + u_teaching_intensity * 0.12;
  float scattering = exp(-pow(dCore / rScatter, 1.8) * 2.0);
  
  // 3. Deep volume ambient glow
  float deepMantle = exp(-pow(dCore / 0.85, 1.6) * 1.4);
  
  // Caustic internal light filaments
  float caustics = pow(max(0.0, sin(pNearCore.x * 5.5 + pNearCore.z * 3.5 + t * 1.8) *
                                cos(pNearCore.y * 5.5 - pNearCore.z * 3.0 + t * 1.4)), 2.0)
                   * scattering * 0.35;
  
  // Cognora Palette Colors
  vec3 colDeepIndigo = vec3(0.16, 0.18, 0.72);
  vec3 colSapphire   = vec3(0.14, 0.42, 0.94);
  vec3 colSky        = vec3(0.24, 0.76, 0.98);
  vec3 colWarmCore   = vec3(0.90, 0.95, 1.00); // Luminous crystal soft core
  
  if (u_state == 5.0) { // Error
    colDeepIndigo = vec3(0.55, 0.08, 0.08);
    colSapphire   = vec3(0.92, 0.20, 0.20);
    colSky        = vec3(1.00, 0.58, 0.58);
  }
  
  // Volumetric internal light radiating through glass medium
  vec3 internalLight = colDeepIndigo * deepMantle * 0.50
                     + colSapphire * scattering * (1.1 + caustics)
                     + colSky * (scattering * 0.85 + nucleus * 0.40)
                     + colWarmCore * nucleus * (0.85 + u_teaching_intensity * 0.65);
  
  if (u_state == 3.0) internalLight *= 0.5; // Paused dimming
  
  // === SECTION 8: REALISTIC PHYSICAL SPECULAR HIGHLIGHTS ===
  // Key light halfway vector
  vec3 H = normalize(keyLightDir + V);
  float NdotH = max(0.0, dot(N, H));
  
  // 1. Broad softbox curved sheen (elongated along surface curvature)
  vec3 refl = reflect(-V, N);
  float curvedSheen = pow(max(0.0, dot(refl, keyLightDir)), 14.0) * 0.52;
  
  // 2. Focused glossy reflection (partially transparent, curved)
  float specGloss = pow(NdotH, 45.0) * 0.78;
  
  // 3. Delicate pinpoint glint at light center (pure crisp white)
  float specGlint = pow(NdotH, 160.0) * (1.3 + u_audio_high * 0.45);
  
  // 4. Fill bounce from bottom-right (subtle desk ambient reflection)
  vec3 fillLightDir = normalize(vec3(0.55, -0.65, 0.50));
  float specFill = pow(max(0.0, dot(reflect(-V, N), fillLightDir)), 22.0) * 0.22;
  
  vec3 specular = vec3(0.98, 0.99, 1.0) * (curvedSheen + specGloss + specGlint)
                + colSky * specFill;
  
  // === DEPTH REGION 3: REAR GLASS & DEPTH ABSORPTION ===
  vec3 backNormal = normalize(vec3(-p * 0.4, -z * 0.8));
  float backSheen = pow(max(0.0, dot(backNormal, -keyLightDir)), 22.0) * 0.16;
  vec3 backReflection = colSapphire * backSheen;
  
  // Total Composite RGB (neutral glass base + volumetric internal light + rim + specular - refracted dot shadow)
  vec3 totalRgb = glassBase
                + internalLight
                + rimLight
                + specular
                + backReflection
                + edgeAbsorption
                - refractedDotAbsorption;
  totalRgb = max(vec3(0.0), totalRgb);
  
  // Alpha channel: highly transparent in center for clear background dot visibility, defined rim
  float baseAlpha = 0.06 + 0.08 * z;
  float rimAlpha = fresnel * rimDirFactor * 0.42;
  float meniscusAlpha = edgeMeniscus * 0.16;
  float lightAlpha = scattering * 0.20 + nucleus * 0.20;
  float alpha = clamp(baseAlpha + rimAlpha + meniscusAlpha + lightAlpha, 0.0, 0.88);
  
  // Premultiplied alpha output
  gl_FragColor = vec4(totalRgb * alpha, alpha);
}
`;

export class OrbRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private ctx2D: CanvasRenderingContext2D | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private uniformLocations: Record<string, WebGLUniformLocation | null> = {};
  private isWebGL: boolean = false;
  private startTime: number = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initContext();
  }

  private initContext(): void {
    try {
      const gl = (this.canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      }) ||
        this.canvas.getContext("webgl", {
          alpha: true,
          antialias: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
        }) ||
        this.canvas.getContext("experimental-webgl", {
          alpha: true,
          antialias: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
        })) as WebGLRenderingContext | null;

      if (gl) {
        this.gl = gl;
        this.initWebGL();
        if (this.program) {
          this.isWebGL = true;
          this.logDiagnostic();
          return;
        }
      }
    } catch (e) {
      console.warn("[COGNORA][ORB] WebGL initialization error:", e);
    }

    // 2D Canvas Fallback
    this.ctx2D = this.canvas.getContext("2d");
    this.isWebGL = false;
    this.logDiagnostic();
  }

  private logDiagnostic(): void {
    const is3DActive = this.isWebGL && Boolean(this.program);
    const rendererName = this.isWebGL ? "WEBGL" : "FALLBACK";

    // Phase 1 & Phase 4 developer diagnostic output
    console.log(
      `[COGNORA][ORB][RENDERER]\nrenderer=${rendererName}\nfallback=${!this.isWebGL}\ncanvas=${
        this.canvas ? "HTMLCanvasElement" : "null"
      }\nwebgl=${this.isWebGL}\nwebgpu=false`
    );
    console.log(`renderer: ${rendererName}\n3D renderer active: ${is3DActive}`);

    if (typeof window !== "undefined") {
      (window as any).__COGNORA_ORB_DIAGNOSTICS__ = {
        renderer: rendererName,
        fallback: !this.isWebGL,
        canvas: this.canvas ? "HTMLCanvasElement" : "null",
        webgl: this.isWebGL,
        webgpu: false,
        "3D renderer active": is3DActive,
      };
      if (this.canvas) {
        this.canvas.setAttribute("data-orb-renderer", rendererName);
        this.canvas.setAttribute("data-orb-3d-active", String(is3DActive));
      }
    }
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) {
      return null;
    }
    const shader = this.gl.createShader(type);
    if (!shader) {
      return null;
    }
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.warn(
        "[COGNORA][ORB_SHADER] Shader compilation failed:",
        this.gl.getShaderInfoLog(shader),
      );
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private initWebGL(): void {
    if (!this.gl) {
      return;
    }
    const gl = this.gl;

    const vs = this.createShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = this.createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vs || !fs) {
      return;
    }

    const prog = gl.createProgram();
    if (!prog) {
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn(
        "[COGNORA][ORB_SHADER] Program linking failed:",
        gl.getProgramInfoLog(prog),
      );
      return;
    }

    this.program = prog;

    // Full screen quad (-1 to 1)
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Cache uniform locations
    const uniformNames = [
      "u_time",
      "u_resolution",
      "u_pointer",
      "u_state",
      "u_audio_energy",
      "u_audio_low",
      "u_audio_mid",
      "u_audio_high",
      "u_teaching_intensity",
      "u_squish",
      "u_drag_velocity",
      "u_reduced_motion",
      "u_accent_color",
      "u_core_color",
      "u_aura_color",
      "u_tap_time",
      "u_screen_pos",
      "u_camera_parallax",
    ];

    for (const name of uniformNames) {
      this.uniformLocations[name] = gl.getUniformLocation(prog, name);
    }
  }

  public resize(pixelSize: number): void {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const renderSize = Math.round(pixelSize * dpr);

    if (
      this.canvas.width !== renderSize ||
      this.canvas.height !== renderSize
    ) {
      this.canvas.width = renderSize;
      this.canvas.height = renderSize;
    }

    if (this.gl) {
      this.gl.viewport(0, 0, renderSize, renderSize);
    }
  }

  public render(uniforms: OrbShaderUniforms, state: OrbBaseState): void {
    if (this.isWebGL && this.gl && this.program) {
      this.renderWebGL(uniforms, state);
    } else if (this.ctx2D) {
      this.renderCanvas2DFallback(uniforms, state);
    }
  }

  private renderWebGL(
    uniforms: OrbShaderUniforms,
    state: OrbBaseState,
  ): void {
    const gl = this.gl;
    if (!gl || !this.program) {
      return;
    }

    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    const posAttrib = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posAttrib);
    gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

    const time = (performance.now() - this.startTime) * 0.001;

    // Convert state to numeric enum
    const stateMap: Record<OrbBaseState, number> = {
      IDLE: 0,
      THINKING: 1,
      SPEAKING: 2,
      PAUSED: 3,
      COMPLETED: 4,
      ERROR: 5,
      VOICE_OFF: 6,
    };
    const stateNum = stateMap[state] ?? 0;

    gl.uniform1f(this.uniformLocations.u_time, time);
    gl.uniform2f(
      this.uniformLocations.u_resolution,
      this.canvas.width,
      this.canvas.height,
    );
    gl.uniform2f(
      this.uniformLocations.u_pointer,
      uniforms.u_pointer[0],
      uniforms.u_pointer[1],
    );
    gl.uniform1f(this.uniformLocations.u_state, stateNum);
    gl.uniform1f(this.uniformLocations.u_audio_energy, uniforms.u_audio_energy);
    gl.uniform1f(this.uniformLocations.u_audio_low, uniforms.u_audio_low);
    gl.uniform1f(this.uniformLocations.u_audio_mid, uniforms.u_audio_mid);
    gl.uniform1f(this.uniformLocations.u_audio_high, uniforms.u_audio_high);
    gl.uniform1f(
      this.uniformLocations.u_teaching_intensity,
      uniforms.u_teaching_intensity,
    );
    gl.uniform2f(
      this.uniformLocations.u_squish,
      uniforms.u_squish[0],
      uniforms.u_squish[1],
    );
    gl.uniform2f(
      this.uniformLocations.u_drag_velocity,
      uniforms.u_drag_velocity[0],
      uniforms.u_drag_velocity[1],
    );
    gl.uniform1f(
      this.uniformLocations.u_reduced_motion,
      uniforms.u_reduced_motion,
    );

    gl.uniform3f(
      this.uniformLocations.u_accent_color,
      COGNORA_PALETTE.primary[0],
      COGNORA_PALETTE.primary[1],
      COGNORA_PALETTE.primary[2],
    );
    gl.uniform3f(
      this.uniformLocations.u_core_color,
      COGNORA_PALETTE.core[0],
      COGNORA_PALETTE.core[1],
      COGNORA_PALETTE.core[2],
    );
    gl.uniform3f(
      this.uniformLocations.u_aura_color,
      COGNORA_PALETTE.aura[0],
      COGNORA_PALETTE.aura[1],
      COGNORA_PALETTE.aura[2],
    );
    gl.uniform1f(
      this.uniformLocations.u_tap_time,
      uniforms.u_tap_time ?? 999.0,
    );
    gl.uniform2f(
      this.uniformLocations.u_screen_pos,
      uniforms.u_screen_pos ? uniforms.u_screen_pos[0] : 0,
      uniforms.u_screen_pos ? uniforms.u_screen_pos[1] : 0,
    );
    gl.uniform2f(
      this.uniformLocations.u_camera_parallax,
      uniforms.u_camera_parallax ? uniforms.u_camera_parallax[0] : 0,
      uniforms.u_camera_parallax ? uniforms.u_camera_parallax[1] : 0,
    );

    // Alpha blending with premultiplied alpha standard
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Procedural Canvas 2D Fallback if WebGL is disabled or unsupported.
   * Renders high-end translucent glass with living light, never a flat gray circle.
   */
  private renderCanvas2DFallback(
    uniforms: OrbShaderUniforms,
    state: OrbBaseState,
  ): void {
    const ctx = this.ctx2D;
    if (!ctx) {
      return;
    }

    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const baseR = w * 0.38;

    // Soft viewport ambient depth shadow underneath
    const shadowGrad = ctx.createRadialGradient(
      cx,
      cy + baseR * 0.92,
      baseR * 0.1,
      cx,
      cy + baseR * 0.92,
      baseR * 0.85,
    );
    shadowGrad.addColorStop(0, "rgba(15, 23, 42, 0.12)");
    shadowGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy + baseR * 0.92,
      baseR * 0.85,
      baseR * 0.26,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Atmospheric Aura (Sapphire)
    const auraGrad = ctx.createRadialGradient(
      cx,
      cy,
      baseR * 0.6,
      cx,
      cy,
      baseR * 1.35,
    );
    auraGrad.addColorStop(0, "rgba(37, 99, 235, 0.35)");
    auraGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.15)");
    auraGrad.addColorStop(1, "rgba(37, 99, 235, 0)");
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // Liquid Glass Sphere Body with living light
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(uniforms.u_squish[0], uniforms.u_squish[1]);

    // Translucent glass base (crystal clear sapphire/cyan with living nucleus)
    const bodyGrad = ctx.createRadialGradient(
      -baseR * 0.22 + uniforms.u_pointer[0] * 16,
      -baseR * 0.22 + uniforms.u_pointer[1] * 16,
      baseR * 0.05,
      0,
      0,
      baseR,
    );
    bodyGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)"); // Nucleus
    bodyGrad.addColorStop(0.20, "rgba(56, 189, 248, 0.75)"); // Cyan plasma
    bodyGrad.addColorStop(0.55, "rgba(37, 99, 235, 0.35)"); // Sapphire mantle (translucent)
    bodyGrad.addColorStop(0.85, "rgba(30, 27, 75, 0.22)"); // Indigo meniscus
    bodyGrad.addColorStop(1.0, "rgba(186, 230, 253, 0.85)"); // Bright Fresnel rim

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, baseR, 0, Math.PI * 2);
    ctx.fill();

    // Curved Specular Glint
    ctx.beginPath();
    ctx.ellipse(
      -baseR * 0.35 + uniforms.u_pointer[0] * 12,
      -baseR * 0.35 + uniforms.u_pointer[1] * 12,
      baseR * 0.28,
      baseR * 0.14,
      -Math.PI / 4,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fill();

    // Directional Fresnel Rim Arc (Top-Left key light, not a 360-degree button border)
    ctx.beginPath();
    ctx.arc(0, 0, baseR - 1, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "rgba(224, 242, 254, 0.60)";
    ctx.stroke();

    ctx.restore();
  }

  public destroy(): void {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
      if (this.positionBuffer) {
        this.gl.deleteBuffer(this.positionBuffer);
      }
    }
    this.gl = null;
    this.ctx2D = null;
  }
}
