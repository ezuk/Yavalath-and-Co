// Interactive lesson for Yavalath. Each step sets up a position and reacts to
// taps through the small `api` the tutorial runner provides.

import { at } from '../hex.js';
import { classify, LOSE } from './yavalath.js';

const W = 1, B = 2;
const c = (q, r) => at(q, r);

export const rules = [
  'Players take turns placing one stone of their colour on any empty cell. White goes first. Stones never move.',
  'You win by making a straight line of four or more of your stones.',
  'You lose by making a straight line of exactly three, unless the same stone also completes four.',
  'After White’s first stone, Black may swap sides and take that stone instead of placing one.',
  'If the board fills with no line made, the game is a draw.',
];

export const steps = [
  {
    title: 'One stone a turn',
    text: 'You and your opponent take turns placing a single stone. Once placed, a stone never moves. Tap any cell to place a white stone.',
    async onTap(cell, api) {
      api.place(cell, W);
      await api.wait(650);
      const reply = cell === c(2, -1) ? c(-2, 1) : c(2, -1);
      api.place(reply, B);
      api.say('Black answers with a stone of their own, and the turn comes back to you. That is all a move ever is.');
      api.done();
    },
  },
  {
    title: 'Four in a row wins',
    text: 'Make a straight line of four or more of your stones and you win. White can win right now. Find the cell.',
    white: [[-1, 0], [0, 0], [2, 0]],
    black: [[0, 1], [-1, 2], [1, -2]],
    misses: 0,
    async onTap(cell, api) {
      if (cell !== c(1, 0)) {
        if (++this.misses >= 2) api.hint([c(1, 0)]);
        api.say('Not that one. Look for the gap in White’s row.');
        return api.nudge();
      }
      api.place(cell, W);
      await api.wait(450);
      api.line([c(-1, 0), c(0, 0), c(1, 0), c(2, 0)], 'win');
      api.say('Four in a row. White wins.');
      api.done();
    },
  },
  {
    title: 'Three in a row loses',
    text: 'Here is the twist. A line of exactly three loses the game. Tap the glowing cell to see it happen.',
    white: [[0, 0], [1, 0]],
    black: [[0, -2], [-2, 1]],
    hint: [[2, 0]],
    async onTap(cell, api) {
      if (cell !== c(2, 0)) return api.nudge();
      api.hint([]);
      api.place(cell, W);
      await api.wait(450);
      api.line([c(0, 0), c(1, 0), c(2, 0)], 'lose');
      api.say('Three in a row, so White loses on the spot. The one exception: if the same stone also completes four, it still wins.');
      api.done();
    },
  },
  {
    title: 'Force the mistake',
    text: 'So the real game is making your opponent line up three. Black has two stones with a gap between them. Threaten four so that Black’s only block is that gap.',
    white: [[-2, 0], [-1, 0]],
    black: [[0, -1], [0, 1]],
    misses: 0,
    async onTap(cell, api) {
      if (cell !== c(1, 0)) {
        if (++this.misses >= 2) api.hint([c(1, 0)]);
        api.say(classify(api.board(), cell, W) === LOSE
          ? 'That would give White three in a row, which loses. Try again.'
          : 'That does not force anything. Aim a row of four through the gap between Black’s stones.');
        return api.nudge();
      }
      api.hint([]);
      api.place(cell, W);
      api.say('White now threatens four through the centre. Black has to block…');
      await api.wait(1500);
      api.place(c(0, 0), B);
      await api.wait(500);
      api.line([c(0, -1), c(0, 0), c(0, 1)], 'lose');
      api.say('…and the block makes three in a row. Black loses. Setting up moves like this is the heart of Yavalath.');
      api.done();
    },
  },
  {
    title: 'The swap',
    text: 'One last rule. After White’s very first stone, Black may swap sides and take that stone as their own. So do not open too strongly, or your opponent will simply steal it.',
    white: [[0, 0]],
    info: true,
  },
];
