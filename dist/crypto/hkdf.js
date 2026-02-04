import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
const INVITE_SALT = new TextEncoder().encode("ConvosInviteV1");
/**
 * Derives a 32-byte symmetric key from a secp256k1 private key for invite encryption.
 * Uses HKDF-SHA256 with salt "ConvosInviteV1" and info "inbox:<inboxId>".
 */
export function deriveInviteKey(privateKey, inboxId) {
    const info = new TextEncoder().encode(`inbox:${inboxId}`);
    return hkdf(sha256, privateKey, INVITE_SALT, info, 32);
}
//# sourceMappingURL=hkdf.js.map