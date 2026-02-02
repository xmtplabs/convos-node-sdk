import protobuf from "protobufjs";

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

export interface InvitePayload {
  conversationToken: Uint8Array;
  creatorInboxId: Uint8Array;
  tag: string;
  name?: string;
  description?: string;
  imageURL?: string;
  conversationExpiresAtUnix?: bigint;
  expiresAtUnix?: bigint;
  expiresAfterUse: boolean;
}

export interface SignedInvite {
  payload: Uint8Array;
  signature: Uint8Array;
}

/**
 * Encodes an InvitePayload to protobuf bytes.
 */
export function encodeInvitePayload(payload: InvitePayload): Uint8Array {
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
export function decodeInvitePayload(bytes: Uint8Array): InvitePayload {
  const message = InvitePayloadType.decode(bytes) as protobuf.Message & {
    conversationToken: Uint8Array;
    creatorInboxId: Uint8Array;
    tag: string;
    name?: string;
    description?: string;
    imageURL?: string;
    conversationExpiresAtUnix?: protobuf.Long;
    expiresAtUnix?: protobuf.Long;
    expiresAfterUse: boolean;
  };

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
export function encodeSignedInvite(invite: SignedInvite): Uint8Array {
  const message = SignedInviteType.create({
    payload: invite.payload,
    signature: invite.signature,
  });
  return SignedInviteType.encode(message).finish();
}

/**
 * Decodes protobuf bytes to a SignedInvite.
 */
export function decodeSignedInvite(bytes: Uint8Array): SignedInvite {
  const message = SignedInviteType.decode(bytes) as protobuf.Message & {
    payload: Uint8Array;
    signature: Uint8Array;
  };

  return {
    payload: new Uint8Array(message.payload),
    signature: new Uint8Array(message.signature),
  };
}

// Long helper for bigint conversion
const Long = {
  fromBigInt(value: bigint): protobuf.Long {
    const low = Number(value & 0xffffffffn);
    const high = Number((value >> 32n) & 0xffffffffn);
    return new protobuf.util.Long(low, high, false);
  },
};
