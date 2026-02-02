import type { ConversationCustomMetadata, ConversationProfile } from "../proto/conversation-metadata.js";
import type { InviteResult } from "./convos-middleware.js";
import { hexToBytes, bytesToHex } from "../utils/hex.js";

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
  createInitialMetadata(options?: { expiresAt?: Date }): {
    metadata: ConversationCustomMetadata;
    encodedMetadata: string;
  };
  decodeMetadata(encoded: string): ConversationCustomMetadata;
  encodeMetadata(metadata: ConversationCustomMetadata): string;
  createInviteInternal(
    conversationId: string,
    inviteTag: string,
    options?: ConvosGroupInviteOptions
  ): InviteResult;
  getInboxId(): string;
}

/**
 * A ConvosGroup wraps an XMTP group with Convos functionality.
 * Access the underlying group via the `inner` property.
 */
export class ConvosGroup<T extends XMTPGroupWithAppData = XMTPGroupWithAppData> {
  /**
   * The underlying XMTP group. Use this to access all native group methods.
   */
  readonly inner: T;
  private readonly middleware: ConvosMiddlewareRef;

  constructor(group: T, middleware: ConvosMiddlewareRef) {
    this.inner = group;
    this.middleware = middleware;
  }

  /**
   * The conversation/group ID
   */
  get id(): string {
    return this.inner.id;
  }

  /**
   * Creates an invite for this group.
   * Automatically manages metadata - creates it if needed, or uses existing.
   */
  async createInvite(options?: ConvosGroupInviteOptions): Promise<InviteResult> {
    let inviteTag: string;

    // Check if the group already has metadata with an invite tag
    const existingAppData = this.inner.appData;

    if (existingAppData) {
      try {
        const metadata = this.middleware.decodeMetadata(existingAppData);
        if (metadata.tag) {
          inviteTag = metadata.tag;
        } else {
          inviteTag = await this.initializeMetadata();
        }
      } catch {
        inviteTag = await this.initializeMetadata();
      }
    } else {
      inviteTag = await this.initializeMetadata();
    }

    return this.middleware.createInviteInternal(this.inner.id, inviteTag, options);
  }

  /**
   * Sets the agent's profile on this conversation.
   * The profile is stored in the conversation's metadata and will be visible to other members.
   */
  async setConversationProfile(options: SetConversationProfileOptions): Promise<void> {
    const inboxIdHex = this.middleware.getInboxId();
    const inboxIdBytes = hexToBytes(inboxIdHex);

    // Get current metadata or create new
    let metadata: ConversationCustomMetadata;
    const existingAppData = this.inner.appData;

    if (existingAppData) {
      try {
        metadata = this.middleware.decodeMetadata(existingAppData);
      } catch {
        // Corrupt metadata, create fresh
        const { metadata: newMetadata } = this.middleware.createInitialMetadata();
        metadata = newMetadata;
      }
    } else {
      const { metadata: newMetadata } = this.middleware.createInitialMetadata();
      metadata = newMetadata;
    }

    // Find existing profile by inboxId
    const existingIndex = metadata.profiles.findIndex(
      (p) => bytesToHex(p.inboxId) === inboxIdHex
    );

    const profile: ConversationProfile = {
      inboxId: inboxIdBytes,
      name: options.name,
      image: options.image,
    };

    if (existingIndex >= 0) {
      // Update existing profile
      metadata.profiles[existingIndex] = profile;
    } else {
      // Add new profile
      metadata.profiles.push(profile);
    }

    // Save updated metadata
    const encodedMetadata = this.middleware.encodeMetadata(metadata);
    await this.inner.updateAppData(encodedMetadata);
  }

  private async initializeMetadata(): Promise<string> {
    const { metadata, encodedMetadata } = this.middleware.createInitialMetadata();
    await this.inner.updateAppData(encodedMetadata);
    return metadata.tag;
  }
}

/**
 * Creates a ConvosGroup by wrapping an XMTP group with Convos functionality.
 */
export function createConvosGroup<T extends XMTPGroupWithAppData>(
  group: T,
  middleware: ConvosMiddlewareRef
): ConvosGroup<T> {
  return new ConvosGroup(group, middleware);
}
