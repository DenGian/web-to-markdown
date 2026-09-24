import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPreview } from '../public/preview.js';

test('preview escapes HTML and unsafe links while rendering safe links', () => {
  const html = renderPreview('# Title\n<script>alert(1)</script>\n[Safe](https://example.com/)\n[Bad](javascript:alert(1))');
  assert.match(html, /<h1>Title<\/h1>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /href="https:\/\/example.com\/"/);
  assert.doesNotMatch(html, /href="javascript:/);
});
