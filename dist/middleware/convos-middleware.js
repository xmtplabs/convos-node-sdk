import { hexToBytes } from "../utils/hex.js";
import { generateInviteTag } from "../utils/random.js";
import { createInviteSlug, parseInviteSlug, verifyInviteWithPrivateKey, decryptInviteConversationId, } from "../invite/signed-invite.js";
import { generateInviteURL, parseInviteCode, getInviteBaseURL } from "../invite/encoding.js";
import { encodeConversationMetadata, decodeConversationMetadata, } from "../proto/conversation-metadata.js";
import { compressIfSmaller, decompress } from "../utils/compression.js";
import { base64UrlEncode, base64UrlDecode } from "../utils/base64url.js";
import { createConversationExpiredError, createGenericFailureError, encodeInviteJoinError, } from "../content-types/invite-join-error.js";
import { createConvosGroup, } from "./convos-group.js";
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
export class ConvosMiddleware {
    agent;
    inboxId;
    privateKey;
    inviteBaseURL;
    inviteHandlers = [];
    constructor(agent, options) {
        this.agent = agent;
        this.inboxId = agent.client.inboxId;
        // Get privateKey from options or environment
        if (options.privateKey) {
            this.privateKey = this.normalizePrivateKey(options.privateKey);
        }
        else {
            const envKey = process.env.XMTP_WALLET_KEY || process.env.WALLET_KEY;
            if (!envKey) {
                throw new Error("privateKey is required. Provide it in options or set XMTP_WALLET_KEY environment variable.");
            }
            this.privateKey = this.normalizePrivateKey(envKey);
        }
        this.inviteBaseURL = options.inviteBaseURL ?? getInviteBaseURL(options.env);
    }
    /**
     * Normalizes a private key from either Uint8Array or hex string to Uint8Array.
     */
    normalizePrivateKey(key) {
        if (key instanceof Uint8Array) {
            return key;
        }
        // Handle hex string (with or without 0x prefix)
        return hexToBytes(key.replace(/^0x/, ""));
    }
    /**
     * Creates the Convos middleware for an XMTP agent.
     * After creating, install with agent.use(convos.middleware())
     */
    static create(agent, options = {}) {
        return new ConvosMiddleware(agent, options);
    }
    /**
     * Returns the middleware function for use with agent.use()
     * This intercepts DM messages to handle join requests.
     */
    middleware() {
        return async (ctx, next) => {
            const handled = await this.handleMessage(ctx);
            if (!handled) {
                // Not a join request, pass to next middleware
                await next();
            }
        };
    }
    /**
     * Registers a handler for invite events.
     * Called when a valid join request is received.
     */
    on(event, handler) {
        if (event === "invite") {
            this.inviteHandlers.push(handler);
        }
    }
    /**
     * Removes an invite handler.
     */
    off(event, handler) {
        if (event === "invite") {
            const index = this.inviteHandlers.indexOf(handler);
            if (index !== -1) {
                this.inviteHandlers.splice(index, 1);
            }
        }
    }
    /**
     * Creates initial conversation metadata with a new invite tag.
     */
    createInitialMetadata(options) {
        const inviteTag = generateInviteTag();
        const metadata = {
            tag: inviteTag,
            profiles: [],
            expiresAtUnix: options?.expiresAt
                ? BigInt(Math.floor(options.expiresAt.getTime() / 1000))
                : undefined,
        };
        const encodedMetadata = this.encodeMetadata(metadata);
        return { metadata, encodedMetadata };
    }
    /**
     * Generates an invite for a conversation.
     * Can accept either a conversation object (with id property) or a string conversation ID.
     *
     * @deprecated Use `convos.group(xmtpGroup).createInvite()` instead for simpler API.
     */
    createInvite(conversation, options) {
        const conversationId = typeof conversation === "string" ? conversation : conversation.id;
        return this.createInviteInternal(conversationId, options.inviteTag, options);
    }
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
    group(xmtpGroup) {
        return createConvosGroup(xmtpGroup, this);
    }
    /**
     * Internal method for creating invites, used by both the legacy API and ConvosGroup.
     */
    createInviteInternal(conversationId, inviteTag, options) {
        const slug = createInviteSlug({
            conversationId,
            inviteTag,
            creatorInboxId: this.inboxId,
            privateKey: this.privateKey,
            name: options?.name,
            description: options?.description,
            imageURL: options?.imageURL,
            conversationExpiresAt: options?.conversationExpiresAt,
            expiresAt: options?.expiresAt,
            expiresAfterUse: options?.expiresAfterUse,
        });
        const url = generateInviteURL(slug, this.inviteBaseURL);
        return {
            slug,
            url,
            qrData: url,
        };
    }
    /**
     * Rotates the invite tag, invalidating all existing invites.
     */
    rotateInviteTag(currentMetadata) {
        const newTag = generateInviteTag();
        const metadata = {
            ...currentMetadata,
            tag: newTag,
        };
        const encodedMetadata = this.encodeMetadata(metadata);
        return { metadata, encodedMetadata, newTag };
    }
    /**
     * Encodes conversation metadata for storage in XMTP appData.
     */
    encodeMetadata(metadata) {
        const bytes = encodeConversationMetadata(metadata);
        const compressed = compressIfSmaller(bytes);
        return base64UrlEncode(compressed);
    }
    /**
     * Decodes conversation metadata from XMTP appData.
     */
    decodeMetadata(encoded) {
        const compressed = base64UrlDecode(encoded);
        const bytes = decompress(compressed);
        return decodeConversationMetadata(bytes);
    }
    /**
     * Gets the invite tag from encoded metadata.
     */
    getInviteTag(encodedMetadata) {
        const metadata = this.decodeMetadata(encodedMetadata);
        return metadata.tag;
    }
    /**
     * Gets the inbox ID.
     */
    getInboxId() {
        return this.inboxId;
    }
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
    async join(inviteUrl) {
        // Parse the invite URL/slug
        let parsedInvite;
        try {
            parsedInvite = parseInviteSlug(inviteUrl);
        }
        catch (err) {
            throw new Error(`Invalid invite URL: ${err instanceof Error ? err.message : "parse error"}`);
        }
        // Check if invite is expired
        if (parsedInvite.isExpired) {
            throw new Error("Invite has expired");
        }
        // Check if conversation is expired
        if (parsedInvite.isConversationExpired) {
            throw new Error("Conversation has expired");
        }
        const creatorInboxId = parsedInvite.creatorInboxId;
        // Cannot join own invite
        if (creatorInboxId === this.inboxId) {
            throw new Error("Cannot join your own conversation");
        }
        // Create a DM with the creator to send the join request
        const createDm = this.agent.client.conversations.createDm;
        if (!createDm) {
            throw new Error("XMTP client does not support DM conversations");
        }
        const dm = await createDm.call(this.agent.client.conversations, creatorInboxId);
        // Extract the slug from the URL for sending
        const slug = parseInviteCode(inviteUrl);
        // Send the slug as a join request
        if (dm.sendText) {
            await dm.sendText(slug);
        }
        else {
            await dm.send(slug);
        }
        return {
            conversationId: parsedInvite.payload.conversationToken.toString(),
            creatorInboxId,
            inviteTag: parsedInvite.payload.tag,
            name: parsedInvite.payload.name,
            description: parsedInvite.payload.description,
        };
    }
    /**
     * Handles incoming messages, checking for join requests.
     * Returns true if the message was handled as a join request.
     */
    async handleMessage(ctx) {
        const messageText = this.extractText(ctx.message.content);
        if (!messageText) {
            return false; // Not a text message, pass through
        }
        const senderInboxId = ctx.message.senderInboxId;
        // Ignore messages from self
        if (senderInboxId === this.inboxId) {
            return false;
        }
        // Try to parse as invite slug
        let parsedInvite;
        try {
            parsedInvite = parseInviteSlug(messageText);
        }
        catch {
            // Not a valid invite format
            if (this.looksLikeInviteSlug(messageText)) {
                // Looks like a malformed invite attempt - block sender
                await this.blockSender(senderInboxId);
                return true; // Handled (blocked)
            }
            return false; // Pass through to other handlers
        }
        // Verify the creator inbox ID matches ours
        if (parsedInvite.creatorInboxId !== this.inboxId) {
            await this.blockSender(senderInboxId);
            return true; // Handled (blocked)
        }
        // Verify the signature
        if (!verifyInviteWithPrivateKey(parsedInvite.signedInvite, this.privateKey)) {
            await this.blockSender(senderInboxId);
            return true; // Handled (blocked)
        }
        const inviteTag = parsedInvite.payload.tag;
        // Check if invite is expired
        if (parsedInvite.isExpired || parsedInvite.isConversationExpired) {
            const error = createConversationExpiredError(inviteTag);
            await this.sendError(ctx, error);
            return true; // Handled
        }
        // Decrypt the conversation ID
        let conversationId;
        try {
            conversationId = decryptInviteConversationId(parsedInvite, this.privateKey);
        }
        catch {
            await this.blockSender(senderInboxId);
            return true; // Handled (blocked)
        }
        // Check if conversation exists
        const conversation = await this.agent.client.conversations.getConversationById(conversationId);
        if (!conversation) {
            const error = createConversationExpiredError(inviteTag);
            await this.sendError(ctx, error);
            return true; // Handled
        }
        // Create invite context
        const inviteContext = {
            joinerInboxId: senderInboxId,
            conversationId,
            inviteTag,
            invite: parsedInvite,
            dmContext: ctx,
            accept: async () => {
                await conversation.addMembers([senderInboxId]);
            },
            reject: async (error) => {
                const errorToSend = error ?? createGenericFailureError(inviteTag);
                await this.sendError(ctx, errorToSend);
            },
        };
        // Emit to all handlers
        for (const handler of this.inviteHandlers) {
            try {
                await handler(inviteContext);
            }
            catch (err) {
                console.error("Error in invite handler:", err);
                // Send error back to joiner
                const error = createGenericFailureError(inviteTag);
                await this.sendError(ctx, error);
            }
        }
        return true; // Handled as join request
    }
    /**
     * Blocks a DM sender using the agent's contacts API
     */
    async blockSender(inboxId) {
        try {
            await this.agent.client.contacts.refreshConsentList();
            await this.agent.client.contacts.block([inboxId]);
        }
        catch {
            // Fire and forget - don't fail if blocking fails
        }
    }
    /**
     * Extracts text content from a message.
     */
    extractText(content) {
        if (typeof content === "string") {
            return content;
        }
        if (content && typeof content === "object" && "text" in content) {
            return content.text;
        }
        return null;
    }
    /**
     * Sends an error message back to the joiner.
     */
    async sendError(ctx, error) {
        try {
            const encoded = encodeInviteJoinError(error);
            await ctx.conversation.send(encoded);
        }
        catch {
            // Fire and forget - don't fail if error sending fails
        }
    }
    /**
     * Heuristic check if a string looks like it might be an invite slug.
     */
    looksLikeInviteSlug(text) {
        const trimmed = text.trim();
        if (trimmed.length < 50)
            return false;
        const base64UrlPattern = /^[A-Za-z0-9_\-*]+$/;
        return base64UrlPattern.test(trimmed);
    }
}
//# sourceMappingURL=convos-middleware.js.map