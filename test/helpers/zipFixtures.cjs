// Independent classic ZIP builder; compression/CRC are test-only, never production.
const {deflateRawSync}=require('node:zlib');
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
exports.zip=function zip(files=[{name:'index.hbs',data:'Hello'}],comment=''){
  const locals=[],centrals=[],entries=[];let offset=0;
  for(const file of files){
    const name=Buffer.from(file.name),data=Buffer.isBuffer(file.data)?file.data:Buffer.from(file.data??'Hello');
    const method=file.method??0,compressed=method===8?deflateRawSync(data):data,crc=crc32(data);
    const flags=file.flags??(file.descriptor?8:0)|(/[^\x00-\x7f]/.test(file.name)?0x800:0);
    const extra=file.extra??Buffer.alloc(0),local=Buffer.alloc(30),central=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(flags,6);local.writeUInt16LE(method,8);
    if(!file.descriptor){local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22)}
    local.writeUInt16LE(name.length,26);local.writeUInt16LE(extra.length,28);
    const descriptor=file.descriptor?Buffer.alloc(file.signed===false?12:16):Buffer.alloc(0),d=descriptor.length===16?4:0;
    if(descriptor.length){if(d)descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(crc,d);descriptor.writeUInt32LE(compressed.length,d+4);descriptor.writeUInt32LE(data.length,d+8)}
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(0x314,4);central.writeUInt16LE(20,6);central.writeUInt16LE(flags,8);central.writeUInt16LE(method,10);
    central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(data.length,24);
    central.writeUInt16LE(name.length,28);central.writeUInt16LE(extra.length,30);
    central.writeUInt32LE(((file.mode??(file.name.endsWith('/')?0x41ed:0x81a4))*65536)>>>0,38);central.writeUInt32LE(offset,42);
    entries.push({local:offset,localHeader:local,centralHeader:central,dataEnd:offset+30+name.length+extra.length+compressed.length});
    locals.push(local,name,extra,compressed,descriptor);centrals.push(central,name,extra);offset+=30+name.length+extra.length+compressed.length+descriptor.length;
  }
  const cd=Buffer.concat(centrals),end=Buffer.alloc(22),commentBytes=Buffer.from(comment);end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(commentBytes.length,20);
  let c=offset;for(let i=0;i<entries.length;i++){entries[i].central=c;c+=centrals[i*3].length+centrals[i*3+1].length+centrals[i*3+2].length}
  return {bytes:Buffer.concat([...locals,cd,end,commentBytes]),entries,eocd:offset+cd.length,cd:offset};
};
exports.input=function input(archive=exports.zip()){return {filename:'my-theme.zip',base64:archive.bytes.toString('base64')}};
