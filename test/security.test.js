import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePublicUrl, resolvePublicUrl, isPublicAddress } from '../src/security.js';
import { safeFetch } from '../src/fetch.js';

test('blocks local and nonpublic URLs', () => {
  for (const url of ['http://localhost/', 'http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.1/', 'http://example.local/', 'file:///etc/passwd', 'http://user:pass@example.com/', 'http://example.com:8080/']) assert.throws(() => parsePublicUrl(url));
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('::ffff:127.0.0.1'), false);
  assert.equal(isPublicAddress('100.100.100.200'), false);
});
test('rejects mixed DNS results', async () => {
  await assert.rejects(resolvePublicUrl('https://example.com/', async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]), /nonpublic/);
});
test('redirect destination is checked before a second request', async () => {
  let requests = 0;
  await assert.rejects(safeFetch('https://example.com/', { requests: 0, bytes: 0, deadline: Date.now() + 1000 }, {
    resolver: async () => [{ address: '8.8.8.8', family: 4 }],
    transport: async () => { requests++; return { status: 302, headers: { location: 'http://127.0.0.1/secret' }, body: Buffer.alloc(0) }; },
  }), /public website/);
  assert.equal(requests, 1);
});
