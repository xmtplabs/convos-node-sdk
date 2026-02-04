import * as secp from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";
// Configure secp256k1 with hash functions
secp.etc.hmacSha256Sync = (k, ...m) => hmac(sha256, k, secp.etc.concatBytes(...m));
/**
 * Signs a message hash with recovery ID.
 * Returns 65 bytes: r (32) + s (32) + recovery ID (1)
 */
export function signWithRecovery(messageHash, privateKey) {
    const sig = secp.sign(messageHash, privateKey);
    const compactSig = sig.toCompactRawBytes();
    const recoveryId = sig.recovery;
    if (recoveryId === undefined) {
        throw new Error("Failed to compute recovery ID");
    }
    // Combine: r (32) + s (32) + recovery ID (1)
    const result = new Uint8Array(65);
    result.set(compactSig, 0);
    result[64] = recoveryId;
    return result;
}
/**
 * Recovers the public key from a signature with recovery ID.
 * Input: 65 bytes (r + s + recovery ID)
 * Returns: uncompressed public key (65 bytes)
 */
export function recoverPublicKey(messageHash, signature) {
    if (signature.length !== 65) {
        throw new Error("Invalid signature length: expected 65 bytes");
    }
    const compactSig = signature.slice(0, 64);
    const recoveryId = signature[64];
    if (recoveryId > 3) {
        throw new Error(`Invalid recovery ID: ${recoveryId}`);
    }
    const sig = secp.Signature.fromCompact(compactSig).addRecoveryBit(recoveryId);
    const publicKey = sig.recoverPublicKey(messageHash);
    return publicKey.toRawBytes(false); // uncompressed (65 bytes)
}
/**
 * Gets the public key from a private key.
 * Returns: uncompressed public key (65 bytes)
 */
export function getPublicKey(privateKey) {
    return secp.getPublicKey(privateKey, false); // uncompressed
}
/**
 * Computes SHA-256 hash of data.
 */
export function hashSha256(data) {
    return sha256(data);
}
/**
 * Constant-time comparison of two byte arrays.
 * Prevents timing attacks.
 */
export function constantTimeEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a[i] ^ b[i];
    }
    return result === 0;
}
/**
 * Normalizes a public key to uncompressed format (65 bytes).
 */
export function normalizePublicKey(publicKey) {
    if (publicKey.length === 65) {
        return publicKey;
    }
    if (publicKey.length === 33) {
        const point = secp.ProjectivePoint.fromHex(publicKey);
        return point.toRawBytes(false);
    }
    throw new Error(`Invalid public key length: ${publicKey.length}`);
}
//# sourceMappingURL=secp256k1.js.map