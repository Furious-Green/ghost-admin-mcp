import {z} from 'zod';
import {prepareImageUpload} from '../schemas/images';
import {createImageMultipart} from './imageMultipart';
import {createNativeAdminRequest} from './nativeAdmin';
import {normalizeEntity} from './responses';
import type {GhostClient, GhostConfig, RequestExecutor} from './types';

export function createImageClient(config: GhostConfig, makeRequest?: RequestExecutor): GhostClient['images'] {
    const send = createNativeAdminRequest(config, makeRequest);
    return {upload: async (input, options) => {
        if (!z.object({}).strict().safeParse(options === undefined ? {} : options).success) throw new Error('Invalid Ghost image upload input.');
        const prepared = prepareImageUpload(input);
        const response = normalizeEntity('images', await send('images.upload', {multipart: createImageMultipart(prepared.input, prepared.bytes)}));
        const {url, ref} = response.data;
        if (typeof url !== 'string' || !url.trim() || (ref !== undefined && ref !== null && typeof ref !== 'string')) throw new Error('Unexpected Ghost images response');
        return response;
    }};
}
