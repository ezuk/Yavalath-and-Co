// Onager (Néstor Romeral Andrés, 2012). Walk a step, or catapult over a
// friendly piece. Landing on an enemy pins it under a stack.

import { N, NB, CENTER } from '../hex.js';
import { W, B, R, P, rowOf, share, sigmoid } from './util.js';

const COLOUR = [0, B, W]; // Black moves first
const RANK = [0, -4, 4]; // each side's own back rank: Black at the top
const START = [[0, -4], [1, -4], [2, -4], [3, -4], [4, -4], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -3], [4, -3]];
const MAX_JUMPS = 4;

const top = (st, c) => { const k = st[c]; return k.length ? k[k.length - 1] : 0; };

// Landing cells for a jump by the piece on `pos`.
function landings(st, pos, colour) {
  const out = [];
  for (let d = 0; d < 6; d++) {
    // The first occupied cell in this direction must be a friendly piece.
    let pivot = NB[pos * 6 + d], dist = 1;
    while (pivot >= 0 && !st[pivot].length) { pivot = NB[pivot * 6 + d]; dist++; }
    if (pivot < 0 || top(st, pivot) !== colour) continue;
    let land = pivot;
    for (let k = 0; k < dist && land >= 0; k++) land = NB[land * 6 + d];
    if (land < 0) continue;
    const t = top(st, land);
    if (t === 0 || t === 3 - colour) out.push(land);
  }
  return out;
}

function movesFor(st, seat) {
  const colour = COLOUR[seat], out = [];
  for (let c = 0; c < N; c++) {
    if (top(st, c) !== colour) continue;
    for (let d = 0; d < 6; d++) { const x = NB[c * 6 + d]; if (x >= 0 && !st[x].length) out.push({ path: [c, x] }); }
    const extend = (pos, path) => {
      for (const land of landings(st, pos, colour)) {
        if (path.includes(land)) continue;
        const next = path.concat(land);
        out.push({ path: next, jump: true });
        // Only a jump that lands on an enemy piece may continue.
        if (st[land].length && next.length <= MAX_JUMPS) {
          st[pos].pop(); st[land].push(colour);
          extend(land, next);
          st[land].pop(); st[pos].push(colour);
        }
      }
    };
    extend(c, [c]);
  }
  return out;
}

function onRank(st, colour, row) {
  let n = 0;
  for (let c = 0; c < N; c++) if (rowOf(c) === row && top(st, c) === colour) n++;
  return n;
}

function build(st, colour, list, flip) {
  for (const [q, r] of list) st[flip ? P(-q, -r) : P(q, r)].push(colour);
}

