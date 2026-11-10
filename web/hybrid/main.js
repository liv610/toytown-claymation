// Hybrid viewer: the Cycles render IS the image.  What moves is cheap:
//  - light groups re-weighted per frame (flicker, door-click brightening)
//  - 3D snow + chimney smoke projected through the real camera, occluded by the depth pass
//  - 2.5D parallax pan + zoom from the depth pass
//  - the door: stop-motion crop frames rendered in Cycles, spliced in on click
const A = window.TT_HYBRID || './assets/';
const meta = await (await fetch(A + 'hybrid.json')).json();
const cv = document.getElementById('c');
const gl = cv.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
const hud = document.getElementById('stats') || document.getElementById('hud');
const Q = new URLSearchParams(location.search);

function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function tex(img, filter = gl.LINEAR) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t;
}
function prog(vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, '#version 300 es\nprecision highp float;\nprecision highp int;\n' + src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm.replace('[0]', '')] = gl.getUniformLocation(p, nm); }
  return { p, u };
}

// ---------- assets ----------
const G = meta.groups;                                   // relightable groups (display-space deltas)
const [baseI, depthI, localI, ...deltaI] = await Promise.all([A + meta.base, A + meta.depth, A + meta.local, ...G.map((g) => A + meta.deltas[g])].map(loadImg));
const doorI = await Promise.all(meta.door.frames.map((f) => loadImg(A + f)));
const T = { base: tex(baseI), depth: tex(depthI, gl.NEAREST), local: tex(localI), deltas: deltaI.map((i) => tex(i)), door: doorI.map((i) => tex(i)) };
const PW = meta.res[0], PH = meta.res[1];

// ---------- plate shader: relight + parallax + door splice ----------
const NG = G.length;
const plate = prog(`
  out vec2 vUv; void main(){ vec2 p = vec2(gl_VertexID & 1, gl_VertexID >> 1) * 2.0 - 1.0; vUv = p * 0.5 + 0.5; vUv.y = 1.0 - vUv.y; gl_Position = vec4(p, 0, 1); }`, `
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBase, uDepth, uDoor; uniform sampler2D uD[${NG}]; uniform float uK[${NG}];
  uniform vec2 uCenter; uniform float uZoom; uniform vec2 uAspectFix; uniform vec2 uPar; uniform float uInvFocus;
  uniform vec4 uDoorRect; uniform float uDoorOn; uniform float uDoorScale;
  float invZ(vec2 uv){ vec4 d = texture(uDepth, uv); float u = (d.r * 255.0 * 256.0 + d.g * 255.0) / 65535.0; return mix(1.0/200.0, 1.0, u); }
  void main(){
    vec2 uv = uCenter + (vUv - 0.5) * uAspectFix / uZoom;
    float iz = invZ(uv);                       // 2.5D parallax: near things shift more than the focus plane
    uv += uPar * (iz - uInvFocus);
    vec3 c = texture(uBase, uv).rgb;
    ${G.map((_, i) => `c += uK[${i}] * texture(uD[${i}], uv).rgb * 0.5;`).join('\n    ')}
    if (uDoorOn > 0.5) {
      vec2 dq = (uv - uDoorRect.xy) / (uDoorRect.zw - uDoorRect.xy);
      if (all(greaterThanEqual(dq, vec2(0))) && all(lessThanEqual(dq, vec2(1)))) {
        vec4 d = texture(uDoor, dq); c = mix(c, d.rgb, d.a);
      }
    }
    vec2 edge = smoothstep(vec2(0.0), vec2(0.004), uv) * smoothstep(vec2(0.0), vec2(0.004), 1.0 - uv);
    o = vec4(c * edge.x * edge.y, 1.0);
  }`);

