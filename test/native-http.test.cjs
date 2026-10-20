const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {once} = require('node:events');
const {config} = require('./helpers/fixtures.cjs');
const ports = new Set();
after(require('./helpers/loopbackGuard.cjs').allowLoopback(ports));

async function fixture(t, handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({url: req.url, method: req.method, headers: req.headers, body});
    handler(req, res);
  });
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  ports.add(server.address().port);
  const url = `http://127.0.0.1:${server.address().port}`;
  return {url, requests};
}
function client(url, executor) {
  return require('../build/client/sdkAdapter.js').createGhostClient({...config, url}, executor ? {makeRequest: executor} : {});
}

test('default HTTP copy sends authenticated POST with no body and preserves query/subdirectory', {timeout: 10000}, async t => {
  const f = await fixture(t, (_req, res) => res.setHeader('Content-Type', 'application/json').end(JSON.stringify({pages: [{id: 'copy1'}]})));
  assert.deepEqual(await client(f.url + '/blog').pages.copy({id: 'abc123', formats: 'html,lexical'}), {id: 'copy1'});
  assert.equal(f.requests.length, 1);
  const request = f.requests[0];
  assert.equal(request.method, 'POST');
  const parsed = new URL(request.url, f.url);
  assert.equal(parsed.pathname, '/blog/ghost/api/admin/pages/abc123/copy/');
  assert.equal(parsed.searchParams.get('formats'), 'html,lexical');
  assert.equal(request.body, '');
  assert.equal(request.headers['accept-version'], 'v5.0');
  assert.match(request.headers.authorization, /^Ghost /);
});

for (const status of [302, 307]) {
  test(`copy refuses HTTP ${status} redirects without forwarding authentication`, {timeout: 10000}, async t => {
    const target = await fixture(t, (_req, res) => res.end('{}'));
    const source = await fixture(t, (_req, res) => res.writeHead(status, {Location: target.url}).end());
    await assert.rejects(client(source.url).posts.copy({id: 'abc123'}), {message: `Ghost posts copy failed (HTTP ${status}).`});
    assert.equal(source.requests.length, 1);
    assert.equal(target.requests.length, 0);
  });
}
for (const [status, body] of [[403, JSON.stringify({errors: [{type: 'NoPermissionError', message: config.key}]})], [200, '<html>not JSON</html>'], [201, '{malformed'], [201, JSON.stringify({posts: []})]]) {
  test(`default transport safely rejects status/body ${status} ${body.slice(0, 12)}`, {timeout: 10000}, async t => {
    const f = await fixture(t, (_req, res) => res.writeHead(status, {'Content-Type': 'application/json'}).end(body));
    await assert.rejects(client(f.url).posts.copy({id: 'abc123'}), error => {
      assert.ok(!error.message.includes(config.key));
      assert.equal(error.response, undefined);
      assert.equal(error.config, undefined);
      return true;
    });
    assert.equal(f.requests.length, 1);
  });
}
test('default transport socket failure does not retry or expose diagnostics', {timeout: 10000}, async t => {
  const f = await fixture(t, (req) => req.socket.destroy());
  await assert.rejects(client(f.url).posts.copy({id: 'abc123'}), {message: 'Ghost posts copy request failed.'});
  assert.equal(f.requests.length, 1);
});
test('native timeout fails a possibly accepted mutation exactly once', {timeout: 10000}, async t => {
  const f = await fixture(t, () => {});
  const {createNativeRequestExecutor, NATIVE_REQUEST_TIMEOUT_MS} = require('../build/client/nativeRequest.js');
  assert.equal(NATIVE_REQUEST_TIMEOUT_MS, 30000);
  const start = Date.now();
  await assert.rejects(client(f.url, createNativeRequestExecutor({timeoutMs: 50})).pages.copy({id: 'abc123'}), {message: 'Ghost pages copy request failed.'});
  assert.ok(Date.now() - start < 3000);
  assert.equal(f.requests.length, 1);
  for (const timeoutMs of [0, -1, NaN, Infinity]) assert.throws(() => createNativeRequestExecutor({timeoutMs}), /Invalid native request timeout/);
});
test('loopback guard refuses nonfixture destinations before HTTP', () => {
  assert.throws(() => http.request('http://example.invalid/'), /Unexpected destination/);
  assert.throws(() => http.get('http://127.0.0.1:1/'), /Unexpected destination/);
  assert.throws(() => fetch('http://example.invalid/'), /Unexpected fetch/);
});
