// Susan (Stephen Linhart, 1991). Place or slide; surround any single enemy
// stone to win, but never leave one of your own surrounded.

import { N, NB } from '../hex.js';
import { W, B, P, put, boardView, cloneBoardState, countOf, share, sigmoid } from './util.js';

function freedoms(b, c) {
  let n = 0;
  for (let d = 0; d < 6; d++) { const x = NB[c * 6 + d]; if (x >= 0 && !b[x]) n++; }
  return n;
}
const surrounded = (b, v) => { for (let i = 0; i < N; i++) if (b[i] === v && !freedoms(b, i)) return i; return -1; };

export default {
  id: 'susan',
  seats: ['White', 'Black'],
  seatColors: [W, B],
  cutoff: 10,

  setup: () => ({ b: new Int8Array(N), toMove: 1, slides: 0, ply: 0, winner: 0 }),
  clone: cloneBoardState,
  view: (s) => boardView(s.b),
  prompt: () => 'Place a stone, or tap one of yours to slide it',

  moves(s) {
    const out = [];
    if (s.winner) return out;
    const p = s.toMove, b = s.b;
    const stock = countOf(b, p) < 30;
    for (let c = 0; c < N; c++) {
      if (!b[c]) { if (stock) out.push({ path: [c] }); continue; }
      if (b[c] !== p) continue;
      for (let d = 0; d < 6; d++) { const x = NB[c * 6 + d]; if (x >= 0 && !b[x]) out.push({ path: [c, x] }); }
    }
    return out;
  },

  play(s, m) {
    const p = s.toMove, b = s.b;
    const to = m.path[m.path.length - 1];
    if (m.path.length === 2) { b[m.path[0]] = 0; s.slides++; s.fx = { moved: [m.path], last: to }; } else { s.slides = 0; s.fx = { last: to }; }
    b[to] = p;
    s.ply++;
    s.toMove = 3 - p;
    const own = surrounded(b, p), enemy = surrounded(b, 3 - p);
    if (own >= 0) {
      s.winner = 3 - p; s.line = [own]; s.lineKind = 'lose';
      s.reason = [p, 'left one of their own stones surrounded'];
    } else if (enemy >= 0) {
      s.winner = p; s.line = [enemy]; s.lineKind = 'win';
      s.reason = [p, 'surrounded an enemy stone'];
    } else if (s.slides >= 6) {
      s.winner = -1; s.reason = [0, 'Six slides in a row with no stone placed.'];
    } else if (!this.moves(s).length) {
      s.winner = p; s.reason = [3 - p, 'had no legal move'];
    }
  },

  // Stones close to being surrounded are what matter.
  evaluate(s) {
    let score = 0;
    for (let i = 0; i < N; i++) {
      if (!s.b[i]) continue;
      const f = freedoms(s.b, i);
      const danger = f === 1 ? 3 : f === 2 ? 1 : 0;
      score += s.b[i] === W ? -danger : danger;
    }
    return share(2, 1, sigmoid(score / 4));
  },

  rules: [
    'On your turn, either place a new stone of your colour on an empty cell, or slide one of your stones already on the board to an adjacent empty cell. You cannot pass. White goes first.',
    'You win as soon as any enemy stone is surrounded on all sides. Your stones, enemy stones and the edge of the board all count as surrounding it.',
    'If one of your own stones is surrounded at the end of your turn, you lose, even if an enemy stone is surrounded too.',
    'If six moves in a row are slides (three by each player), the game is a draw.',
  ],

  lesson: [
    {
      title: 'Place a stone',
      text: 'On your turn you may place a new stone on any empty cell. Tap a cell to place one.',
      build(s) { put(s.b, W, [[-1, 1]]); put(s.b, B, [[1, -1]]); },
      any: true,
      want: (m) => m.path.length === 1,
      miss: 'That was a slide. For now, tap an empty cell to place a new stone.',
      done: 'That is one of the two things you can do on a turn.',
    },
    {
      title: 'Or slide one',
      text: 'Instead of placing, you may slide one of your stones to an empty cell next to it. Tap a white stone, then tap a glowing neighbour.',
      build(s) { put(s.b, W, [[-1, 1], [0, 0]]); put(s.b, B, [[1, -1], [2, 0]]); },
      any: true,
      want: (m) => m.path.length === 2,
      miss: 'That placed a new stone. This time tap a white stone first, then where it should slide.',
      done: 'One step, to any empty neighbour. Sliding lets a stone escape, or close a gap.',
    },
    {
      title: 'Surround one stone to win',
      text: 'You win the moment any single enemy stone has no empty cell next to it. Other stones of either colour and the board edge all count. This black stone in the corner has one free neighbour left.',
      build(s) { put(s.b, B, [[4, -4], [0, 1], [-2, 0]]); put(s.b, W, [[3, -4], [3, -3], [-1, -1]]); },
      solve: { path: [P(4, -3)] },
      miss: 'The black corner stone can still breathe. Take its last empty neighbour.',
      done: 'No empty cell touches the black stone. White wins. Corners and edges are dangerous places to stand.',
    },
    {
      title: 'Do not smother yourself',
      text: 'The same rule cuts both ways: if one of your own stones is surrounded when your turn ends, you lose. Tap the glowing hole to see it.',
      build(s) { put(s.b, B, [[1, 0], [-1, 1], [0, -1], [3, -1]]); put(s.b, W, [[0, 1], [-1, 0], [1, -1], [-3, 2]]); },
      solve: { path: [P(0, 0)] },
      show: true,
      done: 'Your new stone had no empty neighbour, so White loses. Every placement next to a crowd needs a second look.',
    },
  ],
};
