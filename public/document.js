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
  const parsed = collect(marked.lexer(source, { gfm: true }));
  const lines = [...source.matchAll(/[^\n]*(?:\n|$)/g)].filter(
    (match) => match[0],
  );
  const headings = [];
  let nextLine = 0;
  for (let index = 0; index < parsed.length; index++) {
    const heading = parsed[index];
    const needle = heading.raw.trim().split("\n")[0].trim();
    const setext = /^.+\n[=-]+(?:\n|$)/.test(heading.raw.trim());
    for (let line = nextLine; line < lines.length; line++) {
      if (!lines[line][0].includes(needle)) continue;
      const lastLine = setext ? line + 1 : line;
      if (!lines[lastLine]) continue;
      const end = lines[lastLine].index + lines[lastLine][0].length;
      const found = collect(marked.lexer(source.slice(0, end), { gfm: true }));
      if (
        found.length !== index + 1 ||
        found[index].depth !== heading.depth ||
        found[index].text !== heading.text
      )
        continue;
      headings.push({
        text: heading.text,
        level: heading.depth,
        start: lines[line].index,
        line,
      });
      nextLine = lastLine + 1;
      break;
    }
  }
  return {
    headings,
    wordCount: (source.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [])
      .length,
    headingCount: parsed.length,
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
