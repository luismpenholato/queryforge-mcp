import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const target = join(process.cwd(), 'dist', 'index.js');
const shebang = '#!/usr/bin/env node\n';
const content = readFileSync(target, 'utf8');

if (!content.startsWith(shebang)) {
  writeFileSync(target, `${shebang}${content}`);
}
