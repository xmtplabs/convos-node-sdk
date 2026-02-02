import protobuf from "protobufjs";

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

// Add nested type
ConversationCustomMetadataType.add(ConversationProfileType);

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
export function encodeConversationMetadata(
  metadata: ConversationCustomMetadata
): Uint8Array {
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
export function decodeConversationMetadata(
  bytes: Uint8Array
): ConversationCustomMetadata {
  const message = ConversationCustomMetadataType.decode(bytes) as protobuf.Message & {
    tag: string;
    profiles: Array<{
      inboxId: Uint8Array;
      name?: string;
      image?: string;
    }>;
    expiresAtUnix?: protobuf.Long;
    imageEncryptionKey?: Uint8Array;
  };

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
  fromBigInt(value: bigint): protobuf.Long {
    const low = Number(value & 0xffffffffn);
    const high = Number((value >> 32n) & 0xffffffffn);
    return new protobuf.util.Long(low, high, false);
  },
};
