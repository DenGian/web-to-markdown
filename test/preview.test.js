import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderPreview } from "../public/preview.js";

const document = new JSDOM("").window.document;
const render = (markdown) => renderPreview(markdown, document);

test("preview renders GFM structures and safe links", () => {
  const html = render(
    "# Title\n\n1. First\n2. Second\n\n> Quoted\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n~~~js\nconst x = 1\n~~~\n\n[link](https://example.com/a_(b))",
  );
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<table>/);
  assert.match(html, /language-js/);
  assert.match(html, /href="https:\/\/example.com\/a_\(b\)"/);
});
test("preview strips active HTML and never creates remote images", () => {
  const html = render(
    '<script>alert(1)</script><img src="https://bad.test/track">\n\n[Bad](javascript:alert(1)) [Safe](https://example.com/) ![Diagram](https://example.com/a.png)',
  );
  assert.doesNotMatch(html, /<script|<img|javascript:/i);
  assert.match(html, /Image: Diagram/);
  assert.match(html, /href="https:\/\/example.com\/"/);
});
