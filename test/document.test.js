import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMarkdown, sectionMarkdown } from "../public/document.js";
import { marked } from "../public/vendor/marked.esm.js";

const markdown = `---\ntitle: "Example"\n---\n\n# Top\nintro\n\n- Item\n  ## Nested\n  nested text\n  ### Child\n  child text\n\n~~~md\n# fake\n~~~\n\n## Repeat\nfirst\n\n## Repeat\nsecond\n`;

test("parsed headings include list items, duplicates, and nested levels but exclude fences", () => {
  const result = analyzeMarkdown(markdown);
  assert.deepEqual(
    result.headings.map(({ text, level }) => [text, level]),
    [
      ["Top", 1],
      ["Nested", 2],
      ["Child", 3],
      ["Repeat", 2],
      ["Repeat", 2],
    ],
  );
  assert.equal(result.headingCount, 5);
  assert.equal(
    sectionMarkdown(markdown, result.headings, 1),
    "## Nested\nnested text\n### Child\nchild text\n\n~~~md\n# fake\n~~~",
  );
  assert.equal(
    sectionMarkdown(markdown, result.headings, 3),
    "## Repeat\nfirst",
  );
  assert.equal(
    sectionMarkdown(markdown, result.headings, 4),
    "## Repeat\nsecond",
  );
});

test("statistics and boundaries follow current edits", () => {
  const original = analyzeMarkdown("# One\nword");
  const edited = analyzeMarkdown("# One\nword again\n\n## Two\nmore");
  assert.equal(original.headingCount, 1);
  assert.equal(edited.headingCount, 2);
  assert.ok(edited.wordCount > original.wordCount);
  assert.equal(
    sectionMarkdown("# One\nword again\n\n## Two\nmore", edited.headings, 1),
    "## Two\nmore",
  );
});
test("setext and quoted headings retain source positions", () => {
  const source = "Title\n=====\n\n> ## Quoted\n> text\n\nNext\n----\n";
  const result = analyzeMarkdown(source);
  assert.equal(result.headingCount, 3);
  assert.deepEqual(
    result.headings.map((item) => item.start),
    [0, 13, 33],
  );
  assert.match(sectionMarkdown(source, result.headings, 1), /> ## Quoted/);
});

test("repeated headings after fenced lookalikes map to their own lines", () => {
  const source =
    "---\ntitle: Intro\n---\n\n- ## Same\n  first\n  ```md\n  ## Same\n  ```\n  ## Same\n  second\n\n> Quote\n> -----\n> tail\n";
  const result = analyzeMarkdown(source);
  assert.equal(result.headingCount, 3);
  assert.deepEqual(
    result.headings.map(({ start }) => start),
    [
      source.indexOf("- ## Same"),
      source.indexOf("  ## Same\n  second"),
      source.indexOf("> Quote"),
    ],
  );
  assert.match(sectionMarkdown(source, result.headings, 1), /second/);
  assert.doesNotMatch(sectionMarkdown(source, result.headings, 1), /first/);
});

test("heading analysis lexes a large document once", () => {
  const source = Array.from(
    { length: 2000 },
    (_, index) =>
      `## Repeated heading\nParagraph ${index} with several words.\n\n`,
  ).join("");
  const lexer = marked.lexer;
  let calls = 0;
  marked.lexer = (...args) => {
    calls++;
    return lexer(...args);
  };
  try {
    const result = analyzeMarkdown(source);
    assert.equal(result.headingCount, 2000);
    assert.equal(
      result.headings[1999].start,
      source.lastIndexOf("## Repeated heading"),
    );
    assert.equal(calls, 1);
  } finally {
    marked.lexer = lexer;
  }
});
