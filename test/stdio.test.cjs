const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {config, toolNames, additionalToolNames} = require('./helpers/fixtures.cjs');
const {LATEST_PROTOCOL_VERSION} = require('@modelcontextprotocol/sdk/types.js');

test('CLI missing configuration fails safely without protocol output', {timeout: 10000}, () => {
  const result = spawnSync(process.execPath, ['build/server.js'], {env: {PATH: process.env.PATH}, encoding: 'utf8', timeout: 5000});
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /GHOST_API_URL/);
  assert.ok(!result.stderr.includes('Error:'));
});

test('CLI invalid credentials never print the supplied secret', {timeout: 10000}, () => {
  const secret = 'invalid-secret-do-not-log';
  const result = spawnSync(process.execPath, ['build/server.js'], {env: {PATH: process.env.PATH, GHOST_API_URL: config.url, GHOST_ADMIN_API_KEY: secret}, encoding: 'utf8', timeout: 5000});
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /GHOST_ADMIN_API_KEY/);
  assert.ok(!result.stderr.includes(secret));
});

test('stdio initializes and discovers all tools without any Ghost HTTP calls', {timeout: 10000}, async t => {
  const cli = await require('./helpers/stdioHarness.cjs').startCli(t);
  const initialized = await cli.request('initialize', {protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo: {name: 'stdio-smoke-test', version: '1.0.0'}});
  assert.equal(initialized.serverInfo.name, 'ghost-mcp-ts');
  cli.notify('notifications/initialized');
  const names = [];
  let cursor;
  do {
    const page = await cli.request('tools/list', cursor ? {cursor} : {});
    names.push(...page.tools.map(tool => tool.name));
    for (const tool of page.tools) {
      if (/^(posts|pages|tags)_/.test(tool.name)) {
        assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
        assert.equal(tool.outputSchema, undefined);
      }
      if (tool.name === 'posts_edit') {
        assert.equal(tool.inputSchema.properties.save_revision.type, 'boolean');
        assert.ok(tool.inputSchema.properties.custom_template);
        assert.equal(tool.inputSchema.properties.fields, undefined);
      }
      if (tool.name === 'tags_read') assert.ok(tool.inputSchema.properties.include);
      if (tool.name === 'members_browse') {
        assert.equal(tool.inputSchema.properties.formats, undefined);
        assert.equal(tool.inputSchema.properties.limit.type, 'number');
      }
    }
    cursor = page.nextCursor;
  } while (cursor);
  assert.deepEqual(names.sort(), [...toolNames, ...additionalToolNames].sort());
  assert.equal(cli.requests.length, 0);
  assert.ok(cli.messages.length >= 2);
  assert.ok(cli.messages.every(message => message.jsonrpc === '2.0'));
  assert.ok(!cli.stderr().includes(config.key));
  await cli.stop();
  assert.equal(cli.child.exitCode !== null || cli.child.signalCode !== null, true);
});

test('failed stdio initialization still closes the child, reader and loopback fixture', {timeout: 10000}, async t => {
  const cli = await require('./helpers/stdioHarness.cjs').startCli(t);
  await assert.rejects(cli.request('initialize', {protocolVersion: LATEST_PROTOCOL_VERSION}), /Invalid|params|required|Required/);
  await cli.stop();
  assert.equal(cli.child.exitCode !== null || cli.child.signalCode !== null, true);
  assert.equal(cli.reader.closed, true);
  assert.equal(cli.httpServer.listening, false);
  assert.equal(cli.requests.length, 0);
});
