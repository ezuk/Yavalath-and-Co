// App shell: screens, the play loop against the AI, and the lesson runner.
// Nothing here knows any game's rules; it drives the shared game interface
// described in games/util.js.

import { BoardScene } from './scene.js';
import { playClick } from './sound.js';
import { GAMES } from './games/index.js';
import { MODULES } from './games/all.js';
import { at } from './hex.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LEVEL_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const ORDINAL = ['first', 'second', 'third'];
const CATALOGUE = GAMES.map((meta) => ({ ...meta, ...MODULES[meta.id] }));

// ---- storage ------------------------------------------------------------

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('yco.' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('yco.' + key, JSON.stringify(value)); } catch { /* private mode: play on without saving */ }
  },
  remove(key) { try { localStorage.removeItem('yco.' + key); } catch { /* ignore */ } },
};
const prefs = { level: 'medium', seat: {}, sound: true, ...store.get('prefs', {}) };
const savePrefs = () => store.set('prefs', prefs);

function clack(delay = 150) {
  if (navigator.vibrate) setTimeout(() => navigator.vibrate(8), delay);
  if (prefs.sound) playClick(delay);
}

// ---- scene --------------------------------------------------------------

const scene = new BoardScene($('board'));
window.__scene = scene; // handle for automated tests

const SHOWPIECE = [
  [1, 0, 0], [2, 1, 0], [1, -1, 1], [2, 0, -1], [1, 2, -2], [2, -2, 1], [3, 1, 1],
  [1, -1, -1], [2, -1, 2], [3, -2, -1], [1, 3, -1], [2, 2, 1],
];

// Shows a position, with sound for whatever just landed.
function show(game, state, { animate = true, quiet = false } = {}) {
  const fx = state.fx || null;
  scene.apply(game.view(state), fx, { animate });
  if (!animate || quiet || !fx) return;
  const hops = fx.moved && fx.moved.length ? Math.max(...fx.moved.map((p) => p.length - 1)) : 0;
  if (hops) clack(300 * hops - 60); else if (fx.last !== undefined) clack(150);
}

function layoutCamera(animate = true) {
  const h = innerHeight;
  const screen = document.body.dataset.screen;
  if (screen === 'home') {
    // Keep the showpiece board clear of the title, which sits at the foot of the hero.
    const hero = document.querySelector('.hero');
    const title = hero.querySelector('h1').offsetHeight + hero.querySelector('.eyebrow').offsetHeight + 96;
    scene.setInsets(8, h - hero.offsetHeight + title, { animate });
  } else {
    const bar = screen === 'lesson' ? $('lesson-bar') : $('play-bar');
    scene.setInsets($('game').querySelector('.topbar').offsetHeight, bar.offsetHeight - 10, { animate });
  }
}
addEventListener('resize', () => layoutCamera(false));
// The bars change height as prompts, notes and choice buttons come and go.
const barWatcher = new ResizeObserver(() => { if (document.body.dataset.screen !== 'home') layoutCamera(); });
barWatcher.observe($('play-bar'));
barWatcher.observe($('lesson-bar'));

// ---- AI worker ----------------------------------------------------------

