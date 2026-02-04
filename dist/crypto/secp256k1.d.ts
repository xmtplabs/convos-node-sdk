/**
 * Signs a message hash with recovery ID.
 * Returns 65 bytes: r (32) + s (32) + recovery ID (1)
 */
export declare function signWithRecovery(messageHash: Uint8Array, privateKey: Uint8Array): Uint8Array;
/**
 * Recovers the public key from a signature with recovery ID.
 * Input: 65 bytes (r + s + recovery ID)
 * Returns: uncompressed public key (65 bytes)
 */
export declare function recoverPublicKey(messageHash: Uint8Array, signature: Uint8Array): Uint8Array;
/**
 * Gets the public key from a private key.
 * Returns: uncompressed public key (65 bytes)
 */
export declare function getPublicKey(privateKey: Uint8Array): Uint8Array;
/**
 * Computes SHA-256 hash of data.
 */
export declare function hashSha256(data: Uint8Array): Uint8Array;
/**
 * Constant-time comparison of two byte arrays.
 * Prevents timing attacks.
 */
export declare function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean;
/**
 * Normalizes a public key to uncompressed format (65 bytes).
 */
export declare function normalizePublicKey(publicKey: Uint8Array): Uint8Array;
//# sourceMappingURL=secp256k1.d.ts.map