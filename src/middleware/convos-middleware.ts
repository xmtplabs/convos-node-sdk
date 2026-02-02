import { hexToBytes } from "../utils/hex.js";
import { generateInviteTag } from "../utils/random.js";
import {
  createInviteSlug,
  parseInviteSlug,
  verifyInviteWithPrivateKey,
  decryptInviteConversationId,
  type ParsedInvite,
} from "../invite/signed-invite.js";
import { generateInviteURL, parseInviteCode } from "../invite/encoding.js";
import {
  encodeConversationMetadata,
  decodeConversationMetadata,
  type ConversationCustomMetadata,
} from "../proto/conversation-metadata.js";
import { compressIfSmaller, decompress } from "../utils/compression.js";
import { base64UrlEncode, base64UrlDecode } from "../utils/base64url.js";
import {
  createConversationExpiredError,
  createGenericFailureError,
  encodeInviteJoinError,
  type InviteJoinError,
} from "../content-types/invite-join-error.js";
import {
  createConvosGroup,
  type ConvosGroup,
  type ConvosGroupInviteOptions,
  type XMTPGroupWithAppData,
} from "./convos-group.js";

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
export type AgentMiddleware = (
  ctx: XMTPMessageContext,
  next: () => Promise<void>
) => Promise<void>;

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
  /** Base URL for invite links (default: https://popup.convos.org/v2) */
  inviteBaseURL?: string;
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
export class ConvosMiddleware {
  private readonly agent: XMTPAgent;
  private readonly inboxId: string;
  private readonly privateKey: Uint8Array;
  private readonly inviteBaseURL: string;
  private inviteHandlers: InviteHandler[] = [];

  private constructor(agent: XMTPAgent, options: ConvosMiddlewareOptions) {
    this.agent = agent;
    this.inboxId = agent.client.inboxId;

    // Get privateKey from options or environment
    if (options.privateKey) {
      this.privateKey = this.normalizePrivateKey(options.privateKey);
    } else {
      const envKey = process.env.XMTP_WALLET_KEY || process.env.WALLET_KEY;
      if (!envKey) {
        throw new Error(
          "privateKey is required. Provide it in options or set XMTP_WALLET_KEY environment variable."
        );
      }
      this.privateKey = this.normalizePrivateKey(envKey);
    }

    this.inviteBaseURL = options.inviteBaseURL ?? "https://popup.convos.org/v2";
  }

  /**
   * Normalizes a private key from either Uint8Array or hex string to Uint8Array.
   */
  private normalizePrivateKey(key: Uint8Array | string): Uint8Array {
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
  static create(agent: XMTPAgent, options: ConvosMiddlewareOptions = {}): ConvosMiddleware {
    return new ConvosMiddleware(agent, options);
  }

  /**
   * Returns the middleware function for use with agent.use()
   * This intercepts DM messages to handle join requests.
   */
  middleware(): AgentMiddleware {
    return async (ctx: XMTPMessageContext, next: () => Promise<void>) => {
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
  on(event: "invite", handler: InviteHandler): void {
    if (event === "invite") {
      this.inviteHandlers.push(handler);
    }
  }

  /**
   * Removes an invite handler.
   */
  off(event: "invite", handler: InviteHandler): void {
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
  createInitialMetadata(options?: {
    expiresAt?: Date;
  }): { metadata: ConversationCustomMetadata; encodedMetadata: string } {
    const inviteTag = generateInviteTag();

    const metadata: ConversationCustomMetadata = {
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
  createInvite(
    conversation: { id: string } | string,
    options: CreateInviteOptions
  ): InviteResult {
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
  group<T extends XMTPGroupWithAppData>(xmtpGroup: T): ConvosGroup<T> {
    return createConvosGroup(xmtpGroup, this);
  }

  /**
   * Internal method for creating invites, used by both the legacy API and ConvosGroup.
   */
  createInviteInternal(
    conversationId: string,
    inviteTag: string,
    options?: ConvosGroupInviteOptions
  ): InviteResult {
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
  rotateInviteTag(currentMetadata: ConversationCustomMetadata): {
    metadata: ConversationCustomMetadata;
    encodedMetadata: string;
    newTag: string;
  } {
    const newTag = generateInviteTag();
    const metadata: ConversationCustomMetadata = {
      ...currentMetadata,
      tag: newTag,
    };
    const encodedMetadata = this.encodeMetadata(metadata);
    return { metadata, encodedMetadata, newTag };
  }

  /**
   * Encodes conversation metadata for storage in XMTP appData.
   */
  encodeMetadata(metadata: ConversationCustomMetadata): string {
    const bytes = encodeConversationMetadata(metadata);
    const compressed = compressIfSmaller(bytes);
    return base64UrlEncode(compressed);
  }

  /**
   * Decodes conversation metadata from XMTP appData.
   */
  decodeMetadata(encoded: string): ConversationCustomMetadata {
    const compressed = base64UrlDecode(encoded);
    const bytes = decompress(compressed);
    return decodeConversationMetadata(bytes);
  }

  /**
   * Gets the invite tag from encoded metadata.
   */
  getInviteTag(encodedMetadata: string): string {
    const metadata = this.decodeMetadata(encodedMetadata);
    return metadata.tag;
  }

  /**
   * Gets the inbox ID.
   */
  getInboxId(): string {
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
  async join(inviteUrl: string): Promise<JoinResult> {
    // Parse the invite URL/slug
    let parsedInvite: ParsedInvite;
    try {
      parsedInvite = parseInviteSlug(inviteUrl);
    } catch (err) {
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
    } else {
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
  private async handleMessage(ctx: XMTPMessageContext): Promise<boolean> {
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
    let parsedInvite: ParsedInvite;
    try {
      parsedInvite = parseInviteSlug(messageText);
    } catch {
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
    let conversationId: string;
    try {
      conversationId = decryptInviteConversationId(parsedInvite, this.privateKey);
    } catch {
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
    const inviteContext: InviteContext = {
      joinerInboxId: senderInboxId,
      conversationId,
      inviteTag,
      invite: parsedInvite,
      dmContext: ctx,
      accept: async () => {
        await conversation.addMembers([senderInboxId]);
      },
      reject: async (error?: InviteJoinError) => {
        const errorToSend = error ?? createGenericFailureError(inviteTag);
        await this.sendError(ctx, errorToSend);
      },
    };

    // Emit to all handlers
    for (const handler of this.inviteHandlers) {
      try {
        await handler(inviteContext);
      } catch (err) {
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
  private async blockSender(inboxId: string): Promise<void> {
    try {
      await this.agent.client.contacts.refreshConsentList();
      await this.agent.client.contacts.block([inboxId]);
    } catch {
      // Fire and forget - don't fail if blocking fails
    }
  }

  /**
   * Extracts text content from a message.
   */
  private extractText(content: unknown): string | null {
    if (typeof content === "string") {
      return content;
    }
    if (content && typeof content === "object" && "text" in content) {
      return (content as { text: string }).text;
    }
    return null;
  }

  /**
   * Sends an error message back to the joiner.
   */
  private async sendError(ctx: XMTPMessageContext, error: InviteJoinError): Promise<void> {
    try {
      const encoded = encodeInviteJoinError(error);
      await ctx.conversation.send(encoded);
    } catch {
      // Fire and forget - don't fail if error sending fails
    }
  }

  /**
   * Heuristic check if a string looks like it might be an invite slug.
   */
  private looksLikeInviteSlug(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length < 50) return false;
    const base64UrlPattern = /^[A-Za-z0-9_\-*]+$/;
    return base64UrlPattern.test(trimmed);
  }
}
