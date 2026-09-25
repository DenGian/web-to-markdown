# Changelog

## 1.0.2 — 2026-09-25

- Match stale outline actions to their original section after edits, including inserted duplicate or renamed headings; refresh without acting when the match is uncertain.

## 1.0.1 — 2026-09-25

- Use current editor positions for Copy section and heading navigation immediately after edits.
- Refresh the desktop screenshot to show the Split view described in the README.

## 1.0.0 — 2026-09-25

- Convert public pages to Markdown through a local web app or CLI, with Readability article extraction and body fallback.
- Render JavaScript pages in bounded Chromium sessions with validated public network requests.
- Edit Markdown, open local files, view sanitized GFM Preview, navigate the outline, copy sections, and save `.md` files.
- Support optional front matter and conversion time image and link cleanup.
- Improve heading analysis for long documents and defer Preview work while editing Source.
- Add Chromium fixture and UI coverage, automated code checks, dependency audit, and bundled asset license notices.
