import { hexToBytes } from "../utils/hex.js";
import { parseInviteSlug, verifyInviteWithPrivateKey, decryptInviteConversationId, } from "../invite/signed-invite.js";
import { createConversationExpiredError, createGenericFailureError, encodeInviteJoinError, } from "../content-types/invite-join-error.js";
export var JoinRequestResult;
(function (JoinRequestResult) {
    /** Successfully processed as a join request */
    JoinRequestResult["Success"] = "success";
    /** Invalid/spam join request - should block sender */
    JoinRequestResult["BlockSender"] = "block";
    /** Valid join request but failed - should send error */
    JoinRequestResult["SendError"] = "error";
    /** Not a join request - pass through to normal handling */
    JoinRequestResult["NotJoinRequest"] = "not_join_request";
})(JoinRequestResult || (JoinRequestResult = {}));
/**
 * Handles incoming join requests from DMs.
 * Validates invite signatures, decrypts conversation IDs,
 * and coordinates the join process.
 */
export class JoinRequestHandler {
    inboxId;
    privateKey;
    onJoinRequest;
    onJoinError;
    conversationExists;
    /**
     * Creates a JoinRequestHandler.
     *
     * @param options Configuration options
     * @param agent Optional XMTP Agent to extract inboxId from
     */
    constructor(options, agent) {
        // Get inboxId from options, agent, or throw
        if (options.inboxId) {
            this.inboxId = options.inboxId;
        }
        else if (agent?.client?.inboxId) {
            this.inboxId = agent.client.inboxId;
        }
        else {
            throw new Error("inboxId is required. Provide it in options or pass an XMTP agent.");
        }
        // Get privateKey from options or environment
        if (options.privateKey) {
            this.privateKey = options.privateKey;
        }
        else {
            const envKey = process.env.XMTP_WALLET_KEY || process.env.WALLET_KEY;
            if (!envKey) {
                throw new Error("privateKey is required. Provide it in options or set XMTP_WALLET_KEY environment variable.");
            }
            this.privateKey = hexToBytes(envKey.replace(/^0x/, ""));
        }
        this.onJoinRequest = options.onJoinRequest;
        this.onJoinError = options.onJoinError;
        this.conversationExists = options.conversationExists;
    }
    /**
     * Creates a JoinRequestHandler from an XMTP Agent.
     * Reads the private key from XMTP_WALLET_KEY environment variable.
     */
    static fromAgent(agent, options) {
        return new JoinRequestHandler(options ?? {}, agent);
    }
    /**
     * Processes a potential join request from a DM message.
     *
     * @param messageText The text content of the DM message
     * @param senderInboxId The inbox ID of the message sender
     * @returns The outcome of processing the message
     */
    async processMessage(messageText, senderInboxId) {
        // Ignore messages from self
        if (senderInboxId === this.inboxId) {
            return { result: JoinRequestResult.NotJoinRequest };
        }
        // Try to parse as invite slug
        let parsedInvite;
        try {
            parsedInvite = parseInviteSlug(messageText);
        }
        catch {
            // Not a valid invite format - could be spam or regular message
            // Check if it looks like an invite attempt (base64-ish string)
            if (this.looksLikeInviteSlug(messageText)) {
                return {
                    result: JoinRequestResult.BlockSender,
                    errorMessage: "Invalid invite format",
                };
            }
            return { result: JoinRequestResult.NotJoinRequest };
        }
        const inviteTag = parsedInvite.payload.tag;
        // Verify the creator inbox ID matches ours
        if (parsedInvite.creatorInboxId !== this.inboxId) {
            return {
                result: JoinRequestResult.BlockSender,
                inviteTag,
                errorMessage: "Invite not created by this inbox",
            };
        }
        // Verify the signature
        if (!verifyInviteWithPrivateKey(parsedInvite.signedInvite, this.privateKey)) {
            return {
                result: JoinRequestResult.BlockSender,
                inviteTag,
                errorMessage: "Invalid signature",
            };
        }
        // Check if invite is expired
        if (parsedInvite.isExpired) {
            const error = createConversationExpiredError(inviteTag);
            this.onJoinError?.(senderInboxId, error);
            return {
                result: JoinRequestResult.SendError,
                inviteTag,
                error,
                errorMessage: "Invite expired",
            };
        }
        // Check if conversation is expired
        if (parsedInvite.isConversationExpired) {
            const error = createConversationExpiredError(inviteTag);
            this.onJoinError?.(senderInboxId, error);
            return {
                result: JoinRequestResult.SendError,
                inviteTag,
                error,
                errorMessage: "Conversation expired",
            };
        }
        // Decrypt the conversation ID
        let conversationId;
        try {
            conversationId = decryptInviteConversationId(parsedInvite, this.privateKey);
        }
        catch {
            return {
                result: JoinRequestResult.BlockSender,
                inviteTag,
                errorMessage: "Failed to decrypt conversation ID",
            };
        }
        // Check if conversation exists
        if (this.conversationExists) {
            const exists = await this.conversationExists(conversationId);
            if (!exists) {
                const error = createConversationExpiredError(inviteTag);
                this.onJoinError?.(senderInboxId, error);
                return {
                    result: JoinRequestResult.SendError,
                    inviteTag,
                    conversationId,
                    error,
                    errorMessage: "Conversation not found",
                };
            }
        }
        // Call the join request handler
        if (this.onJoinRequest) {
            try {
                const success = await this.onJoinRequest(senderInboxId, conversationId, inviteTag);
                if (!success) {
                    const error = createGenericFailureError(inviteTag);
                    this.onJoinError?.(senderInboxId, error);
                    return {
                        result: JoinRequestResult.SendError,
                        inviteTag,
                        conversationId,
                        error,
                        errorMessage: "Failed to add member to conversation",
                    };
                }
            }
            catch (err) {
                const error = createGenericFailureError(inviteTag);
                this.onJoinError?.(senderInboxId, error);
                return {
                    result: JoinRequestResult.SendError,
                    inviteTag,
                    conversationId,
                    error,
                    errorMessage: err instanceof Error ? err.message : "Unknown error",
                };
            }
        }
        return {
            result: JoinRequestResult.Success,
            conversationId,
            inviteTag,
        };
    }
    /**
     * Creates encoded error content to send back to the joiner.
     */
    encodeErrorForSending(error) {
        return encodeInviteJoinError(error);
    }
    /**
     * Heuristic check if a string looks like it might be an invite slug.
     */
    looksLikeInviteSlug(text) {
        const trimmed = text.trim();
        // Invite slugs are base64url encoded, typically 100+ chars
        // and may contain * separators
        if (trimmed.length < 50)
            return false;
        // Check for base64url-ish characters
        const base64UrlPattern = /^[A-Za-z0-9_\-*]+$/;
        return base64UrlPattern.test(trimmed);
    }
}
//# sourceMappingURL=join-request-handler.js.map