import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = join(process.cwd(), 'src');
let warnings = 0;
function walk(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    const source = readFileSync(path, 'utf8');
    if (
      /onSnapshot\(\s*collection\(db,\s*['"]tasks['"]\)/.test(source) &&
      !path.endsWith('useFirebaseTasks.ts')
    ) {
      console.log('REVISAR listener alternativo:', relative(root, path));
      warnings++;
    }
    const creations = [
      ...source.matchAll(/addDoc\(\s*collection\(db,\s*['"]tasks['"]\)\s*,\s*\{/g),
    ];
    for (const m of creations) {
      if (!source.slice(m.index, m.index + 140).includes('board_visible: true')) {
        console.log('REVISAR criador:', relative(root, path));
        warnings++;
      }
    }
  }
}
walk(root);
console.log(`Auditoria de caminhos de escrita: ${warnings} alerta(s).`);
if (warnings) process.exitCode = 2;
