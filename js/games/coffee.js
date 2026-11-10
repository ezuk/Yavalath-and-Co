// Coffee (Néstor Romeral Andrés, 2011). After placing a stone you lay a rod on
// it; the rod's line is where your opponent must play next.

import { N, NB } from '../hex.js';
import { W, B, P, put, boardView, cloneBoardState, emptyCells, lineThrough } from './util.js';

const ROW = 4; // stones in a row needed to win
const COLOUR = [0, B, W]; // Black moves first

// Empty cells on the line through c along axis (both directions).
function onLine(b, c, axis) {
  const out = [];
  for (const d of [axis, axis + 3]) for (let x = NB[c * 6 + d]; x >= 0; x = NB[x * 6 + d]) if (!b[x]) out.push(x);
  return out;
}

export default {
  id: 'coffee',
  seats: ['Black', 'White'],
  seatColors: [B, W],
  hintStart: true,

  // phase 'place': put a stone on the rod's line. phase 'rod': aim the rod.
  setup: () => ({ b: new Int8Array(N), toMove: 1, phase: 'place', rod: null, at: -1, ply: 0, winner: 0 }),
  clone: (s) => ({ ...s, b: s.b.slice(), rod: s.rod && { ...s.rod }, fx: null }),
  view: (s) => ({ ...boardView(s.b), rod: s.rod }),
  prompt: (s) => (s.phase === 'rod' ? 'Aim the rod: tap a cell next to your stone' : s.rod ? 'Place a stone on the rod’s line' : 'Place the first stone anywhere'),

  moves(s) {
    if (s.winner) return [];
    if (s.phase === 'place') {
      return (s.rod ? onLine(s.b, s.rod.cell, s.rod.axis) : emptyCells(s.b)).map((c) => ({ path: [c] }));
    }
    // Aim by tapping either neighbour on the chosen line. The rod may only
    // point along a line that still has room for the opponent.
    const out = [];
    for (let axis = 0; axis < 3; axis++) {
      if (!onLine(s.b, s.at, axis).length) continue;
      for (const d of [axis, axis + 3]) { const x = NB[s.at * 6 + d]; if (x >= 0) out.push({ path: [x], axis }); }
    }
    return out;
  },

  // One move per axis is enough for the search.
  searchMoves(s) {
    const all = this.moves(s);
    return s.phase === 'rod' ? all.filter((m, i) => all.findIndex((o) => o.axis === m.axis) === i) : all;
  },

  play(s, m) {
    const p = s.toMove;
    s.ply++;
    if (s.phase === 'rod') {
      s.rod = { cell: s.at, axis: m.axis };
      s.phase = 'place';
      s.toMove = 3 - p;
      s.fx = { last: s.at };
      return;
    }
    const c = m.path[0];
    s.b[c] = COLOUR[p];
    s.at = c;
    s.rod = null;
    s.fx = { last: c };
    const line = lineThrough(c, ROW, (x) => s.b[x] === COLOUR[p]);
    if (line) {
      s.winner = p; s.line = line; s.lineKind = 'win'; s.reason = [p, `made ${ROW} in a row`];
      return;
    }
    s.phase = 'rod';
    if (!this.moves(s).length) {
      s.winner = 3 - p; s.line = [c]; s.lineKind = 'lose';
      s.reason = [p, 'could not aim the rod at any free cell'];
    }
  },

  rules: [
    'Black goes first, placing a stone on any empty cell and then laying the rod on it, pointing along one of the three lines through that cell.',
    'From then on, each turn you place a stone on an empty cell somewhere on the line the rod points along, then move the rod onto your new stone and aim it along any of the three lines.',
    'You may not aim the rod along a line that has no empty cells for your opponent.',
    `You win by making ${ROW} of your stones in a row.`,
    'You lose if you cannot aim the rod legally. If both happen on the same turn, the row wins.',
  ],

  lesson: [
    {
      title: 'Stone first',
      text: 'You are Black and you move first. A turn has two parts. First, place a stone: tap any cell.',
      any: true,
      done: 'Next comes the part that gives the game its name.',
    },
    {
      title: 'Then aim the rod',
      text: 'Now lay the rod across your stone. It can point along any of the three lines through that cell. Tap one of the glowing neighbours to aim it that way.',
      build(s) { put(s.b, B, [[0, 0]]); s.at = P(0, 0); s.phase = 'rod'; },
      any: true,
      done: 'On a black stone the rod looks like a coffee bean. That line is now the only place White may play.',
    },
    {
      title: 'Play where the rod points',
      text: 'White has placed a stone and aimed the rod. You must put your next stone on an empty cell along its line. The glowing cells are your choices.',
      build(s) { put(s.b, B, [[0, 0]]); put(s.b, W, [[1, 1]]); s.rod = { cell: P(1, 1), axis: 2 }; s.at = P(1, 1); },
      any: true,
      done: 'After every stone the rod moves onto it and gets a new aim. You steer your opponent, and they steer you.',
    },
    {
      title: 'Four in a row',
      text: `Line up ${ROW} of your stones to win. The rod’s line happens to pass through the cell you need. Take it.`,
      build(s) {
        put(s.b, B, [[-1, 0], [0, 0], [1, 0]]); put(s.b, W, [[-2, 0], [2, -2], [0, 1], [2, 1]]);
        s.rod = { cell: P(2, -2), axis: 1 }; s.at = P(2, -2);
      },
      solve: { path: [P(2, 0)] },
      miss: 'That is on the line, but it does not complete the row of four.',
      done: 'Four in a row. Black wins. The other way to win is to leave your opponent unable to aim the rod at any free cell.',
    },
  ],
};
