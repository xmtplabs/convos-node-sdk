import type { ConversationCustomMetadata } from "../proto/conversation-metadata.js";
import type { InviteResult } from "./convos-middleware.js";
/**
 * Options for creating an invite on a ConvosGroup
 */
export interface ConvosGroupInviteOptions {
    /** Display name for the conversation */
    name?: string;
    /** Description of the conversation */
    description?: string;
    /** Image URL for the conversation */
    imageURL?: string;
    /** When the conversation expires */
    conversationExpiresAt?: Date;
    /** When this invite expires */
    expiresAt?: Date;
    /** Whether this invite expires after first use */
    expiresAfterUse?: boolean;
}
/**
 * Options for setting the agent's profile on a conversation
 */
export interface SetConversationProfileOptions {
    /** Display name for this conversation */
    name?: string;
    /** URL to profile image */
    image?: string;
}
/**
 * Interface for the underlying XMTP group that can have appData
 */
export interface XMTPGroupWithAppData {
    id: string;
    appData: string;
    updateAppData(appData: string): Promise<void>;
    send(content: unknown): Promise<void>;
    addMembers(inboxIds: string[]): Promise<void>;
    [key: string]: unknown;
}
/**
 * Interface for the ConvosMiddleware methods we need
 */
export interface ConvosMiddlewareRef {
    createInitialMetadata(options?: {
        expiresAt?: Date;
    }): {
        metadata: ConversationCustomMetadata;
        encodedMetadata: string;
    };
    decodeMetadata(encoded: string): ConversationCustomMetadata;
    encodeMetadata(metadata: ConversationCustomMetadata): string;
    createInviteInternal(conversationId: string, inviteTag: string, options?: ConvosGroupInviteOptions): InviteResult;
    getInboxId(): string;
}
/**
 * A ConvosGroup wraps an XMTP group with Convos functionality.
 * Access the underlying group via the `inner` property.
 */
export declare class ConvosGroup<T extends XMTPGroupWithAppData = XMTPGroupWithAppData> {
    /**
     * The underlying XMTP group. Use this to access all native group methods.
     */
    readonly inner: T;
    private readonly middleware;
    constructor(group: T, middleware: ConvosMiddlewareRef);
    /**
     * The conversation/group ID
     */
    get id(): string;
    /**
     * Creates an invite for this group.
     * Automatically manages metadata - creates it if needed, or uses existing.
     */
    createInvite(options?: ConvosGroupInviteOptions): Promise<InviteResult>;
    /**
     * Sets the agent's profile on this conversation.
     * The profile is stored in the conversation's metadata and will be visible to other members.
     */
    setConversationProfile(options: SetConversationProfileOptions): Promise<void>;
    private initializeMetadata;
}
/**
 * Creates a ConvosGroup by wrapping an XMTP group with Convos functionality.
 */
export declare function createConvosGroup<T extends XMTPGroupWithAppData>(group: T, middleware: ConvosMiddlewareRef): ConvosGroup<T>;
//# sourceMappingURL=convos-group.d.ts.map