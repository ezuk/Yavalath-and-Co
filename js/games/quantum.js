// Quantum Leap (Néstor Romeral Andrés, 2013). Stones only move by capturing,
// and leap exactly as far as they have friendly neighbours.

import { N, NB, CENTER } from '../hex.js';
import { W, B, P, put, boardView, cloneBoardState, rng } from './util.js';

function friends(b, c) {
  let n = 0;
  for (let d = 0; d < 6; d++) { const x = NB[c * 6 + d]; if (x >= 0 && b[x] === b[c]) n++; }
  return n;
}

function captures(b, p) {
  const out = [];
  for (let c = 0; c < N; c++) {
    if (b[c] !== p) continue;
    const reach = friends(b, c);
    if (!reach) continue;
    for (let d = 0; d < 6; d++) {
      let x = c;
      for (let k = 0; k < reach && x >= 0; k++) x = NB[x * 6 + d];
      if (x >= 0 && b[x] === 3 - p) out.push({ path: [c, x] });
    }
  }
  return out;
}

export default {
  id: 'quantum',
  seats: ['White', 'Black'],
  seatColors: [W, B],
  hintStart: true,

  setup({ seed = 1, blank } = {}) {
    const s = { b: new Int8Array(N), toMove: 2, phase: 'swap', ply: 0, winner: 0 };
    if (blank) { s.phase = 'play'; s.toMove = 1; return s; }
    const rand = rng(seed);
    const order = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    // The one empty cell may be anywhere except the centre.
    if (order[N - 1] === CENTER) [order[0], order[N - 1]] = [order[N - 1], order[0]];
    order.slice(0, N - 1).forEach((c, k) => { s.b[c] = k < 30 ? W : B; });
    return s;
  },
  clone: cloneBoardState,
  view: (s) => boardView(s.b),
  picks: (s) => (s.phase === 'swap' ? [{ id: 'keep', label: 'Keep the board as it is', action: true }] : []),
  prompt: (s) => (s.phase === 'swap' ? 'Tap two stones to swap them, or keep the board' : 'Tap a stone, then the enemy stone it captures'),

  moves(s) {
    if (s.winner) return [];
    if (s.phase === 'play') return captures(s.b, s.toMove);
    const out = [{ pick: 'keep', path: [] }];
    for (let a = 0; a < N; a++) for (let c = 0; c < N; c++) if (s.b[a] && s.b[c] && s.b[a] !== s.b[c]) out.push({ path: [a, c] });
    return out;
  },
  // The search does not try to judge the opening swap.
  searchMoves(s) { return s.phase === 'swap' ? [{ pick: 'keep', path: [] }] : this.moves(s); },

  play(s, m) {
    const b = s.b;
    s.ply++;
    if (s.phase === 'swap') {
      if (m.path.length) { const [a, c] = m.path; [b[a], b[c]] = [b[c], b[a]]; }
      s.phase = 'play'; s.toMove = 1; s.fx = {};
    } else {
      const [from, to] = m.path, p = s.toMove;
      b[to] = p; b[from] = 0;
      s.fx = { moved: [m.path], last: to };
      s.toMove = 3 - p;
    }
    if (!captures(b, s.toMove).length) {
      s.winner = 3 - s.toMove; s.reason = [s.toMove, 'had no capture to make'];
    }
  },

  rules: [
    'The thirty white and thirty black stones are spread at random over the board, leaving one cell empty.',
    'Before play begins, Black may swap the positions of any two stones. Then White moves first.',
    'On your turn you must make one capture. A stone leaps in a straight line, exactly as many cells as it has friendly stones next to it, and must land on an enemy stone, which is removed. It may leap over other stones.',
    'A stone with no friendly neighbours cannot move.',
    'If you cannot make a capture on your turn, you lose.',
  ],

  lesson: [
    {
      title: 'Count your neighbours',
      text: 'A stone leaps exactly as many cells as it has friendly stones touching it. The white stone in the middle touches two others, so it leaps two cells. Tap it, then tap the black stone it can reach.',
      build(s) { put(s.b, W, [[0, 0], [1, 0], [0, 1]]); put(s.b, B, [[-2, 0], [4, -4]]); },
      solve: { path: [P(0, 0), P(-2, 0)] },
      miss: 'Tap the white stone with two white neighbours, then the black stone two cells away in a straight line.',
      done: 'It landed on the black stone and captured it. Stones may leap over anything in between. Black’s last stone has no friends beside it, so it cannot move, and White wins.',
    },
    {
      title: 'Every move is a capture',
      text: 'Stones never move any other way. On your turn you must capture, and a leap must land exactly on an enemy stone. The glowing stones are the ones that can capture right now. Make any capture.',
      build(s) {
        put(s.b, W, [[0, 0], [1, 0], [-1, 1], [2, -2], [2, -3], [-3, 2]]);
        put(s.b, B, [[-1, 0], [2, 0], [0, -2], [1, -2], [-2, 3], [3, -1], [-2, 2]]);
      },
      any: true,
      done: 'Each capture changes who is next to whom, so every stone’s reach keeps shifting.',
    },
    {
      title: 'Last capture wins',
      text: 'If you cannot capture on your turn, you lose. A stone on its own has no reach at all, so keep your stones in groups and break up your opponent’s. In a real game the board starts full, and Black may first swap any two stones.',
      build(s) { put(s.b, W, [[0, 0], [1, 0], [0, 1], [-3, 1]]); put(s.b, B, [[2, -2], [-2, 3], [3, 0]]); },
      info: true,
    },
  ],
};
