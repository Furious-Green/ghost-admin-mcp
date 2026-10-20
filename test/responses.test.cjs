const {test} = require('node:test');
const assert = require('node:assert/strict');

test('normalization keeps collections and response metadata outside entity fields', () => {
  const {normalizeCollection, normalizeEntity} = require('../build/client/responses.js');
  for (const items of [[], [{id: 'one'}], [{id: 'one'}, {id: 'two'}]]) {
    const input = {posts: items};
    const original = structuredClone(input);
    assert.deepEqual(normalizeCollection('posts', input), {data: items});
    assert.deepEqual(input, original);
    assert.equal(Object.hasOwn(normalizeCollection('posts', input).data, 'meta'), false);
  }
  assert.deepEqual(normalizeCollection('posts', {posts: [], meta: undefined}), {data: []});
  assert.deepEqual(normalizeCollection('posts', {posts: [], meta: {}}), {data: [], meta: {}});
  const input = {posts: [{id: 'one', data: 'own', meta: {own: true}}], meta: {pagination: {next: null}, unknown: ['x', null]}};
  assert.deepEqual(normalizeEntity('posts', input), {data: {id: 'one', data: 'own', meta: {own: true}}, meta: {pagination: {next: null}, unknown: ['x', null]}});
  assert.deepEqual(input.posts, [{id: 'one', data: 'own', meta: {own: true}}]);
});

test('normalization rejects malformed resource envelopes without reflecting payloads', () => {
  const {normalizeCollection, normalizeEntity} = require('../build/client/responses.js');
  for (const value of [undefined, null, '', 1, {}, {pages: [{}]}, {posts: {}}, {posts: null}, {posts: [null]}, {posts: [[]]}, {posts: [1]}, ...[null, false, 0, 'SECRET', []].map(meta => ({posts: [{id: 'one'}], meta}))]) {
    assert.throws(() => normalizeCollection('posts', value), {message: 'Unexpected Ghost posts response'});
    assert.throws(() => normalizeEntity('posts', value), {message: 'Unexpected Ghost posts response'});
  }
  for (const posts of [[], [{}, {}]]) assert.throws(() => normalizeEntity('posts', {posts}), /Unexpected Ghost posts response/);
  // An injected decoded-body executor must not turn a hole into data:undefined.
  assert.throws(() => normalizeEntity('posts', {posts: Array(1)}), /Unexpected Ghost posts response/);
  assert.throws(() => normalizeCollection('posts', {posts: Array(1)}), /Unexpected Ghost posts response/);
  assert.throws(() => normalizeEntity('pages', {pages: []}, 'Unexpected Ghost copy response'), {message: 'Unexpected Ghost copy response'});
});
