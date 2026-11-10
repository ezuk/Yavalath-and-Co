// The 3D board: tiles, pieces, lighting, camera and touch picking.
// Knows nothing about rules. Games hand it a view (what sits on each cell)
// and it animates from what it was showing to what it should show.

import * as THREE from 'three';
import { N, cellXZ } from './hex.js';

// Piece codes used in views: 1 white, 2 black, 3 red, 4 breadcrumb.
const PIECES = {
  1: { color: 0xf3eee4, roughness: 0.22, scale: 1 },
  2: { color: 0x15161a, roughness: 0.18, scale: 1 },
  3: { color: 0xc4392d, roughness: 0.25, scale: 1 },
  4: { color: 0xd9a441, roughness: 0.7, scale: 0.55 },
};
const TILE_BASE = new THREE.Color(0xb07f45);
const HINT = new THREE.Color(0xffc45e);
const SELECT = new THREE.Color(0x4fd1c5);
const WIN_GLOW = new THREE.Color(0xffb53d);
const LOSE_GLOW = new THREE.Color(0xff3b2a);
const STONE_Y = 0.27;
const STACK_STEP = 0.5;
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

// Candidate looks for sinking the tiles into the base. rim: height of the
// frame's top above the tile tops. hole: 'hex' one straight-sided recess,
// 'fitted' a recess that follows the tiles' zigzag edge, 'sockets' one well
// per tile.
const INSETS = {
  1: { hole: 'hex', rim: 0 },
  2: { hole: 'hex', rim: 0.3 },
  3: { hole: 'fitted', rim: 0 },
  4: { hole: 'fitted', rim: 0.25 },
  5: { hole: 'sockets', rim: 0.1, tile: 0.84 },
};

