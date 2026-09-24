import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';
import { ConversionError } from '../src/security.js';

async function withServer(convert, action) {
  const server = createApp(convert).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
test('API validates input and hides internal errors', async () => {
  await withServer(async () => { throw new Error('secret token'); }, async (base) => {
    const send = (body) => fetch(`${base}/api/convert`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await send({ url: 'http://localhost/' })).status, 400);
    const response = await send({ url: 'https://example.com/' });
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(await response.json()), /secret token/);
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  });
});
test('API returns useful conversion error and handles malformed JSON', async () => {
  await withServer(async () => { throw new ConversionError('The website returned HTTP 404.'); }, async (base) => {
    const response = await fetch(`${base}/api/convert`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com/' }) });
    assert.equal(response.status, 422);
    assert.match((await response.json()).error, /HTTP 404/);
    const malformed = await fetch(`${base}/api/convert`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
  });
});
