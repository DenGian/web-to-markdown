import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const dirs = ['src', 'public', 'test', 'scripts'];
for (const dir of dirs) {
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.js')) continue;
    const file = `${dir}/${name}`;
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (result.status !== 0) process.exitCode = 1;
  }
}
