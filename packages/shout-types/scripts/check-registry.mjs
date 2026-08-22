#!/usr/bin/env node
// docs/10-TESTING.md registry-conformance gate:
// "Static check: zero occurrences of `type === '` inside packages/match
// and packages/money" — the architecture, enforced by a test, not just
// stated. A single `if (type === ...)` in either package is a failed
// code review (docs/04-SHOUT-TYPES.md).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '../../../..');
const targets = ['packages/match/src', 'packages/money/src'];
const forbidden = "type === '";

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

let violations = [];

for (const target of targets) {
  const dir = join(repoRoot, target);
  let files;
  try {
    files = walk(dir);
  } catch {
    continue; // target doesn't exist yet
  }
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes(forbidden)) {
        violations.push(`${file.replace(repoRoot + '/', '')}:${i + 1}: ${line.trim()}`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error('Registry conformance FAILED — type branching found where config should decide:');
  violations.forEach((v) => console.error(`  ${v}`));
  process.exit(1);
}

console.log('Registry conformance OK — zero type branches in packages/match, packages/money.');
