# Proposed first release

Version: `1.0.0` (matches `package.json` and `CHANGELOG.md`).

Suggested GitHub description: **Convert a public web page to editable Markdown with a lightweight web app and CLI.**

Suggested topics: `markdown`, `webpage-to-markdown`, `playwright`, `readability`, `turndown`, `nodejs`, `express`.

Before publishing:

1. Review the diff and the original uncommitted frontend edits.
2. Run `npm ci`, `npm run install:browser`, and `npm run check` on a clean checkout.
3. Add worker egress and memory controls before a public API deployment; decide on hosting and validate that design.
4. Commit the approved changes, then tag the tested commit `v1.0.0` and push the tag only after final review.
5. Add the GitHub description and topics after reviewing the wording.

No deployment, repository visibility change, tag, or release is part of this work.
