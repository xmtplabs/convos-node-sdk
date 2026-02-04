/**
 * Derives a 32-byte symmetric key from a secp256k1 private key for invite encryption.
 * Uses HKDF-SHA256 with salt "ConvosInviteV1" and info "inbox:<inboxId>".
 */
export declare function deriveInviteKey(privateKey: Uint8Array, inboxId: string): Uint8Array;
//# sourceMappingURL=hkdf.d.ts.map