import { describe, it, expect } from "vitest";
import {
  encryptConversationToken,
  decryptConversationToken,
} from "../../src/invite/conversation-token.js";

describe("conversationToken", () => {
  const testPrivateKey = new Uint8Array([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
    0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
    0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
  ]);
  const testInboxId = "abc123def456";

  describe("UUID format", () => {
    const testUuid = "550e8400-e29b-41d4-a716-446655440000";

    it("should encrypt and decrypt UUID conversation ID", () => {
      const token = encryptConversationToken(testUuid, testInboxId, testPrivateKey);
      const decrypted = decryptConversationToken(token, testInboxId, testPrivateKey);
      expect(decrypted).toBe(testUuid.toLowerCase());
    });

    it("should produce token with version byte", () => {
      const token = encryptConversationToken(testUuid, testInboxId, testPrivateKey);
      expect(token[0]).toBe(0x01); // Version 1
    });

    it("should produce different tokens each time (random nonce)", () => {
      const token1 = encryptConversationToken(testUuid, testInboxId, testPrivateKey);
      const token2 = encryptConversationToken(testUuid, testInboxId, testPrivateKey);
      expect(token1).not.toEqual(token2);
    });
  });

  describe("String format", () => {
    it("should encrypt and decrypt short string conversation ID", () => {
      const conversationId = "some-conversation-id-123";
      const token = encryptConversationToken(conversationId, testInboxId, testPrivateKey);
      const decrypted = decryptConversationToken(token, testInboxId, testPrivateKey);
      expect(decrypted).toBe(conversationId);
    });

    it("should encrypt and decrypt long string conversation ID (>255 chars)", () => {
      const conversationId = "x".repeat(300);
      const token = encryptConversationToken(conversationId, testInboxId, testPrivateKey);
      const decrypted = decryptConversationToken(token, testInboxId, testPrivateKey);
      expect(decrypted).toBe(conversationId);
    });
  });

  describe("AAD binding", () => {
    it("should fail decryption with different inbox ID", () => {
      const testUuid = "550e8400-e29b-41d4-a716-446655440000";
      const token = encryptConversationToken(testUuid, testInboxId, testPrivateKey);
      expect(() =>
        decryptConversationToken(token, "different-inbox-id", testPrivateKey)
      ).toThrow();
    });

    it("should fail decryption with different private key", () => {
      const testUuid = "550e8400-e29b-41d4-a716-446655440000";
      const token = encryptConversationToken(testUuid, testInboxId, testPrivateKey);
      const wrongKey = new Uint8Array(32).fill(0xff);
      expect(() =>
        decryptConversationToken(token, testInboxId, wrongKey)
      ).toThrow();
    });
  });

  describe("error handling", () => {
    it("should throw on empty token", () => {
      expect(() =>
        decryptConversationToken(new Uint8Array(0), testInboxId, testPrivateKey)
      ).toThrow("Token too short");
    });

    it("should throw on unsupported version", () => {
      const token = new Uint8Array([0xff, 1, 2, 3, 4, 5]);
      expect(() =>
        decryptConversationToken(token, testInboxId, testPrivateKey)
      ).toThrow("Unsupported token version");
    });
  });
});
