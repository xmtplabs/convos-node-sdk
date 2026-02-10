import { protobuf } from "./protobuf-setup.js";
// Define ConversationProfile schema
const ConversationProfileType = new protobuf.Type("ConversationProfile")
    .add(new protobuf.Field("inboxId", 1, "bytes"))
    .add(new protobuf.Field("name", 2, "string", "optional"))
    .add(new protobuf.Field("image", 3, "string", "optional"));
// Define ConversationCustomMetadata schema
const ConversationCustomMetadataType = new protobuf.Type("ConversationCustomMetadata")
    .add(new protobuf.Field("tag", 1, "string"))
    .add(new protobuf.Field("profiles", 2, "ConversationProfile", "repeated"))
    .add(new protobuf.Field("expiresAtUnix", 3, "sfixed64", "optional"))
    .add(new protobuf.Field("imageEncryptionKey", 4, "bytes", "optional"));
// Add nested type and register with root (required by protobufjs for type resolution)
ConversationCustomMetadataType.add(ConversationProfileType);
new protobuf.Root().add(ConversationCustomMetadataType);
/**
 * Encodes ConversationCustomMetadata to protobuf bytes.
 */
export function encodeConversationMetadata(metadata) {
    const profiles = metadata.profiles.map((p) => ({
        inboxId: p.inboxId,
        name: p.name,
        image: p.image,
    }));
    const message = ConversationCustomMetadataType.create({
        tag: metadata.tag,
        profiles,
        expiresAtUnix: metadata.expiresAtUnix
            ? Long.fromBigInt(metadata.expiresAtUnix)
            : undefined,
        imageEncryptionKey: metadata.imageEncryptionKey,
    });
    return ConversationCustomMetadataType.encode(message).finish();
}
/**
 * Decodes protobuf bytes to ConversationCustomMetadata.
 */
export function decodeConversationMetadata(bytes) {
    const message = ConversationCustomMetadataType.decode(bytes);
    return {
        tag: message.tag,
        profiles: (message.profiles || []).map((p) => ({
            inboxId: new Uint8Array(p.inboxId),
            name: p.name,
            image: p.image,
        })),
        expiresAtUnix: message.expiresAtUnix
            ? BigInt(message.expiresAtUnix.toString())
            : undefined,
        imageEncryptionKey: message.imageEncryptionKey
            ? new Uint8Array(message.imageEncryptionKey)
            : undefined,
    };
}
// Long helper for bigint conversion
const Long = {
    fromBigInt(value) {
        const low = Number(value & 0xffffffffn);
        const high = Number((value >> 32n) & 0xffffffffn);
        return new protobuf.util.Long(low, high, false);
    },
};
//# sourceMappingURL=conversation-metadata.js.map