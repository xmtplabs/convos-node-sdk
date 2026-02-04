/**
 * Converts a hex string to bytes.
 */
export function hexToBytes(hex) {
    if (hex.length % 2 !== 0) {
        throw new Error("Invalid hex string length");
    }
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}
/**
 * Converts bytes to a hex string.
 */
export function bytesToHex(bytes) {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
//# sourceMappingURL=hex.js.map