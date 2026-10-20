const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');

test('SDK executor matches pinned default options and encoding without adopting native policies', () => {
  // Intercept only the external HTTP boundary, in a disposable process. Both
  // the real SDK and our executor still construct their actual Axios configs.
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    require('./test/helpers/networkGuard.cjs').blockNetwork();
    const axiosPath = require.resolve('axios');
    require(axiosPath);
    const configs = [];
    let failure;
    require.cache[axiosPath].exports = async config => {
      configs.push(config);
      if (failure) throw failure;
      return {data: {posts: [{id:'one'}]}};
    };
    (async () => {
      const {config} = require('./test/helpers/fixtures.cjs');
      const sdk = require('@tryghost/admin-api')(config);
      const params = {fields:'id,title', filter:'name:A B'};
      await sdk.posts.browse(params);
      const first = configs[0];
      const execute = require('./build/client/sdkRequest.js').createSdkRequestExecutor();
      assert.deepEqual(await execute({url:first.url, method:first.method, data:first.data, params:first.params, headers:first.headers}), {posts:[{id:'one'}]});
      const second = configs[1];
      for (const c of configs) {
        assert.equal(c.maxContentLength, Infinity);
        assert.equal(c.maxBodyLength, Infinity);
        for (const key of ['timeout','maxRedirects','proxy']) assert.equal(Object.hasOwn(c,key), false);
        assert.equal(c.paramsSerializer(params), 'fields=id%2Ctitle&filter=name%3AA%20B');
        assert.equal(c.paramsSerializer({}), '');
        assert.equal(c.paramsSerializer({nil:null, absent:undefined, list:['a','b']}), 'nil=&absent=&list=a%2Cb');
      }
      const withoutSerializer = ({paramsSerializer,...rest}) => rest;
      assert.deepEqual(withoutSerializer(first), withoutSerializer(second));
      failure = {message:'fixture failure', response:{status:403}, config:{private:true}};
      await assert.rejects(execute({url:config.url,method:'POST'}), e => e === failure);
      assert.equal(configs.length, 3);
    })().catch(e => {console.error(e); process.exitCode=1;});
  `], {cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8', timeout: 5000});
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});
