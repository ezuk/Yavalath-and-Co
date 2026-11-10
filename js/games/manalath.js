// Manalath (Dieter Stein and Néstor Romeral Andrés, 2012). Place either
// colour. A group of five of your colour wins; a group of four loses.

import { N, NB } from '../hex.js';
import { W, B, P, put, boardView, cloneBoardState, group, countOf } from './util.js';

// Would a stone of colour v on c make a group no larger than five?
function fits(b, c, v) {
  let touching = false;
  for (let d = 0; d < 6; d++) { const x = NB[c * 6 + d]; if (x >= 0 && b[x] === v) { touching = true; break; } }
  if (!touching) return true;
  b[c] = v;
  const ok = group(b, c).length <= 5;
  b[c] = 0;
  return ok;
}

function groupOfSize(b, v, size) {
  const done = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (b[i] !== v || done[i]) continue;
    const g = group(b, i);
    if (g.length === size) return g;
    for (const c of g) done[c] = 1;
  }
  return null;
}

export default {
  id: 'manalath',
  seats: ['White', 'Black'],
  seatColors: [W, B],

  setup: () => ({ b: new Int8Array(N), toMove: 1, ply: 0, winner: 0 }),
  clone: cloneBoardState,
  view: (s) => boardView(s.b),
  picks: () => [{ id: W, label: 'White stone', color: W }, { id: B, label: 'Black stone', color: B }],
  prompt: () => 'Place a stone of either colour',

  moves(s) {
    const out = [];
    if (s.winner) return out;
    for (const v of [W, B]) {
      if (countOf(s.b, v) >= 30) continue;
      for (let c = 0; c < N; c++) if (!s.b[c] && fits(s.b, c, v)) out.push({ pick: v, path: [c] });
    }
    return out;
  },

  play(s, m) {
    const c = m.path[0], p = s.toMove;
    s.b[c] = m.pick;
    s.ply++;
    s.fx = { last: c };
    s.toMove = 3 - p;
    // Judged at the end of the mover's turn, on the mover's own colour.
    // A group of four takes precedence over a group of five.
    const four = groupOfSize(s.b, p, 4);
    const five = four ? null : groupOfSize(s.b, p, 5);
    if (four) {
      s.winner = 3 - p; s.line = four; s.lineKind = 'lose';
      s.reason = [p, 'ended the turn with a group of four of their own colour'];
    } else if (five) {
      s.winner = p; s.line = five; s.lineKind = 'win';
      s.reason = [p, 'ended the turn with a group of five of their own colour'];
    } else if (!this.moves(s).length) {
      s.winner = p; s.reason = [3 - p, 'had no legal move'];
    }
  },

  rules: [
    'On your turn, place one stone of either colour, yours or your opponent’s, on an empty cell. White goes first.',
    'You may never place a stone that creates a group of more than five connected stones of one colour.',
    'If there is a group of exactly five of your colour at the end of your turn, you win.',
    'If there is a group of exactly four of your colour at the end of your turn, you lose. If you have both a four and a five, the four counts and you lose.',
    'If you cannot make a legal move, you lose.',
  ],

  lesson: [
    {
      title: 'Either colour',
      text: 'You are White, but on your turn you may place a white stone or a black one. Choose a colour below and place a stone anywhere.',
      any: true,
      done: 'Both colours are tools. What matters is the groups on the board when your turn ends.',
    },
    {
      title: 'A group of five wins',
      text: 'If a group of exactly five of your colour is on the board when your turn ends, you win. Black has left a white group of four. Grow it to five.',
      build(s) { put(s.b, W, [[-1, 0], [0, 0], [1, 0], [1, -1]]); put(s.b, B, [[-2, 1], [-1, 1], [2, -2], [0, -2]]); },
      pick: W,
      want: (m, after) => after.winner === 1,
      solve: { pick: W, path: [P(2, 0)] },
      miss: 'The white group still has four stones. Add a white stone that touches it.',
      done: 'Five connected white stones at the end of White’s turn. White wins.',
    },
    {
      title: 'A group of four loses',
      text: 'But a group of exactly four of your colour at the end of your turn loses. White has a group of three. Tap the glowing cell with a white stone to see it.',
      build(s) { put(s.b, W, [[-1, 0], [0, 0], [1, 0]]); put(s.b, B, [[-1, 2], [0, 2], [2, -2]]); },
      pick: W,
      solve: { pick: W, path: [P(2, 0)] },
      show: true,
      done: 'Four white stones together when White’s turn ended: White loses. To get to five you have to pass through four, and you need your opponent to be the one stuck there.',
    },
    {
      title: 'Use their colour against them',
      text: 'So the weapon is your opponent’s colour. Build them a group of four they cannot fix. Groups may never exceed five, so a four that has no room to grow by exactly one is a loss waiting to happen.',
      build(s) { put(s.b, B, [[0, 0], [1, 0], [0, 1], [-1, 1]]); put(s.b, W, [[2, -1], [-2, 1], [1, 1]]); },
      info: true,
    },
  ],
};
