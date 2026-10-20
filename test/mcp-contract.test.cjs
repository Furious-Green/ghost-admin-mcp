const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {blockNetwork} = require('./helpers/networkGuard.cjs');
after(blockNetwork());
const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
const {config, families, backedFamilies, toolNames, additionalToolNames, entity, pagination, timestamp, permissionError} = require('./helpers/fixtures.cjs');

async function harness(t) {
  const recording = makeRecordingClient();
  const mcp = await require('./helpers/mcpHarness.cjs').openMcpHarness(recording.client);
  t.after(mcp.close);
  return {...recording, ...mcp};
}

async function allPages(list, property) {
  const result = [];
  let cursor;
  do {
    const page = await list(cursor ? {cursor} : {});
    result.push(...page[property]);
    cursor = page.nextCursor;
  } while (cursor);
  return result;
}

test('MCP discovery exposes the complete existing tool, template, resource and prompt surface', async t => {
  const {mcpClient, requests} = await harness(t);
  const tools = await allPages(params => mcpClient.listTools(params), 'tools');
  assert.equal(tools.length, 46);
  assert.deepEqual(tools.map(tool => tool.name).sort(), [...toolNames, ...additionalToolNames].sort());
  const templates = await allPages(params => mcpClient.listResourceTemplates(params), 'resourceTemplates');
  assert.deepEqual(templates.map(item => item.uriTemplate).sort(), ['member://{member_id}', 'newsletter://{newsletter_id}', 'offer://{offer_id}', 'post://{post_id}', 'tier://{tier_id}', 'user://{user_id}']);
  const resources = await allPages(params => mcpClient.listResources(params), 'resources');
  assert.deepEqual(resources.map(item => item.uri), ['blog://info']);
  const prompts = await allPages(params => mcpClient.listPrompts(params), 'prompts');
  assert.deepEqual(prompts.map(item => item.name), ['summarize-post']);
  assert.equal(requests.length, 0);
});

for (const [family, operations] of Object.entries(families)) {
  // Native dispatch is covered by commerce-mcp/staff-mcp.test.cjs.
  if (!backedFamilies.includes(family)) continue;
  for (const [operation, args] of Object.entries(operations)) {
    test(`MCP ${family}_${operation} dispatches to the SDK`, async t => {
      const {mcpClient, requests, enqueueResponse} = await harness(t);
      enqueueResponse(operation === 'delete' ? '' : {[family]: [entity]});
      const output = await mcpClient.callTool({name: `${family}_${operation}`, arguments: structuredClone(args)});
      assert.notEqual(output.isError, true);
      assert.equal(requests.length, 1);
      const request = requests[0];
      assert.equal(request.method, {browse: 'GET', read: 'GET', add: 'POST', edit: 'PUT', delete: 'DELETE'}[operation]);
      assert.equal(request.url, `${config.url}/ghost/api/admin/${family}/${['read', 'edit', 'delete'].includes(operation) ? 'abc123/' : ''}`);
      assert.deepEqual(request.params, {});
      const body = {...args};
      delete body.id;
      const expected = {browse: '', read: '', add: {[family]: [args]}, edit: {[family]: [body]}, delete: args}[operation];
      assert.deepEqual(request.data, expected);
      if (operation === 'delete') {
        const singular = {posts: 'Post', members: 'Member', users: 'User', tags: 'Tag', newsletters: 'Newsletter', webhooks: 'Webhook'}[family];
        assert.equal(output.content[0].text, `${singular} with id abc123 deleted.`);
      } else {
        assert.deepEqual(JSON.parse(output.content[0].text), {data: operation === 'browse' ? [entity] : entity});
      }
    });
  }
}

test('MCP parsing retains supported templates while non-slice member queries remain unchanged', async t => {
  const {mcpClient, requests} = await harness(t);
  await assert.rejects(mcpClient.callTool({name: 'posts_edit', arguments: {id: 'abc123', title: 'Changed'}}), /updated_at/);
  await assert.rejects(mcpClient.callTool({name: 'members_browse', arguments: {limit: 'all'}}), /limit/);
  assert.equal(requests.length, 0);
  await mcpClient.callTool({name: 'posts_add', arguments: {title: 'Example', custom_template: 'post'}});
  assert.deepEqual(requests[0].data, {posts: [{title: 'Example', custom_template: 'post'}]});
  await mcpClient.callTool({name: 'members_browse', arguments: {page: 2, limit: 15, order: 'created_at desc', filter: 'status:free'}});
  assert.deepEqual(requests[1].params, {page: 2, limit: 15, order: 'created_at desc', filter: 'status:free'});
});

