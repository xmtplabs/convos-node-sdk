import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { randomBytes } from "@noble/ciphers/webcrypto";
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
/**
 * Encrypts plaintext using ChaCha20-Poly1305 with AAD.
 * Returns: nonce (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export function encrypt(plaintext, key, aad) {
    const nonce = randomBytes(NONCE_LENGTH);
    const cipher = chacha20poly1305(key, nonce, aad);
    const ciphertext = cipher.encrypt(plaintext);
    // Combine: nonce + ciphertext (includes auth tag)
    const result = new Uint8Array(NONCE_LENGTH + ciphertext.length);
    result.set(nonce, 0);
    result.set(ciphertext, NONCE_LENGTH);
    return result;
}
/**
 * Decrypts ciphertext using ChaCha20-Poly1305 with AAD.
 * Input format: nonce (12 bytes) + ciphertext + auth tag (16 bytes)
 * Throws if authentication fails.
 */
export function decrypt(combined, key, aad) {
    if (combined.length < NONCE_LENGTH + TAG_LENGTH) {
        throw new Error("Ciphertext too short");
    }
    const nonce = combined.slice(0, NONCE_LENGTH);
    const ciphertext = combined.slice(NONCE_LENGTH);
    const cipher = chacha20poly1305(key, nonce, aad);
    return cipher.decrypt(ciphertext);
}
//# sourceMappingURL=chacha20poly1305.js.map