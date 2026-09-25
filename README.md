# Website → Markdown

A local app and CLI for converting one public web page into editable Markdown. Version 1.0.0 is a local release candidate.

![Desktop Split view](docs/screenshot.png)

[Mobile Preview](docs/screenshot-mobile.png)

## Setup

Use Node.js 22, 24, or 26 and install Playwright Chromium:

```sh
npm ci
npm run install:browser
npm start
```

Open <http://localhost:3000>. The server binds to `127.0.0.1`.

## Web workflow

Enter a public HTTP or HTTPS URL, choose **Article only** or **Full page**, set the conversion options, and select **Convert**. Source is editable Markdown, Preview is sanitized GFM, and Split shows both panes on desktop. Narrow screens have Source and Preview panes. Counts and outline follow the current editor text, including headings within lists. Choose a heading to navigate or **Copy section** to copy its content through the next heading at the same or higher level. Copy and Save as .md also use the current editor text.

**Open Markdown file** reads a local UTF-8 `.md` file with the browser File API. It never sends the file to the conversion server. Empty, invalid UTF-8, and files over 2 MB are rejected. A changed editor prompts before another conversion or opening a file; saving or opening establishes a new baseline. Preview represents remote images as labeled placeholders and never loads them.

Conversion options apply only when converting a URL. They do not rewrite Markdown after editing or opening a file:

| Option | Effect |
| --- | --- |
| Images: Keep Markdown (default) | Keep `![alt](URL)` in exported Markdown. |
| Images: Use alt text | Replace each image with its `alt` text; an image without alt text is removed. |
| Images: Omit | Remove images and their alt text. |
| Links: Keep URLs (default) | Keep `[text](URL)` in exported Markdown. |
| Links: Text only | Keep link contents, including inline formatting, and remove link destinations. |

## CLI

```sh
node src/cli.js https://brew.sh/ --output homebrew.md
node src/cli.js https://example.com/ --full --no-front-matter --images alt --links text > example.md
```

Use `--images retain|alt|omit` and `--links retain|text`. Without `--output`, Markdown goes to stdout. Output files are never overwritten. Failures go to stderr and set a nonzero exit code.

## How it works

The fetcher validates each URL and DNS answer, rejects private and special addresses, and pins a validated IP during requests. Redirects and Chromium subresources pass through the same checks. Chromium renders JavaScript pages. After DOM content loads, the converter samples visible text for stability, waiting at most five seconds for hydration. Readability extracts articles when it finds enough prose; otherwise the page body is used and a warning explains the fallback. Turndown produces Markdown. Marked parses the outline and renders Preview, and DOMPurify sanitizes Preview. Images, fonts, and media are intentionally blocked during capture; these alone do not create a warning. Failed content scripts or data requests produce a warning because captured content may be incomplete.

Conversions have a 30 second total deadline, 80 request limit, 2 MB per response, 4 MB rendered HTML, 12 MB aggregate download, and 2 MB Markdown output limit. The server admits two active conversions and ten requests per client IP per minute. Browser contexts close after each conversion.

Bundled browser modules and their license notices are in `public/vendor`: Marked (MIT) and DOMPurify (Apache 2.0/MPL 2.0). Dependency versions are recorded in `package-lock.json`.

## Checks

```sh
npm run check
npm audit --omit=dev
```

`check` runs ESLint, Prettier, and local tests, including Chromium UI and JavaScript rendered fixture tests. CI checks Node 22, 24, and 26. Live websites are not part of CI. With network access, run `node scripts/manual-smoke.js` to check a real `brew.sh` web conversion and refresh the screenshots. A CLI smoke check is `node src/cli.js https://brew.sh/ --no-front-matter > /tmp/brew.md`.

## Limitations

The app converts one public page at a time. It does not crawl, sign into websites, run workers or WebSockets, or interact with cookie banners. Article detection is heuristic; Full page mode may capture navigation and other surrounding content. Resource blocking, size limits, and the five second hydration window can omit content. Preview images are placeholders. The server fetches submitted URLs and page content, so avoid sensitive links. URL checks do not replace OS level network isolation for public hosting. This release is for local use, without a hosted API or deployment.

For setup problems: install Chromium with `npm run install:browser`; check network and DNS for connection errors; try Full page mode for incomplete article output; retry a smaller page if a limit or timeout is reached. Unexpected server errors include stack traces in local logs.

See [release notes](docs/release.md), [changelog](CHANGELOG.md), and [security guidance](SECURITY.md).
