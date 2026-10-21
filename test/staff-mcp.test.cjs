const {test, after} = require('node:test');
const assert = require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
async function harness(t) {
  const r = makeRecordingClient();
  const m = await require('./helpers/mcpHarness.cjs').openMcpHarness(r.client);
  t.after(m.close);
  return {...r, ...m};
}
const calls = [
  ['invites_browse', {}, 'invites', [{id: 'one'}]],
  ['invites_add', {role_id: 'role1', email: 'staff@example.invalid'}, 'invites', {id: 'one'}],
  ['invites_delete', {id: 'abc123'}, 'invites', 'Invite with id abc123 deleted.'],
  ['roles_browse', {permissions: 'assign'}, 'roles', [{id: 'one'}]],
];
test('staff MCP discovery omits all three nonexistent tools and sends no HTTP', async t => {
  const r = await harness(t);
  let cursor; const tools = [];
  do {const page = await r.mcpClient.listTools(cursor ? {cursor} : {}); tools.push(...page.tools); cursor = page.nextCursor;} while (cursor);
  assert.equal(tools.length, 54);
  for (const name of ['roles_read', 'tiers_delete', 'offers_delete']) {
    assert.equal(tools.some(t => t.name === name), false);
    for (const args of [{id: 'one'}, {name: 'Admin'}]) await assert.rejects(r.mcpClient.callTool({name, arguments: args}), /not found/);
  }
  assert.equal(r.requests.length, 0);
  for (const name of ['invites_add', 'invites_delete', 'invites_browse', 'roles_browse']) assert.match(tools.find(t => t.name === name).description, /staff/i);
  assert.match(tools.find(t => t.name === 'invites_add').description, /email/i);
});
for (const [name, args, family, expected] of calls) test(`${name} dispatches over actual MCP with correct success shape`, async t => {
  const r = await harness(t);
  r.enqueueResponse(name === 'invites_delete' ? '' : {[family]: [{id: 'one'}]});
  const result = await r.mcpClient.callTool({name, arguments: args});
  assert.notEqual(result.isError, true);
  assert.deepEqual(name === 'invites_delete' ? result.content[0].text : JSON.parse(result.content[0].text), name === 'invites_delete' ? expected : {data: expected});
  assert.equal(r.requests.length, 1);
});
test('staff MCP rejects legacy role queries, invalid invites and traversal before HTTP', async t => {
  const r = await harness(t);
  for (const [name, args] of [
    ...[{filter: 'name:Admin'}, {limit: 10}, {page: 1}, {order: 'name'}, {permissions: 'read'}].map(args => ['roles_browse', args]),
    ['invites_add', {role_id: 'role1', email: 'bad'}], ['invites_add', {role_id: '../x', email: 'staff@example.invalid'}],
    ['invites_browse', {unknown: true}], ['invites_delete', {id: '../posts/victim'}],
  ]) await assert.rejects(r.mcpClient.callTool({name, arguments: args}), /Invalid arguments/);
  assert.equal(r.requests.length, 0);
});
test('failed staff MCP operations never report success or retry and redact server secrets', async t => {
  const r = await harness(t);
  for (const [name, args] of calls) for (const status of [403, 404, 409]) {
    r.enqueueError({response: {status, data: {errors: [{type: 'NoPermissionError', message: 'SECRET'}]}}});
    const before = r.requests.length;
    const result = await r.mcpClient.callTool({name, arguments: args});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /failed/);
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
    assert.equal(result.content[0].text.includes('deleted'), false);
    assert.equal(r.requests.length, before + 1);
  }
});
