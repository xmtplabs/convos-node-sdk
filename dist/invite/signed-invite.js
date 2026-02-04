import { encodeInvitePayload, decodeInvitePayload, encodeSignedInvite, decodeSignedInvite, } from "../proto/invite.js";
import { signWithRecovery, recoverPublicKey, getPublicKey, hashSha256, constantTimeEqual, normalizePublicKey, } from "../crypto/secp256k1.js";
import { encryptConversationToken, decryptConversationToken } from "./conversation-token.js";
import { encodeToSlug, decodeFromSlug, parseInviteCode } from "./encoding.js";
import { hexToBytes, bytesToHex } from "../utils/hex.js";
/**
 * Creates a signed invite slug for a conversation.
 */
export function createInviteSlug(options) {
    // Encrypt the conversation ID
    const conversationToken = encryptConversationToken(options.conversationId, options.creatorInboxId, options.privateKey);
    // Build the payload
    const payload = {
        conversationToken,
        creatorInboxId: hexToBytes(options.creatorInboxId),
        tag: options.inviteTag,
        name: options.name,
        description: options.description,
        imageURL: options.imageURL,
        expiresAfterUse: options.expiresAfterUse ?? false,
        expiresAtUnix: options.expiresAt
            ? BigInt(Math.floor(options.expiresAt.getTime() / 1000))
            : undefined,
        conversationExpiresAtUnix: options.conversationExpiresAt
            ? BigInt(Math.floor(options.conversationExpiresAt.getTime() / 1000))
            : undefined,
    };
    // Serialize and sign the payload
    const payloadBytes = encodeInvitePayload(payload);
    const messageHash = hashSha256(payloadBytes);
    const signature = signWithRecovery(messageHash, options.privateKey);
    // Create the signed invite
    const signedInvite = {
        payload: payloadBytes,
        signature,
    };
    // Encode to URL-safe slug
    const signedInviteBytes = encodeSignedInvite(signedInvite);
    return encodeToSlug(signedInviteBytes);
}
/**
 * Parses an invite from a slug or URL.
 */
export function parseInviteSlug(slugOrUrl) {
    const slug = parseInviteCode(slugOrUrl);
    const bytes = decodeFromSlug(slug);
    const signedInvite = decodeSignedInvite(bytes);
    const payload = decodeInvitePayload(signedInvite.payload);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const isExpired = payload.expiresAtUnix !== undefined && payload.expiresAtUnix < now;
    const isConversationExpired = payload.conversationExpiresAtUnix !== undefined && payload.conversationExpiresAtUnix < now;
    return {
        signedInvite,
        payload,
        creatorInboxId: bytesToHex(payload.creatorInboxId),
        isExpired,
        isConversationExpired,
    };
}
/**
 * Verifies a signed invite against an expected public key.
 * Returns true if the signature is valid and was created by the expected key.
 */
export function verifyInvite(signedInvite, expectedPublicKey) {
    try {
        const messageHash = hashSha256(signedInvite.payload);
        const recoveredPublicKey = recoverPublicKey(messageHash, signedInvite.signature);
        // Normalize both keys to uncompressed format for comparison
        const normalizedRecovered = normalizePublicKey(recoveredPublicKey);
        const normalizedExpected = normalizePublicKey(expectedPublicKey);
        return constantTimeEqual(normalizedRecovered, normalizedExpected);
    }
    catch {
        return false;
    }
}
/**
 * Verifies an invite was created by the owner of the given private key.
 */
export function verifyInviteWithPrivateKey(signedInvite, privateKey) {
    const publicKey = getPublicKey(privateKey);
    return verifyInvite(signedInvite, publicKey);
}
/**
 * Decrypts the conversation ID from a parsed invite.
 * Only the creator (who has the private key) can decrypt this.
 */
export function decryptInviteConversationId(parsedInvite, privateKey) {
    return decryptConversationToken(parsedInvite.payload.conversationToken, parsedInvite.creatorInboxId, privateKey);
}
//# sourceMappingURL=signed-invite.js.map