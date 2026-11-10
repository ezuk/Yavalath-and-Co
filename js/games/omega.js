// Omega (Néstor Romeral Andrés, 2010). Every turn you place one stone of each
// colour. Your score is the product of the sizes of your groups.

import { N } from '../hex.js';
import { W, B, P, put, boardView, cloneBoardState, emptyCells, groupSizes } from './util.js';

const product = (b, v) => groupSizes(b, v).reduce((a, n) => a * n, 1);
const free = (b) => { let n = 0; for (let i = 0; i < N; i++) if (!b[i]) n++; return n; };

export default {
  id: 'omega',
  seats: ['White', 'Black'],
  seatColors: [W, B],

  // `colour` is the stone the player to move must place next: white, then black.
  setup: () => ({ b: new Int8Array(N), toMove: 1, colour: W, ply: 0, winner: 0 }),
  clone: cloneBoardState,
  view: (s) => boardView(s.b),
  moves: (s) => (s.winner ? [] : emptyCells(s.b).map((c) => ({ path: [c] }))),
  prompt: (s) => `Place a ${s.colour === W ? 'white' : 'black'} stone`,
  note: (s) => `White ${product(s.b, W)} · Black ${product(s.b, B)}`,
  turnColor: (s) => s.colour,

  play(s, m) {
    const c = m.path[0];
    s.b[c] = s.colour;
    s.ply++;
    s.fx = { last: c };
    if (s.colour === W) { s.colour = B; return; }
    s.colour = W;
    s.toMove = 3 - s.toMove;
    // A new round starts with White; it needs room for all four stones.
    if (s.toMove === 1 && free(s.b) < 4) {
      const w = product(s.b, W), k = product(s.b, B);
      s.winner = w > k ? 1 : 2; // a tie goes to the last player, Black
      s.reason = [0, `White scores ${w}, Black scores ${k}.${w === k ? ' Ties go to Black, who moved last.' : ''}`];
    }
  },

  canSwap: (s) => s.ply === 2,
  shouldSwap: () => false,

  rules: [
    'White owns the white stones and Black the black ones, but on every turn you must place one white stone and then one black stone, each on any empty cell.',
    'After White’s first turn, Black may swap sides instead of playing.',
    'The game ends when a new round begins and there are fewer than four empty cells, so a few cells stay empty.',
    'Score each colour by multiplying together the sizes of all its groups of connected stones. The higher score wins; Black wins a tie.',
  ],

  lesson: [
    {
      title: 'A stone of each colour',
      text: 'You own the white stones, but every turn you place one white stone and then one black stone. Start by placing the white one.',
      any: true,
      done: 'Now the black one. You choose where your opponent’s colour goes, and they choose where yours goes.',
    },
    {
      title: 'Then the other colour',
      text: 'Your turn is not over until you have also placed a black stone. Put it wherever you think hurts Black most.',
      build(s) { put(s.b, W, [[0, 0]]); s.colour = B; },
      any: true,
      done: 'That is one full turn. Black now does the same: one white stone, one black stone.',
    },
    {
      title: 'Groups multiply',
      text: 'At the end, each colour multiplies the sizes of its groups. White here has groups of 3, 2 and 2, scoring 3 × 2 × 2 = 12. Black has one group of 7, scoring just 7. Several medium groups beat one big one.',
      build(s) {
        put(s.b, W, [[-3, 0], [-2, 0], [-3, 1], [1, -3], [2, -3], [0, 3], [1, 3]]);
        put(s.b, B, [[-1, 0], [0, 0], [1, 0], [2, 0], [0, 1], [1, -1], [3, 0]]);
      },
      info: true,
    },
    {
      title: 'Spoil the other colour',
      text: 'Black has two groups of three, worth 3 × 3 = 9. You have to place a black stone. Put it where it damages Black’s score.',
      build(s) {
        put(s.b, B, [[-3, 0], [-2, 0], [-1, 0], [1, 0], [2, 0], [3, 0]]);
        put(s.b, W, [[-1, 2], [0, 2], [1, -2], [2, -2], [-2, -1], [0, -3], [3, 1]]);
        s.colour = B;
      },
      solve: { path: [P(0, 0)] },
      miss: 'That does not lower Black’s score. Look for a cell that joins the two black groups into one.',
      done: 'The two groups became one group of seven: 9 points dropped to 7. Joining your opponent’s groups, and keeping your own apart, is the whole game.',
    },
  ],
};
