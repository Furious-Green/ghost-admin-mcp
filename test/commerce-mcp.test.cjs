const {test, after} = require('node:test');
const assert = require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
async function harness(t) {
  const recording = makeRecordingClient();
  const m = await require('./helpers/mcpHarness.cjs').openMcpHarness(recording.client);
  t.after(m.close);
  return {...recording, ...m};
}
test('commerce discovery removes delete tools and every supported operation dispatches through real MCP', async t => {
  const r = await harness(t);
  const {tools} = await r.mcpClient.listTools();
  for (const name of ['tiers_delete', 'offers_delete']) {
    assert.equal(tools.some(t => t.name === name), false);
    await assert.rejects(r.mcpClient.callTool({name, arguments: {id: 'one'}}), /not found/);
  }
  assert.equal(r.requests.length, 0);
  for (const family of ['tiers', 'offers']) for (const op of ['browse', 'read', 'add', 'edit']) {
    const args = op === 'browse' ? {} : op === 'read' ? {id: 'one'} : op === 'edit' ? family === 'tiers' ? {id: 'one', active: false} : {id: 'one', status: 'archived'} : family === 'tiers' ? {name: 'Paid'} : {name: 'Sale', code: 'sale', cadence: 'month', duration: 'once', amount: 10, tier_id: 'tier1', type: 'percent'};
    r.enqueueResponse({[family]: [{id: 'one'}]});
    const response = await r.mcpClient.callTool({name: `${family}_${op}`, arguments: args});
    assert.deepEqual(JSON.parse(response.content[0].text), {data: op === 'browse' ? [{id: 'one'}] : {id: 'one'}});
  }
  assert.equal(r.requests.length, 8);
});
test('real MCP rejects legacy selectors, unknown options, immutable edits and unsafe IDs without HTTP', async t => {
  const r = await harness(t);
  for (const [name, args] of [
    ['tiers_read', {slug: 'paid'}], ['tiers_read', {id: 'one', slug: 'paid'}],
    ['offers_read', {code: 'sale'}], ['offers_read', {id: 'one', code: 'sale'}],
    ['offers_browse', {page: 1}], ['offers_browse', {order: 'name asc'}], ['offers_browse', {limit: 1}],
    ['tiers_browse', {unknown: true}], ['tiers_read', {id: '../posts/x'}], ['offers_edit', {id: 'one', amount: 20}],
  ]) await assert.rejects(r.mcpClient.callTool({name, arguments: args}), /Invalid arguments/);
  assert.equal(r.requests.length, 0);
});

test('commerce MCP mutation failures return safe errors with one attempt and never deletion confirmations', async t => {
  const r = await harness(t);
  for (const name of ['tiers_add', 'tiers_edit', 'offers_add', 'offers_edit']) for (const status of [403, 404, 409]) {
    r.enqueueError({response: {status, data: {errors: [{type: 'NoPermissionError', message: 'SECRET'}]}}});
    const args = name.endsWith('_edit') ? {id: 'one'} : name === 'tiers_add' ? {name: 'Paid'} : {name: 'Sale', code: 'sale', cadence: 'month', duration: 'once', amount: 10, tier_id: 'tier1', type: 'percent'};
    const before = r.requests.length;
    const response = await r.mcpClient.callTool({name, arguments: args});
    assert.equal(response.isError, true);
    assert.equal(response.content[0].text, `Ghost ${name.replace('_', ' ')} failed (HTTP ${status}).`);
    assert.equal(r.requests.length, before + 1);
    assert.equal(JSON.stringify(response).includes('SECRET'), false);
  }
});
