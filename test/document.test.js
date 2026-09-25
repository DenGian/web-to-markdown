import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMarkdown, sectionMarkdown } from "../public/document.js";

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
