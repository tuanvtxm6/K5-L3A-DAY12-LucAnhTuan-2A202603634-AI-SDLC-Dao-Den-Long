#!/usr/bin/env node
// Headless entry point (Test Contract v1.0). Exit 0 ok, 2 malformed inputs/scenario, 1 other errors.
import { writeFileSync } from 'node:fs';
import { parseArgs, run } from './runner.js';
import { ValidationError } from './core/validate.js';

try {
  const opts = parseArgs(process.argv.slice(2));
  writeFileSync(opts.out, run(opts));
  process.exit(0);
} catch (e) {
  process.stderr.write(`headless: ${e.message}\n`);
  process.exit(e instanceof ValidationError ? 2 : 1);
}
