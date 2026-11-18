// Shared cartoon look for The Estimator: banded toon shading plus ink outlines drawn from depth and normals.
import * as THREE from 'three';

let _ramp = null;
export function toonRamp() {
  if (_ramp) return _ramp;
  const steps = new Uint8Array([132, 132, 132, 255, 190, 190, 190, 255, 232, 232, 232, 255, 255, 255, 255, 255]);
  _ramp = new THREE.DataTexture(steps, 4, 1, THREE.RGBAFormat);
  _ramp.minFilter = _ramp.magFilter = THREE.NearestFilter;
  _ramp.needsUpdate = true;
  return _ramp;
}

// Swap every imported material for a toon one, keeping colour, texture, glow and transparency.
export function toonify(root) {
  const cache = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const conv = (m) => {
      if (cache.has(m)) return cache.get(m);
      const t = new THREE.MeshToonMaterial({
        color: m.color ? m.color.clone() : new THREE.Color(1, 1, 1),
        map: m.map || null,
        gradientMap: toonRamp(),
        transparent: m.transparent || m.opacity < 1,
        opacity: m.opacity,
        side: m.side,
      });
      if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0) {
        t.emissive = m.emissive.clone();
        t.emissiveIntensity = Math.min(m.emissiveIntensity ?? 1, 3) * 0.2;
      }
      if (t.transparent) { t.depthWrite = false; }
      t.name = m.name;
      cache.set(m, t);
      return t;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    if (Array.isArray(o.material) ? o.material.every((m) => m.transparent) : o.material.transparent) o.castShadow = false;
  });
  return root;
}

// Renders the scene, then inks edges where depth or surface direction changes sharply.
export class InkRenderer {
  constructor(renderer, { ink = 0x3b2417, thickness = 1.6 } = {}) {
    this.r = renderer;
    this.normalMat = new THREE.MeshNormalMaterial();
    this.colorRT = new THREE.WebGLRenderTarget(4, 4, { samples: 4, colorSpace: THREE.SRGBColorSpace });
    this.normalRT = new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4) });
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.colorRT.texture }, tNormal: { value: this.normalRT.texture },
        tDepth: { value: this.normalRT.depthTexture }, px: { value: new THREE.Vector2() },
        near: { value: 0.1 }, far: { value: 100 }, ink: { value: new THREE.Color(ink) }, dbg: { value: new URLSearchParams(location.search).has('inkdbg') ? 1 : 0 }, thick: { value: thickness },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tColor, tNormal, tDepth; uniform vec2 px; uniform float near, far, thick, dbg; uniform vec3 ink;
        float lin(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
        void main(){
          vec2 o = px * thick * 1.9;            // silhouettes: wide sample
          float d = lin(vUv);
          // 1/depth is exactly linear across a flat surface on screen, so its second difference is zero on any plane
          // (even at a grazing angle) and large at a silhouette
          float w0 = 1.0 / d;
          float dd = (abs(1.0 / lin(vUv + vec2(o.x, 0.0)) + 1.0 / lin(vUv - vec2(o.x, 0.0)) - 2.0 * w0)
                    + abs(1.0 / lin(vUv + vec2(0.0, o.y)) + 1.0 / lin(vUv - vec2(0.0, o.y)) - 2.0 * w0)) / w0 * d;
          vec2 c2 = px * thick * 0.9;           // creases: narrow sample
          vec3 n0 = texture2D(tNormal, vUv + vec2(c2.x, 0.0)).xyz - texture2D(tNormal, vUv - vec2(c2.x, 0.0)).xyz;
          vec3 n1 = texture2D(tNormal, vUv + vec2(0.0, c2.y)).xyz - texture2D(tNormal, vUv - vec2(0.0, c2.y)).xyz;
          float eD = smoothstep(0.012, 0.035, dd / d);
          float eN = smoothstep(0.55, 0.95, length(n0) + length(n1));
          float e = clamp(max(eD, eN * 0.85), 0.0, 1.0);
          vec4 c = texture2D(tColor, vUv);
          gl_FragColor = vec4(mix(c.rgb, ink, e * 0.95), 1.0);
          if (dbg > 0.5) gl_FragColor = vec4(eD, eN, 0.0, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
  }

  setSize(w, h) {
    const pr = this.r.getPixelRatio();
    this.colorRT.setSize(w * pr, h * pr);
    this.normalRT.setSize(w * pr, h * pr);
    this.mat.uniforms.px.value.set(1 / (w * pr), 1 / (h * pr));
  }

  render(scene, camera) {
    const r = this.r;
    this.mat.uniforms.near.value = camera.near;
    this.mat.uniforms.far.value = camera.far;
    r.setRenderTarget(this.colorRT);
    r.render(scene, camera);
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = this.normalMat;
    r.setRenderTarget(this.normalRT);
    r.setClearColor(0x8080ff, 1);
    r.clear();
    r.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = bg;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
  }
}
