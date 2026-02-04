export interface ConversationProfile {
    inboxId: Uint8Array;
    name?: string;
    image?: string;
}
export interface ConversationCustomMetadata {
    tag: string;
    profiles: ConversationProfile[];
    expiresAtUnix?: bigint;
    imageEncryptionKey?: Uint8Array;
}
/**
 * Encodes ConversationCustomMetadata to protobuf bytes.
 */
export declare function encodeConversationMetadata(metadata: ConversationCustomMetadata): Uint8Array;
/**
 * Decodes protobuf bytes to ConversationCustomMetadata.
 */
export declare function decodeConversationMetadata(bytes: Uint8Array): ConversationCustomMetadata;
//# sourceMappingURL=conversation-metadata.d.ts.map