// ---------- snow + smoke: world-space points through the Blender camera ----------
const NF = 7000;
const seeds = new Float32Array(NF * 4);
for (let i = 0; i < NF; i++) seeds.set([Math.random() * 44 - 18, Math.random() * 44 - 30, Math.random() * 12.3 - 0.3, Math.random()], i * 4);
const NS = 70; const sseeds = new Float32Array(NS * 4);
for (let i = 0; i < NS; i++) sseeds.set([i / NS, Math.random(), Math.random(), 1], i * 4);
const pts = prog(`
  in vec4 aSeed; uniform float uT; uniform int uMode; uniform mat4 uView; uniform float uFpx, uW, uH, uFocusD, uAp, uZoom;
  uniform vec2 uCenter, uAspectFix, uPar; uniform float uInvFocus; uniform vec3 uChim;
  out float vA; out vec2 vPlate; out float vZ; out vec3 vCol; out float vSmoke;
  void main(){
    vec3 p; float rad;
    if (uMode == 0) {               // snow: falls through a 12.3 m tall box with gentle sway
      p = aSeed.xyz; float k = 1.0 + floor(aSeed.w * 1.33);
      p.z = -0.3 + mod(p.z + 0.3 - k * 1.23 * uT, 12.3);
      p.x += (0.05 + 0.3 * aSeed.w) * sin(uT * (0.6 + aSeed.w) + aSeed.w * 40.0);
      p.y += 0.12 * cos(uT * 0.5 + aSeed.w * 17.0);
      rad = 0.012 + 0.022 * fract(aSeed.w * 7.3); vSmoke = 0.0;
    } else {                        // smoke puffs rising from the chimney, drifting with the breeze
      float a = fract(aSeed.x + uT * 0.055);
      p = uChim + vec3(0.7 * a + 0.18 * sin(a * 8.0 + aSeed.y * 30.0), -0.25 * a, a * 3.4);
      rad = 0.18 + 0.9 * a; vSmoke = smoothstep(0.0, 0.1, a) * (1.0 - a);
    }
    vec4 c = uView * vec4(p, 1.0); float Z = -c.z; vZ = Z;
    vec2 pix = vec2(uW * 0.5 + uFpx * c.x / Z, uH * 0.5 - uFpx * c.y / Z);
    vec2 uvp = pix / vec2(uW, uH);
    uvp += uPar * (1.0 / Z - uInvFocus);             // same parallax as the plate
    vPlate = uvp;
    vec2 scr = (uvp - uCenter) / uAspectFix * uZoom + 0.5;
    gl_Position = Z > 0.6 ? vec4(scr.x * 2.0 - 1.0, 1.0 - scr.y * 2.0, 0.0, 1.0) : vec4(9, 9, 9, 1);
    float pxScale = uZoom * float(textureSize(uLocalDummy, 0).x) * 0.0 + uZoom;   // keep uniform alive
    float rpx = rad * uFpx / Z;
    float coc = uAp * abs(Z - uFocusD) / (Z * uFocusD) * uFpx;   // thin lens (pixels, diameter)
    float R = max(max(rpx, coc * 0.5), 0.6);
    vA = uMode == 0 ? clamp(pow(max(rpx, 0.6) / R, 2.0), 0.03, 1.0) * 0.95 : vSmoke * 0.2;
    gl_PointSize = min(2.0 * R * uZoom * uViewScale, 120.0);
  }`.replace('float pxScale = uZoom * float(textureSize(uLocalDummy, 0).x) * 0.0 + uZoom;   // keep uniform alive\n', '')
  .replace('uniform float uInvFocus;', 'uniform float uInvFocus; uniform float uViewScale;'), `
  in float vA; in vec2 vPlate; in float vZ; in float vSmoke; out vec4 o;
  uniform sampler2D uDepth, uLocal; uniform vec3 uBaseCol; uniform int uMode;
  float invZ(vec2 uv){ vec4 d = texture(uDepth, uv); float u = (d.r * 255.0 * 256.0 + d.g * 255.0) / 65535.0; return mix(1.0/200.0, 1.0, u); }
  void main(){
    if (any(lessThan(vPlate, vec2(0))) || any(greaterThan(vPlate, vec2(1)))) discard;
    if (invZ(vPlate) > 1.0 / vZ * 1.01) discard;     // scene surface is in front of this flake
    float d = length(gl_PointCoord - 0.5) * 2.0;
    vec3 local = texture(uLocal, vPlate).rgb; local *= local;     // stored sqrt-encoded (display space)
    if (uMode == 0) {
      float a = smoothstep(1.0, 0.8, d) * vA;
      o = vec4(uBaseCol + local * 1.3, a);
    } else {
      float a = smoothstep(1.0, 0.0, d) * vA;
      o = vec4(vec3(0.5, 0.44, 0.47) + local * 0.8, a);
    }
  }`);
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
const snowBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, snowBuf); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
const smokeBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, smokeBuf); gl.bufferData(gl.ARRAY_BUFFER, sseeds, gl.STATIC_DRAW);
const aSeed = gl.getAttribLocation(pts.p, 'aSeed');

// camera (Blender convention): view = inverse(matrix_world)
function inv4(m) { // m: row-major 4x4 array of arrays (rigid transform)
  const R = [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]];
  const t = [m[0][3], m[1][3], m[2][3]];
  const ti = R.map((r) => -(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]));
  // column-major for GL
  return new Float32Array([R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, ti[0], ti[1], ti[2], 1]);
}
const cam = meta.camera;
const VIEW = inv4(cam.matrix_world);
const FPX = cam.lens / cam.sensor * PW;
const AP = (cam.lens / 1000) / cam.fstop;                 // aperture diameter (m)