test('MCP content reads require one selector while member email reads remain unchanged', async t => {
  const {mcpClient, requests} = await harness(t);
  const absent = await mcpClient.callTool({name: 'posts_read', arguments: {}});
  assert.equal(absent.isError, true);
  assert.match(absent.content[0].text, /exactly one post selector/);
  assert.equal(requests.length, 0);
  const ambiguous = await mcpClient.callTool({name: 'posts_read', arguments: {id: 'abc123', slug: 'ignored'}});
  assert.equal(ambiguous.isError, true);
  assert.equal(requests.length, 0);
  await mcpClient.callTool({name: 'posts_read', arguments: {slug: 'example'}});
  assert.equal(requests[0].url, `${config.url}/ghost/api/admin/posts/slug/example/`);
  await mcpClient.callTool({name: 'members_read', arguments: {email: 'member@example.invalid'}});
  assert.equal(requests[1].url, `${config.url}/ghost/api/admin/members/email/member@example.invalid/`);
});

test('MCP content writes preserve HTML/Lexical, relationships, metadata and concurrency', async t => {
  const {mcpClient, requests} = await harness(t);
  const html = {title: 'Example', html: '<p>Text</p>', tags: ['Example', {id: 'tag1'}], authors: ['author@example.invalid', {id: 'author1'}], feature_image: 'https://images.invalid/hero.jpg', meta_title: 'SEO title', og_title: 'Social title', published_at: timestamp};
  await mcpClient.callTool({name: 'posts_add', arguments: html});
  assert.deepEqual(requests[0].params, {source: 'html'});
  assert.deepEqual(requests[0].data, {posts: [html]});
  const lexical = {title: 'Example', lexical: '{"root":{"children":[]}}'};
  await mcpClient.callTool({name: 'posts_add', arguments: lexical});
  assert.deepEqual(requests[1].params, {});
  assert.deepEqual(requests[1].data, {posts: [lexical]});
  await mcpClient.callTool({name: 'posts_edit', arguments: {id: 'abc123', updated_at: timestamp, html: '<p>Changed</p>'}});
  assert.deepEqual(requests[2].params, {source: 'html'});
  assert.deepEqual(requests[2].data, {posts: [{updated_at: timestamp, html: '<p>Changed</p>'}]});
});

test('browse text preserves server metadata for nonempty and empty final pages', async t => {
  const {mcpClient, enqueueResponse} = await harness(t);
  enqueueResponse({members: [entity], meta: {pagination}});
  const page = await mcpClient.callTool({name: 'members_browse', arguments: {page: 1}});
  assert.deepEqual(JSON.parse(page.content[0].text), {data: [entity], meta: {pagination}});
  enqueueResponse({members: [], meta: {pagination: {...pagination, page: 2, next: null}}});
  const empty = await mcpClient.callTool({name: 'members_browse', arguments: {page: 2}});
  assert.deepEqual(JSON.parse(empty.content[0].text), {data: [], meta: {pagination: {...pagination, page: 2, next: null}}});
});

test('known issue #11: all resource handlers return placeholders without Ghost reads', async t => {
  const {mcpClient, requests} = await harness(t);
  for (const [uri, label] of [['user://abc123', 'User'], ['member://abc123', 'Member'], ['tier://abc123', 'Tier'], ['offer://abc123', 'Offer'], ['newsletter://abc123', 'Newsletter'], ['post://abc123', 'Post'], ['blog://info', 'Blog info']]) {
    const output = await mcpClient.readResource({uri});
    assert.equal(output.contents[0].mimeType, 'text/plain');
    assert.equal(output.contents[0].text, uri === 'blog://info' ? 'Blog info resource requested' : `${label} resource requested for ID: abc123`);
  }
  assert.equal(requests.length, 0);
});

test('prompt uses the injected post reader and retains the existing bounded HTML preview', async t => {
  const {mcpClient, requests, enqueueResponse} = await harness(t);
  enqueueResponse({posts: [{...entity, excerpt: 'Short summary', html: 'a'.repeat(300) + 'b'.repeat(100)}]});
  const output = await mcpClient.getPrompt({name: 'summarize-post', arguments: {postId: 'abc123'}});
  assert.equal(requests[0].url, `${config.url}/ghost/api/admin/posts/abc123/`);
  assert.equal(output.messages[0].content.text, `Summarize the following Ghost post:\n\nTitle: Example\nExcerpt: Short summary\n\nContent Preview:\n${'a'.repeat(300)}...`);
  enqueueResponse({posts: [{title: null, excerpt: {not: 'text'}, html: 123}]});
  const malformed = await mcpClient.getPrompt({name: 'summarize-post', arguments: {postId: 'abc123'}});
  assert.equal(malformed.messages[0].content.text, 'Summarize the following Ghost post:\n\nTitle: \nExcerpt: \n\nContent Preview:\n...');
});

test('MCP permission failures are errors without diagnostics, secrets, or mutation retries', async t => {
  const {mcpClient, requests, enqueueError} = await harness(t);
  enqueueError(permissionError());
  const output = await mcpClient.callTool({name: 'posts_add', arguments: {title: 'Example'}});
  assert.equal(output.isError, true);
  assert.deepEqual(output.content, [{type: 'text', text: 'Permission denied'}]);
  assert.equal(requests.length, 1);
  const serialized = JSON.stringify(output);
  for (const secret of [config.key, requests[0].headers.Authorization, 'Authorization', 'stack', 'request']) {
    assert.ok(!serialized.includes(secret));
  }
});
