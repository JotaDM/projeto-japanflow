import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
for (const kind of ['tracking', 'reverse', 'warranties']) {
  test(`valida modelo CSV ${kind} sem gravar`, () => {
    const run = spawnSync(
      process.execPath,
      ['scripts/audit-departmental-import.mjs', `docs/migracao-1.6/${kind}.csv`, kind],
      { encoding: 'utf8' }
    );
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const result = JSON.parse(run.stdout);
    assert.equal(result.readonly, true);
    assert.equal(result.lines, 0);
  });
}
