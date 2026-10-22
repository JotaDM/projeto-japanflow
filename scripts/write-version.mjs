import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
let version;
try {
  version = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  version = String(Date.now());
}
mkdirSync('dist', { recursive: true });
writeFileSync('dist/version.json', JSON.stringify({ version, builtAt: new Date().toISOString() }));
