import { base64UrlEncode, base64UrlDecode } from "../utils/base64url.js";
import { compressIfSmaller, decompress } from "../utils/compression.js";
const IMESSAGE_SEPARATOR = "*";
/**
 * Returns the appropriate invite base URL for the given XMTP environment.
 * - production: https://popup.convos.org/v2
 * - dev/local: https://dev.convos.org/v2
 */
export function getInviteBaseURL(env = "dev") {
    if (env === "production") {
        return "https://popup.convos.org/v2";
    }
    return "https://dev.convos.org/v2";
}
const IMESSAGE_CHUNK_SIZE = 300;
/**
 * Encodes binary data to a URL-safe slug.
 * Applies optional compression and inserts '*' separators for iMessage compatibility.
 */
export function encodeToSlug(data) {
    const compressed = compressIfSmaller(data);
    const encoded = base64UrlEncode(compressed);
    return insertSeparators(encoded, IMESSAGE_SEPARATOR, IMESSAGE_CHUNK_SIZE);
}
/**
 * Decodes a URL-safe slug back to binary data.
 */
export function decodeFromSlug(slug) {
    const withoutSeparators = slug.replace(/\*/g, "");
    const decoded = base64UrlDecode(withoutSeparators);
    return decompress(decoded);
}
/**
 * Generates a full invite URL from a slug.
 * Uses v2 format: https://popup.convos.org/v2?i=[code]
 */
export function generateInviteURL(slug, baseURL = "https://popup.convos.org/v2") {
    return `${baseURL}?i=${encodeURIComponent(slug)}`;
}
/**
 * Parses an invite code from a URL or raw slug.
 * Handles various input formats:
 * - Raw slug
 * - v2 URL format: https://popup.convos.org/v2?i=[code]
 * - Legacy URL with ?code= query param
 * - convos:// app scheme: convos://join/[code]
 * - URL path segment
 */
export function parseInviteCode(input) {
    const trimmed = input.trim();
    // Try to parse as URL
    try {
        const url = new URL(trimmed);
        // Check for v2 format: ?i= query parameter
        const iParam = url.searchParams.get("i");
        if (iParam) {
            return iParam;
        }
        // Check for legacy ?code= query parameter
        const codeParam = url.searchParams.get("code");
        if (codeParam) {
            return codeParam;
        }
        // Check for convos:// app scheme or path-based code (e.g., convos://join/ABC123 or /invite/ABC123)
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (pathParts.length > 0) {
            return pathParts[pathParts.length - 1];
        }
    }
    catch {
        // Not a URL, treat as raw slug
    }
    return trimmed;
}
/**
 * Inserts a separator every N characters for iMessage URL parsing workaround.
 */
function insertSeparators(str, separator, every) {
    if (str.length <= every) {
        return str;
    }
    const parts = [];
    for (let i = 0; i < str.length; i += every) {
        parts.push(str.slice(i, i + every));
    }
    return parts.join(separator);
}
//# sourceMappingURL=encoding.js.map