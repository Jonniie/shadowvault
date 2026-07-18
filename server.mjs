import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dirname, 'dashboard.html'), 'utf-8');
const CONTRACT_ADDRESS = process.env['CONTRACT_ADDRESS'];
const TOKEN_COLOR = process.env['TOKEN_COLOR'] || '';
if (!CONTRACT_ADDRESS) throw new Error('Set CONTRACT_ADDRESS');

function runScript(script, extraEnv = {}) {
  return execSync(`npx tsx src/${script}`, {
    cwd: __dirname,
    env: {
      ...process.env,
      CONTRACT_ADDRESS,
      TOKEN_COLOR,
      ...extraEnv,
      MIDNIGHT_NETWORK: 'local',
    },
    encoding: 'utf-8',
    timeout: 60000,
  });
}

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/state') {
    try {
      const result = runScript('status.ts');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e.stderr || e.message) }));
    }
    return;
  }

  if (url.pathname === '/api/withdraw' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { amount } = JSON.parse(body);
        if (!amount || amount <= 0) throw new Error('Invalid amount');
        const result = runScript('withdraw-cli.ts', { AMOUNT: String(amount) });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(result);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: String(e.message || e) }));
      }
    });
    return;
  }

  if (url.pathname === '/api/deposit' && req.method === 'POST') {
    // Deposit is handled at wallet level - we just log it
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { amount } = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          amount: String(amount),
          note: 'Deposit tracked in private state. Send tokens to contract address to complete.',
          timestamp: new Date().toISOString(),
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: String(e.message || e) }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

const PORT = parseInt(process.env['PORT'] ?? '3030');
server.listen(PORT, () => {
  console.log(`\n  🛡️  ShadowVault Live Dashboard`);
  console.log(`  ──────────────────────────────`);
  console.log(`  URL:      http://localhost:${PORT}`);
  console.log(`  Contract: ${CONTRACT_ADDRESS}`);
  console.log(`  Token:    ${TOKEN_COLOR || '(not set)'}\n`);
});
