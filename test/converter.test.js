import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { convertHtml } from "../src/converter.js";

const html = await readFile(
  new URL("./fixtures/article.html", import.meta.url),
  "utf8",
);
const fallback = await readFile(
  new URL("./fixtures/fallback.html", import.meta.url),
  "utf8",
);
test("article output has valid escaped YAML, links, image, code and table", () => {
  const result = convertHtml(html, "https://example.com/article");
  assert.match(result.markdown, /^---\ntitle: "Doc: \\"Quoted\\""/);
  assert.match(result.markdown, /source: "https:\/\/example.com\/article"/);
  assert.match(result.markdown, /author: "A: Writer"/);
  assert.match(result.markdown, /\[guide\]\(https:\/\/example.com\/guide\)/);
  assert.match(
    result.markdown,
    /!\[Diagram\]\(https:\/\/example.com\/diagram.png\)/,
  );
  assert.match(result.markdown, /```js\nconst x = 1/);
  assert.match(result.markdown, /\| Name\s+\| Value/);
  assert.equal(result.extractionMode, "article");
  assert.ok(result.wordCount > 20);
  assert.equal(result.headingCount, 1);
  assert.deepEqual(result.warnings, []);
});
test("full mode and front matter option", () => {
  const result = convertHtml(html, "https://example.com/", {
    mode: "full",
    frontMatter: false,
  });
  assert.doesNotMatch(result.markdown, /^---/);
  assert.match(result.markdown, /Menu/);
  assert.equal(result.extractionMode, "full");
});
test("fallback body and empty page", () => {
  const result = convertHtml(
    '<title>Home</title><body><h1>Links</h1><p><a href="/one">One</a></p></body>',
    "https://example.com/",
  );
  assert.match(result.markdown, /Links/);
  assert.equal(result.extractionMode, "body");
  assert.match(result.warnings.join(" "), /page body/);
  assert.throws(
    () => convertHtml("<body></body>", "https://example.com/"),
    /No readable content/,
  );
});
test("YAML escapes controls and quoted author", () => {
  const result = convertHtml(
    '<title>A\nB: "C"</title><meta name="author" content="A &quot;B&quot;"><body><p>Useful text</p></body>',
    "https://example.com/",
  );
  assert.match(result.markdown, /title: "A B: \\"C\\""/);
  assert.match(result.markdown, /author: "A \\"B\\""/);
});
test("body fallback preserves reference page structures", () => {
  const result = convertHtml(fallback, "https://example.com/reference", {
    frontMatter: false,
  });
  assert.equal(result.extractionMode, "body");
  assert.match(result.markdown, /1\.\s+Install/);
  assert.match(result.markdown, /Choose a file/);
  assert.match(result.markdown, /\[Manual\]\(https:\/\/example.com\/manual\)/);
  assert.match(result.markdown, /!\[Map\]\(https:\/\/example.com\/map.png\)/);
  assert.match(result.markdown, /```bash/);
  assert.match(result.markdown, /\| Option\s+\| Value/);
});
test("cleanup options change only image and link output at conversion time", () => {
  const source =
    '<body><h1>Guide</h1><p>Read <a href="/guide">the guide</a> and view <img src="/chart.png" alt="Growth chart">.</p></body>';
  const faithful = convertHtml(source, "https://example.com/", {
    frontMatter: false,
  });
  assert.match(
    faithful.markdown,
    /\[the guide\]\(https:\/\/example.com\/guide\)/,
  );
  assert.match(
    faithful.markdown,
    /!\[Growth chart\]\(https:\/\/example.com\/chart.png\)/,
  );
  const alt = convertHtml(source, "https://example.com/", {
    frontMatter: false,
    images: "alt",
    links: "text",
  });
  assert.match(alt.markdown, /the guide/);
  assert.match(alt.markdown, /Growth chart/);
  assert.doesNotMatch(alt.markdown, /\]\(|!\[/);
  const omitted = convertHtml(source, "https://example.com/", {
    frontMatter: false,
    images: "omit",
  });
  assert.doesNotMatch(omitted.markdown, /Growth chart|chart.png/);
  assert.throws(
    () => convertHtml(source, "https://example.com/", { images: "bad" }),
    /Invalid cleanup/,
  );
});
