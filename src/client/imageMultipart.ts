import {randomBytes} from 'node:crypto';
import {MAX_IMAGE_MULTIPART_BYTES, type ImageUploadInput} from '../schemas/images';

export function createImageMultipart(input: ImageUploadInput, bytes: Buffer): {body: Buffer; boundary: string} {
    const boundary = randomBytes(24).toString('hex');
    const parts = [Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${input.filename}"\r\nContent-Type: ${input.mime_type}\r\n\r\n`), bytes];
    if (input.ref !== undefined) parts.push(Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="ref"\r\n\r\n${input.ref}`));
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    if (length > MAX_IMAGE_MULTIPART_BYTES) throw new Error('Invalid Ghost image upload input.');
    return {body: Buffer.concat(parts, length), boundary};
}
