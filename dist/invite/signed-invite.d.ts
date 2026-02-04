import { type InvitePayload, type SignedInvite } from "../proto/invite.js";
export interface CreateInviteOptions {
    conversationId: string;
    inviteTag: string;
    creatorInboxId: string;
    privateKey: Uint8Array;
    name?: string;
    description?: string;
    imageURL?: string;
    expiresAt?: Date;
    conversationExpiresAt?: Date;
    expiresAfterUse?: boolean;
}
export interface ParsedInvite {
    signedInvite: SignedInvite;
    payload: InvitePayload;
    creatorInboxId: string;
    isExpired: boolean;
    isConversationExpired: boolean;
}
/**
 * Creates a signed invite slug for a conversation.
 */
export declare function createInviteSlug(options: CreateInviteOptions): string;
/**
 * Parses an invite from a slug or URL.
 */
export declare function parseInviteSlug(slugOrUrl: string): ParsedInvite;
/**
 * Verifies a signed invite against an expected public key.
 * Returns true if the signature is valid and was created by the expected key.
 */
export declare function verifyInvite(signedInvite: SignedInvite, expectedPublicKey: Uint8Array): boolean;
/**
 * Verifies an invite was created by the owner of the given private key.
 */
export declare function verifyInviteWithPrivateKey(signedInvite: SignedInvite, privateKey: Uint8Array): boolean;
/**
 * Decrypts the conversation ID from a parsed invite.
 * Only the creator (who has the private key) can decrypt this.
 */
export declare function decryptInviteConversationId(parsedInvite: ParsedInvite, privateKey: Uint8Array): string;
//# sourceMappingURL=signed-invite.d.ts.map