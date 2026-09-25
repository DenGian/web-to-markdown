import { marked } from "./vendor/marked.esm.js";
import createDOMPurify from "./vendor/purify.es.mjs";

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );

const renderer = {
  image({ text, href }) {
    const label = text || "Untitled image";
    return `<span class="image-placeholder" title="${escapeHtml(href)}">Image: ${escapeHtml(label)}</span>`;
  },
};
marked.use({ renderer });

export function renderPreview(markdown, documentObject = globalThis.document) {
  const source = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  const html = marked.parse(source, { gfm: true });
  const purify = createDOMPurify(documentObject.defaultView);
  const clean = purify.sanitize(html, {
    FORBID_TAGS: ["img", "svg", "math", "iframe", "form", "style"],
  });
  const template = documentObject.createElement("template");
  template.innerHTML = clean;
  for (const link of template.content.querySelectorAll("a")) {
    const href = link.getAttribute("href");
    let allowed = false;
    try {
      const url = new URL(href);
      allowed = ["http:", "https:"].includes(url.protocol);
    } catch {
      allowed = href?.startsWith("#") && !href.startsWith("#javascript:");
    }
    if (!allowed) {
      link.replaceWith(documentObject.createTextNode(link.textContent));
      continue;
    }
    link.setAttribute("rel", "noopener noreferrer");
    if (!href.startsWith("#")) link.setAttribute("target", "_blank");
  }
  return template.innerHTML;
}
