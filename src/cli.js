#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { convertUrlToMarkdown } from './converter.js';

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) {
  console.log('Usage: web-to-md <public-url> [--full] [--no-front-matter] [--output file.md]');
  process.exit(args.includes('--help') ? 0 : 2);
}
const url = args[0];
const outputIndex = args.indexOf('--output');
if (outputIndex >= 0 && !args[outputIndex + 1]) {
  console.error('--output requires a filename.');
  process.exit(2);
}
try {
  const result = await convertUrlToMarkdown(url, { mode: args.includes('--full') ? 'full' : 'article', frontMatter: !args.includes('--no-front-matter') });
  if (outputIndex >= 0) await writeFile(args[outputIndex + 1], result.markdown, { flag: 'wx' });
  else process.stdout.write(result.markdown);
} catch (error) {
  console.error(error.status ? error.message : 'Conversion failed.');
  process.exitCode = 1;
}
