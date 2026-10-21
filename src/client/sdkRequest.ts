import axios from 'axios';
import type {RequestExecutor} from './types';

// Match the pinned @tryghost/admin-api default transport. Native adapters have
// deliberately different HTTP policy; do not substitute their executor here.
export function createSdkRequestExecutor(): RequestExecutor {
    return async ({url, method, data, params = {}, headers = {}}) => {
        const response = await axios({
            url, method, params, data, headers,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            paramsSerializer(parameters) {
                return Object.keys(parameters).map(key =>
                    `${key}=${encodeURIComponent(([] as unknown[]).concat(parameters[key]).join(','))}`).join('&');
            },
        });
        return response.data;
    };
}
