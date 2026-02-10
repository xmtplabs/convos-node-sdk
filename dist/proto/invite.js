import { protobuf } from "./protobuf-setup.js";
// Define InvitePayload schema programmatically
const InvitePayloadType = new protobuf.Type("InvitePayload")
    .add(new protobuf.Field("conversationToken", 1, "bytes"))
    .add(new protobuf.Field("creatorInboxId", 2, "bytes"))
    .add(new protobuf.Field("tag", 3, "string"))
    .add(new protobuf.Field("name", 4, "string", "optional"))
    .add(new protobuf.Field("description", 5, "string", "optional"))
    .add(new protobuf.Field("imageURL", 6, "string", "optional"))
    .add(new protobuf.Field("conversationExpiresAtUnix", 7, "sfixed64", "optional"))
    .add(new protobuf.Field("expiresAtUnix", 8, "sfixed64", "optional"))
    .add(new protobuf.Field("expiresAfterUse", 9, "bool"));
// Define SignedInvite schema
const SignedInviteType = new protobuf.Type("SignedInvite")
    .add(new protobuf.Field("payload", 1, "bytes"))
    .add(new protobuf.Field("signature", 2, "bytes"));
// Create root namespace (required by protobufjs for types to function)
new protobuf.Root().add(InvitePayloadType).add(SignedInviteType);
/**
 * Encodes an InvitePayload to protobuf bytes.
 */
export function encodeInvitePayload(payload) {
    const message = InvitePayloadType.create({
        conversationToken: payload.conversationToken,
        creatorInboxId: payload.creatorInboxId,
        tag: payload.tag,
        name: payload.name,
        description: payload.description,
        imageURL: payload.imageURL,
        conversationExpiresAtUnix: payload.conversationExpiresAtUnix
            ? Long.fromBigInt(payload.conversationExpiresAtUnix)
            : undefined,
        expiresAtUnix: payload.expiresAtUnix
            ? Long.fromBigInt(payload.expiresAtUnix)
            : undefined,
        expiresAfterUse: payload.expiresAfterUse,
    });
    return InvitePayloadType.encode(message).finish();
}
/**
 * Decodes protobuf bytes to an InvitePayload.
 */
export function decodeInvitePayload(bytes) {
    const message = InvitePayloadType.decode(bytes);
    return {
        conversationToken: new Uint8Array(message.conversationToken),
        creatorInboxId: new Uint8Array(message.creatorInboxId),
        tag: message.tag,
        name: message.name || undefined,
        description: message.description || undefined,
        imageURL: message.imageURL || undefined,
        conversationExpiresAtUnix: message.conversationExpiresAtUnix && message.conversationExpiresAtUnix.toString() !== "0"
            ? BigInt(message.conversationExpiresAtUnix.toString())
            : undefined,
        expiresAtUnix: message.expiresAtUnix && message.expiresAtUnix.toString() !== "0"
            ? BigInt(message.expiresAtUnix.toString())
            : undefined,
        expiresAfterUse: message.expiresAfterUse ?? false,
    };
}
/**
 * Encodes a SignedInvite to protobuf bytes.
 */
export function encodeSignedInvite(invite) {
    const message = SignedInviteType.create({
        payload: invite.payload,
        signature: invite.signature,
    });
    return SignedInviteType.encode(message).finish();
}
/**
 * Decodes protobuf bytes to a SignedInvite.
 */
export function decodeSignedInvite(bytes) {
    const message = SignedInviteType.decode(bytes);
    return {
        payload: new Uint8Array(message.payload),
        signature: new Uint8Array(message.signature),
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
//# sourceMappingURL=invite.js.map