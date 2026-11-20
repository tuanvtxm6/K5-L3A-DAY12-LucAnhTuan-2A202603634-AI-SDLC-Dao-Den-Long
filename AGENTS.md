# AGENTS.md — Đảo Đèn Lồng

3D game (Three.js) + deterministic headless mode graded by **Test Contract v1.1** (Ticket-02). Lab rules: `docs/lab/`. Phase specs + assumptions: `docs/notes/phase-N-*.md` (read the current phase's spec before changing rules).

## Commands
- Install: `npm install` · Play: `npm start` → http://localhost:5173 (`?night=2&autostart=1&seed=7` jumps in)
- Tests: `npm test` (must be green before you stop — a Stop hook enforces it)
- Proof: `npm run proof` → regenerates `docs/proof/phase-2/` (never hand-edit outputs)
- Browser check (server running): `npm run webcheck` → screenshots, flow checks, FPS into `docs/proof/phase-2/`
- Headless: `node src/headless.js --seed 1 --night <1|2|3> --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`

## Layout
- `src/core/sim.js` — ALL rules. Pure: no DOM, no `Math.random`, no `Date`. `step()` follows the 12-step tick order of Ticket-02; keep that order.
- `src/core/maps.js` — standard maps (surface(x,z) height function, lanterns, spawn points, pads, charms).
- `src/core/tuning.js` — standard numbers. `game.contract.json.tuning` must equal `TUNING` (test enforces).
- `src/runner.js` + `src/headless.js` — CLI; exit 2 for malformed inputs/scenario.
- `web/` — `main.js` (screens, input, HUD), `world.js` (Three.js scene, palette `C`), `audio.js`. Presentation only.
- `tests/*.test.js` (node:test; `helpers.js` has `quiet()`/`runFor()`), `tests/scenarios/*.json` (proof fixtures).

## Rules
- Tick model: step k reads input of tick k → state k+1; events carry the contract tick. Paused ticks advance `tick`, not `sim_tick`.
- Timers count down in step 2, so "N ticks" means the effect ends exactly N ticks later — write tests that count it.
- Distances on XZ unless the ticket says 3D (pulse). "Within r" is `<=`.
- Shade states are exactly: spawning, wander, chase, recoil, stunned.
- Changing a rule → update tests + `docs/notes/phase-N-spec.md` (assumption A# or regression row) in the same change.
- If a test fails, first check the test's own tick arithmetic (most Phase 2 failures were there), then the code. Never weaken an assertion to pass.
- After green tests on a new rule, mutate the rule once and confirm a test goes red.
- No secrets / `.env` in the repo.
