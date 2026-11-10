# Yavalath & Co.

A single-player web app for the fifteen games in the book *Yavalath & Co.* by
Néstor Romeral Andrés: a 3D board, a computer opponent, and an interactive
lesson for each game. It installs to a phone's home screen and plays offline.

## Status

All fifteen games are playable against the computer at three levels, and each
has a rules sheet and an interactive lesson: Yavalath, Pentalath, Yavalanchor,
Yavalade (you against two computer players), Cross, Omega, Manalath, Odd,
Coffee, Feed the Ducks, Susan, Taacoca, Quantum Leap, Play Win and Onager.

Where the book leaves a rule open, the choice made is noted in a comment in
that game's module. The ones worth knowing:

- Manalath: a group of four takes precedence over a group of five.
- Play Win: a non-capturing move must end nearer to the closest enemy piece
  than it started.
- Yavalanchor: a winning row needs at least one stone of the winner's colour.
- Coffee is played to four in a row, without the optional pie rule.
- Onager: one move may chain at most four jumps.
- Feed the Ducks, Onager and Pentalath are declared drawn if a game runs
  for hundreds of moves without a result.

## Run it

There is no build step. Serve the folder and open it:

```sh
npm run serve   # http://localhost:8080
npm test        # rules and AI tests
```

Pushing to `master` deploys to GitHub Pages through `.github/workflows/pages.yml`
(enable Pages with "GitHub Actions" as the source in the repository settings).
Installing as an app needs HTTPS, which Pages provides.

## Layout

- `js/hex.js`: the 61-cell board: coordinates, neighbours, positions.
- `js/scene.js`: the 3D board. It animates from one view to the next and reports taps; it knows no rules.
- `js/games/<game>.js`: one game: rules, how to draw a position, rules text and lesson steps. The interface every module implements is described at the top of `js/games/util.js`.
- `js/games/index.js`, `js/games/all.js`: the catalogue and the module registry.
- `js/ai/mcts.js`: the computer opponent for every game (tactical check plus Monte Carlo tree search), run in a Web Worker. `js/ai/yavalath-ai.js` is a stronger dedicated engine for Yavalath.
- `js/main.js`: screens, the shared tap-to-move input, the play loop and the lesson runner.
- `js/sound.js`: the synthesised stone-on-wood click.
- `sw.js`: offline cache. Add new files to its list and bump `VERSION`.
- `vendor/three.js`: a trimmed three.js bundle, rebuilt with
  `esbuild tools/three-entry.js --bundle --format=esm --minify --outfile=vendor/three.js`.

## Credits

Games designed by Cameron Browne's LUDI, Néstor Romeral Andrés, Cameron Browne,
Dieter Stein, Stephen Linhart, Víkingur Fjalar Eiríksson, Élanor Grace Rodeffer
and Nick Bentley. Inventors retain the rights to their games.

Fonts: Fraunces and Figtree (SIL Open Font License). 3D rendering: three.js (MIT).