// ---------- flicker (mirrors scripts/post/composite.py) ----------
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const ph = Object.fromEntries(G.concat(['lampW', 'lampE']).map((g) => [g, [...Array(6)].map(() => rnd() * 6.283)]));
const S = (g, t, hs, as) => hs.reduce((acc, n, i) => acc + as[i] * Math.sin(2 * Math.PI * n * t / 10 + ph[g][i]), 0);
function gains(t, doorOpen, hover) {
  const g = {};
  g.shop = 1 + S('shop', t, [3, 11, 23, 41], [0.012, 0.016, 0.01, 0.007]) + 0.4 * doorOpen + 0.12 * hover;
  g.pink = 1 + S('pink', t, [5, 13, 29, 47], [0.018, 0.02, 0.012, 0.008]);
  g.bg = 1 + S('bg', t, [4, 17], [0.015, 0.01]);
  for (const k of ['lampW', 'lampE']) g[k] = 1 + S(k, t, [19, 31, 53, 71], [0.022, 0.018, 0.014, 0.01]) - 0.1 * Math.exp(-((((t % 10) - (k === 'lampW' ? 6.3 : 2.1)) / 0.2) ** 2));
  for (let i = 0; i < 3; i++) {
    const p = 2 * Math.PI * i / 3, v = 0.5 + 0.5 * Math.sin(2 * Math.PI * 6 * t / 10 + p) + 0.15 * Math.sin(2 * Math.PI * 17 * t / 10 + 2 * p);
    g['tree' + (i + 1)] = 0.72 + 0.42 * Math.max(0, Math.min(1.15, v));
  }
  g.star = 1 + 0.07 * Math.sin(2 * Math.PI * 3 * t / 10 + 0.4);
  g.garland = 1 + 0.1 * Math.sin(2 * Math.PI * 4 * t / 10 + 1.3);
  return G.map((k) => ((g[k] ?? 1) - 1) / meta.delta_gain);
}

// ---------- view state: pan / zoom / idle drift ----------
let zoom = 1, cx = 0.5, cy = 0.5, tz = 1, tcx = 0.5, tcy = 0.5, dragging = null, lastInput = -10;
const ZMAX = 2.4;
function aspectFix() {   // fit plate to window (cover), keep plate aspect
  const wa = cv.width / cv.height, pa = PW / PH;
  return wa > pa ? [1, pa / wa] : [wa / pa, 1];
}
function clampView() {
  const [ax, ay] = aspectFix();
  const hx = 0.5 * ax / tz, hy = 0.5 * ay / tz;
  tcx = Math.min(1 - hx, Math.max(hx, tcx)); tcy = Math.min(1 - hy, Math.max(hy, tcy));
}
function toPlate(ex, ey) {
  const [ax, ay] = aspectFix();
  return [cx + (ex / innerWidth - 0.5) * ax / zoom, cy + (ey / innerHeight - 0.5) * ay / zoom];
}
cv.addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, y: e.clientY, cx: tcx, cy: tcy, moved: 0 }; cv.setPointerCapture(e.pointerId); lastInput = now; });
cv.addEventListener('pointermove', (e) => {
  const [px, py] = toPlate(e.clientX, e.clientY);
  hoverDoor = inDoor(px, py); cv.classList.toggle('hot', hoverDoor);
  if (!dragging) return;
  const [ax, ay] = aspectFix();
  const dx = (e.clientX - dragging.x) / innerWidth, dy = (e.clientY - dragging.y) / innerHeight;
  dragging.moved = Math.max(dragging.moved, Math.abs(dx) + Math.abs(dy));
  tcx = dragging.cx - dx * ax / tz; tcy = dragging.cy - dy * ay / tz; clampView(); lastInput = now;
});
cv.addEventListener('pointerup', (e) => {
  if (dragging && dragging.moved < 0.01) { const [px, py] = toPlate(e.clientX, e.clientY); if (inDoor(px, py)) toggleDoor(); }
  dragging = null;
});
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [px, py] = toPlate(e.clientX, e.clientY);
  tz = Math.min(ZMAX, Math.max(1, tz * Math.exp(-e.deltaY * 0.0012)));
  const [ax, ay] = aspectFix();
  tcx = px - (e.clientX / innerWidth - 0.5) * ax / tz; tcy = py - (e.clientY / innerHeight - 0.5) * ay / tz;
  clampView(); lastInput = now;
}, { passive: false });

// ---------- door ----------
const DR = meta.door.rect.map((v, i) => v / (i % 2 ? PH : PW));      // plate uv rect of the door crop
const HOT = meta.door.hotspot.map((v, i) => v / (i % 2 ? PH : PW));
let doorState = 0, doorAnim = 0, doorDir = 0, hoverDoor = false;
const inDoor = (x, y) => x > HOT[0] && x < HOT[2] && y > HOT[1] && y < HOT[3];
function toggleDoor() { if (meta.door.frames.length > 1) doorDir = doorState > 0.5 ? -1 : 1; }
window.__openDoor = () => { doorDir = 1; };

