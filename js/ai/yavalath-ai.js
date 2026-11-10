// Yavalath AI: a forced-win search over threat sequences on top of Monte Carlo
// tree search whose playouts respect the game's forcing moves.

import { N, NB, ringDistance } from '../hex.js';
import { classify, WIN, LOSE } from '../games/yavalath.js';

export const LEVELS = {
  easy: { ms: 120, maxIter: 250, attack: 0, defend: 0, blunder: 0.18 },
  medium: { ms: 500, maxIter: 1e9, attack: 4, defend: 2, blunder: 0 },
  hard: { ms: 1600, maxIter: 1e9, attack: 9, defend: 4, blunder: 0 },
};

function winningCells(b, p) {
  const out = [];
  for (let i = 0; i < N; i++) if (!b[i] && classify(b, i, p) === WIN) out.push(i);
  return out;
}

// Can p (to move) force a win within `depth` of their own moves, using only
// moves that threaten four? Returns the first move of the sequence, or -1.
function forcedWin(b, p, depth) {
  const o = 3 - p;
  const mine = winningCells(b, p);
  if (mine.length) return mine[0];
  if (depth <= 0) return -1;
  const theirs = winningCells(b, o);
  if (theirs.length > 1) return -1;
  for (let c = 0; c < N; c++) {
    if (b[c]) continue;
    if (theirs.length && c !== theirs[0]) continue;
    if (classify(b, c, p) !== 0) continue;
    b[c] = p;
    let won = false;
    const threats = winningCells(b, p);
    if (threats.length && winningCells(b, o).length === 0) {
      if (threats.length >= 2) {
        won = true;
      } else {
        const w = threats[0];
        if (classify(b, w, o) === LOSE) {
          won = true; // the only block completes a losing three
        } else {
          b[w] = o;
          won = forcedWin(b, p, depth - 1) >= 0;
          b[w] = 0;
        }
      }
    }
    b[c] = 0;
    if (won) return c;
  }
  return -1;
}

// Moves worth searching from this position: the forced ones if any exist,
// otherwise everything that does not lose on the spot.
function sensibleMoves(b, p) {
  const mine = winningCells(b, p);
  if (mine.length) return mine;
  const theirs = winningCells(b, 3 - p);
  if (theirs.length) return theirs;
  const safe = [];
  const all = [];
  for (let i = 0; i < N; i++) {
    if (b[i]) continue;
    all.push(i);
    if (classify(b, i, p) !== LOSE) safe.push(i);
  }
  return safe.length ? safe : all;
}

// Empty cells within three steps of c along the board's lines where p would win.
function localThreats(b, c, p, out) {
  out.length = 0;
  for (let d = 0; d < 6; d++) {
    let x = NB[c * 6 + d];
    for (let k = 0; k < 3 && x >= 0; k++, x = NB[x * 6 + d]) {
      if (!b[x] && classify(b, x, p) === WIN) out.push(x);
    }
  }
}

const empties = new Int16Array(N);
const posOf = new Int16Array(N);
const scratch = new Int8Array(N);
const threatsBy = [null, [], []];

// Plays the position out with light tactics. Returns the winner (1, 2) or 3 for a draw.
function playout(src, toMove) {
  const b = scratch;
  b.set(src);
  let n = 0;
  for (let i = 0; i < N; i++) if (!b[i]) { posOf[i] = n; empties[n++] = i; }
  threatsBy[1].length = 0;
  threatsBy[2].length = 0;
  let p = toMove;
  while (n > 0) {
    const o = 3 - p;
    let c = -1;
    for (const t of threatsBy[p]) if (!b[t] && classify(b, t, p) === WIN) return p;
    for (const t of threatsBy[o]) if (!b[t] && classify(b, t, o) === WIN) { c = t; break; }
    if (c < 0) {
      for (let tries = 0; tries < 6; tries++) {
        c = empties[(Math.random() * n) | 0];
        if (classify(b, c, p) !== LOSE) break;
      }
    }
    const kind = classify(b, c, p);
    if (kind === WIN) return p;
    if (kind === LOSE) return o;
    b[c] = p;
    const at = posOf[c];
    const moved = empties[--n];
    empties[at] = moved;
    posOf[moved] = at;
    localThreats(b, c, p, threatsBy[p]);
    p = o;
  }
  return 3;
}

