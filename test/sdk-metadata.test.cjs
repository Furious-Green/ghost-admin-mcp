const {test, after} = require('node:test');
const assert = require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
const {families, backedFamilies, config, timestamp} = require('./helpers/fixtures.cjs');

const sdkFamilies = {...Object.fromEntries(backedFamilies.map(f => [f, families[f]])), pages: {browse: {}, read: {id: 'one'}, add: {title: 'Page'}, edit: {id: 'one', updated_at: timestamp}, delete: {id: 'one'}}};
for (const [family, operations] of Object.entries(sdkFamilies)) for (const [op, args] of Object.entries(operations)) {
  test(`SDK ${family}.${op} has stable operation-specific cardinality with optional response metadata`, async () => {
    const r = makeRecordingClient();
    for (const meta of [undefined, {}, {custom: {nested: [null, 1]}}]) {
      r.enqueueResponse(op === 'delete' ? '' : {[family]: [{id: 'one', meta: 'entity field'}], ...(meta === undefined ? {} : {meta})});
      const result = await r.client[family][op](structuredClone(args));
      assert.deepEqual(result, op === 'delete' ? undefined : {data: op === 'browse' ? [{id: 'one', meta: 'entity field'}] : {id: 'one', meta: 'entity field'}, ...(meta === undefined ? {} : {meta})});
      if (op === 'browse') assert.equal(Object.hasOwn(result.data, 'meta'), false);
    }
    assert.equal(r.requests.length, 3);
  });
}

test('SDK validates raw cardinality and falsey malformed metadata before its transformation hides them', async () => {
  const r = makeRecordingClient();
  for (const meta of [null, false, 0, [], 'SECRET']) {
    r.enqueueResponse({posts: [{id: 'one'}], meta});
    await assert.rejects(r.client.posts.read({id: 'one'}), e => /Unexpected Ghost SDK response/.test(e.message) && !e.message.includes('SECRET'));
  }
  for (const response of [{posts: {}}, {}, {pages: [{}]}, {posts: []}, {posts: [{}, {}]}, {posts: [null]}]) {
    r.enqueueResponse(response);
    await assert.rejects(r.client.posts.edit({id: 'one', updated_at: timestamp}), /Unexpected Ghost SDK response/);
  }
  for (const posts of [[], [{id: 'one'}], [{id: 'one'}, {id: 'two'}]]) {
    r.enqueueResponse({posts});
    assert.deepEqual(await r.client.posts.browse({}), {data: posts});
  }
  assert.equal(r.requests.length, 14);
});

function deferredClient() {
  const pending = [];
  const client = require('../build/client/sdkAdapter.js').createGhostClient(config, {makeRequest: request => new Promise((resolve, reject) => pending.push({request, resolve, reject}))});
  return {client, pending};
}
test('out-of-order same-resource operations retain invocation-local data and metadata', async () => {
  const {client, pending} = deferredClient();
  const read = client.posts.read({id: 'read'});
  const browse = client.posts.browse({page: 2});
  const edit = client.posts.edit({id: 'edit', updated_at: timestamp});
  assert.equal(pending.length, 3);
  pending[2].resolve({posts: [{id: 'edit'}], meta: {owner: 'edit'}});
  assert.deepEqual(await edit, {data: {id: 'edit'}, meta: {owner: 'edit'}});
  pending[1].resolve({posts: [{id: 'browse'}], meta: {owner: 'browse'}});
  assert.deepEqual(await browse, {data: [{id: 'browse'}], meta: {owner: 'browse'}});
  pending[0].resolve({posts: [{id: 'read'}], meta: {owner: 'read'}});
  assert.deepEqual(await read, {data: {id: 'read'}, meta: {owner: 'read'}});

  const a = client.posts.read({id: 'a'}), b = client.posts.read({id: 'b'});
  pending[4].resolve({posts: [{id: 'b'}], meta: {owner: 'b'}});
  pending[3].resolve({posts: [{id: 'a'}]});
  assert.deepEqual(await a, {data: {id: 'a'}});
  assert.deepEqual(await b, {data: {id: 'b'}, meta: {owner: 'b'}});
  const failed = client.posts.read({id: 'failed'});
  const rejection = assert.rejects(failed, /fixture failure/);
  pending[5].reject(new Error('fixture failure'));
  await rejection;
  const fresh = client.posts.read({id: 'fresh'});
  pending[6].resolve({posts: [{id: 'fresh'}]});
  assert.deepEqual(await fresh, {data: {id: 'fresh'}});
});

test('overlapping SDK and native requests cannot donate response metadata to one another', async () => {
  const {client, pending} = deferredClient();
  const sdk = client.posts.browse({});
  const native = client.offers.browse({});
  pending[1].resolve({offers: [], meta: {source: 'native'}});
  pending[0].resolve({posts: [], meta: {source: 'sdk'}});
  assert.deepEqual(await sdk, {data: [], meta: {source: 'sdk'}});
  assert.deepEqual(await native, {data: [], meta: {source: 'native'}});
});

test('newsletter mutation metadata preserves returned state instead of asserting sender activation or inferred counts', async () => {
  const r = makeRecordingClient();
  r.enqueueResponse({newsletters: [{id: 'one', sender_email: null}], meta: {sent_email_verification: ['sender_email']}});
  assert.deepEqual(await r.client.newsletters.edit({id: 'one', sender_email: 'new@example.invalid'}), {data: {id: 'one', sender_email: null}, meta: {sent_email_verification: ['sender_email']}});
  assert.deepEqual(r.requests[0].data, {newsletters: [{sender_email: 'new@example.invalid'}]});
  // Opaque test key: generic preservation, not a claim about Ghost's count spelling.
  r.enqueueResponse({newsletters: [{id: 'two'}], meta: {opted_in_member_count: 7}});
  assert.deepEqual(await r.client.newsletters.add({name: 'Second'}), {data: {id: 'two'}, meta: {opted_in_member_count: 7}});
  assert.deepEqual(r.requests[1].params, {});
  assert.equal(r.requests.length, 2);
});

for (const family of ['tiers', 'offers', 'invites', 'roles']) for (const [op, input] of Object.entries(families[family])) {
  if (op === 'delete') continue;
  test(`native ${family}.${op} preserves explicit metadata independently of cardinality`, async () => {
    const r = makeRecordingClient();
    for (const meta of [undefined, {}, {unknown: {next: null}}]) {
      r.enqueueResponse({[family]: [{id: 'one'}], ...(meta === undefined ? {} : {meta})});
      assert.deepEqual(await r.client[family][op](structuredClone(input)), {data: op === 'browse' ? [{id: 'one'}] : {id: 'one'}, ...(meta === undefined ? {} : {meta})});
    }
    assert.equal(r.requests.length, 3);
  });
}
for (const family of ['posts', 'pages']) test(`native ${family}.copy retains metadata without changing entity content`, async () => {
  const r = makeRecordingClient();
  r.enqueueResponse({[family]: [{id: 'copy', meta: {own: true}}], meta: {copy_info: {retained: null}}});
  assert.deepEqual(await r.client[family].copy({id: 'one'}), {data: {id: 'copy', meta: {own: true}}, meta: {copy_info: {retained: null}}});
  r.enqueueResponse({[family]: [{id: 'copy'}], meta: false});
  await assert.rejects(r.client[family].copy({id: 'one'}), {message: 'Unexpected Ghost copy response'});
  assert.equal(r.requests.length, 2);
});
