/**
 * Encodes bytes to URL-safe Base64 (no padding).
 * Uses '-' and '_' instead of '+' and '/'.
 */
export declare function base64UrlEncode(data: Uint8Array): string;
/**
 * Decodes URL-safe Base64 to bytes.
 */
export declare function base64UrlDecode(str: string): Uint8Array;
//# sourceMappingURL=base64url.d.ts.map