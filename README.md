# The Estimator: The Game

A 3D browser game based on the amateur film *The Estimator*. You play Mark Markson, a once-great estimator who has lost
his gift. Guess distances, counts, seconds and angles to win it back, train with Bill, and take on Lester Lesterson at
the Underground's competition.

Six levels: Rock Bottom, Training Day, The Playground, then the three rounds of the competition (Questions, Physical,
Freestyle) and the ending.

## Play

Open the published page in a desktop browser, or on a phone held sideways. Drag the picture to look around; scroll or
pinch to zoom. The ☰ button opens the menu: restart a level, pick a level, start over, and settings for music,
difficulty, cutscenes and graphics. Progress and settings are kept in your browser.

## Run it locally

    python3 tools/serve.py        # then open http://localhost:8765

There is no build step. The game is plain JavaScript modules in `game/`, with three.js vendored in `game/vendor/`.

## What is where

- `game/` is the whole game: one page per level, `engine.js` (shared by Levels 2 to 6), `shell.js` (menu, settings,
  screen layout), `scoring.js`, `music.js` (the music is generated in the browser; there is no audio file).
- `blender/props.py` builds the sets (`game/assets/*.glb`) with Blender, headless.
- `tools/skins.py` paints the character outfits; `tools/shot.sh` takes test screenshots.
- `.github/workflows/pages.yml` publishes `game/` to GitHub Pages on every push to `main`.

## Credits

- Characters are built on Kenney's "Animated Characters" models (CC0), from kenney.nl.
- 3D rendering by three.js (MIT licence).
- Story, characters and dialogue are from the film *The Estimator*.
