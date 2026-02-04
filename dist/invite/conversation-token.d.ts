/**
 * Encrypts a conversation ID into a token.
 * Binary format: version(1) | nonce(12) | ciphertext | tag(16)
 * Plaintext format: type(1) | payload
 *   - UUID (type 0x01): 16 bytes
 *   - String (type 0x02): length-prefixed UTF-8
 */
export declare function encryptConversationToken(conversationId: string, creatorInboxId: string, privateKey: Uint8Array): Uint8Array;
/**
 * Decrypts a conversation token back to a conversation ID.
 */
export declare function decryptConversationToken(tokenBytes: Uint8Array, creatorInboxId: string, privateKey: Uint8Array): string;
//# sourceMappingURL=conversation-token.d.ts.map