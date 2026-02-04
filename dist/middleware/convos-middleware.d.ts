import { type ParsedInvite } from "../invite/signed-invite.js";
import { type ConversationCustomMetadata } from "../proto/conversation-metadata.js";
import { type InviteJoinError } from "../content-types/invite-join-error.js";
import { type ConvosGroup, type ConvosGroupInviteOptions, type XMTPGroupWithAppData } from "./convos-group.js";
/**
 * XMTP Conversation/Group interface
 */
export interface XMTPConversation {
    id: string;
    send(content: unknown): Promise<void>;
    sendText?(text: string): Promise<void>;
    addMembers(inboxIds: string[]): Promise<void>;
    appData?: string;
    updateAppData?(appData: string): Promise<void>;
}
/**
 * Options for creating a group
 */
export interface CreateGroupOptions {
    groupName?: string;
    groupDescription?: string;
    appData?: string;
}
/**
 * XMTP Agent interface
 */
export interface XMTPAgent {
    address?: string;
    client: {
        inboxId: string;
        conversations: {
            getConversationById(id: string): Promise<XMTPConversation | null>;
            createGroup?(memberInboxIds: string[], options?: CreateGroupOptions): Promise<XMTPConversation>;
            createDm?(inboxId: string): Promise<XMTPConversation>;
        };
        contacts: {
            refreshConsentList(): Promise<void>;
            block(inboxIds: string[]): Promise<void>;
        };
    };
    use?(middleware: AgentMiddleware): void;
    on?(event: string, handler: (ctx: unknown) => void | Promise<void>): void;
    start?(): Promise<void>;
    stop?(): Promise<void>;
}
/**
 * XMTP message context passed to middleware
 */
export interface XMTPMessageContext {
    message: {
        content: unknown;
        senderInboxId: string;
    };
    conversation: XMTPConversation;
}
/**
 * Middleware function signature for agent.use()
 */
export type AgentMiddleware = (ctx: XMTPMessageContext, next: () => Promise<void>) => Promise<void>;
/**
 * Context passed to invite event handlers
 */
export interface InviteContext {
    /** The inbox ID of the user requesting to join */
    joinerInboxId: string;
    /** The conversation ID they want to join */
    conversationId: string;
    /** The invite tag from the invite */
    inviteTag: string;
    /** Parsed invite details */
    invite: ParsedInvite;
    /** The original DM context */
    dmContext: XMTPMessageContext;
    /** Accept the join request - adds the joiner to the conversation */
    accept(): Promise<void>;
    /** Reject the join request with an error message */
    reject(error?: InviteJoinError): Promise<void>;
}
/**
 * Options for creating an invite
 */
