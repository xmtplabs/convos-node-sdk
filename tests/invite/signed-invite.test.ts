import { describe, it, expect } from "vitest";
import {
  createInviteSlug,
  parseInviteSlug,
  verifyInvite,
  verifyInviteWithPrivateKey,
  decryptInviteConversationId,
} from "../../src/invite/signed-invite.js";
import { getPublicKey } from "../../src/crypto/secp256k1.js";

describe("signedInvite", () => {
  const testPrivateKey = new Uint8Array([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
    0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
    0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
  ]);
  const testInboxId = "abc123def456789012345678901234567890abcdef12345678901234567890ab";
  const testConversationId = "550e8400-e29b-41d4-a716-446655440000";
  const testTag = "invite1234";

  describe("createInviteSlug", () => {
    it("should create a valid invite slug", () => {
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      expect(typeof slug).toBe("string");
      expect(slug.length).toBeGreaterThan(0);
    });

    it("should create invite with all metadata", () => {
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
        name: "Test Conversation",
        description: "A test conversation",
        imageURL: "https://example.com/image.png",
        expiresAt: new Date(Date.now() + 86400000),
        conversationExpiresAt: new Date(Date.now() + 86400000 * 7),
        expiresAfterUse: true,
      });

      const parsed = parseInviteSlug(slug);
      expect(parsed.payload.name).toBe("Test Conversation");
      expect(parsed.payload.description).toBe("A test conversation");
      expect(parsed.payload.imageURL).toBe("https://example.com/image.png");
      expect(parsed.payload.expiresAfterUse).toBe(true);
    });
  });

  describe("parseInviteSlug", () => {
    it("should parse a created invite slug", () => {
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      const parsed = parseInviteSlug(slug);
      expect(parsed.payload.tag).toBe(testTag);
      expect(parsed.creatorInboxId).toBe(testInboxId);
      expect(parsed.isExpired).toBe(false);
      expect(parsed.isConversationExpired).toBe(false);
    });

    it("should detect expired invite", () => {
      const pastDate = new Date(Date.now() - 1000);
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
        expiresAt: pastDate,
      });

      const parsed = parseInviteSlug(slug);
      expect(parsed.isExpired).toBe(true);
    });

    it("should detect expired conversation", () => {
      const pastDate = new Date(Date.now() - 1000);
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
        conversationExpiresAt: pastDate,
      });

      const parsed = parseInviteSlug(slug);
      expect(parsed.isConversationExpired).toBe(true);
    });

    it("should parse invite from full URL", () => {
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      const url = `https://popup.convos.org/v2?code=${encodeURIComponent(slug)}`;
      const parsed = parseInviteSlug(url);
      expect(parsed.payload.tag).toBe(testTag);
    });
  });

  describe("verifyInvite", () => {
    it("should verify invite with correct public key", () => {
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      const parsed = parseInviteSlug(slug);
      const publicKey = getPublicKey(testPrivateKey);
      expect(verifyInvite(parsed.signedInvite, publicKey)).toBe(true);
    });

    it("should reject invite with wrong public key", () => {
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      const parsed = parseInviteSlug(slug);
      // Use a different valid private key
      const wrongKey = new Uint8Array([
        0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c,
        0x2d, 0x2e, 0x2f, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38,
        0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x40,
      ]);
      const wrongPublicKey = getPublicKey(wrongKey);
      expect(verifyInvite(parsed.signedInvite, wrongPublicKey)).toBe(false);
    });
  });

  describe("verifyInviteWithPrivateKey", () => {
    it("should verify invite with correct private key", () => {
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      const parsed = parseInviteSlug(slug);
      expect(verifyInviteWithPrivateKey(parsed.signedInvite, testPrivateKey)).toBe(true);
    });
  });

  describe("decryptInviteConversationId", () => {
    it("should decrypt conversation ID with correct private key", () => {
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      const parsed = parseInviteSlug(slug);
      const decrypted = decryptInviteConversationId(parsed, testPrivateKey);
      expect(decrypted).toBe(testConversationId.toLowerCase());
    });

    it("should fail to decrypt with wrong private key", () => {
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      const parsed = parseInviteSlug(slug);
      const wrongKey = new Uint8Array(32).fill(0xff);
      expect(() => decryptInviteConversationId(parsed, wrongKey)).toThrow();
    });
  });

  describe("full round-trip", () => {
    it("should create, parse, verify, and decrypt successfully", () => {
      // Create invite
      const slug = createInviteSlug({
        conversationId: testConversationId,
        inviteTag: testTag,
        creatorInboxId: testInboxId,
        privateKey: testPrivateKey,
        name: "Test Group",
      });

      // Parse invite
      const parsed = parseInviteSlug(slug);
      expect(parsed.payload.tag).toBe(testTag);
      expect(parsed.payload.name).toBe("Test Group");
      expect(parsed.creatorInboxId).toBe(testInboxId);
      expect(parsed.isExpired).toBe(false);

      // Verify signature
      const isValid = verifyInviteWithPrivateKey(parsed.signedInvite, testPrivateKey);
      expect(isValid).toBe(true);

      // Decrypt conversation ID
      const conversationId = decryptInviteConversationId(parsed, testPrivateKey);
      expect(conversationId).toBe(testConversationId.toLowerCase());
    });
  });
});
