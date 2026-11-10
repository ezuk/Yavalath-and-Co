// Yavalade (Néstor Romeral Andrés, 2012). Three players; each needs a row of
// five mixing their own colour with one neighbour's.

import { N } from '../hex.js';
import { W, B, R, P, put, boardView, cloneBoardState, emptyCells, FIVES, FIVES_AT } from './util.js';

// White pairs with Red, Black with White, Red with Black.
const PARTNER = [0, R, W, B];
const NAME = ['', 'white', 'black', 'red'];

// Does the window hold both colours p needs, and nothing else?
function made(b, win, p) {
  let own = 0, partner = 0;
  for (const c of win) {
    if (b[c] === p) own++; else if (b[c] === PARTNER[p]) partner++; else return false;
  }
  return own > 0 && partner > 0;
}

export default {
  id: 'yavalade',
  seats: ['White', 'Black', 'Red'],
  seatColors: [W, B, R],
  cutoff: 9,

  setup: () => ({ b: new Int8Array(N), toMove: 1, ply: 0, winner: 0 }),
  clone: cloneBoardState,
  view: (s) => boardView(s.b),
  moves: (s) => (s.winner ? [] : emptyCells(s.b).map((c) => ({ path: [c] }))),
  note: (s, seat) => `You need a row of five with ${NAME[seat]} and ${NAME[PARTNER[seat]]}`,

  play(s, m) {
    const c = m.path[0], p = s.toMove, b = s.b;
    b[c] = p;
    s.ply++;
    s.fx = { last: c };
    // A stone of colour p can finish a row for p, or for the player who pairs with p.
    const other = (p % 3) + 1;
    let mine = null, theirs = null;
    for (const win of FIVES_AT[c]) {
      if (made(b, win, p)) mine = win; else if (made(b, win, other)) theirs = win;
    }
    const line = mine || theirs;
    if (line) {
      s.winner = mine ? p : other; s.line = line; s.lineKind = 'win';
      s.reason = [s.winner, `completed a row of ${NAME[s.winner]} and ${NAME[PARTNER[s.winner]]}`];
    } else if (s.ply === N) {
      s.winner = -1; s.reason = [0, 'The board filled up with no winning row.'];
    }
    s.toMove = other;
  },

  evaluate(s) {
    const pot = [0, 1, 1, 1];
    for (const win of FIVES) {
      for (let p = 1; p <= 3; p++) {
        let n = 0, ok = true;
        for (const c of win) { const v = s.b[c]; if (v === p || v === PARTNER[p]) n++; else if (v) { ok = false; break; } }
        if (ok && n) pot[p] += 3 ** n;
      }
    }
    const total = pot[1] + pot[2] + pot[3];
    return [0, pot[1] / total, pot[2] / total, pot[3] / total];
  },

  rules: [
    'Three players: White, Black and Red, moving in that order. Each places one stone of their own colour on any empty cell.',
    'Each player needs a second colour: White needs Red, Black needs White, and Red needs Black.',
    'You win by completing a row of exactly five that contains both your colour and the colour you need, and no other.',
    'If a stone makes more than one such row, the player who placed it chooses the winning row.',
    'Rule of thumb: Black must block White, White must block Red, and Red must block Black.',
  ],

  lesson: [
    {
      title: 'Three colours, three players',
      text: 'You play White against two computer players, Black and Red. Everyone places one stone of their own colour each turn. Place a white stone anywhere.',
      any: true,
      done: 'Simple enough. The twist is in how you win.',
    },
    {
      title: 'You need a neighbour’s colour',
      text: 'White wins with a row of five made of white and red stones together, and nothing else. This row has two white and two red. Complete it.',
      build(s) { put(s.b, W, [[-2, 0], [0, 0]]); put(s.b, R, [[-1, 0], [1, 0], [2, 2]]); put(s.b, B, [[0, 1], [-1, 2], [1, -2], [-3, 0]]); },
      solve: { path: [P(2, 0)] },
      miss: 'Find the open end of the white and red row.',
      done: 'White and red, five in a row. White wins. Red’s own stones helped you get there.',
    },
    {
      title: 'Your stones help someone else',
      text: 'Black needs black and white together. That means your white stones can finish Black’s row for them. Tap the glowing cell to see the danger.',
      build(s) { put(s.b, B, [[-2, 1], [-1, 1], [1, 1]]); put(s.b, W, [[0, 1], [0, -2]]); put(s.b, R, [[-1, -1], [2, -1], [-3, 1]]); },
      solve: { path: [P(2, 1)] },
      show: true,
      done: 'Your white stone completed a row of black and white, so Black wins. Always watch the player who needs your colour.',
    },
  ],
};
