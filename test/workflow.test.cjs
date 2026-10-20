const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');

test('CI validates this project on Node 22 without privileged triggers, secrets or write access', () => {
  // JSON is a YAML subset: inspect workflow policy without adding a YAML dependency.
  const workflow = JSON.parse(readFileSync(path.join(__dirname, '../.github/workflows/ci.yml'), 'utf8'));
  assert.deepEqual(Object.keys(workflow.on).sort(), ['pull_request', 'push']);
  assert.deepEqual(workflow.permissions, {contents: 'read'});
  const jobs = Object.values(workflow.jobs);
  assert.equal(jobs.length, 1);
  const job = jobs[0];
  assert.equal(job.permissions, undefined);
  assert.equal(job.environment, undefined);
  const setup = job.steps.find(step => step.uses?.startsWith('actions/setup-node@'));
  assert.equal(setup.with['node-version'], 22);
  assert.equal(setup.with.cache, 'npm');
  assert.deepEqual(job.steps.filter(step => step.run).map(step => step.run), ['npm ci', 'npm run typecheck', 'npm test']);
  assert.ok(job.steps.some(step => step.uses === 'actions/checkout@v4'));
  assert.ok(!JSON.stringify(workflow).includes('secrets.'));
  const manifest = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  assert.deepEqual(manifest.bin, {'ghost-mcp': 'build/server.js'});
  assert.equal(manifest.scripts.start, 'node build/server.js');
});
