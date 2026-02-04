import { generateInviteTag } from "../utils/random.js";
import { hexToBytes } from "../utils/hex.js";
import { createInviteSlug, } from "../invite/signed-invite.js";
import { generateInviteURL } from "../invite/encoding.js";
import { encodeConversationMetadata, decodeConversationMetadata, } from "../proto/conversation-metadata.js";
import { compressIfSmaller, decompress } from "../utils/compression.js";
import { base64UrlEncode, base64UrlDecode } from "../utils/base64url.js";
/**
 * Manages Convos conversations with invite capabilities.
 * Provides helpers for creating conversations, generating invites,
 * and managing conversation metadata.
 */
export class ConvosConversationManager {
    inboxId;
    privateKey;
    inviteBaseURL;
    /**
     * Creates a ConvosConversationManager.
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
        this.inviteBaseURL = options.inviteBaseURL ?? "https://popup.convos.org/v2";
    }
    /**
     * Creates a ConvosConversationManager from an XMTP Agent.
     * Reads the private key from XMTP_WALLET_KEY environment variable.
     */
    static fromAgent(agent, options) {
        return new ConvosConversationManager({ inviteBaseURL: options?.inviteBaseURL }, agent);
    }
    /**
     * Creates initial conversation metadata with a new invite tag.
     * Call this when creating a new group conversation.
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
     */
    createInvite(conversation, options) {
        const inviteOptions = {
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
     * Encodes conversation metadata to a string suitable for XMTP appData.
     */
    encodeMetadata(metadata) {
        const bytes = encodeConversationMetadata(metadata);
        const compressed = compressIfSmaller(bytes);
        return base64UrlEncode(compressed);
    }
    /**
     * Decodes conversation metadata from XMTP appData string.
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
     * Gets the creator's inbox ID.
     */
    getInboxId() {
        return this.inboxId;
    }
    /**
     * Gets the creator's inbox ID as bytes.
     */
    getInboxIdBytes() {
        return hexToBytes(this.inboxId);
    }
}
//# sourceMappingURL=conversation-manager.js.map