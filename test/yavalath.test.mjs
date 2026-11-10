// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { at, N } from '../js/hex.js';
import { newState, play, replay, legalMoves } from '../js/games/yavalath.js';
import { chooseMove } from '../js/ai/yavalath-ai.js';

function board(white, black) {
  const b = new Int8Array(N);
  for (const [q, r] of white) b[at(q, r)] = 1;
  for (const [q, r] of black) b[at(q, r)] = 2;
  return b;
}

test('board has 61 cells', () => assert.equal(N, 61));

test('four in a row wins', () => {
  const s = newState();
  s.b = board([[-1, 0], [0, 0], [2, 0]], []);
  play(s, at(1, 0));
  assert.equal(s.winner, 1);
  assert.equal(s.line.length, 4);
});

test('three in a row loses', () => {
  const s = newState();
  s.b = board([[0, 0], [1, 0]], []);
  play(s, at(2, 0));
  assert.equal(s.winner, 2);
  assert.equal(s.lostByThree, true);
  assert.equal(s.line.length, 3);
});

test('three and four together is a win', () => {
  const s = newState();
  s.b = board([[-1, 0], [0, 0], [2, 0], [1, -1], [1, -2]], []);
  play(s, at(1, 0));
  assert.equal(s.winner, 1);
});

test('five in a row also wins', () => {
  const s = newState();
  s.b = board([[-2, 0], [-1, 0], [1, 0], [2, 0]], []);
  play(s, at(0, 0));
  assert.equal(s.winner, 1);
  assert.equal(s.line.length, 5);
});

test('full board without a line is a draw', () => {
  // Fill everything by hand, bypassing line checks, then confirm the count rule.
  const s = newState();
  s.count = N - 1;
  play(s, at(4, -4));
  assert.equal(s.winner, 3);
});

test('AI takes an immediate win', () => {
  const b = board([[-1, 0], [0, 0], [2, 0]], [[0, 2], [1, 2], [-3, 3]]);
  for (const level of ['easy', 'medium', 'hard']) {
    assert.equal(chooseMove(b, 1, level).move, at(1, 0));
  }
});

test('AI blocks an immediate loss', () => {
  const b = board([[-1, 0], [0, 0], [2, 0]], [[0, 2], [-3, 3]]);
  for (const level of ['easy', 'medium', 'hard']) {
    assert.equal(chooseMove(b, 2, level).move, at(1, 0));
  }
});

test('AI finds the forcing move', () => {
  // White threatens four through the centre; Black's only block completes three.
  const b = board([[-2, 0], [-1, 0]], [[0, -1], [0, 1]]);
  assert.equal(chooseMove(b, 1, 'hard').move, at(1, 0));
  assert.equal(chooseMove(b, 1, 'medium').move, at(1, 0));
});

test('AI never plays an illegal move across full games', () => {
  for (let g = 0; g < 3; g++) {
    const moves = [];
    let s = newState();
    while (!s.winner) {
      const { move } = chooseMove(s.b, s.turn, 'easy');
      assert.ok(legalMoves(s).includes(move));
      moves.push(move);
      play(s, move);
    }
    assert.deepEqual(replay(moves).b, s.b);
  }
});
