# v1.0.0 local release candidate

The app is ready for local review. It is not a public API or deployment package.

## Verification

`npm run check` passes lint, formatting, and 24 tests. `npm audit --omit=dev` reports zero vulnerabilities. A live `brew.sh` CLI conversion produced 6,203 bytes, 827 words, and seven headings. The live web conversion reported the same seven headings, with seven outline items and seven Preview headings. The screenshots show the final desktop and mobile UI. Bundled Marked and DOMPurify notices are in `public/vendor`.

## Remaining limitations

Conversion depends on a public page loading within resource and time limits. Article extraction is heuristic. Scripts, data requests, blocked assets, and late hydration can affect content. Preview does not load remote images. The browser download fallback marks the editor saved once the download is initiated; the user should confirm the file appears in their downloads.

Review the source changes, samples, screenshots, and limitations before deciding whether to commit and tag. No publishing or repository settings changes are included here.
