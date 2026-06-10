/**
 * app.js
 *
 * Frontend application logic for the Website → Markdown converter.
 *
 * Responsibilities:
 *   - Handle form submission and drive the convert API call
 *   - Render conversion output (raw Markdown source + rendered preview)
 *   - Tab switching between Source and Preview panels
 *   - Copy-to-clipboard with visual feedback
 *   - "Save as .md" using the File System Access API (showSaveFilePicker),
 *     with a graceful fallback to a standard <a download> if the API isn't
 *     available (e.g. Firefox < 116, or the page isn't on a secure origin).
 *
 * This file is loaded as an ES module (<script type="module">) so top-level
 * await and import syntax are available, but since we have no bundler we keep
 * all logic in this single file rather than splitting across modules.
 */

// ---------------------------------------------------------------------------
// DOM refs — cached at module load time so we don't re-query on every event
// ---------------------------------------------------------------------------

const form         = document.getElementById("convert-form");
const urlInput     = document.getElementById("url-input");
const convertBtn   = document.getElementById("convert-btn");
const btnLabel     = convertBtn.querySelector(".btn-label");
const btnSpinner   = convertBtn.querySelector(".btn-spinner");

const statusBanner  = document.getElementById("status-banner");
const statusIcon    = document.getElementById("status-icon");
const statusMessage = document.getElementById("status-message");

const outputCard    = document.getElementById("output-card");
const outputTitle   = document.getElementById("output-title");
const outputSource  = document.getElementById("output-source-link");

const tabSource    = document.getElementById("tab-source");
const tabPreview   = document.getElementById("tab-preview");
const panelSource  = document.getElementById("panel-source");
const panelPreview = document.getElementById("panel-preview");

const markdownOutput  = document.getElementById("markdown-output");
const markdownPreview = document.getElementById("markdown-preview");

const copyBtn     = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** The last successfully converted Markdown string. Used by copy and download. */
let currentMarkdown = "";

/** Title slug for the default save filename. */
let currentTitle = "output";

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const url = urlInput.value.trim();
  if (!url) return;

  setLoading(true);
  showStatus("loading", "⏳", "Fetching and converting — this may take a few seconds…");
  hideOutput();

  try {
    const result = await fetchConversion(url);

    currentMarkdown = result.markdown;
    currentTitle    = slugify(result.title || "output");

    renderOutput(result);
    showStatus("success", "✅", `Converted "${result.title}" successfully.`);
    showOutput();
  } catch (err) {
    showStatus("error", "❌", err.message || "An unexpected error occurred.");
  } finally {
    setLoading(false);
  }
});

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

/**
 * Calls the backend /api/convert endpoint.
 *
 * Throws a descriptive Error on non-2xx responses so the caller can display
 * it directly in the status banner without any extra parsing.
 *
 * @param {string} url
 * @returns {Promise<{ markdown: string, title: string, byline: string, url: string }>}
 */