export default {
  id: 'onager',
  seats: ['Black', 'White'],
  seatColors: [B, W],
  cutoff: 8,

  setup({ blank } = {}) {
    const s = { st: Array.from({ length: N }, () => []), toMove: 1, phase: blank ? 'play' : 'lakes', lakes: 0, ply: 0, winner: 0 };
    if (!blank) { build(s.st, B, START); build(s.st, W, START, true); }
    return s;
  },
  clone: (s) => ({ ...s, st: s.st.map((k) => k.slice()), fx: null }),
  view: (s) => ({ cells: s.st.map((k) => k.slice()) }),
  prompt: (s) => (s.phase === 'lakes' ? 'Place a lake on any empty cell except the centre' : 'Tap a piece, then where it walks or lands'),

  moves(s) {
    if (s.winner) return [];
    if (s.phase === 'lakes') {
      const out = [];
      for (let c = 0; c < N; c++) if (!s.st[c].length && c !== CENTER) out.push({ path: [c] });
      return out;
    }
    return movesFor(s.st, s.toMove);
  },

  play(s, m) {
    const p = s.toMove;
    s.ply++;
    if (s.phase === 'lakes') {
      s.st[m.path[0]].push(R);
      s.fx = { last: m.path[0] };
      s.toMove = 3 - p;
      // Black places two lakes and White one, then Black makes the first move.
      if (++s.lakes === 3) { s.phase = 'play'; s.toMove = 1; }
      return;
    }
    const to = m.path[m.path.length - 1];
    s.st[m.path[0]].pop();
    s.st[to].push(COLOUR[p]);
    s.fx = { moved: [m.path], last: to };
    const q = 3 - p;
    s.toMove = q;
    // Judged at the start of the next player's turn.
    const theirs = onRank(s.st, COLOUR[q], RANK[p]), mine = onRank(s.st, COLOUR[p], RANK[q]);
    if (theirs > mine) {
      s.winner = q; s.reason = [q, 'held more of the enemy back rank at the start of the turn'];
      s.line = []; for (let c = 0; c < N; c++) if (rowOf(c) === RANK[p] && top(s.st, c) === COLOUR[q]) s.line.push(c);
      s.lineKind = 'win';
    } else if (!movesFor(s.st, q).length) {
      s.winner = p; s.reason = [q, 'had no legal move'];
    } else if (s.ply > 300) {
      s.winner = -1; s.reason = [0, 'Neither side could break through.'];
    }
  },

  evaluate(s) {
    if (s.phase === 'lakes') return share(2, 1, 0.5);
    let score = 0;
    for (let c = 0; c < N; c++) {
      const t = top(s.st, c);
      if (t === B) score += (rowOf(c) + 4) ** 2 / 20 + (rowOf(c) === 4 ? 3 : 0);
      else if (t === W) score -= (4 - rowOf(c)) ** 2 / 20 + (rowOf(c) === -4 ? 3 : 0);
    }
    return share(2, 1, sigmoid(score / 3));
  },

  rules: [
    'Each player fills their two nearest rows with discs. Then, starting with Black, players take turns placing three red lakes on empty cells other than the centre (Black places two, White one). Black then moves first.',
    'A “piece” is a single disc or the top disc of a stack. Only pieces can move. On your turn, either walk or jump with one piece.',
    'Walk: move a piece to an adjacent empty cell.',
    'Jump: two of your pieces must be in a straight line with nothing between them. One leaps over the other and lands the same distance beyond it. The landing cell must be empty or hold an enemy piece, never a lake or your own piece.',
    'Landing on an enemy piece makes a stack and pins the disc underneath until you move off. After such a landing, the same piece may jump again.',
    'If, at the start of your turn, you have more pieces on your opponent’s back rank than they have on yours, you win. If you cannot move, you lose.',
  ],

  lesson: [
    {
      title: 'Walk one step',
      text: 'You are Black, moving down the board. The simplest move is a walk: one piece steps to an adjacent empty cell. Tap a black piece, then a neighbouring cell.',
      build(s) { build(s.st, B, [[0, -2], [1, -2], [-1, -1]]); build(s.st, W, [[0, 2], [-1, 2], [1, 1]]); build(s.st, R, [[1, 0]]); },
      any: true,
      want: (m) => !m.jump,
      miss: 'That was a jump. Try a plain walk first: tap a piece, then a cell right next to it.',
      done: 'The red discs are lakes. Nothing can enter or pass through a lake.',
    },
    {
      title: 'Catapult over a friend',
      text: 'When two of your pieces are in line with nothing between them, one can leap over the other and land the same distance beyond. Jump the left-hand piece over its partner.',
      build(s) { build(s.st, B, [[-2, 0], [0, 0], [2, -3]]); build(s.st, W, [[0, 3], [-2, 3], [3, 1]]); },
      solve: { path: [P(-2, 0), P(2, 0)], jump: true },
      miss: 'Tap the black piece on the left, then the glowing cell on the far side of its partner.',
      done: 'Two cells apart, so it landed two cells beyond. Pieces far apart can cross the whole board in one jump.',
    },
    {
      title: 'Land on an enemy',
      text: 'A jump may land on an enemy piece. That makes a stack, and the disc underneath cannot move until you leave. Jump onto the white piece.',
      build(s) { build(s.st, B, [[-2, 0], [0, 0], [2, -3]]); build(s.st, W, [[2, 0], [-2, 3], [3, 1]]); },
      solve: { path: [P(-2, 0), P(2, 0)], jump: true },
      miss: 'Tap the black piece on the left, then the white piece the same distance beyond its partner.',
      done: 'White’s disc is pinned under yours. Nothing is ever captured in Onager, only buried. After landing on an enemy you may jump again with the same piece.',
    },
    {
      title: 'Take the back rank',
      text: 'You win if, when your turn begins, you have more pieces on your opponent’s back rank than they have on yours. A piece that reaches the far row must survive one enemy turn there. Walk your leading piece onto White’s back rank.',
      build(s) { build(s.st, B, [[-1, 3], [0, -4], [2, -2]]); build(s.st, W, [[3, 0], [-3, 2], [4, -1]]); },
      want: (m, after) => onRank(after.st, B, 4) === 1,
      solve: { path: [P(-1, 3), P(-1, 4)] },
      miss: 'Move the black piece that is one step from the bottom row onto that row.',
      done: 'Black has a piece on White’s back rank. If White cannot answer by reaching yours or burying that piece, you win when your next turn starts.',
    },
  ],
};
