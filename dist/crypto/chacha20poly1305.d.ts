/**
 * Encrypts plaintext using ChaCha20-Poly1305 with AAD.
 * Returns: nonce (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export declare function encrypt(plaintext: Uint8Array, key: Uint8Array, aad: Uint8Array): Uint8Array;
/**
 * Decrypts ciphertext using ChaCha20-Poly1305 with AAD.
 * Input format: nonce (12 bytes) + ciphertext + auth tag (16 bytes)
 * Throws if authentication fails.
 */
export declare function decrypt(combined: Uint8Array, key: Uint8Array, aad: Uint8Array): Uint8Array;
//# sourceMappingURL=chacha20poly1305.d.ts.map