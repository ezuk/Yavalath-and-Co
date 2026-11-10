// Cross (Cameron Browne, 2011). Connect three non-adjacent sides to win;
// connect two opposite sides and you lose.

import { N, ringDistance } from '../hex.js';
import { W, B, P, put, boardView, cloneBoardState, emptyCells, group, SIDES } from './util.js';

function verdict(b, c) {
  const g = group(b, c);
  let mask = 0;
  for (const x of g) mask |= SIDES[x];
  if ((mask & 0b010101) === 0b010101 || (mask & 0b101010) === 0b101010) return { kind: 'win', g };
  if (mask & (mask >> 3) & 0b111) return { kind: 'lose', g };
  return null;
}

export default {
  id: 'cross',
  seats: ['White', 'Black'],
  seatColors: [W, B],

  setup: () => ({ b: new Int8Array(N), toMove: 1, ply: 0, winner: 0 }),
  clone: cloneBoardState,
  view: (s) => boardView(s.b),
  moves: (s) => (s.winner ? [] : emptyCells(s.b).map((c) => ({ path: [c] }))),

  play(s, m) {
    const c = m.path[0], p = s.toMove;
    s.b[c] = p;
    s.ply++;
    s.fx = { last: c };
    const v = verdict(s.b, c);
    if (v) {
      s.winner = v.kind === 'win' ? p : 3 - p; s.line = v.g; s.lineKind = v.kind;
      s.reason = [p, v.kind === 'win' ? 'connected three non-adjacent sides' : 'connected two opposite sides, which loses'];
    } else if (s.ply === N) {
      s.winner = -1; s.reason = [0, 'The board filled up with no connection made.'];
    }
    s.toMove = 3 - p;
  },

  canSwap: (s) => s.ply === 1,
  shouldSwap: (s) => ringDistance(s.b.findIndex((v) => v)) <= 2,

  rules: [
    'Players take turns placing one stone of their colour on any empty cell. White goes first.',
    'You win by connecting three sides of the board, no two of them next to each other, with one chain of your stones.',
    'You lose by connecting two opposite sides with a chain of your stones, unless that chain also connects three non-adjacent sides.',
    'Each corner cell belongs to both sides that meet there.',
    'After White’s first stone, Black may swap sides and take that stone instead of placing one.',
  ],

  lesson: [
    {
      title: 'Join three sides',
      text: 'The board has six sides. Connect three of them, skipping one between each, with a single chain of your stones and you win. White needs one more stone.',
      build(s) {
        put(s.b, W, [[1, 0], [2, -1], [3, -1], [4, -2], [0, -1], [-1, -1], [-1, -2], [-2, -2], [0, 1], [-1, 2], [-1, 3], [-2, 4]]);
        put(s.b, B, [[1, 1], [2, 1], [-2, 1], [-3, 2], [1, -2], [2, -3], [-2, 0], [3, 0]]);
      },
      solve: { path: [P(0, 0)] },
      miss: 'White has three arms reaching three sides. Join them where they meet.',
      done: 'One chain touching three alternating sides. White wins.',
    },
    {
      title: 'Never join opposite sides',
      text: 'Connecting two sides directly across from each other loses. White’s chain runs from the top side almost to the bottom. Tap the glowing cell to see what happens.',
      build(s) {
        put(s.b, W, [[2, -4], [2, -3], [1, -2], [1, -1], [0, 1], [-1, 2], [-1, 3], [-2, 4]]);
        put(s.b, B, [[0, -1], [-1, 0], [1, 0], [2, 0], [-2, 2], [0, 2], [3, -3]]);
      },
      solve: { path: [P(0, 0)] },
      show: true,
      done: 'Top joined to bottom: White loses. Much of the game is forcing your opponent to complete a connection like this.',
    },
    {
      title: 'Corners and the swap',
      text: 'Two details. A corner cell counts as part of both sides it sits on. And after White’s first stone, Black may swap sides and take it, so do not open too strongly.',
      build(s) { put(s.b, W, [[4, -4]]); },
      info: true,
    },
  ],
};
