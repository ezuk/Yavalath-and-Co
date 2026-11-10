// The 3D board: tiles, stones, lighting, camera and touch picking.
// Knows nothing about rules. Games tell it what to show.

import * as THREE from 'three';
import { cells, N, cellXZ } from './hex.js';

const STONE_COLORS = {
  1: { color: 0xf3eee4, roughness: 0.22 },
  2: { color: 0x15161a, roughness: 0.18 },
  3: { color: 0xc4392d, roughness: 0.25 },
};
const TILE_BASE = new THREE.Color(0xb07f45);
const HINT = new THREE.Color(0xffc45e);
const WIN_GLOW = new THREE.Color(0xffb53d);
const LOSE_GLOW = new THREE.Color(0xff3b2a);
const STONE_Y = 0.27;
const BOARD_RADIUS = 8.7;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function bounce(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

function hexShape(radius, rotation) {
  const shape = new THREE.Shape();
  for (let k = 0; k < 6; k++) {
    const a = rotation + (k * Math.PI) / 3;
    const x = radius * Math.cos(a), y = radius * Math.sin(a);
    if (k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function prism(radius, rotation, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(hexShape(radius - bevel, rotation), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(depth + bevel), 0); // top face at y = 0
  return g;
}

export class BoardScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.onTap = null;
    this.tweens = [];
    this.stones = new Map();
    this.hints = new Set();
    this.glows = [];
    this.azimuth = 0;
    this.elevation = 0.95;
    this.autoRotate = false;
    this.insets = { top: 0, bottom: 0 };
    this.needsRender = true;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.38;
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 200);

    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1a2a30, 0.3));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
    sun.position.set(-12, 14, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -11; sc.right = sc.top = 11; sc.near = 5; sc.far = 45;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 3;
    scene.add(sun);

    this.root = new THREE.Group();
    scene.add(this.root);
    this.buildBoard();

    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.bindPointer();

    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  buildBoard() {
    const slab = new THREE.Mesh(
      prism(BOARD_RADIUS, 0, 0.55, 0.18),
      new THREE.MeshPhysicalMaterial({ color: 0x2c1a10, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.35 }),
    );
    slab.position.y = -0.42;
    slab.receiveShadow = true;
    slab.castShadow = true;
    this.root.add(slab);

    const table = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.42 }));
    table.rotation.x = -Math.PI / 2;
    table.position.y = -1.15;
    table.receiveShadow = true;
    this.scene.add(table);

    const tileGeo = prism(0.94, Math.PI / 6, 0.3, 0.07);
    this.tiles = [];
    for (let i = 0; i < N; i++) {
      // Slight per-tile variation so the board reads as cut wood rather than plastic.
      const tone = 0.93 + 0.14 * (((i * 2654435761) >>> 0) / 4294967296);
      const mat = new THREE.MeshPhysicalMaterial({
        color: TILE_BASE.clone().multiplyScalar(tone),
        roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.5,
        emissive: 0x000000,
      });
      const tile = new THREE.Mesh(tileGeo, mat);
      const [x, z] = cellXZ(i);
      tile.position.set(x, 0, z);
      tile.receiveShadow = true;
      tile.castShadow = true;
      this.root.add(tile);
      this.tiles.push(tile);
    }

    this.stoneGeo = new THREE.SphereGeometry(0.66, 40, 20);
    this.stoneGeo.scale(1, 0.41, 1);
    this.stoneMats = {};
    for (const [k, v] of Object.entries(STONE_COLORS)) {
      this.stoneMats[k] = new THREE.MeshPhysicalMaterial({
        color: v.color, roughness: v.roughness, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0x000000,
      });
    }

    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.035, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb53d }),
    );
    this.marker.rotation.x = Math.PI / 2;
    this.marker.visible = false;
    this.root.add(this.marker);
  }

  // ---- stones ----------------------------------------------------------

  placeStone(cell, color, { animate = true, mark = false } = {}) {
    this.removeStone(cell, { animate: false });
    const mesh = new THREE.Mesh(this.stoneGeo, this.stoneMats[color].clone());
    const [x, z] = cellXZ(cell);
    mesh.position.set(x, STONE_Y, z);
    mesh.userData.color = color;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.stones.set(cell, mesh);
    if (animate && !this.reducedMotion) {
      mesh.position.y = STONE_Y + 5;
      this.tween(420, (t) => { mesh.position.y = STONE_Y + 5 * (1 - bounce(t)); });
      const tile = this.tiles[cell];
      this.tween(380, (t) => { tile.position.y = -0.09 * Math.sin(Math.PI * easeOut(t)); }, 150);
    }
    if (mark) this.setMarker(cell);
    this.needsRender = true;
    return mesh;
  }

  removeStone(cell, { animate = true } = {}) {
    const mesh = this.stones.get(cell);
    if (!mesh) return;
    this.stones.delete(cell);
    if (this.markerCell === cell) this.setMarker(-1);
    const dispose = () => { this.root.remove(mesh); mesh.material.dispose(); };
    if (animate && !this.reducedMotion) {
      this.tween(220, (t) => {
        const s = 1 - easeInOut(t);
        mesh.scale.setScalar(Math.max(s, 0.001));
        mesh.position.y = STONE_Y + t * 0.8;
      }, 0, dispose);
    } else dispose();
    this.needsRender = true;
  }

  clearStones({ animate = false } = {}) {
    for (const cell of [...this.stones.keys()]) this.removeStone(cell, { animate });
    this.clearEffects();
  }

  // Makes the board match `board` (array of 0 / colour per cell) with minimal changes.
  sync(board, { animate = false } = {}) {
    for (let i = 0; i < N; i++) {
      const has = this.stones.get(i);
      const want = board[i];
      if (has && (!want || has.userData.color !== want)) this.removeStone(i, { animate });
      if (want && !this.stones.has(i)) this.placeStone(i, want, { animate });
    }
  }

  setMarker(cell) {
    this.markerCell = cell;
    this.marker.visible = cell >= 0;
    if (cell >= 0) {
      const [x, z] = cellXZ(cell);
      this.marker.position.set(x, STONE_Y + 0.265, z);
    }
    this.needsRender = true;
  }

  // ---- effects ---------------------------------------------------------

  setHints(list) {
    for (const i of this.hints) this.tiles[i].material.emissive.setScalar(0);
    this.hints = new Set(list || []);
    this.needsRender = true;
  }

  // Highlights a finished line on its tiles: gold and lifted for a win, red for a loss.
  markLine(list, kind) {
    const colour = kind === 'win' ? WIN_GLOW : LOSE_GLOW;
    list.forEach((cell, k) => {
      const mesh = this.stones.get(cell);
      if (!mesh) return;
      this.glows.push({ tile: this.tiles[cell], colour, phase: k * 0.5 });
      if (kind === 'win' && !this.reducedMotion) {
        this.tween(500, (t) => { mesh.position.y = STONE_Y + 0.35 * easeOut(t); }, 120 * k);
      }
    });
    this.marker.visible = false;
    this.needsRender = true;
  }

  clearEffects() {
    for (const g of this.glows) g.tile.material.emissive.setScalar(0);
    this.glows = [];
    this.setHints([]);
    this.setMarker(-1);
  }

  // ---- camera ----------------------------------------------------------

  setInsets(top, bottom, { animate = true } = {}) {
    const from = { ...this.insets };
    const to = { top, bottom };
    if (!animate || this.reducedMotion) { this.insets = to; this.updateCamera(); return; }
    this.tween(600, (t) => {
      const e = easeInOut(t);
      this.insets = { top: from.top + (to.top - from.top) * e, bottom: from.bottom + (to.bottom - from.bottom) * e };
      this.updateCamera();
    });
  }

  resetView({ animate = true } = {}) {
    const a0 = this.azimuth, e0 = this.elevation;
    // Unwind to the nearest whole turn so the board never spins the long way round.
    const a1 = Math.round(a0 / (2 * Math.PI)) * 2 * Math.PI;
    if (!animate || this.reducedMotion) { this.azimuth = 0; this.elevation = 0.95; this.updateCamera(); return; }
    this.tween(600, (t) => {
      const e = easeInOut(t);
      this.azimuth = a0 + (a1 - a0) * e;
      this.elevation = e0 + (0.95 - e0) * e;
      this.updateCamera();
    }, 0, () => { this.azimuth = 0; });
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.width = w; this.height = h;
    this.updateCamera();
  }

  updateCamera() {
    const { width: w, height: h, camera } = this;
    if (!w) return;
    const availH = Math.max(h - this.insets.top - this.insets.bottom, 120);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitW = BOARD_RADIUS / (tanHalf * (w / h));
    // 1.2 allows for perspective: the near edge of the board projects larger than the far one.
    const fitH = (BOARD_RADIUS * Math.sin(this.elevation) * 1.2 + 1.2) / (tanHalf * (availH / h));
    const dist = Math.max(fitW, fitH) * 1.03;
    const ce = Math.cos(this.elevation), se = Math.sin(this.elevation);
    camera.position.set(dist * ce * Math.sin(this.azimuth), dist * se, dist * ce * Math.cos(this.azimuth));
    camera.lookAt(0, -0.4, 0);
    camera.aspect = w / h;
    camera.setViewOffset(w, h, 0, (this.insets.bottom - this.insets.top) / 2, w, h);
    camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  // ---- input -----------------------------------------------------------

  bindPointer() {
    const el = this.canvas;
    const pointers = new Map();
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, e);
      if (pointers.size === 1) {
        drag = { x: e.clientX, y: e.clientY, az: this.azimuth, el: this.elevation, moved: false, id: e.pointerId };
        el.setPointerCapture(e.pointerId);
      } else drag = null;
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 10) return;
      drag.moved = true;
      if (this.locked) return;
      this.azimuth = drag.az - dx * 0.006;
      this.elevation = THREE.MathUtils.clamp(drag.el + dy * 0.005, 0.6, 1.45);
      this.updateCamera();
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (drag && e.pointerId === drag.id) {
        if (!drag.moved && e.type === 'pointerup') {
          const cell = this.pick(e.clientX, e.clientY);
          if (cell >= 0 && this.onTap) this.onTap(cell);
        }
        drag = null;
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return -1;
    let best = -1, bestD = 0.92 * 0.92;
    for (let i = 0; i < N; i++) {
      const [x, z] = cellXZ(i);
      const d = (x - hit.x) ** 2 + (z - hit.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // Screen position of a cell, for tests and overlays.
  project(cell) {
    const [x, z] = cellXZ(cell);
    const v = new THREE.Vector3(x, 0, z).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  // ---- loop ------------------------------------------------------------

  tween(duration, update, delay = 0, done) {
    this.tweens.push({ duration, update, delay, done, elapsed: 0 });
  }

  frame(now) {
    const dt = Math.min(now - this.lastTime, 50);
    this.lastTime = now;
    let active = this.needsRender;
    this.needsRender = false;

    if (this.tweens.length) {
      active = true;
      // Tweens may queue more tweens from their callbacks; keep those too.
      const running = this.tweens;
      this.tweens = [];
      const keep = [];
      for (const tw of running) {
        tw.elapsed += dt;
        const t = Math.min(Math.max((tw.elapsed - tw.delay) / tw.duration, 0), 1);
        if (tw.elapsed >= tw.delay) tw.update(t);
        if (t < 1) keep.push(tw); else if (tw.done) tw.done();
      }
      this.tweens = keep.concat(this.tweens);
    }
    if (this.autoRotate && !this.reducedMotion) {
      this.azimuth += dt * 0.00012;
      this.updateCamera();
      active = true;
    }
    if (this.hints.size || this.glows.length) {
      active = true;
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
      for (const i of this.hints) this.tiles[i].material.emissive.copy(HINT).multiplyScalar(0.18 + 0.32 * pulse);
      for (const g of this.glows) {
        const p = 0.5 + 0.5 * Math.sin(now * 0.006 - g.phase);
        g.tile.material.emissive.copy(g.colour).multiplyScalar(0.3 + 0.5 * p);
      }
    }
    if (active) this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.frame(t));
  }
}