function makeNode(parent, move, mover, b, toMove, terminal) {
  return {
    parent, move, mover, terminal,
    untried: terminal ? [] : sensibleMoves(b, toMove),
    children: [], visits: 0, score: 0,
  };
}

function search(board, player, candidates, level) {
  const b = board.slice();
  const root = makeNode(null, -1, 3 - player, b, player, 0);
  root.untried = candidates.slice();
  const deadline = Date.now() + level.ms;
  let iter = 0;
  while (iter < level.maxIter && (iter & 63 || Date.now() < deadline)) {
    iter++;
    b.set(board);
    let node = root;
    let p = player;
    while (!node.untried.length && node.children.length) {
      let best = null;
      let bestU = -Infinity;
      const lnv = Math.log(node.visits);
      for (const ch of node.children) {
        const u = ch.score / ch.visits + 0.9 * Math.sqrt(lnv / ch.visits);
        if (u > bestU) { bestU = u; best = ch; }
      }
      node = best;
      b[node.move] = p;
      p = 3 - p;
    }
    if (node.untried.length) {
      const k = (Math.random() * node.untried.length) | 0;
      const m = node.untried[k];
      node.untried[k] = node.untried[node.untried.length - 1];
      node.untried.pop();
      const kind = classify(b, m, p);
      b[m] = p;
      const terminal = kind === WIN ? p : kind === LOSE ? 3 - p : 0;
      const child = makeNode(node, m, p, b, 3 - p, terminal);
      node.children.push(child);
      node = child;
      p = 3 - p;
    }
    const winner = node.terminal || playout(b, p);
    for (let x = node; x; x = x.parent) {
      x.visits++;
      x.score += winner === 3 ? 0.5 : winner === x.mover ? 1 : 0;
    }
  }
  let best = null;
  for (const ch of root.children) if (!best || ch.visits > best.visits) best = ch;
  return { move: best ? best.move : candidates[0], iterations: iter };
}

// Picks a move for `player` on board `b` (Int8Array of 0 / 1 / 2).
export function chooseMove(board, player, levelName) {
  const level = LEVELS[levelName] || LEVELS.medium;
  const b = board.slice();
  const o = 3 - player;
  let stones = 0;
  for (let i = 0; i < N; i++) if (b[i]) stones++;

  if (stones === 0) {
    // Open somewhere the swap is a real decision: not the strong centre, not the weak rim.
    const ring = [];
    for (let i = 0; i < N; i++) if (ringDistance(i) === 3) ring.push(i);
    return { move: ring[(Math.random() * ring.length) | 0], reason: 'opening' };
  }

  let candidates = sensibleMoves(b, player);
  if (candidates.length === 1) return { move: candidates[0], reason: 'forced' };

  if (level.blunder && Math.random() < level.blunder) {
    return { move: candidates[(Math.random() * candidates.length) | 0], reason: 'casual' };
  }

  if (level.attack) {
    // Shallowest first, so the AI takes the quickest win it can see.
    for (let depth = 1; depth <= level.attack; depth++) {
      const m = forcedWin(b, player, depth);
      if (m >= 0) return { move: m, reason: 'forced-win' };
    }
  }

  if (level.defend && candidates.length > 1) {
    const safe = candidates.filter((c) => {
      b[c] = player;
      const lost = forcedWin(b, o, level.defend) >= 0;
      b[c] = 0;
      return !lost;
    });
    if (safe.length) candidates = safe;
    if (candidates.length === 1) return { move: candidates[0], reason: 'only-defence' };
  }

  const res = search(b, player, candidates, level);
  return { move: res.move, reason: 'search', iterations: res.iterations };
}

// Should Black take over White's opening stone?
export function shouldSwap(openingCell) {
  return ringDistance(openingCell) <= 2;
}
