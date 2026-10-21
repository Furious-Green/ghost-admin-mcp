import axios from 'axios';
import type {RequestExecutor} from './types';

export const NATIVE_REQUEST_TIMEOUT_MS = 30000;

export function createNativeRequestExecutor(options: {timeoutMs?: number; maxBodyLength?: number; maxContentLength?: number} = {}): RequestExecutor {
    const timeout = options.timeoutMs ?? NATIVE_REQUEST_TIMEOUT_MS;
    if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('Invalid native request timeout');
    for (const limit of [options.maxBodyLength, options.maxContentLength]) {
        if (limit !== undefined && (!Number.isSafeInteger(limit) || limit <= 0)) throw new Error('Invalid native request size limit');
    }
    return async request => {
        const response = await axios({
            ...request,
            timeout,
            maxRedirects: 0,
            proxy: false,
            ...(options.maxBodyLength !== undefined ? {maxBodyLength: options.maxBodyLength} : {}),
            ...(options.maxContentLength !== undefined ? {maxContentLength: options.maxContentLength} : {}),
        });
        return response.data;
    };
}
