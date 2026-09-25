# v1.0.0 — local release

Web to Markdown converts a public page into editable Markdown with a local web app or CLI. It renders JavaScript pages with Chromium, extracts readable articles where possible, and falls back to the page body when needed.

## Highlights

- Edit, Preview, and Split views with live statistics, outline navigation, and Copy section.
- Open UTF-8 Markdown files locally, copy edits, and save `.md` files.
- CLI output to stdout or a new file, with front matter, image, and link options.
- Bounded public URL fetching, sanitized Preview, and Chromium fixture and UI checks.

## Run locally

Requires Node.js 22.13+, 24, or 26.

```sh
git clone https://github.com/DenGian/web-to-markdown.git
cd web-to-markdown
npm ci
npm run install:browser
npm start
```

Open <http://localhost:3000>, or run `node src/cli.js https://brew.sh/ --output homebrew.md`.

## Limitations

One public page is converted at a time. Article extraction is heuristic; body fallback can include navigation and lists can nest headings. Late content, blocked resources, site restrictions, and conversion limits can affect the result. Preview represents remote images as placeholders. No hosted app or API is provided.
