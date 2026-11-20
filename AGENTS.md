# AGENTS.md — Đảo Đèn Lồng

3D game (Three.js) + deterministic headless mode graded by **Test Contract v1.3** (Ticket-04, release 1.0.0). Design decisions: `docs/adr/`. Breaking changes: `CHANGELOG.md`. Lab rules: `docs/lab/`. Phase specs + assumptions: `docs/notes/phase-N-*.md` (read the current phase's spec before changing rules).

## Commands
- Install: `npm install` · Play: `npm start` or `node scripts/serve.js` → http://localhost:5173 (`?night=2&autostart=1&seed=7` jumps in)
- Tests: `npm test` (must be green before you stop — a Stop hook enforces it)
- Proof: `npm run proof` → regenerates `docs/proof/phase-4/` (never hand-edit outputs; older phase folders belong to their tags)
- Bench: `node scripts/bench.js --seed 42 --duration 30 --out bench.json` (opens a real Chrome window; `--headless` for a quick try)
- Soak: `node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json` · Leaderboard export: `node scripts/serve.js --export-leaderboard out.json`
- Release bundle: `node scripts/package.js` → `dist/*.zip`
- Browser check: `npm run webcheck` (starts its own server + throw-away leaderboard) → screenshots, 21 flow checks, FPS into `docs/proof/phase-4/` (`FLOW_ONLY=1` skips FPS/screens)
- Headless: `node src/headless.js --seed 1 --night <1|2|3> --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`

## Layout
- `src/core/sim.js` — ALL rules. Pure: no DOM, no `Math.random`, no `Date`. `step()` follows the 12-step tick order of Ticket-02; keep that order.
- `src/core/maps.js` — standard maps (surface(x,z) height function, lanterns, spawn points, pads, charms).
- `src/core/bench.js` (standard bench scene, camera path, frame stats) · `src/core/leaderboard.js` (name rules, ordering, top 10).
- `src/core/tuning.js` — standard numbers. `game.contract.json.tuning` must equal `TUNING` (test enforces).
- `src/runner.js` + `src/headless.js` — CLI; exit 2 for malformed inputs/scenario.
- `web/` — `main.js` (screens, input, HUD), `world.js` (Three.js scene, palette `C`), `audio.js`. Presentation only.
- `tests/*.test.js` (node:test; `helpers.js` has `quiet()`/`runFor()`), `tests/scenarios/*.json` (proof fixtures).

## Rules
- Tick model: step k reads input of tick k → state k+1; events carry the contract tick. Paused ticks advance `tick`, not `sim_tick`.
- Timers count down in step 2, so "N ticks" means the effect ends exactly N ticks later — write tests that count it.
- Distances on XZ unless the ticket says 3D (pulse). "Within r" is `<=`.
- Shade states are exactly: spawning, wander, chase, recoil, stunned, drain.
- Lantern fuel is an integer count of 1/60 units (`L.fu`); round only on output. Safe zone = `hasZone()` (lit && fuel >= 30), never read `lit` directly for zones.
- No early win: the night ends at dawn (`dawn_survived` / `dawn`) or on `no_flames` (checked first).
- Changing a rule → update tests + `docs/notes/phase-N-spec.md` (assumption A# or regression row) in the same change.
- If a test fails, first check the test's own tick arithmetic (most Phase 2 failures were there), then the code. Never weaken an assertion to pass.
- A rule REPLACED by a ticket: rewrite/delete the old test with a `P<N>:` comment + a row in the phase spec's Regression table and CHANGELOG. Never `skip`.
- After green tests on a new rule, mutate the rule once and confirm a test goes red (if no test can tell, explain why it is an equivalent mutant).
- `new Game({ bench: true })` is only for the bench scene; never let it change headless output.
- Write multi-line patches with the Write tool (or a script file), not bash heredocs — quoting broke 4 times.
- No secrets / `.env` in the repo.