export interface CreateInviteOptions {
    /** The invite tag from metadata (required) */
    inviteTag: string;
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
export interface InviteResult {
    slug: string;
    url: string;
    qrData: string;
}
/**
 * Result of joining a conversation via invite URL
 */
export interface JoinResult {
    /** The conversation ID being joined */
    conversationId: string;
    /** The creator's inbox ID */
    creatorInboxId: string;
    /** The invite tag from the invite */
    inviteTag: string;
    /** Display name from the invite (if provided) */
    name?: string;
    /** Description from the invite (if provided) */
    description?: string;
}
export interface ConvosMiddlewareOptions {
    /** The creator's secp256k1 private key. Can be Uint8Array (32 bytes) or hex string (with or without 0x prefix). If not provided, reads from XMTP_WALLET_KEY env var */
    privateKey?: Uint8Array | string;
    /** Base URL for invite links. If not provided, defaults based on env: dev/local → dev.convos.org, production → popup.convos.org */
    inviteBaseURL?: string;
    /** XMTP environment, used to determine default invite base URL */
    env?: string;
}
type InviteHandler = (ctx: InviteContext) => Promise<void>;
/**
 * Convos middleware for XMTP agents.
 * Handles invite creation, join request processing, and integrates with the agent's middleware chain.
 *
 * @example
 * ```typescript
 * const agent = await Agent.createFromEnv();
 * const convos = ConvosMiddleware.create(agent);
 *
 * // Install middleware in the chain
 * agent.use(convos.middleware());
 *
 * // Listen for join requests
 * convos.on("invite", async (ctx) => {
 *   console.log(`${ctx.joinerInboxId} wants to join`);
 *   await ctx.accept();
 * });
 *
 * // Create a group and invite
 * const group = await agent.client.conversations.createGroup([]);
 * const { metadata } = convos.createInitialMetadata();
 * const invite = convos.createInvite(group, { inviteTag: metadata.tag });
 * console.log(invite.url);
 * ```
 */
export declare class ConvosMiddleware {
    private readonly agent;
    private readonly inboxId;
    private readonly privateKey;
    private readonly inviteBaseURL;
    private inviteHandlers;
    private constructor();
    /**
     * Normalizes a private key from either Uint8Array or hex string to Uint8Array.
     */
    private normalizePrivateKey;
    /**
     * Creates the Convos middleware for an XMTP agent.
     * After creating, install with agent.use(convos.middleware())
     */
    static create(agent: XMTPAgent, options?: ConvosMiddlewareOptions): ConvosMiddleware;
    /**
     * Returns the middleware function for use with agent.use()
     * This intercepts DM messages to handle join requests.
     */
    middleware(): AgentMiddleware;
    /**
     * Registers a handler for invite events.
     * Called when a valid join request is received.
     */
    on(event: "invite", handler: InviteHandler): void;
    /**
     * Removes an invite handler.
     */
    off(event: "invite", handler: InviteHandler): void;
    /**
     * Creates initial conversation metadata with a new invite tag.
     */
    createInitialMetadata(options?: {
        expiresAt?: Date;
    }): {
        metadata: ConversationCustomMetadata;
        encodedMetadata: string;
    };
    /**
     * Generates an invite for a conversation.
     * Can accept either a conversation object (with id property) or a string conversation ID.
     *
     * @deprecated Use `convos.group(xmtpGroup).createInvite()` instead for simpler API.
     */
    createInvite(conversation: {
        id: string;
    } | string, options: CreateInviteOptions): InviteResult;
    /**
     * Wraps an XMTP group with Convos functionality.
     * The returned group has a createInvite() method that automatically manages metadata.
     *
     * @example
     * ```typescript
     * const xmtpGroup = await agent.client.conversations.createGroup([]);
     * const group = convos.group(xmtpGroup);
     * const invite = await group.createInvite({ name: "My Chat" });
     * console.log(invite.url);
     * ```
     */
    group<T extends XMTPGroupWithAppData>(xmtpGroup: T): ConvosGroup<T>;
    /**
     * Internal method for creating invites, used by both the legacy API and ConvosGroup.
     */
    createInviteInternal(conversationId: string, inviteTag: string, options?: ConvosGroupInviteOptions): InviteResult;
    /**
     * Rotates the invite tag, invalidating all existing invites.
     */
    rotateInviteTag(currentMetadata: ConversationCustomMetadata): {
        metadata: ConversationCustomMetadata;
        encodedMetadata: string;
        newTag: string;
    };
    /**
     * Encodes conversation metadata for storage in XMTP appData.
     */
    encodeMetadata(metadata: ConversationCustomMetadata): string;
    /**
     * Decodes conversation metadata from XMTP appData.
     */
    decodeMetadata(encoded: string): ConversationCustomMetadata;
    /**
     * Gets the invite tag from encoded metadata.
     */
    getInviteTag(encodedMetadata: string): string;
    /**
     * Gets the inbox ID.
     */
    getInboxId(): string;
    /**
     * Joins a conversation using an invite URL.
     * Parses the invite, validates it, and sends a join request to the creator.
     *
     * @param inviteUrl The invite URL or slug
     * @returns Information about the conversation being joined
     * @throws Error if the invite is invalid, expired, or if no DM method is available
     *
     * @example
     * ```typescript
     * const result = await convos.join("https://popup.convos.org/v2?i=...");
     * console.log(`Joining conversation ${result.conversationId}`);
     * // The creator will receive the join request and can accept/reject it
     * ```
     */
    join(inviteUrl: string): Promise<JoinResult>;
    /**
     * Handles incoming messages, checking for join requests.
     * Returns true if the message was handled as a join request.
     */
    private handleMessage;
    /**
     * Blocks a DM sender using the agent's contacts API
     */
    private blockSender;
    /**
     * Extracts text content from a message.
     */
    private extractText;
    /**
     * Sends an error message back to the joiner.
     */
    private sendError;
    /**
     * Heuristic check if a string looks like it might be an invite slug.
     */
    private looksLikeInviteSlug;
}
export {};
//# sourceMappingURL=convos-middleware.d.ts.map