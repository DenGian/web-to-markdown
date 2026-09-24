import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertUrlToMarkdown } from './converter.js';
import { ConversionError, parsePublicUrl } from './security.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_CONCURRENT = 2;
const RATE_WINDOW = 60_000;
const RATE_MAX = 10;

export function createApp(convert = convertUrlToMarkdown) {
  const app = express();
  const clients = new Map();
  let active = 0;
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https: http:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  app.post('/api/convert', async (req, res) => {
    const key = req.ip;
    const now = Date.now();
    if (clients.size > 10000) for (const [ip, record] of clients) if (now - record.start > RATE_WINDOW) clients.delete(ip);
    const record = clients.get(key);
    const count = record && now - record.start < RATE_WINDOW ? record.count + 1 : 1;
    clients.set(key, { start: count === 1 ? now : record.start, count });
    if (count > RATE_MAX) return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
    try {
      parsePublicUrl(req.body?.url);
      if (req.body.mode && !['article', 'full'].includes(req.body.mode) || req.body.frontMatter !== undefined && typeof req.body.frontMatter !== 'boolean') throw new ConversionError('Invalid conversion options.', 400);
      if (active >= MAX_CONCURRENT || process.memoryUsage().rss > 500_000_000) return res.status(503).json({ error: 'The converter is busy. Try again shortly.' });
      active++;
      try {
        const result = await convert(req.body.url, { mode: req.body.mode, frontMatter: req.body.frontMatter });
        return res.json(result);
      } finally { active--; }
    } catch (error) {
      if (!(error instanceof ConversionError)) console.error('Unexpected conversion failure');
      return res.status(error instanceof ConversionError ? error.status : 500).json({ error: error instanceof ConversionError ? error.message : 'Conversion failed. Try another page.' });
    }
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/vendor', express.static(path.join(root, 'public/vendor'), { immutable: true, maxAge: '1d' }));
  app.use(express.static(path.join(root, 'public')));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API endpoint.' }));
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'public/index.html')));
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'Request is too large.' : 'Invalid JSON request.' }));
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => console.log(`Website → Markdown: http://localhost:${port}`));
}
