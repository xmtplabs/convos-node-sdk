import { deriveInviteKey } from "../crypto/hkdf.js";
import { encrypt, decrypt } from "../crypto/chacha20poly1305.js";

const FORMAT_VERSION = 0x01;
const TYPE_UUID = 0x01;
const TYPE_STRING = 0x02;

// UUID regex pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Encrypts a conversation ID into a token.
 * Binary format: version(1) | nonce(12) | ciphertext | tag(16)
 * Plaintext format: type(1) | payload
 *   - UUID (type 0x01): 16 bytes
 *   - String (type 0x02): length-prefixed UTF-8
 */
export function encryptConversationToken(
  conversationId: string,
  creatorInboxId: string,
  privateKey: Uint8Array
): Uint8Array {
  const key = deriveInviteKey(privateKey, creatorInboxId);
  const aad = new TextEncoder().encode(creatorInboxId);
  const plaintext = packConversationId(conversationId);

  const encrypted = encrypt(plaintext, key, aad);

  // Prepend version byte
  const result = new Uint8Array(1 + encrypted.length);
  result[0] = FORMAT_VERSION;
  result.set(encrypted, 1);
  return result;
}

/**
 * Decrypts a conversation token back to a conversation ID.
 */
export function decryptConversationToken(
  tokenBytes: Uint8Array,
  creatorInboxId: string,
  privateKey: Uint8Array
): string {
  if (tokenBytes.length < 1) {
    throw new Error("Token too short");
  }

  const version = tokenBytes[0];
  if (version !== FORMAT_VERSION) {
    throw new Error(`Unsupported token version: ${version}`);
  }

  const key = deriveInviteKey(privateKey, creatorInboxId);
  const aad = new TextEncoder().encode(creatorInboxId);
  const encrypted = tokenBytes.slice(1);

  const plaintext = decrypt(encrypted, key, aad);
  return unpackConversationId(plaintext);
}

/**
 * Packs a conversation ID into binary format.
 */
function packConversationId(conversationId: string): Uint8Array {
  // Check if it's a UUID
  if (UUID_PATTERN.test(conversationId)) {
    const uuidBytes = uuidToBytes(conversationId);
    const result = new Uint8Array(1 + 16);
    result[0] = TYPE_UUID;
    result.set(uuidBytes, 1);
    return result;
  }

  // String format
  const stringBytes = new TextEncoder().encode(conversationId);
  if (stringBytes.length <= 255) {
    // Short string: 1-byte length prefix
    const result = new Uint8Array(1 + 1 + stringBytes.length);
    result[0] = TYPE_STRING;
    result[1] = stringBytes.length;
    result.set(stringBytes, 2);
    return result;
  } else {
    // Long string: 0x00 sentinel + 2-byte big-endian length
    const result = new Uint8Array(1 + 3 + stringBytes.length);
    result[0] = TYPE_STRING;
    result[1] = 0x00;
    result[2] = (stringBytes.length >> 8) & 0xff;
    result[3] = stringBytes.length & 0xff;
    result.set(stringBytes, 4);
    return result;
  }
}

/**
 * Unpacks a conversation ID from binary format.
 */
function unpackConversationId(data: Uint8Array): string {
  if (data.length < 1) {
    throw new Error("Invalid packed conversation ID");
  }

  const type = data[0];

  if (type === TYPE_UUID) {
    if (data.length !== 17) {
      throw new Error(`Invalid UUID token length: ${data.length}`);
    }
    return bytesToUuid(data.slice(1));
  }

  if (type === TYPE_STRING) {
    if (data.length < 2) {
      throw new Error("Invalid string token: missing length");
    }

    let length: number;
    let offset: number;

    if (data[1] === 0x00) {
      // Long string format
      if (data.length < 4) {
        throw new Error("Invalid long string token: missing length bytes");
      }
      length = (data[2] << 8) | data[3];
      offset = 4;
    } else {
      // Short string format
      length = data[1];
      offset = 2;
    }

    if (data.length !== offset + length) {
      throw new Error(`Invalid string token length: expected ${offset + length}, got ${data.length}`);
    }

    return new TextDecoder().decode(data.slice(offset, offset + length));
  }

  throw new Error(`Unknown conversation ID type: ${type}`);
}

/**
 * Converts a UUID string to 16 bytes.
 */
function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Converts 16 bytes to a UUID string.
 */
function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
