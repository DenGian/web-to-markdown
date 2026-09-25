# Web to Markdown

Turn a public web page into Markdown, then edit and save it on your computer. Use the local web app for a visual workflow or the CLI for scripts. The converter captures JavaScript rendered pages with Chromium and extracts readable content where possible.

![Desktop app showing a Homebrew conversion in Split view](docs/screenshot.png)

[See the mobile Preview](docs/screenshot-mobile.png)

## Requirements

- Node.js 22.13+, 24, or 26 and npm
- Playwright Chromium, installed with the command below
- Network access to the public pages you convert

## Quick start

```sh
git clone https://github.com/DenGian/web-to-markdown.git
cd web-to-markdown
npm ci
npm run install:browser
npm start
```

Open <http://localhost:3000>. The server listens on `127.0.0.1`.

## Web app

Enter a public HTTP or HTTPS URL and choose **Convert**. **Article only** uses Readability when it finds enough prose; otherwise the app falls back to the page body and shows a warning. **Full page** converts the body, including surrounding navigation where present. You can include source, title, date, and author front matter and choose how images and links appear in the result.

Edit Markdown in **Source**, read the sanitized result in **Preview**, or use **Split** on wider screens. The outline follows your edits. Select a heading to navigate, or choose **Copy section** to copy through the next heading of the same or higher level. **Copy** and **Save as .md** use the edited text.

**Open Markdown file** reads a UTF-8 `.md` file in your browser. It accepts files up to 2 MB. Opening or converting another document prompts before replacing unsaved edits. Local files stay in the browser; only URL conversions are sent to the local server.

| Conversion option | Result |
| --- | --- |
| Images: Keep Markdown | Keep `![alt](URL)` in exported Markdown. |
| Images: Use alt text | Replace each image with its alt text. |
| Images: Omit | Remove images. |
| Links: Keep URLs | Keep Markdown link destinations. |
| Links: Text only | Keep link text and inline formatting. |

These options apply when converting a URL. Editing or opening Markdown does not rewrite existing links or images.

## CLI

```sh
node src/cli.js https://brew.sh/ --output homebrew.md
node src/cli.js https://example.com/ --full --no-front-matter --images alt --links text > example.md
node src/cli.js --help
```

Without `--output`, Markdown goes to stdout. The CLI will not overwrite an output file. Errors go to stderr with a nonzero exit code. Use `--images retain|alt|omit` and `--links retain|text`.

## How conversion works

The fetcher validates URLs and DNS answers, pins public IP addresses, and checks redirects and browser subresources. Chromium renders the page within bounded time and size limits. Readability extracts an article when it can; Turndown converts the chosen HTML to Markdown. The web app uses Marked for GFM Preview and DOMPurify to sanitize it. Preview shows remote images as text placeholders and does not load them.

Conversion allows up to 30 seconds, 80 requests, 2 MB per response, 4 MB of rendered HTML, 12 MB of downloads, and 2 MB of Markdown output. The local server admits two active conversions. These limits and blocked media can leave content incomplete.

## Limitations

- Converts one public page at a time. It does not crawl, sign in, interact with cookie banners, or run workers and WebSockets.
- Article extraction is heuristic. Some pages fall back to the body; Full page may include navigation, and HTML lists can produce nested Markdown headings.
- Content loaded late or through blocked scripts and requests may be missing. Sites may block automated browsers.
- Preview intentionally does not load remote images. JavaScript and active HTML in Markdown are sanitized.
- This release is designed to run locally. It does not include a hosted app or API.

## Troubleshooting

- If Chromium is missing, run `npm run install:browser` and retry.
- If a URL fails, check that it is public, accessible from your machine, and returns HTML. Try another page to distinguish a site restriction from a local network issue.
- If an article looks incomplete, try **Full page**. If conversion reaches a limit, try a smaller page.
- The browser save fallback starts a download; check your downloads folder if no file appears. Modern browsers may instead show a file picker.

## Development

```sh
npm ci
npm run install:browser
npm run check
npm audit --omit=dev --audit-level=high
```

`npm run check` runs ESLint, Prettier, and automated tests, including Chromium UI and JavaScript rendered page fixtures. CI checks Node.js 22, 24, and 26. Live sites are excluded from CI. With network access, `node scripts/manual-smoke.js` checks `brew.sh` through the web UI and refreshes the screenshots.

See [contributing](CONTRIBUTING.md), [security](SECURITY.md), [changelog](CHANGELOG.md), [release notes](docs/release.md), and the [MIT license](LICENSE). Bundled browser assets and their license notices are in [`public/vendor`](public/vendor).
