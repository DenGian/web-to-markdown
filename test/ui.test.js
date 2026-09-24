import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createApp } from '../src/server.js';

test('clear, options, editing, preview and save controls', async () => {
  const server = createApp(async (_url, options) => ({ title: 'Example title', url: 'https://example.com/', markdown: options.frontMatter ? '---\ntitle: "Example"\n---\n\n# Hello' : '# Hello' })).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ acceptDownloads: true });
    await page.addInitScript(() => { window.showSaveFilePicker = undefined; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value) => { window.__copied = value; } } }); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await page.locator('#output-card').isVisible(), false);
    assert.equal(await page.locator('#clear-btn').isVisible(), false);
    await page.locator('#url-input').fill('https://example.com/');
    assert.equal(await page.locator('#clear-btn').isVisible(), true);
    await page.locator('#convert-btn').click();
    await page.locator('#output-card').waitFor({ state: 'visible' });
    await page.locator('#markdown-output').fill('# Edited\n<script>alert(1)</script>');
    await page.locator('#tab-preview').click();
    assert.equal(await page.locator('#panel-source').isVisible(), false);
    assert.equal(await page.locator('#panel-preview').isVisible(), true);
    assert.equal(await page.locator('#markdown-preview script').count(), 0);
    assert.match(await page.locator('#markdown-preview').innerText(), /Edited/);
    await page.locator('#tab-preview').press('ArrowLeft');
    assert.equal(await page.locator('#panel-source').isVisible(), true);
    await page.locator('#copy-btn').click();
    assert.equal(await page.evaluate(() => window.__copied), '# Edited\n<script>alert(1)</script>');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-btn').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'example-title.md');
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