async function fetchConversion(url) {
  const response = await fetch("/api/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? `Server error: ${response.status}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Populates the output card with conversion results. */
function renderOutput({ markdown, title, url }) {
  // Truncate long titles for display
  outputTitle.textContent = title || "Untitled";

  outputSource.textContent = url;
  outputSource.href        = url;

  // Always start on the Source tab when showing new content
  switchTab("source");

  markdownOutput.textContent = markdown;

  // Lazily render the preview — we pre-render now so switching tabs is instant
  markdownPreview.innerHTML = window.marked.parse(markdown);
}

// ---------------------------------------------------------------------------
// UI state helpers
// ---------------------------------------------------------------------------

function setLoading(isLoading) {
  convertBtn.disabled = isLoading;
  btnLabel.hidden     = isLoading;
  btnSpinner.hidden   = !isLoading;
  urlInput.disabled   = isLoading;
}

function showStatus(type, icon, message) {
  statusBanner.hidden = false;
  statusBanner.className = `status-banner status-${type}`;
  statusIcon.textContent = icon;
  statusMessage.textContent = message;
}

function showOutput()  { outputCard.hidden = false; }
function hideOutput()  { outputCard.hidden = true; }

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

tabSource.addEventListener("click",  () => switchTab("source"));
tabPreview.addEventListener("click", () => switchTab("preview"));

/**
 * Switches the active tab panel.
 * Using a string discriminator ("source" | "preview") keeps the logic readable
 * without needing a loop over a tab list.
 *
 * @param {"source" | "preview"} which
 */
function switchTab(which) {
  const showSource = which === "source";

  tabSource.classList.toggle("tab-active", showSource);
  tabSource.setAttribute("aria-selected", String(showSource));

  tabPreview.classList.toggle("tab-active", !showSource);
  tabPreview.setAttribute("aria-selected", String(!showSource));

  panelSource.classList.toggle("panel-hidden",  !showSource);
  panelPreview.classList.toggle("panel-hidden",  showSource);
}

// ---------------------------------------------------------------------------
// Copy to clipboard
// ---------------------------------------------------------------------------

copyBtn.addEventListener("click", async () => {
  if (!currentMarkdown) return;

  try {
    await navigator.clipboard.writeText(currentMarkdown);
    flashCopied();
  } catch {
    // Clipboard API can fail if the document isn't focused (e.g. automated tests)
    console.warn("Clipboard write failed; this is usually a browser focus issue.");
  }
});

/** Shows a brief "Copied!" state on the copy button, then reverts. */
function flashCopied() {
  const original = copyBtn.innerHTML;
  copyBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">✅</span> Copied!';
  copyBtn.classList.add("btn-copied");

  setTimeout(() => {
    copyBtn.innerHTML = original;
    copyBtn.classList.remove("btn-copied");
  }, 2000);
}

// ---------------------------------------------------------------------------
// Save as .md (with File System Access API + fallback)
// ---------------------------------------------------------------------------

downloadBtn.addEventListener("click", () => saveMarkdownFile());

/**
 * Saves the current Markdown to a file.
 *
 * Prefers the File System Access API (showSaveFilePicker) so the user can
 * navigate to any folder before saving — this is the "choose destination"
 * experience requested.
 *
 * Falls back to the classic anchor-download trick for browsers that don't
 * support showSaveFilePicker (Firefox < 116, Safari < 17, non-HTTPS).
 */
async function saveMarkdownFile() {
  if (!currentMarkdown) return;

  const filename = `${currentTitle}.md`;

  if (typeof window.showSaveFilePicker === "function") {
    // Modern path: native OS "Save As" dialog with folder picker
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "Markdown file",
            accept: { "text/markdown": [".md"] },
          },
        ],
      });

      const writable = await fileHandle.createWritable();
      await writable.write(currentMarkdown);
      await writable.close();

      return; // Success — nothing more to do
    } catch (err) {
      // AbortError means the user cancelled the dialog — that's fine, not an error
      if (err.name === "AbortError") return;
      // Any other error falls through to the classic download fallback
      console.warn("showSaveFilePicker failed, falling back:", err);
    }
  }

  // Classic fallback: creates a temporary <a> with a blob URL and clicks it.
  // The file lands in the browser's default downloads folder.
  const blob = new Blob([currentMarkdown], { type: "text/markdown" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");

  a.href     = url;
  a.download = filename;
  a.click();

  // Revoke the object URL shortly after to free memory
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Converts a page title to a safe, readable filename slug.
 *
 * e.g. "How to Build a React App | CSS-Tricks" → "how-to-build-a-react-app"
 *
 * @param {string} title
 * @returns {string}
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")  // strip special chars
    .trim()
    .replace(/\s+/g, "-")          // spaces → hyphens
    .replace(/-{2,}/g, "-")        // collapse consecutive hyphens
    .slice(0, 60);                  // cap length for filesystem safety
}
