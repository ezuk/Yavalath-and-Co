// App shell: screens, the play loop against the AI, and the lesson runner.

import { BoardScene } from './scene.js';
import { playClick } from './sound.js';
import { GAMES } from './games/index.js';
import { at, N } from './hex.js';
import * as rulesEngine from './games/yavalath.js';
import { steps as lessonSteps, rules as rulesText } from './games/yavalath-tutorial.js';
import { shouldSwap } from './ai/yavalath-ai.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const COLOR_NAME = { 1: 'White', 2: 'Black' };
const LEVEL_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

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
const prefs = { level: 'medium', side: 1, sound: true, ...store.get('prefs', {}) };
const savePrefs = () => store.set('prefs', prefs);

// ---- sound and touch feedback ------------------------------------------

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

// ---- AI worker ----------------------------------------------------------

let worker = null;
let requestId = 0;
const pending = new Map();
function askAI(board, player, level) {
  if (!worker) {
    worker = new Worker(new URL('./ai/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const resolve = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (resolve) resolve(e.data);
    };
  }
  return new Promise((resolve) => {
    const id = ++requestId;
    pending.set(id, resolve);
    worker.postMessage({ id, game: 'yavalath', board: Array.from(board), player, level });
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
  hideSheet();
  $('toast').hidden = true;
  setScreen('home');
  scene.clearStones({ animate: false });
  for (const [colour, q, r] of SHOWPIECE) scene.placeStone(at(q, r), colour, { animate: false });
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
  GAMES.forEach((g, k) => {
    const li = document.createElement('li');
    const row = document.createElement('button');
    row.className = 'game-row' + (g.ready ? ' ready' : '');
    row.innerHTML = `<span class="num">${String(k + 1).padStart(2, '0')}</span><span class="name"></span><span class="tag">${g.ready ? 'Play' : 'Soon'}</span><span class="blurb"></span>`;
    row.querySelector('.name').textContent = g.name;
    row.querySelector('.blurb').textContent = g.blurb;
    if (g.ready) row.addEventListener('click', () => openSetup(g));
    else row.setAttribute('aria-disabled', 'true');
    li.append(row);
    list.append(li);
  });
}

let currentGame = GAMES[0];
function openSetup(g) {
  currentGame = g;
  $('setup-by').textContent = `${g.by}, ${g.year}`;
  $('setup-name').textContent = g.name;
  $('setup-blurb').textContent = g.blurb;
  document.querySelector(`input[name=level][value=${prefs.level}]`).checked = true;
  document.querySelector(`input[name=side][value="${prefs.side}"]`).checked = true;
  const save = store.get(g.id + '.save', null);
  $('resume').hidden = !(save && save.actions.length);
  showSheet('setup');
}
$('level').addEventListener('change', (e) => { prefs.level = e.target.value; savePrefs(); });
$('side').addEventListener('change', (e) => { prefs.side = +e.target.value; savePrefs(); });
$('play').addEventListener('click', () => { hideSheet(); startGame(); });
$('resume').addEventListener('click', () => { hideSheet(); startGame(store.get(currentGame.id + '.save', null)); });
$('learn').addEventListener('click', () => { hideSheet(); startLesson(); });

// ---- play ---------------------------------------------------------------

// A game is a list of actions: cell indices, plus 'swap' when Black takes
// White's opening stone. Everything else is derived by replaying it.
const session = { token: 0, firstSide: 1, level: 'medium', actions: [], state: null, human: 1, thinking: false };

function derive() {
  const state = rulesEngine.newState();
  let human = session.firstSide;
  for (const a of session.actions) {
    if (a === 'swap') human = 3 - human; else rulesEngine.play(state, a);
  }
  session.state = state;
  session.human = human;
}

function saveGame() {
  const { firstSide, level, actions } = session;
  if (session.state.winner) store.remove(currentGame.id + '.save');
  else store.set(currentGame.id + '.save', { firstSide, level, actions });
}

function startGame(saved) {
  session.token++;
  session.firstSide = saved ? saved.firstSide : prefs.side;
  session.level = saved ? saved.level : prefs.level;
  session.actions = saved ? saved.actions.slice() : [];
  session.thinking = false;
  derive();
  hideSheet();
  $('game-name').textContent = currentGame.name;
  enterBoard('play');
  scene.clearStones({ animate: false });
  scene.sync(session.state.b);
  if (session.state.last >= 0) scene.setMarker(session.state.last);
  advance();
}

function canSwap() {
  const s = session.state;
  return s.count === 1 && s.turn === 2 && session.human === 2 && !session.actions.includes('swap');
}

function renderStatus() {
  const s = session.state;
  const mine = s.turn === session.human;
  $('game-sub').textContent = `You are ${COLOR_NAME[session.human]} · ${LEVEL_NAME[session.level]}`;
  const chip = $('turn-chip');
  chip.dataset.c = s.winner && s.winner !== 3 ? s.winner : s.turn;
  chip.classList.toggle('thinking', !s.winner && !mine);
  chip.hidden = s.winner === 3;
  $('status').textContent = s.winner ? resultText().title
    : !mine ? 'Computer is thinking'
    : canSwap() ? 'Place a stone, or swap sides'
    : 'Your move';
  $('swap').hidden = !canSwap() || !!s.winner;
  $('undo').disabled = !session.actions.some((a, k) => actorOf(k) === 'human');
}

// Who performed action k: replay the swaps up to that point.
function actorOf(k) {
  let human = session.firstSide;
  let turn = 1;
  for (let i = 0; i < k; i++) {
    if (session.actions[i] === 'swap') human = 3 - human; else turn = 3 - turn;
  }
  return turn === human ? 'human' : 'ai';
}

function resultText() {
  const s = session.state;
  if (s.winner === 3) return { title: 'A draw', why: 'The board filled up with no line of four and no line of three.' };
  const won = s.winner === session.human;
  const loserMadeThree = s.lostByThree;
  const who = loserMadeThree ? (won ? 'The computer' : 'You') : (won ? 'You' : 'The computer');
  return {
    title: won ? 'You win' : 'You lose',
    why: `${who} made ${loserMadeThree ? 'three in a row, which loses' : 'four in a row'}.`,
  };
}

function advance() {
  renderStatus();
  saveGame();
  const s = session.state;
  if (s.winner) return finish();
  if (s.turn !== session.human) aiTurn();
}

async function finish() {
  const token = session.token;
  const s = session.state;
  if (s.line) {
    await sleep(350);
    if (token !== session.token) return;
    scene.markLine(s.line, s.lostByThree ? 'lose' : 'win');
  }
  await sleep(1300);
  if (token !== session.token) return;
  const { title, why } = resultText();
  $('result-title').textContent = title;
  $('result-why').textContent = why;
  showSheet('result');
}

async function aiTurn() {
  const token = session.token;
  const s = session.state;
  session.thinking = true;
  const offeredSwap = s.count === 1 && s.turn === 2 && !session.actions.includes('swap');
  if (offeredSwap && shouldSwap(session.actions[0])) {
    await sleep(900);
    if (token !== session.token) return;
    session.actions.push('swap');
    derive();
    session.thinking = false;
    toast('The computer swaps sides. That stone is now theirs, and you are Black.');
    return advance();
  }
  const [reply] = await Promise.all([askAI(s.b, s.turn, session.level), sleep(650)]);
  if (token !== session.token) return;
  session.thinking = false;
  commitMove(reply.move);
}

function commitMove(cell) {
  const colour = session.state.turn;
  session.actions.push(cell);
  derive();
  scene.placeStone(cell, colour, { mark: true });
  clack();
  advance();
}

scene.onTap = (cell) => {
  const screen = document.body.dataset.screen;
  if (openSheet) return;
  if (screen === 'lesson') return lessonTap(cell);
  if (screen !== 'play') return;
  const s = session.state;
  if (s.winner || session.thinking || s.turn !== session.human || s.b[cell]) return;
  commitMove(cell);
};

$('swap').addEventListener('click', () => {
  if (!canSwap()) return;
  session.actions.push('swap');
  derive();
  toast('Swapped. You are now White, and the computer plays Black.');
  advance();
});

$('undo').addEventListener('click', () => {
  // Step back to just before the player's most recent action.
  let k = session.actions.length - 1;
  while (k >= 0 && actorOf(k) !== 'human') k--;
  if (k < 0) return;
  session.token++;
  session.thinking = false;
  session.actions.length = k;
  derive();
  scene.clearEffects();
  scene.sync(session.state.b, { animate: true });
  if (session.state.last >= 0) scene.setMarker(session.state.last);
  advance();
});

$('restart').addEventListener('click', () => { store.remove(currentGame.id + '.save'); startGame(); });
$('result-again').addEventListener('click', () => startGame());
$('result-view').addEventListener('click', hideSheet);

// ---- rules sheet --------------------------------------------------------

$('rules-btn').addEventListener('click', () => {
  $('rules-name').textContent = currentGame.name;
  $('rules-list').replaceChildren(...rulesText.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
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

const lesson = { token: 0, index: 0, board: null, busy: false, complete: false };

function startLesson() {
  session.token++;
  $('game-name').textContent = currentGame.name;
  $('game-sub').textContent = 'Interactive lesson';
  enterBoard('lesson');
  $('lesson-dots').replaceChildren(...lessonSteps.map(() => document.createElement('i')));
  showStep(0);
  // The lesson card's height depends on its text, so fit the camera once it is laid out.
  requestAnimationFrame(() => layoutCamera());
}

function showStep(index) {
  const step = lessonSteps[index];
  lesson.token++;
  lesson.index = index;
  lesson.busy = false;
  lesson.complete = !!step.info;
  lesson.board = new Int8Array(N);
  step.misses = 0;
  scene.clearStones({ animate: false });
  for (const [q, r] of step.white || []) { lesson.board[at(q, r)] = 1; scene.placeStone(at(q, r), 1, { animate: false }); }
  for (const [q, r] of step.black || []) { lesson.board[at(q, r)] = 2; scene.placeStone(at(q, r), 2, { animate: false }); }
  scene.setHints((step.hint || []).map(([q, r]) => at(q, r)));
  $('lesson-count').textContent = `Step ${index + 1} of ${lessonSteps.length}`;
  [...$('lesson-dots').children].forEach((dot, k) => dot.classList.toggle('on', k <= index));
  $('lesson-title').textContent = step.title;
  $('lesson-text').textContent = step.text;
  $('lesson-prev').disabled = index === 0;
  renderLessonNext();
}

function renderLessonNext() {
  const last = lesson.index === lessonSteps.length - 1;
  $('lesson-next').textContent = last ? 'Play a game' : 'Next';
  $('lesson-next').disabled = !lesson.complete;
}

async function lessonTap(cell) {
  const step = lessonSteps[lesson.index];
  if (lesson.busy || lesson.complete || lesson.board[cell]) return;
  const token = lesson.token;
  const live = () => token === lesson.token;
  const api = {
    board: () => lesson.board,
    place(c, colour) { if (!live()) return; lesson.board[c] = colour; scene.placeStone(c, colour, { mark: true }); clack(); },
    say(text) { if (live()) $('lesson-text').textContent = text; },
    hint(list) { if (live()) scene.setHints(list); },
    line(list, kind) { if (live()) scene.markLine(list, kind); },
    // Never resolves once the learner has moved on, which abandons the stale script.
    wait: (ms) => new Promise((resolve) => setTimeout(() => { if (live()) resolve(); }, ms)),
    done() { if (!live()) return; lesson.complete = true; renderLessonNext(); },
    nudge() {
      if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
      const el = $('lesson-text');
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    },
  };
  lesson.busy = true;
  await step.onTap(cell, api);
  if (live()) lesson.busy = false;
}

$('lesson-prev').addEventListener('click', () => showStep(Math.max(lesson.index - 1, 0)));
$('lesson-next').addEventListener('click', () => {
  if (lesson.index < lessonSteps.length - 1) return showStep(lesson.index + 1);
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

buildShelf();
renderSound();
goHome();
layoutCamera(false);
document.fonts?.ready.then(() => layoutCamera(false));
