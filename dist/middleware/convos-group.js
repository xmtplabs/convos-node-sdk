import { hexToBytes, bytesToHex } from "../utils/hex.js";
/**
 * A ConvosGroup wraps an XMTP group with Convos functionality.
 * Access the underlying group via the `inner` property.
 */
export class ConvosGroup {
    /**
     * The underlying XMTP group. Use this to access all native group methods.
     */
    inner;
    middleware;
    constructor(group, middleware) {
        this.inner = group;
        this.middleware = middleware;
    }
    /**
     * The conversation/group ID
     */
    get id() {
        return this.inner.id;
    }
    /**
     * Creates an invite for this group.
     * Automatically manages metadata - creates it if needed, or uses existing.
     */
    async createInvite(options) {
        let inviteTag;
        // Check if the group already has metadata with an invite tag
        const existingAppData = this.inner.appData;
        if (existingAppData) {
            try {
                const metadata = this.middleware.decodeMetadata(existingAppData);
                if (metadata.tag) {
                    inviteTag = metadata.tag;
                }
                else {
                    inviteTag = await this.initializeMetadata();
                }
            }
            catch {
                inviteTag = await this.initializeMetadata();
            }
        }
        else {
            inviteTag = await this.initializeMetadata();
        }
        return this.middleware.createInviteInternal(this.inner.id, inviteTag, options);
    }
    /**
     * Sets the agent's profile on this conversation.
     * The profile is stored in the conversation's metadata and will be visible to other members.
     */
    async setConversationProfile(options) {
        const inboxIdHex = this.middleware.getInboxId();
        const inboxIdBytes = hexToBytes(inboxIdHex);
        // Get current metadata or create new
        let metadata;
        const existingAppData = this.inner.appData;
        if (existingAppData) {
            try {
                metadata = this.middleware.decodeMetadata(existingAppData);
            }
            catch {
                // Corrupt metadata, create fresh
                const { metadata: newMetadata } = this.middleware.createInitialMetadata();
                metadata = newMetadata;
            }
        }
        else {
            const { metadata: newMetadata } = this.middleware.createInitialMetadata();
            metadata = newMetadata;
        }
        // Find existing profile by inboxId
        const existingIndex = metadata.profiles.findIndex((p) => bytesToHex(p.inboxId) === inboxIdHex);
        const profile = {
            inboxId: inboxIdBytes,
            name: options.name,
            image: options.image,
        };
        if (existingIndex >= 0) {
            // Update existing profile
            metadata.profiles[existingIndex] = profile;
        }
        else {
            // Add new profile
            metadata.profiles.push(profile);
        }
        // Save updated metadata
        const encodedMetadata = this.middleware.encodeMetadata(metadata);
        await this.inner.updateAppData(encodedMetadata);
    }
    async initializeMetadata() {
        const { metadata, encodedMetadata } = this.middleware.createInitialMetadata();
        await this.inner.updateAppData(encodedMetadata);
        return metadata.tag;
    }
}
/**
 * Creates a ConvosGroup by wrapping an XMTP group with Convos functionality.
 */
export function createConvosGroup(group, middleware) {
    return new ConvosGroup(group, middleware);
}
//# sourceMappingURL=convos-group.js.map