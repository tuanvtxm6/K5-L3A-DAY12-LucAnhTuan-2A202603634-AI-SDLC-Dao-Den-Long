# AGENTS.md — Đảo Đèn Lồng

3D game (Three.js) + deterministic headless mode graded by **Test Contract v1.0** (`docs/lab/` = lab rules; phase requirements live on the lab board, copied into `docs/notes/phase-N-*.md`).

## Commands
- Install: `npm install` · Play: `npm start` → http://localhost:5173
- Tests: `npm test` (must be green before you stop — a Stop hook enforces it)
- Proof: `npm run proof` → regenerates `docs/proof/phase-1/` (never hand-edit outputs)
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`

## Layout
- `src/core/sim.js` — ALL gameplay rules. Pure: no DOM, no `Math.random`, no `Date`. Seeded RNG only (`rng.js`).
- `src/core/tuning.js` — every gameplay number. `game.contract.json.tuning` must equal it (test enforces).
- `src/runner.js` + `src/headless.js` — CLI; exit 2 for malformed inputs/scenario files.
- `web/main.js` — renderer/input only. Never put rules here; extras (sound, FX) stay here so headless output is unaffected.
- `tests/*.test.js` (node:test), `tests/scenarios/*.json` (used by proof).

## Rules
- Contract tick model: step k reads input of tick k, produces state k+1; events carry tick k+1. Distances on XZ, "within r" is `<=`.
- Changing a rule → update test + `docs/notes/phase-N-assumptions.md` in the same change.
- Changing tuning → change `tuning.js` AND `game.contract.json` together.
- New ambiguity → write an assumption (A#) instead of guessing silently.
- Don't weaken a test to make it pass; fix the code or record why the requirement changed.
- No secrets / `.env` in the repo.
