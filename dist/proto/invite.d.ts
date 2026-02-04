export interface InvitePayload {
    conversationToken: Uint8Array;
    creatorInboxId: Uint8Array;
    tag: string;
    name?: string;
    description?: string;
    imageURL?: string;
    conversationExpiresAtUnix?: bigint;
    expiresAtUnix?: bigint;
    expiresAfterUse: boolean;
}
export interface SignedInvite {
    payload: Uint8Array;
    signature: Uint8Array;
}
/**
 * Encodes an InvitePayload to protobuf bytes.
 */
export declare function encodeInvitePayload(payload: InvitePayload): Uint8Array;
/**
 * Decodes protobuf bytes to an InvitePayload.
 */
export declare function decodeInvitePayload(bytes: Uint8Array): InvitePayload;
/**
 * Encodes a SignedInvite to protobuf bytes.
 */
export declare function encodeSignedInvite(invite: SignedInvite): Uint8Array;
/**
 * Decodes protobuf bytes to a SignedInvite.
 */
export declare function decodeSignedInvite(bytes: Uint8Array): SignedInvite;
//# sourceMappingURL=invite.d.ts.map