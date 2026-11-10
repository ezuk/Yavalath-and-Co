// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { at, N } from '../js/hex.js';
import { MODULES } from '../js/games/all.js';
import { GAMES } from '../js/games/index.js';
import { chooseMove } from '../js/ai/mcts.js';

const P = (q, r) => at(q, r);
const same = (a, b) => a.pick === b.pick && a.path.length === b.path.length && a.path.every((c) => b.path.includes(c));
const blank = (id) => MODULES[id].setup({ blank: true });
function put(b, v, list) { for (const [q, r] of list) b[at(q, r)] = v; }
function play(id, s, path, pick) {
  const g = MODULES[id];
  const m = g.moves(s).find((x) => same(x, { path, pick }));
  assert.ok(m, `${id}: move ${JSON.stringify({ path, pick })} should be legal`);
  g.play(s, m);
  return s;
}

test('the catalogue and the modules agree', () => {
  assert.equal(N, 61);
  assert.deepEqual(GAMES.map((g) => g.id).sort(), Object.keys(MODULES).sort());
  assert.equal(GAMES.length, 15);
});

test('the service worker caches every source file', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const id of Object.keys(MODULES)) assert.ok(sw.includes(`js/games/${id}.js`), id);
});

for (const [id, game] of Object.entries(MODULES)) {
  test(`${id}: random games end, replay identically, and views are well formed`, () => {
    for (let n = 0; n < 40; n++) {
      const s = game.setup({ seed: n + 1 });
      const record = [];
      let plies = 0;
      while (!s.winner) {
        const list = game.moves(s);
        assert.ok(list.length, 'a position in play always has a move');
        const m = list[(Math.random() * list.length) | 0];
        const copy = game.clone(s);
        game.play(s, m);
        record.push(m);
        assert.equal(game.view(s).cells.length, N);
        if (plies === 5) assert.notDeepEqual(game.view(copy), game.view(s), 'clone is independent');
        assert.ok(++plies < 1500, 'game terminates');
      }
      assert.ok(s.winner === -1 || (s.winner >= 1 && s.winner <= game.seats.length));
      assert.ok(Array.isArray(s.reason), 'a finished game says why');
      // Moves must survive being saved and sent to the AI worker.
      const again = game.setup({ seed: n + 1 });
      for (const m of JSON.parse(JSON.stringify(record))) game.play(again, m);
      assert.deepEqual(game.view(again), game.view(s));
      assert.equal(again.winner, s.winner);
    }
  });

  test(`${id}: every lesson step can be completed`, () => {
    assert.ok(game.rules.length >= 3);
    assert.ok(game.lesson.length >= 3);
    for (const step of game.lesson) {
      const s = game.setup({ blank: true });
      if (step.build) step.build(s);
      assert.ok(step.title && step.text);
      if (step.info) continue;
      const legal = game.moves(s);
      assert.ok(legal.length, `${step.title}: has legal moves`);
      const move = step.solve ? legal.find((m) => same(m, step.solve)) : legal.find((m) => {
        if (!step.want) return true;
        const t = game.clone(s); game.play(t, m); return step.want(m, t, s);
      });
      assert.ok(move, `${step.title}: the intended move is legal`);
      const after = game.clone(s);
      game.play(after, move);
      if (step.want) assert.ok(step.want(move, after, s), `${step.title}: the intended move is accepted`);
      if (step.reply && !after.winner) {
        const r = step.reply(after);
        assert.ok(game.moves(after).some((m) => same(m, r)), `${step.title}: the scripted reply is legal`);
      }
    }
  });

  test(`${id}: the computer plays legal moves`, () => {
    const s = game.setup({ seed: 3 });
    for (let k = 0; k < 12 && !s.winner; k++) {
      const m = chooseMove(game, s, 'easy');
      assert.ok(game.moves(s).some((x) => same(x, m)), JSON.stringify(m));
      game.play(s, m);
    }
  });
}

// ---- rules worth pinning down -------------------------------------------

test('yavalath: four wins, three loses, four beats three', () => {
  let s = blank('yavalath'); put(s.b, 1, [[-1, 0], [0, 0], [2, 0]]);
  assert.equal(play('yavalath', s, [P(1, 0)]).winner, 1);
  s = blank('yavalath'); put(s.b, 1, [[0, 0], [1, 0]]);
  assert.equal(play('yavalath', s, [P(2, 0)]).winner, 2);
  s = blank('yavalath'); put(s.b, 1, [[-1, 0], [0, 0], [2, 0], [1, -1], [1, -2]]);
  assert.equal(play('yavalath', s, [P(1, 0)]).winner, 1);
});

