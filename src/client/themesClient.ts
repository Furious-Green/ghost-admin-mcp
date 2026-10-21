import {z} from 'zod';
import {prepareThemeUpload, prepareThemeActivate, MAX_THEME_MULTIPART_BYTES} from '../schemas/themes';
import {createFileMultipart} from './fileMultipart';
import {createNativeAdminRequest} from './nativeAdmin';
import {normalizeEntity} from './responses';
import type {EntityResponse, GhostClient, GhostConfig, RequestExecutor} from './types';

function response(value: unknown): EntityResponse {
    const result = normalizeEntity('themes', value);
    if (typeof result.data.name !== 'string' || !result.data.name.trim() || typeof result.data.active !== 'boolean') throw new Error('Unexpected Ghost themes response');
    return result;
}

export function createThemeClient(config: GhostConfig, makeRequest?: RequestExecutor): GhostClient['themes'] {
    const send = createNativeAdminRequest(config, makeRequest);
    const optionsValid = (options: unknown) => z.object({}).strict().safeParse(options === undefined ? {} : options).success;
    return {
        upload: async (input, options) => {
            if (!optionsValid(options)) throw new Error('Invalid Ghost theme upload input.');
            const prepared = prepareThemeUpload(input);
            const multipart = createFileMultipart({...prepared.input, mime_type: 'application/zip'}, prepared.bytes, MAX_THEME_MULTIPART_BYTES, 'Invalid Ghost theme upload input.');
            return response(await send('themes.upload', {multipart}));
        },
        activate: async (input, options) => {
            if (!optionsValid(options)) throw new Error('Invalid Ghost theme activate input.');
            const prepared = prepareThemeActivate(input);
            return response(await send('themes.activate', {id: prepared.name}));
        },
    };
}
