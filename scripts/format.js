import { readdir, readFile, writeFile } from 'node:fs/promises';
const dirs = ['src', 'public', 'test', 'scripts'];
const check = process.argv.includes('--check');
let changed = false;
for (const dir of dirs) {
  for (const name of await readdir(dir)) {
    if (!/\.(js|css|html)$/.test(name)) continue;
    const file = `${dir}/${name}`;
    const original = await readFile(file, 'utf8');
    const formatted = original.replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, '').replace(/\n*$/, '\n');
    if (original !== formatted) {
      changed = true;
      if (check) console.error(`${file} needs formatting`);
      else await writeFile(file, formatted);
    }
  }
}
if (check && changed) process.exitCode = 1;
