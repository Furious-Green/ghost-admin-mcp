const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {createHmac} = require('node:crypto');
const {blockNetwork} = require('./helpers/networkGuard.cjs');
after(blockNetwork());
const {config} = require('./helpers/fixtures.cjs');

const operations = [
  ['posts.copy', 'POST', 'posts/one/copy/'], ['pages.copy', 'POST', 'pages/one/copy/'],
  ['tiers.browse', 'GET', 'tiers/'], ['tiers.read', 'GET', 'tiers/one/'],
  ['tiers.add', 'POST', 'tiers/', true], ['tiers.edit', 'PUT', 'tiers/one/', true],
  ['offers.browse', 'GET', 'offers/'], ['offers.read', 'GET', 'offers/one/'],
  ['offers.add', 'POST', 'offers/', true], ['offers.edit', 'PUT', 'offers/one/', true],
  ['invites.browse', 'GET', 'invites/'], ['invites.add', 'POST', 'invites/', true],
  ['invites.delete', 'DELETE', 'invites/one/'], ['roles.browse', 'GET', 'roles/'],
];
for (const [operation, method, path, write] of operations) {
  test(`shared ${operation} confines signed requests to a fixed subdirectory route`, async () => {
    const requests = [];
    const send = require('../build/client/nativeAdmin.js').createNativeAdminRequest({...config, url: 'https://example.invalid/blog'}, async r => {requests.push(r); return {ok: true};});
    const input = {query: {filter: 'active:true'}};
    if (path.includes('/one/')) input.id = 'one';
    if (write) input.body = {[operation.split('.')[0]]: [{name: 'Example'}]};
    assert.deepEqual(await send(operation, input), {ok: true});
    const r = requests[0];
    assert.equal(r.url, `https://example.invalid/blog/ghost/api/admin/${path}`);
    assert.equal(r.method, method);
    assert.deepEqual(r.data, input.body);
    assert.deepEqual(r.params, input.query);
    assert.equal(r.headers.Accept, 'application/json');
    assert.equal(r.headers['Accept-Version'], 'v5.0');
    assert.equal(r.headers['Content-Type'], write ? 'application/json' : undefined);
    const [h, p, s] = r.headers.Authorization.slice(6).split('.');
    assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), {alg: 'HS256', typ: 'JWT', kid: '0'.repeat(24)});
    const claims = JSON.parse(Buffer.from(p, 'base64url'));
    assert.equal(claims.aud, '/admin/');
    assert.equal(claims.exp, claims.iat + 300);
    assert.ok(Math.abs(claims.iat - Date.now()/1000) < 2);
    assert.equal(s, createHmac('sha256', Buffer.from('0'.repeat(64), 'hex')).update(`${h}.${p}`).digest('base64url'));
  });
}

test('native validation rejects unsafe config, selectors, operations and body policies before HTTP', async () => {
  let requests = 0;
  const {createNativeAdminRequest} = require('../build/client/nativeAdmin.js');
  const make = overrides => createNativeAdminRequest({...config, ...overrides}, async () => {requests++;});
  for (const url of ['https://user:pass@example.invalid', 'https://example.invalid/', 'https://example.invalid?x=1', 'https://example.invalid#x', 'file:///etc/passwd']) {
    await assert.rejects(make({url})('tiers.read', {id: 'one'}), /Invalid Ghost/);
  }
  for (const version of ['v4.0', 'canary']) await assert.rejects(make({version})('roles.browse'), /version/);
  await assert.rejects(make({key: 'secret'})('roles.browse'), /key/);
  for (const id of ['', ' ', '.', '..', '../posts/victim', 'a/b', 'a\\b', '%2f', 'a?x', 'a#x', '\u0000', '\ud800', undefined]) {
    await assert.rejects(make()('invites.delete', {id}), /id/);
  }
  for (const op of ['tiers.delete', 'offers.delete', 'roles.read', '__proto__', 'toString', 'https://evil.invalid']) await assert.rejects(make()(op), /operation/);
  for (const op of ['posts.copy', 'tiers.browse', 'invites.delete']) await assert.rejects(make()(op, {id: 'one', body: {secret: true}}), /body/);
  assert.equal(requests, 0);
});

test('native selectors are encoded once and errors never reflect upstream diagnostics', async () => {
  const {createNativeAdminRequest} = require('../build/client/nativeAdmin.js');
  let url;
  await createNativeAdminRequest(config, async r => {url = r.url;})('tiers.read', {id: 'café space'});
  assert.equal(url, `${config.url}/ghost/api/admin/tiers/caf%C3%A9%20space/`);
  for (const status of [403, 404, 409, 500, undefined]) {
    let attempts = 0;
    const send = createNativeAdminRequest(config, async () => {attempts++; throw {message: 'SECRET', config: 'SECRET', response: {status, data: {errors: [{type: 'SECRET', message: 'SECRET'}]}}};});
    await assert.rejects(send('offers.edit', {id: 'one', body: {offers: [{}]}}), error => {
      assert.equal(error.message, status ? `Ghost offers edit failed (HTTP ${status}).` : 'Ghost offers edit request failed.');
      assert.equal(error.statusCode, status);
      assert.equal(JSON.stringify(error).includes('SECRET'), false);
      assert.equal(error.stack.includes('SECRET'), false);
      for (const key of ['config', 'request', 'response', 'cause']) assert.equal(error[key], undefined);
      return true;
    });
    assert.equal(attempts, 1);
  }
});
