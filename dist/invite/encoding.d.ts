/**
 * Returns the appropriate invite base URL for the given XMTP environment.
 * - production: https://popup.convos.org/v2
 * - dev/local: https://dev.convos.org/v2
 */
export declare function getInviteBaseURL(env?: string): string;
/**
 * Encodes binary data to a URL-safe slug.
 * Applies optional compression and inserts '*' separators for iMessage compatibility.
 */
export declare function encodeToSlug(data: Uint8Array): string;
/**
 * Decodes a URL-safe slug back to binary data.
 */
export declare function decodeFromSlug(slug: string): Uint8Array;
/**
 * Generates a full invite URL from a slug.
 * Uses v2 format: https://popup.convos.org/v2?i=[code]
 */
export declare function generateInviteURL(slug: string, baseURL?: string): string;
/**
 * Parses an invite code from a URL or raw slug.
 * Handles various input formats:
 * - Raw slug
 * - v2 URL format: https://popup.convos.org/v2?i=[code]
 * - Legacy URL with ?code= query param
 * - convos:// app scheme: convos://join/[code]
 * - URL path segment
 */
export declare function parseInviteCode(input: string): string;
//# sourceMappingURL=encoding.d.ts.map