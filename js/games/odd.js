// Odd (Nick Bentley, 2007). Place either colour until the board is full.
// One player wants an odd number of large groups, the other an even number.

import { N } from '../hex.js';
import { W, B, P, boardView, cloneBoardState, emptyCells, groupSizes, rowOf } from './util.js';

const bigGroups = (b) => groupSizes(b, W).concat(groupSizes(b, B)).filter((n) => n >= 5).length;

export default {
  id: 'odd',
  seats: ['Odd', 'Even'],
  seatColors: [0, 0],

  setup: () => ({ b: new Int8Array(N), toMove: 1, ply: 0, winner: 0 }),
  clone: cloneBoardState,
  view: (s) => boardView(s.b),
  picks: () => [{ id: W, label: 'White stone', color: W }, { id: B, label: 'Black stone', color: B }],
  prompt: () => 'Place a stone of either colour',
  note: (s) => { const n = bigGroups(s.b); return `Groups of five or more: ${n} (${n % 2 ? 'odd' : 'even'})`; },

  moves(s) {
    const out = [];
    if (s.winner) return out;
    for (const c of emptyCells(s.b)) out.push({ pick: W, path: [c] }, { pick: B, path: [c] });
    return out;
  },

  // Cheaper than building the whole move list during playouts.
  randomMove(s) {
    const e = emptyCells(s.b);
    return { pick: Math.random() < 0.5 ? W : B, path: [e[(Math.random() * e.length) | 0]] };
  },

  play(s, m) {
    s.b[m.path[0]] = m.pick;
    s.ply++;
    s.fx = { last: m.path[0] };
    s.toMove = 3 - s.toMove;
    if (s.ply === N) {
      const n = bigGroups(s.b);
      s.winner = n % 2 ? 1 : 2;
      s.reason = [0, `The board has ${n} group${n === 1 ? '' : 's'} of five or more, which is ${n % 2 ? 'odd' : 'even'}.`];
    }
  },

  rules: [
    'The two players are called Odd and Even. Odd moves first. The white and black stones belong to neither player.',
    'On your turn, place one stone of either colour on any empty cell.',
    'The game ends when the board is full. Count every group of five or more connected stones, of both colours together.',
    'If that count is odd, Odd wins. Otherwise Even wins.',
  ],

  lesson: [
    {
      title: 'Nobody owns a colour',
      text: 'You are Odd. Your opponent is Even. Neither of you owns the white or black stones: each turn you place one stone of whichever colour you like. Choose a colour and place a stone.',
      any: true,
      done: 'Play continues like this until every cell is filled.',
    },
    {
      title: 'Count the big groups',
      text: 'When the board is full, count the groups of five or more stones, both colours together. Here each row is one group, so there are nine. Nine is odd, so Odd would win. The running count is shown above the buttons.',
      build(s) { for (let i = 0; i < N; i++) s.b[i] = ((Math.abs(rowOf(i)) % 2) ? B : W); s.ply = N; },
      info: true,
    },
    {
      title: 'The last stone decides',
      text: 'One cell is left and you are Odd. The white row beside it has only four stones, so right now there are eight big groups. Choose the colour that makes the count odd.',
      build(s) { for (let i = 0; i < N; i++) s.b[i] = ((Math.abs(rowOf(i)) % 2) ? B : W); s.b[P(4, -4)] = 0; s.ply = N - 1; },
      solve: { pick: W, path: [P(4, -4)] },
      miss: (m) => (m.pick === B ? 'A black stone just joins the big black row below, and the count stays at eight.' : 'Tap the one empty cell.'),
      done: 'The white row grows to five and becomes the ninth big group. Odd wins.',
    },
  ],
};
