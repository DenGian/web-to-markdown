# Website → Markdown Converter

A local web application that converts any webpage to clean, readable Markdown.
Paste a URL, get back a well-structured `.md` file — including JavaScript-heavy pages.

---

## Features

- **Full JS rendering** — uses a headless Chromium browser (Playwright), so single-page apps, lazy-loaded content, and client-rendered pages all work correctly.
- **Smart content extraction** — Mozilla Readability strips navigation, ads, footers, and sidebars (the same technology behind Firefox's Reader Mode), leaving only the meaningful article content.
- **GitHub-Flavoured Markdown** — tables, strikethrough, and task lists are preserved.
- **YAML front matter** — every output file includes `title`, `source`, and `date` metadata at the top, making saved files self-documenting.
- **Source + Preview tabs** — switch between the raw Markdown and a rendered preview in the browser.
- **Save with folder picker** — the native OS "Save As" dialog lets you choose exactly where the `.md` file lands.
- **Copy to clipboard** — one click copies the full Markdown.

---

## Requirements

- [Node.js](https://nodejs.org/) v18 or later
- An internet connection (for fetching pages)

---

## Setup

```bash
# 1. Install Node dependencies
npm install

# 2. Install the Playwright Chromium browser (~130 MB, one-time)
npm run install:browser

# 3. Start the server
npm start
```

Then open **http://localhost:3000** in your browser.

> **Tip:** Use `npm run dev` instead of `npm start` during development — it restarts the server automatically on file changes (requires Node 18+).

---

## Usage

1. Paste a full URL (including `https://`) into the input field.
2. Click **Convert** and wait a few seconds while the page loads and converts.
3. Switch between **Source** (raw Markdown) and **Preview** (rendered) tabs.
4. Click **Copy** to copy the Markdown to your clipboard, or **Save as .md** to download the file with a folder picker.

---

## Project Structure

```
website_to_md_converter/
├── src/
│   ├── server.js       — Express HTTP server and API routing
│   └── converter.js    — Core conversion pipeline (Playwright → Readability → Turndown)
├── public/
│   ├── index.html      — Single-page application shell
│   ├── styles.css      — All styling (CSS custom properties, dark theme)
│   └── app.js          — Frontend logic (form, tabs, copy, save)
└── package.json
```

---

## How It Works

### Conversion pipeline

```
URL
 │
 ▼
Playwright (headless Chromium)
  Fetches the page with a real browser engine.
  Waits for JS to settle (networkidle).
  Blocks images/fonts/media to speed up loading.
 │
 ▼
Mozilla Readability
  Parses the rendered HTML.
  Extracts only the main article content.
  Resolves relative URLs to absolute.
 │
 ▼
Turndown + GFM plugin
  Converts clean HTML → Markdown.
  Preserves tables, code blocks, links.
  Strips scripts, styles, iframes.
 │
 ▼
Output
  YAML front matter + Markdown body.
```

### Technology choices

| Concern | Choice | Why |
|---|---|---|
| JS rendering | Playwright + Chromium | Most reliable; handles any modern website |
| Content extraction | Mozilla Readability | Battle-tested; same engine as Firefox Reader Mode |
| HTML → MD | Turndown + GFM plugin | Actively maintained; highly configurable |
| HTTP server | Express | Minimal, well-understood; no overkill for a local tool |
| Frontend | Vanilla JS + CSS | Zero build step; fast to load; easy to modify |

---

## Configuration

The server port defaults to `3000`. To change it:

```bash
PORT=8080 npm start
```

---

## Limitations

- Pages behind a login wall require you to be authenticated — the headless browser has no access to your personal sessions.
- Some sites actively block headless browsers. If a conversion fails, try the page in Reader Mode in your browser first to confirm there's extractable content.
- Conversion takes 3–15 seconds depending on page complexity and network speed.
