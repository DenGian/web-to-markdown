import { renderPreview } from './preview.js';

const $ = (id) => document.getElementById(id);
const form = $('convert-form');
const urlInput = $('url-input');
const clearBtn = $('clear-btn');
const convertBtn = $('convert-btn');
const statusBanner = $('status-banner');
const outputCard = $('output-card');
const editor = $('markdown-output');
let currentTitle = 'output';

urlInput.addEventListener('input', () => { clearBtn.hidden = !urlInput.value; });
clearBtn.addEventListener('click', () => { urlInput.value = ''; clearBtn.hidden = true; urlInput.focus(); });
editor.addEventListener('input', () => { $('markdown-preview').innerHTML = renderPreview(editor.value); });
function status(type, message) {
  statusBanner.hidden = false;
  statusBanner.className = `status-banner status-${type}`;
  $('status-icon').textContent = type === 'error' ? '!' : type === 'loading' ? '…' : '✓';
  $('status-message').textContent = message;
}
function tab(which) {
  const source = which === 'source';
  $('tab-source').classList.toggle('tab-active', source);
  $('tab-preview').classList.toggle('tab-active', !source);
  $('tab-source').setAttribute('aria-selected', String(source));
  $('tab-preview').setAttribute('aria-selected', String(!source));
  $('panel-source').hidden = !source;
  $('panel-preview').hidden = source;
  (source ? $('tab-source') : $('tab-preview')).focus();
}
$('tab-source').addEventListener('click', () => tab('source'));
$('tab-preview').addEventListener('click', () => tab('preview'));
for (const id of ['tab-source', 'tab-preview']) {
  $(id).addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      tab(id === 'tab-source' ? 'preview' : 'source');
    }
  });
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  outputCard.hidden = true;
  convertBtn.disabled = true;
  $('front-matter').disabled = true;
  $('mode-select').disabled = true;
  $('url-input').disabled = true;
  convertBtn.querySelector('.btn-label').hidden = true;
  convertBtn.querySelector('.btn-spinner').hidden = false;
  status('loading', 'Fetching and converting this page…');
  try {
    const response = await fetch('/api/convert', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: urlInput.value.trim(), mode: $('mode-select').value, frontMatter: $('front-matter').checked }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Conversion failed.');
    currentTitle = (result.title || 'output').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'output';
    $('output-title').textContent = result.title;
    $('output-source-link').textContent = result.url;
    $('output-source-link').href = result.url;
    editor.value = result.markdown;
    $('markdown-preview').innerHTML = renderPreview(editor.value);
    tab('source');
    outputCard.hidden = false;
    status('success', 'Converted. You can edit the Markdown before copying or saving.');
  } catch (error) { status('error', error.message || 'Conversion failed.'); }
  finally {
    convertBtn.disabled = false;
    $('front-matter').disabled = false;
    $('mode-select').disabled = false;
    $('url-input').disabled = false;
    convertBtn.querySelector('.btn-label').hidden = false;
    convertBtn.querySelector('.btn-spinner').hidden = true;
  }
});
$('copy-btn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(editor.value); status('success', 'Edited Markdown copied.'); }
  catch { status('error', 'Clipboard access failed. Select and copy the Markdown instead.'); }
});
$('download-btn').addEventListener('click', async () => {
  const name = `${currentTitle}.md`;
  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }] });
      const writable = await handle.createWritable();
      await writable.write(editor.value);
      await writable.close();
    } else {
      const url = URL.createObjectURL(new Blob([editor.value], { type: 'text/markdown' }));
      const link = document.createElement('a'); link.href = url; link.download = name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    status('success', 'Markdown saved.');
  } catch (error) { if (error.name !== 'AbortError') status('error', 'Could not save the file.'); }
});
