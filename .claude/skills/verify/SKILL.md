---
name: verify
description: Run the full verification loop for Đảo Đèn Lồng (unit tests, headless proof scenarios, determinism, web screenshot) and refresh docs/proof. Use after changing gameplay, tuning, the headless CLI, or before tagging a phase.
---

# Verify Đảo Đèn Lồng

1. `npm test` — all green. If red, fix code (not tests) unless the requirement changed; then note why in `docs/notes/phase-N-assumptions.md`.
2. `npm run proof` — runs `tests/scenarios/*` through the real `headless_cmd`, writes `docs/proof/phase-N/RESULTS.md` + `runs/*.jsonl`. Must print `N/N passed`.
3. Contract sanity: `game.contract.json.tuning` equals `src/core/tuning.js` (covered by tests).
4. New rule or ticket? Add a scenario file + a check in `scripts/proof.js` that names the requirement.
5. Visual check (only when the renderer changed): `npm start`, then
   `chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=4000 --screenshot=docs/proof/phase-N/web-play.png "http://localhost:5173/?autostart=1&seed=7"`
   and look at the image before claiming it works.
6. Report: which checks ran, pass/fail counts, anything not verified. Never write "done" without the command output.
