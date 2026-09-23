// Run browser.mjs against the self-hosted single-file production artifact.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const artifact = resolve(fileURLToPath(new URL('../dist/index.html', import.meta.url)));
const html = await readFile(artifact);
const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
});
await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
try {
    process.env.ARTIFACT = '1';
    process.env.CARD_URL = `http://127.0.0.1:${server.address().port}/`;
    await import('./browser.mjs');
} finally {
    await new Promise(done => server.close(done));
}
