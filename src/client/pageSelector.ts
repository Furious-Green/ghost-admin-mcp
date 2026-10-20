// The SDK interpolates selectors verbatim. Validate and encode exactly one
// segment before handing it to the SDK, including for non-MCP client callers.
export function encodePageSelector(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value === '.' || value === '..'
        || /[\\/?#%\x00-\x1f\x7f]/.test(value)) {
        throw new Error('Invalid Ghost page selector');
    }
    try {
        return encodeURIComponent(value);
    } catch {
        throw new Error('Invalid Ghost page selector');
    }
}
