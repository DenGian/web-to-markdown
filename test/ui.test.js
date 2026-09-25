import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createApp } from "../src/server.js";

test("clear, options, editing, preview and save controls", async () => {
  const server = createApp(async (_url, options) => ({
    title: "Example title",
    url: "https://example.com/",
    extractionMode: "body",
    wordCount: 8,
    headingCount: 1,
    warnings: ["Article extraction found no article; used the page body."],
    markdown: options.frontMatter
      ? '---\ntitle: "Example"\n---\n\n# Hello'
      : "# Hello",
  })).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ acceptDownloads: true });
    await page.addInitScript(() => {
      window.showSaveFilePicker = undefined;
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (value) => {
            window.__copied = value;
          },
        },
      });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await page.locator("#output-card").isVisible(), false);
    assert.equal(await page.locator("#clear-btn").isVisible(), false);
    await page.locator("#url-input").fill("https://example.com/");
    assert.equal(await page.locator("#clear-btn").isVisible(), true);
    await page.locator("#convert-btn").click();
    await page.locator("#output-card").waitFor({ state: "visible" });
    assert.match(
      await page.locator("#result-details").innerText(),
      /Body fallback.*1 words.*1 headings/,
    );
    assert.match(
      await page.locator("#result-warning").innerText(),
      /page body/,
    );
    await page.locator("#outline-items button").first().click();
    assert.equal(
      await page
        .locator("#markdown-output")
        .evaluate((element) =>
          element.value.slice(element.selectionStart, element.selectionEnd),
        ),
      "# Hello",
    );
    await page
      .locator("#markdown-output")
      .fill("# Edited\n<script>alert(1)</script>");
    await page.locator("#tab-preview").click();
    assert.equal(await page.locator("#panel-source").isVisible(), false);
    assert.equal(await page.locator("#panel-preview").isVisible(), true);
    assert.equal(await page.locator("#markdown-preview script").count(), 0);
    assert.match(await page.locator("#markdown-preview").innerText(), /Edited/);
    await page.locator("#tab-preview").press("ArrowLeft");
    assert.equal(await page.locator("#panel-source").isVisible(), true);
    await page.locator("#copy-btn").click();
    assert.equal(
      await page.evaluate(() => window.__copied),
      "# Edited\n<script>alert(1)</script>",
    );
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#download-btn").click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "example-title.md");
    await page
      .locator("#markdown-output")
      .fill(
        "# Root\n\n- item\n  ## Nested\n  text\n\n~~~\n# fake\n~~~\n\n## Next\nend",
      );
    assert.match(
      await page.locator("#result-details").innerText(),
      /3 headings/,
    );
    assert.equal(
      await page.locator("#outline-items .outline-entry").count(),
      3,
    );
    await page.locator("#tab-split").click();
    assert.equal(await page.locator("#panel-source").isVisible(), true);
    assert.equal(await page.locator("#panel-preview").isVisible(), true);
    await page.locator("#outline-items .outline-copy").nth(1).click();
    assert.equal(
      await page.evaluate(() => window.__copied),
      "## Nested\ntext\n\n~~~\n# fake\n~~~",
    );
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator("#open-btn").click();
    assert.equal(
      await page.locator("#markdown-output").inputValue(),
      "# Root\n\n- item\n  ## Nested\n  text\n\n~~~\n# fake\n~~~\n\n## Next\nend",
    );
    const opened = {
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Local\nwords"),
    };
    await page.locator("#open-file").setInputFiles(opened);
    await page.waitForFunction(
      () =>
        document.querySelector("#markdown-output").value === "# Local\nwords",
    );
    assert.equal(
      await page.locator("#markdown-output").inputValue(),
      "# Local\nwords",
    );
    assert.match(
      await page.locator("#result-details").innerText(),
      /Local file.*1 headings/,
    );
    await page.locator("#open-file").setInputFiles({
      name: "empty.md",
      mimeType: "text/markdown",
      buffer: Buffer.alloc(0),
    });
    assert.match(await page.locator("#status-message").innerText(), /empty/);
    await page.locator("#open-file").setInputFiles({
      name: "bad.md",
      mimeType: "text/markdown",
      buffer: Buffer.from([0xff]),
    });
    assert.match(await page.locator("#status-message").innerText(), /UTF-8/);
    await page.locator("#open-file").setInputFiles({
      name: "big.md",
      mimeType: "text/markdown",
      buffer: Buffer.alloc(2_000_001, 65),
    });
    assert.match(await page.locator("#status-message").innerText(), /2 MB/);
    await page.locator("#markdown-output").fill("# Unsaved");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator("#convert-btn").click();
    assert.equal(
      await page.locator("#markdown-output").inputValue(),
      "# Unsaved",
    );
    const saveAgain = page.waitForEvent("download");
    await page.locator("#download-btn").click();
    await saveAgain;
    let prompts = 0;
    page.once("dialog", (dialog) => {
      prompts++;
      dialog.dismiss();
    });
    await page.locator("#convert-btn").click();
    assert.equal(prompts, 0);
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    assert.equal(await page.locator("#tab-split").isVisible(), false);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
