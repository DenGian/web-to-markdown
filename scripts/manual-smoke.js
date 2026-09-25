import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createApp } from "../src/server.js";
import { analyzeMarkdown } from "../public/document.js";

const server = createApp().listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator("#url-input").fill("https://brew.sh/");
  await page.locator("#convert-btn").click();
  assert.match(await page.locator("#status-message").innerText(), /Fetching/);
  await page
    .locator("#output-card")
    .waitFor({ state: "visible", timeout: 40000 });
  assert.match(
    await page.locator("#markdown-output").inputValue(),
    /Homebrew|brew/i,
  );
  const markdown = await page.locator("#markdown-output").inputValue();
  const parsed = analyzeMarkdown(markdown);
  assert.ok(parsed.headingCount > 1);
  assert.equal(
    await page.locator("#outline-items .outline-entry").count(),
    parsed.headingCount,
  );
  console.log("brew.sh UI:", await page.locator("#result-details").innerText());
  console.log(
    "Outline:",
    parsed.headings.map((heading) => heading.text).join(" | "),
  );
  await page.locator("#tab-preview").click();
  assert.equal(
    await page
      .locator(
        "#markdown-preview h1, #markdown-preview h2, #markdown-preview h3, #markdown-preview h4, #markdown-preview h5, #markdown-preview h6",
      )
      .count(),
    parsed.headingCount,
  );
  await page.locator("#tab-split").click();
  assert.equal(await page.locator(".tabs .tab-active").count(), 1);
  assert.equal(
    await page.locator("#tab-split").getAttribute("aria-selected"),
    "true",
  );
  assert.equal(await page.locator("#panel-preview").isVisible(), true);
  assert.equal(
    await page
      .locator("#split-view")
      .evaluate((element) => getComputedStyle(element).display),
    "grid",
  );
  const boxes = await Promise.all(
    ["#panel-source", "#panel-preview"].map((selector) =>
      page.locator(selector).boundingBox(),
    ),
  );
  assert.ok(boxes[0].x + boxes[0].width <= boxes[1].x + 1);
  const sourceBox = await page.locator("#markdown-output").boundingBox();
  const headingBox = await page.locator("#markdown-preview h1").boundingBox();
  assert.ok(sourceBox.x + sourceBox.width <= boxes[1].x + 1);
  assert.ok(headingBox.x >= boxes[1].x);
  assert.ok(headingBox.y < sourceBox.y + sourceBox.height);
  await page.waitForTimeout(250);
  await page.screenshot({ path: "docs/screenshot.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#tab-preview").click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: "docs/screenshot-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: "/private/tmp/website-to-md-dark.png",
    fullPage: true,
  });
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
