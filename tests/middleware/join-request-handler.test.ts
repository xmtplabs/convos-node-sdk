import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  JoinRequestHandler,
  JoinRequestResult,
  type XMTPAgent,
} from "../../src/middleware/join-request-handler.js";
import { createInviteSlug } from "../../src/invite/signed-invite.js";
import { InviteJoinErrorType } from "../../src/content-types/invite-join-error.js";

describe("JoinRequestHandler", () => {
  const testPrivateKey = new Uint8Array([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
    0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
    0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
  ]);
  const testPrivateKeyHex = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
  const testInboxId = "abc123def456789012345678901234567890abcdef12345678901234567890ab";
  const testConversationId = "550e8400-e29b-41d4-a716-446655440000";
  const testTag = "invite1234";
  const joinerInboxId = "joiner123456789012345678901234567890abcdef12345678901234567890cd";

  function createMockAgent(): XMTPAgent {
    return {
      client: {
        inboxId: testInboxId,
      },
    };
  }

  function createValidInvite(options?: { expiresAt?: Date; conversationExpiresAt?: Date }) {
    return createInviteSlug({
      conversationId: testConversationId,
      inviteTag: testTag,
      creatorInboxId: testInboxId,
      privateKey: testPrivateKey,
      ...options,
    });
  }

  describe("processMessage", () => {
    it("should successfully process valid join request", async () => {
      const onJoinRequest = vi.fn().mockResolvedValue(true);
      const handler = new JoinRequestHandler({
        inboxId: testInboxId,
        privateKey: testPrivateKey,
        onJoinRequest,
      });

      const slug = createValidInvite();
      const result = await handler.processMessage(slug, joinerInboxId);

      expect(result.result).toBe(JoinRequestResult.Success);
      expect(result.conversationId).toBe(testConversationId.toLowerCase());
      expect(result.inviteTag).toBe(testTag);
      expect(onJoinRequest).toHaveBeenCalledWith(
        joinerInboxId,
        testConversationId.toLowerCase(),
        testTag
      );
    });

    it("should ignore messages from self", async () => {
      const handler = new JoinRequestHandler({
        inboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      const slug = createValidInvite();
      const result = await handler.processMessage(slug, testInboxId);

      expect(result.result).toBe(JoinRequestResult.NotJoinRequest);
    });

    it("should pass through non-invite messages", async () => {
      const handler = new JoinRequestHandler({
        inboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      const result = await handler.processMessage("Hello, how are you?", joinerInboxId);
      expect(result.result).toBe(JoinRequestResult.NotJoinRequest);
    });

    it("should block malformed invite-like messages", async () => {
      const handler = new JoinRequestHandler({
        inboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      // Long base64-like string that fails to parse
      const fakeSlug = "A".repeat(100);
      const result = await handler.processMessage(fakeSlug, joinerInboxId);

      expect(result.result).toBe(JoinRequestResult.BlockSender);
    });

    it("should block invites from different creator", async () => {
      const differentInboxId = "different123456789012345678901234567890abcdef123456789012345678";
      const handler = new JoinRequestHandler({
        inboxId: differentInboxId, // Different from invite creator
        privateKey: testPrivateKey,
      });

      const slug = createValidInvite();
      const result = await handler.processMessage(slug, joinerInboxId);

      expect(result.result).toBe(JoinRequestResult.BlockSender);
      expect(result.errorMessage).toContain("not created by this inbox");
    });

    it("should send error for expired invite", async () => {
      const onJoinError = vi.fn();
      const handler = new JoinRequestHandler({
        inboxId: testInboxId,
        privateKey: testPrivateKey,
        onJoinError,
      });

      const slug = createValidInvite({
        expiresAt: new Date(Date.now() - 1000), // Expired
      });
      const result = await handler.processMessage(slug, joinerInboxId);

      expect(result.result).toBe(JoinRequestResult.SendError);
      expect(result.error?.errorType).toBe(InviteJoinErrorType.ConversationExpired);
      expect(onJoinError).toHaveBeenCalled();
    });

    it("should send error for expired conversation", async () => {
      const onJoinError = vi.fn();
      const handler = new JoinRequestHandler({
        inboxId: testInboxId,
        privateKey: testPrivateKey,
        onJoinError,
      });

      const slug = createValidInvite({
        conversationExpiresAt: new Date(Date.now() - 1000), // Expired
      });
      const result = await handler.processMessage(slug, joinerInboxId);

      expect(result.result).toBe(JoinRequestResult.SendError);
      expect(result.error?.errorType).toBe(InviteJoinErrorType.ConversationExpired);
    });

    it("should send error when conversation not found", async () => {
      const onJoinError = vi.fn();
      const handler = new JoinRequestHandler({
        inboxId: testInboxId,
        privateKey: testPrivateKey,
        onJoinError,
        conversationExists: async () => false,
      });

      const slug = createValidInvite();
      const result = await handler.processMessage(slug, joinerInboxId);

      expect(result.result).toBe(JoinRequestResult.SendError);
      expect(result.error?.errorType).toBe(InviteJoinErrorType.ConversationExpired);
    });

    it("should send error when onJoinRequest returns false", async () => {
      const onJoinRequest = vi.fn().mockResolvedValue(false);
      const onJoinError = vi.fn();
      const handler = new JoinRequestHandler({
        inboxId: testInboxId,
        privateKey: testPrivateKey,
        onJoinRequest,
        onJoinError,
      });

      const slug = createValidInvite();
      const result = await handler.processMessage(slug, joinerInboxId);

      expect(result.result).toBe(JoinRequestResult.SendError);
      expect(result.error?.errorType).toBe(InviteJoinErrorType.GenericFailure);
    });

    it("should send error when onJoinRequest throws", async () => {
      const onJoinRequest = vi.fn().mockRejectedValue(new Error("Network error"));
      const onJoinError = vi.fn();
      const handler = new JoinRequestHandler({
        inboxId: testInboxId,
        privateKey: testPrivateKey,
        onJoinRequest,
        onJoinError,
      });

      const slug = createValidInvite();
      const result = await handler.processMessage(slug, joinerInboxId);

      expect(result.result).toBe(JoinRequestResult.SendError);
      expect(result.errorMessage).toContain("Network error");
    });
  });

  describe("encodeErrorForSending", () => {
    it("should encode error to bytes", () => {
      const handler = new JoinRequestHandler({
        inboxId: testInboxId,
        privateKey: testPrivateKey,
      });

      const error = {
        errorType: InviteJoinErrorType.GenericFailure,
        inviteTag: "test",
        timestamp: new Date(),
      };

      const encoded = handler.encodeErrorForSending(error);
      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBeGreaterThan(0);
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

    it("should create handler from agent", async () => {
      const agent = createMockAgent();
      const onJoinRequest = vi.fn().mockResolvedValue(true);
      const handler = JoinRequestHandler.fromAgent(agent, { onJoinRequest });

      const slug = createValidInvite();
      const result = await handler.processMessage(slug, joinerInboxId);

      expect(result.result).toBe(JoinRequestResult.Success);
      expect(onJoinRequest).toHaveBeenCalled();
    });

    it("should handle 0x prefix in wallet key", () => {
      process.env.XMTP_WALLET_KEY = "0x" + testPrivateKeyHex;
      const agent = createMockAgent();
      const handler = JoinRequestHandler.fromAgent(agent);

      // Should not throw
      expect(handler).toBeDefined();
    });
  });
});
