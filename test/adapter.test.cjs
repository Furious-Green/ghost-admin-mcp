const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {blockNetwork} = require('./helpers/networkGuard.cjs');
after(blockNetwork());
const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
const {config, families, backedFamilies, entity, pagination, timestamp, permissionError} = require('./helpers/fixtures.cjs');

for (const [family, operations] of Object.entries(families)) {
  // Native contracts are covered separately, not as SDK capabilities.
  if (!backedFamilies.includes(family)) continue;
  for (const [operation, args] of Object.entries(operations)) {
    test(`adapter ${family}.${operation}: maps real SDK request`, async () => {
      const recording = makeRecordingClient();
      recording.enqueueResponse(operation === 'delete' ? undefined : {[family]: [entity]});
      const result = await recording.client[family][operation](structuredClone(args));
      assert.equal(recording.requests.length, 1);
      const request = recording.requests[0];
      assert.equal(request.url, `${config.url}/ghost/api/admin/${family}/${['read', 'edit', 'delete'].includes(operation) ? 'abc123/' : ''}`);
      assert.equal(request.method, {browse: 'GET', read: 'GET', add: 'POST', edit: 'PUT', delete: 'DELETE'}[operation]);
      assert.deepEqual(request.params, {});
      const withoutId = {...args};
      delete withoutId.id;
      const expectedBody = {browse: '', read: '', add: {[family]: args}, edit: {[family]: withoutId}, delete: args}[operation];
      // Write endpoints wrap a single resource in an array, not an object.
      if (operation === 'add' || operation === 'edit') expectedBody[family] = [expectedBody[family]];
      assert.deepEqual(request.data, expectedBody);
      assert.equal(request.headers['Accept-Version'], 'v5.0');
      assert.match(request.headers.Authorization, /^Ghost [^.]+\.[^.]+\.[^.]+$/);
      assert.ok(!JSON.stringify(result)?.includes(config.key));
      assert.deepEqual(result, operation === 'delete' ? undefined : {data: operation === 'browse' ? [entity] : entity});
    });
  }
}

test('adapter forwards selectors, query options and paginated array metadata', async () => {
  const {client, requests, enqueueResponse} = makeRecordingClient();
  enqueueResponse({posts: [entity], meta: {pagination}});
  const result = await client.posts.browse({page: 1, limit: 15, filter: 'status:draft', order: 'updated_at desc'});
  assert.deepEqual(result.meta, {pagination});
  assert.deepEqual(requests[0].params, {page: 1, limit: 15, filter: 'status:draft', order: 'updated_at desc'});
  await client.posts.read({slug: 'example'}, {formats: 'html,lexical'});
  assert.equal(requests[1].url, `${config.url}/ghost/api/admin/posts/slug/example/`);
  assert.deepEqual(requests[1].params, {formats: 'html,lexical'});
  await client.members.read({email: 'member@example.invalid'});
  assert.equal(requests[2].url, `${config.url}/ghost/api/admin/members/email/member@example.invalid/`);
});

test('adapter preserves HTML source and concurrency on repeated edits with fresh input', async () => {
  const {client, requests} = makeRecordingClient();
  for (let i = 0; i < 2; i++) {
    await client.posts.edit({id: 'abc123', updated_at: timestamp, html: '<p>Changed</p>'}, {source: 'html'});
    assert.deepEqual(requests[i].params, {source: 'html'});
    assert.deepEqual(requests[i].data, {posts: [{updated_at: timestamp, html: '<p>Changed</p>'}]});
  }
});

test('adapter permission errors retain safe diagnostics without requests/secrets or retries', async () => {
  const {client, requests, enqueueError} = makeRecordingClient();
  enqueueError(permissionError());
  await assert.rejects(client.posts.add({title: 'Example'}), error => {
    assert.equal(error.message, 'Permission denied');
    assert.equal(error.name, 'NoPermissionError');
    assert.equal(error.request, undefined);
    assert.equal(error.config, undefined);
    assert.ok(!JSON.stringify(error).includes(config.key));
    return true;
  });
  assert.equal(requests.length, 1);
});

test('adapter accepts an empty HTTP delete response without inventing an entity', async () => {
  const {client, enqueueResponse, requests} = makeRecordingClient();
  enqueueResponse('');
  assert.equal(await client.posts.delete({id: 'abc123'}), undefined);
  assert.equal(requests.length, 1);
});

test('adapter validates unknown SDK results without projecting entity fields', async () => {
  const {client, enqueueResponse} = makeRecordingClient();
  enqueueResponse({posts: [{id: 'abc123', custom_property: {nested: 'retained'}}]});
  assert.deepEqual(await client.posts.read({id: 'abc123'}), {data: {id: 'abc123', custom_property: {nested: 'retained'}}});
  enqueueResponse({posts: ['not an entity']});
  await assert.rejects(client.posts.browse({}), /Unexpected Ghost SDK response/);
  enqueueResponse({posts: [], meta: 'not metadata'});
  await assert.rejects(client.posts.browse({}), /Unexpected Ghost SDK response/);
});
