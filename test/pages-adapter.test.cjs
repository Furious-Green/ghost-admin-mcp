const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {blockNetwork} = require('./helpers/networkGuard.cjs');
after(blockNetwork());
const {z} = require('zod');
const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
const {config, timestamp, entity} = require('./helpers/fixtures.cjs');

test('page schemas retain content fields without broadening posts', () => {
  const pages = require('../build/tools/pages.js');
  const posts = require('../build/tools/posts.js');
  const content = {title: 'About', html: '<p>About</p>', lexical: '{"root":{}}', slug: 'about',
    status: 'draft', visibility: 'public', featured: true, published_at: timestamp,
    custom_excerpt: 'About us', feature_image: 'https://images.invalid/a.jpg', feature_image_alt: 'alt',
    feature_image_caption: 'caption', meta_title: 'SEO', meta_description: 'Description', og_title: 'OG',
    og_description: 'OG desc', og_image: 'https://images.invalid/og.jpg', twitter_title: 'Twitter',
    twitter_description: 'Twitter desc', twitter_image: 'https://images.invalid/t.jpg',
    codeinjection_head: '<style></style>', codeinjection_foot: '<script></script>', canonical_url: 'https://example.invalid/about',
    tags: ['tag', {id: 'tag1', slug: 'tag', name: 'Tag'}], authors: ['a@example.invalid', {id: 'author1', slug: 'author', email: 'a@example.invalid'}]};
  assert.deepEqual(z.object(pages.addParams).parse({...content, custom_template: 'about', email_only: true, unknown: true}), {...content, custom_template: 'about'});
  assert.deepEqual(z.object(posts.addParams).parse({...content, email_only: true, custom_template: 'about', unknown: true}), {...content, email_only: true});
  assert.equal(z.object(posts.editParams).safeParse({id: 'abc123'}).success, false);
  assert.equal(z.object(pages.editParams).safeParse({id: 'abc123'}).success, false);
  assert.equal(z.object(pages.editParams).safeParse({id: '', updated_at: timestamp}).success, false);
  assert.deepEqual(z.object(pages.editParams).parse({...content, id: 'abc123', updated_at: timestamp}), {...content, id: 'abc123', updated_at: timestamp});
});

test('page queries validate pagination and formats', () => {
  const pages = require('../build/tools/pages.js');
  const schema = z.object(pages.browseParams);
  for (const field of ['page', 'limit']) {
    for (const value of [0, -1, 1.5, '15']) assert.equal(schema.safeParse({[field]: value}).success, false);
  }
  assert.deepEqual(schema.parse({page: 2, limit: 'all'}), {page: 2, limit: 'all'});
  assert.equal(schema.parse({limit: 15}).limit, 15);
  for (const formats of ['html', 'lexical', 'html,lexical', 'lexical,html']) assert.equal(schema.parse({formats}).formats, formats);
  for (const formats of ['plaintext', '']) assert.equal(schema.safeParse({formats}).success, false);
});

const cases = [
  {operation: 'browse', args: {page: 2, limit: 'all', include: 'tags,authors', formats: 'html,lexical'}, path: '', method: 'GET', query: {page: 2, limit: 'all', include: 'tags,authors', formats: 'html,lexical'}, body: ''},
  {operation: 'read', args: {id: 'abc123'}, options: {fields: 'id,title'}, path: 'abc123/', method: 'GET', query: {fields: 'id,title'}, body: ''},
  {operation: 'read', args: {slug: 'about'}, options: {formats: 'html'}, path: 'slug/about/', method: 'GET', query: {formats: 'html'}, body: ''},
  {operation: 'add', args: {title: 'About', html: '<p>About</p>'}, options: {source: 'html'}, path: '', method: 'POST', query: {source: 'html'}, body: {pages: [{title: 'About', html: '<p>About</p>'}]}},
  {operation: 'add', args: {title: 'About', lexical: '{"root":{}}'}, path: '', method: 'POST', query: {}, body: {pages: [{title: 'About', lexical: '{"root":{}}'}]}},
  {operation: 'edit', args: {id: 'abc123', updated_at: timestamp, html: '<p>Changed</p>'}, options: {source: 'html'}, path: 'abc123/', method: 'PUT', query: {source: 'html'}, body: {pages: [{updated_at: timestamp, html: '<p>Changed</p>'}]}},
  {operation: 'delete', args: {id: 'abc123'}, path: 'abc123/', method: 'DELETE', query: {}, body: {id: 'abc123'}},
];
for (const [index, c] of cases.entries()) {
  test(`page SDK request ${index}: ${c.operation} ${c.path}`, async () => {
    const {client, enqueueResponse, requests} = makeRecordingClient();
    enqueueResponse(c.operation === 'delete' ? '' : {pages: [entity]});
    const result = await client.pages[c.operation](structuredClone(c.args), c.options);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `${config.url}/ghost/api/admin/pages/${c.path}`);
    assert.equal(requests[0].method, c.method);
    assert.deepEqual(requests[0].params, c.query);
    assert.deepEqual(requests[0].data, c.body);
    assert.equal(requests[0].headers['Accept-Version'], 'v5.0');
    assert.match(requests[0].headers.Authorization, /^Ghost /);
    assert.deepEqual(result, c.operation === 'delete' ? undefined : entity);
  });
}

test('typed page client rejects traversal independently of MCP validation', async () => {
  const {client, requests} = makeRecordingClient();
  for (const operation of ['read', 'edit', 'delete']) {
    for (const id of ['../posts/victim', '%2e%2e', 'a/b', 'a\\b', 'a?x=y', 'a#frag', '.', '..', 'a\n']) {
      await assert.rejects(client.pages[operation]({id, updated_at: timestamp}), /Invalid Ghost page selector/);
    }
  }
  await assert.rejects(client.pages.read({slug: '../posts/victim'}), /Invalid Ghost page selector/);
  assert.equal(requests.length, 0);
});

test('page selectors encode Unicode and spaces without encoding edited content slugs', async () => {
  const {client, requests} = makeRecordingClient();
  await client.pages.read({slug: 'über uns'});
  assert.equal(requests[0].url, `${config.url}/ghost/api/admin/pages/slug/%C3%BCber%20uns/`);
  await client.pages.edit({id: 'abc123', updated_at: timestamp, slug: 'über-uns'});
  assert.deepEqual(requests[1].data, {pages: [{updated_at: timestamp, slug: 'über-uns'}]});
});
