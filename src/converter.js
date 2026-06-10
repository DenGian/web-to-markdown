/**
 * converter.js
 *
 * Core conversion pipeline: URL → clean HTML → Markdown
 *
 * Pipeline stages:
 *   1. Playwright (headless Chromium) fetches the page and waits for JS to settle.
 *      This handles SPAs, lazy-loaded content, and cookie banners.
 *
 *   2. Mozilla Readability extracts the main article body from the raw HTML.
 *      This mirrors what Firefox's "Reader Mode" does — stripping navbars, ads,
 *      footers, sidebars, and other page chrome so only the meaningful content
 *      survives into Markdown.
 *
 *   3. Turndown (+ GFM plugin) converts the cleaned HTML to Markdown.
 *      The GFM plugin adds support for tables, strikethrough, and task lists
 *      which base CommonMark lacks.
 */

import { chromium } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

// ---------------------------------------------------------------------------
// Turndown configuration
// ---------------------------------------------------------------------------

/**
 * Creates and configures a TurndownService instance.
 *
 * Kept as a factory so each conversion gets a fresh instance — TurndownService
 * accumulates state (custom rules list) and reusing one across requests could
 * cause subtle bleed-through between conversions in a concurrent setting.
 */
function createTurndownService() {
  const td = new TurndownService({
    headingStyle: "atx", // Use # syntax instead of underline style
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced", // ``` blocks instead of indented
    fence: "```",
    emDelimiter: "_",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });

  // GFM adds: tables, strikethrough, task list items
  td.use(gfm);

  // Remove elements that survive Readability but add no reading value:
  // scripts, styles, hidden inputs, and social/share widgets.
  td.remove(["script", "style", "noscript", "iframe", "form", "button"]);

  return td;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts a webpage at `url` to Markdown.
 *
 * @param {string} url - Fully qualified URL (must start with http/https).
 * @returns {Promise<ConversionResult>}
 *
 * @typedef {Object} ConversionResult
 * @property {string} markdown  - The converted Markdown content.
 * @property {string} title     - Page title extracted by Readability.
 * @property {string} byline    - Author / byline if Readability found one.
 * @property {string} url       - The canonical URL that was actually loaded
 *                                (may differ from input after redirects).
 */
export async function convertUrlToMarkdown(url) {
  // Stage 1 — fetch the rendered page HTML via Playwright
  const { html, finalUrl } = await fetchRenderedHtml(url);

  // Stage 2 — extract main content with Readability
  const { article, dom } = extractArticle(html, finalUrl);

  // Stage 3 — convert to Markdown
  const td = createTurndownService();

  // Prefer Readability's extracted content; fall back to full <body> if
  // Readability couldn't identify an article (e.g. purely navigational pages).
  const sourceHtml = article?.content ?? dom.window.document.body.innerHTML;

  const markdown = td.turndown(sourceHtml);

  return {
    markdown: buildMarkdownDocument(markdown, article, finalUrl),
    title: article?.title ?? extractTitleFromDom(dom),
    byline: article?.byline ?? "",
    url: finalUrl,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Launches a headless Chromium browser, navigates to `url`, waits for the
 * network to go idle (JS bundles executed, async data fetched), then returns
 * the full serialized HTML.
 *
 * `networkidle` waits until there are no more than 0 network connections for
 * at least 500 ms, which is a reliable signal that SPA hydration is complete.
 *
 * The browser is launched fresh per conversion rather than kept warm because:
 *   - Keeps memory usage predictable for a local single-user tool.
 *   - Avoids session/cookie state leaking between unrelated conversions.
 *   - A warm browser pool would be premature optimisation at this scale.
 */
async function fetchRenderedHtml(url) {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      // Mimic a real desktop browser to avoid bot-detection blocks
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      // Block images and fonts to speed up loading; we only need the DOM
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    });

    // Abort image/font requests — we don't need them for text extraction
    // and blocking them can cut load time by 50–80% on media-heavy pages.
    await context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "media", "font"].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30_000, // 30 s; generous for slow sites
    });

    const html = await page.content();
    const finalUrl = page.url(); // Capture post-redirect URL

    return { html, finalUrl };
  } finally {
    // Always close the browser, even on error, to avoid orphaned processes
    await browser.close();
  }
}

/**
 * Runs Mozilla Readability on the raw HTML string.
 *
 * Readability mutates the DOM it's given, so we parse a fresh JSDOM instance
 * rather than passing one that might be reused elsewhere.
 *
 * The `url` parameter is passed to JSDOM so that relative URLs in `href` and
 * `src` attributes are resolved to absolute URLs — critical for images and
 * links to remain valid in the output Markdown.
 */
function extractArticle(html, url) {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document, {
    // Keep classes on elements so Turndown rules can reference them if needed
    keepClasses: false,
    // Disabling this lets Readability be more aggressive about content extraction
    nbTopCandidates: 5,
  });

  const article = reader.parse(); // Returns null if no article found
  return { article, dom };
}

/**
 * Assembles the final Markdown document with a YAML-style front-matter header.
 *
 * Including metadata at the top (title, source URL, date) makes the output
 * files self-documenting — useful when you've saved many conversions and need
 * to know where a file came from.
 */
function buildMarkdownDocument(body, article, url) {
  const title = article?.title ?? "Untitled";
  const byline = article?.byline ? `\nauthor: "${article.byline}"` : "";
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const frontMatter = `---
title: "${title.replace(/"/g, '\\"')}"
source: "${url}"${byline}
date: "${date}"
---

`;

  return frontMatter + body;
}

/**
 * Fallback title extraction when Readability returns null.
 * Tries <title> then the first <h1>.
 */
function extractTitleFromDom(dom) {
  return (
    dom.window.document.title ||
    dom.window.document.querySelector("h1")?.textContent?.trim() ||
    "Untitled"
  );
}
