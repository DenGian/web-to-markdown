import { renderPreview } from "./preview.js";
import { analyzeMarkdown, sectionMarkdown } from "./document.js";

const $ = (id) => document.getElementById(id);
const form = $("convert-form");
const urlInput = $("url-input");
const editor = $("markdown-output");
const statusBanner = $("status-banner");
const outputCard = $("output-card");
let currentTitle = "output";
let baseline = "";
let origin = "";
let headings = [];
let headingsSource = "";
let actionSource = "";
let actionHeadings = [];
let activeView = "source";
let renderTimer;
let previewSource = null;

function status(type, message) {
  statusBanner.hidden = false;
  statusBanner.className = `status-banner status-${type}`;
  statusBanner.setAttribute("role", type === "error" ? "alert" : "status");
  $("status-message").textContent = message;
}
function changed() {
  return !outputCard.hidden && editor.value !== baseline;
}
function mayReplace() {
  return !changed() || window.confirm("Discard unsaved Markdown edits?");
}
function view(which, focus = true) {
  activeView =
    which === "split" && matchMedia("(max-width: 700px)").matches
      ? "source"
      : which;
  for (const name of ["source", "preview", "split"]) {
    const tab = $(`tab-${name}`);
    tab.classList.toggle("tab-active", name === activeView);
    tab.setAttribute("aria-selected", String(name === activeView));
    tab.tabIndex = name === activeView ? 0 : -1;
  }
  $("panel-source").hidden = activeView === "preview";
  $("panel-preview").hidden = activeView === "source";
  $("split-view").classList.toggle("is-split", activeView === "split");
  $("split-view").setAttribute("aria-labelledby", `tab-${activeView}`);
  if (activeView !== "source") {
    if (renderTimer) {
      clearTimeout(renderTimer);
      renderTimer = null;
      renderResult();
    } else renderPreviewIfNeeded();
  }
  if (focus) $(`tab-${activeView}`).focus();
}
for (const name of ["source", "preview", "split"]) {
  $(`tab-${name}`).addEventListener("click", () => view(name));
  $(`tab-${name}`).addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const choices = matchMedia("(max-width: 700px)").matches
      ? ["source", "preview"]
      : ["source", "preview", "split"];
    const current = choices.indexOf(activeView);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? choices.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + choices.length) %
            choices.length;
    view(choices[next]);
  });
}
matchMedia("(max-width: 700px)").addEventListener("change", () => {
  if (activeView === "split") view("source", false);
});

function renderPreviewIfNeeded() {
  const preview = $("markdown-preview");
  if (previewSource === editor.value) return;
  preview.innerHTML = renderPreview(editor.value);
  previewSource = editor.value;
}

