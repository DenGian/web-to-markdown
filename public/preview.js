// A deliberately small Markdown preview. All input is escaped before formatting;
// only HTTP(S) links and images become clickable elements.
const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function safeUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.href) : null; }
  catch { return null; }
}
function inline(value) {
  let result = escapeHtml(value);
  result = result.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_match, alt, url) => safeUrl(url) ? `<img src="${safeUrl(url)}" alt="${alt}">` : alt);
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => safeUrl(url) ? `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label);
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return result;
}
export function renderPreview(markdown) {
  const lines = markdown.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n');
  const out = [];
  let code = false;
  let list = false;
  for (const line of lines) {
    if (/^`{3,}/.test(line)) { if (list) { out.push('</ul>'); list = false; } out.push(code ? '</code></pre>' : '<pre><code>'); code = !code; continue; }
    if (code) { out.push(`${escapeHtml(line)}\n`); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) { if (list) { out.push('</ul>'); list = false; } const n = heading[1].length; out.push(`<h${n}>${inline(heading[2])}</h${n}>`); continue; }
    const item = line.match(/^[-*]\s+(.+)/);
    if (item) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(item[1])}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  if (code) out.push('</code></pre>');
  return out.join('');
}
