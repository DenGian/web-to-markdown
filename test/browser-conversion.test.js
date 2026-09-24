import test from 'node:test';
import assert from 'node:assert/strict';
import { convertUrlToMarkdown } from '../src/converter.js';

const resolver = async () => [{ address: '8.8.8.8', family: 4 }];
function transport(url) {
  if (url.pathname === '/app.js') return { status: 200, headers: { 'content-type': 'application/javascript' }, body: Buffer.from("setTimeout(() => { document.querySelector('#root').innerHTML = '<h1>Rendered guide</h1><p>This documentation page was rendered by JavaScript and contains useful text for the converter.</p>'; }, 100); setInterval(() => fetch('/ping'), 100);") };
  if (url.pathname === '/ping') return { status: 200, headers: { 'content-type': 'text/plain' }, body: Buffer.from('ok') };
  return { status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from('<!doctype html><html><head><title>Client page</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>') };
}
test('converts JS content despite continuous network activity', async () => {
  const result = await convertUrlToMarkdown('https://example.com/', { mode: 'full' }, { resolver, transport });
  assert.match(result.markdown, /Rendered guide/);
  assert.match(result.markdown, /rendered by JavaScript/);
});
test('reports failed HTTP response before opening browser', async () => {
  await assert.rejects(convertUrlToMarkdown('https://example.com/missing', {}, { resolver, transport: async () => ({ status: 404, headers: { 'content-type': 'text/html' }, body: Buffer.from('missing') }) }), /HTTP 404/);
});
