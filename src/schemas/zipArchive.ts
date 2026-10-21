// Conservative metadata-only ZIP inspection. Never decompress or touch disk.
// Declared sizes/CRC may lie; Ghost still owns actual extraction and validation.
export const MAX_THEME_ENTRIES = 2000;
export const MAX_THEME_EXPANDED_BYTES = 100 * 1024 * 1024;
const invalid = (): never => { throw new Error('Invalid Ghost theme upload archive.'); };

function extras(bytes: Buffer): void {
    for (let at = 0; at < bytes.length;) {
        if (at + 4 > bytes.length) invalid();
        const id = bytes.readUInt16LE(at), size = bytes.readUInt16LE(at + 2);
        if ([1, 0x7075, 0x9901].includes(id) || at + 4 + size > bytes.length) invalid();
        at += 4 + size;
    }
}

function entryName(bytes: Buffer, flags: number): string {
    if (!bytes.length || bytes.length > 1024 || (!(flags & 0x800) && bytes.some(byte => byte > 127))) return invalid();
    let name: string;
    try { name = new TextDecoder('utf-8', {fatal: true}).decode(bytes); } catch { return invalid(); }
    const normalized = name.normalize('NFKC');
    if (/[\\:\x00-\x1f\x7f]/.test(normalized) || normalized.startsWith('/')) return invalid();
    const parts = normalized.replace(/\/$/, '').split('/');
    if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part)
        || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) return invalid();
    return name;
}

export function inspectThemeZip(bytes: Buffer): void {
    if (bytes.length < 22) return invalid();
    let end = -1;
    for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65535); at--) {
        if (bytes.readUInt32LE(at) === 0x06054b50 && at + 22 + bytes.readUInt16LE(at + 20) === bytes.length) { end = at; break; }
    }
    if (end < 0) return invalid();
    const count = bytes.readUInt16LE(end + 10), start = bytes.readUInt32LE(end + 16), size = bytes.readUInt32LE(end + 12);
    if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || !count || count > MAX_THEME_ENTRIES
        || bytes.readUInt16LE(end + 8) !== count || start + size !== end) return invalid();
    let at = start, expanded = 0, files = 0;
    const ranges: {start: number; end: number}[] = [], paths = new Map<string, boolean>();
    for (let i = 0; i < count; i++) {
        if (at + 46 > end || bytes.readUInt32LE(at) !== 0x02014b50) return invalid();
        const flags = bytes.readUInt16LE(at + 8), method = bytes.readUInt16LE(at + 10);
        const crc = bytes.readUInt32LE(at + 16), compressed = bytes.readUInt32LE(at + 20), uncompressed = bytes.readUInt32LE(at + 24);
        const nameSize = bytes.readUInt16LE(at + 28), extraSize = bytes.readUInt16LE(at + 30), commentSize = bytes.readUInt16LE(at + 32);
        const next = at + 46 + nameSize + extraSize + commentSize, local = bytes.readUInt32LE(at + 42);
        if (next > end || flags & ~0x080e || ![0, 8].includes(method) || bytes.readUInt16LE(at + 34)
            || compressed === 0xffffffff || uncompressed === 0xffffffff || (method === 0 && compressed !== uncompressed)) return invalid();
        expanded += uncompressed;
        if (expanded > MAX_THEME_EXPANDED_BYTES) return invalid();
        const rawName = bytes.subarray(at + 46, at + 46 + nameSize), name = entryName(rawName, flags), directory = name.endsWith('/');
        // Conservative compatibility/case alias key, shared by duplicate and
        // parent checks. Uppercase folds final sigma/ligatures; capital sharp S
        // needs the same expansion as lowercase sharp S. May reject extra aliases.
        const key = name.normalize('NFKC').replace(/\/$/, '').replace(/\u1e9e/g, 'SS').toUpperCase().normalize('NFKC');
        if (paths.has(key) || (directory && uncompressed !== 0)) return invalid();
        paths.set(key, directory); if (!directory) files++;
        const attrs = bytes.readUInt32LE(at + 38), type = (attrs >>> 16) & 0xf000;
        if (![0, 0x8000, 0x4000].includes(type) || (type === 0x4000 && !directory) || (type === 0x8000 && directory)
            || ((attrs & 0x10) !== 0 && !directory) || (attrs & 8)) return invalid();
        extras(bytes.subarray(at + 46 + nameSize, at + 46 + nameSize + extraSize));
        if (local + 30 > start || bytes.readUInt32LE(local) !== 0x04034b50
            || bytes.readUInt16LE(local + 6) !== flags || bytes.readUInt16LE(local + 8) !== method) return invalid();
        const localNameSize = bytes.readUInt16LE(local + 26), localExtraSize = bytes.readUInt16LE(local + 28);
        const data = local + 30 + localNameSize + localExtraSize;
        if (data + compressed > start || !bytes.subarray(local + 30, local + 30 + localNameSize).equals(rawName)) return invalid();
        extras(bytes.subarray(local + 30 + localNameSize, data));
        for (const [offset, expected] of [[14, crc], [18, compressed], [22, uncompressed]]) {
            const actual = bytes.readUInt32LE(local + offset);
            if (actual !== expected && (!(flags & 8) || actual !== 0)) return invalid();
        }
        let finish = data + compressed;
        if (flags & 8) {
            if (finish + 12 > start) return invalid();
            const signed = bytes.readUInt32LE(finish) === 0x08074b50;
            const descriptor = finish + (signed ? 4 : 0);
            if (descriptor + 12 > start || bytes.readUInt32LE(descriptor) !== crc || bytes.readUInt32LE(descriptor + 4) !== compressed
                || bytes.readUInt32LE(descriptor + 8) !== uncompressed) return invalid();
            finish = descriptor + 12;
        }
        ranges.push({start: local, end: finish}); at = next;
    }
    if (at !== end || !files) return invalid();
    ranges.sort((a, b) => a.start - b.start);
    let finish = 0;
    for (const range of ranges) { if (range.start !== finish) return invalid(); finish = range.end; }
    if (finish !== start) return invalid();
    for (const key of paths.keys()) {
        const parts = key.split('/'); parts.pop();
        while (parts.length) { if (paths.get(parts.join('/')) === false) return invalid(); parts.pop(); }
    }
}
