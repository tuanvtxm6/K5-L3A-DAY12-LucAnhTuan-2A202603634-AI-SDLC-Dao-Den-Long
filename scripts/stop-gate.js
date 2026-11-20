// Claude Code Stop hook: block the agent from finishing while tests are red.
// Exit 2 = block (stderr is fed back to the agent). If it was already blocked once, allow stop but warn (no loop).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* no/invalid stdin */ }

const r = spawnSync(process.execPath, ['--test', 'tests/*.test.js'], { encoding: 'utf8' });
if (r.status === 0) process.exit(0);

const fails = `${r.stdout}\n${r.stderr}`.split('\n')
  .filter((l) => /✖|not ok|AssertionError|Error:/.test(l)).slice(0, 15).join('\n');
if (input.stop_hook_active) {
  process.stderr.write(`Tests still failing (stop allowed to avoid a loop):\n${fails}\n`);
  process.exit(0);
}
process.stderr.write(`npm test is red — fix it before finishing:\n${fails}\n`);
process.exit(2);