let worker = null;
let requestId = 0;
const pending = new Map();
function askAI(game, seed, actions, level) {
  if (!worker) {
    worker = new Worker(new URL('./ai/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const resolve = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (resolve) resolve(e.data.move);
    };
  }
  return new Promise((resolve) => {
    const id = ++requestId;
    pending.set(id, resolve);
    worker.postMessage({ id, gameId: game.id, seed, actions, level });
  });
}

// ---- screens and sheets -------------------------------------------------

let openSheet = null;
function showSheet(id) {
  hideSheet();
  openSheet = $(id);
  openSheet.hidden = false;
  $('scrim').hidden = false;
  $('scrim').classList.toggle('clear', id === 'result'); // keep the finished board visible
  openSheet.querySelector('button, input')?.focus({ preventScroll: true });
}
function hideSheet() {
  if (openSheet) openSheet.hidden = true;
  openSheet = null;
  $('scrim').hidden = true;
}
$('scrim').addEventListener('click', () => { if (openSheet?.id !== 'result') hideSheet(); });

function setScreen(name) {
  document.body.dataset.screen = name;
  $('home').hidden = name !== 'home';
  $('game').hidden = name === 'home';
  $('play-bar').hidden = name !== 'play';
  $('lesson-bar').hidden = name !== 'lesson';
  scene.autoRotate = name === 'home';
  scene.locked = name === 'home';
}

let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

function goHome() {
  session.token++;
  lesson.token++;
  input.ctx = null;
  hideSheet();
  $('toast').hidden = true;
  setScreen('home');
  scene.clear();
  const cells = Array.from({ length: 61 }, () => []);
  for (const [colour, q, r] of SHOWPIECE) cells[at(q, r)] = [colour];
  scene.apply({ cells }, null, { animate: false });
  layoutCamera();
}

function enterBoard(name) {
  const fromHome = document.body.dataset.screen === 'home';
  setScreen(name);
  if (fromHome) history.pushState({ board: true }, '');
  scene.resetView();
  layoutCamera();
}
addEventListener('popstate', () => { if (document.body.dataset.screen !== 'home') goHome(); });
$('back').addEventListener('click', () => history.back());

// ---- home ---------------------------------------------------------------

function buildShelf() {
  const list = $('games');
  CATALOGUE.forEach((g, k) => {
    const li = document.createElement('li');
    const row = document.createElement('button');
    row.className = 'game-row';
    row.dataset.game = g.id;
    row.innerHTML = `<span class="num">${String(k + 1).padStart(2, '0')}</span><span class="name"></span><span class="go" aria-hidden="true">›</span><span class="blurb"></span>`;
    row.querySelector('.name').textContent = g.name;
    row.querySelector('.blurb').textContent = g.blurb;
    row.addEventListener('click', () => openSetup(g));
    li.append(row);
    list.append(li);
  });
}

let currentGame = CATALOGUE[0];
function openSetup(g) {
  currentGame = g;
  $('setup-by').textContent = `${g.by}, ${g.year}`;
  $('setup-name').textContent = g.name;
  $('setup-blurb').textContent = g.blurb;
  document.querySelector(`input[name=level][value=${prefs.level}]`).checked = true;
  const seat = prefs.seat[g.id] || 1;
  const side = $('side');
  side.querySelectorAll('label').forEach((l) => l.remove());
  g.seats.forEach((name, k) => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="radio" name="side" value="${k + 1}"><span></span>`;
    label.querySelector('span').textContent = `${name}, ${ORDINAL[k]}`;
    label.querySelector('input').checked = k + 1 === seat;
    side.append(label);
  });
  const save = store.get(g.id + '.save', null);
  $('resume').hidden = !(save && save.actions.length);
  showSheet('setup');
}
$('level').addEventListener('change', (e) => { prefs.level = e.target.value; savePrefs(); });
$('side').addEventListener('change', (e) => { prefs.seat[currentGame.id] = +e.target.value; savePrefs(); });
$('play').addEventListener('click', () => { hideSheet(); startGame(); });
$('resume').addEventListener('click', () => { hideSheet(); startGame(store.get(currentGame.id + '.save', null)); });
$('learn').addEventListener('click', () => { hideSheet(); startLesson(); });

// ---- input --------------------------------------------------------------

// A move is { path: [cells to tap], pick?: option chosen with a button }.
// The player builds one up: choose an option if the game offers any, then
// tap cells until what they have tapped matches exactly one legal move.
// `ctx` is whoever is asking for a move right now: the game or the lesson.
const input = { ctx: null, pick: null, prefix: [], legal: [], picks: [], guide: null };

const samePath = (a, b, unordered) => a.length === b.length
  && (unordered ? a.every((c) => b.includes(c)) : a.every((c, i) => c === b[i]));
const sameMove = (a, b, unordered) => a.pick === b.pick && samePath(a.path, b.path, unordered);

function extendsTo(move, prefix, unordered) {
  if (move.path.length < prefix.length) return false;
  return unordered ? prefix.every((c) => move.path.includes(c)) : prefix.every((c, i) => move.path[i] === c);
}

function candidates(prefix) {
  const { game } = input.ctx;
  const choosable = input.picks.filter((p) => !p.action).map((p) => p.id);
  return input.legal.filter((m) => m.path.length
    && (m.pick === undefined || !choosable.includes(m.pick) || m.pick === input.pick)
    && extendsTo(m, prefix, game.unordered));
}

function bars() {
  const lessonMode = document.body.dataset.screen === 'lesson';
  return { picks: $(lessonMode ? 'lesson-picks' : 'picks'), done: $(lessonMode ? 'lesson-done' : 'done') };
}

// Call whenever the position, or whose turn it is, has changed.
function refreshInput({ keepPick = false } = {}) {
  const ctx = input.ctx;
  input.prefix = [];
  if (!ctx || !ctx.active()) {
    input.legal = []; input.picks = [];
  } else {
    const s = ctx.state();
    input.legal = ctx.game.moves(s);
    input.picks = ctx.game.picks ? ctx.game.picks(s) : [];
    const choosable = input.picks.filter((p) => !p.action);
    if (!keepPick || !choosable.some((p) => p.id === input.pick)) {
      input.pick = choosable.length ? choosable[0].id : null;
    }
  }
  renderInput();
}

function renderInput() {
  const { picks, done } = bars();
  const ctx = input.ctx;
  picks.replaceChildren(...input.picks.map((p) => {
    const b = document.createElement('button');
    b.className = 'pick' + (p.action ? ' action' : '');
    b.dataset.pick = p.id;
    if (p.color) b.append(Object.assign(document.createElement('span'), { className: 'stone-chip' }));
    if (p.color) b.firstChild.dataset.c = p.color;
    b.append(p.label);
    if (!p.action) b.setAttribute('aria-pressed', String(p.id === input.pick));
    b.addEventListener('click', () => choosePick(p));
    return b;
  }));
  picks.hidden = !input.picks.length;

  if (!ctx || !input.legal.length) {
    scene.setSelected([]); scene.setHints([]); done.hidden = true;
    return;
  }
  const unordered = ctx.game.unordered;
  const cand = candidates(input.prefix);
  const next = new Set();
  for (const m of cand) {
    if (unordered) m.path.forEach((c) => { if (!input.prefix.includes(c)) next.add(c); });
    else if (m.path.length > input.prefix.length) next.add(m.path[input.prefix.length]);
  }
  let hints = [...next];
  const guide = input.guide;
  if (guide) {
    // A lesson is pointing at the answer.
    hints = unordered ? guide.path.filter((c) => !input.prefix.includes(c))
      : extendsTo(guide, input.prefix, false) ? guide.path.slice(input.prefix.length, input.prefix.length + 1) : [];
  } else if (!input.prefix.length && !(ctx.game.hintStart && hints.length <= 30)) {
    hints = []; // an open board needs no pointers
  }
  scene.setSelected(input.prefix);
  scene.setHints(hints);
  const exact = cand.filter((m) => m.path.length === input.prefix.length);
  done.hidden = !(input.prefix.length && exact.length && exact.length < cand.length);
}

function choosePick(p) {
  const ctx = input.ctx;
  if (!ctx || !ctx.active()) return;
  if (p.action) {
    const move = input.legal.find((m) => m.pick === p.id && !m.path.length);
    if (move) ctx.commit(move);
    return;
  }
  input.pick = p.id;
  input.prefix = [];
  renderInput();
}

function tapCell(cell) {
  const ctx = input.ctx;
  if (!ctx || !ctx.active() || !input.legal.length) return;
  const unordered = ctx.game.unordered;
  let prefix = input.prefix;
  if (unordered && prefix.includes(cell)) {
    prefix = prefix.filter((c) => c !== cell);
  } else if (candidates(prefix.concat(cell)).length) {
    prefix = prefix.concat(cell);
  } else if (!unordered && candidates([cell]).length) {
    prefix = [cell]; // start again from a different piece
  } else {
    if (prefix.length && !unordered) { input.prefix = []; renderInput(); }
    return;
  }
  input.prefix = prefix;
  const cand = candidates(prefix);
  const exact = cand.filter((m) => m.path.length === prefix.length);
  if (exact.length && exact.length === cand.length) return ctx.commit(exact[0]);
  renderInput();
}

function finishPath() {
  const ctx = input.ctx;
  if (!ctx) return;
  const exact = candidates(input.prefix).find((m) => m.path.length === input.prefix.length);
  if (exact) ctx.commit(exact);
}
$('done').addEventListener('click', finishPath);
$('lesson-done').addEventListener('click', finishPath);

scene.onTap = (cell) => { if (!openSheet) tapCell(cell); };

// ---- play ---------------------------------------------------------------

// A game is saved as a seed plus a list of actions: moves, and 'swap' when
// the second player takes over the first player's opening.
const session = { token: 0, game: null, seed: 1, firstSeat: 1, level: 'medium', actions: [], actors: [], state: null, human: 1, thinking: false };

function derive() {
  const { game } = session;
  const state = game.setup({ seed: session.seed });
  let human = session.firstSeat;
  session.actors = [];
  for (const a of session.actions) {
    if (a === 'swap') {
      session.actors.push(human === 2 ? 'human' : 'ai');
      human = 3 - human;
    } else {
      session.actors.push(state.toMove === human ? 'human' : 'ai');
      game.play(state, a);
    }
  }
  session.state = state;
  session.human = human;
}

function saveGame() {
  const { seed, firstSeat, level, actions } = session;
  if (session.state.winner) store.remove(session.game.id + '.save');
  else store.set(session.game.id + '.save', { seed, firstSeat, level, actions });
}

const playCtx = {
  get game() { return session.game; },
  state: () => session.state,
  active: () => !session.state.winner && !session.thinking && session.state.toMove === session.human,
  commit: (move) => commitMove(move),
};

function startGame(saved) {
  session.token++;
  session.game = currentGame;
  session.seed = saved ? saved.seed : (Date.now() % 2147483646) + 1;
  session.firstSeat = saved ? saved.firstSeat : Math.min(prefs.seat[currentGame.id] || 1, currentGame.seats.length);
  session.level = saved ? saved.level : prefs.level;
  session.actions = saved ? saved.actions.slice() : [];
  session.thinking = false;
  derive();
  hideSheet();
  $('game-name').textContent = currentGame.name;
  enterBoard('play');
  scene.clear();
  input.ctx = playCtx;
  input.guide = null;
  show(session.game, session.state, { animate: false });
  advance();
}

const swapOpen = () => {
  const { game, state } = session;
  return !!game.canSwap && game.canSwap(state) && state.toMove === 2 && !session.actions.includes('swap');
};

function renderStatus() {
  const { game, state: s, human } = session;
  const mine = s.toMove === human;
  $('game-sub').textContent = `You are ${game.seats[human - 1]} · ${LEVEL_NAME[session.level]}`;
  const chip = $('turn-chip');
  const colour = s.winner > 0 ? game.seatColors[s.winner - 1] : game.turnColor ? game.turnColor(s) : game.seatColors[s.toMove - 1];
  chip.dataset.c = colour;
  chip.hidden = !colour || s.winner < 0;
  chip.classList.toggle('thinking', !s.winner && !mine);
  const prompt = (game.prompt && game.prompt(s)) || 'Your move';
  $('status').textContent = s.winner ? resultText().title
    : !mine ? `${game.seats.length > 2 ? game.seats[s.toMove - 1] : 'Computer'} is thinking`
    : swapOpen() ? `${prompt}, or swap sides`
    : prompt;
  $('note').textContent = (game.note && game.note(s, human)) || '';
  $('note').hidden = !$('note').textContent;
  $('swap').hidden = !(mine && swapOpen()) || !!s.winner;
  $('undo').disabled = !session.actors.includes('human');
}

function resultText() {
  const { game, state: s, human } = session;
  const title = s.winner < 0 ? 'A draw' : s.winner === human ? 'You win'
    : game.seats.length > 2 ? `${game.seats[s.winner - 1]} wins` : 'You lose';
  const [seat, text] = s.reason || [0, ''];
  const who = seat === human ? 'You' : game.seats.length > 2 ? game.seats[seat - 1] : 'The computer';
  return { title, why: seat ? `${who} ${text}.` : text };
}

function advance() {
  renderStatus();
  saveGame();
  refreshInput({ keepPick: true });
  const s = session.state;
  if (s.winner) return finish();
  if (s.toMove !== session.human) aiTurn();
}

async function finish() {
  const token = session.token;
  const s = session.state;
  if (s.line && s.line.length) {
    await sleep(450);
    if (token !== session.token) return;
    scene.markLine(s.line, s.lineKind);
  }
  await sleep(1400);
  if (token !== session.token) return;
  const { title, why } = resultText();
  $('result-title').textContent = title;
  $('result-why').textContent = why;
  showSheet('result');
}

async function aiTurn() {
  const token = session.token;
  const { game, state: s } = session;
  session.thinking = true;
  if (swapOpen() && game.shouldSwap(s)) {
    await sleep(900);
    if (token !== session.token) return;
    session.actions.push('swap');
    derive();
    session.thinking = false;
    toast(`The computer swaps sides. You are now ${game.seats[session.human - 1]}.`);
    return advance();
  }
  const [move] = await Promise.all([askAI(game, session.seed, session.actions, session.level), sleep(650)]);
  if (token !== session.token) return;
  session.thinking = false;
  commitMove(move);
}

function commitMove(move) {
  session.actions.push(move);
  derive();
  show(session.game, session.state);
  advance();
}

$('swap').addEventListener('click', () => {
  if (!swapOpen() || session.human !== 2) return;
  session.actions.push('swap');
  derive();
  toast(`Swapped. You are now ${session.game.seats[0]}.`);
  advance();
});

$('undo').addEventListener('click', () => {
  // Step back to just before the player's most recent action.
  const k = session.actors.lastIndexOf('human');
  if (k < 0) return;
  session.token++;
  session.thinking = false;
  session.actions.length = k;
  derive();
  scene.clearEffects();
  show(session.game, session.state, { quiet: true });
  advance();
});

$('restart').addEventListener('click', () => { store.remove(currentGame.id + '.save'); startGame(); });
$('result-again').addEventListener('click', () => startGame());
$('result-view').addEventListener('click', hideSheet);

// ---- rules sheet --------------------------------------------------------

$('rules-btn').addEventListener('click', () => {
  $('rules-name').textContent = currentGame.name;
  $('rules-list').replaceChildren(...currentGame.rules.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
  showSheet('rules');
});
$('rules-close').addEventListener('click', hideSheet);
$('rules-lesson').addEventListener('click', () => { hideSheet(); startLesson(); });

$('sound-btn').addEventListener('click', () => {
  prefs.sound = !prefs.sound;
  savePrefs();
  renderSound();
  if (prefs.sound) clack(0);
});
function renderSound() {
  $('sound-btn').classList.toggle('off', !prefs.sound);
  $('sound-btn').setAttribute('aria-label', prefs.sound ? 'Turn sound off' : 'Turn sound on');
  $('sound-btn').setAttribute('aria-pressed', String(prefs.sound));
}

// ---- lesson -------------------------------------------------------------

// Each step sets up a position and asks for one move, checked against the
// real rules. See any game module's `lesson` array for the step format.
const lesson = { token: 0, game: null, index: 0, state: null, complete: false, misses: 0 };

const lessonCtx = {
  get game() { return lesson.game; },
  state: () => lesson.state,
  active: () => !lesson.complete,
  commit: (move) => lessonMove(move),
};

function startLesson() {
  session.token++;
  lesson.game = currentGame;
  $('game-name').textContent = currentGame.name;
  $('game-sub').textContent = 'Interactive lesson';
  enterBoard('lesson');
  input.ctx = lessonCtx;
  $('lesson-dots').replaceChildren(...currentGame.lesson.map(() => document.createElement('i')));
  showStep(0);
}

function say(text) { $('lesson-text').textContent = text; }

function showStep(index) {
  const { game } = lesson;
  const step = game.lesson[index];
  lesson.token++;
  lesson.index = index;
  lesson.misses = 0;
  lesson.complete = !!step.info;
  lesson.state = game.setup({ blank: true });
  if (step.build) step.build(lesson.state);
  scene.clear();
  show(game, lesson.state, { animate: false });
  $('lesson-count').textContent = `Step ${index + 1} of ${game.lesson.length}`;
  [...$('lesson-dots').children].forEach((dot, k) => dot.classList.toggle('on', k <= index));
  $('lesson-title').textContent = step.title;
  say(step.text);
  $('lesson-prev').disabled = index === 0;
  input.guide = step.show ? step.solve : null;
  refreshInput();
  if (step.pick !== undefined) { input.pick = step.pick; renderInput(); }
  renderLesson();
}

function renderLesson() {
  const { game, state } = lesson;
  const last = lesson.index === game.lesson.length - 1;
  $('lesson-next').textContent = last ? 'Play a game' : 'Next';
  $('lesson-next').disabled = !lesson.complete;
  const note = (game.note && game.note(state, state.toMove)) || '';
  $('lesson-note').textContent = note;
  $('lesson-note').hidden = !note;
}

function nudge() {
  if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
  const el = $('lesson-text');
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

async function lessonMove(move) {
  const { game } = lesson;
  const step = game.lesson[lesson.index];
  const token = lesson.token;
  const before = lesson.state;
  const after = game.clone(before);
  game.play(after, move);
  const ok = step.want ? step.want(move, after, before)
    : step.any ? true : sameMove(move, step.solve, game.unordered);
  if (!ok) {
    lesson.misses++;
    const miss = typeof step.miss === 'function' ? step.miss(move, before) : step.miss;
    say(miss || 'Not quite. Try again.');
    nudge();
    if (lesson.misses >= 2 && step.solve) {
      input.guide = step.solve;
      if (step.solve.pick !== undefined) input.pick = step.solve.pick;
    }
    input.prefix = [];
    return renderInput();
  }
  lesson.state = after;
  lesson.complete = true; // no more input while the step plays out
  input.guide = null;
  refreshInput();
  show(game, after);
  if (step.done) say(step.done);
  renderLesson();
  $('lesson-next').disabled = true;
  if (!after.winner && step.reply) {
    await sleep(1500);
    if (token !== lesson.token) return;
    game.play(after, step.reply(after));
    show(game, after);
    if (step.replyText) say(step.replyText);
    renderLesson();
    $('lesson-next').disabled = true;
  }
  if (after.line && after.line.length) {
    await sleep(500);
    if (token !== lesson.token) return;
    scene.markLine(after.line, after.lineKind);
  }
  $('lesson-next').disabled = false;
}

$('lesson-prev').addEventListener('click', () => showStep(Math.max(lesson.index - 1, 0)));
$('lesson-next').addEventListener('click', () => {
  if (lesson.index < lesson.game.lesson.length - 1) return showStep(lesson.index + 1);
  store.set(currentGame.id + '.learned', true);
  startGame();
});

// ---- install and offline ------------------------------------------------

let installEvent = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('install').hidden = false;
});
$('install').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('install').hidden = true;
});
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone) $('ios-hint').hidden = false;
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}

// ---- boot ---------------------------------------------------------------

// Handle for automated tests.
window.__app = { session, lesson, input, tapCell, choosePick, openSetup, games: CATALOGUE };

buildShelf();
renderSound();
goHome();
layoutCamera(false);
document.fonts?.ready.then(() => layoutCamera(false));
