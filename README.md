# Flappy Lab

A playable browser game and a standalone deterministic environment for the next ML phase. No dependencies or build step.

Run `npm start` in this folder, then open http://127.0.0.1:4173. Run `npm test` to validate the simulation.

## Controls

Space / Arrow Up / W, click, or tap: flap. P: pause/resume. R: restart. Classic and Gentle skies have separate personal bests saved on the device. Enable the state inspector to show normalized observations, the collision circle, and the next target gap. Runs pause when the page loses focus.

## Trained agent and replay gallery

The game now opens on the Learning Journey. Press **Watch the journey** to replay policies after 0, 2,000, 10,000, 25,000, and 50,000 training episodes. All ten checkpoints are available in the selector. Choose any of 100 test courses; each checkpoint faces the same pipe sequence on that course. Playback is live policy inference, with pause, restart, and 1–8× speed. Human play is available through **Fly yourself**.

The agent uses tabular Q-learning, not a neural network or a scripted flight controller. It learns action values for discretized bird-to-gap offset, vertical velocity, and distance to the next pipe. The decision interval is three physics frames; a flap action applies once at the start of that interval. Training uses the existing game rewards, Classic physics, and randomly sampled course seeds from 1 through 1,000,000. It receives structured state, not pixels.

`npm run train` reproducibly trains 50,000 episodes and exports `dist/models/training.json` plus the complete per-episode log in `training/history.csv`. Hyperparameters, seed, engine SHA-256, Q tables, validation curve, evaluation seeds, full test results, and recorded sample action traces are included in the model file. Runs are capped at 30 pipes or 6,000 frames; a cap is a truncation, not a collision. The exported final policy is the actual episode-50,000 policy, not the best checkpoint selected by evaluation score.

Training progress was monitored on 30 fixed validation courses. After training, each exported checkpoint was evaluated without exploration on another 100 fixed test courses, disjoint from training and validation. Results below are means over those 100 test courses, capped at 30 pipes:

| Training games | Mean pipes | Runs reaching 30 pipes |
| --- | --- | --- |
| 0 | 0.00 | 0/100 |
| 2,000 | 0.01 | 0/100 |
| 10,000 | 4.58 | 1/100 |
| 25,000 | 9.97 | 12/100 |
| 50,000 | 28.41 | 91/100 |

Learning is not monotonic; the full unsmoothed validation curve preserves regressions. This is one reproducible training run, not an estimate across independent training seeds. The score cap limits what can be inferred about endurance beyond 30 pipes.

`npm test` verifies the physics, engine/model compatibility, every recorded action trace, every exported checkpoint's 100 test-course scores, and parity between browser-style per-frame inference and headless evaluation.

## Agent interface

Import `FlappyEnv` from `dist/engine.js` in Node or a browser. The engine has no renderer, timer, DOM, storage, or audio dependencies. One step is exactly 1/60 second; training can step as fast as the processor allows.

```js
import { FlappyEnv } from './dist/engine.js';
const env = new FlappyEnv({ seed: 42, difficulty: 'classic' });
let observation = env.reset(42);
const transition = env.step(1); // 0 = coast, 1 = flap
// { observation, reward, terminated, info }
```

Observations are `{birdY, velocity, pipeDistance, gapTop, gapBottom}`. Height and gaps are divided by ground height, velocity by 10, and distance by world width. The coordinate system increases downward. Rewards: +0.01 for a surviving frame, +1 per passed pipe, -1 on collision. A terminal step returns zero reward and preserves the state until reset. `info` includes score, ticks, seconds, flap count, and seed.

`window.flappyLab.createEnv(options)` creates independent environments in the browser. `getState()` reads the active game, pilot mode, and selected agent checkpoint; `pause()` pauses playback. Import `policyAction` from `dist/agent.js` to run a saved Q table on an environment. Apply the selected action every three frames and coast on the other two frames.

Files: `dist/engine.js` (physics), `dist/agent.js` (policy inference), `training/train.mjs` (learning), `dist/lab.js` (checkpoint gallery), `dist/app.js` (renderer and controls), and `tests/` (physics and policy verification). All artwork is drawn locally with Canvas; font loading has system fallbacks.
