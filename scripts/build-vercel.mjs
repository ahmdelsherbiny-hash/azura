import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(projectRoot, 'dist');

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory);

cpSync(resolve(projectRoot, 'index.html'), resolve(outputDirectory, 'index.html'));
for (const folder of ['css', 'js', 'images']) {
  cpSync(resolve(projectRoot, 'assets', folder), resolve(outputDirectory, 'assets', folder), {
    recursive: true,
  });
}
