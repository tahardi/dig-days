import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testdata = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'api', 'testdata');
const read = (name) => readFileSync(join(testdata, name), 'utf8');

const routes = {
  'GET /health': 'health-response.json',
  'POST /process': 'process-response-existing.json',
};

createServer((req, res) => {
  const file = routes[`${req.method} ${req.url}`];
  const authorized = req.headers.authorization === 'Bearer e2e-key';
  res.setHeader('Content-Type', 'application/json');
  if (!file || !authorized) {
    res.statusCode = 401;
    res.end(read('error-unauthorized.json'));
    return;
  }
  res.end(read(file));
}).listen(8787, '127.0.0.1');
