# Yavalath & Co.

A single-player web app for the fifteen games in the book *Yavalath & Co.* by
Néstor Romeral Andrés: a 3D board, a computer opponent, and an interactive
lesson for each game. It installs to a phone's home screen and plays offline.

## Status

| Game | Play vs computer | Lesson |
|---|---|---|
| Yavalath | yes | yes |
| The other fourteen | not yet | not yet |

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
- `js/scene.js`: the 3D board. It draws stones and effects and reports taps; it knows no rules.
- `js/games/<game>.js`: rules for one game, as pure functions shared by the UI and the AI.
- `js/games/<game>-tutorial.js`: that game's rules text and lesson steps.
- `js/ai/`: the computer opponent, run in a Web Worker.
- `js/main.js`: screens, the play loop and the lesson runner.
- `sw.js`: offline cache. Add new files to its list and bump `VERSION`.
- `vendor/three.js`: a trimmed three.js bundle, rebuilt with
  `esbuild tools/three-entry.js --bundle --format=esm --minify --outfile=vendor/three.js`.

## Credits

Games designed by Cameron Browne's LUDI, Néstor Romeral Andrés, Cameron Browne,
Dieter Stein, Stephen Linhart, Víkingur Fjalar Eiríksson, Élanor Grace Rodeffer
and Nick Bentley. Inventors retain the rights to their games.

Fonts: Fraunces and Figtree (SIL Open Font License). 3D rendering: three.js (MIT).
