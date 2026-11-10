// Runs AI searches off the UI thread so the board stays responsive.
import { chooseMove as yavalath } from './yavalath-ai.js';

const engines = { yavalath };

self.onmessage = (e) => {
  const { id, game, board, player, level } = e.data;
  const result = engines[game](Int8Array.from(board), player, level);
  self.postMessage({ id, ...result });
};
