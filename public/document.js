import { marked } from "./vendor/marked.esm.js";

export function contentSource(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, (match) =>
    match.replace(/[^\r\n]/g, " "),
  );
}

function collect(tokens, result = []) {
  for (const token of tokens) {
    if (token.type === "heading") result.push(token);
    if (token.type === "list")
      for (const item of token.items) collect(item.tokens, result);
    if (token.type === "blockquote") collect(token.tokens, result);
  }
  return result;
}

export function analyzeMarkdown(markdown) {
  const source = contentSource(markdown);
  const tokens = marked.lexer(source, { gfm: true });
  const lines = [...source.matchAll(/[^\n]*(?:\n|$)/g)].filter(
    (match) => match[0],
  );
  const headings = [];
  let headingCount = 0;
  let offset = 0;
  let line = 0;
  for (const token of tokens) {
    const end = offset + token.raw.length;
    const parsed = collect([token]);
    headingCount += parsed.length;
    let pending = 0;
    let fence = null;
    while (line < lines.length && lines[line].index < end) {
      const raw = lines[line][0];
      // Container markers are removed by Marked before it lexes nested headings.
      const content = raw
        .replace(/^(?:\s*>\s*)+/, "")
        .replace(/^\s*(?:[-+*]|\d+[.)])\s+/, "")
        .trim();
      const marker = content.match(/^(`{3,}|~{3,})/);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length)
          fence = null;
      } else if (!fence && pending < parsed.length) {
        const heading = parsed[pending];
        const needle = heading.raw.trim().split("\n")[0].trim();
        const setext = /^.+\n[=-]+(?:\n|$)/.test(heading.raw.trim());
        const underline = lines[line + 1]?.[0]
          .replace(/^(?:\s*>\s*)+/, "")
          .trim();
        if (
          content.startsWith(needle) &&
          (!setext || /^[=-]+$/.test(underline || ""))
        ) {
          headings.push({
            text: heading.text,
            level: heading.depth,
            start: lines[line].index,
            line,
          });
          pending++;
          if (setext) line++;
        }
      }
      line++;
    }
    offset = end;
  }
  return {
    headings,
    wordCount: (source.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [])
      .length,
    headingCount,
  };
}

export function sectionMarkdown(markdown, headings, index) {
  const heading = headings[index];
  const next = headings
    .slice(index + 1)
    .find((item) => item.level <= heading.level);
  const section = markdown
    .slice(heading.start, next?.start ?? markdown.length)
    .trimEnd();
  const indent = section.match(/^[ \t]*/)[0];
  return indent
    ? section
        .split("\n")
        .map((line) =>
          line.startsWith(indent) ? line.slice(indent.length) : line,
        )
        .join("\n")
    : section;
}
