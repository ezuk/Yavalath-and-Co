// The computer opponent for every game without a specialised engine: a
// one-move tactical check, then Monte Carlo tree search. Games may shorten
// playouts with `cutoff` + `evaluate`, and speed them up with `randomMove`.

export const LEVELS = {
  easy: { ms: 150, maxIter: 120, careful: false, blunder: 0.2 },
  medium: { ms: 700, maxIter: Infinity, careful: true, blunder: 0 },
  hard: { ms: 2000, maxIter: Infinity, careful: true, blunder: 0 },
};

const listMoves = (game, s) => (game.searchMoves ? game.searchMoves(s) : game.moves(s));
const pickRandom = (list) => list[(Math.random() * list.length) | 0];

function rewards(game, s) {
  const n = game.seats.length;
  if (s.winner > 0) { const r = new Array(n + 1).fill(0); r[s.winner] = 1; return r; }
  if (s.winner < 0 || !game.evaluate) return new Array(n + 1).fill(1 / n);
  return game.evaluate(s);
}

function playout(game, s) {
  const limit = game.cutoff || 400;
  for (let ply = 0; ply < limit && !s.winner; ply++) {
    let m = game.randomMove ? game.randomMove(s) : null;
    if (!m) { const list = game.moves(s); if (!list.length) break; m = pickRandom(list); }
    game.play(s, m);
  }
  return rewards(game, s);
}

function search(game, root, candidates, level) {
  const node = (parent, move, mover) => ({ parent, move, mover, children: [], untried: null, visits: 0, total: 0, done: false });
  const top = node(null, null, 0);
  top.untried = candidates.slice();
  const deadline = Date.now() + level.ms;
  let iter = 0;
  while (iter < level.maxIter && (iter & 15 || Date.now() < deadline)) {
    iter++;
    const s = game.clone(root);
    let at = top;
    while (!at.untried.length && at.children.length) {
      const logN = Math.log(at.visits);
      let best = null, bestU = -Infinity;
      for (const ch of at.children) {
        const u = ch.total / ch.visits + 0.9 * Math.sqrt(logN / ch.visits);
        if (u > bestU) { bestU = u; best = ch; }
      }
      at = best;
      game.play(s, at.move);
    }
    if (at.untried.length) {
      const k = (Math.random() * at.untried.length) | 0;
      const m = at.untried[k];
      at.untried[k] = at.untried[at.untried.length - 1];
      at.untried.pop();
      const child = node(at, m, s.toMove);
      game.play(s, m);
      child.untried = s.winner ? [] : listMoves(game, s);
      at.children.push(child);
      at = child;
    }
    const r = playout(game, s);
    for (let x = at; x; x = x.parent) { x.visits++; x.total += r[x.mover] || 0; }
  }
  let best = top.children[0];
  for (const ch of top.children) if (ch.visits > best.visits) best = ch;
  return best ? best.move : candidates[0];
}

export function chooseMove(game, root, levelName) {
  if (game.chooseMove) return game.chooseMove(root, levelName);
  const level = LEVELS[levelName] || LEVELS.medium;
  const all = listMoves(game, root);
  if (all.length <= 1) return all[0];
  const me = root.toMove;

  // Take a win on the spot; never walk into an immediate loss if avoidable.
  const sound = [];
  for (const m of all) {
    const s = game.clone(root);
    game.play(s, m);
    if (s.winner === me) return m;
    if (s.winner > 0) continue;
    sound.push({ m, s });
  }
  if (!sound.length) return pickRandom(all);
  if (level.blunder && Math.random() < level.blunder) return pickRandom(sound).m;

  let candidates = sound;
  if (level.careful && sound.length <= 150) {
    // Drop moves that hand the next player a win in one.
    const safe = sound.filter(({ s }) => {
      if (s.winner || s.toMove === me) return true;
      const next = s.toMove;
      const replies = listMoves(game, s);
      if (replies.length > 150) return true;
      for (const r of replies) {
        const t = game.clone(s);
        game.play(t, r);
        if (t.winner === next) return false;
      }
      return true;
    });
    if (safe.length) candidates = safe;
  }
  if (candidates.length === 1) return candidates[0].m;
  return search(game, root, candidates.map((c) => c.m), level);
}
