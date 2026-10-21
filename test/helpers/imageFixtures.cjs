// Header-level fixtures: validate type identification, not complete image decoding.
exports.images = [
  {filename:'photo.jpg',mime_type:'image/jpeg',bytes:Buffer.from([0xff,0xd8,0xff,0xe0,0,0xff,0,0xd9])},
  {filename:'pixel.png',mime_type:'image/png',bytes:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=','base64')},
  {filename:'animated.gif',mime_type:'image/gif',bytes:Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;','binary')},
  {filename:'picture.webp',mime_type:'image/webp',bytes:Buffer.from('524946460c000000574542505650382000000000','hex')},
];
exports.input = function(image=exports.images[1]) {
  return {filename:image.filename,mime_type:image.mime_type,base64:image.bytes.toString('base64')};
};
