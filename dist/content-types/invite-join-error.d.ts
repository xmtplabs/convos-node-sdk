/**
 * Custom XMTP content type for invite join error messages.
 * Sent when a join request fails for legitimate reasons (not spam).
 */
export declare enum InviteJoinErrorType {
    ConversationExpired = "conversationExpired",
    GenericFailure = "genericFailure",
    Unknown = "unknown"
}
export interface InviteJoinError {
    errorType: InviteJoinErrorType;
    inviteTag: string;
    timestamp: Date;
}
/**
 * Content type ID for invite join errors.
 * Format: authorityId/typeId/version
 */
export declare const INVITE_JOIN_ERROR_CONTENT_TYPE: {
    authorityId: string;
    typeId: string;
    versionMajor: number;
    versionMinor: number;
};
/**
 * Encodes an InviteJoinError to bytes for XMTP transmission.
 */
export declare function encodeInviteJoinError(error: InviteJoinError): Uint8Array;
/**
 * Decodes bytes to an InviteJoinError.
 */
export declare function decodeInviteJoinError(data: Uint8Array): InviteJoinError;
/**
 * Creates an InviteJoinError for a conversation that has expired.
 */
export declare function createConversationExpiredError(inviteTag: string): InviteJoinError;
/**
 * Creates a generic failure InviteJoinError.
 */
export declare function createGenericFailureError(inviteTag: string): InviteJoinError;
/**
 * Gets a user-facing message for an InviteJoinError.
 */
export declare function getErrorMessage(error: InviteJoinError): string;
//# sourceMappingURL=invite-join-error.d.ts.map