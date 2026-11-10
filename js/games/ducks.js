// Feed the Ducks (Néstor Romeral Andrés, 2011). Drop a breadcrumb; every duck
// in line with it swims towards it. Gather all your ducks into one flock.

import { N, NB } from '../hex.js';
import { W, B, CRUMB, P, put, group, countOf, EDGE, share, sigmoid } from './util.js';

const DUCKS = 12;
const flocks = (b, v) => {
  const done = new Uint8Array(N);
  let n = 0;
  for (let i = 0; i < N; i++) if (b[i] === v && !done[i]) { n++; for (const c of group(b, i)) done[c] = 1; }
  return n;
};

// Cells in line with the crumb, plus the crumb's own cell.
function shadow(crumb) {
  const out = new Uint8Array(N);
  if (crumb < 0) return out;
  out[crumb] = 1;
  for (let d = 0; d < 6; d++) for (let x = NB[crumb * 6 + d]; x >= 0; x = NB[x * 6 + d]) out[x] = 1;
  return out;
}

export default {
  id: 'ducks',
  seats: ['White', 'Black'],
  seatColors: [W, B],
  cutoff: 8,
  hintStart: true,

  setup: ({ blank } = {}) => ({ b: new Int8Array(N), toMove: 1, phase: blank ? 'play' : 'setup', crumb: -1, ply: 0, winner: 0 }),
  clone: (s) => ({ ...s, b: s.b.slice(), fx: null }),
  view: (s) => ({ cells: Array.from(s.b, (v, i) => (i === s.crumb ? [CRUMB] : v ? [v] : [])) }),
  picks: (s) => (s.phase === 'setup'
    ? [W, B].filter((v) => countOf(s.b, v) < DUCKS).map((v) => ({ id: v, label: v === W ? 'White duck' : 'Black duck', color: v }))
    : []),
  prompt: (s) => (s.phase === 'setup' ? 'Place a duck of either colour on the edge' : 'Drop the breadcrumb'),
  note: (s) => (s.phase === 'play' ? `Flocks: White ${flocks(s.b, W)} · Black ${flocks(s.b, B)}` : ''),

  moves(s) {
    const out = [];
    if (s.winner) return out;
    if (s.phase === 'setup') {
      for (const v of [W, B]) {
        if (countOf(s.b, v) >= DUCKS) continue;
        for (const c of EDGE) if (!s.b[c]) out.push({ pick: v, path: [c] });
      }
      return out;
    }
    const barred = shadow(s.crumb);
    for (let c = 0; c < N; c++) if (!s.b[c] && !barred[c]) out.push({ path: [c] });
    return out;
  },

  play(s, m) {
    const c = m.path[0], p = s.toMove, b = s.b;
    s.ply++;
    s.toMove = 3 - p;
    if (s.phase === 'setup') {
      b[c] = m.pick;
      s.fx = { last: c };
      if (EDGE.every((x) => b[x])) { s.phase = 'play'; s.toMove = 1; }
      return;
    }
    s.crumb = c;
    const moved = [];
    for (let d = 0; d < 6; d++) {
      // Walk outwards; each duck swims in to the nearest free cell on its ray.
      let slot = NB[c * 6 + d];
      for (let x = slot; x >= 0; x = NB[x * 6 + d]) {
        if (!b[x]) continue;
        if (x !== slot) { b[slot] = b[x]; b[x] = 0; moved.push([x, slot]); }
        slot = NB[slot * 6 + d];
      }
    }
    s.fx = { moved, last: c };
    const white = flocks(b, W) === 1, black = flocks(b, B) === 1;
    if (white || black) {
      // If both flocks form at once, whoever dropped the crumb wins.
      const colour = white && black ? p : white ? 1 : 2;
      s.winner = colour;
      s.line = []; for (let i = 0; i < N; i++) if (b[i] === colour) s.line.push(i);
      s.lineKind = 'win';
      s.reason = [colour, 'gathered all their ducks into one flock'];
    } else if (s.ply > 200 || !this.moves(s).length) {
      s.winner = -1; s.reason = [0, 'Neither flock came together.'];
    }
  },

  evaluate(s) {
    if (s.phase === 'setup') return share(2, 1, 0.5);
    return share(2, 1, sigmoid(0.8 * (flocks(s.b, B) - flocks(s.b, W))));
  },

  rules: [
    'Set-up: starting with White, players take turns placing a duck of either colour on an empty edge cell, until the edge holds twelve white and twelve black ducks.',
    'White then drops the breadcrumb on any empty cell. Every duck in the six straight lines out from the crumb swims towards it as far as it can, stopping beside the crumb or behind another duck.',
    'From then on, pick up the crumb and drop it on an empty cell that is not in any of the six lines through its previous position. The ducks swim again.',
    'The game ends when all the ducks of one colour form a single connected flock. That colour’s owner wins. If both flocks form at once, the player who dropped the crumb wins.',
  ],

  lesson: [
    {
      title: 'Ducks follow the crumb',
      text: 'Drop the breadcrumb on any empty cell. Every duck in a straight line with it, in any of the six directions, swims towards it as far as it can.',
      build(s) {
        put(s.b, W, [[4, -4], [0, -4], [-4, 0], [-4, 4], [0, 4], [4, 0], [2, -4], [-2, 4]]);
        put(s.b, B, [[4, -2], [-2, -2], [-4, 2], [2, 2], [-3, -1], [3, 1], [-1, 4], [1, -4]]);
      },
      any: true,
      done: 'Ducks stop just short of the crumb, or behind another duck. Ducks that were not in line stayed where they were.',
    },
    {
      title: 'Not on the same lines',
      text: 'On your turn you pick up the crumb and drop it somewhere new. It may not go on any of the six lines through where it was. The glowing cells are allowed.',
      build(s) {
        put(s.b, W, [[1, 0], [0, 1], [-3, 3], [3, -4], [-2, -2]]);
        put(s.b, B, [[-1, 0], [0, -1], [4, -3], [-4, 2], [2, 2]]);
        s.crumb = P(0, 0);
      },
      any: true,
      done: 'This rule stops anyone from simply nudging the same ducks back and forth.',
    },
    {
      title: 'One flock wins',
      text: 'You win when all your ducks are connected in a single flock. Three white ducks are together and one is far away. Drop the crumb so the stray swims in to join them.',
      build(s) {
        put(s.b, W, [[1, 0], [2, 0], [2, -1], [3, -3]]);
        put(s.b, B, [[-2, 3], [0, -3], [-3, 0], [3, 1]]);
      },
      solve: { path: [P(0, 0)] },
      miss: 'The white ducks are still apart. Find the cell that is in line with the stray and next to the flock.',
      done: 'The stray swam down its line and stopped beside the others. All white ducks are in one flock, so White wins.',
    },
  ],
};
