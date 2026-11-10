// Shared geometry for the 61-cell hex-hex board (5 cells per side).
// Cells use axial coordinates (q, r) with |q|, |r|, |q + r| <= RADIUS.
// Pure data: imported by the renderer, the rules modules and the AI worker.

export const RADIUS = 4;
export const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

export const cells = [];
const byKey = new Map();
for (let r = -RADIUS; r <= RADIUS; r++) {
  for (let q = -RADIUS; q <= RADIUS; q++) {
    if (Math.abs(q + r) > RADIUS) continue;
    byKey.set(q + ',' + r, cells.length);
    cells.push({ q, r, i: cells.length });
  }
}

export const N = cells.length; // 61
export const CENTER = byKey.get('0,0');

export function at(q, r) {
  const i = byKey.get(q + ',' + r);
  return i === undefined ? -1 : i;
}

// NB[i * 6 + d] is the neighbour of cell i in direction d, or -1 off-board.
export const NB = new Int8Array(N * 6);
for (const c of cells) {
  for (let d = 0; d < 6; d++) {
    NB[c.i * 6 + d] = at(c.q + DIRS[d][0], c.r + DIRS[d][1]);
  }
}

export function ringDistance(i) {
  const { q, r } = cells[i];
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

// Board-space position of a cell centre (pointy-top hexes, unit circumradius).
const SQRT3 = Math.sqrt(3);
export function cellXZ(i) {
  const { q, r } = cells[i];
  return [SQRT3 * (q + r / 2), 1.5 * r];
}
