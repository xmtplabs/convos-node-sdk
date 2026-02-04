/**
 * Encodes bytes to URL-safe Base64 (no padding).
 * Uses '-' and '_' instead of '+' and '/'.
 */
export function base64UrlEncode(data) {
    const base64 = Buffer.from(data).toString("base64");
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/**
 * Decodes URL-safe Base64 to bytes.
 */
export function base64UrlDecode(str) {
    // Replace URL-safe characters back to standard Base64
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    const padLength = (4 - (base64.length % 4)) % 4;
    base64 += "=".repeat(padLength);
    return new Uint8Array(Buffer.from(base64, "base64"));
}
//# sourceMappingURL=base64url.js.map