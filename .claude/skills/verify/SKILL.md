---
name: verify
description: Run the full verification loop for Đảo Đèn Lồng (unit/CLI tests, headless proof scenarios, determinism, mutation spot-check, real-browser flow + FPS, bench + soak) and refresh docs/proof. Use after changing gameplay, tuning, maps, the headless CLI or the web UI, and before tagging a phase.
---

# Verify Đảo Đèn Lồng

1. `npm test` — all green. Red? Check the test's tick arithmetic first (timers decrement at step 2), then the code. Requirement changed → record it in `docs/notes/phase-N-spec.md` (Regression table).
2. `npm run proof` — runs `tests/scenarios/*` through the real `headless_cmd`; must print `N/N passed`. New feature → add a scenario file + a `check()` naming the requirement.
3. Mutation spot-check for each new rule: break it (one-line change), run `npm test`, confirm red, restore. Note survivors in `docs/notes/ai-log.md` and add the missing test.
4. Web (only when `web/` or maps changed): `npm run webcheck` (it starts its own server). It must exit 0: no console errors, all flow steps PASS, avg FPS ≥ 30 at 1280×720. Open the PNGs it wrote and look at them before claiming the visuals work.
5. Release-level changes: `node scripts/bench.js --seed 42 --duration 30 --out docs/proof/phase-N/bench.json` (avg >= 60, 1% low >= 30, load <= 10000) and `node --expose-gc scripts/soak.js --seed 7 --nights 10 --out docs/proof/phase-N/soak.json` (0 crashes, mem ratio <= 1.2).
6. Update `docs/proof/phase-N/README.md` with the numbers you just saw (tests, proof, FPS, what was NOT verified).
7. Report: commands run, pass/fail counts, anything unverified. Never write "done" without the output.