function renderResult() {
  if (activeView !== "source") renderPreviewIfNeeded();
  const stats = analyzeMarkdown(editor.value);
  headings = stats.headings;
  headingsSource = editor.value;
  $("result-details").textContent =
    `${origin} · ${stats.wordCount} words · ${stats.headingCount} headings`;
  const items = $("outline-items");
  items.replaceChildren();
  $("heading-outline").hidden = headings.length === 0;
  headings.forEach((heading, index) => {
    const group = document.createElement("div");
    group.className = `outline-entry outline-level-${heading.level}`;
    const jump = document.createElement("button");
    jump.type = "button";
    jump.className = "outline-item";
    jump.textContent = heading.text;
    jump.setAttribute("aria-label", `Go to ${jump.textContent}`);
    jump.addEventListener("click", () => {
      const { items, position } = currentHeading(heading, index);
      if (position < 0) return renderResult();
      const target = items[position];
      if (!target) return;
      if (activeView === "source") {
        editor.focus();
        const end = editor.value.indexOf("\n", target.start);
        editor.setSelectionRange(
          target.start,
          end < 0 ? editor.value.length : end,
        );
      } else {
        renderPreviewIfNeeded();
        $("markdown-preview")
          .querySelectorAll("h1, h2, h3, h4, h5, h6")
          [position]?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }
    });
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "outline-copy";
    copy.textContent = "Copy section";
    copy.setAttribute("aria-label", `Copy section: ${jump.textContent}`);
    copy.addEventListener("click", async () => {
      try {
        const { items, position } = currentHeading(heading, index);
        if (position < 0) return renderResult();
        await navigator.clipboard.writeText(
          sectionMarkdown(editor.value, items, position),
        );
        status("success", `Copied section: ${jump.textContent}.`);
      } catch {
        status(
          "error",
          "Clipboard access failed. Select and copy the section instead.",
        );
      }
    });
    group.append(jump, copy);
    items.append(group);
  });
}
function currentHeading(heading, index) {
  if (headingsSource === editor.value)
    return { items: headings, position: index };
  if (actionSource !== editor.value) {
    actionSource = editor.value;
    actionHeadings = analyzeMarkdown(editor.value).headings;
  }
  const section = (source, items, position) => {
    const start = items[position].start;
    let end = source.length;
    for (let i = position + 1; i < items.length; i++) {
      if (items[i].level <= items[position].level) {
        end = items[i].start;
        break;
      }
    }
    return source.slice(start, end).trimEnd();
  };
  const body = (source, items, position) => {
    const value = section(source, items, position);
    const lineEnd = value.indexOf("\n");
    return lineEnd < 0 ? "" : value.slice(lineEnd + 1).trim();
  };
  const oldSection = section(headingsSource, headings, index);
  const oldBody = body(headingsSource, headings, index);
  const uniqueMatch = (value, extract) => {
    if (
      !value ||
      headings.filter((_, i) => extract(headingsSource, headings, i) === value)
        .length !== 1
    )
      return -1;
    const matches = actionHeadings.flatMap((item, i) =>
      item.level === heading.level &&
      extract(editor.value, actionHeadings, i) === value
        ? [i]
        : [],
    );
    return matches.length === 1 ? matches[0] : -1;
  };
  let position = uniqueMatch(oldSection, section);
  if (position < 0 && oldBody) position = uniqueMatch(oldBody, body);
  return { items: actionHeadings, position };
}
function load(markdown, title, sourceUrl, label) {
  clearTimeout(renderTimer);
  renderTimer = null;
  editor.value = markdown;
  previewSource = null;
  $("markdown-preview").replaceChildren();
  baseline = markdown;
  currentTitle =
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "output";
  $("output-title").textContent = title;
  const link = $("output-source-link");
  link.hidden = !sourceUrl;
  if (sourceUrl) {
    link.textContent = sourceUrl;
    link.href = sourceUrl;
  } else link.removeAttribute("href");
  origin = label;
  $("result-warning").hidden = true;
  view("source", false);
  outputCard.hidden = false;
  renderResult();
}
urlInput.addEventListener("input", () => {
  $("clear-btn").hidden = !urlInput.value;
});
$("clear-btn").addEventListener("click", () => {
  urlInput.value = "";
  $("clear-btn").hidden = true;
  urlInput.focus();
});
editor.addEventListener("input", () => {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderTimer = null;
    renderResult();
  }, 250);
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!mayReplace()) return;
  const convertBtn = $("convert-btn");
  convertBtn.disabled = true;
  for (const id of [
    "front-matter",
    "mode-select",
    "images-select",
    "links-select",
    "url-input",
  ])
    $(id).disabled = true;
  convertBtn.querySelector(".btn-label").hidden = true;
  convertBtn.querySelector(".btn-spinner").hidden = false;
  status("loading", "Fetching and converting this page…");
  try {
    const response = await fetch("/api/convert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: urlInput.value.trim(),
        mode: $("mode-select").value,
        frontMatter: $("front-matter").checked,
        images: $("images-select").value,
        links: $("links-select").value,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Conversion failed.");
    load(
      result.markdown,
      result.title,
      result.url,
      result.extractionMode === "body"
        ? "Body fallback"
        : result.extractionMode === "full"
          ? "Full page"
          : "Article",
    );
    $("result-warning").textContent = (result.warnings || []).join(" ");
    $("result-warning").hidden = !result.warnings?.length;
    status(
      "success",
      "Converted. You can edit the Markdown before copying or saving.",
    );
  } catch (error) {
    status("error", error.message || "Conversion failed.");
  } finally {
    convertBtn.disabled = false;
    for (const id of [
      "front-matter",
      "mode-select",
      "images-select",
      "links-select",
      "url-input",
    ])
      $(id).disabled = false;
    convertBtn.querySelector(".btn-label").hidden = false;
    convertBtn.querySelector(".btn-spinner").hidden = true;
  }
});
$("open-btn").addEventListener("click", () => {
  if (mayReplace()) $("open-file").click();
});
$("open-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!/\.md$/i.test(file.name)) return status("error", "Choose a .md file.");
  if (!file.size) return status("error", "The Markdown file is empty.");
  if (file.size > 2_000_000)
    return status("error", "The Markdown file exceeds the 2 MB limit.");
  try {
    const markdown = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
    if (!markdown.trim() || markdown.includes("\0")) throw new Error("invalid");
    load(markdown, file.name.replace(/\.md$/i, ""), "", "Local file");
    status("success", "Markdown file opened locally.");
  } catch {
    status("error", "Could not read this file as UTF-8 Markdown.");
  }
});
$("copy-btn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(editor.value);
    status("success", "Markdown copied.");
  } catch {
    status(
      "error",
      "Clipboard access failed. Select and copy the Markdown instead.",
    );
  }
});
$("download-btn").addEventListener("click", async () => {
  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: `${currentTitle}.md`,
        types: [
          { description: "Markdown", accept: { "text/markdown": [".md"] } },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(editor.value);
      await writable.close();
    } else {
      const url = URL.createObjectURL(
        new Blob([editor.value], { type: "text/markdown" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${currentTitle}.md`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    baseline = editor.value;
    status("success", "Markdown saved.");
  } catch (error) {
    if (error.name !== "AbortError")
      status("error", "Could not save the file.");
  }
});
window.addEventListener("beforeunload", (event) => {
  if (changed()) event.preventDefault();
});
