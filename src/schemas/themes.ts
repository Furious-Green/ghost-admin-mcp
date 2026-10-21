import {z} from 'zod';
import {selector} from './query';
import {decodeUploadBase64, uploadFilename} from './uploads';
import {inspectThemeZip} from './zipArchive';

export const MAX_THEME_BYTES = 10 * 1024 * 1024;
export const MAX_THEME_BASE64_LENGTH = Math.ceil(MAX_THEME_BYTES / 3) * 4;
export const MAX_THEME_MULTIPART_BYTES = MAX_THEME_BYTES + 8192;
export const MAX_THEME_RESPONSE_BYTES = 1024 * 1024;
export const themeUploadParams = {base64: z.string().min(1).max(MAX_THEME_BASE64_LENGTH), filename: uploadFilename.refine(name => name.toLowerCase().endsWith('.zip'))};
export const themeActivateParams = {name: selector.and(z.string().max(191))};
const upload = z.object(themeUploadParams).strict(), activate = z.object(themeActivateParams).strict();
export type ThemeUploadInput = z.infer<typeof upload>;
export type ThemeActivateInput = z.infer<typeof activate>;
export function prepareThemeUpload(value: unknown): {input: ThemeUploadInput; bytes: Buffer} {
    const parsed = upload.safeParse(value);
    if (!parsed.success) throw new Error('Invalid Ghost theme upload input.');
    const bytes = decodeUploadBase64(parsed.data.base64, MAX_THEME_BYTES, 'Invalid Ghost theme upload input.');
    inspectThemeZip(bytes);
    return {input: parsed.data, bytes};
}
export function prepareThemeActivate(value: unknown): ThemeActivateInput {
    const parsed = activate.safeParse(value);
    if (!parsed.success) throw new Error('Invalid Ghost theme activate input.');
    return parsed.data;
}
