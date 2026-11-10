// Taacoca (Víkingur Fjalar Eiríksson, 2009). Move three stones one step
// forward together; reach the opponent's home row.

import { N, NB } from '../hex.js';
import { W, B, P, put, boardView, cloneBoardState, countOf, rowOf, share, sigmoid } from './util.js';

// Forward directions. White starts at the bottom and moves up the board.
const FORWARD = [null, [4, 5], [2, 1]];
const ARROW = { 4: '↖ Up left', 5: 'Up right ↗', 2: '↙ Down left', 1: 'Down right ↘' };
const GOAL = [0, -4, 4];
const START = [[0, -4], [1, -4], [2, -4], [3, -4], [4, -4], [0, -3], [1, -3], [2, -3], [3, -3], [0, -2], [1, -2], [2, -2]];

function movable(b, p, d) {
  const out = [];
  for (let c = 0; c < N; c++) {
    if (b[c] !== p) continue;
    const t = NB[c * 6 + d];
    if (t >= 0 && b[t] !== p) out.push(c);
  }
  return out;
}

export default {
  id: 'taacoca',
  seats: ['White', 'Black'],
  seatColors: [W, B],
  cutoff: 8,
  unordered: true,
  hintStart: true,

  setup({ blank } = {}) {
    const s = { b: new Int8Array(N), toMove: 1, ply: 0, winner: 0 };
    if (!blank) { put(s.b, B, START); put(s.b, W, START.map(([q, r]) => [-q, -r])); }
    return s;
  },
  clone: cloneBoardState,
  view: (s) => boardView(s.b),
  picks: (s) => FORWARD[s.toMove].map((d) => ({ id: d, label: ARROW[d] })),
  prompt: (s) => `Choose a direction, then tap ${Math.min(3, countOf(s.b, s.toMove))} of your stones`,

  moves(s) {
    const out = [];
    if (s.winner) return out;
    const p = s.toMove;
    const need = Math.min(3, countOf(s.b, p));
    for (const d of FORWARD[p]) {
      const m = movable(s.b, p, d);
      if (m.length < need) continue;
      if (need === 1) for (const a of m) out.push({ pick: d, path: [a] });
      else if (need === 2) for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) out.push({ pick: d, path: [m[i], m[j]] });
      else for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) for (let k = j + 1; k < m.length; k++) out.push({ pick: d, path: [m[i], m[j], m[k]] });
    }
    return out;
  },

  randomMove(s) {
    const p = s.toMove, need = Math.min(3, countOf(s.b, p));
    const dirs = Math.random() < 0.5 ? FORWARD[p] : [FORWARD[p][1], FORWARD[p][0]];
    for (const d of dirs) {
      const m = movable(s.b, p, d);
      if (m.length < need) continue;
      for (let i = m.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [m[i], m[j]] = [m[j], m[i]]; }
      return { pick: d, path: m.slice(0, need) };
    }
    return null;
  },

  play(s, m) {
    const p = s.toMove, b = s.b, d = m.pick;
    const moved = m.path.map((c) => [c, NB[c * 6 + d]]);
    for (const [from] of moved) b[from] = 0;
    for (const [, to] of moved) b[to] = p;
    s.ply++;
    s.fx = { moved };
    s.toMove = 3 - p;
    const home = moved.filter(([, to]) => rowOf(to) === GOAL[p]).map(([, to]) => to);
    if (home.length) {
      s.winner = p; s.line = home; s.lineKind = 'win'; s.reason = [p, 'reached the opposing home row'];
    } else if (!countOf(b, 3 - p)) {
      s.winner = p; s.reason = [p, 'captured every enemy stone'];
    } else if (!this.moves(s).length) {
      s.winner = p; s.reason = [3 - p, 'could not move three stones'];
    }
  },

  evaluate(s) {
    let score = 0, lead = [0, 0, 0];
    for (let c = 0; c < N; c++) {
      const v = s.b[c];
      if (!v) continue;
      const adv = v === W ? 4 - rowOf(c) : 4 + rowOf(c);
      score += v === W ? 1 : -1;
      if (adv > lead[v]) lead[v] = adv;
    }
    return share(2, 1, sigmoid(0.6 * score + 0.35 * (lead[W] - lead[B])));
  },

  rules: [
    'Each player starts with twelve stones. White’s home row is the bottom row and Black’s is the top row. White goes first.',
    'On your turn, move three of your stones one cell forward, all in the same forward direction. They need not be connected. With fewer than three stones left, you must move all of them.',
    'A stone may not move onto a cell holding another of your stones. If it moves onto an enemy stone, that stone is captured and removed.',
    'You win by getting a stone onto your opponent’s home row.',
    'You also win if your opponent has no stones left or cannot make a legal move.',
  ],

  lesson: [
    {
      title: 'Three stones, one direction',
      text: 'Every turn, three of your stones each take one step forward, all in the same direction. Pick a direction below, then tap three white stones that can move that way.',
      build(s) { put(s.b, B, START); put(s.b, W, START.map(([q, r]) => [-q, -r])); },
      any: true,
      done: 'The three stones do not have to be next to each other, only to move the same way.',
    },
    {
      title: 'Capture by stepping on',
      text: 'A stone that steps onto an enemy stone captures it. One of your three stones can do that here. Choose the direction and stones that take the black stone.',
      build(s) { put(s.b, W, [[0, 1], [2, 1], [-2, 2]]); put(s.b, B, [[0, 0], [3, -2], [-1, -2]]); },
      want: (m, after) => countOf(after.b, B) < 3,
      solve: { pick: 4, path: [P(0, 1), P(2, 1), P(-2, 2)] },
      miss: 'Nothing was captured. Move up and to the left, so the middle stone lands on the black one.',
      done: 'Captured. You cannot step onto your own stones, though, so a crowded group can get stuck.',
    },
    {
      title: 'Reach the far row',
      text: 'The first player to get a stone onto the opponent’s home row wins. For White that is the top row. One of your stones is a step away.',
      build(s) { put(s.b, W, [[1, -3], [-1, 1], [2, 0]]); put(s.b, B, [[-2, -2], [3, -4], [-1, -3]]); },
      want: (m, after) => after.winner === 1,
      solve: { pick: 4, path: [P(1, -3), P(-1, 1), P(2, 0)] },
      miss: 'No stone reached the top row. Check which direction takes your leading stone there.',
      done: 'A white stone stands on Black’s home row. White wins.',
    },
  ],
};