test('yavalath: the computer finds the forcing move', () => {
  const s = blank('yavalath'); put(s.b, 1, [[-2, 0], [-1, 0]]); put(s.b, 2, [[0, -1], [0, 1]]);
  assert.deepEqual(chooseMove(MODULES.yavalath, s, 'hard').path, [P(1, 0)]);
});

test('pentalath: capture, and suicide is illegal', () => {
  const g = MODULES.pentalath;
  const s = blank('pentalath');
  put(s.b, 2, [[4, -4]]); put(s.b, 1, [[3, -4], [3, -3]]);
  play('pentalath', s, [P(4, -3)]);
  assert.equal(s.b[P(4, -4)], 0, 'the cornered stone is captured');
  assert.ok(!g.moves(s).some((m) => m.path[0] === P(4, -4)), 'Black may not play back into the corner');
});

test('yavalanchor: own stones need an anchor; anchors complete rows', () => {
  const g = MODULES.yavalanchor;
  const s = blank('yavalanchor');
  assert.ok(g.moves(s).every((m) => m.pick === 3), 'only anchors on an empty board');
  put(s.b, 3, [[-2, 0], [1, 0]]); put(s.b, 1, [[-1, 0], [0, 0]]);
  assert.equal(play('yavalanchor', s, [P(2, 0)], 3).winner, 1, 'a red stone can finish White’s row');
});

test('yavalade: a white stone can win the game for Black', () => {
  const s = blank('yavalade');
  put(s.b, 2, [[-2, 1], [-1, 1], [1, 1]]); put(s.b, 1, [[0, 1]]);
  assert.equal(play('yavalade', s, [P(2, 1)]).winner, 2);
});

test('cross: three alternate sides win, opposite sides lose', () => {
  const lessons = MODULES.cross.lesson;
  let s = blank('cross'); lessons[0].build(s);
  assert.equal(play('cross', s, [P(0, 0)]).winner, 1);
  s = blank('cross'); lessons[1].build(s);
  assert.equal(play('cross', s, [P(0, 0)]).winner, 2);
});

test('omega: two stones a turn, product scoring, ties to Black', () => {
  const g = MODULES.omega;
  const s = g.setup({});
  play('omega', s, [P(0, 0)]);
  assert.equal(s.toMove, 1, 'still White’s turn after the white stone');
  play('omega', s, [P(1, 0)]);
  assert.equal(s.toMove, 2);
  assert.equal(s.b[P(1, 0)], 2);
  while (!s.winner) g.play(s, g.moves(s)[0]);
  assert.equal(s.ply, 60, 'fifteen rounds of four stones');
  assert.match(s.reason[1], /White scores \d+, Black scores \d+/);
});

test('manalath: five wins, four loses, six is illegal', () => {
  const g = MODULES.manalath;
  let s = blank('manalath'); put(s.b, 1, [[-1, 0], [0, 0], [1, 0], [1, -1]]);
  assert.equal(play('manalath', s, [P(2, 0)], 1).winner, 1);
  s = blank('manalath'); put(s.b, 1, [[-1, 0], [0, 0], [1, 0]]);
  assert.equal(play('manalath', s, [P(2, 0)], 1).winner, 2);
  s = blank('manalath'); put(s.b, 2, [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]]);
  assert.ok(!g.moves(s).some((m) => m.pick === 2 && m.path[0] === P(3, 0)));
  s = blank('manalath'); put(s.b, 1, [[-2, 0], [-1, 0], [0, 0], [1, 0]]);
  assert.equal(play('manalath', s, [P(-4, 4)], 2).winner, 2, 'leaving your own four on the board loses');
});

test('odd: parity of groups of five or more', () => {
  const s = blank('odd'); MODULES.odd.lesson[2].build(s);
  assert.equal(play('odd', MODULES.odd.clone(s), [P(4, -4)], 1).winner, 1);
  assert.equal(play('odd', MODULES.odd.clone(s), [P(4, -4)], 2).winner, 2);
});

test('coffee: the rod limits the reply, and a dead end loses', () => {
  const g = MODULES.coffee;
  const s = g.setup({});
  play('coffee', s, [P(0, 0)]);
  assert.equal(s.phase, 'rod');
  play('coffee', s, [P(1, 0)]);
  assert.equal(s.toMove, 2);
  const targets = g.moves(s).map((m) => m.path[0]);
  assert.equal(targets.length, 8);
  assert.ok(targets.every((c) => c !== P(0, 0) && [P(-4, 0), P(-3, 0), P(-2, 0), P(-1, 0), P(1, 0), P(2, 0), P(3, 0), P(4, 0)].includes(c)));
});

