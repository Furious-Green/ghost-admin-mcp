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
  assert.equal(initialized.serverInfo.version, require('../package.json').version);
  cli.notify('notifications/initialized');
  const names = [];
  let cursor;
  do {
    const page = await cli.request('tools/list', cursor ? {cursor} : {});
    names.push(...page.tools.map(tool => tool.name));
    for (const tool of page.tools) {
      assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
      assert.equal(tool.outputSchema, undefined);
      if (tool.name === 'posts_edit') {
        assert.equal(tool.inputSchema.properties.save_revision.type, 'boolean');
        assert.ok(tool.inputSchema.properties.custom_template);
        assert.equal(tool.inputSchema.properties.fields, undefined);
        assert.ok(tool.inputSchema.properties.newsletter);
        assert.ok(tool.inputSchema.properties.email_segment);
        assert.match(tool.description,/real subscriber emails/i);
      }
      if (tool.name === 'tags_read') assert.ok(tool.inputSchema.properties.include);
      if (tool.name === 'members_browse') {
        assert.equal(tool.inputSchema.properties.formats, undefined);
        assert.ok(tool.inputSchema.properties.limit.anyOf);
        assert.ok(tool.inputSchema.properties.search);
      }
      if (tool.name === 'members_read') {
        assert.equal(tool.inputSchema.properties.fields, undefined);
        assert.ok(tool.inputSchema.properties.include);
      }
      if (tool.name === 'newsletters_edit') {
        assert.deepEqual(tool.inputSchema.properties.status.enum, ['active','archived']);
        assert.ok(tool.inputSchema.properties.include);
        assert.equal(tool.inputSchema.properties.opt_in_existing,undefined);
        assert.match(tool.description,/verification emails/i);
      }
      if (tool.name === 'newsletters_add') {
        assert.equal(tool.inputSchema.properties.opt_in_existing.type,'boolean');
        assert.match(tool.description,/existing members/i);
        assert.match(tool.description,/verification emails/i);
      }
      if (tool.name === 'tiers_read') assert.equal(tool.inputSchema.properties.include, undefined);
      if (tool.name === 'labels_delete') assert.match(tool.description,/not the members themselves/i);
      if (tool.name === 'labels_browse') assert.ok(tool.inputSchema.properties.include);
      if (tool.name === 'labels_read') {assert.ok(tool.inputSchema.properties.id);assert.ok(tool.inputSchema.properties.slug)}
      if (tool.name === 'site_read') {
        assert.deepEqual(tool.inputSchema.properties,{});
        assert.match(tool.description,/unauthenticated/i);
        assert.match(tool.description,/not general settings/i);
      }
      if (tool.name === 'images_upload') {
        assert.deepEqual(tool.inputSchema.properties.mime_type.enum,['image/jpeg','image/png','image/gif','image/webp']);
        assert.equal(tool.inputSchema.properties.base64.maxLength,6990508);
        assert.equal(tool.inputSchema.properties.path,undefined);
        assert.equal(tool.inputSchema.properties.url,undefined);
        assert.match(tool.description,/5 MiB/);assert.match(tool.description,/writes a file/);assert.match(tool.description,/never automatically retried/);
      }
      if(tool.name==='themes_upload'){
        assert.equal(tool.inputSchema.properties.base64.maxLength,13981016);
        assert.deepEqual(Object.keys(tool.inputSchema.properties).sort(),['base64','filename']);
        assert.match(tool.description,/active theme files/i);assert.match(tool.description,/permission/);assert.match(tool.description,/never calls/);
      }
      if(tool.name==='themes_activate'){
        assert.deepEqual(Object.keys(tool.inputSchema.properties),['name']);assert.deepEqual(tool.inputSchema.required,['name']);
        assert.match(tool.description,/public site/);assert.match(tool.description,/permission/);assert.match(tool.description,/Separate from upload/);
      }
    }
    cursor = page.nextCursor;
  } while (cursor);
  assert.deepEqual(names.sort(), [...toolNames, ...additionalToolNames].sort());
  assert.equal(names.length,54);
  assert.equal(names.includes('newsletters_delete'),false);
  await assert.rejects(cli.request('tools/call',{name:'newsletters_delete',arguments:{id:'one'}}),/not found|Unknown tool/i);
  assert.equal(cli.requests.length, 0);
  const templates=await cli.request('resources/templates/list',{});
  assert.deepEqual(templates.resourceTemplates.map(r=>r.uriTemplate).sort(),['member://{member_id}','newsletter://{newsletter_id}','offer://{offer_id}','post://{post_id}','tier://{tier_id}','user://{user_id}']);
  assert.ok(templates.resourceTemplates.every(r=>r.mimeType==='application/json'));
  const resources=await cli.request('resources/list',{});assert.equal(resources.resources[0].uri,'blog://info');assert.equal(resources.resources[0].mimeType,'application/json');
  const prompts=await cli.request('prompts/list',{});assert.equal(prompts.prompts[0].name,'summarize-post');assert.match(prompts.prompts[0].description,/100000/);
  assert.deepEqual(prompts.prompts[0].arguments.map(a=>[a.name,a.required]),[['postId',true]]);
  await assert.rejects(cli.request('resources/read',{uri:'post://%2e%2e'}),/Invalid Ghost resource/);
  await assert.rejects(cli.request('prompts/get',{name:'summarize-post',arguments:{postId:'one',unknown:'bad'}}),/Invalid summarize-post/);
  assert.equal(cli.requests.length,0);
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
