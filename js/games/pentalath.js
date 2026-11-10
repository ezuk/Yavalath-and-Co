// Pentalath (LUDI, 2007). Five in a row, with Go-style capture.

import { N, NB } from '../hex.js';
import { W, B, P, put, boardView, cloneBoardState, group, hasLiberty, lineThrough, FIVES, share, sigmoid } from './util.js';

// Enemy groups next to c that have no freedom left.
function captures(b, c, p) {
  const out = [];
  for (let d = 0; d < 6; d++) {
    const x = NB[c * 6 + d];
    if (x < 0 || b[x] !== 3 - p || out.includes(x)) continue;
    const g = group(b, x);
    if (!hasLiberty(b, g)) out.push(...g);
  }
  return out;
}

function legal(b, c, p) {
  for (let d = 0; d < 6; d++) { const x = NB[c * 6 + d]; if (x >= 0 && !b[x]) return true; }
  b[c] = p;
  const ok = captures(b, c, p).length > 0 || hasLiberty(b, group(b, c));
  b[c] = 0;
  return ok;
}

export default {
  id: 'pentalath',
  seats: ['White', 'Black'],
  seatColors: [W, B],
  cutoff: 14,

  setup: () => ({ b: new Int8Array(N), toMove: 1, ply: 0, winner: 0 }),
  clone: cloneBoardState,
  view: (s) => boardView(s.b),

  moves(s) {
    const out = [];
    if (s.winner) return out;
    for (let c = 0; c < N; c++) if (!s.b[c] && legal(s.b, c, s.toMove)) out.push({ path: [c] });
    return out;
  },

  play(s, m) {
    const c = m.path[0], p = s.toMove, b = s.b;
    b[c] = p;
    for (const x of captures(b, c, p)) b[x] = 0;
    s.ply++;
    s.fx = { last: c };
    const line = lineThrough(c, 5, (x) => b[x] === p);
    s.toMove = 3 - p;
    if (line) {
      s.winner = p; s.line = line; s.lineKind = 'win'; s.reason = [p, 'made five in a row'];
    } else if (s.ply > 400 || !this.moves(s).length) {
      s.winner = -1; s.reason = [0, 'Neither side can make five.'];
    }
  },

  // Open fives, weighted by how full they already are.
  evaluate(s) {
    let score = 0;
    for (const win of FIVES) {
      let w = 0, k = 0;
      for (const c of win) { if (s.b[c] === W) w++; else if (s.b[c] === B) k++; }
      if (w && !k) score += 4 ** w; else if (k && !w) score -= 4 ** k;
    }
    return share(2, 1, sigmoid(score / 150));
  },

  rules: [
    'Players take turns placing one stone of their colour on an empty cell. White goes first. Passing is not allowed.',
    'After each move, enemy stones with no freedom are captured and removed. A stone has freedom if the group it belongs to touches an empty cell.',
    'You may not place a stone where it would have no freedom, unless that move captures enemy stones and so makes room.',
    'You win by making a straight line of five or more of your stones.',
  ],

  lesson: [
    {
      title: 'Five in a row',
      text: 'Take turns placing stones. The first to line up five of their own wins. White has four in a row here: finish it.',
      build(s) { put(s.b, W, [[-2, 0], [-1, 0], [0, 0], [1, 0]]); put(s.b, B, [[-3, 0], [0, 1], [1, 1], [-1, -1]]); },
      solve: { path: [P(2, 0)] },
      miss: 'That leaves the row at four. Extend it to five.',
      done: 'Five in a row. White wins.',
    },
    {
      title: 'Capture what is surrounded',
      text: 'A group needs at least one empty cell touching it. These two black stones have a single freedom left. Take it away.',
      build(s) {
        put(s.b, B, [[0, 0], [1, 0], [-3, 2], [3, -3]]);
        put(s.b, W, [[0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1], [1, 1], [2, -1]]);
      },
      solve: { path: [P(2, 0)] },
      miss: 'The black pair still has a freedom. Fill the last empty cell that touches it.',
      done: 'With no freedom left, the black group is captured and comes off the board. Captures are how you clear stones that block your line.',
    },
    {
      title: 'No suicide, except to capture',
      text: 'You may not place a stone where it would have no freedom. The glowing corner looks like that for White, but the stone captures first and makes its own room. Tap it.',
      build(s) {
        put(s.b, B, [[3, -4], [3, -3], [4, -3], [-2, 1]]);
        put(s.b, W, [[2, -4], [2, -3], [2, -2], [3, -2], [4, -2]]);
      },
      solve: { path: [P(4, -4)] },
      show: true,
      done: 'Legal, because the three black stones were captured by the move. Without a capture, that cell would have been off limits.',
    },
  ],
};
