const {spawn} = require('node:child_process');
const {once} = require('node:events');
const http = require('node:http');
const readline = require('node:readline');
const path = require('node:path');
const {config} = require('./fixtures.cjs');

exports.startCli = async function startCli(t, {cwd = path.resolve(__dirname, '../..')} = {}) {
  const requests = [];
  const httpServer = http.createServer((request, response) => {
    requests.push({url: request.url, method: request.method});
    response.writeHead(503).end('No Ghost requests are allowed in discovery tests');
  });
  t.after(() => new Promise(resolve => {
    httpServer.closeAllConnections();
    httpServer.close(resolve);
  }));
  httpServer.listen(0, '127.0.0.1');
  await once(httpServer, 'listening');

  const child = spawn(process.execPath, ['--require', path.join(__dirname, 'blockNetworkPreload.cjs'), 'build/server.js'], {
    cwd,
    env: {PATH: process.env.PATH, GHOST_API_URL: `http://127.0.0.1:${httpServer.address().port}`, GHOST_ADMIN_API_KEY: config.key, GHOST_API_VERSION: 'v5.0'},
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  const pending = new Map();
  const messages = [];
  let fatal;
  let nextId = 0;
  const fail = error => {
    fatal = error;
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(error);
    }
    pending.clear();
  };
  const closed = new Promise(resolve => child.once('close', (code, signal) => {
    fail(new Error(`CLI closed: ${code ?? signal}`));
    resolve();
  }));
  child.on('error', fail);
  child.stdin.on('error', fail);
  const reader = readline.createInterface({input: child.stdout});
  reader.on('line', line => {
    try {
      const message = JSON.parse(line);
      if (message.jsonrpc !== '2.0') throw new Error('Non-protocol stdout');
      messages.push(message);
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      clearTimeout(item.timer);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result);
    } catch (error) {
      fail(error);
    }
  });
  let stopping;
  const stop = () => {
    if (stopping) return stopping;
    stopping = (async () => {
      child.stdin.end();
      const forceStop = setTimeout(() => child.kill('SIGKILL'), 1000);
      try { await closed; }
      finally {
        clearTimeout(forceStop);
        reader.close();
        httpServer.closeAllConnections();
        await new Promise(resolve => httpServer.close(resolve));
      }
    })();
    return stopping;
  };
  t.after(stop);

  const request = (method, params) => {
    if (fatal) return Promise.reject(fatal);
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 3000);
      pending.set(id, {resolve, reject, timer});
      child.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n');
    });
  };
  const notify = method => child.stdin.write(JSON.stringify({jsonrpc: '2.0', method}) + '\n');
  return {child, reader, httpServer, requests, messages, request, notify, stop, stderr: () => stderr};
};