test('ducks: ducks swim in and stack up behind each other', () => {
  const s = blank('ducks');
  put(s.b, 1, [[3, 0], [4, 0]]); put(s.b, 2, [[0, -4], [-2, 2], [1, 2]]);
  play('ducks', s, [P(0, 0)]);
  assert.equal(s.b[P(1, 0)], 1); assert.equal(s.b[P(2, 0)], 1); assert.equal(s.b[P(4, 0)], 0);
  assert.equal(s.b[P(0, -1)], 2); assert.equal(s.b[P(-1, 1)], 2);
  assert.equal(s.b[P(1, 2)], 2, 'a duck off the lines stays put');
  assert.ok(!MODULES.ducks.moves(s).some((m) => m.path[0] === P(0, 3)), 'the next crumb may not go on the old lines');
});

test('susan: surrounding wins, self-surround loses, slides are one step', () => {
  const steps = MODULES.susan.lesson;
  let s = blank('susan'); steps[2].build(s);
  assert.equal(play('susan', s, [P(4, -3)]).winner, 1);
  s = blank('susan'); steps[3].build(s);
  assert.equal(play('susan', s, [P(0, 0)]).winner, 2);
  s = blank('susan'); put(s.b, 1, [[0, 0]]);
  assert.equal(MODULES.susan.moves(s).filter((m) => m.path.length === 2).length, 6);
});

test('taacoca: set-up, capture and the home row', () => {
  const g = MODULES.taacoca;
  const s = g.setup({});
  assert.equal(s.b.filter((v) => v === 1).length, 12);
  assert.equal(s.b.filter((v) => v === 2).length, 12);
  assert.ok(g.moves(s).every((m) => m.path.length === 3));
  const t = blank('taacoca'); put(t.b, 1, [[1, -3]]); put(t.b, 2, [[0, 0]]);
  assert.equal(play('taacoca', t, [P(1, -3)], 4).winner, 1, 'a lone stone moves alone and can still win');
});

test('quantum: leap length equals friendly neighbours', () => {
  const g = MODULES.quantum;
  const full = g.setup({ seed: 5 });
  assert.equal(full.b.filter((v) => v === 1).length, 30);
  assert.equal(full.b.filter((v) => v === 2).length, 30);
  assert.notEqual(full.b[P(0, 0)], 0, 'the empty cell is never the centre');
  const s = blank('quantum'); put(s.b, 1, [[0, 0], [1, 0], [0, 1]]); put(s.b, 2, [[-2, 0], [-1, 0], [-3, 0]]);
  const from = g.moves(s).filter((m) => m.path[0] === P(0, 0)).map((m) => m.path[1]);
  assert.deepEqual(from, [P(-2, 0)], 'two friends: exactly two cells, over the stone in between');
});

test('playwin: captures are forced and the longest chain is required', () => {
  const g = MODULES.playwin;
  const s = blank('playwin'); MODULES.playwin.lesson[2].build(s);
  const list = g.moves(s);
  assert.ok(list.length && list.every((m) => m.x.length === 2));
  const start = g.setup({});
  assert.ok(g.moves(start).every((m) => m.path.length === 2 && !m.x), 'no captures at the start');
});

test('onager: lakes, mirrored jumps, stacks and the back-rank win', () => {
  const g = MODULES.onager;
  const s = g.setup({});
  assert.ok(!g.moves(s).some((m) => m.path[0] === P(0, 0)), 'no lake on the centre');
  for (const c of [P(0, 1), P(1, 1), P(-1, 0)]) play('onager', s, [c]);
  assert.equal(s.phase, 'play'); assert.equal(s.toMove, 1);
  const t = blank('onager'); MODULES.onager.lesson[2].build(t);
  play('onager', t, [P(-2, 0), P(2, 0)]);
  assert.deepEqual(t.st[P(2, 0)], [1, 2], 'black disc on top of the white one');
  assert.ok(!g.moves(t).some((m) => m.path[0] === P(2, 0)), 'the buried disc cannot move');
  const u = blank('onager'); u.st[P(-1, 3)].push(2); u.st[P(0, -4)].push(2); u.st[P(3, 0)].push(1);
  play('onager', u, [P(-1, 3), P(-1, 4)]);
  assert.equal(u.winner, 0, 'reaching the rank is not yet a win');
  play('onager', u, [P(3, 0), P(3, -1)]);
  assert.equal(u.winner, 1, 'Black wins at the start of the next turn');
});
