# Flappy Lab

A playable browser game and a standalone deterministic environment for the next ML phase. No dependencies or build step.

Run `npm start` in this folder, then open http://127.0.0.1:4173. Run `npm test` to validate the simulation.

## Controls

Space / Arrow Up / W, click, or tap: flap. P: pause/resume. R: restart. Classic and Gentle skies have separate personal bests saved on the device. Enable the state inspector to show normalized observations, the collision circle, and the next target gap. Runs pause when the page loses focus.

## Agent interface (ML implementation comes next)

Import `FlappyEnv` from `dist/engine.js` in Node or a browser. The engine has no renderer, timer, DOM, storage, or audio dependencies. One step is exactly 1/60 second; training can step as fast as the processor allows.

```js
import { FlappyEnv } from './dist/engine.js';
const env = new FlappyEnv({ seed: 42, difficulty: 'classic' });
let observation = env.reset(42);
const transition = env.step(1); // 0 = coast, 1 = flap
// { observation, reward, terminated, info }
```

Observations are `{birdY, velocity, pipeDistance, gapTop, gapBottom}`. Height and gaps are divided by ground height, velocity by 10, and distance by world width. The coordinate system increases downward. Rewards: +0.01 for a surviving frame, +1 per passed pipe, -1 on collision. A terminal step returns zero reward and preserves the state until reset. `info` includes score, ticks, seconds, flap count, and seed.

`window.flappyLab.createEnv(options)` creates independent environments in the browser. `getState()` reads the active human game, and `pause()` pauses it. Training does not yet exist. Planned next step: choose and train an agent using seeded training/evaluation episodes, then connect its actions to a visible agent mode.

Files: `dist/engine.js` (physics), `dist/app.js` (renderer and human controls), `dist/style.css` (layout), `tests/engine.test.mjs` (simulation tests). All artwork is drawn locally with Canvas; font loading has system fallbacks.
