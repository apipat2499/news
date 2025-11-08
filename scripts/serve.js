import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

const __dirname = fileURLToPath(new URL('..', import.meta.url));

function resolvePath(requestPath) {
  const trimmed = requestPath.split('?')[0];
  if (trimmed === '/' || trimmed === '') {
    return join(__dirname, 'index.html');
  }
  return join(__dirname, trimmed);
}

const server = createServer(async (req, res) => {
  try {
    const filePath = resolvePath(req.url ?? '/');
    const data = await readFile(filePath);
    const ext = extname(filePath);
    const type = MIME_TYPES[ext] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal server error');
  }
});

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
server.listen(port, () => {
  console.log(`Serving static files at http://localhost:${port}`);
});
