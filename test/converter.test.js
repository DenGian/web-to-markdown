import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { convertHtml } from '../src/converter.js';

const html = await readFile(new URL('./fixtures/article.html', import.meta.url), 'utf8');
test('article output has valid escaped YAML, links, image, code and table', () => {
  const result = convertHtml(html, 'https://example.com/article');
  assert.match(result.markdown, /^---\ntitle: "Doc: \\"Quoted\\""/);
  assert.match(result.markdown, /source: "https:\/\/example.com\/article"/);
  assert.match(result.markdown, /author: "A: Writer"/);
  assert.match(result.markdown, /\[guide\]\(https:\/\/example.com\/guide\)/);
  assert.match(result.markdown, /!\[Diagram\]\(https:\/\/example.com\/diagram.png\)/);
  assert.match(result.markdown, /```js\nconst x = 1/);
  assert.match(result.markdown, /\| Name\s+\| Value/);
});
test('full mode and front matter option', () => {
  const result = convertHtml(html, 'https://example.com/', { mode: 'full', frontMatter: false });
  assert.doesNotMatch(result.markdown, /^---/);
  assert.match(result.markdown, /Menu/);
});
test('fallback body and empty page', () => {
  const result = convertHtml('<title>Home</title><body><h1>Links</h1><p><a href="/one">One</a></p></body>', 'https://example.com/');
  assert.match(result.markdown, /Links/);
  assert.throws(() => convertHtml('<body></body>', 'https://example.com/'), /No readable content/);
});
test('YAML escapes controls and quoted author', () => {
  const result = convertHtml('<title>A\nB: "C"</title><meta name="author" content="A &quot;B&quot;"><body><p>Useful text</p></body>', 'https://example.com/');
  assert.match(result.markdown, /title: "A B: \\"C\\""/);
  assert.match(result.markdown, /author: "A \\"B\\""/);
});
