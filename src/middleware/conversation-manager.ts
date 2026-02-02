import { generateInviteTag } from "../utils/random.js";
import { hexToBytes } from "../utils/hex.js";
import {
  createInviteSlug,
  type CreateInviteOptions,
} from "../invite/signed-invite.js";
import { generateInviteURL } from "../invite/encoding.js";
import {
  encodeConversationMetadata,
  decodeConversationMetadata,
  type ConversationCustomMetadata,
} from "../proto/conversation-metadata.js";
import { compressIfSmaller, decompress } from "../utils/compression.js";
import { base64UrlEncode, base64UrlDecode } from "../utils/base64url.js";

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
export class ConvosConversationManager {
  private readonly inboxId: string;
  private readonly privateKey: Uint8Array;
  private readonly inviteBaseURL: string;

  /**
   * Creates a ConvosConversationManager.
   *
   * @param options Configuration options
   * @param agent Optional XMTP Agent to extract inboxId from
   */
  constructor(options: ConvosConversationManagerOptions, agent?: XMTPAgent) {
    // Get inboxId from options, agent, or throw
    if (options.inboxId) {
      this.inboxId = options.inboxId;
    } else if (agent?.client?.inboxId) {
      this.inboxId = agent.client.inboxId;
    } else {
      throw new Error(
        "inboxId is required. Provide it in options or pass an XMTP agent."
      );
    }

    // Get privateKey from options or environment
    if (options.privateKey) {
      this.privateKey = options.privateKey;
    } else {
      const envKey = process.env.XMTP_WALLET_KEY || process.env.WALLET_KEY;
      if (!envKey) {
        throw new Error(
          "privateKey is required. Provide it in options or set XMTP_WALLET_KEY environment variable."
        );
      }
      this.privateKey = hexToBytes(envKey.replace(/^0x/, ""));
    }

    this.inviteBaseURL = options.inviteBaseURL ?? "https://popup.convos.org/v2";
  }

  /**
   * Creates a ConvosConversationManager from an XMTP Agent.
   * Reads the private key from XMTP_WALLET_KEY environment variable.
   */
  static fromAgent(agent: XMTPAgent, options?: { inviteBaseURL?: string }): ConvosConversationManager {
    return new ConvosConversationManager(
      { inviteBaseURL: options?.inviteBaseURL },
      agent
    );
  }

  /**
   * Creates initial conversation metadata with a new invite tag.
   * Call this when creating a new group conversation.
   */
  createInitialMetadata(options?: {
    name?: string;
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
   */
  createInvite(conversation: ConversationInfo, options?: {
    expiresAt?: Date;
    expiresAfterUse?: boolean;
  }): InviteResult {
    const inviteOptions: CreateInviteOptions = {
      conversationId: conversation.conversationId,
      inviteTag: conversation.inviteTag,
      creatorInboxId: conversation.creatorInboxId,
      privateKey: this.privateKey,
      name: conversation.name,
      description: conversation.description,
      imageURL: conversation.imageURL,
      conversationExpiresAt: conversation.expiresAt,
      expiresAt: options?.expiresAt,
      expiresAfterUse: options?.expiresAfterUse,
    };

    const slug = createInviteSlug(inviteOptions);
    const url = generateInviteURL(slug, this.inviteBaseURL);

    return {
      slug,
      url,
      qrData: url, // QR code should encode the full URL
    };
  }

  /**
   * Creates a new invite tag, invalidating all existing invites.
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
   * Encodes conversation metadata to a string suitable for XMTP appData.
   */
  encodeMetadata(metadata: ConversationCustomMetadata): string {
    const bytes = encodeConversationMetadata(metadata);
    const compressed = compressIfSmaller(bytes);
    return base64UrlEncode(compressed);
  }

  /**
   * Decodes conversation metadata from XMTP appData string.
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
   * Gets the creator's inbox ID.
   */
  getInboxId(): string {
    return this.inboxId;
  }

  /**
   * Gets the creator's inbox ID as bytes.
   */
  getInboxIdBytes(): Uint8Array {
    return hexToBytes(this.inboxId);
  }
}
