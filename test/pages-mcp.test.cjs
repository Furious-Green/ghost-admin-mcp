const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {blockNetwork} = require('./helpers/networkGuard.cjs');
after(blockNetwork());
const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
const {openMcpHarness} = require('./helpers/mcpHarness.cjs');
const {config, toolNames, additionalToolNames, entity, timestamp, pagination} = require('./helpers/fixtures.cjs');

async function setup(t) {
  const r = makeRecordingClient();
  const m = await openMcpHarness(r.client);
  t.after(m.close);
  return {...r, ...m, call: (name, args) => m.mcpClient.callTool({name, arguments: structuredClone(args)})};
}
const copied = {id: 'copy1', title: 'Example (Copy)', status: 'draft'};
const cases = [
  {name: 'pages_browse', args: {page: 2, limit: 'all', include: 'tags,authors', fields: 'id,title', formats: 'html,lexical', filter: 'status:draft', order: 'updated_at desc'}, method: 'GET', path: '', query: {page: 2, limit: 'all', include: 'tags,authors', fields: 'id,title', formats: 'html,lexical', filter: 'status:draft', order: 'updated_at desc'}, data: ''},
  {name: 'pages_read', args: {id: 'abc123', include: 'tags', fields: 'id,title', formats: 'lexical'}, method: 'GET', path: 'abc123/', query: {include: 'tags', fields: 'id,title', formats: 'lexical'}, data: ''},
  {name: 'pages_read', args: {slug: 'about', include: 'authors', formats: 'html'}, method: 'GET', path: 'slug/about/', query: {include: 'authors', formats: 'html'}, data: ''},
  {name: 'pages_add', args: {title: 'About', html: '<p>About</p>', custom_template: 'about', include: 'tags', formats: 'html'}, method: 'POST', path: '', query: {source: 'html', include: 'tags', formats: 'html'}, data: {pages: [{title: 'About', html: '<p>About</p>', custom_template: 'about'}]}},
  {name: 'pages_edit', args: {id: 'abc123', updated_at: timestamp, title: 'About us', html: '<p>Changed</p>', include: 'authors'}, method: 'PUT', path: 'abc123/', query: {source: 'html', include: 'authors'}, data: {pages: [{updated_at: timestamp, title: 'About us', html: '<p>Changed</p>'}]}},
  {name: 'pages_delete', args: {id: 'abc123'}, method: 'DELETE', path: 'abc123/', query: {}, data: {id: 'abc123'}},
  {name: 'pages_copy', args: {id: 'abc123', formats: 'lexical'}, method: 'POST', path: 'abc123/copy/', query: {formats: 'lexical'}, data: undefined},
  {name: 'posts_copy', args: {id: 'abc123'}, method: 'POST', path: 'abc123/copy/', query: {}, data: undefined},
];
test('MCP inventory retains supported original tools and exactly seven page/copy additions', async t => {
  const {mcpClient, requests} = await setup(t);
  const names = [];
  let cursor;
  do {
    const page = await mcpClient.listTools(cursor ? {cursor} : {});
    names.push(...page.tools.map(tool => tool.name));
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(names.length, 54);
  assert.deepEqual(names.sort(), [...toolNames, ...additionalToolNames].sort());
  assert.equal(requests.length, 0);
});
for (const [index, c] of cases.entries()) {
  test(`MCP page/copy contract ${index}: ${c.name}`, async t => {
    const {call, requests, enqueueResponse} = await setup(t);
    const resource = c.name.startsWith('posts_') ? 'posts' : 'pages';
    const isCopy = c.name.endsWith('_copy');
    enqueueResponse(c.method === 'DELETE' ? '' : {[resource]: [isCopy ? copied : entity]});
    const result = await call(c.name, c.args);
    assert.notEqual(result.isError, true);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `${config.url}/ghost/api/admin/${resource}/${c.path}`);
    assert.equal(requests[0].method, c.method);
    assert.deepEqual(requests[0].params, c.query);
    assert.deepEqual(requests[0].data, c.data);
    if (c.method === 'DELETE') assert.equal(result.content[0].text, 'Page with id abc123 deleted.');
    else assert.deepEqual(JSON.parse(result.content[0].text), {data: isCopy ? copied : c.name === 'pages_browse' ? [entity] : entity});
  });
}
test('MCP rejects missing/both page selectors before dispatch', async t => {
  const {call, requests} = await setup(t);
  for (const args of [{}, {id: 'abc123', slug: 'about'}]) {
    const result = await call('pages_read', args);
    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, 'Provide exactly one page selector: id or slug.');
  }
  for (const args of [{id: ''}, {slug: ' '}]) await assert.rejects(call('pages_read', args), /Invalid arguments/);
  assert.equal(requests.length, 0);
});
test('MCP validates page pagination, formats and edit timestamp before dispatch', async t => {
  const {call, requests} = await setup(t);
  for (const args of [{page: 0}, {limit: -1}, {limit: 1.5}, {formats: 'unknown'}]) {
    await assert.rejects(call('pages_browse', args), /Invalid arguments/);
  }
  await assert.rejects(call('pages_edit', {id: 'abc123'}), /updated_at/);
  await assert.rejects(call('pages_copy', {id: ''}), /Invalid arguments/);
  await assert.rejects(call('posts_copy', {id: 'abc123', formats: 'unknown'}), /Invalid arguments/);
  for (const id of ['../abc', '%2e%2e', 'abc?other=1']) {
    await assert.rejects(call('pages_copy', {id}), /Invalid arguments/);
  }
  assert.equal(requests.length, 0);
});
test('MCP page writes reject post-only and unknown fields while retaining valid content', async t => {
  const {call, requests} = await setup(t);
  const content = {title: 'About', lexical: '{"root":{}}', custom_template: 'about', tags: ['About', {id: 'tag1'}], authors: ['author@example.invalid', {id: 'author1'}], feature_image: 'https://images.invalid/about.jpg', feature_image_alt: 'About', meta_title: 'SEO', meta_description: 'Description', published_at: timestamp};
  await assert.rejects(call('pages_add', {...content, email_only: true, newsletter: 'weekly', send: true, unknown: 'discard'}), /Invalid arguments/);
  assert.equal(requests.length, 0);
  await call('pages_add', content);
  assert.deepEqual(requests[0].data, {pages: [content]});
  assert.deepEqual(requests[0].params, {});
  await assert.rejects(call('pages_edit', {...content, id: 'abc123', updated_at: timestamp, email_only: true}), /Invalid arguments/);
  await call('pages_edit', {...content, id: 'abc123', updated_at: timestamp});
  assert.deepEqual(requests[1].data, {pages: [{...content, updated_at: timestamp}]});
  assert.deepEqual(requests[1].params, {});
  await call('pages_add', {title: 'About', html: '<p>HTML</p>', lexical: '{"root":{}}'});
  assert.deepEqual(requests[2].params, {source: 'html'});
  await call('posts_add', {title: 'Post', email_only: true, custom_template: 'post'});
  assert.deepEqual(requests[3].data, {posts: [{title: 'Post', email_only: true, custom_template: 'post'}]});
});
test('pages browse preserves pagination metadata on empty/nonempty collections', async t => {
  const {call, enqueueResponse} = await setup(t);
  for (const entities of [[entity], []]) {
    enqueueResponse({pages: entities, meta: {pagination}});
    const output = await call('pages_browse', {});
    assert.deepEqual(JSON.parse(output.content[0].text), {data: entities, meta: {pagination}});
  }
});
test('page deletion failure is never reported as success', async t => {
  const {call, requests, enqueueError} = await setup(t);
  enqueueError(new Error('Deletion denied'));
  const output = await call('pages_delete', {id: 'abc123'});
  assert.equal(output.isError, true);
  assert.equal(output.content[0].text, 'Deletion denied');
  assert.equal(requests.length, 1);
});
for (const resource of ['posts', 'pages']) {
  for (const status of [403, 404, 409]) {
    test(`MCP ${resource} copy safely fails HTTP ${status} without retry/fallback`, async t => {
      const {call, enqueueError, requests} = await setup(t);
      enqueueError(Object.assign(new Error(config.key), {request: {Authorization: 'secret-token'}, response: {status, data: {errors: [{type: 'NoPermissionError', message: config.key}]}}}));
      const output = await call(`${resource}_copy`, {id: 'abc123'});
      assert.equal(output.isError, true);
      assert.deepEqual(output.content, [{type: 'text', text: `Ghost ${resource} copy failed (HTTP ${status}).`}]);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].method, 'POST');
      assert.ok(!JSON.stringify(output).includes(config.key));
      assert.ok(!JSON.stringify(output).includes(requests[0].headers.Authorization));
    });
  }
}
test('MCP copy rejects overrides and does not invent success on malformed responses', async t => {
  const {call, enqueueResponse, requests} = await setup(t);
  enqueueResponse({pages: [copied]});
  await assert.rejects(call('pages_copy', {id: 'abc123', title: 'override', status: 'published', html: '<p>Ignored</p>', newsletter: 'weekly'}), /Invalid arguments/);
  assert.equal(requests.length, 0);
  await call('pages_copy', {id: 'abc123'});
  assert.equal(requests[0].data, undefined);
  assert.deepEqual(requests[0].params, {});
  enqueueResponse({pages: []});
  const output = await call('pages_copy', {id: 'abc123'});
  assert.equal(output.isError, true);
  assert.equal(output.content[0].text, 'Unexpected Ghost copy response');
  assert.equal(requests.length, 2);
});

test('page MCP selectors cannot escape the page resource route', async t => {
  const {call, requests} = await setup(t);
  for (const selector of ['../posts/victim', '%2e%2e%2fposts%2fvictim', '..', '.', 'a/b', 'a\\b', 'a?x=y', 'a#frag', 'a\n', 'a\x7f']) {
    for (const [name, args] of [
      ['pages_read', {id: selector}], ['pages_read', {slug: selector}],
      ['pages_edit', {id: selector, updated_at: timestamp}], ['pages_delete', {id: selector}],
    ]) await assert.rejects(call(name, args), /Invalid arguments/);
  }
  assert.equal(requests.length, 0);
});
