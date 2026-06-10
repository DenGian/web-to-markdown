/**
 * server.js
 *
 * Express HTTP server and API routing.
 *
 * Endpoints:
 *   POST /api/convert   — accepts { url } in JSON body, returns conversion result
 *   GET  /api/health    — lightweight liveness probe (useful for debugging)
 *   GET  *              — serves the static frontend from /public
 *
 * Design notes:
 *   - We intentionally keep this file thin: routing + error handling only.
 *     All conversion logic lives in converter.js so it can be tested and
 *     imported independently of the HTTP layer.
 *   - express.static serves the frontend, avoiding a separate dev server or
 *     build step. For a local single-user tool this is perfectly sufficient.
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { convertUrlToMarkdown } from "./converter.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// __dirname isn't available in ES modules; reconstruct it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ?? 3000;

// Parse JSON request bodies
app.use(express.json());

// Serve the frontend (index.html + assets) from the /public directory
app.use(express.static(path.join(__dirname, "../public")));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/convert
 *
 * Body:   { "url": "https://example.com/article" }
 * Returns: { "markdown": "...", "title": "...", "byline": "...", "url": "..." }
 *
 * Errors:
 *   400 — missing or invalid URL
 *   422 — URL is valid but conversion failed (e.g. site blocked the scraper)
 *   500 — unexpected internal error
 */
app.post("/api/convert", async (req, res) => {
  const { url } = req.body;

  // Basic input validation — a missing or obviously non-URL value should fail
  // fast without spinning up a Playwright instance.
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "A valid URL string is required." });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: `"${url}" is not a valid URL.` });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return res
      .status(400)
      .json({ error: "Only http:// and https:// URLs are supported." });
  }

  console.log(`[convert] Starting: ${url}`);
  const startTime = Date.now();

  try {
    const result = await convertUrlToMarkdown(url);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[convert] Done in ${elapsed}s: "${result.title}"`);

    return res.json(result);
  } catch (err) {
    console.error(`[convert] Failed: ${url}\n`, err);

    // Give actionable messages for known failure modes rather than a generic crash message.
    const isBrowserMissing = err.message?.includes("Executable doesn't exist");
    const isNavigationError =
      err.message?.includes("net::") ||
      err.message?.includes("Timeout") ||
      err.message?.includes("ERR_");

    const status = isBrowserMissing ? 503 : isNavigationError ? 422 : 500;
    const message = isBrowserMissing
      ? "Chromium is not installed. Run `npx playwright install chromium` in the project folder, then restart the server."
      : isNavigationError
      ? `Could not load the page: ${err.message}`
      : "Conversion failed due to an internal error. Check the server logs.";

    return res.status(status).json({ error: message });
  }
});

/**
 * GET /api/health
 *
 * Returns 200 OK with a simple JSON payload. Useful for confirming the server
 * is running when debugging startup issues.
 */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Catch-all: send index.html for any non-API path so the SPA handles routing
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n  Website → Markdown Converter`);
  console.log(`  Running at: http://localhost:${PORT}\n`);
});
