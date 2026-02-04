import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ConvosMiddleware,
  type XMTPAgent,
  type XMTPConversation,
  type XMTPMessageContext,
  parseInviteSlug,
  verifyInviteWithPrivateKey,
  decryptInviteConversationId,
} from "../src/index.js";

describe("End-to-end integration", () => {
  // Creator's identity
  const creatorPrivateKey = new Uint8Array([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
    0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
    0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
  ]);
  const creatorPrivateKeyHex = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
  const creatorInboxId = "abc123def456789012345678901234567890abcdef12345678901234567890ab";

  // Joiner's identity
  const joinerInboxId = "joiner123456789012345678901234567890abcdef12345678901234567890cd";

  let originalEnv: string | undefined;
  let mockConversation: XMTPConversation;
  let mockBlockFn: ReturnType<typeof vi.fn>;

  function createMockConversation(id: string): XMTPConversation {
    return {
      id,
      send: vi.fn().mockResolvedValue(undefined),
      addMembers: vi.fn().mockResolvedValue(undefined),
    };
  }

  function createMockAgent(conversationId?: string): XMTPAgent {
    mockConversation = createMockConversation(conversationId ?? "550e8400-e29b-41d4-a716-446655440000");
    mockBlockFn = vi.fn().mockResolvedValue(undefined);

    return {
      client: {
        inboxId: creatorInboxId,
        conversations: {
          getConversationById: vi.fn().mockImplementation(async (id: string) => {
            if (id === mockConversation.id) {
              return mockConversation;
            }
            return null;
          }),
        },
        contacts: {
          refreshConsentList: vi.fn().mockResolvedValue(undefined),
          block: mockBlockFn,
        },
      },
    };
  }

  function createMockDmContext(text: string, senderInboxId: string): XMTPMessageContext {
    return {
      message: {
        content: text,
        senderInboxId,
      },
      conversation: createMockConversation("dm-conversation"),
    };
  }

  beforeEach(() => {
    originalEnv = process.env.XMTP_WALLET_KEY;
    process.env.XMTP_WALLET_KEY = creatorPrivateKeyHex;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.XMTP_WALLET_KEY;
    } else {
      process.env.XMTP_WALLET_KEY = originalEnv;
    }
  });

  describe("Full invite flow with ConvosMiddleware", () => {
    it("should create conversation, generate invite, and process join request", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      // Create metadata and invite
      const { metadata } = convos.createInitialMetadata();
      const conversationId = "550e8400-e29b-41d4-a716-446655440000";

      const invite = convos.createInvite(conversationId, {
        inviteTag: metadata.tag,
        name: "Test Group Chat",
      });

      expect(invite.slug).toBeDefined();
      expect(invite.url).toContain("dev.convos.org/v2");

      // Register invite handler that accepts
      convos.on("invite", async (ctx) => {
        expect(ctx.joinerInboxId).toBe(joinerInboxId);
        expect(ctx.conversationId).toBe(conversationId.toLowerCase());
        expect(ctx.inviteTag).toBe(metadata.tag);
        await ctx.accept();
      });

      // Simulate DM with invite slug through middleware
      const dmCtx = createMockDmContext(invite.slug, joinerInboxId);
      const next = vi.fn();
      await middleware(dmCtx, next);

      // Verify member was added
      expect(mockConversation.addMembers).toHaveBeenCalledWith([joinerInboxId]);
      // Verify next was not called (message was handled)
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow rejecting join requests", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      const { metadata } = convos.createInitialMetadata();
      const invite = convos.createInvite(mockConversation, {
        inviteTag: metadata.tag,
      });

      // Register handler that rejects
      convos.on("invite", async (ctx) => {
        await ctx.reject();
      });

      const dmCtx = createMockDmContext(invite.slug, joinerInboxId);
      await middleware(dmCtx, vi.fn());

      // Error should be sent
      expect(dmCtx.conversation.send).toHaveBeenCalled();
    });

    it("should auto-reject expired invites", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      const { metadata } = convos.createInitialMetadata();
      const invite = convos.createInvite(mockConversation, {
        inviteTag: metadata.tag,
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      const inviteHandler = vi.fn();
      convos.on("invite", inviteHandler);

      const dmCtx = createMockDmContext(invite.slug, joinerInboxId);
      await middleware(dmCtx, vi.fn());

      // Handler should NOT be called for expired invites
      expect(inviteHandler).not.toHaveBeenCalled();
      // Error should be sent
      expect(dmCtx.conversation.send).toHaveBeenCalled();
    });

    it("should block forged invites", async () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);
      const middleware = convos.middleware();

      // Create forged invite with different private key
      const forgedKey = new Uint8Array(32).fill(0x99);
      const forgedAgent: XMTPAgent = {
        client: {
          inboxId: creatorInboxId,
          conversations: { getConversationById: vi.fn() },
          contacts: { refreshConsentList: vi.fn(), block: vi.fn() },
        },
      };
      const forgedConvos = ConvosMiddleware.create(forgedAgent, { privateKey: forgedKey });

      const { metadata } = forgedConvos.createInitialMetadata();
      const forgedInvite = forgedConvos.createInvite("target", {
        inviteTag: metadata.tag,
      });

      const inviteHandler = vi.fn();
      convos.on("invite", inviteHandler);

      const dmCtx = createMockDmContext(forgedInvite.slug, joinerInboxId);
      await middleware(dmCtx, vi.fn());

      expect(inviteHandler).not.toHaveBeenCalled();
      expect(mockBlockFn).toHaveBeenCalledWith([joinerInboxId]);
    });
  });

  describe("Invite verification", () => {
    it("should allow verifying and decrypting invites manually", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const { metadata } = convos.createInitialMetadata();
      const conversationId = "secret-conversation";

      const invite = convos.createInvite(conversationId, {
        inviteTag: metadata.tag,
      });

      // Parse the invite
      const parsed = parseInviteSlug(invite.slug);
      expect(parsed.creatorInboxId).toBe(creatorInboxId);

      // Verify signature
      const isValid = verifyInviteWithPrivateKey(parsed.signedInvite, creatorPrivateKey);
      expect(isValid).toBe(true);

      // Decrypt conversation ID
      const decrypted = decryptInviteConversationId(parsed, creatorPrivateKey);
      expect(decrypted).toBe(conversationId);
    });
  });

  describe("Metadata handling", () => {
    it("should encode and decode metadata", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const { metadata, encodedMetadata } = convos.createInitialMetadata();
      const decoded = convos.decodeMetadata(encodedMetadata);

      expect(decoded.tag).toBe(metadata.tag);
    });

    it("should rotate invite tags", () => {
      const agent = createMockAgent();
      const convos = ConvosMiddleware.create(agent);

      const { metadata: initial } = convos.createInitialMetadata();
      const { newTag } = convos.rotateInviteTag(initial);

      expect(newTag).not.toBe(initial.tag);
      expect(newTag).toHaveLength(10);
    });
  });
});
