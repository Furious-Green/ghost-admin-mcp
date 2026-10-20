const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');

function run(script) {
  const result = spawnSync(process.execPath, ['-e', `
    require('./test/helpers/networkGuard.cjs').blockNetwork();
    ${script}
  `], {cwd: require('node:path').resolve(__dirname, '..'), env: {PATH: process.env.PATH}, encoding: 'utf8', timeout: 5000});
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
}

test('tools and server construction do not load credentials, connect, or exit on import', () => {
  run(`
    const assert = require('node:assert/strict');
    for (const module of ['config', 'ghostApi', 'client/sdkAdapter', 'client/nativeCopy', 'client/nativeRequest', 'tools/contentSchemas', 'prompts', 'resources',
      ...['posts','pages','members','users','tags','tiers','offers','newsletters','invites','roles','webhooks'].map(name => 'tools/' + name)]) {
      require('./build/' + module + '.js');
    }
    const {makeRecordingClient} = require('./test/helpers/recordingClient.cjs');
    const recording = makeRecordingClient();
    const server = require('./build/createServer.js').createServer(recording.client);
    assert.ok(server);
    assert.equal(recording.requests.length, 0);
    server.close().catch(error => { throw error; });
  `);
});

test('explicit configuration validates presence without terminating or printing secrets', () => {
  run(`
    const assert = require('node:assert/strict');
    const {readGhostConfig} = require('./build/config.js');
    const {config} = require('./test/helpers/fixtures.cjs');
    assert.throws(() => readGhostConfig({}), /GHOST_API_URL/);
    assert.throws(() => readGhostConfig({GHOST_API_URL: config.url}), /GHOST_ADMIN_API_KEY/);
    assert.throws(() => readGhostConfig({GHOST_ADMIN_API_KEY: config.key}), error => {
      assert.match(error.message, /GHOST_API_URL/);
      assert.ok(!error.message.includes(config.key));
      return true;
    });
    assert.deepEqual(readGhostConfig({GHOST_API_URL: config.url, GHOST_ADMIN_API_KEY: config.key}), config);
    assert.deepEqual(readGhostConfig({GHOST_API_URL: config.url, GHOST_ADMIN_API_KEY: config.key, GHOST_API_VERSION: 'v6.0'}), {...config, version: 'v6.0'});
  `);
});
