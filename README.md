# Flappy Lab

A playable browser game, seeded simulation, trained Q-learning policies, progressively harder challenges, and Human vs AI races. No dependencies or build step.

Run `npm start` in this folder, then open http://127.0.0.1:4173. Run `npm test` to validate the simulation.

## Controls

Space / Arrow Up / W, click, or tap: flap. P: pause/resume. R: restart. Classic and Gentle skies have separate personal bests saved on the device. Enable the state inspector to show normalized observations, the collision circle, and the next target gap. Runs pause when the page loses focus.

## Challenges, adaptation, and racing

The game opens on **Harder challenges**. Choose Rising pressure, Drifting gates, or Endurance climb; select an original Classic policy, a weaker practice policy, or a challenge-trained policy. Replay the same seed to compare them. The challenge and Human vs AI defaults use the checkpoint with the best average validation survival across all three challenges: currently **50,000 extra training games**. Checkpoints through 80,000 extra games remain selectable in both modes. The summary compares the original Classic policy with this validation-selected default; manual checkpoint selection changes the live replay.

- **Rising pressure:** speed = `2.7 + 0.0225 × seconds` px/frame; gap = `max(82, 157 − 0.75 × seconds)` px.
- **Drifting gates:** speed = `2.8 + 0.022 × seconds`; gap = `max(82, 148 − 0.65 × seconds)`; openings oscillate with amplitude increasing from 8 to 24 px.
- **Endurance climb:** speed = `2.7 + 0.03 × seconds`; gap = `max(72, 157 − 0.85 × seconds)`; moving-gap amplitude grows after 20 seconds, up to 24 px.

All schedules depend on the shared elapsed time, not score or actions. Speed continues rising after the gap reaches its minimum. The course changes every physics step; pipes are regenerated from the seeded random stream. Challenges have no pipe-score cap. A 180-second safety cutoff is recorded separately from collisions; none of the exported evaluation runs reached it. The old Classic learning gallery retains its explicitly labeled 30-pipe evaluation cap.

**Human vs AI** puts your gold bird and the blue AI bird in the same arena. Both have separate collision states but identical physics, seeded pipes, gap motion, and time-based difficulty. The race runs at real-time 1× speed. Space / Up / click / tap controls only the human bird. The first collision ends the race; the survivor wins, simultaneous collisions draw, and a shared 180-second safety timeout is a draw. P pauses both birds and the course clock. R restarts the same seed and opponent. Human wins, AI wins, and draws are supported independently of pipe-score ties.

Solo play also offers all three challenge courses through the Flight Conditions selector, with separate personal bests for each.

### Measured adaptation

The Classic 50,000-episode Q table was copied into contextual state bins, then fine-tuned for another 80,000 episodes across all three challenge types. The adaptive table also distinguishes four speed ranges and three gap-size ranges, and uses bird velocity relative to gate motion. This comparison therefore measures the combined change in representation and additional training, not an isolated effect of training budget. Weights are frozen during evaluation and gameplay; replaying a run does not perform online learning.

Training seeds are 1–1,000,000. Curriculum starts include 0–60 seconds of difficulty offset, progressively introduced during the first 40,000 episodes, so later conditions receive training exposure. Validation uses 20 disjoint seeds per challenge and no exploration. Checkpoint selection maximizes mean survival seconds with equal weight for Rising pressure, Drifting gates, and Endurance climb; ties keep the earlier checkpoint. Test scores and training duration do not enter selection. The selected 50k checkpoint averages **45.4472s** on validation, versus **44.5775s** for the final 80k checkpoint. The original 100 held-out test courses per challenge are re-evaluated for the selected policy to keep the displayed comparison consistent. This is one seeded adaptation run, not a confidence estimate over independent training runs. Some individual courses and intermediate checkpoints regress.

| Challenge | Classic mean survival | Adapted mean survival | Classic mean pipes | Adapted mean pipes |
| --- | ---: | ---: | ---: | ---: |
| Rising pressure | 32.90s | 47.96s | 24.35 | 38.56 |
| Drifting gates | 24.54s | 40.68s | 17.72 | 32.71 |
| Endurance climb | 30.27s | 40.52s | 22.89 | 33.24 |

Run `npm run train:challenges` to reproduce adaptation, the unsmoothed validation curve, and the report in `dist/models/challenges.json`. Future training saves every new validation-best policy in addition to scheduled checkpoints, preserving a strong policy when later updates regress. `node training/select-checkpoint.mjs` selects and evaluates the strongest existing snapshot without retraining. The current five snapshots remain intact. `selection` records the rule and winning checkpoint; `selectedResults` contains its test runs. The historical final-checkpoint results remain in `results`, identified by `resultsCheckpointId`. Every adaptation episode is logged in `training/adaptation-history.csv`. The artifact records training and runtime source hashes; the race first-collision rule was completed after training without changing challenge physics or inference. All original and selected-policy evaluation results are reproduced by the tests.

## Original Classic learning gallery

Open the **Learning journey** tab and press **Watch the journey** to replay policies after 0, 2,000, 10,000, 25,000, and 50,000 training episodes. All ten checkpoints are available in the selector. Choose any of 100 test courses; each checkpoint faces the same pipe sequence on that course. Playback is live policy inference, with pause, restart, and 1–8× speed. Human play is available through **Fly yourself**.

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

Files: `dist/engine.js` (unchanged Classic physics), `dist/challenge-engine.js` (difficulty schedules, adaptive inference, paired races), `dist/main.js` (controls and mode orchestration), `dist/renderer.js` (shared artwork and race birds), `dist/challenge-ui.js` (adaptation results and race setup), `dist/agent.js` (original policy inference), `training/` (learning and logs), and `tests/` (physics, policy reproduction, progression, and race fairness). All artwork is drawn locally with Canvas; font loading has system fallbacks.
