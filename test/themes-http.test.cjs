const {test,after}=require('node:test');
const assert=require('node:assert/strict'),http=require('node:http'),{once}=require('node:events');
const {config}=require('./helpers/fixtures.cjs'),zip=require('./helpers/zipFixtures.cjs');
const ports=new Set();after(require('./helpers/loopbackGuard.cjs').allowLoopback(ports));
async function fixture(t,handler){
  const requests=[],server=http.createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);requests.push({method:req.method,url:req.url,headers:req.headers,body:Buffer.concat(chunks)});handler(req,res)});
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));server.listen(0,'127.0.0.1');await once(server,'listening');ports.add(server.address().port);
  return {url:`http://127.0.0.1:${server.address().port}`,requests};
}
function client(url,makeRequest){return require('../build/client/sdkAdapter.js').createGhostClient({...config,url},makeRequest?{makeRequest}:{})}

test('theme HTTP upload exact multipart and separate bodyless activation preserve authoritative state',async t=>{
  const theme={name:'actual-name',active:true,package:{name:'Package'},templates:[],warnings:[{rule:'inspect'}]},meta={unknown:{zero:0}};
  const f=await fixture(t,(req,res)=>res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({themes:[{...theme,active:req.method==='POST'}],meta})));
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness(client(f.url+'/blog'));t.after(m.close);
  const archive=zip.zip(),input=zip.input(archive);
  const output=await m.mcpClient.callTool({name:'themes_upload',arguments:input});assert.deepEqual(JSON.parse(output.content[0].text),{data:theme,meta});
  assert.equal(f.requests.length,1);const request=f.requests[0],boundary=/boundary=([a-f0-9]{48})$/.exec(request.headers['content-type'])?.[1];assert.ok(boundary);
  assert.deepEqual(request.body,Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="my-theme.zip"\r\nContent-Type: application/zip\r\n\r\n`),archive.bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]));
  assert.equal(request.url,'/blog/ghost/api/admin/themes/upload/');assert.equal(Number(request.headers['content-length']),request.body.length);
  const activated=await m.mcpClient.callTool({name:'themes_activate',arguments:{name:'café theme'}});
  assert.deepEqual(JSON.parse(activated.content[0].text),{data:{...theme,active:false},meta});assert.equal(f.requests.length,2);
  assert.equal(f.requests[1].url,'/blog/ghost/api/admin/themes/caf%C3%A9%20theme/activate/');assert.equal(f.requests[1].method,'PUT');
  assert.equal(f.requests[1].body.length,0);
  // Axios labels a bodyless PUT by default; no form or JSON bytes are sent.
  assert.equal(f.requests[1].headers['content-type'],'application/x-www-form-urlencoded');
  for(const r of f.requests){assert.match(r.headers.authorization,/^Ghost /);assert.equal(r.headers['accept-version'],'v5.0')}
});

for(const status of [403,404,422,500])test(`theme HTTP${status} failure is safe and never retries upload or activation`,async t=>{
  const f=await fixture(t,(req,res)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify({errors:[{type:status===422?'ThemeValidationError':'NoPermissionError',message:config.key+zip.input().base64,errorDetails:{path:'PRIVATE_SERVER_PATH'}}]})));
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness(client(f.url));t.after(m.close);
  for(const op of ['upload','activate']){
    const before=f.requests.length,result=await m.mcpClient.callTool({name:`themes_${op}`,arguments:op==='upload'?zip.input():{name:'explicit'}});
    assert.equal(result.isError,true);assert.match(result.content[0].text,new RegExp(`HTTP ${status}`));if(status===422)assert.match(result.content[0].text,/ThemeValidationError/);
    assert.equal(f.requests.length,before+1);assert.ok(!JSON.stringify(result).includes(config.key));assert.ok(!JSON.stringify(result).includes('PRIVATE_SERVER_PATH'));
  }
});

test('theme redirect timeout and oversized responses fail once without follow-up site mutations',async t=>{
  let followed=0;const destination=await fixture(t,(req,res)=>{followed++;res.end('{}')});
  const redirect=await fixture(t,(req,res)=>res.writeHead(307,{Location:destination.url+'/never'}).end());
  for(const op of ['upload','activate'])await assert.rejects(client(redirect.url).themes[op](op==='upload'?zip.input():{name:'explicit'}),/HTTP 307/);
  assert.equal(redirect.requests.length,2);assert.equal(followed,0);
  const slow=await fixture(t,()=>{}),execute=require('../build/client/nativeRequest.js').createNativeRequestExecutor({timeoutMs:30,maxBodyLength:10493952,maxContentLength:1048576});
  for(const op of ['upload','activate'])await assert.rejects(client(slow.url,execute).themes[op](op==='upload'?zip.input():{name:'explicit'}),/request failed/);
  assert.equal(slow.requests.length,2);
  const big=await fixture(t,(req,res)=>res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({themes:[{name:'actual',active:true,extra:'x'.repeat(1048576)}]})));
  for(const op of ['upload','activate'])await assert.rejects(client(big.url).themes[op](op==='upload'?zip.input():{name:'explicit'}),/request failed/);assert.equal(big.requests.length,2);
});