// ---------- render loop ----------
function resize() { const d = Math.min(devicePixelRatio, 2); cv.width = innerWidth * d; cv.height = innerHeight * d; }
addEventListener('resize', resize); resize();
document.getElementById('loading')?.remove();
let now = 0, frames = 0, acc = 0, fps = 0, last = performance.now(), hoverAmt = 0;
const baseCol = meta.flake_color;
function frame(ms) {
  const dt = Math.min(0.1, (ms - last) / 1000); last = ms; now += dt;
  if (Q.get('t')) now = +Q.get('t');
  // idle: a slow breathing drift so the set never feels frozen
  const idle = Math.min(1, Math.max(0, (now - lastInput - 4) / 3));
  const driftX = idle * 0.006 * Math.sin(now * 0.13), driftY = idle * 0.003 * Math.sin(now * 0.09 + 1);
  zoom += (tz - zoom) * Math.min(1, dt * 6); cx += (tcx - cx) * Math.min(1, dt * 6); cy += (tcy - cy) * Math.min(1, dt * 6);
  // door: stop-motion frames, advanced on twos (12 fps)
  if (doorDir) { doorAnim += doorDir * dt * 12; if (doorAnim >= meta.door.frames.length - 1) { doorAnim = meta.door.frames.length - 1; doorDir = 0; doorState = 1; } if (doorAnim <= 0) { doorAnim = 0; doorDir = 0; doorState = 0; } }
  const di = Math.round(doorAnim), doorOpen = meta.door.frames.length > 1 ? di / (meta.door.frames.length - 1) : 0;
  hoverAmt += ((hoverDoor ? 1 : 0) - hoverAmt) * Math.min(1, dt * 5);
  // parallax: offset grows with how far we have panned from centre + drift
  const par = [((cx - 0.5) * 0.06 + driftX) * 0.9, ((cy - 0.5) * 0.03 + driftY) * 0.9];
  const ccx = cx + driftX * 0.3, ccy = cy + driftY * 0.3;
  const af = aspectFix();
  gl.viewport(0, 0, cv.width, cv.height);
  gl.disable(gl.BLEND);
  gl.useProgram(plate.p);
  const K = gains(now, doorOpen, hoverAmt);
  let unit = 0;
  const bind = (loc, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit++); };
  bind(plate.u.uBase, T.base); bind(plate.u.uDepth, T.depth); bind(plate.u.uDoor, T.door[di] || T.base);
  gl.uniform1iv(plate.u.uD, T.deltas.map((t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); return unit++; }));
  gl.uniform1fv(plate.u.uK, K);
  gl.uniform2f(plate.u.uCenter, ccx, ccy); gl.uniform1f(plate.u.uZoom, zoom); gl.uniform2fv(plate.u.uAspectFix, af);
  gl.uniform2fv(plate.u.uPar, par); gl.uniform1f(plate.u.uInvFocus, 1 / cam.focus);
  gl.uniform4fv(plate.u.uDoorRect, DR); gl.uniform1f(plate.u.uDoorOn, di > 0 || meta.door.always ? 1 : 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // particles
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(pts.p); unit = 0;
  bind(pts.u.uDepth, T.depth); bind(pts.u.uLocal, T.local);
  gl.uniformMatrix4fv(pts.u.uView, false, VIEW);
  gl.uniform1f(pts.u.uFpx, FPX); gl.uniform1f(pts.u.uW, PW); gl.uniform1f(pts.u.uH, PH);
  gl.uniform1f(pts.u.uFocusD, cam.focus); gl.uniform1f(pts.u.uAp, AP);
  gl.uniform1f(pts.u.uZoom, zoom); gl.uniform1f(pts.u.uViewScale, cv.height / (PH * af[1]));
  gl.uniform2f(pts.u.uCenter, ccx, ccy); gl.uniform2fv(pts.u.uAspectFix, af); gl.uniform2fv(pts.u.uPar, par);
  gl.uniform1f(pts.u.uInvFocus, 1 / cam.focus); gl.uniform3fv(pts.u.uChim, meta.chimney);
  gl.uniform3fv(pts.u.uBaseCol, baseCol); gl.uniform1f(pts.u.uT, now);
  for (const [mode, buf, n] of [[1, smokeBuf, NS], [0, snowBuf, NF]]) {
    gl.uniform1i(pts.u.uMode, mode);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(aSeed); gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, n);
  }
  frames++; acc += dt; if (acc > 0.5) { fps = frames / acc; frames = 0; acc = 0; }
  if (hud) hud.textContent = `${fps.toFixed(0)} fps · Cycles render, relit live`;
  window.__fps = fps; window.__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
