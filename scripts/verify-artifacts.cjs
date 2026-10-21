// Local-only release-preparation gate. No publication, tags, uploads or Ghost calls.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function run(command, args, cwd = root) {
  return execFileSync(command, args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000});
}

async function smoke(cwd, source) {
  const cleanups = [];
  try {
    const cli = await require(path.join(source, 'test/helpers/stdioHarness.cjs')).startCli({after: fn => cleanups.push(fn)}, {cwd});
    const protocolVersion = require(path.join(source, 'node_modules/@modelcontextprotocol/sdk/dist/cjs/types.js')).LATEST_PROTOCOL_VERSION;
    const initialized = await cli.request('initialize', {protocolVersion, capabilities: {}, clientInfo: {name: 'artifact-verification', version: '1'}});
    assert.equal(initialized.serverInfo.name, 'ghost-mcp-ts');
    cli.notify('notifications/initialized');
    const names = [];
    let cursor;
    do {
      const page = await cli.request('tools/list', cursor ? {cursor} : {});
      names.push(...page.tools.map(tool => tool.name));
      assert.ok(page.tools.every(tool => tool.inputSchema.additionalProperties === false));
      cursor = page.nextCursor;
    } while (cursor);
    const {toolNames, additionalToolNames} = require(path.join(source, 'test/helpers/fixtures.cjs'));
    assert.deepEqual(names.sort(), [...toolNames, ...additionalToolNames].sort());
    assert.equal(names.length, 54);
    const templates = await cli.request('resources/templates/list', {});
    assert.equal(templates.resourceTemplates.length, 6);
    const resources = await cli.request('resources/list', {});
    assert.deepEqual(resources.resources.map(resource => resource.uri), ['blog://info']);
    const prompts = await cli.request('prompts/list', {});
    assert.deepEqual(prompts.prompts.map(prompt => prompt.name), ['summarize-post']);
    assert.equal(cli.requests.length, 0);
    assert.ok(!cli.stderr().includes('0'.repeat(64)));
    return {tools: names.length, resourceTemplates: 6, resources: 1, prompts: 1, ghostRequests: 0};
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup();
  }
}

async function main() {
  if (run('git', ['status', '--porcelain', '--untracked-files=no']).trim()) throw new Error('Commit tracked changes before artifact verification.');
  const commit = run('git', ['rev-parse', 'HEAD']).trim();
  assert.match(commit, /^[a-f0-9]{40}$/);
  const destination = path.join(root, 'dist', commit);
  if (fs.existsSync(destination)) throw new Error(`Artifact output already exists: ${destination}`);
  fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
  const temporary = fs.mkdtempSync(path.join(root, 'dist', '.verify-'));
  try {
    const output = path.join(temporary, 'output');
    const source = path.join(temporary, 'source');
    const runtime = path.join(temporary, 'runtime');
    const installed = path.join(temporary, 'runtime-installed');
    for (const directory of [output, source, runtime, installed]) fs.mkdirSync(directory);
    const sourceName = `ghost-admin-mcp-${commit}-source.tar.gz`;
    const runtimeName = `ghost-admin-mcp-${commit}-runtime.tar.gz`;
    run('git', ['archive', '--format=tar.gz', `--output=${path.join(output, sourceName)}`, commit]);
    run('tar', ['-xzf', path.join(output, sourceName), '-C', source]);
    run('npm', ['ci'], source);
    const sourceSmoke = await smoke(source, source);
    for (const file of ['package.json', 'package-lock.json', 'README.md', 'LICENSE']) fs.copyFileSync(path.join(source, file), path.join(runtime, file));
    fs.cpSync(path.join(source, 'build'), path.join(runtime, 'build'), {recursive: true});
    fs.chmodSync(path.join(runtime, 'build/server.js'), 0o755);
    assert.ok(fs.readFileSync(path.join(runtime, 'build/server.js'), 'utf8').startsWith('#!/usr/bin/env node'));
    run('tar', ['-czf', path.join(output, runtimeName), '-C', runtime, 'package.json', 'package-lock.json', 'README.md', 'LICENSE', 'build']);
    const members = run('tar', ['-tzf', path.join(output, runtimeName)]).trim().split('\n');
    assert.ok(members.every(member => ['package.json', 'package-lock.json', 'README.md', 'LICENSE'].includes(member) || member.startsWith('build/')));
    run('tar', ['-xzf', path.join(output, runtimeName), '-C', installed]);
    run('npm', ['ci', '--omit=dev', '--ignore-scripts'], installed);
    assert.equal(fs.existsSync(path.join(installed, 'node_modules/typescript')), false);
    const runtimeSmoke = await smoke(installed, source);
    const evidence = {commit, node: process.version, npm: run('npm', ['--version']).trim(), platform: process.platform,
      source: sourceSmoke, runtime: runtimeSmoke, runtimeMembers: members};
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(evidence, null, 2) + '\n');
    const sums = [sourceName, runtimeName, 'verification.json'].map(name => `${createHash('sha256').update(fs.readFileSync(path.join(output, name))).digest('hex')}  ${name}`).join('\n');
    fs.writeFileSync(path.join(output, 'SHA256SUMS'), sums + '\n');
    fs.renameSync(output, destination);
    console.log(`Verified source and production-only runtime artifacts: ${destination}`);
  } finally {
    // Only the unique directory owned by this invocation is removed.
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
