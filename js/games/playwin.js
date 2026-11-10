// Play Win (Élanor Grace Rodeffer, 2011). Close in on the enemy, and capture
// with chains of short bent leaps.

import { N, NB } from '../hex.js';
import { W, B, P, put, boardView, cloneBoardState, countOf, hexDistance, share, sigmoid } from './util.js';

const START = [[0, -4], [1, -4], [2, -4], [3, -4], [4, -4], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -3], [4, -3]];

// All capture chains for p, as { path, x: captured cells }, longest only.
function chains(b, p) {
  let best = 1;
  const out = [];
  const walk = (pos, path, taken) => {
    let extended = false;
    for (let d = 0; d < 6; d++) {
      const over = NB[pos * 6 + d];
      if (over < 0 || b[over] !== 3 - p) continue;
      // A turny jump lands beyond the jumped piece, bent 60 degrees either way.
      for (const turn of [1, 5]) {
        const land = NB[over * 6 + ((d + turn) % 6)];
        if (land < 0 || b[land]) continue;
        extended = true;
        b[over] = 0;
        walk(land, path.concat(land), taken.concat(over));
        b[over] = 3 - p;
      }
    }
    if (!extended && taken.length >= best) {
      if (taken.length > best) { best = taken.length; out.length = 0; }
      out.push({ path, x: taken });
    }
  };
  for (let c = 0; c < N; c++) {
    if (b[c] !== p) continue;
    b[c] = 0; // the piece has left its cell and may pass back through it
    walk(c, [c], []);
    b[c] = p;
  }
  return out.filter((m) => m.x.length === best);
}

function nearest(b, c, enemy) {
  let best = 99;
  for (let i = 0; i < N; i++) if (b[i] === enemy) best = Math.min(best, hexDistance(c, i));
  return best;
}

// Without a capture, a piece runs along an empty line and must end nearer to
// the closest enemy than it began.
function approaches(b, p) {
  const out = [];
  const reach = countOf(b, p) - 1;
  for (let c = 0; c < N; c++) {
    if (b[c] !== p) continue;
    const before = nearest(b, c, 3 - p);
    for (let d = 0; d < 6; d++) {
      let x = NB[c * 6 + d];
      for (let k = 0; k < reach && x >= 0 && !b[x]; k++, x = NB[x * 6 + d]) {
        if (nearest(b, x, 3 - p) < before) out.push({ path: [c, x] });
      }
    }
  }
  return out;
}

export default {
  id: 'playwin',
  seats: ['White', 'Black'],
  seatColors: [W, B],
  cutoff: 12,
  hintStart: true,

  setup({ blank } = {}) {
    const s = { b: new Int8Array(N), toMove: 1, ply: 0, winner: 0 };
    if (!blank) { put(s.b, B, START); put(s.b, W, START.map(([q, r]) => [-q, -r])); }
    return s;
  },
  clone: cloneBoardState,
  view: (s) => boardView(s.b),
  prompt: (s) => (chains(s.b, s.toMove).length ? 'You must capture: tap a piece, then each landing cell' : 'Tap a piece, then where it should stop'),

  moves(s) {
    if (s.winner) return [];
    const caps = chains(s.b, s.toMove);
    return caps.length ? caps : approaches(s.b, s.toMove);
  },

  play(s, m) {
    const p = s.toMove, b = s.b;
    b[m.path[0]] = 0;
    for (const c of m.x || []) b[c] = 0;
    b[m.path[m.path.length - 1]] = p;
    s.ply++;
    s.fx = { moved: [m.path], last: m.path[m.path.length - 1] };
    s.toMove = 3 - p;
    if (!countOf(b, 3 - p)) {
      s.winner = p; s.reason = [p, 'captured every enemy piece'];
    } else if (!this.moves(s).length) {
      s.winner = p; s.reason = [3 - p, 'had no legal move'];
    }
  },

  evaluate: (s) => share(2, 1, sigmoid(0.7 * (countOf(s.b, W) - countOf(s.b, B)))),

  rules: [
    'Each player starts with eleven pieces on their nearest two rows. White moves first.',
    'If you can capture, you must. Capture with a “turny jump”: leap over an adjacent enemy piece to the empty cell beyond it and 60° to the left or right. Captured pieces are removed at once, and the same piece keeps jumping while it can.',
    'When several captures are possible, you must choose one that takes the most pieces.',
    'If you cannot capture, move one piece along an empty straight line, up to one cell fewer than the number of pieces you have. It must finish closer to its nearest enemy piece than it started.',
    'You win by capturing every enemy piece, or by leaving your opponent with no legal move. A lone piece cannot move without capturing.',
  ],

  lesson: [
    {
      title: 'Close in',
      text: 'When you cannot capture, you must move a piece along an empty straight line so that it ends closer to the enemy than it started. Tap a white piece, then one of the glowing cells.',
      build(s) { put(s.b, B, START); put(s.b, W, START.map(([q, r]) => [-q, -r])); },
      any: true,
      done: 'A piece may travel up to one cell fewer than the number of pieces you have, so your reach shrinks as you lose pieces.',
    },
    {
      title: 'The bent leap',
      text: 'You capture by leaping over a piece next to you and landing beyond it, turned 60° to the left or right. Tap the white piece, then a landing cell.',
      build(s) { put(s.b, W, [[0, 1], [-3, 4]]); put(s.b, B, [[0, 0], [3, -3]]); },
      want: (m, after) => countOf(after.b, B) < 2,
      solve: { path: [P(0, 1), P(1, -1)] },
      miss: 'That did not capture. Tap the white piece beside the black one, then a glowing landing cell.',
      done: 'The jumped piece is removed. Whenever a capture is available, you have to take one.',
    },
    {
      title: 'Keep jumping',
      text: 'After a capture the same piece jumps again if it can, and you must pick a route that takes the most pieces. Capture both black pieces in one move: tap the white piece, then each landing cell in turn.',
      build(s) { put(s.b, W, [[0, 2], [-4, 4]]); put(s.b, B, [[0, 1], [1, -1]]); },
      want: (m, after) => !countOf(after.b, B),
      solve: { path: [P(0, 2), P(1, 0), P(2, -2)] },
      miss: 'Follow the glowing cells to complete the chain.',
      done: 'Two captures in one move, and no black pieces left. White wins.',
    },
  ],
};
