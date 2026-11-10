// Yavalath (Ludi by Cameron Browne, 2007). Four or more in a row wins; exactly three loses.

import { N, NB, ringDistance } from '../hex.js';
import { W, B, P, put, boardView, cloneBoardState, emptyCells } from './util.js';
import { chooseMove as search } from '../ai/yavalath-ai.js';

export const WIN = 2, LOSE = 1, NEUTRAL = 0;

function run(b, c, p, d) {
  let n = 1;
  for (let x = NB[c * 6 + d]; x >= 0 && b[x] === p; x = NB[x * 6 + d]) n++;
  for (let x = NB[c * 6 + d + 3]; x >= 0 && b[x] === p; x = NB[x * 6 + d + 3]) n++;
  return n;
}

// What happens if p places on empty cell c.
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

export default {
  id: 'yavalath',
  seats: ['White', 'Black'],
  seatColors: [W, B],

  setup: () => ({ b: new Int8Array(N), toMove: 1, ply: 0, winner: 0 }),
  clone: cloneBoardState,
  view: (s) => boardView(s.b),
  moves: (s) => (s.winner ? [] : emptyCells(s.b).map((c) => ({ path: [c] }))),

  play(s, m) {
    const c = m.path[0], p = s.toMove;
    const kind = classify(s.b, c, p);
    s.b[c] = p;
    s.ply++;
    s.fx = { last: c };
    if (kind === WIN) {
      s.winner = p; s.line = lineCells(s.b, c, p, WIN); s.lineKind = 'win';
      s.reason = [p, 'made four in a row'];
    } else if (kind === LOSE) {
      s.winner = 3 - p; s.line = lineCells(s.b, c, p, LOSE); s.lineKind = 'lose';
      s.reason = [p, 'made three in a row, which loses'];
    } else if (s.ply === N) {
      s.winner = -1; s.reason = [0, 'The board filled up with no line of four and no line of three.'];
    }
    s.toMove = 3 - p;
  },

  canSwap: (s) => s.ply === 1,
  shouldSwap: (s) => ringDistance(s.b.findIndex((v) => v)) <= 2,
  chooseMove: (s, level) => ({ path: [search(s.b, s.toMove, level).move] }),

  rules: [
    'Players take turns placing one stone of their colour on any empty cell. White goes first. Stones never move.',
    'You win by making a straight line of four or more of your stones.',
    'You lose by making a straight line of exactly three, unless the same stone also completes four.',
    'After White’s first stone, Black may swap sides and take that stone instead of placing one.',
    'If the board fills with no line made, the game is a draw.',
  ],

  lesson: [
    {
      title: 'One stone a turn',
      text: 'You and your opponent take turns placing a single stone. Once placed, a stone never moves. Tap any cell to place a white stone.',
      any: true,
      reply: (s) => ({ path: [s.b[P(2, -1)] ? P(-2, 1) : P(2, -1)] }),
      replyText: 'Black answers with a stone of their own, and the turn comes back to you. That is all a move ever is.',
    },
    {
      title: 'Four in a row wins',
      text: 'Make a straight line of four or more of your stones and you win. White can win right now. Find the cell.',
      build(s) { put(s.b, W, [[-1, 0], [0, 0], [2, 0]]); put(s.b, B, [[0, 1], [-1, 2], [1, -2]]); },
      solve: { path: [P(1, 0)] },
      miss: 'Not that one. Look for the gap in White’s row.',
      done: 'Four in a row. White wins.',
    },
    {
      title: 'Three in a row loses',
      text: 'Here is the twist. A line of exactly three loses the game. Tap the glowing cell to see it happen.',
      build(s) { put(s.b, W, [[0, 0], [1, 0]]); put(s.b, B, [[0, -2], [-2, 1]]); },
      solve: { path: [P(2, 0)] },
      show: true,
      done: 'Three in a row, so White loses on the spot. The one exception: if the same stone also completes four, it still wins.',
    },
    {
      title: 'Force the mistake',
      text: 'So the real game is making your opponent line up three. Black has two stones with a gap between them. Threaten four so that Black’s only block is that gap.',
      build(s) { put(s.b, W, [[-2, 0], [-1, 0]]); put(s.b, B, [[0, -1], [0, 1]]); },
      solve: { path: [P(1, 0)] },
      miss: (m, s) => (classify(s.b, m.path[0], W) === LOSE
        ? 'That would give White three in a row, which loses. Try again.'
        : 'That does not force anything. Aim a row of four through the gap between Black’s stones.'),
      done: 'White now threatens four through the centre. Black has to block…',
      reply: () => ({ path: [P(0, 0)] }),
      replyText: '…and the block makes three in a row. Black loses. Setting up moves like this is the heart of Yavalath.',
    },
    {
      title: 'The swap',
      text: 'One last rule. After White’s very first stone, Black may swap sides and take that stone as their own. So do not open too strongly, or your opponent will simply steal it.',
      build(s) { put(s.b, W, [[0, 0]]); },
      info: true,
    },
  ],
};
