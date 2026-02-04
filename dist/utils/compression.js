import pako from "pako";
const COMPRESSION_MARKER = 0x78; // zlib header byte
const MAX_DECOMPRESSED_SIZE = 1024 * 1024; // 1 MB
const MIN_SIZE_FOR_COMPRESSION = 100; // Only compress if larger than this
/**
 * Compresses data with DEFLATE if it results in smaller output.
 * Prepends compression marker byte if compressed.
 */
export function compressIfSmaller(data) {
    if (data.length < MIN_SIZE_FOR_COMPRESSION) {
        return data;
    }
    try {
        const compressed = pako.deflate(data);
        // Only use compressed version if it's smaller (accounting for marker byte)
        if (compressed.length + 1 < data.length) {
            const result = new Uint8Array(compressed.length + 1);
            result[0] = COMPRESSION_MARKER;
            result.set(compressed, 1);
            return result;
        }
    }
    catch {
        // If compression fails, return original
    }
    return data;
}
/**
 * Decompresses data if it has the compression marker.
 * Enforces maximum decompressed size to prevent decompression bombs.
 */
export function decompress(data) {
    if (data.length === 0 || data[0] !== COMPRESSION_MARKER) {
        return data;
    }
    const compressed = data.slice(1);
    const decompressed = pako.inflate(compressed);
    if (decompressed.length > MAX_DECOMPRESSED_SIZE) {
        throw new Error(`Decompressed size exceeds maximum: ${decompressed.length} > ${MAX_DECOMPRESSED_SIZE}`);
    }
    return decompressed;
}
/**
 * Checks if data appears to be compressed (has compression marker).
 */
export function isCompressed(data) {
    return data.length > 0 && data[0] === COMPRESSION_MARKER;
}
//# sourceMappingURL=compression.js.map