const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {createHmac} = require('node:crypto');
const {blockNetwork} = require('./helpers/networkGuard.cjs');
after(blockNetwork());
const {config} = require('./helpers/fixtures.cjs');

function recording(overrides = {}, response = {pages: [{id: 'copy1', custom: {retained: true}}]}) {
  const requests = [];
  const copy = require('../build/client/nativeCopy.js').createNativeCopy({...config, ...overrides}, async request => {
    requests.push(structuredClone(request));
    if (response instanceof Error) throw response;
    return response;
  });
  return {copy, requests};
}

for (const resource of ['posts', 'pages']) {
  test(`native ${resource} copy uses fixed routes and independently verifiable authentication`, async () => {
    const {copy, requests} = recording({}, {[resource]: [{id: 'copy1', custom: {retained: true}}]});
    const start = Math.floor(Date.now() / 1000);
    for (const input of [{id: 'abc123', formats: 'html,lexical'}, {id: 'abc123'}]) {
      assert.deepEqual(await copy(resource, input), {id: 'copy1', custom: {retained: true}});
    }
    assert.equal(requests.length, 2);
    for (const [index, request] of requests.entries()) {
      assert.equal(request.url, `${config.url}/ghost/api/admin/${resource}/abc123/copy/`);
      assert.equal(request.method, 'POST');
      assert.equal(request.data, undefined);
      assert.deepEqual(request.params, index === 0 ? {formats: 'html,lexical'} : {});
      assert.equal(request.headers['Accept-Version'], 'v5.0');
      assert.equal(request.headers.Accept, 'application/json');
      const token = request.headers.Authorization.replace(/^Ghost /, '');
      const [header, payload, signature] = token.split('.');
      assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), {alg: 'HS256', typ: 'JWT', kid: '0'.repeat(24)});
      const claims = JSON.parse(Buffer.from(payload, 'base64url'));
      assert.equal(claims.aud, '/admin/');
      assert.equal(Number.isInteger(claims.iat), true);
      assert.ok(claims.iat >= start && claims.iat <= Math.floor(Date.now() / 1000));
      assert.equal(claims.exp, claims.iat + 300);
      assert.equal(signature, createHmac('sha256', Buffer.alloc(32)).update(`${header}.${payload}`).digest('base64url'));
    }
  });
}

test('copy preserves site subdirectory and encodes a single identifier segment', async () => {
  const {copy, requests} = recording({url: 'https://example.invalid/blog'});
  await copy('pages', {id: 'abc123'});
  await copy('pages', {id: 'some id'});
  assert.equal(requests[0].url, 'https://example.invalid/blog/ghost/api/admin/pages/abc123/copy/');
  assert.equal(requests[1].url, 'https://example.invalid/blog/ghost/api/admin/pages/some%20id/copy/');
});

for (const id of ['', ' ', '.', '..', '../abc', 'a/b', 'a\\b', 'a?x=y', 'a#frag', 'a\n', '%2e%2e', 'a\x7f']) {
  test(`copy rejects unsafe identifier ${JSON.stringify(id)} before HTTP`, async () => {
    const {copy, requests} = recording();
    await assert.rejects(copy('pages', {id}), {message: 'Invalid Ghost copy id.'});
    assert.equal(requests.length, 0);
  });
}
for (const overrides of [
  {url: 'https://user:secret@example.invalid'}, {url: 'https://example.invalid?secret=x'},
  {url: 'https://example.invalid#fragment'}, {url: 'file:///etc/passwd'}, {url: 'https://example.invalid/'},
  {key: 'prefix' + config.key}, {key: config.key + 'suffix'}, {version: 'v4.0'}, {version: 'canary'},
]) {
  test(`copy rejects invalid ${Object.keys(overrides)[0]} without reflecting it`, async () => {
    const {copy, requests} = recording(overrides);
    await assert.rejects(copy('pages', {id: 'abc123'}), {message: `Invalid Ghost copy ${Object.keys(overrides)[0]}.`});
    assert.equal(requests.length, 0);
  });
}
for (const version of ['v5', 'v5.0', 'v6.0']) {
  test(`copy normalizes supported version ${version}`, async () => {
    const {copy, requests} = recording({version});
    await copy('pages', {id: 'abc123'});
    assert.equal(requests[0].headers['Accept-Version'], version === 'v5' ? 'v5.0' : version);
  });
}
test('copy rejects invalid resource and formats without HTTP', async () => {
  const {copy, requests} = recording();
  await assert.rejects(copy('members', {id: 'abc123'}), /Invalid Ghost copy resource/);
  await assert.rejects(copy('pages', {id: 'abc123', formats: 'plaintext'}), /Invalid Ghost copy formats/);
  assert.equal(requests.length, 0);
});

for (const response of [undefined, null, {}, {posts: [{id: 'x'}]}, {pages: []}, {pages: [{id: 'a'}, {id: 'b'}]}, {pages: [null]}, {pages: ['abc']}, {pages: [[{}]]}]) {
  test(`copy rejects malformed response ${JSON.stringify(response)}`, async () => {
    const r = recording({}, response === undefined ? null : response);
    await assert.rejects(r.copy('pages', {id: 'abc123'}), {message: 'Unexpected Ghost copy response'});
    assert.equal(r.requests.length, 1);
  });
}
for (const status of [403, 404, 409, 500, undefined]) {
  test(`copy strips diagnostics and never retries status ${status}`, async () => {
    const error = Object.assign(new Error(`secret ${config.key}`), {
      config: {key: config.key}, request: {headers: {Authorization: 'Ghost secret-token'}},
      response: {status, data: {errors: [{type: 'NoPermissionError', message: config.key, context: 'Ghost secret-token'}]}},
    });
    const {copy, requests} = recording({}, error);
    await assert.rejects(copy('pages', {id: 'abc123'}), safe => {
      assert.equal(safe.message, status ? `Ghost pages copy failed (HTTP ${status}).` : 'Ghost pages copy request failed.');
      for (const key of ['request', 'config', 'response', 'cause']) assert.equal(safe[key], undefined);
      assert.ok(!JSON.stringify(safe).includes(config.key));
      assert.ok(!safe.stack.includes('secret-token'));
      if (status) assert.equal(safe.statusCode, status);
      return true;
    });
    assert.equal(requests.length, 1);
  });
}

test('copy composition shares the configured executor without changing SDK read behavior', async () => {
  const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
  const {client, enqueueResponse, requests} = makeRecordingClient();
  enqueueResponse({posts: [{id: 'copy1'}]});
  await client.posts.copy({id: 'abc123'});
  enqueueResponse({pages: [{id: 'copy2'}]});
  await client.pages.copy({id: 'abc123'});
  await client.posts.read({id: 'abc123'});
  assert.equal(requests.length, 3);
  assert.equal(requests[0].url, `${config.url}/ghost/api/admin/posts/abc123/copy/`);
  assert.equal(requests[1].url, `${config.url}/ghost/api/admin/pages/abc123/copy/`);
  assert.equal(requests[2].method, 'GET');
});
