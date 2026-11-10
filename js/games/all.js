// Every game's rules module, keyed by id.
import yavalath from './yavalath.js';
import pentalath from './pentalath.js';
import yavalanchor from './yavalanchor.js';
import yavalade from './yavalade.js';
import cross from './cross.js';
import omega from './omega.js';
import manalath from './manalath.js';
import odd from './odd.js';
import coffee from './coffee.js';
import ducks from './ducks.js';
import susan from './susan.js';
import taacoca from './taacoca.js';
import quantum from './quantum.js';
import playwin from './playwin.js';
import onager from './onager.js';

export const MODULES = { yavalath, pentalath, yavalanchor, yavalade, cross, omega, manalath, odd, coffee, ducks, susan, taacoca, quantum, playwin, onager };

// Rebuilds a position from its saved form: a seed plus the list of actions.
// 'swap' entries change who controls which side, not the position.
export function replay(game, seed, actions) {
  const s = game.setup({ seed });
  for (const a of actions) if (a !== 'swap') game.play(s, a);
  return s;
}
