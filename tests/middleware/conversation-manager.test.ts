import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ConvosConversationManager,
  type ConversationInfo,
  type XMTPAgent,
} from "../../src/middleware/conversation-manager.js";

describe("ConvosConversationManager", () => {
  const testPrivateKey = new Uint8Array([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
    0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
    0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
  ]);
  const testPrivateKeyHex = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
  const testInboxId = "abc123def456789012345678901234567890abcdef12345678901234567890ab";

  function createManager() {
    return new ConvosConversationManager({
      inboxId: testInboxId,
      privateKey: testPrivateKey,
    });
  }

  function createMockAgent(): XMTPAgent {
    return {
      client: {
        inboxId: testInboxId,
      },
    };
  }

  describe("createInitialMetadata", () => {
    it("should create metadata with invite tag", () => {
      const manager = createManager();
      const { metadata, encodedMetadata } = manager.createInitialMetadata();

      expect(metadata.tag).toHaveLength(10);
      expect(metadata.profiles).toEqual([]);
      expect(typeof encodedMetadata).toBe("string");
    });

    it("should create metadata with expiration", () => {
      const manager = createManager();
      const expiresAt = new Date(Date.now() + 86400000);
      const { metadata } = manager.createInitialMetadata({ expiresAt });

      expect(metadata.expiresAtUnix).toBeDefined();
      expect(Number(metadata.expiresAtUnix)).toBeCloseTo(
        Math.floor(expiresAt.getTime() / 1000),
        0
      );
    });
  });

  describe("createInvite", () => {
    it("should create invite with slug, URL, and QR data", () => {
      const manager = createManager();
      const conversation: ConversationInfo = {
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        inviteTag: "test123456",
        creatorInboxId: testInboxId,
        name: "Test Group",
      };

      const invite = manager.createInvite(conversation);

      expect(invite.slug).toBeDefined();
      expect(invite.slug.length).toBeGreaterThan(0);
      expect(invite.url).toContain("https://popup.convos.org/v2");
      expect(invite.url).toContain("i=");
      expect(invite.qrData).toBe(invite.url);
    });

    it("should create invite with custom base URL", () => {
      const manager = new ConvosConversationManager({
        inboxId: testInboxId,
        privateKey: testPrivateKey,
        inviteBaseURL: "https://custom.app/join",
      });
      const conversation: ConversationInfo = {
        conversationId: "test-id",
        inviteTag: "test123456",
        creatorInboxId: testInboxId,
      };

      const invite = manager.createInvite(conversation);
      expect(invite.url).toContain("https://custom.app/join");
    });

    it("should include expiration options", () => {
      const manager = createManager();
      const conversation: ConversationInfo = {
        conversationId: "test-id",
        inviteTag: "test123456",
        creatorInboxId: testInboxId,
      };

      const invite = manager.createInvite(conversation, {
        expiresAt: new Date(Date.now() + 3600000),
        expiresAfterUse: true,
      });

      expect(invite.slug).toBeDefined();
    });
  });

  describe("rotateInviteTag", () => {
    it("should create new tag and preserve other metadata", () => {
      const manager = createManager();
      const { metadata: initialMetadata } = manager.createInitialMetadata();

      const { metadata: rotatedMetadata, newTag } = manager.rotateInviteTag(initialMetadata);

      expect(newTag).toHaveLength(10);
      expect(newTag).not.toBe(initialMetadata.tag);
      expect(rotatedMetadata.tag).toBe(newTag);
      expect(rotatedMetadata.profiles).toEqual(initialMetadata.profiles);
    });
  });

  describe("metadata encoding/decoding", () => {
    it("should round-trip encode and decode metadata", () => {
      const manager = createManager();
      const { metadata: original } = manager.createInitialMetadata();

      const encoded = manager.encodeMetadata(original);
      const decoded = manager.decodeMetadata(encoded);

      expect(decoded.tag).toBe(original.tag);
      expect(decoded.profiles).toEqual(original.profiles);
    });

    it("should extract invite tag from encoded metadata", () => {
      const manager = createManager();
      const { metadata, encodedMetadata } = manager.createInitialMetadata();

      const tag = manager.getInviteTag(encodedMetadata);
      expect(tag).toBe(metadata.tag);
    });
  });

  describe("inbox ID helpers", () => {
    it("should return inbox ID", () => {
      const manager = createManager();
      expect(manager.getInboxId()).toBe(testInboxId);
    });

    it("should return inbox ID as bytes", () => {
      const manager = createManager();
      const bytes = manager.getInboxIdBytes();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(testInboxId.length / 2);
    });
  });

  describe("fromAgent factory", () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.XMTP_WALLET_KEY;
      process.env.XMTP_WALLET_KEY = testPrivateKeyHex;
    });

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.XMTP_WALLET_KEY;
      } else {
        process.env.XMTP_WALLET_KEY = originalEnv;
      }
    });

    it("should create manager from agent", () => {
      const agent = createMockAgent();
      const manager = ConvosConversationManager.fromAgent(agent);

      expect(manager.getInboxId()).toBe(testInboxId);
    });

    it("should create manager from agent with custom base URL", () => {
      const agent = createMockAgent();
      const manager = ConvosConversationManager.fromAgent(agent, {
        inviteBaseURL: "https://custom.app/join",
      });

      const { metadata } = manager.createInitialMetadata();
      const invite = manager.createInvite({
        conversationId: "test-id",
        inviteTag: metadata.tag,
        creatorInboxId: testInboxId,
      });

      expect(invite.url).toContain("https://custom.app/join");
    });

    it("should throw if no agent and no inboxId", () => {
      expect(() => new ConvosConversationManager({})).toThrow("inboxId is required");
    });

    it("should throw if no privateKey and no env var", () => {
      delete process.env.XMTP_WALLET_KEY;
      delete process.env.WALLET_KEY;

      expect(() => new ConvosConversationManager({ inboxId: testInboxId })).toThrow(
        "privateKey is required"
      );
    });
  });
});
