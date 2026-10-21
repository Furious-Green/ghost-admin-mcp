import {z} from 'zod';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;
export const MAX_IMAGE_MULTIPART_BYTES = MAX_IMAGE_BYTES + 8192;
export const MAX_IMAGE_RESPONSE_BYTES = 65536;
export const imageUploadParams = {
    base64: z.string().min(1).max(MAX_IMAGE_BASE64_LENGTH),
    filename: z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._ -]*$/),
    mime_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    ref: z.string().max(1024).refine(value => value.trim().length > 0 && !/[\x00-\x1f\x7f]/.test(value)).optional(),
};
const schema = z.object(imageUploadParams).strict();
export type ImageUploadInput = z.infer<typeof schema>;
const extensions = {'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/gif': ['gif'], 'image/webp': ['webp']};

export function prepareImageUpload(value: unknown): {input: ImageUploadInput; bytes: Buffer} {
    const invalid = (): never => { throw new Error('Invalid Ghost image upload input.'); };
    const parsed = schema.safeParse(value);
    if (!parsed.success) return invalid();
    const input = parsed.data;
    const encoded = input.base64;
    // Enforce caps before scanning or allocating a decoded buffer. Buffer.from
    // alone is permissive about whitespace, URL-safe alphabet and bad padding.
    if (encoded.length > MAX_IMAGE_BASE64_LENGTH || encoded.length % 4 !== 0
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return invalid();
    const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
    const size = encoded.length / 4 * 3 - padding;
    if (size <= 0 || size > MAX_IMAGE_BYTES) return invalid();
    const extension = input.filename.split('.').pop()?.toLowerCase() ?? '';
    if (!extensions[input.mime_type].includes(extension)) return invalid();
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length !== size || bytes.toString('base64') !== encoded) return invalid();
    const matches = {
        'image/jpeg': bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
        'image/png': bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
        'image/gif': ['GIF87a', 'GIF89a'].some(header => bytes.subarray(0, 6).equals(Buffer.from(header))),
        'image/webp': bytes.length >= 12 && bytes.subarray(0, 4).equals(Buffer.from('RIFF')) && bytes.subarray(8, 12).equals(Buffer.from('WEBP')),
    };
    if (!matches[input.mime_type]) return invalid();
    return {input, bytes};
}
