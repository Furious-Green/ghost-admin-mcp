const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
const {config}=require('./helpers/fixtures.cjs');
const fixtures=require('./helpers/imageFixtures.cjs');
const ports=new Set();after(require('./helpers/loopbackGuard.cjs').allowLoopback(ports));
async function fixture(t,handler){
  const requests=[];const server=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    requests.push({url:req.url,method:req.method,headers:req.headers,body:Buffer.concat(chunks)});handler(req,res);
  });
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
  server.listen(0,'127.0.0.1');await once(server,'listening');ports.add(server.address().port);
  return {url:`http://127.0.0.1:${server.address().port}`,requests};
}
function client(url,makeRequest){return require('../build/client/sdkAdapter.js').createGhostClient({...config,url},makeRequest?{makeRequest}:{})}
function parts(request){
  const boundary=/boundary=([a-f0-9]{48})$/.exec(request.headers['content-type'])?.[1];assert.ok(boundary);
  // latin1 preserves binary byte values for independent wire parsing.
  return request.body.toString('latin1').split(`--${boundary}`).slice(1,-1).map(part=>{
    assert.ok(part.startsWith('\r\n')&&part.endsWith('\r\n'));
    const split=part.indexOf('\r\n\r\n');return {headers:part.slice(2,split),bytes:Buffer.from(part.slice(split+4,-2),'latin1')};
  });
}

test('actual image multipart carries file bytes/ref/JWT once and never follows returned storage URL',async t=>{
  const f=await fixture(t,(req,res)=>res.writeHead(201,{'Content-Type':'application/json'}).end(JSON.stringify({images:[{url:'https://external-storage.invalid/image.png',ref:null}],meta:{zero:0}})));
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness(client(f.url+'/blog'));t.after(m.close);
  for(const [index,image]of fixtures.images.entries()){
    const input={...fixtures.input(image),...(index%2?{ref:'reference:你好'}:{})};
    const response=await m.mcpClient.callTool({name:'images_upload',arguments:input});assert.notEqual(response.isError,true,response.content[0].text);
    assert.deepEqual(JSON.parse(response.content[0].text),{data:{url:'https://external-storage.invalid/image.png',ref:null},meta:{zero:0}});
    const request=f.requests[index],parsed=parts(request);
    assert.equal(request.url,'/blog/ghost/api/admin/images/upload/');assert.equal(request.method,'POST');
    assert.equal(request.headers['accept-version'],'v5.0');assert.match(request.headers.authorization,/^Ghost /);
    assert.equal(Number(request.headers['content-length']),request.body.length);
    assert.equal(parsed.length,input.ref===undefined?1:2);
    assert.equal(parsed[0].headers,`Content-Disposition: form-data; name="file"; filename="${image.filename}"\r\nContent-Type: ${image.mime_type}`);
    assert.deepEqual(parsed[0].bytes,image.bytes);
    if(input.ref!==undefined){assert.equal(parsed[1].headers,'Content-Disposition: form-data; name="ref"');assert.equal(parsed[1].bytes.toString('utf8'),input.ref)}
  }
  assert.equal(f.requests.length,4);
});

for(const status of [403,413,500])test(`upload HTTP${status} is safe and never retried`,async t=>{
  const payload=fixtures.input().base64;
  const f=await fixture(t,(req,res)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify({errors:[{message:payload+config.key,type:'ValidationError'}]})));
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness(client(f.url));t.after(m.close);
  const result=await m.mcpClient.callTool({name:'images_upload',arguments:fixtures.input()});assert.equal(result.isError,true);
  assert.match(result.content[0].text,new RegExp(`HTTP ${status}`));assert.equal(f.requests.length,1);
  assert.ok(!JSON.stringify(result).includes(payload));assert.ok(!JSON.stringify(result).includes(config.key));
});

test('image upload rejects redirect, socket loss and timeout after one request',async t=>{
  let destinations=0;const destination=await fixture(t,(req,res)=>{destinations++;res.end('{}')});
  const redirect=await fixture(t,(req,res)=>res.writeHead(307,{Location:destination.url+'/never'}).end());
  await assert.rejects(client(redirect.url).images.upload(fixtures.input()),/HTTP 307/);
  assert.equal(redirect.requests.length,1);assert.equal(destinations,0);
  const broken=await fixture(t,(req,res)=>req.socket.destroy());
  await assert.rejects(client(broken.url).images.upload(fixtures.input()),/request failed/);assert.equal(broken.requests.length,1);
  const slow=await fixture(t,()=>{});
  const execute=require('../build/client/nativeRequest.js').createNativeRequestExecutor({timeoutMs:30,maxBodyLength:5251072,maxContentLength:65536});
  await assert.rejects(client(slow.url,execute).images.upload(fixtures.input()),/request failed/);assert.equal(slow.requests.length,1);
});

test('upload default transport caps response bytes and request builder accepts exact five MiB',async t=>{
  const big=await fixture(t,(req,res)=>res.writeHead(201,{'Content-Type':'application/json'}).end(JSON.stringify({images:[{url:'/x',extra:'x'.repeat(65536)}]})));
  await assert.rejects(client(big.url).images.upload(fixtures.input()),/request failed/);assert.equal(big.requests.length,1);
  const compressed=await fixture(t,(req,res)=>res.writeHead(201,{'Content-Type':'application/json','Content-Encoding':'gzip'}).end(require('node:zlib').gzipSync(JSON.stringify({images:[{url:'/x',extra:'x'.repeat(65536)}]}))));
  await assert.rejects(client(compressed.url).images.upload(fixtures.input()),/request failed/);assert.equal(compressed.requests.length,1);
  const f=await fixture(t,(req,res)=>res.writeHead(201,{'Content-Type':'application/json'}).end('{"images":[{"url":"/returned"}]}'));
  const bytes=Buffer.alloc(5*1024*1024);fixtures.images[1].bytes.copy(bytes);
  assert.deepEqual(await client(f.url).images.upload({...fixtures.input(),base64:bytes.toString('base64')}),{data:{url:'/returned'}});
  assert.deepEqual(parts(f.requests[0])[0].bytes,bytes);assert.ok(f.requests[0].body.length<=5*1024*1024+8192);
  for(const field of ['maxBodyLength','maxContentLength'])for(const limit of [0,-1,Infinity,1.5]){
    assert.throws(()=>require('../build/client/nativeRequest.js').createNativeRequestExecutor({[field]:limit}),/Invalid native request size limit/);
  }
});
