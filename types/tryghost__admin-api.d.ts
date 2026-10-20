declare module '@tryghost/admin-api' {
    type Options = {
        url: string;
        key: string;
        version: string;
        makeRequest?: (request: {
            url: string;
            method: string;
            data?: unknown;
            params?: Record<string, string | number | boolean | undefined>;
            headers?: Record<string, string>;
        }) => Promise<unknown>;
    };
    // The SDK's runtime resource set is checked in client/sdkAdapter.ts.
    const GhostAdminAPI: new (options: Options) => unknown;
    export default GhostAdminAPI;
}
