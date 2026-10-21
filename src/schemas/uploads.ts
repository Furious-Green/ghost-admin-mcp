import {z} from 'zod';

export const uploadFilename = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._ -]*$/);

export function decodeUploadBase64(value: string, maxBytes: number, message: string): Buffer {
    const invalid = (): never => { throw new Error(message); };
    if (!value.length || value.length > Math.ceil(maxBytes / 3) * 4 || value.length % 4 !== 0
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return invalid();
    const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
    const size = value.length / 4 * 3 - padding;
    if (size <= 0 || size > maxBytes) return invalid();
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lastSextet = alphabet.indexOf(value[value.length - padding - 1]);
    if (padding > 0 && (lastSextet & (padding === 2 ? 15 : 3)) !== 0) return invalid();
    const bytes = Buffer.from(value, 'base64');
    if (bytes.length !== size || bytes.toString('base64') !== value) return invalid();
    return bytes;
}
