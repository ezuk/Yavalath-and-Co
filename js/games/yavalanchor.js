// Yavalanchor (Néstor Romeral Andrés, 2012). Five in a row built around
// neutral red anchors.

import { N, NB } from '../hex.js';
import { W, B, R, P, put, boardView, cloneBoardState, FIVES, FIVES_AT, share, sigmoid } from './util.js';

// A full window with one player's colour, possibly red, and nothing else.
function winnerOf(b, win) {
  let w = 0, k = 0;
  for (const c of win) {
    if (!b[c]) return 0;
    if (b[c] === W) w++; else if (b[c] === B) k++;
  }
  return w && !k ? W : k && !w ? B : 0;
}

const nearRed = (b, c) => { for (let d = 0; d < 6; d++) { const x = NB[c * 6 + d]; if (x >= 0 && b[x] === R) return true; } return false; };

export default {
  id: 'yavalanchor',
  seats: ['White', 'Black'],
  seatColors: [W, B],
  cutoff: 10,
  hintStart: true,

  setup: () => ({ b: new Int8Array(N), toMove: 1, ply: 0, winner: 0 }),
  clone: cloneBoardState,
  view: (s) => boardView(s.b),
  picks: (s) => [{ id: s.toMove, label: 'Your stone', color: s.toMove }, { id: R, label: 'Red anchor', color: R }],
  prompt: () => 'Place an anchor anywhere, or your stone beside one',

  moves(s) {
    const out = [];
    if (s.winner) return out;
    for (let c = 0; c < N; c++) {
      if (s.b[c]) continue;
      out.push({ pick: R, path: [c] });
      if (nearRed(s.b, c)) out.push({ pick: s.toMove, path: [c] });
    }
    return out;
  },

  play(s, m) {
    const c = m.path[0], p = s.toMove, b = s.b;
    b[c] = m.pick;
    s.ply++;
    s.fx = { last: c };
    let mine = null, theirs = null;
    for (const win of FIVES_AT[c]) {
      const who = winnerOf(b, win);
      if (who === p) mine = win; else if (who) theirs = win;
    }
    // If one stone completes lines for both sides, the mover chooses, so the mover wins.
    const line = mine || theirs;
    if (line) {
      s.winner = mine ? p : 3 - p; s.line = line; s.lineKind = 'win';
      s.reason = [s.winner, 'completed a row of five from their stones and anchors'];
    } else if (s.ply === N) {
      s.winner = -1; s.reason = [0, 'The board filled up with no row of five.'];
    }
    s.toMove = 3 - p;
  },

  evaluate(s) {
    let score = 0;
    for (const win of FIVES) {
      let w = 0, k = 0, r = 0;
      for (const c of win) { const v = s.b[c]; if (v === W) w++; else if (v === B) k++; else if (v === R) r++; }
      if (w && k) continue;
      if (w) score += 3 ** (w + r); else if (k) score -= 3 ** (k + r);
    }
    return share(2, 1, sigmoid(score / 120));
  },

  rules: [
    'Red stones are neutral anchors that belong to neither player.',
    'On your turn, place either a red anchor on any empty cell, or a stone of your own colour on an empty cell next to a red anchor. White goes first.',
    'The game ends when a row of five is made from red stones and stones of just one player. That player wins.',
    'If one stone completes rows for both players, the player who placed it chooses the winning row.',
    'If the board fills first, the game is a draw.',
  ],

  lesson: [
    {
      title: 'Anchors first',
      text: 'Red stones are anchors that belong to nobody. You may place one on any empty cell. Put an anchor down.',
      pick: R,
      any: true,
      want: (m) => m.pick === R,
      miss: 'Choose “Red anchor” below, then tap a cell.',
      done: 'That anchor now opens up the cells around it, for both players.',
    },
    {
      title: 'Your stones need an anchor',
      text: 'A stone of your own colour may only go on a cell touching an anchor. The glowing cells are your options. Place a white stone.',
      build(s) { put(s.b, R, [[0, 0], [2, -2]]); put(s.b, B, [[1, 0]]); },
      pick: W,
      any: true,
      want: (m) => m.pick === W,
      miss: 'Choose “Your stone” below, then tap a glowing cell.',
      done: 'Every turn is that choice: open new ground with an anchor, or build on ground that is already open.',
    },
    {
      title: 'Five with anchors counts',
      text: 'A row of five wins when it holds only your stones and anchors. This row is red, white, white, red and one gap. Fill it.',
      build(s) { put(s.b, R, [[-2, 0], [1, 0]]); put(s.b, W, [[-1, 0], [0, 0]]); put(s.b, B, [[-1, 1], [0, 1], [1, -1]]); },
      pick: W,
      solve: { pick: W, path: [P(2, 0)] },
      miss: 'Complete the row with a white stone at its open end.',
      done: 'Two white and two red, plus yours: a row of five. White wins. An anchor would have finished the row too, since anchors count for whoever owns the rest.',
    },
  ],
};
