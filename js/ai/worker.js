// Runs AI searches off the UI thread so the board stays responsive.
import { MODULES, replay } from '../games/all.js';
import { chooseMove } from './mcts.js';

self.onmessage = (e) => {
  const { id, gameId, seed, actions, level } = e.data;
  const game = MODULES[gameId];
  const move = chooseMove(game, replay(game, seed, actions), level);
  self.postMessage({ id, move });
};
