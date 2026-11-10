// Yavalath rules. Pure logic, shared by the UI thread and the AI worker.
//
// Players are 1 (White, moves first) and 2 (Black). A move is a cell index.
// Four or more in a row wins; exactly three without four loses.

import { N, NB } from '../hex.js';

export const WIN = 2;
export const LOSE = 1;
export const NEUTRAL = 0;

export function newState() {
  return { b: new Int8Array(N), turn: 1, count: 0, winner: 0, line: null, lostByThree: false, last: -1 };
}

export function cloneState(s) {
  return { ...s, b: s.b.slice(), line: s.line ? s.line.slice() : null };
}

// Length of player p's run through cell c on one axis, assuming c holds p.
function run(b, c, p, d) {
  let n = 1;
  for (let x = NB[c * 6 + d]; x >= 0 && b[x] === p; x = NB[x * 6 + d]) n++;
  const e = d + 3;
  for (let x = NB[c * 6 + e]; x >= 0 && b[x] === p; x = NB[x * 6 + e]) n++;
  return n;
}

// What happens if p places on empty cell c: WIN, LOSE or NEUTRAL.
export function classify(b, c, p) {
  let three = false;
  for (let d = 0; d < 3; d++) {
    const n = run(b, c, p, d);
    if (n >= 4) return WIN;
    if (n === 3) three = true;
  }
  return three ? LOSE : NEUTRAL;
}

function lineCells(b, c, p, wanted) {
  for (let d = 0; d < 3; d++) {
    const n = run(b, c, p, d);
    if (wanted === WIN ? n < 4 : n !== 3) continue;
    let start = c;
    for (let x = NB[start * 6 + d + 3]; x >= 0 && b[x] === p; x = NB[x * 6 + d + 3]) start = x;
    const out = [];
    for (let x = start; x >= 0 && b[x] === p; x = NB[x * 6 + d]) out.push(x);
    return out;
  }
  return null;
}

export function legalMoves(s) {
  const out = [];
  if (s.winner) return out;
  for (let i = 0; i < N; i++) if (!s.b[i]) out.push(i);
  return out;
}

// Applies a move in place. winner: 0 = in progress, 1 / 2 = that player, 3 = draw.
export function play(s, c) {
  const p = s.turn;
  const kind = classify(s.b, c, p);
  s.b[c] = p;
  s.count++;
  s.last = c;
  if (kind === WIN) {
    s.winner = p;
    s.line = lineCells(s.b, c, p, WIN);
  } else if (kind === LOSE) {
    s.winner = 3 - p;
    s.line = lineCells(s.b, c, p, LOSE);
    s.lostByThree = true;
  } else if (s.count === N) {
    s.winner = 3;
  }
  s.turn = 3 - p;
  return s;
}

export function replay(moves) {
  const s = newState();
  for (const m of moves) play(s, m);
  return s;
}
