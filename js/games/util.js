// Helpers shared by the rules modules.
//
// Every game module exports an object with the same shape:
//   seats        names of the sides, in turn order ("White", "Black", ...)
//   seatColors   piece code shown for each seat
//   setup(opts)  -> state. opts.seed for random set-ups, opts.blank for lessons
//   clone(s)     -> independent copy
//   moves(s)     -> legal moves for s.toMove; a move is { path: [cells], pick? }
//   play(s, m)   applies a move in place; sets s.winner (0 none, seat, -1 draw),
//                s.reason, s.fx = { moved, last }, and s.line / s.lineKind
//   view(s)      -> { cells: [[piece codes bottom..top] per cell], rod? }
// plus optional hooks for the UI (picks, prompt), the AI (evaluate, cutoff,
// searchMoves, chooseMove) and the swap rule (canSwap, shouldSwap).

import { N, NB, cells, RADIUS } from '../hex.js';

export const W = 1, B = 2, R = 3, CRUMB = 4;

// Marks used by flood fills; bumped instead of cleared.
const seen = new Int32Array(N);
let stamp = 0;
const queue = new Int16Array(N);

// Cells of the same value connected to `start`. Returns a fresh array.
export function group(b, start) {
  const v = b[start];
  stamp++;
  let head = 0, tail = 0;
  queue[tail++] = start;
  seen[start] = stamp;
  while (head < tail) {
    const c = queue[head++];
    for (let d = 0; d < 6; d++) {
      const x = NB[c * 6 + d];
      if (x >= 0 && seen[x] !== stamp && b[x] === v) { seen[x] = stamp; queue[tail++] = x; }
    }
  }
  return Array.from(queue.subarray(0, tail));
}

// Sizes of all groups of colour v.
export function groupSizes(b, v) {
  const done = new Uint8Array(N);
  const sizes = [];
  for (let i = 0; i < N; i++) {
    if (b[i] !== v || done[i]) continue;
    const g = group(b, i);
    for (const c of g) done[c] = 1;
    sizes.push(g.length);
  }
  return sizes;
}

export function hasLiberty(b, cellsOfGroup) {
  for (const c of cellsOfGroup) {
    for (let d = 0; d < 6; d++) {
      const x = NB[c * 6 + d];
      if (x >= 0 && !b[x]) return true;
    }
  }
  return false;
}

// Longest straight run through c of cells accepted by `ok`, as a list of cells
// with at least `min` members, or null.
export function lineThrough(c, min, ok) {
  for (let d = 0; d < 3; d++) {
    let start = c;
    for (let x = NB[start * 6 + d + 3]; x >= 0 && ok(x); x = NB[x * 6 + d + 3]) start = x;
    const out = [];
    for (let x = start; x >= 0 && ok(x); x = NB[x * 6 + d]) out.push(x);
    if (out.length >= min) return out;
  }
  return null;
}

// Every straight window of five cells on the board.
export const FIVES = [];
for (let c = 0; c < N; c++) {
  for (let d = 0; d < 3; d++) {
    const win = [c];
    let x = c;
    while (win.length < 5 && (x = NB[x * 6 + d]) >= 0) win.push(x);
    if (win.length === 5) FIVES.push(win);
  }
}
export const FIVES_AT = Array.from({ length: N }, () => []);
FIVES.forEach((win) => win.forEach((c) => FIVES_AT[c].push(win)));

export function hexDistance(a, b) {
  const A = cells[a], C = cells[b];
  const dq = A.q - C.q, dr = A.r - C.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

// Bitmask of the board sides a cell lies on, numbered clockwise so that sides
// i and i + 3 are opposite. Corner cells belong to two sides.
export const SIDES = new Uint8Array(N);
for (const { q, r, i } of cells) {
  const y = -q - r;
  const on = [q === RADIUS, r === -RADIUS, y === RADIUS, q === -RADIUS, r === RADIUS, y === -RADIUS];
  on.forEach((hit, k) => { if (hit) SIDES[i] |= 1 << k; });
}
export const EDGE = [];
for (let i = 0; i < N; i++) if (SIDES[i]) EDGE.push(i);

export const rowOf = (i) => cells[i].r;

// Small seeded generator, so random set-ups can be replayed from a saved game.
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const boardView = (b) => ({ cells: Array.from(b, (v) => (v ? [v] : [])) });
export const emptyCells = (b) => { const out = []; for (let i = 0; i < N; i++) if (!b[i]) out.push(i); return out; };
export const countOf = (b, v) => { let n = 0; for (let i = 0; i < N; i++) if (b[i] === v) n++; return n; };
export const cloneBoardState = (s) => ({ ...s, b: s.b.slice(), fx: null });

// Rewards array for evaluate(): index by seat, seat 0 unused.
export function share(seats, favoured, p) {
  const out = new Array(seats + 1).fill((1 - p) / Math.max(seats - 1, 1));
  out[0] = 0;
  out[favoured] = p;
  return out;
}
export const sigmoid = (x) => 1 / (1 + Math.exp(-x));

// Lesson helper: place pieces of one kind at [q, r] coordinates.
import { at } from '../hex.js';
export const P = (q, r) => at(q, r);
export function put(b, v, list) { for (const [q, r] of list) b[at(q, r)] = v; }
