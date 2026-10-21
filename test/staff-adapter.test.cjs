const {test, after} = require('node:test');
const assert = require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
const cases = [
  ['invites', 'browse', {filter: 'status:sent', limit: 'all', page: 1, fields: 'id,email', order: 'created_at desc'}, 'GET', 'invites/', undefined],
  ['invites', 'add', {role_id: 'role1', email: 'staff@example.invalid'}, 'POST', 'invites/', {invites: [{role_id: 'role1', email: 'staff@example.invalid'}]}],
  ['invites', 'delete', {id: 'abc123'}, 'DELETE', 'invites/abc123/', undefined],
  ['roles', 'browse', {permissions: 'assign'}, 'GET', 'roles/', undefined],
];
for (const [family, op, args, method, path, body] of cases) test(`${family}.${op} uses native staff contracts without fabricated SDK routes`, async () => {
  const r = makeRecordingClient();
  r.enqueueResponse(op === 'delete' ? '' : {[family]: [{id: 'one', custom: true}]});
  assert.deepEqual(await r.client[family][op](args), op === 'delete' ? undefined : {data: op === 'browse' ? [{id: 'one', custom: true}] : {id: 'one', custom: true}});
  assert.equal(r.requests.length, 1);
  const request = r.requests[0];
  assert.equal(request.url, `http://127.0.0.1:1/ghost/api/admin/${path}`);
  assert.equal(request.method, method);
  assert.deepEqual(request.params, op === 'browse' ? args : {});
  assert.deepEqual(request.data, body);
  assert.equal(request.headers['Accept-Version'], 'v5.0');
  assert.match(request.headers.Authorization, /^Ghost /);
  assert.equal(request.headers['Content-Type'], body ? 'application/json' : undefined);
});

test('staff rejects invalid and unsupported inputs and removed methods without requests', async () => {
  const r = makeRecordingClient();
  assert.equal(r.client.roles.read, undefined);
  assert.equal(r.client.invites.read, undefined);
  for (const args of [{page: 1}, {limit: 10}, {order: 'name'}, {filter: 'name:Admin'}, {permissions: 'read'}, {unknown: 1}]) await assert.rejects(r.client.roles.browse(args), /Invalid Ghost/);
  for (const args of [{role_id: 'role1', email: 'bad'}, {role_id: ' ', email: 'staff@example.invalid'}, {role_id: '../bad', email: 'staff@example.invalid'}, {role_id: 'role1', email: 'staff@example.invalid', extra: true}]) await assert.rejects(r.client.invites.add(args), /Invalid Ghost/);
  for (const id of ['', ' ', '.', '..', '../posts/x', 'a/b', '%2f', 'a\\b', 'a?x', 'a#x', '\u0000', '\ud800']) await assert.rejects(r.client.invites.delete({id}), /Invalid Ghost/);
  for (const args of [{page: 0}, {limit: 0}, {limit: 1.5}, {unknown: 1}]) await assert.rejects(r.client.invites.browse(args), /Invalid Ghost/);
  await assert.rejects(r.client.roles.browse({}, {permissions: 'assign'}), /Invalid Ghost/);
  await assert.rejects(r.client.invites.browse({}, {filter: 'x'}), /Invalid Ghost/);
  assert.equal(r.requests.length, 0);
});

for (const family of ['invites', 'roles']) test(`${family} browse keeps array shape and metadata; malformed responses cannot succeed`, async () => {
  const r = makeRecordingClient();
  for (const items of [[], [{id: 'one'}], [{id: 'one'}, {id: 'two'}]]) {
    r.enqueueResponse({[family]: items});
    assert.deepEqual(await r.client[family].browse({}), {data: items});
  }
  r.enqueueResponse({[family]: [], meta: {pagination: {total: 0}}});
  assert.equal((await r.client[family].browse({})).meta.pagination.total, 0);
  for (const response of [null, {}, {posts: [{}]}, {[family]: [null]}, {[family]: [[]]}, {[family]: [{}], meta: 'bad'}]) {
    r.enqueueResponse(response);
    await assert.rejects(r.client[family].browse({}), /Unexpected Ghost/);
  }
});

test('invite creation requires exactly one matching entity, never a fabricated confirmation', async () => {
  const r = makeRecordingClient();
  for (const response of [undefined, {}, {roles: [{}]}, {invites: []}, {invites: [{}, {}]}, {invites: [null]}]) {
    r.enqueueResponse(response);
    await assert.rejects(r.client.invites.add({role_id: 'role1', email: 'staff@example.invalid'}), /Unexpected Ghost/);
  }
});

for (const [family, op, args] of cases) test(`${family}.${op} sanitizes failures with safe staff permission guidance and one attempt`, async () => {
  for (const status of [401, 403, 404, 409]) {
    const r = makeRecordingClient();
    r.enqueueError({response: {status, data: {errors: [{type: 'NoPermissionError', message: 'SECRET'}]}}, request: 'SECRET'});
    await assert.rejects(r.client[family][op](args), e => {
      assert.match(e.message, new RegExp(`Ghost ${family} ${op} failed \\(HTTP ${status}\\)`));
      if ([401,403].includes(status)) {
        if(family==='invites'&&op!=='add')assert.match(e.message,/staff access token with sufficient permissions/);
        else {assert.match(e.message,/integration key or staff access token/i);assert.doesNotMatch(e.message,/may require a staff/)}
      }
      assert.equal(e.statusCode, status);
      assert.equal(e.name, 'NoPermissionError');
      assert.equal(e.response, undefined);
      assert.equal(e.request, undefined);
      assert.equal(JSON.stringify(e).includes('SECRET'), false);
      return true;
    });
    assert.equal(r.requests.length, 1);
  }
});