function hexPoints(cx, cy, radius, rotation) {
  return Array.from({ length: 6 }, (_, k) => {
    const a = rotation + (k * Math.PI) / 3;
    return new THREE.Vector2(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
  });
}

// Outline of the whole field of tiles: every hex edge that belongs to one cell only.
function fieldOutline() {
  const key = (p) => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`;
  const edges = new Map();
  for (let i = 0; i < N; i++) {
    const [x, z] = cellXZ(i);
    const pts = hexPoints(x, -z, 1, Math.PI / 6);
    for (let k = 0; k < 6; k++) {
      const a = pts[k], b = pts[(k + 1) % 6];
      const id = [key(a), key(b)].sort().join('|');
      if (edges.has(id)) edges.delete(id); else edges.set(id, [a, b]);
    }
  }
  const next = new Map();
  for (const [a, b] of edges.values()) next.set(key(a), b);
  const first = edges.values().next().value[0];
  const loop = [first];
  for (let p = next.get(key(first)); key(p) !== key(first); p = next.get(key(p))) loop.push(p);
  return loop;
}

function frameGeometry(variant) {
  const shape = new THREE.Shape(hexPoints(0, 0, BOARD_RADIUS - 0.06, 0));
  if (variant.hole === 'hex') shape.holes.push(new THREE.Path(hexPoints(0, 0, 8.05, 0).reverse()));
  else if (variant.hole === 'fitted') shape.holes.push(new THREE.Path(fieldOutline().reverse()));
  else for (let i = 0; i < N; i++) { const [x, z] = cellXZ(i); shape.holes.push(new THREE.Path(hexPoints(x, -z, 0.9, Math.PI / 6).reverse())); }
  const depth = variant.rim + 0.42, bevel = 0.05;
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -depth, 0); // top face at y = 0
  return g;
}

const sameStack = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

export class BoardScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.onTap = null;
    this.tweens = [];
    this.stacks = Array.from({ length: N }, () => []); // meshes per cell, bottom first
    this.hints = new Set();
    this.selected = new Set();
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

    const variant = INSETS[new URLSearchParams(location.search).get('board')] || null;
    if (variant) {
      const frame = new THREE.Mesh(frameGeometry(variant), slab.material);
      frame.position.y = variant.rim;
      frame.receiveShadow = true;
      frame.castShadow = true;
      this.root.add(frame);
    }
    const tileRadius = variant && variant.tile ? variant.tile : 0.94;

    const table = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.42 }));
    table.rotation.x = -Math.PI / 2;
    table.position.y = -1.15;
    table.receiveShadow = true;
    this.scene.add(table);

    const tileGeo = prism(tileRadius, Math.PI / 6, 0.3, 0.07);
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
    this.pieceMats = {};
    for (const [k, v] of Object.entries(PIECES)) {
      this.pieceMats[k] = new THREE.MeshPhysicalMaterial({
        color: v.color, roughness: v.roughness, clearcoat: k === '4' ? 0 : 1, clearcoatRoughness: 0.08,
      });
    }

    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.035, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb53d }),
    );
    this.marker.rotation.x = Math.PI / 2;
    this.marker.visible = false;
    this.root.add(this.marker);

    // The direction rod used by Coffee: lies across the top of a stone.
    this.rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 1.24, 14),
      new THREE.MeshPhysicalMaterial({ color: 0xf3eee4, roughness: 0.35, clearcoat: 0.6 }),
    );
    this.rod.rotation.z = Math.PI / 2; // lie flat along x
    this.rodPivot = new THREE.Group();
    this.rodPivot.add(this.rod);
    this.rodPivot.visible = false;
    this.rod.castShadow = true;
    this.root.add(this.rodPivot);
  }

  // ---- pieces ----------------------------------------------------------

  heightAt(level) { return STONE_Y + level * STACK_STEP; }

  makePiece(code) {
    const mesh = new THREE.Mesh(this.stoneGeo, this.pieceMats[code]);
    mesh.userData.code = code;
    mesh.scale.setScalar(PIECES[code].scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  addPiece(cell, code, animate) {
    const stack = this.stacks[cell];
    const mesh = this.makePiece(code);
    const [x, z] = cellXZ(cell);
    const y = this.heightAt(stack.length);
    mesh.position.set(x, y, z);
    stack.push(mesh);
    if (animate && !this.reducedMotion) {
      mesh.position.y = y + 5;
      this.tween(420, (t) => { mesh.position.y = y + 5 * (1 - bounce(t)); });
      const tile = this.tiles[cell];
      this.tween(380, (t) => { tile.position.y = -0.09 * Math.sin(Math.PI * easeOut(t)); }, 150);
    }
  }

  discard(mesh, animate) {
    const remove = () => this.root.remove(mesh);
    if (animate && !this.reducedMotion) {
      const y0 = mesh.position.y, s0 = mesh.scale.x;
      this.tween(240, (t) => {
        mesh.scale.setScalar(Math.max(s0 * (1 - easeInOut(t)), 0.001));
        mesh.position.y = y0 + t * 0.8;
      }, 0, remove);
    } else remove();
  }

  // Carries the top piece of path[0] through each cell of the path in turn.
  movePiece(path, animate) {
    const mesh = this.stacks[path[0]].pop();
    if (!mesh) return;
    const dest = path[path.length - 1];
    const level = this.stacks[dest].length;
    this.stacks[dest].push(mesh);
    const [x1, z1] = cellXZ(dest);
    if (!animate || this.reducedMotion) { mesh.position.set(x1, this.heightAt(level), z1); return; }
    const hop = 300;
    let from = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
    for (let k = 1; k < path.length; k++) {
      const [x, z] = cellXZ(path[k]);
      const last = k === path.length - 1;
      // Intermediate landings sit on whatever is there; only the last one is final.
      const y = last ? this.heightAt(level) : this.heightAt(this.stacks[path[k]].length);
      const a = from, b = { x, y, z };
      const lift = 0.5 + 0.22 * Math.hypot(b.x - a.x, b.z - a.z);
      this.tween(hop, (t) => {
        const e = easeInOut(t);
        mesh.position.set(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e + lift * Math.sin(Math.PI * e), a.z + (b.z - a.z) * e);
      }, (k - 1) * hop);
      from = b;
    }
  }

  // Makes the board show `view`. `fx.moved` lists paths pieces travelled, so
  // they slide or leap instead of vanishing and reappearing.
  apply(view, fx, { animate = true } = {}) {
    const want = view.cells;
    const moved = (fx && fx.moved) || [];
    for (const path of moved) if (path.length > 1 && this.stacks[path[0]].length) this.movePiece(path, animate);
    const settle = animate && moved.length ? 300 * Math.max(...moved.map((p) => p.length - 1)) : 0;
    for (let i = 0; i < N; i++) {
      const stack = this.stacks[i];
      const has = stack.map((m) => m.userData.code);
      const target = want[i] || [];
      if (sameStack(has, target)) continue;
      const extra = has.length - target.length;
      if (extra > 0 && sameStack(has.slice(extra), target)) {
        // Captured from underneath: the arriving piece replaces what was there.
        const gone = stack.splice(0, extra);
        const drop = () => {
          gone.forEach((m) => this.discard(m, animate));
          stack.forEach((m, k) => { m.position.y = this.heightAt(k); });
        };
        if (settle) this.tween(1, () => {}, settle - 60, drop); else drop();
      } else if (extra > 0 && sameStack(has.slice(0, target.length), target)) {
        stack.splice(target.length).forEach((m) => this.discard(m, animate));
      } else if (extra < 0 && sameStack(target.slice(0, has.length), has)) {
        for (let k = has.length; k < target.length; k++) this.addPiece(i, target[k], animate);
      } else {
        stack.splice(0).forEach((m) => this.discard(m, false));
        target.forEach((code) => this.addPiece(i, code, false));
      }
    }
    this.setRod(view.rod);
    // The rod already marks the latest stone.
    this.setMarker(!view.rod && fx && fx.last !== undefined ? fx.last : -1);
    this.needsRender = true;
  }

  clear() {
    for (const stack of this.stacks) stack.splice(0).forEach((m) => this.root.remove(m));
    this.clearEffects();
    this.setRod(null);
  }

  pieceCount() { return this.stacks.reduce((n, s) => n + s.length, 0); }

  setRod(rod) {
    this.rodPivot.visible = !!rod;
    if (rod) {
      const [x, z] = cellXZ(rod.cell);
      const stack = this.stacks[rod.cell];
      this.rodPivot.position.set(x, this.heightAt(stack.length - 1) + 0.3, z);
      // Light rod on a dark stone (the coffee bean), dark rod on a light one.
      const onDark = stack.length && stack[stack.length - 1].userData.code === 2;
      this.rod.material.color.setHex(onDark ? 0xf3eee4 : 0x2c1a10);
      // Axes 0, 1, 2 follow hex directions (1,0), (0,1), (-1,1): 0, -60 and -120 degrees.
      this.rodPivot.rotation.y = -rod.axis * Math.PI / 3;
    }
    this.needsRender = true;
  }

  setMarker(cell) {
    this.markerCell = cell;
    this.marker.visible = cell >= 0 && this.stacks[cell].length > 0;
    if (this.marker.visible) {
      const [x, z] = cellXZ(cell);
      const top = this.stacks[cell][this.stacks[cell].length - 1];
      const scale = PIECES[top.userData.code].scale;
      this.marker.position.set(x, this.heightAt(this.stacks[cell].length - 1) + 0.265 * scale, z);
    }
    this.needsRender = true;
  }

  // ---- effects ---------------------------------------------------------

  resetTile(i) { this.tiles[i].material.emissive.setScalar(0); }

  // Pulsing cells: where the player may tap next.
  setHints(list) {
    for (const i of this.hints) this.resetTile(i);
    this.hints = new Set(list || []);
    this.paintSelected();
    this.needsRender = true;
  }

  // Steady cells: what the player has picked up so far.
  setSelected(list) {
    for (const i of this.selected) this.resetTile(i);
    this.selected = new Set(list || []);
    this.paintSelected();
    this.needsRender = true;
  }

  paintSelected() {
    for (const i of this.selected) this.tiles[i].material.emissive.copy(SELECT).multiplyScalar(0.45);
  }

  // Highlights a finished line on its tiles: gold for a win, red for a loss.
  markLine(list, kind) {
    const colour = kind === 'lose' ? LOSE_GLOW : WIN_GLOW;
    list.forEach((cell, k) => this.glows.push({ tile: this.tiles[cell], colour, phase: k * 0.5 }));
    this.marker.visible = false;
    this.needsRender = true;
  }

  clearEffects() {
    for (const g of this.glows) g.tile.material.emissive.setScalar(0);
    this.glows = [];
    this.setHints([]);
    this.setSelected([]);
    this.setMarker(-1);
  }

  // ---- camera ----------------------------------------------------------

  setInsets(top, bottom, { animate = true } = {}) {
    const from = { ...this.insets };
    const to = { top, bottom };
    if (Math.abs(from.top - top) < 1 && Math.abs(from.bottom - bottom) < 1) return;
    if (!animate || this.reducedMotion) { this.insets = to; this.updateCamera(); return; }
    const id = (this.insetTween = (this.insetTween || 0) + 1);
    this.tween(450, (t) => {
      if (id !== this.insetTween) return; // a newer layout has taken over
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
      for (const i of this.hints) {
        if (!this.selected.has(i)) this.tiles[i].material.emissive.copy(HINT).multiplyScalar(0.18 + 0.32 * pulse);
      }
      for (const g of this.glows) {
        const p = 0.5 + 0.5 * Math.sin(now * 0.006 - g.phase);
        g.tile.material.emissive.copy(g.colour).multiplyScalar(0.3 + 0.5 * p);
      }
    }
    if (active) this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.frame(t));
  }
}
