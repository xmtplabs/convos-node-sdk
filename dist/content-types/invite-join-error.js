/**
 * Custom XMTP content type for invite join error messages.
 * Sent when a join request fails for legitimate reasons (not spam).
 */
export var InviteJoinErrorType;
(function (InviteJoinErrorType) {
    InviteJoinErrorType["ConversationExpired"] = "conversationExpired";
    InviteJoinErrorType["GenericFailure"] = "genericFailure";
    InviteJoinErrorType["Unknown"] = "unknown";
})(InviteJoinErrorType || (InviteJoinErrorType = {}));
/**
 * Content type ID for invite join errors.
 * Format: authorityId/typeId/version
 */
export const INVITE_JOIN_ERROR_CONTENT_TYPE = {
    authorityId: "convos.app",
    typeId: "inviteJoinError",
    versionMajor: 1,
    versionMinor: 0,
};
/**
 * Encodes an InviteJoinError to bytes for XMTP transmission.
 */
export function encodeInviteJoinError(error) {
    const json = JSON.stringify({
        errorType: error.errorType,
        inviteTag: error.inviteTag,
        timestamp: error.timestamp.toISOString(),
    });
    return new TextEncoder().encode(json);
}
/**
 * Decodes bytes to an InviteJoinError.
 */
export function decodeInviteJoinError(data) {
    const json = new TextDecoder().decode(data);
    const parsed = JSON.parse(json);
    // Handle unknown error types for forward compatibility
    let errorType;
    if (Object.values(InviteJoinErrorType).includes(parsed.errorType)) {
        errorType = parsed.errorType;
    }
    else {
        errorType = InviteJoinErrorType.Unknown;
    }
    return {
        errorType,
        inviteTag: parsed.inviteTag,
        timestamp: new Date(parsed.timestamp),
    };
}
/**
 * Creates an InviteJoinError for a conversation that has expired.
 */
export function createConversationExpiredError(inviteTag) {
    return {
        errorType: InviteJoinErrorType.ConversationExpired,
        inviteTag,
        timestamp: new Date(),
    };
}
/**
 * Creates a generic failure InviteJoinError.
 */
export function createGenericFailureError(inviteTag) {
    return {
        errorType: InviteJoinErrorType.GenericFailure,
        inviteTag,
        timestamp: new Date(),
    };
}
/**
 * Gets a user-facing message for an InviteJoinError.
 */
export function getErrorMessage(error) {
    switch (error.errorType) {
        case InviteJoinErrorType.ConversationExpired:
            return "This conversation is no longer available";
        case InviteJoinErrorType.GenericFailure:
        case InviteJoinErrorType.Unknown:
        default:
            return "Failed to join conversation";
    }
}
//# sourceMappingURL=invite-join-error.js.map