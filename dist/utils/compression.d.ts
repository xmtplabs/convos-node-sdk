/**
 * Compresses data with DEFLATE if it results in smaller output.
 * Prepends compression marker byte if compressed.
 */
export declare function compressIfSmaller(data: Uint8Array): Uint8Array;
/**
 * Decompresses data if it has the compression marker.
 * Enforces maximum decompressed size to prevent decompression bombs.
 */
export declare function decompress(data: Uint8Array): Uint8Array;
/**
 * Checks if data appears to be compressed (has compression marker).
 */
export declare function isCompressed(data: Uint8Array): boolean;
//# sourceMappingURL=compression.d.ts.map