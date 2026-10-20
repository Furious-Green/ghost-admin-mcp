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

test('shared native core serializes JSON PUT and bodyless DELETE over actual HTTP', async t => {
  const f = await fixture(t, (req, res) => req.method === 'DELETE' ? res.writeHead(204).end() : res.setHeader('Content-Type', 'application/json').end('{"tiers":[{"id":"one"}]}'));
  const send = require('../build/client/nativeAdmin.js').createNativeAdminRequest({...config, url: f.url});
  assert.deepEqual(await send('tiers.edit', {id: 'one', body: {tiers: [{active: false}]}}), {tiers: [{id: 'one'}]});
  await send('invites.delete', {id: 'one'});
  assert.equal(f.requests[0].body, '{"tiers":[{"active":false}]}');
  assert.equal(f.requests[0].headers['content-type'], 'application/json');
  assert.equal(f.requests[1].body, '');
  assert.equal(f.requests[1].method, 'DELETE');
});

test('commerce HTTP serializes nested tier, confines Unicode edit IDs and never retries mutation failures', async t => {
  const f = await fixture(t, (req, res) => {
    if (req.method === 'POST') res.setHeader('Content-Type', 'application/json').end('{"offers":[{"id":"sale"}]}');
    else res.writeHead(409, {'Content-Type': 'application/json'}).end(JSON.stringify({errors: [{type: 'ConflictError', message: config.key}]}));
  });
  const c = client(f.url + '/blog');
  assert.deepEqual(await c.offers.add({name: 'Sale', code: 'sale', cadence: 'month', duration: 'once', amount: 10, tier_id: 'tier1', type: 'percent'}), {id: 'sale'});
  assert.deepEqual(JSON.parse(f.requests[0].body).offers[0].tier, {id: 'tier1'});
  assert.equal(JSON.parse(f.requests[0].body).offers[0].tier_id, undefined);
  await assert.rejects(c.tiers.edit({id: 'café space', active: false}), {message: 'Ghost tiers edit failed (HTTP 409).'});
  assert.equal(f.requests[1].url, '/blog/ghost/api/admin/tiers/caf%C3%A9%20space/');
  assert.equal(f.requests[1].body, '{"tiers":[{"active":false}]}');
  assert.equal(f.requests.length, 2);
  await assert.rejects(c.tiers.edit({id: '../posts/x', active: false}), /Invalid Ghost/);
  assert.equal(f.requests.length, 2);
});

test('staff HTTP sends only native invite JSON, deletes without body and forwards assignable-role query', async t => {
  const f = await fixture(t, (req, res) => {
    if (req.method === 'DELETE') res.writeHead(204).end();
    else res.setHeader('Content-Type', 'application/json').end(req.url.startsWith('/ghost/api/admin/roles/') ? '{"roles":[{"id":"role1"}]}' : '{"invites":[{"id":"invite1"}]}');
  });
  const c = client(f.url);
  assert.deepEqual(await c.invites.add({role_id: 'role1', email: 'staff@example.invalid'}), {id: 'invite1'});
  assert.equal(await c.invites.delete({id: 'invite1'}), undefined);
  assert.deepEqual(await c.roles.browse({permissions: 'assign'}), [{id: 'role1'}]);
  assert.deepEqual(JSON.parse(f.requests[0].body), {invites: [{role_id: 'role1', email: 'staff@example.invalid'}]});
  assert.equal(f.requests[0].headers['content-type'], 'application/json');
  assert.equal(f.requests[1].url, '/ghost/api/admin/invites/invite1/');
  assert.equal(f.requests[1].body, '');
  assert.equal(f.requests[1].method, 'DELETE');
  assert.equal(f.requests[2].url, '/ghost/api/admin/roles/?permissions=assign');
  assert.equal(f.requests.length, 3);
});

test('staff HTTP permission failures discard echoed credentials and explain staff permissions', async t => {
  const f = await fixture(t, (_req, res) => res.writeHead(403, {'Content-Type': 'application/json'}).end(JSON.stringify({errors: [{type: 'NoPermissionError', message: config.key}]})));
  await assert.rejects(client(f.url).invites.add({role_id: 'role1', email: 'staff@example.invalid'}), e => {
    assert.match(e.message, /staff access token with sufficient permissions/);
    assert.equal(e.stack.includes(config.key), false);
    assert.equal(e.config, undefined);
    assert.equal(e.response, undefined);
    return true;
  });
  assert.equal(f.requests.length, 1);
});

test('staff HTTP refuses redirects and does not repeat a timed-out invitation', async t => {
  const target = await fixture(t, (_req, res) => res.end('{}'));
  const source = await fixture(t, (_req, res) => res.writeHead(307, {Location: target.url}).end());
  await assert.rejects(client(source.url).invites.add({role_id: 'role1', email: 'staff@example.invalid'}), /HTTP 307/);
  assert.equal(source.requests.length, 1);
  assert.equal(target.requests.length, 0);
  const slow = await fixture(t, () => {});
  const executor = require('../build/client/nativeRequest.js').createNativeRequestExecutor({timeoutMs: 50});
  await assert.rejects(client(slow.url, executor).invites.add({role_id: 'role1', email: 'staff@example.invalid'}), /request failed/);
  assert.equal(slow.requests.length, 1);
});

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

test('SDK-backed page tools confine actual HTTP routes and reject traversal before transport', {timeout: 10000}, async t => {
  const f = await fixture(t, (req, res) => {
    if (req.method === 'DELETE') res.writeHead(204).end();
    else res.setHeader('Content-Type', 'application/json').end(JSON.stringify({pages: [{id: 'abc123'}]}));
  });
  const {openMcpHarness} = require('./helpers/mcpHarness.cjs');
  const mcp = await openMcpHarness(client(f.url));
  t.after(mcp.close);
  for (const [name, args] of [
    ['pages_delete', {id: '../posts/victim'}], ['pages_edit', {id: '../posts/victim', updated_at: '2026-10-20T00:00:00.000Z'}],
    ['pages_read', {slug: '%2e%2e/posts/victim'}],
  ]) await assert.rejects(mcp.mcpClient.callTool({name, arguments: args}), /Invalid arguments/);
  assert.equal(f.requests.length, 0);
  await mcp.mcpClient.callTool({name: 'pages_read', arguments: {slug: 'über uns'}});
  await mcp.mcpClient.callTool({name: 'pages_delete', arguments: {id: 'abc123'}});
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[0].url, '/ghost/api/admin/pages/slug/%C3%BCber%20uns/');
  assert.equal(f.requests[1].url, '/ghost/api/admin/pages/abc123/');
  assert.equal(f.requests[1].method, 'DELETE');
});
