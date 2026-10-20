const {test, after} = require('node:test');
const assert = require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
const offer = {name: 'Sale', code: 'sale', cadence: 'month', duration: 'once', amount: 10, tier_id: 'tier1', type: 'percent'};
const cases = [
  ['tiers', 'browse', {filter: 'active:true', limit: 'all', page: 2, order: 'name asc', fields: 'id,name'}, 'GET', 'tiers/', undefined],
  ['tiers', 'read', {id: 'one'}, 'GET', 'tiers/one/', undefined],
  ['tiers', 'add', {name: 'Paid', monthly_price: 100, benefits: ['One']}, 'POST', 'tiers/', {tiers: [{name: 'Paid', monthly_price: 100, benefits: ['One']}]}],
  ['tiers', 'edit', {id: 'one', active: false}, 'PUT', 'tiers/one/', {tiers: [{active: false}]}],
  ['offers', 'browse', {filter: 'status:active'}, 'GET', 'offers/', undefined],
  ['offers', 'read', {id: 'one'}, 'GET', 'offers/one/', undefined],
  ['offers', 'add', offer, 'POST', 'offers/', {offers: [{name: 'Sale', code: 'sale', cadence: 'month', duration: 'once', amount: 10, tier: {id: 'tier1'}, type: 'percent'}]}],
  ['offers', 'edit', {id: 'one', status: 'archived'}, 'PUT', 'offers/one/', {offers: [{status: 'archived'}]}],
];
for (const [family, op, input, method, path, data] of cases) {
  test(`${family}.${op} uses supported routes, envelopes and query/body separation`, async () => {
    const r = makeRecordingClient();
    const original = structuredClone(input);
    const entity = {id: 'one', custom: {preserved: true}};
    r.enqueueResponse({[family]: [entity]});
    assert.deepEqual(await r.client[family][op](input), {data: op === 'browse' ? [entity] : entity});
    assert.deepEqual(input, original);
    const request = r.requests[0];
    assert.equal(request.url, `http://127.0.0.1:1/ghost/api/admin/${path}`);
    assert.equal(request.method, method);
    assert.deepEqual(request.data, data);
    assert.deepEqual(request.params, op === 'browse' ? input : {});
    assert.equal(request.headers['Accept-Version'], 'v5.0');
    assert.equal(request.headers['Content-Type'], data ? 'application/json' : undefined);
    assert.match(request.headers.Authorization, /^Ghost /);
  });
}

const invalid = [
  ['tiers', 'read', {slug: 'paid'}], ['tiers', 'read', {id: 'one', slug: 'paid'}],
  ['offers', 'read', {code: 'sale'}], ['offers', 'read', {id: 'one', code: 'sale'}],
  ...['page', 'limit', 'order', 'unknown'].map(k => ['offers', 'browse', {[k]: 1}]),
  ['tiers', 'browse', {include: 'unknown'}], ['tiers', 'browse', {page: 0}], ['tiers', 'browse', {limit: 1.1}],
  ['tiers', 'add', {name: ' '}], ['tiers', 'add', {name: 'Paid', active: false}],
  ...[-1, 1.2, Infinity, NaN].map(monthly_price => ['tiers', 'edit', {id: 'one', monthly_price}]),
  ['offers', 'add', {...offer, type: 'fixed'}], ['offers', 'add', {...offer, duration: 'repeating'}],
  ['offers', 'add', {...offer, amount: 1.2}], ['offers', 'add', {...offer, tier_id: '../bad'}],
  ['offers', 'edit', {id: 'one', amount: 20}], ['offers', 'edit', {id: 'one', status: 'deleted'}],
];
for (const [family, op, args] of invalid) test(`${family}.${op} rejects unsupported/invalid input ${JSON.stringify(args)}`, async () => {
  const r = makeRecordingClient();
  await assert.rejects(r.client[family][op](args), /Invalid Ghost/);
  assert.equal(r.requests.length, 0);
});

test('commerce IDs reject traversal at runtime and second options never silently disappear', async () => {
  const r = makeRecordingClient();
  for (const family of ['tiers', 'offers']) {
    assert.equal(r.client[family].delete, undefined);
    for (const op of ['read', 'edit']) for (const id of ['../posts/x', '%2e', '.', '..', 'a/b', 'a\\b', 'a?x', 'a#x', '', ' ', '\ud800']) {
      await assert.rejects(r.client[family][op]({id}), /Invalid Ghost/);
    }
    await assert.rejects(r.client[family].browse({}, {filter: 'ignored'}), /Invalid Ghost/);
  }
  assert.equal(r.requests.length, 0);
});

for (const family of ['tiers', 'offers']) {
  test(`${family} preserves collection shape/metadata and refuses malformed entity envelopes`, async () => {
    const r = makeRecordingClient();
    for (const items of [[], [{id: 'one'}], [{id: 'one'}, {id: 'two'}]]) {
      r.enqueueResponse({[family]: items});
      assert.deepEqual(await r.client[family].browse({}), {data: items});
    }
    r.enqueueResponse({[family]: [{id: 'one'}], meta: {pagination: {total: 1}}});
    const result = await r.client[family].browse({});
    assert.equal(result.meta.pagination.total, 1);
    for (const response of [null, '', {}, {posts: [{}]}, {[family]: null}, {[family]: [null]}, {[family]: [1]}, {[family]: [[]]}, {[family]: [{}], meta: []}]) {
      r.enqueueResponse(response);
      await assert.rejects(r.client[family].browse({}), /Unexpected Ghost/);
    }
    for (const response of [{[family]: []}, {[family]: [{}, {}]}, {}, {[family]: [null]}]) {
      r.enqueueResponse(response);
      await assert.rejects(r.client[family].edit({id: 'one'}), /Unexpected Ghost/);
    }
  });
  for (const op of ['add', 'edit']) test(`${family}.${op} fails exactly once without leaking diagnostics`, async () => {
    for (const status of [403, 404, 409]) {
      const r = makeRecordingClient();
      r.enqueueError({response: {status, data: {errors: [{type: 'NoPermissionError', message: 'SECRET'}]}}, config: 'SECRET'});
      await assert.rejects(r.client[family][op](op === 'edit' ? {id: 'one'} : family === 'tiers' ? {name: 'Paid'} : offer), e => {
        assert.equal(e.statusCode, status);
        assert.equal(e.name, 'NoPermissionError');
        assert.equal(e.message.includes('SECRET'), false);
        assert.equal(e.response, undefined);
        return true;
      });
      assert.equal(r.requests.length, 1);
    }
  });
}
test('commerce supports explicit reactivation and valid fixed/repeating dependency fields', async () => {
  const r = makeRecordingClient();
  await r.client.tiers.edit({id: 'one', active: true});
  await r.client.offers.edit({id: 'one', status: 'active'});
  await r.client.offers.add({...offer, type: 'fixed', currency: 'USD', duration: 'repeating', duration_in_months: 3});
  assert.deepEqual(r.requests[0].data, {tiers: [{active: true}]});
  assert.deepEqual(r.requests[1].data, {offers: [{status: 'active'}]});
  assert.equal(r.requests[2].data.offers[0].currency, 'USD');
  assert.equal(r.requests[2].data.offers[0].duration_in_months, 3);
});
