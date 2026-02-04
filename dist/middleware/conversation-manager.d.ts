import { type ConversationCustomMetadata } from "../proto/conversation-metadata.js";
export interface ConversationInfo {
    conversationId: string;
    inviteTag: string;
    creatorInboxId: string;
    name?: string;
    description?: string;
    imageURL?: string;
    expiresAt?: Date;
}
export interface InviteResult {
    slug: string;
    url: string;
    qrData: string;
}
export interface ConvosConversationManagerOptions {
    /** The creator's inbox ID. If not provided, reads from agent.client.inboxId */
    inboxId?: string;
    /** The creator's secp256k1 private key (32 bytes). If not provided, reads from XMTP_WALLET_KEY env var */
    privateKey?: Uint8Array;
    /** Base URL for invite links (default: https://popup.convos.org/v2) */
    inviteBaseURL?: string;
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
 * Manages Convos conversations with invite capabilities.
 * Provides helpers for creating conversations, generating invites,
 * and managing conversation metadata.
 */
export declare class ConvosConversationManager {
    private readonly inboxId;
    private readonly privateKey;
    private readonly inviteBaseURL;
    /**
     * Creates a ConvosConversationManager.
     *
     * @param options Configuration options
     * @param agent Optional XMTP Agent to extract inboxId from
     */
    constructor(options: ConvosConversationManagerOptions, agent?: XMTPAgent);
    /**
     * Creates a ConvosConversationManager from an XMTP Agent.
     * Reads the private key from XMTP_WALLET_KEY environment variable.
     */
    static fromAgent(agent: XMTPAgent, options?: {
        inviteBaseURL?: string;
    }): ConvosConversationManager;
    /**
     * Creates initial conversation metadata with a new invite tag.
     * Call this when creating a new group conversation.
     */
    createInitialMetadata(options?: {
        name?: string;
        expiresAt?: Date;
    }): {
        metadata: ConversationCustomMetadata;
        encodedMetadata: string;
    };
    /**
     * Generates an invite for a conversation.
     */
    createInvite(conversation: ConversationInfo, options?: {
        expiresAt?: Date;
        expiresAfterUse?: boolean;
    }): InviteResult;
    /**
     * Creates a new invite tag, invalidating all existing invites.
     */
    rotateInviteTag(currentMetadata: ConversationCustomMetadata): {
        metadata: ConversationCustomMetadata;
        encodedMetadata: string;
        newTag: string;
    };
    /**
     * Encodes conversation metadata to a string suitable for XMTP appData.
     */
    encodeMetadata(metadata: ConversationCustomMetadata): string;
    /**
     * Decodes conversation metadata from XMTP appData string.
     */
    decodeMetadata(encoded: string): ConversationCustomMetadata;
    /**
     * Gets the invite tag from encoded metadata.
     */
    getInviteTag(encodedMetadata: string): string;
    /**
     * Gets the creator's inbox ID.
     */
    getInboxId(): string;
    /**
     * Gets the creator's inbox ID as bytes.
     */
    getInboxIdBytes(): Uint8Array;
}
//# sourceMappingURL=conversation-manager.d.ts.map