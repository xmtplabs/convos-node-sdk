import { type InviteJoinError } from "../content-types/invite-join-error.js";
export declare enum JoinRequestResult {
    /** Successfully processed as a join request */
    Success = "success",
    /** Invalid/spam join request - should block sender */
    BlockSender = "block",
    /** Valid join request but failed - should send error */
    SendError = "error",
    /** Not a join request - pass through to normal handling */
    NotJoinRequest = "not_join_request"
}
export interface JoinRequestOutcome {
    result: JoinRequestResult;
    conversationId?: string;
    inviteTag?: string;
    error?: InviteJoinError;
    errorMessage?: string;
}
export interface JoinRequestHandlerOptions {
    /** The handler's inbox ID. If not provided, reads from agent.client.inboxId */
    inboxId?: string;
    /** The handler's secp256k1 private key (32 bytes). If not provided, reads from XMTP_WALLET_KEY env var */
    privateKey?: Uint8Array;
    /** Callback when a join request is successfully validated */
    onJoinRequest?: (joinerInboxId: string, conversationId: string, inviteTag: string) => Promise<boolean>;
    /** Callback when a join request fails */
    onJoinError?: (joinerInboxId: string, error: InviteJoinError) => void;
    /** Function to check if a conversation exists */
    conversationExists?: (conversationId: string) => Promise<boolean>;
}
/**
 * XMTP Agent interface - minimal typing for what we need
 */
export interface XMTPAgent {
    client: {
        inboxId: string;
    };
}
/**
 * Handles incoming join requests from DMs.
 * Validates invite signatures, decrypts conversation IDs,
 * and coordinates the join process.
 */
export declare class JoinRequestHandler {
    private readonly inboxId;
    private readonly privateKey;
    private readonly onJoinRequest?;
    private readonly onJoinError?;
    private readonly conversationExists?;
    /**
     * Creates a JoinRequestHandler.
     *
     * @param options Configuration options
     * @param agent Optional XMTP Agent to extract inboxId from
     */
    constructor(options: JoinRequestHandlerOptions, agent?: XMTPAgent);
    /**
     * Creates a JoinRequestHandler from an XMTP Agent.
     * Reads the private key from XMTP_WALLET_KEY environment variable.
     */
    static fromAgent(agent: XMTPAgent, options?: Omit<JoinRequestHandlerOptions, "inboxId" | "privateKey">): JoinRequestHandler;
    /**
     * Processes a potential join request from a DM message.
     *
     * @param messageText The text content of the DM message
     * @param senderInboxId The inbox ID of the message sender
     * @returns The outcome of processing the message
     */
    processMessage(messageText: string, senderInboxId: string): Promise<JoinRequestOutcome>;
    /**
     * Creates encoded error content to send back to the joiner.
     */
    encodeErrorForSending(error: InviteJoinError): Uint8Array;
    /**
     * Heuristic check if a string looks like it might be an invite slug.
     */
    private looksLikeInviteSlug;
}
//# sourceMappingURL=join-request-handler.d.ts.map