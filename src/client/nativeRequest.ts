import axios from 'axios';
import type {RequestExecutor} from './types';

export const NATIVE_REQUEST_TIMEOUT_MS = 30000;

export function createNativeRequestExecutor(options: {timeoutMs?: number} = {}): RequestExecutor {
    const timeout = options.timeoutMs ?? NATIVE_REQUEST_TIMEOUT_MS;
    if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('Invalid native request timeout');
    return async request => {
        const response = await axios({
            ...request,
            timeout,
            maxRedirects: 0,
            proxy: false,
        });
        return response.data;
    };
}
